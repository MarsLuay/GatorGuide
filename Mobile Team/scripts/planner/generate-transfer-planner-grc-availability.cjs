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
  TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS,
  TRANSFER_PLANNER_TRACKS,
  getTransferPlannerGrcCourseList,
} = require("../../constants/transfer-planner-source");
const {
  TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA,
} = require("../../constants/transfer-planner-source/course-metadata");

const COURSE_CODE_PATTERN = /\b[A-Z]{2,6}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;
const QUARTER_KEYS = ["summer", "fall", "winter", "spring"];
const QUARTER_SOURCE_LABELS = {
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
  spring: "Spring",
};
const AVAILABILITY_STATUS_ORDER = [
  "published-in-latest-schedule",
  "published-in-recent-history-not-latest",
  "catalog-listed-not-in-latest-schedules",
  "planner-course-no-current-public-source",
  "legacy-track-only-no-current-public-source",
];
const SCHEDULES = [
  {
    label: "2024-2025",
    pdfPath: path.resolve(__dirname, "..", "..", ".tmp", "2024-2025-Annual-Schedule.pdf"),
    sourceUrl:
      "https://www.greenriver.edu/students/media/documents/schedules-and-catalog/2024-2025-Annual-Schedule.pdf",
  },
  {
    label: "2025-2026",
    pdfPath: path.resolve(__dirname, "..", "..", ".tmp", "2025-2026-Annual-Schedule.pdf"),
    sourceUrl:
      "https://www.greenriver.edu/students/media/documents/schedules-and-catalog/2025-2026%20Annual%20Schedule%20w%20Cover.pdf",
  },
];

function normalizeCourseCode(value) {
  return String(value ?? "")
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

function addExtractedCourseCodes(target, values) {
  for (const value of values ?? []) {
    for (const code of extractCourseCodes(value)) {
      target.add(code);
    }
  }
}

function collectCurrentPlannerCourseCodes() {
  const codes = new Set();

  for (const plan of TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS) {
    addExtractedCourseCodes(codes, getTransferPlannerGrcCourseList(plan));
  }

  return codes;
}

function collectCurrentTrackCourseCodes() {
  const codes = new Set();

  for (const track of TRANSFER_PLANNER_TRACKS) {
    for (const term of track.terms ?? []) {
      addExtractedCourseCodes(codes, term.courses);
    }
  }

  return codes;
}

function collectHistoricalTrackCourseCodes() {
  const codes = new Set();

  for (const track of TRANSFER_PLANNER_TRACKS) {
    for (const catalogYear of track.catalogYears ?? []) {
      for (const term of catalogYear.terms ?? []) {
        addExtractedCourseCodes(codes, term.courses);
      }

      for (const slot of catalogYear.slotExpansions ?? []) {
        addExtractedCourseCodes(codes, slot.recommendedCourses);
      }
    }
  }

  return codes;
}

function collectPlannerCourseCodes() {
  const codes = new Set();

  for (const code of collectCurrentPlannerCourseCodes()) {
    codes.add(code);
  }

  for (const code of collectCurrentTrackCourseCodes()) {
    codes.add(code);
  }

  for (const code of collectHistoricalTrackCourseCodes()) {
    codes.add(code);
  }

  return [...codes].sort((left, right) => left.localeCompare(right));
}

function collectGrcCatalogCourseCodes() {
  return new Set(
    TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA.filter((entry) => entry.schoolId === "grc").map(
      (entry) => entry.code
    )
  );
}

function normalizePdfItems(items) {
  return items
    .map((item) => ({
      str: String(item.str ?? ""),
      x: item.transform[4],
      y: item.transform[5],
    }))
    .filter((item) => item.str.trim().length > 0)
    .sort((left, right) => right.y - left.y || left.x - right.x);
}

function groupPdfRows(items) {
  const rows = [];

  for (const item of items) {
    const key = item.y.toFixed(1);
    let row = rows.find((entry) => entry.key === key);
    if (!row) {
      row = {
        key,
        y: item.y,
        items: [],
      };
      rows.push(row);
    }
    row.items.push(item);
  }

  rows.forEach((row) => {
    row.items.sort((left, right) => left.x - right.x);
  });

  rows.sort((left, right) => right.y - left.y);

  return rows;
}

function detectQuarterColumnStarts(items) {
  return items
    .filter((item) => item.str === "Start" && item.y > 540)
    .sort((left, right) => left.x - right.x)
    .slice(0, 4)
    .map((item) => item.x);
}

function detectCourseCodeFromRow(row) {
  const leftItems = row.items
    .filter((item) => item.x < 90)
    .map((item) => item.str.trim())
    .filter(Boolean);

  for (let index = 0; index < leftItems.length - 1; index += 1) {
    const subject = leftItems[index];
    const number = leftItems[index + 1];

    if (
      /^[A-Z]{2,6}&?$/.test(subject) &&
      /^\d{3}(?:\.\d+)?[A-Z]?$/.test(number)
    ) {
      return `${subject} ${number}`;
    }
  }

  return null;
}

function quarterForX(x, columnStarts) {
  for (let index = columnStarts.length - 1; index >= 0; index -= 1) {
    if (x >= columnStarts[index] - 10) {
      return QUARTER_KEYS[index];
    }
  }

  return null;
}

async function parseAnnualSchedule(schedule, trackedCourseCodes) {
  if (!fs.existsSync(schedule.pdfPath)) {
    throw new Error(
      `Missing annual schedule PDF: ${schedule.pdfPath}. Download the official schedule first.`
    );
  }

  const pdfData = new Uint8Array(fs.readFileSync(schedule.pdfPath));
  const document = await pdfjs.getDocument({
    data: pdfData,
    verbosity: 0,
  }).promise;
  const availabilityByCourse = new Map();

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const items = normalizePdfItems((await page.getTextContent()).items);
    const columnStarts = detectQuarterColumnStarts(items);

    if (columnStarts.length < 4) {
      continue;
    }

    const rows = groupPdfRows(items);
    let currentCourseCode = null;

    for (const row of rows) {
      const detectedCourseCode = detectCourseCodeFromRow(row);
      if (detectedCourseCode) {
        currentCourseCode = detectedCourseCode;
      }

      if (!currentCourseCode || !trackedCourseCodes.has(currentCourseCode)) {
        continue;
      }

      const quarterHits = new Set();

      for (const item of row.items) {
        if (item.x < columnStarts[0] - 2) {
          continue;
        }

        const quarter = quarterForX(item.x, columnStarts);
        if (quarter) {
          quarterHits.add(quarter);
        }
      }

      if (!quarterHits.size) {
        continue;
      }

      if (!availabilityByCourse.has(currentCourseCode)) {
        availabilityByCourse.set(currentCourseCode, new Set());
      }

      const courseQuarterSet = availabilityByCourse.get(currentCourseCode);
      for (const quarter of quarterHits) {
        courseQuarterSet.add(quarter);
      }
    }
  }

  return availabilityByCourse;
}

