/* global __dirname */

const fs = require("fs");
const path = require("path");

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "Node16",
  moduleResolution: "node16",
  jsx: "react-jsx",
  baseUrl: ".",
  paths: {
    "@/*": ["./*"],
  },
});

require("ts-node/register/transpile-only");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "student-runtime.generated.ts"
);
const OUTPUT_VALUE_DIR = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "student-runtime.generated"
);

const {
  TRANSFER_PLANNER_CAMPUSES,
  TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY,
  TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY,
  TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_REGISTRY,
  TRANSFER_PLANNER_GAP_REGISTRY,
  TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS,
  TRANSFER_PLANNER_TRACKS,
  getTransferPlannerProgramApprovedCourseFilterDefinition,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerStudentRuntimeMajorsForCampus,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  isTransferPlannerStudentHiddenSourceGap,
  resolveTransferPlannerMajorPlan,
} = require("../../constants/transfer-planner-source");
const {
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS,
} = require("../../constants/transfer-planner-source/bootstrap.generated");
const {
  normalizeTransferPlannerPathwayId,
} = require("../../constants/transfer-planner-source/pathway-id-normalization");
const {
  applyTransferPlannerManualSourceLinkOverride,
} = require("../../constants/transfer-planner-source/manual-source-link-overrides");

const COURSE_CODE_PATTERN = /\b[A-Z]{2,8}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/;
const RUNTIME_EQUIVALENT_COURSE_CODE_PATTERN =
  /\b(?:[A-Z]{2,8}&?|[A-Z]\s+[A-Z])\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;
const REQUIRED_COURSE_SEMANTIC_RELATION_PATTERN =
  /\bCourse (?:equivalent to|overlaps with):\s*([^.]*)/i;
const COURSE_SEMANTIC_RELATION_PATTERN =
  /\bCourse (?:equivalent to|overlaps with):\s*([^.]*)/gi;
const RUNTIME_REQUIRED_CORE_ROW_HINT_PATTERN =
  /\b(?:intro(?:duction)?|principles|mechanics|systems?|case studies|balances|chemistry|physics|biology|calculus|linear algebra|differential equations|statistics|thermodynamics|programming|communication|composition|concept|tools|sustainability)\b/i;
const RUNTIME_NON_REQUIRED_HINT_PATTERN =
  /\b(?:choose|select|electives?|course list|technical elective|recommended|suggested|may count|study abroad|taken\s+[A-Z]{3})\b/i;
const UW_TACOMA_SET_UNDERGRAD_PROGRAM_URL_PATTERN =
  /^https?:\/\/(?:www\.)?tacoma\.uw\.edu\/set\/programs\/undergrad\/[^/?#]+/i;
const ADMISSION_PREP_SOURCE_ROLES = new Set([
  "admission-prerequisite-source",
  "admissions-preparation",
]);
const ADMISSION_PREP_GUIDE_TARGET_COURSE_ALIASES = new Map([
  ["BBIO 180", ["BIOL 180"]],
  ["BBIO 200", ["BIOL 200"]],
  ["BBIO 220", ["BIOL 220"]],
  ["BCHEM 143", ["CHEM 142"]],
  ["BCHEM 144", ["CHEM 142"]],
  ["BCHEM 153", ["CHEM 152"]],
  ["BCHEM 154", ["CHEM 152"]],
  ["BCHEM 163", ["CHEM 162"]],
  ["BCHEM 164", ["CHEM 162"]],
  ["BPHYS 121", ["PHYS 121"]],
  ["BPHYS 122", ["PHYS 122"]],
  ["BPHYS 123", ["PHYS 123"]],
  ["CHEM 143", ["CHEM 142"]],
  ["CHEM 145", ["CHEM 142"]],
  ["CHEM 153", ["CHEM 152"]],
  ["CHEM 155", ["CHEM 152"]],
  ["CHEM 165", ["CHEM 162"]],
  ["MATH 134", ["MATH 124"]],
  ["MATH 135", ["MATH 125"]],
  ["MATH 136", ["MATH 126"]],
  ["STMATH 124", ["MATH 124"]],
  ["STMATH 125", ["MATH 125"]],
  ["STMATH 126", ["MATH 126"]],
]);
const BOTHELL_CAMPUS_ALIAS_GUIDE_TARGET_COURSE_ALIASES = new Map([
  ...ADMISSION_PREP_GUIDE_TARGET_COURSE_ALIASES,
  ["BCHEM 237", ["CHEM 237"]],
  ["BCHEM 238", ["CHEM 238"]],
  ["BCHEM 239", ["CHEM 239"]],
  ["BCHEM 241", ["CHEM 241"]],
  ["BCHEM 242", ["CHEM 242"]],
  ["BPHYS 114", ["PHYS 114"]],
  ["BPHYS 115", ["PHYS 115"]],
  ["BPHYS 116", ["PHYS 116"]],
  ["BPHYS 117", ["PHYS 117"]],
  ["BPHYS 118", ["PHYS 118"]],
  ["BPHYS 119", ["PHYS 119"]],
  ["BPHYS 121", ["PHYS 121"]],
  ["BPHYS 122", ["PHYS 122"]],
  ["BPHYS 123", ["PHYS 123"]],
  ["STMATH 207", ["MATH 207"]],
  ["STMATH 208", ["MATH 208"]],
  ["STMATH 224", ["MATH 224"]],
]);
const BOTHELL_SOURCE_BACKED_ALIAS_SEQUENCE_DEFINITIONS = [
  {
    id: "organic-chemistry-series",
    title: "B CHEM 237, B CHEM 238/241, and B CHEM 239/242 Organic Chemistry series",
    requiredCourseCodes: ["BCHEM 237", "BCHEM 238", "BCHEM 239", "BCHEM 241", "BCHEM 242"],
    cuePattern: /\bOrganic Chemistry (?:I|II|III)\b/i,
  },
  {
    id: "physics-series-choice",
    title: "Physics series",
    requiredCourseCodes: [
      "BPHYS 114",
      "BPHYS 115",
      "BPHYS 116",
      "BPHYS 117",
      "BPHYS 118",
      "BPHYS 119",
      "BPHYS 121",
      "BPHYS 122",
      "BPHYS 123",
    ],
    optionCourseCodeGroups: [
      {
        label: "B PHYS 121, B PHYS 122, and B PHYS 123 calculus-based Physics series",
        courseCodes: ["BPHYS 121", "BPHYS 122", "BPHYS 123"],
      },
      {
        label: "B PHYS 114/117, B PHYS 115/118, and B PHYS 116/119 algebra-based Physics series",
        courseCodes: [
          "BPHYS 114",
          "BPHYS 117",
          "BPHYS 115",
          "BPHYS 118",
          "BPHYS 116",
          "BPHYS 119",
        ],
      },
    ],
    cuePattern: /\bChoose one of the following three-course series options\b/i,
  },
  {
    id: "mathematics-one-course-choice",
    title: "STMATH 207, STMATH 208, STMATH 224, or STMATH 341 Mathematics option",
    requiredCourseCodes: ["STMATH 207", "STMATH 208", "STMATH 224"],
    unmappedCourseCodes: ["STMATH 341"],
    optionCourseCodeGroups: [
      {
        label: "STMATH 207 Introduction to Differential Equations",
        courseCodes: ["STMATH 207"],
      },
      {
        label: "STMATH 208 Matrix Algebra with Applications",
        courseCodes: ["STMATH 208"],
      },
      {
        label: "STMATH 224 Multivariable Calculus",
        courseCodes: ["STMATH 224"],
      },
    ],
    cuePattern: /\bAny ONE of the following courses to be selected\b/i,
  },
];

function normalizeCourseCode(value) {
  return String(value ?? "").toUpperCase().replace(/\s+/g, " ").trim();
}

function slugifyRuntimeId(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCourseLevel(value) {
  const match = normalizeCourseCode(value).match(/(\d{3})(?:\.\d+)?[A-Z]?$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function uniqueBy(values, getKey) {
  const map = new Map();
  for (const value of values) {
    const key = getKey(value);
    if (!key || map.has(key)) continue;
    map.set(key, value);
  }
  return [...map.values()];
}

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, sanitizeValue(entryValue)])
  );
}

function normalizeRuntimePathwayId(planId, pathwayId) {
  return pathwayId == null ? null : normalizeTransferPlannerPathwayId(planId, pathwayId);
}

const RUNTIME_PATHWAY_IDS_TO_HIDE_BY_PLAN_ID = new Map([
  [
    "uw-seattle-english-language-literature-and-culture",
    new Set([
      "creative-writing-option",
      "except-for-students-completing-the-creative-writing-concentration",
    ]),
  ],
]);

const RUNTIME_PATHWAY_ORDER_BY_PLAN_ID = new Map([
  [
    "uw-seattle-english-language-literature-and-culture",
    ["culture-option", "language-and-literature-option"],
  ],
  [
    "uw-seattle-geography",
    [
      "cities-citizenship-and-migration-track",
      "environment-economy-and-sustainability-track",
      "globalization-health-and-development-track",
      "gis-mapping-and-society-track",
      "geography-major-data-science-option",
    ],
  ],
]);

const ADDITIONAL_RUNTIME_PATHWAYS_BY_PLAN_ID = new Map([
  [
    "uw-seattle-geography",
    [
      {
        id: "globalization-health-and-development-track",
        label: "Globalization, Health, and Development track",
        summary: "",
      },
    ],
  ],
]);

const STRICT_PATHWAY_COURSE_BUCKET_PLAN_IDS = new Set([
  "uw-seattle-environmental-science-and-terrestrial-resource-management",
]);

const RUNTIME_PATHWAY_SCOPED_SOURCE_PLAN_IDS = new Set([
  "uw-seattle-chemistry",
  "uw-seattle-psychology",
  "uw-seattle-public-health-global-health",
  "uw-seattle-slavic-languages-and-literatures",
  "uw-tacoma-bachelor-of-arts-in-business-administration",
]);

const RUNTIME_PATHWAY_SOURCE_URL_HINTS_BY_PLAN_ID = new Map([
  [
    "uw-seattle-geography",
    [
      {
        sourceUrlIncludes: "/ba-geography-data-science-option",
        pathwayId: "geography-major-data-science-option",
      },
    ],
  ],
]);

function normalizeRuntimePathwayDisplayLabel(value) {
  return String(value ?? "")
    .replace(/\b(?:B\.?\s*[AS]|option|track|pathway)\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeRuntimePathwaysForPlan(planId, pathways) {
  const hiddenPathwayIds = RUNTIME_PATHWAY_IDS_TO_HIDE_BY_PLAN_ID.get(planId) ?? new Set();
  const order = RUNTIME_PATHWAY_ORDER_BY_PLAN_ID.get(planId) ?? [];
  const orderRank = new Map(order.map((pathwayId, index) => [pathwayId, index]));
  const additionalPathways = ADDITIONAL_RUNTIME_PATHWAYS_BY_PLAN_ID.get(planId) ?? [];

  return uniqueBy(
    [
      ...(pathways ?? []),
      ...additionalPathways,
    ].filter((pathway) => !hiddenPathwayIds.has(pathway.id)),
    (pathway) => pathway.id
  ).sort((left, right) => {
    const leftRank = orderRank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = orderRank.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return 0;
  });
}

function getRuntimePathwayIdFromOwnerId(planId, ownerId) {
  const normalizedPlanId = String(planId ?? "").trim();
  const normalizedOwnerId = String(ownerId ?? "").trim();
  const pathwayMarker = ":pathway:";
  const pathwayMarkerIndex = normalizedOwnerId.indexOf(pathwayMarker);
  if (!normalizedPlanId || pathwayMarkerIndex < 0) {
    return null;
  }

  const ownerPlanId = normalizedOwnerId.slice(0, pathwayMarkerIndex);
  if (ownerPlanId !== normalizedPlanId) {
    return null;
  }

  const pathwayId = normalizedOwnerId.slice(pathwayMarkerIndex + pathwayMarker.length);
  return pathwayId ? normalizeRuntimePathwayId(normalizedPlanId, pathwayId) : null;
}

function getRuntimePathwayIdFromSourceUrl(planId, sourceUrl) {
  const normalizedPlanId = String(planId ?? "").trim();
  const normalizedSourceUrl = String(sourceUrl ?? "").trim();
  if (!normalizedPlanId || !normalizedSourceUrl) {
    return null;
  }

  const sourceUrlHints = RUNTIME_PATHWAY_SOURCE_URL_HINTS_BY_PLAN_ID.get(normalizedPlanId) ?? [];
  const matchedHint = sourceUrlHints.find(
    (hint) => hint.pathwayId && normalizedSourceUrl.includes(hint.sourceUrlIncludes)
  );
  return matchedHint?.pathwayId
    ? normalizeRuntimePathwayId(normalizedPlanId, matchedHint.pathwayId)
    : null;
}

function getRuntimePathwayIdFromBlockSourceUrl(block) {
  return getRuntimePathwayIdFromSourceUrl(
    block.planId,
    block.sourceUrl ?? block.primarySourceUrl
  );
}

function getRuntimeParsedBlockPathwayId(block) {
  const explicitPathwayId = normalizeRuntimePathwayId(block.planId, block.pathwayId ?? null);
  return (
    explicitPathwayId ??
    getRuntimePathwayIdFromOwnerId(block.planId, block.ownerId) ??
    getRuntimePathwayIdFromBlockSourceUrl(block)
  );
}

function getRuntimeStoredParsedBlockPathwayId(block) {
  const explicitPathwayId = String(block.pathwayId ?? "").trim();
  return (
    explicitPathwayId ||
    getRuntimePathwayIdFromOwnerId(block.planId, block.ownerId) ||
    getRuntimePathwayIdFromBlockSourceUrl(block)
  );
}

function runtimeParsedBlockMatchesScope(block, planId, pathwayId = null) {
  if (block.planId !== planId) {
    return false;
  }

  const blockPathwayId = getRuntimeParsedBlockPathwayId(block);
  return pathwayId ? blockPathwayId === pathwayId : !blockPathwayId;
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length ? value : undefined;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map(normalizeCourseCode).filter(Boolean)));
}

