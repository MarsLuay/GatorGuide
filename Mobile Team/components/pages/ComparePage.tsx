import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ROUTES } from "@/constants/routes";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import {
  AnimatedCardPressable,
  AnimatedChipPressable,
  AnimatedIconPressable,
} from "@/components/ui/AnimatedPressables";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { MatchScoreBadge } from "@/components/ui/MatchScoreBadge";
import useBack from "@/hooks/use-back";
import { collegeService, type College } from "@/services";
import { formatLocalizedCurrency, formatLocalizedNumber, formatLocalizedRate } from "@/utils/locale-format";
import { formatMatchScore } from "@/utils/match-color";

const MAX_SELECT = 4;
const AUTO_PREFILL_COUNT = 2;

type CompareMetric = {
  label: string;
  getValue: (college: College) => string;
  multiline?: boolean;
};

type CompareSection = {
  title: string;
  rows: CompareMetric[];
};

function titleCase(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getDisplayTuition(college: College) {
  const tuition = typeof college.tuition === "number" ? college.tuition : college.tuitionInState ?? college.tuitionOutOfState ?? null;
  return typeof tuition === "number" ? tuition : null;
}

function getCollegeLocation(college: College) {
  return [college.location.city, college.location.state].filter(Boolean).join(", ");
}

export default function ComparePage() {
  const router = useRouter();
  const back = useBack(ROUTES.tabsResources);
  const { width } = useWindowDimensions();
  const { getScrollContentPadding } = useResponsiveLayout();
  const styles = useThemeStyles();
  const { isDark } = useAppTheme();
  const { t, language } = useAppLanguage();
  const { state, addSavedCollege } = useAppData();

  const savedColleges = useMemo(() => state.savedColleges ?? [], [state.savedColleges]);
  const savedCollegesById = useMemo(
    () => new Map(savedColleges.map((college) => [String(college.id), college])),
    [savedColleges]
  );
  const hasAutoPrefilledSelectionRef = useRef(false);
  const isMountedRef = useRef(true);
  const pendingDetailsRef = useRef<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"match" | "tuition" | "admission">("match");
  const [detailedCollegesById, setDetailedCollegesById] = useState<Record<string, College>>({});
  const [hydratingCollegeIds, setHydratingCollegeIds] = useState<string[]>([]);

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const { textClass, secondaryTextClass, borderClass, cardBgClass, inputBgClass, placeholderColor } = styles;
  const notAvailable = t("home.notAvailable");
  const columnWidth = width >= 1180 ? 220 : width >= 820 ? 190 : 160;
  const metricColumnWidth = width >= 820 ? 180 : 138;
  const compareTableMinWidth = metricColumnWidth + selectedIds.length * columnWidth;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
  });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const formatMoney = (value: number | null | undefined) => {
    if (typeof value !== "number") return notAvailable;
    return formatLocalizedCurrency(value, language);
  };

  const formatRate = (value: number | null | undefined) => {
    return formatLocalizedRate(value, language) ?? notAvailable;
  };

  const formatSize = (college: College) => {
    if (typeof college.studentSize === "number") {
      const sizeLabel = college.size && college.size !== "unknown" ? ` (${titleCase(college.size)})` : "";
      return `${formatLocalizedNumber(college.studentSize, language)}${sizeLabel}`;
    }
    if (college.size && college.size !== "unknown") return titleCase(college.size);
    return notAvailable;
  };

  const formatPrograms = (college: College) => {
    const uniquePrograms = Array.from(new Set((college.programs ?? []).map((program) => String(program ?? "").trim()).filter(Boolean)));
    if (uniquePrograms.length === 0) return notAvailable;
    return uniquePrograms.slice(0, 4).join(", ");
  };

  const formatDegreeValue = (value: string | null | undefined) => {
    const normalized = String(value ?? "").trim();
    return normalized || notAvailable;
  };

  const toggleCollege = (collegeId: string) => {
    setSelectedIds((previous) => {
      if (previous.includes(collegeId)) return previous.filter((id) => id !== collegeId);
      if (previous.length >= MAX_SELECT) return previous;
      return [...previous, collegeId];
    });
  };

  useEffect(() => {
    if (!savedColleges.length) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds((previous) => {
      const next = previous.filter((collegeId) => savedCollegesById.has(collegeId));
      if (next.length > 0) return next;
      if (hasAutoPrefilledSelectionRef.current) return next;

      hasAutoPrefilledSelectionRef.current = true;
      return savedColleges.slice(0, Math.min(AUTO_PREFILL_COUNT, savedColleges.length)).map((college) => String(college.id));
    });
  }, [savedColleges, savedCollegesById]);

  const selectedBaseColleges = useMemo(
    () =>
      selectedIds
        .map((collegeId) => savedCollegesById.get(collegeId))
        .filter((college): college is College => !!college),
    [savedCollegesById, selectedIds]
  );

  const selectedColleges = useMemo(
    () =>
      selectedBaseColleges.map((college) => {
        const detailedCollege = detailedCollegesById[String(college.id)];
        if (!detailedCollege) return college;

        return {
          ...detailedCollege,
          matchScore: college.matchScore ?? detailedCollege.matchScore,
        };
      }),
    [detailedCollegesById, selectedBaseColleges]
  );

  useEffect(() => {
    selectedBaseColleges.forEach((college) => {
      const collegeId = String(college.id);
      if (detailedCollegesById[collegeId] || pendingDetailsRef.current[collegeId]) return;

      pendingDetailsRef.current[collegeId] = true;
      setHydratingCollegeIds((previous) => (previous.includes(collegeId) ? previous : [...previous, collegeId]));

      void collegeService
        .getCollegeDetails(collegeId)
        .then((details) => {
          if (!isMountedRef.current) return;

          setDetailedCollegesById((previous) => ({ ...previous, [collegeId]: details }));
          void addSavedCollege(details);
        })
        .catch(() => {})
        .finally(() => {
          delete pendingDetailsRef.current[collegeId];
          if (!isMountedRef.current) return;
          setHydratingCollegeIds((previous) => previous.filter((id) => id !== collegeId));
        });
    });
  }, [addSavedCollege, detailedCollegesById, selectedBaseColleges]);

  const filteredColleges = useMemo(() => {
    const query = deferredSearchTerm.trim().toLowerCase();
    const base = query
      ? savedColleges.filter((college) =>
          [
            college.name,
            college.location.city,
            college.location.state,
            ...(college.programs ?? []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
      : savedColleges;

    return [...base].sort((left, right) => {
      if (sortBy === "tuition") {
        const leftTuition = getDisplayTuition(left);
        const rightTuition = getDisplayTuition(right);
        if (leftTuition === null && rightTuition === null) return left.name.localeCompare(right.name);
        if (leftTuition === null) return 1;
        if (rightTuition === null) return -1;
        return leftTuition - rightTuition;
      }

      if (sortBy === "admission") {
        const leftRate = typeof left.admissionRate === "number" ? left.admissionRate : -1;
        const rightRate = typeof right.admissionRate === "number" ? right.admissionRate : -1;
        if (leftRate === rightRate) return left.name.localeCompare(right.name);
        return rightRate - leftRate;
      }

      const leftMatch = typeof left.matchScore === "number" ? left.matchScore : -1;
      const rightMatch = typeof right.matchScore === "number" ? right.matchScore : -1;
      if (leftMatch === rightMatch) return left.name.localeCompare(right.name);
      return rightMatch - leftMatch;
    });
  }, [deferredSearchTerm, savedColleges, sortBy]);

  const cheapestSelected = useMemo(() => {
    const withTuition = selectedColleges
      .map((college) => ({ college, value: getDisplayTuition(college) }))
      .filter((entry): entry is { college: College; value: number } => typeof entry.value === "number");
    if (withTuition.length === 0) return null;
    return withTuition.reduce((lowest, current) => (current.value < lowest.value ? current : lowest));
  }, [selectedColleges]);

  const lowestNetPriceSelected = useMemo(() => {
    const withNetPrice = selectedColleges
      .map((college) => ({ college, value: college.avgNetPriceOverall }))
      .filter((entry): entry is { college: College; value: number } => typeof entry.value === "number");
    if (withNetPrice.length === 0) return null;
    return withNetPrice.reduce((lowest, current) => (current.value < lowest.value ? current : lowest));
  }, [selectedColleges]);

  const highestAdmissionSelected = useMemo(() => {
    const withAdmissionRate = selectedColleges
      .map((college) => ({ college, value: college.admissionRate }))
      .filter((entry): entry is { college: College; value: number } => typeof entry.value === "number");
    if (withAdmissionRate.length === 0) return null;
    return withAdmissionRate.reduce((highest, current) => (current.value > highest.value ? current : highest));
  }, [selectedColleges]);

  const highestCompletionSelected = useMemo(() => {
    const withCompletionRate = selectedColleges
      .map((college) => ({ college, value: college.completionRate }))
      .filter((entry): entry is { college: College; value: number } => typeof entry.value === "number");
    if (withCompletionRate.length === 0) return null;
    return withCompletionRate.reduce((highest, current) => (current.value > highest.value ? current : highest));
  }, [selectedColleges]);

  const compareSections: CompareSection[] = [
    {
      title: t("compare.overviewSection"),
      rows: [
        { label: t("compare.location"), getValue: (college) => getCollegeLocation(college) || notAvailable },
        { label: t("compare.setting"), getValue: (college) => titleCase(college.setting) || notAvailable },
        { label: t("compare.locale"), getValue: (college) => String(college.locale ?? "").trim() || notAvailable },
        { label: t("compare.size"), getValue: (college) => formatSize(college) },
        { label: t("compare.schoolType"), getValue: (college) => formatDegreeValue(college.degreesAwarded?.highest) },
        { label: t("compare.predominantDegree"), getValue: (college) => formatDegreeValue(college.degreesAwarded?.predominant) },
      ],
    },
    {
      title: t("compare.costSection"),
      rows: [
        { label: t("compare.tuition"), getValue: (college) => formatMoney(getDisplayTuition(college)) },
        { label: t("compare.inStateTuition"), getValue: (college) => formatMoney(college.tuitionInState) },
        { label: t("compare.outOfStateTuition"), getValue: (college) => formatMoney(college.tuitionOutOfState) },
        { label: t("compare.netPrice"), getValue: (college) => formatMoney(college.avgNetPriceOverall) },
        { label: t("compare.attendanceYear"), getValue: (college) => String(college.attendanceAcademicYear ?? "").trim() || notAvailable },
        { label: t("compare.medianDebt"), getValue: (college) => formatMoney(college.medianDebtCompletersOverall) },
      ],
    },
    {
      title: t("compare.outcomesSection"),
      rows: [
        { label: t("compare.admissionRate"), getValue: (college) => formatRate(college.admissionRate) },
        { label: t("compare.completionRate"), getValue: (college) => formatRate(college.completionRate) },
        { label: t("compare.pellGrantRate"), getValue: (college) => formatRate(college.pellGrantRate) },
      ],
    },
    {
      title: t("compare.programsSection"),
      rows: [{ label: t("compare.programs"), multiline: true, getValue: (college) => formatPrograms(college) }],
    },
  ];

  if (selectedColleges.some((college) => typeof college.matchScore === "number")) {
    compareSections[2].rows.unshift({
      label: t("compare.matchScore"),
      getValue: (college) => (typeof college.matchScore === "number" ? `${Math.round(college.matchScore)}%` : notAvailable),
    });
  }

  return (
    <ScreenBackground>
      <ScrollView className="flex-1" contentContainerStyle={scrollContentPadding}>
        <View style={{ width: "100%", maxWidth: 1220, alignSelf: "center", paddingHorizontal: 24, paddingTop: 24 }}>
          <AnimatedIconPressable onPress={back} className="flex-row items-center" containerStyle={{ alignSelf: "flex-start", marginBottom: 16 }}>
            <MaterialIcons name="arrow-back" size={24} color={placeholderColor} />
            <Text className={`${secondaryTextClass} ml-2`}>{t("general.back")}</Text>
          </AnimatedIconPressable>

          <Text className={`text-2xl ${textClass} mb-1`}>{t("compare.title")}</Text>
          <Text className={`${secondaryTextClass} mb-6`}>{t("compare.subtitle")}</Text>

          {savedColleges.length === 0 ? (
            <View className={`${cardBgClass} border rounded-3xl p-6`}>
              <MaterialIcons
                name="bookmark-border"
                size={48}
                color={placeholderColor}
                style={{ alignSelf: "center", marginBottom: 12 }}
              />
              <Text className={`${textClass} text-center font-medium mb-2`}>{t("tools.saveCollegesFirst")}</Text>
              <Text className={`${secondaryTextClass} text-center text-sm`}>{t("tools.saveCollegesFirstHint")}</Text>
              <AnimatedChipPressable
                onPress={() => router.push(ROUTES.tabs)}
                className="mt-4 self-center flex-row items-center rounded-xl bg-emerald-500 px-4 py-3"
              >
                <MaterialIcons name="search" size={18} color="#FFFFFF" />
                <Text className="ml-2 text-white font-semibold">{t("home.search")}</Text>
              </AnimatedChipPressable>
            </View>
          ) : (
            <>
              <View className="flex-row flex-wrap gap-3 mb-5">
                <View className={`${cardBgClass} border rounded-2xl px-4 py-3`}>
                  <Text className={`${secondaryTextClass} text-xs uppercase`}>{t("compare.selectedColleges")}</Text>
                  <Text className={`${textClass} text-lg font-semibold`}>
                    {t("compare.selectedCount", {
                      count: formatLocalizedNumber(selectedIds.length, language),
                      max: formatLocalizedNumber(MAX_SELECT, language),
                    })}
                  </Text>
                </View>
                <View className={`${cardBgClass} border rounded-2xl px-4 py-3`}>
                  <Text className={`${secondaryTextClass} text-xs uppercase`}>{t("savedColleges.summarySaved")}</Text>
                  <Text className={`${textClass} text-lg font-semibold`}>{formatLocalizedNumber(savedColleges.length, language)}</Text>
                  <Text className={`${secondaryTextClass} text-xs mt-1`}>{t("compare.selectionLimitHint")}</Text>
                </View>
              </View>

              <View className={`${cardBgClass} border rounded-3xl p-4 mb-5`}>
                <Text className={`${secondaryTextClass} text-sm mb-3`}>
                  {t("compare.prefillHint", {
                    count: formatLocalizedNumber(Math.min(AUTO_PREFILL_COUNT, savedColleges.length), language),
                  })}
                </Text>
                <TextInput
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder={t("compare.searchPlaceholder")}
                  placeholderTextColor={placeholderColor}
                  className={`${inputBgClass} ${textClass} border ${borderClass} rounded-xl px-4 py-3 mb-3`}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View className="flex-row flex-wrap gap-2">
                  {(["match", "tuition", "admission"] as const).map((option) => {
                    const active = sortBy === option;
                    return (
                      <AnimatedChipPressable
                        key={option}
                        onPress={() => setSortBy(option)}
                        className={`px-3 py-2 rounded-lg border ${
                          active ? "bg-emerald-500 border-emerald-500" : `${cardBgClass} ${borderClass}`
                        }`}
                      >
                        <Text className={active ? (isDark ? "text-white font-medium" : "text-emerald-900 font-medium") : textClass}>
                          {option === "match"
                            ? t("compare.sortMatch")
                            : option === "tuition"
                              ? t("compare.sortTuition")
                              : t("compare.sortAdmission")}
                        </Text>
                      </AnimatedChipPressable>
                    );
                  })}
                </View>
              </View>

              {filteredColleges.length === 0 ? (
                <View className={`${cardBgClass} border rounded-3xl p-6 mb-6`}>
                  <MaterialIcons
                    name="search-off"
                    size={42}
                    color={placeholderColor}
                    style={{ alignSelf: "center", marginBottom: 12 }}
                  />
                  <Text className={`${textClass} text-center font-medium mb-2`}>{t("compare.searchResultsEmptyTitle")}</Text>
                  <Text className={`${secondaryTextClass} text-center text-sm`}>{t("compare.searchResultsEmptyHint")}</Text>
                </View>
              ) : (
                <View className={`${cardBgClass} border rounded-3xl overflow-hidden mb-6`}>
                  {filteredColleges.map((college) => {
                    const collegeId = String(college.id);
                    const selected = selectedIds.includes(collegeId);
                    const location = getCollegeLocation(college) || notAvailable;
                    const tuition = formatMoney(getDisplayTuition(college));
                    const admissionRate = formatRate(college.admissionRate);

                    return (
                      <View
                        key={college.id}
                        className={`px-4 py-4 flex-row items-center gap-3 border-b last:border-b-0 ${borderClass}`}
                      >
                        <AnimatedCardPressable
                          onPress={() => router.push(ROUTES.collegeDetail(collegeId))}
                          style={{ flex: 1 }}
                        >
                          <Text className={`${textClass} font-semibold`} numberOfLines={1}>
                            {college.name}
                          </Text>
                          <Text className={`${secondaryTextClass} text-sm mt-1`} numberOfLines={1}>
                            {location}
                          </Text>
                          <Text className={`${secondaryTextClass} text-xs mt-1`} numberOfLines={1}>
                            {`${t("compare.tuition")}: ${tuition} | ${t("compare.admissionRate")}: ${admissionRate}`}
                          </Text>
                        </AnimatedCardPressable>

                        <AnimatedChipPressable
                          onPress={() => toggleCollege(collegeId)}
                          className={`rounded-xl px-4 py-2 border ${
                            selected
                              ? "bg-emerald-500 border-emerald-500"
                              : selectedIds.length >= MAX_SELECT
                                ? `${cardBgClass} border-gray-400`
                                : `${cardBgClass} ${borderClass}`
                          }`}
                        >
                          <Text className={selected ? (isDark ? "text-white font-semibold" : "text-emerald-950 font-semibold") : textClass}>
                            {selected ? t("compare.selectedBadge") : t("compare.compareAction")}
                          </Text>
                        </AnimatedChipPressable>
                      </View>
                    );
                  })}
                </View>
              )}

              {selectedColleges.length > 0 ? (
                <View className={`${cardBgClass} border rounded-3xl p-4 mb-5`}>
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className={`${textClass} font-semibold`}>{t("compare.selectedColleges")}</Text>
                    <AnimatedIconPressable onPress={() => setSelectedIds([])}>
                      <Text className="text-red-500">{t("compare.clearSelection")}</Text>
                    </AnimatedIconPressable>
                  </View>

                  <View className="flex-row flex-wrap gap-3">
                    {selectedColleges.map((college) => {
                      const collegeId = String(college.id);
                      const location = getCollegeLocation(college) || notAvailable;
                      const isHydrating = hydratingCollegeIds.includes(collegeId);

                      return (
                        <View
                          key={collegeId}
                          className={`${cardBgClass} border rounded-2xl p-4`}
                          style={{ width: width >= 1000 ? "48.9%" : "100%" }}
                        >
                          <View className="flex-row items-start justify-between gap-3 mb-3">
                            <View style={{ flex: 1 }}>
                              <Text className={`${textClass} font-semibold`} numberOfLines={2}>
                                {college.name}
                              </Text>
                              <Text className={`${secondaryTextClass} text-sm mt-1`} numberOfLines={1}>
                                {location}
                              </Text>
                            </View>
                            <AnimatedIconPressable onPress={() => toggleCollege(collegeId)}>
                              <MaterialIcons name="close" size={20} color={placeholderColor} />
                            </AnimatedIconPressable>
                          </View>

                          {typeof college.matchScore === "number" ? (
                            <MatchScoreBadge
                              score={college.matchScore}
                              text={`${t("compare.matchScore")}: ${formatMatchScore(college.matchScore)}`}
                              className="mb-3"
                            />
                          ) : null}

                          <View className={`border ${borderClass} rounded-xl p-3 mb-3`}>
                            <View className="flex-row items-center justify-between mb-2">
                              <Text className={`${secondaryTextClass} text-xs`}>{t("compare.tuition")}</Text>
                              <Text className={`${textClass} text-sm font-medium`}>
                                {formatMoney(getDisplayTuition(college))}
                              </Text>
                            </View>
                            <View className="flex-row items-center justify-between mb-2">
                              <Text className={`${secondaryTextClass} text-xs`}>{t("compare.netPrice")}</Text>
                              <Text className={`${textClass} text-sm font-medium`}>
                                {formatMoney(college.avgNetPriceOverall)}
                              </Text>
                            </View>
                            <View className="flex-row items-center justify-between">
                              <Text className={`${secondaryTextClass} text-xs`}>{t("compare.admissionRate")}</Text>
                              <Text className={`${textClass} text-sm font-medium`}>
                                {formatRate(college.admissionRate)}
                              </Text>
                            </View>
                          </View>

                          <View className="flex-row items-center justify-between">
                            <AnimatedIconPressable
                              onPress={() =>
                                router.push(ROUTES.collegeDetail(collegeId))
                              }
                            >
                              <Text className="text-emerald-500 font-medium">{t("compare.openDetails")}</Text>
                            </AnimatedIconPressable>
                            {isHydrating ? <ActivityIndicator size="small" color="#10b981" /> : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {selectedColleges.length > 0 && hydratingCollegeIds.length > 0 ? (
                <View className={`${cardBgClass} border rounded-2xl px-4 py-3 mb-5 flex-row items-center gap-3`}>
                  <ActivityIndicator size="small" color="#10b981" />
                  <Text className={`${secondaryTextClass} text-sm`}>{t("compare.refreshingData")}</Text>
                </View>
              ) : null}

              {selectedColleges.length < 2 ? (
                <View className={`${cardBgClass} border rounded-3xl p-6`}>
                  <Text className={`${textClass} font-medium mb-2`}>{t("compare.chooseAtLeastTwo")}</Text>
                  <Text className={`${secondaryTextClass}`}>{t("compare.compareTwoToFour")}</Text>
                </View>
              ) : (
                <View className="gap-5">
                  <View className={`${cardBgClass} border rounded-3xl p-5`}>
                    <Text className={`${textClass} font-semibold mb-4`}>{t("compare.quickHighlights")}</Text>
                    <View className="flex-row flex-wrap gap-3">
                      <View className={`${cardBgClass} border rounded-2xl px-4 py-3`} style={{ width: width >= 1000 ? "48.8%" : "100%" }}>
                        <Text className={`${secondaryTextClass} text-xs uppercase mb-1`}>{t("compare.cheapest")}</Text>
                        <Text className={`${textClass} font-semibold`}>
                          {cheapestSelected ? `${cheapestSelected.college.name} (${formatMoney(cheapestSelected.value)})` : notAvailable}
                        </Text>
                      </View>
                      <View className={`${cardBgClass} border rounded-2xl px-4 py-3`} style={{ width: width >= 1000 ? "48.8%" : "100%" }}>
                        <Text className={`${secondaryTextClass} text-xs uppercase mb-1`}>{t("compare.lowestNetPrice")}</Text>
                        <Text className={`${textClass} font-semibold`}>
                          {lowestNetPriceSelected
                            ? `${lowestNetPriceSelected.college.name} (${formatMoney(lowestNetPriceSelected.value)})`
                            : notAvailable}
                        </Text>
                      </View>
                      <View className={`${cardBgClass} border rounded-2xl px-4 py-3`} style={{ width: width >= 1000 ? "48.8%" : "100%" }}>
                        <Text className={`${secondaryTextClass} text-xs uppercase mb-1`}>{t("compare.highestAdmission")}</Text>
                        <Text className={`${textClass} font-semibold`}>
                          {highestAdmissionSelected
                            ? `${highestAdmissionSelected.college.name} (${formatRate(highestAdmissionSelected.value)})`
                            : notAvailable}
                        </Text>
                      </View>
                      <View className={`${cardBgClass} border rounded-2xl px-4 py-3`} style={{ width: width >= 1000 ? "48.8%" : "100%" }}>
                        <Text className={`${secondaryTextClass} text-xs uppercase mb-1`}>{t("compare.highestCompletion")}</Text>
                        <Text className={`${textClass} font-semibold`}>
                          {highestCompletionSelected
                            ? `${highestCompletionSelected.college.name} (${formatRate(highestCompletionSelected.value)})`
                            : notAvailable}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {compareSections.map((section) => (
                    <View key={section.title} className={`${cardBgClass} border rounded-3xl p-5`}>
                      <Text className={`${textClass} font-semibold mb-4`}>{section.title}</Text>

                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ minWidth: compareTableMinWidth }}>
                          <View className={`flex-row border-b ${borderClass}`}>
                            <View style={{ width: metricColumnWidth, paddingRight: 12, paddingBottom: 14 }}>
                              <Text className={`${secondaryTextClass} text-xs uppercase`}>{t("compare.metric")}</Text>
                            </View>
                            {selectedColleges.map((college) => {
                              return (
                                <View key={`${section.title}-${college.id}-header`} style={{ width: columnWidth, paddingBottom: 14, paddingRight: 12 }}>
                                  <Text className={`${textClass} font-semibold`} numberOfLines={2}>
                                    {college.name}
                                  </Text>
                                  <Text className={`${secondaryTextClass} text-xs mt-1`} numberOfLines={1}>
                                    {getCollegeLocation(college) || notAvailable}
                                  </Text>
                                  {typeof college.matchScore === "number" ? (
                                    <MatchScoreBadge
                                      score={college.matchScore}
                                      text={`${formatMatchScore(college.matchScore)} ${t("compare.matchShort")}`}
                                      size="compact"
                                      className="mt-2"
                                    />
                                  ) : null}
                                </View>
                              );
                            })}
                          </View>

                          {section.rows.map((row, rowIndex) => (
                            <View
                              key={`${section.title}-${row.label}`}
                              className={`flex-row ${rowIndex < section.rows.length - 1 ? `border-b ${borderClass}` : ""}`}
                            >
                              <View style={{ width: metricColumnWidth, paddingRight: 12, paddingVertical: 14 }}>
                                <Text className={`${secondaryTextClass} text-sm`} numberOfLines={2}>
                                  {row.label}
                                </Text>
                              </View>
                              {selectedColleges.map((college) => (
                                <View
                                  key={`${section.title}-${row.label}-${college.id}`}
                                  style={{ width: columnWidth, paddingRight: 12, paddingVertical: 14, minHeight: row.multiline ? 92 : 68 }}
                                >
                                  <Text
                                    className={`${textClass} ${row.multiline ? "text-sm leading-5" : "text-base font-medium"}`}
                                    numberOfLines={row.multiline ? 5 : 3}
                                  >
                                    {row.getValue(college)}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
