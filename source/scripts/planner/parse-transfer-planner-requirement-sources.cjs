const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
const {
  TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY,
  TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY,
} = require("../../constants/transfer-planner-source");
const {
  decodeTransferPlannerHtmlEntities,
  labelMentionsDifferentTransferPlannerMajor,
  normalizeTransferPlannerSemanticPathwayLabel,
  normalizeTransferPlannerText,
} = require("../../constants/transfer-planner-source/pathway-title-normalization");
let TRANSFER_PLANNER_GENERATED_COURSE_METADATA = [];
try {
  ({ TRANSFER_PLANNER_GENERATED_COURSE_METADATA } = require("../../constants/transfer-planner-source/course-metadata.generated"));
} catch {
  TRANSFER_PLANNER_GENERATED_COURSE_METADATA = [];
}

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const SNAPSHOT_DIR = path.resolve(TMP_DIR, "transfer-planner-requirement-source-snapshots");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-requirement-source-parse-report.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-requirement-source-parse-report.md");
const OUTPUT_TS_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "requirement-source-adapters.generated.ts"
);
function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}
function getArgValue(flag) {
  const args = process.argv.slice(2);
  const directPrefix = `${flag}=`;
  const directMatch = args.find((arg) => arg.startsWith(directPrefix));
  if (directMatch) {
    return directMatch.slice(directPrefix.length).trim() || null;
  }

  const flagIndex = args.indexOf(flag);
  if (flagIndex === -1) {
    return null;
  }

  const nextValue = args[flagIndex + 1];
  if (!nextValue || nextValue.startsWith("--")) {
    return null;
  }

  return String(nextValue).trim() || null;
}
function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_HOST_COOLDOWN_MS = 750;
const USER_AGENT = "GatorGuideTransferPlannerRequirementParser/1.0";
const CURL_COMMAND = process.platform === "win32" ? "curl.exe" : "curl";
const CURL_MAX_BUFFER_BYTES = 40 * 1024 * 1024;
const CURL_ACCEPT_HEADER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,*/*;q=0.7";
const GENERATED_CHUNK_SIZE = 40;
const EXPLICIT_COURSE_CODE_PATTERN =
  /\b([A-Za-z&]{1,20}(?:\s+[A-Za-z&]{1,20})?)\s+(\d{3}[A-Za-z]?)\b/g;
const COURSE_NUMBER_CONTINUATION_PATTERN =
  /(?:^|[,(;/]\s*|\b(?:or|and)\s+)(\d{3}[A-Za-z]?)(?=$|[\s,);/]|(?:\s*(?:or|and)\b))/gi;
const NOISY_SOURCE_LINE_PATTERN =
  /(?:src=|srcset=|aria-label=|title=|\.jpg\b|\.jpeg\b|\.png\b|\.svg\b|\.gif\b|^\[page\s+\d+\]\s*%pdf-|^\s*%pdf-)/i;
const TRANSFER_CREDIT_NOISE_PATTERN =
  /\b(transfer credits?|transfer equivalenc(?:y|ies)|articulation agreement|community colleges?|community college)\b/i;
const ENGLISH_COMPOSITION_REQUIREMENT_PATTERN = /\benglish composition\b/i;
const ENGLISH_COMPOSITION_CONTEXT_PATTERN =
  /\b(5 credits of|five credits of|min(?:imum)?(?:\s+course)? requirements?|prerequisite|admission|complete|completed|required|eligibility|preferred)\b/i;
const ENGLISH_COMPOSITION_EXCLUSION_PATTERN =
  /\b(additional english composition|except the 5-?credit english composition requirement|writing-intensive|w course|w courses)\b/i;
const INVALID_EXTRACTED_COURSE_SUBJECTS = new Set([
  "ABOVE",
  "APPLY",
  "AND",
  "ANY",
  "APPROVED",
  "ARE",
  "AREA",
  "AT",
  "AUTUMN",
  "BASIC",
  "BE",
  "BEFORE",
  "BETWEEN",
  "BELOW",
  "BEYOND",
  "BEGIN",
  "BOTH",
  "BOX",
  "BLDG",
  "BUILDING",
  "BUT",
  "BY",
  "CALL",
  "CLASSES",
  "COURSES",
  "COURSE",
  "CORE",
  "CREDITS",
  "CREDIT",
  "COMPLETE",
  "CONSIDER",
  "DATA",
  "DOES",
  "DIVISION",
  "EARN",
  "EARNED",
  "EITHER",
  "ENGLISH",
  "EXCEPT",
  "FAX",
  "FORTUNE",
  "FOR",
  "FOREIGN",
  "FORMERLY",
  "HALL",
  "FROM",
  "GRADED",
  "HAS",
  "HAVE",
  "HAVEA",
  "IF",
  "IN",
  "INCLUDE",
  "INCLUDES",
  "INTO",
  "IS",
  "JUST",
  "LANG",
  "LANGUAGE",
  "LEVEL",
  "LEAST",
  "LIKE",
  "MINIMUM",
  "MAX",
  "MORE",
  "MUST",
  "NUMBERED",
  "NOT",
  "OF",
  "ONE",
  "ON",
  "OFFERINGS",
  "OCCUPIES",
  "OFFICE",
  "OR",
  "OTHER",
  "PLUS",
  "REACH",
  "REQUIRE",
  "REQUIREMENTS",
  "RECOMMENDED",
  "REQUIRES",
  "REQUIRED",
  "ROOM",
  "SECTION",
  "SEPARATE",
  "SPRING",
  "RM",
  "ROOM",
  "BREADTH",
  "GROCERY",
  "SUITE",
  "SUMMER",
  "TAKE",
  "TAKING",
  "THAT",
  "THAN",
  "THE",
  "THEN",
  "THROUGH",
  "TO",
  "TOTALS",
  "TWO",
  "USE",
  "WANT",
  "WHILE",
  "WILL",
  "WINTER",
  "WITH",
  "YOUR",
]);
const LEGACY_GRC_CODE_ALIASES = new Map([
  ["MATH& 254", "MATH& 264"],
]);
const LEADING_EXTRACTED_COURSE_SUBJECT_TOKENS = new Set(["AND", "AS", "OR"]);
const RECOVERABLE_LEADING_EXTRACTED_COURSE_SUBJECT_TOKENS = new Set([
  "AND",
  "AS",
  "BOTH",
  "EITHER",
  "IN",
  "OR",
  "PREREQ",
  "PREREQUISITE",
]);
const LEADING_LIST_MARKER_TOKENS = new Set(["I", "II", "III", "IV"]);
const EXTRACTED_COURSE_SUBJECT_ALIASES = {
  "A A": "AA",
  "A MATH": "AMATH",
  ACCOUNTING: "ACCTG",
  ASTRONOMY: "ASTR",
  "APPLIED MATHEMATICS": "AMATH",
  BIOENGINEERING: "BIOEN",
  BIOSTATISTICS: "BIOST",
  BIOLOGY: "BIOL",
  "CHEM E": "CHEME",
  "E E": "EE",
  "IND E": "INDE",
  "M E": "ME",
  MATHEMATICS: "MATH",
  PHYSICS: "PHYS",
  SPANISH: "SPAN",
};
const KNOWN_UW_EXTRACTED_COURSE_SUBJECTS = new Set(
  TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter((entry) => entry.schoolId !== "grc")
    .map((entry) => String(entry.code ?? "").match(/^([A-Z&]+(?: [A-Z&]+)*) \d/))
    .map((match) => match?.[1] ?? null)
    .filter(Boolean)
);
const REQUIREMENT_CUE_PATTERN =
  /\b(required|requirements|prereq|prerequisite|complete|credits|credit|elective|select|choose|one of the following|two of the following|option|track|route|pathway|concentration)\b/i;
const GENERAL_ED_REQUIREMENT_CUE_PATTERN =
  /\b(areas of inquiry|arts?\s+(?:and|&)\s+humanities|social sciences?|natural sciences?|a&h|ssc|nsc|diversity|additional a&h|additional areas? of inquiry|additional coursework)\b/i;
const STRUCTURAL_REQUIREMENT_PATTERN =
  /\b(admission requirements|degree requirements|major requirements|completion requirements|required courses|elective courses|core courses|core requirements|curriculum|prerequisite courses|shared set of core courses|specialization|track|option|route|pathway|concentration|checklist|foundation|distribution requirement)\b/i;
const COURSE_CLUSTER_REQUIREMENT_CONTEXT_PATTERN =
  /\b(model program of study|program of study|curriculum overview|curriculum plan|core curriculum|foundation courses|practice courses|required curriculum|graduation requirements|social welfare electives|upper-division .*electives)\b/i;
const BLOCK_TAG_PATTERN = /<(?:\/?(?:p|div|section|article|li|ul|ol|table|tr|td|th|h1|h2|h3|h4|h5|h6|br))[^>]*>/gi;
const TITLE_PATTERN = /<title[^>]*>([\s\S]*?)<\/title>/i;
const HEADING_PATTERN = /<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi;
const HTML_LINK_PATTERN = /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi;
const HTML_TAG_PATTERN = /<[^>]+>/g;
const PDF_LINK_PATTERN = /href=(?:"([^"]+\.pdf(?:\?[^"]*)?)"|'([^']+\.pdf(?:\?[^']*)?)')/gi;
const SUPPLEMENTAL_HTML_LINK_PATTERN =
  /\b(curriculum|requirements?|degree requirements?|major requirements?|prerequisites?|prereq|worksheet|checklist|plan of study|program of study|study plan|sample plan|track|option|concentration|specialization|route|pathway|b\.?\s*a\.?|b\.?\s*s\.?|bachelor(?:'s)?|major(?: in)?|undergraduate studies?)\b/i;
const HIGH_SIGNAL_SUPPLEMENTAL_HTML_LINK_PATTERN =
  /\b(curriculum|requirements?|degree requirements?|major requirements?|prerequisites?|prereq|worksheet|checklist|plan of study|program of study|study plan|sample plan)\b/i;
const SPECIALIZATION_SUPPLEMENTAL_HTML_LINK_PATTERN =
  /\b(track|option|concentration|specialization|route|pathway)\b/i;
const LOW_SIGNAL_SUPPLEMENTAL_HTML_LINK_PATTERN =
  /\b(?:b\.?\s*a\.?|b\.?\s*s\.?|bachelor(?:'s)?|major(?: in)?|undergraduate studies?)\b/i;
const NOISY_SUPPLEMENTAL_HTML_LINK_LABEL_PATTERN =
  /\b(apply|canvas|calendar|directory|map|myuw|library|tools|about|news|faculty|staff|contact|privacy|accessibility|terms|alumni|events|parking|transportation|research|housing|student life|jobs|visit|give|get involved|post graduation|minor|certificate|graduate|scholarships?|course lists?|course evaluations?|capstone courses?|study abroad|policy(?:\s*&\s*|\s+and\s+)procedures|suggested course pathways?)\b/i;
const NON_STUDENT_FACING_REQUIREMENT_HINT_PATTERN =
  /\b(suggested general education|not required for transferring|highly recommended courses?|other recommended courses?|approved list|study abroad|capstone courses?|course evaluations?|course lists?|policy(?:\s*&\s*|\s+and\s+)procedures|graduate school|graduate programs?)\b/i;
const LEGACY_STUDENT_GENCAT_SOURCE_URL_PATTERN =
  /\/\/(?:www\.)?washington\.edu\/students\/gencat\/program\//i;
const UW_GENERAL_CATALOG_PROGRAM_URL_PATTERN =
  /\/\/(?:www\.)?washington\.edu\/students\/gencat\/program\//i;
const GRADUATE_SUPPLEMENTAL_SOURCE_PATTERN =
  /\b(graduate|ph\.?\s*d\.?|doctor(?:al|ate)?|m\.?\s*a\.?|master(?:'s)?)\b|\/(?:ma|phd|graduate)(?:[-/]|$)/i;
const TRACK_CATALOG_SUPPLEMENTAL_SOURCE_PATTERN =
  /\b(course(?:s)? by track|courses-track|list of geography courses by track|suggested course pathways?)\b/i;
const HTML_SECTION_BOUNDARY_LINE_PATTERN =
  /^(?:Program of Study:|Bachelor\b|Minor\b|Master\b|Doctor\b|Undergraduate Programs\b|Graduate Programs\b|Back to Top\b)/i;
const REQUIREMENT_FRIENDLY_HINT_PATTERN =
  /\b(required|requirements?|prereq|prerequisite|complete|completed|admission|degree requirements?|credits?|engineering fundamentals|mathematics|sciences|written\s*&\s*oral communication|english composition|areas of inquiry|choose from the following|select one sequence|prior to the start of|before the start of|continuation requirements?)\b/i;
const DIRECT_REQUIREMENT_COURSE_SEQUENCE_HINT_PATTERN =
  /\*?[A-Z&]+(?:\s+[A-Z&]+)?\s+\d{3}[A-Za-z]?\s*,\s*\d{3}[A-Za-z]?\s*,\s*\d{3}[A-Za-z]?(?:\s+(?:or|and)\s+\d{3}[A-Za-z]?\s*,\s*\d{3}[A-Za-z]?\s*,\s*\d{3}[A-Za-z]?)?\s*\(\s*\d+\s*\)/i;
const CROSS_MAJOR_SCOPE_PATTERN =
  /\b(?:if|for|required for)\s+([a-z][a-z&/,\- ]+?)\s+major\b/i;
const PATHWAY_LABEL_CUE_PATTERN =
  /\b(option|track|route|pathway|concentration)\b/i;
const PATHWAY_LABEL_DEGREE_TITLE_PATTERN =
  /^(?:(?:Bachelor|Master|Doctor|Minor|Associate)(?: of [^:]{1,120})?|(?:B\.?\s*A\.?|B\.?\s*S\.?|M\.?\s*A\.?|M\.?\s*S\.?)(?: degree)?(?: with a major in [^:]{1,120})?)\s*:\s+(.{2,120})$/i;
const PATHWAY_LABEL_INLINE_PATTERN =
  /^([^:]{1,120}\b(?:track|option|route|pathway|concentration)\b(?:\s*\([^)]{1,40}\))?)\s*:/i;
const PATHWAY_LABEL_APPLY_PATTERN =
  /\bstudents apply(?: directly)?(?:\s+for|\s+to)?(?: the)?\s+(.{2,100}?)\s+(option|track|route|pathway|concentration)\b/i;
const PATHWAY_SECTION_CONTEXT_PATTERN =
  /\b(?:concentration|track|option|route|pathway)s?\b.*\b(?:area courses?|courses?|listed below|choose|select|customize|approved area)\b|\b(?:choose|select)\s+one\s+of\b.*\b(?:concentration|track|option|route|pathway)s?\b/i;
const PATHWAY_SECTION_BOUNDARY_PATTERN =
  /^(?:admissions?|advising|student resources?|degree requirements?|core courses?|honou?rs?\b|recommended courses?|language courses?|share|support us|contact us|privacy|terms|site map)\b/i;
const PATHWAY_SECTION_SUBCATEGORY_PATTERN = /^\[[^\]]+\]/;
const HONORS_THESIS_PATHWAY_LABEL_PATTERN = /\bhonou?rs?\s+thesis\s+option\b/i;
const PATHWAY_CHOICE_COUNT_BY_WORD = new Map([
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
const CAMPUS_ORDER = ["uw-seattle", "uw-bothell", "uw-tacoma"];
const PARSEABLE_PARSER_TYPES = new Set([
  "html-degree-page",
  "html-curriculum-page",
  "html-overview-page",
  "catalog-page",
  "generic-html",
  "pdf-degree-sheet",
  "pdf-worksheet",
  "generic-pdf",
]);
const HOST_REQUEST_CHAINS = new Map();
const HOST_NEXT_ALLOWED_AT = new Map();
const SOURCE_DOWNLOAD_CACHE = new Map();
const HTML_SOURCE_CACHE = new Map();
const DOCX_SOURCE_CACHE = new Map();
const PDF_PAGE_BLOCK_CACHE = new Map();
const execFileAsync = promisify(execFile);
const REQUIREMENT_SOURCE_ADAPTERS = [
  {
    id: "uw-seattle-html-degree-page",
    family: "UW Seattle HTML degree pages",
    matches: (entry) =>
      entry.campusId === "uw-seattle" &&
      ["html-degree-page", "html-curriculum-page", "html-overview-page"].includes(entry.parserType),
    parse: parseHtmlSource,
  },
  {
    id: "uw-seattle-catalog-page",
    family: "UW Seattle catalog pages",
    matches: (entry) => entry.campusId === "uw-seattle" && entry.parserType === "catalog-page",
    parse: parseHtmlSource,
  },
  {
    id: "uw-bothell-html-degree-page",
    family: "UW Bothell HTML degree pages",
    matches: (entry) =>
      entry.campusId === "uw-bothell" &&
      ["html-degree-page", "html-curriculum-page", "html-overview-page"].includes(entry.parserType),
    parse: parseHtmlSource,
  },
  {
    id: "uw-bothell-catalog-page",
    family: "UW Bothell catalog pages",
    matches: (entry) => entry.campusId === "uw-bothell" && entry.parserType === "catalog-page",
    parse: parseHtmlSource,
  },
  {
    id: "uw-bothell-pdf-worksheet",
    family: "UW Bothell PDF worksheets",
    matches: (entry) =>
      entry.campusId === "uw-bothell" &&
      ["pdf-degree-sheet", "pdf-worksheet", "generic-pdf"].includes(entry.parserType),
    parse: parsePdfSource,
  },
  {
    id: "uw-tacoma-html-degree-page",
    family: "UW Tacoma HTML degree pages",
    matches: (entry) =>
      entry.campusId === "uw-tacoma" &&
      ["html-degree-page", "html-curriculum-page", "html-overview-page"].includes(entry.parserType),
    parse: parseHtmlSource,
  },
  {
    id: "uw-tacoma-catalog-page",
    family: "UW Tacoma catalog pages",
    matches: (entry) => entry.campusId === "uw-tacoma" && entry.parserType === "catalog-page",
    parse: parseHtmlSource,
  },
  {
    id: "generic-official-pdf-degree-sheet",
    family: "Generic official PDF degree sheets",
    matches: (entry) => ["pdf-degree-sheet", "pdf-worksheet", "generic-pdf"].includes(entry.parserType),
    parse: parsePdfSource,
  },
  {
    id: "generic-official-html-page",
    family: "Generic official HTML pages",
    matches: (entry) => ["generic-html", "html-degree-page", "html-curriculum-page", "html-overview-page", "catalog-page"].includes(entry.parserType),
    parse: parseHtmlSource,
  },
];

function ensureDir(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHostKey(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "unknown-host";
  }
}

async function withHostThrottle(url, work) {
  const hostKey = getHostKey(url);
  const previous = HOST_REQUEST_CHAINS.get(hostKey) ?? Promise.resolve();
  const run = previous
    .catch(() => undefined)
    .then(async () => {
      const waitMs = Math.max(0, (HOST_NEXT_ALLOWED_AT.get(hostKey) ?? 0) - Date.now());
      if (waitMs > 0) {
        await sleep(waitMs);
      }

      try {
        return await work();
      } finally {
        HOST_NEXT_ALLOWED_AT.set(hostKey, Date.now() + DEFAULT_HOST_COOLDOWN_MS);
      }
    });

  HOST_REQUEST_CHAINS.set(
    hostKey,
    run.then(
      () => undefined,
      () => undefined
    )
  );

  return run;
}

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  return decodeTransferPlannerHtmlEntities(value);
}

function stripHtml(value) {
  return normalizeWhitespace(decodeHtmlEntities(String(value ?? "").replace(HTML_TAG_PATTERN, " ")));
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function uniqueInOrder(values) {
  const seen = new Set();
  const uniqueValues = [];
  for (const value of values ?? []) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    uniqueValues.push(value);
  }
  return uniqueValues;
}

function uniqueBy(values, getKey) {
  const seen = new Set();
  const uniqueValues = [];
  for (const value of values ?? []) {
    const key = getKey(value);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueValues.push(value);
  }
  return uniqueValues;
}

function normalizeUrlForComparison(value) {
  try {
    const parsed = new URL(String(value ?? ""));
    parsed.hash = "";
    const normalizedPathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${normalizedPathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function normalizeCourseCode(rawValue) {
  const normalized = normalizeWhitespace(String(rawValue ?? "").toUpperCase().replace(/\s+/g, " "));
  const match = normalized.match(/^([A-Z&]+(?: [A-Z&]+)*) (\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (!match) {
    return LEGACY_GRC_CODE_ALIASES.get(normalized) ?? normalized;
  }

  let subjectTokens = match[1].split(" ").filter(Boolean);
  while (
    subjectTokens.length > 1 &&
    RECOVERABLE_LEADING_EXTRACTED_COURSE_SUBJECT_TOKENS.has(subjectTokens[0])
  ) {
    const candidateTokens = subjectTokens.slice(1);
    const candidateSpacedSubject = candidateTokens.join(" ");
    const candidateCollapsedSubject = candidateTokens.join("");
    if (
      KNOWN_UW_EXTRACTED_COURSE_SUBJECTS.has(candidateSpacedSubject) ||
      KNOWN_UW_EXTRACTED_COURSE_SUBJECTS.has(candidateCollapsedSubject)
    ) {
      subjectTokens = candidateTokens;
      continue;
    }
    break;
  }

  const normalizedSubject = subjectTokens.every((token) => token.length === 1)
    ? subjectTokens.join("")
    : subjectTokens.join(" ");

  const normalizedCode = `${normalizedSubject} ${match[2]}`;
  return LEGACY_GRC_CODE_ALIASES.get(normalizedCode) ?? normalizedCode;
}

function slugify(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function selectRequirementSourceAdapter(entry) {
  return (
    REQUIREMENT_SOURCE_ADAPTERS.find((adapter) => adapter.matches(entry)) ??
    REQUIREMENT_SOURCE_ADAPTERS[REQUIREMENT_SOURCE_ADAPTERS.length - 1]
  );
}

function getSourceRoleScore(entry) {
  if (classifyRequirementSourceRole(entry) === "official-catalog") {
    return 6;
  }

  switch (entry.role) {
    case "degree-requirements":
      return 6;
    case "curriculum":
      return 5;
    case "worksheet":
      return 4;
    case "catalog":
      return 6;
    case "overview":
      return 2;
    default:
      return 1;
  }
}

function classifyRequirementSourceRole(entry) {
  const searchable = normalizeMatcherText(
    [
      entry?.url,
      entry?.label,
      entry?.sourceLabel,
      entry?.ownerTitle,
      entry?.role,
      entry?.parserType,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!searchable) {
    return "ignored";
  }

  if (UW_GENERAL_CATALOG_PROGRAM_URL_PATTERN.test(String(entry?.url ?? ""))) {
    return "official-catalog";
  }

  if (/\b(?:archive|archived|retired|old requirements?|prior to|pre-20\d{2})\b/.test(searchable)) {
    return "old-archival";
  }

  if (/\bequivalenc(?:y|ies)\b|equivalency guide/.test(searchable)) {
    return "transfer-equivalency";
  }

  if (/\bgreen river\b|\bgrc\b|\bassociate\b|\bast-?2\b|\bmrp\b/.test(searchable)) {
    return "matched-grc-track";
  }

  if (/\bsample (?:schedule|plan)|\bstudy plan\b|\bplan of study\b/.test(searchable)) {
    return "sample-schedule";
  }

  if (/\bcurriculum(?: map)?\b|\bdegree map\b|\bfour-year plan\b/.test(searchable)) {
    return "curriculum-map";
  }

  if (/\badmissions?\b|\bapply\b|\bapplication\b|\bpreparation\b|\bprerequisites?\b/.test(searchable)) {
    return "admissions-preparation";
  }

  if (/\bdegree requirements?\b|\bmajor requirements?\b|\bgraduation requirements?\b|\bchecklist\b/.test(searchable)) {
    return "primary-degree-requirements";
  }

  if (/\brequirements?\b|\bundergraduate\b|\bmajor\b|\bprogram\b/.test(searchable)) {
    return "department-requirements";
  }

  return "ignored";
}

function getParserTypeScore(parserType) {
  switch (parserType) {
    case "html-degree-page":
      return 8;
    case "html-curriculum-page":
      return 7;
    case "catalog-page":
      return 6;
    case "html-overview-page":
      return 5;
    case "pdf-degree-sheet":
      return 4;
    case "pdf-worksheet":
      return 3;
    case "generic-html":
      return 2;
    case "generic-pdf":
      return 1;
    default:
      return 0;
  }
}

function compareManifestFallbackCandidates(left, right) {
  const confidenceScoreDelta =
    ["high", "medium", "low"].indexOf(left.confidence) - ["high", "medium", "low"].indexOf(right.confidence);
  if (confidenceScoreDelta !== 0) {
    return confidenceScoreDelta;
  }

  const roleDelta = getSourceRoleScore(right) - getSourceRoleScore(left);
  if (roleDelta !== 0) {
    return roleDelta;
  }

  const parserTypeDelta = getParserTypeScore(right.parserType) - getParserTypeScore(left.parserType);
  if (parserTypeDelta !== 0) {
    return parserTypeDelta;
  }

  return left.label.localeCompare(right.label);
}

function getAlternateParseableManifestEntries(entry) {
  return TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
    (candidate) =>
      candidate.ownerId === entry.ownerId &&
      candidate.id !== entry.id &&
      candidate.url !== entry.url &&
      candidate.campusId === entry.campusId &&
      PARSEABLE_PARSER_TYPES.has(candidate.parserType)
  ).sort(compareManifestFallbackCandidates);
}

function getStructuredUwCourseCodes(manifestEntry) {
  return uniqueSorted(
    TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY.filter(
      (block) =>
        block.planId === manifestEntry.planId &&
        ((manifestEntry.pathwayId && block.pathwayId === manifestEntry.pathwayId) ||
          (!manifestEntry.pathwayId && !block.pathwayId))
    )
      .flatMap((block) => block.uwCourseCodes ?? [])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function extractCourseSubjectTokens(rawValue) {
  return normalizeWhitespace(String(rawValue ?? ""))
    .toUpperCase()
    .split(" ")
    .filter(Boolean);
}

function normalizeExtractedCourseSubject(rawValue) {
  const rawSubject = normalizeWhitespace(String(rawValue ?? "")).toUpperCase();
  const normalizedSubject = EXTRACTED_COURSE_SUBJECT_ALIASES[rawSubject] ?? rawSubject;
  const rawSubjectTokens = extractCourseSubjectTokens(normalizedSubject);
  let subjectTokens = [...rawSubjectTokens];

  while (
    subjectTokens.length > 1 &&
    RECOVERABLE_LEADING_EXTRACTED_COURSE_SUBJECT_TOKENS.has(subjectTokens[0])
  ) {
    subjectTokens = subjectTokens.slice(1);
  }

  if (
    subjectTokens.length > 1 &&
    LEADING_EXTRACTED_COURSE_SUBJECT_TOKENS.has(subjectTokens[0])
  ) {
    subjectTokens = subjectTokens.slice(1);
  }

  if (subjectTokens.length > 1 && LEADING_LIST_MARKER_TOKENS.has(subjectTokens[0])) {
    subjectTokens = subjectTokens.slice(1);
  }

  const subject = subjectTokens.join(" ");
  const collapsedSubject = subjectTokens.join("");
  const hasDanglingAmpersandToken = subjectTokens.some((token) => token === "&" || token.endsWith("&"));
  const subjectIsKnown = KNOWN_UW_EXTRACTED_COURSE_SUBJECTS.has(subject);
  const collapsedSubjectIsKnown = KNOWN_UW_EXTRACTED_COURSE_SUBJECTS.has(collapsedSubject);

  if (
    subjectTokens.length > 1 &&
    collapsedSubjectIsKnown &&
    !subjectIsKnown
  ) {
    return collapsedSubject;
  }

  if (
    !subjectTokens.length ||
    subjectTokens.length > 2 ||
    (subjectTokens.length === 1 && subjectTokens[0].length < 2) ||
    hasDanglingAmpersandToken ||
    subjectTokens.some((token) => token.length > 8 || !/^[A-Z&]+$/.test(token)) ||
    INVALID_EXTRACTED_COURSE_SUBJECTS.has(subject) ||
    subjectTokens.some((token) => INVALID_EXTRACTED_COURSE_SUBJECTS.has(token)) ||
    (!subjectIsKnown && !collapsedSubjectIsKnown) ||
    ((/SKL$/i.test(subject) || /SKL$/i.test(collapsedSubject)) &&
      !subjectIsKnown &&
      !collapsedSubjectIsKnown)
  ) {
    return null;
  }

  return subject;
}

function normalizeExtractedCourseCode(rawSubject, rawNumber) {
  const subject = normalizeExtractedCourseSubject(rawSubject);
  const number = normalizeWhitespace(String(rawNumber ?? "").toUpperCase());

  if (!subject || !/^\d{3}[A-Z]?$/.test(number) || /^000[A-Z]?$/.test(number)) {
    return null;
  }

  return `${subject} ${number}`;
}

function extractRelevantRequirementLines(lines, headings) {
  const normalizedHeadings = new Set(headings.map((heading) => normalizeWhitespace(heading)));
  const relevantLineIndexes = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeWhitespace(lines[index]);
    if (!line) {
      continue;
    }

    if (
      TRANSFER_CREDIT_NOISE_PATTERN.test(line) ||
      normalizedHeadings.has(line) ||
      REQUIREMENT_CUE_PATTERN.test(line) ||
      REQUIREMENT_FRIENDLY_HINT_PATTERN.test(line) ||
      STRUCTURAL_REQUIREMENT_PATTERN.test(line)
    ) {
      if (TRANSFER_CREDIT_NOISE_PATTERN.test(line)) {
        continue;
      }
      const forwardWindow = STRUCTURAL_REQUIREMENT_PATTERN.test(line)
        ? 14
        : REQUIREMENT_FRIENDLY_HINT_PATTERN.test(line)
          ? 14
          : /\b\d+\s+(?:credits?|cr\.?)(?:\s*,?\s*from)?\b/i.test(line)
          ? 10
          : 5;
      for (
        let includedIndex = Math.max(0, index - 1);
        includedIndex <= Math.min(lines.length - 1, index + forwardWindow);
        includedIndex += 1
      ) {
        relevantLineIndexes.add(includedIndex);
      }
    }
  }

  if (!relevantLineIndexes.size) {
    return lines.slice(0, 240);
  }

  return Array.from(relevantLineIndexes)
    .sort((left, right) => left - right)
    .map((index) => lines[index])
    .filter(
      (line) => !NOISY_SOURCE_LINE_PATTERN.test(line) && !TRANSFER_CREDIT_NOISE_PATTERN.test(line)
    );
}

function extractExplicitCourseCodesFromLine(line) {
  const normalizedLine = normalizeWhitespace(String(line ?? ""));
  if (
    NOISY_SOURCE_LINE_PATTERN.test(normalizedLine) ||
    TRANSFER_CREDIT_NOISE_PATTERN.test(normalizedLine)
  ) {
    return [];
  }

  const extractedCourseCodes = [];
  const explicitMatches = [...normalizedLine.matchAll(EXPLICIT_COURSE_CODE_PATTERN)]
    .map((match) => {
      const subject = normalizeExtractedCourseSubject(match[1]);
      const explicitCode = normalizeExtractedCourseCode(match[1], match[2]);
      if (!subject || !explicitCode) {
        return null;
      }
      return {
        match,
        subject,
        explicitCode,
      };
    })
    .filter(Boolean);

  for (let index = 0; index < explicitMatches.length; index += 1) {
    const { match, subject, explicitCode } = explicitMatches[index];

    extractedCourseCodes.push(explicitCode);

    const currentMatchEnd = match.index + match[0].length;
    const nextMatchStart =
      index + 1 < explicitMatches.length
        ? explicitMatches[index + 1].match.index
        : normalizedLine.length;
    const trailingSegment = normalizedLine.slice(currentMatchEnd, nextMatchStart);

    for (const numberMatch of trailingSegment.matchAll(COURSE_NUMBER_CONTINUATION_PATTERN)) {
      const continuationCode = normalizeExtractedCourseCode(subject, numberMatch[1]);
      if (continuationCode) {
        extractedCourseCodes.push(continuationCode);
      }
    }
  }

  for (const rawAlias of Object.keys(EXTRACTED_COURSE_SUBJECT_ALIASES)) {
    if (!rawAlias.includes(" ")) {
      continue;
    }

    const aliasPattern = new RegExp(
      `\\b${rawAlias
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\s+/g, "\\s+")}\\s+(\\d{3}[A-Za-z]?)\\b`,
      "g"
    );
    for (const aliasMatch of normalizedLine.matchAll(aliasPattern)) {
      const explicitCode = normalizeExtractedCourseCode(rawAlias, aliasMatch[1]);
      if (explicitCode) {
        extractedCourseCodes.push(explicitCode);
      }
    }
  }

  return uniqueSorted(extractedCourseCodes);
}

function extractCourseCodesFromLine(line) {
  const normalizedLine = normalizeWhitespace(String(line ?? ""));
  const extractedCourseCodes = extractExplicitCourseCodesFromLine(normalizedLine);

  if (
    ENGLISH_COMPOSITION_REQUIREMENT_PATTERN.test(normalizedLine) &&
    !ENGLISH_COMPOSITION_EXCLUSION_PATTERN.test(normalizedLine) &&
    (normalizedLine.length <= 140 || ENGLISH_COMPOSITION_CONTEXT_PATTERN.test(normalizedLine))
  ) {
    extractedCourseCodes.push("ENGL 131");
  }

  return uniqueSorted(extractedCourseCodes);
}

function hasRequirementContextNearLine(lines, index, radius) {
  const startIndex = Math.max(0, index - radius);
  const endIndex = Math.min(lines.length - 1, index + radius);

  for (let contextIndex = startIndex; contextIndex <= endIndex; contextIndex += 1) {
    const line = normalizeWhitespace(lines[contextIndex]);
    if (
      line &&
      (STRUCTURAL_REQUIREMENT_PATTERN.test(line) ||
        REQUIREMENT_CUE_PATTERN.test(line) ||
        REQUIREMENT_FRIENDLY_HINT_PATTERN.test(line) ||
        COURSE_CLUSTER_REQUIREMENT_CONTEXT_PATTERN.test(line))
    ) {
      return true;
    }
  }

  return false;
}

function hasKnownSubjectCourseCluster(lines, index, courseCode) {
  const subject = getCourseCodeSubject(courseCode);
  if (!subject || !KNOWN_UW_EXTRACTED_COURSE_SUBJECTS.has(subject)) {
    return false;
  }

  const level = getCourseCodeNumericLevel(courseCode);
  if (level === null || level >= 500) {
    return false;
  }

  const startIndex = Math.max(0, index - 8);
  const endIndex = Math.min(lines.length - 1, index + 8);
  let sameSubjectCourseCount = 0;
  let hasDescriptiveCourseLine = false;

  for (let contextIndex = startIndex; contextIndex <= endIndex; contextIndex += 1) {
    const line = normalizeWhitespace(lines[contextIndex]);
    const lineCourseCodes = extractCourseCodesFromLine(line).filter(
      (lineCourseCode) => getCourseCodeSubject(lineCourseCode) === subject
    );
    sameSubjectCourseCount += lineCourseCodes.length;
    if (
      lineCourseCodes.length > 0 &&
      !lineCourseCodes.every((lineCourseCode) => isBareCourseCodeSourceHint(line, lineCourseCode))
    ) {
      hasDescriptiveCourseLine = true;
    }
  }

  return sameSubjectCourseCount >= 3 || (sameSubjectCourseCount >= 2 && hasDescriptiveCourseLine);
}

function isSafeKnownSubjectCourseClusterLine(entry, lines, index, courseCode) {
  if (!entry || !Array.isArray(lines)) {
    return false;
  }

  if (!hasKnownSubjectCourseCluster(lines, index, courseCode)) {
    return false;
  }

  return (
    hasRequirementContextNearLine(lines, index, 80) ||
    /\b(curriculum|requirements?|checklist|worksheet)\b/i.test(
      `${entry.parserType ?? ""} ${entry.sourceLabel ?? ""} ${entry.url ?? ""}`
    )
  );
}

function extractSafeKnownSubjectCourseClusterCodesFromLines(entry, lines) {
  if (!entry) {
    return [];
  }

  const recoveredCodes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeWhitespace(lines[index]);
    if (!line || NOISY_SOURCE_LINE_PATTERN.test(line) || TRANSFER_CREDIT_NOISE_PATTERN.test(line)) {
      continue;
    }

    for (const courseCode of extractCourseCodesFromLine(line)) {
      if (isSafeKnownSubjectCourseClusterLine(entry, lines, index, courseCode)) {
        recoveredCodes.push(courseCode);
      }
    }
  }

  return uniqueSorted(recoveredCodes);
}

function extractCourseCodesFromLines(lines, headings, entry = null) {
  return uniqueSorted([
    ...extractRelevantRequirementLines(lines, headings).flatMap((line) => extractCourseCodesFromLine(line)),
    ...extractSafeKnownSubjectCourseClusterCodesFromLines(entry, lines),
  ]);
}

function buildSourceLineHint(courseCode, line) {
  const normalizedLine = normalizeWhitespace(String(line ?? ""));
  if (!normalizedLine) {
    return null;
  }

  const explicitCourseCodes = extractExplicitCourseCodesFromLine(normalizedLine);
  if (
    courseCode === "ENGL 131" &&
    explicitCourseCodes.length > 0 &&
    !explicitCourseCodes.includes(courseCode) &&
    ENGLISH_COMPOSITION_REQUIREMENT_PATTERN.test(normalizedLine) &&
    !ENGLISH_COMPOSITION_EXCLUSION_PATTERN.test(normalizedLine)
  ) {
    return normalizedLine.replace(
      /\bEnglish composition\b/i,
      "English composition (ENGL 131)"
    );
  }

  if (
    courseCode &&
    extractCourseCodesFromLine(normalizedLine).includes(courseCode) &&
    !normalizedLine.toUpperCase().includes(courseCode)
  ) {
    return `${normalizedLine} (${courseCode})`;
  }

  return normalizedLine;
}

function getSourceLineHints(lines, courseCode) {
  return uniqueSorted(
    lines
      .filter((line) => extractCourseCodesFromLine(line).includes(courseCode))
      .map((line) => buildSourceLineHint(courseCode, line))
      .filter(Boolean)
      .filter((line) => line.length <= 280)
      .slice(0, 5)
  );
}

function lineReferencesDifferentMajorScope(entry, line) {
  const normalizedOwnerTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  if (!normalizedOwnerTitle) {
    return false;
  }

  const match = normalizeWhitespace(String(line ?? "")).match(CROSS_MAJOR_SCOPE_PATTERN);
  if (!match?.[1]) {
    return false;
  }

  const normalizedMentionedScope = normalizeMatcherText(match[1]);
  if (!normalizedMentionedScope) {
    return false;
  }

  return (
    !normalizedOwnerTitle.includes(normalizedMentionedScope) &&
    !normalizedMentionedScope.includes(normalizedOwnerTitle)
  );
}

function isBareCourseCodeSourceHint(hint, courseCode) {
  const normalizedHint = normalizeWhitespace(String(hint ?? ""))
    .replace(/[|,;:.()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalizeCourseCode(normalizedHint) === normalizeCourseCode(courseCode);
}

function isRequirementSupportedBareCourseCodeHint(entry, courseCode, lines) {
  if (!Array.isArray(lines) || !lines.length) {
    return false;
  }

  return lines.some(
    (line, index) =>
      isBareCourseCodeSourceHint(line, courseCode) &&
      isSafeKnownSubjectCourseClusterLine(entry, lines, index, courseCode)
  );
}

function isUnsafeRequirementCourseHint(entry, courseCode, hint, lines = []) {
  const normalizedHint = normalizeWhitespace(String(hint ?? ""));
  if (!normalizedHint) {
    return false;
  }

  if (isBareCourseCodeSourceHint(normalizedHint, courseCode)) {
    return !isRequirementSupportedBareCourseCodeHint(entry, courseCode, lines);
  }

  if (lineReferencesDifferentMajorScope(entry, normalizedHint)) {
    return true;
  }

  if (NON_STUDENT_FACING_REQUIREMENT_HINT_PATTERN.test(normalizedHint)) {
    return true;
  }

  const extractedCourseCodes = extractCourseCodesFromLine(normalizedHint);
  const hintLineIndex = (lines ?? []).findIndex(
    (line) =>
      normalizeWhitespace(line) === normalizedHint ||
      buildSourceLineHint(courseCode, line) === normalizedHint
  );
  const hasNearbyRequirementContext =
    hintLineIndex >= 0 && hasRequirementContextNearLine(lines, hintLineIndex, 4);
  if (
    extractedCourseCodes.length >= 6 &&
    !REQUIREMENT_FRIENDLY_HINT_PATTERN.test(normalizedHint) &&
    !DIRECT_REQUIREMENT_COURSE_SEQUENCE_HINT_PATTERN.test(normalizedHint) &&
    !hasNearbyRequirementContext
  ) {
    return true;
  }

  return false;
}

function filterParsedCourseCodesByHints(entry, lines, courseCodes) {
  return uniqueSorted(
    (courseCodes ?? []).filter((courseCode) => {
      const sourceLineHints = getSourceLineHints(lines, courseCode);
      if (!sourceLineHints.length) {
        return true;
      }

      return sourceLineHints.some(
        (hint) => !isUnsafeRequirementCourseHint(entry, courseCode, hint, lines)
      );
    })
  );
}

function buildUniqueDerivedId(baseId, seenCounts) {
  const nextCount = (seenCounts.get(baseId) ?? 0) + 1;
  seenCounts.set(baseId, nextCount);
  return nextCount === 1 ? baseId : `${baseId}-${nextCount}`;
}

function inferParsedRequirementPhaseFromHints(sourceLineHints) {
  const combinedHints = (Array.isArray(sourceLineHints) ? sourceLineHints : [])
    .map((line) => normalizeWhitespace(line).toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (!combinedHints) {
    return {
      phase: null,
      displayPhase: null,
      phaseConfidence: null,
    };
  }

  if (
    /\b(admission|apply|application|prereq|prerequisite|eligibility|before applying)\b/.test(
      combinedHints
    )
  ) {
    return {
      phase: "before-application",
      displayPhase: "before-application",
      phaseConfidence: "high",
    };
  }

  if (
    /\b(before enrollment|before matriculation|matriculation|before transfer|prior to transfer|pre-professional)\b/.test(
      combinedHints
    )
  ) {
    return {
      phase: "before-enrollment",
      displayPhase: "before-enrollment",
      phaseConfidence: "high",
    };
  }

  if (/\b(recommended|encouraged|suggested|optional|elective)\b/.test(combinedHints)) {
    return {
      phase: "stay-at-grc",
      displayPhase: "stay-at-grc",
      phaseConfidence: "medium",
    };
  }

  if (/\b(requirements?|required|core courses?|degree requirements?)\b/.test(combinedHints)) {
    return {
      phase: "before-enrollment",
      displayPhase: "before-enrollment",
      phaseConfidence: "low",
    };
  }

  return {
    phase: null,
    displayPhase: null,
    phaseConfidence: null,
  };
}

function buildParsedRequirementAtomCandidates(owner, parsedCourseCodes, snapshotLines) {
  const seenAtomIds = new Map();
  return parsedCourseCodes.map((courseCode) => {
    const baseId = `${owner.ownerId}:source-atom:${slugify(courseCode)}`;
    const sourceLineHints = getSourceLineHints(snapshotLines, courseCode);
    const inferredPhase = inferParsedRequirementPhaseFromHints(sourceLineHints);
    return {
      id: buildUniqueDerivedId(baseId, seenAtomIds),
      title: courseCode,
      uwCourseCode: courseCode,
      phase: inferredPhase.phase,
      displayPhase: inferredPhase.displayPhase,
      phaseConfidence: inferredPhase.phaseConfidence,
      sourceLineHints,
    };
  });
}

function parseRequirementCreditAmount(value) {
  const text = normalizeWhitespace(String(value ?? ""));
  const numericMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b/i);
  if (numericMatch) {
    const credits = Number.parseFloat(numericMatch[1]);
    return Number.isFinite(credits) ? credits : null;
  }

  const wordMatch = text.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:credits?|cr)\b/i
  );
  if (wordMatch) {
    return WORD_NUMBER_MAP.get(wordMatch[1].toLowerCase()) ?? null;
  }

  return null;
}

function buildParsedRequirementOption(input) {
  const uwCourses = uniqueSorted(
    (input.uwCourses ?? []).map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
  const displayCourseCodes = uniqueSorted(
    (input.displayCourseCodes ?? input.uwCourses ?? [])
      .map((courseCode) => normalizeWhitespace(courseCode))
      .filter(Boolean)
  );
  const equivalentUwCourseCodes = uniqueSorted(
    (input.equivalentUwCourseCodes ?? [])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter((courseCode) => courseCode && !uwCourses.includes(courseCode))
  );
  const label = normalizeWhitespace(input.label ?? uwCourses.join(" / "));

  return {
    id: input.id,
    displayCourseCodes,
    uwCourses,
    equivalentUwCourseCodes,
    credits: input.credits ?? null,
    creditMin: input.creditMin ?? input.credits ?? null,
    creditMax: input.creditMax ?? input.credits ?? null,
    creditText: normalizeWhitespace(input.creditText ?? "") || (input.credits != null ? String(input.credits) : null),
    maxCredits: input.maxCredits ?? null,
    title: normalizeWhitespace(input.title ?? "") || null,
    department: normalizeWhitespace(input.department ?? "") || null,
    category: normalizeWhitespace(input.category ?? "") || null,
    sourceHeading: normalizeWhitespace(input.sourceHeading ?? "") || null,
    sourceCategory: normalizeWhitespace(input.sourceCategory ?? "") || null,
    grcMatches: uniqueSorted(
      (input.grcMatches ?? []).map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
    ),
    constraints: uniqueSorted((input.constraints ?? []).map(normalizeWhitespace).filter(Boolean)),
    notes: uniqueSorted((input.notes ?? []).map(normalizeWhitespace).filter(Boolean)),
    label,
  };
}

function buildParsedRequirementGroup(input) {
  const label = normalizeWhitespace(input.label);
  const category = normalizeWhitespace(input.category);
  const sourceHeading = normalizeWhitespace(input.sourceHeading ?? "") || label;
  return {
    id: input.id,
    label,
    category,
    subcategory: normalizeWhitespace(input.subcategory ?? "") || null,
    requirementType: input.requirementType,
    minCourses: input.minCourses ?? null,
    maxCourses: input.maxCourses ?? null,
    minCredits: input.minCredits ?? null,
    maxCredits: input.maxCredits ?? null,
    sourceHeading,
    notes: uniqueSorted((input.notes ?? []).map(normalizeWhitespace).filter(Boolean)),
    options: (input.options ?? [])
      .map((option) =>
        buildParsedRequirementOption({
          sourceHeading,
          sourceCategory: category,
          ...option,
        })
      )
      .filter(
        (option) => option.uwCourses.length > 0 || option.equivalentUwCourseCodes.length > 0
      ),
  };
}

function extractParsedRequirementGroupCourseCodes(groups) {
  return uniqueSorted(
    (groups ?? []).flatMap((group) =>
      (group.options ?? []).flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
      ])
    )
  );
}

function buildParsedRequirementCourse(input) {
  const courseCode = normalizeWhitespace(input.courseCode ?? "");
  const normalizedCourseCode = normalizeCourseCode(input.normalizedCourseCode ?? courseCode);
  if (!courseCode || !normalizedCourseCode) {
    return null;
  }

  return {
    courseCode,
    normalizedCourseCode,
    title: normalizeWhitespace(input.title ?? "") || null,
    credits: input.credits ?? null,
    creditMin: input.creditMin ?? input.credits ?? null,
    creditMax: input.creditMax ?? input.credits ?? null,
    creditText:
      normalizeWhitespace(input.creditText ?? "") ||
      (input.credits != null ? String(input.credits) : null),
    category: normalizeWhitespace(input.category ?? "") || "unclassified",
    requirementGroupId: normalizeWhitespace(input.requirementGroupId ?? "") || "unclassified",
    requirementType: input.requirementType ?? "all_required",
    optionRole: input.optionRole ?? "required",
    sourceHeading: normalizeWhitespace(input.sourceHeading ?? "") || "Unknown source heading",
    sourceCategory: normalizeWhitespace(input.sourceCategory ?? "") || "Unknown source category",
    notes: uniqueSorted((input.notes ?? []).map(normalizeWhitespace).filter(Boolean)),
  };
}

function buildParsedRequirementCoursesFromGroups(groups) {
  const courses = [];

  for (const group of groups ?? []) {
    for (const option of group.options ?? []) {
      const optionRole =
        group.requirementType === "all_required" || group.requirementType === "sequence_choice"
          ? "required"
          : "option";
      const baseInput = {
        title: option.title ?? option.label ?? null,
        credits: option.credits ?? null,
        creditMin: option.creditMin ?? option.credits ?? null,
        creditMax: option.creditMax ?? option.credits ?? null,
        creditText: option.creditText ?? null,
        category: option.category ?? group.category,
        requirementGroupId: group.id,
        requirementType: group.requirementType,
        sourceHeading: option.sourceHeading ?? group.sourceHeading ?? group.label,
        sourceCategory: option.sourceCategory ?? group.category,
        notes: [...(option.notes ?? []), ...(option.constraints ?? [])],
      };
      const displayCourseCodes = option.displayCourseCodes ?? option.uwCourses ?? [];

      (option.uwCourses ?? []).forEach((courseCode, index) => {
        const parsedCourse = buildParsedRequirementCourse({
          ...baseInput,
          courseCode: displayCourseCodes[index] ?? courseCode,
          normalizedCourseCode: courseCode,
          optionRole,
        });
        if (parsedCourse) {
          courses.push(parsedCourse);
        }
      });

      for (const aliasCode of option.equivalentUwCourseCodes ?? []) {
        const parsedCourse = buildParsedRequirementCourse({
          ...baseInput,
          courseCode: aliasCode,
          normalizedCourseCode: aliasCode,
          optionRole: "alias",
        });
        if (parsedCourse) {
          courses.push(parsedCourse);
        }
      }
    }
  }

  return courses;
}

function buildKnownMaterialsScienceRequiredRequirementCourses(owner) {
  if (owner.planId !== "uw-seattle-materials-science-engineering" || owner.pathwayId) {
    return [];
  }

  const planId = owner.planId;
  const sourceCategory = "UW MSE B.S. degree requirements";
  const rows = [
    {
      sourceHeading: "Mathematics requirements",
      category: "mathematics",
      requirementGroupId: `${planId}:requirement-group:math-required-calculus`,
      requirementType: "all_required",
      entries: [
        { courseCode: "MATH 124", title: "Calculus with Analytic Geometry I", credits: 5 },
        { courseCode: "MATH 125", title: "Calculus with Analytic Geometry II", credits: 5 },
        { courseCode: "MATH 126", title: "Calculus with Analytic Geometry III", credits: 5 },
      ],
    },
    {
      sourceHeading: "Natural Science requirements",
      category: "natural_science",
      requirementGroupId: `${planId}:requirement-group:chemistry-sequence`,
      requirementType: "sequence_choice",
      entries: [
        { courseCode: "CHEM 142", title: "General Chemistry", credits: 5, optionRole: "required" },
        { courseCode: "CHEM 152", title: "General Chemistry", credits: 5, optionRole: "required" },
        { courseCode: "CHEM 143", title: "Honors General Chemistry", credits: 5, optionRole: "alias" },
        { courseCode: "CHEM 153", title: "Honors General Chemistry", credits: 5, optionRole: "alias" },
        { courseCode: "CHEM 145", title: "Honors General Chemistry", credits: 5, optionRole: "alias" },
        { courseCode: "CHEM 155", title: "Honors General Chemistry", credits: 5, optionRole: "alias" },
      ],
    },
    {
      sourceHeading: "Natural Science requirements",
      category: "natural_science",
      requirementGroupId: `${planId}:requirement-group:physics-sequence`,
      requirementType: "all_required",
      entries: [
        { courseCode: "PHYS 121", title: "Mechanics", credits: 5 },
        { courseCode: "PHYS 141", title: "Mechanics honors alternative", credits: 5, optionRole: "alias" },
        { courseCode: "PHYS 122", title: "Electromagnetism", credits: 5 },
        { courseCode: "PHYS 142", title: "Electromagnetism honors alternative", credits: 5, optionRole: "alias" },
        { courseCode: "PHYS 123", title: "Waves", credits: 5 },
        { courseCode: "PHYS 143", title: "Waves honors alternative", credits: 5, optionRole: "alias" },
      ],
    },
    {
      sourceHeading: "Engineering Fundamentals requirements",
      category: "engineering_fundamentals",
      requirementGroupId: `${planId}:requirement-group:engineering-fundamentals-required`,
      requirementType: "all_required",
      entries: [
        { courseCode: "MSE 170", title: "Fundamentals of Materials Science", credits: 4 },
        { courseCode: "AA 210", title: "Engineering Statics", credits: 4 },
        { courseCode: "CEE 220", title: "Introduction to Mechanics of Materials", credits: 4 },
      ],
    },
    {
      sourceHeading: "Required MSE core courses",
      category: "mse_core",
      requirementGroupId: `${planId}:requirement-group:mse-core-required`,
      requirementType: "all_required",
      entries: [
        { courseCode: "MSE 311", title: "Integrated Undergraduate Lab I", credits: 3 },
        { courseCode: "MSE 312", title: "Integrated Undergraduate Lab II", credits: 3 },
        { courseCode: "MSE 313", title: "Integrated Undergraduate Lab III", credits: 3 },
        { courseCode: "MSE 321", title: "Thermodynamics and Phase Equilibrium", credits: 4 },
        { courseCode: "MSE 331", title: "Crystallography and Structure", credits: 3 },
        { courseCode: "MSE 399", title: "Undergraduate Research Seminar", credits: 1 },
        { courseCode: "MSE 310", title: "Introduction to Materials Science and Engineering", credits: 3 },
        { courseCode: "MSE 322", title: "Kinetics and Microstructural Evolution", credits: 4 },
        { courseCode: "MSE 342", title: "Materials Processing I", credits: 3 },
        { courseCode: "MSE 351", title: "Electronic Properties of Materials", credits: 3 },
        { courseCode: "MSE 333", title: "Materials Characterization", credits: 3 },
        { courseCode: "MSE 352", title: "Functional Properties of Materials I", credits: 3 },
        { courseCode: "MSE 362", title: "Mechanical Behavior of Materials I", credits: 3 },
        { courseCode: "MSE 442", title: "Materials Processing II", credits: 3 },
        { courseCode: "MSE 493", title: "Design in Materials Engineering I", credits: 1 },
        { courseCode: "MSE 494", title: "Design in Materials Engineering II", credits: 2 },
        { courseCode: "MSE 431", title: "Failure Analysis and Durability of Materials", credits: 3 },
        { courseCode: "MSE 495", title: "Design in Materials Engineering III", credits: 3 },
      ],
    },
  ];

  return rows.flatMap((row) =>
    row.entries
      .map((entry) =>
        buildParsedRequirementCourse({
          ...entry,
          category: row.category,
          requirementGroupId: row.requirementGroupId,
          requirementType: row.requirementType,
          optionRole: entry.optionRole ?? "required",
          sourceHeading: row.sourceHeading,
          sourceCategory,
        })
      )
      .filter(Boolean)
  );
}

const UW_MSE_NME_OPTION_SOURCE_URL =
  "https://mse.washington.edu/current/undergrad/nmeoption";
const UW_MSE_NME_REPLACEMENT_REASON =
  "NME Option students complete 19 credits of NME Core and Elective Requirements instead of the standard 15-credit MSE Technical Elective requirement.";

function buildKnownMaterialsScienceNmeRequirementReplacement(planId) {
  return {
    baseRequirementId: `${planId}:requirement-group:mse-technical-electives-15-credits`,
    replacedByRequirementId: `${planId}:requirement-group:mse-nme-core-elective-19-credits`,
    appliesWhen: 'selectedOption === "NME"',
    replacementReason: UW_MSE_NME_REPLACEMENT_REASON,
    sourceUrl: UW_MSE_NME_OPTION_SOURCE_URL,
    sourceHeading: "NME Option requirements",
  };
}

function buildKnownMaterialsScienceNmeOptionGroup(planId) {
  const sourceHeading = "NME Option Core/Elective Requirement: 19 credits";
  const nmeOption = (option) => ({
    sourceHeading,
    sourceCategory: option.category === "nme_core_required"
      ? "NME core (4 credits)"
      : "NME electives (15 credits required)",
    ...option,
  });
  const nmeOptions = [
    nmeOption({
      displayCourseCodes: ["NME 220"],
      uwCourses: ["NME 220"],
      credits: 4,
      title: "Introduction to Molecular and Nanoscale Principles",
      department: "NME",
      category: "nme_core_required",
      label: "NME 220",
      notes: ["NME 220 must be taken in the spring of the sophomore or junior year."],
    }),
    nmeOption({
      displayCourseCodes: ["BIOEN 423"],
      uwCourses: ["BIOEN 423"],
      credits: 3,
      title: "Introduction to Synthetic Biology",
      department: "BIOEN",
      category: "nme_elective_option",
      label: "BIOEN 423",
      notes: ["Prerequisite: MATH 207 or MATH 307 and MATH 208 or MATH 308."],
    }),
    nmeOption({
      displayCourseCodes: ["BIOEN 490"],
      uwCourses: ["BIOEN 490"],
      equivalentUwCourseCodes: ["CHEME 490"],
      credits: 3,
      title: "Engineering Materials for Biomedical Applications",
      department: "BIOEN",
      category: "nme_elective_option",
      label: "BIOEN/CHEM E 490",
    }),
    nmeOption({
      displayCourseCodes: ["BIOEN 491"],
      uwCourses: ["BIOEN 491"],
      equivalentUwCourseCodes: ["CHEME 491"],
      credits: 3,
      title: "Controlled-Release Systems",
      department: "BIOEN",
      category: "nme_elective_option",
      label: "BIOEN/CHEM E 491",
    }),
    nmeOption({
      displayCourseCodes: ["BIOEN 492"],
      uwCourses: ["BIOEN 492"],
      equivalentUwCourseCodes: ["CHEME 458"],
      credits: 3,
      title: "Surface Analysis",
      department: "BIOEN",
      category: "nme_elective_option",
      label: "BIOEN 492/CHEM E 458",
    }),
    nmeOption({
      displayCourseCodes: ["CHEM E 523"],
      uwCourses: ["CHEME 523"],
      credits: 1,
      title: "Seminar in Chemical Engineering",
      department: "CHEME",
      category: "nme_restricted_option",
      label: "CHEM E 523",
      notes: ["Seminar credit listed on the NME option source page."],
    }),
    nmeOption({
      displayCourseCodes: ["EE 485"],
      uwCourses: ["EE 485"],
      credits: 4,
      title: "Introduction to Phototonics",
      department: "EE",
      category: "nme_elective_option",
      label: "EE 485",
    }),
    nmeOption({
      displayCourseCodes: ["ENGR 321"],
      uwCourses: ["ENGR 321"],
      credits: 2,
      creditMin: 1,
      creditMax: 2,
      creditText: "1-2",
      maxCredits: 4,
      title: "Internship Class",
      department: "ENGR",
      category: "nme_restricted_option",
      label: "ENGR 321",
      constraints: ["max_degree_counting_credits:4"],
      notes: ["ENGR 321 can count a maximum of 4 credits toward the degree."],
    }),
    nmeOption({
      displayCourseCodes: ["M E 410"],
      uwCourses: ["ME 410"],
      credits: 3,
      title: "Nanodevices: Design and Manufacture",
      department: "ME",
      category: "nme_elective_option",
      label: "M E 410",
      notes: ["Open to non-ME majors during Period 2 registration."],
    }),
    nmeOption({
      displayCourseCodes: ["MOLENG 520"],
      uwCourses: ["MOLENG 520"],
      equivalentUwCourseCodes: ["CHEM 597"],
      credits: 1,
      title: "Seminar in Molecular Engineering",
      department: "MOLENG",
      category: "nme_restricted_option",
      label: "MOLENG 520/CHEM 597",
    }),
    nmeOption({
      displayCourseCodes: ["MOLENG 535"],
      uwCourses: ["MOLENG 535"],
      credits: 1,
      creditMin: 1,
      creditMax: 10,
      creditText: "1-10",
      title: "Seminar in Clean Energy",
      department: "MOLENG",
      category: "nme_restricted_option",
      label: "MOLENG 535",
    }),
    ...[
      ["MSE 452", "Functional Properties of Materials II", 3],
      ["MSE 462", "Mechanical Behavior of Materials II", 3],
      ["MSE 471", "Introduction to Polymer Science and Engineering", 3],
      ["MSE 473", "Noncrystalline State", 3],
      ["MSE 474", "Nanocomposite Materials", 3],
      ["MSE 475", "Intro to Composite Materials", 3],
      ["MSE 476", "Introduction to Optoelectronic Materials", 3],
      ["MSE 481", "Science and Technology of Nanostructures", 3],
      ["MSE 482", "Biomaterials and Nanomaterials in Tissue Engineering", 3],
      ["MSE 483", "Nanomedicine", 3],
    ].map(([courseCode, title, credits]) =>
      nmeOption({
        displayCourseCodes: [courseCode],
        uwCourses: [courseCode],
        credits,
        title,
        department: "MSE",
        category: "nme_elective_option",
        label: courseCode,
      })
    ),
    nmeOption({
      displayCourseCodes: ["MSE 484"],
      uwCourses: ["MSE 484"],
      equivalentUwCourseCodes: ["CHEM 484"],
      credits: 3,
      title: "Electronic and Optoelectronic Polymers",
      department: "MSE",
      category: "nme_elective_option",
      label: "MSE 484/CHEM 484",
      notes: ["Prerequisite: CHEM 455."],
    }),
    nmeOption({
      displayCourseCodes: ["MSE 486"],
      uwCourses: ["MSE 486"],
      equivalentUwCourseCodes: ["EE 486"],
      credits: 3,
      title: "Fundamentals of Integrated Circuit Technology",
      department: "MSE",
      category: "nme_elective_option",
      label: "MSE 486/EE 486",
    }),
    nmeOption({
      displayCourseCodes: ["MSE 498"],
      uwCourses: ["MSE 498"],
      credits: 3,
      creditMin: 3,
      creditMax: 4,
      creditText: "3-4",
      title: "MSE Special Topics",
      department: "MSE",
      category: "nme_restricted_option",
      label: "MSE 498 - selected ones",
      notes: ["Only selected MSE 498 topics count, as announced by the adviser."],
    }),
    nmeOption({
      displayCourseCodes: ["NME 498"],
      uwCourses: ["NME 498"],
      credits: 3,
      creditMin: 3,
      creditMax: 4,
      creditText: "3-4",
      title: "Selected NME Special Topics",
      department: "NME",
      category: "nme_elective_option",
      label: "NME 498",
    }),
    nmeOption({
      displayCourseCodes: ["MSE 502"],
      uwCourses: ["MSE 502"],
      credits: 3,
      title: "Sol-Gel Processing",
      department: "MSE",
      category: "nme_elective_option",
      label: "MSE 502",
      notes: ["Offered autumn quarter in odd years."],
    }),
    nmeOption({
      displayCourseCodes: ["MSE 520"],
      uwCourses: ["MSE 520"],
      credits: 1,
      title: "Seminar in Materials Science & Engineering",
      department: "MSE",
      category: "nme_restricted_option",
      label: "MSE 520",
    }),
    nmeOption({
      displayCourseCodes: ["MSE 560"],
      uwCourses: ["MSE 560"],
      credits: 3,
      title: "Organic Electronic and Photonic Materials/Polymers",
      department: "MSE",
      category: "nme_elective_option",
      label: "MSE 560",
    }),
  ];

  return buildParsedRequirementGroup({
    id: `${planId}:requirement-group:mse-nme-core-elective-19-credits`,
    label: "NME Option Core/Elective Requirement: 19 credits",
    category: "nme_core_elective",
    subcategory: "nme_core_elective_19_credits",
    requirementType: "choose_credits",
    minCredits: 19,
    sourceHeading,
    notes: [
      UW_MSE_NME_REPLACEMENT_REASON,
      "This replaces the standard 15-credit MSE technical elective requirement.",
      "Normal MSE technical elective rules are not the active requirement for this option unless the NME source explicitly permits overlap.",
      "NME core: NME 220 is required and must be taken in spring of sophomore or junior year.",
      "NME electives: choose 15 credits from approved NME elective courses.",
      "Quarter offerings listed in the UW source are subject to change.",
    ],
    options: nmeOptions.map((option) => ({
      id: `${planId}:requirement-option:nme-${slugify(
        [...(option.uwCourses ?? []), ...(option.equivalentUwCourseCodes ?? [])].join("-")
      )}`,
      ...option,
    })),
  });
}

function buildKnownMaterialsScienceRequirementCourses(owner, parsedRequirementGroups) {
  if (owner.planId !== "uw-seattle-materials-science-engineering") {
    return [];
  }

  return uniqueBy(
    [
      ...(owner.pathwayId ? [] : buildKnownMaterialsScienceRequiredRequirementCourses(owner)),
      ...buildParsedRequirementCoursesFromGroups(parsedRequirementGroups),
    ],
    (course) =>
      `${course.requirementGroupId}::${course.normalizedCourseCode}::${course.optionRole}`
  );
}

function buildKnownMaterialsScienceRequirementReplacements(owner) {
  if (
    owner.planId !== "uw-seattle-materials-science-engineering" ||
    owner.pathwayId !== "nme-option"
  ) {
    return [];
  }

  return [buildKnownMaterialsScienceNmeRequirementReplacement(owner.planId)];
}

function hasParsedCourseCodes(parsedCourseCodeSet, courseCodes) {
  return courseCodes.every((courseCode) => parsedCourseCodeSet.has(normalizeCourseCode(courseCode)));
}

function buildKnownMaterialsScienceRequirementGroups(owner, parsedCourseCodes) {
  if (owner.planId !== "uw-seattle-materials-science-engineering") {
    return [];
  }

  const parsedCourseCodeSet = new Set(parsedCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)));
  const planId = owner.planId;
  const groups = [];
  const addGroup = (group) => {
    const parsedGroup = buildParsedRequirementGroup(group);
    if (parsedGroup.options.length > 0) {
      groups.push(parsedGroup);
    }
  };

  if (hasParsedCourseCodes(parsedCourseCodeSet, ["AMATH 301", "CSE 142", "CSE 122"])) {
    addGroup({
      id: `${planId}:requirement-group:scientific-computing`,
      label: "Scientific computing",
      category: "engineering-fundamentals",
      requirementType: "choose_one",
      minCourses: 1,
      maxCourses: 1,
      options: [
        {
          id: `${planId}:requirement-option:amath-301`,
          uwCourses: ["AMATH 301"],
          credits: 4,
          label: "AMATH 301 - Beginning Scientific Computing",
        },
        {
          id: `${planId}:requirement-option:cse-142`,
          uwCourses: ["CSE 142"],
          credits: 4,
          label: "CSE 142 - Computer Programming I",
        },
        {
          id: `${planId}:requirement-option:cse-122`,
          uwCourses: ["CSE 122"],
          credits: 4,
          label: "CSE 122 - Intro to Computer Programming II",
        },
      ],
    });
  }

  if (parsedCourseCodeSet.has("MATH 207") || parsedCourseCodeSet.has("MATH 307")) {
    addGroup({
      id: `${planId}:requirement-group:math-207`,
      label: "MATH 207 Differential Equations",
      category: "mathematics",
      requirementType: "all_required",
      minCourses: 1,
      maxCourses: 1,
      options: [
        {
          id: `${planId}:requirement-option:math-207`,
          uwCourses: ["MATH 207"],
          equivalentUwCourseCodes: ["MATH 307"],
          credits: 3,
          label: "MATH 207 (or MATH 307)",
        },
      ],
    });
  }

  if (parsedCourseCodeSet.has("MATH 208") || parsedCourseCodeSet.has("MATH 308")) {
    addGroup({
      id: `${planId}:requirement-group:math-208`,
      label: "MATH 208 Matrix Algebra",
      category: "mathematics",
      requirementType: "all_required",
      minCourses: 1,
      maxCourses: 1,
      options: [
        {
          id: `${planId}:requirement-option:math-208`,
          uwCourses: ["MATH 208"],
          equivalentUwCourseCodes: ["MATH 308"],
          credits: 3,
          label: "MATH 208 (or MATH 308)",
        },
      ],
    });
  }

  const mathElectiveOptions = [
    {
      displayCourseCodes: ["IND E 315"],
      uwCourses: ["INDE 315"],
      title: "Probability and Statistics for Engineers",
      department: "INDE",
      label: "IND E 315",
      notes: ["IND E 315 may count in the Math elective category or the Engineering Fundamentals elective category, but not both."],
      constraints: ["no_double_count:math_elective_or_engineering_fundamentals"],
    },
    {
      displayCourseCodes: ["MATH 209"],
      uwCourses: ["MATH 209"],
      equivalentUwCourseCodes: ["MATH 309"],
      title: "Linear Analysis",
      label: "MATH 209 (or MATH 309)",
    },
    {
      displayCourseCodes: ["MATH 224"],
      uwCourses: ["MATH 224"],
      equivalentUwCourseCodes: ["MATH 324"],
      title: "Advanced Multivariable Calculus I",
      label: "MATH 224 (or MATH 324)",
    },
    { displayCourseCodes: ["MATH 318"], uwCourses: ["MATH 318"], title: "Advanced Linear Algebra Tools and Applications", label: "MATH 318" },
    { displayCourseCodes: ["STAT 390"], uwCourses: ["STAT 390"], title: "Probability and Statistics in Engineering & Science", credits: 4, label: "STAT 390" },
  ];
  if (mathElectiveOptions.length) {
    addGroup({
      id: `${planId}:requirement-group:math-elective`,
      label: "One (1) Math Elective",
      category: "math-elective",
      sourceHeading: "One (1) Math Elective",
      requirementType: "choose_n",
      minCourses: 1,
      maxCourses: 1,
      options: mathElectiveOptions.map((option, index) => ({
        id: `${planId}:requirement-option:math-elective-${index + 1}`,
        credits: option.credits ?? 3,
        creditText: String(option.credits ?? 3),
        sourceHeading: "One (1) Math Elective",
        sourceCategory: "Mathematics requirements",
        ...option,
      })),
    });
  }

  const scienceElectiveOptions = [
    { uwCourses: ["BIOL 180"], credits: 5, title: "Introductory Biology", label: "BIOL 180" },
    { uwCourses: ["BIOL 200"], credits: 5, title: "Introductory Biology", label: "BIOL 200" },
    {
      uwCourses: ["CHEM 162"],
      equivalentUwCourseCodes: ["CHEM 153", "CHEM 155"],
      credits: 5,
      title: "General Chemistry",
      label: "CHEM 162 (or CHEM 153 or CHEM 155)",
    },
    { uwCourses: ["CHEM 165"], credits: 5, title: "Honors General Chemistry", label: "CHEM 165" },
    { uwCourses: ["CHEM 223"], credits: 4, title: "Organic Chemistry - Short Program", label: "CHEM 223" },
    { uwCourses: ["CHEM 224"], credits: 4, title: "Organic Chemistry - Short Program", label: "CHEM 224" },
    { uwCourses: ["CHEM 237"], credits: 4, title: "Organic Chemistry", label: "CHEM 237" },
    { uwCourses: ["CHEM 238"], credits: 4, title: "Organic Chemistry", label: "CHEM 238" },
    { uwCourses: ["CHEM 312"], credits: 3, title: "Inorganic Chemistry", label: "CHEM 312", notes: ["Students who have completed CHEM 165 can have CHEM 312 waived. See adviser."] },
    { uwCourses: ["CHEM 317"], credits: 4, title: "Inorganic Chemistry Lab", label: "CHEM 317" },
    { uwCourses: ["CHEM 335"], credits: 4, title: "Honors Organic Chemistry", label: "CHEM 335" },
    { uwCourses: ["CHEM 336"], credits: 4, title: "Honors Organic Chemistry", label: "CHEM 336" },
    { uwCourses: ["CHEM 452"], credits: 3, title: "Physical Chemistry for Biochemists I", label: "CHEM 452" },
    { uwCourses: ["CHEM 455"], credits: 3, title: "Physical Chemistry", label: "CHEM 455" },
    { uwCourses: ["CHEM 456"], credits: 3, title: "Physical Chemistry", label: "CHEM 456" },
    { uwCourses: ["PHYS 224"], credits: 3, title: "Thermal Physics", label: "PHYS 224" },
    { uwCourses: ["PHYS 225"], credits: 3, title: "Introduction to Quantum Mechanics", label: "PHYS 225" },
    { uwCourses: ["PHYS 227"], credits: 4, title: "Elementary Mathematical Physics", label: "PHYS 227" },
    { uwCourses: ["PHYS 228"], credits: 4, title: "Elementary Mathematical Physics", label: "PHYS 228" },
  ];
  if (scienceElectiveOptions.length) {
    addGroup({
      id: `${planId}:requirement-group:science-electives`,
      label: "Two Science Electives",
      category: "science-elective",
      sourceHeading: "Two Science Electives",
      requirementType: "choose_n",
      minCourses: 2,
      maxCourses: 2,
      options: scienceElectiveOptions.map((option) => ({
        id: `${planId}:requirement-option:science-elective-${slugify(
          [...option.uwCourses, ...(option.equivalentUwCourseCodes ?? [])].join("-")
        )}`,
        creditText: String(option.credits),
        sourceHeading: "Two Science Electives",
        sourceCategory: "Natural Science requirements",
        ...option,
      })),
    });
  }

  const engineeringFundamentalOptions = [
    { displayCourseCodes: ["AA 260"], uwCourses: ["AA 260"], credits: 4, title: "Thermodynamics", department: "AA", label: "AA 260" },
    { displayCourseCodes: ["BIOEN 215"], uwCourses: ["BIOEN 215"], credits: 3, title: "Introduction to Bioengineering Problem Solving", department: "BIOEN", label: "BIOEN 215" },
    { displayCourseCodes: ["BSE 201"], uwCourses: ["BSE 201"], credits: 3, title: "Introduction to Pulp, Paper, and Bioproducts", department: "BSE", label: "BSE 201" },
    { displayCourseCodes: ["CHEM E 355"], uwCourses: ["CHEME 355"], credits: 3, title: "Biological Frameworks for Engineers", department: "CHEME", label: "CHEM E 355" },
    { displayCourseCodes: ["CSE 123"], uwCourses: ["CSE 123"], credits: 4, title: "Computer Programming III", department: "CSE", label: "CSE 123" },
    { displayCourseCodes: ["CSE 143"], uwCourses: ["CSE 143"], credits: 4, title: "Computer Programming II", department: "CSE", label: "CSE 143" },
    { displayCourseCodes: ["CSE 160"], uwCourses: ["CSE 160"], credits: 4, title: "Data Programming", department: "CSE", label: "CSE 160" },
    { displayCourseCodes: ["CSE 164"], uwCourses: ["CSE 164"], credits: 4, title: "Intermediate Data Programming", department: "CSE", label: "CSE 164" },
    { displayCourseCodes: ["CSE 180"], uwCourses: ["CSE 180"], credits: 4, title: "Introduction to Data Science", department: "CSE", label: "CSE 180" },
    { displayCourseCodes: ["E E 215"], uwCourses: ["EE 215"], credits: 4, title: "Fundamentals of Electrical Engineering", department: "EE", label: "E E 215" },
    { displayCourseCodes: ["ENGR 101"], uwCourses: ["ENGR 101"], credits: 1, title: "Engineering Exploration", department: "ENGR", label: "ENGR 101", notes: ["Open to DTC students only."] },
    { displayCourseCodes: ["ENGR 333"], uwCourses: ["ENGR 333"], credits: 4, title: "Advanced Technical Communication in the Engineering Workplace", department: "ENGR", label: "ENGR 333" },
    { displayCourseCodes: ["ENGR 490"], uwCourses: ["ENGR 490"], credits: 2, title: "Engineering Leadership", department: "ENGR", label: "ENGR 490" },
    { displayCourseCodes: ["IND E 250"], uwCourses: ["INDE 250"], credits: 4, title: "Engineering Economy", department: "INDE", label: "IND E 250" },
    {
      displayCourseCodes: ["IND E 315"],
      uwCourses: ["INDE 315"],
      credits: 3,
      title: "Probability and Statistics for Engineers",
      department: "INDE",
      label: "IND E 315",
      constraints: ["no_double_count:math_elective_or_engineering_fundamentals"],
      notes: ["IND E 315 may count in the Math elective category or the Engineering Fundamentals elective category, but not both."],
    },
    { displayCourseCodes: ["M E 123"], uwCourses: ["ME 123"], credits: 4, title: "Intro to Visualization & Computer-Aided Design", department: "ME", label: "M E 123" },
    { displayCourseCodes: ["M E 230"], uwCourses: ["ME 230"], credits: 4, title: "Kinematics and Dynamics", department: "ME", label: "M E 230" },
    {
      displayCourseCodes: ["NME 220"],
      uwCourses: ["NME 220"],
      credits: 4,
      title: "Introduction to Molecular and Nanoscale Principles",
      department: "NME",
      label: "NME 220",
      constraints: ["not_eligible_for_nme_option"],
      notes: ["NME 220 is not eligible as an Engineering Fundamentals elective for NME Option students."],
    },
  ];
  if (engineeringFundamentalOptions.length) {
    addGroup({
      id: `${planId}:requirement-group:engineering-fundamentals-electives`,
      label: "8 Credits of Engineering Fundamentals Electives",
      category: "engineering_fundamentals",
      subcategory: "engineering_fundamentals_electives",
      requirementType: "choose_credits",
      minCredits: 8,
      sourceHeading: "8 Credits of Engineering Fundamentals Electives selected from the following list",
      notes: [
        "IND E 315 may count in the Math elective category or the Engineering Fundamentals elective category, but not both.",
        "NME 220 is not eligible as an Engineering Fundamentals elective for NME Option students.",
      ],
      options: engineeringFundamentalOptions.map((option) => ({
        id: `${planId}:requirement-option:engineering-fundamentals-${slugify(option.uwCourses.join("-"))}`,
        creditText: String(option.credits),
        sourceHeading: "8 Credits of Engineering Fundamentals Electives selected from the following list",
        sourceCategory: "Engineering Fundamentals requirements",
        ...option,
      })),
    });
  }

  const mseTechnicalElectiveOptions = [
    { uwCourses: ["MSE 450"], credits: 3, title: "Magnetism, Magnetic Materials, and Related Technologies" },
    { uwCourses: ["MSE 452"], credits: 3, title: "Functional Properties of Materials II" },
    { uwCourses: ["MSE 462"], credits: 3, title: "Mechanical Behavior of Materials II" },
    { uwCourses: ["MSE 463"], credits: 3, title: "Corrosion and Wear of Materials" },
    { uwCourses: ["MSE 466"], credits: 3, title: "Energy Materials, Devices, and Systems" },
    { uwCourses: ["MSE 471"], credits: 3, title: "Introduction to Polymer Science and Engineering" },
    { uwCourses: ["MSE 473"], credits: 3, title: "Noncrystalline State" },
    { uwCourses: ["MSE 474"], credits: 3, title: "Nanocomposite Materials" },
    { uwCourses: ["MSE 475"], credits: 3, title: "Intro to Composite Materials" },
    { uwCourses: ["MSE 476"], credits: 3, title: "Introduction to Optoelectronic Materials" },
    { uwCourses: ["MSE 477"], credits: 3, title: "Data Science and Materials Informatics" },
    { uwCourses: ["MSE 478"], credits: 3, title: "Material and Device Modeling" },
    { uwCourses: ["MSE 479"], credits: 3, title: "Big Data for Materials Science" },
    { uwCourses: ["MSE 481"], credits: 3, title: "Science and Technology of Nanostructures" },
    { uwCourses: ["MSE 482"], credits: 3, title: "Biomaterials/Nanomaterials in Tissue Engineering" },
    { uwCourses: ["MSE 483"], credits: 3, title: "Nanomedicine" },
    { uwCourses: ["MSE 484"], credits: 3, title: "Electronic and Optoelectronic Polymers" },
    { uwCourses: ["MSE 486"], credits: 3, title: "Fundamentals of Integrated Circuit Technology" },
    { uwCourses: ["MSE 487"], credits: 3, title: "Composites Engineering, Production, and Maintenance" },
    { uwCourses: ["MSE 488"], credits: 3, title: "Materials In Manufacturing" },
    { uwCourses: ["MSE 489"], credits: 3, title: "Additive Manufacturing: Materials, Processes, and Applications" },
    { uwCourses: ["MSE 490"], credits: 3, title: "Composite Materials in Manufacturing" },
    { uwCourses: ["MSE 498"], credits: 3, creditMin: 3, creditMax: 4, creditText: "3-4", title: "Special Topics" },
    { uwCourses: ["MSE 499"], credits: 3, creditMin: 3, creditMax: 5, creditText: "3-5", title: "Senior Project" },
  ].map((option) => ({
    displayCourseCodes: option.uwCourses,
    department: "MSE",
    label: option.uwCourses[0],
    ...option,
  }));
  if (mseTechnicalElectiveOptions.length) {
    addGroup({
      id: `${planId}:requirement-group:mse-400-level-technical-electives`,
      label: "MSE 400-level Technical Electives",
      category: "technical_electives",
      subcategory: "mse_400_level",
      requirementType: "choose_credits",
      minCredits: 6,
      sourceHeading: "A minimum of 6 credits in MSE 400-level courses listed below are required",
      notes: ["MSE 500-level courses, except seminar, may satisfy the MSE technical elective minimum."],
      options: mseTechnicalElectiveOptions.map((option) => ({
        id: `${planId}:requirement-option:mse-technical-elective-${slugify(option.uwCourses.join("-"))}`,
        creditText: option.creditText ?? String(option.credits),
        sourceHeading: "A minimum of 6 credits in MSE 400-level courses listed below are required",
        sourceCategory: "Technical electives: 15 credits total",
        ...option,
      })),
    });
  }

  const outsideMseTechnicalElectiveOptions = [
    { displayCourseCodes: ["A MATH 352"], uwCourses: ["AMATH 352"], credits: 3, department: "AMATH", title: "Applied Linear Algebra & Numerical Analysis", label: "A MATH 352" },
    { displayCourseCodes: ["A MATH 353"], uwCourses: ["AMATH 353"], credits: 3, department: "AMATH", title: "Partial Differential Equations and Waves", label: "A MATH 353" },
    { displayCourseCodes: ["A MATH 383"], uwCourses: ["AMATH 383"], credits: 3, department: "AMATH", title: "Introduction to Continuous Math Modeling", label: "A MATH 383" },
    { displayCourseCodes: ["A MATH 401"], uwCourses: ["AMATH 401"], credits: 3, department: "AMATH", title: "Vector Calculus and Complex Variables", label: "A MATH 401" },
    { displayCourseCodes: ["A MATH 403"], uwCourses: ["AMATH 403"], credits: 3, department: "AMATH", title: "Methods for Partial Differential Equations", label: "A MATH 403" },
    { displayCourseCodes: ["BIOC 405"], uwCourses: ["BIOC 405"], credits: 3, department: "BIOC", title: "Introduction to Biochemistry", label: "BIOC 405" },
    { displayCourseCodes: ["BIOC 406"], uwCourses: ["BIOC 406"], credits: 3, department: "BIOC", title: "Introduction to Biochemistry", label: "BIOC 406" },
    { displayCourseCodes: ["CHEM 312"], uwCourses: ["CHEM 312"], credits: 3, department: "CHEM", title: "Inorganic Chemistry", label: "CHEM 312" },
    { displayCourseCodes: ["CHEM 455"], uwCourses: ["CHEM 455"], credits: 3, department: "CHEM", title: "Physical Chemistry", label: "CHEM 455" },
    { displayCourseCodes: ["CHEM 456"], uwCourses: ["CHEM 456"], credits: 3, department: "CHEM", title: "Physical Chemistry", label: "CHEM 456" },
    { displayCourseCodes: ["CHEM 457"], uwCourses: ["CHEM 457"], credits: 3, department: "CHEM", title: "Physical Chemistry", label: "CHEM 457" },
    { displayCourseCodes: ["CHEM E 341"], uwCourses: ["CHEME 341"], credits: 3, department: "CHEME", title: "Energy and Environment", label: "CHEM E 341" },
    {
      displayCourseCodes: ["ENGR 321"],
      uwCourses: ["ENGR 321"],
      credits: 2,
      creditMin: 1,
      creditMax: 2,
      creditText: "1-2",
      maxCredits: 4,
      department: "ENGR",
      title: "Engineering Internship",
      label: "ENGR 321",
      constraints: ["max_degree_counting_credits:4"],
      notes: ["ENGR 321 can count a maximum of 4 credits toward the degree."],
    },
    { displayCourseCodes: ["ENVIR 480"], uwCourses: ["ENVIR 480"], credits: 5, department: "ENVIR", title: "Sustainability Studio", label: "ENVIR 480" },
    { displayCourseCodes: ["PHYS 321"], uwCourses: ["PHYS 321"], credits: 4, department: "PHYS", title: "Electromagnetism", label: "PHYS 321" },
    { displayCourseCodes: ["PHYS 324"], uwCourses: ["PHYS 324"], credits: 4, department: "PHYS", title: "Quantum Mechanics", label: "PHYS 324" },
    { displayCourseCodes: ["PHYS 325"], uwCourses: ["PHYS 325"], credits: 4, department: "PHYS", title: "Quantum Mechanics", label: "PHYS 325" },
    { displayCourseCodes: ["PHYS 334"], uwCourses: ["PHYS 334"], credits: 3, department: "PHYS", title: "Electric Circuits Laboratory", label: "PHYS 334" },
    { displayCourseCodes: ["PHYS 335"], uwCourses: ["PHYS 335"], credits: 3, department: "PHYS", title: "Electric Circuits Laboratory", label: "PHYS 335" },
    { displayCourseCodes: ["PHYS 434"], uwCourses: ["PHYS 434"], credits: 3, department: "PHYS", title: "Application of Computers to Physical Measurement", label: "PHYS 434" },
    { displayCourseCodes: ["PHYS 441"], uwCourses: ["PHYS 441"], credits: 4, department: "PHYS", title: "Quantum Mechanics", label: "PHYS 441" },
    { displayCourseCodes: ["ENTRE 370"], uwCourses: ["ENTRE 370"], credits: 4, department: "ENTRE", title: "Introduction to Entrepreneurship", label: "ENTRE 370" },
    { displayCourseCodes: ["ENTRE 440"], uwCourses: ["ENTRE 440"], credits: 2, department: "ENTRE", title: "Business Plan Practicum", label: "ENTRE 440" },
  ];
  if (outsideMseTechnicalElectiveOptions.length) {
    addGroup({
      id: `${planId}:requirement-group:outside-mse-technical-electives`,
      label: "Outside-MSE Technical Electives",
      category: "technical_electives",
      subcategory: "outside_mse_approved",
      requirementType: "choose_credits",
      maxCredits: 9,
      sourceHeading: "A maximum of 9 credits in 400-level courses in the following departments will satisfy the technical electives requirement",
      notes: [
        "A maximum of 9 credits in approved outside-MSE courses may satisfy the technical electives requirement.",
        "500-level courses from approved outside departments may satisfy the outside technical elective requirement, but require adviser or manual audit update.",
        "Any outside course not listed requires a Course Substitution Petition Form.",
      ],
      options: outsideMseTechnicalElectiveOptions.map((option) => ({
        id: `${planId}:requirement-option:outside-mse-technical-elective-${slugify(option.uwCourses.join("-"))}`,
        creditText: option.creditText ?? String(option.credits),
        sourceHeading: "A maximum of 9 credits in 400-level courses in the following departments will satisfy the technical electives requirement",
        sourceCategory: "Other technical electives",
        ...option,
      })),
    });
  }

  if (owner.pathwayId === "nme-option" && parsedCourseCodeSet.has("NME 220")) {
    addGroup(buildKnownMaterialsScienceNmeOptionGroup(planId));
  }

  return groups;
}

function isEquivalentNumberAliasLine(line, courseCodes) {
  if (courseCodes.length !== 2) {
    return false;
  }

  const normalizedLine = normalizeWhitespace(line);
  if (!/\b(?:formerly|renumbered|equivalent|students can apply either)\b/i.test(normalizedLine)) {
    return /\(\s*or\s+[A-Z]{2,8}\s+\d{3}/i.test(normalizedLine) || /[A-Z]{2,8}\s+\d{3}\s*\/\s*\d{3}/i.test(normalizedLine);
  }

  return true;
}

function buildGenericChoiceRequirementGroups(owner, parsedCourseCodes, snapshotLines) {
  const parsedCourseCodeSet = new Set(parsedCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)));
  const seenGroupIds = new Set();
  const groups = [];

  for (const line of snapshotLines ?? []) {
    const normalizedLine = normalizeWhitespace(line);
    if (!/\bor\b/i.test(normalizedLine)) {
      continue;
    }

    const courseCodes = extractCourseCodesFromLine(normalizedLine).filter((courseCode) =>
      parsedCourseCodeSet.has(courseCode)
    );
    if (courseCodes.length < 2) {
      continue;
    }

    const credits = parseRequirementCreditAmount(normalizedLine);
    let group;
    if (isEquivalentNumberAliasLine(normalizedLine, courseCodes)) {
      group = buildParsedRequirementGroup({
        id: `${owner.ownerId}:requirement-group:${slugify(courseCodes.join("-"))}`,
        label: courseCodes.join(" / "),
        category: "course-alias",
        requirementType: "all_required",
        minCourses: 1,
        maxCourses: 1,
        options: [
          {
            id: `${owner.ownerId}:requirement-option:${slugify(courseCodes.join("-"))}`,
            uwCourses: [courseCodes[0]],
            equivalentUwCourseCodes: courseCodes.slice(1),
            credits,
            label: normalizedLine,
          },
        ],
      });
    } else {
      group = buildParsedRequirementGroup({
        id: `${owner.ownerId}:requirement-group:${slugify(courseCodes.join("-or-"))}`,
        label: normalizedLine.length <= 120 ? normalizedLine : courseCodes.join(" or "),
        category: "source-choice",
        requirementType: "choose_one",
        minCourses: 1,
        maxCourses: 1,
        options: courseCodes.map((courseCode) => ({
          id: `${owner.ownerId}:requirement-option:${slugify(courseCode)}`,
          uwCourses: [courseCode],
          credits,
          label: courseCode,
        })),
      });
    }

    if (!group.options.length || seenGroupIds.has(group.id)) {
      continue;
    }
    seenGroupIds.add(group.id);
    groups.push(group);
  }

  return groups;
}

function buildParsedRequirementGroups(owner, parsedCourseCodes, snapshotLines) {
  const knownGroups = buildKnownMaterialsScienceRequirementGroups(owner, parsedCourseCodes);
  if (owner.planId === "uw-seattle-materials-science-engineering") {
    return knownGroups;
  }

  return uniqueBy(
    [
      ...knownGroups,
      ...buildGenericChoiceRequirementGroups(owner, parsedCourseCodes, snapshotLines),
    ],
    (group) => group.id
  );
}

function normalizeMatcherText(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getTitleScopeTokens(entry) {
  const STOPWORDS = new Set([
    "and",
    "arts",
    "bachelor",
    "bothell",
    "campus",
    "catalog",
    "degree",
    "major",
    "of",
    "official",
    "overview",
    "page",
    "program",
    "requirements",
    "science",
    "seattle",
    "studies",
    "tacoma",
    "the",
    "university",
    "uw",
    "washington",
  ]);

  return uniqueSorted(
    normalizeMatcherText(`${entry.ownerTitle ?? ""} ${entry.sourceLabel ?? ""}`)
      .split(" ")
      .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
  ).slice(0, 8);
}

const PRIMARY_MAJOR_TITLES_BY_PLAN_ID = new Map(
  TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
    (entry) => entry.ownerType === "major" && entry.planId && entry.ownerTitle
  ).map((entry) => [entry.planId, normalizeTransferPlannerText(entry.ownerTitle)])
);

function getPrimaryMajorTitle(entry) {
  return normalizeTransferPlannerText(
    PRIMARY_MAJOR_TITLES_BY_PLAN_ID.get(entry.planId) ?? entry.ownerTitle ?? ""
  );
}

function getOwnerSearchableText(entry) {
  return normalizeMatcherText(
    `${entry.ownerTitle ?? ""} ${entry.label ?? ""} ${entry.sourceLabel ?? ""}`
  );
}

function getBaseRouteOwnerAliasTokens(entry) {
  const ownerSearchableText = getOwnerSearchableText(entry);
  if (
    !ownerSearchableText ||
    !/\b(standard|default|base)\b/.test(ownerSearchableText) ||
    !/\b(route|pathway|option)\b/.test(ownerSearchableText)
  ) {
    return [];
  }

  return getTitleScopeTokens(entry).filter(
    (token) => !["base", "default", "option", "pathway", "route", "standard"].includes(token)
  );
}

function lineIntroducesDifferentOwnerDescriptor(entry, normalizedLine) {
  const ownerSearchableText = getOwnerSearchableText(entry);
  if (!ownerSearchableText) {
    return false;
  }

  if (
    (entry.ownerType === "major" || entry.ownerType === "pathway") &&
    /\b(minor|master|doctor|graduate)\b/.test(normalizedLine)
  ) {
    return true;
  }

  if (/\bdata science\b/.test(normalizedLine) && !ownerSearchableText.includes("data science")) {
    return true;
  }

  const descriptorMatch = normalizedLine.match(/:\s*([a-z0-9][a-z0-9 -]{0,80})$/);
  const descriptor = normalizeMatcherText(descriptorMatch?.[1] ?? "");
  if (
    descriptor &&
    /\b(data science|track|option|route|pathway|concentration|specialization)\b/.test(
      descriptor
    ) &&
    !ownerSearchableText.includes(descriptor)
  ) {
    return true;
  }

  return false;
}

function isLikelyOwnerHtmlSectionStartLine(entry, line) {
  const normalizedLine = normalizeMatcherText(line);
  if (!normalizedLine || !HTML_SECTION_BOUNDARY_LINE_PATTERN.test(normalizeWhitespace(line))) {
    return false;
  }
  if (lineIntroducesDifferentOwnerDescriptor(entry, normalizedLine)) {
    return false;
  }

  const titleTokens = getTitleScopeTokens(entry);
  if (!titleTokens.length) {
    return false;
  }

  const exactTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  const tokenMatches = titleTokens.filter((token) => normalizedLine.includes(token)).length;
  const minimumTokenMatches = Math.max(1, Math.min(2, titleTokens.length));

  return Boolean(
    (exactTitle && normalizedLine.includes(exactTitle)) || tokenMatches >= minimumTokenMatches
  );
}

function findOwnerHtmlSectionRange(entry, lines, anchorIndex) {
  const backwardLimit = Math.max(0, anchorIndex - 80);
  let sectionStartIndex = null;

  for (let index = anchorIndex; index >= backwardLimit; index -= 1) {
    const line = normalizeWhitespace(lines[index]);
    if (!line) {
      continue;
    }
    if (isLikelyOwnerHtmlSectionStartLine(entry, line)) {
      sectionStartIndex = index;
      break;
    }
    if (/^Back to Top\b/i.test(line)) {
      break;
    }
  }

  if (sectionStartIndex === null) {
    return null;
  }

  let sectionEndIndex = Math.min(lines.length - 1, sectionStartIndex + 80);
  const forwardLimit = Math.min(lines.length - 1, sectionStartIndex + 220);

  for (let index = sectionStartIndex + 1; index <= forwardLimit; index += 1) {
    const line = normalizeWhitespace(lines[index]);
    if (!line) {
      continue;
    }
    if (/^Back to Top\b/i.test(line)) {
      sectionEndIndex = Math.max(sectionStartIndex, index - 1);
      break;
    }
    if (
      HTML_SECTION_BOUNDARY_LINE_PATTERN.test(line) &&
      !isLikelyOwnerHtmlSectionStartLine(entry, line)
    ) {
      sectionEndIndex = Math.max(sectionStartIndex, index - 1);
      break;
    }
  }

  return {
    startIndex: Math.max(0, sectionStartIndex - 2),
    endIndex: Math.max(sectionStartIndex, sectionEndIndex),
  };
}

function buildPdfPageLineTexts(textContent) {
  const positionedItems = (textContent?.items ?? [])
    .map((item) => {
      const text = normalizeWhitespace(item.str);
      if (!text) {
        return null;
      }

      const transform = Array.isArray(item.transform) ? item.transform : [];
      return {
        text,
        x: Number(transform[4] ?? 0),
        y: Number(transform[5] ?? 0),
        height: Number(item.height ?? 0),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (Math.abs(right.y - left.y) > 2.5) {
        return right.y - left.y;
      }
      return left.x - right.x;
    });

  if (!positionedItems.length) {
    return [];
  }

  const lineGroups = [];

  for (const item of positionedItems) {
    const currentLine = lineGroups[lineGroups.length - 1];
    const lineTolerance = currentLine
      ? Math.max(2.5, Math.min(6, Math.max(currentLine.maxHeight, item.height) * 0.45))
      : 0;

    if (!currentLine || Math.abs(currentLine.y - item.y) > lineTolerance) {
      lineGroups.push({
        y: item.y,
        maxHeight: item.height,
        items: [item],
      });
      continue;
    }

    currentLine.items.push(item);
    currentLine.maxHeight = Math.max(currentLine.maxHeight, item.height);
  }

  return lineGroups
    .map((group) =>
      normalizeWhitespace(group.items.sort((left, right) => left.x - right.x).map((item) => item.text).join(" "))
    )
    .filter(Boolean);
}

function scopePdfPageBlocks(entry, pageBlocks) {
  const titleTokens = getTitleScopeTokens(entry);
  if (!titleTokens.length || pageBlocks.length <= 2) {
    return pageBlocks;
  }

  const exactTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  const scoredPageIndexes = pageBlocks
    .map((block, index) => ({
      index,
      score: (() => {
        const normalizedLine = normalizeMatcherText(block.pageText);
        const tokenScore = titleTokens.filter((token) => normalizedLine.includes(token)).length;
        const exactTitleScore = exactTitle && normalizedLine.includes(exactTitle) ? 10 : 0;
        const requirementSignalScore =
          (
            normalizedLine.match(
              /\b(requirements?|credits?|courses?|major|minor|curriculum|prerequisite)\b/g
            ) ?? []
          ).length;

        return exactTitleScore + tokenScore * 2 + requirementSignalScore;
      })(),
    }))
    .filter((entryScore) => entryScore.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  if (!scoredPageIndexes.length) {
    return pageLines;
  }

  const bestScore = scoredPageIndexes[0].score;
  const bestPageIndex = scoredPageIndexes[0].index;
  const matchingIndexes = scoredPageIndexes
    .filter(
      (entryScore) =>
        Math.abs(entryScore.index - bestPageIndex) <= 1 &&
        entryScore.score >= Math.max(4, bestScore - 2)
    )
    .map((entryScore) => entryScore.index);

  if (!matchingIndexes.length) {
    return pageBlocks;
  }

  const startIndex = Math.max(0, Math.min(...matchingIndexes) - 1);
  const endIndex = Math.min(pageBlocks.length - 1, Math.max(...matchingIndexes) + 1);
  return pageBlocks.slice(startIndex, endIndex + 1);
}

function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRequestedUrlAnchor(url) {
  try {
    const hash = new URL(String(url ?? "")).hash;
    if (!hash) {
      return null;
    }
    return decodeURIComponent(hash.slice(1)).trim() || null;
  } catch {
    const match = String(url ?? "").match(/#(.+)$/);
    return match ? decodeURIComponent(match[1]).trim() || null : null;
  }
}

function findCatalogAnchorTag(html, anchor) {
  if (!anchor) {
    return null;
  }

  const escapedAnchor = escapeRegex(anchor);
  const patterns = [
    new RegExp(`<[^>]+\\b(?:id|name)=(["'])${escapedAnchor}\\1[^>]*>`, "i"),
    new RegExp(`<[^>]+\\bdata-expand=(["'])[^"']*${escapedAnchor}[^"']*\\1[^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (!match) {
      continue;
    }
    return {
      index: match.index,
      endIndex: match.index + match[0].length,
      tagHtml: match[0],
      heading: stripHtml(match[0]),
    };
  }

  return null;
}

function findNextCatalogPeerBoundary(html, searchStartIndex) {
  const boundaryPattern =
    /<(?:(?:h[23]\b[^>]*\bid=(["'])program-[^"']+\1[^>]*>[\s\S]*?<\/h[23]>)|(?:div\b[^>]*\bclass=(["'])[^"']*\bexpandableGroup\b[^"']*\2[^>]*\bdata-expand=(["'])program-[^"']+\3[^>]*>))/gi;
  boundaryPattern.lastIndex = Math.max(0, searchStartIndex);
  const match = boundaryPattern.exec(html);

  if (!match) {
    return {
      index: html.length,
      label: "end of document",
    };
  }

  return {
    index: match.index,
    label: stripHtml(match[0]) || normalizeWhitespace(match[0]).slice(0, 120),
  };
}

function collectIgnoredCatalogNeighboringSections(html, searchStartIndex) {
  const ignored = [];
  const boundaryPattern =
    /<h[23]\b[^>]*\bid=(["'])program-[^"']+\1[^>]*>([\s\S]*?)<\/h[23]>/gi;
  boundaryPattern.lastIndex = Math.max(0, searchStartIndex);

  for (const match of html.matchAll(boundaryPattern)) {
    if (match.index < searchStartIndex) {
      continue;
    }
    const heading = stripHtml(match[2]);
    if (heading) {
      ignored.push(heading);
    }
    if (ignored.length >= 6) {
      break;
    }
  }

  return ignored;
}

function catalogSectionMatchesSelectedMajor(entry, sectionHeading, sectionLines) {
  const scopedText = normalizeMatcherText(
    [sectionHeading, ...(sectionLines ?? []).slice(0, 20)].filter(Boolean).join(" ")
  );
  const exactTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  if (exactTitle && scopedText.includes(exactTitle)) {
    return true;
  }

  const titleTokens = getTitleScopeTokens(entry);
  if (!titleTokens.length) {
    return false;
  }

  const tokenMatches = titleTokens.filter((token) => scopedText.includes(token)).length;
  return tokenMatches >= Math.max(1, Math.min(2, titleTokens.length));
}

function buildSourceSectionAudit(input) {
  return {
    line: [
      "[source section audit]",
      `Major id: ${input.majorId ?? "unknown"}`,
      `Source URL: ${input.sourceUrl ?? "n/a"}`,
      `Source role: ${input.sourceRole ?? "ignored"}`,
      `Requested anchor: ${input.requestedAnchor ?? "none"}`,
      `Anchor found: ${input.anchorFound ? "yes" : "no"}`,
      `Section heading: ${input.sectionHeading ?? "n/a"}`,
      `Section matched selected major: ${input.sectionMatchedSelectedMajor ? "yes" : "no"}`,
      `Stop boundary: ${input.stopBoundary ?? "n/a"}`,
      `Ignored neighboring sections: ${
        (input.ignoredNeighboringSections ?? []).length
          ? input.ignoredNeighboringSections.join(" | ")
          : "none"
      }`,
    ].join(" "),
    ...input,
  };
}

function scopeCatalogHtmlByAnchor(entry, html) {
  if (!isLegacyStudentCatalogSource(entry)) {
    return null;
  }

  const sourceRole = classifyRequirementSourceRole(entry);
  const requestedAnchor = getRequestedUrlAnchor(entry.url);
  if (!requestedAnchor) {
    return null;
  }

  const anchorMatch = findCatalogAnchorTag(html, requestedAnchor);
  if (!anchorMatch) {
    return {
      scoped: false,
      sectionAudit: buildSourceSectionAudit({
        majorId: entry.planId,
        sourceUrl: entry.url,
        sourceRole,
        requestedAnchor,
        anchorFound: false,
        sectionHeading: null,
        sectionMatchedSelectedMajor: false,
        stopBoundary: "fallback to scored HTML scope",
        ignoredNeighboringSections: [],
      }),
    };
  }

  const stopBoundary = findNextCatalogPeerBoundary(html, anchorMatch.endIndex);
  const sectionHtml = html.slice(anchorMatch.index, stopBoundary.index);
  const sectionLines = buildHtmlLines(sectionHtml);
  const sectionHeadings = extractHeadings(sectionHtml);
  const sectionHeading = sectionHeadings[0] || anchorMatch.heading || null;
  const ignoredNeighboringSections = collectIgnoredCatalogNeighboringSections(
    html,
    stopBoundary.index
  );

  return {
    scoped: true,
    lines: sectionLines,
    headings: sectionHeadings,
    sectionAudit: buildSourceSectionAudit({
      majorId: entry.planId,
      sourceUrl: entry.url,
      sourceRole,
      requestedAnchor,
      anchorFound: true,
      sectionHeading,
      sectionMatchedSelectedMajor: catalogSectionMatchesSelectedMajor(
        entry,
        sectionHeading,
        sectionLines
      ),
      stopBoundary: stopBoundary.label,
      ignoredNeighboringSections,
    }),
  };
}

function scopeHtmlLines(entry, title, headings, lines) {
  const titleTokens = getTitleScopeTokens(entry);
  if (!titleTokens.length || lines.length <= 20) {
    return lines;
  }

  const useOwnerSectionScoping = isLegacyStudentCatalogSource(entry);
  const exactTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  const normalizedHeadings = new Set((headings ?? []).map((heading) => normalizeWhitespace(heading)));
  const scoredLineIndexes = lines
    .map((line, index) => ({
      index,
      score: (() => {
        const normalizedLine = normalizeMatcherText(line);
        const tokenScore = titleTokens.filter((token) => normalizedLine.includes(token)).length;
        const exactTitleScore = exactTitle && normalizedLine.includes(exactTitle) ? 10 : 0;
        const headingScore = normalizedHeadings.has(line) ? 2 : 0;
        const ownerSectionStartBonus =
          useOwnerSectionScoping && isLikelyOwnerHtmlSectionStartLine(entry, line) ? 10 : 0;
        const otherSectionBoundaryPenalty =
          useOwnerSectionScoping &&
          HTML_SECTION_BOUNDARY_LINE_PATTERN.test(line) &&
          !isLikelyOwnerHtmlSectionStartLine(entry, line)
            ? 4
            : 0;
        const requirementSignalScore =
          (
            normalizedLine.match(
              /\b(requirements?|credits?|courses?|major|minor|curriculum|prerequisite|elective|option|track|pathway|concentration)\b/g
            ) ?? []
          ).length;
        const transferNoisePenalty = TRANSFER_CREDIT_NOISE_PATTERN.test(line) ? 8 : 0;

        return (
          exactTitleScore +
          tokenScore * 2 +
          headingScore +
          ownerSectionStartBonus +
          requirementSignalScore -
          otherSectionBoundaryPenalty -
          transferNoisePenalty
        );
      })(),
    }))
    .filter((entryScore) => entryScore.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  if (!scoredLineIndexes.length) {
    return lines;
  }

  const bestScore = scoredLineIndexes[0].score;
  const bestLineIndex = scoredLineIndexes[0].index;
  const matchingIndexes = scoredLineIndexes
    .filter(
      (entryScore) =>
        Math.abs(entryScore.index - bestLineIndex) <= 40 &&
        entryScore.score >= Math.max(3, bestScore - 3)
    )
    .map((entryScore) => entryScore.index);

  if (!matchingIndexes.length) {
    return lines;
  }

  const ownerSectionRange = useOwnerSectionScoping
    ? findOwnerHtmlSectionRange(entry, lines, bestLineIndex)
    : null;
  const startIndex = ownerSectionRange
    ? ownerSectionRange.startIndex
    : Math.max(0, Math.min(...matchingIndexes) - 6);
  const initialEndIndex = ownerSectionRange
    ? ownerSectionRange.endIndex
    : Math.min(lines.length - 1, Math.max(...matchingIndexes) + 24);
  const scopedTableTailText = normalizeMatcherText(
    lines.slice(Math.max(startIndex, initialEndIndex - 16), initialEndIndex + 1).join(" ")
  );
  let endIndex = initialEndIndex;

  if (
    !ownerSectionRange &&
    /\b(course #|course name|credits?|cr\.?|electives?|offered|prereq|prerequisite)\b/.test(
      scopedTableTailText
    )
  ) {
    const continuationTail = lines.slice(
      initialEndIndex + 1,
      Math.min(lines.length, initialEndIndex + 121)
    );
    let continuationCourseCount = 0;
    let quietLineCount = 0;

    for (let offset = 0; offset < continuationTail.length; offset += 1) {
      const line = normalizeWhitespace(continuationTail[offset]);
      if (!line) {
        continue;
      }

      const lineCourseCodes = extractCourseCodesFromLine(line);
      const hasTableSignal = /\b(course #|course name|credits?|cr\.?|electives?|offered|prereq|prerequisite)\b/i.test(
        line
      );

      if (
        continuationCourseCount >= 4 &&
        HTML_SECTION_BOUNDARY_LINE_PATTERN.test(line) &&
        !hasTableSignal
      ) {
        break;
      }

      if (lineCourseCodes.length > 0 || hasTableSignal) {
        continuationCourseCount += lineCourseCodes.length;
        quietLineCount = 0;
        endIndex = initialEndIndex + offset + 1;
        continue;
      }

      if (continuationCourseCount === 0) {
        if (offset >= 2) {
          break;
        }
        continue;
      }

      quietLineCount += 1;
      endIndex = initialEndIndex + offset + 1;
      if (quietLineCount >= 8) {
        break;
      }
    }

    if (continuationCourseCount < 4) {
      endIndex = initialEndIndex;
    }
  }

  const scopedLines = lines.slice(startIndex, endIndex + 1);

  if (scopedLines.length < 12 && title) {
    return [title, ...scopedLines];
  }

  return scopedLines;
}

function getStructuredDegreeMapBlocksForOwner(owner) {
  return TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY.filter(
    (block) =>
      block.planId === owner.planId &&
      (block.pathwayId === (owner.pathwayId ?? null) ||
        (owner.pathwayId && block.pathwayId == null) ||
        (!owner.pathwayId && block.pathwayId == null))
  );
}

function getBlockTitleTokens(title) {
  const STOPWORDS = new Set([
    "and",
    "arts",
    "baseline",
    "culture",
    "degree",
    "finish",
    "major",
    "media",
    "overall",
    "requirements",
    "requirement",
    "shared",
    "studies",
    "study",
    "the",
  ]);

  return normalizeMatcherText(title)
    .split(" ")
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

function getStructuredDegreeMapBlockHints(owner, requirementCueLines, chooseStatements, pathwayLabels, headings) {
  const sourceHints = uniqueSorted([
    ...headings,
    ...pathwayLabels,
    ...requirementCueLines,
    ...chooseStatements,
  ]).slice(0, 40);
  const normalizedHints = sourceHints.map((line) => ({
    line,
    normalized: normalizeMatcherText(line),
  }));

  return getStructuredDegreeMapBlocksForOwner(owner).flatMap((block) => {
    const blockTitleTokens = getBlockTitleTokens(block.title);
    const matchingLines = normalizedHints
      .filter(({ normalized }) => {
        const tokenOverlapCount = blockTitleTokens.filter((token) => normalized.includes(token)).length;
        if (tokenOverlapCount >= 2) {
          return true;
        }

        if (/admission/.test(normalized) && /\badmission\b/i.test(block.title)) {
          return true;
        }

        if (
          /\b(track|option|pathway|route|specialization)\b/.test(normalized) &&
          /\b(track|option|pathway|route|specialization)\b/i.test(block.title) &&
          tokenOverlapCount >= 1
        ) {
          return true;
        }

        if (
          /\b(core|foundation|structure|requirements?)\b/.test(normalized) &&
          /\b(core|foundation|structure|requirements?)\b/i.test(block.title)
        ) {
          return true;
        }

        return false;
      })
      .map(({ line }) => line)
      .slice(0, 6);

    if (!matchingLines.length) {
      return [];
    }

    return [
      {
        id: `${owner.ownerId}:source-degree-map:structured:${slugify(block.id)}`,
        title: block.title,
        uwCourseCodes: [],
        sourceLineHints: matchingLines,
      },
    ];
  });
}

function buildParsedDegreeMapBlockCandidates(
  owner,
  parsedCourseCodes,
  requirementCueLines,
  chooseStatements,
  pathwayLabels,
  headings
) {
  if (parsedCourseCodes.length) {
    return [
      {
        id: `${owner.ownerId}:source-degree-map:${slugify(owner.adapterId)}`,
        title: `${owner.ownerTitle} parsed official source requirements`,
        uwCourseCodes: parsedCourseCodes,
        sourceLineHints: requirementCueLines.slice(0, 10),
      },
    ];
  }

  const structuredCandidates = getStructuredDegreeMapBlockHints(
    owner,
    requirementCueLines,
    chooseStatements,
    pathwayLabels,
    headings
  );
  if (structuredCandidates.length) {
    return structuredCandidates;
  }

  const sourceLineHints = uniqueSorted([
    ...headings,
    ...pathwayLabels,
    ...requirementCueLines,
    ...chooseStatements,
  ]).slice(0, 10);
  if (!sourceLineHints.length) {
    return [];
  }

  return [
    {
      id: `${owner.ownerId}:source-degree-map:notes`,
      title: `${owner.ownerTitle} parsed official source structure`,
      uwCourseCodes: [],
      sourceLineHints,
    },
  ];
}

function writeSnapshot(ownerKey, sourceUrl, title, lines) {
  ensureDir(SNAPSHOT_DIR);
  const outputPath = getSnapshotPath(ownerKey);
  const body = [
    `Owner: ${ownerKey}`,
    `Source: ${sourceUrl}`,
    `Title: ${title || ""}`,
    "",
    ...lines,
  ].join("\n");
  fs.writeFileSync(outputPath, `${body}\n`);
  return outputPath;
}

function getSnapshotPath(ownerKey) {
  return path.resolve(SNAPSHOT_DIR, `${slugify(ownerKey)}.txt`);
}

function readSnapshot(ownerKey) {
  const snapshotPath = getSnapshotPath(ownerKey);
  if (!fs.existsSync(snapshotPath)) {
    return null;
  }

  const rawLines = fs.readFileSync(snapshotPath, "utf8").split(/\r?\n/);
  const titleLine = rawLines.find((line) => line.startsWith("Title:"));
  const bodyStartIndex = rawLines.findIndex((line, index) => index <= 6 && line.trim() === "");
  const snapshotLines = rawLines
    .slice(bodyStartIndex >= 0 ? bodyStartIndex + 1 : 0)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .slice(0, 1200);

  if (!snapshotLines.length) {
    return null;
  }

  return {
    snapshotPath,
    title: titleLine ? normalizeWhitespace(titleLine.replace(/^Title:\s*/, "")) : null,
    snapshotLines,
  };
}

