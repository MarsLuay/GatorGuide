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

function getRuntimeParsedBlockPathwayId(block) {
  const explicitPathwayId = normalizeRuntimePathwayId(block.planId, block.pathwayId ?? null);
  return explicitPathwayId ?? getRuntimePathwayIdFromOwnerId(block.planId, block.ownerId);
}

function getRuntimeStoredParsedBlockPathwayId(block) {
  const explicitPathwayId = String(block.pathwayId ?? "").trim();
  return explicitPathwayId || getRuntimePathwayIdFromOwnerId(block.planId, block.ownerId);
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

function getRuntimeEquivalentTargetCourseCodesForParsedCourse(courseCode, block) {
  const course = getCanonicalRuntimeCourseEntryForBlock(courseCode, block);
  const relatedCourseCodes = [];
  const catalogDescription = String(course?.catalogDescription ?? "");
  for (const match of catalogDescription.matchAll(COURSE_SEMANTIC_RELATION_PATTERN)) {
    relatedCourseCodes.push(...extractRuntimeEquivalentCourseCodesFromText(match[1]));
  }

  return uniqueStrings([
    ...getTacomaCampusAliasTargetCourseCodes(courseCode),
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

function buildSourceBackedGrcChecklistItemsForBlock(block) {
  if (!block.ok || !canRuntimeSourceBlockCreateSchedulableRows(block)) {
    return [];
  }

  return getSourceBackedGrcChecklistGroupsForBlock(block).map((group, index) => {
    const mappedCourses = [];
    const mappedUwCourseCodes = [];
    const unmappedUwCourseCodes = [];
    const ruleIds = [];
    for (const uwCourseCode of group.uwCourseCodes) {
      const mapping = getRuntimeGrcMappingForParsedCourse(uwCourseCode, block);
      if (!mapping) {
        unmappedUwCourseCodes.push(uwCourseCode);
        continue;
      }
      mappedCourses.push(...mapping.grcCourses);
      mappedUwCourseCodes.push(uwCourseCode);
      if (mapping.ruleId) {
        ruleIds.push(mapping.ruleId);
      }
    }

    const grcCourses = uniqueStrings(mappedCourses);
    const mappedNote = mappedUwCourseCodes.length
      ? `Mapped through the official UW Green River transfer equivalency guide for ${mappedUwCourseCodes.join(", ")}.`
      : null;
    const unmappedNote = unmappedUwCourseCodes.length
      ? `No direct Green River equivalent found for ${unmappedUwCourseCodes.join(", ")} in the UW-GRC equivalency guide.`
      : null;
    const canCreateScheduleRow = grcCourses.length > 0;

    return {
      id: `source-backed-grc-${slugifyRuntimeId(`${block.ownerId ?? block.planId}-${group.sourceLineHint || index}`)}`,
      title: buildRuntimeSourceBackedGrcTitle(group),
      grcCourses,
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
        ? "Generated from parser-backed Tacoma SET requirements and UW-GRC equivalency rules."
        : "Generated from parser-backed Tacoma SET requirements with no direct public Green River equivalent.",
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
    ...sourceBackedItems.flatMap((item) => item.grcCourses ?? []),
  ]);
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
      beforeEnrollmentChecklist: appendUniqueRuntimeItems(
        pathway.beforeEnrollmentChecklist,
        pathwaySourceBackedItems
      ),
    };
  });

  return {
    ...plan,
    grcCourseList: mergeRuntimeGrcCourseList(plan.grcCourseList, sourceBackedItems),
    beforeEnrollmentChecklist: appendUniqueRuntimeItems(
      plan.beforeEnrollmentChecklist,
      sourceBackedItems
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
    .map(attachSourceBackedDegreeMapSectionsToPlan)
    .map(attachSourceBackedGrcChecklistItemsToPlan)
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

function mergeResolvedRuntimePathway(resolvedPlan, pathway, pathways) {
  if (!pathway) {
    return resolvedPlan;
  }

  return {
    ...resolvedPlan,
    applicationChecklist: appendUniqueRuntimeItems(
      resolvedPlan.applicationChecklist,
      pathway.applicationChecklist
    ),
    beforeEnrollmentChecklist: appendUniqueRuntimeItems(
      resolvedPlan.beforeEnrollmentChecklist,
      pathway.beforeEnrollmentChecklist
    ),
    stayAtGrcChecklist: appendUniqueRuntimeItems(
      resolvedPlan.stayAtGrcChecklist,
      pathway.stayAtGrcChecklist
    ),
    grcCourseList: uniqueLabels([
      ...(resolvedPlan.grcCourseList ?? []),
      ...(pathway.grcCourseList ?? []),
    ]),
    degreeMapSections: mergeRuntimeDegreeMapSections(
      resolvedPlan.degreeMapSections,
      pathway.degreeMapSections
    ),
    requirementGroups: appendUniqueRuntimeItems(
      resolvedPlan.requirementGroups,
      pathway.requirementGroups
    ),
    requirementReplacements: appendUniqueRuntimeItems(
      resolvedPlan.requirementReplacements,
      pathway.requirementReplacements
    ),
    supportLists: appendUniqueRuntimeItems(resolvedPlan.supportLists, pathway.supportLists),
    pathways,
    selectedPathwayId: pathway.id,
    selectedPathwayLabel: pathway.label,
    selectedPathwaySummary: pathway.summary,
  };
}

const runtimePathwaysByPlanId = Object.fromEntries(
  runtimeMajorPlans.map((plan) => [
    plan.id,
    (plan.pathways ?? []).length
      ? plan.pathways
      : getTransferPlannerStudentRuntimePathwaysForPlan(plan),
  ])
);

const runtimeResolvedMajorPlansByKey = Object.fromEntries(
  runtimeMajorPlans.flatMap((plan) => {
    const pathways = runtimePathwaysByPlanId[plan.id] ?? [];
    const pathwayIds = pathways.length ? pathways.map((pathway) => pathway.id) : [null];

    return pathwayIds.map((pathwayId) => {
      const pathway = pathways.find((candidate) => candidate.id === pathwayId) ?? null;
      const resolvedPlan = resolveTransferPlannerMajorPlan(plan, pathwayId) ?? plan;
      return [
        `${plan.id}::${pathwayId ?? ""}`,
        omitPlanPathways(
          mergeResolvedRuntimePathway(resolvedPlan, pathway, pathways)
        ),
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
  TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_REGISTRY.map(compactParsedRequirementSourceBlock);
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
