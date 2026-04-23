import {
  extractTransferPlannerCourseCodes,
  getTransferPlannerCanonicalCourse,
  getTransferPlannerGrcCourseAvailabilitySummary,
  getTransferPlannerGrcCourseList,
  getTransferPlannerGrcCourseLatestPublishedQuarters,
  getTransferPlannerEquivalencyRulesForSourceCourse,
  getTransferPlannerMajorPlan,
  getTransferPlannerParsedRequirementSourceBlocks,
  resolveTransferPlannerMajorPlan,
  TRANSFER_PLANNER_SOURCE_GAP_REGISTRY,
  TransferPlannerChecklistItem,
  TransferPlannerGeneralRequirementSection,
  TransferPlannerGeneralRequirementSourceKind,
  TransferPlannerEquivalencyRule,
  TransferPlannerMajorPlan,
  TransferPlannerStudentCourseEvaluation,
  TransferPlannerTrack,
} from "@/constants/transfer-planner-source";
import {
  TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA,
  type TransferPlannerNormalizedCourseMetadataEntry,
} from "@/constants/transfer-planner-source/course-metadata";
const COURSE_CODE_PATTERN = /\b[A-Z]{2,6}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;
const GUIDE_BACKED_EQUIVALENCY_RULE_SOURCE_KINDS = new Set([
  "uw-green-river-equivalency-guide",
  "uw-green-river-equivalency-guide-derived",
]);
const CHECKLIST_CHOICE_PREVIEW_LIMIT = 8;
const SOURCE_BACKED_REQUIRED_COURSE_NON_REQUIREMENT_CUE_PATTERN =
  /\b(approved list|not required for transferring|elective|replacement|course list|course lists|course evaluation|course evaluations|recommended|suggested|consider|suggested general education|suggested course pathways?|choose\s+(?:one|[0-9]+)|one\s+of|select(?:ed|ing)?|\d+\s+credits?\s+from|minimum\s+\d+\s+credits?[^.]{0,80}\bfrom)\b/i;
const SOURCE_BACKED_REQUIRED_COURSE_SEMANTIC_RELATION_PATTERN =
  /\bCourse (?:equivalent to|overlaps with):\s*([^.]*)/gi;

export type TranscriptCourseEntry = {
  code: string;
  label: string;
  termLabel?: string | null;
  termStartDate?: string | null;
  termEndDate?: string | null;
  catalogYearLabel?: string | null;
};

export type TransferRequirementStatus = {
  item: TransferPlannerChecklistItem;
  matched: boolean;
  matchedCourses: TranscriptCourseEntry[];
  explicitCourseCodes: string[];
  requiredCompletedCount: number;
};

export type TrackUsageSummary = {
  specificCourseCount: number;
  directUseCount: number;
  directUseEntries: string[];
  extraSpecificEntries: string[];
  generalEdEntryCount: number;
  generalEdEntries: string[];
};

export type HistoricalGrcTrackComparison = {
  trackId: string;
  trackCode: string;
  currentCatalogYearLabel: string;
  inferredCatalogYearLabel: string | null;
  selectedCatalogYearLabel: string | null;
  selectedCatalogYearSource: "transcript" | "current-default" | "unavailable";
  usesCurrentRecommendedPath: boolean;
  isHistoricalCatalogYear: boolean;
  terms: TransferPlannerTrack["terms"];
  trackCourseCodes: string[];
  currentRecommendedCourseCodes: string[];
  catalogYearCourseCodes: string[];
  legacyCatalogCourseCodes: string[];
  currentOnlyCourseCodes: string[];
  currentUwRequiredGrcCourseCodes: string[];
  legacyCourseCodesStillUsedByCurrentUwPlan: string[];
  sourceBackedLegacyCourseCodes: string[];
  unsupportedLegacyCourseCodes: string[];
  notes: string[];
};

export type SuggestedQuarterCourse = {
  label: string;
  type: "core" | "elective";
  status: "completed" | "current" | "planned";
  guidanceSummary?: string | null;
  availabilitySummary?: string | null;
};

export type SuggestedQuarterPlan = {
  label: string;
  phase: "completed" | "current" | "planned";
  courses: SuggestedQuarterCourse[];
};

export type TransferPlannerStudentEvaluationReportBucket = {
  id: TransferPlannerStudentCourseEvaluation["outcome"];
  label: string;
  description: string;
  courseCodes: string[];
  count: number;
};

export type TransferPlannerStudentEvaluationReport = {
  planId: string | null;
  pathwayId: string | null;
  majorTitle: string;
  campusLabel: string;
  completedCourseCount: number;
  studentFacingEvaluationCount: number;
  hiddenEvaluationCount: number;
  buckets: TransferPlannerStudentEvaluationReportBucket[];
  officialRuleIds: string[];
  sourceLinkCount: number;
  warningCourseCodes: string[];
  missingSequenceCourseCodes: string[];
  nextPlannedCourseLabels: string[];
  reportSummaryLines: string[];
};

type RequirementPriorityBucket = "application" | "beforeEnrollment" | "stayAtGrc";

type PendingSuggestedCourse = SuggestedQuarterCourse & {
  sequenceGroup: string | null;
  priorityRank: number;
  sourceOrder: number;
  explicitCourseCodes: string[];
  prerequisiteCourseSets: string[][];
  corequisiteCourseSets: string[][];
};

export type TransferPlannerCoursePlanningGraph = {
  prerequisiteCourseSetsByCourseCode: Record<string, string[][]>;
  corequisiteCourseSetsByCourseCode: Record<string, string[][]>;
  sourceCounts: {
    metadataPrerequisiteCourseCount: number;
    metadataCorequisiteCourseCount: number;
    chainPrerequisiteCourseCount: number;
  };
};

const REQUIREMENT_PRIORITY_RANK: Record<RequirementPriorityBucket, number> = {
  application: 0,
  beforeEnrollment: 1,
  stayAtGrc: 2,
};

const REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE =
  "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way.";
const TRACK_SUPPLEMENTAL_TERM_LABEL_PATTERN =
  /\b(transferability of credits|generally transferable courses|section [a-z])\b/i;

function joinPlannerLabelList(labels: string[]) {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function joinGuidanceSummaries(...parts: (string | null | undefined)[]) {
  const cleaned = parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);

  return cleaned.length ? cleaned.join(" ") : null;
}

function buildChecklistGuidanceSummary(
  _bucket: RequirementPriorityBucket,
  item: TransferPlannerChecklistItem
) {
  const explicitNote = String(item.note ?? "").trim();
  if (explicitNote === REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE) {
    return explicitNote;
  }

  return null;
}

function buildPrerequisiteGuidanceSummary(dependentCourseLabels: string[]) {
  const uniqueLabels = unique(
    dependentCourseLabels
      .map((label) => String(label ?? "").trim())
      .filter(Boolean)
  );
  if (!uniqueLabels.length) return null;

  return `Prerequisite for ${joinPlannerLabelList(uniqueLabels)}.`;
}

function buildDependencyGuidanceSummary(input: {
  prerequisiteLabels: string[];
  corequisiteLabels: string[];
}) {
  return buildPrerequisiteGuidanceSummary(
    unique([...input.prerequisiteLabels, ...input.corequisiteLabels])
  );
}

