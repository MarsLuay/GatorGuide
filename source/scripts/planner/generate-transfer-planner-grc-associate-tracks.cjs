/* global __dirname */
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

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const OUTPUT_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "grc-associate-tracks.generated.ts"
);
const REPORT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-grc-associate-tracks.json");
const REPORT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-grc-associate-tracks.md");

const GRC_SITEMAP_URL = "https://www.greenriver.edu/sitemap.xml";
const GRC_WIDGET_API_ROOT_URL = "https://catalog.greenriver.edu/widget-api";
const USER_AGENT = "GatorGuideTransferPlannerAssociateTracks/1.0";
const PAGE_FETCH_CONCURRENCY = 8;
const PROGRAM_FETCH_CONCURRENCY = 8;
const PROGRAM_PAGE_SIZE = 100;
const COURSE_CODE_PATTERN = /\b[A-Z]{2,6}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;

function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function toIsoTimestamp() {
  return new Date().toISOString();
}

function decodeHtmlEntities(value) {
  return String(value ?? "").replace(
    /&(nbsp|amp|quot|#39|apos|ndash|mdash);/gi,
    (match, entity) => {
      const normalizedEntity = String(entity ?? "").toLowerCase();
      switch (normalizedEntity) {
        case "nbsp":
          return " ";
        case "amp":
          return "&";
        case "quot":
          return '"';
        case "#39":
        case "apos":
          return "'";
        case "ndash":
        case "mdash":
          return "-";
        default:
          return match;
      }
    }
  );
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value ?? ""))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePositiveCreditNumber(value) {
  const credits = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(credits) && credits > 0 ? credits : null;
}

function hasResidencyCreditContext(normalizedText, match) {
  const matchIndex = Number(match?.index ?? -1);
  if (matchIndex < 0) {
    return false;
  }

  const context = normalizedText.slice(
    Math.max(0, matchIndex - 60),
    matchIndex + String(match[0] ?? "").length + 100
  );
  return (
    /\b(?:at|from)\s+Green River(?:\s+College)?\b/i.test(context) ||
    /\bresiden(?:ce|cy)\b/i.test(context)
  );
}

function findNonResidencyCreditMatch(normalizedText, pattern) {
  for (const match of normalizedText.matchAll(pattern)) {
    if (!hasResidencyCreditContext(normalizedText, match)) {
      return match;
    }
  }
  return null;
}

function collectNonResidencyCreditMatches(normalizedText, pattern) {
  const matches = [];
  for (const match of normalizedText.matchAll(pattern)) {
    if (!hasResidencyCreditContext(normalizedText, match)) {
      matches.push(match);
    }
  }
  return matches;
}

function parseCreditRangeFromTextLegacy(value) {
  const normalized = stripHtml(value)
    .replace(/\bquarter[-\s]*credits?\b/gi, "credits")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || !/\bcredits?\b/i.test(normalized)) {
    return null;
  }

  const minimumRangeMatch = normalized.match(
    /\bminimum(?:\s+of)?\s+(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*credits?\b/i
  );
  const rangeMatch =
    minimumRangeMatch ??
    normalized.match(/\b(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*credits?\b/i);
  if (rangeMatch) {
    const left = parsePositiveCreditNumber(rangeMatch[1]);
    const right = parsePositiveCreditNumber(rangeMatch[2]);
    if (left !== null && right !== null) {
      return {
        minimumCredits: Math.min(left, right),
        maximumCredits: Math.max(left, right),
      };
    }
  }

  const minimumMatch = findNonResidencyCreditMatch(
    normalized,
    /\b(?:minimum(?:\s+of)?|at least)\s+(\d+(?:\.\d+)?)\s*credits?\b/gi
  );
  if (minimumMatch) {
    const minimumCredits = parsePositiveCreditNumber(minimumMatch[1]);
    return minimumCredits === null
      ? null
      : {
          minimumCredits,
          maximumCredits: null,
        };
  }

  const completeMatch = findNonResidencyCreditMatch(
    normalized,
    /\b(?:complete|must complete|students must complete|to earn this degree[^.]{0,80}complete)\s+(\d+(?:\.\d+)?)\s*credits?\b/gi
  );
  if (completeMatch) {
    const minimumCredits = parsePositiveCreditNumber(completeMatch[1]);
    return minimumCredits === null
      ? null
      : {
          minimumCredits,
          maximumCredits: null,
        };
  }

  const exactMatch = findNonResidencyCreditMatch(
    normalized,
    /\b(\d+(?:\.\d+)?)\s*credits?\b/gi
  );
  const exactCredits = parsePositiveCreditNumber(exactMatch?.[1]);
  return exactCredits === null
    ? null
    : {
        minimumCredits: exactCredits,
        maximumCredits: exactCredits,
    };
}

function parseCreditRangeFromText(value) {
  const normalized = stripHtml(value)
    .replace(/\bquarter[-\s]*credits?\b/gi, "credits")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || !/\bcredits?\b/i.test(normalized)) {
    return null;
  }

  const degreeCompletionRangeMatch = findNonResidencyCreditMatch(
    normalized,
    /\b(?:to earn this degree[^.]{0,180}?complete|students must complete|must complete)\s+(\d+(?:\.\d+)?)\s*[-\u2013\u2014]\s*(\d+(?:\.\d+)?)\s*credits?\b/gi
  );
  if (degreeCompletionRangeMatch) {
    const left = parsePositiveCreditNumber(degreeCompletionRangeMatch[1]);
    const right = parsePositiveCreditNumber(degreeCompletionRangeMatch[2]);
    if (left !== null && right !== null) {
      return {
        minimumCredits: Math.min(left, right),
        maximumCredits: Math.max(left, right),
      };
    }
  }

  const candidates = [];
  const addCandidate = (match, minimumCredits, maximumCredits, priority) => {
    if (minimumCredits === null) {
      return;
    }
    candidates.push({
      index: Number(match?.index ?? Number.MAX_SAFE_INTEGER),
      priority,
      minimumCredits,
      maximumCredits,
    });
  };

  for (const match of collectNonResidencyCreditMatches(
    normalized,
    /\b(?:minimum(?:\s+of)?\s+)?(\d+(?:\.\d+)?)\s*[-\u2013\u2014]\s*(\d+(?:\.\d+)?)\s*credits?\b/gi
  )) {
    const left = parsePositiveCreditNumber(match[1]);
    const right = parsePositiveCreditNumber(match[2]);
    if (left !== null && right !== null) {
      addCandidate(match, Math.min(left, right), Math.max(left, right), 0);
    }
  }

  for (const match of collectNonResidencyCreditMatches(
    normalized,
    /\b(?:minimum(?:\s+of)?|at least)\s+(\d+(?:\.\d+)?)\s*credits?\b/gi
  )) {
    addCandidate(match, parsePositiveCreditNumber(match[1]), null, 1);
  }

  for (const match of collectNonResidencyCreditMatches(
    normalized,
    /\b(?:complete|must complete|students must complete|to earn this degree[^.]{0,80}complete)\s+(\d+(?:\.\d+)?)\s*credits?\b/gi
  )) {
    addCandidate(match, parsePositiveCreditNumber(match[1]), null, 2);
  }

  for (const match of collectNonResidencyCreditMatches(
    normalized,
    /\b(\d+(?:\.\d+)?)\s*credits?\b/gi
  )) {
    const exactCredits = parsePositiveCreditNumber(match[1]);
    addCandidate(match, exactCredits, exactCredits, 3);
  }

  candidates.sort((left, right) => left.index - right.index || left.priority - right.priority);
  const candidate = candidates[0] ?? null;
  return candidate
    ? {
        minimumCredits: candidate.minimumCredits,
        maximumCredits: candidate.maximumCredits,
      }
    : null;
}

function parseCreditRangeFromSource(value, sourceKind) {
  const range = parseCreditRangeFromText(value);
  if (!range) {
    return null;
  }

  return {
    ...range,
    sourceKind,
    sourceText: stripHtml(value),
    isExact:
      range.maximumCredits !== null &&
      range.minimumCredits !== null &&
      range.minimumCredits === range.maximumCredits,
  };
}

function getProgramCreditRange(page, program, requirementProgram) {
  return (
    parseCreditRangeFromSource(requirementProgram?.description, "catalog-requirement-description") ??
    parseCreditRangeFromSource(page?.duration, "program-map-duration") ??
    parseCreditRangeFromSource(program?.description, "curriculum-map-description") ??
    null
  );
}

