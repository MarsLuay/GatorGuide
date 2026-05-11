
import * as Clipboard from "expo-clipboard";
import { Platform } from "react-native";

import { ROUTES } from "@/constants/routes";
import { SUPPORT_EMAIL } from "@/constants/support";
import type {
  TransferPlannerResolvedMajorPlan,
  TransferPlannerTrack,
} from "@/constants/transfer-planner-source/student-runtime";
import type {
  SuggestedQuarterPlan,
  TransferPlannerStudentEvaluationReport,
  TransferRequirementStatus,
  TranscriptCourseEntry,
} from "@/services/planning/transfer-planner.service";

import type {
  PlannerCampusSelectionId,
  PlannerCollegeId,
  TranscriptDocument,
} from "./transfer-planner-storage";
import {
  getReadableTranscriptFileName,
  getTranscriptUrlKind,
} from "./transfer-planner-transcript-debug";

export function buildCoursePlannerBugReportMailtoUrl(subject: string, body: string) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function copyCoursePlannerReportLogOnWeb(reportLog: string) {
  if (Platform.OS !== "web") return false;

  try {
    await Clipboard.setStringAsync(reportLog);
    return true;
  } catch {
    return false;
  }
}

export function openMailtoUrlOnWeb(mailtoUrl: string) {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;

  try {
    window.location.href = mailtoUrl;
    return true;
  } catch {
    return false;
  }
}

export function buildWebCoursePlannerBugReportBody(input: {
  copiedReportLog: boolean;
}) {
  const deliveryNotes: string[] = [];

  if (input.copiedReportLog) {
    deliveryNotes.push(
      "A current Course Planner log was copied to your clipboard so you can paste it below."
    );
  }

  if (!deliveryNotes.length) {
    deliveryNotes.push(
      "The automatic Course Planner log could not be copied in this browser, so please include any details you can."
    );
  }

  return `Please describe what happened in Course Planner:\n\n\n${deliveryNotes.join("\n")}`;
}

export function stringifyPlannerLogValue(value: unknown) {
  try {
    return JSON.stringify(
      value,
      (key, nestedValue) => {
        const lowerKey = key.toLowerCase();
        if (
          typeof nestedValue === "string" &&
          (/transcriptsource|sourcekey/i.test(key) ||
            lowerKey === "url" ||
            lowerKey.endsWith("url"))
        ) {
          return nestedValue
            ? `[redacted ${getTranscriptUrlKind(nestedValue)} length=${nestedValue.length}]`
            : nestedValue;
        }

        return nestedValue;
      },
      2
    );
  } catch {
    return String(value ?? "");
  }
}

export function formatPlannerReportList(values: string[], emptyLabel = "None") {
  const normalizedValues = values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  if (!normalizedValues.length) return emptyLabel;
  return normalizedValues.map((value) => `- ${value}`).join("\n");
}

export function formatCoursePreview(courses: TranscriptCourseEntry[], limit = 30) {
  if (!courses.length) return "None";

  const rows = courses.slice(0, limit).map((course) => {
    const details = [course.termLabel, course.catalogYearLabel].filter(Boolean).join("; ");
    return `- ${course.code} | ${course.label}${details ? ` (${details})` : ""}`;
  });
  const remainingCount = courses.length - rows.length;
  if (remainingCount > 0) {
    rows.push(`- ...and ${remainingCount} more`);
  }

  return rows.join("\n");
}

export function formatRequirementStatusSummary(label: string, statuses: TransferRequirementStatus[]) {
  const matchedCount = statuses.filter((status) => status.matched).length;
  const pending = statuses
    .filter((status) => !status.matched)
    .slice(0, 12)
    .map((status) => {
      const courseCodes = status.explicitCourseCodes.length
        ? ` [${status.explicitCourseCodes.join(", ")}]`
        : "";
      const progress = status.creditProgressLabel ? ` (${status.creditProgressLabel})` : "";
      return `${status.item.title}${courseCodes}${progress}`;
    });

  return [
    `${label}: ${matchedCount}/${statuses.length} matched`,
    pending.length ? formatPlannerReportList(pending, "") : "- No pending items in preview",
  ].join("\n");
}

