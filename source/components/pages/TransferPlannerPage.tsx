import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";

import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import {
  AnimatedCardPressable,
  AnimatedChipPressable,
  AnimatedIconPressable,
} from "@/components/ui/AnimatedPressables";
import {
  SearchableSelect,
  type SelectorOverlayStrategy,
} from "@/components/ui/SearchableSelect";
import { ROUTES } from "@/constants/routes";
import { SUPPORT_EMAIL } from "@/constants/support";
import { StateCard } from "@/components/ui/StateCard";
import {
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerCanonicalCourse,
  getTransferPlannerEquivalencyRulesForSourceCourse,
  getTransferPlannerStudentRuntimeMajorsForCampus,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  getTransferPlannerTrack,
  TRANSFER_PLANNER_TRACKS,
  resolveTransferPlannerStudentRuntimeMajorPlan,
  TRANSFER_PLANNER_CAMPUSES,
  type TransferPlannerCampusId,
  type TransferPlannerGeneralRequirementSection,
  type TransferPlannerMajorPathway,
  type TransferPlannerResolvedMajorPlan,
  type TransferPlannerStudentCourseEvaluation,
  type TransferPlannerTrack,
} from "@/constants/transfer-planner-source/student-runtime";
import { useAppData } from "@/hooks/use-app-data";
import { useAppTheme } from "@/hooks/use-app-theme";
import useBack from "@/hooks/use-back";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { transcriptPlannerDebugService } from "@/services/dev/transcript-planner-debug.service";
import { coursePlannerReportService } from "@/services/dev/course-planner-report.service";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import { storageService, type UploadedFile } from "@/services/storage/storage.service";
import {
  buildSourceBackedMajorGeneralEducationRequirementSection,
  buildSourceBackedGeneralEducationRequirementTargets,
  buildMajorSpecificsCourseSections,
  buildSourceBackedRequiredCourseSummaryEntries,
  buildSourceBackedRequiredCourseCodes,
  buildSourceBackedUwCourseConsideredSummaryEntries,
  buildSuggestedQuarterPlan,
  buildSuggestedQuarterRemainingCreditRange,
  buildUwGeneralTransferRequirementSection,
  buildRequirementStatuses,
  buildTransferPlannerStudentCourseEvaluations,
  buildTransferPlannerStudentEvaluationReport,
  buildSuggestedQuarterCourseOptionGroupsForTrack,
  countMatchedGrcTrackGeneralEducationBreadthRows,
  auditRequirementClassification,
  auditInvalidScheduledOptions,
  auditSbseCreditTotals,
  auditSbseCurrentVsOldSource,
  auditSbseScheduledRowSources,
  auditOptionGroupSatisfaction,
  auditOptionAllocation,
  auditCategoryOptionDetection,
  auditCategoryTranscriptSatisfaction,
  auditComputerEngineeringCreditBuckets,
  auditOptionTitleFallback,
  auditOptionCredits,
  auditOptionSelectionSources,
  auditCompoundEquivalencyPaths,
  auditTrueOptionDetection,
  auditSourceScope,
  auditSourceRowBoundaries,
  auditRequiredMappedCourseCoverage,
  auditRequirementRolePrecedence,
  auditCountedCourses,
  auditUwBioengineeringSourceBackedRequirements,
  extractCourseCodes,
  getPreparatoryTrackCourseCodeSet,
  getResolvedTrackTermsForRequirementDisplay,
  isMergedCourseDistributionRequirementLabel,
  parseCompletedTranscriptCourses,
  UW_TRANSFER_ADMISSION_CADR_EXEMPTION_QUARTER_CREDITS,
  type SuggestedQuarterPlan,
  type TransferPlannerStudentEvaluationReport,
  type TransferRequirementStatus,
  type TranscriptCourseEntry,
} from "@/services/planning/transfer-planner.service";
import {
  buildTransferPlannerTranscriptCachePatch,
  TRANSCRIPT_COURSES_FIELD,
  TRANSCRIPT_EARNED_CREDITS_FIELD,
  TRANSCRIPT_PARSER_VERSION,
  TRANSCRIPT_PARSER_VERSION_FIELD,
  TRANSCRIPT_SOURCE_FIELD,
  TRANSCRIPT_UPLOADED_AT_FIELD,
} from "@/services/planning/transfer-planner-cache.service";
import { resetTranscriptState } from "@/services/planning/transcript-reset.service";

const CTCLINK_UNOFFICIAL_TRANSCRIPT_URL =
  "https://csprd.ctclink.us/psp/csprd/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSS_TSRQST_UNOFF.GBL?pts_Portal=EMPLOYEE&pts_PortalHostNode=SA&pts_Market=GBL";

const CURRENT_PLANNED_COURSES_FIELD = "transferPlannerCurrentCoursesByPath";
// Bump this suffix when planner option-group generation changes so older saved
// selections/cache entries cannot hide newly generated option groups.
const SELECTED_PLANNER_OPTIONS_STORAGE_VERSION = "v2";
const SELECTED_PLANNER_OPTIONS_FIELD = `transferPlannerSelectedOptionsByPath:${SELECTED_PLANNER_OPTIONS_STORAGE_VERSION}`;
const SELECTED_PATHWAY_FIELD = "transferPlannerSelectedPathwayByPlan";
const LAST_SELECTED_PLAN_FIELD = "transferPlannerLastSelectedPlan";
const GRC_PLANNER_CAMPUS_ID = "grc";
const GENERATED_PROGRAM_MAP_SUMMARY_SENTENCE = [
  "Generated automatically",
  "from the current public program-map page",
  "and catalog API.",
].join(" ");

type PlannerCollegeId = "uw" | "grc";
type PlannerCampusSelectionId = TransferPlannerCampusId | typeof GRC_PLANNER_CAMPUS_ID;
type PlannerSelectorKey = "college" | "campus" | "major" | null;
type TranscriptDocument = UploadedFile;

function getTranscriptDocumentIdentity(document: TranscriptDocument | null | undefined) {
  if (!document?.url) return "";
  return `${document.url}|${document.uploadedAt ?? ""}`;
}

function getTranscriptAnalysisAttemptKey(document: TranscriptDocument | null | undefined) {
  const documentIdentity = getTranscriptDocumentIdentity(document);
  return documentIdentity ? `${documentIdentity}|v${TRANSCRIPT_PARSER_VERSION}` : "";
}

function buildFriendlyTranscriptError() {
  return "We couldn't read past classes from this unofficial transcript yet. Upload the PDF directly from ctcLink using the link below.";
}

function buildCoursePlannerBugReportMailtoUrl(subject: string, body: string) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function copyCoursePlannerReportLogOnWeb(reportLog: string) {
  if (Platform.OS !== "web") return false;

  try {
    await Clipboard.setStringAsync(reportLog);
    return true;
  } catch {
    return false;
  }
}

function openMailtoUrlOnWeb(mailtoUrl: string) {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;

  try {
    window.location.href = mailtoUrl;
    return true;
  } catch {
    return false;
  }
}

function buildWebCoursePlannerBugReportBody(input: {
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

function getReadableTranscriptFileName(document: TranscriptDocument | null) {
  const rawName = String(document?.name ?? "").trim();
  if (
    rawName &&
    rawName.length <= 180 &&
    !rawName.startsWith("data:") &&
    !rawName.startsWith("blob:") &&
    !rawName.includes("base64,")
  ) {
    return rawName;
  }

  const rawUrl = String(document?.url ?? "").trim();
  if (rawUrl && !rawUrl.startsWith("data:") && !rawUrl.startsWith("blob:")) {
    const withoutQuery = rawUrl.split(/[?#]/)[0] ?? "";
    const lastSegment = withoutQuery.split("/").pop() ?? "";
    try {
      const decoded = decodeURIComponent(lastSegment).trim();
      if (decoded && decoded.length <= 180) {
        return decoded;
      }
    } catch {
      if (lastSegment.trim() && lastSegment.trim().length <= 180) {
        return lastSegment.trim();
      }
    }
  }

  return "unofficial-transcript.pdf";
}

function getTranscriptUrlKind(url: string | null | undefined) {
  const raw = String(url ?? "").trim();
  if (!raw) return "missing";
  if (raw.startsWith("data:")) return "data-url";
  if (raw.startsWith("blob:")) return "blob-url";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return "remote-url";
  if (raw.startsWith("file://")) return "file-url";
  if (/^[A-Za-z]:[\\/]/.test(raw)) return "windows-local-path";
  if (raw.startsWith("/")) return "local-path";
  return "other";
}

function getDebugNowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function getDebugElapsedMs(startMs: number) {
  return Math.round((getDebugNowMs() - startMs) * 10) / 10;
}

function appendTranscriptDebugEvent(
  label: string,
  startedAtMs: number,
  metadata?: Record<string, unknown>
) {
  transcriptPlannerDebugService.appendTranscriptPlannerEvent({
    label,
    elapsedMs: getDebugElapsedMs(startedAtMs),
    metadata,
  });
}

function stringifyPlannerLogValue(value: unknown) {
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

function formatPlannerReportList(values: string[], emptyLabel = "None") {
  const normalizedValues = values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  if (!normalizedValues.length) return emptyLabel;
  return normalizedValues.map((value) => `- ${value}`).join("\n");
}

function formatCoursePreview(courses: TranscriptCourseEntry[], limit = 30) {
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

function formatRequirementStatusSummary(label: string, statuses: TransferRequirementStatus[]) {
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

function formatSuggestedQuarterPlanLog(quarters: SuggestedQuarterPlan[]) {
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

function formatStudentEvaluationReportLog(report: TransferPlannerStudentEvaluationReport | null) {
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

function buildCoursePlannerBugReportLog(input: {
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

function buildParsedCourseAssignmentsPreview(courses: TranscriptCourseEntry[]) {
  return courses.slice(0, 24).map((course) => ({
    code: course.code,
    label: course.label,
    termLabel: course.termLabel ?? null,
    termStartDate: course.termStartDate ?? null,
  }));
}

function buildParsedQuarterBuckets(courses: TranscriptCourseEntry[]) {
  const grouped = new Map<
    string,
    {
      termLabel: string | null;
      termStartDate: string | null;
      courseCodes: string[];
    }
  >();

  for (const course of courses) {
    const termLabel = String(course.termLabel ?? "").trim() || null;
    const termStartDate = String(course.termStartDate ?? "").trim() || null;
    const groupKey = `${termStartDate ?? ""}|${termLabel ?? ""}`;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        termLabel,
        termStartDate,
        courseCodes: [],
      });
    }

    const bucket = grouped.get(groupKey);
    if (!bucket) continue;
    if (!bucket.courseCodes.includes(course.code)) {
      bucket.courseCodes.push(course.code);
    }
  }

  return [...grouped.values()]
    .sort((left, right) =>
      `${left.termStartDate ?? ""}|${left.termLabel ?? ""}`.localeCompare(
        `${right.termStartDate ?? ""}|${right.termLabel ?? ""}`
      )
    )
    .slice(0, 12);
}

function getPlannerPathKey(campusId: string, majorId: string, pathwayId?: string | null) {
  return `${String(campusId ?? "").trim()}::${String(majorId ?? "").trim()}::${String(
    pathwayId ?? "base"
  ).trim()}`;
}

function normalizePlannerCurrentCourseMap(rawValue: unknown) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {} as Record<string, string[]>;
  }

  const normalized: Record<string, string[]> = {};

  for (const [pathKey, value] of Object.entries(rawValue)) {
    if (!Array.isArray(value)) continue;
    const nextValues = Array.from(
      new Set(
        value
          .map((entry) => String(entry ?? "").trim())
          .filter(Boolean)
      )
    );
    if (nextValues.length) {
      normalized[pathKey] = nextValues;
    }
  }

  return normalized;
}

function normalizePlannerSelectedOptionsMap(rawValue: unknown) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {} as Record<string, Record<string, string[]>>;
  }

  const normalized: Record<string, Record<string, string[]>> = {};

  for (const [pathKey, pathValue] of Object.entries(rawValue)) {
    if (!pathValue || typeof pathValue !== "object" || Array.isArray(pathValue)) {
      continue;
    }

    const selections: Record<string, string[]> = {};
    for (const [groupId, rawSelectionValue] of Object.entries(pathValue)) {
      const normalizedGroupId = String(groupId ?? "").trim();
      const rawSelectionValues = Array.isArray(rawSelectionValue)
        ? rawSelectionValue
        : rawSelectionValue == null
          ? []
          : [rawSelectionValue];
      const optionIds = Array.from(
        new Set(
          rawSelectionValues
            .map((entry) => String(entry ?? "").trim())
            .filter(Boolean)
        )
      );

      if (normalizedGroupId) {
        selections[normalizedGroupId] = optionIds;
      }
    }

    if (Object.keys(selections).length) {
      normalized[pathKey] = selections;
    }
  }

  return normalized;
}

function normalizePlannerSelectedPathwayMap(rawValue: unknown) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {} as Record<string, string>;
  }

  const normalized: Record<string, string> = {};

  for (const [planId, value] of Object.entries(rawValue)) {
    const normalizedPlanId = String(planId ?? "").trim();
    const normalizedPathwayId = String(value ?? "").trim();
    if (!normalizedPlanId || !normalizedPathwayId) continue;
    normalized[normalizedPlanId] = normalizedPathwayId;
  }

  return normalized;
}

function normalizePlannerLastSelectedPlan(rawValue: unknown) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
  }

  const rawCollegeId = (rawValue as Record<string, unknown>).collegeId;
  const rawCampusId = (rawValue as Record<string, unknown>).campusId;
  const rawMajorId = (rawValue as Record<string, unknown>).majorId;
  const collegeId = String(rawCollegeId ?? "").trim().toLowerCase();
  const campusId = String(rawCampusId ?? "").trim();
  const majorId = String(rawMajorId ?? "").trim();
  if (!campusId || !majorId) return null;

  return {
    collegeId: collegeId === "grc" || campusId === GRC_PLANNER_CAMPUS_ID ? "grc" : "uw",
    campusId,
    majorId,
  } as {
    collegeId: PlannerCollegeId;
    campusId: PlannerCampusSelectionId;
    majorId: string;
  };
}

function isPlannerUwCampusId(value: string): value is TransferPlannerCampusId {
  return TRANSFER_PLANNER_CAMPUSES.some((entry) => entry.id === value);
}

function getDefaultPlannerCampusId(collegeId: PlannerCollegeId): PlannerCampusSelectionId {
  return collegeId === "grc" ? GRC_PLANNER_CAMPUS_ID : "uw-seattle";
}

function getCollegeOptionLabel(collegeId: PlannerCollegeId) {
  return collegeId === "grc" ? "Green River College" : "University of Washington";
}

function getPlannerHeroContent(collegeId: PlannerCollegeId) {
  if (collegeId === "grc") {
    return {
      title: "Green River Course Planner",
      description:
        "This planner reads your completed Green River classes and maps them against the currently tracked Green River program paths so you can see what is already done and what is still needed for the program you pick.",
    };
  }

  return {
    title: "GRC -> UW Course Planner",
    description:
      "Classes for Green River College are cheaper/easier than those at the University of Washington. This tool matches you with a transfer track most compatible with your major, letting you take advantage of it by showing you every course that directly transfers in. Always check with your advisor before scheduling classes!",
  };
}

function getPlannerSelectionHelperText(
  collegeId: PlannerCollegeId,
  field: "college" | "campus" | "major"
) {
  if (field === "college") {
    return "Pick the college whose program requirements you want this planner to follow.";
  }

  if (field === "campus") {
    return collegeId === "grc"
      ? "Green River currently has one supported campus in this planner."
      : "Set the UW campus and major you want this Green River plan to match against.";
  }

  return collegeId === "grc"
    ? "Pick the Green River program you want the course plan to follow."
    : "Pick the UW bachelor's degree you want the course plan to follow.";
}

function getPlannerMajorSearchPlaceholder(collegeId: PlannerCollegeId) {
  return collegeId === "grc" ? "Search programs" : "Search majors";
}

function getPlannerNoDataMessage(collegeId: PlannerCollegeId) {
  return collegeId === "grc"
    ? "There is not a Green River program plan for this path yet."
    : "There is not a course plan for this campus yet.";
}

