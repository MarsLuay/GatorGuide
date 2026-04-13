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

const { TRANSFER_PLANNER_TRACKS: LEGACY_MANUAL_TRACKS } = require("../../constants/transfer-planner-data");

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
const LEGACY_GRC_CODE_ALIASES = new Map([
  ["MATH& 254", "MATH& 264"],
]);

const RETAINED_LEGACY_TRACK_IDS = new Set(["999B"]);
const LEGACY_COMPATIBILITY_TRACKS_BY_PAGE_SLUG = new Map([
  [
    "associate-in-science-transfer-track-2-bioengineering-and-chemical-engineering",
    {
      id: "999O",
      code: "999O",
      title: "AST2 / MRP Bioengineering and Chemical Engineering",
    },
  ],
  [
    "associate-in-science-transfer-track-2-mrp-civil-and-mechanical-engineering",
    {
      id: "999Q",
      code: "999Q",
      title: "AST2 / MRP Civil and Mechanical Engineering",
    },
  ],
  [
    "associate-in-science-transfer-track-2-mrp-computer-and-electrical-engineering",
    {
      id: "999P",
      code: "999P",
      title: "AST2 / MRP Computer and Electrical Engineering",
    },
  ],
]);

const LEGACY_TRACK_BY_ID = new Map(
  LEGACY_MANUAL_TRACKS.map((track) => [String(track.id ?? "").trim(), track])
);

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
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCourseCode(value) {
  const normalized = String(value ?? "")
    .replace(/\u00A0/g, " ")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  return LEGACY_GRC_CODE_ALIASES.get(normalized) ?? normalized;
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
  let raw = String(label ?? "").trim();
  if (!raw) {
    return "";
  }

  for (const [legacyCode, canonicalCode] of LEGACY_GRC_CODE_ALIASES.entries()) {
    const escapedLegacyCode = legacyCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const legacyRegex = new RegExp(`\\b${escapedLegacyCode}\\b`, "gi");
    raw = raw.replace(legacyRegex, canonicalCode);
  }

  return raw;
}

function normalizeTrackCourseTerms(terms) {
  return (Array.isArray(terms) ? terms : []).map((term) => ({
    ...term,
    courses: uniqueStrings((term?.courses ?? []).map((course) => normalizeTrackCourseLabel(course))),
  }));
}

function normalizeLegacyTrack(track) {
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

function isAssociateProgramPage(page) {
  const text = [page.h1, page.programType, page.degree].join(" | ").toLowerCase();
  const includePattern =
    /\bassociate\b|\btransfer track\b|\baaa\b|\baas-t\b|\baas\b|\baa-dta\b|\bab-dta\b|\bacs-dta\b|\bapren-dta\b|\bafa\b|\bam-dta\b/;
  const excludePattern = /\bbas\b|\bbachelor\b|\bcertificate\b/;
  return includePattern.test(text) && !excludePattern.test(text);
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
  const programType = page.programType ? `${page.programType.toLowerCase()} ` : "";
  return `Official Green River ${programType}curriculum map for ${page.h1}. Generated automatically from the current public program-map page and catalog API.`;
}

function buildFallbackTrackSummary(page) {
  return `Official Green River associate page for ${page.h1}. The current public page does not expose a structured curriculum-map feed, so this track is generated from the published page metadata only.`;
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
  const compatibility = LEGACY_COMPATIBILITY_TRACKS_BY_PAGE_SLUG.get(page.pageSlug) ?? null;
  const legacyTrack = compatibility ? LEGACY_TRACK_BY_ID.get(compatibility.id) ?? null : null;
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
    id: compatibility?.id ?? `grc-associate-${page.pagePathSlug}`,
    code: compatibility?.code ?? inferTrackCode(page),
    title: compatibility?.title ?? cleanTrackTitle(page.h1),
    summary: buildGeneratedTrackSummary(page),
    bestFor: uniqueStrings([cleanTrackTitle(page.h1)]),
    terms,
    notes: buildGeneratedTrackNotes(page, coreTerms),
    catalogYears: legacyTrack?.catalogYears,
    officialLinks: [
      {
        label: `${page.h1} curriculum map`,
        url: page.url,
      },
    ],
  };
}

