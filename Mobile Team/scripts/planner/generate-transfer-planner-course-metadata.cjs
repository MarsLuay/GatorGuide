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
const GRC_CATALOG_INGEST_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  ".tmp",
  "transfer-planner-grc-catalog-ingest.json"
);
const UW_CATALOG_INGEST_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  ".tmp",
  "transfer-planner-uw-catalog-ingest.json"
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
      if (!entry.sourceLinks.some((link) => link.url === schedule.sourceUrl)) {
        entry.sourceLinks.push({
          label: `Green River annual schedule ${schedule.label}`,
          url: schedule.sourceUrl,
        });
      }
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

function readCatalogIngestEntries(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping ${label}; missing ${filePath}`);
    return [];
  }

  const report = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Array.isArray(report.entries) ? report.entries : [];
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).filter(Boolean))].sort();
}

function mergeRanges(left = [], right = []) {
  const byKey = new Map();
  for (const range of [...left, ...right]) {
    byKey.set(`${range.startLabel}|${range.endLabel ?? ""}|${range.note ?? ""}`, range);
  }
  return [...byKey.values()].sort((a, b) => a.startLabel.localeCompare(b.startLabel));
}

function mergeLinks(left = [], right = []) {
  const byUrl = new Map();
  for (const link of [...left, ...right]) {
    if (link?.url) {
      byUrl.set(link.url, link);
    }
  }
  return [...byUrl.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function mergeMetadataEntry(existing, incoming) {
  return {
    schoolId: existing.schoolId,
    code: existing.code,
    title: incoming.title ?? existing.title ?? null,
    creditValue:
      incoming.creditValue !== undefined && incoming.creditValue !== null
        ? incoming.creditValue
        : existing.creditValue ?? null,
    creditLabel: incoming.creditLabel ?? existing.creditLabel ?? null,
    catalogDescription: incoming.catalogDescription ?? existing.catalogDescription ?? null,
    prerequisiteCourseCodes: uniqueStrings([
      ...(existing.prerequisiteCourseCodes ?? []),
      ...(incoming.prerequisiteCourseCodes ?? []),
    ]),
    prerequisiteAlternativeCourseCodeSets: [
      ...(existing.prerequisiteAlternativeCourseCodeSets ?? []),
      ...(incoming.prerequisiteAlternativeCourseCodeSets ?? []),
    ],
    prerequisiteNotes: uniqueStrings([
      ...(existing.prerequisiteNotes ?? []),
      ...(incoming.prerequisiteNotes ?? []),
    ]),
    corequisiteCourseCodes: uniqueStrings([
      ...(existing.corequisiteCourseCodes ?? []),
      ...(incoming.corequisiteCourseCodes ?? []),
    ]),
    corequisiteAlternativeCourseCodeSets: [
      ...(existing.corequisiteAlternativeCourseCodeSets ?? []),
      ...(incoming.corequisiteAlternativeCourseCodeSets ?? []),
    ],
    corequisiteNotes: uniqueStrings([
      ...(existing.corequisiteNotes ?? []),
      ...(incoming.corequisiteNotes ?? []),
    ]),
    effectiveYearRanges: mergeRanges(existing.effectiveYearRanges, incoming.effectiveYearRanges),
    sourceLinks: mergeLinks(existing.sourceLinks, incoming.sourceLinks),
    notes: uniqueStrings([...(existing.notes ?? []), ...(incoming.notes ?? [])]),
  };
}

function pruneEntry(entry) {
  return Object.fromEntries(
    Object.entries(entry).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return true;
    })
  );
}

function mergeMetadataEntries(entries) {
  const byKey = new Map();
  for (const entry of entries) {
    const normalizedEntry = {
      ...entry,
      schoolId: entry.schoolId,
      code: normalizeCourseCode(entry.code),
    };
    const key = `${normalizedEntry.schoolId}|${normalizedEntry.code}`;
    const existing = byKey.get(key);
    byKey.set(
      key,
      existing ? mergeMetadataEntry(existing, normalizedEntry) : mergeMetadataEntry(normalizedEntry, {})
    );
  }
  return [...byKey.values()]
    .map(pruneEntry)
    .sort((left, right) => left.schoolId.localeCompare(right.schoolId) || left.code.localeCompare(right.code));
}

function chunkEntries(entries, size) {
  const chunks = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
}

function buildGeneratedCourseMetadataSource(entries) {
  const chunks = chunkEntries(entries, 80);
  const chunkDeclarations = chunks
    .map(
      (chunk, index) =>
        `const TRANSFER_PLANNER_GENERATED_COURSE_METADATA_CHUNK_${index}: unknown[] = ${JSON.stringify(chunk, null, 2)};`
    )
    .join("\n\n");
  const chunkNames = chunks
    .map((_, index) => `TRANSFER_PLANNER_GENERATED_COURSE_METADATA_CHUNK_${index}`)
    .join(",\n  ");

  return [
    "/* eslint-disable */",
    "/* auto-generated by scripts/planner/generate-transfer-planner-course-metadata.cjs */",
    "",
    'import type { TransferPlannerNormalizedCourseMetadataEntry } from "./course-metadata";',
    "",
    chunkDeclarations,
    "",
    `const TRANSFER_PLANNER_GENERATED_COURSE_METADATA_RAW: unknown[] = ([] as unknown[]).concat(\n  ${chunkNames}\n);`,
    "",
    "export const TRANSFER_PLANNER_GENERATED_COURSE_METADATA = TRANSFER_PLANNER_GENERATED_COURSE_METADATA_RAW as TransferPlannerNormalizedCourseMetadataEntry[];",
    "",
  ].join("\n");
}

function buildScheduleEntries(courseMap) {
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

  const entries = mergeMetadataEntries([
    ...buildScheduleEntries(courseMap),
    ...readCatalogIngestEntries(GRC_CATALOG_INGEST_PATH, "Green River catalog ingest"),
    ...readCatalogIngestEntries(UW_CATALOG_INGEST_PATH, "UW catalog ingest"),
  ]);
  const output = buildGeneratedCourseMetadataSource(entries);

  fs.writeFileSync(OUTPUT_PATH, output);
  console.log(`Wrote ${entries.length} generated course metadata entries to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
