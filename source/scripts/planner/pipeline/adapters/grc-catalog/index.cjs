"use strict";

/** Green River catalog family — P06-C. */

const {
  createRequirementModelDocument,
  createEvidence,
  legacyCourseListToExpression,
} = require("../../requirement-model/schema.cjs");

const COURSE_CODE_RE = /\b([A-Z]{2,7}(?:&amp;|&)?\s?\d{3}[A-Z]?)\b/g;

function sourceText(sourceDocument) {
  return (sourceDocument?.pages || [])
    .flatMap((p) => p.textBlocks || [])
    .map((b) => b.text)
    .join("\n");
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
  for (const match of String(text || "").matchAll(COURSE_CODE_RE)) {
    const code = normalizeCourseCode(match[1]);
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}

function inferCatalogYear(text, sourceUrl) {
  const range = String(text || "").match(/\b(20\d{2})\s*[-–\/]\s*(20\d{2})\b/);
  if (range) return `${range[1]}-${range[2].slice(-2)}`;
  const single = String(`${text || ""} ${sourceUrl || ""}`).match(/\b(20\d{2})\b/);
  return single ? `${single[1]}-${String(Number(single[1]) + 1).slice(-2)}` : "unknown";
}

function slugify(value) {
  return String(value || "unknown-program")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function inferProgramId(sourceUrl, headings) {
  const programHeading = (headings || []).find((h) => h.level > 1)?.text || headings?.[0]?.text;
  if (programHeading) return `grc:${slugify(programHeading)}`;
  const slug = String(sourceUrl || "").match(/\/([a-z0-9-]+)(?:\/|\.html?)?$/i);
  return slug ? `grc:${slug[1].toLowerCase()}` : "grc:unknown-program";
}

function looksLikeGrcCatalog(sourceDocument) {
  const url = String(sourceDocument?.sourceUrl || "");
  const text = sourceText(sourceDocument);
  return (
    /greenriver\.edu/i.test(url) &&
    (/catalog|associate|prerequisite|course description/i.test(text + url) ||
      /AAS-T|Associate in/i.test(text))
  );
}

function createGrcCatalogAdapter() {
  return {
    id: "grc-catalog",
    async matches(sourceDocument) {
      return looksLikeGrcCatalog(sourceDocument);
    },
    async parse(sourceDocument) {
      const text = sourceText(sourceDocument);
      const headings = (sourceDocument?.pages || [])
        .flatMap((p) => p.headings || [])
        .filter(Boolean);
      const courseCodes = extractCourseCodes(text);
      const catalogYear = inferCatalogYear(text, sourceDocument?.sourceUrl);
      const programId = inferProgramId(sourceDocument?.sourceUrl, headings);
      const sections = headings.length
        ? headings.map((h, index) => ({
            kind: "section",
            title: h.text,
            level: h.level,
            index,
            schedulableHint: /associate|course|prerequisite|requirement/i.test(h.text),
          }))
        : [
            {
              kind: "section",
              title: "unscoped",
              index: 0,
              schedulableHint: /associate|course|prerequisite|requirement/i.test(text),
            },
          ];
      const evidence = createEvidence({
        sourceUrl: sourceDocument?.sourceUrl || "about:blank",
        catalogYear,
        sourceRole: "grc-catalog",
        parserFamily: "grc-catalog",
        parserVersion: "0.2.0",
        evidenceText: text.slice(0, 4000),
        extractionLocation: sourceDocument?.snapshotId || null,
      });
      const requirementModel = createRequirementModelDocument({
        identity: {
          requirementSetId: `${programId}:${catalogYear}:catalog-courses`,
          programId,
          catalogYear,
          sourceOwnerId: "grc-catalog",
          label: headings.find((h) => h.level > 1)?.text || headings[0]?.text || programId,
        },
        expression: legacyCourseListToExpression(courseCodes),
        evidence,
      });

      return {
        adapterId: "grc-catalog",
        status: courseCodes.length ? "ok" : "partial",
        domain: "grc-course-ir",
        message: courseCodes.length
          ? `extracted ${courseCodes.length} catalog course codes into Requirement Model v1`
          : "GRC catalog/track harness — preserve current track selection semantics",
        sourceUrl: sourceDocument?.sourceUrl || null,
        courseCodes,
        requirementDraft: {
          modelVersion: "1.0.0",
          sections,
        },
        requirementModel,
      };
    },
  };
}

module.exports = {
  createGrcCatalogAdapter,
  looksLikeGrcCatalog,
  extractCourseCodes,
  normalizeCourseCode,
};
