export type TransferPlannerCampusId = "uw-seattle" | "uw-bothell" | "uw-tacoma";
export type TransferPlannerCoverage = "detailed" | "partial";
export type TransferPlannerSourceType = "detailed" | "master-generated";
export type TransferPlannerGrcCourseAvailabilityQuarter =
  | "summer"
  | "fall"
  | "winter"
  | "spring";
export type TransferPlannerGrcCourseAvailabilityStatus =
  | "published-in-latest-schedule"
  | "published-in-recent-history-not-latest"
  | "catalog-listed-not-in-latest-schedules"
  | "planner-course-no-current-public-source"
  | "legacy-track-only-no-current-public-source";
export type TransferPlannerGrcCourseAvailabilityEntry = {
  status: TransferPlannerGrcCourseAvailabilityStatus;
  years: {
    label: string;
    quarters: TransferPlannerGrcCourseAvailabilityQuarter[];
  }[];
  latestPublishedQuarters: TransferPlannerGrcCourseAvailabilityQuarter[];
};

export type TransferPlannerLink = {
  label: string;
  url: string;
  note?: string;
  visibility?: "visible" | "hidden";
  status?:
    | "verified"
    | "partially-verified"
    | "source-unfindable"
    | "source-conflict"
    | "parser-unsupported";
  reason?: string;
  sourceConfidence?: "high" | "medium" | "low";
};

export type TransferPlannerRequirementType =
  | "all_required"
  | "choose_one"
  | "choose_n"
  | "choose_credits"
  | "sequence_choice"
  | "approved_course_list"
  | "approved_filter_list"
  | "elective_list"
  | "hidden_informational";

export type TransferPlannerRequirementStructuralShape =
  | "required-row"
  | "option-group"
  | "credit-bucket"
  | "sequence-choice"
  | "category-option"
  | "compound-equivalency-path"
  | "pathway-specific-requirement"
  | "approved-course-list"
  | "approved-filter-list"
  | "elective-list"
  | "hidden-informational-row";

export type TransferPlannerRequirementSupportListShape =
  | "approved-course-list"
  | "approved-filter-list"
  | "elective-list";

export type TransferPlannerRequirementSupportList = {
  id: string;
  shape: TransferPlannerRequirementSupportListShape;
  sourceUrl: string | null;
  sourceRole: string | null;
  listTitle: string;
  filterKey?: string | null;
  ownerId?: string | null;
  majorId?: string | null;
  pathwayId?: string | null;
  officialSourceUrl?: string | null;
  acceptedUwCourseCodes: string[];
  approvedUwCourseGroups?: string[][];
  mappedGrcCoursePaths?: string[][];
  excludedGenericCategoryOnlyCourseCodes?: string[];
  petitionOnlyNotes?: string[];
  sourceBackedProgramApproval?: boolean | null;
  generatedFilterId?: string | null;
  sourceEvidenceLines?: string[];
  sourceEvidenceHeadings?: string[];
  sourceFingerprint?: string | null;
  approvedListKey?: string | null;
  supportOnly: true;
  canCreateRequiredRow: false;
  canCreateScheduleRow: boolean;
  linkedPrimaryRequirementIds?: string[];
};

export type TransferPlannerRequirementSatisfactionMode =
  | "selection-count"
  | "credit-based";

export type TransferPlannerRequirementCategoryOption = {
  category: string;
  sourceCategoryCode: string;
  title: string;
  credits: number;
  creditMin?: number | null;
  creditMax?: number | null;
  sourceText: string;
  approvedListKey?: string | null;
  programSpecific?: boolean | null;
  genericCategoryTags?: string[];
  programApprovedFilterKeys?: string[];
  approvedUwEquivalentCodes?: string[];
  sourceBackedProgramApproval?: boolean | null;
};

export type TransferPlannerSingleCourseEquivalencyEvidence = {
  grcSourceCourse: string;
  uwTargetCourse: string;
  ruleId: string;
  ruleType: string;
  sourceKind?: string | null;
  sourceRowText?: string | null;
  sourceUrl?: string | null;
  effectiveDateLabel?: string | null;
  effectiveYearRanges?: {
    startLabel: string;
    endLabel?: string | null;
    note?: string;
  }[];
  warnings?: string[];
  restrictions?: string[];
};

export type TransferPlannerRequirementOption = {
  id?: string;
  optionKind?: "course" | "category-option";
  requirementShape?: TransferPlannerRequirementStructuralShape | null;
  sequencePathId?: string | null;
  pathLabel?: string | null;
  displayCourseCodes?: string[];
  uwCourses: string[];
  equivalentUwCourseCodes?: string[];
  conditionalLabCourses?: string[];
  credits?: number | null;
  creditMin?: number | null;
  creditMax?: number | null;
  creditText?: string | null;
  maxCredits?: number | null;
  title?: string | null;
  department?: string | null;
  category?: string | null;
  sourceHeading?: string | null;
  sourceCategory?: string | null;
  grcMatches: string[];
  equivalencyEvidence?: TransferPlannerSingleCourseEquivalencyEvidence[];
  compoundComponents?: string[][];
  categoryOption?: TransferPlannerRequirementCategoryOption | null;
  constraints?: string[];
  notes?: string[];
  label: string;
};

