"use strict";

/** Official degree-document family (PDF/DOCX) — P06-A structural harness. */

function looksLikeOfficialDegreeDocument(sourceDocument) {
  const url = String(sourceDocument?.sourceUrl || "").toLowerCase();
  const text = (sourceDocument?.pages || [])
    .flatMap((p) => p.textBlocks || [])
    .map((b) => b.text)
    .join("\n");
  return (
    /\.pdf($|\?)/i.test(url) ||
    /degree (sheet|planning|worksheet)|planning grid|course planner/i.test(text) ||
    (sourceDocument?.kind === "source-document" &&
      Array.isArray(sourceDocument.pages) &&
      sourceDocument.pages.length > 1 &&
      /credit/i.test(text) &&
      /requirement/i.test(text))
  );
}

function createOfficialDegreeDocumentAdapter() {
  return {
    id: "official-degree-document",
    async matches(sourceDocument) {
      return looksLikeOfficialDegreeDocument(sourceDocument);
    },
    async parse(sourceDocument) {
      return {
        adapterId: "official-degree-document",
        status: "partial",
        message: "structural harness — table/column IR pending P06-A fixtures",
        pageCount: Array.isArray(sourceDocument?.pages)
          ? sourceDocument.pages.length
          : 0,
        sourceUrl: sourceDocument?.sourceUrl || null,
      };
    },
  };
}

module.exports = {
  createOfficialDegreeDocumentAdapter,
  looksLikeOfficialDegreeDocument,
};
