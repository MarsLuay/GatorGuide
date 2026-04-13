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

function buildCounts(values, keyFn) {
  return values.reduce((counts, value) => {
    const key = keyFn(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function writeGeneratedRules(rules) {
  const chunks = [];
  for (let index = 0; index < rules.length; index += CHUNK_SIZE) {
    chunks.push(rules.slice(index, index + CHUNK_SIZE));
  }

  const lines = [
    "/* eslint-disable */",
    "/* auto-generated by scripts/planner/parse-transfer-planner-equivalency-guide.cjs */",
    "",
    'import type { TransferPlannerEquivalencyRule } from "./schema";',
    "",
  ];

  chunks.forEach((chunk, index) => {
    lines.push(
      `const TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULE_CHUNK_${index}: unknown[] = ${JSON.stringify(
        chunk,
        null,
        2
      )};`,
      ""
    );
  });

  const chunkNames = chunks.map((_, index) => `  TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULE_CHUNK_${index}`);
  lines.push(
    "const TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES_RAW: unknown[] = ([] as unknown[]).concat(",
    `${chunkNames.join(",\n")}`,
    ");",
    "",
    "export const TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES =",
    "  TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES_RAW as TransferPlannerEquivalencyRule[];",
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
  const rules = rows.map(buildRule).sort((left, right) => left.id.localeCompare(right.id));
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
    ruleCount: rules.length,
    rulesWithSourceCourseSets: rules.filter((rule) => (rule.sourceCourseSets?.[0]?.length ?? 0) > 0).length,
    rulesWithTargetCourseCodes: rules.filter((rule) => (rule.targetCourseCodes?.length ?? 0) > 0).length,
    countsByType: buildCounts(rules, (rule) => rule.type),
    countsByStatus: buildCounts(rules, (rule) => rule.ruleStatus ?? "unknown"),
    countsByAcceptanceCategory: buildCounts(rules, (rule) => rule.acceptanceCategory),
    countsByDepartment: buildCounts(rules, (rule) => rule.guideDepartment ?? "unknown"),
    sampleRules: rules.slice(0, 20),
  };

  writeGeneratedRules(rules);
  writeReports(report);

  console.log(
    JSON.stringify(
      {
        generatedRules: report.ruleCount,
        departments: report.departmentCount,
        directCourseRules: report.countsByType["direct-course"] ?? 0,
        sequenceRules: report.countsByType.sequence ?? 0,
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
