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

export type TransferPlannerChecklistItem = {
  id: string;
  title: string;
  grcCourses: string[];
  alternatives?: string[][];
  note?: string;
  minCompletedCount?: number;
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
};

export type TransferPlannerResolvedMajorPlan = TransferPlannerMajorPlan & {
  selectedPathwayId: string | null;
  selectedPathwayLabel: string | null;
  selectedPathwaySummary: string | null;
};
