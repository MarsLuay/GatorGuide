const CHOICE_COUNT_WORDS_PATTERN = "one|two|three|four|five|six|seven|eight|nine|ten";
const CHOICE_REQUIREMENT_CONTEXT_PATTERN = new RegExp(
  `\\b(?:choose(?:\\s+(?:from|${CHOICE_COUNT_WORDS_PATTERN}|\\d+))?|select(?:ed)?(?:\\s+(?:one|from|${CHOICE_COUNT_WORDS_PATTERN}|\\d+))?|electives?|options?|approved\\s+(?:courses?|electives?|list)|elective\\s+list|course\\s+list|one\\s+(?:course\\s+)?from|one\\s+of(?:\\s+the\\s+following)?|either)\\b`,
  "i"
);
const STRONG_CHOICE_REQUIREMENT_CONTEXT_PATTERN = new RegExp(
  `\\b(?:choose(?:\\s+(?:from|${CHOICE_COUNT_WORDS_PATTERN}|\\d+))?|select(?:ed)?(?:\\s+(?:one|from|${CHOICE_COUNT_WORDS_PATTERN}|\\d+))?|approved\\s+(?:courses?|electives?|list)|elective\\s+list|course\\s+list|one\\s+(?:course\\s+)?from|one\\s+of(?:\\s+the\\s+following)?|either|electives?)\\b`,
  "i"
);
const CHOICE_REQUIREMENT_LABEL_PATTERN =
  /\b(?:programming|computing|statistics|thermodynamics|matrix|linear algebra|differential equations|biology|chemistry|physics|economics|communication|composition|science|engineering|fundamentals|mechanics|calculus|electives?|options?|approved|course\s+list|list)\b/i;
const PROGRAMMING_CHOICE_CONTEXT_PATTERN =
  /^(?:\[[^\]]+\]\s*)?(?:computer\s+)?(?:programming|computing)\b/i;
const CHOICE_LIST_START_PATTERN = new RegExp(
  `^\\(?\\s*(?:choose(?:\\s+(?:from|${CHOICE_COUNT_WORDS_PATTERN}|\\d+))?|select(?:ed)?(?:\\s+(?:one|from|${CHOICE_COUNT_WORDS_PATTERN}|\\d+))?|one\\s+(?:course\\s+)?from|one\\s+of(?:\\s+the\\s+following)?|either|approved\\s+(?:courses?|electives?|list)|elective\\s+list)\\b`,
  "i"
);
const NON_CHOICE_COURSE_LIST_CONTEXT_PATTERN =
  /\b(?:all\s+count|will\s+all\s+count|count\s+toward|counts?\s+toward|may\s+count\s+toward|may\s+be\s+(?:applied|used)\s+toward|up\s+to\s+\d+(?:\.\d+)?\s+credits?\b.{0,120}\b(?:applied|count|counts?|used)\b|does\s+not\s+count|not\s+count\s+as|should\s+not\s+take\s+both|may\s+request\b.{0,60}\bsubstitut|also\s+fulfills?|may\s+overlap|overlap\s+with|as\s+well\s+as|must\s+(?:include|complete)|required\s+to\s+complete|suggested\s+first|suggested\s+first-\s*and\s+second-year|sample\s+schedule|sequence|series)\b/i;
const SEQUENCE_ALTERNATIVE_CHOICE_LINE_PATTERN =
  /\b[A-Z&]+(?:\s+[A-Z&]+)?\s+\d{3}[A-Z]?\s*,\s*\d{3}[A-Z]?(?:\s*,\s*\d{3}[A-Z]?){0,2}\s+or\s+(?:[A-Z&]+(?:\s+[A-Z&]+)?\s+)?\d{3}[A-Z]?\s*,\s*\d{3}[A-Z]?(?:\s*,\s*\d{3}[A-Z]?){0,2}\b/i;
