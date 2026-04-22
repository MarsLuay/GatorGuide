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
  getTransferPlannerParsedRequirementSourceBlocks,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerRequirementDiffClassifications,
  getTransferPlannerStudentRuntimeMajorPlan,
  resolveTransferPlannerStudentRuntimeMajorPlan,
} = require("../../constants/transfer-planner-source");
const {
  getTransferPlannerManualSourceLinkOverride,
} = require("../../constants/transfer-planner-source/manual-source-link-overrides");

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
const MAX_EXTRACTED_HEADINGS = 18;
const MIN_PRIMARY_DISCOVERY_SCORE = 12;
const MIN_HIGH_CONFIDENCE_SCORE = 28;
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
  "uw-tacoma": [],
};
const OFFICIAL_UW_BASE_DOMAINS = uniqueSorted(
  Object.values(FALLBACK_DISCOVERY_BASE_DOMAINS_BY_CAMPUS).flat()
);
const SOURCE_REQUIREMENT_CUE_PATTERN =
  /\b(degree requirements?|major requirements?|graduation requirements?|major admissions requirements?|program requirements?|curriculum|checklist|prerequisites?|bachelor(?:\s+of)?|undergraduate major admission|undergraduate program)\b/i;
const SOURCE_WEAK_PRIMARY_URL_PATTERN =
  /(?:\/|^)(timeline(?:-and-requirements)?|graduate(?:-program|-admissions)?|phd|research|faculty|news|about)(?:[-/?#]|$)/i;
const SOURCE_WEAK_PRIMARY_HEADING_PATTERN =
  /\b(timeline(?:\s*&\s*requirements)?|graduate program|graduate admissions|ms requirements?|phd requirements?|research|faculty|news)\b/i;
const SOURCE_OVERVIEW_ONLY_PATTERN = /\boverview\b/i;
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
  "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed": [
    {
      label: "UW General Catalog Interdisciplinary Arts and Sciences individually designed major",
      url: "https://www.washington.edu/students/gencat/program/T/SocialSciences-1132.html#credential-68d16aa4cad998289e687fe1",
    },
  ],
  "uw-tacoma-arts-media-culture:pathway:american-cultures-track": [
    {
      label: "UW Tacoma American Cultures track",
      url: "https://www.tacoma.uw.edu/sias/cac/american-cultures-track",
    },
  ],
  "uw-tacoma-arts-media-culture:pathway:comparative-arts-track": [
    {
      label: "UW Tacoma Comparative Arts track",
      url: "https://www.tacoma.uw.edu/sias/cac/comparative-arts-track",
    },
  ],
  "uw-tacoma-arts-media-culture:pathway:film-media-track": [
    {
      label: "UW Tacoma Film and Media track",
      url: "https://www.tacoma.uw.edu/sias/cac/film-and-media-track",
    },
  ],
  "uw-tacoma-arts-media-culture:pathway:literature-track": [
    {
      label: "UW Tacoma Literature track",
      url: "https://www.tacoma.uw.edu/sias/cac/literature-track",
    },
  ],
  "uw-tacoma-arts-media-culture:pathway:visual-performing-arts-track": [
    {
      label: "UW Tacoma Visual and Performing Arts track",
      url: "https://www.tacoma.uw.edu/sias/cac/visual-and-performing-arts-track",
    },
  ],
  "uw-tacoma-communications": [
    {
      label: "UW Tacoma Communications major requirements",
      url: "https://www.tacoma.uw.edu/sias/cac/communication",
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
      isBlockedPrimarySourceCandidateUrl(lower)
    ) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    return hostnameMatchesBaseDomains(hostname, baseDomains);
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
    lower.includes("/wp-login") ||
    lower.includes("/print/courses")
  );
}

function normalizeCandidateUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return String(url ?? "").trim();
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

function getOfficialLinkRole(link) {
  const searchable = `${link?.label ?? ""} ${link?.url ?? ""}`.toLowerCase();

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
  const isPdf = normalizedUrl.endsWith(".pdf");

  if (role === "availability") {
    return "annual-schedule-pdf";
  }

  if (role === "equivalency") {
    return "equivalency-guide";
  }

  if (role === "catalog") {
    return "catalog-page";
  }

  if (isPdf && role === "worksheet") {
    return "pdf-worksheet";
  }

  if (isPdf && (role === "degree-requirements" || role === "curriculum")) {
    return "pdf-degree-sheet";
  }

  if (isPdf) {
    return "generic-pdf";
  }

  if (role === "degree-requirements") {
    return "html-degree-page";
  }

  if (role === "admissions") {
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

function getOfficialPrimaryScore(link) {
  const role = getOfficialLinkRole(link);
  const parserType = getOfficialLinkParserType(link, role);
  const searchable = `${link?.label ?? ""} ${link?.url ?? ""}`.toLowerCase();

  let score = 0;
  if (role === "degree-requirements") score += 100;
  if (role === "curriculum") score += 70;
  if (role === "catalog") score += 50;
  if (parserType === "pdf-degree-sheet") score += 20;
  if (/degree requirements|major requirements|graduation requirements/.test(searchable)) score += 25;
  if (/curriculum/.test(searchable)) score += 15;
  if (
    (role === "degree-requirements" || role === "curriculum") &&
    /\b(track|option|route|pathway|concentration|specialization)\b/.test(searchable)
  ) {
    score += 8;
  }
  if (/\/\/(?:www\.)?washington\.edu\/students\/gencat\/program\//.test(searchable)) {
    score -= 15;
  }
  if (role === "admissions" || role === "equivalency" || role === "availability") score -= 40;

  return score;
}

function isSafeFallbackOfficialRole(role) {
  return role === "degree-requirements" || role === "curriculum" || role === "overview" || role === "other";
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
  const hasWeakPrimaryUrl = SOURCE_WEAK_PRIMARY_URL_PATTERN.test(primarySource?.url ?? "");
  const hasWeakHeadings = SOURCE_WEAK_PRIMARY_HEADING_PATTERN.test(
    (parsedBlock?.extractedHeadings ?? []).join(" \n")
  );
  const hasOverviewOnlyCue =
    SOURCE_OVERVIEW_ONLY_PATTERN.test(sourceText) && !hasStrongRequirementCue;
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
      (/\.pdf(?:$|[?#])/i.test(primarySource?.url ?? "") ||
        /\b(checklist|degree requirements?|major requirements?|graduation requirements?|program requirements?|curriculum|degree sheet|requirement sheet)\b/i.test(
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

  return {
    triggered: (downstreamWeak && sourceWeak) || yearSpecificRequirementSource,
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

    const runtimeBasePlan = getTransferPlannerStudentRuntimeMajorPlan(plan.id);
    const owners = [
      {
        ownerType: "major",
        ownerKey: plan.id,
        planId: plan.id,
        pathwayId: null,
        title: plan.title,
        label: plan.title,
        officialLinks: [...(plan.officialLinks ?? [])],
      },
      ...(plan.pathways ?? []).map((pathway) => ({
        ownerType: "pathway",
        ownerKey: `${plan.id}:pathway:${pathway.id}`,
        planId: plan.id,
        pathwayId: pathway.id,
        title: `${plan.title} - ${pathway.label}`,
        label: pathway.label,
        officialLinks: [...(pathway.officialLinks ?? [])],
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
          pathwayCount: plan.pathways?.length ?? 0,
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

    const majorPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, null);
    if (includeExisting || !majorPrimary) {
      targets.push(
        buildOwnerTargetRecord({
          analysisMode: "missing-primary",
          ownerType: "major",
          ownerKey: plan.id,
          planId: plan.id,
          pathwayId: null,
          campusId: plan.campusId,
          title: plan.title,
          label: plan.title,
          officialLinks: [...(plan.officialLinks ?? [])],
          existingPrimary: majorPrimary,
          pathwayCount: plan.pathways?.length ?? 0,
        })
      );
    }

    for (const pathway of plan.pathways ?? []) {
      const pathwayPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, pathway.id);
      if (!includeExisting && pathwayPrimary) {
        continue;
      }

      targets.push(
        buildOwnerTargetRecord({
          analysisMode: "missing-primary",
          ownerType: "pathway",
          ownerKey: `${plan.id}:pathway:${pathway.id}`,
          planId: plan.id,
          pathwayId: pathway.id,
          campusId: plan.campusId,
          title: `${plan.title} - ${pathway.label}`,
          label: pathway.label,
          officialLinks: [...(pathway.officialLinks ?? [])],
          existingPrimary: pathwayPrimary,
          pathwayCount: plan.pathways?.length ?? 0,
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
    ownerCount: scopedOwners.length,
    missingPrimaryOwnerCount: scopedOwners.filter((owner) => !owner.existingPrimaryUrl).length,
    highConfidenceSuggestionCount: scopedOwners.filter(
      (owner) => owner.suggestedPrimary?.confidence === "high"
    ).length,
    mediumConfidenceSuggestionCount: scopedOwners.filter(
      (owner) => owner.suggestedPrimary?.confidence === "medium"
    ).length,
    noSuggestionCount: scopedOwners.filter((owner) => !owner.suggestedPrimary).length,
    weakExistingOwnerCount: scopedWeakExistingOwners.length,
    highConfidenceReplacementCount: scopedWeakExistingOwners.filter(
      (owner) => owner.suggestedAction === "replace-existing-primary"
    ).length,
    reviewReplacementCount: scopedWeakExistingOwners.filter(
      (owner) => owner.reviewCandidate && owner.suggestedAction !== "replace-existing-primary"
    ).length,
    keepExistingPrimaryCount: scopedWeakExistingOwners.filter(
      (owner) => owner.suggestedAction === "keep-existing-primary"
    ).length,
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

function scoreCandidate(target, candidate) {
  if (isBlockedPrimarySourceCandidateUrl(candidate.url)) {
    return {
      score: -100,
      confidence: "low",
      reasons: ["authentication or course-list URL is not a primary degree-requirements source"],
    };
  }

  const combinedText = [
    candidate.url,
    candidate.label,
    candidate.anchorText,
    candidate.pageTitle,
    ...(candidate.pageHeadings ?? []),
  ]
    .filter(Boolean)
    .join(" \n")
    .toLowerCase();
  const candidateIdentityText = slugifyForSearch(combinedText);
  const candidateYearInfo = buildCandidateYearInfo(candidate);
  const reasons = [];
  let score = 0;
  let matchedKeywordCount = 0;

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
    { pattern: /\.pdf(\?|$)/, score: 6, reason: "pdf degree-sheet candidate" },
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

  if (target.ownerType === "major" && (target.pathwayCount ?? 0) > 1) {
    const candidateDegrees = getDegreeTokens(combinedText);
    if (candidateDegrees.size === 1) {
      score -= 10;
      addReason(reasons, "route-specific page may not cover every pathway in the selected major");
    }
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
    reasons: uniqueSorted(reasons),
    detectedYears: candidateYearInfo.detectedYears,
    latestDetectedYear: candidateYearInfo.latestDetectedYear,
  };
}

function mergeCandidate(existing, incoming) {
  const useIncoming =
    (incoming.score ?? Number.NEGATIVE_INFINITY) > (existing.score ?? Number.NEGATIVE_INFINITY);
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
    pageTitle: winning.pageTitle || existing.pageTitle || incoming.pageTitle || null,
    pageHeadings: uniqueSorted([
      ...(existing.pageHeadings ?? []),
      ...(incoming.pageHeadings ?? []),
    ]),
    sourcePageUrl: winning.sourcePageUrl || existing.sourcePageUrl || incoming.sourcePageUrl || null,
    sourceKinds: uniqueSorted([...(existing.sourceKinds ?? []), ...(incoming.sourceKinds ?? [])]),
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

function addScoredCandidate(candidateMap, target, rawCandidate) {
  const normalizedUrl = normalizeCandidateUrl(rawCandidate.url);
  if (!normalizedUrl) {
    return;
  }

  const scored = scoreCandidate(target, { ...rawCandidate, url: normalizedUrl });
  const mergedCandidate = {
    url: normalizedUrl,
    label: rawCandidate.label ?? null,
    anchorText: rawCandidate.anchorText ?? null,
    pageTitle: rawCandidate.pageTitle ?? null,
    pageHeadings: rawCandidate.pageHeadings ?? [],
    sourcePageUrl: rawCandidate.sourcePageUrl ?? null,
    sourceKinds: rawCandidate.sourceKind ? [rawCandidate.sourceKind] : [],
    score: scored.score,
    confidence: scored.confidence,
    reasons: scored.reasons,
    detectedYears: scored.detectedYears ?? [],
    latestDetectedYear: scored.latestDetectedYear ?? null,
  };

  const current = candidateMap.get(normalizedUrl);
  candidateMap.set(normalizedUrl, current ? mergeCandidate(current, mergedCandidate) : mergedCandidate);
}

async function mapWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
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
  const topCandidate = sortedCandidates[0] ?? null;
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
    sortedCandidates.find((candidate) => candidate.url !== target.existingPrimaryUrl) ?? null;

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
    replacementReasons.has("specific bachelor route wording");
  const replacementHasStructuredRequirementPageEvidence =
    replacementReasons.has("checklist-style wording") ||
    replacementReasons.has("explicit degree-requirements wording") ||
    replacementReasons.has("explicit major-requirements wording") ||
    replacementReasons.has("graduation requirements wording") ||
    replacementReasons.has("program-requirements wording") ||
    replacementReasons.has("specific bachelor route wording");
  const replacementHasStrongProgramMatch =
    !replacementReasons.has("candidate appears to describe a different degree route") &&
    (replacementReasons.has("official source path matches the selected pathway") ||
      replacementReasons.has("official source path matches the selected major") ||
      replacementReasons.has("official source text matches the selected pathway") ||
      replacementReasons.has("official source acronym matches the selected pathway") ||
      replacementReasons.has("official source text matches the selected major") ||
      replacementReasons.has("official source acronym matches the selected major") ||
      replacementReasons.has("explicitly names the selected major") ||
      replacementReasons.has("explicitly names the selected pathway or route"));
  const staysOnDepartmentHost = replacementReasons.has(
    "stays on the current official department host"
  );
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
    !bestAlternative.url.toLowerCase().includes(".pdf") &&
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
  const replacementIsSingleRouteForMultiPathwayMajor =
    target.ownerType === "major" &&
    (target.pathwayCount ?? 0) > 1 &&
    getDegreeTokens(replacementCombinedText).size === 1;
  const minimumReplacementScoreDelta = betterSiblingByYear
    ? MIN_STALE_YEAR_REPLACEMENT_SCORE_DELTA
    : strongerCurrentDegreePageReplacement
      ? MIN_STALE_YEAR_REPLACEMENT_SCORE_DELTA
      : MIN_CLEAR_REPLACEMENT_SCORE_DELTA;
  const shouldReplace =
    target.analysisMode === "weak-existing-primary" &&
    (currentPrimaryClearlyWrong || betterSiblingByYear || strongerCurrentDegreePageReplacement) &&
    replacementHasUndergradRequirementEvidence &&
    replacementHasStrongProgramMatch &&
    staysOnDepartmentHost &&
    !replacementIsSingleRouteForMultiPathwayMajor &&
    bestAlternative.confidence === "high" &&
    bestAlternative.score >= MIN_HIGH_CONFIDENCE_SCORE &&
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
    });
  }

  for (const candidate of TARGETED_OFFICIAL_SOURCE_CANDIDATES[target.ownerKey] ?? []) {
    addScoredCandidate(candidateMap, target, {
      ...candidate,
      sourceKind: "targeted-official-candidate",
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
      url: page.finalUrl || link.url,
      label: link.label,
      pageTitle: page.title,
      pageHeadings: page.headings,
      sourceKind: "official-link",
    });

    for (const anchor of page.anchors) {
      if (!isAllowedDiscoveryUrl(anchor.url, baseDomains)) {
        continue;
      }
      addScoredCandidate(candidateMap, target, {
        url: anchor.url,
        anchorText: anchor.text,
        sourcePageUrl: page.finalUrl || link.url,
        sourceKind: "discovered-anchor",
      });
    }
  }

  for (const sourcePage of seedSourcePages) {
    const page = await inspectPageImpl(sourcePage.url, timeoutMs);
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
        sourcePageUrl: page.finalUrl || sourcePage.url,
        sourceKind:
          sourcePage.sourceKind === "official-site-root"
            ? "discovered-anchor"
            : sourcePage.sourceKind,
      });
    }
  }

  const candidateList = [...candidateMap.values()]
    .sort(compareScoredCandidates)
    .slice(0, 20);

  const verifiedCandidateUrls = new Set();

  for (let pass = 0; pass < MAX_DISCOVERY_VERIFICATION_PASSES; pass += 1) {
    const verifyTargets = [...candidateMap.values()]
      .sort(compareScoredCandidates)
      .filter(
        (candidate) =>
          !verifiedCandidateUrls.has(candidate.url) &&
          !candidate.pageTitle &&
          !candidate.url.toLowerCase().includes(".pdf") &&
          candidate.score >= 8
      )
      .slice(0, MAX_DISCOVERED_CANDIDATES_PER_OWNER);

    if (!verifyTargets.length) {
      break;
    }

    for (const candidate of verifyTargets) {
      verifiedCandidateUrls.add(candidate.url);
      const page = await inspectPageImpl(candidate.url, timeoutMs);
      addScoredCandidate(candidateMap, target, {
        url: page.finalUrl || candidate.url,
        label: candidate.label,
        anchorText: candidate.anchorText,
        pageTitle: page.title,
        pageHeadings: page.headings,
        sourcePageUrl: candidate.sourcePageUrl,
        sourceKind: candidate.sourceKinds?.[0] ?? "discovered-anchor",
      });

      for (const anchor of page.anchors) {
        if (!isAllowedDiscoveryUrl(anchor.url, baseDomains)) {
          continue;
        }
        addScoredCandidate(candidateMap, target, {
          url: anchor.url,
          anchorText: anchor.text,
          sourcePageUrl: page.finalUrl || candidate.url,
          sourceKind: "discovered-anchor",
        });
      }
    }
  }

  const rescoredCandidates = [...candidateMap.values()]
    .sort(compareScoredCandidates)
    .slice(0, 8);
  const suggestion = buildReplacementDecision(target, rescoredCandidates);

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
    topCandidates: rescoredCandidates,
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
        lines.push(`    - confidence: ${candidate.confidence}`);
        lines.push(`    - score: ${candidate.score}`);
        if (candidate.latestDetectedYear) {
          lines.push(`    - detected year: ${candidate.latestDetectedYear}`);
        }
        lines.push(`    - reasons: ${candidate.reasons.join("; ")}`);
      });
      lines.push("");
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
        lines.push(`- Replacement score: ${owner.suggestedPrimary.score}`);
        if (owner.suggestedPrimary.latestDetectedYear) {
          lines.push(`- Replacement detected year: ${owner.suggestedPrimary.latestDetectedYear}`);
        }
      } else if (owner.reviewCandidate) {
        lines.push(`- Review candidate: ${owner.reviewCandidate.url}`);
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
    DEFAULT_CONCURRENCY
  );
  const weakExistingOwners = await mapWithConcurrency(
    weakExistingTargets,
    (target) => analyzeOwner(target, DEFAULT_TIMEOUT_MS),
    DEFAULT_CONCURRENCY
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
  compareScoredCandidates,
  extractAnchors,
  extractHeadings,
  inspectPage,
  scoreCandidate,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
