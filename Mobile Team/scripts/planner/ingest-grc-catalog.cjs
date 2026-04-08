const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  buildPagedGrcCourseDescriptionsUrl,
  loadGrcPublicMaterials,
} = require("./grc-public-materials.cjs");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const SNAPSHOT_DIR = path.resolve(TMP_DIR, "transfer-planner-catalog-snapshots");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-grc-catalog-ingest.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-grc-catalog-ingest.md");

const ENTITY_MAP = {
  amp: "&",
  apos: "'",
  nbsp: " ",
  quot: '"',
  "#39": "'",
  "#160": " ",
  "#8211": "-",
  "#8212": "-",
  "#8217": "'",
};

function decodeHtmlEntities(value) {
  return String(value ?? "").replace(/&(?:amp|apos|nbsp|quot|#39|#160|#8211|#8212|#8217);/gi, (match) => {
    const key = match.slice(1, -1).toLowerCase();
    return ENTITY_MAP[key] ?? match;
  });
}

function normalizeWhitespace(value) {
  return decodeHtmlEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value) {
  return normalizeWhitespace(String(value ?? "").replace(/<[^>]+>/g, " "));
}

function normalizeCourseCode(value) {
  return normalizeWhitespace(value)
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getCatalogSnapshotPath(catalogYearLabel) {
  return path.resolve(
    SNAPSHOT_DIR,
    `grc-course-descriptions-${catalogYearLabel}.html`
  );
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "GatorGuideTransferPlannerCatalogIngest/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function readSnapshotFallback(snapshotPath, error) {
  if (!fs.existsSync(snapshotPath)) {
    throw error;
  }

  console.log(
    `Live Green River catalog fetch failed; using cached snapshot at ${snapshotPath}.`
  );
  console.log(`Fetch error: ${error.message}`);

  return {
    html: fs.readFileSync(snapshotPath, "utf8"),
    usedSnapshotFallback: true,
    snapshotFallbackReason: error.message,
  };
}

async function fetchCatalogHtml(courseDescriptionsExpandedUrl, snapshotPath) {
  try {
    const firstPageHtml = await fetchText(courseDescriptionsExpandedUrl);
    const pageNumbers = detectCatalogPageNumbers(firstPageHtml);
    const pageHtmls = [];
    for (const pageNumber of pageNumbers) {
      const html =
        pageNumber === 1
          ? firstPageHtml
          : await fetchText(buildPagedCourseDescriptionUrl(courseDescriptionsExpandedUrl, pageNumber));
      pageHtmls.push({ pageNumber, html });
    }

    const html = pageHtmls.map((page) => page.html).join("\n");
    fs.writeFileSync(snapshotPath, html);

    return {
      html,
      pageCount: pageHtmls.length,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
    };
  } catch (error) {
    const fallback = readSnapshotFallback(snapshotPath, error);
    return {
      html: fallback.html,
      pageCount: detectCatalogPageNumbers(fallback.html).length,
      usedSnapshotFallback: fallback.usedSnapshotFallback,
      snapshotFallbackReason: fallback.snapshotFallbackReason,
    };
  }
}

function buildPagedCourseDescriptionUrl(courseDescriptionsExpandedUrl, pageNumber) {
  return buildPagedGrcCourseDescriptionsUrl(courseDescriptionsExpandedUrl, pageNumber);
}

function detectCatalogPageNumbers(html) {
  const pageNumbers = new Set([1]);
  for (const match of html.matchAll(/filter%5Bcpage%5D=(\d+)/g)) {
    pageNumbers.add(Number.parseInt(match[1], 10));
  }
  const maxPageNumber = Math.max(...pageNumbers);
  if (Number.isFinite(maxPageNumber) && maxPageNumber > 1) {
    for (let pageNumber = 1; pageNumber <= maxPageNumber; pageNumber += 1) {
      pageNumbers.add(pageNumber);
    }
  }
  return [...pageNumbers].filter(Number.isFinite).sort((left, right) => left - right);
}

function extractLabeledSectionText(rawBody, label) {
  const pattern = new RegExp(
    `<strong>\\s*${label}\\s*:<\\/strong>([\\s\\S]*?)(?=<br\\s*\\/?>\\s*<br\\s*\\/?>\\s*<strong>|<strong>\\s*(?:Course Fee|Course Outcomes|Program Outcomes|College-wide Outcomes)\\s*:<\\/strong>|$)`,
    "i"
  );
  const match = rawBody.match(pattern);
  return match ? stripHtml(match[1]) : null;
}

function extractCredits(rawBody) {
  const match = rawBody.match(/Credits:\s*([^<\r\n]+)/i);
  const creditLabel = match ? normalizeWhitespace(match[1]) : null;
  const numericMatch = creditLabel?.match(/^(\d+(?:\.\d+)?)$/);
  return {
    creditLabel,
    creditValue: numericMatch ? Number.parseFloat(numericMatch[1]) : null,
  };
}

function extractCourseDescription(rawBody) {
  const withoutCredits = rawBody.replace(/^\s*Credits:\s*[^<\r\n]+/i, "");
  const beforeRequirement = withoutCredits.split(/<br\s*\/?>\s*<br\s*\/?>\s*<strong>\s*(?:Enrollment Requirement|Course Fee|Course Outcomes|Program Outcomes|College-wide Outcomes)\s*:/i)[0];
  const description = stripHtml(beforeRequirement);
  return description || null;
}

function buildCourseEntries(html, catalogYearLabel, courseDescriptionsSourceUrl) {
  const headingPattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const headings = [...html.matchAll(headingPattern)];
  const entries = [];

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const nextHeading = headings[index + 1];
    const headingText = stripHtml(heading[1]);
    const titleMatch = headingText.match(/^(.+?)\s+-\s+(.+)$/);

    if (!titleMatch) {
      continue;
    }

    const rawCode = normalizeCourseCode(titleMatch[1]);
    const title = normalizeWhitespace(titleMatch[2]);
    if (!/^[A-Z0-9 &]+\s+\d{1,3}(?:\.\d+)?[A-Z]?$/.test(rawCode)) {
      continue;
    }

    const bodyStart = heading.index + heading[0].length;
    const bodyEnd = nextHeading?.index ?? html.length;
    const rawBody = html.slice(bodyStart, bodyEnd);
    const credits = extractCredits(rawBody);
    const enrollmentRequirement = extractLabeledSectionText(rawBody, "Enrollment Requirement");
    const corequisiteRequirement = extractLabeledSectionText(rawBody, "Corequisite");
    const description = extractCourseDescription(rawBody);
    const sourceUrl = `${courseDescriptionsSourceUrl}#${rawCode
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}`;

    entries.push({
      schoolId: "grc",
      code: rawCode,
      title,
      creditValue: credits.creditValue,
      creditLabel: credits.creditLabel,
      catalogDescription: description,
      prerequisiteNotes: enrollmentRequirement
        ? [
            `Official Green River enrollment requirement text: ${enrollmentRequirement}`,
            "Source-backed requirement text is preserved as a note until a parser can safely normalize AND/OR/instructor-consent semantics into graph prerequisites.",
          ]
        : [],
      corequisiteNotes: corequisiteRequirement
        ? [`Official Green River corequisite text: ${corequisiteRequirement}`]
        : [],
      effectiveYearRanges: [
        {
          startLabel: catalogYearLabel,
          endLabel: catalogYearLabel,
          note: "Parsed from the official Green River online catalog course descriptions.",
        },
      ],
      sourceLinks: [
        {
          label: `Green River online catalog course descriptions ${catalogYearLabel}`,
          url: sourceUrl,
          note: "Course detail parsed from the official Green River catalog course descriptions page.",
        },
      ],
      notes: [
        "Source-backed Green River catalog metadata parsed from the official online course descriptions.",
      ],
    });
  }

  return entries.sort((left, right) => left.code.localeCompare(right.code));
}

