import type { TransferPlannerGrcCourseAvailabilityEntry } from "./transfer-planner-grc-availability.generated";

export type TransferPlannerCampusId = "uw-seattle" | "uw-bothell" | "uw-tacoma";
export type TransferPlannerCoverage = "detailed" | "partial";
export type TransferPlannerSourceType = "detailed" | "master-generated";

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
  | "sequence_choice";

export type TransferPlannerRequirementOption = {
  id?: string;
  displayCourseCodes?: string[];
  uwCourses: string[];
  equivalentUwCourseCodes?: string[];
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
  constraints?: string[];
  notes?: string[];
  label: string;
};

export type TransferPlannerRequirementGroup = {
  id: string;
  label: string;
  category: string;
  subcategory?: string | null;
  requirementType: TransferPlannerRequirementType;
  minCourses?: number | null;
  maxCourses?: number | null;
  minCredits?: number | null;
  maxCredits?: number | null;
  sourceHeading?: string | null;
  notes?: string[];
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
  alternatives?: string[][];
  note?: string;
  minCompletedCount?: number;
  minCredits?: number;
  maxCredits?: number;
  requirementGroup?: TransferPlannerRequirementGroup;
  selectedRequirementOptionIds?: string[];
  unselectedRequirementOptionIds?: string[];
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
};

export type TransferPlannerTrackTerm = {
  label: string;
  courses: string[];
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
  sourceHeading?: string | null;
  sourceProgramId?: number | null;
  options: TransferPlannerTrackGroupedChoiceOption[];
};

export type TransferPlannerTrack = {
  id: string;
  code: string;
  title: string;
  summary: string;
  bestFor: string[];
  terms: TransferPlannerTrackTerm[];
  notes: string[];
  officialLinks?: TransferPlannerLink[];
  catalogYears?: TransferPlannerTrackCatalogYear[];
  groupedChoices?: TransferPlannerTrackGroupedChoice[];
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
};

export type TransferPlannerResolvedMajorPlan = TransferPlannerMajorPlan & {
  selectedPathwayId: string | null;
  selectedPathwayLabel: string | null;
  selectedPathwaySummary: string | null;
};
