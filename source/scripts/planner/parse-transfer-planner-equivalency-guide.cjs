const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

let TRANSFER_PLANNER_GENERATED_COURSE_METADATA = [];
try {
  ({ TRANSFER_PLANNER_GENERATED_COURSE_METADATA } = require("../../constants/transfer-planner-source/course-metadata.generated"));
} catch {
  TRANSFER_PLANNER_GENERATED_COURSE_METADATA = [];
}

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const SNAPSHOT_DIR = path.resolve(TMP_DIR, "transfer-planner-equivalency-guide-snapshots");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-equivalency-guide-parse.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-equivalency-guide-parse.md");
const OUTPUT_TS_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "equivalency-guide.generated.ts"
);
const GUIDE_URL = "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/";
const GUIDE_SOURCE_LINK = {
  label: "UW Green River transfer equivalency guide",
  url: GUIDE_URL,
  note: "Equivalency row parsed from the official UW Office of Admissions Green River transfer equivalency guide.",
};
const DERIVED_RULE_SOURCE_KIND = "uw-green-river-equivalency-guide-derived";
const DERIVED_RULE_SOURCE_LINK = {
  label: "UW Green River derived equivalency synthesis",
  url: GUIDE_URL,
  note: "Structured transfer-planner rule derived from parsed official UW Green River equivalency-guide rows.",
};
const TARGET_CAMPUSES = ["uw-seattle"];
const ENTITY_MAP = {
  amp: "&",
  apos: "'",
  nbsp: " ",
  quot: '"',
  "#038": "&",
  "#39": "'",
  "#160": " ",
  "#8211": "-",
  "#8212": "-",
  "#8217": "'",
};
const CHUNK_SIZE = 80;
const LEGACY_GRC_CODE_ALIASES = new Map([
  ["MATH& 254", "MATH& 264"],
]);

function applyGrcLegacyCourseCodeAlias(value) {
  return LEGACY_GRC_CODE_ALIASES.get(value) ?? value;
}

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function canonicalizeLegacyCodesInText(value) {
  let normalized = normalizeWhitespace(value);
  for (const [legacyCode, canonicalCode] of LEGACY_GRC_CODE_ALIASES.entries()) {
    const legacyPattern = escapeRegExp(legacyCode).replace(/\\ /g, "\\s+");
    normalized = normalized.replace(new RegExp(`\\b${legacyPattern}\\b`, "gi"), canonicalCode);
  }
  return normalized;
}

function normalizeMetadataCourseCode(code) {
  return applyGrcLegacyCourseCodeAlias(
    normalizeWhitespace(code).toUpperCase().replace(/\s+/g, " ")
  );
}

const GRC_COURSE_TITLE_BY_CODE = new Map(
  TRANSFER_PLANNER_GENERATED_COURSE_METADATA
    .filter((entry) => entry && entry.schoolId === "grc")
    .map((entry) => [normalizeMetadataCourseCode(entry.code), normalizeWhitespace(entry.title)])
    .filter((entry) => entry[0] && entry[1])
);

