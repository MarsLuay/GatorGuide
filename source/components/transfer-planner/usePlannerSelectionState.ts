import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager } from "react-native";

import {
  TRANSFER_PLANNER_CURRENT_COURSES_BY_PATH_FIELD,
  TRANSFER_PLANNER_LAST_SELECTED_PLAN_FIELD,
  TRANSFER_PLANNER_SELECTED_OPTIONS_BY_PATH_FIELD,
  TRANSFER_PLANNER_SELECTED_PATHWAY_BY_PLAN_FIELD,
} from "@/constants/planner-storage";
import {
  getTransferPlannerStudentRuntimeMajorsForCampus,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  getTransferPlannerTrack,
  resolveTransferPlannerStudentRuntimeMajorPlan,
  TRANSFER_PLANNER_CAMPUSES,
  TRANSFER_PLANNER_TRACKS,
  type TransferPlannerCampusId,
  type TransferPlannerMajorPlan,
} from "@/constants/transfer-planner-source/student-runtime";
import type { QuestionnaireAnswers } from "@/hooks/use-app-data";

import {
  getNextSuggestedScheduleToggleSelectionIds,
  getSuggestedScheduleUniqueOptionIds,
} from "./transfer-planner-suggested-schedule";
import { hasAnyDirectMajorEquivalenciesInPlanOrPathways } from "./transfer-planner-major-specifics-formatters";
import {
  GRC_PLANNER_CAMPUS_ID,
  getDefaultPlannerCampusId,
  getPlannerPathKey,
  isPlannerUwCampusId,
  normalizePlannerCurrentCourseMap,
  normalizePlannerLastSelectedPlan,
  normalizePlannerSelectedOptionsMap,
  normalizePlannerSelectedPathwayMap,
  type PlannerCampusSelectionId,
  type PlannerCollegeId,
  type PlannerSelectorKey,
} from "./transfer-planner-storage";

type SetQuestionnaireAnswers = (
  answers:
    | QuestionnaireAnswers
    | ((currentAnswers: QuestionnaireAnswers) => QuestionnaireAnswers)
) => Promise<void>;

type UsePlannerSelectionStateInput = {
  isHydrated: boolean;
  questionnaireAnswers: QuestionnaireAnswers;
  setQuestionnaireAnswers: SetQuestionnaireAnswers;
  userMajor?: string | null;
  includeAllUwMajors?: boolean;
};

const SELECTABLE_UW_MAJOR_PLANS_BY_CACHE_KEY = new Map<string, TransferPlannerMajorPlan[]>();

function getSelectableUwMajorPlansForCampus(
  campusId: TransferPlannerCampusId,
  options: { includeAllUwMajors?: boolean } = {}
) {
  const cacheKey = `${campusId}:${options.includeAllUwMajors ? "all" : "matched"}`;
  const cachedMajors = SELECTABLE_UW_MAJOR_PLANS_BY_CACHE_KEY.get(cacheKey);
  if (cachedMajors) {
    return cachedMajors;
  }

  const runtimeMajors = getTransferPlannerStudentRuntimeMajorsForCampus(campusId);
  const majors = options.includeAllUwMajors
    ? runtimeMajors
    : runtimeMajors.filter((plan) =>
        hasAnyDirectMajorEquivalenciesInPlanOrPathways(
          plan,
          getTransferPlannerStudentRuntimePathwaysForPlan(plan)
        )
      );
  SELECTABLE_UW_MAJOR_PLANS_BY_CACHE_KEY.set(cacheKey, majors);
  return majors;
}