export type TransferPlannerRequirementSequencePath = {
  id: string;
  label: string;
  uwCourses: string[];
  displayCourseCodes?: string[];
  mappedGrcCourseCodes?: string[];
  compoundComponents?: string[][];
  conditionalLabCourses?: string[];
  notes?: string[];
  sourceText: string;
};

export type TransferPlannerRequirementGroup = {
  id: string;
  label: string;
  category: string;
  subcategory?: string | null;
  requirementType: TransferPlannerRequirementType;
  requirementShape?: TransferPlannerRequirementStructuralShape | null;
  minCourses?: number | null;
  maxCourses?: number | null;
  selectionCount?: number | null;
  requiredCount?: number | null;
  minCredits?: number | null;
  maxCredits?: number | null;
  creditText?: string | null;
  satisfactionMode?: TransferPlannerRequirementSatisfactionMode | null;
  sourceHeading?: string | null;
  sourceRowText?: string | null;
  sourceSection?: string | null;
  sourceSectionRole?: string | null;
  sourceSectionSchedulable?: boolean | null;
  detectedOptionCue?: string | null;
  sourceRole?: string | null;
  sourceUrl?: string | null;
  sourceScope?: string | null;
  pathwayId?: string | null;
  routeId?: string | null;
  canCreateScheduleRow?: boolean | null;
  supportOnly?: boolean | null;
  approvedListKey?: string | null;
  canCreatePlaceholder?: boolean | null;
  programSpecific?: boolean | null;
  notes?: string[];
  sequencePaths?: TransferPlannerRequirementSequencePath[];
  options: TransferPlannerRequirementOption[];
};

export type TransferPlannerRequirementReplacement = {
  baseRequirementId: string;
  replacedByRequirementId: string;
  appliesWhen: string;
  replacementReason: string;
  sourceUrl: string;
  sourceHeading: string;
};

export type TransferPlannerRequirementCourseOptionRole =
  | "required"
  | "option"
  | "alias"
  | "note_only";

export type TransferPlannerParsedRequirementCourse = {
  courseCode: string;
  normalizedCourseCode: string;
  title?: string | null;
  credits?: number | null;
  creditMin?: number | null;
  creditMax?: number | null;
  creditText?: string | null;
  category: string;
  requirementGroupId: string;
  requirementType: TransferPlannerRequirementType;
  optionRole: TransferPlannerRequirementCourseOptionRole;
  sourceHeading: string;
  sourceCategory: string;
  notes?: string[];
};

export type TransferPlannerChecklistItem = {
  id: string;
  title: string;
  grcCourses: string[];
  requirementShape?: TransferPlannerRequirementStructuralShape | null;
  alternatives?: string[][];
  note?: string;
  minCompletedCount?: number;
  minCredits?: number;
  maxCredits?: number;
  requirementGroup?: TransferPlannerRequirementGroup;
  selectedRequirementOptionIds?: string[];
  unselectedRequirementOptionIds?: string[];
  scheduleSelectedRequirementOptions?: boolean;
  pathwayId?: string | null;
  routeId?: string | null;
  sourceUrl?: string | null;
  sourceRole?: string | null;
  sourceScope?: string | null;
  sourceSection?: string | null;
  generatedFromParser?: boolean;
  manualOverride?: boolean;
  canCreateScheduleRow?: boolean;
  reason?: string | null;
};

export type TransferPlannerGeneralRequirementCategoryId =
  | "academic-elective"
  | "ah"
  | "english"
  | "fine-arts"
  | "mathematics"
  | "ssc"
  | "science"
  | "senior-year-quantitative"
  | "social-sciences-social-studies"
  | "nsc"
  | "breadth"
  | "elective"
  | "world-languages";

export type TransferPlannerGeneralRequirementSourceKind =
  | "source-backed-major"
  | "official-transfer-policy"
  | "planner-guidance";

export type TransferPlannerGeneralRequirementPlannerUsage =
  | "used-for-quarter-planning"
  | "reference-only"
  | "summary-only";

export type TransferPlannerGeneralRequirementItem = {
  id: string;
  label: string;
  valueText: string;
  note?: string;
  sourceKind: TransferPlannerGeneralRequirementSourceKind;
};

export type TransferPlannerGeneralRequirementSection = {
  id: string;
  title: string;
  summary: string;
  note?: string;
  campusId: TransferPlannerCampusId;
  sourceKind: TransferPlannerGeneralRequirementSourceKind;
  plannerUsage: TransferPlannerGeneralRequirementPlannerUsage;
  items: TransferPlannerGeneralRequirementItem[];
};

export type TransferPlannerDegreeMapSection = {
  id: string;
  title: string;
  items: string[];
  note?: string;
};

