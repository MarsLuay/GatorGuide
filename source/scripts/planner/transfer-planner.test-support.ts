// Shared imports, fixtures, and helpers for the transfer planner domain suites.

import assert from "node:assert/strict";

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";

import { spawnSync } from "node:child_process";

import test from "node:test";

import {
  TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY,
  TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY_SOURCE_URLS,
} from "@/constants/transfer-planner-grc-availability.generated";

import { TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS } from "@/constants/transfer-planner-source/bootstrap.generated";

import { TRANSFER_PLANNER_GENERATED_COURSE_METADATA } from "@/constants/transfer-planner-source/course-metadata.generated";

import {
  TRANSFER_PLANNER_COURSE_METADATA_FIELD_GAP_STATES,
  TRANSFER_PLANNER_COURSE_METADATA_FIELD_GAPS,
  getTransferPlannerNormalizedCourseMetadataEntry,
} from "@/constants/transfer-planner-source/course-metadata";

import {
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS,
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY,
} from "@/constants/transfer-planner-source/grc-associate-tracks.generated";

import {
  TRANSFER_PLANNER_UW_GRC_ALL_EQUIVALENCY_RULES,
  TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES,
  TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES,
} from "@/constants/transfer-planner-source/equivalency-guide.generated";

import {
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS,
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY,
} from "@/constants/transfer-planner-source/requirement-source-adapters.generated";

import {
  TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY,
  TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY,
  TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY,
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY,
  TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY,
  TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY,
  TRANSFER_PLANNER_POLICY_REGISTRY,
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY,
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY,
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_REGISTRY_SUMMARY,
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY,
  TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY,
  TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY,
  TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS,
  TRANSFER_PLANNER_SOURCE_GAP_REGISTRY,
  TRANSFER_PLANNER_SOURCE_SUMMARY,
  TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS,
  getTransferPlannerGrcCourseAvailability,
  getTransferPlannerGrcCourseAvailabilitySummary,
  getTransferPlannerGrcCourseList,
  getTransferPlannerGrcCourseListGuidance,
  getTransferPlannerMajorPlan,
  getTransferPlannerMajorsForCampus,
  getTransferPlannerPathwaysForPlan,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerRequirementDiffClassifications,
  getTransferPlannerSourceManifestEntriesForPlan,
  getTransferPlannerTrack,
  getTransferPlannerSourceGeneratedMajorsForCampus,
  getTransferPlannerStudentRuntimeMajorPlan,
  getTransferPlannerStudentRuntimeMajorsForCampus,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  getTransferPlannerStudentVisibleMajorsForCampus,
  getTransferPlannerStudentVisiblePathwaysForPlan,
  getTransferPlannerStudentVisibleSourceGeneratedMajorsForCampus,
  buildMaterialsScienceNmeSourceIncompleteWarnings,
  isTransferPlannerStudentHiddenSourceGap,
  resolveTransferPlannerMajorPlan,
  resolveTransferPlannerStudentRuntimeMajorPlan,
  getTransferPlannerCanonicalCourse,
  getTransferPlannerEquivalencyRulesForSourceCourse,
  getTransferPlannerParsedRequirementSourceBlocks,
  getTransferPlannerAutoMatchedTrackRecommendation,
  isTransferPlannerEquivalencyRuleEffectiveForTerm,
  type TransferPlannerChecklistItem,
  type TransferPlannerMajorPlan,
  type TransferPlannerParsedRequirementSourceBlock,
} from "@/constants/transfer-planner-source";

import {
  getTransferPlannerMajorPlan as getCompactRuntimeMajorPlan,
  getTransferPlannerGrcCourseList as getCompactRuntimeGrcCourseList,
  getTransferPlannerTrack as getCompactRuntimeTrack,
  resolveTransferPlannerStudentRuntimeMajorPlan as resolveCompactRuntimeMajorPlan,
} from "@/constants/transfer-planner-source/student-runtime";

import {
  isSuspiciousStructuralPathwayId,
  isSuspiciousStructuralPathwayLabel,
  materializeTransferPlannerPathways,
  normalizeMaterializedTransferPlannerPathwayLabel,
} from "@/constants/transfer-planner-source/pathway-materialization";

import {
  buildHistoricalGrcTrackComparison,
  buildCompletedTransferableQuarterCreditSummary,
  buildGeneralEducationRequirementTargets,
  buildGeneralEducationRequirementLayerDiagnostics,
  buildSourceBackedMajorGeneralEducationRequirementSection,
  buildSourceBackedRequiredCourseDescriptors,
  buildSourceBackedRequiredCourseSummaryEntries,
  buildSourceBackedRequiredCourseCodes,
  buildSourceBackedUwCourseConsideredSummaryEntries,
  buildEligibleTransferCategorySourceCourseCodesForPlan,
  buildTransferPlannerGrcTranscriptReadyCourseCodes,
  isTransferPlannerGrcCourseSetTranscriptReady,
  parseCompletedTranscriptCourses,
  normalizeCourseCode,
  extractCourseCodes,
  buildRequirementStatuses,
  buildSuggestedQuarterCourseOptionGroupsForTrack,
  buildSourceBackedGeneralEducationRequirementTargets,
  buildTrackUsageSummary,
  buildTransferPlannerCoursePlanningGraph,
  buildTransferPlannerStudentCourseEvaluations,
  buildTransferPlannerStudentEvaluationReport,
  buildMajorSpecificsCourseSections,
  buildMajorSpecificsRenderingAudit,
  buildUwGeneralTransferRequirementSection,
  getPreparatoryTrackCourseCodeSet,
  getCurrentTransferPlannerGrcCatalogYearLabel,
  inferTransferPlannerGrcCatalogYearLabel,
  getResolvedTrackTermsForRequirementDisplay,
  buildSuggestedQuarterPlan,
  auditCompoundSequenceOptionScheduling,
  auditRuntimeCompoundScheduling,
  auditOptionGroupSatisfaction,
  auditRuntimeOptionResolution,
  auditRequiredCoverageSequenceSuppression,
  auditOptionAllocation,
  auditCategoryOptionDetection,
  auditCategoryTranscriptSatisfaction,
  auditComputerEngineeringCreditBuckets,
  auditComputerEngineeringApprovedNaturalScienceEquivalencies,
  auditComputerEngineeringApprovedNaturalScienceTransferCategoryFilter,
  auditProgramApprovedCourseFilters,
  auditOptionTitleFallback,
  auditOptionCredits,
  auditOptionSelectionSources,
  auditCompoundEquivalencyPaths,
  auditTrueOptionDetection,
  auditSourceScope,
  auditSourceRowBoundaries,
  auditRequiredMappedCourseCoverage,
  auditRequirementRolePrecedence,
  auditCountedCourses,
  auditRequirementClassification,
  auditInvalidScheduledOptions,
  auditSbseCreditTotals,
  auditSbseCurrentVsOldSource,
  auditSbseScheduledRowSources,
  auditUnselectedOptionPrerequisiteScheduling,
  auditVisibleGrcQuarterPlanScope,
  auditUwCivilEngineeringLowerDivisionRequirements,
  auditUwBioengineeringSourceBackedRequirements,
  buildSuggestedQuarterRemainingCreditRange,
  buildUwTransferMinimumRequirementSummary,
  countMatchedGrcTrackGeneralEducationBreadthRows,
  hasCourseAndDistributionPlaceholderSignal,
  isMergedCourseDistributionRequirementLabel,
  getUwTransferGenericMilestoneDecision,
  type TranscriptCourseEntry,
} from "@/services/planning/transfer-planner.service";

const {
  buildPagedGrcCourseDescriptionsUrl,
  extractCurrentGrcCatalogDetails,
  extractGrcAnnualSchedules,
  extractGrcCatalogArchiveEntries,
  filterRelevantAnnualSchedules,
} = require("./grc-public-materials.cjs");

const { parseGrcEnrollmentRequirementText } = require("./ingest-grc-catalog.cjs");

const LEGACY_PLANNER_DATA_MODULE_NAME = ["transfer", "planner", "data.ts"].join("-");