function decodeHtmlEntities(value) {
  return String(value ?? "").replace(
    /&(?:amp|apos|nbsp|quot|#038|#39|#160|#8211|#8212|#8217);/gi,
    (match) => {
      const key = match.slice(1, -1).toLowerCase();
      return ENTITY_MAP[key] ?? match;
    }
  );
}

function normalizeWhitespace(value) {
  return decodeHtmlEntities(value)
    .replace(/Â§/g, "§")
    .replace(/Â /g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value) {
  return normalizeWhitespace(String(value ?? "").replace(/<[^>]+>/g, " "));
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function slugify(value) {
  const slug = normalizeWhitespace(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

function normalizeCourseSubject(value) {
  return normalizeWhitespace(value)
    .toUpperCase()
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ");
}

function normalizeCourseCodeFromParts(subject, number) {
  return applyGrcLegacyCourseCodeAlias(
    `${normalizeCourseSubject(subject)} ${normalizeWhitespace(number).toUpperCase()}`
  );
}

function parseCourseCodesWithSubjectCarry(value) {
  const normalized = normalizeWhitespace(value)
    .replace(/^[§*]\s*/g, "")
    .replace(/\([^)]*\)/g, " ");
  const parts = normalized.split(",");
  const codes = [];
  let currentSubject = null;

  for (const rawPart of parts) {
    const part = normalizeWhitespace(rawPart.replace(/^[§*]\s*/g, ""));
    if (!part) {
      continue;
    }

    const fullMatch = part.match(/^([A-Z][A-Z& -]{0,14}&?)\s+(\d{3}(?:\.\d+)?[A-Z]?|[1-4]XX)\b/i);
    if (fullMatch) {
      currentSubject = normalizeCourseSubject(fullMatch[1]);
      codes.push(normalizeCourseCodeFromParts(currentSubject, fullMatch[2]));
      continue;
    }

    const carriedMatch = part.match(/^(\d{3}(?:\.\d+)?[A-Z]?|[1-4]XX)\b/i);
    if (currentSubject && carriedMatch) {
      codes.push(normalizeCourseCodeFromParts(currentSubject, carriedMatch[1]));
    }
  }

  return [...new Set(codes)];
}

function leadingSourceCoursePhrase(value) {
  let text = normalizeWhitespace(value)
    .replace(/^[§*]\s*/g, "")
    .replace(/\s+/g, " ");
  const noteIndex = text.search(/\s+(?:formerly|see(?:\s+also)?|same as|was\b|combined entr(?:y|ies))\b/i);
  if (noteIndex >= 0) {
    text = text.slice(0, noteIndex);
  }
  return text.trim();
}

function parseSourceCourseSet(value) {
  return parseCourseCodesWithSubjectCarry(leadingSourceCoursePhrase(value));
}

function parseTargetCourseCodes(value) {
  const primaryOutcome = normalizeWhitespace(value)
    .split(/\bif\b|\botherwise\b|;/i)[0]
    .replace(/\bor\b/gi, ",");
  return parseCourseCodesWithSubjectCarry(primaryOutcome);
}

function isParsedCourseNumberToken(value) {
  return /^(?:\d{3}(?:\.\d+)?[A-Z]?|[1-4]XX)$/i.test(String(value ?? "").trim());
}

function isParsedCourseSubjectToken(value) {
  return /^[A-Z][A-Z&-]{0,14}&?$/i.test(String(value ?? "").trim());
}

function extractCourseCodesFromFreeformText(value) {
  const normalized = normalizeWhitespace(value)
    .replace(/^[Â§*]\s*/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[;/]/g, " , ")
    .replace(/\bor\b/gi, " , ")
    .replace(/\band\b/gi, " , ");
  const tokens = normalized.match(/[A-Z&-]+|[1-4]XX|\d{3}(?:\.\d+)?[A-Z]?|,/gi) ?? [];
  const codes = [];
  let currentSubject = null;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = normalizeWhitespace(tokens[index]).toUpperCase();
    const nextToken = normalizeWhitespace(tokens[index + 1] ?? "").toUpperCase();
    if (!token || token === ",") {
      continue;
    }

    if (isParsedCourseSubjectToken(token) && nextToken && isParsedCourseNumberToken(nextToken)) {
      currentSubject = normalizeCourseSubject(token);
      codes.push(normalizeCourseCodeFromParts(currentSubject, nextToken));
      index += 1;
      continue;
    }

    if (currentSubject && isParsedCourseNumberToken(token)) {
      codes.push(normalizeCourseCodeFromParts(currentSubject, token));
    }
  }

  return [...new Set(codes)];
}

function uniqueCourseCodes(values) {
  return [...new Set(values.map((value) => normalizeMetadataCourseCode(value)).filter(Boolean))].sort();
}

function stringifyCourseSet(courseSet) {
  return JSON.stringify(uniqueCourseCodes(courseSet));
}

function getGuideTermSortKey(label) {
  const match = normalizeWhitespace(label).toUpperCase().match(/\b(WIN|SPR|SUM|AUT)\s+QTR\.\s+(\d{4})\b/);
  if (!match) {
    return null;
  }

  const termOrder = {
    WIN: 1,
    SPR: 2,
    SUM: 3,
    AUT: 4,
  }[match[1]];
  if (!termOrder) {
    return null;
  }

  return Number.parseInt(match[2], 10) * 10 + termOrder;
}

function compareGuideTermLabels(left, right) {
  const leftKey = getGuideTermSortKey(left);
  const rightKey = getGuideTermSortKey(right);

  if (leftKey !== null && rightKey !== null && leftKey !== rightKey) {
    return leftKey - rightKey;
  }

  if (leftKey !== null && rightKey === null) {
    return -1;
  }

  if (leftKey === null && rightKey !== null) {
    return 1;
  }

  return String(left ?? "").localeCompare(String(right ?? ""));
}

function uniqueSourceLinks(links) {
  const deduped = new Map();
  for (const link of links ?? []) {
    if (!link?.url) {
      continue;
    }
    deduped.set(link.url, link);
  }
  return [...deduped.values()].sort(
    (left, right) => left.label.localeCompare(right.label) || left.url.localeCompare(right.url)
  );
}

function uniquePlannerText(values) {
  return [...new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean))];
}

function buildDerivedRuleSourceCourseLabel(sourceCourseSets) {
  return sourceCourseSets.map((courseSet) => uniqueCourseCodes(courseSet).join(" + ")).join(" | ");
}

function getRuleSourceCourseCodes(rule) {
  return uniqueCourseCodes((rule.sourceCourseSets ?? []).flat());
}

function buildDerivedRuleSourceCourseTitle(supportRules) {
  const titles = uniquePlannerText(supportRules.map((rule) => rule.sourceCourseTitle));
  return titles.length ? titles.join(" / ") : null;
}

function buildDerivedRuleGuideDepartment(supportRules) {
  const departments = uniquePlannerText(supportRules.map((rule) => rule.guideDepartment));
  return departments[0] ?? null;
}

function mergeTargetCourseCodesFromSupportRules(supportRules) {
  return uniqueCourseCodes(
    supportRules.flatMap((rule) => [
      ...(rule.targetCourseCodes ?? []),
      ...extractCourseCodesFromFreeformText(rule.targetOutcome),
    ])
  );
}

function mergeTargetRequirementTagsFromSupportRules(supportRules) {
  return uniquePlannerText(
    supportRules.flatMap((rule) => rule.targetRequirementTags ?? [])
  ).sort();
}

function buildSupportRuleNote(rule) {
  return `Derived from official guide rule ${rule.id}: ${normalizeWhitespace(
    rule.sourceCourseLabel ?? rule.title
  )}.`;
}

function buildDerivedSupportRuleIds(supportRules) {
  return uniquePlannerText(supportRules.map((rule) => rule.id)).sort();
}

function buildDerivedContinuousEffectiveRange(supportRules) {
  const labels = supportRules
    .flatMap((rule) => rule.effectiveYearRanges ?? [])
    .filter((range) => !/^legacy-planner-support$/i.test(String(range.startLabel ?? "")));
  if (!labels.length) {
    return [];
  }

  const startCandidates = labels.map((range) => range.startLabel).filter(Boolean);
  const endCandidates = labels.map((range) => range.endLabel).filter(Boolean);
  const latestStartLabel = [...startCandidates].sort(compareGuideTermLabels).pop() ?? null;
  const earliestEndLabel = endCandidates.length
    ? [...endCandidates].sort(compareGuideTermLabels)[0] ?? null
    : null;
  if (!latestStartLabel) {
    return [];
  }

  return [
    {
      startLabel: latestStartLabel,
      endLabel: earliestEndLabel,
      note: "Derived from the overlapping effective dates of the supporting official UW equivalency-guide rows.",
    },
  ];
}

function buildDerivedEffectiveDateLabel(effectiveYearRanges) {
  const [range] = effectiveYearRanges ?? [];
  if (!range) {
    return null;
  }
  if (!range.endLabel) {
    return range.startLabel;
  }
  return `${range.startLabel} thru ${range.endLabel}`;
}

function createRuleLookup(rules) {
  const byExactSourceSet = new Map();
  const bySourceCode = new Map();

  for (const rule of rules) {
    for (const sourceCourseSet of rule.sourceCourseSets ?? []) {
      const key = stringifyCourseSet(sourceCourseSet);
      const exactMatches = byExactSourceSet.get(key) ?? [];
      exactMatches.push(rule);
      byExactSourceSet.set(key, exactMatches);

      for (const courseCode of sourceCourseSet) {
        const normalizedCourseCode = normalizeMetadataCourseCode(courseCode);
        const codeMatches = bySourceCode.get(normalizedCourseCode) ?? [];
        codeMatches.push(rule);
        bySourceCode.set(normalizedCourseCode, codeMatches);
      }
    }
  }

  return {
    byExactSourceSet,
    bySourceCode,
  };
}

function getRuleStatusPriority(rule) {
  switch (rule.ruleStatus) {
    case "active":
      return 0;
    case "legacy":
      return 1;
    case "deprecated":
      return 2;
    default:
      return 1;
  }
}

function getRuleAcceptancePriority(rule) {
  switch (rule.acceptanceCategory) {
    case "preferred":
      return 0;
    case "accepted":
      return 1;
    case "accepted-with-warning":
      return 2;
    case "legacy-accepted":
      return 3;
    case "no-credit":
      return 4;
    default:
      return 3;
  }
}

function compareSupportRules(left, right) {
  const statusDelta = getRuleStatusPriority(left) - getRuleStatusPriority(right);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  const acceptanceDelta = getRuleAcceptancePriority(left) - getRuleAcceptancePriority(right);
  if (acceptanceDelta !== 0) {
    return acceptanceDelta;
  }

  return left.id.localeCompare(right.id);
}

function findBestExactSourceSetRule(ruleLookup, sourceCourseSet, options = {}) {
  const matches = [...(ruleLookup.byExactSourceSet.get(stringifyCourseSet(sourceCourseSet)) ?? [])]
    .filter((rule) => (options.ruleStatus ? rule.ruleStatus === options.ruleStatus : true))
    .filter((rule) =>
      options.targetIncludes
        ? mergeTargetCourseCodesFromSupportRules([rule]).includes(normalizeMetadataCourseCode(options.targetIncludes))
        : true
    )
    .sort(compareSupportRules);
  return matches[0] ?? null;
}

function findBestSingleCourseRule(ruleLookup, sourceCourseCode, options = {}) {
  const normalizedSourceCode = normalizeMetadataCourseCode(sourceCourseCode);
  const matches = [...(ruleLookup.bySourceCode.get(normalizedSourceCode) ?? [])]
    .filter((rule) => (rule.sourceCourseSets?.[0]?.length ?? 0) === 1)
    .filter((rule) => getRuleSourceCourseCodes(rule).includes(normalizedSourceCode))
    .filter((rule) => (options.ruleStatus ? rule.ruleStatus === options.ruleStatus : true))
    .filter((rule) =>
      options.targetIncludes
        ? mergeTargetCourseCodesFromSupportRules([rule]).includes(normalizeMetadataCourseCode(options.targetIncludes))
        : true
    )
    .sort(compareSupportRules);
  return matches[0] ?? null;
}

function parseRequirementTags(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return [];
  }

  const tags = new Set();
  const cleaned = normalized
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\(\s*\d+(?:\.\d+)?\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return [];
  }

  if (/\bA\s*&\s*H\b/i.test(cleaned)) tags.add("A&H");
  if (/\bS\s*Sc\b/i.test(cleaned)) tags.add("SSc");
  if (/\bN\s*Sc\b/i.test(cleaned)) tags.add("NSc");
  if (/\bQSR\b/i.test(cleaned)) tags.add("QSR");
  if (/\bVLPA\b/i.test(cleaned)) tags.add("VLPA");
  if (/\bI\s*&\s*S\b/i.test(cleaned)) tags.add("I&S");
  if (/\bDIV\b/i.test(cleaned)) tags.add("DIV");
  if (/\bNW\b/i.test(cleaned)) tags.add("NW");

  return [...tags];
}