function normalizeCourseCode(value) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function extractCourseCodes(value) {
  return Array.from(
    new Set(
      (String(value ?? "").match(COURSE_CODE_PATTERN) ?? []).map((match) =>
        normalizeCourseCode(match)
      )
    )
  );
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeTrackCourseLabel(label) {
  const raw = String(label ?? "").trim();
  if (!raw) {
    return "";
  }
  return raw;
}

function normalizeTrackCourseTerms(terms) {
  return (Array.isArray(terms) ? terms : []).map((term) => ({
    ...term,
    courses: uniqueStrings((term?.courses ?? []).map((course) => normalizeTrackCourseLabel(course))),
  }));
}

function normalizeTrackCatalogOptionLists(optionLists) {
  return (Array.isArray(optionLists) ? optionLists : [])
    .map((optionList) => ({
      ...optionList,
      courseLabels: uniqueStrings(optionList?.courseLabels ?? []),
      courseCodes: uniqueStrings((optionList?.courseCodes ?? []).map((code) => normalizeCourseCode(code))),
    }))
    .filter((optionList) => optionList.courseLabels.length || optionList.courseCodes.length);
}

function normalizeTrackGroupedChoices(groupedChoices) {
  return (Array.isArray(groupedChoices) ? groupedChoices : [])
    .map((choice) => ({
      ...choice,
      selectionCount:
        Number.isFinite(Number(choice?.selectionCount)) && Number(choice.selectionCount) > 0
          ? Number(choice.selectionCount)
          : undefined,
      defaultOptionIds: uniqueStrings(choice?.defaultOptionIds ?? []),
      options: (choice?.options ?? []).map((option) => ({
        ...option,
        courseLabels: uniqueStrings(option?.courseLabels ?? []),
        courseCodes: uniqueStrings((option?.courseCodes ?? []).map((code) => normalizeCourseCode(code))),
      })),
    }))
    .filter((choice) => choice.options.length >= 2);
}

function normalizeGeneratedTrack(track) {
  const groupedChoices = normalizeTrackGroupedChoices(track?.groupedChoices);
  const catalogOptionLists = normalizeTrackCatalogOptionLists(track?.catalogOptionLists);
  const minimumCredits = parsePositiveCreditNumber(track?.minimumCredits);
  const maximumCredits = parsePositiveCreditNumber(track?.maximumCredits);
  return {
    ...track,
    ...(minimumCredits !== null ? { minimumCredits } : {}),
    ...(maximumCredits !== null ? { maximumCredits } : {}),
    terms: normalizeTrackCourseTerms(track?.terms),
    ...(groupedChoices.length ? { groupedChoices } : {}),
    ...(catalogOptionLists.length ? { catalogOptionLists } : {}),
  };
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sortByName(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""));
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

function getProgramMapUrlsFromSitemap(sitemapXml) {
  return Array.from(
    new Set(
      [...String(sitemapXml ?? "").matchAll(/<loc>(.*?)<\/loc>/g)]
        .map((match) => String(match[1] ?? "").trim())
        .filter((url) => url.includes("/students/academics/areas-of-interest/program-maps/"))
        .filter((url) => url.endsWith(".html"))
        .filter((url) => !/\/index\.html$/i.test(url))
        .filter((url) => !/gainful-employment/i.test(url))
        .filter((url) => !/transcript-evaluation-requirements-notice/i.test(url))
        .filter((url) => !/\/old-/i.test(url))
    )
  ).sort(sortByName);
}

function extractAsideFields(asideHtml) {
  const fields = new Map();
  const matches = asideHtml.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4[^>]*>|$)/gi);

  for (const match of matches) {
    const rawLabel = stripHtml(match[1]).toLowerCase();
    const rawValue = stripHtml(match[2]);
    if (!rawLabel || !rawValue) {
      continue;
    }
    fields.set(rawLabel, rawValue);
  }

  return {
    programType: fields.get("program type") ?? "",
    degree: fields.get("degree") ?? "",
    duration: fields.get("duration") ?? "",
    areaOfInterestPathway: fields.get("area of interest pathway") ?? "",
  };
}

function extractPublicProgramPageMetadata(url, html) {
  const pathname = new URL(url).pathname;
  const pageSlug = pathname.split("/").pop()?.replace(/\.html$/i, "") ?? slugify(pathname);
  const pagePathSlug = slugify(
    pathname
      .replace(/^\/+/, "")
      .replace(/\.html$/i, "")
      .replace(/^students\/academics\/areas-of-interest\/program-maps\//i, "")
  );
  const h1 = stripHtml((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? [])[1]);
  const connectorProgramName = decodeHtmlEntities(
    (html.match(/<program\s+name="([^"]+)"/i) ?? [])[1]
  ).trim();
  const asideHtml = (html.match(/<aside[^>]*>([\s\S]*?)<\/aside>/i) ?? [])[1] ?? "";
  const mainHtml = (html.match(/<main>([\s\S]*?)<\/main>/i) ?? [])[1] ?? html;
  const asideFields = extractAsideFields(asideHtml);

  return {
    url,
    pathname,
    pageSlug,
    pagePathSlug,
    h1,
    connectorProgramName,
    bodyCourseCodes: extractCourseCodes(mainHtml),
    ...asideFields,
  };
}

function getSupportedProgramPageKind(page) {
  const text = [page.h1, page.programType, page.degree, page.connectorProgramName]
    .join(" | ")
    .toLowerCase();

  if (/\bbas\b|\bbachelor of applied science\b/i.test(text)) {
    return "bas";
  }

  if (
    /\bcertificate\b|certificate of completion|certificate of accomplishment|certificate of proficiency/i.test(
      text
    )
  ) {
    return "certificate";
  }

  if (
    /\bassociate\b|\btransfer track\b|\baaa\b|\baas-t\b|\baas\b|\baa-dta\b|\bab-dta\b|\bacs-dta\b|\bapren-dta\b|\bafa\b|\bam-dta\b/i.test(
      text
    )
  ) {
    return "associate";
  }

  return null;
}

function isAssociateProgramPage(page) {
  return getSupportedProgramPageKind(page) === "associate";
}

function getGeneratedTrackId(page) {
  const programKind = getSupportedProgramPageKind(page);
  switch (programKind) {
    case "bas":
      return `grc-bas-${page.pagePathSlug}`;
    case "certificate":
      return `grc-certificate-${page.pagePathSlug}`;
    case "associate":
    default:
      return `grc-associate-${page.pagePathSlug}`;
  }
}

async function getCurrentCatalogRecord() {
  const payload = await fetchJson(`${GRC_WIDGET_API_ROOT_URL}/catalogs`);
  const publishedCatalogs = (payload["catalog-list"] ?? []).filter(
    (catalog) => catalog?.published === true && catalog?.archived === false
  );

  if (!publishedCatalogs.length) {
    throw new Error("Could not find the current published Green River catalog record.");
  }

  publishedCatalogs.sort((left, right) => Number(right.id ?? 0) - Number(left.id ?? 0));
  return publishedCatalogs[0];
}

async function getAllCatalogPrograms(catalogId) {
  const firstPage = await fetchJson(
    `${GRC_WIDGET_API_ROOT_URL}/catalog/${catalogId}/programs?page-size=${PROGRAM_PAGE_SIZE}`
  );
  const count = Number(firstPage.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(count / PROGRAM_PAGE_SIZE));
  const pages = [firstPage];

  if (totalPages > 1) {
    const remainingPages = await mapWithConcurrency(
      Array.from({ length: totalPages - 1 }, (_, index) => index + 2),
      4,
      async (pageNumber) => {
        console.log(`[${pageNumber}/${totalPages}] catalog program pages fetched`);
        return fetchJson(
          `${GRC_WIDGET_API_ROOT_URL}/catalog/${catalogId}/programs?page-size=${PROGRAM_PAGE_SIZE}&page=${pageNumber}`
        );
      }
    );
    pages.push(...remainingPages);
  }

  return pages.flatMap((page) => page["program-list"] ?? []);
}

function getProgramByConnectorName(programs, page) {
  const candidateNames = uniqueStrings([
    page.connectorProgramName,
    page.h1 ? `${page.h1} Curriculum Map` : "",
    page.h1,
    page.degree ? `${page.degree} Curriculum Map` : "",
  ]);

  for (const candidateName of candidateNames) {
    const exactMatch = programs.find(
      (program) => String(program?.name ?? "").trim() === candidateName
    );
    if (exactMatch) {
      return exactMatch;
    }

    const normalizedTarget = candidateName.toLowerCase();
    const caseInsensitiveMatch = programs.find(
      (program) => String(program?.name ?? "").trim().toLowerCase() === normalizedTarget
    );
    if (caseInsensitiveMatch) {
      return caseInsensitiveMatch;
    }
  }

  return null;
}

function normalizeProgramRequirementMatchName(value) {
  return String(value ?? "")
    .replace(/\bcurriculum\s+map\b/gi, " ")
    .replace(/\b(?:AST|AAS|AAA|AA|AFA|BAS|Certificate|DTA|MRP)\b/gi, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function inferProgramCredentialKey(value) {
  const text = String(value ?? "").toLowerCase();
  if (/\bcertificate\b|certificate of (?:completion|accomplishment|proficiency)/i.test(text)) {
    return "certificate";
  }
  if (/\bbas\b|bachelor of applied science/i.test(text)) {
    return "bas";
  }
  if (/\bacs-dta\/mrp\b|associate in computer science/i.test(text)) {
    return "acs-dta/mrp";
  }
  if (/\bab-dta\/mrp\b|associate in business/i.test(text)) {
    return "ab-dta/mrp";
  }
  if (/\bapren-dta\/mrp\b|pre-nursing/i.test(text)) {
    return "apren-dta/mrp";
  }
  if (/\bam-dta\/mrp\b/i.test(text)) {
    return "am-dta/mrp";
  }
  if (/\bam-dta\b|math education/i.test(text)) {
    return "am-dta";
  }
  if (/\bast-2\/mrp\b|transfer track 2\/mrp/i.test(text)) {
    return "ast-2/mrp";
  }
  if (/\bast-2\b|transfer track 2/i.test(text)) {
    return "ast-2";
  }
  if (/\bast-1\b|transfer track 1/i.test(text)) {
    return "ast-1";
  }
  if (/\baa-dta\b|direct transfer agreement|associate in arts-dta/i.test(text)) {
    return "aa-dta";
  }
  if (/\baas-t\b/i.test(text)) {
    return "aas-t";
  }
  if (/\baaa\b|associate in applied arts/i.test(text)) {
    return "aaa";
  }
  if (/\baas\b|associate in applied science/i.test(text)) {
    return "aas";
  }
  if (/\bafa\b|associate in fine arts/i.test(text)) {
    return "afa";
  }
  return null;
}

function getPageCredentialKey(page) {
  return inferProgramCredentialKey(
    [page?.h1, page?.degree, page?.programType, page?.connectorProgramName].filter(Boolean).join(" | ")
  );
}

function isCompatibleRequirementCredential(page, program) {
  const pageCredential = getPageCredentialKey(page);
  const programCredential = inferProgramCredentialKey(program?.name);
  if (!pageCredential || !programCredential) {
    return true;
  }

  return pageCredential === programCredential;
}

function getRequirementProgramForCurriculumMap(programs, page, curriculumProgramSummary) {
  const curriculumProgramId = Number(curriculumProgramSummary?.id ?? 0);
  const baseNames = uniqueStrings([
    page.connectorProgramName,
    page.connectorProgramName?.replace(/\s+Curriculum\s+Map\s*$/i, ""),
    page.h1,
    curriculumProgramSummary?.name?.replace(/\s+Curriculum\s+Map\s*$/i, ""),
  ])
    .map(normalizeProgramRequirementMatchName)
    .filter(Boolean);
  if (!baseNames.length) {
    return null;
  }

  const candidates = programs
    .filter((program) => Number(program?.id ?? 0) !== curriculumProgramId)
    .filter((program) => !/\bcurriculum\s+map\b/i.test(String(program?.name ?? "")))
    .filter((program) => isCompatibleRequirementCredential(page, program))
    .map((program) => ({
      program,
      normalizedName: normalizeProgramRequirementMatchName(program?.name),
    }))
    .filter((entry) => entry.normalizedName);

  return (
    candidates.find((entry) =>
      baseNames.some(
        (baseName) =>
          entry.normalizedName === baseName ||
          entry.normalizedName.includes(baseName) ||
          baseName.includes(entry.normalizedName)
      )
    )?.program ?? null
  );
}

function cleanTrackTitle(rawTitle) {
  const title = String(rawTitle ?? "").trim();
  const suffixPatterns = [
    /\s*,\s*AAA$/i,
    /\s*,\s*AAS-T$/i,
    /\s*,\s*AAS$/i,
    /\s*,\s*AFA$/i,
    /\s*,\s*AB-DTA\/MRP$/i,
    /\s*,\s*ACS-DTA\/MRP$/i,
    /\s*,\s*APreN-DTA\/MRP$/i,
    /\s*,\s*AM-DTA(?:\/MRP)?(?:\s*\([^)]+\))?$/i,
    /\s*,\s*AA-DTA(?:\s*\([^)]+\))?$/i,
    /\s*,\s*BAS(?:\s*\([^)]+\))?$/i,
    /\s*,\s*Certificate(?:\s+of\s+(?:Completion|Accomplishment|Proficiency))?$/i,
    /\s+BAS(?:\s*\([^)]+\))?$/i,
    /\s+Bachelor of Applied Science$/i,
    /\s+Certificate(?:\s+of\s+(?:Completion|Accomplishment|Proficiency))?$/i,
  ];

  for (const pattern of suffixPatterns) {
    if (pattern.test(title)) {
      return title.replace(pattern, "").trim();
    }
  }

  return title;
}