const GUIDE_BACKED_EQUIVALENCY_RULE_SOURCE_KINDS = new Set([
  "uw-green-river-equivalency-guide",
  "uw-green-river-equivalency-guide-derived",
]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

const EXPECTED_UW_TRANSFER_ADMISSION_REQUIREMENT_LINES = [
  "English: 4 CADR credits",
  "Mathematics: 3 CADR credits",
  "Social sciences / social studies: 3 CADR credits",
  "World languages: 2 CADR credits",
  "Science: 3 CADR credits",
  "Senior-year math-based quantitative course: 1 CADR credit",
  "Fine, visual or performing arts: 0.5 CADR credit",
  "Academic elective: 0.5 CADR credit",
];

function collectProjectTextFiles(rootDir: string) {
  const ignoredDirectoryNames = new Set([
    ".git",
    ".expo",
    ".next",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".tmp",
  ]);
  const allowedExtensions = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".cjs",
    ".mjs",
    ".json",
    ".md",
    ".yml",
    ".yaml",
    ".txt",
    ".ps1",
    ".cmd",
    ".sh",
    ".bat",
  ]);
  const filePaths: string[] = [];

  const walk = (relativeDir: string) => {
    const absoluteDir = relativeDir ? `${rootDir}/${relativeDir}` : rootDir;
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (ignoredDirectoryNames.has(entry.name)) {
          continue;
        }
        walk(relativePath);
        continue;
      }

      const extension =
        relativePath.includes(".")
          ? `.${relativePath.split(".").pop()?.toLowerCase() ?? ""}`
          : "";
      if (!allowedExtensions.has(extension)) {
        continue;
      }

      const absolutePath = `${rootDir}/${relativePath}`;
      if (!statSync(absolutePath).isFile()) {
        continue;
      }
      filePaths.push(relativePath);
    }
  };

  walk("");
  return filePaths.sort();
}

function getGeneratedMetadataGapEntriesForCourse(code: string) {
  const normalizedCode = normalizeCourseCode(code);
  return TRANSFER_PLANNER_COURSE_METADATA_FIELD_GAP_STATES.filter(
    (entry) => entry.schoolId === "grc" && normalizeCourseCode(entry.code) === normalizedCode
  );
}

function getPlannerVisibleSourceBackedGrcTitleGaps() {
  const plannerVisibleCourseCodes = new Set<string>();

  for (const plan of TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS) {
    const checklistItems = [
      ...(plan.applicationChecklist ?? []),
      ...(plan.beforeEnrollmentChecklist ?? []),
      ...(plan.stayAtGrcChecklist ?? []),
    ];

    for (const item of checklistItems) {
      for (const courseCode of [item.grcCourses ?? [], ...(item.alternatives ?? [])].flat()) {
        const normalizedCourseCode = normalizeCourseCode(courseCode);
        if (normalizedCourseCode) {
          plannerVisibleCourseCodes.add(normalizedCourseCode);
        }
      }
    }
  }

  return [...plannerVisibleCourseCodes]
    .map((courseCode) => ({
      courseCode,
      metadataTitle: getTransferPlannerNormalizedCourseMetadataEntry("grc", courseCode)?.title ?? null,
      canonicalTitle: getTransferPlannerCanonicalCourse("grc", courseCode)?.title ?? null,
    }))
    .filter((entry) => entry.metadataTitle && !entry.canonicalTitle)
    .sort((left, right) => left.courseCode.localeCompare(right.courseCode));
}

function getRequiredPlan(id: string) {
  const plan = getTransferPlannerMajorPlan(id);
  if (!plan) {
    throw new Error(`Missing transfer planner data for ${id}.`);
  }
  return plan;
}

function collectSuspiciousStructuralPathways(
  pathways: Array<{ id: string; label: string }>
) {
  return pathways
    .filter(
      (pathway) =>
        isSuspiciousStructuralPathwayId(pathway.id) ||
        isSuspiciousStructuralPathwayLabel(pathway.label)
    )
    .map((pathway) => `${pathway.id} => ${pathway.label}`)
    .sort();
}

function getChecklistCoverageForPlan(plan: TransferPlannerMajorPlan) {
  const items = [
    ...(plan.applicationChecklist ?? []),
    ...(plan.beforeEnrollmentChecklist ?? []),
    ...(plan.stayAtGrcChecklist ?? []),
  ];
  const coverage = new Set<string>();

  for (const item of items) {
    for (const courseLabel of item.grcCourses ?? []) {
      for (const code of extractCourseCodes(courseLabel)) {
        coverage.add(normalizeCourseCode(code));
      }
    }

    for (const alternativeGroup of item.alternatives ?? []) {
      for (const courseLabel of alternativeGroup) {
        for (const code of extractCourseCodes(courseLabel)) {
          coverage.add(normalizeCourseCode(code));
        }
      }
    }
  }

  return coverage;
}

function getPlannerOwnerPrimarySourceEntries() {
  const entries: Array<{
    ownerKey: string;
    planId: string;
    pathwayId: string | null;
    title: string;
    primaryUrl: string | null;
  }> = [];

  for (const plan of TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS) {
    entries.push({
      ownerKey: plan.id,
      planId: plan.id,
      pathwayId: null,
      title: plan.title,
      primaryUrl: getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, null)?.url ?? null,
    });

    for (const pathway of plan.pathways ?? []) {
      entries.push({
        ownerKey: `${plan.id}:pathway:${pathway.id}`,
        planId: plan.id,
        pathwayId: pathway.id,
        title: `${plan.title} - ${pathway.label}`,
        primaryUrl:
          getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, pathway.id)?.url ?? null,
      });
    }
  }

  return entries;
}

function urlLooksLikeBlockedPrimarySource(value: string | null | undefined) {
  return /\/saml\/login|shibboleth\.sso\/login|\/print\/courses|\/wp-login/i.test(
    String(value ?? "")
  );
}

function parseUrlOrNull(value: string | null | undefined) {
  try {
    return new URL(String(value ?? ""));
  } catch {
    return null;
  }
}

function urlHasHostname(value: string | null | undefined, expectedHostname: string) {
  const parsedUrl = parseUrlOrNull(value);
  if (!parsedUrl) {
    return false;
  }

  return parsedUrl.hostname.toLowerCase() === expectedHostname.toLowerCase();
}

function urlHasAllowedHostnameAndPathPrefix(
  value: string | null | undefined,
  allowedHostnames: string[],
  expectedPathPrefix: string
) {
  const parsedUrl = parseUrlOrNull(value);
  if (!parsedUrl) {
    return false;
  }

  const normalizedHostname = parsedUrl.hostname.toLowerCase();
  const normalizedAllowedHostnames = new Set(
    allowedHostnames.map((hostname) => String(hostname ?? "").toLowerCase())
  );

  return (
    normalizedAllowedHostnames.has(normalizedHostname) &&
    parsedUrl.pathname.startsWith(expectedPathPrefix)
  );
}

