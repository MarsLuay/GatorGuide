import {
  extractTransferPlannerCourseCodes,
  getTransferPlannerCanonicalCourse,
  getTransferPlannerGrcCourseAvailabilitySummary,
  getTransferPlannerGrcCourseList,
  getTransferPlannerGrcCourseLatestPublishedQuarters,
  getTransferPlannerEquivalencyRulesForSourceCourse,
  getTransferPlannerMajorPlan,
  getTransferPlannerParsedRequirementSourceBlocks,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  normalizeTransferPlannerCourseCode,
  resolveTransferPlannerMajorPlan,
  TRANSFER_PLANNER_SOURCE_GAP_REGISTRY,
  TransferPlannerChecklistItem,
  TransferPlannerCampusId,
  TransferPlannerGeneralRequirementSection,
  TransferPlannerGeneralRequirementSourceKind,
  TransferPlannerEquivalencyRule,
  TransferPlannerMajorPlan,
  TransferPlannerRequirementType,
  TransferPlannerStudentCourseEvaluation,
  TransferPlannerTrack,
} from "@/constants/transfer-planner-source/student-runtime";
const COURSE_CODE_PATTERN = /\b[A-Z]{2,6}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;
const SOURCE_BACKED_UW_COURSE_WITH_CONTINUATION_PATTERN =
  /\b([A-Z]{2,6}&?)\s*(\d{3}(?:\.\d+)?[A-Z]?)\b/g;
const SOURCE_BACKED_UW_COURSE_NUMBER_CONTINUATION_PATTERN =
  /(?:^|[,(;/]\s*|\b(?:or|and)\s+)(\d{3}(?:\.\d+)?[A-Z]?)(?=$|[\s,);/]|(?:\s*(?:or|and)\b))/gi;
const GUIDE_BACKED_EQUIVALENCY_RULE_SOURCE_KINDS = new Set([
  "uw-green-river-equivalency-guide",
  "uw-green-river-equivalency-guide-derived",
]);
const CHECKLIST_CHOICE_PREVIEW_LIMIT = 8;
const SOURCE_BACKED_REQUIRED_COURSE_NON_REQUIREMENT_CUE_PATTERN =
  /\b(approved list|not required for transferring|elective|replacement|course list|course lists|course evaluation|course evaluations|recommended|suggested|consider|first year students|suggested general education|suggested course pathways?|choose\s+(?:one|[0-9]+)|one\s+of|select(?:ed|ing)?|\d+\s+credits?\s+from|minimum\s+\d+\s+credits?[^.]{0,80}\bfrom)\b/i;
const SOURCE_BACKED_REQUIRED_COURSE_SEMANTIC_RELATION_PATTERN =
  /\bCourse (?:equivalent to|overlaps with):\s*([^.]*)/gi;
type TransferPlannerSelectedCollegeId = "grc" | "uw";

export type TranscriptCourseEntry = {
  code: string;
  label: string;
  credits?: number | null;
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
  completedCredits?: number;
  requiredCreditCount?: number | null;
  maxCreditCount?: number | null;
  creditProgressLabel?: string | null;
};

export type SourceBackedRequiredCourseDescriptor = {
  id: string;
  kind: "single-course" | "course-sequence" | "choice-bucket";
  title: string;
  bucket: RequirementPriorityBucket | "source-backed-fallback";
  courseLabelSets: string[][];
  explicitCourseCodes: string[];
  requiredCompletedCount: number;
  requiredCreditCount: number | null;
  maxCreditCount: number | null;
  completedCredits: number | null;
  creditProgressLabel: string | null;
  requirementType: TransferPlannerRequirementType | null;
  requirementGroupId: string | null;
  requirementGroupLabel: string | null;
  selectedOptionLabels: string[];
  otherOptionLabels: string[];
  note: string | null;
  guidanceSummary: string | null;
};

export type SourceBackedRequiredCourseSummaryEntry = {
  id: string;
  descriptorId: string;
  kind: SourceBackedRequiredCourseDescriptor["kind"];
  text: string;
};

export type SourceBackedUwCourseConsideredSummaryEntry = {
  id: string;
  courseCode: string;
  normalizedCourseCode?: string;
  text: string;
  title?: string | null;
  credits?: number | null;
  creditMin?: number | null;
  creditMax?: number | null;
  creditText?: string | null;
  category?: string | null;
  requirementGroupId?: string | null;
  requirementType?: TransferPlannerRequirementType | null;
  optionRole?: string | null;
  sourceHeading?: string | null;
  sourceCategory?: string | null;
  notes?: string[];
};

export type MajorSpecificsCourseSectionId =
  | "official-uw-required-courses"
  | "selected-uw-requirement-options"
  | "other-valid-uw-options"
  | "green-river-prerequisites"
  | "matched-green-river-track-courses"
  | "gen-ed-breadth-requirements"
  | "restricted-or-replaced-requirements";

export type MajorSpecificsCourseSourceType =
  | "official_uw_requirement"
  | "official_uw_option"
  | "selected_uw_option"
  | "grc_prerequisite"
  | "grc_matched_track"
  | "grc_equivalency_match"
  | "gen_ed_bucket"
  | "nme_option_requirement"
  | "replaced_requirement"
  | "restricted_option";

export type MajorSpecificsRequirementRole =
  | "required"
  | "selected_option"
  | "alternative_option"
  | "prerequisite_only"
  | "matched_track_course"
  | "gen_ed_placeholder"
  | "replaced"
  | "restricted"
  | "informational";

export type MajorSpecificsCourseRow = {
  id: string;
  categoryId: MajorSpecificsCourseSectionId;
  categoryLabel: string;
  categoryDescription: string;
  displayCourseCode: string;
  normalizedCourseCode: string;
  title: string | null;
  credits: number | null;
  text: string;
  alternativeOptionsText?: string | null;
  alternativeOptionsShown: string[];
  sourceType: MajorSpecificsCourseSourceType;
  requirementRole: MajorSpecificsRequirementRole;
  requirementGroupId: string | null;
  requirementGroupLabel: string | null;
  requirementType: TransferPlannerRequirementType | null;
  selectedForRequirement: boolean;
  satisfiesRequirement: boolean;
  countsTowardUwRequirement: boolean;
  countsTowardGrcTrack: boolean;
  countsTowardPrerequisiteChain: boolean;
  countsTowardGenEd: boolean;
  restrictionStatus: string | null;
  explanation: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
};

export type MajorSpecificsCourseSection = {
  id: MajorSpecificsCourseSectionId;
  label: string;
  description: string;
  rows: MajorSpecificsCourseRow[];
};

