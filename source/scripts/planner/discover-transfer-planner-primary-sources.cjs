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

const {
  TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS,
  getTransferPlannerAutoMatchedTrackRecommendation,
  getTransferPlannerPathwaysForPlan,
  getTransferPlannerParsedRequirementSourceBlocks,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerRequirementDiffClassifications,
  getTransferPlannerStudentRuntimeMajorPlan,
  resolveTransferPlannerStudentRuntimeMajorPlan,
} = require("../../constants/transfer-planner-source");
const {
  getTransferPlannerManualSourceLinkOverride,
} = require("../../constants/transfer-planner-source/manual-source-link-overrides");
const {
  buildTransferPlannerOwnerId,
} = require("../../constants/transfer-planner-source/pathway-id-normalization");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const OUTPUT_JSON_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-primary-source-discovery.json"
);
const OUTPUT_MD_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-primary-source-discovery.md"
);
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_CONCURRENCY = 4;
const MAX_DISCOVERED_CANDIDATES_PER_OWNER = 6;
const MAX_TARGETED_OFFICIAL_FOLLOW_CANDIDATES_PER_OWNER = 8;
const MAX_RETAINED_PRIMARY_CANDIDATES_PER_OWNER = 8;
const MAX_RETAINED_SUPPORT_CANDIDATES_PER_OWNER = 12;
const MAX_RETAINED_NON_SCHEDULABLE_CANDIDATES_PER_OWNER = 6;
const MAX_EXTRACTED_HEADINGS = 18;
const MIN_PRIMARY_DISCOVERY_SCORE = 12;
const MIN_HIGH_CONFIDENCE_SCORE = 28;
const MIN_AUTO_PROMOTION_SCORE = 50;
const MIN_CLEAR_REPLACEMENT_SCORE_DELTA = 10;
const MIN_STALE_YEAR_REPLACEMENT_SCORE_DELTA = 4;
const MAX_DISCOVERY_VERIFICATION_PASSES = 2;
const USER_AGENT = "GatorGuideTransferPlannerPrimarySourceDiscovery/1.0";
const CAMPUS_IDS = new Set(["uw-seattle", "uw-bothell", "uw-tacoma"]);
const FALLBACK_DISCOVERY_BASE_DOMAINS_BY_CAMPUS = {
  "uw-seattle": ["washington.edu", "uw.edu"],
  "uw-bothell": ["uwb.edu"],
  "uw-tacoma": ["uw.edu"],
};
const FALLBACK_DISCOVERY_SOURCE_PAGES_BY_CAMPUS = {
  "uw-seattle": [
    "https://hasc.washington.edu/explore-programs/our-majors-minors",
    "https://advising.uw.edu/academic-planning/majors-and-minors/list-of-undergraduate-majors/",
  ],
  "uw-bothell": [],
  "uw-tacoma": ["https://www.tacoma.uw.edu/admissions/majors-degrees"],
};
const OFFICIAL_UW_BASE_DOMAINS = uniqueSorted(
  Object.values(FALLBACK_DISCOVERY_BASE_DOMAINS_BY_CAMPUS).flat()
);
const SOURCE_REQUIREMENT_CUE_PATTERN =
  /\b(degree requirements?|major requirements?|graduation requirements?|major admissions requirements?|program requirements?|curriculum|worksheet|checklist|prerequisites?|bachelor(?:\s+of)?|undergraduate major admission|undergraduate program)\b/i;
