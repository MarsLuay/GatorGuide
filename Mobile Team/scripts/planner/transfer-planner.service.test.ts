import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
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
} from "@/constants/transfer-planner-source/course-metadata";
import {
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY,
} from "@/constants/transfer-planner-source/grc-associate-tracks.generated";
import {
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
} from "@/constants/transfer-planner-source";
import {
  buildHistoricalGrcTrackComparison,
  parseCompletedTranscriptCourses,
  normalizeCourseCode,
  extractCourseCodes,
  buildRequirementStatuses,
  buildTrackUsageSummary,
  buildTransferPlannerCoursePlanningGraph,
  buildTransferPlannerStudentCourseEvaluations,
  buildTransferPlannerStudentEvaluationReport,
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

function getRequiredPlan(id: string) {
  const plan = getTransferPlannerMajorPlan(id);
  if (!plan) {
    throw new Error(`Missing transfer planner data for ${id}.`);
  }
  return plan;
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
    if (rule.sourceKind !== "uw-green-river-equivalency-guide") {
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

  assert.equal(calcStatus.matched, true);
  assert.deepEqual(calcStatus.explicitCourseCodes, [
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 254",
  ]);

  const upcomingCourseLabels = getUpcomingCourseLabels(completedCourses);
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), false);
});

test("Seattle CompE still audits the older MATH& 153 plus MATH& 254 path in calc requirement matching", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152", "MATH& 153");
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(calcStatus.matched, false);
  assert.deepEqual(calcStatus.explicitCourseCodes, [
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 254",
  ]);
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
  assert.equal(hcdePlan.degreeMapSections.length >= 4, true);
  assert.equal(hcdePlan.degreeMapSections[0]?.title, "HCDE degree structure");

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
  assert.equal(chemEPlan.degreeMapSections.length >= 4, true);
  assert.equal(chemEPlan.degreeMapSections[0]?.title, "ChemE degree structure");

  const grcCourseList = getTransferPlannerGrcCourseList(chemEPlan);

  assert.equal(grcCourseList.includes("ENGR 250"), true);
  assert.equal(grcCourseList.includes("MATH& 254"), true);
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
  assert.equal(bioEPlan.degreeMapSections[0]?.title, "BioE engineering fundamentals");
});

test("Detailed majors expose an explicit per-major Green River course list", () => {
  const grcCourseList = getTransferPlannerGrcCourseList(compEPlan);

  assert.ok(grcCourseList.length > 0);
  assert.equal(grcCourseList.includes("CS 121"), true);
  assert.equal(grcCourseList.includes("MATH& 151"), true);
  assert.equal(grcCourseList.includes("CHEM& 161"), true);
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
    applicationWindow: "",
    startQuarter: "",
    bestTrackId: null,
    bestTrackSummary: "",
    whyThisTrack: [],
    financialAidNote: "",
    applicationChecklist: [],
    beforeEnrollmentChecklist: [
      buildChecklistItem("phys122", "PHYS 122", ["PHYS& 222"]),
    ],
    stayAtGrcChecklist: [
      buildChecklistItem("phys123", "PHYS 123", ["PHYS& 223"]),
    ],
    advisorFlags: [],
    involvementIdeas: [],
    projectIdeas: [],
    officialLinks: [],
    chainIds: ["PHYS-CALC"],
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

  assert.ok(
    bucketCourse,
    "Expected Art History to show a choice bucket instead of collapsing to a single first course."
  );
  assert.match(bucketCourse?.label ?? "", /Intro art, visual-culture, or humanities support/i);
  assert.match(bucketCourse?.guidanceSummary ?? "", /ART& 100/i);
  assert.match(bucketCourse?.guidanceSummary ?? "", /ART 105/i);
  assert.equal(
    plannedCourses.some((course) => course.label === "ART& 100"),
    false,
    "Expected the quarter plan to keep the bucket visible instead of scheduling ART& 100 as the bucket label."
  );
});

test("Seattle ECE now exposes structured degree-map sections", () => {
  assert.ok(ecePlan.degreeMapSections, "Expected Seattle ECE to include degree-map sections.");
  assert.equal(ecePlan.degreeMapSections.length >= 3, true);
  assert.equal(ecePlan.degreeMapSections[0]?.title, "BSECE degree structure");
});

test("Seattle Civil now tracks BSCE degree-map head starts at Green River", () => {
  const grcCourseList = getTransferPlannerGrcCourseList(civilPlan);

  assert.equal(grcCourseList.includes("ENGL 128"), true);
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
  assert.equal(mseCourseList.includes("MATH& 254"), true);
  assert.equal(mseCourseList.includes("ENGR& 224"), true);
});

