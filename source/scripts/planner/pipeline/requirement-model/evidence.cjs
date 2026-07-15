
"use strict";
const crypto = require("node:crypto");

/** P03-D provenance / evidence. */

function hashEvidenceText(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function createEvidence(input = {}) {
  const required = ["sourceUrl", "catalogYear", "sourceRole", "parserFamily"];
  for (const key of required) {
    if (!input[key]) throw new Error(`${key} required on evidence`);
  }
  const evidenceText = input.evidenceText || "";
  return {
    sourceUrl: input.sourceUrl,
    canonicalUrl: input.canonicalUrl || input.sourceUrl,
    catalogYear: input.catalogYear,
    sourceRole: input.sourceRole,
    extractionLocation: input.extractionLocation || null,
    evidenceText,
    evidenceHash: input.evidenceHash || hashEvidenceText(evidenceText),
    acquiredAt: input.acquiredAt || null,
    parserFamily: input.parserFamily,
    parserVersion: input.parserVersion || "0",
    conflictLineage: [...(input.conflictLineage || [])],
  };
}

function attachEvidence(fact, evidence) {
  if (!evidence?.evidenceHash) throw new Error("schedulable facts require evidence");
  return { ...fact, evidence };
}

module.exports = {
  hashEvidenceText,
  createEvidence,
  attachEvidence,
};
