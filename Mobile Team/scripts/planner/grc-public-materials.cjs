const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-grc-public-materials.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-grc-public-materials.md");

const GRC_CLASS_SCHEDULES_URL =
  "https://www.greenriver.edu/students/academics/class-schedules-catalog/index.html";
const GRC_CATALOG_ARCHIVE_URL =
  "https://www.greenriver.edu/students/academics/class-schedules-catalog/catalog-archive.html";
const GRC_CATALOG_ROOT_URL = "https://catalog.greenriver.edu/";
const USER_AGENT = "GatorGuideTransferPlannerGrcDiscovery/1.0";

function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlAttribute(value) {
  return String(value ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
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
  return path.resolve(TMP_DIR, `${label}-Annual-Schedule.pdf`);
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

  return JSON.parse(fs.readFileSync(OUTPUT_JSON_PATH, "utf8"));
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

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`, "utf8");
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
  const { forceRefresh = false, allowSnapshotFallback = true } = options;
  ensureTmpDir();

  if (!forceRefresh) {
    const cached = loadCachedGrcPublicMaterials();
    if (cached) {
      return cached;
    }
  }

  try {
    const materials = await discoverLiveGrcPublicMaterials();
    fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(materials, null, 2)}\n`, "utf8");
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
    fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
    writeMarkdown(fallback);
    return fallback;
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const materials = await loadGrcPublicMaterials({
    forceRefresh: args.has("--refresh"),
    allowSnapshotFallback: !args.has("--no-snapshot-fallback"),
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
