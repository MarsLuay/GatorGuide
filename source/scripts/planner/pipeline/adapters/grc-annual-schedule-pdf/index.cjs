"use strict";

/** Green River annual schedule PDF family — P06-D. Preserve availability semantics. */

const COURSE_CODE_RE = /^([A-Z]{2,7}(?:&amp;|&)?\s?\d{3}[A-Z]?)\b\s+(.+)$/;
const TERM_NAMES = Object.freeze(["fall", "winter", "spring", "summer"]);

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

function parseHeaderTerms(line) {
  const lower = String(line || "").toLowerCase();
  return TERM_NAMES.filter((term) => new RegExp(`\\b${term}\\b`, "i").test(lower));
}

function isAvailableToken(token) {
  return /^(x|yes|y|offered|available)$/i.test(String(token || ""));
}

function extractAvailability(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let terms = ["fall", "winter", "spring"];
  const header = lines.find((line) => /\bcourse\b/i.test(line) && /\b(fall|winter|spring|summer)\b/i.test(line));
  if (header) {
    const parsed = parseHeaderTerms(header);
    if (parsed.length) terms = parsed;
  }

  const availability = [];
  for (const line of lines) {
    const match = line.match(COURSE_CODE_RE);
    if (!match) continue;
    const tokens = match[2].trim().split(/\s+/);
    const offeredTerms = terms.filter((term, index) => isAvailableToken(tokens[index]));
    if (!offeredTerms.length) continue;
    availability.push({
      courseCode: normalizeCourseCode(match[1]),
      terms: offeredTerms,
      rawText: line,
    });
  }
  return availability;
}

function looksLikeGrcAnnualSchedule(sourceDocument) {
  const url = String(sourceDocument?.sourceUrl || "");
  const text = sourceText(sourceDocument);
  return (
    (/annual.?schedule|class.?schedule/i.test(url + text) &&
      /greenriver\.edu|green\s*river/i.test(url + text)) ||
    (/\.pdf/i.test(url) && /greenriver\.edu/i.test(url) && /schedule/i.test(url + text))
  );
}

function createGrcAnnualScheduleAdapter() {
  return {
    id: "grc-annual-schedule-pdf",
    async matches(sourceDocument) {
      return looksLikeGrcAnnualSchedule(sourceDocument);
    },
    async parse(sourceDocument) {
      const text = sourceText(sourceDocument);
      const availability = extractAvailability(text);
      return {
        adapterId: "grc-annual-schedule-pdf",
        status: availability.length ? "ok" : "partial",
        domain: "grc-availability",
        message: availability.length
          ? `extracted ${availability.length} annual schedule availability rows`
          : "must preserve emitted availability semantics byte-for-byte vs baseline",
        sourceUrl: sourceDocument?.sourceUrl || null,
        availability,
        courseCodes: availability.map((item) => item.courseCode),
      };
    },
  };
}

module.exports = {
  createGrcAnnualScheduleAdapter,
  looksLikeGrcAnnualSchedule,
  extractAvailability,
  normalizeCourseCode,
};
