"use strict";

/**
 * UW general catalog HTML family (P05-C).
 * Extracts department course listings into a Requirement Model-shaped draft.
 */

const {
  createRequirementModelDocument,
  legacyCourseListToExpression,
  createEvidence,
} = require("../../requirement-model/schema.cjs");

const COURSE_CODE_RE =
  /\b([A-Z]{2,7}(?:&amp;|&)?\s?\d{3}[A-Z]?)\b/g;

function looksLikeUwCatalogHtml(sourceDocument) {
  const url = String(sourceDocument?.sourceUrl || "");
  const text = (sourceDocument?.pages || [])
    .flatMap((p) => p.textBlocks || [])
    .map((b) => b.text)
    .join("\n");
  return (
    /www\.washington\.edu\/students\/gencat|catalog\.uw\.edu|general.?catalog/i.test(
      url + "\n" + text.slice(0, 3000)
    ) || /University of Washington General Catalog/i.test(text)
  );
}

function normalizeCourseCode(raw) {
  return String(raw)
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function extractCourseCodes(text) {
  const codes = [];
  const seen = new Set();
  for (const match of String(text).matchAll(COURSE_CODE_RE)) {
    const code = normalizeCourseCode(match[1]);
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}

function createUwGeneralCatalogHtmlAdapter() {
  return {
    id: "uw-general-catalog-html",
    async matches(sourceDocument) {
      return looksLikeUwCatalogHtml(sourceDocument);
    },
    async parse(sourceDocument) {
      const text = (sourceDocument?.pages || [])
        .flatMap((p) => p.textBlocks || [])
        .map((b) => b.text)
        .join("\n");
      const courseCodes = extractCourseCodes(text);
      const yearMatch = text.match(/\b(20\d{2})\s*[-–\/]\s*(20\d{2})\b/);
      const catalogYear = yearMatch
        ? `${yearMatch[1]}-${yearMatch[2].slice(-2)}`
        : "unknown";
      const dept =
        String(sourceDocument?.sourceUrl || "").match(/\/([a-z0-9_-]+)\.html?/i)?.[1] ||
        "department";

      const evidence = createEvidence({
        sourceUrl: sourceDocument?.sourceUrl || "about:blank",
        catalogYear,
        sourceRole: "uw-general-catalog",
        parserFamily: "uw-general-catalog-html",
        parserVersion: "0.2.0",
        evidenceText: text.slice(0, 4000),
      });

      const requirementModel = createRequirementModelDocument({
        identity: {
          requirementSetId: `uw-gencat:${dept}:${catalogYear}`,
          programId: `uw-gencat:${dept}`,
          catalogYear,
          sourceOwnerId: "uw-general-catalog-html",
          label: `UW General Catalog ${dept}`,
        },
        expression: legacyCourseListToExpression(courseCodes),
        evidence,
      });

      return {
        adapterId: "uw-general-catalog-html",
        status: courseCodes.length ? "ok" : "partial",
        message: courseCodes.length
          ? `extracted ${courseCodes.length} catalog course codes`
          : "structural harness — no course codes in document",
        sourceUrl: sourceDocument?.sourceUrl || null,
        courseCodes,
        requirementModel,
      };
    },
  };
}

module.exports = { createUwGeneralCatalogHtmlAdapter, looksLikeUwCatalogHtml };
