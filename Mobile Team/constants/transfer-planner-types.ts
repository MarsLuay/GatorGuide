import type { TransferPlannerGrcCourseAvailabilityEntry } from "./transfer-planner-grc-availability.generated";

export type TransferPlannerCampusId = "uw-seattle" | "uw-bothell" | "uw-tacoma";
export type TransferPlannerCoverage = "detailed" | "partial";
export type TransferPlannerSourceType = "detailed" | "master-generated";

export type TransferPlannerLink = {
  label: string;
  url: string;
  note?: string;
};

export type TransferPlannerChecklistItem = {
  id: string;
  title: string;
  grcCourses: string[];
  alternatives?: string[][];
  note?: string;
  minCompletedCount?: number;
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
  manualReviewNotes?: string[];
  grcCourseList?: string[];
  grcCourseListGuidance?: string;
  plannerNote?: string;
  bestTrackId?: string | null;
  bestTrackSummary?: string;
  whyThisTrack?: string[];
  financialAidNote?: string;
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
  coverageNote: string;
  officialLinks: TransferPlannerLink[];
};

export type TransferPlannerMajorPlan = {
  id: string;
  campusId: TransferPlannerCampusId;
  title: string;
  shortTitle: string;
  coverage: TransferPlannerCoverage;
  summary: string;
  applicationWindow: string;
  startQuarter: string;
  bestTrackId: string | null;
  bestTrackSummary: string;
  whyThisTrack: string[];
  financialAidNote: string;
  applicationChecklist: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist: TransferPlannerChecklistItem[];
  stayAtGrcChecklist: TransferPlannerChecklistItem[];
  advisorFlags: string[];
  involvementIdeas: string[];
  projectIdeas: string[];
  officialLinks: TransferPlannerLink[];
  degreeMapSections?: TransferPlannerDegreeMapSection[];
  manualReviewNotes?: string[];
  family?: string;
  grcCourseList?: string[];
  grcCourseListGuidance?: string;
  bankIds?: string[];
  chainIds?: string[];
  plannerNote?: string;
  sourceType?: TransferPlannerSourceType;
  pathways?: TransferPlannerMajorPathway[];
};

export type TransferPlannerResolvedMajorPlan = TransferPlannerMajorPlan & {
  selectedPathwayId: string | null;
  selectedPathwayLabel: string | null;
  selectedPathwaySummary: string | null;
};