export function usePlannerSelectionState({
  isHydrated,
  questionnaireAnswers,
  setQuestionnaireAnswers,
  userMajor,
  includeAllUwMajors = false,
}: UsePlannerSelectionStateInput) {
  const [selectedCollegeId, setSelectedCollegeId] = useState<PlannerCollegeId>("uw");
  const [selectedCampusId, setSelectedCampusId] =
    useState<PlannerCampusSelectionId>("uw-seattle");
  const [selectedMajorId, setSelectedMajorId] = useState<string>(
    getSelectableUwMajorPlansForCampus("uw-seattle", { includeAllUwMajors })[0]?.id ?? ""
  );
  const [openSelector, setOpenSelector] = useState<PlannerSelectorKey>(null);
  const [isPathwaySelectorOpen, setIsPathwaySelectorOpen] = useState(false);

  const autoMajorSelectionRef = useRef(false);
  const hydratedLastSelectionRef = useRef(false);
  const selectorWasOpenOnTouchStartRef = useRef(false);
  const selectorTouchStartedInsideRef = useRef(false);

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
      isUwPlanner
        ? getSelectableUwMajorPlansForCampus(selectedUwCampusId, { includeAllUwMajors })
        : [],
    [includeAllUwMajors, isUwPlanner, selectedUwCampusId]
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
        questionnaireAnswers[TRANSFER_PLANNER_SELECTED_PATHWAY_BY_PLAN_FIELD]
      ),
    [questionnaireAnswers]
  );
  const storedLastSelectedPlan = useMemo(
    () =>
      normalizePlannerLastSelectedPlan(
        questionnaireAnswers[TRANSFER_PLANNER_LAST_SELECTED_PLAN_FIELD]
      ),
    [questionnaireAnswers]
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
    () =>
      getPlannerPathKey(
        effectiveSelectedCampusId,
        plan?.id ?? effectiveSelectedMajorId,
        selectedPathwayId
      ),
    [effectiveSelectedCampusId, effectiveSelectedMajorId, plan?.id, selectedPathwayId]
  );
  const currentCourseSelectionsByPath = useMemo(
    () =>
      normalizePlannerCurrentCourseMap(
        questionnaireAnswers[TRANSFER_PLANNER_CURRENT_COURSES_BY_PATH_FIELD]
      ),
    [questionnaireAnswers]
  );
  const selectedOptionsByPath = useMemo(
    () =>
      normalizePlannerSelectedOptionsMap(
        questionnaireAnswers[TRANSFER_PLANNER_SELECTED_OPTIONS_BY_PATH_FIELD]
      ),
    [questionnaireAnswers]
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

  useEffect(() => {
    if (!isUwPlanner || openSelector !== "campus") return;

    let cancelled = false;
    let cancelScheduledWork = () => {};
    const campusIdsToWarm = TRANSFER_PLANNER_CAMPUSES.map((entry) => entry.id).filter(
      (campusId) => campusId !== selectedUwCampusId
    );
    let campusIndex = 0;
    let scheduleNextCampus = () => {};

    const preloadNextCampus = () => {
      if (cancelled) return;

      const campusId = campusIdsToWarm[campusIndex];
      campusIndex += 1;
      if (campusId) {
        getSelectableUwMajorPlansForCampus(campusId, { includeAllUwMajors });
      }

      if (campusIndex < campusIdsToWarm.length) {
        scheduleNextCampus();
      }
    };

    scheduleNextCampus = () => {
      if (typeof requestAnimationFrame === "function") {
        const frame = requestAnimationFrame(preloadNextCampus);
        cancelScheduledWork = () => cancelAnimationFrame(frame);
        return;
      }

      const timeout = setTimeout(preloadNextCampus, 0);
      cancelScheduledWork = () => clearTimeout(timeout);
    };

    const task = InteractionManager.runAfterInteractions(scheduleNextCampus);

    return () => {
      cancelled = true;
      cancelScheduledWork();
      task.cancel?.();
    };
  }, [includeAllUwMajors, isUwPlanner, openSelector, selectedUwCampusId]);

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

    const nextMajors = getSelectableUwMajorPlansForCampus(matchedCampus.id, {
      includeAllUwMajors,
    });
    const matchedMajor = nextMajors.find((entry) => entry.id === storedLastSelectedPlan.majorId);
    if (!matchedMajor) return;

    autoMajorSelectionRef.current = true;
    setSelectedCollegeId("uw");
    setSelectedCampusId(matchedCampus.id);
    setSelectedMajorId(matchedMajor.id);
  }, [includeAllUwMajors, isHydrated, storedLastSelectedPlan]);

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
    const rawMajor = String(userMajor ?? "").trim().toLowerCase();
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
        : campusMajors.find(
            (entry) =>
              entry.title.toLowerCase().includes(rawMajor) ||
              rawMajor.includes(entry.shortTitle.toLowerCase()) ||
              rawMajor.includes(entry.title.toLowerCase())
          );

    if (!matchedMajor) return;
    autoMajorSelectionRef.current = true;
    setSelectedMajorId(matchedMajor.id);
  }, [campusMajors, selectedCollegeId, userMajor]);

  useEffect(() => {
    if (!isHydrated || !selectedMajorId) return;
    if (selectedCollegeId === "uw" && !isPlannerUwCampusId(selectedCampusId)) return;
    if (selectedCollegeId === "grc" && selectedCampusId !== GRC_PLANNER_CAMPUS_ID) return;
    if (
      selectedCollegeId === "uw" &&
      !campusMajors.some((entry) => entry.id === effectiveSelectedMajorId)
    ) {
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
      [TRANSFER_PLANNER_LAST_SELECTED_PLAN_FIELD]: {
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
    storedLastSelectedPlan,
  ]);

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
        [TRANSFER_PLANNER_CURRENT_COURSES_BY_PATH_FIELD]: nextSelectionMap,
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
          currentAnswers[TRANSFER_PLANNER_SELECTED_OPTIONS_BY_PATH_FIELD]
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
        const nextGroupSelections = getNextSuggestedScheduleToggleSelectionIds({
          optionId: normalizedOptionId,
          selectionCount: normalizedSelectionCount,
          displayedOptionIds: displayedGroupSelections,
          storedOptionIds: storedGroupSelections,
          hasStoredSelection: hasStoredGroupSelection,
        });
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
          [TRANSFER_PLANNER_SELECTED_OPTIONS_BY_PATH_FIELD]: nextSelectionMap,
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
        [TRANSFER_PLANNER_SELECTED_PATHWAY_BY_PLAN_FIELD]: nextSelectionMap,
      }));
    },
    [selectedBasePlan, selectedPathwayByPlan, setQuestionnaireAnswers]
  );

  const handlePlannerTouchStart = useCallback(() => {
    selectorWasOpenOnTouchStartRef.current =
      openSelector !== null || isPathwaySelectorOpen;
    selectorTouchStartedInsideRef.current = false;
  }, [isPathwaySelectorOpen, openSelector]);
  const handlePlannerTouchEnd = useCallback(() => {
    if (
      selectorWasOpenOnTouchStartRef.current &&
      !selectorTouchStartedInsideRef.current
    ) {
      setOpenSelector(null);
      setIsPathwaySelectorOpen(false);
    }
    selectorWasOpenOnTouchStartRef.current = false;
    selectorTouchStartedInsideRef.current = false;
  }, []);
  const handlePlannerScrollBeginDrag = useCallback(() => {
    setOpenSelector(null);
    setIsPathwaySelectorOpen(false);
  }, []);
  const handleSelectorTouchStartInside = useCallback(() => {
    selectorTouchStartedInsideRef.current = true;
  }, []);
  const handleToggleCollegeSelector = useCallback(() => {
    setIsPathwaySelectorOpen(false);
    setOpenSelector((current) => (current === "college" ? null : "college"));
  }, []);
  const handleToggleCampusSelector = useCallback(() => {
    setIsPathwaySelectorOpen(false);
    setOpenSelector((current) => (current === "campus" ? null : "campus"));
  }, []);
  const handleToggleMajorSelector = useCallback(() => {
    setIsPathwaySelectorOpen(false);
    setOpenSelector((current) => (current === "major" ? null : "major"));
  }, []);
  const handleTogglePathwaySelector = useCallback(() => {
    setOpenSelector(null);
    setIsPathwaySelectorOpen((current) => !current);
  }, []);
  const handleDismissCollegeSelector = useCallback(() => {
    setOpenSelector((current) => (current === "college" ? null : current));
  }, []);
  const handleDismissCampusSelector = useCallback(() => {
    setOpenSelector((current) => (current === "campus" ? null : current));
  }, []);
  const handleDismissMajorSelector = useCallback(() => {
    setOpenSelector((current) => (current === "major" ? null : current));
  }, []);
  const handleSelectCollege = useCallback((id: string) => {
    setSelectedCollegeId(id === "grc" ? "grc" : "uw");
    setIsPathwaySelectorOpen(false);
    setOpenSelector(null);
  }, []);
  const handleSelectCampus = useCallback((id: string) => {
    setSelectedCampusId(
      id === GRC_PLANNER_CAMPUS_ID ? GRC_PLANNER_CAMPUS_ID : (id as TransferPlannerCampusId)
    );
    setIsPathwaySelectorOpen(false);
    setOpenSelector(null);
  }, []);
  const handleSelectMajor = useCallback((id: string) => {
    setSelectedMajorId(id);
    setIsPathwaySelectorOpen(false);
    setOpenSelector(null);
  }, []);
  const handleSelectPathwayAndClose = useCallback(
    (pathwayId: string) => {
      setIsPathwaySelectorOpen(false);
      void handleSelectPathway(pathwayId);
    },
    [handleSelectPathway]
  );

  return {
    selectedCollegeId,
    selectedCampusId,
    selectedMajorId,
    openSelector,
    isPathwaySelectorOpen,
    isUwPlanner,
    selectedUwCampusId,
    effectiveSelectedCampusId,
    campus,
    campusMajors,
    selectedBasePlan,
    selectedGrcTrack,
    effectiveSelectedMajorId,
    pathwayOptions,
    selectedPathwayId,
    plan,
    track,
    plannerPathKey,
    currentPlannedCourseLabels,
    currentPlannedCourseSet,
    selectedRequirementOptionIdsByGroup,
    handlePlannerTouchStart,
    handlePlannerTouchEnd,
    handlePlannerScrollBeginDrag,
    handleSelectorTouchStartInside,
    handleToggleCollegeSelector,
    handleToggleCampusSelector,
    handleToggleMajorSelector,
    handleTogglePathwaySelector,
    handleDismissCollegeSelector,
    handleDismissCampusSelector,
    handleDismissMajorSelector,
    handleSelectCollege,
    handleSelectCampus,
    handleSelectMajor,
    handleSelectPathwayAndClose,
    handleToggleCurrentCourse,
    handleSelectRequirementOption,
  };
}
