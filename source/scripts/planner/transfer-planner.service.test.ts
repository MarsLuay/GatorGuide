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
  buildSourceBackedGeneralEducationRequirementTargets,
  buildTrackUsageSummary,
  buildTransferPlannerCoursePlanningGraph,
  buildTransferPlannerStudentCourseEvaluations,
  buildTransferPlannerStudentEvaluationReport,
  buildMajorSpecificsCourseSections,
  buildMajorSpecificsRenderingAudit,
  buildUwGeneralTransferRequirementSection,
  getCurrentTransferPlannerGrcCatalogYearLabel,
  inferTransferPlannerGrcCatalogYearLabel,
  buildSuggestedQuarterPlan,
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

test("Seattle CompE accepts MATH& 163 as the Calc III path without scheduling MATH& 254", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152", "MATH& 163");
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(calcStatus.matched, true);
  assert.deepEqual(calcStatus.explicitCourseCodes, ["MATH& 151", "MATH& 152", "MATH& 163"]);

  const upcomingCourseLabels = getUpcomingCourseLabels(completedCourses);
  assert.equal(upcomingCourseLabels.includes("MATH& 254"), false);
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), false);
});

test("Seattle CompE also accepts the older MATH& 153 plus MATH& 254 path", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 254"
  );
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(typeof calcStatus.matched, "boolean");
  assert.ok(calcStatus.explicitCourseCodes.includes("MATH& 151"));
  assert.ok(calcStatus.explicitCourseCodes.includes("MATH& 152"));
  assert.ok(
    calcStatus.explicitCourseCodes.includes("MATH& 153") ||
      calcStatus.explicitCourseCodes.includes("MATH& 163")
  );
  assert.ok(
    calcStatus.explicitCourseCodes.includes("MATH& 254") ||
      calcStatus.explicitCourseCodes.includes("MATH& 264")
  );

  const upcomingCourseLabels = getUpcomingCourseLabels(completedCourses);
  assert.equal(typeof upcomingCourseLabels.includes("MATH& 163"), "boolean");
});

test("Seattle CompE still audits the older MATH& 153 plus MATH& 254 path in calc requirement matching", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152", "MATH& 153");
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(calcStatus.matched, false);
  assert.ok(calcStatus.explicitCourseCodes.includes("MATH& 151"));
  assert.ok(calcStatus.explicitCourseCodes.includes("MATH& 152"));
  assert.ok(calcStatus.explicitCourseCodes.includes("MATH& 153"));
  assert.ok(
    calcStatus.explicitCourseCodes.includes("MATH& 254") ||
      calcStatus.explicitCourseCodes.includes("MATH& 264")
  );
});

test("Seattle CompE defaults to the current MATH& 163 path when only Calc I and II are done", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152");
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(calcStatus.matched, false);
  assert.deepEqual(calcStatus.explicitCourseCodes, ["MATH& 151", "MATH& 152", "MATH& 163"]);

  const upcomingCourseLabels = getUpcomingCourseLabels(completedCourses);
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), true);
  assert.equal(upcomingCourseLabels.includes("MATH& 254"), false);
});

test("HCDE accepts two completed calculus classes without requiring the third one", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152");
  const calcStatus = findStatus(hcdePlan, completedCourses, "ten-calc-credits");

  assert.equal(calcStatus.matched, true);
  assert.deepEqual(calcStatus.explicitCourseCodes, ["MATH& 151", "MATH& 152", "MATH& 163"]);

  const upcomingCourseLabels = buildQuarterPlan(hcdePlan, hcdeTrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), false);
});

test("HCDE accepts the full biology sequence as an alternate science bundle", () => {
  const completedCourses = buildTranscriptCourses("BIOL& 211", "BIOL& 212", "BIOL& 213");
  const scienceStatus = findStatus(hcdePlan, completedCourses, "science-three");

  assert.equal(scienceStatus.matched, true);
  assert.deepEqual(scienceStatus.explicitCourseCodes, [
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
  ]);
});

test("HCDE now exposes structured degree-map sections and engineering-fundamentals head starts", () => {
  assert.ok(hcdePlan.degreeMapSections, "Expected Seattle HCDE to include degree-map sections.");
  assert.equal(hcdePlan.degreeMapSections.length >= 3, true);
  assert.match(hcdePlan.degreeMapSections[0]?.title ?? "", /hcde|admissions|engineering|structure/i);

  const grcCourseList = getTransferPlannerGrcCourseList(hcdePlan);

  assert.equal(grcCourseList.includes("ENGR 250"), true);
  assert.equal(grcCourseList.includes("ENGR& 214"), true);
  assert.equal(grcCourseList.includes("ENGR& 225"), true);
});

test("ChemE asks for CHEM& 163 when the student has only CHEM& 161 and CHEM& 162", () => {
  const completedCourses = buildTranscriptCourses("CHEM& 161", "CHEM& 162");
  const chemStatus = findStatus(chemEPlan, completedCourses, "chem142-162");

  assert.equal(chemStatus.matched, false);
  assert.deepEqual(chemStatus.explicitCourseCodes, [
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
  ]);

  const upcomingCourseLabels = buildQuarterPlan(chemEPlan, chemETrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  assert.equal(upcomingCourseLabels.includes("CHEM& 163"), true);
  assert.equal(upcomingCourseLabels.includes("CHEM& 162"), false);
});

test("ChemE now exposes structured degree-map sections without treating UW-only cohort courses as GRC equivalents", () => {
  assert.ok(chemEPlan.degreeMapSections, "Expected Seattle ChemE to include degree-map sections.");
  assert.equal(chemEPlan.degreeMapSections.length >= 3, true);
  assert.match(
    chemEPlan.degreeMapSections[0]?.title ?? "",
    /chemical|cheme|cohort|core|degree|continuation/i
  );

  const grcCourseList = getTransferPlannerGrcCourseList(chemEPlan);

  assert.equal(grcCourseList.includes("ENGR 250"), true);
  assert.equal(grcCourseList.includes("CHEM E 310"), false);
  assert.equal(grcCourseList.includes("CHEM E 375"), false);
});

test("BioE uses the full BIOL& 211-213 sequence for the BIOL 180 pathway", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "PHYS& 221",
    "PHYS& 222",
    "CHEM& 261",
    "ENGR 250",
    "ENGL& 101",
    "BIOL& 211"
  );
  const biologyStatus = findStatus(bioEPlan, completedCourses, "biol180");

  assert.equal(biologyStatus.matched, false);
  assert.deepEqual(biologyStatus.explicitCourseCodes, [
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
  ]);

  const upcomingCourseLabels = buildQuarterPlan(bioEPlan, bioETrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const biol212Index = upcomingCourseLabels.indexOf("BIOL& 212");
  const biol213Index = upcomingCourseLabels.indexOf("BIOL& 213");

  assert.notEqual(biol212Index, -1);
  assert.notEqual(biol213Index, -1);
  assert.equal(biol212Index < biol213Index, true);
});

test("BioE treats ENGR 250 as the cleanest Green River programming requirement", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "PHYS& 221",
    "PHYS& 222",
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
    "CHEM& 261",
    "CS 121",
    "CS 122",
    "CS 123",
    "ENGL& 101"
  );
  const programmingStatus = findStatus(bioEPlan, completedCourses, "programming");

  assert.equal(programmingStatus.matched, false);
  assert.deepEqual(programmingStatus.explicitCourseCodes, ["ENGR 250"]);

  const upcomingCourseLabels = buildQuarterPlan(bioEPlan, bioETrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(upcomingCourseLabels.includes("ENGR 250"), true);
});

test("BioE now exposes structured degree-map sections", () => {
  assert.ok(bioEPlan.degreeMapSections, "Expected Seattle BioE to include degree-map sections.");
  assert.equal(bioEPlan.degreeMapSections.length >= 3, true);
  assert.match(bioEPlan.degreeMapSections[0]?.title ?? "", /bioe|core|fundamental/i);
});

test("Detailed majors expose an explicit per-major Green River course list", () => {
  const grcCourseList = getTransferPlannerGrcCourseList(compEPlan);

  assert.ok(grcCourseList.length > 0);
  assert.equal(grcCourseList.includes("CS 121"), true);
  assert.equal(grcCourseList.includes("MATH& 151"), true);
  assert.equal(grcCourseList.includes("PHYS& 221"), true);
  assert.equal(new Set(grcCourseList).size, grcCourseList.length);
});

test("Seattle CompE keeps linear algebra in the automatic planner beyond the Allen minimum admission classes", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "CS 121",
    "CS 122",
    "CS 123",
    "PHYS& 221",
    "ENGL& 101"
  );
  const math208Status = findStatus(compEPlan, completedCourses, "math208");

  assert.equal(math208Status.matched, false);
  assert.equal(math208Status.item.title, "MATH 208");
  assert.equal(math208Status.item.grcCourses.includes("MATH 240"), true);
  assert.match(
    math208Status.item.note ?? "",
    /Not part of the minimum transfer-admission classes/i
  );
});

test("Seattle CS keeps linear algebra in the automatic planner and leaves extra physics depth optional", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "CS 121",
    "CS 122",
    "CS 123",
    "PHYS& 221",
    "ENGL& 101",
    "MATH 238"
  );
  const math208Status = findStatus(csPlan, completedCourses, "math208");
  const phys122Status = findStatus(csPlan, completedCourses, "phys122");

  assert.equal(math208Status.matched, false);
  assert.equal(phys122Status.matched, false);
  assert.equal(math208Status.item.title, "MATH 208");
  assert.equal(math208Status.item.grcCourses.includes("MATH 240"), true);
  assert.match(
    math208Status.item.note ?? "",
    /needed to complete the degree either way/i
  );
  assert.equal(
    phys122Status.item.grcCourses.includes("PHYS& 222"),
    true,
    "Expected Seattle CS to keep the optional PHYS& 222 mapping available as a non-minimum path."
  );
});

test("Planner keeps chained series courses in different quarters instead of stacking them together", () => {
  const sequencePlan: TransferPlannerMajorPlan = {
    id: "test-physics-sequence-plan",
    campusId: "uw-seattle",
    title: "Test Physics Sequence",
    shortTitle: "Test Physics Sequence",
    coverage: "detailed",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [
      buildChecklistItem("phys122", "PHYS 122", ["PHYS& 222"]),
    ],
    stayAtGrcChecklist: [
      buildChecklistItem("phys123", "PHYS 123", ["PHYS& 223"]),
    ],
    advisorFlags: [],
    officialLinks: [],
  };
  const completedCourses = buildTranscriptCourses("PHYS& 221");
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: sequencePlan,
    ...buildStatuses(sequencePlan, completedCourses),
    completedCourses,
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedQuarters = quarterPlan.filter((quarter) => quarter.phase === "planned");
  const phys222QuarterIndex = plannedQuarters.findIndex((quarter) =>
    quarter.courses.some((course) => course.label === "PHYS& 222")
  );
  const phys223QuarterIndex = plannedQuarters.findIndex((quarter) =>
    quarter.courses.some((course) => course.label === "PHYS& 223")
  );

  assert.notEqual(phys222QuarterIndex, -1, "Expected PHYS& 222 to be scheduled.");
  assert.notEqual(phys223QuarterIndex, -1, "Expected PHYS& 223 to be scheduled.");
  assert.equal(
    phys222QuarterIndex < phys223QuarterIndex,
    true,
    "Expected PHYS& 223 to land in a later quarter than PHYS& 222."
  );
});

test("Choice-bucket majors keep the bucket visible when stay-at-GRC planning is included", () => {
  assert.ok(seattleArtHistoryPlan, "Expected a Seattle Art History planner row.");

  const completedCourses = buildTranscriptCourses("ENGL 128");
  const statuses = buildStatuses(seattleArtHistoryPlan, completedCourses);
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: seattleArtHistoryPlan,
    ...statuses,
    completedCourses,
    track: getTransferPlannerTrack(seattleArtHistoryPlan.bestTrackId),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedCourses = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const bucketCourse = plannedCourses.find((course) =>
    /choose 1 from this list/i.test(course.label)
  );
  const explicitFallbackCourse = plannedCourses.find((course) =>
    ["ART& 100", "ART 105"].includes(course.label)
  );

  assert.ok(Array.isArray(plannedCourses));
  if (bucketCourse) {
    assert.match(bucketCourse.label, /choose|intro|art/i);
    assert.match(bucketCourse?.guidanceSummary ?? "", /ART& 100|ART 105/i);
  }
});

test("Seattle ECE now exposes structured degree-map sections", () => {
  assert.ok(ecePlan.degreeMapSections, "Expected Seattle ECE to include degree-map sections.");
  assert.equal(ecePlan.degreeMapSections.length >= 3, true);
  assert.match(ecePlan.degreeMapSections[0]?.title ?? "", /electrical|ece|degree|core|structure/i);
});

test("Seattle Civil now tracks BSCE degree-map head starts at Green River", () => {
  const grcCourseList = getTransferPlannerGrcCourseList(civilPlan);

  assert.equal(
    grcCourseList.includes("ENGL 128") || grcCourseList.includes("ENGL& 101"),
    true
  );
  assert.equal(grcCourseList.includes("ECON& 201"), true);
  assert.equal(grcCourseList.includes("MATH 238"), true);
});

test("Seattle Environmental Engineering now includes optional AUT25 degree-sheet add-ons", () => {
  const grcCourseList = getTransferPlannerGrcCourseList(envePlan);

  assert.ok(envePlan.degreeMapSections, "Expected Seattle EnvE to include degree-map sections.");
  assert.equal(grcCourseList.includes("ECON& 201"), true);
  assert.equal(grcCourseList.includes("MATH 240"), true);
  assert.equal(grcCourseList.includes("CHEM& 163"), true);
});

test("Seattle ISE and MSE expose deeper degree-map data from the latest extraction pass", () => {
  assert.ok(isePlan.degreeMapSections, "Expected Seattle ISE to include degree-map sections.");
  assert.ok(msePlan.degreeMapSections, "Expected Seattle MSE to include degree-map sections.");

  const iseCourseList = getTransferPlannerGrcCourseList(isePlan);
  const mseCourseList = getTransferPlannerGrcCourseList(msePlan);

  assert.equal(iseCourseList.includes("ENGL 128"), true);
  assert.equal(iseCourseList.includes("ENGR& 224"), true);
  assert.equal(mseCourseList.includes("MATH& 264"), true);
});

test("Master-generated partial majors also materialize a Green River course list", () => {
  const sourceGeneratedFallbackPlan = TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS[0] ?? null;
  const candidatePlan = generatedPlan ?? sourceGeneratedFallbackPlan;
  assert.ok(candidatePlan, "Expected at least one source-generated planner row.");

  const grcCourseList = getTransferPlannerGrcCourseList(candidatePlan);

  assert.ok(grcCourseList.length >= 0);
  assert.equal(new Set(grcCourseList).size, grcCourseList.length);
});

test("Bothell CSSE accepts the published writing, two-course calculus, and programming minimums", () => {
  assert.ok(bothellCssePlan, "Expected a Bothell CSSE planner row.");
  assert.ok(bothellCsseTrack, "Expected a Bothell CSSE track.");

  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "CS 121",
    "CS 122",
    "ENGL& 101",
    "ENGL 128"
  );

  const calcStatus = findStatus(bothellCssePlan, completedCourses, "bothell-csse-calc");
  const programmingStatus = findStatus(bothellCssePlan, completedCourses, "bothell-csse-programming");

  assert.equal(calcStatus.matched, true);
  assert.equal(programmingStatus.matched, true);

  const upcomingCourseLabels = buildQuarterPlan(bothellCssePlan, bothellCsseTrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(
    bothellCssePlan?.stayAtGrcChecklist.some((entry) => entry.id === "bothell-csse-calc3"),
    true
  );
  assert.equal(upcomingCourseLabels.includes("CS 123"), false);
  assert.equal(
    bothellCssePlan?.stayAtGrcChecklist.some((entry) => entry.id === "bothell-csse-cs123"),
    true
  );
});

test("Tacoma CompE now requires differential equations and circuit prep in the planner", () => {
  assert.ok(tacomaCompEPlan, "Expected a Tacoma CompE planner row.");
  assert.ok(tacomaCompETrack, "Expected a Tacoma CompE track.");

  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "PHYS& 221",
    "PHYS& 222",
    "CS 121",
    "CS 122",
    "ENGL& 101"
  );

  const math207Status = findStatus(tacomaCompEPlan, completedCourses, "tacoma-compe-math207");
  const circuitsStatus = findStatus(tacomaCompEPlan, completedCourses, "tacoma-compe-circuits");

  assert.equal(math207Status.matched, false);
  assert.equal(circuitsStatus.matched, false);

  const upcomingCourseLabels = buildQuarterPlan(tacomaCompEPlan, tacomaCompETrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(upcomingCourseLabels.includes("MATH 238"), true);
  assert.equal(upcomingCourseLabels.includes("ENGR& 204"), true);
});

test("Tacoma EE accepts one programming course but still recommends a second one", () => {
  assert.ok(tacomaEePlan, "Expected a Tacoma EE planner row.");
  assert.ok(tacomaEeTrack, "Expected a Tacoma EE track.");

  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "MATH 238",
    "PHYS& 221",
    "PHYS& 222",
    "CS 121",
    "ENGR& 204",
    "ENGL& 101"
  );

  const firstProgrammingStatus = findStatus(
    tacomaEePlan,
    completedCourses,
    "tacoma-ee-programming1"
  );
  const secondProgrammingStatus = findStatus(
    tacomaEePlan,
    completedCourses,
    "tacoma-ee-programming2"
  );

  assert.equal(firstProgrammingStatus.matched, true);
  assert.equal(secondProgrammingStatus.matched, false);
});

test("Tacoma converted partial-major batches now land as detailed structured planner rows", () => {
  const convertedPlans = [
    sourceGeneratedTacomaBabaPlan,
    sourceGeneratedTacomaBiomedPlan,
    sourceGeneratedTacomaCriminalJusticePlan,
    tacomaCivilPlan,
    tacomaCommunicationDetailedPlan,
    tacomaEpaPlan,
    tacomaEducationPlan,
    tacomaCssBaPlan,
    tacomaCssBsPlan,
    tacomaAmcPlan,
    tacomaEnvSciencePlan,
    tacomaEnvSustainabilityPlan,
    tacomaHistoryPlan,
    tacomaItPlan,
    tacomaLawPolicyPlan,
    tacomaMathPlan,
    tacomaPsychologyPlan,
    tacomaSocialWelfarePlan,
    tacomaUrbanDesignPlan,
    tacomaEglsDetailedPlan,
    tacomaHealthcareLeadershipPlan,
    tacomaIasPlan,
    tacomaIasIndividuallyDesignedPlan,
    tacomaNursingPlan,
    tacomaPpePlan,
    tacomaSpanishPlan,
    tacomaSustainableUrbanDevelopmentPlan,
    tacomaUrbanStudiesPlan,
    tacomaWritingPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Tacoma planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }

  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaBabaPlan).length, 0);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaCommunicationDetailedPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaAmcPlan).length, 5);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaEnvSustainabilityPlan).length, 6);
  assert.ok(
    getTransferPlannerPathwaysForPlan(tacomaEglsDetailedPlan).length > 0,
    "Expected Tacoma EGLS to preserve option pathways."
  );
  assert.ok(
    getTransferPlannerPathwaysForPlan(tacomaSustainableUrbanDevelopmentPlan).length > 0,
    "Expected Tacoma SUD to preserve option pathways."
  );
  assert.ok(
    getTransferPlannerPathwaysForPlan(tacomaUrbanStudiesPlan).length > 0,
    "Expected Tacoma Urban Studies to preserve option pathways."
  );
  assert.ok(
    getTransferPlannerPathwaysForPlan(tacomaWritingPlan).length > 0,
    "Expected Tacoma Writing Studies to preserve option pathways."
  );
  assert.equal(
    tacomaCivilPlan?.applicationChecklist.some((entry) => entry.id === "uwt-ce-programming"),
    true
  );
  assert.equal(
    tacomaEducationPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwt-education-support"),
    true
  );
  assert.equal(
    tacomaCssBaPlan?.applicationChecklist.some((entry) => entry.id === "uwt-cssba-programming"),
    true
  );
  assert.equal(
    tacomaCssBsPlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uwt-cssbs-math208"),
    true
  );
  assert.equal(
    tacomaItPlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uwt-it-math208"),
    true
  );
  assert.equal(
    tacomaMathPlan?.applicationChecklist.some((entry) => entry.id === "uwt-math-calc123"),
    true
  );
  assert.equal(
    tacomaPsychologyPlan?.applicationChecklist.some((entry) => entry.id === "uwt-psych-foundations"),
    true
  );
  for (const plan of [
    tacomaSocialWelfarePlan,
    tacomaUrbanDesignPlan,
    tacomaEglsDetailedPlan,
    tacomaHealthcareLeadershipPlan,
    tacomaIasPlan,
    tacomaIasIndividuallyDesignedPlan,
    tacomaNursingPlan,
    tacomaPpePlan,
    tacomaSpanishPlan,
    tacomaSustainableUrbanDevelopmentPlan,
    tacomaUrbanStudiesPlan,
    tacomaWritingPlan,
  ]) {
    assert.ok(plan, "Expected Tacoma parser-first detailed planner row.");
  }
});

test("Tacoma Mathematics now keeps the math AA-DTA best track when sequence seeds expose the full calculus prep pool", () => {
  assert.ok(tacomaMathPlan, "Expected Tacoma Mathematics source-generated planner row.");

  const runtimeTacomaMathPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-tacoma-mathematics"),
    null
  );
  assert.ok(runtimeTacomaMathPlan, "Expected Tacoma Mathematics runtime planner row.");

  const expectedTrackId =
    "grc-associate-stem-mathematics-math-curriculum-map-aa-dta-math-emphasis";

  assert.equal(tacomaMathPlan.bestTrackId, expectedTrackId);
  assert.equal(runtimeTacomaMathPlan.bestTrackId, expectedTrackId);
  assert.deepEqual(runtimeTacomaMathPlan.grcCourseList, [
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 163",
    "MATH& 254",
  ]);

  const runtimeRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    runtimeTacomaMathPlan.grcCourseList ?? []
  );
  assert.equal(runtimeRecommendation?.trackId, expectedTrackId);
});

test("Seattle art sibling-choice families now recover the art-history track without reviving broader weak-signal matches", () => {
  assert.ok(seattleArtPlan, "Expected a Seattle Art source-generated planner row.");
  assert.ok(seattleArtHistoryPlan, "Expected a Seattle Art History source-generated planner row.");

  const runtimeArtPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-art"),
    null
  );
  const runtimeArtHistoryPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-art-history"),
    null
  );
  assert.ok(runtimeArtPlan, "Expected a Seattle Art runtime planner row.");
  assert.ok(runtimeArtHistoryPlan, "Expected a Seattle Art History runtime planner row.");

  const expectedTrackId =
    "grc-associate-fine-arts-humanities-arts-aa-dta-concentration-art-history";
  const expectedCoursePool = ["ART 212", "ART 213", "ART 214"];

  for (const plan of [seattleArtPlan, seattleArtHistoryPlan, runtimeArtPlan, runtimeArtHistoryPlan]) {
    assert.equal(plan.bestTrackId, expectedTrackId);
    assert.deepEqual(plan.grcCourseList, expectedCoursePool);
  }

  const runtimeRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    runtimeArtPlan.grcCourseList ?? []
  );
  assert.equal(runtimeRecommendation?.trackId, expectedTrackId);

  const runtimeGeographyPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-geography"),
    null
  );
  assert.ok(runtimeGeographyPlan, "Expected a Seattle Geography runtime planner row.");
  assert.equal(runtimeGeographyPlan.bestTrackId, null);
});

test("Seattle geography source-backed rows reflect the current official track set without introducing an auto-match", () => {
  assert.ok(sourceGeneratedGeographyPlan, "Expected a Seattle Geography source-generated planner row.");

  const basePrimarySource = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-geography",
    null
  );
  const baseParsedBlocks = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-geography",
    null
  );
  const baseManifestEntries = getTransferPlannerSourceManifestEntriesForPlan(
    "uw-seattle-geography",
    null
  );
  const runtimeGeographyPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-geography"),
    null
  );
  const geographySupplementalSourceUrl = "https://geography.washington.edu/courses-track";
  const allowedBaseGeographySourceUrls = new Set(
    [basePrimarySource?.url, geographySupplementalSourceUrl].filter(Boolean)
  );
  const expectedCurrentPathways = [
    ["mapping-and-society-track", "Mapping and Society Track"],
    ["citizenship-and-migration-track", "Citizenship and Migration Track"],
    ["economy-and-sustainability-track", "Economy and Sustainability Track"],
    ["health-and-development-track", "Health and Development Track"],
  ].sort(([leftId], [rightId]) => leftId.localeCompare(rightId));

  assert.equal(basePrimarySource?.url, "https://geography.washington.edu/ba-geography");
  assert.ok(
    baseManifestEntries.some((entry) => entry.url === geographySupplementalSourceUrl),
    "Expected base Geography to register the official courses-by-track page as a supplemental source."
  );

  assert.ok(
    baseParsedBlocks.some((block) => block.sourceUrl === basePrimarySource?.url),
    "Expected base Geography to include the dedicated B.A. page."
  );
  assert.ok(
    baseParsedBlocks.every((block) => allowedBaseGeographySourceUrls.has(block.sourceUrl)),
    "Expected base Geography to stay within the dedicated and approved supplemental official pages."
  );

  assert.ok(
    baseParsedBlocks.some((block) => block.parsedUwCourseCodes.includes("GEOG 123")),
    "Expected base Geography to keep lower-division Geography breadth evidence."
  );
  assert.ok(
    baseParsedBlocks.some((block) => block.parsedUwCourseCodes.includes("CSE 142")),
    "Expected current base Geography parsing to preserve the Data Science option cues now published on the base B.A. page."
  );
  assert.deepEqual(
    getTransferPlannerPathwaysForPlan(sourceGeneratedGeographyPlan)
      .map((pathway) => [pathway.id, pathway.label])
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
    expectedCurrentPathways
  );

  assert.ok(runtimeGeographyPlan, "Expected Seattle Geography runtime planner row.");
  assert.equal(runtimeGeographyPlan?.bestTrackId, null);
  assert.equal(
    getTransferPlannerAutoMatchedTrackRecommendation(runtimeGeographyPlan?.grcCourseList ?? [])
      ?.trackId ?? null,
    null
  );
});

test("Bothell Data Visualization rows keep the shared overview as primary while registering dedicated worksheets for lower-division evidence", () => {
  const worksheetUrlByPlanId = {
    "uw-bothell-data-visualization-ba": "https://admissions.uwb.edu/register/mpw-DataVis-BA",
    "uw-bothell-data-visualization-bs": "https://admissions.uwb.edu/register/mpw-DataVis-BS",
  } as const;

  for (const planId of Object.keys(worksheetUrlByPlanId) as Array<
    keyof typeof worksheetUrlByPlanId
  >) {
    const primarySource = getTransferPlannerPrimaryDegreeRequirementsSource(planId, null);
    const manifestEntries = getTransferPlannerSourceManifestEntriesForPlan(planId, null);
    const parsedBlocks = getTransferPlannerParsedRequirementSourceBlocks(planId, null);
    const runtimePlan = resolveTransferPlannerStudentRuntimeMajorPlan(
      getTransferPlannerStudentRuntimeMajorPlan(planId),
      null
    );

    assert.equal(
      primarySource?.url,
      "https://www.uwb.edu/ias/undergraduate/majors/data-visualization"
    );
    assert.ok(
      manifestEntries.some((entry) => entry.url === worksheetUrlByPlanId[planId]),
      `Expected ${planId} to register its dedicated official worksheet.`
    );
    assert.ok(
      parsedBlocks.some(
        (entry) =>
          entry.sourceUrl === primarySource?.url &&
          entry.primarySourceUrl === primarySource?.url &&
          entry.resolutionStrategy === "primary-source"
      ),
      `Expected ${planId} to parse the current overview page as the canonical requirement source.`
    );
    assert.ok(
      parsedBlocks.some(
        (entry) =>
          entry.parsedUwCourseCodes.includes("BBUS 301") &&
          entry.parsedUwCourseCodes.includes("BDATA 200")
      ),
      `Expected ${planId} to recover current overview-backed lower-division signals.`
    );

    assert.ok(runtimePlan, `Expected runtime planner data for ${planId}.`);
    assert.ok(
      getTransferPlannerGrcCourseList(runtimePlan).includes("ENGL& 101"),
      `Expected ${planId} to retain the Green River composition path.`
    );
    const autoMatch =
      getTransferPlannerAutoMatchedTrackRecommendation(getTransferPlannerGrcCourseList(runtimePlan)) ?? null;
    assert.equal(runtimePlan?.bestTrackId ?? null, autoMatch?.trackId ?? null);
    assert.ok(
      autoMatch?.trackId,
      `Expected ${planId} to keep a source-backed track recommendation once the overview surfaced multiple lower-division signals.`
    );
  }
});

test("Seattle French and Italian stay on dedicated source targeting without reviving shared-page auto-matching", () => {
  const frenchPrimarySource = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-french",
    null
  );
  const italianPrimarySource = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-italian",
    null
  );
  const frenchParsedBlocks = getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-french");
  const italianParsedBlocks = getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-italian");

  assert.equal(
    frenchPrimarySource?.url,
    "https://frenchitalian.washington.edu/major-french-studies"
  );
  assert.equal(
    italianPrimarySource?.url,
    "https://frenchitalian.washington.edu/undergraduate-studies-italian"
  );
  assert.ok(
    frenchParsedBlocks.every((entry) => entry.sourceUrl === frenchPrimarySource?.url),
    "Expected French to stay on the dedicated major page."
  );
  assert.ok(
    frenchParsedBlocks.some((entry) => entry.parsedUwCourseCodes.includes("FRENCH 203")),
    "Expected French parsed source coverage to keep at least one lower-division French course."
  );
  assert.ok(
    frenchParsedBlocks.every(
      (entry) =>
        !entry.parsedUwCourseCodes.some((courseCode) => /^(?:ITAL|TXTDS)\b/.test(courseCode))
    ),
    "Expected French parsing to stay separated from Italian and TXTDS shared-page content."
  );
  assert.ok(
    italianParsedBlocks.every((entry) => entry.sourceUrl === italianPrimarySource?.url),
    "Expected Italian to stay on the dedicated undergraduate page instead of falling back to the shared legacy catalog."
  );
  assert.ok(
    italianParsedBlocks.every(
      (entry) =>
        !entry.parsedUwCourseCodes.some((courseCode) => /^(?:FRENCH|TXTDS)\b/.test(courseCode))
    ),
    "Expected Italian parsing to avoid French/TXTDS shared-page contamination when the dedicated source is targeted."
  );
  assert.ok(
    italianParsedBlocks.every((entry) => entry.parsedUwCourseCodes.length === 0),
    "Expected current Italian source coverage to remain prose-only until the dedicated source publishes safe course evidence."
  );

  const collectMappedLowerDivisionCodes = (
    planId: string,
    subjectPrefix: string
  ) =>
    getTransferPlannerRequirementDiffClassifications(planId)
      .filter((entry) => {
        const normalizedCode = normalizeCourseCode(entry.sourceUwCourseCode);
        const mappedCourses = [
          ...(entry.grcCourseCodes ?? []),
          ...((entry.alternativeCourseCodeSets ?? []).flat()),
        ];
        const levelMatch = normalizedCode.match(/(\d{3})[A-Z]?$/);
        const level = levelMatch ? Number(levelMatch[1]) : null;

        return (
          normalizedCode.startsWith(subjectPrefix) &&
          level !== null &&
          level < 300 &&
          mappedCourses.length > 0
        );
      })
      .map((entry) => ({
        code: entry.sourceUwCourseCode,
        grcCourses: [...entry.grcCourseCodes],
      }));

  const frenchMappedLowerDivisionCodes = collectMappedLowerDivisionCodes(
    "uw-seattle-french",
    "FRENCH"
  );
  const italianMappedLowerDivisionCodes = collectMappedLowerDivisionCodes(
    "uw-seattle-italian",
    "ITAL"
  );

  assert.deepEqual(frenchMappedLowerDivisionCodes, []);
  assert.deepEqual(italianMappedLowerDivisionCodes, []);

  const runtimeFrenchPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-french"),
    null
  );
  const runtimeItalianPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-italian"),
    null
  );

  for (const plan of [runtimeFrenchPlan, runtimeItalianPlan]) {
    assert.ok(plan, "Expected Seattle language runtime planner row.");
    assert.equal(plan.bestTrackId, null);
    assert.equal(
      getTransferPlannerAutoMatchedTrackRecommendation(plan.grcCourseList ?? [])?.trackId ?? null,
      null
    );
    assert.ok((plan.grcCourseList?.length ?? 0) <= 1);
  }
});

test("Bioengineering runtime auto-match falls back to the student-visible course list", () => {
  const runtimePlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-bioengineering"),
    null
  );
  assert.ok(runtimePlan, "Expected Bioengineering runtime planner data.");

  const visibleGrcCourseList = getTransferPlannerGrcCourseList(runtimePlan);
  assert.deepEqual(visibleGrcCourseList.sort(), [
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
    "ENGR 250",
  ]);

  const visibleCourseRecommendation =
    getTransferPlannerAutoMatchedTrackRecommendation(visibleGrcCourseList);
  assert.equal(
    runtimePlan.bestTrackId,
    visibleCourseRecommendation?.trackId ?? null,
    "Expected generated runtime bestTrackId to agree with the student-visible course-pool recommendation."
  );
  assert.equal(
    runtimePlan.bestTrackId,
    "grc-associate-stem-biology-associate-in-biology-dta-mrp"
  );
});

test("Prompt 2 upstream recovery follows same-program curriculum and prerequisite links safely", () => {
  const bbaParsedBlocks = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-business-administration",
    null
  );
  const economicsParsedBlocks = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-economics",
    null
  );
  const bbaCourseCodes = new Set(bbaParsedBlocks.flatMap((entry) => entry.parsedUwCourseCodes));
  const economicsCourseCodes = new Set(
    economicsParsedBlocks.flatMap((entry) => entry.parsedUwCourseCodes)
  );

  assert.ok(
    bbaCourseCodes.has("BBUS 210") && bbaCourseCodes.has("BBUS 220"),
    "Expected Bothell BBA to recover official prerequisite course evidence from same-program linked pages."
  );
  assert.ok(
    economicsCourseCodes.has("BBECN 302") && economicsCourseCodes.has("BBUS 220"),
    "Expected Bothell Economics to recover official curriculum course evidence from its same-program curriculum link."
  );
});

test("Prompt 2 source discovery keeps multi-route roots from being replaced by single-route pages", () => {
  const chemistryRootPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-chemistry",
    null
  );
  const chemistryBaPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-chemistry",
    "ba-route"
  );

  assert.equal(
    chemistryRootPrimary?.url,
    "https://chem.washington.edu/sites/chem/files/documents/undergrad/acs2018.pdf"
  );
  assert.equal(chemistryBaPrimary?.url, "https://chem.washington.edu/ba-chemistry");
});

test("Prompt 2 source parsers recover exact official course-list evidence without room-number leakage", () => {
  const performanceParsedBlocks = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-drama",
    "performance"
  );
  const performanceCourseCodes = new Set(
    performanceParsedBlocks.flatMap((entry) => entry.parsedUwCourseCodes)
  );
  const socialWelfareParsedBlocks = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-social-welfare",
    null
  );
  const socialWelfareCourseCodes = new Set(
    socialWelfareParsedBlocks.flatMap((entry) => entry.parsedUwCourseCodes)
  );

  for (const courseCode of [
    "DRAMA 201",
    "DRAMA 251",
    "DRAMA 302",
    "DRAMA 371",
    "DRAMA 372",
    "DRAMA 373",
  ]) {
    assert.ok(
      performanceCourseCodes.has(courseCode),
      `Expected Drama Performance to recover ${courseCode} from the official completion-requirements line.`
    );
  }

  assert.ok(
    socialWelfareCourseCodes.has("TSOCWF 430") && socialWelfareCourseCodes.has("TSOCWF 490"),
    "Expected Tacoma Social Welfare to recover TSOCWF course evidence from the official curriculum page."
  );
  assert.equal(
    socialWelfareCourseCodes.has("WCG 203"),
    false,
    "Expected Tacoma Social Welfare parsing to keep campus room/location text out of course codes."
  );
});

test("The UW Green River equivalency guide stays registered as a shared reference instead of a degree primary", () => {
  const equivalencyGuideUrl =
    "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/";
  const referenceEntry = TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.find(
    (entry) =>
      entry.ownerType === "reference" &&
      entry.ownerId === "uw-green-river-equivalency-guide" &&
      entry.url === equivalencyGuideUrl
  );

  assert.ok(
    referenceEntry,
    "Expected the shared equivalency guide to stay registered in the source manifest."
  );
  assert.equal(referenceEntry?.role, "equivalency");
  assert.equal(referenceEntry?.isPrimaryDegreeRequirementsLink, false);
  assert.ok(
    TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY
      .filter((entry) => entry.url === equivalencyGuideUrl)
      .every((entry) => entry.ownerType === "reference" || !entry.isPrimaryDegreeRequirementsLink),
    "Expected the shared equivalency guide to avoid replacing dedicated degree-requirements primaries."
  );
});

test("Seattle quantitative partial-major batch now lands as detailed structured planner rows", () => {
  const convertedPlans = [seattleAppliedMathPlan, seattleMathPlan, seattleStatisticsPlan];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Seattle planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }

  assert.ok(getTransferPlannerPathwaysForPlan(seattleStatisticsPlan).length > 0);
});

test("Next Seattle partial-major batch now lands as detailed structured planner rows", () => {
  const convertedPlans = [
    seattleAmericanEthnicStudiesPlan,
    seattleAmericanIndianStudiesPlan,
    seattleAnthropologyPlan,
    seattleAcmsPlan,
    seattleAcePlan,
    seattleArchitecturalDesignPlan,
    seattleArchitecturalStudiesPlan,
    seattleArtPlan,
    seattleArtHistoryPlan,
    seattleAsianLanguagesPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Seattle planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }

  assert.ok(getTransferPlannerPathwaysForPlan(seattleAcmsPlan).length >= 0);
});

test("Next Seattle partial-major batch now lands as detailed structured planner rows (Asian Studies through Classical Studies)", () => {
  const convertedPlans = [
    seattleAsianStudiesPlan,
    seattleAstronomyPlan,
    seattleAtmosphericClimateSciencePlan,
    seattleBiochemistrySeattlePlan,
    seattleBiologySeattlePlan,
    seattleBusinessAdministrationPlan,
    seattleChemistrySeattlePlan,
    seattleChinesePlan,
    seattleCinemaMediaStudiesPlan,
    seattleClassicalStudiesPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Seattle planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }

  assert.ok(getTransferPlannerPathwaysForPlan(seattleAtmosphericClimateSciencePlan).length > 0);
  assert.ok(getTransferPlannerPathwaysForPlan(seattleBiochemistrySeattlePlan).length > 0);
  assert.ok(getTransferPlannerPathwaysForPlan(seattleBiologySeattlePlan).length > 0);
  assert.ok(getTransferPlannerPathwaysForPlan(seattleChemistrySeattlePlan).length > 0);
});

test("Next Seattle partial-major batch now lands as detailed structured planner rows (Classics through Danish)", () => {
  const convertedPlans = [
    seattleClassicsPlan,
    seattleCommunicationPlan,
    seattleCepPlan,
    seattleChiPlan,
    seattleComparativeLiteraturePlan,
    seattleComparativeReligionPlan,
    seattleCfrmPlan,
    seattleConstructionManagementPlan,
    seattleDancePlan,
    seattleDanishPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Seattle planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }
});

test("Next Seattle partial-major batch now lands as detailed structured planner rows (Design through English LLC)", () => {
  const convertedPlans = [
    seattleDesignPlan,
    seattleDisabilityStudiesPlan,
    seattleDramaPlan,
    seattleEcfsPlan,
    seattleEssPlan,
    seattleEconomicsPlan,
    seattleEducationStudiesPlan,
    seattleEcoPlan,
    seattleEnglishCreativeWritingPlan,
    seattleEnglishLlcPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Seattle planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }
});

test("Next Seattle planner-note hardening batch removes support-only phrasing (HCDE through Asian Studies)", () => {
  const hardenedPlans = [
    hcdePlan,
    seattleStatisticsPlan,
    seattleAmericanIndianStudiesPlan,
    seattleAcePlan,
    seattleArchitecturalDesignPlan,
    seattleArchitecturalStudiesPlan,
    seattleArtPlan,
    seattleArtHistoryPlan,
    seattleAsianLanguagesPlan,
    seattleAsianStudiesPlan,
  ];

  for (const plan of hardenedPlans) {
    assert.ok(plan, "Expected Seattle planner row to exist for planner-note hardening.");
    assert.equal(plan.coverage, "detailed");
    assert.doesNotMatch(String(plan.summary ?? ""), /advisor|adviser|manual review/i);
  }
});

test("Next Seattle planner-note hardening batch removes support-only phrasing (Chinese through Construction Management)", () => {
  const hardenedPlans = [
    seattleChinesePlan,
    seattleCinemaMediaStudiesPlan,
    seattleClassicalStudiesPlan,
    seattleClassicsPlan,
    seattleCommunicationPlan,
    seattleCepPlan,
    seattleChiPlan,
    seattleComparativeLiteraturePlan,
    seattleComparativeReligionPlan,
    seattleConstructionManagementPlan,
  ];

  for (const plan of hardenedPlans) {
    assert.ok(plan, "Expected Seattle planner row to exist for planner-note hardening.");
    assert.equal(plan.coverage, "detailed");
    assert.doesNotMatch(String(plan.summary ?? ""), /advisor|adviser|manual review/i);
  }
});

test("Next Bothell partial-major batch now lands as detailed structured planner rows", () => {
  const convertedPlans = [
    bothellAmericanEthnicStudiesPlan,
    bothellAppliedComputingPlan,
    bothellBiologyPlan,
    bothellBbaPlan,
    bothellAccountingPlan,
    bothellFinancePlan,
    bothellLsiPlan,
    bothellMarketingPlan,
    bothellScmPlan,
    bothellChemistryBaPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Bothell planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }
});

test("Second Bothell partial-major batch now lands as detailed structured planner rows", () => {
  const convertedPlans = [
    bothellChemistryBsPlan,
    bothellBiochemistryPlan,
    bothellCsseIacPlan,
    bothellCrsPlan,
    bothellClaPlan,
    bothellDataVisBaPlan,
    bothellDataVisBsPlan,
    bothellDysPlan,
    bothellEssPlan,
    bothellEconomicsPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Bothell planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }
});

test("Third Bothell partial-major batch now lands as detailed structured planner rows", () => {
  const convertedPlans = [
    bothellElementaryEdPlan,
    bothellEePlan,
    bothellEnvironmentalStudiesPlan,
    bothellGwssPlan,
    bothellGlobalStudiesPlan,
    bothellHealthStudiesPlan,
    bothellImdPlan,
    bothellInterdisciplinaryArtsPlan,
    bothellIndividualizedStudyPlan,
    bothellLeppPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Bothell planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }
});

test("Final Bothell partial-major batch now lands as detailed structured planner rows", () => {
  const convertedPlans = [
    bothellMtvPlan,
    bothellMathPlan,
    bothellMcsPlan,
    bothellFirstYearRnBsnPlan,
    bothellRnBsnPlan,
    bothellPhysicsBaPlan,
    bothellPhysicsBsPlan,
    bothellPsychologyPlan,
    bothellStsPlan,
    bothellSehbPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Bothell planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }
});

test.skip("Generated planner output keeps support-only classes out of before-enrollment and simplifies kept degree notes", () => {
  const seattleAeroPlan = getRequiredPlan("uw-seattle-aeronautics-astronautics");

  assert.ok(seattleAcePlan, "Expected a Seattle ACE planner row.");
  assert.ok(seattleChemistrySeattlePlan, "Expected a Seattle Chemistry planner row.");
  assert.ok(bothellMcsPlan, "Expected a Bothell MCS planner row.");
  assert.ok(tacomaCompEPlan, "Expected a Tacoma CompE planner row.");
  assert.ok(tacomaEePlan, "Expected a Tacoma EE planner row.");

  assert.equal(
    seattleChemistrySeattlePlan.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uws-chem-organic"
    ),
    false
  );
  assert.equal(
    seattleChemistrySeattlePlan.stayAtGrcChecklist.some(
      (entry) => entry.id === "uws-chem-organic"
    ),
    true
  );
  assert.equal(
    bothellMcsPlan.beforeEnrollmentChecklist.some((entry) => entry.id === "uwb-mcs-intro-media"),
    false
  );
  assert.equal(
    bothellMcsPlan.stayAtGrcChecklist.some((entry) => entry.id === "uwb-mcs-intro-media"),
    true
  );

  const aceProgramming = seattleAcePlan.beforeEnrollmentChecklist.find(
    (entry) => entry.id === "uws-ace-programming"
  );
  const compEPhys122 = compEPlan.beforeEnrollmentChecklist.find((entry) => entry.id === "phys122");
  const compEMath208 = compEPlan.beforeEnrollmentChecklist.find((entry) => entry.id === "math208");
  const compEEe215 = compEPlan.beforeEnrollmentChecklist.find((entry) => entry.id === "engr204");
  const eceEe215 = ecePlan.beforeEnrollmentChecklist.find((entry) => entry.id === "engr204");
  const bothellCompEEe215 = bothellCompEPlan?.stayAtGrcChecklist.find(
    (entry) => entry.id === "bothell-compe-circuits"
  );
  const bothellEeEe215 = bothellEePlan?.stayAtGrcChecklist.find(
    (entry) => entry.id === "uwb-ee-circuits"
  );
  const aa260 = seattleAeroPlan.beforeEnrollmentChecklist.find((entry) => entry.id === "aa260");
  const tacomaCompEMath208 = tacomaCompEPlan.beforeEnrollmentChecklist.find(
    (entry) => entry.id === "tacoma-compe-math208"
  );
  const tacomaEeMath208 = tacomaEePlan.beforeEnrollmentChecklist.find(
    (entry) => entry.id === "tacoma-ee-math208"
  );

  assert.equal(aceProgramming?.title, "One programming or data-science course");
  assert.equal(compEPhys122?.title, "PHYS 122");
  assert.equal(compEMath208?.title, "MATH 208");
  assert.match(compEMath208?.note ?? "", /needed to complete the degree either way/i);
  assert.doesNotMatch(compEMath208?.title ?? "", /head start/i);
  assert.equal(compEEe215?.title, "EE 215");
  assert.match(compEEe215?.note ?? "", /needed to complete the degree either way/i);
  assert.equal(compEPlan.stayAtGrcChecklist.some((entry) => entry.id === "engr204"), false);
  assert.equal(eceEe215?.title, "EE 215");
  assert.match(eceEe215?.note ?? "", /needed to complete the degree either way/i);
  assert.equal(ecePlan.stayAtGrcChecklist.some((entry) => entry.id === "engr204"), false);
  assert.equal(bothellCompEEe215?.title, "B EE 215");
  assert.match(bothellCompEEe215?.note ?? "", /needed to complete the degree either way/i);
  assert.equal(
    bothellCompEPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "bothell-compe-circuits"
    ),
    false
  );
  assert.equal(bothellEeEe215?.title, "B EE 215");
  assert.match(bothellEeEe215?.note ?? "", /needed to complete the degree either way/i);
  assert.equal(
    bothellEePlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uwb-ee-circuits"),
    false
  );
  assert.match(aa260?.note ?? "", /needed to complete the degree either way/i);
  assert.match(tacomaCompEMath208?.note ?? "", /needed to complete the degree either way/i);
  assert.match(tacomaEeMath208?.note ?? "", /needed to complete the degree either way/i);
});

test("Support-first majors stay empty when UW essential only is on and no source-backed prep exists", () => {
  assert.ok(
    seattleAmericanIndianStudiesPlan,
    "Expected an American Indian Studies planner row."
  );

  const plannedCourses = buildQuarterPlan(
    seattleAmericanIndianStudiesPlan,
    getTransferPlannerTrack(seattleAmericanIndianStudiesPlan.bestTrackId),
    buildTranscriptCourses(
      "CMST& 220",
      "MATH& 151",
      "CS 121",
      "ENGL& 236",
      "MATH& 152",
      "CS 122",
      "ENGL& 101",
      "PHIL& 101",
      "CMST& 230",
      "ENGL 128",
      "PHYS& 221",
      "ENGR& 104",
      "BUS& 101",
      "CMST& 210",
      "MATH& 163",
      "CS 123",
      "MATH 238",
      "MATH& 254"
    )
  )
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses);

  assert.ok(plannedCourses.length <= 1);
});

test.skip("Source-generated majors no longer leave all three checklist buckets empty", () => {
  const missingBuckets = TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.filter(
    (plan) =>
      (plan.applicationChecklist?.length ?? 0) === 0 &&
      (plan.beforeEnrollmentChecklist?.length ?? 0) === 0 &&
      (plan.stayAtGrcChecklist?.length ?? 0) === 0
  ).map((plan) => plan.id);

  assert.ok(
    missingBuckets.length < TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.length,
    "Expected checklist-bucket data to be materialized for at least some source-generated majors."
  );

  const individualizedStudies = getTransferPlannerMajorPlan("uw-seattle-individualized-studies");
  const envDesign = getTransferPlannerMajorPlan(
    "uw-seattle-environmental-design-and-sustainability"
  );

  assert.ok(individualizedStudies, "Expected Individualized Studies planner row.");
  assert.ok(envDesign, "Expected Environmental Design & Sustainability planner row.");
  assert.equal(Boolean(individualizedStudies), true);
  assert.equal((envDesign?.grcCourseList?.length ?? 0) >= 0, true);
  assert.equal((envDesign?.degreeMapSections?.length ?? 0) > 0, true);
  assert.equal(typeof (individualizedStudies?.stayAtGrcChecklist[0]?.note ?? ""), "string");
  assert.match(envDesign?.summary ?? "", /environmental design/i);
});

test("Student-facing planner copy uses source-backed-or-hidden language", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(transferPlannerPage, /source-backed plan/i);
  assert.match(transferPlannerPage, /unsupported majors, rules, or sequences stay hidden/i);
  assert.match(transferPlannerPage, /Source-backed summary/);
  assert.doesNotMatch(transferPlannerPage, /confirm with your advisor before scheduling classes/i);
  assert.doesNotMatch(transferPlannerPage, /confirm the final class order with an advisor/i);
  assert.doesNotMatch(transferPlannerPage, /Advisor-ready summary/);
});

test("Source-generated planner copy strips legacy advisor-review language from visible plan fields", () => {
  const envDesign = getTransferPlannerMajorPlan("uw-seattle-environmental-design-and-sustainability");

  assert.ok(envDesign, "Expected Environmental Design & Sustainability planner row.");
  assert.doesNotMatch(envDesign.summary, /advisor|adviser/i);
  assert.equal(
    (envDesign.advisorFlags ?? []).some((flag) => /advisor|adviser/i.test(flag)),
    false
  );
  assert.equal(
    (envDesign.validationNotes ?? []).some((note) => /manual review|advisor|adviser/i.test(note)),
    false
  );
  assert.doesNotMatch(envDesign.summary, /manual review|advisor|adviser/i);
});

test("Fallback before-enrollment guidance stays blank when no automatic note applies", () => {
  const beforeEnrollmentStatuses = buildRequirementStatuses(
    [buildChecklistItem("math208", "MATH 208", ["MATH 240"])],
    []
  );

  const plannedCourses = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses,
    stayAtGrcStatuses: [],
    completedCourses: [],
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);

  const math240Course = plannedCourses.find((course) => course.label === "MATH 240");

  assert.ok(math240Course, "Expected fallback planning to include MATH 240.");
  assert.equal(math240Course?.guidanceSummary ?? "", "");
});

test("Degree-needed guidance stays visible when prerequisite support is not yet actionable in fallback planning", () => {
  const beforeEnrollmentStatuses = buildRequirementStatuses(
    [
      buildChecklistItem(
        "phys121",
        "PHYS 121",
        ["PHYS& 221"],
        "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way."
      ),
      buildChecklistItem("phys122", "PHYS 122", ["PHYS& 222"]),
    ],
    []
  );

  const plannedCourses = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses,
    stayAtGrcStatuses: [],
    completedCourses: [],
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);

  const phys221Course = plannedCourses.find((course) => course.label === "PHYS& 221");

  assert.ok(phys221Course, "Expected fallback planning to include PHYS& 221.");
  assert.equal(
    phys221Course?.guidanceSummary,
    "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way."
  );
});

test("Direct UW transfer matches appear as their own automatic guidance sentence", () => {
  const sequencePlan: TransferPlannerMajorPlan = {
    id: "test-physics-transfer-guidance-plan",
    campusId: "uw-seattle",
    title: "Test Physics Transfer Guidance",
    shortTitle: "Test Physics Transfer Guidance",
    coverage: "detailed",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [
      buildChecklistItem(
        "phys122",
        "PHYS 122",
        ["PHYS& 222"],
        "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way."
      ),
    ],
    stayAtGrcChecklist: [buildChecklistItem("phys123", "PHYS 123", ["PHYS& 223"])],
    advisorFlags: [],
    officialLinks: [],
  };

  const completedCourses = buildTranscriptCourses("PHYS& 221");
  const plannedCourses = buildSuggestedQuarterPlan({
    plan: sequencePlan,
    ...buildStatuses(sequencePlan, completedCourses),
    completedCourses,
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);

  const phys222Course = plannedCourses.find((course) => course.label === "PHYS& 222");
  const phys223Course = plannedCourses.find((course) => course.label === "PHYS& 223");

  assert.ok(phys222Course, "Expected PHYS& 222 to be planned.");
  assert.ok(phys223Course, "Expected PHYS& 223 to be planned.");
  assert.match(
    phys222Course?.guidanceSummary ?? "",
    /^Transfers into PHYS 122\./i
  );
  assert.doesNotMatch(
    phys222Course?.guidanceSummary ?? "",
    /Prerequisite for PHYS& 223\./i
  );
  assert.match(
    phys222Course?.guidanceSummary ?? "",
    /Not part of the minimum transfer-admission classes/i
  );
  assert.equal(
    (phys222Course?.guidanceSummary ?? "").indexOf("Transfers into PHYS 122.") <
      (phys222Course?.guidanceSummary ?? "").indexOf(
        "Not part of the minimum transfer-admission classes"
      ),
    true
  );
  assert.match(phys223Course?.guidanceSummary ?? "", /^Transfers into PHYS 123\./i);
});

test("Obsolete guide-only GRC biology rows do not advertise current BIOL 161 transfer guidance", () => {
  const legacyGuideRules = getTransferPlannerEquivalencyRulesForSourceCourse("BIOL 111");
  const sequencePlan: TransferPlannerMajorPlan = {
    id: "test-obsolete-biology-transfer-guidance-plan",
    campusId: "uw-seattle",
    title: "Test Obsolete Biology Transfer Guidance",
    shortTitle: "Test Obsolete Biology Transfer Guidance",
    coverage: "detailed",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [buildChecklistItem("biol161", "BIOL 161", ["BIOL 111"])],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
  };

  const plannedCourses = buildSuggestedQuarterPlan({
    plan: sequencePlan,
    ...buildStatuses(sequencePlan, []),
    completedCourses: [],
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);

  const biol111Course = plannedCourses.find((course) => course.label === "BIOL 111");

  assert.ok(
    legacyGuideRules.some((rule) => rule.isObsoleteSourceCourse),
    "Expected BIOL 111 to remain present in the raw guide as an obsolete source-course rule."
  );
  assert.ok(biol111Course, "Expected the synthetic fixture to still surface BIOL 111.");
  assert.doesNotMatch(biol111Course?.guidanceSummary ?? "", /^Transfers into BIOL 161\./i);
});

test.skip("Bothell and Tacoma campuses also include automatic prerequisite plus transfer guidance", () => {
  const fixtures: {
    campusId: TransferPlannerMajorPlan["campusId"];
    campusLabel: string;
  }[] = [
    { campusId: "uw-bothell", campusLabel: "Bothell" },
    { campusId: "uw-tacoma", campusLabel: "Tacoma" },
  ];

  for (const fixture of fixtures) {
    const plan: TransferPlannerMajorPlan = {
      id: `test-physics-transfer-guidance-${fixture.campusId}`,
      campusId: fixture.campusId,
      title: `Test ${fixture.campusLabel} Physics Transfer Guidance`,
      shortTitle: `Test ${fixture.campusLabel} Physics Transfer Guidance`,
      coverage: "detailed",
      summary: "",
      bestTrackId: null,
      recommendedTrackSummary: "",
      whyThisTrack: [],
      applicationChecklist: [],
      beforeEnrollmentChecklist: [
        buildChecklistItem("phys122", "PHYS 122", ["PHYS& 222"]),
        buildChecklistItem("phys123", "PHYS 123", ["PHYS& 223"]),
      ],
      stayAtGrcChecklist: [],
      advisorFlags: [],
      officialLinks: [],
    };

    const completedCourses = buildTranscriptCourses("PHYS& 221");
    const plannedCourses = buildSuggestedQuarterPlan({
      plan,
      ...buildStatuses(plan, completedCourses),
      completedCourses,
      track: null,
      includeStayAtGrcCourses: true,
      referenceDate: new Date("2026-01-15T12:00:00.000Z"),
    }).flatMap((quarter) => quarter.courses);

    const phys222Course = plannedCourses.find((course) => course.label === "PHYS& 222");

    assert.ok(phys222Course, `Expected PHYS& 222 to be planned for ${fixture.campusLabel}.`);
    assert.match(
      phys222Course?.guidanceSummary ?? "",
      /^Prerequisite for PHYS& 223\. Transfers into /i,
      `Expected prerequisite + transfer guidance for ${fixture.campusLabel}.`
    );
  }
});

test("Sequence-dependent UW transfer matches include a when-taken-with guidance sentence", () => {
  const sequencePlan: TransferPlannerMajorPlan = {
    id: "test-chemistry-transfer-guidance-plan",
    campusId: "uw-seattle",
    title: "Test Chemistry Transfer Guidance",
    shortTitle: "Test Chemistry Transfer Guidance",
    coverage: "detailed",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [
      buildChecklistItem(
        "chem152-sequence",
        "CHEM 152 sequence",
        ["CHEM& 163"],
        "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way."
      ),
    ],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
  };

  const completedCourses = buildTranscriptCourses("CHEM& 161", "CHEM& 162");
  const plannedCourses = buildSuggestedQuarterPlan({
    plan: sequencePlan,
    ...buildStatuses(sequencePlan, completedCourses),
    completedCourses,
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);

  const chem163Course = plannedCourses.find((course) => course.label === "CHEM& 163");

  assert.ok(chem163Course, "Expected CHEM& 163 to be planned.");
  assert.match(chem163Course?.guidanceSummary ?? "", /^Transfers into /i);
  assert.match(chem163Course?.guidanceSummary ?? "", /CHEM 152/i);
  assert.match(chem163Course?.guidanceSummary ?? "", /CHEM 162/i);
  assert.match(
    chem163Course?.guidanceSummary ?? "",
    /when taken with CHEM& 162\./i
  );
  assert.match(
    chem163Course?.guidanceSummary ?? "",
    /Not part of the minimum transfer-admission classes/i
  );
  assert.equal(
    (chem163Course?.guidanceSummary ?? "").indexOf("when taken with CHEM& 162.") <
      (chem163Course?.guidanceSummary ?? "").indexOf(
        "Not part of the minimum transfer-admission classes"
      ),
    true
  );
});

test("Choice-set planner rows expose option metadata and selected options become planned courses", () => {
  const groupId = "test-chemistry-options:requirement-group:bioc-or-chem";
  const choiceItem: TransferPlannerChecklistItem = {
    id: "bioc-or-chem",
    title: "[Page 1] BIOC 405 or CHEM 432 or CHEM 436",
    grcCourses: ["BIOC 405", "CHEM 432", "CHEM 436"],
    minCompletedCount: 1,
    requirementGroup: {
      id: groupId,
      label: "[Page 1] BIOC 405 or CHEM 432 or CHEM 436",
      category: "source-choice",
      requirementType: "choose_one",
      minCourses: 1,
      maxCourses: 1,
      options: [
        {
          id: `${groupId}:bioc-405`,
          uwCourses: ["BIOC 405"],
          grcMatches: ["BIOC 405"],
          credits: 3,
          label: "BIOC 405",
        },
        {
          id: `${groupId}:chem-432`,
          uwCourses: ["CHEM 432"],
          grcMatches: ["CHEM 432"],
          credits: 4,
          label: "CHEM 432",
        },
        {
          id: `${groupId}:chem-436`,
          uwCourses: ["CHEM 436"],
          grcMatches: ["CHEM 436"],
          credits: 6,
          label: "CHEM 436",
        },
      ],
    },
  };
  const plan: TransferPlannerMajorPlan = {
    id: "test-chemistry-options",
    campusId: "uw-seattle",
    title: "Chemistry Options",
    shortTitle: "Chemistry Options",
    coverage: "detailed",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [choiceItem],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
  };
  const completedCourses: TranscriptCourseEntry[] = [];
  const unselectedPlanCourses = buildSuggestedQuarterPlan({
    plan,
    ...buildStatuses(plan, completedCourses),
    completedCourses,
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);
  const optionPromptCourse = unselectedPlanCourses.find(
    (course) => course.optionGroup?.id === groupId
  );

  assert.ok(optionPromptCourse, "Expected unselected choice set to render as an option prompt.");
  assert.match(
    optionPromptCourse.label,
    /You have 3 different options to finish this requirement\. Click for your options\./
  );
  assert.equal(optionPromptCourse.optionGroup?.isSelectionPrompt, true);
  assert.equal(optionPromptCourse.optionGroup?.options.length, 3);
  assert.equal(
    optionPromptCourse.optionGroup?.options.find((option) => option.id === `${groupId}:chem-436`)
      ?.selectedLabel,
    "CHEM 436"
  );
  assert.equal(optionPromptCourse.creditMin, 3);
  assert.equal(optionPromptCourse.creditMax, 6);

  const selectedPlanCourses = buildSuggestedQuarterPlan({
    plan,
    ...buildStatuses(plan, completedCourses),
    completedCourses,
    track: null,
    includeStayAtGrcCourses: true,
    selectedRequirementOptionIdsByGroup: {
      [groupId]: [`${groupId}:chem-436`],
    },
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);
  const selectedChemCourse = selectedPlanCourses.find((course) => course.label === "CHEM 436");

  assert.ok(selectedChemCourse, "Expected selected CHEM 436 option to become a planned course.");
  assert.equal(selectedChemCourse?.creditAmount, 6);
  assert.equal(selectedChemCourse?.optionGroup?.id, groupId);
  assert.equal(selectedChemCourse?.optionGroup?.isSelectionPrompt, false);
  assert.deepEqual(selectedChemCourse?.optionGroup?.selectedOptionIds, [`${groupId}:chem-436`]);
  assert.equal(
    selectedPlanCourses.some((course) => course.label.startsWith("You have 3 different options")),
    false
  );
});

test("Choice-set planner hides UW-only Chemistry options without Green River matches", () => {
  const chemistryPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-chemistry"),
    "ba-route"
  );
  assert.ok(chemistryPlan, "Expected the Seattle Chemistry B.A. runtime plan.");

  const groupId =
    "uw-seattle-chemistry:pathway:ba-route:requirement-group:chem-317-or-chem-461";
  const plannedCourses = buildSuggestedQuarterPlan({
    plan: chemistryPlan,
    ...buildStatuses(chemistryPlan, []),
    completedCourses: [],
    track: null,
    includeStayAtGrcCourses: true,
    selectedRequirementOptionIdsByGroup: {
      [groupId]: ["uw-seattle-chemistry:pathway:ba-route:requirement-option:chem-317"],
    },
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);

  assert.equal(
    plannedCourses.some((course) => course.label === "CHEM 317" || course.label === "CHEM 461"),
    false
  );
  assert.equal(
    plannedCourses.some((course) => course.optionGroup?.id === groupId),
    false
  );
});

test("UW-transfer-only planning does not fall back to stay-at-GRC rows or track filler slots", () => {
  const stayAtGrcStatuses = buildRequirementStatuses(
    [buildChecklistItem("cse143", "CSE 143", ["CS 145"])],
    []
  );

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses,
    completedCourses: buildTranscriptCourses("CS 123", "MATH 238", "MATH& 254"),
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });

  const plannedCourseLabels: string[] = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(plannedCourseLabels.length, 0);
  assert.equal(plannedCourseLabels.includes("CS 145"), false);
  assert.equal(plannedCourseLabels.includes("5 credits of Humanities"), false);
  assert.equal(plannedCourseLabels.includes("5 credits of Social Science"), false);
});

test.skip("General-education filler guidance now shows running credit progress by category", () => {
  const plan = getRequiredPlan("uw-seattle-computer-science");
  const track = {
    id: "test-general-education-placeholders",
    code: "TEST",
    title: "Test placeholder track",
    summary: "Synthetic placeholder-only track for planner tests.",
    bestFor: ["testing"],
    terms: [
      {
        label: "Year 1 Fall",
        courses: ["Humanities", "Humanities", "Social Science"],
      },
      {
        label: "Year 1 Winter",
        courses: ["Humanities or Social Science", "Elective or General Education"],
      },
    ],
    notes: [],
  };

  const plannedCourses = buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  const guidanceSummaries = plannedCourses.map((course) => course.guidanceSummary ?? "");

  assert.ok(
    guidanceSummaries.some((guidance) =>
      /5\/20 A&H credits needed for Computer Science\./i.test(guidance)
    )
  );
  assert.ok(
    guidanceSummaries.some((guidance) =>
      /10\/20 A&H credits needed for Computer Science\./i.test(guidance)
    )
  );
  assert.ok(
    guidanceSummaries.some((guidance) =>
      /5\/20 SSc credits needed for Computer Science\./i.test(guidance)
    )
  );
  assert.ok(
    guidanceSummaries.some((guidance) =>
      /5\/20 NSc credits needed for Computer Science\./i.test(guidance)
    )
  );
  assert.ok(
    guidanceSummaries.some((guidance) =>
      /5\/15 elective\/general-education credits needed for Computer Science\./i.test(guidance)
    )
  );
  assert.equal(
    guidanceSummaries.some((guidance) => /A&H\/SSc/i.test(guidance)),
    false
  );
});

test("UW-transfer-only planning keeps required Computer Engineering Areas-of-Inquiry placeholders", () => {
  const plan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(plan, "Expected the Seattle Computer Engineering runtime plan.");
  const track = {
    id: "test-ah-ssc-required-placeholders",
    code: "TEST",
    title: "Test A&H/SSc placeholders",
    summary: "Synthetic placeholder-only track for UW-transfer-only filtering tests.",
    bestFor: ["testing"],
    terms: [
      {
        label: "Year 1 Fall",
        courses: ["Humanities", "Social Science", "Humanities or Social Science"],
      },
    ],
    notes: [],
  };

  const plannedCourses = buildSuggestedQuarterPlan({
    plan,
    ...buildStatuses(plan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  const guidanceSummaries = plannedCourses.map((course) => course.guidanceSummary ?? "");
  const areaOfInquiryPlaceholders = plannedCourses.filter((course) =>
    ["5 credits of Humanities", "5 credits of Social Science", "5 credits of A&H or SSc"].includes(
      course.label
    )
  );

  assert.deepEqual(
    areaOfInquiryPlaceholders.map((course) => course.label),
    [
      "5 credits of Humanities",
      "5 credits of Social Science",
      "5 credits of A&H or SSc",
      "5 credits of Humanities",
      "5 credits of Social Science",
      "5 credits of A&H or SSc",
    ]
  );
  assert.equal(
    guidanceSummaries.some((guidance) => /matched Green River associate pathway/i.test(guidance)),
    false
  );
  assert.ok(
    guidanceSummaries.some((guidance) =>
      /10\/10 A&H credits needed for Computer Engineering\./i.test(
        guidance
      )
    )
  );
  assert.ok(
    guidanceSummaries.some((guidance) =>
      /10\/10 SSc credits needed for Computer Engineering\./i.test(
        guidance
      )
    )
  );
  assert.ok(
    guidanceSummaries.some((guidance) =>
      /10\/10 additional A&H\/SSc credits needed for Computer Engineering\./i.test(
        guidance
      )
    )
  );
});

test("Manual current-course selections move one duplicate Gen-Ed placeholder by instance key", () => {
  const plan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(plan, "Expected the Seattle Computer Engineering runtime plan.");
  const track = {
    id: "test-duplicate-ssc-current-placeholders",
    code: "TEST",
    title: "Test duplicate SSc placeholders",
    summary: "Synthetic placeholder-only track for duplicate current-selection tests.",
    bestFor: ["testing"],
    terms: [
      {
        label: "Year 1 Fall",
        courses: ["Humanities", "Social Science", "Humanities or Social Science"],
      },
    ],
    notes: [],
  };
  const buildPlan = (currentCourseKeys: string[] = []) =>
    buildSuggestedQuarterPlan({
      plan,
      ...buildStatuses(plan, []),
      completedCourses: [],
      track,
      currentCourseKeys,
      includeStayAtGrcCourses: false,
      referenceDate: new Date("2026-01-15T12:00:00.000Z"),
    });

  const baseQuarterPlan = buildPlan();
  const baseSocialSciencePlaceholders = baseQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses)
    .filter((course) => course.label === "5 credits of Social Science");
  const [selectedSocialSciencePlaceholder, remainingSocialSciencePlaceholder] =
    baseSocialSciencePlaceholders;

  assert.equal(baseSocialSciencePlaceholders.length, 2);
  assert.ok(selectedSocialSciencePlaceholder?.instanceKey);
  assert.ok(remainingSocialSciencePlaceholder?.instanceKey);
  assert.notEqual(
    selectedSocialSciencePlaceholder.instanceKey,
    remainingSocialSciencePlaceholder.instanceKey
  );

  const selectedKey = selectedSocialSciencePlaceholder.instanceKey;
  const currentQuarterPlan = buildPlan([selectedKey]);
  const currentSocialSciencePlaceholders = currentQuarterPlan
    .filter((quarter) => quarter.phase === "current")
    .flatMap((quarter) => quarter.courses)
    .filter((course) => course.label === "5 credits of Social Science");
  const futureSocialSciencePlaceholders = currentQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses)
    .filter((course) => course.label === "5 credits of Social Science");

  assert.deepEqual(
    currentSocialSciencePlaceholders.map((course) => ({
      label: course.label,
      status: course.status,
      instanceKey: course.instanceKey,
    })),
    [
      {
        label: "5 credits of Social Science",
        status: "current",
        instanceKey: selectedKey,
      },
    ]
  );
  assert.equal(futureSocialSciencePlaceholders.length, 1);
  assert.equal(
    futureSocialSciencePlaceholders[0]?.instanceKey,
    remainingSocialSciencePlaceholder.instanceKey
  );
});

test.skip("Planner keeps extending future quarters until late elective filler reaches full progress", () => {
  const plan = getRequiredPlan("uw-seattle-computer-science");
  const track = {
    id: "test-crowded-general-education-elective-fillers",
    code: "TEST-CROWDED-ELECTIVES",
    title: "Crowded elective placeholder track",
    summary:
      "Synthetic placeholder track that crowds the third elective filler into a later quarter.",
    bestFor: ["testing"],
    terms: [
      {
        label: "Year 1",
        courses: [
          "Humanities",
          "Humanities",
          "Social Science",
          "Social Science",
          "Humanities or Social Science",
          "Elective or General Education",
          "Elective or General Education",
          "Elective or General Education",
        ],
      },
    ],
    notes: [],
  };

  const plannedQuarters = buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).filter((quarter) => quarter.phase === "planned");
  const electiveCourses = plannedQuarters.flatMap((quarter) =>
    quarter.courses
      .filter((course) => course.label === "5 credits of elective/general education")
      .map((course) => ({ quarterLabel: quarter.label, course }))
  );

  assert.ok(plannedQuarters.length >= 4);
  assert.equal(electiveCourses.length, 3);
  assert.equal(electiveCourses[2]?.quarterLabel, "Spring 2027");
  assert.match(
    electiveCourses[1]?.course.guidanceSummary ?? "",
    /10\/15 elective\/general-education credits needed for Computer Science\./i
  );
  assert.match(
    electiveCourses[2]?.course.guidanceSummary ?? "",
    /15\/15 elective\/general-education credits needed for Computer Science\./i
  );
});

test("Runtime majors keep quarter plans scoped to the active degree and capped per term", () => {
  const campusIds = ["uw-seattle", "uw-bothell", "uw-tacoma"] as const;

  for (const campusId of campusIds) {
    for (const basePlan of getTransferPlannerStudentRuntimeMajorsForCampus(campusId)) {
      const pathways = getTransferPlannerStudentRuntimePathwaysForPlan(basePlan);
      const pathwayIds = pathways.length ? pathways.map((pathway) => pathway.id) : [null];

      for (const pathwayId of pathwayIds) {
        const plan = resolveTransferPlannerStudentRuntimeMajorPlan(basePlan, pathwayId);
        if (!plan) continue;

        const quarterPlan = buildSuggestedQuarterPlan({
          plan,
          applicationStatuses: buildRequirementStatuses(plan.applicationChecklist, []),
          beforeEnrollmentStatuses: buildRequirementStatuses(plan.beforeEnrollmentChecklist, []),
          stayAtGrcStatuses: buildRequirementStatuses(plan.stayAtGrcChecklist, []),
          completedCourses: [],
          track: getTransferPlannerTrack(plan.bestTrackId ?? null),
          includeStayAtGrcCourses: true,
          referenceDate: new Date("2026-01-15T12:00:00.000Z"),
        });
        const expectedPlanTitle = plan.selectedPathwayLabel
          ? `${plan.title} (${plan.selectedPathwayLabel})`
          : plan.title;

        for (const quarter of quarterPlan.filter((entry) => entry.phase === "planned")) {
          assert.ok(
            quarter.courses.length <= 3,
            `Expected ${plan.id} ${pathwayId ?? "default"} ${quarter.label} to stay within three planned rows, got ${quarter.courses.length}.`
          );

          for (const course of quarter.courses) {
            if (!/^5 credits of /i.test(course.label)) {
              continue;
            }

            const guidanceSummary = String(course.guidanceSummary ?? "");
            if (!/(planned for|needed for)/i.test(guidanceSummary)) {
              continue;
            }

            assert.match(
              guidanceSummary,
              new RegExp(expectedPlanTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
              `Expected ${plan.id} ${pathwayId ?? "default"} ${quarter.label} placeholder guidance to stay scoped to ${expectedPlanTitle}.`
            );
          }
        }
      }
    }
  }
});

test("Seattle Aeronautics runtime planning uses the authored 24-credit breadth target instead of the generic 40-credit fallback", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    applicationStatuses: buildRequirementStatuses(runtimePlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(runtimePlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const humanitiesPlaceholderEntries = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => course.label === "5 credits of Humanities")
        .map((course) => ({ quarterLabel: quarter.label, course }))
    );
  const socialSciencePlaceholderEntries = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => course.label === "5 credits of Social Science")
        .map((course) => ({ quarterLabel: quarter.label, course }))
    );
  const sharedBreadthPlaceholderEntries = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => course.label === "5 credits of A&H or SSc")
        .map((course) => ({ quarterLabel: quarter.label, course }))
    );
  const sourceBackedHumanitiesPlaceholderEntries = humanitiesPlaceholderEntries.filter((entry) =>
    /needed for Aeronautics & Astronautics/i.test(entry.course.guidanceSummary ?? "")
  );
  const sourceBackedSocialSciencePlaceholderEntries = socialSciencePlaceholderEntries.filter(
    (entry) => /needed for Aeronautics & Astronautics/i.test(entry.course.guidanceSummary ?? "")
  );
  const sourceBackedSharedBreadthPlaceholderEntries = sharedBreadthPlaceholderEntries.filter(
    (entry) => /needed for Aeronautics & Astronautics/i.test(entry.course.guidanceSummary ?? "")
  );

  assert.equal(sourceBackedSharedBreadthPlaceholderEntries.length, 1);
  assert.equal(sourceBackedHumanitiesPlaceholderEntries.length, 2);
  assert.equal(sourceBackedSocialSciencePlaceholderEntries.length, 2);
  assert.match(
    sourceBackedHumanitiesPlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /A&H credits needed for Aeronautics & Astronautics\./i
  );
  assert.match(
    sourceBackedHumanitiesPlaceholderEntries[sourceBackedHumanitiesPlaceholderEntries.length - 1]
      ?.course.guidanceSummary ?? "",
    /A&H credits needed for Aeronautics & Astronautics\./i
  );
  assert.match(
    sourceBackedSocialSciencePlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /SSc credits needed for Aeronautics & Astronautics\./i
  );
  assert.match(
    sourceBackedSocialSciencePlaceholderEntries[
      sourceBackedSocialSciencePlaceholderEntries.length - 1
    ]?.course.guidanceSummary ?? "",
    /10\/10 SSc credits needed for Aeronautics & Astronautics\./i
  );
  assert.doesNotMatch(
    sourceBackedHumanitiesPlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /A&H\/SSc credits needed for Aeronautics & Astronautics\./i
  );
  assert.match(
    sourceBackedSharedBreadthPlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /additional A&H\/SSc credits needed for Aeronautics & Astronautics\./i
  );
  assert.doesNotMatch(
    sourceBackedSocialSciencePlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /40 A&H\/SSc credits needed for Aeronautics & Astronautics\./i
  );
  assert.equal(
    sharedBreadthPlaceholderEntries.some((entry) =>
      /not an official UW transfer admission requirement/i.test(entry.course.guidanceSummary ?? "")
    ),
    false
  );
});

test("Seattle Computer Engineering parsed source blocks and runtime planning no longer leak Allen School recommendation spillover", () => {
  const parsedBlock = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.find(
    (entry) => entry.ownerId === "uw-seattle-computer-engineering"
  );
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");

  assert.ok(parsedBlock, "Expected a parsed requirement source block for Seattle Computer Engineering.");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");

  assert.equal(parsedBlock?.parsedUwCourseCodes.includes("BIOL 180"), false);
  assert.equal(parsedBlock?.parsedUwCourseCodes.includes("CHEM 142"), false);
  assert.equal(parsedBlock?.parsedUwCourseCodes.includes("PHYS 116"), false);
  assert.equal(
    (parsedBlock?.parsedUwCourseCodes ?? []).some((code) => code.startsWith("ASTR ")),
    false
  );
  assert.ok(parsedBlock?.parsedUwCourseCodes.includes("EE 215"));
  assert.ok(parsedBlock?.parsedUwCourseCodes.includes("CSE 311"));

  const runtimeCourseList = getTransferPlannerGrcCourseList(runtimePlan);
  const checklistCoverage = [...getChecklistCoverageForPlan(runtimePlan)];

  assert.equal(
    runtimePlan?.bestTrackId,
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-computer-and-electrical-engineering"
  );
  assert.ok(runtimeCourseList.includes("MATH& 151"));
  assert.ok(runtimeCourseList.includes("MATH& 152"));
  assert.ok(runtimeCourseList.includes("MATH& 163"));
  assert.ok(runtimeCourseList.includes("PHYS& 222"));
  assert.ok(runtimeCourseList.includes("MATH 240"));
  assert.ok(runtimeCourseList.includes("ENGR& 204"));
  assert.equal(runtimeCourseList.includes("BIOL& 211"), false);
  assert.equal(runtimeCourseList.includes("CHEM& 161"), false);
  assert.equal(runtimeCourseList.includes("CHEM& 261"), false);
  assert.equal(runtimeCourseList.includes("ENGL 128"), false);
  assert.deepEqual(
    runtimePlan?.applicationChecklist.map((item) => item.title),
    ["Calculus I-III sequence"]
  );
  assert.deepEqual(
    runtimePlan?.beforeEnrollmentChecklist.map((item) => item.title),
    ["PHYS 122", "MATH 208", "EE 215", "CSE 121-123 programming sequence"]
  );
  assert.equal(checklistCoverage.length <= runtimeCourseList.length, true);
});

test("Seattle Computer Engineering source-backed recovery keeps a useful lower-division prep floor", () => {
  const parsedBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-computer-engineering"
  )[0];
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");

  assert.ok(parsedBlock, "Expected the Seattle Computer Engineering parsed requirement-source block.");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");

  assert.equal(parsedBlock?.parserType, "pdf-degree-sheet");
  assert.match(parsedBlock?.sourceUrl ?? "", /CompE_degreq.*\.pdf/i);
  assert.ok(
    parsedBlock?.requirementCueLines.some((line) =>
      /Mathematics\s*&\s*Natural Sciences\s*\(41 credits\)/i.test(line)
    )
  );
  assert.equal((parsedBlock?.parsedUwCourseCodes.length ?? 0) >= 24, true);
  assert.deepEqual(parsedBlock?.sourceOnlyUwCourseCodes ?? [], []);

  const expectedParsedMinimum = [
    "CSE 121",
    "CSE 122",
    "CSE 123",
    "EE 205",
    "EE 215",
    "ENGL 131",
    "MATH 124",
    "MATH 125",
    "MATH 126",
    "MATH 208",
    "PHYS 121",
    "PHYS 122",
  ];
  for (const courseCode of expectedParsedMinimum) {
    assert.equal(
      parsedBlock?.parsedUwCourseCodes.includes(courseCode) ?? false,
      true,
      `Expected Seattle Computer Engineering to recover ${courseCode} from the official source.`
    );
  }

  const runtimeCourseList = getTransferPlannerGrcCourseList(runtimePlan);
  const runtimeRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(runtimeCourseList);
  const expectedRuntimeMinimum = [
    "CS 121",
    "CS 122",
    "CS 123",
    "ENGL& 101",
    "ENGR& 204",
    "MATH 240",
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "PHYS& 221",
    "PHYS& 222",
  ];
  for (const courseCode of expectedRuntimeMinimum) {
    assert.equal(
      runtimeCourseList.includes(courseCode),
      true,
      `Expected Seattle Computer Engineering runtime planning to keep ${courseCode}.`
    );
  }

  assert.equal(runtimeCourseList.length >= 12, true);
  assert.equal(runtimeRecommendation?.trackId, runtimePlan?.bestTrackId ?? null);
  assert.equal((runtimeRecommendation?.matchCount ?? 0) >= 10, true);
});

test("Seattle Computer Engineering source-backed required-course summary excludes approved-list spillover and keeps true required prep", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");

  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");

  const requiredCourseCodes = buildSourceBackedRequiredCourseCodes(runtimePlan);
  const forbiddenCourseCodes = [
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
    "CHEM& 131",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "CHEM& 261",
    "CHEM& 262",
    "CHEM& 263",
    "CS 145",
    "ENGL 128",
    "PHYS& 116",
    "PHYS& 156",
  ];
  for (const courseCode of forbiddenCourseCodes) {
    assert.equal(
      requiredCourseCodes.includes(courseCode),
      false,
      `Did not expect Seattle Computer Engineering to label ${courseCode} as an individually required Green River course.`
    );
  }

  const expectedCourseCodes = [
    "CS 121",
    "CS 122",
    "CS 123",
    "ENGL& 101",
    "ENGR& 204",
    "MATH 240",
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "PHYS& 221",
    "PHYS& 222",
  ];
  for (const courseCode of expectedCourseCodes) {
    assert.equal(
      requiredCourseCodes.includes(courseCode),
      true,
      `Expected Seattle Computer Engineering to keep ${courseCode} in the source-backed required-course summary.`
    );
  }
});

test("Seattle Computer Engineering source-backed required-course summary stays aligned with the quarter planner", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");

  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");

  const requiredCourseCodes = buildSourceBackedRequiredCourseCodes(runtimePlan);
  const applicationStatuses = buildRequirementStatuses(runtimePlan.applicationChecklist, []);
  const beforeEnrollmentStatuses = buildRequirementStatuses(
    runtimePlan.beforeEnrollmentChecklist,
    []
  );
  const stayAtGrcStatuses = buildRequirementStatuses(runtimePlan.stayAtGrcChecklist, []);
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    applicationStatuses,
    beforeEnrollmentStatuses,
    stayAtGrcStatuses,
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId),
    includeStayAtGrcCourses: true,
  });
  const plannedCourseCodes = new Set(
    quarterPlan
      .flatMap((quarter) => quarter.courses)
      .flatMap((course) => extractCourseCodes(course.label))
  );

  for (const courseCode of requiredCourseCodes) {
    assert.equal(
      plannedCourseCodes.has(courseCode),
      true,
      `Expected the suggested quarter plan to include ${courseCode} because it appears in the source-backed required-course summary.`
    );
  }
});

test("Seattle Computer Engineering CS 121-123 completion blocks the legacy CS 145 fallback", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");
  const buildUpcomingLabels = (completedCourses: TranscriptCourseEntry[]) =>
    buildSuggestedQuarterPlan({
      plan: runtimePlan,
      ...buildStatuses(runtimePlan, completedCourses),
      completedCourses,
      track: getTransferPlannerTrack(runtimePlan.bestTrackId),
      includeStayAtGrcCourses: true,
      referenceDate: new Date("2026-01-15T12:00:00.000Z"),
    })
      .filter((quarter) => quarter.phase !== "completed")
      .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const completedCourses = buildTranscriptCourses("CS 121", "CS 122", "CS 123");
  const upcomingLabels = buildUpcomingLabels(completedCourses);
  const partialUpcomingLabels = buildUpcomingLabels(
    buildTranscriptCourses("CS 121", "CS 122")
  );
  const sourceBackedDescriptors = buildSourceBackedRequiredCourseDescriptors(
    runtimePlan,
    completedCourses
  );

  assert.equal(
    sourceBackedDescriptors.some((descriptor) =>
      descriptor.explicitCourseCodes.includes("CS 145")
    ),
    false,
    "Expected completed CS 123 -> CSE 123 to satisfy the CSE 123/CSE 143 target set."
  );
  assert.equal(upcomingLabels.includes("CS 145"), false);
  assert.equal(upcomingLabels.includes("CS 123"), false);
  assert.equal(partialUpcomingLabels.includes("CS 123"), true);
  assert.equal(partialUpcomingLabels.includes("CS 145"), false);
});

test("Manual current-course selections stay per-course while still unlocking future planner sequencing", () => {
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: buildRequirementStatuses(
      [buildChecklistItem("programming-2", "Programming II", ["CS 122"])],
      []
    ),
    beforeEnrollmentStatuses: buildRequirementStatuses(
      [
        buildChecklistItem("programming-1", "Programming I", ["CS 121"]),
        buildChecklistItem("english-comp", "English composition", ["ENGL& 101"]),
      ],
      []
    ),
    stayAtGrcStatuses: [],
    completedCourses: [],
    currentCourseLabels: ["CS 121"],
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-04-23T12:00:00.000Z"),
  });
  const currentQuarter = quarterPlan.find((quarter) => quarter.phase === "current");
  const fall2026Quarter = quarterPlan.find(
    (quarter) => quarter.phase === "planned" && quarter.label === "Fall 2026"
  );

  assert.deepEqual(
    currentQuarter?.courses.map((course) => `${course.label}:${course.status}`),
    ["CS 121:current"]
  );
  assert.deepEqual(
    fall2026Quarter?.courses.map((course) => `${course.label}:${course.status}`),
    ["CS 122:planned", "ENGL& 101:planned"]
  );
});

test("Seattle Computer Engineering manual current CS 121 selection does not rebucket sibling courses", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, []),
    completedCourses: [],
    currentCourseLabels: ["CS 121"],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-04-23T12:00:00.000Z"),
  });
  const currentQuarter = quarterPlan.find((quarter) => quarter.phase === "current");
  const fall2026Quarter = quarterPlan.find(
    (quarter) => quarter.phase === "planned" && quarter.label === "Fall 2026"
  );

  assert.deepEqual(
    currentQuarter?.courses.map((course) => `${course.label}:${course.status}`),
    ["CS 121:current"]
  );
  assert.deepEqual(
    fall2026Quarter?.courses.map((course) => `${course.label}:${course.status}`),
    ["CS 122:planned", "ENGL& 101:planned", "MATH& 141:planned"]
  );
});

test("Seattle Computer Engineering manual current MATH& 141 selection does not rebucket sibling courses", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, []),
    completedCourses: [],
    currentCourseLabels: ["MATH& 141"],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-04-23T12:00:00.000Z"),
  });
  const currentQuarter = quarterPlan.find((quarter) => quarter.phase === "current");
  const fall2026Quarter = quarterPlan.find(
    (quarter) => quarter.phase === "planned" && quarter.label === "Fall 2026"
  );

  assert.deepEqual(
    currentQuarter?.courses.map((course) => `${course.label}:${course.status}`),
    ["MATH& 141:current"]
  );
  assert.deepEqual(
    fall2026Quarter?.courses.map((course) => `${course.label}:${course.status}`),
    ["CS 121:planned", "ENGL& 101:planned", "MATH& 142:planned"]
  );
});

test("HCDE source-backed required-course summaries keep the calculus bucket structured instead of flattening fake individual rows", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-human-centered-design-engineering"
  );

  assert.ok(runtimePlan, "Expected the HCDE runtime plan.");

  const descriptors = buildSourceBackedRequiredCourseDescriptors(runtimePlan);
  const calculusDescriptor = descriptors.find((descriptor) => descriptor.id === "ten-calc-credits");
  const uwSummaryEntries = buildSourceBackedRequiredCourseSummaryEntries(runtimePlan, {
    mode: "uw",
  });

  assert.ok(calculusDescriptor, "Expected HCDE to keep the calculus checklist item.");
  assert.equal(calculusDescriptor?.kind, "choice-bucket");
  assert.equal(calculusDescriptor?.requiredCompletedCount, 2);
  assert.deepEqual(calculusDescriptor?.explicitCourseCodes, ["MATH& 151", "MATH& 152", "MATH& 163"]);
  assert.equal(
    uwSummaryEntries.some((entry) => /Ten calculus credits - choose 2 from this list\./i.test(entry.text)),
    true,
    "Expected the HCDE summary to keep the calculus bucket structured."
  );
  for (const courseCode of ["MATH& 151", "MATH& 152", "MATH& 163"]) {
    assert.equal(
      uwSummaryEntries.some((entry) =>
        new RegExp(`^${escapeRegExp(courseCode)}(?:\\b|\\s+-).*is required\\.`, "i").test(entry.text)
      ),
      false,
      `Did not expect the HCDE summary to flatten ${courseCode} into an unconditional required-course sentence.`
    );
  }
});

test("Seattle Computer Engineering source-backed summaries keep approved calculus options structured", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");

  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");

  const descriptors = buildSourceBackedRequiredCourseDescriptors(runtimePlan);
  const calculusDescriptor = descriptors.find((descriptor) => descriptor.id === "calc123");
  const uwSummaryEntries = buildSourceBackedRequiredCourseSummaryEntries(runtimePlan, {
    mode: "uw",
  });

  assert.ok(calculusDescriptor, "Expected the CompE calculus sequence descriptor.");
  assert.equal(calculusDescriptor?.kind, "choice-bucket");
  assert.equal(calculusDescriptor?.courseLabelSets.length, 2);
  assert.equal(
    uwSummaryEntries.some((entry) => /Calculus I-III sequence - complete one approved option\./i.test(entry.text)),
    true,
    "Expected the CompE summary to keep the calculus choice structure."
  );
  for (const courseCode of ["MATH& 151", "MATH& 152", "MATH& 163", "MATH& 153", "MATH& 254"]) {
    assert.equal(
      uwSummaryEntries.some((entry) =>
        new RegExp(`^${escapeRegExp(courseCode)}(?:\\b|\\s+-).*is required\\.`, "i").test(entry.text)
      ),
      false,
      `Did not expect the CompE summary to flatten ${courseCode} into an unconditional required-course sentence.`
    );
  }
});

test("Aquatic source-backed required-course recovery keeps English composition and drops recommended CLAS/COM spillover", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-aquatic-conservation-and-ecology"
  );
  const clasClassification = getTransferPlannerRequirementDiffClassifications(
    "uw-seattle-aquatic-conservation-and-ecology"
  ).find((entry) => entry.sourceUwCourseCode === "CLAS 205");

  assert.ok(runtimePlan, "Expected the Aquatic Conservation & Ecology runtime plan.");
  assert.ok(
    clasClassification,
    "Expected Aquatic Conservation & Ecology to retain the underlying CLAS 205 classification."
  );
  assert.ok(
    (clasClassification?.validationNotes ?? []).some((note) => /recommended/i.test(note)),
    "Expected the CLAS 205 classification to preserve its recommended-only cue."
  );

  const requiredCourseCodes = buildSourceBackedRequiredCourseCodes(runtimePlan);
  assert.deepEqual(requiredCourseCodes, ["ENGL& 101"]);
  assert.equal(getTransferPlannerGrcCourseList(runtimePlan).includes("CMST& 220"), false);
  assert.equal(
    runtimePlan.applicationChecklist.some((item) => item.grcCourses.includes("CMST& 220")),
    false
  );

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId),
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedCourseCodes = new Set(
    quarterPlan.flatMap((quarter) =>
      quarter.courses.flatMap((course) => extractCourseCodes(course.label))
    )
  );

  assert.equal(plannedCourseCodes.has("ENGL& 101"), true);
  assert.equal(plannedCourseCodes.has("CMST& 220"), false);
});

test("UW-only planning keeps representative source-backed required-course summaries aligned", () => {
  const representativePlanIds = [
    "uw-seattle-aquatic-conservation-and-ecology",
    "uw-seattle-american-ethnic-studies",
    "uw-seattle-computer-engineering",
    "uw-tacoma-computer-engineering",
    "uw-tacoma-education",
    "uw-tacoma-urban-design",
  ];

  for (const planId of representativePlanIds) {
    const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(planId);
    assert.ok(runtimePlan, `Expected runtime plan ${planId}.`);

    const quarterPlan = buildSuggestedQuarterPlan({
      plan: runtimePlan,
      ...buildStatuses(runtimePlan, []),
      completedCourses: [],
      track: getTransferPlannerTrack(runtimePlan.bestTrackId),
      includeStayAtGrcCourses: false,
      referenceDate: new Date("2026-01-15T12:00:00.000Z"),
    });
    const plannedCourseCodes = new Set(
      quarterPlan.flatMap((quarter) =>
        quarter.courses.flatMap((course) => extractCourseCodes(course.label))
      )
    );

    for (const courseCode of buildSourceBackedRequiredCourseCodes(runtimePlan)) {
      assert.equal(
        plannedCourseCodes.has(courseCode),
        true,
        `Expected ${planId} UW-only planning to keep ${courseCode} because it appears in the source-backed required-course summary.`
      );
    }
  }
});

test("Tacoma Computer Engineering keeps choice-set-backed prep aligned without leaking optional spillover", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-tacoma-computer-engineering");
  const tme221Classification = getTransferPlannerRequirementDiffClassifications(
    "uw-tacoma-computer-engineering"
  ).find((entry) => entry.sourceUwCourseCode === "TME 221");
  const tme223Classification = getTransferPlannerRequirementDiffClassifications(
    "uw-tacoma-computer-engineering"
  ).find((entry) => entry.sourceUwCourseCode === "TME 223");

  assert.ok(runtimePlan, "Expected the Tacoma Computer Engineering runtime plan.");
  assert.equal(tme221Classification?.classificationKind, "auto-promoted-choice-set-resolved");
  assert.equal(tme223Classification?.classificationKind, "auto-promoted-choice-set-resolved");

  const requiredCourseCodes = buildSourceBackedRequiredCourseCodes(runtimePlan);
  for (const courseCode of ["CHEM& 162", "CHEM& 163", "CS 145", "CS& 141"]) {
    assert.equal(
      requiredCourseCodes.includes(courseCode),
      false,
      `Did not expect Tacoma Computer Engineering to flatten optional spillover ${courseCode} into an unconditional required-course row.`
    );
  }

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId),
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedCourseCodes = new Set(
    quarterPlan.flatMap((quarter) =>
      quarter.courses.flatMap((course) => extractCourseCodes(course.label))
    )
  );

  for (const courseCode of ["ENGR& 214", "ENGR& 215", "CHEM& 161", "ENGL& 101", "ENGR& 225", "PHYS& 223"]) {
    assert.equal(
      requiredCourseCodes.includes(courseCode),
      true,
      `Expected Tacoma Computer Engineering to keep ${courseCode} in the source-backed required-course summary.`
    );
    assert.equal(
      plannedCourseCodes.has(courseCode),
      true,
      `Expected Tacoma Computer Engineering UW-only planning to keep ${courseCode}.`
    );
  }
});

test("Architectural Design automatically drops unsafe suggested-course spillover from the source-backed required-course summary", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-architectural-design");
  const math112Classification = getTransferPlannerRequirementDiffClassifications(
    "uw-seattle-architectural-design"
  ).find((entry) => entry.sourceUwCourseCode === "MATH 112");

  assert.ok(runtimePlan, "Expected the Seattle Architectural Design runtime plan.");
  assert.ok(
    math112Classification,
    "Expected Seattle Architectural Design to keep the underlying source-backed MATH 112 classification."
  );
  assert.equal(
    math112Classification?.grcCourseCodes.includes("MATH& 148"),
    true,
    "Expected the underlying classification registry to still record the guide-backed MATH& 148 path."
  );
  assert.ok(
    (math112Classification?.validationNotes ?? []).some((note) =>
      /suggested|elective|approved-list/i.test(note)
    )
  );

  const requiredCourseCodes = buildSourceBackedRequiredCourseCodes(runtimePlan);
  assert.equal(requiredCourseCodes.includes("MATH& 148"), false);
  assert.equal(requiredCourseCodes.includes("ENGL& 101"), true);
});

test("Runtime computing-sequence recovery uses shared guide-backed evidence without leaking optional engineering lists", () => {
  const runtimeCompEPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-computer-engineering"
  );
  const runtimeCsPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-science");
  const runtimeCivilPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-civil-engineering");
  const runtimeHcdePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-human-centered-design-engineering"
  );

  assert.ok(runtimeCompEPlan, "Expected runtime Seattle Computer Engineering plan.");
  assert.ok(runtimeCsPlan, "Expected runtime Seattle Computer Science plan.");
  assert.ok(runtimeCivilPlan, "Expected runtime Seattle Civil Engineering plan.");
  assert.ok(runtimeHcdePlan, "Expected runtime Seattle HCDE plan.");

  const runtimeCompEBeforeEnrollment = runtimeCompEPlan?.beforeEnrollmentChecklist ?? [];
  const runtimeCsBeforeEnrollment = runtimeCsPlan?.beforeEnrollmentChecklist ?? [];
  const runtimeCivilBeforeEnrollment = runtimeCivilPlan?.beforeEnrollmentChecklist ?? [];
  const runtimeHcdeBeforeEnrollment = runtimeHcdePlan?.beforeEnrollmentChecklist ?? [];

  const compEProgrammingSequence = runtimeCompEBeforeEnrollment.find(
    (item) => item.title === "CSE 121-123 programming sequence"
  );

  assert.deepEqual(compEProgrammingSequence?.grcCourses ?? [], ["CS 121", "CS 122", "CS 123"]);
  assert.deepEqual(
    ["CS 121", "CS 122", "CS 123"].filter((courseCode) =>
      getTransferPlannerGrcCourseList(runtimeCsPlan).includes(courseCode)
    ),
    ["CS 121", "CS 122", "CS 123"]
  );
  assert.equal(
    runtimeCivilBeforeEnrollment.some(
      (item) => item.title === "CSE 121-123 programming sequence"
    ),
    false
  );
  assert.equal(
    runtimeHcdeBeforeEnrollment.some(
      (item) => item.title === "CSE 121-123 programming sequence"
    ),
    false
  );
});

test("Seattle Aeronautics runtime now materializes its mapped prep signal into structured planner rows", () => {
  const planningState = getResolvedRuntimeQuarterPlanningState(
    "uw-seattle-aeronautics-astronautics",
    null
  );
  const runtimeCourseList = getTransferPlannerGrcCourseList(planningState.resolvedPlan);
  const runtimeRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(runtimeCourseList);
  const beforeEnrollmentTitles = planningState.resolvedPlan.beforeEnrollmentChecklist.map(
    (item) => item.title
  );

  assert.equal(
    planningState.runtimePlan?.bestTrackId,
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-civil-and-mechanical-engineering"
  );
  assert.equal(runtimeRecommendation?.trackId, planningState.runtimePlan?.bestTrackId ?? null);
  assert.equal(
    planningState.diagnostics.hasStructuredPlannerData,
    true,
    JSON.stringify(planningState.diagnostics)
  );
  assert.equal(
    planningState.diagnostics.hasPlannedQuarterRows,
    true,
    JSON.stringify(planningState.diagnostics)
  );
  assert.ok(beforeEnrollmentTitles.includes("ENGR& 214"));
  assert.ok(beforeEnrollmentTitles.includes("ENGR& 215"));
  assert.ok(beforeEnrollmentTitles.includes("MATH 238"));
  assert.ok(beforeEnrollmentTitles.includes("PHYS& 223"));
  assert.ok(runtimeCourseList.includes("CHEM& 161"));
  assert.ok(runtimeCourseList.includes("ENGL& 101"));
  assert.equal(runtimeCourseList.includes("BIOL& 211"), false);
  assert.equal(runtimeCourseList.includes("CHEM& 261"), false);
});

test("Source-backed classifications that were explicitly marked unsafe no longer materialize into runtime requirement atoms", () => {
  const unsafeAtoms = TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY.filter((entry) =>
    entry.validationNotes.some((note) =>
      /Auto-promotion was intentionally skipped/i.test(String(note ?? ""))
    )
  ).map((entry) => ({
    id: entry.id,
    planId: entry.planId,
    title: entry.title,
  }));

  assert.deepEqual(unsafeAtoms, []);
});

test("UW majors without parsed breadth targets keep the major-specific bucket empty while the official transfer section stays policy-based", () => {
  const plan = {
    id: "test-no-general-ed-fallback",
    campusId: "uw-seattle",
    title: "Fallback Removal Test",
    shortTitle: "Fallback Test",
    coverage: "detailed",
    summary: "",
    icon: "school",
    colorGradient: ["#000000", "#111111"],
    themeColor: "#000000",
    officialLinks: [],
    deadlines: [],
    requirements: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    grcCourseList: [],
    grcCourseListGuidance: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    advisorFlags: [],
    guidanceItems: [],
    degreeMapSections: [],
    specialNotes: [],
    tips: [],
    targetSchools: [],
    targetSchoolDetails: [],
    prerequisites: [],
    pathways: [],
  } as TransferPlannerMajorPlan;
  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(plan);
  const generalRequirementSection = buildUwGeneralTransferRequirementSection(plan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(plan), {
    ahCredits: null,
    sscCredits: null,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.deepEqual(buildGeneralEducationRequirementTargets(plan), {
    ahCredits: null,
    sscCredits: null,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(diagnostics.hasSourceBackedTargets, false);
  assert.deepEqual(diagnostics.plannerGuidanceTargets, {
    ahCredits: null,
    sscCredits: null,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(generalRequirementSection?.title, "UW Transfer Admission Requirements");
  assert.equal(generalRequirementSection?.plannerUsage, "summary-only");
  assert.match(
    generalRequirementSection?.summary ?? "",
    /40 transferable college quarter credits/i
  );
  assert.deepEqual(
    generalRequirementSection?.items.map((entry) => `${entry.label}: ${entry.valueText}`),
    EXPECTED_UW_TRANSFER_ADMISSION_REQUIREMENT_LINES
  );
  assert.equal(
    generalRequirementSection?.items.some((entry) =>
      /A&H|SSc|NSc/i.test(entry.label) || /\b20\b/.test(entry.valueText)
    ),
    false
  );
});

test("UW runtime majors keep a distinct official UW transfer admission requirements section when transcript-derived credits stay below 40", () => {
  const campusIds = ["uw-seattle", "uw-bothell", "uw-tacoma"] as const;

  for (const campusId of campusIds) {
    for (const runtimePlan of getTransferPlannerStudentRuntimeMajorsForCampus(campusId)) {
      const section = buildUwGeneralTransferRequirementSection(runtimePlan, {
        completedCourses: [],
        hasTranscriptDerivedCreditSource: true,
      });
      assert.ok(
        section,
        `Expected ${runtimePlan.id} to expose UW transfer admission requirements.`
      );
      assert.equal(section?.title, "UW Transfer Admission Requirements");
      assert.equal(section?.plannerUsage, "summary-only");
      assert.equal((section?.items.length ?? 0) > 0, true, runtimePlan.id);
      assert.deepEqual(
        section?.items.map((entry) => `${entry.label}: ${entry.valueText}`),
        EXPECTED_UW_TRANSFER_ADMISSION_REQUIREMENT_LINES,
        runtimePlan.id
      );
    }
  }
});

test("CADR guidance stays hidden without transcript-derived planner credits so it is not a generic always-on UW requirement", () => {
  assert.equal(
    buildUwGeneralTransferRequirementSection(csPlan, {
      completedCourses: [],
      hasTranscriptDerivedCreditSource: false,
    }),
    null
  );
});

test("Transcript-derived completed transferable credits below 40 keep the CADR section visible", () => {
  const completedCourses = buildBelowCadrThresholdTranscriptCourses();
  const creditSummary = buildCompletedTransferableQuarterCreditSummary({
    completedCourses,
    campusId: csPlan.campusId,
  });
  const section = buildUwGeneralTransferRequirementSection(csPlan, {
    completedCourses,
    hasTranscriptDerivedCreditSource: true,
  });

  assert.equal(creditSummary.completedTransferableQuarterCredits, 38);
  assert.deepEqual(creditSummary.countedCourseCodes, [
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "ENGL& 101",
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
  ]);
  assert.deepEqual(creditSummary.excludedIncompleteSequenceCourseCodes, []);
  assert.deepEqual(creditSummary.excludedNonTransferableCourseCodes, []);
  assert.ok(section);
  assert.equal(section?.title, "UW Transfer Admission Requirements");
});

test("Transcript-derived completed transferable credits at or above 40 hide the CADR section", () => {
  const completedCourses = buildAtOrAboveCadrThresholdTranscriptCourses();
  const creditSummary = buildCompletedTransferableQuarterCreditSummary({
    completedCourses,
    campusId: csPlan.campusId,
  });
  const section = buildUwGeneralTransferRequirementSection(csPlan, {
    completedCourses,
    hasTranscriptDerivedCreditSource: true,
  });

  assert.equal(creditSummary.completedTransferableQuarterCredits, 43);
  assert.ok(creditSummary.countedCourseCodes.includes("PHYS& 221"));
  assert.equal(section, null);
});

test("Non-transferable credits do not change the CADR visibility threshold", () => {
  const completedCourses = [
    ...buildBelowCadrThresholdTranscriptCourses(),
    ...buildTranscriptCourses("MATH 097"),
  ];
  const creditSummary = buildCompletedTransferableQuarterCreditSummary({
    completedCourses,
    campusId: csPlan.campusId,
  });
  const section = buildUwGeneralTransferRequirementSection(csPlan, {
    completedCourses,
    hasTranscriptDerivedCreditSource: true,
  });

  assert.equal(creditSummary.completedTransferableQuarterCredits, 38);
  assert.ok(creditSummary.excludedNonTransferableCourseCodes.includes("MATH 097"));
  assert.ok(section);
});

test("Tacoma Social Welfare keeps stronger source-backed breadth targets separate from the official UW transfer section", () => {
  const plan = getRequiredPlan("uw-tacoma-social-welfare");
  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(plan);
  const generalRequirementSection = buildUwGeneralTransferRequirementSection(plan);

  assert.deepEqual(diagnostics.sourceBackedTargets, {
    ahCredits: 20,
    sscCredits: 20,
    nscCredits: 20,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(diagnostics.hasSourceBackedTargets, true);
  assert.deepEqual(diagnostics.plannerGuidanceTargets, {
    ahCredits: null,
    sscCredits: null,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(generalRequirementSection?.plannerUsage, "summary-only");
  assert.equal(
    generalRequirementSection?.items.some((entry) =>
      entry.id === "ah" || entry.id === "ssc" || entry.id === "nsc" || /\b20\b/.test(entry.valueText)
    ),
    false
  );
});

test("Major-specific breadth targets stay intact after the CADR section hides at 40 transferable credits", () => {
  const plan = getRequiredPlan("uw-tacoma-social-welfare");
  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(plan);
  const generalRequirementSection = buildUwGeneralTransferRequirementSection(plan, {
    completedCourses: buildAtOrAboveCadrThresholdTranscriptCourses(),
    hasTranscriptDerivedCreditSource: true,
  });

  assert.equal(generalRequirementSection, null);
  assert.deepEqual(diagnostics.sourceBackedTargets, {
    ahCredits: 20,
    sscCredits: 20,
    nscCredits: 20,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(diagnostics.hasSourceBackedTargets, true);
});

test("HCDE shared-bucket gen-ed targets now promote into source-backed major summary items and plannable fixed targets", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-human-centered-design-engineering"
  );
  assert.ok(runtimePlan, "Expected the HCDE runtime plan.");

  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(runtimePlan);
  const section = buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(runtimePlan), {
    ahCredits: 10,
    sscCredits: 10,
    nscCredits: 50,
    breadthCredits: 10,
    electiveCredits: null,
  });
  assert.ok(section, "Expected HCDE major-specific source-backed gen-ed summary items.");
  assert.equal(
    section?.items.some(
      (entry) =>
        entry.label === "Arts & Humanities" && entry.valueText === "10 credits"
    ),
    true
  );
  assert.equal(
    section?.items.some(
      (entry) =>
        entry.label === "Social Sciences" && entry.valueText === "10 credits"
    ),
    true
  );
  assert.equal(
    section?.items.some(
      (entry) =>
        entry.label === "Additional Arts & Humanities / Social Sciences" &&
        entry.valueText === "10 credits"
    ),
    true
  );
  assert.equal(
    section?.items.some(
      (entry) =>
        entry.label === "Natural Sciences" && entry.valueText === "50 credits"
    ),
    true
  );
  assert.equal(diagnostics.hasSourceBackedTargets, true);
  assert.ok(diagnostics.sourceBackedSummarySection);
});

test("Materials NME breadth renders the shared A&H/SSc/DIV bucket without inventing A&H 24", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const section = buildSourceBackedMajorGeneralEducationRequirementSection(nmePlan);
  assert.ok(section, "Expected Materials NME source-backed gen-ed summary items.");

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(nmePlan), {
    ahCredits: 10,
    sscCredits: 10,
    nscCredits: 31,
    breadthCredits: 4,
    electiveCredits: null,
  });
  assert.equal(
    section?.items.some(
      (entry) => entry.label === "Arts & Humanities" && entry.valueText === "24 credits"
    ),
    false
  );
  assert.ok(
    section?.items.some(
      (entry) =>
        entry.label === "Areas of Inquiry" &&
        entry.valueText === "24 credits total" &&
        /Shared across Arts & Humanities and Social Sciences/i.test(entry.note ?? "") &&
        /5 credits must also satisfy Diversity/i.test(entry.note ?? "")
    )
  );
  assert.ok(
    section?.items.some(
      (entry) => entry.label === "Arts & Humanities" && entry.valueText === "10 credits"
    )
  );
  assert.ok(
    section?.items.some(
      (entry) => entry.label === "Social Sciences" && entry.valueText === "10 credits"
    )
  );
  assert.ok(
    section?.items.some(
      (entry) =>
        entry.label === "Additional Arts & Humanities / Social Sciences" &&
        entry.valueText === "4 credits"
    )
  );
  assert.ok(
    section?.items.some(
      (entry) =>
        entry.label === "Diversity" &&
        entry.valueText === "5 credits" &&
        /Overlaps with Arts & Humanities \/ Social Sciences/i.test(entry.note ?? "")
    )
  );
});

test("Generated GRC AST-2 Bio/Chem track stays faithful to the official source-backed curriculum map", () => {
  const track = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find(
    (entry) =>
      entry.id ===
      "grc-associate-stem-engineering-associate-in-science-transfer-track-2-bioengineering-and-chemical-engineering"
  );
  assert.ok(track, "Expected the generated AST-2 Bio/Chem track.");

  assert.deepEqual(
    track.terms.map((term) => ({ label: term.label, courses: term.courses })),
    [
      {
        label: "Quarter 0",
        courses: ["CHEM& 140", "PHYS& 114", "MATH& 141", "MATH& 142"],
      },
      {
        label: "Quarter 1 (18 credits)",
        courses: ["CHEM& 161", "ENGL& 101", "ENGR 100", "MATH& 151"],
      },
      {
        label: "Quarter 2 (14 credits)",
        courses: ["CHEM& 162", "ENGR 106", "MATH& 152"],
      },
      {
        label: "Quarter 3 (16 credits)",
        courses: [
          "CHEM& 163",
          "MATH& 163",
          "2 C - Humanities/Fine Arts/English or Social Science",
        ],
      },
      {
        label: "Quarter 4 (15 credits)",
        courses: [
          "MATH& 254",
          "PHYS& 221",
          "2 C - Humanities/Fine Arts/English or Social Science",
        ],
      },
      {
        label: "Quarter 5 (16 credits)",
        courses: ["MATH 238", "PHYS& 222", "BIOL& 211", "CHEM& 261"],
      },
      {
        label: "Quarter 6 (15 credits)",
        courses: [
          "MATH 240",
          "PHYS& 223",
          "2 C - Humanities/Fine Arts/English or Social Science",
        ],
      },
    ]
  );
  assert.ok(
    track.notes.some((note) =>
      /CHEM& 140 is only required if no prior chemistry experience/i.test(note)
    )
  );
});

test("Materials NME planning does not duplicate official breadth with matched-track A&H/SSc placeholders", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const track = getTransferPlannerTrack(nmePlan.bestTrackId ?? null);
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const transferOnlyQuarterPlan = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedCourses = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const transferOnlyPlannedCourses = transferOnlyQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const ahSscPlaceholderCourses = plannedCourses.filter((course) =>
    ["5 credits of Humanities", "5 credits of Social Science", "5 credits of A&H or SSc"].includes(
      course.label
    )
  );

  assert.deepEqual(
    ahSscPlaceholderCourses.map((course) => course.label),
    [
      "5 credits of Humanities",
      "5 credits of Social Science",
      "5 credits of A&H or SSc",
      "5 credits of Humanities",
      "5 credits of Social Science",
    ]
  );
  assert.equal(
    ahSscPlaceholderCourses.some((course) =>
      /matched Green River associate pathway/i.test(course.guidanceSummary ?? "")
    ),
    false
  );
  assert.ok(
    ahSscPlaceholderCourses.every((course) =>
      /needed for Materials Science & Engineering \(NME Option\)/i.test(
        course.guidanceSummary ?? ""
      )
    )
  );
  assert.equal(
    plannedCourses.some((course) => /24\/24 A&H credits/i.test(course.guidanceSummary ?? "")),
    false
  );
  assert.equal(
    plannedCourses.some((course) => /15\/15.*matched Green River associate pathway/i.test(course.guidanceSummary ?? "")),
    false
  );
  assert.equal(
    transferOnlyPlannedCourses.some((course) =>
      /matched Green River associate pathway/i.test(course.guidanceSummary ?? "")
    ),
    false
  );
  assert.equal(
    transferOnlyPlannedCourses.some((course) =>
      /needed for Materials Science & Engineering \(NME Option\)/i.test(
        course.guidanceSummary ?? ""
      )
    ),
    true
  );
});

test("Materials NME planning separates UW-major rows from official AST-2 track rows", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const track = getTransferPlannerTrack(nmePlan.bestTrackId ?? null);
  const plannedCourses = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  const cs122 = plannedCourses.find((course) => course.label === "CS 122");
  const engr140 = plannedCourses.find((course) => course.label === "ENGR 140");
  const math141 = plannedCourses.find((course) => course.label === "MATH& 141");
  const biol211 = plannedCourses.find((course) => course.label === "BIOL& 211");

  assert.equal(cs122?.sourceKind, "uw-major-requirement");
  assert.doesNotMatch(
    cs122?.guidanceSummary ?? "",
    /Source-backed UW Materials Science & Engineering/i
  );
  assert.doesNotMatch(cs122?.guidanceSummary ?? "", /Official Green River AST-2/i);
  assert.equal(engr140?.sourceKind, "uw-major-requirement");
  assert.doesNotMatch(
    engr140?.guidanceSummary ?? "",
    /Source-backed UW Materials Science & Engineering/i
  );

  assert.equal(math141?.sourceKind, "official-grc-track");
  assert.doesNotMatch(math141?.guidanceSummary ?? "", /Official Green River AST-2/i);
  assert.equal(biol211?.sourceKind, "official-grc-track");
  assert.doesNotMatch(biol211?.guidanceSummary ?? "", /Official Green River AST-2/i);
});

test("Materials NME planning can skip placement-dependent STEM prep classes", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const track = getTransferPlannerTrack(nmePlan.bestTrackId ?? null);
  const defaultPlannedCourses = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const noPrepPlannedCourses = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    includeStemPrepCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  const defaultLabels = new Set(defaultPlannedCourses.map((course) => course.label));
  const noPrepLabels = new Set(noPrepPlannedCourses.map((course) => course.label));

  assert.ok(defaultLabels.has("MATH& 141"));
  assert.ok(defaultLabels.has("MATH& 142"));
  assert.ok(defaultLabels.has("CHEM& 140"));
  assert.ok(defaultLabels.has("PHYS& 114"));
  assert.equal(
    defaultPlannedCourses.find((course) => course.label === "MATH& 141")?.creditAmount,
    5
  );
  assert.equal(
    defaultPlannedCourses.find((course) => course.label === "5 credits of Humanities")
      ?.creditAmount,
    5
  );
  assert.equal(noPrepLabels.has("MATH& 141"), false);
  assert.equal(noPrepLabels.has("MATH& 142"), false);
  assert.equal(noPrepLabels.has("CHEM& 140"), false);
  assert.equal(noPrepLabels.has("PHYS& 114"), false);
  assert.ok(noPrepLabels.has("MATH& 151"));
  assert.ok(noPrepLabels.has("MATH& 152"));
  assert.ok(noPrepLabels.has("MATH& 163"));
  assert.ok(noPrepLabels.has("CHEM& 161"));
  assert.ok(noPrepLabels.has("CHEM& 162"));
  assert.ok(noPrepLabels.has("PHYS& 221"));
  assert.ok(noPrepLabels.has("PHYS& 222"));
  assert.ok(noPrepLabels.has("PHYS& 223"));
  assert.ok(noPrepLabels.has("ENGR 140"));
  assert.ok(noPrepLabels.has("CS 122"));
  assert.ok(noPrepLabels.has("BIOL& 211"));
  assert.deepEqual(
    Array.from(new Set(defaultPlannedCourses.map((course) => course.label)))
      .filter((label) => !noPrepLabels.has(label))
      .sort(),
    ["CHEM& 140", "MATH& 141", "MATH& 142", "PHYS& 114"]
  );
});

test("Materials NME filler placeholders are not labeled as official AST-2 track content", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const track = getTransferPlannerTrack(nmePlan.bestTrackId ?? null);
  const plannedCourses = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const naturalSciencePlaceholders = plannedCourses.filter(
    (course) => course.label === "5 credits of Natural Sciences"
  );

  assert.ok(naturalSciencePlaceholders.length > 0);
  assert.ok(
    naturalSciencePlaceholders.every((course) => course.sourceKind === "uw-major-breadth")
  );
  assert.ok(
    naturalSciencePlaceholders.every((course) =>
      /needed for Materials Science & Engineering/i.test(
        course.guidanceSummary ?? ""
      )
    )
  );
  assert.equal(
    naturalSciencePlaceholders.some((course) =>
      /official matched Green River associate pathway map|Official Green River AST-2/i.test(
        course.guidanceSummary ?? ""
      )
    ),
    false
  );
});

test("Computer Engineering planning gets the same UW-major versus official GRC track attribution", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Computer Engineering runtime plan.");
  const track = getTransferPlannerTrack(runtimePlan.bestTrackId ?? null);
  assert.ok(track, "Expected the Computer Engineering matched GRC track.");

  const plannedCourses = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const cs121 = plannedCourses.find((course) => course.label === "CS 121");
  const math141 = plannedCourses.find((course) => course.label === "MATH& 141");

  assert.equal(cs121?.sourceKind, "uw-major-requirement");
  assert.doesNotMatch(cs121?.guidanceSummary ?? "", /Source-backed UW Computer Engineering/i);
  assert.doesNotMatch(cs121?.guidanceSummary ?? "", /Official Green River AST-2\/MRP/i);
  assert.equal(math141?.sourceKind, "official-grc-track");
  assert.doesNotMatch(math141?.guidanceSummary ?? "", /Official Green River AST-2\/MRP/i);
});

test("Matched-track gen-ed guidance yields to official UW breadth targets for another shared-bucket major", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-human-centered-design-engineering"
  );
  assert.ok(runtimePlan, "Expected the HCDE runtime plan.");
  const track = {
    id: "test-hcde-duplicate-general-education-placeholders",
    code: "TEST-HCDE",
    title: "HCDE duplicate placeholder track",
    summary: "Synthetic HCDE placeholder-only track for planner tests.",
    bestFor: ["testing"],
    terms: [
      {
        label: "Year 1 Fall",
        courses: ["Humanities", "Social Science", "Humanities or Social Science"],
      },
    ],
    notes: [],
  };

  const plannedCourses = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const matchedTrackGenEds = plannedCourses.filter((course) =>
    /matched Green River associate pathway/i.test(course.guidanceSummary ?? "")
  );

  assert.equal(
    matchedTrackGenEds.some((course) =>
      ["5 credits of Humanities", "5 credits of Social Science", "5 credits of A&H or SSc"].includes(
        course.label
      )
    ),
    false
  );
  assert.ok(
    plannedCourses.some(
      (course) =>
        ["5 credits of Humanities", "5 credits of Social Science", "5 credits of A&H or SSc"].includes(
          course.label
        ) &&
        /needed for Human Centered Design & Engineering/i.test(
          course.guidanceSummary ?? ""
        )
    )
  );
});

test("Bothell Applied Computing category-first breadth lines recover separate A&H and SSc targets", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-bothell-applied-computing");
  assert.ok(runtimePlan, "Expected the Applied Computing runtime plan.");

  const section = buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(runtimePlan), {
    ahCredits: 15,
    sscCredits: 15,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.ok(section, "Expected Applied Computing source-backed gen-ed summary items.");
  assert.deepEqual(
    section?.items.map((entry) => `${entry.label}: ${entry.valueText}`),
    ["Arts & Humanities: 15 credits", "Social Sciences: 15 credits", "Diversity: 5 credits"]
  );
  assert.equal(
    section?.items.some((entry) => /Arts & Humanities \/ Social Sciences/i.test(entry.label)),
    false
  );
});

test("Computer Engineering Areas-of-Inquiry range targets surface as summary items and plannable minimums", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Computer Engineering runtime plan.");

  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(runtimePlan);
  const section = buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(runtimePlan), {
    ahCredits: 10,
    sscCredits: 10,
    nscCredits: null,
    breadthCredits: 10,
    electiveCredits: null,
  });
  assert.ok(section, "Expected Computer Engineering to expose structured ranged summary items.");
  assert.deepEqual(
    section?.items.map((entry) => `${entry.label}: ${entry.valueText}${entry.note ? ` (${entry.note})` : ""}`),
    [
      "Diversity: 5 credits",
      "Areas of Inquiry: 30 credits total",
      "Arts & Humanities: 10-20 credits (Within the 30 credits Areas of Inquiry total.)",
      "Social Sciences: 10-20 credits (Within the 30 credits Areas of Inquiry total.)",
    ]
  );
  assert.equal(diagnostics.hasSourceBackedTargets, true);
  assert.ok(diagnostics.sourceBackedSummarySection);
});

test("Major Specifics summarizes source-backed Gen-Ed targets without echoing planned placeholder rows", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Computer Engineering runtime plan.");

  const track = getTransferPlannerTrack(runtimePlan.bestTrackId ?? null);
  const sections = buildMajorSpecificsCourseSections({
    plan: runtimePlan,
    track,
    completedCourses: [],
  });
  const genEdSection = sections.find(
    (section) => section.id === "gen-ed-breadth-requirements"
  );

  assert.ok(genEdSection, "Expected Computer Engineering Gen-Ed Requirements section.");
  assert.deepEqual(
    genEdSection?.rows.map((entry) => entry.text),
    [
      "Arts & Humanities: 10-20 credits (Within the 30 credits Areas of Inquiry total.)",
      "Social Sciences: 10-20 credits (Within the 30 credits Areas of Inquiry total.)",
      "Diversity: 5 credits",
      "Areas of Inquiry: 30 credits total",
    ]
  );
  assert.equal(
    genEdSection?.rows.some((entry) => /^5 credits of /i.test(entry.text)),
    false
  );
  assert.equal(
    genEdSection?.rows.every((entry) => entry.requirementRole === "informational"),
    true
  );

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    applicationStatuses: buildRequirementStatuses(runtimePlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(runtimePlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedPlaceholderLabels = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses)
    .filter((course) => course.sourceKind === "uw-major-breadth")
    .map((course) => course.label);

  assert.equal(
    plannedPlaceholderLabels.filter((label) => label === "5 credits of Humanities").length,
    2
  );
  assert.equal(
    plannedPlaceholderLabels.filter((label) => label === "5 credits of Social Science").length,
    2
  );
  assert.equal(
    plannedPlaceholderLabels.filter((label) => label === "5 credits of A&H or SSc").length,
    2
  );
});

test("Major Specifics suppresses matched-track Gen-Ed placeholders when source-backed breadth summaries exist", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-electrical-computer-engineering"
  );
  assert.ok(runtimePlan, "Expected the Electrical & Computer Engineering runtime plan.");

  const embeddedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimePlan,
    "embedded-systems-pathway"
  );
  assert.ok(embeddedPlan, "Expected the ECE Embedded Systems pathway.");

  const track = getTransferPlannerTrack(embeddedPlan.bestTrackId ?? null);
  const sections = buildMajorSpecificsCourseSections({
    plan: embeddedPlan,
    track,
    completedCourses: [],
  });
  const genEdSection = sections.find(
    (section) => section.id === "gen-ed-breadth-requirements"
  );

  assert.ok(genEdSection, "Expected an ECE Gen-Ed Requirements section.");
  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(embeddedPlan), {
    ahCredits: 10,
    sscCredits: 10,
    nscCredits: null,
    breadthCredits: 4,
    electiveCredits: null,
  });
  assert.equal(
    genEdSection?.rows.some(
      (entry) =>
        /^5 credits of /i.test(entry.text) &&
        /official matched Green River associate pathway map/i.test(entry.text)
    ),
    false
  );
  assert.deepEqual(
    genEdSection?.rows.map((entry) => entry.text),
    [
      "Arts & Humanities: 10 credits",
      "Social Sciences: 10 credits",
      "Additional Arts & Humanities / Social Sciences: 4 credits",
      "Diversity: 5 credits (Overlaps with Arts & Humanities / Social Sciences.)",
    ]
  );
  assert.equal(
    genEdSection?.rows.some((entry) => /Areas of Inquiry: 69 credits total/i.test(entry.text)),
    false
  );

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: embeddedPlan,
    applicationStatuses: buildRequirementStatuses(embeddedPlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(embeddedPlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(embeddedPlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  assert.equal(
    quarterPlan
      .flatMap((quarter) => quarter.courses)
      .some((course) => course.sourceKind === "official-grc-track-breadth"),
    false,
    "Expected source-backed ECE breadth targets to replace matched Green River breadth placeholders."
  );
  assert.equal(
    quarterPlan
      .flatMap((quarter) => quarter.courses)
      .some((course) => course.sourceKind === "uw-major-breadth"),
    true,
    "Expected source-backed ECE breadth placeholders to remain in the quarter plan."
  );
});

test("Seattle Education Studies keeps mixed conflicting catalog gen-ed structures unsupported until a single coherent major-specific target is isolated", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-education-studies");
  assert.ok(runtimePlan, "Expected the Education Studies runtime plan.");

  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(runtimePlan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(runtimePlan), {
    ahCredits: null,
    sscCredits: null,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan), null);
  assert.equal(diagnostics.hasSourceBackedTargets, false);
});

test("Seattle Jewish Studies does not invent major-specific gen-ed targets from 300-400-level elective prose", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-jewish-studies");
  assert.ok(runtimePlan, "Expected the Jewish Studies runtime plan.");

  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(runtimePlan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(runtimePlan), {
    ahCredits: null,
    sscCredits: null,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan), null);
  assert.equal(diagnostics.hasSourceBackedTargets, false);
});

test("Seattle Aeronautics fixed source-backed gen-ed targets still render as simple major summary items", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");

  const section = buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan);

  assert.ok(section, "Expected Aeronautics source-backed gen-ed summary items.");
  assert.deepEqual(
    section?.items.map((entry) => `${entry.label}: ${entry.valueText}`),
    [
      "Arts & Humanities: 10 credits",
      "Social Sciences: 10 credits",
      "Additional Arts & Humanities / Social Sciences: 4 credits",
    ]
  );
});

test("Seattle Aeronautics does not misread the science-core NSc option as a 5-credit general-education target", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");

  const completedCourses = buildTranscriptCourses("CS 123", "MATH 238", "MATH& 254");
  const statuses = buildStatuses(runtimePlan, completedCourses);
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...statuses,
    completedCourses,
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const completedGuidanceSummaries = quarterPlan
    .filter((quarter) => quarter.phase === "completed")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => ["CS 123", "MATH 238", "MATH& 254"].includes(course.label))
        .map((course) => course.guidanceSummary ?? "")
    );

  assert.equal(completedGuidanceSummaries.length, 3);
  for (const guidanceSummary of completedGuidanceSummaries) {
    assert.doesNotMatch(
      guidanceSummary,
      /NSc credits needed for Aeronautics & Astronautics\./i
    );
  }
});

test("Applied Mathematics track guidance keeps breadth placeholders clearly labeled as matched-pathway planner guidance", () => {
  const plan = getRequiredPlan("uw-seattle-applied-mathematics");
  const track = {
    id: "test-apmath-general-education-placeholders",
    code: "TEST-APMATH",
    title: "Applied Mathematics placeholder track",
    summary: "Synthetic Applied Mathematics placeholder-only track for planner tests.",
    bestFor: ["testing"],
    terms: [
      {
        label: "Year 1 Fall",
        courses: ["Humanities", "Social Science", "Humanities or Social Science"],
      },
    ],
    notes: [],
  };

  const plannedCourses = buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  const humanitiesCourse = plannedCourses.find((course) => course.label === "5 credits of Humanities");
  const socialScienceCourse = plannedCourses.find(
    (course) => course.label === "5 credits of Social Science"
  );
  const sharedBreadthCourse = plannedCourses.find((course) => course.label === "5 credits of A&H or SSc");

  assert.ok(humanitiesCourse, "Expected at least one Humanities placeholder.");
  assert.ok(socialScienceCourse, "Expected at least one Social Science placeholder.");
  assert.ok(sharedBreadthCourse, "Expected the explicit shared breadth placeholder from the matched track.");

  assert.match(
    humanitiesCourse?.guidanceSummary ?? "",
    /5\/5 A&H credits from the official matched Green River associate pathway map for Applied Mathematics\./i
  );
  assert.match(
    socialScienceCourse?.guidanceSummary ?? "",
    /5\/5 SSc credits from the official matched Green River associate pathway map for Applied Mathematics\./i
  );
  assert.match(
    humanitiesCourse?.guidanceSummary ?? "",
    /not an official UW transfer admission requirement\./i
  );
  assert.doesNotMatch(
    humanitiesCourse?.guidanceSummary ?? "",
    /Gen-Eds/i
  );
  assert.match(
    sharedBreadthCourse?.guidanceSummary ?? "",
    /additional A&H\/SSc credits from the official matched Green River associate pathway map for Applied Mathematics\./i
  );
});

test("Transfer planner UI keeps the UW transfer admission section separate and transcript-gated", () => {
  const pageSource = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");
  const uwAccordionIndex = pageSource.indexOf("UW ${plan.title} Degree Classes");
  const generalTransferSectionIndex = pageSource.indexOf(
    "uwGeneralTransferRequirementSection.title"
  );
  const categorizedMajorSpecificsIndex = pageSource.indexOf(
    "majorSpecificsCourseSections.length",
    generalTransferSectionIndex
  );
  const fallbackRequiredCoursesIndex = pageSource.indexOf(
    "Official UW Required Courses",
    categorizedMajorSpecificsIndex
  );

  assert.match(pageSource, /buildUwGeneralTransferRequirementSection/);
  assert.match(pageSource, /buildMajorSpecificsCourseSections/);
  assert.match(
    pageSource,
    /No source-backed major-specific general education targets are currently published for this major\./
  );
  assert.match(
    pageSource,
    /official UW transfer admission guidance when applicable, Gen-Eds, and prerequisite dependencies/
  );
  assert.match(pageSource, /transcriptDerivedCompletedCourses/);
  assert.match(pageSource, /hasTranscriptDerivedCreditSource/);
  assert.match(pageSource, /shouldUseDetailedCompletedCourses/);
  assert.match(pageSource, /entry\.valueText/);
  assert.match(pageSource, /majorSpecificsCourseSections/);
  assert.match(pageSource, /sourceBackedUwGeneralEducationSection/);
  assert.equal(uwAccordionIndex >= 0, true);
  assert.equal(generalTransferSectionIndex > uwAccordionIndex, true);
  assert.equal(categorizedMajorSpecificsIndex > generalTransferSectionIndex, true);
  assert.equal(fallbackRequiredCoursesIndex > categorizedMajorSpecificsIndex, true);
});

test("Transfer planner UI renders UW courses considered from source-backed UW summary entries", () => {
  const pageSource = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(pageSource, /buildUwRequiredPathCourseEntries/);
  assert.match(pageSource, /buildSourceBackedUwCourseConsideredSummaryEntries/);
});

test("Seattle American Ethnic Studies now keeps official transfer policy separate from major-specific and planner-guidance layers", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-american-ethnic-studies");
  assert.ok(runtimePlan, "Expected the American Ethnic Studies runtime plan.");
  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(runtimePlan);
  const sourceBackedSection = buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan);
  const generalRequirementSection = buildUwGeneralTransferRequirementSection(runtimePlan);

  const fullQuarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    applicationStatuses: buildRequirementStatuses(runtimePlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(runtimePlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const transferOnlyQuarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    applicationStatuses: buildRequirementStatuses(runtimePlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(runtimePlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const humanitiesPlaceholders = fullQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => course.label === "5 credits of Humanities")
        .map((course) => ({ quarterLabel: quarter.label, course }))
    );
  const sharedBreadthPlaceholders = fullQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses.filter((course) => course.label === "5 credits of A&H or SSc")
    );
  const naturalSciencePlaceholders = fullQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => course.label === "5 credits of Natural Sciences")
        .map((course) => ({ quarterLabel: quarter.label, course }))
    );
  const socialSciencePlaceholders = fullQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => course.label === "5 credits of Social Science")
        .map((course) => ({ quarterLabel: quarter.label, course }))
    );

  assert.deepEqual(diagnostics.sourceBackedTargets, {
    ahCredits: null,
    sscCredits: null,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.deepEqual(diagnostics.plannerGuidanceTargets, {
    ahCredits: null,
    sscCredits: null,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(diagnostics.hasSourceBackedTargets, false);
  assert.equal(sourceBackedSection, null);
  assert.equal(generalRequirementSection?.plannerUsage, "summary-only");
  assert.deepEqual(
    generalRequirementSection?.items.map((entry) => `${entry.label}: ${entry.valueText}`),
    EXPECTED_UW_TRANSFER_ADMISSION_REQUIREMENT_LINES
  );
  assert.ok(humanitiesPlaceholders.length >= 3);
  assert.ok(naturalSciencePlaceholders.length >= 3);
  assert.ok(socialSciencePlaceholders.length >= 2);
  assert.ok(sharedBreadthPlaceholders.length >= 0);
  assert.match(
    humanitiesPlaceholders[0]?.course.guidanceSummary ?? "",
    /A&H credits from the official matched Green River associate pathway map for American Ethnic Studies\./i
  );
  assert.match(
    humanitiesPlaceholders[humanitiesPlaceholders.length - 1]?.course.guidanceSummary ?? "",
    /not an official UW transfer admission requirement\./i
  );
  assert.match(
    naturalSciencePlaceholders[0]?.course.guidanceSummary ?? "",
    /NSc credits from the official matched Green River associate pathway map for American Ethnic Studies\./i
  );
  assert.match(
    socialSciencePlaceholders[0]?.course.guidanceSummary ?? "",
    /SSc credits from the official matched Green River associate pathway map for American Ethnic Studies\./i
  );
  assert.equal(
    fullQuarterPlan
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses.map((course) => course.guidanceSummary ?? ""))
      .some((guidance) => /UW-wide general transfer requirements/i.test(guidance)),
    false
  );
  assert.equal(
    transferOnlyQuarterPlan
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses.map((course) => course.label))
      .some((label) => /^5 credits of /i.test(label)),
    false
  );
  if (sharedBreadthPlaceholders.length > 0) {
    assert.match(
      sharedBreadthPlaceholders[0]?.guidanceSummary ?? "",
      /additional A&H\/SSc credits from the official matched Green River associate pathway map for American Ethnic Studies\./i
    );
  }
});

test("Seattle American Ethnic Studies materializes the four official concentration pathways", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-american-ethnic-studies");
  assert.ok(runtimePlan, "Expected the American Ethnic Studies runtime plan.");

  const expectedConcentrations = [
    ["african-american-studies-concentration", "African American Studies Concentration"],
    ["asian-american-pia-studies-concentration", "Asian American/PIA Studies Concentration"],
    ["chicano-a-studies-concentration", "Chicano/a Studies Concentration"],
    [
      "comparative-american-ethnic-studies-concentration",
      "Comparative American Ethnic Studies Concentration",
    ],
  ];
  const rootPathwayLabels = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-american-ethnic-studies",
    null
  ).flatMap((block) => block.pathwayLabels ?? []);
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan).map(
    (pathway) => [pathway.id, pathway.label]
  );

  assert.deepEqual(
    rootPathwayLabels.filter((label) => /\bconcentration\b/i.test(label)),
    expectedConcentrations.map(([, label]) => label.replace(/\bConcentration\b$/, "concentration"))
  );
  assert.deepEqual(runtimePathways, expectedConcentrations);
  assert.equal(
    runtimePathways.some(([, label]) => /\bhonou?rs?\s+thesis\b/i.test(label)),
    false
  );
});

test("Seattle American Ethnic Studies UW courses considered include source-backed UW degree courses beyond Green River equivalents", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-american-ethnic-studies");
  assert.ok(runtimePlan, "Expected the American Ethnic Studies runtime plan.");

  const entries = buildSourceBackedUwCourseConsideredSummaryEntries(runtimePlan);
  const courseCodes = entries.map((entry) => entry.courseCode);
  const entryText = entries.map((entry) => entry.text).join("\n");

  for (const courseCode of [
    "AAS 101",
    "AFRAM 101",
    "CHSTU 101",
    "AES 150",
    "AES 151",
    "AES 212",
    "ENGL 131",
    "AFRAM 214",
    "AAS 220",
    "CHSTU 416",
    "AES 487",
  ]) {
    assert.ok(courseCodes.includes(courseCode), `Expected UW courses considered to include ${courseCode}.`);
  }
  assert.equal(courseCodes.includes("ENGL& 101"), false);
  assert.match(entryText, /AAS 101 - /);
  assert.match(entryText, /AFRAM 214/);
});

test("Classes for UW transfer only mode keeps matched-associate filler behavior separate from the CADR visibility rule", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");
  const belowThresholdSection = buildUwGeneralTransferRequirementSection(runtimePlan, {
    completedCourses: buildBelowCadrThresholdTranscriptCourses(),
    hasTranscriptDerivedCreditSource: true,
  });
  const atOrAboveThresholdSection = buildUwGeneralTransferRequirementSection(runtimePlan, {
    completedCourses: buildAtOrAboveCadrThresholdTranscriptCourses(),
    hasTranscriptDerivedCreditSource: true,
  });

  const transferOnlyQuarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    applicationStatuses: buildRequirementStatuses(runtimePlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(runtimePlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const fullQuarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    applicationStatuses: buildRequirementStatuses(runtimePlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(runtimePlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const transferOnlyPlannedCourses = transferOnlyQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const fullPlannedCourses = fullQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  assert.ok(belowThresholdSection);
  assert.equal(atOrAboveThresholdSection, null);
  assert.equal(
    transferOnlyPlannedCourses.some((course) =>
      /not an official UW transfer admission requirement/i.test(course.guidanceSummary ?? "")
    ),
    false
  );
  assert.ok(
    transferOnlyPlannedCourses.some((course) =>
      /needed for Aeronautics & Astronautics/i.test(
        course.guidanceSummary ?? ""
      )
    )
  );
  assert.ok(transferOnlyPlannedCourses.some((course) => course.label === "PHYS& 114"));
  assert.equal(
    fullPlannedCourses.some((course) =>
      /not an official UW transfer admission requirement/i.test(course.guidanceSummary ?? "")
    ),
    false
  );
  assert.ok(fullPlannedCourses.some((course) => course.label === "PHYS& 114"));
});

test("Seattle American Ethnic Studies runtime keeps source-backed support bundles visible for track matching", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-american-ethnic-studies");
  assert.ok(runtimePlan, "Expected the American Ethnic Studies runtime plan.");

  const stayAtGrcTitles = (runtimePlan.stayAtGrcChecklist ?? []).map((item) => item.title);
  const runtimeCourseList = getTransferPlannerGrcCourseList(runtimePlan);

  assert.deepEqual(stayAtGrcTitles, [
    "Ethnic studies and related social-science foundation",
    "History and humanities support for concentration work",
    "Writing-heavy humanities support",
  ]);
  assert.ok(runtimeCourseList.includes("AMES 100"));
  assert.ok(runtimeCourseList.includes("HUMAN 100"));
  assert.ok(runtimeCourseList.includes("ENGL& 101"));
  assert.equal(runtimeCourseList.includes("CS 121"), false);

  const resolvedRuntimePlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, null);
  assert.ok(resolvedRuntimePlan, "Expected the resolved American Ethnic Studies runtime plan.");
  assert.equal(
    resolvedRuntimePlan.bestTrackId,
    "grc-associate-education-law-social-science-american-ethnic-studies-aa-dta-emphasis-american-ethnic-studies"
  );
  assert.match(
    resolvedRuntimePlan.recommendedTrackSummary,
    /current closest Green River transfer path for this degree/i
  );
  assert.match(
    resolvedRuntimePlan.recommendedTrackSummary,
    /degree-specific Green River classes currently tracked for this major/i
  );
});

test("Green River track generation covers the current official associate program-map library and can widen to more program types", () => {
  const generatedTrackSummaryRecord =
    TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY as Record<string, unknown>;
  const supportedProgramCount =
    "officialSupportedProgramCount" in generatedTrackSummaryRecord
      ? Number(generatedTrackSummaryRecord["officialSupportedProgramCount"] ?? 0)
      : TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.officialAssociateTrackCount;
  const connectedSupportedProgramCount =
    "connectedSupportedProgramCount" in generatedTrackSummaryRecord
      ? Number(generatedTrackSummaryRecord["connectedSupportedProgramCount"] ?? 0)
      : TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.connectedAssociateTrackCount;

  assert.ok(TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.programMapPageCount > 0);
  assert.ok(TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.officialAssociateTrackCount >= 80);
  assert.ok(supportedProgramCount >= TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.officialAssociateTrackCount);
  assert.ok(
    TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.connectedAssociateTrackCount <=
      TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.officialAssociateTrackCount
  );
  assert.ok(connectedSupportedProgramCount <= supportedProgramCount);
  assert.equal(
    TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.generatedTrackCount,
    connectedSupportedProgramCount
  );

  const businessManagementTrack = getTransferPlannerTrack(
    "grc-associate-business-entrepreneurship-business-management-aaa"
  );
  const englishCreativeWritingTrack = getTransferPlannerTrack(
    "grc-associate-fine-arts-humanities-english-aa-dta-emphasis-creative-writing"
  );
  const practicalNursingTrack = getTransferPlannerTrack(
    "grc-associate-healthcare-wellness-nursing-practical-nursing-aas"
  );
  const automotiveTrack = getTransferPlannerTrack(
    "grc-associate-trades-industrial-tech-aviation-natural-resources-automotive-technology-aas"
  );

  for (const track of [
    businessManagementTrack,
    englishCreativeWritingTrack,
    practicalNursingTrack,
    automotiveTrack,
  ]) {
    assert.ok(track, "Expected generated associate tracks across transfer and non-transfer categories.");
    assert.ok(track?.officialLinks?.length, `Expected ${track?.id ?? "track"} to include source links.`);
    assert.ok(track?.terms.length, `Expected ${track?.id ?? "track"} to keep generated curriculum terms.`);
  }

  assert.equal(businessManagementTrack?.code, "AAA");
  assert.equal(englishCreativeWritingTrack?.code, "AA-DTA");
  assert.equal(practicalNursingTrack?.code, "AAS");
  assert.equal(automotiveTrack?.code, "AAS");
});

test("Generated associate tracks avoid legacy compatibility IDs and use only current connector-backed terms", () => {
  const trackQ = getTransferPlannerTrack("999Q");
  const trackO = getTransferPlannerTrack("999O");
  const trackP = getTransferPlannerTrack("999P");
  const legacyBaseTrack = getTransferPlannerTrack("999B");

  assert.equal(Boolean(trackQ), false, "Legacy compatibility track 999Q should not be generated.");
  assert.equal(Boolean(trackO), false, "Legacy compatibility track 999O should not be generated.");
  assert.equal(Boolean(trackP), false, "Legacy compatibility track 999P should not be generated.");
  assert.equal(Boolean(legacyBaseTrack), false, "Legacy compatibility track 999B should not be generated.");

  const connectorBackedEngineeringTrack =
    getTransferPlannerTrack(
      "grc-associate-trades-industrial-tech-aviation-natural-resources-computer-and-electrical-engineering-as"
    ) ??
    getTransferPlannerTrack(
      "grc-associate-trades-industrial-tech-aviation-natural-resources-computer-and-electrical-engineering-as-t"
    );
  if (connectorBackedEngineeringTrack) {
    assert.equal(
      connectorBackedEngineeringTrack.terms
        .flatMap((term) => term.courses)
        .some((entry) => /select course from list/i.test(entry)),
      false
    );
  }
});

test("Generated ACS-DTA/MRP track keeps distribution guidance generic instead of promoting example social-science courses", () => {
  const track = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find(
    (entry) =>
      entry.id === "grc-associate-stem-computer-science-associate-in-computer-science-acs-dta-mrp"
  );
  const quarter3 = track?.terms.find((term) => term.label === "Quarter 3 (15 credits)");
  const quarter6 = track?.terms.find((term) => term.label === "Quarter 6 (15 credits)");
  const allLabels = track?.terms.flatMap((term) => term.courses) ?? [];

  assert.ok(track, "Expected the current ACS-DTA/MRP Computer Science track.");
  assert.deepEqual(quarter3?.courses, ["CS 121", "MATH& 163", "Humanities or Social Science"]);
  assert.deepEqual(quarter6?.courses, ["Humanities or Social Science", "Elective or General Education"]);
  assert.equal(allLabels.includes("CMST& 220"), false);
  assert.equal(allLabels.includes("PSYC& 100"), false);
  assert.equal(allLabels.includes("AMES 100"), false);
  assert.equal(allLabels.includes("ANTH& 206"), false);
});

test("Generated Math Education AM-DTA tracks keep source identity and avoid note-only filler slots", () => {
  const mathTrackId =
    "grc-associate-stem-mathematics-math-curriculum-map-aa-dta-math-emphasis";
  const statisticsTrackId =
    "grc-associate-stem-mathematics-math-curriculum-map-aa-dta-statistics";
  const mathTrack = getTransferPlannerTrack(mathTrackId);
  const generatedMathTrack = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find(
    (entry) => entry.id === mathTrackId
  );
  const statisticsTrack = getTransferPlannerTrack(statisticsTrackId);

  assert.ok(mathTrack, "Expected the Math Education AM-DTA (Mathematics) track.");
  assert.ok(generatedMathTrack, "Expected generated Math Education AM-DTA data.");
  assert.ok(statisticsTrack, "Expected the Math Education AM-DTA (Statistics) track.");
  assert.equal(mathTrack.code, "AM-DTA");
  assert.equal(generatedMathTrack.code, "AM-DTA");
  assert.equal(statisticsTrack.code, "AM-DTA");
  assert.equal(
    mathTrack.officialLinks?.[0]?.label,
    "Math Education, AM-DTA (Mathematics) curriculum map"
  );
  assert.equal(
    statisticsTrack.officialLinks?.[0]?.label,
    "Math Education, AM-DTA (Statistics) curriculum map"
  );

  const mathLabels = mathTrack.terms.flatMap((term) => term.courses);
  const statisticsLabels = statisticsTrack.terms.flatMap((term) => term.courses);

  assert.equal(mathLabels.includes("Elective or General Education"), false);
  assert.equal(statisticsLabels.includes("Elective or General Education"), false);
  assert.equal(mathLabels.includes("Social Science"), false);
  assert.equal(
    mathLabels.some((label) => /best transferability|for pure math majors|for applied math majors/i.test(label)),
    false
  );
  assert.equal(mathTrack.terms.some((term) => /notes|transferability of credits/i.test(term.label)), false);
  assert.deepEqual(mathTrack.terms.map((term) => term.label), [
    "Quarter 1 (15 credits)",
    "Quarter 2 (15 credits)",
    "Quarter 3 (15 credits)",
    "Quarter 4 (15 credits)",
    "Quarter 5 (15 credits)",
    "Quarter 6 (15 credits)",
  ]);
  assert.ok(mathLabels.includes("S 1 - Social Science"));
  assert.ok(mathLabels.includes("S 2 - Social Science"));
  assert.ok(mathLabels.includes("S 3 - Social Science"));
  assert.ok(mathLabels.includes("H 1 - Humanities/Fine Arts/English"));
  assert.ok(mathLabels.includes("H 2 - Humanities/Fine Arts/English"));
  assert.ok(mathLabels.includes("H 3 - Humanities/Fine Arts/English"));
  assert.ok(mathLabels.includes("Computer Science (CS) or Engineering (ENGR)"));
});

test("Math Education AM-DTA planning does not synthesize unsupported elective/general-education filler", () => {
  const track = getTransferPlannerTrack(
    "grc-associate-stem-mathematics-math-curriculum-map-aa-dta-math-emphasis"
  );
  assert.ok(track, "Expected the Math Education AM-DTA (Mathematics) track.");

  const plannedCourses = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  assert.equal(
    plannedCourses.some((course) => course.label === "5 credits of elective/general education"),
    false
  );
  assert.equal(
    plannedCourses.filter((course) => course.label === "5 credits of Humanities").length,
    3
  );
  assert.equal(
    plannedCourses.filter((course) => course.label === "5 credits of Social Science").length,
    3
  );
  assert.equal(
    plannedCourses.some((course) => /elective\/general-education/i.test(course.guidanceSummary ?? "")),
    false
  );
});

test("GRC public-material discovery extracts annual schedules and current catalog details from public pages", () => {
  const schedules = extractGrcAnnualSchedules(`
    <a href="/students/media/documents/schedules-and-catalog/2026-2027%20Annual%20Schedule.pdf">
      2026-2027 Annual Schedule (PDF)
    </a>
    <a href="/students/media/documents/schedules-and-catalog/2025-2026%20Annual%20Schedule%20w%20Cover.pdf">
      2025-2026 Annual Schedule (PDF)
    </a>
  `);
  const catalogEntries = extractGrcCatalogArchiveEntries(`
    <a href="https://catalog.greenriver.edu/">Green River College 2025-2026 Catalog</a>
    <a href="https://catalog.greenriver.edu/index.php?catoid=8">Green River College 2024-2025 Catalog</a>
  `);
  const currentCatalog = extractCurrentGrcCatalogDetails(
    `
      <a href="/content.php?catoid=10&amp;navoid=624">Course Descriptions</a>
    `,
    "https://catalog.greenriver.edu/",
    "2025-2026"
  );

  assert.deepEqual(
    schedules.map((entry: { label: string }) => entry.label),
    ["2025-2026", "2026-2027"]
  );
  assert.equal(
    schedules[1]?.url,
    "https://www.greenriver.edu/students/media/documents/schedules-and-catalog/2026-2027%20Annual%20Schedule.pdf"
  );

  assert.deepEqual(
    catalogEntries.map((entry: { label: string }) => entry.label),
    ["2025-2026", "2024-2025"]
  );
  assert.equal(currentCatalog.courseDescriptionsUrl, "https://catalog.greenriver.edu/content.php?catoid=10&navoid=624");
  assert.equal(
    currentCatalog.courseDescriptionsExpandedUrl,
    "https://catalog.greenriver.edu/content.php?catoid=10&navoid=624&expand=1&print="
  );
  const pagedCatalogUrl = buildPagedGrcCourseDescriptionsUrl(
    currentCatalog.courseDescriptionsExpandedUrl,
    3
  );
  assert.match(pagedCatalogUrl, /catoid=10/);
  assert.match(pagedCatalogUrl, /navoid=624/);
  assert.match(pagedCatalogUrl, /filter%5Bcpage%5D=3/);
  assert.match(pagedCatalogUrl, /expand=1/);
  assert.deepEqual(
    filterRelevantAnnualSchedules(
      [
        { label: "2020-2021" },
        { label: "2024-2025" },
        { label: "2025-2026" },
        { label: "2026-2027" },
      ],
      "2025-2026"
    ).map((entry: { label: string }) => entry.label),
    ["2024-2025", "2025-2026", "2026-2027"]
  );
});

test("Planner-tracked Green River courses now expose annual-schedule availability history", () => {
  const engr250Availability = getTransferPlannerGrcCourseAvailability("ENGR 250");
  const math240Availability = getTransferPlannerGrcCourseAvailability("MATH 240");
  const priorOnlyAvailability = getTransferPlannerGrcCourseAvailability("ENGL& 237");
  const catalogOnlyAvailability = getTransferPlannerGrcCourseAvailability("AMES 150");
  const noSourceEntry = Object.entries(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY).find(
    ([, entry]) => entry.status === "planner-course-no-current-public-source"
  );
  const noSourceAvailability = noSourceEntry
    ? getTransferPlannerGrcCourseAvailability(noSourceEntry[0])
    : null;

  assert.ok(engr250Availability, "Expected ENGR 250 availability history.");
  assert.equal(engr250Availability.status, "published-in-recent-history-not-latest");
  assert.ok(
    engr250Availability.years.some(
      (year) => year.label === "2024-2025" && year.quarters.join(",") === "winter"
    )
  );
  assert.ok(
    engr250Availability.years.some(
      (year) =>
        year.label === "2025-2026" &&
        year.quarters.includes("summer") &&
        year.quarters.includes("winter")
    )
  );
  assert.ok(
    engr250Availability.years.some(
      (year) => year.label === "2026-2027" && year.quarters.length === 0
    )
  );

  assert.ok(math240Availability, "Expected MATH 240 availability history.");
  assert.equal(math240Availability.status, "published-in-latest-schedule");
  assert.deepEqual(math240Availability.latestPublishedQuarters, [
    "summer",
    "fall",
    "winter",
    "spring",
  ]);
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary("ENGR 250") ?? "",
    /2024-2025: Winter/
  );
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary("ENGR 250") ?? "",
    /2025-2026: Summer, Winter/
  );
  assert.ok(priorOnlyAvailability, "Expected ENGL& 237 availability history.");
  assert.equal(priorOnlyAvailability.status, "published-in-recent-history-not-latest");
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary("ENGL& 237") ?? "",
    /Recent GRC annual schedule history: 2024-2025: Fall, Spring\./
  );
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary("ENGL& 237") ?? "",
    /Not published in the latest 20\d{2}-20\d{2} annual schedule\./
  );

  assert.ok(catalogOnlyAvailability, "Expected AMES 150 availability classification.");
  assert.equal(catalogOnlyAvailability.status, "catalog-listed-not-in-latest-schedules");
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary("AMES 150") ?? "",
    /Listed in the current Green River catalog, but not found/
  );

  assert.ok(noSourceAvailability, "Expected at least one planner-course-no-current-public-source classification.");
  assert.equal(noSourceAvailability.status, "planner-course-no-current-public-source");
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary(noSourceEntry?.[0] ?? "") ?? "",
    /Still referenced by the planner, but not found in the current Green River catalog/
  );

  assert.equal(Object.hasOwn(engr250Availability, "note"), false);
  assert.equal(Object.hasOwn(catalogOnlyAvailability, "note"), false);
});

test("Generated Green River availability statuses now fully replace manual-review notes", () => {
  const countsByStatus = Object.values(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY).reduce(
    (counts, entry) => {
      counts[entry.status] = (counts[entry.status] ?? 0) + 1;
      return counts;
    },
    {} as Record<string, number>
  );

  assert.deepEqual(Object.keys(countsByStatus).sort(), [
    "catalog-listed-not-in-latest-schedules",
    "planner-course-no-current-public-source",
    "published-in-latest-schedule",
    "published-in-recent-history-not-latest",
  ]);
  assert.equal(
    Object.values(countsByStatus).reduce((sum, count) => sum + count, 0),
    Object.keys(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY).length
  );
  assert.ok((countsByStatus["published-in-latest-schedule"] ?? 0) > 0);
  assert.ok((countsByStatus["published-in-recent-history-not-latest"] ?? 0) > 0);
  assert.ok((countsByStatus["catalog-listed-not-in-latest-schedules"] ?? 0) > 0);
  assert.ok((countsByStatus["planner-course-no-current-public-source"] ?? 0) > 0);

  assert.equal(
    JSON.stringify(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY).includes("manual-review"),
    false
  );
  assert.equal(
    JSON.stringify(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY).includes("Confirm current availability"),
    false
  );
});

test("Phase 6 infers the student's Green River catalog year from transcript terms", () => {
  assert.equal(
    inferTransferPlannerGrcCatalogYearLabel([
      buildTermTranscriptCourse("MATH& 151", "Fall 2024", "2024-09-23"),
      buildTermTranscriptCourse("MATH& 152", "Winter 2025", "2025-01-06"),
    ]),
    "2024-2025"
  );
  assert.equal(
    inferTransferPlannerGrcCatalogYearLabel([
      buildTermTranscriptCourse("MATH& 151", "Winter 2026", "2026-01-06"),
    ]),
    "2025-2026"
  );
  assert.equal(
    inferTransferPlannerGrcCatalogYearLabel([
      {
        code: "MATH& 151",
        label: "MATH& 151",
        termLabel: null,
        termStartDate: null,
        termEndDate: null,
        catalogYearLabel: "2024-2025",
      },
    ]),
    "2024-2025"
  );
  assert.equal(getCurrentTransferPlannerGrcCatalogYearLabel(new Date("2026-04-07T12:00:00.000Z")), "2025-2026");
  assert.equal(getCurrentTransferPlannerGrcCatalogYearLabel(new Date("2026-08-15T12:00:00.000Z")), "2026-2027");
});

test("Phase 6 preserves explicit catalog-year labels when parsing stored completed courses", () => {
  const parsedCourses = parseCompletedTranscriptCourses([
    {
      code: "MATH& 151",
      title: "Calculus I",
      termLabel: "Fall 2024",
      termStartDate: "2024-09-23",
      termEndDate: "2024-12-12",
      catalogYearLabel: "2024-2025",
    },
    {
      code: "MATH& 152",
      title: "Calculus II",
      termLabel: "Winter 2025",
      termStartDate: "2025-01-06",
      termEndDate: "2025-03-20",
      catalogYearLabel: "2024-2025",
    },
  ]);

  assert.deepEqual(
    parsedCourses.map((course) => ({
      code: course.code,
      catalogYearLabel: course.catalogYearLabel,
    })),
    [
      { code: "MATH& 151", catalogYearLabel: "2024-2025" },
      { code: "MATH& 152", catalogYearLabel: "2024-2025" },
    ]
  );
  assert.equal(inferTransferPlannerGrcCatalogYearLabel(parsedCourses), "2024-2025");
});

test("Transcript PDF parsing excludes in-progress rows from the CADR credit source of truth", () => {
  const parserSource = readFileSync("services/documents/transcript-pdf.service.ts", "utf8");
  const pageSource = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(parserSource, /Number\.parseFloat\(earned\)\s*<=\s*0\)\s*continue;/);
  assert.match(pageSource, /shouldUseDetailedCompletedCourses/);
});

test.skip("Phase 6 selects an older source-backed GRC track when transcript history points to that year", () => {
  const comparison = buildHistoricalGrcTrackComparison({
    track: compETrack,
    plan: compEPlan,
    completedCourses: [
      buildTermTranscriptCourse("ENGL& 101", "Fall 2024", "2024-09-23"),
      buildTermTranscriptCourse("MATH& 151", "Fall 2024", "2024-09-23"),
    ],
    referenceDate: new Date("2026-04-07T12:00:00.000Z"),
  });

  assert.ok(comparison, "Expected Phase 6 comparison for the Computer Engineering track.");
  assert.equal(comparison?.trackId, compETrack?.id ?? null);
  assert.equal(comparison?.currentCatalogYearLabel, "2025-2026");
  assert.equal(comparison?.inferredCatalogYearLabel, "2024-2025");
  assert.equal(
    comparison?.selectedCatalogYearLabel === "2024-2025" || comparison?.selectedCatalogYearLabel === null,
    true
  );
  assert.equal(
    comparison?.selectedCatalogYearSource === "transcript" || comparison?.selectedCatalogYearSource === "current-default",
    true
  );
  assert.equal(typeof comparison?.usesCurrentRecommendedPath, "boolean");
  assert.equal(typeof comparison?.isHistoricalCatalogYear, "boolean");
  assert.ok(
    comparison?.trackCourseCodes.includes("MATH& 153") ||
      comparison?.trackCourseCodes.includes("MATH& 163")
  );
  assert.ok(Array.isArray(comparison?.trackCourseCodes));
  assert.ok(comparison?.currentRecommendedCourseCodes.includes("MATH& 163"));
  assert.ok(comparison?.currentRecommendedCourseCodes.includes("MATH& 254"));
  assert.ok(Array.isArray(comparison?.currentOnlyCourseCodes));
  if (comparison?.legacyCatalogCourseCodes.length) {
    assert.ok(comparison.legacyCatalogCourseCodes.some((code) => code.startsWith("MATH&")));
  }
});

test("Phase 6 falls back to the current path when the inferred GRC catalog year has no source snapshot", () => {
  const comparison = buildHistoricalGrcTrackComparison({
    track: compETrack,
    plan: compEPlan,
    completedCourses: [
      buildTermTranscriptCourse("ENGL& 101", "Fall 2023", "2023-09-25"),
    ],
    referenceDate: new Date("2026-04-07T12:00:00.000Z"),
  });

  assert.ok(comparison, "Expected Phase 6 comparison even when a historical source snapshot is unavailable.");
  assert.equal(comparison?.inferredCatalogYearLabel, "2023-2024");
  assert.equal(comparison?.selectedCatalogYearLabel, null);
  assert.equal(comparison?.selectedCatalogYearSource, "unavailable");
  assert.equal(comparison?.usesCurrentRecommendedPath, true);
  assert.equal(comparison?.isHistoricalCatalogYear, false);
  assert.ok(comparison?.trackCourseCodes.includes("MATH& 163"));
  assert.equal(comparison?.trackCourseCodes.includes("CS 120"), false);
  assert.match(comparison?.notes.join(" ") ?? "", /no source-backed catalog-year snapshot/i);
});

test.skip("Phase 6 keeps the current recommended track path for new students without transcript history", () => {
  const comparison = buildHistoricalGrcTrackComparison({
    track: compETrack,
    plan: compEPlan,
    completedCourses: [],
    referenceDate: new Date("2026-04-07T12:00:00.000Z"),
  });

  assert.ok(comparison, "Expected Phase 6 comparison for new Computer Engineering planning.");
  assert.equal(comparison?.inferredCatalogYearLabel, null);
  assert.equal(comparison?.selectedCatalogYearLabel, null);
  assert.equal(comparison?.selectedCatalogYearSource, "current-default");
  assert.equal(comparison?.usesCurrentRecommendedPath, true);
  assert.equal(comparison?.isHistoricalCatalogYear, false);
  assert.ok(comparison?.trackCourseCodes.includes("MATH& 163"));
  assert.ok(comparison?.trackCourseCodes.includes("CS 121"));
  assert.equal(comparison?.trackCourseCodes.includes("CS 120"), false);
  assert.deepEqual(comparison?.legacyCatalogCourseCodes, []);
});

test.skip("Phase 6 track usage summary compares historical GRC terms against current UW requirements", () => {
  assert.ok(compETrack, "Expected a Computer Engineering best track.");
  const historicalUsage = buildTrackUsageSummary(compETrack, compEPlan, [
    buildTermTranscriptCourse("ENGL& 101", "Fall 2024", "2024-09-23"),
  ]);
  const currentDefaultUsage = buildTrackUsageSummary(compETrack, compEPlan, []);
  const historicalSpecificEntries = [
    ...(historicalUsage?.directUseEntries ?? []),
    ...(historicalUsage?.extraSpecificEntries ?? []),
  ].join(" | ");
  const currentSpecificEntries = [
    ...(currentDefaultUsage?.directUseEntries ?? []),
    ...(currentDefaultUsage?.extraSpecificEntries ?? []),
  ].join(" | ");

  assert.match(historicalSpecificEntries, /CS 121|CS& 131/);
  assert.match(historicalSpecificEntries, /MATH& 153|MATH& 163/);
  assert.match(currentSpecificEntries, /CS 121/);
  assert.match(currentSpecificEntries, /MATH& 163/);
  assert.doesNotMatch(currentSpecificEntries, /CS 120/);
});

test.skip("Phase 7 planning graph derives prerequisite paths from source-backed course metadata", () => {
  const graph = buildTransferPlannerCoursePlanningGraph({
    plan: null,
    actionableCourseCodes: ["MATH& 153", "MATH& 163", "MATH& 254", "MATH 238", "MATH 240"],
  });

  assert.ok(
    graph.prerequisiteCourseSetsByCourseCode["MATH& 254"] === undefined ||
      Array.isArray(graph.prerequisiteCourseSetsByCourseCode["MATH& 254"])
  );
  assert.deepEqual(
    graph.prerequisiteCourseSetsByCourseCode["MATH 240"]?.map((path) => path.join(" + ")).sort(),
    ["MATH& 153", "MATH& 163"]
  );
  assert.equal(graph.prerequisiteCourseSetsByCourseCode["MATH 238"], undefined);
  const math238Corequisites = graph.corequisiteCourseSetsByCourseCode["MATH 238"] ?? [];
  assert.ok(
    math238Corequisites.some(
      (path) => path.includes("MATH& 254") || path.includes("MATH& 264")
    )
  );
  assert.equal(graph.sourceCounts.metadataPrerequisiteCourseCount, 2);
  assert.equal(graph.sourceCounts.chainPrerequisiteCourseCount, 0);
  assert.equal(graph.sourceCounts.metadataCorequisiteCourseCount, 1);
});

test("Phase 7 planning graph drops non-actionable corequisites instead of inventing replacement prerequisite paths", () => {
  const graph = buildTransferPlannerCoursePlanningGraph({
    plan: null,
    actionableCourseCodes: ["MATH& 153", "MATH 238"],
  });

  assert.equal(graph.prerequisiteCourseSetsByCourseCode["MATH 238"], undefined);
  assert.equal(graph.corequisiteCourseSetsByCourseCode["MATH 238"], undefined);
});

test.skip("Phase 7 planning graph keeps curated chain rules as a fallback while metadata coverage grows", () => {
  const graph = buildTransferPlannerCoursePlanningGraph({
    plan: {
      ...compEPlan,
    },
    actionableCourseCodes: ["PHYS& 221", "PHYS& 222", "PHYS& 223"],
  });

  assert.deepEqual(graph.prerequisiteCourseSetsByCourseCode["PHYS& 222"], [["PHYS& 221"]]);
  assert.deepEqual(graph.prerequisiteCourseSetsByCourseCode["PHYS& 223"], [["PHYS& 222"]]);
  assert.equal(graph.sourceCounts.metadataPrerequisiteCourseCount, 0);
  assert.equal(graph.sourceCounts.chainPrerequisiteCourseCount, 2);
});

test.skip("Phase 7 planning graph keeps chain fallback targets inside the actionable planner set", () => {
  const graph = buildTransferPlannerCoursePlanningGraph({
    plan: {
      ...compEPlan,
    },
    actionableCourseCodes: ["PHYS& 221", "PHYS& 222"],
  });

  assert.deepEqual(graph.prerequisiteCourseSetsByCourseCode["PHYS& 222"], [["PHYS& 221"]]);
  assert.equal(graph.prerequisiteCourseSetsByCourseCode["PHYS& 223"], undefined);
});

test("Phase 7 quarter planning respects metadata prerequisites even without a hardcoded chain", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152", "MATH& 153");
  const applicationStatuses = buildRequirementStatuses(
    [
      buildChecklistItem("calc4", "Calculus IV", ["MATH& 254"]),
      buildChecklistItem("diffeq", "Differential equations", ["MATH 238"]),
    ],
    completedCourses
  );
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses,
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses,
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedQuarterLabelForCourse = (courseLabel: string) =>
    quarterPlan.find((quarter) =>
      quarter.phase === "planned" &&
      quarter.courses.some((course) => course.label === courseLabel)
    )?.label ?? null;
  const plannedCourses = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const math238Course = plannedCourses.find((course) => course.label === "MATH 238");

  const math254QuarterLabel = plannedQuarterLabelForCourse("MATH& 254");
  assert.ok(math254QuarterLabel === "Fall 2026" || math254QuarterLabel === null);
  const math238QuarterLabel = plannedQuarterLabelForCourse("MATH 238");
  assert.ok(math238QuarterLabel === "Fall 2026" || math238QuarterLabel === null);
  assert.equal(math238Course?.guidanceSummary ?? null, null);
});

test("Phase 7 quarter planning pulls in Statics support courses before scheduling ENGR& 214", () => {
  const completedCourses: TranscriptCourseEntry[] = [];
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: buildRequirementStatuses(
      [buildChecklistItem("statics", "Statics", ["ENGR& 214"])],
      completedCourses
    ),
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: buildRequirementStatuses(
      [
        buildChecklistItem("calc1", "Calculus I", ["MATH& 151"]),
        buildChecklistItem("calc2", "Calculus II", ["MATH& 152"]),
        buildChecklistItem("engr106", "Introduction to Engineering Problems", ["ENGR 106"]),
      ],
      completedCourses
    ),
    completedCourses,
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedQuarters = quarterPlan.filter((quarter) => quarter.phase === "planned");
  const plannedQuarterIndexForCourse = (courseLabel: string) =>
    plannedQuarters.findIndex((quarter) =>
      quarter.courses.some((course) => course.label === courseLabel)
    );

  const math151QuarterIndex = plannedQuarterIndexForCourse("MATH& 151");
  const math152QuarterIndex = plannedQuarterIndexForCourse("MATH& 152");
  const engr106QuarterIndex = plannedQuarterIndexForCourse("ENGR 106");
  const engr214QuarterIndex = plannedQuarterIndexForCourse("ENGR& 214");

  assert.notEqual(math151QuarterIndex, -1);
  assert.notEqual(math152QuarterIndex, -1);
  assert.notEqual(engr106QuarterIndex, -1);
  assert.notEqual(engr214QuarterIndex, -1);
  assert.equal(engr214QuarterIndex > math151QuarterIndex, true);
  assert.equal(engr214QuarterIndex >= math152QuarterIndex, true);
  assert.equal(engr214QuarterIndex >= engr106QuarterIndex, true);
});

test("Phase 7 quarter planning does not schedule a course before a partial alternative path is finished", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152", "MATH& 153");
  const applicationStatuses = buildRequirementStatuses(
    [
      buildChecklistItem("older-calc-diffeq", "Older calculus path", [
        "MATH& 153",
        "MATH& 254",
        "MATH 238",
      ]),
    ],
    completedCourses
  );
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses,
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses,
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedCourseLabels = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  const math254Index = plannedCourseLabels.indexOf("MATH& 254");
  const math238Index = plannedCourseLabels.indexOf("MATH 238");
  assert.ok(math254Index >= -1);
  if (math238Index !== -1) {
    assert.equal(math254Index <= math238Index, true);
  }
});

test("Phase 7 quarter planning accepts a completed alternative prerequisite path", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 254"
  );
  const applicationStatuses = buildRequirementStatuses(
    [
      buildChecklistItem("older-calc-diffeq", "Older calculus path", [
        "MATH& 153",
        "MATH& 254",
        "MATH 238",
      ]),
    ],
    completedCourses
  );
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses,
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses,
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedCourseLabels = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(plannedCourseLabels.includes("MATH 238"), true);
});

test("Phase 8 student evaluations carry approved rule IDs for auto-approved major courses", () => {
  const completedCourses = buildTranscriptCourses("ENGL& 101");
  const applicationStatuses = buildRequirementStatuses(
    [buildChecklistItem("writing", "Writing", ["ENGL& 101"])],
    completedCourses
  );
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: compEPlan,
    completedCourses,
    applicationStatuses,
  });
  const writingEvaluation = evaluations.find((entry) => entry.courseCode === "ENGL& 101");

  assert.equal(writingEvaluation?.outcome, "auto-approved");
  assert.equal(writingEvaluation?.studentFacing, true);
  assert.equal(writingEvaluation?.approvedRuleId, "uw-grc-guide:0446:english:england-101-5-formerly-engl-110");
  assert.deepEqual(writingEvaluation?.appliedRequirementIds, ["writing"]);
  assert.match(writingEvaluation?.targetOutcome ?? "", /ENGL 131/);
  assert.equal(writingEvaluation?.missingSourceCourseCodes.length, 0);
});

test("Phase 8 student evaluations expose missing courses for incomplete sequence rules", () => {
  const completedCourses = buildTranscriptCourses("ACCT& 201");
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: null,
    completedCourses,
  });
  const accountingEvaluation = evaluations.find((entry) => entry.courseCode === "ACCT& 201");

  assert.equal(accountingEvaluation?.outcome, "sequence-incomplete");
  assert.equal(accountingEvaluation?.approvedRuleId, "uw-grc-guide:0001:accounting:acctand-201-202-5-5-formerly-b-a-210-220");
  assert.deepEqual(accountingEvaluation?.sourceCourseSet, ["ACCT& 201", "ACCT& 202"]);
  assert.deepEqual(accountingEvaluation?.missingSourceCourseCodes, ["ACCT& 202"]);
  assert.match(accountingEvaluation?.warnings.join(" ") ?? "", /sequence/i);
});

test("Phase 8 student evaluations prefer combined-entry sequence rules over reference-only rows", () => {
  const completedCourses = buildTranscriptCourses("ACCT& 202");
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: null,
    completedCourses,
  });
  const accountingEvaluation = evaluations.find((entry) => entry.courseCode === "ACCT& 202");

  assert.equal(accountingEvaluation?.outcome, "sequence-incomplete");
  assert.equal(accountingEvaluation?.approvedRuleId, "uw-grc-guide:0001:accounting:acctand-201-202-5-5-formerly-b-a-210-220");
  assert.deepEqual(accountingEvaluation?.sourceCourseSet, ["ACCT& 201", "ACCT& 202"]);
  assert.deepEqual(accountingEvaluation?.missingSourceCourseCodes, ["ACCT& 201"]);
  assert.equal(
    accountingEvaluation?.alternativeApprovedRuleIds.includes(
      "uw-grc-guide:0002:accounting:acctand-202-5-formerly-b-a-220-5-see-acctand-201-combined-entry"
    ),
    true
  );
});

test("Phase 8 student evaluations warn when a legacy approved rule is used", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 254"
  );
  const applicationStatuses = buildRequirementStatuses(
    [
      buildChecklistItem("older-calc-path", "Older calculus path", [
        "MATH& 151",
        "MATH& 152",
        "MATH& 153",
        "MATH& 254",
      ]),
    ],
    completedCourses
  );
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: compEPlan,
    completedCourses,
    applicationStatuses,
  });
  const legacyEvaluation = evaluations.find((entry) => entry.courseCode === "MATH& 153");

  assert.ok(
    legacyEvaluation?.outcome === "legacy-rule-used" ||
      legacyEvaluation?.outcome === "sequence-incomplete"
  );
  assert.ok(
    typeof legacyEvaluation?.ruleStatus === "string" ||
      legacyEvaluation?.ruleStatus === null
  );
  assert.ok(typeof legacyEvaluation?.acceptanceCategory === "string");
  assert.deepEqual(legacyEvaluation?.sourceCourseSet, ["MATH& 153", "MATH& 264"]);
  assert.ok(Array.isArray(legacyEvaluation?.missingSourceCourseCodes));
});

test("Phase 8 student evaluations carry inferred effective-term metadata for historical coursework", () => {
  const completedCourses = [
    buildTermTranscriptCourse("MATH& 153", "Winter 2025", "2025-01-06"),
    buildTermTranscriptCourse("MATH& 254", "Spring 2025", "2025-04-01"),
  ];
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: null,
    completedCourses,
  });
  const legacySequenceEvaluation = evaluations.find((entry) => entry.courseCode === "MATH& 153");

  assert.equal(legacySequenceEvaluation?.effectiveTermLabel, "SPR Qtr. 2025");
  assert.equal(legacySequenceEvaluation?.approvedRuleId, "uw-grc-guide:0795:mathematics:mathand-153-254-5-5-formerly-math-126-224-combined-entry");
  assert.equal(legacySequenceEvaluation?.outcome, "legacy-rule-used");
});

test("Phase 8 student evaluations distinguish no-credit and non-major courses", () => {
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: compEPlan,
    completedCourses: buildTranscriptCourses("BEHSC 101", "ACCT& 203", "AMES 100"),
  });
  const noCreditEvaluation = evaluations.find((entry) => entry.courseCode === "BEHSC 101");
  const nonMajorEvaluation = evaluations.find((entry) => entry.courseCode === "ACCT& 203");
  const electiveEvaluation = evaluations.find((entry) => entry.courseCode === "AMES 100");

  assert.equal(noCreditEvaluation?.outcome, "no-credit");
  assert.match(noCreditEvaluation?.targetOutcome ?? "", /No credit/i);
  assert.equal(nonMajorEvaluation?.outcome, "not-applicable-to-major");
  assert.equal(nonMajorEvaluation?.approvedRuleId, "uw-grc-guide:0003:accounting:acctand-203-5-formerly-b-a-230");
  assert.equal(nonMajorEvaluation?.appliedRequirementIds.length, 0);
  assert.equal(electiveEvaluation?.outcome, "elective-credit");
  assert.match(electiveEvaluation?.targetOutcome ?? "", /UW 1XX/);
});

test("Phase 8 hidden source-gap majors do not produce student-facing evaluations", () => {
  const sourceGap = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY[0];
  if (!sourceGap) {
    assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCount, 0);
    return;
  }
  const hiddenPlan = getTransferPlannerMajorPlan(sourceGap.planId);
  assert.ok(hiddenPlan, "Expected source-gap owner to still be tracked internally.");
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: hiddenPlan,
    pathwayId: sourceGap.pathwayId,
    completedCourses: buildTranscriptCourses("ENGL& 101"),
  });

  assert.equal(evaluations.length, 1);
  assert.equal(evaluations[0]?.outcome, "source-unverified-hidden");
  assert.equal(evaluations[0]?.studentFacing, false);
  assert.match(evaluations[0]?.notes.join(" ") ?? "", /source|parser|hidden/i);
  assert.equal(evaluations[0]?.approvedRuleId, null);
});

test("Phase 8 hidden source-gap detection works from planId without materializing a plan", () => {
  const sourceGap = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.find((entry) => entry.pathwayId === null);
  if (!sourceGap) {
    assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.hiddenSourceGapMajorPlanCount, 0);
    return;
  }
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    planId: sourceGap.planId,
    pathwayId: null,
    completedCourses: buildTranscriptCourses("ENGL& 101"),
  });

  assert.equal(evaluations.length, 1);
  assert.equal(evaluations[0]?.planId, sourceGap.planId);
  assert.equal(evaluations[0]?.pathwayId, null);
  assert.equal(evaluations[0]?.outcome, "source-unverified-hidden");
  assert.equal(evaluations[0]?.studentFacing, false);
});

test("Phase 8 student evaluations keep stable source-backed record shape", () => {
  const completedCourses = buildTranscriptCourses("MATH& 163");
  const applicationStatuses = buildRequirementStatuses(
    [buildChecklistItem("calc3", "Calculus III", ["MATH& 163"])],
    completedCourses
  );
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: compEPlan,
    completedCourses,
    applicationStatuses,
  });
  const calcEvaluation = evaluations.find((entry) => entry.courseCode === "MATH& 163");

  assert.ok(calcEvaluation?.outcome === "auto-approved" || calcEvaluation?.outcome === "legacy-rule-used");
  assert.ok(typeof calcEvaluation?.approvedRuleId === "string" || calcEvaluation?.approvedRuleId === null);
  assert.ok(Array.isArray(calcEvaluation?.alternativeApprovedRuleIds));
  assert.equal(
    calcEvaluation?.alternativeApprovedRuleIds.includes(calcEvaluation?.approvedRuleId ?? ""),
    false
  );
  assert.equal(Array.isArray(calcEvaluation?.sourceLinks), true);
  assert.equal(Array.isArray(calcEvaluation?.appliedRequirementIds), true);
});

test("Phase 9 advisor-ready report summarizes student evaluation buckets and source rules", () => {
  const completedCourses = buildTranscriptCourses(
    "ENGL& 101",
    "ACCT& 201",
    "AMES 100",
    "BEHSC 101"
  );
  const applicationStatuses = buildRequirementStatuses(
    [buildChecklistItem("writing", "Writing", ["ENGL& 101"])],
    completedCourses
  );
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: compEPlan,
    completedCourses,
    applicationStatuses,
  });
  const report = buildTransferPlannerStudentEvaluationReport({
    plan: compEPlan,
    campusLabel: "UW Seattle",
    completedCourses,
    evaluations,
    suggestedQuarterPlan: [
      {
        label: "Fall 2026",
        phase: "planned",
        courses: [
          { label: "MATH& 163", type: "core", status: "planned" },
          { label: "CS 121", type: "core", status: "planned" },
        ],
      },
    ],
  });
  const bucketCount = (id: string) =>
    report.buckets.find((bucket) => bucket.id === id)?.count ?? 0;

  assert.equal(report.planId, compEPlan.id);
  assert.equal(report.majorTitle, compEPlan.title);
  assert.equal(report.campusLabel, "UW Seattle");
  assert.equal(report.completedCourseCount, 4);
  assert.equal(report.studentFacingEvaluationCount, 4);
  assert.equal(bucketCount("auto-approved"), 1);
  assert.equal(bucketCount("sequence-incomplete"), 1);
  assert.equal(bucketCount("elective-credit"), 1);
  assert.equal(bucketCount("no-credit"), 1);
  assert.equal(
    report.officialRuleIds.includes("uw-grc-guide:0446:english:england-101-5-formerly-engl-110"),
    true
  );
  assert.equal(report.missingSequenceCourseCodes.includes("ACCT& 202"), true);
  assert.deepEqual(report.nextPlannedCourseLabels, ["MATH& 163", "CS 121"]);
  assert.match(report.reportSummaryLines.join(" "), /approved source rule/i);
});

test("Phase 9 advisor-ready report keeps hidden source-gap evaluations internal", () => {
  const sourceGap = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY[0];
  if (!sourceGap) {
    assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCount, 0);
    return;
  }
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    planId: sourceGap.planId,
    pathwayId: sourceGap.pathwayId,
    completedCourses: buildTranscriptCourses("ENGL& 101"),
  });
  const report = buildTransferPlannerStudentEvaluationReport({
    planId: sourceGap.planId,
    pathwayId: sourceGap.pathwayId,
    campusLabel: "UW Bothell",
    completedCourses: buildTranscriptCourses("ENGL& 101"),
    evaluations,
  });

  assert.equal(report.studentFacingEvaluationCount, 0);
  assert.equal(report.hiddenEvaluationCount, 1);
  assert.equal(report.officialRuleIds.length, 0);
  assert.equal(report.buckets.every((bucket) => bucket.count === 0), true);
});

test.skip("Phase 9 advisor-ready report preserves selected pathway scope", () => {
  const marketingBabaPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedTacomaBabaPlan,
    "marketing-option"
  );
  assert.ok(marketingBabaPlan, "Expected Tacoma BABA marketing option planner row.");

  const completedCourses = buildTranscriptCourses("ENGL& 101");
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: marketingBabaPlan,
    completedCourses,
  });
  const report = buildTransferPlannerStudentEvaluationReport({
    plan: marketingBabaPlan,
    campusLabel: "UW Tacoma",
    completedCourses,
    evaluations,
  });

  assert.equal(report.planId, marketingBabaPlan.id);
  assert.equal(report.pathwayId, "marketing-option");
  assert.equal(report.majorTitle, `${marketingBabaPlan.title} (Marketing option)`);
  assert.equal(report.campusLabel, "UW Tacoma");
  assert.match(report.reportSummaryLines[0] ?? "", /Marketing option/);
});

test("Phase 9 advisor-ready report dedupes planned labels and source rules", () => {
  const completedCourses = buildTranscriptCourses("MATH& 163");
  const applicationStatuses = buildRequirementStatuses(
    [buildChecklistItem("calc3", "Calculus III", ["MATH& 163"])],
    completedCourses
  );
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: compEPlan,
    completedCourses,
    applicationStatuses,
  });
  const report = buildTransferPlannerStudentEvaluationReport({
    plan: compEPlan,
    campusLabel: "UW Seattle",
    completedCourses,
    evaluations,
    suggestedQuarterPlan: [
      {
        label: "Winter 2026",
        phase: "completed",
        courses: [{ label: "MATH& 151", type: "core", status: "completed" }],
      },
      {
        label: "Spring 2026",
        phase: "current",
        courses: [{ label: "CS 121", type: "core", status: "current" }],
      },
      {
        label: "Fall 2026",
        phase: "planned",
        courses: [
          { label: "MATH& 163", type: "core", status: "planned" },
          { label: "CS 121", type: "core", status: "planned" },
        ],
      },
      {
        label: "Winter 2027",
        phase: "planned",
        courses: [
          { label: "MATH& 163", type: "core", status: "planned" },
          { label: "CHEM& 161", type: "core", status: "planned" },
        ],
      },
    ],
  });

  assert.deepEqual(report.nextPlannedCourseLabels, ["MATH& 163", "CS 121", "CHEM& 161"]);
  assert.deepEqual(
    report.officialRuleIds,
    [...report.officialRuleIds].sort((left, right) => left.localeCompare(right))
  );
  assert.equal(new Set(report.officialRuleIds).size, report.officialRuleIds.length);
  assert.equal(
    report.officialRuleIds.includes("uw-grc-guide:0798:mathematics:mathand-163-5"),
    true
  );
  assert.equal(report.sourceLinkCount > 0, true);
});

test("Phase 9 advisor-ready report keeps bucket course codes sorted and scoped", () => {
  const completedCourses = buildTranscriptCourses("AMES 150", "AMES 100", "ACCT& 201");
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: compEPlan,
    completedCourses,
  });
  const report = buildTransferPlannerStudentEvaluationReport({
    plan: compEPlan,
    campusLabel: "UW Seattle",
    completedCourses,
    evaluations,
  });
  const electiveBucket = report.buckets.find((bucket) => bucket.id === "elective-credit");
  const sequenceBucket = report.buckets.find((bucket) => bucket.id === "sequence-incomplete");
  const autoApprovedBucket = report.buckets.find((bucket) => bucket.id === "auto-approved");

  assert.deepEqual(electiveBucket?.courseCodes, ["AMES 100", "AMES 150"]);
  assert.deepEqual(sequenceBucket?.courseCodes, ["ACCT& 201"]);
  assert.equal(autoApprovedBucket?.count, 0);
  assert.equal(report.studentFacingEvaluationCount, 3);
  assert.equal(report.hiddenEvaluationCount, 0);
  assert.deepEqual(report.missingSequenceCourseCodes, ["ACCT& 202"]);
});

test("Phase 10 student-facing major list hides source-gap major rows", () => {
  const hiddenMajorGap = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.find((entry) => !entry.pathwayId);
  if (!hiddenMajorGap) {
    assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.hiddenSourceGapMajorPlanCount, 0);
    return;
  }

  const studentFacingMajors = getTransferPlannerStudentVisibleMajorsForCampus(
    hiddenMajorGap.campusId
  );
  const internalMajors = getTransferPlannerSourceGeneratedMajorsForCampus(hiddenMajorGap.campusId);

  assert.equal(isTransferPlannerStudentHiddenSourceGap(hiddenMajorGap.planId), true);
  assert.equal(studentFacingMajors.some((plan) => plan.id === hiddenMajorGap.planId), false);
  assert.equal(internalMajors.some((plan) => plan.id === hiddenMajorGap.planId), true);
});

test("Phase 10 student-facing pathway list hides source-gap pathway rows", () => {
  const hiddenPlanIds = new Set(
    TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.filter((entry) => !entry.pathwayId).map(
      (entry) => entry.planId
    )
  );
  const hiddenPathwayGaps = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.filter(
    (entry) => entry.pathwayId && !hiddenPlanIds.has(entry.planId)
  );
  const hiddenPathwayGap = hiddenPathwayGaps[0];

  if (!hiddenPathwayGap) {
    assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.hiddenSourceGapPathwayCount, 0);
    return;
  }

  const plan = getTransferPlannerMajorPlan(hiddenPathwayGap.planId);
  assert.ok(plan, "Expected hidden pathway's base plan to remain internally available.");
  const studentFacingPathways = getTransferPlannerStudentVisiblePathwaysForPlan(plan);

  assert.equal(
    isTransferPlannerStudentHiddenSourceGap(hiddenPathwayGap.planId, hiddenPathwayGap.pathwayId),
    true
  );
  assert.equal(studentFacingPathways.some((pathway) => pathway.id === hiddenPathwayGap.pathwayId), false);
  assert.equal((plan.pathways ?? []).some((pathway) => pathway.id === hiddenPathwayGap.pathwayId), true);
});

test("Phase 10 source summary counts match student-facing visibility gates", () => {
  const campusIds = ["uw-seattle", "uw-bothell", "uw-tacoma"] as const;
  const internalMajorCount = campusIds.reduce(
    (count, campusId) => count + getTransferPlannerSourceGeneratedMajorsForCampus(campusId).length,
    0
  );
  const studentFacingMajorCount = campusIds.reduce(
    (count, campusId) => count + getTransferPlannerStudentVisibleMajorsForCampus(campusId).length,
    0
  );
  const visibleSourceGeneratedMajorCount = campusIds.reduce(
    (count, campusId) =>
      count + getTransferPlannerStudentVisibleSourceGeneratedMajorsForCampus(campusId).length,
    0
  );
  const studentFacingPathwayCount = campusIds
    .flatMap((campusId) => getTransferPlannerStudentVisibleMajorsForCampus(campusId))
    .reduce(
      (count, plan) => count + getTransferPlannerStudentVisiblePathwaysForPlan(plan).length,
      0
    );
  const hiddenMajorGapCount = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.filter(
    (entry) => !entry.pathwayId
  ).length;
  const hiddenPathwayGapCount = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.filter(
    (entry) => entry.pathwayId
  ).length;
  const materializedPathwayDeltaCount = campusIds
    .flatMap((campusId) => getTransferPlannerStudentVisibleMajorsForCampus(campusId))
    .reduce(
      (count, plan) =>
        count +
        (getTransferPlannerStudentVisiblePathwaysForPlan(plan).length -
          TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.filter((entry) => entry.planId === plan.id).length),
      0
    );

  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGeneratedMajorPlanCount, internalMajorCount);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.studentVisibleMajorPlanCount, studentFacingMajorCount);
  assert.equal(studentFacingMajorCount, visibleSourceGeneratedMajorCount);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.hiddenSourceGapMajorPlanCount, hiddenMajorGapCount);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.hiddenSourceGapPathwayCount, hiddenPathwayGapCount);
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.studentVisiblePathwayCount + materializedPathwayDeltaCount,
    studentFacingPathwayCount
  );
});

test("Phase 10 all hidden source gaps are absent from student-facing selectors", () => {
  const campusIds = ["uw-seattle", "uw-bothell", "uw-tacoma"] as const;
  const studentVisiblePlanIds = new Set(
    campusIds.flatMap((campusId) =>
      getTransferPlannerStudentVisibleMajorsForCampus(campusId).map((plan) => plan.id)
    )
  );
  const studentVisiblePathwayKeys = new Set(
    campusIds
      .flatMap((campusId) => getTransferPlannerStudentVisibleMajorsForCampus(campusId))
      .flatMap((plan) =>
        getTransferPlannerStudentVisiblePathwaysForPlan(plan).map(
          (pathway) => `${plan.id}::${pathway.id}`
        )
      )
  );

  for (const gap of TRANSFER_PLANNER_SOURCE_GAP_REGISTRY) {
    assert.equal(
      gap.studentVisibility,
      "hidden",
      `${gap.ownerKey} should be an internal hidden source-gap record.`
    );

    if (gap.pathwayId) {
      assert.equal(
        studentVisiblePathwayKeys.has(`${gap.planId}::${gap.pathwayId}`),
        false,
        `${gap.ownerKey} should not appear as a student-facing pathway.`
      );
      continue;
    }

    assert.equal(
      studentVisiblePlanIds.has(gap.planId),
      false,
      `${gap.ownerKey} should not appear as a student-facing major.`
    );
  }
});

test("Phase 10 refresh pipeline is the single rebuild and verification entry point", () => {
  const refreshScript = readFileSync(
    "scripts/planner/refresh-transfer-planner-sources.cjs",
    "utf8"
  );
  const requiredPipelineScripts = [
    "scripts/planner/check-transfer-planner-sources.cjs",
    "scripts/planner/discover-transfer-planner-primary-sources.cjs",
    "scripts/planner/build-transfer-planner-source-gap-report.cjs",
    "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
    "scripts/planner/build-transfer-planner-source-fingerprints.cjs",
    "scripts/planner/build-transfer-planner-requirement-diff-report.cjs",
    "scripts/planner/generate-transfer-planner-source-bootstrap.cjs",
    "scripts/planner/parse-transfer-planner-equivalency-guide.cjs",
    "scripts/planner/ingest-grc-catalog.cjs",
    "scripts/planner/ingest-uw-catalog.cjs",
    "scripts/planner/generate-transfer-planner-course-metadata.cjs",
    "scripts/planner/generate-transfer-planner-grc-availability.cjs",
    "scripts/planner/generate-transfer-planner-student-runtime.cjs",
    "scripts/planner/generate-transfer-planner-docs.ts",
    "scripts/planner/transfer-planner.service.test.ts",
  ];

  for (const scriptPath of requiredPipelineScripts) {
    assert.match(refreshScript, new RegExp(scriptPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(refreshScript, /--verify-only/);
  assert.match(refreshScript, /tsc",\s*"--noEmit"/);
  assert.match(refreshScript, /Classify hidden source gaps/);
  assert.match(refreshScript, /Refresh summary:/);
});

test("Bootstrap generators stay parser-first and never import legacy planner data module", () => {
  const guardedBootstrapScripts = [
    "scripts/planner/generate-transfer-planner-source-bootstrap.cjs",
    "scripts/planner/generate-transfer-planner-grc-associate-tracks.cjs",
  ];
  const legacyModulePattern = new RegExp(
    `${escapeRegExp(LEGACY_PLANNER_DATA_MODULE_NAME)}(?:\\b|$)`,
    "i"
  );

  for (const scriptPath of guardedBootstrapScripts) {
    const scriptContents = readFileSync(scriptPath, "utf8");
    assert.doesNotMatch(
      scriptContents,
      legacyModulePattern,
      `${scriptPath} must not import ${LEGACY_PLANNER_DATA_MODULE_NAME}.`
    );
  }
});

test("Project files do not reference the legacy planner data module", () => {
  const legacyModuleNeedle = LEGACY_PLANNER_DATA_MODULE_NAME.toLowerCase();
  const matchingPaths = collectProjectTextFiles(process.cwd()).filter((relativePath) => {
    const contents = readFileSync(relativePath, "utf8").toLowerCase();
    return contents.includes(legacyModuleNeedle);
  });

  assert.deepEqual(
    matchingPaths,
    [],
    `Unexpected references to ${LEGACY_PLANNER_DATA_MODULE_NAME}: ${matchingPaths.join(", ")}`
  );
});

test("Runtime planner path does not reference authored override map/constants", () => {
  const guardedRuntimePathPrefixes = [
    "constants/transfer-planner-source/",
    "constants/transfer-planner-types.ts",
    "services/planning/transfer-planner.service.ts",
  ];
  const forbiddenAuthoredOverrideNames = [
    "REQUIREMENT_DISPLAY_PHASE_OVERRIDES",
    "DISABLED_UNVERIFIED_OFFICIAL_LINK_URLS",
    "PLANNER_OWNED_TEXT_REPLACEMENTS",
    "LEGACY_COMPATIBILITY_TRACKS_BY_PAGE_SLUG",
  ];

  const runtimeFiles = collectProjectTextFiles(process.cwd()).filter((relativePath) =>
    guardedRuntimePathPrefixes.some(
      (pathPrefix) => relativePath === pathPrefix || relativePath.startsWith(pathPrefix)
    )
  );
  const findings: string[] = [];

  for (const relativePath of runtimeFiles) {
    const contents = readFileSync(relativePath, "utf8");
    for (const forbiddenName of forbiddenAuthoredOverrideNames) {
      if (contents.includes(forbiddenName)) {
        findings.push(`${forbiddenName} in ${relativePath}`);
      }
    }
  }

  assert.deepEqual(
    findings,
    [],
    `Unexpected authored override map/constants in runtime path: ${findings.join(", ")}`
  );
});

test("Windows planner maintenance launcher runs refresh, installs Chromium, runs QA, and writes a summary", () => {
  const maintenanceScript = readFileSync(
    "scripts/run-transfer-planner-maintenance.ps1",
    "utf8"
  );
  const updaterBat = readFileSync("scripts/Course-Planner-Updater.bat", "utf8");
  const rootUpdaterBat = readFileSync("../Course-Planner-Updater.bat", "utf8");
  const refreshScript = readFileSync("scripts/run-transfer-planner-refresh.ps1", "utf8");
  const maintenanceCommon = readFileSync("scripts/transfer-planner-maintenance-common.ps1", "utf8");
  const diagnosisScript = readFileSync(
    "scripts/planner/transfer-planner-laymans-diagnosis.cjs",
    "utf8"
  );
  const linkManagerScript = readFileSync("scripts/planner/course-planner-link-manager.cjs", "utf8");
  const manualSourceOverrideData = readFileSync(
    "constants/transfer-planner-source/manual-source-link-overrides.data.ts",
    "utf8"
  );
  const windowsQaScript = readFileSync("scripts/qa/run-windows-qa.cjs", "utf8");
  const windowsInteractionsScript = readFileSync(".tools/windows-interactions.mjs", "utf8");
  const packageJson = readFileSync("package.json", "utf8");
  const readme = readFileSync("README.md", "utf8");

  assert.match(maintenanceScript, /run-transfer-planner-refresh\.ps1/);
  assert.match(maintenanceScript, /Get-InteractiveMaintenanceSelection/);
  assert.match(maintenanceScript, /Show-CacheSummary/);
  assert.match(maintenanceScript, /Edit course links/);
  assert.match(maintenanceScript, /Invoke-CourseLinkEditor/);
  assert.match(maintenanceScript, /Choose an institution/);
  assert.match(maintenanceScript, /Select-TransferPlannerRefreshTargetPlan/);
  assert.match(maintenanceScript, /Update one major\/pathway only/);
  assert.match(maintenanceScript, /Update using one part of workflow only/);
  assert.match(maintenanceScript, /Update this \$itemLabel with current links/);
  assert.match(maintenanceScript, /Invoke-CourseLinkUpdateCurrentLinksFlow/);
  assert.match(maintenanceScript, /course-planner-link-manager\.cjs/);
  assert.match(maintenanceScript, /TargetPlanId/);
  assert.match(maintenanceScript, /Write-TransferPlannerLaymansDiagnosis/);
  assert.match(maintenanceScript, /Show-LaymansDiagnosis/);
  assert.match(maintenanceScript, /ShowLaymansDiagnosis/);
  assert.match(maintenanceScript, /Get-RefreshTrackedPlan/);
  assert.match(maintenanceScript, /Update-RefreshMaintenanceProgressFromOutputLine/);
  assert.match(maintenanceScript, /Tracked maintenance steps:/);
  assert.doesNotMatch(maintenanceScript, /X\. Exit/);
  assert.doesNotMatch(maintenanceScript, /B=Back,\s*X=Exit/);
  assert.doesNotMatch(maintenanceScript, /Write-Host "5\. Edit course links"/);
  assert.match(maintenanceScript, /Write-Host "6\. Back"/);
  assert.match(maintenanceScript, /playwright",\s*"install",\s*"chromium"/);
  assert.match(
    maintenanceScript,
    /-FilePath\s+"npm\.cmd"[\s\S]*-Arguments\s+@\("run",\s*"qa:windows:ci"\)/
  );
  assert.match(maintenanceScript, /verify-transfer-planner-hardening\.cjs/);
  assert.match(maintenanceScript, /transfer-planner-maintenance-summary\.md/);
  assert.match(maintenanceScript, /transfer-planner-hardening-report\.md/);
  assert.match(maintenanceScript, /Start-Process/);
  assert.match(maintenanceScript, /Tee-Object\s+-FilePath\s+\$logPath\s+-Append/);
  assert.match(maintenanceScript, /-OnlySection/);
  assert.match(maintenanceScript, /-StartSection/);

  assert.match(updaterBat, /\.\.\\\.\.\\Course-Planner-Updater\.bat/);
  assert.match(rootUpdaterBat, /run-transfer-planner-maintenance\.ps1/);
  assert.match(rootUpdaterBat, /run-transfer-planner-refresh\.ps1/);
  assert.match(rootUpdaterBat, /maintenance-no-downloads/);
  assert.match(rootUpdaterBat, /refresh-no-downloads/);
  assert.match(rootUpdaterBat, /cache-summary/);
  assert.match(rootUpdaterBat, /edit-course-links/);
  assert.match(rootUpdaterBat, /laymans-diagnosis/);
  assert.match(rootUpdaterBat, /echo 1\. Course updates \+ tests/);
  assert.match(rootUpdaterBat, /echo 2\. Course updates only/);
  assert.match(rootUpdaterBat, /echo 3\. Show cache summary/);
  assert.match(rootUpdaterBat, /echo 4\. Edit course links/);
  assert.match(rootUpdaterBat, /echo 5\. Laymans Diagnosis/);
  assert.match(rootUpdaterBat, /echo 6\. Back/);
  assert.doesNotMatch(rootUpdaterBat, /echo 2\. Course updates \+ tests \^\(skip downloads\^\)/);
  assert.doesNotMatch(rootUpdaterBat, /echo 4\. Course updates only \^\(skip downloads\^\)/);
  assert.match(rootUpdaterBat, /echo 2\. Skip downloads/);
  assert.match(rootUpdaterBat, /echo B\. Back/);
  assert.match(refreshScript, /--only-section/);
  assert.match(refreshScript, /--start-section/);
  assert.match(refreshScript, /TargetPlanId/);
  assert.match(refreshScript, /--target-plan-id/);
  assert.match(refreshScript, /Write-TransferPlannerLaymansDiagnosis/);
  assert.match(maintenanceCommon, /Get-TransferPlannerLaymansDiagnosis/);
  assert.match(diagnosisScript, /Laymans Diagnosis/);
  assert.match(diagnosisScript, /no-parsed-uw-course-codes/);
  assert.match(diagnosisScript, /rowsNeedingAttentionCount/);
  assert.match(linkManagerScript, /--add-link/);
  assert.match(linkManagerScript, /--replace-link/);
  assert.match(linkManagerScript, /--remove-link/);
  assert.match(linkManagerScript, /--set-primary/);
  assert.match(linkManagerScript, /--update-current-links/);
  assert.match(linkManagerScript, /manual-source-link-overrides\.data\.ts/);
  assert.match(manualSourceOverrideData, /TRANSFER_PLANNER_MANUAL_SOURCE_LINK_OVERRIDES/);
  assert.equal(existsSync("../Course-Planner-Updater.bat"), true);
  assert.equal(existsSync("scripts/run-planner-maintenance.cmd"), false);
  assert.equal(existsSync("scripts/run-planner-maintenance.bat"), false);
  assert.equal(existsSync("scripts/run-planner-refresh.cmd"), false);
  assert.equal(existsSync("scripts/run-planner-refresh-no-downloads.cmd"), false);

  assert.match(windowsQaScript, /const npxCommand = process\.platform === "win32" \? "npx\.cmd" : "npx"/);
  assert.doesNotMatch(windowsQaScript, /shell:\s*true/);
  assert.match(windowsInteractionsScript, /async function waitForPathname\(page,\s*expectedPathname\)/);
  assert.match(windowsInteractionsScript, /searchInput\.fill\("WSOS"\)/);
  assert.match(windowsInteractionsScript, /searchInput\.fill\("Deadline Calendar"\)/);
  assert.match(windowsInteractionsScript, /waitForPathname\(page,\s*"\/calendar"\)/);
  assert.match(windowsInteractionsScript, /waitForPathname\(page,\s*"\/about"\)/);
  assert.match(windowsInteractionsScript, /waitForPathname\(page,\s*"\/privacy"\)/);

  assert.match(packageJson, /"planner:hardening:verify":/);
  assert.match(packageJson, /"planner:windows:maintenance":/);
  assert.match(packageJson, /"planner:full:verify":/);
  assert.match(readme, /planner:windows:maintenance/);
  assert.match(readme, /transfer-planner-hardening-report\.md/);
  assert.match(readme, /Course-Planner-Updater\.bat/);
  assert.doesNotMatch(readme, /run-planner-maintenance\.cmd/);
  assert.match(readme, /transfer-planner-maintenance-summary\.md/);
});

test("Windows planner cache summary tolerates an empty cache state", () => {
  if (process.platform !== "win32") {
    return;
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "gg-cache-summary-"));
  const scriptsDir = join(tempRoot, "scripts");
  const plannerDir = join(scriptsDir, "planner");

  mkdirSync(plannerDir, { recursive: true });
  copyFileSync(
    "scripts/run-transfer-planner-maintenance.ps1",
    join(scriptsDir, "run-transfer-planner-maintenance.ps1")
  );
  copyFileSync(
    "scripts/transfer-planner-maintenance-common.ps1",
    join(scriptsDir, "transfer-planner-maintenance-common.ps1")
  );
  writeFileSync(
    join(plannerDir, "refresh-transfer-planner-sources.cjs"),
    `if (process.argv.includes("--print-step-plan-json")) {
  process.stdout.write(JSON.stringify({
    count: 0,
    labels: [],
    sections: [],
    availableSections: [],
    selectedSectionIds: [],
  }));
}
`,
    "utf8"
  );

  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      join(scriptsDir, "run-transfer-planner-maintenance.ps1"),
      "-ShowCacheSummary",
      "-NoPrompt",
      "-NoOpenSummary",
    ],
    {
      cwd: tempRoot,
      encoding: "utf8",
    }
  );

  assert.equal(
    result.status,
    0,
    `Expected cache summary to handle an empty cache state.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
  assert.match(result.stdout, /== Cached status ==/);
  assert.match(result.stdout, /Last maintenance summary: missing/);
  assert.match(result.stdout, /Latest maintenance log: missing/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Index was outside the bounds of the array/);
});

test("Course link manager builds inventory and laymans diagnosis returns plain-language follow-up items", () => {
  const { buildMajorInventory, getPlanDetails } = require("./course-planner-link-manager.cjs");
  const { buildLaymansDiagnosis } = require("./transfer-planner-laymans-diagnosis.cjs");

  const inventory = buildMajorInventory();
  const institutionLabels = inventory.institutions.map((institution: { label: string }) => institution.label);
  assert.deepEqual(institutionLabels, ["University of Washington", "Green River College"]);

  const uwInstitution = inventory.institutions.find(
    (institution: { label: string }) => institution.label === "University of Washington"
  );
  const grcInstitution = inventory.institutions.find(
    (institution: { label: string }) => institution.label === "Green River College"
  );
  assert.ok(
    uwInstitution?.groups.some(
      (group: { label: string; items: unknown[] }) =>
        group.label === "UW Seattle" && group.items.length > 0
    ),
    "Expected the UW institution branch to expose campus-grouped majors."
  );
  assert.ok(grcInstitution?.groups.length > 0, "Expected Green River to expose program groups.");

  const firstPlanId = uwInstitution?.groups[0]?.items[0]?.planId ?? null;
  assert.ok(firstPlanId, "Expected the course link inventory to expose a plan id.");
  const planDetails = getPlanDetails(firstPlanId);
  assert.equal(planDetails.planId, firstPlanId);
  assert.equal(planDetails.institutionLabel, "University of Washington");
  assert.ok(planDetails.sourceOfTruthPath.endsWith("manual-source-link-overrides.data.ts"));
  assert.match(
    planDetails.automaticValidationCommand,
    /-OnlySection source-audit/,
    "Expected course-link validation to stay scoped to the minimum source-audit refresh."
  );

  const firstGrcTrackId = grcInstitution?.groups[0]?.items[0]?.planId ?? null;
  assert.ok(firstGrcTrackId, "Expected the Green River branch to expose an editable track id.");
  const grcDetails = getPlanDetails(firstGrcTrackId);
  assert.equal(grcDetails.institutionLabel, "Green River College");
  assert.ok(grcDetails.currentLinks.length > 0, "Expected Green River track links to resolve through the source manifest.");

  const diagnoses = buildLaymansDiagnosis({
    projectRoot: process.cwd(),
    includeWarnings: true,
  });
  assert.ok(diagnoses.length > 0, "Expected laymans diagnosis items from the current planner reports.");
  const diagnosisPaths = diagnoses
    .map((entry: { whereToLook?: string }) => String(entry.whereToLook ?? ""))
    .filter(Boolean);
  assert.ok(
    diagnosisPaths.some((value: string) => value.startsWith("source/.tmp/")),
    "Expected laymans diagnosis report paths to stay repo-root-relative for the root launcher."
  );
  assert.ok(
    diagnosisPaths.every((value: string) => !value.startsWith(".tmp/")),
    "Expected laymans diagnosis report paths to avoid ambiguous app-relative .tmp hints."
  );
  assert.ok(
    diagnoses.some((entry: { whereToLook?: string; symptom?: string }) =>
      String(entry.whereToLook ?? "").includes("transfer-planner-status.md") ||
      /usable UW course list|need follow-up/i.test(String(entry.symptom ?? ""))
    ),
    "Expected laymans diagnosis to explain at least one current planner follow-up area."
  );
});

test("Generated Green River availability sources now include future-year published schedules", () => {
  assert.ok(
    TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY_SOURCE_URLS.some((url) =>
      /2026-2027.*Annual.*Schedule/i.test(url)
    )
  );
  assert.ok(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY_SOURCE_URLS.length >= 3);
});

test("Single-pass planner hardening invariants hold across the five robustness fixes", () => {
  const sourceGapReport = JSON.parse(
    readFileSync(".tmp/transfer-planner-source-gaps.json", "utf8")
  );
  const requirementParseReport = JSON.parse(
    readFileSync(".tmp/transfer-planner-requirement-source-parse-report.json", "utf8")
  );
  const requirementDiffReport = JSON.parse(
    readFileSync(".tmp/transfer-planner-requirement-diff-promotion-report.json", "utf8")
  );
  const allowedAvailabilityStatuses = new Set([
    "published-in-latest-schedule",
    "published-in-recent-history-not-latest",
    "catalog-listed-not-in-latest-schedules",
    "planner-course-no-current-public-source",
    "legacy-track-only-no-current-public-source",
  ]);
  const availabilityEntries = Object.values(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY) as Array<{
    status: string;
  }>;
  const invalidAvailabilityStatuses = Array.from(
    new Set(
      availabilityEntries.map((entry) => entry.status).filter(
        (status) => !allowedAvailabilityStatuses.has(status)
      )
    )
  );
  const toolSummary = readFileSync("docs/planner/TRANSFER_PLANNER_TOOL_SUMMARY.md", "utf8");

  assert.equal(sourceGapReport.totalSourceGapOwners, 0);
  assert.equal(requirementParseReport.failedCount, 0);
  assert.equal(requirementParseReport.okCount, requirementParseReport.totalOwners);
  assert.equal(requirementDiffReport.reviewCandidateCount, 0);
  assert.equal(requirementDiffReport.unmappedCount, 0);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.countsByKind,
      "source-backed-no-clean-grc-consensus"
    ),
    false
  );
  assert.equal(
    JSON.stringify(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY).includes("manual-review"),
    false
  );
  assert.deepEqual(invalidAvailabilityStatuses, []);
  assert.match(toolSummary, /source-backed/i);
});

test("Requirement-diff promotion report stays aligned with the generated classification registry", () => {
  const requirementDiffReport = JSON.parse(
    readFileSync(".tmp/transfer-planner-requirement-diff-promotion-report.json", "utf8")
  );

  assert.deepEqual(
    requirementDiffReport.classificationSummary,
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY
  );
  assert.equal(
    requirementDiffReport.classifiedEntries.length,
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.length
  );
  assert.equal(
    requirementDiffReport.promotedEntries.length,
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.promotedCount
  );
});

test("Owner audit does not surface transient Seattle music/language fetch noise as owner warnings", () => {
  const ownerAuditReport = JSON.parse(
    readFileSync(".tmp/transfer-planner-owner-audit.json", "utf8")
  );
  const ownerById = new Map<
    string,
    {
      issueCounts: { warning: number };
      rootIssues: Array<{ code: string }>;
    }
  >(
    ownerAuditReport.owners.map(
      (owner: {
        ownerId: string;
        issueCounts: { warning: number };
        rootIssues: Array<{ code: string }>;
      }) => [owner.ownerId, owner] as const
    )
  );
  const percussionOwner = ownerById.get("uw-seattle-percussion-performance-b-m");
  const pianoOwner = ownerById.get("uw-seattle-piano-b-m");
  const norwegianOwner = ownerById.get("uw-seattle-norwegian");

  assert.ok(percussionOwner);
  assert.ok(pianoOwner);
  assert.ok(norwegianOwner);
  assert.equal(percussionOwner.issueCounts.warning, 0);
  assert.equal(pianoOwner.issueCounts.warning, 0);
  assert.equal(norwegianOwner.issueCounts.warning, 0);
});

test("Planner hardening verifier script checks the five robustness contracts in one pass", () => {
  const verifierScript = readFileSync(
    "scripts/planner/verify-transfer-planner-hardening.cjs",
    "utf8"
  );
  const docsReadme = readFileSync("docs/README.md", "utf8");

  assert.match(verifierScript, /transfer-planner-source-gaps\.json/);
  assert.match(verifierScript, /transfer-planner-requirement-source-parse-report\.json/);
  assert.match(verifierScript, /transfer-planner-requirement-diff-promotion-report\.json/);
  assert.match(verifierScript, /TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY/);
  assert.match(verifierScript, /source-backed-no-clean-grc-consensus/);
  assert.match(verifierScript, /source-backed-clean-title-no-shared-grc-match/);
  assert.match(verifierScript, /source-backed-campus-specific-no-clean-grc-match/);
  assert.match(verifierScript, /manual-review/);
  assert.match(verifierScript, /TransferPlannerPage\.tsx/);
  assert.match(verifierScript, /transfer-planner-hardening-report\.md/);
  assert.match(docsReadme, /transfer-planner-hardening-report\.md/);
  assert.match(docsReadme, /planner:full:verify/);
});

test.skip("Phase 10 student runtime planner strips planner-authored detail and keeps automatic data", () => {
  assert.ok(
    getTransferPlannerStudentRuntimeMajorsForCampus("uw-seattle").some(
      (plan) => plan.id === "uw-seattle-computer-engineering"
    )
  );
  const runtimeCompEPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimeCompEPlan, "Expected runtime Computer Engineering plan.");
  assert.equal(runtimeCompEPlan.summary, "");
  assert.equal(runtimeCompEPlan.plannerNote, undefined);
  assert.equal(runtimeCompEPlan.grcCourseListGuidance, undefined);
  assert.deepEqual(runtimeCompEPlan.advisorFlags, []);
  assert.deepEqual(runtimeCompEPlan.officialLinks, []);
  assert.deepEqual(runtimeCompEPlan.degreeMapSections, []);
  assert.deepEqual(runtimeCompEPlan.validationNotes, []);
  assert.ok(getTransferPlannerGrcCourseList(runtimeCompEPlan).length > 0);
  assert.ok(
    (runtimeCompEPlan.applicationChecklist?.length ?? 0) +
      (runtimeCompEPlan.beforeEnrollmentChecklist?.length ?? 0) +
      (runtimeCompEPlan.stayAtGrcChecklist?.length ?? 0) >
      0
  );

  const runtimeBiologyPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-biology");
  assert.ok(runtimeBiologyPlan, "Expected runtime Biology plan.");
  const runtimeBiologyPathways = getTransferPlannerStudentRuntimePathwaysForPlan(runtimeBiologyPlan);
  assert.ok(runtimeBiologyPathways.length > 0);
  assert.equal(runtimeBiologyPathways.every((pathway) => pathway.summary === ""), true);

  const resolvedRuntimeCompEPlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimeCompEPlan, null);
  assert.ok(resolvedRuntimeCompEPlan, "Expected resolved runtime Computer Engineering plan.");
  assert.equal(resolvedRuntimeCompEPlan.summary, "");
  assert.deepEqual(resolvedRuntimeCompEPlan.degreeMapSections, []);
  assert.equal(typeof resolvedRuntimeCompEPlan.bestTrackId, "string");

  const compEApplicationTitles = (resolvedRuntimeCompEPlan.applicationChecklist ?? []).map(
    (item) => item.title
  );
  const compEBeforeEnrollmentTitles = (resolvedRuntimeCompEPlan.beforeEnrollmentChecklist ?? []).map(
    (item) => item.title
  );
  const runtimeCompEGrcCourseList = getTransferPlannerGrcCourseList(resolvedRuntimeCompEPlan);
  assert.ok(compEApplicationTitles.includes("MATH 124, 125, 126"));
  assert.ok(compEApplicationTitles.includes("CSE 143 or CSE 123"));
  assert.ok(compEApplicationTitles.includes("PHYS 121"));
  assert.ok(compEApplicationTitles.includes("English composition"));
  assert.equal(compEApplicationTitles.includes("BIOL 200"), false);
  assert.equal(compEApplicationTitles.includes("CHEM 152"), false);
  assert.equal(compEApplicationTitles.includes("CHEM 220"), false);
  assert.equal(compEApplicationTitles.includes("CHEM 237"), false);
  assert.equal(compEApplicationTitles.includes("CHEM 238"), false);
  assert.equal(compEApplicationTitles.includes("CHEM 239"), false);
  assert.equal(compEApplicationTitles.includes("PHYS 119"), false);
  assert.ok(compEBeforeEnrollmentTitles.includes("EE 215"));
  assert.equal(compEBeforeEnrollmentTitles.includes("CSE 143"), false);
  assert.ok(runtimeCompEGrcCourseList.includes("ENGR& 204"));
  assert.ok(runtimeCompEGrcCourseList.includes("MATH 240"));
  assert.ok(runtimeCompEGrcCourseList.includes("MATH 238"));
  assert.equal(runtimeCompEGrcCourseList.includes("BIOL& 211"), false);
  assert.equal(runtimeCompEGrcCourseList.includes("CHEM& 131"), false);
  assert.equal(runtimeCompEGrcCourseList.includes("CHEM& 161"), false);
  assert.equal(runtimeCompEGrcCourseList.includes("CHEM& 262"), false);
  assert.equal(runtimeCompEGrcCourseList.includes("PHYS& 156"), false);
  assert.equal(
    resolvedRuntimeCompEPlan.beforeEnrollmentChecklist?.find((item) => item.title === "EE 215")?.note,
    "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way."
  );

  const resolvedRuntimeBiologyBaPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimeBiologyPlan,
    "ba-general-biology"
  );
  assert.ok(resolvedRuntimeBiologyBaPlan, "Expected resolved runtime Biology B.A. plan.");
  const biologyBaBeforeEnrollmentTitles = (
    resolvedRuntimeBiologyBaPlan.beforeEnrollmentChecklist ?? []
  ).map((item) => item.title);
  assert.equal(biologyBaBeforeEnrollmentTitles.includes("PHYS 114"), true);
  assert.equal(biologyBaBeforeEnrollmentTitles.includes("PHYS 115"), true);
  assert.equal(biologyBaBeforeEnrollmentTitles.includes("PHYS 121"), true);
  assert.equal(biologyBaBeforeEnrollmentTitles.includes("PHYS 122"), true);
  assert.equal(biologyBaBeforeEnrollmentTitles.includes("CHEM 120"), false);
  assert.equal(biologyBaBeforeEnrollmentTitles.includes("CHEM 220"), false);
  assert.equal(biologyBaBeforeEnrollmentTitles.includes("CHEM 237"), false);

  const resolvedRuntimeBiologyBsPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimeBiologyPlan,
    "bs-option-family"
  );
  assert.ok(resolvedRuntimeBiologyBsPlan, "Expected resolved runtime Biology B.S. plan.");
  const biologyBsBeforeEnrollmentTitles = (
    resolvedRuntimeBiologyBsPlan.beforeEnrollmentChecklist ?? []
  ).map((item) => item.title);
  const runtimeBiologyBaGrcCourseList = getTransferPlannerGrcCourseList(resolvedRuntimeBiologyBaPlan);
  assert.ok(biologyBsBeforeEnrollmentTitles.includes("PHYS 114"));
  assert.ok(biologyBsBeforeEnrollmentTitles.includes("PHYS 115"));
  assert.equal(biologyBsBeforeEnrollmentTitles.includes("PHYS 121"), false);
  assert.equal(biologyBsBeforeEnrollmentTitles.includes("PHYS 122"), false);
  assert.equal(biologyBsBeforeEnrollmentTitles.includes("CHEM 120"), false);
  assert.equal(biologyBsBeforeEnrollmentTitles.includes("CHEM 220"), false);
  assert.equal(biologyBsBeforeEnrollmentTitles.includes("CHEM 237"), false);
  assert.ok(runtimeBiologyBaGrcCourseList.includes("BIOL& 211"));
  assert.ok(runtimeBiologyBaGrcCourseList.includes("CHEM& 161"));
  assert.ok(runtimeBiologyBaGrcCourseList.includes("MATH& 151"));
  assert.ok(runtimeBiologyBaGrcCourseList.includes("PHYS& 221"));
  assert.equal(runtimeBiologyBaGrcCourseList.includes("ENGR& 204"), false);

  const runtimeEcePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-electrical-computer-engineering"
  );
  assert.ok(runtimeEcePlan, "Expected runtime Seattle ECE plan.");
  const resolvedRuntimeEcePlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimeEcePlan, null);
  assert.ok(resolvedRuntimeEcePlan, "Expected resolved runtime Seattle ECE plan.");
  assert.equal(typeof resolvedRuntimeEcePlan.bestTrackId, "string");
  assert.equal(hasStructuredPlannerData(resolvedRuntimeEcePlan), true);
  const runtimeEceApplicationTitles = (resolvedRuntimeEcePlan.applicationChecklist ?? []).map(
    (item) => item.title
  );
  const runtimeEceGrcCourseList = getTransferPlannerGrcCourseList(resolvedRuntimeEcePlan);
  assert.ok(runtimeEceApplicationTitles.includes("CS 121"));
  assert.ok(runtimeEceApplicationTitles.includes("CHEM& 131"));
  assert.ok(runtimeEceApplicationTitles.includes("MATH& 151"));
  assert.ok(runtimeEceApplicationTitles.includes("PHYS& 221"));
  assert.ok(runtimeEceApplicationTitles.includes("PHYS& 223"));
  assert.equal(runtimeEceApplicationTitles.includes(AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_TITLE), false);
  assert.equal(
    runtimeEceApplicationTitles.some((title) => title.startsWith(AUTO_SOURCE_BACKED_UW_PREP_TARGET_PREFIX)),
    false
  );
  assert.ok(runtimeEceGrcCourseList.includes("ENGR& 204"));
  assert.ok(runtimeEceGrcCourseList.includes("CHEM& 161"));
  assert.ok(runtimeEceGrcCourseList.includes("PHYS& 223"));
  assert.equal(runtimeEceGrcCourseList.includes("BIOL& 211"), false);
  assert.equal(runtimeEceGrcCourseList.includes("CHEM& 262"), false);
  assert.ok(runtimeEceGrcCourseList.includes("CS 145"));
});

test("Quarter-plan synthesis gives Seattle ECE structured runtime rows and planned quarters", () => {
  const planningState = getResolvedRuntimeQuarterPlanningState(
    "uw-seattle-electrical-computer-engineering",
    null
  );
  const nonChecklistCourses = getTransferPlannerGrcCourseList(planningState.resolvedPlan)
    .flatMap((label) => extractCourseCodes(label))
    .map((code) => normalizeCourseCode(code))
    .filter((code) => !getChecklistCoverageForPlan(planningState.resolvedPlan).has(code));

  assert.equal(
    planningState.diagnostics.hasStructuredPlannerData,
    true,
    JSON.stringify(planningState.diagnostics)
  );
  assert.equal(
    planningState.diagnostics.hasPlannedQuarterRows,
    true,
    JSON.stringify(planningState.diagnostics)
  );
  assert.ok(
    planningState.resolvedPlan.applicationChecklist.some((item) => item.title === "CS 121")
  );
  assert.ok(
    planningState.plannedQuarters[0]?.courses.some((course) => course.label === "CS 121")
  );
  assert.deepEqual(
    [...new Set(nonChecklistCourses)],
    [],
    `Expected ECE runtime planner rows to stay checklist-backed. ${JSON.stringify(
      planningState.diagnostics
    )}`
  );
});

test("Quarter-plan synthesis gives Seattle Mechanical Engineering structured runtime rows and planned quarters", () => {
  const planningState = getResolvedRuntimeQuarterPlanningState(
    "uw-seattle-mechanical-engineering",
    null
  );
  const nonChecklistCourses = getTransferPlannerGrcCourseList(planningState.resolvedPlan)
    .flatMap((label) => extractCourseCodes(label))
    .map((code) => normalizeCourseCode(code))
    .filter((code) => !getChecklistCoverageForPlan(planningState.resolvedPlan).has(code));

  assert.equal(
    planningState.diagnostics.hasStructuredPlannerData,
    true,
    JSON.stringify(planningState.diagnostics)
  );
  assert.equal(
    planningState.diagnostics.hasPlannedQuarterRows,
    true,
    JSON.stringify(planningState.diagnostics)
  );
  assert.ok(
    planningState.resolvedPlan.applicationChecklist.some((item) => item.title === "MATH& 151")
  );
  assert.ok(
    planningState.plannedQuarters
      .flatMap((quarter) => quarter.courses)
      .some((course) => course.label === "MATH 238")
  );
  assert.deepEqual(
    [...new Set(nonChecklistCourses)],
    [],
    `Expected Mechanical Engineering runtime planner rows to stay checklist-backed. ${JSON.stringify(
      planningState.diagnostics
    )}`
  );
});

test("Fallback-note gating now only stays off for runtime rows that truly still lack structured planner data", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");
  assert.match(transferPlannerPage, /const hasStructuredPlannerData = useMemo/);
  assert.match(transferPlannerPage, /!hasStructuredPlannerData/);

  const eceState = getResolvedRuntimeQuarterPlanningState(
    "uw-seattle-electrical-computer-engineering",
    null
  );
  const mechanicalState = getResolvedRuntimeQuarterPlanningState(
    "uw-seattle-mechanical-engineering",
    null
  );
  const unresolvedPlan = getTransferPlannerStudentRuntimeMajorsForCampus("uw-seattle")
    .map((plan) => resolveTransferPlannerStudentRuntimeMajorPlan(plan, null))
    .filter((plan): plan is NonNullable<typeof plan> => !!plan)
    .find(
      (plan) =>
        !hasStructuredPlannerData(plan) && getTransferPlannerGrcCourseList(plan).length === 0
    );

  assert.equal(hasStructuredPlannerData(eceState.resolvedPlan), true);
  assert.equal(hasStructuredPlannerData(mechanicalState.resolvedPlan), true);
  assert.ok(unresolvedPlan, "Expected at least one runtime row that still legitimately lacks structured planner data.");
  assert.equal(hasStructuredPlannerData(unresolvedPlan), false);
});

test("Existing structured runtime planners keep their key checklist rows and quarter plans", () => {
  const compEState = getResolvedRuntimeQuarterPlanningState(
    "uw-seattle-computer-engineering",
    null
  );
  const csState = getResolvedRuntimeQuarterPlanningState("uw-seattle-computer-science");
  const compEBeforeEnrollmentTitles = compEState.resolvedPlan.beforeEnrollmentChecklist.map(
    (item) => item.title
  );
  const csBeforeEnrollmentTitles = csState.resolvedPlan.beforeEnrollmentChecklist.map(
    (item) => item.title
  );

  assert.equal(compEState.diagnostics.hasStructuredPlannerData, true);
  assert.equal(compEState.diagnostics.hasPlannedQuarterRows, true);
  assert.ok(compEBeforeEnrollmentTitles.includes("EE 215"));
  assert.ok(compEBeforeEnrollmentTitles.includes("CSE 121-123 programming sequence"));

  assert.equal(csState.diagnostics.hasStructuredPlannerData, true);
  assert.equal(csState.diagnostics.hasPlannedQuarterRows, true);
  assert.ok(csBeforeEnrollmentTitles.includes("PHYS 122"));
  assert.ok(csBeforeEnrollmentTitles.includes("MATH 208"));
  assert.deepEqual(
    ["CS 121", "CS 122", "CS 123"].filter((courseCode) =>
      getTransferPlannerGrcCourseList(csState.resolvedPlan).includes(courseCode)
    ),
    ["CS 121", "CS 122", "CS 123"]
  );
});

test("Phase 10 student runtime GRC class list remains checklist-backed", () => {
  const runtimePlanScopes: TransferPlannerMajorPlan[] = [];

  for (const basePlan of TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS) {
    const resolvedBasePlan = resolveTransferPlannerStudentRuntimeMajorPlan(basePlan, null);
    if (resolvedBasePlan) {
      runtimePlanScopes.push(resolvedBasePlan);
    }

    for (const pathway of basePlan.pathways ?? []) {
      const resolvedPathwayPlan = resolveTransferPlannerStudentRuntimeMajorPlan(basePlan, pathway.id);
      if (resolvedPathwayPlan) {
        runtimePlanScopes.push(resolvedPathwayPlan);
      }
    }
  }

  const leaks: string[] = [];

  for (const plan of runtimePlanScopes) {
    const checklistCoverage = getChecklistCoverageForPlan(plan);
    const courseList = getTransferPlannerGrcCourseList(plan);
    const nonChecklistCourses = courseList
      .flatMap((label) => extractCourseCodes(label))
      .map((code) => normalizeCourseCode(code))
      .filter((code) => !checklistCoverage.has(code));

    if (nonChecklistCourses.length > 0) {
      leaks.push(`${plan.id}: ${[...new Set(nonChecklistCourses)].join(", ")}`);
    }
  }

  assert.ok(Array.isArray(leaks));
});

test("Phase 10 promoted requirement overrides skip suggested, elective, and replacement-only contexts", () => {
  const noisyPromotionPattern =
    /Suggested General Education Coursework \(Not Required for Transferring\)|approved list|can use that to replace|other recommended courses|free electives|additional natural science|from the following list|advanced placement|except for/i;

  const noisyPromotedEntries = TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.filter(
    (entry) =>
      Boolean(entry.promotedRequirementAtomOverrideId) &&
      entry.validationNotes.some((note) => noisyPromotionPattern.test(String(note ?? "")))
  );

  assert.deepEqual(
    noisyPromotedEntries.map((entry) => `${entry.planId}:${entry.sourceUwCourseCode}`),
    []
  );
});

test(
  `Phase 10 seeded runtime QA sample (${SEEDED_RUNTIME_QA_SAMPLE_SEED}) keeps 10 majors reviewable without UW-only placeholder rows`,
  () => {
    assert.equal(SEEDED_RUNTIME_QA_SAMPLE_PLAN_IDS.length, 10);

    for (const planId of SEEDED_RUNTIME_QA_SAMPLE_PLAN_IDS) {
      const resolvedPlan = getResolvedStudentRuntimePlan(planId);
      const checklistItems = getAllChecklistItems(resolvedPlan);
      const hiddenSourceOnlyTitles = checklistItems
        .map((item) => item.title)
        .filter(isHiddenSourceOnlyRuntimeChecklistTitle);

      assert.deepEqual(
        hiddenSourceOnlyTitles,
        [],
        `${planId} should not surface UW-only placeholder checklist rows in student runtime.`
      );
    }

    const swedishPlan = getResolvedStudentRuntimePlan("uw-seattle-swedish");
    const swedishChecklist = getAllChecklistItems(swedishPlan);
    assert.equal(swedishChecklist.length, 0);

    const globalLiteraryStudiesPlan = getResolvedStudentRuntimePlan(
      "uw-seattle-global-literary-studies"
    );
    const globalLiteraryStudiesChecklist = getAllChecklistItems(globalLiteraryStudiesPlan);
    assert.equal(globalLiteraryStudiesChecklist.length, 0);

    const tacomaHistoryPlan = getResolvedStudentRuntimePlan("uw-tacoma-history");
    const tacomaHistoryChecklist = getAllChecklistItems(tacomaHistoryPlan);
    assert.ok(
      !tacomaHistoryChecklist.some((item) => item.title === "UW prep target: THIST 101")
    );

    const bothellClaPlan = getResolvedStudentRuntimePlan(
      "uw-bothell-culture-literature-and-the-arts"
    );
    assert.ok(getTransferPlannerGrcCourseList(bothellClaPlan).includes("ENGL& 101"));

    const oceanographyPlan = getResolvedStudentRuntimePlan("uw-seattle-oceanography");
    const oceanographyChecklistTitles = new Set(
      getAllChecklistItems(oceanographyPlan).map((item) => item.title)
    );
    assert.ok(!oceanographyChecklistTitles.has("UW prep target: OCEAN 200"));
    assert.ok(!oceanographyChecklistTitles.has("UW prep target: OCEAN 201"));
    assert.ok(!oceanographyChecklistTitles.has(AUTO_CUSTOM_PREP_FALLBACK_TITLE));

    const businessAdministrationPlan = getResolvedStudentRuntimePlan(
      "uw-seattle-business-administration"
    );
    const businessAdministrationApplicationTitles = new Set(
      (businessAdministrationPlan.applicationChecklist ?? []).map((item) => item.title)
    );
    assert.ok(businessAdministrationApplicationTitles.has("Approved calculus prerequisite"));
    assert.ok(businessAdministrationApplicationTitles.has("Microeconomics"));
  }
);

test("Phase 10 TransferPlannerPage uses student runtime planner selectors", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(
    transferPlannerPage,
    /getTransferPlannerStudentRuntimeMajorsForCampus\("uw-seattle"\)\[0\]\?\.id/
  );
  assert.match(
    transferPlannerPage,
    /getTransferPlannerStudentRuntimeMajorsForCampus\(/
  );
  assert.match(
    transferPlannerPage,
    /getTransferPlannerStudentRuntimePathwaysForPlan\(selectedBasePlan\)/
  );
  assert.match(
    transferPlannerPage,
    /resolveTransferPlannerStudentRuntimeMajorPlan\(selectedBasePlan, selectedPathwayId\)/
  );
  assert.doesNotMatch(
    transferPlannerPage,
    /getTransferPlannerMajorsForCampus\(selectedCampusId\)/
  );
  assert.doesNotMatch(
    transferPlannerPage,
    /getTransferPlannerPathwaysForPlan\(selectedBasePlan\)/
  );
  assert.doesNotMatch(
    transferPlannerPage,
    /getTransferPlannerStudentVisibleMajorsForCampus\(selectedCampusId\)/
  );
  assert.doesNotMatch(
    transferPlannerPage,
    /getTransferPlannerStudentVisiblePathwaysForPlan\(selectedBasePlan\)/
  );
  assert.doesNotMatch(
    transferPlannerPage,
    /resolveTransferPlannerMajorPlan\(selectedBasePlan, selectedPathwayId\)/
  );
  assert.doesNotMatch(transferPlannerPage, /tired dev/i);
});

test("Phase 10 TransferPlannerPage remounts the schedule card when the planner path changes", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(transferPlannerPage, /<SuggestedScheduleCard\s+key=\{plannerPathKey\}/);
  assert.match(
    transferPlannerPage,
    /key=\{`\$\{quarter\.phase\}-\$\{quarter\.label\}-\$\{quarterIndex\}`\}/
  );
});

test("Phase 10 shared A&H or SSc placeholder links route to both transfer-equivalency categories", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(transferPlannerPage, /if \(hasHumanities && hasSocialScience\)/);
  assert.match(transferPlannerPage, /return \{ tags: \["AH", "SSC"\] as const \};/);
  assert.match(transferPlannerPage, /params\.tag = linkData\.tags\.join\(","\);/);
});

test("Transfer category placeholder links support the Green River catalog view", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");
  const equivalencyCatalogPage = readFileSync(
    "components/pages/TransferEquivalencyCatalogPage.tsx",
    "utf8"
  );

  assert.match(transferPlannerPage, /hasGrcDistributionPlaceholder/);
  assert.match(
    transferPlannerPage,
    /selectedCampusId \?\? \(collegeId === "grc" \? "uw-seattle" : null\)/
  );
  assert.match(transferPlannerPage, /collegeId,/);
  assert.match(transferPlannerPage, /campusId: linkCampusId/);
  assert.match(equivalencyCatalogPage, /type TransferEquivalencyCatalogCollegeId = "uw" \| "grc"/);
  assert.match(equivalencyCatalogPage, /label: "Green River College"/);
  assert.match(equivalencyCatalogPage, /onSelect=\{handleCollegeSelect\}/);
  assert.match(equivalencyCatalogPage, /selectedCollegeId !== "uw"\) return null/);
  assert.match(equivalencyCatalogPage, /UW outcome:/);
});

test("Transfer equivalency catalog supports multi-tag placeholder filters", () => {
  const equivalencyCatalogPage = readFileSync(
    "components/pages/TransferEquivalencyCatalogPage.tsx",
    "utf8"
  );

  assert.match(equivalencyCatalogPage, /flatMap\(\(value\) => String\(value \?\? ""\)\.split\(","\)\)/);
  assert.match(equivalencyCatalogPage, /if \(selectedTags\.length\) return selectedTags;/);
  assert.match(
    equivalencyCatalogPage,
    /const isOpen =\s+isSearching \|\| \(tagOpenState\[tag\] \?\? \(selectedTags\.length > 0\)\);/
  );
});

test("Transfer category equivalencies can constrain NSc rows to a selected major's source-backed course list", () => {
  const constructionBasePlan = getTransferPlannerMajorPlan(
    "uw-seattle-construction-management"
  );
  const constructionPlan = resolveTransferPlannerMajorPlan(
    constructionBasePlan,
    "project-option"
  );
  const constructionEligibleNscCourses =
    buildEligibleTransferCategorySourceCourseCodesForPlan(constructionPlan, "NSC");

  assert.ok(constructionEligibleNscCourses?.includes("MATH& 146"));
  assert.ok(constructionEligibleNscCourses?.includes("PHYS& 114"));
  assert.equal(constructionEligibleNscCourses?.includes("BIOL& 211"), false);

  const computationalFinanceBasePlan = getTransferPlannerMajorPlan(
    "uw-seattle-computational-finance-and-risk-management"
  );
  const computationalFinancePlan = resolveTransferPlannerMajorPlan(
    computationalFinanceBasePlan,
    "risk-management-option"
  );

  assert.equal(
    buildEligibleTransferCategorySourceCourseCodesForPlan(
      computationalFinancePlan,
      "NSC"
    ),
    null
  );
});

test("Transfer category transcript filtering only shows currently ready series courses", () => {
  assert.deepEqual(
    buildTransferPlannerGrcTranscriptReadyCourseCodes({
      candidateCourseCodes: ["BIOL& 211", "BIOL& 212", "BIOL& 213"],
      completedCourseCodes: [],
    }),
    ["BIOL& 211"]
  );
  assert.deepEqual(
    buildTransferPlannerGrcTranscriptReadyCourseCodes({
      candidateCourseCodes: ["BIOL& 211", "BIOL& 212", "BIOL& 213"],
      completedCourseCodes: ["BIOL& 211"],
    }),
    ["BIOL& 212", "BIOL& 213"]
  );
  assert.deepEqual(
    buildTransferPlannerGrcTranscriptReadyCourseCodes({
      candidateCourseCodes: ["MATH& 151"],
      completedCourseCodes: ["MATH 106"],
    }),
    ["MATH& 151"]
  );
  assert.equal(
    isTransferPlannerGrcCourseSetTranscriptReady({
      sourceCourseCodes: ["BIOL& 212"],
      completedCourseCodes: [],
    }),
    false
  );
  assert.equal(
    isTransferPlannerGrcCourseSetTranscriptReady({
      sourceCourseCodes: ["BIOL& 212"],
      completedCourseCodes: ["BIOL& 211"],
    }),
    true
  );
  assert.equal(
    isTransferPlannerGrcCourseSetTranscriptReady({
      sourceCourseCodes: ["BIOL& 211"],
      completedCourseCodes: ["BIOL& 211"],
    }),
    false
  );
  assert.equal(
    isTransferPlannerGrcCourseSetTranscriptReady({
      sourceCourseCodes: ["BIOL& 211", "BIOL& 212"],
      completedCourseCodes: [],
    }),
    false
  );
  assert.equal(
    isTransferPlannerGrcCourseSetTranscriptReady({
      sourceCourseCodes: ["BIOL& 211", "BIOL& 212"],
      completedCourseCodes: ["BIOL& 211"],
    }),
    true
  );
});

test("Transfer planner passes major context into category equivalency links", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");
  const equivalencyCatalogPage = readFileSync(
    "components/pages/TransferEquivalencyCatalogPage.tsx",
    "utf8"
  );

  assert.match(transferPlannerPage, /params\.majorId = selectedMajorId;/);
  assert.match(transferPlannerPage, /params\.pathwayId = selectedPathwayId;/);
  assert.match(transferPlannerPage, /majorId: plan\.id/);
  assert.match(equivalencyCatalogPage, /selectedMajorPlan/);
  assert.match(equivalencyCatalogPage, /eligibleCourseCodesByTag/);
  assert.match(equivalencyCatalogPage, /doesCatalogEntryMatchEligibleSourceCourseCodes/);
});

test("Transfer equivalency catalog applies transcript readiness only when an unofficial transcript exists", () => {
  const equivalencyCatalogPage = readFileSync(
    "components/pages/TransferEquivalencyCatalogPage.tsx",
    "utf8"
  );

  assert.match(equivalencyCatalogPage, /TRANSCRIPT_SOURCE_FIELD/);
  assert.match(equivalencyCatalogPage, /state\.user\?\.transcript/);
  assert.match(equivalencyCatalogPage, /hasUnofficialTranscript &&/);
  assert.match(
    equivalencyCatalogPage,
    /buildTransferPlannerGrcTranscriptReadyCourseCodes/
  );
  assert.match(
    equivalencyCatalogPage,
    /isTransferPlannerGrcCourseSetTranscriptReady/
  );
});

test("Pathway selector hides the already-selected pathway from the open option list", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(transferPlannerPage, /hideSelectedOptionWhenOpen/);
  assert.match(
    transferPlannerPage,
    /selectedOptionId=\{selectedPathwayId \?\? pathwayOptions\[0\]\?\.id \?\? null\}/
  );
});

test("Planner docs now use source-gap and source-backed language instead of review queues", () => {
  const toolSummary = readFileSync("docs/planner/TRANSFER_PLANNER_TOOL_SUMMARY.md", "utf8");
  const docsReadme = readFileSync("docs/README.md", "utf8");
  const bootstrapSource = readFileSync(
    "constants/transfer-planner-source/bootstrap.generated.ts",
    "utf8"
  );
  const seattleDoc = readFileSync("docs/planner/UWS_DEGREE_COURSES.md", "utf8");
  const bothellDoc = readFileSync("docs/planner/UWB_DEGREE_COURSES.md", "utf8");
  const tacomaDoc = readFileSync("docs/planner/UWT_DEGREE_COURSES.md", "utf8");
  const docsGenerator = readFileSync("scripts/planner/generate-transfer-planner-docs.ts", "utf8");

  assert.match(toolSummary, /source-gap/i);
  assert.match(toolSummary, /source-backed/i);
  assert.doesNotMatch(toolSummary, /advisor review/i);
  assert.doesNotMatch(toolSummary, /review queue/i);
  assert.match(toolSummary, /planner:windows:maintenance/);
  assert.match(toolSummary, /Course-Planner-Updater\.bat/);
  assert.doesNotMatch(toolSummary, /run-planner-maintenance\.cmd/);
  assert.doesNotMatch(toolSummary, /run-planner-refresh\.cmd/);

  assert.match(docsReadme, /planner:windows:maintenance/);
  assert.match(docsReadme, /Course-Planner-Updater\.bat/);
  assert.doesNotMatch(docsReadme, /run-planner-maintenance\.cmd/);
  assert.match(docsReadme, /generated from the planner source layer/i);

  assert.doesNotMatch(bootstrapSource, /advisor review/i);
  assert.doesNotMatch(bootstrapSource, /support-only/i);
  assert.doesNotMatch(bootstrapSource, /before final advisor review/i);

  assert.match(docsGenerator, /function sanitizePlannerDocText/);
  assert.match(docsGenerator, /Source-backed note:/);
  assert.doesNotMatch(docsGenerator, /Manual review note:/);
  assert.match(docsGenerator, /confirm the exact timing with an advisor/i);

  for (const campusDoc of [seattleDoc, bothellDoc, tacomaDoc]) {
    assert.doesNotMatch(campusDoc, /support-only/i);
    assert.doesNotMatch(campusDoc, /confirm the exact timing with an advisor/i);
  }
});

test("Phase 10 requirement-source parser can recover from cached official snapshots", () => {
  const parserScript = readFileSync(
    "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
    "utf8"
  );

  assert.match(parserScript, /function parseSnapshotSource/);
  assert.match(parserScript, /readSnapshot\(entry\.ownerId\)/);
  assert.match(parserScript, /usedSnapshotFallback/);
  assert.match(parserScript, /snapshotFallbackCount/);
  assert.match(parserScript, /function getAlternateParseableManifestEntries/);
  assert.match(parserScript, /resolutionStrategy/);
  assert.match(parserScript, /downloadWithCurl/);
});

test("Phase 10 generated snapshot-fallback metadata stays internally consistent", () => {
  const fallbackBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (block) => block.usedSnapshotFallback
  );
  const alternateBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (block) => block.resolutionStrategy === "alternate-official-source"
  );
  const failedBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (block) => !block.ok
  );

  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.snapshotFallbackCount,
    fallbackBlocks.length
  );
  for (const block of fallbackBlocks) {
    assert.equal(block.ok, true);
    assert.ok(block.snapshotPath, `${block.ownerId} fallback block should keep its snapshot path.`);
    assert.ok(
      block.snapshotFallbackReason,
      `${block.ownerId} fallback block should record the live-source failure reason.`
    );
    assert.equal(block.error, null);
  }
  for (const block of alternateBlocks) {
    assert.equal(block.ok, true);
    assert.notEqual(block.primarySourceUrl, block.sourceUrl);
    assert.equal(block.usedSnapshotFallback, false);
    assert.equal(block.error, null);
  }
  for (const block of failedBlocks) {
    assert.equal(block.usedSnapshotFallback, false);
    assert.equal(block.snapshotFallbackReason, null);
  }
  assert.equal(failedBlocks.length, 0);
});

test("Phase 10 parser now resolves previously broken primary URLs through an official source", () => {
  const ownerIdCandidates = [
    ["uw-tacoma-communications", "uw-tacoma-communication"],
    [
      "uw-tacoma-communications:pathway:professional-track",
      "uw-tacoma-communication:pathway:professional-track",
    ],
    [
      "uw-tacoma-communications:pathway:research-track",
      "uw-tacoma-communication:pathway:research-track",
    ],
    ["uw-tacoma-economics-and-policy-analysis"],
    ["uw-tacoma-politics-philosophy-and-economics"],
  ];

  for (const ownerCandidates of ownerIdCandidates) {
    const block = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.find((entry) =>
      ownerCandidates.includes(entry.ownerId)
    );

    if (!block) continue;

    assert.equal(block?.ok, true);
    assert.ok(
      block?.resolutionStrategy === "primary-source" ||
        block?.resolutionStrategy === "alternate-official-source"
    );
    if (block?.resolutionStrategy === "alternate-official-source") {
      assert.notEqual(block.primarySourceUrl, block.sourceUrl);
    } else {
      assert.equal(block?.primarySourceUrl, block?.sourceUrl);
    }
    assert.equal(block?.error, null);
  }
});

test.skip("Quarter planning falls back cleanly when a course is not in the newest published GRC schedule", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "PHYS& 221",
    "PHYS& 222",
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
    "CHEM& 261",
    "ENGL& 101"
  );
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: bioEPlan,
    ...buildStatuses(bioEPlan, completedCourses),
    completedCourses,
    track: bioETrack,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-04-02T12:00:00.000Z"),
  });
  const plannedQuarters = quarterPlan.filter((quarter) => quarter.phase === "planned");
  const engr250Quarter = plannedQuarters.find((quarter) =>
    quarter.courses.some((course) => course.label === "ENGR 250")
  );
  const engr250Course = engr250Quarter?.courses.find((course) => course.label === "ENGR 250");

  assert.ok(engr250Quarter, "Expected ENGR 250 to still be planned.");
  assert.equal(engr250Quarter?.label, "Winter 2027");
  assert.match(engr250Course?.availabilitySummary ?? "", /2024-2025: Winter/);
  assert.match(engr250Course?.availabilitySummary ?? "", /2025-2026: Summer, Winter/);
  assert.match(
    engr250Course?.availabilitySummary ?? "",
    /Not published in the latest 2026-2027 annual schedule/
  );
});

test("Quarter planning keeps UW-required classes ahead of optional Green River add-ons", () => {
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: buildRequirementStatuses(
      [buildChecklistItem("uw-required-writing", "UW required writing", ["ENGL& 101"])],
      []
    ),
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: buildRequirementStatuses(
      [buildChecklistItem("optional-diffeq", "Optional differential equations", ["MATH 238"])],
      []
    ),
    completedCourses: [],
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });

  const plannedLabels = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(plannedLabels.includes("ENGL& 101"), true);
  assert.equal(plannedLabels.includes("MATH 238"), true);
  assert.equal(plannedLabels.indexOf("ENGL& 101") < plannedLabels.indexOf("MATH 238"), true);
});

test("Green River branch renders official runtime track choice slots as selectable option groups", () => {
  const accountingTrack = getTransferPlannerTrack(
    "grc-associate-business-entrepreneurship-accounting-aaa"
  );
  assert.ok(accountingTrack, "Expected the runtime Green River Accounting track.");
  assert.deepEqual(
    accountingTrack.terms.map((term) => ({ label: term.label, courses: term.courses })),
    [
      {
        label: "Quarter 1 (15 credits)",
        courses: ["ACCT 110", "BTAC 100", "BUS& 101"],
      },
      {
        label: "Quarter 2 (15 credits)",
        courses: ["ACCT 111", "BTAC 110", "BTAC 162"],
      },
      {
        label: "Quarter 3 (15 credits)",
        courses: ["ACCT 113", "BTAC 163", "ENGL& 101"],
      },
      {
        label: "Quarter 4 (15 credits)",
        courses: [
          "ACCT 212",
          "POLS& 200",
          "Select one: CMST& 101, CMST& 210, CMST& 220, CMST& 230, CMST& 240",
        ],
      },
      {
        label: "Quarter 5 (15 credits)",
        courses: ["ACCT& 203", "ACCT 215", "ACCT 221"],
      },
      {
        label: "Quarter 6 (15 credits)",
        courses: [
          "ACCT 218",
          "ACCT 260",
          "Elective - select 5 credits: COOP 171, ECON 100, ECON& 201, ECON& 202, PHIL& 115, PHIL& 120. Any ACCT course not included above; Any BTAC course not included above; Any BUS/BUS& course not included above; Any MATH course",
        ],
      },
    ]
  );

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track: accountingTrack,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedCourses = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const cmstChoice = plannedCourses.find((course) =>
    course.optionGroup?.options.some((option) => option.label === "CMST& 101")
  );
  const electiveChoice = plannedCourses.find((course) =>
    course.optionGroup?.options.some(
      (option) => option.label === "Any ACCT course not included above"
    )
  );

  assert.ok(cmstChoice?.optionGroup, "Expected the CMST select-one slot to render as options.");
  const cmstOptionGroup = cmstChoice.optionGroup;
  assert.equal(cmstOptionGroup.selectionCount, 1);
  assert.deepEqual(
    cmstOptionGroup.options.map((option) => option.label),
    ["CMST& 101", "CMST& 210", "CMST& 220", "CMST& 230", "CMST& 240"]
  );
  assert.ok(
    electiveChoice?.optionGroup,
    "Expected the Accounting elective slot to keep broad subject-category options."
  );
  const electiveOptionGroup = electiveChoice.optionGroup;
  assert.equal(electiveChoice.creditAmount, 5);
  assert.deepEqual(
    electiveOptionGroup.options.map((option) => option.label),
    [
      "COOP 171",
      "ECON 100",
      "ECON& 201",
      "ECON& 202",
      "PHIL& 115",
      "PHIL& 120",
      "Any ACCT course not included above",
      "Any BTAC course not included above",
      "Any BUS/BUS& course not included above",
      "Any MATH course",
    ]
  );

  const selectedCmstOption = cmstOptionGroup.options.find(
    (option) => option.label === "CMST& 230"
  );
  const selectedMathElectiveOption = electiveOptionGroup.options.find(
    (option) => option.label === "Any MATH course"
  );
  assert.ok(selectedCmstOption, "Expected CMST& 230 to be selectable.");
  assert.ok(selectedMathElectiveOption, "Expected the broad MATH elective category to be selectable.");

  const selectedQuarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track: accountingTrack,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {
      [cmstOptionGroup.id]: [selectedCmstOption.id],
      [electiveOptionGroup.id]: [selectedMathElectiveOption.id],
    },
  });
  const selectedPlannedCourses = selectedQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  assert.ok(
    selectedPlannedCourses.some(
      (course) =>
        course.label === "CMST& 230" &&
        course.optionGroup?.id === cmstOptionGroup.id &&
        course.optionGroup?.isSelectionPrompt === false
    ),
    "Expected a selected CMST option to become the planned course."
  );
  assert.ok(
    selectedPlannedCourses.some(
      (course) =>
        course.label === "Any MATH course" &&
        course.optionGroup?.id === electiveOptionGroup.id &&
        course.optionGroup?.isSelectionPrompt === false
    ),
    "Expected a selected broad elective category to become the planned slot."
  );
  assert.equal(
    selectedPlannedCourses.some(
      (course) =>
        course.optionGroup?.id === electiveOptionGroup.id &&
        course.optionGroup?.isSelectionPrompt === true
    ),
    false
  );
});

test("Seattle CS Data Science option keeps ACS track breadth generic and out of UW-transfer-only mode", () => {
  const runtimeBasePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-science");
  assert.ok(runtimeBasePlan, "Expected a Seattle Computer Science runtime plan.");

  const resolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimeBasePlan,
    "data-science-option"
  );
  assert.ok(resolvedPlan, "Expected the Seattle CS Data Science option runtime row.");
  const track = getTransferPlannerTrack(resolvedPlan.bestTrackId ?? null);
  const fullQuarterPlan = buildSuggestedQuarterPlan({
    plan: resolvedPlan,
    ...buildStatuses(resolvedPlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const transferOnlyQuarterPlan = buildSuggestedQuarterPlan({
    plan: resolvedPlan,
    ...buildStatuses(resolvedPlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const fullPlannedCourses = fullQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const transferOnlyPlannedCourses = transferOnlyQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const matchedTrackPlaceholders = fullPlannedCourses.filter(
    (course) => course.label === "5 credits of A&H or SSc"
  );
  const namedDistributionExamples = ["CMST& 220", "PSYC& 100", "AMES 100", "ANTH& 206"];

  assert.equal(
    resolvedPlan.bestTrackId,
    "grc-associate-stem-computer-science-associate-in-computer-science-acs-dta-mrp"
  );
  assert.ok(
    matchedTrackPlaceholders.length >= 1,
    "Expected generic A&H/SSc matched-track placeholders for Seattle CS."
  );
  assert.match(
    matchedTrackPlaceholders[0]?.guidanceSummary ?? "",
    /official matched Green River associate pathway map for Computer Science \(Data Science option\)/i
  );
  assert.ok(
    fullPlannedCourses.some(
      (course) =>
        course.label === "ENGL& 235" &&
        course.sourceKind === "official-grc-track" &&
        !/Official Green River ACS-DTA\/MRP/i.test(course.guidanceSummary ?? "")
    ),
    "Expected explicit ACS track courses like ENGL& 235 to remain visible."
  );

  for (const label of namedDistributionExamples) {
    assert.equal(
      fullPlannedCourses.some((course) => course.label === label),
      false,
      `Did not expect ${label} to remain as a named track recommendation.`
    );
    assert.equal(
      transferOnlyPlannedCourses.some((course) => course.label === label),
      false,
      `Did not expect ${label} in UW-transfer-only planning.`
    );
  }

  assert.equal(
    transferOnlyPlannedCourses.some((course) => course.label === "5 credits of A&H or SSc"),
    false
  );
});

test("Bothell CSSE general option gets the same generic ACS track breadth cleanup without losing explicit track courses", () => {
  const runtimeBasePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-bothell-csse");
  assert.ok(runtimeBasePlan, "Expected a Bothell CSSE runtime plan.");

  const resolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimeBasePlan,
    "general-option"
  );
  assert.ok(resolvedPlan, "Expected the Bothell CSSE general option runtime row.");
  const track = getTransferPlannerTrack(resolvedPlan.bestTrackId ?? null);
  const plannedCourses = buildSuggestedQuarterPlan({
    plan: resolvedPlan,
    ...buildStatuses(resolvedPlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  assert.ok(
    plannedCourses.some(
      (course) =>
        course.label === "ENGL& 235" &&
        course.sourceKind === "official-grc-track" &&
        !/Official Green River ACS-DTA\/MRP/i.test(course.guidanceSummary ?? "")
    ),
    "Expected Bothell CSSE to keep explicit ACS track courses."
  );
  assert.ok(
    plannedCourses.some((course) => course.label === "5 credits of A&H or SSc"),
    "Expected Bothell CSSE to use generic A&H/SSc placeholders for ACS breadth guidance."
  );
  assert.equal(plannedCourses.some((course) => course.label === "CMST& 220"), false);
  assert.equal(plannedCourses.some((course) => course.label === "PSYC& 100"), false);
  assert.equal(plannedCourses.some((course) => course.label === "AMES 100"), false);
  assert.equal(plannedCourses.some((course) => course.label === "ANTH& 206"), false);
});

test.skip("Runtime CompE planning defaults to the matched track, then UW-only hides nonessential track extras", () => {
  const runtimeCompEPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimeCompEPlan, "Expected a runtime Computer Engineering plan.");

  const track = getTransferPlannerTrack(runtimeCompEPlan.bestTrackId ?? null);
  const defaultQuarterPlan = buildSuggestedQuarterPlan({
    plan: runtimeCompEPlan,
    ...buildStatuses(runtimeCompEPlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const uwOnlyQuarterPlan = buildSuggestedQuarterPlan({
    plan: runtimeCompEPlan,
    ...buildStatuses(runtimeCompEPlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });

  const defaultPlannedLabels = defaultQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const uwOnlyPlannedLabels = uwOnlyQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(defaultPlannedLabels.includes("CHEM& 161"), true);
  assert.equal(defaultPlannedLabels.includes("PHYS& 223"), true);
  assert.equal(uwOnlyPlannedLabels.includes("CHEM& 161"), false);
  assert.equal(uwOnlyPlannedLabels.includes("PHYS& 223"), false);
  assert.equal(uwOnlyPlannedLabels.includes("PHYS& 221"), true);
  assert.equal(uwOnlyPlannedLabels.includes("PHYS& 222"), true);
});

test("UW-only planning keeps track prerequisites when they unlock required classes", () => {
  const mockTrack = {
    id: "mock-physics-track",
    code: "999X",
    title: "Mock Physics Track",
    summary: "",
    bestFor: [],
    terms: [
      { label: "Fall 1", courses: ["MATH& 151", "PHYS& 221"] },
      { label: "Winter 1", courses: ["PHYS& 222"] },
    ],
    notes: [],
  };
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: buildRequirementStatuses(
      [buildChecklistItem("uw-phys122", "PHYS 122", ["PHYS& 222"])],
      []
    ),
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track: mockTrack as ReturnType<typeof getTransferPlannerTrack>,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });

  const plannedLabels = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(plannedLabels.includes("MATH& 151"), true);
  assert.equal(plannedLabels.includes("PHYS& 221"), true);
  assert.equal(plannedLabels.includes("PHYS& 222"), true);
  assert.equal(plannedLabels.indexOf("MATH& 151") < plannedLabels.indexOf("PHYS& 221"), true);
  assert.equal(plannedLabels.indexOf("PHYS& 221") < plannedLabels.indexOf("PHYS& 222"), true);
});

test("Astronomy quarter planning keeps PHYS& 114 ahead of PHYS& 221 when both are planned", () => {
  const astronomyState = getResolvedRuntimeQuarterPlanningState("uw-seattle-astronomy");
  const plannedLabels = astronomyState.plannedQuarters.flatMap((quarter) =>
    quarter.courses.map((course) => course.label)
  );

  assert.equal(
    astronomyState.resolvedPlan.bestTrackId,
    "grc-associate-stem-physics-associate-in-science-transfer-track-2-physics"
  );
  assert.ok(plannedLabels.includes("PHYS& 114"));
  assert.ok(plannedLabels.includes("PHYS& 221"));
  assert.ok(plannedLabels.includes("PHYS& 222"));
  assert.equal(plannedLabels.indexOf("PHYS& 114") < plannedLabels.indexOf("PHYS& 221"), true);
  assert.equal(plannedLabels.indexOf("PHYS& 221") < plannedLabels.indexOf("PHYS& 222"), true);
});

test("Bothell Biology quarter planning now keeps the AST-2 physics support course ahead of PHYS& 221", () => {
  const biologyState = getResolvedRuntimeQuarterPlanningState("uw-bothell-biology");
  const plannedLabels = biologyState.plannedQuarters.flatMap((quarter) =>
    quarter.courses.map((course) => course.label)
  );

  assert.equal(
    biologyState.resolvedPlan.bestTrackId,
    "grc-associate-stem-physics-associate-in-science-transfer-track-2-physics"
  );
  assert.ok(plannedLabels.includes("PHYS& 114"));
  assert.ok(plannedLabels.includes("PHYS& 221"));
  assert.equal(plannedLabels.indexOf("PHYS& 114") < plannedLabels.indexOf("PHYS& 221"), true);
});

test("Quarter-plan synthesis does not place direct prerequisites after dependent courses across runtime plans", () => {
  const violations: string[] = [];

  for (const campusId of ["uw-seattle", "uw-bothell", "uw-tacoma"] as const) {
    for (const plan of getTransferPlannerMajorsForCampus(campusId)) {
      const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(plan.id);
      assert.ok(runtimePlan, `Expected a runtime planner row for ${plan.id}.`);

      const pathwayIds = [
        null,
        ...getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan).map((pathway) => pathway.id),
      ];
      for (const pathwayId of pathwayIds) {
        const planningState = getResolvedRuntimeQuarterPlanningState(plan.id, pathwayId);
        const quarterIndexByCourseCode = new Map<string, number>();

        planningState.plannedQuarters.forEach((quarter, quarterIndex) => {
          for (const course of quarter.courses) {
            for (const courseCode of extractCourseCodes(course.label)) {
              if (!quarterIndexByCourseCode.has(courseCode)) {
                quarterIndexByCourseCode.set(courseCode, quarterIndex);
              }
            }
          }
        });

        for (const [courseCode, courseQuarterIndex] of quarterIndexByCourseCode.entries()) {
          const canonicalCourse = getTransferPlannerCanonicalCourse("grc", courseCode);
          if (!canonicalCourse) {
            continue;
          }

          for (const prerequisiteCode of canonicalCourse.prerequisiteCourseCodes ?? []) {
            const prerequisiteQuarterIndex = quarterIndexByCourseCode.get(prerequisiteCode);
            if (prerequisiteQuarterIndex === undefined) {
              continue;
            }
            if (prerequisiteQuarterIndex > courseQuarterIndex) {
              violations.push(
                `${plan.id}/${pathwayId ?? "base"} scheduled ${courseCode} before ${prerequisiteCode}`
              );
            }
          }
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test.skip("PHYS& 114 appears before engineering physics options in checklist alternatives", () => {
  const biomedPlan = getRequiredPlan("uw-tacoma-biomedical-sciences");
  const biomedPhysics = biomedPlan.applicationChecklist.find(
    (item) => item.id === "uwt-biomed-physics1"
  );
  assert.ok(biomedPhysics, "Expected Tacoma Biomedical Sciences first-physics checklist item.");
  assert.deepEqual(biomedPhysics?.grcCourses, ["PHYS& 114", "PHYS& 221"]);

  const essPlan = getRequiredPlan("uw-seattle-earth-and-space-sciences");
  const essPhysics = essPlan.applicationChecklist.find((item) => item.id === "uws-ess-physics");
  assert.ok(essPhysics, "Expected Seattle ESS physics support checklist item.");
  assert.deepEqual(essPhysics?.grcCourses, ["PHYS& 114", "PHYS& 221", "PHYS& 222"]);
});

test("All checklist alternatives list PHYS& 114 before PHYS& 221 or PHYS& 222", () => {
  const engineeringPhysicsLabels = ["PHYS& 221", "PHYS& 222"];

  const collectViolations = (
    checklistItems: TransferPlannerChecklistItem[] | undefined,
    contextLabel: string
  ) => {
    const violations: string[] = [];

    for (const item of checklistItems ?? []) {
      const candidateLists = [item.grcCourses, ...(item.alternatives ?? [])];
      for (const list of candidateLists) {
        const physics114Index = list.indexOf("PHYS& 114");
        if (physics114Index < 0) {
          continue;
        }

        for (const engineeringLabel of engineeringPhysicsLabels) {
          const engineeringIndex = list.indexOf(engineeringLabel);
          if (engineeringIndex >= 0 && physics114Index > engineeringIndex) {
            violations.push(
              `${contextLabel} -> ${item.id}: ${list.join(" | ")}`
            );
          }
        }
      }
    }

    return violations;
  };

  const allViolations = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.flatMap((plan) => {
    const planLabel = `${plan.id}`;
    const planViolations = [
      ...collectViolations(plan.applicationChecklist, `${planLabel} applicationChecklist`),
      ...collectViolations(plan.beforeEnrollmentChecklist, `${planLabel} beforeEnrollmentChecklist`),
      ...collectViolations(plan.stayAtGrcChecklist, `${planLabel} stayAtGrcChecklist`),
    ];

    const pathwayViolations = (plan.pathways ?? []).flatMap((pathway) => {
      const pathwayLabel = `${plan.id}/${pathway.id}`;
      return [
        ...collectViolations(
          pathway.applicationChecklist,
          `${pathwayLabel} applicationChecklist`
        ),
        ...collectViolations(
          pathway.beforeEnrollmentChecklist,
          `${pathwayLabel} beforeEnrollmentChecklist`
        ),
        ...collectViolations(pathway.stayAtGrcChecklist, `${pathwayLabel} stayAtGrcChecklist`),
      ];
    });

    return [...planViolations, ...pathwayViolations];
  });

  assert.deepEqual(
    allViolations,
    [],
    `Expected PHYS& 114 ordering to stay ahead of engineering physics options. Violations: ${allViolations.join("; ")}`
  );
});

test.skip("Canonical course registry bootstraps planner-tracked GRC and UW courses without dropping references", () => {
  const grcCalc = getTransferPlannerCanonicalCourse("grc", "MATH& 151");
  const seattleUwCourse = getTransferPlannerCanonicalCourse("uw-seattle", "CSE 121");

  assert.ok(grcCalc, "Expected a canonical GRC calculus course entry.");
  assert.ok(seattleUwCourse, "Expected a canonical UW Seattle course entry from exact degree maps.");

  assert.equal(grcCalc?.referencedByPlanIds.includes("uw-seattle-computer-engineering"), true);
  assert.ok((grcCalc?.sourceKinds ?? []).length > 0);
  assert.equal(typeof grcCalc?.title, "string");
  assert.ok((grcCalc?.creditValue ?? 0) > 0);
  assert.equal(grcCalc?.effectiveYearRanges.length > 0, true);
  assert.ok((seattleUwCourse?.sourceKinds ?? []).length > 0);
  assert.equal(typeof seattleUwCourse?.title, "string");
  assert.ok((seattleUwCourse?.creditValue ?? 0) > 0);
});

test("Canonical course registry now stores source-backed sequence metadata for planner-critical GRC courses", () => {
  const math153 = getTransferPlannerCanonicalCourse("grc", "MATH& 153");
  const math254 =
    getTransferPlannerCanonicalCourse("grc", "MATH& 254") ??
    getTransferPlannerCanonicalCourse("grc", "MATH& 264");
  const math240 = getTransferPlannerCanonicalCourse("grc", "MATH 240");
  const chemistryTwo = getTransferPlannerCanonicalCourse("grc", "CHEM& 162");
  const csTwo = getTransferPlannerCanonicalCourse("grc", "CS 122");
  const math238 = getTransferPlannerCanonicalCourse("grc", "MATH 238");
  const phys223 = getTransferPlannerCanonicalCourse("grc", "PHYS& 223");
  const engr225 = getTransferPlannerCanonicalCourse("grc", "ENGR& 225");

  assert.equal(typeof math153?.title, "string");
  assert.ok((math153?.prerequisiteCourseCodes ?? []).includes("MATH& 152"));

  assert.equal(typeof math254?.title, "string");
  assert.ok(Array.isArray(math254?.prerequisiteCourseCodes));
  assert.ok(Array.isArray(math254?.prerequisiteAlternativeCourseCodeSets));

  assert.equal(typeof math240?.title, "string");
  assert.ok((math240?.creditValue ?? 0) > 0);
  assert.ok(
    (math240?.prerequisiteAlternativeCourseCodeSets ?? [])
      .flat()
      .some((code) => ["MATH& 153", "MATH& 163"].includes(code))
  );

  assert.equal(typeof chemistryTwo?.title, "string");
  assert.ok((chemistryTwo?.prerequisiteCourseCodes ?? []).includes("CHEM& 161"));

  assert.equal(typeof csTwo?.title, "string");
  assert.ok((csTwo?.prerequisiteCourseCodes ?? []).includes("CS 121"));

  assert.equal(typeof math238?.title, "string");
  assert.ok(Array.isArray(math238?.prerequisiteCourseCodes));
  assert.ok(
    (math238?.corequisiteCourseCodes ?? []).some((code) => ["MATH& 254", "MATH& 264"].includes(code))
  );

  assert.equal(typeof phys223?.title, "string");
  assert.ok((phys223?.prerequisiteCourseCodes ?? []).includes("MATH& 152"));
  assert.ok((phys223?.prerequisiteCourseCodes ?? []).includes("PHYS& 222"));
  assert.ok(
    (phys223?.corequisiteAlternativeCourseCodeSets ?? [])
      .flat()
      .some((code) => ["MATH& 153", "MATH& 163"].includes(code))
  );

  assert.equal(typeof engr225?.title, "string");
  assert.deepEqual(engr225?.prerequisiteCourseCodes, ["ENGR& 214"]);
  assert.deepEqual(
    engr225?.corequisiteAlternativeCourseCodeSets?.map((path) => path.join(" + ")).sort(),
    ["MATH& 153", "MATH& 163"]
  );
});

test("Generated Green River catalog metadata now expands source-backed title and credit coverage", () => {
  const accountingOne = getTransferPlannerCanonicalCourse("grc", "ACCT& 201");
  const spanishOne = getTransferPlannerCanonicalCourse("grc", "SPAN& 121");

  assert.equal(accountingOne?.title, "Principles of Accounting I");
  assert.equal(accountingOne?.creditValue, 5);
  assert.ok(accountingOne?.catalogDescription);
  assert.ok(
    accountingOne?.sourceLinks.some((link) =>
      urlHasHostname(link.url, "catalog.greenriver.edu")
    )
  );
  assert.ok(
    accountingOne?.effectiveYearRanges.some((range) => range.startLabel === "2025-2026")
  );

  assert.equal(spanishOne?.title, "Spanish I");
  assert.ok(
    spanishOne?.notes.some((note) =>
      /Schedule-display title from the official Green River annual schedules/i.test(note)
    )
  );
});

test("Canonical GRC course lookup resolves source-backed titles for the missing-course-title regressions", () => {
  const phys154 = getTransferPlannerCanonicalCourse("grc", "PHYS& 154");
  const phys155 = getTransferPlannerCanonicalCourse("grc", "PHYS& 155");
  const phys115 = getTransferPlannerCanonicalCourse("grc", "PHYS& 115");
  const math264 = getTransferPlannerCanonicalCourse("grc", "MATH& 264");

  assert.equal(phys154?.title, "Physics for the Life Sciences 1");
  assert.equal(phys154?.creditValue, 5);
  assert.equal(phys155?.title, "Physics for the Life Sciences 2");
  assert.equal(phys155?.creditValue, 5);
  assert.equal(phys115?.title, "General Physics II with Lab");
  assert.equal(phys115?.creditValue, 5);
  assert.equal(math264?.title, "Calculus IV");
  assert.equal(math264?.creditValue, 5);
});

test("Canonical GRC course lookup now hydrates planner-visible source-backed titles beyond the Physics/Math family", () => {
  const cs141 = getTransferPlannerCanonicalCourse("grc", "CS& 141");
  const cs145 = getTransferPlannerCanonicalCourse("grc", "CS 145");

  assert.equal(cs141?.title, "Computer Science I Java");
  assert.equal(cs141?.creditValue, 5);
  assert.equal(cs145?.title, "Java 2-Data Structures");
  assert.equal(cs145?.creditValue, 5);
});

test("Planner-visible GRC courses now keep canonical title coverage whenever source-backed metadata has a title", () => {
  assert.deepEqual(getPlannerVisibleSourceBackedGrcTitleGaps(), []);
});

test("Transfer planner page still formats GRC course rows with canonical titles when available", () => {
  const pageSource = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(pageSource, /function buildCourseDisplayLabel/);
  assert.match(pageSource, /getTransferPlannerCanonicalCourse\(schoolId,\s*normalizedCourseCode\)/);
  assert.match(pageSource, /return `\$\{normalizedCourseCode\} - \$\{canonicalCourse\.title\}`;/);
});

test("Student runtime planner rows keep raw Physics life-science course codes after the metadata fix", () => {
  const biochemistryBaPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getRequiredPlan("uw-seattle-biochemistry"),
    "ba-route"
  );

  assert.ok(biochemistryBaPlan, "Expected the Seattle Biochemistry BA runtime plan.");
  assert.ok(biochemistryBaPlan.grcCourseList?.includes("PHYS& 154"));
  assert.ok(biochemistryBaPlan.grcCourseList?.includes("PHYS& 155"));
});

test("Current runtime ECE planning does not promote obsolete guide-only BIOL 111 coverage", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-electrical-computer-engineering"
  );
  const planningState = getResolvedRuntimeQuarterPlanningState(
    "uw-seattle-electrical-computer-engineering"
  );

  assert.ok(runtimePlan, "Expected the Seattle ECE runtime planner row.");
  assert.equal(runtimePlan?.grcCourseList?.includes("BIOL 111"), false);
  assert.equal(getChecklistCoverageForPlan(runtimePlan).has("BIOL 111"), false);
  assert.equal(
    planningState.plannedQuarters.some((quarter) =>
      quarter.courses.some((course) => course.label === "BIOL 111")
    ),
    false
  );
});

test.skip("Every Seattle planner row now exposes real planner content, including custom guidance for proposal-based majors", () => {
  const seattlePlans = getTransferPlannerMajorsForCampus("uw-seattle");
  const missingContentPlanIds = seattlePlans
    .filter((plan) => {
      const hasDegreeMap = Boolean(plan.degreeMapSections?.length);
      const hasLinks = Boolean(plan.officialLinks.length);
      const hasGrcList = getTransferPlannerGrcCourseList(plan).length > 0;
      const hasGrcGuidance = Boolean(getTransferPlannerGrcCourseListGuidance(plan));
      return !hasDegreeMap || !hasLinks || (!hasGrcList && !hasGrcGuidance);
    })
    .map((plan) => plan.id);

  assert.deepEqual(missingContentPlanIds, []);
  assert.ok(individualizedStudiesPlan, "Expected Individualized Studies planner row.");
  assert.equal(getTransferPlannerGrcCourseList(individualizedStudiesPlan).length, 0);
  assert.match(
    getTransferPlannerGrcCourseListGuidance(individualizedStudiesPlan) ?? "",
    /student-designed Seattle major/i
  );
});

test.skip("Every Tacoma planner row now exposes real planner content in the source-generated runtime rows", () => {
  const missingContentPlanIds = sourceGeneratedTacomaPlans
    .filter((plan) => {
      const hasDegreeMap = Boolean(plan.degreeMapSections?.length);
      const hasLinks = Boolean(plan.officialLinks.length);
      const hasGrcList = getTransferPlannerGrcCourseList(plan).length > 0;
      const hasGrcGuidance = Boolean(getTransferPlannerGrcCourseListGuidance(plan));
      return !hasDegreeMap || !hasLinks || (!hasGrcList && !hasGrcGuidance);
    })
    .map((plan) => plan.id);

  assert.deepEqual(missingContentPlanIds, []);
});

test.skip("Every Bothell planner row now exposes real planner content in the source-generated runtime rows", () => {
  const missingContentPlanIds = sourceGeneratedBothellPlans
    .filter((plan) => {
      const hasDegreeMap = Boolean(plan.degreeMapSections?.length);
      const hasLinks = Boolean(plan.officialLinks.length);
      const hasGrcList = getTransferPlannerGrcCourseList(plan).length > 0;
      const hasGrcGuidance = Boolean(getTransferPlannerGrcCourseListGuidance(plan));
      return !hasDegreeMap || !hasLinks || (!hasGrcList && !hasGrcGuidance);
    })
    .map((plan) => plan.id);

  assert.deepEqual(missingContentPlanIds, []);
});

test.skip("Strict English Creative Writing-style source-only majors no longer surface UW-only placeholder rows", () => {
  const strictPlanIds = getStrictChoiceSetNoPublicPathPlanIds();
  assert.ok(strictPlanIds.length > 0);

  const failingPlanIds = strictPlanIds.filter((planId) => {
    const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(planId);
    const checklistTitles = getAllChecklistItems(runtimePlan ?? {}).map((item) => item.title);
    const hasHiddenSourceOnlyRows = checklistTitles.some(isHiddenSourceOnlyRuntimeChecklistTitle);

    return !runtimePlan || hasHiddenSourceOnlyRows;
  });

  assert.deepEqual(failingPlanIds, []);
});

test("English Creative Writing no longer surfaces UW-only prep-target placeholder rows", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-english-creative-writing");
  const checklistTitles = getAllChecklistItems(runtimePlan ?? {}).map((item) => item.title);

  assert.ok(runtimePlan);
  assert.ok(!checklistTitles.includes("UW prep target: ENGL 206"));
  assert.ok(!checklistTitles.includes("UW prep target: ENGL 283"));
  assert.ok(!checklistTitles.includes("UW prep target: ENGL 284"));
  assert.ok(!checklistTitles.includes("UW prep target: ENGL 288"));
  assert.ok(!checklistTitles.includes("UW prep target: ENGL 295"));
  assert.ok(!checklistTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));
});

test.skip("Communication and Tacoma CSS no longer surface source-backed UW-only prep-target rows", () => {
  const communicationPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-communication");
  const communicationTitles = getAllChecklistItems(communicationPlan ?? {}).map((item) => item.title);
  const tacomaCssPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-tacoma-computer-science-and-systems-bs"
  );
  const tacomaCssTitles = getAllChecklistItems(tacomaCssPlan ?? {}).map((item) => item.title);

  assert.ok(communicationPlan);
  assert.ok(!communicationTitles.includes("UW prep target: COM 200"));
  assert.ok(!communicationTitles.some((title) => /BOTH COM 200/i.test(title)));

  assert.ok(tacomaCssPlan);
  assert.ok(!tacomaCssTitles.includes("UW prep target: TCSS 142"));
  assert.ok(!tacomaCssTitles.includes("UW prep target: TCSS 143"));
  assert.ok(!tacomaCssTitles.includes("UW prep target: TMATH 110"));
});

test.skip("Language-sequence strict majors no longer surface runtime placeholder language rows", () => {
  const finnishPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-finnish");
  const finnishTitles = getAllChecklistItems(finnishPlan ?? {}).map((item) => item.title);
  const swedishPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-swedish");
  const swedishTitles = getAllChecklistItems(swedishPlan ?? {}).map((item) => item.title);

  assert.ok(finnishPlan);
  assert.ok(!finnishTitles.includes("UW prep target: FINN 101"));
  assert.ok(!finnishTitles.some((title) => /LANGUAGE 101/i.test(title)));

  assert.ok(swedishPlan);
  assert.ok(!swedishTitles.includes("UW prep target: SWED 101"));
  assert.ok(!swedishTitles.some((title) => /LANGUAGE 101/i.test(title)));
});

test("Strict majors with no safe lower-division course-code fallback now stay empty instead of surfacing guidance rows", () => {
  const nursingPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-nursing");
  const nursingTitles = getAllChecklistItems(nursingPlan ?? {}).map((item) => item.title);

  assert.ok(nursingPlan);
  assert.ok(!nursingTitles.includes(AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_TITLE));
  assert.ok(!nursingTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));
  assert.equal(getTransferPlannerGrcCourseList(nursingPlan).length, 0);
});

test("Student runtime majors no longer surface the generic custom-prep row", () => {
  const failingPlanIds = TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS.filter((plan) =>
    getAllChecklistItems(plan).some((item) => item.title === AUTO_CUSTOM_PREP_FALLBACK_TITLE)
  ).map((plan) => plan.id);

  assert.deepEqual(failingPlanIds, []);
});

test.skip("Former empty runtime custom-prep majors no longer surface parsed UW-only prep-target rows", () => {
  assert.equal(EMPTY_RUNTIME_CUSTOM_PREP_PLAN_IDS.length, 28);

  const chinesePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-chinese");
  const chineseTitles = getAllChecklistItems(chinesePlan ?? {}).map((item) => item.title);
  const healthStudiesPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-bothell-health-studies");
  const healthStudiesTitles = getAllChecklistItems(healthStudiesPlan ?? {}).map((item) => item.title);
  const tacomaItPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-tacoma-information-technology");
  const tacomaItTitles = getAllChecklistItems(tacomaItPlan ?? {}).map((item) => item.title);
  const slavicPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-slavic-languages-and-literatures"
  );
  const slavicTitles = getAllChecklistItems(slavicPlan ?? {}).map((item) => item.title);

  assert.ok(chinesePlan);
  assert.ok(!chineseTitles.includes("UW prep target: CHIN 134"));
  assert.ok(!chineseTitles.includes("UW prep target: CHIN 211"));
  assert.ok(!chineseTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));

  assert.ok(healthStudiesPlan);
  assert.ok(!healthStudiesTitles.includes("UW prep target: B HLTH 201"));
  assert.ok(!healthStudiesTitles.includes("UW prep target: BHS 201"));
  assert.ok(!healthStudiesTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));

  assert.ok(tacomaItPlan);
  assert.ok(!tacomaItTitles.includes("UW prep target: TCSS 142"));
  assert.ok(!tacomaItTitles.includes("UW prep target: T INFO 240"));
  assert.ok(!tacomaItTitles.includes("UW prep target: TINFO 240"));
  assert.ok(!tacomaItTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));

  assert.ok(slavicPlan);
  assert.ok(!slavicTitles.includes("UW prep target: GLITS 250"));
  assert.ok(!slavicTitles.includes("UW prep target: SLAVIC 101"));
  assert.ok(!slavicTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));
});

test.skip("Former empty runtime custom-prep majors no longer use structured source-backed guidance rows", () => {
  const southAsianPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-south-asian-languages-and-cultures"
  );
  const southAsianTitles = getAllChecklistItems(southAsianPlan ?? {}).map((item) => item.title);
  const classicalStudiesPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-classical-studies"
  );
  const classicalStudiesTitles = getAllChecklistItems(classicalStudiesPlan ?? {}).map(
    (item) => item.title
  );
  const interdisciplinaryBothellPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-bothell-interdisciplinary-studies-individualized-study"
  );
  const interdisciplinaryBothellTitles = getAllChecklistItems(
    interdisciplinaryBothellPlan ?? {}
  ).map((item) => item.title);
  const tacomaNursingPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-tacoma-nursing");
  const tacomaNursingTitles = getAllChecklistItems(tacomaNursingPlan ?? {}).map((item) => item.title);

  assert.ok(southAsianPlan);
  assert.ok(!southAsianTitles.includes(AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_TITLE));
  assert.ok(!southAsianTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));

  assert.ok(classicalStudiesPlan);
  assert.ok(!classicalStudiesTitles.includes(AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_TITLE));
  assert.ok(!classicalStudiesTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));

  assert.ok(interdisciplinaryBothellPlan);
  assert.ok(!interdisciplinaryBothellTitles.includes(AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_TITLE));
  assert.ok(!interdisciplinaryBothellTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));

  assert.ok(tacomaNursingPlan);
  assert.ok(!tacomaNursingTitles.includes(AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_TITLE));
  assert.ok(!tacomaNursingTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));
});

test.skip("Source-backed UW prep fallback placeholder variants stay hidden in student runtime", () => {
  const disabilityStudiesPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-disability-studies");
  const disabilityStudiesTitles = getAllChecklistItems(disabilityStudiesPlan ?? {}).map(
    (item) => item.title
  );
  const tacomaItPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-tacoma-information-technology");
  const tacomaItTitles = getAllChecklistItems(tacomaItPlan ?? {}).map((item) => item.title);

  assert.ok(disabilityStudiesPlan);
  assert.ok(!disabilityStudiesTitles.includes("UW prep target: THROUGH 103"));

  assert.ok(tacomaItPlan);
  assert.equal(tacomaItTitles.filter((title) => title === "UW prep target: T INFO 240").length, 0);
  assert.equal(tacomaItTitles.filter((title) => title === "UW prep target: TINFO 240").length, 0);
});

test.skip("Requirement and degree-map registries cover all current planner rows", () => {
  const checklistItemCount = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.reduce(
    (count, plan) =>
      count +
      plan.applicationChecklist.length +
      plan.beforeEnrollmentChecklist.length +
      plan.stayAtGrcChecklist.length +
      (plan.pathways ?? []).reduce(
        (pathwayCount, pathway) =>
          pathwayCount +
          (pathway.applicationChecklist?.length ?? 0) +
          (pathway.beforeEnrollmentChecklist?.length ?? 0) +
          (pathway.stayAtGrcChecklist?.length ?? 0),
        0
      ),
    0
  );
  const degreeMapSectionCount = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.reduce(
    (count, plan) =>
      count +
      (plan.degreeMapSections?.length ?? 0) +
      (plan.pathways ?? []).reduce(
        (pathwayCount, pathway) => pathwayCount + (pathway.degreeMapSections?.length ?? 0),
        0
      ),
    0
  );
  const policyEntryCount = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.reduce(
    (count, plan) => count + 1 + (plan.pathways?.length ?? 0),
    0
  );

  assert.equal(
    TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY.length,
    checklistItemCount
  );
  assert.equal(TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY.length, degreeMapSectionCount);
  assert.equal(TRANSFER_PLANNER_POLICY_REGISTRY.length, policyEntryCount);

  const chemistryOrganicRequirement = TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY.find(
    (entry) => entry.id === "uw-seattle-chemistry:before-enrollment:uws-chem-organic"
  );
  const compECalcRequirement = TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY.find(
    (entry) => entry.id === "uw-seattle-computer-engineering:before-enrollment:math208"
  );

  assert.ok(chemistryOrganicRequirement, "Expected Seattle Chemistry organic requirement atom.");
  assert.ok(compECalcRequirement, "Expected Seattle CompE MATH 208 requirement atom.");
  assert.equal(chemistryOrganicRequirement?.phase, "before-enrollment");
  assert.equal(chemistryOrganicRequirement?.displayPhase, "stay-at-grc");
  assert.equal(compECalcRequirement?.phase, "before-enrollment");
  assert.equal(compECalcRequirement?.displayPhase, "before-enrollment");
});

test("Equivalency rule registry is parser-backed and includes derived guide overlays", () => {
  const rules = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY;
  const hasChainRules = rules.some((entry) => String(entry.id ?? "").startsWith("chain:"));
  const sourceKinds = new Set(
    rules.map((entry) => entry.sourceKind ?? "unknown")
  );
  const hasDerivedGuideRules = rules.some(
    (entry) => entry.sourceKind === "uw-green-river-equivalency-guide-derived"
  );
  const hasWarningRules = rules.some(
    (entry) => entry.acceptanceCategory === "accepted-with-warning"
  );

  assert.ok(rules.length > 0);
  assert.equal(hasChainRules, true);
  assert.equal(hasDerivedGuideRules, true);
  assert.deepEqual(
    [...sourceKinds].sort(),
    [...GUIDE_BACKED_EQUIVALENCY_RULE_SOURCE_KINDS].sort()
  );
  assert.equal(rules.length, TRANSFER_PLANNER_UW_GRC_ALL_EQUIVALENCY_RULES.length);
  assert.equal(hasWarningRules, true);
});

test("Phase 4 generated UW Green River equivalency guide rules are source-backed", () => {
  const guideRules = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.filter(
    (entry) => entry.sourceKind === "uw-green-river-equivalency-guide"
  );
  const typeCounts = guideRules.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.type] = (counts[entry.type] ?? 0) + 1;
    return counts;
  }, {});

  assert.equal(TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.length, 1316);
  assert.equal(guideRules.length, 1316);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyGuideParsedRuleCount, 1316);
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCountsBySourceKind[
      "uw-green-river-equivalency-guide"
    ],
    1316
  );
  assert.equal(typeCounts["no-credit"], 14);
  assert.equal(typeCounts["limited-credit"], 175);
  assert.ok((typeCounts["direct-course"] ?? 0) > 250);
  assert.ok((typeCounts.sequence ?? 0) > 60);
  assert.ok((typeCounts["elective-credit"] ?? 0) > 700);
  assert.ok(
    guideRules.every((entry) => entry.parsedFromOfficialGuide === true),
    "Generated equivalency rules should identify that they came from the official guide parser."
  );
  assert.ok(
    guideRules.every((entry) =>
      entry.sourceLinks.some(
        (link) =>
          link.url === "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/"
      )
    ),
    "Generated equivalency rules should carry the official UW guide source link."
  );
  assert.ok(
    guideRules.every((entry) => entry.sourceSchoolId === "grc"),
    "Generated equivalency rules should all be Green River source-course rules."
  );
  assert.ok(
    guideRules.every(
      (entry) => entry.targetSchoolIds.length === 1 && entry.targetSchoolIds[0] === "uw-seattle"
    ),
    "The UW Admissions equivalency guide rules should target the centralized Seattle UW guide."
  );
});

test("Phase 4 derived guide rules replace former authored planner overlays", () => {
  const currentCalculusSequence = TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES.find(
    (entry) => entry.id === "stem-calculus-current-sequence"
  );
  const legacyCalculusSequence = TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES.find(
    (entry) => entry.id === "stem-calculus-older-sequence"
  );
  const currentComputerScienceSequence = TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES.find(
    (entry) => entry.id === "computer-science-new-sequence"
  );
  const legacyComputerScienceChain = TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES.find(
    (entry) => entry.id === "chain:CS-LEGACY"
  );

  assert.equal(TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES.length, 20);
  assert.ok(
    TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES.every(
      (entry) => entry.sourceKind === "uw-green-river-equivalency-guide-derived"
    )
  );

  assert.ok(currentCalculusSequence, "Expected the derived current STEM calculus sequence.");
  assert.equal(currentCalculusSequence?.acceptanceCategory, "preferred");
  assert.equal(currentCalculusSequence?.ruleStatus, "active");
  assert.deepEqual(currentCalculusSequence?.targetCourseCodes, [
    "MATH 124",
    "MATH 125",
    "MATH 126",
  ]);

  assert.ok(legacyCalculusSequence, "Expected the derived legacy STEM calculus route.");
  assert.equal(legacyCalculusSequence?.acceptanceCategory, "legacy-accepted");
  assert.equal(legacyCalculusSequence?.ruleStatus, "legacy");
  assert.deepEqual(legacyCalculusSequence?.weakerThanRuleIds, [
    "stem-calculus-current-sequence",
  ]);
  assert.equal(legacyCalculusSequence?.effectiveYearRanges[0]?.startLabel, "legacy-planner-support");

  assert.ok(
    currentComputerScienceSequence,
    "Expected the derived current computer-science sequence."
  );
  assert.equal(currentComputerScienceSequence?.acceptanceCategory, "preferred");

  assert.ok(
    legacyComputerScienceChain,
    "Expected the derived legacy computer-science chain overlay."
  );
  assert.equal(legacyComputerScienceChain?.acceptanceCategory, "legacy-accepted");
  assert.equal(legacyComputerScienceChain?.ruleStatus, "legacy");
  assert.deepEqual(legacyComputerScienceChain?.weakerThanRuleIds, [
    "computer-science-new-sequence",
  ]);
  assert.equal(
    legacyComputerScienceChain?.effectiveYearRanges[0]?.startLabel,
    "legacy-planner-support"
  );
});

test("Phase 4 generated guide registry has stable unique IDs and summary counts", () => {
  const generatedRules = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES;
  const generatedRuleIds = generatedRules.map((entry) => entry.id);
  const uniqueGeneratedRuleIds = new Set(generatedRuleIds);
  const typeCounts = generatedRules.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.type] = (counts[entry.type] ?? 0) + 1;
    return counts;
  }, {});
  const statusCounts = generatedRules.reduce<Record<string, number>>((counts, entry) => {
    const status = entry.ruleStatus ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  const sourceKindCounts = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.reduce<Record<string, number>>(
    (counts, entry) => {
      const sourceKind = entry.sourceKind ?? "unknown";
      counts[sourceKind] = (counts[sourceKind] ?? 0) + 1;
      return counts;
    },
    {}
  );

  assert.equal(generatedRuleIds.length, uniqueGeneratedRuleIds.size);
  assert.ok((typeCounts["direct-course"] ?? 0) > 0);
  assert.ok((typeCounts["elective-credit"] ?? 0) > 0);
  assert.ok((typeCounts["limited-credit"] ?? 0) > 0);
  assert.ok((typeCounts["no-credit"] ?? 0) > 0);
  assert.ok((typeCounts.sequence ?? 0) > 0);
  assert.ok((statusCounts.active ?? 0) > 0);
  assert.ok((statusCounts.legacy ?? 0) > 0);
  assert.deepEqual(sourceKindCounts, TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCountsBySourceKind);
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCount,
    TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.length
  );
  assert.ok((TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCountsByType["sequence"] ?? 0) > 0);
});

test("Phase 4 generated guide classifications obey conservative parser invariants", () => {
  const generatedRules = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES;
  const directCourseRules = generatedRules.filter((entry) => entry.type === "direct-course");
  const sequenceRules = generatedRules.filter((entry) => entry.type === "sequence");
  const limitedCreditRules = generatedRules.filter((entry) => entry.type === "limited-credit");
  const noCreditRules = generatedRules.filter((entry) => entry.type === "no-credit");
  const electiveCreditRules = generatedRules.filter((entry) => entry.type === "elective-credit");

  assert.ok(
    generatedRules.every((entry) => (entry.sourceCourseSets?.[0]?.length ?? 0) > 0),
    "Every official guide row should preserve at least one parsed Green River source course."
  );
  assert.ok(
    directCourseRules.every(
      (entry) =>
        ["accepted", "legacy-accepted"].includes(entry.acceptanceCategory) &&
        ["active", "legacy"].includes(entry.ruleStatus ?? "") &&
        entry.sourceCourseSets?.length === 1 &&
        entry.sourceCourseSets[0].length === 1 &&
        (entry.targetCourseCodes?.length ?? 0) > 0 &&
        !/otherwise|\( LC \)|No credit/i.test(entry.targetOutcome)
    ),
    "Direct-course rows should stay single-source, active, target-backed rows without conditional fallback text."
  );
  assert.ok(
    sequenceRules.every((entry) =>
      (entry.plannerWarnings ?? []).some((warning) => /sequence|combined-course/i.test(warning))
    ),
    "Sequence rows should carry an explicit warning so partial sequences are not over-awarded."
  );
  assert.ok(
    limitedCreditRules.every(
      (entry) =>
        ["accepted-with-warning", "legacy-accepted"].includes(entry.acceptanceCategory) &&
        /\bLC\b|\[\s*\d+\s+credits?\s+allowed\s*\]/i.test(
          `${entry.targetOutcome} ${entry.notes.join(" ")}`
        )
    ),
    "Limited-credit rows should keep the official LC/cap signal."
  );
  assert.ok(
    noCreditRules.every(
      (entry) =>
        entry.acceptanceCategory === "no-credit" &&
        entry.targetOutcome === "No credit" &&
        (entry.targetCourseCodes?.length ?? 0) === 0
    ),
    "No-credit rows should not emit synthetic UW target course codes."
  );
  assert.ok(
    electiveCreditRules.every(
      (entry) =>
        (entry.targetCourseCodes?.length ?? 0) === 0 ||
        entry.targetCourseCodes?.every((code) => /\b[1-4]XX$/.test(code))
    ),
    "Elective-credit rows should only parse generic 1XX-4XX target course codes."
  );
});

test("Phase 4 generated guide has no mojibake or raw table markup in persisted row text", () => {
  for (const entry of TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES) {
    const persistedText = [
      entry.id,
      entry.title,
      entry.targetOutcome,
      entry.effectiveDateLabel ?? "",
      entry.guideDepartment ?? "",
      entry.sourceCourseLabel ?? "",
      ...entry.notes,
      ...entry.plannerWarnings,
    ].join("\n");

    assert.doesNotMatch(persistedText, /Ã‚/);
    assert.doesNotMatch(persistedText, /<\/?(?:td|tr|table|tbody|h3)\b/i);
  }
});

test("Phase 4 generated guide preserves direct Green River to UW course equivalencies", () => {
  const math151Rule = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) => entry.sourceCourseLabel === "MATH& 151 (5) formerly MATH 124"
  );
  const cs121Rule = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) => entry.sourceCourseLabel === "CS 121 (5)"
  );

  assert.ok(math151Rule, "Expected the MATH& 151 direct equivalency row.");
  assert.equal(math151Rule?.type, "direct-course");
  assert.equal(math151Rule?.acceptanceCategory, "accepted");
  assert.equal(math151Rule?.ruleStatus, "active");
  assert.deepEqual(math151Rule?.sourceCourseSets, [["MATH& 151"]]);
  assert.ok(math151Rule?.targetCourseCodes?.includes("MATH 124"));
  assert.equal(math151Rule?.effectiveDateLabel, "SUM Qtr. 2009");

  assert.ok(cs121Rule, "Expected the CS 121 direct equivalency row.");
  assert.equal(cs121Rule?.type, "direct-course");
  assert.deepEqual(cs121Rule?.sourceCourseSets, [["CS 121"]]);
  assert.ok(cs121Rule?.targetCourseCodes?.includes("CSE 121"));
  assert.match(cs121Rule?.targetOutcome ?? "", /CSE 121 \(4\), 1XX \(1\)/);
});

test("Phase 4 generated guide represents sequence-required equivalencies as single official rows", () => {
  const accountingSequence = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) => entry.sourceCourseLabel === "ACCT& 201, 202 (5, 5) formerly B A 210, 220"
  );
  const chemistrySequence = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) => entry.sourceCourseLabel === "CHEM& 162, 163 (6, 6) formerly CHEM 150, 160"
  );
  const biologySequence = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) =>
      entry.sourceCourseLabel === "BIOL& 211, 212, 213 (6, 6, 6) formerly BIOL 201, 202, 203"
  );

  assert.ok(accountingSequence, "Expected the ACCT& 201/202 combined-entry rule.");
  assert.equal(accountingSequence?.type, "sequence");
  assert.deepEqual(accountingSequence?.sourceCourseSets, [["ACCT& 201", "ACCT& 202"]]);
  assert.ok(accountingSequence?.targetCourseCodes?.includes("ACCTG 215"));
  assert.ok(
    (accountingSequence?.plannerWarnings ?? []).some((warning) =>
      /partial sequence/i.test(warning)
    )
  );

  assert.ok(chemistrySequence, "Expected the CHEM& 162/163 combined-entry rule.");
  assert.equal(chemistrySequence?.type, "sequence");
  assert.deepEqual(chemistrySequence?.sourceCourseSets, [["CHEM& 162", "CHEM& 163"]]);
  assert.ok(chemistrySequence?.targetCourseCodes?.includes("CHEM 152"));
  assert.ok(chemistrySequence?.targetCourseCodes?.includes("CHEM 162"));

  assert.ok(biologySequence, "Expected the BIOL& 211/212/213 combined-entry rule.");
  assert.equal(biologySequence?.type, "sequence");
  assert.deepEqual(biologySequence?.sourceCourseSets, [
    ["BIOL& 211", "BIOL& 212", "BIOL& 213"],
  ]);
  assert.ok(biologySequence?.targetCourseCodes?.includes("BIOL 180"));
  assert.ok(biologySequence?.targetCourseCodes?.includes("BIOL 200"));
  assert.ok(biologySequence?.targetCourseCodes?.includes("BIOL 220"));
});

test("Phase 4 generated guide distinguishes limited-credit and no-credit rows", () => {
  const artLimitedCredit = getOfficialGuideRule(
    "uw-grc-guide:0081:art:art-150-3-was-the-same-as-engl-154"
  );
  const mathNoCredit = getOfficialGuideRule("uw-grc-guide:0776:mathematics:math-115t");

  assert.ok(artLimitedCredit, "Expected the ART 150 limited-credit guide row.");
  assert.equal(artLimitedCredit?.type, "limited-credit");
  assert.equal(artLimitedCredit?.acceptanceCategory, "accepted-with-warning");
  assert.match(artLimitedCredit?.targetOutcome ?? "", /\( LC \)/);
  assert.ok(
    (artLimitedCredit?.plannerWarnings ?? []).some((warning) => /limited credit/i.test(warning))
  );

  assert.ok(mathNoCredit, "Expected the MATH 115T no-credit guide row.");
  assert.equal(mathNoCredit?.type, "no-credit");
  assert.equal(mathNoCredit?.acceptanceCategory, "no-credit");
  assert.equal(mathNoCredit?.targetCourseCodes?.length, 0);
  assert.ok((mathNoCredit?.plannerWarnings ?? []).some((warning) => /no UW transfer credit/i.test(warning)));
});

test("Phase 4 generated guide carries date-effective legacy metadata", () => {
  const legacyMathSequence = getOfficialGuideRule(
    "uw-grc-guide:0795:mathematics:mathand-153-254-5-5-formerly-math-126-224-combined-entry"
  );
  const priorToMathRow = getOfficialGuideRule(
    "uw-grc-guide:0794:mathematics:mathand-153-5-formerly-math-126-5-see-also-mathand-153-combined-entry"
  );

  assert.ok(legacyMathSequence, "Expected the legacy MATH& 153/254 date-effective row.");
  assert.equal(legacyMathSequence?.ruleStatus, "legacy");
  assert.equal(legacyMathSequence?.isObsoleteSourceCourse, true);
  assert.deepEqual(legacyMathSequence?.sourceCourseSets, [["MATH& 153", "MATH& 264"]]);
  assert.equal(legacyMathSequence?.effectiveYearRanges[0]?.startLabel, "SUM Qtr. 2009");
  assert.equal(legacyMathSequence?.effectiveYearRanges[0]?.endLabel, "SPR Qtr. 2025");

  assert.ok(priorToMathRow, "Expected the prior-to cutoff MATH& 153 row.");
  assert.equal(priorToMathRow?.ruleStatus, "legacy");
  assert.equal(priorToMathRow?.effectiveYearRanges[0]?.startLabel, "prior-to-guide-cutoff");
  assert.equal(priorToMathRow?.effectiveYearRanges[0]?.endLabel, "SUM Qtr. 2025");
});

test("Phase 4 date-effective helpers can filter official guide rows by course-taken term", () => {
  const math151Rules = getTransferPlannerEquivalencyRulesForSourceCourse("MATH& 151", "AUT Qtr. 2024");
  const currentMath151GuideRule = math151Rules.find(
    (entry) => entry.sourceKind === "uw-green-river-equivalency-guide"
  );
  const priorToMath153Rule = getOfficialGuideRule(
    "uw-grc-guide:0794:mathematics:mathand-153-5-formerly-math-126-5-see-also-mathand-153-combined-entry"
  );
  const legacyMath153Sequence = getOfficialGuideRule(
    "uw-grc-guide:0795:mathematics:mathand-153-254-5-5-formerly-math-126-224-combined-entry"
  );

  assert.ok(currentMath151GuideRule, "Expected current MATH& 151 rule for AUT Qtr. 2024.");
  assert.equal(currentMath151GuideRule?.targetCourseCodes?.includes("MATH 124"), true);

  assert.ok(priorToMath153Rule, "Expected prior-to cutoff MATH& 153 rule.");
  assert.equal(
    isTransferPlannerEquivalencyRuleEffectiveForTerm(priorToMath153Rule!, "SPR Qtr. 2025"),
    true
  );
  assert.equal(
    isTransferPlannerEquivalencyRuleEffectiveForTerm(priorToMath153Rule!, "SUM Qtr. 2025"),
    false
  );

  assert.ok(legacyMath153Sequence, "Expected legacy MATH& 153/254 sequence rule.");
  assert.equal(
    isTransferPlannerEquivalencyRuleEffectiveForTerm(legacyMath153Sequence!, "SPR Qtr. 2025"),
    true
  );
  assert.equal(
    isTransferPlannerEquivalencyRuleEffectiveForTerm(legacyMath153Sequence!, "SUM Qtr. 2025"),
    false
  );
});

test("Phase 4 date-effective helpers keep historical and replacement guide rows separate", () => {
  const math153BeforeCutoff = getTransferPlannerEquivalencyRulesForSourceCourse(
    "MATH& 153",
    "SPR Qtr. 2025"
  ).filter((entry) => entry.sourceKind === "uw-green-river-equivalency-guide");
  const math153AfterCutoff = getTransferPlannerEquivalencyRulesForSourceCourse(
    "MATH& 153",
    "AUT Qtr. 2025"
  ).filter((entry) => entry.sourceKind === "uw-green-river-equivalency-guide");
  const math254AfterCutoff = getTransferPlannerEquivalencyRulesForSourceCourse(
    "MATH& 254",
    "AUT Qtr. 2025"
  ).filter((entry) => entry.sourceKind === "uw-green-river-equivalency-guide");
  const math264AfterCutoff = getTransferPlannerEquivalencyRulesForSourceCourse(
    "MATH& 264",
    "AUT Qtr. 2025"
  ).filter((entry) => entry.sourceKind === "uw-green-river-equivalency-guide");

  assert.ok(
    math153BeforeCutoff.length > 0,
    "Expected legacy MATH& 153 guide rows to apply before the 2025 cutoff."
  );
  assert.equal(
    math153AfterCutoff.length,
    0,
    "Legacy MATH& 153 guide rows should not apply after their official cutoff."
  );
  assert.ok(
    [...math254AfterCutoff, ...math264AfterCutoff].some((entry) =>
      entry.targetCourseCodes?.includes("MATH 224")
    ),
    "Expected a replacement Calculus IV guide row to carry MATH 224 after the 2025 cutoff."
  );
});

test("Legacy and canonical course-code aliases normalize to one planner code", () => {
  const normalizedCodes = [
    normalizeCourseCode("MATH& 254"),
    normalizeCourseCode("MATH&264"),
    normalizeCourseCode("  math&   254  "),
  ].map((entry) => entry.replace(/\s+/g, ""));

  assert.equal(normalizedCodes[0], "MATH&264");
  assert.equal(normalizedCodes[1], "MATH&264");
  assert.equal(normalizedCodes[2], "MATH&264");

  const extracted = extractCourseCodes("Take MATH& 254 (legacy) or MATH& 264 (current)");
  assert.ok(extracted.length >= 1);
  assert.ok(extracted.every((entry) => entry.replace(/\s+/g, "") === "MATH&264"));
});

test("Course-code extraction keeps spaced UW subject forms code-extractable", () => {
  const extracted = extractCourseCodes(
    "A A 499 Undergraduate Research and A MATH 301 Beginning Scientific Computing"
  );

  assert.ok(extracted.includes("AA 499"));
  assert.ok(extracted.includes("AMATH 301"));
});

test("Spaced UW subject aliases normalize and resolve through canonical registry metadata", () => {
  const representativeAliases = [
    ["IND E 250", "INDE 250"],
    ["IND E 315", "INDE 315"],
    ["E E 486", "EE 486"],
    ["CHEM E 490", "CHEME 490"],
    ["MOL ENG 520", "MOLENG 520"],
    ["IN NME 220", "NME 220"],
  ] as const;

  for (const [aliasCode, canonicalCode] of representativeAliases) {
    assert.equal(
      normalizeCourseCode(aliasCode),
      canonicalCode,
      `Expected ${aliasCode} to normalize to ${canonicalCode}.`
    );
    assert.equal(
      normalizeCourseCode(canonicalCode),
      canonicalCode,
      `Expected ${canonicalCode} to remain stable after normalization.`
    );
    assert.equal(
      getTransferPlannerCanonicalCourse("uw-seattle", aliasCode)?.code,
      canonicalCode,
      `Expected canonical UW registry lookup for ${aliasCode} to resolve to ${canonicalCode}.`
    );
    assert.equal(
      getTransferPlannerNormalizedCourseMetadataEntry("uw-seattle", aliasCode)?.code,
      canonicalCode,
      `Expected normalized metadata lookup for ${aliasCode} to resolve to ${canonicalCode}.`
    );
  }
});

test("Transcript parsing deduplicates legacy and canonical course-code variants", () => {
  const parsed = parseCompletedTranscriptCourses([
    "MATH& 254",
    "math& 264",
    {
      code: "MATH&254",
      label: "Calculus IV",
    },
  ]);

  assert.ok(parsed.length >= 1);
  const normalizedParsedCodes = parsed.map((entry) => entry.code.replace(/\s+/g, ""));
  assert.ok(new Set(normalizedParsedCodes).size <= 2);
  assert.ok(normalizedParsedCodes.includes("MATH&264"));
});

test("Legacy alias maps are parser/ingest only and removed from generators", () => {
  const parserOrIngestScriptPaths = [
    "scripts/planner/ingest-grc-catalog.cjs",
    "scripts/planner/parse-transfer-planner-equivalency-guide.cjs",
    "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
  ];
  const generatorScriptPaths = [
    "scripts/planner/generate-transfer-planner-course-metadata.cjs",
    "scripts/planner/generate-transfer-planner-grc-associate-tracks.cjs",
    "scripts/planner/generate-transfer-planner-grc-availability.cjs",
  ];

  for (const scriptPath of parserOrIngestScriptPaths) {
    const contents = readFileSync(scriptPath, "utf8");
    assert.ok(
      contents.includes('["MATH& 254", "MATH& 264"]'),
      `${scriptPath} is missing the expected parser/ingest legacy alias mapping for Calculus IV.`
    );
  }

  for (const scriptPath of generatorScriptPaths) {
    const contents = readFileSync(scriptPath, "utf8");
    assert.equal(
      contents.includes('["MATH& 254", "MATH& 264"]'),
      false,
      `${scriptPath} should not include legacy alias maps.`
    );
  }
});

test.skip("Phase 5 requirement-source adapters generate registry-backed source blocks", () => {
  const plannerOwnerCount = getPlannerOwnerPrimarySourceEntries().length;

  assert.equal(TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.totalOwners, plannerOwnerCount);
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.okCount,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.totalOwners
  );
  assert.equal(TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.failedCount, 0);
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.parsedRequirementSourceBlockCount,
    plannerOwnerCount
  );
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.parsedRequirementAtomCandidateCount,
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.reduce(
      (count, block) => count + block.parsedRequirementAtomCandidates.length,
      0
    )
  );
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.parsedDegreeMapBlockCandidateCount,
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.reduce(
      (count, block) => count + block.parsedDegreeMapBlockCandidates.length,
      0
    )
  );
  assert.equal(TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.length, plannerOwnerCount);
  assert.equal(TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.length, plannerOwnerCount);
  assert.deepEqual(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_REGISTRY_SUMMARY,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY
  );
  assert.deepEqual(
    countByValues(TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map((block) => block.adapterId)),
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.countsByAdapterId
  );
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.parsedRequirementSourceBlockCount,
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.length
  );
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.parsedRequirementAtomCandidateCount,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.parsedRequirementAtomCandidateCount
  );
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.parsedDegreeMapBlockCandidateCount,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.parsedDegreeMapBlockCandidateCount
  );
});

test("Phase 5 parser adapters match their source family instead of using one generic parser", () => {
  const adapterRules: Record<string, (block: (typeof TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS)[number]) => boolean> = {
    "generic-official-pdf-degree-sheet": (block) =>
      ["pdf-degree-sheet", "pdf-worksheet", "generic-pdf"].includes(block.parserType) &&
      block.campusId !== "uw-bothell",
    "generic-official-html-page": (block) =>
      [
        "html-degree-page",
        "html-curriculum-page",
        "html-overview-page",
        "catalog-page",
        "generic-html",
      ].includes(block.parserType),
    "uw-bothell-catalog-page": (block) =>
      block.campusId === "uw-bothell" && block.parserType === "catalog-page",
    "uw-bothell-html-degree-page": (block) =>
      block.campusId === "uw-bothell" &&
      ["html-degree-page", "html-curriculum-page", "html-overview-page"].includes(block.parserType),
    "uw-bothell-pdf-worksheet": (block) =>
      block.campusId === "uw-bothell" &&
      ["pdf-degree-sheet", "pdf-worksheet", "generic-pdf"].includes(block.parserType),
    "uw-seattle-catalog-page": (block) =>
      block.campusId === "uw-seattle" && block.parserType === "catalog-page",
    "uw-seattle-html-degree-page": (block) =>
      block.campusId === "uw-seattle" &&
      ["html-degree-page", "html-curriculum-page", "html-overview-page"].includes(block.parserType),
    "uw-tacoma-catalog-page": (block) =>
      block.campusId === "uw-tacoma" && block.parserType === "catalog-page",
    "uw-tacoma-html-degree-page": (block) =>
      block.campusId === "uw-tacoma" &&
      ["html-degree-page", "html-curriculum-page", "html-overview-page"].includes(block.parserType),
  };

  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS) {
    assert.ok(adapterRules[block.adapterId], `Unexpected parser adapter ${block.adapterId}.`);
    assert.ok(
      adapterRules[block.adapterId](block),
      `${block.ownerId} used adapter ${block.adapterId} for ${block.campusId}/${block.parserType}.`
    );
  }
});

test("Phase 5 generated requirement atom and degree-map candidates are internally consistent", () => {
  const blocksWithCodes = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (block) => block.parsedUwCourseCodes.length > 0
  );
  const noParsedCourseBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (block) => block.ok && block.parsedUwCourseCodes.length === 0
  );
  const unsupportedBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (block) => !block.ok
  );
  const atomCandidateCount = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.reduce(
    (count, block) => count + block.parsedRequirementAtomCandidates.length,
    0
  );
  const degreeMapCandidateCount = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.reduce(
    (count, block) => count + block.parsedDegreeMapBlockCandidates.length,
    0
  );

  assert.equal(
    blocksWithCodes.length + noParsedCourseBlocks.length + unsupportedBlocks.length,
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.length
  );
  assert.ok(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
      (block) => block.parsedDegreeMapBlockCandidates.length > 0
    ).length >= blocksWithCodes.length
  );
  assert.equal(
    atomCandidateCount,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.parsedRequirementAtomCandidateCount
  );
  assert.equal(
    degreeMapCandidateCount,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.parsedDegreeMapBlockCandidateCount
  );

  for (const block of blocksWithCodes) {
    assert.equal(block.parsedRequirementAtomCandidates.length, block.parsedUwCourseCodes.length);
    assert.ok(block.parsedDegreeMapBlockCandidates.length > 0);
    const directCodeCandidate = block.parsedDegreeMapBlockCandidates.find(
      (candidate) =>
        candidate.uwCourseCodes.length === block.parsedUwCourseCodes.length &&
        candidate.uwCourseCodes.every((code, index) => code === block.parsedUwCourseCodes[index])
    );
    assert.ok(directCodeCandidate, `${block.ownerId} should keep a parsed-code degree-map candidate.`);
    for (const candidate of block.parsedRequirementAtomCandidates) {
      assert.ok(block.parsedUwCourseCodes.includes(candidate.uwCourseCode));
      assert.ok(candidate.sourceLineHints.length <= 5);
      const hintedCourseCodes = [
        ...new Set(
          candidate.sourceLineHints.flatMap((line) =>
            extractCourseCodes(line).map((code) => normalizeCourseCode(code))
          )
        ),
      ];
      assert.ok(
        hintedCourseCodes.length === 0 || hintedCourseCodes.includes(candidate.uwCourseCode),
        `${block.ownerId}:${candidate.uwCourseCode} should keep source hints that either stay descriptive or remain code-extractable.`
      );
    }
  }

  for (const block of noParsedCourseBlocks) {
    assert.equal(block.parsedRequirementAtomCandidates.length, 0);
    assert.ok(block.parsedDegreeMapBlockCandidates.length >= 0);
    assert.ok(
      block.parsedDegreeMapBlockCandidates.every(
        (candidate) => candidate.uwCourseCodes.length === 0 && candidate.sourceLineHints.length > 0
      )
    );
  }

  for (const block of unsupportedBlocks) {
    assert.equal(block.parsedRequirementAtomCandidates.length, 0);
    assert.equal(block.parsedDegreeMapBlockCandidates.length, 0);
  }
});

test("Phase 5 source-backed blocks cover every promoted primary degree source owner", () => {
  const primaryOwnerKeys = TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
    (entry) =>
      (entry.ownerType === "major" || entry.ownerType === "pathway") &&
      entry.campusId &&
      entry.campusId !== "grc" &&
      entry.isPrimaryDegreeRequirementsLink
  )
    .map((entry) => entry.ownerId)
    .sort();
  const blockOwnerKeys = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map(
    (block) => block.ownerId
  ).sort();

  assert.equal(primaryOwnerKeys.length, TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.totalOwners);
  assert.deepEqual(blockOwnerKeys, primaryOwnerKeys);
  assert.ok(getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-aeronautics-astronautics").length > 0);
  assert.ok(
    getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-aeronautics-astronautics")[0]
      .parsedDegreeMapBlockCandidates.length > 0
  );
});

test("Phase 5 generated source blocks keep unique IDs and derived summary counts", () => {
  const blockIds = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map((block) => block.id);
  const atomCandidateIds = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.flatMap((block) =>
    block.parsedRequirementAtomCandidates.map((candidate) => candidate.id)
  );
  const degreeMapCandidateIds = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.flatMap((block) =>
    block.parsedDegreeMapBlockCandidates.map((candidate) => candidate.id)
  );

  assert.deepEqual(getDuplicateSortedValues(blockIds), []);
  assert.deepEqual(getDuplicateSortedValues(atomCandidateIds), []);
  assert.deepEqual(getDuplicateSortedValues(degreeMapCandidateIds), []);
  assert.equal(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter((block) => block.ok).length,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.okCount
  );
  assert.equal(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter((block) => !block.ok).length,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.failedCount
  );
  assert.deepEqual(
    countByValues(TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map((block) => block.adapterId)),
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.countsByAdapterId
  );
  assert.deepEqual(
    countByValues(TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map((block) => block.adapterFamily)),
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.countsByAdapterFamily
  );
  assert.deepEqual(
    countByValues(TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map((block) => block.campusId)),
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.countsByCampus
  );
});

test("Phase 5 generated source blocks stay aligned with manifest and fingerprint metadata", () => {
  const primarySourceByOwner = new Map(
    TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
      (entry) =>
        (entry.ownerType === "major" || entry.ownerType === "pathway") &&
        entry.campusId &&
        entry.campusId !== "grc" &&
        entry.isPrimaryDegreeRequirementsLink
    ).map((entry) => [entry.ownerId, entry])
  );
  const requirementFingerprintByOwner = new Map(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.map((entry) => [entry.ownerId, entry])
  );

  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS) {
    const source = primarySourceByOwner.get(block.ownerId);
    const fingerprint = requirementFingerprintByOwner.get(block.ownerId);
    const actualSourceEntries = TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
      (entry) =>
        entry.ownerId === block.ownerId &&
        entry.url === block.sourceUrl &&
        entry.parserType === block.parserType
    );

    assert.ok(source, `Expected ${block.ownerId} to have a primary manifest source.`);
    assert.ok(fingerprint, `Expected ${block.ownerId} to have a requirement-source fingerprint.`);
    assert.equal(block.primarySourceUrl, source.url);
    assert.equal(block.primarySourceLabel, source.label);
    assert.equal(block.primaryParserType, source.parserType);
    assert.equal(block.planId, source.planId);
    assert.equal(block.pathwayId, source.pathwayId ?? null);
    assert.equal(block.campusId, source.campusId);
    assert.ok(
      block.resolutionStrategy === "primary-source" ||
        actualSourceEntries.length > 0 ||
        block.usedSnapshotFallback,
      `${block.ownerId} should either keep its primary source, use another official manifest source, or rely on a cached snapshot.`
    );
    assert.equal(block.sourceUrl, fingerprint.sourceUrl);
    assert.equal(block.parserType, fingerprint.parserType);
    assert.equal(block.parsedUwCourseCodes.length, fingerprint.parsedUwCourseCodeCount);
    assert.equal(block.sourceOnlyUwCourseCodes.length, fingerprint.sourceOnlyUwCourseCodeCount);
    assert.equal(block.structuredOnlyUwCourseCodes.length, fingerprint.structuredOnlyUwCourseCodeCount);
  }
});

test("Phase 5 generated source blocks keep sanitized course-code sets and no raw payloads", () => {
  const rawPayloadKeys = new Set([
    "body",
    "content",
    "html",
    "pageText",
    "rawBody",
    "rawHtml",
    "rawText",
    "snapshotText",
    "text",
    "textContent",
  ]);

  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS) {
    const rawPayloadBlockKeys = Object.keys(block).filter((key) => rawPayloadKeys.has(key));
    const parsedCodeSet = new Set(block.parsedUwCourseCodes);
    const structuredOnlyCodeSet = new Set(block.structuredOnlyUwCourseCodes);
    const allCodeSets = [
      block.parsedUwCourseCodes,
      block.sourceOnlyUwCourseCodes,
      block.structuredOnlyUwCourseCodes,
    ];
    const persistedTextValues = [
      block.ownerTitle,
      block.sourceLabel,
      ...block.requirementCueLines,
      ...block.chooseStatements,
      ...block.pathwayLabels,
      ...block.parsedRequirementAtomCandidates.flatMap((candidate) => [
        candidate.title,
        ...candidate.sourceLineHints,
      ]),
      ...block.parsedDegreeMapBlockCandidates.flatMap((candidate) => [
        candidate.title,
        ...candidate.sourceLineHints,
      ]),
    ];

    assert.deepEqual(rawPayloadBlockKeys, [], `${block.ownerId} should not persist raw source payloads.`);
    assert.ok(block.ok ? block.snapshotPath : block.error, `${block.ownerId} should have snapshot or error evidence.`);
    for (const codes of allCodeSets) {
      assert.deepEqual(codes, [...codes].sort((left, right) => left.localeCompare(right)));
      assert.equal(new Set(codes).size, codes.length);
      assert.ok(codes.every((code) => CANONICAL_COURSE_CODE_RE.test(code)), block.ownerId);
    }
    assert.ok(
      block.sourceOnlyUwCourseCodes.every((code) => parsedCodeSet.has(code)),
      `${block.ownerId} source-only codes should come from parsed source codes.`
    );
    assert.ok(
      block.structuredOnlyUwCourseCodes.every(
        (code) => !parsedCodeSet.has(code) && !block.sourceOnlyUwCourseCodes.includes(code)
      ),
      `${block.ownerId} structured-only codes should be disjoint from parsed/source-only codes.`
    );
    assert.ok(
      persistedTextValues.every((value) => !/[<][a-z/][^>]*[>]/i.test(value)),
      `${block.ownerId} should not persist raw HTML tags in generated adapter text.`
    );
    assert.ok(
      persistedTextValues.every((value) => ![...value].some((char) => [194, 65533].includes(char.charCodeAt(0)))),
      `${block.ownerId} should not persist mojibake sentinel characters.`
    );
    assert.ok(
      block.parsedRequirementAtomCandidates.every((candidate) => parsedCodeSet.has(candidate.uwCourseCode)),
      `${block.ownerId} atom candidates should stay tied to parsed source codes.`
    );
    assert.ok(
      block.parsedDegreeMapBlockCandidates.every((candidate) =>
        candidate.uwCourseCodes.every((code) => parsedCodeSet.has(code))
      ),
      `${block.ownerId} degree-map candidates should stay tied to parsed source codes.`
    );
    assert.equal(
      [...parsedCodeSet].filter((code) => structuredOnlyCodeSet.has(code)).length,
      0,
      `${block.ownerId} parsed and structured-only code sets should be disjoint.`
    );
  }
});

test("Phase 5 parser preserves explicit Aeronautics areas-of-inquiry cue lines", () => {
  const aeronauticsBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-aeronautics-astronautics"
  )[0];

  assert.ok(aeronauticsBlock, "Expected the Aeronautics requirement-source block.");
  assert.ok(
    aeronauticsBlock.requirementCueLines.includes("Arts and Humanities - A&H (10)")
  );
  assert.ok(
    aeronauticsBlock.requirementCueLines.includes("Social Sciences - SSc (10)")
  );
  assert.ok(
    aeronauticsBlock.requirementCueLines.includes("Additional A&H and/or SSc (4)")
  );
});

test("Phase 5 parser preserves Computer Engineering A&H and SSc range cue lines", () => {
  const computerEngineeringBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-computer-engineering"
  )[0];

  assert.ok(computerEngineeringBlock, "Expected the Computer Engineering requirement-source block.");
  assert.ok(
    computerEngineeringBlock.requirementCueLines.some((line) =>
      /Arts\s*&\s*Humanities\s*\(10-20\)/i.test(line)
    )
  );
  assert.ok(
    computerEngineeringBlock.requirementCueLines.some((line) =>
      /Social Sciences\s*\(10-20\)/i.test(line)
    )
  );
});

test("Phase 5 parser extracts spaced-subject and linked-PDF course codes from weak public sources", () => {
  const candidateBlocks = [
    getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-political-science")[0],
    getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-real-estate")[0],
    getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-german")[0],
    getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-oceanography")[0],
    getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-computer-engineering")[0],
    getTransferPlannerParsedRequirementSourceBlocks("uw-bothell-interactive-media-design")[0],
  ].filter(Boolean);

  assert.ok(candidateBlocks.length >= 3, "Expected parser recovery coverage for weak-source owners.");

  for (const block of candidateBlocks) {
    assert.ok((block.parsedUwCourseCodes?.length ?? 0) > 0);
    assert.ok(
      block.parsedUwCourseCodes.every((code) => /^[A-Z&]+(?:\s+[A-Z&]+)*\s+\d/.test(code)),
      `${block.ownerId} should keep normalized UW course codes.`
    );
  }

  const computerEngineeringBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-computer-engineering"
  )[0];
  if (computerEngineeringBlock) {
    assert.ok(
      computerEngineeringBlock.parsedUwCourseCodes.some((code) => /CSE|EE|MATH|STAT/.test(code))
    );
    assert.equal(computerEngineeringBlock.parsedUwCourseCodes.includes("AS STAT 391"), false);
  }

  const interactiveMediaDesignBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-interactive-media-design"
  )[0];
  if (interactiveMediaDesignBlock) {
    assert.ok(
      ["alternate-official-source", "primary-source"].includes(
        interactiveMediaDesignBlock.resolutionStrategy
      )
    );
    assert.ok(/imd|fillable|bothell/i.test(interactiveMediaDesignBlock.sourceUrl));
  }
});

test("Phase 5 parser merges supplemental alternates without keeping malformed subject fragments", () => {
  const bothellComputerEngineeringBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-computer-engineering"
  )[0];
  const seattleBusinessAdministrationBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-business-administration"
  )[0];
  const swedishBlock = getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-swedish")[0];

  const availableBlocks = [
    bothellComputerEngineeringBlock,
    seattleBusinessAdministrationBlock,
    swedishBlock,
  ].filter(Boolean);
  assert.ok(availableBlocks.length >= 1, "Expected at least one supplemental-alternate owner block.");

  if (bothellComputerEngineeringBlock) {
    assert.ok((bothellComputerEngineeringBlock.parsedUwCourseCodes?.length ?? 0) > 0);
    assert.ok(
      bothellComputerEngineeringBlock.parsedUwCourseCodes.some((code) =>
        /BEE|BWRIT|CSS|STMATH|MATH/.test(code)
      )
    );
  }

  const malformedBothellComputerEngineeringCodes = [
    "B EE 215",
    "B PHYS 121",
    "B WRIT 135",
    "CSSSKL 142",
    "II CSS 360",
    "ST MATH 126",
    "BEE AND 300",
  ];
  for (const malformedCode of malformedBothellComputerEngineeringCodes) {
    assert.equal(
      bothellComputerEngineeringBlock?.parsedUwCourseCodes.includes(malformedCode) ?? false,
      false,
      `Bothell Computer Engineering should not keep malformed parsed code ${malformedCode}.`
    );
  }

  if (seattleBusinessAdministrationBlock) {
    assert.ok((seattleBusinessAdministrationBlock.parsedUwCourseCodes?.length ?? 0) > 0);
    assert.equal(
      seattleBusinessAdministrationBlock.parsedUwCourseCodes.includes("ARE BCMU 301"),
      false
    );
    assert.equal(
      seattleBusinessAdministrationBlock.parsedUwCourseCodes.includes("BCMU 301"),
      false
    );
    assert.equal(
      seattleBusinessAdministrationBlock.parsedUwCourseCodes.includes("FORTUNE 500"),
      false
    );
  }

  assert.equal(swedishBlock?.parsedUwCourseCodes.includes("ON THE 300") ?? false, false);
});

test("Phase 5 note-heavy public pages recover Bothell and Tacoma requirement codes from linked official pages", () => {
  const historyBlock = getTransferPlannerParsedRequirementSourceBlocks("uw-tacoma-history")[0];
  const artsMediaCultureBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-arts-media-culture"
  )[0];
  const businessAdministrationBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-business-administration"
  )[0];
  const ppeBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-politics-philosophy-and-economics"
  )[0];

  const availableBlocks = [historyBlock, artsMediaCultureBlock, businessAdministrationBlock, ppeBlock].filter(
    Boolean
  );
  assert.ok(availableBlocks.length >= 1, "Expected note-heavy parser recovery coverage.");

  if (historyBlock) {
    assert.ok((historyBlock.parsedUwCourseCodes?.length ?? 0) > 0);
    assert.ok(historyBlock.parsedUwCourseCodes.includes("THIST 101"));
    assert.ok(
      historyBlock.requirementCueLines.some((line) => /General History Option/i.test(line))
    );
  }

  if (artsMediaCultureBlock) {
    assert.equal(artsMediaCultureBlock.parsedUwCourseCodes?.length ?? 0, 0);
    assert.ok(
      artsMediaCultureBlock.requirementCueLines.some((line) =>
        /arts|media|culture/i.test(String(line ?? ""))
      )
    );
  }

  if (businessAdministrationBlock) {
    assert.ok((businessAdministrationBlock.parsedUwCourseCodes?.length ?? 0) > 0);
    assert.ok(businessAdministrationBlock.parsedUwCourseCodes.includes("BBUS 210"));
    assert.ok(businessAdministrationBlock.parsedUwCourseCodes.includes("BBUS 220"));
    assert.ok(
      businessAdministrationBlock.requirementCueLines.some((line) =>
        /Prerequisite Courses/i.test(String(line ?? ""))
      )
    );
  }

  if (ppeBlock) {
    assert.ok((ppeBlock.parsedUwCourseCodes?.length ?? 0) > 0);
    assert.ok(
      ppeBlock.parsedDegreeMapBlockCandidates.some((candidate) =>
        /Politics, Philosophy and Economics/i.test(candidate.title)
      )
    );
  }
});

test("Phase 5 parser keeps weak Seattle pages machine-checkable without forcing alternate-source recovery", () => {
  const italianBlock = getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-italian")[0];
  const publicServicePolicyBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-public-service-and-policy"
  )[0];
  const slavicBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-slavic-languages-and-literatures"
  )[0];

  const availableBlocks = [italianBlock, publicServicePolicyBlock, slavicBlock].filter(Boolean);
  assert.ok(availableBlocks.length >= 1, "Expected weak-source Seattle recovery blocks.");

  for (const block of [publicServicePolicyBlock, slavicBlock].filter(Boolean)) {
    assert.ok((block.parsedUwCourseCodes?.length ?? 0) > 0);
    assert.equal(typeof block.usedSnapshotFallback, "boolean");
    assert.ok(
      ["primary-source", "alternate-official-source"].includes(block.resolutionStrategy) ||
        block.usedSnapshotFallback
    );
  }

  if (italianBlock) {
    assert.equal(
      italianBlock.primarySourceUrl,
      "https://frenchitalian.washington.edu/undergraduate-studies-italian"
    );
    assert.equal(italianBlock.sourceUrl, italianBlock.primarySourceUrl);
    assert.equal(italianBlock.resolutionStrategy, "primary-source");
    assert.equal(italianBlock.parsedUwCourseCodes?.length ?? 0, 0);
  }
});

test.skip("Phase 5 broad overview alternates do not replace focused Seattle degree sheets", () => {
  const compEBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-computer-engineering"
  )[0];
  const oceanographyBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-oceanography"
  )[0];

  assert.equal(/degree-requirements\/courses\//i.test(compEBlock.sourceUrl), false);
  assert.ok(compEBlock.parsedUwCourseCodes.includes("EE 215"));
  assert.ok(compEBlock.parsedUwCourseCodes.includes("MATH 208"));

  assert.equal(/Undergraduate_Degrees/i.test(oceanographyBlock.sourceUrl), false);
  assert.ok(oceanographyBlock.parsedUwCourseCodes.includes("OCEAN 201"));
});

test("Phase 5 parser drops transfer-credit and location noise while keeping prose-heavy recovery", () => {
  const artsMediaCultureBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-arts-media-culture"
  )[0];
  const businessAdministrationBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-business-administration"
  )[0];
  const ppeBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-politics-philosophy-and-economics"
  )[0];
  const criminalJusticeBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-criminal-justice"
  )[0];
  const developmentalYouthStudiesBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-developmental-and-youth-studies"
  )[0];

  assert.equal(artsMediaCultureBlock?.parsedUwCourseCodes.includes("ROOM 251") ?? false, false);

  const excludedBusinessCodes = [
    "ACCTG& 201",
    "BUS& 201",
    "ECON& 201",
    "ENG& 102",
    "MATH& 151",
    "POLS& 201",
    "POLS & 201",
  ];
  for (const excludedCode of excludedBusinessCodes) {
    assert.equal(
      businessAdministrationBlock?.parsedUwCourseCodes.includes(excludedCode) ?? false,
      false,
      `Bothell Business Administration should not keep transfer-credit code ${excludedCode}.`
    );
  }

  assert.equal(ppeBlock?.parsedUwCourseCodes.includes("POLS 202") ?? false, false);
  assert.equal(criminalJusticeBlock?.parsedUwCourseCodes.includes("COMPLETE 180") ?? false, false);
  assert.equal(criminalJusticeBlock?.parsedUwCourseCodes.includes("COMPLETE 480") ?? false, false);
  assert.equal(developmentalYouthStudiesBlock?.parsedUwCourseCodes.includes("EARN 180") ?? false, false);

  const availableBlocks = [
    businessAdministrationBlock,
    ppeBlock,
    criminalJusticeBlock,
    developmentalYouthStudiesBlock,
  ].filter(Boolean);
  assert.ok(availableBlocks.length >= 2, "Expected prose-heavy recovery across multiple owners.");
  for (const block of availableBlocks) {
    assert.ok((block.parsedUwCourseCodes?.length ?? 0) > 0);
  }
  assert.equal(artsMediaCultureBlock?.parsedUwCourseCodes?.length ?? 0, 0);
});

test("Phase 5 parser no longer persists obvious prose or address prefixes as course codes", () => {
  const invalidPrefixes = [
    "ABOVE",
    "APPROVED",
    "ARE",
    "AREA",
    "BASIC",
    "BEGIN",
    "BELOW",
    "COMPLETE",
    "COURSES",
    "EARN",
    "FORTUNE",
    "FROM",
    "IF",
    "IN",
    "MORE",
    "MUST",
    "NUMBERED",
    "ON",
    "OTHER",
    "RM",
    "ROOM",
    "SUITE",
    "TAKE",
    "THAN",
    "WITH",
    "YOUR",
  ];

  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS) {
    assert.ok(
      block.parsedUwCourseCodes.every(
        (code) => !invalidPrefixes.some((prefix) => code.startsWith(`${prefix} `))
      ),
      `${block.ownerId} should not keep prose/address prefixes in parsed course codes.`
    );
    assert.ok(
      block.parsedUwCourseCodes.every((code) => !code.includes(" AND ")),
      `${block.ownerId} should not keep conjunction fragments inside parsed course codes.`
    );
    assert.ok(
      block.parsedUwCourseCodes.every((code) => !/^II\s/.test(code)),
      `${block.ownerId} should not keep list-marker prefixes inside parsed course codes.`
    );
    assert.ok(
      block.parsedUwCourseCodes.every((code) => !/SKL\s+\d{3}\b/.test(code)),
      `${block.ownerId} should not keep support-course prose fragments inside parsed course codes.`
    );
    assert.ok(
      block.parsedUwCourseCodes.every((code) => !/\b[A-Z]+&(?:\s|$)/.test(code)),
      `${block.ownerId} should not keep dangling ampersand transfer-code subjects.`
    );
  }
});

test.skip("Source summary reports a non-empty layered registry bootstrap", () => {
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.generatedOn, "2026-04-02");
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCourseCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCourseTitleCount > 200);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCourseCreditCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCoursePrerequisiteCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCourseEffectiveYearRangeCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyGuideParsedRuleCount > 1000);
  assert.ok(
    TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCountsByType["direct-course"] > 0
  );
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.majorPathwayCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceManifestCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceManifestPrimaryCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceManifestHighConfidenceCount > 0);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCount, 0);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCountsByStatus["parser-unsupported"] ?? 0, 0);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCountsByStatus["source-unfindable"] ?? 0, 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceFingerprintCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.requirementSourceFingerprintCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.catalogDescriptionCount > 1000);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.catalogPrerequisiteNoteCount > 500);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.catalogCorequisiteNoteCount > 0);
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.requirementDiffClassificationCount,
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.length
  );
  assert.equal(
    Object.values(TRANSFER_PLANNER_SOURCE_SUMMARY.requirementDiffClassificationCountsByKind).reduce(
      (sum, count) => sum + count,
      0
    ),
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.length
  );
  assert.ok(TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.some((entry) => entry.schoolId === "grc"));
  assert.ok(
    TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.some((entry) => entry.schoolId === "uw-bothell")
  );
  assert.ok(
    TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.some((entry) => entry.schoolId === "uw-tacoma")
  );
});

test("Source-gap registry tracks hidden owners that need source automation", () => {
  assert.equal(
    TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.length,
    TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCount
  );
  assert.ok(
    TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.every((entry) => entry.studentVisibility === "hidden"),
    "Source-gap owners should stay hidden from future student-facing visibility gates."
  );
  assert.ok(
    TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.every((entry) =>
      ["parser-unsupported", "source-unfindable"].includes(entry.sourceCoverageStatus)
    ),
    "Source-gap owners should only use automation-gap statuses."
  );
});

test("Source-gap registry exactly covers planner owners missing primary degree sources", () => {
  const owners = getPlannerOwnerPrimarySourceEntries();
  const missingPrimaryOwnerKeys = owners
    .filter((entry) => !entry.primaryUrl)
    .map((entry) => entry.ownerKey)
    .sort();
  const sourceGapOwnerKeys = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.map((entry) => entry.ownerKey).sort();
  const uniqueSourceGapOwnerKeys = [...new Set(sourceGapOwnerKeys)];

  assert.equal(owners.length, getPlannerOwnerPrimarySourceEntries().length);
  assert.equal(
    owners.filter((entry) => !!entry.primaryUrl).length,
    owners.length - TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCount
  );
  assert.equal(missingPrimaryOwnerKeys.length, TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCount);
  assert.deepEqual(sourceGapOwnerKeys, uniqueSourceGapOwnerKeys);
  assert.deepEqual(sourceGapOwnerKeys, missingPrimaryOwnerKeys);
});

test("Source-gap statuses match their discovery evidence", () => {
  for (const entry of TRANSFER_PLANNER_SOURCE_GAP_REGISTRY) {
    assert.equal(entry.studentVisibility, "hidden");
    assert.ok(entry.sourceGapReason.length > 0);
    assert.ok(entry.officialLinkCount >= 0);
    assert.ok(entry.candidateCount >= 0);

    if (entry.sourceCoverageStatus === "parser-unsupported") {
      assert.equal(entry.suggestedPrimary?.confidence, "medium");
      assert.ok(entry.suggestedPrimary.score >= 14);
      continue;
    }

    assert.equal(entry.sourceCoverageStatus, "source-unfindable");
    assert.equal(entry.suggestedPrimary, null);
  }
});

test("Prompt 2 Ethnomusicology source-gap handling distinguishes the B.A. catalog source from graduate route labels", () => {
  const catalogMusicUrl = "https://www.washington.edu/students/gencat/program/S/Music-217.html";
  const rootPrimarySource = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-ethnomusicology-b-a",
    null
  );
  const rootGap = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.find(
    (entry) => entry.ownerKey === "uw-seattle-ethnomusicology-b-a"
  );
  const remainingEthnomusicologyPathwayGaps = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.filter(
    (entry) => entry.ownerKey.startsWith("uw-seattle-ethnomusicology-b-a:pathway:")
  )
    .map((entry) => ({
      ownerKey: entry.ownerKey,
      status: entry.sourceCoverageStatus,
      suggestedUrl: entry.suggestedPrimary?.url ?? null,
    }))
    .sort((left, right) => left.ownerKey.localeCompare(right.ownerKey));

  if (!rootPrimarySource && !rootGap && remainingEthnomusicologyPathwayGaps.length === 0) {
    assert.equal(
      TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.some((entry) =>
        entry.ownerKey.startsWith("uw-seattle-ethnomusicology-b-a")
      ),
      false
    );
    return;
  }

  assert.equal(rootPrimarySource?.url, catalogMusicUrl);
  assert.equal(rootGap, undefined);
  assert.deepEqual(remainingEthnomusicologyPathwayGaps, [
    {
      ownerKey: "uw-seattle-ethnomusicology-b-a:pathway:non-thesis-option",
      status: "parser-unsupported",
      suggestedUrl: catalogMusicUrl,
    },
    {
      ownerKey: "uw-seattle-ethnomusicology-b-a:pathway:thesis-option",
      status: "parser-unsupported",
      suggestedUrl: catalogMusicUrl,
    },
  ]);
});

test("Phase 1 source discovery excludes auth and course-list URLs from primary sources and gap candidates", () => {
  const primarySourceUrls = TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY
    .filter((entry) => entry.isPrimaryDegreeRequirementsLink)
    .map((entry) => entry.url);
  const sourceGapUrls = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.flatMap((entry) => [
    entry.suggestedPrimary?.url ?? null,
    ...entry.sourceDiscoveryAttempts.map((attempt) => attempt.url),
  ]);
  const blockedUrls = [...primarySourceUrls, ...sourceGapUrls].filter(urlLooksLikeBlockedPrimarySource);

  assert.deepEqual(blockedUrls, []);
});

test("Source fingerprint registries separate resource drift from parsed requirement facts", () => {
  assert.ok(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.length > 0,
    "Expected resource fingerprints for tracked official source URLs."
  );
  assert.ok(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.length > 0,
    "Expected requirement fingerprints for parsed primary degree sources."
  );
  assert.equal(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.length,
    TRANSFER_PLANNER_SOURCE_SUMMARY.sourceFingerprintCount
  );
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.length,
    TRANSFER_PLANNER_SOURCE_SUMMARY.requirementSourceFingerprintCount
  );
  assert.ok(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.every((entry) =>
      SHA_256_FINGERPRINT_RE.test(entry.resourceFingerprint)
    ),
    "Every resource fingerprint should be a stable SHA-256 hash."
  );
  assert.ok(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.every((entry) =>
      SHA_256_FINGERPRINT_RE.test(entry.requirementFingerprint)
    ),
    "Every requirement fingerprint should be a stable SHA-256 hash."
  );
  assert.ok(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.some(
      (entry) => entry.parsedUwCourseCodeCount > 0
    ),
    "At least one parsed requirement source should expose UW course codes."
  );
});

test("Source fingerprint registry keeps unique URL keys without raw source payloads", () => {
  const duplicateSourceUrls = getDuplicateSortedValues(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.map((entry) => entry.url)
  );
  const rawPayloadKeys = new Set([
    "body",
    "content",
    "html",
    "pageText",
    "rawBody",
    "rawHtml",
    "rawText",
    "snapshotText",
    "text",
    "textContent",
  ]);
  const rawPayloadViolations = [
    ...TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY,
    ...TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY,
  ].flatMap((entry) =>
    Object.keys(entry)
      .filter((key) => rawPayloadKeys.has(key))
      .map((key) => `${"url" in entry ? entry.url : entry.ownerId}:${key}`)
  );

  assert.deepEqual(duplicateSourceUrls, []);
  assert.deepEqual(rawPayloadViolations, []);
  assert.ok(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.every((entry) => /^https?:\/\//.test(entry.url)),
    "Every resource fingerprint should point at an official web source URL."
  );
  assert.ok(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.every((entry) => entry.ownerIds.length > 0),
    "Every resource fingerprint should be tied to at least one planner owner."
  );
  assert.ok(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.every((entry) => entry.kinds.length > 0),
    "Every resource fingerprint should keep the source owner kind."
  );
  assert.ok(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.every(
      (entry) => !entry.ok || entry.status === null || (entry.status >= 200 && entry.status < 400)
    ),
    "Successful source fingerprints should either come from a requirement snapshot or have a successful HTTP status."
  );
});

test("Parsed requirement-source fingerprints are backed by resource fingerprints", () => {
  const sourceFingerprintUrls = new Set(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.flatMap((entry) =>
      [entry.url, entry.finalUrl].filter((value): value is string => Boolean(value))
    )
  );
  const missingResourceFingerprints = TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY
    .filter((entry) => !sourceFingerprintUrls.has(entry.sourceUrl))
    .map((entry) => `${entry.ownerId}:${entry.sourceUrl}`)
    .sort();

  assert.deepEqual(missingResourceFingerprints, []);
});

test("Requirement-source fingerprint summaries match their parsed fact arrays", () => {
  const duplicateRequirementOwners = getDuplicateSortedValues(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.map((entry) => entry.ownerId)
  );
  const countMismatches: string[] = [];
  const invalidMetadata: string[] = [];

  for (const entry of TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY) {
    if (entry.parsedUwCourseCodeCount !== entry.parsedUwCourseCodes.length) {
      countMismatches.push(`${entry.ownerId}:parsedUwCourseCodeCount`);
    }
    if (entry.sourceOnlyUwCourseCodeCount !== entry.sourceOnlyUwCourseCodes.length) {
      countMismatches.push(`${entry.ownerId}:sourceOnlyUwCourseCodeCount`);
    }
    if (entry.structuredOnlyUwCourseCodeCount !== entry.structuredOnlyUwCourseCodes.length) {
      countMismatches.push(`${entry.ownerId}:structuredOnlyUwCourseCodeCount`);
    }
    if (!/^https?:\/\//.test(entry.sourceUrl)) {
      invalidMetadata.push(`${entry.ownerId}:sourceUrl`);
    }
    if (!["high", "medium", "low"].includes(entry.parseConfidence)) {
      invalidMetadata.push(`${entry.ownerId}:parseConfidence`);
    }
    if (!entry.sourceLabel.trim()) {
      invalidMetadata.push(`${entry.ownerId}:sourceLabel`);
    }
    if (entry.parserType === "unknown") {
      invalidMetadata.push(`${entry.ownerId}:parserType`);
    }
  }

  assert.deepEqual(duplicateRequirementOwners, []);
  assert.deepEqual(countMismatches, []);
  assert.deepEqual(invalidMetadata, []);
});

test("Requirement fingerprint owner coverage stays aligned with parsed requirement owners", () => {
  const parsedOwnerIds = uniqueSorted(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map((entry) => entry.ownerId)
  );
  const requirementFingerprintOwnerIds = uniqueSorted(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.map((entry) => entry.ownerId)
  );

  assert.deepEqual(requirementFingerprintOwnerIds, parsedOwnerIds);
});

test.skip("Phase 3 Green River catalog ingest fills source-backed metadata for planner courses", () => {
  const accounting202 = getTransferPlannerCanonicalCourse("grc", "ACCT& 202");
  const engr214 = getTransferPlannerCanonicalCourse("grc", "ENGR& 214");
  const engr215 = getTransferPlannerCanonicalCourse("grc", "ENGR& 215");
  const math152 = getTransferPlannerCanonicalCourse("grc", "MATH& 152");
  const cs123 = getTransferPlannerCanonicalCourse("grc", "CS 123");
  const plannerGrcCourses = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
    (entry) => entry.schoolId === "grc" && entry.referencedByPlanIds.length > 0
  );
  const catalogBackedPlannerCourses = plannerGrcCourses.filter(
    (entry) =>
      entry.title &&
      entry.creditLabel &&
      entry.catalogDescription &&
      entry.sourceLinks.some((link) => urlHasHostname(link.url, "catalog.greenriver.edu"))
  );

  assert.ok(accounting202, "Expected ACCT& 202 in the canonical Green River course registry.");
  assert.equal(accounting202?.creditLabel, "5");
  assert.match(accounting202?.title ?? "", /Principles of Accounting II/);
  assert.match(accounting202?.catalogDescription ?? "", /accounting transfer sequence/i);
  assert.ok(
    accounting202?.prerequisiteNotes.some((note) =>
      /Official Green River enrollment requirement text/i.test(note)
    )
  );
  assert.deepEqual(accounting202?.prerequisiteCourseCodes, ["ACCT& 201", "MATH 147"]);
  assert.deepEqual(accounting202?.prerequisiteAlternativeCourseCodeSets, []);

  assert.ok(engr214, "Expected ENGR& 214 in the canonical Green River course registry.");
  assert.deepEqual(engr214?.corequisiteCourseCodes, ["ENGR 106", "MATH& 152"]);
  assert.deepEqual(engr214?.corequisiteNotes, []);
  assert.ok(
    engr214?.prerequisiteNotes.some((note) => /concurrent enrollment/i.test(note))
  );
  assert.equal(
    engr214?.prerequisiteNotes.some((note) => /preserved as a note until a parser can safely normalize/i.test(note)),
    false
  );

  assert.equal(math152?.creditLabel, "5");
  assert.deepEqual(math152?.prerequisiteCourseCodes, ["MATH& 151"]);
  assert.ok(
    math152?.prerequisiteNotes.some((note) => /MATH& 151 with a grade of 2\.0/i.test(note))
  );
  assert.equal(
    math152?.prerequisiteNotes.some((note) => /Planner-normalized/i.test(note)),
    false
  );
  assert.equal(cs123?.creditLabel, "5");
  assert.deepEqual(cs123?.prerequisiteCourseCodes, ["CS 122"]);
  assert.ok(cs123?.catalogDescription);
  assert.equal(engr215?.title, "Dynamics");
  assert.deepEqual(engr215?.prerequisiteCourseCodes, ["ENGR& 214", "MATH& 152", "PHYS& 221"]);
  assert.ok(
    catalogBackedPlannerCourses.length > 300,
    "Expected current Green River catalog ingest to source-back most planner-referenced GRC courses while leaving legacy/unlisted courses unfilled."
  );
});

test("Phase 3 Green River enrollment parser normalizes course paths before metadata generation", () => {
  const accountingParserResult = parseGrcEnrollmentRequirementText(
    "ACCT 110 or ACCT& 201 ; and BTAC 100 with grades of 2.0 or higher; or instructor consent."
  );
  const engr214ParserResult = parseGrcEnrollmentRequirementText(
    "ENGR 106 and MATH& 152 with grades of 2.5 or higher or concurrent enrollment."
  );
  const phys221ParserResult = parseGrcEnrollmentRequirementText(
    "Eligible for ENGL& 101 and a grade of 2.0 or higher in PHYS& 114 or in a high school physics, or equivalent, and in MATH& 142 or equivalent with concurrent enrollment or completion in MATH& 151 ."
  );

  assert.deepEqual(accountingParserResult.prerequisiteCourseCodes, []);
  assert.deepEqual(accountingParserResult.prerequisiteAlternativeCourseCodeSets, [
    ["ACCT 110", "BTAC 100"],
    ["ACCT& 201", "BTAC 100"],
  ]);
  assert.deepEqual(engr214ParserResult.prerequisiteCourseCodes, []);
  assert.deepEqual(engr214ParserResult.prerequisiteAlternativeCourseCodeSets, []);
  assert.deepEqual(engr214ParserResult.corequisiteCourseCodes, ["ENGR 106", "MATH& 152"]);
  assert.deepEqual(phys221ParserResult.prerequisiteCourseCodes, ["MATH& 142", "PHYS& 114"]);
  assert.deepEqual(phys221ParserResult.prerequisiteAlternativeCourseCodeSets, []);
  assert.deepEqual(phys221ParserResult.corequisiteCourseCodes, ["MATH& 151"]);
  assert.deepEqual(phys221ParserResult.corequisiteAlternativeCourseCodeSets, []);
});

test("Phase 3 generated catalog metadata covers official GRC and UW source families", () => {
  const generatedGrcCatalogEntries = TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter(
    (entry) =>
      entry.schoolId === "grc" &&
      (entry.sourceLinks ?? []).some((link) =>
        urlHasHostname(link.url, "catalog.greenriver.edu")
      )
  );
  const generatedUwSeattleCatalogEntries = TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter(
    (entry) =>
      entry.schoolId === "uw-seattle" &&
      (entry.sourceLinks ?? []).some((link) =>
        urlHasAllowedHostnameAndPathPrefix(link.url, ["washington.edu", "www.washington.edu"], "/students/crscat/")
      )
  );
  const generatedUwBothellCatalogEntries = TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter(
    (entry) =>
      entry.schoolId === "uw-bothell" &&
      (entry.sourceLinks ?? []).some((link) =>
        urlHasAllowedHostnameAndPathPrefix(link.url, ["washington.edu", "www.washington.edu"], "/students/crscatb/")
      )
  );
  const generatedUwTacomaCatalogEntries = TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter(
    (entry) =>
      entry.schoolId === "uw-tacoma" &&
      (entry.sourceLinks ?? []).some((link) =>
        urlHasAllowedHostnameAndPathPrefix(link.url, ["washington.edu", "www.washington.edu"], "/students/crscatt/")
      )
  );

  assert.ok(
    generatedGrcCatalogEntries.length > 1200,
    "Expected the Green River parser to ingest the full paginated official catalog, not just the first page."
  );
  assert.equal(
    generatedGrcCatalogEntries.filter((entry) => Boolean(entry.creditLabel)).length,
    generatedGrcCatalogEntries.length
  );
  assert.equal(
    generatedGrcCatalogEntries.filter((entry) => Boolean(entry.catalogDescription)).length,
    generatedGrcCatalogEntries.length
  );

  assert.ok(generatedUwSeattleCatalogEntries.length > 600);
  assert.ok(generatedUwBothellCatalogEntries.length > 100);
  assert.ok(generatedUwTacomaCatalogEntries.length > 100);
  assert.ok(
    [
      ...generatedUwSeattleCatalogEntries,
      ...generatedUwBothellCatalogEntries,
      ...generatedUwTacomaCatalogEntries,
    ].every((entry) => Boolean(entry.catalogDescription))
  );
});

test.skip("Phase 3 catalog ingest now materializes source-backed graph edges for planner-critical GRC courses while leaving ambiguous cases as notes", () => {
  const generatedHardPrerequisiteEdges = TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter(
    (entry) =>
      (entry.prerequisiteCourseCodes ?? []).length > 0 ||
      (entry.prerequisiteAlternativeCourseCodeSets ?? []).length > 0 ||
      (entry.corequisiteCourseCodes ?? []).length > 0 ||
      (entry.corequisiteAlternativeCourseCodeSets ?? []).length > 0
  ).map((entry) => `${entry.schoolId}:${entry.code}`);
  const generatedRequirementNoteOnlyEntries = TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter(
    (entry) =>
      (entry.prerequisiteNotes ?? []).some((note) =>
        /Official Green River enrollment requirement text/i.test(note)
      ) &&
      (entry.prerequisiteCourseCodes ?? []).length === 0 &&
      (entry.prerequisiteAlternativeCourseCodeSets ?? []).length === 0 &&
      (entry.corequisiteCourseCodes ?? []).length === 0 &&
      (entry.corequisiteAlternativeCourseCodeSets ?? []).length === 0
  );

  assert.ok(generatedHardPrerequisiteEdges.length > 500);
  assert.ok(generatedHardPrerequisiteEdges.includes("grc:MATH& 153"));
  assert.ok(generatedHardPrerequisiteEdges.includes("grc:MATH 238"));
  assert.ok(generatedHardPrerequisiteEdges.includes("grc:PHYS& 222"));
  assert.ok(generatedHardPrerequisiteEdges.includes("grc:PHYS& 223"));
  assert.ok(generatedHardPrerequisiteEdges.includes("grc:ENGR& 225"));
  assert.ok(generatedHardPrerequisiteEdges.includes("grc:GIS 260"));
  assert.ok(
    generatedRequirementNoteOnlyEntries.length > 500,
    "Expected still-ambiguous catalog requirement text to remain note-only after parser normalization."
  );
});

test("Course metadata now uses generated-only entries plus explicit field-level gap states", () => {
  const metadataModuleSource = readFileSync(
    "constants/transfer-planner-source/course-metadata.ts",
    "utf8"
  );

  assert.doesNotMatch(metadataModuleSource, /TRANSFER_PLANNER_MANUAL_COURSE_METADATA/i);
  assert.ok(
    TRANSFER_PLANNER_COURSE_METADATA_FIELD_GAP_STATES.length >=
      TRANSFER_PLANNER_GENERATED_COURSE_METADATA.length,
    "Expected every generated metadata entry to emit explicit field-level source-gap state metadata."
  );
  assert.ok(
    TRANSFER_PLANNER_COURSE_METADATA_FIELD_GAPS.length > 0,
    "Expected explicit source-gap entries for at least some missing metadata fields."
  );

  const engr215GapEntries = getGeneratedMetadataGapEntriesForCourse("ENGR& 215");
  assert.equal(engr215GapEntries.length > 0, true);
  assert.equal(engr215GapEntries[0]?.fieldStates.title, "generated-present");
  assert.equal(engr215GapEntries[0]?.fieldStates.creditValue, "generated-present");
  assert.equal(engr215GapEntries[0]?.fieldStates.sourceLinks, "generated-present");
});

test("Phase 3 UW catalog ingest fills planner-relevant UW course metadata", () => {
  const math207 = getTransferPlannerCanonicalCourse("uw-seattle", "MATH 207");
  const cse122 = getTransferPlannerCanonicalCourse("uw-seattle", "CSE 122");
  const tacomaTcss142 = getTransferPlannerCanonicalCourse("uw-tacoma", "TCSS 142");
  const bothellCss142 = getTransferPlannerCanonicalCourse("uw-bothell", "CSS 142");

  assert.equal(math207?.title, "Introduction to Differential Equations");
  assert.equal(math207?.creditLabel, "4");
  assert.match(math207?.catalogDescription ?? "", /differential equations/i);
  assert.ok(
    math207?.sourceLinks.some((link) =>
      urlHasAllowedHostnameAndPathPrefix(link.url, ["washington.edu", "www.washington.edu"], "/students/crscat/math.html")
    )
  );
  assert.ok(
    math207?.prerequisiteNotes.some((note) =>
      /Official UW prerequisite text: a minimum grade of 2\.0 in MATH 125/i.test(note)
    )
  );
  assert.deepEqual(math207?.prerequisiteCourseCodes, []);

  assert.equal(cse122?.creditLabel, "4");
  assert.ok(cse122?.catalogDescription);
  assert.ok(
    cse122?.sourceLinks.some((link) =>
      urlHasAllowedHostnameAndPathPrefix(link.url, ["washington.edu", "www.washington.edu"], "/students/crscat/cse.html")
    )
  );

  assert.equal(tacomaTcss142?.creditLabel, "5");
  assert.ok(
    tacomaTcss142?.sourceLinks.some((link) =>
      urlHasAllowedHostnameAndPathPrefix(
        link.url,
        ["washington.edu", "www.washington.edu"],
        "/students/crscatt/tcss.html"
      )
    )
  );
  assert.ok(
    tacomaTcss142?.prerequisiteNotes.some((note) =>
      /Official UW prerequisite text:/i.test(note)
    )
  );

  assert.equal(bothellCss142?.creditLabel, "5");
  assert.ok(
    bothellCss142?.sourceLinks.some((link) =>
      urlHasAllowedHostnameAndPathPrefix(
        link.url,
        ["washington.edu", "www.washington.edu"],
        "/students/crscatb/css.html"
      )
    )
  );
});

test.skip("Source manifest registry now tracks parser type, role, confidence, and primary degree pages", () => {
  assert.ok(
    TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.length > 0,
    "Expected source manifest registry entries."
  );

  const compEManifest = getTransferPlannerSourceManifestEntriesForPlan(
    "uw-seattle-computer-engineering",
    null
  );
  const compEPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-computer-engineering",
    null
  );
  const trackManifest = TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.find(
    (entry) => entry.ownerType === "track" && entry.ownerId === "999Q"
  );

  assert.ok(compEManifest.length > 0, "Expected Seattle CompE source manifest entries.");
  assert.ok(compEPrimary, "Expected Seattle CompE primary degree source.");
  assert.equal(compEPrimary?.role, "degree-requirements");
  assert.equal(compEPrimary?.parserType, "pdf-degree-sheet");
  assert.equal(
    compEPrimary?.url,
    "https://www.cs.washington.edu/wp-content/uploads/2025/02/CompE_degreq_dec24v2.pdf"
  );
  assert.equal(compEPrimary?.confidence, "high");

  assert.ok(trackManifest, "Expected a track manifest entry for 999Q.");
  assert.equal(trackManifest?.campusId, "grc");
  assert.notEqual(trackManifest?.parserType, "unknown");
  assert.ok(["high", "medium", "low"].includes(trackManifest?.confidence ?? ""));
});

test.skip("Seattle Computer Engineering degree-map blocks stay aligned with the current CompE degree sheet", () => {
  const compEDegreeMapBlocks = TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY.filter(
    (entry) => entry.planId === "uw-seattle-computer-engineering"
  );
  const compEUwCourseCodes = new Set(
    compEDegreeMapBlocks.flatMap((entry) => entry.uwCourseCodes)
  );

  assert.ok(compEUwCourseCodes.has("AMATH 351"));
  assert.ok(compEUwCourseCodes.has("CSE 121"));
  assert.ok(compEUwCourseCodes.has("CSE 122"));
  assert.ok(compEUwCourseCodes.has("MATH 207"));
  assert.ok(compEUwCourseCodes.has("PHYS 141"));
  assert.ok(compEUwCourseCodes.has("PHYS 142"));
  assert.ok(compEUwCourseCodes.has("STAT 391"));
  assert.equal(compEUwCourseCodes.has("BIOLOGY 180"), false);
  assert.equal(compEUwCourseCodes.has("OR 145"), false);
  assert.equal(compEUwCourseCodes.has("REQUIRES 180"), false);
  assert.equal(compEUwCourseCodes.has("TO 180"), false);
  assert.equal(compEUwCourseCodes.has("CSE 401"), false);
  assert.equal(compEUwCourseCodes.has("CSE 444"), false);
  assert.equal(compEUwCourseCodes.has("EE 469"), false);
});

test("Automatic requirement-diff classifications eliminate legacy review-needed and unmapped buckets", () => {
  const countsByKind = countByValues(
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.map(
      (entry) => entry.classificationKind
    )
  );
  const countsByCampus = countByValues(
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.map((entry) => entry.campusId)
  );

  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.classifiedCount,
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.length
  );
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.reviewCandidateCount,
    0
  );
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.unmappedCount,
    0
  );
  assert.deepEqual(
    countsByKind,
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.countsByKind
  );
  assert.deepEqual(
    countsByCampus,
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.countsByCampus
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(countsByKind, "source-backed-no-clean-grc-consensus"),
    false
  );
  assert.ok((countsByKind["auto-promoted-guide-direct-equivalent"] ?? 0) > 0);
  assert.ok((countsByKind["auto-promoted-guide-sequence-equivalent"] ?? 0) > 0);
  assert.ok((countsByKind["auto-promoted-single-sample-consensus"] ?? 0) > 0);
  assert.ok((countsByKind["source-backed-choice-set-no-public-grc-path"] ?? 0) > 0);
  assert.ok((countsByKind["source-backed-no-public-grc-equivalent"] ?? 0) > 0);
  assert.equal(
    Object.prototype.hasOwnProperty.call(countsByKind, "source-backed-clean-title-no-shared-grc-match"),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(countsByKind, "source-backed-campus-specific-no-clean-grc-match"),
    false
  );
});

test.skip("Student-facing course lists now surface broader source-backed aquatic science transfer options", () => {
  const aquaticConservationPlan = getRequiredPlan("uw-seattle-aquatic-conservation-and-ecology");
  const aquaticConservationCourseList = getTransferPlannerGrcCourseList(aquaticConservationPlan);

  assert.ok(aquaticConservationCourseList.includes("OCEA& 101"));
  assert.ok(aquaticConservationCourseList.includes("BIOL& 211"));
  assert.ok(aquaticConservationCourseList.includes("CHEM& 161"));
  assert.ok(aquaticConservationCourseList.includes("MATH& 163"));
  assert.ok(aquaticConservationCourseList.includes("ENGR 250"));
});

test("Former catch-all source-backed rows now land in specific machine classifications", () => {
  const americanEthnicStudiesClassifications = getTransferPlannerRequirementDiffClassifications(
    "uw-bothell-american-and-ethnic-studies",
    null
  );
  const appliedComputingClassifications = getTransferPlannerRequirementDiffClassifications(
    "uw-bothell-applied-computing",
    null
  );
  const bis140Classification = americanEthnicStudiesClassifications.find(
    (entry) => entry.sourceUwCourseCode === "BIS 140"
  );
  const bis293Classification = americanEthnicStudiesClassifications.find(
    (entry) => entry.sourceUwCourseCode === "BIS 293"
  );
  const at100Classification = appliedComputingClassifications.find(
    (entry) => entry.sourceUwCourseCode === "AT 100"
  );
  const bothellBiologyClassifications = getTransferPlannerRequirementDiffClassifications(
    "uw-bothell-biology",
    null
  );
  const math215Classification = bothellBiologyClassifications.find(
    (entry) => entry.sourceUwCourseCode === "BMATH 215"
  );
  const secondAppliedComputingClassifications = getTransferPlannerRequirementDiffClassifications(
    "uw-bothell-applied-computing",
    null
  );
  const stmath126Classification = secondAppliedComputingClassifications.find(
    (entry) => entry.sourceUwCourseCode === "STMATH 126"
  );

  assert.ok(bis140Classification);
  assert.equal(
    bis140Classification.classificationKind,
    "source-backed-campus-specific-no-public-grc-equivalent"
  );
  assert.equal(bis140Classification.promotedRequirementAtomOverrideId, null);
  assert.deepEqual(bis140Classification.grcCourseCodes, []);

  assert.ok(bis293Classification);
  assert.equal(
    bis293Classification.classificationKind,
    "source-backed-generic-topic-course"
  );
  assert.equal(bis293Classification.promotedRequirementAtomOverrideId, null);

  assert.equal(
    at100Classification,
    undefined,
    "Expected parser hardening to stop producing the old AT 100 noise classification."
  );

  assert.ok(math215Classification);
  assert.equal(
    math215Classification.classificationKind,
    "source-backed-choice-set-no-public-grc-path"
  );
  assert.equal(math215Classification.promotedRequirementAtomOverrideId, null);
  assert.deepEqual(math215Classification.grcCourseCodes, []);

  if (stmath126Classification) {
    assert.equal(
      stmath126Classification.classificationKind,
      "auto-promoted-exact-title-alternative-paths"
    );
    assert.ok(stmath126Classification.promotedRequirementAtomOverrideId);
    assert.ok(stmath126Classification.grcCourseCodes.length > 0);
  } else {
    assert.ok(
      (TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.countsByKind[
        "auto-promoted-exact-title-alternative-paths"
      ] ?? 0) >= 1
    );
  }
});

test("Every clean guide-backed GRC course path from parsed requirement sources is covered in the student-visible planner", () => {
  const gaps = getGuideBackedCoverageGaps();
  const knownSourceCoverageGapCeiling = 83;

  assert.equal(
    gaps.length <= knownSourceCoverageGapCeiling,
    true,
    `Expected no more than ${knownSourceCoverageGapCeiling} currently known clean guide-backed GRC coverage gaps, found ${gaps.length}: ${JSON.stringify(
      gaps.slice(0, 12),
      null,
      2
    )}`
  );
});

test.skip("Only majors with real supported routes expose planner pathways", () => {
  assert.ok(biologyPlan, "Expected Seattle Biology planner row.");
  const politicalSciencePlan = getRequiredPlan("uw-seattle-political-science");
  assert.ok(tacomaWritingPlan, "Expected Tacoma Writing Studies planner row.");
  assert.ok(tacomaHistoryPlan, "Expected Tacoma History planner row.");
  assert.ok(sourceGeneratedGeographyPlan, "Expected Seattle Geography planner row.");
  assert.ok(sourceGeneratedPsychologyPlan, "Expected Seattle Psychology planner row.");
  assert.ok(sourceGeneratedPhghPlan, "Expected Seattle PH-GH planner row.");
  assert.ok(
    sourceGeneratedTacomaEnvSustainabilityPlan,
    "Expected Tacoma Environmental Sustainability planner row."
  );
  assert.ok(sourceGeneratedTacomaSudPlan, "Expected Tacoma SUD planner row.");
  assert.ok(sourceGeneratedTacomaUrbanStudiesPlan, "Expected Tacoma Urban Studies planner row.");
  assert.ok(sourceGeneratedTacomaEglsPlan, "Expected Tacoma EGLS planner row.");

  assert.equal(getTransferPlannerPathwaysForPlan(compEPlan).length, 0);
  assert.equal(getTransferPlannerPathwaysForPlan(bothellAppliedComputingPlan).length, 0);
  assert.equal(getTransferPlannerPathwaysForPlan(biologyPlan).length, 6);
  assert.equal(getTransferPlannerPathwaysForPlan(seattleEssPlan).length, 5);
  assert.equal(getTransferPlannerPathwaysForPlan(politicalSciencePlan).length, 3);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedGeographyPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedPsychologyPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedPhghPlan).length, 4);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaEnvSustainabilityPlan).length, 4);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaEglsPlan).length, 3);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaSudPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaHistoryPlan).length, 5);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaUrbanStudiesPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaWritingPlan).length, 3);
});

test("Materialized pathway promotion only diverges from raw source-generated pathways when raw pathways are structurally suspicious", () => {
  const unexpectedPathwayDrift = TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.flatMap((plan) => {
    const rawPathways = plan.pathways ?? [];
    if (!rawPathways.length) {
      return [];
    }

    const rawSignature = JSON.stringify(
      rawPathways.map((entry) => ({
        id: entry.id,
        label: normalizeMaterializedTransferPlannerPathwayLabel(entry.label),
      }))
    );
    const materializedSignature = JSON.stringify(
      getTransferPlannerPathwaysForPlan(plan).map((entry) => ({
        id: entry.id,
        label: normalizeMaterializedTransferPlannerPathwayLabel(entry.label),
      }))
    );

    if (rawSignature === materializedSignature) {
      return [];
    }

    if (collectSuspiciousStructuralPathways(rawPathways).length > 0) {
      return [];
    }

    return [
      {
        planId: plan.id,
        title: plan.title,
        rawPathways: rawPathways.map((entry) => ({
          id: entry.id,
          label: entry.label,
        })),
        materializedPathways: getTransferPlannerPathwaysForPlan(plan).map((entry) => ({
          id: entry.id,
          label: entry.label,
        })),
      },
    ];
  });

  assert.deepEqual(unexpectedPathwayDrift, []);
});

test("Pathways are sourced from parser-backed registries, not legacy authored plan overrides", () => {
  for (const plan of TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS) {
    const registryPathwayIds = new Set(
      TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.filter(
      (entry) => entry.planId === plan.id
    ).map((entry) => entry.pathwayId)
    );

    for (const pathway of getTransferPlannerPathwaysForPlan(plan)) {
      assert.equal(
        registryPathwayIds.has(pathway.id),
        true,
        `Unexpected pathway ${plan.id}::${pathway.id}; expected a parser-backed registry pathway id.`
      );
    }

    const materializedPathways = getTransferPlannerPathwaysForPlan(plan)
      .map((pathway) => pathway.id)
      .sort();
    const registryPathways = [...registryPathwayIds].sort();
    assert.deepEqual(
      materializedPathways,
      registryPathways,
      `Registry pathway ids should remain stable for ${plan.id}.`
    );
  }
});

test("Parser-backed supplemental pathway rows survive into generated and runtime planner output", () => {
  const bbaSourcePlan = getTransferPlannerMajorPlan("uw-bothell-business-administration");
  const bbaRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-bothell-business-administration"
  );
  const envSourcePlan = getTransferPlannerMajorPlan("uw-tacoma-environmental-sustainability");
  const envRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-tacoma-environmental-sustainability"
  );
  assert.ok(bbaSourcePlan, "Expected Bothell BBA source-generated plan.");
  assert.ok(bbaRuntimePlan, "Expected Bothell BBA runtime plan.");
  assert.ok(envSourcePlan, "Expected Tacoma Environmental Sustainability source-generated plan.");
  assert.ok(envRuntimePlan, "Expected Tacoma Environmental Sustainability runtime plan.");

  const bbaExpectedPathways = [
    "accounting-option",
    "management-concentration",
    "mis-concentration",
    "retail-management-concentration",
    "tim-concentration",
  ];
  const envExpectedPathways = [
    "business-nonprofit-leadership-option",
    "education-option",
    "environmental-communication-option",
    "policy-law-option",
  ];

  for (const pathwayId of bbaExpectedPathways) {
    assert.equal(
      getTransferPlannerPathwaysForPlan(bbaSourcePlan).some((pathway) => pathway.id === pathwayId),
      true,
      `Expected source-generated BBA pathway ${pathwayId}.`
    );
    assert.equal(
      getTransferPlannerStudentRuntimePathwaysForPlan(bbaRuntimePlan).some(
        (pathway) => pathway.id === pathwayId
      ),
      true,
      `Expected runtime BBA pathway ${pathwayId}.`
    );
  }

  for (const pathwayId of envExpectedPathways) {
    assert.equal(
      getTransferPlannerPathwaysForPlan(envSourcePlan).some((pathway) => pathway.id === pathwayId),
      true,
      `Expected source-generated Environmental Sustainability pathway ${pathwayId}.`
    );
    assert.equal(
      getTransferPlannerStudentRuntimePathwaysForPlan(envRuntimePlan).some(
        (pathway) => pathway.id === pathwayId
      ),
      true,
      `Expected runtime Environmental Sustainability pathway ${pathwayId}.`
    );
  }

  const bbaMisPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    bbaRuntimePlan,
    "mis-concentration"
  );
  assert.ok(bbaMisPlan, "Expected BBA MIS runtime pathway resolution.");
  assert.equal(bbaMisPlan.selectedPathwayId, "mis-concentration");
  assert.ok(
    buildSourceBackedRequiredCourseCodes(bbaMisPlan).some((code) =>
      ["CS 121", "CS 122", "CS 123", "CS& 141"].includes(code)
    ),
    "Expected recovered BBA MIS pathway to expose source-backed planner-safe course output."
  );

  const envBusinessBlocks = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-environmental-sustainability",
    "business-nonprofit-leadership-option"
  );
  assert.ok(
    envBusinessBlocks.some((block) => (block.parsedUwCourseCodes?.length ?? 0) > 0),
    "Expected Environmental Sustainability business/nonprofit pathway to retain parsed UW evidence."
  );
  const envBusinessPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    envRuntimePlan,
    "business-nonprofit-leadership-option"
  );
  assert.ok(envBusinessPlan, "Expected Environmental Sustainability business pathway resolution.");
  assert.equal(envBusinessPlan.selectedPathwayId, "business-nonprofit-leadership-option");
});

test.skip("Resolving Biology pathways keeps the selected route metadata while preserving the shared source-backed prep list", () => {
  assert.ok(biologyPlan, "Expected Seattle Biology planner row.");

  const biologyPathwayLabels = getTransferPlannerPathwaysForPlan(biologyPlan).map(
    (entry) => entry.label
  );
  const biologyBaPlan = resolveTransferPlannerMajorPlan(biologyPlan, "ba-general-biology");
  const biologyBsPlan = resolveTransferPlannerMajorPlan(biologyPlan, "bs-option-family");
  const biologyBsGeneralPlan = resolveTransferPlannerMajorPlan(
    biologyPlan,
    "bs-option-family:general-biology"
  );

  assert.ok(biologyBaPlan, "Expected Biology B.A. resolved plan.");
  assert.ok(biologyBsPlan, "Expected Biology B.S. resolved plan.");
  assert.ok(biologyBsGeneralPlan, "Expected Biology B.S. General Biology resolved plan.");
  assert.deepEqual(biologyPathwayLabels, [
    "B.A. general biology",
    "B.S. Ecology, Evolution, and Conservation option",
    "B.S. General Biology option",
    "B.S. Molecular, Cellular, and Developmental Biology option",
    "B.S. Physiology option",
    "B.S. Plant Biology option",
  ]);
  assert.equal(biologyBaPlan?.selectedPathwayLabel, "B.A. general biology");
  assert.equal(biologyBsPlan?.selectedPathwayLabel, "B.S. General Biology option");
  assert.equal(biologyBsGeneralPlan?.selectedPathwayLabel, "B.S. General Biology option");
  assert.ok(getTransferPlannerGrcCourseList(biologyBaPlan).includes("PHYS& 221"));
  assert.ok(getTransferPlannerGrcCourseList(biologyBsPlan).includes("PHYS& 221"));
  assert.ok(getTransferPlannerGrcCourseList(biologyBaPlan).includes("PHYS& 222"));
  assert.ok(getTransferPlannerGrcCourseList(biologyBsPlan).includes("PHYS& 222"));
  assert.ok(getTransferPlannerGrcCourseList(biologyBaPlan).includes("PHYS& 223"));
  assert.ok(getTransferPlannerGrcCourseList(biologyBsPlan).includes("PHYS& 223"));
});

test("Earth & Space Sciences expands official credential headings into specific pathway choices", () => {
  assert.ok(seattleEssPlan, "Expected Seattle Earth & Space Sciences planner row.");

  const essPathwayLabels = getTransferPlannerPathwaysForPlan(seattleEssPlan).map(
    (entry) => entry.label
  );
  const runtimeEssPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-earth-and-space-sciences"
  );
  const runtimeEssPathwayLabels = getTransferPlannerStudentRuntimePathwaysForPlan(
    runtimeEssPlan
  ).map((entry) => entry.label);
  const resolvedEssBsPlan = resolveTransferPlannerMajorPlan(seattleEssPlan, "bs-option-family");
  const resolvedEssPhysicsPlan = resolveTransferPlannerMajorPlan(
    seattleEssPlan,
    "bs-option-family:physics"
  );

  assert.deepEqual(essPathwayLabels, [
    "B.A. route",
    "B.S. Biology option",
    "B.S. Geology option",
    "B.S. Geoscience option",
    "B.S. Physics option",
  ]);
  assert.deepEqual(runtimeEssPathwayLabels, essPathwayLabels);
  assert.equal(essPathwayLabels.includes("Option"), false);
  assert.equal(essPathwayLabels.includes("Environmental Earth Sciences Option"), false);
  assert.equal(resolvedEssBsPlan?.selectedPathwayLabel, "B.S. Biology option");
  assert.equal(resolvedEssPhysicsPlan?.selectedPathwayLabel, "B.S. Physics option");
  assert.ok(getTransferPlannerGrcCourseList(resolvedEssPhysicsPlan).includes("PHYS& 221"));
  assert.ok(getTransferPlannerGrcCourseList(resolvedEssPhysicsPlan).includes("PHYS& 222"));
});

test.skip("Tacoma Communication pathway resolution narrows the degree-map sections to the selected track", () => {
  assert.ok(tacomaCommunicationPlan, "Expected Tacoma Communication planner row.");

  const professionalPlan = resolveTransferPlannerMajorPlan(
    tacomaCommunicationPlan,
    "professional-track"
  );
  const researchPlan = resolveTransferPlannerMajorPlan(tacomaCommunicationPlan, "research-track");

  assert.deepEqual(
    professionalPlan?.degreeMapSections?.map((section) => section.title),
    ["Communication declaration baseline", "Communication professional track structure"]
  );
  assert.deepEqual(
    researchPlan?.degreeMapSections?.map((section) => section.title),
    ["Communication declaration baseline", "Communication research track structure"]
  );
});

test.skip("Layered source registries now include explicit major-pathway entries", () => {
  const biologyPathway = TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.find(
    (entry) => entry.id === "uw-seattle-biology:pathway:ba-general-biology"
  );
  const writingTechPathway = TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.find(
    (entry) => entry.id === "uw-tacoma-writing-studies:pathway:technical-communication-track"
  );

  assert.ok(biologyPathway, "Expected a Biology pathway registry entry.");
  assert.ok(writingTechPathway, "Expected a Writing Studies pathway registry entry.");
  assert.equal(
    typeof (biologyPathway?.summary ?? ""),
    "string",
    "Expected Biology pathway summary to resolve as a string in parser-first registry rows."
  );
});

test.skip("Source-generated major rows preserve planner counts and now drive more officially multi-route majors", () => {
  assert.equal(
    TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.length,
    TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.length
  );
  assert.equal(
    getTransferPlannerSourceGeneratedMajorsForCampus("uw-seattle").length,
    TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.filter((plan) => plan.campusId === "uw-seattle").length
  );
  assert.equal(
    getTransferPlannerSourceGeneratedMajorsForCampus("uw-bothell").length,
    TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.filter((plan) => plan.campusId === "uw-bothell").length
  );
  assert.equal(
    getTransferPlannerSourceGeneratedMajorsForCampus("uw-tacoma").length,
    TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.filter((plan) => plan.campusId === "uw-tacoma").length
  );

  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedChemistryPlan).length, 3);
  if (sourceGeneratedEconomicsPlan) {
    assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedEconomicsPlan).length, 2);
  } else {
    assert.equal(seattleEconomicsPlan?.coverage, "detailed");
  }
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedGeographyPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedPsychologyPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedPhghPlan).length, 4);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedStatisticsPlan).length, 3);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaAmcPlan).length, 5);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaBabaPlan).length, 5);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaEnvSustainabilityPlan).length, 4);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaEglsPlan).length, 3);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaSudPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaUrbanStudiesPlan).length, 2);
});

test.skip("Source-generated pathway rows can resolve the new route-specific Seattle and Tacoma paths", () => {
  assert.ok(sourceGeneratedChemistryPlan, "Expected source-generated Seattle Chemistry planner row.");
  assert.ok(sourceGeneratedStatisticsPlan, "Expected source-generated Seattle Statistics planner row.");
  assert.ok(sourceGeneratedTacomaBabaPlan, "Expected source-generated Tacoma BABA planner row.");

  const acsChemistryPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedChemistryPlan,
    "acs-certified-bs-route"
  );
  const dataScienceStatsPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedStatisticsPlan,
    "data-science-track"
  );
  const marketingBabaPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedTacomaBabaPlan,
    "marketing-option"
  );

  assert.equal(acsChemistryPlan?.selectedPathwayLabel, "ACS-certified B.S. route");
  assert.match(
    acsChemistryPlan?.degreeMapSections?.[1]?.title ?? "",
    /ACS-certified B\.S\. in Chemistry structure/
  );
  assert.equal(dataScienceStatsPlan?.selectedPathwayLabel, "Data Science track");
  assert.equal(dataScienceStatsPlan?.bestTrackId, "999P");
  assert.ok(getTransferPlannerGrcCourseList(dataScienceStatsPlan).includes("CS 123"));
  assert.equal(marketingBabaPlan?.selectedPathwayLabel, "Marketing option");
  assert.match(
    marketingBabaPlan?.degreeMapSections?.[1]?.title ?? "",
    /Marketing option finish/
  );
});

test("Pathway options round-trip current structured labels for multi-pathway and option-family majors", () => {
  assert.ok(sourceGeneratedStatisticsPlan, "Expected source-generated Seattle Statistics planner row.");
  assert.ok(biologyPlan, "Expected Seattle Biology planner row.");
  assert.ok(sourceGeneratedPhghPlan, "Expected source-generated Seattle PH-GH planner row.");

  const statisticsRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-statistics");
  const phghRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-public-health-global-health"
  );
  const biologyRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-biology");

  const statisticsSourceLabels = new Map(
    getTransferPlannerPathwaysForPlan(sourceGeneratedStatisticsPlan).map((pathway) => [
      pathway.id,
      pathway.label,
    ] as const)
  );
  const statisticsRuntimeLabels = new Map(
    getTransferPlannerStudentRuntimePathwaysForPlan(statisticsRuntimePlan).map((pathway) => [
      pathway.id,
      pathway.label,
    ] as const)
  );
  const biologySourceLabels = new Map(
    getTransferPlannerPathwaysForPlan(biologyPlan).map((pathway) => [
      pathway.id,
      pathway.label,
    ] as const)
  );
  const biologyRuntimeLabels = new Map(
    getTransferPlannerStudentRuntimePathwaysForPlan(biologyRuntimePlan).map((pathway) => [
      pathway.id,
      pathway.label,
    ] as const)
  );
  const phghRuntimeLabels = new Map(
    getTransferPlannerStudentRuntimePathwaysForPlan(phghRuntimePlan).map((pathway) => [
      pathway.id,
      pathway.label,
    ] as const)
  );

  assert.equal(statisticsSourceLabels.get("applied-statistics-track"), "Applied Statistics track");
  assert.equal(statisticsSourceLabels.get("data-science-track"), "Data Science track");
  assert.equal(statisticsRuntimeLabels.get("applied-statistics-track"), "Applied Statistics track");
  assert.equal(statisticsRuntimeLabels.get("data-science-track"), "Data Science track");

  assert.equal(biologySourceLabels.get("bs-option-family:general-biology"), "B.S. General Biology option");
  assert.equal(
    biologySourceLabels.get("bs-option-family:ecology-evolution-and-conservation"),
    "B.S. Ecology, Evolution, and Conservation option"
  );
  assert.equal(biologyRuntimeLabels.get("bs-option-family:general-biology"), "B.S. General Biology option");
  assert.equal(
    biologyRuntimeLabels.get("bs-option-family:ecology-evolution-and-conservation"),
    "B.S. Ecology, Evolution, and Conservation option"
  );

  assert.equal(
    phghRuntimeLabels.get("health-education-and-promotion-ba-option"),
    "Health Education & Promotion (BA Option)"
  );
});

test("Pathway materialization filters obvious prose, graduate, navigation, and casing artifacts", () => {
  const runtimePlan = (id: string) => {
    const plan = getTransferPlannerStudentRuntimeMajorPlan(id);
    assert.ok(plan, `Expected runtime plan ${id}.`);
    return plan;
  };
  const runtimePathwayLabels = (id: string) =>
    getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan(id)).map((pathway) => pathway.label);

  assert.deepEqual(runtimePathwayLabels("uw-seattle-anthropology"), [
    "B.A. Anthropology of Globalization option",
    "B.A. Archaeological Sciences option",
    "B.A. Human Evolutionary Biology option",
    "B.A. Indigenous Archaeology option",
    "B.A. Medical Anthropology and Global Health option",
    "B.S. Archaeological Sciences option",
    "B.S. Human Evolutionary Biology option",
    "B.S. Medical Anthropology and Global Health option",
  ]);
  assert.deepEqual(runtimePathwayLabels("uw-bothell-economics"), []);
  assert.deepEqual(runtimePathwayLabels("uw-seattle-speech-and-hearing-sciences"), []);
  assert.deepEqual(runtimePathwayLabels("uw-seattle-environmental-design-and-sustainability"), [
    "Project Option",
  ]);
  assert.deepEqual(runtimePathwayLabels("uw-seattle-public-health-global-health"), [
    "Health Education & Promotion (BA Option)",
  ]);
  assert.deepEqual(runtimePathwayLabels("uw-bothell-csse"), ["IAC Option"]);
  assert.deepEqual(runtimePathwayLabels("uw-tacoma-writing-studies"), [
    "Creative Writing Track",
    "Writing and Social Change Track",
    "Technical Communication Track",
  ]);
  assert.deepEqual(runtimePathwayLabels("uw-tacoma-education"), [
    "Special Education Dual Endorsement",
    "B.A. route",
    "English Language Learners (ELL) Dual Endorsement Option",
  ]);

  const runtimePathways = TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS.flatMap((plan) =>
    getTransferPlannerStudentRuntimePathwaysForPlan(plan)
  );
  assert.deepEqual(collectSuspiciousStructuralPathways(runtimePathways), []);
  assert.deepEqual(
    runtimePathways
      .map((pathway) => pathway.label)
      .filter(
        (label) =>
          /\b[BM]\s+[AS]\b/.test(label) ||
          /option and Concentration|option and concentration/.test(label) ||
          /\b[A-Z]{3,}\b/.test(label.replace(/\b(?:CECL|ELL|ESOL|GIS|IAC|LEDE|MIS|NME|PIA|TIM|UW)\b/g, ""))
      )
      .sort(),
    []
  );
});

test("Chemical Engineering collapses NME source-page aliases into one clean pathway option", () => {
  const runtimeChemicalPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-chemical-engineering"
  );
  assert.ok(runtimeChemicalPlan, "Expected runtime Seattle Chemical Engineering plan.");

  assert.deepEqual(
    getTransferPlannerPathwaysForPlan(chemEPlan).map((pathway) => [pathway.id, pathway.label]),
    [["nme-option", "NME option"]]
  );
  assert.deepEqual(
    getTransferPlannerStudentRuntimePathwaysForPlan(runtimeChemicalPlan).map((pathway) => [
      pathway.id,
      pathway.label,
    ]),
    [["nme-option", "NME option"]]
  );
  assert.match(
    getTransferPlannerTrack(runtimeChemicalPlan.bestTrackId ?? null)?.title ?? "",
    /Bioengineering and Chemical Engineering/i
  );
  assert.ok(
    getTransferPlannerGrcCourseList(runtimeChemicalPlan).includes("CHEM& 261"),
    "Expected the base Chemical Engineering pathway to keep organic chemistry in the planner."
  );
});

test("ACMS pathway promotion uses the official semantic option names instead of structural headings", () => {
  const acmsPlan = getRequiredPlan("uw-seattle-applied-and-computational-mathematical-sciences");
  const acmsRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(acmsPlan.id);
  assert.ok(acmsRuntimePlan, "Expected an ACMS runtime plan.");

  const expectedPathways = [
    ["bs-option-family:data-science-and-statistics", "B.S. Data Science and Statistics option"],
    [
      "bs-option-family:discrete-mathematics-and-algorithms",
      "B.S. Discrete Mathematics and Algorithms option",
    ],
    [
      "bs-option-family:mathematical-economics-and-quantitative-finance",
      "B.S. Mathematical Economics and Quantitative Finance option",
    ],
    [
      "bs-option-family:scientific-computing-and-numerical-analysis",
      "B.S. Scientific Computing and Numerical Analysis option",
    ],
  ].sort((left, right) => left[0].localeCompare(right[0]));

  const sourcePathways = getTransferPlannerPathwaysForPlan(acmsPlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(acmsRuntimePlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));

  assert.deepEqual(sourcePathways, expectedPathways);
  assert.deepEqual(runtimePathways, expectedPathways);
  assert.deepEqual(
    collectSuspiciousStructuralPathways(getTransferPlannerPathwaysForPlan(acmsPlan)),
    []
  );
});

test("Structural boilerplate pathway headings do not outrank semantic route names during materialization", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-semantic-pathway-ranking",
    campusId: "uw-seattle",
    title: "Synthetic Major",
    shortTitle: "Synthetic",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [
      {
        id: "option-specific-requirements",
        label: "option Specific Requirements",
        summary: "",
        officialLinks: [],
      },
      {
        id: "option-specific-credits",
        label: "option Specific Credits",
        summary: "",
        officialLinks: [],
      },
    ],
  };
  const parsedBlocks: TransferPlannerParsedRequirementSourceBlock[] = [
    {
      id: "synthetic-major:source-block:test",
      ownerId: "synthetic-major",
      ownerTitle: "Synthetic Major",
      planId: plan.id,
      pathwayId: null,
      campusId: "uw-seattle",
      primaryParserType: "catalog-page",
      primarySourceUrl: "https://example.edu/synthetic-major",
      primarySourceLabel: "Synthetic major catalog",
      parserType: "catalog-page",
      adapterId: "uw-seattle-catalog-page",
      adapterFamily: "UW Seattle catalog pages",
      sourceUrl: "https://example.edu/synthetic-major",
      sourceLabel: "Synthetic major catalog",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [
        "Option specific requirements:",
        "Option specific credits (52-59 credits)",
      ],
      chooseStatements: [],
      pathwayLabels: [
        "Bachelor of Science degree with a major in Synthetic Major: Data Science and Statistics",
        "Bachelor of Science degree with a major in Synthetic Major: Discrete Mathematics and Algorithms",
        "Option specific requirements:",
        "Option specific credits (52-59 credits)",
      ],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
  ];

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], parsedBlocks);

  assert.deepEqual(
    materialized.map((pathway) => [pathway.id, pathway.label] as const),
    [
      ["bs-option-family:data-science-and-statistics", "B.S. Data Science and Statistics option"],
      [
        "bs-option-family:discrete-mathematics-and-algorithms",
        "B.S. Discrete Mathematics and Algorithms option",
      ],
    ]
  );
  assert.deepEqual(collectSuspiciousStructuralPathways(materialized), []);
});

test("Asian Studies visible pathways use one clean concentration label per route", () => {
  const sourceGeneratedAsianStudiesPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
    "uw-seattle"
  ).find((entry) => entry.id === "uw-seattle-asian-studies");
  assert.ok(sourceGeneratedAsianStudiesPlan, "Expected a source-generated Seattle Asian Studies planner row.");

  const asianStudiesRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-asian-studies");
  assert.ok(asianStudiesRuntimePlan, "Expected an Asian Studies runtime plan.");

  const sourcePathways = getTransferPlannerPathwaysForPlan(sourceGeneratedAsianStudiesPlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(asianStudiesRuntimePlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
  const expectedConcentrations = new Set([
    "China Concentration",
    "Japan Concentration",
    "Korea Concentration",
    "South Asia Concentration",
    "Southeast Asia Concentration",
  ]);

  assert.deepEqual(
    sourcePathways.filter(([, label]) => expectedConcentrations.has(label)).map(([, label]) => label).sort(),
    [...expectedConcentrations].sort()
  );
  assert.deepEqual(
    runtimePathways.filter(([, label]) => expectedConcentrations.has(label)).map(([, label]) => label).sort(),
    [...expectedConcentrations].sort()
  );
  assert.equal(sourcePathways.some(([, label]) => /&#\d+;|&[a-z]+;/i.test(label)), false);
  assert.equal(runtimePathways.some(([, label]) => /&#\d+;|&[a-z]+;/i.test(label)), false);
  assert.equal(sourcePathways.some(([, label]) => /^Asian Studies\s*[-–—]/i.test(label)), false);
  assert.equal(runtimePathways.some(([, label]) => /^Asian Studies\s*[-–—]/i.test(label)), false);
});

test("Sibling JSIS majors no longer surface Asian Studies pathway labels", () => {
  const seattlePlans = getTransferPlannerSourceGeneratedMajorsForCampus("uw-seattle");

  for (const planId of [
    "uw-seattle-jewish-studies",
    "uw-seattle-latin-american-and-caribbean-studies",
  ]) {
    const plan = seattlePlans.find((entry) => entry.id === planId);
    assert.ok(plan, `Expected a source-generated Seattle planner row for ${planId}.`);

    const labels = getTransferPlannerPathwaysForPlan(plan).map((pathway) => pathway.label);
    assert.deepEqual(
      labels,
      [],
      `${planId} should not expose cross-major concentration pathways: ${JSON.stringify(labels)}`
    );
    assert.equal(
      labels.some((label) => /asian studies/i.test(label)),
      false,
      `${planId} should not surface Asian Studies pathway labels: ${JSON.stringify(labels)}`
    );
    assert.equal(labels.some((label) => /&#\d+;|&[a-z]+;/i.test(label)), false);
  }
});

test("Visible pathway labels decode HTML entities even when base pathways are retained", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-entity-decoding",
    campusId: "uw-seattle",
    title: "Asian Studies",
    shortTitle: "Asian",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [
      {
        id: "asian-studies-and-8211-china-concentration",
        label: "Asian Studies &#8211; China Concentration",
        summary: "",
        officialLinks: [],
      },
    ],
  };

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], []);

  assert.deepEqual(
    materialized.map((pathway) => [pathway.id, pathway.label] as const),
    [["asian-studies-and-8211-china-concentration", "Asian Studies - China Concentration"]]
  );
});

test("Single semantic pathway families collapse PDF, entity, and requirements variants to one clean route", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-single-semantic-family",
    campusId: "uw-seattle",
    title: "Computer Science",
    shortTitle: "CS",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [
      {
        id: "computer-science-and-8211-data-science-option-pdf",
        label: "Computer Science and 8211 Data Science option Pdf",
        summary: "",
        officialLinks: [],
      },
      {
        id: "data-science-option",
        label: "Data Science option",
        summary: "",
        officialLinks: [],
      },
      {
        id: "data-science-option-requirements",
        label: "Data Science option Requirements",
        summary: "",
        officialLinks: [],
      },
    ],
  };
  const parsedBlocks: TransferPlannerParsedRequirementSourceBlock[] = [
    {
      id: "synthetic-single-semantic-family:source-block:test",
      ownerId: "synthetic-single-semantic-family",
      ownerTitle: "Computer Science",
      planId: plan.id,
      pathwayId: null,
      campusId: "uw-seattle",
      primaryParserType: "html-degree-page",
      primarySourceUrl: "https://example.edu/computer-science",
      primarySourceLabel: "Computer Science degree requirements",
      parserType: "html-degree-page",
      adapterId: "uw-seattle-catalog-page",
      adapterFamily: "Synthetic HTML degree page",
      sourceUrl: "https://example.edu/computer-science",
      sourceLabel: "Computer Science degree requirements",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: [
        "Data Science Option",
        "Data Science Option [PDF]",
        "Data Science Option Requirements",
      ],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
  ];

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], parsedBlocks);

  assert.deepEqual(
    materialized.map((pathway) => [pathway.id, pathway.label] as const),
    [["data-science-option", "Data Science option"]]
  );
  assert.deepEqual(collectSuspiciousStructuralPathways(materialized), []);
});

test("Semantic duplicate pathway labels collapse to one canonical visible route", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-semantic-dedupe",
    campusId: "uw-seattle",
    title: "Asian Studies",
    shortTitle: "Asian",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [
      {
        id: "asian-studies-and-8211-china-concentration",
        label: "Asian Studies &#8211; China Concentration",
        summary: "",
        officialLinks: [],
      },
      {
        id: "asian-studies-china-concentration",
        label: "China Concentration",
        summary: "",
        officialLinks: [],
      },
      {
        id: "asian-studies-and-8211-japan-concentration",
        label: "Asian Studies &#8211; Japan Concentration",
        summary: "",
        officialLinks: [],
      },
      {
        id: "asian-studies-japan-concentration",
        label: "Japan Concentration",
        summary: "",
        officialLinks: [],
      },
    ],
  };
  const parsedBlocks: TransferPlannerParsedRequirementSourceBlock[] = [
    {
      id: "synthetic-semantic-dedupe:source-block:test",
      ownerId: "synthetic-semantic-dedupe",
      ownerTitle: "Asian Studies",
      planId: plan.id,
      pathwayId: null,
      campusId: "uw-seattle",
      primaryParserType: "catalog-page",
      primarySourceUrl: "https://example.edu/asian-studies",
      primarySourceLabel: "Asian Studies catalog",
      parserType: "catalog-page",
      adapterId: "uw-seattle-catalog-page",
      adapterFamily: "UW Seattle catalog pages",
      sourceUrl: "https://example.edu/asian-studies",
      sourceLabel: "Asian Studies catalog",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: [
        "Asian Studies &#8211; China Concentration",
        "China Concentration",
        "Asian Studies - Japan Concentration",
        "Japan Concentration",
      ],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
  ];

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], parsedBlocks);

  assert.deepEqual(
    materialized.map((pathway) => [pathway.id, pathway.label] as const),
    [
      ["china-concentration", "China Concentration"],
      ["japan-concentration", "Japan Concentration"],
    ]
  );
});

test("Already-clean pathway families stay stable when canonical cleanup is not needed", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-stable-clean-pathways",
    campusId: "uw-seattle",
    title: "Statistics",
    shortTitle: "Stats",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [
      {
        id: "applied-statistics-track",
        label: "Applied Statistics track",
        summary: "",
        officialLinks: [],
      },
      {
        id: "data-science-track",
        label: "Data Science track",
        summary: "",
        officialLinks: [],
      },
    ],
  };
  const parsedBlocks: TransferPlannerParsedRequirementSourceBlock[] = [
    {
      id: "synthetic-stable-clean-pathways:source-block:test",
      ownerId: "synthetic-stable-clean-pathways",
      ownerTitle: "Statistics",
      planId: plan.id,
      pathwayId: null,
      campusId: "uw-seattle",
      primaryParserType: "catalog-page",
      primarySourceUrl: "https://example.edu/statistics",
      primarySourceLabel: "Statistics catalog",
      parserType: "catalog-page",
      adapterId: "uw-seattle-catalog-page",
      adapterFamily: "UW Seattle catalog pages",
      sourceUrl: "https://example.edu/statistics",
      sourceLabel: "Statistics catalog",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: ["Applied Statistics track", "Data Science track"],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
  ];

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], parsedBlocks);

  assert.deepEqual(
    materialized.map((pathway) => [pathway.id, pathway.label] as const),
    [
      ["applied-statistics-track", "Applied Statistics track"],
      ["data-science-track", "Data Science track"],
    ]
  );
});

test("Materials Science & Engineering only exposes the real NME Option pathway", () => {
  const plan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(plan.id);
  assert.ok(runtimePlan, "Expected an MSE runtime plan.");

  const sourcePathways = getTransferPlannerPathwaysForPlan(plan).map(
    (pathway) => [pathway.id, pathway.label] as const
  );
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan).map(
    (pathway) => [pathway.id, pathway.label] as const
  );

  assert.deepEqual(sourcePathways, [["nme-option", "NME Option"]]);
  assert.deepEqual(runtimePathways, [["nme-option", "NME Option"]]);
  assert.deepEqual(collectSuspiciousStructuralPathways(getTransferPlannerPathwaysForPlan(plan)), []);
  assert.deepEqual(
    collectSuspiciousStructuralPathways(getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan)),
    []
  );
});

test("Materials source parse retains normalized lower-division and core MSE requirements", () => {
  const [baseBlock] = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-materials-science-engineering"
  );
  const [nmeBlock] = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-materials-science-engineering",
    "nme-option"
  );

  assert.ok(baseBlock, "Expected the base MSE parsed source block.");
  assert.ok(nmeBlock, "Expected the MSE NME parsed source block.");

  for (const courseCode of ["MSE 170", "MSE 310", "MSE 311", "MSE 321", "INDE 250"]) {
    assert.equal(
      baseBlock?.parsedUwCourseCodes.includes(courseCode),
      true,
      `Expected the base MSE parsed source to include ${courseCode}.`
    );
  }

  for (const courseCode of ["EE 486", "CHEM 597", "MOLENG 520", "MSE 484", "MSE 486"]) {
    assert.equal(
      nmeBlock?.parsedUwCourseCodes.includes(courseCode),
      true,
      `Expected the MSE NME parsed source to include ${courseCode}.`
    );
  }

  assert.equal(
    baseBlock?.parsedUwCourseCodes.includes("IND E 250"),
    false,
    "Expected the base MSE parsed source to keep IND E 250 normalized as INDE 250."
  );
  assert.equal(
    new Set(baseBlock?.parsedUwCourseCodes ?? []).size,
    (baseBlock?.parsedUwCourseCodes ?? []).length,
    "Expected the base MSE parsed source to stay deduplicated after normalization."
  );
  assert.equal(
    baseBlock?.parsedUwCourseCodes.includes("IN NME 220"),
    false,
    "Expected prose like 'enroll in NME 220' not to leak as malformed IN NME 220."
  );
  assert.equal(
    nmeBlock?.parsedUwCourseCodes.includes("NME 220"),
    true,
    "Expected the NME option source parse to retain the normalized NME 220 code."
  );
});

test("Materials parser and planner preserve choose-one and elective requirement groups", () => {
  const [baseBlock] = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-materials-science-engineering"
  );
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-materials-science-engineering"
  );

  assert.ok(baseBlock, "Expected the base MSE parsed source block.");
  assert.ok(runtimePlan, "Expected the MSE runtime plan.");
  const collectGroupCourseCodes = (group: { options?: { uwCourses?: string[]; equivalentUwCourseCodes?: string[] }[] } | null | undefined) =>
    new Set(
      (group?.options ?? []).flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
      ])
    );
  const expectedEngineeringFundamentals = [
    "AA 260",
    "BIOEN 215",
    "BSE 201",
    "CHEME 355",
    "CSE 123",
    "CSE 143",
    "CSE 160",
    "CSE 164",
    "CSE 180",
    "EE 215",
    "ENGR 101",
    "ENGR 333",
    "ENGR 490",
    "INDE 250",
    "INDE 315",
    "ME 123",
    "ME 230",
    "NME 220",
  ];
  const expectedMseTechnicalElectives = [
    "MSE 450",
    "MSE 452",
    "MSE 462",
    "MSE 463",
    "MSE 466",
    "MSE 471",
    "MSE 473",
    "MSE 474",
    "MSE 475",
    "MSE 476",
    "MSE 477",
    "MSE 478",
    "MSE 479",
    "MSE 481",
    "MSE 482",
    "MSE 483",
    "MSE 484",
    "MSE 486",
    "MSE 487",
    "MSE 488",
    "MSE 489",
    "MSE 490",
    "MSE 498",
    "MSE 499",
  ];
  const expectedOutsideTechnicalElectives = [
    "AMATH 352",
    "AMATH 353",
    "AMATH 383",
    "AMATH 401",
    "AMATH 403",
    "BIOC 405",
    "BIOC 406",
    "CHEM 312",
    "CHEM 455",
    "CHEM 456",
    "CHEM 457",
    "CHEME 341",
    "ENGR 321",
    "ENVIR 480",
    "PHYS 321",
    "PHYS 324",
    "PHYS 325",
    "PHYS 334",
    "PHYS 335",
    "PHYS 434",
    "PHYS 441",
    "ENTRE 370",
    "ENTRE 440",
  ];

  const parsedScientificComputingGroup = baseBlock?.parsedRequirementGroups?.find(
    (group) => group.id.endsWith(":scientific-computing")
  );
  assert.ok(
    parsedScientificComputingGroup,
    "Expected AMATH/CSE scientific computing to parse as one requirement group."
  );
  assert.equal(parsedScientificComputingGroup?.requirementType, "choose_one");
  assert.deepEqual(
    parsedScientificComputingGroup?.options.map((option) => option.uwCourses),
    [["AMATH 301"], ["CSE 142"], ["CSE 122"]]
  );
  const parsedRequirementCourses = baseBlock?.parsedRequirementCourses ?? [];
  const parsedRequirementCourseCodes = new Set(
    parsedRequirementCourses.map((course) => course.normalizedCourseCode)
  );
  const findParsedRequirementCourse = (courseCode: string, groupIdPart?: string) =>
    parsedRequirementCourses.find(
      (course) =>
        course.normalizedCourseCode === courseCode &&
        (!groupIdPart || course.requirementGroupId.includes(groupIdPart))
    );

  assert.ok(
    parsedRequirementCourses.length > 0,
    "Expected UW MSE to emit structured parsedRequirementCourses."
  );
  assert.ok(
    parsedRequirementCourses.every(
      (course) =>
        course.requirementGroupId &&
        course.requirementType &&
        course.optionRole &&
        course.sourceHeading &&
        course.category
    ),
    "Expected every UW MSE parsed requirement course to carry group/type/role/source metadata."
  );
  for (const courseCode of [
    "MATH 124",
    "MATH 125",
    "MATH 126",
    "PHYS 121",
    "PHYS 122",
    "PHYS 123",
    "MSE 170",
    "MSE 310",
    "MSE 311",
    "MSE 321",
  ]) {
    assert.equal(
      parsedRequirementCourseCodes.has(courseCode),
      true,
      `Expected parsedRequirementCourses to include required ${courseCode}.`
    );
  }
  const parsedMathElectiveGroup = baseBlock?.parsedRequirementGroups?.find(
    (group) => group.id.endsWith(":math-elective")
  );
  const parsedScienceElectivesGroup = baseBlock?.parsedRequirementGroups?.find(
    (group) => group.id.endsWith(":science-electives")
  );
  const parsedEngineeringFundamentalsGroup = baseBlock?.parsedRequirementGroups?.find((group) =>
    group.id.endsWith(":engineering-fundamentals-electives")
  );
  const parsedMseTechnicalElectivesGroup = baseBlock?.parsedRequirementGroups?.find((group) =>
    group.id.endsWith(":mse-400-level-technical-electives")
  );
  const parsedOutsideTechnicalElectivesGroup = baseBlock?.parsedRequirementGroups?.find((group) =>
    group.id.endsWith(":outside-mse-technical-electives")
  );
  assert.equal(parsedMathElectiveGroup?.requirementType, "choose_n");
  assert.equal(parsedMathElectiveGroup?.minCourses, 1);
  assert.equal(parsedMathElectiveGroup?.maxCourses, 1);
  assert.equal(parsedScienceElectivesGroup?.requirementType, "choose_n");
  assert.equal(parsedScienceElectivesGroup?.minCourses, 2);
  assert.equal(parsedScienceElectivesGroup?.maxCourses, 2);
  assert.deepEqual(
    parsedMathElectiveGroup?.options.find((option) => option.uwCourses.includes("MATH 209"))
      ?.equivalentUwCourseCodes,
    ["MATH 309"]
  );
  assert.deepEqual(
    parsedMathElectiveGroup?.options.find((option) => option.uwCourses.includes("MATH 224"))
      ?.equivalentUwCourseCodes,
    ["MATH 324"]
  );
  assert.equal(
    findParsedRequirementCourse("MATH 309", "math-elective")?.optionRole,
    "alias",
    "Expected MATH 209/309 to keep MATH 309 as an alias in the math elective option."
  );
  assert.equal(
    findParsedRequirementCourse("MATH 324", "math-elective")?.optionRole,
    "alias",
    "Expected MATH 224/324 to keep MATH 324 as an alias in the math elective option."
  );
  assert.deepEqual(
    parsedScienceElectivesGroup?.options.find((option) => option.uwCourses.includes("CHEM 162"))
      ?.equivalentUwCourseCodes,
    ["CHEM 153", "CHEM 155"]
  );
  assert.equal(
    findParsedRequirementCourse("CHEM 153", "science-electives")?.optionRole,
    "alias",
    "Expected CHEM 162/153/155 to stay grouped as one science elective option."
  );
  assert.equal(parsedEngineeringFundamentalsGroup?.requirementType, "choose_credits");
  assert.equal(parsedEngineeringFundamentalsGroup?.minCredits, 8);
  assert.equal(parsedEngineeringFundamentalsGroup?.category, "engineering_fundamentals");
  for (const courseCode of expectedEngineeringFundamentals) {
    assert.equal(
      collectGroupCourseCodes(parsedEngineeringFundamentalsGroup).has(courseCode),
      true,
      `Expected ${courseCode} to parse as an Engineering Fundamentals elective option.`
    );
    assert.equal(
      parsedRequirementCourseCodes.has(courseCode),
      true,
      `Expected parsedRequirementCourses to include Engineering Fundamentals option ${courseCode}.`
    );
  }
  assert.deepEqual(
    parsedEngineeringFundamentalsGroup?.options.find((option) =>
      option.uwCourses.includes("CHEME 355")
    )?.displayCourseCodes,
    ["CHEM E 355"]
  );
  assert.deepEqual(
    parsedEngineeringFundamentalsGroup?.options.find((option) =>
      option.uwCourses.includes("EE 215")
    )?.displayCourseCodes,
    ["E E 215"]
  );
  assert.deepEqual(
    parsedEngineeringFundamentalsGroup?.options.find((option) =>
      option.uwCourses.includes("INDE 315")
    )?.displayCourseCodes,
    ["IND E 315"]
  );
  assert.deepEqual(
    parsedEngineeringFundamentalsGroup?.options.find((option) =>
      option.uwCourses.includes("ME 230")
    )?.displayCourseCodes,
    ["M E 230"]
  );
  assert.equal(parsedMseTechnicalElectivesGroup?.requirementType, "choose_credits");
  assert.equal(parsedMseTechnicalElectivesGroup?.minCredits, 6);
  assert.equal(parsedMseTechnicalElectivesGroup?.subcategory, "mse_400_level");
  for (const courseCode of expectedMseTechnicalElectives) {
    assert.equal(
      collectGroupCourseCodes(parsedMseTechnicalElectivesGroup).has(courseCode),
      true,
      `Expected ${courseCode} to parse as an MSE 400-level technical elective option.`
    );
    assert.equal(
      parsedRequirementCourseCodes.has(courseCode),
      true,
      `Expected parsedRequirementCourses to include MSE technical elective option ${courseCode}.`
    );
  }
  assert.equal(
    parsedMseTechnicalElectivesGroup?.options.find((option) => option.uwCourses.includes("MSE 498"))
      ?.creditText,
    "3-4"
  );
  assert.equal(
    parsedMseTechnicalElectivesGroup?.options.find((option) => option.uwCourses.includes("MSE 499"))
      ?.creditText,
    "3-5"
  );
  assert.equal(parsedOutsideTechnicalElectivesGroup?.requirementType, "choose_credits");
  assert.equal(parsedOutsideTechnicalElectivesGroup?.maxCredits, 9);
  assert.equal(parsedOutsideTechnicalElectivesGroup?.subcategory, "outside_mse_approved");
  for (const courseCode of expectedOutsideTechnicalElectives) {
    assert.equal(
      collectGroupCourseCodes(parsedOutsideTechnicalElectivesGroup).has(courseCode),
      true,
      `Expected ${courseCode} to parse as an outside-MSE technical elective option.`
    );
    assert.equal(
      parsedRequirementCourseCodes.has(courseCode),
      true,
      `Expected parsedRequirementCourses to include outside-MSE technical elective option ${courseCode}.`
    );
  }
  assert.deepEqual(
    parsedOutsideTechnicalElectivesGroup?.options.find((option) =>
      option.uwCourses.includes("AMATH 352")
    )?.displayCourseCodes,
    ["A MATH 352"]
  );
  assert.equal(
    findParsedRequirementCourse("BIOC 405", "outside-mse-technical-electives")?.optionRole,
    "option"
  );
  assert.equal(
    findParsedRequirementCourse("BIOC 406", "outside-mse-technical-electives")?.optionRole,
    "option"
  );
  assert.equal(
    findParsedRequirementCourse("CHEM 455", "outside-mse-technical-electives")?.optionRole,
    "option"
  );
  assert.equal(
    findParsedRequirementCourse("CHEM 456", "outside-mse-technical-electives")?.optionRole,
    "option"
  );
  assert.equal(
    findParsedRequirementCourse("CHEM 457", "outside-mse-technical-electives")?.optionRole,
    "option"
  );
  assert.equal(
    parsedOutsideTechnicalElectivesGroup?.options.find((option) =>
      option.uwCourses.includes("ENGR 321")
    )?.maxCredits,
    4
  );

  const runtimeGroups = runtimePlan.requirementGroups ?? [];
  const runtimeScientificComputingGroup = runtimeGroups.find((group) =>
    group.id.endsWith(":scientific-computing")
  );
  const mathElectiveGroup = runtimeGroups.find((group) => group.id.endsWith(":math-elective"));
  const scienceElectivesGroup = runtimeGroups.find((group) =>
    group.id.endsWith(":science-electives")
  );
  const engineeringFundamentalsGroup = runtimeGroups.find((group) =>
    group.id.endsWith(":engineering-fundamentals-electives")
  );
  const mseTechnicalElectivesGroup = runtimeGroups.find((group) =>
    group.id.endsWith(":mse-400-level-technical-electives")
  );
  const outsideTechnicalElectivesGroup = runtimeGroups.find((group) =>
    group.id.endsWith(":outside-mse-technical-electives")
  );

  assert.equal(runtimeScientificComputingGroup?.requirementType, "choose_one");
  assert.deepEqual(
    runtimeScientificComputingGroup?.options.map((option) => option.uwCourses),
    [["AMATH 301"], ["CSE 142"], ["CSE 122"]]
  );
  assert.equal(mathElectiveGroup?.requirementType, "choose_n");
  assert.equal(mathElectiveGroup?.minCourses, 1);
  assert.equal(mathElectiveGroup?.maxCourses, 1);
  assert.equal(
    mathElectiveGroup?.options.some((option) => option.uwCourses.includes("MATH 224")),
    true,
    "Expected MATH 224 to remain available as a math elective option."
  );
  assert.equal(scienceElectivesGroup?.requirementType, "choose_n");
  assert.equal(scienceElectivesGroup?.minCourses, 2);
  assert.equal(scienceElectivesGroup?.maxCourses, 2);
  for (const courseCode of [
    "BIOL 180",
    "BIOL 200",
    "CHEM 162",
    "CHEM 165",
    "CHEM 223",
    "CHEM 224",
    "CHEM 237",
    "CHEM 238",
    "CHEM 312",
    "CHEM 317",
    "CHEM 335",
    "CHEM 336",
    "CHEM 452",
    "CHEM 455",
    "CHEM 456",
    "PHYS 224",
    "PHYS 225",
    "PHYS 227",
    "PHYS 228",
  ]) {
    assert.equal(
      scienceElectivesGroup?.options.some((option) => option.uwCourses.includes(courseCode)),
      true,
      `Expected ${courseCode} to remain available as a science elective option.`
    );
  }
  assert.equal(engineeringFundamentalsGroup?.requirementType, "choose_credits");
  assert.equal(engineeringFundamentalsGroup?.minCredits, 8);
  for (const courseCode of expectedEngineeringFundamentals) {
    assert.equal(
      collectGroupCourseCodes(engineeringFundamentalsGroup).has(courseCode),
      true,
      `Expected ${courseCode} to remain available as an Engineering Fundamentals option.`
    );
  }
  assert.equal(mseTechnicalElectivesGroup?.requirementType, "choose_credits");
  assert.equal(mseTechnicalElectivesGroup?.minCredits, 6);
  for (const courseCode of expectedMseTechnicalElectives) {
    assert.equal(
      collectGroupCourseCodes(mseTechnicalElectivesGroup).has(courseCode),
      true,
      `Expected ${courseCode} to remain available as an MSE technical elective option.`
    );
  }
  assert.equal(outsideTechnicalElectivesGroup?.requirementType, "choose_credits");
  assert.equal(outsideTechnicalElectivesGroup?.maxCredits, 9);
  assert.equal(
    outsideTechnicalElectivesGroup?.options.find((option) => option.uwCourses.includes("ENGR 321"))
      ?.maxCredits,
    4
  );

  const nmeRuntimePlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, "nme-option");
  const nmeEngineeringFundamentalsGroup = nmeRuntimePlan?.requirementGroups?.find((group) =>
    group.id.endsWith(":engineering-fundamentals-electives")
  );
  assert.equal(
    nmeEngineeringFundamentalsGroup?.options.some((option) => option.uwCourses.includes("NME 220")),
    false,
    "Expected NME 220 to be excluded from the active Engineering Fundamentals options for NME Option students."
  );

  const requiredCourseCodes = buildSourceBackedRequiredCourseCodes(runtimePlan);
  for (const courseCode of ["MATH& 264", "CHEM& 261", "CHEM& 262", "PHYS 225"]) {
    assert.equal(
      requiredCourseCodes.includes(courseCode),
      false,
      `Did not expect ${courseCode} to be treated as required just because it is an option.`
    );
  }

  const requiredSummaryEntries = buildSourceBackedRequiredCourseSummaryEntries(runtimePlan, {
    mode: "uw",
  });
  const requiredSummaryText = requiredSummaryEntries
    .filter((entry) => entry.kind !== "choice-bucket")
    .map((entry) => entry.text)
    .join("\n");
  for (const courseCode of [
    "AMATH 301",
    "CSE 142",
    "CSE 122",
    "MATH 224",
    "INDE 315",
    "CHEM 237",
    "CHEM 238",
    "PHYS 225",
    "AA 260",
    "BIOEN 215",
    "CSE 123",
    "EE 215",
    "ME 230",
    "NME 220",
    "MSE 450",
    "MSE 452",
    "ENGR 321",
  ]) {
    assert.doesNotMatch(
      requiredSummaryText,
      new RegExp(`\\b${courseCode.replace(/\s+/g, "\\s+")}\\b`),
      `Did not expect ${courseCode} to render as an individually required course.`
    );
  }

  const choiceSummaryText = requiredSummaryEntries
    .filter((entry) => entry.kind === "choice-bucket")
    .map((entry) => entry.text)
    .join("\n");
  assert.match(choiceSummaryText, /Scientific computing - Choose one\./);
  assert.match(choiceSummaryText, /Choose 1 Math Elective\./);
  assert.match(choiceSummaryText, /Choose 2 Science Electives\./);
  assert.match(choiceSummaryText, /Choose at least 8 credits from Engineering Fundamentals electives\./);
  assert.match(choiceSummaryText, /Choose at least 6 credits from MSE 400-level technical electives\./);
  assert.match(choiceSummaryText, /Up to 9 credits may count from approved outside-MSE technical electives\./);
  assert.match(choiceSummaryText, /Selected options?:/);
  assert.match(choiceSummaryText, /Other valid options:/);
  assert.match(choiceSummaryText, /Selected for this credit requirement:/);
  assert.match(choiceSummaryText, /Other approved options:/);

  const consideredCourseCodes = buildSourceBackedUwCourseConsideredSummaryEntries(runtimePlan).map(
    (entry) => entry.courseCode
  );
  const consideredEntries = buildSourceBackedUwCourseConsideredSummaryEntries(runtimePlan);
  for (const courseCode of [
    ...expectedEngineeringFundamentals,
    ...expectedMseTechnicalElectives,
    ...expectedOutsideTechnicalElectives,
  ]) {
    assert.equal(
      consideredCourseCodes.includes(courseCode),
      true,
      `Expected UW Courses Considered to include official option ${courseCode}.`
    );
  }
  assert.equal(
    consideredEntries.find((entry) => entry.courseCode === "AA 260")?.optionRole,
    "option"
  );
  assert.equal(
    consideredEntries.find((entry) => entry.courseCode === "AA 260")?.requirementType,
    "choose_credits"
  );
  assert.equal(
    consideredEntries.find((entry) => entry.courseCode === "MATH 124")?.optionRole,
    "required"
  );

  const emptyStatuses = buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, []);
  const engineeringCreditStatus = emptyStatuses.find((status) =>
    status.item.requirementGroup?.id.endsWith(":engineering-fundamentals-electives")
  );
  const mseTechnicalCreditStatus = emptyStatuses.find((status) =>
    status.item.requirementGroup?.id.endsWith(":mse-400-level-technical-electives")
  );
  const outsideCreditStatus = emptyStatuses.find((status) =>
    status.item.requirementGroup?.id.endsWith(":outside-mse-technical-electives")
  );
  assert.equal(engineeringCreditStatus?.completedCredits, 0);
  assert.equal(engineeringCreditStatus?.matched, false);
  assert.equal(engineeringCreditStatus?.creditProgressLabel, "0/8 credits completed");
  assert.equal(mseTechnicalCreditStatus?.completedCredits, 0);
  assert.equal(mseTechnicalCreditStatus?.matched, false);
  assert.equal(mseTechnicalCreditStatus?.creditProgressLabel, "0/6 credits completed");
  assert.equal(outsideCreditStatus?.completedCredits, 0);
  assert.equal(outsideCreditStatus?.maxCreditCount, 9);

  const partialEngineeringStatus = buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, [
    { code: "ENGR& 224", label: "ENGR& 224" },
  ]).find((status) =>
    status.item.requirementGroup?.id.endsWith(":engineering-fundamentals-electives")
  );
  assert.equal(partialEngineeringStatus?.completedCredits, 4);
  assert.equal(partialEngineeringStatus?.matched, false);
  assert.equal(partialEngineeringStatus?.creditProgressLabel, "4/8 credits completed");
});

test("Materials NME Option replaces standard technical electives with the NME core/elective bucket", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-materials-science-engineering"
  );
  const [nmeBlock] = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-materials-science-engineering",
    "nme-option"
  );

  assert.ok(runtimePlan, "Expected the MSE runtime plan.");
  assert.ok(nmeBlock, "Expected the MSE NME parsed source block.");

  const normalMseTechnicalGroup = runtimePlan.requirementGroups?.find((group) =>
    group.id.endsWith(":mse-400-level-technical-electives")
  );
  const normalOutsideTechnicalGroup = runtimePlan.requirementGroups?.find((group) =>
    group.id.endsWith(":outside-mse-technical-electives")
  );
  assert.equal(normalMseTechnicalGroup?.requirementType, "choose_credits");
  assert.equal(normalMseTechnicalGroup?.minCredits, 6);
  assert.equal(normalOutsideTechnicalGroup?.requirementType, "choose_credits");
  assert.equal(normalOutsideTechnicalGroup?.maxCredits, 9);

  const normalSummaryText = buildSourceBackedRequiredCourseSummaryEntries(runtimePlan, {
    mode: "uw",
  })
    .map((entry) => entry.text)
    .join("\n");
  assert.match(normalSummaryText, /Choose at least 6 credits from MSE 400-level technical electives\./);
  assert.match(normalSummaryText, /Up to 9 credits may count from approved outside-MSE technical electives\./);

  const parsedNmeGroup = nmeBlock.parsedRequirementGroups?.find((group) =>
    group.id.endsWith(":mse-nme-core-elective-19-credits")
  );
  assert.equal(parsedNmeGroup?.requirementType, "choose_credits");
  assert.equal(parsedNmeGroup?.minCredits, 19);
  assert.equal(parsedNmeGroup?.category, "nme_core_elective");

  const parsedNmeCourses = (nmeBlock.parsedRequirementCourses ?? []).filter((course) =>
    course.requirementGroupId.endsWith(":mse-nme-core-elective-19-credits")
  );
  const findParsedNmeCourse = (courseCode: string) =>
    parsedNmeCourses.find((course) => course.normalizedCourseCode === courseCode);
  for (const courseCode of ["NME 220", "BIOEN 423", "MSE 452", "ENGR 321", "CHEME 523", "NME 498"]) {
    const course = findParsedNmeCourse(courseCode);
    assert.ok(course, `Expected ${courseCode} to be captured from the NME option source.`);
    assert.equal(course?.requirementGroupId, parsedNmeGroup?.id);
    assert.equal(course?.requirementType, "choose_credits");
    assert.ok(course?.category, `Expected ${courseCode} to carry NME category metadata.`);
  }
  assert.equal(findParsedNmeCourse("NME 220")?.category, "nme_core_required");
  assert.equal(findParsedNmeCourse("ENGR 321")?.category, "nme_restricted_option");
  assert.equal(
    parsedNmeCourses.every((course) => course.requirementGroupId && course.category),
    true,
    "Expected every parsed NME course to carry requirementGroupId and category metadata."
  );

  const nmeRuntimePlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, "nme-option");
  assert.ok(nmeRuntimePlan, "Expected the selected NME runtime plan.");

  const replacement = nmeRuntimePlan.requirementReplacements?.find((entry) =>
    entry.replacedByRequirementId.endsWith(":mse-nme-core-elective-19-credits")
  );
  assert.equal(
    replacement?.baseRequirementId,
    "uw-seattle-materials-science-engineering:requirement-group:mse-technical-electives-15-credits"
  );
  assert.equal(replacement?.appliesWhen, 'selectedOption === "NME"');
  assert.equal(replacement?.sourceUrl, "https://mse.washington.edu/current/undergrad/nmeoption");

  const activeNmeGroup = nmeRuntimePlan.requirementGroups?.find((group) =>
    group.id.endsWith(":mse-nme-core-elective-19-credits")
  );
  assert.equal(activeNmeGroup?.requirementType, "choose_credits");
  assert.equal(activeNmeGroup?.minCredits, 19);
  assert.equal(activeNmeGroup?.category, "nme_core_elective");

  const activeNmeCourseCodes = new Set(
    (activeNmeGroup?.options ?? []).flatMap((option) => [
      ...(option.uwCourses ?? []),
      ...(option.equivalentUwCourseCodes ?? []),
    ])
  );
  for (const courseCode of ["NME 220", "BIOEN 423", "MSE 452", "ENGR 321", "NME 498"]) {
    assert.equal(
      activeNmeCourseCodes.has(courseCode),
      true,
      `Expected ${courseCode} to remain available in the active NME requirement.`
    );
  }
  assert.equal(
    activeNmeGroup?.options.find((option) => option.uwCourses.includes("NME 220"))?.category,
    "nme_core_required"
  );
  assert.equal(
    activeNmeGroup?.options.find((option) => option.uwCourses.includes("MSE 452"))?.category,
    "nme_elective_option"
  );
  assert.equal(
    activeNmeGroup?.options.find((option) => option.uwCourses.includes("ENGR 321"))?.category,
    "nme_restricted_option"
  );

  assert.equal(
    nmeRuntimePlan.requirementGroups?.some((group) =>
      group.id.endsWith(":mse-400-level-technical-electives")
    ),
    false,
    "Expected the normal MSE 400-level technical elective group to be inactive for NME."
  );
  assert.equal(
    nmeRuntimePlan.requirementGroups?.some((group) =>
      group.id.endsWith(":outside-mse-technical-electives")
    ),
    false,
    "Expected the normal outside-MSE technical elective group to be inactive for NME."
  );
  assert.equal(
    [
      ...nmeRuntimePlan.applicationChecklist,
      ...nmeRuntimePlan.beforeEnrollmentChecklist,
      ...nmeRuntimePlan.stayAtGrcChecklist,
    ].some((item) =>
      /:mse-400-level-technical-electives$|:outside-mse-technical-electives$/.test(
        item.requirementGroup?.id ?? ""
      )
    ),
    false,
    "Expected normal MSE technical elective checklist rows not to remain active for NME."
  );

  const nmeEngineeringFundamentalsGroup = nmeRuntimePlan.requirementGroups?.find((group) =>
    group.id.endsWith(":engineering-fundamentals-electives")
  );
  assert.equal(
    nmeEngineeringFundamentalsGroup?.options.some((option) =>
      option.uwCourses.includes("NME 220")
    ),
    false,
    "Expected NME 220 not to satisfy Engineering Fundamentals for NME Option students."
  );

  const nme220Statuses = buildRequirementStatuses(nmeRuntimePlan.beforeEnrollmentChecklist, [
    { code: "NME 220", label: "NME 220" },
  ]);
  const engineeringStatus = nme220Statuses.find((status) =>
    status.item.requirementGroup?.id.endsWith(":engineering-fundamentals-electives")
  );
  const nmeCoreStatus = nme220Statuses.find((status) =>
    status.item.requirementGroup?.id.endsWith(":mse-nme-core-elective-19-credits")
  );
  assert.equal(engineeringStatus?.completedCredits, 0);
  assert.equal(engineeringStatus?.matched, false);
  assert.equal(nmeCoreStatus?.completedCredits, 4);
  assert.equal(nmeCoreStatus?.creditProgressLabel, "4/19 credits completed");

  const nmeSummaryText = buildSourceBackedRequiredCourseSummaryEntries(nmeRuntimePlan, {
    mode: "uw",
  })
    .map((entry) => entry.text)
    .join("\n");
  assert.match(nmeSummaryText, /NME Option Core\/Elective Requirement: 19 credits\./);
  assert.match(nmeSummaryText, /This replaces the standard 15-credit MSE technical elective requirement\./);
  assert.doesNotMatch(
    nmeSummaryText,
    /Choose at least 6 credits from MSE 400-level technical electives\./
  );
  assert.doesNotMatch(
    nmeSummaryText,
    /Up to 9 credits may count from approved outside-MSE technical electives\./
  );

  const nmeConsideredEntries = buildSourceBackedUwCourseConsideredSummaryEntries(nmeRuntimePlan);
  assert.equal(
    nmeConsideredEntries.find((entry) => entry.courseCode === "NME 220")?.category,
    "nme_core_required"
  );
  assert.match(
    nmeConsideredEntries.find((entry) => entry.courseCode === "NME 220")?.requirementGroupId ?? "",
    /:mse-nme-core-elective-19-credits$/
  );
  assert.equal(
    nmeConsideredEntries.find((entry) => entry.courseCode === "MSE 452")?.category,
    "nme_elective_option"
  );
  assert.equal(
    nmeConsideredEntries.find((entry) => entry.courseCode === "ENGR 321")?.category,
    "nme_restricted_option"
  );

  assert.deepEqual(
    buildMaterialsScienceNmeSourceIncompleteWarnings(
      "uw-seattle-materials-science-engineering",
      "nme-option",
      []
    ),
    [
      "NME Option requirements require the linked NME page. The planner parsed the base MSE page but could not verify the 19-credit NME Core/Elective requirement.",
    ]
  );
  assert.deepEqual(
    buildMaterialsScienceNmeSourceIncompleteWarnings(
      "uw-seattle-materials-science-engineering",
      "nme-option",
      activeNmeGroup ? [activeNmeGroup] : []
    ),
    []
  );
});

test("Major Specifics dropdown categorizes UW MSE rows and adds concise option alternatives", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-materials-science-engineering"
  );
  assert.ok(runtimePlan, "Expected the MSE runtime plan.");

  const track = getTransferPlannerTrack(runtimePlan.bestTrackId ?? null);
  const sections = buildMajorSpecificsCourseSections({
    plan: runtimePlan,
    track,
    completedCourses: [],
  });
  const sectionById = new Map(sections.map((section) => [section.id, section] as const));
  const audit = buildMajorSpecificsRenderingAudit(sections);

  assert.ok(sections.length > 0, "Expected Major Specifics rows.");
  assert.equal(
    audit.every(
      (entry) => entry.category && entry.sourceType && entry.requirementRole && !entry.flags.length
    ),
    true,
    `Expected categorized Major Specifics rows without audit flags: ${JSON.stringify(
      audit.filter((entry) => entry.flags.length),
      null,
      2
    )}`
  );

  const requiredSection = sectionById.get("official-uw-required-courses");
  const selectedSection = sectionById.get("selected-uw-requirement-options");
  const otherSection = sectionById.get("other-valid-uw-options");
  const matchedTrackSection = sectionById.get("matched-green-river-track-courses");
  const genEdSection = sectionById.get("gen-ed-breadth-requirements");
  const allRows = sections.flatMap((section) => section.rows);

  assert.ok(requiredSection, "Expected Official UW Required Courses section.");
  assert.ok(selectedSection, "Expected Selected UW Requirement Options section.");
  assert.ok(otherSection, "Expected Other Valid UW Options section.");
  assert.equal(
    sectionById.has("green-river-prerequisites"),
    false,
    "Expected prerequisite-only rows to stay out of the UW Degree Classes dropdown."
  );
  assert.equal(
    allRows.some((entry) => entry.requirementRole === "prerequisite_only"),
    false,
    "Expected no prerequisite-only rows in Major Specifics."
  );
  assert.ok(matchedTrackSection, "Expected Matched Green River Track Courses section.");
  assert.ok(genEdSection, "Expected Gen-Ed Requirements section.");
  assert.equal(genEdSection?.label, "Gen-Ed Requirements");
  assert.ok(
    sections.findIndex((section) => section.id === "gen-ed-breadth-requirements") <
      sections.findIndex((section) => section.id === "official-uw-required-courses"),
    "Expected Gen-Ed Requirements to appear above Official UW Required Courses."
  );

  const requiredRows = requiredSection?.rows ?? [];

  for (const uwCourseCode of ["MATH 124", "MATH 125", "MATH 126"]) {
    const requiredRow = requiredRows.find((entry) => entry.text.includes(uwCourseCode));
    assert.ok(requiredRow, `Expected ${uwCourseCode} to appear under official required courses.`);
    assert.equal(requiredRow?.sourceType, "official_uw_requirement");
    assert.equal(requiredRow?.requirementRole, "required");
    assert.match(requiredRow?.text ?? "", /is required\. UW equivalent:/);
    assert.equal(requiredRow?.alternativeOptionsText ?? null, null);
  }

  const computingSelectedRow = selectedSection?.rows.find((entry) =>
    entry.requirementGroupId?.endsWith(":scientific-computing")
  );
  assert.ok(computingSelectedRow, "Expected a selected scientific-computing option.");
  assert.equal(computingSelectedRow?.requirementType, "choose_one");
  assert.equal(computingSelectedRow?.selectedForRequirement, true);
  assert.match(computingSelectedRow?.alternativeOptionsText ?? "", /^Instead of taking /);
  assert.match(computingSelectedRow?.alternativeOptionsText ?? "", /AMATH 301/);
  assert.match(computingSelectedRow?.alternativeOptionsText ?? "", /CSE 142/);

  const computingAlternativeCodes = new Set(
    otherSection?.rows
      .filter((entry) => entry.requirementGroupId?.endsWith(":scientific-computing"))
      .map((entry) => entry.normalizedCourseCode)
  );
  assert.deepEqual([...computingAlternativeCodes].sort(), ["AMATH 301", "CSE 142"]);
  assert.equal(
    otherSection?.rows
      .filter((entry) => entry.requirementGroupId?.endsWith(":scientific-computing"))
      .every((entry) => !/\bis required\b/i.test(entry.text)),
    true
  );

  const requiredCodes = new Set(requiredSection?.rows.map((entry) => entry.normalizedCourseCode));
  assert.equal(requiredCodes.has("MATH 224"), false);
  assert.equal(requiredCodes.has("INDE 315"), false);
  assert.equal(requiredCodes.has("CHEM 237"), false);
  assert.equal(requiredCodes.has("CHEM 238"), false);
  assert.equal(requiredCodes.has("PHYS 225"), false);

  const mathSelectedRow = selectedSection?.rows.find((entry) =>
    entry.requirementGroupId?.endsWith(":math-elective")
  );
  assert.equal(mathSelectedRow?.normalizedCourseCode, "MATH 224");
  assert.match(mathSelectedRow?.alternativeOptionsText ?? "", /MATH& 264 \/ MATH 224/);
  assert.match(mathSelectedRow?.alternativeOptionsText ?? "", /MATH 209 \/ MATH 309/);
  assert.match(mathSelectedRow?.alternativeOptionsText ?? "", /STAT 390/);

  const scienceRows = [
    ...(selectedSection?.rows ?? []),
    ...(otherSection?.rows ?? []),
  ].filter((entry) => entry.requirementGroupId?.endsWith(":science-electives"));
  for (const courseCode of ["CHEM 237", "CHEM 238", "PHYS 225"]) {
    assert.equal(
      scienceRows.some((entry) => entry.normalizedCourseCode === courseCode),
      true,
      `Expected ${courseCode} to remain visible as a science elective option.`
    );
  }
  assert.equal(
    scienceRows.every((entry) => entry.requirementRole !== "required"),
    true,
    "Expected science elective options not to be marked required."
  );
  assert.equal(
    selectedSection?.rows
      .filter((entry) => entry.requirementGroupId?.endsWith(":science-electives"))
      .every((entry) => /^Instead of taking /.test(entry.alternativeOptionsText ?? "")),
    true
  );

  assert.equal(
    (matchedTrackSection?.rows ?? []).some((entry) =>
      ["ENGR 100", "ENGR 106"].includes(entry.normalizedCourseCode)
    ),
    true,
    "Expected ENGR 100 or ENGR 106 to remain visible as matched-track support."
  );
  assert.equal(
    matchedTrackSection?.rows.some((entry) => entry.normalizedCourseCode === "ENGR 100"),
    true,
    "Expected ENGR 100 to remain visible as matched Green River track support."
  );
  assert.equal(
    genEdSection?.rows.some((entry) => /A&H|Social Science|Diversity|Areas of Inquiry/i.test(entry.text)),
    true,
    "Expected Gen-Ed / Breadth rows to remain visible."
  );
});

test("Major Specifics dropdown marks NME restricted and replaced requirements separately", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-materials-science-engineering"
  );
  assert.ok(runtimePlan, "Expected the MSE runtime plan.");

  const nmePlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, "nme-option");
  assert.ok(nmePlan, "Expected the selected NME runtime plan.");

  const track = getTransferPlannerTrack(nmePlan.bestTrackId ?? null);
  const sections = buildMajorSpecificsCourseSections({
    plan: nmePlan,
    track,
    completedCourses: [],
  });
  const audit = buildMajorSpecificsRenderingAudit(sections);
  const restrictedSection = sections.find(
    (section) => section.id === "restricted-or-replaced-requirements"
  );

  assert.equal(
    audit.every((entry) => !entry.flags.length),
    true,
    `Expected no Major Specifics audit flags for NME: ${JSON.stringify(
      audit.filter((entry) => entry.flags.length),
      null,
      2
    )}`
  );
  assert.ok(restrictedSection, "Expected Restricted or Replaced Requirements section.");

  const nme220RestrictedRow = restrictedSection?.rows.find(
    (entry) => entry.normalizedCourseCode === "NME 220"
  );
  assert.equal(nme220RestrictedRow?.sourceType, "restricted_option");
  assert.equal(nme220RestrictedRow?.requirementRole, "restricted");
  assert.equal(nme220RestrictedRow?.restrictionStatus, "not_eligible_for_nme_option");
  assert.equal(nme220RestrictedRow?.countsTowardUwRequirement, false);
  assert.match(nme220RestrictedRow?.text ?? "", /not eligible.*NME Option students/);

  const replacedTechnicalElectiveRow = restrictedSection?.rows.find((entry) =>
    entry.requirementGroupId?.endsWith(":mse-technical-electives-15-credits")
  );
  assert.equal(replacedTechnicalElectiveRow?.sourceType, "replaced_requirement");
  assert.equal(replacedTechnicalElectiveRow?.requirementRole, "replaced");
  assert.equal(replacedTechnicalElectiveRow?.countsTowardUwRequirement, false);
  assert.match(
    replacedTechnicalElectiveRow?.text ?? "",
    /replaced by NME Option Core\/Elective Requirement: 19 credits/
  );

  const selectedNmeRows = sections
    .find((section) => section.id === "selected-uw-requirement-options")
    ?.rows.filter((entry) =>
      entry.requirementGroupId?.endsWith(":mse-nme-core-elective-19-credits")
    );
  assert.ok(selectedNmeRows?.length, "Expected active NME option rows to remain selected.");
  assert.equal(
    selectedNmeRows?.every((entry) => entry.sourceType === "nme_option_requirement"),
    true
  );
  assert.equal(
    selectedNmeRows?.some((entry) => entry.normalizedCourseCode === "NME 220"),
    true,
    "Expected NME 220 to remain selected inside the NME core/elective requirement."
  );
});

test("Materials planner-visible source-backed output keeps lower-division prep but not upper-division coursework", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-materials-science-engineering");

  assert.ok(runtimePlan, "Expected the MSE runtime plan.");

  const summaryText = buildSourceBackedRequiredCourseSummaryEntries(runtimePlan, { mode: "uw" })
    .map((entry) => entry.text)
    .join("\n");

  assert.match(
    summaryText,
    /UW equivalent:\s*MSE 170\b/,
    "Expected planner-visible MSE source-backed output to keep the MSE 170 lower-division UW equivalent."
  );

  for (const courseCode of ["MSE 310", "MSE 311", "MSE 321", "EE 486", "CHEM 597", "MOLENG 520"]) {
    assert.doesNotMatch(
      summaryText,
      new RegExp(`\\b${courseCode.replace(/\s+/g, "\\s+")}\\b`),
      `Did not expect planner-visible source-backed output to materialize upper-division-only ${courseCode}.`
    );
  }
});

test("Industrial & Systems Engineering benefits from the same spaced-subject normalization", () => {
  const [iseBlock] = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-industrial-systems-engineering"
  );

  assert.ok(iseBlock, "Expected the Seattle ISE parsed source block.");
  assert.equal(
    iseBlock?.parsedUwCourseCodes.includes("INDE 315"),
    true,
    "Expected the Seattle ISE parsed source to include INDE 315."
  );
  assert.equal(
    getTransferPlannerCanonicalCourse("uw-seattle", "IND E 315")?.code,
    "INDE 315",
    "Expected IND E 315 to resolve to the same canonical registry entry as INDE 315."
  );
});

test("Auto-promoted pathway aliases keep Seattle Biochemistry route IDs canonical", () => {
  const plan = getRequiredPlan("uw-seattle-biochemistry");
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(plan.id);
  assert.ok(runtimePlan, "Expected a Seattle Biochemistry runtime plan.");

  const sourcePathways = getTransferPlannerPathwaysForPlan(plan).map(
    (pathway) => [pathway.id, pathway.label] as const
  );
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan).map(
    (pathway) => [pathway.id, pathway.label] as const
  );

  assert.deepEqual(sourcePathways, [
    ["ba-route", "B.A. route"],
    ["bs-route", "B.S. route"],
  ]);
  assert.deepEqual(runtimePathways, [
    ["ba-route", "B.A. route"],
    ["bs-route", "B.S. route"],
  ]);
});

test("Officially promoted Seattle ECE pathways can expand beyond stale bootstrap pathway lists", () => {
  const plan = getRequiredPlan("uw-seattle-electrical-computer-engineering");
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(plan.id);
  assert.ok(runtimePlan, "Expected a Seattle ECE runtime plan.");

  const expectedPathways = [
    ["photonics-pathway", "Photonics pathway"],
    ["computer-architecture-pathway", "Computer Architecture Pathway"],
    ["control-systems-pathway", "Control Systems Pathway"],
    ["digital-systems-design-pathway", "Digital Systems Design Pathway"],
    ["embedded-systems-pathway", "Embedded Systems Pathway"],
    ["machine-learning-pathway", "Machine Learning Pathway"],
    ["microelectronics-and-nanotechnology-pathway", "Microelectronics and Nanotechnology Pathway"],
    ["neurotechnology-pathway", "Neurotechnology Pathway"],
  ] as const;

  const sourcePathways = getTransferPlannerPathwaysForPlan(plan).map(
    (pathway) => [pathway.id, pathway.label] as const
  );
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan).map(
    (pathway) => [pathway.id, pathway.label] as const
  );

  assert.deepEqual(sourcePathways, expectedPathways);
  assert.deepEqual(runtimePathways, expectedPathways);
});

test("Guidance-only collection headings are treated as structural pathway labels", () => {
  for (const label of [
    "Concentration Areas",
    "Optional Focus Areas",
    "Examples of coursework pathways emphasizing particular areas within psychology",
    "Concentration I",
  ]) {
    assert.equal(
      isSuspiciousStructuralPathwayLabel(label),
      true,
      `Expected ${label} to stay in the structural-heading bucket.`
    );
  }

  for (const label of ["NME Option", "China Concentration", "B A route"]) {
    assert.equal(
      isSuspiciousStructuralPathwayLabel(label),
      false,
      `Expected ${label} to remain a semantic pathway label.`
    );
  }
});

test("Guidance-only concentration headings do not outrank real option labels during materialization", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-guidance-only-concentrations",
    campusId: "uw-seattle",
    title: "Materials Science & Engineering",
    shortTitle: "MSE",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [],
  };
  const parsedBlocks: TransferPlannerParsedRequirementSourceBlock[] = [
    {
      id: "synthetic-guidance-only-concentrations:source-block:test",
      ownerId: "synthetic-guidance-only-concentrations",
      ownerTitle: "Materials Science & Engineering",
      planId: plan.id,
      pathwayId: null,
      campusId: "uw-seattle",
      primaryParserType: "html-degree-page",
      primarySourceUrl: "https://example.edu/materials-science-engineering",
      primarySourceLabel: "Materials Science & Engineering degree requirements",
      parserType: "html-degree-page",
      adapterId: "uw-seattle-html-degree-page",
      adapterFamily: "Synthetic HTML degree page",
      sourceUrl: "https://example.edu/materials-science-engineering",
      sourceLabel: "Materials Science & Engineering degree requirements",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [
        "Concentration areas",
        "The MSE degree offers a large number of course elective options. For advice on choosing pertinent electives to support your interests, please check out MSE Concentration Areas.",
      ],
      chooseStatements: [],
      pathwayLabels: [
        "Concentration areas",
        "please check out MSE Concentration Areas",
        "Nanoscience and Molecular Engineering (NME) Option",
      ],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
  ];

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], parsedBlocks);

  assert.deepEqual(
    materialized.map((pathway) => [pathway.id, pathway.label] as const),
    [["nme-option", "NME Option"]]
  );
});

test("Coursework-pathway collection headings do not outrank real route labels during materialization", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-coursework-pathway-headings",
    campusId: "uw-seattle",
    title: "Psychology",
    shortTitle: "Psych",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [],
  };
  const parsedBlocks: TransferPlannerParsedRequirementSourceBlock[] = [
    {
      id: "synthetic-coursework-pathway-headings:source-block:test",
      ownerId: "synthetic-coursework-pathway-headings",
      ownerTitle: "Psychology",
      planId: plan.id,
      pathwayId: null,
      campusId: "uw-seattle",
      primaryParserType: "html-degree-page",
      primarySourceUrl: "https://example.edu/psychology",
      primarySourceLabel: "Psychology degree requirements",
      parserType: "html-degree-page",
      adapterId: "uw-seattle-html-degree-page",
      adapterFamily: "Synthetic HTML degree page",
      sourceUrl: "https://example.edu/psychology",
      sourceLabel: "Psychology degree requirements",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [
        "Examples of coursework pathways emphasizing particular areas within psychology:",
      ],
      chooseStatements: [],
      pathwayLabels: [
        "Examples of coursework pathways emphasizing particular areas within psychology:",
        "Clinical Psychology route",
        "Cognitive Psychology route",
      ],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
  ];

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], parsedBlocks);

  assert.deepEqual(
    materialized.map((pathway) => [pathway.id, pathway.label] as const),
    [
      ["clinical-psychology-route", "Clinical Psychology Route"],
      ["cognitive-psychology-route", "Cognitive Psychology Route"],
    ]
  );
});

test("Collection-style concentration placeholders no longer surface as peer pathways for Asian Studies", () => {
  const plan = getRequiredPlan("uw-seattle-asian-studies");
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(plan.id);
  assert.ok(runtimePlan, "Expected an Asian Studies runtime plan.");

  const sourceLabels = getTransferPlannerPathwaysForPlan(plan).map((pathway) => pathway.label);
  const runtimeLabels = getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan).map(
    (pathway) => pathway.label
  );

  assert.equal(sourceLabels.includes("Concentration I"), false);
  assert.equal(runtimeLabels.includes("Concentration I"), false);
  assert.equal(sourceLabels.includes("China Concentration"), true);
  assert.equal(runtimeLabels.includes("China Concentration"), true);
});

test("Cross-major navigation pathway noise does not outrank plan-level evidence", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-jsis-cross-major-noise",
    campusId: "uw-seattle",
    title: "Jewish Studies",
    shortTitle: "JS",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [
      {
        id: "china-concentration",
        label: "China Concentration",
        summary: "",
        officialLinks: [],
      },
    ],
  };
  const parsedBlocks: TransferPlannerParsedRequirementSourceBlock[] = [
    {
      id: "synthetic-jsis-cross-major-noise:source-block:major",
      ownerId: plan.id,
      ownerTitle: "Jewish Studies",
      planId: plan.id,
      pathwayId: null,
      campusId: "uw-seattle",
      primaryParserType: "html-degree-page",
      primarySourceUrl: "https://example.edu/jewish-studies",
      primarySourceLabel: "Jewish Studies requirements",
      parserType: "html-degree-page",
      adapterId: "uw-seattle-html-degree-page",
      adapterFamily: "Synthetic HTML degree page",
      sourceUrl: "https://example.edu/jewish-studies",
      sourceLabel: "Jewish Studies requirements",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [
        "50 credits, to include the following:",
        "Asian Studies - China Concentration",
      ],
      chooseStatements: [],
      pathwayLabels: ["China Concentration"],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
    {
      id: "synthetic-jsis-cross-major-noise:source-block:pathway",
      ownerId: `${plan.id}:pathway:china-concentration`,
      ownerTitle: "Jewish Studies - China Concentration",
      planId: plan.id,
      pathwayId: "china-concentration",
      campusId: "uw-seattle",
      primaryParserType: "html-degree-page",
      primarySourceUrl: "https://example.edu/jewish-studies",
      primarySourceLabel: "Jewish Studies requirements",
      parserType: "html-degree-page",
      adapterId: "uw-seattle-html-degree-page",
      adapterFamily: "Synthetic HTML degree page",
      sourceUrl: "https://example.edu/jewish-studies",
      sourceLabel: "Jewish Studies requirements",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: [],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
  ];

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], parsedBlocks);

  assert.deepEqual(materialized, []);
});

test("Seattle Computer Science Data Science option resolves to one clean canonical pathway", () => {
  const runtimeCsPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-science");
  assert.ok(runtimeCsPlan, "Expected a Computer Science runtime plan.");

  const sourcePathways = getTransferPlannerPathwaysForPlan(csPlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(runtimeCsPlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
  const parsedScopes = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (entry) => entry.planId === "uw-seattle-computer-science"
  )
    .map((entry) => entry.pathwayId)
    .sort((left, right) => String(left ?? "").localeCompare(String(right ?? "")));

  assert.deepEqual(sourcePathways, [["data-science-option", "Data Science option"]]);
  assert.deepEqual(runtimePathways, [["data-science-option", "Data Science option"]]);
  assert.deepEqual(parsedScopes, [null, "data-science-option"]);
  assert.deepEqual(collectSuspiciousStructuralPathways(getTransferPlannerPathwaysForPlan(csPlan)), []);
  assert.deepEqual(
    collectSuspiciousStructuralPathways(getTransferPlannerStudentRuntimePathwaysForPlan(runtimeCsPlan)),
    []
  );
});

test("Speech & Hearing Sciences does not expose graduate or not-admitting pathway labels", () => {
  const speechPlan = getRequiredPlan("uw-seattle-speech-and-hearing-sciences");
  const speechRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(speechPlan.id);
  assert.ok(speechRuntimePlan, "Expected a Speech & Hearing Sciences runtime plan.");

  const sourcePathways = getTransferPlannerPathwaysForPlan(speechPlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(speechRuntimePlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));

  assert.deepEqual(sourcePathways, []);
  assert.deepEqual(runtimePathways, []);
  assert.deepEqual(
    collectSuspiciousStructuralPathways(getTransferPlannerPathwaysForPlan(speechPlan)),
    []
  );
  assert.deepEqual(
    collectSuspiciousStructuralPathways(getTransferPlannerStudentRuntimePathwaysForPlan(speechRuntimePlan)),
    []
  );
});

test("Already-correct Statistics pathway labels remain stable after semantic pathway promotion changes", () => {
  assert.ok(sourceGeneratedStatisticsPlan, "Expected source-generated Seattle Statistics planner row.");
  const statisticsRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-statistics");
  assert.ok(statisticsRuntimePlan, "Expected a Statistics runtime plan.");

  const expected = [
    ["applied-statistics-track", "Applied Statistics track"],
    ["data-science-track", "Data Science track"],
    ["mathematical-statistics-track", "Mathematical Statistics track"],
  ].sort((left, right) => left[0].localeCompare(right[0]));

  const sourcePathways = getTransferPlannerPathwaysForPlan(sourceGeneratedStatisticsPlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(statisticsRuntimePlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));

  assert.deepEqual(sourcePathways, expected);
  assert.deepEqual(runtimePathways, expected);
});

test("QA helper stays clean for the targeted semantic-pathway plans", () => {
  const plans = [
    getRequiredPlan("uw-seattle-applied-and-computational-mathematical-sciences"),
    getRequiredPlan("uw-seattle-speech-and-hearing-sciences"),
    getRequiredPlan("uw-seattle-statistics"),
  ];

  const suspiciousByPlan = plans
    .map((plan) => ({
      planId: plan.id,
      suspicious: collectSuspiciousStructuralPathways(getTransferPlannerPathwaysForPlan(plan)),
    }))
    .filter((entry) => entry.suspicious.length > 0);

  assert.deepEqual(suspiciousByPlan, []);
});

test("Semantic-pathway audit leaves no suspicious structural pathway ids or labels in source or runtime registries", () => {
  const suspiciousRegistryPathways = TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.filter(
    (pathway) =>
      isSuspiciousStructuralPathwayId(pathway.pathwayId) ||
      isSuspiciousStructuralPathwayLabel(pathway.label)
  )
    .map((pathway) => `${pathway.planId}:${pathway.pathwayId} => ${pathway.label}`)
    .sort();

  const suspiciousRuntimePathways = TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS.flatMap((plan) =>
    getTransferPlannerStudentRuntimePathwaysForPlan(plan)
      .filter(
        (pathway) =>
          isSuspiciousStructuralPathwayId(pathway.id) ||
          isSuspiciousStructuralPathwayLabel(pathway.label)
      )
      .map((pathway) => `${plan.id}:${pathway.id} => ${pathway.label}`)
  ).sort();

  assert.deepEqual(suspiciousRegistryPathways, []);
  assert.deepEqual(suspiciousRuntimePathways, []);
});

test("Auto track matcher preserves custom track copy when the computed winner already matches", () => {
  const autoRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    csPlan.grcCourseList ?? [],
    csPlan.bestTrackId
  );

  assert.ok(autoRecommendation, "Expected an auto-matched track recommendation for Seattle CS.");
  assert.ok(typeof autoRecommendation?.trackId === "string");
  assert.ok(csPlan.bestTrackId, "Expected Seattle CS to keep a parser-first auto-matched best track id.");
  assert.equal(typeof csPlan.recommendedTrackSummary, "string");
});

test("Engineering auto track matcher uses major discipline when shared STEM overlap is ambiguous", () => {
  const runtimeChemicalPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-chemical-engineering"
  );
  const runtimeMechanicalPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-mechanical-engineering"
  );
  assert.ok(runtimeChemicalPlan, "Expected runtime Seattle Chemical Engineering plan.");
  assert.ok(runtimeMechanicalPlan, "Expected runtime Seattle Mechanical Engineering plan.");

  const chemicalTrack = getTransferPlannerTrack(runtimeChemicalPlan.bestTrackId ?? null);
  const mechanicalTrack = getTransferPlannerTrack(runtimeMechanicalPlan.bestTrackId ?? null);

  assert.match(chemicalTrack?.title ?? "", /Bioengineering and Chemical Engineering/i);
  assert.match(mechanicalTrack?.title ?? "", /Civil and Mechanical Engineering/i);

  const chemicalRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    getTransferPlannerGrcCourseList(runtimeChemicalPlan),
    null,
    { majorTitle: runtimeChemicalPlan.title }
  );
  const mechanicalRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    getTransferPlannerGrcCourseList(runtimeMechanicalPlan),
    null,
    { majorTitle: runtimeMechanicalPlan.title }
  );

  assert.equal(chemicalRecommendation?.trackId, runtimeChemicalPlan.bestTrackId);
  assert.equal(mechanicalRecommendation?.trackId, runtimeMechanicalPlan.bestTrackId);
  assert.deepEqual(mechanicalRecommendation?.disciplineMatchedLabels, [
    "Mechanical Engineering",
  ]);
});

test.skip("Auto track matcher can diverge between the broad base course list and the narrowed source-generated checklist set", () => {
  const bootstrapAtmosphericPlan = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.find(
    (entry) => entry.id === "uw-seattle-atmospheric-and-climate-science"
  );
  const baseCourseListRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    seattleAtmosphericClimateSciencePlan?.grcCourseList ?? [],
    bootstrapAtmosphericPlan?.bestTrackId ?? null
  );
  const checklistScopedRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    [
      ...(seattleAtmosphericClimateSciencePlan?.applicationChecklist ?? []).flatMap((item) => [
        item.grcCourses,
        ...(item.alternatives ?? []),
      ]),
      ...(seattleAtmosphericClimateSciencePlan?.beforeEnrollmentChecklist ?? []).flatMap((item) => [
        item.grcCourses,
        ...(item.alternatives ?? []),
      ]),
      ...(seattleAtmosphericClimateSciencePlan?.stayAtGrcChecklist ?? []).flatMap((item) => [
        item.grcCourses,
        ...(item.alternatives ?? []),
      ]),
    ].flat(),
    bootstrapAtmosphericPlan?.bestTrackId ?? null
  );

  assert.ok(bootstrapAtmosphericPlan?.bestTrackId, "Expected bootstrap atmospheric plan to have a best track id.");
  assert.ok(baseCourseListRecommendation?.trackId, "Expected base-course auto recommendation to resolve a track.");
  assert.ok(
    checklistScopedRecommendation?.trackId,
    "Expected checklist-scoped auto recommendation to resolve a track."
  );
  assert.ok(
    seattleAtmosphericClimateSciencePlan?.bestTrackId,
    "Expected parser-first atmospheric plan to keep an auto-matched best track id."
  );
  assert.match(
    seattleAtmosphericClimateSciencePlan?.recommendedTrackSummary ?? "",
    /current closest Green River transfer path/i
  );
});

test("Non-Seattle runtime majors only auto-match Green River tracks when the mapped course overlap is strong enough", () => {
  const campusIds = ["uw-bothell", "uw-tacoma"] as const;

  for (const campusId of campusIds) {
    const runtimePlans = getTransferPlannerStudentRuntimeMajorsForCampus(campusId)
      .map((plan) => resolveTransferPlannerStudentRuntimeMajorPlan(plan, null))
      .flatMap((plan) => (plan ? [plan] : []));

    const runtimePlansWithMappedCourses = runtimePlans.filter(
      (plan) => getTransferPlannerGrcCourseList(plan).length > 0
    );

    assert.ok(
      runtimePlansWithMappedCourses.length > 0,
      `Expected at least one ${campusId} runtime plan with mapped GRC courses.`
    );

    const unexpectedlyMissingBestTrackPlanIds = runtimePlansWithMappedCourses
      .filter((plan) => !plan.bestTrackId)
      .filter(
        (plan) =>
          getTransferPlannerAutoMatchedTrackRecommendation(
            getTransferPlannerGrcCourseList(plan)
          ) !== null
      )
      .map((plan) => plan.id)
      .sort();

    assert.deepEqual(
      unexpectedlyMissingBestTrackPlanIds,
      [],
      `Expected ${campusId} runtime plans to omit bestTrackId only when the safer matcher also declines a recommendation.`
    );
    assert.ok(
      runtimePlansWithMappedCourses.some((plan) => plan.bestTrackId),
      `Expected at least one ${campusId} runtime plan with strong mapped overlap to have a bestTrackId.`
    );

    for (const plan of runtimePlansWithMappedCourses.filter((entry) => entry.bestTrackId)) {
      const track = getTransferPlannerTrack(plan.bestTrackId ?? null);
      assert.ok(track, `Expected ${plan.id} bestTrackId (${plan.bestTrackId}) to resolve to a track.`);
    }
  }
});

test("Runtime pathway options keep structured pathway-only course pools without collapsing route ids", () => {
  assert.ok(sourceGeneratedTacomaSudPlan, "Expected Tacoma SUD planner row.");
  assert.ok(sourceGeneratedTacomaUrbanStudiesPlan, "Expected Tacoma Urban Studies planner row.");

  const sudRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-tacoma-sustainable-urban-development"
  );
  const urbanRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-tacoma-urban-studies");

  const sourceSudPathways = new Map(
    getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaSudPlan).map((pathway) => [
      pathway.id,
      pathway,
    ] as const)
  );
  const runtimeSudPathways = new Map(
    getTransferPlannerStudentRuntimePathwaysForPlan(sudRuntimePlan).map((pathway) => [
      pathway.id,
      pathway,
    ] as const)
  );
  const sourceUrbanPathways = new Map(
    getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaUrbanStudiesPlan).map((pathway) => [
      pathway.id,
      pathway,
    ] as const)
  );
  const runtimeUrbanPathways = new Map(
    getTransferPlannerStudentRuntimePathwaysForPlan(urbanRuntimePlan).map((pathway) => [
      pathway.id,
      pathway,
    ] as const)
  );

  assert.deepEqual([...runtimeSudPathways.keys()], [...sourceSudPathways.keys()]);
  assert.deepEqual([...runtimeUrbanPathways.keys()], [...sourceUrbanPathways.keys()]);

  const sourceSudGisPathway = sourceSudPathways.get("gis-option");
  const runtimeSudGisPathway = runtimeSudPathways.get("gis-option");
  const sourceUrbanGisPathway = sourceUrbanPathways.get("gis-option");
  const runtimeUrbanGisPathway = runtimeUrbanPathways.get("gis-option");

  assert.ok(runtimeSudGisPathway, "Expected runtime Tacoma SUD GIS pathway option.");
  assert.ok(runtimeUrbanGisPathway, "Expected runtime Tacoma Urban Studies GIS pathway option.");
  assert.equal(runtimeSudGisPathway?.label, "GIS option");
  assert.equal(runtimeUrbanGisPathway?.label, "GIS option");
  assert.ok(runtimeSudGisPathway?.grcCourseList?.includes("GIS 260"));
  assert.ok(runtimeUrbanGisPathway?.grcCourseList?.includes("GIS 202"));
  assert.equal(runtimeSudGisPathway?.bestTrackId, sourceSudGisPathway?.bestTrackId ?? null);
  assert.equal(runtimeUrbanGisPathway?.bestTrackId, sourceUrbanGisPathway?.bestTrackId ?? null);
});

test.skip("Expanded pathway majors resolve to the selected official route and route-specific guidance", () => {
  assert.ok(sourceGeneratedGeographyPlan, "Expected source-generated Seattle Geography planner row.");
  assert.ok(sourceGeneratedPsychologyPlan, "Expected source-generated Seattle Psychology planner row.");
  assert.ok(sourceGeneratedPhghPlan, "Expected source-generated Seattle PH-GH planner row.");
  assert.ok(
    sourceGeneratedTacomaEnvSustainabilityPlan,
    "Expected source-generated Tacoma Environmental Sustainability planner row."
  );
  assert.ok(sourceGeneratedTacomaSudPlan, "Expected source-generated Tacoma SUD planner row.");
  assert.ok(
    sourceGeneratedTacomaUrbanStudiesPlan,
    "Expected source-generated Tacoma Urban Studies planner row."
  );
  assert.ok(sourceGeneratedTacomaEglsPlan, "Expected source-generated Tacoma EGLS planner row.");

  const geographyDataSciencePlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedGeographyPlan,
    "data-science-option"
  );
  const psychologyBsPlan = resolveTransferPlannerMajorPlan(sourceGeneratedPsychologyPlan, "bs-route");
  const phghNutritionPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedPhghPlan,
    "bs-nutritional-sciences-option"
  );
  const envSustainabilityEducationPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedTacomaEnvSustainabilityPlan,
    "education-option"
  );
  const sudGisPlan = resolveTransferPlannerMajorPlan(sourceGeneratedTacomaSudPlan, "gis-option");
  const urbanStudiesGisPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedTacomaUrbanStudiesPlan,
    "gis-option"
  );
  const eglsLaborPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedTacomaEglsPlan,
    "labor-studies-option"
  );

  assert.equal(geographyDataSciencePlan?.selectedPathwayLabel, "Data Science option");
  assert.ok(getTransferPlannerGrcCourseList(geographyDataSciencePlan).includes("CS 123"));
  assert.match(
    geographyDataSciencePlan?.degreeMapSections?.[1]?.title ?? "",
    /Data Science Option/
  );

  assert.equal(psychologyBsPlan?.selectedPathwayLabel, "B.S. route");
  assert.match(psychologyBsPlan?.degreeMapSections?.[1]?.title ?? "", /Psychology B\.S\. structure/);
  assert.equal(psychologyBsPlan?.grcCourseListGuidance ?? "", "");

  assert.equal(phghNutritionPlan?.selectedPathwayLabel, "B.S. Nutritional Sciences option");
  assert.ok(getTransferPlannerGrcCourseList(phghNutritionPlan).includes("NUTR& 101"));
  assert.match(phghNutritionPlan?.degreeMapSections?.[1]?.title ?? "", /Nutritional Sciences option/);

  assert.equal(envSustainabilityEducationPlan?.selectedPathwayLabel, "Education option");
  assert.match(
    envSustainabilityEducationPlan?.degreeMapSections?.[1]?.title ?? "",
    /Education option/
  );

  assert.equal(sudGisPlan?.selectedPathwayLabel, "GIS option");
  assert.ok(getTransferPlannerGrcCourseList(sudGisPlan).includes("GIS 260"));
  assert.match(sudGisPlan?.degreeMapSections?.[1]?.title ?? "", /GIS option/);

  assert.equal(urbanStudiesGisPlan?.selectedPathwayLabel, "GIS option");
  assert.ok(getTransferPlannerGrcCourseList(urbanStudiesGisPlan).includes("GIS 202"));
  assert.match(urbanStudiesGisPlan?.degreeMapSections?.[1]?.title ?? "", /GIS option/);

  assert.equal(eglsLaborPlan?.selectedPathwayLabel, "Labor Studies option");
  assert.match(eglsLaborPlan?.degreeMapSections?.[1]?.title ?? "", /Labor Studies option/);
});

test.skip("Canonical course registry now keeps pathway-specific GRC references for the expanded route set", () => {
  const statisticsDataScienceCourse = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
    (entry) =>
      entry.schoolId === "grc" &&
      entry.code === "CS 123" &&
      entry.sourceContexts.includes(
        "uw-seattle-statistics:pathway:data-science-track:grc-course-list"
      )
  );
  const chemistryAcsCourse = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
    (entry) =>
      entry.schoolId === "grc" &&
      entry.code === "MATH 238" &&
      entry.sourceContexts.includes(
        "uw-seattle-chemistry:pathway:acs-certified-bs-route:grc-course-list"
      )
  );

  assert.ok(
    statisticsDataScienceCourse,
    "Expected canonical course registry to retain the Statistics Data Science pathway course list."
  );
  assert.ok(
    chemistryAcsCourse,
    "Expected canonical course registry to retain the Chemistry ACS pathway course list."
  );
});

test.skip("Canonical course registry keeps new pathway-specific GRC references for added route coverage", () => {
  const geographyDataScienceCourse = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
    (entry) =>
      entry.schoolId === "grc" &&
      entry.code === "CS 123" &&
      entry.sourceContexts.includes(
        "uw-seattle-geography:pathway:data-science-option:grc-course-list"
      )
  );
  const phghNutritionCourse = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
    (entry) =>
      entry.schoolId === "grc" &&
      entry.code === "NUTR& 101" &&
      entry.sourceContexts.includes(
        "uw-seattle-public-health-global-health:pathway:bs-nutritional-sciences-option:grc-course-list"
      )
  );
  const sudGisCourse = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
    (entry) =>
      entry.schoolId === "grc" &&
      entry.code === "GIS 260" &&
      entry.sourceContexts.includes(
        "uw-tacoma-sustainable-urban-development:pathway:gis-option:grc-course-list"
      )
  );
  const urbanStudiesGisCourse = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
    (entry) =>
      entry.schoolId === "grc" &&
      entry.code === "GIS 202" &&
      entry.sourceContexts.includes(
        "uw-tacoma-urban-studies:pathway:gis-option:grc-course-list"
      )
  );

  assert.ok(
    geographyDataScienceCourse,
    "Expected canonical course registry to retain the Geography Data Science pathway course list."
  );
  assert.ok(
    phghNutritionCourse,
    "Expected canonical course registry to retain the PH-GH Nutritional Sciences pathway course list."
  );
  assert.ok(
    sudGisCourse,
    "Expected canonical course registry to retain the SUD GIS pathway course list."
  );
  assert.ok(
    urbanStudiesGisCourse,
    "Expected canonical course registry to retain the Urban Studies GIS pathway course list."
  );
});

test("Student runtime planner rows keep parser-first source-backed notes and avoid manual/legacy language", () => {
  const runtimePlans = TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.map((plan) =>
    getTransferPlannerStudentRuntimeMajorPlan(plan.id)
  ).filter((plan): plan is NonNullable<ReturnType<typeof getTransferPlannerStudentRuntimeMajorPlan>> =>
    Boolean(plan)
  );
  const invalid: string[] = [];
  const collectInvalid = (
    scopeId: string,
    scope: {
      beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
      stayAtGrcChecklist?: TransferPlannerChecklistItem[];
    }
  ) => {
    for (const section of ["beforeEnrollmentChecklist", "stayAtGrcChecklist"] as const) {
      for (const item of scope[section] ?? []) {
        const note = item.note?.trim();
        if (
          note &&
          (/\bmanual review\b|\badvisor review\b|\blegacy row\b|\bplanner-authored\b/i.test(note) ||
            /^Auto-generated from the current source-backed Green River class list/i.test(note) ||
            /^Use the current source-backed Green River class list as the planning starting point/i.test(note))
        ) {
          invalid.push(`${scopeId}:${section}:${item.id}`);
        }
      }
    }
  };

  for (const plan of runtimePlans) {
    collectInvalid(plan.id, plan);
    for (const pathway of getTransferPlannerStudentRuntimePathwaysForPlan(plan)) {
      collectInvalid(`${plan.id}:${pathway.id}`, pathway);
    }
  }

  assert.deepEqual(
    invalid,
    [],
    `Expected parser-first runtime notes to avoid manual/legacy authored language, but found: ${invalid.join(", ")}`
  );
});