export function formatSuggestedQuarterPlanLog(quarters: SuggestedQuarterPlan[]) {
  if (!quarters.length) return "No suggested quarter plan is currently built.";

  return quarters
    .map((quarter) => {
      const courses = quarter.courses.length
        ? quarter.courses
            .map((course) => `  - ${course.label} (${course.status}; ${course.type})`)
            .join("\n")
        : "  - No courses";
      return `${quarter.label} [${quarter.phase}]\n${courses}`;
    })
    .join("\n\n");
}

export function formatStudentEvaluationReportLog(report: TransferPlannerStudentEvaluationReport | null) {
  if (!report) return "No student evaluation report is currently built.";

  const buckets = report.buckets.length
    ? report.buckets
        .map((bucket) => `- ${bucket.label}: ${bucket.count} (${bucket.courseCodes.join(", ") || "none"})`)
        .join("\n")
    : "- No buckets";

  return [
    `Plan ID: ${report.planId ?? "none"}`,
    `Pathway ID: ${report.pathwayId ?? "none"}`,
    `Major: ${report.majorTitle}`,
    `Campus: ${report.campusLabel}`,
    `Completed courses: ${report.completedCourseCount}`,
    `Student-facing evaluations: ${report.studentFacingEvaluationCount}`,
    `Hidden evaluations: ${report.hiddenEvaluationCount}`,
    `Source links counted: ${report.sourceLinkCount}`,
    "",
    "Buckets:",
    buckets,
    "",
    "Warning course codes:",
    formatPlannerReportList(report.warningCourseCodes),
    "",
    "Missing sequence course codes:",
    formatPlannerReportList(report.missingSequenceCourseCodes),
    "",
    "Next planned courses:",
    formatPlannerReportList(report.nextPlannedCourseLabels),
    "",
    "Summary lines:",
    formatPlannerReportList(report.reportSummaryLines),
  ].join("\n");
}