export type MajorSpecificsRenderingAuditEntry = {
  courseCode: string;
  category: string | null;
  sourceType: MajorSpecificsCourseSourceType | null;
  requirementRole: MajorSpecificsRequirementRole | null;
  requirementType: TransferPlannerRequirementType | null;
  requirementGroupId: string | null;
  selectedForRequirement: boolean;
  countsTowardUwRequirement: boolean;
  countsTowardGrcTrack: boolean;
  countsTowardPrerequisiteChain: boolean;
  countsTowardGenEd: boolean;
  restrictionStatus: string | null;
  alternativeOptionsShown: string[];
  flags: string[];
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

export type SuggestedQuarterCourseSourceKind =
  | "completed-transcript"
  | "uw-major-requirement"
  | "official-grc-track"
  | "uw-major-breadth"
  | "official-grc-track-breadth";

export type SuggestedQuarterCourseVisibilityScope =
  | "visible-grc-completable"
  | "visible-grc-prerequisite"
  | "visible-grc-optional-prep"
  | "hidden-uw-only"
  | "hidden-internal";

export type SuggestedQuarterCourseOption = {
  id: string;
  label: string;
  selectedLabel: string;
  courseLabels: string[];
  courseCodes: string[];
  creditAmount?: number | null;
  creditMin?: number | null;
  creditMax?: number | null;
  guidanceSummary?: string | null;
};

export type SuggestedQuarterCourseOptionGroup = {
  id: string;
  title: string;
  promptLabel: string;
  selectionCount: number;
  requiredCredits?: number | null;
  requirementType?: TransferPlannerRequirementType | null;
  selectedOptionIds: string[];
  selectionSource?: "student" | "default" | null;
  options: SuggestedQuarterCourseOption[];
  isSelectionPrompt: boolean;
};

export type SuggestedQuarterCourse = {
  instanceKey?: string;
  label: string;
  type: "core" | "elective";
  status: "completed" | "current" | "planned";
  creditAmount?: number | null;
  creditMin?: number | null;
  creditMax?: number | null;
  guidanceSummary?: string | null;
  availabilitySummary?: string | null;
  sourceKind?: SuggestedQuarterCourseSourceKind;
  optionGroup?: SuggestedQuarterCourseOptionGroup | null;
  visibilityScope?: SuggestedQuarterCourseVisibilityScope;
  isVisibleInGrcQuarterPlan?: boolean;
  isUwOnlyRequirement?: boolean;
  courseRole?: "optional_stem_prep" | "local_grc_prerequisite" | null;
  canTestOut?: boolean | null;
  transfersOrSatisfiesUw?: boolean | null;
  satisfiesSourceBackedUwRequirement?: boolean | null;
};

export type SuggestedQuarterPlan = {
  label: string;
  phase: "completed" | "current" | "planned";
  courses: SuggestedQuarterCourse[];
};

export type SuggestedQuarterRemainingCreditRange = {
  minRemainingCredits: number;
  maxRemainingCredits: number;
  exactRemainingCredits: number | null;
  mainMinRemainingCredits: number;
  mainMaxRemainingCredits: number;
  stemPrepCredits: number;
  localPrerequisiteCredits: number;
  hiddenUwOnlyCredits: number;
  scheduledMinRemainingCredits: number;
  scheduledMaxRemainingCredits: number;
  completedCredits: number;
  catalogMinimumCredits: number | null;
  catalogMaximumCredits: number | null;
  hasUnresolvedOptions: boolean;
  unresolvedOptionGroupIds: string[];
  unresolvedPlaceholderLabels: string[];
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

type ParsedGrcTrackChoiceSlot = {
  id: string;
  title: string;
  promptLabel: string;
  selectionCount: number;
  requiredCredits?: number | null;
  requirementType?: TransferPlannerRequirementType | null;
  options: SuggestedQuarterCourseOption[];
};

type GrcTrackGroupedChoice = NonNullable<TransferPlannerTrack["groupedChoices"]>[number];

type TrackSupplementalCourseSlot =
  | {
      kind: "label";
      label: string;
    }
  | {
      kind: "grouped-choice";
      groupedChoice: GrcTrackGroupedChoice;
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
const OPTIONAL_STEM_PREP_TEST_OUT_GUIDANCE =
  "Can be tested out of if not needed. Check with advisor for details.";
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

function getSourceBackedRequiredCourseSemanticRelations(
  courseCode: string,
  schoolId: "grc" | TransferPlannerMajorPlan["campusId"] = "grc"
) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  if (!normalizedCourseCode) {
    return [] as string[];
  }

  const cacheKey = `${schoolId}|${normalizedCourseCode}`;
  const cached = SOURCE_BACKED_REQUIRED_COURSE_SEMANTIC_RELATION_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const metadata =
    getTransferPlannerCanonicalCourse(schoolId, normalizedCourseCode) ??
    (schoolId === "grc"
      ? null
      : getTransferPlannerCanonicalCourse("uw-seattle", normalizedCourseCode));
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
    cacheKey,
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

function getSourceBackedRequirementSourceBlocksForPlan(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) {
    return [];
  }

  const selectedPathwayId = getSelectedPathwayId(plan);
  return uniqueBy(
    [
      ...getTransferPlannerParsedRequirementSourceBlocks(plan.id, selectedPathwayId),
      ...(selectedPathwayId
        ? getTransferPlannerParsedRequirementSourceBlocks(plan.id, null)
        : []),
    ],
    (block) => block.id
  );
}

function getSourceBackedRequiredUwCourseCodeSet(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  const requiredUwCourseCodes = new Set<string>();
  if (!plan) {
    return requiredUwCourseCodes;
  }

  for (const block of getSourceBackedRequirementSourceBlocksForPlan(plan)) {
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

function extractSourceBackedAlternateCourseCodeSetsFromText(value: string | null | undefined) {
  const normalizedValue = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedValue || !/\bor\b/i.test(normalizedValue)) {
    return [] as string[][];
  }

  return normalizedValue
    .split(/[.;]/)
    .flatMap((segment) =>
      segment.split(/\s+\band\s+(?=[^.;]{0,120}\bor\b)/i)
    )
    .map((segment) => {
      if (!/\bor\b/i.test(segment)) {
        return [] as string[];
      }

      return sortCourseCodes(extractCourseCodes(segment));
    })
    .filter((courseCodes) => courseCodes.length >= 2 && courseCodes.length <= 4);
}

function getSourceBackedRequirementCandidateUwCourseCodes(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) {
    return [] as string[];
  }

  return sortCourseCodes(
    getSourceBackedRequirementSourceBlocksForPlan(plan).flatMap((block) =>
      (block.parsedRequirementAtomCandidates ?? [])
        .map((candidate) => normalizeCourseCode(candidate.uwCourseCode ?? ""))
        .filter(Boolean)
    )
  );
}

function getSourceBackedRequirementGroupAlternateCourseCodeSets(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) {
    return [] as string[][];
  }

  return [
    ...(plan.applicationChecklist ?? []),
    ...(plan.beforeEnrollmentChecklist ?? []),
    ...(plan.stayAtGrcChecklist ?? []),
  ].flatMap((item) => {
    const group = item.requirementGroup;
    if (!group) {
      return [] as string[][];
    }

    const optionAliasSets = (group.options ?? [])
      .map((option) =>
        sortCourseCodes([
          ...(option.uwCourses ?? []),
          ...(option.equivalentUwCourseCodes ?? []),
        ])
      )
      .filter((courseCodes) => courseCodes.length >= 2);

    if (group.requirementType !== "choose_one" && group.requirementType !== "sequence_choice") {
      return optionAliasSets;
    }

    const optionSets = (group.options ?? [])
      .map((option) =>
        sortCourseCodes([
          ...(option.uwCourses ?? []),
          ...(option.equivalentUwCourseCodes ?? []),
        ])
      )
      .filter((courseCodes) => courseCodes.length > 0);
    const choiceSet = sortCourseCodes(optionSets.flat());

    return choiceSet.length >= 2
      ? [...optionAliasSets, choiceSet]
      : optionAliasSets;
  });
}

function hasConsecutiveCourseNumberRun(courseCodes: string[]) {
  const numbersBySubject = new Map<string, number[]>();
  for (const courseCode of courseCodes) {
    const subject = getCourseSubject(courseCode);
    const catalogNumber = getCourseLevel(courseCode);
    if (!subject || catalogNumber === null) {
      continue;
    }

    numbersBySubject.set(subject, [
      ...(numbersBySubject.get(subject) ?? []),
      catalogNumber,
    ]);
  }

  for (const numbers of numbersBySubject.values()) {
    const uniqueNumbers = [...new Set(numbers)].sort((left, right) => left - right);
    let runLength = 1;
    for (let index = 1; index < uniqueNumbers.length; index += 1) {
      runLength = uniqueNumbers[index] === uniqueNumbers[index - 1] + 1 ? runLength + 1 : 1;
      if (runLength >= 3) {
        return true;
      }
    }
  }

  return false;
}

function getSourceBackedRequiredUwAlternateCourseCodeSets(
  plan: TransferPlannerMajorPlan | null | undefined,
  requiredUwCourseCodes: Set<string>
) {
  if (!plan || !requiredUwCourseCodes.size) {
    return [] as string[][];
  }

  const textDerivedSets = getSourceBackedRequirementCandidateUwCourseCodes(plan).flatMap(
    (courseCode) => {
      const course =
        getTransferPlannerCanonicalCourse(plan.campusId, courseCode) ??
        getTransferPlannerCanonicalCourse("uw-seattle", courseCode);
      if (!course) {
        return [] as string[][];
      }

      return [
        course.catalogDescription,
        ...(course.prerequisiteNotes ?? []),
        ...(course.corequisiteNotes ?? []),
      ].flatMap(extractSourceBackedAlternateCourseCodeSetsFromText);
    }
  );
  const sourceLineDerivedSets = getSourceBackedRequirementSourceBlocksForPlan(plan).flatMap(
    (block) =>
      (block.parsedRequirementAtomCandidates ?? []).flatMap((candidate) =>
        (candidate.sourceLineHints ?? [])
          .filter((line) => !/[,;]/.test(line))
          .flatMap(extractSourceBackedAlternateCourseCodeSetsFromText)
      )
  );
  const groupDerivedSets = getSourceBackedRequirementGroupAlternateCourseCodeSets(plan);

  return uniqueBy(
    [...textDerivedSets, ...sourceLineDerivedSets, ...groupDerivedSets]
      .map((courseCodes) =>
        sortCourseCodes(courseCodes.map((courseCode) => normalizeCourseCode(courseCode)))
      )
      .filter(
        (courseCodes) =>
          courseCodes.filter((courseCode) => requiredUwCourseCodes.has(courseCode)).length >= 2 &&
          !hasConsecutiveCourseNumberRun(courseCodes)
      ),
    (courseCodes) => courseCodes.join("|")
  );
}

function hasCurrentComputingPrepSequence(courseCodes: Set<string>) {
  return ["CS 121", "CS 122", "CS 123"].every((courseCode) => courseCodes.has(courseCode));
}

function isLegacyComputingPrepFallback(courseCode: string) {
  return courseCode === "CS 145" || courseCode === "CS& 141";
}

function getSourceBackedRequiredCoverageBackfillCourseCodes(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (plan?.id === "uw-seattle-materials-science-engineering") {
    return ["MATH& 152"];
  }

  return [] as string[];
}

function buildSourceBackedRequiredUwCourseCoverage(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  const requiredUwCourseCodes = getSourceBackedRequiredUwCourseCodeSet(plan);
  const alternateCourseCodeSets = getSourceBackedRequiredUwAlternateCourseCodeSets(
    plan,
    requiredUwCourseCodes
  );
  const coveredRequiredUwCourseCodes = new Set<string>();
  const isCoveredRequiredUwCourseCode = (targetCourseCode: string) => {
    const normalizedTargetCourseCode = normalizeCourseCode(targetCourseCode);
    if (!normalizedTargetCourseCode) {
      return false;
    }

    if (coveredRequiredUwCourseCodes.has(normalizedTargetCourseCode)) {
      return true;
    }

    return false;
  };
  const markCoveredRequiredUwCourseCodes = (targetCourseCodes: string[]) => {
    const targetQueue = targetCourseCodes
      .map((targetCourseCode) => normalizeCourseCode(targetCourseCode))
      .filter(Boolean);

    while (targetQueue.length) {
      const normalizedTargetCourseCode = targetQueue.shift();
      if (
        !normalizedTargetCourseCode ||
        !requiredUwCourseCodes.has(normalizedTargetCourseCode) ||
        coveredRequiredUwCourseCodes.has(normalizedTargetCourseCode)
      ) {
        continue;
      }

      coveredRequiredUwCourseCodes.add(normalizedTargetCourseCode);

      for (const alternateCourseCodeSet of alternateCourseCodeSets) {
        if (!alternateCourseCodeSet.includes(normalizedTargetCourseCode)) {
          continue;
        }

        for (const alternateCourseCode of alternateCourseCodeSet) {
          if (
            requiredUwCourseCodes.has(alternateCourseCode) &&
            !coveredRequiredUwCourseCodes.has(alternateCourseCode)
          ) {
            targetQueue.push(alternateCourseCode);
          }
        }
      }
    }
  };

  return {
    requiredUwCourseCodes,
    isCoveredRequiredUwCourseCode,
    markCoveredRequiredUwCourseCodes,
  };
}

function isElectiveRequirementGroup(item: TransferPlannerChecklistItem) {
  const group = item.requirementGroup;
  return Boolean(group && /\belective\b/i.test(`${group.category} ${group.label}`));
}

function shouldTreatChecklistItemPrimaryCoursesAsRequired(item: TransferPlannerChecklistItem) {
  const requirementType = item.requirementGroup?.requirementType;
  if (requirementType === "choose_n" || requirementType === "choose_credits") {
    return false;
  }

  if (requirementType === "choose_one" && isElectiveRequirementGroup(item)) {
    return false;
  }

  return true;
}

function getRequiredChecklistCourseLabels(item: TransferPlannerChecklistItem) {
  return shouldTreatChecklistItemPrimaryCoursesAsRequired(item) ? item.grcCourses ?? [] : [];
}

function getChoiceOnlyChecklistCourseCodeSet(plan: TransferPlannerMajorPlan | null | undefined) {
  const courseCodes = new Set<string>();
  if (!plan) {
    return courseCodes;
  }

  for (const item of [
    ...(plan.applicationChecklist ?? []),
    ...(plan.beforeEnrollmentChecklist ?? []),
    ...(plan.stayAtGrcChecklist ?? []),
  ]) {
    const choiceLabels = [
      ...(shouldTreatChecklistItemPrimaryCoursesAsRequired(item) ? [] : item.grcCourses ?? []),
      ...(item.alternatives ?? []).flat(),
    ];
    for (const label of choiceLabels) {
      for (const courseCode of extractCourseCodes(label)) {
        const normalizedCourseCode = normalizeCourseCode(courseCode);
        if (normalizedCourseCode) {
          courseCodes.add(normalizedCourseCode);
        }
      }
    }
  }

  return courseCodes;
}

export function buildSourceBackedRequiredCourseCodes(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) {
    return [] as string[];
  }

  const orderedCourseCodes: string[] = [];
  const seenCourseCodes = new Set<string>();
  const {
    requiredUwCourseCodes,
    isCoveredRequiredUwCourseCode,
    markCoveredRequiredUwCourseCodes,
  } = buildSourceBackedRequiredUwCourseCoverage(plan);
  const choiceOnlyCourseCodes = getChoiceOnlyChecklistCourseCodeSet(plan);
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
    addCourseCodes(getRequiredChecklistCourseLabels(item));
  }

  if (!requiredUwCourseCodes.size) {
    return orderedCourseCodes;
  }

  for (const courseLabel of getTransferPlannerGrcCourseList(plan)) {
    for (const courseCode of extractCourseCodes(courseLabel)) {
      const normalizedCourseCode = normalizeCourseCode(courseCode);
      if (
        !normalizedCourseCode ||
        seenCourseCodes.has(normalizedCourseCode) ||
        choiceOnlyCourseCodes.has(normalizedCourseCode) ||
        (hasCurrentComputingPrepSequence(seenCourseCodes) &&
          isLegacyComputingPrepFallback(normalizedCourseCode))
      ) {
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

  for (const courseCode of getSourceBackedRequiredCoverageBackfillCourseCodes(plan)) {
    const normalizedCourseCode = normalizeCourseCode(courseCode);
    if (
      normalizedCourseCode &&
      !seenCourseCodes.has(normalizedCourseCode) &&
      getTransferPlannerGrcCourseList(plan).includes(normalizedCourseCode)
    ) {
      seenCourseCodes.add(normalizedCourseCode);
      orderedCourseCodes.push(normalizedCourseCode);
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
  const fallbackItems = buildSourceBackedRequiredCourseDescriptors(scope.plan, scope.completedCourses)
    .filter((descriptor) => descriptor.kind !== "choice-bucket")
    .flatMap((descriptor) => descriptor.explicitCourseCodes)
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter((courseCode) => courseCode && !existingCourseCodes.has(courseCode))
    .filter((courseCode, index, courseCodes) => courseCodes.indexOf(courseCode) === index)
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

function getRequirementOptionCourseLabels(
  option: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>["options"][number]
) {
  const grcMatches = (option.grcMatches ?? [])
    .map((label) => String(label ?? "").trim())
    .filter(Boolean);
  if (grcMatches.length) {
    return unique(grcMatches);
  }

  return unique(
    [...(option.uwCourses ?? []), ...(option.equivalentUwCourseCodes ?? [])]
      .map((label) => String(label ?? "").trim())
      .filter(Boolean)
  );
}

function getRequirementOptionLabelsByIds(
  item: TransferPlannerChecklistItem,
  optionIds: string[] | null | undefined
) {
  const optionIdSet = new Set((optionIds ?? []).map((optionId) => String(optionId ?? "").trim()).filter(Boolean));
  if (!item.requirementGroup || !optionIdSet.size) {
    return [];
  }

  return unique(
    (item.requirementGroup.options ?? [])
      .filter((option) => option.id && optionIdSet.has(option.id))
      .flatMap((option) => getRequirementOptionCourseLabels(option))
  );
}

function buildChooseNRequirementLabel(item: TransferPlannerChecklistItem, chooseCount: number) {
  const cleanedTitle = String(item.title ?? "")
    .replace(/^One\s*(?:\(\s*1\s*\))?\s*/i, "")
    .replace(/^Two\s+/i, "")
    .trim();
  return `Choose ${chooseCount} ${cleanedTitle || "options"}`;
}

function buildChooseCreditsRequirementLabel(item: TransferPlannerChecklistItem) {
  const minCredits = item.minCredits ?? item.requirementGroup?.minCredits ?? null;
  const maxCredits = item.maxCredits ?? item.requirementGroup?.maxCredits ?? null;
  const labelContext = `${item.requirementGroup?.id ?? ""} ${item.requirementGroup?.subcategory ?? ""} ${item.title ?? ""}`;

  if (minCredits != null && minCredits > 0) {
    if (/mse-nme-core-elective|nme_core_elective/i.test(labelContext)) {
      return `NME Option Core/Elective Requirement: ${minCredits} credits`;
    }
    if (/engineering-fundamentals/i.test(labelContext)) {
      return `Choose at least ${minCredits} credits from Engineering Fundamentals electives`;
    }
    if (/mse-400-level|mse_400_level/i.test(labelContext)) {
      return `Choose at least ${minCredits} credits from MSE 400-level technical electives`;
    }
    return `Choose at least ${minCredits} credits from ${String(item.title ?? "approved options").trim()}`;
  }

  if (maxCredits != null && maxCredits > 0) {
    if (/outside-mse|outside_mse/i.test(labelContext)) {
      return `Up to ${maxCredits} credits may count from approved outside-MSE technical electives`;
    }
    return `Up to ${maxCredits} credits may count from ${String(item.title ?? "approved options").trim()}`;
  }

  return `${String(item.title ?? "Approved options").trim()} - choose approved credits`;
}

function buildChecklistChoiceLabel(
  item: TransferPlannerChecklistItem,
  remainingNeeded: number,
  matchedCount: number
) {
  if (item.requirementGroup?.requirementType === "choose_n") {
    return buildChooseNRequirementLabel(item, remainingNeeded);
  }

  if (item.requirementGroup?.requirementType === "choose_credits") {
    return buildChooseCreditsRequirementLabel(item);
  }

  const chooseLabel =
    `Choose ${remainingNeeded === 1 ? "one" : remainingNeeded}${
      matchedCount > 0 ? " more" : ""
    } from this list`;
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
  const chooseLabel =
    item.requirementGroup?.requirementType === "choose_n"
      ? buildChooseNRequirementLabel(item, remainingNeeded)
      : item.requirementGroup?.requirementType === "choose_credits"
      ? buildChooseCreditsRequirementLabel(item)
      : `Choose ${
          remainingNeeded === 1 ? "one" : remainingNeeded
        }${matchedCount > 0 ? " more" : ""} from this list`;
  const choicesSummary = previewLabels.length
    ? `${chooseLabel}: ${previewLabels.join(", ")}${hiddenCount > 0 ? `, plus ${hiddenCount} more` : ""}.`
    : `${chooseLabel}.`;

  return baseGuidanceSummary ? `${choicesSummary} ${baseGuidanceSummary}` : choicesSummary;
}

function getRequirementOptionSelectionKey(item: TransferPlannerChecklistItem) {
  return item.requirementGroup?.id ?? item.id;
}

function normalizeSelectedRequirementOptionIds(value: unknown) {
  const rawValues = Array.isArray(value) ? value : value == null ? [] : [value];
  return unique(
    rawValues
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean)
  );
}

function hasExplicitPlannerSelectedRequirementOptionIds(
  item: TransferPlannerChecklistItem,
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>
) {
  const selectionKey = getRequirementOptionSelectionKey(item);
  return Boolean(
    selectedRequirementOptionIdsByGroup &&
      (Object.prototype.hasOwnProperty.call(selectedRequirementOptionIdsByGroup, selectionKey) ||
        Object.prototype.hasOwnProperty.call(selectedRequirementOptionIdsByGroup, item.id))
  );
}

function getPlannerSelectedRequirementOptionIds(
  item: TransferPlannerChecklistItem,
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>
) {
  const selectionKey = getRequirementOptionSelectionKey(item);
  const hasExplicitSelection = hasExplicitPlannerSelectedRequirementOptionIds(
    item,
    selectedRequirementOptionIdsByGroup
  );
  const selectedValue =
    selectedRequirementOptionIdsByGroup?.[selectionKey] ??
    selectedRequirementOptionIdsByGroup?.[item.id];
  const selectedIds = normalizeSelectedRequirementOptionIds(selectedValue);
  if (hasExplicitSelection) {
    return selectedIds;
  }
  if (selectedIds.length) {
    return selectedIds;
  }

  return normalizeSelectedRequirementOptionIds(item.selectedRequirementOptionIds);
}

function getPlannerSelectedRequirementOptionIdsForScheduling(input: {
  item: TransferPlannerChecklistItem;
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
  plan?: TransferPlannerMajorPlan | null;
}) {
  const hasExplicitSelection = hasExplicitPlannerSelectedRequirementOptionIds(
    input.item,
    input.selectedRequirementOptionIdsByGroup
  );

  if (hasExplicitSelection) {
    return getPlannerSelectedRequirementOptionIds(
      input.item,
      input.selectedRequirementOptionIdsByGroup
    );
  }

  // In UW transfer mode, default source-backed option ids are useful for previews,
  // but they should not become scheduled GRC courses until the student explicitly picks them.
  if (isUwTransferPlannerPlan(input.plan)) {
    return [] as string[];
  }

  return normalizeSelectedRequirementOptionIds(input.item.selectedRequirementOptionIds);
}

function getRequirementOptionId(
  item: TransferPlannerChecklistItem,
  option: RequirementGroupOption,
  optionIndex: number
) {
  return (
    String(option.id ?? "").trim() ||
    `${getRequirementOptionSelectionKey(item)}:requirement-option:${optionIndex + 1}`
  );
}

function getRequirementOptionSelectionCount(item: TransferPlannerChecklistItem) {
  const group = item.requirementGroup;
  const optionCount = group?.options.length ?? 0;
  const rawSelectionCount =
    item.minCompletedCount ??
    group?.minCourses ??
    (group?.requirementType === "choose_one" || group?.requirementType === "sequence_choice"
      ? 1
      : 0);
  const selectionCount = Number(rawSelectionCount);

  if (!Number.isFinite(selectionCount) || selectionCount <= 0) {
    return optionCount > 0 ? 1 : 0;
  }

  return optionCount > 0
    ? Math.max(1, Math.min(optionCount, Math.ceil(selectionCount)))
    : Math.max(1, Math.ceil(selectionCount));
}

function getSuggestedQuarterCourseOptionMaximumCreditValue(
  option: SuggestedQuarterCourseOption
) {
  const creditValue = Number(option.creditMax ?? option.creditAmount ?? option.creditMin ?? 0);
  return Number.isFinite(creditValue) && creditValue > 0 ? creditValue : 0;
}

function getRequirementOptionSelectionCountForSuggestedOptions(
  item: TransferPlannerChecklistItem,
  options: SuggestedQuarterCourseOption[]
) {
  const group = item.requirementGroup;
  const optionCount = options.length;
  if (!optionCount) return 0;

  if (group?.requirementType === "choose_credits") {
    const requiredCredits = Number(item.minCredits ?? group.minCredits ?? 0);
    if (Number.isFinite(requiredCredits) && requiredCredits > 0) {
      let selectedCreditTotal = 0;
      let selectedOptionCount = 0;
      const optionCredits = options
        .map(getSuggestedQuarterCourseOptionMaximumCreditValue)
        .filter((creditValue) => creditValue > 0)
        .sort((left, right) => right - left);

      for (const creditValue of optionCredits) {
        selectedCreditTotal += creditValue;
        selectedOptionCount += 1;
        if (selectedCreditTotal >= requiredCredits) {
          return selectedOptionCount;
        }
      }

      return Math.max(1, Math.min(optionCount, optionCredits.length || optionCount));
    }
  }

  return Math.min(getRequirementOptionSelectionCount(item), optionCount);
}

function getRequirementOptionFinishTitle(item: TransferPlannerChecklistItem) {
  const rawTitle = String(
    item.requirementGroup?.label ??
      item.requirementGroup?.sourceHeading ??
      item.title ??
      ""
  )
    .replace(/\[[^\]]+\]\s*/g, "")
    .replace(/[\u2022\u25aa\u25ab\u25a0\u25a1\u2610\u2611\u2713\u2714]+/g, " ")
    .replace(/(?:\u00ef\u201a\u00a8)+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!rawTitle) {
    return "this requirement";
  }

  const courseCodes = extractCourseCodes(rawTitle);
  const nonCourseText = rawTitle
    .replace(COURSE_CODE_PATTERN, " ")
    .replace(/\b(?:or|and|choose|one|two|three|from|this|list|credits?|credit|minimum|total)\b/gi, " ")
    .replace(/[-:;,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (courseCodes.length > 1 && nonCourseText.length < 8) {
    return "this requirement";
  }

  return rawTitle;
}

function buildRequirementOptionPromptLabel(
  item: TransferPlannerChecklistItem,
  optionCount: number
) {
  const optionNoun = optionCount === 1 ? "option" : "options";
  return `You have ${optionCount} different ${optionNoun} to finish ${getRequirementOptionFinishTitle(
    item
  )}. Click for your options.`;
}

function buildSuggestedQuarterCourseOption(
  item: TransferPlannerChecklistItem,
  option: RequirementGroupOption,
  optionIndex: number,
  campusId?: TransferPlannerMajorPlan["campusId"] | null
): SuggestedQuarterCourseOption | null {
  if (!(option.grcMatches ?? []).some((label) => String(label ?? "").trim())) {
    return null;
  }

  const courseLabels = getRequirementOptionCourseLabels(option);
  const courseCodes = unique(courseLabels.flatMap((label) => extractCourseCodes(label)));
  const label =
    getRequirementOptionDisplayLabel(option) ||
    courseLabels.join(" / ") ||
    option.label ||
    `Option ${optionIndex + 1}`;
  if (!courseLabels.length && !courseCodes.length && !label) {
    return null;
  }

  return {
    id: getRequirementOptionId(item, option, optionIndex),
    label,
    selectedLabel: getRequirementOptionSelectedLabel(option) || label,
    courseLabels,
    courseCodes,
    guidanceSummary: buildTransferEquivalencyGuidanceSummary(courseCodes, campusId),
    ...getRequirementOptionCreditRange(option, courseLabels),
  };
}

function getSuggestedQuarterCourseOptionDeduplicationKey(
  option: SuggestedQuarterCourseOption
) {
  const normalizedCourseCodes = option.courseCodes
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter(Boolean)
    .sort();
  if (normalizedCourseCodes.length) {
    return `course-codes:${normalizedCourseCodes.join("|")}`;
  }

  return `course-labels:${option.courseLabels
    .map((label) => String(label ?? "").replace(/\s+/g, " ").trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|")}`;
}

function dedupeSuggestedQuarterCourseOptions(input: {
  options: SuggestedQuarterCourseOption[];
  selectedOptionIds: string[];
}) {
  const options: SuggestedQuarterCourseOption[] = [];
  const optionIdAliases = new Map<string, string>();
  const optionIndexByKey = new Map<string, number>();

  for (const option of input.options) {
    const key = getSuggestedQuarterCourseOptionDeduplicationKey(option);
    const existingIndex = optionIndexByKey.get(key);
    if (existingIndex == null) {
      optionIndexByKey.set(key, options.length);
      optionIdAliases.set(option.id, option.id);
      options.push(option);
      continue;
    }

    const existingOption = options[existingIndex];
    optionIdAliases.set(option.id, existingOption.id);
    options[existingIndex] = {
      ...existingOption,
      courseLabels: unique([...existingOption.courseLabels, ...option.courseLabels]),
      courseCodes: unique([...existingOption.courseCodes, ...option.courseCodes]),
      guidanceSummary: existingOption.guidanceSummary ?? option.guidanceSummary ?? null,
    };
  }

  const optionIds = new Set(options.map((option) => option.id));
  const selectedOptionIds = unique(
    input.selectedOptionIds
      .map((optionId) => optionIdAliases.get(optionId) ?? optionId)
      .filter((optionId) => optionIds.has(optionId))
  );

  return { options, selectedOptionIds };
}

function getSuggestedQuarterCourseOptionGroupCreditRange(
  optionGroup: SuggestedQuarterCourseOptionGroup
) {
  const requiredCredits = getPositiveCreditAmount(optionGroup.requiredCredits);
  if (requiredCredits !== null) {
    return {
      creditAmount: requiredCredits,
      creditMin: requiredCredits,
      creditMax: requiredCredits,
    };
  }

  const selectableCreditRanges = optionGroup.options
    .map((option) =>
      getSuggestedCourseCreditRangeFromValues({
        creditAmount: option.creditAmount,
        creditMin: option.creditMin,
        creditMax: option.creditMax,
      })
    )
    .filter((range) => range.creditMin != null || range.creditMax != null);
  if (!selectableCreditRanges.length) {
    return {
      creditAmount: null,
      creditMin: null,
      creditMax: null,
    };
  }

  const selectionCount = Math.max(
    1,
    Math.min(optionGroup.selectionCount, selectableCreditRanges.length)
  );
  const minimumCredits = selectableCreditRanges
    .map((range) => range.creditMin ?? range.creditAmount ?? range.creditMax ?? 0)
    .sort((left, right) => left - right)
    .slice(0, selectionCount)
    .reduce((total, credits) => total + credits, 0);
  const maximumCredits = selectableCreditRanges
    .map((range) => range.creditMax ?? range.creditAmount ?? range.creditMin ?? 0)
    .sort((left, right) => right - left)
    .slice(0, selectionCount)
    .reduce((total, credits) => total + credits, 0);

  return {
    creditAmount: minimumCredits === maximumCredits ? minimumCredits : null,
    creditMin: minimumCredits,
    creditMax: maximumCredits,
  };
}

function buildSuggestedQuarterCourseOptionGroup(input: {
  item: TransferPlannerChecklistItem;
  selectedOptionIds: string[];
  isSelectionPrompt: boolean;
  campusId?: TransferPlannerMajorPlan["campusId"] | null;
}) {
  const group = input.item.requirementGroup;
  if (!group || !group.options.length) {
    return null;
  }

  const options = group.options
    .map((option, optionIndex) =>
      buildSuggestedQuarterCourseOption(input.item, option, optionIndex, input.campusId)
    )
    .filter((option): option is SuggestedQuarterCourseOption => !!option);
  const dedupedOptions = dedupeSuggestedQuarterCourseOptions({
    options,
    selectedOptionIds: input.selectedOptionIds,
  });
  if (!dedupedOptions.options.length) {
    return null;
  }

  const selectionCount = getRequirementOptionSelectionCountForSuggestedOptions(
    input.item,
    dedupedOptions.options
  );

  return {
    id: getRequirementOptionSelectionKey(input.item),
    title: getRequirementOptionFinishTitle(input.item),
    promptLabel: buildRequirementOptionPromptLabel(input.item, dedupedOptions.options.length),
    selectionCount,
    requiredCredits: group.minCredits ?? null,
    requirementType: group.requirementType,
    selectedOptionIds: dedupedOptions.selectedOptionIds,
    options: dedupedOptions.options,
    isSelectionPrompt: input.isSelectionPrompt,
  } satisfies SuggestedQuarterCourseOptionGroup;
}

function getSelectedRequirementOptionsForPlanner(
  item: TransferPlannerChecklistItem,
  selectedOptionIds: string[]
) {
  const group = item.requirementGroup;
  if (!group || !selectedOptionIds.length) {
    return [] as { option: RequirementGroupOption; optionId: string; optionIndex: number }[];
  }

  const selectedOptionIdSet = new Set(selectedOptionIds);
  return group.options
    .map((option, optionIndex) => ({
      option,
      optionIndex,
      optionId: getRequirementOptionId(item, option, optionIndex),
    }))
    .filter((entry) => selectedOptionIdSet.has(entry.optionId));
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
  const normalized = normalizeTransferPlannerCourseCode(value);
  return LEGACY_COURSE_CODE_ALIASES.get(normalized) ?? normalized;
}

const SOURCE_BACKED_REQUIRED_COURSE_SEMANTIC_RELATION_CACHE = new Map<string, string[]>();

export function extractCourseCodes(value: string) {
  return unique(
    [
      ...(String(value ?? "").toUpperCase().match(COURSE_CODE_PATTERN) ?? []),
      ...extractTransferPlannerCourseCodes(String(value ?? "")),
    ].map((match) => normalizeCourseCode(match))
  );
}

function isUwTransferPlannerPlan(plan: TransferPlannerMajorPlan | null | undefined) {
  return String(plan?.campusId ?? "").startsWith("uw-");
}

function getPlanGrcCourseCodes(plan: TransferPlannerMajorPlan | null | undefined) {
  return sortCourseCodes(
    getTransferPlannerGrcCourseList(plan)
      .flatMap((label) => extractCourseCodes(label))
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter((courseCode) =>
        Boolean(courseCode && getTransferPlannerCanonicalCourse("grc", courseCode))
      )
      .filter(Boolean)
  );
}

function hasConcreteGrcCourseCode(courseCode: string) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  return Boolean(
    normalizedCourseCode &&
      getTransferPlannerCanonicalCourse("grc", normalizedCourseCode)
  );
}

function hasSourceBackedGrcEquivalentForUwCourse(
  uwCourseCode: string,
  plan: TransferPlannerMajorPlan | null | undefined
) {
  const normalizedUwCourseCode = normalizeCourseCode(uwCourseCode);
  if (!normalizedUwCourseCode || !isUwTransferPlannerPlan(plan)) {
    return false;
  }

  return getPlanGrcCourseCodes(plan).some((sourceCourseCode) =>
    buildBestSingleCourseUwEquivalentCourseCodes(sourceCourseCode, plan?.campusId).includes(
      normalizedUwCourseCode
    )
  );
}

function hasVisibleGrcCourseOrEquivalent(
  courseCodes: string[],
  plan: TransferPlannerMajorPlan | null | undefined
) {
  return courseCodes.some((courseCode) => {
    const normalizedCourseCode = normalizeCourseCode(courseCode);
    return (
      hasConcreteGrcCourseCode(normalizedCourseCode) ||
      getPlanGrcCourseCodes(plan).includes(normalizedCourseCode) ||
      hasSourceBackedGrcEquivalentForUwCourse(normalizedCourseCode, plan)
    );
  });
}

function getCourseVisibilityScope(input: {
  explicitCourseCodes: string[];
  sourceKind?: SuggestedQuarterCourseSourceKind | null;
  plan?: TransferPlannerMajorPlan | null;
  isPrepCourse?: boolean;
}): SuggestedQuarterCourseVisibilityScope {
  if (input.isPrepCourse) {
    return "visible-grc-optional-prep" satisfies SuggestedQuarterCourseVisibilityScope;
  }

  if (!isUwTransferPlannerPlan(input.plan)) {
    return "visible-grc-completable" satisfies SuggestedQuarterCourseVisibilityScope;
  }

  if (input.sourceKind === "official-grc-track" || input.sourceKind === "official-grc-track-breadth") {
    return "visible-grc-completable" satisfies SuggestedQuarterCourseVisibilityScope;
  }

  if (hasVisibleGrcCourseOrEquivalent(input.explicitCourseCodes, input.plan)) {
    return "visible-grc-completable" satisfies SuggestedQuarterCourseVisibilityScope;
  }

  if (input.sourceKind === "uw-major-requirement" || input.sourceKind === "uw-major-breadth") {
    return "hidden-uw-only" satisfies SuggestedQuarterCourseVisibilityScope;
  }

  return "hidden-internal" satisfies SuggestedQuarterCourseVisibilityScope;
}

function isVisibleGrcQuarterPlanCourse(
  course: SuggestedQuarterCourse | PendingSuggestedCourse
) {
  return (
    course.visibilityScope === "visible-grc-completable" ||
    course.visibilityScope === "visible-grc-prerequisite" ||
    course.visibilityScope === "visible-grc-optional-prep"
  );
}

function withSuggestedQuarterCourseVisibilityScope<
  TCourse extends SuggestedQuarterCourse & { explicitCourseCodes?: string[] }
>(
  course: TCourse,
  input: {
    plan?: TransferPlannerMajorPlan | null;
    sourceKind?: SuggestedQuarterCourseSourceKind | null;
    isPrepCourse?: boolean;
  } = {}
): TCourse {
  const explicitCourseCodes = (course.explicitCourseCodes?.length
    ? course.explicitCourseCodes
    : [
        ...extractCourseCodes(course.label),
        ...(course.optionGroup?.options ?? []).flatMap((option) => option.courseCodes),
      ]
  )
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter(Boolean);
  const sourceKind = input.sourceKind ?? course.sourceKind ?? null;
  const visibilityScope = getCourseVisibilityScope({
    explicitCourseCodes,
    sourceKind,
    plan: input.plan,
    isPrepCourse: input.isPrepCourse,
  });

  return {
    ...course,
    visibilityScope,
    isVisibleInGrcQuarterPlan:
      visibilityScope === "visible-grc-completable" ||
      visibilityScope === "visible-grc-prerequisite" ||
      visibilityScope === "visible-grc-optional-prep",
    isUwOnlyRequirement: visibilityScope === "hidden-uw-only",
  };
}

const GRC_DISTRIBUTION_PLACEHOLDER_CODE_PATTERN =
  /\b(?:[123]\s*[ABC]|[HSDN]\s*\d+)\b(?:\s*[-:]|\b)/i;
const GRC_DISTRIBUTION_PLACEHOLDER_TEXT_PATTERN =
  /\b(?:A\s*&\s*H|SSc|NSc|humanities|fine arts|arts and humanities|social sciences?|natural sciences?)\b/i;
const GRC_DISTRIBUTION_CHOICE_CUE_PATTERN = /\b(?:or|select|choose)\b/i;

export function hasCourseAndDistributionPlaceholderSignal(label: string) {
  const normalizedLabel = String(label ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedLabel || !extractCourseCodes(normalizedLabel).length) {
    return false;
  }

  const hasDistributionCode =
    GRC_DISTRIBUTION_PLACEHOLDER_CODE_PATTERN.test(normalizedLabel);
  const hasDistributionText =
    GRC_DISTRIBUTION_PLACEHOLDER_TEXT_PATTERN.test(normalizedLabel);
  const hasChoiceCue = GRC_DISTRIBUTION_CHOICE_CUE_PATTERN.test(normalizedLabel);

  return (
    (hasDistributionCode && (hasChoiceCue || hasDistributionText)) ||
    (hasDistributionText && hasChoiceCue)
  );
}

export function isMergedCourseDistributionRequirementLabel(label: string) {
  return hasCourseAndDistributionPlaceholderSignal(label);
}

function extractSourceBackedUwCourseCodesFromRequirementText(value: string) {
  const normalizedValue = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedValue) {
    return [] as string[];
  }

  const courseCodes: string[] = [];
  const explicitMatches = [...normalizedValue.matchAll(SOURCE_BACKED_UW_COURSE_WITH_CONTINUATION_PATTERN)];

  for (let index = 0; index < explicitMatches.length; index += 1) {
    const match = explicitMatches[index];
    const explicitCourseCode = normalizeCourseCode(`${match[1] ?? ""} ${match[2] ?? ""}`);
    const subject = explicitCourseCode.replace(
      /\s+\d{3}(?:\.\d+)?[A-Z]?$/i,
      ""
    );
    if (!subject) {
      continue;
    }

    courseCodes.push(explicitCourseCode);
    const currentMatchEnd = (match.index ?? 0) + match[0].length;
    const nextMatchStart =
      index + 1 < explicitMatches.length
        ? explicitMatches[index + 1]?.index ?? normalizedValue.length
        : normalizedValue.length;
    const trailingSegment = normalizedValue.slice(currentMatchEnd, nextMatchStart);

    for (const numberMatch of trailingSegment.matchAll(
      SOURCE_BACKED_UW_COURSE_NUMBER_CONTINUATION_PATTERN
    )) {
      const courseCode = normalizeCourseCode(`${subject} ${numberMatch[1] ?? ""}`);
      if (courseCode) {
        courseCodes.push(courseCode);
      }
    }
  }

  return unique(courseCodes);
}

export function parseCompletedTranscriptCourses(rawValue: unknown): TranscriptCourseEntry[] {
  const seen = new Set<string>();
  const parsed: TranscriptCourseEntry[] = [];
  const parseCredits = (value: unknown) => {
    const credits = Number(value);
    return Number.isFinite(credits) && credits > 0 ? credits : null;
  };
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
        const credits = parseCredits(
          record.credits ?? record.earnedCredits ?? record.credit
        );

        for (const code of extractCourseCodes(String(record.code ?? cleaned))) {
          pushEntry({
            code,
            label: cleaned,
            credits,
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
const STEM_PREP_COURSE_CODE_FALLBACKS = [
  "CHEM& 140",
  "MATH& 141",
  "MATH& 142",
  "PHYS& 114",
  "PHYS& 115",
];

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

function getStemPrepCourseCodeSet(track: TransferPlannerTrack | null | undefined) {
  return new Set(
    [
      ...buildPreparatoryTrackCourseCodeSet(track),
      ...STEM_PREP_COURSE_CODE_FALLBACKS,
    ]
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function isOnlyStemPrepSuggestedCourse(
  course: PendingSuggestedCourse,
  stemPrepCourseCodes: Set<string>
) {
  if (!stemPrepCourseCodes.size || !course.explicitCourseCodes.length) {
    return false;
  }

  const normalizedCourseCodes = course.explicitCourseCodes
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter(Boolean);

  return (
    normalizedCourseCodes.length > 0 &&
    normalizedCourseCodes.every((courseCode) => stemPrepCourseCodes.has(courseCode))
  );
}

function filterStemPrepSuggestedCourses(
  courses: PendingSuggestedCourse[],
  stemPrepCourseCodes: Set<string>,
  includeStemPrepCourses: boolean
) {
  if (includeStemPrepCourses) {
    return courses;
  }

  return courses.filter(
    (course) => !isOnlyStemPrepSuggestedCourse(course, stemPrepCourseCodes)
  );
}

function attachOptionalStemPrepMetadata(
  courses: PendingSuggestedCourse[],
  stemPrepCourseCodes: Set<string>
) {
  if (!stemPrepCourseCodes.size) {
    return courses;
  }

  return courses.map<PendingSuggestedCourse>((course) => {
    if (!isOnlyStemPrepSuggestedCourse(course, stemPrepCourseCodes)) {
      return course;
    }

    const existingGuidanceSummary = String(course.guidanceSummary ?? "").trim();
    const guidanceSummary = existingGuidanceSummary.includes(
      OPTIONAL_STEM_PREP_TEST_OUT_GUIDANCE
    )
      ? course.guidanceSummary
      : joinGuidanceSummaries(course.guidanceSummary, OPTIONAL_STEM_PREP_TEST_OUT_GUIDANCE);

    return {
      ...course,
      guidanceSummary,
      visibilityScope: "visible-grc-optional-prep",
      isVisibleInGrcQuarterPlan: true,
      isUwOnlyRequirement: false,
      courseRole: "optional_stem_prep",
      canTestOut: true,
    };
  });
}

function courseIsDirectUwRequirement(course: PendingSuggestedCourse | SuggestedQuarterCourse) {
  return (
    course.sourceKind === "uw-major-requirement" ||
    course.sourceKind === "uw-major-breadth"
  );
}

function courseHasTransferOrUwSatisfaction(input: {
  course: PendingSuggestedCourse;
  campusId?: TransferPlannerMajorPlan["campusId"] | null;
  satisfiesSourceBackedUwRequirement: boolean;
}) {
  if (input.satisfiesSourceBackedUwRequirement || courseIsDirectUwRequirement(input.course)) {
    return true;
  }

  if (!input.campusId || !input.course.explicitCourseCodes.length) {
    return false;
  }

  return Boolean(
    buildTransferEquivalencyGuidanceSummary(
      input.course.explicitCourseCodes,
      input.campusId
    )
  );
}

function attachLocalGrcPrerequisiteMetadata(input: {
  courses: PendingSuggestedCourse[];
  plan?: TransferPlannerMajorPlan | null;
  stemPrepCourseCodes: Set<string>;
}) {
  const visibleCourses = input.courses.filter(isVisibleGrcQuarterPlanCourse);
  if (!visibleCourses.length) {
    return input.courses;
  }

  const sourceBackedRequirementCourseCodes = new Set(
    buildSourceBackedRequiredCourseCodes(input.plan)
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
  const dependencyCodes = new Set<string>();
  const dependentLabelsByPrerequisiteCode = new Map<string, string[]>();
  const dependentLabelsByCorequisiteCode = new Map<string, string[]>();

  for (const course of visibleCourses) {
    for (const courseCode of course.prerequisiteCourseSets.flat()) {
      const normalizedCourseCode = normalizeCourseCode(courseCode);
      if (normalizedCourseCode) {
        dependencyCodes.add(normalizedCourseCode);
        const existingLabels =
          dependentLabelsByPrerequisiteCode.get(normalizedCourseCode) ?? [];
        if (!existingLabels.includes(course.label)) {
          existingLabels.push(course.label);
        }
        dependentLabelsByPrerequisiteCode.set(normalizedCourseCode, existingLabels);
      }
    }

    for (const courseCode of course.corequisiteCourseSets.flat()) {
      const normalizedCourseCode = normalizeCourseCode(courseCode);
      if (normalizedCourseCode) {
        dependencyCodes.add(normalizedCourseCode);
        const existingLabels =
          dependentLabelsByCorequisiteCode.get(normalizedCourseCode) ?? [];
        if (!existingLabels.includes(course.label)) {
          existingLabels.push(course.label);
        }
        dependentLabelsByCorequisiteCode.set(normalizedCourseCode, existingLabels);
      }
    }
  }

  if (!dependencyCodes.size) {
    return input.courses;
  }

  return input.courses.map<PendingSuggestedCourse>((course) => {
    const explicitCourseCodes = course.explicitCourseCodes
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean);
    const unlocksVisibleGrcCourse = explicitCourseCodes.some((courseCode) =>
      dependencyCodes.has(courseCode)
    );
    const satisfiesSourceBackedUwRequirement =
      courseIsDirectUwRequirement(course) ||
      explicitCourseCodes.some((courseCode) =>
        sourceBackedRequirementCourseCodes.has(courseCode)
      );
    const transfersOrSatisfiesUw = courseHasTransferOrUwSatisfaction({
      course,
      campusId: input.plan?.campusId,
      satisfiesSourceBackedUwRequirement,
    });

    if (
      !unlocksVisibleGrcCourse ||
      !explicitCourseCodes.length ||
      courseIsDirectUwRequirement(course) ||
      isOnlyStemPrepSuggestedCourse(course, input.stemPrepCourseCodes)
    ) {
      return {
        ...course,
        transfersOrSatisfiesUw,
        satisfiesSourceBackedUwRequirement,
      };
    }

    const dependentPrerequisiteLabels = unique(
      explicitCourseCodes.flatMap(
        (courseCode) => dependentLabelsByPrerequisiteCode.get(courseCode) ?? []
      )
    ).filter((label) => label !== course.label);
    const dependentCorequisiteLabels = unique(
      explicitCourseCodes.flatMap(
        (courseCode) => dependentLabelsByCorequisiteCode.get(courseCode) ?? []
      )
    ).filter((label) => label !== course.label);
    const localPrerequisiteGuidanceSummary = buildDependencyGuidanceSummary({
      prerequisiteLabels: dependentPrerequisiteLabels,
      corequisiteLabels: dependentCorequisiteLabels,
    });
    const existingGuidanceSummary = String(course.guidanceSummary ?? "").trim();
    const guidanceSummary =
      localPrerequisiteGuidanceSummary &&
      !existingGuidanceSummary.includes(localPrerequisiteGuidanceSummary)
        ? joinGuidanceSummaries(localPrerequisiteGuidanceSummary, course.guidanceSummary)
        : course.guidanceSummary;

    return {
      ...course,
      guidanceSummary,
      visibilityScope: "visible-grc-prerequisite",
      isVisibleInGrcQuarterPlan: true,
      isUwOnlyRequirement: false,
      courseRole: "local_grc_prerequisite",
      canTestOut: course.canTestOut ?? false,
      transfersOrSatisfiesUw,
      satisfiesSourceBackedUwRequirement,
    };
  });
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

type RequirementGroupOption =
  NonNullable<TransferPlannerChecklistItem["requirementGroup"]>["options"][number];

function isChoiceRequirementStatus(status: TransferRequirementStatus) {
  const requirementType = status.item.requirementGroup?.requirementType ?? null;
  return (
    requirementType === "choose_one" ||
    requirementType === "choose_n" ||
    requirementType === "choose_credits" ||
    requirementType === "sequence_choice"
  );
}

function getRequirementOptionCreditValue(
  option: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>["options"][number]
) {
  const credits = option.credits ?? 0;
  if (!Number.isFinite(credits) || credits <= 0) {
    return 0;
  }

  const maxCredits = option.maxCredits ?? null;
  if (maxCredits != null && Number.isFinite(maxCredits) && maxCredits > 0) {
    return Math.min(credits, maxCredits);
  }

  return credits;
}

function getRequirementOptionCreditRange(
  option: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>["options"][number],
  courseLabels: string[] = getRequirementOptionCourseLabels(option)
) {
  const explicitMin = getPositiveCreditAmount(option.creditMin);
  const explicitMax = getPositiveCreditAmount(option.creditMax);
  const explicitCredits = getPositiveCreditAmount(getRequirementOptionCreditValue(option));
  const inferredCredits = inferSuggestedCourseCreditAmount(
    courseLabels.join(" "),
    unique(courseLabels.flatMap((label) => extractCourseCodes(label)))
  );
  const fallbackCredits = getPositiveCreditAmount(inferredCredits);
  const minCredits = explicitMin ?? explicitCredits ?? fallbackCredits;
  const maxCredits = explicitMax ?? explicitCredits ?? minCredits ?? fallbackCredits;

  return {
    creditAmount:
      minCredits != null && maxCredits != null && minCredits === maxCredits ? minCredits : null,
    creditMin: minCredits,
    creditMax: maxCredits,
  };
}

function getSuggestedCourseCreditRangeFromValues(input: {
  creditAmount?: number | null;
  creditMin?: number | null;
  creditMax?: number | null;
}) {
  const exactCredits = getPositiveCreditAmount(input.creditAmount);
  const minCredits = getPositiveCreditAmount(input.creditMin) ?? exactCredits;
  const maxCredits = getPositiveCreditAmount(input.creditMax) ?? exactCredits ?? minCredits;

  return {
    creditAmount:
      minCredits != null && maxCredits != null && minCredits === maxCredits ? minCredits : exactCredits,
    creditMin: minCredits,
    creditMax: maxCredits,
  };
}

function getSuggestedQuarterCourseCreditRange(course: SuggestedQuarterCourse) {
  const range = getSuggestedCourseCreditRangeFromValues({
    creditAmount: course.creditAmount,
    creditMin: course.creditMin,
    creditMax: course.creditMax,
  });

  return {
    creditMin: range.creditMin ?? 0,
    creditMax: range.creditMax ?? range.creditMin ?? 0,
  };
}

function isSuggestedQuarterOptionGroupResolved(
  optionGroup: SuggestedQuarterCourseOptionGroup | null | undefined
) {
  if (!optionGroup) {
    return true;
  }
  if (optionGroup.isSelectionPrompt || optionGroup.selectionSource === "default") {
    return false;
  }

  const selectionCount = Math.max(1, Math.ceil(Number(optionGroup.selectionCount ?? 1) || 1));
  return unique(optionGroup.selectedOptionIds ?? []).length >= selectionCount;
}

function isUnresolvedFlexiblePlaceholderCourse(course: SuggestedQuarterCourse) {
  if (course.status === "completed") {
    return false;
  }
  if (course.sourceKind === "official-grc-track-breadth") {
    return true;
  }

  const label = String(course.label ?? "").replace(/\s+/g, " ").trim();
  if (!label || extractCourseCodes(label).length) {
    return false;
  }

  return /\b(?:credits? of|elective|general education|humanities|social science|natural science|a&h|ssc|nsc)\b/i.test(
    label
  );
}

export type SuggestedQuarterCreditBucketMode = "combined" | "uw-transfer";
export type SuggestedQuarterCreditBucket =
  | "main"
  | "stem-prep"
  | "local-prerequisite"
  | "hidden-uw-only";

export function getSuggestedQuarterCourseCreditBucket(
  course: SuggestedQuarterCourse,
  mode: SuggestedQuarterCreditBucketMode
): SuggestedQuarterCreditBucket {
  if (mode !== "uw-transfer") {
    return "main";
  }

  if (course.isUwOnlyRequirement || course.visibilityScope === "hidden-uw-only") {
    return "hidden-uw-only";
  }

  if (
    course.courseRole === "optional_stem_prep" ||
    course.visibilityScope === "visible-grc-optional-prep"
  ) {
    return "stem-prep";
  }

  if (
    course.courseRole === "local_grc_prerequisite" ||
    course.visibilityScope === "visible-grc-prerequisite"
  ) {
    return course.satisfiesSourceBackedUwRequirement ? "main" : "local-prerequisite";
  }

  return "main";
}

export function buildSuggestedQuarterRemainingCreditRange(input: {
  quarters: SuggestedQuarterPlan[];
  track?: TransferPlannerTrack | null;
  creditBucketMode?: SuggestedQuarterCreditBucketMode;
}): SuggestedQuarterRemainingCreditRange {
  const creditBucketMode = input.creditBucketMode ?? "combined";
  const unresolvedOptionGroupIds = new Set<string>();
  const unresolvedPlaceholderLabels = new Set<string>();
  let mainScheduledMinRemainingCredits = 0;
  let mainScheduledMaxRemainingCredits = 0;
  let stemPrepCredits = 0;
  let localPrerequisiteCredits = 0;
  let hiddenUwOnlyCredits = 0;
  let scheduledMinRemainingCredits = 0;
  let scheduledMaxRemainingCredits = 0;
  let completedCredits = 0;

  for (const quarter of input.quarters) {
    for (const course of quarter.courses) {
      const courseCreditRange = getSuggestedQuarterCourseCreditRange(course);
      if (course.status === "completed") {
        completedCredits += courseCreditRange.creditMin;
        continue;
      }

      const creditBucket = getSuggestedQuarterCourseCreditBucket(course, creditBucketMode);
      if (creditBucket === "hidden-uw-only") {
        hiddenUwOnlyCredits += courseCreditRange.creditMax;
        continue;
      }

      scheduledMinRemainingCredits += courseCreditRange.creditMin;
      scheduledMaxRemainingCredits += courseCreditRange.creditMax;

      if (creditBucket === "stem-prep") {
        stemPrepCredits += courseCreditRange.creditMax;
        continue;
      }

      if (creditBucket === "local-prerequisite") {
        localPrerequisiteCredits += courseCreditRange.creditMax;
        continue;
      }

      mainScheduledMinRemainingCredits += courseCreditRange.creditMin;
      mainScheduledMaxRemainingCredits += courseCreditRange.creditMax;

      if (!isSuggestedQuarterOptionGroupResolved(course.optionGroup)) {
        unresolvedOptionGroupIds.add(course.optionGroup?.id ?? course.label);
      }
      if (isUnresolvedFlexiblePlaceholderCourse(course)) {
        unresolvedPlaceholderLabels.add(course.label);
      }
    }
  }

  const catalogMinimumCredits = getPositiveCreditAmount(input.track?.minimumCredits);
  const catalogMaximumCredits = getPositiveCreditAmount(input.track?.maximumCredits);
  const hasUnresolvedOptions =
    unresolvedOptionGroupIds.size > 0 || unresolvedPlaceholderLabels.size > 0;
  let minRemainingCredits = mainScheduledMinRemainingCredits;
  let maxRemainingCredits = mainScheduledMaxRemainingCredits;

  const catalogMinimumRemainingCredits =
    catalogMinimumCredits !== null ? Math.max(0, catalogMinimumCredits - completedCredits) : null;
  const catalogMaximumRemainingCredits =
    catalogMaximumCredits !== null ? Math.max(0, catalogMaximumCredits - completedCredits) : null;

  if (
    creditBucketMode === "combined" &&
    hasUnresolvedOptions &&
    catalogMinimumRemainingCredits !== null &&
    mainScheduledMinRemainingCredits < catalogMinimumRemainingCredits
  ) {
    minRemainingCredits = catalogMinimumRemainingCredits;
  }

  if (
    creditBucketMode === "combined" &&
    hasUnresolvedOptions &&
    catalogMaximumRemainingCredits !== null &&
    mainScheduledMaxRemainingCredits < catalogMaximumRemainingCredits
  ) {
    maxRemainingCredits = catalogMaximumRemainingCredits;
  }

  if (maxRemainingCredits < minRemainingCredits) {
    maxRemainingCredits = minRemainingCredits;
  }

  return {
    minRemainingCredits,
    maxRemainingCredits,
    exactRemainingCredits:
      !hasUnresolvedOptions && minRemainingCredits === maxRemainingCredits
        ? minRemainingCredits
        : null,
    mainMinRemainingCredits: minRemainingCredits,
    mainMaxRemainingCredits: maxRemainingCredits,
    stemPrepCredits,
    localPrerequisiteCredits,
    hiddenUwOnlyCredits,
    scheduledMinRemainingCredits,
    scheduledMaxRemainingCredits,
    completedCredits,
    catalogMinimumCredits,
    catalogMaximumCredits,
    hasUnresolvedOptions,
    unresolvedOptionGroupIds: [...unresolvedOptionGroupIds].sort(),
    unresolvedPlaceholderLabels: [...unresolvedPlaceholderLabels].sort(),
  };
}

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

function buildChooseCreditsRequirementStatus(
  item: TransferPlannerChecklistItem,
  completedByCode: Map<string, TranscriptCourseEntry>
): TransferRequirementStatus | null {
  const group = item.requirementGroup;
  if (!group || group.requirementType !== "choose_credits") {
    return null;
  }

  const explicitCourseCodes = unique(
    (group.options ?? []).flatMap((option) =>
      getRequirementOptionCourseLabels(option).flatMap((label) => extractCourseCodes(label))
    )
  );
  const matchedCourses: TranscriptCourseEntry[] = [];
  const usedCompletedCourseCodes = new Set<string>();
  let completedCredits = 0;

  for (const option of group.options ?? []) {
    const optionCourseCodes = unique(
      getRequirementOptionCourseLabels(option).flatMap((label) => extractCourseCodes(label))
    );
    const matchedCourse = optionCourseCodes
      .map((courseCode) => completedByCode.get(courseCode) ?? null)
      .find((course): course is TranscriptCourseEntry =>
        Boolean(course && !usedCompletedCourseCodes.has(course.code))
      );

    if (!matchedCourse) {
      continue;
    }

    usedCompletedCourseCodes.add(matchedCourse.code);
    matchedCourses.push(matchedCourse);
    completedCredits += getRequirementOptionCreditValue(option);
  }

  const requiredCreditCount = item.minCredits ?? group.minCredits ?? null;
  const maxCreditCount = item.maxCredits ?? group.maxCredits ?? null;
  const cappedCompletedCredits =
    maxCreditCount != null && maxCreditCount > 0
      ? Math.min(completedCredits, maxCreditCount)
      : completedCredits;
  const matched =
    requiredCreditCount != null && requiredCreditCount > 0
      ? cappedCompletedCredits >= requiredCreditCount
      : true;
  const creditProgressLabel =
    requiredCreditCount != null && requiredCreditCount > 0
      ? `${cappedCompletedCredits}/${requiredCreditCount} credits completed`
      : maxCreditCount != null && maxCreditCount > 0
        ? `${cappedCompletedCredits}/${maxCreditCount} credits counted`
        : null;

  return {
    item,
    matched,
    matchedCourses,
    explicitCourseCodes,
    requiredCompletedCount: requiredCreditCount != null && requiredCreditCount > 0 ? 1 : 0,
    completedCredits: cappedCompletedCredits,
    requiredCreditCount,
    maxCreditCount,
    creditProgressLabel,
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
    const creditStatus = buildChooseCreditsRequirementStatus(item, completedByCode);
    if (creditStatus) {
      return creditStatus;
    }

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

function buildCompletedCoursesByCode(completedCourses: TranscriptCourseEntry[]) {
  const completedByCode = new Map<string, TranscriptCourseEntry>();
  for (const course of completedCourses) {
    completedByCode.set(course.code, course);
  }
  return completedByCode;
}

function buildSourceBackedRequiredCourseDescriptorForItem(input: {
  item: TransferPlannerChecklistItem;
  bucket: RequirementPriorityBucket;
  completedByCode: Map<string, TranscriptCourseEntry>;
}) {
  const { item, bucket, completedByCode } = input;
  const courseOptions = getChecklistCourseOptions(item).map((courseLabels, index) =>
    buildRequirementCourseOption(item, courseLabels, index, completedByCode)
  );
  const selectedOption =
    selectPreferredRequirementOption(courseOptions) ??
    buildRequirementCourseOption(item, item.grcCourses, 0, completedByCode);
  const creditStatus = buildChooseCreditsRequirementStatus(item, completedByCode);
  const orderedCourseLabelSets = uniqueBy(
    [selectedOption.courseLabels, ...courseOptions.map((option) => option.courseLabels)]
      .map((courseLabels) =>
        courseLabels
          .map((label) => String(label ?? "").trim())
          .filter(Boolean)
      )
      .filter((courseLabels) => courseLabels.length > 0),
    (courseLabels) => courseLabels.join("||")
  );
  const hasChoiceSetStructure = orderedCourseLabelSets.length > 1;
  const hasMinimumCountStructure =
    selectedOption.requiredCompletedCount > 0 &&
    selectedOption.requiredCompletedCount < selectedOption.explicitCourseCodes.length;
  const hasRequirementGroupChoiceStructure = Boolean(
    item.requirementGroup &&
      ["choose_one", "choose_n", "choose_credits", "sequence_choice"].includes(
        item.requirementGroup.requirementType
      )
  );

  if (!orderedCourseLabelSets.length && !selectedOption.explicitCourseCodes.length) {
    return null;
  }

  return {
    id: item.id,
    kind: hasChoiceSetStructure || hasMinimumCountStructure || hasRequirementGroupChoiceStructure
      ? "choice-bucket"
      : selectedOption.explicitCourseCodes.length > 1
        ? "course-sequence"
        : "single-course",
    title: String(item.title ?? "").trim() || (selectedOption.explicitCourseCodes[0] ?? item.id),
    bucket,
    courseLabelSets: orderedCourseLabelSets,
    explicitCourseCodes: selectedOption.explicitCourseCodes,
    requiredCompletedCount: creditStatus?.requiredCompletedCount ?? selectedOption.requiredCompletedCount,
    requiredCreditCount:
      creditStatus?.requiredCreditCount ?? item.minCredits ?? item.requirementGroup?.minCredits ?? null,
    maxCreditCount:
      creditStatus?.maxCreditCount ?? item.maxCredits ?? item.requirementGroup?.maxCredits ?? null,
    completedCredits: creditStatus?.completedCredits ?? null,
    creditProgressLabel: creditStatus?.creditProgressLabel ?? null,
    requirementType: item.requirementGroup?.requirementType ?? null,
    requirementGroupId: item.requirementGroup?.id ?? null,
    requirementGroupLabel: item.requirementGroup?.label ?? null,
    selectedOptionLabels: getRequirementOptionLabelsByIds(
      item,
      item.selectedRequirementOptionIds
    ),
    otherOptionLabels: getRequirementOptionLabelsByIds(
      item,
      item.unselectedRequirementOptionIds
    ),
    note: String(item.note ?? "").trim() || null,
    guidanceSummary: buildChecklistGuidanceSummary(bucket, item),
  } satisfies SourceBackedRequiredCourseDescriptor;
}

function getSourceBackedRequiredCourseEquivalentUwCourseCodes(
  courseLabels: string[],
  campusId: TransferPlannerMajorPlan["campusId"] | null | undefined
) {
  return unique(
    courseLabels.flatMap((label) =>
      extractCourseCodes(label).flatMap((courseCode) =>
        buildBestSingleCourseUwEquivalentCourseCodes(courseCode, campusId)
      )
    )
  );
}

function buildSourceBackedRequiredCourseFallbackDescriptor(input: {
  courseCode: string;
}) {
  return {
    id: `source-backed-required-${input.courseCode.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`,
    kind: "single-course",
    title: input.courseCode,
    bucket: "source-backed-fallback",
    courseLabelSets: [[input.courseCode]],
    explicitCourseCodes: [input.courseCode],
    requiredCompletedCount: 1,
    requiredCreditCount: null,
    maxCreditCount: null,
    completedCredits: null,
    creditProgressLabel: null,
    requirementType: null,
    requirementGroupId: null,
    requirementGroupLabel: null,
    selectedOptionLabels: [],
    otherOptionLabels: [],
    note: null,
    guidanceSummary: null,
  } satisfies SourceBackedRequiredCourseDescriptor;
}

export function buildSourceBackedRequiredCourseDescriptors(
  plan: TransferPlannerMajorPlan | null | undefined,
  completedCourses: TranscriptCourseEntry[] = []
) {
  if (!plan) {
    return [] as SourceBackedRequiredCourseDescriptor[];
  }

  const completedByCode = buildCompletedCoursesByCode(completedCourses);
  const choiceOnlyCourseCodes = getChoiceOnlyChecklistCourseCodeSet(plan);
  const descriptors = [
    ...plan.applicationChecklist
      .map((item) =>
        buildSourceBackedRequiredCourseDescriptorForItem({
          item,
          bucket: "application",
          completedByCode,
        })
      )
      .filter((descriptor) => descriptor !== null),
    ...plan.beforeEnrollmentChecklist
      .map((item) =>
        buildSourceBackedRequiredCourseDescriptorForItem({
          item,
          bucket: "beforeEnrollment",
          completedByCode,
        })
      )
      .filter((descriptor) => descriptor !== null),
  ] as SourceBackedRequiredCourseDescriptor[];

  const {
    requiredUwCourseCodes,
    isCoveredRequiredUwCourseCode,
    markCoveredRequiredUwCourseCodes,
  } = buildSourceBackedRequiredUwCourseCoverage(plan);
  if (!requiredUwCourseCodes.size) {
    return descriptors;
  }

  for (const descriptor of descriptors) {
    for (const courseLabels of descriptor.courseLabelSets) {
      markCoveredRequiredUwCourseCodes(
        getSourceBackedRequiredCourseEquivalentUwCourseCodes(courseLabels, plan.campusId)
      );
    }
  }

  const existingDescriptorCourseCodes = new Set(
    descriptors
      .flatMap((descriptor) => descriptor.explicitCourseCodes)
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );

  for (const courseLabel of getTransferPlannerGrcCourseList(plan)) {
    for (const courseCode of extractCourseCodes(courseLabel)) {
      const normalizedCourseCode = normalizeCourseCode(courseCode);
      if (
        !normalizedCourseCode ||
        existingDescriptorCourseCodes.has(normalizedCourseCode) ||
        choiceOnlyCourseCodes.has(normalizedCourseCode) ||
        (hasCurrentComputingPrepSequence(existingDescriptorCourseCodes) &&
          isLegacyComputingPrepFallback(normalizedCourseCode))
      ) {
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

      descriptors.push(
        buildSourceBackedRequiredCourseFallbackDescriptor({ courseCode: normalizedCourseCode })
      );
      existingDescriptorCourseCodes.add(normalizedCourseCode);
      markCoveredRequiredUwCourseCodes(equivalentUwCourseCodes);
    }
  }

  for (const courseCode of getSourceBackedRequiredCoverageBackfillCourseCodes(plan)) {
    const normalizedCourseCode = normalizeCourseCode(courseCode);
    if (
      normalizedCourseCode &&
      !existingDescriptorCourseCodes.has(normalizedCourseCode) &&
      getTransferPlannerGrcCourseList(plan).includes(normalizedCourseCode)
    ) {
      descriptors.push(
        buildSourceBackedRequiredCourseFallbackDescriptor({ courseCode: normalizedCourseCode })
      );
      existingDescriptorCourseCodes.add(normalizedCourseCode);
    }
  }

  return descriptors;
}

function buildSourceBackedRequiredCourseDisplayLabel(courseCodeOrLabel: string) {
  const rawValue = String(courseCodeOrLabel ?? "").trim();
  if (!rawValue) return "";
  if (rawValue.includes(" - ")) return rawValue;

  const extractedCourseCode = extractCourseCodes(rawValue)[0] ?? rawValue;
  const normalizedCourseCode = normalizeCourseCode(extractedCourseCode);
  const canonicalCourse = getTransferPlannerCanonicalCourse("grc", normalizedCourseCode);
  if (canonicalCourse?.title) {
    return `${normalizedCourseCode} - ${canonicalCourse.title}`;
  }

  return rawValue === normalizedCourseCode ? rawValue : normalizedCourseCode;
}

function buildSourceBackedRequiredCourseUwEquivalentLabel(
  courseCode: string,
  campusId: TransferPlannerMajorPlan["campusId"]
) {
  const equivalentUwCourseCodes = buildBestSingleCourseUwEquivalentCourseCodes(courseCode, campusId);
  return equivalentUwCourseCodes.length ? joinPlannerLabelList(equivalentUwCourseCodes) : null;
}

function getSourceBackedUwCourseCanonicalTitle(
  courseCode: string,
  campusId: TransferPlannerMajorPlan["campusId"]
) {
  const campusEntry = getTransferPlannerCanonicalCourse(campusId, courseCode);
  if (campusEntry?.title) {
    return campusEntry.title;
  }

  for (const fallbackCampusId of ["uw-seattle", "uw-bothell", "uw-tacoma"] as const) {
    const fallbackEntry = getTransferPlannerCanonicalCourse(fallbackCampusId, courseCode);
    if (fallbackEntry?.title) {
      return fallbackEntry.title;
    }
  }

  return null;
}

function buildSourceBackedUwCourseConsideredDisplayLabel(input: {
  courseCode: string;
  campusId: TransferPlannerMajorPlan["campusId"];
  sourceTitle?: string | null;
}) {
  const normalizedCourseCode = normalizeCourseCode(input.courseCode);
  const canonicalTitle = getSourceBackedUwCourseCanonicalTitle(
    normalizedCourseCode,
    input.campusId
  );
  if (canonicalTitle) {
    return `${normalizedCourseCode} - ${canonicalTitle}`;
  }

  const sourceTitle = String(input.sourceTitle ?? "").replace(/\s+/g, " ").trim();
  if (sourceTitle && normalizeCourseCode(sourceTitle) !== normalizedCourseCode) {
    return `${normalizedCourseCode} - ${sourceTitle}`;
  }

  return normalizedCourseCode;
}

function shouldIncludeSourceBackedUwCourseConsideredCode(courseCode: string) {
  const level = getCourseLevel(courseCode);
  return level !== null && level < 500;
}

function getParsedRequirementCourseDisplayRank(input: {
  plan: TransferPlannerMajorPlan;
  requirementGroupId?: string | null;
}) {
  const selectedPathwayId =
    (input.plan as { selectedPathwayId?: string | null } | null | undefined)?.selectedPathwayId ??
    null;
  if (
    input.plan.id !== "uw-seattle-materials-science-engineering" ||
    selectedPathwayId !== "nme-option"
  ) {
    return 1;
  }

  const requirementGroupId = String(input.requirementGroupId ?? "");
  if (requirementGroupId.endsWith(":mse-nme-core-elective-19-credits")) {
    return 0;
  }
  if (
    requirementGroupId.endsWith(":mse-400-level-technical-electives") ||
    requirementGroupId.endsWith(":outside-mse-technical-electives")
  ) {
    return 2;
  }

  return 1;
}

export function buildSourceBackedUwCourseConsideredSummaryEntries(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) {
    return [] as SourceBackedUwCourseConsideredSummaryEntry[];
  }

  const entries: SourceBackedUwCourseConsideredSummaryEntry[] = [];
  const entryIndexByCourseCode = new Map<string, number>();
  const getMetadataRank = (metadata: Partial<SourceBackedUwCourseConsideredSummaryEntry>) => {
    const hasStructuredMetadata =
      Boolean(metadata.requirementGroupId) ||
      Boolean(metadata.requirementType) ||
      Boolean(metadata.optionRole) ||
      Boolean(metadata.category);
    return {
      displayRank: hasStructuredMetadata
        ? getParsedRequirementCourseDisplayRank({
            plan,
            requirementGroupId: metadata.requirementGroupId,
          })
        : Number.POSITIVE_INFINITY,
      hasStructuredMetadata,
    };
  };
  const shouldReplaceExistingMetadata = (
    existing: SourceBackedUwCourseConsideredSummaryEntry,
    next: Partial<SourceBackedUwCourseConsideredSummaryEntry>
  ) => {
    const existingRank = getMetadataRank(existing);
    const nextRank = getMetadataRank(next);
    if (nextRank.displayRank !== existingRank.displayRank) {
      return nextRank.displayRank < existingRank.displayRank;
    }
    if (nextRank.hasStructuredMetadata !== existingRank.hasStructuredMetadata) {
      return nextRank.hasStructuredMetadata;
    }
    return Boolean(next.requirementGroupId) && !existing.requirementGroupId;
  };
  const addCourseCode = (
    courseCode: string,
    sourceTitle?: string | null,
    metadata: Partial<SourceBackedUwCourseConsideredSummaryEntry> = {}
  ) => {
    const normalizedCourseCode = normalizeCourseCode(courseCode);
    if (
      !normalizedCourseCode ||
      !shouldIncludeSourceBackedUwCourseConsideredCode(normalizedCourseCode)
    ) {
      return;
    }

    const nextEntry = {
      id: normalizedCourseCode.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      courseCode: normalizedCourseCode,
      normalizedCourseCode,
      text: buildSourceBackedUwCourseConsideredDisplayLabel({
        courseCode: normalizedCourseCode,
        campusId: plan.campusId,
        sourceTitle,
      }),
      ...metadata,
    } satisfies SourceBackedUwCourseConsideredSummaryEntry;

    const existingEntryIndex = entryIndexByCourseCode.get(normalizedCourseCode);
    if (existingEntryIndex !== undefined) {
      const existingEntry = entries[existingEntryIndex];
      if (existingEntry && shouldReplaceExistingMetadata(existingEntry, nextEntry)) {
        entries[existingEntryIndex] = {
          ...existingEntry,
          ...nextEntry,
          id: existingEntry.id,
        };
      }
      return;
    }

    entryIndexByCourseCode.set(normalizedCourseCode, entries.length);
    entries.push(nextEntry);
  };

  for (const block of getSourceBackedRequirementSourceBlocksForPlan(plan)) {
    if ((block.parsedRequirementCourses ?? []).length) {
      const parsedRequirementCourses = [...(block.parsedRequirementCourses ?? [])].sort(
        (left, right) =>
          getParsedRequirementCourseDisplayRank({
            plan,
            requirementGroupId: left.requirementGroupId,
          }) -
          getParsedRequirementCourseDisplayRank({
            plan,
            requirementGroupId: right.requirementGroupId,
          })
      );
      for (const course of parsedRequirementCourses) {
        addCourseCode(course.normalizedCourseCode, course.title, {
          title: course.title ?? null,
          credits: course.credits ?? null,
          creditMin: course.creditMin ?? null,
          creditMax: course.creditMax ?? null,
          creditText: course.creditText ?? null,
          category: course.category ?? null,
          requirementGroupId: course.requirementGroupId ?? null,
          requirementType: course.requirementType ?? null,
          optionRole: course.optionRole ?? null,
          sourceHeading: course.sourceHeading ?? null,
          sourceCategory: course.sourceCategory ?? null,
          notes: course.notes ?? [],
        });
      }
      continue;
    }

    for (const candidate of block.parsedRequirementAtomCandidates ?? []) {
      addCourseCode(candidate.uwCourseCode, candidate.title);
    }

    for (const blockCandidate of block.parsedDegreeMapBlockCandidates ?? []) {
      for (const courseCode of blockCandidate.uwCourseCodes ?? []) {
        addCourseCode(courseCode, blockCandidate.title);
      }
    }

    for (const group of block.parsedRequirementGroups ?? []) {
      for (const option of group.options ?? []) {
        const sourceTitle = option.title ?? option.label ?? group.label;
        for (const courseCode of [
          ...(option.uwCourses ?? []),
          ...(option.equivalentUwCourseCodes ?? []),
        ]) {
          addCourseCode(courseCode, sourceTitle);
        }
      }
    }

    for (const sourceLine of block.requirementCueLines ?? []) {
      for (const courseCode of extractSourceBackedUwCourseCodesFromRequirementText(sourceLine)) {
        addCourseCode(courseCode);
      }
    }
  }

  const selectedPathwayId = getSelectedPathwayId(plan);
  const metadataBlocks = uniqueBy(
    [
      ...getTransferPlannerParsedRequirementSourceBlocks(plan.id, selectedPathwayId),
      ...(selectedPathwayId
        ? getTransferPlannerParsedRequirementSourceBlocks(plan.id, null)
        : []),
    ],
    (block) => block.id
  );
  for (const block of metadataBlocks) {
    const parsedRequirementCourses = [...(block.parsedRequirementCourses ?? [])].sort(
      (left, right) =>
        getParsedRequirementCourseDisplayRank({
          plan,
          requirementGroupId: left.requirementGroupId,
        }) -
        getParsedRequirementCourseDisplayRank({
          plan,
          requirementGroupId: right.requirementGroupId,
        })
    );
    for (const course of parsedRequirementCourses) {
      addCourseCode(course.normalizedCourseCode, course.title, {
        title: course.title ?? null,
        credits: course.credits ?? null,
        creditMin: course.creditMin ?? null,
        creditMax: course.creditMax ?? null,
        creditText: course.creditText ?? null,
        category: course.category ?? null,
        requirementGroupId: course.requirementGroupId ?? null,
        requirementType: course.requirementType ?? null,
        optionRole: course.optionRole ?? null,
        sourceHeading: course.sourceHeading ?? null,
        sourceCategory: course.sourceCategory ?? null,
        notes: course.notes ?? [],
      });
    }
  }

  for (const group of plan.requirementGroups ?? []) {
    const requirementType = group.requirementType as
      | TransferPlannerRequirementType
      | "sequence_required";
    const groupSourceCategory = (
      group as typeof group & {
        sourceCategory?: string | null;
      }
    ).sourceCategory;
    const optionRole =
      requirementType === "all_required" || requirementType === "sequence_required"
        ? "required"
        : "option";
    for (const option of group.options ?? []) {
      const optionMetadata = option as typeof option & {
        optionRole?: string | null;
      };
      const sourceTitle = option.title ?? option.label ?? group.label;
      for (const courseCode of [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
      ]) {
        addCourseCode(courseCode, sourceTitle, {
          title: option.title ?? null,
          credits: option.credits ?? null,
          creditMin: option.creditMin ?? null,
          creditMax: option.creditMax ?? null,
          creditText: option.creditText ?? null,
          category: option.category ?? group.category ?? null,
          requirementGroupId: group.id,
          requirementType: group.requirementType ?? null,
          optionRole: optionMetadata.optionRole ?? optionRole,
          sourceHeading: option.sourceHeading ?? group.sourceHeading ?? null,
          sourceCategory: option.sourceCategory ?? groupSourceCategory ?? null,
          notes: option.notes ?? [],
        });
      }
    }
  }

  const requiredUwCourseCodes = getSourceBackedRequiredUwCourseCodeSet(plan);
  for (const entry of entries) {
    if (
      !entry.optionRole &&
      entry.normalizedCourseCode &&
      requiredUwCourseCodes.has(entry.normalizedCourseCode)
    ) {
      entry.optionRole = "required";
    }
  }

  return entries;
}

function buildSourceBackedRequiredCourseSentence(input: {
  courseCode: string;
  campusId: TransferPlannerMajorPlan["campusId"];
  mode: "grc" | "uw";
}) {
  const courseLabel = buildSourceBackedRequiredCourseDisplayLabel(input.courseCode);
  if (input.mode !== "uw") {
    return `${courseLabel} is required.`;
  }

  const uwEquivalentLabel = buildSourceBackedRequiredCourseUwEquivalentLabel(
    input.courseCode,
    input.campusId
  );
  if (!uwEquivalentLabel) {
    return `${courseLabel} is required.`;
  }

  return `${courseLabel} is required. UW equivalent: ${uwEquivalentLabel}.`;
}

function buildSourceBackedChoiceRequirementSentence(
  descriptor: SourceBackedRequiredCourseDescriptor
) {
  const noteParts = [descriptor.note, descriptor.guidanceSummary]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  const noteSuffix = noteParts.length ? ` ${joinGuidanceSummaries(...noteParts)}` : "";
  const buildOptionText = (labels: string[], limit = CHECKLIST_CHOICE_PREVIEW_LIMIT) => {
    const previewLabels = labels.slice(0, limit);
    const hiddenCount = Math.max(labels.length - previewLabels.length, 0);
    const optionText = joinPlannerLabelList(
      previewLabels.map((courseLabel) => buildSourceBackedRequiredCourseDisplayLabel(courseLabel))
    );
    return hiddenCount > 0 ? `${optionText}, plus ${hiddenCount} more` : optionText;
  };

  if (descriptor.requirementType === "choose_credits") {
    const labelContext = descriptor.title;
    const chooseLabel =
      descriptor.requiredCreditCount != null && descriptor.requiredCreditCount > 0
        ? /nme option core\/elective|nme core elective/i.test(labelContext)
          ? `NME Option Core/Elective Requirement: ${descriptor.requiredCreditCount} credits`
          : /engineering fundamentals/i.test(labelContext)
          ? `Choose at least ${descriptor.requiredCreditCount} credits from Engineering Fundamentals electives`
          : /mse 400-level/i.test(labelContext)
            ? `Choose at least ${descriptor.requiredCreditCount} credits from MSE 400-level technical electives`
            : `Choose at least ${descriptor.requiredCreditCount} credits from ${descriptor.title}`
        : descriptor.maxCreditCount != null && descriptor.maxCreditCount > 0
          ? /outside-mse/i.test(labelContext)
            ? `Up to ${descriptor.maxCreditCount} credits may count from approved outside-MSE technical electives`
            : `Up to ${descriptor.maxCreditCount} credits may count from ${descriptor.title}`
          : `${descriptor.title} - Choose approved credits`;
    const progressText = descriptor.creditProgressLabel
      ? ` ${descriptor.creditProgressLabel}.`
      : "";
    const selectedOptionText = descriptor.selectedOptionLabels.length
      ? ` Selected for this credit requirement: ${buildOptionText(descriptor.selectedOptionLabels)}.`
      : "";
    const otherOptionText = descriptor.otherOptionLabels.length
      ? ` Other approved options: ${buildOptionText(descriptor.otherOptionLabels)}.`
      : "";

    return `${chooseLabel}.${progressText}${selectedOptionText}${otherOptionText}${noteSuffix}`;
  }

  if (descriptor.requirementType === "choose_n") {
    const chooseLabel = descriptor.title
      .replace(/^One\s*(?:\(\s*1\s*\))?\s*/i, "")
      .replace(/^Two\s+/i, "")
      .trim();
    const selectedOptionText = descriptor.selectedOptionLabels.length
      ? ` Selected option${descriptor.selectedOptionLabels.length === 1 ? "" : "s"}: ${buildOptionText(
          descriptor.selectedOptionLabels
        )}.`
      : "";
    const otherOptionText = descriptor.otherOptionLabels.length
      ? ` Other valid options: ${buildOptionText(descriptor.otherOptionLabels)}.`
      : "";

    return `Choose ${descriptor.requiredCompletedCount} ${
      chooseLabel || descriptor.title
    }.${selectedOptionText}${otherOptionText}${noteSuffix}`;
  }

  if (descriptor.courseLabelSets.length > 1) {
    const optionText = descriptor.courseLabelSets
      .map((courseLabels) =>
        joinPlannerLabelList(
          courseLabels.map((courseLabel) =>
            buildSourceBackedRequiredCourseDisplayLabel(courseLabel)
          )
        )
      )
      .join("; or ");
    const choiceAction =
      descriptor.requirementType === "choose_one"
        ? "Choose one"
        : "complete one approved option";
    return `${descriptor.title} - ${choiceAction}. Options: ${optionText}.${noteSuffix}`;
  }

  const choiceLabels = joinPlannerLabelList(
    (descriptor.courseLabelSets[0] ?? descriptor.explicitCourseCodes).map((courseLabel) =>
      buildSourceBackedRequiredCourseDisplayLabel(courseLabel)
    )
  );
  if (descriptor.requiredCreditCount) {
    return `${descriptor.title} - Choose ${descriptor.requiredCreditCount} credits from this list. Options: ${choiceLabels}.${noteSuffix}`;
  }

  const chooseCount =
    descriptor.requiredCompletedCount === 1 ? "one" : String(descriptor.requiredCompletedCount);
  return `${descriptor.title} - Choose ${chooseCount} from this list. Options: ${choiceLabels}.${noteSuffix}`;
}

export function buildSourceBackedRequiredCourseSummaryEntries(
  plan: TransferPlannerMajorPlan | null | undefined,
  options: {
    mode?: "grc" | "uw";
    completedCourses?: TranscriptCourseEntry[];
  } = {}
) {
  if (!plan) {
    return [] as SourceBackedRequiredCourseSummaryEntry[];
  }

  const mode = options.mode ?? "grc";
  const descriptors = buildSourceBackedRequiredCourseDescriptors(
    plan,
    options.completedCourses ?? []
  );
  const entries: SourceBackedRequiredCourseSummaryEntry[] = [];
  const seenCourseCodes = new Set<string>();
  const choiceOnlyCourseCodes = getChoiceOnlyChecklistCourseCodeSet(plan);

  for (const descriptor of descriptors) {
    if (descriptor.kind === "choice-bucket") {
      entries.push({
        id: descriptor.id,
        descriptorId: descriptor.id,
        kind: descriptor.kind,
        text: buildSourceBackedChoiceRequirementSentence(descriptor),
      });
      continue;
    }

    for (const courseCode of descriptor.explicitCourseCodes) {
      const normalizedCourseCode = normalizeCourseCode(courseCode);
      if (
        !normalizedCourseCode ||
        seenCourseCodes.has(normalizedCourseCode) ||
        choiceOnlyCourseCodes.has(normalizedCourseCode)
      ) {
        continue;
      }

      seenCourseCodes.add(normalizedCourseCode);
      entries.push({
        id: `${descriptor.id}:${normalizedCourseCode}`,
        descriptorId: descriptor.id,
        kind: descriptor.kind,
        text: buildSourceBackedRequiredCourseSentence({
          courseCode: normalizedCourseCode,
          campusId: plan.campusId,
          mode,
        }),
      });
    }
  }

  return entries;
}

const MAJOR_SPECIFICS_COURSE_SECTIONS: {
  id: MajorSpecificsCourseSectionId;
  label: string;
  description: string;
}[] = [
  {
    id: "gen-ed-breadth-requirements",
    label: "Gen-Ed Requirements",
    description: "These satisfy UW Areas of Inquiry, Diversity, or related breadth categories.",
  },
  {
    id: "official-uw-required-courses",
    label: "Official UW Required Courses",
    description: "These are directly required by the UW degree page.",
  },
  {
    id: "selected-uw-requirement-options",
    label: "Selected UW Requirement Options",
    description: "These are chosen from UW-approved option groups.",
  },
  {
    id: "other-valid-uw-options",
    label: "Other Valid UW Options",
    description: "These are approved alternatives, but they are not currently selected in this plan.",
  },
  {
    id: "green-river-prerequisites",
    label: "Green River Prerequisites",
    description: "These help unlock later Green River courses in the planned sequence.",
  },
  {
    id: "matched-green-river-track-courses",
    label: "Matched Green River Track Courses",
    description: "These come from the closest matching Green River associate pathway.",
  },
  {
    id: "restricted-or-replaced-requirements",
    label: "Restricted or Replaced Requirements",
    description: "These are not active for the selected option, or have special restrictions.",
  },
];

const MAJOR_SPECIFICS_COURSE_SECTION_BY_ID = new Map(
  MAJOR_SPECIFICS_COURSE_SECTIONS.map((section) => [section.id, section] as const)
);

function getSelectedPathwayId(plan: TransferPlannerMajorPlan | null | undefined) {
  return (plan as { selectedPathwayId?: string | null } | null | undefined)?.selectedPathwayId ?? null;
}

function getMajorSpecificsPrimarySource(plan: TransferPlannerMajorPlan) {
  const selectedPathwayId = getSelectedPathwayId(plan);
  const primarySource = getTransferPlannerPrimaryDegreeRequirementsSource(
    plan.id,
    selectedPathwayId
  );
  const fallbackLink = plan.officialLinks[0] ?? null;

  return {
    sourceUrl: primarySource?.url ?? fallbackLink?.url ?? null,
    sourceLabel: primarySource?.label ?? fallbackLink?.label ?? null,
  };
}

function getMajorSpecificsSectionMetadata(categoryId: MajorSpecificsCourseSectionId) {
  return (
    MAJOR_SPECIFICS_COURSE_SECTION_BY_ID.get(categoryId) ??
    MAJOR_SPECIFICS_COURSE_SECTIONS[0]
  );
}

function getMajorSpecificsRowKey(row: MajorSpecificsCourseRow) {
  return [
    row.categoryId,
    row.normalizedCourseCode || row.displayCourseCode,
    row.requirementGroupId ?? "",
    row.requirementRole,
  ].join("||");
}

function makeMajorSpecificsCourseRow(
  input: Omit<MajorSpecificsCourseRow, "categoryLabel" | "categoryDescription">
): MajorSpecificsCourseRow {
  const section = getMajorSpecificsSectionMetadata(input.categoryId);
  return {
    ...input,
    categoryLabel: section.label,
    categoryDescription: section.description,
  };
}

function getCourseCodeForMajorSpecificsLabel(label: string) {
  return normalizeCourseCode(extractCourseCodes(label)[0] ?? label);
}

function getRequirementOptionUwCourseCodes(option: RequirementGroupOption) {
  return unique(
    [...(option.uwCourses ?? []), ...(option.equivalentUwCourseCodes ?? [])]
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function getRequirementOptionDisplayCourseCode(option: RequirementGroupOption) {
  return (
    option.displayCourseCodes?.[0] ??
    option.uwCourses?.[0] ??
    option.equivalentUwCourseCodes?.[0] ??
    option.grcMatches?.[0] ??
    option.label ??
    ""
  );
}

function getRequirementOptionNormalizedCourseCode(option: RequirementGroupOption) {
  return normalizeCourseCode(
    option.uwCourses?.[0] ??
      option.equivalentUwCourseCodes?.[0] ??
      option.grcMatches?.[0] ??
      getRequirementOptionDisplayCourseCode(option)
  );
}

function getRequirementOptionUwLabel(option: RequirementGroupOption) {
  return getRequirementOptionUwCourseCodes(option).join(" / ");
}

function getRequirementOptionCourseCodeLabel(labels: string[]) {
  return unique(
    labels
      .map((label) => extractCourseCodes(label)[0] ?? label)
      .map((label) => String(label ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
  ).join(" / ");
}

function getRequirementOptionDisplayLabel(option: RequirementGroupOption) {
  const grcCourseCodes = getRequirementOptionCourseCodeLabel(option.grcMatches ?? []);
  if (grcCourseCodes) {
    const firstGrcMatch = option.grcMatches?.[0] ?? grcCourseCodes;
    const displayLabel = buildSourceBackedRequiredCourseDisplayLabel(firstGrcMatch);
    return grcCourseCodes.includes(" / ") ? grcCourseCodes : displayLabel;
  }

  return getRequirementOptionUwLabel(option) || option.label || getRequirementOptionDisplayCourseCode(option);
}

function getRequirementOptionSelectedLabel(option: RequirementGroupOption) {
  const grcCourseCodes = getRequirementOptionCourseCodeLabel(option.grcMatches ?? []);
  if (grcCourseCodes) {
    return grcCourseCodes;
  }

  return (
    getRequirementOptionUwLabel(option) ||
    getRequirementOptionCourseCodeLabel(option.displayCourseCodes ?? []) ||
    option.label ||
    getRequirementOptionDisplayCourseCode(option)
  );
}

function getRequirementOptionAlternativePairLabel(option: RequirementGroupOption) {
  const grcCourseCodes = getRequirementOptionCourseCodeLabel(option.grcMatches ?? []);
  const uwCourseCodes = grcCourseCodes
    ? unique((option.uwCourses ?? []).map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)).join(" / ")
    : getRequirementOptionUwLabel(option);
  if (grcCourseCodes && uwCourseCodes) {
    return `${grcCourseCodes} / ${uwCourseCodes}`;
  }
  return uwCourseCodes || grcCourseCodes || option.label || "";
}

function joinPlannerAlternativeLabelList(labels: string[]) {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}

function buildSelectedRequirementOptionAlternativeText(input: {
  selectedOption: RequirementGroupOption;
  alternativeOptions: RequirementGroupOption[];
}) {
  const selectedLabel = getRequirementOptionAlternativePairLabel(input.selectedOption);
  const alternativeLabels = unique(
    input.alternativeOptions
      .map((option) => getRequirementOptionAlternativePairLabel(option))
      .filter(Boolean)
  );

  if (!selectedLabel || !alternativeLabels.length) {
    return null;
  }

  const previewLabels = alternativeLabels.slice(0, 6);
  const hiddenCount = Math.max(alternativeLabels.length - previewLabels.length, 0);
  const optionsText = hiddenCount > 0
    ? `${previewLabels.join(", ")}, or other approved options`
    : joinPlannerAlternativeLabelList(previewLabels);

  return `Instead of taking ${selectedLabel}, you can take ${optionsText}.`;
}

function isNmeRequirementGroup(group: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>) {
  return (
    group.id.endsWith(":mse-nme-core-elective-19-credits") ||
    group.category === "nme_core_elective"
  );
}

function getSelectedRequirementOptionsForItem(item: TransferPlannerChecklistItem) {
  const group = item.requirementGroup;
  if (!group) return [] as RequirementGroupOption[];

  const selectedIds = new Set(
    (item.selectedRequirementOptionIds ?? [])
      .map((optionId) => String(optionId ?? "").trim())
      .filter(Boolean)
  );
  if (selectedIds.size) {
    return group.options.filter((option) => option.id && selectedIds.has(option.id));
  }

  const selectionCount = Math.max(
    1,
    item.minCompletedCount ?? group.minCourses ?? (group.requirementType === "choose_one" ? 1 : 0)
  );
  if (group.requirementType === "choose_credits") {
    if (!group.minCredits || group.minCredits <= 0) {
      return [];
    }
    let selectedCredits = 0;
    const selectedOptions: RequirementGroupOption[] = [];
    for (const option of group.options) {
      selectedOptions.push(option);
      selectedCredits += getRequirementOptionCreditValue(option);
      if (group.minCredits && selectedCredits >= group.minCredits) {
        break;
      }
    }
    return selectedOptions;
  }

  return group.options.slice(0, selectionCount);
}

function getAlternativeRequirementOptionsForItem(
  item: TransferPlannerChecklistItem,
  selectedOption: RequirementGroupOption
) {
  const group = item.requirementGroup;
  if (!group) return [] as RequirementGroupOption[];

  return group.options.filter((option) => option.id !== selectedOption.id);
}

function buildSelectedRequirementOptionSentence(input: {
  item: TransferPlannerChecklistItem;
  option: RequirementGroupOption;
}) {
  const displayLabel = getRequirementOptionDisplayLabel(input.option);
  const uwLabel = getRequirementOptionUwLabel(input.option);
  const requirementLabel =
    input.item.requirementGroup?.requirementType === "choose_credits"
      ? "this credit requirement"
      : "this requirement";

  if (input.option.grcMatches?.length && uwLabel) {
    return `${displayLabel} is selected for ${requirementLabel}. UW equivalent: ${uwLabel}.`;
  }

  return `${displayLabel} is selected for ${requirementLabel}.`;
}

function buildAlternativeRequirementOptionSentence(input: {
  item: TransferPlannerChecklistItem;
  option: RequirementGroupOption;
}) {
  const displayLabel =
    getRequirementOptionUwLabel(input.option) ||
    getRequirementOptionDisplayLabel(input.option);
  const groupLabel = input.item.requirementGroup?.label ?? input.item.title;
  return `${displayLabel} is an approved alternative for ${groupLabel}.`;
}

function buildMajorSpecificsOptionRows(input: {
  plan: TransferPlannerMajorPlan;
  item: TransferPlannerChecklistItem;
}) {
  const group = input.item.requirementGroup;
  if (!group || !["choose_one", "choose_n", "choose_credits", "sequence_choice"].includes(group.requirementType)) {
    return [] as MajorSpecificsCourseRow[];
  }

  const rows: MajorSpecificsCourseRow[] = [];
  const source = getMajorSpecificsPrimarySource(input.plan);
  const selectedOptions = getSelectedRequirementOptionsForItem(input.item);
  const selectedIds = new Set(
    selectedOptions.map((option) => option.id).filter((optionId): optionId is string => Boolean(optionId))
  );
  const sourceType: MajorSpecificsCourseSourceType = isNmeRequirementGroup(group)
    ? "nme_option_requirement"
    : "selected_uw_option";

  for (const option of selectedOptions) {
    const alternativeOptions = getAlternativeRequirementOptionsForItem(input.item, option);
    const alternativeOptionsText = buildSelectedRequirementOptionAlternativeText({
      selectedOption: option,
      alternativeOptions,
    });
    const alternativeOptionsShown = alternativeOptionsText
      ? alternativeOptions
          .map((alternativeOption) => getRequirementOptionAlternativePairLabel(alternativeOption))
          .filter(Boolean)
          .slice(0, 6)
      : [];

    rows.push(
      makeMajorSpecificsCourseRow({
        id: `${input.item.id}:selected:${option.id ?? getRequirementOptionNormalizedCourseCode(option)}`,
        categoryId: "selected-uw-requirement-options",
        displayCourseCode: getRequirementOptionDisplayCourseCode(option),
        normalizedCourseCode: getRequirementOptionNormalizedCourseCode(option),
        title: option.title ?? option.label ?? null,
        credits: option.credits ?? option.creditMin ?? null,
        text: buildSelectedRequirementOptionSentence({ item: input.item, option }),
        alternativeOptionsText,
        alternativeOptionsShown,
        sourceType,
        requirementRole: "selected_option",
        requirementGroupId: group.id,
        requirementGroupLabel: group.label,
        requirementType: group.requirementType,
        selectedForRequirement: true,
        satisfiesRequirement: true,
        countsTowardUwRequirement: true,
        countsTowardGrcTrack: false,
        countsTowardPrerequisiteChain: false,
        countsTowardGenEd: false,
        restrictionStatus: null,
        explanation: `Selected option for ${group.label}.`,
        ...source,
      })
    );
  }

  for (const option of group.options) {
    if (option.id && selectedIds.has(option.id)) {
      continue;
    }

    rows.push(
      makeMajorSpecificsCourseRow({
        id: `${input.item.id}:alternative:${option.id ?? getRequirementOptionNormalizedCourseCode(option)}`,
        categoryId: "other-valid-uw-options",
        displayCourseCode: getRequirementOptionDisplayCourseCode(option),
        normalizedCourseCode: getRequirementOptionNormalizedCourseCode(option),
        title: option.title ?? option.label ?? null,
        credits: option.credits ?? option.creditMin ?? null,
        text: buildAlternativeRequirementOptionSentence({ item: input.item, option }),
        alternativeOptionsText: null,
        alternativeOptionsShown: [],
        sourceType: isNmeRequirementGroup(group) ? "nme_option_requirement" : "official_uw_option",
        requirementRole: "alternative_option",
        requirementGroupId: group.id,
        requirementGroupLabel: group.label,
        requirementType: group.requirementType,
        selectedForRequirement: false,
        satisfiesRequirement: false,
        countsTowardUwRequirement: false,
        countsTowardGrcTrack: false,
        countsTowardPrerequisiteChain: false,
        countsTowardGenEd: false,
        restrictionStatus: null,
        explanation: `Approved alternative for ${group.label}.`,
        ...source,
      })
    );
  }

  return rows;
}

function buildMajorSpecificsRequiredRows(input: {
  plan: TransferPlannerMajorPlan;
  completedCourses: TranscriptCourseEntry[];
}) {
  const source = getMajorSpecificsPrimarySource(input.plan);
  return buildSourceBackedRequiredCourseDescriptors(input.plan, input.completedCourses)
    .filter((descriptor) => descriptor.kind !== "choice-bucket")
    .flatMap((descriptor) =>
      descriptor.explicitCourseCodes.map((courseCode) => {
        const normalizedCourseCode = normalizeCourseCode(courseCode);
        return makeMajorSpecificsCourseRow({
          id: `${descriptor.id}:required:${normalizedCourseCode}`,
          categoryId: "official-uw-required-courses",
          displayCourseCode: normalizedCourseCode,
          normalizedCourseCode,
          title: null,
          credits: null,
          text: buildSourceBackedRequiredCourseSentence({
            courseCode: normalizedCourseCode,
            campusId: input.plan.campusId,
            mode: "uw",
          }),
          alternativeOptionsText: null,
          alternativeOptionsShown: [],
          sourceType: "official_uw_requirement",
          requirementRole: "required",
          requirementGroupId: descriptor.requirementGroupId,
          requirementGroupLabel: descriptor.requirementGroupLabel,
          requirementType: descriptor.requirementType ?? "all_required",
          selectedForRequirement: true,
          satisfiesRequirement: true,
          countsTowardUwRequirement: true,
          countsTowardGrcTrack: false,
          countsTowardPrerequisiteChain: false,
          countsTowardGenEd: false,
          restrictionStatus: null,
          explanation: "Directly required by the UW degree page.",
          ...source,
        });
      })
    );
}

function buildMajorSpecificsChoiceRows(input: {
  plan: TransferPlannerMajorPlan;
}) {
  const checklistItems = [
    ...input.plan.applicationChecklist,
    ...input.plan.beforeEnrollmentChecklist,
    ...input.plan.stayAtGrcChecklist,
  ];
  return checklistItems.flatMap((item) => buildMajorSpecificsOptionRows({ plan: input.plan, item }));
}

function getSelectedRequirementOptionGrcCourseCodes(plan: TransferPlannerMajorPlan) {
  return unique(
    [
      ...plan.applicationChecklist,
      ...plan.beforeEnrollmentChecklist,
      ...plan.stayAtGrcChecklist,
    ].flatMap((item) =>
      getSelectedRequirementOptionsForItem(item)
        .flatMap((option) => option.grcMatches ?? [])
        .flatMap((label) => extractCourseCodes(label))
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean)
    )
  );
}

function buildMajorSpecificsSuggestedPlanRows(input: {
  plan: TransferPlannerMajorPlan;
  track?: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
}) {
  const track = input.track ?? null;
  const applicationStatuses = buildRequirementStatuses(
    input.plan.applicationChecklist,
    input.completedCourses
  );
  const beforeEnrollmentStatuses = buildRequirementStatuses(
    input.plan.beforeEnrollmentChecklist,
    input.completedCourses
  );
  const stayAtGrcStatuses = buildRequirementStatuses(
    input.plan.stayAtGrcChecklist,
    input.completedCourses
  );
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: input.plan,
    applicationStatuses,
    beforeEnrollmentStatuses,
    stayAtGrcStatuses,
    completedCourses: input.completedCourses,
    track,
    includeStayAtGrcCourses: true,
  });
  const requiredOrSelectedCodes = new Set(
    [
      ...buildMajorSpecificsRequiredRows({
        plan: input.plan,
        completedCourses: input.completedCourses,
      }),
      ...buildMajorSpecificsChoiceRows({ plan: input.plan }),
    ]
      .filter((row) => row.countsTowardUwRequirement)
      .map((row) => normalizeCourseCode(row.normalizedCourseCode))
      .filter(Boolean)
      .concat(getSelectedRequirementOptionGrcCourseCodes(input.plan))
  );
  const trackSource = {
    sourceUrl: track?.officialLinks?.[0]?.url ?? null,
    sourceLabel: track?.title ?? null,
  };
  const rows: MajorSpecificsCourseRow[] = [];
  const seen = new Set<string>();
  const addRow = (row: MajorSpecificsCourseRow) => {
    const key = getMajorSpecificsRowKey(row);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  for (const course of suggestedPlan.flatMap((quarter) => quarter.courses)) {
    const label = String(course.label ?? "").trim();
    if (!label) continue;
    if (isMergedCourseDistributionRequirementLabel(label)) continue;

    const normalizedCourseCode = getCourseCodeForMajorSpecificsLabel(label);
    const isPrerequisite = /\bprerequisite\b/i.test(course.guidanceSummary ?? "");
    const isTrackCourse = course.sourceKind === "official-grc-track";
    const isUwMajorBreadth = course.sourceKind === "uw-major-breadth";
    const isMatchedGrcTrackBreadth = course.sourceKind === "official-grc-track-breadth";

    if (normalizedCourseCode && requiredOrSelectedCodes.has(normalizedCourseCode)) {
      continue;
    }

    if (isUwMajorBreadth) {
      continue;
    }

    if (isMatchedGrcTrackBreadth) {
      const categoryId: MajorSpecificsCourseSectionId = "matched-green-river-track-courses";
      addRow(
        makeMajorSpecificsCourseRow({
          id: `major-specifics:${categoryId}:breadth:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          categoryId,
          displayCourseCode: label,
          normalizedCourseCode: normalizedCourseCode || label,
          title: label,
          credits: null,
          text: course.guidanceSummary ? `${label}. ${course.guidanceSummary}` : label,
          alternativeOptionsText: null,
          alternativeOptionsShown: [],
          sourceType: "grc_matched_track",
          requirementRole: "matched_track_course",
          requirementGroupId: null,
          requirementGroupLabel: null,
          requirementType: null,
          selectedForRequirement: false,
          satisfiesRequirement: false,
          countsTowardUwRequirement: false,
          countsTowardGrcTrack: true,
          countsTowardPrerequisiteChain: false,
          countsTowardGenEd: true,
          restrictionStatus: null,
          explanation:
            "Matched Green River associate pathway breadth slot; not a UW major-specific general education requirement.",
          ...trackSource,
        })
      );
      continue;
    }

    if (isPrerequisite && !isTrackCourse) {
      continue;
    }

    if (isTrackCourse) {
      const categoryId: MajorSpecificsCourseSectionId = "matched-green-river-track-courses";
      addRow(
        makeMajorSpecificsCourseRow({
          id: `major-specifics:${categoryId}:${normalizedCourseCode || label}`,
          categoryId,
          displayCourseCode: normalizedCourseCode || label,
          normalizedCourseCode: normalizedCourseCode || label,
          title: null,
          credits: null,
          text: course.guidanceSummary ? `${label}. ${course.guidanceSummary}` : label,
          alternativeOptionsText: null,
          alternativeOptionsShown: [],
          sourceType: "grc_matched_track",
          requirementRole: "matched_track_course",
          requirementGroupId: null,
          requirementGroupLabel: null,
          requirementType: null,
          selectedForRequirement: false,
          satisfiesRequirement: false,
          countsTowardUwRequirement: false,
          countsTowardGrcTrack: true,
          countsTowardPrerequisiteChain: isPrerequisite,
          countsTowardGenEd: false,
          restrictionStatus: null,
          explanation: isPrerequisite
            ? "Included by the matched Green River associate pathway and useful for prerequisite sequencing."
            : "Included by the matched Green River associate pathway.",
          ...trackSource,
        })
      );
    }
  }

  return rows;
}

function formatRequirementReplacementLabel(requirementId: string) {
  if (requirementId.endsWith(":mse-technical-electives-15-credits")) {
    return "Technical Electives: 15 credits";
  }
  if (requirementId.endsWith(":mse-nme-core-elective-19-credits")) {
    return "NME Option Core/Elective Requirement: 19 credits";
  }
  return requirementId.split(":").at(-1)?.replace(/-/g, " ") ?? requirementId;
}

function buildMajorSpecificsRestrictedRows(input: {
  plan: TransferPlannerMajorPlan;
}) {
  const source = getMajorSpecificsPrimarySource(input.plan);
  const rows: MajorSpecificsCourseRow[] = [];

  for (const replacement of input.plan.requirementReplacements ?? []) {
    const baseLabel = formatRequirementReplacementLabel(replacement.baseRequirementId);
    const replacementLabel = formatRequirementReplacementLabel(replacement.replacedByRequirementId);
    rows.push(
      makeMajorSpecificsCourseRow({
        id: `major-specifics:replacement:${replacement.baseRequirementId}`,
        categoryId: "restricted-or-replaced-requirements",
        displayCourseCode: baseLabel,
        normalizedCourseCode: baseLabel,
        title: baseLabel,
        credits: null,
        text: `${baseLabel} is replaced by ${replacementLabel} for this selected option.`,
        alternativeOptionsText: null,
        alternativeOptionsShown: [],
        sourceType: "replaced_requirement",
        requirementRole: "replaced",
        requirementGroupId: replacement.baseRequirementId,
        requirementGroupLabel: baseLabel,
        requirementType: "choose_credits",
        selectedForRequirement: false,
        satisfiesRequirement: false,
        countsTowardUwRequirement: false,
        countsTowardGrcTrack: false,
        countsTowardPrerequisiteChain: false,
        countsTowardGenEd: false,
        restrictionStatus: "replaced",
        explanation: replacement.replacementReason,
        sourceUrl: replacement.sourceUrl || source.sourceUrl,
        sourceLabel: replacement.sourceHeading || source.sourceLabel,
      })
    );
  }

  if (
    input.plan.id === "uw-seattle-materials-science-engineering" &&
    getSelectedPathwayId(input.plan) === "nme-option"
  ) {
    rows.push(
      makeMajorSpecificsCourseRow({
        id: "major-specifics:restricted:nme-220-engineering-fundamentals",
        categoryId: "restricted-or-replaced-requirements",
        displayCourseCode: "NME 220",
        normalizedCourseCode: "NME 220",
        title: "Introduction to Molecular and Nanoscale Principles",
        credits: 4,
        text: "NME 220 is not eligible as an Engineering Fundamentals elective for NME Option students.",
        alternativeOptionsText: null,
        alternativeOptionsShown: [],
        sourceType: "restricted_option",
        requirementRole: "restricted",
        requirementGroupId:
          "uw-seattle-materials-science-engineering:requirement-group:engineering-fundamentals-electives",
        requirementGroupLabel: "Engineering Fundamentals Electives",
        requirementType: "choose_credits",
        selectedForRequirement: false,
        satisfiesRequirement: false,
        countsTowardUwRequirement: false,
        countsTowardGrcTrack: false,
        countsTowardPrerequisiteChain: false,
        countsTowardGenEd: false,
        restrictionStatus: "not_eligible_for_nme_option",
        explanation: "NME 220 is blocked from the Engineering Fundamentals elective bucket for NME Option students.",
        ...source,
      })
    );
  }

  return rows;
}

function buildMajorSpecificsGeneralEducationRows(plan: TransferPlannerMajorPlan) {
  const sourceBackedSection = buildSourceBackedMajorGeneralEducationRequirementSection(plan);
  if (!sourceBackedSection?.items.length) {
    return [] as MajorSpecificsCourseRow[];
  }

  const source = getMajorSpecificsPrimarySource(plan);
  const itemDisplayRank = (item: TransferPlannerGeneralRequirementSection["items"][number]) => {
    if (item.id === "ah" || item.id === "ah-range") {
      return 10;
    }
    if (item.id === "ssc" || item.id === "ssc-range") {
      return 20;
    }
    if (item.id.startsWith("additional-ah-ssc")) {
      return 30;
    }
    if (item.id === "div" || item.id === "overlapping-div") {
      return 40;
    }
    if (item.id === "areas-of-inquiry-total") {
      return 50;
    }
    return 60;
  };
  const displayItems = [...sourceBackedSection.items].sort(
    (left, right) => itemDisplayRank(left) - itemDisplayRank(right)
  );

  return displayItems.map((item) =>
    makeMajorSpecificsCourseRow({
      id: `major-specifics:source-gen-ed:${item.id}`,
      categoryId: "gen-ed-breadth-requirements",
      displayCourseCode: item.label,
      normalizedCourseCode: item.id,
      title: item.label,
      credits: null,
      text: `${item.label}: ${item.valueText}${item.note ? ` (${item.note})` : ""}`,
      alternativeOptionsText: null,
      alternativeOptionsShown: [],
      sourceType: "gen_ed_bucket",
      requirementRole: "informational",
      requirementGroupId: null,
      requirementGroupLabel: sourceBackedSection.title,
      requirementType: null,
      selectedForRequirement: false,
      satisfiesRequirement: false,
      countsTowardUwRequirement: false,
      countsTowardGrcTrack: false,
      countsTowardPrerequisiteChain: false,
      countsTowardGenEd: true,
      restrictionStatus: null,
      explanation: sourceBackedSection.summary,
      ...source,
    })
  );
}

export function buildMajorSpecificsCourseSections(input: {
  plan: TransferPlannerMajorPlan | null | undefined;
  track?: TransferPlannerTrack | null;
  completedCourses?: TranscriptCourseEntry[];
}) {
  if (!input.plan) {
    return [] as MajorSpecificsCourseSection[];
  }

  const completedCourses = input.completedCourses ?? [];
  const rows = [
    ...buildMajorSpecificsRequiredRows({ plan: input.plan, completedCourses }),
    ...buildMajorSpecificsChoiceRows({ plan: input.plan }),
    ...buildMajorSpecificsSuggestedPlanRows({
      plan: input.plan,
      track: input.track ?? null,
      completedCourses,
    }),
    ...buildMajorSpecificsGeneralEducationRows(input.plan),
    ...buildMajorSpecificsRestrictedRows({ plan: input.plan }),
  ];
  const rowsBySection = new Map<MajorSpecificsCourseSectionId, MajorSpecificsCourseRow[]>();
  const seenRows = new Set<string>();

  for (const row of rows) {
    const key = getMajorSpecificsRowKey(row);
    if (seenRows.has(key)) continue;
    seenRows.add(key);
    rowsBySection.set(row.categoryId, [...(rowsBySection.get(row.categoryId) ?? []), row]);
  }

  return MAJOR_SPECIFICS_COURSE_SECTIONS.map((section) => ({
    ...section,
    rows: rowsBySection.get(section.id) ?? [],
  })).filter((section) => section.rows.length > 0);
}

export function buildMajorSpecificsRenderingAudit(
  sections: MajorSpecificsCourseSection[]
) {
  return sections.flatMap((section) =>
    section.rows.map<MajorSpecificsRenderingAuditEntry>((row) => {
      const flags: string[] = [];
      const hasChoiceAlternatives =
        row.requirementRole === "selected_option" &&
        row.requirementType != null &&
        ["choose_one", "choose_n", "choose_credits", "sequence_choice"].includes(row.requirementType) &&
        row.alternativeOptionsShown.length > 0;

      if (!section.label) flags.push("missing-category");
      if (!row.sourceType) flags.push("missing-source-type");
      if (!row.requirementRole) flags.push("missing-requirement-role");
      if (
        row.requirementRole === "alternative_option" &&
        /\bis required\b/i.test(row.text)
      ) {
        flags.push("option-shown-as-required-without-selection");
      }
      if (row.requirementRole === "prerequisite_only" && row.countsTowardUwRequirement) {
        flags.push("prerequisite-only-counted-as-uw-requirement");
      }
      if (row.requirementRole === "restricted" && row.countsTowardUwRequirement) {
        flags.push("restricted-course-counted-toward-progress");
      }
      if (row.requirementRole === "replaced" && row.countsTowardUwRequirement) {
        flags.push("replaced-requirement-counted-as-active");
      }
      if (hasChoiceAlternatives && !row.alternativeOptionsText) {
        flags.push("selected-option-missing-alternative-text");
      }
      if (
        hasCourseAndDistributionPlaceholderSignal(row.displayCourseCode) ||
        hasCourseAndDistributionPlaceholderSignal(row.text)
      ) {
        flags.push("merged-course-and-distribution-label");
      }

      return {
        courseCode: row.displayCourseCode,
        category: section.label,
        sourceType: row.sourceType,
        requirementRole: row.requirementRole,
        requirementType: row.requirementType,
        requirementGroupId: row.requirementGroupId,
        selectedForRequirement: row.selectedForRequirement,
        countsTowardUwRequirement: row.countsTowardUwRequirement,
        countsTowardGrcTrack: row.countsTowardGrcTrack,
        countsTowardPrerequisiteChain: row.countsTowardPrerequisiteChain,
        countsTowardGenEd: row.countsTowardGenEd,
        restrictionStatus: row.restrictionStatus,
        alternativeOptionsShown: row.alternativeOptionsShown,
        flags,
      };
    })
  );
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
      if (isMergedCourseDistributionRequirementLabel(courseEntry)) {
        continue;
      }

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

function getPositiveCreditAmount(value: unknown) {
  const credits = Number(value);
  return Number.isFinite(credits) && credits > 0 ? credits : null;
}

function inferSuggestedCourseCreditAmount(
  label: string,
  explicitCourseCodes: string[] = []
) {
  const explicitCreditMatch = String(label ?? "").match(/\b(\d+(?:\.\d+)?)\s+credits?\b/i);
  const explicitCreditAmount = getPositiveCreditAmount(explicitCreditMatch?.[1]);
  if (explicitCreditAmount !== null) {
    return explicitCreditAmount;
  }

  const normalizedExplicitCodes = unique(
    explicitCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
  const courseCodes = normalizedExplicitCodes.length
    ? normalizedExplicitCodes
    : extractCourseCodes(label);
  if (!courseCodes.length || (!normalizedExplicitCodes.length && courseCodes.length > 1)) {
    return null;
  }

  let totalCredits = 0;
  for (const courseCode of courseCodes) {
    const creditAmount = getPositiveCreditAmount(
      getTransferPlannerCanonicalCourse("grc", courseCode)?.creditValue
    );
    if (creditAmount === null) {
      return null;
    }

    totalCredits += creditAmount;
  }

  return totalCredits > 0 ? totalCredits : null;
}

function toSuggestedQuarterCourse(course: PendingSuggestedCourse): SuggestedQuarterCourse {
  return {
    instanceKey: course.instanceKey,
    label: course.label,
    type:
      (course.type ?? (String(course.sourceKind ?? "").startsWith("official-grc") ? "core" : "elective")) as
      "core" | "elective",
    status: course.status,
    creditAmount:
      course.creditAmount ??
      inferSuggestedCourseCreditAmount(course.label, course.explicitCourseCodes),
    creditMin: course.creditMin,
    creditMax: course.creditMax,
    guidanceSummary: course.guidanceSummary,
    sourceKind: course.sourceKind,
    optionGroup: course.optionGroup,
    visibilityScope: course.visibilityScope,
    isVisibleInGrcQuarterPlan: course.isVisibleInGrcQuarterPlan,
    isUwOnlyRequirement: course.isUwOnlyRequirement,
    courseRole: course.courseRole,
    canTestOut: course.canTestOut,
    transfersOrSatisfiesUw: course.transfersOrSatisfiesUw,
    satisfiesSourceBackedUwRequirement: course.satisfiesSourceBackedUwRequirement,
    availabilitySummary: getTransferPlannerGrcCourseAvailabilitySummary(course.label),
  };
}

function buildSuggestedCourseInstanceBaseKey(
  course: PendingSuggestedCourse,
  sourceGroup: string
) {
  return [
    sourceGroup,
    course.sourceKind ?? "unknown",
    course.label,
    course.sequenceGroup ?? "",
    String(course.priorityRank),
    String(course.sourceOrder),
    course.explicitCourseCodes.join("+") || "placeholder",
  ].join("|");
}

function assignSuggestedCourseInstanceKeys<TCourse extends PendingSuggestedCourse>(
  courses: TCourse[],
  sourceGroup: string
): TCourse[] {
  const occurrenceByBaseKey = new Map<string, number>();

  return courses.map((course) => {
    if (course.instanceKey) {
      return course;
    }

    const baseKey = buildSuggestedCourseInstanceBaseKey(course, sourceGroup);
    const occurrenceIndex = occurrenceByBaseKey.get(baseKey) ?? 0;
    occurrenceByBaseKey.set(baseKey, occurrenceIndex + 1);

    return {
      ...course,
      instanceKey: `${baseKey}|${occurrenceIndex}`,
    };
  });
}

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
        creditAmount:
          course.credits ??
          inferSuggestedCourseCreditAmount(course.label, [normalizedCourseCode]),
        sourceKind: "completed-transcript",
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

function buildPlannerStableId(value: string, fallback = "item") {
  return (
    String(value ?? "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}

function normalizeGrcTrackSlotLabel(value: string) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\belective-any\b/gi, "elective - any")
    .replace(/\s*;\s*Recommended:.*$/i, "")
    .replace(/\.\s+-\s+must\b.*$/i, "")
    .trim();
}

function getGrcTrackChoiceSelectionCount(label: string) {
  const normalizedLabel = normalizeGrcTrackSlotLabel(label);
  const chooseOfMatch = normalizedLabel.match(/\b(?:choose|select)\s+(\d+)\s+of\b/i);
  const explicitCountMatch = normalizedLabel.match(
    /\b(?:choose|select)\s+(\d+)(?!\s*credits?\b)\b/i
  );
  const wordCountMatch = normalizedLabel.match(
    /\b(?:choose|select)\s+(one|two|three|four|five)\b/i
  );
  const wordCounts: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
  };
  const rawCount =
    chooseOfMatch?.[1] ??
    explicitCountMatch?.[1] ??
    (wordCountMatch?.[1] ? String(wordCounts[wordCountMatch[1].toLowerCase()] ?? "") : "");
  const selectionCount = Number.parseInt(rawCount, 10);
  if (Number.isFinite(selectionCount) && selectionCount > 0) {
    return Math.min(selectionCount, 10);
  }

  return 1;
}

function getGrcTrackChoiceSlotCreditAmount(label: string, selectionCount: number) {
  const normalizedLabel = normalizeGrcTrackSlotLabel(label);
  const creditMatch = normalizedLabel.match(
    /\b(?:select|choose|from|minimum|at least)\s+(\d+(?:\.\d+)?)\s+credits?\b/i
  );
  const creditAmount = getPositiveCreditAmount(creditMatch?.[1]);
  return selectionCount === 1 ? creditAmount : null;
}

function getGrcTrackChoiceOptionsText(label: string) {
  const normalizedLabel = normalizeGrcTrackSlotLabel(label);
  const colonIndex = normalizedLabel.indexOf(":");
  if (colonIndex >= 0) {
    const prefix = normalizedLabel.slice(0, colonIndex);
    const suffix = normalizedLabel.slice(colonIndex + 1).trim();
    if (
      suffix &&
      /\b(?:select|choose|elective|options?|following|approved)\b/i.test(prefix)
    ) {
      return suffix;
    }
  }

  if (/\s+or\s+/i.test(normalizedLabel)) {
    return normalizedLabel;
  }

  return "";
}

function shouldSplitGrcTrackOptionOnOr(value: string) {
  if (!/\s+or\s+/i.test(value)) {
    return false;
  }

  const courseCodes = extractCourseCodes(value);
  if (courseCodes.length <= 1 && /\bor\s+higher\b/i.test(value)) {
    return false;
  }

  return true;
}

function splitGrcTrackChoiceOptionText(value: string) {
  const normalizedText = String(value ?? "")
    .replace(/\.\s+(?=(?:Any|Choose|Select)\b)/gi, "; ")
    .replace(/\s*;\s*Recommended:.*$/i, "")
    .trim();
  const options: string[] = [];

  for (const semicolonPart of normalizedText.split(/\s*;\s*/)) {
    const part = semicolonPart.trim();
    if (!part) {
      continue;
    }

    const commaParts = part.includes(",") ? part.split(/\s*,\s*/) : [part];
    for (const commaPart of commaParts) {
      const nextParts = shouldSplitGrcTrackOptionOnOr(commaPart)
        ? commaPart.split(/\s+or\s+(?!higher\b)/i)
        : [commaPart];
      options.push(...nextParts);
    }
  }

  return options;
}

function cleanGrcTrackChoiceOptionLabel(value: string) {
  return normalizeGrcTrackSlotLabel(value)
    .replace(/^\s*(?:select|choose)\s+one\s*:?\s*/i, "")
    .replace(/^\s*(?:choose|select)\s+\d+\s+(?:of\s+)?(?:the\s+following\s+)?(?:courses?)?\s*:?\s*/i, "")
    .replace(/\s+-\s+must be taken.*$/i, "")
    .replace(/\s*\.\s*$/g, "")
    .trim();
}

function getGrcTrackChoiceTitle(label: string) {
  const normalizedLabel = normalizeGrcTrackSlotLabel(label);
  const colonIndex = normalizedLabel.indexOf(":");
  const prefix = colonIndex >= 0 ? normalizedLabel.slice(0, colonIndex).trim() : "";
  if (prefix && prefix.length <= 96) {
    return prefix;
  }
  if (/\b(?:select|choose)\s+one\b/i.test(normalizedLabel)) {
    return "Select one";
  }
  if (/\b(?:select|choose)\s+\d+\s+credits?\b/i.test(normalizedLabel)) {
    return normalizedLabel.match(/\b(?:select|choose)\s+\d+\s+credits?\b/i)?.[0] ?? "Choose credits";
  }
  return "Choose a Green River track option";
}

function buildGrcTrackChoicePromptLabel(
  parsedSlot: Pick<ParsedGrcTrackChoiceSlot, "title" | "selectionCount">
) {
  if (/\b(?:select|choose)\s+one\b/i.test(parsedSlot.title)) {
    return "Select one Green River track option";
  }
  if (/\b(?:select|choose)\s+\d+\s+credits?\b/i.test(parsedSlot.title)) {
    return parsedSlot.title;
  }
  if (parsedSlot.selectionCount > 1) {
    return `Choose ${parsedSlot.selectionCount} Green River track options`;
  }
  return parsedSlot.title || "Choose a Green River track option";
}

function parseGrcTrackChoiceSlot(label: string): ParsedGrcTrackChoiceSlot | null {
  const normalizedLabel = normalizeGrcTrackSlotLabel(label);
  const optionsText = getGrcTrackChoiceOptionsText(normalizedLabel);
  if (!optionsText) {
    return null;
  }

  const extractedCourseCodes = extractCourseCodes(optionsText);
  const hasOpenCourseCategory =
    /\bany\s+[A-Z][A-Z&/]*(?:\s*\/\s*[A-Z][A-Z&/]*)*\s+course\b/i.test(optionsText) ||
    /\b(?:program\s+)?elective\s*-\s*any\b/i.test(optionsText) ||
    /\bother\s+college(?:-|\s)level\b/i.test(optionsText);
  if (extractedCourseCodes.length < 2 && !hasOpenCourseCategory) {
    return null;
  }

  const selectionCount = getGrcTrackChoiceSelectionCount(normalizedLabel);
  const slotCreditAmount = getGrcTrackChoiceSlotCreditAmount(normalizedLabel, selectionCount);
  const seenOptionLabels = new Set<string>();
  const options = splitGrcTrackChoiceOptionText(optionsText)
    .map((optionLabel) => cleanGrcTrackChoiceOptionLabel(optionLabel))
    .filter(Boolean)
    .filter((optionLabel) => {
      const optionKey = optionLabel.toLowerCase();
      if (seenOptionLabels.has(optionKey)) {
        return false;
      }
      seenOptionLabels.add(optionKey);
      return true;
    })
    .map<SuggestedQuarterCourseOption>((optionLabel, optionIndex) => {
      const optionCourseCodes = unique(extractCourseCodes(optionLabel));
      const optionCreditAmount =
        slotCreditAmount ?? inferSuggestedCourseCreditAmount(optionLabel, optionCourseCodes);
      return {
        id: `official-grc-track-option:${buildPlannerStableId(normalizedLabel)}:${buildPlannerStableId(
          optionLabel,
          `option-${optionIndex + 1}`
        )}`,
        label: optionLabel,
        selectedLabel: optionLabel,
        courseLabels: [optionLabel],
        courseCodes: optionCourseCodes,
        guidanceSummary: null,
        creditAmount: optionCreditAmount,
        creditMin: optionCreditAmount,
        creditMax: optionCreditAmount,
      };
    });

  if (options.length < 2) {
    return null;
  }

  const title = getGrcTrackChoiceTitle(normalizedLabel);
  const parsedSlot = {
    id: `official-grc-track-choice:${buildPlannerStableId(normalizedLabel)}`,
    title,
    promptLabel: "",
    selectionCount: Math.min(selectionCount, options.length),
    requiredCredits: null,
    requirementType: "choose_n",
    options,
  } satisfies ParsedGrcTrackChoiceSlot;

  return {
    ...parsedSlot,
    promptLabel: buildGrcTrackChoicePromptLabel(parsedSlot),
  };
}

function buildGrcTrackChoiceOptionGroup(input: {
  label: string;
  selectedOptionIds: string[];
  isSelectionPrompt: boolean;
  selectionSource?: SuggestedQuarterCourseOptionGroup["selectionSource"];
}) {
  const parsedSlot = parseGrcTrackChoiceSlot(input.label);
  if (!parsedSlot) {
    return null;
  }

  const optionIds = new Set(parsedSlot.options.map((option) => option.id));
  const selectedOptionIds = input.selectedOptionIds.filter((optionId) => optionIds.has(optionId));

  return {
    ...parsedSlot,
    selectedOptionIds,
    selectionSource: input.selectionSource ?? null,
    isSelectionPrompt: input.isSelectionPrompt,
  } satisfies SuggestedQuarterCourseOptionGroup;
}

function buildGrcTrackGroupedChoiceOptionGroup(input: {
  groupedChoice: GrcTrackGroupedChoice;
  selectedOptionIds: string[];
  isSelectionPrompt: boolean;
  selectionSource?: SuggestedQuarterCourseOptionGroup["selectionSource"];
}) {
  const selectionCount = Math.max(
    1,
    Math.min(
      Number(input.groupedChoice.selectionCount ?? 1) || 1,
      input.groupedChoice.options.length || 1
    )
  );
  const options = input.groupedChoice.options
    .map<SuggestedQuarterCourseOption>((option) => {
      const courseLabels = unique((option.courseLabels ?? []).map((label) => String(label ?? "").trim()).filter(Boolean));
      const courseCodes = unique([
        ...(option.courseCodes ?? []),
        ...courseLabels.flatMap((label) => extractCourseCodes(label)),
      ].map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean));
      const inferredCreditAmount = courseLabels
        .map((label) => inferSuggestedCourseCreditAmount(label, extractCourseCodes(label)) ?? 0)
        .reduce((total, credits) => total + credits, 0);
      const creditAmount =
        selectionCount === 1
          ? input.groupedChoice.requiredCredits ?? (inferredCreditAmount > 0 ? inferredCreditAmount : null)
          : inferredCreditAmount > 0
            ? inferredCreditAmount
            : null;

      return {
        id: option.id,
        label: option.label,
        selectedLabel: option.label,
        courseLabels,
        courseCodes,
        guidanceSummary: null,
        creditAmount,
        creditMin: creditAmount,
        creditMax: creditAmount,
      };
    })
    .filter((option) => option.courseLabels.length && option.courseCodes.length);

  if (options.length < 2) {
    return null;
  }

  const optionIds = new Set(options.map((option) => option.id));
  const selectedOptionIds = input.selectedOptionIds.filter((optionId) => optionIds.has(optionId));

  return {
    id: input.groupedChoice.id,
    title: input.groupedChoice.label,
    promptLabel: input.groupedChoice.label,
    selectionCount,
    requiredCredits: input.groupedChoice.requiredCredits ?? null,
    requirementType: input.groupedChoice.requiredCredits ? "choose_credits" : "choose_n",
    selectedOptionIds,
    selectionSource: input.selectionSource ?? null,
    options,
    isSelectionPrompt: input.isSelectionPrompt,
  } satisfies SuggestedQuarterCourseOptionGroup;
}

function hasExplicitPlannerSelectedRequirementOptionIdsForGroupId(
  groupId: string | null | undefined,
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>
) {
  const normalizedGroupId = String(groupId ?? "").trim();
  return Boolean(
    normalizedGroupId &&
      selectedRequirementOptionIdsByGroup &&
      Object.prototype.hasOwnProperty.call(
        selectedRequirementOptionIdsByGroup,
        normalizedGroupId
      )
  );
}

function getPlannerSelectedRequirementOptionIdsForGroupId(
  groupId: string | null | undefined,
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>
) {
  const normalizedGroupId = String(groupId ?? "").trim();
  if (!normalizedGroupId) {
    return [] as string[];
  }

  return normalizeSelectedRequirementOptionIds(
    selectedRequirementOptionIdsByGroup?.[normalizedGroupId]
  );
}

function getGrcTrackGroupedChoiceSelectedOptionIds(input: {
  groupedChoice: GrcTrackGroupedChoice;
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
}) {
  const hasExplicitSelection = hasExplicitPlannerSelectedRequirementOptionIdsForGroupId(
    input.groupedChoice.id,
    input.selectedRequirementOptionIdsByGroup
  );
  if (hasExplicitSelection) {
    return {
      selectedOptionIds: getPlannerSelectedRequirementOptionIdsForGroupId(
        input.groupedChoice.id,
        input.selectedRequirementOptionIdsByGroup
      ),
      selectionSource: "student" as const,
    };
  }

  const defaultOptionIds = normalizeSelectedRequirementOptionIds(
    input.groupedChoice.defaultOptionIds ?? []
  );
  return {
    selectedOptionIds: defaultOptionIds,
    selectionSource: defaultOptionIds.length ? ("default" as const) : null,
  };
}

function addSuggestedQuarterCourseOptionGroupById(
  optionGroupsById: Map<string, SuggestedQuarterCourseOptionGroup>,
  optionGroup: SuggestedQuarterCourseOptionGroup | null | undefined
) {
  if (!optionGroup) return;

  const existingOptionGroup = optionGroupsById.get(optionGroup.id);
  if (
    !existingOptionGroup ||
    optionGroup.selectionSource === "student" ||
    (
      existingOptionGroup.selectionSource !== "student" &&
      optionGroup.selectedOptionIds.length > existingOptionGroup.selectedOptionIds.length
    )
  ) {
    optionGroupsById.set(optionGroup.id, optionGroup);
  }
}

export function buildSuggestedQuarterCourseOptionGroupsForTrack(input: {
  track: TransferPlannerTrack | null | undefined;
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
  includeParsedTrackChoiceSlots?: boolean;
}) {
  if (!input.track) {
    return [] as SuggestedQuarterCourseOptionGroup[];
  }

  const optionGroupsById = new Map<string, SuggestedQuarterCourseOptionGroup>();
  const groupedChoices = input.track.groupedChoices ?? [];
  const seenGroupedChoiceIds = new Set<string>();
  const includeParsedTrackChoiceSlots = input.includeParsedTrackChoiceSlots !== false;

  const addGroupedChoice = (groupedChoice: GrcTrackGroupedChoice) => {
    if (seenGroupedChoiceIds.has(groupedChoice.id)) {
      return;
    }

    seenGroupedChoiceIds.add(groupedChoice.id);
    const selection = getGrcTrackGroupedChoiceSelectedOptionIds({
      groupedChoice,
      selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
    });
    addSuggestedQuarterCourseOptionGroupById(
      optionGroupsById,
      buildGrcTrackGroupedChoiceOptionGroup({
        groupedChoice,
        selectedOptionIds: selection.selectedOptionIds,
        isSelectionPrompt: true,
        selectionSource: selection.selectionSource,
      })
    );
  };

  for (const term of input.track.terms ?? []) {
    for (const label of term.courses ?? []) {
      const normalizedSlotLabel = normalizeGrcTrackSlotLabel(label);
      const groupedChoicesForLabel = getGrcTrackGroupedChoicesForLabel(
        normalizedSlotLabel,
        groupedChoices
      );

      for (const groupedChoice of groupedChoicesForLabel) {
        addGroupedChoice(groupedChoice);
      }

      if (!includeParsedTrackChoiceSlots) {
        continue;
      }
      if (shouldSkipTrackLabelCoveredByGroupedChoice(normalizedSlotLabel, groupedChoicesForLabel)) {
        continue;
      }

      const parsedSlot = parseGrcTrackChoiceSlot(normalizedSlotLabel);
      if (!parsedSlot) {
        continue;
      }

      const hasExplicitSelection = hasExplicitPlannerSelectedRequirementOptionIdsForGroupId(
        parsedSlot.id,
        input.selectedRequirementOptionIdsByGroup
      );
      addSuggestedQuarterCourseOptionGroupById(
        optionGroupsById,
        buildGrcTrackChoiceOptionGroup({
          label: normalizedSlotLabel,
          selectedOptionIds: getPlannerSelectedRequirementOptionIdsForGroupId(
            parsedSlot.id,
            input.selectedRequirementOptionIdsByGroup
          ),
          isSelectionPrompt: true,
          selectionSource: hasExplicitSelection ? "student" : null,
        })
      );
    }
  }

  for (const groupedChoice of groupedChoices) {
    addGroupedChoice(groupedChoice);
  }

  return [...optionGroupsById.values()];
}

function getGrcTrackChoiceGuidanceSummary(optionGroup: SuggestedQuarterCourseOptionGroup) {
  const selectedOptionLabels = optionGroup.options
    .filter((option) => optionGroup.selectedOptionIds.includes(option.id))
    .map((option) => option.label);
  const previewLabels = optionGroup.options
    .slice(0, CHECKLIST_CHOICE_PREVIEW_LIMIT)
    .map((option) => option.label);
  const hiddenCount = Math.max(optionGroup.options.length - previewLabels.length, 0);
  if (!previewLabels.length && !selectedOptionLabels.length) {
    return null;
  }

  const optionListText = previewLabels.length
    ? `Options: ${previewLabels.join(", ")}${hiddenCount > 0 ? `, plus ${hiddenCount} more` : ""}.`
    : "";
  if (!optionGroup.isSelectionPrompt && selectedOptionLabels.length) {
    const selectedText = `${optionGroup.selectionSource === "default" ? "Default sample-map option" : "Selected option"}${
      selectedOptionLabels.length === 1 ? "" : "s"
    }: ${selectedOptionLabels.join(", ")}.`;
    return joinGuidanceSummaries(selectedText, optionListText);
  }

  return optionListText;
}

function isGrcTrackChoiceSlotSatisfied(
  parsedSlot: ParsedGrcTrackChoiceSlot,
  completedCourseCodes: Set<string>,
  coveredCourseCodes: Set<string>
) {
  const satisfiedOptionCount = parsedSlot.options.filter((option) =>
    option.courseCodes.length > 1
      ? option.courseCodes.every(
          (courseCode) => completedCourseCodes.has(courseCode) || coveredCourseCodes.has(courseCode)
        )
      : option.courseCodes.some(
          (courseCode) => completedCourseCodes.has(courseCode) || coveredCourseCodes.has(courseCode)
        )
  ).length;
  return satisfiedOptionCount >= parsedSlot.selectionCount;
}

function isGrcTrackGroupedChoiceSatisfied(
  groupedChoice: GrcTrackGroupedChoice,
  completedCourseCodes: Set<string>,
  coveredCourseCodes: Set<string>
) {
  const selectionCount = Math.max(
    1,
    Math.min(
      Number(groupedChoice.selectionCount ?? 1) || 1,
      groupedChoice.options.length || 1
    )
  );
  const satisfiedOptionCount = groupedChoice.options.filter((option) => {
    const courseCodes = unique([
      ...(option.courseCodes ?? []),
      ...(option.courseLabels ?? []).flatMap((label) => extractCourseCodes(label)),
    ].map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean));
    return (
      courseCodes.length > 0 &&
      courseCodes.every(
        (courseCode) => completedCourseCodes.has(courseCode) || coveredCourseCodes.has(courseCode)
      )
    );
  }).length;
  return satisfiedOptionCount >= selectionCount;
}

function isFlexibleGrcTrackSingleCourseLabel(label: string) {
  const normalizedLabel = normalizeGrcTrackSlotLabel(label);
  const explicitCourseCodes = extractCourseCodes(normalizedLabel);
  if (explicitCourseCodes.length !== 1) {
    return false;
  }
  if (isTrackSupplementalCourseLabel(normalizedLabel)) {
    return true;
  }
  if (/\b(?:elective|general education|humanities|social science|natural science)\b/i.test(normalizedLabel)) {
    return false;
  }

  return true;
}

function isTrackSupplementalCourseLabel(label: string) {
  const normalizedLabel = normalizeCourseCode(label);
  const explicitCourseCodes = extractCourseCodes(label);

  return explicitCourseCodes.length === 1 && explicitCourseCodes[0] === normalizedLabel;
}

function getGrcTrackGroupedChoiceCourseCodes(groupedChoice: GrcTrackGroupedChoice) {
  return unique(
    groupedChoice.options.flatMap((option) => [
      ...(option.courseCodes ?? []),
      ...(option.courseLabels ?? []).flatMap((label) => extractCourseCodes(label)),
    ])
  )
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter(Boolean);
}

function getGrcTrackGroupedChoicesForLabel(
  label: string,
  groupedChoices: GrcTrackGroupedChoice[]
) {
  const explicitCourseCodes = extractCourseCodes(label);
  if (!explicitCourseCodes.length) {
    return [] as GrcTrackGroupedChoice[];
  }

  return groupedChoices.filter((groupedChoice) => {
    const groupedCourseCodes = new Set(getGrcTrackGroupedChoiceCourseCodes(groupedChoice));
    return explicitCourseCodes.some((courseCode) => groupedCourseCodes.has(courseCode));
  });
}

function shouldSkipTrackLabelCoveredByGroupedChoice(
  label: string,
  groupedChoices: GrcTrackGroupedChoice[]
) {
  const explicitCourseCodes = extractCourseCodes(label);
  if (!explicitCourseCodes.length || !groupedChoices.length) {
    return false;
  }

  const groupedCourseCodes = new Set(
    groupedChoices.flatMap((groupedChoice) => getGrcTrackGroupedChoiceCourseCodes(groupedChoice))
  );
  const groupedCodeCount = explicitCourseCodes.filter((courseCode) =>
    groupedCourseCodes.has(courseCode)
  ).length;
  if (!groupedCodeCount) {
    return false;
  }

  return (
    explicitCourseCodes.every((courseCode) => groupedCourseCodes.has(courseCode)) ||
    /\b(?:or|select|choose)\b/i.test(label)
  );
}

function getResolvedTrackSupplementalCourseLabels(input: {
  track: TransferPlannerTrack | null | undefined;
  completedCourses: TranscriptCourseEntry[];
  completedCourseCodes: Set<string>;
  coveredCourseCodes: Set<string>;
  referenceDate?: Date;
  includeFlexibleTrackSlots?: boolean;
}) {
  if (!input.track) {
    return [] as TrackSupplementalCourseSlot[];
  }

  const supplementalCourseSlots: TrackSupplementalCourseSlot[] = [];
  const seenLabels = new Set<string>();
  const seenGroupedChoiceIds = new Set<string>();
  const groupedChoices = input.includeFlexibleTrackSlots ? input.track.groupedChoices ?? [] : [];
  const completedCourseCodes = new Set(
    [...input.completedCourseCodes].map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
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
      const normalizedSlotLabel = normalizeGrcTrackSlotLabel(label);
      const groupedChoicesForLabel = getGrcTrackGroupedChoicesForLabel(
        normalizedSlotLabel,
        groupedChoices
      );
      for (const groupedChoice of groupedChoicesForLabel) {
        if (
          seenGroupedChoiceIds.has(groupedChoice.id) ||
          isGrcTrackGroupedChoiceSatisfied(groupedChoice, completedCourseCodes, coveredCourseCodes)
        ) {
          continue;
        }

        seenGroupedChoiceIds.add(groupedChoice.id);
        supplementalCourseSlots.push({
          kind: "grouped-choice",
          groupedChoice,
        });
      }
      if (shouldSkipTrackLabelCoveredByGroupedChoice(normalizedSlotLabel, groupedChoicesForLabel)) {
        continue;
      }
      if (isMergedCourseDistributionRequirementLabel(normalizedSlotLabel)) {
        continue;
      }

      const parsedChoiceSlot = input.includeFlexibleTrackSlots
        ? parseGrcTrackChoiceSlot(normalizedSlotLabel)
        : null;
      const isSingleCourseSlot = isTrackSupplementalCourseLabel(normalizedSlotLabel);
      const shouldKeepFlexibleSingleCourseSlot =
        input.includeFlexibleTrackSlots &&
        !parsedChoiceSlot &&
        isFlexibleGrcTrackSingleCourseLabel(normalizedSlotLabel);

      if (!isSingleCourseSlot && !parsedChoiceSlot && !shouldKeepFlexibleSingleCourseSlot) {
        continue;
      }

      if (
        parsedChoiceSlot &&
        isGrcTrackChoiceSlotSatisfied(parsedChoiceSlot, completedCourseCodes, coveredCourseCodes)
      ) {
        continue;
      }

      const explicitCourseCodes = extractCourseCodes(normalizedSlotLabel);
      const explicitCourseCode = explicitCourseCodes[0] ?? null;
      if (!parsedChoiceSlot && !explicitCourseCode) {
        continue;
      }

      const normalizedLabel = isSingleCourseSlot
        ? normalizeCourseCode(normalizedSlotLabel)
        : normalizedSlotLabel;
      const normalizedLabelKey = normalizedLabel.toLowerCase();
      if (
        !normalizedLabel ||
        seenLabels.has(normalizedLabelKey) ||
        (!parsedChoiceSlot &&
          explicitCourseCode &&
          (coveredCourseCodes.has(explicitCourseCode) ||
            completedCourseCodes.has(explicitCourseCode)))
      ) {
        continue;
      }

      seenLabels.add(normalizedLabelKey);
      if (!parsedChoiceSlot && explicitCourseCode) {
        coveredCourseCodes.add(explicitCourseCode);
      }
      supplementalCourseSlots.push({
        kind: "label",
        label: normalizedLabel,
      });
    }
  }

  if (input.includeFlexibleTrackSlots) {
    for (const groupedChoice of groupedChoices) {
      if (
        seenGroupedChoiceIds.has(groupedChoice.id) ||
        isGrcTrackGroupedChoiceSatisfied(groupedChoice, completedCourseCodes, coveredCourseCodes)
      ) {
        continue;
      }

      seenGroupedChoiceIds.add(groupedChoice.id);
      supplementalCourseSlots.push({
        kind: "grouped-choice",
        groupedChoice,
      });
    }
  }

  return supplementalCourseSlots;
}

function buildTrackSupplementalGuidanceSummary() {
  return null;
}

function buildTrackSupplementalSuggestedCourses(input: {
  track: TransferPlannerTrack | null | undefined;
  courseSlots: TrackSupplementalCourseSlot[];
  prerequisiteCourseMap: Map<string, string[][]>;
  corequisiteCourseMap: Map<string, string[][]>;
  sourceOrderStart: number;
  completedCourseCodes?: Set<string> | string[];
  coveredCourseCodes?: Set<string> | string[];
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
  includeFlexibleTrackSlots?: boolean;
}) {
  const suggestedCourses: PendingSuggestedCourse[] = [];
  let sourceOrderOffset = 0;
  const selectedRequirementOptionIdsByGroup = input.selectedRequirementOptionIdsByGroup ?? {};
  const satisfiedCourseCodes = new Set(
    [...(input.completedCourseCodes ?? []), ...(input.coveredCourseCodes ?? [])]
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
  const isCourseCodeSetSatisfied = (courseCodes: string[]) => {
    const normalizedCourseCodes = unique(courseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean));
    return (
      normalizedCourseCodes.length > 0 &&
      normalizedCourseCodes.every((courseCode) => satisfiedCourseCodes.has(courseCode))
    );
  };
  const isOptionSatisfied = (option: SuggestedQuarterCourseOption) =>
    isCourseCodeSetSatisfied([
      ...(option.courseCodes ?? []),
      ...(option.courseLabels ?? []).flatMap((label) => extractCourseCodes(label)),
    ]);

  const buildPendingCourse = (args: {
    label: string;
    sourceOrder: number;
    optionGroup?: SuggestedQuarterCourseOptionGroup | null;
    sequenceGroup?: string | null;
    creditAmount?: number | null;
    creditMin?: number | null;
    creditMax?: number | null;
  }): PendingSuggestedCourse => {
    const explicitCourseCodes = extractCourseCodes(args.label);
    const inferredCreditAmount = inferSuggestedCourseCreditAmount(
      args.label,
      explicitCourseCodes
    );
    const creditRange = getSuggestedCourseCreditRangeFromValues({
      creditAmount: args.creditAmount ?? inferredCreditAmount,
      creditMin: args.creditMin ?? inferredCreditAmount,
      creditMax: args.creditMax ?? inferredCreditAmount,
    });

    return {
      label: args.label,
      type: isCoreCourseLabel(args.label) ? "core" : "elective",
      status: "planned",
      sourceKind: "official-grc-track",
      visibilityScope: "visible-grc-completable",
      isVisibleInGrcQuarterPlan: true,
      isUwOnlyRequirement: false,
      guidanceSummary: args.optionGroup
        ? getGrcTrackChoiceGuidanceSummary(args.optionGroup)
        : buildTrackSupplementalGuidanceSummary(),
      sequenceGroup: args.sequenceGroup ?? null,
      priorityRank: REQUIREMENT_PRIORITY_RANK.stayAtGrc,
      sourceOrder: args.sourceOrder,
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
      optionGroup: args.optionGroup ?? null,
      creditAmount: creditRange.creditAmount,
      creditMin: creditRange.creditMin,
      creditMax: creditRange.creditMax,
    };
  };

  for (const slot of input.courseSlots) {
    const label = slot.kind === "label" ? slot.label : slot.groupedChoice.label;
    const parsedChoiceSlot =
      slot.kind === "label" && input.includeFlexibleTrackSlots
        ? parseGrcTrackChoiceSlot(label)
        : null;
    const hasExplicitParsedChoiceSelection =
      !!parsedChoiceSlot &&
      Object.prototype.hasOwnProperty.call(
        selectedRequirementOptionIdsByGroup,
        parsedChoiceSlot.id
      );
    const hasExplicitGroupedChoiceSelection =
      slot.kind === "grouped-choice" &&
      Object.prototype.hasOwnProperty.call(
        selectedRequirementOptionIdsByGroup,
        slot.groupedChoice.id
      );
    const explicitGroupedChoiceSelectionIds =
      slot.kind === "grouped-choice"
        ? normalizeSelectedRequirementOptionIds(
            selectedRequirementOptionIdsByGroup[slot.groupedChoice.id]
          )
        : [];
    const defaultGroupedChoiceSelectionIds =
      slot.kind === "grouped-choice" &&
      !hasExplicitGroupedChoiceSelection &&
      !explicitGroupedChoiceSelectionIds.length
        ? normalizeSelectedRequirementOptionIds(slot.groupedChoice.defaultOptionIds ?? [])
        : [];
    const promptOptionGroup = input.includeFlexibleTrackSlots
      ? slot.kind === "grouped-choice"
        ? buildGrcTrackGroupedChoiceOptionGroup({
            groupedChoice: slot.groupedChoice,
            selectedOptionIds: explicitGroupedChoiceSelectionIds.length
              ? explicitGroupedChoiceSelectionIds
              : defaultGroupedChoiceSelectionIds,
            isSelectionPrompt: true,
            selectionSource: hasExplicitGroupedChoiceSelection
              ? "student"
              : defaultGroupedChoiceSelectionIds.length
                ? "default"
                : null,
          })
        : buildGrcTrackChoiceOptionGroup({
            label,
            selectedOptionIds: normalizeSelectedRequirementOptionIds(
              selectedRequirementOptionIdsByGroup[parsedChoiceSlot?.id ?? ""]
            ),
            isSelectionPrompt: true,
            selectionSource: hasExplicitParsedChoiceSelection ? "student" : null,
          })
      : null;

    if (promptOptionGroup) {
      const selectedOptionIds = promptOptionGroup.selectedOptionIds;
      const selectedOptionIdSet = new Set(selectedOptionIds);
      const selectedOptions = promptOptionGroup.options
        .filter((option) => selectedOptionIdSet.has(option.id))
        .slice(0, promptOptionGroup.selectionCount);
      const selectedOptionGroup = {
        ...promptOptionGroup,
        selectedOptionIds: selectedOptions.map((option) => option.id),
        isSelectionPrompt: false,
      };

      for (const option of selectedOptions) {
        if (isOptionSatisfied(option)) {
          continue;
        }

        let attachedOptionGroup = false;
        const optionCreditRange = getSuggestedCourseCreditRangeFromValues({
          creditAmount: option.creditAmount,
          creditMin: option.creditMin,
          creditMax: option.creditMax,
        });

        for (const optionLabel of option.courseLabels.length ? option.courseLabels : [option.label]) {
          const optionLabelCourseCodes = extractCourseCodes(optionLabel);
          if (isCourseCodeSetSatisfied(optionLabelCourseCodes)) {
            continue;
          }

          const optionLabelCreditAmount =
            option.courseLabels.length > 1
              ? inferSuggestedCourseCreditAmount(optionLabel, optionLabelCourseCodes)
              : null;
          const optionLabelCreditRange =
            optionLabelCreditAmount === null
              ? optionCreditRange
              : getSuggestedCourseCreditRangeFromValues({
                  creditAmount: optionLabelCreditAmount,
                  creditMin: optionLabelCreditAmount,
                  creditMax: optionLabelCreditAmount,
                });
          suggestedCourses.push(
            buildPendingCourse({
              label: optionLabel,
              sourceOrder: input.sourceOrderStart + sourceOrderOffset,
              optionGroup: attachedOptionGroup ? null : selectedOptionGroup,
              sequenceGroup:
                option.courseLabels.length > 1 ? `${promptOptionGroup.id}:${option.id}` : null,
              ...optionLabelCreditRange,
            })
          );
          sourceOrderOffset += 1;
          attachedOptionGroup = true;
        }
      }

      if (selectedOptions.length >= promptOptionGroup.selectionCount) {
        continue;
      }

      const promptCreditRange = getSuggestedQuarterCourseOptionGroupCreditRange(promptOptionGroup);
      suggestedCourses.push(
        buildPendingCourse({
          label: promptOptionGroup.promptLabel,
          sourceOrder: input.sourceOrderStart + sourceOrderOffset,
          optionGroup: promptOptionGroup,
          ...promptCreditRange,
        })
      );
      sourceOrderOffset += 1;
      continue;
    }

    suggestedCourses.push(
      buildPendingCourse({
        label,
        sourceOrder: input.sourceOrderStart + sourceOrderOffset,
      })
    );
    sourceOrderOffset += 1;
  }

  return suggestedCourses;
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

type SourceBackedGeneralEducationCategoryId = "ah" | "ssc" | "nsc" | "div";
type SourceBackedPlanningGeneralEducationCategoryId = Exclude<
  SourceBackedGeneralEducationCategoryId,
  "div"
>;

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
      kind: "overlapping-category";
      category: SourceBackedGeneralEducationCategoryId;
      credits: number;
      overlappingCategories: SourceBackedGeneralEducationCategoryId[];
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
export const UW_TRANSFER_ADMISSION_CADR_EXEMPTION_QUARTER_CREDITS = 40;

export type UwTransferGenericMilestoneDecision = {
  allowed: boolean;
  reason: string;
  majorSpecificAdmissionMetadataFound: boolean;
};

type UwTransferMilestoneQuarterSeason = "Winter" | "Spring" | "Summer" | "Fall";

type UwTransferMilestoneQuarterParts = {
  season: UwTransferMilestoneQuarterSeason;
  year: number;
};

const UW_TRANSFER_DEADLINE_MONTH_LABELS: Record<number, string> = {
  2: "February",
  9: "September",
};

const UW_TRANSFER_ENGINEERING_MAJOR_MILESTONE_BLOCK_PATTERN =
  /\b(?:engineering|materials science|bioengineering|chemical engineering|computer engineering|electrical engineering|mechanical engineering|civil engineering|industrial engineering|aeronautics|astronautics|human centered design|hcde)\b/i;

const UW_TRANSFER_CAPACITY_CONSTRAINED_MAJOR_MILESTONE_BLOCK_PATTERN =
  /\b(?:computer science|informatics|business administration|nursing|public health|social welfare|architectural design|architectural studies|construction management|medical laboratory science|neuroscience)\b/i;

const UW_TRANSFER_MAJOR_SPECIFIC_ADMISSION_METADATA_PATTERN =
  /\b(?:admission|admissions|apply|application|deadline|capacity[-\s]?constrained|competitive|selective|departmental admission|major admission|major application|direct admission|portfolio|audition|minimum transfer-admission)\b/i;

function getSuggestedQuarterMilestoneCourseCreditAmount(course: SuggestedQuarterCourse) {
  const creditAmount = Number(course.creditAmount);
  return Number.isFinite(creditAmount) && creditAmount > 0 ? creditAmount : 0;
}

function getSuggestedQuarterMilestoneCourseCreditRange(course: SuggestedQuarterCourse) {
  const exactCreditAmount = getSuggestedQuarterMilestoneCourseCreditAmount(course) || null;
  const creditMin = Number(course.creditMin);
  const creditMax = Number(course.creditMax);
  const minimumCreditAmount =
    Number.isFinite(creditMin) && creditMin > 0 ? creditMin : exactCreditAmount;
  const maximumCreditAmount =
    Number.isFinite(creditMax) && creditMax > 0
      ? creditMax
      : exactCreditAmount ?? minimumCreditAmount;

  return {
    creditMin: minimumCreditAmount ?? 0,
    creditMax: maximumCreditAmount ?? minimumCreditAmount ?? 0,
  };
}

function getSuggestedQuarterMilestoneCreditTotal(quarter: SuggestedQuarterPlan) {
  return quarter.courses.reduce(
    (totalCredits, course) =>
      totalCredits + getSuggestedQuarterMilestoneCourseCreditRange(course).creditMin,
    0
  );
}

function parseUwTransferMilestoneQuarterLabel(
  label: string | null | undefined
): UwTransferMilestoneQuarterParts | null {
  const match = String(label ?? "").match(/\b(Winter|Spring|Summer|Fall|Autumn)\s+(\d{4})\b/i);
  if (!match) return null;

  const parsedYear = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(parsedYear)) return null;

  const rawSeason = String(match[1] ?? "").toLowerCase();
  const season: UwTransferMilestoneQuarterSeason =
    rawSeason === "winter"
      ? "Winter"
      : rawSeason === "spring"
        ? "Spring"
        : rawSeason === "summer"
          ? "Summer"
          : "Fall";

  return {
    season,
    year: parsedYear,
  };
}

function formatUwTransferMilestoneDeadlineDate(month: number, day: number, year: number) {
  return `${UW_TRANSFER_DEADLINE_MONTH_LABELS[month] ?? `Month ${month}`} ${day}, ${year}`;
}

function getUwTransferMilestoneApplicationCycleForQuarter(
  quarter: UwTransferMilestoneQuarterParts
) {
  if (quarter.season === "Winter") {
    return {
      deadlineText: formatUwTransferMilestoneDeadlineDate(2, 15, quarter.year),
      admissionTerm: `Autumn/Summer ${quarter.year}`,
    };
  }

  if (quarter.season === "Spring" || quarter.season === "Summer") {
    return {
      deadlineText: formatUwTransferMilestoneDeadlineDate(9, 1, quarter.year),
      admissionTerm: `Winter ${quarter.year + 1}`,
    };
  }

  return {
    deadlineText: formatUwTransferMilestoneDeadlineDate(2, 15, quarter.year + 1),
    admissionTerm: `Autumn/Summer ${quarter.year + 1}`,
  };
}

function appendTransferPlannerTextValue(values: string[], value: unknown) {
  const text = String(value ?? "").trim();
  if (text) values.push(text);
}

function collectTransferPlannerMajorSpecificAdmissionMetadataText(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) return "";

  const selectedPathwayId =
    (plan as TransferPlannerMajorPlan & { selectedPathwayId?: string | null })
      .selectedPathwayId ?? null;
  const primarySource = getTransferPlannerPrimaryDegreeRequirementsSource(
    plan.id,
    selectedPathwayId
  );
  const values: string[] = [];

  appendTransferPlannerTextValue(values, plan.plannerNote);
  for (const flag of plan.advisorFlags ?? []) appendTransferPlannerTextValue(values, flag);

  for (const link of plan.officialLinks ?? []) {
    appendTransferPlannerTextValue(values, link.label);
    appendTransferPlannerTextValue(values, link.url);
    appendTransferPlannerTextValue(values, link.note);
    appendTransferPlannerTextValue(values, link.reason);
  }

  for (const item of [
    ...(plan.applicationChecklist ?? []),
    ...(plan.beforeEnrollmentChecklist ?? []),
  ]) {
    appendTransferPlannerTextValue(values, item.id);
    appendTransferPlannerTextValue(values, item.title);
    appendTransferPlannerTextValue(values, item.note);
    appendTransferPlannerTextValue(values, item.requirementGroup?.label);
    appendTransferPlannerTextValue(values, item.requirementGroup?.sourceHeading);
    for (const note of item.requirementGroup?.notes ?? []) {
      appendTransferPlannerTextValue(values, note);
    }
  }

  if (primarySource) {
    appendTransferPlannerTextValue(values, primarySource.label);
    appendTransferPlannerTextValue(values, primarySource.url);
    appendTransferPlannerTextValue(values, primarySource.role);
    appendTransferPlannerTextValue(values, primarySource.ownerTitle);
    for (const note of primarySource.validationNotes ?? []) {
      appendTransferPlannerTextValue(values, note);
    }
  }

  return values.join(" ");
}

function hasTransferPlannerMajorSpecificAdmissionMetadata(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) return false;
  if ((plan.applicationChecklist ?? []).length > 0) return true;

  return UW_TRANSFER_MAJOR_SPECIFIC_ADMISSION_METADATA_PATTERN.test(
    collectTransferPlannerMajorSpecificAdmissionMetadataText(plan)
  );
}

function buildUwTransferGenericMilestoneContext(input: {
  plan?: TransferPlannerMajorPlan | null;
  selectedCampusId?: TransferPlannerCampusId | null;
  selectedMajorId?: string | null;
  degreeTitle?: string | null;
}) {
  const plan = input.plan ?? null;
  return [
    input.selectedCampusId,
    input.selectedMajorId,
    input.degreeTitle,
    plan?.campusId,
    plan?.id,
    plan?.title,
    plan?.shortTitle,
    plan?.family,
    (plan as (TransferPlannerMajorPlan & { selectedPathwayLabel?: string | null }) | null)
      ?.selectedPathwayLabel,
  ]
    .map((value) => String(value ?? "").replace(/[-_]+/g, " ").toLowerCase())
    .join(" ");
}

export function getUwTransferGenericMilestoneDecision(input: {
  plan?: TransferPlannerMajorPlan | null;
  selectedCampusId?: TransferPlannerCampusId | null;
  selectedMajorId?: string | null;
  degreeTitle?: string | null;
}): UwTransferGenericMilestoneDecision {
  const context = buildUwTransferGenericMilestoneContext(input);
  const majorSpecificAdmissionMetadataFound =
    hasTransferPlannerMajorSpecificAdmissionMetadata(input.plan);

  if (UW_TRANSFER_ENGINEERING_MAJOR_MILESTONE_BLOCK_PATTERN.test(context)) {
    return {
      allowed: false,
      reason: majorSpecificAdmissionMetadataFound
        ? "Engineering-style major uses source-specific departmental admission guidance."
        : "Engineering-style major has no source-backed support for generic UW Winter/Spring deadline claims.",
      majorSpecificAdmissionMetadataFound,
    };
  }

  if (UW_TRANSFER_CAPACITY_CONSTRAINED_MAJOR_MILESTONE_BLOCK_PATTERN.test(context)) {
    return {
      allowed: false,
      reason: majorSpecificAdmissionMetadataFound
        ? "Major-specific admission metadata is available; use source-backed major guidance instead of generic UW timing."
        : "Capacity-constrained major has no source-backed major-specific admission deadline metadata.",
      majorSpecificAdmissionMetadataFound,
    };
  }

  return {
    allowed: true,
    reason: "No engineering or capacity-constrained admission gate detected.",
    majorSpecificAdmissionMetadataFound,
  };
}

export function buildUwTransferMinimumRequirementSummary(input: {
  quarters: SuggestedQuarterPlan[];
  plan?: TransferPlannerMajorPlan | null;
  selectedCampusId?: TransferPlannerCampusId | null;
  selectedMajorId?: string | null;
  degreeTitle?: string | null;
}) {
  if (!getUwTransferGenericMilestoneDecision(input).allowed) {
    return null;
  }

  const quarters = input.quarters;
  const completedCredits = quarters
    .filter((quarter) => quarter.phase === "completed")
    .reduce(
      (totalCredits, quarter) => totalCredits + getSuggestedQuarterMilestoneCreditTotal(quarter),
      0
    );
  let cumulativeCredits = completedCredits;
  const upcomingQuarters = quarters.filter((quarter) => quarter.phase !== "completed");

  for (const quarter of upcomingQuarters) {
    const quarterParts = parseUwTransferMilestoneQuarterLabel(quarter.label);
    if (!quarterParts) {
      cumulativeCredits += getSuggestedQuarterMilestoneCreditTotal(quarter);
      continue;
    }

    if (cumulativeCredits < UW_TRANSFER_ADMISSION_CADR_EXEMPTION_QUARTER_CREDITS) {
      cumulativeCredits += getSuggestedQuarterMilestoneCreditTotal(quarter);
    }

    if (cumulativeCredits >= UW_TRANSFER_ADMISSION_CADR_EXEMPTION_QUARTER_CREDITS) {
      const applicationCycle = getUwTransferMilestoneApplicationCycleForQuarter(quarterParts);
      return `${quarter.label} - Minimum transfer requirements are met. Apply by ${applicationCycle.deadlineText} to be considered for ${applicationCycle.admissionTerm} admission at UW.`;
    }
  }

  return null;
}

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
  div: "Diversity",
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

function isChoiceBackedGeneralEducationPlaceholderLabel(label: string) {
  if (!getGeneralEducationPlaceholderKind(label)) {
    return false;
  }

  if (!extractCourseCodes(label).length) {
    return false;
  }

  return /\b(?:or|select|choose)\b/i.test(label);
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

function getCompletedFlexibleBreadthCredits(
  completedCreditProgress: CompletedGeneralEducationCreditProgress,
  requirementTargets: GeneralEducationRequirementTargets
) {
  if (requirementTargets.breadthCredits === null) {
    return 0;
  }

  if (isCombinedOnlyBreadthRequirementTarget(requirementTargets)) {
    return completedCreditProgress.breadthCredits;
  }

  const fixedAhCredits =
    requirementTargets.ahCredits === null
      ? 0
      : Math.min(completedCreditProgress.ahCredits, requirementTargets.ahCredits);
  const fixedSscCredits =
    requirementTargets.sscCredits === null
      ? 0
      : Math.min(completedCreditProgress.sscCredits, requirementTargets.sscCredits);

  return Math.max(
    0,
    completedCreditProgress.breadthCredits - fixedAhCredits - fixedSscCredits
  );
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
  let breadthCredits = getCompletedFlexibleBreadthCredits(
    completedCreditProgress,
    requirementTargets
  );
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
  const sourceBackedBreadthCredits = getCompletedFlexibleBreadthCredits(
    completedCreditProgress,
    requirementTargets
  );

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
    .filter((entry) => !isChoiceBackedGeneralEducationPlaceholderLabel(String(entry)))
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

export function countMatchedGrcTrackGeneralEducationBreadthRows(input: {
  track: TransferPlannerTrack | null | undefined;
  completedCourses?: TranscriptCourseEntry[];
  referenceDate?: Date;
  plan?: TransferPlannerMajorPlan | null;
}) {
  return buildTrackGeneralEducationGuidancePlaceholders({
    track: input.track ?? null,
    completedCourses: input.completedCourses ?? [],
    referenceDate: input.referenceDate,
    plan: input.plan ?? null,
  }).length;
}

function isPlannerGuidancePlaceholderCoveredBySourceBackedTargets(
  placeholder: GeneralEducationPlaceholder,
  sourceBackedTargets: GeneralEducationRequirementTargets
) {
  switch (placeholder.kind) {
    case "ah":
      return sourceBackedTargets.ahCredits !== null || sourceBackedTargets.breadthCredits !== null;
    case "ssc":
      return sourceBackedTargets.sscCredits !== null || sourceBackedTargets.breadthCredits !== null;
    case "ahOrSsc":
      return (
        sourceBackedTargets.ahCredits !== null ||
        sourceBackedTargets.sscCredits !== null ||
        sourceBackedTargets.breadthCredits !== null
      );
    case "nsc":
      return sourceBackedTargets.nscCredits !== null;
    case "elective":
      return sourceBackedTargets.electiveCredits !== null;
  }
}

function reconcilePlannerGuidanceGeneralEducationPlaceholdersWithSourceBackedTargets(args: {
  plannerGuidancePlaceholders: QuarterPlanningGeneralEducationPlaceholderEntry[];
  sourceBackedTargets: GeneralEducationRequirementTargets;
}) {
  if (!hasGeneralEducationRequirementTargets(args.sourceBackedTargets)) {
    return args.plannerGuidancePlaceholders;
  }

  return args.plannerGuidancePlaceholders.filter(
    (entry) =>
      !isPlannerGuidancePlaceholderCoveredBySourceBackedTargets(
        entry.placeholder,
        args.sourceBackedTargets
      )
  );
}

function isGeneralEducationPlaceholderGrcCompletable(input: {
  placeholder: GeneralEducationPlaceholder;
  plan?: TransferPlannerMajorPlan | null;
}) {
  if (!input.plan?.campusId) return false;
  const campusId = input.plan.campusId;

  const requiredTags =
    input.placeholder.kind === "ah"
      ? ["AH"]
      : input.placeholder.kind === "ssc"
      ? ["SSC"]
      : input.placeholder.kind === "nsc"
      ? ["NSC"]
      : input.placeholder.kind === "ahOrSsc"
      ? ["AH", "SSC"]
      : [];

  if (!requiredTags.length) {
    return false;
  }

  return getPlanGrcCourseCodes(input.plan).some((sourceCourseCode) =>
    getTransferGuidanceCandidateRulesForSourceCourse(
      sourceCourseCode,
      campusId
    ).some((rule) => {
      const tags = getEvaluationTargetRequirementTags(rule);
      return requiredTags.some((tag) => tags.includes(tag));
    })
  );
}

function shouldExposeSourceBackedMajorGenEdPlaceholdersInGrcPlan(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) return false;

  // In GRC -> UW mode, source-backed major gen-ed targets are summary/advising data.
  // Do not let UW graduation buckets become visible Green River quarter-plan rows.
  if (isUwTransferPlannerPlan(plan)) {
    return false;
  }

  return true;
}

function buildGeneralEducationPlaceholders(args: {
  track: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
  referenceDate?: Date;
  plan?: TransferPlannerMajorPlan | null;
  includePlannerGuidancePlaceholders: boolean;
}) {
  const sourceBackedMajorPlaceholders = shouldExposeSourceBackedMajorGenEdPlaceholdersInGrcPlan(args.plan)
    ? buildSourceBackedMajorGeneralEducationPlaceholders({
        plan: args.plan,
        completedCourses: args.completedCourses,
      })
        .filter((placeholder) =>
          isGeneralEducationPlaceholderGrcCompletable({
            placeholder,
            plan: args.plan,
          })
        )
        .map<QuarterPlanningGeneralEducationPlaceholderEntry>((placeholder) => ({
          placeholder,
          sourceKind: "source-backed-major",
        }))
    : [];
  const sourceBackedTargets = buildSourceBackedGeneralEducationRequirementTargets(args.plan);

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

  const reconciledPlannerGuidancePlaceholders =
    reconcilePlannerGuidanceGeneralEducationPlaceholdersWithSourceBackedTargets({
      plannerGuidancePlaceholders,
      sourceBackedTargets,
    });

  return [...sourceBackedMajorPlaceholders, ...reconciledPlannerGuidancePlaceholders];
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
    /\bdiv\b|\bdiversity\b/.test(text),
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
    /^(arts?\s+and\s+humanities|a&h|social sciences?|ssc|natural sciences?|nsc|div|additional a&h|additional arts?\s+and\s+humanities|additional areas?\s+of inquiry|english composition|written\s*&\s*oral communication|diversity)\b/.test(
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
  registerMatches("div", /\bdiversity\b/i);
  registerMatches("div", /\bdiv\b/i);

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

function buildUwMajorRequirementGuidanceSummary() {
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

  const parentheticalMatches = Array.from(
    text.matchAll(/\((\d+(?:\.\d+)?)\s*(?:credits?|cr)?\.?\)/gi)
  )
    .map((match) => parseGeneralEducationCreditAmount(match[1] ?? null))
    .filter((value): value is number => value !== null);

  return parentheticalMatches[parentheticalMatches.length - 1] ?? null;
}

function getCurrentGeneralEducationRequirementText(text: string) {
  return (
    text.split(
      /\b(?:of special note|special note|was only|prior to|before)\b/i
    )[0] ?? text
  ).trim();
}

function extractCurrentDiversityGeneralEducationCredits(text: string) {
  const currentText = getCurrentGeneralEducationRequirementText(text);
  const currentCredits = extractFirstMatchingGeneralEducationCreditValue(currentText, [
    /\b(?:minimum of|at least|required|complete|must(?:\s+complete)?)\s+(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b[^.;]{0,64}\b(?:diversity|div)\b/i,
    /\b(?:diversity|div)\b[^0-9.;]{0,64}(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b/i,
    /\b(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b[^.;]{0,64}\b(?:diversity|div)\b/i,
  ]);
  if (currentCredits !== null) {
    return currentCredits;
  }

  return extractFirstMatchingGeneralEducationCreditValue(text, [
    /\b(?:minimum of|at least|required|complete|must(?:\s+complete)?)\s+(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b[^.;]{0,64}\b(?:diversity|div)\b/i,
    /\b(?:diversity|div)\b[^0-9.;]{0,64}(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b/i,
    /\b(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b[^.;]{0,64}\b(?:diversity|div)\b/i,
  ]);
}

function countGeneralEducationCreditMentions(text: string) {
  return Array.from(
    text.matchAll(
      /\b\d+(?:\.\d+)?\s+(?:additional\s+)?(?:credits?|cr)\b|\(\s*\d+(?:\.\d+)?\s*(?:credits?|cr)?\.?\s*\)/gi
    )
  ).length;
}

function buildCategorySpecificGeneralEducationFixedDescriptors(
  text: string
): Extract<SourceBackedGeneralEducationDescriptor, { kind: "category-fixed" }>[] {
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
      {
        category: "div",
      },
    ] as const
  )
    .map(({ category }) => {
      const categoryPatternSource = getSourceBackedGeneralEducationCategoryPatternSource(category);
      const leadingCredits = extractLeadingCategoryGeneralEducationFixedCredits(text, category);
      const trailingCredits = extractFirstMatchingGeneralEducationCreditValue(text, [
        new RegExp(
          `\\b(\\d+(?:\\.\\d+)?)\\s*(?:credits?|cr)\\b(?:\\s+of)?[^.;]{0,24}\\b(?:${categoryPatternSource})\\b`,
          "i"
        ),
      ]);
      const isOnlyNonOverlappingReference =
        leadingCredits === null &&
        new RegExp(
          `\\b(?:cannot|can't|may\\s+not)\\s+overlap\\s+with\\s+(?:${categoryPatternSource})\\b`,
          "i"
        ).test(text);
      const credits = isOnlyNonOverlappingReference
        ? null
        : trailingCredits ?? leadingCredits;
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
      ): descriptor is Extract<
        SourceBackedGeneralEducationDescriptor,
        { kind: "category-fixed" }
      > & { category: SourceBackedPlanningGeneralEducationCategoryId } =>
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
    case "div":
      return "(?:diversity|div)";
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
  const credits =
    category === "div"
      ? extractCurrentDiversityGeneralEducationCredits(text)
      : extractFirstMatchingGeneralEducationCreditValue(text, [
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
    /^(?:additional\s+)?(?:arts?\s+and\s+humanities|a&h|social sciences?|ssc|natural sciences?|nsc|diversity|div|areas?\s+of\s+(?:inquiry|knowledge))\b/i.test(
      text
    ) ||
    /^\d+(?:\.\d+)?\s+additional\b/i.test(text) ||
    /^\d+(?:\.\d+)?\s*(?:credits?|cr)\b[^.;]{0,64}\b(?:arts?\s+and\s+humanities|a&h|social sciences?|ssc|natural sciences?|nsc|diversity|div)\b/i.test(
      text
    ) ||
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
    /^(?:additional\s+)?(?:arts?\s+and\s+humanities|a&h|social sciences?|ssc|natural sciences?|nsc|diversity|div)\b[^.;]{0,48}(?:\(\d+(?:\.\d+)?(?:\s*(?:credits?|cr))?(?:\s*-\s*\d+(?:\.\d+)?)?[^)]*\)|\b\d+(?:\.\d+)?\s*(?:credits?|cr)\b)/i.test(
      sanitizedText
    ) ||
    /^\d+(?:\.\d+)?\s+(?:additional\s+)?(?:credits?|cr)\b[^.;]{0,64}\b(?:arts?\s+and\s+humanities|a&h|social sciences?|ssc|natural sciences?|nsc|diversity|div)\b/i.test(
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

function getSourceBackedPlanningCategories(
  categories: SourceBackedGeneralEducationCategoryId[]
): SourceBackedPlanningGeneralEducationCategoryId[] {
  return categories.filter(
    (category): category is SourceBackedPlanningGeneralEducationCategoryId =>
      category !== "div"
  );
}

function hasSameSourceBackedPlanningCategorySet(
  left: SourceBackedGeneralEducationCategoryId[],
  right: SourceBackedGeneralEducationCategoryId[]
) {
  return hasSameSourceBackedCategorySet(getSourceBackedPlanningCategories(left), right);
}

function hasCategorySpecificFixedAllocationContext(
  text: string,
  descriptors: Extract<SourceBackedGeneralEducationDescriptor, { kind: "category-fixed" }>[],
  detectedCategories: SourceBackedGeneralEducationCategoryId[]
) {
  if (getSourceBackedPlanningCategories(detectedCategories).length <= 1) {
    return true;
  }

  if (
    descriptors.length === 1 &&
    extractLeadingCategoryGeneralEducationFixedCredits(text, descriptors[0].category) !== null
  ) {
    return true;
  }

  return countGeneralEducationCreditMentions(text) >= detectedCategories.length;
}

function hasFlexibleSourceBackedGeneralEducationCategoryChoice(
  text: string,
  categories: SourceBackedGeneralEducationCategoryId[]
) {
  const planningCategories = getSourceBackedPlanningCategories(categories);
  return (
    hasSameSourceBackedCategorySet(planningCategories, ["ah", "ssc"]) &&
    /\b(?:or|and\/or)\b|\ba&h\s*\/\s*ssc\b|\barts?\s+and\s+humanities\s*\/\s*social sciences?\b/i.test(
      text
    )
  );
}

function buildOverlappingSourceBackedGeneralEducationDescriptor(
  text: string,
  categories: SourceBackedGeneralEducationCategoryId[],
  credits: number | null
): Extract<SourceBackedGeneralEducationDescriptor, { kind: "overlapping-category" }> | null {
  if (!categories.includes("div")) {
    return null;
  }

  const diversityCredits = extractCurrentDiversityGeneralEducationCredits(text) ?? credits;
  if (diversityCredits === null) {
    return null;
  }

  const startsWithDiversity = /^(?:[-*]\s*)?(?:diversity|div)\b/i.test(text);
  const hasDiversityRequirementLanguage =
    /\b(?:minimum of|at least|required|coursework|credits?)\b[^.;]{0,80}\b(?:diversity|div)\b/i.test(
      text
    ) ||
    /\b(?:diversity|div)\b[^.;]{0,80}\b(?:minimum|at least|required|coursework|credits?)\b/i.test(
      text
    );
  const hasOverlapLanguage =
    /\boverlap(?:s|ping)?\b|\balso\s+(?:counts?|fulfills?|satisfies?)\b|\bdouble\s+counts?\b/i.test(
      text
    );
  if (!(startsWithDiversity || hasDiversityRequirementLanguage) || !hasOverlapLanguage) {
    return null;
  }

  const overlappingCategories = getSourceBackedPlanningCategories(categories);
  return {
    kind: "overlapping-category",
    category: "div",
    credits: diversityCredits,
    overlappingCategories: overlappingCategories.length
      ? overlappingCategories
      : (["ah", "ssc"] as SourceBackedGeneralEducationCategoryId[]),
    sourceLine: text,
  };
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
  const overlappingCategoryDescriptor = buildOverlappingSourceBackedGeneralEducationDescriptor(
    sanitizedSegment,
    categories,
    fixedCredits
  );

  if (hasMathematicsAndNaturalSciencesCombo) {
    return [];
  }

  if (hasCourseLevelContext) {
    return [];
  }

  if (overlappingCategoryDescriptor) {
    return [overlappingCategoryDescriptor];
  }

  if (
    categorySpecificFixedDescriptors.length &&
    hasCategorySpecificFixedAllocationContext(
      sanitizedSegment,
      categorySpecificFixedDescriptors,
      categories
    )
  ) {
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

  if (categories.length === 1 && categories[0] === "div") {
    return [];
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

  if (
    categories.length >= 2 &&
    (hasAdditional ||
      hasFlexibleSourceBackedGeneralEducationCategoryChoice(sanitizedSegment, categories)) &&
    fixedCredits !== null
  ) {
    return [
      {
        kind: "additional-flexible",
        categories: getSourceBackedPlanningCategories(categories),
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
        scope:
          hasAreasOfInquiryScope || categories.includes("div")
            ? "areas-of-inquiry"
            : "categories",
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
    case "overlapping-category":
      return `${descriptor.kind}:${descriptor.category}:${descriptor.credits}:${descriptor.overlappingCategories.join("-")}`;
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
  const planSignalLines = getGeneralEducationRequirementSignalLines(sourcePlan, []);
  const rawSignalLines = parsedRequirementSourceLines.length
    ? unique([...parsedRequirementSourceLines, ...planSignalLines])
    : planSignalLines;
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
      if (descriptor.category === "div") {
        continue;
      }
      const existing = fixedCreditsByCategory.get(descriptor.category) ?? new Set<number>();
      existing.add(descriptor.credits);
      fixedCreditsByCategory.set(descriptor.category, existing);
      continue;
    }

    if (descriptor.kind === "category-range") {
      if (descriptor.category === "div") {
        continue;
      }
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
      const categoryKey = getSourceBackedPlanningCategories(descriptor.categories).join("-");
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
      const leftPlanningCategories = getSourceBackedPlanningCategories(leftBucket.categories);
      const rightPlanningCategories = getSourceBackedPlanningCategories(rightBucket.categories);
      const overlappingCategories = leftPlanningCategories.some((category) =>
        rightPlanningCategories.includes(category)
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
    for (const bucket of sharedBuckets) {
      const bucketPlanningCategories = getSourceBackedPlanningCategories(bucket.categories);
      const overlappingFixedCredits = bucketPlanningCategories
        .map((category) => ({
          category,
          credits: fixedCreditsByCategory.get(category)?.values().next().value ?? null,
        }))
        .filter(
          (
            entry
          ): entry is { category: SourceBackedPlanningGeneralEducationCategoryId; credits: number } =>
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
        overlappingFixedCredits.length === bucketPlanningCategories.length;
      const isAhOrSscBucket = hasSameSourceBackedCategorySet(bucketPlanningCategories, ["ah", "ssc"]);
      const additionalFlexibleCreditsForBucket =
        additionalFlexibleByCategoryKey.get(bucketPlanningCategories.join("-"))?.values().next()
          .value ?? null;
      const isPartiallyExpandedSharedBucket =
        !hasAllBucketCategoriesFixed &&
        isAhOrSscBucket &&
        overlappingFixedCredits.length === bucketPlanningCategories.length - 1 &&
        additionalFlexibleCreditsForBucket !== null &&
        fixedCreditTotal + additionalFlexibleCreditsForBucket < bucket.totalCredits;
      const isFixedMinimumExpansion =
        bucket.minimumPerCategoryCredits !== null &&
        hasAllBucketCategoriesFixed &&
        overlappingFixedCredits.every(
          (entry) => entry.credits === bucket.minimumPerCategoryCredits
        );
      const isFullyExpandedSharedBucket =
        hasAllBucketCategoriesFixed &&
        additionalFlexibleCreditsForBucket !== null &&
        isAhOrSscBucket &&
        fixedCreditTotal + additionalFlexibleCreditsForBucket === bucket.totalCredits;
      const isFullyAllocatedFixedBucket =
        hasAllBucketCategoriesFixed &&
        additionalFlexibleCreditsForBucket === null &&
        fixedCreditTotal === bucket.totalCredits;
      const isSymmetricMissingCategoryExpansion =
        !hasAllBucketCategoriesFixed &&
        isAhOrSscBucket &&
        overlappingFixedCredits.length === 1 &&
        additionalFlexibleCreditsForBucket === null &&
        bucket.totalCredits - fixedCreditTotal * 2 >= 0 &&
        bucket.totalCredits - fixedCreditTotal * 2 <= fixedCreditTotal;

      if (
        !isFixedMinimumExpansion &&
        !isFullyExpandedSharedBucket &&
        !isFullyAllocatedFixedBucket &&
        !isPartiallyExpandedSharedBucket &&
        !isSymmetricMissingCategoryExpansion
      ) {
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

function isAhSscSourceBackedGeneralEducationSharedBucket(
  descriptor: SourceBackedGeneralEducationDescriptor
): descriptor is Extract<SourceBackedGeneralEducationDescriptor, { kind: "shared-bucket" }> {
  return (
    descriptor.kind === "shared-bucket" &&
    hasSameSourceBackedCategorySet(
      getSourceBackedPlanningCategories(descriptor.categories),
      ["ah", "ssc"]
    )
  );
}

function getInferredAdditionalAhSscCreditsForSharedBucket(
  descriptor: Extract<SourceBackedGeneralEducationDescriptor, { kind: "shared-bucket" }>,
  fixedCreditsByCategory: Map<SourceBackedGeneralEducationCategoryId, number>
) {
  return inferAhSscSharedBucketAllocation(descriptor, fixedCreditsByCategory)
    ?.additionalCredits ?? null;
}

function inferAhSscSharedBucketAllocation(
  descriptor: Extract<SourceBackedGeneralEducationDescriptor, { kind: "shared-bucket" }>,
  fixedCreditsByCategory: Map<SourceBackedGeneralEducationCategoryId, number>
) {
  if (!isAhSscSourceBackedGeneralEducationSharedBucket(descriptor)) {
    return null;
  }

  const fixedAhCredits = fixedCreditsByCategory.get("ah") ?? null;
  const fixedSscCredits = fixedCreditsByCategory.get("ssc") ?? null;
  if (fixedAhCredits !== null && fixedSscCredits !== null) {
    const additionalCredits = descriptor.totalCredits - fixedAhCredits - fixedSscCredits;
    return additionalCredits >= 0
      ? {
          ahCredits: fixedAhCredits,
          sscCredits: fixedSscCredits,
          additionalCredits,
          inferredCategory: null as SourceBackedPlanningGeneralEducationCategoryId | null,
        }
      : null;
  }

  const knownCategory =
    fixedAhCredits !== null ? "ah" : fixedSscCredits !== null ? "ssc" : null;
  const knownCredits = fixedAhCredits ?? fixedSscCredits ?? null;
  if (knownCategory === null || knownCredits === null || knownCredits <= 0) {
    return null;
  }

  const additionalCredits = descriptor.totalCredits - knownCredits * 2;
  if (additionalCredits < 0 || additionalCredits > knownCredits) {
    return null;
  }

  return {
    ahCredits: fixedAhCredits ?? knownCredits,
    sscCredits: fixedSscCredits ?? knownCredits,
    additionalCredits,
    inferredCategory: (knownCategory === "ah" ? "ssc" : "ah") as
      | SourceBackedPlanningGeneralEducationCategoryId
      | null,
  };
}

function hasReducibleAhSscSourceBackedGeneralEducationSharedBucket(
  structure: ParsedSourceBackedGeneralEducationStructure
) {
  const fixedCreditsByCategory = new Map<SourceBackedGeneralEducationCategoryId, number>();
  for (const descriptor of structure.descriptors) {
    if (descriptor.kind === "category-fixed" && descriptor.category !== "div") {
      fixedCreditsByCategory.set(descriptor.category, descriptor.credits);
    }
  }

  return structure.descriptors.some((descriptor) => {
    if (!isAhSscSourceBackedGeneralEducationSharedBucket(descriptor)) {
      return false;
    }

    if (descriptor.minimumPerCategoryCredits !== null) {
      return true;
    }

    return inferAhSscSharedBucketAllocation(descriptor, fixedCreditsByCategory) !== null;
  });
}

function isAggregateAreaTotalCoveredByFlexibleBucket(
  descriptor: Extract<SourceBackedGeneralEducationDescriptor, { kind: "area-total" }>,
  structure: ParsedSourceBackedGeneralEducationStructure
) {
  if (!hasReducibleAhSscSourceBackedGeneralEducationSharedBucket(structure)) {
    return false;
  }

  return structure.descriptors.some(
    (entry) =>
      isAhSscSourceBackedGeneralEducationSharedBucket(entry) &&
      descriptor.totalCredits > entry.totalCredits
  );
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

function buildRangeBasedGeneralEducationRequirementTargets(
  structure: ParsedSourceBackedGeneralEducationStructure
): GeneralEducationRequirementTargets | null {
  const rangeDescriptors = structure.descriptors.filter(
    (descriptor): descriptor is Extract<SourceBackedGeneralEducationDescriptor, { kind: "category-range" }> =>
      descriptor.kind === "category-range"
  );
  if (!rangeDescriptors.length) {
    return null;
  }

  const hasUnsupportedCompanionDescriptor = structure.descriptors.some(
    (descriptor) =>
      descriptor.kind !== "category-range" &&
      descriptor.kind !== "area-total" &&
      !(descriptor.kind === "category-fixed" && descriptor.category === "div") &&
      !(descriptor.kind === "overlapping-category" && descriptor.category === "div")
  );
  if (hasUnsupportedCompanionDescriptor) {
    return null;
  }

  const planningRangeDescriptors = rangeDescriptors.filter(
    (descriptor) => descriptor.category === "ah" || descriptor.category === "ssc"
  );
  if (
    planningRangeDescriptors.length !== rangeDescriptors.length ||
    planningRangeDescriptors.length !== 2
  ) {
    return null;
  }

  const rangeByCategory = new Map(
    planningRangeDescriptors.map((descriptor) => [descriptor.category, descriptor])
  );
  const ahRange = rangeByCategory.get("ah") ?? null;
  const sscRange = rangeByCategory.get("ssc") ?? null;
  const areaTotalCredits = unique(
    structure.descriptors
      .filter(
        (descriptor): descriptor is Extract<SourceBackedGeneralEducationDescriptor, { kind: "area-total" }> =>
          descriptor.kind === "area-total"
      )
      .map((descriptor) => descriptor.totalCredits)
  );
  if (!ahRange || !sscRange || areaTotalCredits.length !== 1) {
    return null;
  }

  const areaTotalCreditValue = areaTotalCredits[0];
  const minimumCreditTotal = ahRange.minimumCredits + sscRange.minimumCredits;
  const maximumCreditTotal = ahRange.maximumCredits + sscRange.maximumCredits;
  if (
    areaTotalCreditValue < minimumCreditTotal ||
    areaTotalCreditValue > maximumCreditTotal
  ) {
    return null;
  }

  const additionalBreadthCredits = Math.max(0, areaTotalCreditValue - minimumCreditTotal);
  return {
    ahCredits: ahRange.minimumCredits,
    sscCredits: sscRange.minimumCredits,
    nscCredits: null,
    breadthCredits: additionalBreadthCredits > 0 ? additionalBreadthCredits : null,
    electiveCredits: null,
  };
}

function buildSourceBackedGeneralEducationRequirementTargetsFromStructure(
  structure: ParsedSourceBackedGeneralEducationStructure
): GeneralEducationRequirementTargets {
  if (!structure.descriptors.length || structure.hasConflict) {
    return createEmptyGeneralEducationRequirementTargets();
  }

  const rangeBasedTargets = buildRangeBasedGeneralEducationRequirementTargets(structure);
  if (rangeBasedTargets) {
    return rangeBasedTargets;
  }

  const hasUnsupportedDescriptor = structure.descriptors.some((descriptor) => {
    if (descriptor.kind === "category-range") {
      return true;
    }

    if (descriptor.kind === "shared-bucket") {
      return !hasSameSourceBackedPlanningCategorySet(descriptor.categories, ["ah", "ssc"]);
    }

    if (descriptor.kind === "area-total") {
      return (
        !canReduceAreaTotalDescriptor(descriptor, structure) &&
        !isAggregateAreaTotalCoveredByFlexibleBucket(descriptor, structure)
      );
    }

    if (descriptor.kind === "additional-flexible") {
      return !hasSameSourceBackedPlanningCategorySet(descriptor.categories, ["ah", "ssc"]);
    }

    return false;
  });
  if (hasUnsupportedDescriptor) {
    return createEmptyGeneralEducationRequirementTargets();
  }

  const targets = createEmptyGeneralEducationRequirementTargets();
  const fixedCreditsByCategory = new Map<SourceBackedGeneralEducationCategoryId, number>();
  const additionalFlexibleCreditsByCategoryKey = new Map<string, number>();
  for (const descriptor of structure.descriptors) {
    if (descriptor.kind === "category-fixed" && descriptor.category !== "div") {
      fixedCreditsByCategory.set(descriptor.category, descriptor.credits);
      continue;
    }

    if (descriptor.kind === "additional-flexible") {
      additionalFlexibleCreditsByCategoryKey.set(
        getSourceBackedPlanningCategories(descriptor.categories).join("-"),
        descriptor.credits
      );
    }
  }

  for (const descriptor of structure.descriptors) {
    if (!isAhSscSourceBackedGeneralEducationSharedBucket(descriptor)) {
      continue;
    }

    const allocation = inferAhSscSharedBucketAllocation(descriptor, fixedCreditsByCategory);
    if (!allocation) {
      continue;
    }

    fixedCreditsByCategory.set("ah", allocation.ahCredits);
    fixedCreditsByCategory.set("ssc", allocation.sscCredits);
    additionalFlexibleCreditsByCategoryKey.set(
      getSourceBackedPlanningCategories(descriptor.categories).join("-"),
      allocation.additionalCredits
    );
  }

  for (const descriptor of structure.descriptors) {
    if (descriptor.kind === "category-fixed") {
      if (descriptor.category === "ah") {
        targets.ahCredits = descriptor.credits;
      } else if (descriptor.category === "ssc") {
        targets.sscCredits = descriptor.credits;
      } else if (descriptor.category === "nsc") {
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

    const bucketPlanningCategories = getSourceBackedPlanningCategories(descriptor.categories);
    const additionalFlexibleCreditsForBucket =
      additionalFlexibleCreditsByCategoryKey.get(bucketPlanningCategories.join("-")) ?? null;
    const fixedAhCredits = fixedCreditsByCategory.get("ah") ?? null;
    const fixedSscCredits = fixedCreditsByCategory.get("ssc") ?? null;

    if (fixedAhCredits !== null) {
      targets.ahCredits = targets.ahCredits ?? fixedAhCredits;
    }
    if (fixedSscCredits !== null) {
      targets.sscCredits = targets.sscCredits ?? fixedSscCredits;
    }

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

    if (
      hasSameSourceBackedCategorySet(bucketPlanningCategories, ["ah", "ssc"]) &&
      additionalFlexibleCreditsForBucket !== null &&
      ((fixedAhCredits !== null && fixedSscCredits === null) ||
        (fixedAhCredits === null && fixedSscCredits !== null))
    ) {
      const knownFixedCredits = fixedAhCredits ?? fixedSscCredits ?? 0;
      const inferredMissingCredits =
        descriptor.totalCredits - knownFixedCredits - additionalFlexibleCreditsForBucket;
      if (inferredMissingCredits <= 0) {
        return createEmptyGeneralEducationRequirementTargets();
      }

      if (fixedAhCredits !== null) {
        targets.sscCredits = targets.sscCredits ?? inferredMissingCredits;
      } else {
        targets.ahCredits = targets.ahCredits ?? inferredMissingCredits;
      }
      targets.breadthCredits = targets.breadthCredits ?? additionalFlexibleCreditsForBucket;
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
  const explicitFixedCategories = new Set<SourceBackedGeneralEducationCategoryId>();
  const additionalFlexibleByCategoryKey = new Map<string, number>();
  const overlappingCategoryDescriptorsByCategory = new Map<
    SourceBackedGeneralEducationCategoryId,
    Extract<SourceBackedGeneralEducationDescriptor, { kind: "overlapping-category" }>
  >();
  const areaTotalCredits = structure.descriptors
    .filter((descriptor): descriptor is Extract<SourceBackedGeneralEducationDescriptor, { kind: "area-total" }> =>
      descriptor.kind === "area-total"
    )
    .map((descriptor) => descriptor.totalCredits);

  for (const descriptor of structure.descriptors) {
    if (descriptor.kind === "category-fixed") {
      if (descriptor.category === "div") {
        continue;
      }
      fixedCreditsByCategory.set(descriptor.category, descriptor.credits);
      explicitFixedCategories.add(descriptor.category);
      continue;
    }

    if (descriptor.kind === "additional-flexible") {
      additionalFlexibleByCategoryKey.set(
        getSourceBackedPlanningCategories(descriptor.categories).join("-"),
        descriptor.credits
      );
      continue;
    }

    if (descriptor.kind === "overlapping-category") {
      const existing = overlappingCategoryDescriptorsByCategory.get(descriptor.category);
      if (!existing || descriptor.credits > existing.credits) {
        overlappingCategoryDescriptorsByCategory.set(descriptor.category, descriptor);
      }
    }
  }

  for (const descriptor of structure.descriptors) {
    if (descriptor.kind !== "shared-bucket") {
      continue;
    }

    const planningCategories = getSourceBackedPlanningCategories(descriptor.categories);
    if (!hasSameSourceBackedCategorySet(planningCategories, ["ah", "ssc"])) {
      continue;
    }

    const inferredAllocation = inferAhSscSharedBucketAllocation(
      descriptor,
      fixedCreditsByCategory
    );
    if (inferredAllocation) {
      fixedCreditsByCategory.set("ah", inferredAllocation.ahCredits);
      fixedCreditsByCategory.set("ssc", inferredAllocation.sscCredits);
      additionalFlexibleByCategoryKey.set(
        planningCategories.join("-"),
        inferredAllocation.additionalCredits
      );
      continue;
    }

    const additionalFlexibleCredits =
      additionalFlexibleByCategoryKey.get(planningCategories.join("-")) ?? null;
    if (additionalFlexibleCredits === null) {
      continue;
    }

    const fixedAhCredits = fixedCreditsByCategory.get("ah") ?? null;
    const fixedSscCredits = fixedCreditsByCategory.get("ssc") ?? null;
    if (
      (fixedAhCredits !== null && fixedSscCredits === null) ||
      (fixedAhCredits === null && fixedSscCredits !== null)
    ) {
      const inferredMissingCredits =
        descriptor.totalCredits - (fixedAhCredits ?? fixedSscCredits ?? 0) - additionalFlexibleCredits;
      if (inferredMissingCredits > 0) {
        fixedCreditsByCategory.set(
          fixedAhCredits !== null ? "ssc" : "ah",
          inferredMissingCredits
        );
      }
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
      if (isAggregateAreaTotalCoveredByFlexibleBucket(descriptor, structure)) {
        continue;
      }

      if (canReduceAreaTotalDescriptor(descriptor, structure)) {
        const hasRangeDescriptor = structure.descriptors.some(
          (entry) => entry.kind === "category-range"
        );
        const hasMatchingSharedBucket = structure.descriptors.some(
          (entry) =>
            entry.kind === "shared-bucket" &&
            entry.scope === "areas-of-inquiry" &&
            entry.totalCredits === descriptor.totalCredits
        );
        if (hasMatchingSharedBucket) {
          continue;
        }
        const hasUnreducedSharedBucket = structure.descriptors.some(
          (entry) =>
            entry.kind === "shared-bucket" &&
            !(
              hasSameSourceBackedPlanningCategorySet(entry.categories, ["ah", "ssc"]) &&
              fixedCreditsByCategory.get("ah") !== undefined &&
              fixedCreditsByCategory.get("ssc") !== undefined &&
              (additionalFlexibleByCategoryKey.get(
                getSourceBackedPlanningCategories(entry.categories).join("-")
              ) ?? 0) +
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

    if (descriptor.kind === "overlapping-category") {
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

    const descriptorPlanningCategories = getSourceBackedPlanningCategories(
      descriptor.categories
    );
    const inferredAdditionalAhSscCredits =
      getInferredAdditionalAhSscCreditsForSharedBucket(descriptor, fixedCreditsByCategory);
    if (
      inferredAdditionalAhSscCredits !== null &&
      hasSameSourceBackedCategorySet(descriptorPlanningCategories, ["ah", "ssc"])
    ) {
      if (inferredAdditionalAhSscCredits > 0) {
        pushItem({
          id: `additional-${descriptorPlanningCategories.join("-")}`,
          label: `Additional ${joinSourceBackedGeneralEducationCategoryLabels(
            descriptorPlanningCategories,
            "slash"
          )}`,
          valueText: formatSourceBackedGeneralEducationCreditCount(
            inferredAdditionalAhSscCredits
          ),
          sourceKind: "source-backed-major",
        });
      }
    }

    const fixedCreditTotal = descriptorPlanningCategories.reduce(
      (totalCredits, category) => totalCredits + (fixedCreditsByCategory.get(category) ?? 0),
      0
    );
    const additionalFlexibleCredits =
      additionalFlexibleByCategoryKey.get(descriptorPlanningCategories.join("-")) ?? 0;
    const isFullyExpandedAhOrSscBucket =
      hasSameSourceBackedCategorySet(descriptorPlanningCategories, ["ah", "ssc"]) &&
      descriptor.categories.length === descriptorPlanningCategories.length &&
      fixedCreditTotal + additionalFlexibleCredits === descriptor.totalCredits;
    if (isFullyExpandedAhOrSscBucket) {
      continue;
    }

    const overlappingDescriptors = descriptor.categories
      .map((category) => overlappingCategoryDescriptorsByCategory.get(category))
      .filter(
        (
          entry
        ): entry is Extract<
          SourceBackedGeneralEducationDescriptor,
          { kind: "overlapping-category" }
        > => Boolean(entry)
      )
      .filter((entry) =>
        entry.overlappingCategories.every((category) =>
          descriptor.categories.includes(category)
        )
      );
    const overlappingCategoryIds = new Set(
      overlappingDescriptors.map((entry) => entry.category)
    );
    const sharedCategories = descriptor.categories.filter(
      (category) => !overlappingCategoryIds.has(category)
    );
    const sharedCategoryLabel = joinSourceBackedGeneralEducationCategoryLabels(
      sharedCategories.length ? sharedCategories : descriptor.categories
    );
    const noteParts: string[] = [];
    if (descriptor.scope === "areas-of-inquiry" && descriptor.categories.length) {
      noteParts.push(`Shared across ${sharedCategoryLabel}.`);
    }
    for (const overlappingDescriptor of overlappingDescriptors) {
      noteParts.push(
        `${formatSourceBackedGeneralEducationCreditCount(
          overlappingDescriptor.credits
        )} must also satisfy ${
          SOURCE_BACKED_GENERAL_ED_CATEGORY_LABELS[overlappingDescriptor.category]
        }.`
      );
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
      valueText:
        descriptor.scope === "areas-of-inquiry"
          ? `${formatSourceBackedGeneralEducationCreditCount(descriptor.totalCredits)} total`
          : `${formatSourceBackedGeneralEducationCreditCount(descriptor.totalCredits)} shared`,
      note: noteParts.join(" ").trim() || undefined,
      sourceKind: "source-backed-major",
    });
  }

  for (const descriptor of overlappingCategoryDescriptorsByCategory.values()) {
    pushItem({
      id: `overlapping-${descriptor.category}`,
      label: SOURCE_BACKED_GENERAL_ED_CATEGORY_LABELS[descriptor.category],
      valueText: formatSourceBackedGeneralEducationCreditCount(descriptor.credits),
      note: descriptor.overlappingCategories.length
        ? `Overlaps with ${joinSourceBackedGeneralEducationCategoryLabels(
            descriptor.overlappingCategories,
            "slash"
          )}.`
        : "Overlaps with the Areas of Inquiry courses.",
      sourceKind: "source-backed-major",
    });
  }

  for (const [category, credits] of fixedCreditsByCategory) {
    if (explicitFixedCategories.has(category)) {
      continue;
    }

    pushItem({
      id: category,
      label: SOURCE_BACKED_GENERAL_ED_CATEGORY_LABELS[category],
      valueText: formatSourceBackedGeneralEducationCreditCount(credits),
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

function getTransferCategoryRestrictionSourceLines(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  const sourcePlan = getGeneralEducationRequirementTargetSourcePlan(plan) ?? plan;
  if (!sourcePlan) {
    return [] as string[];
  }

  const selectedPathwayId = getSelectedPathwayId(sourcePlan);
  const parsedRequirementSourceBlocks = uniqueBy(
    [
      ...getTransferPlannerParsedRequirementSourceBlocks(sourcePlan.id, selectedPathwayId),
      ...(selectedPathwayId
        ? getTransferPlannerParsedRequirementSourceBlocks(sourcePlan.id, null)
        : []),
    ],
    (block) => block.id
  );
  const parsedRequirementSourceLines = parsedRequirementSourceBlocks.flatMap(
    (block) => block.requirementCueLines ?? []
  );
  const planLines = [
    sourcePlan.summary,
    sourcePlan.recommendedTrackSummary,
    ...(sourcePlan.degreeMapSections ?? []).flatMap((section) => [
      section.title,
      section.note ?? "",
      ...section.items,
    ]),
    ...(sourcePlan.advisorFlags ?? []),
    ...(sourcePlan.validationNotes ?? []),
  ];

  return unique([...parsedRequirementSourceLines, ...planLines])
    .map((line) => sanitizeGeneralEducationSourceSignalLine(line))
    .filter(Boolean);
}

function isSpecificNaturalScienceTransferCategoryRestrictionLine(
  line: string | null | undefined
) {
  const sanitizedLine = sanitizeGeneralEducationSourceSignalLine(line);
  if (!sanitizedLine || !/\bnsc\b|\bnatural sciences?\b/i.test(sanitizedLine)) {
    return false;
  }

  if (
    /\b(?:may count|can count|opportunity to take|not designed for|critical literacy in the natural sciences|writing in the natural sciences)\b/i.test(
      sanitizedLine
    )
  ) {
    return false;
  }

  const hasNscCategoryCue =
    /\bnatural sciences?\s*\(\s*nsc\s*\)/i.test(sanitizedLine) ||
    /\bnsc\b/i.test(sanitizedLine) ||
    /\bnatural sciences?\s+requirements?\b/i.test(sanitizedLine);
  const hasRestrictedListCue =
    /\b(?:must come from|from this list|approved(?:\s+additional)?\s+natural sciences?|natural sciences?\s+course lists?|hcde-specific|specific\s+mathematics,\s+statistics,\s+and\s+sciences)\b/i.test(
      sanitizedLine
    );
  if (hasNscCategoryCue && hasRestrictedListCue) {
    return true;
  }

  if (/\b(?:any|other)\s+natural sciences?\b/i.test(sanitizedLine)) {
    return false;
  }

  const naturalScienceHeaderWithColon =
    /\bnatural sciences?\s*\(\s*nsc\s*\)[^:]{0,80}:\s*$/i.test(sanitizedLine) ||
    /\bnatural sciences?\s*\(\s*nsc\s*\)[^:]{0,80}:\s*.*\b[A-Z]{2,}(?:\s*&)?\s+\d{3}/i.test(
      sanitizedLine
    );
  if (naturalScienceHeaderWithColon) {
    return true;
  }

  const hasCourseCodes =
    extractSourceBackedUwCourseCodesFromRequirementText(sanitizedLine).length > 0;
  const hasNscListSyntax = /\bnsc\b[^:]{0,40}:\s*/i.test(sanitizedLine);
  return hasCourseCodes && hasNscListSyntax;
}

function hasSpecificNaturalScienceTransferCategoryRestriction(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  return getTransferCategoryRestrictionSourceLines(plan).some(
    isSpecificNaturalScienceTransferCategoryRestrictionLine
  );
}

function ruleSatisfiesTransferCategoryTag(
  rule: TransferPlannerEquivalencyRule,
  normalizedTag: string
) {
  if (rule.acceptanceCategory === "no-credit" || rule.type === "no-credit") {
    return false;
  }

  return getEvaluationTargetRequirementTags(rule).includes(normalizedTag);
}

export function buildEligibleTransferCategorySourceCourseCodesForPlan(
  plan: TransferPlannerMajorPlan | null | undefined,
  tag: string | null | undefined
) {
  const normalizedTag = normalizeGeneralEducationRequirementTag(tag);
  if (!plan || normalizedTag !== "NSC") {
    return null as string[] | null;
  }

  if (!hasSpecificNaturalScienceTransferCategoryRestriction(plan)) {
    return null as string[] | null;
  }

  const eligibleCourseCodes = getTransferPlannerGrcCourseList(plan).filter((courseCode) =>
    getTransferPlannerEquivalencyRulesForSourceCourse(courseCode).some(
      (rule) =>
        rule.targetSchoolIds.includes(plan.campusId) &&
        ruleSatisfiesTransferCategoryTag(rule, normalizedTag)
    )
  );

  return eligibleCourseCodes.length ? sortCourseCodes(eligibleCourseCodes) : null;
}

function normalizeCourseCodeIterable(courseCodes: Iterable<string>) {
  return new Set(
    Array.from(courseCodes)
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function getCourseSequenceSubject(courseCode: string) {
  return getCourseSubject(courseCode)?.replace(/&/g, "") ?? null;
}

function getSameSubjectPrerequisiteRequirementPaths(courseCode: string) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const course = getTransferPlannerCanonicalCourse("grc", normalizedCourseCode);
  const subject = getCourseSequenceSubject(normalizedCourseCode);
  if (!course || !subject) {
    return [] as string[][];
  }

  const sameSubjectPrerequisiteCodes = new Set(
    [
      ...(course.prerequisiteCourseCodes ?? []),
      ...(course.prerequisiteAlternativeCourseCodeSets ?? []).flat(),
    ]
      .map((prerequisiteCourseCode) => normalizeCourseCode(prerequisiteCourseCode))
      .filter(
        (prerequisiteCourseCode) =>
          prerequisiteCourseCode &&
          getCourseSequenceSubject(prerequisiteCourseCode) === subject
      )
  );

  if (!sameSubjectPrerequisiteCodes.size) {
    return [] as string[][];
  }

  return buildCourseMetadataRequirementPaths(
    course.prerequisiteCourseCodes,
    course.prerequisiteAlternativeCourseCodeSets,
    sameSubjectPrerequisiteCodes
  );
}

export function buildTransferPlannerGrcTranscriptReadyCourseCodes(input: {
  candidateCourseCodes: Iterable<string>;
  completedCourseCodes: Iterable<string>;
}) {
  const completedCourseCodes = normalizeCourseCodeIterable(input.completedCourseCodes);
  const candidateCourseCodes = sortCourseCodes(
    Array.from(normalizeCourseCodeIterable(input.candidateCourseCodes))
  );

  return candidateCourseCodes.filter((courseCode) => {
    if (completedCourseCodes.has(courseCode)) {
      return false;
    }

    return requirementPathsAreSatisfied(
      getSameSubjectPrerequisiteRequirementPaths(courseCode),
      completedCourseCodes
    );
  });
}

export function isTransferPlannerGrcCourseSetTranscriptReady(input: {
  sourceCourseCodes: Iterable<string>;
  completedCourseCodes: Iterable<string>;
  readyCourseCodes?: Iterable<string>;
}) {
  const sourceCourseCodes = Array.from(normalizeCourseCodeIterable(input.sourceCourseCodes));
  if (!sourceCourseCodes.length) {
    return true;
  }

  const completedCourseCodes = normalizeCourseCodeIterable(input.completedCourseCodes);
  const readyCourseCodes = normalizeCourseCodeIterable(
    input.readyCourseCodes ??
      buildTransferPlannerGrcTranscriptReadyCourseCodes({
        candidateCourseCodes: sourceCourseCodes,
        completedCourseCodes,
      })
  );

  const hasReadyCourse = sourceCourseCodes.some((courseCode) =>
    readyCourseCodes.has(courseCode)
  );
  if (!hasReadyCourse) {
    return false;
  }

  return sourceCourseCodes.every(
    (courseCode) =>
      completedCourseCodes.has(courseCode) || readyCourseCodes.has(courseCode)
  );
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
  return `needed for ${getGeneralEducationPlanTitle(plan)}`;
}

function getTrackGeneralEducationPlannerGuidanceRelationText(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  return `from the official matched Green River associate pathway map for ${getGeneralEducationPlanTitle(plan)}`;
}

function getTrackGeneralEducationTransferAdmissionCollegeLabel(args: {
  plannerCollegeId?: TransferPlannerSelectedCollegeId | null;
  plan?: TransferPlannerMajorPlan | null;
}) {
  if (args.plannerCollegeId === "grc") {
    return null;
  }

  if (args.plannerCollegeId === "uw" || args.plan?.campusId?.startsWith("uw-")) {
    return "UW";
  }

  return null;
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
      baselineCredits = getCompletedFlexibleBreadthCredits(
        completedCreditProgress,
        requirementTargets
      );
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
  plannerCollegeId?: TransferPlannerSelectedCollegeId | null;
  completedCreditProgress?: CompletedGeneralEducationCreditProgress;
}) {
  const requirementTargets = buildTrackGeneralEducationGuidanceTargets(args.placeholders);
  if (!hasGeneralEducationRequirementTargets(requirementTargets)) {
    return null;
  }

  const transferAdmissionCollegeLabel =
    getTrackGeneralEducationTransferAdmissionCollegeLabel(args);

  return buildGeneralEducationPlaceholderProgressSummary({
    ...args,
    requirementTargets,
    relationText: getTrackGeneralEducationPlannerGuidanceRelationText(args.plan),
    additionalGuidanceText: transferAdmissionCollegeLabel
      ? `This is an official Green River track slot, not an official ${transferAdmissionCollegeLabel} transfer admission requirement.`
      : null,
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
  plan: TransferPlannerMajorPlan | null | undefined,
  actionableCourseCodes: Set<string>
) {
  const requirementMap = new Map<string, string[][]>();
  const normalizedCs121Code = normalizeCourseCode("CS 121");
  const normalizedCs122Code = normalizeCourseCode("CS 122");
  const normalizedCs123Code = normalizeCourseCode("CS 123");
  const normalizedMath238Code = normalizeCourseCode("MATH 238");
  const normalizedMath264Code = normalizeCourseCode("MATH& 264");

  if (actionableCourseCodes.has(normalizedCs123Code)) {
    addCourseRequirementPath(requirementMap, normalizedCs123Code, [normalizedCs122Code]);
    addCourseRequirementPath(requirementMap, normalizedCs122Code, [normalizedCs121Code]);
  } else if (actionableCourseCodes.has(normalizedCs122Code)) {
    addCourseRequirementPath(requirementMap, normalizedCs122Code, [normalizedCs121Code]);
  }

  if (
    plan?.id === UW_SEATTLE_BIOENGINEERING_PLAN_ID &&
    actionableCourseCodes.has(normalizedMath238Code) &&
    actionableCourseCodes.has(normalizedMath264Code)
  ) {
    addCourseRequirementPath(requirementMap, normalizedMath238Code, [normalizedMath264Code]);
  }

  return requirementMap;
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

function applyPlannerPrerequisitePathOverrides(
  requirementMap: Map<string, string[][]>,
  actionableCourseCodes: Set<string>,
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (plan?.id !== UW_SEATTLE_BIOENGINEERING_PLAN_ID) {
    return requirementMap;
  }

  const normalizedEngl101Code = normalizeCourseCode("ENGL& 101");
  const normalizedChem163Code = normalizeCourseCode("CHEM& 163");
  const normalizedBiol211Code = normalizeCourseCode("BIOL& 211");
  const normalizedBiol212Code = normalizeCourseCode("BIOL& 212");
  const normalizedBiol213Code = normalizeCourseCode("BIOL& 213");
  const normalizedMath238Code = normalizeCourseCode("MATH 238");
  const normalizedMath264Code = normalizeCourseCode("MATH& 264");

  if (
    actionableCourseCodes.has(normalizedBiol211Code) &&
    actionableCourseCodes.has(normalizedChem163Code)
  ) {
    requirementMap.set(normalizedBiol211Code, [
      actionableCourseCodes.has(normalizedEngl101Code)
        ? [normalizedChem163Code, normalizedEngl101Code]
        : [normalizedChem163Code],
    ]);
  }
  if (actionableCourseCodes.has(normalizedBiol213Code)) {
    requirementMap.set(normalizedBiol213Code, [[normalizedBiol212Code]]);
  }
  if (actionableCourseCodes.has(normalizedBiol212Code)) {
    requirementMap.set(normalizedBiol212Code, [[normalizedBiol211Code]]);
  }
  if (
    actionableCourseCodes.has(normalizedMath238Code) &&
    actionableCourseCodes.has(normalizedMath264Code)
  ) {
    requirementMap.set(normalizedMath238Code, [[normalizedMath264Code]]);
  }

  return requirementMap;
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
  const prerequisiteMap = applyPlannerPrerequisitePathOverrides(
    mergeCourseRequirementMaps(
      metadataPrerequisiteMap,
      chainPrerequisiteMap
    ),
    actionableCourseCodes,
    input.plan
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

function isStudentSelectedGrcTrackOptionCourse(course: PendingSuggestedCourse) {
  return (
    course.sourceKind === "official-grc-track" &&
    course.optionGroup?.selectionSource === "student" &&
    !course.optionGroup.isSelectionPrompt &&
    course.optionGroup.selectedOptionIds.length > 0
  );
}

function courseHasSatisfiedPlanningGraph(
  course: PendingSuggestedCourse,
  completedCourseCodes: Set<string>,
  selectedCourses: PendingSuggestedCourse[]
) {
  if (isStudentSelectedGrcTrackOptionCourse(course)) {
    return true;
  }

  return (
    courseHasSatisfiedPrerequisites(course, completedCourseCodes) &&
    courseHasSatisfiedCorequisites(course, completedCourseCodes, selectedCourses)
  );
}

function getSuggestedQuarterCourseOptionSelectedCourseCodes(
  optionGroup: SuggestedQuarterCourseOptionGroup | null | undefined
) {
  if (!optionGroup?.selectedOptionIds.length) {
    return [] as string[];
  }

  const selectedOptionIdSet = new Set(optionGroup.selectedOptionIds);
  return sortCourseCodes(
    optionGroup.options
      .filter((option) => selectedOptionIdSet.has(option.id))
      .flatMap((option) => [
        ...(option.courseCodes ?? []),
        ...(option.courseLabels ?? []).flatMap((label) => extractCourseCodes(label)),
      ])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function getPendingSuggestedCourseSatisfyingCourseCodes(course: PendingSuggestedCourse) {
  const explicitCourseCodes = sortCourseCodes(
    (course.explicitCourseCodes ?? [])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
  if (explicitCourseCodes.length) {
    return explicitCourseCodes;
  }

  return getSuggestedQuarterCourseOptionSelectedCourseCodes(course.optionGroup);
}

function getSuggestedQuarterCourseSatisfyingCourseCodes(course: SuggestedQuarterCourse) {
  const explicitCourseCodes = sortCourseCodes(extractCourseCodes(course.label));
  if (explicitCourseCodes.length) {
    return explicitCourseCodes;
  }

  return getSuggestedQuarterCourseOptionSelectedCourseCodes(course.optionGroup);
}

function pendingSuggestedCourseIsAlreadySatisfied(
  course: PendingSuggestedCourse,
  completedCourseCodes: Set<string>
) {
  const satisfyingCourseCodes = getPendingSuggestedCourseSatisfyingCourseCodes(course);
  if (!satisfyingCourseCodes.length) {
    return false;
  }

  return satisfyingCourseCodes.every((courseCode) => completedCourseCodes.has(courseCode));
}

function pendingSuggestedCourseConflictsWithSelectedCourses(
  course: PendingSuggestedCourse,
  selectedCourseCodes: Set<string>
) {
  const satisfyingCourseCodes = getPendingSuggestedCourseSatisfyingCourseCodes(course);
  if (!satisfyingCourseCodes.length) {
    return false;
  }

  return satisfyingCourseCodes.some((courseCode) => selectedCourseCodes.has(courseCode));
}


function buildSeedCoursesForQuarter(
  seedCourses: PendingSuggestedCourse[] | undefined,
  completedCourseCodes: Set<string>
) {
  if (!seedCourses?.length) return [];

  const filtered: PendingSuggestedCourse[] = [];
  const selectedSequenceGroups = new Set<string>();
  const selectedLabelKeys = new Set<string>();
  const selectedCourseCodes = new Set<string>();

  for (const course of seedCourses) {
    if (pendingSuggestedCourseIsAlreadySatisfied(course, completedCourseCodes)) {
      continue;
    }

    const labelKey = String(course.label ?? "").trim().toLowerCase();
    const shouldEnforceUniqueLabel = course.explicitCourseCodes.length > 0;
    if (shouldEnforceUniqueLabel && selectedLabelKeys.has(labelKey)) {
      continue;
    }

    if (pendingSuggestedCourseConflictsWithSelectedCourses(course, selectedCourseCodes)) {
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
    for (const courseCode of getPendingSuggestedCourseSatisfyingCourseCodes(course)) {
      selectedCourseCodes.add(courseCode);
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
  const selectedCourseCodes = new Set(
    selectedCourses
      .flatMap((course) => getPendingSuggestedCourseSatisfyingCourseCodes(course))
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );

  const eligibleIndices = pool
    .map((course, index) => ({ course, index }))
    .filter(({ course }) => {
      if (isCourseAllowed && !isCourseAllowed(course)) {
        return false;
      }
      if (pendingSuggestedCourseIsAlreadySatisfied(course, completedCourseCodes)) {
        return false;
      }
      const labelKey = String(course.label ?? "").trim().toLowerCase();
      const shouldEnforceUniqueLabel = course.explicitCourseCodes.length > 0;
      if (shouldEnforceUniqueLabel && selectedLabelKeys.has(labelKey)) return false;
      if (pendingSuggestedCourseConflictsWithSelectedCourses(course, selectedCourseCodes)) return false;
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
  const isOptionGroupCourse = (course: PendingSuggestedCourse) =>
    Boolean(course.optionGroup);
  const isMainPlannedCourse = (course: PendingSuggestedCourse) =>
    (course.explicitCourseCodes.length > 0 || isOptionGroupCourse(course)) &&
    !isEnglishGeneralEducationCourse(course);
  const getMainCourseCount = (items: PendingSuggestedCourse[]) =>
    items.filter((item) => isMainPlannedCourse(item)).length;
  const getPlaceholderCount = (items: PendingSuggestedCourse[]) =>
    items.filter((item) => item.explicitCourseCodes.length === 0 && !isOptionGroupCourse(item)).length;
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
    return courses.map(toSuggestedQuarterCourse);
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

  return courses.map(toSuggestedQuarterCourse);
}

function hasPendingQuarterPlanCourses(pools: PendingSuggestedCourse[][]) {
  return pools.some((pool) => pool.length > 0);
}

function recordPlannedQuarterCourseCodes(
  courses: SuggestedQuarterCourse[],
  completedCourseCodes: Set<string>
) {
  for (const course of courses) {
    for (const courseCode of getSuggestedQuarterCourseSatisfyingCourseCodes(course)) {
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
  corequisiteCourseMap: Map<string, string[][]>,
  selectedRequirementOptionIdsByGroup: Record<string, string[] | string | null | undefined> = {},
  campusId?: TransferPlannerMajorPlan["campusId"] | null,
  plan?: TransferPlannerMajorPlan | null
) {
  const remainingByLabel = new Map<string, PendingSuggestedCourse>();
  let sourceOrder = 0;
  const majorRequirementGuidanceSummary = buildUwMajorRequirementGuidanceSummary();
  const addRemainingCourse = (nextCourse: PendingSuggestedCourse) => {
    const scopedCourse = withSuggestedQuarterCourseVisibilityScope(nextCourse, {
      plan,
      sourceKind: nextCourse.sourceKind,
    });

    if (isUwTransferPlannerPlan(plan) && !isVisibleGrcQuarterPlanCourse(scopedCourse)) {
      return;
    }

    const remainingKey = scopedCourse.optionGroup?.id
      ? `${scopedCourse.label}||${scopedCourse.optionGroup.id}`
      : scopedCourse.label;
    const existing = remainingByLabel.get(remainingKey);
    sourceOrder += 1;

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
      return;
    }

    remainingByLabel.set(remainingKey, scopedCourse);
  };

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
      const guidanceSummary = joinGuidanceSummaries(
        majorRequirementGuidanceSummary,
        buildChecklistGuidanceSummary(section.bucket, status.item)
      );
      const selectedOptionIds = shouldScheduleAsChoiceBucket
        ? getPlannerSelectedRequirementOptionIdsForScheduling({
            item: status.item,
            selectedRequirementOptionIdsByGroup,
            plan,
          })
        : [];
      const selectedOptionGroup = shouldScheduleAsChoiceBucket
        ? buildSuggestedQuarterCourseOptionGroup({
            item: status.item,
            selectedOptionIds,
            isSelectionPrompt: false,
            campusId,
          })
        : null;
      const selectedOptionEntries = selectedOptionGroup
        ? getSelectedRequirementOptionsForPlanner(
            status.item,
            selectedOptionGroup.selectedOptionIds
          ).slice(0, selectedOptionGroup.selectionCount)
        : [];

      if (selectedOptionGroup && selectedOptionEntries.length) {
        const selectedOptionIdSet = new Set(
          selectedOptionEntries.map((entry) => entry.optionId)
        );
        const resolvedOptionGroup = {
          ...selectedOptionGroup,
          selectedOptionIds: selectedOptionGroup.selectedOptionIds.filter((optionId) =>
            selectedOptionIdSet.has(optionId)
          ),
          isSelectionPrompt: false,
        };
        let isFirstSelectedOptionCourse = true;

        for (const selectedEntry of selectedOptionEntries) {
          const selectedCourseLabels = getRequirementOptionCourseLabels(selectedEntry.option);
          const selectedOptionCreditRange = getRequirementOptionCreditRange(
            selectedEntry.option,
            selectedCourseLabels
          );

          for (const selectedLabel of selectedCourseLabels) {
            const explicitCourseCodes = extractCourseCodes(selectedLabel);
            const selectedCourseCreditRange =
              selectedCourseLabels.length === 1
                ? selectedOptionCreditRange
                : getSuggestedCourseCreditRangeFromValues({
                    creditAmount: inferSuggestedCourseCreditAmount(
                      selectedLabel,
                      explicitCourseCodes
                    ),
                  });
            const nextCourse: PendingSuggestedCourse = {
              label: selectedLabel,
              type: isCoreCourseLabel(`${status.item.title} ${selectedLabel}`)
                ? "core"
                : "elective",
              status: "planned",
              sourceKind: "uw-major-requirement",
              guidanceSummary,
              sequenceGroup:
                selectedCourseLabels.length > 1
                  ? `${status.item.id}:${selectedEntry.optionId}`
                  : null,
              priorityRank: REQUIREMENT_PRIORITY_RANK[section.bucket],
              sourceOrder,
              explicitCourseCodes,
              prerequisiteCourseSets: unique(
                explicitCourseCodes.flatMap(
                  (courseCode) => prerequisiteCourseMap.get(courseCode) ?? []
                )
              ).map((courseSet) => [...courseSet]),
              corequisiteCourseSets: unique(
                explicitCourseCodes.flatMap(
                  (courseCode) => corequisiteCourseMap.get(courseCode) ?? []
                )
              ).map((courseSet) => [...courseSet]),
              optionGroup: isFirstSelectedOptionCourse ? resolvedOptionGroup : null,
              ...selectedCourseCreditRange,
            };

            addRemainingCourse(nextCourse);
            isFirstSelectedOptionCourse = false;
          }
        }

        if (selectedOptionEntries.length >= selectedOptionGroup.selectionCount) {
          continue;
        }
      }

      const promptOptionGroup = shouldScheduleAsChoiceBucket
        ? buildSuggestedQuarterCourseOptionGroup({
            item: status.item,
            selectedOptionIds,
            isSelectionPrompt: true,
            campusId,
          })
        : null;

      if (shouldScheduleAsChoiceBucket && status.item.requirementGroup && !promptOptionGroup) {
        continue;
      }

      const labelsForPlanner = shouldScheduleAsChoiceBucket
        ? [
            promptOptionGroup?.promptLabel ??
              buildChecklistChoiceLabel(
                status.item,
                remainingNeeded,
                status.matchedCourses.length
              ),
          ]
        : labelsToSchedule;

      for (const label of labelsForPlanner) {
        const explicitCourseCodes = shouldScheduleAsChoiceBucket ? [] : extractCourseCodes(label);
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
          sourceKind: "uw-major-requirement",
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
          explicitCourseCodes,
          prerequisiteCourseSets: unique(
            explicitCourseCodes.flatMap((courseCode) => prerequisiteCourseMap.get(courseCode) ?? [])
          ).map((courseSet) => [...courseSet]),
          corequisiteCourseSets: unique(
            explicitCourseCodes.flatMap((courseCode) => corequisiteCourseMap.get(courseCode) ?? [])
          ).map((courseSet) => [...courseSet]),
          optionGroup: promptOptionGroup,
          ...(promptOptionGroup
            ? getSuggestedQuarterCourseOptionGroupCreditRange(promptOptionGroup)
            : {}),
        };

        addRemainingCourse(nextCourse);
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
  completedCourseCodes: Set<string>,
  prerequisiteCourseMap: Map<string, string[][]>,
  corequisiteCourseMap: Map<string, string[][]>
) {
  const candidateByCode = new Map<string, PendingSuggestedCourse>();
  for (const course of candidateDependencyCourses) {
    for (const courseCode of course.explicitCourseCodes) {
      if (!candidateByCode.has(courseCode)) {
        candidateByCode.set(courseCode, course);
      }
    }
  }

  const buildSyntheticDependencyCourse = (
    courseCode: string,
    dependentCourse: PendingSuggestedCourse
  ): PendingSuggestedCourse | null => {
    const normalizedCourseCode = normalizeCourseCode(courseCode);
    if (!normalizedCourseCode || !hasConcreteGrcCourseCode(normalizedCourseCode)) {
      return null;
    }

    const canonicalCourse = getTransferPlannerCanonicalCourse("grc", normalizedCourseCode);
    if (!canonicalCourse) {
      return null;
    }

    return {
      label: normalizedCourseCode,
      type: isCoreCourseLabel(normalizedCourseCode) ? "core" : "elective",
      status: "planned",
      sourceKind: "official-grc-track",
      visibilityScope: "visible-grc-prerequisite",
      isVisibleInGrcQuarterPlan: true,
      isUwOnlyRequirement: false,
      courseRole: "local_grc_prerequisite",
      guidanceSummary: null,
      sequenceGroup: null,
      priorityRank: Math.min(
        dependentCourse.priorityRank,
        REQUIREMENT_PRIORITY_RANK.beforeEnrollment
      ),
      sourceOrder: dependentCourse.sourceOrder,
      explicitCourseCodes: [normalizedCourseCode],
      prerequisiteCourseSets: (prerequisiteCourseMap.get(normalizedCourseCode) ?? []).map(
        (courseSet) => [...courseSet]
      ),
      corequisiteCourseSets: (corequisiteCourseMap.get(normalizedCourseCode) ?? []).map(
        (courseSet) => [...courseSet]
      ),
    };
  };
  const canResolveDependencyCourseCode = (courseCode: string) => {
    const normalizedCourseCode = normalizeCourseCode(courseCode);
    return Boolean(
      completedCourseCodes.has(normalizedCourseCode) ||
        candidateByCode.has(normalizedCourseCode) ||
        (
          hasConcreteGrcCourseCode(normalizedCourseCode) &&
          getTransferPlannerCanonicalCourse("grc", normalizedCourseCode)
        )
    );
  };

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
          path.every((courseCode) => canResolveDependencyCourseCode(courseCode))
        ) ??
        requirementPaths.find((path) => path.some((courseCode) => canResolveDependencyCourseCode(courseCode))) ??
        null;
      if (!selectedPath) continue;

      for (const courseCode of selectedPath) {
        if (completedCourseCodes.has(courseCode) || selectedCourseCodes.has(courseCode)) {
          continue;
        }

        const dependencyCourse = candidateByCode.get(courseCode);
        const resolvedDependencyCourse =
          dependencyCourse ??
          buildSyntheticDependencyCourse(courseCode, course);
        if (
          !resolvedDependencyCourse ||
          selectedByLabel.has(resolvedDependencyCourse.label)
        ) {
          continue;
        }

        const isDirectUwTransferRequirement =
          resolvedDependencyCourse.sourceKind === "uw-major-requirement" ||
          resolvedDependencyCourse.sourceKind === "uw-major-breadth";
        const promotedDependencyCourse: PendingSuggestedCourse = {
          ...resolvedDependencyCourse,
          ...(!isDirectUwTransferRequirement
            ? {
                visibilityScope: "visible-grc-prerequisite" as const,
                isVisibleInGrcQuarterPlan: true,
                isUwOnlyRequirement: false,
                courseRole: "local_grc_prerequisite" as const,
              }
            : {}),
          priorityRank: Math.min(
            resolvedDependencyCourse.priorityRank,
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
  plannerCollegeId?: TransferPlannerSelectedCollegeId | null;
  applicationStatuses: TransferRequirementStatus[];
  beforeEnrollmentStatuses: TransferRequirementStatus[];
  stayAtGrcStatuses: TransferRequirementStatus[];
  completedCourses: TranscriptCourseEntry[];
  track: TransferPlannerTrack | null;
  currentCourseKeys?: string[];
  currentCourseLabels?: string[];
  referenceDate?: Date;
  includeStayAtGrcCourses?: boolean;
  includeSummerQuarter?: boolean;
  includeStemPrepCourses?: boolean;
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
}) {
  const includeSummerQuarter = input.includeSummerQuarter === true;
  const includeStemPrepCourses = input.includeStemPrepCourses !== false;
  const stemPrepCourseCodes = getStemPrepCourseCodeSet(input.track);
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
    }).filter((status) =>
      !isUwTransferPlannerPlan(input.plan) ||
      hasVisibleGrcCourseOrEquivalent(status.explicitCourseCodes, input.plan)
    );
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
  const selectedCurrentCourseKeys = new Set(
    unique(
      (input.currentCourseKeys ?? [])
        .map((key) => String(key ?? "").trim())
        .filter(Boolean)
    )
  );
  const isSelectedCurrentCourse = (course: SuggestedQuarterCourse) =>
    (!!course.instanceKey && selectedCurrentCourseKeys.has(course.instanceKey)) ||
    selectedCurrentCourseLabels.has(course.label);
  const completedCourseCodes = new Set(input.completedCourses.map((course) => course.code));
  const planningSatisfiedCourseCodes = new Set([
    ...completedCourseCodes,
    ...(!includeStemPrepCourses ? stemPrepCourseCodes : []),
  ]);
  const checklistCourseCodes = new Set(
    [
      ...applicationStatuses,
      ...beforeEnrollmentStatuses,
      ...stayAtGrcStatuses,
    ].flatMap((status) => status.explicitCourseCodes)
  );
  const trackSupplementalCoveredCourseCodes = new Set([
    ...[
      ...applicationStatuses,
      ...beforeEnrollmentStatuses,
      ...stayAtGrcStatuses,
    ].flatMap((status) =>
      isChoiceRequirementStatus(status)
        ? status.matchedCourses.map((course) => course.code)
        : status.explicitCourseCodes
    ),
  ]);
  const includeFlexibleGrcTrackSlots = !input.plan;
  const resolvedTrackSupplementalCourseSlots = getResolvedTrackSupplementalCourseLabels({
    track: input.track,
    completedCourses: input.completedCourses,
    completedCourseCodes,
    coveredCourseCodes: trackSupplementalCoveredCourseCodes,
    referenceDate: input.referenceDate,
    includeFlexibleTrackSlots: includeFlexibleGrcTrackSlots,
  });
  const actionableCourseCodes = new Set([
    ...completedCourseCodes,
    ...checklistCourseCodes,
    ...resolvedTrackSupplementalCourseSlots.flatMap((slot) =>
      slot.kind === "label"
        ? extractCourseCodes(slot.label)
        : slot.groupedChoice.options.flatMap((option) => [
            ...(option.courseCodes ?? []),
            ...(option.courseLabels ?? []).flatMap((label) => extractCourseCodes(label)),
          ])
    ),
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

  const essentialRemainingCourses = buildRemainingSuggestedCourses(
    [
      {
        bucket: "application",
        statuses: applicationStatuses,
      },
      {
        bucket: "beforeEnrollment",
        statuses: beforeEnrollmentStatuses,
      },
    ],
    prerequisiteCourseMap,
    corequisiteCourseMap,
    input.selectedRequirementOptionIdsByGroup,
    input.plan?.campusId,
    input.plan
  );
  const stayAtGrcRemainingCourses = buildRemainingSuggestedCourses(
    [
      {
        bucket: "stayAtGrc",
        statuses: stayAtGrcStatuses,
      },
    ],
    prerequisiteCourseMap,
    corequisiteCourseMap,
    input.selectedRequirementOptionIdsByGroup,
    input.plan?.campusId,
    input.plan
  );
  const trackSupplementalCourses = buildTrackSupplementalSuggestedCourses({
    track: input.track,
    courseSlots: resolvedTrackSupplementalCourseSlots,
    prerequisiteCourseMap,
    corequisiteCourseMap,
    sourceOrderStart: essentialRemainingCourses.length + stayAtGrcRemainingCourses.length,
    completedCourseCodes,
    coveredCourseCodes: trackSupplementalCoveredCourseCodes,
    selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
    includeFlexibleTrackSlots: includeFlexibleGrcTrackSlots,
  });
  const essentialDependencyCourses = buildPrerequisiteDependencyCoursesForEssentialPlan(
    essentialRemainingCourses,
    [...stayAtGrcRemainingCourses, ...trackSupplementalCourses],
    planningSatisfiedCourseCodes,
    prerequisiteCourseMap,
    corequisiteCourseMap
  );
  const essentialDependencySupportCourses = essentialDependencyCourses.filter(
    (course) =>
      course.courseRole === "local_grc_prerequisite" ||
      (
        course.sourceKind !== "uw-major-requirement" &&
        course.sourceKind !== "uw-major-breadth"
      )
  );
  const remainingCoursesWithStemPrep =
    input.includeStayAtGrcCourses === false
      ? [...essentialRemainingCourses, ...essentialDependencyCourses]
      : [
          ...buildRemainingSuggestedCourses(
            [
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
            ],
            prerequisiteCourseMap,
            corequisiteCourseMap,
            input.selectedRequirementOptionIdsByGroup,
            input.plan?.campusId,
            input.plan
          ),
          ...essentialDependencySupportCourses,
          ...trackSupplementalCourses,
        ];
  const remainingCourses = filterStemPrepSuggestedCourses(
    remainingCoursesWithStemPrep,
    stemPrepCourseCodes,
    includeStemPrepCourses
  );
  const guidedRemainingCourses = assignSuggestedCourseInstanceKeys(
    attachOptionalStemPrepMetadata(
      attachLocalGrcPrerequisiteMetadata({
        courses: attachAutomaticPrerequisiteGuidance(
          attachAutomaticTransferEquivalencyGuidance(
            remainingCourses,
            input.plan?.campusId,
            completedCourseCodes
          )
        ),
        plan: input.plan,
        stemPrepCourseCodes,
      }),
      stemPrepCourseCodes
    ),
    "requirement"
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
  const guidedCoursesStillToPlan = guidedRemainingCourses
    .filter(isVisibleGrcQuarterPlanCourse)
    .filter((course) => !isSelectedCurrentCourse(course));

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
    includePlannerGuidancePlaceholders:
      input.plannerCollegeId === "grc" || input.includeStayAtGrcCourses === true,
  });
  const hasExplicitRemainingPlannerCourses = guidedCoursesStillToPlan.some(
    (course) => course.explicitCourseCodes.length > 0
  );
  const shouldSuppressGeneralEducationOnlyFiller =
    !!input.plan &&
    !hasExplicitRemainingPlannerCourses &&
    getTransferPlannerGrcCourseList(input.plan).length === 0;
  const allFillerPool =
    (input.includeStayAtGrcCourses === false && !input.plan) ||
    shouldSuppressGeneralEducationOnlyFiller
      ? []
      : assignSuggestedCourseInstanceKeys(fillerPlaceholderEntries.map<PendingSuggestedCourse>(
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
                    plannerCollegeId: input.plannerCollegeId,
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
              sourceKind:
                placeholderEntry.sourceKind === "planner-guidance"
                  ? "official-grc-track-breadth"
                  : "uw-major-breadth",
              visibilityScope: "visible-grc-completable",
              isVisibleInGrcQuarterPlan: true,
              isUwOnlyRequirement: false,
              guidanceSummary,
              sequenceGroup: null,
              priorityRank: REQUIREMENT_PRIORITY_RANK.stayAtGrc + 1,
              sourceOrder: Number.MAX_SAFE_INTEGER,
              explicitCourseCodes: [],
              prerequisiteCourseSets: [],
              corequisiteCourseSets: [],
            };
          }
        ), "gen-ed");
  const currentQuarterCourses = [
    ...guidedRemainingCourses,
    ...allFillerPool,
  ]
    .filter(isVisibleGrcQuarterPlanCourse)
    .filter(isSelectedCurrentCourse)
    .map<PendingSuggestedCourse>((course) => ({
      ...course,
      status: "current",
    }));
  const currentQuarterPlanCourses = currentQuarterCourses.map(toSuggestedQuarterCourse);
  const currentQuarterSlot = currentQuarterCourses.length
    ? getCurrentOrNextQuarterSlot(input.referenceDate, includeSummerQuarter)
    : null;
  const futurePlanningSatisfiedCourseCodes = new Set(planningSatisfiedCourseCodes);
  recordPlannedQuarterCourseCodes(currentQuarterPlanCourses, futurePlanningSatisfiedCourseCodes);
  const fillerPool = allFillerPool.filter((course) => !isSelectedCurrentCourse(course));
  const currentQuarterPlan = currentQuarterCourses.length
    ? {
        label: currentQuarterSlot?.label ?? "Current / In progress",
        phase: "current" as const,
        courses: currentQuarterPlanCourses,
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
    !hasPendingFutureCourses && !completedQuarterPlans.length && !currentQuarterPlanCourses.length;
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
        completedCourseCodes: futurePlanningSatisfiedCourseCodes,
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
        recordPlannedQuarterCourseCodes(courses, futurePlanningSatisfiedCourseCodes);
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

export function auditVisibleGrcQuarterPlanScope(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
  transferOnlyMode?: boolean;
}) {
  const visibleRows = input.suggestedPlan.flatMap((quarter) =>
    quarter.courses.map((course) => ({ quarter, course }))
  );
  const visibleCourseCodes = visibleRows.flatMap(({ course }) => extractCourseCodes(course.label));
  const requiredCourseCodes = buildSourceBackedRequiredCourseCodes(input.plan);
  const requiredCourseCodeSet = new Set(requiredCourseCodes.map((code) => normalizeCourseCode(code)));
  const completedCourseCodeSet = new Set(
    (input.completedCourses ?? []).map((course) => normalizeCourseCode(course.code))
  );
  const plannedOrCompletedCourseCodeSet = new Set(
    [...visibleCourseCodes, ...completedCourseCodeSet].map((code) => normalizeCourseCode(code))
  );
  const graph = buildTransferPlannerCoursePlanningGraph({
    plan: input.plan,
    actionableCourseCodes: new Set([
      ...visibleCourseCodes,
      ...requiredCourseCodes,
      ...completedCourseCodeSet,
    ]),
  });
  const prerequisiteCourseMap = getCoursePlanningGraphRequirementMap(
    graph,
    "prerequisiteCourseSetsByCourseCode"
  );
  const satisfiedBeforeQuarter = new Set(completedCourseCodeSet);
  const prerequisiteFlagsByCourseLabel = new Map<string, string[]>();

  for (const quarter of input.suggestedPlan) {
    const quarterCourseCodes: string[] = [];
    for (const course of quarter.courses) {
      const courseCodes = extractCourseCodes(course.label).map((code) => normalizeCourseCode(code));
      if (quarter.phase !== "completed") {
        for (const courseCode of courseCodes) {
          const prerequisiteCourseSets = prerequisiteCourseMap.get(courseCode) ?? [];
          if (
            prerequisiteCourseSets.length &&
            !requirementPathsAreSatisfied(prerequisiteCourseSets, satisfiedBeforeQuarter)
          ) {
            prerequisiteFlagsByCourseLabel.set(course.label, [
              ...(prerequisiteFlagsByCourseLabel.get(course.label) ?? []),
              "course-scheduled-before-prerequisite",
            ]);
          }
        }
      }
      quarterCourseCodes.push(...courseCodes);
    }
    for (const courseCode of quarterCourseCodes) {
      satisfiedBeforeQuarter.add(courseCode);
    }
  }
  const transferOnlyMode = input.transferOnlyMode ?? isUwTransferPlannerPlan(input.plan);

  const rowAuditEntries = visibleRows.map(({ quarter, course }) => {
    const courseCodes = extractCourseCodes(course.label);
    const hasGrcCourse = courseCodes.some((courseCode) =>
      hasConcreteGrcCourseCode(courseCode)
    );
    const hasGrcEquivalent = courseCodes.some((courseCode) =>
      hasSourceBackedGrcEquivalentForUwCourse(courseCode, input.plan)
    );
    const isPlaceholder = !courseCodes.length;
    const isAllowedPlaceholder =
      isPlaceholder &&
      (course.sourceKind === "official-grc-track-breadth" ||
        course.sourceKind === "uw-major-breadth");
    const flags: string[] = [];

    if (!hasGrcCourse && !hasGrcEquivalent && !isAllowedPlaceholder) {
      flags.push("visible-row-has-no-grc-course-or-equivalent");
    }

    if (course.visibilityScope === "hidden-uw-only") {
      flags.push("hidden-uw-only-row-visible");
    }

    flags.push(...(prerequisiteFlagsByCourseLabel.get(course.label) ?? []));

    const nonRequiredTransferOnlyCourseCodes = courseCodes
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter((courseCode) => hasConcreteGrcCourseCode(courseCode))
      .filter((courseCode) => !requiredCourseCodeSet.has(courseCode));
    const isAllowedSupportCourse =
      course.courseRole === "local_grc_prerequisite" ||
      course.courseRole === "optional_stem_prep" ||
      course.visibilityScope === "visible-grc-prerequisite" ||
      course.visibilityScope === "visible-grc-optional-prep";
    if (
      transferOnlyMode &&
      quarter.phase !== "completed" &&
      course.sourceKind === "uw-major-requirement" &&
      nonRequiredTransferOnlyCourseCodes.length > 0 &&
      !isAllowedSupportCourse
    ) {
      flags.push("non-required-transfer-only-course-without-source-backed-evidence");
    }

    return {
      label: course.label,
      sourceKind: course.sourceKind ?? null,
      visibilityScope: course.visibilityScope ?? null,
      courseCodes,
      flags,
    };
  });

  const missingRequiredEntries = requiredCourseCodes
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter(Boolean)
    .filter((courseCode, index, courseCodes) => courseCodes.indexOf(courseCode) === index)
    .filter((courseCode) => hasConcreteGrcCourseCode(courseCode))
    .filter((courseCode) => !plannedOrCompletedCourseCodeSet.has(courseCode))
    .map((courseCode) => ({
      label: courseCode,
      sourceKind: null,
      visibilityScope: null,
      courseCodes: [courseCode],
      flags: ["uw-required-course-missing-grc-equivalent"],
    }));

  return [...rowAuditEntries, ...missingRequiredEntries].filter(
    (entry) => entry.flags.length > 0
  );
}

export type UwCivilEngineeringLowerDivisionRequirementAuditEntry = {
  uwRequirement: string;
  grcEquivalents: string[];
  visibleInQuarterPlan: boolean;
  visibleCourseCodes: string[];
  hiddenUnmappedReason: string | null;
};

const UW_SEATTLE_CIVIL_ENGINEERING_PLAN_ID = "uw-seattle-civil-engineering";
const UW_CIVIL_ENGINEERING_LOWER_DIVISION_REQUIREMENT_AUDIT_ROWS: {
  uwRequirement: string;
  grcEquivalents: string[];
  hiddenUnmappedReason?: string;
}[] = [
  { uwRequirement: "English Composition", grcEquivalents: ["ENGL& 101"] },
  { uwRequirement: "MATH 124", grcEquivalents: ["MATH& 151"] },
  { uwRequirement: "MATH 125", grcEquivalents: ["MATH& 152"] },
  { uwRequirement: "MATH 126", grcEquivalents: ["MATH& 163"] },
  { uwRequirement: "MATH 207", grcEquivalents: ["MATH 238"] },
  { uwRequirement: "MATH 208", grcEquivalents: ["MATH 240"] },
  { uwRequirement: "CHEM 142", grcEquivalents: ["CHEM& 161"] },
  { uwRequirement: "CHEM 152", grcEquivalents: ["CHEM& 162"] },
  { uwRequirement: "PHYS 121", grcEquivalents: ["PHYS& 221"] },
  { uwRequirement: "PHYS 122", grcEquivalents: ["PHYS& 222"] },
  { uwRequirement: "PHYS 123", grcEquivalents: ["PHYS& 223"] },
  { uwRequirement: "AA 210", grcEquivalents: ["ENGR& 214"] },
  { uwRequirement: "CEE 220", grcEquivalents: ["ENGR& 225"] },
  { uwRequirement: "ME 230", grcEquivalents: ["ENGR& 215"] },
  {
    uwRequirement: "Economics: IND E 250, ECON 200 or 201, or ESRM/ECON/ENVIR 235",
    grcEquivalents: ["ECON& 202", "ECON& 201"],
  },
  {
    uwRequirement: "Basic Science Elective",
    grcEquivalents: ["NATRS 210", "GEOL& 101"],
  },
  {
    uwRequirement: "Statistics: IND E 315, QSCI 381, STAT 290, or STAT 390",
    grcEquivalents: [],
    hiddenUnmappedReason:
      "No source-backed Green River equivalent is currently mapped for the UW Civil Engineering statistics requirement.",
  },
];

export function auditUwCivilEngineeringLowerDivisionRequirements(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
}) {
  if (input.plan?.id !== UW_SEATTLE_CIVIL_ENGINEERING_PLAN_ID) {
    return [] as UwCivilEngineeringLowerDivisionRequirementAuditEntry[];
  }

  const plannedOrCompletedCourseCodes = new Set(
    [
      ...input.suggestedPlan.flatMap((quarter) =>
        quarter.courses.flatMap((course) => extractCourseCodes(course.label))
      ),
      ...(input.completedCourses ?? []).map((course) => course.code),
    ]
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );

  return UW_CIVIL_ENGINEERING_LOWER_DIVISION_REQUIREMENT_AUDIT_ROWS.map((row) => {
    const grcEquivalents = row.grcEquivalents.map((courseCode) =>
      normalizeCourseCode(courseCode)
    );
    const visibleCourseCodes = grcEquivalents.filter((courseCode) =>
      plannedOrCompletedCourseCodes.has(courseCode)
    );
    const hasKnownGrcEquivalent = grcEquivalents.length > 0;
    const visibleInQuarterPlan = visibleCourseCodes.length > 0;

    return {
      uwRequirement: row.uwRequirement,
      grcEquivalents,
      visibleInQuarterPlan,
      visibleCourseCodes,
      hiddenUnmappedReason: visibleInQuarterPlan
        ? null
        : row.hiddenUnmappedReason ??
          (hasKnownGrcEquivalent
            ? "Known Green River equivalent is missing from the visible transfer-only plan."
            : "No source-backed Green River equivalent is currently mapped."),
      } satisfies UwCivilEngineeringLowerDivisionRequirementAuditEntry;
  });
}

export type SourceBackedRequirementAuditEntry = {
  uwRequirement: string;
  grcEquivalents: string[];
  visibleInQuarterPlan: boolean;
  visibleCourseCodes: string[];
  hiddenReason: string | null;
  copyOnlyDebugText: string;
};

const UW_SEATTLE_BIOENGINEERING_PLAN_ID = "uw-seattle-bioengineering";
const UW_BIOENGINEERING_SOURCE_BACKED_REQUIREMENT_AUDIT_ROWS: {
  uwRequirement: string;
  grcEquivalents: string[];
  hiddenReason?: string;
}[] = [
  { uwRequirement: "English Composition", grcEquivalents: ["ENGL& 101"] },
  { uwRequirement: "MATH 124", grcEquivalents: ["MATH& 151"] },
  { uwRequirement: "MATH 125", grcEquivalents: ["MATH& 152"] },
  { uwRequirement: "MATH 126", grcEquivalents: ["MATH& 163"] },
  { uwRequirement: "MATH 207 or AMATH 351", grcEquivalents: ["MATH 238"] },
  { uwRequirement: "MATH 208 or AMATH 352", grcEquivalents: ["MATH 240"] },
  {
    uwRequirement: "STAT 311, STAT 390, IND E 315, or Q SCI 381",
    grcEquivalents: [],
    hiddenReason:
      "No source-backed Green River equivalent is currently mapped for the UW Bioengineering statistics requirement.",
  },
  { uwRequirement: "CHEM 142", grcEquivalents: ["CHEM& 161"] },
  { uwRequirement: "CHEM 152", grcEquivalents: ["CHEM& 162"] },
  { uwRequirement: "CHEM 162", grcEquivalents: ["CHEM& 163"] },
  { uwRequirement: "CHEM 223 or CHEM 237", grcEquivalents: ["CHEM& 261"] },
  { uwRequirement: "PHYS 121", grcEquivalents: ["PHYS& 221"] },
  { uwRequirement: "PHYS 122", grcEquivalents: ["PHYS& 222"] },
  { uwRequirement: "BIOL 180", grcEquivalents: ["BIOL& 211"] },
  { uwRequirement: "BIOL 200", grcEquivalents: ["BIOL& 212"] },
  { uwRequirement: "BIOL 220", grcEquivalents: ["BIOL& 213"] },
  { uwRequirement: "AMATH 301", grcEquivalents: ["ENGR 250"] },
];

export function auditUwBioengineeringSourceBackedRequirements(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
}) {
  if (input.plan?.id !== UW_SEATTLE_BIOENGINEERING_PLAN_ID) {
    return [] as SourceBackedRequirementAuditEntry[];
  }

  const plannedOrCompletedCourseCodes = new Set(
    [
      ...input.suggestedPlan.flatMap((quarter) =>
        quarter.courses.flatMap((course) => extractCourseCodes(course.label))
      ),
      ...(input.completedCourses ?? []).map((course) => course.code),
    ]
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );

  return UW_BIOENGINEERING_SOURCE_BACKED_REQUIREMENT_AUDIT_ROWS.map((row) => {
    const grcEquivalents = row.grcEquivalents.map((courseCode) =>
      normalizeCourseCode(courseCode)
    );
    const visibleCourseCodes = grcEquivalents.filter((courseCode) =>
      plannedOrCompletedCourseCodes.has(courseCode)
    );
    const visibleInQuarterPlan = visibleCourseCodes.length > 0;
    const hasKnownGrcEquivalent = grcEquivalents.length > 0;
    const hiddenReason = visibleInQuarterPlan
      ? null
      : row.hiddenReason ??
        (hasKnownGrcEquivalent
          ? "Known Green River equivalent is missing from the visible transfer-only plan."
          : "No source-backed Green River equivalent is currently mapped.");

    return {
      uwRequirement: row.uwRequirement,
      grcEquivalents,
      visibleInQuarterPlan,
      visibleCourseCodes,
      hiddenReason,
      copyOnlyDebugText: [
        "[copy-only source-backed requirement audit]",
        `UW requirement: ${row.uwRequirement}`,
        `GRC equivalent: ${grcEquivalents.length ? grcEquivalents.join(", ") : "none"}`,
        `Visible in plan: ${visibleInQuarterPlan ? "yes" : "no"}`,
        `Hidden reason: ${hiddenReason ?? "none"}`,
      ].join(" "),
    } satisfies SourceBackedRequirementAuditEntry;
  });
}
