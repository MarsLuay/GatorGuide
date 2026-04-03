export type TransferPlannerSourceSchoolId =
  | "grc"
  | "uw-seattle"
  | "uw-bothell"
  | "uw-tacoma";

export type TransferPlannerSourceLink = {
  label: string;
  url: string;
  note?: string;
};

export type TransferPlannerSourceManifestOwnerType =
  | "major"
  | "pathway"
  | "track"
  | "reference";

export type TransferPlannerSourceManifestRole =
  | "degree-requirements"
  | "admissions"
  | "curriculum"
  | "overview"
  | "equivalency"
  | "catalog"
  | "worksheet"
  | "availability"
  | "other";

export type TransferPlannerSourceManifestParserType =
  | "html-degree-page"
  | "html-admissions-page"
  | "html-curriculum-page"
  | "html-overview-page"
  | "catalog-page"
  | "equivalency-guide"
  | "pdf-degree-sheet"
  | "pdf-worksheet"
  | "annual-schedule-pdf"
  | "generic-html"
  | "generic-pdf"
  | "unknown";

export type TransferPlannerSourceManifestConfidence = "high" | "medium" | "low";

export type TransferPlannerSourceManifestEntry = {
  id: string;
  ownerType: TransferPlannerSourceManifestOwnerType;
  ownerId: string;
  ownerTitle: string;
  planId?: string | null;
  pathwayId?: string | null;
  trackId?: string | null;
  campusId?: TransferPlannerSourceSchoolId | null;
  label: string;
  url: string;
  role: TransferPlannerSourceManifestRole;
  parserType: TransferPlannerSourceManifestParserType;
  confidence: TransferPlannerSourceManifestConfidence;
  isPrimaryDegreeRequirementsLink: boolean;
  note?: string;
  lastValidatedOn?: string | null;
  validationNotes: string[];
};

export type TransferPlannerCourseSourceKind =
  | "track-term"
  | "track-catalog-year"
  | "track-slot-expansion"
  | "plan-checklist"
  | "plan-course-list"
  | "plan-degree-map"
  | "master-bank"
  | "availability";

export type TransferPlannerEffectiveYearRange = {
  startLabel: string;
  endLabel: string | null;
  note?: string;
};

export type TransferPlannerCourseRegistryEntry = {
  id: string;
  schoolId: TransferPlannerSourceSchoolId;
  code: string;
  displayLabel: string;
  title: string | null;
  creditValue: number | null;
  creditLabel: string | null;
  subjectCode: string;
  catalogNumber: string;
  level: number | null;
  sourceKinds: TransferPlannerCourseSourceKind[];
  sourceContexts: string[];
  referencedByPlanIds: string[];
  referencedByTrackIds: string[];
  sourceLinks: TransferPlannerSourceLink[];
  effectiveYearLabels: string[];
  effectiveYearRanges: TransferPlannerEffectiveYearRange[];
  prerequisiteCourseCodes: string[];
  prerequisiteAlternativeCourseCodeSets: string[][];
  prerequisiteNotes: string[];
  corequisiteCourseCodes: string[];
  corequisiteAlternativeCourseCodeSets: string[][];
  corequisiteNotes: string[];
  lastValidatedOn?: string | null;
  latestAvailabilitySummary?: string | null;
  latestPublishedQuarters?: string[];
  notes: string[];
};

export type TransferPlannerEquivalencyRuleType =
  | "sequence"
  | "full-credit-combo"
  | "alternate-path"
  | "chain-rule"
  | "technical-but-not-recommended";

export type TransferPlannerEquivalencyAcceptanceCategory =
  | "preferred"
  | "accepted"
  | "accepted-with-warning"
  | "legacy-accepted";

export type TransferPlannerEquivalencyRule = {
  id: string;
  type: TransferPlannerEquivalencyRuleType;
  title: string;
  acceptanceCategory: TransferPlannerEquivalencyAcceptanceCategory;
  sourceSchoolId: TransferPlannerSourceSchoolId;
  targetSchoolIds: TransferPlannerSourceSchoolId[];
  sourceCourseSets?: string[][];
  targetOutcome: string;
  weakerThanRuleIds: string[];
  effectiveYearRanges: TransferPlannerEffectiveYearRange[];
  plannerWarnings: string[];
  notes: string[];
  sourceLinks: TransferPlannerSourceLink[];
};

export type TransferPlannerRequirementPhase =
  | "before-application"
  | "before-enrollment"
  | "stay-at-grc";

export type TransferPlannerMajorRequirementAtom = {
  id: string;
  planId: string;
  pathwayId?: string | null;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  majorTitle: string;
  phase: TransferPlannerRequirementPhase;
  displayPhase: TransferPlannerRequirementPhase;
  title: string;
  grcCourseCodes: string[];
  alternativeCourseCodeSets: string[][];
  minCompletedCount: number | null;
  note?: string;
  sourceLinks: TransferPlannerSourceLink[];
  validationNotes: string[];
};

export type TransferPlannerDegreeMapBlock = {
  id: string;
  planId: string;
  pathwayId?: string | null;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  majorTitle: string;
  title: string;
  itemLabels: string[];
  uwCourseCodes: string[];
  note?: string;
  sourceLinks: TransferPlannerSourceLink[];
  validationNotes: string[];
};

export type TransferPlannerPolicyEntry = {
  id: string;
  planId: string;
  pathwayId?: string | null;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  majorTitle: string;
  bestTrackId: string | null;
  bestTrackSummary: string;
  whyThisTrack: string[];
  financialAidNote: string;
  advisorFlags: string[];
  grcCourseListGuidance?: string;
  plannerNote?: string;
  involvementIdeas: string[];
  projectIdeas: string[];
  sourceLinks: TransferPlannerSourceLink[];
  validationNotes: string[];
};

export type TransferPlannerMajorPathwayEntry = {
  id: string;
  planId: string;
  pathwayId: string;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  majorTitle: string;
  label: string;
  summary: string;
  grcCourseList: string[];
  sourceLinks: TransferPlannerSourceLink[];
  validationNotes: string[];
};