function sortQuarterKeys(quarters) {
  return [...quarters].sort(
    (left, right) => QUARTER_KEYS.indexOf(left) - QUARTER_KEYS.indexOf(right)
  );
}

function classifyAvailabilityStatus(params) {
  const {
    courseCode,
    years,
    latestPublishedQuarters,
    currentPlannerCourseCodes,
    historicalTrackCourseCodes,
    grcCatalogCourseCodes,
  } = params;
  const hasAnyPublishedHistory = years.some((year) => year.quarters.length > 0);
  const hasLatestPublishedHistory = latestPublishedQuarters.length > 0;
  const isCurrentPlannerCourse = currentPlannerCourseCodes.has(courseCode);
  const isHistoricalTrackOnly =
    historicalTrackCourseCodes.has(courseCode) && !isCurrentPlannerCourse;
  const hasCurrentCatalogEvidence = grcCatalogCourseCodes.has(courseCode);

  if (hasLatestPublishedHistory) {
    return "published-in-latest-schedule";
  }

  if (hasAnyPublishedHistory) {
    return "published-in-recent-history-not-latest";
  }

  if (hasCurrentCatalogEvidence) {
    return "catalog-listed-not-in-latest-schedules";
  }

  if (isHistoricalTrackOnly) {
    return "legacy-track-only-no-current-public-source";
  }

  return "planner-course-no-current-public-source";
}

function buildEntry(courseCode, yearlyQuarterMaps, classificationContext) {
  const years = SCHEDULES.map((schedule) => ({
    label: schedule.label,
    quarters: sortQuarterKeys(yearlyQuarterMaps.get(schedule.label) ?? []),
  }));
  const latestPublishedQuarters = years[years.length - 1]?.quarters ?? [];
  const status = classifyAvailabilityStatus({
    courseCode,
    years,
    latestPublishedQuarters,
    ...classificationContext,
  });

  return {
    status,
    years,
    latestPublishedQuarters,
  };
}

