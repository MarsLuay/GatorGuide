const crypto = require("crypto");
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
  TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY,
} = require("../../constants/transfer-planner-source");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const SNAPSHOT_DIR = path.resolve(TMP_DIR, "transfer-planner-catalog-snapshots");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-uw-catalog-ingest.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-uw-catalog-ingest.md");
const CATALOG_YEAR_LABEL = "current-uw-course-catalog";
const COURSE_CODE_PATTERN = /\b[A-Z][A-Z &]{0,14}\s+\d{3}(?:\.\d+)?[A-Z]?\b/g;
const CAMPUS_CONFIGS = [
  {
    schoolId: "uw-seattle",
    label: "UW Seattle",
    indexUrl: "https://www.washington.edu/students/crscat/",
  },
  {
    schoolId: "uw-bothell",
    label: "UW Bothell",
    indexUrl: "https://www.washington.edu/students/crscatb/",
  },
  {
    schoolId: "uw-tacoma",
    label: "UW Tacoma",
    indexUrl: "https://www.washington.edu/students/crscatt/",
  },
];
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
  const normalized = normalizeWhitespace(value).toUpperCase();
  const match = normalized.match(/^([A-Z][A-Z &]{0,14})\s+(\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (!match) {
    return normalized.replace(/\s+/g, " ");
  }
  return `${match[1].replace(/\s+/g, "")} ${match[2]}`;
}

function normalizeSubjectCode(value) {
  return normalizeWhitespace(value).toUpperCase().replace(/\s+/g, "");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
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

function readSnapshotFallback(snapshotPath, error, label) {
  if (!fs.existsSync(snapshotPath)) {
    throw error;
  }

  console.log(`Live ${label} fetch failed; using cached snapshot at ${snapshotPath}.`);
  console.log(`Fetch error: ${error.message}`);

  return {
    html: fs.readFileSync(snapshotPath, "utf8"),
    usedSnapshotFallback: true,
    snapshotFallbackReason: error.message,
  };
}

async function fetchTextWithSnapshot(url, snapshotPath, label) {
  try {
    const html = await fetchText(url);
    fs.writeFileSync(snapshotPath, html);
    return {
      html,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
    };
  } catch (error) {
    return readSnapshotFallback(snapshotPath, error, label);
  }
}

function collectPlannerRelevantUwCourseCodes() {
  const bySchool = new Map(CAMPUS_CONFIGS.map((config) => [config.schoolId, new Set()]));

  for (const entry of TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY) {
    if (entry.schoolId === "grc") {
      continue;
    }

    const set = bySchool.get(entry.schoolId);
    if (set) {
      set.add(normalizeCourseCode(entry.code));
    }
  }

  return bySchool;
}

function buildSubjectUrlMap(html, indexUrl) {
  const subjectMap = new Map();
  const linkPattern = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = decodeHtmlEntities(match[1]);
    const label = stripHtml(match[2]);
    const subjectMatch = label.match(/\(([A-Z][A-Z &]{0,14})\)\s*$/);
    if (!subjectMatch) {
      continue;
    }

    const subjectCode = normalizeSubjectCode(subjectMatch[1]);
    const url = new URL(href, indexUrl).toString();
    subjectMap.set(subjectCode, {
      subjectCode,
      label,
      url,
    });
  }

  return subjectMap;
}

function extractRequirementNotes(bodyText) {
  const notes = [];
  const prerequisiteMatch = bodyText.match(/Prerequisite:\s*([^]*?)(?=\s+(?:Offered:|Recommended:|Course|View course details|$))/i);
  const recommendedMatch = bodyText.match(/Recommended:\s*([^]*?)(?=\s+(?:Offered:|Prerequisite:|Course|View course details|$))/i);
  const corequisiteMatch = bodyText.match(/(?:Corequisite:|Must be taken with)\s*([^]*?)(?=\s+(?:Offered:|Prerequisite:|Recommended:|Course|View course details|$))/i);

  if (prerequisiteMatch) {
    notes.push(
      `Official UW prerequisite text: ${normalizeWhitespace(prerequisiteMatch[1])}`,
      "Source-backed prerequisite text is preserved as a note until a parser can safely normalize AND/OR/minimum-grade semantics into graph prerequisites."
    );
  }

  if (recommendedMatch) {
    notes.push(`Official UW recommended-preparation text: ${normalizeWhitespace(recommendedMatch[1])}`);
  }

  return {
    prerequisiteNotes: notes,
    corequisiteNotes: corequisiteMatch
      ? [`Official UW corequisite text: ${normalizeWhitespace(corequisiteMatch[1])}`]
      : [],
  };
}

function parseCreditLabel(value) {
  const match = String(value ?? "").match(/(\*|\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?(?:,\s*max\.\s*\d+)?)$/i);
  if (!match) {
    return null;
  }
  return normalizeWhitespace(match[1]);
}

function parseCreditValue(creditLabel) {
  const match = String(creditLabel ?? "").match(/^(\d+(?:\.\d+)?)$/);
  return match ? Number.parseFloat(match[1]) : null;
}

function parseCourseHeading(headingText) {
  const normalizedHeading = normalizeWhitespace(headingText);
  const courseMatch = normalizedHeading.match(/^([A-Z][A-Z &]{0,14}\s+\d{3}(?:\.\d+)?[A-Z]?)\s+(.+)$/);
  if (!courseMatch) {
    return null;
  }

  const code = normalizeCourseCode(courseMatch[1]);
  const tail = courseMatch[2];
  const creditMatch = tail.match(/\(([^)]*?)\)(?:\s+[A-Z][A-Za-z&, ]*)?$/);
  const creditLabel = parseCreditLabel(creditMatch?.[1] ?? null);
  const title = normalizeWhitespace(
    creditMatch ? tail.slice(0, creditMatch.index).trim() : tail
  );

  return {
    code,
    title,
    creditLabel,
    creditValue: parseCreditValue(creditLabel),
  };
}

