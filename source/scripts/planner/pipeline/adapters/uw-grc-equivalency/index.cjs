"use strict";

/** UW–GRC equivalency guide family — P06-B. */

const COURSE_CODE_RE = /\b([A-Z]{2,7}(?:&amp;|&)?\s?\d{3}[A-Z]?)\b/g;

function sourceText(sourceDocument) {
  return (sourceDocument?.pages || [])
    .flatMap((p) => p.textBlocks || [])
    .map((b) => b.text)
    .join("\n");
}

function stripTags(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCourseCode(raw) {
  return String(raw)
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function firstCourseCode(value) {
  const match = String(value || "").match(COURSE_CODE_RE);
  return match ? normalizeCourseCode(match[0]) : null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractEquivalencies(text) {
  const equivalencies = [];
  const rows = [...String(text || "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      stripTags(cell[1])
    );
    if (cells.length < 2) continue;
    const grcCourseCode = firstCourseCode(cells[0]);
    const uwCourseCode = firstCourseCode(cells[1]);
    if (!grcCourseCode || !uwCourseCode) continue;
    equivalencies.push({
      grcCourseCode,
      uwCourseCode,
      rawText: `${cells[0]} => ${cells[1]}`,
    });
  }

  for (const line of stripTags(text).split(/\s*(?:\n|;)\s*/)) {
    const pair = line.match(
      /\b([A-Z]{2,7}(?:&)?\s?\d{3}[A-Z]?)\b\s*(?:=>|=|equiv(?:alent)? to|transfers as)\s*\b([A-Z]{2,7}(?:&)?\s?\d{3}[A-Z]?)\b/i
    );
    if (!pair) continue;
    equivalencies.push({
      grcCourseCode: normalizeCourseCode(pair[1]),
      uwCourseCode: normalizeCourseCode(pair[2]),
      rawText: line.trim(),
    });
  }

  const seen = new Set();
  return equivalencies.filter((item) => {
    const key = `${item.grcCourseCode}:${item.uwCourseCode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function looksLikeUwGrcEquivalency(sourceDocument) {
  const url = String(sourceDocument?.sourceUrl || "");
  const text = sourceText(sourceDocument);
  return (
    /equivalency|transfer guide|course equivalen/i.test(url + "\n" + text.slice(0, 4000)) &&
    /green\s*river|grc/i.test(text + url)
  );
}

function createUwGrcEquivalencyAdapter() {
  return {
    id: "uw-grc-equivalency",
    async matches(sourceDocument) {
      return looksLikeUwGrcEquivalency(sourceDocument);
    },
    async parse(sourceDocument) {
      const text = sourceText(sourceDocument);
      const equivalencies = extractEquivalencies(text);
      return {
        adapterId: "uw-grc-equivalency",
        status: equivalencies.length ? "ok" : "partial",
        domain: "equivalency-ir",
        message: equivalencies.length
          ? `extracted ${equivalencies.length} UW-GRC equivalency rows`
          : "equivalency IR separate from UW requirement IR",
        sourceUrl: sourceDocument?.sourceUrl || null,
        equivalencies,
        grcCourseCodes: unique(equivalencies.map((item) => item.grcCourseCode)),
        uwCourseCodes: unique(equivalencies.map((item) => item.uwCourseCode)),
      };
    },
  };
}

module.exports = {
  createUwGrcEquivalencyAdapter,
  looksLikeUwGrcEquivalency,
  extractEquivalencies,
  normalizeCourseCode,
};