const SEQUENCE_CHOICE_CONTEXT_PATTERN =
  /\b(?:one\s+of\s+the\s+following(?:\s+\w+){0,4}\s+sequences?|(?:two|three)\s+quarters?\s+of\s+(?:physics|chemistry|mathematics|math|biology)\b.{0,80}\bone\s+of\s+the\s+following|choose\s+one\s+sequence|select\s+one\s+sequence|one\s+sequence|either\s+sequence|two-quarter\s+sequences?|three-quarter\s+sequences?|calculus-based\s+or\s+algebra-based|algebra-based\s+or\s+calculus-based|regular\s+or\s+accelerated\s+or\s+honors|standard\s+or\s+honors|standard\s+sequence|honors\s+sequence)\b/i;
const SEQUENCE_LABEL_ALTERNATIVE_PATTERN =
  /\b(?:calculus-based|algebra-based|regular|standard|accelerated|honors?)\b(?:\s+or\s+\b(?:calculus-based|algebra-based|regular|standard|accelerated|honors?)\b)+/i;
const SEQUENCE_HEADING_BOUNDARY_PATTERN =
  /\b(?:additional degree requirements?|minimum\s+\d|gpa|option requirement|breadth|natural history|genetics|technical electives?|advanced|capstone|core courses?|required courses?|electives?|freshman year|sophomore year|junior and senior years)\b/i;

const WORD_NUMBER_MAP = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
]);

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSnapshotPagePrefix(line) {
  return normalizeWhitespace(String(line ?? "").replace(/^\[Page\s+\d+\]\s*/i, ""));
}