function buildFallbackTrackFromPublicPage(page) {
  const compatibility = LEGACY_COMPATIBILITY_TRACKS_BY_PAGE_SLUG.get(page.pageSlug) ?? null;
  const legacyTrack = compatibility ? LEGACY_TRACK_BY_ID.get(compatibility.id) ?? null : null;
  const courses = page.bodyCourseCodes.length
    ? [...page.bodyCourseCodes]
    : ["Published requirements only; no structured course grid is available yet."];

  return {
    id: compatibility?.id ?? `grc-associate-${page.pagePathSlug}`,
    code: compatibility?.code ?? inferTrackCode(page),
    title: compatibility?.title ?? cleanTrackTitle(page.h1),
    summary: buildFallbackTrackSummary(page),
    bestFor: uniqueStrings([cleanTrackTitle(page.h1)]),
    terms: [
      {
        label: "Published requirements",
        courses,
      },
    ],
    notes: uniqueStrings([
      page.programType ? `Program type: ${page.programType}.` : "",
      page.degree ? `Degree: ${page.degree}.` : "",
      page.duration ? `Published duration: ${page.duration}.` : "",
      "Generated automatically from the public Green River program-map page because no structured curriculum-map connector is published for this page yet.",
    ]),
    catalogYears: legacyTrack?.catalogYears,
    officialLinks: [
      {
        label: `${page.h1} program map`,
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
    "# Green River Associate Track Generation",
    "",
    `Generated: ${summary.generatedAt}`,
    `Current catalog: ${summary.currentCatalogName} (id ${summary.currentCatalogId})`,
    "",
    `- Program-map pages scanned: ${summary.programMapPageCount}`,
    `- Official associate curriculum maps discovered: ${summary.officialAssociateTrackCount}`,
    `- Current manual track library before this generator: ${summary.previousManualTrackCount}`,
    `- Official associate tracks newly added beyond the current manual library: ${summary.newlyAddedOfficialAssociateTrackCount}`,
    `- Retained legacy non-associate compatibility tracks: ${summary.retainedLegacyTrackCount}`,
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
    `Scanning ${publicProgramMapUrls.length} Green River public program-map pages for associate curriculum maps...`
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

  const associatePages = publicPages.filter((page) => isAssociateProgramPage(page));
  console.log(`Associate curriculum-map candidates found: ${associatePages.length}`);

  const currentCatalog = await getCurrentCatalogRecord();
  console.log(`Using current Green River catalog ${currentCatalog.name} (${currentCatalog.id}).`);

  const catalogPrograms = await getAllCatalogPrograms(currentCatalog.id);
  const catalogProgramByName = new Map(
    catalogPrograms.map((program) => [String(program?.name ?? "").trim(), program])
  );

  const officialAssociateTrackRecords = await mapWithConcurrency(
    associatePages,
    PROGRAM_FETCH_CONCURRENCY,
    async (page, index) => {
      const programSummary = getProgramByConnectorName(catalogPrograms, page);
      if (!programSummary) {
        console.log(
          `[${index + 1}/${associatePages.length}] associate curriculum maps fetched - ${page.pagePathSlug} (public-page fallback)`
        );
        return {
          page,
          program: null,
          programSummary: null,
          track: buildFallbackTrackFromPublicPage(page),
        };
      }

      console.log(
        `[${index + 1}/${associatePages.length}] associate curriculum maps fetched - ${page.pagePathSlug}`
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
  );

  officialAssociateTrackRecords.sort((left, right) => {
    if (left.track.id !== right.track.id) {
      return left.track.id.localeCompare(right.track.id);
    }
    return left.page.url.localeCompare(right.page.url);
  });

  const retainedLegacyTracks = [...RETAINED_LEGACY_TRACK_IDS]
    .map((trackId) => LEGACY_TRACK_BY_ID.get(trackId))
    .filter(Boolean)
    .map((track) => normalizeLegacyTrack(track));

  const finalTracks = [
    ...retainedLegacyTracks,
    ...officialAssociateTrackRecords.map((record) => record.track),
  ].map((track) => normalizeLegacyTrack(track));

  const summary = {
    generatedAt: toIsoTimestamp(),
    currentCatalogId: Number(currentCatalog.id ?? 0),
    currentCatalogName: String(currentCatalog.name ?? "").trim(),
    programMapPageCount: publicPages.length,
    officialAssociateTrackCount: officialAssociateTrackRecords.length,
    previousManualTrackCount: LEGACY_MANUAL_TRACKS.length,
    newlyAddedOfficialAssociateTrackCount:
      officialAssociateTrackRecords.length - LEGACY_COMPATIBILITY_TRACKS_BY_PAGE_SLUG.size,
    retainedLegacyTrackCount: retainedLegacyTracks.length,
    generatedTrackCount: finalTracks.length,
  };

  const reportPayload = {
    summary,
    records: officialAssociateTrackRecords.map((record) => ({
      page: record.page,
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
  "{ generatedAt: string; currentCatalogId: number; currentCatalogName: string; programMapPageCount: number; officialAssociateTrackCount: number; previousManualTrackCount: number; newlyAddedOfficialAssociateTrackCount: number; retainedLegacyTrackCount: number; generatedTrackCount: number; }",
  summary
)}
`;

  fs.writeFileSync(OUTPUT_PATH, fileContents);
  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(reportPayload, null, 2));
  fs.writeFileSync(REPORT_MD_PATH, buildReportMarkdown(summary, officialAssociateTrackRecords));

  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`JSON report: ${REPORT_JSON_PATH}`);
  console.log(`Markdown report: ${REPORT_MD_PATH}`);
  console.log(
    `Official associate curriculum maps: ${summary.officialAssociateTrackCount}; final generated tracks: ${summary.generatedTrackCount}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
