import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { AnimatedIconPressable } from "@/components/ui/AnimatedPressables";
import { ROUTES } from "@/constants/routes";
import {
  type TransferPlannerCampusId,
  type TransferPlannerResolvedMajorPlan,
  type TransferPlannerTrack,
} from "@/constants/transfer-planner-source/student-runtime";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  auditCategoryOptionDetection,
  auditCategoryTranscriptSatisfaction,
  auditCompoundEquivalencyPaths,
  auditComputerEngineeringCreditBuckets,
  auditCountedCourses,
  auditInvalidScheduledOptions,
  auditOptionAllocation,
  auditOptionCredits,
  auditOptionGroupSatisfaction,
  auditOptionSelectionSources,
  auditOptionTitleFallback,
  auditRequiredMappedCourseCoverage,
  auditRequirementClassification,
  auditRequirementRolePrecedence,
  auditSbseCreditTotals,
  auditSbseCurrentVsOldSource,
  auditSbseScheduledRowSources,
  auditSourceRowBoundaries,
  auditSourceScope,
  auditTrueOptionDetection,
  auditUwBioengineeringSourceBackedRequirements,
  buildSuggestedQuarterCourseOptionGroupsForTrack,
  buildSuggestedQuarterRemainingCreditRange,
  type SuggestedQuarterPlan,
  type TranscriptCourseEntry,
} from "@/services/planning/transfer-planner.service";

import {
  buildStableSuggestedScheduleOptionGroupIds,
  buildSuggestedScheduleCopyOnlyOptionBoxSummaryText,
  buildSuggestedScheduleCopyOnlyOptionDropdownHeaderText,
  buildSuggestedScheduleCopyOnlyOptionGroupVisibilityText,
  buildSuggestedScheduleCopyOnlyOptionStatusText,
  buildSuggestedScheduleCopyOnlySelectedOptionStateText,
  buildSuggestedScheduleCopyOnlyToggleStatusText,
  buildSuggestedScheduleCreditRangeQuarters,
  buildSuggestedScheduleRenderedQuarters,
  buildUwTransferMinimumRequirementSummary,
  collectSuggestedScheduleOptionGroups,
  COPY_ONLY_OPTION_STATUS_TEXT_STYLE,
  formatSuggestedScheduleCreditRange,
  getGrcTrackRequirementNoun,
  getScheduleCampusLabel,
  getSchedulePlaceholderRequirementLinkData,
  getSuggestedScheduleCredentialLabel,
  getSuggestedScheduleOptionCompletedTranscriptSatisfierText,
  getSuggestedScheduleOptionCourseDetailText,
  getSuggestedScheduleOptionCreditRange,
  getSuggestedScheduleOptionDisplayLabel,
  getSuggestedScheduleOptionGroupDisplayTitle,
  getSuggestedScheduleOptionGroupInteractionSelectionCount,
  getSuggestedScheduleOptionGroupProgressText,
  getSuggestedScheduleOptionGroupSelectionTargetText,
  getSuggestedScheduleOptionGroupStatusVerb,
  getSuggestedScheduleOptionGroupTranscriptSatisfierText,
  getSuggestedScheduleOptionSatisfiedBy,
  getSuggestedScheduleResolvedOptionIds,
  getSuggestedScheduleSelectedOptionLabels,
  getSuggestedScheduleSelectedOptions,
  getSuggestedScheduleCourseDisplayLabel,
  isSuggestedScheduleCategoryOption,
  isSuggestedScheduleGeneratedOptionSummary,
  mergeSuggestedScheduleOptionGroups,
  openExternalLink,
  orderSuggestedScheduleOptionGroupsByStableIds,
  removeGuidanceSummaryPrefixes,
  type SuggestedScheduleOptionGroup,
} from "./transfer-planner-formatters";
import type { PlannerCollegeId } from "./transfer-planner-storage";

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
        const interactionSelectionCount =
          getSuggestedScheduleOptionGroupInteractionSelectionCount(optionGroup);
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
        const optionGroupProgressText =
          getSuggestedScheduleOptionGroupProgressText(optionGroup);
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
                          interactionSelectionCount,
                          optionGroup.selectedOptionIds
                        )
                      }
                      accessibilityRole={interactionSelectionCount === 1 ? "radio" : "checkbox"}
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
                            ? interactionSelectionCount === 1
                              ? "radio-button-on"
                              : "checkbox"
                            : interactionSelectionCount === 1
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

export function SuggestedScheduleCard({
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

