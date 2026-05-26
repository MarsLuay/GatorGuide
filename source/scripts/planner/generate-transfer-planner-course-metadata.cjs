const fs = require("fs");
const Module = require("module");
const path = require("path");
const { getTmpPath } = require("../lib/tmp-layout.cjs");
const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
const ts = require("typescript");
const { loadGrcPublicMaterials } = require("./grc-public-materials.cjs");

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const OUTPUT_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "constants",
  "transfer-planner-source",
  "course-metadata.generated.ts"
);
const OUTPUT_VALUE_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "constants",
  "transfer-planner-source",
  "course-metadata.generated"
);
const LEGACY_OUTPUT_VALUE_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "constants",
  "transfer-planner-source",
  "course-metadata.generated.data.json"
);
const GRC_CATALOG_INGEST_PATH = path.resolve(
  getTmpPath(REPO_ROOT, "reports", "transfer-planner-grc-catalog-ingest.json")
);
const UW_CATALOG_INGEST_PATH = path.resolve(
  getTmpPath(REPO_ROOT, "reports", "transfer-planner-uw-catalog-ingest.json")
);
const BOOTSTRAP_GENERATED_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "constants",
  "transfer-planner-source",
  "bootstrap.generated.ts"
);
const EQUIVALENCY_GUIDE_GENERATED_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "constants",
  "transfer-planner-source",
  "equivalency-guide.generated.ts"
);
const GRC_AVAILABILITY_GENERATED_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "constants",
  "transfer-planner-grc-availability.generated.ts"
);
const EXACT_GRC_COURSE_CODE_PATTERN = /^[A-Z]{2,8}&?(?:\s+[A-Z]{2,8}&?){0,2}\s+\d{2,3}(?:\.\d+)?[A-Z]?$/;
const EXPLICIT_SPACED_SUBJECT_ALIASES = new Map([
  ["A A", "AA"],
  ["A MATH", "AMATH"],
  ["ART H", "ARTH"],
  ["CHEM E", "CHEME"],
  ["E E", "EE"],
  ["IND E", "INDE"],
  ["M E", "ME"],
]);
const RECOVERABLE_LEADING_SUBJECT_TOKENS = new Set([
  "AND",
  "AS",
  "BOTH",
  "EITHER",
  "IN",
  "OR",
  "PREREQ",
  "PREREQUISITE",
]);
const SUPPLEMENTAL_LEGACY_AVAILABILITY_STATUSES = new Set([
  "catalog-listed-not-in-latest-schedules",
  "published-in-recent-history-not-latest",
]);

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

function getCourseMetadataSubjectCode(value) {
  const match = normalizeCourseCode(value).match(/^([A-Z&]+(?: [A-Z&]+)*)\s+\d/);
  return match?.[1] ?? null;
}

