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

const {
  TRANSFER_PLANNER_CAMPUSES,
  TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY,
  TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY,
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY,
  TRANSFER_PLANNER_SOURCE_GAP_REGISTRY,
  TRANSFER_PLANNER_TRACKS,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerStudentRuntimeMajorsForCampus,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  resolveTransferPlannerStudentRuntimeMajorPlan,
} = require("../../constants/transfer-planner-source");

const COURSE_CODE_PATTERN = /\b[A-Z]{2,8}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/;
const SOURCE_BACKED_REQUIRED_COURSE_SEMANTIC_RELATION_PATTERN =
  /\bCourse (?:equivalent to|overlaps with):\s*([^.]*)/i;
const RUNTIME_REQUIRED_CORE_ROW_HINT_PATTERN =
  /\b(?:intro(?:duction)?|principles|mechanics|systems?|case studies|balances|chemistry|physics|biology|calculus|linear algebra|differential equations|statistics|thermodynamics|programming|communication|composition|concept|tools|sustainability)\b/i;
const RUNTIME_NON_REQUIRED_SOURCE_HINT_PATTERN =
  /\b(?:choose|select|electives?|course list|technical elective|recommended|suggested|may count|study abroad|taken\s+[A-Z]{3})\b/i;

function normalizeCourseCode(value) {
  return String(value ?? "").toUpperCase().replace(/\s+/g, " ").trim();
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

function serializeExport(name, typeName, value) {
  const json = JSON.stringify(sanitizeValue(value));
  return [
    `const ${name}_JSON = ${JSON.stringify(json)};`,
    `export const ${name} = JSON.parse(${name}_JSON) as ${typeName};`,
    "",
  ].join("\n");
}

function compactCourseRegistryEntry(entry) {
  return {
    schoolId: entry.schoolId,
    code: entry.code,
    title: entry.title,
    creditValue: entry.creditValue,
    creditLabel: entry.creditLabel,
    catalogDescription: SOURCE_BACKED_REQUIRED_COURSE_SEMANTIC_RELATION_PATTERN.test(
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
      !RUNTIME_NON_REQUIRED_SOURCE_HINT_PATTERN.test(text) &&
      !/\bor\b/i.test(text) &&
      RUNTIME_REQUIRED_CORE_ROW_HINT_PATTERN.test(text)
    );
  });
}

const RUNTIME_SCHEDULABLE_SOURCE_ROLES = new Set([
  "official-catalog",
  "primary-degree-requirements",
  "department-requirements",
  "pathway-degree-sheet",
]);

function canRuntimeSourceBlockCreateSchedulableRows(block) {
  if (block.canCreateSchedulableRows === false) {
    return false;
  }

  const sourceRole = block.sourceRole ?? null;
  return !sourceRole || RUNTIME_SCHEDULABLE_SOURCE_ROLES.has(sourceRole);
}

function compactParsedRequirementSourceBlock(block) {
  const canCreateSchedulableRows = canRuntimeSourceBlockCreateSchedulableRows(block);
  return {
    id: block.id,
    planId: block.planId,
    pathwayId: block.pathwayId,
    sourceRole: block.sourceRole,
    sourceRoleStatus: block.sourceRoleStatus,
    canCreateSchedulableRows,
    requirementCueLines: block.requirementCueLines,
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

const runtimeMajorPlans = uniqueBy(
  TRANSFER_PLANNER_CAMPUSES.flatMap((campus) =>
    getTransferPlannerStudentRuntimeMajorsForCampus(campus.id)
  ),
  (plan) => plan.id
);

function omitPlanPathways(plan) {
  const { pathways, ...planWithoutPathways } = plan;
  return planWithoutPathways;
}

const runtimePathwaysByPlanId = Object.fromEntries(
  runtimeMajorPlans.map((plan) => [
    plan.id,
    getTransferPlannerStudentRuntimePathwaysForPlan(plan),
  ])
);

const runtimeResolvedMajorPlansByKey = Object.fromEntries(
  runtimeMajorPlans.flatMap((plan) => {
    const pathways = runtimePathwaysByPlanId[plan.id] ?? [];
    const pathwayIds = pathways.length ? pathways.map((pathway) => pathway.id) : [null];

    return pathwayIds.map((pathwayId) => [
      `${plan.id}::${pathwayId ?? ""}`,
      omitPlanPathways(resolveTransferPlannerStudentRuntimeMajorPlan(plan, pathwayId) ?? plan),
    ]);
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
  TransferPlannerSourceManifestEntry,
} from "./schema";

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
  | "planId"
  | "pathwayId"
  | "sourceRole"
  | "sourceRoleStatus"
  | "canCreateSchedulableRows"
  | "requirementCueLines"
> & {
  parsedRequirementAtomCandidates: TransferPlannerRuntimeParsedRequirementAtomCandidate[];
  parsedRequirementCourses?: TransferPlannerParsedRequirementSourceBlock["parsedRequirementCourses"];
  parsedDegreeMapBlockCandidates?: TransferPlannerParsedRequirementSourceBlock["parsedDegreeMapBlockCandidates"];
  parsedRequirementGroups?: TransferPlannerParsedRequirementSourceBlock["parsedRequirementGroups"];
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
${serializeExport(
  "TRANSFER_PLANNER_RUNTIME_MAJOR_PLANS",
  "TransferPlannerMajorPlan[]",
  runtimeMajorPlans.map(omitPlanPathways)
)}
${serializeExport(
  "TRANSFER_PLANNER_RUNTIME_PATHWAYS_BY_PLAN_ID",
  "Record<string, TransferPlannerMajorPathway[]>",
  runtimePathwaysByPlanId
)}
${serializeExport(
  "TRANSFER_PLANNER_RUNTIME_RESOLVED_MAJOR_PLANS_BY_KEY",
  "Record<string, TransferPlannerResolvedMajorPlan>",
  runtimeResolvedMajorPlansByKey
)}
${serializeExport(
  "TRANSFER_PLANNER_RUNTIME_PRIMARY_DEGREE_SOURCES_BY_KEY",
  "Record<string, TransferPlannerSourceManifestEntry>",
  runtimePrimaryDegreeSources
)}
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
${serializeExport(
  "TRANSFER_PLANNER_RUNTIME_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY",
  "TransferPlannerRuntimeParsedRequirementSourceBlock[]",
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.map(compactParsedRequirementSourceBlock)
)}
${serializeExport(
  "TRANSFER_PLANNER_RUNTIME_SOURCE_GAP_REGISTRY",
  "Array<{ planId: string; pathwayId: string | null; [key: string]: unknown }>",
  TRANSFER_PLANNER_SOURCE_GAP_REGISTRY
)}
`;

fs.writeFileSync(OUTPUT_PATH, fileContents, "utf8");
console.log(`Wrote ${OUTPUT_PATH}`);
