import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { AnimatedCardPressable } from "@/components/ui/AnimatedPressables";
import {
  getTransferPlannerPrimaryDegreeRequirementsSource,
  type TransferPlannerResolvedMajorPlan,
  type TransferPlannerTrack,
} from "@/constants/transfer-planner-source/student-runtime";
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
