import type {
  TransferPlannerMajorPlan,
  TransferPlannerStudentCourseEvaluation,
} from "@/constants/transfer-planner-source/student-runtime";

import type { TranscriptCourseEntry } from "./course-code";

export type StudentEvaluationReportSuggestedQuarter = {
  phase: "completed" | "current" | "planned";
  courses: {
    label: string;
  }[];
};

export type StudentEvaluationReportRemainingCreditRange = {
  mainScheduledMinRemainingCredits: number;
  mainScheduledMaxRemainingCredits: number;
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
  remainingDirectTransferCreditMin: number;
  remainingDirectTransferCreditMax: number;
  completedDirectTransferCredits: number;
  reportSummaryLines: string[];
};

const STUDENT_EVALUATION_REPORT_BUCKETS: {
  id: TransferPlannerStudentCourseEvaluation["outcome"];
  label: string;
  description: string;
}[] = [
  {
    id: "auto-approved",
    label: "Completed and applies",
    description: "Completed classes that match this UW plan through an approved rule.",
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
    description: "Completed classes with a transfer rule that do not apply to this selected major.",
  },
];

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function sortCourseCodes(codes: string[]) {
  return unique(codes).sort((left, right) => left.localeCompare(right));
}

function getCompletedDirectTransferCreditAmount(
  evaluations: TransferPlannerStudentCourseEvaluation[]
) {
  return evaluations
    .filter(
      (entry) => entry.outcome === "auto-approved" || entry.outcome === "legacy-rule-used"
    )
    .reduce((totalCredits, entry) => totalCredits + (entry.sourceCreditAmount ?? 5), 0);
}

export function buildTransferPlannerStudentEvaluationReport(input: {
  plan?: TransferPlannerMajorPlan | null;
  planId?: string | null;
  pathwayId?: string | null;
  campusLabel: string;
  completedCourses: TranscriptCourseEntry[];
  evaluations: TransferPlannerStudentCourseEvaluation[];
  suggestedQuarterPlan?: StudentEvaluationReportSuggestedQuarter[];
  remainingDirectTransferCreditRange: StudentEvaluationReportRemainingCreditRange;
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
    studentFacingEvaluations
      .flatMap((entry) => [entry.approvedRuleId, ...entry.alternativeApprovedRuleIds])
      .filter((ruleId): ruleId is string => Boolean(ruleId))
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
  const completedDirectTransferCredits =
    getCompletedDirectTransferCreditAmount(studentFacingEvaluations);
  const remainingDirectTransferCreditMin =
    input.remainingDirectTransferCreditRange.mainScheduledMinRemainingCredits;
  const remainingDirectTransferCreditMax =
    input.remainingDirectTransferCreditRange.mainScheduledMaxRemainingCredits;
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
    remainingDirectTransferCreditMin,
    remainingDirectTransferCreditMax,
    completedDirectTransferCredits,
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
