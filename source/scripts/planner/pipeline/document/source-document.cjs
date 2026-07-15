
"use strict";

/** Transport-level Source Document — no academic interpretation (P04-C). */

function htmlToSourceDocument({ html, sourceUrl, snapshotId }) {
  const text = String(html || "");
  const links = [...text.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const headings = [...text.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/gis)].map((m) => ({
    level: Number(m[1]),
    text: m[2].replace(/<[^>]+>/g, "").trim(),
  }));
  return {
    kind: "source-document",
    sourceUrl: sourceUrl || null,
    snapshotId: snapshotId || null,
    pages: [{ pageIndex: 0, textBlocks: [{ text, start: 0, end: text.length }], tables: [], links, headings }],
  };
}

function pdfTextToSourceDocument({ text, sourceUrl, snapshotId, pageTexts = null }) {
  const pages = (pageTexts || [text || ""]).map((pageText, pageIndex) => ({
    pageIndex,
    textBlocks: [{ text: pageText, start: 0, end: String(pageText).length }],
    tables: [],
    links: [],
    headings: [],
  }));
  return {
    kind: "source-document",
    sourceUrl: sourceUrl || null,
    snapshotId: snapshotId || null,
    pages,
  };
}

module.exports = { htmlToSourceDocument, pdfTextToSourceDocument };
