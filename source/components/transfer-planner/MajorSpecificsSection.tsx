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
  buildMajorSpecificsGrcRequiredMajorCourseLines,
  buildMajorSpecificsSourceBackedUwGeneralEducationSection,
  buildUwCoursesConsideredEntries,
  COPY_ONLY_OPTION_STATUS_TEXT_STYLE,
  openExternalLink,
} from "./transfer-planner-formatters";

type DisplayDegreeLink = {
  label: string;
  url: string;
  note?: string;
};

type DegreeLinkInput = {
  label?: string | null;
  url?: string | null;
  note?: string | null;
  visibility?: "visible" | "hidden" | null;
};

function getDegreeLinkKey(url: string) {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function toDisplayDegreeLink(link: DegreeLinkInput | null | undefined) {
  const url = String(link?.url ?? "").trim();
  if (!url || link?.visibility === "hidden") return null;

  const label = String(link?.label ?? "").trim() || url;
  const note = String(link?.note ?? "").trim();
  return {
    label,
    url,
    ...(note ? { note } : {}),
  } satisfies DisplayDegreeLink;
}

function collectExtraDegreeLinks(
  officialLinks: DegreeLinkInput[],
  primaryLink: DisplayDegreeLink | null
) {
  const seenUrls = new Set<string>();
  if (primaryLink) {
    seenUrls.add(getDegreeLinkKey(primaryLink.url));
  }

  return officialLinks.flatMap((link) => {
    const displayLink = toDisplayDegreeLink(link);
    if (!displayLink) return [];

    const linkKey = getDegreeLinkKey(displayLink.url);
    if (seenUrls.has(linkKey)) return [];
    seenUrls.add(linkKey);
    return [displayLink];
  });
}

type MajorSpecificsCourseSectionModel = ReturnType<typeof buildMajorSpecificsCourseSections>[number];
type MajorSpecificsCourseRowModel = MajorSpecificsCourseSectionModel["rows"][number];
type DegreeCourseOptionGroupModel =
  NonNullable<TransferPlannerResolvedMajorPlan["requirementGroups"]>[number];
type DegreeCourseOptionModel = DegreeCourseOptionGroupModel["options"][number];

const USED_DEGREE_COURSE_SECTION_IDS = new Set<MajorSpecificsCourseSectionModel["id"]>([
  "official-uw-required-courses",
  "selected-uw-requirement-options",
]);
const DEGREE_COURSE_OPTION_REQUIREMENT_TYPES = new Set([
  "choose_one",
  "choose_n",
  "choose_credits",
  "sequence_choice",
]);

function uniqueNonEmptyStrings(values: (string | null | undefined)[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
    )
  );
}

function isUsedDegreeCourseRow(row: MajorSpecificsCourseRowModel) {
  return (
    USED_DEGREE_COURSE_SECTION_IDS.has(row.categoryId) &&
    row.requirementRole !== "alternative_option" &&
    row.requirementRole !== "restricted" &&
    row.requirementRole !== "replaced" &&
    (row.countsTowardUwRequirement ||
      row.selectedForRequirement ||
      row.requirementRole === "required" ||
      row.requirementRole === "selected_option")
  );
}

function collectUsedDegreeCourseSections(sections: MajorSpecificsCourseSectionModel[]) {
  return sections
    .map((section) => ({
      ...section,
      rows: section.rows.filter(isUsedDegreeCourseRow),
    }))
    .filter((section) => section.rows.length > 0);
}

function collectGrcDegreeMatchEntries(
  sections: MajorSpecificsCourseSectionModel[],
  grcRequiredMajorCourseLines: { id: string; text: string }[]
) {
  const entries: { id: string; text: string; alternativeOptionsText?: string | null }[] = [];
  const seenText = new Set<string>();
  const addEntry = (entry: {
    id: string;
    text: string;
    alternativeOptionsText?: string | null;
  }) => {
    const normalizedText = String(entry.text ?? "").replace(/\s+/g, " ").trim();
    if (!normalizedText || seenText.has(normalizedText)) return;
    seenText.add(normalizedText);
    entries.push(entry);
  };

  for (const entry of grcRequiredMajorCourseLines) {
    addEntry(entry);
  }

  for (const section of sections) {
    if (section.id !== "matched-green-river-track-courses") continue;
    for (const row of section.rows) {
      addEntry({
        id: row.id,
        text: row.text,
        alternativeOptionsText: row.alternativeOptionsText,
      });
    }
  }

  return entries;
}