function parseSnapshotSource(entry, originalError) {
  const snapshot = readSnapshot(entry.ownerId);
  if (!snapshot) {
    return null;
  }

  const requirementCueLines = extractRequirementCueLines(snapshot.snapshotLines);
  const chooseStatements = extractChooseStatements(snapshot.snapshotLines);
  const pathwayLabels = extractPathwayLabels(entry, snapshot.snapshotLines, []);
  const courseCodes = filterParsedCourseCodesByHints(
    entry,
    snapshot.snapshotLines,
    extractCourseCodesFromLines(snapshot.snapshotLines, [], entry)
  );

  return {
    title: snapshot.title,
    headings: [],
    requirementCueLines,
    chooseStatements,
    pathwayLabels,
    courseCodes,
    snapshotLines: snapshot.snapshotLines,
    parseConfidence: buildParseConfidence(courseCodes, requirementCueLines, entry.parserType),
    resolvedSourceUrl: entry.url,
    resolvedSourceLabel: entry.label,
    resolvedParserType: entry.parserType,
    snapshotPath: snapshot.snapshotPath,
    usedSnapshotFallback: true,
    snapshotFallbackReason: originalError.message,
  };
}

function parseRetryAfterToMs(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized) * 1000;
  }

  const retryAt = Date.parse(normalized);
  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(0, retryAt - Date.now());
}