function parseEffectiveYearRanges(effectiveDateLabel) {
  const label = normalizeWhitespace(effectiveDateLabel);
  if (!label) {
    return [];
  }

  const thruMatch = label.match(/^(.+?)\s+thru\s+(.+)$/i);
  if (thruMatch) {
    return [
      {
        startLabel: normalizeWhitespace(thruMatch[1]),
        endLabel: normalizeWhitespace(thruMatch[2]),
        note: "Effective-date range parsed from the official UW Green River equivalency guide.",
      },
    ];
  }

  const priorMatch = label.match(/^Prior to\s+(.+)$/i);
  if (priorMatch) {
    return [
      {
        startLabel: "prior-to-guide-cutoff",
        endLabel: normalizeWhitespace(priorMatch[1]),
        note: "Legacy effective-date cutoff parsed from the official UW Green River equivalency guide.",
      },
    ];
  }

  return [
    {
      startLabel: label,
      endLabel: null,
      note: "Effective-date start parsed from the official UW Green River equivalency guide.",
    },
  ];
}

function hasLimitedCreditSignal(row) {
  return /\(\s*LC\s*\)|\bLC\b|\[\s*\d+\s+credits?\s+allowed\s*\]/i.test(
    `${row.cccourse} ${row.uwequiv} ${row.uwreqs}`
  );
}

function hasSequenceSignal(row, sourceCourseSet) {
  return (
    sourceCourseSet.length > 1 ||
    /\bif\s+(?:all|both)\b/i.test(row.uwequiv) ||
    /\bcombined entr(?:y|ies)\b/i.test(row.cccourse) ||
    /\botherwise\b/i.test(row.uwequiv)
  );
}

function hasOnlyElectiveTargets(targetCourseCodes, targetOutcome) {
  if (/^No credit/i.test(targetOutcome)) {
    return false;
  }
  if (targetCourseCodes.length === 0) {
    return /\b(?:UW|[A-Z][A-Z &-]{0,14})\s+[1-4]XX\b/i.test(targetOutcome);
  }
  return targetCourseCodes.every((code) => /\b[1-4]XX$/.test(code));
}

function classifyRule(row, sourceCourseSet, targetCourseCodes) {
  if (/^No credit/i.test(row.uwequiv)) {
    return "no-credit";
  }
  if (hasLimitedCreditSignal(row)) {
    return "limited-credit";
  }
  if (hasSequenceSignal(row, sourceCourseSet)) {
    return "sequence";
  }
  if (hasOnlyElectiveTargets(targetCourseCodes, row.uwequiv)) {
    return "elective-credit";
  }
  return "direct-course";
}

