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
  getTransferPlannerPrimaryDegreeRequirementsSource,
} = require("../../constants/transfer-planner-source");

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

function tokenMatchesCandidateText(token, text) {
  if (text.includes(token)) {
    return true;
  }

  if (token.endsWith("ies") && text.includes(`${token.slice(0, -3)}y`)) {
    return true;
  }

  if (token.endsWith("s") && token.length > 3 && text.includes(token.slice(0, -1))) {
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
  const ownerSlugInPath = Boolean(ownerSlug && fullPathSlug.includes(ownerSlug));
  const labelSlugInPath = Boolean(labelSlug && fullPathSlug.includes(labelSlug));
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

function buildOwnerTargets({ includeExisting, campusFilter }) {
  const targets = [];

  for (const plan of TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS) {
    if (campusFilter && plan.campusId !== campusFilter) {
      continue;
    }

    const majorPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, null);
    if (includeExisting || !majorPrimary) {
      targets.push({
        ownerType: "major",
        ownerKey: plan.id,
        planId: plan.id,
        pathwayId: null,
        campusId: plan.campusId,
        title: plan.title,
        label: plan.title,
        officialLinks: [...(plan.officialLinks ?? [])],
        keywordTokens: buildKeywordTokens(plan.title),
        existingPrimary: majorPrimary,
      });
    }

    for (const pathway of plan.pathways ?? []) {
      const pathwayPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, pathway.id);
      if (!includeExisting && pathwayPrimary) {
        continue;
      }

      targets.push({
        ownerType: "pathway",
        ownerKey: `${plan.id}:pathway:${pathway.id}`,
        planId: plan.id,
        pathwayId: pathway.id,
        campusId: plan.campusId,
        title: `${plan.title} - ${pathway.label}`,
        label: pathway.label,
        officialLinks: [...(pathway.officialLinks ?? [])],
        keywordTokens: buildKeywordTokens(plan.title, pathway.label),
        existingPrimary: pathwayPrimary,
      });
    }
  }

  return targets;
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
  ]
    .filter(Boolean)
    .join(" \n")
    .toLowerCase();
  const reasons = [];
  let score = 0;
  let matchedKeywordCount = 0;

  const positiveRules = [
    { pattern: /\bdegree requirements?\b/, score: 28, reason: "explicit degree-requirements wording" },
    { pattern: /\bmajor requirements?\b/, score: 26, reason: "explicit major-requirements wording" },
    { pattern: /\bgraduation requirements?\b/, score: 24, reason: "graduation requirements wording" },
    { pattern: /\bprogram requirements?\b/, score: 20, reason: "program-requirements wording" },
    { pattern: /\bcurriculum\b/, score: 18, reason: "curriculum wording" },
    { pattern: /\brequirement sheet\b|\bdegree sheet\b/, score: 20, reason: "requirement-sheet wording" },
    { pattern: /\bprogram of study\b|\bchecklist\b/, score: 16, reason: "checklist-style wording" },
    { pattern: /\bbachelor of arts\b|\bbachelor of science\b|\bb\.a\.\b|\bb\.s\.\b/, score: 10, reason: "specific bachelor route wording" },
    { pattern: /\.pdf(\?|$)/, score: 6, reason: "pdf degree-sheet candidate" },
  ];

  const negativeRules = [
    { pattern: /\badmissions?\b|\bapply\b|\bapplication\b|\bincoming\b|\bfreshmen\b/, score: -26, reason: "admissions wording" },
    { pattern: /\bequivalency\b|\btransfer\b/, score: -24, reason: "transfer-equivalency wording" },
    { pattern: /\bgraduate\b|\bmasters?\b|\bphd\b|\bdoctoral\b/, score: -26, reason: "graduate-program wording" },
    { pattern: /\badvising\b|\badvisor\b/, score: -10, reason: "advising wording" },
    { pattern: /\bregistrar\b|\bgeneral education\b/, score: -18, reason: "generic campus requirements wording" },
    { pattern: /\boverview\b|\bundergraduate program\b/, score: -8, reason: "overview wording" },
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

  if (candidate.sourceKind === "targeted-official-candidate") {
    score += 4;
    addReason(reasons, "hardcoded official source candidate for source-gap resolution");
  }

  const majorPhrase = slugifyForSearch(target.title);
  if (majorPhrase && combinedText.includes(majorPhrase)) {
    score += 10;
    addReason(reasons, "explicitly names the selected major");
  }

  const labelPhrase = slugifyForSearch(target.label);
  if (labelPhrase && labelPhrase !== majorPhrase && combinedText.includes(labelPhrase)) {
    score += 6;
    addReason(reasons, "explicitly names the selected pathway or route");
  }

  for (const token of target.keywordTokens) {
    if (combinedText.includes(token)) {
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
  };
}

function mergeCandidate(existing, incoming) {
  const useIncoming =
    (incoming.score ?? Number.NEGATIVE_INFINITY) >= (existing.score ?? Number.NEGATIVE_INFINITY);
  const winning = useIncoming ? incoming : existing;

  return {
    ...(useIncoming ? existing : incoming),
    ...winning,
    label: winning.label || existing.label || incoming.label || null,
    anchorText: winning.anchorText || existing.anchorText || incoming.anchorText || null,
    pageTitle: winning.pageTitle || existing.pageTitle || incoming.pageTitle || null,
    sourcePageUrl: winning.sourcePageUrl || existing.sourcePageUrl || incoming.sourcePageUrl || null,
    sourceKinds: uniqueSorted([...(existing.sourceKinds ?? []), ...(incoming.sourceKinds ?? [])]),
    reasons: winning.reasons ?? [],
    score: winning.score,
    confidence: winning.confidence,
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
    sourcePageUrl: rawCandidate.sourcePageUrl ?? null,
    sourceKinds: rawCandidate.sourceKind ? [rawCandidate.sourceKind] : [],
    score: scored.score,
    confidence: scored.confidence,
    reasons: scored.reasons,
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

  if (campusFilter && !CAMPUS_IDS.has(campusFilter)) {
    throw new Error(`Unsupported campus filter: ${campusFilter}`);
  }

  return {
    includeExisting,
    dryRun,
    campusFilter,
  };
}

async function analyzeOwner(target, timeoutMs) {
  const baseDomains = (() => {
    const discoveredBaseDomains = getBaseDomains(target.officialLinks.map((link) => link.url));
    return discoveredBaseDomains.length ? discoveredBaseDomains : getFallbackBaseDomains(target.campusId);
  })();
  const candidateMap = new Map();
  const sourcePages = [];

  for (const link of target.officialLinks) {
    addScoredCandidate(candidateMap, target, {
      url: link.url,
      label: link.label,
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
    target.officialLinks.length === 0
      ? (FALLBACK_DISCOVERY_SOURCE_PAGES_BY_CAMPUS[target.campusId] ?? []).map((url) => ({
          url,
          sourceKind: "campus-major-index",
        }))
      : [];

  for (const link of target.officialLinks) {
    const page = await inspectPage(link.url, timeoutMs);
    sourcePages.push({
      url: link.url,
      finalUrl: page.finalUrl,
      ok: page.ok,
      status: page.status,
      contentType: page.contentType,
      title: page.title,
      error: page.error,
      anchorCount: page.anchors.length,
    });

    addScoredCandidate(candidateMap, target, {
      url: page.finalUrl || link.url,
      label: link.label,
      pageTitle: page.title,
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

  for (const sourcePage of fallbackSourcePages) {
    const page = await inspectPage(sourcePage.url, timeoutMs);
    sourcePages.push({
      url: sourcePage.url,
      finalUrl: page.finalUrl,
      ok: page.ok,
      status: page.status,
      contentType: page.contentType,
      title: page.title,
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
        sourceKind: sourcePage.sourceKind,
      });
    }
  }

  const candidateList = [...candidateMap.values()]
    .sort(compareScoredCandidates)
    .slice(0, 20);

  const verifyTargets = candidateList
    .filter(
      (candidate) =>
        !candidate.pageTitle &&
        !candidate.url.toLowerCase().includes(".pdf") &&
        candidate.score >= 8
    )
    .slice(0, MAX_DISCOVERED_CANDIDATES_PER_OWNER);

  for (const candidate of verifyTargets) {
    const page = await inspectPage(candidate.url, timeoutMs);
    addScoredCandidate(candidateMap, target, {
      url: page.finalUrl || candidate.url,
      label: candidate.label,
      anchorText: candidate.anchorText,
      pageTitle: page.title,
      sourcePageUrl: candidate.sourcePageUrl,
      sourceKind: candidate.sourceKinds?.[0] ?? "discovered-anchor",
    });
  }

  const rescoredCandidates = [...candidateMap.values()]
    .sort(compareScoredCandidates)
    .slice(0, 8);

  const suggestedPrimary =
    rescoredCandidates.length > 0 && rescoredCandidates[0].score >= 12 ? rescoredCandidates[0] : null;

  return {
    ownerType: target.ownerType,
    ownerKey: target.ownerKey,
    planId: target.planId,
    pathwayId: target.pathwayId,
    title: target.title,
    label: target.label,
    campusId: target.campusId,
    existingPrimaryUrl: target.existingPrimary?.url ?? null,
    officialLinks: target.officialLinks,
    sourcePages,
    candidateCount: candidateMap.size,
    suggestedPrimary,
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
        lines.push(`    - reasons: ${candidate.reasons.join("; ")}`);
      });
      lines.push("");
    });
  }

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

async function main() {
  ensureTmpDir();

  const { includeExisting, dryRun, campusFilter } = parseArgs();
  const targets = buildOwnerTargets({ includeExisting, campusFilter });

  console.log(
    `Discovering primary degree-requirements sources for ${targets.length} planner owner(s)...`
  );

  const owners = await mapWithConcurrency(
    targets,
    (target) => analyzeOwner(target, DEFAULT_TIMEOUT_MS),
    DEFAULT_CONCURRENCY
  );

  const report = {
    generatedAt: new Date().toISOString(),
    ownerCount: owners.length,
    missingPrimaryOwnerCount: owners.filter((owner) => !owner.existingPrimaryUrl).length,
    highConfidenceSuggestionCount: owners.filter(
      (owner) => owner.suggestedPrimary?.confidence === "high"
    ).length,
    mediumConfidenceSuggestionCount: owners.filter(
      (owner) => owner.suggestedPrimary?.confidence === "medium"
    ).length,
    noSuggestionCount: owners.filter((owner) => !owner.suggestedPrimary).length,
    owners: owners.sort((left, right) => left.title.localeCompare(right.title)),
  };

  if (!dryRun) {
    fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
    writeMarkdownReport(report);
  }

  console.log(`High-confidence suggestions: ${report.highConfidenceSuggestionCount}`);
  console.log(`Medium-confidence suggestions: ${report.mediumConfidenceSuggestionCount}`);
  console.log(`No suggestion yet: ${report.noSuggestionCount}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown summary: ${OUTPUT_MD_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
