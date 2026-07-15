"use strict";

/**
 * UW program-page HTML family (P05-B).
 * Extracts course-code atoms + section structure into Requirement Model v1 draft.
 */

const {
  createRequirementModelDocument,
  legacyCourseListToExpression,
  createEvidence,
} = require("../../requirement-model/schema.cjs");

const COURSE_CODE_RE =
  /\b([A-Z]{2,7}(?:&amp;|&)?\s?\d{3}[A-Z]?)\b/g;

function looksLikeUwProgramHtml(sourceDocument) {
  const text = (sourceDocument?.pages || [])
    .flatMap((p) => p.textBlocks || [])
    .map((b) => b.text)
    .join("\n");
  const hasProgramCue =
    /class=["'][^"']*program/i.test(text) ||
    /<h1[^>]*>[\s\S]{0,80}(Bachelor|Major|Degree)/i.test(text) ||
    /Admission Requirements/i.test(text);
  const hasDrupalOrCampus =
    /washington\.edu|uwb\.edu|tacoma\.uw\.edu|drupal/i.test(
      String(sourceDocument?.sourceUrl || "") + text.slice(0, 2000)
    );
  return Boolean(hasProgramCue && hasDrupalOrCampus);
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

function inferCatalogYear(text, sourceUrl) {
  const fromText = String(text).match(/\b(20\d{2})\s*[-–\/]\s*(20\d{2})\b/);
  if (fromText) return `${fromText[1]}-${fromText[2].slice(-2)}`;
  const single = String(text + " " + (sourceUrl || "")).match(/\b(20\d{2})\b/);
  return single ? `${single[1]}-${String(Number(single[1]) + 1).slice(-2)}` : "unknown";
}

function inferProgramId(sourceUrl, headings) {
  const url = String(sourceUrl || "");
  const slug = url.match(/\/([a-z0-9-]+)(?:\/|\.html?)?$/i);
  if (slug) return `uw:${slug[1].toLowerCase()}`;
  const h1 = (headings || []).find((h) => h.level === 1);
  if (h1?.text) {
    return `uw:${h1.text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  }
  return "uw:unknown-program";
}

function createUwProgramHtmlAdapter() {
  return {
    id: "uw-program-html",
    async matches(sourceDocument) {
      return looksLikeUwProgramHtml(sourceDocument);
    },
    async parse(sourceDocument) {
      const text = (sourceDocument?.pages || [])
        .flatMap((p) => p.textBlocks || [])
        .map((b) => b.text)
        .join("\n");
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
            schedulableHint: /requirement|admission|prerequisite|course/i.test(
              h.text
            ),
          }))
        : [
            {
              kind: "section",
              title: "unscoped",
              index: 0,
              schedulableHint: /Admission Requirements/i.test(text),
            },
          ];

      const evidence = createEvidence({
        sourceUrl: sourceDocument?.sourceUrl || "about:blank",
        catalogYear,
        sourceRole: "uw-program-page",
        parserFamily: "uw-program-html",
        parserVersion: "0.2.0",
        evidenceText: text.slice(0, 4000),
        extractionLocation: sourceDocument?.snapshotId || null,
      });

      const requirementModel = createRequirementModelDocument({
        identity: {
          requirementSetId: `${programId}:${catalogYear}:admission`,
          programId,
          catalogYear,
          sourceOwnerId: "uw-program-html",
          label: headings[0]?.text || programId,
        },
        expression: legacyCourseListToExpression(courseCodes),
        evidence,
      });

      return {
        adapterId: "uw-program-html",
        status: courseCodes.length ? "ok" : "partial",
        message: courseCodes.length
          ? `extracted ${courseCodes.length} course codes into Requirement Model v1`
          : "no course codes found — structural sections only",
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
  createUwProgramHtmlAdapter,
  looksLikeUwProgramHtml,
  extractCourseCodes,
  normalizeCourseCode,
};
