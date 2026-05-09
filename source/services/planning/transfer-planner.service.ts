import {
  extractTransferPlannerCourseCodes,
  getTransferPlannerCanonicalCourse,
  getTransferPlannerAllEquivalencyRules,
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
import {
  COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_LABEL,
  COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_PARAM,
  COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_SOURCE_URL,
  COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_UW_COURSE_CODES,
  COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_PETITION_ONLY_NOTES,
  isComputerEngineeringApprovedNaturalScienceCategory,
  isComputerEngineeringApprovedNaturalScienceUwCourseCode,
} from "@/constants/transfer-planner-source/computer-engineering-natural-science";
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
  /\b(approved list|following list|not required for transferring|electives?|general electives?|free electives?|replacement|course list|course lists|course evaluation|course evaluations|recommended|suggested|consider|first year students|suggested general education|suggested course pathways?|choose\s+(?:one|[0-9]+)|one\s+of|one\s+course\s+(?:from|of|in)|select(?:ed|ing)?|\d+\s+credits?\s+from|minimum\s+\d+\s+credits?[^.]{0,80}\bfrom)\b/i;
const SOURCE_BACKED_REQUIRED_COURSE_POSITIVE_REQUIREMENT_CUE_PATTERN =
  /\b(?:admission|before enrolling|complete(?:d)?|completion|must|required|requirement|prereq(?:uisite)?|minimum grade|minimum\s+\d+\s+courses?)\b/i;
const SOURCE_BACKED_CONTEXTLESS_DISTRIBUTION_LIST_PATTERN =
  /^\s*(?:\[page\s+\d+\]\s*)?\(\d+(?:\.\d+)?\s*cr,\s*(?:A&H|SSc|NSc|DIV)\),\s*[A-Z]/i;
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
  optionKind?: "course" | "category-option";
  label: string;
  selectedLabel: string;
  courseLabels: string[];
  courseCodes: string[];
  categoryOption?: {
    category: string;
    sourceCategoryCode: string;
    title: string;
    credits: number;
    creditMin?: number | null;
    creditMax?: number | null;
    sourceText: string;
  } | null;
  creditAmount?: number | null;
  creditMin?: number | null;
  creditMax?: number | null;
  guidanceSummary?: string | null;
};

export type SuggestedQuarterOptionSatisfactionSource =
  | "user-selected"
  | "transcript-completed"
  | "planner-defaulted"
  | "scheduled-and-counted";

export type SuggestedQuarterCourseOptionGroup = {
  id: string;
  title: string;
  promptLabel: string;
  selectionCount: number;
  requiredCredits?: number | null;
  maxRequiredCredits?: number | null;
  requirementType?: TransferPlannerRequirementType | null;
  satisfactionMode?: "selection-count" | "credit-based";
  selectedOptionIds: string[];
  candidateSatisfiedOptionIds?: string[];
  resolvedSatisfiedOptionIds?: string[];
  resolvedSatisfiedOptionIdsBeforeCap?: string[];
  droppedSatisfiedOptionIds?: string[];
  completedSatisfyingCourseCodes?: string[];
  completedSatisfyingCourseCodesByOptionId?: Record<string, string[]>;
  scheduledSatisfyingCourseCodes?: string[];
  countedSatisfyingCourseCodes?: string[];
  resolvedSatisfyingCreditMin?: number | null;
  resolvedSatisfyingCreditMax?: number | null;
  displayedCreditProgress?: string | null;
  fullySatisfied?: boolean | null;
  candidateOptionSatisfactionSourcesById?: Record<string, SuggestedQuarterOptionSatisfactionSource[]>;
  optionSatisfactionSourcesById?: Record<string, SuggestedQuarterOptionSatisfactionSource[]>;
  selectionSource?: "student" | "default" | null;
  allowExtraResolvedSelections?: boolean;
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
  sourceRequirementGroupId?: string | null;
  visibilityScope?: SuggestedQuarterCourseVisibilityScope;
  isVisibleInGrcQuarterPlan?: boolean;
  isUwOnlyRequirement?: boolean;
  courseRole?:
    | "optional_stem_prep"
    | "local_grc_prerequisite"
    | "unresolved-credit-bucket-remainder"
    | null;
  canTestOut?: boolean | null;
  transfersOrSatisfiesUw?: boolean | null;
  satisfiesSourceBackedUwRequirement?: boolean | null;
};

export type UnselectedOptionPrerequisiteAuditEntry = {
  groupId: string;
  optionId: string;
  optionSelected: boolean;
  prerequisiteCourseCode: string;
  prerequisiteScheduled: boolean;
  shouldSchedule: boolean;
  reason: string;
  copyOnlyDebugText: string;
};

export type OptionGroupSatisfactionAuditEntry = {
  groupId: string;
  requirement: string;
  requiredCount: number;
  satisfactionMode: "selection-count" | "credit-based";
  requiredCredits?: number | null;
  acceptedUwOptions: string[];
  acceptedOptions?: string[];
  mappedGrcOptions?: string[];
  categoryOptions?: string[];
  selectedOptionIds: string[];
  selectedCategoryOptions?: string[];
  completedGrcCourses: string[];
  completedSatisfyingCourses: string[];
  scheduledSatisfyingCourses: string[];
  countedSatisfyingCourses: string[];
  chosenTranscriptCategorySatisfier?: string | null;
  genericPlannedCategoryCredits?: number;
  resolvedSatisfiedCount: number;
  resolvedSatisfyingCredits?: string | null;
  fullySatisfied?: boolean | null;
  displayedProgress: string;
  satisfiedBy: string[];
  scheduledExtraCourses: string[];
  shouldScheduleExtra: boolean;
  independentSchedulingReason: string;
  issue: string | null;
  copyOnlyLegacyDebugText?: string;
  copyOnlyDebugText: string;
};

export type CategoryOptionDetectionAuditEntry = {
  major: string;
  requirement: string;
  detectedCategoryOption: boolean;
  category: string;
  credits: number | null;
  sourceText: string;
  visibleOption: boolean;
  selected: boolean;
  satisfiedByTranscriptCourse: string | null;
  issue:
    | "missing-category-option"
    | "unsupported-category"
    | "selected-category-hidden"
    | "selected-category-unsatisfied"
    | null;
  copyOnlyDebugText: string;
};

export type ComputerEngineeringCreditBucketAuditEntry = {
  major: string;
  requirement: string;
  creditsRequired: string;
  requiredCredits: string;
  satisfactionMode: "selection-count" | "credit-based";
  filterSource: string | null;
  mappedConcreteOptions: string[];
  excludedGenericCategoryCourses: string[];
  selectedConcreteOptions: string[];
  selectedPlaceholder: boolean;
  categoryListPlaceholderVisible: boolean;
  completedSatisfyingCourses: string[];
  scheduledSatisfyingCourses: string[];
  satisfiedByTranscriptCourses: string[];
  totalSatisfyingCredits: string;
  displayedCreditProgress: string;
  fullySatisfied: boolean;
  remainingUnresolvedCredits: string;
  remainingPlaceholderScheduled: boolean;
  plannedUnresolvedCredits: string;
  issue:
    | "missing-credit-bucket"
    | "insufficient-credit-selection"
    | "selection-count-used-for-credit-bucket"
    | null;
  copyOnlyDebugText: string;
};

export type ComputerEngineeringApprovedNaturalScienceTransferEntry = {
  id: string;
  sourceCourseLabel: string;
  sourceCourseTitle: string | null;
  sourceCourseCodes: string[];
  targetOutcome: string;
  uwEquivalentCourseCodes: string[];
  inclusionReason: "approved-uw-equivalent" | "compound-path";
  sourceRuleId: string;
};

export type ComputerEngineeringApprovedNaturalScienceAuditEntry = {
  major: string;
  officialSource: string;
  uwApprovedCourse: string;
  grcEquivalentPath: string[];
  includedInFilter: boolean;
  reason:
    | "approved-uw-equivalent"
    | "compound-path"
    | "generic-category-only"
    | "no-grc-equivalent"
    | "petition-only";
  copyOnlyDebugText: string;
};

export type TransferCategoryFilterAuditEntry = {
  filter: string;
  course: string;
  uwEquivalent: string;
  included: boolean;
  reason:
    | "approved-uw-equivalent"
    | "compound-path"
    | "generic-category-only"
    | "petition-only";
  copyOnlyDebugText: string;
};

export type CategoryTranscriptSatisfactionAuditEntry = {
  major: string;
  groupId: string;
  categoryOption: string;
  selected: boolean;
  category: string;
  creditsRequired: number | null;
  completedCandidateCourses: string[];
  rejectedCandidateCourses: string[];
  chosenTranscriptSatisfier: string | null;
  chosenSatisfierAlreadyUsedByRequiredRow: boolean;
  genericCategoryRowScheduled: boolean;
  visibleOptionStatusText: string;
  issue:
    | "duplicate-category-placeholder"
    | "no-unused-category-satisfier"
    | "selected-category-status-missing-satisfier"
    | null;
  copyOnlyDebugText: string;
};

export type OptionAllocationAuditEntry = {
  groupId: string;
  groupTitle: string;
  requiredCount: number;
  candidateSatisfyingOptionIds: string[];
  candidateSources: string[];
  overlappingGroups: string[];
  resolvedDisplayedOptionIdsBeforeCap: string[];
  resolvedDisplayedOptionIdsAfterCap: string[];
  droppedExtraOptionIds: string[];
  reason: string;
  issue: "over-satisfied-before-cap" | "unresolved-required-option" | null;
  copyOnlyDebugText: string;
};

export type OptionTitleFallbackAuditEntry = {
  originalTitle: string;
  displayedTitle: string;
  reason: "bad-generic-title" | "preserved-real-title" | "forced-numbered-option-title";
  visibleOptionIndex: number;
  groupId: string;
  copyOnlyDebugText: string;
};

export type SourceScopeAuditEntry = {
  major: string;
  uwCourse: string;
  sourceSection: string;
  detectedRole:
    | "required"
    | "option"
    | "option-list"
    | "elective-list"
    | "matched-track"
    | "other-major"
    | "hidden";
  promotedToRequired: boolean;
  allowedToSchedule: boolean;
  reason: string;
  issue: "false-required-promotion" | null;
  copyOnlyDebugText: string;
};

export type SourceRowBoundaryAuditEntry = {
  major: string;
  sourceUrl: string;
  rawRowText: string;
  parsedRequirementTitle: string;
  parsedUwCourses: string[];
  expectedRowSplit: boolean;
  issue: "merged-adjacent-rows" | "missing-required-row" | null;
  copyOnlyDebugText: string;
};

export type RequiredMappedCourseCoverageAuditEntry = {
  major: string;
  uwRequirement: string;
  uwCourse: string;
  mappedGrcEquivalentPath: string[];
  requirementType: string | null;
  visibleInPlan: boolean;
  alreadyCompleted: boolean;
  hiddenReason: string | null;
  issue: string | null;
  copyOnlyDebugText: string;
};

export type CompoundEquivalencyPathAuditEntry = {
  major: string;
  uwRequirement: string;
  uwCourse: string;
  grcCompoundPath: string[];
  completedComponents: string[];
  scheduledComponents: string[];
  missingComponents: string[];
  satisfied: boolean;
  issue: "partial-compound-path" | "missing-compound-path" | null;
  copyOnlyDebugText: string;
};

export type TrueOptionDetectionAuditEntry = {
  major: string;
  requirement: string;
  acceptedUwOptions: string[];
  mappedGrcOptions: string[];
  requiredCount: number;
  detectedAsTrueOption: boolean;
  visibleOptionGroup: boolean;
  satisfiedBy:
    | "user-selected"
    | "transcript-completed"
    | "planner-defaulted"
    | "scheduled-counted"
    | "none";
  issue: "missing-option-group" | "false-required-row" | null;
  copyOnlyDebugText: string;
};

export type RequirementRolePrecedenceAuditEntry = {
  uwCourse: string;
  appearsInRequiredGroup: boolean;
  appearsInOptionGroup: boolean;
  winningRole:
    | "required"
    | "prerequisite"
    | "selected_option"
    | "unselected_option"
    | "matched_track_only"
    | "hidden";
  scheduledAs: string;
  reason: string;
  copyOnlyDebugText: string;
};

export type CountedCourseAuditEntry = {
  course: string;
  credits: number;
  requirementRoles: string[];
  countedOnce: boolean;
  duplicateCountReason: string | null;
  copyOnlyDebugText: string;
};

export type OptionCreditAuditEntry = {
  option: string;
  displayedCredits: string;
  countedGrcCredits: string;
  componentCourses: string[];
  issue: "credit-display-mismatch" | null;
  copyOnlyDebugText: string;
};

export type OptionSelectionSourceAuditEntry = {
  groupId: string;
  optionId: string;
  satisfiedBy:
    | "user-selected"
    | "transcript"
    | "default"
    | "scheduled-counted"
    | "none";
  displayedAsSelected: boolean;
  issue: "source-mismatch" | null;
  copyOnlyDebugText: string;
};

export type RequirementClassificationAuditEntry = {
  requirement: string;
  classification:
    | "required-sequence"
    | "true-option"
    | "prerequisite-alternative"
    | "overlap"
    | "hidden-unmapped";
  scheduledCourses: string[];
  countedCredits: number;
  reason: string;
  copyOnlyDebugText: string;
};

export type InvalidScheduledOptionAuditEntry = {
  requirement: string;
  scheduledCourse: string;
  uwEquivalent: string;
  isAcceptedByCurrentSource: boolean;
  reason: string;
  copyOnlyDebugText: string;
};

export type SbseCurrentVsOldSourceAuditEntry = {
  course: string;
  uwEquivalent: string;
  currentSbseSourceBacked: boolean;
  oldBseOnly: boolean;
  matchedTrackOnly: boolean;
  prerequisiteForCurrentSource: boolean;
  transferOnlyShouldShow: boolean;
  reason: string;
  copyOnlyDebugText: string;
};

export type SbseCreditAuditEntry = {
  currentSbseSourceBackedCredits: number;
  selectedOptionCredits: number;
  prepCredits: number;
  prerequisiteCredits: number;
  filteredStaleMatchedTrackCredits: number;
  trueOptionSelectedCredits: number;
  localPrerequisiteCredits: number;
  oldBseMatchedTrackFilteredCredits: number;
  displayedRemainingCredits: string;
  copyOnlyDebugText: string;
};

export type SbseScheduledRowSourceAuditEntry = {
  course: string;
  uwEquivalent: string;
  source:
    | "current-sbse"
    | "old-bse"
    | "matched-track"
    | "prerequisite"
    | "stale-supplemental"
    | "transcript";
  reason: string;
  shouldSchedule: boolean;
  copyOnlyDebugText: string;
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

function getBestGrcEquivalentPathCourseCodesForUwCourse(
  plan: TransferPlannerMajorPlan | null | undefined,
  uwCourseCode: string
) {
  if (!plan) {
    return [] as string[];
  }

  const normalizedUwCourseCode = normalizeCourseCode(uwCourseCode);
  if (!normalizedUwCourseCode) {
    return [] as string[];
  }

  const planGrcCourseCodes = new Set(getPlanGrcCourseCodes(plan));
  const candidatePathsByKey = new Map<string, string[]>();
  for (const sourceCourseCode of planGrcCourseCodes) {
    for (const rule of getTransferGuidanceCandidateRulesForSourceCourse(sourceCourseCode, plan.campusId)) {
      const targetCourseCodes = (rule.targetCourseCodes ?? [])
        .map((targetCourseCode) => normalizeCourseCode(targetCourseCode))
        .filter(Boolean);
      if (!targetCourseCodes.includes(normalizedUwCourseCode)) {
        continue;
      }

      for (const sourceCourseSet of rule.sourceCourseSets ?? []) {
        const pathCourseCodes = unique(
          sourceCourseSet
            .map((courseCode) => normalizeCourseCode(courseCode))
            .filter((courseCode) => Boolean(courseCode))
        );
        if (
          !pathCourseCodes.length ||
          pathCourseCodes.length !== sourceCourseSet.length ||
          !pathCourseCodes.includes(sourceCourseCode)
        ) {
          continue;
        }

        if (
          !pathCourseCodes.every((courseCode) =>
            Boolean(getTransferPlannerCanonicalCourse("grc", courseCode))
          )
        ) {
          continue;
        }

        candidatePathsByKey.set(pathCourseCodes.join("|"), pathCourseCodes);
      }
    }
  }

  const candidatePaths = [...candidatePathsByKey.values()].sort((left, right) => {
    const lengthDelta = left.length - right.length;
    if (lengthDelta !== 0) return lengthDelta;

    return left.join("|").localeCompare(right.join("|"));
  });

  return candidatePaths[0] ?? [];
}

function buildBestRequiredUwEquivalentCourseCodes(
  sourceCourseCode: string,
  plan: TransferPlannerMajorPlan | null | undefined,
  requiredUwCourseCodes: Set<string>
) {
  const singleCourseTargets = buildBestSingleCourseUwEquivalentCourseCodes(
    sourceCourseCode,
    plan?.campusId
  );
  if (!plan || !requiredUwCourseCodes.size) {
    return singleCourseTargets;
  }

  const normalizedSourceCourseCode = normalizeCourseCode(sourceCourseCode);
  const pathTargets = [...requiredUwCourseCodes].filter((uwCourseCode) =>
    getBestGrcEquivalentPathCourseCodesForUwCourse(plan, uwCourseCode).includes(
      normalizedSourceCourseCode
    )
  );

  return unique([...singleCourseTargets, ...pathTargets]);
}

function buildRequiredUwCourseCodesCompletedBySourceCourse(
  sourceCourseCode: string,
  plan: TransferPlannerMajorPlan | null | undefined,
  requiredUwCourseCodes: Set<string>
) {
  if (!plan) {
    return buildBestSingleCourseUwEquivalentCourseCodes(sourceCourseCode, undefined);
  }

  const normalizedSourceCourseCode = normalizeCourseCode(sourceCourseCode);
  return buildBestRequiredUwEquivalentCourseCodes(sourceCourseCode, plan, requiredUwCourseCodes)
    .filter((uwCourseCode) => {
      const pathCourseCodes = getBestGrcEquivalentPathCourseCodesForUwCourse(plan, uwCourseCode);
      return (
        pathCourseCodes.length <= 1 ||
        pathCourseCodes[pathCourseCodes.length - 1] === normalizedSourceCourseCode
      );
    });
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

  const nonRequirementCueLines = sourceLineHints.filter((line) =>
    SOURCE_BACKED_REQUIRED_COURSE_NON_REQUIREMENT_CUE_PATTERN.test(line)
  );
  const positiveRequirementCueLines = sourceLineHints.filter(
    (line) =>
      SOURCE_BACKED_REQUIRED_COURSE_POSITIVE_REQUIREMENT_CUE_PATTERN.test(line) &&
      !SOURCE_BACKED_REQUIRED_COURSE_NON_REQUIREMENT_CUE_PATTERN.test(line)
  );
  if (nonRequirementCueLines.length && !positiveRequirementCueLines.length) {
    return false;
  }

  return sourceLineHints.some(
    (line) =>
      !SOURCE_BACKED_REQUIRED_COURSE_NON_REQUIREMENT_CUE_PATTERN.test(line) &&
      !SOURCE_BACKED_CONTEXTLESS_DISTRIBUTION_LIST_PATTERN.test(line)
  );
}

function stripSourcePagePrefix(value: string | null | undefined) {
  return String(value ?? "").replace(/^\s*\[Page\s+\d+\]\s*/i, "").replace(/\s+/g, " ").trim();
}

function getBestParsedRequirementCandidateLabel(candidate: {
  uwCourseCode?: string | null;
  title?: string | null;
  sourceLineHints?: string[] | null;
}) {
  const courseCode = normalizeCourseCode(candidate.uwCourseCode ?? "");
  const sourceLabel = (candidate.sourceLineHints ?? [])
    .map((line) => stripSourcePagePrefix(line))
    .find((line) => line && (!courseCode || line.includes(courseCode)));
  return sourceLabel || String(candidate.title ?? candidate.uwCourseCode ?? courseCode).trim() || courseCode;
}

function sourceHintLooksLikeHiddenUnmappedRequiredCoreRow(input: {
  hint: string;
  uwCourseCode: string;
}) {
  const hint = stripSourcePagePrefix(input.hint);
  if (!hint || SOURCE_BACKED_REQUIRED_COURSE_NON_REQUIREMENT_CUE_PATTERN.test(hint)) {
    return false;
  }
  if (/\b(?:choose|select|electives?|course list|technical elective|recommended|suggested|may count|study abroad|taken\s+[A-Z]{3})\b/i.test(hint)) {
    return false;
  }
  if (/\bor\b/i.test(hint)) {
    return false;
  }
  if (
    !/\b(?:intro(?:duction)?|principles|mechanics|systems?|case studies|balances|chemistry|physics|biology|calculus|linear algebra|differential equations|statistics|thermodynamics|programming|communication|composition|concept|tools|sustainability)\b/i.test(
      hint
    )
  ) {
    return false;
  }
  return (
    hint.toUpperCase().includes(`(${input.uwCourseCode})`) ||
    hint.toUpperCase().includes(input.uwCourseCode)
  );
}

function getAuditOnlyHiddenUnmappedRequiredUwRequirementLabels(
  plan: TransferPlannerMajorPlan | null | undefined,
  requiredUwCourseCodes: Set<string>
) {
  const labelsByCourseCode = new Map<string, string>();
  if (!plan) {
    return labelsByCourseCode;
  }

  const trueOptionUwCourseCodes = getTrueOptionUwCourseCodeSet(plan);
  for (const block of getSourceBackedRequirementSourceBlocksForPlan(plan)) {
    for (const candidate of block.parsedRequirementAtomCandidates ?? []) {
      const normalizedCourseCode = normalizeCourseCode(candidate.uwCourseCode ?? "");
      if (
        !normalizedCourseCode ||
        labelsByCourseCode.has(normalizedCourseCode) ||
        requiredUwCourseCodes.has(normalizedCourseCode) ||
        trueOptionUwCourseCodes.has(normalizedCourseCode)
      ) {
        continue;
      }
      if (!shouldAllowSourceScopedRequiredUwCourse(plan, normalizedCourseCode)) {
        continue;
      }
      if (getMappedGrcCourseCodesForRequiredUwCourse(plan, normalizedCourseCode).length) {
        continue;
      }
      if (
        !(candidate.sourceLineHints ?? []).some((hint) =>
          sourceHintLooksLikeHiddenUnmappedRequiredCoreRow({
            hint,
            uwCourseCode: normalizedCourseCode,
          })
        )
      ) {
        continue;
      }

      labelsByCourseCode.set(
        normalizedCourseCode,
        getBestParsedRequirementCandidateLabel(candidate)
      );
    }
  }

  return labelsByCourseCode;
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
  const scopedRequiredUwCourseCodes =
    getChemicalEngineeringSourceBackedRequiredUwCourseCodeSet(plan);
  if (scopedRequiredUwCourseCodes) {
    return scopedRequiredUwCourseCodes;
  }

  const requiredUwCourseCodes = new Set<string>();
  if (!plan) {
    return requiredUwCourseCodes;
  }

  const trueOptionUwCourseCodes = getTrueOptionUwCourseCodeSet(plan);
  let sawStructuredRequirementCourses = false;
  for (const block of getSourceBackedRequirementSourceBlocksForPlan(plan)) {
    const structuredRequirementCourses = block.parsedRequirementCourses ?? [];
    if (structuredRequirementCourses.length) {
      sawStructuredRequirementCourses = true;
      for (const course of structuredRequirementCourses) {
        if (course.optionRole !== "required") {
          continue;
        }

        const normalizedCourseCode = normalizeCourseCode(
          course.normalizedCourseCode || course.courseCode
        );
        if (!shouldAllowSourceScopedRequiredUwCourse(plan, normalizedCourseCode)) {
          continue;
        }
        if (trueOptionUwCourseCodes.has(normalizedCourseCode)) {
          continue;
        }
        if (!shouldIncludeSourceBackedParsedRequiredCourseCandidate({
          uwCourseCode: normalizedCourseCode,
          sourceLineHints: [course.sourceHeading, course.sourceCategory],
        })) {
          continue;
        }

        requiredUwCourseCodes.add(normalizedCourseCode);
      }
    }
  }
  addChecklistBackedRequiredUwCourses(plan, requiredUwCourseCodes);

  if (sawStructuredRequirementCourses) {
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
      if (!shouldAllowSourceScopedRequiredUwCourse(plan, normalizedCourseCode)) {
        continue;
      }
      if (trueOptionUwCourseCodes.has(normalizedCourseCode)) {
        continue;
      }

      requiredUwCourseCodes.add(normalizedCourseCode);
    }
  }
  addChecklistBackedRequiredUwCourses(plan, requiredUwCourseCodes);

  return requiredUwCourseCodes;
}

function addChecklistBackedRequiredUwCourses(
  plan: TransferPlannerMajorPlan | null | undefined,
  requiredUwCourseCodes: Set<string>
) {
  if (!plan) {
    return;
  }

  for (const item of [
    ...(plan.applicationChecklist ?? []),
    ...(plan.beforeEnrollmentChecklist ?? []),
    ...(plan.stayAtGrcChecklist ?? []),
  ]) {
    if (!shouldAllowSourceScopedRequiredChecklistItem(plan, item)) {
      continue;
    }

    if (!shouldTreatChecklistItemPrimaryCoursesAsRequired(item)) {
      continue;
    }

    for (const courseCode of extractCourseCodes(item.title ?? "")) {
      const normalizedCourseCode = normalizeCourseCode(courseCode);
      if (normalizedCourseCode) {
        requiredUwCourseCodes.add(normalizedCourseCode);
      }
    }

    for (const grcCourseCode of getRequiredChecklistCourseLabels(item).flatMap((label) =>
      extractCourseCodes(label)
    )) {
      for (const uwCourseCode of buildBestSingleCourseUwEquivalentCourseCodes(
        grcCourseCode,
        plan.campusId
      )) {
        const normalizedUwCourseCode = normalizeCourseCode(uwCourseCode);
        if (normalizedUwCourseCode) {
          requiredUwCourseCodes.add(normalizedUwCourseCode);
        }
      }
    }
  }
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
  void plan;
  return [] as string[];
}

function requirementGroupLooksLikeTrueOption(
  group: TransferPlannerChecklistItem["requirementGroup"] | null | undefined
) {
  if (!group) {
    return false;
  }

  if (group.requirementType === "choose_credits" || group.requirementType === "choose_n") {
    return true;
  }

  if (group.requirementType === "choose_one") {
    if (isElectiveRequirementGroup({ id: "", title: "", grcCourses: [], requirementGroup: group })) {
      return true;
    }

    const choiceCueText = [
      group.category,
      group.label,
      group.sourceHeading,
      ...(group.notes ?? []),
    ].join(" ");
    const hasChoiceCue =
      /\b(?:choose|select|one of|option|elective|from|programming|computing)\b/i.test(
        choiceCueText
      );
    const distinctAcceptedOptions = new Set(
      (group.options ?? [])
        .flatMap((option) => [
          ...(option.uwCourses ?? []),
          ...(option.equivalentUwCourseCodes ?? []),
          option.label,
        ])
        .map((courseCode) => normalizeCourseCode(courseCode ?? ""))
        .filter(Boolean)
    );
    const mappedOptionCount = (group.options ?? []).filter((option) =>
      (option.grcMatches ?? []).some((label) => extractCourseCodes(label).length > 0)
    ).length;

    return (
      distinctAcceptedOptions.size > 1 &&
      mappedOptionCount > 0 &&
      (group.category === "source-choice" || hasChoiceCue)
    );
  }

  return false;
}

function checklistItemLooksLikeTrueOption(item: TransferPlannerChecklistItem) {
  const group = item.requirementGroup;
  if (!group) {
    return false;
  }

  if (requirementGroupLooksLikeTrueOption(group)) {
    return true;
  }

  const unselectedOptionIds = normalizeSelectedRequirementOptionIds(
    (item as { unselectedRequirementOptionIds?: unknown }).unselectedRequirementOptionIds
  );
  return group.requirementType === "choose_one" && unselectedOptionIds.length > 0;
}

function getTrueOptionUwCourseCodeSet(plan: TransferPlannerMajorPlan | null | undefined) {
  const courseCodes = new Set<string>();
  if (!plan) {
    return courseCodes;
  }

  const registerGroupOptionCourses = (
    group: TransferPlannerChecklistItem["requirementGroup"] | null | undefined
  ) => {
    for (const option of group?.options ?? []) {
      for (const courseCode of [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
      ]) {
        const normalizedCourseCode = normalizeCourseCode(courseCode);
        if (normalizedCourseCode) {
          courseCodes.add(normalizedCourseCode);
        }
      }
    }
  };

  for (const item of [
    ...(plan.applicationChecklist ?? []),
    ...(plan.beforeEnrollmentChecklist ?? []),
    ...(plan.stayAtGrcChecklist ?? []),
  ]) {
    if (checklistItemLooksLikeTrueOption(item)) {
      registerGroupOptionCourses(item.requirementGroup);
    }
  }

  for (const group of plan.requirementGroups ?? []) {
    if (requirementGroupLooksLikeTrueOption(group)) {
      registerGroupOptionCourses(group);
    }
  }

  return courseCodes;
}

function sourceBackedDescriptorLooksLikeTrueOption(
  descriptor: SourceBackedRequiredCourseDescriptor
) {
  if (
    descriptor.requirementType === "choose_credits" ||
    descriptor.requirementType === "choose_n"
  ) {
    return true;
  }

  if (descriptor.requirementType !== "choose_one") {
    return false;
  }

  const descriptorText = [
    descriptor.requirementGroupLabel,
    descriptor.title,
    descriptor.selectedOptionLabels.join(" "),
    descriptor.otherOptionLabels.join(" "),
  ].join(" ");
  return (
    /\belective\b/i.test(descriptorText) ||
    (
      /\b(?:choose|select|one of|option|or|programming|computing)\b/i.test(descriptorText) &&
      descriptor.otherOptionLabels.length > 0
    )
  );
}