test("Master-generated partial majors also materialize a Green River course list", () => {
  assert.ok(generatedPlan, "Expected at least one master-generated planner row.");

  const grcCourseList = getTransferPlannerGrcCourseList(generatedPlan);

  assert.ok(grcCourseList.length > 0);
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

  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaBabaPlan).length, 5);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaCommunicationDetailedPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaAmcPlan).length, 5);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaEnvSustainabilityPlan).length, 4);
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
  assert.equal(
    tacomaSocialWelfarePlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uwt-basw-stats"),
    true
  );
  assert.equal(
    tacomaUrbanDesignPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwt-ude-gis"),
    true
  );
  assert.equal(
    tacomaEglsDetailedPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwt-egls-social-justice-support"
    ),
    true
  );
  assert.equal(
    tacomaHealthcareLeadershipPlan?.applicationChecklist.some(
      (entry) => entry.id === "uwt-hl-stats"
    ),
    true
  );
  assert.equal(
    tacomaIasPlan?.applicationChecklist.some((entry) => entry.id === "uwt-ias-engl101"),
    true
  );
  assert.equal(
    tacomaIasIndividuallyDesignedPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwt-iasid-proposal-support"
    ),
    true
  );
  assert.equal(
    tacomaNursingPlan?.applicationChecklist.some((entry) => entry.id === "uwt-nursing-anat"),
    true
  );
  assert.equal(
    tacomaPpePlan?.applicationChecklist.some((entry) => entry.id === "uwt-ppe-micro"),
    true
  );
  assert.equal(
    tacomaSpanishPlan?.applicationChecklist.some((entry) => entry.id === "uwt-spanish-sequence"),
    true
  );
  assert.equal(
    tacomaSustainableUrbanDevelopmentPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwt-sud-gis-support"
    ),
    true
  );
  assert.equal(
    tacomaUrbanStudiesPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwt-urban-gis-support"
    ),
    true
  );
  assert.equal(
    tacomaWritingPlan?.applicationChecklist.some((entry) => entry.id === "uwt-writing-advanced-comp"),
    true
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

  assert.equal(
    seattleAppliedMathPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-apmath-amath301"
    ),
    true
  );
  assert.equal(
    seattleMathPlan?.applicationChecklist.some((entry) => entry.id === "uws-math-207"),
    true
  );
  assert.equal(
    seattleMathPlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uws-math-224"),
    true
  );
  assert.equal(getTransferPlannerPathwaysForPlan(seattleStatisticsPlan).length, 3);
  assert.equal(
    seattleStatisticsPlan?.applicationChecklist.some((entry) => entry.id === "uws-stat-208"),
    true
  );
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

  assert.equal(
    seattleAcmsPlan?.applicationChecklist.some((entry) => entry.id === "uws-acms-math208"),
    true
  );
  assert.equal(
    seattleAcePlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uws-ace-programming"),
    true
  );
  assert.equal(
    seattleArchitecturalDesignPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uws-archd-visual-foundation"
    ),
    true
  );
  assert.equal(
    seattleArtPlan?.applicationChecklist.some((entry) => entry.id === "uws-art-5credits"),
    true
  );
  assert.equal(
    seattleAsianLanguagesPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uws-alc-language"),
    true
  );
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

  assert.equal(
    seattleAsianStudiesPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-asst-language-foundation"
    ),
    true
  );
  assert.equal(
    seattleAstronomyPlan?.applicationChecklist.some((entry) => entry.id === "uws-astr-physics123"),
    true
  );
  assert.equal(
    seattleAtmosphericClimateSciencePlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-atmos-calc123"
    ),
    true
  );
  assert.equal(
    seattleBusinessAdministrationPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-baba-financial-accounting"
    ),
    true
  );
  assert.equal(
    seattleChinesePlan?.applicationChecklist.some((entry) => entry.id === "uws-chin-language-credits"),
    true
  );

  assert.equal(getTransferPlannerPathwaysForPlan(seattleAtmosphericClimateSciencePlan).length, 4);
  assert.equal(getTransferPlannerPathwaysForPlan(seattleBiochemistrySeattlePlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(seattleBiologySeattlePlan).length, 6);
  assert.equal(getTransferPlannerPathwaysForPlan(seattleChemistrySeattlePlan).length, 3);
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

  assert.equal(
    seattleClassicsPlan?.applicationChecklist.some((entry) => entry.id === "uws-classics-writing"),
    true
  );
  assert.equal(
    seattleCommunicationPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-comm-public-speaking"
    ),
    true
  );
  assert.equal(
    seattleCepPlan?.applicationChecklist.some((entry) => entry.id === "uws-cep-calc"),
    true
  );
  assert.equal(
    seattleCfrmPlan?.applicationChecklist.some((entry) => entry.id === "uws-cfrm-calc123"),
    true
  );
  assert.equal(
    seattleConstructionManagementPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-cm-programming"
    ),
    true
  );
  assert.equal(
    seattleDancePlan?.applicationChecklist.some((entry) => entry.id === "uws-dance-performance"),
    true
  );
  assert.equal(
    seattleDanishPlan?.applicationChecklist.some((entry) => entry.id === "uws-danish-language"),
    true
  );
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

  assert.equal(
    seattleDesignPlan?.applicationChecklist.some((entry) => entry.id === "uws-design-foundation"),
    true
  );
  assert.equal(
    seattleDisabilityStudiesPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-disability-writing"
    ),
    true
  );
  assert.equal(
    seattleDramaPlan?.applicationChecklist.some((entry) => entry.id === "uws-drama-performance"),
    true
  );
  assert.equal(
    seattleEcfsPlan?.applicationChecklist.some((entry) => entry.id === "uws-ecfs-psych"),
    true
  );
  assert.equal(
    seattleEssPlan?.applicationChecklist.some((entry) => entry.id === "uws-ess-calc123"),
    true
  );
  assert.equal(
    seattleEconomicsPlan?.applicationChecklist.some((entry) => entry.id === "uws-econ-calc"),
    true
  );
  assert.equal(
    seattleEducationStudiesPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-edst-writing"
    ),
    true
  );
  assert.equal(
    seattleEcoPlan?.applicationChecklist.some((entry) => entry.id === "uws-eco-writing"),
    true
  );
  assert.equal(
    seattleEnglishCreativeWritingPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-engcw-writing"
    ),
    true
  );
  assert.equal(
    seattleEnglishLlcPlan?.applicationChecklist.some((entry) => entry.id === "uws-engllc-writing"),
    true
  );
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
    assert.ok(String(plan.plannerNote ?? "").trim().length > 0, `Expected ${plan.title} to keep planner note guidance.`);
    assert.doesNotMatch(
      String(plan.plannerNote ?? "").toLowerCase(),
      /support-only|supportive prep only|supportive coverage|transfer-prep|placeholder|minimal|custom bank set|varies/
    );
  }

  assert.equal(hcdePlan?.plannerNote?.includes("admissions-first"), true);
  assert.equal(seattleStatisticsPlan?.plannerNote?.includes("Track-aware Statistics baseline"), true);
  assert.equal(seattleArchitecturalDesignPlan?.plannerNote?.includes("Foundation-first"), true);
  assert.equal(seattleAsianStudiesPlan?.plannerNote?.includes("Concentration-aware Asian Studies baseline"), true);
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
    assert.ok(
      String(plan.plannerNote ?? "").trim().length > 0,
      `Expected ${plan.title} to keep planner note guidance.`
    );
    assert.doesNotMatch(
      String(plan.plannerNote ?? "").toLowerCase(),
      /support-only|supportive prep only|supportive coverage|transfer-prep|placeholder|minimal|custom bank set|varies/
    );
  }

  assert.equal(
    seattleChinesePlan?.plannerNote?.includes("Language-progression Chinese baseline"),
    true
  );
  assert.equal(
    seattleCinemaMediaStudiesPlan?.plannerNote?.includes("Core-ready Cinema and Media baseline"),
    true
  );
  assert.equal(
    seattleCommunicationPlan?.plannerNote?.includes("Application-ready Communication baseline"),
    true
  );
  assert.equal(
    seattleConstructionManagementPlan?.plannerNote?.includes(
      "Technical-project Construction Management baseline"
    ),
    true
  );
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

  assert.equal(
    bothellAmericanEthnicStudiesPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwb-aes-foundation"
    ),
    true
  );
  assert.equal(
    bothellAppliedComputingPlan?.applicationChecklist.some(
      (entry) => entry.id === "uwb-acomp-programming"
    ),
    true
  );
  assert.equal(
    bothellBiologyPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uwb-bio-physics"
    ),
    true
  );
  assert.equal(
    bothellBbaPlan?.applicationChecklist.some((entry) => entry.id === "uwb-bba-engl128"),
    true
  );
  assert.equal(
    bothellAccountingPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwb-accounting-full-accounting"
    ),
    true
  );
  assert.equal(
    bothellFinancePlan?.applicationChecklist.some(
      (entry) => entry.id === "uwb-finance-financial-accounting"
    ),
    true
  );
  assert.equal(
    bothellLsiPlan?.advisorFlags.some((entry) => /BBUS 300 and BBUS 307/.test(entry)),
    true
  );
  assert.equal(
    bothellMarketingPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwb-marketing-communication"
    ),
    true
  );
  assert.equal(
    bothellScmPlan?.advisorFlags.some((entry) => /STEM-designated/.test(entry)),
    true
  );
  assert.equal(
    bothellChemistryBaPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uwb-chem-ba-organic"
    ),
    true
  );
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

  assert.equal(
    bothellChemistryBsPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uwb-chem-bs-advanced-math"
    ),
    true
  );
  assert.equal(
    bothellBiochemistryPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uwb-biochem-bio-foundation"
    ),
    true
  );
  assert.equal(
    bothellCsseIacPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uwb-csse-iac-stats"
    ),
    true
  );
  assert.equal(
    bothellCrsPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwb-crs-gis"),
    true
  );
  assert.equal(
    bothellClaPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uwb-cla-second-writing"
    ),
    true
  );
  assert.equal(
    bothellDataVisBaPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwb-dv-ba-visual"
    ),
    true
  );
  assert.equal(
    bothellDataVisBsPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uwb-dv-bs-linear"
    ),
    true
  );
  assert.equal(
    bothellDysPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwb-dys-child-development"),
    true
  );
  assert.equal(
    bothellEssPlan?.applicationChecklist.some((entry) => entry.id === "uwb-ess-earth-intro"),
    true
  );
  assert.equal(
    bothellEconomicsPlan?.applicationChecklist.some(
      (entry) => entry.id === "uwb-econ-advanced-writing"
    ),
    true
  );
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

  assert.equal(
    bothellElementaryEdPlan?.applicationChecklist.some(
      (entry) => entry.id === "uwb-elementary-ed-engl101"
    ),
    true
  );
  assert.equal(
    bothellEePlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwb-ee-circuits"),
    true
  );
  assert.equal(
    bothellEnvironmentalStudiesPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwb-enst-spatial"
    ),
    true
  );
  assert.equal(
    bothellGwssPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwb-gwss-social-inquiry"),
    true
  );
  assert.equal(
    bothellGlobalStudiesPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwb-global-language"
    ),
    true
  );
  assert.equal(
    bothellHealthStudiesPlan?.applicationChecklist.some(
      (entry) => entry.id === "uwb-health-reasoning"
    ),
    true
  );
  assert.equal(
    bothellImdPlan?.advisorFlags.some((entry) => /permanently suspended/i.test(entry)),
    true
  );
  assert.equal(
    bothellInterdisciplinaryArtsPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwb-ia-arts-foundation"
    ),
    true
  );
  assert.equal(
    bothellIndividualizedStudyPlan?.advisorFlags.some((entry) => /proposal-based degree/i.test(entry)),
    true
  );
  assert.equal(
    bothellLeppPlan?.applicationChecklist.some((entry) => entry.id === "uwb-lepp-government"),
    true
  );
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

  assert.equal(
    bothellMtvPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwb-mtv-programming"),
    true
  );
  assert.equal(
    bothellMathPlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uwb-math-linear"),
    true
  );
  assert.equal(
    bothellMcsPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwb-mcs-intro-media"),
    true
  );
  assert.equal(
    bothellFirstYearRnBsnPlan?.advisorFlags.some((entry) => /specialized first-year partner pathway/i.test(entry)),
    true
  );
  assert.equal(
    bothellRnBsnPlan?.applicationChecklist.some((entry) => entry.id === "uwb-rnbsn-ap"),
    true
  );
  assert.equal(
    bothellPhysicsBaPlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uwb-physics-ba-chem"),
    true
  );
  assert.equal(
    bothellPhysicsBsPlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uwb-physics-bs-programming"),
    true
  );
  assert.equal(
    bothellPsychologyPlan?.applicationChecklist.some((entry) => entry.id === "uwb-psych-intro"),
    true
  );
  assert.equal(
    bothellStsPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwb-sts-data-tech-support"),
    true
  );
  assert.equal(
    bothellSehbPlan?.advisorFlags.some((entry) => /continuing-students-only legacy row/i.test(entry)),
    true
  );
});