function parseSubjectPage(html, config, subjectInfo, wantedCourseCodes) {
  const entries = [];
  const coursePattern = /<a\s+name="[^"]*">\s*<p>\s*<b>([\s\S]*?)<\/b><br\/?>([\s\S]*?)(?=<br\/?>\s*<a\s+href=|<\/p>)/gi;

  for (const match of html.matchAll(coursePattern)) {
    const heading = parseCourseHeading(stripHtml(match[1]));
    if (!heading || !wantedCourseCodes.has(heading.code)) {
      continue;
    }

    const bodyText = stripHtml(match[2]);
    const notes = extractRequirementNotes(bodyText);
    entries.push({
      schoolId: config.schoolId,
      code: heading.code,
      title: heading.title,
      creditValue: heading.creditValue,
      creditLabel: heading.creditLabel,
      catalogDescription: bodyText || null,
      prerequisiteNotes: notes.prerequisiteNotes,
      corequisiteNotes: notes.corequisiteNotes,
      effectiveYearRanges: [
        {
          startLabel: CATALOG_YEAR_LABEL,
          endLabel: null,
          note: `Parsed from the official ${config.label} course descriptions page.`,
        },
      ],
      sourceLinks: [
        {
          label: `${config.label} course descriptions (${subjectInfo.subjectCode})`,
          url: `${subjectInfo.url}#${heading.code.toLowerCase().replace(/[^a-z0-9]+/g, "")}`,
          note: "Course detail parsed from the official UW course descriptions page.",
        },
      ],
      notes: [
        `Source-backed ${config.label} catalog metadata parsed from the official UW course descriptions.`,
      ],
    });
  }

  return entries;
}

