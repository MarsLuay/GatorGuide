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

function normalizeGeneratedTrack(track) {
  return {
    ...track,
    terms: normalizeTrackCourseTerms(track?.terms),
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

  if (/associate in arts-dta|arts-dta|direct transfer agreement/i.test(text)) {
    return "AA-DTA";
  }

  const orderedPatterns = [
    /\bAB-DTA\/MRP\b/i,
    /\bACS-DTA\/MRP\b/i,
    /\bAPreN-DTA\/MRP\b/i,
    /\bAM-DTA\/MRP\b/i,
    /\bAM-DTA\b/i,
    /\bAA-DTA\b/i,
    /\bAAS-T\b/i,
    /\bAAA\b/i,
    /\bAAS\b/i,
    /\bAFA\b/i,
  ];

  for (const pattern of orderedPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].toUpperCase();
    }
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

  if (/^(or|and)$/i.test(normalized)) {
    return "";
  }

  return normalized;
}

function collectCoreCourseLabels(core) {
  const labels = [];

  for (const course of [...(core.courses ?? [])].sort(
    (left, right) => Number(left?.sort_order ?? 0) - Number(right?.sort_order ?? 0)
  )) {
    labels.push(normalizeCourseTitleLabel(course.title));
  }

  for (const adhoc of core.adhocs ?? []) {
    const note = normalizeTrackNote(adhoc.display || adhoc.content);
    if (!note) {
      continue;
    }

    const extractedCodes = extractCourseCodes(note);
    if (extractedCodes.length) {
      labels.push(...extractedCodes);
      continue;
    }

    if (
      !/^(classes to become calculus ready|minimum [0-9]+ credits|elective|humanities|social science)/i.test(
        note
      )
    ) {
      labels.push(note);
    }
  }

  const descriptionCodes = extractCourseCodes(core.description);
  if (descriptionCodes.length) {
    labels.push(...descriptionCodes);
  }

  return uniqueStrings(labels);
}

function flattenProgramCores(cores, prefix = []) {
  const flattened = [];

  for (const core of [...(cores ?? [])].sort(
    (left, right) => Number(left?.sort_order ?? 0) - Number(right?.sort_order ?? 0)
  )) {
    const labelParts = [...prefix, String(core?.name ?? "").trim()].filter(Boolean);
    const label = labelParts.join(" > ");
    const courses = collectCoreCourseLabels(core);

    if (label || courses.length) {
      flattened.push({
        label: label || "Requirement block",
        courses,
        description: normalizeTrackNote(core.description),
      });
    }

    if (Array.isArray(core?.children) && core.children.length) {
      flattened.push(...flattenProgramCores(core.children, labelParts));
    }
  }

  return flattened;
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

function buildTrackFromProgramPage(page, program) {
  const coreTerms = flattenProgramCores(program.cores ?? []).filter(
    (term) => term.courses.length || term.description
  );
  const terms = coreTerms.map((term) => ({
    label: term.label,
    courses: term.courses.length ? term.courses : [term.description],
  }));

  if (!terms.length) {
    throw new Error(`No curriculum-map terms were extracted for ${page.h1}.`);
  }

  return {
    id: getGeneratedTrackId(page),
    code: inferTrackCode(page),
    title: cleanTrackTitle(page.h1),
    summary: buildGeneratedTrackSummary(page),
    bestFor: uniqueStrings([cleanTrackTitle(page.h1)]),
    terms,
    notes: buildGeneratedTrackNotes(page, coreTerms),
    officialLinks: [
      {
        label: `${page.h1} curriculum map`,
        url: page.url,
      },
    ],
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

      return {
        page,
        program,
        programSummary:
          catalogProgramByName.get(String(programSummary.name ?? "").trim()) ?? programSummary,
        track: buildTrackFromProgramPage(page, program),
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
