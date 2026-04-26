import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { AnimatedIconPressable } from "@/components/ui/AnimatedPressables";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/SearchableSelect";
import {
  getTransferEquivalencyTagDisplayLabel,
  getTransferEquivalencyTagLabel,
  getTransferEquivalencyTagLongLabel,
  isTransferEquivalencyTrackedTag,
  normalizeTransferEquivalencyTag,
  TRANSFER_EQUIVALENCY_TRACKED_TAGS,
  type TransferEquivalencyTrackedTag,
} from "@/constants/transfer-equivalency-tags";
import {
  TRANSFER_PLANNER_CAMPUSES,
  TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY,
} from "@/constants/transfer-planner-source";
import type { TransferPlannerCampusId } from "@/constants/transfer-planner-types";
import { ROUTES } from "@/constants/routes";
import { useAppLanguage } from "@/hooks/use-app-language";
import useBack from "@/hooks/use-back";
import { useThemeStyles } from "@/hooks/use-theme-styles";

type EquivalencyEntry = {
  id: string;
  sourceCourseLabel: string;
  sourceCourseTitle: string | null;
  targetOutcome: string;
  tags: string[];
};

const DEFAULT_TRANSFER_EQUIVALENCY_CAMPUS_ID: TransferPlannerCampusId = "uw-seattle";

function isTransferEquivalencyCampusId(value: string): value is TransferPlannerCampusId {
  return TRANSFER_PLANNER_CAMPUSES.some((campus) => campus.id === value);
}

function normalizeTransferEquivalencyCampusId(
  value: string | string[] | undefined
): TransferPlannerCampusId {
  const rawCampus = Array.isArray(value) ? value[0] : value;
  const normalized = String(rawCampus ?? DEFAULT_TRANSFER_EQUIVALENCY_CAMPUS_ID)
    .trim()
    .toLowerCase();

  return isTransferEquivalencyCampusId(normalized)
    ? normalized
    : DEFAULT_TRANSFER_EQUIVALENCY_CAMPUS_ID;
}

function getEligibleTransferHeading(tag: string) {
  const shortLabel = getTransferEquivalencyTagLabel(tag);
  const longLabel = getTransferEquivalencyTagLongLabel(tag);
  if (!longLabel || longLabel === shortLabel) {
    return `${shortLabel} eligible transfers`;
  }
  return `${shortLabel} eligible transfers (${longLabel})`;
}