function buildAcceptanceCategory(type, row) {
  if (type === "no-credit") {
    return "no-credit";
  }
  if (row.obsolete) {
    return "legacy-accepted";
  }
  if (
    type === "limited-credit" ||
    type === "sequence" ||
    /\b(?:otherwise|if course content|see individual|see .*combined entr(?:y|ies))\b/i.test(
      `${row.cccourse} ${row.uwequiv}`
    )
  ) {
    return "accepted-with-warning";
  }
  return "accepted";
}

function buildRuleStatus(row) {
  if (row.obsolete || /\b(?:Prior to|thru)\b/i.test(row.effdate)) {
    return "legacy";
  }
  return "active";
}

function buildWarnings(type, row, sourceCourseSet) {
  const warnings = [];

  if (row.obsolete) {
    warnings.push("The official guide marks this Green River course row as no longer offered.");
  }
  if (type === "sequence") {
    warnings.push(
      sourceCourseSet.length > 1
        ? "The official guide describes this as a sequence or combined-course equivalency; do not award the strongest target outcome from a partial sequence."
        : "The official guide references a combined-entry or conditional equivalency; preserve the row text until the sequence resolver can evaluate the full student history."
    );
  }
  if (type === "limited-credit") {
    warnings.push("The official guide flags this row as limited credit; apply the published cap/discipline note before using it in planning.");
  }
  if (type === "no-credit") {
    warnings.push("The official guide explicitly assigns no UW transfer credit for this row.");
  }
  if (/\botherwise\b/i.test(row.uwequiv)) {
    warnings.push(`Official fallback text: ${row.uwequiv}`);
  }

  return warnings;
}

function buildNotes(row, targetCourseCodes) {
  const notes = [
    `UW guide department: ${row.department}.`,
    `Official Green River row: ${row.cccourse}.`,
    `Official UW equivalency row: ${row.uwequiv || "(blank; see row wording)"}.`,
  ];
  if (row.uwreqs) {
    notes.push(`Official UW requirement tags: ${row.uwreqs}.`);
  }
  if (row.effdate) {
    notes.push(`Official effective date: ${row.effdate}.`);
  }
  if (targetCourseCodes.length > 0) {
    notes.push(`Parsed primary UW target course codes: ${targetCourseCodes.join(", ")}.`);
  }
  return notes;
}

function parseGuideRows(html) {
  const rows = [];
  const headings = [...html.matchAll(/<h3(?:\s+[^>]*)?>([\s\S]*?)<\/h3>/gi)].map((match) => ({
    index: match.index,
    end: match.index + match[0].length,
    department: stripHtml(match[1]),
  }));

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const sectionHtml = html.slice(heading.end, index + 1 < headings.length ? headings[index + 1].index : html.length);
    const tableMatch = sectionHtml.match(
      /<table\b[^>]*class="[^"]*table[^"]*"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>\s*<\/table>/i
    );
    if (!tableMatch) {
      continue;
    }

    for (const rowMatch of tableMatch[1].matchAll(/<tr(?:\s+([^>]*))?>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...rowMatch[2].matchAll(/<td\b[^>]*class="(cccourse|uwequiv|uwreqs|effdate)"[^>]*>([\s\S]*?)<\/td>/gi)];
      if (cells.length < 4) {
        continue;
      }

      const row = {
        department: heading.department,
        obsolete: /obsRow/.test(rowMatch[1] ?? ""),
        rowNumber: rows.length + 1,
      };
      for (const cell of cells) {
        row[cell[1]] = stripHtml(cell[2]);
      }
      rows.push(row);
    }
  }

  return rows;
}

function buildRule(row) {
  const canonicalRow = {
    ...row,
    cccourse: canonicalizeLegacyCodesInText(row.cccourse),
    uwequiv: canonicalizeLegacyCodesInText(row.uwequiv),
    uwreqs: canonicalizeLegacyCodesInText(row.uwreqs),
    effdate: canonicalizeLegacyCodesInText(row.effdate),
  };
  const sourceCourseSet = parseSourceCourseSet(canonicalRow.cccourse);
  const targetCourseCodes = parseTargetCourseCodes(canonicalRow.uwequiv);
  const type = classifyRule(canonicalRow, sourceCourseSet, targetCourseCodes);
  const effectiveDateLabel = canonicalRow.effdate || null;
  const sourceCourseTitles = [...new Set(
    sourceCourseSet
      .map((courseCode) => GRC_COURSE_TITLE_BY_CODE.get(normalizeMetadataCourseCode(courseCode)) ?? null)
      .filter(Boolean)
  )];
  const sourceCourseTitle = sourceCourseTitles.length ? sourceCourseTitles.join(" / ") : null;

  return {
    id: `uw-grc-guide:${String(canonicalRow.rowNumber).padStart(4, "0")}:${slugify(canonicalRow.department)}:${slugify(canonicalRow.cccourse)}`,
    type,
    title: `${canonicalRow.cccourse} -> ${canonicalRow.uwequiv || "see combined-entry row"}`,
    acceptanceCategory: buildAcceptanceCategory(type, canonicalRow),
    ruleStatus: buildRuleStatus(canonicalRow),
    sourceKind: "uw-green-river-equivalency-guide",
    sourceSchoolId: "grc",
    targetSchoolIds: TARGET_CAMPUSES,
    sourceCourseSets: sourceCourseSet.length > 0 ? [sourceCourseSet] : [],
    targetCourseCodes,
    targetOutcome:
      canonicalRow.uwequiv || "See the official combined-entry wording on the Green River equivalency guide.",
    weakerThanRuleIds: [],
    effectiveYearRanges: parseEffectiveYearRanges(effectiveDateLabel),
    effectiveDateLabel,
    guideDepartment: canonicalRow.department,
    sourceCourseLabel: canonicalRow.cccourse,
    sourceCourseTitle,
    targetRequirementTags: parseRequirementTags(canonicalRow.uwreqs),
    isObsoleteSourceCourse: canonicalRow.obsolete,
    parsedFromOfficialGuide: true,
    plannerWarnings: buildWarnings(type, canonicalRow, sourceCourseSet),
    notes: buildNotes(canonicalRow, targetCourseCodes),
    sourceLinks: [GUIDE_SOURCE_LINK],
  };
}