function collectDegreeCourseOptionGroups(plan: TransferPlannerResolvedMajorPlan) {
  return (plan.requirementGroups ?? []).filter(
    (group) =>
      DEGREE_COURSE_OPTION_REQUIREMENT_TYPES.has(group.requirementType) &&
      group.options.length > 0
  );
}

function collectSelectedDegreeCourseOptionIds(plan: TransferPlannerResolvedMajorPlan) {
  const selectedIdsByGroup = new Map<string, Set<string>>();
  const checklistItems = [
    ...plan.applicationChecklist,
    ...plan.beforeEnrollmentChecklist,
    ...plan.stayAtGrcChecklist,
  ];

  for (const item of checklistItems) {
    const groupId = String(item.requirementGroup?.id ?? "").trim();
    if (!groupId) continue;

    const selectedIds = uniqueNonEmptyStrings(item.selectedRequirementOptionIds ?? []);
    if (!selectedIds.length) continue;

    const existingIds = selectedIdsByGroup.get(groupId) ?? new Set<string>();
    for (const optionId of selectedIds) {
      existingIds.add(optionId);
    }
    selectedIdsByGroup.set(groupId, existingIds);
  }

  return selectedIdsByGroup;
}

function getDegreeCourseOptionStateId(
  group: DegreeCourseOptionGroupModel,
  option: DegreeCourseOptionModel,
  optionIndex: number
) {
  return `${group.id}:${option.id ?? optionIndex}`;
}

function getDegreeCourseOptionTitle(option: DegreeCourseOptionModel) {
  return (
    uniqueNonEmptyStrings([
      ...(option.displayCourseCodes ?? []),
      ...(option.uwCourses ?? []),
      ...(option.equivalentUwCourseCodes ?? []),
      option.categoryOption?.title,
      option.label,
      option.title,
    ])[0] ?? ""
  );
}

function getDegreeCourseOptionCreditText(option: DegreeCourseOptionModel) {
  const creditText = String(option.creditText ?? "").trim();
  if (creditText) return creditText;
  if (option.creditMin != null && option.creditMax != null && option.creditMin !== option.creditMax) {
    return `${option.creditMin}-${option.creditMax}`;
  }
  const creditValue = option.credits ?? option.creditMin ?? option.creditMax;
  return creditValue != null ? String(creditValue) : "";
}