function stripLeadingRequirementGlyphs(line) {
  return normalizeWhitespace(
    String(line ?? "")
      .replace(/^\(\s*\d+(?:\.\d+)?\s*\)\s*[^A-Za-z0-9(]{1,12}\s*/u, "")
      .replace(/^[^A-Za-z0-9(\[]{1,12}\s*/u, "")
      .replace(/^(?:(?:[\u2022\u25CF\u2023\u25B8\u1405-]|\u00e2\u20ac\u00a2|\u00e2\u20ac\u201d\u008f)\s*)+/u, "")
  );
}

function createParserShapeDetection(options = {}) {
  const extractCourseCodesFromLine =
    typeof options.extractCourseCodesFromLine === "function"
      ? options.extractCourseCodesFromLine
      : () => [];

  function looksLikeStandaloneRequirementLabelLine(line) {
    const normalizedLine = stripLeadingRequirementGlyphs(stripSnapshotPagePrefix(line));
    if (!normalizedLine) {
      return false;
    }
    if (extractCourseCodesFromLine(normalizedLine).length > 0) {
      return false;
    }
    if (/\b(?:students?|see|details?|list|technical electives?|provide|coursework)\b/i.test(normalizedLine)) {
      return false;
    }
    if (!/\b(?:credits?|cr)\b/i.test(normalizedLine)) {
      return false;
    }
    return /\b(?:programming|statistics|thermodynamics|matrix|linear algebra|differential equations|biology|chemistry|physics|economics|communication|composition|science|engineering|fundamentals|mechanics|calculus)\b/i.test(
      normalizedLine
    );
  }

  function looksLikeStandaloneRequirementTitleLine(line) {
    const normalizedLine = stripLeadingRequirementGlyphs(stripSnapshotPagePrefix(line));
    if (!normalizedLine) {
      return false;
    }
    if (extractCourseCodesFromLine(normalizedLine).length > 0) {
      return false;
    }
    if (/^\d+(?:-\d+)?\s*cr$/i.test(normalizedLine)) {
      return false;
    }
    if (/\b(?:students?|see|details?|list|technical electives?|provide|coursework)\b/i.test(normalizedLine)) {
      return false;
    }
    return /\b(?:programming|statistics|thermodynamics|matrix|linear algebra|differential equations|biology|chemistry|physics|economics|communication|composition|science|engineering|fundamentals|mechanics|calculus)\b/i.test(
      normalizedLine
    );
  }

  return {
    looksLikeStandaloneRequirementLabelLine,
    looksLikeStandaloneRequirementTitleLine,
    stripLeadingRequirementGlyphs,
    stripSnapshotPagePrefix,
  };
}

function detectOptionCue(value) {
  const text = normalizeWhitespace(value);
  const cuePatterns = [
    [/\bone\s+of\s+the\s+following(?:\s+\w+){0,4}\s+sequences?\b/i, "one of the following sequences"],
    [/\bchoose\s+one\s+sequence\b/i, "choose one sequence"],
    [/\bselect\s+one\s+sequence\b/i, "select one sequence"],
    [/\b(?:calculus-based|algebra-based)\b.{0,40}\bor\b.{0,40}\b(?:calculus-based|algebra-based)\b/i, "sequence labels"],
    [/\b(?:regular|standard|accelerated|honors?)\b.{0,40}\bor\b.{0,40}\b(?:regular|standard|accelerated|honors?)\b/i, "sequence labels"],
    [/\bchoose\s+one\b/i, "choose one"],
    [/\bchoose\s+from\b/i, "choose from"],
    [new RegExp(`\\bchoose\\s+(?:${CHOICE_COUNT_WORDS_PATTERN}|\\d+)\\b`, "i"), "choose count"],
    [/\bchoose\b/i, "choose"],
    [/\bone\s+(?:course\s+)?from\b/i, "one from"],
    [/\bone\s+of(?:\s+the\s+following)?\b/i, "one of the following"],
    [/\bselect\s+one\b/i, "select one"],
    [/\bselect\s+from\b/i, "select from"],
    [new RegExp(`\\bselect\\s+(?:${CHOICE_COUNT_WORDS_PATTERN}|\\d+)\\b`, "i"), "select count"],
    [/\bselect\b/i, "select"],
    [/\beither\b/i, "either"],
    [/\bor\b/i, "or"],
    [/\bapproved\s+electives?\b/i, "approved elective"],
    [/\bapproved\s+list\b/i, "approved list"],
    [/\belective\s+list\b/i, "elective list"],
    [/\belectives?\b/i, "elective"],
  ];
  return cuePatterns.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

function detectOptionCueOrNone(value) {
  return detectOptionCue(value) ?? "none";
}

function parseChoiceRequiredCount(value) {
  const text = normalizeWhitespace(value).toLowerCase();
  const numericMatch = text.match(/\b(?:choose|select)\s+(\d+)\b/);
  if (numericMatch) {
    const count = Number.parseInt(numericMatch[1], 10);
    return Number.isFinite(count) && count > 0 ? count : 1;
  }

  const wordMatch = text.match(
    /\b(?:choose|select)\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b|\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+of(?:\s+the\s+following)?\b|\b(?:minimum|at\s+least)\s+(?:of\s+)?(one|two|three|four|five|six|seven|eight|nine|ten)\s+courses?\s+from\b/
  );
  const word = wordMatch?.[1] ?? wordMatch?.[2] ?? wordMatch?.[3] ?? null;
  if (word) {
    return WORD_NUMBER_MAP.get(word) ?? 1;
  }

  const minimumCourseCountMatch = text.match(/\b(?:minimum|at\s+least)\s+(?:of\s+)?(\d+)\s+courses?\s+from\b/);
  if (minimumCourseCountMatch) {
    const count = Number.parseInt(minimumCourseCountMatch[1], 10);
    return Number.isFinite(count) && count > 0 ? count : 1;
  }

  return 1;
}

module.exports = {
  CHOICE_COUNT_WORDS_PATTERN,
  CHOICE_LIST_START_PATTERN,
  CHOICE_REQUIREMENT_CONTEXT_PATTERN,
  CHOICE_REQUIREMENT_LABEL_PATTERN,
  NON_CHOICE_COURSE_LIST_CONTEXT_PATTERN,
  PROGRAMMING_CHOICE_CONTEXT_PATTERN,
  SEQUENCE_ALTERNATIVE_CHOICE_LINE_PATTERN,
  SEQUENCE_CHOICE_CONTEXT_PATTERN,
  SEQUENCE_HEADING_BOUNDARY_PATTERN,
  SEQUENCE_LABEL_ALTERNATIVE_PATTERN,
  STRONG_CHOICE_REQUIREMENT_CONTEXT_PATTERN,
  createParserShapeDetection,
  detectOptionCue,
  detectOptionCueOrNone,
  parseChoiceRequiredCount,
  stripLeadingRequirementGlyphs,
  stripSnapshotPagePrefix,
};
