import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { TouchOptionRow } from "@/components/ui/TouchPrimitives";
import { ROUTES } from "@/constants/routes";
import type { TransferPlannerCampusId } from "@/constants/transfer-planner-source/student-runtime";
import { useAppLanguage } from "@/hooks/use-app-language";
import {
  canMarkSuggestedQuarterCourseCurrent,
  extractCourseCodes,
  normalizeCourseCode,
  type SuggestedQuarterPlan,
} from "@/services/planning/transfer-planner.service";

import {
  getSchedulePlaceholderRequirementLinkData,
  getSuggestedScheduleCourseDisplayLabel,
  getSuggestedScheduleOptionCompletedTranscriptSatisfiers,
  getSuggestedScheduleOptionGroupSelectionTargetText,
  getSuggestedScheduleOptionSatisfactionSources,
  getSuggestedScheduleResolvedOptionIds,
  getSuggestedScheduleSelectedOptionLabels,
  getSuggestedScheduleSelectedOptions,
  isSuggestedScheduleGeneratedOptionSummary,
  removeGuidanceSummaryPrefixes,
  shouldShowSuggestedScheduleOptionGroup,
} from "./transfer-planner-suggested-schedule";
import type { PlannerCollegeId } from "./transfer-planner-storage";

type SuggestedScheduleCourse = SuggestedQuarterPlan["courses"][number];

function isCompletedTranscriptSatisfierForOptionGroup(
  course: SuggestedScheduleCourse,
  optionGroup: NonNullable<SuggestedScheduleCourse["optionGroup"]>
) {
  if (course.status !== "completed") {
    return false;
  }

  const extractedCourseCodes = extractCourseCodes(course.label);
  const courseCodes = new Set(
    (extractedCourseCodes.length ? extractedCourseCodes : [course.label])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );

  if (!courseCodes.size) {
    return false;
  }

  return getSuggestedScheduleResolvedOptionIds(optionGroup).some((optionId) => {
    const sources = getSuggestedScheduleOptionSatisfactionSources(optionGroup, optionId);
    if (!sources.includes("transcript-completed")) {
      return false;
    }

    return getSuggestedScheduleOptionCompletedTranscriptSatisfiers(
      optionGroup,
      optionId
    ).some((courseCode) => courseCodes.has(normalizeCourseCode(courseCode)));
  });
}

export function getSuggestedScheduleCourseSelectionState(
  course: SuggestedScheduleCourse,
  currentCourseSelections: ReadonlySet<string>
) {
  const courseSelectionKey = String(course.instanceKey ?? course.label).trim();
  return {
    courseSelectionKey,
    isCurrentCourseSelected:
      currentCourseSelections.has(courseSelectionKey) ||
      currentCourseSelections.has(course.label),
    shouldShowCurrentCourseCheckbox: canMarkSuggestedQuarterCourseCurrent(course),
  };
}