function slugifyGeneratedFilePart(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCourseMetadataLookupCode(value, knownSubjectCodes) {
  const normalized = normalizeCourseCode(value);
  const match = normalized.match(/^([A-Z&]+(?: [A-Z&]+)*) (\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (!match) {
    return normalized;
  }

  let subjectTokens = match[1].split(" ").filter(Boolean);
  while (
    subjectTokens.length > 1 &&
    RECOVERABLE_LEADING_SUBJECT_TOKENS.has(subjectTokens[0])
  ) {
    const candidateTokens = subjectTokens.slice(1);
    const candidateSpacedSubject = candidateTokens.join(" ");
    const candidateCollapsedSubject = candidateTokens.join("");
    if (
      knownSubjectCodes.has(candidateSpacedSubject) ||
      knownSubjectCodes.has(candidateCollapsedSubject)
    ) {
      subjectTokens = candidateTokens;
      continue;
    }
    break;
  }

  const spacedSubject = subjectTokens.join(" ");
  const explicitAlias = EXPLICIT_SPACED_SUBJECT_ALIASES.get(spacedSubject);
  if (explicitAlias) {
    return `${explicitAlias} ${match[2]}`;
  }

  const collapsedSubject = subjectTokens.join("");
  const normalizedSubject =
    subjectTokens.every((token) => token.length === 1) ||
    (subjectTokens.length > 1 &&
      knownSubjectCodes.has(collapsedSubject) &&
      !knownSubjectCodes.has(spacedSubject))
      ? collapsedSubject
      : spacedSubject;

  return `${normalizedSubject} ${match[2]}`;
}

function getCourseMetadataPartitionKey(entry, knownSubjectCodes) {
  const lookupCode = normalizeCourseMetadataLookupCode(entry.code, knownSubjectCodes);
  const subjectCode = getCourseMetadataSubjectCode(lookupCode) ?? "unknown";
  const schoolPart = slugifyGeneratedFilePart(entry.schoolId) || "unknown-school";
  const subjectPart = slugifyGeneratedFilePart(subjectCode) || "unknown-subject";
  return `${schoolPart}-${subjectPart}`;
}

function loadGeneratedTsModule(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  }).outputText;
  const moduleInstance = new Module(filePath, module);
  moduleInstance.filename = filePath;
  moduleInstance.paths = Module._nodeModulePaths(path.dirname(filePath));
  moduleInstance._compile(transpiled, filePath);
  return moduleInstance.exports;
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
    console.warn(`Skipping missing annual schedule PDF: ${schedule.pdfPath}`);
    return;
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
    console.log(`Skipping ${label}; missing ${filePath}`);
    return [];
  }

  const report = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Array.isArray(report.entries) ? report.entries : [];
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).filter(Boolean))].sort();
}

function uniqueGrcGeneralEducationCategories(values = []) {
  const byKey = new Map();
  for (const category of values ?? []) {
    const catalogYearLabel = String(category?.catalogYearLabel ?? "").trim();
    const label = normalizeTitle(category?.label);
    const tags = uniqueStrings(category?.tags ?? []);
    if (!catalogYearLabel || !label || !tags.length) {
      continue;
    }
    byKey.set(`${catalogYearLabel}|${label}|${tags.join(",")}`, {
      catalogYearLabel,
      label,
      tags,
    });
  }
  return [...byKey.values()].sort(
    (left, right) =>
      left.catalogYearLabel.localeCompare(right.catalogYearLabel) ||
      left.label.localeCompare(right.label)
  );
}

function normalizeCoursePath(values) {
  return uniqueStrings((values ?? []).map((value) => normalizeCourseCode(value)).filter(Boolean));
}

function uniqueCoursePaths(paths) {
  const byKey = new Map();
  for (const path of paths ?? []) {
    const normalizedPath = normalizeCoursePath(path);
    if (!normalizedPath.length) {
      continue;
    }
    byKey.set(normalizedPath.join("|"), normalizedPath);
  }
  return [...byKey.values()].sort((left, right) => left.join("|").localeCompare(right.join("|")));
}

function extractStructuredRequirementPaths(courseCodes, alternativeCourseCodeSets) {
  const directPath = normalizeCoursePath(courseCodes);
  return uniqueCoursePaths([
    ...(directPath.length ? [directPath] : []),
    ...(alternativeCourseCodeSets ?? []),
  ]);
}

function materializeStructuredRequirementPaths(paths) {
  const normalizedPaths = uniqueCoursePaths(paths);
  if (normalizedPaths.length === 1) {
    return {
      courseCodes: [...normalizedPaths[0]],
      alternativeCourseCodeSets: [],
    };
  }

  return {
    courseCodes: [],
    alternativeCourseCodeSets: normalizedPaths.map((path) => [...path]),
  };
}