const STRUCTURED_EQUIVALENCY_DERIVATION_SPECS = [
  {
    id: "stem-calculus-current-sequence",
    type: "sequence",
    title: "Current Green River STEM calculus sequence",
    sourceCourseSets: [["MATH& 151", "MATH& 152", "MATH& 163"]],
    acceptanceCategory: "preferred",
    targetOutcome: "UW MATH 124, 125, and 126 transfer path.",
    notes: [
      "This is the current primary calculus path used throughout the planner for STEM transfer planning.",
    ],
    supportRules: (lookup) => [
      findBestSingleCourseRule(lookup, "MATH& 151", { targetIncludes: "MATH 124" }),
      findBestSingleCourseRule(lookup, "MATH& 152", { targetIncludes: "MATH 125" }),
      findBestSingleCourseRule(lookup, "MATH& 163", { targetIncludes: "MATH 126" }),
    ],
  },
  {
    id: "stem-calculus-older-sequence",
    type: "alternate-path",
    title: "Older Green River STEM calculus alternative",
    sourceCourseSets: [["MATH& 151", "MATH& 152", "MATH& 153", "MATH& 264"]],
    acceptanceCategory: "legacy-accepted",
    ruleStatus: "legacy",
    weakerThanRuleIds: ["stem-calculus-current-sequence"],
    effectiveYearRanges: [
      {
        startLabel: "legacy-planner-support",
        endLabel: null,
        note: "Retained because current UW equivalency and planner materials still preserve the older calculus route as a valid alternate path.",
      },
    ],
    targetOutcome:
      "UW MATH 124, 125, 126, plus stronger 224 / 2XX treatment when the full older path is completed.",
    plannerWarnings: [
      "Prefer the current MATH& 151 -> MATH& 152 -> MATH& 163 path for new planning unless the student is already on the older MATH& 153 + MATH& 264 route.",
    ],
    notes: [
      "The planner keeps this older path because UW still describes it in some equivalency and legacy advising materials.",
    ],
    supportRules: (lookup) => [
      findBestSingleCourseRule(lookup, "MATH& 151", { targetIncludes: "MATH 124" }),
      findBestSingleCourseRule(lookup, "MATH& 152", { targetIncludes: "MATH 125" }),
      findBestExactSourceSetRule(lookup, ["MATH& 153", "MATH& 264"], { ruleStatus: "legacy" }),
    ],
  },
  {
    id: "general-chemistry-full-sequence",
    type: "full-credit-combo",
    title: "Full general chemistry sequence",
    sourceCourseSets: [["CHEM& 161", "CHEM& 162", "CHEM& 163"]],
    acceptanceCategory: "preferred",
    targetOutcome: "Full strongest general-chemistry transfer outcome used across many STEM majors.",
    notes: [
      "CHEM& 162 plus CHEM& 163 together produce a stronger UW chemistry outcome than isolated single-course treatment.",
    ],
    supportRules: (lookup) => [
      findBestSingleCourseRule(lookup, "CHEM& 161", { targetIncludes: "CHEM 142" }),
      findBestExactSourceSetRule(lookup, ["CHEM& 162", "CHEM& 163"], { ruleStatus: "active" }),
    ],
  },
  {
    id: "organic-chemistry-full-sequence",
    type: "full-credit-combo",
    title: "Full organic chemistry sequence",
    sourceCourseSets: [["CHEM& 261", "CHEM& 262", "CHEM& 263"]],
    acceptanceCategory: "preferred",
    targetOutcome:
      "Full UW CHEM 237, 238, 239, 241, and 242 package when the full sequence is completed.",
    notes: [
      "The planner keeps the stronger full-sequence rule because partial completion does not preserve the same outcome.",
    ],
    supportRules: (lookup) => [
      findBestExactSourceSetRule(lookup, ["CHEM& 261", "CHEM& 262", "CHEM& 263"], {
        ruleStatus: "active",
      }),
    ],
  },
  {
    id: "biology-majors-full-sequence",
    type: "full-credit-combo",
    title: "Biology majors full sequence",
    sourceCourseSets: [["BIOL& 211", "BIOL& 212", "BIOL& 213"]],
    acceptanceCategory: "preferred",
    targetOutcome: "Full UW BIOL 180, 200, 220, and 2XX package.",
    notes: ["All three courses are required for the strongest biology-major equivalency."],
    supportRules: (lookup) => [
      findBestExactSourceSetRule(lookup, ["BIOL& 211", "BIOL& 212", "BIOL& 213"], {
        ruleStatus: "active",
      }),
    ],
  },
  {
    id: "anatomy-physiology-full-sequence",
    type: "full-credit-combo",
    title: "Anatomy and physiology sequence",
    sourceCourseSets: [["BIOL& 241", "BIOL& 242"]],
    acceptanceCategory: "preferred",
    targetOutcome: "UW BIOL 118, BIOL 119, and NURS 301 equivalency pattern used in health pathways.",
    notes: ["Both courses are needed for the strongest combined outcome."],
    supportRules: (lookup) => [
      findBestExactSourceSetRule(lookup, ["BIOL& 241", "BIOL& 242"], { ruleStatus: "active" }),
    ],
  },
  {
    id: "computer-science-new-sequence",
    type: "sequence",
    title: "Current Green River CS sequence",
    sourceCourseSets: [["CS 121", "CS 122", "CS 123"]],
    acceptanceCategory: "preferred",
    targetOutcome: "Primary Green River intro programming sequence used for planning current CS pathways.",
    notes: [
      "The planner treats this as an ordered sequence rather than three unrelated standalone courses.",
    ],
    supportRules: (lookup) => [
      findBestSingleCourseRule(lookup, "CS 121", { targetIncludes: "CSE 121" }),
      findBestSingleCourseRule(lookup, "CS 122", { targetIncludes: "CSE 122" }),
      findBestSingleCourseRule(lookup, "CS 123", { targetIncludes: "CSE 123" }),
    ],
  },
  {
    id: "calculus-physics-sequence",
    type: "sequence",
    title: "Calculus-based physics sequence",
    sourceCourseSets: [["PHYS& 221", "PHYS& 222", "PHYS& 223"]],
    acceptanceCategory: "preferred",
    targetOutcome: "Primary calculus-based physics transfer sequence.",
    notes: [
      "The planner keeps this sequence grouped because many engineering majors depend on full completion.",
    ],
    supportRules: (lookup) => [
      findBestSingleCourseRule(lookup, "PHYS& 221", { targetIncludes: "PHYS 121" }),
      findBestSingleCourseRule(lookup, "PHYS& 222", { targetIncludes: "PHYS 122" }),
      findBestSingleCourseRule(lookup, "PHYS& 223", { targetIncludes: "PHYS 123" }),
    ],
  },
];