export type TransferPlannerMajorPathway = {
  id: string;
  label: string;
  summary: string;
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
  advisorFlags?: string[];
  officialLinks?: TransferPlannerLink[];
  degreeMapSections?: TransferPlannerDegreeMapSection[];
  validationNotes?: string[];
  grcCourseList?: string[];
  grcCourseListGuidance?: string;
  plannerNote?: string;
  bestTrackId?: string | null;
  recommendedTrackSummary?: string;
  whyThisTrack?: string[];
  requirementGroups?: TransferPlannerRequirementGroup[];
  requirementReplacements?: TransferPlannerRequirementReplacement[];
  supportLists?: TransferPlannerRequirementSupportList[];
};

export type TransferPlannerTrackTermRole =
  | "required"
  | "sample-only"
  | "support-options"
  | "remaining-credits";

export type TransferPlannerTrackTerm = {
  label: string;
  courses: string[];
  requirementRole?: TransferPlannerTrackTermRole;
  sampleOnly?: boolean;
  canCreateScheduleRows?: boolean;
  notes?: string[];
};

export type TransferPlannerTrackSlotExpansion = {
  termLabel: string;
  slotLabel: string;
  recommendedCourses: string[];
  note?: string;
};

export type TransferPlannerTrackCatalogYear = {
  label: string;
  sourceSummary: string;
  terms: TransferPlannerTrackTerm[];
  slotExpansions?: TransferPlannerTrackSlotExpansion[];
  notes?: string[];
};

export type TransferPlannerTrackGroupedChoiceOption = {
  id: string;
  label: string;
  courseLabels: string[];
  courseCodes: string[];
};

export type TransferPlannerTrackGroupedChoice = {
  id: string;
  label: string;
  requiredCredits?: number | null;
  selectionCount?: number | null;
  defaultOptionIds?: string[];
  sourceHeading?: string | null;
  sourceProgramId?: number | null;
  options: TransferPlannerTrackGroupedChoiceOption[];
};

export type TransferPlannerTrackCatalogCreditRange = {
  minimumCredits?: number | null;
  maximumCredits?: number | null;
  sourceText?: string | null;
  sourceKind?:
    | "program-map-duration"
    | "curriculum-map-description"
    | "catalog-requirement-description";
  isExact?: boolean | null;
};

export type TransferPlannerTrackSampleScheduleMetadata = {
  scheduledMinCredits?: number | null;
  scheduledMaxCredits?: number | null;
  placeholderCredits?: number | null;
  unresolvedOptionCredits?: number | null;
  defaultOptionCredits?: number | null;
  sampleOnlyCredits?: number | null;
  exceedsCatalogMinimum?: boolean | null;
  exceedsCatalogMaximum?: boolean | null;
};

export type TransferPlannerTrackCatalogOptionList = {
  id: string;
  label: string;
  sourceHeading?: string | null;
  sourceText?: string | null;
  requiredCredits?: number | null;
  selectionCount?: number | null;
  supportOnly?: boolean | null;
  courseLabels: string[];
  courseCodes: string[];
};

export type TransferPlannerTrack = {
  id: string;
  code: string;
  title: string;
  summary: string;
  bestFor: string[];
  minimumCredits?: number | null;
  maximumCredits?: number | null;
  catalogCreditRange?: TransferPlannerTrackCatalogCreditRange;
  sampleSchedule?: TransferPlannerTrackSampleScheduleMetadata;
  terms: TransferPlannerTrackTerm[];
  notes: string[];
  officialLinks?: TransferPlannerLink[];
  catalogYears?: TransferPlannerTrackCatalogYear[];
  groupedChoices?: TransferPlannerTrackGroupedChoice[];
  catalogOptionLists?: TransferPlannerTrackCatalogOptionList[];
};

export type TransferPlannerCourseAvailability =
  TransferPlannerGrcCourseAvailabilityEntry & {
    courseCode: string;
  };

export type TransferPlannerCampus = {
  id: TransferPlannerCampusId;
  title: string;
  summary: string;
  officialLinks: TransferPlannerLink[];
};

export type TransferPlannerMajorPlan = {
  id: string;
  campusId: TransferPlannerCampusId;
  title: string;
  shortTitle: string;
  coverage: TransferPlannerCoverage;
  summary: string;
  bestTrackId: string | null;
  recommendedTrackSummary: string;
  whyThisTrack: string[];
  applicationChecklist: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist: TransferPlannerChecklistItem[];
  stayAtGrcChecklist: TransferPlannerChecklistItem[];
  advisorFlags: string[];
  officialLinks: TransferPlannerLink[];
  degreeMapSections?: TransferPlannerDegreeMapSection[];
  validationNotes?: string[];
  family?: string;
  grcCourseList?: string[];
  grcCourseListGuidance?: string;
  bankIds?: string[];
  plannerNote?: string;
  sourceType?: TransferPlannerSourceType;
  pathways?: TransferPlannerMajorPathway[];
  requirementGroups?: TransferPlannerRequirementGroup[];
  requirementReplacements?: TransferPlannerRequirementReplacement[];
  supportLists?: TransferPlannerRequirementSupportList[];
};

export type TransferPlannerResolvedMajorPlan = TransferPlannerMajorPlan & {
  selectedPathwayId: string | null;
  selectedPathwayLabel: string | null;
  selectedPathwaySummary: string | null;
};
