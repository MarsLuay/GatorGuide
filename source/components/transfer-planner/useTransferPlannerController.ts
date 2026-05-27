import { useCallback, useMemo } from "react";
import { useWindowDimensions } from "react-native";

import { ROUTES } from "@/constants/routes";
import {
  TRANSFER_PLANNER_CAMPUSES,
  TRANSFER_PLANNER_TRACKS,
} from "@/constants/transfer-planner-source/student-runtime";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import useBack from "@/hooks/use-back";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";

import {
  getCollegeOptionLabel,
  getGrcTrackRequirementNoun,
  getPlannerHeroContent,
  stripGeneratedProgramMapSummarySentence,
} from "./transfer-planner-copy";
import {
  CTCLINK_UNOFFICIAL_TRANSCRIPT_URL,
  openExternalLink,
} from "./transfer-planner-linking";
import { GRC_PLANNER_CAMPUS_ID } from "./transfer-planner-storage";
import { useCoursePlannerBugReport } from "./useCoursePlannerBugReport";
import { usePlannerComputation } from "./usePlannerComputation";
import { usePlannerSelectionState } from "./usePlannerSelectionState";
import { useTranscriptPlannerState } from "./useTranscriptPlannerState";
import {
  isTransferPlannerDemoMode,
  useTransferPlannerDemoReview,
} from "./useTransferPlannerDemoReview";