function normalizeGeneralEducationRequirementTag(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function inferGeneralEducationRequirementTagsFromRuleText(
  rule: TransferPlannerEquivalencyRule
) {
  const text = [
    rule.title,
    rule.targetOutcome,
    ...(rule.targetCourseCodes ?? []),
    ...(rule.notes ?? []),
    ...(rule.plannerWarnings ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const inferredTags: string[] = [];
  if (/\bnatural\s+science\b|\bnsc\b/.test(text)) {
    inferredTags.push("NSC");
  }
  if (/\bhumanit/.test(text) || /\ba\s*&\s*h\b|\bah\b/.test(text)) {
    inferredTags.push("AH");
  }
  if (/\bsocial\s+science\b|\bssc\b|\bi\s*&\s*s\b/.test(text)) {
    inferredTags.push("SSC");
  }

  return inferredTags;
}

function getEvaluationTargetRequirementTags(rule: TransferPlannerEquivalencyRule | null | undefined) {
  if (!rule) {
    return [] as string[];
  }

  return unique(
    [
      ...(rule.targetRequirementTags ?? []),
      ...inferGeneralEducationRequirementTagsFromRuleText(rule),
    ]
      .map((tag) => normalizeGeneralEducationRequirementTag(tag))
      .filter(Boolean)
  );
}

function isSpecificTransferTargetCourseCode(courseCode: string) {
  return !/\b\dXX(?:\.\d+)?[A-Z]?\b/i.test(String(courseCode ?? "").trim());
}

function getTransferGuidanceRuleStatusScore(rule: TransferPlannerEquivalencyRule) {
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

function getTransferGuidanceRuleAcceptanceScore(rule: TransferPlannerEquivalencyRule) {
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

function getTransferGuidanceRuleTypeScore(rule: TransferPlannerEquivalencyRule) {
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

function compareTransferGuidanceRules(
  left: TransferPlannerEquivalencyRule,
  right: TransferPlannerEquivalencyRule
) {
  const statusDelta =
    getTransferGuidanceRuleStatusScore(right) - getTransferGuidanceRuleStatusScore(left);
  if (statusDelta !== 0) return statusDelta;

  const acceptanceDelta =
    getTransferGuidanceRuleAcceptanceScore(right) -
    getTransferGuidanceRuleAcceptanceScore(left);
  if (acceptanceDelta !== 0) return acceptanceDelta;

  const typeDelta = getTransferGuidanceRuleTypeScore(right) - getTransferGuidanceRuleTypeScore(left);
  if (typeDelta !== 0) return typeDelta;

  const targetCodeCountDelta =
    (left.targetCourseCodes?.length ?? Number.MAX_SAFE_INTEGER) -
    (right.targetCourseCodes?.length ?? Number.MAX_SAFE_INTEGER);
  if (targetCodeCountDelta !== 0) return targetCodeCountDelta;

  return left.id.localeCompare(right.id);
}

function ruleMatchesExactSourceCourseSet(
  rule: TransferPlannerEquivalencyRule,
  explicitCourseCodes: string[]
) {
  const normalizedExplicitCourseCodes = sortCourseCodes(
    explicitCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
  if (!normalizedExplicitCourseCodes.length) return false;

  return (rule.sourceCourseSets ?? []).some((courseSet) => {
    const normalizedRuleCourseSet = sortCourseCodes(
      (courseSet ?? []).map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
    );

    return (
      normalizedRuleCourseSet.length === normalizedExplicitCourseCodes.length &&
      normalizedRuleCourseSet.every(
        (courseCode, index) => courseCode === normalizedExplicitCourseCodes[index]
      )
    );
  });
}

function getSubsetMatchCompanionCourseCodes(
  rule: TransferPlannerEquivalencyRule,
  explicitCourseCodes: string[],
  satisfiedCourseCodes: string[] = []
) {
  const normalizedExplicitCourseCodes = sortCourseCodes(
    explicitCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
  if (!normalizedExplicitCourseCodes.length) return null;

  const normalizedExplicitCourseCodeSet = new Set(normalizedExplicitCourseCodes);
  const normalizedSatisfiedCourseCodeSet = new Set(
    satisfiedCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
  const companionOptions = (rule.sourceCourseSets ?? [])
    .map((courseSet) =>
      sortCourseCodes(
        (courseSet ?? []).map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
      )
    )
    .filter(
      (normalizedRuleCourseSet) =>
        normalizedRuleCourseSet.length > normalizedExplicitCourseCodes.length &&
        normalizedExplicitCourseCodes.every((courseCode) =>
          normalizedRuleCourseSet.includes(courseCode)
        )
    )
    .map((normalizedRuleCourseSet) => {
      const allCompanionCourseCodes = normalizedRuleCourseSet.filter(
        (courseCode) => !normalizedExplicitCourseCodeSet.has(courseCode)
      );
      const unsatisfiedCompanionCourseCodes = allCompanionCourseCodes.filter(
        (courseCode) => !normalizedSatisfiedCourseCodeSet.has(courseCode)
      );
      const displayCompanionCourseCodes = unsatisfiedCompanionCourseCodes.length
        ? unsatisfiedCompanionCourseCodes
        : allCompanionCourseCodes;
      return {
        normalizedRuleCourseSet,
        allCompanionCourseCodes,
        displayCompanionCourseCodes,
      };
    })
    .filter((option) => option.displayCompanionCourseCodes.length > 0)
    .sort((left, right) => {
      const displayLengthDelta =
        left.displayCompanionCourseCodes.length - right.displayCompanionCourseCodes.length;
      if (displayLengthDelta !== 0) return displayLengthDelta;

      const allLengthDelta =
        left.allCompanionCourseCodes.length - right.allCompanionCourseCodes.length;
      if (allLengthDelta !== 0) return allLengthDelta;

      const displayLabelDelta = left.displayCompanionCourseCodes
        .join("|")
        .localeCompare(right.displayCompanionCourseCodes.join("|"));
      if (displayLabelDelta !== 0) return displayLabelDelta;

      return left.normalizedRuleCourseSet.join("|").localeCompare(right.normalizedRuleCourseSet.join("|"));
    });

  return companionOptions[0]?.displayCompanionCourseCodes ?? null;
}

function getTransferGuidanceCandidateRulesForSourceCourse(
  sourceCourseCode: string,
  campusId: TransferPlannerMajorPlan["campusId"]
) {
  const allCandidateRules = getTransferPlannerEquivalencyRulesForSourceCourse(sourceCourseCode)
    .filter((rule) => GUIDE_BACKED_EQUIVALENCY_RULE_SOURCE_KINDS.has(rule.sourceKind ?? ""))
    .filter((rule) => rule.acceptanceCategory !== "no-credit")
    .filter((rule) => !rule.isObsoleteSourceCourse)
    .filter((rule) => (rule.targetCourseCodes ?? []).length > 0);

  const campusScopedRules = allCandidateRules.filter((rule) =>
    rule.targetSchoolIds.includes(campusId)
  );
  if (campusScopedRules.length || campusId === "uw-seattle") {
    return campusScopedRules;
  }

  return allCandidateRules.filter((rule) => rule.targetSchoolIds.includes("uw-seattle"));
}

function getCourseLevel(courseCode: string) {
  const match = normalizeCourseCode(courseCode).match(/(\d{3})[A-Z]?$/);
  return match ? Number(match[1]) : null;
}

function isLowerDivisionCourseCode(courseCode: string) {
  const level = getCourseLevel(courseCode);
  return level !== null && level < 300;
}

function getCourseSubject(courseCode: string) {
  return normalizeCourseCode(courseCode).match(/^([A-Z&]+(?: [A-Z&]+)*)\s+\d/)?.[1] ?? null;
}

function getSourceBackedRequiredCourseSemanticRelations(courseCode: string) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  if (!normalizedCourseCode) {
    return [] as string[];
  }

  const cached = SOURCE_BACKED_REQUIRED_COURSE_SEMANTIC_RELATION_CACHE.get(normalizedCourseCode);
  if (cached) {
    return cached;
  }

  const metadata = NORMALIZED_COURSE_METADATA_BY_CODE.get(normalizedCourseCode);
  const subject = getCourseSubject(normalizedCourseCode);
  const relatedCourseCodes = unique(
    Array.from(
      String(metadata?.catalogDescription ?? "").matchAll(
        SOURCE_BACKED_REQUIRED_COURSE_SEMANTIC_RELATION_PATTERN
      )
    )
      .flatMap((match) => extractCourseCodes(match[1] ?? ""))
      .map((relatedCourseCode) => normalizeCourseCode(relatedCourseCode))
      .filter(
        (relatedCourseCode) =>
          relatedCourseCode &&
          relatedCourseCode !== normalizedCourseCode &&
          isLowerDivisionCourseCode(relatedCourseCode) &&
          getCourseSubject(relatedCourseCode) === subject
      )
  );

  SOURCE_BACKED_REQUIRED_COURSE_SEMANTIC_RELATION_CACHE.set(
    normalizedCourseCode,
    relatedCourseCodes
  );
  return relatedCourseCodes;
}

function buildBestSingleCourseUwEquivalentCourseCodes(
  sourceCourseCode: string,
  campusId: TransferPlannerMajorPlan["campusId"] | null | undefined
) {
  const normalizedSourceCourseCode = normalizeCourseCode(sourceCourseCode);
  if (!campusId || !normalizedSourceCourseCode) {
    return [] as string[];
  }

  const candidateRules = getTransferGuidanceCandidateRulesForSourceCourse(
    normalizedSourceCourseCode,
    campusId
  )
    .filter((rule) =>
      (rule.sourceCourseSets ?? []).some((courseSet) => {
        const normalizedCourseSet = courseSet.map((courseCode) =>
          normalizeCourseCode(courseCode)
        );
        return (
          normalizedCourseSet.length === 1 &&
          normalizedCourseSet[0] === normalizedSourceCourseCode
        );
      })
    )
    .sort(compareTransferGuidanceRules);

  const selectedRule = candidateRules[0];
  if (!selectedRule) {
    return [] as string[];
  }

  return unique(
    (selectedRule.targetCourseCodes ?? [])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(isSpecificTransferTargetCourseCode)
  );
}

function shouldIncludeSourceBackedParsedRequiredCourseCandidate(candidate: {
  uwCourseCode?: string | null;
  sourceLineHints?: string[] | null;
}) {
  const normalizedCourseCode = normalizeCourseCode(candidate.uwCourseCode ?? "");
  if (!normalizedCourseCode) {
    return false;
  }

  const level = getCourseLevel(normalizedCourseCode);
  if (level !== null && level >= 300) {
    return false;
  }

  const sourceLineHints = (candidate.sourceLineHints ?? [])
    .map((line) => String(line ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!sourceLineHints.length) {
    return true;
  }

  return sourceLineHints.some(
    (line) => !SOURCE_BACKED_REQUIRED_COURSE_NON_REQUIREMENT_CUE_PATTERN.test(line)
  );
}

function getSourceBackedRequiredUwCourseCodeSet(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  const requiredUwCourseCodes = new Set<string>();
  if (!plan) {
    return requiredUwCourseCodes;
  }

  const selectedPathwayId =
    (plan as { selectedPathwayId?: string | null } | null | undefined)?.selectedPathwayId ?? null;

  for (const block of getTransferPlannerParsedRequirementSourceBlocks(plan.id, selectedPathwayId)) {
    for (const candidate of block.parsedRequirementAtomCandidates ?? []) {
      if (!shouldIncludeSourceBackedParsedRequiredCourseCandidate(candidate)) {
        continue;
      }

      const normalizedCourseCode = normalizeCourseCode(candidate.uwCourseCode ?? "");
      if (!normalizedCourseCode) {
        continue;
      }

      requiredUwCourseCodes.add(normalizedCourseCode);
    }
  }

  return requiredUwCourseCodes;
}

export function buildSourceBackedRequiredCourseCodes(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) {
    return [] as string[];
  }

  const orderedCourseCodes: string[] = [];
  const seenCourseCodes = new Set<string>();
  const coveredRequiredUwCourseCodes = new Set<string>();
  const requiredUwCourseCodes = getSourceBackedRequiredUwCourseCodeSet(plan);
  const isCoveredRequiredUwCourseCode = (targetCourseCode: string) => {
    const normalizedTargetCourseCode = normalizeCourseCode(targetCourseCode);
    if (!normalizedTargetCourseCode) {
      return false;
    }

    if (coveredRequiredUwCourseCodes.has(normalizedTargetCourseCode)) {
      return true;
    }

    return getSourceBackedRequiredCourseSemanticRelations(normalizedTargetCourseCode).some(
      (relatedCourseCode) =>
        requiredUwCourseCodes.has(relatedCourseCode) &&
        coveredRequiredUwCourseCodes.has(relatedCourseCode)
    );
  };
  const markCoveredRequiredUwCourseCodes = (targetCourseCodes: string[]) => {
    for (const targetCourseCode of targetCourseCodes) {
      const normalizedTargetCourseCode = normalizeCourseCode(targetCourseCode);
      if (!normalizedTargetCourseCode || !requiredUwCourseCodes.has(normalizedTargetCourseCode)) {
        continue;
      }

      coveredRequiredUwCourseCodes.add(normalizedTargetCourseCode);
    }
  };
  const addCourseCodes = (courseLabels: string[] | null | undefined) => {
    for (const label of courseLabels ?? []) {
      for (const courseCode of extractCourseCodes(label)) {
        const normalizedCourseCode = normalizeCourseCode(courseCode);
        if (!normalizedCourseCode || seenCourseCodes.has(normalizedCourseCode)) {
          continue;
        }

        seenCourseCodes.add(normalizedCourseCode);
        orderedCourseCodes.push(normalizedCourseCode);
        markCoveredRequiredUwCourseCodes(
          buildBestSingleCourseUwEquivalentCourseCodes(normalizedCourseCode, plan.campusId)
        );
      }
    }
  };

  for (const item of [...(plan.applicationChecklist ?? []), ...(plan.beforeEnrollmentChecklist ?? [])]) {
    addCourseCodes(item.grcCourses ?? []);
  }

  if (!requiredUwCourseCodes.size) {
    return orderedCourseCodes;
  }

  for (const courseLabel of getTransferPlannerGrcCourseList(plan)) {
    for (const courseCode of extractCourseCodes(courseLabel)) {
      const normalizedCourseCode = normalizeCourseCode(courseCode);
      if (!normalizedCourseCode || seenCourseCodes.has(normalizedCourseCode)) {
        continue;
      }

      const equivalentUwCourseCodes = buildBestSingleCourseUwEquivalentCourseCodes(
        normalizedCourseCode,
        plan.campusId
      );
      if (!equivalentUwCourseCodes.some((targetCourseCode) => requiredUwCourseCodes.has(targetCourseCode))) {
        continue;
      }
      if (
        equivalentUwCourseCodes.length &&
        equivalentUwCourseCodes.every((targetCourseCode) => isCoveredRequiredUwCourseCode(targetCourseCode))
      ) {
        continue;
      }

      seenCourseCodes.add(normalizedCourseCode);
      orderedCourseCodes.push(normalizedCourseCode);
      markCoveredRequiredUwCourseCodes(equivalentUwCourseCodes);
    }
  }

  return orderedCourseCodes;
}

function buildSourceBackedRequiredCourseFallbackStatuses(scope: {
  plan: TransferPlannerMajorPlan | null | undefined;
  existingStatuses: TransferRequirementStatus[];
  completedCourses: TranscriptCourseEntry[];
}) {
  const existingCourseCodes = new Set(
    scope.existingStatuses
      .flatMap((status) => status.explicitCourseCodes)
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
  const fallbackItems = buildSourceBackedRequiredCourseCodes(scope.plan)
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter((courseCode) => courseCode && !existingCourseCodes.has(courseCode))
    .map<TransferPlannerChecklistItem>((courseCode) => ({
      id: `source-backed-required-${courseCode
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")}`,
      title: courseCode,
      grcCourses: [courseCode],
    }));

  if (!fallbackItems.length) {
    return [] as TransferRequirementStatus[];
  }

  return buildRequirementStatuses(fallbackItems, scope.completedCourses);
}

function buildTransferEquivalencyGuidanceSummary(
  explicitCourseCodes: string[],
  campusId: TransferPlannerMajorPlan["campusId"] | null | undefined,
  options: {
    satisfiedCourseCodes?: string[];
  } = {}
) {
  const normalizedExplicitCourseCodes = sortCourseCodes(
    explicitCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
  if (!campusId || !normalizedExplicitCourseCodes.length) return null;

  const exactMatchRulesById = new Map<string, TransferPlannerEquivalencyRule>();
  for (const courseCode of normalizedExplicitCourseCodes) {
    for (const rule of getTransferGuidanceCandidateRulesForSourceCourse(courseCode, campusId)) {
      if (!ruleMatchesExactSourceCourseSet(rule, normalizedExplicitCourseCodes)) continue;
      exactMatchRulesById.set(rule.id, rule);
    }
  }

  const selectedRule = [...exactMatchRulesById.values()].sort(compareTransferGuidanceRules)[0];
  if (selectedRule) {
    const specificTargetCourseCodes = unique(
      (selectedRule.targetCourseCodes ?? [])
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(isSpecificTransferTargetCourseCode)
    );
    if (!specificTargetCourseCodes.length) return null;

    return `Transfers into ${joinPlannerLabelList(specificTargetCourseCodes)}.`;
  }

  const subsetMatchByRuleId = new Map<
    string,
    {
      rule: TransferPlannerEquivalencyRule;
      specificTargetCourseCodes: string[];
      companionCourseCodes: string[];
    }
  >();

  for (const courseCode of normalizedExplicitCourseCodes) {
    for (const rule of getTransferGuidanceCandidateRulesForSourceCourse(courseCode, campusId)) {

      const companionCourseCodes = getSubsetMatchCompanionCourseCodes(
        rule,
        normalizedExplicitCourseCodes,
        options.satisfiedCourseCodes ?? []
      );
      if (!companionCourseCodes?.length) continue;

      const specificTargetCourseCodes = unique(
        (rule.targetCourseCodes ?? [])
          .map((targetCourseCode) => normalizeCourseCode(targetCourseCode))
          .filter(isSpecificTransferTargetCourseCode)
      );
      if (!specificTargetCourseCodes.length) continue;

      const existing = subsetMatchByRuleId.get(rule.id);
      if (!existing) {
        subsetMatchByRuleId.set(rule.id, {
          rule,
          specificTargetCourseCodes,
          companionCourseCodes,
        });
        continue;
      }

      if (
        companionCourseCodes.length < existing.companionCourseCodes.length ||
        (companionCourseCodes.length === existing.companionCourseCodes.length &&
          companionCourseCodes.join("|").localeCompare(existing.companionCourseCodes.join("|")) <
            0)
      ) {
        subsetMatchByRuleId.set(rule.id, {
          rule,
          specificTargetCourseCodes,
          companionCourseCodes,
        });
      }
    }
  }

  const selectedSubsetMatch = [...subsetMatchByRuleId.values()].sort((left, right) => {
    const companionDelta = left.companionCourseCodes.length - right.companionCourseCodes.length;
    if (companionDelta !== 0) return companionDelta;

    const ruleDelta = compareTransferGuidanceRules(left.rule, right.rule);
    if (ruleDelta !== 0) return ruleDelta;

    return left.companionCourseCodes
      .join("|")
      .localeCompare(right.companionCourseCodes.join("|"));
  })[0];

  if (!selectedSubsetMatch) return null;

  return `Transfers into ${joinPlannerLabelList(
    selectedSubsetMatch.specificTargetCourseCodes
  )} when taken with ${joinPlannerLabelList(selectedSubsetMatch.companionCourseCodes)}.`;
}

function getChecklistChoiceLabels(item: TransferPlannerChecklistItem) {
  return unique(
    [item.grcCourses, ...(item.alternatives ?? [])]
      .flat()
      .map((label) => String(label ?? "").trim())
      .filter(Boolean)
  );
}

function buildChecklistChoiceLabel(
  item: TransferPlannerChecklistItem,
  remainingNeeded: number,
  matchedCount: number
) {
  const chooseLabel = `choose ${remainingNeeded}${matchedCount > 0 ? " more" : ""} from this list`;
  return `${item.title} - ${chooseLabel}`;
}

function buildChecklistChoiceGuidanceSummary(
  item: TransferPlannerChecklistItem,
  remainingNeeded: number,
  matchedCount: number,
  baseGuidanceSummary: string | null
) {
  const choiceLabels = getChecklistChoiceLabels(item);
  const previewLabels = choiceLabels.slice(0, CHECKLIST_CHOICE_PREVIEW_LIMIT);
  const hiddenCount = Math.max(choiceLabels.length - previewLabels.length, 0);
  const chooseLabel = `Choose ${remainingNeeded}${matchedCount > 0 ? " more" : ""} from this list`;
  const choicesSummary = previewLabels.length
    ? `${chooseLabel}: ${previewLabels.join(", ")}${hiddenCount > 0 ? `, plus ${hiddenCount} more` : ""}.`
    : `${chooseLabel}.`;

  return baseGuidanceSummary ? `${choicesSummary} ${baseGuidanceSummary}` : choicesSummary;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function sortCourseCodes(codes: string[]) {
  return unique(codes).sort((left, right) => left.localeCompare(right));
}

const LEGACY_COURSE_CODE_ALIASES = new Map<string, string>([["MATH& 254", "MATH& 264"]]);

export function normalizeCourseCode(value: string) {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  return LEGACY_COURSE_CODE_ALIASES.get(normalized) ?? normalized;
}

const NORMALIZED_COURSE_METADATA_BY_CODE = new Map<
  string,
  TransferPlannerNormalizedCourseMetadataEntry
>(
  TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA.map(
    (entry): [string, TransferPlannerNormalizedCourseMetadataEntry] => [
      normalizeCourseCode(entry.code),
      entry,
    ]
  ).filter((entry) => entry[0])
);
const SOURCE_BACKED_REQUIRED_COURSE_SEMANTIC_RELATION_CACHE = new Map<string, string[]>();

export function extractCourseCodes(value: string) {
  return unique(
    [
      ...(String(value ?? "").toUpperCase().match(COURSE_CODE_PATTERN) ?? []),
      ...extractTransferPlannerCourseCodes(String(value ?? "")),
    ].map((match) => normalizeCourseCode(match))
  );
}

export function parseCompletedTranscriptCourses(rawValue: unknown): TranscriptCourseEntry[] {
  const seen = new Set<string>();
  const parsed: TranscriptCourseEntry[] = [];
  const pushEntry = (entry: TranscriptCourseEntry) => {
    if (seen.has(entry.code)) return;
    seen.add(entry.code);
    parsed.push(entry);
  };

  if (Array.isArray(rawValue)) {
    for (const rawEntry of rawValue) {
      if (rawEntry && typeof rawEntry === "object" && !Array.isArray(rawEntry)) {
        const record = rawEntry as Record<string, unknown>;
        const cleaned = String(
          record.label ?? [record.code, record.title].filter(Boolean).join(" ")
        )
          .replace(/\s+/g, " ")
          .trim();
        if (!cleaned) continue;

        const termLabel = String(record.termLabel ?? "").replace(/\s+/g, " ").trim() || null;
        const termStartDate =
          String(record.termStartDate ?? "").replace(/\s+/g, " ").trim() || null;
        const termEndDate =
          String(record.termEndDate ?? "").replace(/\s+/g, " ").trim() || null;

        for (const code of extractCourseCodes(String(record.code ?? cleaned))) {
          pushEntry({
            code,
            label: cleaned,
            termLabel,
            termStartDate,
            termEndDate,
            catalogYearLabel:
              String(record.catalogYearLabel ?? "").replace(/\s+/g, " ").trim() || null,
          });
        }
        continue;
      }

      const cleaned = String(rawEntry ?? "").replace(/\s+/g, " ").trim();
      if (!cleaned) continue;

      for (const code of extractCourseCodes(cleaned)) {
        pushEntry({ code, label: cleaned });
      }
    }

    return parsed;
  }

  const lines = String(rawValue ?? "")
    .split(/\r?\n/)
    .map((entry) => entry.trim());

  for (const line of lines) {
    const cleaned = String(line ?? "").replace(/\s+/g, " ").trim();
    if (!cleaned) continue;

    for (const code of extractCourseCodes(cleaned)) {
      pushEntry({ code, label: cleaned });
    }
  }

  return parsed;
}

function parseCatalogYearStart(label: string | null | undefined) {
  const match = String(label ?? "").match(/^(\d{4})-(\d{4})$/);
  if (!match) return null;
  return Number.parseInt(match[1] ?? "", 10);
}

function formatGrcCatalogYearLabel(startYear: number) {
  return `${startYear}-${startYear + 1}`;
}

function inferGrcCatalogYearLabelFromTermLabel(termLabel: string | null | undefined) {
  const normalized = String(termLabel ?? "").replace(/\s+/g, " ").trim();
  const match = normalized.match(/\b(Fall|Autumn|Winter|Spring|Summer)\s+(\d{4})\b/i);
  if (!match) return null;

  const term = String(match[1] ?? "").toLowerCase();
  const year = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(year)) return null;

  if (term === "fall" || term === "autumn") {
    return formatGrcCatalogYearLabel(year);
  }

  return formatGrcCatalogYearLabel(year - 1);
}

function inferGrcCatalogYearLabelFromDate(value: string | null | undefined) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

  return formatGrcCatalogYearLabel(month >= 8 ? year : year - 1);
}

export function inferTransferPlannerGrcCatalogYearLabel(
  completedCourses: TranscriptCourseEntry[]
) {
  const explicitCatalogYearLabels = completedCourses
    .map((course) => course.catalogYearLabel ?? null)
    .filter((label): label is string => Boolean(label) && parseCatalogYearStart(label) !== null)
    .sort((left, right) => (parseCatalogYearStart(left) ?? 0) - (parseCatalogYearStart(right) ?? 0));
  if (explicitCatalogYearLabels.length) {
    return explicitCatalogYearLabels[0] ?? null;
  }

  const candidateLabels = completedCourses
    .flatMap((course) => [
      inferGrcCatalogYearLabelFromDate(course.termStartDate),
      inferGrcCatalogYearLabelFromTermLabel(course.termLabel),
    ])
    .filter((label): label is string => Boolean(label));
  const sortedLabels = candidateLabels
    .filter((label) => parseCatalogYearStart(label) !== null)
    .sort((left, right) => (parseCatalogYearStart(left) ?? 0) - (parseCatalogYearStart(right) ?? 0));

  return sortedLabels[0] ?? null;
}

export function getCurrentTransferPlannerGrcCatalogYearLabel(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;
  return formatGrcCatalogYearLabel(month >= 8 ? year : year - 1);
}

function getChecklistRequirementCourseCodes(plan: TransferPlannerMajorPlan | null | undefined) {
  if (!plan) return [];

  return sortCourseCodes(
    [
      ...plan.applicationChecklist,
      ...plan.beforeEnrollmentChecklist,
      ...plan.stayAtGrcChecklist,
    ].flatMap((item) =>
      getChecklistCourseOptions(item).flatMap((courseLabels) =>
        courseLabels.flatMap((label) => extractCourseCodes(label))
      )
    )
  );
}

function getTrackTermCourseCodes(terms: TransferPlannerTrack["terms"]) {
  return sortCourseCodes(terms.flatMap((term) => term.courses.flatMap((label) => extractCourseCodes(label))));
}

function getGuideTermForCatalogYear(catalogYearLabel: string | null | undefined) {
  const startYear = parseCatalogYearStart(catalogYearLabel);
  if (startYear === null) return null;
  return `SPR Qtr. ${startYear + 1}`;
}

function courseHasCatalogYearSupport(courseCode: string, catalogYearLabel: string | null) {
  if (!catalogYearLabel) return false;

  const course = getTransferPlannerCanonicalCourse("grc", courseCode);
  if (!course) return false;

  return course.effectiveYearRanges.some((range) => {
    if (range.startLabel === catalogYearLabel || range.endLabel === catalogYearLabel) return true;
    const startYear = parseCatalogYearStart(range.startLabel);
    const endYear = parseCatalogYearStart(range.endLabel);
    const catalogYear = parseCatalogYearStart(catalogYearLabel);
    if (startYear === null || catalogYear === null) return false;
    if (endYear === null) return catalogYear >= startYear;
    return catalogYear >= startYear && catalogYear <= endYear;
  });
}

function courseHasEffectiveEquivalencySupport(courseCode: string, catalogYearLabel: string | null) {
  const guideTerm = getGuideTermForCatalogYear(catalogYearLabel);
  if (!guideTerm) return false;
  return getTransferPlannerEquivalencyRulesForSourceCourse(courseCode, guideTerm).length > 0;
}

export function buildHistoricalGrcTrackComparison(input: {
  track: TransferPlannerTrack | null;
  plan?: TransferPlannerMajorPlan | null;
  completedCourses: TranscriptCourseEntry[];
  referenceDate?: Date;
}): HistoricalGrcTrackComparison | null {
  const { track } = input;
  if (!track) return null;

  const currentCatalogYearLabel = getCurrentTransferPlannerGrcCatalogYearLabel(input.referenceDate);
  const inferredCatalogYearLabel = inferTransferPlannerGrcCatalogYearLabel(input.completedCourses);
  const selectedCatalogYear =
    inferredCatalogYearLabel
      ? track.catalogYears?.find((entry) => entry.label === inferredCatalogYearLabel) ?? null
      : null;
  const latestCatalogYear =
    [...(track.catalogYears ?? [])].sort(
      (left, right) =>
        (parseCatalogYearStart(right.label) ?? 0) - (parseCatalogYearStart(left.label) ?? 0)
    )[0] ?? null;
  const currentRecommendedCourseCodes = getTrackTermCourseCodes(track.terms);
  const selectedTerms = selectedCatalogYear?.terms ?? track.terms;
  const catalogYearCourseCodes = selectedCatalogYear
    ? getTrackTermCourseCodes(selectedCatalogYear.terms)
    : [];
  const trackCourseCodes = getTrackTermCourseCodes(selectedTerms);
  const legacyCatalogCourseCodes = selectedCatalogYear
    ? sortCourseCodes(catalogYearCourseCodes.filter((code) => !currentRecommendedCourseCodes.includes(code)))
    : [];
  const currentOnlyCourseCodes = selectedCatalogYear
    ? sortCourseCodes(currentRecommendedCourseCodes.filter((code) => !catalogYearCourseCodes.includes(code)))
    : [];
  const currentUwRequiredGrcCourseCodes = getChecklistRequirementCourseCodes(input.plan);
  const legacyCourseCodesStillUsedByCurrentUwPlan = legacyCatalogCourseCodes.filter((code) =>
    currentUwRequiredGrcCourseCodes.includes(code)
  );
  const sourceBackedLegacyCourseCodes = legacyCatalogCourseCodes.filter(
    (code) =>
      courseHasCatalogYearSupport(code, selectedCatalogYear?.label ?? null) ||
      courseHasEffectiveEquivalencySupport(code, selectedCatalogYear?.label ?? null)
  );
  const unsupportedLegacyCourseCodes = legacyCatalogCourseCodes.filter(
    (code) => !sourceBackedLegacyCourseCodes.includes(code)
  );
  const usesCurrentRecommendedPath = !selectedCatalogYear;
  const isHistoricalCatalogYear = Boolean(
    selectedCatalogYear &&
      inferredCatalogYearLabel &&
      parseCatalogYearStart(inferredCatalogYearLabel) !== parseCatalogYearStart(currentCatalogYearLabel)
  );

  return {
    trackId: track.id,
    trackCode: track.code,
    currentCatalogYearLabel,
    inferredCatalogYearLabel,
    selectedCatalogYearLabel: selectedCatalogYear?.label ?? (usesCurrentRecommendedPath ? null : latestCatalogYear?.label ?? null),
    selectedCatalogYearSource: selectedCatalogYear
      ? "transcript"
      : inferredCatalogYearLabel
        ? "unavailable"
        : "current-default",
    usesCurrentRecommendedPath,
    isHistoricalCatalogYear,
    terms: selectedTerms,
    trackCourseCodes,
    currentRecommendedCourseCodes,
    catalogYearCourseCodes,
    legacyCatalogCourseCodes,
    currentOnlyCourseCodes,
    currentUwRequiredGrcCourseCodes,
    legacyCourseCodesStillUsedByCurrentUwPlan,
    sourceBackedLegacyCourseCodes,
    unsupportedLegacyCourseCodes,
    notes: [
      selectedCatalogYear
        ? `Using ${track.code} ${selectedCatalogYear.label} catalog-year terms inferred from transcript history.`
        : inferredCatalogYearLabel
          ? `Transcript history points to ${inferredCatalogYearLabel}, but ${track.code} has no source-backed catalog-year snapshot for that year, so the planner keeps the current recommended path.`
          : `No transcript catalog year was detected, so the planner keeps the current recommended ${track.code} path for new planning.`,
      ...(selectedCatalogYear?.notes ?? []),
    ],
  };
}

function getResolvedTrackTermsForPlanning(
  track: TransferPlannerTrack | null,
  completedCourses: TranscriptCourseEntry[],
  referenceDate?: Date
) {
  return buildHistoricalGrcTrackComparison({ track, completedCourses, referenceDate })?.terms ?? [];
}

export function getResolvedTrackTermsForRequirementDisplay(
  track: TransferPlannerTrack | null,
  completedCourses: TranscriptCourseEntry[],
  referenceDate?: Date
) {
  return getResolvedTrackTermsForPlanning(track, completedCourses, referenceDate);
}

const PREPARATORY_TRACK_TERM_LABEL_PATTERN = /\bquarter 0\b/i;
const PREPARATORY_TRACK_NOTE_PATTERN =
  /\bonly required if\b|\bdepending on placement\b|\bprogram prerequisite\b/i;

function getNormalizedCourseSubjectKey(courseCode: string) {
  const match = normalizeCourseCode(courseCode).match(/^([A-Z&]+(?: [A-Z&]+)*)\s+\d/);
  if (!match) return null;
  return match[1].replace(/[^A-Z]/g, "");
}

function getNormalizedCourseCatalogNumber(courseCode: string) {
  const match = normalizeCourseCode(courseCode).match(/\b(\d{3})(?:\.\d+)?[A-Z]?\b/);
  if (!match) return null;
  return Number.parseInt(match[1] ?? "", 10);
}

function buildPreparatoryTrackCourseCodeSet(track: TransferPlannerTrack | null | undefined) {
  if (!track) {
    return new Set<string>();
  }

  const preparatoryCourseCodes = new Set<string>();

  for (const term of track.terms) {
    if (!PREPARATORY_TRACK_TERM_LABEL_PATTERN.test(String(term.label ?? "").trim())) {
      continue;
    }

    for (const courseCode of term.courses.flatMap((label) => extractCourseCodes(label))) {
      preparatoryCourseCodes.add(courseCode);
    }
  }

  for (const note of track.notes ?? []) {
    if (!PREPARATORY_TRACK_NOTE_PATTERN.test(String(note ?? "").trim())) {
      continue;
    }

    for (const courseCode of extractCourseCodes(note)) {
      preparatoryCourseCodes.add(courseCode);
    }
  }

  return preparatoryCourseCodes;
}

export function getPreparatoryTrackCourseCodeSet(
  track: TransferPlannerTrack | null | undefined
) {
  return buildPreparatoryTrackCourseCodeSet(track);
}

function courseDependsOnTargetCourseCode(
  courseCode: string,
  targetCourseCode: string,
  visitedCourseCodes = new Set<string>()
) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const normalizedTargetCourseCode = normalizeCourseCode(targetCourseCode);
  if (!normalizedCourseCode || !normalizedTargetCourseCode) return false;
  if (visitedCourseCodes.has(normalizedCourseCode)) return false;

  visitedCourseCodes.add(normalizedCourseCode);
  const canonicalCourse = getTransferPlannerCanonicalCourse("grc", normalizedCourseCode);
  if (!canonicalCourse) return false;

  const prerequisiteCourseCodes = unique(
    [
      ...(canonicalCourse.prerequisiteCourseCodes ?? []),
      ...(canonicalCourse.prerequisiteAlternativeCourseCodeSets ?? []).flat(),
    ]
      .map((entry) => normalizeCourseCode(entry))
      .filter(Boolean)
  );

  for (const prerequisiteCourseCode of prerequisiteCourseCodes) {
    if (prerequisiteCourseCode === normalizedTargetCourseCode) {
      return true;
    }

    if (
      courseDependsOnTargetCourseCode(
        prerequisiteCourseCode,
        normalizedTargetCourseCode,
        visitedCourseCodes
      )
    ) {
      return true;
    }
  }

  return false;
}

function hasCompletedHigherPreparatorySubjectCourse(args: {
  courseCode: string;
  completedCourseCodes: Set<string>;
  preparatoryCourseCodes: Set<string>;
}) {
  const normalizedCourseCode = normalizeCourseCode(args.courseCode);
  if (!args.preparatoryCourseCodes.has(normalizedCourseCode)) {
    return false;
  }

  const targetSubjectKey = getNormalizedCourseSubjectKey(normalizedCourseCode);
  const targetCatalogNumber = getNormalizedCourseCatalogNumber(normalizedCourseCode);
  if (!targetSubjectKey || targetCatalogNumber === null) {
    return false;
  }

  for (const completedCourseCode of args.completedCourseCodes) {
    const completedSubjectKey = getNormalizedCourseSubjectKey(completedCourseCode);
    const completedCatalogNumber = getNormalizedCourseCatalogNumber(completedCourseCode);
    if (!completedSubjectKey || completedCatalogNumber === null) {
      continue;
    }

    if (
      completedSubjectKey === targetSubjectKey &&
      completedCatalogNumber > targetCatalogNumber
    ) {
      return true;
    }
  }

  return false;
}

function isTrackCourseLabelSupersededByCompletedProgress(args: {
  label: string;
  completedCourseCodes: Set<string>;
  preparatoryCourseCodes: Set<string>;
}) {
  const explicitCourseCodes = extractCourseCodes(args.label);
  if (explicitCourseCodes.length !== 1) {
    return false;
  }

  const [courseCode] = explicitCourseCodes;
  if (!courseCode) return false;

  for (const completedCourseCode of args.completedCourseCodes) {
    if (courseDependsOnTargetCourseCode(completedCourseCode, courseCode)) {
      return true;
    }
  }

  return hasCompletedHigherPreparatorySubjectCourse({
    courseCode,
    completedCourseCodes: args.completedCourseCodes,
    preparatoryCourseCodes: args.preparatoryCourseCodes,
  });
}

export function getResolvedTrackTermsForStudentProgress(
  track: TransferPlannerTrack | null,
  completedCourses: TranscriptCourseEntry[],
  referenceDate?: Date
) {
  const resolvedTerms = getResolvedTrackTermsForPlanning(track, completedCourses, referenceDate);
  const completedCourseCodes = new Set(
    completedCourses.map((course) => normalizeCourseCode(course.code)).filter(Boolean)
  );
  const preparatoryCourseCodes = buildPreparatoryTrackCourseCodeSet(track);

  return resolvedTerms
    .map((term) => ({
      ...term,
      courses: term.courses.filter(
        (label) =>
          !isTrackCourseLabelSupersededByCompletedProgress({
            label,
            completedCourseCodes,
            preparatoryCourseCodes,
          })
      ),
    }))
    .filter((term) => term.courses.length > 0);
}

type RequirementCourseOption = {
  courseLabels: string[];
  explicitCourseCodes: string[];
  matchedCourses: TranscriptCourseEntry[];
  requiredCompletedCount: number;
  matched: boolean;
  remainingCourseCodes: string[];
  index: number;
};

function getChecklistCourseOptions(item: TransferPlannerChecklistItem) {
  return [item.grcCourses, ...(item.alternatives ?? [])]
    .map((courseLabels) =>
      Array.from(
        new Set(
          courseLabels
            .map((label) => String(label ?? "").trim())
            .filter(Boolean)
        )
      )
    )
    .filter((courseLabels) => courseLabels.length > 0);
}

function buildRequirementCourseOption(
  item: TransferPlannerChecklistItem,
  courseLabels: string[],
  index: number,
  completedByCode: Map<string, TranscriptCourseEntry>
): RequirementCourseOption {
  const explicitCourseCodes = unique(
    courseLabels.flatMap((courseLabel) => extractCourseCodes(courseLabel))
  );
  const matchedCourses = explicitCourseCodes
    .map((code) => completedByCode.get(code) ?? null)
    .filter((course): course is TranscriptCourseEntry => !!course);
  const requiredCompletedCount = explicitCourseCodes.length
    ? Math.max(
        1,
        Math.min(item.minCompletedCount ?? explicitCourseCodes.length, explicitCourseCodes.length)
      )
    : 0;
  const matchedCodes = new Set(matchedCourses.map((course) => course.code));
  const remainingCourseCodes = explicitCourseCodes.filter((code) => !matchedCodes.has(code));

  return {
    courseLabels,
    explicitCourseCodes,
    matchedCourses,
    requiredCompletedCount,
    matched: requiredCompletedCount > 0 && matchedCourses.length >= requiredCompletedCount,
    remainingCourseCodes,
    index,
  };
}

function selectPreferredRequirementOption(options: RequirementCourseOption[]) {
  return [...options].sort((left, right) => {
    const matchedStatusDelta = Number(right.matched) - Number(left.matched);
    if (matchedStatusDelta !== 0) return matchedStatusDelta;

    const matchedDelta = right.matchedCourses.length - left.matchedCourses.length;
    if (matchedDelta !== 0) return matchedDelta;

    const remainingDelta = left.remainingCourseCodes.length - right.remainingCourseCodes.length;
    if (remainingDelta !== 0) return remainingDelta;

    const sizeDelta = left.explicitCourseCodes.length - right.explicitCourseCodes.length;
    if (sizeDelta !== 0) return sizeDelta;

    return left.index - right.index;
  })[0] ?? null;
}

export function buildRequirementStatuses(
  items: TransferPlannerChecklistItem[],
  completedCourses: TranscriptCourseEntry[]
) {
  const completedByCode = new Map<string, TranscriptCourseEntry>();
  for (const course of completedCourses) {
    completedByCode.set(course.code, course);
  }

  return items.map<TransferRequirementStatus>((item) => {
    const selectedOption =
      selectPreferredRequirementOption(
        getChecklistCourseOptions(item).map((courseLabels, index) =>
          buildRequirementCourseOption(item, courseLabels, index, completedByCode)
        )
      ) ??
      buildRequirementCourseOption(item, item.grcCourses, 0, completedByCode);

    return {
      item,
      matched: selectedOption.matched,
      matchedCourses: selectedOption.matchedCourses,
      explicitCourseCodes: selectedOption.explicitCourseCodes,
      requiredCompletedCount: selectedOption.requiredCompletedCount,
    };
  });
}

export function countCompletedRequirements(statuses: TransferRequirementStatus[]) {
  return statuses.filter((status) => status.matched).length;
}

export type BuildTransferPlannerStudentCourseEvaluationsInput = {
  plan?: TransferPlannerMajorPlan | null;
  planId?: string | null;
  pathwayId?: string | null;
  completedCourses: TranscriptCourseEntry[];
  requirementStatuses?: TransferRequirementStatus[];
  applicationStatuses?: TransferRequirementStatus[];
  beforeEnrollmentStatuses?: TransferRequirementStatus[];
  stayAtGrcStatuses?: TransferRequirementStatus[];
  effectiveTermLabel?: string | null;
};

type EvaluationRuleCandidate = {
  rule: TransferPlannerEquivalencyRule;
  sourceCourseSet: string[];
  missingSourceCourseCodes: string[];
};

function getEvaluationPathwayId(input: BuildTransferPlannerStudentCourseEvaluationsInput) {
  return (
    input.pathwayId ??
    (input.plan as { selectedPathwayId?: string | null } | null | undefined)?.selectedPathwayId ??
    null
  );
}

function getEvaluationRequirementStatuses(
  input: BuildTransferPlannerStudentCourseEvaluationsInput
) {
  if (input.requirementStatuses) {
    return input.requirementStatuses;
  }

  const explicitStatuses = [
    ...(input.applicationStatuses ?? []),
    ...(input.beforeEnrollmentStatuses ?? []),
    ...(input.stayAtGrcStatuses ?? []),
  ];
  if (explicitStatuses.length) {
    return explicitStatuses;
  }

  if (!input.plan) {
    return [];
  }

  return [
    ...buildRequirementStatuses(input.plan.applicationChecklist, input.completedCourses),
    ...buildRequirementStatuses(input.plan.beforeEnrollmentChecklist, input.completedCourses),
    ...buildRequirementStatuses(input.plan.stayAtGrcChecklist, input.completedCourses),
  ];
}

function findHiddenSourceGap(planId: string | null, pathwayId: string | null) {
  if (!planId) return null;

  return (
    TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.find(
      (entry) =>
        entry.planId === planId &&
        (pathwayId ? entry.pathwayId === pathwayId : entry.pathwayId === null)
    ) ?? null
  );
}

function getRequirementMissingCourseCodes(status: TransferRequirementStatus) {
  const matchedCodes = new Set(status.matchedCourses.map((course) => course.code));
  return status.explicitCourseCodes.filter((code) => !matchedCodes.has(code));
}

function getAppliedRequirementIds(
  statuses: TransferRequirementStatus[],
  courseCode: string
) {
  return statuses
    .filter((status) => status.matchedCourses.some((course) => course.code === courseCode))
    .map((status) => status.item.id);
}

function getDependentRequirementCourseLabels(
  statuses: TransferRequirementStatus[],
  prerequisiteCourseCode: string
) {
  const normalizedPrerequisiteCode = normalizeCourseCode(prerequisiteCourseCode);
  if (!normalizedPrerequisiteCode) {
    return {
      prerequisiteLabels: [] as string[],
      corequisiteLabels: [] as string[],
    };
  }

  const dependentPrerequisiteLabels: string[] = [];
  const dependentPrerequisiteLabelSet = new Set<string>();
  const dependentCorequisiteLabels: string[] = [];
  const dependentCorequisiteLabelSet = new Set<string>();

  const dependentCodes = unique(
    statuses.flatMap((status) =>
      status.explicitCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
    )
  ).filter((courseCode) => courseCode !== normalizedPrerequisiteCode);

  for (const dependentCode of dependentCodes) {
    const dependentCourse = getTransferPlannerCanonicalCourse("grc", dependentCode);
    if (!dependentCourse) {
      continue;
    }

    const prerequisiteCodes = new Set(
      [
        ...(dependentCourse.prerequisiteCourseCodes ?? []),
        ...(dependentCourse.prerequisiteAlternativeCourseCodeSets ?? []).flat(),
      ]
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean)
    );

    const label = normalizeCourseCode(dependentCode);
    if (!label) {
      continue;
    }

    const corequisiteCodes = new Set(
      [
        ...(dependentCourse.corequisiteCourseCodes ?? []),
        ...(dependentCourse.corequisiteAlternativeCourseCodeSets ?? []).flat(),
      ]
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean)
    );

    if (
      prerequisiteCodes.has(normalizedPrerequisiteCode) &&
      !dependentPrerequisiteLabelSet.has(label)
    ) {
      dependentPrerequisiteLabelSet.add(label);
      dependentPrerequisiteLabels.push(label);
    }

    if (
      corequisiteCodes.has(normalizedPrerequisiteCode) &&
      !dependentCorequisiteLabelSet.has(label)
    ) {
      dependentCorequisiteLabelSet.add(label);
      dependentCorequisiteLabels.push(label);
    }
  }

  return {
    prerequisiteLabels: sortCourseCodes(dependentPrerequisiteLabels),
    corequisiteLabels: sortCourseCodes(dependentCorequisiteLabels),
  };
}

function getIncompleteRequirementMissingCourseCodes(
  statuses: TransferRequirementStatus[],
  courseCode: string
) {
  return sortCourseCodes(
    statuses
      .filter(
        (status) =>
          !status.matched && status.matchedCourses.some((course) => course.code === courseCode)
      )
      .flatMap(getRequirementMissingCourseCodes)
  );
}

function getEvaluationEffectiveTermLabel(
  course: TranscriptCourseEntry,
  fallbackEffectiveTermLabel: string | null | undefined,
  fallbackCatalogYearLabel: string | null
) {
  if (fallbackEffectiveTermLabel) {
    return fallbackEffectiveTermLabel;
  }

  const courseCatalogYearLabel =
    course.catalogYearLabel ?? inferTransferPlannerGrcCatalogYearLabel([course]);
  return getGuideTermForCatalogYear(courseCatalogYearLabel ?? fallbackCatalogYearLabel);
}

function getEvaluationRuleCandidates(
  courseCode: string,
  completedCourseCodes: Set<string>,
  effectiveTermLabel: string | null
): EvaluationRuleCandidate[] {
  return getTransferPlannerEquivalencyRulesForSourceCourse(courseCode, effectiveTermLabel).flatMap(
    (rule) =>
      (rule.sourceCourseSets ?? [])
        .map((courseSet) => sortCourseCodes(courseSet.map(normalizeCourseCode)))
        .filter((courseSet) => courseSet.includes(courseCode))
        .map((sourceCourseSet) => ({
          rule,
          sourceCourseSet,
          missingSourceCourseCodes: sourceCourseSet.filter(
            (sourceCourseCode) => !completedCourseCodes.has(sourceCourseCode)
          ),
        }))
  );
}

function getRuleSourceKindRank(rule: TransferPlannerEquivalencyRule) {
  switch (rule.sourceKind) {
    case "uw-green-river-equivalency-guide":
      return 0;
    case "uw-green-river-equivalency-guide-derived":
      return 1;
    default:
      return 2;
  }
}

function getRuleStatusRank(rule: TransferPlannerEquivalencyRule) {
  if (rule.acceptanceCategory === "preferred") return 0;
  if (rule.ruleStatus === "active" || rule.acceptanceCategory === "accepted") return 1;
  if (rule.acceptanceCategory === "accepted-with-warning") return 2;
  if (rule.ruleStatus === "legacy" || rule.acceptanceCategory === "legacy-accepted") return 3;
  if (rule.type === "no-credit" || rule.acceptanceCategory === "no-credit") return 4;
  return 5;
}

function isReferenceOnlyCombinedEntryRule(rule: TransferPlannerEquivalencyRule) {
  const searchableText = [
    rule.title,
    rule.targetOutcome,
    ...rule.plannerWarnings,
    ...rule.notes,
  ].join(" ");

  return (
    rule.type === "sequence" &&
    (rule.targetCourseCodes?.length ?? 0) === 0 &&
    /combined[- ]entry|combined entries|see .*combined/i.test(searchableText)
  );
}

function compareEvaluationRuleCandidates(
  left: EvaluationRuleCandidate,
  right: EvaluationRuleCandidate
) {
  const referenceOnlyDelta =
    Number(isReferenceOnlyCombinedEntryRule(left.rule)) -
    Number(isReferenceOnlyCombinedEntryRule(right.rule));
  if (referenceOnlyDelta !== 0) return referenceOnlyDelta;

  const completionDelta =
    Number(left.missingSourceCourseCodes.length > 0) -
    Number(right.missingSourceCourseCodes.length > 0);
  if (completionDelta !== 0) return completionDelta;

  const sourceKindDelta = getRuleSourceKindRank(left.rule) - getRuleSourceKindRank(right.rule);
  if (sourceKindDelta !== 0) return sourceKindDelta;

  const sourceSetLengthDelta = right.sourceCourseSet.length - left.sourceCourseSet.length;
  if (sourceSetLengthDelta !== 0) return sourceSetLengthDelta;

  const statusDelta = getRuleStatusRank(left.rule) - getRuleStatusRank(right.rule);
  if (statusDelta !== 0) return statusDelta;

  return left.rule.id.localeCompare(right.rule.id);
}

function selectEvaluationRuleCandidate(candidates: EvaluationRuleCandidate[]) {
  return [...candidates].sort(compareEvaluationRuleCandidates)[0] ?? null;
}

function inferRuleSourceCreditAmount(rule: TransferPlannerEquivalencyRule | null | undefined) {
  if (!rule) return null;

  const rawSourceLabel = String(rule.sourceCourseLabel ?? "").trim();
  if (!rawSourceLabel) return null;

  const rangeMatch = rawSourceLabel.match(/\((\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\)/);
  if (rangeMatch) {
    const maxInRange = Number.parseFloat(rangeMatch[2] ?? "");
    return Number.isFinite(maxInRange) ? maxInRange : null;
  }

  const directMatch = rawSourceLabel.match(/\((\d+(?:\.\d+)?)\)/);
  if (directMatch) {
    const parsed = Number.parseFloat(directMatch[1] ?? "");
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isElectiveCreditRule(rule: TransferPlannerEquivalencyRule) {
  return (
    rule.type === "elective-credit" ||
    rule.type === "limited-credit" ||
    /\b[A-Z][A-Z &]*\s+[1-4]XX\b/.test(rule.targetOutcome) ||
    rule.targetCourseCodes?.some((courseCode) => /\b[1-4]XX\b/.test(courseCode)) === true
  );
}

function isZeroCreditTransferRule(rule: TransferPlannerEquivalencyRule) {
  const searchableText = [rule.title, rule.targetOutcome, ...rule.notes, ...rule.plannerWarnings]
    .join(" ")
    .toLowerCase();

  return /\b0\s+credit\s+allowed\b/.test(searchableText);
}

function getStudentEvaluationOutcome(input: {
  candidate: EvaluationRuleCandidate | null;
  missingSourceCourseCodes: string[];
  appliedRequirementIds: string[];
}) {
  const { candidate, missingSourceCourseCodes, appliedRequirementIds } = input;

  if (missingSourceCourseCodes.length > 0) {
    return "sequence-incomplete";
  }
  if (!candidate) {
    return "not-applicable-to-major";
  }
  if (candidate.rule.type === "no-credit" || candidate.rule.acceptanceCategory === "no-credit") {
    return "no-credit";
  }
  if (
    candidate.rule.ruleStatus === "legacy" ||
    candidate.rule.acceptanceCategory === "legacy-accepted"
  ) {
    return "legacy-rule-used";
  }
  if (isElectiveCreditRule(candidate.rule)) {
    return "elective-credit";
  }
  if (!appliedRequirementIds.length) {
    return "not-applicable-to-major";
  }

  return "auto-approved";
}

function makeStudentEvaluationId(
  planId: string | null,
  pathwayId: string | null,
  courseCode: string,
  index: number
) {
  const scope = [planId ?? "no-plan", pathwayId ?? "base", courseCode]
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `student-evaluation:${scope}:${index + 1}`;
}

export function buildTransferPlannerStudentCourseEvaluations(
  input: BuildTransferPlannerStudentCourseEvaluationsInput
): TransferPlannerStudentCourseEvaluation[] {
  const planId = input.plan?.id ?? input.planId ?? null;
  const pathwayId = getEvaluationPathwayId(input);
  const hiddenSourceGap = findHiddenSourceGap(planId, pathwayId);
  const completedCourses = input.completedCourses.map((course) => ({
    ...course,
    code: normalizeCourseCode(course.code),
  }));

  if (hiddenSourceGap) {
    return completedCourses.map((course, index) => ({
      id: makeStudentEvaluationId(planId, pathwayId, course.code, index),
      planId,
      pathwayId,
      courseCode: course.code,
      courseLabel: course.label,
      outcome: "source-unverified-hidden",
      studentFacing: false,
      appliedRequirementIds: [],
      approvedRuleId: null,
      alternativeApprovedRuleIds: [],
      ruleStatus: null,
      acceptanceCategory: null,
      targetOutcome: null,
      targetRequirementTags: [],
      sourceCreditAmount: null,
      targetCourseCodes: [],
      sourceCourseSet: [],
      missingSourceCourseCodes: [],
      effectiveTermLabel: null,
      automaticGuidanceSummary: null,
      warnings: [],
      notes: [hiddenSourceGap.sourceGapReason],
      sourceLinks: hiddenSourceGap.suggestedPrimary
        ? [
            {
              label: hiddenSourceGap.suggestedPrimary.label ?? hiddenSourceGap.title,
              url: hiddenSourceGap.suggestedPrimary.url,
              note: "Internal source-gap candidate; hidden from student-facing evaluations until parser verification succeeds.",
            },
          ]
        : [],
    }));
  }

  const statuses = getEvaluationRequirementStatuses(input);
  const completedCourseCodes = new Set(completedCourses.map((course) => course.code));
  const fallbackCatalogYearLabel = inferTransferPlannerGrcCatalogYearLabel(completedCourses);

  return completedCourses.map((course, index) => {
    const effectiveTermLabel = getEvaluationEffectiveTermLabel(
      course,
      input.effectiveTermLabel,
      fallbackCatalogYearLabel
    );
    const candidates = getEvaluationRuleCandidates(
      course.code,
      completedCourseCodes,
      effectiveTermLabel
    );
    const candidate = selectEvaluationRuleCandidate(candidates);
    const appliedRequirementIds = getAppliedRequirementIds(statuses, course.code);
    const missingSourceCourseCodes = sortCourseCodes([
      ...(candidate?.missingSourceCourseCodes ?? []),
      ...getIncompleteRequirementMissingCourseCodes(statuses, course.code),
    ]);
    const outcome = getStudentEvaluationOutcome({
      candidate,
      missingSourceCourseCodes,
      appliedRequirementIds,
    });
    const prerequisiteGuidanceSummary = buildDependencyGuidanceSummary(
      getDependentRequirementCourseLabels(statuses, course.code)
    );
    const transferGuidanceSummary = buildTransferEquivalencyGuidanceSummary(
      [course.code],
      input.plan?.campusId
    );
    const automaticGuidanceSummary = joinGuidanceSummaries(
      prerequisiteGuidanceSummary,
      transferGuidanceSummary
    );

    return {
      id: makeStudentEvaluationId(planId, pathwayId, course.code, index),
      planId,
      pathwayId,
      courseCode: course.code,
      courseLabel: course.label,
      outcome,
      studentFacing: true,
      appliedRequirementIds,
      approvedRuleId: candidate?.rule.id ?? null,
      alternativeApprovedRuleIds: candidates
        .map((entry) => entry.rule.id)
        .filter((ruleId) => ruleId !== candidate?.rule.id),
      ruleStatus: candidate?.rule.ruleStatus ?? null,
      acceptanceCategory: candidate?.rule.acceptanceCategory ?? null,
      targetOutcome: candidate?.rule.targetOutcome ?? null,
      targetRequirementTags: getEvaluationTargetRequirementTags(candidate?.rule),
      sourceCreditAmount: inferRuleSourceCreditAmount(candidate?.rule),
      targetCourseCodes: [...(candidate?.rule.targetCourseCodes ?? [])],
      sourceCourseSet: [...(candidate?.sourceCourseSet ?? [])],
      missingSourceCourseCodes,
      effectiveTermLabel,
      automaticGuidanceSummary,
      warnings: [...(candidate?.rule.plannerWarnings ?? [])],
      notes: [...(candidate?.rule.notes ?? [])],
      sourceLinks: [...(candidate?.rule.sourceLinks ?? [])],
    };
  });
}

const STUDENT_EVALUATION_REPORT_BUCKETS: {
  id: TransferPlannerStudentCourseEvaluation["outcome"];
  label: string;
  description: string;
}[] = [
  {
    id: "auto-approved",
    label: "Completed and applies",
    description: "Completed classes that match this UW plan through an approved source-backed rule.",
  },
  {
    id: "legacy-rule-used",
    label: "Applies with legacy warning",
    description: "Completed classes that use an older or legacy accepted source rule.",
  },
  {
    id: "elective-credit",
    label: "Completed as elective credit",
    description: "Completed classes that transfer, but not as a direct requirement for this major.",
  },
  {
    id: "sequence-incomplete",
    label: "Sequence incomplete",
    description: "Completed classes that need one or more paired GRC classes for the strongest UW outcome.",
  },
  {
    id: "no-credit",
    label: "No UW credit",
    description: "Completed classes that the official guide marks as no credit.",
  },
  {
    id: "not-applicable-to-major",
    label: "Not used for this major",
    description: "Completed classes with a source-backed transfer rule that do not apply to this selected major.",
  },
];

export function buildTransferPlannerStudentEvaluationReport(input: {
  plan?: TransferPlannerMajorPlan | null;
  planId?: string | null;
  pathwayId?: string | null;
  campusLabel: string;
  completedCourses: TranscriptCourseEntry[];
  evaluations: TransferPlannerStudentCourseEvaluation[];
  suggestedQuarterPlan?: SuggestedQuarterPlan[];
}): TransferPlannerStudentEvaluationReport {
  const planId = input.plan?.id ?? input.planId ?? null;
  const pathwayId =
    input.pathwayId ??
    (input.plan as { selectedPathwayId?: string | null } | null | undefined)?.selectedPathwayId ??
    null;
  const selectedPathwayLabel =
    (input.plan as { selectedPathwayLabel?: string | null } | null | undefined)
      ?.selectedPathwayLabel ?? null;
  const majorTitle = selectedPathwayLabel
    ? `${input.plan?.title ?? "Selected major"} (${selectedPathwayLabel})`
    : input.plan?.title ?? "Selected major";
  const studentFacingEvaluations = input.evaluations.filter((entry) => entry.studentFacing);
  const hiddenEvaluationCount = input.evaluations.length - studentFacingEvaluations.length;
  const officialRuleIds = unique(
    studentFacingEvaluations.flatMap((entry) => [
      entry.approvedRuleId,
      ...entry.alternativeApprovedRuleIds,
    ]).filter((ruleId): ruleId is string => Boolean(ruleId))
  ).sort((left, right) => left.localeCompare(right));
  const sourceLinkCount = unique(
    studentFacingEvaluations.flatMap((entry) => entry.sourceLinks.map((link) => link.url))
  ).length;
  const warningCourseCodes = sortCourseCodes(
    studentFacingEvaluations
      .filter((entry) => entry.warnings.length > 0 || entry.outcome === "legacy-rule-used")
      .map((entry) => entry.courseCode)
  );
  const missingSequenceCourseCodes = sortCourseCodes(
    studentFacingEvaluations.flatMap((entry) => entry.missingSourceCourseCodes)
  );
  const nextPlannedCourseLabels = unique(
    (input.suggestedQuarterPlan ?? [])
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses.map((course) => course.label))
  );
  const buckets = STUDENT_EVALUATION_REPORT_BUCKETS.map((bucket) => {
    const bucketEvaluations = studentFacingEvaluations.filter(
      (entry) => entry.outcome === bucket.id
    );
    return {
      ...bucket,
      courseCodes: sortCourseCodes(bucketEvaluations.map((entry) => entry.courseCode)),
      count: bucketEvaluations.length,
    };
  });

  return {
    planId,
    pathwayId,
    majorTitle,
    campusLabel: input.campusLabel,
    completedCourseCount: input.completedCourses.length,
    studentFacingEvaluationCount: studentFacingEvaluations.length,
    hiddenEvaluationCount,
    buckets,
    officialRuleIds,
    sourceLinkCount,
    warningCourseCodes,
    missingSequenceCourseCodes,
    nextPlannedCourseLabels,
    reportSummaryLines: [
      `${studentFacingEvaluations.length} completed transcript course(s) evaluated for ${majorTitle}.`,
      `${officialRuleIds.length} approved source rule(s) referenced by the evaluation.`,
      missingSequenceCourseCodes.length
        ? `Missing sequence course(s): ${missingSequenceCourseCodes.join(", ")}.`
        : "No incomplete transfer sequences were detected.",
      warningCourseCodes.length
        ? `Warning course(s): ${warningCourseCodes.join(", ")}.`
        : "No legacy or warning-course evaluations were detected.",
    ],
  };
}

export function buildTrackUsageSummary(
  track: TransferPlannerTrack | null,
  plan: TransferPlannerMajorPlan,
  completedCourses: TranscriptCourseEntry[] = []
): TrackUsageSummary | null {
  if (!track) return null;

  const requiredCourseCodes = new Set(
    unique(
      [
        ...plan.applicationChecklist,
        ...plan.beforeEnrollmentChecklist,
        ...plan.stayAtGrcChecklist,
      ].flatMap((item) =>
        getChecklistCourseOptions(item).flatMap((courseLabels) =>
          courseLabels.flatMap((course) => extractCourseCodes(course))
        )
      )
    )
  );

  const specificEntries: string[] = [];
  const generalEdEntries: string[] = [];

  for (const term of getResolvedTrackTermsForPlanning(track, completedCourses)) {
    for (const courseEntry of term.courses) {
      if (extractCourseCodes(courseEntry).length > 0) {
        specificEntries.push(courseEntry);
      } else {
        generalEdEntries.push(courseEntry);
      }
    }
  }

  const directUseEntries = specificEntries.filter((entry) =>
    extractCourseCodes(entry).some((code) => requiredCourseCodes.has(code))
  );
  const extraSpecificEntries = specificEntries.filter(
    (entry) => !directUseEntries.includes(entry)
  );

  return {
    specificCourseCount: specificEntries.length,
    directUseCount: directUseEntries.length,
    directUseEntries,
    extraSpecificEntries,
    generalEdEntryCount: generalEdEntries.length,
    generalEdEntries,
  };
}

function isCoreCourseLabel(label: string) {
  const normalized = String(label ?? "").toUpperCase();
  if (
    /\b(MATH|PHYS|CHEM|BIOL|ENGR|CS|CSE|EE|ECE|AMATH|STAT)\b/.test(normalized)
  ) {
    return true;
  }
  return extractCourseCodes(normalized).some((code) =>
    /^(MATH|PHYS|CHEM|BIOL|ENGR|CS|CSE|EE|ECE|AMATH|STAT)/.test(code)
  );
}

type PlanningQuarterKind = "Winter" | "Spring" | "Summer" | "Fall";

type PlanningQuarterSlot = {
  kind: PlanningQuarterKind;
  year: number;
  label: string;
  start: Date;
  end: Date;
};

function buildLocalQuarterDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function buildPlanningQuarterSlot(
  kind: PlanningQuarterKind,
  year: number
): PlanningQuarterSlot {
  switch (kind) {
    case "Winter":
      return {
        kind,
        year,
        label: `Winter ${year}`,
        start: buildLocalQuarterDate(year, 1, 2),
        end: buildLocalQuarterDate(year, 3, 20),
      };
    case "Spring":
      return {
        kind,
        year,
        label: `Spring ${year}`,
        start: buildLocalQuarterDate(year, 4, 1),
        end: buildLocalQuarterDate(year, 6, 18),
      };
    case "Summer":
      return {
        kind,
        year,
        label: `Summer ${year}`,
        start: buildLocalQuarterDate(year, 7, 1),
        end: buildLocalQuarterDate(year, 8, 21),
      };
    case "Fall":
      return {
        kind,
        year,
        label: `Fall ${year}`,
        start: buildLocalQuarterDate(year, 9, 22),
        end: buildLocalQuarterDate(year, 12, 11),
      };
  }
}

function getCurrentOrNextQuarterSlot(
  referenceDate = new Date(),
  includeSummerQuarter = false
) {
  const normalizedReference = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );
  const year = normalizedReference.getFullYear();
  const candidateSlots = [
    buildPlanningQuarterSlot("Winter", year),
    buildPlanningQuarterSlot("Spring", year),
    ...(includeSummerQuarter ? [buildPlanningQuarterSlot("Summer", year)] : []),
    buildPlanningQuarterSlot("Fall", year),
    buildPlanningQuarterSlot("Winter", year + 1),
  ];

  for (const slot of candidateSlots) {
    if (normalizedReference >= slot.start && normalizedReference <= slot.end) {
      return slot;
    }

    if (normalizedReference < slot.start) {
      return slot;
    }
  }

  return buildPlanningQuarterSlot("Winter", year + 1);
}

function getNextPlannedQuarterSlot(
  currentSlot: PlanningQuarterSlot,
  includeSummerQuarter = false
): PlanningQuarterSlot {
  switch (currentSlot.kind) {
    case "Winter":
      return buildPlanningQuarterSlot("Spring", currentSlot.year);
    case "Spring":
      return includeSummerQuarter
        ? buildPlanningQuarterSlot("Summer", currentSlot.year)
        : buildPlanningQuarterSlot("Fall", currentSlot.year);
    case "Summer":
      return buildPlanningQuarterSlot("Fall", currentSlot.year);
    case "Fall":
      return buildPlanningQuarterSlot("Winter", currentSlot.year + 1);
  }
}

function buildQuarterSlots(referenceDate = new Date(), includeSummerQuarter = false) {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  const fallYear = month >= 8 ? year + 1 : year;
  const slots: PlanningQuarterSlot[] = [];
  let slot = buildPlanningQuarterSlot("Fall", fallYear);

  while (slots.length < 3) {
    slots.push(slot);
    slot = getNextPlannedQuarterSlot(slot, includeSummerQuarter);
  }

  return slots;
}

function buildQuarterSlotsAfterCurrent(referenceDate = new Date(), includeSummerQuarter = false) {
  const slots: PlanningQuarterSlot[] = [];
  let slot = getCurrentOrNextQuarterSlot(referenceDate, includeSummerQuarter);

  while (slots.length < 3) {
    slot = getNextPlannedQuarterSlot(slot, includeSummerQuarter);
    slots.push(slot);
  }

  return slots;
}

const MAX_AUTOMATIC_PLANNED_QUARTERS = 18;
const MAX_AUTOMATIC_PLANNED_QUARTERS_WITH_GEN_ED_EXTENSION = 80;
const PLANNING_NO_PROGRESS_QUARTER_LIMIT = 3;

function buildCompletedQuarterPlans(
  completedCourses: TranscriptCourseEntry[],
  input?: {
    campusId?: TransferPlannerMajorPlan["campusId"] | null;
    requirementStatuses?: TransferRequirementStatus[];
    plan?: TransferPlannerMajorPlan | null;
  }
) {
  const grouped = new Map<
    string,
    { label: string; sortKey: string; courses: SuggestedQuarterCourse[] }
  >();
  const campusId = input?.campusId ?? null;
  const requirementStatuses = input?.requirementStatuses ?? [];
  const requirementTargets = buildSourceBackedGeneralEducationRequirementTargets(input?.plan);
  const hasRequirementTargets = hasGeneralEducationRequirementTargets(requirementTargets);
  const requirementRelationText =
    getSourceBackedMajorGeneralEducationRequirementRelationText(input?.plan);
  let completedAhCredits = 0;
  let completedSscCredits = 0;
  let completedNscCredits = 0;
  let completedBreadthCredits = 0;

  const buildCompletedCourseRequirementCoverageGuidanceSummary = (courseCode: string) => {
    if (!campusId || !hasRequirementTargets) return null;

    const normalizedCourseCode = normalizeCourseCode(courseCode);
    if (!normalizedCourseCode) return null;

    const requirementTags = new Set(
      getTransferPlannerEquivalencyRulesForSourceCourse(normalizedCourseCode)
        .filter((rule) => rule.targetSchoolIds.includes(campusId))
        .filter((rule) => !rule.isObsoleteSourceCourse)
        .filter((rule) => rule.acceptanceCategory !== "no-credit")
        .flatMap((rule) => getEvaluationTargetRequirementTags(rule))
    );

    const creditAmount =
      getTransferPlannerCanonicalCourse("grc", normalizedCourseCode)?.creditValue ??
      GENERAL_ED_PLACEHOLDER_CREDITS;

    if (
      requirementTargets.breadthCredits !== null &&
      (requirementTags.has("AH") || requirementTags.has("SSC"))
    ) {
      completedBreadthCredits = Math.min(
        completedBreadthCredits + creditAmount,
        requirementTargets.breadthCredits
      );
      return `This covers ${completedBreadthCredits}/${requirementTargets.breadthCredits} A&H/SSc credits ${requirementRelationText}.`;
    }

    if (requirementTargets.ahCredits !== null && requirementTags.has("AH")) {
      completedAhCredits = Math.min(completedAhCredits + creditAmount, requirementTargets.ahCredits);
      return `This covers ${completedAhCredits}/${requirementTargets.ahCredits} A&H credits ${requirementRelationText}.`;
    }

    if (requirementTargets.sscCredits !== null && requirementTags.has("SSC")) {
      completedSscCredits = Math.min(completedSscCredits + creditAmount, requirementTargets.sscCredits);
      return `This covers ${completedSscCredits}/${requirementTargets.sscCredits} SSc credits ${requirementRelationText}.`;
    }

    if (requirementTargets.nscCredits !== null && requirementTags.has("NSC")) {
      completedNscCredits = Math.min(completedNscCredits + creditAmount, requirementTargets.nscCredits);
      return `This covers ${completedNscCredits}/${requirementTargets.nscCredits} NSc credits ${requirementRelationText}.`;
    }

    return null;
  };

  for (const course of completedCourses) {
    const normalizedCourseCode = normalizeCourseCode(course.code);
    const prerequisiteGuidanceSummary = buildDependencyGuidanceSummary(
      getDependentRequirementCourseLabels(requirementStatuses, normalizedCourseCode)
    );
    const transferGuidanceSummary = buildTransferEquivalencyGuidanceSummary(
      [normalizedCourseCode],
      campusId
    );
    const requirementCoverageGuidanceSummary = buildCompletedCourseRequirementCoverageGuidanceSummary(
      normalizedCourseCode
    );

    const label = String(course.termLabel ?? "").trim() || "Past completed courses";
    const sortKey = String(course.termStartDate ?? "").trim() || label;
    const groupKey = `${sortKey}|${label}`;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        label,
        sortKey,
        courses: [],
      });
    }

      grouped.get(groupKey)?.courses.push({
        label: course.label,
        type: isCoreCourseLabel(course.code) ? "core" : "elective",
        status: "completed",
        guidanceSummary: joinGuidanceSummaries(
          prerequisiteGuidanceSummary,
          transferGuidanceSummary,
          requirementCoverageGuidanceSummary
        ),
        availabilitySummary: getTransferPlannerGrcCourseAvailabilitySummary(course.label),
      });
  }

  return [...grouped.values()]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map<SuggestedQuarterPlan>((group) => ({
      label: group.label,
      phase: "completed",
      courses: group.courses,
    }));
}

function shouldUseTrackTermForSupplementalPlanning(termLabel: string) {
  return !TRACK_SUPPLEMENTAL_TERM_LABEL_PATTERN.test(String(termLabel ?? "").trim());
}

function isTrackSupplementalCourseLabel(label: string) {
  const normalizedLabel = normalizeCourseCode(label);
  const explicitCourseCodes = extractCourseCodes(label);

  return explicitCourseCodes.length === 1 && explicitCourseCodes[0] === normalizedLabel;
}

function getResolvedTrackSupplementalCourseLabels(input: {
  track: TransferPlannerTrack | null | undefined;
  completedCourses: TranscriptCourseEntry[];
  completedCourseCodes: Set<string>;
  coveredCourseCodes: Set<string>;
  referenceDate?: Date;
}) {
  if (!input.track) {
    return [] as string[];
  }

  const supplementalCourseLabels: string[] = [];
  const seenLabels = new Set<string>();
  const coveredCourseCodes = new Set(
    [...input.coveredCourseCodes].map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );

  for (const term of getResolvedTrackTermsForStudentProgress(
    input.track,
    input.completedCourses,
    input.referenceDate
  )) {
    if (!shouldUseTrackTermForSupplementalPlanning(term.label)) {
      continue;
    }

    for (const label of term.courses) {
      if (!isTrackSupplementalCourseLabel(label)) {
        continue;
      }

      const explicitCourseCode = extractCourseCodes(label)[0] ?? null;
      if (!explicitCourseCode) {
        continue;
      }

      const normalizedLabel = normalizeCourseCode(label);
      if (
        !normalizedLabel ||
        seenLabels.has(normalizedLabel) ||
        coveredCourseCodes.has(explicitCourseCode) ||
        input.completedCourseCodes.has(explicitCourseCode)
      ) {
        continue;
      }

      seenLabels.add(normalizedLabel);
      coveredCourseCodes.add(explicitCourseCode);
      supplementalCourseLabels.push(normalizedLabel);
    }
  }

  return supplementalCourseLabels;
}

function buildTrackSupplementalGuidanceSummary(track: TransferPlannerTrack | null | undefined) {
  const trackCode = String(track?.code ?? "").trim();
  if (!trackCode) {
    return "Part of the recommended Green River associate track for this major.";
  }

  return `Part of the recommended ${trackCode} Green River associate track.`;
}

function buildTrackSupplementalSuggestedCourses(input: {
  track: TransferPlannerTrack | null | undefined;
  courseLabels: string[];
  prerequisiteCourseMap: Map<string, string[][]>;
  corequisiteCourseMap: Map<string, string[][]>;
  sourceOrderStart: number;
}) {
  return input.courseLabels.map<PendingSuggestedCourse>((label, index) => {
    const explicitCourseCodes = extractCourseCodes(label);

    return {
      label,
      type: isCoreCourseLabel(label) ? "core" : "elective",
      status: "planned",
      guidanceSummary: buildTrackSupplementalGuidanceSummary(input.track),
      sequenceGroup: null,
      priorityRank: REQUIREMENT_PRIORITY_RANK.stayAtGrc,
      sourceOrder: input.sourceOrderStart + index,
      explicitCourseCodes,
      prerequisiteCourseSets: unique(
        explicitCourseCodes.flatMap(
          (courseCode) => input.prerequisiteCourseMap.get(courseCode) ?? []
        )
      ).map((courseSet) => [...courseSet]),
      corequisiteCourseSets: unique(
        explicitCourseCodes.flatMap(
          (courseCode) => input.corequisiteCourseMap.get(courseCode) ?? []
        )
      ).map((courseSet) => [...courseSet]),
    };
  });
}

function getAvailabilityQuarterForPlanningKind(kind: PlanningQuarterKind) {
  switch (kind) {
    case "Winter":
      return "winter" as const;
    case "Spring":
      return "spring" as const;
    case "Summer":
      return "summer" as const;
    case "Fall":
      return "fall" as const;
  }
}

function getCourseAvailabilityMatch(
  label: string,
  preferredQuarterKind: PlanningQuarterKind | null | undefined
) {
  if (!preferredQuarterKind) return null;

  const latestPublishedQuarters = getTransferPlannerGrcCourseLatestPublishedQuarters(label);
  if (!latestPublishedQuarters) return null;
  if (!latestPublishedQuarters.length) return null;

  return latestPublishedQuarters.includes(getAvailabilityQuarterForPlanningKind(preferredQuarterKind));
}

type GeneralEducationPlaceholderKind = "ah" | "ssc" | "nsc" | "ahOrSsc" | "elective";

type GeneralEducationPlaceholder = {
  label: string;
  kind: GeneralEducationPlaceholderKind;
};

export type GeneralEducationRequirementTargets = {
  ahCredits: number | null;
  sscCredits: number | null;
  nscCredits: number | null;
  breadthCredits: number | null;
  electiveCredits: number | null;
};

export type GeneralEducationRequirementLayerDiagnostics = {
  sourceBackedTargets: GeneralEducationRequirementTargets;
  plannerGuidanceTargets: GeneralEducationRequirementTargets;
  sourceBackedSummarySection: TransferPlannerGeneralRequirementSection | null;
  hasSourceBackedTargets: boolean;
};

type SourceBackedGeneralEducationCategoryId = "ah" | "ssc" | "nsc";

type SourceBackedGeneralEducationDescriptor =
  | {
      kind: "category-fixed";
      category: SourceBackedGeneralEducationCategoryId;
      credits: number;
      sourceLine: string;
    }
  | {
      kind: "category-range";
      category: SourceBackedGeneralEducationCategoryId;
      minimumCredits: number;
      maximumCredits: number;
      sourceLine: string;
    }
  | {
      kind: "shared-bucket";
      categories: SourceBackedGeneralEducationCategoryId[];
      totalCredits: number;
      minimumPerCategoryCredits: number | null;
      scope: "areas-of-inquiry" | "categories";
      sourceLine: string;
    }
  | {
      kind: "area-total";
      totalCredits: number;
      sourceLine: string;
    }
  | {
      kind: "additional-flexible";
      categories: SourceBackedGeneralEducationCategoryId[];
      credits: number;
      sourceLine: string;
    }
  | {
      kind: "elective";
      credits: number;
      sourceLine: string;
    };

type ParsedSourceBackedGeneralEducationStructure = {
  descriptors: SourceBackedGeneralEducationDescriptor[];
  hasConflict: boolean;
};

export type CompletedTransferableQuarterCreditSummary = {
  completedTransferableQuarterCredits: number;
  countedCourseCodes: string[];
  excludedIncompleteSequenceCourseCodes: string[];
  excludedNonTransferableCourseCodes: string[];
};

const GENERAL_ED_PLACEHOLDER_CREDITS = 5;
const UW_TRANSFER_ADMISSION_CADR_EXEMPTION_QUARTER_CREDITS = 40;
const EMPTY_GENERAL_ED_REQUIREMENT_TARGETS: GeneralEducationRequirementTargets = {
  ahCredits: null,
  sscCredits: null,
  nscCredits: null,
  breadthCredits: null,
  electiveCredits: null,
};

function createEmptyGeneralEducationRequirementTargets(): GeneralEducationRequirementTargets {
  return {
    ...EMPTY_GENERAL_ED_REQUIREMENT_TARGETS,
  };
}

const SOURCE_BACKED_GENERAL_ED_CATEGORY_LABELS: Record<
  SourceBackedGeneralEducationCategoryId,
  string
> = {
  ah: "Arts & Humanities",
  ssc: "Social Sciences",
  nsc: "Natural Sciences",
};

function getTransferableCreditCandidateRulesForSourceCourse(
  sourceCourseCode: string,
  campusId: TransferPlannerMajorPlan["campusId"],
  effectiveTermLabel: string | null
) {
  const allCandidateRules = getTransferPlannerEquivalencyRulesForSourceCourse(
    sourceCourseCode,
    effectiveTermLabel
  )
    .filter((rule) => GUIDE_BACKED_EQUIVALENCY_RULE_SOURCE_KINDS.has(rule.sourceKind ?? ""))
    .filter((rule) => rule.acceptanceCategory !== "no-credit")
    .filter((rule) => (rule.targetCourseCodes ?? []).length > 0);

  const campusScopedRules = allCandidateRules.filter((rule) =>
    rule.targetSchoolIds.includes(campusId)
  );
  if (campusScopedRules.length || campusId === "uw-seattle") {
    return campusScopedRules;
  }

  return allCandidateRules.filter((rule) => rule.targetSchoolIds.includes("uw-seattle"));
}

function getTransferableCreditRuleCandidates(
  courseCode: string,
  completedCourseCodes: Set<string>,
  effectiveTermLabel: string | null,
  campusId: TransferPlannerMajorPlan["campusId"]
) {
  return getTransferableCreditCandidateRulesForSourceCourse(
    courseCode,
    campusId,
    effectiveTermLabel
  ).flatMap((rule) =>
    (rule.sourceCourseSets ?? [])
      .map((courseSet) => sortCourseCodes(courseSet.map(normalizeCourseCode)))
      .filter((courseSet) => courseSet.includes(courseCode))
      .map((sourceCourseSet) => ({
        rule,
        sourceCourseSet,
        missingSourceCourseCodes: sourceCourseSet.filter(
          (sourceCourseCode) => !completedCourseCodes.has(sourceCourseCode)
        ),
      }))
  );
}

function getCompletedTransferableQuarterCreditAmount(
  courseCode: string,
  candidate: EvaluationRuleCandidate
) {
  const canonicalCreditValue = getTransferPlannerCanonicalCourse("grc", courseCode)?.creditValue;
  if (Number.isFinite(canonicalCreditValue) && (canonicalCreditValue ?? 0) > 0) {
    return canonicalCreditValue ?? 0;
  }

  if (candidate.sourceCourseSet.length === 1) {
    const inferredSourceCreditAmount = inferRuleSourceCreditAmount(candidate.rule);
    if (
      Number.isFinite(inferredSourceCreditAmount) &&
      (inferredSourceCreditAmount ?? 0) > 0
    ) {
      return inferredSourceCreditAmount ?? 0;
    }
  }

  return GENERAL_ED_PLACEHOLDER_CREDITS;
}

export function buildCompletedTransferableQuarterCreditSummary(args: {
  completedCourses: TranscriptCourseEntry[];
  campusId: TransferPlannerMajorPlan["campusId"] | null | undefined;
  effectiveTermLabel?: string | null;
}): CompletedTransferableQuarterCreditSummary {
  const { campusId } = args;
  if (!campusId) {
    return {
      completedTransferableQuarterCredits: 0,
      countedCourseCodes: [],
      excludedIncompleteSequenceCourseCodes: [],
      excludedNonTransferableCourseCodes: [],
    };
  }

  const completedCourses = uniqueBy(args.completedCourses, (course) =>
    normalizeCourseCode(course.code)
  )
    .map((course) => ({
      ...course,
      code: normalizeCourseCode(course.code),
    }))
    .filter((course) => Boolean(course.code));
  const completedCourseCodes = new Set(completedCourses.map((course) => course.code));
  const fallbackCatalogYearLabel = inferTransferPlannerGrcCatalogYearLabel(completedCourses);

  let completedTransferableQuarterCredits = 0;
  const countedCourseCodes: string[] = [];
  const excludedIncompleteSequenceCourseCodes: string[] = [];
  const excludedNonTransferableCourseCodes: string[] = [];

  for (const course of completedCourses) {
    const effectiveTermLabel = getEvaluationEffectiveTermLabel(
      course,
      args.effectiveTermLabel,
      fallbackCatalogYearLabel
    );
    const candidate = selectEvaluationRuleCandidate(
      getTransferableCreditRuleCandidates(
        course.code,
        completedCourseCodes,
        effectiveTermLabel,
        campusId
      )
    );

    if (!candidate) {
      excludedNonTransferableCourseCodes.push(course.code);
      continue;
    }

    if (candidate.missingSourceCourseCodes.length > 0) {
      excludedIncompleteSequenceCourseCodes.push(course.code);
      continue;
    }

    if (isZeroCreditTransferRule(candidate.rule)) {
      excludedNonTransferableCourseCodes.push(course.code);
      continue;
    }

    completedTransferableQuarterCredits += getCompletedTransferableQuarterCreditAmount(
      course.code,
      candidate
    );
    countedCourseCodes.push(course.code);
  }

  return {
    completedTransferableQuarterCredits,
    countedCourseCodes: sortCourseCodes(countedCourseCodes),
    excludedIncompleteSequenceCourseCodes: sortCourseCodes(
      excludedIncompleteSequenceCourseCodes
    ),
    excludedNonTransferableCourseCodes: sortCourseCodes(excludedNonTransferableCourseCodes),
  };
}

function hasGeneralEducationRequirementTargets(
  targets: GeneralEducationRequirementTargets | null | undefined
) {
  if (!targets) {
    return false;
  }

  return (
    targets.ahCredits !== null ||
    targets.sscCredits !== null ||
    targets.nscCredits !== null ||
    targets.breadthCredits !== null ||
    targets.electiveCredits !== null
  );
}

function getGeneralEducationPlaceholderKind(
  label: string
): GeneralEducationPlaceholderKind | null {
  const normalized = String(label ?? "").toLowerCase();
  const hasHumanities = normalized.includes("humanit");
  const hasSocialScience = normalized.includes("social");
  const hasNaturalScience = normalized.includes("natural science") || /\bnsc\b/i.test(normalized);
  const hasElective =
    normalized.includes("elective") ||
    normalized.includes("general education") ||
    normalized.includes("general-education");

  if (hasHumanities && hasSocialScience) {
    return "ahOrSsc";
  }

  if (hasHumanities) {
    return "ah";
  }

  if (hasSocialScience) {
    return "ssc";
  }

  if (hasNaturalScience) {
    return "nsc";
  }

  if (hasElective) {
    return "elective";
  }

  return null;
}

function buildGeneralEducationPlaceholder(
  label: string
): GeneralEducationPlaceholder | null {
  const kind = getGeneralEducationPlaceholderKind(label);
  if (!kind) return null;

  return createGeneralEducationPlaceholderByKind(kind);
}

function createGeneralEducationPlaceholderByKind(
  kind: GeneralEducationPlaceholderKind
): GeneralEducationPlaceholder {

  switch (kind) {
    case "ah":
      return {
        label: "5 credits of Humanities",
        kind,
      };
    case "ssc":
      return {
        label: "5 credits of Social Science",
        kind,
      };
    case "nsc":
      return {
        label: "5 credits of Natural Sciences",
        kind,
      };
    case "ahOrSsc":
      return {
        label: "5 credits of A&H or SSc",
        kind,
      };
    case "elective":
      return {
        label: "5 credits of elective/general education",
        kind,
      };
  }
}

function isCombinedOnlyBreadthRequirementTarget(
  requirementTargets: GeneralEducationRequirementTargets
) {
  return (
    requirementTargets.breadthCredits !== null &&
    requirementTargets.ahCredits === null &&
    requirementTargets.sscCredits === null
  );
}

function getSharedBreadthCreditsForPlaceholders(
  placeholders: GeneralEducationPlaceholder[],
  requirementTargets: GeneralEducationRequirementTargets
) {
  return placeholders.filter((entry) => {
    if (entry.kind === "ahOrSsc") {
      return true;
    }

    return (
      isCombinedOnlyBreadthRequirementTarget(requirementTargets) &&
      (entry.kind === "ah" || entry.kind === "ssc")
    );
  }).length * GENERAL_ED_PLACEHOLDER_CREDITS;
}

function rebalanceSharedBreadthPlaceholders(
  placeholders: GeneralEducationPlaceholder[],
  requirementTargets: GeneralEducationRequirementTargets
) {
  let ahCredits = placeholders.filter((entry) => entry.kind === "ah").length * GENERAL_ED_PLACEHOLDER_CREDITS;
  let sscCredits = placeholders.filter((entry) => entry.kind === "ssc").length * GENERAL_ED_PLACEHOLDER_CREDITS;
  let remainingSharedPlaceholderAllowance =
    requirementTargets.breadthCredits === null
      ? 0
      : Math.ceil(requirementTargets.breadthCredits / GENERAL_ED_PLACEHOLDER_CREDITS);

  for (const placeholder of placeholders) {
    if (placeholder.kind !== "ahOrSsc") {
      continue;
    }

    if (remainingSharedPlaceholderAllowance > 0) {
      remainingSharedPlaceholderAllowance -= 1;
      continue;
    }

    const remainingAh = Math.max(0, (requirementTargets.ahCredits ?? 0) - ahCredits);
    const remainingSsc = Math.max(0, (requirementTargets.sscCredits ?? 0) - sscCredits);
    const nextKind = remainingSsc > remainingAh ? "ssc" : "ah";
    const replacement = createGeneralEducationPlaceholderByKind(nextKind);
    placeholder.kind = replacement.kind;
    placeholder.label = replacement.label;

    if (nextKind === "ah") {
      ahCredits += GENERAL_ED_PLACEHOLDER_CREDITS;
    } else {
      sscCredits += GENERAL_ED_PLACEHOLDER_CREDITS;
    }
  }
}

function getSourceBackedGeneralEducationFocusKind(
  plan: TransferPlannerMajorPlan | null | undefined
): Extract<GeneralEducationPlaceholderKind, "ah" | "ssc"> | null {
  const sourcePlan = getGeneralEducationRequirementTargetSourcePlan(plan);
  if (!sourcePlan) {
    return null;
  }

  const selectedPathwayId =
    (sourcePlan as { selectedPathwayId?: string | null } | null | undefined)?.selectedPathwayId ?? null;
  const focusSignalLines = unique([
    ...(sourcePlan.degreeMapSections ?? []).flatMap((section) => [section.title, ...section.items]),
    ...getTransferPlannerParsedRequirementSourceBlocks(sourcePlan.id, selectedPathwayId).flatMap(
      (block) => block.requirementCueLines ?? []
    ),
  ])
    .map((line) => normalizeGeneralEducationSignalText(line))
    .filter(Boolean);

  const hasHumanitiesFocus = focusSignalLines.some((line) =>
    /\b(?:arts?\s+and\s+humanities|a&h|humanities)\s+focus\b/.test(line)
  );
  const hasSocialScienceFocus = focusSignalLines.some((line) =>
    /\b(?:social sciences?|ssc)\s+focus\b/.test(line)
  );

  if (hasHumanitiesFocus === hasSocialScienceFocus) {
    return null;
  }

  return hasHumanitiesFocus ? "ah" : "ssc";
}

function concretizeUnscopedBreadthPlaceholders(args: {
  placeholders: GeneralEducationPlaceholder[];
  requirementTargets: GeneralEducationRequirementTargets;
  plan: TransferPlannerMajorPlan | null | undefined;
}) {
  const { placeholders, requirementTargets, plan } = args;
  if (
    requirementTargets.ahCredits !== null ||
    requirementTargets.sscCredits !== null ||
    requirementTargets.breadthCredits !== null
  ) {
    return placeholders;
  }

  const preferredKind = getSourceBackedGeneralEducationFocusKind(plan);
  let ahCount = placeholders.filter((entry) => entry.kind === "ah").length;
  let sscCount = placeholders.filter((entry) => entry.kind === "ssc").length;

  return placeholders.map((placeholder) => {
    if (placeholder.kind !== "ahOrSsc") {
      return placeholder;
    }

    const nextKind = preferredKind ?? (ahCount <= sscCount ? "ah" : "ssc");
    if (nextKind === "ah") {
      ahCount += 1;
    } else {
      sscCount += 1;
    }

    return createGeneralEducationPlaceholderByKind(nextKind);
  });
}

function filterGeneralEducationPlaceholdersByRemainingNeed(args: {
  placeholders: GeneralEducationPlaceholder[];
  requirementTargets: GeneralEducationRequirementTargets;
  completedCreditProgress: CompletedGeneralEducationCreditProgress;
}) {
  const { placeholders, requirementTargets, completedCreditProgress } = args;
  const filtered: GeneralEducationPlaceholder[] = [];
  const isCombinedOnlyBreadth = isCombinedOnlyBreadthRequirementTarget(requirementTargets);

  let ahCredits = completedCreditProgress.ahCredits;
  let sscCredits = completedCreditProgress.sscCredits;
  let nscCredits = completedCreditProgress.nscCredits;
  let breadthCredits = completedCreditProgress.breadthCredits;
  let electiveCredits = 0;

  for (const placeholder of placeholders) {
    const nextPlaceholder = { ...placeholder };
    const creditIncrement = GENERAL_ED_PLACEHOLDER_CREDITS;

    if (nextPlaceholder.kind === "ah") {
      if (requirementTargets.ahCredits !== null) {
        if (ahCredits >= requirementTargets.ahCredits) {
          continue;
        }
        ahCredits += creditIncrement;
      } else if (isCombinedOnlyBreadth && requirementTargets.breadthCredits !== null) {
        if (breadthCredits >= requirementTargets.breadthCredits) {
          continue;
        }
        breadthCredits += creditIncrement;
      }

      filtered.push(nextPlaceholder);
      continue;
    }

    if (nextPlaceholder.kind === "ssc") {
      if (requirementTargets.sscCredits !== null) {
        if (sscCredits >= requirementTargets.sscCredits) {
          continue;
        }
        sscCredits += creditIncrement;
      } else if (isCombinedOnlyBreadth && requirementTargets.breadthCredits !== null) {
        if (breadthCredits >= requirementTargets.breadthCredits) {
          continue;
        }
        breadthCredits += creditIncrement;
      }

      filtered.push(nextPlaceholder);
      continue;
    }

    if (nextPlaceholder.kind === "nsc") {
      if (requirementTargets.nscCredits !== null) {
        if (nscCredits >= requirementTargets.nscCredits) {
          continue;
        }
        nscCredits += creditIncrement;
      }

      filtered.push(nextPlaceholder);
      continue;
    }

    if (nextPlaceholder.kind === "ahOrSsc") {
      if (requirementTargets.breadthCredits !== null) {
        if (breadthCredits >= requirementTargets.breadthCredits) {
          continue;
        }
        breadthCredits += creditIncrement;
      }

      filtered.push(nextPlaceholder);
      continue;
    }

    if (requirementTargets.electiveCredits !== null) {
      if (electiveCredits >= requirementTargets.electiveCredits) {
        continue;
      }
      electiveCredits += creditIncrement;
    }

    filtered.push(nextPlaceholder);
  }

  return filtered;
}

type QuarterPlanningGeneralEducationPlaceholderEntry = {
  placeholder: GeneralEducationPlaceholder;
  sourceKind: TransferPlannerGeneralRequirementSourceKind;
};

function buildRequirementTargetSeedPlaceholders(
  requirementTargets: GeneralEducationRequirementTargets
) {
  const placeholders: GeneralEducationPlaceholder[] = [];
  if (requirementTargets.ahCredits !== null) {
    placeholders.push(createGeneralEducationPlaceholderByKind("ah"));
  }
  if (requirementTargets.sscCredits !== null) {
    placeholders.push(createGeneralEducationPlaceholderByKind("ssc"));
  }
  if (requirementTargets.nscCredits !== null) {
    placeholders.push(createGeneralEducationPlaceholderByKind("nsc"));
  }
  if (requirementTargets.breadthCredits !== null) {
    placeholders.push(createGeneralEducationPlaceholderByKind("ahOrSsc"));
  }
  if (requirementTargets.electiveCredits !== null) {
    placeholders.push(createGeneralEducationPlaceholderByKind("elective"));
  }

  return placeholders;
}

function buildSourceBackedMajorGeneralEducationPlaceholders(args: {
  plan?: TransferPlannerMajorPlan | null;
  completedCourses: TranscriptCourseEntry[];
}) {
  const { plan, completedCourses } = args;
  const requirementTargets = buildSourceBackedGeneralEducationRequirementTargets(plan);
  if (!hasGeneralEducationRequirementTargets(requirementTargets)) {
    return [] as GeneralEducationPlaceholder[];
  }

  const completedCreditProgress = getCompletedGeneralEducationCreditProgress({
    completedCourses,
    campusId: plan?.campusId,
  });
  const placeholders = filterGeneralEducationPlaceholdersByRemainingNeed({
    placeholders: buildRequirementTargetSeedPlaceholders(requirementTargets),
    requirementTargets,
    completedCreditProgress,
  });
  const normalizedPlaceholders = concretizeUnscopedBreadthPlaceholders({
    placeholders,
    requirementTargets,
    plan,
  });
  if (requirementTargets.ahCredits !== null || requirementTargets.sscCredits !== null) {
    rebalanceSharedBreadthPlaceholders(normalizedPlaceholders, requirementTargets);
  }

  const sourceBackedAhCredits = getSourceBackedGeneralEducationCredits({
    courseLabels: [],
    completedCourses,
    campusId: plan?.campusId,
    requirementTag: "AH",
  });
  const sourceBackedSscCredits = getSourceBackedGeneralEducationCredits({
    courseLabels: [],
    completedCourses,
    campusId: plan?.campusId,
    requirementTag: "SSC",
  });
  const sourceBackedNscCredits = getSourceBackedGeneralEducationCredits({
    courseLabels: [],
    completedCourses,
    campusId: plan?.campusId,
    requirementTag: "NSC",
  });
  const sourceBackedBreadthCredits = completedCreditProgress.breadthCredits;

  const getAhCredits = () =>
    sourceBackedAhCredits +
    normalizedPlaceholders.filter((entry) => entry.kind === "ah").length *
      GENERAL_ED_PLACEHOLDER_CREDITS;
  const getSscCredits = () =>
    sourceBackedSscCredits +
    normalizedPlaceholders.filter((entry) => entry.kind === "ssc").length *
      GENERAL_ED_PLACEHOLDER_CREDITS;
  const getNscCredits = () =>
    sourceBackedNscCredits +
    normalizedPlaceholders.filter((entry) => entry.kind === "nsc").length *
      GENERAL_ED_PLACEHOLDER_CREDITS;
  const getBreadthCredits = () =>
    sourceBackedBreadthCredits +
    getSharedBreadthCreditsForPlaceholders(normalizedPlaceholders, requirementTargets);
  const getElectiveCredits = () =>
    normalizedPlaceholders.filter((entry) => entry.kind === "elective").length *
    GENERAL_ED_PLACEHOLDER_CREDITS;

  while (requirementTargets.ahCredits !== null && getAhCredits() < requirementTargets.ahCredits) {
    normalizedPlaceholders.push(createGeneralEducationPlaceholderByKind("ah"));
  }
  while (requirementTargets.sscCredits !== null && getSscCredits() < requirementTargets.sscCredits) {
    normalizedPlaceholders.push(createGeneralEducationPlaceholderByKind("ssc"));
  }
  while (requirementTargets.nscCredits !== null && getNscCredits() < requirementTargets.nscCredits) {
    normalizedPlaceholders.push(createGeneralEducationPlaceholderByKind("nsc"));
  }
  while (
    requirementTargets.electiveCredits !== null &&
    getElectiveCredits() < requirementTargets.electiveCredits
  ) {
    normalizedPlaceholders.push(createGeneralEducationPlaceholderByKind("elective"));
  }
  while (
    requirementTargets.breadthCredits !== null &&
    getBreadthCredits() < requirementTargets.breadthCredits
  ) {
    normalizedPlaceholders.push(createGeneralEducationPlaceholderByKind("ahOrSsc"));
  }

  return normalizedPlaceholders;
}

function buildTrackGeneralEducationGuidanceTargets(
  placeholders: GeneralEducationPlaceholder[]
) {
  const slotTotals = buildGeneralEducationPlaceholderSlotTotals(placeholders);

  return {
    ahCredits: slotTotals.ahCredits || null,
    sscCredits: slotTotals.sscCredits || null,
    nscCredits: slotTotals.nscCredits || null,
    breadthCredits: slotTotals.breadthCredits || null,
    electiveCredits: slotTotals.electiveCredits || null,
  } satisfies GeneralEducationRequirementTargets;
}

function buildTrackGeneralEducationGuidancePlaceholders(args: {
  track: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
  referenceDate?: Date;
  plan?: TransferPlannerMajorPlan | null;
}) {
  const resolvedTrackTerms = args.track
    ? getResolvedTrackTermsForPlanning(args.track, args.completedCourses, args.referenceDate)
    : [];
  const mapped = resolvedTrackTerms
    .flatMap((term) => term.courses)
    .map((entry) => buildGeneralEducationPlaceholder(String(entry)))
    .filter((entry): entry is GeneralEducationPlaceholder => !!entry);
  if (!mapped.length) {
    return [] as GeneralEducationPlaceholder[];
  }

  const requirementTargets = buildTrackGeneralEducationGuidanceTargets(mapped);
  const completedCreditProgress = getCompletedGeneralEducationCreditProgress({
    completedCourses: args.completedCourses,
    campusId: args.plan?.campusId,
  });
  const placeholders = filterGeneralEducationPlaceholdersByRemainingNeed({
    placeholders: mapped,
    requirementTargets,
    completedCreditProgress,
  });
  const normalizedPlaceholders = concretizeUnscopedBreadthPlaceholders({
    placeholders,
    requirementTargets,
    plan: args.plan,
  });
  if (requirementTargets.ahCredits !== null || requirementTargets.sscCredits !== null) {
    rebalanceSharedBreadthPlaceholders(normalizedPlaceholders, requirementTargets);
  }

  return normalizedPlaceholders;
}

function buildGeneralEducationPlaceholders(args: {
  track: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
  referenceDate?: Date;
  plan?: TransferPlannerMajorPlan | null;
  includePlannerGuidancePlaceholders: boolean;
}) {
  const sourceBackedMajorPlaceholders = buildSourceBackedMajorGeneralEducationPlaceholders({
    plan: args.plan,
    completedCourses: args.completedCourses,
  }).map<QuarterPlanningGeneralEducationPlaceholderEntry>((placeholder) => ({
    placeholder,
    sourceKind: "source-backed-major",
  }));

  const plannerGuidancePlaceholders = args.includePlannerGuidancePlaceholders
    ? buildTrackGeneralEducationGuidancePlaceholders({
        track: args.track,
        completedCourses: args.completedCourses,
        referenceDate: args.referenceDate,
        plan: args.plan,
      }).map<QuarterPlanningGeneralEducationPlaceholderEntry>((placeholder) => ({
        placeholder,
        sourceKind: "planner-guidance",
      }))
    : [];

  return [...sourceBackedMajorPlaceholders, ...plannerGuidancePlaceholders];
}

function findGeneralEducationCreditValue(text: string, patterns: RegExp[]) {
  let detectedValue: number | null = null;

  for (const pattern of patterns) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);
    let match: RegExpExecArray | null = null;

    while ((match = globalPattern.exec(text)) !== null) {
      const value = Number.parseInt(match[1] ?? "", 10);
      if (Number.isFinite(value)) {
        detectedValue = detectedValue === null ? value : Math.max(detectedValue, value);
      }
    }
  }

  return detectedValue;
}

function normalizeGeneralEducationSignalText(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isCourseLedRequirementLine(text: string | null | undefined) {
  const trimmed = sanitizeGeneralEducationSourceSignalLine(text).replace(
    /^(?:\d+\s*[\).:-]\s*)+/,
    ""
  );
  const leadingCourseCode = extractCourseCodes(trimmed)[0];

  return Boolean(leadingCourseCode) && trimmed.toUpperCase().startsWith(leadingCourseCode);
}

function countGeneralEducationAreaSignals(text: string) {
  return [
    /\ba&h\b|\barts?\s+and\s+humanities\b/.test(text),
    /\bssc\b|\bsocial sciences?\b/.test(text),
    /\bnsc\b|\bnatural sciences?\b/.test(text),
  ].filter(Boolean).length;
}

function isGeneralEducationSignalLine(args: {
  line: string | null | undefined;
  sectionTitle?: string | null | undefined;
}) {
  const normalizedLine = normalizeGeneralEducationSignalText(args.line);
  if (!normalizedLine) {
    return false;
  }

  const normalizedSectionTitle = normalizeGeneralEducationSignalText(args.sectionTitle);
  const hasGeneralEducationContext =
    /\bgeneral education\b|\bareas? of inquiry\b|\badditional areas? of inquiry\b/.test(
      normalizedLine
    ) ||
    /\bgeneral education\b|\bareas? of inquiry\b|\badditional areas? of inquiry\b/.test(
      normalizedSectionTitle
    );
  const startsWithGeneralEducationCategory =
    /^(arts?\s+and\s+humanities|a&h|social sciences?|ssc|natural sciences?|nsc|additional a&h|additional arts?\s+and\s+humanities|additional areas?\s+of inquiry|english composition|written\s*&\s*oral communication|diversity)\b/.test(
      normalizedLine
    );
  const hasCombinedBreadthMarker =
    /\ba&h\/ssc(?:\/div)?\b|\barts?\s+and\s+humanities\s+or\s+social sciences?\b/.test(
      normalizedLine
    );
  const areaSignalCount = countGeneralEducationAreaSignals(normalizedLine);
  const hasCreditLanguage = /\b\d+\s*(?:credits?|cr)\b|\bcredits?\b/.test(normalizedLine);
  const hasRequirementLanguage =
    /\b(minimum|min\.?|at least|required|includes|required and can overlap|needed)\b/.test(
      normalizedLine
    );

  if (hasGeneralEducationContext || startsWithGeneralEducationCategory) {
    return true;
  }

  if (isCourseLedRequirementLine(args.line)) {
    return false;
  }

  if (hasCombinedBreadthMarker && hasCreditLanguage) {
    return true;
  }

  if (areaSignalCount >= 2 && hasCreditLanguage) {
    return true;
  }

  if (areaSignalCount >= 1 && hasCreditLanguage && hasRequirementLanguage) {
    return true;
  }

  return false;
}

function getGeneralEducationRequirementSignalLines(
  plan: TransferPlannerMajorPlan | null | undefined,
  parsedRequirementSourceLines: string[]
) {
  const planSignalLines = [
    ...(plan?.degreeMapSections ?? []).flatMap((section) =>
      section.items.filter((item) =>
        isGeneralEducationSignalLine({ line: item, sectionTitle: section.title })
      )
    ),
    plan?.summary ?? "",
    plan?.recommendedTrackSummary ?? "",
    ...(plan?.advisorFlags ?? []),
    ...(plan?.validationNotes ?? []),
  ].filter((line) => isGeneralEducationSignalLine({ line }));

  const parsedSignalLines = parsedRequirementSourceLines.filter((line) =>
    isGeneralEducationSignalLine({ line })
  );

  return [...planSignalLines, ...parsedSignalLines];
}

function getGeneralEducationRequirementTargetSourcePlan(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) {
    return null;
  }

  const sourceBasePlan = getTransferPlannerMajorPlan(plan.id);
  if (!sourceBasePlan) {
    return plan;
  }

  const selectedPathwayId =
    (plan as { selectedPathwayId?: string | null } | null | undefined)?.selectedPathwayId ?? null;

  return resolveTransferPlannerMajorPlan(sourceBasePlan, selectedPathwayId) ?? sourceBasePlan;
}

function sanitizeGeneralEducationSourceSignalLine(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/^\[page\s+\d+\]\s*/i, "")
    .replace(/[•ï±]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitGeneralEducationSourceSignalLine(value: string | null | undefined) {
  const sanitized = sanitizeGeneralEducationSourceSignalLine(value);
  if (!sanitized) {
    return [] as string[];
  }

  const initialFragments: string[] = [];
  const areasHeaderMatch = sanitized.match(
    /^(.*?\bareas? of (?:inquiry|knowledge)\b[^:]*):\s*(.+)$/i
  );
  if (areasHeaderMatch) {
    initialFragments.push(areasHeaderMatch[1] ?? "");
    initialFragments.push(areasHeaderMatch[2] ?? "");
  } else {
    initialFragments.push(sanitized);
  }

  return unique(
    initialFragments
      .flatMap((fragment) => fragment.split(/\s*;\s*/))
      .flatMap((fragment) =>
        fragment.split(
          /\.\s+(?=(?:\d+\s+(?:additional|credits?)|\b(?:arts?\s+(?:and|&)\s+humanities|a&h|social sciences?|ssc|natural sciences?|nsc|areas?\s+of\s+(?:inquiry|knowledge))\b))/i
        )
      )
      .map((fragment) => sanitizeGeneralEducationSourceSignalLine(fragment))
      .filter(Boolean)
  );
}

function detectSourceBackedGeneralEducationCategories(
  text: string
): SourceBackedGeneralEducationCategoryId[] {
  const matches: { category: SourceBackedGeneralEducationCategoryId; index: number }[] = [];
  const registerMatches = (
    category: SourceBackedGeneralEducationCategoryId,
    pattern: RegExp
  ) => {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);
    let match: RegExpExecArray | null = null;

    while ((match = globalPattern.exec(text)) !== null) {
      matches.push({
        category,
        index: match.index,
      });
    }
  };

  registerMatches("ah", /\barts?\s+(?:and|&)\s+humanities\b/i);
  registerMatches("ah", /\ba&h\b/i);
  registerMatches("ssc", /\bsocial sciences?\b/i);
  registerMatches("ssc", /\bssc\b/i);
  registerMatches("nsc", /\bnatural sciences?\b/i);
  registerMatches("nsc", /\bnsc\b/i);

  return unique(
    matches
      .sort((left, right) => left.index - right.index)
      .map((entry) => entry.category)
  );
}

function parseGeneralEducationCreditAmount(rawValue: string | null | undefined) {
  const parsed = Number.parseFloat(String(rawValue ?? ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractFirstMatchingGeneralEducationCreditValue(
  text: string,
  patterns: RegExp[]
) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const parsed = parseGeneralEducationCreditAmount(match?.[1] ?? null);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function extractAreasOfInquiryTotalCredits(text: string) {
  return extractFirstMatchingGeneralEducationCreditValue(text, [
    /\bareas? of (?:inquiry|knowledge)\b[^)]{0,48}\((\d+(?:\.\d+)?)\s*(?:credits?|cr)?/i,
    /\b(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b[^.]{0,48}\bareas? of (?:inquiry|knowledge)\b/i,
  ]);
}

function extractGeneralEducationMinimumPerCategoryCredits(text: string) {
  return extractFirstMatchingGeneralEducationCreditValue(text, [
    /\bminimum of (\d+(?:\.\d+)?)\s*(?:credits?|cr)\b[^.]{0,32}\bin each\b/i,
    /\bat least (\d+(?:\.\d+)?)\s*(?:credits?|cr)\b[^.]{0,32}\beach\b/i,
    /\binclude at least (\d+(?:\.\d+)?)\s*(?:credits?|cr)\b[^.]{0,32}\beach\b/i,
  ]);
}

function extractGeneralEducationCreditRange(text: string) {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\b/);
  const minimumCredits = parseGeneralEducationCreditAmount(match?.[1] ?? null);
  const maximumCredits = parseGeneralEducationCreditAmount(match?.[2] ?? null);
  const matchIndex = match?.index ?? -1;
  const rangeSuffix =
    match && matchIndex >= 0
      ? text.slice(matchIndex + match[0].length, matchIndex + match[0].length + 16)
      : "";
  if (
    minimumCredits === null ||
    maximumCredits === null ||
    minimumCredits > maximumCredits ||
    maximumCredits > 60 ||
    /\blevels?\b/i.test(rangeSuffix)
  ) {
    return null;
  }

  return {
    minimumCredits,
    maximumCredits,
  };
}

function extractGeneralEducationFixedCredits(text: string) {
  const explicitCreditMatches = Array.from(
    text.matchAll(/(\d+(?:\.\d+)?)\s+(?:additional\s+)?(?:credits?|cr)\b/gi)
  )
    .map((match) => parseGeneralEducationCreditAmount(match[1] ?? null))
    .filter((value): value is number => value !== null);
  if (explicitCreditMatches.length) {
    return explicitCreditMatches[explicitCreditMatches.length - 1] ?? null;
  }

  const parentheticalMatches = Array.from(text.matchAll(/\((\d+(?:\.\d+)?)\)/g))
    .map((match) => parseGeneralEducationCreditAmount(match[1] ?? null))
    .filter((value): value is number => value !== null);

  return parentheticalMatches[parentheticalMatches.length - 1] ?? null;
}

function buildCategorySpecificGeneralEducationFixedDescriptors(
  text: string
): SourceBackedGeneralEducationDescriptor[] {
  const descriptors = (
    [
      {
        category: "ah",
      },
      {
        category: "ssc",
      },
      {
        category: "nsc",
      },
    ] as const
  )
    .map(({ category }) => {
      const categoryPatternSource = getSourceBackedGeneralEducationCategoryPatternSource(category);
      const credits =
        extractFirstMatchingGeneralEducationCreditValue(text, [
          new RegExp(
            `\\b(\\d+(?:\\.\\d+)?)\\s*(?:credits?|cr)\\b(?:\\s+of)?[^.;]{0,24}\\b(?:${categoryPatternSource})\\b`,
            "i"
          ),
        ]) ?? extractLeadingCategoryGeneralEducationFixedCredits(text, category);
      if (credits === null) {
        return null;
      }

      return {
        kind: "category-fixed" as const,
        category,
        credits,
        sourceLine: text,
      };
    })
    .filter(
      (
        descriptor
      ): descriptor is Extract<SourceBackedGeneralEducationDescriptor, { kind: "category-fixed" }> =>
        descriptor !== null
    );

  return descriptors;
}

function getSourceBackedGeneralEducationCategoryPatternSource(
  category: SourceBackedGeneralEducationCategoryId
) {
  switch (category) {
    case "ah":
      return "(?:arts?\\s+(?:and|&)\\s+humanities|a&h)";
    case "ssc":
      return "(?:social sciences?|ssc)";
    case "nsc":
      return "(?:natural sciences?|nsc)";
  }
}

function extractLeadingCategoryGeneralEducationFixedCredits(
  text: string,
  category: SourceBackedGeneralEducationCategoryId
) {
  const categoryPatternSource = getSourceBackedGeneralEducationCategoryPatternSource(category);
  const match = text.match(
    new RegExp(
      `^\\s*(?:[-*]\\s*)?(?:${categoryPatternSource})\\b([^.;]{0,64}?)\\b(\\d+(?:\\.\\d+)?)\\s*(?:credits?|cr)\\b`,
      "i"
    )
  );
  if (!match) {
    return null;
  }

  const interveningText = match[1] ?? "";
  const otherCategoriesBeforeCredit = detectSourceBackedGeneralEducationCategories(
    interveningText
  ).filter((detectedCategory) => detectedCategory !== category);
  if (otherCategoriesBeforeCredit.length) {
    return null;
  }

  return parseGeneralEducationCreditAmount(match[2] ?? null);
}

function buildSingleCategoryGeneralEducationFixedDescriptor(
  text: string,
  category: SourceBackedGeneralEducationCategoryId
): Extract<SourceBackedGeneralEducationDescriptor, { kind: "category-fixed" }> | null {
  const categoryPatternSource = getSourceBackedGeneralEducationCategoryPatternSource(category);
  const credits = extractFirstMatchingGeneralEducationCreditValue(text, [
    new RegExp(`^\\s*(?:${categoryPatternSource})\\b[^.;]{0,32}\\((\\d+(?:\\.\\d+)?)\\)`, "i"),
    new RegExp(
      `\\b(?:${categoryPatternSource})\\b[^.;]{0,32}\\((\\d+(?:\\.\\d+)?)\\s*(?:credits?|cr)\\b[^)]*\\)`,
      "i"
    ),
    new RegExp(
      `\\b(?:${categoryPatternSource})\\b[^.;]{0,32}\\b(\\d+(?:\\.\\d+)?)\\s*(?:credits?|cr)\\b`,
      "i"
    ),
    new RegExp(
      `\\b(\\d+(?:\\.\\d+)?)\\s*(?:credits?|cr)\\b(?:\\s+of)?[^.;]{0,24}\\b(?:${categoryPatternSource})\\b`,
      "i"
    ),
  ]);
  if (credits === null) {
    return null;
  }

  return {
    kind: "category-fixed",
    category,
    credits,
    sourceLine: text,
  };
}

function buildSingleCategoryGeneralEducationRangeDescriptor(
  text: string,
  category: SourceBackedGeneralEducationCategoryId
): Extract<SourceBackedGeneralEducationDescriptor, { kind: "category-range" }> | null {
  const categoryPatternSource = getSourceBackedGeneralEducationCategoryPatternSource(category);
  const match = [
    new RegExp(
      `\\b(?:${categoryPatternSource})\\b[^.;]{0,32}\\((\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)\\)`,
      "i"
    ),
    new RegExp(
      `\\b(?:${categoryPatternSource})\\b[^.;]{0,32}\\b(\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)\\b`,
      "i"
    ),
    new RegExp(
      `\\b(\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)\\b[^.;]{0,24}\\b(?:${categoryPatternSource})\\b`,
      "i"
    ),
  ]
    .map((pattern) => text.match(pattern))
    .find((entry) => entry !== null);
  const minimumCredits = parseGeneralEducationCreditAmount(match?.[1] ?? null);
  const maximumCredits = parseGeneralEducationCreditAmount(match?.[2] ?? null);
  if (
    minimumCredits === null ||
    maximumCredits === null ||
    minimumCredits > maximumCredits ||
    maximumCredits > 60
  ) {
    return null;
  }

  return {
    kind: "category-range",
    category,
    minimumCredits,
    maximumCredits,
    sourceLine: text,
  };
}

function hasDirectSourceBackedGeneralEducationLeadContext(text: string) {
  return (
    /^(?:additional\s+)?(?:arts?\s+and\s+humanities|a&h|social sciences?|ssc|natural sciences?|nsc|areas?\s+of\s+(?:inquiry|knowledge))\b/i.test(
      text
    ) ||
    /^\d+(?:\.\d+)?\s+additional\b/i.test(text) ||
    /\bgeneral education\b/i.test(text)
  );
}

function hasExplicitSourceBackedGeneralEducationDescriptorContext(text: string) {
  const sanitizedText = sanitizeGeneralEducationSourceSignalLine(text);
  if (!sanitizedText) {
    return false;
  }

  return (
    /\bareas? of (?:inquiry|knowledge)\b|\bgeneral education\b/i.test(sanitizedText) ||
    /^(?:additional\s+)?(?:arts?\s+and\s+humanities|a&h|social sciences?|ssc|natural sciences?|nsc)\b[^.;]{0,48}(?:\(\d+(?:\.\d+)?(?:\s*(?:credits?|cr))?(?:\s*-\s*\d+(?:\.\d+)?)?[^)]*\)|\b\d+(?:\.\d+)?\s*(?:credits?|cr)\b)/i.test(
      sanitizedText
    ) ||
    /^\d+(?:\.\d+)?\s+(?:additional\s+)?(?:credits?|cr)\b[^.;]{0,32}\b(?:arts?\s+and\s+humanities|a&h|social sciences?|ssc|natural sciences?|nsc)\b/i.test(
      sanitizedText
    )
  );
}

function hasSameSourceBackedCategorySet(
  left: SourceBackedGeneralEducationCategoryId[],
  right: SourceBackedGeneralEducationCategoryId[]
) {
  if (left.length !== right.length) {
    return false;
  }

  const rightCategories = new Set(right);
  return left.every((category) => rightCategories.has(category));
}

function buildSourceBackedGeneralEducationDescriptorsFromSegment(
  segment: string
): SourceBackedGeneralEducationDescriptor[] {
  const sanitizedSegment = sanitizeGeneralEducationSourceSignalLine(segment);
  if (!sanitizedSegment) {
    return [];
  }

  const categories = detectSourceBackedGeneralEducationCategories(sanitizedSegment);
  const creditRange = extractGeneralEducationCreditRange(sanitizedSegment);
  const minimumPerCategoryCredits =
    extractGeneralEducationMinimumPerCategoryCredits(sanitizedSegment);
  const areasOfInquiryTotalCredits = extractAreasOfInquiryTotalCredits(sanitizedSegment);
  const fixedCredits = creditRange ? null : extractGeneralEducationFixedCredits(sanitizedSegment);
  const hasAreasOfInquiryScope = /\bareas? of inquiry\b/i.test(sanitizedSegment);
  const hasAdditional = /\badditional\b/i.test(sanitizedSegment);
  const hasAnyAreaLanguage =
    /\bany area\b/i.test(sanitizedSegment) ||
    /\badditional areas? of inquiry\b/i.test(sanitizedSegment);
  const hasDirectLeadContext = hasDirectSourceBackedGeneralEducationLeadContext(sanitizedSegment);
  const hasCourseLevelContext =
    /\b\d{3}\s*-\s*\d{3}\s*level\b|\b\d{3}-level\b/i.test(sanitizedSegment);
  const hasMathematicsAndNaturalSciencesCombo =
    categories.length === 1 &&
    categories[0] === "nsc" &&
    /\bmathematics?\b[^.]{0,24}\bnatural sciences?\b|\bnatural sciences?\b[^.]{0,24}\bmathematics?\b/i.test(
      sanitizedSegment
    );
  const categorySpecificFixedDescriptors =
    buildCategorySpecificGeneralEducationFixedDescriptors(sanitizedSegment);

  if (hasMathematicsAndNaturalSciencesCombo) {
    return [];
  }

  if (hasCourseLevelContext) {
    return [];
  }

  if (categorySpecificFixedDescriptors.length) {
    return categorySpecificFixedDescriptors;
  }

  if (categories.length === 1 && creditRange) {
    const directRangeDescriptor = buildSingleCategoryGeneralEducationRangeDescriptor(
      sanitizedSegment,
      categories[0]
    );
    if (directRangeDescriptor) {
      return [directRangeDescriptor];
    }
  }

  if (categories.length === 1 && fixedCredits !== null) {
    const directFixedDescriptor = buildSingleCategoryGeneralEducationFixedDescriptor(
      sanitizedSegment,
      categories[0]
    );
    if (directFixedDescriptor) {
      return [directFixedDescriptor];
    }
  }

  if (hasAdditional && hasAnyAreaLanguage && fixedCredits !== null) {
    return [
      {
        kind: "elective",
        credits: fixedCredits,
        sourceLine: sanitizedSegment,
      },
    ];
  }

  if (!hasDirectLeadContext && !hasAreasOfInquiryScope) {
    return [];
  }

  if (
    hasAreasOfInquiryScope &&
    minimumPerCategoryCredits !== null &&
    categories.length >= 2 &&
    areasOfInquiryTotalCredits !== null
  ) {
    return [
      {
        kind: "shared-bucket",
        categories,
        totalCredits: areasOfInquiryTotalCredits,
        minimumPerCategoryCredits,
        scope: "areas-of-inquiry",
        sourceLine: sanitizedSegment,
      },
    ];
  }

  if (categories.length >= 2 && hasAdditional && fixedCredits !== null) {
    return [
      {
        kind: "additional-flexible",
        categories,
        credits: fixedCredits,
        sourceLine: sanitizedSegment,
      },
    ];
  }

  if (categories.length >= 2 && fixedCredits !== null) {
    return [
      {
        kind: "shared-bucket",
        categories,
        totalCredits: fixedCredits,
        minimumPerCategoryCredits,
        scope: hasAreasOfInquiryScope ? "areas-of-inquiry" : "categories",
        sourceLine: sanitizedSegment,
      },
    ];
  }

  if (categories.length === 1 && creditRange) {
    return [];
  }

  if (categories.length === 1 && fixedCredits !== null) {
    return [];
  }

  if (hasAreasOfInquiryScope && areasOfInquiryTotalCredits !== null) {
    return [
      {
        kind: "area-total",
        totalCredits: areasOfInquiryTotalCredits,
        sourceLine: sanitizedSegment,
      },
    ];
  }

  return [];
}

function getSourceBackedGeneralEducationDescriptorKey(
  descriptor: SourceBackedGeneralEducationDescriptor
) {
  switch (descriptor.kind) {
    case "category-fixed":
      return `${descriptor.kind}:${descriptor.category}:${descriptor.credits}`;
    case "category-range":
      return `${descriptor.kind}:${descriptor.category}:${descriptor.minimumCredits}:${descriptor.maximumCredits}`;
    case "shared-bucket":
      return [
        descriptor.kind,
        descriptor.scope,
        descriptor.categories.join("-"),
        descriptor.totalCredits,
        descriptor.minimumPerCategoryCredits ?? "",
      ].join(":");
    case "area-total":
      return `${descriptor.kind}:${descriptor.totalCredits}`;
    case "additional-flexible":
      return `${descriptor.kind}:${descriptor.categories.join("-")}:${descriptor.credits}`;
    case "elective":
      return `${descriptor.kind}:${descriptor.credits}`;
  }
}

function buildParsedSourceBackedGeneralEducationStructure(
  plan: TransferPlannerMajorPlan | null | undefined
): ParsedSourceBackedGeneralEducationStructure {
  const sourcePlan = getGeneralEducationRequirementTargetSourcePlan(plan);
  const selectedPathwayId =
    (sourcePlan as { selectedPathwayId?: string | null } | null | undefined)?.selectedPathwayId ??
    null;
  const parsedRequirementSourceBlocks = sourcePlan
    ? uniqueBy(
        [
          ...getTransferPlannerParsedRequirementSourceBlocks(sourcePlan.id, selectedPathwayId),
          ...(selectedPathwayId
            ? getTransferPlannerParsedRequirementSourceBlocks(sourcePlan.id, null)
            : []),
        ],
        (block) => block.id
      )
    : [];
  const parsedRequirementSourceLines = parsedRequirementSourceBlocks.flatMap(
    (block) => block.requirementCueLines ?? []
  );
  const rawSignalLines = parsedRequirementSourceLines.length
    ? parsedRequirementSourceLines
    : getGeneralEducationRequirementSignalLines(sourcePlan, []);
  const signalSegments = unique(
    rawSignalLines
      .filter((line) =>
        parsedRequirementSourceLines.length
          ? Boolean(sanitizeGeneralEducationSourceSignalLine(line)) &&
            !isCourseLedRequirementLine(line)
          : isGeneralEducationSignalLine({ line })
      )
      .flatMap((line) => splitGeneralEducationSourceSignalLine(line))
  );
  const hasExplicitDescriptorContext = signalSegments.some((segment) =>
    hasExplicitSourceBackedGeneralEducationDescriptorContext(segment)
  );
  const descriptors = hasExplicitDescriptorContext
    ? uniqueBy(
        signalSegments.flatMap((segment) =>
          buildSourceBackedGeneralEducationDescriptorsFromSegment(segment)
        ),
        getSourceBackedGeneralEducationDescriptorKey
      )
    : [];

  if (!descriptors.length) {
    return {
      descriptors: [],
      hasConflict: false,
    };
  }

  const fixedCreditsByCategory = new Map<SourceBackedGeneralEducationCategoryId, Set<number>>();
  const rangeCreditsByCategory = new Map<
    SourceBackedGeneralEducationCategoryId,
    Set<string>
  >();
  const areaTotals = new Set<number>();
  const electiveCredits = new Set<number>();
  const additionalFlexibleByCategoryKey = new Map<string, Set<number>>();
  const sharedBuckets = descriptors.filter(
    (descriptor): descriptor is Extract<SourceBackedGeneralEducationDescriptor, { kind: "shared-bucket" }> =>
      descriptor.kind === "shared-bucket"
  );

  for (const descriptor of descriptors) {
    if (descriptor.kind === "category-fixed") {
      const existing = fixedCreditsByCategory.get(descriptor.category) ?? new Set<number>();
      existing.add(descriptor.credits);
      fixedCreditsByCategory.set(descriptor.category, existing);
      continue;
    }

    if (descriptor.kind === "category-range") {
      const existing = rangeCreditsByCategory.get(descriptor.category) ?? new Set<string>();
      existing.add(`${descriptor.minimumCredits}:${descriptor.maximumCredits}`);
      rangeCreditsByCategory.set(descriptor.category, existing);
      continue;
    }

    if (descriptor.kind === "area-total") {
      areaTotals.add(descriptor.totalCredits);
      continue;
    }

    if (descriptor.kind === "elective") {
      electiveCredits.add(descriptor.credits);
      continue;
    }

    if (descriptor.kind === "additional-flexible") {
      const categoryKey = descriptor.categories.join("-");
      const existing = additionalFlexibleByCategoryKey.get(categoryKey) ?? new Set<number>();
      existing.add(descriptor.credits);
      additionalFlexibleByCategoryKey.set(categoryKey, existing);
    }
  }

  let hasConflict = false;
  for (const creditSet of fixedCreditsByCategory.values()) {
    if (creditSet.size > 1) {
      hasConflict = true;
      break;
    }
  }
  for (const creditSet of rangeCreditsByCategory.values()) {
    if (creditSet.size > 1) {
      hasConflict = true;
      break;
    }
  }
  for (const [category] of fixedCreditsByCategory) {
    if (rangeCreditsByCategory.has(category)) {
      hasConflict = true;
      break;
    }
  }
  if (areaTotals.size > 1 || electiveCredits.size > 1) {
    hasConflict = true;
  }
  for (const creditSet of additionalFlexibleByCategoryKey.values()) {
    if (creditSet.size > 1) {
      hasConflict = true;
      break;
    }
  }
  for (let index = 0; index < sharedBuckets.length && !hasConflict; index += 1) {
    const leftBucket = sharedBuckets[index];
    for (let compareIndex = index + 1; compareIndex < sharedBuckets.length; compareIndex += 1) {
      const rightBucket = sharedBuckets[compareIndex];
      const overlappingCategories = leftBucket.categories.some((category) =>
        rightBucket.categories.includes(category)
      );
      if (!overlappingCategories) {
        continue;
      }

      const isEquivalentBucket =
        leftBucket.totalCredits === rightBucket.totalCredits &&
        leftBucket.minimumPerCategoryCredits === rightBucket.minimumPerCategoryCredits &&
        hasSameSourceBackedCategorySet(leftBucket.categories, rightBucket.categories) &&
        leftBucket.scope === rightBucket.scope;
      if (!isEquivalentBucket) {
        hasConflict = true;
        break;
      }
    }
  }

  if (!hasConflict) {
    const additionalAhOrSscCredits =
      additionalFlexibleByCategoryKey.get("ah-ssc")?.values().next().value ?? null;
    for (const bucket of sharedBuckets) {
      const overlappingFixedCredits = bucket.categories
        .map((category) => ({
          category,
          credits: fixedCreditsByCategory.get(category)?.values().next().value ?? null,
        }))
        .filter(
          (entry): entry is { category: SourceBackedGeneralEducationCategoryId; credits: number } =>
            entry.credits !== null
        );
      if (!overlappingFixedCredits.length) {
        continue;
      }

      const fixedCreditTotal = overlappingFixedCredits.reduce(
        (totalCredits, entry) => totalCredits + entry.credits,
        0
      );
      const hasAllBucketCategoriesFixed =
        overlappingFixedCredits.length === bucket.categories.length;
      const isAhOrSscBucket = hasSameSourceBackedCategorySet(bucket.categories, ["ah", "ssc"]);
      const isFixedMinimumExpansion =
        bucket.minimumPerCategoryCredits !== null &&
        hasAllBucketCategoriesFixed &&
        overlappingFixedCredits.every(
          (entry) => entry.credits === bucket.minimumPerCategoryCredits
        );
      const isFullyExpandedSharedBucket =
        hasAllBucketCategoriesFixed &&
        additionalAhOrSscCredits !== null &&
        isAhOrSscBucket &&
        fixedCreditTotal + additionalAhOrSscCredits === bucket.totalCredits;
      const isFullyAllocatedFixedBucket =
        hasAllBucketCategoriesFixed &&
        additionalAhOrSscCredits === null &&
        fixedCreditTotal === bucket.totalCredits;

      if (!isFixedMinimumExpansion && !isFullyExpandedSharedBucket && !isFullyAllocatedFixedBucket) {
        hasConflict = true;
        break;
      }
    }
  }

  return {
    descriptors,
    hasConflict,
  };
}

function hasSameSourceBackedGeneralEducationDescriptorType<
  K extends SourceBackedGeneralEducationDescriptor["kind"],
>(
  descriptor: SourceBackedGeneralEducationDescriptor,
  kind: K
): descriptor is Extract<SourceBackedGeneralEducationDescriptor, { kind: K }> {
  return descriptor.kind === kind;
}

function canReduceAreaTotalDescriptor(
  descriptor: Extract<SourceBackedGeneralEducationDescriptor, { kind: "area-total" }>,
  structure: ParsedSourceBackedGeneralEducationStructure
) {
  const fixedCreditTotal = structure.descriptors
    .filter((entry): entry is Extract<SourceBackedGeneralEducationDescriptor, { kind: "category-fixed" }> =>
      hasSameSourceBackedGeneralEducationDescriptorType(entry, "category-fixed")
    )
    .reduce((totalCredits, entry) => totalCredits + entry.credits, 0);
  const additionalFlexibleCreditTotal = structure.descriptors
    .filter((entry): entry is Extract<SourceBackedGeneralEducationDescriptor, { kind: "additional-flexible" }> =>
      hasSameSourceBackedGeneralEducationDescriptorType(entry, "additional-flexible")
    )
    .reduce((totalCredits, entry) => totalCredits + entry.credits, 0);
  const electiveCreditTotal = structure.descriptors
    .filter((entry): entry is Extract<SourceBackedGeneralEducationDescriptor, { kind: "elective" }> =>
      hasSameSourceBackedGeneralEducationDescriptorType(entry, "elective")
    )
    .reduce((totalCredits, entry) => totalCredits + entry.credits, 0);
  const matchingSharedBucket = structure.descriptors.some(
    (entry): entry is Extract<SourceBackedGeneralEducationDescriptor, { kind: "shared-bucket" }> =>
      hasSameSourceBackedGeneralEducationDescriptorType(entry, "shared-bucket") &&
      entry.scope === "areas-of-inquiry" &&
      entry.totalCredits === descriptor.totalCredits
  );

  return (
    matchingSharedBucket ||
    fixedCreditTotal + additionalFlexibleCreditTotal + electiveCreditTotal === descriptor.totalCredits
  );
}

function buildSourceBackedGeneralEducationRequirementTargetsFromStructure(
  structure: ParsedSourceBackedGeneralEducationStructure
): GeneralEducationRequirementTargets {
  if (!structure.descriptors.length || structure.hasConflict) {
    return createEmptyGeneralEducationRequirementTargets();
  }

  const hasUnsupportedDescriptor = structure.descriptors.some((descriptor) => {
    if (descriptor.kind === "category-range") {
      return true;
    }

    if (descriptor.kind === "shared-bucket") {
      return !hasSameSourceBackedCategorySet(descriptor.categories, ["ah", "ssc"]);
    }

    if (descriptor.kind === "area-total") {
      return !canReduceAreaTotalDescriptor(descriptor, structure);
    }

    if (descriptor.kind === "additional-flexible") {
      return !hasSameSourceBackedCategorySet(descriptor.categories, ["ah", "ssc"]);
    }

    return false;
  });
  if (hasUnsupportedDescriptor) {
    return createEmptyGeneralEducationRequirementTargets();
  }

  const targets = createEmptyGeneralEducationRequirementTargets();
  const fixedCreditsByCategory = new Map<SourceBackedGeneralEducationCategoryId, number>();

  for (const descriptor of structure.descriptors) {
    if (descriptor.kind === "category-fixed") {
      fixedCreditsByCategory.set(descriptor.category, descriptor.credits);
      if (descriptor.category === "ah") {
        targets.ahCredits = descriptor.credits;
      } else if (descriptor.category === "ssc") {
        targets.sscCredits = descriptor.credits;
      } else {
        targets.nscCredits = descriptor.credits;
      }
      continue;
    }

    if (descriptor.kind === "additional-flexible") {
      targets.breadthCredits = descriptor.credits;
      continue;
    }

    if (descriptor.kind === "elective") {
      targets.electiveCredits = descriptor.credits;
      continue;
    }

    if (descriptor.kind !== "shared-bucket") {
      continue;
    }

    const fixedAhCredits = fixedCreditsByCategory.get("ah") ?? null;
    const fixedSscCredits = fixedCreditsByCategory.get("ssc") ?? null;

    if (descriptor.minimumPerCategoryCredits !== null) {
      targets.ahCredits = targets.ahCredits ?? descriptor.minimumPerCategoryCredits;
      targets.sscCredits = targets.sscCredits ?? descriptor.minimumPerCategoryCredits;
      targets.breadthCredits =
        targets.breadthCredits ??
        Math.max(0, descriptor.totalCredits - descriptor.minimumPerCategoryCredits * 2);
      continue;
    }

    if (fixedAhCredits !== null && fixedSscCredits !== null) {
      targets.breadthCredits =
        targets.breadthCredits ??
        Math.max(0, descriptor.totalCredits - fixedAhCredits - fixedSscCredits);
      continue;
    }

    if (fixedAhCredits === null && fixedSscCredits === null) {
      targets.breadthCredits = targets.breadthCredits ?? descriptor.totalCredits;
      continue;
    }

    return createEmptyGeneralEducationRequirementTargets();
  }

  return hasGeneralEducationRequirementTargets(targets)
    ? targets
    : createEmptyGeneralEducationRequirementTargets();
}

function formatSourceBackedGeneralEducationCreditCount(credits: number) {
  return `${credits} ${credits === 1 ? "credit" : "credits"}`;
}

function joinSourceBackedGeneralEducationCategoryLabels(
  categories: SourceBackedGeneralEducationCategoryId[],
  separator: "slash" | "and" = "and"
) {
  const labels = categories.map((category) => SOURCE_BACKED_GENERAL_ED_CATEGORY_LABELS[category]);
  if (separator === "slash") {
    return labels.join(" / ");
  }

  if (labels.length <= 1) {
    return labels[0] ?? "";
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function buildSourceBackedMajorGeneralEducationRequirementItems(
  plan: TransferPlannerMajorPlan | null | undefined
): TransferPlannerGeneralRequirementSection["items"] {
  const structure = buildParsedSourceBackedGeneralEducationStructure(plan);
  if (!structure.descriptors.length || structure.hasConflict) {
    return [];
  }

  const fixedCreditsByCategory = new Map<SourceBackedGeneralEducationCategoryId, number>();
  const additionalFlexibleByCategoryKey = new Map<string, number>();
  const areaTotalCredits = structure.descriptors
    .filter((descriptor): descriptor is Extract<SourceBackedGeneralEducationDescriptor, { kind: "area-total" }> =>
      descriptor.kind === "area-total"
    )
    .map((descriptor) => descriptor.totalCredits);

  for (const descriptor of structure.descriptors) {
    if (descriptor.kind === "category-fixed") {
      fixedCreditsByCategory.set(descriptor.category, descriptor.credits);
      continue;
    }

    if (descriptor.kind === "additional-flexible") {
      additionalFlexibleByCategoryKey.set(descriptor.categories.join("-"), descriptor.credits);
    }
  }

  const items: TransferPlannerGeneralRequirementSection["items"] = [];
  const areaTotalCreditsValue = areaTotalCredits[0] ?? null;
  const pushItem = (item: TransferPlannerGeneralRequirementSection["items"][number]) => {
    if (items.some((existingItem) => existingItem.id === item.id)) {
      return;
    }

    items.push(item);
  };

  for (const descriptor of structure.descriptors) {
    if (descriptor.kind === "area-total") {
      if (canReduceAreaTotalDescriptor(descriptor, structure)) {
        const hasRangeDescriptor = structure.descriptors.some(
          (entry) => entry.kind === "category-range"
        );
        const hasUnreducedSharedBucket = structure.descriptors.some(
          (entry) =>
            entry.kind === "shared-bucket" &&
            !(
              hasSameSourceBackedCategorySet(entry.categories, ["ah", "ssc"]) &&
              fixedCreditsByCategory.get("ah") !== undefined &&
              fixedCreditsByCategory.get("ssc") !== undefined &&
              (additionalFlexibleByCategoryKey.get("ah-ssc") ?? 0) +
                (fixedCreditsByCategory.get("ah") ?? 0) +
                (fixedCreditsByCategory.get("ssc") ?? 0) ===
                entry.totalCredits
            )
        );
        if (!hasRangeDescriptor && !hasUnreducedSharedBucket) {
          continue;
        }
      }

      pushItem({
        id: "areas-of-inquiry-total",
        label: "Areas of Inquiry",
        valueText: `${formatSourceBackedGeneralEducationCreditCount(descriptor.totalCredits)} total`,
        sourceKind: "source-backed-major",
      });
      continue;
    }

    if (descriptor.kind === "category-fixed") {
      pushItem({
        id: descriptor.category,
        label: SOURCE_BACKED_GENERAL_ED_CATEGORY_LABELS[descriptor.category],
        valueText: formatSourceBackedGeneralEducationCreditCount(descriptor.credits),
        sourceKind: "source-backed-major",
      });
      continue;
    }

    if (descriptor.kind === "category-range") {
      pushItem({
        id: `${descriptor.category}-range`,
        label: SOURCE_BACKED_GENERAL_ED_CATEGORY_LABELS[descriptor.category],
        valueText: `${descriptor.minimumCredits}-${descriptor.maximumCredits} credits`,
        note:
          areaTotalCreditsValue !== null
            ? `Within the ${formatSourceBackedGeneralEducationCreditCount(areaTotalCreditsValue)} Areas of Inquiry total.`
            : undefined,
        sourceKind: "source-backed-major",
      });
      continue;
    }

    if (descriptor.kind === "additional-flexible") {
      pushItem({
        id: `additional-${descriptor.categories.join("-")}`,
        label:
          descriptor.categories.length >= 3
            ? "Additional Areas of Inquiry"
            : `Additional ${joinSourceBackedGeneralEducationCategoryLabels(
                descriptor.categories,
                "slash"
              )}`,
        valueText: formatSourceBackedGeneralEducationCreditCount(descriptor.credits),
        sourceKind: "source-backed-major",
      });
      continue;
    }

    if (descriptor.kind === "elective") {
      pushItem({
        id: "additional-areas-of-inquiry",
        label: "Additional Areas of Inquiry",
        valueText: formatSourceBackedGeneralEducationCreditCount(descriptor.credits),
        sourceKind: "source-backed-major",
      });
      continue;
    }

    const fixedCreditTotal = descriptor.categories.reduce(
      (totalCredits, category) => totalCredits + (fixedCreditsByCategory.get(category) ?? 0),
      0
    );
    const additionalFlexibleCredits =
      additionalFlexibleByCategoryKey.get(descriptor.categories.join("-")) ?? 0;
    const isFullyExpandedAhOrSscBucket =
      hasSameSourceBackedCategorySet(descriptor.categories, ["ah", "ssc"]) &&
      fixedCreditTotal + additionalFlexibleCredits === descriptor.totalCredits;
    if (isFullyExpandedAhOrSscBucket) {
      continue;
    }

    const sharedCategoryLabel = joinSourceBackedGeneralEducationCategoryLabels(
      descriptor.categories
    );
    const noteParts: string[] = [];
    if (descriptor.scope === "areas-of-inquiry" && descriptor.categories.length) {
      noteParts.push(`Shared across ${sharedCategoryLabel}.`);
    }
    if (descriptor.minimumPerCategoryCredits !== null) {
      noteParts.push(
        `Includes at least ${formatSourceBackedGeneralEducationCreditCount(
          descriptor.minimumPerCategoryCredits
        )} in each category.`
      );
    }

    pushItem({
      id: `shared-${descriptor.categories.join("-")}-${descriptor.totalCredits}`,
      label:
        descriptor.scope === "areas-of-inquiry" ? "Areas of Inquiry" : sharedCategoryLabel,
      valueText: `${formatSourceBackedGeneralEducationCreditCount(descriptor.totalCredits)} shared`,
      note: noteParts.join(" ").trim() || undefined,
      sourceKind: "source-backed-major",
    });
  }

  return items;
}

export function buildSourceBackedMajorGeneralEducationRequirementSection(
  plan: TransferPlannerMajorPlan | null | undefined
): TransferPlannerGeneralRequirementSection | null {
  const sourcePlan = getGeneralEducationRequirementTargetSourcePlan(plan) ?? plan;
  const items = buildSourceBackedMajorGeneralEducationRequirementItems(plan);
  if (!items.length || !sourcePlan?.campusId) {
    return null;
  }

  return {
    id: "source-backed-major-general-education",
    title: "Major Required Gen-Eds",
    summary: `Source-backed major-specific general education targets from ${getGeneralEducationPlanTitle(
      plan
    )}.`,
    campusId: sourcePlan.campusId,
    sourceKind: "source-backed-major",
    plannerUsage: "summary-only",
    items,
  };
}

export function buildSourceBackedGeneralEducationRequirementTargets(
  plan: TransferPlannerMajorPlan | null | undefined
): GeneralEducationRequirementTargets {
  return buildSourceBackedGeneralEducationRequirementTargetsFromStructure(
    buildParsedSourceBackedGeneralEducationStructure(plan)
  );
}

export function buildGeneralEducationRequirementTargets(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  return buildSourceBackedGeneralEducationRequirementTargets(plan);
}

export function buildGeneralEducationRequirementLayerDiagnostics(
  plan: TransferPlannerMajorPlan | null | undefined
): GeneralEducationRequirementLayerDiagnostics {
  const sourceBackedTargets = buildSourceBackedGeneralEducationRequirementTargets(plan);
  const sourceBackedSummarySection = buildSourceBackedMajorGeneralEducationRequirementSection(plan);
  const plannerGuidanceTargets = createEmptyGeneralEducationRequirementTargets();

  return {
    sourceBackedTargets,
    plannerGuidanceTargets,
    sourceBackedSummarySection,
    hasSourceBackedTargets:
      hasGeneralEducationRequirementTargets(sourceBackedTargets) ||
      Boolean(sourceBackedSummarySection?.items.length),
  };
}

function buildOfficialUwTransferAdmissionRequirementSectionItems(
  sourceKind: TransferPlannerGeneralRequirementSourceKind
): TransferPlannerGeneralRequirementSection["items"] {
  return [
    {
      id: "english",
      label: "English",
      valueText: "4 CADR credits",
      sourceKind,
    },
    {
      id: "mathematics",
      label: "Mathematics",
      valueText: "3 CADR credits",
      sourceKind,
    },
    {
      id: "social-sciences-social-studies",
      label: "Social sciences / social studies",
      valueText: "3 CADR credits",
      sourceKind,
    },
    {
      id: "world-languages",
      label: "World languages",
      valueText: "2 CADR credits",
      sourceKind,
    },
    {
      id: "science",
      label: "Science",
      valueText: "3 CADR credits",
      note: "Includes 2 years of lab science.",
      sourceKind,
    },
    {
      id: "senior-year-quantitative",
      label: "Senior-year math-based quantitative course",
      valueText: "1 CADR credit",
      sourceKind,
    },
    {
      id: "fine-arts",
      label: "Fine, visual or performing arts",
      valueText: "0.5 CADR credit",
      sourceKind,
    },
    {
      id: "academic-elective",
      label: "Academic elective",
      valueText: "0.5 CADR credit",
      sourceKind,
    },
  ];
}

export function buildUwGeneralTransferRequirementSection(
  plan: TransferPlannerMajorPlan | null | undefined,
  options: {
    completedCourses?: TranscriptCourseEntry[];
    hasTranscriptDerivedCreditSource?: boolean;
  } = {}
): TransferPlannerGeneralRequirementSection | null {
  const resolvedPlan = getGeneralEducationRequirementTargetSourcePlan(plan) ?? plan;
  if (!resolvedPlan?.campusId) {
    return null;
  }

  if (options.hasTranscriptDerivedCreditSource === false) {
    return null;
  }

  const completedTransferableQuarterCredits = buildCompletedTransferableQuarterCreditSummary({
    completedCourses: options.completedCourses ?? [],
    campusId: resolvedPlan.campusId,
  }).completedTransferableQuarterCredits;
  if (
    completedTransferableQuarterCredits >=
    UW_TRANSFER_ADMISSION_CADR_EXEMPTION_QUARTER_CREDITS
  ) {
    return null;
  }

  return {
    id: "uw-general-transfer-admission-requirements",
    title: "UW Transfer Admission Requirements",
    summary:
      "Official UW transfer admission policy uses CADR subject preparation. These subject requirements apply unless you have earned 40 transferable college quarter credits at the time of application.",
    note:
      "If you apply with fewer than 40 transferable quarter credits, UW reviews your high school record to confirm CADRs, and an academic associate degree alone does not imply they are met. The quarter planner keeps this section as policy guidance instead of auto-scheduling generic CADR placeholder classes.",
    campusId: resolvedPlan.campusId,
    sourceKind: "official-transfer-policy",
    plannerUsage: "summary-only",
    items: buildOfficialUwTransferAdmissionRequirementSectionItems("official-transfer-policy"),
  };
}

function countCompatibleGeneralEducationPlaceholders(
  placeholders: GeneralEducationPlaceholder[],
  placeholderIndex: number,
  kind: GeneralEducationPlaceholderKind,
  requirementTargets: GeneralEducationRequirementTargets
) {
  return placeholders
    .slice(0, placeholderIndex + 1)
    .filter((entry) => {
      if (kind === "ah") {
        return entry.kind === "ah";
      }

      if (kind === "ssc") {
        return entry.kind === "ssc";
      }

      if (kind === "nsc") {
        return entry.kind === "nsc";
      }

      if (kind === "ahOrSsc") {
        return isCombinedOnlyBreadthRequirementTarget(requirementTargets)
          ? entry.kind === "ah" || entry.kind === "ssc" || entry.kind === "ahOrSsc"
          : entry.kind === "ahOrSsc";
      }

      return entry.kind === "elective";
    }).length;
}

function buildGeneralEducationPlaceholderSlotTotals(placeholders: GeneralEducationPlaceholder[]) {
  return {
    ahCredits: placeholders.filter((entry) => entry.kind === "ah").length * GENERAL_ED_PLACEHOLDER_CREDITS,
    sscCredits:
      placeholders.filter((entry) => entry.kind === "ssc").length * GENERAL_ED_PLACEHOLDER_CREDITS,
    nscCredits:
      placeholders.filter((entry) => entry.kind === "nsc").length * GENERAL_ED_PLACEHOLDER_CREDITS,
    breadthCredits:
      placeholders.filter((entry) => entry.kind === "ahOrSsc").length *
      GENERAL_ED_PLACEHOLDER_CREDITS,
    electiveCredits:
      placeholders.filter((entry) => entry.kind === "elective").length *
      GENERAL_ED_PLACEHOLDER_CREDITS,
  };
}

function getGeneralEducationPlanTitle(plan: TransferPlannerMajorPlan | null | undefined) {
  const selectedPathwayLabel =
    (plan as { selectedPathwayLabel?: string | null } | null | undefined)?.selectedPathwayLabel ??
    null;
  if (!plan?.title) {
    return "this plan";
  }

  return selectedPathwayLabel ? `${plan.title} (${selectedPathwayLabel})` : plan.title;
}

function getSourceBackedMajorGeneralEducationRequirementRelationText(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  return `needed for the major-specific breadth requirements in ${getGeneralEducationPlanTitle(plan)}`;
}

function getTrackGeneralEducationPlannerGuidanceRelationText(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  return `planned for the matched Green River associate pathway in ${getGeneralEducationPlanTitle(plan)}`;
}

function buildGeneralEducationPlaceholderProgressSummary(args: {
  placeholder: GeneralEducationPlaceholder;
  placeholderIndex: number;
  placeholders: GeneralEducationPlaceholder[];
  requirementTargets: GeneralEducationRequirementTargets;
  completedCreditProgress?: CompletedGeneralEducationCreditProgress;
  relationText: string;
  additionalGuidanceText?: string | null;
}) {
  const { placeholder, placeholderIndex, placeholders, requirementTargets } = args;
  const slotTotals = buildGeneralEducationPlaceholderSlotTotals(placeholders);
  const completedCreditProgress = args.completedCreditProgress ?? {
    ahCredits: 0,
    sscCredits: 0,
    nscCredits: 0,
    breadthCredits: 0,
  };

  let areaLabel = "elective/general-education";
  let totalCredits = slotTotals.electiveCredits;
  let relation = args.relationText;
  let baselineCredits = 0;

  if (placeholder.kind === "ah") {
    if (requirementTargets.ahCredits !== null) {
      areaLabel = "A&H";
      totalCredits = requirementTargets.ahCredits;
      baselineCredits = completedCreditProgress.ahCredits;
    } else if (requirementTargets.breadthCredits !== null) {
      areaLabel = "A&H/SSc";
      totalCredits = requirementTargets.breadthCredits;
      baselineCredits = completedCreditProgress.breadthCredits;
    } else {
      areaLabel = "A&H";
      totalCredits = slotTotals.ahCredits;
    }
  } else if (placeholder.kind === "ssc") {
    if (requirementTargets.sscCredits !== null) {
      areaLabel = "SSc";
      totalCredits = requirementTargets.sscCredits;
      baselineCredits = completedCreditProgress.sscCredits;
    } else if (requirementTargets.breadthCredits !== null) {
      areaLabel = "A&H/SSc";
      totalCredits = requirementTargets.breadthCredits;
      baselineCredits = completedCreditProgress.breadthCredits;
    } else {
      areaLabel = "SSc";
      totalCredits = slotTotals.sscCredits;
    }
  } else if (placeholder.kind === "nsc") {
    areaLabel = "NSc";
    if (requirementTargets.nscCredits !== null) {
      totalCredits = requirementTargets.nscCredits;
      baselineCredits = completedCreditProgress.nscCredits;
    } else {
      totalCredits = slotTotals.nscCredits;
    }
  } else if (placeholder.kind === "ahOrSsc") {
    areaLabel =
      requirementTargets.ahCredits !== null || requirementTargets.sscCredits !== null
        ? "additional A&H/SSc"
        : "A&H/SSc";
    if (requirementTargets.breadthCredits !== null) {
      totalCredits = requirementTargets.breadthCredits;
      baselineCredits = completedCreditProgress.breadthCredits;
    } else {
      totalCredits = slotTotals.breadthCredits;
    }
  } else if (requirementTargets.electiveCredits !== null) {
    totalCredits = requirementTargets.electiveCredits;
  }

  const placeholderProgressCredits =
    countCompatibleGeneralEducationPlaceholders(
      placeholders,
      placeholderIndex,
      placeholder.kind,
      requirementTargets
    ) * GENERAL_ED_PLACEHOLDER_CREDITS;
  const progressCredits = Math.min(
    baselineCredits + placeholderProgressCredits,
    totalCredits
  );

  const summary = `This covers ${progressCredits}/${totalCredits} ${areaLabel} credits ${relation}.`;

  return args.additionalGuidanceText
    ? `${summary} ${args.additionalGuidanceText}`
    : summary;
}

function buildSourceBackedMajorGeneralEducationPlaceholderGuidanceSummary(args: {
  placeholder: GeneralEducationPlaceholder;
  placeholderIndex: number;
  placeholders: GeneralEducationPlaceholder[];
  plan?: TransferPlannerMajorPlan | null;
  completedCreditProgress?: CompletedGeneralEducationCreditProgress;
}) {
  const requirementTargets = buildSourceBackedGeneralEducationRequirementTargets(args.plan);
  if (!hasGeneralEducationRequirementTargets(requirementTargets)) {
    return null;
  }

  return buildGeneralEducationPlaceholderProgressSummary({
    ...args,
    requirementTargets,
    relationText: getSourceBackedMajorGeneralEducationRequirementRelationText(args.plan),
  });
}

function buildTrackGeneralEducationPlaceholderGuidanceSummary(args: {
  placeholder: GeneralEducationPlaceholder;
  placeholderIndex: number;
  placeholders: GeneralEducationPlaceholder[];
  plan?: TransferPlannerMajorPlan | null;
  completedCreditProgress?: CompletedGeneralEducationCreditProgress;
}) {
  const requirementTargets = buildTrackGeneralEducationGuidanceTargets(args.placeholders);
  if (!hasGeneralEducationRequirementTargets(requirementTargets)) {
    return null;
  }

  return buildGeneralEducationPlaceholderProgressSummary({
    ...args,
    requirementTargets,
    relationText: getTrackGeneralEducationPlannerGuidanceRelationText(args.plan),
    additionalGuidanceText:
      "This is planner guidance from the matched Green River associate pathway, not an official UW transfer admission requirement.",
  });
}

function getSourceBackedGeneralEducationCredits(args: {
  courseLabels: string[];
  completedCourses: TranscriptCourseEntry[];
  campusId: TransferPlannerMajorPlan["campusId"] | null | undefined;
  requirementTag: "AH" | "SSC" | "NSC";
}) {
  const { courseLabels, completedCourses, campusId, requirementTag } = args;
  if (!campusId) {
    return 0;
  }

  const countedCourseCodes = unique([
    ...courseLabels.flatMap((label) => extractCourseCodes(label)),
    ...completedCourses.map((course) => course.code),
  ]);

  return countedCourseCodes.reduce((totalCredits, courseCode) => {
    const hasRequirementTag = getTransferPlannerEquivalencyRulesForSourceCourse(courseCode).some(
      (rule) => {
        if (!rule.targetSchoolIds.includes(campusId)) return false;
        if (rule.isObsoleteSourceCourse) return false;
        if (rule.acceptanceCategory === "no-credit") return false;

        return getEvaluationTargetRequirementTags(rule).includes(requirementTag);
      }
    );
    if (!hasRequirementTag) {
      return totalCredits;
    }

    return (
      totalCredits +
      (getTransferPlannerCanonicalCourse("grc", courseCode)?.creditValue ??
        GENERAL_ED_PLACEHOLDER_CREDITS)
    );
  }, 0);
}

type CompletedGeneralEducationCreditProgress = {
  ahCredits: number;
  sscCredits: number;
  nscCredits: number;
  breadthCredits: number;
};

function getCompletedGeneralEducationCreditProgress(args: {
  completedCourses: TranscriptCourseEntry[];
  campusId: TransferPlannerMajorPlan["campusId"] | null | undefined;
}): CompletedGeneralEducationCreditProgress {
  const { completedCourses, campusId } = args;
  if (!campusId) {
    return {
      ahCredits: 0,
      sscCredits: 0,
      nscCredits: 0,
      breadthCredits: 0,
    };
  }

  const countedCourseCodes = unique(completedCourses.map((course) => course.code));
  let ahCredits = 0;
  let sscCredits = 0;
  let nscCredits = 0;
  let breadthCredits = 0;

  for (const courseCode of countedCourseCodes) {
    const requirementTags = new Set(
      getTransferPlannerEquivalencyRulesForSourceCourse(courseCode)
        .filter((rule) => rule.targetSchoolIds.includes(campusId))
        .filter((rule) => !rule.isObsoleteSourceCourse)
        .filter((rule) => rule.acceptanceCategory !== "no-credit")
        .flatMap((rule) => getEvaluationTargetRequirementTags(rule))
    );
    if (!requirementTags.size) {
      continue;
    }

    const creditAmount =
      getTransferPlannerCanonicalCourse("grc", courseCode)?.creditValue ??
      GENERAL_ED_PLACEHOLDER_CREDITS;

    if (requirementTags.has("AH")) {
      ahCredits += creditAmount;
    }
    if (requirementTags.has("SSC")) {
      sscCredits += creditAmount;
    }
    if (requirementTags.has("NSC")) {
      nscCredits += creditAmount;
    }
    if (requirementTags.has("AH") || requirementTags.has("SSC")) {
      breadthCredits += creditAmount;
    }
  }

  return {
    ahCredits,
    sscCredits,
    nscCredits,
    breadthCredits,
  };
}

function normalizeCourseRequirementPath(courseCodes: string[]) {
  return sortCourseCodes(courseCodes.map((code) => normalizeCourseCode(code)).filter(Boolean));
}

function addCourseRequirementPath(
  requirementMap: Map<string, string[][]>,
  courseCode: string,
  coursePath: string[]
) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const normalizedPath = normalizeCourseRequirementPath(coursePath).filter(
    (code) => code !== normalizedCourseCode
  );
  if (!normalizedPath.length) return;

  const existingPaths = requirementMap.get(normalizedCourseCode) ?? [];
  const pathKey = normalizedPath.join("|");
  const alreadyRecorded = existingPaths.some((path) => path.join("|") === pathKey);
  if (alreadyRecorded) return;

  requirementMap.set(normalizedCourseCode, [...existingPaths, normalizedPath]);
}

function buildCourseMetadataRequirementPaths(
  requiredCourseCodes: string[],
  alternativeCourseCodeSets: string[][],
  actionableCourseCodes: Set<string>
) {
  const requiredCodes = normalizeCourseRequirementPath(requiredCourseCodes);
  const alternativePaths = alternativeCourseCodeSets
    .map((courseSet) => normalizeCourseRequirementPath(courseSet))
    .filter((courseSet) => courseSet.length > 0);
  const candidatePaths = alternativePaths.length
    ? alternativePaths.map((courseSet) => normalizeCourseRequirementPath([...requiredCodes, ...courseSet]))
    : requiredCodes.length
      ? [requiredCodes]
      : [];

  return candidatePaths
    .map((courseSet) => courseSet.filter((courseCode) => actionableCourseCodes.has(courseCode)))
    .filter((courseSet) => courseSet.length > 0);
}

function buildMetadataCourseRequirementMap(
  actionableCourseCodes: Set<string>,
  kind: "prerequisite" | "corequisite"
) {
  const requirementMap = new Map<string, string[][]>();

  for (const courseCode of actionableCourseCodes) {
    const course = getTransferPlannerCanonicalCourse("grc", courseCode);
    if (!course) continue;

    const requirementPaths =
      kind === "prerequisite"
        ? buildCourseMetadataRequirementPaths(
            course.prerequisiteCourseCodes,
            course.prerequisiteAlternativeCourseCodeSets,
            actionableCourseCodes
          )
        : buildCourseMetadataRequirementPaths(
            course.corequisiteCourseCodes,
            course.corequisiteAlternativeCourseCodeSets,
            actionableCourseCodes
          );

    for (const requirementPath of requirementPaths) {
      addCourseRequirementPath(requirementMap, courseCode, requirementPath);
    }
  }

  return requirementMap;
}

function buildPlannerChainPrerequisiteMap(
  _plan: TransferPlannerMajorPlan | null | undefined,
  _actionableCourseCodes: Set<string>
) {
  return new Map<string, string[][]>();
}

function mergeCourseRequirementMaps(...maps: Map<string, string[][]>[]) {
  const merged = new Map<string, string[][]>();

  for (const map of maps) {
    for (const [courseCode, requirementPaths] of map.entries()) {
      for (const requirementPath of requirementPaths) {
        addCourseRequirementPath(merged, courseCode, requirementPath);
      }
    }
  }

  return merged;
}

function mapRequirementPathsToRecord(map: Map<string, string[][]>) {
  return Object.fromEntries(
    [...map.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([courseCode, requirementPaths]) => [
        courseCode,
        requirementPaths
          .map((requirementPath) => [...requirementPath])
          .sort((left, right) => left.join("|").localeCompare(right.join("|"))),
      ])
  );
}

export function buildTransferPlannerCoursePlanningGraph(input: {
  plan?: TransferPlannerMajorPlan | null;
  actionableCourseCodes: Set<string> | string[];
}): TransferPlannerCoursePlanningGraph {
  const actionableCourseCodes = new Set(
    [...input.actionableCourseCodes].map((courseCode) => normalizeCourseCode(courseCode))
  );
  const metadataPrerequisiteMap = buildMetadataCourseRequirementMap(
    actionableCourseCodes,
    "prerequisite"
  );
  const metadataCorequisiteMap = buildMetadataCourseRequirementMap(
    actionableCourseCodes,
    "corequisite"
  );
  const chainPrerequisiteMap = buildPlannerChainPrerequisiteMap(input.plan, actionableCourseCodes);
  const prerequisiteMap = mergeCourseRequirementMaps(
    metadataPrerequisiteMap,
    chainPrerequisiteMap
  );

  return {
    prerequisiteCourseSetsByCourseCode: mapRequirementPathsToRecord(prerequisiteMap),
    corequisiteCourseSetsByCourseCode: mapRequirementPathsToRecord(metadataCorequisiteMap),
    sourceCounts: {
      metadataPrerequisiteCourseCount: metadataPrerequisiteMap.size,
      metadataCorequisiteCourseCount: metadataCorequisiteMap.size,
      chainPrerequisiteCourseCount: chainPrerequisiteMap.size,
    },
  };
}

function getCoursePlanningGraphRequirementMap(
  graph: TransferPlannerCoursePlanningGraph,
  key: "prerequisiteCourseSetsByCourseCode" | "corequisiteCourseSetsByCourseCode"
) {
  return new Map(
    Object.entries(graph[key]).map(([courseCode, requirementPaths]) => [
      courseCode,
      requirementPaths.map((requirementPath) => [...requirementPath]),
    ])
  );
}

function requirementPathsAreSatisfied(
  requirementPaths: string[][],
  satisfiedCourseCodes: Set<string>
) {
  if (!requirementPaths.length) {
    return true;
  }

  return requirementPaths.some((coursePath) =>
    coursePath.every((courseCode) => satisfiedCourseCodes.has(courseCode))
  );
}

function courseHasSatisfiedPrerequisites(
  course: PendingSuggestedCourse,
  completedCourseCodes: Set<string>
) {
  return requirementPathsAreSatisfied(course.prerequisiteCourseSets, completedCourseCodes);
}

function courseHasSatisfiedCorequisites(
  course: PendingSuggestedCourse,
  completedCourseCodes: Set<string>,
  selectedCourses: PendingSuggestedCourse[]
) {
  const satisfiedCourseCodes = new Set([
    ...completedCourseCodes,
    ...selectedCourses.flatMap((selectedCourse) => selectedCourse.explicitCourseCodes),
  ]);
  return requirementPathsAreSatisfied(course.corequisiteCourseSets, satisfiedCourseCodes);
}

function courseHasSatisfiedPlanningGraph(
  course: PendingSuggestedCourse,
  completedCourseCodes: Set<string>,
  selectedCourses: PendingSuggestedCourse[]
) {
  return (
    courseHasSatisfiedPrerequisites(course, completedCourseCodes) &&
    courseHasSatisfiedCorequisites(course, completedCourseCodes, selectedCourses)
  );
}

function buildSeedCoursesForQuarter(
  seedCourses: PendingSuggestedCourse[] | undefined,
  completedCourseCodes: Set<string>
) {
  if (!seedCourses?.length) return [];

  const filtered: PendingSuggestedCourse[] = [];
  const selectedSequenceGroups = new Set<string>();
  const selectedLabelKeys = new Set<string>();

  for (const course of seedCourses) {
    const labelKey = String(course.label ?? "").trim().toLowerCase();
    const shouldEnforceUniqueLabel = course.explicitCourseCodes.length > 0;
    if (shouldEnforceUniqueLabel && selectedLabelKeys.has(labelKey)) {
      continue;
    }

    if (
      course.sequenceGroup &&
      selectedSequenceGroups.has(course.sequenceGroup)
    ) {
      continue;
    }

    if (!courseHasSatisfiedPlanningGraph(course, completedCourseCodes, filtered)) {
      continue;
    }

    filtered.push(course);
    if (shouldEnforceUniqueLabel) {
      selectedLabelKeys.add(labelKey);
    }
    if (course.sequenceGroup) {
      selectedSequenceGroups.add(course.sequenceGroup);
    }
  }

  return filtered;
}

function takeNextEligibleCourse(
  pool: PendingSuggestedCourse[],
  selectedCourses: PendingSuggestedCourse[],
  completedCourseCodes: Set<string>,
  preferredQuarterKind?: PlanningQuarterKind | null,
  isCourseAllowed?: (course: PendingSuggestedCourse) => boolean,
  getPriorityBoost?: (
    course: PendingSuggestedCourse,
    selectedCourses: PendingSuggestedCourse[]
  ) => number
) {
  const normalizedMath238Code = normalizeCourseCode("MATH 238");
  const normalizedMath254Code = normalizeCourseCode("MATH& 254");
  const normalizedPhys223Code = normalizeCourseCode("PHYS& 223");
  const includesSubjectCode = (course: PendingSuggestedCourse, subject: "MATH" | "PHYS") =>
    course.explicitCourseCodes.some((courseCode) =>
      new RegExp(`^${subject}(?:\\b|&)`, "i").test(normalizeCourseCode(courseCode))
    );
  const courseIncludesExactCode = (course: PendingSuggestedCourse, normalizedCode: string) =>
    course.explicitCourseCodes.some(
      (courseCode) => normalizeCourseCode(courseCode) === normalizedCode
    );
  const isMathOrPhysCourse = (course: PendingSuggestedCourse) =>
    includesSubjectCode(course, "MATH") || includesSubjectCode(course, "PHYS");
  const isMath238Course = (course: PendingSuggestedCourse) =>
    course.explicitCourseCodes.some(
      (courseCode) => normalizeCourseCode(courseCode) === normalizedMath238Code
    );
  const selectedHasMath254 = selectedCourses.some((course) =>
    courseIncludesExactCode(course, normalizedMath254Code)
  );
  const selectedHasPhys223 = selectedCourses.some((course) =>
    courseIncludesExactCode(course, normalizedPhys223Code)
  );
  const selectedHasMath = selectedCourses.some((course) => includesSubjectCode(course, "MATH"));
  const selectedHasPhys = selectedCourses.some((course) => includesSubjectCode(course, "PHYS"));
  const selectedMathPhysCount = selectedCourses.filter(
    (course) => isMathOrPhysCourse(course)
  ).length;
  const getMathPhysConcurrencyPenalty = (course: PendingSuggestedCourse) => {
    const isMathCourse = includesSubjectCode(course, "MATH");
    const isPhysCourse = includesSubjectCode(course, "PHYS");
    if (!isMathCourse && !isPhysCourse) return 0;
    if (isMathCourse && selectedHasPhys) return 1;
    if (isPhysCourse && selectedHasMath) return 1;
    return 0;
  };
  const getMathPhysLoadPenalty = (course: PendingSuggestedCourse) => {
    const isMathOrPhysCourse =
      includesSubjectCode(course, "MATH") || includesSubjectCode(course, "PHYS");
    if (!isMathOrPhysCourse) return 0;
    return selectedMathPhysCount >= 2 ? 1 : 0;
  };
  const getMath238EarlyPullPenalty = (course: PendingSuggestedCourse) => {
    if (!isMath238Course(course)) return 0;
    if (selectedMathPhysCount >= 2) return 0;
    return -1;
  };

  const selectedSequenceGroups = new Set(
    selectedCourses
      .map((course) => course.sequenceGroup)
      .filter((group): group is string => !!group)
  );
  const selectedLabelKeys = new Set(
    selectedCourses.map((course) => String(course.label ?? "").trim().toLowerCase())
  );

  const eligibleIndices = pool
    .map((course, index) => ({ course, index }))
    .filter(({ course }) => {
      if (isCourseAllowed && !isCourseAllowed(course)) {
        return false;
      }
      const labelKey = String(course.label ?? "").trim().toLowerCase();
      const shouldEnforceUniqueLabel = course.explicitCourseCodes.length > 0;
      if (shouldEnforceUniqueLabel && selectedLabelKeys.has(labelKey)) return false;
      if (course.sequenceGroup && selectedSequenceGroups.has(course.sequenceGroup)) return false;
      return courseHasSatisfiedPlanningGraph(course, completedCourseCodes, selectedCourses);
    });

  const preferredEligibleIndices =
    selectedMathPhysCount >= 2
      ? eligibleIndices.filter(({ course }) => !isMathOrPhysCourse(course))
      : eligibleIndices;

  const pairedCourseAvoidanceEligibleIndices = preferredEligibleIndices.filter(({ course }) => {
    const isMath254 = courseIncludesExactCode(course, normalizedMath254Code);
    const isPhys223 = courseIncludesExactCode(course, normalizedPhys223Code);
    if (selectedHasPhys223 && isMath254) return false;
    if (selectedHasMath254 && isPhys223) return false;
    return true;
  });

  const rankableEligibleIndices = pairedCourseAvoidanceEligibleIndices.length
    ? pairedCourseAvoidanceEligibleIndices
    : eligibleIndices;

  const rankedEligibleIndices = [...rankableEligibleIndices].sort((left, right) => {
    const priorityBoostDelta =
      (getPriorityBoost?.(left.course, selectedCourses) ?? 0) -
      (getPriorityBoost?.(right.course, selectedCourses) ?? 0);
    if (priorityBoostDelta !== 0) {
      return priorityBoostDelta;
    }

    const math238EarlyPullDelta =
      getMath238EarlyPullPenalty(left.course) - getMath238EarlyPullPenalty(right.course);
    if (math238EarlyPullDelta !== 0) {
      return math238EarlyPullDelta;
    }

    const mathLoadDelta =
      getMathPhysLoadPenalty(left.course) - getMathPhysLoadPenalty(right.course);
    if (mathLoadDelta !== 0) {
      return mathLoadDelta;
    }

    const mathPhysConcurrencyDelta =
      getMathPhysConcurrencyPenalty(left.course) -
      getMathPhysConcurrencyPenalty(right.course);
    if (mathPhysConcurrencyDelta !== 0) {
      return mathPhysConcurrencyDelta;
    }

    const leftAvailability = getCourseAvailabilityMatch(left.course.label, preferredQuarterKind);
    const rightAvailability = getCourseAvailabilityMatch(right.course.label, preferredQuarterKind);
    const leftUnavailable = leftAvailability === false;
    const rightUnavailable = rightAvailability === false;

    if (leftUnavailable !== rightUnavailable) {
      return Number(leftUnavailable) - Number(rightUnavailable);
    }

    const priorityDelta = left.course.priorityRank - right.course.priorityRank;
    if (priorityDelta !== 0) return priorityDelta;

    const leftAvailabilityRank = leftAvailability === true ? 0 : leftAvailability === null ? 1 : 2;
    const rightAvailabilityRank =
      rightAvailability === true ? 0 : rightAvailability === null ? 1 : 2;
    if (leftAvailabilityRank !== rightAvailabilityRank) {
      return leftAvailabilityRank - rightAvailabilityRank;
    }

    const sourceOrderDelta = left.course.sourceOrder - right.course.sourceOrder;
    if (sourceOrderDelta !== 0) return sourceOrderDelta;

    return left.index - right.index;
  });

  const nextMatch = preferredQuarterKind
    ? rankedEligibleIndices.find(
        ({ course }) =>
          getCourseAvailabilityMatch(course.label, preferredQuarterKind) !== false
      ) ?? null
    : rankedEligibleIndices[0] ?? null;
  if (!nextMatch) {
    return null;
  }

  const [course] = pool.splice(nextMatch.index, 1);
  return course ?? null;
}

function takeNextEligibleCourseFromPools(
  pools: PendingSuggestedCourse[][],
  selectedCourses: PendingSuggestedCourse[],
  completedCourseCodes: Set<string>,
  preferredQuarterKind?: PlanningQuarterKind | null,
  isCourseAllowed?: (course: PendingSuggestedCourse) => boolean,
  getPriorityBoost?: (
    course: PendingSuggestedCourse,
    selectedCourses: PendingSuggestedCourse[]
  ) => number
) {
  for (const pool of pools) {
    const nextCourse = takeNextEligibleCourse(
      pool,
      selectedCourses,
      completedCourseCodes,
      preferredQuarterKind,
      isCourseAllowed,
      getPriorityBoost
    );
    if (nextCourse) {
      return nextCourse;
    }
  }

  return null;
}

function allocateQuarterCourses({
  seedCourses,
  essentialCorePool,
  essentialElectivePool,
  optionalCorePool,
  optionalElectivePool,
  fillerPool,
  completedCourseCodes,
  preferredQuarterKind,
  includeSummerQuarter,
}: {
  seedCourses?: PendingSuggestedCourse[];
  essentialCorePool: PendingSuggestedCourse[];
  essentialElectivePool: PendingSuggestedCourse[];
  optionalCorePool: PendingSuggestedCourse[];
  optionalElectivePool: PendingSuggestedCourse[];
  fillerPool: PendingSuggestedCourse[];
  completedCourseCodes: Set<string>;
  preferredQuarterKind?: PlanningQuarterKind | null;
  includeSummerQuarter?: boolean;
}) {
  const courses = [...buildSeedCoursesForQuarter(seedCourses, completedCourseCodes)];
  const quarterCourseCap = preferredQuarterKind === "Summer" ? 1 : 3;
  const isEnglishGeneralEducationCourse = (course: PendingSuggestedCourse) =>
    course.explicitCourseCodes.some((courseCode) => /^ENGL(?:\b|&)/i.test(normalizeCourseCode(courseCode)));
  const isMainPlannedCourse = (course: PendingSuggestedCourse) =>
    course.explicitCourseCodes.length > 0 && !isEnglishGeneralEducationCourse(course);
  const getMainCourseCount = (items: PendingSuggestedCourse[]) =>
    items.filter((item) => isMainPlannedCourse(item)).length;
  const getPlaceholderCount = (items: PendingSuggestedCourse[]) =>
    items.filter((item) => item.explicitCourseCodes.length === 0).length;
  const getGenEdLikeCount = (items: PendingSuggestedCourse[]) =>
    getPlaceholderCount(items) + items.filter((item) => isEnglishGeneralEducationCourse(item)).length;
  const shouldBlendFillerThisQuarter = !seedCourses?.length && fillerPool.length > 0;
  const mainCourseTarget = shouldBlendFillerThisQuarter ? 2 : 3;
  const getMainCourseTarget = () => mainCourseTarget;
  const getNextQuarterKind = (kind: PlanningQuarterKind) => {
    switch (kind) {
      case "Winter":
        return "Spring" as const;
      case "Spring":
        return "Summer" as const;
      case "Summer":
        return "Fall" as const;
      case "Fall":
        return "Winter" as const;
    }
  };
  const getTermLimitedRequiredUrgencyPriorityBoost = (course: PendingSuggestedCourse) => {
    if (!course.explicitCourseCodes.length) {
      return 0;
    }
    if (!preferredQuarterKind) {
      return 0;
    }

    const currentAvailabilityQuarter = getAvailabilityQuarterForPlanningKind(preferredQuarterKind);
    const nextQuarterKind = getNextQuarterKind(preferredQuarterKind);
    const secondNextQuarterKind = getNextQuarterKind(nextQuarterKind);
    const nextAvailabilityQuarter = getAvailabilityQuarterForPlanningKind(nextQuarterKind);
    const secondNextAvailabilityQuarter = getAvailabilityQuarterForPlanningKind(secondNextQuarterKind);

    let urgencyScore = 0;
    for (const courseCode of course.explicitCourseCodes) {
      const latestPublishedQuarters = getTransferPlannerGrcCourseLatestPublishedQuarters(courseCode);
      if (!latestPublishedQuarters?.length) {
        continue;
      }
      if (!latestPublishedQuarters.includes(currentAvailabilityQuarter)) {
        continue;
      }

      if (latestPublishedQuarters.length === 1) {
        urgencyScore += 3;
        continue;
      }

      const availableNextQuarter = latestPublishedQuarters.includes(nextAvailabilityQuarter);
      const availableSecondNextQuarter = latestPublishedQuarters.includes(secondNextAvailabilityQuarter);

      if (!availableNextQuarter && !availableSecondNextQuarter) {
        urgencyScore += 2;
      } else if (!availableNextQuarter) {
        urgencyScore += 1;
      }
    }

    return urgencyScore > 0 ? -urgencyScore : 0;
  };
  const getCourseMajorDependencyUnlockPriorityBoost = (
    course: PendingSuggestedCourse,
    selectedCourses: PendingSuggestedCourse[]
  ) => {
    if (!course.explicitCourseCodes.length) {
      return 0;
    }

    const courseCodes = new Set(
      course.explicitCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
    );
    if (!courseCodes.size) {
      return 0;
    }

    const pendingMainCourseCodes = new Set(
      [
        ...essentialCorePool,
        ...essentialElectivePool,
        ...optionalCorePool,
        ...optionalElectivePool,
      ]
        .flatMap((entry) => entry.explicitCourseCodes)
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean)
    );

    const currentlySatisfiedCodes = new Set(
      [
        ...completedCourseCodes,
        ...selectedCourses.flatMap((selectedCourse) => selectedCourse.explicitCourseCodes),
      ]
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean)
    );
    const satisfiedWithCandidateCodes = new Set([
      ...currentlySatisfiedCodes,
      ...courseCodes,
    ]);

    let unlockPriorityScore = 0;
    for (const pendingCourseCode of pendingMainCourseCodes) {
      if (courseCodes.has(pendingCourseCode)) {
        continue;
      }

      const pendingCourse = getTransferPlannerCanonicalCourse("grc", pendingCourseCode);
      if (!pendingCourse) {
        continue;
      }

      const requirementCodes = unique(
        [
          ...(pendingCourse.prerequisiteCourseCodes ?? []),
          ...(pendingCourse.prerequisiteAlternativeCourseCodeSets ?? []).flat(),
          ...(pendingCourse.corequisiteCourseCodes ?? []),
          ...(pendingCourse.corequisiteAlternativeCourseCodeSets ?? []).flat(),
        ]
          .map((courseCode) => normalizeCourseCode(courseCode))
          .filter(Boolean)
      );

      if (!requirementCodes.length) {
        continue;
      }

      const missingBefore = requirementCodes.filter(
        (courseCode) => !currentlySatisfiedCodes.has(courseCode)
      ).length;
      const missingAfter = requirementCodes.filter(
        (courseCode) => !satisfiedWithCandidateCodes.has(courseCode)
      ).length;
      if (missingAfter >= missingBefore) {
        continue;
      }

      const requirementReduction = Math.max(1, missingBefore - missingAfter);
      {
        const dependentAvailability = getTransferPlannerGrcCourseLatestPublishedQuarters(
          pendingCourseCode
        );
        const nonSummerOfferingCount = new Set(
          (dependentAvailability ?? []).filter((quarter) => quarter !== "summer")
        ).size;
        const hasSummerOffering = (dependentAvailability ?? []).includes("summer");
        const scarcityWeight =
          nonSummerOfferingCount <= 1
            ? 3
            : nonSummerOfferingCount === 2
              ? 2
              : 1;
        const adjustedScarcityWeight =
          includeSummerQuarter && hasSummerOffering
            ? Math.max(1, scarcityWeight - 1)
            : scarcityWeight;
        const newlyEligibleBonus = missingAfter === 0 ? 1 : 0;
        unlockPriorityScore += adjustedScarcityWeight * requirementReduction + newlyEligibleBonus;
      }
    }

    return unlockPriorityScore > 0 ? -unlockPriorityScore : 0;
  };
  const getMainCoursePriorityBoost = (
    course: PendingSuggestedCourse,
    selectedCourses: PendingSuggestedCourse[]
  ) =>
    getCourseMajorDependencyUnlockPriorityBoost(course, selectedCourses) +
    getTermLimitedRequiredUrgencyPriorityBoost(course);

  if (courses.length >= quarterCourseCap) {
    return courses.map<SuggestedQuarterCourse>(({ label, type, status, guidanceSummary }) => ({
      label,
      type,
      status,
      guidanceSummary,
      availabilitySummary: getTransferPlannerGrcCourseAvailabilitySummary(label),
    }));
  }

  const hasCoreCourse = courses.some((course) => course.type === "core");

  if (!hasCoreCourse && essentialCorePool.length) {
    const nextCore = takeNextEligibleCourse(
      essentialCorePool,
      courses,
      completedCourseCodes,
      preferredQuarterKind,
      undefined,
      getMainCoursePriorityBoost
    );
    if (nextCore) {
      courses.push(nextCore);
    }
  }

  while (courses.length < quarterCourseCap && getMainCourseCount(courses) < getMainCourseTarget()) {
    const nextEssential = takeNextEligibleCourseFromPools(
      [essentialCorePool, essentialElectivePool],
      courses,
      completedCourseCodes,
      preferredQuarterKind,
      (course) => isMainPlannedCourse(course),
      getMainCoursePriorityBoost
    );
    if (!nextEssential) break;
    courses.push(nextEssential);
  }

  while (courses.length < quarterCourseCap) {
    const nextRequiredEnglishGenEd = takeNextEligibleCourseFromPools(
      [essentialElectivePool, essentialCorePool],
      courses,
      completedCourseCodes,
      preferredQuarterKind,
      (course) => isEnglishGeneralEducationCourse(course),
      getMainCoursePriorityBoost
    );
    if (!nextRequiredEnglishGenEd) break;
    courses.push(nextRequiredEnglishGenEd);
  }

  while (courses.length < quarterCourseCap && getMainCourseCount(courses) < getMainCourseTarget()) {
    const nextOptional = takeNextEligibleCourseFromPools(
      [optionalCorePool, optionalElectivePool],
      courses,
      completedCourseCodes,
      preferredQuarterKind,
      (course) => isMainPlannedCourse(course),
      getMainCoursePriorityBoost
    );
    if (!nextOptional) break;
    courses.push(nextOptional);
  }

  const preferredGenEdLikeCount = shouldBlendFillerThisQuarter ? 1 : 0;

  while (
    courses.length < quarterCourseCap &&
    shouldBlendFillerThisQuarter &&
    getGenEdLikeCount(courses) < preferredGenEdLikeCount
  ) {
    const nextEnglishGenEd = takeNextEligibleCourseFromPools(
      [essentialElectivePool, optionalElectivePool, essentialCorePool, optionalCorePool],
      courses,
      completedCourseCodes,
      preferredQuarterKind,
      (course) => isEnglishGeneralEducationCourse(course),
      getMainCoursePriorityBoost
    );
    if (nextEnglishGenEd) {
      courses.push(nextEnglishGenEd);
      continue;
    }

    if (!fillerPool.length) {
      break;
    }

    const nextFiller = takeNextEligibleCourse(
      fillerPool,
      courses,
      completedCourseCodes,
      preferredQuarterKind
    );
    if (!nextFiller) break;
    courses.push(nextFiller);
  }

  const maxMainCourseCount = 3;

  while (courses.length < quarterCourseCap && getMainCourseCount(courses) < maxMainCourseCount) {
    const nextRemainingNonPlaceholder = takeNextEligibleCourseFromPools(
      [essentialCorePool, essentialElectivePool, optionalCorePool, optionalElectivePool],
      courses,
      completedCourseCodes,
      preferredQuarterKind,
      (course) => isMainPlannedCourse(course),
      getMainCoursePriorityBoost
    );
    if (!nextRemainingNonPlaceholder) break;
    courses.push(nextRemainingNonPlaceholder);
  }

  while (courses.length < quarterCourseCap) {
    const nextRemainingEnglishGenEd = takeNextEligibleCourseFromPools(
      [essentialElectivePool, optionalElectivePool, essentialCorePool, optionalCorePool],
      courses,
      completedCourseCodes,
      preferredQuarterKind,
      (course) => isEnglishGeneralEducationCourse(course),
      getMainCoursePriorityBoost
    );
    if (!nextRemainingEnglishGenEd) break;
    courses.push(nextRemainingEnglishGenEd);
  }

  while (courses.length < quarterCourseCap && fillerPool.length) {
    const nextRemainingFiller = takeNextEligibleCourse(
      fillerPool,
      courses,
      completedCourseCodes,
      preferredQuarterKind
    );
    if (!nextRemainingFiller) break;
    courses.push(nextRemainingFiller);
  }

  return courses.map<SuggestedQuarterCourse>(({ label, type, status, guidanceSummary }) => ({
    label,
    type,
    status,
    guidanceSummary,
    availabilitySummary: getTransferPlannerGrcCourseAvailabilitySummary(label),
  }));
}

function hasPendingQuarterPlanCourses(pools: PendingSuggestedCourse[][]) {
  return pools.some((pool) => pool.length > 0);
}

function recordPlannedQuarterCourseCodes(
  courses: SuggestedQuarterCourse[],
  completedCourseCodes: Set<string>
) {
  for (const course of courses) {
    for (const courseCode of extractCourseCodes(course.label)) {
      completedCourseCodes.add(courseCode);
    }
  }
}

function buildRemainingSuggestedCourses(
  sections: {
    bucket: RequirementPriorityBucket;
    statuses: TransferRequirementStatus[];
  }[],
  prerequisiteCourseMap: Map<string, string[][]>,
  corequisiteCourseMap: Map<string, string[][]>
) {
  const remainingByLabel = new Map<string, PendingSuggestedCourse>();
  let sourceOrder = 0;

  for (const section of sections) {
    for (const status of section.statuses.filter((entry) => !entry.matched)) {
      const matchedCodes = new Set(status.matchedCourses.map((course) => course.code));
      const missingExplicitCodes = status.explicitCourseCodes.filter(
        (code) => !matchedCodes.has(code)
      );
      const remainingNeeded =
        status.requiredCompletedCount < status.explicitCourseCodes.length
          ? Math.max(1, status.requiredCompletedCount - status.matchedCourses.length)
          : status.explicitCourseCodes.length;
      const labelsToSchedule = !missingExplicitCodes.length
        ? [status.item.grcCourses[0] ?? status.item.title]
        : status.requiredCompletedCount < status.explicitCourseCodes.length
          ? missingExplicitCodes.slice(0, remainingNeeded)
          : missingExplicitCodes;
      const shouldSequenceCourses =
        status.requiredCompletedCount === status.explicitCourseCodes.length &&
        status.explicitCourseCodes.length > 1;
      const shouldScheduleAsChoiceBucket =
        status.requiredCompletedCount > 0 &&
        status.requiredCompletedCount < status.explicitCourseCodes.length;
      const guidanceSummary = buildChecklistGuidanceSummary(section.bucket, status.item);

      const labelsForPlanner = shouldScheduleAsChoiceBucket
        ? [
            buildChecklistChoiceLabel(
              status.item,
              remainingNeeded,
              status.matchedCourses.length
            ),
          ]
        : labelsToSchedule;

      for (const label of labelsForPlanner) {
        const nextCourse: PendingSuggestedCourse = {
          label,
          type: isCoreCourseLabel(
            shouldScheduleAsChoiceBucket
              ? `${status.item.title} ${getChecklistChoiceLabels(status.item).join(" ")}`
              : label
          )
            ? "core"
            : "elective",
          status: "planned",
          guidanceSummary: shouldScheduleAsChoiceBucket
            ? buildChecklistChoiceGuidanceSummary(
                status.item,
                remainingNeeded,
                status.matchedCourses.length,
                guidanceSummary
              )
            : guidanceSummary,
          sequenceGroup: shouldSequenceCourses ? status.item.id : null,
          priorityRank: REQUIREMENT_PRIORITY_RANK[section.bucket],
          sourceOrder,
          explicitCourseCodes: shouldScheduleAsChoiceBucket ? [] : extractCourseCodes(label),
          prerequisiteCourseSets: unique(
            (shouldScheduleAsChoiceBucket ? [] : extractCourseCodes(label)).flatMap(
              (courseCode) => prerequisiteCourseMap.get(courseCode) ?? []
            )
          ).map((courseSet) => [...courseSet]),
          corequisiteCourseSets: unique(
            (shouldScheduleAsChoiceBucket ? [] : extractCourseCodes(label)).flatMap(
              (courseCode) => corequisiteCourseMap.get(courseCode) ?? []
            )
          ).map((courseSet) => [...courseSet]),
        };

        sourceOrder += 1;

        const existing = remainingByLabel.get(label);
        if (
          existing &&
          (
            existing.priorityRank < nextCourse.priorityRank ||
            (
              existing.priorityRank === nextCourse.priorityRank &&
              existing.sourceOrder <= nextCourse.sourceOrder
            )
          )
        ) {
          continue;
        }

        remainingByLabel.set(label, nextCourse);
      }
    }
  }

  return [...remainingByLabel.values()].sort((left, right) => {
    const priorityDelta = left.priorityRank - right.priorityRank;
    if (priorityDelta !== 0) return priorityDelta;

    const sourceOrderDelta = left.sourceOrder - right.sourceOrder;
    if (sourceOrderDelta !== 0) return sourceOrderDelta;

    return left.label.localeCompare(right.label);
  });
}

function buildPrerequisiteDependencyCoursesForEssentialPlan(
  essentialCourses: PendingSuggestedCourse[],
  candidateDependencyCourses: PendingSuggestedCourse[],
  completedCourseCodes: Set<string>
) {
  const candidateByCode = new Map<string, PendingSuggestedCourse>();
  for (const course of candidateDependencyCourses) {
    for (const courseCode of course.explicitCourseCodes) {
      if (!candidateByCode.has(courseCode)) {
        candidateByCode.set(courseCode, course);
      }
    }
  }

  const selectedByLabel = new Map<string, PendingSuggestedCourse>();
  const selectedCourseCodes = new Set<string>();
  const coursesToInspect = [...essentialCourses];

  for (let index = 0; index < coursesToInspect.length; index += 1) {
    const course = coursesToInspect[index];
    if (!course) continue;

    for (const requirementPaths of [
      course.prerequisiteCourseSets,
      course.corequisiteCourseSets,
    ]) {
      const selectedPath =
        requirementPaths.find((path) =>
          path.every((courseCode) => completedCourseCodes.has(courseCode))
        ) ??
        requirementPaths.find((path) =>
          path.every((courseCode) => completedCourseCodes.has(courseCode) || candidateByCode.has(courseCode))
        ) ??
        requirementPaths.find((path) => path.some((courseCode) => candidateByCode.has(courseCode))) ??
        null;
      if (!selectedPath) continue;

      for (const courseCode of selectedPath) {
        if (completedCourseCodes.has(courseCode) || selectedCourseCodes.has(courseCode)) {
          continue;
        }

        const dependencyCourse = candidateByCode.get(courseCode);
        if (!dependencyCourse || selectedByLabel.has(dependencyCourse.label)) {
          continue;
        }

        const promotedDependencyCourse: PendingSuggestedCourse = {
          ...dependencyCourse,
          priorityRank: Math.min(
            dependencyCourse.priorityRank,
            REQUIREMENT_PRIORITY_RANK.beforeEnrollment
          ),
        };
        selectedByLabel.set(promotedDependencyCourse.label, promotedDependencyCourse);
        for (const explicitCourseCode of promotedDependencyCourse.explicitCourseCodes) {
          selectedCourseCodes.add(explicitCourseCode);
        }
        coursesToInspect.push(promotedDependencyCourse);
      }
    }
  }

  return [...selectedByLabel.values()];
}

function attachAutomaticPrerequisiteGuidance(courses: PendingSuggestedCourse[]) {
  const dependentLabelsByPrerequisiteCode = new Map<string, string[]>();
  const dependentLabelsByCorequisiteCode = new Map<string, string[]>();
  const requiredPriorityThreshold = REQUIREMENT_PRIORITY_RANK.stayAtGrc;

  for (const course of courses) {
    if (course.priorityRank >= requiredPriorityThreshold) {
      continue;
    }

    const prerequisiteCodes = unique(course.prerequisiteCourseSets.flat());

    for (const prerequisiteCode of prerequisiteCodes) {
      const existingLabels = dependentLabelsByPrerequisiteCode.get(prerequisiteCode) ?? [];
      if (!existingLabels.includes(course.label)) {
        existingLabels.push(course.label);
      }
      dependentLabelsByPrerequisiteCode.set(prerequisiteCode, existingLabels);
    }

    const corequisiteCodes = unique(course.corequisiteCourseSets.flat());
    for (const corequisiteCode of corequisiteCodes) {
      const existingLabels = dependentLabelsByCorequisiteCode.get(corequisiteCode) ?? [];
      if (!existingLabels.includes(course.label)) {
        existingLabels.push(course.label);
      }
      dependentLabelsByCorequisiteCode.set(corequisiteCode, existingLabels);
    }
  }

  return courses.map<PendingSuggestedCourse>((course) => {
    const dependentPrerequisiteLabels = unique(
      course.explicitCourseCodes.flatMap(
        (courseCode) => dependentLabelsByPrerequisiteCode.get(courseCode) ?? []
      )
    ).filter((label) => label !== course.label);
    const dependentCorequisiteLabels = unique(
      course.explicitCourseCodes.flatMap(
        (courseCode) => dependentLabelsByCorequisiteCode.get(courseCode) ?? []
      )
    ).filter((label) => label !== course.label);
    const prerequisiteGuidanceSummary = buildDependencyGuidanceSummary({
      prerequisiteLabels: dependentPrerequisiteLabels,
      corequisiteLabels: dependentCorequisiteLabels,
    });
    const guidanceSummary =
      String(course.guidanceSummary ?? "").trim() === REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE
        ? course.guidanceSummary
        : joinGuidanceSummaries(prerequisiteGuidanceSummary, course.guidanceSummary);

    if (guidanceSummary === course.guidanceSummary) {
      return course;
    }

    return {
      ...course,
      guidanceSummary,
    };
  });
}

function attachAutomaticTransferEquivalencyGuidance(
  courses: PendingSuggestedCourse[],
  campusId: TransferPlannerMajorPlan["campusId"] | null | undefined,
  satisfiedCourseCodes: Set<string> | string[] = []
) {
  if (!campusId) {
    return courses;
  }

  const normalizedSatisfiedCourseCodes = [...satisfiedCourseCodes]
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter(Boolean);

  return courses.map<PendingSuggestedCourse>((course) => {
    const transferGuidanceSummary = buildTransferEquivalencyGuidanceSummary(
      course.explicitCourseCodes,
      campusId,
      { satisfiedCourseCodes: normalizedSatisfiedCourseCodes }
    );
    const guidanceSummary = joinGuidanceSummaries(
      transferGuidanceSummary,
      course.guidanceSummary
    );

    if (guidanceSummary === course.guidanceSummary) {
      return course;
    }

    return {
      ...course,
      guidanceSummary,
    };
  });
}

export function buildSuggestedQuarterPlan(input: {
  plan?: TransferPlannerMajorPlan | null;
  applicationStatuses: TransferRequirementStatus[];
  beforeEnrollmentStatuses: TransferRequirementStatus[];
  stayAtGrcStatuses: TransferRequirementStatus[];
  completedCourses: TranscriptCourseEntry[];
  track: TransferPlannerTrack | null;
  currentCourseLabels?: string[];
  referenceDate?: Date;
  includeStayAtGrcCourses?: boolean;
  includeSummerQuarter?: boolean;
}) {
  const includeSummerQuarter = input.includeSummerQuarter === true;
  const applicationStatuses = input.applicationStatuses;
  const sourceBackedRequiredCourseFallbackStatuses =
    buildSourceBackedRequiredCourseFallbackStatuses({
      plan: input.plan,
      existingStatuses:
        input.includeStayAtGrcCourses === false
          ? [...input.applicationStatuses, ...input.beforeEnrollmentStatuses]
          : [
              ...input.applicationStatuses,
              ...input.beforeEnrollmentStatuses,
              ...input.stayAtGrcStatuses,
            ],
      completedCourses: input.completedCourses,
    });
  const beforeEnrollmentStatuses = [
    ...input.beforeEnrollmentStatuses,
    ...sourceBackedRequiredCourseFallbackStatuses,
  ];
  const stayAtGrcStatuses = input.stayAtGrcStatuses;
  const selectedCurrentCourseLabels = new Set(
    unique(
      (input.currentCourseLabels ?? [])
        .map((label) => String(label ?? "").trim())
        .filter(Boolean)
    )
  );
  const completedCourseCodes = new Set(input.completedCourses.map((course) => course.code));
  const checklistCourseCodes = new Set(
    [
      ...applicationStatuses,
      ...beforeEnrollmentStatuses,
      ...stayAtGrcStatuses,
    ].flatMap((status) => status.explicitCourseCodes)
  );
  const trackSupplementalCoveredCourseCodes = new Set([
    ...checklistCourseCodes,
    ...[
      ...applicationStatuses,
      ...beforeEnrollmentStatuses,
      ...stayAtGrcStatuses,
    ]
      .filter((status) => status.matched)
      .flatMap((status) =>
        getChecklistCourseOptions(status.item).flatMap((courseLabels) =>
          courseLabels.flatMap((label) => extractCourseCodes(label))
        )
      ),
  ]);
  const resolvedTrackSupplementalCourseLabels = getResolvedTrackSupplementalCourseLabels({
    track: input.track,
    completedCourses: input.completedCourses,
    completedCourseCodes,
    coveredCourseCodes: trackSupplementalCoveredCourseCodes,
    referenceDate: input.referenceDate,
  });
  const actionableCourseCodes = new Set([
    ...checklistCourseCodes,
    ...resolvedTrackSupplementalCourseLabels.flatMap((label) => extractCourseCodes(label)),
  ]);
  const planningGraph = buildTransferPlannerCoursePlanningGraph({
    plan: input.plan,
    actionableCourseCodes,
  });
  const prerequisiteCourseMap = getCoursePlanningGraphRequirementMap(
    planningGraph,
    "prerequisiteCourseSetsByCourseCode"
  );
  const corequisiteCourseMap = getCoursePlanningGraphRequirementMap(
    planningGraph,
    "corequisiteCourseSetsByCourseCode"
  );

  const essentialRemainingCourses = buildRemainingSuggestedCourses([
    {
      bucket: "application",
      statuses: applicationStatuses,
    },
    {
      bucket: "beforeEnrollment",
      statuses: beforeEnrollmentStatuses,
    },
  ], prerequisiteCourseMap, corequisiteCourseMap);
  const stayAtGrcRemainingCourses = buildRemainingSuggestedCourses([
    {
      bucket: "stayAtGrc",
      statuses: stayAtGrcStatuses,
    },
  ], prerequisiteCourseMap, corequisiteCourseMap);
  const trackSupplementalCourses = buildTrackSupplementalSuggestedCourses({
    track: input.track,
    courseLabels: resolvedTrackSupplementalCourseLabels,
    prerequisiteCourseMap,
    corequisiteCourseMap,
    sourceOrderStart: essentialRemainingCourses.length + stayAtGrcRemainingCourses.length,
  });
  const essentialDependencyCourses = buildPrerequisiteDependencyCoursesForEssentialPlan(
    essentialRemainingCourses,
    [...stayAtGrcRemainingCourses, ...trackSupplementalCourses],
    completedCourseCodes
  );
  const remainingCourses =
    input.includeStayAtGrcCourses === false
      ? [...essentialRemainingCourses, ...essentialDependencyCourses]
      : [
          ...buildRemainingSuggestedCourses([
            {
              bucket: "application",
              statuses: applicationStatuses,
            },
            {
              bucket: "beforeEnrollment",
              statuses: beforeEnrollmentStatuses,
            },
            {
              bucket: "stayAtGrc",
              statuses: stayAtGrcStatuses,
            },
          ], prerequisiteCourseMap, corequisiteCourseMap),
          ...trackSupplementalCourses,
        ];
  const guidedRemainingCourses = attachAutomaticPrerequisiteGuidance(
    attachAutomaticTransferEquivalencyGuidance(
      remainingCourses,
      input.plan?.campusId,
      completedCourseCodes
    )
  );
  const completedQuarterPlans = buildCompletedQuarterPlans(input.completedCourses, {
    campusId: input.plan?.campusId,
    plan: input.plan,
    requirementStatuses: [
      ...applicationStatuses,
      ...beforeEnrollmentStatuses,
      ...stayAtGrcStatuses,
    ],
  });
  const currentQuarterCourses = guidedRemainingCourses
    .filter((course) => selectedCurrentCourseLabels.has(course.label))
    .map<PendingSuggestedCourse>((course) => ({
      ...course,
      status: "current",
    }));
  const currentQuarterSlot = currentQuarterCourses.length
    ? getCurrentOrNextQuarterSlot(input.referenceDate, includeSummerQuarter)
    : null;
  const guidedCoursesStillToPlan = guidedRemainingCourses.filter(
    (course) => !selectedCurrentCourseLabels.has(course.label)
  );

  const essentialCorePool = guidedCoursesStillToPlan
    .filter((course) => isCoreCourseLabel(course.label))
    .filter((course) => course.priorityRank < REQUIREMENT_PRIORITY_RANK.stayAtGrc)
    .map<PendingSuggestedCourse>((course) => ({
      ...course,
      type: "core",
      status: "planned",
    }));
  const essentialElectivePool = guidedCoursesStillToPlan
    .filter((course) => !isCoreCourseLabel(course.label))
    .filter((course) => course.priorityRank < REQUIREMENT_PRIORITY_RANK.stayAtGrc)
    .map<PendingSuggestedCourse>((course) => ({
      ...course,
      type: "elective",
      status: "planned",
    }));
  const optionalCorePool = guidedCoursesStillToPlan
    .filter((course) => isCoreCourseLabel(course.label))
    .filter((course) => course.priorityRank >= REQUIREMENT_PRIORITY_RANK.stayAtGrc)
    .map<PendingSuggestedCourse>((course) => ({
      ...course,
      type: "core",
      status: "planned",
    }));
  const optionalElectivePool = guidedCoursesStillToPlan
    .filter((course) => !isCoreCourseLabel(course.label))
    .filter((course) => course.priorityRank >= REQUIREMENT_PRIORITY_RANK.stayAtGrc)
    .map<PendingSuggestedCourse>((course) => ({
      ...course,
      type: "elective",
      status: "planned",
    }));
  const completedGeneralEducationCreditProgress = getCompletedGeneralEducationCreditProgress({
    completedCourses: input.completedCourses,
    campusId: input.plan?.campusId,
  });
  const fillerPlaceholderEntries = buildGeneralEducationPlaceholders({
    track: input.track,
    completedCourses: input.completedCourses,
    referenceDate: input.referenceDate,
    plan: input.plan,
    includePlannerGuidancePlaceholders: input.includeStayAtGrcCourses !== false,
  });
  const hasExplicitRemainingPlannerCourses = guidedCoursesStillToPlan.some(
    (course) => course.explicitCourseCodes.length > 0
  );
  const shouldSuppressGeneralEducationOnlyFiller =
    !!input.plan &&
    !hasExplicitRemainingPlannerCourses &&
    getTransferPlannerGrcCourseList(input.plan).length === 0;
  const fillerPool =
    (input.includeStayAtGrcCourses === false && !input.plan) ||
    shouldSuppressGeneralEducationOnlyFiller
      ? []
      : fillerPlaceholderEntries.map<PendingSuggestedCourse>(
          (placeholderEntry, placeholderIndex, placeholderEntries) => {
            const scopedPlaceholderEntries = placeholderEntries.filter(
              (candidate) => candidate.sourceKind === placeholderEntry.sourceKind
            );
            const scopedPlaceholderIndex =
              placeholderEntries
                .slice(0, placeholderIndex + 1)
                .filter((candidate) => candidate.sourceKind === placeholderEntry.sourceKind)
                .length - 1;
            const scopedPlaceholders = scopedPlaceholderEntries.map(
              (candidate) => candidate.placeholder
            );
            const guidanceSummary =
              placeholderEntry.sourceKind === "planner-guidance"
                ? buildTrackGeneralEducationPlaceholderGuidanceSummary({
                    placeholder: placeholderEntry.placeholder,
                    placeholderIndex: scopedPlaceholderIndex,
                    placeholders: scopedPlaceholders,
                    plan: input.plan,
                    completedCreditProgress: completedGeneralEducationCreditProgress,
                  })
                : buildSourceBackedMajorGeneralEducationPlaceholderGuidanceSummary({
                    placeholder: placeholderEntry.placeholder,
                    placeholderIndex: scopedPlaceholderIndex,
                    placeholders: scopedPlaceholders,
                    plan: input.plan,
                    completedCreditProgress: completedGeneralEducationCreditProgress,
                  });

            return {
              label: placeholderEntry.placeholder.label,
              type: "elective",
              status: "planned",
              guidanceSummary,
              sequenceGroup: null,
              priorityRank: REQUIREMENT_PRIORITY_RANK.stayAtGrc + 1,
              sourceOrder: Number.MAX_SAFE_INTEGER,
              explicitCourseCodes: [],
              prerequisiteCourseSets: [],
              corequisiteCourseSets: [],
            };
          }
        );
  const currentQuarterPlan = currentQuarterCourses.length
    ? {
        label: currentQuarterSlot?.label ?? "Current / In progress",
        phase: "current" as const,
        courses: allocateQuarterCourses({
          seedCourses: currentQuarterCourses,
          essentialCorePool,
          essentialElectivePool,
          optionalCorePool,
          optionalElectivePool,
          fillerPool,
          completedCourseCodes,
          preferredQuarterKind: currentQuarterSlot?.kind ?? null,
          includeSummerQuarter,
        }),
      }
    : null;

  const planningPools = [
    essentialCorePool,
    essentialElectivePool,
    optionalCorePool,
    optionalElectivePool,
    fillerPool,
  ];
  const hasPendingFutureCourses = hasPendingQuarterPlanCourses(planningPools);
  const futureQuarterPlans: SuggestedQuarterPlan[] = [];
  const shouldShowEmptyPlanningShell =
    !hasPendingFutureCourses && !completedQuarterPlans.length && !currentQuarterCourses.length;
  if (hasPendingFutureCourses || shouldShowEmptyPlanningShell) {
    const [firstFutureQuarterSlot] = currentQuarterSlot
      ? buildQuarterSlotsAfterCurrent(input.referenceDate, includeSummerQuarter)
      : buildQuarterSlots(input.referenceDate, includeSummerQuarter);
    let slot = firstFutureQuarterSlot ?? null;
    let consecutiveEmptyQuarterCount = 0;
    let generatedQuarterCount = 0;

    while (
      slot &&
      generatedQuarterCount < MAX_AUTOMATIC_PLANNED_QUARTERS_WITH_GEN_ED_EXTENSION &&
      (
        generatedQuarterCount < MAX_AUTOMATIC_PLANNED_QUARTERS ||
        fillerPool.length > 0
      )
    ) {
      const courses = allocateQuarterCourses({
        essentialCorePool,
        essentialElectivePool,
        optionalCorePool,
        optionalElectivePool,
        fillerPool,
        completedCourseCodes,
        preferredQuarterKind: slot.kind,
        includeSummerQuarter,
      });

      generatedQuarterCount += 1;

      if (courses.length) {
        futureQuarterPlans.push({
          label: slot.label,
          phase: "planned",
          courses,
        });
        recordPlannedQuarterCourseCodes(courses, completedCourseCodes);
        consecutiveEmptyQuarterCount = 0;
      } else {
        consecutiveEmptyQuarterCount += 1;
      }

      if (!hasPendingQuarterPlanCourses(planningPools)) {
        break;
      }

      if (consecutiveEmptyQuarterCount >= PLANNING_NO_PROGRESS_QUARTER_LIMIT) {
        break;
      }

      slot = getNextPlannedQuarterSlot(slot, includeSummerQuarter);
    }

    if (!futureQuarterPlans.length && shouldShowEmptyPlanningShell && firstFutureQuarterSlot) {
      futureQuarterPlans.push({
        label: firstFutureQuarterSlot.label,
        phase: "planned",
        courses: [],
      });
    }
  }

  return [
    ...completedQuarterPlans,
    ...(currentQuarterPlan ? [currentQuarterPlan] : []),
    ...futureQuarterPlans,
  ];
}