function writeMarkdown(report) {
  const lines = [
    "# Green River Catalog Ingest",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: ${report.sourceUrl}`,
    `Catalog year: ${report.catalogYearLabel}`,
    `Source fingerprint: ${report.sourceFingerprint}`,
    "",
    `- Catalog pages parsed: ${report.pageCount}`,
    `- Used cached snapshot fallback: ${report.usedSnapshotFallback ? "yes" : "no"}`,
    ...(report.snapshotFallbackReason ? [`- Snapshot fallback reason: ${report.snapshotFallbackReason}`] : []),
    `- Courses parsed: ${report.courseCount}`,
    `- Courses with credit labels: ${report.coursesWithCreditLabels}`,
    `- Courses with enrollment requirement notes: ${report.coursesWithEnrollmentRequirementNotes}`,
    `- Courses with corequisite notes: ${report.coursesWithCorequisiteNotes}`,
    "",
  ];

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

async function main() {
  const grcPublicMaterials = await loadGrcPublicMaterials({
    forceRefresh: false,
    allowSnapshotFallback: true,
  });
  const { currentCatalog } = grcPublicMaterials;
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  const snapshotPath = getCatalogSnapshotPath(currentCatalog.label);
  const catalogHtml = await fetchCatalogHtml(
    currentCatalog.courseDescriptionsExpandedUrl,
    snapshotPath
  );
  const html = catalogHtml.html;

  const entries = buildCourseEntries(
    html,
    currentCatalog.label,
    currentCatalog.courseDescriptionsUrl
  );
  const report = {
    generatedAt: new Date().toISOString(),
    sourceUrl: currentCatalog.courseDescriptionsUrl,
    expandedSourceUrl: currentCatalog.courseDescriptionsExpandedUrl,
    pageCount: catalogHtml.pageCount,
    snapshotPath,
    usedSnapshotFallback: catalogHtml.usedSnapshotFallback,
    snapshotFallbackReason: catalogHtml.snapshotFallbackReason,
    catalogYearLabel: currentCatalog.label,
    sourceFingerprint: sha256Text(html),
    courseCount: entries.length,
    coursesWithCreditLabels: entries.filter((entry) => Boolean(entry.creditLabel)).length,
    coursesWithEnrollmentRequirementNotes: entries.filter(
      (entry) => (entry.prerequisiteNotes ?? []).length > 0
    ).length,
    coursesWithCorequisiteNotes: entries.filter((entry) => (entry.corequisiteNotes ?? []).length > 0)
      .length,
    entries,
  };

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeMarkdown(report);

  console.log(`Parsed ${report.courseCount} Green River catalog courses.`);
  console.log(`Catalog ingest JSON: ${OUTPUT_JSON_PATH}`);
  console.log(`Catalog ingest Markdown: ${OUTPUT_MD_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