const CHAIN_RULE_DERIVATION_SPECS = [
  {
    id: "chain:MATH-STEM",
    title: "STEM calculus sequence",
    acceptanceCategory: "accepted-with-warning",
    targetOutcome:
      "Broad calculus-sequence reference spanning the current MATH& 151 -> MATH& 152 -> MATH& 163 path and the retained legacy MATH& 153 + MATH& 264 route.",
    plannerWarnings: [
      "Use the explicit structured calculus rules for current-vs-older path decisions. This chain summary is a broad planner reference, not the most precise route selector.",
    ],
    supportRules: (_lookup, structuredRulesById) => [
      structuredRulesById.get("stem-calculus-current-sequence") ?? null,
      structuredRulesById.get("stem-calculus-older-sequence") ?? null,
    ],
  },
  {
    id: "chain:CS-LEGACY",
    title: "Legacy CS sequence",
    acceptanceCategory: "legacy-accepted",
    ruleStatus: "legacy",
    weakerThanRuleIds: ["computer-science-new-sequence"],
    effectiveYearRanges: [
      {
        startLabel: "legacy-planner-support",
        endLabel: null,
        note: "Retained because older UW equivalency materials and student histories still reference the CS& 141 -> CS 145 path.",
      },
    ],
    targetOutcome:
      "Legacy Green River CS route centered on CS& 141 and CS 145 for students who already started on the older path.",
    plannerWarnings: [
      "The planner prefers the current CS 121 -> CS 122 -> CS 123 path for new students. Keep the legacy path only when the student already started on it or the published legacy guidance confirms it is the right fit.",
    ],
    supportRules: (lookup) => [
      findBestSingleCourseRule(lookup, "CS& 141", { targetIncludes: "CSE 142" }),
      findBestSingleCourseRule(lookup, "CS 145", { targetIncludes: "CSE 143" }),
    ],
  },
  {
    id: "chain:CHEM-GEN",
    title: "General chemistry sequence",
    acceptanceCategory: "accepted-with-warning",
    targetOutcome: "General chemistry sequence with a stronger combined outcome when the full path is completed.",
    plannerWarnings: [
      "Partial completion yields weaker CHEM 1XX treatment than the stronger full-sequence outcome used by many STEM pathways.",
    ],
    supportRules: (_lookup, structuredRulesById) => [
      structuredRulesById.get("general-chemistry-full-sequence") ?? null,
    ],
  },
  {
    id: "chain:CHEM-ORG",
    title: "Organic chemistry sequence",
    acceptanceCategory: "accepted-with-warning",
    targetOutcome: "Organic chemistry sequence with the strongest UW outcome reserved for the full three-course path.",
    plannerWarnings: [
      "The strongest UW organic chemistry outcome depends on the full CHEM& 261 + 262 + 263 sequence rather than isolated single-course treatment.",
    ],
    supportRules: (_lookup, structuredRulesById) => [
      structuredRulesById.get("organic-chemistry-full-sequence") ?? null,
    ],
  },
  {
    id: "chain:BIO-MAJORS",
    title: "Biology majors sequence",
    acceptanceCategory: "accepted-with-warning",
    targetOutcome: "Biology majors sequence with the strongest outcome reserved for all three majors-biology courses together.",
    plannerWarnings: [
      "The strongest biology-major transfer outcome depends on completing BIOL& 211 + 212 + 213 as a full sequence.",
    ],
    supportRules: (_lookup, structuredRulesById) => [
      structuredRulesById.get("biology-majors-full-sequence") ?? null,
    ],
  },
  {
    id: "chain:BIO-ANAT",
    title: "Anatomy and physiology sequence",
    acceptanceCategory: "accepted-with-warning",
    targetOutcome:
      "Anatomy and physiology sequence with the strongest combined UW outcome reserved for both courses together.",
    plannerWarnings: [
      "The combined UW anatomy and physiology outcome depends on completing both BIOL& 241 and BIOL& 242.",
    ],
    supportRules: (_lookup, structuredRulesById) => [
      structuredRulesById.get("anatomy-physiology-full-sequence") ?? null,
    ],
  },
  {
    id: "chain:ACCT-COMBO",
    title: "Accounting full-credit combo",
    acceptanceCategory: "accepted-with-warning",
    targetOutcome: "Combined accounting sequence rule for the stronger ACCTG 215 transfer outcome.",
    plannerWarnings: [
      "The stronger UW accounting outcome depends on ACCT& 201 + ACCT& 202 together rather than isolated single-course treatment.",
    ],
    supportRules: (lookup) => [
      findBestExactSourceSetRule(lookup, ["ACCT& 201", "ACCT& 202"], { ruleStatus: "active" }),
    ],
  },
  {
    id: "chain:ASTR-COMBO",
    title: "Astronomy full-credit combo",
    acceptanceCategory: "accepted-with-warning",
    targetOutcome: "Combined astronomy rule where the second course changes the final UW credit mix.",
    plannerWarnings: [
      "The second astronomy course changes the final UW credit outcome, so treat this as a conditional combo instead of two interchangeable standalone classes.",
    ],
    supportRules: (lookup) => [
      findBestExactSourceSetRule(lookup, ["ASTR& 100", "ASTR& 101"], { ruleStatus: "active" }),
    ],
  },
  {
    id: "chain:HIST-US",
    title: "US history full-credit combo",
    acceptanceCategory: "accepted-with-warning",
    targetOutcome: "US history combo rule for the stronger combined HSTAA outcome.",
    plannerWarnings: [
      "The full UW US-history outcome depends on HIST& 136 + HIST& 137 together rather than one course alone.",
    ],
    supportRules: (lookup) => [
      findBestExactSourceSetRule(lookup, ["HIST& 136", "HIST& 137"], { ruleStatus: "active" }),
    ],
  },
  {
    id: "chain:ENGL-250",
    title: "English 250 full-credit combo",
    acceptanceCategory: "accepted-with-warning",
    targetOutcome: "English combo rule for the stronger ENGL 250 outcome.",
    plannerWarnings: [
      "The stronger ENGL 250 outcome depends on ENGL& 244 + ENGL& 245 together.",
    ],
    supportRules: (lookup) => [
      findBestExactSourceSetRule(lookup, ["ENGL& 244", "ENGL& 245"], { ruleStatus: "active" }),
    ],
  },
  {
    id: "chain:COMM-266",
    title: "CMST 266 credit rule",
    acceptanceCategory: "accepted-with-warning",
    targetOutcome: "Conditional CMST 266 credit rule where the full 5-credit version yields CMS 272.",
    plannerWarnings: [
      "CMST 266 only yields CMS 272 when it is taken for 5 credits. Otherwise it remains CMS 2XX credit.",
    ],
    supportRules: (lookup) => [
      findBestExactSourceSetRule(lookup, ["CMST 266"], { ruleStatus: "active" }),
    ],
  },
  {
    id: "chain:NATRS-COMBO",
    title: "Natural resources ESRM combo",
    acceptanceCategory: "accepted-with-warning",
    targetOutcome:
      "Natural resources combo rule where NATRS 180 + NATRS 292 produces a special ESRM-major outcome.",
    plannerWarnings: [
      "NATRS 180 + NATRS 292 has a special combined ESRM-major rule, so do not treat the two courses as interchangeable standalone credits.",
    ],
    supportRules: (lookup) => [
      findBestExactSourceSetRule(lookup, ["NATRS 180", "NATRS 292"], { ruleStatus: "active" }),
    ],
  },
];