function getDuplicateSortedValues(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

function countByValues(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

const SEEDED_RUNTIME_QA_SAMPLE_SEED = 20260409;

const SEEDED_RUNTIME_QA_SAMPLE_PLAN_IDS = [
  "uw-seattle-swedish",
  "uw-bothell-culture-literature-and-the-arts",
  "uw-seattle-oceanography",
  "uw-seattle-global-literary-studies",
  "uw-seattle-environmental-science-and-terrestrial-resource-management",
  "uw-bothell-computer-engineering",
  "uw-tacoma-spanish-language-and-cultures",
  "uw-seattle-jazz-studies-b-m",
  "uw-tacoma-history",
  "uw-seattle-business-administration",
] as const;

const AUTO_CUSTOM_PREP_FALLBACK_TITLE = "Custom source-backed Green River prep";

const AUTO_SOURCE_BACKED_UW_PREP_TARGET_PREFIX = "UW prep target:";

const AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_TITLE = "Source-backed UW prep guidance";

const EMPTY_RUNTIME_CUSTOM_PREP_PLAN_IDS = [
  "uw-seattle-american-indian-studies",
  "uw-seattle-asian-languages-and-cultures",
  "uw-seattle-asian-studies",
  "uw-seattle-chinese",
  "uw-seattle-classical-studies",
  "uw-seattle-comparative-history-of-ideas",
  "uw-seattle-danish",
  "uw-seattle-ethnomusicology-b-a",
  "uw-seattle-gender-women-and-sexuality-studies",
  "uw-seattle-global-literary-studies",
  "uw-seattle-japanese",
  "uw-seattle-jewish-studies",
  "uw-seattle-korean",
  "uw-seattle-norwegian",
  "uw-seattle-oceanography",
  "uw-seattle-scandinavian-area-studies",
  "uw-seattle-slavic-languages-and-literatures",
  "uw-seattle-south-asian-languages-and-cultures",
  "uw-bothell-developmental-and-youth-studies",
  "uw-bothell-educational-studies-elementary-education",
  "uw-bothell-health-studies",
  "uw-bothell-interactive-media-design",
  "uw-bothell-interdisciplinary-studies-individualized-study",
  "uw-bothell-nursing-first-year-rn-to-bsn",
  "uw-bothell-nursing-rn-to-bsn",
  "uw-tacoma-healthcare-leadership",
  "uw-tacoma-information-technology",
  "uw-tacoma-nursing",
];

function normalizePlannerCourseCode(value: string) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function getStrictChoiceSetNoPublicPathPlanIds() {
  const classificationsByPlanId = new Map<
    string,
    (typeof TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY)[number][]
  >();

  for (const classification of TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY) {
    if (classification.pathwayId) {
      continue;
    }

    const current = classificationsByPlanId.get(classification.planId) ?? [];
    current.push(classification);
    classificationsByPlanId.set(classification.planId, current);
  }

  return [...classificationsByPlanId.entries()]
    .filter(
      ([, entries]) =>
        entries.length > 0 &&
        entries.every(
          (entry) =>
            entry.classificationKind === "source-backed-choice-set-no-public-grc-path" &&
            !entry.promotedRequirementAtomOverrideId
        )
    )
    .map(([planId]) => planId)
    .sort();
}

function getAllChecklistItems(plan: {
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
}) {
  return [
    ...(plan.applicationChecklist ?? []),
    ...(plan.beforeEnrollmentChecklist ?? []),
    ...(plan.stayAtGrcChecklist ?? []),
  ];
}

function isHiddenSourceOnlyRuntimeChecklistTitle(title: string) {
  return (
    title === AUTO_CUSTOM_PREP_FALLBACK_TITLE ||
    title.startsWith(AUTO_SOURCE_BACKED_UW_PREP_TARGET_PREFIX) ||
    title === AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_TITLE
  );
}

function getResolvedStudentRuntimePlan(planId: string) {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(planId);
  assert.ok(runtimePlan, `Expected a student runtime plan for ${planId}.`);
  const firstPathwayId = getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan)[0]?.id ?? null;
  const resolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, firstPathwayId);
  assert.ok(resolvedPlan, `Expected a resolved student runtime plan for ${planId}.`);
  return resolvedPlan;
}

function hasStructuredPlannerData(plan: {
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
}) {
  return getAllChecklistItems(plan).length > 0;
}

