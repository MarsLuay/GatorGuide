"use strict";

const { createSourceAcquisition } = require("../acquisition/source-acquisition.cjs");
const { createRawSnapshot } = require("../acquisition/raw-snapshot.cjs");
const {
  htmlToSourceDocument,
  pdfTextToSourceDocument,
} = require("../document/source-document.cjs");

/**
 * Temporary legacy adapter: wraps transport Source Documents for the existing
 * monolith parser until source-family adapters migrate (P04-D / P05 strangler).
 */
function createLegacyParserAdapter(options = {}) {
  const parseFn = options.parseSourceDocument || (async (doc) => ({
    adapterId: "legacy-monolith",
    status: "deferred",
    message: "legacy parse not invoked in contract mode",
    documentKind: doc?.kind || null,
    pageCount: Array.isArray(doc?.pages) ? doc.pages.length : 0,
  }));

  return {
    id: "legacy-monolith",
    async matches() {
      return true;
    },
    async parse(sourceDocument) {
      return parseFn(sourceDocument);
    },
  };
}

/**
 * Acquisition stage implementation used by refreshPlannerData when no override.
 */
function createAcquisitionStage(options = {}) {
  const acquisition = options.acquisition || createSourceAcquisition(options);
  return async function acquisitionStage(ctx = {}) {
    const urls = ctx.options?.urls || [];
    if (!urls.length) {
      return {
        stage: "acquisition",
        status: "noop",
        message: "no urls supplied — strangler idle",
      };
    }
    const items = [];
    for (const url of urls) {
      const acquired = await acquisition.acquire(url, ctx.options?.timeoutMs);
      if (!acquired.ok) {
        items.push({ url, ok: false, error: acquired.error });
        continue;
      }
      const body = acquired.body || "";
      const snapshot = createRawSnapshot({
        body,
        headers: acquired.headers || {},
        contentType: acquired.contentType || "text/html",
        sourceUrl: url,
      });
      const doc =
        String(acquired.contentType || "").includes("pdf") ||
        String(url).toLowerCase().endsWith(".pdf")
          ? pdfTextToSourceDocument({
              text: body,
              sourceUrl: url,
              snapshotId: snapshot.snapshotId,
            })
          : htmlToSourceDocument({
              html: body,
              sourceUrl: url,
              snapshotId: snapshot.snapshotId,
            });
      items.push({
        url,
        ok: true,
        snapshotId: snapshot.snapshotId,
        document: doc,
      });
    }
    return {
      stage: "acquisition",
      status: items.every((i) => i.ok) ? "ok" : "partial",
      items,
    };
  };
}

function createParsingStage(options = {}) {
  const adapter = options.legacyAdapter || createLegacyParserAdapter(options);
  return async function parsingStage(ctx = {}) {
    const prior = (ctx.options?.__priorResults || []).find(
      (r) => r.stage === "acquisition"
    );
    const docs = (prior?.items || [])
      .filter((i) => i.ok && i.document)
      .map((i) => i.document);
    if (!docs.length) {
      return {
        stage: "parsing",
        status: "noop",
        message: "no source documents — legacy adapter idle",
      };
    }
    const outputs = [];
    for (const doc of docs) {
      outputs.push(await adapter.parse(doc));
    }
    return { stage: "parsing", status: "ok", adapterId: adapter.id, outputs };
  };
}

module.exports = {
  createLegacyParserAdapter,
  createAcquisitionStage,
  createParsingStage,
};