function isRetryableHttpStatus(status) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function getRetryDelayMs(attempt, retryAfterHeader = null) {
  const retryAfterMs = parseRetryAfterToMs(retryAfterHeader);
  if (retryAfterMs !== null) {
    return Math.min(Math.max(retryAfterMs, DEFAULT_HOST_COOLDOWN_MS), 8000);
  }

  return Math.min(DEFAULT_HOST_COOLDOWN_MS * Math.pow(2, Math.max(0, attempt - 1)), 8000);
}

async function fetchWithTimeoutOnce(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetries(url, timeoutMs) {
  let lastError = null;
  let lastResponse = null;

  for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await withHostThrottle(url, () => fetchWithTimeoutOnce(url, timeoutMs));
      if (response.ok) {
        return response;
      }

      lastResponse = response;
      if (!isRetryableHttpStatus(response.status) || attempt >= DEFAULT_RETRY_ATTEMPTS) {
        return response;
      }

      await sleep(getRetryDelayMs(attempt, response.headers.get("retry-after")));
    } catch (error) {
      lastError = error;
      if (attempt >= DEFAULT_RETRY_ATTEMPTS) {
        break;
      }

      await sleep(getRetryDelayMs(attempt));
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError ?? new Error(`Failed to fetch ${url}.`);
}

function buildCurlErrorMessage(error, url) {
  const stderr = normalizeWhitespace(error?.stderr ?? "");
  const stdout = normalizeWhitespace(error?.stdout ?? "");
  const details = stderr || stdout || normalizeWhitespace(error?.message ?? "");
  return details ? `${details}` : `curl failed for ${url}`;
}

async function downloadWithCurl(url, timeoutMs, binary) {
  const args = [
    "--silent",
    "--show-error",
    "--location",
    "--fail",
    "--user-agent",
    USER_AGENT,
    "--header",
    `Accept: ${CURL_ACCEPT_HEADER}`,
    "--max-time",
    String(Math.max(5, Math.ceil(timeoutMs / 1000))),
    url,
  ];

  try {
    const result = await withHostThrottle(url, () =>
      execFileAsync(CURL_COMMAND, args, {
        encoding: binary ? "buffer" : "utf8",
        maxBuffer: CURL_MAX_BUFFER_BYTES,
        windowsHide: true,
      })
    );

    return {
      body: binary ? Buffer.from(result.stdout) : String(result.stdout ?? ""),
      fetchMode: "curl",
    };
  } catch (error) {
    throw new Error(buildCurlErrorMessage(error, url));
  }
}

async function downloadSource(url, timeoutMs, { binary = false } = {}) {
  const cacheKey = `${binary ? "binary" : "text"}::${String(url ?? "")}`;
  const cached = SOURCE_DOWNLOAD_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const downloadPromise = (async () => {
  let fetchResponse = null;
  let fetchError = null;

  try {
    fetchResponse = await fetchWithRetries(url, timeoutMs);
    if (fetchResponse.ok) {
      return {
        body: binary
          ? Buffer.from(await fetchResponse.arrayBuffer())
          : await fetchResponse.text(),
        fetchMode: "fetch",
      };
    }
  } catch (error) {
    fetchError = error;
  }

  try {
    return await downloadWithCurl(url, timeoutMs, binary);
  } catch (curlError) {
    if (fetchResponse && !fetchResponse.ok) {
      throw new Error(`HTTP ${fetchResponse.status} ${fetchResponse.statusText}`);
    }
    if (fetchError) {
      throw fetchError;
    }
    throw curlError;
  }
  })();

  SOURCE_DOWNLOAD_CACHE.set(cacheKey, downloadPromise);

  try {
    return await downloadPromise;
  } catch (error) {
    SOURCE_DOWNLOAD_CACHE.delete(cacheKey);
    throw error;
  }
}

async function getHtmlSourceArtifacts(url, timeoutMs) {
  const cacheKey = String(url ?? "");
  const cached = HTML_SOURCE_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const htmlPromise = (async () => {
    const { body: html } = await downloadSource(url, timeoutMs);
    return {
      html,
      title: extractTitle(html),
      headings: extractHeadings(html),
      lines: buildHtmlLines(html),
    };
  })();

  HTML_SOURCE_CACHE.set(cacheKey, htmlPromise);

  try {
    return await htmlPromise;
  } catch (error) {
    HTML_SOURCE_CACHE.delete(cacheKey);
    throw error;
  }
}

function isDocxSourceUrl(url) {
  return /\.docx(?:$|[?#])/i.test(String(url ?? ""));
}

const DOCX_BLOCK_END_TAGS = new Set(["/w:p", "/w:tr", "/w:tbl", "/w:sectpr", "/w:tc"]);

function extractDocxText(xml) {
  const text = String(xml ?? "");
  let output = "";

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === "<") {
      const tagEndIndex = text.indexOf(">", index + 1);
      if (tagEndIndex === -1) {
        break;
      }

      let tagName = text
        .slice(index + 1, tagEndIndex)
        .trim()
        .split(/\s+/, 1)[0]
        .toLowerCase();
      if (tagName.endsWith("/")) {
        tagName = tagName.slice(0, -1);
      }

      if (tagName === "w:tab" || tagName === "w:sym") {
        output += " ";
      } else if (tagName === "w:br" || tagName === "w:cr") {
        output += "\n";
      } else if (tagName === "w:nobreakhyphen") {
        output += "-";
      } else if (DOCX_BLOCK_END_TAGS.has(tagName)) {
        output += "\n";
      }

      index = tagEndIndex;
      continue;
    }

    output += char;
  }

  return output;
}

function stripAngleBrackets(value) {
  return String(value ?? "").replace(/[<>]/g, "");
}

function buildDocxLines(documentXml) {
  return extractDocxText(documentXml)
    .split(/\r?\n/)
    .map((line) =>
      normalizeWhitespace(stripAngleBrackets(decodeTransferPlannerHtmlEntities(line)))
    )
    .filter(Boolean);
}

async function extractDocxDocumentXml(docxBuffer, timeoutMs) {
  const tempDir = fs.mkdtempSync(path.join(TMP_DIR, "transfer-planner-docx-"));
  const archivePath = path.join(tempDir, "source.docx");
  fs.writeFileSync(archivePath, docxBuffer);

  try {
    const { stdout } = await execFileAsync("tar", ["-xOf", archivePath, "word/document.xml"], {
      encoding: "utf8",
      maxBuffer: CURL_MAX_BUFFER_BYTES,
      timeout: timeoutMs,
      windowsHide: true,
    });

    return String(stdout ?? "");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function getDocxSourceArtifacts(url, timeoutMs) {
  const cacheKey = String(url ?? "");
  const cached = DOCX_SOURCE_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const docxPromise = (async () => {
    const { body } = await downloadSource(url, timeoutMs, { binary: true });
    const documentXml = await extractDocxDocumentXml(body, timeoutMs);
    const lines = buildDocxLines(documentXml);
    return {
      title: lines[0] ?? null,
      lines,
    };
  })();

  DOCX_SOURCE_CACHE.set(cacheKey, docxPromise);

  try {
    return await docxPromise;
  } catch (error) {
    DOCX_SOURCE_CACHE.delete(cacheKey);
    throw error;
  }
}

async function getPdfPageBlocks(url, timeoutMs) {
  const cacheKey = String(url ?? "");
  const cached = PDF_PAGE_BLOCK_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pageBlocksPromise = (async () => {
    const { body } = await downloadSource(url, timeoutMs, { binary: true });
    const pdfData = new Uint8Array(body);
    const document = await pdfjs.getDocument({ data: pdfData, verbosity: 0 }).promise;
    const pageCount = document.numPages;
    const pageBlocks = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const lineTexts = buildPdfPageLineTexts(textContent);
      const pageText = normalizeWhitespace(lineTexts.join(" "));
      if (pageText) {
        pageBlocks.push({
          pageNumber,
          pageText,
          lineTexts,
        });
      }
    }

    return pageBlocks;
  })();

  PDF_PAGE_BLOCK_CACHE.set(cacheKey, pageBlocksPromise);

  try {
    return await pageBlocksPromise;
  } catch (error) {
    PDF_PAGE_BLOCK_CACHE.delete(cacheKey);
    throw error;
  }
}

async function mapWithConcurrency(items, worker, concurrency, options = {}) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let completedCount = 0;
  const progressLabel = String(options.progressLabel ?? "items").trim() || "items";
  const describeItem =
    typeof options.describeItem === "function" ? options.describeItem : null;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
      completedCount += 1;
      const itemSuffix = describeItem
        ? ` - ${String(describeItem(items[currentIndex], currentIndex) ?? "").trim()}`
        : "";
      console.log(`[${completedCount}/${items.length}] ${progressLabel}${itemSuffix}`);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

function buildHtmlLines(html) {
  return String(html ?? "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(BLOCK_TAG_PATTERN, "\n")
    .split(/\r?\n/)
    .map((line) => stripHtml(line))
    .filter(Boolean);
}

function extractTitle(html) {
  const match = String(html ?? "").match(TITLE_PATTERN);
  return match ? stripHtml(match[1]) : null;
}

function extractHeadings(html) {
  const headings = [];
  for (const match of String(html ?? "").matchAll(HEADING_PATTERN)) {
    const heading = stripHtml(match[2]);
    if (!heading) {
      continue;
    }
    headings.push(heading);
  }
  return uniqueSorted(headings).slice(0, 20);
}

function extractRequirementCueLines(lines) {
  const cueLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeWhitespace(lines[index]);
    if (
      !line ||
      NOISY_SOURCE_LINE_PATTERN.test(line) ||
      TRANSFER_CREDIT_NOISE_PATTERN.test(line)
    ) {
      continue;
    }

    const hasDirectCue =
      REQUIREMENT_CUE_PATTERN.test(line) || GENERAL_ED_REQUIREMENT_CUE_PATTERN.test(line);
    const hasContextualCourseListCue =
      extractCourseCodesFromLine(line).length > 0 &&
      hasRequirementContextNearLine(lines, index, 8);

    if (hasDirectCue || hasContextualCourseListCue) {
      cueLines.push(line);
    }
  }

  return uniqueInOrder(cueLines).slice(0, 80);
}

function extractChooseStatements(lines) {
  return lines
    .filter((line) => /\b(choose|select|one of the following|two of the following)\b/i.test(line))
    .slice(0, 20);
}

function pathwayLabelMentionsDifferentMajor(entry, line) {
  const titlesByPlanId = PRIMARY_MAJOR_TITLES_BY_PLAN_ID.has(entry.planId)
    ? PRIMARY_MAJOR_TITLES_BY_PLAN_ID
    : new Map([
        ...PRIMARY_MAJOR_TITLES_BY_PLAN_ID,
        [entry.planId, normalizeTransferPlannerText(entry.ownerTitle || entry.planTitle || "")],
      ]);

  return labelMentionsDifferentTransferPlannerMajor(
    entry.planId,
    line,
    titlesByPlanId
  );
}

function selectExtractedPathwayKindSegment(value) {
  const normalized = normalizeTransferPlannerText(value);
  const segments = normalized
    .split(/\s+(?:[-â€“â€”]|:)\s+|,\s+/)
    .map((segment) => normalizeTransferPlannerText(segment))
    .filter(Boolean);

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (
      PATHWAY_LABEL_CUE_PATTERN.test(segment) &&
      !/^(?:older|prior|current)\b/i.test(segment) &&
      !/^requirements?\s+for\b/i.test(segment)
    ) {
      return segment;
    }
  }

  return normalized;
}

function normalizeExtractedPathwayLabel(entry, line) {
  const majorTitle = getPrimaryMajorTitle(entry);
  const normalized = normalizeTransferPlannerSemanticPathwayLabel(
    majorTitle,
    normalizeTransferPlannerText(line)
      .replace(/\b(option|track|route|pathway|certificate|concentration)\b\s+[-–—]\s+.*$/i, "$1")
      .replace(/\s+\((?:\d+(?:-\d+)?\s+credits?)\)\s*$/i, "")
      .replace(/\s+[.;:]\s*$/, "")
  );

  return normalized || normalizeTransferPlannerText(line);
}

function normalizeCanonicalExtractedPathwayLabel(entry, line) {
  const majorTitle = getPrimaryMajorTitle(entry);
  const normalized = normalizeTransferPlannerSemanticPathwayLabel(
    majorTitle,
    selectExtractedPathwayKindSegment(normalizeTransferPlannerText(line))
  );

  return normalized || normalizeTransferPlannerText(line);
}

function lineHasNearbyCourseList(lines, index) {
  const lookaheadLines = lines.slice(index + 1, index + 5);
  return lookaheadLines.some((line) => extractCourseCodesFromLine(line).length > 0);
}

function normalizeSectionPathwayCandidate(entry, rawLine, pathwayKind) {
  const normalizedLine = normalizeTransferPlannerText(rawLine);
  if (!normalizedLine || pathwayLabelMentionsDifferentMajor(entry, normalizedLine)) {
    return "";
  }

  if (
    normalizedLine.length > 90 ||
    normalizedLine.split(/\s+/).length > 9 ||
    extractCourseCodesFromLine(normalizedLine).length > 0 ||
    PATHWAY_SECTION_SUBCATEGORY_PATTERN.test(normalizedLine) ||
    PATHWAY_SECTION_CONTEXT_PATTERN.test(normalizedLine) ||
    PATHWAY_SECTION_BOUNDARY_PATTERN.test(normalizedLine) ||
    HONORS_THESIS_PATHWAY_LABEL_PATTERN.test(normalizedLine) ||
    /\b(?:credits?|courses?|requirements?|offered|minimum|area other than|outside of|approved area)\b/i.test(
      normalizedLine
    ) ||
    /[.;:]$/.test(normalizedLine)
  ) {
    return "";
  }

  const labelWithKind = PATHWAY_LABEL_CUE_PATTERN.test(normalizedLine)
    ? normalizedLine
    : `${normalizedLine} ${pathwayKind}`;
  return normalizeCanonicalExtractedPathwayLabel(entry, labelWithKind);
}

function getDeclaredPathwayChoice(lines) {
  for (const line of lines) {
    const normalized = normalizeTransferPlannerText(line);
    const match = normalized.match(
      /\b(?:choose|select)\s+one\s+of\s+(?:(\d+)|([a-z]+))\s+(concentration|track|option|route|pathway)s?\b/i
    );
    if (!match) {
      continue;
    }

    const numericCount = match[1] ? Number(match[1]) : null;
    const wordCount = PATHWAY_CHOICE_COUNT_BY_WORD.get(String(match[2] ?? "").toLowerCase()) ?? null;
    const count = numericCount ?? wordCount;
    if (!Number.isFinite(count) || count < 2 || count > 10) {
      continue;
    }

    return {
      count,
      kind: String(match[3] ?? "pathway").toLowerCase(),
    };
  }

  return null;
}

function isDeclaredPathwaySectionContextLine(line, pathwayKind) {
  const normalized = normalizeTransferPlannerText(line);
  if (!normalized) {
    return false;
  }

  if (pathwayKind === "concentration") {
    return (
      /\bconcentration area courses?\b/i.test(normalized) ||
      /\bcourses? that can be applied\b.*\bconcentration\b.*\blisted below\b/i.test(
        normalized
      )
    );
  }

  return new RegExp(
    `\\b${pathwayKind}s?\\b.*\\b(?:courses?|requirements?|listed below)\\b`,
    "i"
  ).test(normalized);
}

function extractPathwaySectionLabels(entry, lines) {
  const declaredPathwayChoice = getDeclaredPathwayChoice(lines);
  if (!declaredPathwayChoice) {
    return [];
  }

  const labels = [];
  let activePathwayKind = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeTransferPlannerText(lines[index]);
    if (!line) {
      continue;
    }

    if (isDeclaredPathwaySectionContextLine(line, declaredPathwayChoice.kind)) {
      activePathwayKind = declaredPathwayChoice.kind;
      continue;
    }

    if (!activePathwayKind) {
      continue;
    }

    if (PATHWAY_SECTION_BOUNDARY_PATTERN.test(line)) {
      activePathwayKind = null;
      continue;
    }

    if (!lineHasNearbyCourseList(lines, index)) {
      continue;
    }

    const label = normalizeSectionPathwayCandidate(entry, line, activePathwayKind);
    if (label) {
      labels.push(label);
      if (labels.length >= declaredPathwayChoice.count) {
        break;
      }
    }
  }

  return uniqueInOrder(labels);
}

