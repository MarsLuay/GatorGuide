import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { AnimatedIconPressable } from "@/components/ui/AnimatedPressables";
import { TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY } from "@/constants/transfer-planner-source";
import { ROUTES } from "@/constants/routes";
import { useThemeStyles } from "@/hooks/use-theme-styles";

function normalizeRequirementTag(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function getRequirementTagLabel(normalizedTag: string) {
  switch (normalizedTag) {
    case "AH":
      return "A&H";
    case "SSC":
      return "SSc";
    case "NSC":
      return "NSc";
    case "QSR":
      return "QSR";
    case "VLPA":
      return "VLPA";
    case "DIV":
      return "DIV";
    case "NW":
      return "NW";
    case "IANDS":
      return "I&S";
    default:
      return normalizedTag;
  }
}

const SUPPORTED_TAGS = ["SSC", "AH", "NSC", "QSR", "VLPA", "DIV", "NW", "IANDS"];

type EquivalencyEntry = {
  id: string;
  sourceCourseLabel: string;
  sourceCourseTitle: string | null;
  targetOutcome: string;
  tags: string[];
};

export default function TransferEquivalencyCatalogPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tag?: string | string[]; campusId?: string | string[] }>();
  const styles = useThemeStyles();
  const { textClass, secondaryTextClass, cardBgClass, borderClass } = styles;
  const [tagOpenState, setTagOpenState] = useState<Record<string, boolean>>({});

  const selectedTags = useMemo(() => {
    const rawTags = Array.isArray(params.tag) ? params.tag : [params.tag];

    return Array.from(
      new Set(
        rawTags
          .flatMap((value) => String(value ?? "").split(","))
          .map((value) => normalizeRequirementTag(value))
          .filter((value) => SUPPORTED_TAGS.includes(value))
      )
    );
  }, [params.tag]);

  const selectedCampusId = useMemo(() => {
    const rawCampus = Array.isArray(params.campusId) ? params.campusId[0] : params.campusId;
    const normalized = String(rawCampus ?? "uw-seattle").trim().toLowerCase();
    if (normalized === "uw-bothell" || normalized === "uw-tacoma" || normalized === "uw-seattle") {
      return normalized;
    }
    return "uw-seattle";
  }, [params.campusId]);

  const equivalenciesByTag = useMemo(() => {
    const grouped = new Map<string, EquivalencyEntry[]>();

    for (const rule of TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY) {
      if (!rule.targetSchoolIds.includes(selectedCampusId)) continue;
      if (rule.acceptanceCategory === "no-credit") continue;
      if (rule.isObsoleteSourceCourse) continue;
      if (/^\s*§/.test(String(rule.sourceCourseLabel ?? ""))) continue;

      const normalizedTags = Array.from(
        new Set((rule.targetRequirementTags ?? []).map((tag) => normalizeRequirementTag(tag)).filter(Boolean))
      ).filter((tag) => SUPPORTED_TAGS.includes(tag));

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
    return SUPPORTED_TAGS.filter((tag) => (equivalenciesByTag.get(tag)?.length ?? 0) > 0);
  }, [equivalenciesByTag, selectedTags]);

  const campusLabel = selectedCampusId === "uw-bothell" ? "UW Bothell" : selectedCampusId === "uw-tacoma" ? "UW Tacoma" : "UW Seattle";

  return (
    <ScreenBackground includeTopInset includeBottomInset={false}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        <AnimatedIconPressable
          onPress={() => {
            router.replace(ROUTES.transferPlanner);
          }}
          className="flex-row items-center"
          containerStyle={{ alignSelf: "flex-start" }}
        >
          <MaterialIcons name="arrow-back" size={20} color="#1f8a5d" />
          <Text className={`${secondaryTextClass} ml-2`}>Back to planner</Text>
        </AnimatedIconPressable>

        <View className="mt-4">
          <Text className={`${textClass} text-2xl font-semibold`}>Transfer Category Equivalencies</Text>
          <Text className={`${secondaryTextClass} text-sm mt-2`}>
            Eligible Green River to {campusLabel} transfer options for A&H, SSc, NSc, and related requirement categories.
          </Text>
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
                        [tag]: !(current[tag] ?? false),
                      }))
                    }
                    className="flex-row items-start justify-between"
                  >
                    <View className="flex-1 min-w-0">
                      <Text className={`${textClass} font-semibold`}>{getRequirementTagLabel(tag)} eligible transfers</Text>
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