function buildDerivedRuleFromSpec(spec, supportRules) {
  const resolvedSupportRules = supportRules.filter(Boolean);
  if (!resolvedSupportRules.length) {
    throw new Error(`Unable to synthesize ${spec.id}: no supporting official guide rules were found.`);
  }

  const effectiveYearRanges =
    spec.effectiveYearRanges ?? buildDerivedContinuousEffectiveRange(resolvedSupportRules);
  const sourceCourseSets = (spec.sourceCourseSets ?? []).map((courseSet) => uniqueCourseCodes(courseSet));
  const sourceCourseLabel =
    spec.sourceCourseLabel ?? buildDerivedRuleSourceCourseLabel(sourceCourseSets);

  return {
    id: spec.id,
    type: spec.type ?? "chain-rule",
    title: spec.title,
    acceptanceCategory: spec.acceptanceCategory,
    ruleStatus: spec.ruleStatus ?? resolvedSupportRules[0]?.ruleStatus ?? "active",
    sourceKind: DERIVED_RULE_SOURCE_KIND,
    sourceSchoolId: "grc",
    targetSchoolIds: TARGET_CAMPUSES,
    sourceCourseSets,
    targetCourseCodes:
      spec.targetCourseCodes ?? mergeTargetCourseCodesFromSupportRules(resolvedSupportRules),
    targetOutcome: spec.targetOutcome,
    weakerThanRuleIds: spec.weakerThanRuleIds ?? [],
    effectiveYearRanges,
    effectiveDateLabel:
      spec.effectiveDateLabel === undefined
        ? buildDerivedEffectiveDateLabel(effectiveYearRanges)
        : spec.effectiveDateLabel,
    guideDepartment: spec.guideDepartment ?? buildDerivedRuleGuideDepartment(resolvedSupportRules),
    sourceCourseLabel,
    sourceCourseTitle: spec.sourceCourseTitle ?? buildDerivedRuleSourceCourseTitle(resolvedSupportRules),
    targetRequirementTags:
      spec.targetRequirementTags ?? mergeTargetRequirementTagsFromSupportRules(resolvedSupportRules),
    isObsoleteSourceCourse: resolvedSupportRules.every((rule) => rule.isObsoleteSourceCourse === true),
    parsedFromOfficialGuide: false,
    plannerWarnings: uniquePlannerText(spec.plannerWarnings ?? []),
    notes: uniquePlannerText([
      `Synthesized from parsed official UW Green River equivalency-guide rows for ${spec.title}.`,
      ...buildDerivedSupportRuleIds(resolvedSupportRules).map(
        (ruleId) => `Supporting official guide rule: ${ruleId}.`
      ),
      ...resolvedSupportRules.map(buildSupportRuleNote),
      ...(spec.notes ?? []),
    ]),
    sourceLinks: uniqueSourceLinks([
      DERIVED_RULE_SOURCE_LINK,
      ...resolvedSupportRules.flatMap((rule) => rule.sourceLinks ?? []),
    ]),
  };
}

function buildDerivedStructuredEquivalencyRules(officialRules) {
  const lookup = createRuleLookup(officialRules);
  return STRUCTURED_EQUIVALENCY_DERIVATION_SPECS.map((spec) =>
    buildDerivedRuleFromSpec(spec, spec.supportRules(lookup))
  ).sort((left, right) => left.id.localeCompare(right.id));
}

function buildDerivedChainRules(officialRules, structuredRules) {
  const lookup = createRuleLookup(officialRules);
  const structuredRulesById = new Map(structuredRules.map((rule) => [rule.id, rule]));
  return CHAIN_RULE_DERIVATION_SPECS.map((spec) =>
    buildDerivedRuleFromSpec(spec, spec.supportRules(lookup, structuredRulesById))
  ).sort((left, right) => left.id.localeCompare(right.id));
}

