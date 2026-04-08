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

const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
const {
  TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY,
  TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY,
} = require("../../constants/transfer-planner-source");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const SNAPSHOT_DIR = path.resolve(TMP_DIR, "transfer-planner-requirement-source-snapshots");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-requirement-source-parse-report.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-requirement-source-parse-report.md");
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_CONCURRENCY = 3;
const USER_AGENT = "GatorGuideTransferPlannerRequirementParser/1.0";
const COURSE_CODE_PATTERN = /\b[A-Z]{2,8}\s*\d{3}[A-Z]?\b/g;
const INVALID_EXTRACTED_COURSE_SUBJECTS = new Set([
  "AND",
  "ANY",
  "APPROVED",
  "DIVISION",
  "INTO",
  "LEAST",
  "MINIMUM",
  "OF",
  "ONE",
  "OR",
  "PLUS",
  "REACH",
  "REQUIRES",
  "THE",
  "THEN",
  "TO",
  "TOTALS",
]);
const EXTRACTED_COURSE_SUBJECT_ALIASES = {
  BIOLOGY: "BIOL",
  PHYSICS: "PHYS",
};
const REQUIREMENT_CUE_PATTERN =
  /\b(required|requirements|prereq|prerequisite|complete|credits|credit|elective|select|choose|one of the following|two of the following|option|track|route|pathway|concentration)\b/i;
const BLOCK_TAG_PATTERN = /<(?:\/?(?:p|div|section|article|li|ul|ol|table|tr|td|th|h1|h2|h3|h4|h5|h6|br))[^>]*>/gi;
const TITLE_PATTERN = /<title[^>]*>([\s\S]*?)<\/title>/i;
const HEADING_PATTERN = /<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi;
const HTML_TAG_PATTERN = /<[^>]+>/g;
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