async function ingestCampus(config, relevantCodes) {
  const indexSnapshotPath = path.resolve(SNAPSHOT_DIR, `${config.schoolId}-course-index.html`);
  const indexSnapshot = await fetchTextWithSnapshot(
    config.indexUrl,
    indexSnapshotPath,
    `${config.label} course index`
  );
  const indexHtml = indexSnapshot.html;

  const subjectMap = buildSubjectUrlMap(indexHtml, config.indexUrl);
  const wantedBySubject = new Map();
  for (const code of relevantCodes) {
    const subject = normalizeSubjectCode(code.replace(/\s+\d.*$/, ""));
    if (!wantedBySubject.has(subject)) {
      wantedBySubject.set(subject, new Set());
    }
    wantedBySubject.get(subject).add(code);
  }

  const entries = [];
  const missingSubjectCodes = [];
  const parsedSubjectPages = [];

  for (const [subjectCode, wantedCourseCodes] of [...wantedBySubject.entries()].sort()) {
    const subjectInfo = subjectMap.get(subjectCode);
    if (!subjectInfo) {
      missingSubjectCodes.push(subjectCode);
      continue;
    }

    const snapshotPath = path.resolve(SNAPSHOT_DIR, `${config.schoolId}-${subjectCode.toLowerCase()}.html`);
    const subjectSnapshot = await fetchTextWithSnapshot(
      subjectInfo.url,
      snapshotPath,
      `${config.label} ${subjectCode} catalog page`
    );
    const html = subjectSnapshot.html;

    const subjectEntries = parseSubjectPage(html, config, subjectInfo, wantedCourseCodes);
    entries.push(...subjectEntries);
    parsedSubjectPages.push({
      subjectCode,
      url: subjectInfo.url,
      wantedCourseCount: wantedCourseCodes.size,
      parsedCourseCount: subjectEntries.length,
      sourceFingerprint: sha256Text(html),
      usedSnapshotFallback: subjectSnapshot.usedSnapshotFallback,
      snapshotFallbackReason: subjectSnapshot.snapshotFallbackReason,
    });
  }

  return {
    schoolId: config.schoolId,
    label: config.label,
    indexUrl: config.indexUrl,
    indexSnapshotPath,
    sourceFingerprint: sha256Text(indexHtml),
    usedIndexSnapshotFallback: indexSnapshot.usedSnapshotFallback,
    indexSnapshotFallbackReason: indexSnapshot.snapshotFallbackReason,
    subjectSnapshotFallbackCount: parsedSubjectPages.filter((entry) => entry.usedSnapshotFallback)
      .length,
    relevantCourseCount: relevantCodes.size,
    subjectCount: wantedBySubject.size,
    parsedSubjectPages,
    missingSubjectCodes,
    entries,
  };
}

function writeMarkdown(report) {
  const lines = [
    "# UW Catalog Ingest",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Planner-relevant UW courses: ${report.relevantCourseCount}`,
    `- Parsed UW catalog courses: ${report.courseCount}`,
    `- Courses with credit labels: ${report.coursesWithCreditLabels}`,
    `- Courses with prerequisite notes: ${report.coursesWithPrerequisiteNotes}`,
    `- Courses with corequisite notes: ${report.coursesWithCorequisiteNotes}`,
    "",
    "## Campuses",
    "",
  ];

  for (const campus of report.campuses) {
    lines.push(
      `- ${campus.label}: ${campus.entries.length}/${campus.relevantCourseCount} courses parsed across ${campus.parsedSubjectPages.length} subject pages`
    );
    if (campus.usedIndexSnapshotFallback || campus.subjectSnapshotFallbackCount) {
      lines.push(
        `  - Used cached snapshot fallback: ${
          campus.usedIndexSnapshotFallback ? "index" : "no index"
        }, ${campus.subjectSnapshotFallbackCount} subject page(s)`
      );
    }
    if (campus.missingSubjectCodes.length) {
      lines.push(`  - Missing subject pages: ${campus.missingSubjectCodes.slice(0, 30).join(", ")}`);
    }
  }

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

async function main() {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  const relevantCodesBySchool = collectPlannerRelevantUwCourseCodes();
  const campuses = [];
  for (const config of CAMPUS_CONFIGS) {
    campuses.push(await ingestCampus(config, relevantCodesBySchool.get(config.schoolId) ?? new Set()));
  }

  const entries = campuses
    .flatMap((campus) => campus.entries)
    .sort((left, right) => left.schoolId.localeCompare(right.schoolId) || left.code.localeCompare(right.code));
  const report = {
    generatedAt: new Date().toISOString(),
    catalogYearLabel: CATALOG_YEAR_LABEL,
    relevantCourseCount: [...relevantCodesBySchool.values()].reduce(
      (total, codes) => total + codes.size,
      0
    ),
    courseCount: entries.length,
    coursesWithCreditLabels: entries.filter((entry) => Boolean(entry.creditLabel)).length,
    coursesWithPrerequisiteNotes: entries.filter((entry) => (entry.prerequisiteNotes ?? []).length > 0)
      .length,
    coursesWithCorequisiteNotes: entries.filter((entry) => (entry.corequisiteNotes ?? []).length > 0)
      .length,
    campuses,
    entries,
  };

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeMarkdown(report);

  console.log(`Parsed ${report.courseCount} planner-relevant UW catalog courses.`);
  console.log(`UW catalog ingest JSON: ${OUTPUT_JSON_PATH}`);
  console.log(`UW catalog ingest Markdown: ${OUTPUT_MD_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