export function buildCoursePlannerBugReportLog(input: {
  user: { uid?: string | null; email?: string | null; isGuest?: boolean | null } | null | undefined;
  selectedCollegeLabel: string;
  selectedCampusLabel: string;
  selectedMajorLabel: string;
  selectedCollegeId: PlannerCollegeId;
  selectedCampusId: PlannerCampusSelectionId;
  selectedMajorId: string;
  plannerPathKey: string;
  selectedPathwayId: string | null;
  selectedPathwayLabel: string | null;
  activeDegreeTitle: string;
  plan: TransferPlannerResolvedMajorPlan | null;
  track: TransferPlannerTrack | null;
  transcriptDocument: TranscriptDocument | null;
  transcriptError: string | null;
  parserVersion: number;
  storedParserVersion: number | null;
  storedTranscriptSource: string;
  shouldUseDetailedCompletedCourses: boolean;
  needsTranscriptReparse: boolean;
  completedCourses: TranscriptCourseEntry[];
  transcriptDerivedCompletedCourses: TranscriptCourseEntry[];
  currentPlannedCourseLabels: string[];
  onlyUwEssentialClasses: boolean;
  allowSummerClasses: boolean;
  allowStemPrepClasses: boolean;
  isHydrated: boolean;
  isPlannerComputationReady: boolean;
  isPlannerComputationLoading: boolean;
  hasStructuredPlannerData: boolean;
  hasNoDirectMajorEquivalencies: boolean;
  applicationStatuses: TransferRequirementStatus[];
  beforeEnrollmentStatuses: TransferRequirementStatus[];
  stayAtGrcStatuses: TransferRequirementStatus[];
  suggestedQuarterPlan: SuggestedQuarterPlan[];
  studentEvaluationReport: TransferPlannerStudentEvaluationReport | null;
  lastTranscriptDebug: unknown;
  recentTranscriptDebugEvents: unknown;
}) {
  const userLabel = input.user?.isGuest
    ? "Guest"
    : input.user?.email
      ? input.user.email
      : input.user?.uid
        ? `Signed-in user (${input.user.uid})`
        : "Unknown";
  const transcriptName = input.transcriptDocument
    ? getReadableTranscriptFileName(input.transcriptDocument)
    : "None";

  return [
    "GatorGuide Course Planner Bug Report Log",
    `Generated at: ${new Date().toISOString()}`,
    `Platform: ${Platform.OS}`,
    `Route: ${ROUTES.transferPlanner}`,
    `User: ${userLabel}`,
    "",
    "Selection",
    `- College: ${input.selectedCollegeLabel} (${input.selectedCollegeId})`,
    `- Campus: ${input.selectedCampusLabel} (${input.selectedCampusId})`,
    `- Major/program: ${input.selectedMajorLabel} (${input.selectedMajorId})`,
    `- Pathway: ${input.selectedPathwayLabel ?? "none"} (${input.selectedPathwayId ?? "none"})`,
    `- Active degree title: ${input.activeDegreeTitle}`,
    `- Planner path key: ${input.plannerPathKey}`,
    "",
    "Planner State",
    `- Hydrated: ${input.isHydrated ? "yes" : "no"}`,
    `- Computation ready: ${input.isPlannerComputationReady ? "yes" : "no"}`,
    `- Computation loading: ${input.isPlannerComputationLoading ? "yes" : "no"}`,
    `- Has structured planner data: ${input.hasStructuredPlannerData ? "yes" : "no"}`,
    `- Has no direct major equivalencies: ${input.hasNoDirectMajorEquivalencies ? "yes" : "no"}`,
    `- Only UW essential classes: ${input.onlyUwEssentialClasses ? "yes" : "no"}`,
    `- Allow summer classes: ${input.allowSummerClasses ? "yes" : "no"}`,
    `- Allow STEM prep classes: ${input.allowStemPrepClasses ? "yes" : "no"}`,
    "",
    "Selected Current Courses",
    formatPlannerReportList(input.currentPlannedCourseLabels),
    "",
    "Transcript State",
    `- Transcript file: ${transcriptName}`,
    `- Transcript URL kind: ${getTranscriptUrlKind(input.transcriptDocument?.url)}`,
    `- Transcript MIME type: ${input.transcriptDocument?.mimeType ?? "unknown"}`,
    `- Transcript size bytes: ${input.transcriptDocument?.sizeBytes ?? "unknown"}`,
    `- Transcript uploaded at: ${input.transcriptDocument?.uploadedAt ?? "unknown"}`,
    `- Transcript parser version: ${input.parserVersion}`,
    `- Stored parser version: ${input.storedParserVersion ?? "none"}`,
    `- Stored transcript source kind: ${getTranscriptUrlKind(input.storedTranscriptSource)}`,
    `- Uses detailed transcript courses: ${input.shouldUseDetailedCompletedCourses ? "yes" : "no"}`,
    `- Needs transcript reparse: ${input.needsTranscriptReparse ? "yes" : "no"}`,
    `- Transcript error: ${input.transcriptError ?? "none"}`,
    `- Completed courses count: ${input.completedCourses.length}`,
    `- Transcript-derived completed courses count: ${input.transcriptDerivedCompletedCourses.length}`,
    "",
    "Completed Course Preview",
    formatCoursePreview(input.completedCourses),
    "",
    "Plan And Track",
    stringifyPlannerLogValue({
      plan: input.plan
        ? {
            id: input.plan.id,
            campusId: input.plan.campusId,
            title: input.plan.title,
            selectedPathwayId: input.plan.selectedPathwayId ?? null,
            selectedPathwayLabel: input.plan.selectedPathwayLabel ?? null,
            bestTrackId: input.plan.bestTrackId ?? null,
            applicationChecklistCount: input.plan.applicationChecklist.length,
            beforeEnrollmentChecklistCount: input.plan.beforeEnrollmentChecklist.length,
            stayAtGrcChecklistCount: input.plan.stayAtGrcChecklist.length,
          }
        : null,
      track: input.track
        ? {
            id: input.track.id,
            code: input.track.code,
            title: input.track.title,
            summary: input.track.summary,
          }
        : null,
    }),
    "",
    "Requirement Statuses",
    formatRequirementStatusSummary("Application", input.applicationStatuses),
    "",
    formatRequirementStatusSummary("Before enrollment", input.beforeEnrollmentStatuses),
    "",
    formatRequirementStatusSummary("Stay at GRC", input.stayAtGrcStatuses),
    "",
    "Suggested Quarter Plan",
    formatSuggestedQuarterPlanLog(input.suggestedQuarterPlan),
    "",
    "Student Evaluation Report",
    formatStudentEvaluationReportLog(input.studentEvaluationReport),
    "",
    "Last Transcript Parser Debug Snapshot",
    stringifyPlannerLogValue(input.lastTranscriptDebug ?? "No transcript parser debug snapshot is available."),
    "",
    "Recent Transcript Debug Events",
    stringifyPlannerLogValue(input.recentTranscriptDebugEvents ?? []),
    "",
  ].join("\n");
}