const SOURCE_WEAK_PRIMARY_URL_PATTERN =
  /(?:\/|^)(timeline(?:-and-requirements)?|graduate(?:-program|-admissions)?|phd|research|faculty|news|about)(?:[-/?#]|$)/i;
const SOURCE_WEAK_PRIMARY_HEADING_PATTERN =
  /\b(timeline(?:\s*&\s*requirements)?|graduate program|graduate admissions|ms requirements?|phd requirements?|research|faculty|news)\b/i;
const SOURCE_OVERVIEW_ONLY_PATTERN = /\boverview\b/i;
const LEGACY_STUDENT_GENCAT_SOURCE_URL_PATTERN =
  /\/\/(?:www\.)?washington\.edu\/students\/gencat\/program\//i;
const UW_GENERAL_CATALOG_PROGRAM_URL_PATTERN =
  /\/\/(?:www\.)?washington\.edu\/students\/gencat\/program\//i;
const UW_GENERAL_CATALOG_MAJOR_ANCHOR_PATTERN = /#(?:program|credential)-UG-[A-Z0-9-]+/i;
const PATHWAY_SOURCE_CUE_PATTERN =
  /\b(track|option|route|pathway|concentration|specialization)\b/i;
const PATHWAY_HUB_SOURCE_CUE_PATTERN =
  /\b(curriculum|degree requirements?|major requirements?|program requirements?|tracks?|options?|routes?|pathways?|concentrations?|specializations?)\b|\/(?:curriculum|requirements?|degree-requirements?|major-requirements?|tracks?|options?|routes?|pathways?|concentrations?|specializations?)(?:[/?#-]|$)/i;
const PATHWAY_HUB_TERMINAL_SEGMENT_PATTERN =
  /^(?:curriculum|requirements?|degree-requirements?|major-requirements?|tracks?|options?|routes?|pathways?|concentrations?|specializations?)$/i;
const PATHWAY_HUB_STRICT_TERMINAL_SEGMENT_PATTERN =
  /^(?:curriculum|tracks|options|routes|pathways|concentrations|specializations)$/i;
const PATHWAY_HUB_STRICT_LABEL_PATTERN =
  /\b(curriculum|tracks|options|routes|pathways|concentrations|specializations)\b/i;
const PATHWAY_HUB_ANCHOR_SEGMENT_PATTERN =
  /^(?:curriculum|requirements?|degree-requirements?|major-requirements?|tracks?|options?|routes?|pathways?|concentrations?|specializations?)$/i;
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
const AUTO_PROMOTION_STRONG_SOURCE_ROLES = new Set([
  "official-catalog",
  "primary-degree-requirements",
  "pathway-degree-sheet",
]);
const AUTO_PROMOTION_STRONG_PARSER_TYPES = new Set([
  "catalog-page",
  "html-degree-page",
  "html-curriculum-page",
  "pdf-degree-sheet",
  "pdf-worksheet",
]);
const AUTO_PROMOTION_AUTHORITY_CUE_PATTERN =
  /\b(degree requirements?|major requirements?|graduation requirements?|program requirements?|curriculum|worksheet|checklist|degree sheet|requirement sheet|requirements packet|major planning worksheet|program of study|plan of study|study plan|degreq)\b|\/(?:requirements?|curriculum|degree-requirements?|major-requirements?|worksheets?|checklists?)(?:[-/?#]|$)|\.(?:pdf|docx)(?:[?#]|$)/i;
const AUTO_PROMOTION_OVERVIEW_PARSER_TYPES = new Set([
  "generic-html",
  "html-overview-page",
]);
const AUTO_PROMOTION_TITLE_STOPWORDS = new Set([
  "and",
  "arts",
  "b",
  "ba",
  "bachelor",
  "bs",
  "concentration",
  "degree",
  "major",
  "of",
  "option",
  "pathway",
  "program",
  "route",
  "science",
  "sciences",
  "study",
  "the",
  "track",
  "uw",
  "washington",
]);
const EXPLICIT_PROGRAM_TITLE_PATTERN =
  /\b(?:program\s+of\s+study\s*:\s*)?(?:major|degree|program)\s*:\s*([^\n|;]+)/gi;
const TARGETED_OFFICIAL_LINK_FOLLOW_CUE_PATTERN =
  /\b(degree sheets?|requirements?|curriculum|worksheets?|checklists?|plans? of study|study plans?|approved courses?|approved electives?|course lists?|tracks?|options?|pathways?|concentrations?|specializations?|catalog|admissions? prerequisites?|prerequisite courses?)\b/i;
const UNRELATED_OFFICIAL_LINK_FOLLOW_PATTERN =
  /\b(faculty|people|staff|directory|news|events?|alumni|donat(?:e|ion|ions)?|giving|research|jobs?|careers?|calendar|parking|transportation|housing|visit|map|library|privacy|accessibility)\b|\/(?:faculty|people|staff|directory|news|events?|alumni|donate|giving|research|jobs?|careers?|calendar|parking|transportation|housing|visit|maps?|privacy|accessibility)(?:[/?#]|$)/i;
const SOURCE_ROLE_METADATA = {
  "official-catalog": {
    status: "primary",
    canCreateSchedulableRows: true,
    reason: "official UW General Catalog program page",
  },
  "primary-degree-requirements": {
    status: "primary",
    canCreateSchedulableRows: true,
    reason: "primary degree requirements source role",
  },
  "department-requirements": {
    status: "primary",
    canCreateSchedulableRows: true,
    reason: "department requirements source role",
  },
  "pathway-degree-sheet": {
    status: "primary",
    canCreateSchedulableRows: true,
    reason: "pathway degree sheet source role",
  },
  "approved-course-list": {
    status: "support",
    canCreateSchedulableRows: false,
    reason: "approved course list support source role",
  },
  "elective-list": {
    status: "support",
    canCreateSchedulableRows: false,
    reason: "elective list support source role",
  },
  "upper-division-prerequisite-table": {
    status: "non-schedulable",
    canCreateSchedulableRows: false,
    reason: "upper-division prerequisite table source role",
  },
  "non-schedulable-course-list": {
    status: "non-schedulable",
    canCreateSchedulableRows: false,
    reason: "non-schedulable course list source role",
  },
  "support-source": {
    status: "support",
    canCreateSchedulableRows: false,
    reason: "official support source role",
  },
  "admission-prerequisite-source": {
    status: "support",
    canCreateSchedulableRows: false,
    reason: "admission prerequisite support source role",
  },
  "admissions-preparation": {
    status: "support",
    canCreateSchedulableRows: false,
    reason: "admissions or preparation source role",
  },
  "sample-schedule": {
    status: "support",
    canCreateSchedulableRows: false,
    reason: "sample schedule supports planning but is not requirement authority",
  },
  "curriculum-map": {
    status: "support",
    canCreateSchedulableRows: false,
    reason: "curriculum map source role",
  },
  "transfer-equivalency": {
    status: "support",
    canCreateSchedulableRows: false,
    reason: "transfer equivalency is not degree-requirement authority",
  },
  "matched-grc-track": {
    status: "support",
    canCreateSchedulableRows: false,
    reason: "matched Green River track is not UW requirement authority",
  },
  "old-archival": {
    status: "ignored",
    canCreateSchedulableRows: false,
    reason: "old or archival source role",
  },
  ignored: {
    status: "ignored",
    canCreateSchedulableRows: false,
    reason: "ignored source role",
  },
};
const STOP_TOKENS = new Set([
  "route",
  "option",
  "track",
  "path",
  "major",
  "minor",
  "studies",
  "science",
  "sciences",
  "arts",
  "culture",
  "cultures",
  "language",
  "languages",
  "literature",
  "program",
  "b",
  "a",
  "s",
  "bs",
  "ba",
  "arts",
  "science",
  "and",
  "the",
  "of",
  "in",
]);
const IDENTITY_STOP_TOKENS = new Set([
  "and",
  "the",
  "of",
  "in",
  "for",
  "major",
  "minor",
  "program",
  "degree",
  "degrees",
  "route",
  "option",
  "track",
  "path",
  "pathway",
  "concentration",
]);
const DEGREE_TOKEN_PATTERNS = [
  { token: "bsce", pattern: /\bbsce\b|\bb\.?\s*s\.?\s*c\.?\s*e\.?\b/i },
  { token: "bsn", pattern: /\bbsn\b|\bb\.?\s*s\.?\s*n\.?\b/i },
  { token: "bm", pattern: /\bbm\b|\bb\.?\s*m\.?\b|\bbachelor\s+of\s+music\b/i },
  { token: "bs", pattern: /\bbs\b|\bb\.?\s*s\.?\b|\bbachelor\s+of\s+science\b/i },
  { token: "ba", pattern: /\bba\b|\bb\.?\s*a\.?\b|\bbachelor\s+of\s+arts\b/i },
];
const TARGETED_OFFICIAL_SOURCE_CANDIDATES = {
  "uw-seattle-american-indian-studies": [
    {
      label: "UW B.A. in American Indian Studies",
      url: "https://ais.washington.edu/ba-american-indian-studies",
    },
  ],
  "uw-seattle-sustainable-bioresource-systems-engineering": [
    {
      label: "UW General Catalog Sustainable Bioresource Systems Engineering major",
      url: "https://www.washington.edu/students/gencat/program/S/SchoolofEnvironmentalandForestScience-1069.html#program-UG-SBSE-MAJOR",
    },
  ],
  "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed": [
    {
      label: "UW General Catalog Interdisciplinary Arts and Sciences individually designed major",
      url: "https://www.washington.edu/students/gencat/program/T/SocialSciences-1132.html#credential-68d16aa4cad998289e687fe1",
    },
  ],
  "uw-tacoma-environmental-sustainability:pathway:business-nonprofit-leadership-option": [
    {
      label: "UW Tacoma Environmental Sustainability Business and Nonprofit Leadership option",
      url: "https://www.tacoma.uw.edu/sias/sam/environmental-sustainability",
    },
  ],
  "uw-tacoma-environmental-sustainability:pathway:education-option": [
    {
      label: "UW Tacoma Environmental Sustainability Education option",
      url: "https://www.tacoma.uw.edu/sias/sam/pre-environmental-education-option",
    },
  ],
  "uw-tacoma-environmental-sustainability:pathway:environmental-communication-option": [
    {
      label: "UW Tacoma Environmental Communication option",
      url: "https://www.tacoma.uw.edu/sias/sam/environmental-communication-option",
    },
  ],
  "uw-tacoma-environmental-sustainability:pathway:policy-law-option": [
    {
      label: "UW Tacoma Environmental Policy and Law option",
      url: "https://www.tacoma.uw.edu/sias/sam/environmental-policy-and-law-option",
    },
  ],
};

function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyForSearch(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripHtml(value) {
  return normalizeWhitespace(String(value ?? "").replace(/<[^>]+>/g, " "));
}

function decodeHtmlEntities(value) {
  const entityMap = {
    amp: "&",
    nbsp: " ",
    "#39": "'",
    apos: "'",
    quot: '"',
    lt: "<",
    gt: ">",
  };

  return String(value ?? "").replace(/&(amp|nbsp|#39|apos|quot|lt|gt);/gi, (match, entity) => {
    return entityMap[String(entity).toLowerCase()] ?? match;
  });
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
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

function hostnameMatchesBaseDomains(hostname, baseDomains) {
  const normalizedHostname = String(hostname ?? "").toLowerCase();
  return baseDomains.some(
    (base) => normalizedHostname === base || normalizedHostname.endsWith(`.${base}`)
  );
}

function getBaseDomains(urls) {
  const bases = new Set();
  for (const rawUrl of urls) {
    try {
      const hostname = new URL(rawUrl).hostname.toLowerCase();
      const parts = hostname.split(".").filter(Boolean);
      const base =
        parts.length >= 2 ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}` : hostname;
      bases.add(base);
    } catch {}
  }
  return [...bases];
}

function getFallbackBaseDomains(campusId) {
  return FALLBACK_DISCOVERY_BASE_DOMAINS_BY_CAMPUS[campusId] ?? [];
}

function isOfficialUwLinkedAssetUrl(parsedUrl, baseDomains) {
  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();
  return (
    baseDomains.some((baseDomain) => baseDomain === "washington.edu") &&
    hostname === "s3-us-west-2.amazonaws.com" &&
    pathname.startsWith("/www-cse-public/")
  );
}

function isAllowedDiscoveryUrl(url, baseDomains) {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();
    if (!["http:", "https:"].includes(protocol)) {
      return false;
    }

    const lower = parsed.href.toLowerCase();
    if (
      lower.includes("/search?") ||
      lower.includes("/wp-login") ||
      lower.includes("/feed") ||
      /(?:facebook|instagram|linkedin|twitter|x\.com|youtube)\.com/.test(lower) ||
      /\/(?:alumni|donate|giving|faculty|people|staff|news|events?|research|search)(?:[/?#]|$)/.test(
        lower
      ) ||
      isBlockedPrimarySourceCandidateUrl(lower)
    ) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    return (
      hostnameMatchesBaseDomains(hostname, baseDomains) ||
      isOfficialUwLinkedAssetUrl(parsed, baseDomains)
    );
  } catch {
    return false;
  }
}

function urlMatchesBaseDomains(url, baseDomains) {
  try {
    return hostnameMatchesBaseDomains(new URL(url).hostname, baseDomains);
  } catch {
    return false;
  }
}

function isBlockedPrimarySourceCandidateUrl(url) {
  const lower = String(url ?? "").toLowerCase();
  return (
    lower.includes("/saml/login") ||
    lower.includes("shibboleth.sso/login") ||
    lower.includes("/wp-login")
  );
}

function normalizeCandidateUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return String(url ?? "").trim();
  }
}

function getUrlSectionAnchor(url) {
  try {
    const hash = new URL(String(url ?? "")).hash;
    return hash || null;
  } catch {
    const match = String(url ?? "").match(/#.+$/);
    return match ? match[0] : null;
  }
}

function preserveCandidateSectionAnchor(candidateUrl, finalUrl) {
  const normalizedCandidateUrl = normalizeCandidateUrl(candidateUrl);
  const normalizedFinalUrl = normalizeCandidateUrl(finalUrl || candidateUrl);
  const sectionAnchor = getUrlSectionAnchor(normalizedCandidateUrl);
  if (!sectionAnchor || !normalizedFinalUrl || getUrlSectionAnchor(normalizedFinalUrl)) {
    return normalizedFinalUrl || normalizedCandidateUrl;
  }

  try {
    const parsed = new URL(normalizedFinalUrl);
    parsed.hash = sectionAnchor;
    return parsed.toString();
  } catch {
    return `${normalizedFinalUrl}${sectionAnchor}`;
  }
}

function buildKeywordTokens(...values) {
  const tokens = [];
  for (const value of values) {
    const normalized = slugifyForSearch(value);
    for (const token of normalized.split(" ")) {
      if (!token || token.length < 3 || STOP_TOKENS.has(token)) {
        continue;
      }
      tokens.push(token);
    }
  }
  return uniqueSorted(tokens);
}

function dedupeOfficialLinks(links) {
  return Array.from(
    new Map(
      (Array.isArray(links) ? links : [])
        .filter((link) => link && typeof link === "object")
        .map((link) => [String(link.url ?? "").trim(), link])
        .filter(([url]) => Boolean(url))
    ).values()
  );
}

function uniqueByUrl(candidates) {
  return Array.from(
    new Map(
      (Array.isArray(candidates) ? candidates : [])
        .filter((candidate) => candidate?.url)
        .map((candidate) => [String(candidate.url), candidate])
    ).values()
  );
}

function isLinkedDocumentCandidateUrl(url) {
  return /\.(?:pdf|docx)(?:$|[?#])/i.test(String(url ?? ""));
}

function isPdfCandidateUrl(url) {
  return /\.pdf(?:$|[?#])/i.test(String(url ?? ""));
}

function isDocxCandidateUrl(url) {
  return /\.docx(?:$|[?#])/i.test(String(url ?? ""));
}

function isWorksheetDocumentCandidate(candidateOrLink) {
  return /\b(?:worksheet|check\s*list|checklist)\b/i.test(
    [
      candidateOrLink?.label,
      candidateOrLink?.anchorText,
      candidateOrLink?.linkText,
      candidateOrLink?.pageTitle,
      candidateOrLink?.url,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getOfficialLinkRole(link) {
  const searchable = `${link?.label ?? ""} ${link?.url ?? ""}`.toLowerCase();

  if (PATHWAY_DEGREE_SHEET_CUE_PATTERN.test(searchable) && PATHWAY_SOURCE_CUE_PATTERN.test(searchable)) {
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
    /degree requirements|major requirements|graduation requirements|degree structure|degree sheet|requirement sheet|checklist|requirements packet|degreq/.test(
      searchable
    )
  ) {
    return "degree-requirements";
  }

  if (/equivalency/.test(searchable)) {
    return "equivalency";
  }

  if (/annual schedule|schedule-and-catalog/.test(searchable)) {
    return "availability";
  }

  if (/worksheet/.test(searchable)) {
    return "worksheet";
  }

  if (/catalog/.test(searchable)) {
    return "catalog";
  }

  if (/admission|admissions|apply|application|prerequisite/.test(searchable)) {
    return "admissions";
  }

  if (/curriculum/.test(searchable)) {
    return "curriculum";
  }

  if (/overview|undergraduate|program|major/.test(searchable)) {
    return "overview";
  }

  return "other";
}

function getOfficialLinkParserType(link, role) {
  const normalizedUrl = String(link?.url ?? "").toLowerCase();
  const isPdf = isPdfCandidateUrl(normalizedUrl);
  const isDocument = isPdf || isDocxCandidateUrl(normalizedUrl);
  const isWorksheetDocument = isDocument && isWorksheetDocumentCandidate(link);

  if (role === "availability") {
    return "annual-schedule-pdf";
  }

  if (role === "equivalency") {
    return "equivalency-guide";
  }

  if (role === "catalog") {
    return "catalog-page";
  }

  if (isDocument && (role === "worksheet" || isWorksheetDocument)) {
    return "pdf-worksheet";
  }

  if (isDocument && (role === "degree-requirements" || role === "curriculum" || role === "pathway-degree-sheet")) {
    return "pdf-degree-sheet";
  }

  if (isDocument) {
    return "generic-pdf";
  }

  if (role === "degree-requirements" || role === "pathway-degree-sheet") {
    return "html-degree-page";
  }

  if (role === "admissions" || role === "admission-prerequisite-source") {
    return "html-admissions-page";
  }

  if (role === "curriculum") {
    return "html-curriculum-page";
  }

  if (role === "overview") {
    return "html-overview-page";
  }

  if (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://")) {
    return "generic-html";
  }

  return "unknown";
}

function getSourceRoleMetadata(sourceRole) {
  return SOURCE_ROLE_METADATA[sourceRole] ?? SOURCE_ROLE_METADATA.ignored;
}

function getSourceRoleStatus(sourceRole) {
  return getSourceRoleMetadata(sourceRole).status;
}

function canSourceRoleCreateSchedulableRows(sourceRole) {
  return getSourceRoleMetadata(sourceRole).canCreateSchedulableRows === true;
}

function getDiscoveryParserType(candidate, sourceRole) {
  const normalizedUrl = String(candidate?.url ?? "").toLowerCase();
  const isDocument = isLinkedDocumentCandidateUrl(normalizedUrl);
  const isWorksheetDocument = isDocument && isWorksheetDocumentCandidate(candidate);
  const isCurriculumHtml = /\/curriculum(?:[/?#]|$)|\bcurriculum\b/i.test(normalizedUrl);

  switch (sourceRole) {
    case "official-catalog":
      return "catalog-page";
    case "primary-degree-requirements":
    case "pathway-degree-sheet":
      return isWorksheetDocument ? "pdf-worksheet" : isDocument ? "pdf-degree-sheet" : isCurriculumHtml ? "html-curriculum-page" : "html-degree-page";
    case "department-requirements":
      return isDocument ? "generic-pdf" : "html-overview-page";
    case "admission-prerequisite-source":
    case "admissions-preparation":
      return isDocument ? "generic-pdf" : "html-admissions-page";
    case "curriculum-map":
      return isWorksheetDocument ? "pdf-worksheet" : isDocument ? "pdf-degree-sheet" : "html-curriculum-page";
    case "sample-schedule":
    case "approved-course-list":
    case "elective-list":
    case "upper-division-prerequisite-table":
    case "non-schedulable-course-list":
    case "support-source":
      return isDocument ? "generic-pdf" : "generic-html";
    default:
      return isDocument ? "generic-pdf" : "generic-html";
  }
}

function normalizeDiscoveryCandidateForPromotion(candidate) {
  if (!candidate) {
    return null;
  }

  const sourceRole = candidate.sourceRole ?? classifySourceDiscoveryRole(candidate);
  const sourceRoleStatus = candidate.sourceRoleStatus ?? getSourceRoleStatus(sourceRole);
  const parserType = candidate.parserType ?? getDiscoveryParserType(candidate, sourceRole);
  const canCreateSchedulableRows =
    candidate.canCreateSchedulableRows ?? canSourceRoleCreateSchedulableRows(sourceRole);
  const score = Number.isFinite(candidate.score) ? candidate.score : Number.NEGATIVE_INFINITY;
  const confidence =
    candidate.confidence ??
    (score >= MIN_HIGH_CONFIDENCE_SCORE ? "high" : score >= MIN_PRIMARY_DISCOVERY_SCORE ? "medium" : "low");

  return {
    ...candidate,
    score,
    confidence,
    sourceRole,
    sourceRoleStatus,
    parserType,
    canCreateSchedulableRows,
    reasons: candidate.reasons ?? [],
  };
}

function buildDurablePromotionAuthorityText(candidate) {
  return [
    candidate?.url,
    candidate?.label,
    candidate?.anchorText,
    candidate?.linkText,
    candidate?.pageTitle,
  ]
    .filter(Boolean)
    .join(" \n");
}

function hasDurablePromotionAuthorityCue(candidate) {
  return AUTO_PROMOTION_AUTHORITY_CUE_PATTERN.test(
    buildDurablePromotionAuthorityText(candidate)
  );
}

function hasPathwayChildPromotionAuthorityCue(candidate) {
  const durableText = buildDurablePromotionAuthorityText(candidate);
  const headingText = (candidate?.pageHeadings ?? []).filter(Boolean).join(" \n");
  return PATHWAY_SOURCE_CUE_PATTERN.test(durableText) &&
    AUTO_PROMOTION_AUTHORITY_CUE_PATTERN.test(headingText);
}

function hasStrongPromotionIdentity(candidate) {
  const reasons = new Set(candidate?.reasons ?? []);
  return (
    reasons.has("official source path matches the selected pathway") ||
    reasons.has("official source path matches the selected major") ||
    reasons.has("official source text matches the selected pathway") ||
    reasons.has("official source acronym matches the selected pathway") ||
    reasons.has("official source text matches the selected major") ||
    reasons.has("official source acronym matches the selected major") ||
    reasons.has("explicitly names the selected major") ||
    reasons.has("explicitly names the selected pathway or route") ||
    reasons.has("same-program requirement source can replace a zero-course primary") ||
    reasons.has("same-program curriculum child can replace a zero-course overview primary") ||
    reasons.has("same-program option/concentration child source matches the selected pathway") ||
    reasons.has("pathway-specific official child page matches the selected pathway")
  );
}

function getAutoPromotionTitleTokens(value) {
  return slugifyForSearch(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !AUTO_PROMOTION_TITLE_STOPWORDS.has(token));
}

function getPromotionOwnerBaseTitle(candidate) {
  return normalizeWhitespace(candidate?.ownerTitle ?? candidate?.title ?? candidate?.label ?? "")
    .replace(/\s+-\s+.+$/, "")
    .replace(/\s*\([^)]*\)\s*$/, "");
}

function extractExplicitProgramTitles(candidate) {
  const text = [
    candidate?.label,
    candidate?.anchorText,
    candidate?.linkText,
    candidate?.pageTitle,
    ...(candidate?.pageHeadings ?? []),
  ]
    .filter(Boolean)
    .join("\n");
  const titles = [];
  for (const match of text.matchAll(EXPLICIT_PROGRAM_TITLE_PATTERN)) {
    const title = normalizeWhitespace(match[1])
      .replace(/\s+-\s+.+$/, "")
      .replace(/\s*\([^)]*\)\s*$/, "");
    if (title) {
      titles.push(title);
    }
  }
  return uniqueSorted(titles);
}

function hasConflictingAutoPromotionProgramTitle(candidate) {
  const ownerTokens = getAutoPromotionTitleTokens(getPromotionOwnerBaseTitle(candidate));
  if (!ownerTokens.length) {
    return false;
  }

  const ownerTokenSet = new Set(ownerTokens);
  for (const explicitTitle of extractExplicitProgramTitles(candidate)) {
    const candidateTokens = getAutoPromotionTitleTokens(explicitTitle);
    if (candidateTokens.length < 2) {
      continue;
    }
    const candidateTokenSet = new Set(candidateTokens);
    const candidateWithinOwner = candidateTokens.every((token) => ownerTokenSet.has(token));
    const ownerWithinCandidate = ownerTokens.every((token) => candidateTokenSet.has(token));
    if (!candidateWithinOwner && !ownerWithinCandidate) {
      return true;
    }
  }

  return false;
}

function isAutoPromotablePrimaryCandidate(candidate) {
  const normalizedCandidate = normalizeDiscoveryCandidateForPromotion(candidate);
  if (!normalizedCandidate) {
    return false;
  }

  if (
    normalizedCandidate.confidence !== "high" ||
    normalizedCandidate.score < MIN_AUTO_PROMOTION_SCORE ||
    normalizedCandidate.canCreateSchedulableRows === false ||
    normalizedCandidate.sourceRoleStatus !== "primary" ||
    !AUTO_PROMOTION_STRONG_SOURCE_ROLES.has(normalizedCandidate.sourceRole) ||
    !AUTO_PROMOTION_STRONG_PARSER_TYPES.has(normalizedCandidate.parserType)
  ) {
    return false;
  }

  if (hasConflictingAutoPromotionProgramTitle(normalizedCandidate)) {
    return false;
  }

  if (normalizedCandidate.sourceRole === "official-catalog") {
    return hasStrongPromotionIdentity(normalizedCandidate);
  }

  if (
    AUTO_PROMOTION_OVERVIEW_PARSER_TYPES.has(normalizedCandidate.parserType) ||
    (!hasDurablePromotionAuthorityCue(normalizedCandidate) &&
      !hasPathwayChildPromotionAuthorityCue(normalizedCandidate))
  ) {
    return false;
  }

  return hasStrongPromotionIdentity(normalizedCandidate);
}

function classifySourceDiscoveryRole(candidate) {
  const searchable = [
    candidate?.url,
    candidate?.label,
    candidate?.anchorText,
    candidate?.pageTitle,
    ...(candidate?.pageHeadings ?? []),
  ]
    .filter(Boolean)
    .join(" \n")
    .toLowerCase();

  if (!searchable.trim()) {
    return "ignored";
  }

  if (isBlockedPrimarySourceCandidateUrl(searchable)) {
    return "ignored";
  }

  if (UW_GENERAL_CATALOG_PROGRAM_URL_PATTERN.test(searchable)) {
    return "official-catalog";
  }

  if (/\b(?:archive|archived|retired|old requirements?|prior to|pre-20\d{2})\b/.test(searchable)) {
    return "old-archival";
  }

  if (/\bequivalenc(?:y|ies)\b|\/apply\/transfer\/equivalency-guide\//.test(searchable)) {
    return "transfer-equivalency";
  }

  if (/\bgreen river\b|\bgrc\b|\bassociate\b|\bast-?2\b|\bmrp\b/.test(searchable)) {
    return "matched-grc-track";
  }

  if (/\bsample (?:schedule|plan)|\bstudy plan\b|\bplan of study\b/.test(searchable)) {
    return "sample-schedule";
  }

  if (PATHWAY_DEGREE_SHEET_CUE_PATTERN.test(searchable) && PATHWAY_SOURCE_CUE_PATTERN.test(searchable)) {
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

function getOfficialPrimaryScore(link) {
  const role = getOfficialLinkRole(link);
  const parserType = getOfficialLinkParserType(link, role);
  const searchable = `${link?.label ?? ""} ${link?.url ?? ""}`.toLowerCase();

  let score = 0;
  if (role === "degree-requirements") score += 100;
  if (role === "pathway-degree-sheet") score += 92;
  if (role === "worksheet") score += 84;
  if (role === "curriculum") score += 70;
  if (role === "catalog") score += 50;
  if (UW_GENERAL_CATALOG_PROGRAM_URL_PATTERN.test(searchable)) score += 35;
  if (
    UW_GENERAL_CATALOG_PROGRAM_URL_PATTERN.test(searchable) &&
    UW_GENERAL_CATALOG_MAJOR_ANCHOR_PATTERN.test(searchable)
  ) {
    score += 12;
  }
  if (parserType === "pdf-degree-sheet") score += 20;
  if (parserType === "pdf-worksheet") score += 18;
  if (/degree requirements|major requirements|graduation requirements/.test(searchable)) score += 25;
  if (/curriculum/.test(searchable)) score += 15;
  if (/\b(?:worksheet|checklist|plan of study|study plan)\b/.test(searchable)) score += 18;
  if (
    (role === "degree-requirements" || role === "curriculum" || role === "pathway-degree-sheet") &&
    /\b(track|option|route|pathway|concentration|specialization)\b/.test(searchable)
  ) {
    score += 8;
  }
  if (
    role === "admissions" ||
    role === "admission-prerequisite-source" ||
    role === "approved-course-list" ||
    role === "elective-list" ||
    role === "upper-division-prerequisite-table" ||
    role === "non-schedulable-course-list" ||
    role === "support-source" ||
    role === "equivalency" ||
    role === "availability"
  ) {
    score -= 40;
  }

  return score;
}

function isSafeFallbackOfficialRole(role) {
  return (
    role === "degree-requirements" ||
    role === "pathway-degree-sheet" ||
    role === "curriculum" ||
    role === "worksheet" ||
    role === "overview" ||
    role === "other"
  );
}

function pickUnderlyingPrimaryOfficialLink(links) {
  const dedupedLinks = dedupeOfficialLinks(links);
  const scoredLinks = dedupedLinks.map((link) => ({
    link,
    role: getOfficialLinkRole(link),
    score: getOfficialPrimaryScore(link),
  }));

  const candidates = scoredLinks
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.link.url.localeCompare(right.link.url));
  if (candidates.length) {
    return candidates[0]?.link ?? null;
  }

  const fallbackCandidates = scoredLinks
    .filter((entry) => !isBlockedPrimarySourceCandidateUrl(entry.link.url))
    .filter((entry) => isSafeFallbackOfficialRole(entry.role))
    .sort((left, right) => right.score - left.score || left.link.url.localeCompare(right.link.url));

  return fallbackCandidates[0]?.link ?? null;
}

function stripDegreeMarkers(value) {
  return normalizeWhitespace(value)
    .replace(/\([^)]*\b(?:b\.?\s*a\.?|b\.?\s*s\.?|b\.?\s*m\.?|bsn|bsce)\b[^)]*\)/gi, " ")
    .replace(/\b(?:b\.?\s*a\.?|b\.?\s*s\.?|b\.?\s*m\.?|bsn|bsce)\b/gi, " ");
}

function buildIdentityTokens(...values) {
  const tokens = [];
  for (const value of values) {
    const normalized = slugifyForSearch(stripDegreeMarkers(value));
    for (const token of normalized.split(" ")) {
      if (!token || token.length < 2 || IDENTITY_STOP_TOKENS.has(token)) {
        continue;
      }
      tokens.push(token);
    }
  }
  return uniqueSorted(tokens);
}

function buildIdentitySlug(value) {
  return buildIdentityTokens(value).join("-");
}

function getUrlPathIdentitySlugs(url) {
  try {
    const pathSegments = new URL(url).pathname.split("/").filter(Boolean);
    const fullPathSlug = buildIdentitySlug(pathSegments.join(" "));
    const lastPathSlug = buildIdentitySlug(pathSegments[pathSegments.length - 1] ?? "");
    return { fullPathSlug, lastPathSlug };
  } catch {
    return { fullPathSlug: "", lastPathSlug: "" };
  }
}

function getDegreeTokens(value) {
  const tokens = new Set();
  const text = String(value ?? "");
  for (const { token, pattern } of DEGREE_TOKEN_PATTERNS) {
    if (pattern.test(text)) {
      tokens.add(token);
    }
  }
  return tokens;
}

function hasConflictingDegreeRoute(targetText, candidateText) {
  const targetDegrees = getDegreeTokens(targetText);
  const candidateDegrees = getDegreeTokens(candidateText);
  if (!targetDegrees.size || !candidateDegrees.size) {
    return false;
  }
  return [...candidateDegrees].some((token) => !targetDegrees.has(token));
}

function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesSpaceDelimitedSlug(text, value) {
  const normalizedText = String(text ?? "").trim();
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedText || !normalizedValue) {
    return false;
  }

  return new RegExp(`(?:^| )${escapeRegex(normalizedValue)}(?:$| )`).test(normalizedText);
}

function matchesHyphenDelimitedSlug(text, value) {
  const normalizedText = String(text ?? "").trim();
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedText || !normalizedValue) {
    return false;
  }

  return new RegExp(`(?:^|-)${escapeRegex(normalizedValue)}(?:$|-)`).test(normalizedText);
}

function tokenMatchesCandidateText(token, text) {
  if (matchesSpaceDelimitedSlug(text, token)) {
    return true;
  }

  if (token.endsWith("ies") && matchesSpaceDelimitedSlug(text, `${token.slice(0, -3)}y`)) {
    return true;
  }

  if (
    token.endsWith("s") &&
    token.length > 3 &&
    matchesSpaceDelimitedSlug(text, token.slice(0, -1))
  ) {
    return true;
  }

  return false;
}

function tokensMatchText(tokens, text) {
  return tokens.length > 0 && tokens.every((token) => tokenMatchesCandidateText(token, text));
}

function buildIdentityAcronym(tokens) {
  return tokens.map((token) => token[0]).join("");
}

function acronymMatchesText(acronym, text) {
  return acronym.length >= 3 && text.split(" ").includes(acronym);
}

function getUrlIdentityPathSlug(url) {
  try {
    return buildIdentitySlug(new URL(url).pathname.split("/").filter(Boolean).join(" "));
  } catch {
    return "";
  }
}

function getCandidateIdentityText(candidate, combinedText = null) {
  return slugifyForSearch(
    combinedText ??
      [
        candidate?.url,
        candidate?.label,
        candidate?.anchorText,
        candidate?.linkText,
        candidate?.pageTitle,
        ...(candidate?.pageHeadings ?? []),
      ]
        .filter(Boolean)
        .join(" ")
  );
}

function getIdentityOverlapScore(identityValue, candidate, combinedText = null) {
  const tokens = buildIdentityTokens(identityValue);
  if (!tokens.length) {
    return 0;
  }

  const identitySlug = buildIdentitySlug(identityValue);
  const pathSlug = getUrlIdentityPathSlug(candidate?.url);
  const candidateIdentityText = getCandidateIdentityText(candidate, combinedText);
  const matchedTokenCount = tokens.filter((token) =>
    tokenMatchesCandidateText(token, candidateIdentityText)
  ).length;
  let score = Math.round((matchedTokenCount / tokens.length) * 70);

  if (identitySlug && matchesHyphenDelimitedSlug(pathSlug, identitySlug)) {
    score += 30;
  } else if (tokens.length === 1 && pathSlug.split("-").includes(tokens[0])) {
    score += 20;
  }

  const acronym = buildIdentityAcronym(tokens);
  if (acronymMatchesText(acronym, candidateIdentityText)) {
    score += 30;
  }

  return Math.min(100, score);
}

function getSameMajorIdentityScore(target, candidate, combinedText = null) {
  return getIdentityOverlapScore(target?.title, candidate, combinedText);
}

function getPathwayIdentityScore(target, candidate, combinedText = null) {
  const majorTitle = normalizeWhitespace(target?.title);
  const pathwayLabel = normalizeWhitespace(target?.label);
  if (!pathwayLabel || pathwayLabel === majorTitle) {
    return 0;
  }

  return getIdentityOverlapScore(pathwayLabel, candidate, combinedText);
}

function isPathwayIdentityPrimaryPage(target, candidate, sourceRole, combinedText) {
  if (target?.ownerType !== "pathway" || !target?.pathwayId) {
    return false;
  }

  if (!["ignored", "department-requirements"].includes(sourceRole)) {
    return false;
  }

  if (!PATHWAY_SOURCE_CUE_PATTERN.test(combinedText)) {
    return false;
  }

  if (
    SUPPORT_SOURCE_CUE_PATTERN.test(combinedText) ||
    ADMISSION_PREREQUISITE_SOURCE_CUE_PATTERN.test(combinedText)
  ) {
    return false;
  }

  const pathwayIdentityScore = getPathwayIdentityScore(target, candidate, combinedText);
  if (pathwayIdentityScore < 70) {
    return false;
  }

  const sourceKind = String(candidate?.sourceKind ?? "");
  return (
    sourceKind === "official-link" ||
    sourceKind === "campus-major-index" ||
    sourceKind === "official-site-root" ||
    isSameDepartmentUrl(candidate?.sourcePageUrl, candidate?.url) ||
    isSameDepartmentUrl(candidate?.discoveredFromUrl, candidate?.url)
  );
}

function isSameDepartmentUrl(sourceUrl, candidateUrl) {
  if (!sourceUrl || !candidateUrl) {
    return false;
  }

  try {
    const source = new URL(sourceUrl);
    const candidate = new URL(candidateUrl);
    if (source.hostname.toLowerCase() === candidate.hostname.toLowerCase()) {
      return true;
    }

    const sourceBaseDomain = getBaseDomains([source.href])[0] ?? "";
    const candidateBaseDomain = getBaseDomains([candidate.href])[0] ?? "";
    if (!sourceBaseDomain || sourceBaseDomain !== candidateBaseDomain) {
      return false;
    }

    const genericSegments = new Set([
      "academics",
      "academic",
      "undergraduate",
      "students",
      "student",
      "programs",
      "degrees",
    ]);
    const sourceSegments = source.pathname.split("/").filter(Boolean);
    const candidateSegments = candidate.pathname.split("/").filter(Boolean);
    const sourceDepartmentSegment = sourceSegments.find(
      (segment) => !genericSegments.has(segment.toLowerCase())
    );
    const candidateDepartmentSegment = candidateSegments.find(
      (segment) => !genericSegments.has(segment.toLowerCase())
    );

    return Boolean(
      sourceDepartmentSegment &&
        candidateDepartmentSegment &&
        sourceDepartmentSegment.toLowerCase() === candidateDepartmentSegment.toLowerCase()
    );
  } catch {
    return false;
  }
}

function getSameProgramDiscoveryPathPrefix(url) {
  try {
    const parsedUrl = new URL(url);
    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    const credentialSegmentIndex = segments.findIndex((segment) =>
      /^(?:bachelor|bachelors?|ba|bs|bba|b-a|b-s|major)[-_]/i.test(segment)
    );
    if (credentialSegmentIndex >= 0) {
      return `/${segments.slice(0, credentialSegmentIndex + 1).join("/")}`;
    }

    const pathname = parsedUrl.pathname.replace(/\/+$/, "");
    if (
      /(?:^|\/)(?:admissions?|overview|curriculum|degree-requirements?|major-requirements?|requirements?|prerequisites?|checklist|worksheet|tracks?|options?|routes?|pathways?|concentrations?|specializations?)$/i.test(
        pathname
      )
    ) {
      return pathname.replace(/\/[^/]+$/, "");
    }

    return pathname;
  } catch {
    return "";
  }
}

function slugifyForUrlPath(value) {
  return slugifyForSearch(value).replace(/\s+/g, "-");
}

function cleanPathwaySlugVariant(slug) {
  return String(slug ?? "")
    .replace(/-(?:and|or)$/i, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function addPathwaySlugVariant(variants, value) {
  const slug = cleanPathwaySlugVariant(slugifyForUrlPath(value));
  if (!slug || slug.length < 2) {
    return;
  }

  const compoundOptionConcentration =
    /-(?:option-and-concentration|concentration-and-option)$/i.test(slug);
  if (!compoundOptionConcentration) {
    variants.push(slug);
  }

  const reductions = [
    slug.replace(/-option-and-concentration$/i, "-option"),
    slug.replace(/-concentration-and-option$/i, "-option"),
    slug.replace(/-(?:option|concentration|track|pathway|route|specialization)$/i, ""),
  ]
    .map(cleanPathwaySlugVariant)
    .filter((candidate) => candidate && candidate !== slug);
  variants.push(...reductions);
}

function buildPathwaySlugVariants(target) {
  const variants = [];
  addPathwaySlugVariant(variants, target?.pathwayId);
  addPathwaySlugVariant(variants, target?.label);

  const label = String(target?.label ?? "");
  for (const match of label.matchAll(/\(([^)]+)\)/g)) {
    const acronym = slugifyForUrlPath(match[1]);
    if (!acronym || acronym.length < 2 || acronym.length > 8) {
      continue;
    }
    variants.push(acronym);
    if (/\boption\b/i.test(label)) {
      variants.push(`${acronym}-option`);
    }
    if (/\bconcentration\b/i.test(label)) {
      variants.push(`${acronym}-concentration`);
    }
    if (/\btrack\b/i.test(label)) {
      variants.push(`${acronym}-track`);
    }
  }

  return uniqueSorted(variants).slice(0, 8);
}

function buildHubChildCandidateUrls(hubUrl, pathwaySlugVariants) {
  try {
    const parsedUrl = new URL(hubUrl);
    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1] ?? "";
    const isHubUrl =
      PATHWAY_HUB_STRICT_TERMINAL_SEGMENT_PATTERN.test(lastSegment) ||
      PATHWAY_HUB_STRICT_LABEL_PATTERN.test(hubUrl);
    if (!isHubUrl || !pathSegments.length) {
      return [];
    }

    const childBaseSegments = PATHWAY_HUB_TERMINAL_SEGMENT_PATTERN.test(lastSegment)
      ? pathSegments.slice(0, -1)
      : pathSegments;
    if (!childBaseSegments.length) {
      return [];
    }

    const urls = [];
    for (const slug of pathwaySlugVariants) {
      const childUrl = new URL(parsedUrl.href);
      childUrl.pathname = `/${[...childBaseSegments, slug].join("/")}`;
      childUrl.search = "";
      childUrl.hash = "";
      urls.push(childUrl.toString());

      if (PATHWAY_HUB_ANCHOR_SEGMENT_PATTERN.test(lastSegment)) {
        const anchorUrl = new URL(parsedUrl.href);
        anchorUrl.search = "";
        anchorUrl.hash = slug;
        urls.push(anchorUrl.toString());
      }
    }

    return uniqueSorted(urls);
  } catch {
    return [];
  }
}

function buildInferredPathwayHubChildSourceCandidates(target, links) {
  if (target?.ownerType !== "pathway" || !target?.pathwayId) {
    return [];
  }

  const pathwaySlugVariants = buildPathwaySlugVariants(target);
  if (!pathwaySlugVariants.length) {
    return [];
  }

  const candidates = [];
  for (const link of links ?? []) {
    const hubUrl = normalizeCandidateUrl(link?.url);
    const searchable = `${link?.label ?? ""} ${hubUrl ?? ""}`;
    if (
      !hubUrl ||
      (!PATHWAY_HUB_STRICT_LABEL_PATTERN.test(searchable) &&
        !PATHWAY_HUB_STRICT_TERMINAL_SEGMENT_PATTERN.test(
          new URL(hubUrl).pathname.split("/").filter(Boolean).at(-1) ?? ""
        ))
    ) {
      continue;
    }

    for (const url of buildHubChildCandidateUrls(hubUrl, pathwaySlugVariants)) {
      if (url === hubUrl) {
        continue;
      }
      candidates.push({
        url,
        label: `${target.label} inferred option/concentration requirements`,
        anchorText: target.label,
        linkText: target.label,
        sourcePageUrl: hubUrl,
        discoveredFromUrl: hubUrl,
        sourceKind: "inferred-hub-child-candidate",
        discoveryDepth: 1,
        requiresVerification: true,
      });
    }
  }

  return uniqueByUrl(candidates).slice(0, 12);
}

function isSameProgramChildPage(baseUrl, candidateUrl) {
  try {
    const base = new URL(baseUrl);
    const candidate = new URL(candidateUrl);
    if (base.origin !== candidate.origin) {
      return false;
    }

    const basePrefix = getSameProgramDiscoveryPathPrefix(base.href).replace(/\/+$/, "");
    const candidatePath = candidate.pathname.replace(/\/+$/, "");
    return Boolean(
      basePrefix &&
        basePrefix !== "/" &&
        candidatePath !== basePrefix &&
        candidatePath.startsWith(`${basePrefix}/`)
    );
  } catch {
    return false;
  }
}

function isSameProgramChildOrSiblingPage(baseUrl, candidateUrl) {
  if (isSameProgramChildPage(baseUrl, candidateUrl)) {
    return true;
  }

  try {
    const base = new URL(baseUrl);
    const candidate = new URL(candidateUrl);
    if (base.origin !== candidate.origin) {
      return false;
    }

    const basePrefix = getSameProgramDiscoveryPathPrefix(base.href).replace(/\/+$/, "");
    const candidatePrefix = getSameProgramDiscoveryPathPrefix(candidate.href).replace(/\/+$/, "");
    return Boolean(
      basePrefix &&
        candidatePrefix &&
        basePrefix !== "/" &&
        basePrefix === candidatePrefix &&
        base.pathname.replace(/\/+$/, "") !== candidate.pathname.replace(/\/+$/, "")
    );
  } catch {
    return false;
  }
}

function hasZeroParsedCourseReevaluationSignal(target) {
  if (Number.isFinite(target?.reevaluationContext?.parsedUwCourseCodeCount)) {
    return target.reevaluationContext.parsedUwCourseCodeCount === 0;
  }

  return (target?.reevaluationSignals ?? []).some(
    (signal) => String(signal?.code ?? "") === "no-parsed-uw-course-codes"
  );
}

function isZeroCoursePrimaryWithRequirementCues(target) {
  return Boolean(
    target?.analysisMode === "weak-existing-primary" &&
      target?.existingPrimaryUrl &&
      hasZeroParsedCourseReevaluationSignal(target) &&
      (target?.reevaluationContext?.hasStrongRequirementCue === true ||
        (target?.reevaluationSignals ?? []).some(
          (signal) => String(signal?.code ?? "") === "no-parsed-uw-course-codes"
        ))
  );
}

function hasSameProgramReplacementRequirementCue(combinedText) {
  return (
    PRIMARY_REQUIREMENT_CUE_PATTERN.test(combinedText) ||
    PATHWAY_DEGREE_SHEET_CUE_PATTERN.test(combinedText) ||
    /\b(?:curriculum|worksheet|checklist|degree sheet|requirement sheet|requirements packet|major planning worksheet|program of study|plan of study|study plan)\b/i.test(
      combinedText
    ) ||
    /\/(?:requirements?|curriculum|degree-requirements?|major-requirements?|worksheets?|checklists?)(?:[-/?#]|$)/i.test(
      combinedText
    ) ||
    /\.(?:pdf|docx)(?:\b|[?#])/i.test(combinedText)
  );
}

function isSameProgramPathwayHubChildSourceCandidate(
  target,
  candidate,
  sourceRole,
  combinedText
) {
  if (target?.ownerType !== "pathway" || !target?.pathwayId) {
    return false;
  }

  if (
    ![
      "primary-degree-requirements",
      "department-requirements",
      "pathway-degree-sheet",
      "curriculum-map",
      "ignored",
    ].includes(sourceRole)
  ) {
    return false;
  }

  if (
    ADMISSION_PREREQUISITE_SOURCE_CUE_PATTERN.test(combinedText) ||
    SUPPORT_SOURCE_CUE_PATTERN.test(combinedText) ||
    APPROVED_COURSE_LIST_CUE_PATTERN.test(combinedText) ||
    ELECTIVE_LIST_CUE_PATTERN.test(combinedText) ||
    /\b(?:sample schedule|four[-\s]?year plan|degree map)\b/i.test(combinedText)
  ) {
    return false;
  }

  const baseUrls = [
    candidate?.sourcePageUrl,
    candidate?.discoveredFromUrl,
    target?.existingPrimaryUrl,
  ].filter(Boolean);
  const sameProgramHubPath = baseUrls.some(
    (baseUrl) =>
      PATHWAY_HUB_SOURCE_CUE_PATTERN.test(baseUrl) &&
      isSameProgramChildOrSiblingPage(baseUrl, candidate?.url)
  );
  if (!sameProgramHubPath) {
    return false;
  }

  const pathwayIdentityScore = getPathwayIdentityScore(target, candidate, combinedText);
  if (pathwayIdentityScore <= 0) {
    return false;
  }

  if (hasConflictingDegreeRoute(`${target.title} ${target.label}`, combinedText)) {
    return false;
  }

  return PATHWAY_SOURCE_CUE_PATTERN.test(combinedText) || pathwayIdentityScore >= 50;
}

function isSameProgramZeroCourseReplacementCandidate(
  target,
  candidate,
  sourceRole,
  combinedText
) {
  if (!isZeroCoursePrimaryWithRequirementCues(target)) {
    return false;
  }

  if (
    ![
      "primary-degree-requirements",
      "department-requirements",
      "pathway-degree-sheet",
      "curriculum-map",
      "admissions-preparation",
      "ignored",
    ].includes(sourceRole)
  ) {
    return false;
  }

  if (!hasSameProgramReplacementRequirementCue(combinedText)) {
    return false;
  }

  if (
    ADMISSION_PREREQUISITE_SOURCE_CUE_PATTERN.test(combinedText) ||
    SUPPORT_SOURCE_CUE_PATTERN.test(combinedText) ||
    /\b(?:sample schedule|four[-\s]?year plan|degree map)\b/i.test(combinedText)
  ) {
    return false;
  }

  const sameProgramPath = isSameProgramChildOrSiblingPage(target.existingPrimaryUrl, candidate?.url);
  const sameMajorIdentityScore = getSameMajorIdentityScore(target, candidate, combinedText);
  const pathwayIdentityScore = getPathwayIdentityScore(target, candidate, combinedText);
  const worksheetOrDocumentCue =
    PATHWAY_DEGREE_SHEET_CUE_PATTERN.test(combinedText) ||
    /\b(?:worksheet|checklist|degree sheet|requirement sheet|requirements packet)\b/i.test(
      combinedText
    ) ||
    /\.(?:pdf|docx)(?:\b|[?#])/i.test(combinedText);

  if (!sameProgramPath && !(worksheetOrDocumentCue && sameMajorIdentityScore > 0)) {
    return false;
  }

  if (hasConflictingDegreeRoute(`${target.title} ${target.label}`, combinedText)) {
    return false;
  }

  if (
    target?.ownerType === "pathway" &&
    PATHWAY_SOURCE_CUE_PATTERN.test(combinedText) &&
    pathwayIdentityScore <= 0
  ) {
    return false;
  }

  return sameProgramPath || sameMajorIdentityScore > 0 || pathwayIdentityScore > 0;
}

function hasSelectedUndergraduateCatalogMajorCredential(target, candidate, candidateIdentityText) {
  if (
    target.ownerType !== "major" ||
    !LEGACY_STUDENT_GENCAT_SOURCE_URL_PATTERN.test(candidate.url ?? "")
  ) {
    return false;
  }

  if (!/\bbachelor (?:of )?(?:arts|science|music)\b/.test(candidateIdentityText)) {
    return false;
  }

  if (!/\bmajor\b/.test(candidateIdentityText)) {
    return false;
  }

  const meaningfulMajorTokens = (target.keywordTokens ?? []).filter(
    (token) => token.length >= 4 && !IDENTITY_STOP_TOKENS.has(token)
  );
  return meaningfulMajorTokens.some((token) =>
    tokenMatchesCandidateText(token, candidateIdentityText)
  );
}

function scoreIdentityMatch(target, candidate, combinedText) {
  const candidateIdentityText = slugifyForSearch(combinedText);
  const ownerTokens = buildIdentityTokens(target.title);
  const labelTokens = buildIdentityTokens(target.label);
  const ownerSlug = buildIdentitySlug(target.title);
  const labelSlug = buildIdentitySlug(target.label);
  const ownerAcronym = buildIdentityAcronym(ownerTokens);
  const labelAcronym = buildIdentityAcronym(labelTokens);
  const { fullPathSlug, lastPathSlug } = getUrlPathIdentitySlugs(candidate.url);
  const ownerSlugInPath = Boolean(ownerSlug && matchesHyphenDelimitedSlug(fullPathSlug, ownerSlug));
  const labelSlugInPath = Boolean(labelSlug && matchesHyphenDelimitedSlug(fullPathSlug, labelSlug));
  const singleOwnerTokenExactPath =
    ownerTokens.length === 1 && lastPathSlug === ownerTokens[0];
  const singleLabelTokenExactPath =
    labelTokens.length === 1 && lastPathSlug === labelTokens[0];
  const ownerTokensMatched = tokensMatchText(ownerTokens, candidateIdentityText);
  const labelTokensMatched = tokensMatchText(labelTokens, candidateIdentityText);
  const ownerAcronymMatched = acronymMatchesText(ownerAcronym, candidateIdentityText);
  const labelAcronymMatched = acronymMatchesText(labelAcronym, candidateIdentityText);
  const reasons = [];
  let score = 0;

  if (hasConflictingDegreeRoute(`${target.title} ${target.label}`, combinedText)) {
    score -= 18;
    reasons.push("candidate appears to describe a different degree route");
  }

  if (target.ownerType === "pathway" && (labelSlugInPath || singleLabelTokenExactPath)) {
    score += 34;
    reasons.push("official source path matches the selected pathway");
  } else if (ownerSlugInPath || singleOwnerTokenExactPath) {
    score += 32;
    reasons.push("official source path matches the selected major");
  } else if (target.ownerType === "pathway" && labelTokens.length >= 2 && labelTokensMatched) {
    score += 26;
    reasons.push("official source text matches the selected pathway");
  } else if (target.ownerType === "pathway" && labelAcronymMatched) {
    score += 32;
    reasons.push("official source acronym matches the selected pathway");
  } else if (ownerTokens.length >= 2 && ownerTokensMatched) {
    score += 32;
    reasons.push("official source text matches the selected major");
  } else if (ownerAcronymMatched) {
    score += 32;
    reasons.push("official source acronym matches the selected major");
  }

  const strongMatch = score >= 24;
  if (
    strongMatch &&
    (candidate.sourceKind === "official-link" ||
      candidate.sourceKind === "targeted-official-candidate")
  ) {
    score += 6;
    reasons.push("verified against an official source candidate");
  }

  return {
    score,
    reasons,
  };
}

function flattenTextValues(values) {
  const flattened = [];

  for (const value of values) {
    if (Array.isArray(value)) {
      flattened.push(...flattenTextValues(value));
      continue;
    }

    if (value === null || value === undefined) {
      continue;
    }

    flattened.push(String(value));
  }

  return flattened;
}

function extractDetectedYears(...values) {
  const years = new Set();

  for (const value of flattenTextValues(values)) {
    for (const match of value.matchAll(/(?<!\d)(20\d{2})(?!\d)/g)) {
      const parsedYear = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsedYear)) {
        years.add(parsedYear);
      }
    }
  }

  return [...years].sort((left, right) => left - right);
}

function buildCandidateYearInfo(candidate) {
  const detectedYears = extractDetectedYears(
    candidate?.url,
    candidate?.label,
    candidate?.anchorText,
    candidate?.pageTitle,
    candidate?.pageHeadings ?? []
  );

  return {
    detectedYears,
    latestDetectedYear: detectedYears[detectedYears.length - 1] ?? null,
  };
}

function hasMatchingDegreeRoute(targetText, candidateText) {
  const targetDegrees = getDegreeTokens(targetText);
  const candidateDegrees = getDegreeTokens(candidateText);

  if (!targetDegrees.size || !candidateDegrees.size) {
    return false;
  }

  return [...candidateDegrees].every((token) => targetDegrees.has(token));
}

function getFocusedCandidateDegreeTokens(candidate) {
  return getDegreeTokens(
    [
      candidate?.url,
      candidate?.label,
      candidate?.anchorText,
      candidate?.pageTitle,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function isSingleDegreeRouteCandidateForMultiPathwayMajor(target, candidate, candidateText) {
  if (target.ownerType !== "major" || (target.pathwayCount ?? 0) < 1) {
    return false;
  }

  const focusedDegreeTokens = getFocusedCandidateDegreeTokens(candidate);
  if (focusedDegreeTokens.size === 1) {
    return true;
  }

  return getDegreeTokens(candidateText).size === 1;
}

function buildOwnerTargetRecord({
  analysisMode = "missing-primary",
  ownerType,
  ownerKey,
  planId,
  pathwayId = null,
  campusId,
  title,
  label,
  officialLinks,
  existingPrimary = null,
  reevaluationSignals = [],
  reevaluationContext = null,
  parsedBlock = null,
  pathwayCount = 0,
}) {
  return {
    analysisMode,
    ownerType,
    ownerKey,
    planId,
    pathwayId,
    campusId,
    title,
    label,
    officialLinks: [...(officialLinks ?? [])],
    keywordTokens: buildKeywordTokens(title, label),
    pathwayCount,
    existingPrimary,
    existingPrimaryUrl: existingPrimary?.url ?? null,
    reevaluationSignals: [...(reevaluationSignals ?? [])],
    reevaluationContext,
    parsedBlock,
  };
}

function buildPathwayDiscoveryLinks(plan, pathway, majorPrimary = null) {
  const pathwayLinks = [...(pathway?.officialLinks ?? [])];
  const parentLinks = [...(plan?.officialLinks ?? [])];
  const majorPrimaryLink = majorPrimary?.url
    ? [
        {
          label: majorPrimary.label ?? `${plan.title} primary degree requirements`,
          url: majorPrimary.url,
        },
      ]
    : [];

  return dedupeOfficialLinks([...pathwayLinks, ...parentLinks, ...majorPrimaryLink]);
}

function pickParsedRequirementSourceBlock(planId, pathwayId = null) {
  const blocks = getTransferPlannerParsedRequirementSourceBlocks(planId, pathwayId);
  return (
    blocks.find((block) => block.ok && !block.usedSnapshotFallback) ??
    blocks.find((block) => block.ok) ??
    blocks[0] ??
    null
  );
}

function hasManualPrimaryPin(planId, pathwayId = null) {
  const override = getTransferPlannerManualSourceLinkOverride(planId, pathwayId);
  if (!override) {
    return false;
  }

  return Boolean(String(override.preferredPrimaryUrl ?? "").trim()) || override.mode === "replace";
}

function buildReevaluationSourceText(primarySource, parsedBlock) {
  return [
    primarySource?.label,
    primarySource?.url,
    parsedBlock?.primarySourceLabel,
    parsedBlock?.sourceLabel,
    ...(parsedBlock?.extractedHeadings ?? []),
  ]
    .filter(Boolean)
    .join(" \n");
}

function primarySourceMatchesPathwayIdentity(owner, primarySource, parsedBlock) {
  if (!owner?.pathwayId) {
    return true;
  }

  const target = {
    ownerType: "pathway",
    pathwayId: owner.pathwayId,
    title: owner.title,
    label: owner.label,
  };
  const candidates = [
    {
      url: primarySource?.url ?? parsedBlock?.primarySourceUrl ?? "",
      label: primarySource?.label ?? parsedBlock?.primarySourceLabel ?? "",
    },
    {
      url: parsedBlock?.sourceUrl ?? "",
      label: parsedBlock?.sourceLabel ?? "",
    },
  ];

  return candidates.some((candidate) => {
    const combinedText = [candidate.url, candidate.label]
      .filter(Boolean)
      .join(" \n")
      .toLowerCase();

    return getPathwayIdentityScore(target, candidate, combinedText) > 0;
  });
}

function buildWeakExistingPrimarySignals(params) {
  const {
    primarySource,
    parsedBlock,
    runtimeGrcCourseCount,
    bestTrackId,
    trackRecommendationId,
    noPublicClassificationCount,
  } = params;
  const signals = [];
  const sourceText = buildReevaluationSourceText(primarySource, parsedBlock);
  const hasStrongRequirementCue = SOURCE_REQUIREMENT_CUE_PATTERN.test(sourceText);
  const hasDedicatedRequirementCue =
    PRIMARY_REQUIREMENT_CUE_PATTERN.test(sourceText) ||
    /\bdegree sheet\b|\brequirement sheet\b|\bchecklist\b|\brequirements packet\b|\bdegreq\b/i.test(
      sourceText
    );
  const hasWeakPrimaryUrl = SOURCE_WEAK_PRIMARY_URL_PATTERN.test(primarySource?.url ?? "");
  const hasWeakHeadings = SOURCE_WEAK_PRIMARY_HEADING_PATTERN.test(
    (parsedBlock?.extractedHeadings ?? []).join(" \n")
  );
  const hasOverviewOnlyCue =
    SOURCE_OVERVIEW_ONLY_PATTERN.test(sourceText) && !hasDedicatedRequirementCue;
  const qualityWarningCodes = (parsedBlock?.qualitySignals ?? [])
    .filter((signal) => signal?.severity === "warning")
    .map((signal) => signal.code)
    .filter(Boolean);
  const safeIntentionalEmpty = Boolean(
    parsedBlock?.ok &&
      runtimeGrcCourseCount === 0 &&
      !bestTrackId &&
      !trackRecommendationId
  );
  const parsedUwCourseCodeCount = Array.isArray(parsedBlock?.parsedUwCourseCodes)
    ? parsedBlock.parsedUwCourseCodes.length
    : 0;
  const currentSourceYears = extractDetectedYears(
    primarySource?.url,
    primarySource?.label,
    parsedBlock?.primarySourceLabel,
    parsedBlock?.sourceLabel,
    parsedBlock?.extractedTitle,
    parsedBlock?.extractedHeadings ?? [],
    (parsedBlock?.requirementCueLines ?? []).slice(0, 16),
    (parsedBlock?.chooseStatements ?? []).slice(0, 8)
  );
  const currentSourceLatestYear = currentSourceYears[currentSourceYears.length - 1] ?? null;
  const yearSpecificRequirementSource = Boolean(
    currentSourceLatestYear !== null &&
      (isLinkedDocumentCandidateUrl(primarySource?.url) ||
        /\b(worksheet|checklist|degree requirements?|major requirements?|graduation requirements?|program requirements?|curriculum|degree sheet|requirement sheet)\b/i.test(
          sourceText
        ))
  );

  if (safeIntentionalEmpty) {
    signals.push({
      code: "safe-intentional-empty-state",
      reason:
        noPublicClassificationCount > 0
          ? `Planner runtime still lands in a safe-empty state with ${noPublicClassificationCount} no-public requirement classifications and no student-visible GRC course pool.`
          : "Planner runtime still lands in a safe-empty state with no student-visible GRC course pool.",
    });
  }

  if (qualityWarningCodes.length > 0) {
    signals.push({
      code: "parser-quality-warning",
      reason: `Parsed source block has parser-quality warnings: ${qualityWarningCodes.join(", ")}.`,
    });
  }

  if (parsedUwCourseCodeCount === 0) {
    signals.push({
      code: "no-parsed-uw-course-codes",
      reason: "Parsed source block produced zero UW course codes.",
    });
  }

  if (hasWeakPrimaryUrl) {
    signals.push({
      code: "primary-url-looks-graduate-or-timeline",
      reason: "Current primary URL looks like a timeline, graduate, or non-degree page.",
    });
  }

  if (hasWeakHeadings && !hasStrongRequirementCue) {
    signals.push({
      code: "page-headings-look-graduate-or-timeline-heavy",
      reason: "Current source headings skew toward timeline/graduate content without strong undergraduate requirement cues.",
    });
  }

  if (hasOverviewOnlyCue) {
    signals.push({
      code: "primary-looks-overview-only",
      reason: "Current primary looks like an overview page rather than a dedicated undergraduate degree-requirements page.",
    });
  }

  if (yearSpecificRequirementSource) {
    signals.push({
      code: "primary-source-appears-year-specific",
      reason: `Current primary looks tied to ${currentSourceLatestYear} in its source URL/title/document text, so discovery should compare it against sibling official sources.`,
    });
  }

  const downstreamWeak =
    safeIntentionalEmpty || qualityWarningCodes.length > 0 || parsedUwCourseCodeCount === 0;
  const sourceWeak = hasWeakPrimaryUrl || (hasWeakHeadings && !hasStrongRequirementCue) || hasOverviewOnlyCue;
  const zeroCourseRequirementPrimary = parsedUwCourseCodeCount === 0 && hasStrongRequirementCue;

  return {
    triggered:
      (downstreamWeak && sourceWeak) ||
      zeroCourseRequirementPrimary ||
      yearSpecificRequirementSource,
    signals,
    context: {
      runtimeGrcCourseCount,
      bestTrackId,
      trackRecommendationId,
      noPublicClassificationCount,
      parsedUwCourseCodeCount,
      qualityWarningCodes,
      hasStrongRequirementCue,
      currentSourceYears,
      currentSourceLatestYear,
      yearSpecificRequirementSource,
    },
  };
}

function buildWeakExistingOwnerTargets({ campusFilter, targetPlanId = null }) {
  const targets = [];

  for (const plan of TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS) {
    if (campusFilter && plan.campusId !== campusFilter) {
      continue;
    }
    if (targetPlanId && plan.id !== targetPlanId) {
      continue;
    }

    const visiblePathways = getTransferPlannerPathwaysForPlan(plan);
    const runtimeBasePlan = getTransferPlannerStudentRuntimeMajorPlan(plan.id);
    const majorPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, null);
    const owners = [
      {
        ownerType: "major",
        ownerKey: buildTransferPlannerOwnerId(plan.id, null),
        planId: plan.id,
        pathwayId: null,
        title: plan.title,
        label: plan.title,
        officialLinks: [...(plan.officialLinks ?? [])],
      },
      ...visiblePathways.map((pathway) => ({
        ownerType: "pathway",
        ownerKey: buildTransferPlannerOwnerId(plan.id, pathway.id),
        planId: plan.id,
        pathwayId: pathway.id,
        title: `${plan.title} - ${pathway.label}`,
        label: pathway.label,
        officialLinks: buildPathwayDiscoveryLinks(plan, pathway, majorPrimary),
      })),
    ];

    for (const owner of owners) {
      const manifestPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(
        owner.planId,
        owner.pathwayId
      );
      const existingPrimary = pickUnderlyingPrimaryOfficialLink(owner.officialLinks) ?? manifestPrimary;
      if (!existingPrimary?.url) {
        continue;
      }

      if (hasManualPrimaryPin(owner.planId, owner.pathwayId)) {
        continue;
      }

      const parsedBlock = pickParsedRequirementSourceBlock(owner.planId, owner.pathwayId);
      if (!parsedBlock) {
        if (
          !owner.pathwayId ||
          primarySourceMatchesPathwayIdentity(owner, existingPrimary, null)
        ) {
          continue;
        }

        targets.push(
          buildOwnerTargetRecord({
            analysisMode: "weak-existing-primary",
            ownerType: owner.ownerType,
            ownerKey: owner.ownerKey,
            planId: owner.planId,
            pathwayId: owner.pathwayId,
            campusId: plan.campusId,
            title: owner.title,
            label: owner.label,
            officialLinks: owner.officialLinks,
            existingPrimary,
            reevaluationSignals: [
              {
                code: "primary-source-misses-selected-pathway",
                reason:
                  "Current pathway primary source does not name the selected pathway, so discovery should compare it against sibling official pathway or track pages.",
              },
            ],
            reevaluationContext: null,
            parsedBlock: null,
            pathwayCount: visiblePathways.length,
          })
        );
        continue;
      }

      const runtimeResolvedPlan = owner.pathwayId
        ? resolveTransferPlannerStudentRuntimeMajorPlan(runtimeBasePlan, owner.pathwayId)
        : runtimeBasePlan;
      const runtimeGrcCourseList = runtimeResolvedPlan?.grcCourseList ?? [];
      const bestTrackId = runtimeResolvedPlan?.bestTrackId ?? null;
      const trackRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
        runtimeGrcCourseList,
        bestTrackId
      );
      const noPublicClassificationCount = getTransferPlannerRequirementDiffClassifications(
        owner.planId,
        owner.pathwayId
      ).filter((entry) => String(entry.classificationKind ?? "").includes("no-public")).length;
      const weakSignals = buildWeakExistingPrimarySignals({
        primarySource: existingPrimary,
        parsedBlock,
        runtimeGrcCourseCount: runtimeGrcCourseList.length,
        bestTrackId,
        trackRecommendationId: trackRecommendation?.trackId ?? null,
        noPublicClassificationCount,
      });
      if (!primarySourceMatchesPathwayIdentity(owner, existingPrimary, parsedBlock)) {
        weakSignals.triggered = true;
        weakSignals.signals.push({
          code: "primary-source-misses-selected-pathway",
          reason:
            "Current pathway primary source does not name the selected pathway, so discovery should compare it against sibling official pathway or track pages.",
        });
      }

      if (!weakSignals.triggered) {
        continue;
      }

      targets.push(
        buildOwnerTargetRecord({
          analysisMode: "weak-existing-primary",
          ownerType: owner.ownerType,
          ownerKey: owner.ownerKey,
          planId: owner.planId,
          pathwayId: owner.pathwayId,
          campusId: plan.campusId,
          title: owner.title,
          label: owner.label,
          officialLinks: owner.officialLinks,
          existingPrimary,
          reevaluationSignals: weakSignals.signals,
          reevaluationContext: weakSignals.context,
          parsedBlock,
          pathwayCount: visiblePathways.length,
        })
      );
    }
  }

  return targets.sort((left, right) => left.title.localeCompare(right.title));
}

function buildOwnerTargets({ includeExisting, campusFilter, targetPlanId = null }) {
  const targets = [];

  for (const plan of TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS) {
    if (campusFilter && plan.campusId !== campusFilter) {
      continue;
    }
    if (targetPlanId && plan.id !== targetPlanId) {
      continue;
    }

    const visiblePathways = getTransferPlannerPathwaysForPlan(plan);
    const majorPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, null);
    if (includeExisting || !majorPrimary) {
      targets.push(
        buildOwnerTargetRecord({
          analysisMode: "missing-primary",
          ownerType: "major",
          ownerKey: buildTransferPlannerOwnerId(plan.id, null),
          planId: plan.id,
          pathwayId: null,
          campusId: plan.campusId,
          title: plan.title,
          label: plan.title,
          officialLinks: [...(plan.officialLinks ?? [])],
          existingPrimary: majorPrimary,
          pathwayCount: visiblePathways.length,
        })
      );
    }

    for (const pathway of visiblePathways) {
      const pathwayPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, pathway.id);
      if (!includeExisting && pathwayPrimary) {
        continue;
      }

      targets.push(
        buildOwnerTargetRecord({
          analysisMode: "missing-primary",
          ownerType: "pathway",
          ownerKey: buildTransferPlannerOwnerId(plan.id, pathway.id),
          planId: plan.id,
          pathwayId: pathway.id,
          campusId: plan.campusId,
          title: `${plan.title} - ${pathway.label}`,
          label: pathway.label,
          officialLinks: buildPathwayDiscoveryLinks(plan, pathway, majorPrimary),
          existingPrimary: pathwayPrimary,
          pathwayCount: visiblePathways.length,
        })
      );
    }
  }

  return targets;
}

function mergeDiscoveryOwners(previousOwners, nextOwners, targetPlanId) {
  if (!targetPlanId) {
    return [...nextOwners].sort(
      (left, right) =>
        left.title.localeCompare(right.title) ||
        String(left.ownerKey ?? "").localeCompare(String(right.ownerKey ?? ""))
    );
  }

  return [...(previousOwners ?? []).filter((owner) => owner?.planId !== targetPlanId), ...nextOwners].sort(
    (left, right) =>
      left.title.localeCompare(right.title) ||
      String(left.ownerKey ?? "").localeCompare(String(right.ownerKey ?? ""))
  );
}

function buildDiscoveryReport(owners, weakExistingOwners, options = {}) {
  const mergedOwners = mergeDiscoveryOwners(
    options.previousOwners ?? [],
    owners,
    options.targetPlanId ?? null
  );
  const mergedWeakExistingOwners = mergeDiscoveryOwners(
    options.previousWeakExistingOwners ?? [],
    weakExistingOwners,
    options.targetPlanId ?? null
  );
  const scopedOwners = options.targetPlanId
    ? mergedOwners.filter((owner) => owner.planId === options.targetPlanId)
    : mergedOwners;
  const scopedWeakExistingOwners = options.targetPlanId
    ? mergedWeakExistingOwners.filter((owner) => owner.planId === options.targetPlanId)
    : mergedWeakExistingOwners;

  return {
    generatedAt: new Date().toISOString(),
    ownerCount: mergedOwners.length,
    missingPrimaryOwnerCount: mergedOwners.filter((owner) => !owner.existingPrimaryUrl).length,
    highConfidenceSuggestionCount: mergedOwners.filter(
      (owner) => owner.suggestedPrimary?.confidence === "high"
    ).length,
    mediumConfidenceSuggestionCount: mergedOwners.filter(
      (owner) => owner.suggestedPrimary?.confidence === "medium"
    ).length,
    noSuggestionCount: mergedOwners.filter((owner) => !owner.suggestedPrimary).length,
    weakExistingOwnerCount: mergedWeakExistingOwners.length,
    highConfidenceReplacementCount: mergedWeakExistingOwners.filter(
      (owner) => owner.suggestedAction === "replace-existing-primary"
    ).length,
    reviewReplacementCount: mergedWeakExistingOwners.filter(
      (owner) => owner.reviewCandidate && owner.suggestedAction !== "replace-existing-primary"
    ).length,
    keepExistingPrimaryCount: mergedWeakExistingOwners.filter(
      (owner) => owner.suggestedAction === "keep-existing-primary"
    ).length,
    targetPlanId: options.targetPlanId ?? null,
    targetOwnerCount: scopedOwners.length,
    targetWeakExistingOwnerCount: scopedWeakExistingOwners.length,
    owners: mergedOwners,
    weakExistingOwners: mergedWeakExistingOwners,
  };
}

async function fetchWithTimeout(url, timeoutMs) {
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

const pageFetchCache = new Map();

async function inspectPage(url, timeoutMs) {
  const normalizedUrl = normalizeCandidateUrl(url);
  if (!normalizedUrl) {
    return {
      url: normalizedUrl,
      ok: false,
      status: null,
      finalUrl: normalizedUrl,
      contentType: null,
      title: null,
      headings: [],
      anchors: [],
      error: "Missing URL.",
    };
  }

  if (pageFetchCache.has(normalizedUrl)) {
    return pageFetchCache.get(normalizedUrl);
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetchWithTimeout(normalizedUrl, timeoutMs);
      const contentType = response.headers.get("content-type");
      const finalUrl = response.url || normalizedUrl;
      const isHtml = String(contentType ?? "").toLowerCase().includes("text/html");
      const bodyText = isHtml ? await response.text() : null;

      return {
        url: normalizedUrl,
        ok: response.ok,
        status: response.status,
        finalUrl,
        contentType,
        title: isHtml ? extractTitle(bodyText) : null,
        headings: isHtml ? extractHeadings(bodyText) : [],
        anchors: isHtml ? extractAnchors(bodyText, finalUrl) : [],
        error: null,
      };
    } catch (error) {
      return {
        url: normalizedUrl,
        ok: false,
        status: null,
        finalUrl: normalizedUrl,
        contentType: null,
        title: null,
        headings: [],
        anchors: [],
        error: error.message,
      };
    }
  })();

  pageFetchCache.set(normalizedUrl, fetchPromise);
  return fetchPromise;
}

function extractTitle(html) {
  const match = String(html ?? "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return null;
  }
  return stripHtml(decodeHtmlEntities(match[1])) || null;
}

function extractHeadings(html) {
  const headings = [];
  const pattern = /<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const matches = String(html ?? "").matchAll(pattern);

  for (const match of matches) {
    const heading = stripHtml(decodeHtmlEntities(match[2]));
    if (!heading) {
      continue;
    }
    headings.push(heading);
  }

  return uniqueSorted(headings).slice(0, MAX_EXTRACTED_HEADINGS);
}

function extractAnchors(html, sourceUrl) {
  const anchors = [];
  const pattern = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  const matches = html.matchAll(pattern);

  for (const match of matches) {
    const href = decodeHtmlEntities(match[2]);
    const text = stripHtml(decodeHtmlEntities(match[3]));
    if (!href) {
      continue;
    }

    try {
      const resolvedUrl = normalizeCandidateUrl(new URL(href, sourceUrl).toString());
      anchors.push({
        url: resolvedUrl,
        text,
        sourceUrl,
      });
    } catch {}
  }

  return anchors;
}

function addReason(reasons, reason) {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function getHostnameOrEmpty(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isGraduateOnlyCandidateForUndergraduateTarget(target, combinedText) {
  const targetText = `${target?.title ?? ""} ${target?.label ?? ""}`.toLowerCase();
  const targetIsGraduate =
    /\b(?:graduate|masters?|master(?:'s)?|m\.?\s*s\.?|m\.?\s*a\.?|ph\.?\s*d\.?|doctoral)\b/i.test(
      targetText
    );
  if (targetIsGraduate) {
    return false;
  }

  const candidateIsGraduate =
    /\b(?:graduate|masters?|master(?:'s)?|m\.?\s*s\.?|m\.?\s*a\.?|ph\.?\s*d\.?|doctoral)\b/i.test(
      combinedText
    ) || /\/(?:student\/)?(?:applied-masters|masters?|graduate|amp)(?:[-/?#]|$)/i.test(combinedText);
  if (!candidateIsGraduate) {
    return false;
  }

  return !/\b(?:undergrad(?:uate)?|bachelor|b\.?\s*s\.?|b\.?\s*a\.?)\b|\/undergrad(?:uate)?(?:[-/?#]|$)/i.test(
    combinedText
  );
}

function scoreCandidate(target, candidate) {
  if (isBlockedPrimarySourceCandidateUrl(candidate.url)) {
    return {
      score: -100,
      confidence: "low",
      sourceRole: "ignored",
      sourceRoleStatus: "ignored",
      parserType: getDiscoveryParserType(candidate, "ignored"),
      canCreateSchedulableRows: false,
      reasons: ["authentication URL is not a primary degree-requirements source"],
    };
  }

  const combinedText = [
    candidate.url,
    candidate.label,
    candidate.anchorText,
    candidate.linkText,
    candidate.pageTitle,
    ...(candidate.pageHeadings ?? []),
  ]
    .filter(Boolean)
    .join(" \n")
    .toLowerCase();

  if (isGraduateOnlyCandidateForUndergraduateTarget(target, combinedText)) {
    return {
      score: -100,
      confidence: "low",
      sourceRole: "ignored",
      sourceRoleStatus: "ignored",
      parserType: getDiscoveryParserType(candidate, "ignored"),
      canCreateSchedulableRows: false,
      reasons: ["graduate-only source does not match undergraduate owner"],
    };
  }

  let sourceRole = classifySourceDiscoveryRole(candidate);
  const sameProgramZeroCourseReplacement =
    isSameProgramZeroCourseReplacementCandidate(
      target,
      candidate,
      sourceRole,
      combinedText
    );
  const sameProgramPathwayHubChildSource =
    isSameProgramPathwayHubChildSourceCandidate(
      target,
      candidate,
      sourceRole,
      combinedText
    );
  if (sameProgramZeroCourseReplacement || sameProgramPathwayHubChildSource) {
    sourceRole = "primary-degree-requirements";
  }
  const pathwayIdentityPrimaryPage = isPathwayIdentityPrimaryPage(
    target,
    candidate,
    sourceRole,
    combinedText
  );
  if (pathwayIdentityPrimaryPage) {
    sourceRole = "primary-degree-requirements";
  }
  const candidateIdentityText = slugifyForSearch(combinedText);
  const candidateYearInfo = buildCandidateYearInfo(candidate);
  const reasons = [];
  let score = 0;
  let matchedKeywordCount = 0;

  const sourceRoleRules = {
    "official-catalog": {
      score: 32,
    },
    "primary-degree-requirements": {
      score: 34,
    },
    "department-requirements": {
      score: 22,
    },
    "pathway-degree-sheet": {
      score: 28,
    },
    "approved-course-list": {
      score: 8,
    },
    "elective-list": {
      score: 8,
    },
    "upper-division-prerequisite-table": {
      score: 5,
    },
    "non-schedulable-course-list": {
      score: 4,
    },
    "support-source": {
      score: 6,
    },
    "admission-prerequisite-source": {
      score: 6,
    },
    "admissions-preparation": {
      score: 4,
    },
    "sample-schedule": {
      score: 2,
    },
    "curriculum-map": {
      score: 8,
    },
    "transfer-equivalency": {
      score: -30,
    },
    "matched-grc-track": {
      score: -34,
    },
    "old-archival": {
      score: -80,
    },
    ignored: {
      score: -60,
    },
  };
  const sourceRoleRule = sourceRoleRules[sourceRole] ?? sourceRoleRules.ignored;
  score += sourceRoleRule.score;
  addReason(reasons, getSourceRoleMetadata(sourceRole).reason);
  if (pathwayIdentityPrimaryPage) {
    score += 18;
    addReason(reasons, "pathway-specific official child page matches the selected pathway");
  }
  if (sameProgramZeroCourseReplacement) {
    score += 22;
    addReason(
      reasons,
      "same-program requirement source can replace a zero-course primary"
    );
    if (/\bcurriculum\b|\/curriculum(?:[/?#]|$)/i.test(combinedText)) {
      addReason(
        reasons,
        "same-program curriculum child can replace a zero-course overview primary"
      );
    }
  }
  if (sameProgramPathwayHubChildSource) {
    score += 20;
    addReason(
      reasons,
      "same-program option/concentration child source matches the selected pathway"
    );
  }
  if (
    sourceRole === "official-catalog" &&
    UW_GENERAL_CATALOG_MAJOR_ANCHOR_PATTERN.test(candidate.url)
  ) {
    score += 14;
    addReason(reasons, "official catalog URL includes a major-specific anchor");
  }

  const positiveRules = [
    { pattern: /\bdegree requirements?\b/, score: 28, reason: "explicit degree-requirements wording" },
    { pattern: /\bmajor requirements?\b/, score: 26, reason: "explicit major-requirements wording" },
    { pattern: /\bgraduation requirements?\b/, score: 24, reason: "graduation requirements wording" },
    { pattern: /\bprogram requirements?\b/, score: 20, reason: "program-requirements wording" },
    { pattern: /\bmajor admissions requirements?\b/, score: 18, reason: "major-admissions-requirements wording" },
    { pattern: /\bundergraduate program\b/, score: 16, reason: "undergraduate-program wording" },
    { pattern: /\bundergraduate major admission\b/, score: 16, reason: "undergraduate-major-admission wording" },
    { pattern: /\bcurriculum\b/, score: 18, reason: "curriculum wording" },
    { pattern: /\brequirement sheet\b|\bdegree sheet\b/, score: 20, reason: "requirement-sheet wording" },
    { pattern: /\bprogram of study\b|\bchecklist\b/, score: 16, reason: "checklist-style wording" },
    { pattern: /\bbachelor of arts\b|\bbachelor of science\b|\bb\.a\.\b|\bb\.s\.\b/, score: 10, reason: "specific bachelor route wording" },
    { pattern: /\/undergraduate(?:[-/]|$)/, score: 10, reason: "undergraduate path segment" },
    { pattern: /\/(?:degree|major)-requirements?(?:[-/]|$)/, score: 10, reason: "requirements path segment" },
    { pattern: /\.(?:pdf|docx)(?:[?#]|$)/, score: 6, reason: "document degree-sheet candidate" },
  ];

  const negativeRules = [
    { pattern: /\badmissions?\b|\bapply\b|\bapplication\b|\bincoming\b|\bfreshmen\b/, score: -26, reason: "admissions wording" },
    { pattern: /\bequivalency\b|\btransfer\b/, score: -24, reason: "transfer-equivalency wording" },
    { pattern: /\bgraduate\b|\bmasters?\b|\bphd\b|\bdoctoral\b/, score: -26, reason: "graduate-program wording" },
    { pattern: /\btimeline\b/, score: -24, reason: "timeline wording" },
    { pattern: /\badvising\b|\badvisor\b/, score: -10, reason: "advising wording" },
    { pattern: /\bregistrar\b|\bgeneral education\b/, score: -18, reason: "generic campus requirements wording" },
    { pattern: /\boverview\b/, score: -8, reason: "overview wording" },
    { pattern: /\bfaculty\b|\bpeople\b|\bnews\b|\bresearch\b/, score: -20, reason: "non-degree content wording" },
    { pattern: /\bfaq\b|\bevent\b|\bregister\b|\bworkshop\b/, score: -20, reason: "event or FAQ wording" },
    { pattern: /\bcapstone\b|\bproject\b/, score: -8, reason: "capstone-only wording" },
    { pattern: /directory\.tacoma\.uw\.edu/, score: -30, reason: "campus directory page is not a degree-requirements source" },
    { pattern: /\bpage not found\b/, score: -40, reason: "page-not-found response" },
  ];

  for (const rule of positiveRules) {
    if (rule.pattern.test(combinedText)) {
      score += rule.score;
      addReason(reasons, rule.reason);
    }
  }

  for (const rule of negativeRules) {
    if (rule.pattern.test(combinedText)) {
      score += rule.score;
      addReason(reasons, rule.reason);
    }
  }

  const identityMatch = scoreIdentityMatch(target, candidate, combinedText);
  score += identityMatch.score;
  for (const reason of identityMatch.reasons) {
    addReason(reasons, reason);
  }

  if (hasMatchingDegreeRoute(`${target.title} ${target.label}`, combinedText)) {
    score += 8;
    addReason(reasons, "matches the selected degree route");
  }

  if (hasSelectedUndergraduateCatalogMajorCredential(target, candidate, candidateIdentityText)) {
    score += 16;
    addReason(reasons, "official catalog credential names the selected undergraduate major");
  }

  if (isSingleDegreeRouteCandidateForMultiPathwayMajor(target, candidate, combinedText)) {
    score -= 10;
    addReason(reasons, "route-specific page may not cover every pathway in the selected major");
  }

  if (candidate.sourceKind === "official-link") {
    score += 4;
    addReason(reasons, "already stored as an official source");
  }

  if (candidate.sourceKind === "discovered-anchor") {
    score += 2;
    addReason(reasons, "discovered from an official source page");
  }

  if (candidate.sourceKind === "campus-major-index") {
    score += 3;
    addReason(reasons, "discovered from an official campus major index");
  }

  if (candidate.sourceKind === "official-site-root") {
    score += 3;
    addReason(reasons, "discovered from the current official department site root");
  }

  if (candidate.sourceKind === "targeted-official-candidate") {
    score += 4;
    addReason(reasons, "hardcoded official source candidate for source-gap resolution");
  }

  if (candidate.sourceKind === "inferred-hub-child-candidate") {
    score += 4;
    addReason(reasons, "inferred from an official option/concentration hub");
  }

  if (isSameDepartmentUrl(candidate.sourcePageUrl, candidate.url)) {
    score += 4;
    addReason(reasons, "stays on the same department or school page");
  }

  const existingPrimaryHost = getHostnameOrEmpty(target.existingPrimaryUrl);
  const candidateHost = getHostnameOrEmpty(candidate.url);
  if (existingPrimaryHost && candidateHost && existingPrimaryHost === candidateHost) {
    score += 8;
    addReason(reasons, "stays on the current official department host");
  }

  const currentSourceLatestYear = Number.isFinite(target?.reevaluationContext?.currentSourceLatestYear)
    ? target.reevaluationContext.currentSourceLatestYear
    : null;
  if (
    currentSourceLatestYear !== null &&
    candidateYearInfo.latestDetectedYear !== null &&
    candidate.url !== target.existingPrimaryUrl &&
    existingPrimaryHost &&
    candidateHost &&
    existingPrimaryHost === candidateHost &&
    !hasConflictingDegreeRoute(`${target.title} ${target.label}`, combinedText)
  ) {
    const yearDelta = candidateYearInfo.latestDetectedYear - currentSourceLatestYear;
    if (yearDelta > 0) {
      score += Math.min(12, 6 + yearDelta * 2);
      addReason(
        reasons,
        `more current year signal than current primary (${candidateYearInfo.latestDetectedYear} vs ${currentSourceLatestYear})`
      );
    } else if (yearDelta < 0) {
      score -= Math.min(6, Math.abs(yearDelta) * 2);
      addReason(
        reasons,
        `older year signal than current primary (${candidateYearInfo.latestDetectedYear} vs ${currentSourceLatestYear})`
      );
    }
  }

  const majorPhrase = slugifyForSearch(target.title);
  if (majorPhrase && matchesSpaceDelimitedSlug(candidateIdentityText, majorPhrase)) {
    score += 10;
    addReason(reasons, "explicitly names the selected major");
  }

  const labelPhrase = slugifyForSearch(target.label);
  if (
    labelPhrase &&
    labelPhrase !== majorPhrase &&
    matchesSpaceDelimitedSlug(candidateIdentityText, labelPhrase)
  ) {
    score += 6;
    addReason(reasons, "explicitly names the selected pathway or route");
  }

  if (sourceRole === "pathway-degree-sheet" && target.pathwayId) {
    score += 34;
    addReason(reasons, "pathway degree sheet is scoped to the selected pathway");
  }

  if (
    sourceRole === "department-requirements" &&
    target.pathwayId &&
    labelPhrase &&
    labelPhrase !== majorPhrase &&
    !matchesSpaceDelimitedSlug(candidateIdentityText, labelPhrase)
  ) {
    score -= 14;
    addReason(reasons, "broad department page does not name the selected pathway");
  }

  for (const token of target.keywordTokens) {
    if (tokenMatchesCandidateText(token, candidateIdentityText)) {
      matchedKeywordCount += 1;
      score += 2;
      addReason(reasons, `matches major keyword "${token}"`);
    }
  }

  if (matchedKeywordCount === 0) {
    score -= 14;
    addReason(reasons, "does not clearly mention the selected major");
  } else if (matchedKeywordCount >= 2) {
    score += 4;
    addReason(reasons, "matches multiple major keywords");
  }

  if (candidate.pageTitle && candidate.pageTitle !== candidate.label) {
    score += 1;
    addReason(reasons, "page title fetched successfully");
  }

  if (urlMatchesBaseDomains(candidate.url, OFFICIAL_UW_BASE_DOMAINS)) {
    score += 1;
    addReason(reasons, "stays on an official UW domain");
  }

  const confidence = score >= 28 ? "high" : score >= 14 ? "medium" : "low";

  return {
    score,
    confidence,
    sourceRole,
    sourceRoleStatus: getSourceRoleStatus(sourceRole),
    parserType: getDiscoveryParserType(candidate, sourceRole),
    canCreateSchedulableRows: canSourceRoleCreateSchedulableRows(sourceRole),
    reasons: uniqueSorted(reasons),
    detectedYears: candidateYearInfo.detectedYears,
    latestDetectedYear: candidateYearInfo.latestDetectedYear,
  };
}

function mergeCandidate(existing, incoming) {
  const incomingVerifiesExistingInference =
    existing.requiresVerification === true && incoming.verified === true;
  const existingVerifiesIncomingInference =
    incoming.requiresVerification === true && existing.verified === true;
  const useIncoming =
    incomingVerifiesExistingInference
      ? true
      : existingVerifiesIncomingInference
        ? false
        : (incoming.score ?? Number.NEGATIVE_INFINITY) > (existing.score ?? Number.NEGATIVE_INFINITY);
  const winning = useIncoming ? incoming : existing;
  const mergedDetectedYears = extractDetectedYears(
    existing.detectedYears ?? [],
    incoming.detectedYears ?? []
  );

  return {
    ...(useIncoming ? existing : incoming),
    ...winning,
    label: winning.label || existing.label || incoming.label || null,
    anchorText: winning.anchorText || existing.anchorText || incoming.anchorText || null,
    linkText: winning.linkText || existing.linkText || incoming.linkText || null,
    pageTitle: winning.pageTitle || existing.pageTitle || incoming.pageTitle || null,
    pageHeadings: uniqueSorted([
      ...(existing.pageHeadings ?? []),
      ...(incoming.pageHeadings ?? []),
    ]),
    sourcePageUrl: winning.sourcePageUrl || existing.sourcePageUrl || incoming.sourcePageUrl || null,
    discoveredFromUrl:
      winning.discoveredFromUrl ||
      existing.discoveredFromUrl ||
      incoming.discoveredFromUrl ||
      null,
    sourceKinds: uniqueSorted([...(existing.sourceKinds ?? []), ...(incoming.sourceKinds ?? [])]),
    sourceRole: winning.sourceRole || existing.sourceRole || incoming.sourceRole || "ignored",
    sourceRoleStatus:
      winning.sourceRoleStatus || existing.sourceRoleStatus || incoming.sourceRoleStatus || "ignored",
    supportOnly: Boolean(winning.supportOnly ?? existing.supportOnly ?? incoming.supportOnly),
    canBePrimary: Boolean(winning.canBePrimary ?? existing.canBePrimary ?? incoming.canBePrimary),
    parserType: winning.parserType || existing.parserType || incoming.parserType || "unknown",
    canCreateSchedulableRows: Boolean(
      winning.canCreateSchedulableRows ??
        existing.canCreateSchedulableRows ??
        incoming.canCreateSchedulableRows
    ),
    requiresVerification: Boolean(
      winning.requiresVerification ?? existing.requiresVerification ?? incoming.requiresVerification
    ),
    verified: Boolean(winning.verified || existing.verified || incoming.verified),
    sectionAnchor:
      winning.sectionAnchor || existing.sectionAnchor || incoming.sectionAnchor || null,
    sameDepartment: Boolean(
      winning.sameDepartment || existing.sameDepartment || incoming.sameDepartment
    ),
    sameMajorIdentityScore: Math.max(
      existing.sameMajorIdentityScore ?? 0,
      incoming.sameMajorIdentityScore ?? 0
    ),
    pathwayIdentityScore: Math.max(
      existing.pathwayIdentityScore ?? 0,
      incoming.pathwayIdentityScore ?? 0
    ),
    discoveryDepth: Math.min(
      existing.discoveryDepth ?? Number.POSITIVE_INFINITY,
      incoming.discoveryDepth ?? Number.POSITIVE_INFINITY
    ),
    reasons: winning.reasons ?? [],
    score: winning.score,
    confidence: winning.confidence,
    detectedYears: mergedDetectedYears,
    latestDetectedYear: mergedDetectedYears[mergedDetectedYears.length - 1] ?? null,
  };
}

function compareScoredCandidates(left, right) {
  const scoreDelta = right.score - left.score;
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const leftOfficial = left.sourceKinds?.includes("official-link") ? 1 : 0;
  const rightOfficial = right.sourceKinds?.includes("official-link") ? 1 : 0;
  const leftTargeted = left.sourceKinds?.includes("targeted-official-candidate") ? 1 : 0;
  const rightTargeted = right.sourceKinds?.includes("targeted-official-candidate") ? 1 : 0;
  const officialDelta = rightOfficial + rightTargeted - (leftOfficial + leftTargeted);
  if (officialDelta !== 0) {
    return officialDelta;
  }

  const leftYear = left.latestDetectedYear ?? Number.NEGATIVE_INFINITY;
  const rightYear = right.latestDetectedYear ?? Number.NEGATIVE_INFINITY;
  if (leftYear !== rightYear) {
    return rightYear - leftYear;
  }

  return left.url.localeCompare(right.url);
}

function getCandidateLinkText(candidate) {
  return normalizeWhitespace(
    candidate?.linkText ?? candidate?.anchorText ?? candidate?.label ?? candidate?.pageTitle ?? ""
  );
}

function buildCandidateDiscoveryMetadata(target, candidate) {
  const sourceRole = candidate.sourceRole ?? classifySourceDiscoveryRole(candidate);
  const sourceRoleStatus = candidate.sourceRoleStatus ?? getSourceRoleStatus(sourceRole);
  const discoveredFromUrl =
    candidate.discoveredFromUrl ?? candidate.sourcePageUrl ?? candidate.parentUrl ?? null;
  const linkText = getCandidateLinkText(candidate) || null;
  const combinedText = [
    candidate.url,
    candidate.label,
    candidate.anchorText,
    candidate.linkText,
    candidate.pageTitle,
    ...(candidate.pageHeadings ?? []),
  ]
    .filter(Boolean)
    .join(" \n")
    .toLowerCase();

  return {
    discoveredFromUrl,
    linkText,
    supportOnly: sourceRoleStatus === "support",
    canBePrimary: canSourceRoleCreateSchedulableRows(sourceRole),
    sectionAnchor: getUrlSectionAnchor(candidate.url),
    sameDepartment: isSameDepartmentUrl(discoveredFromUrl, candidate.url),
    sameMajorIdentityScore: getSameMajorIdentityScore(target, candidate, combinedText),
    pathwayIdentityScore: getPathwayIdentityScore(target, candidate, combinedText),
  };
}

function addScoredCandidate(candidateMap, target, rawCandidate) {
  const normalizedUrl = normalizeCandidateUrl(rawCandidate.url);
  if (!normalizedUrl) {
    return;
  }

  const scored = scoreCandidate(target, { ...rawCandidate, url: normalizedUrl });
  const requiresVerification = rawCandidate.requiresVerification === true;
  const verified =
    rawCandidate.verified === true ||
    !requiresVerification ||
    Boolean(rawCandidate.pageTitle || (rawCandidate.pageHeadings ?? []).length);
  const metadata = buildCandidateDiscoveryMetadata(target, {
    ...rawCandidate,
    url: normalizedUrl,
    sourceRole: scored.sourceRole,
    sourceRoleStatus: scored.sourceRoleStatus,
  });
  const mergedCandidate = {
    url: normalizedUrl,
    label: rawCandidate.label ?? null,
    anchorText: rawCandidate.anchorText ?? null,
    linkText: metadata.linkText,
    pageTitle: rawCandidate.pageTitle ?? null,
    pageHeadings: rawCandidate.pageHeadings ?? [],
    sourcePageUrl: rawCandidate.sourcePageUrl ?? null,
    discoveredFromUrl: metadata.discoveredFromUrl,
    sourceKinds: rawCandidate.sourceKind ? [rawCandidate.sourceKind] : [],
    sourceRole: scored.sourceRole,
    sourceRoleStatus: scored.sourceRoleStatus,
    supportOnly: metadata.supportOnly,
    canBePrimary: metadata.canBePrimary,
    parserType: scored.parserType,
    canCreateSchedulableRows: scored.canCreateSchedulableRows,
    requiresVerification,
    verified,
    sectionAnchor: metadata.sectionAnchor,
    sameDepartment: metadata.sameDepartment,
    sameMajorIdentityScore: metadata.sameMajorIdentityScore,
    pathwayIdentityScore: metadata.pathwayIdentityScore,
    discoveryDepth: Number.isFinite(rawCandidate.discoveryDepth)
      ? rawCandidate.discoveryDepth
      : 0,
    score: scored.score,
    confidence: scored.confidence,
    reasons: scored.reasons,
    detectedYears: scored.detectedYears ?? [],
    latestDetectedYear: scored.latestDetectedYear ?? null,
  };

  const current = candidateMap.get(normalizedUrl);
  candidateMap.set(normalizedUrl, current ? mergeCandidate(current, mergedCandidate) : mergedCandidate);
}

async function mapWithConcurrency(items, worker, concurrency, options = {}) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let completedCount = 0;
  const progressLabel = options.progressLabel ?? null;
  const describeItem =
    typeof options.describeItem === "function"
      ? options.describeItem
      : (_item, index) => `item ${index + 1}`;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
      completedCount += 1;
      if (progressLabel) {
        console.log(
          `[${completedCount}/${items.length}] ${progressLabel} - ${describeItem(
            items[currentIndex],
            currentIndex
          )}`
        );
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const includeExisting = args.includes("--all");
  const dryRun = args.includes("--dry-run");
  const campusArg = args.find((arg) => arg.startsWith("--campus="));
  const campusFilter = campusArg ? campusArg.slice("--campus=".length) : null;
  const targetPlanId = getArgValue("--target-plan-id");

  if (campusFilter && !CAMPUS_IDS.has(campusFilter)) {
    throw new Error(`Unsupported campus filter: ${campusFilter}`);
  }

  return {
    includeExisting,
    dryRun,
    campusFilter,
    targetPlanId,
  };
}

function buildReplacementDecision(target, candidates) {
  const sortedCandidates = [...(candidates ?? [])].sort(compareScoredCandidates);
  const primaryCandidates = sortedCandidates.filter(isPrimaryEligibleCandidate);
  const topCandidate = primaryCandidates[0] ?? null;
  if (!target.existingPrimaryUrl) {
    return {
      suggestedPrimary:
        topCandidate && topCandidate.score >= MIN_PRIMARY_DISCOVERY_SCORE ? topCandidate : null,
      currentPrimary: null,
      action:
        topCandidate && topCandidate.score >= MIN_PRIMARY_DISCOVERY_SCORE
          ? "add-missing-primary"
          : "no-suggestion",
      scoreDelta: null,
    };
  }

  const currentPrimary =
    sortedCandidates.find((candidate) => candidate.url === target.existingPrimaryUrl) ?? null;
  const bestAlternative =
    primaryCandidates.find((candidate) => candidate.url !== target.existingPrimaryUrl) ?? null;

  if (!bestAlternative) {
    return {
      suggestedPrimary: null,
      currentPrimary,
      action: "keep-existing-primary",
      scoreDelta: null,
    };
  }

  const currentScore = currentPrimary?.score ?? Number.NEGATIVE_INFINITY;
  const scoreDelta = bestAlternative.score - currentScore;
  const signalCodes = new Set(
    (target.reevaluationSignals ?? []).map((signal) => String(signal?.code ?? "").trim())
  );
  const replacementReasons = new Set(bestAlternative.reasons ?? []);
  const currentPrimaryMissesSelectedPathway = signalCodes.has("primary-source-misses-selected-pathway");
  const currentPrimaryClearlyWrong =
    signalCodes.has("primary-url-looks-graduate-or-timeline") ||
    signalCodes.has("page-headings-look-graduate-or-timeline-heavy") ||
    signalCodes.has("no-parsed-uw-course-codes");
  const currentPrimaryLooksYearSpecific = signalCodes.has("primary-source-appears-year-specific");
  const replacementHasUndergradRequirementEvidence =
    replacementReasons.has("explicit degree-requirements wording") ||
    replacementReasons.has("explicit major-requirements wording") ||
    replacementReasons.has("graduation requirements wording") ||
    replacementReasons.has("program-requirements wording") ||
    replacementReasons.has("major-admissions-requirements wording") ||
    replacementReasons.has("undergraduate-program wording") ||
    replacementReasons.has("undergraduate-major-admission wording") ||
    replacementReasons.has("undergraduate path segment") ||
    replacementReasons.has("requirements path segment") ||
    replacementReasons.has("specific bachelor route wording") ||
    replacementReasons.has("same-program requirement source can replace a zero-course primary") ||
    replacementReasons.has("same-program curriculum child can replace a zero-course overview primary") ||
    replacementReasons.has("same-program option/concentration child source matches the selected pathway") ||
    replacementReasons.has("pathway-specific official child page matches the selected pathway");
  const replacementHasStructuredRequirementPageEvidence =
    replacementReasons.has("checklist-style wording") ||
    replacementReasons.has("explicit degree-requirements wording") ||
    replacementReasons.has("explicit major-requirements wording") ||
    replacementReasons.has("graduation requirements wording") ||
    replacementReasons.has("program-requirements wording") ||
    replacementReasons.has("specific bachelor route wording") ||
    replacementReasons.has("same-program requirement source can replace a zero-course primary") ||
    replacementReasons.has("same-program curriculum child can replace a zero-course overview primary") ||
    replacementReasons.has("same-program option/concentration child source matches the selected pathway") ||
    replacementReasons.has("pathway-specific official child page matches the selected pathway");
  const replacementHasExplicitRequirementEvidence =
    replacementReasons.has("explicit degree-requirements wording") ||
    replacementReasons.has("explicit major-requirements wording") ||
    replacementReasons.has("graduation requirements wording") ||
    replacementReasons.has("program-requirements wording") ||
    replacementReasons.has("major-admissions-requirements wording") ||
    replacementReasons.has("same-program requirement source can replace a zero-course primary") ||
    replacementReasons.has("same-program curriculum child can replace a zero-course overview primary") ||
    replacementReasons.has("same-program option/concentration child source matches the selected pathway");
  const replacementHasStrongProgramMatch =
    !replacementReasons.has("candidate appears to describe a different degree route") &&
    (replacementReasons.has("official source path matches the selected pathway") ||
      replacementReasons.has("official source path matches the selected major") ||
      replacementReasons.has("official source text matches the selected pathway") ||
      replacementReasons.has("official source acronym matches the selected pathway") ||
      replacementReasons.has("official source text matches the selected major") ||
      replacementReasons.has("official source acronym matches the selected major") ||
      replacementReasons.has("explicitly names the selected major") ||
      replacementReasons.has("explicitly names the selected pathway or route") ||
      replacementReasons.has("same-program requirement source can replace a zero-course primary") ||
      replacementReasons.has("same-program option/concentration child source matches the selected pathway"));
  const staysOnDepartmentHost = replacementReasons.has(
    "stays on the current official department host"
  );
  const staysInTrustedReplacementScope =
    staysOnDepartmentHost ||
    replacementReasons.has("same-program requirement source can replace a zero-course primary") ||
    replacementReasons.has("same-program option/concentration child source matches the selected pathway");
  const currentSourceLatestYear = Number.isFinite(target?.reevaluationContext?.currentSourceLatestYear)
    ? target.reevaluationContext.currentSourceLatestYear
    : currentPrimary?.latestDetectedYear ?? null;
  const betterSiblingByYear =
    currentPrimaryLooksYearSpecific &&
    currentSourceLatestYear !== null &&
    bestAlternative.latestDetectedYear !== null &&
    bestAlternative.latestDetectedYear > currentSourceLatestYear &&
    replacementHasStrongProgramMatch &&
    replacementHasUndergradRequirementEvidence &&
    staysOnDepartmentHost;
  const strongerCurrentDegreePageReplacement =
    currentPrimaryLooksYearSpecific &&
    replacementHasStrongProgramMatch &&
    replacementHasStructuredRequirementPageEvidence &&
    staysOnDepartmentHost &&
    !isLinkedDocumentCandidateUrl(bestAlternative.url) &&
    !replacementReasons.has("overview wording") &&
    !replacementReasons.has("graduate-program wording") &&
    !replacementReasons.has("timeline wording");
  const replacementCombinedText = [
    bestAlternative.url,
    bestAlternative.label,
    bestAlternative.anchorText,
    bestAlternative.pageTitle,
    ...(bestAlternative.pageHeadings ?? []),
  ]
    .filter(Boolean)
    .join(" \n");
  const pathwaySpecificReplacementCanFixMiss =
    currentPrimaryMissesSelectedPathway &&
    replacementHasExplicitRequirementEvidence &&
    bestAlternative.sourceRole !== "official-catalog" &&
    !/\bminor\b/i.test(replacementCombinedText);
  const replacementIsSingleRouteForMultiPathwayMajor =
    isSingleDegreeRouteCandidateForMultiPathwayMajor(
      target,
      bestAlternative,
      replacementCombinedText
    );
  const minimumReplacementScoreDelta = betterSiblingByYear
    ? MIN_STALE_YEAR_REPLACEMENT_SCORE_DELTA
    : strongerCurrentDegreePageReplacement
      ? MIN_STALE_YEAR_REPLACEMENT_SCORE_DELTA
      : MIN_CLEAR_REPLACEMENT_SCORE_DELTA;
  const shouldReplace =
    target.analysisMode === "weak-existing-primary" &&
    (
      currentPrimaryClearlyWrong ||
      betterSiblingByYear ||
      strongerCurrentDegreePageReplacement ||
      pathwaySpecificReplacementCanFixMiss
    ) &&
    replacementHasUndergradRequirementEvidence &&
    replacementHasStrongProgramMatch &&
    staysInTrustedReplacementScope &&
    !replacementIsSingleRouteForMultiPathwayMajor &&
    bestAlternative.confidence === "high" &&
    bestAlternative.score >= MIN_HIGH_CONFIDENCE_SCORE &&
    isAutoPromotablePrimaryCandidate(bestAlternative) &&
    scoreDelta >= minimumReplacementScoreDelta;

  if (shouldReplace) {
    return {
      suggestedPrimary: bestAlternative,
      currentPrimary,
      action: "replace-existing-primary",
      scoreDelta,
    };
  }

  return {
    suggestedPrimary: null,
    currentPrimary,
    action: "keep-existing-primary",
    scoreDelta,
    reviewCandidate:
      bestAlternative.score >= MIN_PRIMARY_DISCOVERY_SCORE ? bestAlternative : null,
  };
}

function buildOfficialSiteRootSeedPages(target) {
  if (target.analysisMode !== "weak-existing-primary" || !target.existingPrimaryUrl) {
    return [];
  }

  try {
    const parsed = new URL(target.existingPrimaryUrl);
    const rootUrl = normalizeCandidateUrl(parsed.origin);
    if (!rootUrl) {
      return [];
    }
    const alreadyTracked = (target.officialLinks ?? []).some((link) => link.url === rootUrl);
    if (alreadyTracked) {
      return [];
    }
    return [
      {
        url: rootUrl,
        sourceKind: "official-site-root",
      },
    ];
  } catch {
    return [];
  }
}

function shouldRunDeeperDiscovery(target, candidateMap) {
  if (!target.existingPrimaryUrl) {
    return true;
  }

  if (target.analysisMode === "weak-existing-primary") {
    return true;
  }

  const sortedCandidates = [...candidateMap.values()].sort(compareScoredCandidates);
  const currentPrimary = sortedCandidates.find(
    (candidate) => candidate.url === target.existingPrimaryUrl
  );
  const topCandidate = sortedCandidates[0] ?? null;

  if (!currentPrimary && !topCandidate) {
    return true;
  }

  if ((target.reevaluationSignals ?? []).length > 0) {
    return true;
  }

  if ((currentPrimary?.score ?? Number.NEGATIVE_INFINITY) < MIN_HIGH_CONFIDENCE_SCORE) {
    return true;
  }

  return Boolean(topCandidate && topCandidate.confidence !== "high");
}

function isPrimaryEligibleCandidate(candidate) {
  return (
    candidate &&
    (candidate.requiresVerification !== true || candidate.verified === true) &&
    candidate.canCreateSchedulableRows !== false &&
    candidate.canBePrimary !== false &&
    candidate.sourceRoleStatus === "primary"
  );
}

function describeDiscoveryTarget(target) {
  const ownerKey = target?.ownerKey ?? target?.planId ?? "unknown-owner";
  const title = target?.title ?? target?.label ?? "";
  return title ? `${ownerKey} (${title})` : ownerKey;
}

function isSupportCandidate(candidate) {
  return candidate?.supportOnly === true || candidate?.sourceRoleStatus === "support";
}

function isNonSchedulableCandidate(candidate) {
  return candidate?.sourceRoleStatus === "non-schedulable";
}

function isTargetedOfficialFollowRole(sourceRole) {
  return new Set([
    "official-catalog",
    "primary-degree-requirements",
    "department-requirements",
    "pathway-degree-sheet",
    "approved-course-list",
    "elective-list",
    "admission-prerequisite-source",
    "admissions-preparation",
    "curriculum-map",
  ]).has(sourceRole);
}

function shouldFollowTargetedOfficialCandidate(candidate, target = null) {
  if (!candidate || (candidate.discoveryDepth ?? 0) >= 2) {
    return false;
  }

  if (candidate.pageTitle || isLinkedDocumentCandidateUrl(candidate.url)) {
    return false;
  }

  const sourceKinds = new Set(candidate.sourceKinds ?? []);
  if (
    !sourceKinds.has("discovered-anchor") &&
    !sourceKinds.has("campus-major-index") &&
    !sourceKinds.has("official-site-root") &&
    !sourceKinds.has("targeted-official-candidate") &&
    !sourceKinds.has("inferred-hub-child-candidate")
  ) {
    return false;
  }

  if (candidate.sourceRole === "sample-schedule") {
    return false;
  }

  const searchable = `${candidate.linkText ?? ""} ${candidate.anchorText ?? ""} ${
    candidate.label ?? ""
  } ${candidate.url ?? ""}`;
  const pathwayTrackIdentityCandidate = Boolean(
    candidate.sameDepartment &&
      target?.ownerType === "pathway" &&
      (candidate.pathwayIdentityScore ?? 0) > 0 &&
      PATHWAY_SOURCE_CUE_PATTERN.test(searchable)
  );
  if (
    UNRELATED_OFFICIAL_LINK_FOLLOW_PATTERN.test(searchable) &&
    !APPROVED_COURSE_LIST_CUE_PATTERN.test(searchable) &&
    !ELECTIVE_LIST_CUE_PATTERN.test(searchable) &&
    !pathwayTrackIdentityCandidate
  ) {
    return false;
  }

  if (
    candidate.sameDepartment &&
    (candidate.sameMajorIdentityScore ?? 0) > 0 &&
    (candidate.pathwayIdentityScore ?? 0) > 0
  ) {
    return true;
  }

  if (pathwayTrackIdentityCandidate) {
    return true;
  }

  if (
    candidate.sameDepartment &&
    (candidate.sameMajorIdentityScore ?? 0) > 0 &&
    hasMatchingDegreeRoute(`${target?.title ?? ""} ${target?.label ?? ""}`, searchable)
  ) {
    return true;
  }

  if (isTargetedOfficialFollowRole(candidate.sourceRole)) {
    return true;
  }

  return TARGETED_OFFICIAL_LINK_FOLLOW_CUE_PATTERN.test(searchable);
}

function compareTargetedOfficialFollowCandidates(left, right) {
  const leftSameDepartment = left.sameDepartment ? 1 : 0;
  const rightSameDepartment = right.sameDepartment ? 1 : 0;
  if (leftSameDepartment !== rightSameDepartment) {
    return rightSameDepartment - leftSameDepartment;
  }

  const leftPrimary = isPrimaryEligibleCandidate(left) ? 1 : 0;
  const rightPrimary = isPrimaryEligibleCandidate(right) ? 1 : 0;
  if (leftPrimary !== rightPrimary) {
    return rightPrimary - leftPrimary;
  }

  const leftSupport = isSupportCandidate(left) ? 1 : 0;
  const rightSupport = isSupportCandidate(right) ? 1 : 0;
  if (leftSupport !== rightSupport) {
    return rightSupport - leftSupport;
  }

  const pathwayDelta = (right.pathwayIdentityScore ?? 0) - (left.pathwayIdentityScore ?? 0);
  if (pathwayDelta !== 0) {
    return pathwayDelta;
  }

  const majorDelta = (right.sameMajorIdentityScore ?? 0) - (left.sameMajorIdentityScore ?? 0);
  if (majorDelta !== 0) {
    return majorDelta;
  }

  return compareScoredCandidates(left, right);
}

function buildRetainedDiscoveryCandidates(sortedCandidates) {
  const retainedByUrl = new Map();
  const addCandidates = (candidates, limit) => {
    for (const candidate of candidates.slice(0, limit)) {
      retainedByUrl.set(candidate.url, candidate);
    }
  };

  addCandidates(
    sortedCandidates.filter(isPrimaryEligibleCandidate),
    MAX_RETAINED_PRIMARY_CANDIDATES_PER_OWNER
  );
  addCandidates(
    sortedCandidates.filter(isSupportCandidate),
    MAX_RETAINED_SUPPORT_CANDIDATES_PER_OWNER
  );
  addCandidates(
    sortedCandidates.filter(isNonSchedulableCandidate),
    MAX_RETAINED_NON_SCHEDULABLE_CANDIDATES_PER_OWNER
  );

  if (!retainedByUrl.size) {
    addCandidates(sortedCandidates, MAX_RETAINED_PRIMARY_CANDIDATES_PER_OWNER);
  }

  return [...retainedByUrl.values()].sort(compareScoredCandidates);
}

function buildSourceDiscoveryAuditLines(target, candidates, suggestion) {
  const usedUrl =
    suggestion.suggestedPrimary?.url ??
    (suggestion.action === "keep-existing-primary" ? target.existingPrimaryUrl : null);

  return (candidates ?? []).map((candidate) => {
    const usedForParsing = usedUrl && candidate.url === usedUrl;
    return [
      "[source discovery audit]",
      `Major id: ${target.planId ?? "unknown"}`,
      `Owner id: ${target.ownerKey ?? target.planId ?? "unknown"}`,
      `Seed URL: ${candidate.sourcePageUrl ?? target.existingPrimaryUrl ?? "n/a"}`,
      `Discovered from: ${candidate.discoveredFromUrl ?? candidate.sourcePageUrl ?? "n/a"}`,
      `Source URL: ${candidate.url}`,
      `Candidate URL: ${candidate.url}`,
      `Link text: ${candidate.linkText || candidate.anchorText || candidate.label || candidate.pageTitle || "n/a"}`,
      `Detected source role: ${candidate.sourceRole ?? "ignored"}`,
      `Detected role: ${candidate.sourceRole ?? "ignored"}`,
      `Source role: ${candidate.sourceRole ?? "ignored"}`,
      `Primary/support/non-schedulable status: ${
        candidate.sourceRoleStatus ?? getSourceRoleStatus(candidate.sourceRole ?? "ignored")
      }`,
      `Support-only: ${candidate.supportOnly ? "yes" : "no"}`,
      `Can be primary: ${candidate.canBePrimary ? "yes" : "no"}`,
      `Anchor preserved: ${candidate.sectionAnchor ? "yes" : "no"}`,
      `Section anchor: ${candidate.sectionAnchor ?? "n/a"}`,
      `Same department: ${candidate.sameDepartment ? "yes" : "no"}`,
      `Same major identity score: ${candidate.sameMajorIdentityScore ?? 0}`,
      `Pathway identity score: ${candidate.pathwayIdentityScore ?? 0}`,
      `Parser type: ${candidate.parserType ?? getDiscoveryParserType(candidate, candidate.sourceRole ?? "ignored")}`,
      `Discovery depth: ${candidate.discoveryDepth ?? 0}`,
      `Ranking score: ${candidate.score}`,
      `Score: ${candidate.score}`,
      `Reason for role: ${getSourceRoleMetadata(candidate.sourceRole ?? "ignored").reason}`,
      `Can create schedulable rows: ${
        (candidate.canCreateSchedulableRows ??
          canSourceRoleCreateSchedulableRows(candidate.sourceRole ?? "ignored"))
          ? "yes"
          : "no"
      }`,
      `Used for parsing: ${usedForParsing ? "yes" : "no"}`,
      `Reason: ${(candidate.reasons ?? []).join("; ") || "no scoring reason recorded"}`,
    ].join(" ");
  });
}

async function analyzeOwner(target, timeoutMs, options = {}) {
  const inspectPageImpl = options.inspectPageImpl ?? inspectPage;
  const discoveryLinks = [
    ...(target.officialLinks ?? []),
    ...(
      target.existingPrimary?.url &&
      !(target.officialLinks ?? []).some((link) => link.url === target.existingPrimary.url)
        ? [
            {
              label: target.existingPrimary.label ?? target.label,
              url: target.existingPrimary.url,
            },
          ]
        : []
    ),
  ];
  const baseDomains = (() => {
    const discoveredBaseDomains = getBaseDomains(discoveryLinks.map((link) => link.url));
    return discoveredBaseDomains.length ? discoveredBaseDomains : getFallbackBaseDomains(target.campusId);
  })();
  const candidateMap = new Map();
  const sourcePages = [];

  for (const link of discoveryLinks) {
    addScoredCandidate(candidateMap, target, {
      url: link.url,
      label: link.label,
      pageTitle:
        link.url === target.existingPrimary?.url &&
        (target.parsedBlock?.primarySourceUrl === target.existingPrimary?.url ||
          target.parsedBlock?.sourceUrl === target.existingPrimary?.url)
          ? target.parsedBlock?.extractedTitle ?? null
          : null,
      pageHeadings:
        link.url === target.existingPrimary?.url &&
        (target.parsedBlock?.primarySourceUrl === target.existingPrimary?.url ||
          target.parsedBlock?.sourceUrl === target.existingPrimary?.url)
          ? target.parsedBlock?.extractedHeadings ?? []
          : [],
      sourceKind: "official-link",
      discoveryDepth: 0,
    });
  }

  for (const candidate of buildInferredPathwayHubChildSourceCandidates(target, discoveryLinks)) {
    addScoredCandidate(candidateMap, target, candidate);
  }

  for (const candidate of TARGETED_OFFICIAL_SOURCE_CANDIDATES[target.ownerKey] ?? []) {
    addScoredCandidate(candidateMap, target, {
      ...candidate,
      sourceKind: "targeted-official-candidate",
      discoveryDepth: 0,
    });
  }

  const fallbackSourcePages =
    discoveryLinks.length === 0
      ? (FALLBACK_DISCOVERY_SOURCE_PAGES_BY_CAMPUS[target.campusId] ?? []).map((url) => ({
          url,
          sourceKind: "campus-major-index",
        }))
      : [];
  const derivedSourcePages = buildOfficialSiteRootSeedPages(target);
  const seedSourcePages = [...fallbackSourcePages, ...derivedSourcePages];

  for (const link of discoveryLinks) {
    const page = await inspectPageImpl(link.url, timeoutMs);
    const pageCandidateUrl = preserveCandidateSectionAnchor(link.url, page.finalUrl || link.url);
    sourcePages.push({
      url: link.url,
      finalUrl: page.finalUrl,
      ok: page.ok,
      status: page.status,
      contentType: page.contentType,
      title: page.title,
      headingCount: (page.headings ?? []).length,
      error: page.error,
      anchorCount: page.anchors.length,
    });

    addScoredCandidate(candidateMap, target, {
      url: pageCandidateUrl,
      label: link.label,
      pageTitle: page.title,
      pageHeadings: page.headings,
      sourceKind: "official-link",
      discoveryDepth: 0,
    });

    for (const inferredCandidate of buildInferredPathwayHubChildSourceCandidates(target, [
      { url: pageCandidateUrl, label: link.label ?? page.title ?? target.label },
    ])) {
      addScoredCandidate(candidateMap, target, inferredCandidate);
    }

    for (const anchor of page.anchors) {
      if (!isAllowedDiscoveryUrl(anchor.url, baseDomains)) {
        continue;
      }
      addScoredCandidate(candidateMap, target, {
        url: anchor.url,
        anchorText: anchor.text,
        linkText: anchor.text,
        sourcePageUrl: pageCandidateUrl,
        discoveredFromUrl: pageCandidateUrl,
        sourceKind: "discovered-anchor",
        discoveryDepth: 1,
      });
    }
  }

  for (const sourcePage of seedSourcePages) {
    const page = await inspectPageImpl(sourcePage.url, timeoutMs);
    const pageCandidateUrl = preserveCandidateSectionAnchor(
      sourcePage.url,
      page.finalUrl || sourcePage.url
    );
    sourcePages.push({
      url: sourcePage.url,
      finalUrl: page.finalUrl,
      ok: page.ok,
      status: page.status,
      contentType: page.contentType,
      title: page.title,
      headingCount: (page.headings ?? []).length,
      error: page.error,
      anchorCount: page.anchors.length,
      sourceKind: sourcePage.sourceKind,
    });

    for (const anchor of page.anchors) {
      if (!isAllowedDiscoveryUrl(anchor.url, baseDomains)) {
        continue;
      }
      addScoredCandidate(candidateMap, target, {
        url: anchor.url,
        anchorText: anchor.text,
        linkText: anchor.text,
        sourcePageUrl: pageCandidateUrl,
        discoveredFromUrl: pageCandidateUrl,
        discoveryDepth: 1,
        sourceKind:
          sourcePage.sourceKind === "official-site-root"
            ? "discovered-anchor"
            : sourcePage.sourceKind,
      });
    }
  }

  const verifiedCandidateUrls = new Set();
  const targetedOfficialFollowTargets = [...candidateMap.values()]
    .filter(
      (candidate) =>
        !verifiedCandidateUrls.has(candidate.url) &&
        shouldFollowTargetedOfficialCandidate(candidate, target)
    )
    .sort(compareTargetedOfficialFollowCandidates)
    .slice(0, MAX_TARGETED_OFFICIAL_FOLLOW_CANDIDATES_PER_OWNER);

  for (const candidate of targetedOfficialFollowTargets) {
    verifiedCandidateUrls.add(candidate.url);
    const page = await inspectPageImpl(candidate.url, timeoutMs);
    const pageCandidateUrl = preserveCandidateSectionAnchor(candidate.url, page.finalUrl || candidate.url);
    sourcePages.push({
      url: candidate.url,
      finalUrl: page.finalUrl,
      ok: page.ok,
      status: page.status,
      contentType: page.contentType,
      title: page.title,
      headingCount: (page.headings ?? []).length,
      error: page.error,
      anchorCount: page.anchors.length,
      sourceKind: "targeted-official-follow",
      discoveredFromUrl: candidate.discoveredFromUrl ?? candidate.sourcePageUrl ?? null,
    });

    addScoredCandidate(candidateMap, target, {
      url: pageCandidateUrl,
      label: candidate.label,
      anchorText: candidate.anchorText,
      linkText: candidate.linkText,
      pageTitle: page.title,
      pageHeadings: page.headings,
      sourcePageUrl: candidate.sourcePageUrl,
      discoveredFromUrl: candidate.discoveredFromUrl ?? candidate.sourcePageUrl ?? null,
      sourceKind: candidate.sourceKinds?.[0] ?? "discovered-anchor",
      discoveryDepth: candidate.discoveryDepth ?? 1,
      requiresVerification: candidate.requiresVerification === true,
    });

    for (const inferredCandidate of buildInferredPathwayHubChildSourceCandidates(target, [
      {
        url: pageCandidateUrl,
        label: candidate.linkText ?? candidate.anchorText ?? candidate.label ?? page.title ?? target.label,
      },
    ])) {
      addScoredCandidate(candidateMap, target, inferredCandidate);
    }

    for (const anchor of page.anchors) {
      if (!isAllowedDiscoveryUrl(anchor.url, baseDomains)) {
        continue;
      }

      const rawAnchorCandidate = {
        url: anchor.url,
        anchorText: anchor.text,
        linkText: anchor.text,
        sourcePageUrl: pageCandidateUrl,
        discoveredFromUrl: pageCandidateUrl,
        sourceKind: "discovered-anchor",
        discoveryDepth: Math.min(2, (candidate.discoveryDepth ?? 1) + 1),
      };
      const anchorRole = classifySourceDiscoveryRole(rawAnchorCandidate);
      const searchable = `${anchor.text ?? ""} ${anchor.url ?? ""}`;
      if (anchorRole === "sample-schedule") {
        continue;
      }
      if (
        !isTargetedOfficialFollowRole(anchorRole) &&
        !TARGETED_OFFICIAL_LINK_FOLLOW_CUE_PATTERN.test(searchable)
      ) {
        continue;
      }
      if (
        UNRELATED_OFFICIAL_LINK_FOLLOW_PATTERN.test(searchable) &&
        !APPROVED_COURSE_LIST_CUE_PATTERN.test(searchable) &&
        !ELECTIVE_LIST_CUE_PATTERN.test(searchable)
      ) {
        continue;
      }

      addScoredCandidate(candidateMap, target, rawAnchorCandidate);
    }
  }

  const allowDeeperDiscovery = shouldRunDeeperDiscovery(target, candidateMap);

  for (let pass = 0; pass < MAX_DISCOVERY_VERIFICATION_PASSES; pass += 1) {
    if (!allowDeeperDiscovery) {
      break;
    }
    const verifyTargets = [...candidateMap.values()]
      .sort(compareScoredCandidates)
      .filter(
        (candidate) =>
          !verifiedCandidateUrls.has(candidate.url) &&
          !candidate.pageTitle &&
          !isLinkedDocumentCandidateUrl(candidate.url) &&
          (candidate.discoveryDepth ?? 0) < 2 &&
          candidate.score >= 8
      )
      .slice(0, MAX_DISCOVERED_CANDIDATES_PER_OWNER);

    if (!verifyTargets.length) {
      break;
    }

    for (const candidate of verifyTargets) {
      verifiedCandidateUrls.add(candidate.url);
      const page = await inspectPageImpl(candidate.url, timeoutMs);
      const pageCandidateUrl = preserveCandidateSectionAnchor(candidate.url, page.finalUrl || candidate.url);
      addScoredCandidate(candidateMap, target, {
        url: pageCandidateUrl,
        label: candidate.label,
        anchorText: candidate.anchorText,
        linkText: candidate.linkText,
        pageTitle: page.title,
        pageHeadings: page.headings,
        sourcePageUrl: candidate.sourcePageUrl,
        discoveredFromUrl: candidate.discoveredFromUrl ?? candidate.sourcePageUrl ?? null,
        sourceKind: candidate.sourceKinds?.[0] ?? "discovered-anchor",
        discoveryDepth: candidate.discoveryDepth ?? 1,
        requiresVerification: candidate.requiresVerification === true,
      });

      for (const inferredCandidate of buildInferredPathwayHubChildSourceCandidates(target, [
        {
          url: pageCandidateUrl,
          label: candidate.linkText ?? candidate.anchorText ?? candidate.label ?? page.title ?? target.label,
        },
      ])) {
        addScoredCandidate(candidateMap, target, inferredCandidate);
      }

      for (const anchor of page.anchors) {
        if (!isAllowedDiscoveryUrl(anchor.url, baseDomains)) {
          continue;
        }
        addScoredCandidate(candidateMap, target, {
          url: anchor.url,
          anchorText: anchor.text,
          linkText: anchor.text,
          sourcePageUrl: pageCandidateUrl,
          discoveredFromUrl: pageCandidateUrl,
          sourceKind: "discovered-anchor",
          discoveryDepth: Math.min(2, (candidate.discoveryDepth ?? 1) + 1),
        });
      }
    }
  }

  const sortedCandidates = [...candidateMap.values()].sort(compareScoredCandidates);
  const retainedCandidates = buildRetainedDiscoveryCandidates(sortedCandidates);
  const primaryCandidates = sortedCandidates.filter(isPrimaryEligibleCandidate);
  const supportCandidates = sortedCandidates.filter(isSupportCandidate);
  const nonSchedulableCandidates = sortedCandidates.filter(isNonSchedulableCandidate);
  const suggestion = buildReplacementDecision(target, sortedCandidates);

  return {
    analysisMode: target.analysisMode,
    ownerType: target.ownerType,
    ownerKey: target.ownerKey,
    planId: target.planId,
    pathwayId: target.pathwayId,
    title: target.title,
    label: target.label,
    campusId: target.campusId,
    existingPrimaryUrl: target.existingPrimary?.url ?? null,
    existingPrimaryLabel: target.existingPrimary?.label ?? null,
    officialLinks: target.officialLinks,
    reevaluationSignals: target.reevaluationSignals ?? [],
    reevaluationContext: target.reevaluationContext ?? null,
    sourcePages,
    candidateCount: candidateMap.size,
    currentPrimary: suggestion.currentPrimary ?? null,
    reviewCandidate: suggestion.reviewCandidate ?? null,
    suggestedPrimary: suggestion.suggestedPrimary ?? null,
    suggestedAction: suggestion.action,
    suggestedScoreDelta: suggestion.scoreDelta ?? null,
    deeperDiscoveryEnabled: allowDeeperDiscovery,
    targetedOfficialFollowCount: targetedOfficialFollowTargets.length,
    sourceDiscoveryAuditLines: buildSourceDiscoveryAuditLines(target, retainedCandidates, suggestion),
    topCandidates: retainedCandidates,
    primaryCandidates: primaryCandidates.slice(0, MAX_RETAINED_PRIMARY_CANDIDATES_PER_OWNER),
    supportCandidates: supportCandidates.slice(0, MAX_RETAINED_SUPPORT_CANDIDATES_PER_OWNER),
    supplementalCandidates: supportCandidates.slice(0, MAX_RETAINED_SUPPORT_CANDIDATES_PER_OWNER),
    nonSchedulableCandidates: nonSchedulableCandidates.slice(
      0,
      MAX_RETAINED_NON_SCHEDULABLE_CANDIDATES_PER_OWNER
    ),
  };
}

function writeMarkdownReport(report) {
  const lines = [
    "# Transfer Planner Primary Source Discovery",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Owners analyzed: ${report.ownerCount}`,
    `- Missing-primary owners analyzed: ${report.missingPrimaryOwnerCount}`,
    `- High-confidence suggestions: ${report.highConfidenceSuggestionCount}`,
    `- Medium-confidence suggestions: ${report.mediumConfidenceSuggestionCount}`,
    `- No usable suggestion yet: ${report.noSuggestionCount}`,
    `- Weak existing primaries re-evaluated: ${report.weakExistingOwnerCount ?? 0}`,
    `- High-confidence replacements: ${report.highConfidenceReplacementCount ?? 0}`,
    `- Replacement review candidates: ${report.reviewReplacementCount ?? 0}`,
    `- Existing primaries kept after re-evaluation: ${report.keepExistingPrimaryCount ?? 0}`,
    "",
  ];

  for (const campusId of ["uw-seattle", "uw-bothell", "uw-tacoma"]) {
    const campusOwners = report.owners.filter((owner) => owner.campusId === campusId);
    if (!campusOwners.length) {
      continue;
    }

    lines.push(`## ${campusId}`, "");
    campusOwners.slice(0, 80).forEach((owner) => {
      const suggestion = owner.suggestedPrimary;
      lines.push(`### ${owner.title}`);
      lines.push("");
      if (suggestion) {
        lines.push(`- Suggested primary source: ${suggestion.url}`);
        lines.push(`- Confidence: ${suggestion.confidence}`);
        lines.push(`- Score: ${suggestion.score}`);
        if (suggestion.latestDetectedYear) {
          lines.push(`- Detected year signal: ${suggestion.latestDetectedYear}`);
        }
        lines.push(`- Why: ${suggestion.reasons.join("; ")}`);
      } else {
        lines.push("- Suggested primary source: none above threshold yet");
      }
      lines.push(`- Official links scanned: ${owner.officialLinks.length}`);
      lines.push(`- Candidate URLs inspected: ${owner.candidateCount}`);
      lines.push("");
      owner.topCandidates.slice(0, 3).forEach((candidate) => {
        lines.push(`  - ${candidate.url}`);
        lines.push(`    - source role: ${candidate.sourceRole ?? "ignored"}`);
        lines.push(`    - support-only: ${candidate.supportOnly ? "yes" : "no"}`);
        if (candidate.discoveredFromUrl) {
          lines.push(`    - discovered from: ${candidate.discoveredFromUrl}`);
        }
        if (candidate.sectionAnchor) {
          lines.push(`    - section anchor: ${candidate.sectionAnchor}`);
        }
        lines.push(`    - discovery depth: ${candidate.discoveryDepth ?? 0}`);
        lines.push(`    - confidence: ${candidate.confidence}`);
        lines.push(`    - score: ${candidate.score}`);
        if (candidate.latestDetectedYear) {
          lines.push(`    - detected year: ${candidate.latestDetectedYear}`);
        }
        lines.push(`    - reasons: ${candidate.reasons.join("; ")}`);
      });
      lines.push("");
      for (const auditLine of owner.sourceDiscoveryAuditLines ?? []) {
        lines.push(`  - ${auditLine}`);
      }
      if ((owner.sourceDiscoveryAuditLines ?? []).length) {
        lines.push("");
      }
      if ((owner.supportCandidates ?? []).length) {
        lines.push("  - Supplemental support candidates:");
        owner.supportCandidates.slice(0, 5).forEach((candidate) => {
          lines.push(`    - ${candidate.url}`);
          lines.push(`      - source role: ${candidate.sourceRole ?? "ignored"}`);
          lines.push(`      - link text: ${candidate.linkText ?? candidate.anchorText ?? candidate.label ?? "n/a"}`);
          lines.push(`      - discovered from: ${candidate.discoveredFromUrl ?? "n/a"}`);
          lines.push(`      - score: ${candidate.score}`);
        });
        lines.push("");
      }
    });
  }

  if ((report.weakExistingOwners ?? []).length) {
    lines.push("## Weak Existing Primaries", "");

    for (const owner of report.weakExistingOwners) {
      lines.push(`### ${owner.title}`);
      lines.push("");
      lines.push(`- Current primary: ${owner.existingPrimaryUrl}`);
      lines.push(`- Current primary label: ${owner.existingPrimaryLabel ?? "unknown"}`);
      lines.push(`- Suggested action: ${owner.suggestedAction}`);
      if (owner.suggestedPrimary) {
        lines.push(`- Suggested replacement: ${owner.suggestedPrimary.url}`);
        lines.push(`- Replacement confidence: ${owner.suggestedPrimary.confidence}`);
        lines.push(`- Replacement source role: ${owner.suggestedPrimary.sourceRole ?? "ignored"}`);
        lines.push(`- Replacement score: ${owner.suggestedPrimary.score}`);
        if (owner.suggestedPrimary.latestDetectedYear) {
          lines.push(`- Replacement detected year: ${owner.suggestedPrimary.latestDetectedYear}`);
        }
      } else if (owner.reviewCandidate) {
        lines.push(`- Review candidate: ${owner.reviewCandidate.url}`);
        lines.push(`- Review candidate source role: ${owner.reviewCandidate.sourceRole ?? "ignored"}`);
        lines.push(`- Review candidate score: ${owner.reviewCandidate.score}`);
        if (owner.reviewCandidate.latestDetectedYear) {
          lines.push(`- Review candidate detected year: ${owner.reviewCandidate.latestDetectedYear}`);
        }
      } else {
        lines.push("- Suggested replacement: none above replacement threshold");
      }
      if ((owner.reevaluationSignals ?? []).length) {
        lines.push(
          `- Re-evaluation triggers: ${owner.reevaluationSignals
            .map((signal) => signal.reason ?? signal.code)
            .join("; ")}`
        );
      }
      if (owner.currentPrimary) {
        lines.push(`- Current primary score: ${owner.currentPrimary.score}`);
        if (owner.currentPrimary.latestDetectedYear) {
          lines.push(`- Current primary detected year: ${owner.currentPrimary.latestDetectedYear}`);
        }
        lines.push(`- Current primary reasons: ${owner.currentPrimary.reasons.join("; ")}`);
      }
      lines.push(`- Official links scanned: ${owner.officialLinks.length}`);
      lines.push(`- Candidate URLs inspected: ${owner.candidateCount}`);
      lines.push(`- Deeper discovery enabled: ${owner.deeperDiscoveryEnabled ? "yes" : "no"}`);
      for (const auditLine of owner.sourceDiscoveryAuditLines ?? []) {
        lines.push(`- ${auditLine}`);
      }
      lines.push("");
    }
  }

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

async function main() {
  ensureTmpDir();

  const { includeExisting, dryRun, campusFilter, targetPlanId } = parseArgs();
  let effectiveTargetPlanId = targetPlanId;
  if (effectiveTargetPlanId && !fs.existsSync(OUTPUT_JSON_PATH)) {
    console.log(
      `No existing discovery report was found at ${OUTPUT_JSON_PATH}. Running a full discovery pass instead of a targeted merge for ${effectiveTargetPlanId}.`
    );
    effectiveTargetPlanId = null;
  }

  const targets = buildOwnerTargets({
    includeExisting,
    campusFilter,
    targetPlanId: effectiveTargetPlanId,
  });
  const weakExistingTargets = buildWeakExistingOwnerTargets({
    campusFilter,
    targetPlanId: effectiveTargetPlanId,
  });
  const previousReport = effectiveTargetPlanId ? readJsonIfExists(OUTPUT_JSON_PATH) : null;

  console.log(
    `Discovering primary degree-requirements sources for ${targets.length} planner owner(s)...`
  );
  console.log(
    `Re-evaluating ${weakExistingTargets.length} existing primary source owner(s) for stronger official replacements...`
  );
  if (effectiveTargetPlanId) {
    console.log(`Target plan scope: ${effectiveTargetPlanId}`);
  }

  const owners = await mapWithConcurrency(
    targets,
    (target) => analyzeOwner(target, DEFAULT_TIMEOUT_MS),
    DEFAULT_CONCURRENCY,
    {
      progressLabel: "primary source owners discovered",
      describeItem: describeDiscoveryTarget,
    }
  );
  const weakExistingOwners = await mapWithConcurrency(
    weakExistingTargets,
    (target) => analyzeOwner(target, DEFAULT_TIMEOUT_MS),
    DEFAULT_CONCURRENCY,
    {
      progressLabel: "weak primary owners re-evaluated",
      describeItem: describeDiscoveryTarget,
    }
  );

  const report = buildDiscoveryReport(owners, weakExistingOwners, {
    previousOwners: previousReport?.owners ?? [],
    previousWeakExistingOwners: previousReport?.weakExistingOwners ?? [],
    targetPlanId: effectiveTargetPlanId,
  });

  if (!dryRun) {
    fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
    writeMarkdownReport(report);
  }

  console.log(`High-confidence suggestions: ${report.highConfidenceSuggestionCount}`);
  console.log(`Medium-confidence suggestions: ${report.mediumConfidenceSuggestionCount}`);
  console.log(`No suggestion yet: ${report.noSuggestionCount}`);
  console.log(`Weak existing primaries re-evaluated: ${report.weakExistingOwnerCount}`);
  console.log(`High-confidence replacements: ${report.highConfidenceReplacementCount}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown summary: ${OUTPUT_MD_PATH}`);
}

module.exports = {
  analyzeOwner,
  buildDiscoveryReport,
  buildOwnerTargetRecord,
  buildReplacementDecision,
  buildWeakExistingOwnerTargets,
  buildWeakExistingPrimarySignals,
  canSourceRoleCreateSchedulableRows,
  classifySourceDiscoveryRole,
  compareScoredCandidates,
  extractAnchors,
  extractHeadings,
  getDiscoveryParserType,
  getOfficialPrimaryScore,
  getSourceRoleStatus,
  inspectPage,
  isAutoPromotablePrimaryCandidate,
  scoreCandidate,
  shouldRunDeeperDiscovery,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