function stripGeneratedProgramMapSummarySentence(text: string | null | undefined) {
  return String(text ?? "")
    .replace(GENERATED_PROGRAM_MAP_SUMMARY_SENTENCE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type GrcTrackCredentialKind = "associate" | "certificate" | "bas";

function getGrcTrackCredentialKind(
  track: TransferPlannerTrack | null | undefined
): GrcTrackCredentialKind {
  const normalizedText = [
    String(track?.code ?? ""),
    String(track?.title ?? ""),
    String(track?.summary ?? ""),
    ...(Array.isArray(track?.notes) ? track.notes : []),
  ]
    .join(" ")
    .toLowerCase();

  if (/\bbas\b|bachelor of applied science/i.test(normalizedText)) {
    return "bas";
  }

  if (
    /\bcertificate\b|certificate of completion|certificate of accomplishment|certificate of proficiency/i.test(
      normalizedText
    )
  ) {
    return "certificate";
  }

  return "associate";
}

function getGrcTrackRequirementNoun(track: TransferPlannerTrack | null | undefined) {
  return getGrcTrackCredentialKind(track) === "associate" ? "degree" : "program";
}

function formatSuggestedScheduleCreditCount(creditAmount: number) {
  const roundedCreditAmount = Number.isInteger(creditAmount)
    ? String(creditAmount)
    : creditAmount.toFixed(1).replace(/\.0$/, "");
  return `${roundedCreditAmount} ${creditAmount === 1 ? "credit" : "credits"}`;
}

function formatSuggestedScheduleCreditNumber(creditAmount: number) {
  return Number.isInteger(creditAmount)
    ? String(creditAmount)
    : creditAmount.toFixed(1).replace(/\.0$/, "");
}

function formatSuggestedScheduleCreditRange(input: {
  creditMin: number;
  creditMax: number;
}) {
  if (input.creditMin === input.creditMax) {
    return formatSuggestedScheduleCreditCount(input.creditMin);
  }

  return `${formatSuggestedScheduleCreditNumber(input.creditMin)}-${formatSuggestedScheduleCreditNumber(
    input.creditMax
  )} credits`;
}

function getSuggestedScheduleCredentialLabel(
  degreeTitle: string,
  grcTrackRequirementNoun: string
) {
  const trimmedDegreeTitle = String(degreeTitle ?? "").trim() || "selected";
  if (/\b(degree|program|certificate)\b$/i.test(trimmedDegreeTitle)) {
    return trimmedDegreeTitle;
  }

  const credentialNoun =
    grcTrackRequirementNoun === "degree" ? "Degree" : "Program";
  return `${trimmedDegreeTitle} ${credentialNoun}`;
}

type SuggestedScheduleQuarterSeason = "Winter" | "Spring" | "Summer" | "Fall";

type SuggestedScheduleQuarterParts = {
  season: SuggestedScheduleQuarterSeason;
  year: number;
};

const UW_TRANSFER_DEADLINE_MONTH_LABELS: Record<number, string> = {
  2: "February",
  9: "September",
};

function getSuggestedCourseCreditAmount(
  course: SuggestedQuarterPlan["courses"][number]
) {
  const creditAmount = Number(course.creditAmount);
  return Number.isFinite(creditAmount) && creditAmount > 0 ? creditAmount : 0;
}

function getSuggestedCourseCreditRange(
  course: SuggestedQuarterPlan["courses"][number]
) {
  const exactCreditAmount = getSuggestedCourseCreditAmount(course) || null;
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

function getSuggestedQuarterCreditTotal(quarter: SuggestedQuarterPlan) {
  return quarter.courses.reduce(
    (totalCredits, course) => totalCredits + getSuggestedCourseCreditRange(course).creditMin,
    0
  );
}

function parseSuggestedScheduleQuarterLabel(
  label: string | null | undefined
): SuggestedScheduleQuarterParts | null {
  const match = String(label ?? "").match(/\b(Winter|Spring|Summer|Fall|Autumn)\s+(\d{4})\b/i);
  if (!match) return null;

  const parsedYear = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(parsedYear)) return null;

  const rawSeason = String(match[1] ?? "").toLowerCase();
  const season: SuggestedScheduleQuarterSeason =
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

function formatUwTransferDeadlineDate(month: number, day: number, year: number) {
  return `${UW_TRANSFER_DEADLINE_MONTH_LABELS[month] ?? `Month ${month}`} ${day}, ${year}`;
}

function getUwTransferApplicationCycleForQuarter(
  quarter: SuggestedScheduleQuarterParts
) {
  if (quarter.season === "Winter") {
    return {
      deadlineText: formatUwTransferDeadlineDate(2, 15, quarter.year),
      admissionTerm: `Autumn/Summer ${quarter.year}`,
    };
  }

  if (quarter.season === "Spring" || quarter.season === "Summer") {
    return {
      deadlineText: formatUwTransferDeadlineDate(9, 1, quarter.year),
      admissionTerm: `Winter ${quarter.year + 1}`,
    };
  }

  return {
    deadlineText: formatUwTransferDeadlineDate(2, 15, quarter.year + 1),
    admissionTerm: `Autumn/Summer ${quarter.year + 1}`,
  };
}

function shouldUseGenericUwTransferMinimumRequirementSummary(input: {
  selectedCampusId: TransferPlannerCampusId | null;
  selectedMajorId: string | null;
  degreeTitle: string;
}) {
  const context = [input.selectedCampusId, input.selectedMajorId, input.degreeTitle]
    .map((value) => String(value ?? "").replace(/[-_]+/g, " ").toLowerCase())
    .join(" ");

  // Generic UW transfer timing is only a broad university-level credit milestone.
  // Do not show it for engineering-style majors because those usually have
  // source-specific departmental admission cycles and prerequisite gates.
  if (
    /\b(?:engineering|materials science|bioengineering|chemical engineering|computer engineering|electrical engineering|mechanical engineering|civil engineering|industrial engineering|aeronautics|astronautics|human centered design|hcde)\b/i.test(
      context
    )
  ) {
    return false;
  }

  return true;
}

function buildUwTransferMinimumRequirementSummary(input: {
  quarters: SuggestedQuarterPlan[];
  selectedCampusId: TransferPlannerCampusId | null;
  selectedMajorId: string | null;
  degreeTitle: string;
}) {
  if (!shouldUseGenericUwTransferMinimumRequirementSummary(input)) {
    return null;
  }

  const quarters = input.quarters;
  const completedCredits = quarters
    .filter((quarter) => quarter.phase === "completed")
    .reduce(
      (totalCredits, quarter) => totalCredits + getSuggestedQuarterCreditTotal(quarter),
      0
    );
  let cumulativeCredits = completedCredits;
  const upcomingQuarters = quarters.filter((quarter) => quarter.phase !== "completed");

  for (const quarter of upcomingQuarters) {
    const quarterParts = parseSuggestedScheduleQuarterLabel(quarter.label);
    if (!quarterParts) {
      cumulativeCredits += getSuggestedQuarterCreditTotal(quarter);
      continue;
    }

    if (cumulativeCredits < UW_TRANSFER_ADMISSION_CADR_EXEMPTION_QUARTER_CREDITS) {
      cumulativeCredits += getSuggestedQuarterCreditTotal(quarter);
    }

    if (cumulativeCredits >= UW_TRANSFER_ADMISSION_CADR_EXEMPTION_QUARTER_CREDITS) {
      const applicationCycle = getUwTransferApplicationCycleForQuarter(quarterParts);
      return `${quarter.label} - Minimum transfer requirements are met. Apply by ${applicationCycle.deadlineText} to be considered for ${applicationCycle.admissionTerm} admission at UW.`;
    }
  }

  return null;
}

function getGrcTrackSpecificsTitle(track: TransferPlannerTrack | null | undefined) {
  return getGrcTrackRequirementNoun(track) === "degree" ? "Degree Specifics" : "Program Specifics";
}

function getGrcTrackClassesLabelSuffix(track: TransferPlannerTrack | null | undefined) {
  return getGrcTrackRequirementNoun(track) === "degree" ? "Degree Classes" : "Program Classes";
}

function getScheduleCampusLabel(collegeId: PlannerCollegeId, campusLabel: string) {
  const trimmed = String(campusLabel ?? "").trim();
  if (collegeId === "grc") {
    return trimmed || "Green River College";
  }
  if (!trimmed) return "UW";
  if (/^UW\s+/i.test(trimmed)) return trimmed;
  return `UW ${trimmed}`;
}

function getEvaluationOutcomeBadgeLabel(outcome: TransferPlannerStudentCourseEvaluation["outcome"]) {
  switch (outcome) {
    case "auto-approved":
      return "Applies";
    case "legacy-rule-used":
      return "Legacy";
    case "elective-credit":
      return "Elective";
    case "sequence-incomplete":
      return "Sequence";
    case "no-credit":
      return "No credit";
    case "not-applicable-to-major":
      return "Not used";
    case "source-unverified-hidden":
      return "Hidden";
  }
}

function getEvaluationOutcomeBadgeClass(outcome: TransferPlannerStudentCourseEvaluation["outcome"]) {
  switch (outcome) {
    case "auto-approved":
      return "bg-emerald-500/10 border-emerald-500/20";
    case "legacy-rule-used":
    case "sequence-incomplete":
      return "bg-amber-500/10 border-amber-500/20";
    case "elective-credit":
      return "bg-sky-500/10 border-sky-500/20";
    case "no-credit":
      return "bg-red-500/10 border-red-500/20";
    case "not-applicable-to-major":
    case "source-unverified-hidden":
      return "bg-white/5 border-white/10";
  }
}

function getEvaluationOutcomeTextClass(
  outcome: TransferPlannerStudentCourseEvaluation["outcome"],
  fallbackTextClass: string
) {
  switch (outcome) {
    case "auto-approved":
      return "text-emerald-500";
    case "legacy-rule-used":
    case "sequence-incomplete":
      return "text-amber-500";
    case "elective-credit":
      return "text-sky-400";
    case "no-credit":
      return "text-red-400";
    case "not-applicable-to-major":
    case "source-unverified-hidden":
      return fallbackTextClass;
  }
}

function normalizeRequirementTag(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function getRequirementTagLabel(normalizedTag: string) {
  switch (normalizedTag) {
    case "AH":
      return "A&H";
    case "SSC":
      return "SSc";
    case "NSC":
      return "NSc";
    case "QSR":
      return "QSR";
    case "VLPA":
      return "VLPA";
    case "DIV":
      return "DIV";
    case "NW":
      return "NW";
    case "IANDS":
      return "I&S";
    default:
      return normalizedTag;
  }
}

function getRequirementTagSearchLabels(normalizedTag: string) {
  switch (normalizedTag) {
    case "AH":
      return ["A&H", "Arts and Humanities", "Humanities"];
    case "SSC":
      return ["SSc", "Social Sciences", "Social Science"];
    case "NSC":
      return ["NSc", "Natural Sciences", "Natural Science"];
    case "QSR":
      return ["QSR", "Quantitative and Symbolic Reasoning"];
    case "VLPA":
      return ["VLPA", "Visual, Literary, and Performing Arts"];
    case "DIV":
      return ["DIV", "Diversity"];
    case "NW":
      return ["NW", "Natural World"];
    case "IANDS":
      return ["I&S", "Individuals and Societies"];
    default:
      return [getRequirementTagLabel(normalizedTag)];
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferRequirementCreditTotalFromText(text: string, normalizedTag: string) {
  const tagSearchLabels = Array.from(new Set(getRequirementTagSearchLabels(normalizedTag)));

  for (const tagLabel of tagSearchLabels) {
    const escapedTag = escapeRegExp(tagLabel);
    const patterns = [
      new RegExp(`${escapedTag}[^\\n]{0,80}?(\\d+(?:\\.\\d+)?)\\s*credits`, "i"),
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*credits[^\\n]{0,80}?${escapedTag}`, "i"),
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) continue;

      const parsed = Number.parseFloat(match[1] ?? "");
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

function normalizePlannerCourseCode(value: string) {
  const normalized = String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^([A-Z&]+(?: [A-Z&]+)*) (\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (!match) {
    return normalized;
  }

  const subjectTokens = match[1].split(" ").filter(Boolean);
  const normalizedSubject = subjectTokens.every((token) => token.length === 1)
    ? subjectTokens.join("")
    : subjectTokens.join(" ");

  return `${normalizedSubject} ${match[2]}`;
}

function getPlanDegreeMapSearchText(plan: TransferPlannerResolvedMajorPlan) {
  return (plan.degreeMapSections ?? [])
    .flatMap((section) => [section.title, section.note ?? "", ...section.items])
    .join("\n");
}

type MajorSpecificsGeneralEducationCategoryId =
  | "ah"
  | "ssc"
  | "nsc"
  | "breadth"
  | "div"
  | "qsr"
  | "vlpa"
  | "nw"
  | "iands";

type MajorSpecificsGeneralEducationCreditLine = {
  id: MajorSpecificsGeneralEducationCategoryId;
  label: string;
  credits: number;
};

const MAJOR_SPECIFICS_GENERAL_ED_CATEGORIES: {
  id: MajorSpecificsGeneralEducationCategoryId;
  label: string;
}[] = [
  { id: "ah", label: "Arts & Humanities Classes" },
  { id: "ssc", label: "Social Science Classes" },
  { id: "nsc", label: "Natural Science Classes" },
  { id: "breadth", label: "Flexible Breadth Classes" },
  { id: "div", label: "Diversity Classes" },
  { id: "qsr", label: "Quantitative & Symbolic Reasoning Classes" },
  { id: "vlpa", label: "Visual, Literary & Performing Arts Classes" },
  { id: "nw", label: "Natural World Classes" },
  { id: "iands", label: "Individuals & Societies Classes" },
];

type MajorSpecificsGeneralEducationCreditTotals = Record<
  MajorSpecificsGeneralEducationCategoryId,
  number
>;

function createEmptyMajorSpecificsGeneralEducationCreditTotals(): MajorSpecificsGeneralEducationCreditTotals {
  return {
    ah: 0,
    ssc: 0,
    nsc: 0,
    breadth: 0,
    div: 0,
    qsr: 0,
    vlpa: 0,
    nw: 0,
    iands: 0,
  };
}

function buildMajorSpecificsGeneralEducationCreditLinesFromTotals(
  totals: MajorSpecificsGeneralEducationCreditTotals
): MajorSpecificsGeneralEducationCreditLine[] {
  return MAJOR_SPECIFICS_GENERAL_ED_CATEGORIES.map((entry) => ({
    id: entry.id,
    label: entry.label,
    credits: totals[entry.id] ?? 0,
  })).filter((entry) => entry.credits > 0);
}

function inferMajorSpecificsGeneralEducationCreditsFromTrackLabel(courseLabel: string) {
  const normalizedLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedLabel) return 0;

  const explicitCreditsMatch = normalizedLabel.match(/(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b/i);
  if (explicitCreditsMatch) {
    const parsedCredits = Number.parseFloat(explicitCreditsMatch[1] ?? "");
    if (Number.isFinite(parsedCredits) && parsedCredits > 0) {
      return parsedCredits;
    }
  }

  if (/^\d+\s+[A-Z]\s*[-:]/i.test(normalizedLabel)) {
    return 5;
  }

  const repeatedCourseCountMatch = normalizedLabel.match(/^(\d+)\s+[A-Z]\b/i);
  if (repeatedCourseCountMatch) {
    const parsedCourseCount = Number.parseInt(repeatedCourseCountMatch[1] ?? "", 10);
    if (Number.isFinite(parsedCourseCount) && parsedCourseCount > 0) {
      return parsedCourseCount * 5;
    }
  }

  if (/^[A-Z]\s*\d+\b/i.test(normalizedLabel)) {
    return 5;
  }

  if (
    /\b(?:humanit|fine arts|arts and humanities|social sciences?|natural sciences?|diversity|qsr|quantitative|vlpa|visual,\s*literary|natural world|individuals?\s+and\s+societies|i&s)\b/i.test(
      normalizedLabel
    )
  ) {
    return 5;
  }

  return 0;
}

function getMajorSpecificsGeneralEducationCategoryIdsForTrackLabel(
  courseLabel: string
): MajorSpecificsGeneralEducationCategoryId[] {
  const normalizedLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedLabel || extractCourseCodes(normalizedLabel).length > 0) {
    return [];
  }

  if (
    /^(?:suggested|recommend|consider|see\b|discuss\b|students?\s+are\s+responsible\b|green river college is fully accredited\b)/i.test(
      normalizedLabel
    )
  ) {
    return [];
  }

  const lower = normalizedLabel.toLowerCase();
  const categories = new Set<MajorSpecificsGeneralEducationCategoryId>();
  const hasHumanities =
    lower.includes("humanit") ||
    lower.includes("fine arts") ||
    lower.includes("arts and humanities") ||
    /\ba&h\b/i.test(normalizedLabel) ||
    /^\s*h\s*\d+\b/i.test(normalizedLabel);
  const hasSocialScience =
    lower.includes("social science") ||
    /\bssc\b/i.test(normalizedLabel) ||
    /^\s*s\s*\d+\b/i.test(normalizedLabel);
  const hasNaturalScience =
    lower.includes("natural science") ||
    /\bnsc\b/i.test(normalizedLabel) ||
    /^\s*n\s*\d+\b/i.test(normalizedLabel);
  const hasFlexibleBreadth =
    /(?:\badditional areas?\s+of inquiry\b|\bor\b)/i.test(normalizedLabel) &&
    [hasHumanities, hasSocialScience, hasNaturalScience].filter(Boolean).length >= 2;

  if (hasFlexibleBreadth) {
    categories.add("breadth");
  } else {
    if (hasHumanities) categories.add("ah");
    if (hasSocialScience) categories.add("ssc");
    if (hasNaturalScience) categories.add("nsc");
  }

  if (
    /^\s*d\s*\d+\b/i.test(normalizedLabel) ||
    /\bdiversity\b[^.]{0,48}\b(?:requirement|required|minimum|must|need)\b/i.test(normalizedLabel) ||
    /\b\d+\s*(?:credits?|cr)\b[^.]{0,48}\bdiversity\b/i.test(normalizedLabel)
  ) {
    categories.add("div");
  }

  if (
    /\bqsr\b/i.test(normalizedLabel) ||
    /quantitative(?:\s+and)?\s+symbolic reasoning/i.test(normalizedLabel)
  ) {
    categories.add("qsr");
  }

  if (
    /\bvlpa\b/i.test(normalizedLabel) ||
    /visual,\s*literary(?:,\s*and)?\s+performing arts/i.test(normalizedLabel)
  ) {
    categories.add("vlpa");
  }

  if (/\bnw\b/i.test(normalizedLabel) || /natural world/i.test(normalizedLabel)) {
    categories.add("nw");
  }

  if (/\bi&s\b/i.test(normalizedLabel) || /individuals?\s+and\s+societies/i.test(normalizedLabel)) {
    categories.add("iands");
  }

  return Array.from(categories);
}

function buildMajorSpecificsSourceBackedUwGeneralEducationCreditLines(
  plan: TransferPlannerResolvedMajorPlan
) {
  const searchableText = getPlanDegreeMapSearchText(plan);
  const parsedTargets = buildSourceBackedGeneralEducationRequirementTargets(plan);
  const totals = createEmptyMajorSpecificsGeneralEducationCreditTotals();

  totals.ah = parsedTargets.ahCredits ?? inferRequirementCreditTotalFromText(searchableText, "AH") ?? 0;
  totals.ssc = parsedTargets.sscCredits ?? inferRequirementCreditTotalFromText(searchableText, "SSC") ?? 0;
  totals.nsc = parsedTargets.nscCredits ?? inferRequirementCreditTotalFromText(searchableText, "NSC") ?? 0;
  totals.breadth = parsedTargets.breadthCredits ?? 0;
  totals.div = inferRequirementCreditTotalFromText(searchableText, "DIV") ?? 0;
  totals.qsr = inferRequirementCreditTotalFromText(searchableText, "QSR") ?? 0;
  totals.vlpa = inferRequirementCreditTotalFromText(searchableText, "VLPA") ?? 0;
  totals.nw = inferRequirementCreditTotalFromText(searchableText, "NW") ?? 0;
  totals.iands = inferRequirementCreditTotalFromText(searchableText, "IANDS") ?? 0;

  return buildMajorSpecificsGeneralEducationCreditLinesFromTotals(totals);
}

function buildInferredMajorSpecificsSupplementalUwGeneralEducationItems(
  plan: TransferPlannerResolvedMajorPlan
): TransferPlannerGeneralRequirementSection["items"] {
  const searchableText = getPlanDegreeMapSearchText(plan);
  const totals = createEmptyMajorSpecificsGeneralEducationCreditTotals();
  totals.div = inferRequirementCreditTotalFromText(searchableText, "DIV") ?? 0;
  totals.qsr = inferRequirementCreditTotalFromText(searchableText, "QSR") ?? 0;
  totals.vlpa = inferRequirementCreditTotalFromText(searchableText, "VLPA") ?? 0;
  totals.nw = inferRequirementCreditTotalFromText(searchableText, "NW") ?? 0;
  totals.iands = inferRequirementCreditTotalFromText(searchableText, "IANDS") ?? 0;

  return buildMajorSpecificsGeneralEducationCreditLinesFromTotals(totals).map((entry) => ({
    id: entry.id,
    label: entry.label,
    valueText: `${entry.credits} credits`,
    note: undefined,
    sourceKind: "source-backed-major" as const,
  }));
}

function buildMajorSpecificsSourceBackedUwGeneralEducationSection(
  plan: TransferPlannerResolvedMajorPlan
) {
  const sourceBackedSection = buildSourceBackedMajorGeneralEducationRequirementSection(plan);
  const supplementalItems = buildInferredMajorSpecificsSupplementalUwGeneralEducationItems(plan);
  const mergedItems = [
    ...(sourceBackedSection?.items ?? []),
    ...supplementalItems.filter(
      (item) => !(sourceBackedSection?.items ?? []).some((existingItem) => existingItem.id === item.id)
    ),
  ];

  if (!mergedItems.length) {
    return null;
  }

  return {
    id: sourceBackedSection?.id ?? "source-backed-major-general-education",
    title: sourceBackedSection?.title ?? "Major Required Gen-Eds",
    summary:
      sourceBackedSection?.summary ??
      "Source-backed major-specific general education targets from the current official major materials.",
    campusId: sourceBackedSection?.campusId ?? plan.campusId,
    sourceKind: sourceBackedSection?.sourceKind ?? ("source-backed-major" as const),
    plannerUsage: sourceBackedSection?.plannerUsage ?? ("summary-only" as const),
    items: mergedItems,
  } satisfies TransferPlannerGeneralRequirementSection;
}

function buildCopyOnlyGenEdSourceDebugText(input: {
  plannerMode: string;
  sourceBackedTargetCount: number;
  hiddenMatchedGrcTrackBreadthRowCount: number;
}) {
  return [
    "[copy-only gen-ed source debug]",
    `Planner mode: ${input.plannerMode}`,
    `UW source-backed targets: ${input.sourceBackedTargetCount}`,
    `Matched GRC track breadth rows hidden from UW gen-ed section: ${input.hiddenMatchedGrcTrackBreadthRowCount}`,
  ].join(" ");
}

function buildMajorSpecificsGrcGeneralEducationCreditLines(args: {
  plan: TransferPlannerResolvedMajorPlan | null;
  track: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
}) {
  const { plan, track, completedCourses } = args;
  if (!track) {
    return plan ? buildMajorSpecificsSourceBackedUwGeneralEducationCreditLines(plan) : [];
  }

  const totals = createEmptyMajorSpecificsGeneralEducationCreditTotals();
  const resolvedTerms = getResolvedTrackTermsForRequirementDisplay(track, completedCourses).filter(
    (term) => !GRC_TRACK_NOTE_TERM_LABEL_PATTERN.test(String(term.label ?? "").trim())
  );

  for (const courseLabel of resolvedTerms.flatMap((term) => term.courses)) {
    const categoryIds = getMajorSpecificsGeneralEducationCategoryIdsForTrackLabel(courseLabel);
    if (!categoryIds.length) continue;

    const credits = inferMajorSpecificsGeneralEducationCreditsFromTrackLabel(courseLabel);
    if (!credits) continue;

    for (const categoryId of categoryIds) {
      totals[categoryId] += credits;
    }
  }

  return buildMajorSpecificsGeneralEducationCreditLinesFromTotals(totals);
}

function buildCourseDisplayLabel(
  schoolId: "grc" | TransferPlannerCampusId,
  courseCodeOrLabel: string
) {
  const rawValue = String(courseCodeOrLabel ?? "").trim();
  if (!rawValue) return "";
  if (rawValue.includes(" - ")) return rawValue;

  const extractedCourseCode = extractCourseCodes(rawValue)[0] ?? rawValue;
  const normalizedCourseCode = normalizePlannerCourseCode(extractedCourseCode);
  const canonicalCourse = getTransferPlannerCanonicalCourse(schoolId, normalizedCourseCode);
  if (canonicalCourse?.title) {
    return `${normalizedCourseCode} - ${canonicalCourse.title}`;
  }

  return rawValue === normalizedCourseCode ? rawValue : normalizedCourseCode;
}

function appendUniqueCourseCode(
  orderedCourseCodes: string[],
  seenCourseCodes: Set<string>,
  courseCode: string
) {
  const normalizedCourseCode = normalizePlannerCourseCode(courseCode);
  if (!normalizedCourseCode || seenCourseCodes.has(normalizedCourseCode)) return;
  seenCourseCodes.add(normalizedCourseCode);
  orderedCourseCodes.push(normalizedCourseCode);
}

function appendUniqueCourseCodesFromLabels(
  orderedCourseCodes: string[],
  seenCourseCodes: Set<string>,
  labels: string[]
) {
  for (const label of labels) {
    const extractedCourseCodes = extractCourseCodes(label);
    if (extractedCourseCodes.length) {
      for (const courseCode of extractedCourseCodes) {
        appendUniqueCourseCode(orderedCourseCodes, seenCourseCodes, courseCode);
      }
      continue;
    }

    appendUniqueCourseCode(orderedCourseCodes, seenCourseCodes, label);
  }
}

function buildMajorSpecificsFallbackGrcCourseLabels(plan: TransferPlannerResolvedMajorPlan) {
  const orderedLabels: string[] = [];
  const seenLabels = new Set<string>();
  const addLabel = (label: string) => {
    const normalizedLabel = String(label ?? "").trim();
    if (!normalizedLabel || seenLabels.has(normalizedLabel)) return;
    seenLabels.add(normalizedLabel);
    orderedLabels.push(normalizedLabel);
  };

  for (const courseLabel of plan.grcCourseList ?? []) {
    addLabel(buildCourseDisplayLabel("grc", courseLabel));
  }

  if (orderedLabels.length) {
    return orderedLabels;
  }

  const fallbackCourseCodes: string[] = [];
  const seenCourseCodes = new Set<string>();
  const checklistItems = [...plan.applicationChecklist, ...plan.beforeEnrollmentChecklist];
  for (const item of checklistItems) {
    appendUniqueCourseCodesFromLabels(fallbackCourseCodes, seenCourseCodes, item.grcCourses ?? []);
  }

  return fallbackCourseCodes.map((courseCode) => buildCourseDisplayLabel("grc", courseCode));
}

const GRC_TRACK_NOTE_TERM_LABEL_PATTERN = /\btransferability of credits\b/i;

function buildRequiredCourseSentence(courseLabel: string) {
  const normalizedCourseLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
  return normalizedCourseLabel ? `${normalizedCourseLabel} is required.` : "";
}

function getTrackGroupedChoiceSelectionCount(
  choice: NonNullable<TransferPlannerTrack["groupedChoices"]>[number]
) {
  const selectionCount = Number(choice.selectionCount ?? 1);
  if (!Number.isFinite(selectionCount) || selectionCount <= 0) {
    return 1;
  }
  return Math.max(1, Math.min(Math.ceil(selectionCount), choice.options.length || 1));
}

function getTrackGroupedChoiceShortLabel(label: string) {
  return (
    String(label ?? "")
      .split(">")
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1) ?? "Green River track option"
  );
}

function buildTrackGroupedChoiceRequiredCourseLine(
  choice: NonNullable<TransferPlannerTrack["groupedChoices"]>[number]
) {
  const selectionCount = getTrackGroupedChoiceSelectionCount(choice);
  const optionLabels = choice.options.map((option) => option.label).filter(Boolean);
  const previewOptions = optionLabels.slice(0, 10);
  const hiddenOptionCount = Math.max(optionLabels.length - previewOptions.length, 0);
  const optionsText = previewOptions.length
    ? `${previewOptions.join("; ")}${hiddenOptionCount > 0 ? `; plus ${hiddenOptionCount} more` : ""}`
    : "approved options";
  const actionText =
    selectionCount === 1
      ? "Choose one approved option"
      : `Choose ${selectionCount} approved options`;
  const defaultOptionLabels = (choice.defaultOptionIds ?? [])
    .map((optionId) => choice.options.find((option) => option.id === optionId)?.label ?? "")
    .filter(Boolean);
  const defaultText = defaultOptionLabels.length
    ? ` Default sample-map option${defaultOptionLabels.length === 1 ? "" : "s"}: ${defaultOptionLabels.join("; ")}.`
    : "";
  const creditText = choice.requiredCredits ? ` (${choice.requiredCredits} credits)` : "";

  return {
    id: choice.id,
    text: `${getTrackGroupedChoiceShortLabel(choice.label)}${creditText}: ${actionText}. Options: ${optionsText}.${defaultText}`,
  };
}

function isTrackCourseLabelCoveredByGroupedChoice(
  label: string,
  groupedChoices: NonNullable<TransferPlannerTrack["groupedChoices"]>
) {
  const courseCodes = extractCourseCodes(label).map((courseCode) =>
    normalizePlannerCourseCode(courseCode)
  );
  if (!courseCodes.length || !groupedChoices.length) {
    return false;
  }

  return groupedChoices.some((choice) => {
    const choiceCourseCodes = new Set(
      choice.options
        .flatMap((option) => [...(option.courseCodes ?? []), ...(option.courseLabels ?? []).flatMap(extractCourseCodes)])
        .map((courseCode) => normalizePlannerCourseCode(courseCode))
        .filter(Boolean)
    );
    if (!choiceCourseCodes.size) {
      return false;
    }

    return courseCodes.some((courseCode) => choiceCourseCodes.has(courseCode));
  });
}

function buildMajorSpecificsGrcRequiredMajorCourseLines(args: {
  plan: TransferPlannerResolvedMajorPlan | null;
  track: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
}) {
  const { plan, track, completedCourses } = args;
  if (plan) {
    const summaryEntries = buildSourceBackedRequiredCourseSummaryEntries(plan, {
      mode: "grc",
    });
    if (summaryEntries.length) {
      return summaryEntries.map((entry) => ({
        id: entry.id,
        text: entry.text,
      }));
    }
  }

  const orderedLines: { id: string; text: string }[] = [];
  const seenCourseCodes = new Set<string>();
  const preparatoryCourseCodes = getPreparatoryTrackCourseCodeSet(track);
  const groupedChoices = track?.groupedChoices ?? [];
  orderedLines.push(...groupedChoices.map(buildTrackGroupedChoiceRequiredCourseLine));
  const addCourseLabel = (courseLabel: string) => {
    const normalizedLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
    if (isMergedCourseDistributionRequirementLabel(normalizedLabel)) return;
    if (isTrackCourseLabelCoveredByGroupedChoice(normalizedLabel, groupedChoices)) return;

    const explicitCourseCodes = extractCourseCodes(normalizedLabel);
    if (!normalizedLabel || explicitCourseCodes.length !== 1) return;

    const normalizedCourseCode = normalizePlannerCourseCode(explicitCourseCodes[0]);
    if (
      !normalizedCourseCode ||
      preparatoryCourseCodes.has(normalizedCourseCode) ||
      seenCourseCodes.has(normalizedCourseCode)
    ) {
      return;
    }

    seenCourseCodes.add(normalizedCourseCode);
    orderedLines.push({
      id: normalizedCourseCode,
      text: buildRequiredCourseSentence(getSuggestedScheduleCourseDisplayLabel(normalizedLabel)),
    });
  };

  if (track) {
    for (const term of getResolvedTrackTermsForRequirementDisplay(track, completedCourses)) {
      if (GRC_TRACK_NOTE_TERM_LABEL_PATTERN.test(String(term.label ?? "").trim())) {
        continue;
      }

      for (const courseLabel of term.courses) {
        addCourseLabel(courseLabel);
      }
    }
  }

  if (orderedLines.length > 0) {
    return orderedLines;
  }

  if (plan) {
    for (const courseLabel of buildMajorSpecificsFallbackGrcCourseLabels(plan)) {
      addCourseLabel(courseLabel);
    }
  }

  return orderedLines;
}

function buildRequiredPlannerCourseCodes(plan: TransferPlannerResolvedMajorPlan) {
  const orderedCourseCodes = buildSourceBackedRequiredCourseCodes(plan);

  if (!orderedCourseCodes.length) {
    const fallbackCourseCodes: string[] = [];
    const seenCourseCodes = new Set<string>();
    appendUniqueCourseCodesFromLabels(
      fallbackCourseCodes,
      seenCourseCodes,
      plan.grcCourseList ?? []
    );
    return fallbackCourseCodes;
  }

  return orderedCourseCodes;
}

function buildUwCoursesConsideredEntries(plan: TransferPlannerResolvedMajorPlan) {
  return buildUwRequiredPathCourseEntries(plan);
}

function buildUwRequiredPathCourseEntries(plan: TransferPlannerResolvedMajorPlan) {
  return buildSourceBackedUwCourseConsideredSummaryEntries(plan).map((entry) => ({
    id: entry.id,
    text: entry.text,
  }));
}

function buildRequirementCreditTotalsByTag(
  plan: TransferPlannerResolvedMajorPlan,
  evaluations: TransferPlannerStudentCourseEvaluation[]
) {
  const totals = new Map<string, number>();
  const candidateTags = new Set(
    evaluations
      .flatMap((evaluation) => evaluation.targetRequirementTags)
      .map((tag) => normalizeRequirementTag(tag))
      .filter(Boolean)
  );

  if (!candidateTags.size || !plan.degreeMapSections?.length) {
    return totals;
  }

  const searchableText = plan.degreeMapSections
    .flatMap((section) => [section.title, section.note ?? "", ...section.items])
    .join("\n");

  for (const tag of candidateTags) {
    const detectedTotal = inferRequirementCreditTotalFromText(searchableText, tag);
    if (detectedTotal && detectedTotal > 0) {
      totals.set(tag, detectedTotal);
    }
  }

  return totals;
}

function shouldShowRequirementCreditMessage(evaluation: TransferPlannerStudentCourseEvaluation) {
  return (
    (evaluation.outcome === "auto-approved" ||
      evaluation.outcome === "legacy-rule-used" ||
      evaluation.outcome === "elective-credit") &&
    evaluation.targetRequirementTags.length > 0
  );
}

function getEvaluationRequirementCreditMessageParts(input: {
  evaluation: TransferPlannerStudentCourseEvaluation;
  totalsByTag: Map<string, number>;
  completedByTag: Map<string, number>;
  campusId: TransferPlannerCampusId;
}) {
  const { evaluation, totalsByTag, completedByTag, campusId } = input;
  if (!shouldShowRequirementCreditMessage(evaluation)) return null;

  const normalizedTags = Array.from(
    new Set(
      evaluation.targetRequirementTags
        .map((tag) => normalizeRequirementTag(tag))
        .filter(Boolean)
    )
  );
  if (!normalizedTags.length) return null;

  const selectedTag = normalizedTags.find((tag) => totalsByTag.has(tag)) ?? normalizedTags[0];
  if (!selectedTag) return null;

  const tagLabel = getRequirementTagLabel(selectedTag);
  const fulfilledCredits = evaluation.sourceCreditAmount ?? 5;
  const totalCredits = totalsByTag.get(selectedTag) ?? null;

  if (!totalCredits) {
    return {
      prefix: `Fulfills ${fulfilledCredits} credits of the `,
      clickableLabel: tagLabel,
      suffix: " requirement.",
      normalizedTag: selectedTag,
      campusId,
    };
  }

  const completedCredits = Math.min(completedByTag.get(selectedTag) ?? 0, totalCredits);
  return {
    prefix: `Fulfills ${fulfilledCredits} credits of the ${totalCredits}-credit `,
    clickableLabel: tagLabel,
    suffix: ` requirement. ${completedCredits}/${totalCredits} credits have been completed.`,
    normalizedTag: selectedTag,
    campusId,
  };
}

function hasDirectEquivalentRuleForCourse(courseCode: string, campusId: TransferPlannerCampusId) {
  return getTransferPlannerEquivalencyRulesForSourceCourse(courseCode).some((rule) => {
    if (!rule.targetSchoolIds.includes(campusId)) return false;
    if (rule.acceptanceCategory === "no-credit") return false;
    if (rule.type === "elective-credit" || rule.type === "limited-credit") return false;
    return true;
  });
}

function hasAnyDirectMajorEquivalencies(plan: TransferPlannerResolvedMajorPlan) {
  const requirementCourseCodes = buildRequiredPlannerCourseCodes(plan);
  if (!requirementCourseCodes.length) return false;

  return requirementCourseCodes.some((courseCode: string) =>
    hasDirectEquivalentRuleForCourse(courseCode, plan.campusId)
  );
}

function buildAdmissionContextText(plan: TransferPlannerResolvedMajorPlan) {
  return [
    plan.summary,
    ...(plan.degreeMapSections ?? []).flatMap((section) => section.items),
    ...plan.advisorFlags,
    ...(plan.validationNotes ?? []),
  ]
    .map((item) => String(item ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isOpenAdmissionMajor(plan: TransferPlannerResolvedMajorPlan) {
  const admissionText = buildAdmissionContextText(plan);
  if (!admissionText) return false;
  if (/\bnot an open major\b|\brather than an open major\b/.test(admissionText)) {
    return false;
  }

  return /\bopen\s+major\b|\bopen\s+admission\b|\bdeclare (?:this|the) major at any time\b/.test(
    admissionText
  );
}

function getSchedulePlaceholderRequirementLinkData(courseLabel: string) {
  const normalized = String(courseLabel ?? "").trim();
  if (!normalized) return null;
  const explicitCourseCodes = extractCourseCodes(normalized);
  const hasCreditPlaceholder = /\bcredits?\s+of\b/i.test(normalized);
  const hasGrcDistributionPlaceholder =
    explicitCourseCodes.length === 0 &&
    (/\b[HSN]\s*\d\b/i.test(normalized) ||
      /\b(?:humanities?|fine arts|arts and humanities|social sciences?|natural sciences?|natural science list)\b/i.test(
        normalized
      ));
  const hasGeneralPlaceholder =
    explicitCourseCodes.length === 0 &&
    /\b(?:electives?|general education|gen ed)\b/i.test(normalized);
  if (!hasCreditPlaceholder && !hasGrcDistributionPlaceholder && !hasGeneralPlaceholder) {
    return null;
  }

  const lower = normalized.toLowerCase();
  const hasHumanities =
    lower.includes("humanit") ||
    lower.includes("fine arts") ||
    lower.includes("a&h") ||
    lower.includes("arts and humanities") ||
    /\bh\s*\d\b/i.test(normalized);
  const hasSocialScience =
    lower.includes("social science") || /\bssc\b/i.test(lower) || /\bs\s*\d\b/i.test(normalized);
  const hasNaturalScience =
    lower.includes("natural science") || /\bnsc\b/i.test(lower) || /\bn\s*\d\b/i.test(normalized);

  if (hasHumanities && hasSocialScience) {
    return { tags: ["AH", "SSC"] as const };
  }
  if (hasHumanities) {
    return { tags: ["AH"] as const };
  }
  if (hasSocialScience) {
    return { tags: ["SSC"] as const };
  }
  if (hasNaturalScience) {
    return { tags: ["NSC"] as const };
  }
  if (lower.includes("elective") || lower.includes("general education") || lower.includes("gen ed")) {
    return { tags: [] as const };
  }

  return { tags: [] as const };
}

function getSuggestedScheduleCourseDisplayLabel(courseLabel: string) {
  const normalizedLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedLabel) return "";

  const explicitCourseCodes = extractCourseCodes(normalizedLabel);
  if (explicitCourseCodes.length !== 1) {
    return normalizedLabel;
  }

  const [canonicalCourseCode] = explicitCourseCodes;
  const rawLeadingCourseCode =
    normalizedLabel
      .match(/^[A-Z]{2,6}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/i)?.[0]
      ?.toUpperCase()
      .replace(/\s+/g, " ")
      .trim() ?? canonicalCourseCode;

  if (normalizedLabel.toUpperCase() !== rawLeadingCourseCode.toUpperCase()) {
    const normalizedCodePrefix = `${rawLeadingCourseCode} `.toUpperCase();
    if (normalizedLabel.toUpperCase().startsWith(normalizedCodePrefix)) {
      const remainder = normalizedLabel.slice(rawLeadingCourseCode.length).trim();
      if (remainder && !remainder.startsWith("-")) {
        return `${rawLeadingCourseCode} - ${remainder}`;
      }
    }
    return normalizedLabel;
  }

  const canonicalCourseTitle = String(
    getTransferPlannerCanonicalCourse("grc", rawLeadingCourseCode)?.title ??
      getTransferPlannerCanonicalCourse("grc", canonicalCourseCode)?.title ??
      ""
  ).trim();
  if (!canonicalCourseTitle) {
    return normalizedLabel;
  }

  return `${rawLeadingCourseCode} - ${canonicalCourseTitle}`;
}

function removeGuidanceSummaryPrefixes(
  summary: string | null | undefined,
  prefixes: (string | null | undefined)[]
) {
  let remainingSummary = String(summary ?? "").trim();
  if (!remainingSummary) return null;

  for (const prefix of prefixes) {
    const normalizedPrefix = String(prefix ?? "").trim();
    if (!normalizedPrefix) continue;

    if (remainingSummary === normalizedPrefix) {
      return null;
    }

    if (remainingSummary.startsWith(`${normalizedPrefix} `)) {
      remainingSummary = remainingSummary.slice(normalizedPrefix.length).trim();
    }
  }

  return remainingSummary || null;
}

function isSuggestedScheduleGeneratedOptionSummary(summary: string | null | undefined) {
  const normalizedSummary = String(summary ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedSummary) return false;

  return (
    /^Default sample-map options?:/i.test(normalizedSummary) ||
    /^Selected options?:/i.test(normalizedSummary) ||
    /^Options:/i.test(normalizedSummary)
  );
}

type SuggestedScheduleOptionGroup = NonNullable<
  SuggestedQuarterPlan["courses"][number]["optionGroup"]
>;
type SuggestedScheduleOption = SuggestedScheduleOptionGroup["options"][number];

function getSuggestedScheduleUniqueOptionIds(optionIds: string[] | null | undefined) {
  return [
    ...new Set(
      (optionIds ?? []).map((optionId) => String(optionId ?? "").trim()).filter(Boolean)
    ),
  ];
}

function getSuggestedScheduleSelectedOptions(optionGroup: SuggestedScheduleOptionGroup) {
  const selectedOptionIdSet = new Set(
    getSuggestedScheduleResolvedOptionIds(optionGroup)
  );
  return optionGroup.options.filter((option) => selectedOptionIdSet.has(option.id));
}

function getSuggestedScheduleOptionCourseDisplayLabels(option: SuggestedScheduleOption) {
  return option.courseLabels
    .map(getSuggestedScheduleCourseDisplayLabel)
    .map((label) => label.trim())
    .filter(Boolean);
}

function isSuggestedScheduleDuplicateSingleCourseOptionLabel(
  option: SuggestedScheduleOption
) {
  if (option.courseLabels.length !== 1) return false;

  const normalizedOptionLabel = String(option.label ?? "").replace(/\s+/g, " ").trim();
  const normalizedCourseLabel = String(option.courseLabels[0] ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalizedOptionLabel || !normalizedCourseLabel) return false;

  return (
    normalizedOptionLabel.toUpperCase() === normalizedCourseLabel.toUpperCase() ||
    normalizedOptionLabel.toUpperCase() ===
      `${normalizedCourseLabel}: ${normalizedCourseLabel}`.toUpperCase()
  );
}

function getSuggestedScheduleOptionDisplayLabel(option: SuggestedScheduleOption) {
  const courseDisplayLabels = getSuggestedScheduleOptionCourseDisplayLabels(option);
  const normalizedOptionLabel = String(option.label ?? "").replace(/\s+/g, " ").trim();
  if (
    courseDisplayLabels.length === 1 &&
    isSuggestedScheduleDuplicateSingleCourseOptionLabel(option)
  ) {
    return courseDisplayLabels[0];
  }

  return normalizedOptionLabel || courseDisplayLabels.join(" / ") || "Option";
}

function getSuggestedScheduleOptionCourseDetailText(option: SuggestedScheduleOption) {
  const courseDisplayLabels = getSuggestedScheduleOptionCourseDisplayLabels(option);
  if (!courseDisplayLabels.length) return null;

  const optionDisplayLabel = getSuggestedScheduleOptionDisplayLabel(option);
  const courseDetailText = courseDisplayLabels.join(", ");
  return courseDetailText === optionDisplayLabel ? null : courseDetailText;
}

function getSuggestedScheduleOptionSelectedDisplayLabel(option: SuggestedScheduleOption) {
  const optionDisplayLabel = getSuggestedScheduleOptionDisplayLabel(option);
  const courseDetailText = getSuggestedScheduleOptionCourseDetailText(option);
  return courseDetailText ? `${optionDisplayLabel} (${courseDetailText})` : optionDisplayLabel;
}

function isSuggestedScheduleCategoryOption(option: SuggestedScheduleOption) {
  return option.optionKind === "category-option" && Boolean(option.categoryOption);
}

function getSuggestedScheduleOptionCompletedTranscriptSatisfiers(
  optionGroup: SuggestedScheduleOptionGroup,
  optionId: string
) {
  return optionGroup.completedSatisfyingCourseCodesByOptionId?.[optionId] ?? [];
}

function getSuggestedScheduleOptionCompletedTranscriptSatisfierText(
  optionGroup: SuggestedScheduleOptionGroup,
  optionId: string
) {
  const satisfiers = getSuggestedScheduleOptionCompletedTranscriptSatisfiers(
    optionGroup,
    optionId
  );
  return satisfiers.length ? satisfiers.join(", ") : null;
}

function getSuggestedScheduleOptionStatusDisplayLabel(
  optionGroup: SuggestedScheduleOptionGroup,
  option: SuggestedScheduleOption
) {
  const selectedLabel = getSuggestedScheduleOptionSelectedDisplayLabel(option);
  const transcriptSatisfierText = isSuggestedScheduleCategoryOption(option)
    ? getSuggestedScheduleOptionCompletedTranscriptSatisfierText(optionGroup, option.id)
    : null;
  return transcriptSatisfierText
    ? `${selectedLabel}, satisfied by ${transcriptSatisfierText}`
    : selectedLabel;
}

function getSuggestedScheduleSelectedOptionLabels(optionGroup: SuggestedScheduleOptionGroup) {
  return getSuggestedScheduleSelectedOptions(optionGroup).map((option) => {
    const selectedLabel = getSuggestedScheduleOptionStatusDisplayLabel(optionGroup, option);
    return option.guidanceSummary
      ? `${selectedLabel}. ${option.guidanceSummary}`
      : selectedLabel;
  });
}

const COPY_ONLY_OPTION_STATUS_TEXT_STYLE = {
  color: "transparent",
  opacity: 0.01,
  fontSize: 1,
  lineHeight: 1,
  height: 1,
  maxHeight: 1,
  overflow: "hidden" as const,
};

function buildSuggestedScheduleCopyOnlyOptionStatusText(input: {
  optionGroup: SuggestedScheduleOptionGroup;
  option: SuggestedScheduleOption;
  isSelected: boolean;
  displayGroupTitle: string;
}) {
  const transcriptSatisfierText = getSuggestedScheduleOptionCompletedTranscriptSatisfierText(
    input.optionGroup,
    input.option.id
  );
  const satisfiedByText =
    isSuggestedScheduleCategoryOption(input.option) && transcriptSatisfierText
      ? `completed transcript course ${transcriptSatisfierText}`
      : getSuggestedScheduleOptionSatisfiedBy(input.optionGroup, input.option.id);

  return [
    "[copy-only option status]",
    `Option group: ${input.displayGroupTitle}`,
    `Original group title: ${input.optionGroup.title || "none"}`,
    `Option: ${getSuggestedScheduleOptionDisplayLabel(input.option)}`,
    `Is selected option: ${input.isSelected ? "yes" : "no"}`,
    `Option id: ${input.option.id}`,
    `Option group id: ${input.optionGroup.id}`,
    `Satisfied by: ${satisfiedByText}`,
    `Selection source: ${getSuggestedScheduleOptionSatisfiedBy(
      input.optionGroup,
      input.option.id
    )}`,
  ].join(" ");
}

function buildSuggestedScheduleCopyOnlyToggleStatusText(input: {
  collegeId: PlannerCollegeId;
  showOnlyUwEssentialClassesToggle: boolean;
  onlyUwEssentialClasses: boolean;
  allowStemPrepClasses: boolean;
  allowSummerClasses: boolean;
}) {
  return [
    "[copy-only planner toggle status]",
    `Planner college: ${input.collegeId}`,
    `Classes for UW transfer only toggle visible: ${
      input.showOnlyUwEssentialClassesToggle ? "yes" : "no"
    }`,
    `Classes for UW transfer only: ${
      input.showOnlyUwEssentialClassesToggle
        ? input.onlyUwEssentialClasses
          ? "on"
          : "off"
        : "not applicable"
    }`,
    `Allow STEM prep classes: ${input.allowStemPrepClasses ? "on" : "off"}`,
    `Allow summer classes: ${input.allowSummerClasses ? "on" : "off"}`,
  ].join(" ");
}

function getSuggestedScheduleOptionCreditRange(option: SuggestedScheduleOption) {
  return {
    creditMin: Number(option.creditMin ?? option.creditAmount) || 0,
    creditMax:
      Number(option.creditMax ?? option.creditAmount ?? option.creditMin) || 0,
  };
}

function getSuggestedScheduleOptionGroupSelectionTargetText(
  optionGroup: SuggestedScheduleOptionGroup
) {
  const selectionCount = Math.max(
    1,
    Math.ceil(Number(optionGroup.selectionCount ?? 1) || 1)
  );
  return selectionCount === 1
    ? "Choose 1 approved option"
    : `Choose ${selectionCount} approved options`;
}

function getSuggestedScheduleOptionGroupSelectedCount(
  optionGroup: SuggestedScheduleOptionGroup
) {
  return getSuggestedScheduleResolvedOptionIds(optionGroup).length;
}

function getSuggestedScheduleResolvedOptionIds(optionGroup: SuggestedScheduleOptionGroup) {
  if (optionGroup.resolvedSatisfiedOptionIds) {
    return getSuggestedScheduleUniqueOptionIds(optionGroup.resolvedSatisfiedOptionIds);
  }

  return getSuggestedScheduleUniqueOptionIds(optionGroup.selectedOptionIds);
}

function getSuggestedScheduleOptionSatisfactionSources(
  optionGroup: SuggestedScheduleOptionGroup,
  optionId: string
) {
  return optionGroup.optionSatisfactionSourcesById?.[optionId] ?? [];
}

function getSuggestedScheduleOptionSatisfiedBy(
  optionGroup: SuggestedScheduleOptionGroup,
  optionId: string
) {
  const sources = new Set(
    getSuggestedScheduleOptionSatisfactionSources(optionGroup, optionId)
  );
  if (sources.has("user-selected")) return "user-selected";
  if (sources.has("transcript-completed")) return "transcript";
  if (sources.has("planner-defaulted")) return "default";
  if (sources.has("scheduled-and-counted")) return "scheduled-counted";
  if (optionGroup.selectedOptionIds.includes(optionId)) {
    return optionGroup.selectionSource === "default" ? "default" : "user-selected";
  }
  return "none";
}

function getSuggestedScheduleOptionGroupStatusVerb(
  optionGroup: SuggestedScheduleOptionGroup
) {
  const selectedSourceLabels = getSuggestedScheduleResolvedOptionIds(optionGroup)
    .map((optionId) => getSuggestedScheduleOptionSatisfiedBy(optionGroup, optionId))
    .filter((sourceLabel) => sourceLabel !== "none");
  const uniqueSourceLabels = getSuggestedScheduleUniqueOptionIds(selectedSourceLabels);
  if (!uniqueSourceLabels.length) return "Selected";
  if (uniqueSourceLabels.length > 1) return "Satisfied";
  if (uniqueSourceLabels[0] === "default") return "Default";
  if (uniqueSourceLabels[0] === "transcript") return "Completed";
  if (uniqueSourceLabels[0] === "scheduled-counted") return "Satisfied";
  return "Selected";
}

function shouldPreferSuggestedScheduleOptionGroup(
  currentOptionGroup: SuggestedScheduleOptionGroup,
  nextOptionGroup: SuggestedScheduleOptionGroup
) {
  const currentSelectedCount = getSuggestedScheduleOptionGroupSelectedCount(
    currentOptionGroup
  );
  const nextSelectedCount = getSuggestedScheduleOptionGroupSelectedCount(nextOptionGroup);

  return (
    (nextOptionGroup.selectionSource === "student" &&
      currentOptionGroup.selectionSource !== "student") ||
    (nextOptionGroup.isSelectionPrompt && !currentOptionGroup.isSelectionPrompt) ||
    nextSelectedCount > currentSelectedCount
  );
}

function mergeSuggestedScheduleOptionGroups(
  existingOptionGroups: SuggestedScheduleOptionGroup[],
  nextOptionGroups: SuggestedScheduleOptionGroup[]
) {
  const optionGroupsById = new Map<string, SuggestedScheduleOptionGroup>();

  for (const optionGroup of existingOptionGroups) {
    optionGroupsById.set(optionGroup.id, optionGroup);
  }

  for (const optionGroup of nextOptionGroups) {
    const currentOptionGroup = optionGroupsById.get(optionGroup.id);
    if (
      !currentOptionGroup ||
      shouldPreferSuggestedScheduleOptionGroup(currentOptionGroup, optionGroup)
    ) {
      optionGroupsById.set(optionGroup.id, optionGroup);
    }
  }

  return [...optionGroupsById.values()];
}

function addStableSuggestedScheduleOptionGroupId(
  optionGroupIds: string[],
  seenOptionGroupIds: Set<string>,
  rawOptionGroupId: string | null | undefined
) {
  const optionGroupId = String(rawOptionGroupId ?? "").trim();
  if (!optionGroupId || seenOptionGroupIds.has(optionGroupId)) {
    return;
  }

  seenOptionGroupIds.add(optionGroupId);
  optionGroupIds.push(optionGroupId);
}

function buildStableSuggestedScheduleOptionGroupIds(input: {
  plan: TransferPlannerResolvedMajorPlan | null;
  trackOptionGroups: SuggestedScheduleOptionGroup[];
}) {
  const optionGroupIds: string[] = [];
  const seenOptionGroupIds = new Set<string>();

  for (const optionGroup of input.trackOptionGroups) {
    addStableSuggestedScheduleOptionGroupId(
      optionGroupIds,
      seenOptionGroupIds,
      optionGroup.id
    );
  }

  const planChecklistItems = [
    ...(input.plan?.applicationChecklist ?? []),
    ...(input.plan?.beforeEnrollmentChecklist ?? []),
    ...(input.plan?.stayAtGrcChecklist ?? []),
  ];

  for (const item of planChecklistItems) {
    if (!item.requirementGroup?.options?.length) {
      continue;
    }

    addStableSuggestedScheduleOptionGroupId(
      optionGroupIds,
      seenOptionGroupIds,
      item.requirementGroup.id
    );
  }

  for (const group of input.plan?.requirementGroups ?? []) {
    addStableSuggestedScheduleOptionGroupId(
      optionGroupIds,
      seenOptionGroupIds,
      group.id
    );
  }

  return optionGroupIds;
}

function orderSuggestedScheduleOptionGroupsByStableIds(
  optionGroups: SuggestedScheduleOptionGroup[],
  stableOptionGroupIds: string[]
) {
  if (optionGroups.length < 2 || !stableOptionGroupIds.length) {
    return optionGroups;
  }

  const stableIndexByGroupId = new Map(
    stableOptionGroupIds.map((groupId, index) => [groupId, index])
  );
  const fallbackBaseIndex = stableOptionGroupIds.length;

  return optionGroups
    .map((optionGroup, currentIndex) => ({
      optionGroup,
      currentIndex,
      stableIndex: stableIndexByGroupId.get(optionGroup.id) ?? fallbackBaseIndex + currentIndex,
    }))
    .sort((left, right) => {
      const stableDelta = left.stableIndex - right.stableIndex;
      if (stableDelta !== 0) return stableDelta;
      return left.currentIndex - right.currentIndex;
    })
    .map((entry) => entry.optionGroup);
}

function collectSuggestedScheduleOptionGroups(quarters: SuggestedQuarterPlan[]) {
  const optionGroups: SuggestedScheduleOptionGroup[] = [];

  for (const quarter of quarters) {
    for (const course of quarter.courses) {
      const optionGroup = course.optionGroup ?? null;
      if (!optionGroup) continue;
      optionGroups.push(optionGroup);
    }
  }

  return mergeSuggestedScheduleOptionGroups([], optionGroups);
}

function getSuggestedScheduleOptionGroupDisplayTitle(input: {
  optionGroup: SuggestedScheduleOptionGroup;
  titleFallbackAuditRows: ReturnType<typeof auditOptionTitleFallback>;
  visibleOptionIndex: number;
}) {
  return (
    input.titleFallbackAuditRows[input.visibleOptionIndex - 1]?.displayedTitle ||
    input.optionGroup.title ||
    `Requirement Choice ${input.visibleOptionIndex}`
  );
}

function buildSuggestedScheduleCopyOnlyOptionBoxSummaryText(input: {
  rawOptionGroups: SuggestedScheduleOptionGroup[];
  trackOptionGroups: SuggestedScheduleOptionGroup[];
  displayedOptionGroups: SuggestedScheduleOptionGroup[];
  forceNumberedOptionTitles?: boolean;
  preserveOriginalOptionTitles?: boolean;
}) {
  const displayedTitleFallbackAuditRows = auditOptionTitleFallback({
    optionGroups: input.displayedOptionGroups,
    forceNumberedTitles: input.forceNumberedOptionTitles,
    preserveOriginalTitles: input.preserveOriginalOptionTitles,
  });
  const formatIds = (
    optionGroups: SuggestedScheduleOptionGroup[],
    titleFallbackAuditRows?: ReturnType<typeof auditOptionTitleFallback>
  ) =>
    optionGroups.length
      ? optionGroups
          .map((optionGroup, index) => {
            const title =
              titleFallbackAuditRows?.[index]?.displayedTitle ?? optionGroup.title;
            return `${title}::${optionGroup.id}`;
          })
          .join(" | ")
      : "none";

  return [
    "[copy-only option box summary]",
    `Raw group count: ${input.rawOptionGroups.length}`,
    `Raw quarter option group count: ${input.rawOptionGroups.length}`,
    `Raw quarter option groups: ${formatIds(input.rawOptionGroups)}`,
    `Matched track option group count: ${input.trackOptionGroups.length}`,
    `Matched track option groups: ${formatIds(input.trackOptionGroups)}`,
    `Displayed group count: ${input.displayedOptionGroups.length}`,
    `Displayed option group count: ${input.displayedOptionGroups.length}`,
    `Displayed option groups: ${formatIds(
      input.displayedOptionGroups,
      displayedTitleFallbackAuditRows
    )}`,
  ].join(" ");
}

function buildSuggestedScheduleCopyOnlyOptionGroupVisibilityText(input: {
  optionGroup: SuggestedScheduleOptionGroup;
  displayTitle: string;
  isOpen: boolean;
}) {
  return [
    "[copy-only option group visibility]",
    `Group id: ${input.optionGroup.id}`,
    `Group title: ${input.displayTitle}`,
    `Original group title: ${input.optionGroup.title || "none"}`,
    "Is visible: yes",
    "Is in option box: yes",
    `Is open: ${input.isOpen ? "yes" : "no"}`,
    `Selection source: ${input.optionGroup.selectionSource ?? "none"}`,
    `Selected count: ${getSuggestedScheduleOptionGroupSelectedCount(input.optionGroup)}`,
    `Required count: ${getSuggestedScheduleOptionGroupRequiredSelectionCount(input.optionGroup)}`,
    `Resolved satisfied option ids: ${
      getSuggestedScheduleResolvedOptionIds(input.optionGroup).join(", ") || "none"
    }`,
  ].join(" ");
}

function buildSuggestedScheduleCopyOnlySelectedOptionStateText(input: {
  plannerPathKey: string;
  optionGroup: SuggestedScheduleOptionGroup;
}) {
  return [
    "[copy-only selected option state]",
    `Path key: ${input.plannerPathKey}`,
    `Group id: ${input.optionGroup.id}`,
    `Selected ids: ${
      getSuggestedScheduleUniqueOptionIds(input.optionGroup.selectedOptionIds).join(", ") ||
      "none"
    }`,
    `Resolved satisfied ids: ${
      getSuggestedScheduleResolvedOptionIds(input.optionGroup).join(", ") || "none"
    }`,
  ].join(" ");
}

function buildSuggestedScheduleCopyOnlyOptionDropdownHeaderText(input: {
  optionGroup: SuggestedScheduleOptionGroup;
  isOpen: boolean;
  displayTitle: string;
  statusText: string;
  progressText: string;
  transcriptSatisfierText?: string | null;
}) {
  return [
    "[copy-only option dropdown header]",
    `Group id: ${input.optionGroup.id}`,
    `Visible header title: ${input.displayTitle}`,
    `Visible header status: ${input.statusText}`,
    `Transcript satisfier: ${input.transcriptSatisfierText || "none"}`,
    `Visible header progress: ${input.progressText}`,
    `Is open: ${input.isOpen ? "yes" : "no"}`,
  ].join(" ");
}

function getSuggestedScheduleOptionGroupTranscriptSatisfierText(
  optionGroup: SuggestedScheduleOptionGroup
) {
  return getSuggestedScheduleSelectedOptions(optionGroup)
    .map((option) =>
      isSuggestedScheduleCategoryOption(option)
        ? getSuggestedScheduleOptionCompletedTranscriptSatisfierText(optionGroup, option.id)
        : null
    )
    .filter(Boolean)
    .join(", ");
}

function getSuggestedScheduleOptionGroupRequiredSelectionCount(
  optionGroup: SuggestedScheduleOptionGroup
) {
  return Math.max(1, Math.ceil(Number(optionGroup.selectionCount ?? 1) || 1));
}

function isSuggestedScheduleUnresolvedOptionPromptCourse(
  course: SuggestedQuarterPlan["courses"][number]
) {
  const optionGroup = course.optionGroup ?? null;
  if (!optionGroup?.isSelectionPrompt || course.status === "completed") {
    return false;
  }

  const selectedCount = getSuggestedScheduleOptionGroupSelectedCount(optionGroup);
  const requiredSelectionCount = getSuggestedScheduleOptionGroupRequiredSelectionCount(optionGroup);
  return selectedCount < requiredSelectionCount;
}

function buildSuggestedScheduleRenderedQuarters(quarters: SuggestedQuarterPlan[]) {
  return quarters
    .map((quarter) => ({
      ...quarter,
      courses: quarter.courses.filter(
        (course) => !isSuggestedScheduleUnresolvedOptionPromptCourse(course)
      ),
    }))
    .filter((quarter) => quarter.phase !== "planned" || quarter.courses.length > 0);
}

function buildSuggestedScheduleCreditRangeQuarters(quarters: SuggestedQuarterPlan[]) {
  return quarters.map((quarter) => ({
    ...quarter,
    courses: quarter.courses.map((course) => {
      if (!isSuggestedScheduleUnresolvedOptionPromptCourse(course)) {
        return course;
      }

      const creditRange = getSuggestedCourseCreditRange(course);
      return {
        ...course,
        creditAmount: null,
        creditMin: 0,
        creditMax: creditRange.creditMax,
      };
    }),
  }));
}

function SuggestedScheduleOptionsBox({
  optionGroups,
  plannerPathKey,
  optionBoxSummaryText,
  forceNumberedOptionTitles,
  preserveOriginalOptionTitles,
  onSelectRequirementOption,
  textClass,
  secondaryTextClass,
  borderClass,
}: {
  optionGroups: SuggestedScheduleOptionGroup[];
  plannerPathKey: string;
  optionBoxSummaryText?: string | null;
  forceNumberedOptionTitles?: boolean;
  preserveOriginalOptionTitles?: boolean;
  onSelectRequirementOption: (
    groupId: string,
    optionId: string,
    selectionCount: number,
    currentSelectedOptionIds?: string[]
  ) => void;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
}) {
  const { isLight } = useAppTheme();
  const [closedOptionGroupIds, setClosedOptionGroupIds] = useState<Set<string>>(
    () => new Set()
  );
  const toggleOptionGroup = useCallback((groupId: string) => {
    setClosedOptionGroupIds((currentGroupIds) => {
      const nextGroupIds = new Set(currentGroupIds);
      if (nextGroupIds.has(groupId)) {
        nextGroupIds.delete(groupId);
      } else {
        nextGroupIds.add(groupId);
      }
      return nextGroupIds;
    });
  }, []);

  if (!optionGroups.length) return null;

  const optionTitleFallbackAuditRows = auditOptionTitleFallback({
    optionGroups,
    forceNumberedTitles: forceNumberedOptionTitles,
    preserveOriginalTitles: preserveOriginalOptionTitles,
  });
  const optionTitleFallbackAuditText = optionTitleFallbackAuditRows
    .map((entry) => entry.copyOnlyDebugText)
    .join("\n");

  return (
    <View
      className={`mt-3 rounded-2xl border px-3 py-3 gap-3 ${
        isLight ? `bg-white/80 ${borderClass}` : "bg-slate-950/30 border-white/10"
      }`}
    >
      <View className="flex-row items-center gap-2">
        <Ionicons name="options-outline" size={17} color="#059669" />
        <Text className={`${textClass} text-sm font-semibold`}>
          Choose your plan options
        </Text>
      </View>

      {optionBoxSummaryText ? (
        <Text
          selectable
          style={COPY_ONLY_OPTION_STATUS_TEXT_STYLE}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {optionBoxSummaryText}
        </Text>
      ) : null}
      {optionTitleFallbackAuditText ? (
        <Text
          selectable
          style={COPY_ONLY_OPTION_STATUS_TEXT_STYLE}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {optionTitleFallbackAuditText}
        </Text>
      ) : null}

      {optionGroups.map((optionGroup, optionGroupIndex) => {
        const selectedOptionIdSet = new Set(
          getSuggestedScheduleResolvedOptionIds(optionGroup)
        );
        const selectedOptionLabels = getSuggestedScheduleSelectedOptionLabels(optionGroup);
        const selectionCount = Math.max(
          1,
          Math.ceil(Number(optionGroup.selectionCount ?? 1) || 1)
        );
        const selectedCount = Math.min(
          getSuggestedScheduleOptionGroupSelectedCount(optionGroup),
          selectionCount
        );
        const isOptionGroupOpen = !closedOptionGroupIds.has(optionGroup.id);
        const optionGroupDisplayTitle = getSuggestedScheduleOptionGroupDisplayTitle({
          optionGroup,
          titleFallbackAuditRows: optionTitleFallbackAuditRows,
          visibleOptionIndex: optionGroupIndex + 1,
        });
        const optionGroupStatusVerb =
          getSuggestedScheduleOptionGroupStatusVerb(optionGroup);
        const optionGroupStatusText = selectedOptionLabels.length
          ? `${optionGroupStatusVerb}: ${selectedOptionLabels.join("; ")}`
          : getSuggestedScheduleOptionGroupSelectionTargetText(optionGroup);
        const optionGroupProgressText = `${selectedCount}/${selectionCount}`;
        const optionGroupTranscriptSatisfierText =
          getSuggestedScheduleOptionGroupTranscriptSatisfierText(optionGroup);

        return (
          <View
            key={optionGroup.id}
            className={`rounded-xl border px-3 py-3 gap-3 ${
              isLight ? `bg-slate-50 ${borderClass}` : "bg-white/5 border-white/10"
            }`}
          >
            <Pressable
              onPress={() => toggleOptionGroup(optionGroup.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOptionGroupOpen }}
              accessibilityLabel={`${isOptionGroupOpen ? "Close" : "Open"} options for ${
                optionGroupDisplayTitle
              }`}
              className={`rounded-xl border px-3 py-3 flex-row items-center justify-between gap-3 ${
                isLight
                  ? "bg-white border-emerald-500/30"
                  : "bg-emerald-500/10 border-emerald-500/20"
              }`}
              hitSlop={8}
            >
              <View className="flex-1 min-w-0">
                <Text selectable className={`${textClass} text-sm font-bold`}>
                  {optionGroupDisplayTitle}
                </Text>
                <Text selectable className={`${secondaryTextClass} text-xs mt-1`}>
                  {optionGroupStatusText}
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                <Text
                  selectable
                  className={`${secondaryTextClass} text-xs font-semibold`}
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {optionGroupProgressText}
                </Text>
                <Ionicons
                  name={isOptionGroupOpen ? "chevron-up-circle" : "chevron-down-circle"}
                  size={22}
                  color="#059669"
                />
              </View>
            </Pressable>

            <Text
              selectable
              style={COPY_ONLY_OPTION_STATUS_TEXT_STYLE}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {buildSuggestedScheduleCopyOnlyOptionGroupVisibilityText({
                optionGroup,
                displayTitle: optionGroupDisplayTitle,
                isOpen: isOptionGroupOpen,
              })}
            </Text>

            <Text
              selectable
              style={COPY_ONLY_OPTION_STATUS_TEXT_STYLE}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {buildSuggestedScheduleCopyOnlySelectedOptionStateText({
                plannerPathKey,
                optionGroup,
              })}
            </Text>

            <Text
              selectable
              style={COPY_ONLY_OPTION_STATUS_TEXT_STYLE}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {buildSuggestedScheduleCopyOnlyOptionDropdownHeaderText({
                optionGroup,
                isOpen: isOptionGroupOpen,
                displayTitle: optionGroupDisplayTitle,
                statusText: optionGroupStatusText,
                progressText: optionGroupProgressText,
                transcriptSatisfierText: optionGroupTranscriptSatisfierText,
              })}
            </Text>

            {isOptionGroupOpen ? (
              <View className="gap-2">
                {optionGroup.options.map((option) => {
                  const isSelected = selectedOptionIdSet.has(option.id);
                  const optionCreditRange = getSuggestedScheduleOptionCreditRange(option);
                  const hasCreditRange =
                    optionCreditRange.creditMin > 0 && optionCreditRange.creditMax > 0;
                  const optionDisplayLabel = getSuggestedScheduleOptionDisplayLabel(option);
                  const optionCourseDetailText =
                    getSuggestedScheduleOptionCourseDetailText(option);
                  const optionSelectionSource = isSelected
                    ? getSuggestedScheduleOptionSatisfiedBy(optionGroup, option.id)
                    : "none";
                  const optionTranscriptSatisfierText =
                    getSuggestedScheduleOptionCompletedTranscriptSatisfierText(
                      optionGroup,
                      option.id
                    );

                  return (
                    <Pressable
                      key={option.id}
                      onPress={() =>
                        onSelectRequirementOption(
                          optionGroup.id,
                          option.id,
                          selectionCount,
                          optionGroup.selectedOptionIds
                        )
                      }
                      accessibilityRole={selectionCount === 1 ? "radio" : "checkbox"}
                      accessibilityState={{ checked: isSelected }}
                      className={`rounded-xl border px-3 py-2 flex-row items-start gap-2 ${
                        isSelected
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : isLight
                            ? `bg-white ${borderClass}`
                            : "bg-white/5 border-white/10"
                      }`}
                    >
                      <Ionicons
                        name={
                          isSelected
                            ? selectionCount === 1
                              ? "radio-button-on"
                              : "checkbox"
                            : selectionCount === 1
                              ? "radio-button-off"
                              : "square-outline"
                        }
                        size={18}
                        color={isSelected ? "#008f4e" : "#9CA3AF"}
                        style={{ marginTop: 1 }}
                      />
                      <View className="flex-1 min-w-0">
                        <Text className={`${textClass} text-sm font-medium`}>
                          {optionDisplayLabel}
                        </Text>
                        {optionCourseDetailText ? (
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>
                            {optionCourseDetailText}
                          </Text>
                        ) : null}
                        {option.guidanceSummary ? (
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>
                            {option.guidanceSummary}
                          </Text>
                        ) : null}
                        {isSelected && optionSelectionSource !== "none" ? (
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>
                            Selection source: {optionSelectionSource}
                          </Text>
                        ) : null}
                        {isSelected &&
                        isSuggestedScheduleCategoryOption(option) &&
                        optionTranscriptSatisfierText ? (
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>
                            Satisfied by completed transcript course:{" "}
                            {optionTranscriptSatisfierText}
                          </Text>
                        ) : null}
                        <Text
                          selectable
                          style={COPY_ONLY_OPTION_STATUS_TEXT_STYLE}
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                        >
                          {buildSuggestedScheduleCopyOnlyOptionStatusText({
                            optionGroup,
                            option,
                            isSelected,
                            displayGroupTitle: optionGroupDisplayTitle,
                          })}
                        </Text>
                      </View>
                      {hasCreditRange ? (
                        <Text
                          className={`${secondaryTextClass} text-xs font-medium`}
                          style={{ fontVariant: ["tabular-nums"] }}
                        >
                          {formatSuggestedScheduleCreditRange(optionCreditRange)}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function buildTranscriptDebugSnapshot({
  phase,
  document,
  parserVersion,
  storedParserVersion,
  transcriptSourceKey,
  storedTranscriptSource,
  completedCoursesBeforeCount,
  questionnaireCompletedCourseCount,
  parsedCourseCount,
  parsedCourseCodesPreview,
  parsedCourseAssignmentsPreview,
  parsedQuarterBuckets,
  timings,
  parserDiagnostics,
  error,
}: {
  phase: "analysis-start" | "analysis-success" | "analysis-failure" | "upload-failure";
  document: TranscriptDocument;
  parserVersion: number;
  storedParserVersion: number | null;
  transcriptSourceKey: string;
  storedTranscriptSource: string;
  completedCoursesBeforeCount: number;
  questionnaireCompletedCourseCount: number;
  parsedCourseCount: number | null;
  parsedCourseCodesPreview: string[];
  parsedCourseAssignmentsPreview?: {
    code: string;
    label: string;
    termLabel: string | null;
    termStartDate: string | null;
  }[];
  parsedQuarterBuckets?: {
    termLabel: string | null;
    termStartDate: string | null;
    courseCodes: string[];
  }[];
  timings?: Record<string, number>;
  parserDiagnostics?: unknown;
  error: unknown;
}) {
  const normalizedError =
    error instanceof Error
      ? {
          name: error.name || "Error",
          message: error.message || "Unexpected transcript error",
          code: String((error as Error & { code?: unknown }).code ?? "").trim() || null,
        }
      : error
        ? {
            name: "Error",
            message: String((error as { message?: unknown })?.message ?? error),
            code: String((error as { code?: unknown })?.code ?? "").trim() || null,
          }
        : null;

  return {
    timestamp: new Date().toISOString(),
    phase,
    document: {
      name: document.name ?? null,
      displayName: getReadableTranscriptFileName(document),
      urlKind: getTranscriptUrlKind(document.url),
      urlLength: String(document.url ?? "").length,
      mimeType: document.mimeType ?? null,
      sizeBytes: document.sizeBytes ?? null,
      uploadedAt: document.uploadedAt || null,
    },
    parserVersion,
    storedParserVersion,
    transcriptSourceKey: transcriptSourceKey || null,
    storedTranscriptSource: storedTranscriptSource || null,
    completedCoursesBeforeCount,
    questionnaireCompletedCourseCount,
    parsedCourseCount,
    parsedCourseCodesPreview,
    parsedCourseAssignmentsPreview: parsedCourseAssignmentsPreview ?? [],
    parsedQuarterBuckets: parsedQuarterBuckets ?? [],
    timings: timings ?? {},
    parserDiagnostics: parserDiagnostics ?? null,
    error: normalizedError,
  };
}

async function openExternalLink(url: string) {
  const safeUrl =
    url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
  try {
    const canOpen = await Linking.canOpenURL(safeUrl);
    if (!canOpen) {
      Alert.alert("Link unavailable", "This link could not be opened on this device.");
      return;
    }
    await Linking.openURL(safeUrl);
  } catch {
  Alert.alert("Link unavailable", "This link could not be opened on this device.");
  }
}

function getAutoTrackSummaryText(trackSummary: string) {
  return stripGeneratedProgramMapSummarySentence(trackSummary);
}

function parseMatchedTrackSummaryCounts(trackSummary: string) {
  const match = String(trackSummary ?? "").match(
    /\bmatches\s+(\d+)\s+of\s+the\s+(\d+)\s+degree-specific Green River classes/i
  );
  if (!match) {
    return {
      matchCount: "unknown",
      totalTrackedGrcCompletableRequirements: "unknown",
    };
  }

  return {
    matchCount: match[1],
    totalTrackedGrcCompletableRequirements: match[2],
  };
}

function buildCopyOnlyMatchedTrackDebugText(input: {
  headerTrackId: string | null;
  explanationTrackId: string | null;
  trackSummary: string;
}) {
  const counts = parseMatchedTrackSummaryCounts(input.trackSummary);
  return [
    "[copy-only matched track debug]",
    `Header track id: ${input.headerTrackId ?? "none"}`,
    `Explanation track id: ${input.explanationTrackId ?? "none"}`,
    `Match count: ${counts.matchCount}`,
    `Total tracked GRC-completable requirements: ${counts.totalTrackedGrcCompletableRequirements}`,
  ].join(" ");
}

function SelectorField({
  label,
  value,
  helper,
  open,
  onToggle,
  onDismiss,
  options,
  onSelect,
  selectedOptionId,
  hideSelectedOptionWhenOpen,
  searchable,
  searchPlaceholder,
  textClass,
  secondaryTextClass,
  borderClass,
  dropdownBackgroundColor,
  onTouchStartInside,
  overlayStrategy = "inline",
}: {
  label: string;
  value: string;
  helper: string;
  open: boolean;
  onToggle: () => void;
  onDismiss?: () => void;
  options: { id: string; label: string; description?: string }[];
  onSelect: (id: string) => void;
  selectedOptionId?: string | null;
  hideSelectedOptionWhenOpen?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
  dropdownBackgroundColor: string;
  onTouchStartInside?: () => void;
  overlayStrategy?: SelectorOverlayStrategy;
}) {
  return (
    <View className="relative" onTouchStart={onTouchStartInside}>
      <Text className={`${textClass} text-base font-semibold`}>{label}</Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>{helper}</Text>
      <View className="mt-4">
        <SearchableSelect
          value={value}
          open={open}
          onToggle={onToggle}
          onDismiss={onDismiss}
          options={options}
          onSelect={onSelect}
          selectedOptionId={selectedOptionId}
          hideSelectedOptionWhenOpen={hideSelectedOptionWhenOpen}
          searchable={searchable}
          searchPlaceholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
          dropdownBackgroundColor={dropdownBackgroundColor}
          onTouchStartInside={onTouchStartInside}
          overlayStrategy={overlayStrategy}
        />
      </View>
    </View>
  );
}

function PlannerSelectionFields({
  collegeId,
  selectedCollegeId,
  selectedCollegeLabel,
  selectedCampusId,
  selectedCampusLabel,
  selectedMajorId,
  selectedMajorLabel,
  openSelector,
  collegeOptions,
  campusOptions,
  majorOptions,
  onToggleCollege,
  onToggleCampus,
  onToggleMajor,
  onDismissCollege,
  onDismissCampus,
  onDismissMajor,
  onSelectCollege,
  onSelectCampus,
  onSelectMajor,
  onSelectorTouchStartInside,
  isDesktop,
  textClass,
  secondaryTextClass,
  borderClass,
  dropdownBackgroundColor,
}: {
  collegeId: PlannerCollegeId;
  selectedCollegeId: PlannerCollegeId;
  selectedCollegeLabel: string;
  selectedCampusId: PlannerCampusSelectionId;
  selectedCampusLabel: string;
  selectedMajorId: string;
  selectedMajorLabel: string;
  openSelector: PlannerSelectorKey;
  collegeOptions: { id: string; label: string; description?: string }[];
  campusOptions: { id: string; label: string; description?: string }[];
  majorOptions: { id: string; label: string; description?: string }[];
  onToggleCollege: () => void;
  onToggleCampus: () => void;
  onToggleMajor: () => void;
  onDismissCollege: () => void;
  onDismissCampus: () => void;
  onDismissMajor: () => void;
  onSelectCollege: (id: string) => void;
  onSelectCampus: (id: string) => void;
  onSelectMajor: (id: string) => void;
  onSelectorTouchStartInside: () => void;
  isDesktop: boolean;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
  dropdownBackgroundColor: string;
}) {
  const getFieldContainerStyle = (
    selectorKey: Exclude<PlannerSelectorKey, null>,
    shouldElevateInlineOverlay = false
  ) => {
    const baseStyle = isDesktop ? { flex: 1, minWidth: 0 } : {};

    if (!shouldElevateInlineOverlay || openSelector !== selectorKey) {
      return Object.keys(baseStyle).length ? baseStyle : undefined;
    }

    return {
      ...baseStyle,
      position: "relative" as const,
      zIndex: 130,
      elevation: 130,
    };
  };

  return (
    <View
      className="mt-4"
      style={
        isDesktop ? { flexDirection: "row", alignItems: "flex-start", gap: 16 } : { gap: 16 }
      }
    >
      <View style={getFieldContainerStyle("college", true)}>
        <SelectorField
          label="College"
          value={selectedCollegeLabel}
          helper={getPlannerSelectionHelperText(collegeId, "college")}
          open={openSelector === "college"}
          onToggle={onToggleCollege}
          onTouchStartInside={onSelectorTouchStartInside}
          onDismiss={onDismissCollege}
          options={collegeOptions}
          onSelect={onSelectCollege}
          selectedOptionId={selectedCollegeId}
          hideSelectedOptionWhenOpen
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
          dropdownBackgroundColor={dropdownBackgroundColor}
          overlayStrategy="inline-isolated"
        />
      </View>

      <View style={getFieldContainerStyle("campus")}>
        <SelectorField
          label="Campus"
          value={selectedCampusLabel}
          helper={getPlannerSelectionHelperText(collegeId, "campus")}
          open={openSelector === "campus"}
          onToggle={onToggleCampus}
          onTouchStartInside={onSelectorTouchStartInside}
          onDismiss={onDismissCampus}
          options={campusOptions}
          onSelect={onSelectCampus}
          selectedOptionId={selectedCampusId}
          hideSelectedOptionWhenOpen
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
          dropdownBackgroundColor={dropdownBackgroundColor}
          overlayStrategy="modal"
        />
      </View>

      <View style={getFieldContainerStyle("major")}>
        <SelectorField
          label="Major"
          value={selectedMajorLabel}
          helper={getPlannerSelectionHelperText(collegeId, "major")}
          open={openSelector === "major"}
          onToggle={onToggleMajor}
          onTouchStartInside={onSelectorTouchStartInside}
          onDismiss={onDismissMajor}
          options={majorOptions}
          onSelect={onSelectMajor}
          selectedOptionId={selectedMajorId}
          searchable
          searchPlaceholder={getPlannerMajorSearchPlaceholder(collegeId)}
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
          dropdownBackgroundColor={dropdownBackgroundColor}
        />
      </View>
    </View>
  );
}

function PlannerTrackOverviewCard({
  collegeId,
  headerTrackId,
  explanationTrackId,
  trackCode,
  trackTitle,
  trackSummary,
  trackOfficialLinkUrl,
  hasNoDirectMajorEquivalencies,
  textClass,
  secondaryTextClass,
  borderClass,
}: {
  collegeId: PlannerCollegeId;
  headerTrackId: string | null;
  explanationTrackId: string | null;
  trackCode: string | null;
  trackTitle: string;
  trackSummary: string;
  trackOfficialLinkUrl: string | null;
  hasNoDirectMajorEquivalencies: boolean;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
}) {
  const visibleTrackSummary = getAutoTrackSummaryText(trackSummary);
  const matchedTrackDebugText = buildCopyOnlyMatchedTrackDebugText({
    headerTrackId,
    explanationTrackId,
    trackSummary,
  });
  const shouldShowBestTrackCard =
    collegeId === "uw" ? Boolean(trackCode) && !hasNoDirectMajorEquivalencies : Boolean(trackTitle);
  const headingText = trackCode ? `${trackCode} | ${trackTitle}` : trackTitle;

  if (!shouldShowBestTrackCard) {
    return null;
  }

  return (
    <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
      <Text className={`${textClass} text-base font-semibold`}>
        {collegeId === "grc"
          ? "Selected Green River Program Path"
          : "Best Green River Transfer Associates path"}
      </Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>
        {collegeId === "grc"
          ? "This is the Green River program path the planner is currently following."
          : "This shows the Green River degree path that best matches the UW degree you picked."}
      </Text>

      <View className={`mt-4 border ${borderClass} rounded-2xl px-4 py-4`}>
        {trackOfficialLinkUrl ? (
          <AnimatedIconPressable
            onPress={() => void openExternalLink(trackOfficialLinkUrl)}
            className="self-start"
          >
            <Text className="text-emerald-500 underline font-semibold">{headingText}</Text>
          </AnimatedIconPressable>
        ) : (
          <Text className={`${textClass} font-semibold`}>{headingText}</Text>
        )}
        {visibleTrackSummary ? (
          <Text className={`${secondaryTextClass} text-sm mt-2`}>{visibleTrackSummary}</Text>
        ) : null}
        <Text
          selectable
          style={COPY_ONLY_OPTION_STATUS_TEXT_STYLE}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {matchedTrackDebugText}
        </Text>
        {/* Official program map link removed per request */}
      </View>
    </View>
  );
}

function GrcDegreeSpecificsSection({
  track,
  completedCourses,
  textClass,
  secondaryTextClass,
  borderClass,
}: {
  track: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
}) {
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [isGrcClassesOpen, setIsGrcClassesOpen] = useState(false);
  const grcGeneralEducationCreditLines = useMemo(
    () =>
      isReferenceOpen && isGrcClassesOpen
        ? buildMajorSpecificsGrcGeneralEducationCreditLines({
            plan: null,
            track,
            completedCourses,
          })
        : [],
    [completedCourses, isGrcClassesOpen, isReferenceOpen, track]
  );
  const grcRequiredMajorCourseLines = useMemo(
    () =>
      isReferenceOpen && isGrcClassesOpen
        ? buildMajorSpecificsGrcRequiredMajorCourseLines({
            plan: null,
            track,
            completedCourses,
          })
        : [],
    [completedCourses, isGrcClassesOpen, isReferenceOpen, track]
  );
  const grcTrackRequirementNoun = getGrcTrackRequirementNoun(track);
  const grcSpecificsTitle = getGrcTrackSpecificsTitle(track);
  const grcClassesLabelSuffix = getGrcTrackClassesLabelSuffix(track);
  const grcTrackTitle = String(track?.title ?? "").trim() || "Selected Green River program";
  const grcTrackDescription = track
    ? `Open this dropdown for all classes needed to complete the ${grcTrackTitle} ${grcTrackRequirementNoun} at GRC.`
    : "Open this dropdown for the Green River class list attached to this program.";
  const grcRequiredMajorCourseFallbackText =
    grcTrackRequirementNoun === "degree"
      ? "No Green River degree-counting major-course list is available for this degree yet."
      : "No Green River major-course list is available for this program yet.";

  if (!track) {
    return null;
  }

  return (
    <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
      <AnimatedCardPressable
        onPress={() => setIsReferenceOpen((currentValue) => !currentValue)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isReferenceOpen }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>{grcSpecificsTitle}</Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              {`Open this dropdown for the currently tracked Green River ${grcTrackRequirementNoun} requirements.`}
            </Text>
          </View>
          <Ionicons
            name={isReferenceOpen ? "chevron-up" : "chevron-down"}
            size={20}
            color="#9CA3AF"
          />
        </View>
      </AnimatedCardPressable>

      {isReferenceOpen ? (
        <View className="mt-5 gap-4">
          <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
            <AnimatedCardPressable
              onPress={() => setIsGrcClassesOpen((currentValue) => !currentValue)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isGrcClassesOpen }}
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 min-w-0">
                  <Text className={`${textClass} text-base font-semibold`}>
                    {`GRC ${grcTrackTitle} ${grcClassesLabelSuffix}`}
                  </Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>
                    {grcTrackDescription}
                  </Text>
                </View>
                <Ionicons
                  name={isGrcClassesOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#9CA3AF"
                />
              </View>
            </AnimatedCardPressable>

            {isGrcClassesOpen ? (
              <View className="mt-4 gap-4">
                <View>
                  <Text className={`${textClass} text-sm font-semibold`}>Gen-Ed Courses</Text>
                  <View className="mt-2 gap-2">
                    {grcGeneralEducationCreditLines.map((entry) => (
                      <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                        {`${entry.label}: ${entry.credits} credits`}
                      </Text>
                    ))}
                  </View>
                </View>

                <View>
                  <Text className={`${textClass} text-sm font-semibold`}>
                    Required Major Courses
                  </Text>
                  {grcRequiredMajorCourseLines.length ? (
                    <View className="mt-2 gap-2">
                      {grcRequiredMajorCourseLines.map((entry) => (
                        <View
                          key={entry.id}
                          className="px-3 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
                        >
                          <Text className="text-emerald-500 text-sm">{entry.text}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className={`${secondaryTextClass} text-sm mt-2`}>
                      {grcRequiredMajorCourseFallbackText}
                    </Text>
                  )}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function TranscriptSummaryCard({
  collegeId,
  transcriptDocument,
  isAnalyzing,
  errorMessage,
  studentEvaluationReport,
  studentCourseEvaluations,
  plan,
  pathwayOptions,
  selectedPathwayLabel,
  hasNoDirectMajorEquivalencies,
  selectedCollegeId,
  selectedCollegeLabel,
  selectedCampusId,
  selectedCampusLabel,
  selectedMajorId,
  selectedMajorLabel,
  track,
  trackCode,
  trackTitle,
  trackSummary,
  trackOfficialLinkUrl,
  completedCourses,
  transcriptDerivedCompletedCourses,
  hasTranscriptDerivedCreditSource,
  openSelector,
  collegeOptions,
  campusOptions,
  majorOptions,
  isPathwaySelectorOpen,
  onToggleCollege,
  onToggleCampus,
  onToggleMajor,
  onTogglePathway,
  onSelectorTouchStartInside,
  onDismissCollege,
  onDismissCampus,
  onDismissMajor,
  onSelectCollege,
  onSelectCampus,
  onSelectMajor,
  onSelectPathway,
  onUpload,
  onOpenTranscriptLink,
  onRemoveTranscript,
  isDesktop,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
  dropdownBackgroundColor,
}: {
  collegeId: PlannerCollegeId;
  transcriptDocument: TranscriptDocument | null;
  isAnalyzing: boolean;
  errorMessage: string | null;
  studentEvaluationReport: TransferPlannerStudentEvaluationReport | null;
  studentCourseEvaluations: TransferPlannerStudentCourseEvaluation[];
  plan: TransferPlannerResolvedMajorPlan | null;
  pathwayOptions: TransferPlannerMajorPathway[];
  selectedPathwayLabel: string | null;
  hasNoDirectMajorEquivalencies: boolean;
  selectedCollegeId: PlannerCollegeId;
  selectedCollegeLabel: string;
  selectedCampusId: PlannerCampusSelectionId;
  selectedCampusLabel: string;
  selectedMajorId: string;
  selectedMajorLabel: string;
  track: TransferPlannerTrack | null;
  trackCode: string | null;
  trackTitle: string;
  trackSummary: string;
  trackOfficialLinkUrl: string | null;
  completedCourses: TranscriptCourseEntry[];
  transcriptDerivedCompletedCourses: TranscriptCourseEntry[];
  hasTranscriptDerivedCreditSource: boolean;
  openSelector: PlannerSelectorKey;
  collegeOptions: { id: string; label: string; description?: string }[];
  campusOptions: { id: string; label: string; description?: string }[];
  majorOptions: { id: string; label: string; description?: string }[];
  isPathwaySelectorOpen: boolean;
  onToggleCollege: () => void;
  onToggleCampus: () => void;
  onToggleMajor: () => void;
  onTogglePathway: () => void;
  onSelectorTouchStartInside: () => void;
  onDismissCollege: () => void;
  onDismissCampus: () => void;
  onDismissMajor: () => void;
  onSelectCollege: (id: string) => void;
  onSelectCampus: (id: string) => void;
  onSelectMajor: (id: string) => void;
  onSelectPathway: (pathwayId: string) => void;
  onUpload: () => void;
  onOpenTranscriptLink: () => void;
  onRemoveTranscript: () => void;
  isDesktop: boolean;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
  dropdownBackgroundColor: string;
}) {
  const isUwPlanner = collegeId === "uw";
  const hasOpenSelectorOverlay = openSelector !== null || isPathwaySelectorOpen;
  const cardOverlayStyle = hasOpenSelectorOverlay
    ? {
        position: "relative" as const,
        overflow: "visible" as const,
        zIndex: 80,
        elevation: 80,
      }
    : {
        position: "relative" as const,
        overflow: "visible" as const,
      };
  const selectionFields = (
    <PlannerSelectionFields
      collegeId={collegeId}
      selectedCollegeId={selectedCollegeId}
      selectedCollegeLabel={selectedCollegeLabel}
      selectedCampusId={selectedCampusId}
      selectedCampusLabel={selectedCampusLabel}
      selectedMajorId={selectedMajorId}
      selectedMajorLabel={selectedMajorLabel}
      openSelector={openSelector}
      collegeOptions={collegeOptions}
      campusOptions={campusOptions}
      majorOptions={majorOptions}
      onToggleCollege={onToggleCollege}
      onToggleCampus={onToggleCampus}
      onToggleMajor={onToggleMajor}
      onDismissCollege={onDismissCollege}
      onDismissCampus={onDismissCampus}
      onDismissMajor={onDismissMajor}
      onSelectCollege={onSelectCollege}
      onSelectCampus={onSelectCampus}
      onSelectMajor={onSelectMajor}
      onSelectorTouchStartInside={onSelectorTouchStartInside}
      isDesktop={isDesktop}
      textClass={textClass}
      secondaryTextClass={secondaryTextClass}
      borderClass={borderClass}
      dropdownBackgroundColor={dropdownBackgroundColor}
    />
  );

  if (!transcriptDocument) {
    return (
      <View className={`${cardClass} border rounded-[28px] p-5`} style={cardOverlayStyle}>
        <View className="flex-row items-start">
          <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
            <Ionicons name="document-text-outline" size={20} color="#008f4e" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>
              Upload your unofficial transcript
            </Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              This planner uses the classes from your unofficial transcript PDF. The unofficial transcript is only stored locally.
            </Text>
          </View>
        </View>

        <View className="gap-3 mt-4">
          <AnimatedChipPressable
            onPress={onUpload}
            className="px-4 py-3 rounded-2xl bg-emerald-500 border border-emerald-500 items-center"
          >
            <Text className="text-white font-medium">Upload unofficial transcript</Text>
          </AnimatedChipPressable>
          <AnimatedChipPressable
            onPress={onOpenTranscriptLink}
            className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 items-center"
          >
            <Text className="text-emerald-500 font-medium">Get transcript in ctcLink</Text>
          </AnimatedChipPressable>
        </View>

        <View
          className={`border ${borderClass} rounded-2xl px-4 py-4 mt-5`}
          style={
            hasOpenSelectorOverlay
              ? { position: "relative", overflow: "visible", zIndex: 90, elevation: 90 }
              : { position: "relative", overflow: "visible" }
          }
        >
          {selectionFields}
        </View>

        {isUwPlanner && plan ? (
          <>
            <MajorPathwaySection
              pathwayOptions={pathwayOptions}
              selectedPathwayId={plan.selectedPathwayId}
              selectedPathwayLabel={selectedPathwayLabel}
              isPathwaySelectorOpen={isPathwaySelectorOpen}
              onTogglePathway={onTogglePathway}
              onSelectorTouchStartInside={onSelectorTouchStartInside}
              onSelectPathway={(pathwayId) => {
                onSelectPathway(pathwayId);
              }}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
              dropdownBackgroundColor={dropdownBackgroundColor}
            />

            <PlannerTrackOverviewCard
              collegeId={collegeId}
              headerTrackId={track?.id ?? null}
              explanationTrackId={isUwPlanner ? plan.bestTrackId ?? null : track?.id ?? null}
              trackCode={trackCode}
              trackTitle={trackTitle}
              trackSummary={trackSummary}
              trackOfficialLinkUrl={trackOfficialLinkUrl}
              hasNoDirectMajorEquivalencies={hasNoDirectMajorEquivalencies}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
            />

            <MajorSpecificsSection
              plan={plan}
              track={track}
              completedCourses={completedCourses}
              transcriptDerivedCompletedCourses={transcriptDerivedCompletedCourses}
              hasTranscriptDerivedCreditSource={hasTranscriptDerivedCreditSource}
              selectedPathwayLabel={selectedPathwayLabel}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
            />
          </>
        ) : null}

        {!isUwPlanner ? (
          <>
            <PlannerTrackOverviewCard
              collegeId={collegeId}
              headerTrackId={track?.id ?? null}
              explanationTrackId={track?.id ?? null}
              trackCode={trackCode}
              trackTitle={trackTitle}
              trackSummary={trackSummary}
              trackOfficialLinkUrl={trackOfficialLinkUrl}
              hasNoDirectMajorEquivalencies={false}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
            />

            <GrcDegreeSpecificsSection
              track={track}
              completedCourses={completedCourses}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
            />
          </>
        ) : null}
    </View>
  );
  }

  return (
    <View className={`${cardClass} border rounded-[28px] p-5`} style={cardOverlayStyle}>
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1 min-w-0">
          <Text className={`${textClass} text-lg font-semibold`}>
            Transcript-based course plan
          </Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            The planner is reading past completed classes from your unofficial transcript so it can mark what is already done.
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row items-center gap-2">
        <AnimatedIconPressable onPress={onUpload} className="self-start">
          <Text className="text-emerald-500 text-sm font-medium">Update Transcript</Text>
        </AnimatedIconPressable>
        <Text className={`${secondaryTextClass} text-sm text-emerald-500`}>|</Text>
        <AnimatedIconPressable
          onPress={onRemoveTranscript}
          className="self-start"
        >
          <Text className="text-emerald-500 text-sm font-medium">Remove Transcript</Text>
        </AnimatedIconPressable>
        <Text className={`${secondaryTextClass} text-sm text-emerald-500`}>|</Text>
        <AnimatedIconPressable onPress={onOpenTranscriptLink} className="self-start">
          <Text className="text-emerald-500 text-sm font-medium">Transcript Link</Text>
        </AnimatedIconPressable>
      </View>

      {isAnalyzing ? (
        <View className="flex-row items-center mt-4">
          <ActivityIndicator color="#008f4e" />
          <Text className={`${secondaryTextClass} text-sm ml-3`}>
            Pulling completed classes from your unofficial transcript...
          </Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View className="mt-4 px-4 py-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <Text className="text-amber-500 font-semibold">Transcript needs another try</Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>{errorMessage}</Text>
          <AnimatedIconPressable
            onPress={() => void openExternalLink(CTCLINK_UNOFFICIAL_TRANSCRIPT_URL)}
            className="self-start"
            containerStyle={{ marginTop: 12 }}
          >
            <Text className="text-emerald-500 font-medium">Open unofficial transcript in ctcLink</Text>
          </AnimatedIconPressable>
        </View>
      ) : null}

      <View
        className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}
        style={
          hasOpenSelectorOverlay
            ? { position: "relative", overflow: "visible", zIndex: 90, elevation: 90 }
            : { position: "relative", overflow: "visible" }
        }
      >
        {selectionFields}
      </View>

      {isUwPlanner && plan ? (
        <>
          <MajorPathwaySection
            pathwayOptions={pathwayOptions}
            selectedPathwayId={plan.selectedPathwayId}
            selectedPathwayLabel={selectedPathwayLabel}
            isPathwaySelectorOpen={isPathwaySelectorOpen}
            onTogglePathway={onTogglePathway}
            onSelectorTouchStartInside={onSelectorTouchStartInside}
            onSelectPathway={(pathwayId) => {
              onSelectPathway(pathwayId);
            }}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            borderClass={borderClass}
            dropdownBackgroundColor={dropdownBackgroundColor}
          />

          <PlannerTrackOverviewCard
            collegeId={collegeId}
            headerTrackId={track?.id ?? null}
            explanationTrackId={isUwPlanner ? plan.bestTrackId ?? null : track?.id ?? null}
            trackCode={trackCode}
            trackTitle={trackTitle}
            trackSummary={trackSummary}
            trackOfficialLinkUrl={trackOfficialLinkUrl}
            hasNoDirectMajorEquivalencies={hasNoDirectMajorEquivalencies}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            borderClass={borderClass}
          />

          <MajorSpecificsSection
            plan={plan}
            track={track}
            completedCourses={completedCourses}
            transcriptDerivedCompletedCourses={transcriptDerivedCompletedCourses}
            hasTranscriptDerivedCreditSource={hasTranscriptDerivedCreditSource}
            selectedPathwayLabel={selectedPathwayLabel}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            borderClass={borderClass}
          />

          {studentEvaluationReport && completedCourses.length ? (
            <TranscriptEvaluationReportCard
              report={studentEvaluationReport}
              evaluations={studentCourseEvaluations}
              plan={plan}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              cardClass={cardClass}
              borderClass={borderClass}
              embedded
            />
          ) : null}
        </>
      ) : null}

      {!isUwPlanner ? (
        <>
          <PlannerTrackOverviewCard
            collegeId={collegeId}
            headerTrackId={track?.id ?? null}
            explanationTrackId={track?.id ?? null}
            trackCode={trackCode}
            trackTitle={trackTitle}
            trackSummary={trackSummary}
            trackOfficialLinkUrl={trackOfficialLinkUrl}
            hasNoDirectMajorEquivalencies={false}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            borderClass={borderClass}
          />

          <GrcDegreeSpecificsSection
            track={track}
            completedCourses={completedCourses}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            borderClass={borderClass}
          />
        </>
      ) : null}

    </View>
  );
}

function MajorPathwaySection({
  pathwayOptions,
  selectedPathwayId,
  selectedPathwayLabel,
  isPathwaySelectorOpen,
  onTogglePathway,
  onSelectorTouchStartInside,
  onSelectPathway,
  textClass,
  secondaryTextClass,
  borderClass,
  dropdownBackgroundColor,
}: {
  pathwayOptions: TransferPlannerMajorPathway[];
  selectedPathwayId: string | null;
  selectedPathwayLabel: string | null;
  isPathwaySelectorOpen: boolean;
  onTogglePathway: () => void;
  onSelectorTouchStartInside: () => void;
  onSelectPathway: (pathwayId: string) => void;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
  dropdownBackgroundColor: string;
}) {
  if (pathwayOptions.length <= 1) {
    return null;
  }

  return (
    <View
      className="mt-4"
      style={
        isPathwaySelectorOpen
          ? {
              position: "relative",
              zIndex: 40,
            }
          : {
              position: "relative",
            }
      }
    >
      <SelectorField
        label="Pathway"
        value={selectedPathwayLabel ?? pathwayOptions[0]?.label ?? "Select pathway"}
        helper="This major has multiple supported routes. Pick the route you want this planner to follow."
        open={isPathwaySelectorOpen}
        onToggle={onTogglePathway}
        onTouchStartInside={onSelectorTouchStartInside}
        options={pathwayOptions.map((pathway) => ({
          id: pathway.id,
          label: pathway.label,
          description: pathway.summary,
        }))}
        onSelect={onSelectPathway}
        selectedOptionId={selectedPathwayId ?? pathwayOptions[0]?.id ?? null}
        hideSelectedOptionWhenOpen
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
        dropdownBackgroundColor={dropdownBackgroundColor}
      />
    </View>
  );
}

function SuggestedScheduleCard({
  collegeId,
  quarters,
  plan,
  plannerPathKey,
  degreeTitle,
  grcTrack,
  campusLabel,
  selectedCampusId,
  selectedMajorId,
  selectedPathwayId,
  onlyUwEssentialClasses,
  showOnlyUwEssentialClassesToggle,
  onToggleOnlyUwEssentialClasses,
  allowSummerClasses,
  onToggleAllowSummerClasses,
  allowStemPrepClasses,
  onToggleAllowStemPrepClasses,
  completedCourses,
  currentCourseSelections,
  onToggleCurrentCourse,
  selectedRequirementOptionIdsByGroup,
  onSelectRequirementOption,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
}: {
  collegeId: PlannerCollegeId;
  quarters: SuggestedQuarterPlan[];
  plan: TransferPlannerResolvedMajorPlan | null;
  plannerPathKey: string;
  degreeTitle: string;
  grcTrack: TransferPlannerTrack | null;
  campusLabel: string;
  selectedCampusId: TransferPlannerCampusId | null;
  selectedMajorId: string | null;
  selectedPathwayId: string | null;
  onlyUwEssentialClasses: boolean;
  showOnlyUwEssentialClassesToggle: boolean;
  onToggleOnlyUwEssentialClasses: () => void;
  allowSummerClasses: boolean;
  onToggleAllowSummerClasses: () => void;
  allowStemPrepClasses: boolean;
  onToggleAllowStemPrepClasses: () => void;
  completedCourses: TranscriptCourseEntry[];
  currentCourseSelections: Set<string>;
  onToggleCurrentCourse: (courseKey: string, fallbackCourseLabel?: string) => void;
  selectedRequirementOptionIdsByGroup: Record<
    string,
    string[] | string | null | undefined
  >;
  onSelectRequirementOption: (
    groupId: string,
    optionId: string,
    selectionCount: number,
    currentSelectedOptionIds?: string[]
  ) => void;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
}) {
  const router = useRouter();
  const { isLight } = useAppTheme();
  const visibleQuarters = useMemo(
    () => quarters.filter((quarter) => quarter.phase !== "planned" || quarter.courses.length > 0),
    [quarters]
  );
  const rawQuarterOptionGroups = useMemo(
    () => collectSuggestedScheduleOptionGroups(quarters),
    [quarters]
  );
  const trackOptionGroups = useMemo(
    () =>
      collegeId === "grc" || !onlyUwEssentialClasses
        ? buildSuggestedQuarterCourseOptionGroupsForTrack({
            track: grcTrack,
            selectedRequirementOptionIdsByGroup,
            includeParsedTrackChoiceSlots: collegeId === "grc",
          })
        : [],
    [collegeId, grcTrack, onlyUwEssentialClasses, selectedRequirementOptionIdsByGroup]
  );
  const stableOptionGroupIds = useMemo(
    () => buildStableSuggestedScheduleOptionGroupIds({ plan, trackOptionGroups }),
    [plan, trackOptionGroups]
  );
  const scheduleOptionGroups = useMemo(
    () =>
      orderSuggestedScheduleOptionGroupsByStableIds(
        mergeSuggestedScheduleOptionGroups(trackOptionGroups, rawQuarterOptionGroups),
        stableOptionGroupIds
      ),
    [rawQuarterOptionGroups, stableOptionGroupIds, trackOptionGroups]
  );
  const forceNumberedOptionTitles = collegeId === "uw";
  const preserveOriginalOptionTitles = collegeId === "grc";
  const scheduleOptionTitleFallbackAuditRows = useMemo(
    () =>
      auditOptionTitleFallback({
        optionGroups: scheduleOptionGroups,
        forceNumberedTitles: forceNumberedOptionTitles,
        preserveOriginalTitles: preserveOriginalOptionTitles,
      }),
    [forceNumberedOptionTitles, preserveOriginalOptionTitles, scheduleOptionGroups]
  );
  const scheduleOptionDisplayTitleById = useMemo(
    () =>
      new Map(
        scheduleOptionTitleFallbackAuditRows.map((entry) => [
          entry.groupId,
          entry.displayedTitle,
        ])
      ),
    [scheduleOptionTitleFallbackAuditRows]
  );
  const optionBoxSummaryText = useMemo(
    () =>
      buildSuggestedScheduleCopyOnlyOptionBoxSummaryText({
        rawOptionGroups: rawQuarterOptionGroups,
        trackOptionGroups,
        displayedOptionGroups: scheduleOptionGroups,
        forceNumberedOptionTitles,
        preserveOriginalOptionTitles,
      }),
    [
      forceNumberedOptionTitles,
      preserveOriginalOptionTitles,
      rawQuarterOptionGroups,
      trackOptionGroups,
      scheduleOptionGroups,
    ]
  );
  const renderedQuarters = useMemo(
    () => buildSuggestedScheduleRenderedQuarters(visibleQuarters),
    [visibleQuarters]
  );
  const creditRangeQuarters = useMemo(
    () => buildSuggestedScheduleCreditRangeQuarters(visibleQuarters),
    [visibleQuarters]
  );
  const plannedQuarterBadgeClass = isLight
    ? `bg-white border ${borderClass}`
    : "bg-white/5 border-white/10";
  const plannedCourseContainerClass = isLight
    ? `bg-white border ${borderClass}`
    : "bg-white/5 border border-white/10";
  const grcTrackRequirementNoun = getGrcTrackRequirementNoun(grcTrack);
  const scheduleTitle =
    collegeId === "grc"
      ? grcTrackRequirementNoun === "degree"
        ? "GRC Degree Plan"
        : "GRC Program Plan"
      : "GRC Quarter Plan";
  const remainingCreditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: creditRangeQuarters,
    track: collegeId === "grc" ? grcTrack : null,
  });
  const remainingCreditText = formatSuggestedScheduleCreditRange({
    creditMin: remainingCreditRange.minRemainingCredits,
    creditMax: remainingCreditRange.maxRemainingCredits,
  });
  const remainingCreditCredentialLabel = getSuggestedScheduleCredentialLabel(
    degreeTitle,
    collegeId === "grc" ? grcTrackRequirementNoun : "degree"
  );
  const uwTransferMinimumRequirementSummary =
    collegeId === "grc"
      ? null
      : buildUwTransferMinimumRequirementSummary({
          quarters: creditRangeQuarters,
          selectedCampusId,
          selectedMajorId,
          degreeTitle,
        });
  const sourceBackedRequirementAuditText = useMemo(
    () => {
      const sourceBackedAuditLines = auditUwBioengineeringSourceBackedRequirements({
        plan,
        suggestedPlan: quarters,
        completedCourses,
      })
        .map((entry) => entry.copyOnlyDebugText);
      const optionSatisfactionAuditLines = auditOptionGroupSatisfaction({
        plan,
        suggestedPlan: quarters,
        completedCourses,
        selectedRequirementOptionIdsByGroup,
      }).map((entry) => entry.copyOnlyDebugText);
      const optionAllocationAuditLines = auditOptionAllocation({
        suggestedPlan: quarters,
        completedCourses,
        plan,
      }).map((entry) => entry.copyOnlyDebugText);
      const categoryOptionDetectionAuditLines = auditCategoryOptionDetection({
        plan,
        suggestedPlan: quarters,
        completedCourses,
        selectedRequirementOptionIdsByGroup,
      }).map((entry) => entry.copyOnlyDebugText);
      const categoryTranscriptSatisfactionAuditLines = auditCategoryTranscriptSatisfaction({
        plan,
        suggestedPlan: quarters,
        completedCourses,
        selectedRequirementOptionIdsByGroup,
      }).map((entry) => entry.copyOnlyDebugText);
      const computerEngineeringCreditBucketAuditLines = auditComputerEngineeringCreditBuckets({
        plan,
        suggestedPlan: quarters,
        completedCourses,
      }).map((entry) => entry.copyOnlyDebugText);
      const optionTitleFallbackAuditLines = scheduleOptionTitleFallbackAuditRows.map(
        (entry) => entry.copyOnlyDebugText
      );
      const optionCreditAuditLines = auditOptionCredits({
        suggestedPlan: quarters,
      }).map((entry) => entry.copyOnlyDebugText);
      const optionSelectionSourceAuditLines = auditOptionSelectionSources({
        suggestedPlan: quarters,
        completedCourses,
      }).map((entry) => entry.copyOnlyDebugText);
      const compoundEquivalencyAuditLines = auditCompoundEquivalencyPaths({
        plan,
        suggestedPlan: quarters,
        completedCourses,
      }).map((entry) => entry.copyOnlyDebugText);
      const trueOptionDetectionAuditLines = auditTrueOptionDetection({
        plan,
        suggestedPlan: quarters,
        completedCourses,
        selectedRequirementOptionIdsByGroup,
      }).map((entry) => entry.copyOnlyDebugText);
      const sourceScopeAuditLines = auditSourceScope({
        plan,
        suggestedPlan: quarters,
        completedCourses,
      }).map((entry) => entry.copyOnlyDebugText);
      const sourceRowBoundaryAuditLines = auditSourceRowBoundaries({
        plan,
      }).map((entry) => entry.copyOnlyDebugText);
      const requiredMappedCoverageAuditLines = auditRequiredMappedCourseCoverage({
        plan,
        suggestedPlan: quarters,
        completedCourses,
      }).map((entry) => entry.copyOnlyDebugText);
      const requirementRolePrecedenceAuditLines = auditRequirementRolePrecedence({
        plan,
        suggestedPlan: quarters,
        completedCourses,
      }).map((entry) => entry.copyOnlyDebugText);
      const countedCourseAuditLines = auditCountedCourses({
        suggestedPlan: quarters,
      }).map((entry) => entry.copyOnlyDebugText);
      const requirementClassificationAuditLines = auditRequirementClassification({
        plan,
        suggestedPlan: quarters,
        completedCourses,
      }).map((entry) => entry.copyOnlyDebugText);
      const invalidScheduledOptionAuditLines = auditInvalidScheduledOptions({
        plan,
        suggestedPlan: quarters,
      }).map((entry) => entry.copyOnlyDebugText);
      const sbseCurrentVsOldSourceAuditLines = auditSbseCurrentVsOldSource({
        plan,
        suggestedPlan: quarters,
        completedCourses,
        selectedRequirementOptionIdsByGroup,
      }).map((entry) => entry.copyOnlyDebugText);
      const sbseScheduledRowSourceAuditLines = auditSbseScheduledRowSources({
        plan,
        suggestedPlan: quarters,
        completedCourses,
        selectedRequirementOptionIdsByGroup,
      }).map((entry) => entry.copyOnlyDebugText);
      const sbseCreditAuditLines = auditSbseCreditTotals({
        plan,
        suggestedPlan: quarters,
        completedCourses,
        selectedRequirementOptionIdsByGroup,
        track: grcTrack,
      }).map((entry) => entry.copyOnlyDebugText);

      return [
        ...sourceBackedAuditLines,
        ...compoundEquivalencyAuditLines,
        ...trueOptionDetectionAuditLines,
        ...sourceScopeAuditLines,
        ...sourceRowBoundaryAuditLines,
        ...requiredMappedCoverageAuditLines,
        ...requirementRolePrecedenceAuditLines,
        ...optionSatisfactionAuditLines,
        ...optionAllocationAuditLines,
        ...categoryOptionDetectionAuditLines,
        ...categoryTranscriptSatisfactionAuditLines,
        ...computerEngineeringCreditBucketAuditLines,
        ...optionTitleFallbackAuditLines,
        ...optionCreditAuditLines,
        ...optionSelectionSourceAuditLines,
        ...countedCourseAuditLines,
        ...requirementClassificationAuditLines,
        ...invalidScheduledOptionAuditLines,
        ...sbseCurrentVsOldSourceAuditLines,
        ...sbseScheduledRowSourceAuditLines,
        ...sbseCreditAuditLines,
      ].join("\n");
    },
    [
      completedCourses,
      grcTrack,
      plan,
      quarters,
      scheduleOptionTitleFallbackAuditRows,
      selectedRequirementOptionIdsByGroup,
    ]
  );
  const stemPrepToggleGuidance =
    "Turn off 'Allow STEM prep classes' to skip unnecessary placement-dependent prep classes like Precalculus I/II or general physics when you are ready to start with Calculus I and Engineering Physics I.";
  const scheduleDescription =
    collegeId === "grc"
      ? `This is your Green River plan for finishing the ${degreeTitle} ${grcTrackRequirementNoun} at ${getScheduleCampusLabel(collegeId, campusLabel)}. Completed transcript classes stay marked as done, and the planner fills in the remaining GRC ${grcTrackRequirementNoun} courses still ahead.`
      : onlyUwEssentialClasses
        ? `This is your transfer plan for finishing the ${degreeTitle} degree at ${getScheduleCampusLabel(collegeId, campusLabel)}. It starts focused on UW-required classes, official UW transfer admission guidance when applicable, Gen-Eds, and prerequisite dependencies. Turn off Classes for UW transfer only to include optional Green River track classes. ${stemPrepToggleGuidance}`
        : `This is your transfer plan for finishing the ${degreeTitle} degree at ${getScheduleCampusLabel(collegeId, campusLabel)}. Turn on Classes for UW transfer only to hide optional Green River track classes and focus on UW-required classes, official UW transfer admission guidance when applicable, Gen-Eds, and prerequisite dependencies. ${stemPrepToggleGuidance}`;

  return (
    <View className={`${cardClass} border rounded-[28px] p-5`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 min-w-0">
          <Text className={`${textClass} text-lg font-semibold`}>{scheduleTitle}</Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            {scheduleDescription}
          </Text>
        </View>

        {showOnlyUwEssentialClassesToggle || collegeId === "grc" ? (
          <View className="gap-2">
            {showOnlyUwEssentialClassesToggle ? (
              <Pressable
                onPress={onToggleOnlyUwEssentialClasses}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: onlyUwEssentialClasses }}
                accessibilityLabel="Only show classes that transfer into UW on this track"
                accessibilityHint="Hides nonessential Green River track classes while keeping prerequisite classes, official UW transfer admission guidance when applicable, and Gen-Eds that still unlock UW-required work."
                className={`border ${borderClass} rounded-xl px-3 py-2 flex-row items-center justify-center gap-2`}
                hitSlop={8}
              >
                <Text className={`${secondaryTextClass} text-xs font-medium`}>
                  Classes for UW transfer only
                </Text>
                <Ionicons
                  name={onlyUwEssentialClasses ? "checkbox" : "square-outline"}
                  size={20}
                  color={onlyUwEssentialClasses ? "#008f4e" : "#9CA3AF"}
                />
              </Pressable>
            ) : null}
            <Pressable
              onPress={onToggleAllowStemPrepClasses}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allowStemPrepClasses }}
              accessibilityLabel="Allow STEM prep classes in quarter planning"
              accessibilityHint="Includes placement-dependent prep classes such as Precalculus I/II and general physics before Calculus I or Engineering Physics I."
              className={`border ${borderClass} rounded-xl px-3 py-2 flex-row items-center justify-center gap-2`}
              hitSlop={8}
            >
              <Text className={`${secondaryTextClass} text-xs font-medium`}>
                Allow STEM prep classes
              </Text>
              <Ionicons
                name={allowStemPrepClasses ? "checkbox" : "square-outline"}
                size={20}
                color={allowStemPrepClasses ? "#008f4e" : "#9CA3AF"}
              />
            </Pressable>
            <Pressable
              onPress={onToggleAllowSummerClasses}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allowSummerClasses }}
              accessibilityLabel="Allow summer classes in quarter planning"
              accessibilityHint="Includes summer quarter when building your future course plan."
              className={`border ${borderClass} rounded-xl px-3 py-2 flex-row items-center justify-center gap-2`}
              hitSlop={8}
            >
              <Text className={`${secondaryTextClass} text-xs font-medium`}>
                Allow summer classes
              </Text>
              <Ionicons
                name={allowSummerClasses ? "checkbox" : "square-outline"}
                size={20}
                color={allowSummerClasses ? "#008f4e" : "#9CA3AF"}
              />
            </Pressable>
          </View>
        ) : null}
      </View>

      <Text
        selectable
        style={COPY_ONLY_OPTION_STATUS_TEXT_STYLE}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {buildSuggestedScheduleCopyOnlyToggleStatusText({
          collegeId,
          showOnlyUwEssentialClassesToggle,
          onlyUwEssentialClasses,
          allowStemPrepClasses,
          allowSummerClasses,
        })}
      </Text>
      {sourceBackedRequirementAuditText ? (
        <Text
          selectable
          style={COPY_ONLY_OPTION_STATUS_TEXT_STYLE}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {sourceBackedRequirementAuditText}
        </Text>
      ) : null}

      <View className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
        <Text className={`${textClass} text-base font-semibold`}>
          You have{" "}
          <Text className="text-emerald-600" style={{ fontVariant: ["tabular-nums"] }}>
            {remainingCreditText}
          </Text>{" "}
          left in order to finish what you can for the {remainingCreditCredentialLabel}
        </Text>
        <SuggestedScheduleOptionsBox
          optionGroups={scheduleOptionGroups}
          plannerPathKey={plannerPathKey}
          optionBoxSummaryText={optionBoxSummaryText}
          forceNumberedOptionTitles={forceNumberedOptionTitles}
          preserveOriginalOptionTitles={preserveOriginalOptionTitles}
          onSelectRequirementOption={onSelectRequirementOption}
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
        />
        {uwTransferMinimumRequirementSummary ? (
          <Text className={`${secondaryTextClass} text-sm mt-2`}>
            {uwTransferMinimumRequirementSummary}
          </Text>
        ) : null}
        <AnimatedIconPressable
          onPress={() => void openExternalLink("https://greenriver.navigate.eab.com/")}
          className="mt-3 flex-row items-center gap-2"
        >
          <Ionicons name="calendar-outline" size={16} color="#059669" />
          <Text className="text-sm font-semibold text-emerald-600 underline">
            Schedule a meeting with a GRC advisor
          </Text>
        </AnimatedIconPressable>
      </View>

      <View className="gap-4 mt-4">
        {renderedQuarters.map((quarter, quarterIndex) => (
          <View
            key={`${quarter.phase}-${quarter.label}-${quarterIndex}`}
            className={`border ${borderClass} rounded-2xl px-4 py-4`}
          >
            <View className="flex-row items-center justify-between gap-3">
              <Text className={`${textClass} font-semibold flex-1`}>{quarter.label}</Text>
              <View
                className={`px-3 py-1 rounded-full border ${
                  quarter.phase === "completed"
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : quarter.phase === "current"
                      ? "bg-sky-500/10 border-sky-500/20"
                    : plannedQuarterBadgeClass
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    quarter.phase === "completed"
                      ? "text-emerald-500"
                      : quarter.phase === "current"
                        ? "text-sky-400"
                        : textClass
                  }`}
                >
                  {quarter.phase === "completed"
                    ? "Completed"
                    : quarter.phase === "current"
                      ? "Current"
                      : "Planned"}
                </Text>
              </View>
            </View>
            <View className="gap-2 mt-3">
              {quarter.courses.length ? (
                quarter.courses.map((course, courseIndex) => {
                  const courseDisplayLabel = getSuggestedScheduleCourseDisplayLabel(course.label);
                  const courseSelectionKey = String(course.instanceKey ?? course.label).trim();
                  const isCurrentCourseSelected =
                    currentCourseSelections.has(courseSelectionKey) ||
                    currentCourseSelections.has(course.label);
                  const optionGroup = course.optionGroup ?? null;
                  const shouldShowCurrentCourseCheckbox =
                    course.status !== "completed" && !optionGroup?.isSelectionPrompt;

                  // treat official GRC track courses as core visually
                  const isCoreVisual =
                    course.type === "core" ||
                    (collegeId === "grc" && String(course.sourceKind ?? "").startsWith("official-grc"));
                  const grcProgramRequirementFlavorText =
                    collegeId === "grc" &&
                    String(course.sourceKind ?? "").startsWith("official-grc")
                      ? "Required for this Green River program."
                      : null;

                  return (
                    <View
                      key={`${quarter.label}-${courseSelectionKey || course.label}-${courseIndex}`}
                      className={`px-3 py-3 rounded-2xl ${
                        course.status === "completed"
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : course.status === "current"
                            ? "bg-sky-500/10 border border-sky-500/20"
                            : isCoreVisual
                              ? "bg-emerald-500/10 border border-emerald-500/20"
                              : plannedCourseContainerClass
                      }`}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-row items-start flex-1 min-w-0">
                          {course.status === "completed" ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color="#008f4e"
                              style={{ marginTop: 1, marginRight: 8 }}
                            />
                          ) : null}
                          <View style={{ flex: 1 }}>
                            {(() => {
                              const courseTextClass = `text-sm font-medium ${
                                course.status === "completed"
                                  ? "text-emerald-500"
                                  : course.status === "current"
                                    ? "text-sky-400"
                                    : isCoreVisual
                                      ? "text-emerald-500"
                                      : textClass
                              }`;
                              if (optionGroup) {
                                const selectedOptions =
                                  getSuggestedScheduleSelectedOptions(optionGroup);
                                const selectedOptionLabels =
                                  getSuggestedScheduleSelectedOptionLabels(optionGroup);
                                const rawOptionGroupGuidanceSummary = removeGuidanceSummaryPrefixes(
                                  course.guidanceSummary,
                                  selectedOptions.map((option) => option.guidanceSummary)
                                );
                                const optionGroupGuidanceSummary =
                                  isSuggestedScheduleGeneratedOptionSummary(
                                    rawOptionGroupGuidanceSummary
                                  )
                                    ? null
                                    : rawOptionGroupGuidanceSummary;

                                return (
                                  <View className="gap-1">
                                    <Text className={courseTextClass}>
                                      {optionGroup.isSelectionPrompt
                                        ? scheduleOptionDisplayTitleById.get(optionGroup.id) ??
                                          optionGroup.title
                                        : courseDisplayLabel}
                                    </Text>
                                    <Text className={`${secondaryTextClass} text-xs`}>
                                      {selectedOptionLabels.length
                                        ? `Selected: ${selectedOptionLabels.join("; ")}`
                                        : getSuggestedScheduleOptionGroupSelectionTargetText(
                                            optionGroup
                                          )}
                                    </Text>
                                    {grcProgramRequirementFlavorText ? (
                                      <Text className={`${secondaryTextClass} text-xs`}>
                                        {grcProgramRequirementFlavorText}
                                      </Text>
                                    ) : null}

                                    {optionGroupGuidanceSummary ? (
                                      <Text className={`${secondaryTextClass} text-xs`}>
                                        {optionGroupGuidanceSummary}
                                      </Text>
                                    ) : null}
                                  </View>
                                );
                              }
                              const linkData = getSchedulePlaceholderRequirementLinkData(course.label);
                              const linkCampusId =
                                selectedCampusId ?? (collegeId === "grc" ? "uw-seattle" : null);

                              if (!linkData || !linkCampusId) {
                                return (
                                  <Text className={courseTextClass}>
                                    {courseDisplayLabel}
                                  </Text>
                                );
                              }

                              const params: Record<string, string> = {
                                collegeId,
                                campusId: linkCampusId,
                              };
                              if (linkData.tags.length) {
                                params.tag = linkData.tags.join(",");
                              }
                              if (selectedMajorId) {
                                params.majorId = selectedMajorId;
                              }
                              if (selectedPathwayId) {
                                params.pathwayId = selectedPathwayId;
                              }

                              return (
                                <Text
                                  className={`${courseTextClass} underline`}
                                  onPress={() =>
                                    router.push({
                                      pathname: ROUTES.transferEquivalencies,
                                      params: {
                                        ...params,
                                        returnTo: ROUTES.transferPlanner,
                                      },
                                    })
                                  }
                                >
                                  {courseDisplayLabel}
                                </Text>
                              );
                            })()}
                            {!optionGroup && grcProgramRequirementFlavorText ? (
                              <Text className={`${secondaryTextClass} text-xs mt-1`}>
                                {grcProgramRequirementFlavorText}
                              </Text>
                            ) : null}
                            {!optionGroup && course.guidanceSummary ? (
                              <Text className={`${secondaryTextClass} text-xs mt-1`}>
                                {course.guidanceSummary}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        {shouldShowCurrentCourseCheckbox ? (
                          <Pressable
                            onPress={() => onToggleCurrentCourse(courseSelectionKey, course.label)}
                            hitSlop={8}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isCurrentCourseSelected }}
                            className="self-start"
                          >
                            <Ionicons
                              name={
                                isCurrentCourseSelected
                                  ? "checkbox"
                                  : "square-outline"
                              }
                              size={20}
                              color={isCurrentCourseSelected ? "#008f4e" : "#9CA3AF"}
                            />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text className={`${secondaryTextClass} text-sm`}>
                  Nothing else is required in this planned quarter.
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function TranscriptEvaluationReportCard({
  report,
  evaluations,
  plan,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
  embedded = false,
}: {
  report: TransferPlannerStudentEvaluationReport;
  evaluations: TransferPlannerStudentCourseEvaluation[];
  plan: TransferPlannerResolvedMajorPlan;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const studentFacingEvaluations = evaluations.filter((entry) => entry.studentFacing);
  const creditTotalsByTag = useMemo(
    () => buildRequirementCreditTotalsByTag(plan, studentFacingEvaluations),
    [plan, studentFacingEvaluations]
  );
  const completedCreditsByTag = useMemo(() => {
    const totals = new Map<string, number>();

    for (const evaluation of studentFacingEvaluations) {
      if (!shouldShowRequirementCreditMessage(evaluation)) continue;

      const creditAmount = evaluation.sourceCreditAmount ?? 5;
      const normalizedTags = Array.from(
        new Set(
          evaluation.targetRequirementTags
            .map((tag) => normalizeRequirementTag(tag))
            .filter(Boolean)
        )
      );

      for (const tag of normalizedTags) {
        totals.set(tag, (totals.get(tag) ?? 0) + creditAmount);
      }
    }

    return totals;
  }, [studentFacingEvaluations]);
  const remainingGrcClassCount = report.nextPlannedCourseLabels.length;
  const remainingGrcClassNoun = remainingGrcClassCount === 1 ? "class" : "classes";
  const campusPossessiveLabel = report.campusLabel.endsWith("s")
    ? `${report.campusLabel}'`
    : `${report.campusLabel}'s`;
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);

  if (!report.completedCourseCount) {
    return null;
  }

  const containerClass = embedded
    ? `border ${borderClass} rounded-2xl px-4 py-4 mt-4`
    : `${cardClass} border rounded-[28px] p-5`;

  return (
    <View className={containerClass}>
      <AnimatedCardPressable
        onPress={() => setIsEvaluationOpen((currentValue) => !currentValue)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isEvaluationOpen }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>Transcript evaluation</Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              Open this dropdown for specifics on how your transcript gets applied
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10">
              <Text className="text-emerald-500 text-xs font-semibold">
                {report.officialRuleIds.length} rule{report.officialRuleIds.length === 1 ? "" : "s"}
              </Text>
            </View>
            <Ionicons
              name={isEvaluationOpen ? "chevron-up" : "chevron-down"}
              size={20}
              color="#9CA3AF"
            />
          </View>
        </View>
      </AnimatedCardPressable>

      {isEvaluationOpen ? (
        <>
          <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
            <Text className={`${textClass} text-base font-semibold`}>
              {`${remainingGrcClassCount} more ${remainingGrcClassNoun} before Green River College is tapped out for ${campusPossessiveLabel} ${report.majorTitle} degree.`}
            </Text>
          </View>

          {studentFacingEvaluations.length ? (
            <View className="gap-3 mt-4">
              {studentFacingEvaluations.map((evaluation) => {
                const requirementCreditMessage = getEvaluationRequirementCreditMessageParts({
                  evaluation,
                  totalsByTag: creditTotalsByTag,
                  completedByTag: completedCreditsByTag,
                  campusId: plan.campusId,
                });

                return (
                  <View
                    key={evaluation.id}
                    className={`border ${borderClass} rounded-2xl px-4 py-4`}
                  >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1 min-w-0">
                      <Text className={`${textClass} font-semibold`}>{evaluation.courseCode}</Text>
                      <Text className={`${secondaryTextClass} text-xs mt-1`} numberOfLines={2}>
                        {evaluation.targetOutcome ?? "No source-backed UW target outcome for this selected major."}
                      </Text>
                    </View>
                    <View className={`px-3 py-1 rounded-full border ${getEvaluationOutcomeBadgeClass(evaluation.outcome)}`}>
                      <Text
                        className={`text-xs font-semibold ${getEvaluationOutcomeTextClass(
                          evaluation.outcome,
                          textClass
                        )}`}
                      >
                        {getEvaluationOutcomeBadgeLabel(evaluation.outcome)}
                      </Text>
                    </View>
                  </View>

                  {evaluation.missingSourceCourseCodes.length ? (
                    <Text className={`${secondaryTextClass} text-xs mt-2`}>
                      Missing for strongest sequence: {evaluation.missingSourceCourseCodes.join(", ")}
                    </Text>
                  ) : null}

                  {evaluation.automaticGuidanceSummary ? (
                    <Text className={`${secondaryTextClass} text-xs mt-2`}>
                      {evaluation.automaticGuidanceSummary}
                    </Text>
                  ) : null}

                  {requirementCreditMessage ? (
                    <Text className={`${secondaryTextClass} text-xs mt-2`}>
                      {requirementCreditMessage.prefix}
                      <Text
                        className="text-emerald-500 underline"
                        onPress={() =>
                            router.push({
                              pathname: ROUTES.transferEquivalencies,
                              params: {
                                tag: requirementCreditMessage.normalizedTag,
                                campusId: requirementCreditMessage.campusId,
                                majorId: plan.id,
                                ...(plan.selectedPathwayId
                                  ? { pathwayId: plan.selectedPathwayId }
                                  : {}),
                                returnTo: ROUTES.transferPlanner,
                              },
                            })
                        }
                      >
                        {requirementCreditMessage.clickableLabel}
                      </Text>
                      {requirementCreditMessage.suffix}
                    </Text>
                  ) : null}
                </View>
                );
              })}
            </View>
          ) : null}

          {report.hiddenEvaluationCount ? (
            <View className="mt-4 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <Text className="text-amber-500 text-sm font-semibold">
                Hidden source-gap evaluation
              </Text>
              <Text className={`${secondaryTextClass} text-xs mt-1`}>
                {report.hiddenEvaluationCount} course evaluation{report.hiddenEvaluationCount === 1 ? "" : "s"} stayed internal because this planner path is not source-verified for students.
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function MajorSpecificsSection({
  plan,
  track,
  completedCourses,
  transcriptDerivedCompletedCourses,
  hasTranscriptDerivedCreditSource,
  selectedPathwayLabel,
  textClass,
  secondaryTextClass,
  borderClass,
}: {
  plan: TransferPlannerResolvedMajorPlan;
  track: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
  transcriptDerivedCompletedCourses: TranscriptCourseEntry[];
  hasTranscriptDerivedCreditSource: boolean;
  selectedPathwayLabel: string | null;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
}) {
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [isGrcClassesOpen, setIsGrcClassesOpen] = useState(false);
  const [isUwClassesOpen, setIsUwClassesOpen] = useState(false);
  const [isUwCoursesConsideredOpen, setIsUwCoursesConsideredOpen] = useState(false);
  const degreeMapSections = plan.degreeMapSections ?? [];
  const grcGeneralEducationCreditLines = useMemo(
    () =>
      isReferenceOpen && isGrcClassesOpen
        ? buildMajorSpecificsGrcGeneralEducationCreditLines({
            plan,
            track,
            completedCourses,
          })
        : [],
    [completedCourses, isGrcClassesOpen, isReferenceOpen, plan, track]
  );
  const grcRequiredMajorCourseLines = useMemo(
    () =>
      isReferenceOpen && isGrcClassesOpen
        ? buildMajorSpecificsGrcRequiredMajorCourseLines({
            plan,
            track,
            completedCourses,
          })
        : [],
    [completedCourses, isGrcClassesOpen, isReferenceOpen, plan, track]
  );
  const sourceBackedUwGeneralEducationSection = useMemo(
    () =>
      isReferenceOpen && isUwClassesOpen
        ? buildMajorSpecificsSourceBackedUwGeneralEducationSection(plan)
        : null,
    [isReferenceOpen, isUwClassesOpen, plan]
  );
  const matchedGrcTrackBreadthRowsHiddenFromUwGenEdSection = useMemo(
    () =>
      isReferenceOpen && isUwClassesOpen
        ? countMatchedGrcTrackGeneralEducationBreadthRows({
            track,
            completedCourses,
            plan,
          })
        : 0,
    [completedCourses, isReferenceOpen, isUwClassesOpen, plan, track]
  );
  const genEdSourceDebugText = useMemo(
    () =>
      buildCopyOnlyGenEdSourceDebugText({
        plannerMode: "GRC -> UW",
        sourceBackedTargetCount: sourceBackedUwGeneralEducationSection?.items.length ?? 0,
        hiddenMatchedGrcTrackBreadthRowCount:
          matchedGrcTrackBreadthRowsHiddenFromUwGenEdSection,
      }),
    [
      matchedGrcTrackBreadthRowsHiddenFromUwGenEdSection,
      sourceBackedUwGeneralEducationSection,
    ]
  );
  const uwGeneralTransferRequirementSection = useMemo(
    () =>
      isReferenceOpen && isUwClassesOpen
        ? buildUwGeneralTransferRequirementSection(plan, {
            completedCourses: transcriptDerivedCompletedCourses,
            hasTranscriptDerivedCreditSource,
          })
        : null,
    [
      hasTranscriptDerivedCreditSource,
      isReferenceOpen,
      isUwClassesOpen,
      plan,
      transcriptDerivedCompletedCourses,
    ]
  );
  const majorSpecificsCourseSections = useMemo(
    () =>
      isReferenceOpen && isUwClassesOpen
        ? buildMajorSpecificsCourseSections({ plan, track, completedCourses })
        : [],
    [completedCourses, isReferenceOpen, isUwClassesOpen, plan, track]
  );
  const majorSpecificsCourseRowCount = majorSpecificsCourseSections.reduce(
    (total, section) => total + section.rows.length,
    0
  );
  const uwCoursesConsideredEntries = useMemo(
    () =>
      isReferenceOpen && isUwClassesOpen && isUwCoursesConsideredOpen
        ? buildUwCoursesConsideredEntries(plan)
        : [],
    [isReferenceOpen, isUwClassesOpen, isUwCoursesConsideredOpen, plan]
  );
  const primaryDegreeSource = getTransferPlannerPrimaryDegreeRequirementsSource(
    plan.id,
    plan.selectedPathwayId
  );
  const primaryUwDegreeLink = primaryDegreeSource?.url
    ? {
        label: primaryDegreeSource.label,
        url: primaryDegreeSource.url,
      }
    : plan.officialLinks[0] ?? null;
  const majorSpecificsSummaryText = primaryUwDegreeLink
    ? degreeMapSections.length
      ? "Open this dropdown for the official UW degree page and degree-specific requirement sections for your selected major."
      : "Open this dropdown for the official UW degree page for your selected major."
    : degreeMapSections.length
      ? "Open this dropdown for degree-specific requirement sections for your selected major."
      : "Open this dropdown for major details as they become available.";
  const grcTrackTitle = String(track?.title ?? "").trim() || plan.title;
  const grcTrackDescription = track
    ? `Open this dropdown for all classes needed to complete the ${grcTrackTitle} transfer track at GRC.`
    : "Open this dropdown for the Green River class list currently attached to this major.";

  return (
    <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
      <AnimatedCardPressable
        onPress={() => setIsReferenceOpen((currentValue) => !currentValue)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isReferenceOpen }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>
              Major Specifics
            </Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              {`Source-backed summary. ${majorSpecificsSummaryText}`}
            </Text>
          </View>
          <Ionicons
            name={isReferenceOpen ? "chevron-up" : "chevron-down"}
            size={20}
            color="#9CA3AF"
          />
        </View>
      </AnimatedCardPressable>

      {isReferenceOpen ? (
        <>
          {primaryUwDegreeLink ? (
            <View className="mt-5 gap-4">
              <Text className={`${textClass} text-base font-semibold`}>Official UW degree page</Text>
              <Text className={`${secondaryTextClass} text-sm`}>
                This is the main UW page the planner should use for the full degree requirements for this major.
              </Text>
              <AnimatedCardPressable
                onPress={() => void openExternalLink(primaryUwDegreeLink.url)}
                className={`border ${borderClass} rounded-2xl px-4 py-4`}
              >
                <Text className="text-emerald-500 font-semibold">
                  {primaryUwDegreeLink.label}
                </Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  {primaryUwDegreeLink.url}
                </Text>
              </AnimatedCardPressable>
            </View>
          ) : null}

          {degreeMapSections.length ? (
            <View className="mt-5 gap-4">
              <Text className={`${textClass} text-base font-semibold`}>
                Degree Specifics
              </Text>
              <Text className={`${secondaryTextClass} text-sm`}>
                {selectedPathwayLabel
                  ? `These sections summarize the official UW degree structure currently attached to the ${selectedPathwayLabel} route for this major.`
                  : "These sections summarize the official UW degree structure already lifted into the planner for this major."}
              </Text>
              {degreeMapSections.map((section) => (
                <View key={section.id} className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                  <Text className={`${textClass} font-semibold`}>{section.title}</Text>
                  {section.note ? (
                    <Text className={`${secondaryTextClass} text-sm mt-1`}>
                      {section.note}
                    </Text>
                  ) : null}
                  <View className="mt-3 gap-2">
                    {section.items.map((item) => (
                      <View key={`${section.id}-${item}`} className="flex-row items-start gap-2">
                        <Text className={`${secondaryTextClass} text-sm`}>{"•"}</Text>
                        <Text className={`${secondaryTextClass} flex-1 text-sm`}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View className="mt-5 gap-4">
            <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
              <AnimatedCardPressable
                onPress={() => setIsGrcClassesOpen((currentValue) => !currentValue)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isGrcClassesOpen }}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 min-w-0">
                    <Text className={`${textClass} text-base font-semibold`}>
                      {`GRC ${grcTrackTitle} Degree Classes`}
                    </Text>
                    <Text className={`${secondaryTextClass} text-sm mt-1`}>
                      {grcTrackDescription}
                    </Text>
                  </View>
                  <Ionicons
                    name={isGrcClassesOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#9CA3AF"
                  />
                </View>
              </AnimatedCardPressable>

              {isGrcClassesOpen ? (
                <View className="mt-4 gap-4">
                  <View>
                    <Text className={`${textClass} text-sm font-semibold`}>Gen-Ed Courses</Text>
                    {grcGeneralEducationCreditLines.length ? (
                      <View className="mt-2 gap-2">
                        {grcGeneralEducationCreditLines.map((entry) => (
                          <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                            {`${entry.label}: ${entry.credits} credits`}
                          </Text>
                        ))}
                      </View>
                    ) : (
                      <Text className={`${secondaryTextClass} text-sm mt-2`}>
                        No Green River track general-education targets are currently tagged for this route yet.
                      </Text>
                    )}
                  </View>

                  <View>
                    <Text className={`${textClass} text-sm font-semibold`}>Required Major Courses</Text>
                    {grcRequiredMajorCourseLines.length ? (
                      <View className="mt-2 gap-2">
                        {grcRequiredMajorCourseLines.map((entry) => (
                          <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                            {entry.text}
                          </Text>
                        ))}
                      </View>
                    ) : (
                      <Text className={`${secondaryTextClass} text-sm mt-2`}>
                        No Green River degree-counting major-course list is available for this track yet.
                      </Text>
                    )}
                  </View>
                </View>
              ) : null}
            </View>

            <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
              <AnimatedCardPressable
                onPress={() => setIsUwClassesOpen((currentValue) => !currentValue)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isUwClassesOpen }}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 min-w-0">
                    <Text className={`${textClass} text-base font-semibold`}>
                      {`UW ${plan.title} Degree Classes`}
                    </Text>
                    <Text className={`${secondaryTextClass} text-sm mt-1`}>
                      {majorSpecificsCourseRowCount
                        ? "Open this dropdown for categorized major requirements, Gen-Eds, Green River equivalents, and UW options from the official degree source."
                        : "Open this dropdown for major requirements and Green River equivalents as they become available."}
                    </Text>
                  </View>
                  <Ionicons
                    name={isUwClassesOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#9CA3AF"
                  />
                </View>
              </AnimatedCardPressable>

              {isUwClassesOpen ? (
                <View className="mt-4 gap-4">
                  {uwGeneralTransferRequirementSection ? (
                    <View>
                      <Text className={`${textClass} text-sm font-semibold`}>
                        {uwGeneralTransferRequirementSection.title}
                      </Text>
                      <Text className={`${secondaryTextClass} text-sm mt-1`}>
                        {uwGeneralTransferRequirementSection.summary}
                      </Text>
                      <View className="mt-2 gap-2">
                        {uwGeneralTransferRequirementSection.items.map((entry) => (
                          <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                            {`${entry.label}: ${entry.valueText}${entry.note ? ` (${entry.note})` : ""}`}
                          </Text>
                        ))}
                      </View>
                      {uwGeneralTransferRequirementSection.note ? (
                        <Text className={`${secondaryTextClass} text-xs mt-3`}>
                          {uwGeneralTransferRequirementSection.note}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <Text
                    selectable
                    style={COPY_ONLY_OPTION_STATUS_TEXT_STYLE}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    {genEdSourceDebugText}
                  </Text>

                  {!sourceBackedUwGeneralEducationSection ? (
                    <Text className={`${secondaryTextClass} text-sm`}>
                      No source-backed major-specific general education targets are currently published for this major.
                    </Text>
                  ) : null}

                  {majorSpecificsCourseSections.length ? (
                    majorSpecificsCourseSections.map((section) => (
                      <View key={section.id}>
                        <Text className={`${textClass} text-sm font-semibold`}>
                          {section.label}
                        </Text>
                        <Text className={`${secondaryTextClass} text-xs mt-1`}>
                          {section.description}
                        </Text>
                        <View className="mt-2 gap-3">
                          {section.rows.map((entry) => (
                            <View key={entry.id}>
                              <Text className={`${secondaryTextClass} text-sm`}>
                                {entry.text}
                              </Text>
                              {entry.alternativeOptionsText ? (
                                <Text className={`${secondaryTextClass} text-xs mt-1`}>
                                  {entry.alternativeOptionsText}
                                </Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      </View>
                    ))
                  ) : (
                    <View>
                      <Text className={`${textClass} text-sm font-semibold`}>Official UW Required Courses</Text>
                      <Text className={`${secondaryTextClass} text-sm mt-2`}>
                        No source-backed UW-required major-course path is available for this major yet.
                      </Text>
                    </View>
                  )}

                  <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                    <AnimatedCardPressable
                      onPress={() =>
                        setIsUwCoursesConsideredOpen((currentValue) => !currentValue)
                      }
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isUwCoursesConsideredOpen }}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1 min-w-0">
                          <Text className={`${textClass} text-sm font-semibold`}>
                            UW Courses Considered
                          </Text>
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>
                            All UW courses parsed from the official degree source for this major.
                          </Text>
                        </View>
                        <Ionicons
                          name={isUwCoursesConsideredOpen ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#9CA3AF"
                        />
                      </View>
                    </AnimatedCardPressable>

                    {isUwCoursesConsideredOpen ? (
                      <View className="mt-3 gap-2">
                        {uwCoursesConsideredEntries.length ? (
                          uwCoursesConsideredEntries.map((entry) => (
                            <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                              {entry.text}
                            </Text>
                          ))
                        ) : (
                          <Text className={`${secondaryTextClass} text-sm`}>
                            No parsed UW course list is available for this major yet.
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

export default function TransferPlannerPage() {
  const handleGoBack = useBack(ROUTES.tabsResources);
  const { t } = useTranslation();
  const styles = useThemeStyles();
  const { width } = useWindowDimensions();
  const { isHydrated, state, patchUserLocally, updateUser, setQuestionnaireAnswers } = useAppData();
  const { getScrollContentPadding } = useResponsiveLayout();

  const [selectedCollegeId, setSelectedCollegeId] = useState<PlannerCollegeId>("uw");
  const [selectedCampusId, setSelectedCampusId] =
    useState<PlannerCampusSelectionId>("uw-seattle");
  const [selectedMajorId, setSelectedMajorId] = useState<string>(
    getTransferPlannerStudentRuntimeMajorsForCampus("uw-seattle")[0]?.id ?? ""
  );
  const [openSelector, setOpenSelector] = useState<PlannerSelectorKey>(null);
  const [isPathwaySelectorOpen, setIsPathwaySelectorOpen] = useState(false);
  const [transcriptDocument, setTranscriptDocument] = useState<TranscriptDocument | null>(null);
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [onlyUwEssentialClasses, setOnlyUwEssentialClasses] = useState(true);
  const [allowSummerClasses, setAllowSummerClasses] = useState(false);
  const [allowStemPrepClasses, setAllowStemPrepClasses] = useState(true);

  const transcriptAnalysisAttemptsRef = useRef<Set<string>>(new Set());
  const transcriptAnalysisGenerationRef = useRef(0);
  const selectorWasOpenOnTouchStartRef = useRef(false);
  const selectorTouchStartedInsideRef = useRef(false);

  const { textClass, secondaryTextClass, cardBgClass, borderClass, dropdownSurfaceColor } = styles;
  const isDesktop = width >= 1180;
  const isTablet = width >= 768;
  const shellMaxWidth = isDesktop ? 1280 : isTablet ? 980 : 760;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : 20;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 16,
  });

  const user = state.user;
  const storedDetailedTranscriptCourses =
    state.questionnaireAnswers?.[TRANSCRIPT_COURSES_FIELD];
  const hasDetailedCompletedCourses = useMemo(
    () =>
      Array.isArray(storedDetailedTranscriptCourses) &&
      storedDetailedTranscriptCourses.some(
        (entry: unknown) => !!entry && typeof entry === "object" && !Array.isArray(entry)
      ),
    [storedDetailedTranscriptCourses]
  );
  const hasDetailedCompletedCourseCredits = useMemo(
    () =>
      Array.isArray(storedDetailedTranscriptCourses) &&
      storedDetailedTranscriptCourses.some((entry: unknown) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return false;
        }

        const record = entry as Record<string, unknown>;
        const credits = Number(
          record.credits ?? record.earnedCredits ?? record.credit
        );
        return Number.isFinite(credits) && credits > 0;
      }),
    [storedDetailedTranscriptCourses]
  );
  const storedTranscriptSource = String(
    state.questionnaireAnswers?.[TRANSCRIPT_SOURCE_FIELD] ?? ""
  ).trim();
  const storedTranscriptUploadedAt = useMemo(() => {
    const raw = String(
      state.questionnaireAnswers?.[TRANSCRIPT_UPLOADED_AT_FIELD] ?? ""
    ).trim();
    if (!raw) return "";

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
  }, [state.questionnaireAnswers]);
  const storedTranscriptParserVersion = useMemo(() => {
    const raw = state.questionnaireAnswers?.[TRANSCRIPT_PARSER_VERSION_FIELD];
    const parsed =
      typeof raw === "number" ? raw : Number.parseInt(String(raw ?? "").trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [state.questionnaireAnswers]);
  const shouldUseDetailedCompletedCourses =
    hasDetailedCompletedCourses &&
    storedTranscriptParserVersion === TRANSCRIPT_PARSER_VERSION;
  const storedTranscriptEarnedCredits = useMemo(() => {
    const parsed = Number(
      state.questionnaireAnswers?.[TRANSCRIPT_EARNED_CREDITS_FIELD]
    );
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [state.questionnaireAnswers]);
  const cachedTranscriptDocument = useMemo<TranscriptDocument | null>(() => {
    if (!shouldUseDetailedCompletedCourses) return null;

    const url = storedTranscriptSource || String(user?.transcript ?? "").trim();
    if (!url) return null;

    return {
      name: "unofficial-transcript.pdf",
      url,
      uploadedAt: storedTranscriptUploadedAt,
      mimeType: "application/pdf",
      sizeBytes: null,
    };
  }, [
    shouldUseDetailedCompletedCourses,
    storedTranscriptSource,
    storedTranscriptUploadedAt,
    user?.transcript,
  ]);
  const activeTranscriptDocument = transcriptDocument ?? cachedTranscriptDocument;
  const rawCompletedCourses = shouldUseDetailedCompletedCourses
    ? storedDetailedTranscriptCourses
    : state.questionnaireAnswers?.completedCourses;
  const completedCourses = useMemo(
    () => parseCompletedTranscriptCourses(rawCompletedCourses),
    [rawCompletedCourses]
  );
  const transcriptDerivedCompletedCourses = useMemo(
    () =>
      shouldUseDetailedCompletedCourses
        ? parseCompletedTranscriptCourses(storedDetailedTranscriptCourses)
        : [],
    [shouldUseDetailedCompletedCourses, storedDetailedTranscriptCourses]
  );
  const needsTranscriptCreditReparse =
    shouldUseDetailedCompletedCourses &&
    storedTranscriptEarnedCredits == null &&
    !hasDetailedCompletedCourseCredits &&
    !!activeTranscriptDocument;
  const needsTranscriptReparse =
    hasDetailedCompletedCourses &&
    (storedTranscriptParserVersion !== TRANSCRIPT_PARSER_VERSION ||
      needsTranscriptCreditReparse);

  const isUwPlanner = selectedCollegeId === "uw";
  const selectedUwCampusId = useMemo<TransferPlannerCampusId>(
    () =>
      isUwPlanner && isPlannerUwCampusId(selectedCampusId)
        ? selectedCampusId
        : "uw-seattle",
    [isUwPlanner, selectedCampusId]
  );
  const effectiveSelectedCampusId = useMemo<PlannerCampusSelectionId>(
    () => (isUwPlanner ? selectedUwCampusId : GRC_PLANNER_CAMPUS_ID),
    [isUwPlanner, selectedUwCampusId]
  );
  const campus = useMemo(
    () =>
      isUwPlanner
        ? TRANSFER_PLANNER_CAMPUSES.find((entry) => entry.id === selectedUwCampusId) ??
          TRANSFER_PLANNER_CAMPUSES[0]
        : null,
    [isUwPlanner, selectedUwCampusId]
  );
  const campusMajors = useMemo(
    () =>
      isUwPlanner ? getTransferPlannerStudentRuntimeMajorsForCampus(selectedUwCampusId) : [],
    [isUwPlanner, selectedUwCampusId]
  );
  const selectedBasePlan = useMemo(
    () =>
      isUwPlanner
        ? campusMajors.find((entry) => entry.id === selectedMajorId) ?? campusMajors[0] ?? null
        : null,
    [campusMajors, isUwPlanner, selectedMajorId]
  );
  const selectedGrcTrack = useMemo(
    () =>
      !isUwPlanner
        ? TRANSFER_PLANNER_TRACKS.find((entry) => entry.id === selectedMajorId) ??
          TRANSFER_PLANNER_TRACKS[0] ??
          null
        : null,
    [isUwPlanner, selectedMajorId]
  );
  const effectiveSelectedMajorId = useMemo(
    () =>
      isUwPlanner
        ? selectedBasePlan?.id ?? campusMajors[0]?.id ?? selectedMajorId
        : selectedGrcTrack?.id ?? TRANSFER_PLANNER_TRACKS[0]?.id ?? selectedMajorId,
    [campusMajors, isUwPlanner, selectedBasePlan?.id, selectedGrcTrack?.id, selectedMajorId]
  );
  const selectedPathwayByPlan = useMemo(
    () =>
      normalizePlannerSelectedPathwayMap(
        state.questionnaireAnswers?.[SELECTED_PATHWAY_FIELD]
      ),
    [state.questionnaireAnswers]
  );
  const storedLastSelectedPlan = useMemo(
    () => normalizePlannerLastSelectedPlan(state.questionnaireAnswers?.[LAST_SELECTED_PLAN_FIELD]),
    [state.questionnaireAnswers]
  );
  const pathwayOptions = useMemo(
    () => (isUwPlanner ? getTransferPlannerStudentRuntimePathwaysForPlan(selectedBasePlan) : []),
    [isUwPlanner, selectedBasePlan]
  );
  const selectedPathwayId = useMemo(() => {
    if (!isUwPlanner || !selectedBasePlan) return null;
    const storedPathwayId = selectedPathwayByPlan[selectedBasePlan.id] ?? null;
    if (storedPathwayId && pathwayOptions.some((entry) => entry.id === storedPathwayId)) {
      return storedPathwayId;
    }
    return pathwayOptions[0]?.id ?? null;
  }, [isUwPlanner, pathwayOptions, selectedBasePlan, selectedPathwayByPlan]);
  const plan = useMemo(
    () =>
      isUwPlanner
        ? resolveTransferPlannerStudentRuntimeMajorPlan(selectedBasePlan, selectedPathwayId)
        : null,
    [isUwPlanner, selectedBasePlan, selectedPathwayId]
  );
  const track = useMemo(
    () => (isUwPlanner ? getTransferPlannerTrack(plan?.bestTrackId ?? null) : selectedGrcTrack),
    [isUwPlanner, plan, selectedGrcTrack]
  );
  const plannerPathKey = useMemo(
    () => getPlannerPathKey(effectiveSelectedCampusId, plan?.id ?? effectiveSelectedMajorId, selectedPathwayId),
    [effectiveSelectedCampusId, effectiveSelectedMajorId, plan?.id, selectedPathwayId]
  );
  const currentCourseSelectionsByPath = useMemo(
    () =>
      normalizePlannerCurrentCourseMap(
        state.questionnaireAnswers?.[CURRENT_PLANNED_COURSES_FIELD]
      ),
    [state.questionnaireAnswers]
  );
  const selectedOptionsByPath = useMemo(
    () =>
      normalizePlannerSelectedOptionsMap(
        state.questionnaireAnswers?.[SELECTED_PLANNER_OPTIONS_FIELD]
      ),
    [state.questionnaireAnswers]
  );
  const currentPlannedCourseLabels = useMemo(
    () => currentCourseSelectionsByPath[plannerPathKey] ?? [],
    [currentCourseSelectionsByPath, plannerPathKey]
  );
  const currentPlannedCourseSet = useMemo(
    () => new Set(currentPlannedCourseLabels),
    [currentPlannedCourseLabels]
  );
  const selectedRequirementOptionIdsByGroup = useMemo(
    () => selectedOptionsByPath[plannerPathKey] ?? {},
    [plannerPathKey, selectedOptionsByPath]
  );
  const transcriptSourceKey = getTranscriptDocumentIdentity(activeTranscriptDocument);
  const transcriptAnalysisKey = transcriptSourceKey
    ? `${transcriptSourceKey}|v${TRANSCRIPT_PARSER_VERSION}`
    : "";
  const autoMajorSelectionRef = useRef(false);
  const hydratedLastSelectionRef = useRef(false);
  const backLabel = useMemo(() => {
    const translated = t("general.back");
    return translated && translated !== "general.back" ? translated : "Back";
  }, [t]);
  const reportBugEmailSubject = "GatorGuide Course Planner Bug Report";
  const reportBugEmailBody =
    "Please describe what happened in Course Planner:\n\n\nA current Course Planner log is attached when your email app supports attachments.";
  const reportBugMailtoUrl = useMemo(
    () => buildCoursePlannerBugReportMailtoUrl(reportBugEmailSubject, reportBugEmailBody),
    [reportBugEmailBody, reportBugEmailSubject]
  );
  const completedCoursesKey = useMemo(
    () =>
      completedCourses
        .map((course) =>
          [
            course.code,
            course.label,
            course.termLabel ?? "",
            course.catalogYearLabel ?? "",
          ].join(":")
        )
        .join("|"),
    [completedCourses]
  );
  const plannerStructureComputationKey = useMemo(
    () =>
      [
        selectedCollegeId,
        effectiveSelectedCampusId,
        plan?.id ?? "",
        plan?.selectedPathwayId ?? selectedPathwayId ?? "",
        track?.id ?? "",
        completedCoursesKey,
      ].join("||"),
    [
      completedCoursesKey,
      effectiveSelectedCampusId,
      plan?.id,
      plan?.selectedPathwayId,
      selectedCollegeId,
      selectedPathwayId,
      track?.id,
    ]
  );
  const [isPlannerComputationReady, setIsPlannerComputationReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let cancelScheduledFrame = () => {};
    setIsPlannerComputationReady(false);

    const task = InteractionManager.runAfterInteractions(() => {
      if (typeof requestAnimationFrame === "function") {
        const frame = requestAnimationFrame(() => {
          if (!cancelled) {
            setIsPlannerComputationReady(true);
          }
        });
        cancelScheduledFrame = () => cancelAnimationFrame(frame);
        return;
      }

      const timeout = setTimeout(() => {
        if (!cancelled) {
          setIsPlannerComputationReady(true);
        }
      }, 0);
      cancelScheduledFrame = () => clearTimeout(timeout);
    });

    return () => {
      cancelled = true;
      cancelScheduledFrame();
      task.cancel?.();
    };
  }, [plannerStructureComputationKey]);

  useEffect(() => {
    if (!isHydrated || hydratedLastSelectionRef.current) return;

    hydratedLastSelectionRef.current = true;
    if (!storedLastSelectedPlan) return;

    if (storedLastSelectedPlan.collegeId === "grc") {
      const matchedTrack = TRANSFER_PLANNER_TRACKS.find(
        (entry) => entry.id === storedLastSelectedPlan.majorId
      );
      if (!matchedTrack) return;

      autoMajorSelectionRef.current = true;
      setSelectedCollegeId("grc");
      setSelectedCampusId(GRC_PLANNER_CAMPUS_ID);
      setSelectedMajorId(matchedTrack.id);
      return;
    }

    const matchedCampus = TRANSFER_PLANNER_CAMPUSES.find(
      (entry) => entry.id === storedLastSelectedPlan.campusId
    );
    if (!matchedCampus) return;

    const nextMajors = getTransferPlannerStudentRuntimeMajorsForCampus(matchedCampus.id);
    const matchedMajor = nextMajors.find((entry) => entry.id === storedLastSelectedPlan.majorId);
    if (!matchedMajor) return;

    autoMajorSelectionRef.current = true;
    setSelectedCollegeId("uw");
    setSelectedCampusId(matchedCampus.id);
    setSelectedMajorId(matchedMajor.id);
  }, [isHydrated, storedLastSelectedPlan]);

  useEffect(() => {
    const nextCampusId = getDefaultPlannerCampusId(selectedCollegeId);
    if (selectedCollegeId === "grc") {
      if (selectedCampusId !== GRC_PLANNER_CAMPUS_ID) {
        setSelectedCampusId(GRC_PLANNER_CAMPUS_ID);
      }
      return;
    }

    if (!isPlannerUwCampusId(selectedCampusId)) {
      setSelectedCampusId(nextCampusId);
    }
  }, [selectedCollegeId, selectedCampusId]);

  useEffect(() => {
    const nextFirstMajorId =
      selectedCollegeId === "grc"
        ? TRANSFER_PLANNER_TRACKS[0]?.id ?? ""
        : campusMajors[0]?.id ?? "";

    if (selectedCollegeId === "grc") {
      if (!TRANSFER_PLANNER_TRACKS.some((entry) => entry.id === selectedMajorId)) {
        setSelectedMajorId(nextFirstMajorId);
      }
      return;
    }

    if (!campusMajors.some((entry) => entry.id === selectedMajorId)) {
      setSelectedMajorId(nextFirstMajorId);
    }
  }, [campusMajors, selectedCollegeId, selectedMajorId]);

  useEffect(() => {
    if (autoMajorSelectionRef.current) return;
    const rawMajor = String(user?.major ?? "").trim().toLowerCase();
    if (!rawMajor) return;

    const matchedMajor =
      selectedCollegeId === "grc"
        ? TRANSFER_PLANNER_TRACKS.find((entry) => {
            const trackTitle = entry.title.toLowerCase();
            const trackCode = entry.code.toLowerCase();
            return (
              trackTitle.includes(rawMajor) ||
              rawMajor.includes(trackTitle) ||
              rawMajor.includes(trackCode)
            );
          })
        : campusMajors.find((entry) =>
            entry.title.toLowerCase().includes(rawMajor) ||
            rawMajor.includes(entry.shortTitle.toLowerCase()) ||
            rawMajor.includes(entry.title.toLowerCase())
          );

    if (!matchedMajor) return;
    autoMajorSelectionRef.current = true;
    setSelectedMajorId(matchedMajor.id);
  }, [campusMajors, selectedCollegeId, user?.major]);

  useEffect(() => {
    if (!isHydrated || !selectedMajorId) return;
    if (selectedCollegeId === "uw" && !isPlannerUwCampusId(selectedCampusId)) return;
    if (selectedCollegeId === "grc" && selectedCampusId !== GRC_PLANNER_CAMPUS_ID) return;
    if (selectedCollegeId === "uw" && !campusMajors.some((entry) => entry.id === effectiveSelectedMajorId)) {
      return;
    }
    if (
      selectedCollegeId === "grc" &&
      !TRANSFER_PLANNER_TRACKS.some((entry) => entry.id === effectiveSelectedMajorId)
    ) {
      return;
    }

    const currentCollegeId = String(storedLastSelectedPlan?.collegeId ?? "").trim().toLowerCase();
    const currentCampusId = String(storedLastSelectedPlan?.campusId ?? "").trim();
    const currentMajorId = String(storedLastSelectedPlan?.majorId ?? "").trim();
    if (
      currentCollegeId === selectedCollegeId &&
      currentCampusId === effectiveSelectedCampusId &&
      currentMajorId === effectiveSelectedMajorId
    ) {
      return;
    }

    void setQuestionnaireAnswers((currentAnswers) => ({
      ...currentAnswers,
      [LAST_SELECTED_PLAN_FIELD]: {
        collegeId: selectedCollegeId,
        campusId: effectiveSelectedCampusId,
        majorId: effectiveSelectedMajorId,
      },
    }));
  }, [
    campusMajors,
    effectiveSelectedMajorId,
    effectiveSelectedCampusId,
    isHydrated,
    selectedCollegeId,
    selectedCampusId,
    selectedMajorId,
    setQuestionnaireAnswers,
    state.questionnaireAnswers,
    storedLastSelectedPlan,
  ]);

  useEffect(() => {
    let active = true;

    if (!user?.uid) {
      setTranscriptDocument((currentDocument) => {
        if (!currentDocument) return currentDocument;
        transcriptAnalysisGenerationRef.current += 1;
        return null;
      });
      return () => {
        active = false;
      };
    }

    void (async () => {
      const stored = await storageService.getTranscript(user.uid).catch(() => null);
      if (!active) return;
      const nextDocument = stored && stored.url ? stored : null;
      setTranscriptDocument((currentDocument) => {
        if (
          getTranscriptDocumentIdentity(currentDocument) ===
          getTranscriptDocumentIdentity(nextDocument)
        ) {
          return currentDocument;
        }

        transcriptAnalysisGenerationRef.current += 1;
        return nextDocument;
      });
    })();

    return () => {
      active = false;
    };
  }, [user?.uid, user?.transcript]);

  const analyzeTranscript = useCallback(
    async (document: TranscriptDocument) => {
      const analysisStartedAt = getDebugNowMs();
      let importMs = 0;
      let parserRunMs = 0;
      let cachePatchMs = 0;
      let parserDiagnostics: unknown = null;
      const analysisAttemptKey = getTranscriptAnalysisAttemptKey(document);
      const analysisGeneration = transcriptAnalysisGenerationRef.current;
      if (analysisAttemptKey) {
        transcriptAnalysisAttemptsRef.current.add(analysisAttemptKey);
      }
      setIsAnalyzingTranscript(true);
      setTranscriptError(null);
      appendTranscriptDebugEvent("transcript-analysis-start", analysisStartedAt, {
        documentName: getReadableTranscriptFileName(document),
        urlKind: getTranscriptUrlKind(document.url),
        urlLength: String(document.url ?? "").length,
        sizeBytes: document.sizeBytes ?? null,
        storedParserVersion: storedTranscriptParserVersion,
        parserVersion: TRANSCRIPT_PARSER_VERSION,
      });
      const debugBase = {
        document,
        parserVersion: TRANSCRIPT_PARSER_VERSION,
        storedParserVersion: storedTranscriptParserVersion,
        transcriptSourceKey: getTranscriptDocumentIdentity(document),
        storedTranscriptSource,
        completedCoursesBeforeCount: completedCourses.length,
        questionnaireCompletedCourseCount: Array.isArray(state.questionnaireAnswers?.completedCourses)
          ? state.questionnaireAnswers.completedCourses.length
          : 0,
      };

      transcriptPlannerDebugService.setLastTranscriptPlannerDebug(
        buildTranscriptDebugSnapshot({
          ...debugBase,
          phase: "analysis-start",
          parsedCourseCount: null,
          parsedCourseCodesPreview: [],
          parsedCourseAssignmentsPreview: [],
          parsedQuarterBuckets: [],
          timings: {
            analysisElapsedMs: 0,
          },
          parserDiagnostics: null,
          error: null,
        })
      );

      try {
        const importStartedAt = getDebugNowMs();
        const { transcriptPdfService } = await import(
          "@/services/documents/transcript-pdf.service"
        );
        importMs = getDebugElapsedMs(importStartedAt);
        appendTranscriptDebugEvent("transcript-parser-module-imported", analysisStartedAt, {
          importMs,
        });

        const parserStartedAt = getDebugNowMs();
        const parsedTranscript = await transcriptPdfService.extractTranscriptDataFromPdf(
          document.url
        );
        parserRunMs = getDebugElapsedMs(parserStartedAt);
        parserDiagnostics = parsedTranscript.diagnostics ?? null;
        appendTranscriptDebugEvent("transcript-parser-complete", analysisStartedAt, {
          parserRunMs,
          parserDiagnostics,
          parsedCourseCount: parsedTranscript.completedCourses.length,
          earnedCreditsTotal: parsedTranscript.earnedCreditsTotal,
          gpa: parsedTranscript.gpa,
        });
        const parsedCourses = parsedTranscript.completedCourses;

        if (!parsedCourses.length) throw new Error("No completed courses extracted.");
        if (analysisGeneration !== transcriptAnalysisGenerationRef.current) return;

        const cachePatchStartedAt = getDebugNowMs();
        await setQuestionnaireAnswers((currentAnswers) => ({
          ...currentAnswers,
          ...buildTransferPlannerTranscriptCachePatch(
            document,
            parsedCourses,
            parsedTranscript.earnedCreditsTotal
          ),
        }));
        cachePatchMs = getDebugElapsedMs(cachePatchStartedAt);
        appendTranscriptDebugEvent("transcript-cache-patch-applied", analysisStartedAt, {
          cachePatchMs,
          parsedCourseCount: parsedCourses.length,
        });

        transcriptPlannerDebugService.setLastTranscriptPlannerDebug(
          buildTranscriptDebugSnapshot({
            ...debugBase,
            phase: "analysis-success",
            parsedCourseCount: parsedCourses.length,
            parsedCourseCodesPreview: parsedCourses
              .slice(0, 20)
              .map((course) => course.code),
            parsedCourseAssignmentsPreview: buildParsedCourseAssignmentsPreview(parsedCourses),
            parsedQuarterBuckets: buildParsedQuarterBuckets(parsedCourses),
            timings: {
              analysisElapsedMs: getDebugElapsedMs(analysisStartedAt),
              importMs,
              parserRunMs,
              cachePatchMs,
            },
            parserDiagnostics,
            error: null,
          })
        );
      } catch (error) {
        if (analysisGeneration !== transcriptAnalysisGenerationRef.current) return;
        appendTranscriptDebugEvent("transcript-analysis-failure", analysisStartedAt, {
          analysisElapsedMs: getDebugElapsedMs(analysisStartedAt),
          importMs,
          parserRunMs,
          cachePatchMs,
          message: error instanceof Error ? error.message : String(error),
        });
        const failureSnapshot = buildTranscriptDebugSnapshot({
          ...debugBase,
          phase: "analysis-failure",
          parsedCourseCount: null,
          parsedCourseCodesPreview: [],
          parsedCourseAssignmentsPreview: [],
          parsedQuarterBuckets: [],
          timings: {
            analysisElapsedMs: getDebugElapsedMs(analysisStartedAt),
            importMs,
            parserRunMs,
            cachePatchMs,
          },
          parserDiagnostics,
          error,
        });

        transcriptPlannerDebugService.setLastTranscriptPlannerDebug(failureSnapshot);
        void errorLoggingService.captureException(error, {
          category: "storage",
          operation: "transfer-planner-analyze-transcript",
          severity: "warn",
          handled: true,
          source: "TransferPlannerPage",
          screen: "TransferPlannerPage",
          route: ROUTES.transferPlanner,
          tags: ["transcript", "transfer-planner", failureSnapshot.document.urlKind],
          metadata: failureSnapshot,
        });
        setTranscriptError(buildFriendlyTranscriptError());
      } finally {
        if (analysisGeneration === transcriptAnalysisGenerationRef.current) {
          appendTranscriptDebugEvent("transcript-analysis-finished", analysisStartedAt, {
            analysisElapsedMs: getDebugElapsedMs(analysisStartedAt),
            importMs,
            parserRunMs,
            cachePatchMs,
          });
          setIsAnalyzingTranscript(false);
        }
      }
    },
    [
      completedCourses.length,
      setQuestionnaireAnswers,
      state.questionnaireAnswers,
      storedTranscriptParserVersion,
      storedTranscriptSource,
    ]
  );

  useEffect(() => {
    if (!activeTranscriptDocument) return;
    const autoAnalysisStartedAt = getDebugNowMs();
    if (
      completedCourses.length &&
      storedTranscriptSource === activeTranscriptDocument.url &&
      shouldUseDetailedCompletedCourses &&
      !needsTranscriptCreditReparse
    ) {
      appendTranscriptDebugEvent("transcript-auto-analysis-skipped-cache-fresh", autoAnalysisStartedAt, {
        completedCoursesCount: completedCourses.length,
        storedParserVersion: storedTranscriptParserVersion,
        parserVersion: TRANSCRIPT_PARSER_VERSION,
      });
      return;
    }
    if (!transcriptAnalysisKey) return;
    if (transcriptAnalysisAttemptsRef.current.has(transcriptAnalysisKey)) {
      appendTranscriptDebugEvent("transcript-auto-analysis-skipped-duplicate-key", autoAnalysisStartedAt, {
        transcriptAnalysisKeyLength: transcriptAnalysisKey.length,
        needsTranscriptReparse,
        needsTranscriptCreditReparse,
        isAnalyzingTranscript,
      });
      return;
    }

    transcriptAnalysisAttemptsRef.current.add(transcriptAnalysisKey);
    appendTranscriptDebugEvent("transcript-auto-analysis-dispatched", autoAnalysisStartedAt, {
      transcriptAnalysisKeyLength: transcriptAnalysisKey.length,
      urlKind: getTranscriptUrlKind(activeTranscriptDocument.url),
      urlLength: String(activeTranscriptDocument.url ?? "").length,
      needsTranscriptReparse,
      needsTranscriptCreditReparse,
    });
    void analyzeTranscript(activeTranscriptDocument);
  }, [
    activeTranscriptDocument,
    analyzeTranscript,
    transcriptAnalysisKey,
    completedCourses.length,
    isAnalyzingTranscript,
    storedTranscriptSource,
    storedTranscriptParserVersion,
    shouldUseDetailedCompletedCourses,
    needsTranscriptReparse,
    needsTranscriptCreditReparse,
  ]);

  const handlePickTranscript = useCallback(async () => {
    if (!user?.uid) {
      Alert.alert("Profile needed", "Open the app as a guest or signed-in student first.");
      return;
    }

    const uploadFlowStartedAt = getDebugNowMs();
    transcriptPlannerDebugService.clearTranscriptPlannerEvents();
    appendTranscriptDebugEvent("transcript-upload-flow-start", uploadFlowStartedAt, {
      userId: user.uid,
      platform: Platform.OS,
    });

    try {
      const pickerStartedAt = getDebugNowMs();
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
      });
      appendTranscriptDebugEvent("transcript-document-picker-complete", uploadFlowStartedAt, {
        pickerMs: getDebugElapsedMs(pickerStartedAt),
        canceled: result.canceled,
        assetCount: result.assets?.length ?? 0,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        appendTranscriptDebugEvent("transcript-upload-flow-canceled", uploadFlowStartedAt);
        return;
      }

      const asset = result.assets[0];
      appendTranscriptDebugEvent("transcript-document-selected", uploadFlowStartedAt, {
        fileName: asset.name ?? null,
        uriKind: getTranscriptUrlKind(asset.uri),
        uriLength: String(asset.uri ?? "").length,
        mimeType: asset.mimeType ?? null,
        sizeBytes: asset.size ?? null,
      });

      const localPersistStartedAt = getDebugNowMs();
      const uploaded = await storageService.uploadTranscript(user.uid, asset.uri, {
        fileName: asset.name,
        mimeType: asset.mimeType,
        sizeBytes: asset.size,
      });
      appendTranscriptDebugEvent("transcript-local-persist-complete", uploadFlowStartedAt, {
        localPersistMs: getDebugElapsedMs(localPersistStartedAt),
        persistedUrlKind: getTranscriptUrlKind(uploaded.url),
        persistedUrlLength: String(uploaded.url ?? "").length,
        uploadedAt: uploaded.uploadedAt,
      });

      const updateUserStartedAt = getDebugNowMs();
      await updateUser({ transcript: uploaded.url });
      appendTranscriptDebugEvent("transcript-user-state-update-complete", uploadFlowStartedAt, {
        updateUserMs: getDebugElapsedMs(updateUserStartedAt),
      });

      transcriptAnalysisGenerationRef.current += 1;
      transcriptAnalysisAttemptsRef.current.add(getTranscriptAnalysisAttemptKey(uploaded));
      setTranscriptDocument(uploaded);
      appendTranscriptDebugEvent("transcript-analysis-dispatched-after-upload", uploadFlowStartedAt);
      await analyzeTranscript(uploaded);
      appendTranscriptDebugEvent("transcript-upload-flow-finished", uploadFlowStartedAt, {
        totalUploadFlowMs: getDebugElapsedMs(uploadFlowStartedAt),
      });
    } catch (error) {
      appendTranscriptDebugEvent("transcript-upload-flow-failure", uploadFlowStartedAt, {
        totalUploadFlowMs: getDebugElapsedMs(uploadFlowStartedAt),
        message: error instanceof Error ? error.message : String(error),
      });
      transcriptPlannerDebugService.setLastTranscriptPlannerDebug(
        buildTranscriptDebugSnapshot({
          phase: "upload-failure",
          document: {
            name: "unofficial-transcript.pdf",
            url: "",
            uploadedAt: "",
            mimeType: "application/pdf",
            sizeBytes: null,
          },
          parserVersion: TRANSCRIPT_PARSER_VERSION,
          storedParserVersion: storedTranscriptParserVersion,
          transcriptSourceKey: "",
          storedTranscriptSource,
          completedCoursesBeforeCount: completedCourses.length,
          questionnaireCompletedCourseCount: Array.isArray(state.questionnaireAnswers?.completedCourses)
            ? state.questionnaireAnswers.completedCourses.length
            : 0,
          parsedCourseCount: null,
          parsedCourseCodesPreview: [],
          parsedCourseAssignmentsPreview: [],
          parsedQuarterBuckets: [],
          timings: {
            totalUploadFlowMs: getDebugElapsedMs(uploadFlowStartedAt),
          },
          parserDiagnostics: null,
          error,
        })
      );
      void errorLoggingService.captureException(error, {
        category: "upload",
        operation: "transfer-planner-upload-transcript",
        severity: "warn",
        handled: true,
        source: "TransferPlannerPage",
        screen: "TransferPlannerPage",
        route: ROUTES.transferPlanner,
        tags: ["transcript", "transfer-planner", "upload"],
      });
      Alert.alert("Transcript upload failed", "We couldn't use that transcript yet.", [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Open ctcLink",
          onPress: () => {
            void openExternalLink(CTCLINK_UNOFFICIAL_TRANSCRIPT_URL);
          },
        },
      ]);
    }
  }, [
    analyzeTranscript,
    completedCourses.length,
    state.questionnaireAnswers?.completedCourses,
    storedTranscriptParserVersion,
    storedTranscriptSource,
    updateUser,
    user?.uid,
  ]);

  const removeTranscriptNow = useCallback(async () => {
    if (!user?.uid) return;

    try {
      transcriptAnalysisGenerationRef.current += 1;
      setTranscriptDocument(null);
      transcriptAnalysisAttemptsRef.current.clear();
      setTranscriptError(null);
      setIsAnalyzingTranscript(false);

      await resetTranscriptState({
        userId: user.uid,
        setQuestionnaireAnswers,
        patchUserLocally,
        updateUser,
      });
    } catch (err) {
      const restoredTranscript = await storageService.getTranscript(user.uid).catch(() => null);
      transcriptAnalysisGenerationRef.current += 1;
      setTranscriptDocument(restoredTranscript && restoredTranscript.url ? restoredTranscript : null);
      void errorLoggingService.captureException(err, {
        category: 'storage',
        operation: 'delete-transcript',
        severity: 'warn',
        handled: true,
        source: 'TransferPlannerPage',
      });

      if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert("Couldn't remove transcript.");
      } else {
        Alert.alert('Remove failed', "Couldn't remove transcript.");
      }
    }
  }, [patchUserLocally, setQuestionnaireAnswers, updateUser, user?.uid]);

  const handleRemoveTranscript = useCallback(() => {
    void removeTranscriptNow();
  }, [removeTranscriptNow]);

  const applicationStatuses = useMemo(
    () =>
      isPlannerComputationReady && isUwPlanner && plan
        ? buildRequirementStatuses(plan.applicationChecklist, completedCourses)
        : [],
    [completedCourses, isPlannerComputationReady, isUwPlanner, plan]
  );
  const beforeEnrollmentStatuses = useMemo(
    () =>
      isPlannerComputationReady && isUwPlanner && plan
        ? buildRequirementStatuses(plan.beforeEnrollmentChecklist, completedCourses)
        : [],
    [completedCourses, isPlannerComputationReady, isUwPlanner, plan]
  );
  const stayAtGrcStatuses = useMemo(
    () =>
      isPlannerComputationReady && isUwPlanner && plan
        ? buildRequirementStatuses(plan.stayAtGrcChecklist, completedCourses)
        : [],
    [completedCourses, isPlannerComputationReady, isUwPlanner, plan]
  );
  const hasOptionalStayAtGrcChecklist = plan?.stayAtGrcChecklist.length
    ? plan.stayAtGrcChecklist.some((item) => item.grcCourses.length > 0)
    : false;
  const shouldShowUwOnlyToggle =
    isUwPlanner && (Boolean(track) || hasOptionalStayAtGrcChecklist);
  const suggestedQuarterPlan = useMemo(
    () =>
      isPlannerComputationReady
        ? buildSuggestedQuarterPlan({
            plan: isUwPlanner ? plan : null,
            plannerCollegeId: selectedCollegeId,
            applicationStatuses,
            beforeEnrollmentStatuses,
            stayAtGrcStatuses,
            completedCourses,
            currentCourseKeys: currentPlannedCourseLabels,
            currentCourseLabels: currentPlannedCourseLabels,
            track,
            includeStayAtGrcCourses: isUwPlanner ? !onlyUwEssentialClasses : true,
            includeSummerQuarter: allowSummerClasses,
            includeStemPrepCourses: allowStemPrepClasses,
            selectedRequirementOptionIdsByGroup,
          })
        : [],
    [
      allowStemPrepClasses,
      applicationStatuses,
      beforeEnrollmentStatuses,
      completedCourses,
      currentPlannedCourseLabels,
      isPlannerComputationReady,
      isUwPlanner,
      allowSummerClasses,
      onlyUwEssentialClasses,
      plan,
      selectedCollegeId,
      selectedRequirementOptionIdsByGroup,
      stayAtGrcStatuses,
      track,
    ]
  );
  const studentCourseEvaluations = useMemo(
    () =>
      isPlannerComputationReady && isUwPlanner && plan
        ? buildTransferPlannerStudentCourseEvaluations({
            plan,
            completedCourses,
            applicationStatuses,
            beforeEnrollmentStatuses,
            stayAtGrcStatuses,
          })
        : [],
    [
      applicationStatuses,
      beforeEnrollmentStatuses,
      completedCourses,
      isPlannerComputationReady,
      isUwPlanner,
      plan,
      stayAtGrcStatuses,
    ]
  );
  const studentEvaluationReport = useMemo(
    () =>
      isPlannerComputationReady && isUwPlanner && plan
        ? buildTransferPlannerStudentEvaluationReport({
            plan,
            campusLabel: campus?.title ?? getCollegeOptionLabel(selectedCollegeId),
            completedCourses,
            evaluations: studentCourseEvaluations,
            suggestedQuarterPlan,
          })
        : null,
    [
      campus?.title,
      completedCourses,
      isPlannerComputationReady,
      isUwPlanner,
      plan,
      selectedCollegeId,
      studentCourseEvaluations,
      suggestedQuarterPlan,
    ]
  );
  const hasStructuredPlannerData = useMemo(
    () =>
      isUwPlanner
        ? !!plan &&
          (
            plan.applicationChecklist.length > 0 ||
            plan.beforeEnrollmentChecklist.length > 0 ||
            plan.stayAtGrcChecklist.length > 0
          )
        : Boolean(track),
    [isUwPlanner, plan, track]
  );
  const isPlannerComputationLoading =
    hasStructuredPlannerData && !isPlannerComputationReady;
  const handleToggleCurrentCourse = useCallback(
    async (courseKey: string, fallbackCourseLabel?: string) => {
      const normalizedKey = String(courseKey ?? "").trim();
      const normalizedFallbackLabel = String(fallbackCourseLabel ?? "").trim();
      if (!normalizedKey) return;

      const nextPathLabels = currentPlannedCourseSet.has(normalizedKey)
        ? currentPlannedCourseLabels.filter((label) => label !== normalizedKey)
        : normalizedFallbackLabel && currentPlannedCourseSet.has(normalizedFallbackLabel)
          ? currentPlannedCourseLabels.filter((label) => label !== normalizedFallbackLabel)
          : [...currentPlannedCourseLabels, normalizedKey];
      const nextSelectionMap = {
        ...currentCourseSelectionsByPath,
        [plannerPathKey]: nextPathLabels,
      };

      if (!nextPathLabels.length) {
        delete nextSelectionMap[plannerPathKey];
      }

      await setQuestionnaireAnswers((currentAnswers) => ({
        ...currentAnswers,
        [CURRENT_PLANNED_COURSES_FIELD]: nextSelectionMap,
      }));
    },
    [
      currentCourseSelectionsByPath,
      currentPlannedCourseLabels,
      currentPlannedCourseSet,
      plannerPathKey,
      setQuestionnaireAnswers,
    ]
  );
  const handleSelectRequirementOption = useCallback(
    async (
      groupId: string,
      optionId: string,
      selectionCount: number,
      currentSelectedOptionIds?: string[]
    ) => {
      const normalizedGroupId = String(groupId ?? "").trim();
      const normalizedOptionId = String(optionId ?? "").trim();
      if (!normalizedGroupId || !normalizedOptionId) return;

      const displayedGroupSelections = getSuggestedScheduleUniqueOptionIds(
        currentSelectedOptionIds
      );
      const normalizedSelectionCount =
        Number.isFinite(selectionCount) && selectionCount > 1
          ? Math.floor(selectionCount)
          : 1;

      await setQuestionnaireAnswers((currentAnswers) => {
        const currentSelectedOptionsByPath = normalizePlannerSelectedOptionsMap(
          currentAnswers?.[SELECTED_PLANNER_OPTIONS_FIELD]
        );
        const currentPathSelections = currentSelectedOptionsByPath[plannerPathKey] ?? {};
        const hasStoredGroupSelection = Object.prototype.hasOwnProperty.call(
          currentPathSelections,
          normalizedGroupId
        );
        const rawStoredGroupSelection = currentPathSelections[normalizedGroupId];
        const storedGroupSelections = getSuggestedScheduleUniqueOptionIds(
          Array.isArray(rawStoredGroupSelection)
            ? rawStoredGroupSelection
            : rawStoredGroupSelection == null
              ? []
              : [rawStoredGroupSelection]
        );
        const currentGroupSelections = hasStoredGroupSelection
          ? storedGroupSelections
          : displayedGroupSelections;
        const nextGroupSelections =
          normalizedSelectionCount === 1
            ? [normalizedOptionId]
            : currentGroupSelections.includes(normalizedOptionId)
              ? currentGroupSelections.filter((entry) => entry !== normalizedOptionId)
              : [...currentGroupSelections, normalizedOptionId].slice(-normalizedSelectionCount);
        const nextPathSelections = {
          ...currentPathSelections,
          [normalizedGroupId]: nextGroupSelections,
        };
        const nextSelectionMap = {
          ...currentSelectedOptionsByPath,
          [plannerPathKey]: nextPathSelections,
        };

        if (!Object.keys(nextPathSelections).length) {
          delete nextSelectionMap[plannerPathKey];
        }

        return {
          ...currentAnswers,
          [SELECTED_PLANNER_OPTIONS_FIELD]: nextSelectionMap,
        };
      });
    },
    [plannerPathKey, setQuestionnaireAnswers]
  );
  const handleSelectPathway = useCallback(
    async (pathwayId: string) => {
      if (!selectedBasePlan) return;

      const nextSelectionMap = {
        ...selectedPathwayByPlan,
        [selectedBasePlan.id]: pathwayId,
      };

      await setQuestionnaireAnswers((currentAnswers) => ({
        ...currentAnswers,
        [SELECTED_PATHWAY_FIELD]: nextSelectionMap,
      }));
    },
    [
      selectedBasePlan,
      selectedPathwayByPlan,
      setQuestionnaireAnswers,
    ]
  );
  const plannerHeroContent = useMemo(
    () => getPlannerHeroContent(selectedCollegeId),
    [selectedCollegeId]
  );
  const selectedCollegeLabel = useMemo(
    () => getCollegeOptionLabel(selectedCollegeId),
    [selectedCollegeId]
  );
  const selectedCampusLabel = useMemo(
    () => (isUwPlanner ? campus?.title ?? "UW Seattle" : "Green River College"),
    [campus?.title, isUwPlanner]
  );
  const selectedMajorLabel = useMemo(() => {
    if (!isUwPlanner) {
      return selectedGrcTrack
        ? `${selectedGrcTrack.code} | ${selectedGrcTrack.title}`
        : "Select program";
    }

    return plan?.title ?? selectedBasePlan?.title ?? "Select major";
  }, [isUwPlanner, plan?.title, selectedBasePlan?.title, selectedGrcTrack]);
  const selectedGrcTrackRequirementNoun = useMemo(
    () => getGrcTrackRequirementNoun(selectedGrcTrack),
    [selectedGrcTrack]
  );
  const activeDegreeTitle = useMemo(() => {
    if (!isUwPlanner) {
      return selectedGrcTrack?.title ?? "Selected Green River program";
    }

    return plan?.selectedPathwayLabel ? `${plan.title} (${plan.selectedPathwayLabel})` : plan?.title ?? "Selected UW degree";
  }, [isUwPlanner, plan, selectedGrcTrack]);
  const activeTrackCode = track?.code ?? null;
  const activeTrackTitle = useMemo(
    () =>
      track?.title ??
      (isUwPlanner
        ? "Custom Green River path"
        : selectedGrcTrack?.title ?? "Selected Green River program"),
    [isUwPlanner, selectedGrcTrack, track]
  );
  const activeTrackSummary = useMemo(
    () => (isUwPlanner ? plan?.recommendedTrackSummary ?? "" : track?.summary ?? ""),
    [isUwPlanner, plan?.recommendedTrackSummary, track]
  );
  const activeTrackOfficialLinkUrl = useMemo(
    () =>
      track?.officialLinks?.find((entry) => String(entry?.url ?? "").trim())?.url ?? null,
    [track]
  );
  const collegeOptions = useMemo(
    () => [
      {
        id: "uw",
        label: getCollegeOptionLabel("uw"),
      },
      {
        id: "grc",
        label: getCollegeOptionLabel("grc"),
      },
    ],
    []
  );
  const campusOptions = useMemo(
    () =>
      isUwPlanner
        ? TRANSFER_PLANNER_CAMPUSES.map((entry) => ({
            id: entry.id,
            label: entry.title,
          }))
        : [
            {
              id: GRC_PLANNER_CAMPUS_ID,
              label: "Green River College",
            },
          ],
    [isUwPlanner]
  );
  const majorOptions = useMemo(
    () =>
      isUwPlanner
        ? campusMajors.map((entry) => ({
            id: entry.id,
            label: entry.title,
          }))
        : TRANSFER_PLANNER_TRACKS.map((entry) => ({
            id: entry.id,
            label: `${entry.code} | ${entry.title}`,
            description: stripGeneratedProgramMapSummarySentence(entry.summary),
          })),
    [campusMajors, isUwPlanner]
  );
  const hasNoDirectMajorEquivalencies = useMemo(
    () => isUwPlanner && !!plan && !hasAnyDirectMajorEquivalencies(plan),
    [isUwPlanner, plan]
  );
  const handleReportBug = useCallback(async () => {
    const reportLog = buildCoursePlannerBugReportLog({
      user,
      selectedCollegeLabel,
      selectedCampusLabel,
      selectedMajorLabel,
      selectedCollegeId,
      selectedCampusId: effectiveSelectedCampusId,
      selectedMajorId: effectiveSelectedMajorId,
      plannerPathKey,
      selectedPathwayId,
      selectedPathwayLabel: plan?.selectedPathwayLabel ?? null,
      activeDegreeTitle,
      plan,
      track,
      transcriptDocument: activeTranscriptDocument,
      transcriptError,
      parserVersion: TRANSCRIPT_PARSER_VERSION,
      storedParserVersion: storedTranscriptParserVersion,
      storedTranscriptSource,
      shouldUseDetailedCompletedCourses,
      needsTranscriptReparse,
      completedCourses,
      transcriptDerivedCompletedCourses,
      currentPlannedCourseLabels,
      onlyUwEssentialClasses,
      allowSummerClasses,
      allowStemPrepClasses,
      isHydrated,
      isPlannerComputationReady,
      isPlannerComputationLoading,
      hasStructuredPlannerData,
      hasNoDirectMajorEquivalencies,
      applicationStatuses,
      beforeEnrollmentStatuses,
      stayAtGrcStatuses,
      suggestedQuarterPlan,
      studentEvaluationReport,
      lastTranscriptDebug: transcriptPlannerDebugService.getLastTranscriptPlannerDebug(),
      recentTranscriptDebugEvents: transcriptPlannerDebugService.getRecentTranscriptPlannerEvents(),
    });

    try {
      const composed = await coursePlannerReportService.composeBugReportEmail({
        recipient: SUPPORT_EMAIL,
        subject: reportBugEmailSubject,
        body: reportBugEmailBody,
        reportText: reportLog,
      });

      if (composed.status === "composed") {
        return;
      }
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "app",
        operation: "compose-course-planner-bug-report",
        severity: "warn",
        handled: true,
        source: "TransferPlannerPage",
        screen: "TransferPlannerPage",
        route: ROUTES.transferPlanner,
        tags: ["transfer-planner", "bug-report", "email"],
      });
    }

    if (Platform.OS === "web") {
      const copiedReportLog = await copyCoursePlannerReportLogOnWeb(reportLog);
      const webMailtoUrl = buildCoursePlannerBugReportMailtoUrl(
        reportBugEmailSubject,
        buildWebCoursePlannerBugReportBody({ copiedReportLog })
      );

      if (openMailtoUrlOnWeb(webMailtoUrl)) {
        return;
      }

      Alert.alert(
        "Email unavailable",
        `We couldn't open your email app. Please email ${SUPPORT_EMAIL} to report the bug.`
      );
      return;
    }

    const fallbackLog =
      reportLog.length > 7000
        ? `${reportLog.slice(0, 7000)}\n\n[Course Planner log truncated because this email app does not support attachments here.]`
        : reportLog;
    const fallbackBody = `${reportBugEmailBody}\n\nCourse Planner log:\n${fallbackLog}`;
    const fallbackMailtoUrl = buildCoursePlannerBugReportMailtoUrl(
      reportBugEmailSubject,
      fallbackBody
    );

    try {
      const canOpen = await Linking.canOpenURL(fallbackMailtoUrl);
      if (!canOpen) {
        const canOpenPlainMailto = await Linking.canOpenURL(reportBugMailtoUrl).catch(() => false);
        if (canOpenPlainMailto) {
          await Linking.openURL(reportBugMailtoUrl);
          return;
        }

        Alert.alert(
          "Email unavailable",
          `We couldn't open your email app. Please email ${SUPPORT_EMAIL} to report the bug.`
        );
        return;
      }

      await Linking.openURL(fallbackMailtoUrl);
    } catch {
      Alert.alert(
        "Email unavailable",
        `We couldn't open your email app. Please email ${SUPPORT_EMAIL} to report the bug.`
      );
    }
  }, [
    activeDegreeTitle,
    allowStemPrepClasses,
    allowSummerClasses,
    applicationStatuses,
    beforeEnrollmentStatuses,
    completedCourses,
    currentPlannedCourseLabels,
    effectiveSelectedCampusId,
    effectiveSelectedMajorId,
    hasNoDirectMajorEquivalencies,
    hasStructuredPlannerData,
    isHydrated,
    isPlannerComputationLoading,
    isPlannerComputationReady,
    needsTranscriptReparse,
    onlyUwEssentialClasses,
    plan,
    plannerPathKey,
    reportBugEmailBody,
    reportBugEmailSubject,
    reportBugMailtoUrl,
    selectedCampusLabel,
    selectedCollegeId,
    selectedCollegeLabel,
    selectedMajorLabel,
    selectedPathwayId,
    shouldUseDetailedCompletedCourses,
    stayAtGrcStatuses,
    storedTranscriptParserVersion,
    storedTranscriptSource,
    studentEvaluationReport,
    suggestedQuarterPlan,
    track,
    transcriptDerivedCompletedCourses,
    activeTranscriptDocument,
    transcriptError,
    user,
  ]);

  if (!user) {
    return (
      <ScreenBackground includeTopInset includeBottomInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <StateCard
            variant="empty"
            title="Open this as a student profile first"
            message="Start as a guest or sign in, then come back here to build a transcript-based course plan."
          />
        </View>
      </ScreenBackground>
    );
  }

  if (isUwPlanner && !plan) {
    return (
      <ScreenBackground includeTopInset includeBottomInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <StateCard
            variant="empty"
            title="No planner data yet"
            message={getPlannerNoDataMessage(selectedCollegeId)}
          />
        </View>
      </ScreenBackground>
    );
  }

  if (!isUwPlanner && !selectedGrcTrack) {
    return (
      <ScreenBackground includeTopInset includeBottomInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <StateCard
            variant="empty"
            title="No planner data yet"
            message={getPlannerNoDataMessage(selectedCollegeId)}
          />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground includeTopInset includeBottomInset={false}>
        <ScrollView
          contentContainerStyle={{
            paddingBottom: scrollContentPadding.paddingBottom,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          onTouchStart={() => {
            selectorWasOpenOnTouchStartRef.current =
              openSelector !== null || isPathwaySelectorOpen;
            selectorTouchStartedInsideRef.current = false;
          }}
          onTouchEnd={() => {
            if (
              selectorWasOpenOnTouchStartRef.current &&
              !selectorTouchStartedInsideRef.current
            ) {
              setOpenSelector(null);
              setIsPathwaySelectorOpen(false);
            }
            selectorWasOpenOnTouchStartRef.current = false;
            selectorTouchStartedInsideRef.current = false;
          }}
          onScrollBeginDrag={() => {
            setOpenSelector(null);
            setIsPathwaySelectorOpen(false);
          }}
          scrollEnabled
        >
        <View
          style={{
            alignSelf: "center",
            width: "100%",
            maxWidth: shellMaxWidth,
            paddingHorizontal: shellHorizontalPadding,
            paddingTop: scrollContentPadding.paddingTop + 12,
            gap: 24,
            position: "relative",
          }}
        >
          <View className="gap-4">
            <AnimatedIconPressable
              onPress={handleGoBack}
              className="flex-row items-center"
              containerStyle={{ alignSelf: "flex-start" }}
            >
              <MaterialIcons
                name="arrow-back"
                size={20}
                color="#1f8a5d"
              />
              <Text className={`${secondaryTextClass} ml-2`}>
                {backLabel}
              </Text>
            </AnimatedIconPressable>

            <View className="flex-row items-start">
              <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
                <Ionicons name="trail-sign-outline" size={22} color="#008f4e" />
              </View>
              <View className="flex-1">
                <Text className={`${textClass} text-2xl font-semibold`}>
                  {plannerHeroContent.title}
                </Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  {plannerHeroContent.description}
                </Text>
              </View>
            </View>
          </View>

          <TranscriptSummaryCard
            collegeId={selectedCollegeId}
            transcriptDocument={activeTranscriptDocument}
            isAnalyzing={isAnalyzingTranscript}
            errorMessage={transcriptError}
            studentEvaluationReport={studentEvaluationReport}
            studentCourseEvaluations={studentCourseEvaluations}
            plan={plan}
            pathwayOptions={pathwayOptions}
            selectedPathwayLabel={plan?.selectedPathwayLabel ?? null}
            hasNoDirectMajorEquivalencies={hasNoDirectMajorEquivalencies}
            selectedCollegeId={selectedCollegeId}
            selectedCollegeLabel={selectedCollegeLabel}
            selectedCampusId={effectiveSelectedCampusId}
            selectedCampusLabel={selectedCampusLabel}
            selectedMajorId={effectiveSelectedMajorId}
            selectedMajorLabel={selectedMajorLabel}
            track={track}
            trackCode={activeTrackCode}
            trackTitle={activeTrackTitle}
            trackSummary={activeTrackSummary}
            trackOfficialLinkUrl={activeTrackOfficialLinkUrl}
            completedCourses={completedCourses}
            transcriptDerivedCompletedCourses={transcriptDerivedCompletedCourses}
            hasTranscriptDerivedCreditSource={shouldUseDetailedCompletedCourses}
            openSelector={openSelector}
            collegeOptions={collegeOptions}
            campusOptions={campusOptions}
            majorOptions={majorOptions}
            isPathwaySelectorOpen={isPathwaySelectorOpen}
            onToggleCollege={() =>
              {
                setIsPathwaySelectorOpen(false);
                setOpenSelector((current) => (current === "college" ? null : "college"));
              }
            }
            onToggleCampus={() =>
              {
                setIsPathwaySelectorOpen(false);
                setOpenSelector((current) => (current === "campus" ? null : "campus"));
              }
            }
            onToggleMajor={() =>
              {
                setIsPathwaySelectorOpen(false);
                setOpenSelector((current) => (current === "major" ? null : "major"));
              }
            }
            onTogglePathway={() => {
              setOpenSelector(null);
              setIsPathwaySelectorOpen((current) => !current);
            }}
            onSelectorTouchStartInside={() => {
              selectorTouchStartedInsideRef.current = true;
            }}
            onDismissCampus={() =>
              setOpenSelector((current) => (current === "campus" ? null : current))
            }
            onDismissMajor={() =>
              setOpenSelector((current) => (current === "major" ? null : current))
            }
            onDismissCollege={() =>
              setOpenSelector((current) => (current === "college" ? null : current))
            }
            onSelectCollege={(id) => {
              setSelectedCollegeId(id === "grc" ? "grc" : "uw");
              setIsPathwaySelectorOpen(false);
              setOpenSelector(null);
            }}
            onSelectCampus={(id) => {
              setSelectedCampusId(
                id === GRC_PLANNER_CAMPUS_ID ? GRC_PLANNER_CAMPUS_ID : (id as TransferPlannerCampusId)
              );
              setIsPathwaySelectorOpen(false);
              setOpenSelector(null);
            }}
            onSelectMajor={(id) => {
              setSelectedMajorId(id);
              setIsPathwaySelectorOpen(false);
              setOpenSelector(null);
            }}
            onSelectPathway={(pathwayId) => {
              setIsPathwaySelectorOpen(false);
              handleSelectPathway(pathwayId);
            }}
            onUpload={handlePickTranscript}
            onOpenTranscriptLink={() => {
              void openExternalLink(CTCLINK_UNOFFICIAL_TRANSCRIPT_URL);
            }}
            onRemoveTranscript={handleRemoveTranscript}
            isDesktop={isDesktop}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            cardClass={cardBgClass}
            borderClass={borderClass}
            dropdownBackgroundColor={dropdownSurfaceColor}
          />

          {isUwPlanner && hasNoDirectMajorEquivalencies ? (
            <View className={`${cardBgClass} border rounded-[28px] p-5`}>
              <Text className={`${textClass} text-lg font-semibold`}>
                No class equivalencies for {plan?.title ?? selectedMajorLabel}
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-2`}>
                There are no class equivalencies for this major right now.
              </Text>
              {plan && isOpenAdmissionMajor(plan) ? (
                <Text className={`${secondaryTextClass} text-sm mt-2`}>
                  This is an open major. You would transfer through general UW admission first, then
                  declare {plan.title} through the department&apos;s current process after you enroll.
                </Text>
              ) : null}
            </View>
          ) : null}

          {!hasStructuredPlannerData && !(isUwPlanner && hasNoDirectMajorEquivalencies) ? (
            <View className={`${cardBgClass} border rounded-[28px] p-5`}>
              <Text className={`${textClass} text-lg font-semibold`}>
                Quarter plan note
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                {isUwPlanner
                  ? "This degree does not have a fixed quarter-by-quarter plan yet. Use the Green River class list and source-backed class-order notes above as your starting point. This planner only shows a source-backed plan, and unsupported majors, rules, or sequences stay hidden until public sources can verify them."
                  : `This ${selectedGrcTrackRequirementNoun} does not have a fixed quarter-by-quarter plan yet. Use the tracked Green River ${selectedGrcTrackRequirementNoun} classes above as your starting point while more source-backed sequencing data is added.`}
              </Text>
            </View>
          ) : null}

          {hasStructuredPlannerData ? (
            <>
              {isPlannerComputationLoading ? (
                <View className={`${cardBgClass} border rounded-[28px] p-5`}>
                  <View className="flex-row items-center">
                    <ActivityIndicator color="#008f4e" />
                    <View className="ml-3 flex-1">
                      <Text className={`${textClass} text-lg font-semibold`}>
                        Building your planner
                      </Text>
                      <Text className={`${secondaryTextClass} text-sm mt-1`}>
                        Loading the selected requirements, matching Green River courses, and then building the quarter plan.
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <SuggestedScheduleCard
                  key={plannerPathKey}
                  quarters={suggestedQuarterPlan}
                  plan={isUwPlanner ? plan : null}
                  collegeId={selectedCollegeId}
                  plannerPathKey={plannerPathKey}
                  degreeTitle={activeDegreeTitle}
                  grcTrack={track}
                  campusLabel={selectedCampusLabel}
                  selectedCampusId={isUwPlanner ? plan?.campusId ?? null : null}
                  selectedMajorId={isUwPlanner ? plan?.id ?? null : null}
                  selectedPathwayId={isUwPlanner ? plan?.selectedPathwayId ?? null : null}
                  onlyUwEssentialClasses={onlyUwEssentialClasses}
                  showOnlyUwEssentialClassesToggle={shouldShowUwOnlyToggle}
                  onToggleOnlyUwEssentialClasses={() =>
                    setOnlyUwEssentialClasses((current) => !current)
                  }
                  allowSummerClasses={allowSummerClasses}
                  onToggleAllowSummerClasses={() =>
                    setAllowSummerClasses((current) => !current)
                  }
                  allowStemPrepClasses={allowStemPrepClasses}
                  onToggleAllowStemPrepClasses={() =>
                    setAllowStemPrepClasses((current) => !current)
                  }
                  completedCourses={completedCourses}
                  currentCourseSelections={currentPlannedCourseSet}
                  onToggleCurrentCourse={handleToggleCurrentCourse}
                  selectedRequirementOptionIdsByGroup={selectedRequirementOptionIdsByGroup}
                  onSelectRequirementOption={handleSelectRequirementOption}
                  textClass={textClass}
                  secondaryTextClass={secondaryTextClass}
                  cardClass={cardBgClass}
                  borderClass={borderClass}
                />
              )}
            </>
          ) : null}

          <View className="items-center pb-2">
            <AnimatedIconPressable
              onPress={() => {
                void handleReportBug();
              }}
              accessibilityRole="link"
              className="flex-row items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3"
            >
              <Text className="text-sm font-semibold text-emerald-600 underline">
                Click here to report a bug in Course Planner
              </Text>
            </AnimatedIconPressable>
          </View>

        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