export function useTransferPlannerController() {
  const handleGoBack = useBack(ROUTES.tabsResources);
  const { t } = useAppLanguage();
  const styles = useThemeStyles();
  const { width } = useWindowDimensions();
  const { isHydrated, state, patchUserLocally, updateUser, setQuestionnaireAnswers } = useAppData();
  const { getScrollContentPadding } = useResponsiveLayout();

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
  const selection = usePlannerSelectionState({
    includeAllUwMajors: isTransferPlannerDemoMode,
    isHydrated,
    questionnaireAnswers: state.questionnaireAnswers,
    setQuestionnaireAnswers,
    userMajor: user?.major,
  });
  const transcript = useTranscriptPlannerState({
    user,
    questionnaireAnswers: state.questionnaireAnswers,
    patchUserLocally,
    updateUser,
    setQuestionnaireAnswers,
  });

  const backLabel = useMemo(() => {
    const translated = t("general.back");
    return translated && translated !== "general.back" ? translated : "Back";
  }, [t]);
  const plannerHeroContent = useMemo(
    () => getPlannerHeroContent(selection.selectedCollegeId, t),
    [selection.selectedCollegeId, t]
  );
  const selectedCollegeLabel = useMemo(
    () => getCollegeOptionLabel(selection.selectedCollegeId, t),
    [selection.selectedCollegeId, t]
  );
  const selectedCampusLabel = useMemo(
    () => (selection.isUwPlanner ? selection.campus?.title ?? "UW Seattle" : t("transferEquivalencies.greenRiverCollege")),
    [selection.campus?.title, selection.isUwPlanner, t]
  );
  const selectedMajorLabel = useMemo(() => {
    if (!selection.isUwPlanner) {
      return selection.selectedGrcTrack
        ? `${selection.selectedGrcTrack.code} | ${selection.selectedGrcTrack.title}`
        : t("transferPlanner.selectProgram");
    }

    return selection.plan?.title ?? selection.selectedBasePlan?.title ?? t("transferPlanner.selectMajor");
  }, [
    selection.isUwPlanner,
    selection.plan?.title,
    selection.selectedBasePlan?.title,
    selection.selectedGrcTrack,
    t,
  ]);
  const selectedGrcTrackRequirementNoun = useMemo(
    () => getGrcTrackRequirementNoun(selection.selectedGrcTrack, t),
    [selection.selectedGrcTrack, t]
  );
  const activeDegreeTitle = useMemo(() => {
    if (!selection.isUwPlanner) {
      return selection.selectedGrcTrack?.title ?? t("transferPlanner.selectedGrcProgram");
    }

    return selection.plan?.selectedPathwayLabel
      ? `${selection.plan.title} (${selection.plan.selectedPathwayLabel})`
      : selection.plan?.title ?? t("transferPlanner.selectedUwDegree");
  }, [selection.isUwPlanner, selection.plan, selection.selectedGrcTrack, t]);
  const activeTrackCode = selection.track?.code ?? null;
  const activeTrackTitle = useMemo(
    () =>
      selection.track?.title ??
      (selection.isUwPlanner
        ? t("transferPlanner.customGrcPath")
        : selection.selectedGrcTrack?.title ?? t("transferPlanner.selectedGrcProgram")),
    [selection.isUwPlanner, selection.selectedGrcTrack, selection.track, t]
  );
  const activeTrackSummary = useMemo(
    () =>
      selection.isUwPlanner
        ? selection.plan?.recommendedTrackSummary ?? ""
        : selection.track?.summary ?? "",
    [selection.isUwPlanner, selection.plan?.recommendedTrackSummary, selection.track]
  );
  const activeTrackOfficialLinkUrl = useMemo(
    () =>
      selection.track?.officialLinks?.find((entry) => String(entry?.url ?? "").trim())?.url ??
      null,
    [selection.track]
  );

  const computation = usePlannerComputation({
    isUwPlanner: selection.isUwPlanner,
    selectedCollegeId: selection.selectedCollegeId,
    plan: selection.plan,
    track: selection.track,
    campusLabel: selectedCampusLabel,
    completedCourses: transcript.completedCourses,
    currentPlannedCourseLabels: selection.currentPlannedCourseLabels,
    selectedRequirementOptionIdsByGroup: selection.selectedRequirementOptionIdsByGroup,
  });
  const demoReview = useTransferPlannerDemoReview(selection.plan?.id ?? null);

  const collegeOptions = useMemo(
    () => [
      {
        id: "uw",
        label: getCollegeOptionLabel("uw", t),
      },
      {
        id: "grc",
        label: getCollegeOptionLabel("grc", t),
      },
    ],
    [t]
  );
  const campusOptions = useMemo(
    () =>
      selection.isUwPlanner
        ? TRANSFER_PLANNER_CAMPUSES.map((entry) => ({
            id: entry.id,
            label: entry.title,
          }))
        : [
            {
              id: GRC_PLANNER_CAMPUS_ID,
              label: t("transferEquivalencies.greenRiverCollege"),
            },
          ],
    [selection.isUwPlanner, t]
  );
  const majorOptions = useMemo(
    () =>
      selection.isUwPlanner
        ? selection.campusMajors.map((entry) => ({
            id: entry.id,
            label: entry.title,
          }))
        : TRANSFER_PLANNER_TRACKS.map((entry) => ({
            id: entry.id,
            label: `${entry.code} | ${entry.title}`,
            description: stripGeneratedProgramMapSummarySentence(entry.summary),
          })),
    [selection.campusMajors, selection.isUwPlanner]
  );

  const handleOpenTranscriptLink = useCallback(() => {
    void openExternalLink(CTCLINK_UNOFFICIAL_TRANSCRIPT_URL);
  }, []);

  const { handleReportBug } = useCoursePlannerBugReport({
    user,
    selectedCollegeLabel,
    selectedCampusLabel,
    selectedMajorLabel,
    selectedCollegeId: selection.selectedCollegeId,
    effectiveSelectedCampusId: selection.effectiveSelectedCampusId,
    effectiveSelectedMajorId: selection.effectiveSelectedMajorId,
    plannerPathKey: selection.plannerPathKey,
    selectedPathwayId: selection.selectedPathwayId,
    selectedPathwayLabel: selection.plan?.selectedPathwayLabel ?? null,
    activeDegreeTitle,
    plan: selection.plan,
    track: selection.track,
    transcriptDocument: transcript.activeTranscriptDocument,
    transcriptError: transcript.transcriptError,
    storedTranscriptParserVersion: transcript.storedTranscriptParserVersion,
    storedTranscriptSource: transcript.storedTranscriptSource,
    shouldUseDetailedCompletedCourses: transcript.shouldUseDetailedCompletedCourses,
    needsTranscriptReparse: transcript.needsTranscriptReparse,
    completedCourses: transcript.completedCourses,
    transcriptDerivedCompletedCourses: transcript.transcriptDerivedCompletedCourses,
    currentPlannedCourseLabels: selection.currentPlannedCourseLabels,
    onlyUwEssentialClasses: computation.onlyUwEssentialClasses,
    allowSummerClasses: computation.allowSummerClasses,
    allowStemPrepClasses: computation.allowStemPrepClasses,
    isHydrated,
    isPlannerComputationReady: computation.isPlannerComputationReady,
    isPlannerComputationLoading: computation.isPlannerComputationLoading,
    hasStructuredPlannerData: computation.hasStructuredPlannerData,
    hasNoDirectMajorEquivalencies: computation.hasNoDirectMajorEquivalencies,
    applicationStatuses: computation.applicationStatuses,
    beforeEnrollmentStatuses: computation.beforeEnrollmentStatuses,
    stayAtGrcStatuses: computation.stayAtGrcStatuses,
    suggestedQuarterPlan: computation.suggestedQuarterPlan,
    studentEvaluationReport: computation.studentEvaluationReport,
  });

  return {
    handleGoBack,
    backLabel,
    textClass,
    secondaryTextClass,
    cardBgClass,
    borderClass,
    dropdownSurfaceColor,
    isDesktop,
    shellMaxWidth,
    shellHorizontalPadding,
    scrollContentPadding,
    user,
    selectedCollegeId: selection.selectedCollegeId,
    openSelector: selection.openSelector,
    isPathwaySelectorOpen: selection.isPathwaySelectorOpen,
    handlePlannerTouchStart: selection.handlePlannerTouchStart,
    handlePlannerTouchEnd: selection.handlePlannerTouchEnd,
    handlePlannerScrollBeginDrag: selection.handlePlannerScrollBeginDrag,
    handleSelectorTouchStartInside: selection.handleSelectorTouchStartInside,
    handleToggleCollegeSelector: selection.handleToggleCollegeSelector,
    handleToggleCampusSelector: selection.handleToggleCampusSelector,
    handleToggleMajorSelector: selection.handleToggleMajorSelector,
    handleTogglePathwaySelector: selection.handleTogglePathwaySelector,
    handleDismissCollegeSelector: selection.handleDismissCollegeSelector,
    handleDismissCampusSelector: selection.handleDismissCampusSelector,
    handleDismissMajorSelector: selection.handleDismissMajorSelector,
    handleSelectCollege: selection.handleSelectCollege,
    handleSelectCampus: selection.handleSelectCampus,
    handleSelectMajor: selection.handleSelectMajor,
    handleSelectPathwayAndClose: selection.handleSelectPathwayAndClose,
    handleOpenTranscriptLink,
    isUwPlanner: selection.isUwPlanner,
    plan: selection.plan,
    selectedGrcTrack: selection.selectedGrcTrack,
    selectedGrcTrackRequirementNoun,
    activeTranscriptDocument: transcript.activeTranscriptDocument,
    isAnalyzingTranscript: transcript.isAnalyzingTranscript,
    transcriptError: transcript.transcriptError,
    studentEvaluationReport: computation.studentEvaluationReport,
    studentCourseEvaluations: computation.studentCourseEvaluations,
    pathwayOptions: selection.pathwayOptions,
    hasNoDirectMajorEquivalencies: computation.hasNoDirectMajorEquivalencies,
    selectedCollegeLabel,
    effectiveSelectedCampusId: selection.effectiveSelectedCampusId,
    selectedCampusLabel,
    effectiveSelectedMajorId: selection.effectiveSelectedMajorId,
    selectedMajorLabel,
    track: selection.track,
    activeTrackCode,
    activeTrackTitle,
    activeTrackSummary,
    activeTrackOfficialLinkUrl,
    completedCourses: transcript.completedCourses,
    transcriptDerivedCompletedCourses: transcript.transcriptDerivedCompletedCourses,
    shouldUseDetailedCompletedCourses: transcript.shouldUseDetailedCompletedCourses,
    collegeOptions,
    campusOptions,
    majorOptions,
    handlePickTranscript: transcript.handlePickTranscript,
    handleRemoveTranscript: transcript.handleRemoveTranscript,
    hasStructuredPlannerData: computation.hasStructuredPlannerData,
    isPlannerComputationLoading: computation.isPlannerComputationLoading,
    suggestedQuarterPlan: computation.suggestedQuarterPlan,
    plannerPathKey: selection.plannerPathKey,
    activeDegreeTitle,
    onlyUwEssentialClasses: computation.onlyUwEssentialClasses,
    shouldShowUwOnlyToggle: computation.shouldShowUwOnlyToggle,
    allowSummerClasses: computation.allowSummerClasses,
    handleToggleAllowSummerClasses: computation.handleToggleAllowSummerClasses,
    allowStemPrepClasses: computation.allowStemPrepClasses,
    handleToggleAllowStemPrepClasses: computation.handleToggleAllowStemPrepClasses,
    currentPlannedCourseSet: selection.currentPlannedCourseSet,
    handleToggleCurrentCourse: selection.handleToggleCurrentCourse,
    selectedRequirementOptionIdsByGroup: selection.selectedRequirementOptionIdsByGroup,
    handleSelectRequirementOption: selection.handleSelectRequirementOption,
    handleReportBug,
    demoReview,
    plannerHeroContent,
    handleToggleOnlyUwEssentialClasses: computation.handleToggleOnlyUwEssentialClasses,
  };
}