function mergeStructuredRequirementFields(existing, incoming, prefix) {
  const courseCodesKey = `${prefix}CourseCodes`;
  const alternativeCourseCodeSetsKey = `${prefix}AlternativeCourseCodeSets`;
  const mergedPaths = uniqueCoursePaths([
    ...extractStructuredRequirementPaths(
      existing?.[courseCodesKey],
      existing?.[alternativeCourseCodeSetsKey]
    ),
    ...extractStructuredRequirementPaths(
      incoming?.[courseCodesKey],
      incoming?.[alternativeCourseCodeSetsKey]
    ),
  ]);
  const materialized = materializeStructuredRequirementPaths(mergedPaths);

  return {
    [courseCodesKey]: materialized.courseCodes,
    [alternativeCourseCodeSetsKey]: materialized.alternativeCourseCodeSets,
  };
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
  const mergedPrerequisiteFields = mergeStructuredRequirementFields(
    existing,
    incoming,
    "prerequisite"
  );
  const mergedCorequisiteFields = mergeStructuredRequirementFields(
    existing,
    incoming,
    "corequisite"
  );

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
    grcGeneralEducationCategories: uniqueGrcGeneralEducationCategories([
      ...(existing.grcGeneralEducationCategories ?? []),
      ...(incoming.grcGeneralEducationCategories ?? []),
    ]),
    ...mergedPrerequisiteFields,
    prerequisiteNotes: uniqueStrings([
      ...(existing.prerequisiteNotes ?? []),
      ...(incoming.prerequisiteNotes ?? []),
    ]),
    ...mergedCorequisiteFields,
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

function extractExactCourseCodes(values) {
  return (values ?? [])
    .map((value) => normalizeCourseCode(value))
    .filter((value) => EXACT_GRC_COURSE_CODE_PATTERN.test(value));
}

function addPlannerSequenceSupport(sequenceSupport, courseCodes, sourceLinks) {
  for (let index = 1; index < courseCodes.length; index += 1) {
    const previousCode = courseCodes[index - 1];
    const nextCode = courseCodes[index];
    let support = sequenceSupport.get(nextCode);
    if (!support) {
      support = {
        total: 0,
        predecessors: new Map(),
      };
      sequenceSupport.set(nextCode, support);
    }

    support.total += 1;
    const existingPredecessor = support.predecessors.get(previousCode) ?? {
      count: 0,
      sourceLinks: [],
    };
    support.predecessors.set(previousCode, {
      count: existingPredecessor.count + 1,
      sourceLinks: mergeLinks(existingPredecessor.sourceLinks, sourceLinks),
    });
  }
}

function collectPlannerSequenceSupport(plans) {
  const sequenceSupport = new Map();

  for (const plan of plans ?? []) {
    addPlannerSequenceSupport(
      sequenceSupport,
      extractExactCourseCodes(plan.grcCourseList),
      plan.officialLinks ?? []
    );

    for (const pathway of plan.pathways ?? []) {
      addPlannerSequenceSupport(
        sequenceSupport,
        extractExactCourseCodes(pathway.grcCourseList),
        pathway.officialLinks ?? plan.officialLinks ?? []
      );
    }

    for (const item of [
      ...(plan.applicationChecklist ?? []),
      ...(plan.beforeEnrollmentChecklist ?? []),
      ...(plan.stayAtGrcChecklist ?? []),
    ]) {
      addPlannerSequenceSupport(
        sequenceSupport,
        extractExactCourseCodes(item.grcCourses),
        plan.officialLinks ?? []
      );
    }
  }

  return sequenceSupport;
}

function parseCreditValueFromSourceCourseLabel(value) {
  const match = String(value ?? "").match(/\((\d+(?:\.\d+)?)\)/);
  return match ? Number.parseFloat(match[1]) : null;
}

function buildSupplementalLegacyGuideEntries(existingEntries) {
  const bootstrap = loadGeneratedTsModule(BOOTSTRAP_GENERATED_PATH);
  const equivalencyGuide = loadGeneratedTsModule(EQUIVALENCY_GUIDE_GENERATED_PATH);
  const grcAvailability = loadGeneratedTsModule(GRC_AVAILABILITY_GENERATED_PATH);
  const sequenceSupport = collectPlannerSequenceSupport(
    bootstrap.TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS
  );
  const existingGrcCodes = new Set(
    existingEntries
      .filter((entry) => entry.schoolId === "grc")
      .map((entry) => normalizeCourseCode(entry.code))
  );
  const rulesByCode = new Map();

  for (const rule of equivalencyGuide.TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES ?? []) {
    if (rule.sourceSchoolId !== "grc") {
      continue;
    }

    for (const sourceCourseSet of rule.sourceCourseSets ?? []) {
      if (!Array.isArray(sourceCourseSet) || sourceCourseSet.length !== 1) {
        continue;
      }

      const code = normalizeCourseCode(sourceCourseSet[0]);
      if (!EXACT_GRC_COURSE_CODE_PATTERN.test(code)) {
        continue;
      }

      const matchingRules = rulesByCode.get(code) ?? [];
      matchingRules.push(rule);
      rulesByCode.set(code, matchingRules);
    }
  }

  const supplementalEntries = [];
  for (const [code, rules] of rulesByCode.entries()) {
    if (existingGrcCodes.has(code)) {
      continue;
    }

    const availabilityStatus =
      grcAvailability.TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY?.[code]?.status ?? null;
    if (!SUPPLEMENTAL_LEGACY_AVAILABILITY_STATUSES.has(availabilityStatus)) {
      continue;
    }

    const support = sequenceSupport.get(code);
    if (!support?.predecessors?.size) {
      continue;
    }

    const sortedPredecessors = [...support.predecessors.entries()].sort(
      (left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0])
    );
    const [predecessorCode, predecessorSupport] = sortedPredecessors[0] ?? [];
    if (!predecessorCode || !predecessorSupport) {
      continue;
    }

    if (
      predecessorSupport.count < 2 ||
      predecessorSupport.count / Math.max(1, support.total) < 0.75
    ) {
      continue;
    }

    const title =
      rules
        .map((rule) => normalizeTitle(rule.sourceCourseTitle))
        .find(Boolean) ?? null;
    const creditValue =
      rules
        .map((rule) => parseCreditValueFromSourceCourseLabel(rule.sourceCourseLabel))
        .find((value) => Number.isFinite(value)) ?? null;
    const mergedSourceLinks = mergeLinks(
      rules.flatMap((rule) => rule.sourceLinks ?? []),
      predecessorSupport.sourceLinks
    );
    const prioritizedSourceLinks = [
      ...mergedSourceLinks.filter((link) => /equivalency guide/i.test(link.label)),
      ...mergedSourceLinks.filter((link) => !/equivalency guide/i.test(link.label)).slice(0, 7),
    ];

    supplementalEntries.push(
      pruneEntry({
        schoolId: "grc",
        code,
        title,
        creditValue,
        creditLabel: creditValue != null ? String(creditValue) : null,
        prerequisiteCourseCodes: [predecessorCode],
        prerequisiteNotes: [
          `planning-order prerequisite inferred from ${predecessorSupport.count}/${support.total} published planner course lists that place ${predecessorCode} immediately before ${code} while the current public catalog no longer exposes a standalone course-description page for ${code}.`,
        ],
        effectiveYearRanges: mergeRanges(
          [],
          rules.flatMap((rule) => rule.effectiveYearRanges ?? [])
        ),
        sourceLinks: prioritizedSourceLinks,
        notes: [
          "legacy Green River metadata synthesized from official UW equivalency-guide coverage plus repeated planner ordering across published transfer-planning sources.",
        ],
      })
    );
  }

  return supplementalEntries;
}