function uniqueLabels(values) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
    )
  );
}

function normalizeRuntimeSourceUrl(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) {
    return "";
  }

  try {
    const url = new URL(rawValue);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/u, "");
    return url.toString().toLowerCase();
  } catch {
    return rawValue.replace(/[?#].*$/u, "").replace(/\/+$/u, "").toLowerCase();
  }
}

function getRuntimeBlockSourceUrls(block) {
  return uniqueLabels([block?.sourceUrl, block?.primarySourceUrl])
    .map(normalizeRuntimeSourceUrl)
    .filter(Boolean);
}

const generatedRuntimeValueFiles = [];

function getRuntimeExportFileStem(name) {
  return `${String(name)
    .replace(/^TRANSFER_PLANNER_RUNTIME_/, "")
    .toLowerCase()
    .replace(/_/g, "-")}.generated`;
}

function getRuntimeExportFunctionSuffix(name) {
  return String(name)
    .replace(/^TRANSFER_PLANNER_RUNTIME_/, "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function serializeExport(name, typeName, value) {
  const fileStem = getRuntimeExportFileStem(name);
  const functionSuffix = getRuntimeExportFunctionSuffix(name);
  const loaderName = `loadTransferPlannerRuntime${functionSuffix}`;
  const accessorName = `getTransferPlannerRuntime${functionSuffix}`;
  const targetLiteral = Array.isArray(value) ? "[]" : "{}";
  generatedRuntimeValueFiles.push({
    filePath: path.join(OUTPUT_VALUE_DIR, `${fileStem}.json`),
    contents: JSON.stringify(sanitizeValue(value)),
  });

  return [
    `function ${loaderName}() {`,
    `  return require("./student-runtime.generated/${fileStem}.json") as ${typeName};`,
    "}",
    `export const ${name} =`,
    `  createLazyGeneratedValue<${typeName}>(${loaderName}, ${targetLiteral} as ${typeName});`,
    `export function ${accessorName}() {`,
    `  return ${name};`,
    "}",
    "",
  ].join("\n");
}

function getPartitionFileStem(collectionName, partitionKey) {
  return `${collectionName}/${slugifyRuntimeId(partitionKey) || "unknown"}.generated`;
}

function serializeStringLiteral(value) {
  return JSON.stringify(String(value ?? ""));
}

function groupValuesByKey(values, getKey) {
  const groups = new Map();
  for (const value of values) {
    const key = String(getKey(value) ?? "").trim();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function groupRecordByKey(record, getKey) {
  const groups = new Map();
  for (const [entryKey, entryValue] of Object.entries(record)) {
    const key = String(getKey(entryKey, entryValue) ?? "").trim();
    if (!key) continue;
    groups.set(key, {
      ...(groups.get(key) ?? {}),
      [entryKey]: entryValue,
    });
  }
  return groups;
}

function serializePartitionLoader({
  loaderName,
  partitionTypeName,
  partitions,
}) {
  const cases = [...partitions.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map((partitionKey) => {
      const fileStem = partitions.get(partitionKey).fileStem;
      return [
        `    case ${serializeStringLiteral(partitionKey)}:`,
        `      return require("./student-runtime.generated/${fileStem}.json") as ${partitionTypeName};`,
      ].join("\n");
    })
    .join("\n");

  return [
    `function ${loaderName}(partitionKey: string) {`,
    "  switch (partitionKey) {",
    cases,
    "    default:",
    `      return ${partitionTypeName.endsWith("[]") ? "[]" : "{}"} as ${partitionTypeName};`,
    "  }",
    "}",
    "",
  ].join("\n");
}

function serializePartitionKeyArray(name, keys) {
  const values = [...keys]
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `  ${serializeStringLiteral(key)},`)
    .join("\n");
  return [
    `const ${name} = [`,
    values,
    "] as const;",
    "",
  ].join("\n");
}

function serializePartitionedArrayExport({
  name,
  typeName,
  collectionName,
  valuesByPartition,
  partitionAccessorName,
  accessorArgs,
  accessorBody,
}) {
  const functionSuffix = getRuntimeExportFunctionSuffix(name);
  const partitionKeysName = `${name}_PARTITION_KEYS`;
  const partitionLoaderName = `loadTransferPlannerRuntime${functionSuffix}Partition`;
  const loaderName = `loadTransferPlannerRuntime${functionSuffix}`;
  const accessorName = `getTransferPlannerRuntime${functionSuffix}`;
  const partitions = new Map();

  for (const [partitionKey, values] of valuesByPartition.entries()) {
    const fileStem = getPartitionFileStem(collectionName, partitionKey);
    partitions.set(partitionKey, { fileStem });
    generatedRuntimeValueFiles.push({
      filePath: path.join(OUTPUT_VALUE_DIR, `${fileStem}.json`),
      contents: JSON.stringify(sanitizeValue(values)),
    });
  }

  return [
    serializePartitionKeyArray(partitionKeysName, partitions.keys()),
    serializePartitionLoader({
      loaderName: partitionLoaderName,
      partitionTypeName: typeName,
      partitions,
    }),
    `function ${loaderName}() {`,
    `  return ${partitionKeysName}.flatMap((partitionKey) => ${partitionLoaderName}(partitionKey)) as ${typeName};`,
    "}",
    `export const ${name} =`,
    `  createLazyGeneratedValue<${typeName}>(${loaderName}, [] as ${typeName});`,
    `export function ${accessorName}() {`,
    `  return ${name};`,
    "}",
    partitionAccessorName && accessorArgs && accessorBody
      ? [
          `export function ${partitionAccessorName}${accessorArgs} {`,
          accessorBody,
          "}",
        ].join("\n")
      : "",
    "",
  ].filter(Boolean).join("\n");
}

function serializePlanIdPartitionedMajorPlansExport({
  name,
  typeName,
  collectionName,
  valuesByPartition,
  planIdsByCampusId,
}) {
  const functionSuffix = getRuntimeExportFunctionSuffix(name);
  const partitionKeysName = `${name}_PARTITION_KEYS`;
  const partitionLoaderName = `loadTransferPlannerRuntime${functionSuffix}Partition`;
  const loaderName = `loadTransferPlannerRuntime${functionSuffix}`;
  const accessorName = `getTransferPlannerRuntime${functionSuffix}`;
  const planIdsByCampusTypeName = "Record<string, string[]>";
  const planIdsByCampusLoaderName = `loadTransferPlannerRuntime${functionSuffix}IdsByCampus`;
  const planIdsByCampusExportName = `${name}_IDS_BY_CAMPUS`;
  const partitions = new Map();

  for (const [partitionKey, values] of valuesByPartition.entries()) {
    const fileStem = getPartitionFileStem(collectionName, partitionKey);
    partitions.set(partitionKey, { fileStem });
    generatedRuntimeValueFiles.push({
      filePath: path.join(OUTPUT_VALUE_DIR, `${fileStem}.json`),
      contents: JSON.stringify(sanitizeValue(values)),
    });
  }
  generatedRuntimeValueFiles.push({
    filePath: path.join(OUTPUT_VALUE_DIR, "major-plan-ids-by-campus.generated.json"),
    contents: JSON.stringify(sanitizeValue(planIdsByCampusId)),
  });

  return [
    serializePartitionKeyArray(partitionKeysName, partitions.keys()),
    serializePartitionLoader({
      loaderName: partitionLoaderName,
      partitionTypeName: typeName,
      partitions,
    }),
    `function ${loaderName}() {`,
    `  return ${partitionKeysName}.flatMap((partitionKey) => ${partitionLoaderName}(partitionKey)) as ${typeName};`,
    "}",
    `export const ${name} =`,
    `  createLazyGeneratedValue<${typeName}>(${loaderName}, [] as ${typeName});`,
    `export function ${accessorName}() {`,
    `  return ${name};`,
    "}",
    `function ${planIdsByCampusLoaderName}() {`,
    `  return require("./student-runtime.generated/major-plan-ids-by-campus.generated.json") as ${planIdsByCampusTypeName};`,
    "}",
    `export const ${planIdsByCampusExportName} =`,
    `  createLazyGeneratedValue<${planIdsByCampusTypeName}>(${planIdsByCampusLoaderName}, {} as ${planIdsByCampusTypeName});`,
    "export function getTransferPlannerRuntimeMajorPlanIdsForCampus(campusId: TransferPlannerCampus[\"id\"] | string) {",
    `  return ${planIdsByCampusExportName}[String(campusId ?? "")] ?? [];`,
    "}",
    "export function getTransferPlannerRuntimeMajorPlansForCampus(campusId: TransferPlannerCampus[\"id\"] | string) {",
    `  return getTransferPlannerRuntimeMajorPlanIdsForCampus(campusId).flatMap((planId) => ${partitionLoaderName}(planId));`,
    "}",
    "",
  ].join("\n");
}

function serializePartitionedRecordExport({
  name,
  typeName,
  collectionName,
  recordByPartition,
  getPartitionKeyExpression,
  partitionAccessorName,
  accessorArgs,
  accessorBody,
}) {
  const functionSuffix = getRuntimeExportFunctionSuffix(name);
  const partitionKeysName = `${name}_PARTITION_KEYS`;
  const partitionLoaderName = `loadTransferPlannerRuntime${functionSuffix}Partition`;
  const partitionForKeyName = `loadTransferPlannerRuntime${functionSuffix}PartitionForKey`;
  const loaderName = `loadTransferPlannerRuntime${functionSuffix}`;
  const accessorName = `getTransferPlannerRuntime${functionSuffix}`;
  const partitions = new Map();

  for (const [partitionKey, record] of recordByPartition.entries()) {
    const fileStem = getPartitionFileStem(collectionName, partitionKey);
    partitions.set(partitionKey, { fileStem });
    generatedRuntimeValueFiles.push({
      filePath: path.join(OUTPUT_VALUE_DIR, `${fileStem}.json`),
      contents: JSON.stringify(sanitizeValue(record)),
    });
  }

  return [
    serializePartitionKeyArray(partitionKeysName, partitions.keys()),
    serializePartitionLoader({
      loaderName: partitionLoaderName,
      partitionTypeName: typeName,
      partitions,
    }),
    `function ${partitionForKeyName}(key: string) {`,
    `  const partitionKey = ${getPartitionKeyExpression};`,
    `  return ${partitionLoaderName}(partitionKey);`,
    "}",
    `function ${loaderName}() {`,
    `  return Object.assign({}, ...${partitionKeysName}.map((partitionKey) => ${partitionLoaderName}(partitionKey))) as ${typeName};`,
    "}",
    `export const ${name} =`,
    `  createLazyGeneratedRecord<${typeName}>(${loaderName}, {} as ${typeName}, ${partitionForKeyName});`,
    `export function ${accessorName}() {`,
    `  return ${name};`,
    "}",
    partitionAccessorName && accessorArgs && accessorBody
      ? [
          `export function ${partitionAccessorName}${accessorArgs} {`,
          accessorBody,
          "}",
        ].join("\n")
      : "",
    "",
  ].filter(Boolean).join("\n");
}

function writeGeneratedRuntimeValueFiles() {
  fs.rmSync(OUTPUT_VALUE_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_VALUE_DIR, { recursive: true });
  for (const entry of generatedRuntimeValueFiles) {
    fs.mkdirSync(path.dirname(entry.filePath), { recursive: true });
    fs.writeFileSync(entry.filePath, `${entry.contents}\n`, "utf8");
  }
}

function compactCourseRegistryEntry(entry) {
  return {
    schoolId: entry.schoolId,
    code: entry.code,
    title: entry.title,
    creditValue: entry.creditValue,
    creditLabel: entry.creditLabel,
    catalogDescription: REQUIRED_COURSE_SEMANTIC_RELATION_PATTERN.test(
      String(entry.catalogDescription ?? "")
    )
      ? entry.catalogDescription
      : null,
    prerequisiteCourseCodes: entry.prerequisiteCourseCodes,
    prerequisiteAlternativeCourseCodeSets: entry.prerequisiteAlternativeCourseCodeSets,
    corequisiteCourseCodes: entry.corequisiteCourseCodes,
    corequisiteAlternativeCourseCodeSets: entry.corequisiteAlternativeCourseCodeSets,
    latestAvailabilitySummary: entry.latestAvailabilitySummary,
    latestPublishedQuarters: entry.latestPublishedQuarters,
  };
}

function shouldKeepRuntimeParsedRequirementAtomCandidate(candidate) {
  const level = getCourseLevel(candidate.uwCourseCode);
  if (level === null || level < 300) {
    return true;
  }
  if (level >= 400) {
    return false;
  }

  return (candidate.sourceLineHints ?? []).some((hint) => {
    const text = String(hint ?? "").replace(/\s+/g, " ").trim();
    return (
      text &&
      !RUNTIME_NON_REQUIRED_HINT_PATTERN.test(text) &&
      !/\bor\b/i.test(text) &&
      RUNTIME_REQUIRED_CORE_ROW_HINT_PATTERN.test(text)
    );
  });
}

const RUNTIME_SCHEDULABLE_ROLES = new Set([
  "official-catalog",
  "primary-degree-requirements",
  "department-requirements",
  "pathway-degree-sheet",
]);

function canRuntimeSourceBlockCreateSchedulableRows(block) {
  if (
    block.canCreateSchedulableRows === false ||
    block.canCreateScheduleRows === false ||
    block.canCreateRequiredRows === false ||
    block.supportOnly === true ||
    block.nonSchedulable === true
  ) {
    return false;
  }

  if (["support", "non-schedulable", "ignored"].includes(String(block.sourceRoleStatus ?? ""))) {
    return false;
  }

  const sourceRole = block.sourceRole ?? null;
  return !sourceRole || RUNTIME_SCHEDULABLE_ROLES.has(sourceRole);
}

function isTacomaSetUndergraduateProgramRuntimeBlock(block) {
  return (
    block?.campusId === "uw-tacoma" &&
    UW_TACOMA_SET_UNDERGRAD_PROGRAM_URL_PATTERN.test(
      String(block.sourceUrl ?? block.primarySourceUrl ?? "")
    )
  );
}

function getRuntimeGuideRuleStatusScore(rule) {
  switch (rule.ruleStatus) {
    case "active":
      return 3;
    case "legacy":
      return 2;
    case "deprecated":
      return 1;
    default:
      return 2;
  }
}

function getRuntimeGuideRuleAcceptanceScore(rule) {
  switch (rule.acceptanceCategory) {
    case "preferred":
      return 4;
    case "accepted":
      return 3;
    case "accepted-with-warning":
      return 2;
    case "legacy-accepted":
      return 1;
    default:
      return 0;
  }
}

function getRuntimeGuideRuleTypeScore(rule) {
  switch (rule.type) {
    case "direct-course":
      return 5;
    case "full-credit-combo":
      return 4;
    case "sequence":
      return 3;
    case "alternate-path":
      return 2;
    default:
      return 1;
  }
}

function scoreRuntimeGuideRuleForSingleTarget(rule, targetCourseCode) {
  const normalizedTargetCourseCode = normalizeCourseCode(targetCourseCode);
  const targetCourseCodes = uniqueStrings(rule.targetCourseCodes ?? []);
  const sourceCourseSets = rule.sourceCourseSets ?? [];
  const firstSourceSetLength = sourceCourseSets[0]?.length ?? Number.MAX_SAFE_INTEGER;
  const exactSingleTarget =
    targetCourseCodes.length === 1 && targetCourseCodes[0] === normalizedTargetCourseCode;

  return (
    getRuntimeGuideRuleStatusScore(rule) * 100 +
    getRuntimeGuideRuleTypeScore(rule) * 30 +
    getRuntimeGuideRuleAcceptanceScore(rule) * 20 +
    (exactSingleTarget ? 25 : 0) -
    firstSourceSetLength
  );
}

function compareRuntimeGuideRulesForSingleTarget(targetCourseCode) {
  return (left, right) => {
    const scoreDelta =
      scoreRuntimeGuideRuleForSingleTarget(right, targetCourseCode) -
      scoreRuntimeGuideRuleForSingleTarget(left, targetCourseCode);
    if (scoreDelta !== 0) return scoreDelta;

    const sourceSetLengthDelta =
      (left.sourceCourseSets?.[0]?.length ?? Number.MAX_SAFE_INTEGER) -
      (right.sourceCourseSets?.[0]?.length ?? Number.MAX_SAFE_INTEGER);
    if (sourceSetLengthDelta !== 0) return sourceSetLengthDelta;

    return String(left.id ?? "").localeCompare(String(right.id ?? ""));
  };
}

function findBestRuntimeGrcEquivalency(targetCourseCode) {
  const normalizedTargetCourseCode = normalizeCourseCode(targetCourseCode);
  const candidates = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.filter((rule) => {
    const sourceCourseSets = rule.sourceCourseSets ?? [];
    if (!sourceCourseSets.some((sourceCourseSet) => (sourceCourseSet ?? []).length > 0)) {
      return false;
    }
    if (rule.sourceSchoolId !== "grc") {
      return false;
    }
    if (rule.acceptanceCategory === "no-credit" || rule.type === "elective-credit") {
      return false;
    }
    if (rule.ruleStatus === "deprecated") {
      return false;
    }
    return uniqueStrings(rule.targetCourseCodes ?? []).includes(normalizedTargetCourseCode);
  }).sort(compareRuntimeGuideRulesForSingleTarget(normalizedTargetCourseCode));

  const rule = candidates[0] ?? null;
  const sourceCourseSet = uniqueStrings(rule?.sourceCourseSets?.[0] ?? []);
  if (!rule || !sourceCourseSet.length) {
    return null;
  }

  return {
    targetCourseCode: normalizedTargetCourseCode,
    grcCourses: sourceCourseSet,
    ruleId: rule.id,
    sourceUrl: rule.sourceLinks?.find((link) => link.url)?.url ?? null,
  };
}

function compareAdmissionPrepGuideRulesForSingleTarget(targetCourseCode) {
  const compareRuntimeRules = compareRuntimeGuideRulesForSingleTarget(targetCourseCode);
  return (left, right) => {
    const statusScoreDelta =
      getRuntimeGuideRuleStatusScore(right) - getRuntimeGuideRuleStatusScore(left);
    if (statusScoreDelta !== 0) return statusScoreDelta;

    const sourceSetLengthDelta =
      (left.sourceCourseSets?.[0]?.length ?? Number.MAX_SAFE_INTEGER) -
      (right.sourceCourseSets?.[0]?.length ?? Number.MAX_SAFE_INTEGER);
    if (sourceSetLengthDelta !== 0) return sourceSetLengthDelta;

    return compareRuntimeRules(left, right);
  };
}

function findBestAdmissionPrepRuntimeGrcEquivalency(targetCourseCode) {
  const normalizedTargetCourseCode = normalizeCourseCode(targetCourseCode);
  const candidates = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.filter((rule) => {
    const sourceCourseSets = rule.sourceCourseSets ?? [];
    if (!sourceCourseSets.some((sourceCourseSet) => (sourceCourseSet ?? []).length > 0)) {
      return false;
    }
    if (rule.sourceSchoolId !== "grc") {
      return false;
    }
    if (rule.acceptanceCategory === "no-credit" || rule.type === "elective-credit") {
      return false;
    }
    if (rule.ruleStatus === "deprecated") {
      return false;
    }
    return uniqueStrings(rule.targetCourseCodes ?? []).includes(normalizedTargetCourseCode);
  }).sort(compareAdmissionPrepGuideRulesForSingleTarget(normalizedTargetCourseCode));

  const rule = candidates[0] ?? null;
  const sourceCourseSet = uniqueStrings(rule?.sourceCourseSets?.[0] ?? []);
  if (!rule || !sourceCourseSet.length) {
    return null;
  }

  return {
    targetCourseCode: normalizedTargetCourseCode,
    grcCourses: sourceCourseSet,
    ruleId: rule.id,
    sourceUrl: rule.sourceLinks?.find((link) => link.url)?.url ?? null,
  };
}

function getCanonicalRuntimeCourseEntryForBlock(courseCode, block) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const preferredSchoolIds = uniqueLabels([
    block?.campusId,
    "uw-tacoma",
    "uw-seattle",
    "uw-bothell",
  ]);

  for (const schoolId of preferredSchoolIds) {
    const entry = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
      (candidate) =>
        candidate.schoolId === schoolId &&
        normalizeCourseCode(candidate.code) === normalizedCourseCode
    );
    if (entry) {
      return entry;
    }
  }

  return (
    TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
      (candidate) => normalizeCourseCode(candidate.code) === normalizedCourseCode
    ) ?? null
  );
}

function extractRuntimeEquivalentCourseCodesFromText(value) {
  return uniqueStrings(
    [...String(value ?? "").matchAll(RUNTIME_EQUIVALENT_COURSE_CODE_PATTERN)].map((match) =>
      normalizeCourseCode(match[0])
    )
  );
}

function getTacomaCampusAliasTargetCourseCodes(courseCode) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const mathMatch = normalizedCourseCode.match(/^TMATH\s+(\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (mathMatch) {
    return [`MATH ${mathMatch[1]}`];
  }

  const physicsMatch = normalizedCourseCode.match(/^TPHYS\s+(\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (physicsMatch) {
    return [`PHYS ${physicsMatch[1]}`];
  }

  return [];
}

function getBothellCampusAliasTargetCourseCodes(courseCode, block) {
  if (block?.campusId !== "uw-bothell") {
    return [];
  }
  return BOTHELL_CAMPUS_ALIAS_GUIDE_TARGET_COURSE_ALIASES.get(normalizeCourseCode(courseCode)) ?? [];
}

function getRuntimeEquivalentTargetCourseCodesForParsedCourse(courseCode, block) {
  const course = getCanonicalRuntimeCourseEntryForBlock(courseCode, block);
  const relatedCourseCodes = [];
  const catalogDescription = String(course?.catalogDescription ?? "");
  for (const match of catalogDescription.matchAll(COURSE_SEMANTIC_RELATION_PATTERN)) {
    relatedCourseCodes.push(...extractRuntimeEquivalentCourseCodesFromText(match[1]));
  }

  return uniqueStrings([
    ...getTacomaCampusAliasTargetCourseCodes(courseCode),
    ...getBothellCampusAliasTargetCourseCodes(courseCode, block),
    ...relatedCourseCodes,
    courseCode,
  ]);
}

function getRuntimeGrcMappingForParsedCourse(courseCode, block) {
  for (const targetCourseCode of getRuntimeEquivalentTargetCourseCodesForParsedCourse(
    courseCode,
    block
  )) {
    const equivalency = findBestRuntimeGrcEquivalency(targetCourseCode);
    if (equivalency) {
      return equivalency;
    }
  }

  return null;
}

function isRuntimeAdmissionPrepRequirementSourceBlock(block) {
  if (!block?.ok || String(block.sourceRoleStatus ?? "") === "ignored") {
    return false;
  }
  return (
    block.canCreateAdmissionPrepRows === true ||
    ADMISSION_PREP_SOURCE_ROLES.has(String(block.sourceRole ?? ""))
  );
}

function getAdmissionPrepGuideTargetCourseCodes(courseCode) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  if (!normalizedCourseCode) {
    return [];
  }

  return uniqueStrings([
    normalizedCourseCode,
    ...(ADMISSION_PREP_GUIDE_TARGET_COURSE_ALIASES.get(normalizedCourseCode) ?? []),
  ]);
}

function getAdmissionPrepSourceCourseCodesFromBlock(block) {
  const supportOnlyCodes = uniqueStrings(block.supportOnlyUwCourseCodes ?? []);
  if (supportOnlyCodes.length) {
    return supportOnlyCodes;
  }

  const candidateCodes = uniqueStrings(
    (block.parsedRequirementAtomCandidates ?? []).map((candidate) => candidate.uwCourseCode)
  );
  if (candidateCodes.length) {
    return candidateCodes;
  }

  return uniqueStrings(block.parsedUwCourseCodes ?? []);
}

function isAdmissionPrepRequirementSupportList(supportList) {
  return ADMISSION_PREP_SOURCE_ROLES.has(String(supportList?.sourceRole ?? ""));
}

function buildAdmissionPrepRequirementBlockFromSupportList(block, supportList) {
  const sourceUrl = supportList.officialSourceUrl ?? supportList.sourceUrl ?? block.sourceUrl;
  const sourceRole = supportList.sourceRole ?? "admissions-preparation";
  const sourceLabel = supportList.listTitle ?? block.sourceLabel ?? block.primarySourceLabel;
  const supportOnlyUwCourseCodes = uniqueStrings(supportList.acceptedUwCourseCodes ?? []);

  return {
    ...block,
    id: `${block.id}:admission-prep-support-list:${slugifyRuntimeId(
      supportList.id ?? sourceLabel ?? sourceUrl
    )}`,
    sourceUrl,
    coveredSourceUrls: uniqueLabels([...(block.coveredSourceUrls ?? []), sourceUrl]),
    sourceLabel,
    sourceRole,
    sourceRoleStatus: "support",
    canCreateAdmissionPrepRows: true,
    canCreateScheduleRows: true,
    supportOnly: true,
    nonSchedulable: false,
    parsedUwCourseCodes: supportOnlyUwCourseCodes,
    supportOnlyUwCourseCodes,
    parsedRequirementAtomCandidates: [],
    supportLists: [supportList],
  };
}

function getAdmissionPrepSupportListBlocksForScope(planId, pathwayId = null) {
  return TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_REGISTRY.filter((block) =>
    runtimeParsedBlockMatchesScope(block, planId, pathwayId)
  ).flatMap((block) =>
    (block.supportLists ?? [])
      .filter(isAdmissionPrepRequirementSupportList)
      .map((supportList) => buildAdmissionPrepRequirementBlockFromSupportList(block, supportList))
  );
}

function getAdmissionPrepSupportListBlocksForRuntimeScope(scope, planId, pathwayId = null) {
  const normalizedPathwayId = normalizeRuntimePathwayId(planId, pathwayId);
  const scopeId = normalizedPathwayId
    ? `${planId}:pathway:${normalizedPathwayId}:runtime-support-lists`
    : `${planId}:runtime-support-lists`;

  return (scope?.supportLists ?? [])
    .filter(isAdmissionPrepRequirementSupportList)
    .map((supportList) =>
      buildAdmissionPrepRequirementBlockFromSupportList(
        {
          id: scopeId,
          ok: true,
          ownerId: normalizedPathwayId ? `${planId}:pathway:${normalizedPathwayId}` : planId,
          planId,
          pathwayId: normalizedPathwayId,
          primarySourceUrl: supportList.officialSourceUrl ?? supportList.sourceUrl ?? null,
          primarySourceLabel: supportList.listTitle ?? null,
          sourceUrl: supportList.officialSourceUrl ?? supportList.sourceUrl ?? null,
          sourceLabel: supportList.listTitle ?? null,
          sourceRole: supportList.sourceRole ?? "admissions-preparation",
          sourceRoleStatus: "support",
          coveredSourceUrls: nonEmptyArray([
            supportList.officialSourceUrl ?? supportList.sourceUrl ?? null,
          ].filter(Boolean)),
          canCreateAdmissionPrepRows: true,
          canCreateScheduleRows: true,
          supportOnly: true,
          nonSchedulable: false,
        },
        supportList
      )
    );
}

function formatAdmissionPrepCourseCodeList(courseCodes) {
  const normalizedCourseCodes = uniqueStrings(courseCodes);
  if (normalizedCourseCodes.length <= 2) {
    return normalizedCourseCodes.join("/");
  }
  return normalizedCourseCodes.join(", ");
}

function buildAdmissionPrepChecklistItemTitle(sourceCourseCodes, guideTargetCourseCodes) {
  const sourceLabel = formatAdmissionPrepCourseCodeList(sourceCourseCodes);
  const guideTargetCodes = guideTargetCourseCodes.filter(
    (courseCode) => !sourceCourseCodes.includes(courseCode)
  );
  const guideTargetLabel = formatAdmissionPrepCourseCodeList(guideTargetCodes);
  return guideTargetLabel
    ? `${sourceLabel} (${guideTargetLabel} equivalent)`
    : sourceLabel;
}

function getManualAdmissionPrepSourceUrlsForScope(planId, pathwayId = null) {
  return new Set(
    applyTransferPlannerManualSourceLinkOverride(planId, pathwayId, [])
      .map((link) => normalizeRuntimeSourceUrl(link?.url))
      .filter(Boolean)
  );
}

function getAdmissionPrepBlocksForScope(planId, pathwayId = null) {
  const normalizedPathwayId = normalizeRuntimePathwayId(planId, pathwayId);
  const directBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_REGISTRY.filter(
    (block) =>
      runtimeParsedBlockMatchesScope(block, planId, normalizedPathwayId) &&
      isRuntimeAdmissionPrepRequirementSourceBlock(block)
  );
  const supportListBlocks = getAdmissionPrepSupportListBlocksForScope(planId, normalizedPathwayId);
  const scopeBlocks = uniqueBy([...directBlocks, ...supportListBlocks], (block) =>
    [
      block.id,
      block.ownerId,
      block.planId,
      getRuntimeParsedBlockPathwayId(block),
      block.sourceUrl,
      block.primarySourceUrl,
    ].join("|")
  );
  if (scopeBlocks.length) {
    return scopeBlocks;
  }

  const officialSourceUrls = getManualAdmissionPrepSourceUrlsForScope(planId, normalizedPathwayId);
  if (!officialSourceUrls.size) {
    return [];
  }

  const scopeCampusIds = new Set(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_REGISTRY.filter((block) =>
      runtimeParsedBlockMatchesScope(block, planId, normalizedPathwayId)
    )
      .map((block) => block.campusId)
      .filter(Boolean)
  );
  if (!scopeCampusIds.size) {
    return [];
  }

  const manualSourceBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_REGISTRY.filter((block) => {
      if (!isRuntimeAdmissionPrepRequirementSourceBlock(block)) {
        return false;
      }
      if (!scopeCampusIds.has(block.campusId)) {
        return false;
      }
      return getRuntimeBlockSourceUrls(block).some((url) => officialSourceUrls.has(url));
    });
  const manualSupportListBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_REGISTRY.flatMap((block) => {
    if (!scopeCampusIds.has(block.campusId)) {
      return [];
    }
    return (block.supportLists ?? [])
      .filter(isAdmissionPrepRequirementSupportList)
      .map((supportList) => buildAdmissionPrepRequirementBlockFromSupportList(block, supportList))
      .filter((supportBlock) =>
        getRuntimeBlockSourceUrls(supportBlock).some((url) => officialSourceUrls.has(url))
      );
  });

  return uniqueBy(
    [...manualSourceBlocks, ...manualSupportListBlocks],
    (block) =>
      [
        block.id,
        block.ownerId,
        block.planId,
        getRuntimeParsedBlockPathwayId(block),
        block.sourceUrl,
        block.primarySourceUrl,
      ].join("|")
  );
}

function getAdmissionPrepGuideMatchesForScope(planId, pathwayId = null, extraBlocks = []) {
  const matchesByCourseSet = new Map();
  const admissionPrepBlocks = uniqueBy(
    [...getAdmissionPrepBlocksForScope(planId, pathwayId), ...extraBlocks],
    (block) =>
      [
        block.id,
        block.ownerId,
        block.planId,
        getRuntimeParsedBlockPathwayId(block),
        block.sourceUrl,
        block.primarySourceUrl,
      ].join("|")
  );

  for (const block of admissionPrepBlocks) {
    for (const sourceCourseCode of getAdmissionPrepSourceCourseCodesFromBlock(block)) {
      const sourceCourseLevel = getCourseLevel(sourceCourseCode);
      if (sourceCourseLevel === null || sourceCourseLevel >= 300) {
        continue;
      }

      for (const guideTargetCourseCode of getAdmissionPrepGuideTargetCourseCodes(sourceCourseCode)) {
        const targetCourseLevel = getCourseLevel(guideTargetCourseCode);
        if (targetCourseLevel === null || targetCourseLevel >= 300) {
          continue;
        }

        const mapping = findBestAdmissionPrepRuntimeGrcEquivalency(guideTargetCourseCode);
        if (!mapping?.grcCourses?.length) {
          continue;
        }

        const key = uniqueLabels(mapping.grcCourses).join("|");
        const existing = matchesByCourseSet.get(key);
        if (existing) {
          existing.sourceCourseCodes.add(normalizeCourseCode(sourceCourseCode));
          existing.guideTargetCourseCodes.add(normalizeCourseCode(guideTargetCourseCode));
          continue;
        }

        matchesByCourseSet.set(key, {
          block,
          sourceCourseCodes: new Set([normalizeCourseCode(sourceCourseCode)]),
          guideTargetCourseCodes: new Set([normalizeCourseCode(guideTargetCourseCode)]),
          grcCourses: uniqueLabels(mapping.grcCourses),
        });
      }
    }
  }

  return [...matchesByCourseSet.values()].map((entry) => ({
    block: entry.block,
    sourceCourseCodes: uniqueStrings([...entry.sourceCourseCodes]),
    guideTargetCourseCodes: uniqueStrings([...entry.guideTargetCourseCodes]),
    grcCourses: uniqueLabels(entry.grcCourses),
  }));
}

function buildAdmissionPrepGuideChecklistItemsForScope(planId, pathwayId = null, extraBlocks = []) {
  return getAdmissionPrepGuideMatchesForScope(planId, pathwayId, extraBlocks).map((match) => {
    const title = buildAdmissionPrepChecklistItemTitle(
      match.sourceCourseCodes,
      match.guideTargetCourseCodes
    );
    return {
      id: `source-backed-admission-prep-${slugifyRuntimeId(`${planId}-${title}`)}`,
      title,
      grcCourses: match.grcCourses,
      note: `Green River transfer path for ${formatAdmissionPrepCourseCodeList(
        match.guideTargetCourseCodes
      )}.`,
      sourceUrl: match.block.sourceUrl ?? match.block.primarySourceUrl ?? null,
      sourceRole: match.block.sourceRole ?? "admissions-preparation",
      sourceScope: "admission-prep-schedulable",
      sourceSection: match.block.sourceLabel ?? match.block.primarySourceLabel ?? null,
      pathwayId: normalizeRuntimePathwayId(planId, pathwayId),
      routeId: normalizeRuntimePathwayId(planId, pathwayId),
      generatedFromParser: true,
      manualOverride: false,
      canCreateScheduleRow: true,
      requirementShape: "required-row",
      reason:
        "Admission-preparation source produced a guide-backed Green River transfer row.",
    };
  });
}

function normalizeRuntimeSourceLineHint(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*\*+\s*$/g, "")
    .replace(/\s+\./g, ".")
    .trim();
}

function buildRuntimeSourceBackedGrcTitle(group) {
  const sourceHint = normalizeRuntimeSourceLineHint(group.sourceLineHint);
  if (sourceHint) {
    return sourceHint.replace(/\.$/, "");
  }

  return uniqueLabels(group.uwCourseCodes).join(", ");
}

function getSourceBackedGrcChecklistGroupsForBlock(block) {
  if (isBothellAliasSourceBackedRuntimeBlock(block)) {
    return getBothellAliasSourceBackedGrcChecklistGroupsForBlock(block);
  }

  if (!isTacomaSetUndergraduateProgramRuntimeBlock(block)) {
    return [];
  }

  const groupsBySourceHint = new Map();
  for (const candidate of block.parsedRequirementAtomCandidates ?? []) {
    const uwCourseCode = normalizeCourseCode(candidate.uwCourseCode);
    const level = getCourseLevel(uwCourseCode);
    if (!uwCourseCode || level === null || level >= 300) {
      continue;
    }

    const sourceLineHint = normalizeRuntimeSourceLineHint(
      candidate.sourceLineHints?.[0] ?? uwCourseCode
    );
    const key = sourceLineHint || uwCourseCode;
    const existing = groupsBySourceHint.get(key) ?? {
      sourceLineHint,
      uwCourseCodes: [],
    };
    existing.uwCourseCodes.push(uwCourseCode);
    groupsBySourceHint.set(key, existing);
  }

  return [...groupsBySourceHint.values()].map((group) => ({
    ...group,
    uwCourseCodes: uniqueStrings(group.uwCourseCodes),
  }));
}

function isBothellAliasSourceBackedRuntimeBlock(block) {
  return (
    block?.ok === true &&
    block.campusId === "uw-bothell" &&
    canRuntimeSourceBlockCreateSchedulableRows(block) &&
    !isRuntimeAdmissionPrepRequirementSourceBlock(block) &&
    (block.parsedRequirementAtomCandidates ?? []).some((candidate) =>
      BOTHELL_CAMPUS_ALIAS_GUIDE_TARGET_COURSE_ALIASES.has(
        normalizeCourseCode(candidate.uwCourseCode)
      )
    )
  );
}

function blockHasRuntimeCueLine(block, pattern) {
  return (block.requirementCueLines ?? []).some((line) => pattern.test(String(line ?? "")));
}

function getRuntimeGroupedRequirementCourseCodes(block) {
  return new Set(
    (block.parsedRequirementGroups ?? [])
      .flatMap((group) => group.options ?? [])
      .flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
        ...(option.conditionalLabCourses ?? []),
        ...(option.displayCourseCodes ?? []).flatMap(extractRuntimeEquivalentCourseCodesFromText),
      ])
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
}

function getBothellAliasSourceBackedDefinitionCourseCodes(definition) {
  return uniqueStrings([
    ...(definition.requiredCourseCodes ?? []),
    ...(definition.optionCourseCodeGroups ?? []).flatMap((group) => group.courseCodes ?? []),
  ]);
}

function getBothellAliasSourceBackedGrcChecklistGroupsForBlock(block) {
  const groupedRequirementCourseCodes = getRuntimeGroupedRequirementCourseCodes(block);
  const atomCourseCodes = new Set(
    (block.parsedRequirementAtomCandidates ?? [])
      .map((candidate) => normalizeCourseCode(candidate.uwCourseCode))
      .filter((courseCode) => {
        if (!courseCode || groupedRequirementCourseCodes.has(courseCode)) {
          return false;
        }
        return BOTHELL_CAMPUS_ALIAS_GUIDE_TARGET_COURSE_ALIASES.has(courseCode);
      })
  );

  return BOTHELL_SOURCE_BACKED_ALIAS_SEQUENCE_DEFINITIONS.filter((definition) => {
    if (!blockHasRuntimeCueLine(block, definition.cuePattern)) {
      return false;
    }
    return getBothellAliasSourceBackedDefinitionCourseCodes(definition).every((courseCode) =>
      atomCourseCodes.has(courseCode)
    );
  }).map((definition) => ({
    stableId: definition.id,
    sourceLineHint: definition.title,
    uwCourseCodes: getBothellAliasSourceBackedDefinitionCourseCodes(definition),
    unmappedUwCourseCodes: uniqueStrings(definition.unmappedCourseCodes ?? []),
    optionCourseCodeGroups: (definition.optionCourseCodeGroups ?? []).map((group) => ({
      label: group.label ?? definition.title,
      courseCodes: uniqueStrings(group.courseCodes ?? []),
    })),
  }));
}

function buildSourceBackedGrcChecklistItemsForBlock(block) {
  if (!block.ok || !canRuntimeSourceBlockCreateSchedulableRows(block)) {
    return [];
  }

  return getSourceBackedGrcChecklistGroupsForBlock(block).map((group, index) => {
    const mappedUwCourseCodes = [];
    const unmappedUwCourseCodes = uniqueStrings(group.unmappedUwCourseCodes ?? []);
    const ruleIds = [];
    const mapUwCourseCodesToGrcCourses = (uwCourseCodes) => {
      const mappedCourses = [];
      const groupMappedUwCourseCodes = [];
      for (const uwCourseCode of uniqueStrings(uwCourseCodes)) {
        const mapping = getRuntimeGrcMappingForParsedCourse(uwCourseCode, block);
        if (!mapping) {
          unmappedUwCourseCodes.push(uwCourseCode);
          continue;
        }
        mappedCourses.push(...mapping.grcCourses);
        mappedUwCourseCodes.push(uwCourseCode);
        groupMappedUwCourseCodes.push(uwCourseCode);
        if (mapping.ruleId) {
          ruleIds.push(mapping.ruleId);
        }
      }
      return {
        grcCourses: uniqueStrings(mappedCourses),
        uwCourseCodes: uniqueStrings(groupMappedUwCourseCodes),
      };
    };

    const optionCourseCodeGroups = group.optionCourseCodeGroups ?? [];
    const mappedOptionGroups = optionCourseCodeGroups.length
      ? optionCourseCodeGroups
          .map((optionGroup) => ({
            label: optionGroup.label ?? null,
            ...mapUwCourseCodesToGrcCourses(optionGroup.courseCodes ?? []),
          }))
          .filter((optionGroup) => optionGroup.grcCourses.length > 0)
      : [];
    const flatMappedGroup = optionCourseCodeGroups.length
      ? null
      : mapUwCourseCodesToGrcCourses(group.uwCourseCodes);
    const grcCourses =
      mappedOptionGroups[0]?.grcCourses ?? flatMappedGroup?.grcCourses ?? [];
    const alternatives = mappedOptionGroups.slice(1).map((optionGroup) => optionGroup.grcCourses);
    const mappedChoicePaths = [grcCourses, ...alternatives].filter((path) => path.length > 0);
    const minCompletedCount =
      mappedOptionGroups.length > 1 && mappedChoicePaths.every((path) => path.length === 1)
        ? 1
        : undefined;
    const mappedNote = mappedUwCourseCodes.length
      ? `Mapped through the official UW Green River transfer equivalency guide for ${mappedUwCourseCodes.join(", ")}.`
      : null;
    const unmappedNote = unmappedUwCourseCodes.length
      ? `No direct Green River equivalent found for ${uniqueStrings(unmappedUwCourseCodes).join(", ")} in the UW-GRC equivalency guide.`
      : null;
    const canCreateScheduleRow = grcCourses.length > 0 || alternatives.length > 0;
    const itemIdSeed = group.stableId
      ? `${block.planId ?? block.ownerId ?? "unknown-plan"}-${group.stableId}`
      : `${block.ownerId ?? block.planId}-${group.sourceLineHint || index}`;

    return {
      id: `source-backed-grc-${slugifyRuntimeId(itemIdSeed)}`,
      title: buildRuntimeSourceBackedGrcTitle(group),
      grcCourses,
      ...(alternatives.length ? { alternatives } : {}),
      ...(minCompletedCount != null ? { minCompletedCount } : {}),
      note: [
        mappedNote,
        unmappedNote,
        ruleIds.length ? `Equivalency rule ids: ${uniqueLabels(ruleIds).join(", ")}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
      sourceUrl: block.sourceUrl ?? block.primarySourceUrl ?? null,
      sourceRole: block.sourceRole ?? null,
      sourceScope: canCreateScheduleRow ? "primary-schedulable" : "source-backed-no-public-grc-equivalent",
      sourceSection: group.sourceLineHint || null,
      generatedFromParser: true,
      manualOverride: false,
      canCreateScheduleRow,
      requirementShape: canCreateScheduleRow ? "required-row" : "hidden-informational-row",
      reason: canCreateScheduleRow
        ? "Generated from parser-backed scoped requirement atoms and UW-GRC equivalency rules."
        : "Generated from parser-backed scoped requirement atoms with no direct public Green River equivalent.",
    };
  });
}

function getSourceBackedGrcChecklistItems(planId, pathwayId = null) {
  const normalizedPathwayId = normalizeRuntimePathwayId(planId, pathwayId);
  return TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_REGISTRY
    .filter(
      (block) =>
        block.ok &&
        runtimeParsedBlockMatchesScope(block, planId, normalizedPathwayId)
    )
    .flatMap(buildSourceBackedGrcChecklistItemsForBlock);
}

function getRuntimeSupportListContext(block) {
  return [
    block.planId,
    block.ownerId,
    block.ownerTitle,
    block.sourceLabel,
    block.sourceUrl,
    block.primarySourceLabel,
    block.primarySourceUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function inferRuntimeApprovedListKey(block) {
  const context = getRuntimeSupportListContext(block);
  if (
    (block.planId === "uw-seattle-computer-engineering" ||
      /\bcomputer engineering\b/.test(context)) &&
    /\b(?:natural science|science)\b/.test(context)
  ) {
    return "computer-engineering-natural-science";
  }
  if (
    (block.planId === "uw-seattle-computer-science" ||
      /\b(?:computer science|allen school|data science)\b/.test(context)) &&
    /\b(?:natural science|science)\b/.test(context)
  ) {
    return "computer-science-approved-science";
  }
  if (/\bapproved\b/.test(context) && /\belectives?\b/.test(context)) {
    return `${slugifyRuntimeId(block.planId ?? block.ownerId ?? "unknown-owner")}-approved-electives`;
  }
  return null;
}

function buildRuntimeRequirementSupportList({ block, shape, acceptedUwCourseCodes, approvedListKey }) {
  const sourceUrl = block.sourceUrl ?? block.primarySourceUrl ?? null;
  const listTitle =
    block.sourceLabel ??
    block.primarySourceLabel ??
    (shape === "elective-list" ? "Elective list" : "Approved course list");
  const filterDefinition = getTransferPlannerProgramApprovedCourseFilterDefinition(approvedListKey);
  return {
    id: `${block.id ?? slugifyRuntimeId(`${sourceUrl ?? listTitle}`)}:support-list:${shape}`,
    shape,
    sourceUrl,
    sourceRole: block.sourceRole ?? null,
    listTitle,
    filterKey: filterDefinition?.filterKey ?? approvedListKey ?? null,
    ownerId: block.ownerId ?? block.planId ?? null,
    majorId: block.planId ?? null,
    pathwayId: getRuntimeStoredParsedBlockPathwayId(block),
    officialSourceUrl: filterDefinition?.officialSourceUrl ?? sourceUrl,
    acceptedUwCourseCodes: uniqueStrings(
      (filterDefinition?.approvedUwCourseCodes ?? acceptedUwCourseCodes ?? []).map(normalizeCourseCode)
    ),
    ...(filterDefinition?.approvedUwCourseGroups
      ? {
          approvedUwCourseGroups: filterDefinition.approvedUwCourseGroups.map((group) =>
            uniqueStrings(group.map(normalizeCourseCode))
          ),
        }
      : {}),
    ...(filterDefinition?.petitionOnlyNotes
      ? { petitionOnlyNotes: [...filterDefinition.petitionOnlyNotes] }
      : {}),
    ...(filterDefinition?.filterId ? { generatedFilterId: filterDefinition.filterId } : {}),
    ...(filterDefinition?.sourceEvidenceLines
      ? { sourceEvidenceLines: [...filterDefinition.sourceEvidenceLines] }
      : {}),
    ...(filterDefinition?.sourceEvidenceHeadings
      ? { sourceEvidenceHeadings: [...filterDefinition.sourceEvidenceHeadings] }
      : {}),
    ...(filterDefinition?.sourceFingerprint
      ? { sourceFingerprint: filterDefinition.sourceFingerprint }
      : {}),
    ...(filterDefinition ? { sourceBackedProgramApproval: true } : {}),
    ...(approvedListKey ? { approvedListKey } : {}),
    supportOnly: true,
    canCreateRequiredRow: false,
    canCreateScheduleRow: false,
    linkedPrimaryRequirementIds: [],
  };
}

function buildRuntimeRequirementSupportLists(block) {
  const lists = [];
  const approvedCodes = uniqueStrings(block.approvedFilterUwCourseCodes ?? []);
  const electiveCodes = uniqueStrings(block.electiveListUwCourseCodes ?? []);
  const supportOnlyCodes = uniqueStrings(block.supportOnlyUwCourseCodes ?? []);
  const usedCodes = new Set([...approvedCodes, ...electiveCodes]);
  const remainingSupportOnlyCodes = supportOnlyCodes.filter((courseCode) => !usedCodes.has(courseCode));
  const approvedListKey = inferRuntimeApprovedListKey(block);

  if (approvedCodes.length) {
    lists.push(
      buildRuntimeRequirementSupportList({
        block,
        shape: "approved-filter-list",
        acceptedUwCourseCodes: approvedCodes,
        approvedListKey,
      })
    );
  }

  if (electiveCodes.length) {
    lists.push(
      buildRuntimeRequirementSupportList({
        block,
        shape: "elective-list",
        acceptedUwCourseCodes: electiveCodes,
      })
    );
  }

  if (remainingSupportOnlyCodes.length) {
    const sourceRole = String(block.sourceRole ?? "");
    const shape =
      sourceRole === "elective-list"
        ? "elective-list"
        : sourceRole === "approved-course-list"
          ? "approved-course-list"
          : null;
    if (shape) {
      lists.push(
        buildRuntimeRequirementSupportList({
          block,
          shape,
          acceptedUwCourseCodes: remainingSupportOnlyCodes,
          approvedListKey: shape === "approved-course-list" ? approvedListKey : null,
        })
      );
    }
  }

  return lists;
}

function getRuntimeRequirementSupportListKey(supportList) {
  const shape = String(supportList.shape ?? "");
  const sourceUrl = String(supportList.sourceUrl ?? "");
  const approvedListKey = String(supportList.approvedListKey ?? supportList.filterKey ?? "");
  if (
    approvedListKey &&
    (shape === "approved-filter-list" || shape === "approved-course-list")
  ) {
    return `approved:${sourceUrl}:${approvedListKey}`;
  }
  return supportList.id || `${shape}:${sourceUrl}:${supportList.listTitle ?? ""}`;
}

function normalizeRuntimeRequirementSupportList(supportList) {
  const filterDefinition = getTransferPlannerProgramApprovedCourseFilterDefinition(
    supportList.approvedListKey ?? supportList.filterKey
  );
  return {
    ...supportList,
    filterKey: filterDefinition?.filterKey ?? supportList.filterKey ?? supportList.approvedListKey ?? null,
    officialSourceUrl:
      filterDefinition?.officialSourceUrl ?? supportList.officialSourceUrl ?? supportList.sourceUrl,
    acceptedUwCourseCodes: uniqueStrings(
      (filterDefinition?.approvedUwCourseCodes ?? supportList.acceptedUwCourseCodes ?? []).map(
        normalizeCourseCode
      )
    ),
    ...(filterDefinition?.approvedUwCourseGroups
      ? {
          approvedUwCourseGroups: filterDefinition.approvedUwCourseGroups.map((group) =>
            uniqueStrings(group.map(normalizeCourseCode))
          ),
        }
      : supportList.approvedUwCourseGroups
        ? { approvedUwCourseGroups: supportList.approvedUwCourseGroups }
        : {}),
    ...(filterDefinition?.petitionOnlyNotes
      ? { petitionOnlyNotes: [...filterDefinition.petitionOnlyNotes] }
      : supportList.petitionOnlyNotes
        ? { petitionOnlyNotes: supportList.petitionOnlyNotes }
        : {}),
    generatedFilterId: filterDefinition?.filterId ?? supportList.generatedFilterId ?? null,
    ...(filterDefinition?.sourceEvidenceLines
      ? { sourceEvidenceLines: [...filterDefinition.sourceEvidenceLines] }
      : supportList.sourceEvidenceLines
        ? { sourceEvidenceLines: supportList.sourceEvidenceLines }
        : {}),
    ...(filterDefinition?.sourceEvidenceHeadings
      ? { sourceEvidenceHeadings: [...filterDefinition.sourceEvidenceHeadings] }
      : supportList.sourceEvidenceHeadings
        ? { sourceEvidenceHeadings: supportList.sourceEvidenceHeadings }
        : {}),
    sourceFingerprint:
      filterDefinition?.sourceFingerprint ?? supportList.sourceFingerprint ?? null,
    sourceBackedProgramApproval:
      filterDefinition ? true : supportList.sourceBackedProgramApproval ?? null,
    supportOnly: true,
    canCreateRequiredRow: false,
    canCreateScheduleRow: false,
    linkedPrimaryRequirementIds: supportList.linkedPrimaryRequirementIds ?? [],
  };
}

function getApprovedFilterCodesFromSupportLists(supportLists) {
  return uniqueStrings(
    supportLists
      .filter((supportList) => supportList.shape === "approved-filter-list")
      .flatMap((supportList) => supportList.acceptedUwCourseCodes ?? [])
      .map(normalizeCourseCode)
  );
}

function compactParsedRequirementSourceBlock(block) {
  const canCreateSchedulableRows = canRuntimeSourceBlockCreateSchedulableRows(block);
  const sourceSupportLists = Array.isArray(block.supportLists) ? block.supportLists : [];
  const supportLists = uniqueBy(
    (sourceSupportLists.length ? sourceSupportLists : buildRuntimeRequirementSupportLists(block)).map(
      normalizeRuntimeRequirementSupportList
    ),
    getRuntimeRequirementSupportListKey
  );
  const approvedFilterUwCourseCodes = uniqueStrings([
    ...(block.approvedFilterUwCourseCodes ?? []),
    ...getApprovedFilterCodesFromSupportLists(supportLists),
  ].map(normalizeCourseCode));
  return {
    id: block.id,
    ownerId: block.ownerId,
    ownerTitle: block.ownerTitle,
    planId: block.planId,
    pathwayId: getRuntimeStoredParsedBlockPathwayId(block),
    primarySourceUrl: block.primarySourceUrl,
    primarySourceLabel: block.primarySourceLabel,
    sourceUrl: block.sourceUrl,
    coveredSourceUrls: nonEmptyArray(block.coveredSourceUrls),
    sourceLabel: block.sourceLabel,
    sourceRole: block.sourceRole,
    sourceRoleStatus: block.sourceRoleStatus,
    canCreateSchedulableRows,
    sourceScope: block.sourceScope,
    canCreateRequiredRows: block.canCreateRequiredRows,
    canCreateOptionGroups: block.canCreateOptionGroups,
    canCreateCreditBuckets: block.canCreateCreditBuckets,
    canCreateCategoryOptions: block.canCreateCategoryOptions,
    canCreateApprovedFilters: block.canCreateApprovedFilters,
    canCreateElectiveLists: block.canCreateElectiveLists,
    canCreateSequencingHints: block.canCreateSequencingHints,
    canCreateAdmissionPrepRows: block.canCreateAdmissionPrepRows,
    canCreateScheduleRows: block.canCreateScheduleRows,
    supportOnly: block.supportOnly,
    nonSchedulable: block.nonSchedulable,
    requirementShape: block.requirementShape,
    requirementCueLines: block.requirementCueLines,
    parsedUwCourseCodes: nonEmptyArray(block.parsedUwCourseCodes),
    approvedFilterUwCourseCodes: nonEmptyArray(approvedFilterUwCourseCodes),
    electiveListUwCourseCodes: nonEmptyArray(block.electiveListUwCourseCodes),
    supportOnlyUwCourseCodes: nonEmptyArray(block.supportOnlyUwCourseCodes),
    supportLists: nonEmptyArray(supportLists),
    parsedRequirementCourses: nonEmptyArray(block.parsedRequirementCourses),
    parsedDegreeMapBlockCandidates: nonEmptyArray(block.parsedDegreeMapBlockCandidates),
    parsedRequirementGroups: nonEmptyArray(block.parsedRequirementGroups),
    parsedRequirementAtomCandidates: canCreateSchedulableRows
      ? (block.parsedRequirementAtomCandidates ?? [])
          .filter(shouldKeepRuntimeParsedRequirementAtomCandidate)
          .map((candidate) => ({
            uwCourseCode: candidate.uwCourseCode,
            sourceLineHints: candidate.sourceLineHints,
          }))
      : [],
  };
}

function getRuntimeParsedRequirementBlockDedupeKey(block) {
  return JSON.stringify({
    planId: block.planId,
    pathwayId: block.pathwayId ?? null,
    sourceUrl: block.sourceUrl ?? null,
    sourceRole: block.sourceRole ?? null,
    parsedUwCourseCodes: block.parsedUwCourseCodes ?? [],
    parsedRequirementCourseCount: (block.parsedRequirementCourses ?? []).length,
    parsedRequirementGroupCount: (block.parsedRequirementGroups ?? []).length,
    parsedRequirementGroupLabels: (block.parsedRequirementGroups ?? []).map((group) => [
      group.label,
      group.requirementType,
    ]),
  });
}

function runtimeParsedRequirementBlockIsPathwayOwned(block) {
  return /:pathway:/i.test(String(block.ownerId ?? block.id ?? ""));
}

function dedupeRuntimeParsedRequirementBlocks(blocks) {
  const byKey = new Map();
  for (const block of blocks) {
    const key = getRuntimeParsedRequirementBlockDedupeKey(block);
    const existing = byKey.get(key);
    if (
      !existing ||
      (runtimeParsedRequirementBlockIsPathwayOwned(block) &&
        !runtimeParsedRequirementBlockIsPathwayOwned(existing))
    ) {
      byKey.set(key, block);
    }
  }
  return [...byKey.values()];
}

function getSourceBackedDegreeMapSections(planId, pathwayId = null) {
  const normalizedPathwayId = normalizeRuntimePathwayId(planId, pathwayId);
  return TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_REGISTRY
    .filter(
      (block) =>
        block.ok &&
        runtimeParsedBlockMatchesScope(block, planId, normalizedPathwayId) &&
        canRuntimeSourceBlockCreateSchedulableRows(block)
    )
    .flatMap((block) => {
      const candidates = (block.parsedDegreeMapBlockCandidates ?? []).length
        ? block.parsedDegreeMapBlockCandidates
        : [
            {
              id: `${block.ownerId}:parsed-official-source-requirements`,
              title: `${block.ownerTitle} parsed official source requirements`,
              uwCourseCodes: block.parsedUwCourseCodes ?? [],
            },
          ];

      return candidates.map((candidate, index) => {
        const sourceCourseCodes = uniqueStrings(candidate.uwCourseCodes ?? []);
        const items = uniqueLabels(sourceCourseCodes);

        return {
          id: `source-backed-${slugifyRuntimeId(candidate.id ?? `${block.ownerId}-${index}`)}`,
          title: candidate.title || `${block.ownerTitle} official source requirements`,
          items,
          note: block.usedSnapshotFallback
            ? `Built from a cached official snapshot${block.snapshotFallbackReason ? ` because ${block.snapshotFallbackReason}` : ""}.`
            : "Parsed from the official UW source. Courses shown here may not all have a mapped Green River scheduling equivalent yet.",
        };
      });
    })
    .filter((section) => section.items.length > 0);
}

function mergeRuntimeDegreeMapSections(existingSections, sourceBackedSections) {
  return uniqueBy(
    [...(existingSections ?? []), ...sourceBackedSections],
    (section) => section.id
  );
}

function mergeRuntimeGrcCourseList(existingCourses, sourceBackedItems) {
  return uniqueStrings([
    ...(existingCourses ?? []),
    ...sourceBackedItems.flatMap((item) => [
      ...(item.grcCourses ?? []),
      ...(item.alternatives ?? []).flat(),
    ]),
  ]);
}

function getRuntimeChecklistItemSourceKey(item) {
  return [
    item?.sourceUrl ?? item?.requirementGroup?.sourceUrl ?? "",
    item?.sourceRole ?? item?.requirementGroup?.sourceRole ?? "",
    item?.sourceScope ?? item?.requirementGroup?.sourceScope ?? "",
  ].join("|");
}

function shouldSuppressRuntimeItemCoveredBySourceBackedSequence(item, sourceBackedItems) {
  if (!item?.generatedFromParser || !/^auto-/i.test(String(item.id ?? ""))) {
    return false;
  }

  const itemGrcCourses = uniqueStrings(item.grcCourses ?? []);
  if (!itemGrcCourses.length) {
    return false;
  }

  const itemSourceKey = getRuntimeChecklistItemSourceKey(item);
  return sourceBackedItems.some((sourceBackedItem) => {
    if (
      sourceBackedItem?.generatedFromParser !== true ||
      sourceBackedItem.canCreateScheduleRow === false ||
      getRuntimeChecklistItemSourceKey(sourceBackedItem) !== itemSourceKey
    ) {
      return false;
    }

    const sourceBackedGrcCourses = new Set(
      uniqueStrings([
        ...(sourceBackedItem.grcCourses ?? []),
        ...(sourceBackedItem.alternatives ?? []).flat(),
      ])
    );
    return (
      sourceBackedGrcCourses.size > itemGrcCourses.length &&
      itemGrcCourses.every((courseCode) => sourceBackedGrcCourses.has(courseCode))
    );
  });
}

function appendSourceBackedRuntimeChecklistItems(existingItems = [], sourceBackedItems = []) {
  const filteredExistingItems = existingItems.filter(
    (item) => !shouldSuppressRuntimeItemCoveredBySourceBackedSequence(item, sourceBackedItems)
  );
  return appendUniqueRuntimeItems(filteredExistingItems, sourceBackedItems);
}

function hasRuntimeSchedulableChecklistItem(items) {
  return (items ?? []).some(
    (item) => item.canCreateScheduleRow !== false && (item.grcCourses ?? []).length > 0
  );
}

function hasRuntimeDegreeMapCourseItems(sections) {
  return (sections ?? []).some((section) => (section.items ?? []).length > 0);
}

function hasRuntimePlannerContent(plan) {
  const hasOwnContent =
    hasRuntimeDegreeMapCourseItems(plan.degreeMapSections) ||
    (plan.grcCourseList ?? []).length > 0 ||
    (plan.requirementGroups ?? []).length > 0 ||
    hasRuntimeSchedulableChecklistItem(plan.applicationChecklist) ||
    hasRuntimeSchedulableChecklistItem(plan.beforeEnrollmentChecklist) ||
    hasRuntimeSchedulableChecklistItem(plan.stayAtGrcChecklist);

  if (hasOwnContent) {
    return true;
  }

  return (plan.pathways ?? []).some(
    (pathway) =>
      hasRuntimeDegreeMapCourseItems(pathway.degreeMapSections) ||
      (pathway.grcCourseList ?? []).length > 0 ||
      (pathway.requirementGroups ?? []).length > 0 ||
      hasRuntimeSchedulableChecklistItem(pathway.applicationChecklist) ||
      hasRuntimeSchedulableChecklistItem(pathway.beforeEnrollmentChecklist) ||
      hasRuntimeSchedulableChecklistItem(pathway.stayAtGrcChecklist)
  );
}

function attachSourceBackedDegreeMapSectionsToPlan(plan) {
  const sourceBackedSections = getSourceBackedDegreeMapSections(plan.id, null);
  const pathways = (plan.pathways ?? []).map((pathway) => ({
    ...pathway,
    degreeMapSections: mergeRuntimeDegreeMapSections(
      pathway.degreeMapSections,
      getSourceBackedDegreeMapSections(plan.id, pathway.id)
    ),
  }));

  return {
    ...plan,
    degreeMapSections: mergeRuntimeDegreeMapSections(plan.degreeMapSections, sourceBackedSections),
    ...(pathways.length ? { pathways } : {}),
  };
}

function attachSourceBackedGrcChecklistItemsToPlan(plan) {
  const sourceBackedItems = getSourceBackedGrcChecklistItems(plan.id, null);
  const pathways = (plan.pathways ?? []).map((pathway) => {
    const pathwaySourceBackedItems = getSourceBackedGrcChecklistItems(plan.id, pathway.id);
    return {
      ...pathway,
      grcCourseList: mergeRuntimeGrcCourseList(pathway.grcCourseList, pathwaySourceBackedItems),
      beforeEnrollmentChecklist: appendSourceBackedRuntimeChecklistItems(
        pathway.beforeEnrollmentChecklist,
        pathwaySourceBackedItems
      ),
    };
  });

  return {
    ...plan,
    grcCourseList: mergeRuntimeGrcCourseList(plan.grcCourseList, sourceBackedItems),
    beforeEnrollmentChecklist: appendSourceBackedRuntimeChecklistItems(
      plan.beforeEnrollmentChecklist,
      sourceBackedItems
    ),
    ...(pathways.length ? { pathways } : {}),
  };
}

function applyManualRuntimeSourceLinksToScope(scope, planId, pathwayId = null) {
  return {
    ...scope,
    officialLinks: applyTransferPlannerManualSourceLinkOverride(
      planId,
      pathwayId,
      scope.officialLinks ?? []
    ),
  };
}

function applyManualRuntimeSourceLinksToPlan(plan) {
  const pathways = (plan.pathways ?? []).map((pathway) =>
    applyManualRuntimeSourceLinksToScope(pathway, plan.id, pathway.id)
  );

  return {
    ...applyManualRuntimeSourceLinksToScope(plan, plan.id, null),
    ...(pathways.length ? { pathways } : {}),
  };
}

function attachAdmissionPrepGuideChecklistItemsToPlan(plan, selectedPathwayId = null) {
  const admissionPrepItems = buildAdmissionPrepGuideChecklistItemsForScope(
    plan.id,
    selectedPathwayId,
    getAdmissionPrepSupportListBlocksForRuntimeScope(plan, plan.id, selectedPathwayId)
  );
  const pathways = (plan.pathways ?? []).map((pathway) => {
    const pathwayAdmissionPrepItems = buildAdmissionPrepGuideChecklistItemsForScope(
      plan.id,
      pathway.id,
      getAdmissionPrepSupportListBlocksForRuntimeScope(pathway, plan.id, pathway.id)
    );
    return {
      ...pathway,
      grcCourseList: mergeRuntimeGrcCourseList(pathway.grcCourseList, pathwayAdmissionPrepItems),
      applicationChecklist: appendUniqueRuntimeItems(
        pathway.applicationChecklist,
        pathwayAdmissionPrepItems
      ),
    };
  });

  return {
    ...plan,
    grcCourseList: mergeRuntimeGrcCourseList(plan.grcCourseList, admissionPrepItems),
    applicationChecklist: appendUniqueRuntimeItems(
      plan.applicationChecklist,
      admissionPrepItems
    ),
    ...(pathways.length ? { pathways } : {}),
  };
}

const schedulableParsedSourcePlanIds = new Set(
  TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_REGISTRY
    .filter((block) => block.ok && canRuntimeSourceBlockCreateSchedulableRows(block))
    .map((block) => block.planId)
    .filter(Boolean)
);

const runtimeMajorPlans = uniqueBy(
  [
    ...TRANSFER_PLANNER_CAMPUSES.flatMap((campus) =>
      getTransferPlannerStudentRuntimeMajorsForCampus(campus.id)
    ),
    ...(TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS ?? []).filter((plan) =>
      schedulableParsedSourcePlanIds.has(plan.id)
    ),
    ...TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS,
  ]
    .map(applyManualRuntimeSourceLinksToPlan)
    .map(attachSourceBackedDegreeMapSectionsToPlan)
    .map(attachSourceBackedGrcChecklistItemsToPlan)
    .map(attachAdmissionPrepGuideChecklistItemsToPlan)
    .filter(
      (plan) =>
        !isTransferPlannerStudentHiddenSourceGap(plan.id) && hasRuntimePlannerContent(plan)
    ),
  (plan) => plan.id
);

function omitPlanPathways(plan) {
  const { pathways, ...planWithoutPathways } = plan;
  return planWithoutPathways;
}

function appendUniqueRuntimeItems(existingItems = [], addedItems = []) {
  const items = [...existingItems];
  const seen = new Set(
    items.map((item) => item?.id || `${item?.title ?? ""}|${(item?.grcCourses ?? []).join("|")}`)
  );

  for (const item of addedItems) {
    const key = item?.id || `${item?.title ?? ""}|${(item?.grcCourses ?? []).join("|")}`;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push(item);
  }

  return items;
}

function itemLooksLikeUnselectedPathwayCourseBucket(planId, item, selectedPathway, pathways) {
  if (!selectedPathway) {
    return false;
  }
  if (
    RUNTIME_PATHWAY_SCOPED_SOURCE_PLAN_IDS.has(planId) &&
    (item?.generatedFromParser || item?.sourceUrl || item?.sourceRole) &&
    !item.pathwayId &&
    !item.requirementGroup?.pathwayId
  ) {
    return true;
  }
  if (!item?.generatedFromParser || item.pathwayId || item.requirementGroup?.pathwayId) {
    return false;
  }

  const itemSourceUrl = String(item.sourceUrl ?? item.requirementGroup?.sourceUrl ?? "");
  const sourceUrlHints = RUNTIME_PATHWAY_SOURCE_URL_HINTS_BY_PLAN_ID.get(planId) ?? [];
  if (
    sourceUrlHints.some((hint) =>
      itemSourceUrl.includes(hint.sourceUrlIncludes)
    )
  ) {
    return true;
  }

  if (!STRICT_PATHWAY_COURSE_BUCKET_PLAN_IDS.has(planId)) {
    return false;
  }

  const itemTitle = normalizeRuntimePathwayDisplayLabel(
    `${item.title ?? ""} ${item.requirementGroup?.label ?? ""}`
  );
  if (!itemTitle) {
    return false;
  }

  const selectedLabel = normalizeRuntimePathwayDisplayLabel(selectedPathway.label);
  return (pathways ?? []).some((pathway) => {
    if (!pathway || pathway.id === selectedPathway.id) {
      return false;
    }

    const pathwayLabel = normalizeRuntimePathwayDisplayLabel(pathway.label);
    return (
      pathwayLabel.length >= 12 &&
      itemTitle.includes(pathwayLabel) &&
      (!selectedLabel || !itemTitle.includes(selectedLabel))
    );
  });
}

function filterResolvedRuntimePathwayItems(items = [], planId, selectedPathway, pathways) {
  if (!selectedPathway) {
    return items;
  }

  return items.filter(
    (item) => !itemLooksLikeUnselectedPathwayCourseBucket(planId, item, selectedPathway, pathways)
  );
}

function isRuntimeSourceBackedDegreeMapSection(section) {
  return (
    /^source-backed-/i.test(String(section?.id ?? "")) ||
    /\bparsed official source requirements\b/i.test(String(section?.title ?? ""))
  );
}

function filterResolvedRuntimePathwayDegreeMapSections(
  sections = [],
  planId,
  selectedPathway,
  pathwaySections = []
) {
  if (
    !selectedPathway ||
    !RUNTIME_PATHWAY_SCOPED_SOURCE_PLAN_IDS.has(planId) ||
    !pathwaySections.some(isRuntimeSourceBackedDegreeMapSection)
  ) {
    return sections;
  }

  return sections.filter((section) => !isRuntimeSourceBackedDegreeMapSection(section));
}

function filterResolvedRuntimePathwayPlan(resolvedPlan, selectedPathway, pathways) {
  if (!selectedPathway) {
    return resolvedPlan;
  }

  return {
    ...resolvedPlan,
    applicationChecklist: filterResolvedRuntimePathwayItems(
      resolvedPlan.applicationChecklist,
      resolvedPlan.id,
      selectedPathway,
      pathways
    ),
    beforeEnrollmentChecklist: filterResolvedRuntimePathwayItems(
      resolvedPlan.beforeEnrollmentChecklist,
      resolvedPlan.id,
      selectedPathway,
      pathways
    ),
    stayAtGrcChecklist: filterResolvedRuntimePathwayItems(
      resolvedPlan.stayAtGrcChecklist,
      resolvedPlan.id,
      selectedPathway,
      pathways
    ),
    requirementGroups: filterResolvedRuntimePathwayItems(
      resolvedPlan.requirementGroups,
      resolvedPlan.id,
      selectedPathway,
      pathways
    ),
  };
}

function mergeResolvedRuntimePathway(resolvedPlan, pathway, pathways) {
  if (!pathway) {
    return resolvedPlan;
  }

  const filteredResolvedPlan = filterResolvedRuntimePathwayPlan(resolvedPlan, pathway, pathways);
  const filteredPathway = {
    ...pathway,
    applicationChecklist: filterResolvedRuntimePathwayItems(
      pathway.applicationChecklist,
      filteredResolvedPlan.id,
      pathway,
      pathways
    ),
    beforeEnrollmentChecklist: filterResolvedRuntimePathwayItems(
      pathway.beforeEnrollmentChecklist,
      filteredResolvedPlan.id,
      pathway,
      pathways
    ),
    stayAtGrcChecklist: filterResolvedRuntimePathwayItems(
      pathway.stayAtGrcChecklist,
      filteredResolvedPlan.id,
      pathway,
      pathways
    ),
    requirementGroups: filterResolvedRuntimePathwayItems(
      pathway.requirementGroups,
      filteredResolvedPlan.id,
      pathway,
      pathways
    ),
  };
  return {
    ...filteredResolvedPlan,
    applicationChecklist: appendUniqueRuntimeItems(
      filteredResolvedPlan.applicationChecklist,
      filteredPathway.applicationChecklist
    ),
    beforeEnrollmentChecklist: appendUniqueRuntimeItems(
      filteredResolvedPlan.beforeEnrollmentChecklist,
      filteredPathway.beforeEnrollmentChecklist
    ),
    stayAtGrcChecklist: appendUniqueRuntimeItems(
      filteredResolvedPlan.stayAtGrcChecklist,
      filteredPathway.stayAtGrcChecklist
    ),
    grcCourseList: uniqueLabels([
      ...(filteredResolvedPlan.grcCourseList ?? []),
      ...(filteredPathway.grcCourseList ?? []),
    ]),
    degreeMapSections: mergeRuntimeDegreeMapSections(
      filterResolvedRuntimePathwayDegreeMapSections(
        filteredResolvedPlan.degreeMapSections,
        filteredResolvedPlan.id,
        pathway,
        filteredPathway.degreeMapSections ?? []
      ),
      filteredPathway.degreeMapSections ?? []
    ),
    requirementGroups: appendUniqueRuntimeItems(
      filteredResolvedPlan.requirementGroups,
      filteredPathway.requirementGroups
    ),
    requirementReplacements: appendUniqueRuntimeItems(
      filteredResolvedPlan.requirementReplacements,
      filteredPathway.requirementReplacements
    ),
    supportLists: appendUniqueRuntimeItems(
      filteredResolvedPlan.supportLists,
      filteredPathway.supportLists
    ),
    pathways,
    selectedPathwayId: pathway.id,
    selectedPathwayLabel: pathway.label,
    selectedPathwaySummary: pathway.summary,
  };
}

const runtimePathwaysByPlanId = Object.fromEntries(
  runtimeMajorPlans.map((plan) => [
    plan.id,
    normalizeRuntimePathwaysForPlan(
      plan.id,
      (plan.pathways ?? []).length
        ? plan.pathways
        : getTransferPlannerStudentRuntimePathwaysForPlan(plan)
    ),
  ])
);

const runtimeResolvedMajorPlansByKey = Object.fromEntries(
  runtimeMajorPlans.flatMap((plan) => {
    const pathways = runtimePathwaysByPlanId[plan.id] ?? [];
    const pathwayIds = pathways.length ? pathways.map((pathway) => pathway.id) : [null];

    return pathwayIds.map((pathwayId) => {
      const pathway = pathways.find((candidate) => candidate.id === pathwayId) ?? null;
      const resolvedPlan = resolveTransferPlannerMajorPlan(plan, pathwayId) ?? plan;
      const resolvedPlanWithManualLinks = applyManualRuntimeSourceLinksToScope(
        resolvedPlan,
        plan.id,
        pathwayId
      );
      const enrichedResolvedPlan = attachAdmissionPrepGuideChecklistItemsToPlan(
        resolvedPlanWithManualLinks,
        pathwayId
      );
      return [
        `${plan.id}::${pathwayId ?? ""}`,
        omitPlanPathways(mergeResolvedRuntimePathway(enrichedResolvedPlan, pathway, pathways)),
      ];
    });
  })
);

const runtimePrimaryDegreeSources = Object.fromEntries(
  runtimeMajorPlans.flatMap((plan) => {
    const pathways = runtimePathwaysByPlanId[plan.id] ?? [];
    const keys = [
      [`${plan.id}::`, getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, null)],
      ...pathways.map((pathway) => [
        `${plan.id}::${pathway.id}`,
        getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, pathway.id),
      ]),
    ];

    return keys.filter(([, source]) => source?.url);
  })
);

const runtimeCompactCourses = uniqueBy(
  TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.map(compactCourseRegistryEntry).filter((entry) =>
    COURSE_CODE_PATTERN.test(entry.code)
  ),
  (entry) => `${entry.schoolId}|${entry.code}`
);
const runtimeMajorPlansWithoutPathways = runtimeMajorPlans.map(omitPlanPathways);
const runtimeMajorPlansByCampusId = groupValuesByKey(
  runtimeMajorPlansWithoutPathways,
  (plan) => plan.campusId
);
const runtimeMajorPlansByPlanId = new Map(
  runtimeMajorPlansWithoutPathways.map((plan) => [plan.id, [plan]])
);
const runtimeMajorPlanIdsByCampusId = Object.fromEntries(
  [...runtimeMajorPlansByCampusId.entries()].map(([campusId, plans]) => [
    campusId,
    plans.map((plan) => plan.id).filter(Boolean),
  ])
);
const runtimeMajorPlanCampusIdByPlanId = Object.fromEntries(
  runtimeMajorPlansWithoutPathways
    .map((plan) => [plan.id, plan.campusId])
    .filter(([planId, campusId]) => planId && campusId)
);
const runtimePathwaysByPlanIdPartitions = new Map(
  Object.entries(runtimePathwaysByPlanId).map(([planId, pathways]) => [
    planId,
    { [planId]: pathways },
  ])
);
const runtimeResolvedMajorPlansByPlanId = groupRecordByKey(
  runtimeResolvedMajorPlansByKey,
  (key) => String(key).split("::")[0]
);
const runtimePrimaryDegreeSourcesByPlanId = groupRecordByKey(
  runtimePrimaryDegreeSources,
  (key) => String(key).split("::")[0]
);
const runtimeCompactParsedRequirementBlocks =
  dedupeRuntimeParsedRequirementBlocks(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_REGISTRY.map(compactParsedRequirementSourceBlock)
  );
const runtimeParsedRequirementBlocksByPlanId = groupValuesByKey(
  runtimeCompactParsedRequirementBlocks,
  (block) => block.planId
);

const fileContents = `/* eslint-disable */
/* auto-generated by scripts/planner/generate-transfer-planner-student-runtime.cjs */

import type {
  TransferPlannerCampus,
  TransferPlannerMajorPathway,
  TransferPlannerMajorPlan,
  TransferPlannerResolvedMajorPlan,
  TransferPlannerTrack,
} from "../transfer-planner-types";
import type {
  TransferPlannerCourseRegistryEntry,
  TransferPlannerEquivalencyRule,
  TransferPlannerParsedRequirementAtomCandidate,
  TransferPlannerParsedRequirementSourceBlock,
  TransferPlannerRequirementSupportList,
  TransferPlannerSourceManifestEntry,
} from "./schema";

const {
  createLazyGeneratedRecord,
  createLazyGeneratedValue,
} = require("./generated-lazy") as typeof import("./generated-lazy");

export type TransferPlannerRuntimeCompactCourseRegistryEntry = Pick<
  TransferPlannerCourseRegistryEntry,
  | "schoolId"
  | "code"
  | "title"
  | "creditValue"
  | "creditLabel"
  | "catalogDescription"
  | "prerequisiteCourseCodes"
  | "prerequisiteAlternativeCourseCodeSets"
  | "corequisiteCourseCodes"
  | "corequisiteAlternativeCourseCodeSets"
  | "latestAvailabilitySummary"
  | "latestPublishedQuarters"
>;

export type TransferPlannerRuntimeParsedRequirementAtomCandidate = Pick<
  TransferPlannerParsedRequirementAtomCandidate,
  "uwCourseCode" | "sourceLineHints"
> & {
  title?: string | null;
};

export type TransferPlannerRuntimeParsedRequirementSourceBlock = Pick<
  TransferPlannerParsedRequirementSourceBlock,
  | "id"
  | "ownerId"
  | "ownerTitle"
  | "planId"
  | "pathwayId"
  | "primarySourceUrl"
  | "primarySourceLabel"
  | "sourceUrl"
  | "coveredSourceUrls"
  | "sourceLabel"
  | "sourceRole"
  | "sourceRoleStatus"
  | "canCreateSchedulableRows"
  | "sourceScope"
  | "canCreateRequiredRows"
  | "canCreateOptionGroups"
  | "canCreateCreditBuckets"
  | "canCreateCategoryOptions"
  | "canCreateApprovedFilters"
  | "canCreateElectiveLists"
  | "canCreateSequencingHints"
  | "canCreateAdmissionPrepRows"
  | "canCreateScheduleRows"
  | "supportOnly"
  | "nonSchedulable"
  | "requirementShape"
  | "requirementCueLines"
  | "parsedUwCourseCodes"
  | "approvedFilterUwCourseCodes"
  | "electiveListUwCourseCodes"
  | "supportOnlyUwCourseCodes"
  | "supportLists"
> & {
  parsedRequirementAtomCandidates: TransferPlannerRuntimeParsedRequirementAtomCandidate[];
  parsedRequirementCourses?: TransferPlannerParsedRequirementSourceBlock["parsedRequirementCourses"];
  parsedDegreeMapBlockCandidates?: TransferPlannerParsedRequirementSourceBlock["parsedDegreeMapBlockCandidates"];
  parsedRequirementGroups?: TransferPlannerParsedRequirementSourceBlock["parsedRequirementGroups"];
  supportLists?: TransferPlannerRequirementSupportList[];
};

${serializeExport(
  "TRANSFER_PLANNER_RUNTIME_CAMPUSES",
  "TransferPlannerCampus[]",
  TRANSFER_PLANNER_CAMPUSES
)}
${serializeExport(
  "TRANSFER_PLANNER_RUNTIME_TRACKS",
  "TransferPlannerTrack[]",
  TRANSFER_PLANNER_TRACKS
)}
${serializePlanIdPartitionedMajorPlansExport({
  name:
  "TRANSFER_PLANNER_RUNTIME_MAJOR_PLANS",
  typeName: "TransferPlannerMajorPlan[]",
  collectionName: "major-plans-by-plan-id",
  valuesByPartition: runtimeMajorPlansByPlanId,
  planIdsByCampusId: runtimeMajorPlanIdsByCampusId,
})}
${serializeExport(
  "TRANSFER_PLANNER_RUNTIME_MAJOR_PLAN_CAMPUS_ID_BY_PLAN_ID",
  "Record<string, TransferPlannerCampus[\"id\"]>",
  runtimeMajorPlanCampusIdByPlanId
)}
export function getTransferPlannerRuntimeMajorPlanById(planId: string) {
  return loadTransferPlannerRuntimeMajorPlansPartition(String(planId ?? ""))[0] ?? null;
}

${serializePartitionedRecordExport({
  name:
  "TRANSFER_PLANNER_RUNTIME_PATHWAYS_BY_PLAN_ID",
  typeName: "Record<string, TransferPlannerMajorPathway[]>",
  collectionName: "pathways-by-plan-id",
  recordByPartition: runtimePathwaysByPlanIdPartitions,
  getPartitionKeyExpression: "String(key ?? \"\")",
  partitionAccessorName: "getTransferPlannerRuntimePathwaysForPlanId",
  accessorArgs: "(planId: string)",
  accessorBody: "  return TRANSFER_PLANNER_RUNTIME_PATHWAYS_BY_PLAN_ID[planId] ?? [];",
})}
${serializePartitionedRecordExport({
  name:
  "TRANSFER_PLANNER_RUNTIME_RESOLVED_MAJOR_PLANS_BY_KEY",
  typeName: "Record<string, TransferPlannerResolvedMajorPlan>",
  collectionName: "resolved-major-plans-by-plan-id",
  recordByPartition: runtimeResolvedMajorPlansByPlanId,
  getPartitionKeyExpression: "String(key ?? \"\").split(\"::\")[0]",
  partitionAccessorName: "getTransferPlannerRuntimeResolvedMajorPlanByKey",
  accessorArgs: "(key: string)",
  accessorBody: "  return TRANSFER_PLANNER_RUNTIME_RESOLVED_MAJOR_PLANS_BY_KEY[key] ?? null;",
})}
${serializePartitionedRecordExport({
  name:
  "TRANSFER_PLANNER_RUNTIME_PRIMARY_DEGREE_SOURCES_BY_KEY",
  typeName: "Record<string, TransferPlannerSourceManifestEntry>",
  collectionName: "primary-degree-sources-by-plan-id",
  recordByPartition: runtimePrimaryDegreeSourcesByPlanId,
  getPartitionKeyExpression: "String(key ?? \"\").split(\"::\")[0]",
  partitionAccessorName: "getTransferPlannerRuntimePrimaryDegreeSourceByKey",
  accessorArgs: "(key: string)",
  accessorBody: "  return TRANSFER_PLANNER_RUNTIME_PRIMARY_DEGREE_SOURCES_BY_KEY[key] ?? null;",
})}
${serializeExport(
  "TRANSFER_PLANNER_RUNTIME_COMPACT_COURSE_REGISTRY",
  "TransferPlannerRuntimeCompactCourseRegistryEntry[]",
  runtimeCompactCourses
)}
${serializeExport(
  "TRANSFER_PLANNER_RUNTIME_EQUIVALENCY_RULE_REGISTRY",
  "TransferPlannerEquivalencyRule[]",
  TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY
)}
${serializePartitionedArrayExport({
  name:
  "TRANSFER_PLANNER_RUNTIME_PARSED_REQUIREMENT_BLOCK_REGISTRY",
  typeName: "TransferPlannerRuntimeParsedRequirementSourceBlock[]",
  collectionName: "parsed-requirement-blocks-by-plan-id",
  valuesByPartition: runtimeParsedRequirementBlocksByPlanId,
  partitionAccessorName: "getTransferPlannerRuntimeParsedRequirementBlocksForPlanId",
  accessorArgs: "(planId: string)",
  accessorBody: "  return loadTransferPlannerRuntimeParsedRequirementBlockRegistryPartition(String(planId ?? \"\"));",
})}
${serializeExport(
  "TRANSFER_PLANNER_RUNTIME_GAP_REGISTRY",
  "Array<{ planId: string; pathwayId: string | null; [key: string]: unknown }>",
  TRANSFER_PLANNER_GAP_REGISTRY
)}
`;

writeGeneratedRuntimeValueFiles();
fs.writeFileSync(OUTPUT_PATH, fileContents, "utf8");
console.log(`Wrote ${OUTPUT_PATH}`);