export function SuggestedScheduleCourseRow({
  course,
  quarterLabel,
  courseIndex,
  collegeId,
  selectedCampusId,
  selectedMajorId,
  selectedPathwayId,
  currentCourseSelections,
  onToggleCurrentCourse,
  scheduleOptionDisplayTitleById,
  plannedCourseContainerClass,
  textClass,
  secondaryTextClass,
}: {
  course: SuggestedScheduleCourse;
  quarterLabel: string;
  courseIndex: number;
  collegeId: PlannerCollegeId;
  selectedCampusId: TransferPlannerCampusId | null;
  selectedMajorId: string | null;
  selectedPathwayId: string | null;
  currentCourseSelections: ReadonlySet<string>;
  onToggleCurrentCourse: (courseKey: string, fallbackCourseLabel?: string) => void;
  scheduleOptionDisplayTitleById: ReadonlyMap<string, string>;
  plannedCourseContainerClass: string;
  textClass: string;
  secondaryTextClass: string;
}) {
  const router = useRouter();
  const { t } = useAppLanguage();
  const courseDisplayLabel = getSuggestedScheduleCourseDisplayLabel(course.label);
  const {
    courseSelectionKey,
    isCurrentCourseSelected,
    shouldShowCurrentCourseCheckbox,
  } = getSuggestedScheduleCourseSelectionState(course, currentCourseSelections);
  const rawOptionGroup = course.optionGroup ?? null;
  const optionGroup = shouldShowSuggestedScheduleOptionGroup(rawOptionGroup)
    ? rawOptionGroup
    : null;
  const shouldRenderAsStandardCourse =
    optionGroup && isCompletedTranscriptSatisfierForOptionGroup(course, optionGroup);
  const optionGroupReferenceLabel = optionGroup
    ? scheduleOptionDisplayTitleById.get(optionGroup.id) ?? optionGroup.title
    : null;
  const selectedOptionLabels = optionGroup
    ? getSuggestedScheduleSelectedOptionLabels(optionGroup)
    : [];
  const requirementChoiceFlavorText =
    optionGroup && selectedOptionLabels.length && optionGroupReferenceLabel
      ? t("suggestedSchedule.selectedInRequirementChoice", {
          choice: optionGroupReferenceLabel,
        })
      : null;

  const isCoreVisual =
    course.type === "core" ||
    (collegeId === "grc" && String(course.sourceKind ?? "").startsWith("official-grc"));
  const grcProgramRequirementFlavorText =
    collegeId === "grc" &&
    String(course.sourceKind ?? "").startsWith("official-grc")
      ? t("suggestedSchedule.requiredForGrcProgram")
      : null;
  const courseCardKey = `${quarterLabel}-${courseSelectionKey || course.label}-${courseIndex}`;
  const courseCardClassName = `px-3 py-3 rounded-2xl ${
    course.status === "completed"
      ? "bg-emerald-500/10 border border-emerald-500/20"
      : course.status === "current"
        ? "bg-sky-500/10 border border-sky-500/20"
        : isCoreVisual
          ? "bg-emerald-500/10 border border-emerald-500/20"
          : plannedCourseContainerClass
  }`;
  const courseCardContent = (
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
            if (optionGroup && !shouldRenderAsStandardCourse) {
              const selectedOptions = getSuggestedScheduleSelectedOptions(optionGroup);
              const optionGroupDisplayLabel =
                optionGroup.isSelectionPrompt
                  ? scheduleOptionDisplayTitleById.get(optionGroup.id) ??
                    optionGroup.title
                  : courseDisplayLabel;
              const rawOptionGroupGuidanceSummary = removeGuidanceSummaryPrefixes(
                course.guidanceSummary,
                selectedOptions.map((option) => option.guidanceSummary)
              );
              const optionGroupGuidanceSummary =
                isSuggestedScheduleGeneratedOptionSummary(rawOptionGroupGuidanceSummary)
                  ? null
                  : rawOptionGroupGuidanceSummary;

              return (
                <View className="gap-1">
                  <Text className={courseTextClass}>{optionGroupDisplayLabel}</Text>
                  <Text className={`${secondaryTextClass} text-xs`}>
                    {requirementChoiceFlavorText
                      ? requirementChoiceFlavorText
                      : getSuggestedScheduleOptionGroupSelectionTargetText(optionGroup, t)}
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
              return <Text className={courseTextClass}>{courseDisplayLabel}</Text>;
            }
            const params: Record<string, string> = {
              collegeId,
              campusId: linkCampusId,
            };
            if (linkData.tags && linkData.tags.length) {
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
                onPress={(event) => {
                  event.stopPropagation();
                  router.push({
                    pathname: ROUTES.transferEquivalencies,
                    params: {
                      ...params,
                      returnTo: ROUTES.transferPlanner,
                    },
                  });
                }}
              >
                {courseDisplayLabel}
              </Text>
            );
          })()}
          {shouldRenderAsStandardCourse && requirementChoiceFlavorText ? (
            <Text className={`${secondaryTextClass} text-xs mt-1`}>
              {requirementChoiceFlavorText}
            </Text>
          ) : null}
          {(!optionGroup || shouldRenderAsStandardCourse) && grcProgramRequirementFlavorText ? (
            <Text className={`${secondaryTextClass} text-xs mt-1`}>
              {grcProgramRequirementFlavorText}
            </Text>
          ) : null}
          {(!optionGroup || shouldRenderAsStandardCourse) && course.guidanceSummary ? (
            <Text className={`${secondaryTextClass} text-xs mt-1`}>
              {course.guidanceSummary}
            </Text>
          ) : null}
        </View>
      </View>
      {shouldShowCurrentCourseCheckbox ? (
        <Ionicons
          name={isCurrentCourseSelected ? "checkbox" : "square-outline"}
          size={20}
          color={isCurrentCourseSelected ? "#008f4e" : "#9CA3AF"}
          style={{ marginTop: 1 }}
        />
      ) : null}
    </View>
  );

  return shouldShowCurrentCourseCheckbox ? (
    <TouchOptionRow
      key={courseCardKey}
      onPress={() => onToggleCurrentCourse(courseSelectionKey, course.label)}
      accessibilityRole="checkbox"
      checked={isCurrentCourseSelected}
      accessibilityLabel={t("suggestedSchedule.markCurrentCourse", {
        course: courseDisplayLabel,
      })}
      className={courseCardClassName}
    >
      {courseCardContent}
    </TouchOptionRow>
  ) : (
    <View key={courseCardKey} className={courseCardClassName}>
      {courseCardContent}
    </View>
  );
}