function buildCourseMetadataGenerationModel(entries) {
  const subjectCodes = uniqueStrings(entries.map((entry) => getCourseMetadataSubjectCode(entry.code)));
  const knownSubjectCodes = new Set(subjectCodes);
  const partitions = new Map();
  const partitionIndex = {};

  for (const entry of entries) {
    const partitionKey = getCourseMetadataPartitionKey(entry, knownSubjectCodes);
    const lookupCode = normalizeCourseMetadataLookupCode(entry.code, knownSubjectCodes);
    const lookupKey = `${entry.schoolId}|${lookupCode}`;
    const simpleLookupKey = `${entry.schoolId}|${normalizeCourseCode(entry.code)}`;

    partitions.set(partitionKey, [...(partitions.get(partitionKey) ?? []), entry]);
    partitionIndex[lookupKey] = partitionKey;
    partitionIndex[simpleLookupKey] ??= partitionKey;
  }

  return {
    partitionIndex,
    partitions: new Map([...partitions.entries()].sort(([left], [right]) => left.localeCompare(right))),
    subjectCodes,
  };
}

function buildGeneratedCourseMetadataSource(model) {
  const partitionKeys = [...model.partitions.keys()];
  const partitionKeyLines = partitionKeys.map((key) => `  ${JSON.stringify(key)},`);
  const subjectCodeLines = model.subjectCodes.map((subjectCode) => `  ${JSON.stringify(subjectCode)},`);
  const partitionLoaderCases = partitionKeys.map((partitionKey) =>
    [
      `    case ${JSON.stringify(partitionKey)}:`,
      `      return require("./course-metadata.generated/entries-by-school-subject/${partitionKey}.generated.json") as TransferPlannerNormalizedCourseMetadataEntry[];`,
    ].join("\n")
  );

  return [
    "/* eslint-disable */",
    "/* auto-generated by scripts/planner/generate-transfer-planner-course-metadata.cjs */",
    "",
    'import type { TransferPlannerNormalizedCourseMetadataEntry } from "./course-metadata";',
    "",
    'const { createLazyGeneratedValue } = require("./generated-lazy") as typeof import("./generated-lazy");',
    "",
    "const EXPLICIT_SPACED_SUBJECT_ALIASES = new Map<string, string>([",
    '  ["A A", "AA"],',
    '  ["A MATH", "AMATH"],',
    '  ["ART H", "ARTH"],',
    '  ["CHEM E", "CHEME"],',
    '  ["E E", "EE"],',
    '  ["IND E", "INDE"],',
    '  ["M E", "ME"],',
    "]);",
    "",
    "const RECOVERABLE_LEADING_SUBJECT_TOKENS = new Set([",
    '  "AND",',
    '  "AS",',
    '  "BOTH",',
    '  "EITHER",',
    '  "IN",',
    '  "OR",',
    '  "PREREQ",',
    '  "PREREQUISITE",',
    "]);",
    "",
    "export const TRANSFER_PLANNER_GENERATED_COURSE_SUBJECT_CODES = [",
    subjectCodeLines.join("\n"),
    "] as const;",
    "",
    "const TRANSFER_PLANNER_GENERATED_COURSE_METADATA_PARTITION_KEYS = [",
    partitionKeyLines.join("\n"),
    "] as const;",
    "",
    "function normalizeGeneratedCourseMetadataCode(value: string | null | undefined) {",
    "  return String(value ?? \"\")",
    "    .toUpperCase()",
    "    .replace(/\\s+/g, \" \")",
    "    .trim();",
    "}",
    "",
    "function normalizeGeneratedCourseMetadataLookupCode(value: string | null | undefined) {",
    "  const normalized = normalizeGeneratedCourseMetadataCode(value);",
    "  const match = normalized.match(/^([A-Z&]+(?: [A-Z&]+)*) (\\d{3}(?:\\.\\d+)?[A-Z]?)$/);",
    "  if (!match) {",
    "    return normalized;",
    "  }",
    "",
    "  const knownSubjectCodes = new Set<string>(TRANSFER_PLANNER_GENERATED_COURSE_SUBJECT_CODES);",
    "  let subjectTokens = match[1].split(\" \").filter(Boolean);",
    "  while (",
    "    subjectTokens.length > 1 &&",
    "    RECOVERABLE_LEADING_SUBJECT_TOKENS.has(subjectTokens[0])",
    "  ) {",
    "    const candidateTokens = subjectTokens.slice(1);",
    "    const candidateSpacedSubject = candidateTokens.join(\" \");",
    "    const candidateCollapsedSubject = candidateTokens.join(\"\");",
    "    if (",
    "      knownSubjectCodes.has(candidateSpacedSubject) ||",
    "      knownSubjectCodes.has(candidateCollapsedSubject)",
    "    ) {",
    "      subjectTokens = candidateTokens;",
    "      continue;",
    "    }",
    "    break;",
    "  }",
    "",
    "  const spacedSubject = subjectTokens.join(\" \");",
    "  const explicitAlias = EXPLICIT_SPACED_SUBJECT_ALIASES.get(spacedSubject);",
    "  if (explicitAlias) {",
    "    return `${explicitAlias} ${match[2]}`;",
    "  }",
    "",
    "  const collapsedSubject = subjectTokens.join(\"\");",
    "  const normalizedSubject =",
    "    subjectTokens.every((token) => token.length === 1) ||",
    "    (subjectTokens.length > 1 &&",
    "      knownSubjectCodes.has(collapsedSubject) &&",
    "      !knownSubjectCodes.has(spacedSubject))",
    "      ? collapsedSubject",
    "      : spacedSubject;",
    "",
    "  return `${normalizedSubject} ${match[2]}`;",
    "}",
    "",
    "function getGeneratedCourseMetadataSubjectCode(value: string | null | undefined) {",
    "  const match = normalizeGeneratedCourseMetadataLookupCode(value).match(/^([A-Z&]+(?: [A-Z&]+)*)\\s+\\d/);",
    "  return match?.[1] ?? \"unknown\";",
    "}",
    "",
    "function slugifyGeneratedCourseMetadataKey(value: string | null | undefined) {",
    "  return String(value ?? \"\")",
    "    .toLowerCase()",
    "    .replace(/[^a-z0-9]+/g, \"-\")",
    "    .replace(/^-+|-+$/g, \"\");",
    "}",
    "",
    "function getTransferPlannerGeneratedCourseMetadataPartitionKey(",
    "  schoolId: string | null | undefined,",
    "  code: string | null | undefined",
    ") {",
    "  const schoolPart = slugifyGeneratedCourseMetadataKey(schoolId) || \"unknown-school\";",
    "  const subjectPart =",
    "    slugifyGeneratedCourseMetadataKey(getGeneratedCourseMetadataSubjectCode(code)) ||",
    "    \"unknown-subject\";",
    "  return `${schoolPart}-${subjectPart}`;",
    "}",
    "",
    "function loadTransferPlannerGeneratedCourseMetadataPartitionIndex() {",
    '  return require("./course-metadata.generated/partition-index.generated.json") as Record<string, string>;',
    "}",
    "",
    "const TRANSFER_PLANNER_GENERATED_COURSE_METADATA_PARTITION_INDEX =",
    "  createLazyGeneratedValue<Record<string, string>>(",
    "    loadTransferPlannerGeneratedCourseMetadataPartitionIndex,",
    "    {} as Record<string, string>",
    "  );",
    "",
    "function loadTransferPlannerGeneratedCourseMetadataPartition(partitionKey: string) {",
    "  switch (partitionKey) {",
    partitionLoaderCases.join("\n"),
    "    default:",
    "      return [] as TransferPlannerNormalizedCourseMetadataEntry[];",
    "  }",
    "}",
    "",
    "function loadTransferPlannerGeneratedCourseMetadata() {",
    "  return TRANSFER_PLANNER_GENERATED_COURSE_METADATA_PARTITION_KEYS.flatMap((partitionKey) =>",
    "    loadTransferPlannerGeneratedCourseMetadataPartition(partitionKey)",
    "  ) as TransferPlannerNormalizedCourseMetadataEntry[];",
    "}",
    "",
    "export const TRANSFER_PLANNER_GENERATED_COURSE_METADATA =",
    "  createLazyGeneratedValue<TransferPlannerNormalizedCourseMetadataEntry[]>(",
    "    loadTransferPlannerGeneratedCourseMetadata,",
    "    []",
    "  );",
    "",
    "export function getTransferPlannerGeneratedCourseMetadata() {",
    "  return TRANSFER_PLANNER_GENERATED_COURSE_METADATA;",
    "}",
    "",
    "export function getTransferPlannerGeneratedCourseMetadataEntry(",
    "  schoolId: string,",
    "  code: string",
    ") {",
    "  const normalizedSchoolId = String(schoolId ?? \"\");",
    "  const normalizedCode = normalizeGeneratedCourseMetadataLookupCode(code);",
    "  const lookupKey = `${normalizedSchoolId}|${normalizedCode}`;",
    "  const partitionKey =",
    "    TRANSFER_PLANNER_GENERATED_COURSE_METADATA_PARTITION_INDEX[lookupKey] ??",
    "    getTransferPlannerGeneratedCourseMetadataPartitionKey(normalizedSchoolId, normalizedCode);",
    "  return (",
    "    loadTransferPlannerGeneratedCourseMetadataPartition(partitionKey).find(",
    "      (entry) =>",
    "        entry.schoolId === normalizedSchoolId &&",
    "        normalizeGeneratedCourseMetadataLookupCode(entry.code) === normalizedCode",
    "    ) ?? null",
    "  );",
    "}",
    "",
    "export function getTransferPlannerGeneratedCourseSubjectCodes() {",
    "  return [...TRANSFER_PLANNER_GENERATED_COURSE_SUBJECT_CODES];",
    "}",
    "",
  ].join("\n");
}