function buildCounts(values, keyFn) {
  return values.reduce((counts, value) => {
    const key = keyFn(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function writeRuleChunks(lines, prefix, rules) {
  const chunks = [];
  for (let index = 0; index < rules.length; index += CHUNK_SIZE) {
    chunks.push(rules.slice(index, index + CHUNK_SIZE));
  }

  chunks.forEach((chunk, index) => {
    lines.push(
      `const ${prefix}_CHUNK_${index}: unknown[] = ${JSON.stringify(chunk, null, 2)};`,
      ""
    );
  });

  const chunkNames = chunks.map((_, index) => `  ${prefix}_CHUNK_${index}`);
  lines.push(
    `const ${prefix}S_RAW: unknown[] = ([] as unknown[]).concat(`,
    `${chunkNames.join(",\n")}`,
    ");",
    ""
  );
}

function writeGeneratedRules(scope) {
  const lines = [
    "/* eslint-disable */",
    "/* auto-generated by scripts/planner/parse-transfer-planner-equivalency-guide.cjs */",
    "",
    'import type { TransferPlannerEquivalencyRule } from "./schema";',
    "",
  ];

  writeRuleChunks(lines, "TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULE", scope.officialRules);
  lines.push(
    "export const TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES =",
    "  TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES_RAW as TransferPlannerEquivalencyRule[];",
    ""
  );

  writeRuleChunks(
    lines,
    "TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULE",
    scope.derivedRules
  );
  lines.push(
    "export const TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES =",
    "  TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES_RAW as TransferPlannerEquivalencyRule[];",
    "",
    "export const TRANSFER_PLANNER_UW_GRC_ALL_EQUIVALENCY_RULES =",
    "  ([] as TransferPlannerEquivalencyRule[]).concat(",
    "    TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES,",
    "    TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES",
    "  );",
    ""
  );

  fs.mkdirSync(path.dirname(OUTPUT_TS_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_TS_PATH, `${lines.join("\n")}\n`);
}

function writeReports(report) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    "# Transfer Planner Equivalency Guide Parse",
    "",
    `Generated at: ${report.generatedAt}`,
    `Source: ${report.sourceUrl}`,
    `HTTP status: ${report.status}`,
    `Final URL: ${report.finalUrl}`,
    `Snapshot hash: ${report.snapshotSha256}`,
    "",
    "## Counts",
    "",
    `- Departments: ${report.departmentCount}`,
    `- Official guide rows parsed: ${report.rowCount}`,
    `- Generated rules: ${report.ruleCount}`,
    `- Source-course-backed rules: ${report.rulesWithSourceCourseSets}`,
    `- Target-course-backed rules: ${report.rulesWithTargetCourseCodes}`,
    "",
    "## Rule Types",
    "",
    ...Object.entries(report.countsByType)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, count]) => `- ${key}: ${count}`),
    "",
    "## Rule Status",
    "",
    ...Object.entries(report.countsByStatus)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, count]) => `- ${key}: ${count}`),
    "",
    "## Departments",
    "",
    ...Object.entries(report.countsByDepartment)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, count]) => `- ${key}: ${count}`),
    "",
  ];
  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

async function fetchGuideHtml() {
  const response = await fetch(GUIDE_URL, {
    redirect: "follow",
    headers: {
      "user-agent": "GatorGuideTransferPlannerEquivalencyIngest/1.0",
    },
  });
  const html = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to fetch ${GUIDE_URL}: ${response.status} ${response.statusText}`);
  }

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const snapshotPath = path.resolve(SNAPSHOT_DIR, "uw-green-river-equivalency-guide.html");
  fs.writeFileSync(snapshotPath, html);

  return {
    html,
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get("content-type"),
    snapshotPath,
  };
}

async function main() {
  const fetched = await fetchGuideHtml();
  const rows = parseGuideRows(fetched.html);
  const officialRules = rows.map(buildRule).sort((left, right) => left.id.localeCompare(right.id));
  const structuredDerivedRules = buildDerivedStructuredEquivalencyRules(officialRules);
  const chainDerivedRules = buildDerivedChainRules(officialRules, structuredDerivedRules);
  const derivedRules = [...structuredDerivedRules, ...chainDerivedRules].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  const allRules = [...officialRules, ...derivedRules].sort((left, right) => left.id.localeCompare(right.id));
  const report = {
    generatedAt: new Date().toISOString(),
    sourceUrl: GUIDE_URL,
    status: fetched.status,
    finalUrl: fetched.finalUrl,
    contentType: fetched.contentType,
    snapshotPath: path.relative(REPO_ROOT, fetched.snapshotPath).replace(/\\/g, "/"),
    snapshotSha256: sha256Text(fetched.html),
    departmentCount: new Set(rows.map((row) => row.department)).size,
    rowCount: rows.length,
    officialRuleCount: officialRules.length,
    derivedRuleCount: derivedRules.length,
    ruleCount: allRules.length,
    rulesWithSourceCourseSets: allRules.filter((rule) => (rule.sourceCourseSets?.[0]?.length ?? 0) > 0).length,
    rulesWithTargetCourseCodes: allRules.filter((rule) => (rule.targetCourseCodes?.length ?? 0) > 0).length,
    countsByType: buildCounts(allRules, (rule) => rule.type),
    countsByStatus: buildCounts(allRules, (rule) => rule.ruleStatus ?? "unknown"),
    countsByAcceptanceCategory: buildCounts(allRules, (rule) => rule.acceptanceCategory),
    countsByDepartment: buildCounts(officialRules, (rule) => rule.guideDepartment ?? "unknown"),
    countsBySourceKind: buildCounts(allRules, (rule) => rule.sourceKind ?? "unknown"),
    sampleRules: allRules.slice(0, 20),
  };

  writeGeneratedRules({ officialRules, derivedRules });
  writeReports(report);

  console.log(
    JSON.stringify(
      {
        officialRules: report.officialRuleCount,
        derivedRules: report.derivedRuleCount,
        generatedRules: report.ruleCount,
        departments: report.departmentCount,
        directCourseRules: report.countsByType["direct-course"] ?? 0,
        sequenceRules: report.countsByType.sequence ?? 0,
        chainRules: report.countsByType["chain-rule"] ?? 0,
        noCreditRules: report.countsByType["no-credit"] ?? 0,
        limitedCreditRules: report.countsByType["limited-credit"] ?? 0,
        output: path.relative(REPO_ROOT, OUTPUT_TS_PATH).replace(/\\/g, "/"),
        report: path.relative(REPO_ROOT, OUTPUT_JSON_PATH).replace(/\\/g, "/"),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