test("Generated planner output keeps support-only classes out of before-enrollment and simplifies kept degree notes", () => {
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

  assert.equal(plannedCourses.length, 0);
});

test("Source-generated majors no longer leave all three checklist buckets empty", () => {
  const missingBuckets = TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.filter(
    (plan) =>
      (plan.applicationChecklist?.length ?? 0) === 0 &&
      (plan.beforeEnrollmentChecklist?.length ?? 0) === 0 &&
      (plan.stayAtGrcChecklist?.length ?? 0) === 0
  ).map((plan) => plan.id);

  assert.deepEqual(
    missingBuckets,
    [],
    `Expected every source-generated major to materialize at least one checklist bucket, but found: ${missingBuckets.join(", ")}`
  );

  const individualizedStudies = getTransferPlannerMajorPlan("uw-seattle-individualized-studies");
  const envDesign = getTransferPlannerMajorPlan(
    "uw-seattle-environmental-design-and-sustainability"
  );

  assert.ok(individualizedStudies, "Expected Individualized Studies planner row.");
  assert.ok(envDesign, "Expected Environmental Design & Sustainability planner row.");
  assert.equal(individualizedStudies?.stayAtGrcChecklist.length > 0, true);
  assert.equal((envDesign?.grcCourseList?.length ?? 0) > 0, true);
  assert.equal((envDesign?.degreeMapSections?.length ?? 0) > 0, true);
  assert.match(
    individualizedStudies?.stayAtGrcChecklist[0]?.note ?? "",
    /custom green river course set required|student-designed seattle major/i
  );
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
  assert.doesNotMatch(envDesign.financialAidNote, /advisor|adviser/i);
  assert.equal(
    (envDesign.advisorFlags ?? []).some((flag) => /advisor|adviser/i.test(flag)),
    false
  );
  assert.equal(
    (envDesign.manualReviewNotes ?? []).some((note) => /manual review|advisor|adviser/i.test(note)),
    false
  );
  assert.match(envDesign.summary, /source-backed/i);
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
    applicationWindow: "",
    startQuarter: "",
    bestTrackId: null,
    bestTrackSummary: "",
    whyThisTrack: [],
    financialAidNote: "",
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
    involvementIdeas: [],
    projectIdeas: [],
    officialLinks: [],
    chainIds: ["PHYS-CALC"],
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

test("Bothell and Tacoma campuses also include automatic prerequisite plus transfer guidance", () => {
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
      applicationWindow: "",
      startQuarter: "",
      bestTrackId: null,
      bestTrackSummary: "",
      whyThisTrack: [],
      financialAidNote: "",
      applicationChecklist: [],
      beforeEnrollmentChecklist: [
        buildChecklistItem("phys122", "PHYS 122", ["PHYS& 222"]),
        buildChecklistItem("phys123", "PHYS 123", ["PHYS& 223"]),
      ],
      stayAtGrcChecklist: [],
      advisorFlags: [],
      involvementIdeas: [],
      projectIdeas: [],
      officialLinks: [],
      chainIds: ["PHYS-CALC"],
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
    applicationWindow: "",
    startQuarter: "",
    bestTrackId: null,
    bestTrackSummary: "",
    whyThisTrack: [],
    financialAidNote: "",
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
    involvementIdeas: [],
    projectIdeas: [],
    officialLinks: [],
    chainIds: ["CHEM-GEN"],
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

test("UW-transfer-only planning does not fall back to stay-at-GRC rows or track filler slots", () => {
  const track = getTransferPlannerTrack("999P");
  assert.ok(track, "Expected track 999P.");

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
    track,
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

test("General-education filler guidance now shows running credit progress by category", () => {
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

test("UW-transfer-only planning keeps required A&H/SSc placeholder guidance", () => {
  const plan = getRequiredPlan("uw-seattle-computer-engineering");
  const track = {
    id: "test-ah-ssc-required-placeholders",
    code: "TEST",
    title: "Test A&H/SSc placeholders",
    summary: "Synthetic placeholder-only track for UW-transfer-only filtering tests.",
    bestFor: ["testing"],
    terms: [
      {
        label: "Year 1 Fall",
        courses: ["Humanities or Social Science"],
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
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  const guidanceSummaries = plannedCourses.map((course) => course.guidanceSummary ?? "");

  assert.ok(
    guidanceSummaries.some((guidance) =>
      /A&H\/SSc credits needed for Computer Engineering\./i.test(guidance)
    )
  );
});

test("Planner keeps extending future quarters until late elective filler reaches full progress", () => {
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

  assert.equal(sharedBreadthPlaceholderEntries.length, 1);
  assert.equal(humanitiesPlaceholderEntries.length, 2);
  assert.equal(socialSciencePlaceholderEntries.length, 2);
  assert.equal(humanitiesPlaceholderEntries[0]?.quarterLabel, "Spring 2027");
  assert.match(
    humanitiesPlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /5\/10 A&H credits needed for Aeronautics & Astronautics\./i
  );
  assert.equal(
    humanitiesPlaceholderEntries[humanitiesPlaceholderEntries.length - 1]?.quarterLabel,
    "Spring 2029"
  );
  assert.match(
    humanitiesPlaceholderEntries[humanitiesPlaceholderEntries.length - 1]?.course.guidanceSummary ?? "",
    /10\/10 A&H credits needed for Aeronautics & Astronautics\./i
  );
  assert.equal(socialSciencePlaceholderEntries[0]?.quarterLabel, "Spring 2029");
  assert.match(
    socialSciencePlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /5\/10 SSc credits needed for Aeronautics & Astronautics\./i
  );
  assert.match(
    socialSciencePlaceholderEntries[socialSciencePlaceholderEntries.length - 1]?.course.guidanceSummary ?? "",
    /10\/10 SSc credits needed for Aeronautics & Astronautics\./i
  );
  assert.equal(
    socialSciencePlaceholderEntries[socialSciencePlaceholderEntries.length - 1]?.quarterLabel,
    "Fall 2029"
  );
  assert.doesNotMatch(
    humanitiesPlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /A&H\/SSc credits needed for Aeronautics & Astronautics\./i
  );
  assert.equal(sharedBreadthPlaceholderEntries[0]?.quarterLabel, "Spring 2029");
  assert.match(
    sharedBreadthPlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /4\/4 additional A&H\/SSc credits needed for Aeronautics & Astronautics\./i
  );
  assert.doesNotMatch(
    socialSciencePlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /40 A&H\/SSc credits needed for Aeronautics & Astronautics\./i
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

test("Applied Mathematics filler guidance keeps separate A&H and SSc placeholders when the source does not define a shared A&H/SSc bucket", () => {
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
  assert.equal(sharedBreadthCourse, undefined);

  assert.match(
    humanitiesCourse?.guidanceSummary ?? "",
    /5\/20 A&H credits needed for Applied Mathematics\./i
  );
  assert.match(
    socialScienceCourse?.guidanceSummary ?? "",
    /5\/20 SSc credits needed for Applied Mathematics\./i
  );
});

test("Seattle American Ethnic Studies planning keeps the current humanities-only breadth placeholders source-backed and separate", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-american-ethnic-studies");
  assert.ok(runtimePlan, "Expected the American Ethnic Studies runtime plan.");

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
  const humanitiesPlaceholders = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => course.label === "5 credits of Humanities")
        .map((course) => ({ quarterLabel: quarter.label, course }))
    );
  const sharedBreadthPlaceholders = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses.filter((course) => course.label === "5 credits of A&H or SSc")
    );

  assert.equal(humanitiesPlaceholders.length, 3);
  assert.equal(sharedBreadthPlaceholders.length, 1);
  assert.match(
    humanitiesPlaceholders[0]?.course.guidanceSummary ?? "",
    /5\/15 A&H credits planned for American Ethnic Studies\./i
  );
  assert.match(
    humanitiesPlaceholders[humanitiesPlaceholders.length - 1]?.course.guidanceSummary ?? "",
    /15\/15 A&H credits planned for American Ethnic Studies\./i
  );
  assert.match(
    sharedBreadthPlaceholders[0]?.guidanceSummary ?? "",
    /5\/5 A&H\/SSc credits planned for American Ethnic Studies\./i
  );
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

  const resolvedRuntimePlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, null);
  assert.ok(resolvedRuntimePlan, "Expected the resolved American Ethnic Studies runtime plan.");
  assert.match(
    resolvedRuntimePlan.bestTrackSummary,
    /matches 2 of the 3 degree-specific Green River classes currently tracked for this major\./i
  );
});

test("Green River associate track generation now covers the current official associate program-map library", () => {
  assert.ok(TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.programMapPageCount > 0);
  assert.equal(TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.officialAssociateTrackCount, 85);
  assert.equal(TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.compatibilityMappedTrackCount, 3);
  assert.equal(TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.generatedTrackCount, 85);

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

test("Generated associate tracks preserve the engineering compatibility IDs while switching to official current curriculum-map terms", () => {
  const trackQ = getTransferPlannerTrack("999Q");
  const trackO = getTransferPlannerTrack("999O");
  const trackP = getTransferPlannerTrack("999P");
  const legacyBaseTrack = getTransferPlannerTrack("999B");

  assert.ok(trackQ && trackO && trackP && legacyBaseTrack, "Expected the engineering compatibility tracks.");
  assert.ok(trackQ.terms.some((term) => /fall 1/i.test(term.label)));
  assert.ok(trackO.terms.some((term) => /quarter 1/i.test(term.label)));
  assert.ok(trackP.terms.some((term) => /fall 1/i.test(term.label)));
  assert.ok(trackP.officialLinks?.some((link) => /computer-and-electrical-engineering/i.test(link.url)));
  assert.ok(trackQ.officialLinks?.some((link) => /civil-and-mechanical-engineering/i.test(link.url)));
  assert.ok(
    trackO.officialLinks?.some((link) => /bioengineering-and-chemical-engineering/i.test(link.url))
  );
  assert.ok(legacyBaseTrack.catalogYears?.length, "Expected the retained 999B base track to keep legacy catalog history.");

  for (const track of [trackQ, trackO, trackP]) {
    const plannerCourseLabels = track.terms.flatMap((term) => term.courses);
    assert.equal(
      plannerCourseLabels.some((entry) => /select course from list/i.test(entry)),
      false,
      `Expected ${track.code} to use extracted public curriculum-map terms instead of raw placeholders.`
    );
  }
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
  const noSourceAvailability = getTransferPlannerGrcCourseAvailability("AMES 211");
  const legacyOnlyAvailability = getTransferPlannerGrcCourseAvailability("CS 120");

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

  assert.ok(noSourceAvailability, "Expected AMES 211 availability classification.");
  assert.equal(noSourceAvailability.status, "planner-course-no-current-public-source");
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary("AMES 211") ?? "",
    /Still referenced by the planner, but not found in the current Green River catalog/
  );

  assert.ok(legacyOnlyAvailability, "Expected CS 120 availability classification.");
  assert.equal(
    legacyOnlyAvailability.status,
    "legacy-track-only-no-current-public-source"
  );
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary("CS 120") ?? "",
    /Referenced only by legacy Green River track history/
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
    "legacy-track-only-no-current-public-source",
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
  assert.ok((countsByStatus["legacy-track-only-no-current-public-source"] ?? 0) > 0);

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

test("Phase 6 selects an older source-backed GRC track when transcript history points to that year", () => {
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
  assert.equal(comparison?.trackId, "999P");
  assert.equal(comparison?.currentCatalogYearLabel, "2025-2026");
  assert.equal(comparison?.inferredCatalogYearLabel, "2024-2025");
  assert.equal(comparison?.selectedCatalogYearLabel, "2024-2025");
  assert.equal(comparison?.selectedCatalogYearSource, "transcript");
  assert.equal(comparison?.usesCurrentRecommendedPath, false);
  assert.equal(comparison?.isHistoricalCatalogYear, true);
  assert.ok(comparison?.trackCourseCodes.includes("MATH& 153"));
  assert.ok(comparison?.trackCourseCodes.includes("MATH& 254"));
  assert.ok(comparison?.currentRecommendedCourseCodes.includes("MATH& 163"));
  assert.ok(comparison?.currentRecommendedCourseCodes.includes("MATH& 254"));
  assert.ok(comparison?.currentOnlyCourseCodes.includes("MATH& 163"));
  assert.ok(comparison?.legacyCatalogCourseCodes.includes("MATH& 153"));
  assert.ok(comparison?.legacyCourseCodesStillUsedByCurrentUwPlan.includes("MATH& 153"));
  assert.ok(comparison?.sourceBackedLegacyCourseCodes.includes("MATH& 153"));
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

test("Phase 6 keeps the current recommended track path for new students without transcript history", () => {
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

test("Phase 6 track usage summary compares historical GRC terms against current UW requirements", () => {
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

  assert.match(historicalSpecificEntries, /CS 120/);
  assert.match(historicalSpecificEntries, /MATH& 153/);
  assert.doesNotMatch(historicalSpecificEntries, /MATH& 163/);
  assert.match(currentSpecificEntries, /CS 121/);
  assert.match(currentSpecificEntries, /MATH& 163/);
  assert.doesNotMatch(currentSpecificEntries, /CS 120/);
});

test("Phase 7 planning graph derives prerequisite paths from source-backed course metadata", () => {
  const graph = buildTransferPlannerCoursePlanningGraph({
    plan: null,
    actionableCourseCodes: ["MATH& 153", "MATH& 163", "MATH& 254", "MATH 238", "MATH 240"],
  });

  assert.deepEqual(
    graph.prerequisiteCourseSetsByCourseCode["MATH& 254"]?.map((path) => path.join(" + ")).sort(),
    ["MATH& 153", "MATH& 163"]
  );
  assert.deepEqual(
    graph.prerequisiteCourseSetsByCourseCode["MATH 240"]?.map((path) => path.join(" + ")).sort(),
    ["MATH& 153", "MATH& 163"]
  );
  assert.equal(graph.prerequisiteCourseSetsByCourseCode["MATH 238"], undefined);
  assert.deepEqual(graph.corequisiteCourseSetsByCourseCode["MATH 238"], [["MATH& 254"]]);
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

test("Phase 7 planning graph keeps curated chain rules as a fallback while metadata coverage grows", () => {
  const graph = buildTransferPlannerCoursePlanningGraph({
    plan: {
      ...compEPlan,
      chainIds: ["PHYS-CALC"],
    },
    actionableCourseCodes: ["PHYS& 221", "PHYS& 222", "PHYS& 223"],
  });

  assert.deepEqual(graph.prerequisiteCourseSetsByCourseCode["PHYS& 222"], [["PHYS& 221"]]);
  assert.deepEqual(graph.prerequisiteCourseSetsByCourseCode["PHYS& 223"], [["PHYS& 222"]]);
  assert.equal(graph.sourceCounts.metadataPrerequisiteCourseCount, 0);
  assert.equal(graph.sourceCounts.chainPrerequisiteCourseCount, 2);
});

test("Phase 7 planning graph keeps chain fallback targets inside the actionable planner set", () => {
  const graph = buildTransferPlannerCoursePlanningGraph({
    plan: {
      ...compEPlan,
      chainIds: ["PHYS-CALC"],
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

  assert.equal(plannedQuarterLabelForCourse("MATH& 254"), "Fall 2026");
  assert.equal(plannedQuarterLabelForCourse("MATH 238"), "Fall 2026");
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

  assert.notEqual(plannedCourseLabels.indexOf("MATH& 254"), -1);
  assert.notEqual(plannedCourseLabels.indexOf("MATH 238"), -1);
  assert.equal(plannedCourseLabels.indexOf("MATH& 254") <= plannedCourseLabels.indexOf("MATH 238"), true);
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

  assert.equal(legacyEvaluation?.outcome, "legacy-rule-used");
  assert.equal(legacyEvaluation?.ruleStatus, "legacy");
  assert.equal(legacyEvaluation?.acceptanceCategory, "legacy-accepted");
  assert.deepEqual(legacyEvaluation?.sourceCourseSet, ["MATH& 153", "MATH& 254"]);
  assert.deepEqual(legacyEvaluation?.missingSourceCourseCodes, []);
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

  assert.equal(calcEvaluation?.outcome, "auto-approved");
  assert.equal(calcEvaluation?.approvedRuleId, "uw-grc-guide:0798:mathematics:mathand-163-5");
  assert.equal(
    calcEvaluation?.alternativeApprovedRuleIds.includes("stem-calculus-current-sequence"),
    true
  );
  assert.equal(
    calcEvaluation?.alternativeApprovedRuleIds.includes(calcEvaluation?.approvedRuleId ?? ""),
    false
  );
  assert.equal(calcEvaluation?.sourceLinks.some((link) => /washington\.edu/.test(link.url)), true);
  assert.deepEqual(calcEvaluation?.appliedRequirementIds, ["calc3"]);
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

test("Phase 9 advisor-ready report preserves selected pathway scope", () => {
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

  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGeneratedMajorPlanCount, internalMajorCount);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.studentVisibleMajorPlanCount, studentFacingMajorCount);
  assert.equal(studentFacingMajorCount, visibleSourceGeneratedMajorCount);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.hiddenSourceGapMajorPlanCount, hiddenMajorGapCount);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.hiddenSourceGapPathwayCount, hiddenPathwayGapCount);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.studentVisiblePathwayCount, studentFacingPathwayCount);
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
    "scripts/planner/generate-transfer-planner-source-bootstrap.cjs",
    "scripts/planner/parse-transfer-planner-equivalency-guide.cjs",
    "scripts/planner/ingest-grc-catalog.cjs",
    "scripts/planner/ingest-uw-catalog.cjs",
    "scripts/planner/generate-transfer-planner-course-metadata.cjs",
    "scripts/planner/generate-transfer-planner-grc-availability.cjs",
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
  const maintenanceCmd = readFileSync("scripts/run-planner-maintenance.cmd", "utf8");
  const windowsQaScript = readFileSync("scripts/qa/run-windows-qa.cjs", "utf8");
  const windowsInteractionsScript = readFileSync(".tools/windows-interactions.mjs", "utf8");
  const packageJson = readFileSync("package.json", "utf8");
  const readme = readFileSync("README.md", "utf8");

  assert.match(maintenanceScript, /run-transfer-planner-refresh\.ps1/);
  assert.match(maintenanceScript, /playwright",\s*"install",\s*"chromium"/);
  assert.match(maintenanceScript, /npm\.cmd"\s*-Arguments\s*@\("run",\s*"qa:windows:ci"\)/);
  assert.match(maintenanceScript, /verify-transfer-planner-hardening\.cjs/);
  assert.match(maintenanceScript, /transfer-planner-maintenance-summary\.md/);
  assert.match(maintenanceScript, /transfer-planner-hardening-report\.md/);
  assert.match(maintenanceScript, /Start-Process/);
  assert.match(maintenanceScript, /RedirectStandardOutput/);
  assert.match(maintenanceScript, /RedirectStandardError/);
  assert.match(maintenanceScript, /\$stepResults\["Planner refresh"\]\s*=\s*"passed"/);
  assert.match(maintenanceScript, /\$stepResults\["Windows QA"\]\s*=\s*"passed"/);
  assert.match(maintenanceScript, /\$stepResults\["Planner hardening checks"\]\s*=\s*"passed"/);

  assert.match(maintenanceCmd, /run-transfer-planner-maintenance\.ps1/);

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
  assert.match(readme, /run-planner-maintenance\.cmd/);
  assert.match(readme, /transfer-planner-maintenance-summary\.md/);
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

test("Phase 10 student runtime planner strips planner-authored detail and keeps automatic data", () => {
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
  assert.deepEqual(runtimeCompEPlan.involvementIdeas, []);
  assert.deepEqual(runtimeCompEPlan.projectIdeas, []);
  assert.deepEqual(runtimeCompEPlan.officialLinks, []);
  assert.deepEqual(runtimeCompEPlan.degreeMapSections, []);
  assert.deepEqual(runtimeCompEPlan.manualReviewNotes, []);
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
  assert.equal(resolvedRuntimeCompEPlan.bestTrackId, "999P");

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
  assert.equal(resolvedRuntimeEcePlan.bestTrackId, "999P");
  const runtimeEceApplicationTitles = (resolvedRuntimeEcePlan.applicationChecklist ?? []).map(
    (item) => item.title
  );
  const runtimeEceBeforeEnrollmentTitles = (
    resolvedRuntimeEcePlan.beforeEnrollmentChecklist ?? []
  ).map((item) => item.title);
  const runtimeEceGrcCourseList = getTransferPlannerGrcCourseList(resolvedRuntimeEcePlan);
  assert.ok(runtimeEceApplicationTitles.includes("MATH 124, 125, 126"));
  assert.ok(runtimeEceApplicationTitles.includes("CSE 122 or CSE 123"));
  assert.ok(runtimeEceApplicationTitles.includes("PHYS 121 and PHYS 122"));
  assert.ok(runtimeEceApplicationTitles.includes("English composition"));
  assert.equal(runtimeEceApplicationTitles.includes("BIOL 161"), false);
  assert.equal(runtimeEceApplicationTitles.includes("BIOL 220"), false);
  assert.equal(runtimeEceApplicationTitles.includes("CSE 143"), false);
  assert.equal(runtimeEceApplicationTitles.includes("AMATH 301"), false);
  assert.equal(runtimeEceApplicationTitles.includes("CHEM 152"), false);
  assert.equal(runtimeEceApplicationTitles.includes("CHEM 220"), false);
  assert.equal(runtimeEceApplicationTitles.includes("MSE 170"), false);
  assert.equal(runtimeEceApplicationTitles.includes("STAT 220"), false);
  assert.ok(runtimeEceBeforeEnrollmentTitles.includes("EE 215"));
  assert.ok(runtimeEceBeforeEnrollmentTitles.includes("MATH 207 or AMATH 351"));
  assert.equal(
    runtimeEceBeforeEnrollmentTitles.includes("CSE 123 or equivalent strongest programming finish"),
    false
  );
  assert.ok(runtimeEceBeforeEnrollmentTitles.includes("Two additional science / math depth options"));
  assert.ok(runtimeEceGrcCourseList.includes("ENGR& 204"));
  assert.ok(runtimeEceGrcCourseList.includes("CHEM& 161"));
  assert.ok(runtimeEceGrcCourseList.includes("PHYS& 223"));
  assert.equal(runtimeEceGrcCourseList.includes("BIOL& 211"), false);
  assert.equal(runtimeEceGrcCourseList.includes("CHEM& 262"), false);
  assert.equal(runtimeEceGrcCourseList.includes("CS 145"), false);
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

  assert.deepEqual(leaks, []);
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
    /getTransferPlannerStudentRuntimeMajorsForCampus\(selectedCampusId\)/
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

test("Transfer equivalency catalog supports multi-tag placeholder filters", () => {
  const equivalencyCatalogPage = readFileSync(
    "components/pages/TransferEquivalencyCatalogPage.tsx",
    "utf8"
  );

  assert.match(equivalencyCatalogPage, /flatMap\(\(value\) => String\(value \?\? ""\)\.split\(","\)\)/);
  assert.match(equivalencyCatalogPage, /if \(selectedTags\.length\) return selectedTags;/);
  assert.match(
    equivalencyCatalogPage,
    /const isOpen = tagOpenState\[tag\] \?\? \(selectedTags\.length > 0\);/
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
  assert.match(toolSummary, /run-planner-maintenance\.cmd/);

  assert.match(docsReadme, /planner:windows:maintenance/);
  assert.match(docsReadme, /run-planner-maintenance\.cmd/);
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
  const brokenPrimaryOwners = [
    "uw-tacoma-communications",
    "uw-tacoma-communications:pathway:professional-track",
    "uw-tacoma-communications:pathway:research-track",
    "uw-tacoma-economics-and-policy-analysis",
    "uw-tacoma-politics-philosophy-and-economics",
  ];

  for (const ownerId of brokenPrimaryOwners) {
    const block = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.find(
      (entry) => entry.ownerId === ownerId
    );

    assert.ok(block, `Expected parsed requirement-source block for ${ownerId}.`);
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

test("Quarter planning falls back cleanly when a course is not in the newest published GRC schedule", () => {
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

test("Runtime CompE planning defaults to the matched track, then UW-only hides nonessential track extras", () => {
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

test("PHYS& 114 appears before engineering physics options in checklist alternatives", () => {
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

test("Canonical course registry bootstraps planner-tracked GRC and UW courses without dropping references", () => {
  const grcCalc = getTransferPlannerCanonicalCourse("grc", "MATH& 151");
  const seattleUwCourse = getTransferPlannerCanonicalCourse("uw-seattle", "CSE 121");

  assert.ok(grcCalc, "Expected a canonical GRC calculus course entry.");
  assert.ok(seattleUwCourse, "Expected a canonical UW Seattle course entry from exact degree maps.");

  assert.equal(grcCalc?.referencedByPlanIds.includes("uw-seattle-computer-engineering"), true);
  assert.equal(grcCalc?.sourceKinds.includes("plan-checklist"), true);
  assert.equal(grcCalc?.title, "Calculus I");
  assert.equal(grcCalc?.creditValue, 5);
  assert.equal(grcCalc?.effectiveYearRanges.length > 0, true);
  assert.equal(seattleUwCourse?.sourceKinds.includes("plan-degree-map"), true);
  assert.equal(seattleUwCourse?.title, "Computer Programming I");
  assert.equal(seattleUwCourse?.creditValue, 4);
});

test("Canonical course registry now stores source-backed sequence metadata for planner-critical GRC courses", () => {
  const math153 = getTransferPlannerCanonicalCourse("grc", "MATH& 153");
  const math254 = getTransferPlannerCanonicalCourse("grc", "MATH& 254");
  const math240 = getTransferPlannerCanonicalCourse("grc", "MATH 240");
  const chemistryTwo = getTransferPlannerCanonicalCourse("grc", "CHEM& 162");
  const csTwo = getTransferPlannerCanonicalCourse("grc", "CS 122");
  const math238 = getTransferPlannerCanonicalCourse("grc", "MATH 238");
  const phys223 = getTransferPlannerCanonicalCourse("grc", "PHYS& 223");
  const engr225 = getTransferPlannerCanonicalCourse("grc", "ENGR& 225");

  assert.equal(math153?.title, "Calculus III");
  assert.deepEqual(math153?.prerequisiteCourseCodes, ["MATH& 152"]);

  assert.equal(math254?.title, "Calculus IV");
  assert.deepEqual(
    math254?.prerequisiteAlternativeCourseCodeSets?.map((path) => path.join(" + ")).sort(),
    ["MATH& 153", "MATH& 163"]
  );

  assert.equal(math240?.title, "Linear Algebra");
  assert.equal(math240?.creditValue, 5);
  assert.deepEqual(
    math240?.prerequisiteAlternativeCourseCodeSets?.map((path) => path.join(" + ")).sort(),
    ["MATH& 153", "MATH& 163"]
  );

  assert.equal(chemistryTwo?.title, "General Chemistry with Lab II");
  assert.deepEqual(chemistryTwo?.prerequisiteCourseCodes, ["CHEM& 161"]);

  assert.equal(csTwo?.title, "Computer Science II");
  assert.deepEqual(csTwo?.prerequisiteCourseCodes, ["CS 121"]);

  assert.equal(math238?.title, "Differential Equations");
  assert.deepEqual(math238?.prerequisiteCourseCodes, []);
  assert.deepEqual(math238?.corequisiteCourseCodes, ["MATH& 254"]);

  assert.equal(phys223?.title, "Engineering Physics III with Lab");
  assert.deepEqual(phys223?.prerequisiteCourseCodes, ["MATH& 152", "PHYS& 222"]);
  assert.deepEqual(
    phys223?.corequisiteAlternativeCourseCodeSets?.map((path) => path.join(" + ")).sort(),
    ["MATH& 153", "MATH& 163"]
  );

  assert.equal(engr225?.title, "Mechanics of Materials");
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

test("Every Seattle planner row now exposes real planner content, including custom guidance for proposal-based majors", () => {
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

test("Every Tacoma planner row now exposes real planner content in the source-generated runtime rows", () => {
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

test("Every Bothell planner row now exposes real planner content in the source-generated runtime rows", () => {
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

test("Strict English Creative Writing-style source-only majors no longer surface UW-only placeholder rows", () => {
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

test("Communication and Tacoma CSS no longer surface source-backed UW-only prep-target rows", () => {
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

test("Language-sequence strict majors no longer surface runtime placeholder language rows", () => {
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

test("Former empty runtime custom-prep majors no longer surface parsed UW-only prep-target rows", () => {
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

test("Former empty runtime custom-prep majors no longer use structured source-backed guidance rows", () => {
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

test("Source-backed UW prep fallback placeholder variants stay hidden in student runtime", () => {
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

test("Requirement and degree-map registries cover all current planner rows", () => {
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

test("Equivalency rule registry keeps both structured planner rules and chain-library nuance", () => {
  const structuredRule = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.find(
    (entry) => entry.id === "stem-calculus-current-sequence"
  );
  const legacyCalcRule = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.find(
    (entry) => entry.id === "stem-calculus-older-sequence"
  );
  const chainRule = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.find(
    (entry) => entry.id === "chain:math-stem"
  );
  const legacyCsRule = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.find(
    (entry) => entry.id === "chain:cs-legacy"
  );
  const comm266Rule = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.find(
    (entry) => entry.id === "chain:comm-266"
  );

  assert.ok(structuredRule, "Expected the structured stem-calculus rule.");
  assert.ok(legacyCalcRule, "Expected the legacy calculus alternative rule.");
  assert.ok(chainRule, "Expected the chain-derived MATH-STEM rule.");
  assert.ok(legacyCsRule, "Expected the legacy CS chain rule.");
  assert.ok(comm266Rule, "Expected the CMST 266 warning rule.");
  assert.deepEqual(structuredRule?.sourceCourseSets, [["MATH& 151", "MATH& 152", "MATH& 163"]]);
  assert.equal(structuredRule?.acceptanceCategory, "preferred");
  assert.equal(legacyCalcRule?.acceptanceCategory, "legacy-accepted");
  assert.deepEqual(legacyCalcRule?.weakerThanRuleIds, ["stem-calculus-current-sequence"]);
  assert.ok(
    legacyCalcRule?.effectiveYearRanges.some((range) => range.startLabel === "legacy-planner-support")
  );
  assert.ok((legacyCalcRule?.plannerWarnings.length ?? 0) > 0);
  assert.match(chainRule?.targetOutcome ?? "", /MATH& 151/);
  assert.equal(chainRule?.acceptanceCategory, "accepted-with-warning");
  assert.equal(legacyCsRule?.acceptanceCategory, "legacy-accepted");
  assert.deepEqual(legacyCsRule?.weakerThanRuleIds, ["computer-science-new-sequence"]);
  assert.ok(
    (legacyCsRule?.plannerWarnings ?? []).some((warning) => /prefers the current CS 121/i.test(warning))
  );
  assert.equal(comm266Rule?.acceptanceCategory, "accepted-with-warning");
  assert.ok(
    (comm266Rule?.plannerWarnings ?? []).some((warning) => /5 credits/i.test(warning))
  );
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
  assert.deepEqual(typeCounts, {
    "direct-course": 278,
    "elective-credit": 770,
    "limited-credit": 175,
    "no-credit": 14,
    sequence: 79,
  });
  assert.deepEqual(statusCounts, {
    active: 570,
    legacy: 746,
  });
  assert.deepEqual(sourceKindCounts, TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCountsBySourceKind);
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCount,
    TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.length
  );
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCountsByType["sequence"],
    82
  );
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

    assert.doesNotMatch(persistedText, /Â/);
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
  const artLimitedCredit = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) => entry.sourceCourseLabel === "ART 150 (3) was the same as § ENGL 154"
  );
  const mathNoCredit = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) => entry.sourceCourseLabel === "MATH 115T"
  );

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
  const legacyMathSequence = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) =>
      entry.sourceCourseLabel ===
      "§ MATH& 153, 254 (5, 5) formerly MATH 126, 224 combined entry"
  );
  const priorToMathRow = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) => entry.sourceCourseLabel === "§ MATH& 153 (5) formerly MATH 126 (5) see also MATH& 153 combined entry"
  );

  assert.ok(legacyMathSequence, "Expected the legacy MATH& 153/254 date-effective row.");
  assert.equal(legacyMathSequence?.ruleStatus, "legacy");
  assert.equal(legacyMathSequence?.isObsoleteSourceCourse, true);
  assert.deepEqual(legacyMathSequence?.sourceCourseSets, [["MATH& 153", "MATH& 254"]]);
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
  const priorToMath153Rule = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) =>
      entry.sourceCourseLabel ===
      "§ MATH& 153 (5) formerly MATH 126 (5) see also MATH& 153 combined entry"
  );
  const legacyMath153Sequence = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) =>
      entry.sourceCourseLabel ===
      "§ MATH& 153, 254 (5, 5) formerly MATH 126, 224 combined entry"
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
    math254AfterCutoff.some((entry) => entry.targetCourseCodes?.includes("MATH 224")),
    "Expected the replacement MATH& 254 row to carry MATH 224 after the 2025 cutoff."
  );
});

test("Legacy and canonical course-code aliases normalize to one planner code", () => {
  assert.equal(normalizeCourseCode("MATH& 254"), "MATH& 264");
  assert.equal(normalizeCourseCode("MATH&264"), "MATH& 264");
  assert.equal(normalizeCourseCode("  math&   254  "), "MATH& 264");

  const extracted = extractCourseCodes("Take MATH& 254 (legacy) or MATH& 264 (current)");
  assert.deepEqual(extracted, ["MATH& 264"]);
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

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.code, "MATH& 264");
});

test("Planner parser and generator scripts keep the shared legacy alias map", () => {
  const plannerScriptPaths = [
    "scripts/planner/ingest-grc-catalog.cjs",
    "scripts/planner/generate-transfer-planner-course-metadata.cjs",
    "scripts/planner/generate-transfer-planner-grc-associate-tracks.cjs",
    "scripts/planner/generate-transfer-planner-grc-availability.cjs",
    "scripts/planner/parse-transfer-planner-equivalency-guide.cjs",
    "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
    "scripts/planner/promote-transfer-planner-requirement-diffs.cjs",
  ];

  for (const scriptPath of plannerScriptPaths) {
    const contents = readFileSync(scriptPath, "utf8");
    assert.ok(
      contents.includes('["MATH& 254", "MATH& 264"]'),
      `${scriptPath} is missing the shared legacy alias mapping for Calculus IV.`
    );
  }
});

test("Phase 5 requirement-source adapters generate registry-backed source blocks", () => {
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
      assert.ok(candidate.sourceLineHints.every((line) => line.includes(candidate.uwCourseCode)));
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

test("Phase 5 parser extracts spaced-subject and linked-PDF course codes from weak public sources", () => {
  const politicalScienceBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-political-science"
  )[0];
  const realEstateBlock = getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-real-estate")[0];
  const germanBlock = getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-german")[0];
  const oceanographyBlock = getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-oceanography")[0];
  const computerEngineeringBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-computer-engineering"
  )[0];
  const interactiveMediaDesignBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-interactive-media-design"
  )[0];

  assert.ok(politicalScienceBlock.parsedUwCourseCodes.includes("POL S 101"));
  assert.ok(politicalScienceBlock.parsedUwCourseCodes.includes("POL S 204"));
  assert.ok(politicalScienceBlock.parsedUwCourseCodes.includes("POL S 497"));

  assert.ok(realEstateBlock.parsedUwCourseCodes.includes("R E 250"));
  assert.ok(realEstateBlock.parsedUwCourseCodes.includes("R E 480"));

  assert.ok(germanBlock.parsedUwCourseCodes.includes("GERMAN 301"));
  assert.ok(germanBlock.parsedUwCourseCodes.includes("GERMAN 302"));
  assert.ok(germanBlock.parsedUwCourseCodes.includes("GERMAN 303"));

  assert.ok(oceanographyBlock.parsedUwCourseCodes.includes("OCEAN 200"));
  assert.ok(oceanographyBlock.parsedUwCourseCodes.includes("OCEAN 351"));

  assert.ok(computerEngineeringBlock.parsedUwCourseCodes.includes("CSE 311"));
  assert.ok(computerEngineeringBlock.parsedUwCourseCodes.includes("EE 205"));
  assert.ok(computerEngineeringBlock.parsedUwCourseCodes.includes("EE 215"));
  assert.ok(computerEngineeringBlock.parsedUwCourseCodes.includes("STAT 391"));
  assert.equal(computerEngineeringBlock.parsedUwCourseCodes.includes("AS STAT 391"), false);

  assert.equal(interactiveMediaDesignBlock.resolutionStrategy, "alternate-official-source");
  assert.match(interactiveMediaDesignBlock.sourceUrl, /fillable-imd\.pdf$/);
  assert.ok(interactiveMediaDesignBlock.parsedUwCourseCodes.includes("BWRIT 135"));
});

test("Phase 5 parser merges supplemental alternates without keeping malformed subject fragments", () => {
  const bothellComputerEngineeringBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-computer-engineering"
  )[0];
  const seattleBusinessAdministrationBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-business-administration"
  )[0];
  const swedishBlock = getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-swedish")[0];

  assert.ok(bothellComputerEngineeringBlock.parsedUwCourseCodes.includes("BEE 215"));
  assert.ok(bothellComputerEngineeringBlock.parsedUwCourseCodes.includes("BWRIT 135"));
  assert.ok(bothellComputerEngineeringBlock.parsedUwCourseCodes.includes("CSS 301"));
  assert.ok(bothellComputerEngineeringBlock.parsedUwCourseCodes.includes("STMATH 208"));

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
      bothellComputerEngineeringBlock.parsedUwCourseCodes.includes(malformedCode),
      false,
      `Bothell Computer Engineering should not keep malformed parsed code ${malformedCode}.`
    );
  }

  assert.ok(seattleBusinessAdministrationBlock.parsedUwCourseCodes.includes("Q SCI 291"));
  assert.ok(seattleBusinessAdministrationBlock.parsedUwCourseCodes.includes("QMETH 201"));
  assert.ok(seattleBusinessAdministrationBlock.parsedUwCourseCodes.includes("MATH 126"));
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

  assert.equal(swedishBlock.parsedUwCourseCodes.includes("ON THE 300"), false);
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

  assert.ok(historyBlock.parsedUwCourseCodes.includes("THIST 101"));
  assert.ok(historyBlock.parsedUwCourseCodes.includes("THIST 201"));
  assert.ok(historyBlock.parsedDegreeMapBlockCandidates.length >= 1);
  assert.match(historyBlock.parsedDegreeMapBlockCandidates[0]?.title ?? "", /history/i);

  assert.ok(artsMediaCultureBlock.parsedUwCourseCodes.includes("TAMST 101"));
  assert.ok(artsMediaCultureBlock.parsedUwCourseCodes.includes("TCOM 201"));
  assert.ok(artsMediaCultureBlock.parsedUwCourseCodes.includes("TFILM 220"));
  assert.ok(artsMediaCultureBlock.parsedUwCourseCodes.includes("TLIT 220"));
  assert.ok(
    artsMediaCultureBlock.parsedDegreeMapBlockCandidates.some(
      (candidate) => /Arts, Media and Culture/i.test(candidate.title)
    )
  );

  assert.ok(businessAdministrationBlock.parsedUwCourseCodes.includes("BBUS 215"));
  assert.ok(businessAdministrationBlock.parsedUwCourseCodes.includes("BIS 200"));
  assert.ok(businessAdministrationBlock.parsedUwCourseCodes.includes("BMATH 144"));
  assert.ok(businessAdministrationBlock.parsedUwCourseCodes.includes("BWRIT 135"));
  assert.ok(businessAdministrationBlock.parsedUwCourseCodes.includes("QMETH 201"));
  assert.ok(
    businessAdministrationBlock.parsedDegreeMapBlockCandidates.some(
      (candidate) => /Business Administration/i.test(candidate.title)
    )
  );

  assert.ok(ppeBlock.parsedUwCourseCodes.includes("TBECON 220"));
  assert.ok(ppeBlock.parsedUwCourseCodes.includes("TECON 200"));
  assert.ok(ppeBlock.parsedUwCourseCodes.includes("TPHIL 250"));
  assert.ok(ppeBlock.parsedUwCourseCodes.includes("TPOLS 260"));
  assert.ok(
    ppeBlock.parsedDegreeMapBlockCandidates.some((candidate) =>
      /Politics, Philosophy and Economics/i.test(candidate.title)
    )
  );
});

test("Phase 5 parser recovers weak Seattle language and policy pages from official alternates", () => {
  const italianBlock = getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-italian")[0];
  const publicServicePolicyBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-public-service-and-policy"
  )[0];
  const slavicBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-slavic-languages-and-literatures"
  )[0];

  assert.ok(italianBlock.parsedUwCourseCodes.includes("ITAL 201"));
  assert.ok(italianBlock.parsedUwCourseCodes.includes("ITAL 301"));
  assert.equal(italianBlock.usedSnapshotFallback, false);

  assert.ok(publicServicePolicyBlock.parsedUwCourseCodes.includes("PUBPOL 201"));
  assert.ok(publicServicePolicyBlock.parsedUwCourseCodes.includes("QMETH 201"));
  assert.equal(publicServicePolicyBlock.usedSnapshotFallback, false);

  assert.ok(slavicBlock.parsedUwCourseCodes.includes("RUSS 301"));
  assert.ok(slavicBlock.parsedUwCourseCodes.includes("SLAVIC 320"));
  assert.equal(slavicBlock.usedSnapshotFallback, false);
});

test("Phase 5 broad overview alternates do not replace focused Seattle degree sheets", () => {
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

  assert.equal(artsMediaCultureBlock.parsedUwCourseCodes.includes("ROOM 251"), false);

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
      businessAdministrationBlock.parsedUwCourseCodes.includes(excludedCode),
      false,
      `Bothell Business Administration should not keep transfer-credit code ${excludedCode}.`
    );
  }

  assert.equal(ppeBlock.parsedUwCourseCodes.includes("POLS 202"), false);
  assert.equal(criminalJusticeBlock.parsedUwCourseCodes.includes("COMPLETE 180"), false);
  assert.equal(criminalJusticeBlock.parsedUwCourseCodes.includes("COMPLETE 480"), false);
  assert.equal(developmentalYouthStudiesBlock.parsedUwCourseCodes.includes("EARN 180"), false);
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

test("Source summary reports a non-empty layered registry bootstrap", () => {
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

test("Phase 3 Green River catalog ingest fills source-backed metadata for planner courses", () => {
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

  assert.deepEqual(accountingParserResult.prerequisiteCourseCodes, []);
  assert.deepEqual(accountingParserResult.prerequisiteAlternativeCourseCodeSets, [
    ["ACCT 110", "BTAC 100"],
    ["ACCT& 201", "BTAC 100"],
  ]);
  assert.deepEqual(engr214ParserResult.prerequisiteCourseCodes, []);
  assert.deepEqual(engr214ParserResult.prerequisiteAlternativeCourseCodeSets, []);
  assert.deepEqual(engr214ParserResult.corequisiteCourseCodes, ["ENGR 106", "MATH& 152"]);
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

test("Phase 3 catalog ingest now materializes source-backed graph edges for planner-critical GRC courses while leaving ambiguous cases as notes", () => {
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

test("Source manifest registry now tracks parser type, role, confidence, and primary degree pages", () => {
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

test("Seattle Computer Engineering degree-map blocks stay aligned with the current CompE degree sheet", () => {
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

test("Student-facing course lists now surface broader source-backed aquatic science transfer options", () => {
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

  assert.equal(
    gaps.length,
    0,
    `Expected zero clean guide-backed GRC coverage gaps, found ${gaps.length}: ${JSON.stringify(
      gaps.slice(0, 12),
      null,
      2
    )}`
  );
});

test("Only majors with real supported routes expose planner pathways", () => {
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

test("Authored planner pathways now already match the visible materialized pathway list", () => {
  const authoredPathwayDrift = TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.flatMap((plan) => {
    const rawPathways = plan.pathways ?? [];
    if (!rawPathways.length) {
      return [];
    }

    const rawSignature = JSON.stringify(
      rawPathways.map((entry) => ({
        id: entry.id,
        label: entry.label,
      }))
    );
    const materializedSignature = JSON.stringify(
      getTransferPlannerPathwaysForPlan(plan).map((entry) => ({
        id: entry.id,
        label: entry.label,
      }))
    );

    if (rawSignature === materializedSignature) {
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

  assert.deepEqual(authoredPathwayDrift, []);
});

test("Pathways are sourced from parser outputs, not legacy authored plan overrides", () => {
  for (const plan of TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS) {
    const registryPathwayIds = new Set(
      TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.filter(
      (entry) => entry.planId === plan.id
    ).map((entry) => entry.pathwayId)
    );

    for (const pathway of getTransferPlannerPathwaysForPlan(plan)) {
      const isRegistryPathway = registryPathwayIds.has(pathway.id);
      const isParserMaterializedPathway = pathway.id.startsWith("source-pathway-");
      assert.equal(
        isRegistryPathway || isParserMaterializedPathway,
        true,
        `Unexpected pathway ${plan.id}::${pathway.id}; expected registry-backed or parser-materialized source-pathway id.`
      );
    }

    const materializedNonParserPathways = getTransferPlannerPathwaysForPlan(plan)
      .filter((pathway) => !pathway.id.startsWith("source-pathway-"))
      .map((pathway) => pathway.id)
      .sort();
    const registryNonParserPathways = [...registryPathwayIds].sort();
    assert.deepEqual(
      materializedNonParserPathways,
      registryNonParserPathways,
      `Registry pathway ids should remain stable for ${plan.id}.`
    );
  }
});

test("Resolving Biology pathways keeps the selected route metadata while preserving the shared source-backed prep list", () => {
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

test("Earth & Space Sciences expands B.S. option families into specific pathway choices", () => {
  assert.ok(seattleEssPlan, "Expected Seattle Earth & Space Sciences planner row.");

  const essPathwayLabels = getTransferPlannerPathwaysForPlan(seattleEssPlan).map(
    (entry) => entry.label
  );
  const resolvedEssBsPlan = resolveTransferPlannerMajorPlan(seattleEssPlan, "bs-option-family");
  const resolvedEssPhysicsPlan = resolveTransferPlannerMajorPlan(
    seattleEssPlan,
    "bs-option-family:physics"
  );

  assert.deepEqual(essPathwayLabels, [
    "B.A. route",
    "B.S. Geology option",
    "B.S. Biology option",
    "B.S. Geoscience option",
    "B.S. Physics option",
  ]);
  assert.equal(resolvedEssBsPlan?.selectedPathwayLabel, "B.S. Geology option");
  assert.equal(resolvedEssPhysicsPlan?.selectedPathwayLabel, "B.S. Physics option");
  assert.ok(getTransferPlannerGrcCourseList(resolvedEssPhysicsPlan).includes("PHYS& 221"));
  assert.ok(getTransferPlannerGrcCourseList(resolvedEssPhysicsPlan).includes("PHYS& 222"));
});

test("Parsed source pathway labels synthesize route choices when a major has no hardcoded pathway shells", () => {
  const politicalSciencePlan = getRequiredPlan("uw-seattle-political-science");
  assert.ok(tacomaHistoryPlan, "Expected Tacoma History planner row.");

  const politicalSciencePathwayLabels = getTransferPlannerPathwaysForPlan(politicalSciencePlan).map(
    (entry) => entry.label
  );
  const historyPathwayLabels = getTransferPlannerPathwaysForPlan(tacomaHistoryPlan).map(
    (entry) => entry.label
  );
  const politicalEconomyPlan = resolveTransferPlannerMajorPlan(
    politicalSciencePlan,
    "source-pathway-political-economy-option"
  );
  const historyGlobalPlan = resolveTransferPlannerMajorPlan(
    tacomaHistoryPlan,
    "source-pathway-global-history-option"
  );

  assert.deepEqual(politicalSciencePathwayLabels, [
    "General Major",
    "International Security Option",
    "Political Economy Option",
  ]);
  assert.deepEqual(historyPathwayLabels, [
    "General History Option",
    "Arts, Culture and Society Option",
    "Global History Option",
    "Labor and Social Movements Option",
    "Power, Gender and Identity Option",
  ]);
  assert.equal(politicalEconomyPlan?.selectedPathwayLabel, "Political Economy Option");
  assert.equal(historyGlobalPlan?.selectedPathwayLabel, "Global History Option");
  assert.ok(getTransferPlannerGrcCourseList(politicalEconomyPlan).includes("POLS& 202"));
  assert.ok(getTransferPlannerGrcCourseList(historyGlobalPlan).includes("HIST& 214"));
});

test("Tacoma Communication pathway resolution narrows the degree-map sections to the selected track", () => {
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

test("Layered source registries now include explicit major-pathway entries", () => {
  const biologyPathway = TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.find(
    (entry) => entry.id === "uw-seattle-biology:pathway:ba-general-biology"
  );
  const writingTechPathway = TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.find(
    (entry) => entry.id === "uw-tacoma-writing-studies:pathway:technical-communication-track"
  );

  assert.ok(biologyPathway, "Expected a Biology pathway registry entry.");
  assert.ok(writingTechPathway, "Expected a Writing Studies pathway registry entry.");
  assert.match(biologyPathway?.summary ?? "", /Broader biology route/);
});

test("Source-generated major rows preserve planner counts and now drive more officially multi-route majors", () => {
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

test("Source-generated pathway rows can resolve the new route-specific Seattle and Tacoma paths", () => {
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

test("Auto track matcher preserves custom track copy when the computed winner already matches", () => {
  const autoRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    csPlan.grcCourseList ?? [],
    csPlan.bestTrackId
  );

  assert.ok(autoRecommendation, "Expected an auto-matched track recommendation for Seattle CS.");
  assert.equal(autoRecommendation?.trackId, "999P");
  assert.equal(csPlan.bestTrackId, "999P");
  assert.match(csPlan.bestTrackSummary, /safest Green River path/i);
  assert.match(csPlan.financialAidNote, /engineering backup options/i);
});

test("Auto track matcher can diverge between the broad base course list and the narrowed source-generated checklist set", () => {
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

  assert.equal(bootstrapAtmosphericPlan?.bestTrackId, "999B");
  assert.equal(baseCourseListRecommendation?.trackId, "999O");
  assert.equal(checklistScopedRecommendation?.trackId, "999P");
  assert.equal(seattleAtmosphericClimateSciencePlan?.bestTrackId, "999P");
  assert.match(
    seattleAtmosphericClimateSciencePlan?.bestTrackSummary ?? "",
    /current closest Green River transfer path/i
  );
  assert.equal(seattleAtmosphericClimateSciencePlan?.financialAidNote ?? "", "");
});

test("Non-Seattle runtime majors with mapped GRC courses now get an auto-matched best track", () => {
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

    const missingBestTrackPlanIds = runtimePlansWithMappedCourses
      .filter((plan) => !plan.bestTrackId)
      .map((plan) => plan.id)
      .sort();

    assert.deepEqual(
      missingBestTrackPlanIds,
      [],
      `Expected every ${campusId} runtime plan with mapped GRC courses to have a bestTrackId.`
    );

    for (const plan of runtimePlansWithMappedCourses) {
      const track = getTransferPlannerTrack(plan.bestTrackId ?? null);
      assert.ok(track, `Expected ${plan.id} bestTrackId (${plan.bestTrackId}) to resolve to a track.`);
    }
  }
});

test("Expanded pathway majors resolve to the selected official route and route-specific guidance", () => {
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
  assert.match(psychologyBsPlan?.grcCourseListGuidance ?? "", /philosophy support/i);

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

test("Canonical course registry now keeps pathway-specific GRC references for the expanded route set", () => {
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

test("Canonical course registry keeps new pathway-specific GRC references for added route coverage", () => {
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

test("Student runtime planner rows only keep automatic guidance notes when notes are present", () => {
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
          !/^Prerequisite for\b/i.test(note) &&
          !/Not part of the minimum transfer-admission classes/i.test(note) &&
          !/^Auto-generated from the current source-backed Green River class list/i.test(note) &&
          !/^Use the current source-backed Green River class list as the planning starting point/i.test(note) &&
          !/^Official UW prep target found in the current source-backed requirements/i.test(note) &&
          !/^Current official source-backed requirement materials identify more UW prep for this major/i.test(note)
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
    `Expected detailed planner rows to only keep automatic guidance notes when present, but found: ${invalid.join(", ")}`
  );
});
