const fs = require("fs");
const path = require("path");
const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");

const OUTPUT_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "constants",
  "transfer-planner-source",
  "course-metadata.generated.ts"
);

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

const HEADING_STOP_WORDS = new Set([
  "Course",
  "Long Title",
  "Course Offering",
  "Page",
  "Green River College",
  "Summer",
  "Fall",
  "Winter",
  "Spring",
  "Start",
  "End",
  "Days",
  "CM",
  "Loc",
]);

function normalizeCourseCode(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([/&,-])/g, "$1")
    .trim();
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
      row = { key, y: item.y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }

  rows.forEach((row) => row.items.sort((left, right) => left.x - right.x));
  rows.sort((left, right) => right.y - left.y);

  return rows;
}

function detectCourseCodeFromRow(row) {
  const leftItems = row.items
    .filter((item) => item.x < 85)
    .map((item) => item.str.trim())
    .filter(Boolean);

  for (let index = 0; index < leftItems.length - 1; index += 1) {
    const subject = leftItems[index];
    const number = leftItems[index + 1];

    if (/^[A-Z]{2,8}&?$/.test(subject) && /^\d{3}(?:\.\d+)?[A-Z]?$/.test(number)) {
      return `${subject} ${number}`;
    }
  }

  return null;
}

function extractTitleFromRow(row) {
  const title = normalizeTitle(
    row.items
      .filter((item) => item.x >= 85 && item.x < 235)
      .map((item) => item.str.trim())
      .join(" ")
  );

  if (!title || HEADING_STOP_WORDS.has(title)) {
    return null;
  }

  return title;
}

function getOrCreate(map, key) {
  const current = map.get(key);
  if (current) return current;
  const created = {
    schoolId: "grc",
    code: key,
    title: null,
    effectiveYearRanges: [],
    sourceLinks: [],
    notes: new Set(),
    titleCandidates: new Set(),
    yearLabels: new Set(),
  };
  map.set(key, created);
  return created;
}

async function parseSchedule(schedule, courseMap) {
  if (!fs.existsSync(schedule.pdfPath)) {
    throw new Error(`Missing annual schedule PDF: ${schedule.pdfPath}`);
  }

  const pdfData = new Uint8Array(fs.readFileSync(schedule.pdfPath));
  const document = await pdfjs.getDocument({ data: pdfData, verbosity: 0 }).promise;

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const rows = groupPdfRows(normalizePdfItems((await page.getTextContent()).items));

    for (const row of rows) {
      const code = detectCourseCodeFromRow(row);
      const title = extractTitleFromRow(row);
      if (!code || !title) continue;

      const normalizedCode = normalizeCourseCode(code);
      const entry = getOrCreate(courseMap, normalizedCode);
      entry.titleCandidates.add(title);
      entry.yearLabels.add(schedule.label);
      entry.notes.add(
        "Schedule-display title from the official Green River annual schedules. Some longer course names may reflect printed schedule abbreviations rather than full catalog wording."
      );
      entry.sourceLinks = [
        {
          label: `Green River annual schedule ${schedule.label}`,
          url: schedule.sourceUrl,
        },
      ];
    }
  }
}

function chooseBestTitle(titleCandidates) {
  return [...titleCandidates]
    .sort((left, right) => right.length - left.length || left.localeCompare(right))[0]
    ?? null;
}

function buildRangesFromLabels(labels) {
  const sorted = [...labels].sort();
  return sorted.map((label) => ({
    startLabel: label,
    endLabel: label,
    note: "Observed in the official Green River annual schedule for this academic year.",
  }));
}

function toSerializableEntries(courseMap) {
  return [...courseMap.values()]
    .map((entry) => ({
      schoolId: "grc",
      code: entry.code,
      title: chooseBestTitle(entry.titleCandidates),
      effectiveYearRanges: buildRangesFromLabels(entry.yearLabels),
      sourceLinks: entry.sourceLinks,
      notes: [...entry.notes],
    }))
    .filter((entry) => entry.title)
    .sort((left, right) => left.code.localeCompare(right.code));
}

async function main() {
  const courseMap = new Map();
  for (const schedule of SCHEDULES) {
    await parseSchedule(schedule, courseMap);
  }

  const entries = toSerializableEntries(courseMap);
  const output = `/* eslint-disable */\n/* auto-generated by scripts/planner/generate-transfer-planner-course-metadata.cjs */\n\nimport type { TransferPlannerNormalizedCourseMetadataEntry } from "./course-metadata";\n\nexport const TRANSFER_PLANNER_GENERATED_COURSE_METADATA: TransferPlannerNormalizedCourseMetadataEntry[] = ${JSON.stringify(entries, null, 2)};\n`;

  fs.writeFileSync(OUTPUT_PATH, output);
  console.log(`Wrote ${entries.length} generated course metadata entries to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