function getResolvedRuntimeQuarterPlanningState(
  planId: string,
  pathwayId?: string | null
) {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(planId);
  assert.ok(runtimePlan, `Expected a student runtime plan for ${planId}.`);

  const resolvedPathwayId =
    pathwayId === undefined
      ? getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan)[0]?.id ?? null
      : pathwayId;
  const resolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, resolvedPathwayId);
  assert.ok(
    resolvedPlan,
    `Expected a resolved student runtime plan for ${planId} (${resolvedPathwayId ?? "base"}).`
  );

  const suggestedQuarterPlan = buildSuggestedQuarterPlan({
    plan: resolvedPlan,
    applicationStatuses: buildRequirementStatuses(resolvedPlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(resolvedPlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(resolvedPlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track: getTransferPlannerTrack(resolvedPlan.bestTrackId ?? null),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedQuarters = suggestedQuarterPlan.filter((quarter) => quarter.phase === "planned");

  return {
    runtimePlan,
    resolvedPlan,
    suggestedQuarterPlan,
    plannedQuarters,
    diagnostics: {
      planId,
      pathwayId: resolvedPlan.selectedPathwayId ?? resolvedPathwayId ?? null,
      coursePoolCount: getTransferPlannerGrcCourseList(resolvedPlan).length,
      checklistCounts: {
        application: resolvedPlan.applicationChecklist.length,
        beforeEnrollment: resolvedPlan.beforeEnrollmentChecklist.length,
        stayAtGrc: resolvedPlan.stayAtGrcChecklist.length,
      },
      hasStructuredPlannerData: hasStructuredPlannerData(resolvedPlan),
      hasSchedulerOutput: suggestedQuarterPlan.length > 0,
      hasPlannedQuarterRows: plannedQuarters.some((quarter) => quarter.courses.length > 0),
      emptyPlannedQuarterCount: plannedQuarters.filter((quarter) => quarter.courses.length === 0).length,
    },
  };
}

function getOfficialGuideRule(ruleId: string) {
  return TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find((entry) => entry.id === ruleId);
}

function isReferenceOnlyGuideRule(rule: {
  title?: string | null;
  sourceCourseLabel?: string | null;
  notes?: string[];
  plannerWarnings?: string[];
}) {
  return /combined[- ]entry|combined entries|see .*combined/i.test(
    [
      rule.title,
      rule.sourceCourseLabel,
      ...(rule.notes ?? []),
      ...(rule.plannerWarnings ?? []),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getGuideRuleStatusScore(rule: {
  ruleStatus?: string | null;
}) {
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

function getGuideRuleAcceptanceScore(rule: {
  acceptanceCategory?: string | null;
}) {
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

function getGuideRuleTypeScore(rule: {
  type?: string | null;
}) {
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

function compareGuideCoverageRules(
  left: {
    id: string;
    title?: string | null;
    sourceCourseLabel?: string | null;
    notes?: string[];
    plannerWarnings?: string[];
    ruleStatus?: string | null;
    acceptanceCategory?: string | null;
    sourceCourseSets?: string[][];
    type?: string | null;
  },
  right: {
    id: string;
    title?: string | null;
    sourceCourseLabel?: string | null;
    notes?: string[];
    plannerWarnings?: string[];
    ruleStatus?: string | null;
    acceptanceCategory?: string | null;
    sourceCourseSets?: string[][];
    type?: string | null;
  }
) {
  const referenceOnlyDelta =
    Number(isReferenceOnlyGuideRule(left)) - Number(isReferenceOnlyGuideRule(right));
  if (referenceOnlyDelta !== 0) {
    return referenceOnlyDelta;
  }

  const statusDelta = getGuideRuleStatusScore(right) - getGuideRuleStatusScore(left);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  const acceptanceDelta =
    getGuideRuleAcceptanceScore(right) - getGuideRuleAcceptanceScore(left);
  if (acceptanceDelta !== 0) {
    return acceptanceDelta;
  }

  const typeDelta = getGuideRuleTypeScore(right) - getGuideRuleTypeScore(left);
  if (typeDelta !== 0) {
    return typeDelta;
  }

  const leftSourceSetLength = left.sourceCourseSets?.[0]?.length ?? Number.MAX_SAFE_INTEGER;
  const rightSourceSetLength = right.sourceCourseSets?.[0]?.length ?? Number.MAX_SAFE_INTEGER;
  if (leftSourceSetLength !== rightSourceSetLength) {
    return leftSourceSetLength - rightSourceSetLength;
  }

  return left.id.localeCompare(right.id);
}

function getGuideBackedCoverageGaps() {
  const guideRulesByTargetCourseCode = new Map<
    string,
    Array<{
      id: string;
      title?: string | null;
      sourceCourseLabel?: string | null;
      notes?: string[];
      plannerWarnings?: string[];
      ruleStatus?: string | null;
      acceptanceCategory?: string | null;
      type?: string;
      sourceCourseSets: string[][];
    }>
  >();

  for (const rule of TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY) {
    if (!GUIDE_BACKED_EQUIVALENCY_RULE_SOURCE_KINDS.has(rule.sourceKind ?? "")) {
      continue;
    }
    if (rule.acceptanceCategory === "no-credit") {
      continue;
    }
    if (!(rule.targetCourseCodes ?? []).length || !(rule.sourceCourseSets ?? []).length) {
      continue;
    }

    const normalizedSourceCourseSets = (rule.sourceCourseSets ?? [])
      .map((group) =>
        [...new Set((group ?? []).map((code) => normalizePlannerCourseCode(code)).filter(Boolean))]
      )
      .filter((group) => group.length > 0);

    if (!normalizedSourceCourseSets.length) {
      continue;
    }

    for (const targetCourseCode of rule.targetCourseCodes ?? []) {
      const normalizedTargetCourseCode = normalizePlannerCourseCode(targetCourseCode);
      const rulesForTargetCourseCode =
        guideRulesByTargetCourseCode.get(normalizedTargetCourseCode) ?? [];
      rulesForTargetCourseCode.push({
        id: rule.id,
        title: rule.title,
        sourceCourseLabel: rule.sourceCourseLabel,
        notes: rule.notes,
        plannerWarnings: rule.plannerWarnings,
        ruleStatus: rule.ruleStatus,
        acceptanceCategory: rule.acceptanceCategory,
        type: rule.type,
        sourceCourseSets: normalizedSourceCourseSets,
      });
      guideRulesByTargetCourseCode.set(normalizedTargetCourseCode, rulesForTargetCourseCode);
    }
  }

  const gaps: Array<{
    ownerId: string;
    sourceUwCourseCode: string;
    guideRuleId: string;
    grcCourseCodes: string[];
    ruleType: string | undefined;
    referenceOnly: boolean;
  }> = [];

  for (const parsedSource of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY) {
    const plan = getTransferPlannerMajorPlan(parsedSource.planId);
    if (!plan) {
      continue;
    }

    const visiblePlan = parsedSource.pathwayId
      ? resolveTransferPlannerMajorPlan(plan, parsedSource.pathwayId)
      : plan;
    const coveredCodes = new Set(
      getTransferPlannerGrcCourseList(visiblePlan).map((code) =>
        normalizePlannerCourseCode(code)
      )
    );

    const sourceUwCourseCodes = [
      ...new Set(
        [
          ...(parsedSource.parsedUwCourseCodes ?? []),
          ...(parsedSource.sourceOnlyUwCourseCodes ?? []),
        ]
          .map((code) => normalizePlannerCourseCode(code))
          .filter(Boolean)
      ),
    ].sort();

    for (const sourceUwCourseCode of sourceUwCourseCodes) {
      const candidateRules = [
        ...(guideRulesByTargetCourseCode.get(sourceUwCourseCode) ?? []),
      ].sort(compareGuideCoverageRules);
      const topGuideRule = candidateRules[0];
      if (!topGuideRule) {
        continue;
      }

      const requirementCoverageSatisfied = topGuideRule.sourceCourseSets.some((group) =>
        group.every((code) => coveredCodes.has(code))
      );
      if (requirementCoverageSatisfied) {
        continue;
      }

      gaps.push({
        ownerId: parsedSource.ownerId,
        sourceUwCourseCode,
        guideRuleId: topGuideRule.id,
        grcCourseCodes: [...new Set(topGuideRule.sourceCourseSets.flat())].sort(),
        ruleType: topGuideRule.type,
        referenceOnly: isReferenceOnlyGuideRule(topGuideRule),
      });

      for (const group of topGuideRule.sourceCourseSets) {
        for (const code of group) {
          coveredCodes.add(code);
        }
      }
    }
  }

  return gaps;
}

const SHA_256_FINGERPRINT_RE = /^[a-f0-9]{64}$/;

const CANONICAL_COURSE_CODE_RE = /^[A-Z&]{1,8}(?: [A-Z&]{1,8}){0,1} \d{3}[A-Z]?$/;

const compEPlan = getRequiredPlan("uw-seattle-computer-engineering");

const csPlan = getRequiredPlan("uw-seattle-computer-science");

const ecePlan = getRequiredPlan("uw-seattle-electrical-computer-engineering");

const civilPlan = getRequiredPlan("uw-seattle-civil-engineering");

const isePlan = getRequiredPlan("uw-seattle-industrial-systems-engineering");

const msePlan = getRequiredPlan("uw-seattle-materials-science-engineering");

const envePlan = getRequiredPlan("uw-seattle-environmental-engineering");

const bioEPlan = getRequiredPlan("uw-seattle-bioengineering");

const chemEPlan = getRequiredPlan("uw-seattle-chemical-engineering");

const hcdePlan = getRequiredPlan("uw-seattle-human-centered-design-engineering");

const seattleAppliedMathPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-applied-mathematics"
);

const seattleMathPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-mathematics"
);

const seattleStatisticsPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-statistics"
);

const seattleAmericanEthnicStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-american-ethnic-studies"
);

const seattleAmericanIndianStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-american-indian-studies"
);

const seattleAnthropologyPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-anthropology"
);

const seattleAcmsPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-applied-and-computational-mathematical-sciences"
);

const seattleAcePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-aquatic-conservation-and-ecology"
);

const seattleArchitecturalDesignPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-architectural-design"
);

const seattleArchitecturalStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-architectural-studies"
);

const seattleArtPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-art"
);

const seattleArtHistoryPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-art-history"
);

const seattleAsianLanguagesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-asian-languages-and-cultures"
);

const seattleAsianStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-asian-studies"
);

const seattleAstronomyPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-astronomy"
);

const seattleAtmosphericClimateSciencePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-atmospheric-and-climate-science"
);

const seattleBiochemistrySeattlePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-biochemistry"
);

const seattleBiologySeattlePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-biology"
);

const seattleBusinessAdministrationPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-business-administration"
);

const seattleChemistrySeattlePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-chemistry"
);

const seattleChinesePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-chinese"
);

const seattleCinemaMediaStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-cinema-and-media-studies"
);

const seattleClassicalStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-classical-studies"
);

const seattleClassicsPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-classics"
);

const seattleCommunicationPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-communication"
);

const seattleCepPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-community-environment-and-planning"
);

const seattleChiPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-comparative-history-of-ideas"
);

const seattleComparativeLiteraturePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-comparative-literature"
);

const seattleComparativeReligionPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-comparative-religion"
);

const seattleCfrmPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-computational-finance-and-risk-management"
);

const seattleConstructionManagementPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-construction-management"
);

const seattleDancePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-dance"
);

const seattleDanishPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-danish"
);

const seattleDesignPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-design"
);

const seattleDisabilityStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-disability-studies"
);

const seattleDramaPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-drama"
);

const seattleEcfsPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-early-childhood-and-family-studies"
);

const seattleEssPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-earth-and-space-sciences"
);

const seattleEconomicsPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-economics"
);

const seattleEducationStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-education-studies"
);

const seattleEcoPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-education-communities-and-organizations"
);

const seattleEnglishCreativeWritingPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-english-creative-writing"
);

const seattleEnglishLlcPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-english-language-literature-and-culture"
);

const compETrack = getTransferPlannerTrack(compEPlan.bestTrackId);

const bioETrack = getTransferPlannerTrack(bioEPlan.bestTrackId);

const chemETrack = getTransferPlannerTrack(chemEPlan.bestTrackId);

const hcdeTrack = getTransferPlannerTrack(hcdePlan.bestTrackId);

const bothellCssePlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-csse"
);

const bothellCsseTrack = getTransferPlannerTrack(bothellCssePlan?.bestTrackId ?? null);

const bothellAmericanEthnicStudiesPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-american-and-ethnic-studies"
);

const bothellAppliedComputingPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-applied-computing"
);

const bothellBiologyPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-biology"
);

const bothellBbaPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-business-administration"
);

const bothellAccountingPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-business-administration-accounting"
);

const bothellFinancePlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-business-administration-finance"
);

const bothellLsiPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-business-administration-leadership-and-strategic-innovation"
);

const bothellMarketingPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-business-administration-marketing"
);

const bothellScmPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-business-administration-supply-chain-management"
);

const bothellChemistryBaPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-chemistry-ba"
);

const bothellChemistryBsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-chemistry-bs"
);

const bothellBiochemistryPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-chemistry-biochemistry"
);

const bothellCsseIacPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-csse-information-assurance-and-cybersecurity"
);

const bothellCrsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-conservation-and-restoration-science"
);

const bothellClaPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-culture-literature-and-the-arts"
);

const bothellDataVisBaPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-data-visualization-ba"
);

const bothellDataVisBsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-data-visualization-bs"
);

const bothellDysPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-developmental-and-youth-studies"
);

const bothellEssPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-earth-system-science"
);

const bothellEconomicsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-economics"
);

const bothellElementaryEdPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-educational-studies-elementary-education"
);

const bothellCompEPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-computer-engineering"
);

const bothellEePlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-electrical-engineering"
);

const bothellEnvironmentalStudiesPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-environmental-studies"
);

const bothellGwssPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-gender-women-and-sexuality-studies"
);

const bothellGlobalStudiesPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-global-studies"
);

const bothellHealthStudiesPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-health-studies"
);

const bothellImdPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-interactive-media-design"
);

const bothellInterdisciplinaryArtsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-interdisciplinary-arts"
);

const bothellIndividualizedStudyPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-interdisciplinary-studies-individualized-study"
);

const bothellLeppPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-law-economics-and-public-policy"
);

const bothellMtvPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-mathematical-thinking-and-visualization"
);

const bothellMathPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-mathematics"
);

const bothellMcsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-media-and-communications-studies"
);

const bothellFirstYearRnBsnPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-nursing-first-year-rn-to-bsn"
);

const bothellRnBsnPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-nursing-rn-to-bsn"
);

const bothellPhysicsBaPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-physics-ba"
);

const bothellPhysicsBsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-physics-bs"
);

const bothellPsychologyPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-psychology"
);

const bothellStsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-science-technology-and-society"
);

const bothellSehbPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-society-ethics-and-human-behavior"
);

const generatedPlan = TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.find(
  (entry) => entry.sourceType === "master-generated"
);

const tacomaCompEPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-computer-engineering"
);

const tacomaCompETrack = getTransferPlannerTrack(tacomaCompEPlan?.bestTrackId ?? null);

const tacomaEePlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-electrical-engineering"
);

const tacomaEeTrack = getTransferPlannerTrack(tacomaEePlan?.bestTrackId ?? null);

const tacomaCivilPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-civil-engineering"
);

const tacomaCommunicationDetailedPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-communications"
);

const tacomaEpaPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-economics-and-policy-analysis"
);

const tacomaEducationPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-education"
);

const tacomaCssBaPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-computer-science-and-systems-ba"
);

const tacomaCssBsPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-computer-science-and-systems-bs"
);

const tacomaAmcPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-arts-media-culture"
);

const tacomaEnvSciencePlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-environmental-science"
);

const tacomaEnvSustainabilityPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-environmental-sustainability"
);

const tacomaHistoryPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-history"
);

const tacomaItPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-information-technology"
);

const tacomaLawPolicyPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-law-and-policy"
);

const tacomaMathPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-mathematics"
);

const tacomaPsychologyPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-psychology"
);

const tacomaSocialWelfarePlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-social-welfare"
);

const tacomaUrbanDesignPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-urban-design"
);

const tacomaEglsDetailedPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-ethnic-gender-and-labor-studies"
);

const tacomaHealthcareLeadershipPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-healthcare-leadership"
);

const tacomaIasPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-interdisciplinary-arts-and-sciences"
);

const tacomaIasIndividuallyDesignedPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed"
);

const tacomaNursingPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-nursing"
);

const tacomaPpePlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-politics-philosophy-and-economics"
);

const tacomaSpanishPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-spanish-language-and-cultures"
);

const tacomaSustainableUrbanDevelopmentPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-sustainable-urban-development"
);

const tacomaUrbanStudiesPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-urban-studies"
);

const biologyPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-biology"
);

const individualizedStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-individualized-studies"
);

const tacomaCommunicationPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-communications"
);

const tacomaWritingPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-writing-studies"
);

const sourceGeneratedChemistryPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-seattle"
).find((entry) => entry.id === "uw-seattle-chemistry");

const sourceGeneratedEconomicsPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-seattle"
).find((entry) => entry.id === "uw-seattle-economics");

const sourceGeneratedGeographyPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-seattle"
).find((entry) => entry.id === "uw-seattle-geography");

const sourceGeneratedPsychologyPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-seattle"
).find((entry) => entry.id === "uw-seattle-psychology");

const sourceGeneratedPhghPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-seattle"
).find((entry) => entry.id === "uw-seattle-public-health-global-health");

const sourceGeneratedStatisticsPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-seattle"
).find((entry) => entry.id === "uw-seattle-statistics");

const sourceGeneratedBothellPlans = getTransferPlannerSourceGeneratedMajorsForCampus("uw-bothell");

const sourceGeneratedTacomaAmcPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Arts, Media and Culture (BA)");

const sourceGeneratedTacomaBabaPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Bachelor of Arts in Business Administration (BABA)");

const sourceGeneratedTacomaEnvSustainabilityPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Environmental Sustainability (BA)");

const sourceGeneratedTacomaEglsPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Ethnic, Gender and Labor Studies (BA)");

const sourceGeneratedTacomaSudPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Sustainable Urban Development (BA)");

const sourceGeneratedTacomaUrbanStudiesPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Urban Studies (BA)");

const sourceGeneratedTacomaBiomedPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Biomedical Sciences (BS)");

const sourceGeneratedTacomaCriminalJusticePlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Criminal Justice (BA)");

const sourceGeneratedTacomaPlans = getTransferPlannerSourceGeneratedMajorsForCampus("uw-tacoma");

function buildTranscriptCourses(...codes: string[]): TranscriptCourseEntry[] {
  return codes.map((code) => ({
    code,
    label: code,
  }));
}

function buildTermTranscriptCourse(
  code: string,
  termLabel: string,
  termStartDate: string
): TranscriptCourseEntry {
  return {
    code,
    label: code,
    termLabel,
    termStartDate,
    termEndDate: null,
  };
}

function buildBelowCadrThresholdTranscriptCourses() {
  return buildTranscriptCourses(
    "ENGL& 101",
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163"
  );
}

function buildAtOrAboveCadrThresholdTranscriptCourses() {
  return buildTranscriptCourses(
    "ENGL& 101",
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "PHYS& 221"
  );
}

function buildCompEStatuses(completedCourses: TranscriptCourseEntry[]) {
  return buildStatuses(compEPlan, completedCourses);
}

function buildCompEQuarterPlan(completedCourses: TranscriptCourseEntry[]) {
  return buildQuarterPlan(compEPlan, compETrack, completedCourses);
}

function findCalcStatus(completedCourses: TranscriptCourseEntry[]) {
  const { applicationStatuses } = buildCompEStatuses(completedCourses);
  const calcStatus = applicationStatuses.find((status) => status.item.id === "calc123");
  assert.ok(calcStatus, "Expected Seattle CompE planner to include calc123.");
  return calcStatus;
}

