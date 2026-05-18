const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
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
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS,
} = require("../../constants/transfer-planner-source/bootstrap.generated");
const {
  decodeTransferPlannerHtmlEntities,
  labelMentionsDifferentTransferPlannerMajor,
  normalizeTransferPlannerSemanticPathwayLabel,
  normalizeTransferPlannerText,
} = require("../../constants/transfer-planner-source/pathway-title-normalization");
const {
  isSuspiciousStructuralPathwayId,
  isSuspiciousStructuralPathwayLabel,
} = require("../../constants/transfer-planner-source/pathway-materialization");
let TRANSFER_PLANNER_GENERATED_COURSE_METADATA = [];
try {
  ({ TRANSFER_PLANNER_GENERATED_COURSE_METADATA } = require("../../constants/transfer-planner-source/course-metadata.generated"));
} catch {
  TRANSFER_PLANNER_GENERATED_COURSE_METADATA = [];
}
const parserRules = require("./parser-rule-utils.cjs");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const SNAPSHOT_DIR = path.resolve(TMP_DIR, "transfer-planner-requirement-source-snapshots");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-requirement-source-parse-report.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-requirement-source-parse-report.md");
const RECOVERY_OUTPUT_JSON_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-parser-recovery-report.json"
);
const RECOVERY_OUTPUT_MD_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-parser-recovery-report.md"
);
const OUTPUT_TS_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "requirement-source-adapters.generated.ts"
);
const OUTPUT_TS_CHUNK_DIR = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "requirement-source-adapters.generated"
);
const GENERATED_PROGRAM_APPROVED_COURSE_FILTERS_TS_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "generated-program-approved-course-filters.ts"
);
const BOOTSTRAP_PLAN_TITLES_BY_ID = new Map(
  (TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS ?? []).map((plan) => [plan.id, plan.title])
);
const BOOTSTRAP_PLAN_PATHWAY_COUNT_BY_ID = new Map(
  (TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS ?? []).map((plan) => [
    plan.id,
    Array.isArray(plan.pathways) ? plan.pathways.length : 0,
  ])
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
  /\b([A-Za-z&]{1,20}(?:\s+[A-Za-z&]{1,20})?)\s*(\d{3}[A-Za-z]?)\b/g;
const COURSE_NUMBER_CONTINUATION_PATTERN =
  /(?:^|[,(;/+&]\s*|\b(?:or|and)\s+)(\d{3}[A-Za-z]?)(?=$|[\s,);:/+&]|(?:\s*(?:or|and)\b))/gi;
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
  "OF",
  "ONE",
  "IS",
  "OR",
  "PREREQ",
  "PREREQUISITE",
]);
const LEADING_LIST_MARKER_TOKENS = new Set(["I", "II", "III", "IV"]);
const EXTRACTED_COURSE_SUBJECT_ALIASES = {
  "A A": "AA",
  "A MATH": "AMATH",
  "ART H": "ARTH",
  ACCOUNTING: "ACCTG",
  ASTRONOMY: "ASTR",
  "APPLIED MATHEMATICS": "AMATH",
  BIOENGINEERING: "BIOEN",
  BIOSTATISTICS: "BIOST",
  BIOLOGY: "BIOL",
  "CHEM E": "CHEME",
  "E E": "EE",
  "I S": "IS",
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
for (const supplementalSubject of [
  "ATMS",
  "B ECON",
  "BCMU",
  "BSE",
  "ENTRE",
  "FIN",
  "IBUS",
  "IS",
  "MKTG",
  "OPMGT",
  "THLEAD",
  "TSTAT",
]) {
  KNOWN_UW_EXTRACTED_COURSE_SUBJECTS.add(supplementalSubject);
}
const UW_COURSE_METADATA_BY_CODE = new Map(
  TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter((entry) => entry.schoolId !== "grc")
    .map((entry) => [normalizeCourseCode(entry.code ?? ""), entry])
    .filter(([courseCode]) => courseCode)
);
const REQUIREMENT_CUE_PATTERN =
  /\b(required|requirements|prereq|prerequisite|complete|credits|credit|elective|select|choose|one of the following|two of the following|option|track|route|pathway|concentration)\b/i;
const GENERAL_ED_REQUIREMENT_CUE_PATTERN =
  /\b(areas of inquiry|arts?\s+(?:and|&)\s+humanities|social sciences?|natural sciences?|a&h|ssc|nsc|diversity|additional a&h|additional areas? of inquiry|additional coursework)\b/i;
const STRUCTURAL_REQUIREMENT_PATTERN =
  /\b(admission requirements|degree requirements|major requirements|completion requirements|required courses|elective courses|core courses|core requirements|curriculum|prerequisite courses|shared set of core courses|specialization|track|option|route|pathway|concentration|checklist|foundation|distribution requirement)\b/i;
const COURSE_CLUSTER_REQUIREMENT_CONTEXT_PATTERN =
  /\b(model program of study|program of study|curriculum overview|curriculum plan|core curriculum|foundation courses|practice courses|required curriculum|graduation requirements|social welfare electives|upper-division .*electives)\b/i;
const BLOCK_TAG_PATTERN = /<(?:\/?(?:p|div|section|article|main|aside|header|footer|details|summary|nav|li|ul|ol|dl|dt|dd|table|thead|tbody|tfoot|caption|tr|td|th|button|h1|h2|h3|h4|h5|h6|br))[^>]*>/gi;
const TITLE_PATTERN = /<title[^>]*>([\s\S]*?)<\/title>/i;
const HEADING_PATTERN = /<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi;
const HTML_LINK_PATTERN = /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi;
const HTML_TAG_PATTERN = /<[^>]+>/g;
const SUPPLEMENTAL_HTML_LINK_PATTERN =
  /\b(curriculum|requirements?|degree requirements?|major requirements?|prerequisites?|prereq|approved electives?|elective lists?|elective webpage|course lists?|worksheet|checklist|plan of study|program of study|study plan|sample plan|track|option|concentration|specialization|route|pathway|b\.?\s*a\.?|b\.?\s*s\.?|bachelor(?:'s)?|major(?: in)?|undergraduate studies?)\b/i;
const HIGH_SIGNAL_SUPPLEMENTAL_HTML_LINK_PATTERN =
  /\b(curriculum|requirements?|degree requirements?|major requirements?|prerequisites?|prereq|approved electives?|elective lists?|elective webpage|course lists?|worksheet|checklist|plan of study|program of study|study plan|sample plan)\b/i;
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
const PATHWAY_SOURCE_CUE_PATTERN =
  /\b(track|option|route|pathway|concentration|specialization)\b/i;
const PATHWAY_HUB_SOURCE_CUE_PATTERN =
  /\b(curriculum|degree requirements?|major requirements?|program requirements?|tracks?|options?|routes?|pathways?|concentrations?|specializations?)\b|\/(?:curriculum|requirements?|degree-requirements?|major-requirements?|tracks?|options?|routes?|pathways?|concentrations?|specializations?)(?:[/?#-]|$)/i;
const PATHWAY_DEGREE_SHEET_CUE_PATTERN =
  /\b(degree sheet|requirement sheet|requirements packet|checklist|worksheet|plan of study|study plan)\b|degreq/i;
const APPROVED_COURSE_LIST_CUE_PATTERN =
  /\bapproved\b.{0,60}\b(courses?|course list|list)\b|\b(courses?|course list|list)\b.{0,60}\bapproved\b/i;
const ELECTIVE_LIST_CUE_PATTERN =
  /\b(?:engineering|technical|departmental|major|science|natural science|approved)?\s*electives?\b.{0,50}\b(courses?|list|options?|page)\b|\b(courses?|list|options?)\b.{0,50}\belectives?\b|\/electives?(?:[-/]|$)/i;
const UPPER_DIVISION_PREREQUISITE_CUE_PATTERN =
  /\b(?:upper[-\s]?division|[34]00[-\s]?level|[34]00\s+level)\b.{0,80}\bprereq(?:uisites?)?\b|\bprereq(?:uisites?)?\b.{0,80}\b(?:upper[-\s]?division|[34]00[-\s]?level|[34]00\s+level)\b/i;
const NON_SCHEDULABLE_COURSE_LIST_CUE_PATTERN =
  /\b(course lists?|list of courses|courses by track|course descriptions?|all courses|course catalog|print courses?|suggested course pathways?|computing specializations?|capstones?)\b|\/(?:courses?|course-list|course-lists|print\/courses|capstones?|computing-specializations)(?:[-/?#]|$)/i;
const ADMISSION_PREREQUISITE_SOURCE_CUE_PATTERN =
  /\b(?:admissions?|admission|apply|application)\b.{0,80}\bprereq(?:uisites?|uisite courses?)\b|\bprereq(?:uisites?|uisite courses?)\b.{0,80}\b(?:admissions?|admission|apply|application)\b/i;
const SUPPORT_SOURCE_CUE_PATTERN =
  /\b(advising|adviser|advisor|support sources?|student resources?|student support|forms?|petitions?|policies|policy[-\s]*(?:procedures?|resources?|forms?)|faq|frequently asked questions)\b/i;
const PRIMARY_REQUIREMENT_CUE_PATTERN =
  /\bdegree requirements?\b|\bmajor requirements?\b|\bgraduation requirements?\b|\bprogram requirements?\b|\bdegree structure\b|\brequirements packet\b|\bdegreq\b/i;
const SOURCE_ROLE_STATUS_BY_ROLE = {
  "official-catalog": "primary",
  "primary-degree-requirements": "primary",
  "department-requirements": "primary",
  "pathway-degree-sheet": "primary",
  "approved-course-list": "support",
  "elective-list": "support",
  "support-source": "support",
  "admission-prerequisite-source": "support",
  "admissions-preparation": "support",
  "sample-schedule": "support",
  "curriculum-map": "support",
  "transfer-equivalency": "support",
  "matched-grc-track": "support",
  "upper-division-prerequisite-table": "non-schedulable",
  "non-schedulable-course-list": "non-schedulable",
  "old-archival": "ignored",
  ignored: "ignored",
};
const GRADUATE_SUPPLEMENTAL_SOURCE_PATTERN =
  /\b(graduate|ph\.?\s*d\.?|doctor(?:al|ate)?|m\.?\s*a\.?|masters?|master(?:'s)?)\b|\/(?:ma|phd|graduate|masters?|amp)(?:[-/]|$)/i;
const TRACK_CATALOG_SUPPLEMENTAL_SOURCE_PATTERN =
  /\b(course(?:s)? by track|courses-track|list of geography courses by track|suggested course pathways?)\b/i;
const HTML_SECTION_BOUNDARY_LINE_PATTERN =
  /^(?:Program of Study:|[A-Z][A-Z0-9&]{1,8}\s+Departmental\s+Degree\s+requirements?\b|Bachelor\b|Minor\b|Master\b|Doctor\b|Undergraduate Programs\b|Graduate Programs\b|Back to Top\b)/i;
const PARSER_RECOVERY_TRIGGER_SIGNAL_CODES = new Set([
  "no-parsed-uw-course-codes",
  "low-confidence-parsed-source",
  "material-source-structured-drift",
  "large-structured-only-course-gap",
  "high-confidence-low-course-coverage",
  "snapshot-fallback-used",
  "uw-mse-expected-course-option-missing",
  "uw-mse-requirement-course-metadata-missing",
]);
const PARSER_RECOVERY_MAX_LINK_CANDIDATES = 6;
const PARSER_RECOVERY_MAX_SECTION_CANDIDATES = 4;
const PARSER_RECOVERY_BLOCKER_TYPES = new Set([
  "needs-new-parser-rule",
  "needs-deeper-discovery-rule",
  "source-unavailable",
  "source-official-but-ambiguous",
  "source-support-only",
]);
const REQUIREMENT_FRIENDLY_HINT_PATTERN =
  /\b(required|requirements?|prereq|prerequisite|complete|completed|admission|degree requirements?|credits?|engineering fundamentals|mathematics|sciences|written\s*&\s*oral communication|english composition|areas of inquiry|choose from the following|select one sequence|prior to the start of|before the start of|continuation requirements?)\b/i;
const SECTIONED_COURSE_LIST_REQUIREMENT_PATTERN =
  /\b(?:selected from|from the following list|both courses?|list of approved courses|approved list of courses|courses? listed below|listed below are required|following departments|technical electives?|engineering fundamentals electives?|science electives?|math elective|core and elective requirements?)\b/i;
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
const PARSEABLE_SUPPORT_SOURCE_ROLES = new Set([
  "approved-course-list",
  "elective-list",
  "upper-division-prerequisite-table",
  "non-schedulable-course-list",
  "sample-schedule",
  "admission-prerequisite-source",
  "admissions-preparation",
  "transfer-equivalency",
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
    id: "generic-official-docx-degree-sheet",
    family: "Generic official DOCX degree sheets",
    matches: (entry) => isDocxSourceUrl(entry.url),
    parse: parseDocxSource,
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

  const explicitAlias = EXTRACTED_COURSE_SUBJECT_ALIASES[normalizedSubject];
  const normalizedCode = `${explicitAlias ?? normalizedSubject} ${match[2]}`;
  return LEGACY_GRC_CODE_ALIASES.get(normalizedCode) ?? normalizedCode;
}

function slugify(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getUwCourseMetadata(courseCode) {
  return UW_COURSE_METADATA_BY_CODE.get(normalizeCourseCode(courseCode)) ?? null;
}

function getUwCourseCreditRange(courseCode) {
  const metadata = getUwCourseMetadata(courseCode);
  const creditValue = metadata?.creditValue;
  if (Number.isFinite(creditValue) && creditValue > 0) {
    return {
      credits: creditValue,
      creditMin: creditValue,
      creditMax: creditValue,
      creditText: normalizeWhitespace(metadata?.creditLabel ?? "") || String(creditValue),
    };
  }

  const creditLabel = normalizeWhitespace(metadata?.creditLabel ?? "");
  const rangeMatch = creditLabel.match(/^(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)$/i);
  if (rangeMatch) {
    const creditMin = Number.parseFloat(rangeMatch[1]);
    const creditMax = Number.parseFloat(rangeMatch[2]);
    if (Number.isFinite(creditMin) && Number.isFinite(creditMax) && creditMax >= creditMin) {
      return {
        credits: creditMin,
        creditMin,
        creditMax,
        creditText: creditLabel,
      };
    }
  }

  return {
    credits: null,
    creditMin: null,
    creditMax: null,
    creditText: null,
  };
}

function selectRequirementSourceAdapter(entry) {
  return (
    REQUIREMENT_SOURCE_ADAPTERS.find((adapter) => adapter.matches(entry)) ??
    REQUIREMENT_SOURCE_ADAPTERS[REQUIREMENT_SOURCE_ADAPTERS.length - 1]
  );
}

function getRequirementSourceRoleStatus(sourceRole) {
  return SOURCE_ROLE_STATUS_BY_ROLE[sourceRole] ?? "ignored";
}

function buildRequirementSourceScope(sourceRole) {
  const sourceRoleStatus = getRequirementSourceRoleStatus(sourceRole);
  const primary = sourceRoleStatus === "primary";
  const supportOnly = sourceRoleStatus === "support";
  const nonSchedulable = sourceRoleStatus === "non-schedulable";
  const ignored = sourceRoleStatus === "ignored";

  return {
    canCreateRequiredRows: primary,
    canCreateOptionGroups: primary,
    canCreateCreditBuckets: primary,
    canCreateCategoryOptions: primary,
    canCreateApprovedFilters: sourceRole === "approved-course-list",
    canCreateElectiveLists: sourceRole === "elective-list",
    canCreateSequencingHints: sourceRole === "sample-schedule" || sourceRole === "curriculum-map",
    canCreateAdmissionPrepRows:
      sourceRole === "admission-prerequisite-source" ||
      sourceRole === "admissions-preparation",
    canCreateScheduleRows: primary,
    supportOnly,
    nonSchedulable: nonSchedulable || ignored,
  };
}

function canRequirementSourceRoleCreateSchedulableRows(sourceRole) {
  return buildRequirementSourceScope(sourceRole).canCreateScheduleRows;
}

function canRequirementSourceCreateSchedulableRows(entry) {
  return canRequirementSourceRoleCreateSchedulableRows(classifyRequirementSourceRole(entry));
}

const PRIMARY_REQUIREMENT_LINK_PARSER_TYPES = new Set([
  "html-degree-page",
  "html-curriculum-page",
  "pdf-degree-sheet",
  "pdf-worksheet",
  "generic-html",
]);

const TACOMA_PRIMARY_PROGRAM_PARSER_TYPES = new Set([
  "generic-html",
  "html-curriculum-page",
  "html-degree-page",
  "html-overview-page",
]);
const TACOMA_PRIMARY_PROGRAM_ACRONYM_TOKEN_ALIASES = [
  {
    pattern: /\bcomputer science and systems\b/i,
    tokens: ["css"],
  },
  {
    pattern: /\bethnic gender and labor studies\b/i,
    tokens: ["egls"],
  },
  {
    pattern: /\bpolitics philosophy and economics\b/i,
    tokens: ["ppe"],
  },
  {
    pattern: /\bsustainable urban development\b/i,
    tokens: ["sud"],
  },
];

function urlLooksLikeOfficialTacomaSource(value) {
  try {
    const parsedUrl = new URL(String(value ?? ""));
    return /(?:^|\.)tacoma\.uw\.edu$/i.test(parsedUrl.hostname);
  } catch {
    return false;
  }
}

function titleScopeTokensMatchSource(tokens, sourceSearchable) {
  const uniqueTokens = uniqueSorted(tokens ?? []);
  if (!uniqueTokens.length) {
    return true;
  }

  const tokenOverlapCount = uniqueTokens.filter((token) => sourceSearchable.includes(token)).length;
  return tokenOverlapCount >= Math.max(1, Math.min(2, uniqueTokens.length));
}

function getTacomaPrimaryProgramBaseTitle(entry) {
  return normalizeWhitespace(String(entry?.ownerTitle ?? "").split(/\s[-\u2013\u2014]\s/)[0] ?? "");
}

function getTacomaPrimaryProgramAcronymTokens(entry) {
  const baseTitle = getTacomaPrimaryProgramBaseTitle(entry);
  return TACOMA_PRIMARY_PROGRAM_ACRONYM_TOKEN_ALIASES.flatMap((alias) =>
    alias.pattern.test(baseTitle) ? alias.tokens : []
  );
}

function getTacomaPrimaryProgramIdentityTokenGroups(entry) {
  const baseTitle = getTacomaPrimaryProgramBaseTitle(entry);
  return [
    getTitleScopeTokens(entry),
    baseTitle ? getTitleScopeTokens({ ...entry, ownerTitle: baseTitle, sourceLabel: "" }) : [],
    getTacomaPrimaryProgramAcronymTokens(entry),
  ].filter((tokens) => tokens.length > 0);
}

function isTacomaPrimaryProgramPage(entry, sourceSearchable, searchable) {
  if (entry?.campusId !== "uw-tacoma" || !entry?.isPrimaryDegreeRequirementsLink) {
    return false;
  }

  const parserType = String(entry?.parserType ?? "");
  if (!TACOMA_PRIMARY_PROGRAM_PARSER_TYPES.has(parserType)) {
    return false;
  }

  if (!urlLooksLikeOfficialTacomaSource(entry?.url)) {
    return false;
  }

  const identityTokenGroups = getTacomaPrimaryProgramIdentityTokenGroups(entry);
  const hasOwnerIdentityMatch =
    identityTokenGroups.length === 0 ||
    identityTokenGroups.some((tokens) => titleScopeTokensMatchSource(tokens, sourceSearchable));
  const hasProgramCue =
    /\b(?:bachelor|b\.?\s*a\.?|b\.?\s*s\.?|major|degree|program|requirements?|overview|track|option|route|concentration)\b/i.test(
      searchable
    );

  return hasOwnerIdentityMatch && hasProgramCue;
}

function hasTacomaParsedPrimaryRequirementEvidence(parsed) {
  const parsedCourseCodes = parsed?.courseCodes ?? [];
  const evidenceLines = [
    ...(parsed?.requirementCueLines ?? []),
    ...(parsed?.chooseStatements ?? []),
    ...(parsed?.pathwayLabels ?? []),
  ].join(" ");

  return (
    parsedCourseCodes.length > 0 ||
    (parsed?.pathwayLabels ?? []).length > 0 ||
    PRIMARY_REQUIREMENT_CUE_PATTERN.test(evidenceLines) ||
    /\b(admission requirements?|degree requirements?|graduation requirements?|students? choose\b.{0,80}\b(?:options?|tracks?|routes?|pathways?)|core courses?|preparatory courses?)\b/i.test(
      evidenceLines
    )
  );
}

function shouldUseTacomaMetadataPrimaryRole(entry, parsedSourceRole, metadataSourceRole, parsed) {
  if (entry?.campusId !== "uw-tacoma" || metadataSourceRole !== "primary-degree-requirements") {
    return false;
  }

  if (getRequirementSourceRoleStatus(parsedSourceRole ?? metadataSourceRole) === "primary") {
    return false;
  }

  return hasTacomaParsedPrimaryRequirementEvidence(parsed);
}

function isMaterializedPrimaryRequirementLink(entry, sourceSearchable, searchable) {
  const manifestRole = String(entry?.role ?? "");
  if (
    [
      "approved-course-list",
      "elective-list",
      "upper-division-prerequisite-table",
      "admission-prerequisite-source",
      "admissions",
      "catalog",
      "pathway-degree-sheet",
    ].includes(manifestRole)
  ) {
    return false;
  }

  const url = String(entry?.url ?? "");
  const parserType = String(entry?.parserType ?? "");
  const ownerIsPathway = Boolean(entry?.pathwayId) || /:pathway:/.test(String(entry?.ownerId ?? ""));
  if (
    /\b(?:admissions?|apply|application|preparation|prereq(?:uisites?)?)\b/i.test(sourceSearchable) ||
    SUPPORT_SOURCE_CUE_PATTERN.test(sourceSearchable)
  ) {
    return false;
  }

  const sourceLooksLikePathway =
    PATHWAY_SOURCE_CUE_PATTERN.test(sourceSearchable) ||
    /(?:^|[-/])(?:track|option|route|pathway|concentration|specialization)(?:[-/?#]|$)/i.test(url);
  const sourceLooksLikeDegreeProgram =
    /\b(?:bachelor|bachelors?|b\.?\s*a\.?|b\.?\s*s\.?|ba|bs|bba)\b/i.test(sourceSearchable) ||
    /(?:^|\/)b(?:a|s|ba)[-/]/i.test(url);
  const sourceLooksLikeRequirements =
    PRIMARY_REQUIREMENT_CUE_PATTERN.test(searchable) ||
    /\b(?:curriculum|requirements?|degree|major|program)\b/i.test(searchable);
  const ownerTitleTokens = getTitleScopeTokens(entry);
  const ownerTitleTokenOverlapCount = ownerTitleTokens.filter((token) =>
    sourceSearchable.includes(token)
  ).length;
  const sourceLooksLikeOwnerDegreeProgram =
    !sourceLooksLikePathway &&
    sourceLooksLikeDegreeProgram &&
    ownerTitleTokenOverlapCount >= Math.max(1, Math.min(2, ownerTitleTokens.length));

  return (
    (ownerIsPathway && (sourceLooksLikePathway || sourceLooksLikeDegreeProgram)) ||
    sourceLooksLikeOwnerDegreeProgram ||
    (sourceLooksLikeRequirements && PRIMARY_REQUIREMENT_LINK_PARSER_TYPES.has(parserType)) ||
    isTacomaPrimaryProgramPage(entry, sourceSearchable, searchable)
  );
}

function getSourceRoleScore(entry) {
  const discoveredRole = classifyRequirementSourceRole(entry);
  switch (discoveredRole) {
    case "official-catalog":
    case "primary-degree-requirements":
      return 6;
    case "pathway-degree-sheet":
      return 5;
    case "department-requirements":
    case "curriculum-map":
      return 4;
    case "approved-course-list":
    case "elective-list":
    case "support-source":
    case "admission-prerequisite-source":
    case "admissions-preparation":
    case "sample-schedule":
    case "overview":
      return 2;
    case "upper-division-prerequisite-table":
    case "non-schedulable-course-list":
      return 1;
    case "transfer-equivalency":
    case "matched-grc-track":
    case "old-archival":
      return 0;
    case "ignored":
      break;
    default:
      break;
  }

  switch (entry.role) {
    case "degree-requirements":
    case "catalog":
      return 6;
    case "pathway-degree-sheet":
    case "curriculum":
      return 5;
    case "worksheet":
      return 4;
    case "overview":
      return 2;
    default:
      return 1;
  }
}

function classifyRequirementSourceRole(entry) {
  const sourceSearchable = normalizeMatcherText(
    [entry?.url, entry?.label, entry?.sourceLabel, entry?.role, entry?.parserType]
      .filter(Boolean)
      .join(" ")
  );
  const searchable = normalizeMatcherText(
    [sourceSearchable, entry?.ownerTitle].filter(Boolean).join(" ")
  );

  if (!searchable) {
    return "ignored";
  }

  if (entry?.isPrimaryDegreeRequirementsLink && isMaterializedPrimaryRequirementLink(entry, sourceSearchable, searchable)) {
    return "primary-degree-requirements";
  }

  const manifestRole = String(entry?.role ?? "");
  const entryUrl = String(entry?.url ?? "");
  const isDocumentWorksheetSource =
    entry?.parserType === "pdf-worksheet" || /\.(?:pdf|docx)(?:$|[?#])/i.test(entryUrl);
  const hasMajorPlanningWorksheetCue = /\bmajor planning worksheet\b/i.test(searchable);
  if (
    hasMajorPlanningWorksheetCue &&
    isDocumentWorksheetSource &&
    !/admissions\.uwb\.edu\/register\/mpw-/i.test(entryUrl) &&
    !ADMISSION_PREREQUISITE_SOURCE_CUE_PATTERN.test(searchable)
  ) {
    return "primary-degree-requirements";
  }
  if (
    /admissions\.uwb\.edu\/register\/mpw-/i.test(entryUrl) ||
    hasMajorPlanningWorksheetCue
  ) {
    return "admission-prerequisite-source";
  }
  if (manifestRole === "approved-course-list") {
    return "approved-course-list";
  }
  if (manifestRole === "elective-list") {
    return "elective-list";
  }
  if (manifestRole === "upper-division-prerequisite-table") {
    return "upper-division-prerequisite-table";
  }
  if (
    manifestRole === "non-schedulable-course-list" &&
    isMaterializedPrimaryRequirementLink(entry, sourceSearchable, searchable)
  ) {
    return "primary-degree-requirements";
  }
  if (manifestRole === "non-schedulable-course-list") {
    return "non-schedulable-course-list";
  }
  if (manifestRole === "admission-prerequisite-source") {
    return "admission-prerequisite-source";
  }
  if (manifestRole === "admissions") {
    return "admissions-preparation";
  }
  if (
    !entry?.isPrimaryDegreeRequirementsLink &&
    (manifestRole === "degree-requirements" || manifestRole === "curriculum" || manifestRole === "worksheet")
  ) {
    return "support-source";
  }
  if (manifestRole === "degree-requirements" || manifestRole === "curriculum" || manifestRole === "worksheet") {
    return "primary-degree-requirements";
  }
  if (manifestRole === "catalog") {
    return "official-catalog";
  }
  if (manifestRole === "pathway-degree-sheet") {
    return "pathway-degree-sheet";
  }

  if (UW_GENERAL_CATALOG_PROGRAM_URL_PATTERN.test(String(entry?.url ?? ""))) {
    return "official-catalog";
  }

  if (/\b(?:archive|archived|retired|old requirements?|prior to|pre-20\d{2})\b/.test(searchable)) {
    return "old-archival";
  }

  if (/\bnon[-\s]?major options?\b|\/non-major-options(?:[/?#-]|$)/.test(sourceSearchable)) {
    return "non-schedulable-course-list";
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

  if (PATHWAY_DEGREE_SHEET_CUE_PATTERN.test(sourceSearchable) && PATHWAY_SOURCE_CUE_PATTERN.test(sourceSearchable)) {
    return "pathway-degree-sheet";
  }

  if (APPROVED_COURSE_LIST_CUE_PATTERN.test(searchable)) {
    return "approved-course-list";
  }

  if (ELECTIVE_LIST_CUE_PATTERN.test(searchable)) {
    return "elective-list";
  }

  if (UPPER_DIVISION_PREREQUISITE_CUE_PATTERN.test(searchable)) {
    return "upper-division-prerequisite-table";
  }

  if (entry?.isPrimaryDegreeRequirementsLink && isMaterializedPrimaryRequirementLink(entry, sourceSearchable, searchable)) {
    return "primary-degree-requirements";
  }

  if (NON_SCHEDULABLE_COURSE_LIST_CUE_PATTERN.test(searchable)) {
    return "non-schedulable-course-list";
  }

  if (ADMISSION_PREREQUISITE_SOURCE_CUE_PATTERN.test(searchable)) {
    return "admission-prerequisite-source";
  }

  if (SUPPORT_SOURCE_CUE_PATTERN.test(searchable)) {
    return "support-source";
  }

  if (
    PRIMARY_REQUIREMENT_CUE_PATTERN.test(searchable) ||
    PATHWAY_DEGREE_SHEET_CUE_PATTERN.test(searchable) ||
    /\bdegree sheet\b|\brequirement sheet\b|\bchecklist\b/.test(searchable)
  ) {
    return "primary-degree-requirements";
  }

  if (/\badmissions?\b|\bapply\b|\bapplication\b|\bpreparation\b|\bprerequisites?\b/.test(searchable)) {
    return "admissions-preparation";
  }

  if (/\bcurriculum(?: map)?\b|\bdegree map\b|\bfour-year plan\b/.test(searchable)) {
    return "curriculum-map";
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

function shouldAllowAlternateManifestEntryForParse(entry, alternateEntry) {
  const sourceRole = classifyRequirementSourceRole(entry);
  const alternateRole = classifyRequirementSourceRole(alternateEntry);
  const sourceStatus = getRequirementSourceRoleStatus(sourceRole);
  const alternateStatus = getRequirementSourceRoleStatus(alternateRole);

  if (sourceStatus !== "primary" && alternateStatus === "primary") {
    return false;
  }
  if (sourceRole === "approved-course-list") {
    return alternateRole === "approved-course-list";
  }
  if (sourceRole === "elective-list") {
    return alternateRole === "elective-list";
  }
  if (sourceStatus === "non-schedulable") {
    return alternateStatus === "non-schedulable";
  }

  return true;
}

function getAlternateParseableManifestEntries(entry) {
  return TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
    (candidate) =>
      candidate.ownerId === entry.ownerId &&
      candidate.id !== entry.id &&
      candidate.url !== entry.url &&
      candidate.campusId === entry.campusId &&
      PARSEABLE_PARSER_TYPES.has(candidate.parserType) &&
      shouldAllowAlternateManifestEntryForParse(entry, candidate)
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
      .filter((courseCode) => isRecognizedExtractedUwCourseCode(courseCode))
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
    (
      (
        INVALID_EXTRACTED_COURSE_SUBJECTS.has(subject) ||
        subjectTokens.some((token) => INVALID_EXTRACTED_COURSE_SUBJECTS.has(token))
      ) &&
      !subjectIsKnown &&
      !collapsedSubjectIsKnown
    ) ||
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

function isRecognizedExtractedUwCourseCode(courseCode) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const match = normalizedCourseCode.match(/^([A-Z&]+(?: [A-Z&]+)*) (\d{3}[A-Z]?)$/);
  return Boolean(match && normalizeExtractedCourseCode(match[1], match[2]));
}

function hasExplicitCourseCodeBeforeTransferNoise(line) {
  const normalizedLine = normalizeWhitespace(String(line ?? ""));
  const transferNoiseIndex = normalizedLine.search(TRANSFER_CREDIT_NOISE_PATTERN);
  if (transferNoiseIndex < 0) {
    return false;
  }

  const beforeTransferNoise = normalizeWhitespace(
    normalizedLine.slice(0, transferNoiseIndex).replace(/[;,:()\s]+$/g, "")
  );
  EXPLICIT_COURSE_CODE_PATTERN.lastIndex = 0;
  const hasExplicitCode = EXPLICIT_COURSE_CODE_PATTERN.test(beforeTransferNoise);
  EXPLICIT_COURSE_CODE_PATTERN.lastIndex = 0;
  return hasExplicitCode;
}

function isTransferCreditNoiseOnlyLine(line) {
  return (
    TRANSFER_CREDIT_NOISE_PATTERN.test(String(line ?? "")) &&
    !hasExplicitCourseCodeBeforeTransferNoise(line)
  );
}

function extractRelevantRequirementLines(lines, headings) {
  const normalizedHeadings = new Set(headings.map((heading) => normalizeWhitespace(heading)));
  const relevantLineIndexes = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeWhitespace(lines[index]);
    if (!line) {
      continue;
    }

    const hasSectionedCourseListCue = SECTIONED_COURSE_LIST_REQUIREMENT_PATTERN.test(line);
    if (
      isTransferCreditNoiseOnlyLine(line) ||
      normalizedHeadings.has(line) ||
      REQUIREMENT_CUE_PATTERN.test(line) ||
      REQUIREMENT_FRIENDLY_HINT_PATTERN.test(line) ||
      STRUCTURAL_REQUIREMENT_PATTERN.test(line) ||
      hasSectionedCourseListCue
    ) {
      if (isTransferCreditNoiseOnlyLine(line)) {
        continue;
      }
      const forwardWindow = hasSectionedCourseListCue
        ? 90
        : STRUCTURAL_REQUIREMENT_PATTERN.test(line)
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
      (line) => !NOISY_SOURCE_LINE_PATTERN.test(line) && !isTransferCreditNoiseOnlyLine(line)
    );
}

function extractExplicitCourseCodesFromLine(line) {
  let normalizedLine = normalizeWhitespace(String(line ?? ""));
  if (NOISY_SOURCE_LINE_PATTERN.test(normalizedLine)) {
    return [];
  }
  const transferNoiseIndex = normalizedLine.search(TRANSFER_CREDIT_NOISE_PATTERN);
  if (transferNoiseIndex >= 0) {
    const beforeTransferNoise = normalizeWhitespace(
      normalizedLine.slice(0, transferNoiseIndex).replace(/[;,:()\s]+$/g, "")
    );
    EXPLICIT_COURSE_CODE_PATTERN.lastIndex = 0;
    const hasExplicitCodeBeforeTransferNoise =
      EXPLICIT_COURSE_CODE_PATTERN.test(beforeTransferNoise);
    EXPLICIT_COURSE_CODE_PATTERN.lastIndex = 0;
    if (!hasExplicitCodeBeforeTransferNoise) {
      return [];
    }
    normalizedLine = beforeTransferNoise;
  }

  const extractedCourseCodes = [];
  const explicitMatches = [...normalizedLine.matchAll(EXPLICIT_COURSE_CODE_PATTERN)]
    .map((match) => {
      const subject = normalizeExtractedCourseSubject(match[1]);
      const explicitCode = normalizeExtractedCourseCode(match[1], match[2]);
      if (
        !subject ||
        !explicitCode ||
        isCourseCodeMatchImmediatelyFollowedByLevel(normalizedLine, match)
      ) {
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
      if (isCourseCodeMatchImmediatelyFollowedByLevel(trailingSegment, numberMatch)) {
        continue;
      }
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
      if (explicitCode && !isCourseCodeMatchImmediatelyFollowedByLevel(normalizedLine, aliasMatch)) {
        extractedCourseCodes.push(explicitCode);
      }
    }
  }

  return uniqueSorted(extractedCourseCodes);
}

function isCourseCodeMatchImmediatelyFollowedByLevel(line, match) {
  const matchText = match?.[0] ?? "";
  const matchIndex = match?.index;
  if (!matchText || matchIndex == null) {
    return false;
  }

  const trailingText = String(line ?? "").slice(matchIndex + matchText.length);
  return /^\s*(?:-\s*)?level\b/i.test(trailingText);
}

function extractCourseCodesFromLine(line) {
  const normalizedLine = normalizeWhitespace(String(line ?? ""));
  const extractedCourseCodes = extractExplicitCourseCodesFromLine(normalizedLine);

  const repeatedSubjectAlternativePattern =
    /\b(?:or|and)\s+([A-Za-z&]+(?:\s+[A-Za-z&]+)?)\s*(\d{3}[A-Za-z]?)\b/g;
  for (const match of normalizedLine.matchAll(repeatedSubjectAlternativePattern)) {
    const courseCode = normalizeExtractedCourseCode(match[1], match[2]);
    if (courseCode) {
      extractedCourseCodes.push(courseCode);
    }
  }

  if (
    ENGLISH_COMPOSITION_REQUIREMENT_PATTERN.test(normalizedLine) &&
    !ENGLISH_COMPOSITION_EXCLUSION_PATTERN.test(normalizedLine) &&
    (normalizedLine.length <= 140 || ENGLISH_COMPOSITION_CONTEXT_PATTERN.test(normalizedLine))
  ) {
    extractedCourseCodes.push("ENGL 131");
  }

  return uniqueSorted(extractedCourseCodes);
}

function isCourseContinuationLine(line) {
  const normalizedLine = normalizeWhitespace(stripChoiceListLine(line));
  return /^\s*(?:or|and)\s+/i.test(normalizedLine) && extractCourseCodesFromLine(normalizedLine).length > 0;
}

function extractCourseCodesFromJointCourseLine(line) {
  const normalizedLine = normalizeWhitespace(String(line ?? "").replace(/\*/g, ""));
  const extractedCourseCodes = [];

  const sharedNumberPattern = /\b([A-Z&]+(?:\s+[A-Z&]+)*)\s*\/\s*([A-Z&]+(?:\s+[A-Z&]+)*)\s+(\d{3}[A-Za-z]?)\b/g;
  for (const match of normalizedLine.matchAll(sharedNumberPattern)) {
    const leftCode = normalizeExtractedCourseCode(match[1], match[3]);
    const rightCode = normalizeExtractedCourseCode(match[2], match[3]);
    if (leftCode) {
      extractedCourseCodes.push(leftCode);
    }
    if (rightCode) {
      extractedCourseCodes.push(rightCode);
    }
  }

  const splitNumberPattern =
    /\b([A-Z&]+(?:\s+[A-Z&]+)*)\s+(\d{3}[A-Za-z]?)\s*\/\s*([A-Z&]+(?:\s+[A-Z&]+)*)\s+(\d{3}[A-Za-z]?)\b/g;
  for (const match of normalizedLine.matchAll(splitNumberPattern)) {
    const leftCode = normalizeExtractedCourseCode(match[1], match[2]);
    const rightCode = normalizeExtractedCourseCode(match[3], match[4]);
    if (leftCode) {
      extractedCourseCodes.push(leftCode);
    }
    if (rightCode) {
      extractedCourseCodes.push(rightCode);
    }
  }

  extractedCourseCodes.push(...extractCourseCodesFromLine(normalizedLine));

  return uniqueInOrder(extractedCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean));
}

const APPROVED_FILTER_SUBJECT_HEADING_ALIASES = new Map([
  ["ASTRONOMY", "ASTR"],
  ["ATMOSPHERIC SCIENCE", "ATMOS"],
  ["ATMOSPHERIC SCIENCES", "ATMOS"],
  ["BIOLOGY", "BIOL"],
  ["CHEMISTRY", "CHEM"],
  ["EARTH & SPACE SCIENCES", "ESS"],
  ["EARTH AND SPACE SCIENCES", "ESS"],
  ["PHYSICS", "PHYS"],
]);
const APPROVED_FILTER_SECTION_STOP_PATTERN =
  /\b(?:back to top|senior electives?|degree requirements?|graduation requirements?|admissions?|sample schedules?|polic(?:y|ies)|curriculum|course lists?)\b/i;
const APPROVED_FILTER_NOTE_ONLY_PATTERN =
  /\b(?:not included in this list|check with|adviser|advisor|if you have not|pre-?requisite|prerequisite|recommended)\b/i;
const APPROVED_FILTER_CONDITIONAL_NOTE_PATTERN =
  /\b(?:petition|conditional|approved by|approval|adviser|advisor|not included in this list|pre-?requisite|prerequisite)\b/i;

function stripSourceLineNoise(line) {
  return normalizeWhitespace(
    String(line ?? "")
      .replace(/^\[Page\s+\d+\]\s*/i, "")
      .replace(/^[\u2610\u2611\u2612\u2713\u2714\uF071\u25A1\u25A0\u25AA\u25CF\u2022*\-\s]+/, "")
  );
}

function normalizeApprovedFilterText(value) {
  return stripSourceLineNoise(value).toLowerCase().replace(/[^a-z0-9&/]+/g, " ").trim();
}

function getApprovedFilterSubjectFromHeading(line) {
  const normalized = stripSourceLineNoise(line)
    .toUpperCase()
    .replace(/[:.]+$/g, "")
    .trim();
  if (APPROVED_FILTER_SUBJECT_HEADING_ALIASES.has(normalized)) {
    return APPROVED_FILTER_SUBJECT_HEADING_ALIASES.get(normalized);
  }

  const colonMatch = normalized.match(/^([A-Z&]+(?:\s+[A-Z&]+)?)\s*:/);
  if (colonMatch) {
    return normalizeExtractedCourseSubject(colonMatch[1]);
  }

  return normalizeExtractedCourseSubject(normalized);
}

function getApprovedFilterLeadingSubject(line) {
  const cleanLine = stripSourceLineNoise(line);
  for (const [heading, subject] of APPROVED_FILTER_SUBJECT_HEADING_ALIASES.entries()) {
    if (new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(cleanLine)) {
      return subject;
    }
  }
  const match = cleanLine.match(/^([A-Z&]+(?:\s+[A-Z&]+)?)\s*[: ]\s*\d{3}/i);
  return match ? normalizeExtractedCourseSubject(match[1]) : null;
}

function extractApprovedFilterCodesWithSubject(line, subject) {
  const normalizedSubject = normalizeExtractedCourseSubject(subject);
  if (!normalizedSubject) {
    return [];
  }
  const text = stripSourceLineNoise(line)
    .replace(/\([^)]*credits?[^)]*\)/gi, "")
    .replace(/\b\d+\s*(?:credits?|cr)\b/gi, "");
  const codes = [];
  for (const match of text.matchAll(/\b\d{3}[A-Za-z]?\b/g)) {
    const before = text.slice(Math.max(0, match.index - 8), match.index);
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 8);
    if (/\blevel[-\s]*$/i.test(before) || /^[-\s]*level\b/i.test(after)) {
      continue;
    }
    const code = normalizeExtractedCourseCode(normalizedSubject, match[0]);
    if (code) {
      codes.push(code);
    }
  }
  return uniqueInOrder(codes);
}

function extractApprovedFilterCodesFromLine(line, currentSubject = null) {
  let cleanLine = stripSourceLineNoise(line);
  if (!cleanLine) {
    return [];
  }
  const noteCueIndex = cleanLine.search(APPROVED_FILTER_NOTE_ONLY_PATTERN);
  if (noteCueIndex >= 0) {
    const codeBearingPrefix = cleanLine.slice(0, noteCueIndex);
    if (/\b\d{3}[A-Za-z]?\b/.test(codeBearingPrefix)) {
      cleanLine = codeBearingPrefix;
    } else {
      return [];
    }
  }

  const explicitCodes = [
    ...extractCourseCodesFromJointCourseLine(cleanLine),
    ...extractCourseCodesFromLine(cleanLine),
  ];
  const lineSubject = getApprovedFilterLeadingSubject(cleanLine);
  const prefixSubject = getApprovedFilterSubjectFromHeading(cleanLine);
  const inheritedSubject = lineSubject ?? prefixSubject ?? currentSubject;
  const inheritedCodes =
    inheritedSubject &&
    (lineSubject ||
      prefixSubject ||
      /^\s*(?:\d{3}|[,;/]|\(|and\b|or\b)/i.test(cleanLine) ||
      explicitCodes.some((courseCode) => getCourseCodeSubject(courseCode) === inheritedSubject))
      ? extractApprovedFilterCodesWithSubject(cleanLine, inheritedSubject)
      : [];

  return uniqueSorted([...explicitCodes, ...inheritedCodes].map(normalizeCourseCode).filter(Boolean));
}

function buildApprovedFilterSectionCues(filterKey, owner = {}, supportList = {}) {
  const normalizedKey = normalizeApprovedFilterText(filterKey);
  const context = normalizeApprovedFilterText(
    [
      filterKey,
      owner.ownerTitle,
      owner.sourceLabel,
      supportList.listTitle,
      owner.sourceUrl,
    ].filter(Boolean).join(" ")
  );
  const phrases = [];
  if (/\bcomputer science\b/.test(context) || /\bcomputer-science\b/.test(normalizedKey)) {
    phrases.push("computer science");
  }
  if (/\bcomputer engineering\b/.test(context) || /\bcomputer-engineering\b/.test(normalizedKey)) {
    phrases.push("computer engineering");
  }

  const categoryTokens = [];
  if (/\bnatural science\b/.test(context) || /\bnatural-science\b/.test(normalizedKey)) {
    categoryTokens.push("natural", "science");
  } else if (/\bscience\b/.test(context)) {
    categoryTokens.push("science");
  }
  if (/\bmath science\b|\bmath\/science\b/.test(context)) {
    categoryTokens.push("math", "science");
  }
  if (/\belectives?\b/.test(context)) {
    categoryTokens.push("elective");
  }

  return {
    phrases,
    categoryTokens: uniqueInOrder(categoryTokens),
  };
}

function getApprovedFilterSectionHeadingScore(line, cues) {
  const text = normalizeApprovedFilterText(line);
  if (!text || extractCourseCodesFromLine(line).length) {
    return 0;
  }
  if (cues.phrases.some((phrase) => !text.includes(phrase))) {
    return 0;
  }
  if (cues.categoryTokens.some((token) => !text.includes(token))) {
    return 0;
  }

  let score = 1;
  score += cues.phrases.length * 5;
  score += cues.categoryTokens.length * 3;
  if (/\b(?:requirement|approved|courses?|list)\b/.test(text)) {
    score += 2;
  }
  return score;
}

function findApprovedFilterSectionRange(lines, filterKey, owner = {}, supportList = {}) {
  const cues = buildApprovedFilterSectionCues(filterKey, owner, supportList);
  let bestStartIndex = -1;
  let bestScore = 0;

  for (let index = 0; index < (lines ?? []).length; index += 1) {
    const score = getApprovedFilterSectionHeadingScore(lines[index], cues);
    if (score > bestScore) {
      bestStartIndex = index;
      bestScore = score;
    }
  }

  if (bestStartIndex < 0) {
    return null;
  }

  let endIndex = lines.length;
  let collectedCourseLine = false;
  for (let index = bestStartIndex + 1; index < lines.length; index += 1) {
    const cleanLine = stripSourceLineNoise(lines[index]);
    if (!cleanLine) {
      continue;
    }
    const lineCourseCodes = extractApprovedFilterCodesFromLine(cleanLine);
    if (lineCourseCodes.length) {
      collectedCourseLine = true;
    }
    const nextHeadingScore = getApprovedFilterSectionHeadingScore(cleanLine, cues);
    if (
      collectedCourseLine &&
      (APPROVED_FILTER_SECTION_STOP_PATTERN.test(cleanLine) ||
        (nextHeadingScore > 0 && index > bestStartIndex + 1))
    ) {
      endIndex = index;
      break;
    }
  }

  return {
    startIndex: bestStartIndex,
    endIndex,
    heading: stripSourceLineNoise(lines[bestStartIndex]),
    lines: lines.slice(bestStartIndex, endIndex),
  };
}

function extractApprovedFilterEvidenceFromLines(input) {
  const section = findApprovedFilterSectionRange(
    input.lines ?? [],
    input.filterKey,
    input.owner,
    input.supportList
  );
  if (!section) {
    return null;
  }

  const evidenceLines = [section.heading].filter(Boolean);
  const evidenceHeadings = [section.heading].filter(Boolean);
  const petitionOnlyNotes = [];
  const approvedUwCourseGroups = [];
  const codes = [];
  let currentSubject = null;

  for (const line of section.lines) {
    const cleanLine = stripSourceLineNoise(line);
    if (!cleanLine) {
      continue;
    }

    const subject = getApprovedFilterSubjectFromHeading(cleanLine);
    if (subject && !extractCourseCodesFromLine(cleanLine).length && !/\b\d{3}[A-Za-z]?\b/.test(cleanLine)) {
      currentSubject = subject;
      evidenceHeadings.push(cleanLine);
      evidenceLines.push(cleanLine);
      continue;
    }

    if (APPROVED_FILTER_CONDITIONAL_NOTE_PATTERN.test(cleanLine)) {
      petitionOnlyNotes.push(cleanLine);
    }

    const lineCodes = extractApprovedFilterCodesFromLine(cleanLine, currentSubject);
    if (lineCodes.length) {
      evidenceLines.push(cleanLine);
      codes.push(...lineCodes);
      if (/\b(?:and|\*and\*)\b|\/|\bor\b/i.test(cleanLine) && lineCodes.length > 1 && lineCodes.length <= 4) {
        approvedUwCourseGroups.push(lineCodes);
      }
    } else if (APPROVED_FILTER_CONDITIONAL_NOTE_PATTERN.test(cleanLine)) {
      evidenceLines.push(cleanLine);
    }
  }

  const approvedUwCourseCodes = uniqueSorted(codes);
  if (!approvedUwCourseCodes.length) {
    return null;
  }

  return {
    approvedUwCourseCodes,
    approvedUwCourseGroups: uniqueBy(
      approvedUwCourseGroups
        .map((group) => uniqueSorted(group))
        .filter((group) => group.length > 1),
      (group) => group.join("|")
    ),
    petitionOnlyNotes: uniqueInOrder(petitionOnlyNotes),
    sourceEvidenceHeadings: uniqueInOrder(evidenceHeadings),
    sourceEvidenceLines: uniqueInOrder(evidenceLines).slice(0, 80),
  };
}

function getApprovedFilterCodesForSupportSource(input) {
  const evidence = extractApprovedFilterEvidenceFromLines(input);
  if (evidence?.approvedUwCourseCodes?.length) {
    return evidence.approvedUwCourseCodes;
  }

  const fallbackCodes = uniqueSorted(
    (input.fallbackCourseCodes ?? []).map((courseCode) => normalizeCourseCode(courseCode))
  );
  const sourceLines = (input.lines ?? []).map((line) => stripSourceLineNoise(line)).join(" ");
  const fallbackSubjects = new Set(fallbackCodes.map((courseCode) => getCourseCodeSubject(courseCode)));
  const naturalScienceFilter = /\b(?:natural[-\s]science|approved[-\s]science|science)\b/i.test(
    String(input.filterKey ?? "")
  );
  if (
    /approved-course-list/i.test(String(input.owner?.sourceRole ?? "")) &&
    /\b(?:graduation requirements?|degree requirements?)\b/i.test(sourceLines) &&
    (!/\bapproved\b/i.test(sourceLines) ||
      (naturalScienceFilter &&
        [...fallbackSubjects].some((subject) =>
          ["CSE", "ENGL", "MATH", "SOC"].includes(subject)
        )))
  ) {
    return [];
  }

  return fallbackCodes;
}

function sourceLineStartsWithCourseCode(line) {
  const normalizedLine = normalizeWhitespace(String(line ?? "").replace(/^\[Page\s+\d+\]\s*/i, ""));
  if (!normalizedLine) {
    return false;
  }

  const directSubjectPattern =
    /^[-*\u2022\uF071\s]*(?:\(\s*\d+(?:\.\d+)?\s*\)\s*)?(?:[A-Z&]+(?:\s+[A-Z&]+)?(?:\s*\/\s*[A-Z&]+(?:\s+[A-Z&]+)?)?\s+\d{3}[A-Za-z]?\*?|\d{3}[A-Za-z]?\b)/i;
  return directSubjectPattern.test(normalizedLine);
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

    for (const courseCode of extractCourseCodesFromRequirementLine(line)) {
      if (isSafeKnownSubjectCourseClusterLine(entry, lines, index, courseCode)) {
        recoveredCodes.push(courseCode);
      }
    }
  }

  return uniqueSorted(recoveredCodes);
}

function isDirectCourseLineRecoverySource(entry) {
  const sourceText = [
    entry?.parserType,
    entry?.label,
    entry?.sourceLabel,
    entry?.url,
  ].filter(Boolean).join(" ");
  return (
    /\bpdf-(?:degree-sheet|worksheet)\b/i.test(sourceText) ||
    (/\bhtml-(?:degree|curriculum|overview)-page\b/i.test(sourceText) &&
      /\b(curriculum|requirements?|checklist|worksheet|degree|sample program plan)\b/i.test(sourceText)) ||
    (/\.(?:pdf|docx)(?:$|[?#])/i.test(sourceText) &&
      /\b(curriculum|requirements?|checklist|worksheet|degree)\b/i.test(sourceText))
  );
}

function extractSafeDirectCourseLineCodesFromLines(entry, lines) {
  if (!entry || !Array.isArray(lines) || !isDirectCourseLineRecoverySource(entry)) {
    return [];
  }

  const recoveredCodes = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeWhitespace(lines[index]);
    if (
      !line ||
      NOISY_SOURCE_LINE_PATTERN.test(line) ||
      TRANSFER_CREDIT_NOISE_PATTERN.test(line) ||
      !sourceLineStartsWithCourseCode(line) ||
      !hasRequirementContextNearLine(lines, index, 80)
    ) {
      continue;
    }
    recoveredCodes.push(...extractCourseCodesFromRequirementLine(line));
  }

  return uniqueSorted(recoveredCodes);
}

function extractSubjectScopedBareChecklistCodesFromLines(entry, lines) {
  if (!entry || !Array.isArray(lines) || !isDirectCourseLineRecoverySource(entry)) {
    return [];
  }

  const subjectContexts = [];
  const recoveredCodes = [];
  const numberedSubjectHeadingPattern = /\b\d+\)\s+[^()]{2,90}\(([A-Z& ]{2,10})\)/g;
  const bareChecklistNumberPattern =
    /(?:^|[^\w])(?:[^\w\d]{1,10}\s*)?(\d{3}[A-Za-z]?)\s*\(\d+(?:\.\d+)?\)/giu;

  const getRecentSubjectContexts = (index) =>
    subjectContexts
      .filter((context) => index - context.index <= 30)
      .slice(-6)
      .reverse();

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = normalizeWhitespace(lines[index]);
    const line = stripChoiceListLine(rawLine);
    if (!line || NOISY_SOURCE_LINE_PATTERN.test(line) || TRANSFER_CREDIT_NOISE_PATTERN.test(line)) {
      continue;
    }

    for (const headingMatch of line.matchAll(numberedSubjectHeadingPattern)) {
      const subject = normalizeExtractedCourseSubject(headingMatch[1]);
      if (subject) {
        subjectContexts.push({ subject, index });
      }
    }

    const explicitCourseCodes = extractCourseCodesFromLine(line);
    const explicitCourseCodeSubjects = new Set(
      explicitCourseCodes.map((courseCode) => getCourseCodeSubject(courseCode)).filter(Boolean)
    );
    const recentSubjectContexts = getRecentSubjectContexts(index);
    if (!recentSubjectContexts.length) {
      continue;
    }

    for (const numberMatch of line.matchAll(bareChecklistNumberPattern)) {
      const number = numberMatch[1];
      const candidateCodes = recentSubjectContexts
        .map((context) => ({
          context,
          courseCode: normalizeExtractedCourseCode(context.subject, number),
        }))
        .filter(({ courseCode }) => courseCode)
        .filter(({ courseCode }) => !explicitCourseCodes.includes(courseCode));
      if (!candidateCodes.length) {
        continue;
      }

      const selected =
        candidateCodes.find(
          ({ context }) =>
            !explicitCourseCodeSubjects.size || explicitCourseCodeSubjects.has(context.subject)
        ) ??
        candidateCodes[0];
      if (selected?.courseCode) {
        recoveredCodes.push(selected.courseCode);
      }
    }
  }

  return uniqueSorted(recoveredCodes);
}

function extractCourseCodesFromLines(lines, headings, entry = null) {
  return uniqueSorted([
    ...extractRelevantRequirementLines(lines, headings).flatMap((line) =>
      extractCourseCodesFromRequirementLine(line)
    ),
    ...extractSafeKnownSubjectCourseClusterCodesFromLines(entry, lines),
    ...extractSafeDirectCourseLineCodesFromLines(entry, lines),
    ...extractSubjectScopedBareChecklistCodesFromLines(entry, lines),
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

  const normalizedMentionedScope = normalizeMatcherText(match[1]).replace(/^the\s+/, "");
  if (!normalizedMentionedScope) {
    return false;
  }
  if (/\b[a-z&]+(?:\s+[a-z&]+)*\s+\d{3}[a-z]?\b/.test(normalizedMentionedScope)) {
    return false;
  }
  const ownerScopeAcronym = normalizedOwnerTitle
    .split(" ")
    .filter(
      (token) =>
        token.length > 1 &&
        !["ba", "bs", "baba", "degree", "major", "minor", "program"].includes(token)
        && !/^[abms]$/.test(token)
    )
    .map((token) => token[0])
    .join("");
  if (ownerScopeAcronym && normalizedMentionedScope === ownerScopeAcronym) {
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
  const hintSafeCourseCodes = uniqueSorted(
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
  return uniqueSorted(
    parserRules.filterCourseCodesBySupportOnlyEvidence({
      courseCodes: hintSafeCourseCodes,
      lines,
      getSourceLineHints: (courseCode) => getSourceLineHints(lines, courseCode),
    })
  );
}

function filterParsedCourseCodesByHintsWithSourceRecovery(entry, lines, courseCodes) {
  return uniqueSorted([
    ...filterParsedCourseCodesByHints(entry, lines, courseCodes),
    ...extractSafeDirectCourseLineCodesFromLines(entry, lines),
  ]);
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

const NON_SCHEDULABLE_SOURCE_SECTION_ROLES = new Set([
  "upper-division-prerequisite-table",
  "post-admission-degree-completion-section",
  "approved-course-list",
  "elective-list",
  "non-schedulable-course-list",
  "support-metadata",
]);

function getParsedCourseLevel(courseCode) {
  const match = String(courseCode ?? "").match(/\b(\d{3})/);
  return match ? Number(match[1]) : null;
}

function getCourseLevelSummary(courseCodes) {
  const levels = (courseCodes ?? []).map(getParsedCourseLevel).filter((level) => level != null);
  const upperDivisionCount = levels.filter((level) => level >= 300).length;
  const lowerDivisionCount = levels.filter((level) => level < 300).length;
  return {
    totalCount: levels.length,
    upperDivisionCount,
    lowerDivisionCount,
    mainlyUpperDivision:
      levels.length > 0 && upperDivisionCount >= Math.max(1, Math.ceil(levels.length * 0.75)),
    allLowerDivision: levels.length > 0 && upperDivisionCount === 0,
  };
}

function isCourseCodeLevelReference(text, courseCode) {
  const subject = getCourseCodeSubject(courseCode);
  const level = getParsedCourseLevel(courseCode);
  if (!subject || level == null) {
    return false;
  }
  const escapedSubject = subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escapedSubject}\\s+${level}\\s*[-\\s]*level\\b`, "i").test(
    text
  );
}

function normalizeSourceSectionLine(line) {
  return normalizeWhitespace(stripChoiceListLine(line));
}

function extractCourseCodesFromRequirementLine(line) {
  const normalizedLine = normalizeWhitespace(line);
  return uniqueSorted(
    extractCourseCodesFromLine(normalizedLine).filter(
      (courseCode) => !isCourseCodeLevelReference(normalizedLine, courseCode)
    )
  );
}

function hasPrerequisiteOnlyCue(text) {
  return /\b(?:prereq(?:uisites?)?|recommended preparation|course prerequisites?|minimum grade prerequisite|minimum grade required|cse\s*300[-\s]?level prerequisites?)\b/i.test(
    text
  );
}

function hasCourseListSectionCue(text) {
  return /\b(?:course lists?|list of courses|curriculum list|curricular list|tracks?|focus areas?|areas of specialization|areas of concentration|computing specializations?)\b/i.test(
    text
  );
}

function hasApprovedCourseListSectionCue(text) {
  return /\bapproved\b.{0,80}\b(?:courses?|course list|list)\b|\b(?:courses?|course list|list)\b.{0,80}\bapproved\b/i.test(
    text
  );
}

function hasElectiveListSectionCue(text) {
  return /\b(?:approved electives?|elective list|elective courses?|technical electives?|free electives?)\b/i.test(
    text
  );
}

function isLikelySourceSectionHeadingLine(text) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return false;
  }

  if (/\bT\s*ELEC\s*\d+\b/i.test(normalized) || /^UWT Elective Course$/i.test(normalized)) {
    return false;
  }

  if (extractCourseCodesFromLine(normalized).length > 0) {
    return false;
  }

  if (normalized.length <= 80 && !/[.!?]\s*$/.test(normalized)) {
    return true;
  }

  return (
    normalized.length <= 140 &&
    /\b(?:requirements?|curriculum|courses?|electives?|options?|concentrations?|tracks?|preparation|prereq(?:uisites?)?)\b/i.test(
      normalized
    ) &&
    !/\b(?:as a|by taking|in general|make sure|cannot overlap|together|within|below)\b/i.test(
      normalized
    )
  );
}

function hasPrimaryRequirementSectionCue(text) {
  return /\b(?:graduation requirements?|degree requirements?|major requirements?|completion requirements?|core requirements?|elective requirements?|general education requirements?|required courses?|fundamentals|mathematics|natural sciences?|physics|chemistry|biology|calculus|composition|data and society|core and electives|areas of inquiry|engineering fundamentals|mathematics\s*&\s*natural sciences|written\s*&\s*oral communication)\b|^requirements?$|^major in\b|^course #$|\b(?:concentration|option|track|pathway|route)\b$/i.test(
    text
  );
}

function hasCreditBucketRequirementCue(text) {
  return (
    /\b(?:minimum(?:\s+of)?|at\s+least|min\.?)?\s*\d+(?:\s*(?:-|to)\s*\d+)?\s+(?:additional\s+)?credits?(?:\s*\([^)]*\))?\s+(?:from|of)\b/i.test(
      text
    ) ||
    /\b(?:minimum(?:\s+of)?|at\s+least|min\.?)?\s*\d+(?:\s*(?:-|to)\s*\d+)?\s+(?:additional\s+)?credits?\s+(?:primary|secondary)?\s*language\b/i.test(
      text
    ) ||
    /\b(?:minimum(?:\s+of)?|at\s+least|min\.?)?\s*\d+(?:\s*(?:-|to)\s*\d+)?\s+(?:additional\s+)?credits?\b.{0,100}\bcomplete\b.{0,100}\b(?:second|third|fourth)[-\s]?year\s+level\b/i.test(
      text
    ) ||
    /\b(?:minimum(?:\s+of)?|at\s+least|min\.?)?\s*\d+(?:\s*(?:-|to)\s*\d+)?\s+(?:additional\s+)?credits?\b.{0,80}\b(?:elective coursework|courses?)\b.{0,80}\b(?:from|below|lists?)\b/i.test(
      text
    )
  );
}

function hasCreditLimitSupportCue(text) {
  return (
    /\b(?:up\s+to|maximum(?:\s+of)?|no\s+more\s+than)\s+\d+(?:\.\d+)?\s+credits?\b/i.test(
      text
    ) &&
    /\b(?:may|can|could)\s+(?:be\s+)?(?:appl(?:y|ied)|count(?:ed)?|used)\b/i.test(text)
  );
}

function hasAdmissionPrepSectionCue(text) {
  return /\b(?:admission|application|apply|preparation|before applying|before admission|prior to admission|pre-major)\b/i.test(
    text
  );
}

function hasAdmissionPrepHeadingCue(text) {
  return (
    /\b(?:admissions?|application|apply|prereq(?:uisites?)?|before applying|before admission|prior to admission|pre-major)\b/i.test(
      text
    ) || /^recommended preparation$/i.test(text)
  );
}

function hasPostAdmissionDegreeCompletionCue(text) {
  return (
    /\b(?:year\s*(?:3|4|3\s*\+\s*4|three|four)|junior\s+year|senior\s+year)\b.{0,80}\b(?:requirements?|curriculum|courses?)\b/i.test(
      text
    ) ||
    /\byear\s*(?:3|4)\b.{0,80}\b[A-Z&]{2,}\s*\d{3}[A-Z]?\b/i.test(text)
  );
}

function sectionRoleCanCreateScheduleRows(sectionRole) {
  return (
    sectionRole === "primary-requirement-section" ||
    sectionRole === "admission-prep-section"
  );
}

function classifySourceSectionRoleForLine(line, inheritedRole = null) {
  const text = normalizeSourceSectionLine(line);
  const courseCodes = extractCourseCodesFromLine(text).filter(
    (courseCode) => !isCourseCodeLevelReference(text, courseCode)
  );
  const levelSummary = getCourseLevelSummary(courseCodes);
  const prerequisiteCue = hasPrerequisiteOnlyCue(text);
  const approvedCourseListCue = hasApprovedCourseListSectionCue(text);
  const electiveListCue = hasElectiveListSectionCue(text);
  const courseListCue = hasCourseListSectionCue(text);
  const headingLike = isLikelySourceSectionHeadingLine(text);
  const admissionCue = hasAdmissionPrepSectionCue(text);
  const primaryCue = hasPrimaryRequirementSectionCue(text);
  const optionReplacementCue = parserRules.hasOptionReplacementRequirementCue(text);
  const explicitChoiceRequirementCue =
    /\b(?:choose|select|one\s+of|one\s+course\s+from|credits?\s+from)\b/i.test(text) &&
    primaryCue &&
    !prerequisiteCue;

  if (hasPostAdmissionDegreeCompletionCue(text)) {
    return {
      sectionRole: "post-admission-degree-completion-section",
      reason: "post-admission year 3/4 completion section is not transfer-prep schedulable",
    };
  }

  if (
    hasAdmissionPrepHeadingCue(text) &&
    courseCodes.length === 0 &&
    /\b(?:requirements?|prereq(?:uisites?)?|preparation)\b/i.test(text)
  ) {
    return {
      sectionRole: "admission-prep-section",
      reason: "admission or preparation requirement heading",
    };
  }

  if (prerequisiteCue) {
    if (
      levelSummary.allLowerDivision &&
      /\b(?:can take|take either|choose|select|or)\b/i.test(text) &&
      /\bsatisf(?:y|ies)\b.{0,80}\bprereq(?:uisite)?\b/i.test(text)
    ) {
      return {
        sectionRole: "admission-prep-section",
        reason: "lower-division prerequisite option satisfies admission preparation",
      };
    }

    if (
      admissionCue &&
      levelSummary.allLowerDivision &&
      !/\b(?:upper[-\s]?division|[34]00[-\s]?level|cse\s*300[-\s]?level)\b/i.test(text)
    ) {
      return {
        sectionRole: "admission-prep-section",
        reason: "lower-division admission or preparation prerequisite section",
      };
    }

    if (
      levelSummary.mainlyUpperDivision ||
      levelSummary.upperDivisionCount > 0 ||
      /\b(?:upper[-\s]?division|[34]00[-\s]?level|cse\s*300[-\s]?level|prerequisite table)\b/i.test(
        text
      )
    ) {
      return {
        sectionRole: "upper-division-prerequisite-table",
        reason: "upper-division prerequisite-only section",
      };
    }

    return {
      sectionRole: "support-metadata",
      reason: "prerequisite-only text is retained as support metadata",
    };
  }

  if (optionReplacementCue) {
    return {
      sectionRole: "primary-requirement-section",
      reason: "option replacement requirement cue",
    };
  }

  if (hasCreditLimitSupportCue(text)) {
    return {
      sectionRole: "support-metadata",
      reason: "credit-limit note is support metadata",
    };
  }

  if (hasCreditBucketCue(text)) {
    return {
      sectionRole: "primary-requirement-section",
      reason: "credit-bucket requirement cue",
    };
  }

  if (hasCreditBucketRequirementCue(text) && (courseCodes.length === 0 || explicitChoiceRequirementCue)) {
    return {
      sectionRole: "primary-requirement-section",
      reason: "credit-bucket requirement cue",
    };
  }

  if (
    looksLikeStandaloneRequirementTitleLine(text) &&
    !electiveListCue &&
    !approvedCourseListCue &&
    !courseListCue
  ) {
    return {
      sectionRole: "primary-requirement-section",
      reason: "standalone requirement title",
    };
  }

  if (
    !explicitChoiceRequirementCue &&
    electiveListCue &&
    /\b\d+\s*(?:-\s*\d+)?\s*credits?\b/i.test(text)
  ) {
    return {
      sectionRole: "primary-requirement-section",
      reason: "credit-bearing elective requirement cue",
    };
  }

  if (
    !explicitChoiceRequirementCue &&
    courseListCue &&
    /\b(?:capstone|choose\s+one\s+track)\b/i.test(text) &&
    /\b\d+\s*(?:-\s*\d+)?\s*credits?\b/i.test(text)
  ) {
    return {
      sectionRole: "primary-requirement-section",
      reason: "credit-bearing capstone requirement cue",
    };
  }

  if (!explicitChoiceRequirementCue && electiveListCue && headingLike) {
    return {
      sectionRole: "elective-list",
      reason: "elective-list section is support metadata unless a primary requirement scopes it",
    };
  }

  if (!explicitChoiceRequirementCue && approvedCourseListCue && headingLike) {
    return {
      sectionRole: "approved-course-list",
      reason: "approved course-list section is support metadata",
    };
  }

  if (!explicitChoiceRequirementCue && courseListCue && headingLike) {
    return {
      sectionRole: "non-schedulable-course-list",
      reason: "course-list/navigation section is not transfer-plannable by itself",
    };
  }

  if (
    inheritedRole &&
    NON_SCHEDULABLE_SOURCE_SECTION_ROLES.has(inheritedRole) &&
    courseCodes.length > 0 &&
    /^[^:]{2,90}:\s+/.test(text)
  ) {
    return {
      sectionRole: "primary-requirement-section",
      reason: "labeled route course row overrides nearby non-schedulable heading",
    };
  }

  if (
    inheritedRole &&
    NON_SCHEDULABLE_SOURCE_SECTION_ROLES.has(inheritedRole) &&
    courseCodes.length > 0 &&
    levelSummary.allLowerDivision &&
    /\(\s*\d+(?:\.\d+)?\s*(?:credits?|cr)?\s*\)/i.test(text) &&
    !approvedCourseListCue &&
    !electiveListCue &&
    !courseListCue
  ) {
    return {
      sectionRole: "primary-requirement-section",
      reason: "lower-division credit-bearing requirement row overrides nearby non-schedulable heading",
    };
  }

  if (
    inheritedRole &&
    NON_SCHEDULABLE_SOURCE_SECTION_ROLES.has(inheritedRole) &&
    courseCodes.length > 0 &&
    !primaryCue &&
    !explicitChoiceRequirementCue
  ) {
    return {
      sectionRole: inheritedRole,
      reason: "inherits non-schedulable source-section role from nearby heading",
    };
  }

  if (
    levelSummary.mainlyUpperDivision &&
    /\b(?:table|prereq|prerequisite|course #|course name|required prior|recommended preparation)\b/i.test(
      text
    )
  ) {
    return {
      sectionRole: "upper-division-prerequisite-table",
      reason: "upper-division table row with prerequisite/table cues",
    };
  }

  if (admissionCue && levelSummary.allLowerDivision) {
    return {
      sectionRole: "admission-prep-section",
      reason: "lower-division admission/preparation section",
    };
  }

  if (primaryCue || courseCodes.length > 0) {
    return {
      sectionRole: "primary-requirement-section",
      reason: primaryCue
        ? "primary requirement cue"
        : "course row without prerequisite-only or course-list section cues",
    };
  }

  return {
    sectionRole: inheritedRole ?? "support-metadata",
    reason: inheritedRole
      ? "inherits nearby source-section role"
      : "support text without schedulable requirement cue",
  };
}

function buildParserPrerequisiteFilterAuditRows(input) {
  const rows = [];
  const normalizedHeadings = new Set(
    (input.headings ?? []).map((heading) => normalizeWhitespace(heading)).filter(Boolean)
  );
  let currentSectionTitle = "source root";
  let currentRole = "primary-requirement-section";

  for (let index = 0; index < (input.snapshotLines ?? []).length; index += 1) {
    const rawLine = normalizeWhitespace(input.snapshotLines[index]);
    const normalizedLine = normalizeSourceSectionLine(rawLine);
    if (!normalizedLine) {
      continue;
    }

    const courseCodes = extractCourseCodesFromRequirementLine(normalizedLine);
    const explicit = classifySourceSectionRoleForLine(normalizedLine, currentRole);
    const lineLooksLikeHeading =
      courseCodes.length === 0 &&
      (normalizedHeadings.has(normalizedLine) ||
        hasPrerequisiteOnlyCue(normalizedLine) ||
        ((hasCourseListSectionCue(normalizedLine) ||
          hasApprovedCourseListSectionCue(normalizedLine) ||
          hasElectiveListSectionCue(normalizedLine)) &&
          isLikelySourceSectionHeadingLine(normalizedLine)) ||
        parserRules.hasOptionReplacementRequirementCue(normalizedLine) ||
        hasPrimaryRequirementSectionCue(normalizedLine) ||
        hasAdmissionPrepHeadingCue(normalizedLine) ||
        hasPostAdmissionDegreeCompletionCue(normalizedLine));
    const lineLooksLikeStandaloneRequirementTitle =
      courseCodes.length === 0 && looksLikeStandaloneRequirementTitleLine(normalizedLine);

    if (lineLooksLikeHeading || lineLooksLikeStandaloneRequirementTitle) {
      currentSectionTitle = normalizedLine;
      currentRole = explicit.sectionRole;
    }

    const sectionRole = explicit.sectionRole;
    const schedulable = sectionRoleCanCreateScheduleRows(sectionRole);
    const hasFilterCue =
      sectionRole !== "primary-requirement-section" ||
      hasPrerequisiteOnlyCue(normalizedLine) ||
      hasCourseListSectionCue(normalizedLine) ||
      hasApprovedCourseListSectionCue(normalizedLine) ||
      hasElectiveListSectionCue(normalizedLine) ||
      hasCreditBucketCue(normalizedLine);
    if (!courseCodes.length && !hasFilterCue) {
      continue;
    }

    rows.push({
      ownerId: input.ownerId,
      sourceUrl: input.sourceUrl,
      sectionTitle: currentSectionTitle,
      rawLine: normalizedLine,
      courseCodesExtracted: courseCodes,
      detectedSectionRole: sectionRole,
      schedulable,
      reason: explicit.reason,
      issue: "none",
      copyOnlyDebugText: [
        "[parser prerequisite filter audit]",
        `Owner id: ${input.ownerId ?? "unknown"}`,
        `Source URL: ${input.sourceUrl ?? "n/a"}`,
        `Section title: ${currentSectionTitle || "source root"}`,
        `Raw line: ${normalizedLine || "none"}`,
        `Course codes extracted: ${courseCodes.length ? courseCodes.join(", ") : "none"}`,
        `Detected section role: ${sectionRole}`,
        `Schedulable: ${schedulable ? "yes" : "no"}`,
        `Reason: ${explicit.reason}`,
        "Issue: none",
      ].join(" "),
    });
  }

  return rows;
}

function getSchedulableSourceSectionLines(snapshotLines, auditRows) {
  const schedulableLines = new Set(
    (auditRows ?? [])
      .filter((row) => row.schedulable)
      .map((row) => normalizeWhitespace(row.rawLine))
  );
  return (snapshotLines ?? []).filter((line) => {
    const normalizedLine = normalizeSourceSectionLine(line);
    return !normalizedLine || schedulableLines.has(normalizedLine);
  });
}

function filterParsedCourseCodesBySourceSections(courseCodes, auditRows) {
  const rowsByCourseCode = new Map();
  for (const row of auditRows ?? []) {
    for (const courseCode of row.courseCodesExtracted ?? []) {
      const normalizedCourseCode = normalizeCourseCode(courseCode);
      if (!normalizedCourseCode) {
        continue;
      }
      const rows = rowsByCourseCode.get(normalizedCourseCode) ?? [];
      rows.push(row);
      rowsByCourseCode.set(normalizedCourseCode, rows);
    }
  }

  return uniqueSorted(
    (courseCodes ?? []).filter((courseCode) => {
      const normalizedCourseCode = normalizeCourseCode(courseCode);
      const rows = rowsByCourseCode.get(normalizedCourseCode) ?? [];
      return !rows.length || rows.some((row) => row.schedulable);
    })
  );
}

function getBlockedSourceSectionCourseCodes(auditRows) {
  return uniqueSorted(
    (auditRows ?? [])
      .filter((row) => !row.schedulable)
      .flatMap((row) => row.courseCodesExtracted ?? [])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function buildSupportListsFromSourceSectionAuditRows(input) {
  if (/\.pdf(?:$|[?#])/i.test(input.sourceUrl ?? "") || /^pdf-/i.test(input.parserType ?? "")) {
    return [];
  }

  const rowsByKey = new Map();
  for (const row of input.sourceSectionFilterAuditRows ?? []) {
    if (
      row.schedulable ||
      !["approved-course-list", "elective-list"].includes(row.detectedSectionRole)
    ) {
      continue;
    }
    const acceptedUwCourseCodes = uniqueSorted(
      (row.courseCodesExtracted ?? []).map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
    );
    if (!acceptedUwCourseCodes.length) {
      continue;
    }
    const listTitle =
      normalizeWhitespace(row.sectionTitle) ||
      (row.detectedSectionRole === "elective-list" ? "Elective list" : "Approved course list");
    const key = `${row.detectedSectionRole}:${listTitle}`;
    const existing = rowsByKey.get(key) ?? {
      shape: row.detectedSectionRole === "elective-list" ? "elective-list" : "approved-course-list",
      listTitle,
      acceptedUwCourseCodes: [],
    };
    existing.acceptedUwCourseCodes = uniqueSorted([
      ...existing.acceptedUwCourseCodes,
      ...acceptedUwCourseCodes,
    ]);
    rowsByKey.set(key, existing);
  }

  return [...rowsByKey.values()].map((supportList) =>
    buildRequirementSupportListFromMetadata({
      ...input,
      id: `${input.id}:source-section:${slugify(supportList.listTitle)}`,
      shape: supportList.shape,
      sourceLabel: supportList.listTitle,
      acceptedUwCourseCodes: supportList.acceptedUwCourseCodes,
      approvedListKey:
        supportList.shape === "approved-course-list"
          ? `${slugify(input.planId || input.ownerId || "unknown-owner")}:${slugify(supportList.listTitle)}`
          : null,
    })
  );
}

function findSourceSectionAuditRowForText(text, auditRows) {
  const normalizedText = normalizeSourceSectionLine(text);
  if (!normalizedText) {
    return null;
  }

  const isInformativeAuditText = (value) =>
    value.length >= 18 &&
    !/^\d+(?:\s*(?:-|to)\s*\d+)?$/.test(value) &&
    !/^(?:credits?|course #|course name|total)$/i.test(value);

  return (
    (auditRows ?? []).find(
      (row) => normalizeWhitespace(row.rawLine) === normalizedText
    ) ??
    (auditRows ?? []).find(
      (row) => {
        const rowText = normalizeWhitespace(row.rawLine);
        return isInformativeAuditText(normalizedText) && rowText.includes(normalizedText);
      }
    ) ??
    (auditRows ?? []).find(
      (row) => {
        const rowText = normalizeWhitespace(row.rawLine);
        return isInformativeAuditText(rowText) && normalizedText.includes(rowText);
      }
    ) ??
    null
  );
}

function getGroupSourceSectionDecision(group, auditRows) {
  if (group.detectedOptionCue === "option replacement") {
    return {
      detectedSectionRole: "primary-requirement-section",
      schedulable: true,
      reason: "option replacement parser rule",
    };
  }

  const row = findSourceSectionAuditRowForText(
    group.sourceRowText ?? group.sourceHeading ?? group.label,
    auditRows
  );
  if (row) {
    return row;
  }

  if (/^sectioned\b/i.test(group.detectedOptionCue ?? "")) {
    return {
      detectedSectionRole: "primary-requirement-section",
      schedulable: true,
      reason: "sectioned requirement group parsed from source heading and following course rows",
    };
  }

  if (
    group.requirementType === "sequence_choice" &&
    hasSequenceChoiceContext(group.sourceRowText ?? group.sourceHeading ?? group.label)
  ) {
    return {
      detectedSectionRole: "primary-requirement-section",
      schedulable: true,
      reason: "sequence-choice requirement cue",
    };
  }

  const explicit = classifySourceSectionRoleForLine(
    `${group.sourceSection ?? ""} ${group.sourceRowText ?? group.sourceHeading ?? group.label}`
  );
  return {
    detectedSectionRole: explicit.sectionRole,
    schedulable: sectionRoleCanCreateScheduleRows(explicit.sectionRole),
    reason: explicit.reason,
  };
}

function sourceSectionDecisionAllowsCourseOption(option, auditRows) {
  const explicitOptionCourseCodes = [
    ...(option.uwCourses ?? []),
    ...(option.equivalentUwCourseCodes ?? []),
  ];
  const optionCourseCodes = uniqueSorted(
    explicitOptionCourseCodes.length
      ? explicitOptionCourseCodes
      : option.displayCourseCodes ?? []
  )
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter(Boolean);
  if (!optionCourseCodes.length) {
    return true;
  }

  const row = findSourceSectionAuditRowForText(
    normalizeWhitespace(option.sourceRowText) ||
      option.label ||
      option.title ||
      option.sourceHeading,
    auditRows
  );
  if (row?.schedulable === true) {
    return true;
  }
  if (row?.schedulable === false) {
    return optionCourseCodes.some((courseCode) =>
      (auditRows ?? []).some(
        (candidateRow) =>
          candidateRow.schedulable === true &&
          (candidateRow.courseCodesExtracted ?? [])
            .map((candidateCode) => normalizeCourseCode(candidateCode))
            .includes(courseCode)
      )
    );
  }

  const courseSectionRows = optionCourseCodes.map((courseCode) =>
    (auditRows ?? []).filter((candidateRow) =>
      (candidateRow.courseCodesExtracted ?? [])
        .map((candidateCode) => normalizeCourseCode(candidateCode))
        .includes(courseCode)
    )
  );
  const hasSchedulableCourseRow = courseSectionRows.some((rows) =>
    rows.some((candidateRow) => candidateRow.schedulable === true)
  );
  const hasBlockedCourseRow = courseSectionRows.some(
    (rows) => rows.length > 0 && rows.every((candidateRow) => candidateRow.schedulable !== true)
  );
  if (hasBlockedCourseRow && !hasSchedulableCourseRow) {
    return false;
  }
  return hasSchedulableCourseRow || courseSectionRows.some((rows) => rows.length === 0);
}

function getSourceSectionRowsForCourseCode(courseCode, auditRows) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  if (!normalizedCourseCode) {
    return [];
  }

  return (auditRows ?? []).filter((candidateRow) =>
    (candidateRow.courseCodesExtracted ?? [])
      .map((candidateCode) => normalizeCourseCode(candidateCode))
      .includes(normalizedCourseCode)
  );
}

function sourceSectionRowsAllowCourseCode(courseCode, auditRows, matchedRow = null) {
  const rows = getSourceSectionRowsForCourseCode(courseCode, auditRows);
  if (!rows.length) {
    return matchedRow?.schedulable !== false;
  }
  return rows.some((row) => row.schedulable === true);
}

function filterParsedRequirementOptionCodesBySourceSections(option, auditRows) {
  if (option.optionKind === "category-option") {
    return option;
  }

  const matchedRow = findSourceSectionAuditRowForText(
    normalizeWhitespace(option.sourceRowText) ||
      option.label ||
      option.title ||
      option.sourceHeading,
    auditRows
  );
  if (matchedRow?.schedulable === true) {
    return option;
  }

  const shouldFilterCodes =
    matchedRow?.schedulable === false ||
    [...(option.uwCourses ?? []), ...(option.equivalentUwCourseCodes ?? [])].some((courseCode) => {
      const rows = getSourceSectionRowsForCourseCode(courseCode, auditRows);
      return rows.length > 0 && !rows.some((row) => row.schedulable === true);
    });
  if (!shouldFilterCodes) {
    return option;
  }

  const originalUwCourses = option.uwCourses ?? [];
  const filteredUwCourses = originalUwCourses.filter((courseCode) =>
    sourceSectionRowsAllowCourseCode(courseCode, auditRows, matchedRow)
  );
  const filteredEquivalentUwCourseCodes = (option.equivalentUwCourseCodes ?? []).filter((courseCode) =>
    sourceSectionRowsAllowCourseCode(courseCode, auditRows, matchedRow)
  );
  if (!filteredUwCourses.length && !filteredEquivalentUwCourseCodes.length) {
    return null;
  }

  const displayCourseCodes =
    (option.displayCourseCodes ?? []).length === originalUwCourses.length
      ? (option.displayCourseCodes ?? []).filter((_, index) =>
          filteredUwCourses.includes(originalUwCourses[index])
        )
      : option.displayCourseCodes;

  return {
    ...option,
    displayCourseCodes,
    uwCourses: filteredUwCourses,
    equivalentUwCourseCodes: filteredEquivalentUwCourseCodes,
  };
}

function filterParsedRequirementGroupOptionsBySourceSections(group, auditRows) {
  const options = group.options ?? [];
  if (!options.length) {
    return group;
  }

  const filteredOptions = options
    .filter((option) => sourceSectionDecisionAllowsCourseOption(option, auditRows))
    .map((option) => filterParsedRequirementOptionCodesBySourceSections(option, auditRows))
    .filter(Boolean);
  if (
    filteredOptions.length === options.length &&
    filteredOptions.every((option, index) => option === options[index])
  ) {
    return group;
  }

  return {
    ...group,
    options: filteredOptions,
  };
}

function parsedRequirementGroupHasRequirementSurface(group) {
  if ((group.options ?? []).length > 0 || (group.sequencePaths ?? []).length > 0) {
    return true;
  }
  if (group.categoryOption || group.approvedListKey || group.programSpecific === true) {
    return true;
  }
  return group.requirementType === "choose_credits" && group.canCreatePlaceholder !== false;
}

function filterParsedRequirementGroupsBySourceSections(groups, auditRows) {
  return (groups ?? [])
    .filter((group) => {
      const decision = getGroupSourceSectionDecision(group, auditRows);
      return decision.schedulable;
    })
    .map((group) => filterParsedRequirementGroupOptionsBySourceSections(group, auditRows))
    .filter(parsedRequirementGroupHasRequirementSurface);
}

function getSourceSectionDecisionForCourse(courseCode, auditRows) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const rows = (auditRows ?? []).filter((row) =>
    (row.courseCodesExtracted ?? [])
      .map((candidate) => normalizeCourseCode(candidate))
      .includes(normalizedCourseCode)
  );
  const postAdmissionRows = rows.filter(
    (row) => row.detectedSectionRole === "post-admission-degree-completion-section"
  );
  if (postAdmissionRows.length) {
    const strongSchedulableRows = rows.filter(
      (row) =>
        row.schedulable &&
        /\b\d+(?:\.\d+)?\s*cr\b/i.test(normalizeWhitespace(row.rawLine ?? ""))
    );
    if (!strongSchedulableRows.length) {
      return postAdmissionRows[0];
    }
  }
  return (
    rows.find((row) => row.schedulable) ??
    rows[0] ??
    null
  );
}

function buildParsedRequirementAtomCandidates(
  owner,
  parsedCourseCodes,
  snapshotLines,
  sourceSectionFilterAuditRows = []
) {
  const seenAtomIds = new Map();
  return parsedCourseCodes.map((courseCode) => {
    const baseId = `${owner.ownerId}:source-atom:${slugify(courseCode)}`;
    const sourceLineHints = getSourceLineHints(snapshotLines, courseCode);
    const inferredPhase = inferParsedRequirementPhaseFromHints(sourceLineHints);
    const sourceSectionDecision = getSourceSectionDecisionForCourse(
      courseCode,
      sourceSectionFilterAuditRows
    );
    return {
      id: buildUniqueDerivedId(baseId, seenAtomIds),
      title: courseCode,
      uwCourseCode: courseCode,
      phase: inferredPhase.phase,
      displayPhase: inferredPhase.displayPhase,
      phaseConfidence: inferredPhase.phaseConfidence,
      sourceLineHints,
      sourceSectionRole: sourceSectionDecision?.detectedSectionRole ?? null,
      sourceSectionSchedulable:
        typeof sourceSectionDecision?.schedulable === "boolean"
          ? sourceSectionDecision.schedulable
          : null,
      sourceSectionReason: sourceSectionDecision?.reason ?? null,
    };
  });
}

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

function parseRequirementCreditRange(value) {
  const text = normalizeWhitespace(String(value ?? ""));
  if (!text) {
    return null;
  }

  const rangePatterns = [
    /\b(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(?:additional\s+)?(?:credits?|cr)\b/i,
    /\b(\d+(?:\.\d+)?)\s*(?:additional\s+)?(?:credits?|cr)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(?:credits?|cr)?\b/i,
    /\(\s*(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*\)/i,
  ];

  for (const pattern of rangePatterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    if (pattern === rangePatterns[2] && !/\b(?:credits?|cr)\b/i.test(text)) {
      continue;
    }
    const min = Number.parseFloat(match[1]);
    const max = Number.parseFloat(match[2]);
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min) {
      return { minCredits: min, maxCredits: max };
    }
  }

  const minimumMatch = text.match(
    /\b(?:minimum(?:\s+of)?|at\s+least|min\.?)\s+(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b/i
  );
  if (minimumMatch) {
    const min = Number.parseFloat(minimumMatch[1]);
    if (Number.isFinite(min) && min > 0) {
      return { minCredits: min, maxCredits: null };
    }
  }

  const categoryCreditMatch = text.match(
    /\b(\d+(?:\.\d+)?)\s+(?:additional\s+)?(?:[A-Za-z&]+\s+){0,5}credits?\b/i
  );
  if (
    categoryCreditMatch &&
    CATEGORY_OPTION_DEFINITIONS.some((definition) => definition.pattern.test(text))
  ) {
    const credits = Number.parseFloat(categoryCreditMatch[1]);
    if (Number.isFinite(credits) && credits > 0) {
      return { minCredits: credits, maxCredits: credits };
    }
  }

  const fixedCreditMatch = text.match(
    /\b(\d+(?:\.\d+)?)\s*(?:additional\s+)?(?:credits?|cr)\b/i
  );
  if (fixedCreditMatch) {
    const credits = Number.parseFloat(fixedCreditMatch[1]);
    if (Number.isFinite(credits) && credits > 0) {
      return { minCredits: credits, maxCredits: credits };
    }
  }

  const hyphenCreditMatch = text.match(/\b(\d+(?:\.\d+)?)\s*-\s*credits?\b/i);
  if (hyphenCreditMatch) {
    const credits = Number.parseFloat(hyphenCreditMatch[1]);
    if (Number.isFinite(credits) && credits > 0) {
      return { minCredits: credits, maxCredits: credits };
    }
  }

  const parentheticalCreditMatch = text.match(/\(\s*(\d+(?:\.\d+)?)\s*\)/);
  if (
    parentheticalCreditMatch &&
    CATEGORY_OPTION_DEFINITIONS.some((definition) => definition.pattern.test(text))
  ) {
    const credits = Number.parseFloat(parentheticalCreditMatch[1]);
    if (Number.isFinite(credits) && credits > 0) {
      return { minCredits: credits, maxCredits: credits };
    }
  }

  return null;
}

const CATEGORY_OPTION_DEFINITIONS = [
  {
    category: "NSC",
    sourceCategoryCode: "NSc",
    longLabel: "Natural Sciences",
    pattern: /\b(?:N\s*Sc|natural sciences?|natural science)\b/i,
  },
  {
    category: "AH",
    sourceCategoryCode: "A&H",
    longLabel: "Arts and Humanities",
    pattern: /\b(?:A\s*&\s*H|arts?\s+(?:and|&)\s+humanities|humanities|fine arts?)\b/i,
  },
  {
    category: "SSC",
    sourceCategoryCode: "SSc",
    longLabel: "Social Sciences",
    pattern: /\b(?:S\s*Sc|social sciences?)\b/i,
  },
  {
    category: "QSR",
    sourceCategoryCode: "QSR",
    longLabel: "Quantitative and Symbolic Reasoning",
    pattern: /\bQSR\b|\bquantitative and symbolic reasoning\b/i,
  },
  {
    category: "VLPA",
    sourceCategoryCode: "VLPA",
    longLabel: "Visual, Literary, and Performing Arts",
    pattern: /\bVLPA\b|\bvisual,\s*literary,\s*and\s*performing arts\b/i,
  },
  {
    category: "DIV",
    sourceCategoryCode: "DIV",
    longLabel: "Diversity",
    pattern: /\bDIV\b|\bdiversity\b/i,
  },
  {
    category: "NW",
    sourceCategoryCode: "NW",
    longLabel: "Natural World",
    pattern: /\bNW\b|\bnatural world\b/i,
  },
  {
    category: "IANDS",
    sourceCategoryCode: "I&S",
    longLabel: "Individuals and Societies",
    pattern: /\bI\s*&\s*S\b|\bindividuals\s+and\s+societies\b/i,
  },
];

function getRequirementCategoryOptionDescriptor(text) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return null;
  return CATEGORY_OPTION_DEFINITIONS.find((definition) =>
    definition.pattern.test(normalized)
  ) ?? null;
}

function parseCategoryOptionCreditAmount(text, fallbackCredits = null) {
  const normalized = normalizeWhitespace(text);
  const parentheticalCreditMatch = normalized.match(/\(\s*(\d+(?:\.\d+)?)\s*\)/);
  if (parentheticalCreditMatch) {
    return Number(parentheticalCreditMatch[1]);
  }

  const explicitCreditMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b/i);
  if (explicitCreditMatch) {
    return Number(explicitCreditMatch[1]);
  }

  return fallbackCredits;
}

function buildCategoryRequirementOption(input) {
  const descriptor =
    input.descriptor ?? getRequirementCategoryOptionDescriptor(input.sourceText);
  if (!descriptor) {
    return null;
  }

  const creditRange =
    input.creditRange ?? parseRequirementCreditRange(input.sourceText) ?? null;
  const creditMin =
    creditRange?.minCredits ?? parseCategoryOptionCreditAmount(input.sourceText, input.fallbackCredits);
  const creditMax = creditRange?.maxCredits ?? creditMin;
  if (!Number.isFinite(creditMin) || creditMin <= 0) {
    return null;
  }

  const sourceText = normalizeWhitespace(input.sourceText);
  const creditText =
    creditMax && creditMax !== creditMin ? `${creditMin}-${creditMax}` : String(creditMin);
  const title = `${creditText} credits of ${descriptor.longLabel} (${descriptor.sourceCategoryCode})`;

  return {
    id: input.id,
    optionKind: "category-option",
    displayCourseCodes: [],
    uwCourses: [],
    equivalentUwCourseCodes: [],
    credits: creditMin,
    creditMin,
    creditMax,
    creditText,
    maxCredits: null,
    title,
    department: null,
    category: descriptor.category,
    sourceHeading: input.sourceHeading,
    sourceCategory: input.sourceCategory,
    grcMatches: [],
    categoryOption: {
      category: descriptor.category,
      sourceCategoryCode: descriptor.sourceCategoryCode,
      title,
      credits: creditMin,
      creditMin,
      creditMax,
      sourceText,
      approvedListKey: input.approvedListKey ?? descriptor.approvedListKey ?? null,
      programSpecific: input.programSpecific ?? descriptor.programSpecific ?? false,
    },
    constraints: [],
    notes: [
      input.programSpecific || descriptor.programSpecific
        ? "Program-specific category option; use the approved-list filter rather than generic Area of Inquiry matching."
        : "Category option; no specific Green River course is invented.",
    ],
    label: title,
  };
}

function buildCategoryRequirementOptionsFromChoiceLine(owner, normalizedLine, fallbackCredits) {
  if (!/\bor\b|choose|select|one of/i.test(normalizedLine)) {
    return [];
  }

  return uniqueBy(
    normalizedLine
      .split(/\bor\b|;|\u2022/gi)
      .map(normalizeWhitespace)
      .filter(Boolean)
      .filter((segment) => extractCourseCodesFromLine(segment).length === 0)
      .map((segment, index) =>
        buildCategoryRequirementOption({
          id: `${owner.ownerId}:requirement-option:${slugify(
            `category-${segment}-${index + 1}`
          )}`,
          sourceText: segment,
          sourceHeading: normalizedLine,
          sourceCategory: "source-choice",
          fallbackCredits,
        })
      )
      .filter(Boolean),
    (option) =>
      `${option.categoryOption.category}:${option.categoryOption.credits}:${option.categoryOption.sourceText}`
  );
}

function stripSnapshotPagePrefix(line) {
  return normalizeWhitespace(String(line ?? "").replace(/^\[Page\s+\d+\]\s*/i, ""));
}

function stripLeadingRequirementGlyphs(line) {
  return normalizeWhitespace(
    String(line ?? "")
      .replace(/^\(\s*\d+(?:\.\d+)?\s*\)\s*[^A-Za-z0-9(]{1,12}\s*/u, "")
      .replace(/^[^A-Za-z0-9(\[]{1,12}\s*/u, "")
      .replace(/^(?:[•●\-\u2023\u25B8\u1405]+\s*)+/u, "")
  );
}

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

function parseChoiceRequiredCount(value) {
  const text = normalizeWhitespace(value).toLowerCase();
  const numericMatch = text.match(/\b(?:choose|select)\s+(\d+)\b/);
  if (numericMatch) {
    const count = Number.parseInt(numericMatch[1], 10);
    return Number.isFinite(count) && count > 0 ? count : 1;
  }

  const wordMatch = text.match(
    /\b(?:choose|select)\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b|\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+of(?:\s+the\s+following)?\b/
  );
  const word = wordMatch?.[1] ?? wordMatch?.[2] ?? null;
  if (word) {
    return WORD_NUMBER_MAP.get(word) ?? 1;
  }

  if (/\bone\s+(?:course\s+)?from\b|\bone\s+of(?:\s+the\s+following)?\b|\bselect\s+one\b|\bchoose\s+one\b|\beither\b/i.test(text)) {
    return 1;
  }

  return 1;
}

function hasChoiceRequirementContext(value) {
  return CHOICE_REQUIREMENT_CONTEXT_PATTERN.test(normalizeWhitespace(value));
}

function hasStrongChoiceRequirementContext(value) {
  return STRONG_CHOICE_REQUIREMENT_CONTEXT_PATTERN.test(normalizeWhitespace(value));
}

function stripNonOptionCourseEvidenceFromChoiceLine(value) {
  return normalizeWhitespace(
    String(value ?? "")
      .replace(/\[[^\]]*\b(?:pr|pre-?req|prereq(?:uisite)?)[^\]]*\]/gi, "")
      .replace(/\([^)]*\b(?:pr|pre-?req|prereq(?:uisite)?)[^)]*\)/gi, "")
      .replace(/\b(?:pr|pre-?req|prereq(?:uisite)?):\s*[^.;)\]]+/gi, "")
  );
}

function findNearbyRequirementChoiceLabel(snapshotLines, choiceLineIndex) {
  const startIndex = Math.max(0, choiceLineIndex - 5);
  let creditLine = "";

  for (let index = choiceLineIndex - 1; index >= startIndex; index -= 1) {
    const line = normalizeWhitespace(snapshotLines[index]);
    const lineWithoutPage = stripSnapshotPagePrefix(line);
    const labelCandidate = stripLeadingRequirementGlyphs(lineWithoutPage);
    if (/^\d+(?:-\d+)?\s*cr$/i.test(labelCandidate)) {
      creditLine = labelCandidate;
      continue;
    }

    if (extractCourseCodesFromRequirementLine(labelCandidate).length > 0) {
      return "";
    }

    if (looksLikeStandaloneRequirementLabelLine(labelCandidate)) {
      return labelCandidate;
    }

    if (
      looksLikeStandaloneRequirementTitleLine(labelCandidate) &&
      (hasChoiceRequirementContext(lineWithoutPage) ||
        PROGRAMMING_CHOICE_CONTEXT_PATTERN.test(labelCandidate))
    ) {
      return labelCandidate;
    }

    if (looksLikeStandaloneRequirementTitleLine(labelCandidate) && creditLine) {
      return normalizeWhitespace(`${labelCandidate} ${creditLine}`);
    }
  }

  return "";
}

function stripChoiceListLine(line) {
  return stripLeadingRequirementGlyphs(stripSnapshotPagePrefix(line));
}

function trimChoiceListContinuationNoise(line) {
  return normalizeWhitespace(
    String(line ?? "")
      .replace(
        /,\s*[A-Z][A-Za-z&/ -]{2,80}\s+\([A-Z& ]+\s+\d{3}(?:\.\d+)?[A-Z]?[^)]*\)\s*$/i,
        ""
      )
      .replace(
        /\s+\b(?:Professional Practice|Capstone and Professional Practice|Engineering Fundamentals|Engineering & Science Electives|Technical Electives|Written Communication|Academic Planning Notes)\b.*$/i,
        ""
      )
  );
}

function choiceListContinuationLooksLikeAdjacentRequirement(line) {
  const normalizedLine = normalizeWhitespace(line);
  return /\b(?:taken\s+[A-Z]{3}|taken\s+in|qtr|senior year|junior year|capstone design course|professional practice)\b/i.test(
    normalizedLine
  );
}

function canContinueWrappedCourseNumber(previousText, line) {
  const previous = normalizeWhitespace(previousText);
  const current = normalizeWhitespace(line);
  if (!/^\d{3}(?:\.\d+)?[A-Z]?\b/.test(current)) {
    return false;
  }
  return /\b[A-Z]{2,8}(?:\s+[A-Z]{2,8})?$/.test(previous);
}

function looksLikeChoiceListContinuation(line, previousText) {
  const normalizedLine = trimChoiceListContinuationNoise(line);
  if (!normalizedLine || choiceListContinuationLooksLikeAdjacentRequirement(normalizedLine)) {
    return false;
  }

  const courseCodes = extractCourseCodesFromLine(normalizedLine);
  if (courseCodes.length >= 2 && /[,;]/.test(normalizedLine)) {
    return true;
  }
  if (/^(?:or|and)\s+[A-Z]{2,8}/i.test(normalizedLine)) {
    return true;
  }
  if (/^\(\s*\d+(?:\.\d+)?\s*cr\b/i.test(normalizedLine)) {
    return true;
  }
  if (/^[A-Z]{2,8}(?:\s+[A-Z]{2,8})?\s+\d{3}(?:\.\d+)?[A-Z]?\b/i.test(normalizedLine)) {
    return /[,;)]/.test(normalizedLine) || courseCodes.length > 0;
  }

  return canContinueWrappedCourseNumber(previousText, normalizedLine);
}

function choiceListLooksClosed(text) {
  const normalizedText = normalizeWhitespace(text);
  const openCount = (normalizedText.match(/\(/g) ?? []).length;
  const closeCount = (normalizedText.match(/\)/g) ?? []).length;
  return openCount > 0 && closeCount >= openCount;
}

function buildChoiceListSourceLine(requirementLabel, startLine, snapshotLines, startIndex) {
  const parts = [trimChoiceListContinuationNoise(stripChoiceListLine(startLine))].filter(Boolean);
  let sawClosingParenthesis = choiceListLooksClosed(parts.join(" "));

  for (
    let index = startIndex + 1;
    index < Math.min((snapshotLines ?? []).length, startIndex + 10) && !sawClosingParenthesis;
    index += 1
  ) {
    const continuation = trimChoiceListContinuationNoise(stripChoiceListLine(snapshotLines[index]));
    if (!looksLikeChoiceListContinuation(continuation, parts.join(" "))) {
      continue;
    }

    parts.push(continuation);
    sawClosingParenthesis = choiceListLooksClosed(parts.join(" "));
  }

  return normalizeWhitespace(`${requirementLabel}: ${parts.join(" ")}`);
}

function buildMultiLineChoiceRequirementLines(snapshotLines) {
  const choiceLines = [];

  for (let index = 0; index < (snapshotLines ?? []).length; index += 1) {
    const currentLine = normalizeWhitespace(snapshotLines[index]);
    const requirementLabel = findNearbyRequirementChoiceLabel(snapshotLines, index);
    if (!requirementLabel) {
      continue;
    }

    const currentWithoutPage = stripChoiceListLine(currentLine);
    const currentCourseCodes = extractCourseCodesFromLine(currentWithoutPage);
    const hasChoiceListStart = CHOICE_LIST_START_PATTERN.test(currentWithoutPage);
    const hasChoiceHeadingContext = hasStrongChoiceRequirementContext(requirementLabel);
    const startsHeadingBackedCommaList =
      hasChoiceHeadingContext &&
      currentCourseCodes.length >= 2 &&
      /[,;]/.test(currentWithoutPage) &&
      !choiceListContinuationLooksLikeAdjacentRequirement(currentWithoutPage);
    const startsExplicitParentheticalChoice =
      /^\(/.test(currentWithoutPage) && /\bor\b/i.test(currentWithoutPage);

    if (!hasChoiceListStart && !startsHeadingBackedCommaList && !startsExplicitParentheticalChoice) {
      continue;
    }

    choiceLines.push(
      buildChoiceListSourceLine(requirementLabel, currentLine, snapshotLines, index)
    );
  }

  return choiceLines;
}

function hasSequenceChoiceContext(value) {
  const text = normalizeWhitespace(value);
  return (
    SEQUENCE_CHOICE_CONTEXT_PATTERN.test(text) ||
    SEQUENCE_LABEL_ALTERNATIVE_PATTERN.test(text) ||
    (SEQUENCE_ALTERNATIVE_CHOICE_LINE_PATTERN.test(text) && /\bor\b/i.test(text))
  );
}

function getSequenceChoiceCue(value) {
  const text = normalizeWhitespace(value);
  const cuePatterns = [
    [/\bone\s+of\s+the\s+following(?:\s+\w+){0,4}\s+sequences?\b/i, "one of the following sequences"],
    [/\bchoose\s+one\s+sequence\b/i, "choose one sequence"],
    [/\bselect\s+one\s+sequence\b/i, "select one sequence"],
    [/\bone\s+sequence\b/i, "one sequence"],
    [/\beither\s+sequence\b/i, "either sequence"],
    [/\b(?:calculus-based|algebra-based)\b.{0,40}\bor\b.{0,40}\b(?:calculus-based|algebra-based)\b/i, "calculus-based vs algebra-based"],
    [/\b(?:regular|standard|accelerated|honors?)\b.{0,40}\bor\b.{0,40}\b(?:regular|standard|accelerated|honors?)\b/i, "standard vs honors"],
    [SEQUENCE_ALTERNATIVE_CHOICE_LINE_PATTERN, "or between grouped series"],
  ];
  return cuePatterns.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

function normalizeSequenceSourceLine(line) {
  return stripLeadingRequirementGlyphs(stripSnapshotPagePrefix(line));
}

function getSequenceFallbackSubjectFromContext(snapshotLines, index, currentLine = "") {
  const contextLines = [
    { rawLine: currentLine, isCurrent: true },
    ...(snapshotLines ?? [])
      .slice(Math.max(0, index - 6), index)
      .reverse()
      .map((rawLine) => ({ rawLine, isCurrent: false })),
  ];

  for (const { rawLine, isCurrent } of contextLines) {
    const line = normalizeWhitespace(rawLine);
    const parentheticalSubject = line.match(/\(([A-Z&]{2,8})\)\s*$/);
    if (parentheticalSubject) {
      const subject = normalizeExtractedCourseSubject(parentheticalSubject[1]);
      if (subject) {
        return subject;
      }
    }

    const headingSubject = line.match(
      /\b(?:physics|chemistry|mathematics|math|biology|biochemistry)\b.*\(([A-Z&]{2,8})\)/i
    );
    if (headingSubject) {
      const subject = normalizeExtractedCourseSubject(headingSubject[1]);
      if (subject) {
        return subject;
      }
    }

    if (!isCurrent) {
      if (/\bphysics\b/i.test(line)) {
        return "PHYS";
      }
      if (/\bchemistry\b/i.test(line)) {
        return "CHEM";
      }
      if (/\bmathematics\b|\bcalculus\b/i.test(line)) {
        return "MATH";
      }
      if (/\bbiology\b/i.test(line)) {
        return "BIOL";
      }
    }
  }

  return null;
}

function extractCourseCodesFromSequenceText(value, fallbackSubject = null) {
  let text = normalizeSequenceSourceLine(value)
    .replace(
      /\b(?:standard|regular|honors?|accelerated|calculus-based|algebra-based)\s+sequence\s+(?=[A-Z&]{2,8}\s+\d{3})/gi,
      ""
    );
  const sequenceChoicePrefix = text.match(/^\s*(?:choose|select)\s+one\s+sequence\s*:\s*/i);
  if (sequenceChoicePrefix) {
    text = text.slice(sequenceChoicePrefix[0].length);
  }
  const explicitCourseCodes = uniqueInOrder(extractCourseCodesFromLine(text));
  const normalizedFallbackSubject = normalizeExtractedCourseSubject(fallbackSubject ?? "");
  if (!normalizedFallbackSubject) {
    return explicitCourseCodes;
  }

  const hasDifferentExplicitSubject = explicitCourseCodes.some(
    (courseCode) => getCourseCodeSubject(courseCode) !== normalizedFallbackSubject
  );
  if (explicitCourseCodes.length && hasDifferentExplicitSubject) {
    return explicitCourseCodes;
  }

  const bareNumberCourseCodes = [];
  for (const match of text.matchAll(/(?:^|[^A-Za-z0-9])(\d{3}[A-Za-z]?)(?=$|[^A-Za-z0-9])/g)) {
    const courseCode = normalizeExtractedCourseCode(normalizedFallbackSubject, match[1]);
    if (courseCode) {
      bareNumberCourseCodes.push(courseCode);
    }
  }

  return uniqueInOrder([...explicitCourseCodes, ...bareNumberCourseCodes]);
}

function getSequencePathLabelFromText(text, courseCodes, fallbackLabel = "") {
  const normalizedText = normalizeWhitespace(text);
  const labelPatterns = [
    [/\bcalculus-based\b/i, "calculus-based"],
    [/\balgebra-based\b/i, "algebra-based"],
    [/\bhonors?\b/i, "honors"],
    [/\baccelerated\b/i, "accelerated"],
    [/\b(?:regular|standard)\b/i, "standard"],
    [/\bbiology\b/i, "biology sequence"],
    [/\bchemistry\b/i, "chemistry sequence"],
    [/\bphysics\b/i, "physics sequence"],
    [/\bmathematics|math\b/i, "math sequence"],
  ];
  const matchedLabel = labelPatterns.find(([pattern]) => pattern.test(normalizedText))?.[1];
  if (matchedLabel) {
    return matchedLabel;
  }

  const normalizedFallbackLabel = normalizeWhitespace(fallbackLabel);
  if (normalizedFallbackLabel) {
    return normalizedFallbackLabel;
  }

  return courseCodes?.length ? `${courseCodes[0]} sequence` : "sequence option";
}

function splitSequenceAlternativeLabels(value) {
  const labels = normalizeWhitespace(value)
    .split(/\bor\b/i)
    .map((label) =>
      normalizeWhitespace(
        label
          .replace(/^[^A-Za-z]*(?:[a-z]\)|\d+\))?\s*/i, "")
          .replace(/\b(?:sequence|series)\b/gi, "")
          .replace(/\s+\b(?:calculus|chemistry|physics|biology)\b$/i, "")
          .replace(/[^A-Za-z-]+$/g, "")
          .replace(/[:;,.-]+$/g, "")
      )
    )
    .filter(Boolean)
    .filter((label) =>
      /^(?:calculus-based|algebra-based|regular|standard|accelerated|honors?)$/i.test(label)
    );

  return uniqueInOrder(labels.map((label) => getSequencePathLabelFromText(label, [])));
}

function getExpectedSequenceSubjectsFromCue(value, fallbackSubject = null) {
  const text = normalizeWhitespace(value);
  const subjects = [];
  if (/\bphysics\b/i.test(text)) {
    subjects.push("PHYS");
  }
  if (/\bchemistry\b|\bchem\b/i.test(text)) {
    subjects.push("CHEM");
  }
  if (/\bmathematics\b|\bmath\b|\bcalculus\b|\bstatistics\b/i.test(text)) {
    subjects.push("MATH", "QSCI");
  }
  if (/\bbiology\b|\bbiol\b/i.test(text)) {
    subjects.push("BIOL");
  }
  if (fallbackSubject) {
    subjects.push(fallbackSubject);
  }
  return uniqueInOrder(subjects.map((subject) => normalizeExtractedCourseSubject(subject)).filter(Boolean));
}

function getCourseCodeSubjects(courseCodes) {
  return uniqueInOrder((courseCodes ?? []).map((courseCode) => getCourseCodeSubject(courseCode)).filter(Boolean));
}

function sequenceRowSubjectsFitCue(rowCourseCodes, expectedSubjects) {
  if (!(expectedSubjects ?? []).length) {
    return true;
  }
  const rowSubjects = getCourseCodeSubjects(rowCourseCodes);
  return rowSubjects.length > 0 && rowSubjects.some((subject) => expectedSubjects.includes(subject));
}

function sequenceRowLooksLikeSinglePath(rowLine, rowCourseCodes, expectedSubjects) {
  if (rowCourseCodes.length < 2) {
    return false;
  }
  const rowSubjects = getCourseCodeSubjects(rowCourseCodes);
  if (rowSubjects.length > 1 && !hasSequenceChoiceContext(rowLine)) {
    return false;
  }
  return sequenceRowSubjectsFitCue(rowCourseCodes, expectedSubjects);
}

function parseSequencePathSegmentsFromInlineText(text, fallbackSubject = null) {
  const normalizedText = normalizeWhitespace(
    text
      .replace(/\(\s*or\s+/gi, " or ")
      .replace(/\)/g, " ")
      .replace(/\s+-OR-\s+/gi, " or ")
      .replace(/\s+\+\s+/g, ", ")
  );
  const segments = normalizedText
    .split(/\s*;\s*or\s+|\s+or\s+/i)
    .map(normalizeWhitespace)
    .filter(Boolean);

  return segments
    .map((segment) => {
      const uwCourses = extractCourseCodesFromSequenceText(segment, fallbackSubject);
      return {
        label: getSequencePathLabelFromText(segment, uwCourses),
        uwCourses,
        sourceText: segment,
      };
    })
    .filter((path) => path.uwCourses.length >= 2);
}

function collectSequenceLabNotes(snapshotLines, startIndex, fallbackSubject) {
  const lines = (snapshotLines ?? [])
    .slice(startIndex, Math.min((snapshotLines ?? []).length, startIndex + 24))
    .map(normalizeWhitespace)
    .filter(Boolean);
  const labLines = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!/\blabs?|laboratory\b/i.test(line)) {
      continue;
    }
    labLines.push(line);

    for (
      let continuationIndex = index + 1;
      continuationIndex < Math.min(lines.length, index + 3);
      continuationIndex += 1
    ) {
      const continuationLine = lines[continuationIndex];
      const continuationLabCourses = extractCourseCodesFromSequenceText(
        continuationLine,
        fallbackSubject
      ).filter((courseCode) => /\b(?:117|118|119)\b/.test(courseCode));
      if (!continuationLabCourses.length) {
        break;
      }
      labLines.push(continuationLine);
    }
  }

  const labText = uniqueInOrder(labLines).join(" ");
  if (!labText) {
    return null;
  }

  const conditionalLabCourses = extractCourseCodesFromSequenceText(labText, fallbackSubject).filter(
    (courseCode) => /\b(?:117|118|119)\b/.test(courseCode)
  );
  return {
    text: normalizeWhitespace(labText),
    conditionalLabCourses,
    appliesToAlgebraPath: /\balgebra-based\b/i.test(lines.join(" ")),
  };
}

function applySequenceLabNotes(paths, labNotes) {
  if (!labNotes?.text) {
    return paths;
  }

  return paths.map((path) => {
    const appliesToPath =
      labNotes.appliesToAlgebraPath && /\balgebra-based\b/i.test(path.label);
    if (!appliesToPath) {
      return path;
    }

    return {
      ...path,
      conditionalLabCourses: uniqueInOrder([
        ...(path.conditionalLabCourses ?? []),
        ...(labNotes.conditionalLabCourses ?? []),
      ]),
      notes: uniqueSorted([
        ...(path.notes ?? []),
        `Conditional lab note: ${labNotes.text}`,
      ]),
    };
  });
}

function isSequenceChoiceBoundaryLine(line, pathsStarted) {
  const normalizedLine = normalizeSequenceSourceLine(line);
  if (!normalizedLine) {
    return pathsStarted;
  }
  if (/^OR$/i.test(normalizedLine)) {
    return false;
  }
  if (SEQUENCE_HEADING_BOUNDARY_PATTERN.test(normalizedLine) && !hasSequenceChoiceContext(normalizedLine)) {
    return true;
  }
  return false;
}

function buildColumnarSequenceChoiceCandidate(snapshotLines, index) {
  const cueLine = normalizeSequenceSourceLine(snapshotLines[index]);
  if (!SEQUENCE_LABEL_ALTERNATIVE_PATTERN.test(cueLine)) {
    return null;
  }

  const labels = splitSequenceAlternativeLabels(cueLine);
  if (labels.length < 2) {
    return null;
  }

  const fallbackSubject = getSequenceFallbackSubjectFromContext(snapshotLines, index, cueLine);
  const expectedSubjects = fallbackSubject
    ? [fallbackSubject]
    : getExpectedSequenceSubjectsFromCue(cueLine, fallbackSubject);
  const paths = labels.map((label) => ({
    label,
    uwCourses: [],
    sourceText: cueLine,
  }));
  const sourceLines = [cueLine];
  let alternatingSingleCourseCount = 0;

  const keepColumnarSequenceCourse = (courseCode, rowLine, sequenceLabels) => {
    if (!sequenceRowSubjectsFitCue([courseCode], expectedSubjects)) {
      return false;
    }
    const labelText = normalizeWhitespace((sequenceLabels ?? []).join(" "));
    const explicitLineCodes = extractCourseCodesFromLine(rowLine).map((code) =>
      normalizeCourseCode(code)
    );
    const inferredFromBareNumber = !explicitLineCodes.includes(normalizeCourseCode(courseCode));
    if (
      inferredFromBareNumber &&
      fallbackSubject === "PHYS" &&
      /\bcalculus-based\b/i.test(labelText) &&
      /\balgebra-based\b/i.test(labelText) &&
      (getCourseCodeNumericLevel(courseCode) ?? 0) >= 300
    ) {
      return false;
    }
    return true;
  };

  for (
    let rowIndex = index + 1;
    rowIndex < Math.min((snapshotLines ?? []).length, index + 12);
    rowIndex += 1
  ) {
    const rowLine = normalizeSequenceSourceLine(snapshotLines[rowIndex]);
    if (isSequenceChoiceBoundaryLine(rowLine, paths.some((path) => path.uwCourses.length))) {
      break;
    }

    const rowCourseCodes = extractCourseCodesFromSequenceText(rowLine, fallbackSubject).filter(
      (courseCode) => keepColumnarSequenceCourse(courseCode, rowLine, labels)
    );
    if (!rowCourseCodes.length) {
      continue;
    }
    if (rowCourseCodes.length > labels.length) {
      break;
    }
    if (rowCourseCodes.length === labels.length) {
      rowCourseCodes.forEach((courseCode, pathIndex) => {
        paths[pathIndex].uwCourses.push(courseCode);
        paths[pathIndex].sourceText = normalizeWhitespace(`${paths[pathIndex].sourceText} ${rowLine}`);
      });
      sourceLines.push(rowLine);
    } else if (
      rowCourseCodes.length > 1 &&
      rowCourseCodes.length < labels.length &&
      paths.some((path) => path.uwCourses.length > 0)
    ) {
      rowCourseCodes.forEach((courseCode, pathIndex) => {
        paths[pathIndex].uwCourses.push(courseCode);
        paths[pathIndex].sourceText = normalizeWhitespace(`${paths[pathIndex].sourceText} ${rowLine}`);
      });
      sourceLines.push(rowLine);
    } else if (labels.length === 2 && rowCourseCodes.length === 1) {
      const pathIndex = alternatingSingleCourseCount % labels.length;
      alternatingSingleCourseCount += 1;
      paths[pathIndex].uwCourses.push(rowCourseCodes[0]);
      paths[pathIndex].sourceText = normalizeWhitespace(`${paths[pathIndex].sourceText} ${rowLine}`);
      sourceLines.push(rowLine);
      if (paths.every((path) => path.uwCourses.length >= 3)) {
        break;
      }
    }
  }

  const populatedPaths = paths
    .map((path) => ({
      ...path,
      uwCourses: uniqueInOrder(path.uwCourses),
    }))
    .filter((path) => path.uwCourses.length >= 2);
  if (populatedPaths.length < 2) {
    return null;
  }

  return {
    rawText: normalizeWhitespace(sourceLines.join(" ")),
    sourceSection: findNearbyRequirementChoiceLabel(snapshotLines, index),
    detectedOptionCue: getSequenceChoiceCue(cueLine),
    paths: applySequenceLabNotes(
      populatedPaths,
      collectSequenceLabNotes(snapshotLines, index + 1, fallbackSubject)
    ),
  };
}

function getSimpleSequenceFallbackSubjectFromContext(snapshotLines, index) {
  for (let rowIndex = index; rowIndex >= Math.max(0, index - 8); rowIndex -= 1) {
    const line = normalizeWhitespace(snapshotLines[rowIndex]);
    const parentheticalSubject = line.match(/\(([A-Z&]{2,8})\)\s*$/);
    if (parentheticalSubject?.[1]) {
      return parentheticalSubject[1].toUpperCase();
    }
    if (rowIndex === index) {
      continue;
    }
    if (/\bphysics\b/i.test(line)) {
      return "PHYS";
    }
    if (/\bchemistry\b/i.test(line)) {
      return "CHEM";
    }
    if (/\bmathematics\b|\bcalculus\b/i.test(line)) {
      return "MATH";
    }
    if (/\bbiology\b/i.test(line)) {
      return "BIOL";
    }
  }
  return null;
}

function buildAlternatingNumberSequenceChoiceCandidate(snapshotLines, index) {
  const cueLine = normalizeSequenceSourceLine(snapshotLines[index]);
  if (!SEQUENCE_LABEL_ALTERNATIVE_PATTERN.test(cueLine)) {
    return null;
  }

  const labels = splitSequenceAlternativeLabels(cueLine);
  const fallbackSubject = getSimpleSequenceFallbackSubjectFromContext(snapshotLines, index);
  if (labels.length !== 2 || !fallbackSubject) {
    return null;
  }

  const paths = labels.map((label) => ({
    label,
    uwCourses: [],
    sourceText: cueLine,
  }));
  const sourceLines = [cueLine];
  let alternatingIndex = 0;

  for (
    let rowIndex = index + 1;
    rowIndex < Math.min((snapshotLines ?? []).length, index + 16);
    rowIndex += 1
  ) {
    const rowLine = normalizeSequenceSourceLine(snapshotLines[rowIndex]);
    if (isSequenceChoiceBoundaryLine(rowLine, paths.some((path) => path.uwCourses.length))) {
      break;
    }

    const rowCourseCodes = uniqueInOrder(
      [...rowLine.matchAll(/\b(\d{3}[A-Za-z]?)\b/g)]
        .map((match) => normalizeExtractedCourseCode(fallbackSubject, match[1]))
        .filter(Boolean)
        .filter((courseCode) => {
          const level = getCourseCodeNumericLevel(courseCode);
          return level !== null && level < 300;
        })
    );
    if (!rowCourseCodes.length) {
      continue;
    }
    if (rowCourseCodes.length === labels.length) {
      rowCourseCodes.forEach((courseCode, pathIndex) => {
        paths[pathIndex].uwCourses.push(courseCode);
        paths[pathIndex].sourceText = normalizeWhitespace(`${paths[pathIndex].sourceText} ${rowLine}`);
      });
      sourceLines.push(rowLine);
    } else if (rowCourseCodes.length === 1) {
      const pathIndex = alternatingIndex % labels.length;
      alternatingIndex += 1;
      paths[pathIndex].uwCourses.push(rowCourseCodes[0]);
      paths[pathIndex].sourceText = normalizeWhitespace(`${paths[pathIndex].sourceText} ${rowLine}`);
      sourceLines.push(rowLine);
    }

    if (paths.every((path) => path.uwCourses.length >= 3)) {
      break;
    }
  }

  const populatedPaths = paths
    .map((path) => ({
      ...path,
      uwCourses: uniqueInOrder(path.uwCourses),
    }))
    .filter((path) => path.uwCourses.length >= 2);
  if (populatedPaths.length < 2) {
    return null;
  }

  return {
    rawText: normalizeWhitespace(sourceLines.join(" ")),
    sourceSection: findNearbyRequirementChoiceLabel(snapshotLines, index),
    detectedOptionCue: getSequenceChoiceCue(cueLine),
    paths: applySequenceLabNotes(
      populatedPaths,
      collectSequenceLabNotes(snapshotLines, index + 1, fallbackSubject)
    ),
  };
}

function buildMultilineSequenceChoiceCandidate(snapshotLines, index) {
  const cueLine = normalizeSequenceSourceLine(snapshotLines[index]);
  if (!hasSequenceChoiceContext(cueLine)) {
    return null;
  }
  if (SEQUENCE_LABEL_ALTERNATIVE_PATTERN.test(cueLine)) {
    return null;
  }

  const fallbackSubject = getSequenceFallbackSubjectFromContext(snapshotLines, index, cueLine);
  const expectedSubjects = getExpectedSequenceSubjectsFromCue(cueLine, fallbackSubject);
  const inlinePaths = parseSequencePathSegmentsFromInlineText(cueLine, fallbackSubject);
  if (inlinePaths.length >= 2) {
    return {
      rawText: cueLine,
      sourceSection: findNearbyRequirementChoiceLabel(snapshotLines, index),
      detectedOptionCue: getSequenceChoiceCue(cueLine),
      paths: inlinePaths,
    };
  }

  const sourceLines = [cueLine];
  const paths = [];
  let currentPathLines = [];
  const flushCurrentPath = () => {
    if (!currentPathLines.length) {
      return;
    }
    const sourceText = normalizeWhitespace(currentPathLines.join(" "));
    const uwCourses = uniqueInOrder(
      currentPathLines.flatMap((line) => extractCourseCodesFromSequenceText(line, fallbackSubject))
    );
    if (uwCourses.length >= 2) {
      paths.push({
        label: getSequencePathLabelFromText(sourceText, uwCourses),
        uwCourses,
        sourceText,
      });
    }
    currentPathLines = [];
  };

  for (
    let rowIndex = index + 1;
    rowIndex < Math.min((snapshotLines ?? []).length, index + 16);
    rowIndex += 1
  ) {
    const rowLine = normalizeSequenceSourceLine(snapshotLines[rowIndex]);
    if (isSequenceChoiceBoundaryLine(rowLine, currentPathLines.length > 0 || paths.length > 0)) {
      break;
    }
    if (paths.length > 0 && hasSequenceChoiceContext(rowLine) && extractCourseCodesFromSequenceText(rowLine, fallbackSubject).length === 0) {
      break;
    }

    if (/^OR$/i.test(rowLine)) {
      flushCurrentPath();
      sourceLines.push(rowLine);
      continue;
    }

    const rowCourseCodes = extractCourseCodesFromSequenceText(rowLine, fallbackSubject);
    if (!rowCourseCodes.length) {
      if (currentPathLines.length && paths.length > 0) {
        break;
      }
      continue;
    }
    if (paths.length > 0 && !sequenceRowSubjectsFitCue(rowCourseCodes, expectedSubjects)) {
      break;
    }
    if (paths.length > 0 && getCourseCodeSubjects(rowCourseCodes).length > 1 && !hasSequenceChoiceContext(rowLine)) {
      break;
    }

    sourceLines.push(rowLine);
    if (sequenceRowLooksLikeSinglePath(rowLine, rowCourseCodes, expectedSubjects) && !currentPathLines.length) {
      paths.push({
        label: getSequencePathLabelFromText(rowLine, rowCourseCodes),
        uwCourses: rowCourseCodes,
        sourceText: rowLine,
      });
      continue;
    }

    currentPathLines.push(rowLine);
  }
  flushCurrentPath();

  if (paths.length < 2) {
    return null;
  }

  return {
    rawText: normalizeWhitespace(sourceLines.join(" ")),
    sourceSection: findNearbyRequirementChoiceLabel(snapshotLines, index),
    detectedOptionCue: getSequenceChoiceCue(cueLine),
    paths: applySequenceLabNotes(
      uniqueBy(paths, (path) => path.uwCourses.join("|")),
      collectSequenceLabNotes(snapshotLines, index + 1, fallbackSubject)
    ),
  };
}

function buildParentheticalSequenceChoiceCandidates(snapshotLines, index) {
  const cueLine = normalizeSequenceSourceLine(snapshotLines[index]);
  if (!/\(\s*or\s+/i.test(cueLine)) {
    return [];
  }

  const candidates = [];
  const sequencePattern =
    /((?:[A-Z&]+(?:\s+[A-Z&]+)?\s+)?\d{3}[A-Za-z]?(?:\s*,\s*(?:[A-Z&]+(?:\s+[A-Z&]+)?\s+)?\d{3}[A-Za-z]?){1,5})\s*\(\s*or\s+([^)]+)\)/gi;
  for (const match of cueLine.matchAll(sequencePattern)) {
    const leftText = normalizeWhitespace(match[1]);
    const rightText = normalizeWhitespace(match[2]);
    const leftCourses = extractCourseCodesFromSequenceText(leftText);
    const fallbackSubject = getCourseCodeSubject(leftCourses[0] ?? "");
    const rightCourses = extractCourseCodesFromSequenceText(rightText, fallbackSubject);
    if (leftCourses.length < 2 || rightCourses.length < 2) {
      continue;
    }
    if (getCourseCodeSubject(leftCourses[0]) !== getCourseCodeSubject(rightCourses[0])) {
      continue;
    }

    const rawText = normalizeWhitespace(`${leftText} or ${rightText}`);
    candidates.push({
      rawText,
      sourceSection: cueLine,
      detectedOptionCue: "parenthetical sequence alternative",
      paths: [
        {
          label: getSequencePathLabelFromText(leftText, leftCourses),
          uwCourses: leftCourses,
          sourceText: leftText,
        },
        {
          label: getSequencePathLabelFromText(rightText, rightCourses),
          uwCourses: rightCourses,
          sourceText: rightText,
        },
      ],
    });
  }

  return candidates;
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
  const rawCategoryOption = input.categoryOption ?? null;
  const categoryOption = rawCategoryOption
    ? {
        category: normalizeWhitespace(rawCategoryOption.category ?? "") || null,
        sourceCategoryCode: normalizeWhitespace(rawCategoryOption.sourceCategoryCode ?? "") || null,
        title: normalizeWhitespace(rawCategoryOption.title ?? "") || null,
        credits: rawCategoryOption.credits ?? null,
        creditMin: rawCategoryOption.creditMin ?? rawCategoryOption.credits ?? null,
        creditMax: rawCategoryOption.creditMax ?? rawCategoryOption.credits ?? null,
        sourceText: normalizeWhitespace(rawCategoryOption.sourceText ?? "") || null,
        approvedListKey: normalizeWhitespace(rawCategoryOption.approvedListKey ?? "") || null,
        programSpecific:
          typeof rawCategoryOption.programSpecific === "boolean"
            ? rawCategoryOption.programSpecific
            : null,
      }
    : null;
  const hasCategoryOption =
    input.optionKind === "category-option" &&
    !!categoryOption?.category &&
    !!categoryOption?.sourceCategoryCode &&
    !!categoryOption?.title &&
    Number.isFinite(categoryOption.credits) &&
    categoryOption.credits > 0;

  return {
    id: input.id,
    optionKind: hasCategoryOption ? "category-option" : "course",
    sequencePathId: normalizeWhitespace(input.sequencePathId ?? "") || null,
    pathLabel: normalizeWhitespace(input.pathLabel ?? "") || null,
    displayCourseCodes: hasCategoryOption ? [] : displayCourseCodes,
    uwCourses: hasCategoryOption ? [] : uwCourses,
    equivalentUwCourseCodes: hasCategoryOption ? [] : equivalentUwCourseCodes,
    conditionalLabCourses: uniqueInOrder(
      (input.conditionalLabCourses ?? [])
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean)
    ),
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
    grcMatches: hasCategoryOption
      ? []
      : uniqueSorted(
          (input.grcMatches ?? []).map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
        ),
    compoundComponents: (input.compoundComponents ?? [])
      .map((component) =>
        uniqueInOrder(
          (component ?? [])
            .map((courseCode) => normalizeCourseCode(courseCode))
            .filter(Boolean)
        )
      )
      .filter((component) => component.length > 0),
    categoryOption: hasCategoryOption
      ? {
          category: categoryOption.category,
          sourceCategoryCode: categoryOption.sourceCategoryCode,
          title: categoryOption.title,
          credits: categoryOption.credits,
          creditMin: categoryOption.creditMin ?? categoryOption.credits,
          creditMax: categoryOption.creditMax ?? categoryOption.credits,
          sourceText: categoryOption.sourceText,
          approvedListKey: categoryOption.approvedListKey ?? null,
          programSpecific: categoryOption.programSpecific ?? false,
        }
      : null,
    constraints: uniqueSorted((input.constraints ?? []).map(normalizeWhitespace).filter(Boolean)),
    notes: uniqueSorted((input.notes ?? []).map(normalizeWhitespace).filter(Boolean)),
    label: label || categoryOption?.title || "",
  };
}

function buildParsedRequirementGroup(input) {
  const label = normalizeWhitespace(input.label);
  const category = normalizeWhitespace(input.category);
  const sourceHeading = normalizeWhitespace(input.sourceHeading ?? "") || label;
  const isCreditBucket = input.requirementType === "choose_credits";
  const minCourses = isCreditBucket ? null : input.minCourses ?? null;
  const maxCourses = isCreditBucket ? null : input.maxCourses ?? null;
  const requiredCount =
    isCreditBucket
      ? null
      : input.requiredCount ??
        (minCourses !== null && minCourses === maxCourses ? minCourses : null);
  const minCredits = input.minCredits ?? null;
  const hasMaxCredits = Object.prototype.hasOwnProperty.call(input, "maxCredits");
  const maxCredits = hasMaxCredits ? input.maxCredits ?? null : minCredits ?? null;
  const creditText =
    normalizeWhitespace(input.creditText ?? "") ||
    (isCreditBucket && minCredits != null && maxCredits != null && minCredits !== maxCredits
      ? `${minCredits}-${maxCredits}`
      : minCredits != null
        ? String(minCredits)
        : null);
  const isSequenceChoice = input.requirementType === "sequence_choice";
  const seenSequencePathIds = new Set();
  const sequencePaths = (input.sequencePaths ?? [])
    .map((path, index) => {
      const uwCourses = uniqueInOrder(
        (path.uwCourses ?? [])
          .map((courseCode) => normalizeCourseCode(courseCode))
          .filter(Boolean)
      );
      const conditionalLabCourses = uniqueInOrder(
        (path.conditionalLabCourses ?? [])
          .map((courseCode) => normalizeCourseCode(courseCode))
          .filter(Boolean)
      );
      const baseId =
        normalizeWhitespace(path.id ?? "") ||
        `${input.id}:sequence-path:${slugify(uwCourses.join("-"))}`;
      let id = baseId;
      if (seenSequencePathIds.has(id)) {
        id = `${baseId}-${slugify(uwCourses.join("-")) || index + 1}`;
      }
      let suffix = 2;
      while (seenSequencePathIds.has(id)) {
        id = `${baseId}-${slugify(uwCourses.join("-")) || index + 1}-${suffix}`;
        suffix += 1;
      }
      seenSequencePathIds.add(id);
      return {
        id,
        label: normalizeWhitespace(path.label ?? "") || uwCourses.join(" + "),
        uwCourses,
        displayCourseCodes: uniqueInOrder(
          (path.displayCourseCodes ?? path.uwCourses ?? [])
            .map((courseCode) => normalizeWhitespace(courseCode))
            .filter(Boolean)
        ),
        mappedGrcCourseCodes: uniqueInOrder(
          (path.mappedGrcCourseCodes ?? [])
            .map((courseCode) => normalizeCourseCode(courseCode))
            .filter(Boolean)
        ),
        compoundComponents: (path.compoundComponents ?? [])
          .map((component) =>
            uniqueInOrder(
              (component ?? [])
                .map((courseCode) => normalizeCourseCode(courseCode))
                .filter(Boolean)
            )
          )
          .filter((component) => component.length > 0),
        conditionalLabCourses,
        notes: uniqueSorted((path.notes ?? []).map(normalizeWhitespace).filter(Boolean)),
        sourceText: normalizeWhitespace(path.sourceText ?? "") || sourceHeading,
      };
    })
    .filter((path) => path.uwCourses.length > 0);
  return {
    id: input.id,
    label,
    category,
    subcategory: normalizeWhitespace(input.subcategory ?? "") || null,
    requirementType: input.requirementType,
    requirementShape:
      input.requirementShape ??
      (isCreditBucket ? "credit-bucket" : isSequenceChoice ? "sequence-choice" : null),
    minCourses: isSequenceChoice ? 1 : minCourses,
    maxCourses: isSequenceChoice ? 1 : maxCourses,
    selectionCount: isCreditBucket ? null : isSequenceChoice ? 1 : input.selectionCount ?? requiredCount,
    requiredCount: isSequenceChoice ? 1 : requiredCount,
    minCredits,
    maxCredits,
    creditText,
    satisfactionMode:
      input.satisfactionMode ?? (isCreditBucket ? "credit-based" : "selection-count"),
    sourceHeading,
    sourceRowText: normalizeWhitespace(input.sourceRowText ?? "") || sourceHeading,
    sourceSection: normalizeWhitespace(input.sourceSection ?? "") || null,
    sourceSectionRole: normalizeWhitespace(input.sourceSectionRole ?? "") || null,
    sourceSectionSchedulable:
      typeof input.sourceSectionSchedulable === "boolean" ? input.sourceSectionSchedulable : null,
    detectedOptionCue: normalizeWhitespace(input.detectedOptionCue ?? "") || detectOptionCue(sourceHeading),
    sourceRole: normalizeWhitespace(input.sourceRole ?? "") || null,
    sourceUrl: normalizeWhitespace(input.sourceUrl ?? "") || null,
    sourceScope: normalizeWhitespace(input.sourceScope ?? "") || null,
    pathwayId: normalizeWhitespace(input.pathwayId ?? "") || null,
    routeId: normalizeWhitespace(input.routeId ?? "") || null,
    canCreateScheduleRow:
      typeof input.canCreateScheduleRow === "boolean" ? input.canCreateScheduleRow : null,
    supportOnly: typeof input.supportOnly === "boolean" ? input.supportOnly : null,
    approvedListKey: normalizeWhitespace(input.approvedListKey ?? "") || null,
    canCreatePlaceholder:
      typeof input.canCreatePlaceholder === "boolean" ? input.canCreatePlaceholder : null,
    programSpecific: typeof input.programSpecific === "boolean" ? input.programSpecific : null,
    notes: uniqueSorted((input.notes ?? []).map(normalizeWhitespace).filter(Boolean)),
    sequencePaths,
    options: (input.options ?? [])
      .map((option) =>
        buildParsedRequirementOption({
          sourceHeading,
          sourceCategory: category,
          ...option,
        })
      )
      .filter(
        (option) =>
          option.uwCourses.length > 0 ||
          option.equivalentUwCourseCodes.length > 0 ||
          option.optionKind === "category-option"
      ),
  };
}

function extractParsedRequirementGroupCourseCodes(groups) {
  return uniqueSorted(
    (groups ?? []).flatMap((group) =>
      [
        ...(group.sequencePaths ?? []).flatMap((path) => [
          ...(path.uwCourses ?? []),
          ...(path.conditionalLabCourses ?? []),
        ]),
        ...(group.options ?? []).flatMap((option) => [
          ...(option.uwCourses ?? []),
          ...(option.equivalentUwCourseCodes ?? []),
          ...(option.conditionalLabCourses ?? []),
        ]),
      ]
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

function isSectionedOptionCourseBoundary(line) {
  const normalizedLine = normalizeWhitespace(line);
  if (!normalizedLine) {
    return false;
  }

  return (
    /^\[Supplemental official source\]/i.test(normalizedLine) ||
    /^(?:B\.S\. degree requirements|Undergraduate advising|(?:[A-Z& ]+\s+)?Capstone|Tuition and scholarships|Contact\b|Log in|Privacy|Terms)$/i.test(
      normalizedLine
    ) ||
    /\b(?:admission|requirements?)\b/i.test(normalizedLine) &&
      !/\b(?:core|electives?)\b/i.test(normalizedLine) &&
      !extractCourseCodesFromLine(normalizedLine).length
  );
}

function parseSectionHeadingCreditRange(line) {
  const creditRange = parseRequirementCreditRange(line);
  if (creditRange) {
    return creditRange;
  }
  const creditAmount = parseRequirementCreditAmount(line);
  return Number.isFinite(creditAmount)
    ? { minCredits: creditAmount, maxCredits: creditAmount }
    : null;
}

function getNearbySectionCourseTitle(snapshotLines, courseLineIndex) {
  for (
    let index = courseLineIndex + 1;
    index < Math.min((snapshotLines ?? []).length, courseLineIndex + 4);
    index += 1
  ) {
    const candidate = normalizeWhitespace(stripChoiceListLine(snapshotLines[index]));
    if (!candidate || /^\d+(?:\s*(?:-|to)\s*\d+)?$/.test(candidate)) {
      continue;
    }
    if (isCourseContinuationLine(candidate)) {
      continue;
    }
    if (
      sourceLineStartsWithCourseCode(candidate) ||
      isSectionedOptionCourseBoundary(candidate) ||
      looksLikeSectionedCourseHeadingLine(candidate)
    ) {
      return null;
    }
    return candidate;
  }

  return null;
}

function parseSectionCourseLineCreditRange(courseLine) {
  const normalizedLine = normalizeWhitespace(stripChoiceListLine(courseLine));
  const parentheticalCreditMatch = normalizedLine.match(
    /\(\s*(\d+(?:\.\d+)?)(?:\s*(credits?|cr\.?))?(?:\s*,\s*(?:A\s*&\s*H|S\s*Sc|N\s*Sc|DIV|W|C|RSN|QSR|VLPA|I\s*&\s*S|NW))*\s*\)(?!.*\))/i
  );
  if (!parentheticalCreditMatch) {
    return null;
  }

  const credits = Number.parseFloat(parentheticalCreditMatch[1] ?? "");
  if (!Number.isFinite(credits) || credits <= 0) {
    return null;
  }
  const hasExplicitCreditUnit = Boolean(parentheticalCreditMatch[2]);
  if (!hasExplicitCreditUnit && credits > 30) {
    return null;
  }

  return {
    credits,
    creditMin: credits,
    creditMax: credits,
    creditText: String(credits),
  };
}

function getNearbySectionCourseCredits(snapshotLines, courseLineIndex, courseCode) {
  const inlineCourseLineCredits = parseSectionCourseLineCreditRange(snapshotLines?.[courseLineIndex]);
  if (inlineCourseLineCredits) {
    return inlineCourseLineCredits;
  }

  for (
    let index = courseLineIndex + 1;
    index < Math.min((snapshotLines ?? []).length, courseLineIndex + 5);
    index += 1
  ) {
    const candidate = normalizeWhitespace(stripChoiceListLine(snapshotLines[index]));
    if (!candidate) {
      continue;
    }
    if (isCourseContinuationLine(candidate)) {
      continue;
    }
    if (/^\d+(?:\s*(?:-|to)\s*\d+)?$/.test(candidate)) {
      const range = parseRequirementCreditRange(`${candidate} credits`);
      if (range) {
        const creditText =
          range.maxCredits && range.maxCredits !== range.minCredits
            ? `${range.minCredits}-${range.maxCredits}`
            : String(range.minCredits);
        return {
          credits: range.minCredits,
          creditMin: range.minCredits,
          creditMax: range.maxCredits ?? range.minCredits,
          creditText,
        };
      }
    }
    if (looksLikeSectionedCourseHeadingLine(candidate)) {
      break;
    }

    const inlineRange =
      /\bcredits?\b/i.test(candidate) &&
      !/\bmaximum\s+of\b|\bmax(?:imum)?\b.{0,30}\b(?:allowed|towards?\s+degree|toward\s+degree|count)\b/i.test(candidate)
      ? parseRequirementCreditRange(candidate)
      : null;
    if (inlineRange) {
      const creditText =
        inlineRange.maxCredits && inlineRange.maxCredits !== inlineRange.minCredits
          ? `${inlineRange.minCredits}-${inlineRange.maxCredits}`
          : String(inlineRange.minCredits);
      return {
        credits: inlineRange.minCredits,
        creditMin: inlineRange.minCredits,
        creditMax: inlineRange.maxCredits ?? inlineRange.minCredits,
        creditText,
      };
    }
    if (sourceLineStartsWithCourseCode(candidate) || isSectionedOptionCourseBoundary(candidate)) {
      break;
    }
  }

  return getUwCourseCreditRange(courseCode);
}

function buildSectionedOptionCourseOption(owner, input) {
  const courseCodes = extractOptionCourseCodesFromSectionedLine(input.courseLine);
  if (!courseCodes.length) {
    return null;
  }

  const primaryCourseCode = courseCodes[0];
  const metadata = getUwCourseMetadata(primaryCourseCode);
  const title = normalizeWhitespace(input.title ?? "") || metadata?.title || null;
  const creditRange = input.creditRange ?? getUwCourseCreditRange(primaryCourseCode);
  const sectionSlug = slugify(input.sectionHeading);
  const optionSlug = slugify(`${sectionSlug}-${courseCodes.join("-")}`);
  return {
    id: `${owner.ownerId}:requirement-option:${optionSlug}`,
    displayCourseCodes: [normalizeWhitespace(input.courseLine.replace(/\*+$/g, ""))],
    uwCourses: [primaryCourseCode],
    equivalentUwCourseCodes: courseCodes.slice(1),
    ...creditRange,
    title,
    department: getCourseCodeSubject(primaryCourseCode),
    category: input.category,
    label: normalizeWhitespace(input.courseLine.replace(/\*+$/g, "")) || primaryCourseCode,
    sourceHeading: input.sourceHeading,
    sourceCategory: input.sectionHeading,
    notes: input.notes ?? [],
    constraints: input.constraints ?? [],
  };
}

function extractOptionCourseCodesFromSectionedLine(line) {
  const normalizedLine = normalizeWhitespace(line);
  if (!normalizedLine) {
    return [];
  }

  const withoutPrerequisiteParentheticals = normalizeWhitespace(
    normalizedLine.replace(/\([^)]*\bprereq(?:uisites?)?\b[^)]*\)/gi, "")
  );
  const leadingCourseText =
    withoutPrerequisiteParentheticals.match(/^(.+?)(?::|\s+\()/)?.[1] ??
    withoutPrerequisiteParentheticals;
  const leadingCourseCodes = extractCourseCodesFromJointCourseLine(leadingCourseText);
  if (leadingCourseCodes.length) {
    return leadingCourseCodes;
  }

  return extractCourseCodesFromJointCourseLine(withoutPrerequisiteParentheticals);
}

function shouldSplitSectionedCourseLineIntoSeparateOptions(line, courseCodes) {
  if ((courseCodes ?? []).length < 2 || /\//.test(line)) {
    return false;
  }
  const subjects = new Set(courseCodes.map((courseCode) => getCourseCodeSubject(courseCode)));
  return subjects.size === 1 && /,\s*\d{3}[A-Za-z]?\b/.test(line);
}

function collectSectionedOptionCourseOptions(owner, snapshotLines, startIndex, endIndex, input) {
  const options = [];
  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const line = normalizeWhitespace(stripChoiceListLine(snapshotLines[index]));
    if (!line) {
      continue;
    }
    if (!sourceLineStartsWithCourseCode(line)) {
      if (isCourseContinuationLine(line) && options.length) {
        const continuationCodes = extractCourseCodesFromLine(line);
        const previousOption = options[options.length - 1];
        previousOption.equivalentUwCourseCodes = uniqueInOrder([
          ...(previousOption.equivalentUwCourseCodes ?? []),
          ...continuationCodes.filter(
            (courseCode) => !(previousOption.uwCourses ?? []).includes(courseCode)
          ),
        ]);
        previousOption.displayCourseCodes = uniqueInOrder([
          ...(previousOption.displayCourseCodes ?? []),
          normalizeWhitespace(line),
        ]);
        previousOption.label = normalizeWhitespace(
          `${previousOption.label ?? previousOption.uwCourses?.[0] ?? ""} ${line}`
        );
      }
      continue;
    }
    if (/^\*/.test(line) && /\b(?:must|prereq|note|only)\b/i.test(line)) {
      continue;
    }
    const courseCodes = extractOptionCourseCodesFromSectionedLine(line);
    if (!courseCodes.length) {
      continue;
    }

    const title = getNearbySectionCourseTitle(snapshotLines, index);
    const creditRange = getNearbySectionCourseCredits(snapshotLines, index, courseCodes[0]);
    const notes = [];
    const constraints = [];
    const maxDegreeCountingCreditMatch = (title ?? "").match(
      /\bmaximum\s+of\s+(\d+)\s+(?:credits?|cr\.?)\b.{0,50}\b(?:allowed|towards?\s+degree|toward\s+degree|count)\b/i
    );
    if (maxDegreeCountingCreditMatch) {
      const maxCredits = Number.parseFloat(maxDegreeCountingCreditMatch[1] ?? "");
      if (Number.isFinite(maxCredits)) {
        constraints.push(`max_degree_counting_credits:${maxCredits}`);
        notes.push(`${courseCodes[0]} can count a maximum of ${maxCredits} credits toward the degree.`);
      }
    }
    if (/\bprereq/i.test(title ?? "")) {
      notes.push(title);
    }
    if (/\bmust be taken\b/i.test(snapshotLines[index + 2] ?? "")) {
      notes.push(normalizeWhitespace(snapshotLines[index + 2]));
    }

    const optionCourseLines = shouldSplitSectionedCourseLineIntoSeparateOptions(line, courseCodes)
      ? courseCodes
      : [line];
    for (const optionCourseLine of optionCourseLines) {
      const option = buildSectionedOptionCourseOption(owner, {
        courseLine: optionCourseLine,
        title,
        creditRange,
        category: input.category,
        sectionHeading: input.sectionHeading,
        sourceHeading: input.sourceHeading,
        notes,
        constraints,
      });
      if (option) {
        options.push(option);
      }
    }
  }
  return options;
}

function buildSectionedOptionRequirementGroups(owner, snapshotLines) {
  const replacement = parserRules.detectOptionReplacement({
    owner,
    snapshotLines,
    sourceUrl: owner.sourceUrl ?? owner.primarySourceUrl ?? null,
  });
  if (!replacement) {
    return [];
  }

  const optionPattern = new RegExp(`\\b${replacement.optionAcronym}\\b`, "i");
  const coreHeadingIndex = (snapshotLines ?? []).findIndex((line) => {
    const normalizedLine = normalizeWhitespace(stripChoiceListLine(line));
    return optionPattern.test(normalizedLine) && /\bcore\b/i.test(normalizedLine) && /\bcredits?\b/i.test(normalizedLine);
  });
  const electiveHeadingIndex = (snapshotLines ?? []).findIndex((line, index) => {
    if (index <= coreHeadingIndex) {
      return false;
    }
    const normalizedLine = normalizeWhitespace(stripChoiceListLine(line));
    return optionPattern.test(normalizedLine) && /\belectives?\b/i.test(normalizedLine) && /\bcredits?\b/i.test(normalizedLine);
  });
  if (coreHeadingIndex < 0 || electiveHeadingIndex < 0) {
    return [];
  }

  let optionSectionEndIndex = (snapshotLines ?? []).length;
  for (let index = electiveHeadingIndex + 1; index < (snapshotLines ?? []).length; index += 1) {
    if (isSectionedOptionCourseBoundary(snapshotLines[index])) {
      optionSectionEndIndex = index;
      break;
    }
  }

  const sourceHeading = `${replacement.optionAcronym} Option Core/Elective Requirement: ${replacement.replacementCredits} credits`;
  const coreHeading = normalizeWhitespace(stripChoiceListLine(snapshotLines[coreHeadingIndex]));
  const electiveHeading = normalizeWhitespace(stripChoiceListLine(snapshotLines[electiveHeadingIndex]));
  const coreCredits = parseSectionHeadingCreditRange(coreHeading);
  const electiveCredits = parseSectionHeadingCreditRange(electiveHeading);
  const options = [
    ...collectSectionedOptionCourseOptions(owner, snapshotLines, coreHeadingIndex, electiveHeadingIndex, {
      category: `${replacement.optionAcronym.toLowerCase()}_core_required`,
      sectionHeading: coreHeading,
      sourceHeading,
      creditRange: coreCredits,
    }),
    ...collectSectionedOptionCourseOptions(owner, snapshotLines, electiveHeadingIndex, optionSectionEndIndex, {
      category: `${replacement.optionAcronym.toLowerCase()}_elective_option`,
      sectionHeading: electiveHeading,
      sourceHeading,
      creditRange: electiveCredits,
    }),
  ];

  const group = buildParsedRequirementGroup({
    id: replacement.replacedByRequirementId,
    label: sourceHeading,
    category: `${replacement.optionAcronym.toLowerCase()}_core_elective`,
    subcategory: `${replacement.optionAcronym.toLowerCase()}_core_elective_${replacement.replacementCredits}_credits`,
    requirementType: "choose_credits",
    minCredits: replacement.replacementCredits,
    sourceHeading,
    sourceRowText: replacement.rule?.evidence?.join(" ") || sourceHeading,
    detectedOptionCue: "option replacement",
    notes: uniqueSorted([
      replacement.replacementReason,
      "Replacement and option-course choices parsed from source headings and course rows.",
      ...(replacement.rule?.evidence ?? []),
    ]),
    options,
  });

  return group.options.length ? [group] : [];
}

function buildParserRuleRequirementReplacements(owner, snapshotLines) {
  const replacement = parserRules.detectOptionReplacement({
    owner,
    snapshotLines,
    sourceUrl: owner.sourceUrl ?? owner.primarySourceUrl ?? null,
  });
  if (!replacement) {
    return [];
  }

  return [
    {
      baseRequirementId: replacement.baseRequirementId,
      replacedByRequirementId: replacement.replacedByRequirementId,
      appliesWhen: replacement.appliesWhen,
      replacementReason: replacement.replacementReason,
      sourceUrl: replacement.sourceUrl,
      sourceHeading: replacement.sourceHeading,
    },
  ];
}

function isGraduateOrAppliedMastersRequirementContext(owner, snapshotLines = [], index = 0) {
  const sourceContext = [
    owner?.sourceUrl,
    owner?.primarySourceUrl,
    owner?.sourceLabel,
    owner?.primarySourceLabel,
  ].filter(Boolean).join(" ");
  if (
    GRADUATE_SUPPLEMENTAL_SOURCE_PATTERN.test(sourceContext) &&
    !/\bundergrad(?:uate)?\b/i.test(sourceContext)
  ) {
    return true;
  }

  const localLines = (snapshotLines ?? [])
    .slice(Math.max(0, index - 24), Math.min((snapshotLines ?? []).length, index + 8))
    .map((line) => normalizeWhitespace(stripChoiceListLine(line)))
    .filter(Boolean);
  for (let lineIndex = localLines.length - 1; lineIndex >= 0; lineIndex -= 1) {
    const line = localLines[lineIndex];
    if (/^\[Supplemental official source\]/i.test(line) || /^Title:/i.test(line)) {
      return (
        GRADUATE_SUPPLEMENTAL_SOURCE_PATTERN.test(line) &&
        !/\bundergrad(?:uate)?|bachelor|b\.?\s*s\.?\b/i.test(line)
      );
    }
  }

  const localText = localLines.join(" ");
  return (
    /\b(?:graduate credits?|graduate degree|master(?:'s|s)? program|m\.?\s*s\.?|ph\.?\s*d\.?|thesis\/non-thesis)\b/i.test(
      localText
    ) && !/\bundergrad(?:uate)?|bachelor|b\.?\s*s\.?\b/i.test(localText)
  );
}

function parseSectionedCourseRequiredCount(line) {
  const normalizedLine = normalizeWhitespace(line).toLowerCase();
  const leadingWordMatch = normalizedLine.match(
    /^(one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*\(\s*(\d+)\s*\))?\s+.+?\b(?:courses?|electives?)\b/
  );
  if (leadingWordMatch) {
    const parentheticalCount = Number.parseInt(leadingWordMatch[2] ?? "", 10);
    if (Number.isFinite(parentheticalCount) && parentheticalCount > 0) {
      return parentheticalCount;
    }
    return WORD_NUMBER_MAP.get(leadingWordMatch[1]) ?? 1;
  }

  const leadingNumberMatch = normalizedLine.match(/^(\d+)\s+.+?\belectives?\b/);
  if (leadingNumberMatch && !/\bcredits?\b/i.test(normalizedLine)) {
    const count = Number.parseInt(leadingNumberMatch[1], 10);
    return Number.isFinite(count) && count > 0 ? count : null;
  }

  return null;
}

function normalizeSectionedCourseGroupLabel(line) {
  const cleaned = normalizeWhitespace(stripChoiceListLine(line))
    .replace(/[:.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "Sectioned course group";
  }
  return cleaned;
}

function lineHasGenericCategoryDistributionCue(line) {
  const normalizedLine = normalizeWhitespace(line);
  return CATEGORY_OPTION_DEFINITIONS.some((definition) => definition.pattern.test(normalizedLine));
}

function isGenericUniversityCategoryDistributionHeading(line) {
  const normalizedLine = normalizeWhitespace(stripChoiceListLine(line));
  if (!normalizedLine || sourceLineStartsWithCourseCode(normalizedLine)) {
    return false;
  }
  if (!lineHasGenericCategoryDistributionCue(normalizedLine)) {
    return false;
  }
  return (
    /\b(?:chosen|selected|taken)\s+from\b.{0,80}\b(?:university|uw)\b.{0,40}\blist\b/i.test(
      normalizedLine
    ) &&
    !/\b(?:following|below|listed)\b/i.test(normalizedLine)
  );
}

function getTrimmedSectionedCourseGroupHeading(line, descriptor = null) {
  const normalizedLine = normalizeSectionedCourseGroupLabel(line);
  if (!normalizedLine || !lineHasGenericCategoryDistributionCue(normalizedLine)) {
    return normalizedLine;
  }

  const semicolonParts = normalizedLine
    .split(/\s*;\s*/g)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
  const matchingPart = semicolonParts.find((part) => {
    if (lineHasGenericCategoryDistributionCue(part)) {
      return false;
    }
    if (!/\b(?:electives?|approved|selected|following|from)\b/i.test(part)) {
      return false;
    }
    const range = parseSectionHeadingCreditRange(part);
    if (!range || descriptor?.minCredits == null) {
      return true;
    }
    return range.minCredits === descriptor.minCredits;
  });
  if (matchingPart) {
    return matchingPart;
  }

  const categoryClauseIndex = normalizedLine.search(
    /\s*(?:;|,)?\s*(?:the\s+final\s+math\s+course,\s*)?(?:VLPA|I\s*&\s*S|A\s*&\s*H|S\s*Sc|N\s*Sc|Arts?\s+(?:and|&)\s+Humanities|Social Sciences?|Natural Sciences?|Natural World|Diversity)\b/i
  );
  if (categoryClauseIndex > 0) {
    const prefix = normalizeWhitespace(normalizedLine.slice(0, categoryClauseIndex).replace(/[;,]+$/g, ""));
    if (prefix && /\b(?:electives?|approved|selected|following|from)\b/i.test(prefix)) {
      return prefix;
    }
  }

  return normalizedLine;
}

function buildSectionedCourseCategory(line) {
  const cleaned = normalizeWhitespace(line)
    .replace(/\b(?:a\s+)?(?:minimum|maximum)\s+of\s+\d+(?:\.\d+)?\s+credits?\b/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s+credits?(?:\s+total|\s+required)?\b/gi, "")
    .replace(/\b(?:selected from the following list|courses? listed below|listed below are required|the following departments|will satisfy|requirement|requirements|required)\b/gi, "")
    .replace(/[:.]+$/g, "")
    .trim();
  return slugify(cleaned || line).replace(/-/g, "_") || "sectioned_course_group";
}

function hasUpcomingSectionedCourseRows(snapshotLines, startIndex, minimumCount = 2) {
  let courseRowCount = 0;
  for (
    let index = startIndex + 1;
    index < Math.min((snapshotLines ?? []).length, startIndex + 95);
    index += 1
  ) {
    const line = normalizeWhitespace(stripChoiceListLine(snapshotLines[index]));
    if (!line) {
      continue;
    }
    if (isSectionedOptionCourseBoundary(line)) {
      break;
    }
    if (sourceLineStartsWithCourseCode(line)) {
      courseRowCount += 1;
      if (courseRowCount >= minimumCount) {
        return true;
      }
    }
  }

  return false;
}

function isNonRequirementSectionedCourseHeading(line) {
  return (
    /\b(?:can overlap|may overlap|completed through elective credits|please see\b.{0,80}\bwebpage|policy)\b/i.test(
      line
    ) &&
    !/\b(?:selected from the following list|courses? listed below|listed below are required|following departments)\b/i.test(
      line
    )
  );
}

function looksLikeSectionedCourseHeadingLine(line) {
  const normalizedLine = normalizeWhitespace(stripChoiceListLine(line));
  if (
    !normalizedLine ||
    sourceLineStartsWithCourseCode(normalizedLine) ||
    (extractCourseCodesFromLine(normalizedLine).length && !/\b\d{3}[-\s]*level\b/i.test(normalizedLine))
  ) {
    return false;
  }

  if (parseSectionedCourseRequiredCount(normalizedLine)) {
    return true;
  }

  return (
    SECTIONED_COURSE_LIST_REQUIREMENT_PATTERN.test(normalizedLine) &&
    /\b(?:credits?|courses?|electives?|minimum|maximum)\b/i.test(normalizedLine)
  );
}

function getSectionedCourseHeadingDescriptor(owner, snapshotLines, index, input = {}) {
  if (isGraduateOrAppliedMastersRequirementContext(owner, snapshotLines, index)) {
    return null;
  }

  const rawLine = normalizeWhitespace(stripChoiceListLine(snapshotLines?.[index] ?? ""));
  const previousMeaningfulLine = (snapshotLines ?? [])
    .slice(Math.max(0, index - 3), index)
    .map((line) => normalizeWhitespace(stripChoiceListLine(line)))
    .filter(Boolean)
    .at(-1);
  if (
    !rawLine ||
    isNonRequirementSectionedCourseHeading(rawLine) ||
    sourceLineStartsWithCourseCode(rawLine) ||
    (previousMeaningfulLine &&
      sourceLineStartsWithCourseCode(previousMeaningfulLine) &&
      /\(\s*\d+(?:\.\d+)?\s*(?:credits?|cr\.?)\s*\)/i.test(rawLine)) ||
    (extractCourseCodesFromLine(rawLine).length && !/\b\d{3}[-\s]*level\b/i.test(rawLine))
  ) {
    return null;
  }
  if (/^\d+(?:\s*(?:-|to)\s*\d+)?$/.test(rawLine) || /^TOTAL\b/i.test(rawLine)) {
    return null;
  }
  if (/\bcredits?\s+total\b/i.test(rawLine) && !/\b(?:selected|following|listed below|minimum|maximum)\b/i.test(rawLine)) {
    return null;
  }

  const followingCreditLine = normalizeWhitespace(stripChoiceListLine(snapshotLines?.[index + 1] ?? ""));
  const followingCreditRange = parseSectionHeadingCreditRange(followingCreditLine);
  if (
    followingCreditRange &&
    !/\bprerequisites?\b/i.test(rawLine) &&
    /\b(?:core|electives?|approved|selected|list)\b/i.test(rawLine) &&
    !/\b(?:requirements?|core courses?|electives?)\b/i.test(followingCreditLine.replace(/\b\d+(?:\.\d+)?\s*credits?(?:\s+total)?\b/gi, "")) &&
    (/\b(?:from|electives?|core)\b/i.test(`${rawLine} ${followingCreditLine}`)) &&
    hasUpcomingSectionedCourseRows(snapshotLines, index + 1, 2)
  ) {
    return {
      label: normalizeSectionedCourseGroupLabel(rawLine),
      category: buildSectionedCourseCategory(rawLine),
      requirementType: "choose_credits",
      minCredits: followingCreditRange.minCredits,
      maxCredits: followingCreditRange.maxCredits ?? null,
      creditText:
        followingCreditRange.maxCredits && followingCreditRange.maxCredits !== followingCreditRange.minCredits
          ? `${followingCreditRange.minCredits}-${followingCreditRange.maxCredits}`
          : String(followingCreditRange.minCredits),
      detectedOptionCue: "sectioned split-heading credit list",
    };
  }

  const optionAcronym = input.optionAcronym ?? null;
  if (
    optionAcronym &&
    new RegExp(`\\b${optionAcronym}\\b`, "i").test(rawLine) &&
    /\b(?:core|electives?)\b/i.test(rawLine)
  ) {
    return null;
  }

  const requiredCount = parseSectionedCourseRequiredCount(rawLine);
  const minimumCreditMatch = rawLine.match(/\bminimum\s+of\s+(\d+(?:\.\d+)?)\s+credits?\b/i);
  const maximumCreditMatch = rawLine.match(/\bmaximum\s+of\s+(\d+(?:\.\d+)?)\s+credits?\b/i);
  const exactCreditRange = parseSectionHeadingCreditRange(rawLine);
  if (/\bcredits?\s*\/\s*both courses?\b/i.test(rawLine) && exactCreditRange) {
    return {
      label: normalizeSectionedCourseGroupLabel(rawLine),
      category: buildSectionedCourseCategory(rawLine),
      requirementType: "choose_credits",
      minCredits: exactCreditRange.minCredits,
      maxCredits: exactCreditRange.maxCredits ?? exactCreditRange.minCredits,
      creditText:
        exactCreditRange.maxCredits && exactCreditRange.maxCredits !== exactCreditRange.minCredits
          ? `${exactCreditRange.minCredits}-${exactCreditRange.maxCredits}`
          : String(exactCreditRange.minCredits),
      detectedOptionCue: "sectioned credit list",
    };
  }

  if (/\bconcentration courses?\b/i.test(rawLine)) {
    const concentrationCreditLine = (snapshotLines ?? [])
      .slice(Math.max(0, index - 8), index)
      .map((line) => normalizeWhitespace(stripChoiceListLine(line)))
      .reverse()
      .find((line) => /\bcredits?\b.{0,80}\bminimum\b.{0,80}\beach concentration\b/i.test(line));
    const concentrationCreditMatch = concentrationCreditLine?.match(
      /\b(\d+(?:\.\d+)?)\s+credits?\b/i
    );
    const concentrationCredits = concentrationCreditMatch
      ? Number.parseFloat(concentrationCreditMatch[1])
      : null;
    if (Number.isFinite(concentrationCredits) && hasUpcomingSectionedCourseRows(snapshotLines, index, 1)) {
      return {
        label: normalizeSectionedCourseGroupLabel(rawLine),
        category: buildSectionedCourseCategory(rawLine),
        requirementType: "choose_credits",
        minCredits: concentrationCredits,
        maxCredits: null,
        creditText: `${concentrationCredits}+`,
        detectedOptionCue: "sectioned concentration credit list",
      };
    }
  }

  const hasCourseListCue =
    SECTIONED_COURSE_LIST_REQUIREMENT_PATTERN.test(rawLine) ||
    /\belectives?\b/i.test(rawLine) ||
    /\bfollowing\s+departments\b/i.test(rawLine);
  if (!hasCourseListCue) {
    return null;
  }

  const minimumRows = requiredCount === 1 ? 1 : 2;
  if (!hasUpcomingSectionedCourseRows(snapshotLines, index, minimumRows)) {
    return null;
  }

  const label = normalizeSectionedCourseGroupLabel(rawLine);
  const category = buildSectionedCourseCategory(rawLine);
  if (maximumCreditMatch) {
    const maxCredits = Number.parseFloat(maximumCreditMatch[1]);
    if (Number.isFinite(maxCredits)) {
      return {
        label,
        category,
        requirementType: "choose_credits",
        minCredits: 0,
        maxCredits,
        creditText: `0-${maxCredits}`,
        detectedOptionCue: "sectioned credit maximum",
      };
    }
  }
  if (minimumCreditMatch) {
    const minCredits = Number.parseFloat(minimumCreditMatch[1]);
    if (Number.isFinite(minCredits)) {
      return {
        label,
        category,
        requirementType: "choose_credits",
        minCredits,
        maxCredits: null,
        creditText: `${minCredits}+`,
        detectedOptionCue: "sectioned credit minimum",
      };
    }
  }
  if (exactCreditRange && /\bcredits?\b/i.test(rawLine)) {
    return {
      label,
      category,
      requirementType: "choose_credits",
      minCredits: exactCreditRange.minCredits,
      maxCredits: exactCreditRange.maxCredits ?? exactCreditRange.minCredits,
      creditText:
        exactCreditRange.maxCredits && exactCreditRange.maxCredits !== exactCreditRange.minCredits
          ? `${exactCreditRange.minCredits}-${exactCreditRange.maxCredits}`
          : String(exactCreditRange.minCredits),
      detectedOptionCue: "sectioned credit list",
    };
  }
  if (requiredCount) {
    return {
      label,
      category,
      requirementType: "choose_n",
      minCourses: requiredCount,
      maxCourses: requiredCount,
      selectionCount: requiredCount,
      requiredCount,
      detectedOptionCue: "sectioned choice list",
    };
  }

  return null;
}

function getFallbackSectionedElectiveHeadingDescriptor(owner, snapshotLines, index, input = {}) {
  if (isGraduateOrAppliedMastersRequirementContext(owner, snapshotLines, index)) {
    return null;
  }

  const rawLine = normalizeWhitespace(stripChoiceListLine(snapshotLines?.[index] ?? ""));
  if (
    !rawLine ||
    isNonRequirementSectionedCourseHeading(rawLine) ||
    sourceLineStartsWithCourseCode(rawLine) ||
    extractCourseCodesFromLine(rawLine).length > 0 ||
    !/\belectives?\b/i.test(rawLine)
  ) {
    return null;
  }
  if (/\bcredits?\s+total\b/i.test(rawLine) && !/\b(?:selected|following|listed below|minimum|maximum)\b/i.test(rawLine)) {
    return null;
  }

  const exactCreditRange = parseSectionHeadingCreditRange(rawLine);
  if (!exactCreditRange || !hasUpcomingSectionedCourseRows(snapshotLines, index, 2)) {
    return null;
  }

  const optionAcronym = input.optionAcronym ?? null;
  if (
    optionAcronym &&
    new RegExp(`\\b${optionAcronym}\\b`, "i").test(rawLine) &&
    /\b(?:core|electives?)\b/i.test(rawLine)
  ) {
    return null;
  }

  const label = normalizeSectionedCourseGroupLabel(rawLine);
  return {
    label,
    category: buildSectionedCourseCategory(rawLine),
    requirementType: "choose_credits",
    minCredits: exactCreditRange.minCredits,
    maxCredits: exactCreditRange.maxCredits ?? exactCreditRange.minCredits,
    creditText:
      exactCreditRange.maxCredits && exactCreditRange.maxCredits !== exactCreditRange.minCredits
        ? `${exactCreditRange.minCredits}-${exactCreditRange.maxCredits}`
        : String(exactCreditRange.minCredits),
    detectedOptionCue: "sectioned elective credit list",
  };
}

function isSectionedCourseListBoundary(owner, snapshotLines, index, hasCollectedCourses, input = {}) {
  const line = normalizeWhitespace(stripChoiceListLine(snapshotLines?.[index] ?? ""));
  if (!line) {
    return false;
  }
  if (isSectionedOptionCourseBoundary(line)) {
    return true;
  }
  if (!hasCollectedCourses || sourceLineStartsWithCourseCode(line)) {
    return false;
  }
  if (/^\d+(?:\s*(?:-|to)\s*\d+)?$/.test(line)) {
    return false;
  }
  if (/^TOTAL\b/i.test(line)) {
    return true;
  }
  if (getSectionedCourseHeadingDescriptor(owner, snapshotLines, index, input)) {
    return true;
  }
  return (
    line.length <= 120 &&
    /\b(?:requirements?|electives?|core courses?|required\b.{0,40}\bcourses?|concentrations?|advising|admission|polic(?:y|ies)|contact|tuition|scholarships?|capstone|research|graduation|sample schedules?)\b/i.test(
      line
    ) &&
    !/\b(?:credits?\)|prereq|offered|maximum of)\b/i.test(line)
  );
}

function getSectionedCourseListEndIndex(owner, snapshotLines, startIndex, input = {}) {
  let hasCollectedCourses = false;
  for (let index = startIndex + 1; index < (snapshotLines ?? []).length; index += 1) {
    const line = normalizeWhitespace(stripChoiceListLine(snapshotLines[index]));
    if (sourceLineStartsWithCourseCode(line)) {
      hasCollectedCourses = true;
      continue;
    }
    if (isSectionedCourseListBoundary(owner, snapshotLines, index, hasCollectedCourses, input)) {
      return index;
    }
  }

  return (snapshotLines ?? []).length;
}

function buildSourceDerivedSectionedCourseRequirementGroups(owner, snapshotLines) {
  const replacement = parserRules.detectOptionReplacement({
    owner,
    snapshotLines,
    sourceUrl: owner.sourceUrl ?? owner.primarySourceUrl ?? null,
  });
  const descriptorInput = {
    optionAcronym: replacement?.optionAcronym ?? null,
  };
  const groups = [];
  const seenGroupIds = new Set();

  for (let index = 0; index < (snapshotLines ?? []).length; index += 1) {
    const descriptor =
      getSectionedCourseHeadingDescriptor(owner, snapshotLines, index, descriptorInput) ??
      getFallbackSectionedElectiveHeadingDescriptor(owner, snapshotLines, index, descriptorInput);
    if (!descriptor) {
      continue;
    }

    const rawSourceHeading = normalizeSectionedCourseGroupLabel(snapshotLines[index]);
    if (isGenericUniversityCategoryDistributionHeading(rawSourceHeading)) {
      continue;
    }
    const sourceHeading = getTrimmedSectionedCourseGroupHeading(rawSourceHeading, descriptor);
    const effectiveDescriptor =
      sourceHeading && sourceHeading !== descriptor.label
        ? {
            ...descriptor,
            label: sourceHeading,
            category: buildSectionedCourseCategory(sourceHeading),
          }
        : descriptor;
    const endIndex = getSectionedCourseListEndIndex(owner, snapshotLines, index, descriptorInput);
    const options = collectSectionedOptionCourseOptions(owner, snapshotLines, index, endIndex, {
      category: effectiveDescriptor.category,
      sectionHeading: sourceHeading,
      sourceHeading,
    });
    if (options.length < 1) {
      continue;
    }

    const groupId = `${owner.ownerId}:requirement-group:${slugify(
      `${effectiveDescriptor.label}-${effectiveDescriptor.requirementType}-${effectiveDescriptor.minCredits ?? effectiveDescriptor.minCourses ?? "options"}-${effectiveDescriptor.maxCredits ?? effectiveDescriptor.maxCourses ?? "open"}`
    )}`;
    if (seenGroupIds.has(groupId)) {
      continue;
    }

    const group = buildParsedRequirementGroup({
      id: groupId,
      label: effectiveDescriptor.label,
      category: effectiveDescriptor.category,
      subcategory: effectiveDescriptor.category,
      requirementType: effectiveDescriptor.requirementType,
      minCourses: effectiveDescriptor.minCourses,
      maxCourses: effectiveDescriptor.maxCourses,
      selectionCount: effectiveDescriptor.selectionCount,
      requiredCount: effectiveDescriptor.requiredCount,
      minCredits: effectiveDescriptor.minCredits,
      maxCredits: effectiveDescriptor.maxCredits,
      creditText: effectiveDescriptor.creditText,
      sourceHeading,
      sourceRowText: sourceHeading,
      detectedOptionCue: effectiveDescriptor.detectedOptionCue,
      notes: [
        "Parsed from a source section heading and the following course rows.",
      ],
      options,
    });
    if (!group.options.length) {
      continue;
    }
    seenGroupIds.add(groupId);
    groups.push(group);
    index = Math.max(index, endIndex - 1);
  }

  return groups;
}

function buildSourceDerivedRequirementCourses(parsedRequirementGroups) {
  return uniqueBy(
    buildParsedRequirementCoursesFromGroups(parsedRequirementGroups),
    (course) =>
      `${course.requirementGroupId}::${course.normalizedCourseCode}::${course.optionRole}`
  );
}

function buildSourceDerivedRequirementReplacements(owner, snapshotLines) {
  return buildParserRuleRequirementReplacements(owner, snapshotLines);
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

function getChoiceRequirementGroupLabel(normalizedLine, courseCodes) {
  const lineWithoutPage = stripChoiceListLine(normalizedLine);
  const parentheticalChoiceIndex = lineWithoutPage.search(
    new RegExp(
      `\\s*\\([^)]*\\b(?:choose|select|or|${CHOICE_COUNT_WORDS_PATTERN}\\s+of|one\\s+of|one\\s+from|one\\s+course\\s+from)\\b`,
      "i"
    )
  );
  if (parentheticalChoiceIndex > 0) {
    const prefix = normalizeWhitespace(lineWithoutPage.slice(0, parentheticalChoiceIndex));
    if (
      prefix &&
      !extractCourseCodesFromLine(prefix).length &&
      CHOICE_REQUIREMENT_LABEL_PATTERN.test(prefix)
    ) {
      return prefix;
    }
  }

  const chooseListIndex = lineWithoutPage.search(
    new RegExp(
      `\\s*\\(?\\s*(?:choose(?:\\s+(?:from|${CHOICE_COUNT_WORDS_PATTERN}|\\d+))?|select|one\\s+(?:course\\s+)?from|one\\s+of)\\b`,
      "i"
    )
  );
  if (chooseListIndex > 0) {
    const prefix = normalizeWhitespace(lineWithoutPage.slice(0, chooseListIndex));
    if (
      prefix &&
      !extractCourseCodesFromLine(prefix).length &&
      CHOICE_REQUIREMENT_LABEL_PATTERN.test(prefix)
    ) {
      return prefix.replace(/[:;,-]+$/g, "").trim();
    }
  }

  return normalizedLine.length <= 120 ? normalizedLine : courseCodes.join(" or ");
}

function shouldSkipRawPartialChoiceLine(input) {
  if (input.isCombinedChoiceLine || input.hasExplicitOr) {
    return false;
  }
  if (!input.hasOwnChoiceContext) {
    return true;
  }

  return (
    CHOICE_LIST_START_PATTERN.test(stripChoiceListLine(input.normalizedLine)) &&
    !/\)\s*$/.test(input.normalizedLine)
  );
}

function buildSequenceChoiceRequirementGroup(owner, candidate) {
  const normalizedPaths = uniqueBy(
    (candidate.paths ?? [])
      .map((path) => {
        const uwCourses = uniqueInOrder(
          (path.uwCourses ?? [])
            .map((courseCode) => normalizeCourseCode(courseCode))
            .filter(Boolean)
        );
        return {
          ...path,
          label: normalizeWhitespace(path.label ?? "") || getSequencePathLabelFromText(path.sourceText, uwCourses),
          uwCourses,
          conditionalLabCourses: uniqueInOrder(
            (path.conditionalLabCourses ?? [])
              .map((courseCode) => normalizeCourseCode(courseCode))
              .filter(Boolean)
          ),
          notes: uniqueSorted((path.notes ?? []).map(normalizeWhitespace).filter(Boolean)),
          sourceText: normalizeWhitespace(path.sourceText ?? candidate.rawText ?? ""),
        };
      })
      .filter((path) => path.uwCourses.length >= 2),
    (path) => path.uwCourses.join("|")
  );

  if (normalizedPaths.length < 2) {
    return null;
  }

  const allPathCourses = uniqueInOrder(normalizedPaths.flatMap((path) => path.uwCourses));
  const sourceHeading = normalizeWhitespace(candidate.rawText ?? "") || allPathCourses.join(" or ");
  const groupId = `${owner.ownerId}:requirement-group:sequence-choice-${slugify(
    allPathCourses.join("-or-")
  )}`;
  const sequencePaths = normalizedPaths.map((path, index) => ({
    id: `${groupId}:path:${
      slugify(`${path.label || `sequence-${index + 1}`}-${path.uwCourses.join("-")}`) ||
      `sequence-${index + 1}`
    }`,
    label: path.label || `sequence path ${index + 1}`,
    uwCourses: path.uwCourses,
    displayCourseCodes: path.uwCourses,
    conditionalLabCourses: path.conditionalLabCourses ?? [],
    notes: path.notes ?? [],
    sourceText: path.sourceText || sourceHeading,
  }));

  return buildParsedRequirementGroup({
    id: groupId,
    label: getChoiceRequirementGroupLabel(sourceHeading, allPathCourses),
    sourceHeading,
    sourceRowText: sourceHeading,
    sourceSection: candidate.sourceSection,
    detectedOptionCue: candidate.detectedOptionCue ?? getSequenceChoiceCue(sourceHeading),
    category: "source-sequence-choice",
    requirementType: "sequence_choice",
    minCourses: 1,
    maxCourses: 1,
    selectionCount: 1,
    requiredCount: 1,
    sequencePaths,
    options: sequencePaths.map((path) => ({
      id: `${owner.ownerId}:requirement-option:${slugify(path.id)}`,
      sequencePathId: path.id,
      pathLabel: path.label,
      uwCourses: path.uwCourses,
      displayCourseCodes: path.displayCourseCodes,
      conditionalLabCourses: path.conditionalLabCourses,
      notes: path.notes,
      label: path.label,
    })),
  });
}

function buildGenericSequenceChoiceRequirementGroups(owner, parsedCourseCodes, snapshotLines) {
  const parsedCourseCodeSet = new Set(
    parsedCourseCodes.map((courseCode) => normalizeCourseCode(courseCode))
  );
  const groups = [];
  const seenGroupIds = new Set();

  for (let index = 0; index < (snapshotLines ?? []).length; index += 1) {
    const columnarCandidate = buildColumnarSequenceChoiceCandidate(snapshotLines, index);
    const candidates = [
      ...buildParentheticalSequenceChoiceCandidates(snapshotLines, index),
      columnarCandidate,
      columnarCandidate ? null : buildAlternatingNumberSequenceChoiceCandidate(snapshotLines, index),
      buildMultilineSequenceChoiceCandidate(snapshotLines, index),
    ].filter(Boolean);

    for (const candidate of candidates) {
      const strongSequenceCue = hasSequenceChoiceContext(candidate.rawText);
      const filteredCandidate = {
        ...candidate,
        paths: candidate.paths
          .map((path) => ({
            ...path,
            uwCourses: uniqueInOrder(
              (path.uwCourses ?? []).filter(
                (courseCode) =>
                  strongSequenceCue || parsedCourseCodeSet.has(normalizeCourseCode(courseCode))
              )
            ),
          }))
          .filter((path) => path.uwCourses.length >= 2),
      };
      const group = buildSequenceChoiceRequirementGroup(owner, filteredCandidate);
      if (!group || seenGroupIds.has(group.id)) {
        continue;
      }
      seenGroupIds.add(group.id);
      groups.push(group);
    }
  }

  return groups;
}

function getSplitEitherOrCourseLine(snapshotLines, startIndex, direction) {
  const step = direction === "previous" ? -1 : 1;
  for (
    let index = startIndex + step;
    index >= 0 && index < (snapshotLines ?? []).length && Math.abs(index - startIndex) <= 3;
    index += step
  ) {
    const normalizedLine = normalizeWhitespace(stripChoiceListLine(snapshotLines[index]));
    if (!normalizedLine) {
      continue;
    }
    const courseCodes = extractCourseCodesFromLine(normalizedLine);
    if (courseCodes.length === 1 && sourceLineStartsWithCourseCode(normalizedLine)) {
      return {
        line: normalizedLine,
        courseCode: courseCodes[0],
      };
    }
    if (courseCodes.length > 0 || hasPrimaryRequirementSectionCue(normalizedLine)) {
      break;
    }
  }

  return null;
}

function buildSplitEitherOrRequirementGroups(owner, parsedCourseCodes, snapshotLines) {
  const groups = [];
  const seenGroupIds = new Set();

  const addSplitEitherOrGroup = (courseLines) => {
    const courseCodes = uniqueInOrder(
      courseLines.map((courseLine) => normalizeCourseCode(courseLine.courseCode))
    ).filter(Boolean);
    if (courseCodes.length !== 2) {
      return;
    }
    if (!courseCodes.every((courseCode) => (getParsedCourseLevel(courseCode) ?? 999) < 300)) {
      return;
    }

    const sourceHeading = normalizeWhitespace(courseLines.map((courseLine) => courseLine.line).join(" OR "));
    const sourceRowText = normalizeWhitespace(courseLines[0]?.line ?? "") || sourceHeading;
    const groupId = `${owner.ownerId}:requirement-group:${slugify(courseCodes.join("-or-"))}`;
    if (seenGroupIds.has(groupId)) {
      return;
    }

    const group = buildParsedRequirementGroup({
      id: groupId,
      label: courseCodes.join(" or "),
      sourceHeading,
      sourceRowText,
      detectedOptionCue: "or",
      category: "source-choice",
      requirementType: "choose_one",
      minCourses: 1,
      maxCourses: 1,
      selectionCount: 1,
      requiredCount: 1,
      options: courseCodes.map((courseCode) => {
        const metadata = getUwCourseMetadata(courseCode);
        const creditRange = getUwCourseCreditRange(courseCode);
        return {
          id: `${owner.ownerId}:requirement-option:${slugify(courseCode)}`,
          uwCourses: [courseCode],
          label: courseCode,
          title: metadata?.title ?? null,
          ...creditRange,
        };
      }),
    });

    if (!group.options.length) {
      return;
    }
    seenGroupIds.add(groupId);
    groups.push(group);
  };

  for (let index = 0; index < (snapshotLines ?? []).length; index += 1) {
    const normalizedLine = normalizeWhitespace(stripChoiceListLine(snapshotLines[index]));
    const lineCourseCodes = extractCourseCodesFromLine(normalizedLine);
    if (
      /\bor\s*$/i.test(normalizedLine) &&
      lineCourseCodes.length === 1 &&
      sourceLineStartsWithCourseCode(normalizedLine)
    ) {
      const nextCourseLine = getSplitEitherOrCourseLine(snapshotLines, index, "next");
      if (nextCourseLine) {
        addSplitEitherOrGroup([
          { line: normalizedLine.replace(/\bor\s*$/i, "").trim(), courseCode: lineCourseCodes[0] },
          nextCourseLine,
        ]);
      }
      continue;
    }

    if (!/^OR$/i.test(normalizedLine)) {
      continue;
    }

    const previousCourseLine = getSplitEitherOrCourseLine(snapshotLines, index, "previous");
    const nextCourseLine = getSplitEitherOrCourseLine(snapshotLines, index, "next");
    if (!previousCourseLine || !nextCourseLine) {
      continue;
    }

    addSplitEitherOrGroup([previousCourseLine, nextCourseLine]);
  }

  return groups;
}

function buildGenericChoiceRequirementGroups(owner, parsedCourseCodes, snapshotLines) {
  const parsedCourseCodeSet = new Set(parsedCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)));
  const seenGroupIds = new Set();
  const groups = [];

  const choiceSourceLines = [
    ...buildMultiLineChoiceRequirementLines(snapshotLines ?? []).map((line) => ({
      line,
      isCombinedChoiceLine: true,
      nearbyRequirementLabel: "",
    })),
    ...(snapshotLines ?? []).map((line, index) => ({
      line,
      isCombinedChoiceLine: false,
      nearbyRequirementLabel: findNearbyRequirementChoiceLabel(snapshotLines ?? [], index),
    })),
  ];

  for (const choiceSourceLine of choiceSourceLines) {
    const line = choiceSourceLine.line;
    const normalizedLine = normalizeWhitespace(line);
    const optionExtractionLine = stripNonOptionCourseEvidenceFromChoiceLine(normalizedLine);
    const extractedCourseCodes = extractCourseCodesFromRequirementLine(optionExtractionLine);
    const hasExplicitOr = /\bor\b/i.test(optionExtractionLine);
    const hasOwnChoiceContext = hasChoiceRequirementContext(normalizedLine);
    const hasOwnStrongChoiceContext = hasStrongChoiceRequirementContext(normalizedLine);
    const nearbyHeadingIndicatesChoiceOrElective = hasChoiceRequirementContext(
      choiceSourceLine.nearbyRequirementLabel
    );
    const nearbyHeadingIndicatesStrongChoiceOrElective = hasStrongChoiceRequirementContext(
      choiceSourceLine.nearbyRequirementLabel
    );
    const hasProgrammingChoiceContext =
      PROGRAMMING_CHOICE_CONTEXT_PATTERN.test(normalizedLine) ||
      PROGRAMMING_CHOICE_CONTEXT_PATTERN.test(choiceSourceLine.nearbyRequirementLabel);
    const hasChoiceContext =
      hasOwnChoiceContext || nearbyHeadingIndicatesChoiceOrElective || hasProgrammingChoiceContext;
    const hasStrongChoiceContext =
      hasOwnStrongChoiceContext ||
      nearbyHeadingIndicatesStrongChoiceOrElective ||
      hasProgrammingChoiceContext;
    const hasNonChoiceCourseListContext =
      NON_CHOICE_COURSE_LIST_CONTEXT_PATTERN.test(normalizedLine) ||
      SEQUENCE_ALTERNATIVE_CHOICE_LINE_PATTERN.test(normalizedLine);
    const hasEmbeddedAlternativeRequiredSequence =
      /\([^)]*\bor\b[^)]*\)/i.test(normalizedLine) &&
      /[,;]\s*[A-Z]{2,8}&?\s*\d{3}/i.test(normalizedLine) &&
      extractedCourseCodes.length >= 4 &&
      !hasProgrammingChoiceContext &&
      !/\b(?:choose|select|one\s+of|any\s+of)\b/i.test(normalizedLine);
    const hasMultipleCourses = extractedCourseCodes.length >= 2;
    const hasExplicitChooseCount = new RegExp(
      `\\b(?:choose|select)\\s+(?:${CHOICE_COUNT_WORDS_PATTERN}|\\d+)\\b`,
      "i"
    ).test(normalizedLine);
    const isHeadingBackedSingleElectiveList =
      choiceSourceLine.isCombinedChoiceLine &&
      /\belective\b/i.test(normalizedLine) &&
      !/\belectives\b/i.test(normalizedLine) &&
      /\b\d+(?:\.\d+)?\s*credits?\s*:/i.test(normalizedLine);
    const looksLikeCreditCourseBucket =
      !hasExplicitChooseCount &&
      !isHeadingBackedSingleElectiveList &&
      (/\bcredits?\s+from\b/i.test(normalizedLine) ||
        /\b\d+(?:\.\d+)?\s*-\s*credits?\b/i.test(normalizedLine) ||
        /\b\d+(?:\.\d+)?\s+credits?\b.{0,80}:\s*[A-Z]{2,8}&?\s+\d{3}/i.test(normalizedLine));
    if (
      hasNonChoiceCourseListContext ||
      hasEmbeddedAlternativeRequiredSequence ||
      (looksLikeCreditCourseBucket && hasMultipleCourses) ||
      (!hasExplicitOr && !(hasMultipleCourses && hasStrongChoiceContext)) ||
      shouldSkipRawPartialChoiceLine({
        isCombinedChoiceLine: choiceSourceLine.isCombinedChoiceLine,
        hasExplicitOr,
        hasOwnChoiceContext: hasOwnChoiceContext || hasOwnStrongChoiceContext,
        normalizedLine,
      })
    ) {
      continue;
    }

    const explicitCourseRowChoice =
      hasExplicitOr && hasMultipleCourses && sourceLineStartsWithCourseCode(optionExtractionLine);
    const courseCodes = extractedCourseCodes.filter(
      (courseCode) =>
        parsedCourseCodeSet.has(courseCode) ||
        (hasStrongChoiceContext && hasMultipleCourses) ||
        explicitCourseRowChoice
    );
    const credits = parseRequirementCreditAmount(normalizedLine);
    const requiredCount = parseChoiceRequiredCount(optionExtractionLine);
    const requirementType = requiredCount > 1 ? "choose_n" : "choose_one";
    const categoryOptions = buildCategoryRequirementOptionsFromChoiceLine(
      owner,
      optionExtractionLine,
      credits
    );
    if (courseCodes.length < 2 && !categoryOptions.length) {
      continue;
    }
    if (courseCodes.length + categoryOptions.length < 2) {
      continue;
    }

    let group;
    if (!categoryOptions.length && isEquivalentNumberAliasLine(optionExtractionLine, courseCodes)) {
      group = buildParsedRequirementGroup({
        id: `${owner.ownerId}:requirement-group:${slugify(courseCodes.join("-"))}`,
        label: courseCodes.join(" / "),
        sourceHeading: normalizedLine,
        sourceRowText: normalizedLine,
        sourceSection: choiceSourceLine.nearbyRequirementLabel,
        detectedOptionCue: detectOptionCue(optionExtractionLine),
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
        label: getChoiceRequirementGroupLabel(optionExtractionLine, courseCodes),
        sourceHeading: normalizedLine,
        sourceRowText: normalizedLine,
        sourceSection: choiceSourceLine.nearbyRequirementLabel,
        detectedOptionCue: detectOptionCue(optionExtractionLine),
        category: "source-choice",
        requirementType,
        minCourses: requiredCount,
        maxCourses: requiredCount,
        selectionCount: requiredCount,
        requiredCount,
        options: [
          ...courseCodes.map((courseCode) => ({
            id: `${owner.ownerId}:requirement-option:${slugify(courseCode)}`,
            uwCourses: [courseCode],
            credits,
            label: courseCode,
          })),
          ...categoryOptions,
        ],
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

function getProgramSpecificCreditBucketDescriptor(owner, text) {
  const normalizedText = normalizeWhitespace(text);
  return (
    parserRules.detectProgramApprovedCreditBucket({
      owner,
      text: normalizedText,
    }) ?? detectSubjectPrefixCreditBucket(owner, normalizedText)
  );
}

function extractSubjectPrefixFromCreditBucketText(text) {
  const normalizedText = normalizeWhitespace(text);
  const patterns = [
    /\b([A-Za-z&]{1,8}(?:\s+[A-Za-z&]{1,8})?)\s*-\s*prefixed\s+courses?\b/i,
    /\b([A-Za-z&]{1,8}(?:\s+[A-Za-z&]{1,8})?)\s+prefix\s+courses?\b/i,
    /\bcourses?\s+with\s+an?\s+([A-Za-z&]{1,8}(?:\s+[A-Za-z&]{1,8})?)\s+prefix\b/i,
    /\bfrom\s+([A-Za-z&]{1,8}(?:\s+[A-Za-z&]{1,8})?)\s+electives?\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    const subject = normalizeExtractedCourseSubject(match?.[1]);
    if (subject) {
      return subject;
    }
  }

  return null;
}

function getMetadataCourseCodesForSubjectPrefix(campusId, subjectPrefix) {
  const normalizedCampusId = normalizeWhitespace(campusId);
  const normalizedSubject = normalizeExtractedCourseSubject(subjectPrefix);
  if (!normalizedSubject) {
    return [];
  }

  return uniqueSorted(
    (TRANSFER_PLANNER_GENERATED_COURSE_METADATA ?? [])
      .filter((entry) => !normalizedCampusId || entry.schoolId === normalizedCampusId)
      .map((entry) => normalizeCourseCode(entry.code))
      .filter((courseCode) => courseCode.startsWith(`${normalizedSubject} `))
  );
}

function detectSubjectPrefixCreditBucket(owner, text) {
  const normalizedText = normalizeWhitespace(text);
  if (!/\b(?:electives?|courses?)\b/i.test(normalizedText)) {
    return null;
  }

  const subjectPrefix = extractSubjectPrefixFromCreditBucketText(normalizedText);
  if (!subjectPrefix) {
    return null;
  }

  const approvedUwCourseCodes = getMetadataCourseCodesForSubjectPrefix(
    owner?.campusId,
    subjectPrefix
  );
  if (!approvedUwCourseCodes.length) {
    return null;
  }

  const ownerPart = slugify(owner?.planId ?? owner?.ownerId ?? "program");
  const subjectPart = slugify(subjectPrefix);
  return {
    category: `${subjectPrefix.replace(/[^A-Z0-9]+/g, "_")}_PREFIX`,
    sourceCategoryCode: `${subjectPrefix} prefix`,
    longLabel: `${subjectPrefix} prefix courses`,
    approvedListKey: `${ownerPart}-${subjectPart}-prefix-courses`,
    programSpecific: true,
    subjectPrefix,
    approvedUwCourseCodes,
  };
}

function getApprovedListKeyFromCreditBucketText(owner, text, descriptor = null) {
  if (descriptor?.approvedListKey) {
    return descriptor.approvedListKey;
  }

  const normalizedText = normalizeWhitespace(text);
  if (/\bapproved\b/i.test(normalizedText)) {
    const ownerPart = slugify(owner.planId ?? owner.ownerId ?? "program");
    if (/\belectives?\b/i.test(normalizedText)) {
      return `${ownerPart}-approved-electives`;
    }
    if (/\bnatural sciences?\b/i.test(normalizedText)) {
      return `${ownerPart}-approved-natural-science`;
    }
    if (/\bmath(?:ematics)?\/science\b|\bmath(?:ematics)?\s*&\s*science\b/i.test(normalizedText)) {
      return `${ownerPart}-approved-math-science`;
    }
  }

  return null;
}

function getGenericCategoryOptionDescriptorsFromCreditBucketText(text) {
  const normalizedText = normalizeWhitespace(text);
  return CATEGORY_OPTION_DEFINITIONS.filter((definition) => definition.pattern.test(normalizedText));
}

function hasCreditBucketCue(text) {
  const normalizedText = normalizeWhitespace(text);
  if (!parseRequirementCreditRange(normalizedText)) {
    return false;
  }

  return (
    /\b(?:approved|electives?|natural sciences?|social sciences?|arts?\s+(?:and|&)\s+humanities|humanities|diversity|quantitative and symbolic reasoning|natural world|individuals\s+and\s+societies|A\s*&\s*H|S\s*Sc|N\s*Sc|I\s*&\s*S|VLPA|DIV|QSR|NW|Math\/Science|Math\s*&\s*Science)\b/i.test(
      normalizedText
    ) ||
    /\bcredits?\s+from\b.{0,120}\belectives?\b/i.test(normalizedText) ||
    /\bcredits?\b.{0,160}\b(?:[A-Za-z&]{1,8}(?:\s+[A-Za-z&]{1,8})?\s*-\s*prefixed\s+courses?|[A-Za-z&]{1,8}(?:\s+[A-Za-z&]{1,8})?\s+prefix\s+courses?|courses?\s+with\s+an?\s+[A-Za-z&]{1,8}(?:\s+[A-Za-z&]{1,8})?\s+prefix)\b/i.test(
      normalizedText
    ) ||
    /\bcredits?\b.{0,120}:\s*[A-Z]{2,8}&?\s+\d{3}/i.test(normalizedText) ||
    /\b(?:credits?|\d+(?:\.\d+)?\s*-\s*credits?)\b.{0,120}\bintroductory\s+[A-Z]{2,8}\s+classes?\b/i.test(normalizedText) ||
    /\bcredits?\s+(?:primary|secondary)?\s*language\b/i.test(normalizedText) ||
    /\bcomplete\b.{0,100}\b(?:second|third|fourth)[-\s]?year\s+level\b/i.test(normalizedText) ||
    (/\bcredits?\s+from\b/i.test(normalizedText) &&
      extractCourseCodesFromLine(normalizedText).length >= 2)
  );
}

function looksLikeCompositeCreditHeading(text) {
  const normalizedText = normalizeWhitespace(text);
  return /\b(?:Areas of Inquiry|Mathematics\s*&\s*Natural Sciences|Mathematics and Natural Sciences|General Education Component|Computer Engineering Component|Core and Electives|Fundamentals)\b/i.test(
    normalizedText
  );
}

function nextLineLooksLikeCourseListForHeading(snapshotLines, index) {
  const nextLine = normalizeWhitespace(stripChoiceListLine(snapshotLines?.[index + 1] ?? ""));
  return extractCourseCodesFromLine(nextLine).length >= 2 && /[,;]/.test(nextLine);
}

function startsWithCategoryCreditCue(text) {
  const sourceLine = normalizeWhitespace(text);
  return (
    /^(?:Diversity Requirement|Arts?\s+(?:and|&)\s+Humanities|Social Sciences?|Natural Sciences?|Natural World|Individuals\s+and\s+Societies|Quantitative and Symbolic Reasoning|\b(?:A\s*&\s*H|S\s*Sc|N\s*Sc|I\s*&\s*S|VLPA|DIV|QSR|NW)\b)/i.test(
      sourceLine
    ) ||
    /^\d+(?:\.\d+)?\s+(?:additional\s+)?(?:diversity|arts?\s+(?:and|&)\s+humanities|social sciences?|natural sciences?|natural world|individuals\s+and\s+societies|quantitative and symbolic reasoning)\s+credits?\b/i.test(
      sourceLine
    )
  );
}

function shouldSkipCreditBucketLine(snapshotLines, index, text) {
  const normalizedText = normalizeWhitespace(text);
  if (
    !normalizedText ||
    (looksLikeCompositeCreditHeading(normalizedText) && !startsWithCategoryCreditCue(normalizedText))
  ) {
    return true;
  }

  if (
    /\belective\b/i.test(normalizedText) &&
    !/\b(?:approved|from|of|list)\b/i.test(normalizedText) &&
    nextLineLooksLikeCourseListForHeading(snapshotLines, index)
  ) {
    return true;
  }

  return false;
}

function looksLikeAdmissionDecisionNarrativeCreditBucket(text) {
  const normalizedText = normalizeWhitespace(text);
  return (
    /\b(?:admission decisions?|completion of .{0,80}requirements? does not guarantee admission|does not guarantee admission)\b/i.test(
      normalizedText
    ) ||
    /\b(?:performance and potential|personal motivation|quality of relevant experience)\b/i.test(
      normalizedText
    )
  );
}

function looksLikeCreditBucketContinuation(line) {
  const normalizedLine = normalizeWhitespace(stripChoiceListLine(line));
  return parserRules.isCreditBucketContinuationLine(normalizedLine);
}

function buildCreditBucketSourceLine(owner, snapshotLines, startIndex) {
  const parts = [stripChoiceListLine(snapshotLines[startIndex])].filter(Boolean);
  const firstLine = parts.join(" ");
  const shouldConsiderContinuation = parserRules.shouldJoinCreditBucketContinuation({
    owner,
    firstLine,
  });
  if (!shouldConsiderContinuation) {
    return normalizeWhitespace(firstLine);
  }

  for (
    let index = startIndex + 1;
    index < Math.min((snapshotLines ?? []).length, startIndex + 5);
    index += 1
  ) {
    const continuation = stripChoiceListLine(snapshotLines[index]);
    if (/^(?:\[Page\s+\d+\]\s*)?Additional Requirements$/i.test(normalizeWhitespace(continuation))) {
      continue;
    }
    if (!looksLikeCreditBucketContinuation(continuation)) {
      break;
    }
    parts.push(continuation);
    if (
      getProgramSpecificCreditBucketDescriptor(
        owner,
        parts.join(" ")
      ) &&
      /\bnatural science courses for\b|website/i.test(parts.join(" "))
    ) {
      break;
    }
  }

  return normalizeWhitespace(parts.join(" "));
}

function splitCreditBucketSourceLines(sourceLine) {
  const normalizedLine = normalizeWhitespace(sourceLine);
  const rawParts = normalizedLine
    .split(/\s*;\s*/g)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
  const parts = [];
  for (const part of rawParts) {
    if (
      parts.length > 0 &&
      !parseRequirementCreditRange(part) &&
      /^and\s+[A-Z]{2,8}&?\s+\d{3}/i.test(part)
    ) {
      parts[parts.length - 1] = `${parts[parts.length - 1]}, ${part.replace(/^and\s+/i, "")}`;
      continue;
    }
    parts.push(part);
  }
  const partHasRequirementCreditRange = (part) =>
    Boolean(parseRequirementCreditRange(part)) && !sourceLineStartsWithCourseCode(part);
  const creditPartCount = parts.filter(partHasRequirementCreditRange).length;
  if (parts.length < 2 || creditPartCount < 2) {
    return [normalizedLine];
  }

  const prefixMatch = parts[0]?.match(/^([^:]{3,90}):\s*/);
  const prefix = prefixMatch ? normalizeWhitespace(prefixMatch[1]) : null;
  return parts.map((part, index) => {
    if (!prefix || index === 0 || /:/.test(part)) {
      return part;
    }
    return `${prefix}: ${part}`;
  });
}

function buildCategoryRequirementOptionsFromCreditBucket(owner, text, creditRange, descriptor = null) {
  if (descriptor) {
    return [
      buildCategoryRequirementOption({
        id: `${owner.ownerId}:requirement-option:${slugify(descriptor.approvedListKey ?? descriptor.sourceCategoryCode)}`,
        sourceText: text,
        sourceHeading: text,
        sourceCategory: "credit-bucket",
        descriptor,
        creditRange,
        approvedListKey: descriptor.approvedListKey,
        programSpecific: true,
      }),
    ].filter(Boolean);
  }

  const descriptors = getGenericCategoryOptionDescriptorsFromCreditBucketText(text);
  return uniqueBy(
    descriptors
      .map((categoryDescriptor) =>
        buildCategoryRequirementOption({
          id: `${owner.ownerId}:requirement-option:category-credit-${slugify(
            `${categoryDescriptor.sourceCategoryCode}-${text}`
          )}`,
          sourceText: text,
          sourceHeading: text,
          sourceCategory: "credit-bucket",
          descriptor: categoryDescriptor,
          creditRange,
        })
      )
      .filter(Boolean),
    (option) => `${option.categoryOption.category}:${option.categoryOption.creditMin}:${option.categoryOption.creditMax}`
  );
}

function extractCourseCodesFromCreditBucketText(text) {
  return uniqueInOrder(
    [
      ...Array.from(
        String(text ?? "").matchAll(
          /\b(?:from|following:?)\s+([A-Za-z&]{2,8}|[A-Za-z&]{1,4}\s+[A-Za-z&]{1,4})\s+(\d{3}[A-Za-z]?)\b/gi
        ),
        (match) => `${match[1]} ${match[2]}`
      ),
      ...extractCourseCodesFromLine(text),
    ]
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function buildCourseRequirementOptionsFromCreditBucket(owner, text, creditRange) {
  const courseCodes = extractCourseCodesFromCreditBucketText(text);

  return courseCodes.map((courseCode) => {
    const metadata = getUwCourseMetadata(courseCode);
    const courseCreditRange = getUwCourseCreditRange(courseCode) ?? {};
    return {
      id: `${owner.ownerId}:requirement-option:${slugify(`credit-bucket-${courseCode}`)}`,
      displayCourseCodes: [courseCode],
      uwCourses: [courseCode],
      ...courseCreditRange,
      title: metadata?.title ?? null,
      department: getCourseCodeSubject(courseCode),
      category: "approved-credit-bucket",
      label: courseCode,
      sourceHeading: text,
      sourceCategory: "credit-bucket",
      notes:
        creditRange?.minCredits != null
          ? [`Option parsed from a ${creditRange.minCredits}-credit source bucket.`]
          : [],
    };
  });
}

function buildGenericCreditBucketRequirementGroups(owner, snapshotLines) {
  const seenGroupIds = new Set();
  const groups = [];

  for (let index = 0; index < (snapshotLines ?? []).length; index += 1) {
    const rawLine = normalizeWhitespace(stripChoiceListLine(snapshotLines[index]));
    if (!hasCreditBucketCue(rawLine) || shouldSkipCreditBucketLine(snapshotLines, index, rawLine)) {
      continue;
    }

    const sourceLineCandidates = splitCreditBucketSourceLines(
      buildCreditBucketSourceLine(owner, snapshotLines, index)
    );
    for (const sourceLine of sourceLineCandidates) {
      if (
        new RegExp(`\\b(?:choose|select)\\s+(?:${CHOICE_COUNT_WORDS_PATTERN}|\\d+)\\b`, "i").test(sourceLine) &&
        extractCourseCodesFromCreditBucketText(sourceLine).length >= 2
      ) {
        continue;
      }
      if (buildParentheticalSequenceChoiceCandidates([sourceLine], 0).length > 0) {
        continue;
      }
      if (looksLikeAdmissionDecisionNarrativeCreditBucket(sourceLine)) {
        continue;
      }

      const creditRange = parseRequirementCreditRange(sourceLine);
      if (!creditRange) {
        continue;
      }

      const programSpecificDescriptor = getProgramSpecificCreditBucketDescriptor(owner, sourceLine);
      const approvedListKey = getApprovedListKeyFromCreditBucketText(
        owner,
        sourceLine,
        programSpecificDescriptor
      );
      const genericDescriptors = programSpecificDescriptor
        ? []
        : getGenericCategoryOptionDescriptorsFromCreditBucketText(sourceLine);
      const hasApprovedList = !!approvedListKey || /\bapproved\b/i.test(sourceLine);
      const hasCourseListBucket =
        (/\bcredits?\s+from\b/i.test(sourceLine) ||
          /\bcredits?\b.{0,120}:\s*[A-Z]{2,8}&?\s+\d{3}/i.test(sourceLine)) &&
        extractCourseCodesFromCreditBucketText(sourceLine).length >= 2;
      const hasSubjectElectiveBucket =
        /\bcredits?\s+from\b.{0,120}\belectives?\b/i.test(sourceLine) ||
        /\bcourses?\s+with\s+an?\b.{0,60}\bprefix\b/i.test(sourceLine) ||
        /\bfree electives?\b/i.test(sourceLine) ||
        /\b(?:credits?|\d+(?:\.\d+)?\s*-\s*credits?)\b.{0,120}\bintroductory\s+[A-Z]{2,8}\s+classes?\b/i.test(sourceLine);
      const hasLanguageLevelBucket =
        /\bcredits?\s+(?:primary|secondary)?\s*language\b/i.test(sourceLine) ||
        /\bcomplete\b.{0,100}\b(?:second|third|fourth)[-\s]?year\s+level\b/i.test(sourceLine);
      if (
        !programSpecificDescriptor &&
        !genericDescriptors.length &&
        !hasApprovedList &&
        !hasCourseListBucket &&
        !hasSubjectElectiveBucket &&
        !hasLanguageLevelBucket
      ) {
        continue;
      }
      const sourceLineCourseCodeCount = extractCourseCodesFromCreditBucketText(sourceLine).length;
      if (
        sourceLineCourseCodeCount > 0 &&
        !programSpecificDescriptor &&
        !startsWithCategoryCreditCue(sourceLine) &&
        !hasApprovedList &&
        !hasCourseListBucket
      ) {
        continue;
      }

      const options = hasCourseListBucket
        ? buildCourseRequirementOptionsFromCreditBucket(owner, sourceLine, creditRange)
        : buildCategoryRequirementOptionsFromCreditBucket(
            owner,
            sourceLine,
            creditRange,
            programSpecificDescriptor
          );
      const labelDescriptor = programSpecificDescriptor ?? genericDescriptors[0] ?? null;
      const creditText =
        creditRange.maxCredits && creditRange.maxCredits !== creditRange.minCredits
          ? `${creditRange.minCredits}-${creditRange.maxCredits}`
          : String(creditRange.minCredits);
      const label = labelDescriptor
        ? `${creditText} credits of ${labelDescriptor.longLabel}`
        : normalizeWhitespace(sourceLine.replace(/^[^A-Za-z0-9]+/, ""));
      const groupId = `${owner.ownerId}:requirement-group:credit-bucket-${slugify(
        `${label}-${creditRange.minCredits}-${creditRange.maxCredits ?? "open"}`
      )}`;
      if (seenGroupIds.has(groupId)) {
        continue;
      }

      const group = buildParsedRequirementGroup({
        id: groupId,
        label,
        category: programSpecificDescriptor
          ? "program-approved-credit-bucket"
          : genericDescriptors[0]?.category?.toLowerCase() ?? "approved-credit-bucket",
        subcategory: approvedListKey,
        requirementType: "choose_credits",
        minCredits: creditRange.minCredits,
        maxCredits: creditRange.maxCredits,
        sourceHeading: sourceLine,
        sourceRowText: sourceLine,
        detectedOptionCue: "credit bucket",
        approvedListKey,
        canCreatePlaceholder: true,
        programSpecific: !!programSpecificDescriptor,
        notes: [
          programSpecificDescriptor
            ? "Program-specific approved bucket; do not satisfy with generic Area of Inquiry category matching unless an approved filter also backs the course."
            : "Credit bucket placeholder extracted from source text.",
        ],
        options,
      });

      seenGroupIds.add(groupId);
      groups.push(group);
    }
  }

  return groups;
}

function getCreditBucketDedupeKey(group) {
  if (group?.requirementType !== "choose_credits") {
    return null;
  }

  const sourceText = group.sourceRowText ?? group.sourceHeading ?? group.label ?? "";
  const normalizedText = normalizeMatcherText(sourceText).slice(0, 100);
  if (!normalizedText) {
    return null;
  }

  return [
    normalizedText,
    group.minCredits ?? "",
    group.maxCredits ?? "",
  ].join("::");
}

function requirementGroupHasProgramSpecificCategoryOption(group) {
  return (
    Boolean(group?.programSpecific && group?.approvedListKey) ||
    (group?.options ?? []).some((option) => option?.categoryOption?.programSpecific)
  );
}

function choosePreferredRequirementGroup(existing, candidate) {
  const existingHasProgramSpecificCategoryOption =
    requirementGroupHasProgramSpecificCategoryOption(existing);
  const candidateHasProgramSpecificCategoryOption =
    requirementGroupHasProgramSpecificCategoryOption(candidate);
  if (candidateHasProgramSpecificCategoryOption !== existingHasProgramSpecificCategoryOption) {
    return candidateHasProgramSpecificCategoryOption ? candidate : existing;
  }

  const existingHasCategoryOption = (existing?.options ?? []).some((option) => option?.categoryOption);
  const candidateHasCategoryOption = (candidate?.options ?? []).some((option) => option?.categoryOption);
  if (
    candidateHasCategoryOption !== existingHasCategoryOption &&
    (candidateHasProgramSpecificCategoryOption || existingHasProgramSpecificCategoryOption)
  ) {
    return candidateHasCategoryOption ? candidate : existing;
  }

  if (
    !!candidate?.approvedListKey !== !!existing?.approvedListKey &&
    (candidateHasProgramSpecificCategoryOption || existingHasProgramSpecificCategoryOption)
  ) {
    return candidate?.approvedListKey ? candidate : existing;
  }

  if (
    !!candidate?.canCreatePlaceholder !== !!existing?.canCreatePlaceholder &&
    (candidateHasProgramSpecificCategoryOption || existingHasProgramSpecificCategoryOption)
  ) {
    return candidate?.canCreatePlaceholder ? candidate : existing;
  }

  const existingOptionCount = existing?.options?.length ?? 0;
  const candidateOptionCount = candidate?.options?.length ?? 0;
  if (candidateOptionCount !== existingOptionCount) {
    return candidateOptionCount > existingOptionCount ? candidate : existing;
  }

  return existing;
}

function dedupeCreditBucketRequirementGroups(groups) {
  const keyIndexes = new Map();
  const result = [];

  for (const group of groups) {
    const key = getCreditBucketDedupeKey(group);
    if (!key) {
      result.push(group);
      continue;
    }

    if (!keyIndexes.has(key)) {
      keyIndexes.set(key, result.length);
      result.push(group);
      continue;
    }

    const resultIndex = keyIndexes.get(key);
    result[resultIndex] = choosePreferredRequirementGroup(result[resultIndex], group);
  }

  return result;
}

function getRequirementOptionCourseCodeSet(option) {
  return new Set(
    [
      ...(option?.uwCourses ?? []),
      ...(option?.equivalentUwCourseCodes ?? []),
    ].map(normalizeCourseCode).filter(Boolean)
  );
}

function suppressChoiceGroupsCoveredByCreditBuckets(groups) {
  const creditBucketGroups = (groups ?? []).filter((group) => group.requirementType === "choose_credits");
  const creditBucketOptionCodeSets = creditBucketGroups
    .filter((group) => group.requirementType === "choose_credits")
    .flatMap((group) => group.options ?? [])
    .map(getRequirementOptionCourseCodeSet)
    .filter((codeSet) => codeSet.size > 1);
  const creditBucketGroupCodeSets = creditBucketGroups
    .map((group) => {
      const codeSet = new Set();
      for (const option of group.options ?? []) {
        for (const courseCode of getRequirementOptionCourseCodeSet(option)) {
          codeSet.add(courseCode);
        }
      }
      return codeSet;
    })
    .filter((codeSet) => codeSet.size > 1);
  const creditBucketCategorySetsBySource = creditBucketGroups
    .map((group) => {
      const sourceKey = normalizeMatcherText(group.sourceRowText ?? group.sourceHeading ?? group.label ?? "");
      const categorySet = new Set(
        (group.options ?? [])
          .map((option) =>
            normalizeWhitespace(
              option.categoryOption?.sourceCategoryCode ?? option.categoryOption?.category ?? ""
            ).toUpperCase()
          )
          .filter(Boolean)
      );
      return { sourceKey, categorySet };
    })
    .filter((entry) => entry.sourceKey && entry.categorySet.size > 0);

  if (
    !creditBucketOptionCodeSets.length &&
    !creditBucketGroupCodeSets.length &&
    !creditBucketCategorySetsBySource.length
  ) {
    return groups;
  }

  return (groups ?? []).filter((group) => {
    if (!["choose_one", "choose_n"].includes(group.requirementType)) {
      return true;
    }
    const groupSourceKey = normalizeMatcherText(group.sourceRowText ?? group.sourceHeading ?? group.label ?? "");
    const groupCategorySet = new Set(
      (group.options ?? [])
        .map((option) =>
          normalizeWhitespace(
            option.categoryOption?.sourceCategoryCode ?? option.categoryOption?.category ?? ""
          ).toUpperCase()
        )
        .filter(Boolean)
    );
    if (
      groupSourceKey &&
      groupCategorySet.size > 0 &&
      creditBucketCategorySetsBySource.some(
        (bucket) =>
          bucket.sourceKey === groupSourceKey &&
          [...groupCategorySet].every((category) => bucket.categorySet.has(category))
      )
    ) {
      return false;
    }

    const groupCodeSet = new Set(
      (group.options ?? [])
        .flatMap((option) => [...getRequirementOptionCourseCodeSet(option)])
        .map(normalizeCourseCode)
        .filter(Boolean)
    );
    if (!groupCodeSet.size) {
      return true;
    }

    return !creditBucketOptionCodeSets.some((bucketCodeSet) => {
      if (bucketCodeSet.size !== groupCodeSet.size) {
        return false;
      }
      return [...groupCodeSet].every((courseCode) => bucketCodeSet.has(courseCode));
    }) && !creditBucketGroupCodeSets.some((bucketCodeSet) => {
      if (bucketCodeSet.size <= groupCodeSet.size) {
        return false;
      }
      return [...groupCodeSet].every((courseCode) => bucketCodeSet.has(courseCode));
    });
  });
}

function findSnapshotLineIndexForRequirementGroup(group, snapshotLines) {
  const sourceText = normalizeWhitespace(
    group?.sourceRowText ?? group?.sourceHeading ?? group?.label ?? ""
  );
  const normalizedSourceText = normalizeMatcherText(sourceText);
  if (normalizedSourceText) {
    const exactOrPrefixIndex = (snapshotLines ?? []).findIndex((line) => {
      const normalizedLine = normalizeMatcherText(stripChoiceListLine(line));
      return (
        normalizedLine === normalizedSourceText ||
        (normalizedLine.length >= 40 && normalizedSourceText.startsWith(normalizedLine)) ||
        (normalizedSourceText.length >= 40 && normalizedLine.startsWith(normalizedSourceText))
      );
    });
    if (exactOrPrefixIndex >= 0) {
      return exactOrPrefixIndex;
    }
  }

  const optionCourseCodes = uniqueInOrder(
    (group?.options ?? [])
      .flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
        ...(option.displayCourseCodes ?? []),
      ])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
  if (optionCourseCodes.length < 2) {
    return -1;
  }
  const getCourseCodeSearchKeys = (courseCode) => {
    const normalizedCode = normalizeCourseCode(courseCode);
    const compactCode = normalizedCode.replace(/\s+/g, "");
    return uniqueInOrder([normalizedCode, compactCode].filter(Boolean));
  };
  const firstOptionCourseCodeKeys = getCourseCodeSearchKeys(optionCourseCodes[0]);
  const remainingOptionCourseCodeKeys = optionCourseCodes.slice(1).map(getCourseCodeSearchKeys);
  const includesAnyCourseCodeKey = (courseCodes, searchKeys) => {
    const availableKeys = new Set(
      courseCodes.flatMap((courseCode) => getCourseCodeSearchKeys(courseCode))
    );
    return searchKeys.some((searchKey) => availableKeys.has(searchKey));
  };
  const sourceLooksLikeSplitOrChoice = /\bor\b/i.test(
    `${group?.sourceHeading ?? ""} ${group?.sourceRowText ?? ""} ${group?.detectedOptionCue ?? ""}`
  );
  if (sourceLooksLikeSplitOrChoice) {
    const splitChoiceIndex = (snapshotLines ?? []).findIndex((line, index) => {
      const normalizedLine = normalizeWhitespace(stripChoiceListLine(line));
      if (!/\bor\s*$/i.test(normalizedLine)) {
        return false;
      }
      const currentLineCodes = extractCourseCodesFromLine(normalizedLine).map((courseCode) =>
        normalizeCourseCode(courseCode)
      );
      if (!includesAnyCourseCodeKey(currentLineCodes, firstOptionCourseCodeKeys)) {
        return false;
      }
      const nearbyCodes = (snapshotLines ?? [])
        .slice(index + 1, Math.min((snapshotLines ?? []).length, index + 4))
        .flatMap((nearbyLine) => extractCourseCodesFromLine(stripChoiceListLine(nearbyLine)))
        .map((courseCode) => normalizeCourseCode(courseCode));
      return remainingOptionCourseCodeKeys.some((searchKeys) =>
        includesAnyCourseCodeKey(nearbyCodes, searchKeys)
      );
    });
    if (splitChoiceIndex >= 0) {
      return splitChoiceIndex;
    }
  }

  return (snapshotLines ?? []).findIndex((line, index) => {
    const currentLineCodes = extractCourseCodesFromLine(stripChoiceListLine(line)).map((courseCode) =>
      normalizeCourseCode(courseCode)
    );
    if (!includesAnyCourseCodeKey(currentLineCodes, firstOptionCourseCodeKeys)) {
      return false;
    }

    const nearbyCodes = (snapshotLines ?? [])
      .slice(index, Math.min((snapshotLines ?? []).length, index + 4))
      .flatMap((nearbyLine) => extractCourseCodesFromLine(stripChoiceListLine(nearbyLine)))
      .map((courseCode) => normalizeCourseCode(courseCode));
    return remainingOptionCourseCodeKeys.some((searchKeys) =>
      includesAnyCourseCodeKey(nearbyCodes, searchKeys)
    );
  });
}

function findNearestSupplementalSourceMarker(snapshotLines, lineIndex) {
  if (lineIndex < 0) {
    return null;
  }

  for (let index = lineIndex; index >= 0; index -= 1) {
    const line = normalizeWhitespace(stripChoiceListLine(snapshotLines?.[index] ?? ""));
    if (/^\[Supplemental official source\]/i.test(line)) {
      return line;
    }
  }

  return null;
}

function isRequirementGroupUnderSupportCourseList(snapshotLines, lineIndex) {
  if (lineIndex < 0) {
    return false;
  }

  for (let index = lineIndex; index >= Math.max(0, lineIndex - 28); index -= 1) {
    const line = normalizeWhitespace(stripChoiceListLine(snapshotLines?.[index] ?? ""));
    if (!line) {
      continue;
    }
    if (/^\[Supplemental official source\]/i.test(line)) {
      return false;
    }
    if (
      index === lineIndex &&
      /\b(?:requirements?|option courses?|credits?)\b/i.test(line)
    ) {
      return false;
    }
    if (
      /\b(?:requirements?|coursework requirements?|core courses?|degree requirements?)\b/i.test(line) &&
      !/\belectives?\s+list\b/i.test(line)
    ) {
      return false;
    }
    if (/\b(?:electives?|approved courses?)\s+list\b/i.test(line)) {
      return true;
    }
  }

  return false;
}

function isPathwaySupplementalSourceMarker(line) {
  return /^\[Supplemental official source\]/i.test(line) && PATHWAY_LABEL_CUE_PATTERN.test(line);
}

function groupMatchesSupplementalPathwayScope(owner, markerLine) {
  if (!isPathwaySupplementalSourceMarker(markerLine)) {
    return true;
  }

  return Boolean(owner?.pathwayId && lineMatchesSelectedPathwayIdentity(owner, markerLine));
}

function filterRequirementGroupsBySupplementalPathwayScope(owner, groups, snapshotLines) {
  return (groups ?? []).filter((group) => {
    const lineIndex = findSnapshotLineIndexForRequirementGroup(group, snapshotLines);
    const markerLine = findNearestSupplementalSourceMarker(snapshotLines, lineIndex);
    if (!markerLine && isRequirementGroupUnderSupportCourseList(snapshotLines, lineIndex)) {
      return false;
    }
    return !markerLine || groupMatchesSupplementalPathwayScope(owner, markerLine);
  });
}

function buildParsedRequirementGroups(owner, parsedCourseCodes, snapshotLines) {
  return uniqueBy(
    dedupeCreditBucketRequirementGroups(
      suppressChoiceGroupsCoveredByCreditBuckets(
        filterRequirementGroupsBySupplementalPathwayScope(
          owner,
          [
            ...buildSourceDerivedSectionedCourseRequirementGroups(owner, snapshotLines),
            ...buildSectionedOptionRequirementGroups(owner, snapshotLines),
            ...buildSplitEitherOrRequirementGroups(owner, parsedCourseCodes, snapshotLines),
            ...buildGenericCreditBucketRequirementGroups(owner, snapshotLines),
            ...buildGenericSequenceChoiceRequirementGroups(owner, parsedCourseCodes, snapshotLines),
            ...buildGenericChoiceRequirementGroups(owner, parsedCourseCodes, snapshotLines),
          ],
          snapshotLines
        )
      )
    ),
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
    "course",
    "courses",
    "curriculum",
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

const PROGRAM_ACRONYM_STOPWORDS = new Set([
  "a",
  "and",
  "b",
  "bachelor",
  "bachelors",
  "ba",
  "bothell",
  "bs",
  "campus",
  "curriculum",
  "degree",
  "for",
  "in",
  "major",
  "of",
  "official",
  "overview",
  "page",
  "program",
  "requirements",
  "s",
  "seattle",
  "tacoma",
  "the",
  "to",
  "undergraduate",
  "university",
  "uw",
  "washington",
  "with",
]);
const EXCLUDED_PROGRAM_ACRONYM_TOKENS = new Set([
  "aa",
  "aab",
  "aas",
  "ba",
  "bas",
  "bba",
  "bfa",
  "bs",
  "bse",
  "bsn",
  "ma",
  "mba",
  "mfa",
  "ms",
]);

function getOwnerProgramAcronymTokens(entry) {
  const rawTitle = normalizeWhitespace(getPrimaryMajorTitle(entry) || entry?.ownerTitle || "");
  if (!rawTitle) {
    return [];
  }

  const explicitAcronyms = [...rawTitle.matchAll(/\(([A-Z][A-Z0-9&\s/-]{1,12})\)/g)]
    .map((match) => normalizeMatcherText(match[1]).replace(/\s+/g, ""))
    .filter(
      (token) =>
        token.length >= 2 &&
        token.length <= 8 &&
        !EXCLUDED_PROGRAM_ACRONYM_TOKENS.has(token)
    );
  const titleWords = normalizeMatcherText(rawTitle)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 2 &&
        !PROGRAM_ACRONYM_STOPWORDS.has(token) &&
        !EXCLUDED_PROGRAM_ACRONYM_TOKENS.has(token)
    );
  const titleAcronym = titleWords.map((token) => token[0]).join("");

  return uniqueSorted(
    [...explicitAcronyms, titleAcronym].filter(
      (token) =>
        token.length >= 2 &&
        token.length <= 8 &&
        !EXCLUDED_PROGRAM_ACRONYM_TOKENS.has(token)
    )
  );
}

function getNormalizedTokenMatches(normalizedText, tokens) {
  const textTokens = new Set(String(normalizedText ?? "").split(/\s+/).filter(Boolean));
  return uniqueSorted((tokens ?? []).filter((token) => textTokens.has(token)));
}

function getOwnerProgramAcronymMatches(entry, normalizedText) {
  return getNormalizedTokenMatches(normalizedText, getOwnerProgramAcronymTokens(entry));
}

function findDifferentOwnerAcronymDepartmentalBoundaryIndex(entry, lines) {
  const ownerAcronyms = new Set(getOwnerProgramAcronymTokens(entry));
  if (!ownerAcronyms.size) {
    return -1;
  }

  for (let index = 1; index < (lines ?? []).length; index += 1) {
    const line = normalizeWhitespace(lines[index]);
    const boundaryMatch = line.match(
      /^([A-Z][A-Z0-9&]{1,8})\s+Departmental\s+Degree\s+requirements?\b/i
    );
    if (!boundaryMatch) {
      continue;
    }

    const boundaryAcronym = normalizeMatcherText(boundaryMatch[1]).replace(/\s+/g, "");
    if (boundaryAcronym && !ownerAcronyms.has(boundaryAcronym)) {
      return index;
    }
  }

  return -1;
}

function hasOwnerAcronymDepartmentalBoundary(entry, lines) {
  const ownerAcronyms = new Set(getOwnerProgramAcronymTokens(entry));
  if (!ownerAcronyms.size) {
    return false;
  }

  return (lines ?? []).some((line) => {
    const boundaryMatch = normalizeWhitespace(line).match(
      /^([A-Z][A-Z0-9&]{1,8})\s+Departmental\s+Degree\s+requirements?\b/i
    );
    if (!boundaryMatch) {
      return false;
    }

    const boundaryAcronym = normalizeMatcherText(boundaryMatch[1]).replace(/\s+/g, "");
    return ownerAcronyms.has(boundaryAcronym);
  });
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
  let closestSectionStartIndex = null;

  for (let index = anchorIndex; index >= backwardLimit; index -= 1) {
    const line = normalizeWhitespace(lines[index]);
    if (!line) {
      continue;
    }
    if (isLikelyOwnerHtmlSectionStartLine(entry, line)) {
      if (closestSectionStartIndex === null) {
        closestSectionStartIndex = index;
      }
      if (/^Program of Study:/i.test(line)) {
        sectionStartIndex = index;
        break;
      }
    }
    if (/^Back to Top\b/i.test(line)) {
      break;
    }
  }

  if (sectionStartIndex === null) {
    sectionStartIndex = closestSectionStartIndex;
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

const PATHWAY_SCOPE_IDENTITY_STOPWORDS = new Set([
  "and",
  "ba",
  "bachelor",
  "bs",
  "certificate",
  "concentration",
  "degree",
  "major",
  "of",
  "option",
  "pathway",
  "program",
  "route",
  "track",
  "with",
]);

function stripPathwayHeadingPrefix(line) {
  return normalizeTransferPlannerText(line)
    .replace(/^[A-Z]\.\s+/i, "")
    .replace(/^\(?\d+[\).]\s+/i, "")
    .replace(/^(?:[ivxlcdm]+)[\).]\s+/i, "")
    .trim();
}

function getSelectedPathwayScopeLabels(entry) {
  if (!entry?.pathwayId) {
    return [];
  }

  const majorTitle = getPrimaryMajorTitle(entry);
  const pathwayIdLabel = String(entry.pathwayId).replace(/[-_]+/g, " ");
  const rawLabels = [
    pathwayIdLabel,
    normalizeTransferPlannerSemanticPathwayLabel(majorTitle, entry.ownerTitle),
    normalizeTransferPlannerSemanticPathwayLabel(majorTitle, entry.sourceLabel),
    normalizeTransferPlannerSemanticPathwayLabel(majorTitle, entry.label),
  ];
  const pathwayIdTokens = normalizeMatcherText(pathwayIdLabel)
    .split(" ")
    .filter((token) => token.length >= 3 && !PATHWAY_SCOPE_IDENTITY_STOPWORDS.has(token));

  return uniqueInOrder(
    rawLabels
      .map((label) => stripPathwayHeadingPrefix(label))
      .filter((label) => {
        const tokens = normalizeMatcherText(label)
          .split(" ")
          .filter(
            (token) =>
              token.length >= 3 && !PATHWAY_SCOPE_IDENTITY_STOPWORDS.has(token)
          );
        if (!tokens.length) {
          return false;
        }

        return (
          PATHWAY_LABEL_CUE_PATTERN.test(label) ||
          tokens.some((token) => pathwayIdTokens.includes(token))
        );
      })
  );
}

function getSelectedPathwayScopeTokenGroups(entry) {
  return uniqueBy(
    getSelectedPathwayScopeLabels(entry)
      .map((label) =>
        normalizeMatcherText(label)
          .split(" ")
          .filter(
            (token) =>
              token.length >= 3 && !PATHWAY_SCOPE_IDENTITY_STOPWORDS.has(token)
          )
      )
      .filter((tokens) => tokens.length > 0)
      .sort((left, right) => right.length - left.length),
    (tokens) => tokens.join(" ")
  );
}

function getStrictSelectedPathwayScopeLabels(entry) {
  if (!entry?.pathwayId) {
    return [];
  }

  const majorTitle = getPrimaryMajorTitle(entry);
  const pathwayIdLabel = String(entry.pathwayId).replace(/[-_]+/g, " ");
  const rawLabels = [
    pathwayIdLabel,
    normalizeTransferPlannerSemanticPathwayLabel(majorTitle, entry.ownerTitle),
  ];

  return uniqueInOrder(
    rawLabels
      .map((label) => stripPathwayHeadingPrefix(label))
      .filter((label) => {
        const tokens = normalizeMatcherText(label)
          .split(" ")
          .filter(
            (token) =>
              token.length >= 3 && !PATHWAY_SCOPE_IDENTITY_STOPWORDS.has(token)
          );
        return tokens.length > 0 || PATHWAY_LABEL_CUE_PATTERN.test(label);
      })
  );
}

function getStrictSelectedPathwayScopeTokenGroups(entry) {
  return uniqueBy(
    getStrictSelectedPathwayScopeLabels(entry)
      .map((label) =>
        normalizeMatcherText(label)
          .split(" ")
          .filter(
            (token) =>
              token.length >= 3 && !PATHWAY_SCOPE_IDENTITY_STOPWORDS.has(token)
          )
      )
      .filter((tokens) => tokens.length > 0)
      .sort((left, right) => right.length - left.length),
    (tokens) => tokens.join(" ")
  );
}

function normalizedLineContainsToken(normalizedLine, token) {
  return new RegExp(`\\b${escapeRegex(token)}\\b`, "i").test(normalizedLine);
}

function lineMatchesSelectedPathwayIdentity(entry, line) {
  const normalizedLine = normalizeMatcherText(line);
  if (!normalizedLine) {
    return false;
  }

  return getSelectedPathwayScopeTokenGroups(entry).some((tokens) => {
    const tokenMatches = tokens.filter((token) =>
      normalizedLineContainsToken(normalizedLine, token)
    ).length;
    const requiredMatches = tokens.length <= 2 ? tokens.length : 2;
    return tokenMatches >= Math.max(1, requiredMatches);
  });
}

function lineMatchesStrictSelectedPathwayIdentity(entry, line) {
  const normalizedLine = normalizeMatcherText(line);
  if (!normalizedLine) {
    return false;
  }

  return getStrictSelectedPathwayScopeTokenGroups(entry).some((tokens) => {
    const tokenMatches = tokens.filter((token) =>
      normalizedLineContainsToken(normalizedLine, token)
    ).length;
    const requiredMatches = tokens.length <= 2 ? tokens.length : 2;
    return tokenMatches >= Math.max(1, requiredMatches);
  });
}

function isLikelyPathwayChoiceContextLine(line) {
  const normalized = normalizeTransferPlannerText(line);
  if (
    !normalized ||
    extractCourseCodesFromLine(normalized).length > 0 ||
    normalized.split(/\s+/).length > 24
  ) {
    return false;
  }

  return /\b(?:choose|select|formal|options?|tracks?|routes?|pathways?|concentrations?)\b/i.test(
    normalized
  );
}

function isLikelyPeerPathwayHtmlSectionStartLine(line) {
  const normalized = stripPathwayHeadingPrefix(line);
  const normalizedMatcherText = normalizeMatcherText(normalized);
  if (
    !normalizedMatcherText ||
    NOISY_SOURCE_LINE_PATTERN.test(normalized) ||
    extractCourseCodesFromLine(normalized).length > 0 ||
    PATHWAY_SECTION_BOUNDARY_PATTERN.test(normalized)
  ) {
    return false;
  }

  const wordCount = normalizedMatcherText.split(" ").length;
  if (wordCount > 12) {
    return false;
  }

  if (/\b(?:choose|select|following|formal)\b/i.test(normalized)) {
    return false;
  }

  const startsWithEnumerator = /^[A-Z]\.\s+|^\(?\d+[\).]\s+/i.test(
    normalizeTransferPlannerText(line)
  );
  const hasPathwayCue = PATHWAY_LABEL_CUE_PATTERN.test(normalized);
  const isUppercaseHeading =
    /[A-Z]/.test(normalized) && normalized === normalized.toUpperCase();

  return Boolean(
    hasPathwayCue ||
      startsWithEnumerator ||
      (isUppercaseHeading && wordCount <= 8)
  );
}

const BARE_PATHWAY_SECTION_SUBHEADING_PATTERN =
  /\b(?:admission|admissions|application|apply|capstone|checklist|core|course|courses|coursework|credits?|curriculum|degree|electives?|internship|major|minor|overview|prereq|prerequisite|program|requirements?|sample|schedule|student|students|worksheet)\b/i;

function isLikelyBarePathwayHtmlSectionHeading(line) {
  const normalized = stripPathwayHeadingPrefix(line);
  const matcherText = normalizeMatcherText(normalized);
  if (
    !matcherText ||
    NOISY_SOURCE_LINE_PATTERN.test(normalized) ||
    extractCourseCodesFromLine(normalized).length > 0 ||
    PATHWAY_SECTION_BOUNDARY_PATTERN.test(normalized) ||
    PATHWAY_LABEL_CUE_PATTERN.test(normalized) ||
    BARE_PATHWAY_SECTION_SUBHEADING_PATTERN.test(normalized) ||
    /[.;:]$/.test(normalized)
  ) {
    return false;
  }

  const words = matcherText.split(" ").filter(Boolean);
  if (!words.length || words.length > 5) {
    return false;
  }

  const visibleWords = normalized.split(/\s+/).filter(Boolean);
  const meaningfulVisibleWords = visibleWords.filter((word) => !/^(?:and|&|of|the)$/i.test(word));
  if (!meaningfulVisibleWords.length) {
    return false;
  }

  return meaningfulVisibleWords.every((word) =>
    /^[A-Z0-9&][A-Za-z0-9&/()'-]*$/.test(word)
  );
}

function lineLooksLikeSiblingBarePathwaySection(entry, line) {
  return (
    entry?.pathwayId &&
    isLikelyBarePathwayHtmlSectionHeading(line) &&
    !lineMatchesSelectedPathwayIdentity(entry, line)
  );
}

function isLikelySelectedPathwayHtmlSectionStartLine(entry, line) {
  if (!entry?.pathwayId || !lineMatchesSelectedPathwayIdentity(entry, line)) {
    return false;
  }

  const normalized = stripPathwayHeadingPrefix(line);
  const normalizedMatcherText = normalizeMatcherText(normalized);
  if (
    !normalizedMatcherText ||
    NOISY_SOURCE_LINE_PATTERN.test(normalized) ||
    extractCourseCodesFromLine(normalized).length > 0 ||
    PATHWAY_SECTION_BOUNDARY_PATTERN.test(normalized)
  ) {
    return false;
  }

  const wordCount = normalizedMatcherText.split(" ").length;
  if (wordCount > 12) {
    return false;
  }

  const startsWithEnumerator = /^[A-Z]\.\s+|^\(?\d+[\).]\s+/i.test(
    normalizeTransferPlannerText(line)
  );
  const hasPathwayCue = PATHWAY_LABEL_CUE_PATTERN.test(normalized);
  const isUppercaseHeading =
    /[A-Z]/.test(normalized) && normalized === normalized.toUpperCase();

  return Boolean(
    hasPathwayCue ||
      startsWithEnumerator ||
      isUppercaseHeading ||
      wordCount <= 6 ||
      isLikelyBarePathwayHtmlSectionHeading(line)
  );
}

function parsedMentionsSelectedPathwaySection(entry, parsed) {
  return (parsed?.snapshotLines ?? []).some((line) =>
    isLikelySelectedPathwayHtmlSectionStartLine(entry, line)
  );
}

function isPathwayHtmlSectionSiblingStart(entry, line) {
  return (
    (isLikelyPeerPathwayHtmlSectionStartLine(line) ||
      lineLooksLikeSiblingBarePathwaySection(entry, line)) &&
    !isLikelySelectedPathwayHtmlSectionStartLine(entry, line)
  );
}

function findPathwayHtmlSectionEndIndex(entry, lines, selectedStartIndex) {
  let endIndex = Math.min(lines.length - 1, selectedStartIndex + 220);
  const forwardLimit = Math.min(lines.length - 1, selectedStartIndex + 220);

  for (let index = selectedStartIndex + 1; index <= forwardLimit; index += 1) {
    const line = normalizeWhitespace(lines[index]);
    if (!line) {
      continue;
    }

    if (isPathwayHtmlSectionSiblingStart(entry, line)) {
      endIndex = Math.max(selectedStartIndex, index - 1);
      break;
    }

    if (
      index > selectedStartIndex + 2 &&
      (PATHWAY_SECTION_BOUNDARY_PATTERN.test(line) ||
        /^Back to Top\b/i.test(line) ||
        (HTML_SECTION_BOUNDARY_LINE_PATTERN.test(line) &&
          !isLikelySelectedPathwayHtmlSectionStartLine(entry, line)))
    ) {
      endIndex = Math.max(selectedStartIndex, index - 1);
      break;
    }
  }

  return endIndex;
}

function findPathwayHtmlSectionStartIndex(entry, lines, selectedStartIndex) {
  let startIndex = selectedStartIndex;
  for (
    let index = selectedStartIndex - 1;
    index >= Math.max(0, selectedStartIndex - 3);
    index -= 1
  ) {
    const line = lines[index];
    if (
      extractCourseCodesFromLine(line).length > 0 ||
      isLikelyPeerPathwayHtmlSectionStartLine(line)
    ) {
      break;
    }
    if (isLikelyPathwayChoiceContextLine(line)) {
      startIndex = index;
      break;
    }
  }

  return startIndex;
}

function buildNestedPathwayHtmlSectionScope(entry, lines, peerStartIndexes) {
  const strictSelectedStartIndexes = peerStartIndexes
    .filter(
      (candidate) =>
        candidate.selected && lineMatchesStrictSelectedPathwayIdentity(entry, lines[candidate.index])
    )
    .map((candidate) => candidate.index);

  if (!strictSelectedStartIndexes.length) {
    return null;
  }

  for (const selectedStartIndex of strictSelectedStartIndexes) {
    const selectedEndIndex = findPathwayHtmlSectionEndIndex(entry, lines, selectedStartIndex);
    const selectedLines = lines.slice(selectedStartIndex, selectedEndIndex + 1);
    if (!selectedLines.some((line) => extractCourseCodesFromLine(line).length > 0)) {
      continue;
    }

    for (
      let parentStartIndex = selectedStartIndex - 1;
      parentStartIndex >= Math.max(0, selectedStartIndex - 220);
      parentStartIndex -= 1
    ) {
      const parentLine = lines[parentStartIndex];
      const isLooseSelectedParent =
        isLikelySelectedPathwayHtmlSectionStartLine(entry, parentLine) &&
        !lineMatchesStrictSelectedPathwayIdentity(entry, parentLine);
      if (!isLooseSelectedParent) {
        continue;
      }

      const firstNestedPeer = peerStartIndexes
        .map((candidate) => candidate.index)
        .filter((index) => index > parentStartIndex)
        .sort((left, right) => left - right)[0];
      const parentEndIndex =
        firstNestedPeer && firstNestedPeer <= selectedStartIndex
          ? firstNestedPeer - 1
          : selectedStartIndex - 1;
      const parentLines = lines.slice(parentStartIndex, parentEndIndex + 1);
      if (!parentLines.some((line) => extractCourseCodesFromLine(line).length > 0)) {
        continue;
      }

      return {
        startIndex: parentStartIndex,
        endIndex: selectedEndIndex,
        lines: uniqueInOrder([...parentLines, ...selectedLines]),
      };
    }
  }

  return null;
}

function findPathwayHtmlSectionRange(entry, lines) {
  if (!entry?.pathwayId || !Array.isArray(lines) || lines.length < 4) {
    return null;
  }

  const peerStartIndexes = lines
    .map((line, index) => ({
      index,
      selected: isLikelySelectedPathwayHtmlSectionStartLine(entry, line),
      peer:
        isLikelyPeerPathwayHtmlSectionStartLine(line) ||
        lineLooksLikeSiblingBarePathwaySection(entry, line),
    }))
    .filter((candidate) => candidate.selected || candidate.peer);
  const selectedStartIndexes = peerStartIndexes
    .filter((candidate) => candidate.selected)
    .map((candidate) => candidate.index);
  const hasSiblingPathwaySection = peerStartIndexes.some((candidate) => !candidate.selected);

  if (!selectedStartIndexes.length || !hasSiblingPathwaySection) {
    return null;
  }

  const nestedScope = buildNestedPathwayHtmlSectionScope(entry, lines, peerStartIndexes);
  if (nestedScope) {
    return nestedScope;
  }

  for (const selectedStartIndex of selectedStartIndexes) {
    const endIndex = findPathwayHtmlSectionEndIndex(entry, lines, selectedStartIndex);
    const sectionLines = lines.slice(selectedStartIndex, endIndex + 1);
    if (!sectionLines.some((line) => extractCourseCodesFromLine(line).length > 0)) {
      continue;
    }
    const startIndex = findPathwayHtmlSectionStartIndex(entry, lines, selectedStartIndex);

    return {
      startIndex,
      endIndex,
    };
  }

  return null;
}

function shouldUseColumnMajorPdfOrdering(segments) {
  if (!Array.isArray(segments) || segments.length < 12) {
    return null;
  }

  const sortedX = Array.from(new Set(
    segments
      .map((segment) => Math.round(Number(segment.x ?? 0)))
      .filter((value) => Number.isFinite(value))
  )).sort((left, right) => left - right);
  if (sortedX.length < 4) {
    return null;
  }

  let split = null;
  for (let index = 1; index < sortedX.length; index += 1) {
    const gap = sortedX[index] - sortedX[index - 1];
    if (gap < 72) {
      continue;
    }
    if (!split || gap > split.gap) {
      split = {
        gap,
        boundary: (sortedX[index] + sortedX[index - 1]) / 2,
      };
    }
  }
  if (!split) {
    return null;
  }

  const leftSegments = segments.filter((segment) => segment.x < split.boundary);
  const rightSegments = segments.filter((segment) => segment.x >= split.boundary);
  if (leftSegments.length < 5 || rightSegments.length < 5) {
    return null;
  }

  const numberedHeadingPattern = /^\s*\d+\)\s+[A-Za-z][^()]{2,80}\([A-Z& ]{2,10}\)/;
  const bareChecklistPattern =
    /^\s*(?:[^\w\d]{1,10}\s*)?\d{3}[A-Za-z]?\s*\(\d+(?:\.\d+)?\)/iu;
  const countMatches = (items, pattern) =>
    items.filter((segment) => pattern.test(normalizeWhitespace(segment.text))).length;
  const leftHeadingCount = countMatches(leftSegments, numberedHeadingPattern);
  const rightHeadingCount = countMatches(rightSegments, numberedHeadingPattern);
  const checklistCount = countMatches(segments, bareChecklistPattern);

  if (leftHeadingCount < 1 || rightHeadingCount < 1 || leftHeadingCount + rightHeadingCount < 3) {
    return null;
  }
  if (checklistCount < 6) {
    return null;
  }

  return split.boundary;
}

function orderPdfLineSegments(segments) {
  const normalizedSegments = (segments ?? []).filter((segment) =>
    normalizeWhitespace(segment?.text)
  );
  const columnBoundary = shouldUseColumnMajorPdfOrdering(normalizedSegments);
  const byReadingLine = (left, right) => {
    if (Math.abs(right.y - left.y) > 2.5) {
      return right.y - left.y;
    }
    return left.x - right.x;
  };
  if (!columnBoundary) {
    return [...normalizedSegments].sort(byReadingLine);
  }

  const leftSegments = normalizedSegments
    .filter((segment) => segment.x < columnBoundary)
    .sort(byReadingLine);
  const rightSegments = normalizedSegments
    .filter((segment) => segment.x >= columnBoundary)
    .sort(byReadingLine);
  return [...leftSegments, ...rightSegments];
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
        width: Number(item.width ?? 0),
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

  const lineSegments = lineGroups
    .flatMap((group) => {
      const sortedItems = group.items.sort((left, right) => left.x - right.x);
      const segmentGapThreshold = Math.max(36, Math.min(96, group.maxHeight * 5.5 || 48));
      const segments = [];

      for (const item of sortedItems) {
        const currentSegment = segments[segments.length - 1];
        if (!currentSegment) {
          segments.push({
            items: [item],
            endX: item.x + Math.max(item.width, item.text.length * Math.max(group.maxHeight, 8) * 0.45),
          });
          continue;
        }

        const estimatedWidth = Math.max(
          item.width,
          item.text.length * Math.max(group.maxHeight, 8) * 0.45
        );
        if (
          shouldStartNewPdfLineSegment({
            currentSegment,
            item,
            segmentGapThreshold,
          })
        ) {
          segments.push({
            items: [item],
            endX: item.x + estimatedWidth,
          });
          continue;
        }

        currentSegment.items.push(item);
        currentSegment.endX = Math.max(currentSegment.endX, item.x + estimatedWidth);
      }

      return segments.map((segment) => ({
        text: normalizeWhitespace(segment.items.map((item) => item.text).join(" ")),
        x: Math.min(...segment.items.map((item) => item.x)),
        y: group.y,
        endX: segment.endX,
      }));
    })
    .filter((segment) => normalizeWhitespace(segment.text));

  return orderPdfLineSegments(lineSegments).map((segment) => normalizeWhitespace(segment.text));
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

function getCatalogPeerBoundaryPattern(anchor) {
  if (/^credential-/i.test(String(anchor ?? ""))) {
    return /<(?:(?:h[3-5]\b[^>]*\bid=(["'])credential-[^"']+\1[^>]*>[\s\S]*?<\/h[3-5]>)|(?:div\b[^>]*\bclass=(["'])[^"']*\bexpandableGroup\b[^"']*\2[^>]*\bdata-expand=(["'])credential-[^"']+\3[^>]*>))/gi;
  }

  return /<(?:(?:h[23]\b[^>]*\bid=(["'])program-[^"']+\1[^>]*>[\s\S]*?<\/h[23]>)|(?:div\b[^>]*\bclass=(["'])[^"']*\bexpandableGroup\b[^"']*\2[^>]*\bdata-expand=(["'])program-[^"']+\3[^>]*>))/gi;
}

function findNextCatalogPeerBoundary(html, searchStartIndex, anchor = null) {
  const boundaryPattern = getCatalogPeerBoundaryPattern(anchor);
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

function shouldStopMajorCatalogScopeBeforeCredentialSections(entry, anchor) {
  return Boolean(
    entry?.ownerType === "major" &&
      !entry?.pathwayId &&
      /^program-/i.test(String(anchor ?? "")) &&
      (BOOTSTRAP_PLAN_PATHWAY_COUNT_BY_ID.get(entry.planId) ?? 0) > 0
  );
}

function findNextCatalogCredentialBoundary(html, searchStartIndex, searchEndIndex = html.length) {
  const boundaryPattern =
    /<div\b[^>]*\bclass=(["'])[^"']*\bexpandableGroup\b[^"']*\1[^>]*\bdata-expand=(["'])credential-[^"']+\2[^>]*>[\s\S]*?<\/div>/gi;
  boundaryPattern.lastIndex = Math.max(0, searchStartIndex);
  const match = boundaryPattern.exec(html);

  if (!match || match.index >= searchEndIndex) {
    return null;
  }

  return {
    index: match.index,
    label: stripHtml(match[0]) || normalizeWhitespace(match[0]).slice(0, 120),
  };
}

function collectIgnoredCatalogNeighboringSections(html, searchStartIndex, anchor = null) {
  const ignored = [];
  const boundaryPattern = /^credential-/i.test(String(anchor ?? ""))
    ? /<h[3-5]\b[^>]*\bid=(["'])credential-[^"']+\1[^>]*>([\s\S]*?)<\/h[3-5]>/gi
    : /<h[23]\b[^>]*\bid=(["'])program-[^"']+\1[^>]*>([\s\S]*?)<\/h[23]>/gi;
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

  const peerStopBoundary = findNextCatalogPeerBoundary(html, anchorMatch.endIndex, requestedAnchor);
  const credentialStopBoundary = shouldStopMajorCatalogScopeBeforeCredentialSections(
    entry,
    requestedAnchor
  )
    ? findNextCatalogCredentialBoundary(html, anchorMatch.endIndex, peerStopBoundary.index)
    : null;
  const stopBoundary = credentialStopBoundary ?? peerStopBoundary;
  const sectionHtml = html.slice(anchorMatch.index, stopBoundary.index);
  const sectionLines = buildHtmlLines(sectionHtml);
  const sectionHeadings = extractHeadings(sectionHtml);
  const sectionHeading = sectionHeadings[0] || anchorMatch.heading || null;
  const ignoredNeighboringSections = collectIgnoredCatalogNeighboringSections(
    html,
    stopBoundary.index,
    requestedAnchor
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

function legacyCatalogProgramLineMatchesOwner(entry, line) {
  const normalizedLine = normalizeMatcherText(line);
  if (!/^Program of Study:\s*Major:/i.test(normalizeWhitespace(line)) || !normalizedLine) {
    return false;
  }

  const exactTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  if (exactTitle && normalizedLine.includes(exactTitle)) {
    return true;
  }

  const titleTokens = getTitleScopeTokens(entry);
  if (!titleTokens.length) {
    return false;
  }

  const ownerAcronymTokens = new Set(
    getOwnerProgramAcronymTokens(entry).map((token) => normalizeMatcherText(token))
  );
  const comparableTitleTokens = titleTokens.filter((token) => !ownerAcronymTokens.has(token));
  const requiredTitleTokens = comparableTitleTokens.length ? comparableTitleTokens : titleTokens;

  return requiredTitleTokens.every((token) => normalizedLine.includes(token));
}

function isLegacyCatalogCredentialHeadingLine(line) {
  return /^Bachelor\b.+\bdegree\b.+\bmajor\b.+:/i.test(normalizeWhitespace(line));
}

function lineLooksLikeCatalogCredentialSectionStart(lines, index) {
  if (!Array.isArray(lines) || index < 0 || index >= lines.length) {
    return false;
  }

  const followingText = lines
    .slice(index + 1, Math.min(lines.length, index + 7))
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .join(" ");

  return /\bCredential Overview\b|\bAdditional Admission Requirements\b|\bCompletion Requirements\b/i.test(
    followingText
  );
}

function shouldStopMajorLegacyCatalogScopeBeforeCredentialSections(entry) {
  return Boolean(
    entry?.ownerType === "major" &&
      !entry?.pathwayId &&
      (BOOTSTRAP_PLAN_PATHWAY_COUNT_BY_ID.get(entry.planId) ?? 0) > 0
  );
}

function findLegacyCatalogProgramSectionRange(entry, lines) {
  if (!isLegacyStudentCatalogSource(entry) || !Array.isArray(lines) || lines.length <= 20) {
    return null;
  }

  const candidateRanges = [];

  for (let startIndex = 0; startIndex < lines.length; startIndex += 1) {
    const line = normalizeWhitespace(lines[startIndex]);
    if (!legacyCatalogProgramLineMatchesOwner(entry, line)) {
      continue;
    }

    let endIndex = Math.min(lines.length - 1, startIndex + 220);
    for (let index = startIndex + 1; index < lines.length; index += 1) {
      const nextLine = normalizeWhitespace(lines[index]);
      if (!nextLine) {
        continue;
      }
      if (/^Back to Top\b/i.test(nextLine)) {
        endIndex = Math.max(startIndex, index - 1);
        break;
      }
      if (
        shouldStopMajorLegacyCatalogScopeBeforeCredentialSections(entry) &&
        isLegacyCatalogCredentialHeadingLine(nextLine) &&
        lineLooksLikeCatalogCredentialSectionStart(lines, index)
      ) {
        endIndex = Math.max(startIndex, index - 1);
        break;
      }
      if (/^Program of Study:/i.test(nextLine)) {
        endIndex = Math.max(startIndex, index - 1);
        break;
      }
    }

    const sectionLines = lines.slice(startIndex, endIndex + 1);
    const courseCount = uniqueSorted(sectionLines.flatMap(extractCourseCodesFromLine)).length;
    const requirementSignalCount = sectionLines.filter((sectionLine) =>
      /\b(admission requirements?|completion requirements?|graduation requirements?|required core|prerequisites?|electives?)\b/i.test(
        sectionLine
      )
    ).length;

    candidateRanges.push({
      startIndex,
      endIndex,
      courseCount,
      score: courseCount * 5 + requirementSignalCount * 3 + Math.min(10, sectionLines.length / 12),
    });
  }

  return (
    candidateRanges
      .filter((range) => range.courseCount >= 2)
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.courseCount - left.courseCount ||
          left.startIndex - right.startIndex
      )[0] ?? null
  );
}

function shouldUseFullFocusedDegreeHtmlScope(entry, title, headings, lines) {
  if (!["html-degree-page", "html-curriculum-page", "html-overview-page"].includes(entry?.parserType)) {
    return false;
  }
  if (
    isLegacyStudentCatalogSource(entry) &&
    shouldStopMajorLegacyCatalogScopeBeforeCredentialSections(entry)
  ) {
    return false;
  }
  if (entry?.pathwayId) {
    return false;
  }

  const sampledText = normalizeMatcherText(
    [
      title,
      ...(headings ?? []).slice(0, 30),
      ...(lines ?? []).slice(0, 320),
    ]
      .filter(Boolean)
      .join(" ")
  );
  const ownerTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  const hasFocusedOwnerCue = ownerTitle
    ? sampledText.includes(ownerTitle)
    : getTitleScopeTokens(entry).some((token) => sampledText.includes(token));
  const hasDegreeRequirementCue =
    /\bdegree requirements?\b/.test(sampledText) ||
    /\btotal credits? for degree\b/.test(sampledText) ||
    /\bmajor requirements?\b/.test(sampledText);
  const hasMultipleRequirementSections =
    (headings ?? []).filter((heading) =>
      /\b(core|fundamentals?|mathematics|natural science|programming|capstone|electives?|requirements?)\b/i.test(
        heading
      )
    ).length >= 3;
  const fullPageCourseCount = uniqueSorted(
    (lines ?? []).flatMap((line) => extractCourseCodesFromLine(line))
  ).length;
  const hasCompactFullDegreeCourseList =
    fullPageCourseCount >= 20 &&
    (lines ?? []).length <= 420 &&
    /\b(?:degree requirements?|core courses?|core \(\d+\s*credits?|electives?|capstone)\b/.test(
      sampledText
    );

  return Boolean(
    hasFocusedOwnerCue &&
      hasDegreeRequirementCue &&
      (hasMultipleRequirementSections || hasCompactFullDegreeCourseList)
  );
}

function findPrecedingAdmissionRequirementStartIndex(entry, lines, scopedStartIndex) {
  if (!entry || !Array.isArray(lines) || scopedStartIndex <= 0) {
    return null;
  }

  const ownerTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  const prefersScience = /\b(?:bachelor of science|bs)\b/.test(ownerTitle);
  const prefersArts = /\b(?:bachelor of arts|ba)\b/.test(ownerTitle);
  const minIndex = Math.max(0, scopedStartIndex - 90);
  const candidates = [];

  for (let index = scopedStartIndex - 1; index >= minIndex; index -= 1) {
    const line = normalizeWhitespace(lines[index]);
    const searchableLine = normalizeMatcherText(line);
    if (!/\bprereq(?:uisites?)?\b/.test(searchableLine)) {
      continue;
    }

    const betweenCourseCount = uniqueSorted(
      lines
        .slice(index, scopedStartIndex)
        .flatMap((betweenLine) => extractCourseCodesFromLine(betweenLine))
    ).length;
    if (betweenCourseCount === 0) {
      continue;
    }

    const optionScore =
      (prefersScience && /\b(?:bachelor of science|science|bs)\b/.test(searchableLine)) ||
      (prefersArts && /\b(?:bachelor of arts|arts|ba)\b/.test(searchableLine))
        ? 2
        : 0;
    const genericScore = /^prereq(?:uisites?)?$/i.test(line) ? 1 : 0;
    candidates.push({ index, score: optionScore + genericScore, distance: scopedStartIndex - index });
  }

  candidates.sort(
    (left, right) => right.score - left.score || left.distance - right.distance || right.index - left.index
  );

  return candidates[0]?.index ?? null;
}

function isApprovedElectiveHtmlSource(entry, title, headings, lines) {
  const sourceIdentityText = normalizeMatcherText(
    [
      entry?.label,
      entry?.sourceLabel,
      entry?.url,
      title,
      ...(headings ?? []),
      ...lines.slice(0, 40),
    ]
      .filter(Boolean)
      .join(" ")
  );

  return (
    /\bapproved electives?\b/.test(sourceIdentityText) ||
    /\belective (?:lists?|webpage|courses?)\b/.test(sourceIdentityText)
  );
}

function scopeHtmlLines(entry, title, headings, lines) {
  const pathwaySectionRange = findPathwayHtmlSectionRange(entry, lines);
  if (pathwaySectionRange) {
    return pathwaySectionRange.lines ?? lines.slice(pathwaySectionRange.startIndex, pathwaySectionRange.endIndex + 1);
  }

  if (isApprovedElectiveHtmlSource(entry, title, headings, lines)) {
    return lines;
  }

  if (shouldUseFullFocusedDegreeHtmlScope(entry, title, headings, lines)) {
    return lines;
  }

  const legacyCatalogSectionRange = findLegacyCatalogProgramSectionRange(entry, lines);
  if (legacyCatalogSectionRange) {
    return lines.slice(legacyCatalogSectionRange.startIndex, legacyCatalogSectionRange.endIndex + 1);
  }

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
        const acronymMatches = getOwnerProgramAcronymMatches(entry, normalizedLine);
        const headingLikeAcronymRequirementLine =
          HTML_SECTION_BOUNDARY_LINE_PATTERN.test(line) ||
          normalizeWhitespace(line).split(/\s+/).length <= 8;
        const acronymRequirementScore =
          acronymMatches.length > 0 &&
          headingLikeAcronymRequirementLine &&
          (STRUCTURAL_REQUIREMENT_PATTERN.test(line) || PRIMARY_REQUIREMENT_CUE_PATTERN.test(line))
            ? acronymMatches.some((token) => token.length >= 4)
              ? 28
              : 24
            : 0;
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
          acronymRequirementScore +
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
  let startIndex = ownerSectionRange
    ? ownerSectionRange.startIndex
    : Math.max(0, Math.min(...matchingIndexes) - 6);
  const initialEndIndex = ownerSectionRange
    ? ownerSectionRange.endIndex
    : Math.min(lines.length - 1, Math.max(...matchingIndexes) + 24);
  const scopedTableTailText = normalizeMatcherText(
    lines.slice(Math.max(startIndex, initialEndIndex - 16), initialEndIndex + 1).join(" ")
  );
  const isApprovedElectivesScope = /\bapproved electives?\b/.test(
    normalizeMatcherText(
      [
        entry?.label,
        entry?.url,
        ...lines.slice(startIndex, initialEndIndex + 1),
      ]
        .filter(Boolean)
        .join(" ")
    )
  );
  let endIndex = initialEndIndex;

  if (
    !ownerSectionRange &&
    (/\b(course #|course name|credits?|cr\.?|requirements?|electives?|offered|prereq|prerequisite)\b/.test(
      scopedTableTailText
    ) || SECTIONED_COURSE_LIST_REQUIREMENT_PATTERN.test(scopedTableTailText))
  ) {
    const continuationTail = lines.slice(
      initialEndIndex + 1,
      Math.min(lines.length, initialEndIndex + 501)
    );
    let continuationCourseCount = 0;
    let quietLineCount = 0;

    for (let offset = 0; offset < continuationTail.length; offset += 1) {
      const line = normalizeWhitespace(continuationTail[offset]);
      if (!line) {
        continue;
      }

      const lineCourseCodes = extractCourseCodesFromLine(line);
      const hasTableSignal =
        /\b(course #|course name|credits?|cr\.?|requirements?|electives?|offered|prereq|prerequisite)\b/i.test(
          line
        ) || SECTIONED_COURSE_LIST_REQUIREMENT_PATTERN.test(line);

      if (
        continuationCourseCount >= 4 &&
        HTML_SECTION_BOUNDARY_LINE_PATTERN.test(line) &&
        !hasTableSignal
      ) {
        const upcomingCourseCount = continuationTail
          .slice(offset + 1, Math.min(continuationTail.length, offset + 13))
          .reduce(
            (count, nearbyLine) => count + extractCourseCodesFromLine(nearbyLine).length,
            0
          );
        if (isApprovedElectivesScope && upcomingCourseCount > 0) {
          quietLineCount = 0;
          endIndex = initialEndIndex + offset + 1;
          continue;
        }
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
      if (quietLineCount >= 16) {
        break;
      }
    }

    if (continuationCourseCount < 4) {
      endIndex = initialEndIndex;
    }
  }

  if (!ownerSectionRange) {
    const prerequisiteStartIndex = findPrecedingAdmissionRequirementStartIndex(
      entry,
      lines,
      startIndex
    );
    if (prerequisiteStartIndex !== null) {
      startIndex = prerequisiteStartIndex;
    }
  }

  let scopedLines = lines.slice(startIndex, endIndex + 1);
  const differentOwnerBoundaryIndex = findDifferentOwnerAcronymDepartmentalBoundaryIndex(
    entry,
    scopedLines
  );
  if (differentOwnerBoundaryIndex > 0) {
    scopedLines = scopedLines.slice(0, differentOwnerBoundaryIndex);
  }

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

function writeSnapshot(ownerKey, sourceUrl, title, lines, metadata = {}) {
  ensureDir(SNAPSHOT_DIR);
  const outputPath = getSnapshotPath(ownerKey, sourceUrl);
  const headings = uniqueInOrder(
    (metadata.headings ?? []).map((heading) => normalizeWhitespace(heading)).filter(Boolean)
  ).slice(0, 40);
  const body = [
    `Owner: ${ownerKey}`,
    `Source: ${sourceUrl}`,
    `Title: ${title || ""}`,
    `Headings: ${JSON.stringify(headings)}`,
    "",
    ...lines,
  ].join("\n");
  fs.writeFileSync(outputPath, `${body}\n`);
  return outputPath;
}

function getSnapshotSourceHash(sourceUrl) {
  const normalizedSourceUrl = normalizeSnapshotSourceUrlForComparison(sourceUrl);
  if (!normalizedSourceUrl) {
    return null;
  }
  return crypto.createHash("sha1").update(normalizedSourceUrl).digest("hex").slice(0, 10);
}

function getSnapshotPath(ownerKey, sourceUrl = null) {
  const sourceHash = getSnapshotSourceHash(sourceUrl);
  return path.resolve(
    SNAPSHOT_DIR,
    `${slugify(ownerKey)}${sourceHash ? `-${sourceHash}` : ""}.txt`
  );
}

function getSourceUrlWithoutHash(sourceUrl) {
  const normalizedSourceUrl = normalizeSnapshotSourceUrlForComparison(sourceUrl);
  return normalizedSourceUrl ? normalizedSourceUrl.replace(/#.*$/, "") : null;
}

function normalizeSnapshotSourceUrlForComparison(value) {
  try {
    const parsed = new URL(String(value ?? ""));
    const normalizedPathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${normalizedPathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function sourceUrlHasHash(value) {
  try {
    return Boolean(new URL(String(value ?? "")).hash);
  } catch {
    return false;
  }
}

function parseSnapshotHeadingMetadata(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return uniqueInOrder(parsed.map((heading) => normalizeWhitespace(heading)).filter(Boolean));
    }
  } catch {
    // Older or manually captured snapshots may not use JSON metadata.
  }

  return uniqueInOrder(
    rawValue
      .split(/\s*\|\s*/)
      .map((heading) => normalizeWhitespace(heading))
      .filter(Boolean)
  );
}

function readSnapshotFile(snapshotPath, expectedSourceUrl = null) {
  if (!fs.existsSync(snapshotPath)) {
    return null;
  }

  const rawLines = fs.readFileSync(snapshotPath, "utf8").split(/\r?\n/);
  const sourceLine = rawLines.find((line) => line.startsWith("Source:"));
  const sourceUrl = sourceLine ? normalizeWhitespace(sourceLine.replace(/^Source:\s*/, "")) : null;
  if (expectedSourceUrl && sourceUrl) {
    const expectedExact = normalizeSnapshotSourceUrlForComparison(expectedSourceUrl);
    const actualExact = normalizeSnapshotSourceUrlForComparison(sourceUrl);
    const expectedBase = getSourceUrlWithoutHash(expectedSourceUrl);
    const actualBase = getSourceUrlWithoutHash(sourceUrl);
    if (
      expectedExact !== actualExact &&
      (sourceUrlHasHash(expectedSourceUrl) || expectedBase !== actualBase)
    ) {
      return null;
    }
  }

  const titleLine = rawLines.find((line) => line.startsWith("Title:"));
  const headingsLine = rawLines.find((line) => line.startsWith("Headings:"));
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
    sourceUrl,
    title: titleLine ? normalizeWhitespace(titleLine.replace(/^Title:\s*/, "")) : null,
    hasHeadingMetadata: Boolean(headingsLine),
    headings: headingsLine
      ? parseSnapshotHeadingMetadata(headingsLine.replace(/^Headings:\s*/, ""))
      : [],
    snapshotLines,
  };
}

function findSnapshotBySourceUrl(sourceUrl) {
  const expectedBase = getSourceUrlWithoutHash(sourceUrl);
  if (!expectedBase || !fs.existsSync(SNAPSHOT_DIR)) {
    return null;
  }

  for (const entry of fs.readdirSync(SNAPSHOT_DIR)) {
    if (!entry.endsWith(".txt")) {
      continue;
    }
    const snapshot = readSnapshotFile(path.resolve(SNAPSHOT_DIR, entry), sourceUrl);
    if (snapshot) {
      return snapshot;
    }
  }

  return null;
}

function readSnapshot(ownerKey, sourceUrl = null) {
  return (
    readSnapshotFile(getSnapshotPath(ownerKey, sourceUrl), sourceUrl) ??
    readSnapshotFile(getSnapshotPath(ownerKey), sourceUrl) ??
    findSnapshotBySourceUrl(sourceUrl)
  );
}

function escapeSyntheticHtmlAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeSyntheticHtmlText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getSnapshotHrefValue(line) {
  const match = String(line ?? "").match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  return normalizeWhitespace(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}

function isSnapshotLinkLabelNoise(line) {
  const normalized = normalizeWhitespace(line);
  return (
    !normalized ||
    /^<\/?[a-z][^>]*>?$/i.test(normalized) ||
    /^(?:class|style|target|rel|aria-[\w-]+|data-[\w-]+|id|title)\s*=/i.test(normalized) ||
    /^(?:href|src)\s*=/i.test(normalized) ||
    /^[<>/]+$/.test(normalized)
  );
}

function findSnapshotLinkLabel(snapshotLines, hrefIndex, href) {
  const sameLine = normalizeWhitespace(
    stripHtml(String(snapshotLines[hrefIndex] ?? "").replace(/\bhref\s*=\s*(?:"[^"]+"|'[^']+'|[^\s>]+)/i, " "))
  );
  if (!isSnapshotLinkLabelNoise(sameLine) && sameLine.length >= 4) {
    return sameLine;
  }

  const labelParts = [];
  for (
    let index = hrefIndex + 1;
    index < Math.min(snapshotLines.length, hrefIndex + 7);
    index += 1
  ) {
    const candidate = normalizeWhitespace(stripHtml(snapshotLines[index]));
    if (isSnapshotLinkLabelNoise(candidate)) {
      continue;
    }
    labelParts.push(candidate);
    if (candidate.length >= 8) {
      break;
    }
  }

  return normalizeWhitespace(labelParts.join(" ")) || href;
}

function buildSyntheticSnapshotLinkHtml(snapshotLines) {
  const anchors = [];
  for (let index = 0; index < (snapshotLines ?? []).length; index += 1) {
    const href = getSnapshotHrefValue(snapshotLines[index]);
    if (!href || /^(?:#|javascript:|mailto:|tel:)/i.test(href)) {
      continue;
    }

    const label = findSnapshotLinkLabel(snapshotLines, index, href);
    anchors.push(
      `<a href="${escapeSyntheticHtmlAttribute(href)}">${escapeSyntheticHtmlText(label)}</a>`
    );
  }

  return anchors.join("\n");
}

function readParserRecoverySnapshot(entry, owner = {}) {
  if (Array.isArray(owner.snapshotLines) && owner.snapshotLines.length) {
    return {
      snapshotPath: owner.snapshotPath ?? null,
      sourceUrl: owner.sourceUrl ?? entry.url,
      title: owner.extractedTitle ?? null,
      snapshotLines: owner.snapshotLines,
    };
  }

  if (owner.snapshotPath && fs.existsSync(owner.snapshotPath)) {
    const snapshot =
      readSnapshotFile(owner.snapshotPath, owner.sourceUrl ?? entry.url) ??
      readSnapshotFile(owner.snapshotPath);
    if (snapshot?.snapshotLines?.length) {
      return snapshot;
    }
  }

  return readSnapshot(entry.ownerId, owner.sourceUrl ?? entry.url);
}

function buildParserRecoveryArtifactsFromSnapshot(entry, owner = {}) {
  const snapshot = readParserRecoverySnapshot(entry, owner);
  const snapshotLines = snapshot?.snapshotLines ?? [];
  if (!snapshotLines.length) {
    return null;
  }

  const syntheticLinkHtml = buildSyntheticSnapshotLinkHtml(snapshotLines);
  return {
    html: [snapshotLines.join("\n"), syntheticLinkHtml].filter(Boolean).join("\n"),
    title: owner.extractedTitle ?? snapshot.title ?? owner.sourceLabel ?? entry.label ?? null,
    headings: (owner.extractedHeadings ?? []).length
      ? owner.extractedHeadings
      : snapshot.headings ?? [],
    lines: snapshotLines,
    snapshotPath: snapshot.snapshotPath ?? owner.snapshotPath ?? null,
    fromSnapshot: true,
  };
}

function isPdfCreditMarkerText(value) {
  return /^\d+(?:-\d+)?\s*cr$/i.test(normalizeWhitespace(value));
}

function shouldStartNewPdfLineSegment(input) {
  const gap = input.item.x - input.currentSegment.endX;
  if (gap > input.segmentGapThreshold) {
    return true;
  }

  const currentText = normalizeWhitespace(
    input.currentSegment.items.map((item) => item.text).join(" ")
  );
  const itemText = normalizeWhitespace(input.item.text);
  const bareChecklistLinePattern =
    /^\s*(?:[^\w\d]{1,10}\s*)?\d{3}[A-Za-z]?\s*\(\d+(?:\.\d+)?\)/iu;
  if (
    gap > 8 &&
    /^\d+\)(?:\s+|$)/.test(itemText) &&
    bareChecklistLinePattern.test(currentText)
  ) {
    return true;
  }
  if (
    gap > 8 &&
    /^\d+\)\s+[A-Za-z][^()]{2,80}\([A-Z& ]{2,10}\)/.test(currentText) &&
    (sourceLineStartsWithCourseCode(itemText) ||
      extractCourseCodesFromLine(itemText).length > 0 ||
      normalizeExtractedCourseSubject(itemText) ||
      bareChecklistLinePattern.test(itemText))
  ) {
    return true;
  }

  const previousItem = input.currentSegment.items[input.currentSegment.items.length - 1] ?? null;
  if (
    previousItem &&
    isPdfCreditMarkerText(previousItem.text) &&
    !isPdfCreditMarkerText(input.item.text) &&
    gap > Math.max(18, input.segmentGapThreshold * 0.35)
  ) {
    return true;
  }

  return false;
}

function parseSnapshotSource(entry, originalError) {
  const snapshot = readSnapshot(entry.ownerId, entry.url);
  if (!snapshot) {
    return null;
  }

  const requirementCueLines = extractRequirementCueLines(snapshot.snapshotLines);
  const chooseStatements = extractChooseStatements(snapshot.snapshotLines);
  const headings = snapshot.headings ?? [];
  const pathwayLabels = extractPathwayLabels(entry, snapshot.snapshotLines, headings);
  const courseCodes = filterParsedCourseCodesByHintsWithSourceRecovery(
    entry,
    snapshot.snapshotLines,
    extractCourseCodesFromLines(snapshot.snapshotLines, [], entry)
  );

  return {
    title: snapshot.title,
    headings,
    snapshotHasHeadingMetadata: snapshot.hasHeadingMetadata,
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

function isPdfSourceUrl(url) {
  return /\.pdf(?:$|[?#])/i.test(String(url ?? ""));
}

function isLinkedDocumentSourceUrl(url) {
  return isPdfSourceUrl(url) || isDocxSourceUrl(url);
}

function getLinkedDocumentParserType(url, label = "") {
  if (/\b(?:worksheet|check\s*list|checklist)\b/i.test(label)) {
    return "pdf-worksheet";
  }

  return "pdf-degree-sheet";
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
    .filter(
      (line) =>
        /\b(choose|select|one of the following|two of the following)\b/i.test(line) ||
        /\b(?:two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:formal\s+)?(?:concentrations?|tracks?|options?|routes?|pathways?)\b\s*:/i.test(
          line
        )
    )
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

function slugifyExtractedPathwayLabel(value) {
  return normalizeTransferPlannerText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isSuspiciousParsedPathwayLabel(value) {
  const normalized = normalizeTransferPlannerText(value);
  if (!normalized) {
    return false;
  }

  return (
    isSuspiciousStructuralPathwayLabel(normalized) ||
    isSuspiciousStructuralPathwayId(slugifyExtractedPathwayLabel(normalized))
  );
}

function lineHasNearbyCourseList(lines, index) {
  const lookaheadLines = lines.slice(index + 1, index + 5);
  return lookaheadLines.some((line) => extractCourseCodesFromLine(line).length > 0);
}

function normalizeSectionPathwayCandidate(entry, rawLine, pathwayKind) {
  const normalizedLine = normalizeTransferPlannerText(rawLine)
    .replace(/^[A-Z]\.\s+/i, "")
    .replace(/^\d+\)\s+/i, "");
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
  const normalizedLabel = normalizeCanonicalExtractedPathwayLabel(entry, labelWithKind);
  return isSuspiciousParsedPathwayLabel(normalizedLabel) ? "" : normalizedLabel;
}

function getDeclaredPathwayChoice(lines) {
  for (const line of lines) {
    const normalized = normalizeTransferPlannerText(line);
    const match =
      normalized.match(
        /\b(?:choose|select)\s+one\s+of\s+(?:(\d+)|([a-z]+))\s+(?:formal\s+)?(concentration|track|option|route|pathway)s?\b/i
      ) ??
      normalized.match(
        /\b(?:choose|select)\s+from\s+(?:(\d+)|([a-z]+))\s+(?:formal\s+)?(concentration|track|option|route|pathway)s?\b/i
      ) ??
      normalized.match(
        /\b(?:have|has|offer|offers|include|includes)\s+(?:(\d+)|([a-z]+))\s+(?:formal\s+)?(concentration|track|option|route|pathway)s?\s+to\s+choose\s+from\b/i
      ) ??
      normalized.match(
        /\b(?:(\d+)|([a-z]+))\s+(?:formal\s+)?(concentration|track|option|route|pathway)s?\b\s*:/i
      ) ??
      normalized.match(
        /^\s*(concentration|track|option|route|pathway)s?\b(?:\s*\([^)]*\))*\s*$/i
      );
    if (!match) {
      continue;
    }

    const numericCount = match[1] && /^\d+$/.test(match[1]) ? Number(match[1]) : null;
    const wordCount = PATHWAY_CHOICE_COUNT_BY_WORD.get(String(match[2] ?? "").toLowerCase()) ?? null;
    const count = numericCount ?? wordCount;
    if (count != null && (!Number.isFinite(count) || count < 2 || count > 10)) {
      continue;
    }

    return {
      count: count ?? null,
      kind: String(match[3] ?? match[1] ?? "pathway").replace(/s$/i, "").toLowerCase(),
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

  if (
    new RegExp(
      `\\b(?:choose|select)\\s+(?:one\\s+of\\s+)?(?:(?:\\d+|[a-z]+)\\s+)?(?:formal\\s+)?${pathwayKind}s?\\b`,
      "i"
    ).test(normalized) ||
    new RegExp(
      `\\b(?:\\d+|[a-z]+)\\s+(?:formal\\s+)?${pathwayKind}s?\\b.*\\bchoose\\s+from\\b`,
      "i"
    ).test(normalized) ||
    new RegExp(`\\b${pathwayKind}s?\\b.*\\bchoose\\s+one\\b`, "i").test(normalized)
  ) {
    return true;
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

    const inlinePathwayMatch = line.match(/^([^:]{2,90}):\s+(.+)$/);
    if (inlinePathwayMatch && extractCourseCodesFromLine(inlinePathwayMatch[2] ?? "").length > 0) {
      const label = normalizeSectionPathwayCandidate(
        entry,
        inlinePathwayMatch[1],
        activePathwayKind
      );
      if (label) {
        labels.push(label);
        if (declaredPathwayChoice.count != null && labels.length >= declaredPathwayChoice.count) {
          break;
        }
      }
      continue;
    }

    if (!lineHasNearbyCourseList(lines, index)) {
      continue;
    }

    const label = normalizeSectionPathwayCandidate(entry, line, activePathwayKind);
    if (label) {
      labels.push(label);
      if (declaredPathwayChoice.count != null && labels.length >= declaredPathwayChoice.count) {
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
    if (isSuspiciousParsedPathwayLabel(normalized)) {
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
      /\binformal\b/i.test(normalized) ||
      /\bconcentration areas?\b/i.test(normalized) ||
      /^(?:explore|how do i|planning|what is the difference)\b/i.test(normalized) ||
      /^b\.?\s*s\.?\s+with\b/i.test(normalized) ||
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
    parserType === "pdf-degree-sheet" ||
    parserType === "pdf-worksheet"
  ) {
    return "medium";
  }

  return "low";
}

function buildHtmlParsedResult(entry, title, headings, lines, options = {}) {
  const requirementCueLines = extractRequirementCueLines(lines);
  const chooseStatements = extractChooseStatements(lines);
  const pathwayLabels = extractPathwayLabels(entry, lines, headings);
  const courseCodes = filterParsedCourseCodesByHintsWithSourceRecovery(
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
  const scopedMentionsSelectedPathwaySection = parsedMentionsSelectedPathwaySection(
    entry,
    scopedParsed
  );
  const enrichedScopedParsed =
    !scopedMentionsSelectedPathwaySection &&
    !isLegacyStudentCatalogSource(entry) &&
    ["html-degree-page", "html-curriculum-page"].includes(entry.parserType)
      ? buildFocusedScopedHtmlOverflowParsed(fullParsed, scopedParsed)
      : scopedParsed;
  if (isLegacyStudentCatalogSource(entry) && scopedCourseCount >= 2) {
    return enrichedScopedParsed;
  }
  if (scopedParsed.sourceSectionAudit?.anchorFound) {
    return enrichedScopedParsed;
  }
  if (
    scopedCourseCount >= 4 &&
    hasOwnerAcronymDepartmentalBoundary(entry, enrichedScopedParsed.snapshotLines) &&
    findDifferentOwnerAcronymDepartmentalBoundaryIndex(entry, fullParsed.snapshotLines) > 0
  ) {
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
    scopedMentionsSelectedPathwaySection &&
    scopedCourseCount >= 1
  ) {
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

  if (
    !entry?.pathwayId &&
    fullHasRequirementAnchors &&
    fullCourseCount >= scopedCourseCount + 12 &&
    fullAlignment >= Math.max(1, scopedAlignment - 2)
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
        parserType: getLinkedDocumentParserType(entry.url, entry.label),
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
  const retainedLinkedSupplementalSources = linkedSupplementalSources.filter((supplementalSource) =>
    shouldKeepLinkedSupplementalHtmlSource(entry, htmlParsed, supplementalSource)
  );
  const preferredHtmlSource = retainedLinkedSupplementalSources.find(({ candidate, parsed }) =>
    shouldPreferSupplementalHtmlSource(entry, htmlParsed, candidate, parsed)
  );
  if (preferredHtmlSource) {
    return preferredHtmlSource.parsed;
  }
  const mergedHtmlParsed = mergeParsedSources(
    htmlParsed,
    retainedLinkedSupplementalSources,
    entry.parserType
  );
  const linkedDocumentSources =
    allowLinkedRecovery && normalizedEntryUrl
      ? await parseSupplementalDocumentSources(
          entry,
          html,
          timeoutMs,
          new Set([...visitedUrls, normalizedEntryUrl])
        )
      : [];
  const preferredDocumentSource = linkedDocumentSources.find(({ candidate, parsed }) =>
    shouldPreferSupplementalDocumentSource(entry, mergedHtmlParsed, candidate, parsed)
  );

  if (preferredDocumentSource) {
    return preferredDocumentSource.parsed;
  }

  const shouldFollowLinkedDocument =
    mergedHtmlParsed.courseCodes.length === 0 &&
    (/\b(download|checklist|worksheet|type:\s*(?:pdf|docx?))\b/i.test((htmlParsed.snapshotLines ?? []).join(" ")) ||
      /\/file\//i.test(entry.url));

  if (!shouldFollowLinkedDocument) {
    return mergedHtmlParsed;
  }

  const documentLinks = uniqueSorted(
    [...String(html ?? "").matchAll(HTML_LINK_PATTERN)]
      .map((match) => ({
        href: normalizeWhitespace(match[1] ?? match[2] ?? ""),
        label: stripHtml(match[3]),
      }))
      .filter(({ href }) => href && isLinkedDocumentSourceUrl(href))
      .map(({ href, label }) => {
        try {
          const url = new URL(href, entry.url).href;
          return {
            url,
            label,
            parserType: getLinkedDocumentParserType(url, label),
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  );

  for (const documentLink of documentLinks.slice(0, 2)) {
    try {
      const documentParsed = await parseLinkedDocumentSource(entry, documentLink, timeoutMs);
      const htmlScore =
        mergedHtmlParsed.courseCodes.length * 100 +
        mergedHtmlParsed.requirementCueLines.length * 10 +
        mergedHtmlParsed.chooseStatements.length * 5;
      const documentScore =
        documentParsed.courseCodes.length * 100 +
        documentParsed.requirementCueLines.length * 10 +
        documentParsed.chooseStatements.length * 5;

      if (documentScore > htmlScore) {
        return {
          ...documentParsed,
          headings: uniqueSorted([...mergedHtmlParsed.headings, ...documentParsed.headings]).slice(0, 20),
          requirementCueLines: uniqueSorted([
            ...mergedHtmlParsed.requirementCueLines,
            ...documentParsed.requirementCueLines,
          ]).slice(0, 30),
          chooseStatements: uniqueSorted([
            ...mergedHtmlParsed.chooseStatements,
            ...documentParsed.chooseStatements,
          ]).slice(0, 20),
          pathwayLabels: uniqueSorted([
            ...mergedHtmlParsed.pathwayLabels,
            ...documentParsed.pathwayLabels,
          ]).slice(0, 20),
        };
      }
    } catch {
      // Keep the primary HTML parse result if linked document recovery fails.
    }
  }

  return mergedHtmlParsed;
}

async function parseDocxSource(entry, timeoutMs) {
  const { title, lines } = await getDocxSourceArtifacts(entry.url, timeoutMs);
  const requirementCueLines = extractRequirementCueLines(lines);
  const chooseStatements = extractChooseStatements(lines);
  const pathwayLabels = extractPathwayLabels(entry, lines, []);
  const courseCodes = filterParsedCourseCodesByHintsWithSourceRecovery(
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
    parseConfidence: buildParseConfidence(
      courseCodes,
      requirementCueLines,
      entry.parserType ?? "pdf-degree-sheet"
    ),
    resolvedSourceUrl: entry.url,
    resolvedSourceLabel: entry.label,
    resolvedParserType: entry.parserType ?? "pdf-degree-sheet",
    sourceRole: classifyRequirementSourceRole(entry),
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
  const courseCodes = filterParsedCourseCodesByHintsWithSourceRecovery(
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
    sourceRole: classifyRequirementSourceRole(entry),
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

function shouldKeepLinkedSupplementalHtmlSource(entry, baseParsed, supplementalSource) {
  if (entry?.pathwayId) {
    return true;
  }

  const baseSnapshotText = normalizeMatcherText((baseParsed?.snapshotLines ?? []).slice(0, 90).join(" "));
  const hasStrongPrimaryRequirementSection =
    /\brequired courses?\b/.test(baseSnapshotText) &&
    /\b(?:lower division|upper division|core courses?)\b/.test(baseSnapshotText) &&
    (baseParsed?.courseCodes?.length ?? 0) >= 6;

  if (!hasStrongPrimaryRequirementSection) {
    return true;
  }

  const linkText = normalizeMatcherText(
    `${supplementalSource?.entry?.label ?? ""} ${supplementalSource?.entry?.url ?? ""}`
  );
  if (
    /\b(?:minors?|certificates?|special programs?|student experience|scholarships?)\b/.test(linkText) ||
    /\bcurriculum\s+(?:options?|tracks?|pathways?|routes?|concentrations?|specializations?)\b/.test(linkText)
  ) {
    return false;
  }

  return supplementalSource?.candidate?.sameProgramRequirementLink === true;
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
    if (/(?:^|\/)(?:admissions?|overview|curriculum|degree-requirements?|major-requirements?|requirements?|prerequisites?|checklist|worksheet|tracks?|options?|routes?|pathways?|concentrations?|specializations?)$/i.test(pathname)) {
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

function isSameProgramSpecializationHubLink(baseUrl, resolvedUrl, linkText) {
  if (!SPECIALIZATION_SUPPLEMENTAL_HTML_LINK_PATTERN.test(linkText)) {
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
      PATHWAY_HUB_SOURCE_CUE_PATTERN.test(base.pathname) &&
      resolvedPath.startsWith(`${basePrefix}/`)
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

function isOfficialLinkedAssetUrl(baseUrl, resolvedUrl) {
  try {
    const base = new URL(baseUrl);
    const resolved = new URL(resolvedUrl);

    if (base.origin === resolved.origin) {
      return true;
    }

    const baseHost = base.hostname.toLowerCase();
    const resolvedHost = resolved.hostname.toLowerCase();
    const resolvedPath = resolved.pathname.toLowerCase();

    return (
      /(?:^|\.)cs\.washington\.edu$/i.test(baseHost) &&
      resolvedHost === "s3-us-west-2.amazonaws.com" &&
      resolvedPath.startsWith("/www-cse-public/")
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
    const sameProgramSpecializationLink = isSameProgramSpecializationHubLink(
      baseUrl,
      resolvedUrl,
      linkText
    );

    if (
      titleTokens.length > 0 &&
      !exactTitleMatch &&
      titleTokenOverlapCount < 1 &&
      !sameProgramRequirementLink &&
      !sameProgramSpecializationLink &&
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
      : specializationSignal || sameProgramSpecializationLink
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
    if (sameProgramSpecializationLink) {
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
        sameProgramSpecializationLink,
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

function extractSupplementalDocumentLinkCandidates(entry, html) {
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

    if (
      !href ||
      !label ||
      !isLinkedDocumentSourceUrl(href) ||
      /^(?:#|javascript:|mailto:|tel:)/i.test(href)
    ) {
      continue;
    }

    let resolvedUrl = null;
    try {
      resolvedUrl = normalizeUrlForComparison(new URL(href, entry.url).href);
    } catch {
      resolvedUrl = null;
    }

    if (!resolvedUrl || !isOfficialLinkedAssetUrl(entry.url, resolvedUrl)) {
      continue;
    }

    const normalizedLabel = normalizeMatcherText(label);
    const normalizedLinkText = normalizeMatcherText(`${label} ${resolvedUrl}`);
    const exactTitleMatch = Boolean(exactTitle && normalizedLabel.includes(exactTitle));
    const titleTokenOverlapCount = titleTokens.filter((token) =>
      normalizedLinkText.includes(token)
    ).length;
    const hasDocumentRequirementSignal =
      /\b(requirements?|degree|curriculum|worksheet|checklist|plan of study|program of study|study plan|sample plan)\b/i.test(
        `${label} ${href}`
      );
    const titleAcronymMatches = hasDocumentRequirementSignal
      ? getOwnerProgramAcronymMatches(entry, normalizedLinkText)
      : [];
    const titleAcronymMatch = titleAcronymMatches.length > 0;
    const sameProgramRequirementLink = isSameProgramRequirementLink(
      baseUrl,
      resolvedUrl,
      `${label} ${resolvedUrl}`,
      hasDocumentRequirementSignal
    );

    if (
      !exactTitleMatch &&
      !titleAcronymMatch &&
      titleTokenOverlapCount < 2 &&
      !sameProgramRequirementLink
    ) {
      continue;
    }

    const historical = isHistoricalSupplementalPdfLabel(label);
    let score = 0;
    if (exactTitleMatch) {
      score += 30;
    }
    if (titleAcronymMatch) {
      score += titleAcronymMatches.some((token) => token.length >= 4) ? 26 : 20;
    }
    score += titleTokenOverlapCount * 8;
    if (hasDocumentRequirementSignal) {
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
        parserType: getLinkedDocumentParserType(resolvedUrl, label),
        score,
        exactTitleMatch,
        titleAcronymMatch,
        titleAcronymMatches,
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

    const candidateEntry = {
      ...entry,
      role: undefined,
      url: candidate.url,
      label: candidate.label,
    };
    if (!canRequirementSourceRoleCreateSchedulableRows(classifyRequirementSourceRole(candidateEntry))) {
      continue;
    }

    try {
      const rawParsed = await parseHtmlSource(
        candidateEntry,
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
        candidateEntry,
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
        candidate,
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

function isPathwayOwnerEntry(entry) {
  return Boolean(entry?.pathwayId) || /:pathway:/.test(String(entry?.ownerId ?? ""));
}

function getPathwayIdentityTokens(entry) {
  if (!isPathwayOwnerEntry(entry)) {
    return [];
  }

  const genericTokens = new Set([
    "base",
    "concentration",
    "default",
    "major",
    "option",
    "pathway",
    "route",
    "specialization",
    "standard",
    "track",
  ]);
  const baseTitleTokens = new Set(normalizeMatcherText(getPrimaryMajorTitle(entry)).split(" "));
  const ownerDescriptor = String(entry?.ownerTitle ?? "")
    .split(/\s+[-–—:]\s+/)
    .slice(1)
    .join(" ");
  const rawText = [
    entry?.pathwayId,
    ownerDescriptor,
    entry?.sourceLabel,
    entry?.label,
  ]
    .filter(Boolean)
    .join(" ");
  const acronymTokens = [...rawText.matchAll(/\b[A-Z0-9&]{2,8}\b/g)].map((match) =>
    match[0].toLowerCase()
  );
  const wordTokens = normalizeMatcherText(rawText)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 3 &&
        !genericTokens.has(token) &&
        !baseTitleTokens.has(token)
    );

  return uniqueInOrder([...acronymTokens, ...wordTokens]);
}

function getSupplementalHtmlPathwayIdentityScore(entry, candidate, parsed) {
  const pathwayTokens = getPathwayIdentityTokens(entry);
  if (!pathwayTokens.length) {
    return {
      score: 0,
      pathwayTokens,
      matchedTokens: [],
    };
  }

  const candidateText = normalizeMatcherText(
    [
      candidate?.label,
      candidate?.url,
      parsed?.title,
      ...(parsed?.headings ?? []).slice(0, 8),
      ...(parsed?.pathwayLabels ?? []).slice(0, 8),
      ...(parsed?.snapshotLines ?? []).slice(0, 24),
    ]
      .filter(Boolean)
      .join(" ")
  );
  const matchedTokens = pathwayTokens.filter((token) =>
    normalizedLineContainsToken(candidateText, token)
  );
  const compactPathwayId = normalizeMatcherText(entry?.pathwayId ?? "").replace(/\s+/g, "");
  const compactCandidateText = candidateText.replace(/\s+/g, "");
  let score = matchedTokens.length * 6;

  if (compactPathwayId && compactCandidateText.includes(compactPathwayId)) {
    score += 10;
  }
  if (matchedTokens.some((token) => token.length <= 4)) {
    score += 4;
  }
  if (
    matchedTokens.length >= Math.min(2, pathwayTokens.length) &&
    /\b(?:option|track|route|pathway|concentration|specialization|requirements?|curriculum)\b/.test(
      candidateText
    )
  ) {
    score += 6;
  }

  return {
    score,
    pathwayTokens,
    matchedTokens,
  };
}

function supplementalHtmlCandidateHasSelectedPathwayPhrase(entry, candidate, parsed) {
  const pathwayPhrase = normalizeMatcherText(String(entry?.pathwayId ?? "").replace(/[-_]+/g, " "))
    .split(" ")
    .filter((token) => token.length >= 3 && !PATHWAY_SCOPE_IDENTITY_STOPWORDS.has(token))
    .join(" ");
  if (!pathwayPhrase || !pathwayPhrase.split(" ").some((token) => token.length > 4)) {
    return true;
  }

  const candidateText = normalizeMatcherText(
    [
      candidate?.label,
      candidate?.url,
      parsed?.title,
      ...(parsed?.headings ?? []).slice(0, 8),
      ...(parsed?.pathwayLabels ?? []).slice(0, 8),
      ...(parsed?.snapshotLines ?? []).slice(0, 24),
    ]
      .filter(Boolean)
      .join(" ")
  );
  const compactPathwayId = normalizeMatcherText(entry?.pathwayId ?? "").replace(/\s+/g, "");
  const compactCandidateText = candidateText.replace(/\s+/g, "");
  return (
    candidateText.includes(pathwayPhrase) ||
    (!!compactPathwayId && compactCandidateText.includes(compactPathwayId))
  );
}

function hasFocusedPathwayRequirementSignal(entry, candidate, parsed) {
  const sampledText = normalizeMatcherText(
    [
      candidate?.label,
      parsed?.title,
      ...(parsed?.headings ?? []).slice(0, 8),
      ...(parsed?.requirementCueLines ?? []).slice(0, 12),
      ...(parsed?.snapshotLines ?? []).slice(0, 32),
    ]
      .filter(Boolean)
      .join(" ")
  );
  if (!sampledText) {
    return false;
  }

  if (
    parserRules.detectOptionReplacement({
      owner: entry,
      snapshotLines: parsed?.snapshotLines ?? [],
      sourceUrl: candidate?.url ?? entry?.url ?? null,
    })
  ) {
    return true;
  }

  return (
    /\b(?:degree|major|program|curriculum|requirements?)\b/.test(sampledText) &&
    /\b(?:option|track|route|pathway|concentration|specialization|core|electives?)\b/.test(
      sampledText
    ) &&
    ((parsed?.courseCodes ?? []).length >= 3 || (parsed?.requirementCueLines ?? []).length >= 2)
  );
}

function shouldPreferSupplementalHtmlSource(entry, baseParsed, candidate, htmlParsed) {
  if (!isPathwayOwnerEntry(entry) || !candidate || !hasMeaningfulParsedContent(htmlParsed)) {
    return false;
  }

  const candidateEntry = {
    ...entry,
    role: undefined,
    url: candidate.url,
    label: candidate.label,
  };
  const sourceRole = classifyRequirementSourceRole(candidateEntry);
  if (!canRequirementSourceRoleCreateSchedulableRows(sourceRole)) {
    return false;
  }
  if (
    GRADUATE_SUPPLEMENTAL_SOURCE_PATTERN.test(`${candidate.label ?? ""} ${candidate.url ?? ""}`) &&
    !/\bundergrad(?:uate)?\b/i.test(`${candidate.label ?? ""} ${candidate.url ?? ""}`)
  ) {
    return false;
  }

  const courseCount = htmlParsed.courseCodes?.length ?? 0;
  if (courseCount < 3) {
    return false;
  }

  const identity = getSupplementalHtmlPathwayIdentityScore(entry, candidate, htmlParsed);
  if (identity.score < 12 || identity.matchedTokens.length < 1) {
    return false;
  }
  if (
    identity.pathwayTokens.some((token) => token.length > 4) &&
    !identity.matchedTokens.some((token) => token.length > 4)
  ) {
    return false;
  }
  if (!supplementalHtmlCandidateHasSelectedPathwayPhrase(entry, candidate, htmlParsed)) {
    return false;
  }

  const parsedAlignmentScore = getParsedOwnerAlignmentScore(candidateEntry, htmlParsed);
  if (parsedAlignmentScore < 2) {
    return false;
  }
  if (!hasFocusedPathwayRequirementSignal(candidateEntry, candidate, htmlParsed)) {
    return false;
  }

  const baseCourseCount = baseParsed.courseCodes?.length ?? 0;
  if (baseCourseCount === 0 || candidate.type === "specialized" || candidate.sameProgramRequirementLink) {
    return true;
  }
  if (courseCount <= Math.max(80, Math.floor(baseCourseCount * 0.8))) {
    return true;
  }

  const childSignalScore = getParsedDegreeSheetSignalScore(htmlParsed);
  const baseSignalScore = getParsedDegreeSheetSignalScore(baseParsed);
  return childSignalScore >= baseSignalScore + 2 && courseCount <= Math.max(120, baseCourseCount);
}

function shouldPreferSupplementalDocumentSource(entry, baseParsed, candidate, documentParsed) {
  const hasStrongDocumentIdentity = Boolean(
    candidate?.exactTitleMatch || candidate?.titleAcronymMatch || candidate?.sameProgramRequirementLink
  );
  if (!hasStrongDocumentIdentity || candidate?.historical || !hasMeaningfulParsedContent(documentParsed)) {
    return false;
  }

  const documentEntry = {
    ...entry,
    url: candidate.url,
    label: candidate.label,
    parserType: candidate.parserType ?? getLinkedDocumentParserType(candidate.url, candidate.label),
  };
  const documentAlignment = getParsedOwnerAlignmentScore(documentEntry, documentParsed);
  if (documentAlignment < 2) {
    return false;
  }

  const documentCourseCount = documentParsed.courseCodes?.length ?? 0;
  if (documentCourseCount < 4) {
    return false;
  }

  const documentSignalScore = getParsedDegreeSheetSignalScore(documentParsed);
  const baseSignalScore = getParsedDegreeSheetSignalScore(baseParsed);
  const documentSourceRole = classifyRequirementSourceRole(documentEntry);
  const baseCourseCount = baseParsed.courseCodes?.length ?? 0;

  if (
    hasStrongDocumentIdentity &&
    ["pathway-degree-sheet", "primary-degree-requirements"].includes(documentSourceRole) &&
    documentSignalScore >= 4 &&
    baseCourseCount >= documentCourseCount * 2
  ) {
    return true;
  }

  if (documentSignalScore >= Math.max(4, baseSignalScore + 2)) {
    return true;
  }

  return documentCourseCount >= Math.max(6, Math.floor(baseCourseCount * 0.35));
}

async function parseLinkedDocumentSource(entry, candidate, timeoutMs) {
  const candidateEntry = {
    ...entry,
    role: undefined,
    url: candidate.url,
    label: candidate.label,
    parserType: candidate.parserType ?? getLinkedDocumentParserType(candidate.url, candidate.label),
  };

  if (isDocxSourceUrl(candidateEntry.url)) {
    return parseDocxSource(candidateEntry, timeoutMs);
  }

  return parsePdfSource(candidateEntry, timeoutMs);
}

async function parseSupplementalDocumentSources(entry, html, timeoutMs, visitedUrls) {
  const candidates = extractSupplementalDocumentLinkCandidates(entry, html);
  if (!candidates.length) {
    return [];
  }

  const parsedDocumentSources = [];

  for (const candidate of candidates) {
    if (visitedUrls.has(candidate.url)) {
      continue;
    }

    try {
      const parsed = await parseLinkedDocumentSource(entry, candidate, timeoutMs);

      if (!hasMeaningfulParsedContent(parsed)) {
        continue;
      }

      const parsedAlignmentScore = getParsedOwnerAlignmentScore(
        {
          ...entry,
          url: candidate.url,
          label: candidate.label,
          parserType: candidate.parserType ?? getLinkedDocumentParserType(candidate.url, candidate.label),
        },
        parsed
      );
      if (parsedAlignmentScore < 2) {
        continue;
      }

      parsedDocumentSources.push({
        candidate,
        parsed,
      });
    } catch {
      // Keep the main page parse if a linked official document fails.
    }
  }

  return parsedDocumentSources;
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
    getSourceRoleScore(entry) * 60 +
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

  if (
    canRequirementSourceCreateSchedulableRows(bestEntry) &&
    !canRequirementSourceCreateSchedulableRows(alternateEntry)
  ) {
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

  if (!canRequirementSourceCreateSchedulableRows(alternateEntry)) {
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

function buildParserRecoverySourceFingerprint(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex")
    .slice(0, 16);
}

function buildParserRecoveryOwnerSnapshot(owner) {
  const qualitySignals = owner.qualitySignals ?? buildParseQualitySignals(owner);
  return {
    parsedUwCourseCodeCount: owner.parsedUwCourseCodes?.length ?? 0,
    sourceOnlyUwCourseCodeCount: owner.sourceOnlyUwCourseCodes?.length ?? 0,
    structuredOnlyUwCourseCodeCount: owner.structuredOnlyUwCourseCodes?.length ?? 0,
    parsedRequirementGroupCount: owner.parsedRequirementGroups?.length ?? 0,
    parsedRequirementAtomCandidateCount: owner.parsedRequirementAtomCandidates?.length ?? 0,
    requirementCueLineCount: owner.requirementCueLines?.length ?? 0,
    chooseStatementCount: owner.chooseStatements?.length ?? 0,
    parseConfidence: owner.parseConfidence ?? "low",
    qualitySignalCodes: qualitySignals.map((signal) => signal.code),
    qualityWarningCodes: qualitySignals
      .filter((signal) => signal.severity === "warning")
      .map((signal) => signal.code),
    qualityWarningCount: qualitySignals.filter((signal) => signal.severity === "warning").length,
    sourceUrl: owner.sourceUrl ?? null,
    sourceRole: owner.sourceRole ?? null,
    sourceRoleStatus:
      owner.sourceRoleStatus ?? getRequirementSourceRoleStatus(owner.sourceRole ?? "ignored"),
    sourceFingerprint: buildParserRecoverySourceFingerprint({
      sourceUrl: owner.sourceUrl ?? null,
      sourceLabel: owner.sourceLabel ?? null,
      parsedUwCourseCodes: owner.parsedUwCourseCodes ?? [],
      requirementCueLines: (owner.requirementCueLines ?? []).slice(0, 20),
      chooseStatements: (owner.chooseStatements ?? []).slice(0, 20),
      qualitySignals,
    }),
  };
}

function getParserRecoveryTriggerCodes(owner) {
  if (!owner?.ok) {
    return [];
  }

  const qualitySignals = owner.qualitySignals ?? buildParseQualitySignals(owner);
  const triggerCodes = qualitySignals
    .map((signal) => signal.code)
    .filter((code) => PARSER_RECOVERY_TRIGGER_SIGNAL_CODES.has(code));

  if (
    owner.parseConfidence === "low" &&
    owner.canCreateSchedulableRows !== false &&
    !triggerCodes.includes("low-confidence-parsed-source")
  ) {
    triggerCodes.push("low-confidence-parsed-source");
  }

  return uniqueInOrder(triggerCodes);
}

function shouldTriggerParserRecovery(owner) {
  return getParserRecoveryTriggerCodes(owner).length > 0;
}

function getParserRecoveryCandidateParserType(entry, candidateUrl, candidateLabel = "") {
  if (isLinkedDocumentSourceUrl(candidateUrl)) {
    return getLinkedDocumentParserType(candidateUrl, candidateLabel);
  }

  if (/\/curriculum(?:[/?#]|$)|\bcurriculum\b/i.test(candidateUrl)) {
    return "html-curriculum-page";
  }

  if (/\/(?:degree|major)-requirements?(?:[/?#]|$)|\brequirements?\b/i.test(candidateUrl)) {
    return "html-degree-page";
  }

  if (["html-degree-page", "html-curriculum-page", "html-overview-page", "generic-html"].includes(entry.parserType)) {
    return entry.parserType;
  }

  return "html-degree-page";
}

function isParserRecoveryNoisyLink(label, url) {
  return /\b(apply|canvas|calendar|directory|map|myuw|library|tools|about|news|faculty|staff|contact|privacy|accessibility|terms|alumni|events|parking|transportation|research|housing|student life|jobs|visit|give|get involved|minors?|certificates?|graduate|scholarships?|course evaluations?|study abroad)\b/i.test(
    `${label ?? ""} ${url ?? ""}`
  );
}

function isSameOriginChildOrSiblingPage(baseUrl, resolvedUrl) {
  try {
    const base = new URL(baseUrl);
    const resolved = new URL(resolvedUrl);
    if (base.origin !== resolved.origin) {
      return false;
    }

    const baseSegments = base.pathname.split("/").filter(Boolean);
    const resolvedSegments = resolved.pathname.split("/").filter(Boolean);
    if (!baseSegments.length || !resolvedSegments.length) {
      return false;
    }

    const sharedPrefixLength = baseSegments.findIndex(
      (segment, index) => resolvedSegments[index] !== segment
    );
    const normalizedSharedPrefixLength =
      sharedPrefixLength === -1
        ? Math.min(baseSegments.length, resolvedSegments.length)
        : sharedPrefixLength;

    return normalizedSharedPrefixLength >= Math.max(1, Math.min(3, baseSegments.length - 1));
  } catch {
    return false;
  }
}

function isDifferentProgramSiblingPage(baseUrl, resolvedUrl) {
  try {
    const base = new URL(baseUrl);
    const resolved = new URL(resolvedUrl);
    if (base.origin !== resolved.origin) {
      return false;
    }

    const baseSegments = base.pathname.split("/").filter(Boolean);
    const resolvedSegments = resolved.pathname.split("/").filter(Boolean);
    const sharedPrefixLength = baseSegments.findIndex(
      (segment, index) => resolvedSegments[index] !== segment
    );
    const divergenceIndex =
      sharedPrefixLength === -1
        ? Math.min(baseSegments.length, resolvedSegments.length)
        : sharedPrefixLength;
    const parentSegment = baseSegments[divergenceIndex - 1];
    const baseDivergentSegment = baseSegments[divergenceIndex] ?? "";
    const resolvedDivergentSegment = resolvedSegments[divergenceIndex] ?? "";
    const divergentCredentialPrograms =
      parentSegment === "undergraduate" &&
      /^(?:bachelor|bachelors?|ba|bs|bba|major|minor)[-_]/i.test(baseDivergentSegment) &&
      /^(?:bachelor|bachelors?|ba|bs|bba|major|minor)[-_]/i.test(resolvedDivergentSegment);

    return (
      divergenceIndex > 0 &&
      (["majors", "programs", "degrees"].includes(parentSegment) || divergentCredentialPrograms) &&
      Boolean(baseSegments[divergenceIndex]) &&
      Boolean(resolvedSegments[divergenceIndex])
    );
  } catch {
    return false;
  }
}

function getParserRecoveryLinkSignals(entry, resolvedUrl, label) {
  const linkText = `${label ?? ""} ${resolvedUrl ?? ""}`;
  const normalizedLinkText = normalizeMatcherText(linkText);
  const exactTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  const exactTitleMatch = Boolean(exactTitle && normalizedLinkText.includes(exactTitle));
  const titleTokens = getTitleScopeTokens(entry);
  const titleTokenOverlapCount = titleTokens.filter((token) =>
    normalizedLinkText.includes(token)
  ).length;
  const highSignal = HIGH_SIGNAL_SUPPLEMENTAL_HTML_LINK_PATTERN.test(linkText);
  const pathwaySignal = SPECIALIZATION_SUPPLEMENTAL_HTML_LINK_PATTERN.test(linkText);
  const documentSignal =
    /\.pdf(?:$|[?#])/i.test(resolvedUrl) ||
    isDocxSourceUrl(resolvedUrl) ||
    PATHWAY_DEGREE_SHEET_CUE_PATTERN.test(linkText);
  const supportSignal =
    APPROVED_COURSE_LIST_CUE_PATTERN.test(linkText) ||
    ELECTIVE_LIST_CUE_PATTERN.test(linkText) ||
    ADMISSION_PREREQUISITE_SOURCE_CUE_PATTERN.test(linkText) ||
    SUPPORT_SOURCE_CUE_PATTERN.test(linkText);
  const sameProgramRequirementLink = isSameProgramRequirementLink(
    entry.url,
    resolvedUrl,
    linkText,
    highSignal || documentSignal
  );
  const sameProgramSpecializationLink = isSameProgramSpecializationHubLink(
    entry.url,
    resolvedUrl,
    linkText
  );
  const sameOriginChildOrSiblingPage = isSameOriginChildOrSiblingPage(entry.url, resolvedUrl);

  return {
    exactTitleMatch,
    titleTokenOverlapCount,
    highSignal,
    pathwaySignal,
    documentSignal,
    supportSignal,
    sameProgramRequirementLink,
    sameProgramSpecializationLink,
    sameOriginChildOrSiblingPage,
  };
}

function getParserRecoveryPathwayIdentityTokens(entry, value) {
  const primaryTitleTokens = normalizeMatcherText(getPrimaryMajorTitle(entry))
    .split(" ")
    .filter(Boolean);
  const primaryAcronym = primaryTitleTokens.map((token) => token[0]).join("");
  const primaryTokens = new Set([
    ...primaryTitleTokens,
    ...(primaryAcronym.length >= 2 ? [primaryAcronym] : []),
  ]);
  const genericTokens = new Set([
    "and",
    "bachelor",
    "business",
    "complete",
    "concentration",
    "courses",
    "current",
    "degree",
    "major",
    "option",
    "pathway",
    "program",
    "requirements",
    "route",
    "students",
    "track",
    "undergraduate",
  ]);

  return uniqueSorted(
    normalizeMatcherText(value)
      .split(" ")
      .filter(
        (token) =>
          token.length >= 3 &&
          !primaryTokens.has(token) &&
          !genericTokens.has(token)
      )
  );
}

function parserRecoveryCandidateConflictsWithPathway(entry, label, url) {
  if (!entry.pathwayId) {
    return false;
  }

  const linkText = `${label ?? ""} ${url ?? ""}`;
  if (!PATHWAY_SOURCE_CUE_PATTERN.test(linkText)) {
    return false;
  }

  const ownerIdentityText = normalizeMatcherText(
    `${entry.pathwayId ?? ""} ${entry.ownerTitle ?? ""} ${entry.sourceLabel ?? ""} ${entry.label ?? ""}`
  );
  const candidateOptionAcronym = linkText.match(/\b([A-Z][A-Z0-9&]{1,8})\s+Option\b/)?.[1];
  if (
    candidateOptionAcronym &&
    !ownerIdentityText.split(" ").includes(candidateOptionAcronym.toLowerCase())
  ) {
    return true;
  }

  const pathwayPhrase = normalizeMatcherText(String(entry.pathwayId ?? "").replace(/[-_]+/g, " "))
    .split(" ")
    .filter((token) => token.length >= 3 && !PATHWAY_SCOPE_IDENTITY_STOPWORDS.has(token))
    .join(" ");
  const normalizedLinkText = normalizeMatcherText(linkText);
  const compactPathwayId = normalizeMatcherText(entry.pathwayId ?? "").replace(/\s+/g, "");
  const compactLinkText = normalizedLinkText.replace(/\s+/g, "");
  if (
    pathwayPhrase.split(" ").some((token) => token.length > 4) &&
    !normalizedLinkText.includes(pathwayPhrase) &&
    !(compactPathwayId && compactLinkText.includes(compactPathwayId))
  ) {
    return true;
  }

  const ownerTokens = getParserRecoveryPathwayIdentityTokens(
    entry,
    ownerIdentityText
  );
  const candidateTokens = getParserRecoveryPathwayIdentityTokens(entry, linkText);

  return (
    ownerTokens.length > 0 &&
    candidateTokens.length > 0 &&
    !candidateTokens.some((token) => ownerTokens.includes(token))
  );
}

function parserRecoveryCandidateContainsSelectedPathwayPhrase(entry, label, url) {
  if (!entry.pathwayId) {
    return true;
  }

  const pathwayPhrase = normalizeMatcherText(String(entry.pathwayId ?? "").replace(/[-_]+/g, " "))
    .split(" ")
    .filter((token) => token.length >= 3 && !PATHWAY_SCOPE_IDENTITY_STOPWORDS.has(token))
    .join(" ");
  if (!pathwayPhrase || !pathwayPhrase.split(" ").some((token) => token.length > 4)) {
    return true;
  }

  const linkText = normalizeMatcherText(`${label ?? ""} ${url ?? ""}`);
  const compactPathwayId = normalizeMatcherText(entry.pathwayId ?? "").replace(/\s+/g, "");
  const compactLinkText = linkText.replace(/\s+/g, "");
  return (
    linkText.includes(pathwayPhrase) ||
    (!!compactPathwayId && compactLinkText.includes(compactPathwayId))
  );
}

function scoreParserRecoveryLinkCandidate(entry, resolvedUrl, label) {
  const signals = getParserRecoveryLinkSignals(entry, resolvedUrl, label);
  const linkText = `${label ?? ""} ${resolvedUrl ?? ""}`;
  let score = 0;

  if (signals.exactTitleMatch) {
    score += 30;
  }
  score += signals.titleTokenOverlapCount * 7;
  if (signals.highSignal) {
    score += 18;
  }
  if (signals.documentSignal) {
    score += 16;
  }
  if (signals.sameProgramRequirementLink) {
    score += 16;
  }
  if (signals.sameProgramSpecializationLink) {
    score += 14;
  }
  if (signals.sameOriginChildOrSiblingPage) {
    score += 8;
  }
  if (signals.pathwaySignal) {
    score += 8;
  }
  if (signals.supportSignal) {
    score += 8;
  }
  if (/\b(admissions?|degree requirements?|major requirements?|curriculum|prereq|worksheet|checklist|plan of study|program of study|study plan)\b/i.test(linkText)) {
    score += 8;
  }
  if (/\/(?:requirements?|curriculum|degree|program|pathways?|tracks?|options?|concentrations?|worksheets?|checklists?|prereq|admissions?)(?:[-/?#]|$)/i.test(resolvedUrl)) {
    score += 6;
  }
  if (GRADUATE_SUPPLEMENTAL_SOURCE_PATTERN.test(linkText)) {
    score -= 35;
  }

  return { score, signals };
}

function buildParserRecoveryCandidateStrategy(candidateEntry, signals) {
  const sourceRoleStatus = getRequirementSourceRoleStatus(classifyRequirementSourceRole(candidateEntry));
  if (sourceRoleStatus === "support") {
    return "support-source-recovery";
  }

  if (signals.documentSignal) {
    return "linked-official-document-recovery";
  }

  return "official-sibling-child-page-recovery";
}

function extractParserRecoveryLinkCandidates(entry, html) {
  const baseUrl = normalizeUrlForComparison(entry.url);
  if (!baseUrl) {
    return [];
  }

  const candidatesByUrl = new Map();

  for (const match of String(html ?? "").matchAll(HTML_LINK_PATTERN)) {
    const href = normalizeWhitespace(match[1] ?? match[2] ?? "");
    const label = stripHtml(match[3]);

    if (!href || !label || /^(?:#|javascript:|mailto:|tel:)/i.test(href)) {
      continue;
    }

    let resolvedUrl = null;
    try {
      resolvedUrl = normalizeUrlForComparison(new URL(href, entry.url).href);
    } catch {
      resolvedUrl = null;
    }

    if (!resolvedUrl || resolvedUrl === baseUrl || !isOfficialLinkedAssetUrl(entry.url, resolvedUrl)) {
      continue;
    }

    if (isParserRecoveryNoisyLink(label, resolvedUrl)) {
      continue;
    }

    if (GRADUATE_SUPPLEMENTAL_SOURCE_PATTERN.test(`${label} ${resolvedUrl}`)) {
      continue;
    }

    const { score, signals } = scoreParserRecoveryLinkCandidate(entry, resolvedUrl, label);
    if (parserRecoveryCandidateConflictsWithPathway(entry, label, resolvedUrl)) {
      continue;
    }
    if (
      entry.pathwayId &&
      signals.documentSignal &&
      !parserRecoveryCandidateContainsSelectedPathwayPhrase(entry, label, resolvedUrl)
    ) {
      continue;
    }
    if (
      isDifferentProgramSiblingPage(entry.url, resolvedUrl) &&
      !signals.sameProgramRequirementLink &&
      !signals.sameProgramSpecializationLink &&
      !signals.exactTitleMatch
    ) {
      continue;
    }
    if (
      !entry.pathwayId &&
      signals.pathwaySignal &&
      !signals.exactTitleMatch &&
      !PRIMARY_REQUIREMENT_CUE_PATTERN.test(`${label ?? ""} ${resolvedUrl ?? ""}`)
    ) {
      continue;
    }
    const hasOwnerIdentitySignal =
      signals.exactTitleMatch ||
      signals.titleTokenOverlapCount > 0 ||
      signals.sameProgramRequirementLink ||
      signals.sameProgramSpecializationLink ||
      (signals.sameOriginChildOrSiblingPage && signals.titleTokenOverlapCount > 0);
    const hasRelevantSignal =
      hasOwnerIdentitySignal ||
      (signals.supportSignal &&
        (signals.sameProgramRequirementLink ||
          signals.exactTitleMatch ||
          signals.titleTokenOverlapCount > 0)) ||
      (signals.documentSignal && hasOwnerIdentitySignal);

    if (!hasRelevantSignal || score < 12) {
      continue;
    }

    const candidateEntry = {
      ...entry,
      role: undefined,
      url: resolvedUrl,
      label,
      parserType: getParserRecoveryCandidateParserType(entry, resolvedUrl, label),
    };
    const strategy = buildParserRecoveryCandidateStrategy(candidateEntry, signals);
    const sourceRole = classifyRequirementSourceRole(candidateEntry);
    const sourceRoleStatus = getRequirementSourceRoleStatus(sourceRole);
    const existing = candidatesByUrl.get(resolvedUrl);
    const candidate = {
      strategy,
      url: resolvedUrl,
      label,
      parserType: candidateEntry.parserType,
      sourceRole,
      sourceRoleStatus,
      score,
      signals,
      reason:
        strategy === "linked-official-document-recovery"
          ? "official linked requirement document candidate"
          : strategy === "support-source-recovery"
            ? "official support source candidate"
            : "official child or sibling requirement page candidate",
    };

    if (!existing || candidate.score > existing.score) {
      candidatesByUrl.set(resolvedUrl, candidate);
    }
  }

  return [...candidatesByUrl.values()]
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, PARSER_RECOVERY_MAX_LINK_CANDIDATES);
}

function isParserRecoveryPathwaySectionBoundaryLine(line) {
  return /^(?:[A-Z][\w&'./-]+(?:\s+[A-Z][\w&'./-]+){0,8}\s+)?(?:Track|Option|Concentration|Pathway)(?:\s+(?:Degree|Major|Program|Curriculum|Requirements?|Courses?|Plan|Checklist))*$/i.test(
    normalizeWhitespace(line)
  );
}

function isParserRecoverySectionBoundaryLine(line) {
  return (
    HTML_SECTION_BOUNDARY_LINE_PATTERN.test(line) ||
    /^(?:Bachelor|Minor|Master|Doctor|Program of Study|Degree Requirements|Major Requirements|Admissions?|Application|Sample|Suggested Plan|Courses?)\b/i.test(
      line
    ) ||
    isParserRecoveryPathwaySectionBoundaryLine(line)
  );
}

function buildParserRecoverySectionCandidates(entry, artifacts) {
  const lines = artifacts?.lines ?? [];
  if (GRADUATE_SUPPLEMENTAL_SOURCE_PATTERN.test(`${entry.label ?? ""} ${entry.url ?? ""}`)) {
    return [];
  }

  if (!lines.length) {
    return [];
  }

  const exactTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  const titleTokens = getTitleScopeTokens(entry);
  const candidates = [];

  lines.forEach((line, index) => {
    const normalizedLine = normalizeMatcherText(line);
    if (!normalizedLine || GRADUATE_SUPPLEMENTAL_SOURCE_PATTERN.test(line)) {
      return;
    }

    let score = 0;
    if (exactTitle && normalizedLine.includes(exactTitle)) {
      score += 24;
    }
    score += titleTokens.filter((token) => normalizedLine.includes(token)).length * 5;
    if (STRUCTURAL_REQUIREMENT_PATTERN.test(line) || PRIMARY_REQUIREMENT_CUE_PATTERN.test(line)) {
      score += 12;
    }
    if (REQUIREMENT_CUE_PATTERN.test(line)) {
      score += 6;
    }
    if (PATHWAY_SOURCE_CUE_PATTERN.test(line)) {
      score += 5;
    }
    if (/\b(admission|apply|application|sample schedule|four[-\s]?year plan|graduate)\b/i.test(line)) {
      score -= 12;
    }

    if (score < 10) {
      return;
    }

    if (parserRecoveryCandidateConflictsWithPathway(entry, line, entry.url)) {
      return;
    }

    let endIndex = Math.min(lines.length, index + 220);
    for (let nextIndex = index + 1; nextIndex < endIndex; nextIndex += 1) {
      if (
        (nextIndex > index + 12 || isParserRecoveryPathwaySectionBoundaryLine(lines[nextIndex])) &&
        isParserRecoverySectionBoundaryLine(lines[nextIndex])
      ) {
        endIndex = nextIndex;
        break;
      }
    }

    const sectionLines = lines.slice(index, endIndex);
    const sampledText = sectionLines.slice(0, 60).join(" ");
    if (
      !REQUIREMENT_CUE_PATTERN.test(sampledText) &&
      !sectionLines.some((sectionLine) => extractCourseCodesFromLine(sectionLine).length > 0)
    ) {
      return;
    }

    candidates.push({
      strategy: "section-scoping-recovery",
      url: entry.url,
      label: `Scoped section: ${normalizeWhitespace(line).slice(0, 120)}`,
      parserType: entry.parserType,
      sourceRole: classifyRequirementSourceRole(entry),
      sourceRoleStatus: getRequirementSourceRoleStatus(classifyRequirementSourceRole(entry)),
      score,
      reason: "owner/requirement heading matched within a broader official source",
      sectionLineStart: index,
      sectionLineEnd: endIndex,
      sectionLines,
      title: artifacts.title ?? null,
      headings: artifacts.headings ?? [],
    });
  });

  return uniqueBy(
    candidates.sort((left, right) => right.score - left.score),
    (candidate) => `${candidate.sectionLineStart}:${candidate.sectionLineEnd}`
  ).slice(0, PARSER_RECOVERY_MAX_SECTION_CANDIDATES);
}

function buildParserRecoveryCandidateEntry(entry, candidate) {
  return {
    ...entry,
    role: candidate.strategy === "section-scoping-recovery" ? entry.role : undefined,
    url: candidate.url,
    label: candidate.label,
    parserType: candidate.parserType,
  };
}

function buildParserRecoveryAttemptRecord(candidate, status, details = {}) {
  const sourceEvidenceFingerprint = buildParserRecoverySourceFingerprint({
    strategy: candidate.strategy,
    sourceUrl: candidate.url,
    sourceLabel: candidate.label,
    parsedCourseCodes: details.parsedUwCourseCodes ?? [],
    snapshotLines: (details.snapshotLines ?? []).slice(0, 40),
    qualitySignalCodes: details.qualitySignalCodes ?? [],
  });

  return {
    strategy: candidate.strategy,
    status,
    sourceUrl: candidate.url ?? null,
    sourceLabel: candidate.label ?? null,
    parserType: candidate.parserType ?? null,
    sourceRole: details.sourceRole ?? candidate.sourceRole ?? null,
    sourceRoleStatus:
      details.sourceRoleStatus ?? candidate.sourceRoleStatus ?? getRequirementSourceRoleStatus(candidate.sourceRole ?? "ignored"),
    score: candidate.score ?? null,
    reason: details.reason ?? candidate.reason ?? null,
    parsedUwCourseCodeCount: details.parsedUwCourseCodes?.length ?? 0,
    qualitySignalCodes: details.qualitySignalCodes ?? [],
    qualityWarningCodes: details.qualityWarningCodes ?? [],
    sourceEvidenceFingerprint,
    error: details.error ?? null,
  };
}

async function parseParserRecoveryCandidate(
  baseResult,
  structuredCourseCodes,
  entry,
  candidate,
  timeoutMs
) {
  const candidateEntry = buildParserRecoveryCandidateEntry(entry, candidate);

  try {
    const parsed = candidate.sectionLines
      ? buildHtmlParsedResult(
          candidateEntry,
          candidate.title ?? null,
          candidate.headings ?? [],
          candidate.sectionLines,
          {
            sourceRole: classifyRequirementSourceRole(candidateEntry),
            sourceSectionAudit: {
              scoped: true,
              line: `Parser recovery scoped ${entry.ownerId} to lines ${candidate.sectionLineStart}-${candidate.sectionLineEnd} from ${entry.url}.`,
              sourceUrl: entry.url,
              ownerId: entry.ownerId,
              reason: "parser-warning-section-scoping",
            },
          }
        )
      : await selectRequirementSourceAdapter(candidateEntry).parse(candidateEntry, timeoutMs, {
          allowLinkedRecovery: false,
          visitedUrls: new Set([normalizeUrlForComparison(entry.url), normalizeUrlForComparison(candidate.url)].filter(Boolean)),
        });

    if (!hasMeaningfulParsedContent(parsed)) {
      return {
        owner: null,
        parsed,
        attempt: buildParserRecoveryAttemptRecord(candidate, "no-meaningful-content", {
          reason: "candidate parsed but did not expose requirement cues, choices, pathways, or UW course codes",
          snapshotLines: parsed.snapshotLines ?? [],
        }),
      };
    }

    const resolutionStrategy =
      normalizeUrlForComparison(candidateEntry.url) === normalizeUrlForComparison(entry.url)
        ? "primary-source"
        : "alternate-official-source";
    const owner = enrichParsedOwnerWithQualitySignals(
      buildManifestParseSuccess(
        baseResult,
        structuredCourseCodes,
        candidateEntry,
        parsed,
        resolutionStrategy
      )
    );
    const snapshot = buildParserRecoveryOwnerSnapshot(owner);

    return {
      owner,
      parsed,
      attempt: buildParserRecoveryAttemptRecord(candidate, "parsed", {
        sourceRole: owner.sourceRole,
        sourceRoleStatus: owner.sourceRoleStatus,
        parsedUwCourseCodes: owner.parsedUwCourseCodes ?? [],
        snapshotLines: parsed.snapshotLines ?? [],
        qualitySignalCodes: snapshot.qualitySignalCodes,
        qualityWarningCodes: snapshot.qualityWarningCodes,
      }),
    };
  } catch (error) {
    return {
      owner: null,
      parsed: null,
      attempt: buildParserRecoveryAttemptRecord(candidate, "parse-failed", {
        reason: "candidate failed during targeted parser recovery",
        error: error?.message ?? String(error),
      }),
    };
  }
}

function scoreOwnerForParserRecovery(owner) {
  const snapshot = buildParserRecoveryOwnerSnapshot(owner);
  const confidenceScore = owner.parseConfidence === "high" ? 70 : owner.parseConfidence === "medium" ? 35 : 0;
  return (
    snapshot.parsedUwCourseCodeCount * 100 +
    snapshot.parsedRequirementGroupCount * 35 +
    snapshot.parsedRequirementAtomCandidateCount * 15 +
    snapshot.requirementCueLineCount * 3 +
    snapshot.chooseStatementCount * 4 +
    confidenceScore -
    snapshot.qualityWarningCount * 120
  );
}

function parserRecoveryOwnerLooksTooBroad(beforeOwner, afterOwner, candidate) {
  const afterCount = afterOwner.parsedUwCourseCodes?.length ?? 0;
  const beforeStructuredCoverageCount = getStructuredCoverageCount(beforeOwner);
  const candidateSignals = candidate.signals ?? {};
  if (
    afterCount >= 80 &&
    !candidateSignals.exactTitleMatch &&
    !candidateSignals.sameProgramRequirementLink &&
    !candidateSignals.documentSignal
  ) {
    return true;
  }

  return (
    beforeStructuredCoverageCount > 0 &&
    afterCount > Math.max(60, beforeStructuredCoverageCount * 5) &&
    !candidateSignals.exactTitleMatch &&
    !candidateSignals.sameProgramRequirementLink
  );
}

function shouldAcceptParserRecoveryOwner(beforeOwner, afterOwner, candidate) {
  if (!afterOwner?.ok || afterOwner.supportOnly || afterOwner.canCreateSchedulableRows === false) {
    return false;
  }

  if (parserRecoveryOwnerLooksTooBroad(beforeOwner, afterOwner, candidate)) {
    return false;
  }

  const beforeSnapshot = buildParserRecoveryOwnerSnapshot(beforeOwner);
  const afterSnapshot = buildParserRecoveryOwnerSnapshot(afterOwner);
  if (afterSnapshot.parsedUwCourseCodeCount === 0) {
    return false;
  }

  if (
    (beforeOwner.canCreateSchedulableRows === false || beforeOwner.sourceRoleStatus !== "primary") &&
    afterOwner.canCreateSchedulableRows !== false &&
    afterOwner.sourceRoleStatus === "primary"
  ) {
    return true;
  }

  if (beforeSnapshot.parsedUwCourseCodeCount === 0 && afterSnapshot.parsedUwCourseCodeCount > 0) {
    return true;
  }

  if (
    afterSnapshot.parsedUwCourseCodeCount >= beforeSnapshot.parsedUwCourseCodeCount + 2 &&
    afterSnapshot.qualityWarningCount <= beforeSnapshot.qualityWarningCount
  ) {
    return true;
  }

  if (
    afterSnapshot.parsedUwCourseCodeCount >= beforeSnapshot.parsedUwCourseCodeCount &&
    afterSnapshot.qualityWarningCount < beforeSnapshot.qualityWarningCount
  ) {
    return true;
  }

  if (
    afterSnapshot.parsedRequirementGroupCount > beforeSnapshot.parsedRequirementGroupCount &&
    afterSnapshot.parsedUwCourseCodeCount >= beforeSnapshot.parsedUwCourseCodeCount
  ) {
    return true;
  }

  return scoreOwnerForParserRecovery(afterOwner) > scoreOwnerForParserRecovery(beforeOwner) + 120;
}

function normalizeRecoveredSupportList(owner, supportList, sourceOwner) {
  const sourceUrl = supportList.sourceUrl ?? sourceOwner.sourceUrl ?? owner.sourceUrl ?? null;
  const shape = supportList.shape ?? "support-list";
  return {
    ...supportList,
    id: `${owner.ownerId}${owner.pathwayId ? `:pathway:${owner.pathwayId}` : ""}:recovered-support:${slugify(
      `${sourceUrl ?? supportList.listTitle ?? shape}`
    )}:${shape}`,
    sourceUrl,
    sourceRole: supportList.sourceRole ?? sourceOwner.sourceRole ?? null,
    supportOnly: true,
    canCreateRequiredRow: false,
    canCreateScheduleRow: false,
  };
}

function getSupportMergeApprovedListKeys(owner) {
  const keys = new Set(
    (owner.supportLists ?? [])
      .map((supportList) => supportList.approvedListKey ?? supportList.filterKey ?? null)
      .filter(Boolean)
  );
  const inferredKey = inferApprovedListKeyFromSupportMetadata(owner);
  if (inferredKey) {
    keys.add(inferredKey);
  }
  return keys;
}

function shouldMergeRecoveredSupportList(owner, supportList) {
  const approvedListKey = supportList.approvedListKey ?? supportList.filterKey ?? null;
  if (!approvedListKey) {
    return true;
  }

  const targetKeys = getSupportMergeApprovedListKeys(owner);
  return !targetKeys.size || targetKeys.has(approvedListKey);
}

function mergeRecoveredSupportSources(owner, supportOwners) {
  const recoveredSupportLists = supportOwners.flatMap((supportOwner) =>
    (supportOwner.supportLists ?? []).map((supportList) =>
      normalizeRecoveredSupportList(owner, supportList, supportOwner)
    )
  ).filter((supportList) => shouldMergeRecoveredSupportList(owner, supportList));

  if (!recoveredSupportLists.length) {
    return owner;
  }

  return {
    ...owner,
    supportLists: uniqueBy(
      [...(owner.supportLists ?? []), ...recoveredSupportLists],
      (supportList) => `${supportList.sourceUrl}:${supportList.shape}:${supportList.approvedListKey ?? ""}`
    ),
  };
}

function classifyParserRecoveryBlocker(recovery) {
  const attempts = recovery.attempts ?? [];
  if (recovery.sourceUnavailable) {
    return "source-unavailable";
  }

  if (!attempts.length || !(recovery.candidateCount > 0)) {
    return "needs-deeper-discovery-rule";
  }

  const parsedAttempts = attempts.filter((attempt) => attempt.status === "parsed");
  if (
    parsedAttempts.length > 0 &&
    parsedAttempts.every((attempt) => attempt.sourceRoleStatus === "support")
  ) {
    return "source-support-only";
  }

  if (parsedAttempts.some((attempt) => attempt.parsedUwCourseCodeCount > 0)) {
    return "source-official-but-ambiguous";
  }

  return "needs-new-parser-rule";
}

function buildParserRecoveryReportOwner(owner, recovery) {
  return {
    ownerId: owner.ownerId,
    ownerTitle: owner.ownerTitle,
    planId: owner.planId,
    pathwayId: owner.pathwayId ?? null,
    campusId: owner.campusId,
    originalSourceUrl: recovery.originalSourceUrl,
    triggerCodes: recovery.triggerCodes ?? [],
    attemptedStrategies: recovery.attemptedStrategies ?? [],
    recoveredSources: recovery.recoveredSources ?? [],
    supportSources: recovery.supportSources ?? [],
    before: recovery.before,
    after: recovery.after,
    blockerType: recovery.blockerType ?? null,
    succeeded: recovery.succeeded === true,
  };
}

async function recoverParsedOwnerFromWarnings(owner, baseResult, structuredCourseCodes, entry, timeoutMs) {
  const beforeOwner = enrichParsedOwnerWithQualitySignals(owner);
  const triggerCodes = getParserRecoveryTriggerCodes(beforeOwner);
  if (!triggerCodes.length) {
    return beforeOwner;
  }

  const recovery = {
    triggered: true,
    triggerCodes,
    originalSourceUrl: beforeOwner.sourceUrl ?? entry.url,
    originalSourceLabel: beforeOwner.sourceLabel ?? entry.label,
    originalSourceFingerprint: buildParserRecoveryOwnerSnapshot(beforeOwner).sourceFingerprint,
    selectedStrategy: null,
    selectedSourceUrl: null,
    attemptedStrategies: [],
    attempts: [],
    recoveredSources: [],
    supportSources: [],
    before: buildParserRecoveryOwnerSnapshot(beforeOwner),
    after: null,
    blockerType: null,
    sourceUnavailable: false,
    candidateCount: 0,
    succeeded: false,
  };
  let artifacts = null;

  if (!/\.pdf(?:$|[?#])/i.test(entry.url) && !isDocxSourceUrl(entry.url)) {
    try {
      artifacts = await getHtmlSourceArtifacts(entry.url, timeoutMs);
    } catch (error) {
      artifacts = buildParserRecoveryArtifactsFromSnapshot(entry, beforeOwner);
      if (artifacts) {
        recovery.attempts.push(
          buildParserRecoveryAttemptRecord(
            {
              strategy: "source-artifact-recovery",
              url: entry.url,
              label: entry.label,
              parserType: entry.parserType,
              sourceRole: beforeOwner.sourceRole,
              sourceRoleStatus: beforeOwner.sourceRoleStatus,
              score: null,
              reason: "reuse cached source snapshot for parser recovery",
            },
            "snapshot-artifacts-used",
            {
              error: error?.message ?? String(error),
              snapshotLines: artifacts.lines,
            }
          )
        );
      } else {
        recovery.sourceUnavailable = true;
        recovery.attempts.push(
          buildParserRecoveryAttemptRecord(
            {
              strategy: "source-artifact-recovery",
              url: entry.url,
              label: entry.label,
              parserType: entry.parserType,
              sourceRole: beforeOwner.sourceRole,
              sourceRoleStatus: beforeOwner.sourceRoleStatus,
              score: null,
              reason: "refetch source HTML for parser recovery",
            },
            "source-unavailable",
            { error: error?.message ?? String(error) }
          )
        );
      }
    }
  }

  const hasScopedCatalogAnchor =
    isLegacyStudentCatalogSource(entry) &&
    Boolean(getRequestedUrlAnchor(entry.url)) &&
    beforeOwner.sourceSectionAudit?.anchorFound === true;
  const hasChildCredentialCatalogScope =
    isLegacyStudentCatalogSource(entry) &&
    shouldStopMajorLegacyCatalogScopeBeforeCredentialSections(entry);
  const sectionCandidates =
    artifacts && !hasScopedCatalogAnchor && !hasChildCredentialCatalogScope
      ? buildParserRecoverySectionCandidates(entry, artifacts)
      : [];
  const linkCandidates = artifacts && !hasChildCredentialCatalogScope
    ? extractParserRecoveryLinkCandidates(entry, artifacts.html)
    : [];
  const candidates = [...sectionCandidates, ...linkCandidates];
  recovery.candidateCount = candidates.length;
  recovery.attemptedStrategies = uniqueInOrder(
    candidates.map((candidate) => candidate.strategy)
  );

  let bestOwner = beforeOwner;
  let bestCandidate = null;
  let bestScore = scoreOwnerForParserRecovery(beforeOwner);
  const supportOwners = [];

  for (const candidate of candidates) {
    const result = await parseParserRecoveryCandidate(
      baseResult,
      structuredCourseCodes,
      entry,
      candidate,
      timeoutMs
    );
    recovery.attempts.push(result.attempt);

    if (!result.owner) {
      continue;
    }

    if (result.owner.supportOnly || result.owner.sourceRoleStatus === "support") {
      if ((result.owner.supportLists ?? []).length) {
        supportOwners.push(result.owner);
        recovery.supportSources.push({
          strategy: candidate.strategy,
          sourceUrl: result.owner.sourceUrl,
          sourceLabel: result.owner.sourceLabel,
          sourceRole: result.owner.sourceRole,
          acceptedUwCourseCodeCount: uniqueSorted(
            result.owner.supportLists.flatMap((supportList) => supportList.acceptedUwCourseCodes ?? [])
          ).length,
          sourceEvidenceFingerprint: result.attempt.sourceEvidenceFingerprint,
        });
      }
      continue;
    }

    if (!shouldAcceptParserRecoveryOwner(beforeOwner, result.owner, candidate)) {
      continue;
    }

    const candidateScore = scoreOwnerForParserRecovery(result.owner);
    if (!bestCandidate || candidateScore > bestScore) {
      bestCandidate = candidate;
      bestOwner = result.owner;
      bestScore = candidateScore;
    }
  }

  let finalOwner = bestOwner;
  if (supportOwners.length) {
    finalOwner = mergeRecoveredSupportSources(finalOwner, supportOwners);
  }
  finalOwner = enrichParsedOwnerWithQualitySignals(finalOwner);
  recovery.after = buildParserRecoveryOwnerSnapshot(finalOwner);

  if (bestCandidate) {
    recovery.selectedStrategy = bestCandidate.strategy;
    recovery.selectedSourceUrl = bestCandidate.url;
    recovery.recoveredSources.push({
      strategy: bestCandidate.strategy,
      sourceUrl: finalOwner.sourceUrl,
      sourceLabel: finalOwner.sourceLabel,
      sourceRole: finalOwner.sourceRole,
      parsedUwCourseCodeCount: finalOwner.parsedUwCourseCodes.length,
      sourceEvidenceFingerprint: recovery.after.sourceFingerprint,
    });
  }

  recovery.succeeded =
    Boolean(bestCandidate) ||
    (supportOwners.length > 0 && (finalOwner.supportLists ?? []).length > (beforeOwner.supportLists ?? []).length);
  recovery.blockerType = recovery.succeeded
    ? null
    : classifyParserRecoveryBlocker(recovery);

  return {
    ...finalOwner,
    parserRecovery: {
      ...recovery,
      blockerType:
        recovery.blockerType && PARSER_RECOVERY_BLOCKER_TYPES.has(recovery.blockerType)
          ? recovery.blockerType
          : recovery.blockerType,
    },
  };
}

async function finalizeParsedOwnerWithParserRecovery(
  owner,
  baseResult,
  structuredCourseCodes,
  entry,
  timeoutMs
) {
  const enrichedOwner = enrichParsedOwnerWithQualitySignals(owner);
  if (!shouldTriggerParserRecovery(enrichedOwner)) {
    return enrichedOwner;
  }

  try {
    return await recoverParsedOwnerFromWarnings(
      enrichedOwner,
      baseResult,
      structuredCourseCodes,
      entry,
      timeoutMs
    );
  } catch (error) {
    const before = buildParserRecoveryOwnerSnapshot(enrichedOwner);
    return {
      ...enrichedOwner,
      parserRecovery: {
        triggered: true,
        triggerCodes: getParserRecoveryTriggerCodes(enrichedOwner),
        originalSourceUrl: enrichedOwner.sourceUrl ?? entry.url,
        originalSourceLabel: enrichedOwner.sourceLabel ?? entry.label,
        originalSourceFingerprint: before.sourceFingerprint,
        selectedStrategy: null,
        selectedSourceUrl: null,
        attemptedStrategies: [],
        attempts: [
          {
            strategy: "parser-recovery-loop",
            status: "recovery-error",
            sourceUrl: enrichedOwner.sourceUrl ?? entry.url,
            sourceLabel: enrichedOwner.sourceLabel ?? entry.label,
            parserType: enrichedOwner.parserType ?? entry.parserType,
            sourceRole: enrichedOwner.sourceRole ?? null,
            sourceRoleStatus:
              enrichedOwner.sourceRoleStatus ??
              getRequirementSourceRoleStatus(enrichedOwner.sourceRole ?? "ignored"),
            score: null,
            reason: "parser recovery loop failed before a safe recovered source could be selected",
            parsedUwCourseCodeCount: enrichedOwner.parsedUwCourseCodes?.length ?? 0,
            qualitySignalCodes: before.qualitySignalCodes,
            qualityWarningCodes: before.qualityWarningCodes,
            sourceEvidenceFingerprint: before.sourceFingerprint,
            error: error?.message ?? String(error),
          },
        ],
        recoveredSources: [],
        supportSources: [],
        before,
        after: before,
        blockerType: "needs-new-parser-rule",
        sourceUnavailable: false,
        candidateCount: 0,
        succeeded: false,
      },
    };
  }
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

function flattenRequirementSourceScope(sourceScope) {
  return {
    sourceScope,
    canCreateRequiredRows: sourceScope.canCreateRequiredRows,
    canCreateOptionGroups: sourceScope.canCreateOptionGroups,
    canCreateCreditBuckets: sourceScope.canCreateCreditBuckets,
    canCreateCategoryOptions: sourceScope.canCreateCategoryOptions,
    canCreateApprovedFilters: sourceScope.canCreateApprovedFilters,
    canCreateElectiveLists: sourceScope.canCreateElectiveLists,
    canCreateSequencingHints: sourceScope.canCreateSequencingHints,
    canCreateAdmissionPrepRows: sourceScope.canCreateAdmissionPrepRows,
    canCreateScheduleRows: sourceScope.canCreateScheduleRows,
    supportOnly: sourceScope.supportOnly,
    nonSchedulable: sourceScope.nonSchedulable,
  };
}

function buildCourseEmissionKind(
  courseCode,
  sourceScope,
  parsedRequirementGroups,
  parsedRequirementCourses,
  parsedRequirementAtomCandidates = []
) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  if (!normalizedCourseCode) {
    return "hidden-support-metadata";
  }

  if (
    sourceScope.canCreateRequiredRows &&
    ((parsedRequirementCourses ?? []).some(
      (course) =>
        course.optionRole === "required" &&
        normalizeCourseCode(course.normalizedCourseCode ?? course.courseCode) === normalizedCourseCode
    ) ||
      (parsedRequirementAtomCandidates ?? []).some(
        (candidate) => normalizeCourseCode(candidate.uwCourseCode ?? "") === normalizedCourseCode
      ))
  ) {
    return "required-row";
  }

  if (
    sourceScope.canCreateOptionGroups &&
    (parsedRequirementGroups ?? []).some((group) =>
      (group.options ?? []).some((option) =>
        [
          ...(option.uwCourses ?? []),
          ...(option.equivalentUwCourseCodes ?? []),
          ...(option.displayCourseCodes ?? []),
        ]
          .map((code) => normalizeCourseCode(code))
          .includes(normalizedCourseCode)
      )
    )
  ) {
    return "option-group";
  }

  if (sourceScope.canCreateApprovedFilters) {
    return "approved-list-entry";
  }

  if (sourceScope.canCreateElectiveLists) {
    return "elective-list-entry";
  }

  return "hidden-support-metadata";
}

function buildSourceScopeAuditLines(input) {
  const sourceScope = input.sourceScope;
  const courseCodes = uniqueSorted(input.courseCodes ?? []);

  return courseCodes.map((courseCode) => {
    const emittedAs = buildCourseEmissionKind(
      courseCode,
      sourceScope,
      input.parsedRequirementGroups,
      input.parsedRequirementCourses,
      input.parsedRequirementAtomCandidates
    );
    const scheduled = sourceScope.canCreateScheduleRows && ["required-row", "option-group"].includes(emittedAs);
    const issue =
      sourceScope.supportOnly && ["required-row", "option-group"].includes(emittedAs)
        ? "support-source-created-required-row"
        : sourceScope.nonSchedulable && scheduled
          ? "non-schedulable-source-scheduled"
          : "none";

    return [
      "[source scope audit]",
      `Owner id: ${input.ownerId ?? "unknown"}`,
      `Source URL: ${input.sourceUrl ?? "n/a"}`,
      `Source role: ${input.sourceRole ?? "ignored"}`,
      `Support-only: ${sourceScope.supportOnly ? "yes" : "no"}`,
      `Can create required rows: ${sourceScope.canCreateRequiredRows ? "yes" : "no"}`,
      `Can create option groups: ${sourceScope.canCreateOptionGroups ? "yes" : "no"}`,
      `Can create approved filters: ${sourceScope.canCreateApprovedFilters ? "yes" : "no"}`,
      `Course code: ${courseCode}`,
      `Emitted as: ${emittedAs}`,
      `Scheduled: ${scheduled ? "yes" : "no"}`,
      `Issue: ${issue}`,
    ].join(" ");
  });
}

function buildParserSequenceChoiceAuditRows(input) {
  const atomCourseCodes = new Set(
    (input.parsedRequirementAtomCandidates ?? []).map((candidate) =>
      normalizeCourseCode(candidate.uwCourseCode ?? "")
    )
  );

  return (input.parsedRequirementGroups ?? [])
    .filter((group) => group.requirementType === "sequence_choice")
    .map((group) => {
      const sequencePaths = (group.sequencePaths ?? group.options ?? [])
        .map((path) => {
          const label = normalizeWhitespace(path.label ?? path.pathLabel ?? "") || "sequence path";
          const uwCourses = uniqueInOrder(
            (path.uwCourses ?? [])
              .map((courseCode) => normalizeCourseCode(courseCode))
              .filter(Boolean)
          );
          return `${label}: ${uwCourses.join(", ")}`;
        })
        .filter(Boolean);
      const sequencePathCourseCodes = uniqueInOrder(
        (group.sequencePaths ?? group.options ?? []).flatMap((path) => [
          ...(path.uwCourses ?? []),
          ...(path.conditionalLabCourses ?? []),
        ])
      ).map((courseCode) => normalizeCourseCode(courseCode));
      const emittedIndependentRequiredRows = sequencePathCourseCodes.some((courseCode) =>
        atomCourseCodes.has(courseCode)
      );
      const issue = emittedIndependentRequiredRows ? "flattened-sequence-paths" : "none";

      const row = {
        ownerId: input.ownerId ?? "unknown",
        sourceUrl: input.sourceUrl ?? "n/a",
        rawText: group.sourceRowText ?? group.sourceHeading ?? group.label,
        detectedSequenceChoice: true,
        sequencePaths,
        selectedDefaultPath: null,
        emittedIndependentRequiredRows,
        issue,
      };

      return {
        ...row,
        copyOnlyDebugText: [
          "[parser sequence-choice audit]",
          `Owner id: ${row.ownerId}`,
          `Source URL: ${row.sourceUrl}`,
          `Raw text: ${row.rawText}`,
          `Detected sequence choice: yes`,
          `Sequence paths: ${row.sequencePaths.join(" | ")}`,
          `Selected/default path: ${row.selectedDefaultPath ?? "none"}`,
          `Emitted independent required rows: ${row.emittedIndependentRequiredRows ? "yes" : "no"}`,
          `Issue: ${row.issue}`,
        ].join(" "),
      };
    });
}

function getSupportListContext(input) {
  return [
    input.planId,
    input.ownerId,
    input.ownerTitle,
    input.sourceLabel,
    input.sourceUrl,
    input.primarySourceLabel,
    input.primarySourceUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function inferApprovedListKeyFromSupportMetadata(input) {
  const context = getSupportListContext(input);
  // Temporary source-rule bridge: CE/CS approved-list support pages still need
  // stable list keys before runtime generation. Remove these plan checks once
  // support-list extraction derives approvedListKey from official owner/link
  // identity plus the source section heading instead of parser-side program ids.
  if (
    (input.planId === "uw-seattle-computer-engineering" ||
      /\bcomputer engineering\b/.test(context)) &&
    /\b(?:natural science|science)\b/.test(context)
  ) {
    return "computer-engineering-natural-science";
  }
  if (
    (input.planId === "uw-seattle-computer-science" ||
      /\b(?:computer science|allen school|data science)\b/.test(context)) &&
    /\b(?:natural science|science)\b/.test(context)
  ) {
    return "computer-science-approved-science";
  }
  if (/\bapproved\b/.test(context) && /\belectives?\b/.test(context)) {
    return `${slugify(input.planId || input.ownerId || "unknown-owner")}-approved-electives`;
  }
  return null;
}

function buildRequirementSupportListFromMetadata(input) {
  const sourceUrl = input.sourceUrl || input.primarySourceUrl || null;
  const listTitle =
    normalizeWhitespace(input.sourceLabel || input.primarySourceLabel || "") ||
    (input.shape === "elective-list" ? "Elective list" : "Approved course list");
  return {
    id: `${input.id || slugify(sourceUrl || listTitle)}:support-list:${input.shape}`,
    shape: input.shape,
    sourceUrl,
    sourceRole: input.sourceRole ?? null,
    listTitle,
    acceptedUwCourseCodes: uniqueSorted(
      (input.acceptedUwCourseCodes ?? []).map((courseCode) => normalizeCourseCode(courseCode))
    ),
    approvedListKey: input.approvedListKey ?? null,
    supportOnly: true,
    canCreateRequiredRow: false,
    canCreateScheduleRow: false,
    linkedPrimaryRequirementIds: [],
  };
}

function getRequirementSupportListSemanticKey(supportList) {
  const shape = String(supportList.shape ?? "");
  const sourceUrl = String(supportList.sourceUrl ?? "");
  const approvedListKey = String(supportList.approvedListKey ?? supportList.filterKey ?? "");
  if (
    approvedListKey &&
    (shape === "approved-filter-list" || shape === "approved-course-list")
  ) {
    return `approved:${sourceUrl}:${approvedListKey}`;
  }
  return supportList.id || `${shape}:${sourceUrl}:${supportList.listTitle ?? ""}`;
}

function buildRequirementSupportListsFromMetadata(input) {
  const approvedCodes = uniqueSorted(
    (input.approvedFilterUwCourseCodes ?? []).map((courseCode) => normalizeCourseCode(courseCode))
  );
  const electiveCodes = uniqueSorted(
    (input.electiveListUwCourseCodes ?? []).map((courseCode) => normalizeCourseCode(courseCode))
  );
  const supportOnlyCodes = uniqueSorted(
    (input.supportOnlyUwCourseCodes ?? []).map((courseCode) => normalizeCourseCode(courseCode))
  );
  const usedCodes = new Set([...approvedCodes, ...electiveCodes]);
  const remainingSupportOnlyCodes = supportOnlyCodes.filter((courseCode) => !usedCodes.has(courseCode));
  const approvedListKey = inferApprovedListKeyFromSupportMetadata(input);
  const supportLists = [];

  if (approvedCodes.length || (approvedListKey && input.sourceRole === "approved-course-list")) {
    supportLists.push(
      buildRequirementSupportListFromMetadata({
        ...input,
        shape: "approved-filter-list",
        acceptedUwCourseCodes: approvedCodes,
        approvedListKey,
      })
    );
  }

  if (electiveCodes.length) {
    supportLists.push(
      buildRequirementSupportListFromMetadata({
        ...input,
        shape: "elective-list",
        acceptedUwCourseCodes: electiveCodes,
        approvedListKey: null,
      })
    );
  }

  if (remainingSupportOnlyCodes.length) {
    const sourceRole = String(input.sourceRole ?? "");
    const shape =
      sourceRole === "elective-list"
        ? "elective-list"
        : sourceRole === "approved-course-list" ||
          sourceRole === "admission-prerequisite-source" ||
          sourceRole === "admissions-preparation" ||
          sourceRole === "support-source"
          ? "approved-course-list"
          : null;
    if (shape) {
      supportLists.push(
        buildRequirementSupportListFromMetadata({
          ...input,
          shape,
          acceptedUwCourseCodes: remainingSupportOnlyCodes,
          approvedListKey: shape === "approved-course-list" ? approvedListKey : null,
        })
      );
    }
  }

  return uniqueBy(supportLists, getRequirementSupportListSemanticKey);
}

function buildRequirementSupportListsFromParsedRequirementGroups(input) {
  const supportLists = [];
  for (const group of input.parsedRequirementGroups ?? []) {
    const approvedListKey = normalizeWhitespace(group.approvedListKey ?? "");
    if (!approvedListKey || group.programSpecific !== true) {
      continue;
    }

    const descriptor = detectSubjectPrefixCreditBucket(
      input,
      group.sourceRowText ?? group.sourceHeading ?? group.label
    );
    if (!descriptor?.approvedUwCourseCodes?.length || descriptor.approvedListKey !== approvedListKey) {
      continue;
    }

    const sourceListedPrefixCodes = uniqueSorted(
      (input.parsedUwCourseCodes ?? [])
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter((courseCode) => courseCode.startsWith(`${descriptor.subjectPrefix} `))
    );
    supportLists.push(
      buildRequirementSupportListFromMetadata({
        ...input,
        id: group.id,
        shape: "approved-filter-list",
        sourceLabel: group.label,
        acceptedUwCourseCodes: uniqueSorted([
          ...descriptor.approvedUwCourseCodes,
          ...sourceListedPrefixCodes,
        ]),
        approvedListKey,
      })
    );
  }

  return uniqueBy(supportLists, getRequirementSupportListSemanticKey);
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
  const metadataSourceRole = classifyRequirementSourceRole(effectiveEntry);
  const parsedSourceRole = parsed.sourceRole ?? null;
  const sourceRole = shouldUseTacomaMetadataPrimaryRole(
    effectiveEntry,
    parsedSourceRole,
    metadataSourceRole,
    parsed
  )
    ? metadataSourceRole
    : parsedSourceRole ?? metadataSourceRole;
  const sourceRoleStatus = getRequirementSourceRoleStatus(sourceRole);
  const sourceScope = buildRequirementSourceScope(sourceRole);
  const allInitialParsedCourseCodes = uniqueSorted(
    parserRules.filterCourseCodesBySupportOnlyEvidence({
      courseCodes: uniqueSorted([
        ...(parsed.courseCodes ?? []),
        ...recoverStructuredCourseCodesFromSourceEvidence(effectiveEntry, structuredCourseCodes, parsed),
      ]),
      lines: parsed.snapshotLines ?? [],
      getSourceLineHints: (courseCode) => getSourceLineHints(parsed.snapshotLines ?? [], courseCode),
    })
  );
  const sourceSectionFilterAuditRows = buildParserPrerequisiteFilterAuditRows({
    ownerId: baseResult.ownerId,
    sourceUrl: effectiveSourceUrl,
    sourceRole,
    headings: parsed.headings ?? [],
    snapshotLines: parsed.snapshotLines ?? [],
  });
  const directSourceLineCourseCodes = extractSafeDirectCourseLineCodesFromLines(
    effectiveEntry,
    parsed.snapshotLines ?? []
  );
  const schedulableDirectSourceLineCourseCodes = sourceScope.canCreateScheduleRows
    ? filterParsedCourseCodesBySourceSections(
        directSourceLineCourseCodes,
        sourceSectionFilterAuditRows
      )
    : directSourceLineCourseCodes;
  const initialParsedCourseCodes = uniqueSorted([
    ...(sourceScope.canCreateScheduleRows
      ? filterParsedCourseCodesBySourceSections(
          allInitialParsedCourseCodes,
          sourceSectionFilterAuditRows
        )
      : allInitialParsedCourseCodes),
    ...schedulableDirectSourceLineCourseCodes,
  ]);
  const blockedSourceSectionCourseCodes = sourceScope.canCreateScheduleRows
    ? getBlockedSourceSectionCourseCodes(sourceSectionFilterAuditRows).filter(
        (courseCode) => !initialParsedCourseCodes.includes(courseCode)
      )
    : [];
  const schedulableSnapshotLines = sourceScope.canCreateScheduleRows
    ? getSchedulableSourceSectionLines(
        parsed.snapshotLines ?? [],
        sourceSectionFilterAuditRows
      )
    : parsed.snapshotLines ?? [];
  const canCreateStructuredRequirementGroups =
    sourceScope.canCreateOptionGroups ||
    sourceScope.canCreateCreditBuckets ||
    sourceScope.canCreateCategoryOptions;
  const rawParsedRequirementGroups = canCreateStructuredRequirementGroups
    ? filterParsedRequirementGroupsBySourceSections(
        buildParsedRequirementGroups(
          baseResult,
          initialParsedCourseCodes,
          parsed.snapshotLines
        ),
        sourceSectionFilterAuditRows
      )
    : [];
  const parsedRequirementGroups = rawParsedRequirementGroups.map((group) => {
    const sourceSectionDecision = getGroupSourceSectionDecision(
      group,
      sourceSectionFilterAuditRows
    );
    return {
      ...group,
      sourceRole,
      supportOnly: sourceScope.supportOnly,
      sourceUrl: effectiveSourceUrl,
      sourceRowText: group.sourceRowText ?? group.sourceHeading ?? null,
      sourceSection: group.sourceSection ?? null,
      sourceSectionRole: sourceSectionDecision.detectedSectionRole ?? null,
      sourceSectionSchedulable: sourceSectionDecision.schedulable ?? null,
      detectedOptionCue: group.detectedOptionCue ?? detectOptionCue(group.sourceHeading ?? group.label),
      approvedListKey: group.approvedListKey ?? null,
      canCreatePlaceholder:
        typeof group.canCreatePlaceholder === "boolean"
          ? group.canCreatePlaceholder
          : group.requirementType === "choose_credits",
      programSpecific: typeof group.programSpecific === "boolean" ? group.programSpecific : null,
      selectionCount:
        group.selectionCount ??
        (group.requirementType !== "choose_credits" &&
        group.minCourses != null &&
        group.minCourses === group.maxCourses
          ? group.minCourses
          : null),
      requiredCount:
        group.requiredCount ??
        (group.requirementType !== "choose_credits" &&
        group.minCourses != null &&
        group.minCourses === group.maxCourses
          ? group.minCourses
          : null),
    };
  });
  const parsedRequirementCourses = sourceScope.canCreateRequiredRows
    ? buildSourceDerivedRequirementCourses(parsedRequirementGroups)
    : [];
  const parsedRequirementReplacements = sourceScope.canCreateRequiredRows
    ? buildSourceDerivedRequirementReplacements(
        { ...baseResult, sourceUrl: effectiveSourceUrl },
        parsed.snapshotLines ?? []
      )
    : [];
  const parsedCourseCodes = uniqueSorted([
    ...initialParsedCourseCodes,
    ...extractParsedRequirementGroupCourseCodes(parsedRequirementGroups),
    ...(parsedRequirementCourses ?? []).map((course) => course.normalizedCourseCode),
  ]);
  const inferredApprovedListKey = inferApprovedListKeyFromSupportMetadata({
    ...baseResult,
    sourceUrl: effectiveSourceUrl,
    sourceLabel: effectiveSourceLabel,
    sourceRole,
  });
  const approvedFilterUwCourseCodes = sourceScope.canCreateApprovedFilters
    ? getApprovedFilterCodesForSupportSource({
        filterKey: inferredApprovedListKey,
        owner: {
          ...baseResult,
          sourceUrl: effectiveSourceUrl,
          sourceLabel: effectiveSourceLabel,
          sourceRole,
        },
        lines: parsed.snapshotLines ?? [],
        fallbackCourseCodes: parsedCourseCodes,
      })
    : [];
  const electiveListUwCourseCodes = sourceScope.canCreateElectiveLists
    ? parsedCourseCodes
    : [];
  const supportOnlyUwCourseCodes =
    sourceScope.supportOnly || sourceScope.nonSchedulable
      ? parsedCourseCodes
      : [];
  const supportListInput = {
    ...baseResult,
    id: `${baseResult.ownerId}${baseResult.pathwayId ? `:pathway:${baseResult.pathwayId}` : ""}:source-block:${selectRequirementSourceAdapter(effectiveEntry).id}`,
    sourceUrl: effectiveSourceUrl,
    sourceLabel: effectiveSourceLabel,
    sourceRole,
    parserType: effectiveParserType,
    approvedFilterUwCourseCodes,
    electiveListUwCourseCodes,
    supportOnlyUwCourseCodes,
    sourceSectionFilterAuditRows,
  };
  const supportLists = uniqueBy(
    [
      ...buildRequirementSupportListsFromMetadata(supportListInput),
      ...buildRequirementSupportListsFromParsedRequirementGroups({
        ...supportListInput,
        parsedRequirementGroups,
        parsedUwCourseCodes: parsedCourseCodes,
      }),
      ...buildSupportListsFromSourceSectionAuditRows(supportListInput),
    ],
    getRequirementSupportListSemanticKey
  );
  const sourceOnlyCourseCodes = parsedCourseCodes.filter(
    (code) => !structuredCourseCodes.includes(code)
  );
  const structuredOnlyCourseCodes = structuredCourseCodes.filter(
    (code) => !parsedCourseCodes.includes(code)
  );
  const snapshotPath =
    parsed.snapshotPath ??
    writeSnapshot(baseResult.ownerId, effectiveSourceUrl, parsed.title, parsed.snapshotLines, {
      headings: parsed.headings,
    });
  const canCreateSchedulableRows = sourceScope.canCreateScheduleRows;
  const parsedRequirementGroupCourseCodeSet = new Set(
    extractParsedRequirementGroupCourseCodes(
      parsedRequirementGroups.filter((group) => group.requirementType !== "all_required")
    ).map((courseCode) => normalizeCourseCode(courseCode))
  );
  const parsedRequirementAtomCandidates = sourceScope.canCreateRequiredRows
    ? buildParsedRequirementAtomCandidates(
        baseResult,
        parsedCourseCodes.filter(
          (courseCode) => !parsedRequirementGroupCourseCodeSet.has(normalizeCourseCode(courseCode))
        ),
        parsed.snapshotLines,
        sourceSectionFilterAuditRows
      )
    : [];
  const parserSequenceChoiceAuditRows = buildParserSequenceChoiceAuditRows({
    ownerId: baseResult.ownerId,
    sourceUrl: effectiveSourceUrl,
    parsedRequirementGroups,
    parsedRequirementAtomCandidates,
  });
  const parsedDegreeMapBlockCandidates = sourceScope.canCreateScheduleRows
    ? buildParsedDegreeMapBlockCandidates(
        baseResult,
        parsedCourseCodes,
        parsed.requirementCueLines,
        parsed.chooseStatements,
        parsed.pathwayLabels,
        parsed.headings
      )
    : [];
  const sourceScopeAuditLines = buildSourceScopeAuditLines({
    ownerId: baseResult.ownerId,
    sourceUrl: effectiveSourceUrl,
    sourceRole,
    sourceScope,
    courseCodes: uniqueSorted([...parsedCourseCodes, ...blockedSourceSectionCourseCodes]),
    parsedRequirementGroups,
    parsedRequirementCourses,
    parsedRequirementAtomCandidates,
  });

  return {
    ...baseResult,
    parserType: effectiveParserType,
    adapterId: selectRequirementSourceAdapter(effectiveEntry).id,
    adapterFamily: selectRequirementSourceAdapter(effectiveEntry).family,
    sourceUrl: effectiveSourceUrl,
    sourceLabel: effectiveSourceLabel,
    sourceRole,
    sourceRoleStatus,
    canCreateSchedulableRows,
    ...flattenRequirementSourceScope(sourceScope),
    sourceSectionAudit: parsed.sourceSectionAudit ?? null,
    sourceSectionFilterAuditRows,
    sourceSectionFilterAuditLines: sourceSectionFilterAuditRows.map(
      (row) => row.copyOnlyDebugText
    ),
    parserSequenceChoiceAuditRows,
    parserSequenceChoiceAuditLines: parserSequenceChoiceAuditRows.map(
      (row) => row.copyOnlyDebugText
    ),
    sourceScopeAuditLines,
    resolutionStrategy,
    ok: true,
    extractedTitle: parsed.title,
    extractedHeadings: parsed.headings,
    requirementCueLines: parsed.requirementCueLines,
    chooseStatements: parsed.chooseStatements,
    pathwayLabels: parsed.pathwayLabels,
    parsedUwCourseCodes: parsedCourseCodes,
    approvedFilterUwCourseCodes,
    electiveListUwCourseCodes,
    supportOnlyUwCourseCodes,
    supportLists,
    sourceOnlyUwCourseCodes: sourceOnlyCourseCodes,
    structuredOnlyUwCourseCodes: structuredOnlyCourseCodes,
    parsedRequirementAtomCandidates,
    parsedDegreeMapBlockCandidates,
    parsedRequirementGroups,
    parsedRequirementCourses,
    parsedRequirementReplacements,
    parseConfidence: parsed.parseConfidence,
    snapshotPath,
    snapshotHasHeadingMetadata: parsed.snapshotHasHeadingMetadata,
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
    isPrimaryDegreeRequirementsLink: Boolean(entry.isPrimaryDegreeRequirementsLink),
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

    const sourceRole = classifyRequirementSourceRole(entry);
    const sourceRoleStatus = getRequirementSourceRoleStatus(sourceRole);
    const sourceScope = buildRequirementSourceScope(sourceRole);
    return {
      ...baseResult,
      parserType: entry.parserType,
      adapterId: primaryAdapter.id,
      adapterFamily: primaryAdapter.family,
      sourceUrl: entry.url,
      sourceLabel: entry.label,
      sourceRole,
      sourceRoleStatus,
      canCreateSchedulableRows: sourceScope.canCreateScheduleRows,
      ...flattenRequirementSourceScope(sourceScope),
      sourceSectionAudit: null,
      sourceSectionFilterAuditRows: [],
      sourceSectionFilterAuditLines: [],
      parserSequenceChoiceAuditRows: [],
      parserSequenceChoiceAuditLines: [],
      sourceScopeAuditLines: [],
      resolutionStrategy: "cached-snapshot",
      ok: false,
      extractedTitle: null,
      extractedHeadings: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: [],
      parsedUwCourseCodes: [],
      approvedFilterUwCourseCodes: [],
      electiveListUwCourseCodes: [],
      supportOnlyUwCourseCodes: [],
      supportLists: [],
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

    return finalizeParsedOwnerWithParserRecovery(
      buildManifestParseSuccess(
        baseResult,
        structuredCourseCodes,
        bestEntry,
        mergedParsed,
        bestResolutionStrategy
      ),
      baseResult,
      structuredCourseCodes,
      bestEntry,
      timeoutMs
    );
  } catch (error) {
    for (const alternateEntry of getAlternateParseableManifestEntries(entry)) {
      try {
        const alternateAdapter = selectRequirementSourceAdapter(alternateEntry);
        const parsed = await alternateAdapter.parse(alternateEntry, timeoutMs);
        if (!hasMeaningfulParsedContent(parsed)) {
          continue;
        }

        return finalizeParsedOwnerWithParserRecovery(
          buildManifestParseSuccess(
            baseResult,
            structuredCourseCodes,
            alternateEntry,
            parsed,
            "alternate-official-source"
          ),
          baseResult,
          structuredCourseCodes,
          alternateEntry,
          timeoutMs
        );
      } catch {
        // Keep trying other official sources for the same owner before falling back to cached snapshots.
      }
    }

    const snapshotParsed = parseSnapshotSource(entry, error);
    if (snapshotParsed) {
      return finalizeParsedOwnerWithParserRecovery(
        buildManifestParseSuccess(
          baseResult,
          structuredCourseCodes,
          entry,
          snapshotParsed,
          "cached-snapshot"
        ),
        baseResult,
        structuredCourseCodes,
        entry,
        timeoutMs
      );
    }

    const sourceRole = classifyRequirementSourceRole(entry);
    const sourceRoleStatus = getRequirementSourceRoleStatus(sourceRole);
    const sourceScope = buildRequirementSourceScope(sourceRole);
    return {
      ...baseResult,
      parserType: entry.parserType,
      adapterId: primaryAdapter.id,
      adapterFamily: primaryAdapter.family,
      sourceUrl: entry.url,
      sourceLabel: entry.label,
      sourceRole,
      sourceRoleStatus,
      canCreateSchedulableRows: sourceScope.canCreateScheduleRows,
      ...flattenRequirementSourceScope(sourceScope),
      sourceSectionAudit: null,
      sourceSectionFilterAuditRows: [],
      sourceSectionFilterAuditLines: [],
      parserSequenceChoiceAuditRows: [],
      parserSequenceChoiceAuditLines: [],
      sourceScopeAuditLines: [],
      resolutionStrategy: "primary-source",
      ok: false,
      extractedTitle: null,
      extractedHeadings: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: [],
      parsedUwCourseCodes: [],
      approvedFilterUwCourseCodes: [],
      electiveListUwCourseCodes: [],
      supportOnlyUwCourseCodes: [],
      supportLists: [],
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

function shouldParseRequirementSourceEntry(entry) {
  if (entry.isPrimaryDegreeRequirementsLink) {
    return true;
  }

  const sourceRole = classifyRequirementSourceRole(entry);
  return (
    getRequirementSourceRoleStatus(sourceRole) === "primary" ||
    PARSEABLE_SUPPORT_SOURCE_ROLES.has(sourceRole)
  );
}

function normalizeSpecializedPlanToken(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 4 &&
        ![
          "bachelor",
          "business",
          "administration",
          "option",
          "track",
          "route",
          "pathway",
          "certificate",
          "concentration",
        ].includes(token)
    );
}

function normalizeSpecializedPlanCandidateToken(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 2 &&
        ![
          "bachelor",
          "business",
          "administration",
          "option",
          "track",
          "route",
          "pathway",
          "certificate",
          "concentration",
        ].includes(token)
    );
}

function getSpecializedPlanTitleTokens(title) {
  const match = String(title ?? "").match(/:\s*([^()]+?)(?:\s*\([^)]*\))?\s*$/);
  return match ? normalizeSpecializedPlanToken(match[1]) : [];
}

function specializedPlanTokensMatchCandidate(planTokens, candidateTokens, candidateAcronymTokens = candidateTokens) {
  if (planTokens.every((token) => candidateTokens.has(token))) {
    return true;
  }

  const acronym = planTokens.length >= 2 ? planTokens.map((token) => token[0]).join("") : "";
  return Boolean(acronym && candidateAcronymTokens.has(acronym));
}

function manifestEntryMatchesSpecializedPlanTitle(entry) {
  const planTitle = BOOTSTRAP_PLAN_TITLES_BY_ID.get(entry.planId);
  const planTokens = getSpecializedPlanTitleTokens(planTitle);
  if (!entry?.pathwayId) {
    const planIsBa = /\bB\.?\s*A\.?\b|\(BA\)/i.test(String(planTitle ?? ""));
    const planIsBs = /\bB\.?\s*S\.?\b|\(BS\)/i.test(String(planTitle ?? ""));
    const sourceText = `${entry.label ?? ""} ${entry.url ?? ""}`;
    const sourceIsBa = /\bB\.?\s*A\.?\b|\bba[-\s]/i.test(sourceText);
    const sourceIsBs = /\bB\.?\s*S\.?\b|\bbs[-\s]/i.test(sourceText);

    if ((planIsBa && sourceIsBs && !sourceIsBa) || (planIsBs && sourceIsBa && !sourceIsBs)) {
      return false;
    }

    if (!planTokens.length) {
      return true;
    }

    const candidateText = `${entry.label ?? ""} ${entry.url ?? ""}`;
    const candidateTokens = new Set(normalizeSpecializedPlanToken(candidateText));
    const candidateAcronymTokens = new Set(normalizeSpecializedPlanCandidateToken(candidateText));
    return specializedPlanTokensMatchCandidate(planTokens, candidateTokens, candidateAcronymTokens);
  }

  const planIsBa = /\bB\.?\s*A\.?\b|\(BA\)/i.test(String(planTitle ?? ""));
  const planIsBs = /\bB\.?\s*S\.?\b|\(BS\)/i.test(String(planTitle ?? ""));
  const pathwayText = `${entry.pathwayId ?? ""} ${entry.label ?? ""}`;
  const pathwayIsBa = /\bB\.?\s*A\.?\b|\bba[-\s]/i.test(pathwayText);
  const pathwayIsBs = /\bB\.?\s*S\.?\b|\bbs[-\s]/i.test(pathwayText);

  if ((planIsBa && pathwayIsBs && !pathwayIsBa) || (planIsBs && pathwayIsBa && !pathwayIsBs)) {
    return false;
  }

  if (!planTokens.length) {
    return true;
  }

  const candidateText = `${entry.pathwayId ?? ""} ${entry.label ?? ""} ${entry.url ?? ""}`;
  const candidateTokens = new Set(normalizeSpecializedPlanToken(candidateText));
  const candidateAcronymTokens = new Set(normalizeSpecializedPlanCandidateToken(candidateText));
  return specializedPlanTokensMatchCandidate(planTokens, candidateTokens, candidateAcronymTokens);
}

function getParseablePrimaryEntries(targetPlanId = null) {
  const entries = TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
    (entry) =>
      (entry.ownerType === "major" || entry.ownerType === "pathway") &&
      entry.campusId &&
      entry.campusId !== "grc" &&
      (!targetPlanId || entry.planId === targetPlanId) &&
      manifestEntryMatchesSpecializedPlanTitle(entry) &&
      shouldParseRequirementSourceEntry(entry) &&
      PARSEABLE_PARSER_TYPES.has(entry.parserType)
  );

  const anchoredPrimaryBaseKeys = new Set(
    entries
      .filter((entry) => entry.isPrimaryDegreeRequirementsLink && sourceUrlHasHash(entry.url))
      .map((entry) => `${entry.ownerId}\u0000${normalizeManifestUrlWithoutHashForDedupe(entry.url)}`)
  );

  return entries
    .filter((entry) => {
      if (entry.isPrimaryDegreeRequirementsLink || sourceUrlHasHash(entry.url)) {
        return true;
      }
      return !anchoredPrimaryBaseKeys.has(
        `${entry.ownerId}\u0000${normalizeManifestUrlWithoutHashForDedupe(entry.url)}`
      );
    })
    .sort((left, right) => left.ownerTitle.localeCompare(right.ownerTitle));
}

function normalizeManifestUrlForDedupe(value) {
  try {
    const parsed = new URL(String(value ?? ""));
    const normalizedPathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${normalizedPathname}${parsed.search}${parsed.hash}`;
  } catch {
    return normalizeWhitespace(String(value ?? ""));
  }
}

function normalizeManifestUrlWithoutHashForDedupe(value) {
  try {
    const parsed = new URL(String(value ?? ""));
    parsed.hash = "";
    const normalizedPathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${normalizedPathname}${parsed.search}`;
  } catch {
    return normalizeWhitespace(String(value ?? "")).replace(/#.*$/u, "");
  }
}

function getParseableManifestEntryDedupeKey(entry) {
  const ownerId = entry.ownerId ?? `${entry.planId ?? ""}:${entry.pathwayId ?? ""}`;
  return [
    ownerId,
    normalizeManifestUrlForDedupe(entry.url),
    entry.parserType ?? "",
    classifyRequirementSourceRole(entry),
  ].join("\u0000");
}

function compareParseableManifestEntryPriority(left, right) {
  const primaryDelta =
    Number(Boolean(right.isPrimaryDegreeRequirementsLink)) -
    Number(Boolean(left.isPrimaryDegreeRequirementsLink));
  if (primaryDelta !== 0) {
    return primaryDelta;
  }

  const leftStatus = getRequirementSourceRoleStatus(classifyRequirementSourceRole(left));
  const rightStatus = getRequirementSourceRoleStatus(classifyRequirementSourceRole(right));
  const rolePriority = { primary: 3, support: 2, "non-schedulable": 1, ignored: 0 };
  const roleDelta = (rolePriority[rightStatus] ?? 0) - (rolePriority[leftStatus] ?? 0);
  if (roleDelta !== 0) {
    return roleDelta;
  }

  return String(left.id ?? "").localeCompare(String(right.id ?? ""));
}

function dedupeParseablePrimaryEntries(entries) {
  const entriesByKey = new Map();
  for (const entry of entries ?? []) {
    const key = getParseableManifestEntryDedupeKey(entry);
    const existing = entriesByKey.get(key);
    if (!existing || compareParseableManifestEntryPriority(existing, entry) > 0) {
      entriesByKey.set(key, entry);
    }
  }

  return [...entriesByKey.values()].sort((left, right) =>
    left.ownerTitle.localeCompare(right.ownerTitle) ||
    String(left.ownerId ?? "").localeCompare(String(right.ownerId ?? "")) ||
    String(left.url ?? "").localeCompare(String(right.url ?? ""))
  );
}

function countBy(values, getKey) {
  return values.reduce((counts, value) => {
    const key = getKey(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

// Temporary QA fixture: this audit enumerates the official MSE option/elective
// courses so source-derived section parsing cannot silently drop them. Remove it
// once source-rule coverage can compare parsed section headings against the
// official table rows directly, without a per-program expected-course list.
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

function getParsedOwnerDedupeKey(owner) {
  const ownerId = String(owner?.ownerId ?? "").trim();
  const sourceUrl = normalizeUrlForComparison(owner?.sourceUrl);
  return ownerId && sourceUrl ? `${ownerId} ${sourceUrl}` : null;
}

function getParsedOwnerDedupeScore(owner) {
  const sourceUrl = normalizeUrlForComparison(owner?.sourceUrl);
  const primarySourceUrl = normalizeUrlForComparison(owner?.primarySourceUrl);
  const sourceRoleStatus =
    owner?.sourceRoleStatus ?? getRequirementSourceRoleStatus(owner?.sourceRole ?? "ignored");
  const warningCount = (owner?.qualitySignals ?? []).filter(
    (signal) => signal.severity === "warning"
  ).length;

  let score = 0;
  if (owner?.ok) {
    score += 1000;
  }
  if (owner?.isPrimaryDegreeRequirementsLink) {
    score += 300;
  }
  if (sourceUrl && primarySourceUrl && sourceUrl === primarySourceUrl) {
    score += 250;
  }
  if (owner?.resolutionStrategy === "primary-source") {
    score += 100;
  }
  if (sourceRoleStatus === "primary") {
    score += 50;
  } else if (sourceRoleStatus === "support") {
    score += 20;
  }
  score += Math.min(100, (owner?.parsedRequirementCourses ?? []).length);
  score += Math.min(50, (owner?.parsedRequirementGroups ?? []).length * 2);
  score -= warningCount * 10;
  return score;
}

function getParsedOwnerCoveredSourceUrls(owner) {
  return uniqueSorted([
    ...(owner?.coveredSourceUrls ?? []),
    owner?.primarySourceUrl,
    owner?.sourceUrl,
  ]);
}

function mergeParsedOwnerCanonicalSourceCoverage(left, right) {
  const selected =
    getParsedOwnerDedupeScore(left) >= getParsedOwnerDedupeScore(right) ? left : right;
  return {
    ...selected,
    coveredSourceUrls: uniqueSorted([
      ...getParsedOwnerCoveredSourceUrls(left),
      ...getParsedOwnerCoveredSourceUrls(right),
    ]),
  };
}

function dedupeParsedOwnersByCanonicalSource(owners) {
  const bestByKey = new Map();
  const unkeyedOwners = [];

  for (const owner of owners ?? []) {
    const key = getParsedOwnerDedupeKey(owner);
    if (!key) {
      unkeyedOwners.push(owner);
      continue;
    }

    const current = bestByKey.get(key);
    if (!current) {
      bestByKey.set(key, {
        ...owner,
        coveredSourceUrls: getParsedOwnerCoveredSourceUrls(owner),
      });
    } else {
      bestByKey.set(key, mergeParsedOwnerCanonicalSourceCoverage(current, owner));
    }
  }

  return [...bestByKey.values(), ...unkeyedOwners];
}

function buildUwMseCourseExtractionAudit(owners) {
  const owner = dedupeParsedOwnersByCanonicalSource(owners).find(
    (entry) =>
      entry.planId === "uw-seattle-materials-science-engineering" && !entry.pathwayId
  );
  if (!owner) {
    return null;
  }

  return buildUwMseCourseExtractionAuditForOwner(owner);
}

function mergeParsedOwners(previousOwners, nextOwners, targetPlanId) {
  const mergedOwners = targetPlanId
    ? [...(previousOwners ?? []).filter((owner) => owner?.planId !== targetPlanId), ...nextOwners]
    : [...nextOwners];

  return dedupeParsedOwnersByCanonicalSource(mergedOwners).sort(
    (left, right) =>
      left.ownerTitle.localeCompare(right.ownerTitle) ||
      String(left.ownerId ?? "").localeCompare(String(right.ownerId ?? "")) ||
      String(left.sourceUrl ?? "").localeCompare(String(right.sourceUrl ?? ""))
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
    countsBySourceRoleStatus: countBy(
      fullOwners,
      (owner) => owner.sourceRoleStatus ?? getRequirementSourceRoleStatus(owner.sourceRole ?? "ignored")
    ),
    canCreateSchedulableRowCount: fullOwners.filter(
      (owner) => owner.canCreateSchedulableRows !== false
    ).length,
    canCreateRequiredRowCount: fullOwners.filter((owner) => owner.canCreateRequiredRows === true).length,
    canCreateOptionGroupCount: fullOwners.filter((owner) => owner.canCreateOptionGroups === true).length,
    canCreateApprovedFilterCount: fullOwners.filter((owner) => owner.canCreateApprovedFilters === true).length,
    canCreateElectiveListCount: fullOwners.filter((owner) => owner.canCreateElectiveLists === true).length,
    supportOnlySourceCount: fullOwners.filter((owner) => owner.supportOnly === true).length,
    nonSchedulableSourceCount: fullOwners.filter((owner) => owner.nonSchedulable === true).length,
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
    sourceSectionFilterAuditLines: scopedOwners.flatMap(
      (owner) => owner.sourceSectionFilterAuditLines ?? []
    ),
    parserSequenceChoiceAuditLines: scopedOwners.flatMap(
      (owner) => owner.parserSequenceChoiceAuditLines ?? []
    ),
    sourceScopeAuditLines: scopedOwners.flatMap((owner) => owner.sourceScopeAuditLines ?? []),
    uwMseCourseExtractionAudit: buildUwMseCourseExtractionAudit(mergedOwners),
    parserRecoveryReport: buildParserRecoveryReport(mergedOwners),
    owners: mergedOwners,
  };
}

function buildParserRecoveryReport(owners) {
  const recoveredOwners = (owners ?? [])
    .filter((owner) => owner.parserRecovery?.triggered)
    .map((owner) => buildParserRecoveryReportOwner(owner, owner.parserRecovery));
  const successfulOwners = recoveredOwners.filter((owner) => owner.succeeded);
  const unrecoveredOwners = recoveredOwners.filter((owner) => !owner.succeeded);

  return {
    generatedAt: new Date().toISOString(),
    triggeredOwnerCount: recoveredOwners.length,
    successfulOwnerCount: successfulOwners.length,
    unrecoveredOwnerCount: unrecoveredOwners.length,
    recoveredScheduledSourceOwnerCount: recoveredOwners.filter(
      (owner) => (owner.recoveredSources ?? []).length > 0
    ).length,
    recoveredSupportSourceOwnerCount: recoveredOwners.filter(
      (owner) => (owner.supportSources ?? []).length > 0
    ).length,
    countsByTriggerCode: countBy(
      recoveredOwners.flatMap((owner) => owner.triggerCodes ?? []),
      (code) => code
    ),
    countsByAttemptedStrategy: countBy(
      recoveredOwners.flatMap((owner) => owner.attemptedStrategies ?? []),
      (strategy) => strategy
    ),
    countsByBlockerType: countBy(
      unrecoveredOwners.map((owner) => owner.blockerType ?? "unknown"),
      (blockerType) => blockerType
    ),
    owners: recoveredOwners,
  };
}

function buildParserRecoveryMarkdownReport(report) {
  const lines = [
    "# Transfer Planner Parser Recovery Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Owners triggering parser recovery: ${report.triggeredOwnerCount}`,
    `- Owners recovered: ${report.successfulOwnerCount}`,
    `- Owners unrecovered: ${report.unrecoveredOwnerCount}`,
    `- Owners with recovered schedulable sources: ${report.recoveredScheduledSourceOwnerCount}`,
    `- Owners with recovered support sources: ${report.recoveredSupportSourceOwnerCount}`,
    "",
    "## Trigger Codes",
    "",
    ...Object.entries(report.countsByTriggerCode ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, count]) => `- ${code}: ${count}`),
    "",
    "## Attempted Strategies",
    "",
    ...Object.entries(report.countsByAttemptedStrategy ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([strategy, count]) => `- ${strategy}: ${count}`),
    "",
    "## Unrecovered Blockers",
    "",
    ...Object.entries(report.countsByBlockerType ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([blockerType, count]) => `- ${blockerType}: ${count}`),
    "",
  ];

  const recoveredOwners = (report.owners ?? []).filter((owner) => owner.succeeded);
  if (recoveredOwners.length) {
    lines.push("## Recovered Owners", "");
    for (const owner of recoveredOwners.slice(0, 80)) {
      lines.push(`### ${owner.ownerTitle}`);
      lines.push("");
      lines.push(`- Owner id: ${owner.ownerId}`);
      lines.push(`- Original source: ${owner.originalSourceUrl}`);
      lines.push(`- Trigger: ${(owner.triggerCodes ?? []).join(", ") || "n/a"}`);
      lines.push(`- Attempted strategies: ${(owner.attemptedStrategies ?? []).join(", ") || "n/a"}`);
      lines.push(
        `- Before/after parsed UW course count: ${
          owner.before?.parsedUwCourseCodeCount ?? 0
        } -> ${owner.after?.parsedUwCourseCodeCount ?? 0}`
      );
      lines.push(
        `- Before/after warnings: ${(owner.before?.qualityWarningCodes ?? []).join(", ") || "none"} -> ${(owner.after?.qualityWarningCodes ?? []).join(", ") || "none"}`
      );
      for (const source of owner.recoveredSources ?? []) {
        lines.push(
          `- Recovered source: ${source.strategy}; ${source.sourceUrl}; parsed=${source.parsedUwCourseCodeCount}; fingerprint=${source.sourceEvidenceFingerprint}`
        );
      }
      for (const source of owner.supportSources ?? []) {
        lines.push(
          `- Support source: ${source.strategy}; ${source.sourceUrl}; accepted=${source.acceptedUwCourseCodeCount}; fingerprint=${source.sourceEvidenceFingerprint}`
        );
      }
      lines.push("");
    }
  }

  const unrecoveredOwners = (report.owners ?? []).filter((owner) => !owner.succeeded);
  if (unrecoveredOwners.length) {
    lines.push("## Unrecovered Owners", "");
    for (const owner of unrecoveredOwners.slice(0, 120)) {
      lines.push(`### ${owner.ownerTitle}`);
      lines.push("");
      lines.push(`- Owner id: ${owner.ownerId}`);
      lines.push(`- Original source: ${owner.originalSourceUrl}`);
      lines.push(`- Trigger: ${(owner.triggerCodes ?? []).join(", ") || "n/a"}`);
      lines.push(`- Blocker: ${owner.blockerType ?? "unknown"}`);
      lines.push(`- Attempted strategies: ${(owner.attemptedStrategies ?? []).join(", ") || "none"}`);
      lines.push(
        `- Before/after parsed UW course count: ${
          owner.before?.parsedUwCourseCodeCount ?? 0
        } -> ${owner.after?.parsedUwCourseCodeCount ?? 0}`
      );
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

function writeParserRecoveryReport(report) {
  fs.writeFileSync(RECOVERY_OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(RECOVERY_OUTPUT_MD_PATH, buildParserRecoveryMarkdownReport(report));
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
  const canScheduleFromSource = owner.canCreateSchedulableRows !== false;

  if (owner.ok && parsedCount === 0 && canScheduleFromSource) {
    addQualitySignal(
      signals,
      "warning",
      "no-parsed-uw-course-codes",
      "The official source parsed successfully but did not yield usable UW course codes.",
      `source-role=${owner.sourceRole ?? "ignored"}; requirement-cues=${owner.requirementCueLines?.length ?? 0}`
    );
  }

  if (owner.ok && owner.parseConfidence === "low" && canScheduleFromSource) {
    addQualitySignal(
      signals,
      "warning",
      "low-confidence-parsed-source",
      "The official source parsed with low confidence and should attempt deeper recovery before manual review.",
      `parsed=${parsedCount}; requirement-cues=${owner.requirementCueLines?.length ?? 0}; choose-statements=${owner.chooseStatements?.length ?? 0}`
    );
  }

  if (canScheduleFromSource && structuredOnlyCount >= 5) {
    addQualitySignal(
      signals,
      "warning",
      "material-source-structured-drift",
      "Parsed source course coverage diverges materially from the structured degree-map coverage.",
      `parsed=${parsedCount}; source-only=${sourceOnlyCount}; structured-only=${structuredOnlyCount}`
    );
  }

  if (canScheduleFromSource && structuredOnlyCount >= 8) {
    addQualitySignal(
      signals,
      "warning",
      "large-structured-only-course-gap",
      "Structured degree-map coverage includes many UW course codes that were not recovered from the parsed source.",
      `structured-only=${structuredOnlyCount}; parsed=${parsedCount}; structured-coverage=${structuredCoverageCount}`
    );
  }

  if (
    canScheduleFromSource &&
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

  if (
    owner.usedSnapshotFallback &&
    canScheduleFromSource &&
    owner.snapshotHasHeadingMetadata === false
  ) {
    addQualitySignal(
      signals,
      "note",
      "snapshot-fallback-heading-context-missing",
      "Cached snapshot fallback did not include source heading metadata, which limits section-scoped parser validation.",
      `snapshot=${owner.snapshotPath ?? "n/a"}; requirement-cues=${owner.requirementCueLines?.length ?? 0}; choose-statements=${owner.chooseStatements?.length ?? 0}`
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
    coveredSourceUrls: (owner.coveredSourceUrls ?? []).length ? owner.coveredSourceUrls : undefined,
    sourceLabel: owner.sourceLabel,
    sourceRole: owner.sourceRole,
    sourceRoleStatus:
      owner.sourceRoleStatus ?? getRequirementSourceRoleStatus(owner.sourceRole ?? "ignored"),
    canCreateSchedulableRows: owner.canCreateSchedulableRows !== false,
    sourceScope: owner.sourceScope,
    canCreateRequiredRows: owner.canCreateRequiredRows === true,
    canCreateOptionGroups: owner.canCreateOptionGroups === true,
    canCreateCreditBuckets: owner.canCreateCreditBuckets === true,
    canCreateCategoryOptions: owner.canCreateCategoryOptions === true,
    canCreateApprovedFilters: owner.canCreateApprovedFilters === true,
    canCreateElectiveLists: owner.canCreateElectiveLists === true,
    canCreateSequencingHints: owner.canCreateSequencingHints === true,
    canCreateAdmissionPrepRows: owner.canCreateAdmissionPrepRows === true,
    canCreateScheduleRows: owner.canCreateScheduleRows === true,
    supportOnly: owner.supportOnly === true,
    nonSchedulable: owner.nonSchedulable === true,
    sourceSectionAudit: owner.sourceSectionAudit,
    sourceSectionFilterAuditRows: owner.sourceSectionFilterAuditRows ?? [],
    sourceSectionFilterAuditLines: owner.sourceSectionFilterAuditLines ?? [],
    parserSequenceChoiceAuditRows: owner.parserSequenceChoiceAuditRows ?? [],
    parserSequenceChoiceAuditLines: owner.parserSequenceChoiceAuditLines ?? [],
    sourceScopeAuditLines: owner.sourceScopeAuditLines ?? [],
    resolutionStrategy: owner.resolutionStrategy,
    ok: owner.ok,
    parseConfidence: owner.parseConfidence,
    parsedUwCourseCodes: owner.parsedUwCourseCodes,
    approvedFilterUwCourseCodes: owner.approvedFilterUwCourseCodes ?? [],
    electiveListUwCourseCodes: owner.electiveListUwCourseCodes ?? [],
    supportOnlyUwCourseCodes: owner.supportOnlyUwCourseCodes ?? [],
    supportLists: owner.supportLists ?? [],
    sourceOnlyUwCourseCodes: owner.sourceOnlyUwCourseCodes,
    structuredOnlyUwCourseCodes: owner.structuredOnlyUwCourseCodes,
    requirementCueLines: owner.requirementCueLines,
    chooseStatements: owner.chooseStatements,
    pathwayLabels: owner.pathwayLabels,
    qualitySignals: owner.qualitySignals,
    parserRecovery: owner.parserRecovery ?? undefined,
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
    countsBySourceRoleStatus: countBy(
      fullOwners,
      (owner) => owner.sourceRoleStatus ?? getRequirementSourceRoleStatus(owner.sourceRole ?? "ignored")
    ),
    canCreateSchedulableRowCount: fullOwners.filter(
      (owner) => owner.canCreateSchedulableRows !== false
    ).length,
    canCreateRequiredRowCount: fullOwners.filter((owner) => owner.canCreateRequiredRows === true).length,
    canCreateOptionGroupCount: fullOwners.filter((owner) => owner.canCreateOptionGroups === true).length,
    canCreateApprovedFilterCount: fullOwners.filter((owner) => owner.canCreateApprovedFilters === true).length,
    canCreateElectiveListCount: fullOwners.filter((owner) => owner.canCreateElectiveLists === true).length,
    supportOnlySourceCount: fullOwners.filter((owner) => owner.supportOnly === true).length,
    nonSchedulableSourceCount: fullOwners.filter((owner) => owner.nonSchedulable === true).length,
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

  const chunkModules = chunks.map((_, index) => ({
    exportName: `TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_CHUNK_${index}`,
    fileStem: `blocks-${String(index).padStart(3, "0")}.generated`,
  }));

  const lines = [
    "/* eslint-disable */",
    "/* auto-generated by scripts/planner/parse-transfer-planner-requirement-sources.cjs */",
    "",
    "import type {",
    "  TransferPlannerParsedRequirementSourceBlock,",
    "  TransferPlannerRequirementSourceAdapterSummary,",
    '} from "./schema";',
    "",
    ...chunkModules.map(
      (chunkModule) =>
        `const { ${chunkModule.exportName} } = require("./requirement-source-adapters.generated/${chunkModule.fileStem}.ts");`
    ),
    "",
    `export const TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY = ${JSON.stringify(
      summary,
      null,
      2
    )} as TransferPlannerRequirementSourceAdapterSummary;`,
    "",
  ];

  fs.rmSync(OUTPUT_TS_CHUNK_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_TS_CHUNK_DIR, { recursive: true });

  chunks.forEach((chunk, index) => {
    const chunkModule = chunkModules[index];
    const chunkFilePath = path.join(OUTPUT_TS_CHUNK_DIR, `${chunkModule.fileStem}.ts`);
    const chunkLines = [
      "/* eslint-disable */",
      "/* auto-generated by scripts/planner/parse-transfer-planner-requirement-sources.cjs */",
      "",
      `export const ${chunkModule.exportName}: unknown[] = ${JSON.stringify(chunk, null, 2)};`,
      "",
    ];
    fs.writeFileSync(chunkFilePath, `${chunkLines.join("\n")}\n`);
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

const GENERATED_APPROVED_FILTER_COMPATIBILITY = {
  "computer-engineering-natural-science": {
    filterId: "CE_APPROVED_NATURAL_SCIENCE",
    label: "CE-approved Natural Science",
    aliases: [
      "ce-approved-natural-science",
      "ce-approved-natural-sciences",
      "ce-natural-science",
      "ce-approved-nsc",
      "CE_APPROVED_NATURAL_SCIENCE",
    ],
    genericCategoryTags: ["NSC", "NW"],
  },
  "computer-engineering-math-science": {
    filterId: "CE_APPROVED_MATH_SCIENCE",
    label: "CE-approved Math/Science",
    aliases: [
      "ce-approved-math-science",
      "ce-math-science",
      "computer-engineering-approved-math-science",
      "CE_APPROVED_MATH_SCIENCE",
    ],
    genericCategoryTags: ["NSC", "NW"],
  },
  "computer-science-approved-science": {
    filterId: "CS_APPROVED_SCIENCE",
    label: "CS-approved Science",
    aliases: [
      "cs-approved-science",
      "cs-approved-natural-science",
      "computer-science-natural-science",
      "CS_APPROVED_SCIENCE",
    ],
    genericCategoryTags: ["NSC", "NW"],
    allowEquivalencyRulesWithAdditionalTargets: true,
  },
};

function getGeneratedApprovedFilterCompatibility(filterKey) {
  const normalizedKey = normalizeWhitespace(String(filterKey ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (
    GENERATED_APPROVED_FILTER_COMPATIBILITY[normalizedKey] ?? {
      filterId: normalizedKey.toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
      label: normalizedKey
        .split("-")
        .filter(Boolean)
        .map((token) => token[0].toUpperCase() + token.slice(1))
        .join(" "),
      aliases: [],
      genericCategoryTags: /\bscience\b/.test(normalizedKey) ? ["NSC", "NW"] : [],
    }
  );
}

function buildGeneratedApprovedFilterFingerprint(filter) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        filterKey: filter.filterKey,
        ownerIds: filter.ownerIds,
        officialSourceUrl: filter.officialSourceUrl,
        sourceUrl: filter.sourceUrl,
        sourceRole: filter.sourceRole,
        approvedUwCourseCodes: filter.approvedUwCourseCodes,
        approvedUwCourseGroups: filter.approvedUwCourseGroups ?? [],
        petitionOnlyNotes: filter.petitionOnlyNotes ?? [],
        sourceEvidenceLines: filter.sourceEvidenceLines ?? [],
      })
    )
    .digest("hex");
}

function getOwnerSnapshotLinesForGeneratedFilter(owner) {
  if (Array.isArray(owner.snapshotLines) && owner.snapshotLines.length) {
    return owner.snapshotLines.map((line) => normalizeWhitespace(line)).filter(Boolean);
  }
  if (!owner.snapshotPath || !fs.existsSync(owner.snapshotPath)) {
    return [];
  }

  const snapshot = readSnapshotFile(owner.snapshotPath, owner.sourceUrl) ?? readSnapshotFile(owner.snapshotPath);
  return snapshot?.snapshotLines ?? [];
}

function buildApprovedFilterCandidateRecords(report) {
  const records = [];
  for (const owner of report.owners ?? []) {
    const supportLists = owner.supportLists ?? [];
    for (const supportList of supportLists) {
      const filterKey = supportList.approvedListKey ?? supportList.filterKey ?? null;
      if (!filterKey) {
        continue;
      }
      records.push({ owner, supportList, filterKey });
    }

    if (owner.sourceRole === "approved-course-list" || owner.canCreateApprovedFilters === true) {
      const inferredKey = inferApprovedListKeyFromSupportMetadata({
        ...owner,
        sourceUrl: owner.sourceUrl,
        sourceLabel: owner.sourceLabel,
        sourceRole: owner.sourceRole,
      });
      if (inferredKey && !supportLists.some((supportList) => supportList.approvedListKey === inferredKey)) {
        records.push({
          owner,
          supportList: {
            id: `${owner.ownerId}:support-list:${inferredKey}`,
            shape: "approved-filter-list",
            sourceUrl: owner.sourceUrl,
            sourceRole: owner.sourceRole,
            listTitle: owner.sourceLabel,
            approvedListKey: inferredKey,
            acceptedUwCourseCodes: [],
          },
          filterKey: inferredKey,
        });
      }
    }
  }
  return records;
}

function getPreferredOfficialSourceUrlForFilter(records) {
  return (
    records.find((record) => record.owner?.sourceRole === "approved-course-list")?.owner?.sourceUrl ??
    records.find((record) => record.supportList?.sourceUrl)?.supportList?.sourceUrl ??
    records[0]?.owner?.sourceUrl ??
    null
  );
}

function findGeneratedFilterEvidenceForKey(filterKey, records, report) {
  const fallbackCodes = uniqueSorted(
    records.flatMap((record) => record.supportList?.acceptedUwCourseCodes ?? []).map(normalizeCourseCode)
  );
  const recordOwnerIds = new Set(records.map((record) => record.owner?.ownerId).filter(Boolean));
  const supportOwners = (report.owners ?? []).filter(
    (owner) => {
      const hasMatchingSupportList = (owner.supportLists ?? []).some(
        (supportList) => supportList.approvedListKey === filterKey
      );
      if (fallbackCodes.length) {
        return hasMatchingSupportList || recordOwnerIds.has(owner.ownerId);
      }
      return (
        owner.sourceRole === "approved-course-list" ||
        owner.canCreateApprovedFilters === true ||
        hasMatchingSupportList
      );
    }
  );
  const candidates = [];

  for (const owner of supportOwners) {
    const lines = getOwnerSnapshotLinesForGeneratedFilter(owner);
    if (!lines.length) {
      continue;
    }
    const evidence = extractApprovedFilterEvidenceFromLines({
      filterKey,
      owner,
      supportList: records[0]?.supportList ?? {},
      lines,
    });
    if (!evidence?.approvedUwCourseCodes?.length) {
      continue;
    }
    const score =
      evidence.approvedUwCourseCodes.length +
      (recordOwnerIds.has(owner.ownerId) ? 100 : 0) +
      (owner.sourceRole === "approved-course-list" ? 20 : 0);
    candidates.push({ owner, evidence, score });
  }

  if (!candidates.length && fallbackCodes.length) {
    return {
      owner: records[0].owner,
      score: fallbackCodes.length,
      evidence: {
        approvedUwCourseCodes: fallbackCodes,
        approvedUwCourseGroups: [],
        petitionOnlyNotes: [],
        sourceEvidenceHeadings: [records[0].supportList?.listTitle ?? records[0].owner?.sourceLabel].filter(Boolean),
        sourceEvidenceLines: [
          records[0].supportList?.listTitle ?? records[0].owner?.sourceLabel,
          `Parsed approved course codes from ${records[0].owner?.sourceUrl ?? "official support source"}.`,
        ].filter(Boolean),
      },
    };
  }

  if (!candidates.length && fs.existsSync(SNAPSHOT_DIR)) {
    for (const entry of fs.readdirSync(SNAPSHOT_DIR)) {
      if (!entry.endsWith(".txt")) {
        continue;
      }
      const snapshot = readSnapshotFile(path.resolve(SNAPSHOT_DIR, entry));
      if (!snapshot?.snapshotLines?.length) {
        continue;
      }
      const evidence = extractApprovedFilterEvidenceFromLines({
        filterKey,
        owner: records[0]?.owner ?? {},
        supportList: records[0]?.supportList ?? {},
        lines: snapshot.snapshotLines,
      });
      if (!evidence?.approvedUwCourseCodes?.length) {
        continue;
      }
      candidates.push({
        owner: {
          ...(records[0]?.owner ?? {}),
          sourceUrl: snapshot.sourceUrl ?? records[0]?.owner?.sourceUrl,
          sourceRole: records[0]?.owner?.sourceRole ?? "approved-course-list",
        },
        evidence,
        score: evidence.approvedUwCourseCodes.length + 10,
      });
    }
  }

  candidates.sort((left, right) => right.score - left.score);
  if (candidates[0]) {
    return candidates[0];
  }

  return null;
}

function buildGeneratedApprovedFilterDefinition({ filterKey, records, evidenceCandidate, generatedAt }) {
  const compatibility = getGeneratedApprovedFilterCompatibility(filterKey);
  const ownerIds = uniqueSorted(records.map((record) => record.owner?.ownerId).filter(Boolean));
  const campusId =
    records.find((record) => record.owner?.campusId)?.owner?.campusId ??
    evidenceCandidate?.owner?.campusId ??
    "uw-seattle";
  const officialSourceUrl = getPreferredOfficialSourceUrlForFilter(records) ?? evidenceCandidate?.owner?.sourceUrl ?? "";
  const evidence = evidenceCandidate.evidence;
  const filter = {
    filterId: compatibility.filterId,
    filterKey,
    label: compatibility.label,
    ownerIds,
    campusId,
    officialSourceUrl,
    sourceUrl: evidenceCandidate.owner?.sourceUrl ?? officialSourceUrl,
    sourceRole: evidenceCandidate.owner?.sourceRole ?? records[0]?.owner?.sourceRole ?? null,
    approvedUwCourseCodes: uniqueSorted(evidence.approvedUwCourseCodes),
    ...(evidence.approvedUwCourseGroups?.length
      ? { approvedUwCourseGroups: evidence.approvedUwCourseGroups }
      : {}),
    ...(evidence.petitionOnlyNotes?.length ? { petitionOnlyNotes: evidence.petitionOnlyNotes } : {}),
    ...(compatibility.genericCategoryTags?.length
      ? { genericCategoryTags: compatibility.genericCategoryTags }
      : {}),
    aliases: uniqueInOrder([filterKey, ...(compatibility.aliases ?? [])]),
    ...(compatibility.allowEquivalencyRulesWithAdditionalTargets
      ? { allowEquivalencyRulesWithAdditionalTargets: true }
      : {}),
    generatedFromOfficialSupportSource: true,
    sourceEvidenceHeadings: uniqueInOrder(evidence.sourceEvidenceHeadings ?? []),
    sourceEvidenceLines: uniqueInOrder(evidence.sourceEvidenceLines ?? []),
    generatedAt,
  };
  return {
    ...filter,
    sourceFingerprint: buildGeneratedApprovedFilterFingerprint(filter),
  };
}

function extractComputerEngineeringMathScienceExtraCodes(owner) {
  const lines = getOwnerSnapshotLinesForGeneratedFilter(owner);
  const startIndex = lines.findIndex((line) =>
    /3\s+to\s+6\s+additional credits? of math\/science/i.test(stripSourceLineNoise(line))
  );
  if (startIndex < 0) {
    return { approvedUwCourseCodes: [], sourceEvidenceLines: [] };
  }

  const evidenceLines = lines.slice(startIndex, Math.min(lines.length, startIndex + 8)).map(stripSourceLineNoise);
  const codes = [];
  let parseFollowingMathNumbers = false;
  for (const line of evidenceLines) {
    codes.push(...extractCourseCodesFromLine(line));
    if (/\bMATH Fundamentals section above\b/i.test(line)) {
      parseFollowingMathNumbers = true;
    } else if (parseFollowingMathNumbers) {
      const beforeAmath = line.split(/\bAMATH\b/i)[0] ?? line;
      codes.push(...extractApprovedFilterCodesWithSubject(beforeAmath, "MATH"));
      parseFollowingMathNumbers = false;
    }
  }

  return {
    approvedUwCourseCodes: uniqueSorted(codes.map(normalizeCourseCode).filter(Boolean)),
    sourceEvidenceLines: uniqueInOrder(evidenceLines.filter(Boolean)),
  };
}

function buildComputerEngineeringMathScienceGeneratedFilter(report, generatedFiltersByKey, generatedAt) {
  // Temporary compatibility bridge: CE exposes a combined Math/Science runtime
  // filter whose extra math rows are source-derived but not yet emitted as a
  // first-class approved-list source. Remove this once official support-list
  // extraction can materialize combined filters from source headings alone.
  const naturalScienceFilter = generatedFiltersByKey.get("computer-engineering-natural-science");
  if (!naturalScienceFilter) {
    return null;
  }
  const owner = (report.owners ?? []).find(
    (entry) =>
      entry.planId === "uw-seattle-computer-engineering" &&
      (entry.parsedRequirementGroups ?? []).some(
        (group) => group.approvedListKey === "computer-engineering-math-science"
      )
  );
  if (!owner) {
    return null;
  }

  const mathScienceEvidence = extractComputerEngineeringMathScienceExtraCodes(owner);
  const compatibility = getGeneratedApprovedFilterCompatibility("computer-engineering-math-science");
  const filter = {
    filterId: compatibility.filterId,
    filterKey: "computer-engineering-math-science",
    label: compatibility.label,
    ownerIds: ["uw-seattle-computer-engineering"],
    campusId: "uw-seattle",
    officialSourceUrl: owner.sourceUrl,
    sourceUrl: owner.sourceUrl,
    sourceRole: owner.sourceRole,
    approvedUwCourseCodes: uniqueSorted([
      ...naturalScienceFilter.approvedUwCourseCodes,
      ...mathScienceEvidence.approvedUwCourseCodes,
    ]),
    ...(compatibility.genericCategoryTags?.length
      ? { genericCategoryTags: compatibility.genericCategoryTags }
      : {}),
    aliases: uniqueInOrder(["computer-engineering-math-science", ...(compatibility.aliases ?? [])]),
    generatedFromOfficialSupportSource: true,
    sourceEvidenceHeadings: [
      "Computer Engineering Math/Science bucket",
      ...(naturalScienceFilter.sourceEvidenceHeadings ?? []),
    ],
    sourceEvidenceLines: uniqueInOrder([
      ...mathScienceEvidence.sourceEvidenceLines,
      ...(naturalScienceFilter.sourceEvidenceLines ?? []),
    ]),
    generatedAt,
  };
  return {
    ...filter,
    sourceFingerprint: buildGeneratedApprovedFilterFingerprint(filter),
  };
}

function buildGeneratedProgramApprovedCourseFilters(report) {
  const generatedAt = report.generatedAt ?? new Date().toISOString();
  const records = buildApprovedFilterCandidateRecords(report);
  const recordsByKey = new Map();
  for (const record of records) {
    const key = normalizeWhitespace(String(record.filterKey ?? ""))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!key) {
      continue;
    }
    recordsByKey.set(key, [...(recordsByKey.get(key) ?? []), { ...record, filterKey: key }]);
  }

  const filters = [];
  for (const [filterKey, keyRecords] of recordsByKey.entries()) {
    const evidenceCandidate = findGeneratedFilterEvidenceForKey(filterKey, keyRecords, report);
    if (!evidenceCandidate?.evidence?.approvedUwCourseCodes?.length) {
      continue;
    }
    filters.push(
      buildGeneratedApprovedFilterDefinition({
        filterKey,
        records: keyRecords,
        evidenceCandidate,
        generatedAt,
      })
    );
  }

  const filtersByKey = new Map(filters.map((filter) => [filter.filterKey, filter]));
  const mathScienceFilter = buildComputerEngineeringMathScienceGeneratedFilter(
    report,
    filtersByKey,
    generatedAt
  );
  if (mathScienceFilter && !filtersByKey.has(mathScienceFilter.filterKey)) {
    filters.push(mathScienceFilter);
  }

  return filters.sort((left, right) => left.filterKey.localeCompare(right.filterKey));
}

function writeGeneratedProgramApprovedCourseFilters(report) {
  const filters = buildGeneratedProgramApprovedCourseFilters(report);
  const lines = [
    "/* eslint-disable */",
    "/* auto-generated by scripts/planner/parse-transfer-planner-requirement-sources.cjs */",
    "",
    `export const TRANSFER_PLANNER_GENERATED_PROGRAM_APPROVED_COURSE_FILTERS = ${JSON.stringify(
      filters,
      null,
      2
    )} as const;`,
    "",
  ];
  fs.writeFileSync(GENERATED_PROGRAM_APPROVED_COURSE_FILTERS_TS_PATH, lines.join("\n"));
  return filters;
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
    `- Owners triggering parser auto-recovery: ${report.parserRecoveryReport?.triggeredOwnerCount ?? 0}`,
    `- Owners recovered by parser auto-recovery: ${report.parserRecoveryReport?.successfulOwnerCount ?? 0}`,
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
    "## Source Role Statuses",
    "",
    ...Object.entries(report.countsBySourceRoleStatus ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([sourceRoleStatus, count]) => `- ${sourceRoleStatus}: ${count}`),
    `- can-create-schedulable-rows: ${report.canCreateSchedulableRowCount ?? 0}`,
    `- can-create-required-rows: ${report.canCreateRequiredRowCount ?? 0}`,
    `- can-create-option-groups: ${report.canCreateOptionGroupCount ?? 0}`,
    `- can-create-approved-filters: ${report.canCreateApprovedFilterCount ?? 0}`,
    `- can-create-elective-lists: ${report.canCreateElectiveListCount ?? 0}`,
    `- support-only sources: ${report.supportOnlySourceCount ?? 0}`,
    `- non-schedulable sources: ${report.nonSchedulableSourceCount ?? 0}`,
    "",
    "## Parser Quality Signals",
    "",
    ...Object.entries(report.countsByQualitySignalCode)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, count]) => `- ${code}: ${count}`),
    "",
    "## Parser Auto-Recovery",
    "",
    `- Triggered owners: ${report.parserRecoveryReport?.triggeredOwnerCount ?? 0}`,
    `- Successful recoveries: ${report.parserRecoveryReport?.successfulOwnerCount ?? 0}`,
    `- Unrecovered owners: ${report.parserRecoveryReport?.unrecoveredOwnerCount ?? 0}`,
    `- Recovered schedulable source owners: ${report.parserRecoveryReport?.recoveredScheduledSourceOwnerCount ?? 0}`,
    `- Recovered support source owners: ${report.parserRecoveryReport?.recoveredSupportSourceOwnerCount ?? 0}`,
    `- Detailed report: ${RECOVERY_OUTPUT_MD_PATH}`,
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

  if ((report.sourceSectionFilterAuditLines ?? []).length) {
    lines.push("## Parser Prerequisite Filter Audit", "");
    for (const auditLine of report.sourceSectionFilterAuditLines.slice(0, 400)) {
      lines.push(`- ${auditLine}`);
    }
    if (report.sourceSectionFilterAuditLines.length > 400) {
      lines.push(
        `- ... ${report.sourceSectionFilterAuditLines.length - 400} additional parser prerequisite filter audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.parserSequenceChoiceAuditLines ?? []).length) {
    lines.push("## Parser Sequence-Choice Audit", "");
    for (const auditLine of report.parserSequenceChoiceAuditLines.slice(0, 400)) {
      lines.push(`- ${auditLine}`);
    }
    if (report.parserSequenceChoiceAuditLines.length > 400) {
      lines.push(
        `- ... ${report.parserSequenceChoiceAuditLines.length - 400} additional parser sequence-choice audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.sourceScopeAuditLines ?? []).length) {
    lines.push("## Source Scope Audit", "");
    for (const auditLine of report.sourceScopeAuditLines.slice(0, 400)) {
      lines.push(`- ${auditLine}`);
    }
    if (report.sourceScopeAuditLines.length > 400) {
      lines.push(`- ... ${report.sourceScopeAuditLines.length - 400} additional source-scope audit rows omitted from markdown.`);
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
        lines.push(
          `- Source role status: ${
            owner.sourceRoleStatus ?? getRequirementSourceRoleStatus(owner.sourceRole ?? "ignored")
          }`
        );
        lines.push(
          `- Can create schedulable rows: ${owner.canCreateSchedulableRows !== false ? "yes" : "no"}`
        );
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
        lines.push(
          `  - Source role status: ${
            owner.sourceRoleStatus ?? getRequirementSourceRoleStatus(owner.sourceRole ?? "ignored")
          }`
        );
        lines.push(
          `  - Can create schedulable rows: ${owner.canCreateSchedulableRows !== false ? "yes" : "no"}`
        );
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
        lines.push(
          `  - Source role status: ${
            owner.sourceRoleStatus ?? getRequirementSourceRoleStatus(owner.sourceRole ?? "ignored")
          }`
        );
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
  if (hasArg("--generate-program-approved-filters-only")) {
    const report = readJsonIfExists(OUTPUT_JSON_PATH);
    if (!report) {
      throw new Error(`No parse report was found at ${OUTPUT_JSON_PATH}.`);
    }
    const filters = writeGeneratedProgramApprovedCourseFilters(report);
    console.log(
      `Generated program-approved course filters: ${GENERATED_PROGRAM_APPROVED_COURSE_FILTERS_TS_PATH} (${filters.length})`
    );
    return;
  }

  const snapshotOnly = hasArg("--snapshot-only");
  const targetPlanId = getArgValue("--target-plan-id");
  let effectiveTargetPlanId = targetPlanId;
  if (effectiveTargetPlanId && !fs.existsSync(OUTPUT_JSON_PATH)) {
    console.log(
      `No existing parse report was found at ${OUTPUT_JSON_PATH}. Running a full parse pass instead of a targeted merge for ${effectiveTargetPlanId}.`
    );
    effectiveTargetPlanId = null;
  }

  const rawManifestEntries = getParseablePrimaryEntries(effectiveTargetPlanId);
  const manifestEntries = dedupeParseablePrimaryEntries(rawManifestEntries);
  const previousReport = effectiveTargetPlanId ? readJsonIfExists(OUTPUT_JSON_PATH) : null;
  console.log(`Parsing ${manifestEntries.length} planner requirement source(s)...`);
  if (manifestEntries.length !== rawManifestEntries.length) {
    console.log(
      `Skipped ${rawManifestEntries.length - manifestEntries.length} duplicate requirement source entr${rawManifestEntries.length - manifestEntries.length === 1 ? "y" : "ies"} by owner, URL, parser type, and source role.`
    );
  }
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
  const generatedProgramApprovedCourseFilters = writeGeneratedProgramApprovedCourseFilters(report);
  writeGeneratedRequirementSourceAdapters(report);
  writeParserRecoveryReport(report.parserRecoveryReport);
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
  console.log(
    `Owners triggering parser auto-recovery: ${report.parserRecoveryReport.triggeredOwnerCount}`
  );
  console.log(
    `Owners recovered by parser auto-recovery: ${report.parserRecoveryReport.successfulOwnerCount}`
  );
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);
  console.log(`Parser recovery report: ${RECOVERY_OUTPUT_MD_PATH}`);
  console.log(`Generated adapters: ${OUTPUT_TS_PATH}`);
  console.log(
    `Generated program-approved course filters: ${GENERATED_PROGRAM_APPROVED_COURSE_FILTERS_TS_PATH} (${generatedProgramApprovedCourseFilters.length})`
  );
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
  const sourceRole = classifyRequirementSourceRole(entry);
  return selectPreferredHtmlParsed(
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
}

module.exports = {
  buildHtmlLines,
  buildManifestParseSuccessForTest: buildManifestParseSuccess,
  buildParseReport,
  buildParsedRequirementGroupsForTest: buildParsedRequirementGroups,
  buildParseQualitySignalsForTest: buildParseQualitySignals,
  buildParserRecoveryReportForTest: buildParserRecoveryReport,
  buildGeneratedProgramApprovedCourseFiltersForTest: buildGeneratedProgramApprovedCourseFilters,
  buildParserRecoveryArtifactsFromSnapshotForTest: buildParserRecoveryArtifactsFromSnapshot,
  buildParserRecoverySectionCandidatesForTest: buildParserRecoverySectionCandidates,
  buildParserPrerequisiteFilterAuditRowsForTest: buildParserPrerequisiteFilterAuditRows,
  buildRequirementSourceScope,
  canRequirementSourceRoleCreateSchedulableRows,
  classifyRequirementSourceRole,
  extractCourseCodesFromLineForTest: extractCourseCodesFromLine,
  extractCourseCodesFromLinesForTest: extractCourseCodesFromLines,
  extractCourseCodesFromRequirementLineForTest: extractCourseCodesFromRequirementLine,
  extractParserRecoveryLinkCandidatesForTest: extractParserRecoveryLinkCandidates,
  extractSupplementalDocumentLinkCandidatesForTest: extractSupplementalDocumentLinkCandidates,
  extractSupplementalHtmlLinkCandidatesForTest: extractSupplementalHtmlLinkCandidates,
  getStructuredUwCourseCodesForTest: getStructuredUwCourseCodes,
  getParseablePrimaryEntries,
  getOwnerProgramAcronymTokensForTest: getOwnerProgramAcronymTokens,
  getParserRuleRegistryForTest: parserRules.getParserRuleRegistry,
  getRequirementSourceRoleStatus,
  mergeRecoveredSupportSourcesForTest: mergeRecoveredSupportSources,
  orderPdfLineSegmentsForTest: orderPdfLineSegments,
  parseHtmlSourceFromArtifactsForTest,
  readSnapshotFileForTest: readSnapshotFile,
  scopeHtmlLinesForTest: scopeHtmlLines,
  scopeCatalogHtmlByAnchor,
  shouldParseRequirementSourceEntry,
  shouldPreferSupplementalDocumentSourceForTest: shouldPreferSupplementalDocumentSource,
  shouldPreferSupplementalHtmlSourceForTest: shouldPreferSupplementalHtmlSource,
  shouldTriggerParserRecoveryForTest: shouldTriggerParserRecovery,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