function inferTrackCode(page) {
  const text = [page.h1, page.degree, page.programType].join(" | ");
  if (/\bbas\b|bachelor of applied science/i.test(text)) {
    return "BAS";
  }

  if (
    /\bcertificate\b|certificate of completion|certificate of accomplishment|certificate of proficiency/i.test(
      text
    )
  ) {
    return "Certificate";
  }

  const orderedPatterns = [
    { pattern: /\bAB-DTA\/MRP\b/i, code: "AB-DTA/MRP" },
    { pattern: /\bACS-DTA\/MRP\b/i, code: "ACS-DTA/MRP" },
    { pattern: /\bAPreN-DTA\/MRP\b/i, code: "APreN-DTA/MRP" },
    { pattern: /\bAM-DTA\/MRP\b/i, code: "AM-DTA/MRP" },
    { pattern: /\bAM-DTA\b/i, code: "AM-DTA" },
    { pattern: /\bAA-DTA\b/i, code: "AA-DTA" },
    { pattern: /\bAAS-T\b/i, code: "AAS-T" },
    { pattern: /\bAAA\b/i, code: "AAA" },
    { pattern: /\bAAS\b/i, code: "AAS" },
    { pattern: /\bAFA\b/i, code: "AFA" },
  ];

  for (const { pattern, code } of orderedPatterns) {
    const match = text.match(pattern);
    if (match) {
      return code;
    }
  }

  if (/associate in arts-dta|arts-dta|direct transfer agreement/i.test(text)) {
    return "AA-DTA";
  }

  if (/transfer track 2/i.test(text)) {
    return /mrp/i.test(text) ? "AST-2/MRP" : "AST-2";
  }

  if (/transfer track 1/i.test(text)) {
    return "AST-1";
  }

  if (/associate in biology/i.test(text) && /dta\/mrp/i.test(text)) {
    return "DTA/MRP";
  }

  return "Associate";
}

function normalizeCourseTitleLabel(rawTitle) {
  const normalizedTitle = decodeHtmlEntities(String(rawTitle ?? ""))
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const extractedCodes = extractCourseCodes(normalizedTitle);
  return extractedCodes[0] ?? normalizedTitle;
}