export default function TransferEquivalencyCatalogPage() {
  const goBack = useBack(ROUTES.transferPlanner);
  const router = useRouter();
  const params = useLocalSearchParams<{
    tag?: string | string[];
    campusId?: string | string[];
    collegeId?: string | string[];
  }>();
  const styles = useThemeStyles();
  const { t } = useAppLanguage();
  const {
    textClass,
    secondaryTextClass,
    cardBgClass,
    borderClass,
    dropdownSurfaceColor,
  } = styles;
  const [tagOpenState, setTagOpenState] = useState<Record<string, boolean>>({});
  const [isCollegeSelectorOpen, setIsCollegeSelectorOpen] = useState(false);
  const [isCampusSelectorOpen, setIsCampusSelectorOpen] = useState(false);
  const backLabel = useMemo(() => {
    const translated = t("general.back");
    return translated && translated !== "general.back" ? translated : "Back";
  }, [t]);

  const selectedTags = useMemo(() => {
    const rawTags = Array.isArray(params.tag) ? params.tag : [params.tag];

    return Array.from(
      new Set(
        rawTags
          .flatMap((value) => String(value ?? "").split(","))
          .map((value) => normalizeTransferEquivalencyTag(value))
          .filter((value): value is TransferEquivalencyTrackedTag =>
            isTransferEquivalencyTrackedTag(value)
          )
      )
    );
  }, [params.tag]);

  const selectedCollegeId = useMemo(() => {
    const rawCollege = Array.isArray(params.collegeId) ? params.collegeId[0] : params.collegeId;
    return String(rawCollege ?? "uw").trim().toLowerCase() === "uw" ? "uw" : "uw";
  }, [params.collegeId]);

  const collegeOptions = useMemo<SearchableSelectOption[]>(
    () => [
      {
        id: "uw",
        label: "University of Washington",
        description: "Currently the only supported college in this equivalencies catalog.",
      },
    ],
    []
  );

  const selectedCollegeLabel =
    collegeOptions.find((option) => option.id === selectedCollegeId)?.label ??
    "University of Washington";

  const selectedCampusId = useMemo(() => {
    return normalizeTransferEquivalencyCampusId(params.campusId);
  }, [params.campusId]);

  const campusOptions = useMemo<SearchableSelectOption[]>(
    () =>
      TRANSFER_PLANNER_CAMPUSES.map((campus) => ({
        id: campus.id,
        label: campus.title,
        description: campus.summary,
      })),
    []
  );

  const selectedCampus =
    TRANSFER_PLANNER_CAMPUSES.find((campus) => campus.id === selectedCampusId) ?? null;
  const selectedCampusLabel = selectedCampus?.title ?? "UW Seattle";

  const handleCampusSelect = (nextCampusId: string) => {
    setIsCampusSelectorOpen(false);
    if (!isTransferEquivalencyCampusId(nextCampusId) || nextCampusId === selectedCampusId) {
      return;
    }

    setTagOpenState({});
    router.replace({
      pathname: ROUTES.transferEquivalencies,
      params: {
        collegeId: selectedCollegeId,
        campusId: nextCampusId,
        ...(selectedTags.length ? { tag: selectedTags.join(",") } : {}),
      },
    });
  };

  const equivalenciesByTag = useMemo(() => {
    const grouped = new Map<string, EquivalencyEntry[]>();

    for (const rule of TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY) {
      if (!rule.targetSchoolIds.includes(selectedCampusId)) continue;
      if (rule.acceptanceCategory === "no-credit") continue;
      if (rule.isObsoleteSourceCourse) continue;
      if (/^\s*§/.test(String(rule.sourceCourseLabel ?? ""))) continue;

      const normalizedTags = Array.from(
        new Set(
          (rule.targetRequirementTags ?? [])
            .map((tag) => normalizeTransferEquivalencyTag(tag))
            .filter((tag): tag is TransferEquivalencyTrackedTag =>
              isTransferEquivalencyTrackedTag(tag)
            )
        )
      );

      if (!normalizedTags.length) continue;

      const entry: EquivalencyEntry = {
        id: rule.id,
        sourceCourseLabel: String(rule.sourceCourseLabel ?? "").trim() || (rule.sourceCourseSets?.[0] ?? []).join(", "),
        sourceCourseTitle: String(rule.sourceCourseTitle ?? "").trim() || null,
        targetOutcome: String(rule.targetOutcome ?? "").trim() || "See official transfer guide wording.",
        tags: normalizedTags,
      };

      for (const tag of normalizedTags) {
        const existing = grouped.get(tag) ?? [];
        existing.push(entry);
        grouped.set(tag, existing);
      }
    }

    for (const [tag, entries] of grouped.entries()) {
      grouped.set(
        tag,
        [...entries].sort((left, right) => left.sourceCourseLabel.localeCompare(right.sourceCourseLabel))
      );
    }

    return grouped;
  }, [selectedCampusId]);

  const visibleTags = useMemo(() => {
    if (selectedTags.length) return selectedTags;
    return TRANSFER_EQUIVALENCY_TRACKED_TAGS.filter(
      (tag) => (equivalenciesByTag.get(tag)?.length ?? 0) > 0
    );
  }, [equivalenciesByTag, selectedTags]);

  const campusLabel = selectedCampusLabel;
  const highlightedCategoryLabels = useMemo(
    () =>
      ["AH", "SSC", "NSC"]
        .map((tag) => getTransferEquivalencyTagDisplayLabel(tag))
        .join(", "),
    []
  );

  return (
    <ScreenBackground includeTopInset includeBottomInset={false}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => {
          setIsCollegeSelectorOpen(false);
          setIsCampusSelectorOpen(false);
        }}
      >
        <AnimatedIconPressable
          onPress={goBack}
          className="flex-row items-center"
          containerStyle={{ alignSelf: "flex-start" }}
        >
          <MaterialIcons name="arrow-back" size={20} color="#1f8a5d" />
          <Text className={`${secondaryTextClass} ml-2`}>{backLabel}</Text>
        </AnimatedIconPressable>

        <View className="mt-4">
          <Text className={`${textClass} text-2xl font-semibold`}>Transfer Category Equivalencies</Text>
          <Text className={`${secondaryTextClass} text-sm mt-2`}>
            Eligible Green River to {campusLabel} transfer options for {highlightedCategoryLabels}, and related requirement categories.
          </Text>
        </View>

        <View className="mt-5">
          <Text className={`${textClass} text-base font-semibold`}>College</Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            Pick the college whose transfer category equivalencies you want to browse. University of Washington is the only supported option right now.
          </Text>
          <View className="mt-4">
            <SearchableSelect
              value={selectedCollegeLabel}
              open={isCollegeSelectorOpen}
              onToggle={() => {
                setIsCampusSelectorOpen(false);
                setIsCollegeSelectorOpen((current) => !current);
              }}
              onDismiss={() => {
                setIsCollegeSelectorOpen(false);
              }}
              options={collegeOptions}
              onSelect={() => {
                setIsCollegeSelectorOpen(false);
              }}
              selectedOptionId={selectedCollegeId}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
              dropdownBackgroundColor={dropdownSurfaceColor}
              overlayStrategy="modal"
            />
          </View>
        </View>

        <View className="mt-5">
          <Text className={`${textClass} text-base font-semibold`}>Campus</Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            Choose which UW campus to browse source-backed transfer category equivalencies for.
          </Text>
          <View className="mt-4">
            <SearchableSelect
              value={selectedCampusLabel}
              open={isCampusSelectorOpen}
              onToggle={() => {
                setIsCollegeSelectorOpen(false);
                setIsCampusSelectorOpen((current) => !current);
              }}
              onDismiss={() => {
                setIsCampusSelectorOpen(false);
              }}
              options={campusOptions}
              onSelect={handleCampusSelect}
              selectedOptionId={selectedCampusId}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
              dropdownBackgroundColor={dropdownSurfaceColor}
              overlayStrategy="modal"
            />
          </View>
        </View>

        {!visibleTags.length ? (
          <View className={`${cardBgClass} border ${borderClass} rounded-2xl px-4 py-4 mt-5`}>
            <Text className={`${textClass} font-semibold`}>No tagged equivalencies found</Text>
            <Text className={`${secondaryTextClass} text-sm mt-2`}>
              This campus currently has no source-backed category-tagged transfer rows for the selected filter.
            </Text>
          </View>
        ) : (
          <View className="mt-5 gap-4">
            {visibleTags.map((tag) => {
              const rows = equivalenciesByTag.get(tag) ?? [];
              const isOpen = tagOpenState[tag] ?? (selectedTags.length > 0);
              return (
                <View key={tag} className={`${cardBgClass} border ${borderClass} rounded-2xl px-4 py-4`}>
                  <AnimatedIconPressable
                    onPress={() =>
                      setTagOpenState((current) => ({
                        ...current,
                        [tag]: !(current[tag] ?? (selectedTags.length > 0)),
                      }))
                    }
                    className="flex-row items-start justify-between"
                  >
                    <View className="flex-1 min-w-0">
                      <Text className={`${textClass} font-semibold`}>
                        {getEligibleTransferHeading(tag)}
                      </Text>
                      <Text className={`${secondaryTextClass} text-xs mt-1`}>
                        {rows.length} source-backed equivalenc{rows.length === 1 ? "y" : "ies"}
                      </Text>
                    </View>
                    <MaterialIcons
                      name={isOpen ? "expand-less" : "expand-more"}
                      size={20}
                      color="#9CA3AF"
                    />
                  </AnimatedIconPressable>

                  {isOpen ? (
                    <View className="mt-3 gap-2">
                      {rows.map((row) => (
                        <View key={`${tag}-${row.id}`} className={`border ${borderClass} rounded-xl px-3 py-3`}>
                          <Text className={`${textClass} text-sm font-semibold`}>
                            {row.sourceCourseTitle
                              ? `${row.sourceCourseLabel} - ${row.sourceCourseTitle}`
                              : row.sourceCourseLabel}
                          </Text>
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>{row.targetOutcome}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}