function ensureDir(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
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

function stripHtml(value) {
  return normalizeWhitespace(decodeHtmlEntities(String(value ?? "").replace(HTML_TAG_PATTERN, " ")));
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function normalizeCourseCode(rawValue) {
  return normalizeWhitespace(String(rawValue ?? "").toUpperCase().replace(/\s+/g, " "));
}

function normalizeExtractedCourseCode(rawValue) {
  const match = String(rawValue ?? "")
    .toUpperCase()
    .match(/\b([A-Z]{2,8})\s*(\d{3}[A-Z]?)\b/);

  if (!match) {
    return null;
  }

  const rawSubject = normalizeWhitespace(match[1]).replace(/\s+/g, "");
  const subject = EXTRACTED_COURSE_SUBJECT_ALIASES[rawSubject] ?? rawSubject;

  if (INVALID_EXTRACTED_COURSE_SUBJECTS.has(subject)) {
    return null;
  }

  return `${subject} ${match[2]}`;
}

function slugify(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getStructuredUwCourseCodes(manifestEntry) {
  return uniqueSorted(
    TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY.filter(
      (block) =>
        block.planId === manifestEntry.planId &&
        ((manifestEntry.pathwayId && block.pathwayId === manifestEntry.pathwayId) ||
          (!manifestEntry.pathwayId && !block.pathwayId))
    ).flatMap((block) => block.uwCourseCodes ?? [])
  );
}

function extractCourseCodesFromText(text) {
  return uniqueSorted(
    [...String(text ?? "").matchAll(COURSE_CODE_PATTERN)]
      .map((match) => normalizeExtractedCourseCode(match[0]))
      .filter(Boolean)
  );
}

function writeSnapshot(ownerKey, sourceUrl, title, lines) {
  ensureDir(SNAPSHOT_DIR);
  const safeFileName = `${slugify(ownerKey)}.txt`;
  const outputPath = path.resolve(SNAPSHOT_DIR, safeFileName);
  const body = [
    `Owner: ${ownerKey}`,
    `Source: ${sourceUrl}`,
    `Title: ${title || ""}`,
    "",
    ...lines,
  ].join("\n");
  fs.writeFileSync(outputPath, `${body}\n`);
  return outputPath;
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
  return lines.filter((line) => REQUIREMENT_CUE_PATTERN.test(line)).slice(0, 30);
}

function extractChooseStatements(lines) {
  return lines
    .filter((line) => /\b(choose|select|one of the following|two of the following)\b/i.test(line))
    .slice(0, 20);
}

function extractPathwayLabels(lines, headings) {
  return uniqueSorted(
    [...headings, ...lines]
      .filter((line) => /\b(option|track|route|pathway|concentration)\b/i.test(line))
      .slice(0, 20)
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
    parserType === "pdf-degree-sheet"
  ) {
    return "medium";
  }

  return "low";
}

async function parseHtmlSource(entry, timeoutMs) {
  const response = await fetchWithTimeout(entry.url, timeoutMs);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const title = extractTitle(html);
  const headings = extractHeadings(html);
  const lines = buildHtmlLines(html);
  const requirementCueLines = extractRequirementCueLines(lines);
  const chooseStatements = extractChooseStatements(lines);
  const pathwayLabels = extractPathwayLabels(lines, headings);
  const courseCodes = extractCourseCodesFromText(lines.join("\n"));

  return {
    title,
    headings,
    requirementCueLines,
    chooseStatements,
    pathwayLabels,
    courseCodes,
    snapshotLines: lines.slice(0, 1200),
    parseConfidence: buildParseConfidence(courseCodes, requirementCueLines, entry.parserType),
  };
}

async function parsePdfSource(entry, timeoutMs) {
  const response = await fetchWithTimeout(entry.url, timeoutMs);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const pdfData = new Uint8Array(await response.arrayBuffer());
  const document = await pdfjs.getDocument({ data: pdfData, verbosity: 0 }).promise;
  const pageCount = document.numPages;
  const pageLines = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => normalizeWhitespace(item.str))
      .filter(Boolean)
      .join(" ");
    if (pageText) {
      pageLines.push(`[Page ${pageNumber}] ${pageText}`);
    }
  }

  const title = pageLines[0] ? normalizeWhitespace(pageLines[0].replace(/^\[Page \d+\]\s*/, "")) : null;
  const requirementCueLines = extractRequirementCueLines(pageLines);
  const chooseStatements = extractChooseStatements(pageLines);
  const pathwayLabels = extractPathwayLabels(pageLines, []);
  const courseCodes = extractCourseCodesFromText(pageLines.join("\n"));

  return {
    title,
    headings: [],
    requirementCueLines,
    chooseStatements,
    pathwayLabels,
    courseCodes,
    snapshotLines: pageLines.slice(0, 1200),
    parseConfidence: buildParseConfidence(courseCodes, requirementCueLines, entry.parserType),
  };
}

async function parseManifestEntry(entry, timeoutMs) {
  const structuredCourseCodes = getStructuredUwCourseCodes(entry);
  const baseResult = {
    ownerId: entry.ownerId,
    ownerTitle: entry.ownerTitle,
    planId: entry.planId,
    pathwayId: entry.pathwayId,
    campusId: entry.campusId,
    parserType: entry.parserType,
    sourceUrl: entry.url,
    sourceLabel: entry.label,
    structuredUwCourseCodes: structuredCourseCodes,
  };

  try {
    const parsed =
      entry.parserType === "pdf-degree-sheet" ||
      entry.parserType === "pdf-worksheet" ||
      entry.parserType === "generic-pdf"
        ? await parsePdfSource(entry, timeoutMs)
        : await parseHtmlSource(entry, timeoutMs);

    const parsedCourseCodes = uniqueSorted(parsed.courseCodes);
    const sourceOnlyCourseCodes = parsedCourseCodes.filter(
      (code) => !structuredCourseCodes.includes(code)
    );
    const structuredOnlyCourseCodes = structuredCourseCodes.filter(
      (code) => !parsedCourseCodes.includes(code)
    );
    const snapshotPath = writeSnapshot(
      entry.ownerId,
      entry.url,
      parsed.title,
      parsed.snapshotLines
    );

    return {
      ...baseResult,
      ok: true,
      extractedTitle: parsed.title,
      extractedHeadings: parsed.headings,
      requirementCueLines: parsed.requirementCueLines,
      chooseStatements: parsed.chooseStatements,
      pathwayLabels: parsed.pathwayLabels,
      parsedUwCourseCodes: parsedCourseCodes,
      sourceOnlyUwCourseCodes: sourceOnlyCourseCodes,
      structuredOnlyUwCourseCodes: structuredOnlyCourseCodes,
      parseConfidence: parsed.parseConfidence,
      snapshotPath,
      error: null,
    };
  } catch (error) {
    return {
      ...baseResult,
      ok: false,
      extractedTitle: null,
      extractedHeadings: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: [],
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: structuredCourseCodes,
      parseConfidence: "low",
      snapshotPath: null,
      error: error.message,
    };
  }
}

function getParseablePrimaryEntries() {
  return TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
    (entry) =>
      (entry.ownerType === "major" || entry.ownerType === "pathway") &&
      entry.campusId &&
      entry.campusId !== "grc" &&
      entry.isPrimaryDegreeRequirementsLink &&
      PARSEABLE_PARSER_TYPES.has(entry.parserType)
  ).sort((left, right) => left.ownerTitle.localeCompare(right.ownerTitle));
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
    `- Owners with parsed UW course codes: ${report.withParsedCourseCodesCount}`,
    `- Owners with source-only UW course codes not currently in structured degree-map blocks: ${report.withSourceOnlyCourseCodesCount}`,
    `- Owners with no parsed UW course codes: ${report.withNoParsedCourseCodesCount}`,
    "",
  ];

  for (const campusId of CAMPUS_ORDER) {
    const campusOwners = report.owners.filter((owner) => owner.campusId === campusId);
    if (!campusOwners.length) {
      continue;
    }

    lines.push(`## ${campusId}`, "");

    const driftOwners = campusOwners.filter((owner) => owner.sourceOnlyUwCourseCodes.length > 0);
    if (driftOwners.length) {
      lines.push("### Possible source-vs-structured drift", "");
      driftOwners.slice(0, 50).forEach((owner) => {
        lines.push(`#### ${owner.ownerTitle}`);
        lines.push("");
        lines.push(`- Source: ${owner.sourceUrl}`);
        lines.push(`- Parser type: ${owner.parserType}`);
        lines.push(`- Parse confidence: ${owner.parseConfidence}`);
        lines.push(`- Source-only UW course codes: ${owner.sourceOnlyUwCourseCodes.join(", ")}`);
        if (owner.structuredOnlyUwCourseCodes.length) {
          lines.push(
            `- Structured-only UW course codes not seen in the parsed source: ${owner.structuredOnlyUwCourseCodes.join(", ")}`
          );
        }
        if (owner.requirementCueLines.length) {
          lines.push(`- Requirement cues: ${owner.requirementCueLines.slice(0, 3).join(" | ")}`);
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
        lines.push(`  - Parser type: ${owner.parserType}`);
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

  const manifestEntries = getParseablePrimaryEntries();
  console.log(`Parsing ${manifestEntries.length} primary planner requirement source(s)...`);

  const owners = await mapWithConcurrency(
    manifestEntries,
    (entry) => parseManifestEntry(entry, DEFAULT_TIMEOUT_MS),
    DEFAULT_CONCURRENCY
  );

  const report = {
    generatedAt: new Date().toISOString(),
    totalOwners: owners.length,
    okCount: owners.filter((owner) => owner.ok).length,
    failedCount: owners.filter((owner) => !owner.ok).length,
    withParsedCourseCodesCount: owners.filter((owner) => owner.parsedUwCourseCodes.length > 0).length,
    withSourceOnlyCourseCodesCount: owners.filter(
      (owner) => owner.sourceOnlyUwCourseCodes.length > 0
    ).length,
    withNoParsedCourseCodesCount: owners.filter(
      (owner) => owner.ok && owner.parsedUwCourseCodes.length === 0
    ).length,
    owners,
  };

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  buildMarkdownReport(report);

  console.log(`Parsed successfully: ${report.okCount}/${report.totalOwners}`);
  console.log(
    `Owners with source-only UW course codes not in structured degree-map blocks: ${report.withSourceOnlyCourseCodesCount}`
  );
  console.log(`Owners with no parsed UW course codes: ${report.withNoParsedCourseCodesCount}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);
  console.log(`Snapshots: ${SNAPSHOT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
