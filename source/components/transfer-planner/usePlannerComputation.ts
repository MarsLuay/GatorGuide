import { useCallback, useEffect, useMemo, useState } from "react";
import { InteractionManager } from "react-native";

import type {
  TransferPlannerResolvedMajorPlan,
  TransferPlannerTrack,
} from "@/constants/transfer-planner-source/student-runtime";
import {
  buildRequirementStatuses,
  buildSuggestedQuarterPlan,
  buildTransferPlannerStudentCourseEvaluations,
  buildTransferPlannerStudentEvaluationReport,
  type TranscriptCourseEntry,
} from "@/services/planning/transfer-planner.service";

import { getCollegeOptionLabel } from "./transfer-planner-copy";
import { hasAnyDirectMajorEquivalencies } from "./transfer-planner-major-specifics-formatters";
import type { PlannerCollegeId } from "./transfer-planner-storage";

type UsePlannerComputationInput = {
  isUwPlanner: boolean;
  selectedCollegeId: PlannerCollegeId;
  plan: TransferPlannerResolvedMajorPlan | null;
  track: TransferPlannerTrack | null;
  campusLabel: string;
  completedCourses: TranscriptCourseEntry[];
  currentPlannedCourseLabels: string[];
  selectedRequirementOptionIdsByGroup: Record<string, string[]>;
};

export function usePlannerComputation({
  isUwPlanner,
  selectedCollegeId,
  plan,
  track,
  campusLabel,
  completedCourses,
  currentPlannedCourseLabels,
  selectedRequirementOptionIdsByGroup,
}: UsePlannerComputationInput) {
  const [onlyUwEssentialClasses, setOnlyUwEssentialClasses] = useState(true);
  const [allowSummerClasses, setAllowSummerClasses] = useState(false);
  const [allowStemPrepClasses, setAllowStemPrepClasses] = useState(true);

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
        plan?.campusId ?? "",
        plan?.id ?? "",
        plan?.selectedPathwayId ?? "",
        track?.id ?? "",
        completedCoursesKey,
      ].join("||"),
    [
      completedCoursesKey,
      plan?.campusId,
      plan?.id,
      plan?.selectedPathwayId,
      selectedCollegeId,
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
            campusLabel: campusLabel || getCollegeOptionLabel(selectedCollegeId),
            completedCourses,
            evaluations: studentCourseEvaluations,
            suggestedQuarterPlan,
          })
        : null,
    [
      campusLabel,
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
  const hasNoDirectMajorEquivalencies = useMemo(
    () => isUwPlanner && !!plan && !hasAnyDirectMajorEquivalencies(plan),
    [isUwPlanner, plan]
  );

  const handleToggleOnlyUwEssentialClasses = useCallback(() => {
    setOnlyUwEssentialClasses((current) => !current);
  }, []);
  const handleToggleAllowSummerClasses = useCallback(() => {
    setAllowSummerClasses((current) => !current);
  }, []);
  const handleToggleAllowStemPrepClasses = useCallback(() => {
    setAllowStemPrepClasses((current) => !current);
  }, []);

  return {
    onlyUwEssentialClasses,
    shouldShowUwOnlyToggle,
    allowSummerClasses,
    allowStemPrepClasses,
    isPlannerComputationReady,
    isPlannerComputationLoading,
    applicationStatuses,
    beforeEnrollmentStatuses,
    stayAtGrcStatuses,
    suggestedQuarterPlan,
    studentCourseEvaluations,
    studentEvaluationReport,
    hasStructuredPlannerData,
    hasNoDirectMajorEquivalencies,
    handleToggleOnlyUwEssentialClasses,
    handleToggleAllowSummerClasses,
    handleToggleAllowStemPrepClasses,
  };
}
