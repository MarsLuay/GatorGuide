const fs = require("fs");
const { fetchTextWithHandling } = require("../lib/fetch-with-handling.cjs");
const {
  SOURCE_ROOT,
  ensurePlannerTmpLayout,
  getPlannerTmpPath,
  hasArg,
  writePlannerJsonReport,
  writePlannerMarkdownReport,
} = require("./lib/script-harness.cjs");

const REPO_ROOT = SOURCE_ROOT;
ensurePlannerTmpLayout();
const OUTPUT_JSON_PATH = getPlannerTmpPath("transfer-planner-grc-public-materials.json");
const OUTPUT_MD_PATH = getPlannerTmpPath("transfer-planner-grc-public-materials.md");

const GRC_CLASS_SCHEDULES_URL =
  "https://www.greenriver.edu/students/academics/class-schedules-catalog/index.html";
const GRC_CATALOG_ARCHIVE_URL =
  "https://www.greenriver.edu/students/academics/class-schedules-catalog/catalog-archive.html";
const GRC_CATALOG_ROOT_URL = "https://catalog.greenriver.edu/";
const USER_AGENT = "GatorGuideTransferPlannerGrcDiscovery/1.0";

function ensureTmpDir() {
  ensurePlannerTmpLayout();
}

const HTML_ENTITY_DECODERS = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  "#39": "'",
  apos: "'",
};

function decodeKnownHtmlEntities(value) {
  return String(value ?? "").replace(/&(nbsp|amp|quot|#39|apos);/gi, (match, entityName) => {
    const normalizedEntityName = String(entityName ?? "").toLowerCase();
    return Object.prototype.hasOwnProperty.call(HTML_ENTITY_DECODERS, normalizedEntityName)
      ? HTML_ENTITY_DECODERS[normalizedEntityName]
      : match;
  });
}

