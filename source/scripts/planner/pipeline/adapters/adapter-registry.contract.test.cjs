"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createLegacyParserAdapter,
  createAcquisitionStage,
} = require("../orchestration/legacy-bridge.cjs");
const { refreshPlannerData } = require("../refresh-planner-data.cjs");
const {
  createAdapterRegistry,
  assertNoIdentityDispatch,
  FORBIDDEN_DISPATCH_KEYS,
} = require("./registry.cjs");
const { htmlToSourceDocument } = require("../document/source-document.cjs");

test("P04-D legacy adapter parses transport documents only", async () => {
  const adapter = createLegacyParserAdapter({
    parseSourceDocument: async (doc) => ({
      adapterId: "legacy-monolith",
      status: "ok",
      pageCount: doc.pages.length,
    }),
  });
  const doc = htmlToSourceDocument({
    html: "<html><body><h1>Program</h1></body></html>",
    sourceUrl: "https://www.washington.edu/example",
  });
  const out = await adapter.parse(doc);
  assert.equal(out.pageCount, 1);
});

test("P04-D refreshPlannerData acquisition+parsing with fixture urls", async () => {
  const result = await refreshPlannerData({
    stages: ["acquisition", "parsing"],
    urls: ["https://www.washington.edu/fixture"],
    adapters: {
      acquisition: createAcquisitionStage({
        allowNonOfficial: false,
        downloader: {
          downloadSource: async (url) => ({
            body: "<html><body>Hello</body></html>",
            contentType: "text/html",
            headers: {},
            fetchMode: "fixture",
          }),
        },
      }),
    },
    legacyAdapter: createLegacyParserAdapter({
      parseSourceDocument: async (doc) => ({
        adapterId: "legacy-monolith",
        status: "ok",
        pageCount: doc.pages.length,
      }),
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.results[0].status, "ok");
  assert.equal(result.results[1].status, "ok");
});

test("P05-A registry requires exactly one primary match", async () => {
  const registry = createAdapterRegistry();
  const doc = htmlToSourceDocument({ html: "<div class='program'>x</div>" });

  registry.register({
    id: "uw-program-html",
    async matches(d) {
      return /program/i.test(d.pages[0].textBlocks[0].text);
    },
  });
  registry.register({
    id: "other",
    async matches() {
      return false;
    },
  });

  const selected = await registry.selectPrimary(doc);
  assert.equal(selected.ok, true);
  assert.equal(selected.adapter.id, "uw-program-html");

  registry.register({
    id: "also-matches",
    async matches() {
      return true;
    },
  });
  const ambiguous = await registry.selectPrimary(doc);
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.error, "ambiguous-adapter");
});

test("P05-A forbids planId/ownerId/major dispatch in matcher source", () => {
  assert.throws(() => assertNoIdentityDispatch("if (context.planId) return true"));
  assert.throws(() => assertNoIdentityDispatch("ownerId === x"));
  assert.ok(assertNoIdentityDispatch("return hasDrupalSections(doc)"));
  assert.ok(FORBIDDEN_DISPATCH_KEYS.includes("planId"));
});

test("P05-A architecture: adapter registry module has no identity dispatch", () => {
  const src = fs.readFileSync(path.join(__dirname, "registry.cjs"), "utf8");
  // The forbidden-key list may mention the names; ensure matchers aren't implemented with them.
  assert.doesNotMatch(src, /matches\([^)]*\)\s*\{[^}]*planId/s);
});
