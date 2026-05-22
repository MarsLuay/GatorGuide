import { useCallback, useMemo } from "react";
import { Alert, Linking, Platform } from "react-native";

import { ROUTES } from "@/constants/routes";
import { SUPPORT_EMAIL } from "@/constants/support";
import type {
  TransferPlannerResolvedMajorPlan,
  TransferPlannerTrack,
} from "@/constants/transfer-planner-source/student-runtime";
import type { User } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { coursePlannerReportService } from "@/services/dev/course-planner-report.service";
import { transcriptPlannerDebugService } from "@/services/dev/transcript-planner-debug.service";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import { TRANSCRIPT_PARSER_VERSION } from "@/services/planning/transfer-planner-cache.service";
import type {
  SuggestedQuarterPlan,
  TranscriptCourseEntry,
  TransferPlannerStudentEvaluationReport,
  TransferRequirementStatus,
} from "@/services/planning/transfer-planner.service";

import {
  buildCoursePlannerBugReportLog,
  buildCoursePlannerBugReportMailtoUrl,
  buildWebCoursePlannerBugReportBody,
  copyCoursePlannerReportLogOnWeb,
  openMailtoUrlOnWeb,
} from "./transfer-planner-bug-report";
import type {
  PlannerCampusSelectionId,
  PlannerCollegeId,
  TranscriptDocument,
} from "./transfer-planner-storage";

type UseCoursePlannerBugReportInput = {
  user: User | null;
  selectedCollegeLabel: string;
  selectedCampusLabel: string;
  selectedMajorLabel: string;
  selectedCollegeId: PlannerCollegeId;
  effectiveSelectedCampusId: PlannerCampusSelectionId;
  effectiveSelectedMajorId: string;
  plannerPathKey: string;
  selectedPathwayId: string | null;
  selectedPathwayLabel: string | null;
  activeDegreeTitle: string;
  plan: TransferPlannerResolvedMajorPlan | null;
  track: TransferPlannerTrack | null;
  transcriptDocument: TranscriptDocument | null;
  transcriptError: string | null;
  storedTranscriptParserVersion: number | null;
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
};

export function useCoursePlannerBugReport({
  user,
  selectedCollegeLabel,
  selectedCampusLabel,
  selectedMajorLabel,
  selectedCollegeId,
  effectiveSelectedCampusId,
  effectiveSelectedMajorId,
  plannerPathKey,
  selectedPathwayId,
  selectedPathwayLabel,
  activeDegreeTitle,
  plan,
  track,
  transcriptDocument,
  transcriptError,
  storedTranscriptParserVersion,
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
}: UseCoursePlannerBugReportInput) {
  const { t } = useAppLanguage();
  const reportBugEmailSubject = t("transferPlanner.bugReportSubject");
  const reportBugEmailBody = t("transferPlanner.bugReportBody");
  const reportBugMailtoUrl = useMemo(
    () => buildCoursePlannerBugReportMailtoUrl(reportBugEmailSubject, reportBugEmailBody),
    [reportBugEmailBody, reportBugEmailSubject]
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
      selectedPathwayLabel,
      activeDegreeTitle,
      plan,
      track,
      transcriptDocument,
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
        t("transferPlanner.emailUnavailableTitle"),
        t("transferPlanner.emailUnavailableBody", { email: SUPPORT_EMAIL })
      );
      return;
    }

    const fallbackLog =
      reportLog.length > 7000
        ? `${reportLog.slice(0, 7000)}\n\n${t("transferPlanner.coursePlannerLogTruncated")}`
        : reportLog;
    const fallbackBody = `${reportBugEmailBody}\n\n${t("transferPlanner.coursePlannerLogLabel")}\n${fallbackLog}`;
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
          t("transferPlanner.emailUnavailableTitle"),
          t("transferPlanner.emailUnavailableBody", { email: SUPPORT_EMAIL })
        );
        return;
      }

      await Linking.openURL(fallbackMailtoUrl);
    } catch {
      Alert.alert(
        t("transferPlanner.emailUnavailableTitle"),
        t("transferPlanner.emailUnavailableBody", { email: SUPPORT_EMAIL })
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
    selectedPathwayLabel,
    shouldUseDetailedCompletedCourses,
    stayAtGrcStatuses,
    storedTranscriptParserVersion,
    storedTranscriptSource,
    studentEvaluationReport,
    suggestedQuarterPlan,
    t,
    track,
    transcriptDerivedCompletedCourses,
    transcriptDocument,
    transcriptError,
    user,
  ]);

  return { handleReportBug };
}