export function MajorSpecificsSection({
  plan,
  track,
  completedCourses,
  transcriptDerivedCompletedCourses,
  hasTranscriptDerivedCreditSource,
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
  const [isExtraUwDegreeLinksOpen, setIsExtraUwDegreeLinksOpen] = useState(false);
  const [isDegreeCoursesOpen, setIsDegreeCoursesOpen] = useState(false);
  const [isGenEdCoursesOpen, setIsGenEdCoursesOpen] = useState(false);
  const [isUsedDegreeCoursesOpen, setIsUsedDegreeCoursesOpen] = useState(false);
  const [isSourcesUsedOpen, setIsSourcesUsedOpen] = useState(false);
  const [isDegreeCourseOptionsOpen, setIsDegreeCourseOptionsOpen] = useState(false);
  const [openDegreeCourseOptionGroupIds, setOpenDegreeCourseOptionGroupIds] = useState<
    Record<string, boolean>
  >({});
  const [openDegreeCourseOptionIds, setOpenDegreeCourseOptionIds] = useState<
    Record<string, boolean>
  >({});
  const [isParsedCoursesOpen, setIsParsedCoursesOpen] = useState(false);
  const [isGrcDegreeMatchCoursesOpen, setIsGrcDegreeMatchCoursesOpen] = useState(false);
  const grcRequiredMajorCourseLines = useMemo(
    () =>
      isReferenceOpen && isGrcDegreeMatchCoursesOpen
        ? buildMajorSpecificsGrcRequiredMajorCourseLines({
            plan,
            track,
            completedCourses,
          })
        : [],
    [completedCourses, isGrcDegreeMatchCoursesOpen, isReferenceOpen, plan, track]
  );
  const sourceBackedUwGeneralEducationSection = useMemo(
    () =>
      isReferenceOpen && isDegreeCoursesOpen && isGenEdCoursesOpen
        ? buildMajorSpecificsSourceBackedUwGeneralEducationSection(plan, t)
        : null,
    [isDegreeCoursesOpen, isGenEdCoursesOpen, isReferenceOpen, plan, t]
  );
  const matchedGrcTrackBreadthRowsHiddenFromUwGenEdSection = useMemo(
    () =>
      isReferenceOpen && isDegreeCoursesOpen && isGenEdCoursesOpen
        ? countMatchedGrcTrackGeneralEducationBreadthRows({
            track,
            completedCourses,
            plan,
          })
        : 0,
    [completedCourses, isDegreeCoursesOpen, isGenEdCoursesOpen, isReferenceOpen, plan, track]
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
      isReferenceOpen && isDegreeCoursesOpen && isGenEdCoursesOpen
        ? buildUwGeneralTransferRequirementSection(plan, {
            completedCourses: transcriptDerivedCompletedCourses,
            hasTranscriptDerivedCreditSource,
          })
        : null,
    [
      hasTranscriptDerivedCreditSource,
      isDegreeCoursesOpen,
      isGenEdCoursesOpen,
      isReferenceOpen,
      plan,
      transcriptDerivedCompletedCourses,
    ]
  );
  const majorSpecificsCourseSections = useMemo(
    () =>
      isReferenceOpen
        ? buildMajorSpecificsCourseSections({ plan, track, completedCourses })
        : [],
    [completedCourses, isReferenceOpen, plan, track]
  );
  const genEdCourseSection =
    majorSpecificsCourseSections.find((section) => section.id === "gen-ed-breadth-requirements") ??
    null;
  const genEdCourseRowCount = genEdCourseSection?.rows.length ?? 0;
  const usedDegreeCourseSections = useMemo(
    () => collectUsedDegreeCourseSections(majorSpecificsCourseSections),
    [majorSpecificsCourseSections]
  );
  const usedDegreeCourseRowCount = usedDegreeCourseSections.reduce(
    (total, section) => total + section.rows.length,
    0
  );
  const uwCoursesConsideredEntries = useMemo(
    () => (isReferenceOpen ? buildUwCoursesConsideredEntries(plan) : []),
    [isReferenceOpen, plan]
  );
  const grcDegreeMatchEntries = useMemo(
    () => collectGrcDegreeMatchEntries(majorSpecificsCourseSections, grcRequiredMajorCourseLines),
    [grcRequiredMajorCourseLines, majorSpecificsCourseSections]
  );
  const degreeCourseOptionGroups = useMemo(
    () => collectDegreeCourseOptionGroups(plan),
    [plan]
  );
  const degreeCourseOptionCount = degreeCourseOptionGroups.reduce(
    (total, group) => total + group.options.length,
    0
  );
  const selectedDegreeCourseOptionIdsByGroup = useMemo(
    () => collectSelectedDegreeCourseOptionIds(plan),
    [plan]
  );
  const primaryDegreeSource = getTransferPlannerPrimaryDegreeRequirementsSource(
    plan.id,
    plan.selectedPathwayId
  );
  const primaryUwDegreeLink = primaryDegreeSource?.url
    ? toDisplayDegreeLink({
        label: primaryDegreeSource.label,
        url: primaryDegreeSource.url,
      })
    : toDisplayDegreeLink(plan.officialLinks[0]);
  const extraUwDegreeLinks = useMemo(
    () => collectExtraDegreeLinks(plan.officialLinks, primaryUwDegreeLink),
    [plan.officialLinks, primaryUwDegreeLink]
  );
  const sourceLinksUsed = primaryUwDegreeLink
    ? [primaryUwDegreeLink, ...extraUwDegreeLinks]
    : extraUwDegreeLinks;
  const majorSpecificsSummaryText = primaryUwDegreeLink
    ? t("transferPlanner.majorSpecificsSummaryWithOfficial")
    : t("transferPlanner.majorSpecificsSummaryFallback");
  const toggleDegreeCourseOptionGroup = (groupId: string) => {
    setOpenDegreeCourseOptionGroupIds((currentValue) => ({
      ...currentValue,
      [groupId]: !currentValue[groupId],
    }));
  };
  const toggleDegreeCourseOption = (optionId: string) => {
    setOpenDegreeCourseOptionIds((currentValue) => ({
      ...currentValue,
      [optionId]: !currentValue[optionId],
    }));
  };
  const getDegreeCourseOptionGroupSummary = (group: DegreeCourseOptionGroupModel) => {
    if (group.requirementType === "choose_one") {
      return t("transferPlanner.degreeCourseOptionChooseOne");
    }
    if (group.requirementType === "choose_n") {
      const count = group.selectionCount ?? group.requiredCount ?? group.minCourses;
      return count
        ? t("transferPlanner.degreeCourseOptionChooseN", { count })
        : t("transferPlanner.degreeCourseOptionChooseOptions");
    }
    if (group.requirementType === "choose_credits") {
      const minCredits = group.minCredits ?? group.creditText;
      return minCredits
        ? t("transferPlanner.degreeCourseOptionChooseCredits", { credits: minCredits })
        : t("transferPlanner.degreeCourseOptionChooseOptions");
    }
    if (group.requirementType === "sequence_choice") {
      return t("transferPlanner.degreeCourseOptionChooseSequence");
    }
    return t("transferPlanner.degreeCourseOptionChooseOptions");
  };
  const getRequirementCountSummary = (count: number) =>
    t("transferPlanner.ruleCount", {
      count,
      noun: t(
        count === 1
          ? "transferPlanner.requirementSingular"
          : "transferPlanner.requirementPlural"
      ),
    });
  const renderDegreeCourseOptionDetail = (
    label: string,
    values: (string | null | undefined)[]
  ) => {
    const detailValues = uniqueNonEmptyStrings(values);
    if (!detailValues.length) return null;

    return (
      <View>
        <Text className={`${secondaryTextClass} text-xs font-semibold`}>{label}</Text>
        <Text className={`${secondaryTextClass} text-sm mt-1`}>
          {detailValues.join(", ")}
        </Text>
      </View>
    );
  };
  const renderDegreeSourceLink = (link: DisplayDegreeLink) => (
    <TouchCard
      key={link.url}
      onPress={() => void openExternalLink(link.url)}
      accessibilityRole="link"
      accessibilityLabel={t("general.openNamed", { name: link.label })}
      className={`border ${borderClass} rounded-2xl px-4 py-4`}
    >
      <Text className="text-emerald-500 font-semibold">{link.label}</Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>{link.url}</Text>
      {link.note ? (
        <Text className={`${secondaryTextClass} text-xs mt-2`}>{link.note}</Text>
      ) : null}
    </TouchCard>
  );

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
              {renderDegreeSourceLink(primaryUwDegreeLink)}
              {extraUwDegreeLinks.length ? (
                <View className="gap-3">
                  <TouchOptionRow
                    onPress={() =>
                      setIsExtraUwDegreeLinksOpen((currentValue) => !currentValue)
                    }
                    expanded={isExtraUwDegreeLinksOpen}
                    accessibilityLabel={t("transferPlanner.extraUwDegreeLinks")}
                    className={`border ${borderClass} rounded-2xl px-4 py-4`}
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 min-w-0">
                        <Text className={`${textClass} font-semibold`}>
                          {t("transferPlanner.extraUwDegreeLinks")}
                        </Text>
                        <Text className={`${secondaryTextClass} text-xs mt-1`}>
                          {t(
                            extraUwDegreeLinks.length === 1
                              ? "resources.countLinkSingular"
                              : "resources.countLinkPlural",
                            { count: extraUwDegreeLinks.length }
                          )}
                        </Text>
                        <Text className={`${secondaryTextClass} text-sm mt-1`}>
                          {t("transferPlanner.extraUwDegreeLinksDescription")}
                        </Text>
                      </View>
                      <Ionicons
                        name={isExtraUwDegreeLinksOpen ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#9CA3AF"
                      />
                    </View>
                  </TouchOptionRow>

                  {isExtraUwDegreeLinksOpen ? (
                    <View className="gap-3">
                      {extraUwDegreeLinks.map(renderDegreeSourceLink)}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          <View className="mt-5 gap-4">
            <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
              <TouchOptionRow
                onPress={() => setIsDegreeCoursesOpen((currentValue) => !currentValue)}
                expanded={isDegreeCoursesOpen}
                accessibilityLabel={t("transferPlanner.uwDegreeCoursesTitle", {
                  title: plan.title,
                })}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 min-w-0">
                    <Text className={`${textClass} text-base font-semibold`}>
                      {t("transferPlanner.uwDegreeCoursesTitle", { title: plan.title })}
                    </Text>
                    <Text className={`${secondaryTextClass} text-sm mt-1`}>
                      {usedDegreeCourseRowCount || genEdCourseSection?.rows.length
                        ? t("transferPlanner.uwDegreeCoursesDescriptionReady")
                        : t("transferPlanner.uwDegreeCoursesDescriptionFallback")}
                    </Text>
                  </View>
                  <Ionicons
                    name={isDegreeCoursesOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#9CA3AF"
                  />
                </View>
              </TouchOptionRow>

              {isDegreeCoursesOpen ? (
                <View className="mt-4 gap-4">
                  <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                    <TouchOptionRow
                      onPress={() => setIsGenEdCoursesOpen((currentValue) => !currentValue)}
                      expanded={isGenEdCoursesOpen}
                      accessibilityLabel={t("transferPlanner.genEdCourses")}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1 min-w-0">
                          <Text className={`${textClass} text-sm font-semibold`}>
                            {t("transferPlanner.genEdCourses")}
                          </Text>
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>
                            {genEdCourseRowCount
                              ? getRequirementCountSummary(genEdCourseRowCount)
                              : t("transferPlanner.majorRequiredGenEdsDescription")}
                          </Text>
                        </View>
                        <Ionicons
                          name={isGenEdCoursesOpen ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#9CA3AF"
                        />
                      </View>
                    </TouchOptionRow>

                    {isGenEdCoursesOpen ? (
                      <View className="mt-3 gap-3">
                        {uwGeneralTransferRequirementSection ? (
                          <View className="gap-2">
                            <Text className={`${secondaryTextClass} text-sm`}>
                              {uwGeneralTransferRequirementSection.summary}
                            </Text>
                            {uwGeneralTransferRequirementSection.items.map((entry) => (
                              <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                                {`${entry.label}: ${entry.valueText}${entry.note ? ` (${entry.note})` : ""}`}
                              </Text>
                            ))}
                            {uwGeneralTransferRequirementSection.note ? (
                              <Text className={`${secondaryTextClass} text-xs`}>
                                {uwGeneralTransferRequirementSection.note}
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                        {genEdCourseSection?.rows.length ? (
                          <View className="gap-2">
                            {genEdCourseSection.rows.map((entry) => (
                              <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                                {entry.text}
                              </Text>
                            ))}
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
                        {!uwGeneralTransferRequirementSection &&
                        !sourceBackedUwGeneralEducationSection &&
                        !genEdCourseSection?.rows.length ? (
                          <Text className={`${secondaryTextClass} text-sm`}>
                            {t("transferPlanner.noSourceBackedGenEdTargets")}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                    <TouchOptionRow
                      onPress={() => setIsUsedDegreeCoursesOpen((currentValue) => !currentValue)}
                      expanded={isUsedDegreeCoursesOpen}
                      accessibilityLabel={t("transferPlanner.usedDegreeCourses")}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1 min-w-0">
                          <Text className={`${textClass} text-sm font-semibold`}>
                            {t("transferPlanner.usedDegreeCourses")}
                          </Text>
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>
                            {usedDegreeCourseRowCount
                              ? getRequirementCountSummary(usedDegreeCourseRowCount)
                              : t("transferPlanner.noUsedDegreeCourses")}
                          </Text>
                        </View>
                        <Ionicons
                          name={isUsedDegreeCoursesOpen ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#9CA3AF"
                        />
                      </View>
                    </TouchOptionRow>

                    {isUsedDegreeCoursesOpen ? (
                      <View className="mt-3 gap-4">
                        <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                          <TouchOptionRow
                            onPress={() =>
                              setIsDegreeCourseOptionsOpen((currentValue) => !currentValue)
                            }
                            expanded={isDegreeCourseOptionsOpen}
                            accessibilityLabel={t("transferPlanner.degreeCourseOptions")}
                          >
                            <View className="flex-row items-start justify-between gap-3">
                              <View className="flex-1 min-w-0">
                                <Text className={`${textClass} text-sm font-semibold`}>
                                  {t("transferPlanner.degreeCourseOptions")}
                                </Text>
                                <Text className={`${secondaryTextClass} text-xs mt-1`}>
                                  {degreeCourseOptionGroups.length
                                    ? t("transferPlanner.degreeCourseOptionsSummary", {
                                        groupCount: degreeCourseOptionGroups.length,
                                        optionCount: degreeCourseOptionCount,
                                      })
                                    : t("transferPlanner.degreeCourseOptionsDescription")}
                                </Text>
                              </View>
                              <Ionicons
                                name={isDegreeCourseOptionsOpen ? "chevron-up" : "chevron-down"}
                                size={18}
                                color="#9CA3AF"
                              />
                            </View>
                          </TouchOptionRow>

                          {isDegreeCourseOptionsOpen ? (
                            <View className="mt-3 gap-3">
                              {degreeCourseOptionGroups.length ? (
                                degreeCourseOptionGroups.map((group) => {
                                  const isGroupOpen =
                                    openDegreeCourseOptionGroupIds[group.id] ?? false;

                                  return (
                                    <View
                                      key={group.id}
                                      className={`border ${borderClass} rounded-2xl px-3 py-3`}
                                    >
                                      <TouchOptionRow
                                        onPress={() => toggleDegreeCourseOptionGroup(group.id)}
                                        expanded={isGroupOpen}
                                        accessibilityLabel={group.label}
                                      >
                                        <View className="flex-row items-start justify-between gap-3">
                                          <View className="flex-1 min-w-0">
                                            <Text className={`${textClass} text-sm font-semibold`}>
                                              {group.label}
                                            </Text>
                                            <Text className={`${secondaryTextClass} text-xs mt-1`}>
                                              {getDegreeCourseOptionGroupSummary(group)}
                                            </Text>
                                            <Text className={`${secondaryTextClass} text-xs mt-1`}>
                                              {t("transferPlanner.degreeCourseOptionCountSummary", {
                                                count: group.options.length,
                                              })}
                                            </Text>
                                          </View>
                                          <Ionicons
                                            name={isGroupOpen ? "chevron-up" : "chevron-down"}
                                            size={18}
                                            color="#9CA3AF"
                                          />
                                        </View>
                                      </TouchOptionRow>

                                      {isGroupOpen ? (
                                        <View className="mt-3 gap-3">
                                          {uniqueNonEmptyStrings(group.notes ?? []).length ? (
                                            <Text className={`${secondaryTextClass} text-xs`}>
                                              {uniqueNonEmptyStrings(group.notes ?? []).join(" ")}
                                            </Text>
                                          ) : null}
                                          {group.options.map((option, optionIndex) => {
                                            const optionStateId = getDegreeCourseOptionStateId(
                                              group,
                                              option,
                                              optionIndex
                                            );
                                            const isOptionOpen =
                                              openDegreeCourseOptionIds[optionStateId] ?? false;
                                            const selectedOptionIds =
                                              selectedDegreeCourseOptionIdsByGroup.get(group.id);
                                            const isSelectedOption =
                                              Boolean(option.id) &&
                                              Boolean(selectedOptionIds?.has(option.id ?? ""));
                                            const optionTitle =
                                              getDegreeCourseOptionTitle(option) ||
                                              t("transferPlanner.degreeCourseOptionFallback");
                                            const creditText =
                                              getDegreeCourseOptionCreditText(option);
                                            const optionSubtitleParts = uniqueNonEmptyStrings([
                                              isSelectedOption
                                                ? t("transferPlanner.degreeCourseOptionSelected")
                                                : null,
                                              creditText
                                                ? t(
                                                    "transferPlanner.degreeCourseOptionCreditsInline",
                                                    { credits: creditText }
                                                  )
                                                : null,
                                            ]);

                                            return (
                                              <View
                                                key={optionStateId}
                                                className={`border ${borderClass} rounded-2xl px-3 py-3`}
                                              >
                                                <TouchOptionRow
                                                  onPress={() =>
                                                    toggleDegreeCourseOption(optionStateId)
                                                  }
                                                  expanded={isOptionOpen}
                                                  accessibilityLabel={optionTitle}
                                                >
                                                  <View className="flex-row items-start justify-between gap-3">
                                                    <View className="flex-1 min-w-0">
                                                      <Text
                                                        className={`${textClass} text-sm font-semibold`}
                                                      >
                                                        {optionTitle}
                                                      </Text>
                                                      {optionSubtitleParts.length ? (
                                                        <Text
                                                          className={`${secondaryTextClass} text-xs mt-1`}
                                                        >
                                                          {optionSubtitleParts.join(" | ")}
                                                        </Text>
                                                      ) : null}
                                                    </View>
                                                    <Ionicons
                                                      name={
                                                        isOptionOpen
                                                          ? "chevron-up"
                                                          : "chevron-down"
                                                      }
                                                      size={18}
                                                      color="#9CA3AF"
                                                    />
                                                  </View>
                                                </TouchOptionRow>

                                                {isOptionOpen ? (
                                                  <View className="mt-3 gap-3">
                                                    {renderDegreeCourseOptionDetail(
                                                      t(
                                                        "transferPlanner.degreeCourseOptionDisplayCourses"
                                                      ),
                                                      option.displayCourseCodes ?? []
                                                    )}
                                                    {renderDegreeCourseOptionDetail(
                                                      t(
                                                        "transferPlanner.degreeCourseOptionUwCourses"
                                                      ),
                                                      option.uwCourses ?? []
                                                    )}
                                                    {renderDegreeCourseOptionDetail(
                                                      t(
                                                        "transferPlanner.degreeCourseOptionEquivalentUwCourses"
                                                      ),
                                                      option.equivalentUwCourseCodes ?? []
                                                    )}
                                                    {renderDegreeCourseOptionDetail(
                                                      t(
                                                        "transferPlanner.degreeCourseOptionConditionalLabCourses"
                                                      ),
                                                      option.conditionalLabCourses ?? []
                                                    )}
                                                    {renderDegreeCourseOptionDetail(
                                                      t(
                                                        "transferPlanner.degreeCourseOptionGrcMatches"
                                                      ),
                                                      option.grcMatches ?? []
                                                    )}
                                                    {renderDegreeCourseOptionDetail(
                                                      t(
                                                        "transferPlanner.degreeCourseOptionCategory"
                                                      ),
                                                      [
                                                        option.category,
                                                        option.categoryOption?.title,
                                                        option.categoryOption?.sourceText,
                                                      ]
                                                    )}
                                                    {renderDegreeCourseOptionDetail(
                                                      t(
                                                        "transferPlanner.degreeCourseOptionSource"
                                                      ),
                                                      [
                                                        option.sourceHeading,
                                                        option.sourceCategory,
                                                        group.sourceHeading,
                                                        group.sourceRowText,
                                                      ]
                                                    )}
                                                    {renderDegreeCourseOptionDetail(
                                                      t(
                                                        "transferPlanner.degreeCourseOptionNotes"
                                                      ),
                                                      option.notes ?? []
                                                    )}
                                                    {renderDegreeCourseOptionDetail(
                                                      t(
                                                        "transferPlanner.degreeCourseOptionConstraints"
                                                      ),
                                                      option.constraints ?? []
                                                    )}
                                                  </View>
                                                ) : null}
                                              </View>
                                            );
                                          })}
                                        </View>
                                      ) : null}
                                    </View>
                                  );
                                })
                              ) : (
                                <Text className={`${secondaryTextClass} text-sm`}>
                                  {t("transferPlanner.noDegreeCourseOptions")}
                                </Text>
                              )}
                            </View>
                          ) : null}
                        </View>
                        {usedDegreeCourseSections.length ? (
                          <View className="gap-4">
                            {usedDegreeCourseSections.map((section) => (
                              <View key={section.id}>
                                <Text className={`${secondaryTextClass} text-xs font-semibold`}>
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
                            ))}
                          </View>
                        ) : (
                          <Text className={`${secondaryTextClass} text-sm`}>
                            {t("transferPlanner.noUsedDegreeCourses")}
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </View>

                  {sourceLinksUsed.length ? (
                    <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                      <TouchOptionRow
                        onPress={() => setIsSourcesUsedOpen((currentValue) => !currentValue)}
                        expanded={isSourcesUsedOpen}
                        accessibilityLabel={t("transferPlanner.sourcesUsed")}
                      >
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="flex-1 min-w-0">
                            <Text className={`${textClass} text-sm font-semibold`}>
                              {t("transferPlanner.sourcesUsed")}
                            </Text>
                            <Text className={`${secondaryTextClass} text-xs mt-1`}>
                              {t(
                                sourceLinksUsed.length === 1
                                  ? "resources.countLinkSingular"
                                  : "resources.countLinkPlural",
                                { count: sourceLinksUsed.length }
                              )}
                            </Text>
                            <Text className={`${secondaryTextClass} text-xs mt-1`}>
                              {t("transferPlanner.sourcesUsedDescription")}
                            </Text>
                          </View>
                          <Ionicons
                            name={isSourcesUsedOpen ? "chevron-up" : "chevron-down"}
                            size={18}
                            color="#9CA3AF"
                          />
                        </View>
                      </TouchOptionRow>

                      {isSourcesUsedOpen ? (
                        <View className="mt-3 gap-3">
                          {sourceLinksUsed.map(renderDegreeSourceLink)}
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                    <TouchOptionRow
                      onPress={() => setIsParsedCoursesOpen((currentValue) => !currentValue)}
                      expanded={isParsedCoursesOpen}
                      accessibilityLabel={t("transferPlanner.parsedCourses")}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1 min-w-0">
                          <Text className={`${textClass} text-sm font-semibold`}>
                            {t("transferPlanner.parsedCourses")}
                          </Text>
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>
                            {t("transferPlanner.parsedCoursesDescription")}
                          </Text>
                        </View>
                        <Ionicons
                          name={isParsedCoursesOpen ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#9CA3AF"
                        />
                      </View>
                    </TouchOptionRow>

                    {isParsedCoursesOpen ? (
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

                  <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                    <TouchOptionRow
                      onPress={() =>
                        setIsGrcDegreeMatchCoursesOpen((currentValue) => !currentValue)
                      }
                      expanded={isGrcDegreeMatchCoursesOpen}
                      accessibilityLabel={t("transferPlanner.grcDegreeMatchCourses")}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1 min-w-0">
                          <Text className={`${textClass} text-sm font-semibold`}>
                            {t("transferPlanner.grcDegreeMatchCourses")}
                          </Text>
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>
                            {t("transferPlanner.grcDegreeMatchCoursesDescription")}
                          </Text>
                        </View>
                        <Ionicons
                          name={isGrcDegreeMatchCoursesOpen ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#9CA3AF"
                        />
                      </View>
                    </TouchOptionRow>

                    {isGrcDegreeMatchCoursesOpen ? (
                      <View className="mt-3 gap-3">
                        {grcDegreeMatchEntries.length ? (
                          grcDegreeMatchEntries.map((entry) => (
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
                          ))
                        ) : (
                          <Text className={`${secondaryTextClass} text-sm`}>
                            {t("transferPlanner.noGrcDegreeMatchCourses")}
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