function normalizeWhitespace(value) {
  return decodeKnownHtmlEntities(value)
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlAttribute(value) {
  return decodeKnownHtmlEntities(value);
}

function stripHtml(value) {
  return normalizeWhitespace(String(value ?? "").replace(/<[^>]+>/g, " "));
}

function compareAcademicYearLabels(left, right) {
  const leftStart = getAcademicYearStart(left);
  const rightStart = getAcademicYearStart(right);

  if (Number.isFinite(leftStart) && Number.isFinite(rightStart) && leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  return String(left ?? "").localeCompare(String(right ?? ""));
}

function getAcademicYearStart(label) {
  const match = String(label ?? "").match(/^(20\d{2})-/);
  return match ? Number.parseInt(match[1], 10) : Number.NaN;
}

function sortAcademicYearLabels(labels, direction = "asc") {
  const multiplier = direction === "desc" ? -1 : 1;
  return [...labels].sort((left, right) => multiplier * compareAcademicYearLabels(left, right));
}

function filterRelevantAnnualSchedules(annualSchedules, currentCatalogYearLabel) {
  const currentStartYear = getAcademicYearStart(currentCatalogYearLabel);
  if (!Number.isFinite(currentStartYear)) {
    return annualSchedules;
  }

  const minimumStartYear = currentStartYear - 1;
  return annualSchedules.filter((entry) => getAcademicYearStart(entry.label) >= minimumStartYear);
}

function toAbsoluteUrl(value, baseUrl) {
  try {
    return new URL(decodeHtmlAttribute(value).trim(), baseUrl).href;
  } catch {
    return null;
  }
}

function slugifyAcademicYear(label) {
  return String(label ?? "")
    .trim()
    .replace(/[^0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildAnnualScheduleSnapshotPath(label) {
  return getPlannerTmpPath(`${label}-Annual-Schedule.pdf`);
}

async function fetchText(url) {
  return fetchTextWithHandling(url, {
    operation: "GRC public materials fetch",
    timeoutMs: 30000,
    userAgent: USER_AGENT,
  });
}

function extractAnchorMatches(html) {
  return [...String(html ?? "").matchAll(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)];
}

function extractGrcAnnualSchedules(html, baseUrl = GRC_CLASS_SCHEDULES_URL) {
  const byLabel = new Map();

  for (const match of extractAnchorMatches(html)) {
    const href = match[2];
    const text = stripHtml(match[3]);
    const sourceText = `${text} ${href}`;
    const labelMatch = sourceText.match(/\b(20\d{2}-20\d{2})\b/);
    if (!labelMatch || !/annual schedule/i.test(sourceText) || !/\.pdf(?:$|[?#])/i.test(href)) {
      continue;
    }

    const label = labelMatch[1];
    const url = toAbsoluteUrl(href, baseUrl);
    if (!url) {
      continue;
    }

    byLabel.set(label, {
      label,
      url,
      outputPath: buildAnnualScheduleSnapshotPath(label),
      ownerId: `grc-annual-schedule-${slugifyAcademicYear(label)}`,
      sourcePageUrl: baseUrl,
    });
  }

  return sortAcademicYearLabels([...byLabel.keys()])
    .map((label) => byLabel.get(label))
    .filter(Boolean);
}

function extractGrcCatalogArchiveEntries(html, baseUrl = GRC_CATALOG_ARCHIVE_URL) {
  const byLabel = new Map();

  for (const match of extractAnchorMatches(html)) {
    const href = match[2];
    const text = stripHtml(match[3]);
    const titleMatch = text.match(/Green River College\s+(20\d{2}-20\d{2})\s+Catalog/i);
    if (!titleMatch) {
      continue;
    }

    const label = titleMatch[1];
    const url = toAbsoluteUrl(href, baseUrl);
    if (!url) {
      continue;
    }

    byLabel.set(label, {
      label,
      url,
      sourcePageUrl: baseUrl,
    });
  }

  return sortAcademicYearLabels([...byLabel.keys()], "desc")
    .map((label) => byLabel.get(label))
    .filter(Boolean);
}

function extractCurrentGrcCatalogDetails(
  html,
  catalogRootUrl,
  expectedCatalogYearLabel
) {
  let courseDescriptionsUrl = null;

  for (const match of extractAnchorMatches(html)) {
    const href = match[2];
    const text = stripHtml(match[3]);
    if (!/course descriptions/i.test(text)) {
      continue;
    }
    courseDescriptionsUrl = toAbsoluteUrl(href, catalogRootUrl);
    if (courseDescriptionsUrl) {
      break;
    }
  }

  if (!courseDescriptionsUrl) {
    throw new Error(`Could not find the current Green River course descriptions link on ${catalogRootUrl}`);
  }

  const parsedCourseDescriptionsUrl = new URL(courseDescriptionsUrl);
  const sourceUrl = new URL(courseDescriptionsUrl);
  sourceUrl.searchParams.delete("expand");
  sourceUrl.searchParams.delete("print");

  const expandedUrl = new URL(courseDescriptionsUrl);
  expandedUrl.searchParams.set("expand", "1");
  if (!expandedUrl.searchParams.has("print")) {
    expandedUrl.searchParams.set("print", "");
  }

  return {
    label: expectedCatalogYearLabel,
    rootUrl: catalogRootUrl,
    sourcePageUrl: catalogRootUrl,
    courseDescriptionsUrl: sourceUrl.href,
    courseDescriptionsExpandedUrl: expandedUrl.href,
    catoid: parsedCourseDescriptionsUrl.searchParams.get("catoid") ?? null,
    navoid: parsedCourseDescriptionsUrl.searchParams.get("navoid") ?? null,
  };
}

function buildPagedGrcCourseDescriptionsUrl(courseDescriptionsUrl, pageNumber) {
  const url = new URL(courseDescriptionsUrl);
  url.searchParams.set("filter[item_type]", "3");
  url.searchParams.set("filter[only_active]", "1");
  url.searchParams.set("filter[3]", "1");
  if (pageNumber > 1) {
    url.searchParams.set("filter[cpage]", String(pageNumber));
  } else {
    url.searchParams.delete("filter[cpage]");
  }
  url.searchParams.set("expand", "1");
  url.searchParams.set("print", "");
  return url.href;
}

function loadCachedGrcPublicMaterials() {
  if (!fs.existsSync(OUTPUT_JSON_PATH)) {
    return null;
  }

  const cached = JSON.parse(fs.readFileSync(OUTPUT_JSON_PATH, "utf8"));
  return {
    ...cached,
    annualSchedules: Array.isArray(cached.annualSchedules)
      ? cached.annualSchedules.map((entry) => ({
          ...entry,
          outputPath: buildAnnualScheduleSnapshotPath(entry.label),
        }))
      : [],
  };
}

function writeMarkdown(materials) {
  const lines = [
    "# Green River Public Materials Discovery",
    "",
    `Generated: ${materials.generatedAt}`,
    `Used cached fallback: ${materials.usedSnapshotFallback ? "yes" : "no"}`,
    ...(materials.snapshotFallbackReason
      ? [`Fallback reason: ${materials.snapshotFallbackReason}`]
      : []),
    "",
    `- Class schedules page: ${materials.discoveryPages.classSchedulesUrl}`,
    `- Catalog archive page: ${materials.discoveryPages.catalogArchiveUrl}`,
    `- Current catalog root: ${materials.currentCatalog.rootUrl}`,
    `- Current catalog year: ${materials.currentCatalog.label}`,
    `- Current course descriptions: ${materials.currentCatalog.courseDescriptionsUrl}`,
    "",
    "## Annual Schedules",
    "",
    ...materials.annualSchedules.map(
      (entry) => `- ${entry.label}: ${entry.url}`
    ),
    "",
    "## Catalog Archive Entries",
    "",
    ...materials.catalogEntries.map((entry) => `- ${entry.label}: ${entry.url}`),
    "",
  ];

  writePlannerMarkdownReport(OUTPUT_MD_PATH, lines);
}

async function discoverLiveGrcPublicMaterials() {
  const classSchedulesHtml = await fetchText(GRC_CLASS_SCHEDULES_URL);
  const discoveredAnnualSchedules = extractGrcAnnualSchedules(
    classSchedulesHtml,
    GRC_CLASS_SCHEDULES_URL
  );
  if (!discoveredAnnualSchedules.length) {
    throw new Error(`No Green River annual schedule PDFs were found on ${GRC_CLASS_SCHEDULES_URL}`);
  }

  const catalogArchiveHtml = await fetchText(GRC_CATALOG_ARCHIVE_URL);
  const catalogEntries = extractGrcCatalogArchiveEntries(catalogArchiveHtml, GRC_CATALOG_ARCHIVE_URL);
  if (!catalogEntries.length) {
    throw new Error(`No Green River catalog archive entries were found on ${GRC_CATALOG_ARCHIVE_URL}`);
  }

  const currentCatalogEntry = catalogEntries[0];
  const currentCatalogRootHtml = await fetchText(currentCatalogEntry.url);
  const currentCatalog = extractCurrentGrcCatalogDetails(
    currentCatalogRootHtml,
    currentCatalogEntry.url,
    currentCatalogEntry.label
  );
  const annualSchedules = filterRelevantAnnualSchedules(
    discoveredAnnualSchedules,
    currentCatalog.label
  );

  return {
    generatedAt: new Date().toISOString(),
    usedSnapshotFallback: false,
    snapshotFallbackReason: null,
    discoveryPages: {
      classSchedulesUrl: GRC_CLASS_SCHEDULES_URL,
      catalogArchiveUrl: GRC_CATALOG_ARCHIVE_URL,
    },
    annualSchedules,
    discoveredAnnualScheduleCount: discoveredAnnualSchedules.length,
    catalogEntries,
    currentCatalog,
  };
}

async function loadGrcPublicMaterials(options = {}) {
  const {
    forceRefresh = false,
    allowSnapshotFallback = true,
    cacheOnly = process.env.GATORGUIDE_PLANNER_CACHE_ONLY === "1",
  } = options;
  ensureTmpDir();

  const cached = loadCachedGrcPublicMaterials();
  if (cached && (!forceRefresh || cacheOnly)) {
    return cached;
  }

  if (cacheOnly) {
    throw new Error(
      `Cached Green River public-materials discovery is required in no-download mode, but ${OUTPUT_JSON_PATH} was not found. Run the normal planner refresh once to create it.`
    );
  }

  try {
    const materials = await discoverLiveGrcPublicMaterials();
    writePlannerJsonReport(OUTPUT_JSON_PATH, materials);
    writeMarkdown(materials);
    return materials;
  } catch (error) {
    if (!allowSnapshotFallback) {
      throw error;
    }

    const cached = loadCachedGrcPublicMaterials();
    if (!cached) {
      throw error;
    }

    const fallback = {
      ...cached,
      generatedAt: new Date().toISOString(),
      usedSnapshotFallback: true,
      snapshotFallbackReason: error.message,
    };
    writePlannerJsonReport(OUTPUT_JSON_PATH, fallback);
    writeMarkdown(fallback);
    return fallback;
  }
}

async function main() {
  const materials = await loadGrcPublicMaterials({
    forceRefresh: hasArg("--refresh"),
    allowSnapshotFallback: !hasArg("--no-snapshot-fallback"),
  });

  console.log(
    `Discovered ${materials.annualSchedules.length} Green River annual schedules and ${materials.catalogEntries.length} catalog archive entries.`
  );
  console.log(`Current catalog year: ${materials.currentCatalog.label}`);
  console.log(`Discovery JSON: ${OUTPUT_JSON_PATH}`);
  console.log(`Discovery Markdown: ${OUTPUT_MD_PATH}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  GRC_CLASS_SCHEDULES_URL,
  GRC_CATALOG_ARCHIVE_URL,
  GRC_CATALOG_ROOT_URL,
  OUTPUT_JSON_PATH,
  OUTPUT_MD_PATH,
  buildAnnualScheduleSnapshotPath,
  buildPagedGrcCourseDescriptionsUrl,
  compareAcademicYearLabels,
  filterRelevantAnnualSchedules,
  extractCurrentGrcCatalogDetails,
  extractGrcAnnualSchedules,
  extractGrcCatalogArchiveEntries,
  getAcademicYearStart,
  loadGrcPublicMaterials,
  sortAcademicYearLabels,
};
