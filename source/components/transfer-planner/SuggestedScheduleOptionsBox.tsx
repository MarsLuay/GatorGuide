import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import { TouchOptionRow } from "@/components/ui/TouchPrimitives";
import type { TransferPlannerResolvedMajorPlan } from "@/constants/transfer-planner-source/student-runtime";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppTheme } from "@/hooks/use-app-theme";
import { auditOptionTitleFallback } from "@/services/planning/transfer-planner.service";

import {
  buildSuggestedScheduleCopyOnlyOptionDropdownHeaderText,
  buildSuggestedScheduleCopyOnlyOptionGroupVisibilityText,
  buildSuggestedScheduleCopyOnlyOptionStatusText,
  buildSuggestedScheduleCopyOnlySelectedOptionStateText,
  COPY_ONLY_OPTION_STATUS_TEXT_STYLE,
  formatSuggestedScheduleCreditRange,
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
  getSuggestedScheduleOptionIdsForToggle,
  getSuggestedScheduleResolvedOptionIds,
  getSuggestedScheduleSelectedOptionLabels,
  getSuggestedScheduleVisibleOptions,
  isSuggestedScheduleCategoryOption,
  type SuggestedScheduleOptionGroup,
} from "./transfer-planner-suggested-schedule";

export function SuggestedScheduleOptionsBox({
  optionGroups,
  plan,
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
  plan: TransferPlannerResolvedMajorPlan | null;
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
  const { t } = useAppLanguage();
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
          {t("suggestedSchedule.choosePlanOptions")}
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
        const visibleOptions = getSuggestedScheduleVisibleOptions(optionGroup);
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
          plan,
        });
        const optionGroupStatusVerb =
          getSuggestedScheduleOptionGroupStatusVerb(optionGroup, t);
        const optionGroupStatusText = selectedOptionLabels.length
          ? `${optionGroupStatusVerb}: ${selectedOptionLabels.join(", ")}`
          : getSuggestedScheduleOptionGroupSelectionTargetText(optionGroup, t);
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
            <TouchOptionRow
              onPress={() => toggleOptionGroup(optionGroup.id)}
              expanded={isOptionGroupOpen}
              accessibilityLabel={t(
                isOptionGroupOpen
                  ? "suggestedSchedule.closeOptionsFor"
                  : "suggestedSchedule.openOptionsFor",
                { title: optionGroupDisplayTitle }
              )}
              className={`rounded-xl border px-3 py-3 flex-row items-center justify-between gap-3 ${
                isLight
                  ? "bg-white border-emerald-500/30"
                  : "bg-emerald-500/10 border-emerald-500/20"
              }`}
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
            </TouchOptionRow>

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
                {visibleOptions.map((option) => {
                  const isSelected = selectedOptionIdSet.has(option.id);
                  const optionCreditRange = getSuggestedScheduleOptionCreditRange(option);
                  const hasCreditRange =
                    optionCreditRange.creditMin > 0 && optionCreditRange.creditMax > 0;
                  const optionDisplayLabel = getSuggestedScheduleOptionDisplayLabel(option);
                  const optionCourseDetailText =
                    getSuggestedScheduleOptionCourseDetailText(option);
                  const optionTranscriptSatisfierText =
                    getSuggestedScheduleOptionCompletedTranscriptSatisfierText(
                      optionGroup,
                      option.id
                    );

                  return (
                    <TouchOptionRow
                      key={option.id}
                      onPress={() =>
                        onSelectRequirementOption(
                          optionGroup.id,
                          option.id,
                          interactionSelectionCount,
                          getSuggestedScheduleOptionIdsForToggle(optionGroup, option.id)
                        )
                      }
                      accessibilityRole={interactionSelectionCount === 1 ? "radio" : "checkbox"}
                      checked={isSelected}
                      accessibilityLabel={optionDisplayLabel}
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
                        {isSelected &&
                        isSuggestedScheduleCategoryOption(option) &&
                        optionTranscriptSatisfierText ? (
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>
                            {t("suggestedSchedule.satisfiedByCompletedTranscriptCourse", {
                              course: optionTranscriptSatisfierText,
                            })}
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
                          {formatSuggestedScheduleCreditRange(optionCreditRange, t)}
                        </Text>
                      ) : null}
                    </TouchOptionRow>
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