function writeGeneratedCourseMetadataValueFiles(model) {
  fs.rmSync(OUTPUT_VALUE_DIR, { recursive: true, force: true });
  fs.rmSync(LEGACY_OUTPUT_VALUE_PATH, { force: true });
  fs.mkdirSync(OUTPUT_VALUE_DIR, { recursive: true });

  fs.writeFileSync(
    path.join(OUTPUT_VALUE_DIR, "partition-index.generated.json"),
    `${JSON.stringify(model.partitionIndex)}\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(OUTPUT_VALUE_DIR, "subject-codes.generated.json"),
    `${JSON.stringify(model.subjectCodes)}\n`,
    "utf8"
  );

  const partitionDir = path.join(OUTPUT_VALUE_DIR, "entries-by-school-subject");
  fs.mkdirSync(partitionDir, { recursive: true });
  for (const [partitionKey, partitionEntries] of model.partitions.entries()) {
    fs.writeFileSync(
      path.join(partitionDir, `${partitionKey}.generated.json`),
      `${JSON.stringify(partitionEntries)}\n`,
      "utf8"
    );
  }
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
  const grcPublicMaterials = await loadGrcPublicMaterials({
    forceRefresh: false,
    allowSnapshotFallback: true,
  });
  const schedules = grcPublicMaterials.annualSchedules.map((entry) => ({
    label: entry.label,
    pdfPath: entry.outputPath,
    sourceUrl: entry.url,
  }));
  const courseMap = new Map();
  for (const schedule of schedules) {
    await parseSchedule(schedule, courseMap);
  }

  const baseEntries = [
    ...buildScheduleEntries(courseMap),
    ...readCatalogIngestEntries(GRC_CATALOG_INGEST_PATH, "Green River catalog ingest"),
    ...readCatalogIngestEntries(UW_CATALOG_INGEST_PATH, "UW catalog ingest"),
  ];
  const entries = mergeMetadataEntries([
    ...baseEntries,
    ...buildSupplementalLegacyGuideEntries(baseEntries),
  ]);
  const generationModel = buildCourseMetadataGenerationModel(entries);
  const output = buildGeneratedCourseMetadataSource(generationModel);

  writeGeneratedCourseMetadataValueFiles(generationModel);
  fs.writeFileSync(OUTPUT_PATH, output);
  console.log(`Wrote ${entries.length} generated course metadata entries to ${OUTPUT_PATH}`);
  console.log(`Wrote generated course metadata values to ${OUTPUT_VALUE_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