function normalizeTrackNote(value) {
  const normalized = stripHtml(value);
  if (!normalized) {
    return "";
  }

  if (/^[*#\u2020+\-\s]+$/.test(normalized)) {
    return "";
  }

  if (/^(or|and)$/i.test(normalized)) {
    return "";
  }

  return normalized;
}

const TRACK_GUIDANCE_NON_EXPLICIT_PATTERN =
  /\b(?:recommend|recommended|recommendation|suggest(?:ed|ion|ions)?|consider|discuss|students are responsible|best transferability|would be helpful|helpful for|for those interested|for (?:pure|applied) math majors|select one|choose one|of the following|distribution|elective|general education|of your choice|fun and useful|offered|see quarter)\b/i;
const TRACK_HUMANITIES_PATTERN =
  /\b(?:arts?\s*(?:&|and)\s*humanities|humanities|fine arts|english distribution|humanities\/fine arts\/english distribution|a&h)\b/i;
const TRACK_SOCIAL_SCIENCE_PATTERN = /\b(?:social science|social sciences|ssc)\b/i;
const TRACK_NATURAL_SCIENCE_PATTERN = /\b(?:natural science|natural sciences|nsc)\b/i;
const TRACK_ELECTIVE_PATTERN = /\b(?:elective|general education)\b/i;

function normalizeAdhocTrackText(adhoc) {
  return normalizeTrackNote(adhoc?.display || adhoc?.content || adhoc?.name);
}

function getAdhocCourseId(adhoc) {
  const rawCourseId = adhoc?.["course-id"] ?? adhoc?.course_id ?? adhoc?.courseId;
  const courseId = Number(rawCourseId);
  return Number.isFinite(courseId) ? courseId : null;
}

function normalizeStructuralTrackNote(value) {
  return decodeHtmlEntities(String(value ?? ""))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/gi, " ")
    .replace(/<br\s*\/?>/gi, "; ")
    .replace(/<\/p>\s*<p\b[^>]*>/gi, "; ")
    .replace(/<\/li>\s*<li\b[^>]*>/gi, "; ")
    .replace(/<\/p>/gi, " ")
    .replace(/<\/li>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*;\s*/g, "; ")
    .replace(/(?:;\s*){2,}/g, "; ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function getAdhocStructuralText(adhoc) {
  return normalizeStructuralTrackNote(adhoc?.display || adhoc?.content || adhoc?.name);
}

function getCourseOptionDisplayLabel(label) {
  const codes = extractCourseCodes(label);
  if (codes.length) {
    return codes.join(" / ");
  }

  return String(label ?? "").replace(/\s+/g, " ").trim();
}

function isSelectionAdhoc(adhoc) {
  const text = getAdhocStructuralText(adhoc);
  const name = String(adhoc?.name ?? "").trim();
  const signal = `${name} ${text}`;

  return /\b(?:select|choose|choice)\b/i.test(signal) &&
    /\b(?:one|following|credits?|elective|course|courses|list)\b/i.test(signal);
}

function isOrAdhoc(adhoc) {
  const text = getAdhocStructuralText(adhoc);
  return /^or(?:\b|$)/i.test(text) && !isSelectionAdhoc(adhoc);
}

function buildCourseEntries(core) {
  return [...(core.courses ?? [])]
    .sort((left, right) => Number(left?.sort_order ?? 0) - Number(right?.sort_order ?? 0))
    .map((course, index) => ({
      id: Number(course?.id ?? 0),
      index,
      label: normalizeCourseTitleLabel(course.title),
    }));
}

function getCreditAmountFromText(value) {
  const match = String(value ?? "").match(/\b(\d+(?:\.\d+)?)\s*credits?\b/i);
  if (!match) {
    return null;
  }
  const creditAmount = Number.parseFloat(match[1]);
  return Number.isFinite(creditAmount) && creditAmount > 0 ? creditAmount : null;
}

const SELECTION_COUNT_WORDS = new Map([
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

function parseSelectionCountToken(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const numericValue = Number.parseInt(normalized, 10);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue;
  }
  return SELECTION_COUNT_WORDS.get(normalized) ?? null;
}

function getCourseSelectionCountFromText(value) {
  const signal = normalizeStructuralTrackNote(value);
  const match = signal.match(
    /\b(?:select|choose)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s+(?:approved\s+)?(?:courses?|classes?|options?)\b|\s+of\b)/i
  );
  if (!match) {
    return null;
  }
  return parseSelectionCountToken(match[1]);
}

function hasCourseSelectionChoiceCue(value) {
  const selectionCount = getCourseSelectionCountFromText(value);
  if (selectionCount === null || selectionCount <= 0) {
    return false;
  }
  return /\b(?:from|following|list|approved|advisor|consultation)\b/i.test(
    normalizeStructuralTrackNote(value)
  );
}

function getGroupedChoiceMarkerLabel(value) {
  const signal = normalizeStructuralTrackNote(value);
  const match = signal.match(/\b(group|option|sequence)\s*([A-Z]|\d+)\b/i);
  if (!match) {
    return "";
  }

  const markerKind = `${match[1].slice(0, 1).toUpperCase()}${match[1].slice(1).toLowerCase()}`;
  return `${markerKind} ${String(match[2]).toUpperCase()}`;
}

function getGroupedChoiceAdhocLabel(adhoc) {
  return (
    getGroupedChoiceMarkerLabel(adhoc?.display) ||
    getGroupedChoiceMarkerLabel(adhoc?.content) ||
    getGroupedChoiceMarkerLabel(adhoc?.name)
  );
}

function hasGroupedChoiceCue(value) {
  const normalized = normalizeStructuralTrackNote(value);
  return /\b(?:choose|select)\s+(?:one|1)\b[^.]{0,120}\b(?:groups?|options?|sequences?)\b/i.test(
    normalized
  );
}

function getGroupedChoiceCoreRequiredCredits(core) {
  return (
    getCreditAmountFromText(core?.name) ??
    getCreditAmountFromText(core?.description) ??
    null
  );
}

function getCourseSelectionChoiceRequiredCredits(core, selectionCount) {
  return getGroupedChoiceCoreRequiredCredits(core) ?? (selectionCount > 0 ? selectionCount * 5 : null);
}

function buildGroupedChoiceOption(input) {
  const courseLabels = uniqueStrings((input.courseEntries ?? []).map((course) => course.label));
  const courseCodes = uniqueStrings(courseLabels.flatMap((label) => extractCourseCodes(label)));
  if (!courseLabels.length || !courseCodes.length) {
    return null;
  }

  return {
    id: `${input.choiceId}:${slugify(input.groupLabel || `group-${input.optionIndex + 1}`)}`,
    label: `${input.groupLabel || `Group ${input.optionIndex + 1}`}: ${courseLabels.join(" + ")}`,
    courseLabels,
    courseCodes,
  };
}

function buildGroupedChoiceFromAdhocMarkers(core, choiceId, sourceProgramId, labelParts) {
  const courseEntries = buildCourseEntries(core);
  if (courseEntries.length < 2) {
    return null;
  }

  const courseIndexById = new Map(courseEntries.map((course) => [course.id, course.index]));
  const markers = (core.adhocs ?? [])
    .map((adhoc) => ({
      adhoc,
      groupLabel: getGroupedChoiceAdhocLabel(adhoc),
      startIndex: getSelectionStartIndex(adhoc, courseIndexById, courseEntries.length),
    }))
    .filter((marker) => marker.groupLabel && marker.startIndex < courseEntries.length)
    .sort((left, right) => left.startIndex - right.startIndex);

  if (markers.length < 2) {
    return null;
  }

  const options = markers
    .map((marker, markerIndex) =>
      buildGroupedChoiceOption({
        choiceId,
        optionIndex: markerIndex,
        groupLabel: marker.groupLabel,
        courseEntries: courseEntries.slice(
          marker.startIndex,
          markers[markerIndex + 1]?.startIndex ?? courseEntries.length
        ),
      })
    )
    .filter(Boolean);

  if (options.length < 2) {
    return null;
  }

  return {
    id: choiceId,
    label: labelParts.join(" > ") || "Choose one group",
    requiredCredits: getGroupedChoiceCoreRequiredCredits(core),
    sourceHeading: labelParts.join(" > ") || String(core?.name ?? "").trim() || null,
    sourceProgramId,
    options,
  };
}

function buildGroupedChoiceFromChildGroups(core, choiceId, sourceProgramId, labelParts) {
  const groupChildren = (core.children ?? [])
    .map((child, childIndex) => ({
      child,
      childIndex,
      groupLabel: getGroupedChoiceMarkerLabel(child?.name),
    }))
    .filter((entry) => entry.groupLabel);

  if (groupChildren.length < 2) {
    return null;
  }

  const options = groupChildren
    .map((entry, optionIndex) =>
      buildGroupedChoiceOption({
        choiceId,
        optionIndex,
        groupLabel: entry.groupLabel,
        courseEntries: buildCourseEntries(entry.child),
      })
    )
    .filter(Boolean);

  if (options.length < 2) {
    return null;
  }

  return {
    id: choiceId,
    label: labelParts.join(" > ") || "Choose one group",
    requiredCredits: getGroupedChoiceCoreRequiredCredits(core),
    sourceHeading: labelParts.join(" > ") || String(core?.name ?? "").trim() || null,
    sourceProgramId,
    options,
  };
}

function buildCourseSelectionChoiceFromCore(core, choiceId, sourceProgramId, labelParts) {
  const cueText = `${core?.name ?? ""} ${core?.description ?? ""}`;
  const selectionCount = getCourseSelectionCountFromText(cueText);
  const courseEntries = buildCourseEntries(core);
  if (!selectionCount || selectionCount <= 0 || courseEntries.length <= selectionCount) {
    return null;
  }

  const options = courseEntries
    .map((course, optionIndex) =>
      buildGroupedChoiceOption({
        choiceId,
        optionIndex,
        groupLabel: course.label,
        courseEntries: [course],
      })
    )
    .filter(Boolean);

  if (options.length <= selectionCount) {
    return null;
  }

  return {
    id: choiceId,
    label: labelParts.join(" > ") || "Choose approved courses",
    requiredCredits: getCourseSelectionChoiceRequiredCredits(core, selectionCount),
    selectionCount,
    sourceHeading: labelParts.join(" > ") || String(core?.name ?? "").trim() || null,
    sourceProgramId,
    options,
  };
}

function collectGroupedChoicesFromCore(core, trackId, sourceProgramId, prefix = []) {
  const labelParts = [...prefix, String(core?.name ?? "").trim()].filter(Boolean);
  const cueText = `${core?.name ?? ""} ${core?.description ?? ""}`;
  const hasChoiceCue = hasGroupedChoiceCue(cueText);
  const hasCourseSelectionCue = hasCourseSelectionChoiceCue(cueText);
  const choiceId = `official-grc-track-grouped-choice:${slugify(trackId)}:${slugify(
    labelParts.join(" ")
  )}`;
  const choices = [];

  if (hasChoiceCue) {
    const adhocChoice = buildGroupedChoiceFromAdhocMarkers(
      core,
      choiceId,
      sourceProgramId,
      labelParts
    );
    const childChoice = buildGroupedChoiceFromChildGroups(
      core,
      choiceId,
      sourceProgramId,
      labelParts
    );
    if (adhocChoice) {
      choices.push(adhocChoice);
    } else if (childChoice) {
      choices.push(childChoice);
    }
  } else if (hasCourseSelectionCue) {
    const courseSelectionChoice = buildCourseSelectionChoiceFromCore(
      core,
      choiceId,
      sourceProgramId,
      labelParts
    );
    if (courseSelectionChoice) {
      choices.push(courseSelectionChoice);
    }
  }

  for (const child of core.children ?? []) {
    choices.push(...collectGroupedChoicesFromCore(child, trackId, sourceProgramId, labelParts));
  }

  return choices;
}

function collectGroupedChoicesFromProgram(program, trackId) {
  const sourceProgramId = Number(program?.id ?? 0) || null;
  const choices = (program?.cores ?? []).flatMap((core) =>
    collectGroupedChoicesFromCore(core, trackId, sourceProgramId)
  );
  const seenIds = new Set();
  return choices.filter((choice) => {
    if (seenIds.has(choice.id)) {
      return false;
    }
    seenIds.add(choice.id);
    return true;
  });
}

function getGroupedChoiceOptionCourseCodeSet(option) {
  return new Set(
    uniqueStrings([
      ...(option?.courseCodes ?? []),
      ...(option?.courseLabels ?? []).flatMap((label) => extractCourseCodes(label)),
    ]).map((courseCode) => normalizeCourseCode(courseCode))
  );
}

function getDefaultGroupedChoiceOptionIds(choice, terms) {
  const selectionCount = Number(choice?.selectionCount ?? 1);
  if (!Number.isFinite(selectionCount) || selectionCount <= 1) {
    return [];
  }

  const termCourseLabels = (terms ?? [])
    .flatMap((term) => term.courses ?? [])
    .map((label) => String(label ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const defaultOptionIds = [];

  for (const option of choice.options ?? []) {
    const optionCourseCodes = getGroupedChoiceOptionCourseCodeSet(option);
    if (!optionCourseCodes.size) {
      continue;
    }

    const isScheduledByMap = termCourseLabels.some((label) => {
      const labelCourseCodes = extractCourseCodes(label).map((courseCode) =>
        normalizeCourseCode(courseCode)
      );
      return (
        labelCourseCodes.length > 0 &&
        labelCourseCodes.every((courseCode) => optionCourseCodes.has(courseCode))
      );
    });

    if (isScheduledByMap) {
      defaultOptionIds.push(option.id);
    }
  }

  return uniqueStrings(defaultOptionIds).slice(0, selectionCount);
}

function attachGroupedChoiceDefaultOptions(groupedChoices, terms) {
  return groupedChoices.map((choice) => {
    const defaultOptionIds = getDefaultGroupedChoiceOptionIds(choice, terms);
    return defaultOptionIds.length ? { ...choice, defaultOptionIds } : choice;
  });
}

function getSelectionStartIndex(adhoc, courseIndexById, courseCount) {
  const anchorCourseId = getAdhocCourseId(adhoc);
  const anchorIndex =
    anchorCourseId === null ? null : courseIndexById.get(anchorCourseId) ?? null;

  if (anchorIndex === null) {
    return 0;
  }

  const placement = String(adhoc?.placement ?? "").trim().toLowerCase();
  const startIndex = placement === "after" ? anchorIndex + 1 : anchorIndex;
  return Math.max(0, Math.min(courseCount, startIndex));
}

function buildSelectionMarkers(core, courseEntries) {
  const courseIndexById = new Map(courseEntries.map((course) => [course.id, course.index]));
  const rawMarkers = (core.adhocs ?? [])
    .filter((adhoc) => isSelectionAdhoc(adhoc))
    .map((adhoc) => ({
      adhoc,
      startIndex: getSelectionStartIndex(adhoc, courseIndexById, courseEntries.length),
      cue: getAdhocStructuralText(adhoc),
    }))
    .filter((marker) => marker.startIndex < courseEntries.length)
    .sort((left, right) => left.startIndex - right.startIndex);

  return rawMarkers.map((marker, index) => ({
    ...marker,
    endIndex:
      rawMarkers[index + 1]?.startIndex !== undefined
        ? rawMarkers[index + 1].startIndex
        : courseEntries.length,
  }));
}

function summarizeSelectionCue(cueText) {
  const cue = String(cueText ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*$/g, "")
    .replace(/^;\s*/g, "")
    .trim();

  if (/\bprogram elective\b/i.test(cue)) {
    return "Program elective - choose one";
  }

  const creditMatch = cue.match(/\bselect\s+(\d+(?:\.\d+)?)\s+credits?\b/i);
  if (creditMatch) {
    return `Elective - select ${creditMatch[1]} credits`;
  }

  if (/\b(?:select|choose|recommended)\s+one\b|\bone\s+of\s+the\s+following\b/i.test(cue)) {
    return "Select one";
  }

  if (/^select\b/i.test(cue)) {
    return "Select from approved options";
  }

  return cue || "Select from approved options";
}

function extractSelectionCueDetail(cueText) {
  const cue = String(cueText ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*$/g, "")
    .replace(/^;\s*/g, "")
    .trim();
  const detail = cue
    .replace(/^program elective:\s*recommended one of the following\s*[:;]?\s*/i, "")
    .replace(/^recommended one of the following\s*[:;]?\s*/i, "")
    .replace(/^select one of the following\s*[:;]?\s*/i, "")
    .replace(/^choose one from the following\s*[:;]?\s*/i, "")
    .replace(/^select\s+\d+(?:\.\d+)?\s+credits?\s+from\s+the\s+list\s+below\s*[:;]?\s*/i, "")
    .replace(/^select from the following(?: list of)? courses?(?: to [^:;]+)?\s*[:;]?\s*/i, "")
    .trim();

  return detail && detail !== cue ? detail : "";
}

function buildSelectionCourseLabel(cueText, optionLabels) {
  const summary = summarizeSelectionCue(cueText);
  const optionSummary = uniqueStrings(optionLabels.map((label) => getCourseOptionDisplayLabel(label)))
    .filter(Boolean)
    .join(", ");
  const detail = extractSelectionCueDetail(cueText);
  const baseLabel = optionSummary ? `${summary}: ${optionSummary}` : summary;

  if (!detail || baseLabel.toLowerCase().includes(detail.toLowerCase())) {
    return baseLabel;
  }

  return `${baseLabel}. ${detail}`;
}

function getStructuralAdhocForCourse(core, courseId, predicate) {
  return (core.adhocs ?? [])
    .filter((adhoc) => getAdhocCourseId(adhoc) === courseId)
    .filter((adhoc) => predicate(adhoc))
    .sort((left, right) =>
      String(left?.placement ?? "").localeCompare(String(right?.placement ?? ""))
    )[0] ?? null;
}

function collectLooseAdhocCourseLabels(core, handledAdhocIds) {
  const labels = [];

  for (const adhoc of core.adhocs ?? []) {
    if (handledAdhocIds.has(adhoc?.id)) {
      continue;
    }

    const note = normalizeAdhocTrackText(adhoc);
    if (!note) {
      continue;
    }

    if (isRecommendationAdhoc(adhoc)) {
      continue;
    }

    labels.push(...extractTrackGuidanceLabels(note));

    const extractedCodes = shouldTreatTrackTextCourseCodesAsExplicit(note)
      ? extractCourseCodes(note)
      : [];
    if (extractedCodes.length) {
      labels.push(...extractedCodes);
      continue;
    }

    const isCourseAttached = getAdhocCourseId(adhoc) !== null;
    if (
      !isCourseAttached &&
      shouldTreatTrackTextCourseCodesAsExplicit(note) &&
      !/^(classes to become calculus ready|for .+ majors|minimum [0-9]+ credits|elective|humanities|social science)/i.test(
        note
      )
    ) {
      labels.push(note);
    }
  }

  return labels;
}

function isRecommendationAdhoc(adhoc) {
  return /\b(?:recommend|suggest|helpful|consider)\b/i.test(
    [adhoc?.name, adhoc?.display, adhoc?.content].filter(Boolean).join(" ")
  );
}

function extractTrackGuidanceLabels(value) {
  const normalized = normalizeTrackNote(value);
  if (!normalized) {
    return [];
  }

  const hasHumanities = TRACK_HUMANITIES_PATTERN.test(normalized);
  const hasSocialScience = TRACK_SOCIAL_SCIENCE_PATTERN.test(normalized);
  const hasNaturalScience = TRACK_NATURAL_SCIENCE_PATTERN.test(normalized);
  const hasElective = TRACK_ELECTIVE_PATTERN.test(normalized);
  const labels = [];

  if (hasHumanities && hasSocialScience) {
    labels.push("Humanities or Social Science");
  } else if (hasHumanities) {
    labels.push("Humanities");
  } else if (hasSocialScience) {
    labels.push("Social Science");
  }

  if (hasNaturalScience) {
    labels.push("Natural Science");
  }

  if (hasElective) {
    labels.push("Elective or General Education");
  }

  return labels;
}

function shouldTreatTrackTextCourseCodesAsExplicit(value) {
  const normalized = normalizeTrackNote(value);
  if (!normalized) {
    return false;
  }

  return !TRACK_GUIDANCE_NON_EXPLICIT_PATTERN.test(normalized);
}

function isSourceLabeledDistributionPlaceholder(value) {
  const normalized = normalizeTrackNote(value);
  if (!normalized) {
    return false;
  }

  return /^(?:H|S|N)\s*\d+\s*[-:]\s*(?:humanities|fine arts|english|social sciences?|natural sciences?)/i.test(
    normalized
  );
}

function sourceDistributionPlaceholderKind(value) {
  const normalized = normalizeTrackNote(value).toLowerCase();
  if (/^h\s*\d+\s*[-:]/i.test(normalized)) {
    return "humanities";
  }
  if (/^s\s*\d+\s*[-:]/i.test(normalized)) {
    return "social-science";
  }
  if (/^n\s*\d+\s*[-:]/i.test(normalized)) {
    return "natural-science";
  }
  return null;
}

function guidanceLabelKind(value) {
  const normalized = normalizeTrackNote(value).toLowerCase();
  if (/humanities|a&h/.test(normalized)) {
    return "humanities";
  }
  if (/social science|ssc/.test(normalized)) {
    return "social-science";
  }
  if (/natural science|nsc/.test(normalized)) {
    return "natural-science";
  }
  return null;
}

function filterGuidanceLabelsAlreadyCoveredBySourcePlaceholders(guidanceLabels, existingLabels) {
  const coveredKinds = new Set(
    existingLabels.map(sourceDistributionPlaceholderKind).filter(Boolean)
  );

  return guidanceLabels.filter((label) => {
    const kind = guidanceLabelKind(label);
    return !kind || !coveredKinds.has(kind);
  });
}

function shouldPromoteTrackGuidanceLabels(value) {
  const normalized = normalizeTrackNote(value);
  if (!normalized) {
    return false;
  }

  if (/\b(?:humanities|fine arts|english|social science|natural science)[^.;:]{0,80}\bdistribution\b/i.test(normalized)) {
    return true;
  }

  if (
    /\b(?:recommended|recommendation|suggest(?:ed|ion|ions)?|consider|discuss|students are responsible|best transferability)\b/i.test(
      normalized
    )
  ) {
    return false;
  }

  return true;
}

function collectCoreCourseLabels(core) {
  const labels = [];
  const courseEntries = buildCourseEntries(core);
  const selectionMarkers = buildSelectionMarkers(core, courseEntries);
  const selectionByStartIndex = new Map(
    selectionMarkers.map((marker) => [marker.startIndex, marker])
  );
  const selectionCoveredIndexes = new Set();
  const skippedCourseIndexes = new Set();
  const handledAdhocIds = new Set();

  for (const marker of selectionMarkers) {
    if (marker.adhoc?.id !== undefined) {
      handledAdhocIds.add(marker.adhoc.id);
    }
    for (let index = marker.startIndex; index < marker.endIndex; index += 1) {
      selectionCoveredIndexes.add(index);
    }
  }

  for (const course of courseEntries) {
    if (skippedCourseIndexes.has(course.index)) {
      continue;
    }

    const selectionMarker = selectionByStartIndex.get(course.index);
    if (selectionMarker) {
      const optionLabels = courseEntries
        .slice(selectionMarker.startIndex, selectionMarker.endIndex)
        .map((entry) => entry.label)
        .filter(Boolean);
      labels.push(buildSelectionCourseLabel(selectionMarker.cue, optionLabels));
      skippedCourseIndexes.add(course.index);
      for (
        let index = selectionMarker.startIndex + 1;
        index < selectionMarker.endIndex;
        index += 1
      ) {
        skippedCourseIndexes.add(index);
      }
      continue;
    }

    if (selectionCoveredIndexes.has(course.index)) {
      continue;
    }

    const orAdhoc = getStructuralAdhocForCourse(core, course.id, isOrAdhoc);
    if (orAdhoc?.id !== undefined) {
      handledAdhocIds.add(orAdhoc.id);
    }

    const orText = orAdhoc ? getAdhocStructuralText(orAdhoc) : "";
    if (/^or$/i.test(orText)) {
      const nextCourse = courseEntries[course.index + 1] ?? null;
      if (nextCourse && !selectionCoveredIndexes.has(nextCourse.index)) {
        labels.push(`${course.label} or ${nextCourse.label}`);
        skippedCourseIndexes.add(nextCourse.index);
        continue;
      }
    }

    if (/^or\b/i.test(orText)) {
      labels.push(`${course.label} ${orText}`);
      continue;
    }

    labels.push(course.label);
  }

  labels.push(...collectLooseAdhocCourseLabels(core, handledAdhocIds));

  labels.push(
    ...filterGuidanceLabelsAlreadyCoveredBySourcePlaceholders(
      extractTrackGuidanceLabels(core.description),
      labels
    )
  );

  const descriptionCodes = shouldTreatTrackTextCourseCodesAsExplicit(core.description)
    ? extractCourseCodes(core.description)
    : [];
  if (descriptionCodes.length) {
    labels.push(...descriptionCodes);
  }

  return uniqueStrings(labels);
}

function isNonPlannableGeneratedTrackCoreLabel(label) {
  const segments = String(label ?? "")
    .split(">")
    .map((segment) =>
      segment
        .replace(/[:.]\s*$/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);

  return segments.some((segment) =>
    /^(?:notes?|program notes?|important notes?|transferability of credits|advising notes?|entry requirements?|admission requirements?)$/.test(
      segment
    ) || isCatalogOptionListSegment(segment)
  );
}

function isCatalogOptionListSegment(normalized) {
  return /^(?:list\s+[a-z0-9]+|approved(?:\s+\w+){0,4}\s+list|course list|courses? from list\s+[a-z0-9]+)$/.test(
    normalized
  ) || /\blist$/.test(normalized) ||
    /^(?:foreign language|language sequence|specialization|specializations|(?:[\w&/-]+\s+)*electives?)$/.test(normalized);
}

function isCatalogOptionListCoreLabel(label) {
  const normalized =
    String(label ?? "")
      .split(">")
      .map((segment) =>
        segment
          .replace(/[:.]\s*$/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
      .pop() ?? "";

  return isCatalogOptionListSegment(normalized);
}

function getGeneratedTrackCoreElectivePlaceholder(label) {
  const segments = String(label ?? "")
    .split(">")
    .map((segment) =>
      segment
        .replace(/[:.]\s*$/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);

  if (
    segments.some((segment) =>
      /^(?:program\s+)?electives?$/.test(segment) ||
      /^select\b.*\bcourses?\b.*\b(?:credits?|90)\b/.test(segment)
    )
  ) {
    return "Program elective";
  }

  return null;
}

function flattenProgramCores(cores, prefix = []) {
  const flattened = [];

  for (const core of [...(cores ?? [])].sort(
    (left, right) => Number(left?.sort_order ?? 0) - Number(right?.sort_order ?? 0)
  )) {
    const labelParts = [...prefix, String(core?.name ?? "").trim()].filter(Boolean);
    const label = labelParts.join(" > ");
    const electivePlaceholder = getGeneratedTrackCoreElectivePlaceholder(label);
    const courses = electivePlaceholder ? [electivePlaceholder] : collectCoreCourseLabels(core);
    const plannerEligible = !isNonPlannableGeneratedTrackCoreLabel(label);
    const sampleOnly = /^quarter\s+0\b/i.test(label);

    if (label || courses.length) {
      flattened.push({
        label: label || "Requirement block",
        courses,
        description: normalizeTrackNote(core.description),
        plannerEligible,
        ...(sampleOnly
          ? {
              requirementRole: "sample-only",
              sampleOnly: true,
              canCreateScheduleRows: false,
              notes: [
                "Quarter 0 is preparatory sample-map guidance and is not counted as a required catalog row.",
              ],
            }
          : {}),
      });
    }

    if (Array.isArray(core?.children) && core.children.length) {
      flattened.push(...flattenProgramCores(core.children, labelParts));
    }
  }

  return flattened;
}

function collectCatalogOptionListsFromCores(cores, trackId, prefix = []) {
  const optionLists = [];

  for (const core of [...(cores ?? [])].sort(
    (left, right) => Number(left?.sort_order ?? 0) - Number(right?.sort_order ?? 0)
  )) {
    const labelParts = [...prefix, String(core?.name ?? "").trim()].filter(Boolean);
    const label = labelParts.join(" > ");
    const courseLabels = buildCourseEntries(core).map((course) => course.label);

    if (isCatalogOptionListCoreLabel(label) && courseLabels.length) {
      optionLists.push({
        id: `official-grc-track-option-list:${slugify(trackId)}:${slugify(label)}`,
        label,
        sourceHeading: String(core?.name ?? "").trim() || label,
        sourceText: normalizeTrackNote(core?.description) || null,
        supportOnly: true,
        courseLabels,
        courseCodes: uniqueStrings(courseLabels.flatMap((courseLabel) => extractCourseCodes(courseLabel))),
      });
    }

    if (Array.isArray(core?.children) && core.children.length) {
      optionLists.push(...collectCatalogOptionListsFromCores(core.children, trackId, labelParts));
    }
  }

  return optionLists;
}

function parseTermCreditAmount(label) {
  const text = String(label ?? "").replace(/\s+/g, " ");
  const match = text.match(/\((\d+(?:\.\d+)?)\s*credits?\)|\b(\d+(?:\.\d+)?)\s*credits?\b/i);
  const amount = parsePositiveCreditNumber(match?.[1] ?? match?.[2]);
  return amount;
}

function parseTermCreditRange(label) {
  const range = parseCreditRangeFromText(label);
  if (range) {
    return {
      creditMin: range.minimumCredits,
      creditMax: range.maximumCredits ?? range.minimumCredits,
    };
  }

  const amount = parseTermCreditAmount(label);
  return amount === null
    ? null
    : {
        creditMin: amount,
        creditMax: amount,
      };
}

function isGeneralEducationPlaceholderLabel(label) {
  return Boolean(guidanceLabelKind(label) || TRACK_ELECTIVE_PATTERN.test(String(label ?? "")));
}

function isChoiceSlotLabel(label) {
  return /\b(?:select|choose)\b/i.test(String(label ?? "")) && extractCourseCodes(label).length >= 2;
}

function estimateGeneratedTermCreditRange(term) {
  const labelRange = parseTermCreditRange(term?.label);
  if (labelRange) {
    return labelRange;
  }

  const courseCount = (term?.courses ?? []).filter((course) => String(course ?? "").trim()).length;
  if (!courseCount) {
    return null;
  }

  const estimatedCredits = courseCount * 5;
  return {
    creditMin: estimatedCredits,
    creditMax: estimatedCredits,
  };
}

function estimateGeneratedTermsCreditRange(terms) {
  let creditMin = 0;
  let creditMax = 0;
  let foundCredits = false;

  for (const term of terms ?? []) {
    if (
      term?.sampleOnly === true ||
      term?.canCreateScheduleRows === false ||
      term?.requirementRole === "sample-only"
    ) {
      continue;
    }

    const range = estimateGeneratedTermCreditRange(term);
    if (!range) {
      continue;
    }
    foundCredits = true;
    creditMin += range.creditMin;
    creditMax += range.creditMax;
  }

  return foundCredits ? { creditMin, creditMax } : null;
}

function formatCreditRangeForGeneratedLabel(creditMin, creditMax) {
  return creditMin === creditMax ? String(creditMin) : `${creditMin}-${creditMax}`;
}

function materializeRemainingCatalogRequirementPlaceholderTerm(terms, creditRange) {
  const catalogMinimumCredits = parsePositiveCreditNumber(creditRange?.minimumCredits);
  if (catalogMinimumCredits === null) {
    return terms;
  }

  const catalogMaximumCredits =
    parsePositiveCreditNumber(creditRange?.maximumCredits) ?? catalogMinimumCredits;
  const estimatedRange = estimateGeneratedTermsCreditRange(terms);
  const scheduledMaxCredits = estimatedRange?.creditMax ?? 0;
  if (scheduledMaxCredits >= catalogMinimumCredits) {
    return terms;
  }

  const remainingMinCredits = Math.max(0, catalogMinimumCredits - scheduledMaxCredits);
  const remainingMaxCredits = Math.max(remainingMinCredits, catalogMaximumCredits - scheduledMaxCredits);
  if (remainingMaxCredits <= 0) {
    return terms;
  }

  const rangeText = formatCreditRangeForGeneratedLabel(remainingMinCredits, remainingMaxCredits);
  return [
    ...terms,
    {
      label: `Remaining catalog requirements (${rangeText} credits)`,
      courses: [`${rangeText} credits of remaining catalog requirements`],
      requirementRole: "remaining-credits",
      notes: [
        "Generated from the catalog credit range because the structured curriculum map leaves part of the required range unresolved.",
      ],
    },
  ];
}

function buildTrackSampleScheduleMetadata(track, creditRange) {
  const scheduledTermCreditRanges = (track.terms ?? [])
    .map((term) => parseTermCreditRange(term.label))
    .filter((credits) => credits !== null);
  const scheduledMinCreditTotal = scheduledTermCreditRanges.length
    ? scheduledTermCreditRanges.reduce((total, credits) => total + credits.creditMin, 0)
    : null;
  const scheduledMaxCreditTotal = scheduledTermCreditRanges.length
    ? scheduledTermCreditRanges.reduce((total, credits) => total + credits.creditMax, 0)
    : null;
  const labels = (track.terms ?? []).flatMap((term) => term.courses ?? []);
  const placeholderCredits =
    labels.filter((label) => isGeneralEducationPlaceholderLabel(label)).length * 5;
  const unresolvedOptionCredits = labels
    .filter((label) => isChoiceSlotLabel(label))
    .reduce((total, label) => total + (getCreditAmountFromText(label) ?? 5), 0);
  const defaultOptionCredits = (track.groupedChoices ?? []).reduce((total, choice) => {
    const optionById = new Map((choice.options ?? []).map((option) => [option.id, option]));
    return (
      total +
      (choice.defaultOptionIds ?? []).reduce((defaultTotal, optionId) => {
        const option = optionById.get(optionId);
        const optionCredits =
          option?.courseLabels?.reduce(
            (labelTotal, label) => labelTotal + (getCreditAmountFromText(label) ?? 5),
            0
          ) ?? 0;
        return defaultTotal + optionCredits;
      }, 0)
    );
  }, 0);
  const catalogMinimumCredits = parsePositiveCreditNumber(creditRange?.minimumCredits);
  const catalogMaximumCredits = parsePositiveCreditNumber(creditRange?.maximumCredits);

  return {
    ...(scheduledMinCreditTotal !== null
      ? {
          scheduledMinCredits: scheduledMinCreditTotal,
          scheduledMaxCredits: scheduledMaxCreditTotal,
        }
      : {}),
    placeholderCredits,
    unresolvedOptionCredits,
    defaultOptionCredits,
    sampleOnlyCredits: Math.max(0, (scheduledMaxCreditTotal ?? 0) - (catalogMinimumCredits ?? 0)),
    exceedsCatalogMinimum:
      scheduledMaxCreditTotal !== null && catalogMinimumCredits !== null
        ? scheduledMaxCreditTotal > catalogMinimumCredits
        : null,
    exceedsCatalogMaximum:
      scheduledMaxCreditTotal !== null && catalogMaximumCredits !== null
        ? scheduledMaxCreditTotal > catalogMaximumCredits
        : null,
  };
}

function buildGeneratedTrackSummary(page) {
  return `${page.h1} curriculum map.`;
}

function buildGeneratedTrackNotes(page, coreTerms) {
  const notes = [];
  if (page.programType) {
    notes.push(`Program type: ${page.programType}.`);
  }
  if (page.degree) {
    notes.push(`Degree: ${page.degree}.`);
  }
  if (page.duration) {
    notes.push(`Published duration: ${page.duration}.`);
  }
  const descriptiveTerms = coreTerms
    .map((term) => term.description)
    .filter(Boolean)
    .slice(0, 4);
  notes.push(...descriptiveTerms);
  notes.push(
    "Generated automatically from Green River's current program-map curriculum data."
  );
  return uniqueStrings(notes);
}

function buildTrackFromProgramPage(page, program, requirementProgram = null) {
  const trackId = getGeneratedTrackId(page);
  const coreTerms = flattenProgramCores(program.cores ?? []).filter(
    (term) => term.courses.length || term.description
  );
  const rawTerms = coreTerms
    .filter((term) => term.plannerEligible !== false)
    .map((term) => ({
      label: term.label,
      courses: term.courses.length ? term.courses : [term.description],
      ...(term.requirementRole ? { requirementRole: term.requirementRole } : {}),
      ...(term.sampleOnly === true ? { sampleOnly: true } : {}),
      ...(term.canCreateScheduleRows === false ? { canCreateScheduleRows: false } : {}),
      ...(term.notes?.length ? { notes: term.notes } : {}),
    }));

  if (!rawTerms.length) {
    throw new Error(`No curriculum-map terms were extracted for ${page.h1}.`);
  }

  const groupedChoices = requirementProgram
    ? collectGroupedChoicesFromProgram(requirementProgram, trackId)
    : [];
  const catalogOptionLists = collectCatalogOptionListsFromCores(program.cores ?? [], trackId);
  const creditRange = getProgramCreditRange(page, program, requirementProgram);
  const terms = materializeRemainingCatalogRequirementPlaceholderTerm(rawTerms, creditRange);
  const groupedChoicesWithDefaults = attachGroupedChoiceDefaultOptions(groupedChoices, terms);
  const trackWithoutSampleMetadata = {
    id: trackId,
    code: inferTrackCode(page),
    title: cleanTrackTitle(page.h1),
    summary: buildGeneratedTrackSummary(page),
    bestFor: uniqueStrings([cleanTrackTitle(page.h1)]),
    ...(creditRange?.minimumCredits ? { minimumCredits: creditRange.minimumCredits } : {}),
    ...(creditRange?.maximumCredits ? { maximumCredits: creditRange.maximumCredits } : {}),
    ...(creditRange
      ? {
          catalogCreditRange: {
            minimumCredits: creditRange.minimumCredits,
            maximumCredits: creditRange.maximumCredits,
            sourceText: creditRange.sourceText,
            sourceKind: creditRange.sourceKind,
            isExact: creditRange.isExact,
          },
        }
      : {}),
    terms,
    notes: buildGeneratedTrackNotes(page, coreTerms),
    officialLinks: [
      {
        label: `${page.h1} curriculum map`,
        url: page.url,
      },
    ],
    ...(groupedChoicesWithDefaults.length ? { groupedChoices: groupedChoicesWithDefaults } : {}),
    ...(catalogOptionLists.length ? { catalogOptionLists } : {}),
  };

  return {
    ...trackWithoutSampleMetadata,
    sampleSchedule: buildTrackSampleScheduleMetadata(trackWithoutSampleMetadata, creditRange),
  };
}

function serializeExport(name, typeName, value) {
  return `export const ${name}: ${typeName} = ${JSON.stringify(value, null, 2)};\n`;
}

function buildReportMarkdown(summary, records) {
  const lines = [
    "# Green River Program Track Generation",
    "",
    `Generated: ${summary.generatedAt}`,
    `Current catalog: ${summary.currentCatalogName} (id ${summary.currentCatalogId})`,
    "",
    `- Program-map pages scanned: ${summary.programMapPageCount}`,
    `- Official associate curriculum-map pages discovered: ${summary.officialAssociateTrackCount}`,
    `- Supported Green River program-map pages discovered: ${summary.officialSupportedProgramCount}`,
    `- Associate curriculum maps with structured connectors: ${summary.connectedAssociateTrackCount}`,
    `- Supported program maps with structured connectors: ${summary.connectedSupportedProgramCount}`,
    `- Final generated track count: ${summary.generatedTrackCount}`,
    "",
    "## Generated Tracks",
    "",
  ];

  for (const record of records) {
    lines.push(
      `- \`${record.track.id}\` | \`${record.track.code}\` | ${record.track.title} (${record.page.url})`
    );
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  ensureTmpDir();

  console.log("Fetching Green River sitemap...");
  const sitemapXml = await fetchText(GRC_SITEMAP_URL);
  const publicProgramMapUrls = getProgramMapUrlsFromSitemap(sitemapXml);

  console.log(
    `Scanning ${publicProgramMapUrls.length} Green River public program-map pages for supported curriculum maps...`
  );
  const publicPages = await mapWithConcurrency(
    publicProgramMapUrls,
    PAGE_FETCH_CONCURRENCY,
    async (url, index) => {
      console.log(`[${index + 1}/${publicProgramMapUrls.length}] program-map pages checked - ${url}`);
      const html = await fetchText(url);
      return extractPublicProgramPageMetadata(url, html);
    }
  );

  const supportedPages = publicPages.filter((page) => getSupportedProgramPageKind(page) !== null);
  const associatePages = supportedPages.filter((page) => isAssociateProgramPage(page));
  console.log(
    `Supported curriculum-map candidates found: ${supportedPages.length} (${associatePages.length} associate).`
  );

  const currentCatalog = await getCurrentCatalogRecord();
  console.log(`Using current Green River catalog ${currentCatalog.name} (${currentCatalog.id}).`);

  const catalogPrograms = await getAllCatalogPrograms(currentCatalog.id);
  const catalogProgramByName = new Map(
    catalogPrograms.map((program) => [String(program?.name ?? "").trim(), program])
  );

  const officialProgramTrackRecords = (await mapWithConcurrency(
    supportedPages,
    PROGRAM_FETCH_CONCURRENCY,
    async (page, index) => {
      const programKind = getSupportedProgramPageKind(page) ?? "program";
      const programSummary = getProgramByConnectorName(catalogPrograms, page);
      if (!programSummary) {
        console.log(
          `[${index + 1}/${supportedPages.length}] ${programKind} curriculum maps fetched - ${page.pagePathSlug} (skipped: no structured curriculum-map connector)`
        );
        return null;
      }

      console.log(
        `[${index + 1}/${supportedPages.length}] ${programKind} curriculum maps fetched - ${page.pagePathSlug}`
      );

      const program = await fetchJson(
        `${GRC_WIDGET_API_ROOT_URL}/catalog/${currentCatalog.id}/program/${programSummary.id}`
      );
      const requirementProgramSummary = getRequirementProgramForCurriculumMap(
        catalogPrograms,
        page,
        programSummary
      );
      const requirementProgram =
        requirementProgramSummary && Number(requirementProgramSummary.id) !== Number(programSummary.id)
          ? await fetchJson(
              `${GRC_WIDGET_API_ROOT_URL}/catalog/${currentCatalog.id}/program/${requirementProgramSummary.id}`
            )
          : null;

      return {
        page,
        program,
        requirementProgram,
        programSummary:
          catalogProgramByName.get(String(programSummary.name ?? "").trim()) ?? programSummary,
        requirementProgramSummary:
          requirementProgramSummary
            ? catalogProgramByName.get(String(requirementProgramSummary.name ?? "").trim()) ??
              requirementProgramSummary
            : null,
        track: buildTrackFromProgramPage(page, program, requirementProgram),
      };
    }
  )).filter(Boolean);

  officialProgramTrackRecords.sort((left, right) => {
    if (left.track.id !== right.track.id) {
      return left.track.id.localeCompare(right.track.id);
    }
    return left.page.url.localeCompare(right.page.url);
  });

  const finalTracks = officialProgramTrackRecords
    .map((record) => record.track)
    .map((track) => normalizeGeneratedTrack(track));

  const summary = {
    generatedAt: toIsoTimestamp(),
    currentCatalogId: Number(currentCatalog.id ?? 0),
    currentCatalogName: String(currentCatalog.name ?? "").trim(),
    programMapPageCount: publicPages.length,
    officialAssociateTrackCount: associatePages.length,
    officialSupportedProgramCount: supportedPages.length,
    connectedAssociateTrackCount: officialProgramTrackRecords.filter((record) =>
      isAssociateProgramPage(record.page)
    ).length,
    connectedSupportedProgramCount: officialProgramTrackRecords.length,
    generatedTrackCount: finalTracks.length,
  };

  const reportPayload = {
    summary,
    records: officialProgramTrackRecords.map((record) => ({
      page: record.page,
      programKind: getSupportedProgramPageKind(record.page),
      connectorProgramName: record.page.connectorProgramName,
      catalogProgramId: Number(record.program?.id ?? 0),
      catalogProgramName: String(record.program?.name ?? "").trim(),
      requirementProgramId: Number(record.requirementProgram?.id ?? 0) || null,
      requirementProgramName: String(record.requirementProgram?.name ?? "").trim() || null,
      track: record.track,
    })),
  };

  const fileContents = `/* eslint-disable */
/* auto-generated by scripts/planner/generate-transfer-planner-grc-associate-tracks.cjs */

import type { TransferPlannerTrack } from "../transfer-planner-types";

${serializeExport(
  "TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS",
  "TransferPlannerTrack[]",
  finalTracks
)}
${serializeExport(
  "TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY",
  "{ generatedAt: string; currentCatalogId: number; currentCatalogName: string; programMapPageCount: number; officialAssociateTrackCount: number; officialSupportedProgramCount: number; connectedAssociateTrackCount: number; connectedSupportedProgramCount: number; generatedTrackCount: number; }",
  summary
)}
`;

  fs.writeFileSync(OUTPUT_PATH, fileContents);
  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(reportPayload, null, 2));
  fs.writeFileSync(REPORT_MD_PATH, buildReportMarkdown(summary, officialProgramTrackRecords));

  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`JSON report: ${REPORT_JSON_PATH}`);
  console.log(`Markdown report: ${REPORT_MD_PATH}`);
  console.log(
    `Official supported program maps: ${summary.officialSupportedProgramCount}; final generated tracks: ${summary.generatedTrackCount}.`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  buildTrackFromProgramPage,
  estimateGeneratedTermsCreditRange,
  materializeRemainingCatalogRequirementPlaceholderTerm,
  parseCreditRangeFromText,
  parseTermCreditRange,
};