function extractPathwayLabels(entry, lines, headings) {
  const isPathwayLabelCandidate = (rawLine, normalizedLine) => {
    if (pathwayLabelMentionsDifferentMajor(entry, rawLine)) {
      return false;
    }

    const normalized = normalizedLine ?? normalizeCanonicalExtractedPathwayLabel(entry, rawLine);
    const isDegreeTitleCandidate = PATHWAY_LABEL_DEGREE_TITLE_PATTERN.test(normalized);
    if (!normalized || NOISY_SOURCE_LINE_PATTERN.test(normalized)) {
      return false;
    }
    if (
      /^(?:\[?\s*supplemental official source\b|learn more|about|apply)\b/i.test(normalized) ||
      /^(?:download|click here to join|joining the)\b/i.test(normalized) ||
      /\b(?:admissions?\s+pathway|current uw student admissions pathway)\b/i.test(normalized) ||
      /\b(?:please check out|which is detailed at)\b/i.test(normalized) ||
      /\bto be considered\b/i.test(normalized) ||
      /\bapplicants?\b/i.test(normalized) ||
      /\b(?:double major|double degree)\b/i.test(normalized) ||
      HONORS_THESIS_PATHWAY_LABEL_PATTERN.test(normalized) ||
      /\b(?:elective courses?|course lists?|courses by track)\b/i.test(normalized) ||
      /^(?:\d+(?:\.\d+)?\s+credits?\b.*\b)?(?:student[â€™'`s]*\s+)?concentration area courses?$/i.test(
        normalized
      ) ||
      /\bbeyond the \d+(?:\.\d+)? credits required in the concentration area\b/i.test(
        normalized
      ) ||
      /^(?:[†*§◊]+)?\s*(?:if|for)\b/i.test(normalized) ||
      /^concentration\s+[ivxlcdm]+\b.*\b(?:credits?|courses?)\b/i.test(normalized) ||
      pathwayLabelMentionsDifferentMajor(entry, normalized)
    ) {
      return false;
    }
    if (
      !isDegreeTitleCandidate &&
      (normalized.length > 120 || normalized.split(/\s+/).length > 14)
    ) {
      return false;
    }

    return (
      PATHWAY_LABEL_CUE_PATTERN.test(normalized) ||
      isDegreeTitleCandidate ||
      PATHWAY_LABEL_INLINE_PATTERN.test(normalized) ||
      PATHWAY_LABEL_APPLY_PATTERN.test(normalized)
    );
  };

  return uniqueSorted(
    [...extractPathwaySectionLabels(entry, lines), ...headings, ...lines]
      .map((line) => ({
        raw: line,
        normalized: normalizeCanonicalExtractedPathwayLabel(entry, line),
      }))
      .filter(({ raw, normalized }) => isPathwayLabelCandidate(raw, normalized))
      .map(({ normalized }) => normalized)
      .slice(0, 40)
  );
}

function buildParseConfidence(parsedCourseCodes, requirementCueLines, parserType) {
  if (
    parsedCourseCodes.length >= 8 ||
    (parsedCourseCodes.length >= 4 && requirementCueLines.length >= 4)
  ) {
    return "high";
  }

  if (
    parsedCourseCodes.length >= 2 ||
    requirementCueLines.length >= 4 ||
    parserType === "pdf-degree-sheet"
  ) {
    return "medium";
  }

  return "low";
}

function buildHtmlParsedResult(entry, title, headings, lines, options = {}) {
  const requirementCueLines = extractRequirementCueLines(lines);
  const chooseStatements = extractChooseStatements(lines);
  const pathwayLabels = extractPathwayLabels(entry, lines, headings);
  const courseCodes = filterParsedCourseCodesByHints(
    entry,
    lines,
    extractCourseCodesFromLines(lines, headings, entry)
  );

  return {
    title,
    headings,
    requirementCueLines,
    chooseStatements,
    pathwayLabels,
    courseCodes,
    snapshotLines: lines.slice(0, 1200),
    parseConfidence: buildParseConfidence(courseCodes, requirementCueLines, entry.parserType),
    resolvedSourceUrl: entry.url,
    resolvedSourceLabel: entry.label,
    resolvedParserType: entry.parserType,
    sourceRole: options.sourceRole ?? classifyRequirementSourceRole(entry),
    sourceSectionAudit: options.sourceSectionAudit ?? null,
  };
}

function getParsedCourseSubjects(parsed) {
  return uniqueSorted(
    (parsed.courseCodes ?? [])
      .map((courseCode) => normalizeCourseCode(courseCode).match(/^([A-Z& ]+)\s+\d/))
      .map((match) => match?.[1] ?? null)
      .filter(Boolean)
  );
}

function getParsedLowerDivisionCourseCount(parsed) {
  return (parsed.courseCodes ?? []).filter((courseCode) => {
    const level = getCourseCodeNumericLevel(courseCode);
    return level !== null && level < 300;
  }).length;
}

function getCourseCodeSubject(courseCode) {
  return normalizeCourseCode(courseCode).match(/^([A-Z& ]+)\s+\d/)?.[1] ?? null;
}

function buildFocusedScopedHtmlOverflowParsed(fullParsed, scopedParsed) {
  const scopedSubjectSet = new Set(getParsedCourseSubjects(scopedParsed));
  if (!scopedSubjectSet.size) {
    return scopedParsed;
  }

  const safeOverflowCourseCodes = uniqueSorted(
    (fullParsed.courseCodes ?? []).filter((courseCode) => {
      if ((scopedParsed.courseCodes ?? []).includes(courseCode)) {
        return false;
      }
      const level = getCourseCodeNumericLevel(courseCode);
      if (level === null || level >= 300) {
        return false;
      }
      const subject = getCourseCodeSubject(courseCode);
      return Boolean(subject) && scopedSubjectSet.has(subject);
    })
  );

  if (!safeOverflowCourseCodes.length) {
    return scopedParsed;
  }

  const safeOverflowCodeSet = new Set(safeOverflowCourseCodes);
  const safeOverflowSnapshotLines = (fullParsed.snapshotLines ?? []).filter((line) =>
    extractCourseCodesFromLine(line).some((courseCode) =>
      safeOverflowCodeSet.has(normalizeCourseCode(courseCode))
    )
  );

  return {
    ...scopedParsed,
    courseCodes: uniqueSorted([...(scopedParsed.courseCodes ?? []), ...safeOverflowCourseCodes]),
    snapshotLines: uniqueInOrder([
      ...(scopedParsed.snapshotLines ?? []),
      ...safeOverflowSnapshotLines,
    ]),
  };
}

function selectPreferredHtmlParsed(entry, fullParsed, scopedParsed) {
  if (!scopedParsed) {
    return fullParsed;
  }

  const fullAlignment = getParsedOwnerAlignmentScore(entry, fullParsed);
  const scopedAlignment = getParsedOwnerAlignmentScore(entry, scopedParsed);
  const fullCourseCount = fullParsed.courseCodes?.length ?? 0;
  const scopedCourseCount = scopedParsed.courseCodes?.length ?? 0;
  const fullLowerDivisionCount = getParsedLowerDivisionCourseCount(fullParsed);
  const fullSubjects = getParsedCourseSubjects(fullParsed);
  const scopedSubjects = getParsedCourseSubjects(scopedParsed);
  const enrichedScopedParsed =
    !isLegacyStudentCatalogSource(entry) &&
    ["html-degree-page", "html-curriculum-page"].includes(entry.parserType)
      ? buildFocusedScopedHtmlOverflowParsed(fullParsed, scopedParsed)
      : scopedParsed;
  if (scopedParsed.sourceSectionAudit?.anchorFound) {
    return enrichedScopedParsed;
  }
  const scopedLowerDivisionCount = getParsedLowerDivisionCourseCount(enrichedScopedParsed);
  const fullHasRequirementAnchors = (fullParsed.snapshotLines ?? []).some((line) =>
    /^(major admissions requirements|admission requirements|degree requirements|major requirements|curriculum)$/i.test(
      normalizeWhitespace(line)
    )
  );

  if (fullAlignment < 2 && scopedAlignment >= 2) {
    return enrichedScopedParsed;
  }

  if (
    fullHasRequirementAnchors &&
    fullAlignment >= Math.max(2, scopedAlignment - 1) &&
    fullLowerDivisionCount >= Math.max(4, scopedLowerDivisionCount + 4) &&
    scopedLowerDivisionCount <= Math.max(1, Math.floor(scopedCourseCount / 4))
  ) {
    return fullParsed;
  }

  if (scopedAlignment >= fullAlignment + 1 && scopedCourseCount >= Math.max(2, Math.floor(fullCourseCount * 0.25))) {
    return enrichedScopedParsed;
  }

  if (fullCourseCount >= 80 && scopedAlignment >= fullAlignment && scopedCourseCount >= 4) {
    return enrichedScopedParsed;
  }

  if (
    scopedAlignment >= fullAlignment &&
    scopedCourseCount >= 2 &&
    scopedSubjects.length > 0 &&
    fullSubjects.length >= scopedSubjects.length + 2
  ) {
    return enrichedScopedParsed;
  }

  return fullParsed;
}

async function parseHtmlSource(entry, timeoutMs, options = {}) {
  if (/\.pdf(?:$|[?#])/i.test(entry.url)) {
    return parsePdfSource(entry, timeoutMs);
  }
  if (isDocxSourceUrl(entry.url)) {
    return parseDocxSource(
      {
        ...entry,
        parserType: "pdf-degree-sheet",
      },
      timeoutMs
    );
  }

  const { html, title, headings, lines } = await getHtmlSourceArtifacts(entry.url, timeoutMs);
  const catalogScope = scopeCatalogHtmlByAnchor(entry, html);
  const scopedLines =
    catalogScope?.scoped && catalogScope.lines?.length
      ? catalogScope.lines
      : scopeHtmlLines(entry, title, headings, lines);
  const scopedHeadings =
    catalogScope?.scoped && catalogScope.headings?.length ? catalogScope.headings : headings;
  const sourceRole = classifyRequirementSourceRole(entry);
  const htmlParsed = selectPreferredHtmlParsed(
    entry,
    buildHtmlParsedResult(entry, title, headings, lines, {
      sourceRole,
      sourceSectionAudit: catalogScope?.sectionAudit ?? null,
    }),
    scopedLines === lines
      ? null
      : buildHtmlParsedResult(entry, title, scopedHeadings, scopedLines, {
          sourceRole,
          sourceSectionAudit: catalogScope?.sectionAudit ?? null,
        })
  );
  const visitedUrls = options.visitedUrls ?? new Set();
  const normalizedEntryUrl = normalizeUrlForComparison(entry.url);
  const allowLinkedRecovery = options.allowLinkedRecovery !== false;
  const linkedSupplementalSources =
    allowLinkedRecovery && normalizedEntryUrl
      ? await parseSupplementalHtmlSources(
          entry,
          html,
          timeoutMs,
          new Set([...visitedUrls, normalizedEntryUrl])
        )
      : [];
  const mergedHtmlParsed = mergeParsedSources(
    htmlParsed,
    linkedSupplementalSources,
    entry.parserType
  );
  const linkedPdfSources =
    allowLinkedRecovery && normalizedEntryUrl
      ? await parseSupplementalPdfSources(
          entry,
          html,
          timeoutMs,
          new Set([...visitedUrls, normalizedEntryUrl])
        )
      : [];
  const preferredPdfSource = linkedPdfSources.find(({ candidate, parsed }) =>
    shouldPreferSupplementalPdfSource(entry, mergedHtmlParsed, candidate, parsed)
  );

  if (preferredPdfSource) {
    return preferredPdfSource.parsed;
  }

  const shouldFollowLinkedPdf =
    mergedHtmlParsed.courseCodes.length === 0 &&
    (/\b(download|checklist|worksheet|type:\s*pdf)\b/i.test((htmlParsed.snapshotLines ?? []).join(" ")) ||
      /\/file\//i.test(entry.url));

  if (!shouldFollowLinkedPdf) {
    return mergedHtmlParsed;
  }

  const pdfLinks = uniqueSorted(
    [...String(html ?? "").matchAll(PDF_LINK_PATTERN)]
      .map((match) => match[1] ?? match[2] ?? null)
      .filter(Boolean)
      .map((href) => {
        try {
          return new URL(href, entry.url).href;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  );

  for (const pdfUrl of pdfLinks.slice(0, 2)) {
    try {
      const pdfParsed = await parsePdfSource(
        { ...entry, url: pdfUrl, parserType: "pdf-degree-sheet" },
        timeoutMs
      );
      const htmlScore =
        mergedHtmlParsed.courseCodes.length * 100 +
        mergedHtmlParsed.requirementCueLines.length * 10 +
        mergedHtmlParsed.chooseStatements.length * 5;
      const pdfScore =
        pdfParsed.courseCodes.length * 100 +
        pdfParsed.requirementCueLines.length * 10 +
        pdfParsed.chooseStatements.length * 5;

      if (pdfScore > htmlScore) {
        return {
          ...pdfParsed,
          headings: uniqueSorted([...mergedHtmlParsed.headings, ...pdfParsed.headings]).slice(0, 20),
          requirementCueLines: uniqueSorted([
            ...mergedHtmlParsed.requirementCueLines,
            ...pdfParsed.requirementCueLines,
          ]).slice(0, 30),
          chooseStatements: uniqueSorted([
            ...mergedHtmlParsed.chooseStatements,
            ...pdfParsed.chooseStatements,
          ]).slice(0, 20),
          pathwayLabels: uniqueSorted([
            ...mergedHtmlParsed.pathwayLabels,
            ...pdfParsed.pathwayLabels,
          ]).slice(0, 20),
        };
      }
    } catch {
      // Keep the primary HTML parse result if linked PDF recovery fails.
    }
  }

  return mergedHtmlParsed;
}

async function parseDocxSource(entry, timeoutMs) {
  const { title, lines } = await getDocxSourceArtifacts(entry.url, timeoutMs);
  const requirementCueLines = extractRequirementCueLines(lines);
  const chooseStatements = extractChooseStatements(lines);
  const pathwayLabels = extractPathwayLabels(entry, lines, []);
  const courseCodes = filterParsedCourseCodesByHints(
    entry,
    lines,
    extractCourseCodesFromLines(lines, [], entry)
  );

  return {
    title,
    headings: [],
    requirementCueLines,
    chooseStatements,
    pathwayLabels,
    courseCodes,
    snapshotLines: lines.slice(0, 1200),
    parseConfidence: buildParseConfidence(courseCodes, requirementCueLines, "pdf-degree-sheet"),
    resolvedSourceUrl: entry.url,
    resolvedSourceLabel: entry.label,
    resolvedParserType: "pdf-degree-sheet",
  };
}

async function parsePdfSource(entry, timeoutMs) {
  const pageBlocks = await getPdfPageBlocks(entry.url, timeoutMs);
  const scopedPageLines = scopePdfPageBlocks(entry, pageBlocks).flatMap((block) =>
    block.lineTexts.map((lineText) => `[Page ${block.pageNumber}] ${lineText}`)
  );

  const title = scopedPageLines[0]
    ? normalizeWhitespace(scopedPageLines[0].replace(/^\[Page \d+\]\s*/, ""))
    : null;
  const requirementCueLines = extractRequirementCueLines(scopedPageLines);
  const chooseStatements = extractChooseStatements(scopedPageLines);
  const pathwayLabels = extractPathwayLabels(entry, scopedPageLines, []);
  const courseCodes = filterParsedCourseCodesByHints(
    entry,
    scopedPageLines,
    extractCourseCodesFromLines(scopedPageLines, [], entry)
  );

  return {
    title,
    headings: [],
    requirementCueLines,
    chooseStatements,
    pathwayLabels,
    courseCodes,
    snapshotLines: scopedPageLines.slice(0, 1200),
    parseConfidence: buildParseConfidence(courseCodes, requirementCueLines, entry.parserType),
    resolvedSourceUrl: entry.url,
    resolvedSourceLabel: entry.label,
    resolvedParserType: entry.parserType,
  };
}

function hasMeaningfulParsedContent(parsed) {
  return Boolean(
    (parsed.courseCodes ?? []).length ||
      (parsed.requirementCueLines ?? []).length ||
      (parsed.chooseStatements ?? []).length ||
      (parsed.pathwayLabels ?? []).length
  );
}

function buildMergedSnapshotLines(baseLines, supplementalSources) {
  const mergedLines = [...(baseLines ?? [])];

  for (const supplemental of supplementalSources) {
    const label = normalizeWhitespace(
      supplemental.entry?.label ?? supplemental.entry?.url ?? "Supplemental official source"
    );

    if (label) {
      mergedLines.push(`[Supplemental official source] ${label}`);
    }

    for (const line of supplemental.parsed?.snapshotLines ?? []) {
      mergedLines.push(line);
    }
  }

  return uniqueInOrder(mergedLines).slice(0, 1200);
}

function buildSharedLinkedCourseCodes(supplementalSources, minimumSupportCount) {
  const codeCounts = new Map();

  for (const supplemental of supplementalSources) {
    for (const courseCode of new Set(supplemental.parsed?.courseCodes ?? [])) {
      codeCounts.set(courseCode, (codeCounts.get(courseCode) ?? 0) + 1);
    }
  }

  return uniqueSorted(
    [...codeCounts.entries()]
      .filter(([, count]) => count >= minimumSupportCount)
      .map(([courseCode]) => courseCode)
  );
}

function buildSharedSpecializationSupplementalSource(baseParsed, supplementalSources, parserType) {
  if (supplementalSources.length < 2) {
    return [];
  }

  const minimumSupportCount = Math.max(2, Math.ceil(supplementalSources.length * 0.4));
  const sharedCourseCodes = buildSharedLinkedCourseCodes(
    supplementalSources,
    minimumSupportCount
  ).filter((courseCode) => !(baseParsed.courseCodes ?? []).includes(courseCode));

  if (!sharedCourseCodes.length) {
    return [];
  }

  const requirementCueLines = uniqueSorted(
    supplementalSources.flatMap((supplemental) => supplemental.parsed?.requirementCueLines ?? [])
  ).slice(0, 40);

  return [
    {
      kind: "specialized-shared",
      entry: {
        label: "Supplemental official track and option pages",
      },
      parsed: {
        title: baseParsed.title,
        headings: [],
        requirementCueLines,
        chooseStatements: uniqueSorted(
          supplementalSources.flatMap((supplemental) => supplemental.parsed?.chooseStatements ?? [])
        ).slice(0, 24),
        pathwayLabels: uniqueSorted(
          supplementalSources.flatMap((supplemental) => supplemental.parsed?.pathwayLabels ?? [])
        ).slice(0, 24),
        courseCodes: sharedCourseCodes,
        snapshotLines: buildMergedSnapshotLines([], supplementalSources),
        parseConfidence: buildParseConfidence(sharedCourseCodes, requirementCueLines, parserType),
      },
    },
  ];
}

function mergeParsedSources(baseParsed, supplementalSources, parserType) {
  if (!supplementalSources.length) {
    return baseParsed;
  }

  const courseCodes = uniqueSorted([
    ...(baseParsed.courseCodes ?? []),
    ...supplementalSources.flatMap((supplemental) => supplemental.parsed?.courseCodes ?? []),
  ]);
  const requirementCueLines = uniqueSorted([
    ...(baseParsed.requirementCueLines ?? []),
    ...supplementalSources.flatMap(
      (supplemental) => supplemental.parsed?.requirementCueLines ?? []
    ),
  ]).slice(0, 40);

  return {
    ...baseParsed,
    headings: uniqueSorted([
      ...(baseParsed.headings ?? []),
      ...supplementalSources.flatMap((supplemental) => supplemental.parsed?.headings ?? []),
    ]).slice(0, 24),
    requirementCueLines,
    chooseStatements: uniqueSorted([
      ...(baseParsed.chooseStatements ?? []),
      ...supplementalSources.flatMap((supplemental) => supplemental.parsed?.chooseStatements ?? []),
    ]).slice(0, 24),
    pathwayLabels: uniqueSorted([
      ...(baseParsed.pathwayLabels ?? []),
      ...supplementalSources.flatMap((supplemental) =>
        supplemental.kind === "general" ? [] : supplemental.parsed?.pathwayLabels ?? []
      ),
    ]).slice(0, 24),
    courseCodes,
    snapshotLines: buildMergedSnapshotLines(baseParsed.snapshotLines, supplementalSources),
    parseConfidence: buildParseConfidence(courseCodes, requirementCueLines, parserType),
    usedSnapshotFallback:
      Boolean(baseParsed.usedSnapshotFallback) ||
      supplementalSources.some((supplemental) => supplemental.parsed?.usedSnapshotFallback),
    };
}

function getCourseCodeNumericLevel(courseCode) {
  const match = normalizeCourseCode(courseCode).match(/\b(\d{3})[A-Z]?$/);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function isTrackCatalogSupplementalHtmlCandidate(candidate) {
  return TRACK_CATALOG_SUPPLEMENTAL_SOURCE_PATTERN.test(
    `${candidate?.label ?? ""} ${candidate?.url ?? ""}`
  );
}

function filterParsedSupplementalHtmlCandidateCourses(candidate, parsed) {
  if (!isTrackCatalogSupplementalHtmlCandidate(candidate)) {
    return parsed;
  }

  return {
    ...parsed,
    courseCodes: uniqueSorted(
      (parsed.courseCodes ?? []).filter((courseCode) => {
        const level = getCourseCodeNumericLevel(courseCode);
        return level !== null && level < 500;
      })
    ),
  };
}

function getSameProgramPathPrefix(url) {
  try {
    const parsedUrl = new URL(url);
    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    const credentialSegmentIndex = segments.findIndex((segment) =>
      /^(?:bachelor|bachelors?|b-a|b-s|bba|basw|major)[-_]/i.test(segment)
    );
    if (credentialSegmentIndex >= 0) {
      return `/${segments.slice(0, credentialSegmentIndex + 1).join("/")}`;
    }

    const pathname = parsedUrl.pathname.replace(/\/+$/, "");
    if (/(?:^|\/)(?:admissions?|curriculum|degree-requirements?|major-requirements?|requirements?|prerequisites?|checklist|worksheet)$/i.test(pathname)) {
      return pathname.replace(/\/[^/]+$/, "");
    }

    return pathname;
  } catch {
    return "";
  }
}

function isSameProgramRequirementLink(baseUrl, resolvedUrl, linkText, highSignal) {
  if (!highSignal) {
    return false;
  }

  try {
    const base = new URL(baseUrl);
    const resolved = new URL(resolvedUrl);
    if (base.origin !== resolved.origin) {
      return false;
    }

    const basePrefix = getSameProgramPathPrefix(base.href).replace(/\/+$/, "");
    const resolvedPath = resolved.pathname.replace(/\/+$/, "");
    if (!basePrefix || basePrefix === "/" || resolvedPath === basePrefix) {
      return false;
    }

    return (
      resolvedPath.startsWith(`${basePrefix}/`) &&
      HIGH_SIGNAL_SUPPLEMENTAL_HTML_LINK_PATTERN.test(linkText)
    );
  } catch {
    return false;
  }
}

function isSameOriginHighSignalRequirementDocumentLink(baseUrl, resolvedUrl, linkText) {
  if (
    !isDocxSourceUrl(resolvedUrl) ||
    !/\b(plan of study|program of study|study plan|sample plan)\b/i.test(linkText)
  ) {
    return false;
  }

  try {
    const base = new URL(baseUrl);
    const resolved = new URL(resolvedUrl);
    if (base.origin !== resolved.origin) {
      return false;
    }

    return /(?:^|\/)(?:sites\/default\/files|files|docs?|documents?)(?:\/|$)/i.test(
      resolved.pathname
    );
  } catch {
    return false;
  }
}

function extractSupplementalHtmlLinkCandidates(entry, html) {
  const baseUrl = normalizeUrlForComparison(entry.url);
  if (!baseUrl) {
    return [];
  }

  const entryOrigin = new URL(baseUrl).origin;
  const exactTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  const titleTokens = getTitleScopeTokens(entry);
  const candidatesByUrl = new Map();

  for (const match of String(html ?? "").matchAll(HTML_LINK_PATTERN)) {
    const href = normalizeWhitespace(match[1] ?? match[2] ?? "");
    const label = stripHtml(match[3]);

    if (!href || !label || !SUPPLEMENTAL_HTML_LINK_PATTERN.test(`${label} ${href}`)) {
      continue;
    }

    if (
      /^(?:#|javascript:|mailto:|tel:)/i.test(href) ||
      /\.pdf(?:$|[?#])/i.test(href) ||
      NOISY_SUPPLEMENTAL_HTML_LINK_LABEL_PATTERN.test(label)
    ) {
      continue;
    }

    let resolvedUrl = null;
    try {
      resolvedUrl = normalizeUrlForComparison(new URL(href, entry.url).href);
    } catch {
      resolvedUrl = null;
    }

    if (!resolvedUrl || resolvedUrl === baseUrl || !resolvedUrl.startsWith(entryOrigin)) {
      continue;
    }

    const linkText = `${label} ${resolvedUrl}`;
    const highSignal = HIGH_SIGNAL_SUPPLEMENTAL_HTML_LINK_PATTERN.test(linkText);
    const normalizedLinkText = normalizeMatcherText(linkText);
    const exactTitleMatch = Boolean(exactTitle && normalizedLinkText.includes(exactTitle));
    const titleTokenOverlapCount = titleTokens.filter((token) =>
      normalizedLinkText.includes(token)
    ).length;
    const sameOriginHighSignalRequirementDocumentLink =
      isSameOriginHighSignalRequirementDocumentLink(baseUrl, resolvedUrl, linkText);
    const sameProgramRequirementLink =
      isSameProgramRequirementLink(
        baseUrl,
        resolvedUrl,
        linkText,
        highSignal
      ) ||
      sameOriginHighSignalRequirementDocumentLink;

    if (
      titleTokens.length > 0 &&
      !exactTitleMatch &&
      titleTokenOverlapCount < 1 &&
      !sameProgramRequirementLink &&
      !sameOriginHighSignalRequirementDocumentLink
    ) {
      continue;
    }

    if (GRADUATE_SUPPLEMENTAL_SOURCE_PATTERN.test(linkText)) {
      continue;
    }
    const specializationSignal = SPECIALIZATION_SUPPLEMENTAL_HTML_LINK_PATTERN.test(linkText);
    const degreeProgramSignal = LOW_SIGNAL_SUPPLEMENTAL_HTML_LINK_PATTERN.test(linkText);
    const type = highSignal
      ? "general"
      : specializationSignal
        ? "specialized"
        : degreeProgramSignal
          ? "general"
          : null;

    if (!type) {
      continue;
    }

    let score = 0;
    if (exactTitleMatch) {
      score += 20;
    }
    score += titleTokenOverlapCount * 6;
    if (highSignal) {
      score += 16;
    }
    if (/\b(prereq|prerequisite)\b/i.test(linkText)) {
      score += 10;
    }
    if (/\bcurriculum\b/i.test(linkText)) {
      score += 10;
    }
    if (/\b(admission requirements?|degree requirements?|major requirements?)\b/i.test(linkText)) {
      score += 10;
    }
    if (specializationSignal) {
      score += 7;
    }
    if (degreeProgramSignal) {
      score += 6;
    }
    if (sameProgramRequirementLink) {
      score += 12;
    }
    if (sameOriginHighSignalRequirementDocumentLink) {
      score += 12;
    }
    if (
      /(?:^|\/)(?:track|tracks|option|options|concentration|specialization|pathway|route)(?:\/|$|-)/i.test(
        resolvedUrl
      )
    ) {
      score += 4;
    }

    const existing = candidatesByUrl.get(resolvedUrl);
    if (!existing || score > existing.score) {
      candidatesByUrl.set(resolvedUrl, {
        url: resolvedUrl,
        label,
        score,
        type,
        sameProgramRequirementLink,
      });
    }
  }

  return [...candidatesByUrl.values()]
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 8);
}

function isHistoricalSupplementalPdfLabel(label) {
  const normalizedLabel = normalizeWhitespace(String(label ?? ""));
  if (!normalizedLabel) {
    return false;
  }

  return (
    /\bprior years?\b/i.test(normalizedLabel) ||
    /\b(?:autumn|winter|spring|summer)\b/i.test(normalizedLabel) ||
    /\b(?:19|20)\d{2}\b/.test(normalizedLabel)
  );
}

function extractSupplementalPdfLinkCandidates(entry, html) {
  const baseUrl = normalizeUrlForComparison(entry.url);
  if (!baseUrl) {
    return [];
  }

  const entryOrigin = new URL(baseUrl).origin;
  const exactTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  const titleTokens = getTitleScopeTokens(entry);
  const candidatesByUrl = new Map();
  let linkIndex = 0;

  for (const match of String(html ?? "").matchAll(HTML_LINK_PATTERN)) {
    linkIndex += 1;

    const href = normalizeWhitespace(match[1] ?? match[2] ?? "");
    const label = stripHtml(match[3]);

    if (!href || !label || !/\.pdf(?:$|[?#])/i.test(href) || /^(?:#|javascript:|mailto:|tel:)/i.test(href)) {
      continue;
    }

    let resolvedUrl = null;
    try {
      resolvedUrl = normalizeUrlForComparison(new URL(href, entry.url).href);
    } catch {
      resolvedUrl = null;
    }

    if (!resolvedUrl || !resolvedUrl.startsWith(entryOrigin)) {
      continue;
    }

    const normalizedLabel = normalizeMatcherText(label);
    const normalizedLinkText = normalizeMatcherText(`${label} ${resolvedUrl}`);
    const exactTitleMatch = Boolean(exactTitle && normalizedLabel.includes(exactTitle));
    const titleTokenOverlapCount = titleTokens.filter((token) =>
      normalizedLinkText.includes(token)
    ).length;
    const sameProgramRequirementLink = isSameProgramRequirementLink(
      baseUrl,
      resolvedUrl,
      `${label} ${resolvedUrl}`,
      /\b(requirements?|degree|curriculum|worksheet|checklist|plan of study|program of study|study plan|sample plan)\b/i.test(
        `${label} ${href}`
      )
    );

    if (!exactTitleMatch && titleTokenOverlapCount < 2 && !sameProgramRequirementLink) {
      continue;
    }

    const historical = isHistoricalSupplementalPdfLabel(label);
    let score = 0;
    if (exactTitleMatch) {
      score += 30;
    }
    score += titleTokenOverlapCount * 8;
    if (/\b(requirements?|degree|curriculum|worksheet|checklist)\b/i.test(`${label} ${href}`)) {
      score += 12;
    }
    if (/\/wp-content\/uploads\//i.test(resolvedUrl)) {
      score += 6;
    }
    if (sameProgramRequirementLink) {
      score += 12;
    }
    if (historical) {
      score -= 30;
    }

    const existing = candidatesByUrl.get(resolvedUrl);
    if (!existing || score > existing.score || (score === existing.score && linkIndex < existing.linkIndex)) {
      candidatesByUrl.set(resolvedUrl, {
        url: resolvedUrl,
          label,
          score,
          exactTitleMatch,
          sameProgramRequirementLink,
          historical,
          linkIndex,
        });
    }
  }

  return [...candidatesByUrl.values()]
    .filter((candidate) => candidate.score >= 24)
    .sort((left, right) => right.score - left.score || left.linkIndex - right.linkIndex)
    .slice(0, 2);
}

async function parseSupplementalHtmlSources(entry, html, timeoutMs, visitedUrls) {
  const candidates = extractSupplementalHtmlLinkCandidates(entry, html);
  if (!candidates.length) {
    return [];
  }

  const parsedGeneralSources = [];
  const parsedSpecializationSources = [];

  for (const candidate of candidates) {
    if (visitedUrls.has(candidate.url)) {
      continue;
    }

    try {
      const rawParsed = await parseHtmlSource(
        {
          ...entry,
          url: candidate.url,
          label: candidate.label,
        },
        timeoutMs,
        {
          allowLinkedRecovery: false,
          visitedUrls: new Set([...visitedUrls, candidate.url]),
        }
      );
      const parsed = filterParsedSupplementalHtmlCandidateCourses(candidate, rawParsed);

      if (!hasMeaningfulParsedContent(parsed)) {
        continue;
      }

      const parsedAlignmentScore = getParsedOwnerAlignmentScore(
        {
          ...entry,
          url: candidate.url,
          label: candidate.label,
        },
        parsed
      );
      const minimumAlignmentScore = candidate.sameProgramRequirementLink
        ? 0
        : candidate.type === "general"
          ? 3
          : 2;
      if (parsedAlignmentScore < minimumAlignmentScore) {
        continue;
      }
      if (
        candidate.type === "general" &&
        !candidate.sameProgramRequirementLink &&
        parsedAlignmentScore < 10 &&
        parsed.courseCodes.length > 50
      ) {
        continue;
      }

      const supplementalSource = {
        kind: candidate.type,
        entry: {
          label: candidate.label,
          url: candidate.url,
        },
        parsed,
      };

      if (candidate.type === "general") {
        parsedGeneralSources.push(supplementalSource);
      } else if (candidate.type === "specialized") {
        parsedSpecializationSources.push(supplementalSource);
      }
    } catch {
      // Keep the main page parse if a linked official page fails.
    }
  }

  return [
    ...parsedGeneralSources,
    ...buildSharedSpecializationSupplementalSource(
      {
        title: null,
        courseCodes: [],
      },
      parsedSpecializationSources,
      entry.parserType
    ),
  ];
}

function getParsedDegreeSheetSignalScore(parsed) {
  const sampledText = normalizeMatcherText(
    [
      ...(parsed.snapshotLines ?? []).slice(0, 8),
      ...(parsed.requirementCueLines ?? []).slice(0, 12),
    ].join(" ")
  );

  let score = 0;
  if (/\bbefore applying\b/.test(sampledText)) {
    score += 4;
  }
  if (/\bdenotes prerequisites\b/.test(sampledText)) {
    score += 4;
  }
  if (/\bareas of inquiry\b/.test(sampledText)) {
    score += 2;
  }
  if (/\bmathematics natural sciences\b/.test(sampledText)) {
    score += 2;
  }
  if (/\bfundamentals\b/.test(sampledText)) {
    score += 2;
  }
  if (/\bcore and electives\b/.test(sampledText)) {
    score += 2;
  }
  if (/\badditional requirements\b/.test(sampledText)) {
    score += 2;
  }
  return score;
}

function shouldPreferSupplementalPdfSource(entry, baseParsed, candidate, pdfParsed) {
  if (!candidate?.exactTitleMatch || candidate?.historical || !hasMeaningfulParsedContent(pdfParsed)) {
    return false;
  }

  const pdfEntry = {
    ...entry,
    url: candidate.url,
    label: candidate.label,
    parserType: "pdf-degree-sheet",
  };
  const pdfAlignment = getParsedOwnerAlignmentScore(pdfEntry, pdfParsed);
  if (pdfAlignment < 2) {
    return false;
  }

  const pdfCourseCount = pdfParsed.courseCodes?.length ?? 0;
  if (pdfCourseCount < 4) {
    return false;
  }

  const pdfSignalScore = getParsedDegreeSheetSignalScore(pdfParsed);
  const baseSignalScore = getParsedDegreeSheetSignalScore(baseParsed);
  if (pdfSignalScore >= Math.max(4, baseSignalScore + 2)) {
    return true;
  }

  const baseCourseCount = baseParsed.courseCodes?.length ?? 0;
  return pdfCourseCount >= Math.max(6, Math.floor(baseCourseCount * 0.35));
}

async function parseSupplementalPdfSources(entry, html, timeoutMs, visitedUrls) {
  const candidates = extractSupplementalPdfLinkCandidates(entry, html);
  if (!candidates.length) {
    return [];
  }

  const parsedPdfSources = [];

  for (const candidate of candidates) {
    if (visitedUrls.has(candidate.url)) {
      continue;
    }

    try {
      const parsed = await parsePdfSource(
        {
          ...entry,
          url: candidate.url,
          label: candidate.label,
          parserType: "pdf-degree-sheet",
        },
        timeoutMs
      );

      if (!hasMeaningfulParsedContent(parsed)) {
        continue;
      }

      const parsedAlignmentScore = getParsedOwnerAlignmentScore(
        {
          ...entry,
          url: candidate.url,
          label: candidate.label,
          parserType: "pdf-degree-sheet",
        },
        parsed
      );
      if (parsedAlignmentScore < 2) {
        continue;
      }

      parsedPdfSources.push({
        candidate,
        parsed,
      });
    } catch {
      // Keep the main page parse if a linked official PDF fails.
    }
  }

  return parsedPdfSources;
}

function getParsedOwnerAlignmentScore(entry, parsed) {
  const exactTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  const sampledText = normalizeMatcherText(
    [
      parsed.title,
      ...(parsed.headings ?? []).slice(0, 8),
      ...(parsed.snapshotLines ?? []).slice(0, 12),
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (exactTitle && sampledText.includes(exactTitle)) {
    return 10;
  }

  const tokenMatches = getTitleScopeTokens(entry).filter((token) => sampledText.includes(token))
    .length;
  const baseRouteAliasTokens = getBaseRouteOwnerAliasTokens(entry);
  if (
    tokenMatches < 2 &&
    baseRouteAliasTokens.length > 0 &&
    baseRouteAliasTokens.every((token) => sampledText.includes(token)) &&
    /\b(bachelor|major|b a)\b/.test(sampledText)
  ) {
    return 2;
  }

  return tokenMatches;
}

function isFocusedDegreeSource(entry) {
  return (
    getSourceRoleScore(entry) >= 4 ||
    ["html-degree-page", "html-curriculum-page", "catalog-page", "pdf-degree-sheet", "pdf-worksheet"].includes(
      entry.parserType
    )
  );
}

function isBroadSupplementalSource(entry) {
  return (
    getSourceRoleScore(entry) <= 2 ||
    ["html-overview-page", "generic-html"].includes(entry.parserType)
  );
}

function isLegacyStudentCatalogSource(entryOrUrl) {
  const url = typeof entryOrUrl === "string" ? entryOrUrl : entryOrUrl?.url;
  return LEGACY_STUDENT_GENCAT_SOURCE_URL_PATTERN.test(String(url ?? ""));
}

function isSharedLanguageDepartmentSource(entryOrUrl) {
  const sourceText = normalizeMatcherText(
    typeof entryOrUrl === "string"
      ? entryOrUrl
      : `${entryOrUrl?.url ?? ""} ${entryOrUrl?.label ?? ""} ${entryOrUrl?.sourceLabel ?? ""} ${entryOrUrl?.ownerTitle ?? ""}`
  );

  return (
    sourceText.includes("frenchitalian") ||
    (sourceText.includes("french") && sourceText.includes("italian"))
  );
}

function isWeakParsedResult(entry, parsed) {
  return (
    (parsed.courseCodes?.length ?? 0) === 0 ||
    parsed.parseConfidence !== "high" ||
    getParsedOwnerAlignmentScore(entry, parsed) < 2 ||
    Boolean(parsed.usedSnapshotFallback)
  );
}

function getParsedResultScore(entry, parsed) {
  return (
    getParsedOwnerAlignmentScore(entry, parsed) * 100 +
    (parsed.courseCodes?.length ?? 0) * 12 +
    (parsed.requirementCueLines?.length ?? 0) * 3 +
    (parsed.chooseStatements?.length ?? 0) * 2 +
    (parsed.pathwayLabels?.length ?? 0)
  );
}

function shouldEvaluateAlternateSources(entry, parsed) {
  return isWeakParsedResult(entry, parsed);
}

function shouldAllowAlternateToReplaceBestSource(
  bestEntry,
  bestParsed,
  alternateEntry,
  alternateParsed
) {
  if (!hasMeaningfulParsedContent(alternateParsed)) {
    return false;
  }

  const bestCourseCount = bestParsed.courseCodes?.length ?? 0;
  const alternateCourseCount = alternateParsed.courseCodes?.length ?? 0;
  if (
    bestCourseCount > 0 &&
    alternateCourseCount === 0 &&
    isFocusedDegreeSource(bestEntry) &&
    isBroadSupplementalSource(alternateEntry)
  ) {
    return false;
  }

  if (!isFocusedDegreeSource(bestEntry)) {
    return true;
  }

  if (isLegacyStudentCatalogSource(alternateEntry)) {
    return false;
  }

  const bestIsWeak = isWeakParsedResult(bestEntry, bestParsed);
  const bestAlignment = getParsedOwnerAlignmentScore(bestEntry, bestParsed);
  const alternateAlignment = getParsedOwnerAlignmentScore(alternateEntry, alternateParsed);

  if (!bestIsWeak) {
    if (alternateAlignment <= bestAlignment) {
      return false;
    }
  }

  if (!isBroadSupplementalSource(alternateEntry)) {
    return true;
  }

  return bestIsWeak;
}

function shouldMergeSupplementalAlternateSource(
  baseEntry,
  baseParsed,
  alternateEntry,
  alternateParsed
) {
  if (!hasMeaningfulParsedContent(alternateParsed)) {
    return false;
  }

  if (getParsedOwnerAlignmentScore(alternateEntry, alternateParsed) < 2) {
    return false;
  }

  if (
    isFocusedDegreeSource(baseEntry) &&
    isLegacyStudentCatalogSource(alternateEntry) &&
    isSharedLanguageDepartmentSource(baseEntry)
  ) {
    return false;
  }

  const baseIsWeak = isWeakParsedResult(baseEntry, baseParsed);

  if (!baseIsWeak && isLegacyStudentCatalogSource(alternateEntry)) {
    return false;
  }

  if (!baseIsWeak && isFocusedDegreeSource(baseEntry) && isFocusedDegreeSource(alternateEntry)) {
    return false;
  }

  if (isFocusedDegreeSource(baseEntry) && isBroadSupplementalSource(alternateEntry)) {
    return false;
  }

  const baseCourseCodes = new Set(baseParsed.courseCodes ?? []);
  const addsCourseCodes = (alternateParsed.courseCodes ?? []).some((code) => !baseCourseCodes.has(code));
  const baseCueLines = new Set(baseParsed.requirementCueLines ?? []);
  const addsCueLines = (alternateParsed.requirementCueLines ?? []).some(
    (line) => !baseCueLines.has(line)
  );
  const baseChooseStatements = new Set(baseParsed.chooseStatements ?? []);
  const addsChooseStatements = (alternateParsed.chooseStatements ?? []).some(
    (line) => !baseChooseStatements.has(line)
  );

  return addsCourseCodes || addsCueLines || addsChooseStatements;
}

function preservePrimaryPdfDegreeSheetParserType(
  parserType,
  sourceUrl,
  primarySourceUrl
) {
  const normalizedParserType = String(parserType ?? "").trim();
  const normalizedPrimarySourceUrl = String(primarySourceUrl ?? "").trim();
  const normalizedSourceUrl = String(sourceUrl ?? "").trim();
  const pdfUrl = normalizedPrimarySourceUrl || normalizedSourceUrl;

  if (
    normalizedParserType === "generic-pdf" &&
    /\.pdf(?:$|[?#])/i.test(pdfUrl)
  ) {
    return "pdf-degree-sheet";
  }

  return normalizedParserType || parserType;
}

function resolveManifestBackedParserType(
  sourceEntryParserType,
  parserType,
  sourceUrl,
  primarySourceUrl
) {
  const normalizedSourceEntryParserType = String(sourceEntryParserType ?? "").trim();
  if (normalizedSourceEntryParserType && normalizedSourceEntryParserType !== "unknown") {
    return normalizedSourceEntryParserType;
  }

  return preservePrimaryPdfDegreeSheetParserType(
    parserType,
    sourceUrl,
    primarySourceUrl
  );
}

function recoverStructuredCourseCodesFromSourceEvidence(entry, structuredCourseCodes, parsed) {
  if (!structuredCourseCodes.length) {
    return [];
  }

  const evidenceLines = uniqueInOrder([
    ...(parsed.requirementCueLines ?? []),
    ...(parsed.chooseStatements ?? []),
    ...(parsed.snapshotLines ?? []),
  ]);
  if (!evidenceLines.length) {
    return [];
  }

  const sourceEvidenceCourseCodes = filterParsedCourseCodesByHints(
    entry,
    evidenceLines,
    uniqueSorted(evidenceLines.flatMap((line) => extractCourseCodesFromLine(line)))
  );
  const sourceEvidenceCourseCodeSet = new Set(sourceEvidenceCourseCodes);

  return structuredCourseCodes.filter((courseCode) => sourceEvidenceCourseCodeSet.has(courseCode));
}

function buildManifestParseSuccess(
  baseResult,
  structuredCourseCodes,
  resolvedEntry,
  parsed,
  resolutionStrategy
) {
  const effectiveSourceUrl = parsed.resolvedSourceUrl ?? resolvedEntry.url;
  const effectiveSourceLabel = parsed.resolvedSourceLabel ?? resolvedEntry.label;
  const resolvedToDifferentSource =
    effectiveSourceUrl !== resolvedEntry.url || effectiveSourceLabel !== resolvedEntry.label;
  const effectiveParserType = resolvedToDifferentSource
    ? preservePrimaryPdfDegreeSheetParserType(
        parsed.resolvedParserType,
        effectiveSourceUrl,
        baseResult.primarySourceUrl
      )
    : resolveManifestBackedParserType(
        resolvedEntry.parserType,
        parsed.resolvedParserType,
        effectiveSourceUrl,
        baseResult.primarySourceUrl
      );
  const effectiveEntry =
    effectiveSourceUrl === resolvedEntry.url &&
    effectiveSourceLabel === resolvedEntry.label &&
    effectiveParserType === resolvedEntry.parserType
      ? resolvedEntry
      : {
          ...resolvedEntry,
          url: effectiveSourceUrl,
          label: effectiveSourceLabel,
          parserType: effectiveParserType,
        };
  const initialParsedCourseCodes = uniqueSorted([
    ...(parsed.courseCodes ?? []),
    ...recoverStructuredCourseCodesFromSourceEvidence(effectiveEntry, structuredCourseCodes, parsed),
  ]);
  const parsedRequirementGroups = buildParsedRequirementGroups(
    baseResult,
    initialParsedCourseCodes,
    parsed.snapshotLines
  );
  const parsedRequirementCourses = buildKnownMaterialsScienceRequirementCourses(
    baseResult,
    parsedRequirementGroups
  );
  const parsedRequirementReplacements =
    buildKnownMaterialsScienceRequirementReplacements(baseResult);
  const parsedCourseCodes = uniqueSorted([
    ...initialParsedCourseCodes,
    ...extractParsedRequirementGroupCourseCodes(parsedRequirementGroups),
    ...(parsedRequirementCourses ?? []).map((course) => course.normalizedCourseCode),
  ]);
  const sourceOnlyCourseCodes = parsedCourseCodes.filter(
    (code) => !structuredCourseCodes.includes(code)
  );
  const structuredOnlyCourseCodes = structuredCourseCodes.filter(
    (code) => !parsedCourseCodes.includes(code)
  );
  const snapshotPath =
    parsed.snapshotPath ??
    writeSnapshot(baseResult.ownerId, effectiveSourceUrl, parsed.title, parsed.snapshotLines);
  const parsedRequirementAtomCandidates = buildParsedRequirementAtomCandidates(
    baseResult,
    parsedCourseCodes,
    parsed.snapshotLines
  );
  const parsedDegreeMapBlockCandidates = buildParsedDegreeMapBlockCandidates(
    baseResult,
    parsedCourseCodes,
    parsed.requirementCueLines,
    parsed.chooseStatements,
    parsed.pathwayLabels,
    parsed.headings
  );

  return {
    ...baseResult,
    parserType: effectiveParserType,
    adapterId: selectRequirementSourceAdapter(effectiveEntry).id,
    adapterFamily: selectRequirementSourceAdapter(effectiveEntry).family,
    sourceUrl: effectiveSourceUrl,
    sourceLabel: effectiveSourceLabel,
    sourceRole: parsed.sourceRole ?? classifyRequirementSourceRole(effectiveEntry),
    sourceSectionAudit: parsed.sourceSectionAudit ?? null,
    resolutionStrategy,
    ok: true,
    extractedTitle: parsed.title,
    extractedHeadings: parsed.headings,
    requirementCueLines: parsed.requirementCueLines,
    chooseStatements: parsed.chooseStatements,
    pathwayLabels: parsed.pathwayLabels,
    parsedUwCourseCodes: parsedCourseCodes,
    sourceOnlyUwCourseCodes: sourceOnlyCourseCodes,
    structuredOnlyUwCourseCodes: structuredOnlyCourseCodes,
    parsedRequirementAtomCandidates,
    parsedDegreeMapBlockCandidates,
    parsedRequirementGroups,
    parsedRequirementCourses,
    parsedRequirementReplacements,
    parseConfidence: parsed.parseConfidence,
    snapshotPath,
    usedSnapshotFallback: Boolean(parsed.usedSnapshotFallback),
    snapshotFallbackReason: parsed.snapshotFallbackReason ?? null,
    error: null,
  };
}

async function parseManifestEntry(entry, timeoutMs, options = {}) {
  const structuredCourseCodes = getStructuredUwCourseCodes(entry);
  const primaryAdapter = selectRequirementSourceAdapter(entry);
  const baseResult = {
    ownerId: entry.ownerId,
    ownerTitle: entry.ownerTitle,
    planId: entry.planId,
    pathwayId: entry.pathwayId,
    campusId: entry.campusId,
    primaryParserType: entry.parserType,
    primarySourceUrl: entry.url,
    primarySourceLabel: entry.label,
    structuredUwCourseCodes: structuredCourseCodes,
  };
  const snapshotOnly = options.snapshotOnly === true;

  if (snapshotOnly) {
    const snapshotParsed = parseSnapshotSource(entry, new Error("snapshot-only mode"));
    if (snapshotParsed) {
      return buildManifestParseSuccess(
        baseResult,
        structuredCourseCodes,
        entry,
        snapshotParsed,
        "cached-snapshot"
      );
    }

    return {
      ...baseResult,
      parserType: entry.parserType,
      adapterId: primaryAdapter.id,
      adapterFamily: primaryAdapter.family,
      sourceUrl: entry.url,
      sourceLabel: entry.label,
      sourceRole: classifyRequirementSourceRole(entry),
      sourceSectionAudit: null,
      resolutionStrategy: "cached-snapshot",
      ok: false,
      extractedTitle: null,
      extractedHeadings: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: [],
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: structuredCourseCodes,
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      parsedRequirementGroups: [],
      parsedRequirementCourses: [],
      parsedRequirementReplacements: [],
      parseConfidence: "low",
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: "snapshot-only mode but no cached snapshot was available",
      error: "Snapshot-only mode could not find a cached source snapshot.",
    };
  }

  try {
    const parsed = await primaryAdapter.parse(entry, timeoutMs);
    let bestEntry = entry;
    let bestParsed = parsed;
    let bestResolutionStrategy = "primary-source";
    let bestScore = getParsedResultScore(entry, parsed);
    const alternateEntries = getAlternateParseableManifestEntries(entry);
    const hasFocusedAlternateSource = alternateEntries.some((candidate) =>
      isFocusedDegreeSource(candidate)
    );
    const shouldInspectAlternateSources =
      shouldEvaluateAlternateSources(entry, parsed) ||
      structuredCourseCodes.length > 0 ||
      (!isFocusedDegreeSource(entry) && hasFocusedAlternateSource);
    const parsedAlternates = [];

    if (shouldInspectAlternateSources) {
      for (const alternateEntry of alternateEntries) {
        try {
          const alternateAdapter = selectRequirementSourceAdapter(alternateEntry);
          const alternateParsed = await alternateAdapter.parse(alternateEntry, timeoutMs);
          if (!hasMeaningfulParsedContent(alternateParsed)) {
            continue;
          }

           parsedAlternates.push({
            entry: alternateEntry,
            parsed: alternateParsed,
          });

          const alternateScore = getParsedResultScore(alternateEntry, alternateParsed);
          if (
            shouldAllowAlternateToReplaceBestSource(
              bestEntry,
              bestParsed,
              alternateEntry,
              alternateParsed
            ) &&
            alternateScore > bestScore
          ) {
            bestEntry = alternateEntry;
            bestParsed = alternateParsed;
            bestResolutionStrategy = "alternate-official-source";
            bestScore = alternateScore;
          }
        } catch {
          // Keep the strongest official parse result available.
        }
      }
    }

    const supplementalSources = [
      ...(bestEntry.id === entry.id ? [] : [{ entry, parsed }]),
      ...parsedAlternates.filter(
        (alternate) =>
          alternate.entry.id !== bestEntry.id &&
          shouldMergeSupplementalAlternateSource(
            bestEntry,
            bestParsed,
            alternate.entry,
            alternate.parsed
          )
      ),
    ];
    const mergedParsed = mergeParsedSources(bestParsed, supplementalSources, bestEntry.parserType);

    return buildManifestParseSuccess(
      baseResult,
      structuredCourseCodes,
      bestEntry,
      mergedParsed,
      bestResolutionStrategy
    );
  } catch (error) {
    for (const alternateEntry of getAlternateParseableManifestEntries(entry)) {
      try {
        const alternateAdapter = selectRequirementSourceAdapter(alternateEntry);
        const parsed = await alternateAdapter.parse(alternateEntry, timeoutMs);
        if (!hasMeaningfulParsedContent(parsed)) {
          continue;
        }

        return buildManifestParseSuccess(
          baseResult,
          structuredCourseCodes,
          alternateEntry,
          parsed,
          "alternate-official-source"
        );
      } catch {
        // Keep trying other official sources for the same owner before falling back to cached snapshots.
      }
    }

    const snapshotParsed = parseSnapshotSource(entry, error);
    if (snapshotParsed) {
      return buildManifestParseSuccess(
        baseResult,
        structuredCourseCodes,
        entry,
        snapshotParsed,
        "cached-snapshot"
      );
    }

    return {
      ...baseResult,
      parserType: entry.parserType,
      adapterId: primaryAdapter.id,
      adapterFamily: primaryAdapter.family,
      sourceUrl: entry.url,
      sourceLabel: entry.label,
      sourceRole: classifyRequirementSourceRole(entry),
      sourceSectionAudit: null,
      resolutionStrategy: "primary-source",
      ok: false,
      extractedTitle: null,
      extractedHeadings: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: [],
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: structuredCourseCodes,
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      parsedRequirementGroups: [],
      parsedRequirementCourses: [],
      parsedRequirementReplacements: [],
      parseConfidence: "low",
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: error.message,
    };
  }
}

function getParseablePrimaryEntries(targetPlanId = null) {
  return TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
    (entry) =>
      (entry.ownerType === "major" || entry.ownerType === "pathway") &&
      entry.campusId &&
      entry.campusId !== "grc" &&
      (!targetPlanId || entry.planId === targetPlanId) &&
      entry.isPrimaryDegreeRequirementsLink &&
      PARSEABLE_PARSER_TYPES.has(entry.parserType)
  ).sort((left, right) => left.ownerTitle.localeCompare(right.ownerTitle));
}

function countBy(values, getKey) {
  return values.reduce((counts, value) => {
    const key = getKey(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

const UW_MSE_EXPECTED_OPTION_COURSES = [
  "AA 260",
  "BIOEN 215",
  "BSE 201",
  "CHEME 355",
  "CSE 123",
  "CSE 143",
  "CSE 160",
  "CSE 164",
  "CSE 180",
  "EE 215",
  "ENGR 101",
  "ENGR 333",
  "ENGR 490",
  "INDE 250",
  "INDE 315",
  "ME 123",
  "ME 230",
  "NME 220",
  "MSE 450",
  "MSE 452",
  "MSE 462",
  "MSE 463",
  "MSE 466",
  "MSE 471",
  "MSE 473",
  "MSE 474",
  "MSE 475",
  "MSE 476",
  "MSE 477",
  "MSE 478",
  "MSE 479",
  "MSE 481",
  "MSE 482",
  "MSE 483",
  "MSE 484",
  "MSE 486",
  "MSE 487",
  "MSE 488",
  "MSE 489",
  "MSE 490",
  "MSE 498",
  "MSE 499",
  "AMATH 352",
  "AMATH 353",
  "AMATH 383",
  "AMATH 401",
  "AMATH 403",
  "BIOC 405",
  "BIOC 406",
  "CHEM 312",
  "CHEM 455",
  "CHEM 456",
  "CHEM 457",
  "CHEME 341",
  "ENGR 321",
  "ENVIR 480",
  "PHYS 321",
  "PHYS 324",
  "PHYS 325",
  "PHYS 334",
  "PHYS 335",
  "PHYS 434",
  "PHYS 441",
  "ENTRE 370",
  "ENTRE 440",
].map((courseCode) => normalizeCourseCode(courseCode));

function buildUwMseCourseExtractionAuditForOwner(owner) {
  const courses = owner?.parsedRequirementCourses ?? [];
  const normalizedCourseCodes = courses.map((course) => course.normalizedCourseCode).filter(Boolean);
  const normalizedCourseCodeSet = new Set(normalizedCourseCodes);
  const groupedCountsByCategory = countBy(courses, (course) => course.category || "unclassified");
  const duplicateNormalizedCourseCodes = Object.entries(countBy(normalizedCourseCodes, (courseCode) => courseCode))
    .filter(([, count]) => count > 1)
    .map(([courseCode]) => courseCode)
    .sort();
  const missingExpectedCourses = UW_MSE_EXPECTED_OPTION_COURSES.filter(
    (courseCode) => !normalizedCourseCodeSet.has(courseCode)
  );
  const unclassifiedCourseCodes = courses
    .filter((course) => !course.category || course.category === "unclassified")
    .map((course) => course.normalizedCourseCode);
  const coursesMissingRequiredMetadata = courses
    .filter(
      (course) =>
        !course.requirementGroupId ||
        !course.requirementType ||
        !course.optionRole ||
        !course.sourceHeading ||
        !course.category
    )
    .map((course) => course.normalizedCourseCode);
  const noteOrRestrictionEntries = courses.filter((course) => (course.notes ?? []).length > 0);
  const countsByOptionRole = countBy(courses, (course) => course.optionRole || "unclassified");

  return {
    ownerId: owner?.ownerId ?? null,
    totalParsedOfficialEntries: courses.length,
    groupedCountsByCategory,
    missingExpectedCourses,
    duplicateNormalizedCourseCodes,
    unclassifiedCourseCodes,
    coursesMissingRequiredMetadata,
    noteOrRestrictionEntries: noteOrRestrictionEntries.map((course) => ({
      courseCode: course.courseCode,
      normalizedCourseCode: course.normalizedCourseCode,
      requirementGroupId: course.requirementGroupId,
      optionRole: course.optionRole,
      notes: course.notes ?? [],
    })),
    requiredVsOptionCounts: {
      required: countsByOptionRole.required ?? 0,
      option: countsByOptionRole.option ?? 0,
      alias: countsByOptionRole.alias ?? 0,
      noteOnly: countsByOptionRole.note_only ?? 0,
    },
  };
}

function buildUwMseCourseExtractionAudit(owners) {
  const owner = (owners ?? []).find(
    (entry) =>
      entry.planId === "uw-seattle-materials-science-engineering" && !entry.pathwayId
  );
  if (!owner) {
    return null;
  }

  return buildUwMseCourseExtractionAuditForOwner(owner);
}

function mergeParsedOwners(previousOwners, nextOwners, targetPlanId) {
  if (!targetPlanId) {
    return [...nextOwners].sort((left, right) => left.ownerTitle.localeCompare(right.ownerTitle));
  }

  return [...(previousOwners ?? []).filter((owner) => owner?.planId !== targetPlanId), ...nextOwners].sort(
    (left, right) =>
      left.ownerTitle.localeCompare(right.ownerTitle) ||
      String(left.ownerId ?? "").localeCompare(String(right.ownerId ?? ""))
  );
}

function buildParseReport(owners, options = {}) {
  const mergedOwners = mergeParsedOwners(
    options.previousOwners ?? [],
    owners,
    options.targetPlanId ?? null
  );
  const fullOwners = mergedOwners;
  const scopedOwners = options.targetPlanId
    ? fullOwners.filter((owner) => owner.planId === options.targetPlanId)
    : fullOwners;

  return {
    generatedAt: new Date().toISOString(),
    totalOwners: fullOwners.length,
    okCount: fullOwners.filter((owner) => owner.ok).length,
    failedCount: fullOwners.filter((owner) => !owner.ok).length,
    parsedRequirementSourceBlockCount: fullOwners.length,
    parsedRequirementAtomCandidateCount: fullOwners.reduce(
      (count, owner) => count + owner.parsedRequirementAtomCandidates.length,
      0
    ),
    parsedDegreeMapBlockCandidateCount: fullOwners.reduce(
      (count, owner) => count + owner.parsedDegreeMapBlockCandidates.length,
      0
    ),
    parsedRequirementCourseCount: fullOwners.reduce(
      (count, owner) => count + (owner.parsedRequirementCourses ?? []).length,
      0
    ),
    snapshotFallbackCount: fullOwners.filter((owner) => owner.usedSnapshotFallback).length,
    countsByAdapterId: countBy(fullOwners, (owner) => owner.adapterId),
    countsByAdapterFamily: countBy(fullOwners, (owner) => owner.adapterFamily),
    countsByCampus: countBy(fullOwners, (owner) => owner.campusId),
    countsByResolutionStrategy: countBy(fullOwners, (owner) => owner.resolutionStrategy),
    countsBySourceRole: countBy(fullOwners, (owner) => owner.sourceRole ?? "ignored"),
    withParsedCourseCodesCount: fullOwners.filter((owner) => owner.parsedUwCourseCodes.length > 0).length,
    withSourceOnlyCourseCodesCount: fullOwners.filter(
      (owner) => owner.sourceOnlyUwCourseCodes.length > 0
    ).length,
    withNoParsedCourseCodesCount: fullOwners.filter(
      (owner) => owner.ok && owner.parsedUwCourseCodes.length === 0
    ).length,
    ownersWithQualityWarningsCount: fullOwners.filter((owner) =>
      owner.qualitySignals.some((signal) => signal.severity === "warning")
    ).length,
    ownersWithQualityNotesCount: fullOwners.filter((owner) =>
      owner.qualitySignals.some((signal) => signal.severity === "note")
    ).length,
    qualityWarningCount: fullOwners.reduce(
      (count, owner) =>
        count + owner.qualitySignals.filter((signal) => signal.severity === "warning").length,
      0
    ),
    qualityNoteCount: fullOwners.reduce(
      (count, owner) =>
        count + owner.qualitySignals.filter((signal) => signal.severity === "note").length,
      0
    ),
    countsByQualitySignalCode: countBy(
      fullOwners.flatMap((owner) => owner.qualitySignals),
      (signal) => signal.code
    ),
    targetPlanId: options.targetPlanId ?? null,
    targetOwnerCount: scopedOwners.length,
    sourceSectionAuditLines: scopedOwners
      .map((owner) => owner.sourceSectionAudit?.line ?? null)
      .filter(Boolean),
    uwMseCourseExtractionAudit: buildUwMseCourseExtractionAudit(mergedOwners),
    owners: mergedOwners,
  };
}

function addQualitySignal(signals, severity, code, message, details = null) {
  signals.push({
    severity,
    code,
    message,
    details,
  });
}

function getStructuredCoverageCount(owner) {
  const parsedCount = owner.parsedUwCourseCodes.length;
  const sourceOnlyCount = owner.sourceOnlyUwCourseCodes.length;
  const structuredOnlyCount = owner.structuredOnlyUwCourseCodes.length;
  const overlapCount = Math.max(0, parsedCount - sourceOnlyCount);
  return overlapCount + structuredOnlyCount;
}

function buildParseQualitySignals(owner) {
  const signals = [];
  const parsedCount = owner.parsedUwCourseCodes.length;
  const sourceOnlyCount = owner.sourceOnlyUwCourseCodes.length;
  const structuredOnlyCount = owner.structuredOnlyUwCourseCodes.length;
  const structuredCoverageCount = getStructuredCoverageCount(owner);

  if (sourceOnlyCount >= 5 || structuredOnlyCount >= 5 || (sourceOnlyCount >= 3 && structuredOnlyCount >= 3)) {
    addQualitySignal(
      signals,
      "warning",
      "material-source-structured-drift",
      "Parsed source course coverage diverges materially from the structured degree-map coverage.",
      `parsed=${parsedCount}; source-only=${sourceOnlyCount}; structured-only=${structuredOnlyCount}`
    );
  }

  if (structuredOnlyCount >= 8) {
    addQualitySignal(
      signals,
      "warning",
      "large-structured-only-course-gap",
      "Structured degree-map coverage includes many UW course codes that were not recovered from the parsed source.",
      `structured-only=${structuredOnlyCount}; parsed=${parsedCount}; structured-coverage=${structuredCoverageCount}`
    );
  }

  if (
    owner.parseConfidence === "high" &&
    structuredCoverageCount >= 8 &&
    (parsedCount <= Math.max(2, Math.floor(structuredCoverageCount / 3)) ||
      structuredOnlyCount >= Math.max(6, Math.ceil(structuredCoverageCount * 0.6)))
  ) {
    addQualitySignal(
      signals,
      "warning",
      "high-confidence-low-course-coverage",
      "The parser reported high confidence, but the recovered UW course coverage looks suspiciously low for this owner.",
      `parsed=${parsedCount}; structured-coverage=${structuredCoverageCount}; structured-only=${structuredOnlyCount}`
    );
  }

  if (owner.usedSnapshotFallback) {
    addQualitySignal(
      signals,
      "note",
      "snapshot-fallback-used",
      "Parsing relied on a cached snapshot after a live-source failure.",
      owner.snapshotFallbackReason ?? null
    );
  }

  if (owner.resolutionStrategy === "alternate-official-source") {
    addQualitySignal(
      signals,
      "note",
      "alternate-official-source-used",
      "Parsing succeeded by switching from the primary source URL to an alternate official source URL.",
      owner.sourceUrl !== owner.primarySourceUrl ? owner.sourceUrl : null
    );
  }

  if (owner.planId === "uw-seattle-materials-science-engineering" && !owner.pathwayId) {
    const audit = buildUwMseCourseExtractionAuditForOwner(owner);
    if (audit.missingExpectedCourses.length > 0) {
      addQualitySignal(
        signals,
        "warning",
        "uw-mse-expected-course-option-missing",
        "UW MSE parsed requirement course coverage is missing expected official option courses.",
        audit.missingExpectedCourses.join(", ")
      );
    }
    if (audit.coursesMissingRequiredMetadata.length > 0) {
      addQualitySignal(
        signals,
        "warning",
        "uw-mse-requirement-course-metadata-missing",
        "UW MSE parsed requirement courses are missing group/type/source metadata.",
        audit.coursesMissingRequiredMetadata.join(", ")
      );
    }
  }

  return signals;
}

function enrichParsedOwnerWithQualitySignals(owner) {
  return {
    ...owner,
    qualitySignals: buildParseQualitySignals(owner),
  };
}

function writeGeneratedRequirementSourceAdapters(report) {
  const blocks = report.owners.map((owner) => ({
    id: `${owner.ownerId}:source-block:${slugify(owner.adapterId)}`,
    ownerId: owner.ownerId,
    ownerTitle: owner.ownerTitle,
    planId: owner.planId,
    pathwayId: owner.pathwayId ?? null,
    campusId: owner.campusId,
    primaryParserType: owner.primaryParserType,
    primarySourceUrl: owner.primarySourceUrl,
    primarySourceLabel: owner.primarySourceLabel,
    parserType: owner.parserType,
    adapterId: owner.adapterId,
    adapterFamily: owner.adapterFamily,
    sourceUrl: owner.sourceUrl,
    sourceLabel: owner.sourceLabel,
    sourceRole: owner.sourceRole,
    sourceSectionAudit: owner.sourceSectionAudit,
    resolutionStrategy: owner.resolutionStrategy,
    ok: owner.ok,
    parseConfidence: owner.parseConfidence,
    parsedUwCourseCodes: owner.parsedUwCourseCodes,
    sourceOnlyUwCourseCodes: owner.sourceOnlyUwCourseCodes,
    structuredOnlyUwCourseCodes: owner.structuredOnlyUwCourseCodes,
    requirementCueLines: owner.requirementCueLines,
    chooseStatements: owner.chooseStatements,
    pathwayLabels: owner.pathwayLabels,
    qualitySignals: owner.qualitySignals,
    parsedRequirementAtomCandidates: owner.parsedRequirementAtomCandidates,
    parsedDegreeMapBlockCandidates: owner.parsedDegreeMapBlockCandidates,
    parsedRequirementGroups: (owner.parsedRequirementGroups ?? []).length
      ? owner.parsedRequirementGroups
      : undefined,
    parsedRequirementCourses: (owner.parsedRequirementCourses ?? []).length
      ? owner.parsedRequirementCourses
      : undefined,
    parsedRequirementReplacements: (owner.parsedRequirementReplacements ?? []).length
      ? owner.parsedRequirementReplacements
      : undefined,
    snapshotPath: owner.snapshotPath
      ? path.relative(REPO_ROOT, owner.snapshotPath).replace(/\\/g, "/")
      : null,
    usedSnapshotFallback: owner.usedSnapshotFallback,
    snapshotFallbackReason: owner.snapshotFallbackReason,
    error: owner.error,
  }));
  const fullOwners = report.owners ?? [];

  const chunks = [];
  for (let index = 0; index < blocks.length; index += GENERATED_CHUNK_SIZE) {
    chunks.push(blocks.slice(index, index + GENERATED_CHUNK_SIZE));
  }

  const summary = {
    generatedAt: report.generatedAt,
    totalOwners: fullOwners.length,
    okCount: fullOwners.filter((owner) => owner.ok).length,
    failedCount: fullOwners.filter((owner) => !owner.ok).length,
    parsedRequirementSourceBlockCount: blocks.length,
    parsedRequirementAtomCandidateCount: blocks.reduce(
      (count, block) => count + block.parsedRequirementAtomCandidates.length,
      0
    ),
    parsedDegreeMapBlockCandidateCount: blocks.reduce(
      (count, block) => count + block.parsedDegreeMapBlockCandidates.length,
      0
    ),
    parsedRequirementGroupCount: blocks.reduce(
      (count, block) => count + (block.parsedRequirementGroups ?? []).length,
      0
    ),
    parsedRequirementCourseCount: blocks.reduce(
      (count, block) => count + (block.parsedRequirementCourses ?? []).length,
      0
    ),
    snapshotFallbackCount: fullOwners.filter((owner) => owner.usedSnapshotFallback).length,
    countsByAdapterId: countBy(fullOwners, (owner) => owner.adapterId),
    countsByAdapterFamily: countBy(fullOwners, (owner) => owner.adapterFamily),
    countsByCampus: countBy(fullOwners, (owner) => owner.campusId),
    countsByResolutionStrategy: countBy(fullOwners, (owner) => owner.resolutionStrategy),
    countsBySourceRole: countBy(fullOwners, (owner) => owner.sourceRole ?? "ignored"),
    qualityWarningCount: fullOwners.reduce(
      (count, owner) =>
        count + owner.qualitySignals.filter((signal) => signal.severity === "warning").length,
      0
    ),
    qualityNoteCount: fullOwners.reduce(
      (count, owner) =>
        count + owner.qualitySignals.filter((signal) => signal.severity === "note").length,
      0
    ),
    countsByQualitySignalCode: countBy(
      fullOwners.flatMap((owner) => owner.qualitySignals),
      (signal) => signal.code
    ),
  };

  const lines = [
    "/* eslint-disable */",
    "/* auto-generated by scripts/planner/parse-transfer-planner-requirement-sources.cjs */",
    "",
    "import type {",
    "  TransferPlannerParsedRequirementSourceBlock,",
    "  TransferPlannerRequirementSourceAdapterSummary,",
    '} from "./schema";',
    "",
    `export const TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY = ${JSON.stringify(
      summary,
      null,
      2
    )} as TransferPlannerRequirementSourceAdapterSummary;`,
    "",
  ];

  chunks.forEach((chunk, index) => {
    lines.push(
      `const TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_CHUNK_${index}: unknown[] = ${JSON.stringify(
        chunk,
        null,
        2
      )};`,
      ""
    );
  });

  const chunkNames = chunks.map(
    (_, index) => `  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_CHUNK_${index}`
  );
  lines.push(
    "const TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS_RAW: unknown[] = ([] as unknown[]).concat(",
    `${chunkNames.join(",\n")}`,
    ");",
    "",
    "export const TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS =",
    "  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS_RAW as TransferPlannerParsedRequirementSourceBlock[];",
    ""
  );

  fs.writeFileSync(OUTPUT_TS_PATH, `${lines.join("\n")}\n`);
}

function buildMarkdownReport(report) {
  const lines = [
    "# Transfer Planner Requirement Source Parse Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Primary degree sources parsed: ${report.totalOwners}`,
    `- Parsed successfully: ${report.okCount}`,
    `- Parse failures: ${report.failedCount}`,
    `- Parsed requirement source adapter blocks: ${report.parsedRequirementSourceBlockCount}`,
    `- Parsed requirement atom candidates: ${report.parsedRequirementAtomCandidateCount}`,
    `- Parsed degree-map block candidates: ${report.parsedDegreeMapBlockCandidateCount}`,
    `- Parsed structured requirement course entries: ${report.parsedRequirementCourseCount}`,
    `- Parsed from cached snapshots after live-source failures: ${report.snapshotFallbackCount}`,
    `- Parsed from alternate official source URLs: ${report.countsByResolutionStrategy["alternate-official-source"] ?? 0}`,
    `- Owners with parsed UW course codes: ${report.withParsedCourseCodesCount}`,
    `- Owners with source-only UW course codes not currently in structured degree-map blocks: ${report.withSourceOnlyCourseCodesCount}`,
    `- Owners with no parsed UW course codes: ${report.withNoParsedCourseCodesCount}`,
    `- Owners with parser-quality warnings: ${report.ownersWithQualityWarningsCount}`,
    `- Owners with parser-quality notes: ${report.ownersWithQualityNotesCount}`,
    "",
    "## Parser Adapters",
    "",
    ...Object.entries(report.countsByAdapterId)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([adapterId, count]) => `- ${adapterId}: ${count}`),
    "",
    "## Resolution Strategies",
    "",
    ...Object.entries(report.countsByResolutionStrategy)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([resolutionStrategy, count]) => `- ${resolutionStrategy}: ${count}`),
    "",
    "## Source Roles",
    "",
    ...Object.entries(report.countsBySourceRole ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([sourceRole, count]) => `- ${sourceRole}: ${count}`),
    "",
    "## Parser Quality Signals",
    "",
    ...Object.entries(report.countsByQualitySignalCode)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, count]) => `- ${code}: ${count}`),
    "",
  ];

  if (report.uwMseCourseExtractionAudit) {
    const audit = report.uwMseCourseExtractionAudit;
    lines.push("## UW MSE Course Extraction Audit", "");
    lines.push(`- Total parsed official entries: ${audit.totalParsedOfficialEntries}`);
    lines.push(
      `- Required / option / alias / note-only counts: ${audit.requiredVsOptionCounts.required} / ${audit.requiredVsOptionCounts.option} / ${audit.requiredVsOptionCounts.alias} / ${audit.requiredVsOptionCounts.noteOnly}`
    );
    lines.push(
      `- Missing expected courses: ${audit.missingExpectedCourses.length ? audit.missingExpectedCourses.join(", ") : "none"}`
    );
    lines.push(
      `- Duplicate normalized course codes: ${audit.duplicateNormalizedCourseCodes.length ? audit.duplicateNormalizedCourseCodes.join(", ") : "none"}`
    );
    lines.push(
      `- Unclassified course codes: ${audit.unclassifiedCourseCodes.length ? audit.unclassifiedCourseCodes.join(", ") : "none"}`
    );
    lines.push(
      `- Courses missing group/type/source metadata: ${audit.coursesMissingRequiredMetadata.length ? audit.coursesMissingRequiredMetadata.join(", ") : "none"}`
    );
    lines.push("- Grouped counts by category:");
    for (const [category, count] of Object.entries(audit.groupedCountsByCategory).sort(([left], [right]) =>
      left.localeCompare(right)
    )) {
      lines.push(`  - ${category}: ${count}`);
    }
    if (audit.noteOrRestrictionEntries.length) {
      lines.push("- Courses with notes or restrictions:");
      for (const entry of audit.noteOrRestrictionEntries.slice(0, 25)) {
        lines.push(
          `  - ${entry.normalizedCourseCode}: ${(entry.notes ?? []).join(" | ")}`
        );
      }
    }
    lines.push("");
  }

  if ((report.sourceSectionAuditLines ?? []).length) {
    lines.push("## Source Section Audit", "");
    for (const auditLine of report.sourceSectionAuditLines) {
      lines.push(`- ${auditLine}`);
    }
    lines.push("");
  }

  for (const campusId of CAMPUS_ORDER) {
    const campusOwners = report.owners.filter((owner) => owner.campusId === campusId);
    if (!campusOwners.length) {
      continue;
    }

    lines.push(`## ${campusId}`, "");

    const qualityOwners = campusOwners.filter((owner) =>
      (owner.qualitySignals ?? []).some((signal) => signal.severity === "warning")
    );
    if (qualityOwners.length) {
      lines.push("### Parser-quality warnings", "");
      qualityOwners.slice(0, 50).forEach((owner) => {
        lines.push(`#### ${owner.ownerTitle}`);
        lines.push("");
        lines.push(`- Source: ${owner.sourceUrl}`);
        lines.push(`- Parse confidence: ${owner.parseConfidence}`);
        lines.push(
          `- Quality warnings: ${owner.qualitySignals
            .filter((signal) => signal.severity === "warning")
            .map((signal) => `${signal.code}${signal.details ? ` (${signal.details})` : ""}`)
            .join(" | ")}`
        );
        if (owner.primarySourceUrl !== owner.sourceUrl) {
          lines.push(`- Primary source: ${owner.primarySourceUrl}`);
        }
        lines.push("");
      });
    }

    const driftOwners = campusOwners.filter((owner) => owner.sourceOnlyUwCourseCodes.length > 0);
    if (driftOwners.length) {
      lines.push("### Possible source-vs-structured drift", "");
      driftOwners.slice(0, 50).forEach((owner) => {
        lines.push(`#### ${owner.ownerTitle}`);
        lines.push("");
        lines.push(`- Source: ${owner.sourceUrl}`);
        if (owner.primarySourceUrl !== owner.sourceUrl) {
          lines.push(`- Primary source: ${owner.primarySourceUrl}`);
        }
        lines.push(`- Parser type: ${owner.parserType}`);
        lines.push(`- Source role: ${owner.sourceRole ?? "ignored"}`);
        lines.push(`- Parser adapter: ${owner.adapterId}`);
        lines.push(`- Resolution strategy: ${owner.resolutionStrategy}`);
        lines.push(`- Parse confidence: ${owner.parseConfidence}`);
        if (owner.usedSnapshotFallback) {
          lines.push(`- Snapshot fallback: ${owner.snapshotFallbackReason ?? "used cached source snapshot"}`);
        }
        lines.push(`- Source-only UW course codes: ${owner.sourceOnlyUwCourseCodes.join(", ")}`);
        if (owner.structuredOnlyUwCourseCodes.length) {
          lines.push(
            `- Structured-only UW course codes not seen in the parsed source: ${owner.structuredOnlyUwCourseCodes.join(", ")}`
          );
        }
        if (owner.requirementCueLines.length) {
          lines.push(`- Requirement cues: ${owner.requirementCueLines.slice(0, 3).join(" | ")}`);
        }
        if (owner.sourceSectionAudit?.line) {
          lines.push(`- ${owner.sourceSectionAudit.line}`);
        }
        lines.push(`- Snapshot: ${owner.snapshotPath ?? "n/a"}`);
        lines.push("");
      });
    }

    const noCourseOwners = campusOwners.filter(
      (owner) => owner.ok && owner.parsedUwCourseCodes.length === 0
    );
    if (noCourseOwners.length) {
      lines.push("### Parsed but no UW course codes found", "");
      noCourseOwners.slice(0, 50).forEach((owner) => {
        lines.push(`- ${owner.ownerTitle}`);
        lines.push(`  - Source: ${owner.sourceUrl}`);
        lines.push(`  - Source role: ${owner.sourceRole ?? "ignored"}`);
        lines.push(`  - Parser type: ${owner.parserType}`);
        if (owner.sourceSectionAudit?.line) {
          lines.push(`  - ${owner.sourceSectionAudit.line}`);
        }
        lines.push(`  - Requirement cues found: ${owner.requirementCueLines.length}`);
      });
      lines.push("");
    }

    const failedOwners = campusOwners.filter((owner) => !owner.ok);
    if (failedOwners.length) {
      lines.push("### Parse failures", "");
      failedOwners.slice(0, 50).forEach((owner) => {
        lines.push(`- ${owner.ownerTitle}`);
        lines.push(`  - Source: ${owner.sourceUrl}`);
        lines.push(`  - Source role: ${owner.sourceRole ?? "ignored"}`);
        lines.push(`  - Error: ${owner.error ?? "unknown error"}`);
      });
      lines.push("");
    }
  }

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

async function main() {
  ensureDir(TMP_DIR);
  ensureDir(SNAPSHOT_DIR);
  const snapshotOnly = hasArg("--snapshot-only");
  const targetPlanId = getArgValue("--target-plan-id");
  let effectiveTargetPlanId = targetPlanId;
  if (effectiveTargetPlanId && !fs.existsSync(OUTPUT_JSON_PATH)) {
    console.log(
      `No existing parse report was found at ${OUTPUT_JSON_PATH}. Running a full parse pass instead of a targeted merge for ${effectiveTargetPlanId}.`
    );
    effectiveTargetPlanId = null;
  }

  const manifestEntries = getParseablePrimaryEntries(effectiveTargetPlanId);
  const previousReport = effectiveTargetPlanId ? readJsonIfExists(OUTPUT_JSON_PATH) : null;
  console.log(`Parsing ${manifestEntries.length} primary planner requirement source(s)...`);
  if (effectiveTargetPlanId) {
    console.log(`Target plan scope: ${effectiveTargetPlanId}`);
  }
  if (snapshotOnly) {
    console.log("Snapshot-only mode enabled. Reusing cached requirement-source snapshots.");
  }

  const parsedOwners = await mapWithConcurrency(
    manifestEntries,
    (entry) => parseManifestEntry(entry, DEFAULT_TIMEOUT_MS, { snapshotOnly }),
    DEFAULT_CONCURRENCY,
    {
      progressLabel: "requirement sources parsed",
      describeItem: (entry) => `${entry.planId}${entry.pathwayId ? `:${entry.pathwayId}` : ""}`,
    }
  );
  const owners = parsedOwners.map(enrichParsedOwnerWithQualitySignals);
  const report = buildParseReport(owners, {
    previousOwners: previousReport?.owners ?? [],
    targetPlanId: effectiveTargetPlanId,
  });

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeGeneratedRequirementSourceAdapters(report);
  buildMarkdownReport(report);

  console.log(`Parsed successfully: ${report.okCount}/${report.totalOwners}`);
  console.log(
    `Parsed from alternate official sources: ${report.countsByResolutionStrategy["alternate-official-source"] ?? 0}`
  );
  console.log(
    `Owners with source-only UW course codes not in structured degree-map blocks: ${report.withSourceOnlyCourseCodesCount}`
  );
  console.log(`Owners with no parsed UW course codes: ${report.withNoParsedCourseCodesCount}`);
  console.log(`Owners with parser-quality warnings: ${report.ownersWithQualityWarningsCount}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);
  console.log(`Generated adapters: ${OUTPUT_TS_PATH}`);
  console.log(`Snapshots: ${SNAPSHOT_DIR}`);
}

function parseHtmlSourceFromArtifactsForTest(entry, html) {
  const title = extractTitle(html);
  const headings = extractHeadings(html);
  const lines = buildHtmlLines(html);
  const catalogScope = scopeCatalogHtmlByAnchor(entry, html);
  const scopedLines =
    catalogScope?.scoped && catalogScope.lines?.length
      ? catalogScope.lines
      : scopeHtmlLines(entry, title, headings, lines);
  const scopedHeadings =
    catalogScope?.scoped && catalogScope.headings?.length ? catalogScope.headings : headings;
  return buildHtmlParsedResult(entry, title, scopedHeadings, scopedLines, {
    sourceRole: classifyRequirementSourceRole(entry),
    sourceSectionAudit: catalogScope?.sectionAudit ?? null,
  });
}

module.exports = {
  buildHtmlLines,
  buildParseReport,
  classifyRequirementSourceRole,
  parseHtmlSourceFromArtifactsForTest,
  scopeCatalogHtmlByAnchor,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
