import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { TouchCard, TouchOptionRow } from "@/components/ui/TouchPrimitives";
import {
  getTransferPlannerPrimaryDegreeRequirementsSource,
  type TransferPlannerResolvedMajorPlan,
  type TransferPlannerTrack,
} from "@/constants/transfer-planner-source/student-runtime";
import { useAppLanguage } from "@/hooks/use-app-language";
import {
  buildMajorSpecificsCourseSections,
  buildUwGeneralTransferRequirementSection,
  countMatchedGrcTrackGeneralEducationBreadthRows,
  type TranscriptCourseEntry,
} from "@/services/planning/transfer-planner.service";

import {
  buildCopyOnlyGenEdSourceDebugText,
  buildMajorSpecificsGrcGeneralEducationCreditLines,
  buildMajorSpecificsGrcRequiredMajorCourseLines,
  buildMajorSpecificsSourceBackedUwGeneralEducationSection,
  buildUwCoursesConsideredEntries,
  COPY_ONLY_OPTION_STATUS_TEXT_STYLE,
  openExternalLink,
} from "./transfer-planner-formatters";

export function MajorSpecificsSection({
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
  const { t } = useAppLanguage();
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [isGrcClassesOpen, setIsGrcClassesOpen] = useState(false);
  const [isUwClassesOpen, setIsUwClassesOpen] = useState(false);
  const [isUwCoursesConsideredOpen, setIsUwCoursesConsideredOpen] = useState(false);
  const [openDegreeSpecificSectionIds, setOpenDegreeSpecificSectionIds] = useState<
    Record<string, boolean>
  >({});
  const degreeMapSections = plan.degreeMapSections ?? [];
  const grcGeneralEducationCreditLines = useMemo(
    () =>
      isReferenceOpen && isGrcClassesOpen
        ? buildMajorSpecificsGrcGeneralEducationCreditLines({
            plan,
            track,
            completedCourses,
            t,
          })
        : [],
    [completedCourses, isGrcClassesOpen, isReferenceOpen, plan, t, track]
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
        ? buildMajorSpecificsSourceBackedUwGeneralEducationSection(plan, t)
        : null,
    [isReferenceOpen, isUwClassesOpen, plan, t]
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
      ? t("transferPlanner.majorSpecificsSummaryWithOfficialAndSections")
      : t("transferPlanner.majorSpecificsSummaryWithOfficial")
    : degreeMapSections.length
      ? t("transferPlanner.majorSpecificsSummaryWithSections")
      : t("transferPlanner.majorSpecificsSummaryFallback");
  const grcTrackTitle = String(track?.title ?? "").trim() || plan.title;
  const grcTrackDescription = track
    ? t("transferPlanner.grcTrackDescription", { title: grcTrackTitle })
    : t("transferPlanner.grcClassListForMajor");
  const toggleDegreeSpecificSection = (sectionId: string) => {
    setOpenDegreeSpecificSectionIds((currentValue) => ({
      ...currentValue,
      [sectionId]: !currentValue[sectionId],
    }));
  };

  return (
    <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
      <TouchOptionRow
        onPress={() => setIsReferenceOpen((currentValue) => !currentValue)}
        expanded={isReferenceOpen}
        accessibilityLabel={t("transferPlanner.majorSpecifics")}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>
              {t("transferPlanner.majorSpecifics")}
            </Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              {t("transferPlanner.sourceBackedSummary", { summary: majorSpecificsSummaryText })}
            </Text>
          </View>
          <Ionicons
            name={isReferenceOpen ? "chevron-up" : "chevron-down"}
            size={20}
            color="#9CA3AF"
          />
        </View>
      </TouchOptionRow>

      {isReferenceOpen ? (
        <>
          {primaryUwDegreeLink ? (
            <View className="mt-5 gap-4">
              <Text className={`${textClass} text-base font-semibold`}>
                {t("transferPlanner.officialUwDegreePage")}
              </Text>
              <Text className={`${secondaryTextClass} text-sm`}>
                {t("transferPlanner.officialUwDegreePageDescription")}
              </Text>
              <TouchCard
                onPress={() => void openExternalLink(primaryUwDegreeLink.url)}
                accessibilityRole="link"
                accessibilityLabel={t("general.openNamed", { name: primaryUwDegreeLink.label })}
                className={`border ${borderClass} rounded-2xl px-4 py-4`}
              >
                <Text className="text-emerald-500 font-semibold">
                  {primaryUwDegreeLink.label}
                </Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  {primaryUwDegreeLink.url}
                </Text>
              </TouchCard>
            </View>
          ) : null}

          {degreeMapSections.length ? (
            <View className="mt-5 gap-4">
              <Text className={`${textClass} text-base font-semibold`}>
                {t("transferPlanner.degreeSpecifics")}
              </Text>
              <Text className={`${secondaryTextClass} text-sm`}>
                {selectedPathwayLabel
                  ? t("transferPlanner.degreeSpecificsSelectedPathway", {
                      pathway: selectedPathwayLabel,
                    })
                  : t("transferPlanner.degreeSpecificsDefault")}
              </Text>
              {degreeMapSections.map((section) => {
                const isDegreeSpecificSectionOpen =
                  openDegreeSpecificSectionIds[section.id] ?? false;

                return (
                <View key={section.id} className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                  <TouchOptionRow
                    onPress={() => toggleDegreeSpecificSection(section.id)}
                    expanded={isDegreeSpecificSectionOpen}
                    accessibilityLabel={t("transferPlanner.parsedOfficialSourceRequirements", {
                      title: section.title,
                    })}
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 min-w-0">
                        <Text className={`${textClass} font-semibold`}>{section.title}</Text>
                        <Text className={`${secondaryTextClass} text-xs mt-1`}>
                          {t("transferPlanner.parsedOfficialRequirementCount", {
                            count: section.items.length,
                            noun:
                              section.items.length === 1
                                ? t("transferPlanner.requirementSingular")
                                : t("transferPlanner.requirementPlural"),
                          })}
                        </Text>
                  {section.note ? (
                    <Text className={`${secondaryTextClass} text-sm mt-1`}>
                      {section.note}
                    </Text>
                  ) : null}
                      </View>
                      <Ionicons
                        name={isDegreeSpecificSectionOpen ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#9CA3AF"
                      />
                    </View>
                  </TouchOptionRow>

                  {isDegreeSpecificSectionOpen ? (
                  <View className="mt-3 gap-2">
                    {section.items.map((item) => (
                      <View key={`${section.id}-${item}`} className="flex-row items-start gap-2">
                        <Text className={`${secondaryTextClass} text-sm`}>{"-"}</Text>
                        <Text className={`${secondaryTextClass} flex-1 text-sm`}>{item}</Text>
                      </View>
                    ))}
                  </View>
                  ) : null}
                </View>
                );
              })}
            </View>
          ) : null}

          <View className="mt-5 gap-4">
            <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
              <TouchOptionRow
                onPress={() => setIsGrcClassesOpen((currentValue) => !currentValue)}
                expanded={isGrcClassesOpen}
                accessibilityLabel={t("transferPlanner.grcClassesTitle", {
                  title: grcTrackTitle,
                  suffix: t("transferPlanner.degreeClasses"),
                })}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 min-w-0">
                    <Text className={`${textClass} text-base font-semibold`}>
                      {t("transferPlanner.grcClassesTitle", {
                        title: grcTrackTitle,
                        suffix: t("transferPlanner.degreeClasses"),
                      })}
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
              </TouchOptionRow>

              {isGrcClassesOpen ? (
                <View className="mt-4 gap-4">
                  <View>
                    <Text className={`${textClass} text-sm font-semibold`}>
                      {t("transferPlanner.genEdCourses")}
                    </Text>
                    {grcGeneralEducationCreditLines.length ? (
                      <View className="mt-2 gap-2">
                        {grcGeneralEducationCreditLines.map((entry) => (
                          <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                            {`${entry.label}: ${t("transferPlanner.creditsCount", {
                              count: entry.credits,
                            })}`}
                          </Text>
                        ))}
                      </View>
                    ) : (
                      <Text className={`${secondaryTextClass} text-sm mt-2`}>
                        {t("transferPlanner.noGrcTrackGenEdTargets")}
                      </Text>
                    )}
                  </View>

                  <View>
                    <Text className={`${textClass} text-sm font-semibold`}>
                      {t("transferPlanner.requiredMajorCourses")}
                    </Text>
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
                        {t("transferPlanner.noGrcTrackMajorCourseList")}
                      </Text>
                    )}
                  </View>
                </View>
              ) : null}
            </View>

            <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
              <TouchOptionRow
                onPress={() => setIsUwClassesOpen((currentValue) => !currentValue)}
                expanded={isUwClassesOpen}
                accessibilityLabel={t("transferPlanner.uwDegreeClassesTitle", {
                  title: plan.title,
                })}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 min-w-0">
                    <Text className={`${textClass} text-base font-semibold`}>
                      {t("transferPlanner.uwDegreeClassesTitle", { title: plan.title })}
                    </Text>
                    <Text className={`${secondaryTextClass} text-sm mt-1`}>
                      {majorSpecificsCourseRowCount
                        ? t("transferPlanner.uwDegreeClassesDescriptionReady")
                        : t("transferPlanner.uwDegreeClassesDescriptionFallback")}
                    </Text>
                  </View>
                  <Ionicons
                    name={isUwClassesOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#9CA3AF"
                  />
                </View>
              </TouchOptionRow>

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
                      {t("transferPlanner.noSourceBackedGenEdTargets")}
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
                      <Text className={`${textClass} text-sm font-semibold`}>
                        {t("transferPlanner.officialUwRequiredCourses")}
                      </Text>
                      <Text className={`${secondaryTextClass} text-sm mt-2`}>
                        {t("transferPlanner.noSourceBackedUwRequiredPath")}
                      </Text>
                    </View>
                  )}

                  <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                    <TouchOptionRow
                      onPress={() =>
                        setIsUwCoursesConsideredOpen((currentValue) => !currentValue)
                      }
                      expanded={isUwCoursesConsideredOpen}
                      accessibilityLabel={t("transferPlanner.uwCoursesConsidered")}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1 min-w-0">
                          <Text className={`${textClass} text-sm font-semibold`}>
                            {t("transferPlanner.uwCoursesConsidered")}
                          </Text>
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>
                            {t("transferPlanner.uwCoursesConsideredDescription")}
                          </Text>
                        </View>
                        <Ionicons
                          name={isUwCoursesConsideredOpen ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#9CA3AF"
                        />
                      </View>
                    </TouchOptionRow>

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
                            {t("transferPlanner.noParsedUwCourseList")}
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