function toTypeScriptObject(value, indentLevel = 0) {
  const indent = "  ".repeat(indentLevel);
  const nextIndent = "  ".repeat(indentLevel + 1);

  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return `[\n${value
      .map((entry) => `${nextIndent}${toTypeScriptObject(entry, indentLevel + 1)}`)
      .join(",\n")}\n${indent}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return "{}";
    return `{\n${entries
      .map(([key, entry]) => {
        const renderedKey = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
          ? key
          : JSON.stringify(key);
        return `${nextIndent}${renderedKey}: ${toTypeScriptObject(
          entry,
          indentLevel + 1
        )}`;
      })
      .join(",\n")}\n${indent}}`;
  }

  return JSON.stringify(value);
}

function formatQuarterList(quarters) {
  if (!quarters.length) return "not found in latest published schedules";
  return quarters.map((quarter) => QUARTER_SOURCE_LABELS[quarter]).join(", ");
}

async function main() {
  const trackedCourseCodes = collectPlannerCourseCodes();
  const trackedCourseCodeSet = new Set(trackedCourseCodes);
  const currentPlannerCourseCodes = collectCurrentPlannerCourseCodes();
  const historicalTrackCourseCodes = collectHistoricalTrackCourseCodes();
  const grcCatalogCourseCodes = collectGrcCatalogCourseCodes();
  const yearlyAvailabilityMaps = new Map();

  for (const schedule of SCHEDULES) {
    yearlyAvailabilityMaps.set(
      schedule.label,
      await parseAnnualSchedule(schedule, trackedCourseCodeSet)
    );
  }

  const entries = Object.fromEntries(
    trackedCourseCodes.map((courseCode) => {
      const yearlyQuarterMaps = new Map(
        SCHEDULES.map((schedule) => [
          schedule.label,
          yearlyAvailabilityMaps.get(schedule.label)?.get(courseCode) ?? new Set(),
        ])
      );

      return [
        courseCode,
        buildEntry(courseCode, yearlyQuarterMaps, {
          currentPlannerCourseCodes,
          historicalTrackCourseCodes,
          grcCatalogCourseCodes,
        }),
      ];
    })
  );

  const output = `// This file is generated by scripts/planner/generate-transfer-planner-grc-availability.cjs.\n// It summarizes Green River quarter-offering history from the latest published annual schedule PDFs.\n\nexport type TransferPlannerGrcCourseAvailabilityQuarter =\n  | \"summer\"\n  | \"fall\"\n  | \"winter\"\n  | \"spring\";\n\nexport type TransferPlannerGrcCourseAvailabilityStatus =\n  | \"published-in-latest-schedule\"\n  | \"published-in-recent-history-not-latest\"\n  | \"catalog-listed-not-in-latest-schedules\"\n  | \"planner-course-no-current-public-source\"\n  | \"legacy-track-only-no-current-public-source\";\n\nexport type TransferPlannerGrcCourseAvailabilityEntry = {\n  status: TransferPlannerGrcCourseAvailabilityStatus;\n  years: {\n    label: string;\n    quarters: TransferPlannerGrcCourseAvailabilityQuarter[];\n  }[];\n  latestPublishedQuarters: TransferPlannerGrcCourseAvailabilityQuarter[];\n};\n\nexport const TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY = ${toTypeScriptObject(
    entries
  )} as const satisfies Record<string, TransferPlannerGrcCourseAvailabilityEntry>;\n\nexport const TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY_SOURCE_URLS = ${toTypeScriptObject(
    SCHEDULES.map((schedule) => schedule.sourceUrl)
  )} as const;\n`;

  const outputPath = path.resolve(
    __dirname,
    "..",
    "..",
    "constants",
    "transfer-planner-grc-availability.generated.ts"
  );
  fs.writeFileSync(outputPath, output, "utf8");

  const knownCount = Object.values(entries).filter((entry) =>
    entry.years.some((year) => year.quarters.length > 0)
  ).length;
  const statusCounts = Object.values(entries).reduce((counts, entry) => {
    counts[entry.status] = (counts[entry.status] ?? 0) + 1;
    return counts;
  }, {});

  console.log(
    `Generated ${path.relative(process.cwd(), outputPath)} with ${trackedCourseCodes.length} planner course codes.`
  );
  console.log(`  Found offering history for ${knownCount} courses.`);
  for (const status of AVAILABILITY_STATUS_ORDER) {
    console.log(`  ${status}: ${statusCounts[status] ?? 0}`);
  }
  console.log(
    `  Example: ENGR 250 -> ${formatQuarterList(entries["ENGR 250"]?.latestPublishedQuarters ?? [])}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