function getUpcomingCourseLabels(completedCourses: TranscriptCourseEntry[]) {
  return buildCompEQuarterPlan(completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
}

function buildStatuses(plan: TransferPlannerMajorPlan, completedCourses: TranscriptCourseEntry[]) {
  return {
    applicationStatuses: buildRequirementStatuses(plan.applicationChecklist, completedCourses),
    beforeEnrollmentStatuses: buildRequirementStatuses(
      plan.beforeEnrollmentChecklist,
      completedCourses
    ),
    stayAtGrcStatuses: buildRequirementStatuses(plan.stayAtGrcChecklist, completedCourses),
  };
}

function collectVisibleOptionGroupsForTitleAudit(
  suggestedPlan: ReturnType<typeof buildSuggestedQuarterPlan>
) {
  const optionGroups: NonNullable<
    ReturnType<typeof buildSuggestedQuarterPlan>[number]["courses"][number]["optionGroup"]
  >[] = [];
  const seenGroupIds = new Set<string>();

  for (const course of suggestedPlan.flatMap((quarter) => quarter.courses)) {
    const optionGroup = course.optionGroup ?? null;
    if (!optionGroup || seenGroupIds.has(optionGroup.id)) {
      continue;
    }

    seenGroupIds.add(optionGroup.id);
    optionGroups.push(optionGroup);
  }

  return optionGroups;
}

function getRequirementOptionSelection(
  plan: TransferPlannerMajorPlan,
  groupIdSuffix: string,
  optionIdFragment: string
) {
  const item = [
    ...plan.applicationChecklist,
    ...plan.beforeEnrollmentChecklist,
    ...plan.stayAtGrcChecklist,
  ].find((candidate) => candidate.requirementGroup?.id.endsWith(groupIdSuffix));
  assert.ok(item?.requirementGroup, `Expected requirement group ${groupIdSuffix}.`);

  const option = item.requirementGroup.options.find((candidate) =>
    String(candidate.id ?? "").includes(optionIdFragment)
  );
  assert.ok(option?.id, `Expected option ${optionIdFragment} in ${groupIdSuffix}.`);

  return {
    groupId: item.requirementGroup.id,
    optionId: option.id,
  };
}

function buildQuarterPlan(
  plan: TransferPlannerMajorPlan,
  track: ReturnType<typeof getTransferPlannerTrack>,
  completedCourses: TranscriptCourseEntry[]
) {
  const statuses = buildStatuses(plan, completedCourses);
  return buildSuggestedQuarterPlan({
    plan,
    ...statuses,
    completedCourses,
    track,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
}

function findStatus(
  plan: TransferPlannerMajorPlan,
  completedCourses: TranscriptCourseEntry[],
  itemId: string
) {
  const statuses = buildStatuses(plan, completedCourses);
  const allStatuses = [
    ...statuses.applicationStatuses,
    ...statuses.beforeEnrollmentStatuses,
    ...statuses.stayAtGrcStatuses,
  ];
  const status = allStatuses.find((entry) => entry.item.id === itemId);
  assert.ok(status, `Expected planner ${plan.id} to include ${itemId}.`);
  return status;
}

function buildChecklistItem(
  id: string,
  title: string,
  grcCourses: string[],
  note?: string
): TransferPlannerChecklistItem {
  return {
    id,
    title,
    grcCourses,
    note,
  };
}

function buildRuntimeOptionResolutionTestPlan(
  item: TransferPlannerChecklistItem,
  id = "test-runtime-option-resolution"
): TransferPlannerMajorPlan {
  return {
    id,
    campusId: "uw-seattle",
    title: "Runtime Option Resolution",
    shortTitle: "Runtime Options",
    coverage: "detailed",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [item],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
  };
}

function buildRuntimeOptionResolutionSuggestedPlan(
  plan: TransferPlannerMajorPlan,
  selectedRequirementOptionIdsByGroup: Record<string, string[] | string | null | undefined> = {}
) {
  return buildSuggestedQuarterPlan({
    plan,
    ...buildStatuses(plan, []),
    completedCourses: [],
    track: null,
    includeStayAtGrcCourses: true,
    selectedRequirementOptionIdsByGroup,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
}

function getPlannedCourseLabels(suggestedPlan: ReturnType<typeof buildSuggestedQuarterPlan>) {
  return new Set(
    suggestedPlan
      .filter((quarter) => quarter.phase === "planned" || quarter.phase === "current")
      .flatMap((quarter) => quarter.courses.map((course) => course.label))
  );
}

function getPlannedCourseLabelList(
  suggestedPlan: ReturnType<typeof buildSuggestedQuarterPlan>
) {
  return suggestedPlan
    .filter((quarter) => quarter.phase === "planned" || quarter.phase === "current")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
}

function getPlannedCourseCodeSet(
  suggestedPlan: ReturnType<typeof buildSuggestedQuarterPlan>
) {
  return new Set(
    getPlannedCourseLabelList(suggestedPlan)
      .flatMap((label) => extractCourseCodes(label))
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function getRequiredRuntimeSequencePlan(planId: string, pathwayId: string | null) {
  const plan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan(planId),
    pathwayId
  );
  assert.ok(plan, `Expected runtime plan ${planId}${pathwayId ? ` / ${pathwayId}` : ""}.`);
  return plan;
}

function buildRuntimeSequenceSuggestedPlan(
  plan: TransferPlannerMajorPlan,
  completedCourses: TranscriptCourseEntry[] = [],
  selectedRequirementOptionIdsByGroup: Record<string, string[] | string | null | undefined> = {}
) {
  return buildSuggestedQuarterPlan({
    plan,
    ...buildStatuses(plan, completedCourses),
    completedCourses,
    track: getTransferPlannerTrack(plan.bestTrackId ?? null),
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
}

function findPhysicsSequenceChoiceItem(plan: TransferPlannerMajorPlan) {
  const item = [
    ...plan.applicationChecklist,
    ...plan.beforeEnrollmentChecklist,
    ...plan.stayAtGrcChecklist,
  ].find((candidate) => {
    const group = candidate.requirementGroup;
    if (group?.requirementType !== "sequence_choice") {
      return false;
    }

    const optionText = (group.options ?? [])
      .flatMap((option) => [
        option.label,
        option.pathLabel,
        ...(option.uwCourses ?? []),
        ...(option.grcMatches ?? []),
      ])
      .join(" ");
    return /PHYS/i.test(`${candidate.title} ${group.label ?? ""} ${optionText}`);
  });

  assert.ok(item?.requirementGroup, `Expected ${plan.id} to include a physics sequence-choice group.`);
  return item;
}

function findPhysicsSequenceOptionId(
  item: TransferPlannerChecklistItem,
  labelPattern: RegExp
) {
  const group = item.requirementGroup;
  assert.ok(group, "Expected a requirement group.");
  const option = group.options.find((candidate) =>
    labelPattern.test(`${candidate.pathLabel ?? ""} ${candidate.label ?? ""}`)
  );
  assert.ok(option?.id, `Expected physics sequence option matching ${labelPattern}.`);
  return option.id;
}

function buildCompletedPhysicsCourses(courseCodes: string[]) {
  return courseCodes.map((courseCode) => ({
    code: courseCode,
    label: courseCode,
    credits: 5,
  })) satisfies TranscriptCourseEntry[];
}

function buildRuntimeEarthScienceChoiceItem(): TransferPlannerChecklistItem {
  const groupId = "test-runtime-option-resolution:requirement-group:earth-science";
  return {
    id: "earth-science-elective",
    title: "Earth science elective - choose one",
    grcCourses: ["GEOL& 101", "NATRS 210", "NUTR& 101"],
    minCompletedCount: 1,
    selectedRequirementOptionIds: [`${groupId}:geol-101`],
    scheduleSelectedRequirementOptions: true,
    requirementGroup: {
      id: groupId,
      label: "Earth science elective - choose one",
      category: "source-choice",
      requirementType: "choose_one",
      minCourses: 1,
      maxCourses: 1,
      selectionCount: 1,
      options: [
        {
          id: `${groupId}:geol-101`,
          uwCourses: ["ESS 212"],
          grcMatches: ["GEOL& 101"],
          credits: 5,
          label: "ESS 212 / GEOL& 101",
        },
        {
          id: `${groupId}:natrs-210`,
          uwCourses: ["ESRM 210"],
          grcMatches: ["NATRS 210"],
          credits: 5,
          label: "ESRM 210 / NATRS 210",
        },
        {
          id: `${groupId}:nutr-101`,
          uwCourses: ["NUTR 200"],
          grcMatches: ["NUTR& 101"],
          credits: 5,
          label: "NUTR 200 / NUTR& 101",
        },
      ],
    },
  };
}

function buildSeattleMechanicalSuggestedPlanForTest(options: {
  completedCourses?: TranscriptCourseEntry[];
  includeStemPrepCourses?: boolean;
} = {}) {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-mechanical-engineering"
  );
  assert.ok(runtimePlan, "Expected runtime Seattle Mechanical Engineering plan.");

  const resolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, null);
  assert.ok(resolvedPlan, "Expected resolved Seattle Mechanical Engineering plan.");

  const completedCourses = options.completedCourses ?? [];
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: resolvedPlan,
    applicationStatuses: buildRequirementStatuses(
      resolvedPlan.applicationChecklist,
      completedCourses
    ),
    beforeEnrollmentStatuses: buildRequirementStatuses(
      resolvedPlan.beforeEnrollmentChecklist,
      completedCourses
    ),
    stayAtGrcStatuses: buildRequirementStatuses(
      resolvedPlan.stayAtGrcChecklist,
      completedCourses
    ),
    completedCourses,
    track: getTransferPlannerTrack(resolvedPlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: options.includeStemPrepCourses ?? false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const plannedLabels = suggestedPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  return { resolvedPlan, suggestedPlan, plannedLabels, completedCourses };
}

export {
  assert,
  auditCategoryOptionDetection,
  auditCategoryTranscriptSatisfaction,
  auditCompoundEquivalencyPaths,
  auditCompoundSequenceOptionScheduling,
  auditComputerEngineeringApprovedNaturalScienceEquivalencies,
  auditComputerEngineeringApprovedNaturalScienceTransferCategoryFilter,
  auditComputerEngineeringCreditBuckets,
  auditCountedCourses,
  auditInvalidScheduledOptions,
  auditOptionAllocation,
  auditOptionCredits,
  auditOptionGroupSatisfaction,
  auditOptionSelectionSources,
  auditOptionTitleFallback,
  auditProgramApprovedCourseFilters,
  auditRequiredCoverageSequenceSuppression,
  auditRequiredMappedCourseCoverage,
  auditRequirementClassification,
  auditRequirementRolePrecedence,
  auditRuntimeCompoundScheduling,
  auditRuntimeOptionResolution,
  auditSbseCreditTotals,
  auditSbseCurrentVsOldSource,
  auditSbseScheduledRowSources,
  auditSourceRowBoundaries,
  auditSourceScope,
  auditTrueOptionDetection,
  auditUnselectedOptionPrerequisiteScheduling,
  auditUwBioengineeringSourceBackedRequirements,
  auditUwCivilEngineeringLowerDivisionRequirements,
  auditVisibleGrcQuarterPlanScope,
  AUTO_CUSTOM_PREP_FALLBACK_TITLE,
  AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_TITLE,
  AUTO_SOURCE_BACKED_UW_PREP_TARGET_PREFIX,
  bioEPlan,
  bioETrack,
  biologyPlan,
  bothellAccountingPlan,
  bothellAmericanEthnicStudiesPlan,
  bothellAppliedComputingPlan,
  bothellBbaPlan,
  bothellBiochemistryPlan,
  bothellBiologyPlan,
  bothellChemistryBaPlan,
  bothellChemistryBsPlan,
  bothellClaPlan,
  bothellCompEPlan,
  bothellCrsPlan,
  bothellCsseIacPlan,
  bothellCssePlan,
  bothellCsseTrack,
  bothellDataVisBaPlan,
  bothellDataVisBsPlan,
  bothellDysPlan,
  bothellEconomicsPlan,
  bothellEePlan,
  bothellElementaryEdPlan,
  bothellEnvironmentalStudiesPlan,
  bothellEssPlan,
  bothellFinancePlan,
  bothellFirstYearRnBsnPlan,
  bothellGlobalStudiesPlan,
  bothellGwssPlan,
  bothellHealthStudiesPlan,
  bothellImdPlan,
  bothellIndividualizedStudyPlan,
  bothellInterdisciplinaryArtsPlan,
  bothellLeppPlan,
  bothellLsiPlan,
  bothellMarketingPlan,
  bothellMathPlan,
  bothellMcsPlan,
  bothellMtvPlan,
  bothellPhysicsBaPlan,
  bothellPhysicsBsPlan,
  bothellPsychologyPlan,
  bothellRnBsnPlan,
  bothellScmPlan,
  bothellSehbPlan,
  bothellStsPlan,
  buildAtOrAboveCadrThresholdTranscriptCourses,
  buildBelowCadrThresholdTranscriptCourses,
  buildChecklistItem,
  buildCompEQuarterPlan,
  buildCompEStatuses,
  buildCompletedPhysicsCourses,
  buildCompletedTransferableQuarterCreditSummary,
  buildEligibleTransferCategorySourceCourseCodesForPlan,
  buildGeneralEducationRequirementLayerDiagnostics,
  buildGeneralEducationRequirementTargets,
  buildHistoricalGrcTrackComparison,
  buildMajorSpecificsCourseSections,
  buildMajorSpecificsRenderingAudit,
  buildMaterialsScienceNmeSourceIncompleteWarnings,
  buildPagedGrcCourseDescriptionsUrl,
  buildQuarterPlan,
  buildRequirementStatuses,
  buildRuntimeEarthScienceChoiceItem,
  buildRuntimeOptionResolutionSuggestedPlan,
  buildRuntimeOptionResolutionTestPlan,
  buildRuntimeSequenceSuggestedPlan,
  buildSeattleMechanicalSuggestedPlanForTest,
  buildSourceBackedGeneralEducationRequirementTargets,
  buildSourceBackedMajorGeneralEducationRequirementSection,
  buildSourceBackedRequiredCourseCodes,
  buildSourceBackedRequiredCourseDescriptors,
  buildSourceBackedRequiredCourseSummaryEntries,
  buildSourceBackedUwCourseConsideredSummaryEntries,
  buildStatuses,
  buildSuggestedQuarterCourseOptionGroupsForTrack,
  buildSuggestedQuarterPlan,
  buildSuggestedQuarterRemainingCreditRange,
  buildTermTranscriptCourse,
  buildTrackUsageSummary,
  buildTranscriptCourses,
  buildTransferPlannerCoursePlanningGraph,
  buildTransferPlannerGrcTranscriptReadyCourseCodes,
  buildTransferPlannerStudentCourseEvaluations,
  buildTransferPlannerStudentEvaluationReport,
  buildUwGeneralTransferRequirementSection,
  buildUwTransferMinimumRequirementSummary,
  CANONICAL_COURSE_CODE_RE,
  chemEPlan,
  chemETrack,
  civilPlan,
  collectProjectTextFiles,
  collectSuspiciousStructuralPathways,
  collectVisibleOptionGroupsForTitleAudit,
  compareGuideCoverageRules,
  compEPlan,
  compETrack,
  copyFileSync,
  countByValues,
  countMatchedGrcTrackGeneralEducationBreadthRows,
  csPlan,
  ecePlan,
  EMPTY_RUNTIME_CUSTOM_PREP_PLAN_IDS,
  envePlan,
  escapeRegExp,
  existsSync,
  EXPECTED_UW_TRANSFER_ADMISSION_REQUIREMENT_LINES,
  extractCourseCodes,
  extractCurrentGrcCatalogDetails,
  extractGrcAnnualSchedules,
  extractGrcCatalogArchiveEntries,
  filterRelevantAnnualSchedules,
  findCalcStatus,
  findPhysicsSequenceChoiceItem,
  findPhysicsSequenceOptionId,
  findStatus,
  generatedPlan,
  getAllChecklistItems,
  getChecklistCoverageForPlan,
  getCompactRuntimeGrcCourseList,
  getCompactRuntimeMajorPlan,
  getCompactRuntimeTrack,
  getCurrentTransferPlannerGrcCatalogYearLabel,
  getDuplicateSortedValues,
  getGeneratedMetadataGapEntriesForCourse,
  getGuideBackedCoverageGaps,
  getGuideRuleAcceptanceScore,
  getGuideRuleStatusScore,
  getGuideRuleTypeScore,
  getOfficialGuideRule,
  getPlannedCourseCodeSet,
  getPlannedCourseLabelList,
  getPlannedCourseLabels,
  getPlannerOwnerPrimarySourceEntries,
  getPlannerVisibleSourceBackedGrcTitleGaps,
  getPreparatoryTrackCourseCodeSet,
  getRequiredPlan,
  getRequiredRuntimeSequencePlan,
  getRequirementOptionSelection,
  getResolvedRuntimeQuarterPlanningState,
  getResolvedStudentRuntimePlan,
  getResolvedTrackTermsForRequirementDisplay,
  getStrictChoiceSetNoPublicPathPlanIds,
  getTransferPlannerAutoMatchedTrackRecommendation,
  getTransferPlannerCanonicalCourse,
  getTransferPlannerEquivalencyRulesForSourceCourse,
  getTransferPlannerGrcCourseAvailability,
  getTransferPlannerGrcCourseAvailabilitySummary,
  getTransferPlannerGrcCourseList,
  getTransferPlannerGrcCourseListGuidance,
  getTransferPlannerMajorPlan,
  getTransferPlannerMajorsForCampus,
  getTransferPlannerNormalizedCourseMetadataEntry,
  getTransferPlannerParsedRequirementSourceBlocks,
  getTransferPlannerPathwaysForPlan,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerRequirementDiffClassifications,
  getTransferPlannerSourceGeneratedMajorsForCampus,
  getTransferPlannerSourceManifestEntriesForPlan,
  getTransferPlannerStudentRuntimeMajorPlan,
  getTransferPlannerStudentRuntimeMajorsForCampus,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  getTransferPlannerStudentVisibleMajorsForCampus,
  getTransferPlannerStudentVisiblePathwaysForPlan,
  getTransferPlannerStudentVisibleSourceGeneratedMajorsForCampus,
  getTransferPlannerTrack,
  getUpcomingCourseLabels,
  getUwTransferGenericMilestoneDecision,
  GUIDE_BACKED_EQUIVALENCY_RULE_SOURCE_KINDS,
  hasCourseAndDistributionPlaceholderSignal,
  hasStructuredPlannerData,
  hcdePlan,
  hcdeTrack,
  individualizedStudiesPlan,
  inferTransferPlannerGrcCatalogYearLabel,
  isePlan,
  isHiddenSourceOnlyRuntimeChecklistTitle,
  isMergedCourseDistributionRequirementLabel,
  isReferenceOnlyGuideRule,
  isSuspiciousStructuralPathwayId,
  isSuspiciousStructuralPathwayLabel,
  isTransferPlannerEquivalencyRuleEffectiveForTerm,
  isTransferPlannerGrcCourseSetTranscriptReady,
  isTransferPlannerStudentHiddenSourceGap,
  join,
  LEGACY_PLANNER_DATA_MODULE_NAME,
  materializeTransferPlannerPathways,
  mkdirSync,
  mkdtempSync,
  msePlan,
  normalizeCourseCode,
  normalizeMaterializedTransferPlannerPathwayLabel,
  normalizePlannerCourseCode,
  parseCompletedTranscriptCourses,
  parseGrcEnrollmentRequirementText,
  parseUrlOrNull,
  readdirSync,
  readFileSync,
  resolveCompactRuntimeMajorPlan,
  resolveTransferPlannerMajorPlan,
  resolveTransferPlannerStudentRuntimeMajorPlan,
  seattleAcePlan,
  seattleAcmsPlan,
  seattleAmericanEthnicStudiesPlan,
  seattleAmericanIndianStudiesPlan,
  seattleAnthropologyPlan,
  seattleAppliedMathPlan,
  seattleArchitecturalDesignPlan,
  seattleArchitecturalStudiesPlan,
  seattleArtHistoryPlan,
  seattleArtPlan,
  seattleAsianLanguagesPlan,
  seattleAsianStudiesPlan,
  seattleAstronomyPlan,
  seattleAtmosphericClimateSciencePlan,
  seattleBiochemistrySeattlePlan,
  seattleBiologySeattlePlan,
  seattleBusinessAdministrationPlan,
  seattleCepPlan,
  seattleCfrmPlan,
  seattleChemistrySeattlePlan,
  seattleChinesePlan,
  seattleChiPlan,
  seattleCinemaMediaStudiesPlan,
  seattleClassicalStudiesPlan,
  seattleClassicsPlan,
  seattleCommunicationPlan,
  seattleComparativeLiteraturePlan,
  seattleComparativeReligionPlan,
  seattleConstructionManagementPlan,
  seattleDancePlan,
  seattleDanishPlan,
  seattleDesignPlan,
  seattleDisabilityStudiesPlan,
  seattleDramaPlan,
  seattleEcfsPlan,
  seattleEconomicsPlan,
  seattleEcoPlan,
  seattleEducationStudiesPlan,
  seattleEnglishCreativeWritingPlan,
  seattleEnglishLlcPlan,
  seattleEssPlan,
  seattleMathPlan,
  seattleStatisticsPlan,
  SEEDED_RUNTIME_QA_SAMPLE_PLAN_IDS,
  SEEDED_RUNTIME_QA_SAMPLE_SEED,
  SHA_256_FINGERPRINT_RE,
  sourceGeneratedBothellPlans,
  sourceGeneratedChemistryPlan,
  sourceGeneratedEconomicsPlan,
  sourceGeneratedGeographyPlan,
  sourceGeneratedPhghPlan,
  sourceGeneratedPsychologyPlan,
  sourceGeneratedStatisticsPlan,
  sourceGeneratedTacomaAmcPlan,
  sourceGeneratedTacomaBabaPlan,
  sourceGeneratedTacomaBiomedPlan,
  sourceGeneratedTacomaCriminalJusticePlan,
  sourceGeneratedTacomaEglsPlan,
  sourceGeneratedTacomaEnvSustainabilityPlan,
  sourceGeneratedTacomaPlans,
  sourceGeneratedTacomaSudPlan,
  sourceGeneratedTacomaUrbanStudiesPlan,
  spawnSync,
  statSync,
  tacomaAmcPlan,
  tacomaCivilPlan,
  tacomaCommunicationDetailedPlan,
  tacomaCommunicationPlan,
  tacomaCompEPlan,
  tacomaCompETrack,
  tacomaCssBaPlan,
  tacomaCssBsPlan,
  tacomaEducationPlan,
  tacomaEePlan,
  tacomaEeTrack,
  tacomaEglsDetailedPlan,
  tacomaEnvSciencePlan,
  tacomaEnvSustainabilityPlan,
  tacomaEpaPlan,
  tacomaHealthcareLeadershipPlan,
  tacomaHistoryPlan,
  tacomaIasIndividuallyDesignedPlan,
  tacomaIasPlan,
  tacomaItPlan,
  tacomaLawPolicyPlan,
  tacomaMathPlan,
  tacomaNursingPlan,
  tacomaPpePlan,
  tacomaPsychologyPlan,
  tacomaSocialWelfarePlan,
  tacomaSpanishPlan,
  tacomaSustainableUrbanDevelopmentPlan,
  tacomaUrbanDesignPlan,
  tacomaUrbanStudiesPlan,
  tacomaWritingPlan,
  test,
  tmpdir,
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS,
  TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY,
  TRANSFER_PLANNER_COURSE_METADATA_FIELD_GAP_STATES,
  TRANSFER_PLANNER_COURSE_METADATA_FIELD_GAPS,
  TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY,
  TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY,
  TRANSFER_PLANNER_GENERATED_COURSE_METADATA,
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY,
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS,
  TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY,
  TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY_SOURCE_URLS,
  TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY,
  TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY,
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY,
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS,
  TRANSFER_PLANNER_POLICY_REGISTRY,
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY,
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY,
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_REGISTRY_SUMMARY,
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY,
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY,
  TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY,
  TRANSFER_PLANNER_SOURCE_GAP_REGISTRY,
  TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS,
  TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY,
  TRANSFER_PLANNER_SOURCE_SUMMARY,
  TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS,
  TRANSFER_PLANNER_UW_GRC_ALL_EQUIVALENCY_RULES,
  TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES,
  TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES,
  uniqueSorted,
  urlHasAllowedHostnameAndPathPrefix,
  urlHasHostname,
  urlLooksLikeBlockedPrimarySource,
  writeFileSync,
};

export type {
  TranscriptCourseEntry,
  TransferPlannerChecklistItem,
  TransferPlannerMajorPlan,
  TransferPlannerParsedRequirementSourceBlock,
};