function courseMapsToSourceBackedRequiredUwCourse(input: {
  courseCode: string;
  plan?: TransferPlannerMajorPlan | null;
  campusId: TransferPlannerMajorPlan["campusId"] | null | undefined;
  requiredUwCourseCodes: Set<string>;
}) {
  if (!input.requiredUwCourseCodes.size) {
    return false;
  }

  const equivalentUwCourseCodes = input.plan
    ? buildBestRequiredUwEquivalentCourseCodes(
        input.courseCode,
        input.plan,
        input.requiredUwCourseCodes
      )
    : buildBestSingleCourseUwEquivalentCourseCodes(input.courseCode, input.campusId);

  return equivalentUwCourseCodes.some(
    (targetCourseCode) => input.requiredUwCourseCodes.has(targetCourseCode)
  );
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
  if (checklistItemLooksLikeTrueOption(item)) {
    return false;
  }

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
    if (!shouldAllowSourceScopedRequiredChecklistItem(plan, item)) {
      continue;
    }

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
      if (!normalizedCourseCode || seenCourseCodes.has(normalizedCourseCode)) {
        continue;
      }

      const requiredEquivalentUwCourseCodes = buildBestRequiredUwEquivalentCourseCodes(
        normalizedCourseCode,
        plan,
        requiredUwCourseCodes
      );
      const mapsToSourceBackedRequiredUwCourse = requiredEquivalentUwCourseCodes.some((targetCourseCode) =>
        requiredUwCourseCodes.has(targetCourseCode)
      );
      if (
        choiceOnlyCourseCodes.has(normalizedCourseCode) &&
        !mapsToSourceBackedRequiredUwCourse
      ) {
        continue;
      }
      if (
        hasCurrentComputingPrepSequence(seenCourseCodes) &&
        isLegacyComputingPrepFallback(normalizedCourseCode)
      ) {
        continue;
      }
      if (!requiredEquivalentUwCourseCodes.some((targetCourseCode) => requiredUwCourseCodes.has(targetCourseCode))) {
        continue;
      }
      if (
        requiredEquivalentUwCourseCodes.length &&
        requiredEquivalentUwCourseCodes.every((targetCourseCode) => isCoveredRequiredUwCourseCode(targetCourseCode))
      ) {
        continue;
      }

      seenCourseCodes.add(normalizedCourseCode);
      orderedCourseCodes.push(normalizedCourseCode);
      markCoveredRequiredUwCourseCodes(
        buildRequiredUwCourseCodesCompletedBySourceCourse(
          normalizedCourseCode,
          plan,
          requiredUwCourseCodes
        )
      );
    }
  }

  for (const uwCourseCode of requiredUwCourseCodes) {
    if (isCoveredRequiredUwCourseCode(uwCourseCode)) {
      continue;
    }

    const pathCourseCodes = getBestGrcEquivalentPathCourseCodesForUwCourse(plan, uwCourseCode);
    if (!pathCourseCodes.length) {
      continue;
    }

    for (const pathCourseCode of pathCourseCodes) {
      if (seenCourseCodes.has(pathCourseCode)) {
        continue;
      }

      seenCourseCodes.add(pathCourseCode);
      orderedCourseCodes.push(pathCourseCode);
    }

    markCoveredRequiredUwCourseCodes([uwCourseCode]);
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
  const requiredUwCourseCodes = getSourceBackedRequiredUwCourseCodeSet(scope.plan);
  const existingCourseCodes = new Set(
    scope.existingStatuses
      .flatMap((status) => {
        const isTrueOptionGroup = requirementGroupLooksLikeTrueOption(status.item.requirementGroup);
        return status.explicitCourseCodes.filter((courseCode) => {
          if (!isTrueOptionGroup) {
            return true;
          }

          return !courseMapsToSourceBackedRequiredUwCourse({
            courseCode,
            plan: scope.plan,
            campusId: scope.plan?.campusId,
            requiredUwCourseCodes,
          });
        });
      })
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
  if (option.optionKind === "category-option") {
    return [] as string[];
  }

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

function getRequirementOptionDisplayLabelsByIds(
  optionGroup: SuggestedQuarterCourseOptionGroup,
  optionIds: string[] | null | undefined
) {
  const optionIdSet = new Set(
    (optionIds ?? []).map((optionId) => String(optionId ?? "").trim()).filter(Boolean)
  );
  if (!optionIdSet.size) {
    return [] as string[];
  }

  return unique(
    optionGroup.options
      .filter((option) => optionIdSet.has(option.id))
      .map((option) => option.selectedLabel || option.label)
      .filter(Boolean)
  );
}

function getCategoryOptionDisplayLabelsByIds(
  optionGroup: SuggestedQuarterCourseOptionGroup,
  optionIds: string[] | null | undefined
) {
  const optionIdSet = new Set(
    (optionIds ?? []).map((optionId) => String(optionId ?? "").trim()).filter(Boolean)
  );
  if (!optionIdSet.size) {
    return [] as string[];
  }

  return unique(
    optionGroup.options
      .filter((option) => optionIdSet.has(option.id) && isRequirementCategoryOption(option))
      .map((option) => getRequirementCategoryOptionLabel(option))
      .filter(Boolean)
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
    if (
      (input.item as { scheduleSelectedRequirementOptions?: unknown })
        .scheduleSelectedRequirementOptions === true
    ) {
      return normalizeSelectedRequirementOptionIds(input.item.selectedRequirementOptionIds);
    }

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

function isRequirementCategoryOption(
  option: RequirementGroupOption | SuggestedQuarterCourseOption | null | undefined
) {
  return option?.optionKind === "category-option" && !!option.categoryOption;
}

function getRequirementCategoryOptionLabel(
  option: RequirementGroupOption | SuggestedQuarterCourseOption
) {
  const categoryOption = option.categoryOption;
  return (
    categoryOption?.title ||
    option.label ||
    (categoryOption?.credits && categoryOption?.sourceCategoryCode
      ? `${categoryOption.credits} credits of ${categoryOption.sourceCategoryCode}`
      : "")
  );
}

function getRequirementCategoryOptionCreditRange(
  option: RequirementGroupOption | SuggestedQuarterCourseOption
) {
  const exactCredits = getPositiveCreditAmount(
    option.categoryOption?.credits ??
      ("creditAmount" in option ? option.creditAmount : null) ??
      null
  );
  const creditMin =
    getPositiveCreditAmount(option.categoryOption?.creditMin) ??
    getPositiveCreditAmount(option.creditMin) ??
    exactCredits;
  const creditMax =
    getPositiveCreditAmount(option.categoryOption?.creditMax) ??
    getPositiveCreditAmount(option.creditMax) ??
    exactCredits ??
    creditMin;
  return {
    creditAmount:
      creditMin != null && creditMax != null && creditMin === creditMax ? creditMin : null,
    creditMin,
    creditMax,
  };
}

function getRemainingChooseCreditsRangeForStatus(
  status: TransferRequirementStatus,
  fallbackRange: {
    creditAmount?: number | null;
    creditMin?: number | null;
    creditMax?: number | null;
  }
) {
  if (status.item.requirementGroup?.requirementType !== "choose_credits") {
    return fallbackRange;
  }

  const completedCredits = getPositiveCreditAmount(status.completedCredits) ?? 0;
  const requiredCredits = getPositiveCreditAmount(status.requiredCreditCount);
  const maxCredits = getPositiveCreditAmount(status.maxCreditCount) ?? requiredCredits;
  if (requiredCredits === null) {
    return fallbackRange;
  }

  const remainingMin = Math.max(0, requiredCredits - completedCredits);
  const remainingMax =
    maxCredits !== null
      ? Math.max(remainingMin, maxCredits - completedCredits)
      : Math.max(
          remainingMin,
          getPositiveCreditAmount(fallbackRange.creditMax) ??
            getPositiveCreditAmount(fallbackRange.creditAmount) ??
            remainingMin
        );

  return {
    creditAmount: remainingMin === remainingMax ? remainingMin : null,
    creditMin: remainingMin,
    creditMax: remainingMax,
  };
}

function getRemainingChooseCreditsRangeAfterSelectedOptions(input: {
  status: TransferRequirementStatus;
  optionGroup: SuggestedQuarterCourseOptionGroup | null | undefined;
  selectedOptionIds: string[];
  fallbackRange: {
    creditAmount?: number | null;
    creditMin?: number | null;
    creditMax?: number | null;
  };
}) {
  const optionGroup = input.optionGroup;
  if (!optionGroup || !isSuggestedQuarterCreditBasedOptionGroup(optionGroup)) {
    return input.fallbackRange;
  }

  const requiredCredits = getPositiveCreditAmount(optionGroup.requiredCredits);
  if (requiredCredits === null) {
    return input.fallbackRange;
  }

  const completedCredits = getPositiveCreditAmount(input.status.completedCredits) ?? 0;
  const selectedCreditRange = getSuggestedQuarterOptionGroupSatisfyingCreditRange({
    optionGroup,
    optionIds: input.selectedOptionIds,
  });
  const selectedCredits = selectedCreditRange.creditMax ?? selectedCreditRange.creditMin ?? 0;
  const remainingCredits = Math.max(0, requiredCredits - completedCredits - selectedCredits);

  return {
    creditAmount: remainingCredits,
    creditMin: remainingCredits,
    creditMax: remainingCredits,
  };
}

function cleanCreditBucketRemainderCategoryLabel(label: string) {
  const cleaned = String(label ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\d+(?:\s*-\s*\d+)?\s+credits?\s+(?:of|from)\s+/i, "")
    .replace(/^choose\s+(?:at\s+least\s+)?\d+(?:\s*-\s*\d+)?\s+credits?\s+(?:from|of)\s+/i, "")
    .replace(/\s+remaining$/i, "")
    .trim();

  return cleaned || "approved credits";
}

function getCreditBucketRemainderCategoryLabel(input: {
  status: TransferRequirementStatus;
  optionGroup: SuggestedQuarterCourseOptionGroup;
}) {
  const categoryOptionLabel =
    input.optionGroup.options
      .filter((option) => isRequirementCategoryOption(option))
      .map((option) => getRequirementCategoryOptionLabel(option))
      .find(Boolean) ?? null;
  return cleanCreditBucketRemainderCategoryLabel(
    categoryOptionLabel || input.optionGroup.title || input.status.item.title
  );
}

function buildCreditBucketRemainderPlaceholderCourse(input: {
  status: TransferRequirementStatus;
  optionGroup: SuggestedQuarterCourseOptionGroup;
  remainingCredits: number;
  guidanceSummary?: string | null;
  priorityRank: number;
  sourceOrder: number;
}) {
  const creditLabel = formatCreditValueForProgress(input.remainingCredits);
  const categoryLabel = getCreditBucketRemainderCategoryLabel({
    status: input.status,
    optionGroup: input.optionGroup,
  });
  const isComputerEngineeringNaturalScienceRemainder = input.optionGroup.options.some(
    (option) =>
      isComputerEngineeringApprovedNaturalScienceCategory(
        option.categoryOption?.category ?? option.categoryOption?.sourceCategoryCode
      )
  );
  return {
    label: `${creditLabel} credits of ${categoryLabel} remaining`,
    type: "elective",
    status: "planned",
    sourceKind: "uw-major-requirement",
    guidanceSummary: joinGuidanceSummaries(
      input.guidanceSummary,
      isComputerEngineeringNaturalScienceRemainder
        ? `Use the ${COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_LABEL} filter in Transfer Category Equivalencies to find Green River courses whose UW equivalents are approved by the Allen School for this requirement. Official source: ${COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_SOURCE_URL}`
        : "Use Transfer Category Equivalencies to find Green River courses approved for this requirement."
    ),
    sequenceGroup: null,
    priorityRank: input.priorityRank,
    sourceOrder: input.sourceOrder,
    explicitCourseCodes: [],
    prerequisiteCourseSets: [],
    corequisiteCourseSets: [],
    optionGroup: null,
    sourceRequirementGroupId: input.optionGroup.id,
    courseRole: "unresolved-credit-bucket-remainder",
    creditAmount: input.remainingCredits,
    creditMin: input.remainingCredits,
    creditMax: input.remainingCredits,
  } satisfies PendingSuggestedCourse;
}

function buildCategoryOptionGuidanceSummary(option: RequirementGroupOption) {
  if (
    isComputerEngineeringApprovedNaturalScienceCategory(
      option.categoryOption?.category ?? option.categoryOption?.sourceCategoryCode
    )
  ) {
    return `Use the ${COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_LABEL} filter in Transfer Category Equivalencies to find Green River courses whose UW equivalents are approved by the Allen School. Official source: ${COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_SOURCE_URL}`;
  }

  const categoryCode = option.categoryOption?.sourceCategoryCode;
  if (!categoryCode) {
    return "Use the Transfer Category Equivalencies page to find eligible Green River courses.";
  }

  return `Use Transfer Category Equivalencies to find Green River courses carrying ${categoryCode}.`;
}

const CATEGORY_OPTION_AUDIT_PATTERNS = [
  { category: "NSC", sourceCategoryCode: "NSc", pattern: /\b(?:N\s*Sc|natural sciences?|natural science)\b/i },
  { category: "AH", sourceCategoryCode: "A&H", pattern: /\b(?:A\s*&\s*H|arts?\s+(?:and|&)\s+humanities|humanities|fine arts?)\b/i },
  { category: "SSC", sourceCategoryCode: "SSc", pattern: /\b(?:S\s*Sc|social sciences?)\b/i },
  { category: "QSR", sourceCategoryCode: "QSR", pattern: /\bQSR\b|\bquantitative and symbolic reasoning\b/i },
  { category: "VLPA", sourceCategoryCode: "VLPA", pattern: /\bVLPA\b|\bvisual,\s*literary,\s*and\s*performing arts\b/i },
  { category: "DIV", sourceCategoryCode: "DIV", pattern: /\bDIV\b|\bdiversity\b/i },
  { category: "NW", sourceCategoryCode: "NW", pattern: /\bNW\b|\bnatural world\b/i },
  { category: "IANDS", sourceCategoryCode: "I&S", pattern: /\bI\s*&\s*S\b|\bindividuals\s+and\s+societies\b/i },
];

function getCategoryOptionAuditDescriptor(text: string | null | undefined) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return CATEGORY_OPTION_AUDIT_PATTERNS.find((entry) => entry.pattern.test(normalized)) ?? null;
}

function buildSuggestedQuarterCourseOption(
  item: TransferPlannerChecklistItem,
  option: RequirementGroupOption,
  optionIndex: number,
  campusId?: TransferPlannerMajorPlan["campusId"] | null
): SuggestedQuarterCourseOption | null {
  if (isRequirementCategoryOption(option)) {
    const label = getRequirementCategoryOptionLabel(option) || `Option ${optionIndex + 1}`;
    return {
      id: getRequirementOptionId(item, option, optionIndex),
      optionKind: "category-option",
      label,
      selectedLabel: label,
      courseLabels: [],
      courseCodes: [],
      categoryOption: option.categoryOption ?? null,
      guidanceSummary: buildCategoryOptionGuidanceSummary(option),
      ...getRequirementCategoryOptionCreditRange(option),
    };
  }

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
    optionKind: "course",
    label,
    selectedLabel: getRequirementOptionSelectedLabel(option) || label,
    courseLabels,
    courseCodes,
    categoryOption: null,
    guidanceSummary: buildTransferEquivalencyGuidanceSummary(courseCodes, campusId),
    ...getRequirementOptionCanonicalGrcCreditRange(option, courseLabels),
  };
}

function getSuggestedQuarterCourseOptionDeduplicationKey(
  option: SuggestedQuarterCourseOption
) {
  if (isRequirementCategoryOption(option)) {
    return `category:${option.categoryOption?.category ?? ""}:${
      option.categoryOption?.credits ?? ""
    }:${option.categoryOption?.creditMin ?? ""}:${
      option.categoryOption?.creditMax ?? ""
    }:${String(option.categoryOption?.title ?? option.label ?? "").toLowerCase()}`;
  }

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
  const maxRequiredCredits =
    getPositiveCreditAmount(optionGroup.maxRequiredCredits) ?? requiredCredits;
  if (requiredCredits !== null) {
    return {
      creditAmount:
        maxRequiredCredits !== null && requiredCredits === maxRequiredCredits
          ? requiredCredits
          : null,
      creditMin: requiredCredits,
      creditMax: maxRequiredCredits ?? requiredCredits,
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
  selectionSource?: SuggestedQuarterCourseOptionGroup["selectionSource"];
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
  const categoryOptionIds = new Set(
    dedupedOptions.options
      .filter((option) => isRequirementCategoryOption(option))
      .map((option) => option.id)
  );
  const concreteSelectedOptionIds = dedupedOptions.selectedOptionIds.filter(
    (optionId) => !categoryOptionIds.has(optionId)
  );
  const selectedOptionIds =
    group.requirementType === "choose_credits" && concreteSelectedOptionIds.length
      ? concreteSelectedOptionIds
      : dedupedOptions.selectedOptionIds;

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
    maxRequiredCredits: group.maxCredits ?? group.minCredits ?? null,
    requirementType: group.requirementType,
    satisfactionMode:
      group.requirementType === "choose_credits" && getPositiveCreditAmount(group.minCredits) !== null
        ? "credit-based"
        : "selection-count",
    selectedOptionIds,
    selectionSource: input.selectionSource ?? null,
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

function shouldScheduleRequirementStatusAsPlannerChoiceBucket(
  status: TransferRequirementStatus,
  plan?: TransferPlannerMajorPlan | null
) {
  const hasChoiceGroup =
    isChoiceRequirementStatus(status) &&
    Boolean(status.item.requirementGroup?.options?.length);
  if (!hasChoiceGroup) {
    return false;
  }

  if (isUwTransferPlannerPlan(plan)) {
    return checklistItemLooksLikeTrueOption(status.item);
  }

  return (
    status.requiredCompletedCount > 0 &&
    status.requiredCompletedCount < status.explicitCourseCodes.length
  );
}

function getSelectedRequirementOptionEntriesForPlannerScheduling(input: {
  item: TransferPlannerChecklistItem;
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
  campusId?: TransferPlannerMajorPlan["campusId"] | null;
  plan?: TransferPlannerMajorPlan | null;
}) {
  const selectedOptionIds = getPlannerSelectedRequirementOptionIdsForScheduling({
    item: input.item,
    selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
    plan: input.plan,
  });
  const selectedOptionGroup = buildSuggestedQuarterCourseOptionGroup({
    item: input.item,
    selectedOptionIds,
    isSelectionPrompt: false,
    campusId: input.campusId,
  });

  if (!selectedOptionGroup) {
    return [] as { option: RequirementGroupOption; optionId: string; optionIndex: number }[];
  }

  const selectedEntries = getSelectedRequirementOptionsForPlanner(
    input.item,
    selectedOptionGroup.selectedOptionIds
  );

  return isSuggestedQuarterCreditBasedOptionGroup(selectedOptionGroup)
    ? selectedEntries
    : selectedEntries.slice(0, selectedOptionGroup.selectionCount);
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

const UW_SEATTLE_CHEMICAL_ENGINEERING_PLAN_ID = "uw-seattle-chemical-engineering";
const UW_SEATTLE_COMPUTER_ENGINEERING_PLAN_ID = "uw-seattle-computer-engineering";
const UW_SEATTLE_ENVIRONMENTAL_ENGINEERING_PLAN_ID = "uw-seattle-environmental-engineering";
function getSpecificTargetCourseCodesForRule(rule: TransferPlannerEquivalencyRule) {
  return sortCourseCodes(
    (rule.targetCourseCodes ?? [])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
      .filter(isSpecificTransferTargetCourseCode)
  );
}

function getNormalizedRuleSourceCourseSets(rule: TransferPlannerEquivalencyRule) {
  return (rule.sourceCourseSets ?? [])
    .map((sourceCourseSet) =>
      unique(sourceCourseSet.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean))
    )
    .filter((sourceCourseSet) => sourceCourseSet.length > 0);
}

function getComputerEngineeringApprovedNaturalScienceRuleReason(
  rule: TransferPlannerEquivalencyRule
): ComputerEngineeringApprovedNaturalScienceTransferEntry["inclusionReason"] | null {
  if (!rule.targetSchoolIds.includes("uw-seattle")) {
    return null;
  }
  if (rule.isObsoleteSourceCourse || rule.acceptanceCategory === "no-credit" || rule.type === "no-credit") {
    return null;
  }

  const specificTargets = getSpecificTargetCourseCodesForRule(rule);
  const approvedTargets = specificTargets.filter(
    isComputerEngineeringApprovedNaturalScienceUwCourseCode
  );
  if (!approvedTargets.length) {
    return null;
  }
  if (
    specificTargets.some(
      (courseCode) => !isComputerEngineeringApprovedNaturalScienceUwCourseCode(courseCode)
    )
  ) {
    return null;
  }

  const sourceCourseSets = getNormalizedRuleSourceCourseSets(rule);
  if (!sourceCourseSets.length) {
    return null;
  }

  return sourceCourseSets.some((sourceCourseSet) => sourceCourseSet.length > 1) ||
    approvedTargets.length > 1
    ? "compound-path"
    : "approved-uw-equivalent";
}

function getComputerEngineeringApprovedNaturalScienceRuleScore(
  rule: TransferPlannerEquivalencyRule
) {
  let score = 0;
  if (rule.ruleStatus === "active") score += 8;
  if (rule.sourceKind === "uw-green-river-equivalency-guide-derived") score += 4;
  if (/\s\+\s/.test(rule.sourceCourseLabel ?? "")) score += 2;
  if ((rule.plannerWarnings ?? []).length === 0) score += 1;
  return score;
}

type ComputerEngineeringApprovedNaturalScienceTransferEntryWithScore =
  ComputerEngineeringApprovedNaturalScienceTransferEntry & { ruleScore: number };

function buildComputerEngineeringApprovedNaturalScienceTransferEntries() {
  const entries: ComputerEngineeringApprovedNaturalScienceTransferEntryWithScore[] =
    getTransferPlannerAllEquivalencyRules()
    .flatMap<ComputerEngineeringApprovedNaturalScienceTransferEntryWithScore>((rule) => {
      const inclusionReason = getComputerEngineeringApprovedNaturalScienceRuleReason(rule);
      if (!inclusionReason) {
        return [];
      }

      const sourceCourseSets = getNormalizedRuleSourceCourseSets(rule);
      const approvedTargets = getSpecificTargetCourseCodesForRule(rule).filter(
        isComputerEngineeringApprovedNaturalScienceUwCourseCode
      );
      return sourceCourseSets.map((sourceCourseSet) => ({
        id: `ce-approved-natural-science:${rule.id}:${sourceCourseSet.join("-")}`,
        sourceCourseLabel:
          sourceCourseSet.length > 1
            ? sourceCourseSet.join(" + ")
            : String(rule.sourceCourseLabel ?? sourceCourseSet.join(" + ")).trim(),
        sourceCourseTitle: rule.sourceCourseTitle ?? null,
        sourceCourseCodes: sourceCourseSet,
        targetOutcome: rule.targetOutcome,
        uwEquivalentCourseCodes: approvedTargets,
        inclusionReason,
        sourceRuleId: rule.id,
        ruleScore: getComputerEngineeringApprovedNaturalScienceRuleScore(rule),
      }));
    })
    .sort((left, right) => {
      const scoreDelta = right.ruleScore - left.ruleScore;
      if (scoreDelta !== 0) return scoreDelta;
      return left.sourceCourseLabel.localeCompare(right.sourceCourseLabel);
    });

  return uniqueBy(
    entries.map(({ ruleScore: _ruleScore, ...entry }) => entry),
    (entry) => `${entry.sourceCourseCodes.join("|")}||${entry.uwEquivalentCourseCodes.join("|")}`
  ).sort((left, right) => left.sourceCourseLabel.localeCompare(right.sourceCourseLabel));
}

export function getComputerEngineeringApprovedNaturalScienceTransferEntries(): ComputerEngineeringApprovedNaturalScienceTransferEntry[] {
  return buildComputerEngineeringApprovedNaturalScienceTransferEntries();
}

export function getComputerEngineeringApprovedNaturalScienceSourceCourseCodes() {
  return sortCourseCodes(
    getComputerEngineeringApprovedNaturalScienceTransferEntries().flatMap(
      (entry) => entry.sourceCourseCodes
    )
  );
}

function getCompletedCourseCodesMatchingComputerEngineeringApprovedNaturalScience(input: {
  completedCourses: TranscriptCourseEntry[];
  campusId?: TransferPlannerMajorPlan["campusId"] | null;
}) {
  if (input.campusId !== "uw-seattle") {
    return [] as string[];
  }

  const completedCourseCodes = normalizeCourseCodeIterable(
    input.completedCourses.map((course) => course.code)
  );
  if (!completedCourseCodes.size) {
    return [] as string[];
  }

  return sortCourseCodes(
    getComputerEngineeringApprovedNaturalScienceTransferEntries()
      .filter((entry) =>
        entry.sourceCourseCodes.every((courseCode) => completedCourseCodes.has(courseCode))
      )
      .flatMap((entry) => entry.sourceCourseCodes)
  );
}

function doesSourceCourseSetMatchInputCourseCodes(
  sourceCourseCodes: string[],
  inputCourseCodes?: Iterable<string> | null
) {
  const filterCourseCodes = normalizeCourseCodeIterable(inputCourseCodes ?? []);
  if (!filterCourseCodes.size) {
    return true;
  }
  return sourceCourseCodes.some((courseCode) => filterCourseCodes.has(courseCode));
}

function getComputerEngineeringApprovedNaturalScienceExcludedGenericCategoryRows(input?: {
  courseCodes?: Iterable<string> | null;
}) {
  const includedKeys = new Set(
    getComputerEngineeringApprovedNaturalScienceTransferEntries().map((entry) =>
      entry.sourceCourseCodes.join("|")
    )
  );
  const rows: TransferCategoryFilterAuditEntry[] = [];

  for (const rule of getTransferPlannerAllEquivalencyRules()) {
    if (!rule.targetSchoolIds.includes("uw-seattle")) continue;
    if (rule.isObsoleteSourceCourse || rule.acceptanceCategory === "no-credit") continue;
    if (
      !getEvaluationTargetRequirementTags(rule).some((tag) => tag === "NSC" || tag === "NW")
    ) {
      continue;
    }
    if (getComputerEngineeringApprovedNaturalScienceRuleReason(rule)) continue;

    const sourceCourseSets = getNormalizedRuleSourceCourseSets(rule);
    for (const sourceCourseCodes of sourceCourseSets) {
      if (includedKeys.has(sourceCourseCodes.join("|"))) continue;
      if (!doesSourceCourseSetMatchInputCourseCodes(sourceCourseCodes, input?.courseCodes)) {
        continue;
      }
      const course = sourceCourseCodes.join(" + ");
      const uwEquivalent =
        getSpecificTargetCourseCodesForRule(rule).join(", ") || rule.targetOutcome;
      rows.push({
        filter: COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_LABEL,
        course,
        uwEquivalent,
        included: false,
        reason: "generic-category-only",
        copyOnlyDebugText: [
          "[copy-only transfer-category-filter audit]",
          `Filter: ${COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_LABEL}`,
          `Course: ${course}`,
          `UW equivalent: ${uwEquivalent}`,
          "Included: no",
          "Reason: generic-category-only",
        ].join(" "),
      });
    }
  }

  return uniqueBy(rows, (row) => `${row.course}||${row.uwEquivalent}`).sort((left, right) =>
    left.course.localeCompare(right.course)
  );
}

export function auditComputerEngineeringApprovedNaturalScienceTransferCategoryFilter(input?: {
  courseCodes?: Iterable<string> | null;
}): TransferCategoryFilterAuditEntry[] {
  const includedRows = getComputerEngineeringApprovedNaturalScienceTransferEntries()
    .filter((entry) => doesSourceCourseSetMatchInputCourseCodes(entry.sourceCourseCodes, input?.courseCodes))
    .map(
      (entry) =>
        ({
          filter: COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_LABEL,
          course: entry.sourceCourseCodes.join(" + "),
          uwEquivalent: entry.uwEquivalentCourseCodes.join(", "),
          included: true,
          reason: entry.inclusionReason,
          copyOnlyDebugText: [
            "[copy-only transfer-category-filter audit]",
            `Filter: ${COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_LABEL}`,
            `Course: ${entry.sourceCourseCodes.join(" + ")}`,
            `UW equivalent: ${entry.uwEquivalentCourseCodes.join(", ")}`,
            "Included: yes",
            `Reason: ${entry.inclusionReason}`,
          ].join(" "),
        }) satisfies TransferCategoryFilterAuditEntry
    );

  return [
    ...includedRows,
    ...getComputerEngineeringApprovedNaturalScienceExcludedGenericCategoryRows(input),
  ];
}

export function auditComputerEngineeringApprovedNaturalScienceEquivalencies(): ComputerEngineeringApprovedNaturalScienceAuditEntry[] {
  const mappedEntries = getComputerEngineeringApprovedNaturalScienceTransferEntries();
  const mappedUwCodes = new Set(mappedEntries.flatMap((entry) => entry.uwEquivalentCourseCodes));
  const includedRows = mappedEntries.map(
    (entry) =>
      ({
        major: "Computer Engineering",
        officialSource: COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_SOURCE_URL,
        uwApprovedCourse: entry.uwEquivalentCourseCodes.join(", "),
        grcEquivalentPath: entry.sourceCourseCodes,
        includedInFilter: true,
        reason: entry.inclusionReason,
        copyOnlyDebugText: [
          "[copy-only ce-approved-natural-science audit]",
          "Major: Computer Engineering",
          `Official source: ${COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_SOURCE_URL}`,
          `UW approved course: ${entry.uwEquivalentCourseCodes.join(", ")}`,
          `GRC equivalent/path: ${entry.sourceCourseCodes.join(" + ")}`,
          "Included in CE-approved filter: yes",
          `Reason: ${entry.inclusionReason}`,
        ].join(" "),
      }) satisfies ComputerEngineeringApprovedNaturalScienceAuditEntry
  );
  const missingRows = COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_UW_COURSE_CODES
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter((courseCode) => !mappedUwCodes.has(courseCode))
    .map(
      (courseCode) =>
        ({
          major: "Computer Engineering",
          officialSource: COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_SOURCE_URL,
          uwApprovedCourse: courseCode,
          grcEquivalentPath: [],
          includedInFilter: false,
          reason: "no-grc-equivalent",
          copyOnlyDebugText: [
            "[copy-only ce-approved-natural-science audit]",
            "Major: Computer Engineering",
            `Official source: ${COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_SOURCE_URL}`,
            `UW approved course: ${courseCode}`,
            "GRC equivalent/path: none",
            "Included in CE-approved filter: no",
            "Reason: no-grc-equivalent",
          ].join(" "),
        }) satisfies ComputerEngineeringApprovedNaturalScienceAuditEntry
    );
  const petitionRows = COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_PETITION_ONLY_NOTES.map(
    (note) =>
      ({
        major: "Computer Engineering",
        officialSource: COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_SOURCE_URL,
        uwApprovedCourse: String(note),
        grcEquivalentPath: [],
        includedInFilter: false,
        reason: "petition-only",
        copyOnlyDebugText: [
          "[copy-only ce-approved-natural-science audit]",
          "Major: Computer Engineering",
          `Official source: ${COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_SOURCE_URL}`,
          `UW approved course: ${note}`,
          "GRC equivalent/path: none",
          "Included in CE-approved filter: no",
          "Reason: petition-only",
        ].join(" "),
      }) satisfies ComputerEngineeringApprovedNaturalScienceAuditEntry
  );

  return [...includedRows, ...missingRows, ...petitionRows];
}

const COMPUTER_ENGINEERING_CREDIT_BUCKET_ROWS = [
  {
    groupIdSuffix: "approved-natural-science-10-credits",
    requirement: "10 additional credits approved natural science",
    creditsRequired: "10",
  },
  {
    groupIdSuffix: "additional-math-science-3-6-credits",
    requirement: "3-6 additional Math/Science",
    creditsRequired: "3-6",
  },
];
const COMPUTER_ENGINEERING_NON_REQUIRED_OPTION_UW_COURSES = new Set(
  ["CSE 121", "CSE 122"].map((courseCode) => normalizeCourseCode(courseCode))
);
const CHEMICAL_ENGINEERING_ELECTIVE_LIST_FALSE_REQUIRED_ROWS = [
  {
    uwCourse: "AA 210",
    grcEquivalent: "ENGR& 214",
    sourceSection: "Engineering Electives",
    reason:
      "listed as a Chemical Engineering engineering elective, not a lower-division ChemE core or admission requirement.",
  },
  {
    uwCourse: "CEE 220",
    grcEquivalent: "ENGR& 225",
    sourceSection: "Engineering Electives",
    reason:
      "listed as a Chemical Engineering engineering elective, not a lower-division ChemE core or admission requirement.",
  },
  {
    uwCourse: "EE 215",
    grcEquivalent: "ENGR& 204",
    sourceSection: "Engineering Electives",
    reason:
      "listed as a Chemical Engineering engineering elective, not a lower-division ChemE core or admission requirement.",
  },
  {
    uwCourse: "ME 123",
    grcEquivalent: "ENGR& 114",
    sourceSection: "Engineering Electives",
    reason:
      "listed as a Chemical Engineering engineering elective, not a lower-division ChemE core or admission requirement.",
  },
  {
    uwCourse: "ME 230",
    grcEquivalent: "ENGR& 215",
    sourceSection: "Engineering Electives",
    reason:
      "listed as a Chemical Engineering engineering elective, not a lower-division ChemE core or admission requirement.",
  },
  {
    uwCourse: "MSE 170",
    grcEquivalent: "ENGR 140",
    sourceSection: "Engineering Electives",
    reason:
      "listed as a Chemical Engineering engineering elective, not a lower-division ChemE core or admission requirement.",
  },
  {
    uwCourse: "CSE 143",
    grcEquivalent: "CS 145",
    sourceSection: "Engineering Electives",
    reason:
      "listed as a Chemical Engineering engineering elective, not a lower-division ChemE core or admission requirement.",
  },
].map((row) => ({
  ...row,
  uwCourse: normalizeCourseCode(row.uwCourse),
  grcEquivalent: normalizeCourseCode(row.grcEquivalent),
}));
const CHEMICAL_ENGINEERING_ELECTIVE_LIST_FALSE_REQUIRED_UW_COURSES = new Set(
  CHEMICAL_ENGINEERING_ELECTIVE_LIST_FALSE_REQUIRED_ROWS.map((row) => row.uwCourse)
);
const CHEMICAL_ENGINEERING_ELECTIVE_LIST_FALSE_REQUIRED_GRC_COURSES = new Set(
  CHEMICAL_ENGINEERING_ELECTIVE_LIST_FALSE_REQUIRED_ROWS.map((row) => row.grcEquivalent)
);
const ENVIRONMENTAL_ENGINEERING_EARTH_SCIENCE_OPTION_ROWS = [
  ["ESS 212", "GEOL& 101"],
  ["ESRM 101", "NATRS 100"],
  ["ESRM 210", "NATRS 210"],
  ["NUTR 200", "NUTR& 101"],
].map(([uwCourse, grcEquivalent]) => ({
  uwCourse: normalizeCourseCode(uwCourse),
  grcEquivalent: normalizeCourseCode(grcEquivalent),
  sourceSection: "Earth science elective",
  reason: "Earth science elective is choose one, not all.",
}));
const CHEMICAL_ENGINEERING_SOURCE_BACKED_REQUIRED_UW_REQUIREMENTS = [
  ["ENGL 131", "English Composition"],
  ["MATH 124", "MATH 124"],
  ["MATH 125", "MATH 125"],
  ["MATH 126", "MATH 126"],
  ["MATH 207", "MATH 207"],
  ["MATH 208", "MATH 208"],
  ["MATH 224", "Math Elective"],
  ["CHEM 142", "CHEM 142"],
  ["CHEM 152", "CHEM 152"],
  ["CHEM 162", "CHEM 162"],
  ["CHEM 237", "CHEM 237"],
  ["CHEM 238", "CHEM 238"],
  ["PHYS 121", "PHYS 121"],
  ["PHYS 122", "PHYS 122"],
  ["PHYS 123", "PHYS 123"],
].map(([courseCode, label]) => ({
  courseCode: normalizeCourseCode(courseCode),
  label,
}));

function isChemicalEngineeringPlan(plan: TransferPlannerMajorPlan | null | undefined) {
  return plan?.id === UW_SEATTLE_CHEMICAL_ENGINEERING_PLAN_ID;
}

function isComputerEngineeringPlan(plan: TransferPlannerMajorPlan | null | undefined) {
  return plan?.id === UW_SEATTLE_COMPUTER_ENGINEERING_PLAN_ID;
}

function isEnvironmentalEngineeringPlan(plan: TransferPlannerMajorPlan | null | undefined) {
  return plan?.id === UW_SEATTLE_ENVIRONMENTAL_ENGINEERING_PLAN_ID;
}

function isChemicalEngineeringElectiveListFalseRequiredUwCourse(
  plan: TransferPlannerMajorPlan | null | undefined,
  courseCode: string | null | undefined
) {
  return (
    isChemicalEngineeringPlan(plan) &&
    CHEMICAL_ENGINEERING_ELECTIVE_LIST_FALSE_REQUIRED_UW_COURSES.has(
      normalizeCourseCode(courseCode ?? "")
    )
  );
}

function isChemicalEngineeringElectiveListFalseRequiredGrcCourse(
  plan: TransferPlannerMajorPlan | null | undefined,
  courseCode: string | null | undefined
) {
  return (
    isChemicalEngineeringPlan(plan) &&
    CHEMICAL_ENGINEERING_ELECTIVE_LIST_FALSE_REQUIRED_GRC_COURSES.has(
      normalizeCourseCode(courseCode ?? "")
    )
  );
}

function shouldAllowSourceScopedRequiredUwCourse(
  plan: TransferPlannerMajorPlan | null | undefined,
  uwCourseCode: string | null | undefined
) {
  if (
    isComputerEngineeringPlan(plan) &&
    COMPUTER_ENGINEERING_NON_REQUIRED_OPTION_UW_COURSES.has(
      normalizeCourseCode(uwCourseCode ?? "")
    )
  ) {
    return false;
  }

  return !isChemicalEngineeringElectiveListFalseRequiredUwCourse(plan, uwCourseCode);
}

function getChemicalEngineeringSourceBackedRequiredUwCourseCodeSet(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!isChemicalEngineeringPlan(plan)) {
    return null;
  }

  return new Set(
    CHEMICAL_ENGINEERING_SOURCE_BACKED_REQUIRED_UW_REQUIREMENTS.map((row) => row.courseCode)
  );
}

function getChemicalEngineeringSourceBackedRequiredUwRequirementLabels(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!isChemicalEngineeringPlan(plan)) {
    return null;
  }

  return new Map(
    CHEMICAL_ENGINEERING_SOURCE_BACKED_REQUIRED_UW_REQUIREMENTS.map((row) => [
      row.courseCode,
      row.label,
    ])
  );
}

function shouldAllowSourceScopedRequiredChecklistItem(
  plan: TransferPlannerMajorPlan | null | undefined,
  item: TransferPlannerChecklistItem
) {
  if (!isChemicalEngineeringPlan(plan)) {
    return true;
  }

  const titleCourseCodes = extractCourseCodes(item.title ?? "");
  if (
    titleCourseCodes.some((courseCode) =>
      isChemicalEngineeringElectiveListFalseRequiredUwCourse(plan, courseCode)
    )
  ) {
    return false;
  }

  const grcCourseCodes = (item.grcCourses ?? []).flatMap((label) => extractCourseCodes(label));
  return !grcCourseCodes.some((courseCode) =>
    isChemicalEngineeringElectiveListFalseRequiredGrcCourse(plan, courseCode)
  );
}

const SOURCE_BACKED_REQUIRED_COURSE_SEMANTIC_RELATION_CACHE = new Map<string, string[]>();

export function extractCourseCodes(value: string) {
  return unique(
    [
      ...(String(value ?? "").toUpperCase().match(COURSE_CODE_PATTERN) ?? []),
      ...extractTransferPlannerCourseCodes(String(value ?? "")),
    ]
      .map((match) => normalizeCourseCode(match))
      .filter((courseCode) => !/^(?:AND|OR)\s+\d{3}/.test(courseCode))
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
  hasCategoryOption?: boolean;
  courseRole?: SuggestedQuarterCourse["courseRole"];
}): SuggestedQuarterCourseVisibilityScope {
  if (input.isPrepCourse) {
    return "visible-grc-optional-prep" satisfies SuggestedQuarterCourseVisibilityScope;
  }

  if (input.courseRole === "unresolved-credit-bucket-remainder") {
    return "visible-grc-completable" satisfies SuggestedQuarterCourseVisibilityScope;
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

  if (
    input.hasCategoryOption &&
    (input.sourceKind === "uw-major-requirement" || input.sourceKind === "uw-major-breadth")
  ) {
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
  const hasCategoryOption = (course.optionGroup?.options ?? []).some((option) =>
    isRequirementCategoryOption(option)
  );
  const visibilityScope = getCourseVisibilityScope({
    explicitCourseCodes,
    sourceKind,
    plan: input.plan,
    isPrepCourse: input.isPrepCourse,
    hasCategoryOption,
    courseRole: course.courseRole,
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

function getCanonicalGrcCourseCreditAmount(courseCode: string | null | undefined) {
  const normalizedCourseCode = normalizeCourseCode(courseCode ?? "");
  if (!normalizedCourseCode) {
    return null;
  }

  return getPositiveCreditAmount(
    getTransferPlannerCanonicalCourse("grc", normalizedCourseCode)?.creditValue
  );
}

function getCanonicalGrcCourseCreditRangeForCourseCodes(
  courseCodes: string[] | null | undefined
) {
  const normalizedCourseCodes = sortCourseCodes(
    unique((courseCodes ?? []).map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean))
  );
  if (!normalizedCourseCodes.length) {
    return null;
  }

  let totalCredits = 0;
  for (const courseCode of normalizedCourseCodes) {
    const creditAmount = getCanonicalGrcCourseCreditAmount(courseCode);
    if (creditAmount === null) {
      return null;
    }
    totalCredits += creditAmount;
  }

  return totalCredits > 0
    ? {
        creditAmount: totalCredits,
        creditMin: totalCredits,
        creditMax: totalCredits,
      }
    : null;
}

function getRequirementOptionCanonicalGrcCreditRange(
  option: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>["options"][number],
  courseLabels: string[] = getRequirementOptionCourseLabels(option)
) {
  const canonicalGrcCreditRange = getCanonicalGrcCourseCreditRangeForCourseCodes(
    unique(courseLabels.flatMap((label) => extractCourseCodes(label)))
  );
  return canonicalGrcCreditRange ?? getRequirementOptionCreditRange(option, courseLabels);
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

function isSuggestedQuarterCreditBasedOptionGroup(
  optionGroup: SuggestedQuarterCourseOptionGroup | null | undefined
) {
  return (
    optionGroup?.requirementType === "choose_credits" &&
    getPositiveCreditAmount(optionGroup.requiredCredits) !== null
  );
}

function getSuggestedQuarterOptionGroupRequiredCreditRange(
  optionGroup: SuggestedQuarterCourseOptionGroup | null | undefined
) {
  const creditMin = getPositiveCreditAmount(optionGroup?.requiredCredits);
  const creditMax = getPositiveCreditAmount(optionGroup?.maxRequiredCredits) ?? creditMin;

  return {
    creditMin,
    creditMax,
  };
}

function getSuggestedQuarterCourseOptionCreditRange(option: SuggestedQuarterCourseOption) {
  if (isRequirementCategoryOption(option)) {
    return getRequirementCategoryOptionCreditRange(option);
  }

  return getSuggestedCourseCreditRangeFromValues({
    creditAmount: option.creditAmount,
    creditMin: option.creditMin,
    creditMax: option.creditMax,
  });
}

function getSuggestedQuarterCourseOptionCreditContribution(input: {
  option: SuggestedQuarterCourseOption;
  countedCourseCodes: Set<string>;
}) {
  if (!isRequirementCategoryOption(input.option)) {
    const courseCodes = unique(
      [
        ...(input.option.courseCodes ?? []),
        ...(input.option.courseLabels ?? []).flatMap((label) => extractCourseCodes(label)),
      ]
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean)
    );
    const uncountedCourseCodes = courseCodes.filter(
      (courseCode) => !input.countedCourseCodes.has(courseCode)
    );
    for (const courseCode of uncountedCourseCodes) {
      input.countedCourseCodes.add(courseCode);
    }

    const canonicalCreditRange =
      getCanonicalGrcCourseCreditRangeForCourseCodes(uncountedCourseCodes);
    if (canonicalCreditRange) {
      return canonicalCreditRange;
    }

    if (courseCodes.length && !uncountedCourseCodes.length) {
      return {
        creditAmount: 0,
        creditMin: 0,
        creditMax: 0,
      };
    }
  }

  return getSuggestedQuarterCourseOptionCreditRange(input.option);
}

function getSuggestedQuarterOptionGroupSatisfyingCreditRange(input: {
  optionGroup: SuggestedQuarterCourseOptionGroup;
  optionIds: string[] | null | undefined;
}) {
  const optionIds = getSuggestedScheduleUniqueIds(input.optionIds);
  if (!optionIds.length) {
    return {
      creditMin: 0,
      creditMax: 0,
    };
  }

  const optionById = new Map(input.optionGroup.options.map((option) => [option.id, option]));
  const countedCourseCodes = new Set<string>();
  let creditMin = 0;
  let creditMax = 0;

  for (const optionId of optionIds) {
    const option = optionById.get(optionId);
    if (!option) {
      continue;
    }

    const range = getSuggestedQuarterCourseOptionCreditContribution({
      option,
      countedCourseCodes,
    });
    const minCredits = range.creditMin ?? range.creditAmount ?? range.creditMax ?? 0;
    const maxCredits = range.creditMax ?? range.creditAmount ?? range.creditMin ?? 0;
    creditMin += minCredits;
    creditMax += maxCredits;
  }

  return {
    creditMin,
    creditMax,
  };
}

function formatCreditValueForProgress(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "0";
  }

  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function formatCreditRangeValueForProgress(
  creditMin: number | null | undefined,
  creditMax: number | null | undefined
) {
  if (
    creditMin != null &&
    creditMax != null &&
    Number.isFinite(creditMin) &&
    Number.isFinite(creditMax) &&
    creditMin !== creditMax
  ) {
    return `${formatCreditValueForProgress(creditMin)}-${formatCreditValueForProgress(creditMax)}`;
  }

  return formatCreditValueForProgress(creditMin ?? creditMax ?? 0);
}

function formatSuggestedQuarterOptionGroupCreditProgress(input: {
  optionGroup: SuggestedQuarterCourseOptionGroup;
  creditMin: number;
  creditMax: number;
}) {
  const requiredRange = getSuggestedQuarterOptionGroupRequiredCreditRange(input.optionGroup);
  const requiredLabel = formatCreditRangeValueForProgress(
    requiredRange.creditMin,
    requiredRange.creditMax
  );
  const resolvedLabel = formatCreditRangeValueForProgress(input.creditMin, input.creditMax);

  return `${resolvedLabel}/${requiredLabel}`;
}

function getSuggestedQuarterOptionGroupCreditSatisfaction(input: {
  optionGroup: SuggestedQuarterCourseOptionGroup;
  optionIds?: string[] | null;
}) {
  const requiredRange = getSuggestedQuarterOptionGroupRequiredCreditRange(input.optionGroup);
  const requiredCredits = requiredRange.creditMin ?? 0;
  const resolvedRange = getSuggestedQuarterOptionGroupSatisfyingCreditRange({
    optionGroup: input.optionGroup,
    optionIds:
      input.optionIds ??
      getSuggestedQuarterCourseOptionGroupResolvedOptionIds(input.optionGroup),
  });
  const satisfyingCredits = resolvedRange.creditMax ?? resolvedRange.creditMin ?? 0;

  return {
    requiredCredits,
    maxRequiredCredits: requiredRange.creditMax ?? requiredCredits,
    creditMin: resolvedRange.creditMin,
    creditMax: resolvedRange.creditMax,
    displayedProgress: formatSuggestedQuarterOptionGroupCreditProgress({
      optionGroup: input.optionGroup,
      creditMin: resolvedRange.creditMin,
      creditMax: resolvedRange.creditMax,
    }),
    fullySatisfied: requiredCredits > 0 && satisfyingCredits >= requiredCredits,
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

function getSuggestedQuarterCourseOptionGroupResolvedOptionIds(
  optionGroup: SuggestedQuarterCourseOptionGroup | null | undefined
) {
  if (!optionGroup) {
    return [] as string[];
  }

  if (optionGroup.resolvedSatisfiedOptionIds) {
    return getSuggestedScheduleUniqueIds(optionGroup.resolvedSatisfiedOptionIds);
  }

  return getSuggestedScheduleUniqueIds([
    ...(optionGroup.selectedOptionIds ?? []),
  ]);
}

function isSuggestedQuarterOptionGroupResolved(
  optionGroup: SuggestedQuarterCourseOptionGroup | null | undefined
) {
  if (!optionGroup) {
    return true;
  }

  if (isSuggestedQuarterCreditBasedOptionGroup(optionGroup)) {
    return getSuggestedQuarterOptionGroupCreditSatisfaction({
      optionGroup,
    }).fullySatisfied;
  }

  const selectionCount = Math.max(1, Math.ceil(Number(optionGroup.selectionCount ?? 1) || 1));
  const resolvedSatisfiedOptionCount =
    getSuggestedQuarterCourseOptionGroupResolvedOptionIds(optionGroup).length;
  if (resolvedSatisfiedOptionCount >= selectionCount) {
    return true;
  }
  if (optionGroup.isSelectionPrompt || optionGroup.selectionSource === "default") {
    return false;
  }

  return resolvedSatisfiedOptionCount >= selectionCount;
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
  const countedCreditIdentityKeys = new Set<string>();

  for (const quarter of input.quarters) {
    for (const course of quarter.courses) {
      const creditIdentityKeys = getSuggestedQuarterCourseCreditIdentityKeys(course);
      const shouldCountCredits =
        creditIdentityKeys.length === 0 ||
        !creditIdentityKeys.some((identityKey) => countedCreditIdentityKeys.has(identityKey));
      if (!shouldCountCredits) {
        continue;
      }
      for (const identityKey of creditIdentityKeys) {
        countedCreditIdentityKeys.add(identityKey);
      }

      const rawCourseCreditRange = getSuggestedQuarterCourseCreditRange(course);
      const courseCreditRange =
        course.optionGroup?.isSelectionPrompt &&
        !isSuggestedQuarterOptionGroupResolved(course.optionGroup)
          ? isSuggestedQuarterCreditBasedOptionGroup(course.optionGroup) &&
            extractCourseCodes(course.label).length > 0
            ? rawCourseCreditRange
            : {
                creditMin: 0,
                creditMax: rawCourseCreditRange.creditMax,
              }
          : rawCourseCreditRange;
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
  const baseOptions = [item.grcCourses, ...(item.alternatives ?? [])]
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

  if (item.requirementGroup?.requirementType !== "choose_one") {
    return baseOptions;
  }

  const hasMultiCourseGrcOption = (item.requirementGroup.options ?? []).some(
    (option) =>
      unique(
        (option.grcMatches ?? []).flatMap((label) => extractCourseCodes(label))
      ).length > 1
  );
  if (hasMultiCourseGrcOption) {
    return baseOptions;
  }

  const allRequirementGroupOptionLabels = unique(
    (item.requirementGroup.options ?? [])
      .flatMap((option) => getRequirementOptionCourseLabels(option))
      .map((label) => String(label ?? "").trim())
      .filter(Boolean)
  );
  if (!allRequirementGroupOptionLabels.length) {
    return baseOptions;
  }

  return uniqueBy(
    [...baseOptions, allRequirementGroupOptionLabels],
    (courseLabels) => courseLabels.join("||")
  );
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
      .filter((item) => shouldAllowSourceScopedRequiredChecklistItem(plan, item))
      .map((item) =>
        buildSourceBackedRequiredCourseDescriptorForItem({
          item,
          bucket: "application",
          completedByCode,
        })
      )
      .filter((descriptor) => descriptor !== null),
    ...plan.beforeEnrollmentChecklist
      .filter((item) => shouldAllowSourceScopedRequiredChecklistItem(plan, item))
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
    if (sourceBackedDescriptorLooksLikeTrueOption(descriptor)) {
      continue;
    }

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
      if (!normalizedCourseCode) {
        continue;
      }

      const requiredEquivalentUwCourseCodes = buildBestRequiredUwEquivalentCourseCodes(
        normalizedCourseCode,
        plan,
        requiredUwCourseCodes
      );
      const mapsToSourceBackedRequiredUwCourse = requiredEquivalentUwCourseCodes.some((targetCourseCode) =>
        requiredUwCourseCodes.has(targetCourseCode)
      );
      if (
        existingDescriptorCourseCodes.has(normalizedCourseCode) &&
        !mapsToSourceBackedRequiredUwCourse
      ) {
        continue;
      }
      if (
        choiceOnlyCourseCodes.has(normalizedCourseCode) &&
        !mapsToSourceBackedRequiredUwCourse
      ) {
        continue;
      }
      if (
        hasCurrentComputingPrepSequence(existingDescriptorCourseCodes) &&
        isLegacyComputingPrepFallback(normalizedCourseCode)
      ) {
        continue;
      }
      if (!requiredEquivalentUwCourseCodes.some((targetCourseCode) => requiredUwCourseCodes.has(targetCourseCode))) {
        continue;
      }
      if (
        requiredEquivalentUwCourseCodes.length &&
        requiredEquivalentUwCourseCodes.every((targetCourseCode) => isCoveredRequiredUwCourseCode(targetCourseCode))
      ) {
        continue;
      }

      descriptors.push(
        buildSourceBackedRequiredCourseFallbackDescriptor({ courseCode: normalizedCourseCode })
      );
      existingDescriptorCourseCodes.add(normalizedCourseCode);
      markCoveredRequiredUwCourseCodes(
        buildRequiredUwCourseCodesCompletedBySourceCourse(
          normalizedCourseCode,
          plan,
          requiredUwCourseCodes
        )
      );
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
  const requiredUwCourseCodes = getSourceBackedRequiredUwCourseCodeSet(plan);

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
        (
          choiceOnlyCourseCodes.has(normalizedCourseCode) &&
          !courseMapsToSourceBackedRequiredUwCourse({
            courseCode: normalizedCourseCode,
            plan,
            campusId: plan.campusId,
            requiredUwCourseCodes,
          })
        )
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
  if (isRequirementCategoryOption(option)) {
    return getRequirementCategoryOptionLabel(option);
  }

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
  if (isRequirementCategoryOption(option)) {
    return "";
  }

  return normalizeCourseCode(
    option.uwCourses?.[0] ??
      option.equivalentUwCourseCodes?.[0] ??
      option.grcMatches?.[0] ??
      getRequirementOptionDisplayCourseCode(option)
  );
}

function getRequirementOptionUwLabel(option: RequirementGroupOption) {
  if (isRequirementCategoryOption(option)) {
    return "";
  }

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
  if (isRequirementCategoryOption(option)) {
    return getRequirementCategoryOptionLabel(option);
  }

  const grcCourseCodes = getRequirementOptionCourseCodeLabel(option.grcMatches ?? []);
  if (grcCourseCodes) {
    const firstGrcMatch = option.grcMatches?.[0] ?? grcCourseCodes;
    const displayLabel = buildSourceBackedRequiredCourseDisplayLabel(firstGrcMatch);
    return grcCourseCodes.includes(" / ") ? grcCourseCodes : displayLabel;
  }

  return getRequirementOptionUwLabel(option) || option.label || getRequirementOptionDisplayCourseCode(option);
}

function getRequirementOptionSelectedLabel(option: RequirementGroupOption) {
  if (isRequirementCategoryOption(option)) {
    return getRequirementCategoryOptionLabel(option);
  }

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
    sourceRequirementGroupId: course.sourceRequirementGroupId,
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
      const canonicalCreditRange =
        getCanonicalGrcCourseCreditRangeForCourseCodes(optionCourseCodes);
      const optionCreditAmount =
        canonicalCreditRange?.creditAmount ??
        slotCreditAmount ??
        inferSuggestedCourseCreditAmount(optionLabel, optionCourseCodes);
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
        creditMin: canonicalCreditRange?.creditMin ?? optionCreditAmount,
        creditMax: canonicalCreditRange?.creditMax ?? optionCreditAmount,
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
      const canonicalCreditRange =
        getCanonicalGrcCourseCreditRangeForCourseCodes(courseCodes);
      const creditAmount =
        canonicalCreditRange?.creditAmount ??
        (selectionCount === 1
          ? input.groupedChoice.requiredCredits ?? (inferredCreditAmount > 0 ? inferredCreditAmount : null)
          : inferredCreditAmount > 0
            ? inferredCreditAmount
            : null);

      return {
        id: option.id,
        label: option.label,
        selectedLabel: option.label,
        courseLabels,
        courseCodes,
        guidanceSummary: null,
        creditAmount,
        creditMin: canonicalCreditRange?.creditMin ?? creditAmount,
        creditMax: canonicalCreditRange?.creditMax ?? creditAmount,
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
  const normalizedCs141Code = normalizeCourseCode("CS& 141");
  const normalizedCs145Code = normalizeCourseCode("CS 145");
  const normalizedMath151Code = normalizeCourseCode("MATH& 151");
  const normalizedMath238Code = normalizeCourseCode("MATH 238");
  const normalizedMath264Code = normalizeCourseCode("MATH& 264");

  if (actionableCourseCodes.has(normalizedCs123Code)) {
    addCourseRequirementPath(requirementMap, normalizedCs123Code, [normalizedCs122Code]);
    addCourseRequirementPath(requirementMap, normalizedCs122Code, [normalizedCs121Code]);
  } else if (actionableCourseCodes.has(normalizedCs122Code)) {
    addCourseRequirementPath(requirementMap, normalizedCs122Code, [normalizedCs121Code]);
  }

  if (
    plan?.id === UW_SEATTLE_COMPUTER_ENGINEERING_PLAN_ID &&
    actionableCourseCodes.has(normalizedCs145Code)
  ) {
    addCourseRequirementPath(requirementMap, normalizedCs145Code, [
      normalizedCs141Code,
      normalizedMath151Code,
    ]);
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
  if (!optionGroup) {
    return [] as string[];
  }

  const selectedOptionIds =
    optionGroup.resolvedSatisfiedOptionIds !== undefined
      ? optionGroup.resolvedSatisfiedOptionIds
      : optionGroup.selectedOptionIds;
  if (!selectedOptionIds.length) {
    return [] as string[];
  }

  const selectedOptionIdSet = new Set(selectedOptionIds);
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

function getSuggestedQuarterCourseCreditIdentityKeys(course: SuggestedQuarterCourse) {
  const optionGroupSatisfyingCourseCodes =
    course.optionGroup?.isSelectionPrompt && course.optionGroup.countedSatisfyingCourseCodes?.length
      ? course.optionGroup.countedSatisfyingCourseCodes
      : [];
  const courseCodes = sortCourseCodes(
    [
      ...getSuggestedQuarterCourseSatisfyingCourseCodes(course),
      ...optionGroupSatisfyingCourseCodes,
    ]
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );

  if (courseCodes.length) {
    return courseCodes.map((courseCode) => `grc:${courseCode}`);
  }

  const fallbackKey = String(course.instanceKey ?? course.label ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return fallbackKey ? [`placeholder:${fallbackKey}`] : [];
}

function getRequirementOptionAllCourseCodes(option: RequirementGroupOption | SuggestedQuarterCourseOption) {
  if (isRequirementCategoryOption(option)) {
    return [] as string[];
  }

  const optionCourseLabels =
    "courseLabels" in option
      ? option.courseLabels
      : getRequirementOptionCourseLabels(option);
  return sortCourseCodes(
    [
      ...("courseCodes" in option ? option.courseCodes ?? [] : []),
      ...optionCourseLabels.flatMap((label) => extractCourseCodes(label)),
      ...("grcMatches" in option ? option.grcMatches ?? [] : []).flatMap((label) =>
        extractCourseCodes(label)
      ),
    ]
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function getOptionIdsSatisfiedByCourseCodes(
  optionGroup: SuggestedQuarterCourseOptionGroup,
  courseCodes: Set<string>
) {
  if (!courseCodes.size) {
    return [] as string[];
  }

  return optionGroup.options
    .filter((option) =>
      getRequirementOptionAllCourseCodes(option).some((courseCode) =>
        courseCodes.has(courseCode)
      )
    )
    .map((option) => option.id);
}

function getCategoryOptionIds(optionGroup: SuggestedQuarterCourseOptionGroup) {
  return optionGroup.options
    .filter((option) => isRequirementCategoryOption(option))
    .map((option) => option.id);
}

function getConcreteOptionIds(optionGroup: SuggestedQuarterCourseOptionGroup, optionIds: string[]) {
  const categoryOptionIds = new Set(getCategoryOptionIds(optionGroup));
  return optionIds.filter((optionId) => !categoryOptionIds.has(optionId));
}

function getCompletedCourseCodesSatisfyingCategoryOption(input: {
  option: SuggestedQuarterCourseOption;
  completedCourses: TranscriptCourseEntry[];
  campusId?: TransferPlannerMajorPlan["campusId"] | null;
  consumedCompletedCourseCodes?: Set<string>;
}) {
  const tag = normalizeGeneralEducationRequirementTag(input.option.categoryOption?.category);
  if (!tag || !input.campusId) {
    return [] as string[];
  }

  return sortCourseCodes(
    getCompletedCourseCodesMatchingCategoryOption({
      option: input.option,
      completedCourses: input.completedCourses,
      campusId: input.campusId,
    }).filter((courseCode) => !input.consumedCompletedCourseCodes?.has(courseCode))
  );
}

function getCompletedCourseCodesMatchingCategoryOption(input: {
  option: SuggestedQuarterCourseOption;
  completedCourses: TranscriptCourseEntry[];
  campusId?: TransferPlannerMajorPlan["campusId"] | null;
}) {
  if (
    isComputerEngineeringApprovedNaturalScienceCategory(
      input.option.categoryOption?.category ?? input.option.categoryOption?.sourceCategoryCode
    )
  ) {
    return getCompletedCourseCodesMatchingComputerEngineeringApprovedNaturalScience(input);
  }

  const tag = normalizeGeneralEducationRequirementTag(input.option.categoryOption?.category);
  if (!tag || !input.campusId) {
    return [] as string[];
  }

  return sortCourseCodes(
    input.completedCourses
      .map((course) => normalizeCourseCode(course.code))
      .filter(Boolean)
      .filter((courseCode) =>
        getTransferPlannerEquivalencyRulesForSourceCourse(courseCode)
          .filter((rule) => rule.targetSchoolIds.includes(input.campusId!))
          .filter((rule) => !rule.isObsoleteSourceCourse)
          .filter((rule) => rule.acceptanceCategory !== "no-credit")
          .some((rule) => getEvaluationTargetRequirementTags(rule).includes(tag))
      )
  );
}

function getRequiredMatchedCompletedCourseReasons(input: {
  statuses?: TransferRequirementStatus[];
  currentGroupId?: string | null;
}) {
  const reasonsByCourseCode = new Map<string, string[]>();

  for (const status of input.statuses ?? []) {
    const statusGroupId = status.item.requirementGroup?.id ?? null;
    if (statusGroupId && statusGroupId === input.currentGroupId) {
      continue;
    }
    if (isChoiceRequirementStatus(status)) {
      continue;
    }

    const requirementLabel = status.item.title || status.item.id;
    for (const course of status.matchedCourses ?? []) {
      const courseCode = normalizeCourseCode(course.code);
      if (!courseCode) {
        continue;
      }
      reasonsByCourseCode.set(courseCode, [
        ...(reasonsByCourseCode.get(courseCode) ?? []),
        `already consumed by required row ${requirementLabel}`,
      ]);
    }
  }

  return reasonsByCourseCode;
}

function resolveCategoryOptionTranscriptSatisfaction(input: {
  optionGroup: SuggestedQuarterCourseOptionGroup;
  option: SuggestedQuarterCourseOption;
  completedCourses?: TranscriptCourseEntry[];
  campusId?: TransferPlannerMajorPlan["campusId"] | null;
  requiredMatchedCompletedCourseReasons?: Map<string, string[]>;
}): CategoryTranscriptSatisfactionResolution {
  const completedCandidateCourses = getCompletedCourseCodesMatchingCategoryOption({
    option: input.option,
    completedCourses: input.completedCourses ?? [],
    campusId: input.campusId,
  });
  const rejectedCandidateCourses: string[] = [];
  let chosenTranscriptSatisfier: string | null = null;
  let chosenSatisfierAlreadyUsedByRequiredRow = false;

  for (const courseCode of completedCandidateCourses) {
    const rejectionReasons = input.requiredMatchedCompletedCourseReasons?.get(courseCode) ?? [];
    if (rejectionReasons.length) {
      rejectedCandidateCourses.push(`${courseCode}: ${rejectionReasons.join("; ")}`);
      continue;
    }

    chosenTranscriptSatisfier = courseCode;
    break;
  }

  if (!chosenTranscriptSatisfier && completedCandidateCourses.length) {
    const fallbackCourseCode = completedCandidateCourses[0] ?? null;
    if (fallbackCourseCode) {
      chosenTranscriptSatisfier = null;
      chosenSatisfierAlreadyUsedByRequiredRow = Boolean(
        input.requiredMatchedCompletedCourseReasons?.has(fallbackCourseCode)
      );
    }
  }

  return {
    groupId: input.optionGroup.id,
    optionId: input.option.id,
    optionGroup: input.optionGroup,
    categoryOptionLabel: getRequirementCategoryOptionLabel(input.option),
    category:
      input.option.categoryOption?.sourceCategoryCode ??
      input.option.categoryOption?.category ??
      "",
    creditsRequired: input.option.categoryOption?.credits ?? input.option.creditMax ?? null,
    completedCandidateCourses,
    rejectedCandidateCourses,
    chosenTranscriptSatisfier,
    chosenSatisfierAlreadyUsedByRequiredRow,
  };
}

function buildSelectedCategoryTranscriptSatisfactionResolutions(input: {
  plan?: TransferPlannerMajorPlan | null;
  completedCourses?: TranscriptCourseEntry[];
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
  statuses?: TransferRequirementStatus[];
}) {
  if (!input.plan) {
    return [] as CategoryTranscriptSatisfactionResolution[];
  }

  const resolutions: CategoryTranscriptSatisfactionResolution[] = [];
  for (const item of getTransferPlannerPlanChecklistItems(input.plan)) {
    if (!item.requirementGroup?.options.length) {
      continue;
    }

    const selectedOptionIds = getPlannerSelectedRequirementOptionIdsForScheduling({
      item,
      selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
      plan: input.plan,
    });
    if (!selectedOptionIds.length) {
      continue;
    }

    const selectionSource = hasExplicitPlannerSelectedRequirementOptionIds(
      item,
      input.selectedRequirementOptionIdsByGroup
    )
      ? "student"
      : "default";
    const optionGroup = buildSuggestedQuarterCourseOptionGroup({
      item,
      selectedOptionIds,
      isSelectionPrompt: false,
      selectionSource,
      campusId: input.plan.campusId,
    });
    if (!optionGroup) {
      continue;
    }

    const selectedOptionIdSet = new Set(optionGroup.selectedOptionIds);
    const requiredMatchedReasons = getRequiredMatchedCompletedCourseReasons({
      statuses: input.statuses,
      currentGroupId: optionGroup.id,
    });

    for (const option of optionGroup.options) {
      if (!selectedOptionIdSet.has(option.id) || !isRequirementCategoryOption(option)) {
        continue;
      }

      resolutions.push(
        resolveCategoryOptionTranscriptSatisfaction({
          optionGroup,
          option,
          completedCourses: input.completedCourses,
          campusId: input.plan.campusId,
          requiredMatchedCompletedCourseReasons: requiredMatchedReasons,
        })
      );
    }
  }

  return resolutions;
}

function buildCompletedCategoryOptionSatisfaction(input: {
  optionGroup: SuggestedQuarterCourseOptionGroup;
  completedCourses?: TranscriptCourseEntry[];
  campusId?: TransferPlannerMajorPlan["campusId"] | null;
  consumedCompletedCourseCodes?: Set<string>;
}) {
  const optionIds: string[] = [];
  const courseCodes: string[] = [];
  const courseCodesByOptionId: Record<string, string[]> = {};

  for (const option of input.optionGroup.options) {
    if (!isRequirementCategoryOption(option)) {
      continue;
    }

    const satisfyingCourseCodes = getCompletedCourseCodesSatisfyingCategoryOption({
      option,
      completedCourses: input.completedCourses ?? [],
      campusId: input.campusId,
      consumedCompletedCourseCodes: input.consumedCompletedCourseCodes,
    });
    const [chosenSatisfyingCourseCode] = satisfyingCourseCodes;
    if (!chosenSatisfyingCourseCode) {
      continue;
    }

    optionIds.push(option.id);
    courseCodes.push(chosenSatisfyingCourseCode);
    courseCodesByOptionId[option.id] = [chosenSatisfyingCourseCode];
  }

  return {
    optionIds: getSuggestedScheduleUniqueIds(optionIds),
    courseCodes: sortCourseCodes(unique(courseCodes)),
    courseCodesByOptionId,
  };
}

function addOptionSatisfactionSources(
  sourcesByOptionId: Map<string, SuggestedQuarterOptionSatisfactionSource[]>,
  optionIds: string[],
  source: SuggestedQuarterOptionSatisfactionSource
) {
  for (const optionId of optionIds) {
    const normalizedOptionId = String(optionId ?? "").trim();
    if (!normalizedOptionId) {
      continue;
    }

    const existingSources = sourcesByOptionId.get(normalizedOptionId) ?? [];
    if (!existingSources.includes(source)) {
      sourcesByOptionId.set(normalizedOptionId, [...existingSources, source]);
    }
  }
}

const OPTION_SATISFACTION_SOURCE_PRIORITY: Record<
  SuggestedQuarterOptionSatisfactionSource,
  number
> = {
  "user-selected": 0,
  "transcript-completed": 1,
  "planner-defaulted": 2,
  "scheduled-and-counted": 3,
};

type OptionGroupSatisfactionCandidateResolution = {
  candidateSatisfiedOptionIds: string[];
  candidateOptionSatisfactionSourcesById: Record<
    string,
    SuggestedQuarterOptionSatisfactionSource[]
  >;
  completedSatisfyingCourseCodes: string[];
  completedSatisfyingCourseCodesByOptionId: Record<string, string[]>;
  scheduledSatisfyingCourseCodes: string[];
  acceptedCourseCodes: string[];
  categoryOptionLabels: string[];
};

type OptionGroupAllocationContext = OptionGroupSatisfactionCandidateResolution & {
  fingerprint: string;
  optionGroup: SuggestedQuarterCourseOptionGroup;
  planOrder: number;
  acceptedOptionIds: string[];
  acceptedCourseIdentityCount: number;
  overlappingGroups: string[];
};

type CategoryTranscriptSatisfactionResolution = {
  groupId: string;
  optionId: string;
  optionGroup: SuggestedQuarterCourseOptionGroup;
  categoryOptionLabel: string;
  category: string;
  creditsRequired: number | null;
  completedCandidateCourses: string[];
  rejectedCandidateCourses: string[];
  chosenTranscriptSatisfier: string | null;
  chosenSatisfierAlreadyUsedByRequiredRow: boolean;
};

function getSuggestedQuarterOptionGroupRequiredCount(
  optionGroup: SuggestedQuarterCourseOptionGroup
) {
  return Math.max(1, Math.ceil(Number(optionGroup.selectionCount ?? 1) || 1));
}

function getOptionSatisfactionSourceRank(
  sources: SuggestedQuarterOptionSatisfactionSource[] | null | undefined
) {
  return Math.min(
    ...((sources?.length ? sources : ["scheduled-and-counted"]) as SuggestedQuarterOptionSatisfactionSource[]).map(
      (source) => OPTION_SATISFACTION_SOURCE_PRIORITY[source] ?? 99
    )
  );
}

function getOptionGroupOptionIndexMap(optionGroup: SuggestedQuarterCourseOptionGroup) {
  return new Map(optionGroup.options.map((option, index) => [option.id, index]));
}

function sortOptionIdsBySatisfactionPriority(input: {
  optionGroup: SuggestedQuarterCourseOptionGroup;
  optionIds: string[];
  sourcesByOptionId: Record<string, SuggestedQuarterOptionSatisfactionSource[]>;
}) {
  const optionIndexById = getOptionGroupOptionIndexMap(input.optionGroup);
  return getSuggestedScheduleUniqueIds(input.optionIds)
    .filter((optionId) => optionIndexById.has(optionId))
    .sort((left, right) => {
      const leftRank = getOptionSatisfactionSourceRank(input.sourcesByOptionId[left]);
      const rightRank = getOptionSatisfactionSourceRank(input.sourcesByOptionId[right]);
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      const leftIndex = optionIndexById.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = optionIndexById.get(right) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left.localeCompare(right);
    });
}

function filterOptionSatisfactionSourcesByIds(
  sourcesByOptionId: Record<string, SuggestedQuarterOptionSatisfactionSource[]>,
  optionIds: string[]
) {
  const optionIdSet = new Set(optionIds);
  return Object.fromEntries(
    Object.entries(sourcesByOptionId).filter(([optionId]) => optionIdSet.has(optionId))
  );
}

function filterOptionCourseCodesByIds(
  courseCodesByOptionId: Record<string, string[]>,
  optionIds: string[]
) {
  const optionIdSet = new Set(optionIds);
  return Object.fromEntries(
    Object.entries(courseCodesByOptionId)
      .filter(([optionId]) => optionIdSet.has(optionId))
      .map(([optionId, courseCodes]) => [optionId, sortCourseCodes(courseCodes)])
  );
}

function getOptionGroupAcceptedCourseCodes(optionGroup: SuggestedQuarterCourseOptionGroup) {
  return sortCourseCodes(
    optionGroup.options
      .flatMap((option) => getRequirementOptionAllCourseCodes(option))
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function getSatisfiedCourseCodesForOptionIds(input: {
  optionGroup: SuggestedQuarterCourseOptionGroup;
  optionIds: string[];
  courseCodes: Set<string>;
  completedCourses?: TranscriptCourseEntry[];
  campusId?: TransferPlannerMajorPlan["campusId"] | null;
  consumedCompletedCourseCodes?: Set<string>;
}) {
  const optionIdSet = new Set(input.optionIds);
  return sortCourseCodes(
    input.optionGroup.options
      .filter((option) => optionIdSet.has(option.id))
      .flatMap((option) =>
        isRequirementCategoryOption(option)
          ? getCompletedCourseCodesSatisfyingCategoryOption({
              option,
              completedCourses: input.completedCourses ?? [],
              campusId: input.campusId,
              consumedCompletedCourseCodes: input.consumedCompletedCourseCodes,
            }).slice(0, 1)
          : getRequirementOptionAllCourseCodes(option)
      )
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter((courseCode) => Boolean(courseCode && input.courseCodes.has(courseCode)))
  );
}

function buildSuggestedQuarterOptionGroupSatisfactionCandidates(input: {
  optionGroup: SuggestedQuarterCourseOptionGroup;
  completedCourseCodes: Set<string>;
  scheduledCourseCodes: Set<string>;
  completedCourses?: TranscriptCourseEntry[];
  campusId?: TransferPlannerMajorPlan["campusId"] | null;
  consumedCompletedCourseCodes?: Set<string>;
}): OptionGroupSatisfactionCandidateResolution {
  const userOrDefaultSelectedOptionIds = getSuggestedScheduleUniqueIds(
    input.optionGroup.selectedOptionIds
  );
  const completedSatisfiedOptionIds = getOptionIdsSatisfiedByCourseCodes(
    input.optionGroup,
    input.completedCourseCodes
  );
  const categoryCompletedSatisfaction = buildCompletedCategoryOptionSatisfaction({
    optionGroup: input.optionGroup,
    completedCourses: input.completedCourses,
    campusId: input.campusId,
    consumedCompletedCourseCodes: input.consumedCompletedCourseCodes,
  });
  const scheduledSatisfiedOptionIds = getOptionIdsSatisfiedByCourseCodes(
    input.optionGroup,
    input.scheduledCourseCodes
  );
  const optionIds = new Set(input.optionGroup.options.map((option) => option.id));
  const sourcesByOptionId = new Map<string, SuggestedQuarterOptionSatisfactionSource[]>();
  if (userOrDefaultSelectedOptionIds.length) {
    addOptionSatisfactionSources(
      sourcesByOptionId,
      userOrDefaultSelectedOptionIds,
      input.optionGroup.selectionSource === "default"
        ? "planner-defaulted"
        : "user-selected"
    );
  }
  addOptionSatisfactionSources(
    sourcesByOptionId,
    [...completedSatisfiedOptionIds, ...categoryCompletedSatisfaction.optionIds],
    "transcript-completed"
  );
  addOptionSatisfactionSources(
    sourcesByOptionId,
    scheduledSatisfiedOptionIds,
    "scheduled-and-counted"
  );
  const candidateOptionSatisfactionSourcesById = Object.fromEntries(
    [...sourcesByOptionId.entries()]
      .filter(([optionId]) => optionIds.has(optionId))
      .map(([optionId, sources]) => [optionId, sources])
  );
  const candidateSatisfiedOptionIds = sortOptionIdsBySatisfactionPriority({
    optionGroup: input.optionGroup,
    optionIds: Object.keys(candidateOptionSatisfactionSourcesById),
    sourcesByOptionId: candidateOptionSatisfactionSourcesById,
  });
  const acceptedCourseCodes = getOptionGroupAcceptedCourseCodes(input.optionGroup);
  const acceptedCourseCodeSet = new Set(acceptedCourseCodes);
  const completedSatisfyingCourseCodes = sortCourseCodes(
    [
      ...[...input.completedCourseCodes].filter((courseCode) =>
        acceptedCourseCodeSet.has(courseCode)
      ),
      ...categoryCompletedSatisfaction.courseCodes,
    ]
  );
  const completedSatisfyingCourseCodesByOptionId: Record<string, string[]> = {};
  for (const option of input.optionGroup.options) {
    const courseCodesForOption = [
      ...getRequirementOptionAllCourseCodes(option).filter((courseCode) =>
        input.completedCourseCodes.has(courseCode)
      ),
      ...(categoryCompletedSatisfaction.courseCodesByOptionId[option.id] ?? []),
    ];
    const normalizedCourseCodes = sortCourseCodes(
      unique(
        courseCodesForOption
          .map((courseCode) => normalizeCourseCode(courseCode))
          .filter(Boolean)
      )
    );
    if (normalizedCourseCodes.length) {
      completedSatisfyingCourseCodesByOptionId[option.id] = normalizedCourseCodes;
    }
  }
  const scheduledSatisfyingCourseCodes = sortCourseCodes(
    [...input.scheduledCourseCodes].filter((courseCode) => acceptedCourseCodeSet.has(courseCode))
  );

  return {
    candidateSatisfiedOptionIds,
    candidateOptionSatisfactionSourcesById,
    completedSatisfyingCourseCodes,
    completedSatisfyingCourseCodesByOptionId,
    scheduledSatisfyingCourseCodes,
    acceptedCourseCodes,
    categoryOptionLabels: input.optionGroup.options
      .filter((option) => isRequirementCategoryOption(option))
      .map((option) => getRequirementCategoryOptionLabel(option))
      .filter(Boolean),
  };
}

function getOptionGroupFingerprint(optionGroup: SuggestedQuarterCourseOptionGroup) {
  return JSON.stringify({
    id: optionGroup.id,
    selectionCount: optionGroup.selectionCount,
    requiredCredits: optionGroup.requiredCredits ?? null,
    maxRequiredCredits: optionGroup.maxRequiredCredits ?? null,
    selectionSource: optionGroup.selectionSource ?? null,
    allowExtraResolvedSelections: optionGroup.allowExtraResolvedSelections === true,
    selectedOptionIds: optionGroup.selectedOptionIds,
    options: optionGroup.options.map((option) => [
      option.id,
      getRequirementOptionAllCourseCodes(option),
      option.optionKind ?? "course",
      option.categoryOption ?? null,
    ]),
  });
}

function collectSuggestedPlanOptionGroupsForAllocation(
  suggestedPlan: SuggestedQuarterPlan[]
) {
  const optionGroups: SuggestedQuarterCourseOptionGroup[] = [];
  const seenFingerprints = new Set<string>();

  for (const course of suggestedPlan.flatMap((quarter) => quarter.courses)) {
    const optionGroup = course.optionGroup ?? null;
    if (!optionGroup) {
      continue;
    }

    const fingerprint = getOptionGroupFingerprint(optionGroup);
    if (seenFingerprints.has(fingerprint)) {
      continue;
    }

    seenFingerprints.add(fingerprint);
    optionGroups.push(optionGroup);
  }

  return optionGroups;
}

function buildOptionGroupOverlapMap(contexts: OptionGroupAllocationContext[]) {
  const overlapMap = new Map<string, string[]>();

  for (const context of contexts) {
    const contextOptionIdSet = new Set(context.acceptedOptionIds);
    const contextCourseCodeSet = new Set(context.acceptedCourseCodes);
    const overlappingGroups = contexts
      .filter((candidate) => candidate.fingerprint !== context.fingerprint)
      .filter((candidate) => {
        const sharesOptionId = candidate.acceptedOptionIds.some((optionId) =>
          contextOptionIdSet.has(optionId)
        );
        const sharesCourseCode = candidate.acceptedCourseCodes.some((courseCode) =>
          contextCourseCodeSet.has(courseCode)
        );
        return sharesOptionId || sharesCourseCode;
      })
      .map((candidate) => candidate.optionGroup.id);

    overlapMap.set(context.fingerprint, unique(overlappingGroups));
  }

  return overlapMap;
}

function compareOptionGroupAllocationSpecificity(
  left: OptionGroupAllocationContext,
  right: OptionGroupAllocationContext
) {
  const optionCountDelta = left.acceptedOptionIds.length - right.acceptedOptionIds.length;
  if (optionCountDelta !== 0) {
    return optionCountDelta;
  }

  const courseIdentityDelta =
    left.acceptedCourseIdentityCount - right.acceptedCourseIdentityCount;
  if (courseIdentityDelta !== 0) {
    return courseIdentityDelta;
  }

  const requiredCountDelta =
    getSuggestedQuarterOptionGroupRequiredCount(left.optionGroup) -
    getSuggestedQuarterOptionGroupRequiredCount(right.optionGroup);
  if (requiredCountDelta !== 0) {
    return requiredCountDelta;
  }

  return left.planOrder - right.planOrder;
}

function optionSatisfactionCanBypassScheduledClaims(
  sources: SuggestedQuarterOptionSatisfactionSource[] | null | undefined
) {
  const sourceSet = new Set(sources ?? []);
  return (
    sourceSet.has("user-selected") ||
    sourceSet.has("transcript-completed") ||
    sourceSet.has("planner-defaulted")
  );
}

function getScheduledClaimCourseCodesForOption(input: {
  optionGroup: SuggestedQuarterCourseOptionGroup;
  optionId: string;
  scheduledCourseCodes: Set<string>;
}) {
  const option = input.optionGroup.options.find((candidate) => candidate.id === input.optionId);
  if (!option) {
    return [] as string[];
  }

  return sortCourseCodes(
    getRequirementOptionAllCourseCodes(option).filter((courseCode) =>
      input.scheduledCourseCodes.has(courseCode)
    )
  );
}

function allocateDisplayedCreditBasedOptionIdsForGroup(input: {
  context: OptionGroupAllocationContext;
  scheduledCourseCodes: Set<string>;
  claimedScheduledCourseCodes: Set<string>;
}) {
  const { context } = input;
  const requiredCredits =
    getSuggestedQuarterOptionGroupRequiredCreditRange(context.optionGroup).creditMin ?? 0;
  const candidateOptionIds = context.candidateSatisfiedOptionIds;
  const selectedOptionIds: string[] = [];

  const getSelectedCredits = () =>
    getSuggestedQuarterOptionGroupSatisfyingCreditRange({
      optionGroup: context.optionGroup,
      optionIds: selectedOptionIds,
    }).creditMax ?? 0;
  const addOptionId = (optionId: string) => {
    if (selectedOptionIds.includes(optionId)) {
      return;
    }
    selectedOptionIds.push(optionId);
  };
  const addEligibleOptions = (options: string[]) => {
    for (const optionId of options) {
      addOptionId(optionId);
      if (requiredCredits > 0 && getSelectedCredits() >= requiredCredits) {
        break;
      }
    }
  };

  addEligibleOptions(
    candidateOptionIds.filter((optionId) =>
      optionSatisfactionCanBypassScheduledClaims(
        context.candidateOptionSatisfactionSourcesById[optionId]
      )
    )
  );
  if (requiredCredits > 0 && getSelectedCredits() >= requiredCredits) {
    return selectedOptionIds;
  }

  addEligibleOptions(
    candidateOptionIds.filter((optionId) => {
      const sources = context.candidateOptionSatisfactionSourcesById[optionId] ?? [];
      if (optionSatisfactionCanBypassScheduledClaims(sources)) {
        return false;
      }

      const scheduledClaimCourseCodes = getScheduledClaimCourseCodesForOption({
        optionGroup: context.optionGroup,
        optionId,
        scheduledCourseCodes: input.scheduledCourseCodes,
      });
      return !(
        scheduledClaimCourseCodes.length &&
        scheduledClaimCourseCodes.every((courseCode) =>
          input.claimedScheduledCourseCodes.has(courseCode)
        )
      );
    })
  );
  if (requiredCredits > 0 && getSelectedCredits() >= requiredCredits) {
    return selectedOptionIds;
  }

  addEligibleOptions(candidateOptionIds);
  return selectedOptionIds;
}

function allocateDisplayedOptionIdsForGroup(input: {
  context: OptionGroupAllocationContext;
  scheduledCourseCodes: Set<string>;
  claimedScheduledCourseCodes: Set<string>;
}) {
  const { context } = input;
  if (isSuggestedQuarterCreditBasedOptionGroup(context.optionGroup)) {
    return allocateDisplayedCreditBasedOptionIdsForGroup(input);
  }

  const requiredCount = getSuggestedQuarterOptionGroupRequiredCount(context.optionGroup);
  const candidateOptionIds = context.candidateSatisfiedOptionIds;
  if (context.optionGroup.allowExtraResolvedSelections === true) {
    return candidateOptionIds;
  }

  const selectedOptionIds: string[] = [];
  const addOptionId = (optionId: string) => {
    if (selectedOptionIds.length >= requiredCount || selectedOptionIds.includes(optionId)) {
      return;
    }
    selectedOptionIds.push(optionId);
  };

  for (const optionId of candidateOptionIds) {
    const sources = context.candidateOptionSatisfactionSourcesById[optionId] ?? [];
    if (optionSatisfactionCanBypassScheduledClaims(sources)) {
      addOptionId(optionId);
    }
  }

  for (const optionId of candidateOptionIds) {
    const sources = context.candidateOptionSatisfactionSourcesById[optionId] ?? [];
    if (optionSatisfactionCanBypassScheduledClaims(sources)) {
      continue;
    }

    const scheduledClaimCourseCodes = getScheduledClaimCourseCodesForOption({
      optionGroup: context.optionGroup,
      optionId,
      scheduledCourseCodes: input.scheduledCourseCodes,
    });
    if (
      scheduledClaimCourseCodes.length &&
      scheduledClaimCourseCodes.every((courseCode) =>
        input.claimedScheduledCourseCodes.has(courseCode)
      )
    ) {
      continue;
    }

    addOptionId(optionId);
  }

  for (const optionId of candidateOptionIds) {
    addOptionId(optionId);
  }

  return selectedOptionIds;
}

function buildAllocatedOptionGroupResolutionMap(input: {
  optionGroups: SuggestedQuarterCourseOptionGroup[];
  completedCourseCodes: Set<string>;
  scheduledCourseCodes: Set<string>;
  completedCourses?: TranscriptCourseEntry[];
  campusId?: TransferPlannerMajorPlan["campusId"] | null;
  consumedCompletedCourseCodesByGroupId?: Map<string, Set<string>>;
}) {
  const contexts = input.optionGroups.map<OptionGroupAllocationContext>((optionGroup, planOrder) => {
    const candidateResolution = buildSuggestedQuarterOptionGroupSatisfactionCandidates({
      optionGroup,
      completedCourseCodes: input.completedCourseCodes,
      scheduledCourseCodes: input.scheduledCourseCodes,
      completedCourses: input.completedCourses,
      campusId: input.campusId,
      consumedCompletedCourseCodes:
        input.consumedCompletedCourseCodesByGroupId?.get(optionGroup.id) ?? new Set<string>(),
    });
    const acceptedOptionIds = optionGroup.options.map((option) => option.id);

    return {
      ...candidateResolution,
      fingerprint: getOptionGroupFingerprint(optionGroup),
      optionGroup,
      planOrder,
      acceptedOptionIds,
      acceptedCourseIdentityCount: candidateResolution.acceptedCourseCodes.length,
      overlappingGroups: [],
    };
  });
  const overlapMap = buildOptionGroupOverlapMap(contexts);
  for (const context of contexts) {
    context.overlappingGroups = overlapMap.get(context.fingerprint) ?? [];
  }

  const claimedScheduledCourseCodes = new Set<string>();
  const allocatedGroupsByFingerprint = new Map<string, SuggestedQuarterCourseOptionGroup>();
  for (const context of [...contexts].sort(compareOptionGroupAllocationSpecificity)) {
    const resolvedSatisfiedOptionIds = allocateDisplayedOptionIdsForGroup({
      context,
      scheduledCourseCodes: input.scheduledCourseCodes,
      claimedScheduledCourseCodes,
    });
    const droppedSatisfiedOptionIds = context.candidateSatisfiedOptionIds.filter(
      (optionId) => !resolvedSatisfiedOptionIds.includes(optionId)
    );
    const finalOptionCourseCodes = getSatisfiedCourseCodesForOptionIds({
      optionGroup: context.optionGroup,
      optionIds: resolvedSatisfiedOptionIds,
      courseCodes: new Set([...input.completedCourseCodes, ...input.scheduledCourseCodes]),
      completedCourses: input.completedCourses,
      campusId: input.campusId,
      consumedCompletedCourseCodes:
        input.consumedCompletedCourseCodesByGroupId?.get(context.optionGroup.id) ??
        new Set<string>(),
    });
    const creditSatisfaction = isSuggestedQuarterCreditBasedOptionGroup(context.optionGroup)
      ? getSuggestedQuarterOptionGroupCreditSatisfaction({
          optionGroup: context.optionGroup,
          optionIds: resolvedSatisfiedOptionIds,
        })
      : null;

    for (const optionId of resolvedSatisfiedOptionIds) {
      const sources = context.candidateOptionSatisfactionSourcesById[optionId] ?? [];
      if (!sources.includes("scheduled-and-counted")) {
        continue;
      }

      for (const courseCode of getScheduledClaimCourseCodesForOption({
        optionGroup: context.optionGroup,
        optionId,
        scheduledCourseCodes: input.scheduledCourseCodes,
      })) {
        claimedScheduledCourseCodes.add(courseCode);
      }
    }

    allocatedGroupsByFingerprint.set(context.fingerprint, {
      ...context.optionGroup,
      candidateSatisfiedOptionIds: context.candidateSatisfiedOptionIds,
      resolvedSatisfiedOptionIdsBeforeCap: context.candidateSatisfiedOptionIds,
      resolvedSatisfiedOptionIds,
      droppedSatisfiedOptionIds,
      completedSatisfyingCourseCodes: context.completedSatisfyingCourseCodes,
      completedSatisfyingCourseCodesByOptionId: filterOptionCourseCodesByIds(
        context.completedSatisfyingCourseCodesByOptionId,
        resolvedSatisfiedOptionIds
      ),
      scheduledSatisfyingCourseCodes: context.scheduledSatisfyingCourseCodes,
      countedSatisfyingCourseCodes: finalOptionCourseCodes,
      satisfactionMode: creditSatisfaction ? "credit-based" : "selection-count",
      resolvedSatisfyingCreditMin: creditSatisfaction?.creditMin ?? null,
      resolvedSatisfyingCreditMax: creditSatisfaction?.creditMax ?? null,
      displayedCreditProgress: creditSatisfaction?.displayedProgress ?? null,
      fullySatisfied: creditSatisfaction?.fullySatisfied ?? null,
      candidateOptionSatisfactionSourcesById: context.candidateOptionSatisfactionSourcesById,
      optionSatisfactionSourcesById: filterOptionSatisfactionSourcesByIds(
        context.candidateOptionSatisfactionSourcesById,
        resolvedSatisfiedOptionIds
      ),
    });
  }

  return {
    allocatedGroupsByFingerprint,
    contextsByFingerprint: new Map(contexts.map((context) => [context.fingerprint, context])),
  };
}

function resolveSuggestedQuarterOptionGroupSatisfaction(input: {
  optionGroup: SuggestedQuarterCourseOptionGroup;
  completedCourseCodes: Set<string>;
  scheduledCourseCodes: Set<string>;
  completedCourses?: TranscriptCourseEntry[];
  campusId?: TransferPlannerMajorPlan["campusId"] | null;
}) {
  const allocation = buildAllocatedOptionGroupResolutionMap({
    optionGroups: [input.optionGroup],
    completedCourseCodes: input.completedCourseCodes,
    scheduledCourseCodes: input.scheduledCourseCodes,
    completedCourses: input.completedCourses,
    campusId: input.campusId,
  });
  const resolvedOptionGroup =
    allocation.allocatedGroupsByFingerprint.get(getOptionGroupFingerprint(input.optionGroup)) ??
    input.optionGroup;

  return {
    candidateSatisfiedOptionIds: resolvedOptionGroup.candidateSatisfiedOptionIds ?? [],
    resolvedSatisfiedOptionIds: resolvedOptionGroup.resolvedSatisfiedOptionIds ?? [],
    resolvedSatisfiedOptionIdsBeforeCap:
      resolvedOptionGroup.resolvedSatisfiedOptionIdsBeforeCap ?? [],
    droppedSatisfiedOptionIds: resolvedOptionGroup.droppedSatisfiedOptionIds ?? [],
    completedSatisfyingCourseCodes: resolvedOptionGroup.completedSatisfyingCourseCodes ?? [],
    completedSatisfyingCourseCodesByOptionId:
      resolvedOptionGroup.completedSatisfyingCourseCodesByOptionId ?? {},
    scheduledSatisfyingCourseCodes: resolvedOptionGroup.scheduledSatisfyingCourseCodes ?? [],
    countedSatisfyingCourseCodes: resolvedOptionGroup.countedSatisfyingCourseCodes ?? [],
    resolvedSatisfyingCreditMin: resolvedOptionGroup.resolvedSatisfyingCreditMin ?? null,
    resolvedSatisfyingCreditMax: resolvedOptionGroup.resolvedSatisfyingCreditMax ?? null,
    displayedCreditProgress: resolvedOptionGroup.displayedCreditProgress ?? null,
    fullySatisfied: resolvedOptionGroup.fullySatisfied ?? null,
    candidateOptionSatisfactionSourcesById:
      resolvedOptionGroup.candidateOptionSatisfactionSourcesById ?? {},
    optionSatisfactionSourcesById: resolvedOptionGroup.optionSatisfactionSourcesById ?? {},
  };
}

function getSuggestedScheduleUniqueIds(values: string[] | null | undefined) {
  return unique((values ?? []).map((value) => String(value ?? "").trim()).filter(Boolean));
}

function getScheduledPlannerCountedCourseCodeSet(suggestedPlan: SuggestedQuarterPlan[]) {
  return new Set(
    getScheduledPlannerCourses(suggestedPlan)
      .flatMap((course) =>
        course.optionGroup?.isSelectionPrompt
          ? []
          : getSuggestedQuarterCourseSatisfyingCourseCodes(course)
      )
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function buildConsumedCompletedCourseCodesByOptionGroupId(input: {
  statuses?: TransferRequirementStatus[];
}) {
  const statuses = input.statuses ?? [];
  const allMatchedByGroupId = new Map<string, Set<string>>();
  const allMatchedCourseCodes = new Set<string>();

  for (const status of statuses) {
    const groupId = status.item.requirementGroup?.id ?? "none";
    const groupMatchedCourseCodes = allMatchedByGroupId.get(groupId) ?? new Set<string>();
    for (const course of status.matchedCourses ?? []) {
      const courseCode = normalizeCourseCode(course.code);
      if (!courseCode) {
        continue;
      }
      groupMatchedCourseCodes.add(courseCode);
      allMatchedCourseCodes.add(courseCode);
    }
    allMatchedByGroupId.set(groupId, groupMatchedCourseCodes);
  }

  const consumedByGroupId = new Map<string, Set<string>>();
  for (const groupId of allMatchedByGroupId.keys()) {
    const ownMatched = allMatchedByGroupId.get(groupId) ?? new Set<string>();
    consumedByGroupId.set(
      groupId,
      new Set([...allMatchedCourseCodes].filter((courseCode) => !ownMatched.has(courseCode)))
    );
  }

  return consumedByGroupId;
}

function attachResolvedOptionGroupSatisfaction(input: {
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses: TranscriptCourseEntry[];
  plan?: TransferPlannerMajorPlan | null;
  requirementStatuses?: TransferRequirementStatus[];
}) {
  const completedCourseCodes = new Set(
    input.completedCourses.map((course) => normalizeCourseCode(course.code)).filter(Boolean)
  );
  const scheduledCourseCodes = getScheduledPlannerCountedCourseCodeSet(input.suggestedPlan);
  const { allocatedGroupsByFingerprint } = buildAllocatedOptionGroupResolutionMap({
    optionGroups: collectSuggestedPlanOptionGroupsForAllocation(input.suggestedPlan),
    completedCourseCodes,
    scheduledCourseCodes,
    completedCourses: input.completedCourses,
    campusId: input.plan?.campusId,
    consumedCompletedCourseCodesByGroupId: buildConsumedCompletedCourseCodesByOptionGroupId({
      statuses: input.requirementStatuses,
    }),
  });
  const resolveGroup = (optionGroup: SuggestedQuarterCourseOptionGroup | null | undefined) => {
    if (!optionGroup) {
      return optionGroup ?? null;
    }

    return allocatedGroupsByFingerprint.get(getOptionGroupFingerprint(optionGroup)) ?? optionGroup;
  };

  return input.suggestedPlan.map<SuggestedQuarterPlan>((quarter) => ({
    ...quarter,
    courses: quarter.courses.map<SuggestedQuarterCourse>((course) => ({
      ...course,
      optionGroup: resolveGroup(course.optionGroup),
    })),
  }));
}

function attachSelectedCategoryTranscriptSatisfaction(input: {
  suggestedPlan: SuggestedQuarterPlan[];
  plan?: TransferPlannerMajorPlan | null;
  completedCourses: TranscriptCourseEntry[];
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
  requirementStatuses?: TransferRequirementStatus[];
}) {
  const satisfiedCategoryResolutions =
    buildSelectedCategoryTranscriptSatisfactionResolutions({
      plan: input.plan,
      completedCourses: input.completedCourses,
      selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
      statuses: input.requirementStatuses,
    }).filter((resolution) => Boolean(resolution.chosenTranscriptSatisfier));

  if (!satisfiedCategoryResolutions.length) {
    return input.suggestedPlan;
  }

  const resolutionsByCourseCode = new Map<string, CategoryTranscriptSatisfactionResolution[]>();
  const satisfiedCategoryKeys = new Set<string>();
  for (const resolution of satisfiedCategoryResolutions) {
    const courseCode = normalizeCourseCode(resolution.chosenTranscriptSatisfier ?? "");
    if (!courseCode) {
      continue;
    }
    resolutionsByCourseCode.set(courseCode, [
      ...(resolutionsByCourseCode.get(courseCode) ?? []),
      resolution,
    ]);
    satisfiedCategoryKeys.add(`${resolution.groupId}||${resolution.categoryOptionLabel}`);
  }

  return input.suggestedPlan.map<SuggestedQuarterPlan>((quarter) => ({
    ...quarter,
    courses: quarter.courses
      .filter((course) => {
        if (quarter.phase !== "planned" && quarter.phase !== "current") {
          return true;
        }
        const optionGroupId = course.optionGroup?.id ?? "";
        const label = String(course.label ?? "").replace(/\s+/g, " ").trim();
        return !satisfiedCategoryKeys.has(`${optionGroupId}||${label}`);
      })
      .map<SuggestedQuarterCourse>((course) => {
        if (quarter.phase !== "completed") {
          return course;
        }

        const courseCode = normalizeCourseCode(extractCourseCodes(course.label)[0] ?? course.label);
        const [resolution] = resolutionsByCourseCode.get(courseCode) ?? [];
        if (!resolution) {
          return course;
        }

        return {
          ...course,
          optionGroup: course.optionGroup ?? resolution.optionGroup,
          guidanceSummary: joinGuidanceSummaries(
            course.guidanceSummary,
            `${resolution.categoryOptionLabel} is satisfied by this completed transcript course.`
          ),
        };
      }),
  }));
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
  const isCreditBucketRemainderCourse = (course: PendingSuggestedCourse) =>
    course.courseRole === "unresolved-credit-bucket-remainder";
  const isMainPlannedCourse = (course: PendingSuggestedCourse) =>
    (
      course.explicitCourseCodes.length > 0 ||
      isOptionGroupCourse(course) ||
      isCreditBucketRemainderCourse(course)
    ) &&
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
        shouldScheduleRequirementStatusAsPlannerChoiceBucket(status, plan);
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
      const selectedOptionSelectionSource =
        shouldScheduleAsChoiceBucket && selectedOptionIds.length
          ? hasExplicitPlannerSelectedRequirementOptionIds(
              status.item,
              selectedRequirementOptionIdsByGroup
            )
            ? "student"
            : "default"
          : null;
      const selectedOptionGroup = shouldScheduleAsChoiceBucket
        ? buildSuggestedQuarterCourseOptionGroup({
            item: status.item,
            selectedOptionIds,
            isSelectionPrompt: false,
            selectionSource: selectedOptionSelectionSource,
            campusId,
          })
        : null;
      const selectedOptionEntries = selectedOptionGroup
        ? getSelectedRequirementOptionEntriesForPlannerScheduling({
            item: status.item,
            selectedRequirementOptionIdsByGroup,
            campusId,
            plan,
          })
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
          const selectedOptionCreditRange = getRequirementOptionCanonicalGrcCreditRange(
            selectedEntry.option,
            selectedCourseLabels
          );
          const remainingSelectedOptionCreditRange =
            isSuggestedQuarterCreditBasedOptionGroup(selectedOptionGroup) &&
            !isRequirementCategoryOption(selectedEntry.option)
              ? selectedOptionCreditRange
              : getRemainingChooseCreditsRangeForStatus(status, selectedOptionCreditRange);

          if (!selectedCourseLabels.length && isRequirementCategoryOption(selectedEntry.option)) {
            const selectedCategoryLabel =
              getRequirementCategoryOptionLabel(selectedEntry.option) ||
              getRequirementOptionDisplayLabel(selectedEntry.option) ||
              selectedEntry.option.label ||
              status.item.title;
            const categoryGuidanceSummary = buildCategoryOptionGuidanceSummary(
              selectedEntry.option
            );
            const nextCourse: PendingSuggestedCourse = {
              label: selectedCategoryLabel,
              type: "elective",
              status: "planned",
              sourceKind: "uw-major-requirement",
              guidanceSummary: joinGuidanceSummaries(guidanceSummary, categoryGuidanceSummary),
              sequenceGroup: null,
              priorityRank: REQUIREMENT_PRIORITY_RANK[section.bucket],
              sourceOrder,
              explicitCourseCodes: [],
              prerequisiteCourseSets: [],
              corequisiteCourseSets: [],
              optionGroup: isFirstSelectedOptionCourse ? resolvedOptionGroup : null,
              ...remainingSelectedOptionCreditRange,
            };

            addRemainingCourse(nextCourse);
            isFirstSelectedOptionCourse = false;
            continue;
          }

          for (const selectedLabel of selectedCourseLabels) {
            const explicitCourseCodes = extractCourseCodes(selectedLabel);
            const selectedCourseCreditRange =
              selectedCourseLabels.length === 1
                ? remainingSelectedOptionCreditRange
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

        const selectedCreditSatisfaction = isSuggestedQuarterCreditBasedOptionGroup(
          selectedOptionGroup
        )
          ? getSuggestedQuarterOptionGroupCreditSatisfaction({
              optionGroup: selectedOptionGroup,
              optionIds: selectedOptionEntries.map((entry) => entry.optionId),
            })
          : null;
        const selectedCategoryOptionIds = new Set(getCategoryOptionIds(selectedOptionGroup));
        const selectedPlaceholderOption = selectedOptionEntries.some((entry) =>
          selectedCategoryOptionIds.has(entry.optionId)
        );
        if (
          selectedCreditSatisfaction &&
          !selectedCreditSatisfaction.fullySatisfied &&
          selectedCreditSatisfaction.creditMax > 0 &&
          !selectedPlaceholderOption
        ) {
          const remainingCreditRange = getRemainingChooseCreditsRangeAfterSelectedOptions({
            status,
            optionGroup: selectedOptionGroup,
            selectedOptionIds: selectedOptionEntries.map((entry) => entry.optionId),
            fallbackRange: getSuggestedQuarterCourseOptionGroupCreditRange(selectedOptionGroup),
          });
          const remainingCredits =
            getPositiveCreditAmount(remainingCreditRange.creditMax) ??
            getPositiveCreditAmount(remainingCreditRange.creditMin) ??
            0;
          if (remainingCredits > 0) {
            addRemainingCourse(
              buildCreditBucketRemainderPlaceholderCourse({
                status,
                optionGroup: selectedOptionGroup,
                remainingCredits,
                guidanceSummary,
                priorityRank: REQUIREMENT_PRIORITY_RANK[section.bucket],
                sourceOrder,
              })
            );
          }
          continue;
        }
        if (
          selectedCreditSatisfaction?.fullySatisfied ||
          (
            !selectedCreditSatisfaction &&
            selectedOptionEntries.length >= selectedOptionGroup.selectionCount
          )
        ) {
          continue;
        }
      }

      const promptOptionGroup = shouldScheduleAsChoiceBucket
        ? buildSuggestedQuarterCourseOptionGroup({
            item: status.item,
            selectedOptionIds,
            isSelectionPrompt: true,
            selectionSource: selectedOptionSelectionSource,
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
        const promptCreditRange = promptOptionGroup
          ? getRemainingChooseCreditsRangeAfterSelectedOptions({
              status,
              optionGroup: promptOptionGroup,
              selectedOptionIds,
              fallbackRange: getSuggestedQuarterCourseOptionGroupCreditRange(promptOptionGroup),
            })
          : null;
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
          ...(promptCreditRange ?? {}),
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

function getPlannerActionableCourseCodesForRequirementStatus(input: {
  status: TransferRequirementStatus;
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
  campusId?: TransferPlannerMajorPlan["campusId"] | null;
  plan?: TransferPlannerMajorPlan | null;
}) {
  const { status } = input;
  if (!shouldScheduleRequirementStatusAsPlannerChoiceBucket(status, input.plan)) {
    return status.explicitCourseCodes;
  }

  return unique(
    getSelectedRequirementOptionEntriesForPlannerScheduling({
      item: status.item,
      selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
      campusId: input.campusId,
      plan: input.plan,
    }).flatMap((entry) =>
      getRequirementOptionCourseLabels(entry.option).flatMap((label) => extractCourseCodes(label))
    )
  );
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
    ].flatMap((status) =>
      getPlannerActionableCourseCodesForRequirementStatus({
        status,
        selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
        campusId: input.plan?.campusId,
        plan: input.plan,
      })
    )
  );
  const trackSupplementalCoveredCourseCodes = new Set([
    ...[
      ...applicationStatuses,
      ...beforeEnrollmentStatuses,
      ...stayAtGrcStatuses,
    ].flatMap((status) =>
      isChoiceRequirementStatus(status)
        ? unique([
            ...status.matchedCourses.map((course) => course.code),
            ...getPlannerActionableCourseCodesForRequirementStatus({
              status,
              selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
              campusId: input.plan?.campusId,
              plan: input.plan,
            }),
          ])
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
  const sourceValidatedGuidedRemainingCourses = filterSbseTransferOnlyCurrentSourceCourses({
    plan: input.plan,
    transferOnlyMode: input.includeStayAtGrcCourses === false,
    courses: guidedRemainingCourses,
    completedCourses: input.completedCourses,
    selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
    prerequisiteCourseMap,
    corequisiteCourseMap,
  });
  const completedQuarterPlans = buildCompletedQuarterPlans(input.completedCourses, {
    campusId: input.plan?.campusId,
    plan: input.plan,
    requirementStatuses: [
      ...applicationStatuses,
      ...beforeEnrollmentStatuses,
      ...stayAtGrcStatuses,
    ],
  });
  const guidedCoursesStillToPlan = sourceValidatedGuidedRemainingCourses
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
  const currentQuarterCourses = uniqueBy(
    [
      ...sourceValidatedGuidedRemainingCourses,
      ...allFillerPool,
    ]
      .filter(isVisibleGrcQuarterPlanCourse)
      .filter(isSelectedCurrentCourse),
    (course) => normalizeCourseCode(course.label) || course.label
  ).map<PendingSuggestedCourse>((course) => ({
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

  const suggestedPlan = [
    ...completedQuarterPlans,
    ...(currentQuarterPlan ? [currentQuarterPlan] : []),
    ...futureQuarterPlans,
  ];
  const requirementStatuses = [
    ...applicationStatuses,
    ...beforeEnrollmentStatuses,
    ...stayAtGrcStatuses,
  ];
  const categoryTranscriptAwareSuggestedPlan = attachSelectedCategoryTranscriptSatisfaction({
    suggestedPlan,
    completedCourses: input.completedCourses,
    plan: input.plan,
    selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
    requirementStatuses,
  });

  return attachResolvedOptionGroupSatisfaction({
    suggestedPlan: categoryTranscriptAwareSuggestedPlan,
    completedCourses: input.completedCourses,
    plan: input.plan,
    requirementStatuses,
  });
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
    const isAllowedOptionPrompt =
      isPlaceholder &&
      Boolean(
        course.optionGroup?.isSelectionPrompt &&
          (course.optionGroup.options ?? []).length > 0
      );
    const isAllowedPlaceholder =
      isPlaceholder &&
      (course.sourceKind === "official-grc-track-breadth" ||
        course.sourceKind === "uw-major-breadth" ||
        isAllowedOptionPrompt);
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
      Boolean(course.optionGroup?.selectedOptionIds?.length) ||
      course.optionGroup?.selectionSource === "default" ||
      course.optionGroup?.selectionSource === "student" ||
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
  requireAllEquivalents?: boolean;
  hiddenUnmappedReason?: string;
}[] = [
  { uwRequirement: "English Composition", grcEquivalents: ["ENGL& 101"] },
  { uwRequirement: "MATH 124", grcEquivalents: ["MATH& 151"] },
  { uwRequirement: "MATH 125", grcEquivalents: ["MATH& 152"] },
  { uwRequirement: "MATH 126", grcEquivalents: ["MATH& 163"] },
  { uwRequirement: "MATH 207", grcEquivalents: ["MATH 238"] },
  { uwRequirement: "MATH 208", grcEquivalents: ["MATH 240"] },
  { uwRequirement: "CHEM 142", grcEquivalents: ["CHEM& 161"] },
  {
    uwRequirement: "CHEM 152",
    grcEquivalents: ["CHEM& 162", "CHEM& 163"],
    requireAllEquivalents: true,
  },
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
    const visibleInQuarterPlan = row.requireAllEquivalents
      ? visibleCourseCodes.length === grcEquivalents.length
      : visibleCourseCodes.length > 0;

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

function getRequirementGroupAcceptedUwOptionLabels(
  group: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>
) {
  return unique(
    (group.options ?? [])
      .map((option) => {
        const displayCodes = (option.displayCourseCodes ?? [])
          .map((courseCode) => String(courseCode ?? "").trim())
          .filter(Boolean);
        const courseCodes = displayCodes.length
          ? displayCodes
          : [
              ...(option.uwCourses ?? []),
              ...(option.equivalentUwCourseCodes ?? []),
            ]
              .map((courseCode) => String(courseCode ?? "").trim())
              .filter(Boolean);
        return courseCodes.length
          ? courseCodes.join(" / ")
          : String(option.label ?? "").trim();
      })
      .filter(Boolean)
  );
}

function getRequirementGroupGrcOptionCourseCodes(
  group: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>
) {
  return sortCourseCodes(
    (group.options ?? [])
      .flatMap((option) => option.grcMatches ?? [])
      .flatMap((label) => extractCourseCodes(label))
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function getRequirementGroupCategoryOptionLabels(
  group: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>
) {
  return unique(
    (group.options ?? [])
      .filter((option) => isRequirementCategoryOption(option))
      .map((option) => getRequirementCategoryOptionLabel(option))
      .filter(Boolean)
  );
}

function getRequirementGroupAcceptedUwCourseCodeSet(
  group: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>
) {
  return new Set(
    (group.options ?? [])
      .flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
      ])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function getScheduledPlannerCourses(suggestedPlan: SuggestedQuarterPlan[]) {
  return suggestedPlan
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses)
    .filter((course) => course.status !== "completed");
}

function getScheduledPlannerCourseCodeSet(suggestedPlan: SuggestedQuarterPlan[]) {
  return new Set(
    getScheduledPlannerCourses(suggestedPlan)
      .flatMap((course) => getSuggestedQuarterCourseSatisfyingCourseCodes(course))
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

const UW_SEATTLE_SBSE_PLAN_ID = "uw-seattle-sustainable-bioresource-systems-engineering";
const CURRENT_SBSE_TRUE_OPTION_GROUP_PATTERN =
  /\b(?:computation[-_\s]*data[-_\s]*science|business,\s*policy,\s*and\s*economics|business[-_\s]*policy[-_\s]*economics)\b/i;
const CURRENT_SBSE_SOURCE_BACKED_GRC_COURSE_CODES = new Set(
  [
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "CHEM& 261",
    "ENGL& 101",
    "ENGR& 224",
    "MATH 238",
    "MATH 240",
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "PHYS& 221",
    "PHYS& 222",
  ].map((courseCode) => normalizeCourseCode(courseCode))
);

type SbseStaleCourseAuditMetadata = {
  uwEquivalent: string;
  oldBseOnly?: boolean;
  staleAlternativeSourceRow?: boolean;
  reason: string;
};

type SbseTransferOnlyCourseClassification =
  | "current SBSE source-backed requirement"
  | "current SBSE true option, selected/defaulted"
  | "prerequisite for a current SBSE source-backed course"
  | "completed transcript course"
  | "old-BSE-only"
  | "matched-track-only"
  | "stale alternative-source row"
  | "hidden/unmapped UW-only";

type SbseTransferOnlyCourseValidation = SbseCurrentVsOldSourceAuditEntry & {
  classification: SbseTransferOnlyCourseClassification;
  courseCodes: string[];
  creditAmount: number;
};

const SBSE_STALE_OR_OLD_COURSE_AUDIT_METADATA_ENTRIES: Array<
  [string, SbseStaleCourseAuditMetadata]
> = [
    [
      "ACCT& 201",
      {
        uwEquivalent: "ACCTG 215",
        staleAlternativeSourceRow: true,
        reason:
          "stale alternative-source row from an accounting business-path alternative; ACCTG 215 is not in the current SBSE Business, Policy, and Economics list.",
      },
    ],
    [
      "ACCT& 202",
      {
        uwEquivalent: "ACCTG 215",
        staleAlternativeSourceRow: true,
        reason:
          "stale alternative-source row from an accounting business-path alternative; ACCTG 215 is not in the current SBSE Business, Policy, and Economics list.",
      },
    ],
    [
      "ACCT& 203",
      {
        uwEquivalent: "ACCTG 225",
        staleAlternativeSourceRow: true,
        reason:
          "stale alternative-source row from an accounting business-path alternative; ACCTG 225 is not in the current SBSE Business, Policy, and Economics list.",
      },
    ],
    [
      "CHEM& 262",
      {
        uwEquivalent: "CHEM 238",
        oldBseOnly: true,
        reason:
          "old-BSE-only organic chemistry row; current SBSE transfer planning only keeps it if it is needed as a prerequisite for a current SBSE source-backed row.",
      },
    ],
    [
      "PHYS& 223",
      {
        uwEquivalent: "PHYS 123",
        oldBseOnly: true,
        reason:
          "old-BSE-only physics depth row; current SBSE transfer planning only keeps it if it is needed as a prerequisite for a current SBSE source-backed row.",
      },
    ],
    [
      "ENGR& 204",
      {
        uwEquivalent: "EE 215",
        oldBseOnly: true,
        reason:
          "old-BSE or matched AST-2 engineering row; current SBSE source evidence does not require EE 215.",
      },
    ],
    [
      "ENGR& 214",
      {
        uwEquivalent: "AA 210",
        oldBseOnly: true,
        reason:
          "matched AST-2 engineering row; current SBSE transfer planning only keeps it if it is a prerequisite for a current SBSE source-backed row.",
      },
    ],
    [
      "ENGR& 215",
      {
        uwEquivalent: "ME 230",
        oldBseOnly: true,
        reason:
          "matched AST-2 engineering row; current SBSE transfer planning only keeps it if it is a prerequisite for a current SBSE source-backed row.",
      },
    ],
    [
      "ENGR& 225",
      {
        uwEquivalent: "CEE 220",
        oldBseOnly: true,
        reason:
          "matched AST-2 engineering row; current SBSE transfer planning only keeps it if it is a prerequisite for a current SBSE source-backed row.",
      },
    ],
    [
      "ENGR& 114",
      {
        uwEquivalent: "ME 123",
        oldBseOnly: true,
        reason:
          "matched AST-2 engineering row; current SBSE transfer planning only keeps it if it is a prerequisite for a current SBSE source-backed row.",
      },
    ],
    [
      "ENGR 140",
      {
        uwEquivalent: "MSE 170",
        oldBseOnly: true,
        reason:
          "matched AST-2 materials row; current SBSE transfer planning only keeps it if it is a prerequisite for a current SBSE source-backed row.",
      },
    ],
    [
      "ENGL 128",
      {
        uwEquivalent: "ENGR 231",
        oldBseOnly: true,
        reason:
          "old engineering communication row; current SBSE source evidence does not require ENGR 231.",
      },
    ],
    [
      "ENGR 100",
      {
        uwEquivalent: "none",
        oldBseOnly: true,
        reason:
          "matched AST-2 introductory engineering row; current SBSE transfer planning only keeps it if it unlocks a current SBSE source-backed course.",
      },
    ],
    [
      "ENGR 106",
      {
        uwEquivalent: "none",
        oldBseOnly: true,
        reason:
          "matched AST-2 introductory engineering row; current SBSE transfer planning only keeps it if it unlocks a current SBSE source-backed course.",
      },
    ],
];

const SBSE_STALE_OR_OLD_COURSE_AUDIT_METADATA = new Map<
  string,
  SbseStaleCourseAuditMetadata
>(
  SBSE_STALE_OR_OLD_COURSE_AUDIT_METADATA_ENTRIES.map(([courseCode, metadata]) => [
    normalizeCourseCode(courseCode),
    metadata,
  ])
);

function isCurrentSbsePlan(
  plan: TransferPlannerMajorPlan | null | undefined
): plan is TransferPlannerMajorPlan {
  return plan?.id === UW_SEATTLE_SBSE_PLAN_ID;
}

function isCurrentSbseTrueOptionGroupId(value: string | null | undefined) {
  return CURRENT_SBSE_TRUE_OPTION_GROUP_PATTERN.test(String(value ?? ""));
}

function isCurrentSbseTrueOptionRequirementGroup(
  group: TransferPlannerChecklistItem["requirementGroup"] | null | undefined
) {
  if (!group) {
    return false;
  }

  return isCurrentSbseTrueOptionGroupId(
    `${group.id} ${group.label} ${group.category} ${group.subcategory ?? ""}`
  );
}

function isCurrentSbseTrueOptionSuggestedGroup(
  group: SuggestedQuarterCourseOptionGroup | null | undefined
) {
  if (!group) {
    return false;
  }

  return isCurrentSbseTrueOptionGroupId(`${group.id} ${group.title}`);
}

function isCurrentSbseKnownRequirementGroup(
  group: TransferPlannerChecklistItem["requirementGroup"] | null | undefined
) {
  if (!group) {
    return false;
  }

  if (isCurrentSbseTrueOptionRequirementGroup(group)) {
    return true;
  }

  return (
    group.id.startsWith(`${UW_SEATTLE_SBSE_PLAN_ID}:requirement-group:sbse-`) ||
    /\bsbse_/i.test(`${group.category} ${group.subcategory ?? ""}`)
  );
}

function getCurrentSbseRequiredCourseCodeSet(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  const courseCodes = new Set<string>();
  if (!isCurrentSbsePlan(plan)) {
    return courseCodes;
  }

  for (const courseCode of CURRENT_SBSE_SOURCE_BACKED_GRC_COURSE_CODES) {
    courseCodes.add(courseCode);
  }

  for (const item of getTransferPlannerPlanChecklistItems(plan)) {
    const group = item.requirementGroup;
    if (
      !isCurrentSbseKnownRequirementGroup(group) ||
      isCurrentSbseTrueOptionRequirementGroup(group)
    ) {
      continue;
    }

    for (const label of [
      ...(item.grcCourses ?? []),
      ...((group?.options ?? []).flatMap((option) => getRequirementOptionCourseLabels(option))),
    ]) {
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

function getCurrentSbseSelectedTrueOptionCourseCodeSet(input: {
  plan: TransferPlannerMajorPlan | null | undefined;
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
}) {
  const courseCodes = new Set<string>();
  const plan = input.plan;
  if (!isCurrentSbsePlan(plan)) {
    return courseCodes;
  }

  for (const item of getTransferPlannerPlanChecklistItems(plan)) {
    const group = item.requirementGroup;
    if (!isCurrentSbseTrueOptionRequirementGroup(group)) {
      continue;
    }

    const selectedIds = new Set(
      getPlannerSelectedRequirementOptionIds(item, input.selectedRequirementOptionIdsByGroup)
    );
    if (!selectedIds.size) {
      continue;
    }

    for (const entry of getSelectedRequirementOptionsForPlanner(
      item,
      [...selectedIds]
    )) {
      for (const label of getRequirementOptionCourseLabels(entry.option)) {
        for (const courseCode of extractCourseCodes(label)) {
          const normalizedCourseCode = normalizeCourseCode(courseCode);
          if (normalizedCourseCode) {
            courseCodes.add(normalizedCourseCode);
          }
        }
      }
    }
  }

  return courseCodes;
}

function getSbseStaleOrOldCourseMetadata(courseCodes: string[]) {
  for (const courseCode of courseCodes) {
    const metadata = SBSE_STALE_OR_OLD_COURSE_AUDIT_METADATA.get(
      normalizeCourseCode(courseCode)
    );
    if (metadata) {
      return metadata;
    }
  }

  return null;
}

function buildSbseTransferOnlyValidationContext(input: {
  plan: TransferPlannerMajorPlan | null | undefined;
  completedCourses?: TranscriptCourseEntry[];
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
  prerequisiteCourseMap: Map<string, string[][]>;
  corequisiteCourseMap: Map<string, string[][]>;
}) {
  const currentRequiredCourseCodes = getCurrentSbseRequiredCourseCodeSet(input.plan);
  const selectedTrueOptionCourseCodes = getCurrentSbseSelectedTrueOptionCourseCodeSet({
    plan: input.plan,
    selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
  });
  const currentSourceCourseCodes = new Set([
    ...currentRequiredCourseCodes,
    ...selectedTrueOptionCourseCodes,
  ]);
  const prerequisiteCourseCodes = collectTransitivePrerequisiteCourseCodes(
    [...currentSourceCourseCodes],
    mergeCourseRequirementMaps(input.prerequisiteCourseMap, input.corequisiteCourseMap)
  );
  const completedCourseCodes = new Set(
    (input.completedCourses ?? [])
      .map((course) => normalizeCourseCode(course.code))
      .filter(Boolean)
  );

  return {
    currentRequiredCourseCodes,
    selectedTrueOptionCourseCodes,
    currentSourceCourseCodes,
    prerequisiteCourseCodes,
    completedCourseCodes,
  };
}

function getSbseCourseUwEquivalentLabel(input: {
  course: SuggestedQuarterCourse;
  courseCodes: string[];
  plan: TransferPlannerMajorPlan | null | undefined;
  staleOrOldMetadata: SbseStaleCourseAuditMetadata | null;
}) {
  if (input.staleOrOldMetadata?.uwEquivalent) {
    return input.staleOrOldMetadata.uwEquivalent;
  }

  if (isCurrentSbseTrueOptionSuggestedGroup(input.course.optionGroup)) {
    return "current SBSE option group";
  }

  const equivalentCourseCodes = sortCourseCodes(
    input.courseCodes.flatMap((courseCode) => {
      if (hasConcreteGrcCourseCode(courseCode)) {
        return buildBestSingleCourseUwEquivalentCourseCodes(
          courseCode,
          input.plan?.campusId
        );
      }

      return [normalizeCourseCode(courseCode)];
    })
  );

  return equivalentCourseCodes.length ? equivalentCourseCodes.join(", ") : "none";
}

function getCurrentSbseSourceBackedRequirementReason(courseCodes: string[]) {
  const normalizedCourseCodes = new Set(
    courseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );

  if (normalizedCourseCodes.has(normalizeCourseCode("MATH 238"))) {
    return "current SBSE MATH 207 / AMATH 351 requirement.";
  }

  if (normalizedCourseCodes.has(normalizeCourseCode("MATH 240"))) {
    return "current SBSE MATH 208 / AMATH 352 requirement.";
  }

  return "current SBSE source-backed requirement from the SBSE requirements page.";
}

function classifySbseTransferOnlyCourse(input: {
  course: SuggestedQuarterCourse;
  plan: TransferPlannerMajorPlan | null | undefined;
  validationContext: ReturnType<typeof buildSbseTransferOnlyValidationContext>;
}) {
  const courseCodes = getSuggestedQuarterCourseSatisfyingCourseCodes(input.course)
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter(Boolean);
  const staleOrOldMetadata = getSbseStaleOrOldCourseMetadata(courseCodes);
  const isCompletedTranscriptCourse =
    input.course.status === "completed" ||
    courseCodes.some((courseCode) =>
      input.validationContext.completedCourseCodes.has(courseCode)
    );
  const isCurrentRequiredCourse =
    courseCodes.length > 0 &&
    courseCodes.some((courseCode) =>
      input.validationContext.currentRequiredCourseCodes.has(courseCode)
    );
  const isTrueOptionGroup = isCurrentSbseTrueOptionSuggestedGroup(input.course.optionGroup);
  const isCurrentSelectedTrueOption =
    isTrueOptionGroup &&
    (
      input.course.optionGroup?.isSelectionPrompt === true ||
      !courseCodes.length ||
      courseCodes.some((courseCode) =>
        input.validationContext.selectedTrueOptionCourseCodes.has(courseCode)
      )
    );
  const isPrerequisiteForCurrentSource =
    courseCodes.length > 0 &&
    !isCurrentRequiredCourse &&
    !isCurrentSelectedTrueOption &&
    courseCodes.some((courseCode) =>
      input.validationContext.prerequisiteCourseCodes.has(courseCode)
    );
  const currentSbseSourceBacked =
    isCurrentRequiredCourse || isCurrentSelectedTrueOption;
  const oldBseOnly = Boolean(
    staleOrOldMetadata?.oldBseOnly &&
      !currentSbseSourceBacked &&
      !isPrerequisiteForCurrentSource
  );
  const matchedTrackOnly = Boolean(
    input.course.sourceKind === "official-grc-track" &&
      !currentSbseSourceBacked &&
      !isPrerequisiteForCurrentSource
  );
  const staleAlternativeSourceRow = Boolean(
    staleOrOldMetadata?.staleAlternativeSourceRow &&
      !currentSbseSourceBacked &&
      !isPrerequisiteForCurrentSource
  );
  const transferOnlyShouldShow =
    isCompletedTranscriptCourse ||
    currentSbseSourceBacked ||
    isPrerequisiteForCurrentSource;
  const creditRange = getSuggestedQuarterCourseCreditRange(input.course);
  const creditAmount = creditRange.creditMax || creditRange.creditMin || 0;

  let classification: SbseTransferOnlyCourseClassification =
    "hidden/unmapped UW-only";
  let reason = "hidden/unmapped UW-only row; transfer-only mode should not display it.";

  if (isCompletedTranscriptCourse) {
    classification = "completed transcript course";
    reason = "completed transcript course; completed courses remain visible for context.";
  } else if (isCurrentRequiredCourse) {
    classification = "current SBSE source-backed requirement";
    reason = getCurrentSbseSourceBackedRequirementReason(courseCodes);
  } else if (isCurrentSelectedTrueOption) {
    classification = "current SBSE true option, selected/defaulted";
    reason =
      input.course.optionGroup?.isSelectionPrompt === true
        ? "current SBSE true option group prompt; visible and editable until the student chooses an accepted option."
        : "selected/defaulted course from a current SBSE true option group.";
  } else if (isPrerequisiteForCurrentSource) {
    classification = "prerequisite for a current SBSE source-backed course";
    reason =
      "local prerequisite/corequisite for a visible current SBSE source-backed course.";
  } else if (staleAlternativeSourceRow) {
    classification = "stale alternative-source row";
    reason = staleOrOldMetadata?.reason ?? "stale alternative-source row.";
  } else if (oldBseOnly) {
    classification = "old-BSE-only";
    reason = staleOrOldMetadata?.reason ?? "old-BSE-only row.";
  } else if (matchedTrackOnly) {
    classification = "matched-track-only";
    reason =
      "matched-track-only course from the closest Green River associate path; not a current SBSE source-backed transfer requirement.";
  }

  const uwEquivalent = getSbseCourseUwEquivalentLabel({
    course: input.course,
    courseCodes,
    plan: input.plan,
    staleOrOldMetadata,
  });
  const courseLabel = courseCodes.length ? courseCodes.join(", ") : input.course.label;

  return {
    course: courseLabel,
    uwEquivalent,
    currentSbseSourceBacked,
    oldBseOnly,
    matchedTrackOnly,
    prerequisiteForCurrentSource: isPrerequisiteForCurrentSource,
    transferOnlyShouldShow,
    reason,
    classification,
    courseCodes,
    creditAmount,
    copyOnlyDebugText: [
      "[copy-only current-vs-old-source audit]",
      `Course: ${courseLabel}`,
      `UW equivalent: ${uwEquivalent}`,
      `Current SBSE source-backed: ${currentSbseSourceBacked ? "yes" : "no"}`,
      `Old BSE-only: ${oldBseOnly ? "yes" : "no"}`,
      `Matched-track-only: ${matchedTrackOnly ? "yes" : "no"}`,
      `Prerequisite-for-current-source: ${isPrerequisiteForCurrentSource ? "yes" : "no"}`,
      `Transfer-only should show: ${transferOnlyShouldShow ? "yes" : "no"}`,
      `Reason: ${reason}`,
    ].join(" "),
  } satisfies SbseTransferOnlyCourseValidation;
}

function filterSbseTransferOnlyCurrentSourceCourses(input: {
  plan: TransferPlannerMajorPlan | null | undefined;
  transferOnlyMode: boolean;
  courses: PendingSuggestedCourse[];
  completedCourses?: TranscriptCourseEntry[];
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
  prerequisiteCourseMap: Map<string, string[][]>;
  corequisiteCourseMap: Map<string, string[][]>;
}) {
  if (!isCurrentSbsePlan(input.plan) || !input.transferOnlyMode) {
    return input.courses;
  }

  const validationContext = buildSbseTransferOnlyValidationContext({
    plan: input.plan,
    completedCourses: input.completedCourses,
    selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
    prerequisiteCourseMap: input.prerequisiteCourseMap,
    corequisiteCourseMap: input.corequisiteCourseMap,
  });

  return input.courses.filter(
    (course) =>
      classifySbseTransferOnlyCourse({
        course,
        plan: input.plan,
        validationContext,
      }).transferOnlyShouldShow
  );
}

function getRequirementStatusCourseCodeSet(status: TransferRequirementStatus) {
  return new Set(
    status.explicitCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
}

function buildIndependentSchedulingReasonForOptionExtras(input: {
  currentGroupId: string;
  scheduledExtraCourses: string[];
  statuses: TransferRequirementStatus[];
}) {
  const extraCourseCodes = new Set(
    input.scheduledExtraCourses.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
  if (!extraCourseCodes.size) {
    return "none";
  }

  const reasons = input.statuses
    .filter((status) => status.item.requirementGroup?.id !== input.currentGroupId)
    .filter((status) => {
      const statusCourseCodes = getRequirementStatusCourseCodeSet(status);
      return [...extraCourseCodes].some((courseCode) => statusCourseCodes.has(courseCode));
    })
    .map((status) => status.item.requirementGroup?.label || status.item.title)
    .filter(Boolean);

  return reasons.length
    ? `Scheduled independently for source-backed requirement: ${unique(reasons).join("; ")}`
    : "none";
}

function getSuggestedQuarterOptionGroupResolvedSelectionCount(
  optionGroup: SuggestedQuarterCourseOptionGroup
) {
  if (isSuggestedQuarterCreditBasedOptionGroup(optionGroup)) {
    return (
      getSuggestedQuarterOptionGroupCreditSatisfaction({
        optionGroup,
      }).creditMax ?? 0
    );
  }

  return getSuggestedQuarterCourseOptionGroupResolvedOptionIds(optionGroup).length;
}

function shouldPreferSuggestedPlanOptionGroupForAudit(
  currentOptionGroup: SuggestedQuarterCourseOptionGroup,
  nextOptionGroup: SuggestedQuarterCourseOptionGroup
) {
  const currentResolvedCount =
    getSuggestedQuarterOptionGroupResolvedSelectionCount(currentOptionGroup);
  const nextResolvedCount =
    getSuggestedQuarterOptionGroupResolvedSelectionCount(nextOptionGroup);

  return (
    (nextOptionGroup.selectionSource === "student" &&
      currentOptionGroup.selectionSource !== "student") ||
    (nextOptionGroup.isSelectionPrompt && !currentOptionGroup.isSelectionPrompt) ||
    nextResolvedCount > currentResolvedCount
  );
}

function collectSuggestedPlanOptionGroupsById(suggestedPlan: SuggestedQuarterPlan[]) {
  const optionGroupsById = new Map<string, SuggestedQuarterCourseOptionGroup>();

  for (const course of suggestedPlan.flatMap((quarter) => quarter.courses)) {
    const optionGroup = course.optionGroup ?? null;
    if (!optionGroup) {
      continue;
    }

    const existingOptionGroup = optionGroupsById.get(optionGroup.id);
    if (
      !existingOptionGroup ||
      shouldPreferSuggestedPlanOptionGroupForAudit(existingOptionGroup, optionGroup)
    ) {
      optionGroupsById.set(optionGroup.id, optionGroup);
    }
  }

  return optionGroupsById;
}

function resolveOptionGroupForAudit(input: {
  optionGroup: SuggestedQuarterCourseOptionGroup;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
  completedCourseCodes: Set<string>;
  scheduledCourseCodes: Set<string>;
  plan?: TransferPlannerMajorPlan | null;
  requirementStatuses?: TransferRequirementStatus[];
}) {
  const fingerprint = getOptionGroupFingerprint(input.optionGroup);
  const optionGroups = collectSuggestedPlanOptionGroupsForAllocation(input.suggestedPlan);
  if (!optionGroups.some((optionGroup) => getOptionGroupFingerprint(optionGroup) === fingerprint)) {
    optionGroups.push(input.optionGroup);
  }

  const { allocatedGroupsByFingerprint } = buildAllocatedOptionGroupResolutionMap({
    optionGroups,
    completedCourseCodes: input.completedCourseCodes,
    scheduledCourseCodes: input.scheduledCourseCodes,
    completedCourses: input.completedCourses,
    campusId: input.plan?.campusId,
    consumedCompletedCourseCodesByGroupId: buildConsumedCompletedCourseCodesByOptionGroupId({
      statuses: input.requirementStatuses,
    }),
  });

  return allocatedGroupsByFingerprint.get(fingerprint) ?? input.optionGroup;
}

function formatOptionAllocationCandidateSources(
  sourcesByOptionId: Record<string, SuggestedQuarterOptionSatisfactionSource[]>
) {
  const entries = Object.entries(sourcesByOptionId).map(
    ([optionId, sources]) => `${optionId}:${sources.join("/") || "none"}`
  );
  return entries.length ? entries : ["none"];
}

export function auditOptionAllocation(input: {
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
  plan?: TransferPlannerMajorPlan | null;
}) {
  const completedCourseCodes = new Set(
    (input.completedCourses ?? [])
      .map((course) => normalizeCourseCode(course.code))
      .filter(Boolean)
  );
  const scheduledCourseCodes = getScheduledPlannerCountedCourseCodeSet(input.suggestedPlan);
  const { allocatedGroupsByFingerprint, contextsByFingerprint } =
    buildAllocatedOptionGroupResolutionMap({
      optionGroups: collectSuggestedPlanOptionGroupsForAllocation(input.suggestedPlan),
      completedCourseCodes,
      scheduledCourseCodes,
      completedCourses: input.completedCourses ?? [],
      campusId: input.plan?.campusId,
    });

  return [...contextsByFingerprint.values()]
    .sort((left, right) => left.planOrder - right.planOrder)
    .map<OptionAllocationAuditEntry>((context) => {
      const resolvedOptionGroup =
        allocatedGroupsByFingerprint.get(context.fingerprint) ?? context.optionGroup;
      const requiredCount = getSuggestedQuarterOptionGroupRequiredCount(context.optionGroup);
      const beforeCap = resolvedOptionGroup.resolvedSatisfiedOptionIdsBeforeCap ?? [];
      const afterCap = resolvedOptionGroup.resolvedSatisfiedOptionIds ?? [];
      const dropped = resolvedOptionGroup.droppedSatisfiedOptionIds ?? [];
      const issue =
        afterCap.length < requiredCount
          ? "unresolved-required-option"
          : beforeCap.length > afterCap.length || beforeCap.length > requiredCount
            ? "over-satisfied-before-cap"
            : null;
      const reason =
        issue === "unresolved-required-option"
          ? "unresolved required option"
          : dropped.length
            ? "allocated and capped to required count"
            : "no allocation needed";
      const candidateSources = formatOptionAllocationCandidateSources(
        resolvedOptionGroup.candidateOptionSatisfactionSourcesById ?? {}
      );

      return {
        groupId: context.optionGroup.id,
        groupTitle: context.optionGroup.title,
        requiredCount,
        candidateSatisfyingOptionIds: resolvedOptionGroup.candidateSatisfiedOptionIds ?? [],
        candidateSources,
        overlappingGroups: context.overlappingGroups,
        resolvedDisplayedOptionIdsBeforeCap: beforeCap,
        resolvedDisplayedOptionIdsAfterCap: afterCap,
        droppedExtraOptionIds: dropped,
        reason,
        issue,
        copyOnlyDebugText: [
          "[copy-only option allocation audit]",
          `Group id: ${context.optionGroup.id}`,
          `Group title: ${context.optionGroup.title}`,
          `Required count: ${requiredCount}`,
          `Candidate satisfying option ids: ${
            (resolvedOptionGroup.candidateSatisfiedOptionIds ?? []).length
              ? (resolvedOptionGroup.candidateSatisfiedOptionIds ?? []).join(", ")
              : "none"
          }`,
          `Candidate sources: ${candidateSources.join(", ")}`,
          `Overlapping groups: ${
            context.overlappingGroups.length ? context.overlappingGroups.join(", ") : "none"
          }`,
          `Resolved displayed option ids before cap: ${
            beforeCap.length ? beforeCap.join(", ") : "none"
          }`,
          `Resolved displayed option ids after cap: ${
            afterCap.length ? afterCap.join(", ") : "none"
          }`,
          `Dropped extra option ids: ${dropped.length ? dropped.join(", ") : "none"}`,
          `Reason: ${reason}`,
          `Issue: ${issue ?? "none"}`,
        ].join(" "),
      };
    });
}

function normalizeOptionGroupTitleForFallback(title: string | null | undefined) {
  return String(title ?? "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function isBadGenericOptionGroupTitle(title: string | null | undefined) {
  const normalizedTitle = normalizeOptionGroupTitleForFallback(title);
  if (!normalizedTitle) {
    return true;
  }

  const comparableTitle = normalizedTitle
    .toLowerCase()
    .replace(/^[\s"'`([{]+|[\s"'`)\].:;!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!comparableTitle) {
    return true;
  }

  return [
    /^(?:this\s+)?requirement$/,
    /^requirements?$/,
    /^(?:this\s+)?(?:choice|option|course)$/,
    /^(?:course\s+)?(?:choice|option)s?$/,
    /^(?:choose|select|pick)\s+(?:one|1)$/,
    /^(?:choose|select|pick)\s+(?:one|1)\s+(?:course|option|approved option|requirement)$/,
    /^(?:choose|select|pick)\s+(?:one|1)\s+(?:of|from)\s+(?:the\s+)?following(?:\s+(?:courses?|options?|requirements?))?$/,
    /^(?:one|1)\s+(?:course|option|requirement)$/,
    /^(?:one|1)\s+of\s+(?:the\s+)?following(?:\s+(?:courses?|options?|requirements?))?$/,
    /^select(?:ed)?\s+options?$/,
    /^choose\s+options?$/,
  ].some((pattern) => pattern.test(comparableTitle));
}

function getSuggestedQuarterOptionGroupDisplayTitle(input: {
  optionGroup: SuggestedQuarterCourseOptionGroup;
  visibleOptionIndex: number;
  forceNumberedTitle?: boolean;
  preserveOriginalTitle?: boolean;
}) {
  const originalTitle = normalizeOptionGroupTitleForFallback(input.optionGroup.title);
  if (input.forceNumberedTitle) {
    return `Requirement Choice ${input.visibleOptionIndex}`;
  }
  if (input.preserveOriginalTitle && originalTitle) {
    return originalTitle;
  }

  return isBadGenericOptionGroupTitle(originalTitle)
    ? `Requirement Choice ${input.visibleOptionIndex}`
    : originalTitle;
}

export function auditOptionTitleFallback(input: {
  optionGroups: SuggestedQuarterCourseOptionGroup[];
  forceNumberedTitles?: boolean;
  preserveOriginalTitles?: boolean;
}) {
  return input.optionGroups.map<OptionTitleFallbackAuditEntry>((optionGroup, index) => {
    const visibleOptionIndex = index + 1;
    const originalTitle = normalizeOptionGroupTitleForFallback(optionGroup.title);
    const displayedTitle = getSuggestedQuarterOptionGroupDisplayTitle({
      optionGroup,
      visibleOptionIndex,
      forceNumberedTitle: input.forceNumberedTitles,
      preserveOriginalTitle: input.preserveOriginalTitles,
    });
    const reason = input.forceNumberedTitles
      ? "forced-numbered-option-title"
      : input.preserveOriginalTitles && originalTitle
        ? "preserved-real-title"
      : displayedTitle === originalTitle && !isBadGenericOptionGroupTitle(originalTitle)
        ? "preserved-real-title"
        : "bad-generic-title";

    return {
      originalTitle: originalTitle || "none",
      displayedTitle,
      reason,
      visibleOptionIndex,
      groupId: optionGroup.id,
      copyOnlyDebugText: [
        "[copy-only option title fallback audit]",
        `Original title: ${originalTitle || "none"}`,
        `Displayed title: ${displayedTitle}`,
        `Reason: ${reason}`,
        `Visible option index: ${visibleOptionIndex}`,
        `Group id: ${optionGroup.id}`,
      ].join(" "),
    };
  });
}

export function auditOptionGroupSatisfaction(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
}) {
  if (!input.plan) {
    return [] as OptionGroupSatisfactionAuditEntry[];
  }

  const completedCourses = input.completedCourses ?? [];
  const statuses = [
    ...buildRequirementStatuses(input.plan.applicationChecklist, completedCourses),
    ...buildRequirementStatuses(input.plan.beforeEnrollmentChecklist, completedCourses),
    ...buildRequirementStatuses(input.plan.stayAtGrcChecklist, completedCourses),
  ];
  const scheduledCourseCodes = getScheduledPlannerCountedCourseCodeSet(input.suggestedPlan);
  const completedCourseCodes = new Set(
    completedCourses.map((course) => normalizeCourseCode(course.code)).filter(Boolean)
  );
  const displayedOptionGroupsById = collectSuggestedPlanOptionGroupsById(input.suggestedPlan);
  const rows: OptionGroupSatisfactionAuditEntry[] = [];
  const seenGroupIds = new Set<string>();
  const categoryTranscriptResolutions =
    buildSelectedCategoryTranscriptSatisfactionResolutions({
      plan: input.plan,
      completedCourses,
      selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
      statuses,
    });
  const categoryTranscriptResolutionsByGroupId = new Map<
    string,
    CategoryTranscriptSatisfactionResolution[]
  >();
  for (const resolution of categoryTranscriptResolutions) {
    categoryTranscriptResolutionsByGroupId.set(resolution.groupId, [
      ...(categoryTranscriptResolutionsByGroupId.get(resolution.groupId) ?? []),
      resolution,
    ]);
  }

  for (const status of statuses) {
    const group = status.item.requirementGroup;
    if (
      !group?.options.length ||
      !(
        group.requirementType === "choose_one" ||
        group.requirementType === "choose_n" ||
        group.requirementType === "choose_credits" ||
        group.requirementType === "sequence_choice"
      )
    ) {
      continue;
    }

    const groupId = getRequirementOptionSelectionKey(status.item);
    if (seenGroupIds.has(groupId)) {
      continue;
    }
    seenGroupIds.add(groupId);

    const hasExplicitSelection = hasExplicitPlannerSelectedRequirementOptionIds(
      status.item,
      input.selectedRequirementOptionIdsByGroup
    );
    const fallbackSelectedOptionIds = getPlannerSelectedRequirementOptionIdsForScheduling({
      item: status.item,
      selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
      plan: input.plan,
    });
    const fallbackSelectionSource = fallbackSelectedOptionIds.length
      ? hasExplicitSelection
        ? "student"
        : "default"
      : null;
    const visibleOptionGroup = displayedOptionGroupsById.get(groupId) ?? null;
    const visibleOptionGroupDisplayed = Boolean(visibleOptionGroup);
    const auditOptionGroup =
      visibleOptionGroup ??
      buildSuggestedQuarterCourseOptionGroup({
        item: status.item,
        selectedOptionIds: fallbackSelectedOptionIds,
        isSelectionPrompt: true,
        selectionSource: fallbackSelectionSource,
        campusId: input.plan.campusId,
      });
    if (!auditOptionGroup) {
      continue;
    }
    const resolvedAuditOptionGroup = resolveOptionGroupForAudit({
      optionGroup: auditOptionGroup,
      suggestedPlan: input.suggestedPlan,
      completedCourses,
      completedCourseCodes,
      scheduledCourseCodes,
      plan: input.plan,
      requirementStatuses: statuses,
    });
    const requiredCount = Math.max(
      1,
      Math.ceil(Number(resolvedAuditOptionGroup.selectionCount ?? 1) || 1)
    );
    const resolvedDisplayedOptionIds =
      getSuggestedQuarterCourseOptionGroupResolvedOptionIds(resolvedAuditOptionGroup);
    const satisfactionMode = isSuggestedQuarterCreditBasedOptionGroup(resolvedAuditOptionGroup)
      ? "credit-based"
      : "selection-count";
    const creditSatisfaction =
      satisfactionMode === "credit-based"
        ? getSuggestedQuarterOptionGroupCreditSatisfaction({
            optionGroup: resolvedAuditOptionGroup,
            optionIds: resolvedDisplayedOptionIds,
          })
        : null;
    const resolvedSatisfiedCount =
      satisfactionMode === "credit-based"
        ? resolvedDisplayedOptionIds.length
        : Math.min(resolvedDisplayedOptionIds.length, requiredCount);
    const displayedProgress =
      creditSatisfaction?.displayedProgress ?? `${resolvedSatisfiedCount}/${requiredCount}`;
    const fullySatisfied =
      creditSatisfaction?.fullySatisfied ?? resolvedSatisfiedCount >= requiredCount;
    const acceptedUwOptions = getRequirementGroupAcceptedUwOptionLabels(group);
    const mappedGrcOptions = getRequirementGroupGrcOptionCourseCodes(group);
    const categoryOptions = getRequirementGroupCategoryOptionLabels(group);
    const categoryOptionIds = new Set(getCategoryOptionIds(resolvedAuditOptionGroup));
    const selectedCategoryOptionIds = resolvedAuditOptionGroup.selectedOptionIds.filter(
      (optionId) => categoryOptionIds.has(optionId)
    );
    const selectedCategoryOptions = getCategoryOptionDisplayLabelsByIds(
      resolvedAuditOptionGroup,
      selectedCategoryOptionIds
    );
    const selectedCategoryOptionLabels = new Set(selectedCategoryOptions);
    const groupCategoryTranscriptResolutions =
      categoryTranscriptResolutionsByGroupId.get(groupId) ?? [];
    const chosenTranscriptCategorySatisfier =
      groupCategoryTranscriptResolutions.find((resolution) => resolution.chosenTranscriptSatisfier)
        ?.chosenTranscriptSatisfier ?? null;
    const genericPlannedCategoryCredits = input.suggestedPlan
      .filter((quarter) => quarter.phase === "planned" || quarter.phase === "current")
      .flatMap((quarter) => quarter.courses)
      .filter((course) => course.optionGroup?.id === groupId)
      .filter((course) => selectedCategoryOptionLabels.has(course.label))
      .filter((course) => extractCourseCodes(course.label).length === 0)
      .reduce((total, course) => {
        const creditRange = getSuggestedQuarterCourseCreditRange(course);
        return total + (creditRange.creditMax || creditRange.creditMin || 0);
      }, 0);
    const resolvedDisplayedOptions = getRequirementOptionDisplayLabelsByIds(
      resolvedAuditOptionGroup,
      resolvedDisplayedOptionIds
    );
    const acceptedGrcCourseCodes = new Set(getRequirementGroupGrcOptionCourseCodes(group));
    const matchedCourseCodes = new Set(
      status.matchedCourses.map((course) => normalizeCourseCode(course.code)).filter(Boolean)
    );
    const completedGrcCourses = sortCourseCodes(
      completedCourses
        .map((course) => normalizeCourseCode(course.code))
        .filter((courseCode) => acceptedGrcCourseCodes.has(courseCode))
    );
    const satisfiedBy = sortCourseCodes([
      ...status.matchedCourses
        .map((course) => normalizeCourseCode(course.code))
        .filter((courseCode) => courseCode && acceptedGrcCourseCodes.has(courseCode)),
      ...(resolvedAuditOptionGroup.completedSatisfyingCourseCodes ?? []),
    ]);
    const scheduledExtraCourses = sortCourseCodes(
      [...scheduledCourseCodes].filter(
        (courseCode) =>
          acceptedGrcCourseCodes.has(courseCode) &&
          !completedCourseCodes.has(courseCode) &&
          !matchedCourseCodes.has(courseCode)
      )
    );
    const shouldScheduleExtra = !fullySatisfied;
    const independentSchedulingReason = buildIndependentSchedulingReasonForOptionExtras({
      currentGroupId: groupId,
      scheduledExtraCourses,
      statuses,
    });
    const selectedCategoryIssue = selectedCategoryOptionIds.length
      ? !visibleOptionGroupDisplayed
        ? "selected-category-hidden"
        : selectedCategoryOptionIds.some(
            (optionId) => !resolvedDisplayedOptionIds.includes(optionId)
          )
          ? "selected-category-unsatisfied"
          : null
      : null;
    const issue =
      selectedCategoryIssue ??
      (chosenTranscriptCategorySatisfier && genericPlannedCategoryCredits > 0
        ? "selected-category-already-satisfied-but-scheduled"
        : null) ??
      (
        satisfactionMode === "credit-based" &&
        resolvedDisplayedOptionIds.length > 0 &&
        !fullySatisfied
          ? "insufficient-credit-selection"
          : null
      ) ??
      (scheduledExtraCourses.length > 0 && resolvedSatisfiedCount === 0
        ? "scheduled satisfying course not reflected in option progress"
        : null);

    rows.push({
      groupId,
      requirement: group.label || status.item.title,
      requiredCount,
      satisfactionMode,
      requiredCredits: creditSatisfaction?.requiredCredits ?? null,
      acceptedUwOptions,
      acceptedOptions: acceptedUwOptions,
      mappedGrcOptions,
      categoryOptions,
      selectedOptionIds: resolvedAuditOptionGroup.selectedOptionIds,
      selectedCategoryOptions,
      completedGrcCourses,
      completedSatisfyingCourses: resolvedAuditOptionGroup.completedSatisfyingCourseCodes ?? [],
      scheduledSatisfyingCourses: resolvedAuditOptionGroup.scheduledSatisfyingCourseCodes ?? [],
      countedSatisfyingCourses: resolvedAuditOptionGroup.countedSatisfyingCourseCodes ?? [],
      chosenTranscriptCategorySatisfier,
      genericPlannedCategoryCredits,
      resolvedSatisfiedCount,
      resolvedSatisfyingCredits: creditSatisfaction
        ? formatCreditRangeValueForProgress(
            creditSatisfaction.creditMin,
            creditSatisfaction.creditMax
          )
        : null,
      fullySatisfied,
      displayedProgress,
      satisfiedBy,
      scheduledExtraCourses,
      shouldScheduleExtra,
      independentSchedulingReason,
      issue,
      copyOnlyLegacyDebugText: [
        "[copy-only option satisfaction audit]",
        `Requirement: ${group.label || status.item.title}`,
        `Accepted UW options: ${acceptedUwOptions.length ? acceptedUwOptions.join(", ") : "none"}`,
        `Completed GRC courses: ${completedGrcCourses.length ? completedGrcCourses.join(", ") : "none"}`,
        `Satisfied by: ${satisfiedBy.length ? satisfiedBy.join(", ") : "none"}`,
        `Scheduled extra courses: ${scheduledExtraCourses.length ? scheduledExtraCourses.join(", ") : "none"}`,
        `Should schedule extra: ${shouldScheduleExtra ? "yes" : "no"}`,
        `Independent scheduling reason: ${independentSchedulingReason}`,
      ].join(" "),
      copyOnlyDebugText: [
        "[copy-only option satisfaction resolver audit]",
        `Group id: ${groupId}`,
        `Satisfaction mode: ${satisfactionMode}`,
        `Required credits: ${creditSatisfaction?.requiredCredits ?? "none"}`,
        `Required count: ${
          satisfactionMode === "credit-based"
            ? "ignored for credit-based groups"
            : requiredCount
        }`,
        `Accepted options: ${acceptedUwOptions.length ? acceptedUwOptions.join(", ") : "none"}`,
        `Mapped GRC options: ${mappedGrcOptions.length ? mappedGrcOptions.join(", ") : "none"}`,
        `Category options: ${categoryOptions.length ? categoryOptions.join(", ") : "none"}`,
        `Selected option ids: ${
          resolvedAuditOptionGroup.selectedOptionIds.length
            ? resolvedAuditOptionGroup.selectedOptionIds.join(", ")
            : "none"
        }`,
        `Completed satisfying courses: ${
          (resolvedAuditOptionGroup.completedSatisfyingCourseCodes ?? []).length
            ? (resolvedAuditOptionGroup.completedSatisfyingCourseCodes ?? []).join(", ")
            : "none"
        }`,
        `Scheduled satisfying courses: ${
          (resolvedAuditOptionGroup.scheduledSatisfyingCourseCodes ?? []).length
            ? (resolvedAuditOptionGroup.scheduledSatisfyingCourseCodes ?? []).join(", ")
            : "none"
        }`,
        `Selected category options: ${
          selectedCategoryOptions.length ? selectedCategoryOptions.join(", ") : "none"
        }`,
        `Chosen transcript category satisfier: ${chosenTranscriptCategorySatisfier ?? "none"}`,
        `Counted satisfying courses: ${
          (resolvedAuditOptionGroup.countedSatisfyingCourseCodes ?? []).length
            ? (resolvedAuditOptionGroup.countedSatisfyingCourseCodes ?? []).join(", ")
            : "none"
        }`,
        `Candidate satisfying courses: ${
          sortCourseCodes([
            ...(resolvedAuditOptionGroup.completedSatisfyingCourseCodes ?? []),
            ...(resolvedAuditOptionGroup.scheduledSatisfyingCourseCodes ?? []),
          ]).join(", ") || "none"
        }`,
        `Resolved displayed courses: ${
          (resolvedAuditOptionGroup.countedSatisfyingCourseCodes ?? []).join(", ") || "none"
        }`,
        `Resolved displayed courses/options: ${
          unique([
            ...(resolvedAuditOptionGroup.countedSatisfyingCourseCodes ?? []),
            ...resolvedDisplayedOptions,
          ]).join(", ") || "none"
        }`,
        `Resolved satisfying credits: ${
          creditSatisfaction
            ? formatCreditRangeValueForProgress(
                creditSatisfaction.creditMin,
                creditSatisfaction.creditMax
              )
            : "none"
        }`,
        `Resolved satisfied count: ${resolvedSatisfiedCount}`,
        `Displayed progress: ${displayedProgress}`,
        `Generic planned category credits: ${genericPlannedCategoryCredits}`,
        `Issue: ${issue ?? "none"}`,
      ].join(" "),
    });
  }

  return rows;
}

function parseCategoryOptionAuditCredits(text: string | null | undefined) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  const parentheticalCreditMatch = normalized.match(/\(\s*(\d+(?:\.\d+)?)\s*\)/);
  if (parentheticalCreditMatch) {
    const credits = Number(parentheticalCreditMatch[1]);
    return Number.isFinite(credits) ? credits : null;
  }

  const explicitCreditMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b/i);
  if (explicitCreditMatch) {
    const credits = Number(explicitCreditMatch[1]);
    return Number.isFinite(credits) ? credits : null;
  }

  return null;
}

function getCategoryOptionSourceLinesForPlan(plan: TransferPlannerMajorPlan) {
  const selectedPathwayId =
    "selectedPathwayId" in plan
      ? ((plan as TransferPlannerMajorPlan & { selectedPathwayId?: string | null })
          .selectedPathwayId ?? null)
      : null;
  return getTransferPlannerParsedRequirementSourceBlocks(plan.id, selectedPathwayId).flatMap(
    (block) => [
      ...(block.requirementCueLines ?? []),
      ...((block as { chooseStatements?: string[] }).chooseStatements ?? []),
    ]
  );
}

function requirementGroupMatchesSourceLineCourses(input: {
  group: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>;
  sourceLine: string;
}) {
  const sourceLineCourseCodes = new Set(
    extractCourseCodes(input.sourceLine).map((courseCode) => normalizeCourseCode(courseCode))
  );
  if (!sourceLineCourseCodes.size) {
    return false;
  }

  const groupCourseCodes = getRequirementGroupAcceptedUwCourseCodeSet(input.group);
  if (!groupCourseCodes.size) {
    return false;
  }

  const matchedCount = [...groupCourseCodes].filter((courseCode) =>
    sourceLineCourseCodes.has(courseCode)
  ).length;
  if (sourceLineCourseCodes.size > 1 && groupCourseCodes.size === 1) {
    return false;
  }
  return matchedCount >= Math.min(sourceLineCourseCodes.size, groupCourseCodes.size);
}

export function auditCategoryOptionDetection(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
}) {
  if (!input.plan) {
    return [] as CategoryOptionDetectionAuditEntry[];
  }

  const major = input.plan.title ?? input.plan.id ?? "unknown";
  const visibleOptionGroupsById = collectSuggestedPlanOptionGroupsById(input.suggestedPlan);
  const completedCourses = input.completedCourses ?? [];
  const rows: CategoryOptionDetectionAuditEntry[] = [];
  const seenKeys = new Set<string>();

  const pushRow = (row: Omit<CategoryOptionDetectionAuditEntry, "copyOnlyDebugText">) => {
    const key = `${row.requirement}:${row.category}:${row.sourceText}`;
    if (seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);
    rows.push({
      ...row,
      copyOnlyDebugText: [
        "[copy-only category option detection audit]",
        `Major: ${row.major}`,
        `Requirement: ${row.requirement}`,
        `Detected category option: ${row.detectedCategoryOption ? "yes" : "no"}`,
        `Category: ${row.category || "none"}`,
        `Credits: ${row.credits ?? "none"}`,
        `Source text: ${row.sourceText || "none"}`,
        `Visible option: ${row.visibleOption ? "yes" : "no"}`,
        `Selected: ${row.selected ? "yes" : "no"}`,
        `Satisfied by transcript course: ${row.satisfiedByTranscriptCourse ?? "none"}`,
        `Issue: ${row.issue ?? "none"}`,
      ].join(" "),
    });
  };

  for (const item of getTransferPlannerPlanChecklistItems(input.plan)) {
    const group = item.requirementGroup;
    if (!group) {
      continue;
    }
    const visibleGroup = visibleOptionGroupsById.get(group.id);
    const selectedOptionIds = new Set([
      ...(visibleGroup?.selectedOptionIds ?? []),
      ...getPlannerSelectedRequirementOptionIdsForScheduling({
        item,
        selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
        plan: input.plan,
      }),
    ]);
    const resolvedOptionIds = new Set(
      visibleGroup ? getSuggestedQuarterCourseOptionGroupResolvedOptionIds(visibleGroup) : []
    );
    const visibleCategoryLabels = new Set(
      (visibleGroup?.options ?? [])
        .filter((option) => isRequirementCategoryOption(option))
        .map((option) => getRequirementCategoryOptionLabel(option))
    );

    for (const option of group.options ?? []) {
      if (!isRequirementCategoryOption(option)) {
        continue;
      }

      const categoryLabel = getRequirementCategoryOptionLabel(option);
      const optionId = getRequirementOptionId(item, option, group.options.indexOf(option));
      const selected = selectedOptionIds.has(optionId);
      const visibleOption = visibleCategoryLabels.has(categoryLabel);
      const issue = (() => {
        if (!visibleOption) {
          return selected ? "selected-category-hidden" : "missing-category-option";
        }
        if (selected && !resolvedOptionIds.has(optionId)) {
          return "selected-category-unsatisfied";
        }
        return null;
      })();
      const completedCategoryCourses = getCompletedCourseCodesSatisfyingCategoryOption({
        option: {
          id: optionId || categoryLabel,
          optionKind: "category-option",
          label: categoryLabel,
          selectedLabel: categoryLabel,
          courseLabels: [],
          courseCodes: [],
          categoryOption: option.categoryOption ?? null,
          ...getRequirementCategoryOptionCreditRange(option),
        },
        completedCourses,
        campusId: input.plan.campusId,
      });

      pushRow({
        major,
        requirement: group.label || item.title || group.id,
        detectedCategoryOption: true,
        category: option.categoryOption?.sourceCategoryCode ?? option.categoryOption?.category ?? "",
        credits: option.categoryOption?.credits ?? null,
        sourceText: option.categoryOption?.sourceText ?? categoryLabel,
        visibleOption,
        selected,
        satisfiedByTranscriptCourse: completedCategoryCourses[0] ?? null,
        issue,
      });
    }
  }

  for (const sourceLine of getCategoryOptionSourceLinesForPlan(input.plan)) {
    const descriptor = getCategoryOptionAuditDescriptor(sourceLine);
    if (!descriptor || !/\bor\b|choose|select|one of/i.test(sourceLine)) {
      continue;
    }

    const matchingGroup = getTransferPlannerPlanChecklistItems(input.plan)
      .map((item) => item.requirementGroup)
      .filter((group): group is NonNullable<TransferPlannerChecklistItem["requirementGroup"]> =>
        Boolean(group)
      )
      .find((group) =>
        requirementGroupMatchesSourceLineCourses({
          group,
          sourceLine,
        })
      );

    if (
      !matchingGroup ||
      getRequirementGroupCategoryOptionLabels(matchingGroup).length ||
      (/earth science elective/i.test(sourceLine) && !/other\s*ssc|any\s*ssc/i.test(sourceLine))
    ) {
      continue;
    }

    pushRow({
      major,
      requirement: matchingGroup.label,
      detectedCategoryOption: false,
      category: descriptor.sourceCategoryCode,
      credits: parseCategoryOptionAuditCredits(sourceLine),
      sourceText: sourceLine,
      visibleOption: false,
      selected: false,
      satisfiedByTranscriptCourse: null,
      issue: "missing-category-option",
    });
  }

  return rows;
}

export function auditCategoryTranscriptSatisfaction(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
}) {
  if (!input.plan) {
    return [] as CategoryTranscriptSatisfactionAuditEntry[];
  }

  const completedCourses = input.completedCourses ?? [];
  const statuses = [
    ...buildRequirementStatuses(input.plan.applicationChecklist, completedCourses),
    ...buildRequirementStatuses(input.plan.beforeEnrollmentChecklist, completedCourses),
    ...buildRequirementStatuses(input.plan.stayAtGrcChecklist, completedCourses),
  ];
  const resolutions = buildSelectedCategoryTranscriptSatisfactionResolutions({
    plan: input.plan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
    statuses,
  });

  return resolutions.map<CategoryTranscriptSatisfactionAuditEntry>((resolution) => {
    const genericCategoryRowScheduled = input.suggestedPlan
      .filter((quarter) => quarter.phase === "planned" || quarter.phase === "current")
      .flatMap((quarter) => quarter.courses)
      .some(
        (course) =>
          course.optionGroup?.id === resolution.groupId &&
          course.label === resolution.categoryOptionLabel &&
          extractCourseCodes(course.label).length === 0
      );
    const visibleOptionStatusText = resolution.chosenTranscriptSatisfier
      ? `Selected: ${resolution.categoryOptionLabel}, satisfied by ${resolution.chosenTranscriptSatisfier}`
      : `Selected: ${resolution.categoryOptionLabel}`;
    const issue =
      resolution.chosenTranscriptSatisfier && genericCategoryRowScheduled
        ? "duplicate-category-placeholder"
        : resolution.chosenTranscriptSatisfier &&
            !visibleOptionStatusText.includes(resolution.chosenTranscriptSatisfier)
          ? "selected-category-status-missing-satisfier"
        : !resolution.chosenTranscriptSatisfier &&
            resolution.completedCandidateCourses.length > 0 &&
            resolution.rejectedCandidateCourses.length > 0
          ? "no-unused-category-satisfier"
          : null;

    return {
      major: input.plan?.title ?? input.plan?.id ?? "unknown",
      groupId: resolution.groupId,
      categoryOption: resolution.categoryOptionLabel,
      selected: true,
      category: resolution.category,
      creditsRequired: resolution.creditsRequired,
      completedCandidateCourses: resolution.completedCandidateCourses,
      rejectedCandidateCourses: resolution.rejectedCandidateCourses,
      chosenTranscriptSatisfier: resolution.chosenTranscriptSatisfier,
      chosenSatisfierAlreadyUsedByRequiredRow:
        resolution.chosenSatisfierAlreadyUsedByRequiredRow,
      genericCategoryRowScheduled,
      visibleOptionStatusText,
      issue,
      copyOnlyDebugText: [
        "[copy-only category transcript satisfaction audit]",
        `Major: ${input.plan?.title ?? input.plan?.id ?? "unknown"}`,
        `Group id: ${resolution.groupId}`,
        `Category option: ${resolution.categoryOptionLabel}`,
        "Selected: yes",
        `Category: ${resolution.category || "none"}`,
        `Credits required: ${resolution.creditsRequired ?? "none"}`,
        `Completed candidate courses: ${
          resolution.completedCandidateCourses.length
            ? resolution.completedCandidateCourses.join(", ")
            : "none"
        }`,
        `Rejected candidate courses: ${
          resolution.rejectedCandidateCourses.length
            ? resolution.rejectedCandidateCourses.join(", ")
            : "none"
        }`,
        `Chosen transcript satisfier: ${resolution.chosenTranscriptSatisfier ?? "none"}`,
        `Chosen satisfier already used by required row: ${
          resolution.chosenSatisfierAlreadyUsedByRequiredRow ? "yes" : "no"
        }`,
        `Generic category row scheduled: ${genericCategoryRowScheduled ? "yes" : "no"}`,
        `Visible option status text: ${visibleOptionStatusText}`,
        `Issue: ${issue ?? "none"}`,
      ].join(" "),
    };
  });
}

function formatAuditCreditRange(input: {
  creditAmount?: number | null;
  creditMin?: number | null;
  creditMax?: number | null;
} | null) {
  if (!input) {
    return "none";
  }

  const range = getSuggestedCourseCreditRangeFromValues(input);
  const minCredits = range.creditMin ?? range.creditAmount ?? null;
  const maxCredits = range.creditMax ?? range.creditAmount ?? minCredits;
  if (minCredits === null || maxCredits === null) {
    return "none";
  }

  return minCredits === maxCredits
    ? `${minCredits} credits`
    : `${minCredits}-${maxCredits} credits`;
}

function creditRangesMatch(
  displayedRange: {
    creditAmount?: number | null;
    creditMin?: number | null;
    creditMax?: number | null;
  },
  countedRange: {
    creditAmount?: number | null;
    creditMin?: number | null;
    creditMax?: number | null;
  } | null
) {
  if (!countedRange) {
    return true;
  }

  const displayed = getSuggestedCourseCreditRangeFromValues(displayedRange);
  const counted = getSuggestedCourseCreditRangeFromValues(countedRange);
  return (
    (displayed.creditMin ?? null) === (counted.creditMin ?? null) &&
    (displayed.creditMax ?? null) === (counted.creditMax ?? null)
  );
}

function getOptionSatisfactionSourceAuditValue(
  sources: SuggestedQuarterOptionSatisfactionSource[] | null | undefined
): OptionSelectionSourceAuditEntry["satisfiedBy"] {
  const sourceSet = new Set(sources ?? []);
  if (sourceSet.has("user-selected")) {
    return "user-selected";
  }
  if (sourceSet.has("transcript-completed")) {
    return "transcript";
  }
  if (sourceSet.has("planner-defaulted")) {
    return "default";
  }
  if (sourceSet.has("scheduled-and-counted")) {
    return "scheduled-counted";
  }
  return "none";
}

function getTrueOptionSatisfactionSourceAuditValue(
  sources: SuggestedQuarterOptionSatisfactionSource[] | null | undefined
): TrueOptionDetectionAuditEntry["satisfiedBy"] {
  const sourceSet = new Set(sources ?? []);
  if (sourceSet.has("user-selected")) {
    return "user-selected";
  }
  if (sourceSet.has("transcript-completed")) {
    return "transcript-completed";
  }
  if (sourceSet.has("planner-defaulted")) {
    return "planner-defaulted";
  }
  if (sourceSet.has("scheduled-and-counted")) {
    return "scheduled-counted";
  }
  return "none";
}

export function auditOptionCredits(input: {
  suggestedPlan: SuggestedQuarterPlan[];
}) {
  const optionGroupsById = collectSuggestedPlanOptionGroupsById(input.suggestedPlan);
  const rows: OptionCreditAuditEntry[] = [];
  const seenOptionKeys = new Set<string>();

  for (const optionGroup of optionGroupsById.values()) {
    for (const option of optionGroup.options) {
      const optionKey = `${optionGroup.id}:${option.id}`;
      if (seenOptionKeys.has(optionKey)) {
        continue;
      }
      seenOptionKeys.add(optionKey);

      const componentCourses = getRequirementOptionAllCourseCodes(option);
      const displayedCreditRange = {
        creditAmount: option.creditAmount,
        creditMin: option.creditMin,
        creditMax: option.creditMax,
      };
      const countedGrcCreditRange = isRequirementCategoryOption(option)
        ? displayedCreditRange
        : getCanonicalGrcCourseCreditRangeForCourseCodes(componentCourses);
      const issue = creditRangesMatch(displayedCreditRange, countedGrcCreditRange)
        ? null
        : "credit-display-mismatch";
      const displayedCredits = formatAuditCreditRange(displayedCreditRange);
      const countedGrcCredits = formatAuditCreditRange(countedGrcCreditRange);

      rows.push({
        option: option.label,
        displayedCredits,
        countedGrcCredits,
        componentCourses,
        issue,
        copyOnlyDebugText: [
          "[copy-only option credit audit]",
          `Option: ${option.label}`,
          `Displayed credits: ${displayedCredits}`,
          `Counted GRC credits: ${countedGrcCredits}`,
          `Component courses: ${componentCourses.length ? componentCourses.join(", ") : "none"}`,
          `Issue: ${issue ?? "none"}`,
        ].join(" "),
      });
    }
  }

  return rows;
}

export function auditOptionSelectionSources(input: {
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
}) {
  const completedCourseCodes = new Set(
    (input.completedCourses ?? [])
      .map((course) => normalizeCourseCode(course.code))
      .filter(Boolean)
  );
  const scheduledCourseCodes = getScheduledPlannerCountedCourseCodeSet(input.suggestedPlan);
  const optionGroupsById = collectSuggestedPlanOptionGroupsById(input.suggestedPlan);
  const rows: OptionSelectionSourceAuditEntry[] = [];

  for (const optionGroup of optionGroupsById.values()) {
    const resolvedOptionGroup = resolveOptionGroupForAudit({
      optionGroup,
      suggestedPlan: input.suggestedPlan,
      completedCourses: input.completedCourses ?? [],
      completedCourseCodes,
      scheduledCourseCodes,
    });
    const displayedSelectedOptionIds = new Set(
      getSuggestedQuarterCourseOptionGroupResolvedOptionIds(resolvedOptionGroup)
    );

    for (const option of resolvedOptionGroup.options) {
      const sources = resolvedOptionGroup.optionSatisfactionSourcesById?.[option.id] ?? [];
      const satisfiedBy = getOptionSatisfactionSourceAuditValue(sources);
      const displayedAsSelected = displayedSelectedOptionIds.has(option.id);
      const issue =
        (satisfiedBy === "none" && displayedAsSelected) ||
        (satisfiedBy !== "none" && !displayedAsSelected)
          ? "source-mismatch"
          : null;

      rows.push({
        groupId: resolvedOptionGroup.id,
        optionId: option.id,
        satisfiedBy,
        displayedAsSelected,
        issue,
        copyOnlyDebugText: [
          "[copy-only option selection source audit]",
          `Group id: ${resolvedOptionGroup.id}`,
          `Option id: ${option.id}`,
          `Satisfied by: ${satisfiedBy}`,
          `Displayed as selected: ${displayedAsSelected ? "yes" : "no"}`,
          `Issue: ${issue ?? "none"}`,
        ].join(" "),
      });
    }
  }

  return rows;
}

function getVisibleOrCompletedCourseCodeSet(input: {
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
}) {
  return new Set(
    [
      ...input.suggestedPlan.flatMap((quarter) =>
        quarter.courses.flatMap((course) => getSuggestedQuarterCourseSatisfyingCourseCodes(course))
      ),
      ...(input.completedCourses ?? []).map((course) => course.code),
    ]
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function getMappedGrcCourseCodesForRequiredUwCourse(
  plan: TransferPlannerMajorPlan,
  uwCourseCode: string
) {
  return getBestGrcEquivalentPathCourseCodesForUwCourse(plan, uwCourseCode);
}

function getSourceBackedRequiredUwRequirementLabels(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  const scopedRequirementLabels =
    getChemicalEngineeringSourceBackedRequiredUwRequirementLabels(plan);
  if (scopedRequirementLabels) {
    return scopedRequirementLabels;
  }

  const labelsByCourseCode = new Map<string, string>();
  if (!plan) {
    return labelsByCourseCode;
  }

  const trueOptionUwCourseCodes = getTrueOptionUwCourseCodeSet(plan);
  let sawStructuredRequirementCourses = false;
  for (const block of getSourceBackedRequirementSourceBlocksForPlan(plan)) {
    const structuredRequirementCourses = block.parsedRequirementCourses ?? [];
    if (structuredRequirementCourses.length) {
      sawStructuredRequirementCourses = true;
      for (const course of structuredRequirementCourses) {
        if (course.optionRole !== "required") {
          continue;
        }

        const courseCode = normalizeCourseCode(course.normalizedCourseCode || course.courseCode);
        if (
          !courseCode ||
          labelsByCourseCode.has(courseCode) ||
          trueOptionUwCourseCodes.has(courseCode) ||
          !shouldAllowSourceScopedRequiredUwCourse(plan, courseCode) ||
          !shouldIncludeSourceBackedParsedRequiredCourseCandidate({
            uwCourseCode: courseCode,
            sourceLineHints: [course.sourceHeading, course.sourceCategory],
          })
        ) {
          continue;
        }

        labelsByCourseCode.set(
          courseCode,
          String(course.title ?? course.courseCode ?? courseCode).trim() || courseCode
        );
      }
    }
  }

  if (sawStructuredRequirementCourses) {
    for (const [courseCode, label] of getChecklistBackedRequiredUwRequirementLabels(plan)) {
      if (!labelsByCourseCode.has(courseCode)) {
        labelsByCourseCode.set(courseCode, label);
      }
    }
    return labelsByCourseCode;
  }

  for (const block of getSourceBackedRequirementSourceBlocksForPlan(plan)) {
    for (const candidate of block.parsedRequirementAtomCandidates ?? []) {
      if (!shouldIncludeSourceBackedParsedRequiredCourseCandidate(candidate)) {
        continue;
      }

      const courseCode = normalizeCourseCode(candidate.uwCourseCode ?? "");
      if (!courseCode || labelsByCourseCode.has(courseCode)) {
        continue;
      }
      if (!shouldAllowSourceScopedRequiredUwCourse(plan, courseCode)) {
        continue;
      }
      if (trueOptionUwCourseCodes.has(courseCode)) {
        continue;
      }

      labelsByCourseCode.set(
        courseCode,
        String(candidate.title ?? candidate.uwCourseCode ?? courseCode).trim() || courseCode
      );
    }
  }

  for (const [courseCode, label] of getChecklistBackedRequiredUwRequirementLabels(plan)) {
    if (!labelsByCourseCode.has(courseCode)) {
      labelsByCourseCode.set(courseCode, label);
    }
  }

  return labelsByCourseCode;
}

function getChecklistBackedRequiredUwRequirementLabels(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  const labelsByCourseCode = new Map<string, string>();
  if (!plan) {
    return labelsByCourseCode;
  }

  for (const item of [
    ...(plan.applicationChecklist ?? []),
    ...(plan.beforeEnrollmentChecklist ?? []),
    ...(plan.stayAtGrcChecklist ?? []),
  ]) {
    if (!shouldAllowSourceScopedRequiredChecklistItem(plan, item)) {
      continue;
    }

    if (!shouldTreatChecklistItemPrimaryCoursesAsRequired(item)) {
      continue;
    }

    const itemLabel = String(item.title ?? "").trim();
    for (const courseCode of extractCourseCodes(itemLabel)) {
      const normalizedCourseCode = normalizeCourseCode(courseCode);
      if (normalizedCourseCode && !labelsByCourseCode.has(normalizedCourseCode)) {
        labelsByCourseCode.set(normalizedCourseCode, itemLabel || normalizedCourseCode);
      }
    }

    for (const grcCourseCode of getRequiredChecklistCourseLabels(item).flatMap((label) =>
      extractCourseCodes(label)
    )) {
      for (const uwCourseCode of buildBestSingleCourseUwEquivalentCourseCodes(
        grcCourseCode,
        plan.campusId
      )) {
        const normalizedUwCourseCode = normalizeCourseCode(uwCourseCode);
        if (normalizedUwCourseCode && !labelsByCourseCode.has(normalizedUwCourseCode)) {
          labelsByCourseCode.set(normalizedUwCourseCode, itemLabel || normalizedUwCourseCode);
        }
      }
    }
  }

  return labelsByCourseCode;
}

export function auditSourceScope(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
}) {
  const requiredUwCourseCodes = getSourceBackedRequiredUwCourseCodeSet(input.plan);
  const scheduledCourseCodes = getScheduledPlannerCourseCodeSet(input.suggestedPlan);
  if (isEnvironmentalEngineeringPlan(input.plan)) {
    const completedCourseCodes = new Set(
      (input.completedCourses ?? []).map((c) => normalizeCourseCode(c.code))
    );

    return ENVIRONMENTAL_ENGINEERING_EARTH_SCIENCE_OPTION_ROWS.map((row) => {
      const promotedToRequired = requiredUwCourseCodes.has(row.uwCourse);
      const scheduled = scheduledCourseCodes.has(row.grcEquivalent);

      let isSelected = false;
      let isDefaulted = false;
      for (const quarter of input.suggestedPlan) {
        for (const course of quarter.courses) {
          const courseCodes = getSuggestedQuarterCourseSatisfyingCourseCodes(course).map(normalizeCourseCode);
          if (courseCodes.includes(row.grcEquivalent)) {
            if (course.optionGroup?.selectionSource === "student") isSelected = true;
            if (course.optionGroup?.selectionSource === "default") isDefaulted = true;
          }
        }
      }

      const isTranscriptSatisfied = completedCourseCodes.has(row.grcEquivalent);
      const allowedToSchedule = isSelected || isDefaulted || isTranscriptSatisfied;

      let issue: "false-required-promotion" | null = null;
      if (promotedToRequired) {
        issue = "false-required-promotion";
      } else if (scheduled && !allowedToSchedule) {
        issue = "false-required-promotion";
      }

      const major = input.plan?.title ?? input.plan?.id ?? "Environmental Engineering";

      return {
        major,
        uwCourse: row.uwCourse,
        sourceSection: row.sourceSection,
        detectedRole: "option-list",
        promotedToRequired,
        allowedToSchedule,
        reason: row.reason,
        issue,
        copyOnlyDebugText: [
          "[copy-only source-scope audit]",
          `Major: ${major}`,
          `UW course: ${row.uwCourse}`,
          `Source section: ${row.sourceSection}`,
          "Detected role: option-list",
          `Promoted to required: ${promotedToRequired ? "yes" : "no"}`,
          "Allowed to schedule: only if selected/defaulted/transcript-satisfied",
          `Reason: ${row.reason}`,
          `Issue: ${issue ?? "none"}`,
        ].join(" "),
      } satisfies SourceScopeAuditEntry;
    });
  }

  if (!isChemicalEngineeringPlan(input.plan)) {
    return [] as SourceScopeAuditEntry[];
  }

  const rows = CHEMICAL_ENGINEERING_ELECTIVE_LIST_FALSE_REQUIRED_ROWS.map((row) => {
    const promotedToRequired = requiredUwCourseCodes.has(row.uwCourse);
    const scheduled = scheduledCourseCodes.has(row.grcEquivalent);
    const allowedToSchedule = false;
    const issue =
      promotedToRequired || scheduled ? "false-required-promotion" : null;
    const reason =
      `${row.reason} GRC equivalent ${row.grcEquivalent} should remain unscheduled unless a current Chemical Engineering source explicitly requires ${row.uwCourse}.`;

    return {
      major: input.plan?.title ?? input.plan?.id ?? "Chemical Engineering",
      uwCourse: row.uwCourse,
      sourceSection: row.sourceSection,
      detectedRole: "elective-list",
      promotedToRequired,
      allowedToSchedule,
      reason,
      issue,
      copyOnlyDebugText: [
        "[copy-only source-scope audit]",
        `Major: ${input.plan?.title ?? input.plan?.id ?? "Chemical Engineering"}`,
        `UW course: ${row.uwCourse}`,
        `Source section: ${row.sourceSection}`,
        "Detected role: elective-list",
        `Promoted to required: ${promotedToRequired ? "yes" : "no"}`,
        `Allowed to schedule: ${allowedToSchedule ? "yes" : "no"}`,
        `Reason: ${reason}`,
        `Issue: ${issue ?? "none"}`,
      ].join(" "),
    } satisfies SourceScopeAuditEntry;
  });

  return rows;
}

function parsedSourceRowLooksLikeMergedAdjacentRows(rawRowText: string) {
  const text = stripSourcePagePrefix(rawRowText);
  if (!text) {
    return false;
  }

  return /\([^)]*\bor\b[^)]*\)\s*\d*(?:-\d+)?\s*cr\.?\s+[A-Z][^()]{2,120}\([A-Z]{1,8}(?:\s+[A-Z]{1,8})?\s+\d{3}/i.test(
    text
  );
}

function getParsedRequirementGroupUwCourses(
  group: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>
) {
  return unique(
    (group.options ?? [])
      .flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
        ...(option.displayCourseCodes ?? []),
      ])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

export function auditSourceRowBoundaries(input: {
  plan?: TransferPlannerMajorPlan | null;
}) {
  if (!input.plan) {
    return [] as SourceRowBoundaryAuditEntry[];
  }

  const major = input.plan.title ?? input.plan.id ?? "unknown";
  const rows: SourceRowBoundaryAuditEntry[] = [];
  const seenKeys = new Set<string>();
  const requiredUwCourseCodes = getSourceBackedRequiredUwCourseCodeSet(input.plan);
  const primarySourceUrl =
    getTransferPlannerPrimaryDegreeRequirementsSource(
      input.plan.id,
      getSelectedPathwayId(input.plan)
    )?.url ?? "unknown";

  const pushRow = (row: Omit<SourceRowBoundaryAuditEntry, "copyOnlyDebugText">) => {
    const key = `${row.sourceUrl}|${row.rawRowText}|${row.parsedUwCourses.join(",")}`;
    if (seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);
    rows.push({
      ...row,
      copyOnlyDebugText: [
        "[copy-only source row-boundary audit]",
        `Major: ${row.major}`,
        `Source URL: ${row.sourceUrl}`,
        `Raw row text: ${row.rawRowText || "none"}`,
        `Parsed requirement title: ${row.parsedRequirementTitle || "none"}`,
        `Parsed UW courses: ${
          row.parsedUwCourses.length ? row.parsedUwCourses.join(", ") : "none"
        }`,
        `Expected row split: ${row.expectedRowSplit ? "yes" : "no"}`,
        `Issue: ${row.issue ?? "none"}`,
      ].join(" "),
    });
  };
  const pushRequirementGroupRow = (
    group: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>,
    sourceUrl: string
  ) => {
    const rawRowText = String(group.sourceHeading ?? group.label ?? "").trim();
    const parsedUwCourses = getParsedRequirementGroupUwCourses(group);
    const expectedRowSplit = parsedSourceRowLooksLikeMergedAdjacentRows(rawRowText);
    pushRow({
      major,
      sourceUrl,
      rawRowText,
      parsedRequirementTitle: String(group.label ?? "").trim(),
      parsedUwCourses,
      expectedRowSplit,
      issue: expectedRowSplit ? "merged-adjacent-rows" : null,
    });
  };

  for (const block of getSourceBackedRequirementSourceBlocksForPlan(input.plan)) {
    const sourceUrl = primarySourceUrl;

    for (const group of block.parsedRequirementGroups ?? []) {
      pushRequirementGroupRow(group, sourceUrl);
    }

    const trueOptionUwCourseCodes = getTrueOptionUwCourseCodeSet(input.plan);
    for (const candidate of block.parsedRequirementAtomCandidates ?? []) {
      const uwCourseCode = normalizeCourseCode(candidate.uwCourseCode ?? "");
      if (!uwCourseCode || trueOptionUwCourseCodes.has(uwCourseCode)) {
        continue;
      }
      const rawRowText =
        (candidate.sourceLineHints ?? []).find((hint) =>
          sourceHintLooksLikeHiddenUnmappedRequiredCoreRow({ hint, uwCourseCode })
        ) ?? "";
      if (!rawRowText) {
        continue;
      }
      const missingRequiredRow =
        !requiredUwCourseCodes.has(uwCourseCode) &&
        getMappedGrcCourseCodesForRequiredUwCourse(input.plan, uwCourseCode).length > 0;
      pushRow({
        major,
        sourceUrl,
        rawRowText,
        parsedRequirementTitle: getBestParsedRequirementCandidateLabel(candidate),
        parsedUwCourses: [uwCourseCode],
        expectedRowSplit: false,
        issue: missingRequiredRow ? "missing-required-row" : null,
      });
    }
  }

  for (const group of input.plan.requirementGroups ?? []) {
    pushRequirementGroupRow(group, primarySourceUrl);
  }

  return rows;
}

export function auditRequiredMappedCourseCoverage(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
}) {
  if (!input.plan) {
    return [] as RequiredMappedCourseCoverageAuditEntry[];
  }

  const requiredUwCourseCodes = getSourceBackedRequiredUwCourseCodeSet(input.plan);
  const auditOnlyHiddenRequirementLabels =
    getAuditOnlyHiddenUnmappedRequiredUwRequirementLabels(input.plan, requiredUwCourseCodes);
  const auditUwCourseCodes = new Set([
    ...requiredUwCourseCodes,
    ...auditOnlyHiddenRequirementLabels.keys(),
  ]);
  const requirementLabels = new Map([
    ...getSourceBackedRequiredUwRequirementLabels(input.plan),
    ...auditOnlyHiddenRequirementLabels,
  ]);
  const visibleOrCompletedCourseCodes = getVisibleOrCompletedCourseCodeSet(input);
  const completedCourseCodes = new Set(
    (input.completedCourses ?? [])
      .map((course) => normalizeCourseCode(course.code))
      .filter(Boolean)
  );

  return [...auditUwCourseCodes].sort().map((uwCourseCode) => {
    const mappedGrcEquivalentPath = getMappedGrcCourseCodesForRequiredUwCourse(
      input.plan as TransferPlannerMajorPlan,
      uwCourseCode
    );
    const visibleMappedComponents = mappedGrcEquivalentPath.filter((courseCode) =>
      visibleOrCompletedCourseCodes.has(courseCode)
    );
    const completedMappedComponents = mappedGrcEquivalentPath.filter((courseCode) =>
      completedCourseCodes.has(courseCode)
    );
    const visibleInPlan =
      mappedGrcEquivalentPath.length > 0 &&
      visibleMappedComponents.length === mappedGrcEquivalentPath.length;
    const alreadyCompleted =
      completedCourseCodes.has(uwCourseCode) ||
      (mappedGrcEquivalentPath.length > 0 &&
        completedMappedComponents.length === mappedGrcEquivalentPath.length);
    const requirementType = mappedGrcEquivalentPath.length
      ? mappedGrcEquivalentPath.length > 1
        ? "compound-path"
        : "single"
      : "hidden-unmapped";
    const hiddenReason =
      visibleInPlan || alreadyCompleted
        ? null
        : mappedGrcEquivalentPath.length
          ? null
          : "UW-only/unmapped: no source-backed Green River equivalent is currently mapped.";
    const issue = (() => {
      if (!mappedGrcEquivalentPath.length || visibleInPlan || alreadyCompleted) {
        return null;
      }

      if (mappedGrcEquivalentPath.length > 1 && visibleMappedComponents.length > 0) {
        return "partial-compound-path";
      }

      return "missing-required-mapped-course";
    })();

    return {
      major: input.plan?.title ?? input.plan?.id ?? "unknown",
      uwRequirement: requirementLabels.get(uwCourseCode) ?? uwCourseCode,
      uwCourse: uwCourseCode,
      mappedGrcEquivalentPath,
      requirementType,
      visibleInPlan,
      alreadyCompleted,
      hiddenReason,
      issue,
      copyOnlyDebugText: [
        "[copy-only required coverage audit]",
        `Major: ${input.plan?.title ?? input.plan?.id ?? "unknown"}`,
        `UW requirement: ${requirementLabels.get(uwCourseCode) ?? uwCourseCode}`,
        `UW course: ${uwCourseCode}`,
        `Mapped GRC equivalent/path: ${
          mappedGrcEquivalentPath.length ? mappedGrcEquivalentPath.join(", ") : "none"
        }`,
        `Requirement type: ${requirementType}`,
        `Visible in plan: ${visibleInPlan ? "yes" : "no"}`,
        `Already completed: ${alreadyCompleted ? "yes" : "no"}`,
        `Hidden reason: ${hiddenReason ?? "none"}`,
        `Issue: ${issue ?? "none"}`,
      ].join(" "),
    } satisfies RequiredMappedCourseCoverageAuditEntry;
  });
}

export function auditCompoundEquivalencyPaths(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
}) {
  if (!input.plan) {
    return [] as CompoundEquivalencyPathAuditEntry[];
  }

  const requiredUwCourseCodes = getSourceBackedRequiredUwCourseCodeSet(input.plan);
  const requirementLabels = getSourceBackedRequiredUwRequirementLabels(input.plan);
  const completedCourseCodes = new Set(
    (input.completedCourses ?? [])
      .map((course) => normalizeCourseCode(course.code))
      .filter(Boolean)
  );
  const scheduledCourseCodes = getScheduledPlannerCountedCourseCodeSet(input.suggestedPlan);
  const major = input.plan.title ?? input.plan.id ?? "unknown";
  const rows: CompoundEquivalencyPathAuditEntry[] = [];

  for (const uwCourseCode of [...requiredUwCourseCodes].sort()) {
    const grcCompoundPath = getMappedGrcCourseCodesForRequiredUwCourse(input.plan, uwCourseCode);
    if (grcCompoundPath.length <= 1) {
      continue;
    }

    const completedComponents = grcCompoundPath.filter((courseCode) =>
      completedCourseCodes.has(courseCode)
    );
    const scheduledComponents = grcCompoundPath.filter((courseCode) =>
      scheduledCourseCodes.has(courseCode)
    );
    const missingComponents = grcCompoundPath.filter(
      (courseCode) => !completedCourseCodes.has(courseCode) && !scheduledCourseCodes.has(courseCode)
    );
    const satisfied = missingComponents.length === 0;
    const issue = satisfied
      ? null
      : completedComponents.length || scheduledComponents.length
        ? "partial-compound-path"
        : "missing-compound-path";

    rows.push({
      major,
      uwRequirement: requirementLabels.get(uwCourseCode) ?? uwCourseCode,
      uwCourse: uwCourseCode,
      grcCompoundPath,
      completedComponents,
      scheduledComponents,
      missingComponents,
      satisfied,
      issue,
      copyOnlyDebugText: [
        "[copy-only compound equivalency audit]",
        `Major: ${major}`,
        `UW requirement: ${requirementLabels.get(uwCourseCode) ?? uwCourseCode}`,
        `UW course: ${uwCourseCode}`,
        `GRC compound path: ${grcCompoundPath.join(", ")}`,
        `Completed components: ${completedComponents.length ? completedComponents.join(", ") : "none"}`,
        `Scheduled components: ${scheduledComponents.length ? scheduledComponents.join(", ") : "none"}`,
        `Missing components: ${missingComponents.length ? missingComponents.join(", ") : "none"}`,
        `Satisfied: ${satisfied ? "yes" : "no"}`,
        `Issue: ${issue ?? "none"}`,
      ].join(" "),
    });
  }

  return rows;
}

function getRequirementGroupAcceptedUwOptionCodes(
  group: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>
) {
  return unique(
    (group.options ?? [])
      .flatMap((option) => [
        ...getRequirementOptionUwCourseCodes(option),
        ...(option.displayCourseCodes ?? []).map((courseCode) => normalizeCourseCode(courseCode)),
      ])
      .filter(Boolean)
  );
}

function getRequirementGroupMappedGrcOptionCodes(
  group: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>
) {
  return sortCourseCodes(
    (group.options ?? [])
      .flatMap((option) => option.grcMatches ?? [])
      .flatMap((label) => extractCourseCodes(label))
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter((courseCode) => Boolean(courseCode && getTransferPlannerCanonicalCourse("grc", courseCode)))
  );
}

function formatCreditRangeForAudit(creditMin: number | null, creditMax: number | null) {
  if (creditMin === null && creditMax === null) {
    return "none";
  }
  if (creditMin !== null && creditMax !== null && creditMin !== creditMax) {
    return `${creditMin}-${creditMax}`;
  }
  return String(creditMin ?? creditMax ?? "none");
}

function getComputerEngineeringCreditBucketItem(input: {
  plan: TransferPlannerMajorPlan;
  groupIdSuffix: string;
}) {
  const expectedGroupId = `${input.plan.id}:requirement-group:${input.groupIdSuffix}`;
  return getTransferPlannerPlanChecklistItems(input.plan).find(
    (item) => item.requirementGroup?.id === expectedGroupId
  ) ?? null;
}

function getPlannedCreditRangeForOptionGroup(input: {
  suggestedPlan: SuggestedQuarterPlan[];
  groupId: string;
}) {
  let creditMin = 0;
  let creditMax = 0;
  let sawCourse = false;

  for (const course of input.suggestedPlan
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses)) {
    if (course.status === "completed" || course.optionGroup?.id !== input.groupId) {
      continue;
    }

    const range = getSuggestedQuarterCourseCreditRange(course);
    creditMin += range.creditMin;
    creditMax += range.creditMax;
    sawCourse = true;
  }

  return sawCourse
    ? {
        creditMin,
        creditMax,
      }
    : {
        creditMin: null,
        creditMax: null,
      };
}

function getCompletedTranscriptCoursesSatisfyingRequirementGroup(input: {
  group: NonNullable<TransferPlannerChecklistItem["requirementGroup"]>;
  completedCourses?: TranscriptCourseEntry[];
}) {
  const completedCourseCodes = new Set(
    (input.completedCourses ?? [])
      .map((course) => normalizeCourseCode(course.code))
      .filter(Boolean)
  );
  if (!completedCourseCodes.size) {
    return [] as string[];
  }

  return sortCourseCodes(
    (input.group.options ?? [])
      .filter((option) => option.optionKind !== "category-option")
      .flatMap((option) => getRequirementOptionAllCourseCodes(option))
      .filter((courseCode) => completedCourseCodes.has(normalizeCourseCode(courseCode)))
  );
}

export function auditComputerEngineeringCreditBuckets(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
}) {
  if (!isComputerEngineeringPlan(input.plan)) {
    return [] as ComputerEngineeringCreditBucketAuditEntry[];
  }

  const major = input.plan?.title ?? input.plan?.id ?? "Computer Engineering";
  const visibleOptionGroupsById = collectSuggestedPlanOptionGroupsById(input.suggestedPlan);
  return COMPUTER_ENGINEERING_CREDIT_BUCKET_ROWS.map((row) => {
    const item = getComputerEngineeringCreditBucketItem({
      plan: input.plan as TransferPlannerMajorPlan,
      groupIdSuffix: row.groupIdSuffix,
    });
    const group = item?.requirementGroup ?? null;
    const groupId = group?.id ?? `${input.plan?.id}:requirement-group:${row.groupIdSuffix}`;
    const visibleGroup = visibleOptionGroupsById.get(groupId) ?? null;
    const satisfactionMode =
      visibleGroup && isSuggestedQuarterCreditBasedOptionGroup(visibleGroup)
        ? "credit-based"
        : "selection-count";
    const mappedConcreteOptions = group ? getRequirementGroupMappedGrcOptionCodes(group) : [];
    const filterSource =
      row.groupIdSuffix === "approved-natural-science-10-credits"
        ? COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_PARAM
        : null;
    const excludedGenericCategoryCourses =
      filterSource === COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_PARAM
        ? getComputerEngineeringApprovedNaturalScienceExcludedGenericCategoryRows()
            .slice(0, 12)
            .map((entry) => entry.course)
        : [];
    const categoryOptionLabels = group
      ? group.options
          .filter((option) => option.optionKind === "category-option")
          .map((option) => getRequirementCategoryOptionLabel(option))
          .filter(Boolean)
      : [];
    const selectedOptionIds = visibleGroup
      ? getSuggestedQuarterCourseOptionGroupResolvedOptionIds(visibleGroup)
      : [];
    const categoryOptionIds = visibleGroup
      ? new Set(getCategoryOptionIds(visibleGroup))
      : new Set<string>();
    const selectedPlaceholder = selectedOptionIds.some((optionId) =>
      categoryOptionIds.has(optionId)
    );
    const selectedConcreteOptionIds = selectedOptionIds.filter(
      (optionId) => !categoryOptionIds.has(optionId)
    );
    const selectedConcreteOptions = visibleGroup
      ? getRequirementOptionDisplayLabelsByIds(visibleGroup, selectedConcreteOptionIds)
      : [];
    const categoryListPlaceholderVisible = input.suggestedPlan
      .flatMap((quarter) => quarter.courses)
      .some((course) => {
        if (course.optionGroup?.id !== groupId) {
          return false;
        }
        if ((course.optionGroup.options ?? []).some((option) => option.optionKind === "category-option")) {
          return true;
        }
        return categoryOptionLabels.includes(course.label);
      });
    const satisfiedByTranscriptCourses = group
      ? getCompletedTranscriptCoursesSatisfyingRequirementGroup({
          group,
          completedCourses: input.completedCourses,
        })
      : [];
    const creditSatisfaction =
      visibleGroup && isSuggestedQuarterCreditBasedOptionGroup(visibleGroup)
        ? getSuggestedQuarterOptionGroupCreditSatisfaction({
            optionGroup: visibleGroup,
            optionIds: selectedOptionIds,
          })
        : null;
    const selectedPlaceholderRange =
      visibleGroup && selectedPlaceholder
        ? getSuggestedQuarterOptionGroupSatisfyingCreditRange({
            optionGroup: visibleGroup,
            optionIds: selectedOptionIds.filter((optionId) => categoryOptionIds.has(optionId)),
          })
        : null;
    const requiredCredits = creditSatisfaction?.requiredCredits ?? null;
    const remainingConcreteCredits =
      requiredCredits !== null && !selectedPlaceholder
        ? Math.max(0, requiredCredits - (creditSatisfaction?.creditMax ?? 0))
        : null;
    const plannedRange = getPlannedCreditRangeForOptionGroup({
      suggestedPlan: input.suggestedPlan,
      groupId,
    });
    const remainingPlaceholderCourses = input.suggestedPlan
      .filter((quarter) => quarter.phase === "planned" || quarter.phase === "current")
      .flatMap((quarter) => quarter.courses)
      .filter(
        (course) =>
          (course.sourceRequirementGroupId === groupId || course.optionGroup?.id === groupId) &&
          course.courseRole === "unresolved-credit-bucket-remainder"
      );
    const remainingPlaceholderScheduled = remainingPlaceholderCourses.length > 0;
    const remainingPlaceholderCredits = remainingPlaceholderCourses.reduce((total, course) => {
      const range = getSuggestedQuarterCourseCreditRange(course);
      return total + (range.creditMax || range.creditMin || 0);
    }, 0);
    const plannedUnresolvedCredits = selectedPlaceholderRange
      ? formatCreditRangeForAudit(
          selectedPlaceholderRange.creditMin,
          selectedPlaceholderRange.creditMax
        )
      : remainingConcreteCredits !== null
        ? formatCreditRangeForAudit(remainingConcreteCredits, remainingConcreteCredits)
        : formatCreditRangeForAudit(plannedRange.creditMin, plannedRange.creditMax);
    const completedSatisfyingCourses = visibleGroup?.completedSatisfyingCourseCodes ?? [];
    const scheduledSatisfyingCourses = visibleGroup?.scheduledSatisfyingCourseCodes ?? [];
    const totalSatisfyingCredits = creditSatisfaction
      ? formatCreditRangeValueForProgress(creditSatisfaction.creditMin, creditSatisfaction.creditMax)
      : "none";
    const displayedCreditProgress =
      creditSatisfaction?.displayedProgress ?? `0/${row.creditsRequired}`;
    const fullySatisfied = creditSatisfaction?.fullySatisfied ?? false;
    const remainingUnresolvedCredits =
      remainingPlaceholderScheduled && remainingPlaceholderCredits > 0
        ? formatCreditRangeForAudit(remainingPlaceholderCredits, remainingPlaceholderCredits)
        : plannedUnresolvedCredits;
    const issue =
      !group || (!categoryListPlaceholderVisible && !satisfiedByTranscriptCourses.length)
        ? "missing-credit-bucket"
        : satisfactionMode !== "credit-based"
          ? "selection-count-used-for-credit-bucket"
          : selectedConcreteOptionIds.length > 0 && !fullySatisfied && !remainingPlaceholderScheduled
            ? "insufficient-credit-selection"
            : null;

    return {
      major,
      requirement: row.requirement,
      creditsRequired: row.creditsRequired,
      requiredCredits: row.creditsRequired,
      satisfactionMode,
      filterSource,
      mappedConcreteOptions,
      excludedGenericCategoryCourses,
      selectedConcreteOptions,
      selectedPlaceholder,
      categoryListPlaceholderVisible,
      completedSatisfyingCourses,
      scheduledSatisfyingCourses,
      satisfiedByTranscriptCourses,
      totalSatisfyingCredits,
      displayedCreditProgress,
      fullySatisfied,
      remainingUnresolvedCredits,
      remainingPlaceholderScheduled,
      plannedUnresolvedCredits,
      issue,
      copyOnlyDebugText: [
        "[copy-only credit bucket audit]",
        `Major: ${major}`,
        `Requirement: ${row.requirement}`,
        `Credits required: ${row.creditsRequired}`,
        `Required credits: ${row.creditsRequired}`,
        `Satisfaction mode: ${satisfactionMode}`,
        `Filter source: ${filterSource ?? "none"}`,
        `Selected placeholder: ${selectedPlaceholder ? "yes" : "no"}`,
        `Selected concrete options: ${
          selectedConcreteOptions.length ? selectedConcreteOptions.join(", ") : "none"
        }`,
        `Mapped concrete options: ${
          mappedConcreteOptions.length ? mappedConcreteOptions.join(", ") : "none"
        }`,
        `Excluded generic category courses: ${
          excludedGenericCategoryCourses.length
            ? excludedGenericCategoryCourses.join(", ")
            : "none"
        }`,
        `Category/list placeholder visible: ${
          categoryListPlaceholderVisible ? "yes" : "no"
        }`,
        `Completed satisfying courses: ${
          completedSatisfyingCourses.length ? completedSatisfyingCourses.join(", ") : "none"
        }`,
        `Scheduled satisfying courses: ${
          scheduledSatisfyingCourses.length ? scheduledSatisfyingCourses.join(", ") : "none"
        }`,
        `Satisfied by transcript courses: ${
          satisfiedByTranscriptCourses.length ? satisfiedByTranscriptCourses.join(", ") : "none"
        }`,
        `Total satisfying credits: ${totalSatisfyingCredits}`,
        `Displayed credit progress: ${displayedCreditProgress}`,
        `Fully satisfied: ${fullySatisfied ? "yes" : "no"}`,
        `Remaining unresolved credits: ${remainingUnresolvedCredits}`,
        `Remaining placeholder scheduled: ${remainingPlaceholderScheduled ? "yes" : "no"}`,
        `Planned unresolved credits: ${plannedUnresolvedCredits}`,
        `Issue: ${issue ?? "none"}`,
      ].join(" "),
    } satisfies ComputerEngineeringCreditBucketAuditEntry;
  });
}

function resolveChecklistTrueOptionSatisfactionSource(input: {
  item: TransferPlannerChecklistItem;
  completedCourseCodes: Set<string>;
  scheduledCourseCodes: Set<string>;
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
}): TrueOptionDetectionAuditEntry["satisfiedBy"] {
  const group = input.item.requirementGroup;
  if (!group) {
    return "none";
  }

  const selectedOptionIds = getPlannerSelectedRequirementOptionIds(
    input.item,
    input.selectedRequirementOptionIdsByGroup
  );
  if (
    selectedOptionIds.length &&
    hasExplicitPlannerSelectedRequirementOptionIds(
      input.item,
      input.selectedRequirementOptionIdsByGroup
    )
  ) {
    return "user-selected";
  }

  for (const option of group.options ?? []) {
    const optionCourseCodes = getRequirementOptionAllCourseCodes(option);
    if (optionCourseCodes.some((courseCode) => input.completedCourseCodes.has(courseCode))) {
      return "transcript-completed";
    }
  }

  if (selectedOptionIds.length) {
    return "planner-defaulted";
  }

  for (const option of group.options ?? []) {
    const optionCourseCodes = getRequirementOptionAllCourseCodes(option);
    if (optionCourseCodes.some((courseCode) => input.scheduledCourseCodes.has(courseCode))) {
      return "scheduled-counted";
    }
  }

  return "none";
}

export function auditTrueOptionDetection(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
}) {
  if (!input.plan) {
    return [] as TrueOptionDetectionAuditEntry[];
  }

  const completedCourseCodes = new Set(
    (input.completedCourses ?? [])
      .map((course) => normalizeCourseCode(course.code))
      .filter(Boolean)
  );
  const scheduledCourseCodes = getScheduledPlannerCountedCourseCodeSet(input.suggestedPlan);
  const optionGroupsById = collectSuggestedPlanOptionGroupsById(input.suggestedPlan);
  const major = input.plan.title ?? input.plan.id ?? "unknown";
  const rows: TrueOptionDetectionAuditEntry[] = [];
  const seenGroupIds = new Set<string>();

  for (const item of getTransferPlannerPlanChecklistItems(input.plan)) {
    const group = item.requirementGroup;
    if (!group || seenGroupIds.has(group.id)) {
      continue;
    }
    seenGroupIds.add(group.id);

    const detectedAsTrueOption = requirementGroupLooksLikeTrueOption(group);
    const visibleOptionGroup = optionGroupsById.has(group.id);
    const visibleGroup = optionGroupsById.get(group.id);
    const acceptedUwOptions = getRequirementGroupAcceptedUwOptionCodes(group);
    const mappedGrcOptions = getRequirementGroupMappedGrcOptionCodes(group);
    const requiredCount = getRequirementOptionSelectionCount(item);
    const satisfiedBy = visibleGroup
      ? getTrueOptionSatisfactionSourceAuditValue(
          Object.values(
            resolveOptionGroupForAudit({
              optionGroup: visibleGroup,
              suggestedPlan: input.suggestedPlan,
              completedCourses: input.completedCourses ?? [],
              completedCourseCodes,
              scheduledCourseCodes,
              plan: input.plan,
              requirementStatuses: [
                ...buildRequirementStatuses(input.plan.applicationChecklist, input.completedCourses ?? []),
                ...buildRequirementStatuses(input.plan.beforeEnrollmentChecklist, input.completedCourses ?? []),
                ...buildRequirementStatuses(input.plan.stayAtGrcChecklist, input.completedCourses ?? []),
              ],
            }).optionSatisfactionSourcesById ?? {}
          ).flat()
        )
      : resolveChecklistTrueOptionSatisfactionSource({
          item,
          completedCourseCodes,
          scheduledCourseCodes,
          selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
        });
    const issue =
      detectedAsTrueOption && !visibleOptionGroup && satisfiedBy === "none"
        ? "missing-option-group"
        : !detectedAsTrueOption && visibleOptionGroup
          ? "false-required-row"
          : null;

    rows.push({
      major,
      requirement: item.title || group.label || group.id,
      acceptedUwOptions,
      mappedGrcOptions,
      requiredCount,
      detectedAsTrueOption,
      visibleOptionGroup,
      satisfiedBy,
      issue,
      copyOnlyDebugText: [
        "[copy-only true option detection audit]",
        `Major: ${major}`,
        `Requirement: ${item.title || group.label || group.id}`,
        `Accepted UW options: ${acceptedUwOptions.length ? acceptedUwOptions.join(", ") : "none"}`,
        `Mapped GRC options: ${mappedGrcOptions.length ? mappedGrcOptions.join(", ") : "none"}`,
        `Required count: ${requiredCount}`,
        `Detected as true option: ${detectedAsTrueOption ? "yes" : "no"}`,
        `Visible option group: ${visibleOptionGroup ? "yes" : "no"}`,
        `Satisfied by: ${satisfiedBy}`,
        `Issue: ${issue ?? "none"}`,
      ].join(" "),
    });
  }

  return rows;
}

function getOptionUwCourseCodeSet(plan: TransferPlannerMajorPlan | null | undefined) {
  const courseCodes = new Set<string>();
  if (!plan) {
    return courseCodes;
  }

  for (const item of getTransferPlannerPlanChecklistItems(plan)) {
    for (const option of item.requirementGroup?.options ?? []) {
      for (const courseCode of [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
      ]) {
        const normalizedCourseCode = normalizeCourseCode(courseCode);
        if (normalizedCourseCode) {
          courseCodes.add(normalizedCourseCode);
        }
      }
    }
  }

  return courseCodes;
}

export function auditRequirementRolePrecedence(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
}) {
  if (!input.plan) {
    return [] as RequirementRolePrecedenceAuditEntry[];
  }

  const requiredUwCourseCodes = getSourceBackedRequiredUwCourseCodeSet(input.plan);
  const optionUwCourseCodes = getOptionUwCourseCodeSet(input.plan);
  const visibleCourseCodes = getVisibleOrCompletedCourseCodeSet(input);
  const rows: RequirementRolePrecedenceAuditEntry[] = [];

  for (const uwCourseCode of sortCourseCodes([
    ...requiredUwCourseCodes,
    ...optionUwCourseCodes,
  ])) {
    const appearsInRequiredGroup = requiredUwCourseCodes.has(uwCourseCode);
    const appearsInOptionGroup = optionUwCourseCodes.has(uwCourseCode);
    const mappedGrcEquivalentPath = getMappedGrcCourseCodesForRequiredUwCourse(
      input.plan,
      uwCourseCode
    );
    const scheduledMappedCourses = mappedGrcEquivalentPath.filter((courseCode) =>
      visibleCourseCodes.has(courseCode)
    );
    const winningRole = appearsInRequiredGroup
      ? "required"
      : appearsInOptionGroup
        ? "unselected_option"
        : "matched_track_only";
    const scheduledAs = scheduledMappedCourses.length
      ? scheduledMappedCourses.join(", ")
      : "not scheduled";
    const reason = appearsInRequiredGroup && appearsInOptionGroup
      ? "Required source-backed requirement outranks option membership."
      : appearsInRequiredGroup
        ? "Required source-backed requirement."
        : appearsInOptionGroup
          ? "True option candidate without required-course precedence."
          : "Matched-track-only or supplemental row.";

    rows.push({
      uwCourse: uwCourseCode,
      appearsInRequiredGroup,
      appearsInOptionGroup,
      winningRole,
      scheduledAs,
      reason,
      copyOnlyDebugText: [
        "[copy-only requirement role precedence audit]",
        `UW course: ${uwCourseCode}`,
        `Appears in required group: ${appearsInRequiredGroup ? "yes" : "no"}`,
        `Appears in option group: ${appearsInOptionGroup ? "yes" : "no"}`,
        `Winning role: ${winningRole}`,
        `Scheduled as: ${scheduledAs}`,
        `Reason: ${reason}`,
      ].join(" "),
    });
  }

  return rows;
}

function getSuggestedCourseRequirementRoles(course: SuggestedQuarterCourse) {
  const roles: string[] = [];
  if (course.courseRole === "unresolved-credit-bucket-remainder") {
    return ["unresolved-credit-bucket-remainder"];
  }
  if (
    course.sourceKind === "uw-major-requirement" &&
    course.optionGroup?.isSelectionPrompt !== true
  ) {
    roles.push("required");
  }
  if (course.courseRole === "local_grc_prerequisite") {
    roles.push("prerequisite");
  }
  if (course.courseRole === "optional_stem_prep") {
    roles.push("stem-prep");
  }
  if (course.optionGroup) {
    roles.push(course.optionGroup.isSelectionPrompt ? "option-satisfaction" : "selected-option");
  }
  if (course.sourceKind === "official-grc-track") {
    roles.push("matched-track");
  }
  if (!roles.length) {
    roles.push(course.sourceKind ?? "unspecified");
  }
  return unique(roles);
}

export function auditCountedCourses(input: {
  suggestedPlan: SuggestedQuarterPlan[];
}) {
  const entriesByIdentityKey = new Map<
    string,
    {
      course: string;
      credits: number;
      roles: string[];
      rowCount: number;
      duplicateRows: string[];
    }
  >();

  for (const course of input.suggestedPlan.flatMap((quarter) => quarter.courses)) {
    const courseCreditRange = getSuggestedQuarterCourseCreditRange(course);
    const fallbackCredits = courseCreditRange.creditMax || courseCreditRange.creditMin || 0;
    const identityEntries = getSuggestedQuarterCourseCreditIdentityKeys(course)
      .map((identityKey) => {
        const grcCourseCode = identityKey.match(/^grc:(.+)$/)?.[1] ?? null;
        return {
          identityKey,
          course: grcCourseCode ?? course.label,
          grcCourseCode,
        };
      })
      .filter((entry) => entry.course);
    const roles = getSuggestedCourseRequirementRoles(course);

    for (const entry of identityEntries) {
      const credits = entry.grcCourseCode
        ? getCanonicalGrcCourseCreditAmount(entry.grcCourseCode) ?? fallbackCredits
        : fallbackCredits;
      const existing = entriesByIdentityKey.get(entry.identityKey) ?? {
        course: entry.course,
        credits,
        roles: [],
        rowCount: 0,
        duplicateRows: [],
      };
      existing.course = entry.course;
      existing.credits = Math.max(existing.credits, credits);
      existing.roles = unique([...existing.roles, ...roles]);
      existing.rowCount += 1;
      existing.duplicateRows.push(course.label);
      entriesByIdentityKey.set(entry.identityKey, existing);
    }
  }

  return [...entriesByIdentityKey.values()]
    .sort((left, right) => left.course.localeCompare(right.course))
    .map((entry) => {
      const countedOnce = true;
      const duplicateCountReason =
        entry.rowCount > 1
          ? `Multiple planner roles share canonical course identity ${entry.course}; credit is counted once.`
          : null;

      return {
        course: entry.course,
        credits: entry.credits,
        requirementRoles: entry.roles,
        countedOnce,
        duplicateCountReason,
        copyOnlyDebugText: [
          "[copy-only counted course audit]",
          `Course: ${entry.course}`,
          `Credits: ${entry.credits}`,
          `Requirement roles: ${entry.roles.length ? entry.roles.join(", ") : "none"}`,
          `Counted once: ${countedOnce ? "yes" : "no"}`,
          `Duplicate count reason if any: ${duplicateCountReason ?? "none"}`,
        ].join(" "),
      } satisfies CountedCourseAuditEntry;
    });
}

const INVALID_SCHEDULED_OPTION_AUDIT_RULES: Array<{
  planId: string;
  requirementPattern: RegExp;
  grcCourseCodes: string[];
  uwCourseCodes: string[];
  staleSourceReason: string;
}> = [
  {
    planId: "uw-seattle-sustainable-bioresource-systems-engineering",
    requirementPattern: /Business,\s*Policy,\s*and\s*Economics/i,
    grcCourseCodes: ["ACCT& 201", "ACCT& 202", "ACCT& 203"],
    uwCourseCodes: ["ACCTG 215", "ACCTG 225"],
    staleSourceReason:
      "The accounting sequence belongs to a stale broad SBSE business alternative, not the current source-backed Business, Policy, and Economics elective list.",
  },
];

function getInvalidScheduledOptionAuditRuleMatches(input: {
  planId: string;
  requirement: string;
}) {
  return INVALID_SCHEDULED_OPTION_AUDIT_RULES.filter(
    (rule) => rule.planId === input.planId && rule.requirementPattern.test(input.requirement)
  ).map((rule) => ({
    ...rule,
    grcCourseCodes: rule.grcCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)),
    uwCourseCodes: rule.uwCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)),
  }));
}

export function auditInvalidScheduledOptions(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
}) {
  if (!input.plan) {
    return [] as InvalidScheduledOptionAuditEntry[];
  }

  const scheduledCourses = getScheduledPlannerCourses(input.suggestedPlan);
  const rows: InvalidScheduledOptionAuditEntry[] = [];
  const seenRows = new Set<string>();

  for (const item of getTransferPlannerPlanChecklistItems(input.plan)) {
    const group = item.requirementGroup;
    if (!group?.options.length) {
      continue;
    }

    const requirement = group.label || item.title;
    const ruleMatches = getInvalidScheduledOptionAuditRuleMatches({
      planId: input.plan.id,
      requirement,
    });
    if (!ruleMatches.length) {
      continue;
    }

    const acceptedGrcCourseCodes = new Set(getRequirementGroupGrcOptionCourseCodes(group));
    const acceptedUwCourseCodes = getRequirementGroupAcceptedUwCourseCodeSet(group);

    for (const course of scheduledCourses) {
      const scheduledCourseCodes = getSuggestedQuarterCourseSatisfyingCourseCodes(course)
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean);
      const guidanceCourseCodes = extractCourseCodes(course.guidanceSummary ?? "")
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean);
      const matchingRule = ruleMatches.find((rule) => {
        const grcCodes = new Set(rule.grcCourseCodes);
        const uwCodes = new Set(rule.uwCourseCodes);
        return (
          scheduledCourseCodes.some((courseCode) => grcCodes.has(courseCode)) ||
          guidanceCourseCodes.some((courseCode) => uwCodes.has(courseCode))
        );
      });
      if (!matchingRule) {
        continue;
      }

      const scheduledCourse =
        sortCourseCodes(
          scheduledCourseCodes.filter((courseCode) =>
            matchingRule.grcCourseCodes.includes(courseCode)
          )
        )[0] ??
        extractCourseCodes(course.label)[0] ??
        course.label;
      const uwEquivalent =
        sortCourseCodes(
          guidanceCourseCodes.filter((courseCode) =>
            matchingRule.uwCourseCodes.includes(courseCode)
          )
        )[0] ??
        matchingRule.uwCourseCodes[0] ??
        "unknown";
      const isAcceptedByCurrentSource =
        scheduledCourseCodes.some((courseCode) => acceptedGrcCourseCodes.has(courseCode)) ||
        guidanceCourseCodes.some((courseCode) => acceptedUwCourseCodes.has(courseCode));
      const reason = isAcceptedByCurrentSource
        ? "Scheduled course is accepted by the current source-backed option list."
        : matchingRule.staleSourceReason;
      const rowKey = `${group.id}:${scheduledCourse}:${uwEquivalent}`;
      if (seenRows.has(rowKey)) {
        continue;
      }
      seenRows.add(rowKey);

      rows.push({
        requirement,
        scheduledCourse,
        uwEquivalent,
        isAcceptedByCurrentSource,
        reason,
        copyOnlyDebugText: [
          "[copy-only invalid scheduled option audit]",
          `Requirement: ${requirement}`,
          `Scheduled course: ${scheduledCourse}`,
          `UW equivalent: ${uwEquivalent}`,
          `Is accepted by current source: ${isAcceptedByCurrentSource ? "yes" : "no"}`,
          `Reason: ${reason}`,
        ].join(" "),
      });
    }
  }

  return rows;
}

function buildSbseCurrentVsOldSourceAuditRows(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
}) {
  if (!isCurrentSbsePlan(input.plan)) {
    return [] as Array<{
      course: SuggestedQuarterCourse;
      validation: SbseTransferOnlyCourseValidation;
    }>;
  }

  const scheduledCourses = input.suggestedPlan.flatMap((quarter) => quarter.courses);
  const visibleCourseCodes = scheduledCourses
    .flatMap((course) => getSuggestedQuarterCourseSatisfyingCourseCodes(course))
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter(Boolean);
  const currentRequiredCourseCodes = [
    ...getCurrentSbseRequiredCourseCodeSet(input.plan),
    ...getCurrentSbseSelectedTrueOptionCourseCodeSet({
      plan: input.plan,
      selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
    }),
  ];
  const completedCourseCodes = (input.completedCourses ?? [])
    .map((course) => normalizeCourseCode(course.code))
    .filter(Boolean);
  const staleOrOldCourseCodes = [...SBSE_STALE_OR_OLD_COURSE_AUDIT_METADATA.keys()];
  const graph = buildTransferPlannerCoursePlanningGraph({
    plan: input.plan,
    actionableCourseCodes: new Set([
      ...visibleCourseCodes,
      ...currentRequiredCourseCodes,
      ...completedCourseCodes,
      ...staleOrOldCourseCodes,
    ]),
  });
  const validationContext = buildSbseTransferOnlyValidationContext({
    plan: input.plan,
    completedCourses: input.completedCourses,
    selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
    prerequisiteCourseMap: getCoursePlanningGraphRequirementMap(
      graph,
      "prerequisiteCourseSetsByCourseCode"
    ),
    corequisiteCourseMap: getCoursePlanningGraphRequirementMap(
      graph,
      "corequisiteCourseSetsByCourseCode"
    ),
  });

  return scheduledCourses.map((course) => ({
    course,
    validation: classifySbseTransferOnlyCourse({
      course,
      plan: input.plan,
      validationContext,
    }),
  }));
}

export function auditSbseCurrentVsOldSource(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
}) {
  return buildSbseCurrentVsOldSourceAuditRows(input).map(
    (row) =>
      ({
        course: row.validation.course,
        uwEquivalent: row.validation.uwEquivalent,
        currentSbseSourceBacked: row.validation.currentSbseSourceBacked,
        oldBseOnly: row.validation.oldBseOnly,
        matchedTrackOnly: row.validation.matchedTrackOnly,
        prerequisiteForCurrentSource: row.validation.prerequisiteForCurrentSource,
        transferOnlyShouldShow: row.validation.transferOnlyShouldShow,
        reason: row.validation.reason,
        copyOnlyDebugText: row.validation.copyOnlyDebugText,
      }) satisfies SbseCurrentVsOldSourceAuditEntry
  );
}

function getSbseScheduledRowSource(
  validation: SbseTransferOnlyCourseValidation
): SbseScheduledRowSourceAuditEntry["source"] {
  if (validation.classification === "completed transcript course") {
    return "transcript";
  }

  if (
    validation.classification === "current SBSE source-backed requirement" ||
    validation.classification === "current SBSE true option, selected/defaulted"
  ) {
    return "current-sbse";
  }

  if (validation.classification === "prerequisite for a current SBSE source-backed course") {
    return "prerequisite";
  }

  if (validation.classification === "matched-track-only") {
    return "matched-track";
  }

  if (validation.classification === "old-BSE-only") {
    return "old-bse";
  }

  return "stale-supplemental";
}

export function auditSbseScheduledRowSources(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
}) {
  return buildSbseCurrentVsOldSourceAuditRows(input).map((row) => {
    const source = getSbseScheduledRowSource(row.validation);
    const reason = row.validation.reason;

    return {
      course: row.validation.course,
      uwEquivalent: row.validation.uwEquivalent,
      source,
      reason,
      shouldSchedule: row.validation.transferOnlyShouldShow,
      copyOnlyDebugText: [
        "[copy-only SBSE scheduled row source audit]",
        `Course: ${row.validation.course}`,
        `UW equivalent: ${row.validation.uwEquivalent}`,
        `Source: ${source}`,
        `Reason: ${reason}`,
        `Should schedule: ${row.validation.transferOnlyShouldShow ? "yes" : "no"}`,
      ].join(" "),
    } satisfies SbseScheduledRowSourceAuditEntry;
  });
}

function formatSbseAuditCreditValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatSbseDisplayedRemainingCredits(range: SuggestedQuarterRemainingCreditRange) {
  if (range.minRemainingCredits === range.maxRemainingCredits) {
    return formatSbseAuditCreditValue(range.maxRemainingCredits);
  }

  return `${formatSbseAuditCreditValue(range.minRemainingCredits)}-${formatSbseAuditCreditValue(
    range.maxRemainingCredits
  )}`;
}

export function auditSbseCreditTotals(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
  track?: TransferPlannerTrack | null;
}) {
  if (!isCurrentSbsePlan(input.plan)) {
    return [] as SbseCreditAuditEntry[];
  }

  const auditRows = buildSbseCurrentVsOldSourceAuditRows(input);
  let currentSbseSourceBackedCredits = 0;
  let selectedOptionCredits = 0;
  let prepCredits = 0;
  let prerequisiteCredits = 0;
  let filteredStaleMatchedTrackCredits = 0;

  for (const row of auditRows) {
    if (row.course.status === "completed") {
      continue;
    }

    if (!row.validation.transferOnlyShouldShow) {
      filteredStaleMatchedTrackCredits += row.validation.creditAmount;
      continue;
    }

    if (row.validation.classification === "current SBSE source-backed requirement") {
      currentSbseSourceBackedCredits += row.validation.creditAmount;
      continue;
    }

    if (
      row.validation.classification === "current SBSE true option, selected/defaulted" &&
      row.course.optionGroup?.isSelectionPrompt !== true
    ) {
      selectedOptionCredits += row.validation.creditAmount;
      continue;
    }

    if (row.course.courseRole === "optional_stem_prep") {
      prepCredits += row.validation.creditAmount;
      continue;
    }

    if (
      row.validation.classification ===
      "prerequisite for a current SBSE source-backed course"
    ) {
      prerequisiteCredits += row.validation.creditAmount;
    }
  }

  const displayedRemainingCredits = formatSbseDisplayedRemainingCredits(
    buildSuggestedQuarterRemainingCreditRange({
      quarters: input.suggestedPlan,
      track: null,
    })
  );

  return [
    {
      currentSbseSourceBackedCredits,
      selectedOptionCredits,
      prepCredits,
      prerequisiteCredits,
      filteredStaleMatchedTrackCredits,
      trueOptionSelectedCredits: selectedOptionCredits,
      localPrerequisiteCredits: prerequisiteCredits,
      oldBseMatchedTrackFilteredCredits: filteredStaleMatchedTrackCredits,
      displayedRemainingCredits,
      copyOnlyDebugText: [
        "[copy-only SBSE credit audit]",
        `Current SBSE source-backed credits: ${formatSbseAuditCreditValue(
          currentSbseSourceBackedCredits
        )}`,
        `Selected option credits: ${formatSbseAuditCreditValue(selectedOptionCredits)}`,
        `Prep credits: ${formatSbseAuditCreditValue(prepCredits)}`,
        `Prerequisite credits: ${formatSbseAuditCreditValue(prerequisiteCredits)}`,
        `Filtered stale/matched-track credits: ${formatSbseAuditCreditValue(
          filteredStaleMatchedTrackCredits
        )}`,
        `Displayed remaining credits: ${displayedRemainingCredits}`,
      ].join(" "),
    },
  ] satisfies SbseCreditAuditEntry[];
}

function classifyRequirementForAudit(
  item: TransferPlannerChecklistItem,
  seenCourseCodes: Set<string>
): RequirementClassificationAuditEntry["classification"] {
  const group = item.requirementGroup;
  const labelContext = `${group?.category ?? ""} ${group?.subcategory ?? ""} ${group?.label ?? ""} ${item.title}`;
  const courseCodes = getChecklistChoiceLabels(item)
    .flatMap((label) => extractCourseCodes(label))
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter(Boolean);

  if (!courseCodes.length) {
    return "hidden-unmapped";
  }

  if (
    /\b(?:computation_data_science_elective|business_policy_economics_elective)\b/i.test(
      labelContext
    ) ||
    (group?.requirementType === "choose_one" && /\belective\b/i.test(labelContext))
  ) {
    return "true-option";
  }

  if (
    /\brequired_sequence\b/i.test(labelContext) ||
    group?.requirementType === "all_required"
  ) {
    return "required-sequence";
  }

  if (courseCodes.length > 0 && courseCodes.every((courseCode) => seenCourseCodes.has(courseCode))) {
    return "overlap";
  }

  if (group?.requirementType === "choose_one" || /\bor\b/i.test(labelContext)) {
    return "prerequisite-alternative";
  }

  return "required-sequence";
}

function getRequirementClassificationReason(input: {
  item: TransferPlannerChecklistItem;
  classification: RequirementClassificationAuditEntry["classification"];
}) {
  const { item, classification } = input;
  const group = item.requirementGroup;

  if (classification === "true-option") {
    return "Source-backed elective bucket preserved as a student-facing option group.";
  }
  if (classification === "required-sequence") {
    return group?.category === "required_sequence"
      ? "Curated source-backed sequence; scheduled as required courses instead of a free-choice dropdown."
      : "Required source-backed courses are scheduled normally.";
  }
  if (classification === "overlap") {
    return "All courses in this expression overlap an earlier source-backed requirement, so it should not add credits or a dropdown.";
  }
  if (classification === "hidden-unmapped") {
    return "No Green River equivalent is currently mapped, so the requirement remains hidden/internal.";
  }
  return "Parser/admission alternative expression; not a true student-facing elective.";
}

export function auditRequirementClassification(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
}) {
  if (!input.plan) {
    return [] as RequirementClassificationAuditEntry[];
  }

  const completedCourseCodes = new Set(
    (input.completedCourses ?? [])
      .map((course) => normalizeCourseCode(course.code))
      .filter(Boolean)
  );
  const scheduledCourses = getScheduledPlannerCourses(input.suggestedPlan);
  const seenCourseCodes = new Set<string>();
  const rows: RequirementClassificationAuditEntry[] = [];

  for (const item of getTransferPlannerPlanChecklistItems(input.plan)) {
    const classification = classifyRequirementForAudit(item, seenCourseCodes);
    const itemCourseCodes = new Set(
      getChecklistChoiceLabels(item)
        .flatMap((label) => extractCourseCodes(label))
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean)
    );
    const matchingScheduledCourses = scheduledCourses.filter((course) =>
      getSuggestedQuarterCourseSatisfyingCourseCodes(course)
        .map((courseCode) => normalizeCourseCode(courseCode))
        .some((courseCode) => itemCourseCodes.has(courseCode))
    );
    const scheduledCourseCodes = sortCourseCodes(
      matchingScheduledCourses
        .flatMap((course) => getSuggestedQuarterCourseSatisfyingCourseCodes(course))
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter((courseCode) => itemCourseCodes.has(courseCode))
    );
    const countedCredits = matchingScheduledCourses.reduce((total, course) => {
      const courseCodes = getSuggestedQuarterCourseSatisfyingCourseCodes(course)
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean);
      if (!courseCodes.some((courseCode) => itemCourseCodes.has(courseCode))) {
        return total;
      }

      return total + (
        getPositiveCreditAmount(course.creditAmount) ??
        getPositiveCreditAmount(course.creditMin) ??
        getPositiveCreditAmount(course.creditMax) ??
        0
      );
    }, 0);
    const reason = getRequirementClassificationReason({ item, classification });

    for (const courseCode of itemCourseCodes) {
      if (!completedCourseCodes.has(courseCode)) {
        seenCourseCodes.add(courseCode);
      }
    }

    rows.push({
      requirement: item.requirementGroup?.label || item.title,
      classification,
      scheduledCourses: scheduledCourseCodes,
      countedCredits,
      reason,
      copyOnlyDebugText: [
        "[copy-only requirement classification audit]",
        `Requirement: ${item.requirementGroup?.label || item.title}`,
        `Classification: ${classification}`,
        `Scheduled courses: ${scheduledCourseCodes.length ? scheduledCourseCodes.join(", ") : "none"}`,
        `Counted credits: ${countedCredits}`,
        `Reason: ${reason}`,
      ].join(" "),
    });
  }

  return rows;
}

function getTransferPlannerPlanChecklistItems(plan: TransferPlannerMajorPlan) {
  return [
    ...plan.applicationChecklist,
    ...plan.beforeEnrollmentChecklist,
    ...plan.stayAtGrcChecklist,
  ];
}

function collectTransitivePrerequisiteCourseCodes(
  courseCodes: string[],
  prerequisiteCourseMap: Map<string, string[][]>
): Set<string> {
  const collected = new Set<string>();
  const pending = courseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean);

  for (let index = 0; index < pending.length; index += 1) {
    const courseCode = pending[index];
    if (!courseCode) continue;
    for (const prerequisiteCode of prerequisiteCourseMap.get(courseCode) ?? []) {
      for (const normalizedPrerequisiteCode of prerequisiteCode
        .map((code) => normalizeCourseCode(code))
        .filter(Boolean)) {
        if (collected.has(normalizedPrerequisiteCode)) {
          continue;
        }
        collected.add(normalizedPrerequisiteCode);
        pending.push(normalizedPrerequisiteCode);
      }
    }
  }

  return collected;
}

export function auditUnselectedOptionPrerequisiteScheduling(input: {
  plan?: TransferPlannerMajorPlan | null;
  suggestedPlan: SuggestedQuarterPlan[];
  completedCourses?: TranscriptCourseEntry[];
  selectedRequirementOptionIdsByGroup?: Record<string, string[] | string | null | undefined>;
}) {
  if (!input.plan) {
    return [] as UnselectedOptionPrerequisiteAuditEntry[];
  }

  const plan = input.plan;
  const completedCourses = input.completedCourses ?? [];
  const completedCourseCodes = new Set(
    completedCourses.map((course) => normalizeCourseCode(course.code)).filter(Boolean)
  );
  const statuses = [
    ...buildRequirementStatuses(plan.applicationChecklist, completedCourses),
    ...buildRequirementStatuses(plan.beforeEnrollmentChecklist, completedCourses),
    ...buildRequirementStatuses(plan.stayAtGrcChecklist, completedCourses),
  ];
  const activeRequirementCourseCodes = new Set(
    statuses
      .flatMap((status) =>
        getPlannerActionableCourseCodesForRequirementStatus({
          status,
          selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
          campusId: plan.campusId,
          plan,
        })
      )
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
  for (const courseCode of input.suggestedPlan
    .flatMap((quarter) => quarter.courses)
    .filter(
      (course) =>
        (course.sourceKind === "uw-major-requirement" ||
          course.sourceKind === "uw-major-breadth") &&
        course.optionGroup?.isSelectionPrompt !== true
    )
    .flatMap((course) => getSuggestedQuarterCourseSatisfyingCourseCodes(course))
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter(Boolean)) {
    activeRequirementCourseCodes.add(courseCode);
  }
  const scheduledCourseCodes = new Set(
    input.suggestedPlan
      .filter((quarter) => quarter.phase !== "completed")
      .flatMap((quarter) => quarter.courses)
      .filter((course) => course.status !== "completed")
      .flatMap((course) => getSuggestedQuarterCourseSatisfyingCourseCodes(course))
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
  const scheduledGraph = buildTransferPlannerCoursePlanningGraph({
    plan,
    actionableCourseCodes: scheduledCourseCodes,
  });
  const scheduledPrerequisiteMap = getCoursePlanningGraphRequirementMap(
    scheduledGraph,
    "prerequisiteCourseSetsByCourseCode"
  );
  const activePrerequisiteCourseCodes = collectTransitivePrerequisiteCourseCodes(
    [...activeRequirementCourseCodes],
    scheduledPrerequisiteMap
  );
  const shouldScheduleCourseCodes = new Set([
    ...activeRequirementCourseCodes,
    ...activePrerequisiteCourseCodes,
  ]);
  const scheduledCourses = input.suggestedPlan.flatMap((quarter) => quarter.courses);
  let addedGuidanceBackedPrerequisite = true;
  while (addedGuidanceBackedPrerequisite) {
    addedGuidanceBackedPrerequisite = false;

    for (const course of scheduledCourses) {
      if (course.courseRole !== "local_grc_prerequisite") {
        continue;
      }
      const dependentCourseCodes = extractCourseCodes(course.guidanceSummary ?? "");
      if (!dependentCourseCodes.some((courseCode) => shouldScheduleCourseCodes.has(courseCode))) {
        continue;
      }

      for (const courseCode of getSuggestedQuarterCourseSatisfyingCourseCodes(course)) {
        if (shouldScheduleCourseCodes.has(courseCode)) {
          continue;
        }
        shouldScheduleCourseCodes.add(courseCode);
        activePrerequisiteCourseCodes.add(courseCode);
        addedGuidanceBackedPrerequisite = true;
      }
    }
  }
  const checklistItems = getTransferPlannerPlanChecklistItems(plan);
  const allOptionCourseCodes = unique(
    checklistItems.flatMap((item) =>
      (item.requirementGroup?.options ?? []).flatMap((option) =>
        getRequirementOptionCourseLabels(option).flatMap((label) => extractCourseCodes(label))
      )
    )
  );
  const auditGraph = buildTransferPlannerCoursePlanningGraph({
    plan,
    actionableCourseCodes: unique([...scheduledCourseCodes, ...allOptionCourseCodes]),
  });
  const auditPrerequisiteMap = getCoursePlanningGraphRequirementMap(
    auditGraph,
    "prerequisiteCourseSetsByCourseCode"
  );
  const rows: UnselectedOptionPrerequisiteAuditEntry[] = [];

  for (const item of checklistItems) {
    const group = item.requirementGroup;
    if (
      !group?.options.length ||
      !(
        group.requirementType === "choose_one" ||
        group.requirementType === "choose_n" ||
        group.requirementType === "choose_credits" ||
        group.requirementType === "sequence_choice"
      )
    ) {
      continue;
    }

    const groupId = getRequirementOptionSelectionKey(item);
    const selectedOptionIds = getPlannerSelectedRequirementOptionIdsForScheduling({
      item,
      selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
      plan,
    });
    const selectedOptionIdSet = new Set(selectedOptionIds);

    for (const [optionIndex, option] of group.options.entries()) {
      const optionId = getRequirementOptionId(item, option, optionIndex);
      const optionSelected = selectedOptionIdSet.has(optionId);
      const optionCourseCodes = unique(
        getRequirementOptionCourseLabels(option).flatMap((label) => extractCourseCodes(label))
      );
      const prerequisiteCourseCodes = [...collectTransitivePrerequisiteCourseCodes(
        optionCourseCodes,
        auditPrerequisiteMap
      )].sort((left, right) => left.localeCompare(right));

      for (const prerequisiteCourseCode of prerequisiteCourseCodes) {
        const prerequisiteScheduled = scheduledCourseCodes.has(prerequisiteCourseCode);
        const shouldSchedule =
          !completedCourseCodes.has(prerequisiteCourseCode) &&
          (
            optionSelected ||
            shouldScheduleCourseCodes.has(prerequisiteCourseCode)
          );
        const reason = optionSelected
          ? "prerequisite for selected option"
          : activeRequirementCourseCodes.has(prerequisiteCourseCode)
            ? "independently source-backed requirement"
            : activePrerequisiteCourseCodes.has(prerequisiteCourseCode)
              ? "prerequisite for selected or required course"
              : "unselected option prerequisite only";

        rows.push({
          groupId,
          optionId,
          optionSelected,
          prerequisiteCourseCode,
          prerequisiteScheduled,
          shouldSchedule,
          reason,
          copyOnlyDebugText: [
            "[copy-only unselected option prerequisite audit]",
            `Group id: ${groupId}`,
            `Option id: ${optionId}`,
            `Option selected: ${optionSelected ? "yes" : "no"}`,
            `Prerequisite scheduled: ${prerequisiteCourseCode} (${prerequisiteScheduled ? "yes" : "no"})`,
            `Should schedule: ${shouldSchedule ? "yes" : "no"}`,
            `Reason: ${reason}`,
          ].join(" "),
        });
      }
    }
  }

  return rows;
}
