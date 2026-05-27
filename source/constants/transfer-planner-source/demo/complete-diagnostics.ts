import type { TransferPlannerCampusId } from "../student-runtime";

export type TransferPlannerDemoOptionGroup = {
  id: string;
  label: string;
  options: string[][];
};

export type TransferPlannerDemoCourseBucket = {
  id: string;
  label: string;
  minCredits?: number;
  courseCodes: string[];
};

export type TransferPlannerDemoPathwayGroup = {
  id: string;
  label: string;
  suggestedCourses: string[];
  capstoneCourses: string[];
  enrichingCourses: string[];
};

export type TransferPlannerDemoReviewProgram = {
  campusId: TransferPlannerCampusId;
  planId: string;
  title: string;
  family: string;
  fixtureFile: string;
  fixtureExport: string;
  officialSources: string[];
  expectedPathwayIds: string[];
  expectedCourseCodes: string[];
  sourceDeclaredCourseCodes: string[];
  requiredCourseCodes: string[];
  optionGroups: TransferPlannerDemoOptionGroup[];
  courseBuckets: TransferPlannerDemoCourseBucket[];
  pathwayGroups: TransferPlannerDemoPathwayGroup[];
  genEdRequirements: string[];
  requirementLabels: string[];
  publicAdmissionsLabels: string[];
  requiredTextSnippets: string[];
  genEdSnippets: string[];
};

export type TransferPlannerDemoReviewPayload = {
  schemaVersion: 1;
  generatedAt: string;
  source: {
    fixtureFiles: string[];
    reviewKind: string;
  };
  summary: {
    reviewedMajorCount: number;
    fixtureFileCount: number;
    programEntryCount: number;
  };
  reviewedPlanIds: string[];
  programsByPlanId: Record<string, TransferPlannerDemoReviewProgram[]>;
};

export const TRANSFER_PLANNER_DEMO_REVIEW_PAYLOAD =
  require("./complete-diagnostics.generated.json") as TransferPlannerDemoReviewPayload;
