import React, { useEffect, useMemo, useState } from "react";
import { Alert, Linking, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { MatchScoreBadge } from "@/components/ui/MatchScoreBadge";
import { StateCard } from "@/components/ui/StateCard";
import {
  AnimatedCardPressable,
  AnimatedChipPressable,
  AnimatedIconPressable,
} from "@/components/ui/AnimatedPressables";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { type College, collegeService } from "@/services/colleges/college.service";
import { formatLocalizedRate } from "@/utils/locale-format";

type DetailRow = {
  key: string;
  label: string;
  value: string;
};

const humanizeValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") return null;
  return String(value)
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function CollegeDetailsPage() {
  const params = useLocalSearchParams<{ collegeId?: string | string[] }>();
  const rawId = params?.collegeId;
  const collegeId = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { getScrollContentPadding } = useResponsiveLayout();
  const { width } = useWindowDimensions();
  const { t, language } = useAppLanguage();

  const [college, setCollege] = useState<College | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const styles = useThemeStyles();
  const { isDark } = useAppTheme();
  const { state, addSavedCollege, removeSavedCollege, isCollegeSaved } = useAppData();
  const savedCollege = state.savedColleges?.find((c) => String(c.id) === String(collegeId));
  const { textClass, secondaryTextClass, cardBgClass, borderClass, placeholderColor, inputBgClass } = styles;

  const [showAllDataCollapsed, setShowAllDataCollapsed] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [rowLimit, setRowLimit] = useState(300);

  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isDesktop = width >= 1080;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const shellMaxWidth = isDesktop ? 1280 : isTablet ? 1040 : 720;
  const contentGap = isDesktop ? 20 : 16;
  const sidebarWidth = isDesktop ? 360 : undefined;
  const nestedDataMaxHeight = isDesktop ? 560 : isTablet ? 480 : isCompactPhone ? 320 : 380;
  const stackDetailRows = width < 580;
  const stackHeaderRow = width < 780;
  const quickActionStack = width < 460;
  const cardPadding = isTablet ? 20 : 16;
  const metricTileWidth = isDesktop ? "48%" : width >= 520 ? "48%" : "100%";
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 12,
  });

  const inputClass = `w-full ${inputBgClass} ${textClass} border ${borderClass} rounded-2xl px-4 py-3`;

  const flattened = useMemo(() => {
    if (!college?.raw) return [] as { path: string; value: unknown }[];
    const out: { path: string; value: unknown }[] = [];

    const visit = (obj: any, prefix = "") => {
      if (obj === null) return;
      if (typeof obj !== "object") {
        out.push({ path: prefix || "root", value: obj });
        return;
      }
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => visit(item, prefix ? `${prefix}[${index}]` : `[${index}]`));
        return;
      }
      for (const key of Object.keys(obj)) {
        const value = obj[key];
        const path = prefix ? `${prefix}.${key}` : key;
        if (value === null) continue;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          out.push({ path, value });
        } else {
          visit(value, path);
        }
      }
    };

    visit(college.raw, "");
    return out;
  }, [college?.raw]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const urlLike = (value: string) => /^https?:\/\//i.test(value) || /^www\./i.test(value) || /\.[a-z]{2,}(\/|$)/i.test(value);

    return flattened
      .map((row) => {
        const value = row.value;
        const isUrl = typeof value === "string" && urlLike(value);
        const stringValue = value === null ? "null" : String(value);
        const isTruncated = typeof value === "string" && value.length > 120;
        const display = isTruncated ? `${stringValue.slice(0, 120)}...` : stringValue;
        const humanizedPath = row.path
          .replace(/\[\d+\]/g, "")
          .replace(/\./g, " ")
          .replace(/_/g, " ")
          .split(" ")
          .filter(Boolean)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        const translated = t(`scorecard.${row.path}`);
        const label = translated && translated !== `scorecard.${row.path}` ? translated : humanizedPath;

        return { ...row, label, display, isUrl, isTruncated };
      })
      .filter((row) => {
        if (!term) return true;
        return (
          row.path.toLowerCase().includes(term) ||
          String(row.value).toLowerCase().includes(term) ||
          row.label.toLowerCase().includes(term)
        );
      });
  }, [flattened, searchTerm, t]);

  const displayRows = useMemo(() => filteredRows.slice(0, rowLimit), [filteredRows, rowLimit]);

  const formatRate = (value: number | null | undefined) => formatLocalizedRate(value ?? null, language) ?? t("home.notAvailable");

  const formatMoney = (value: number | null | undefined) => {
    if (value === null || value === undefined || typeof value !== "number") return t("home.notAvailable");
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `$${Math.round(value)}`;
    }
  };

  const formatCount = (value: number | null | undefined) => {
    if (value === null || value === undefined || typeof value !== "number") return t("home.notAvailable");
    try {
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
    } catch {
      return String(Math.round(value));
    }
  };

  const normalizeUrl = (url?: string | null) => {
    if (!url) return null;
    const trimmed = String(url).trim();
    if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
  };

  const openUrl = async (url?: string | null) => {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      Alert.alert(t("resources.couldNotOpenLink"));
      return;
    }
    try {
      const supported = await Linking.canOpenURL(normalized);
      if (supported) {
        await Linking.openURL(normalized);
      } else {
        Alert.alert(t("resources.couldNotOpenLink"));
      }
    } catch {
      Alert.alert(t("resources.couldNotOpenLink"));
    }
  };

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!collegeId) throw new Error("missing id");
      const nextCollege = await collegeService.getCollegeDetails(String(collegeId));
      setCollege(nextCollege);
    } catch (err: any) {
      setError(err?.message || "Error fetching");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collegeId]);

  const normalizedWebsite = normalizeUrl(college?.website);
  const normalizedPriceCalculator = normalizeUrl(college?.priceCalculator);
  const hasDistinctPriceCalculator =
    !!normalizedPriceCalculator && normalizedPriceCalculator !== normalizedWebsite;

  const campusLocation = [college?.location?.city, college?.location?.state].filter(Boolean).join(", ");
  const schoolType = humanizeValue(college?.degreesAwarded?.highest);
  const predominantDegree = humanizeValue(college?.degreesAwarded?.predominant);
  const settingLabel = humanizeValue(college?.setting);
  const localeLabel = humanizeValue(college?.locale);
  const saved = college ? isCollegeSaved(college.id) : false;

  const summaryChips = [
    settingLabel,
    schoolType,
    predominantDegree,
    college?.studentSize ? `${formatCount(college.studentSize)} ${t("details.studentsChip")}` : null,
  ].filter((item): item is string => !!item);

  const studentSnapshotTiles = [
    {
      key: "admission-rate",
      label: t("details.admissionRate"),
      value: formatRate(college?.admissionRate),
      helper: t("details.admissionsAndOutcomes"),
    },
    {
      key: "completion-rate",
      label: t("details.completionRate"),
      value: formatRate(college?.completionRate),
      helper: t("details.graduationAndRetentionHelper"),
    },
    {
      key: "student-size",
      label: t("details.studentSize"),
      value: formatCount(college?.studentSize),
      helper: settingLabel ?? t("home.notAvailable"),
    },
    {
      key: "student-cost",
      label: college?.avgNetPriceOverall != null ? t("details.avgNetPrice") : t("details.inStateTuition"),
      value:
        college?.avgNetPriceOverall != null
          ? formatMoney(college.avgNetPriceOverall)
          : formatMoney(college?.tuitionInState ?? college?.tuition),
      helper: t("details.costAndAid"),
    },
  ];

  const admissionsRows: DetailRow[] = [
    { key: "admission-rate", label: t("details.admissionRate"), value: formatRate(college?.admissionRate) },
    { key: "completion-rate", label: t("details.completionRate"), value: formatRate(college?.completionRate) },
    ...(schoolType ? [{ key: "school-type", label: t("details.schoolType"), value: schoolType }] : []),
    ...(predominantDegree ? [{ key: "predominant-degree", label: t("details.predominantDegree"), value: predominantDegree }] : []),
  ];

  const costAidRows: DetailRow[] = [
    ...(college?.tuitionInState != null
      ? [{ key: "tuition-in-state", label: t("details.inStateTuition"), value: formatMoney(college.tuitionInState) }]
      : []),
    ...(college?.tuitionOutOfState != null
      ? [{ key: "tuition-out-of-state", label: t("details.outOfStateTuition"), value: formatMoney(college.tuitionOutOfState) }]
      : []),
    ...(college?.avgNetPriceOverall != null
      ? [{ key: "avg-net-price", label: t("details.avgNetPrice"), value: formatMoney(college.avgNetPriceOverall) }]
      : []),
    ...(college?.pellGrantRate != null
      ? [{ key: "pell-grant-rate", label: t("details.pellGrantRate"), value: formatRate(college.pellGrantRate) }]
      : []),
    ...(college?.medianDebtCompletersOverall != null
      ? [{ key: "median-debt", label: t("details.medianDebt"), value: formatMoney(college.medianDebtCompletersOverall) }]
      : []),
  ];

  const campusRows: DetailRow[] = [
    ...(campusLocation ? [{ key: "location", label: t("details.location"), value: campusLocation }] : []),
    ...(settingLabel ? [{ key: "setting", label: t("details.setting"), value: settingLabel }] : []),
    ...(localeLabel ? [{ key: "locale", label: t("details.locale"), value: localeLabel }] : []),
    ...(college?.attendanceAcademicYear != null
      ? [{ key: "attendance-year", label: t("details.attendanceYear"), value: String(college.attendanceAcademicYear) }]
      : []),
  ];

  const programHighlights = useMemo(() => {
    const seen = new Set<string>();
    return (college?.programs ?? [])
      .map((program) => String(program ?? "").trim())
      .filter((program) => program.length >= 4)
      .filter((program) => /[A-Za-z]/.test(program))
      .filter((program) => !/^\d+([./-]\d+)*$/.test(program))
      .filter((program) => !/^(cip|code)$/i.test(program))
      .filter((program) => {
        const key = program.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);
  }, [college?.programs]);

  const renderSectionCard = (title: string, body: string, children: React.ReactNode) => (
    <View className={`${cardBgClass} border rounded-3xl`} style={{ padding: cardPadding }}>
      <Text className={`text-sm ${secondaryTextClass}`}>{title}</Text>
      <Text className={`${secondaryTextClass} mt-2`} style={{ fontSize: 13, lineHeight: 19 }}>
        {body}
      </Text>
      <View style={{ marginTop: 14 }}>{children}</View>
    </View>
  );

  const renderDetailRows = (rows: DetailRow[]) => (
    <View style={{ gap: 12 }}>
      {rows.map((row) => (
        <View
          key={row.key}
          style={{
            flexDirection: stackDetailRows ? "column" : "row",
            justifyContent: "space-between",
            alignItems: stackDetailRows ? "flex-start" : "center",
            gap: stackDetailRows ? 4 : 16,
          }}
        >
          <Text
            className={secondaryTextClass}
            style={
              stackDetailRows
                ? { fontSize: 13, lineHeight: 18 }
                : { flex: 1, minWidth: 0, paddingRight: 12, fontSize: 13, lineHeight: 18 }
            }
          >
            {row.label}
          </Text>
          <Text
            className={textClass}
            style={
              stackDetailRows
                ? { fontSize: 15, lineHeight: 22 }
                : { flex: 1, minWidth: 0, textAlign: "right", fontSize: 15, lineHeight: 22 }
            }
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );

  const quickActionsCard = renderSectionCard(
    t("details.quickActions"),
    t("details.quickActionsBody"),
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: quickActionStack ? "column" : "row", gap: 12 }}>
        <AnimatedCardPressable
          onPress={() => openUrl(college?.website)}
          containerStyle={{ flex: 1 }}
          className="flex-1 rounded-2xl bg-emerald-500 px-4 py-4"
        >
          <View className="flex-row items-center justify-between">
            <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
              <Text className={`${isDark ? "text-white" : "text-emerald-900"} font-semibold`}>
                {t("details.visitWebsite")}
              </Text>
              <Text className={`${isDark ? "text-white/80" : "text-emerald-900/80"} mt-2`} numberOfLines={2}>
                {college?.website ?? t("home.notAvailable")}
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color={isDark ? "#ffffff" : "#083d1f"} />
          </View>
        </AnimatedCardPressable>

        {hasDistinctPriceCalculator ? (
          <AnimatedCardPressable
            onPress={() => openUrl(college?.priceCalculator)}
            className={`${inputBgClass} border rounded-2xl px-4 py-4`}
            containerStyle={{ flex: 1 }}
          >
            <View className="flex-row items-center justify-between">
              <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                <Text className={`${textClass} font-semibold`}>{t("details.openNetPriceCalculator")}</Text>
                <Text className={`${secondaryTextClass} mt-2`} numberOfLines={2}>
                  {t("details.compareYourRealCosts")}
                </Text>
              </View>
              <Ionicons name="calculator-outline" size={18} color={placeholderColor} />
            </View>
          </AnimatedCardPressable>
        ) : null}
      </View>

      {college ? (
        <AnimatedCardPressable
          onPress={() => (saved ? removeSavedCollege(college.id) : addSavedCollege(college))}
          className={`${inputBgClass} border rounded-2xl px-4 py-4`}
        >
          <View className="flex-row items-center justify-between">
            <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
              <Text className={`${textClass} font-semibold`}>
                {saved ? t("details.removeSavedCollege") : t("details.saveCollege")}
              </Text>
              <Text className={`${secondaryTextClass} mt-2`}>
                {saved ? t("details.savedCollegeBody") : t("details.saveCollegeBody")}
              </Text>
            </View>
            <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={18} color={saved ? "#008f4e" : placeholderColor} />
          </View>
        </AnimatedCardPressable>
      ) : null}

      <Text className={`${secondaryTextClass} text-xs`} style={{ lineHeight: 18 }}>
        {t("resources.openInBrowser")}
      </Text>
    </View>
  );

  const snapshotCard = renderSectionCard(
    t("details.studentSnapshot"),
    t("details.studentSnapshotBody"),
    <View className="flex-row flex-wrap" style={{ gap: 12 }}>
      {studentSnapshotTiles.map((tile) => (
        <View
          key={tile.key}
          className={`${inputBgClass} border rounded-2xl px-4 py-4`}
          style={{ width: metricTileWidth }}
        >
          <Text className={`${secondaryTextClass} text-xs`}>{tile.label}</Text>
          <Text className={`${textClass} mt-2 font-semibold`} style={{ fontSize: 22, lineHeight: 29 }}>
            {tile.value}
          </Text>
          <Text className={`${secondaryTextClass} mt-2`} style={{ fontSize: 12, lineHeight: 18 }}>
            {tile.helper}
          </Text>
        </View>
      ))}
    </View>
  );

  const programsCard = renderSectionCard(
    t("details.programsAndFocus"),
    t("details.programsAndFocusBody"),
    programHighlights.length > 0 ? (
      <View style={{ gap: 14 }}>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {programHighlights.map((program) => (
            <View key={program} className={`${inputBgClass} border rounded-full px-3 py-2`}>
              <Text className={`${textClass} text-sm`}>{program}</Text>
            </View>
          ))}
        </View>
        {(schoolType || predominantDegree) && renderDetailRows(
          [
            ...(schoolType ? [{ key: "program-school-type", label: t("details.schoolType"), value: schoolType }] : []),
            ...(predominantDegree
              ? [{ key: "program-predominant-degree", label: t("details.predominantDegree"), value: predominantDegree }]
              : []),
          ]
        )}
      </View>
    ) : (
      <Text className={secondaryTextClass} style={{ fontSize: 14, lineHeight: 21 }}>
        {t("details.noPrograms")}
      </Text>
    )
  );

  const admissionsCard =
    admissionsRows.length > 0
      ? renderSectionCard(
          t("details.admissionsAndOutcomes"),
          t("details.admissionsAndOutcomesBody"),
          renderDetailRows(admissionsRows)
        )
      : null;

  const costAidCard =
    costAidRows.length > 0
      ? renderSectionCard(
          t("details.costAndAid"),
          t("details.costAndAidBody"),
          renderDetailRows(costAidRows)
        )
      : null;

  const campusCard =
    campusRows.length > 0
      ? renderSectionCard(
          t("details.campusAndLocation"),
          t("details.campusAndLocationBody"),
          renderDetailRows(campusRows)
        )
      : null;

  const allDataCard =
    flattened.length > 0
      ? (
          <View className={`${cardBgClass} border rounded-3xl`} style={{ padding: cardPadding }}>
            <AnimatedCardPressable
              onPress={() => setShowAllDataCollapsed((value) => !value)}
              className="flex-row items-center justify-between"
            >
              <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                <Text className={`text-sm ${secondaryTextClass}`}>{t("details.rawScorecard")}</Text>
                <Text className={`${secondaryTextClass} mt-2`} style={{ fontSize: 13, lineHeight: 19 }}>
                  {t("details.rawScorecardBody")}
                </Text>
              </View>
              <Text className={secondaryTextClass}>{showAllDataCollapsed ? "+" : "-"}</Text>
            </AnimatedCardPressable>

            {!showAllDataCollapsed ? (
              <View style={{ marginTop: 14 }}>
                <TextInput
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder={t("details.searchData")}
                  placeholderTextColor={placeholderColor}
                  className={`${inputClass} mb-3`}
                />

                <ScrollView
                  style={{ maxHeight: nestedDataMaxHeight }}
                  contentContainerStyle={{ paddingRight: isDesktop ? 6 : 0 }}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {displayRows.length === 0 ? (
                    <Text className={secondaryTextClass}>{t("home.notAvailable")}</Text>
                  ) : (
                    displayRows.map((row, index) => (
                      <View
                        key={`${row.path}-${index}`}
                        className={`py-3 ${index < displayRows.length - 1 ? `border-b ${borderClass}` : ""}`}
                      >
                        <Text className={`${secondaryTextClass} text-xs`} style={{ lineHeight: 18 }}>
                          {row.label}
                        </Text>

                        {row.isUrl ? (
                          <AnimatedIconPressable onPress={() => openUrl(String(row.value))} containerClassName="mt-2 self-start">
                            <Text className={`${textClass} text-sm underline`} style={{ lineHeight: 22 }}>
                              {String(row.value)}
                            </Text>
                          </AnimatedIconPressable>
                        ) : (
                          <View
                            style={{
                              marginTop: 8,
                              flexDirection: stackDetailRows ? "column" : "row",
                              alignItems: stackDetailRows ? "flex-start" : "center",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <Text
                              className={`${textClass} text-sm`}
                              numberOfLines={stackDetailRows ? 3 : 2}
                              ellipsizeMode="tail"
                              style={stackDetailRows ? { lineHeight: 22 } : { flex: 1, minWidth: 0, lineHeight: 22 }}
                            >
                              {row.display}
                            </Text>

                            {row.isTruncated ? (
                              <AnimatedIconPressable
                                onPress={() => Alert.alert(row.path, String(row.value))}
                                style={stackDetailRows ? undefined : { flexShrink: 0 }}
                              >
                                <Text className={`${secondaryTextClass} text-xs`}>{t("details.showFull")}</Text>
                              </AnimatedIconPressable>
                            ) : null}
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </ScrollView>

                {filteredRows.length > rowLimit ? (
                  <AnimatedChipPressable
                    onPress={() => setRowLimit(filteredRows.length)}
                    className="mt-3 rounded-2xl py-3 items-center bg-emerald-500"
                  >
                    <Text className={`${isDark ? "text-white" : "text-emerald-900"} font-semibold`}>
                      {t("details.showMore")}
                    </Text>
                  </AnimatedChipPressable>
                ) : null}
              </View>
            ) : null}
          </View>
        )
      : null;

  const desktopContent =
    isDesktop ? (
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: contentGap }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ gap: 16 }}>
            {snapshotCard}
            {programsCard}
            {allDataCard}
          </View>
        </View>

        <View style={{ width: sidebarWidth, flexShrink: 0 }}>
          <View style={{ gap: 16 }}>
            {quickActionsCard}
            {admissionsCard}
            {costAidCard}
            {campusCard}
          </View>
        </View>
      </View>
    ) : (
      <View style={{ gap: 16 }}>
        {snapshotCard}
        {quickActionsCard}
        {programsCard}
        {admissionsCard}
        {costAidCard}
        {campusCard}
        {allDataCard}
      </View>
    );

  return (
    <ScreenBackground>
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerStyle={scrollContentPadding}>
        <View
          style={{
            width: "100%",
            maxWidth: shellMaxWidth,
            alignSelf: "center",
            paddingHorizontal: shellHorizontalPadding,
            paddingTop: 8,
          }}
        >
          <View className={`${cardBgClass} border rounded-3xl mb-4`} style={{ padding: cardPadding }}>
            <View
              style={{
                flexDirection: stackHeaderRow ? "column" : "row",
                alignItems: stackHeaderRow ? "stretch" : "flex-start",
                gap: 16,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <View className="flex-row items-center justify-between mb-4">
                  <AnimatedIconPressable
                    onPress={() => router.back()}
                    className={`flex-row items-center self-start rounded-2xl border px-3 py-2 ${inputBgClass}`}
                  >
                    <Ionicons name="chevron-back" size={18} color={placeholderColor} />
                    <Text className={`${secondaryTextClass} ml-2`}>{t("general.back")}</Text>
                  </AnimatedIconPressable>

                  {college ? (
                    <AnimatedIconPressable
                      onPress={() => (saved ? removeSavedCollege(college.id) : addSavedCollege(college))}
                      className={`h-11 w-11 rounded-2xl border items-center justify-center ${inputBgClass}`}
                    >
                      <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={20} color={saved ? "#008f4e" : placeholderColor} />
                    </AnimatedIconPressable>
                  ) : null}
                </View>

                <Text
                  className={`${textClass} font-semibold`}
                  numberOfLines={isDesktop ? 3 : 2}
                  style={{ fontSize: isTablet ? 32 : 28, lineHeight: isTablet ? 40 : 34 }}
                >
                  {college?.name ?? t("home.notAvailable")}
                </Text>
                <Text className={`${secondaryTextClass} mt-2`} style={{ fontSize: 15, lineHeight: 22 }}>
                  {campusLocation || t("home.notAvailable")}
                </Text>
                <Text className={`${secondaryTextClass} mt-3`} style={{ fontSize: 14, lineHeight: 21 }}>
                  {t("details.exploreCollegeBody")}
                </Text>

                {summaryChips.length > 0 ? (
                  <View className="flex-row flex-wrap mt-4" style={{ gap: 8 }}>
                    {summaryChips.map((chip) => (
                      <View key={chip} className={`${inputBgClass} border rounded-full px-3 py-2`}>
                        <Text className={`${textClass} text-xs`}>{chip}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>

              {typeof savedCollege?.matchScore === "number" ? (
                <View style={{ width: stackHeaderRow ? "100%" : isDesktop ? 280 : 240, flexShrink: 0 }}>
                  <MatchScoreBadge
                    score={savedCollege.matchScore}
                    text={t("savedColleges.matchLabel", { score: Math.round(savedCollege.matchScore) })}
                  />
                </View>
              ) : null}
            </View>
          </View>

          {loading ? (
            <StateCard variant="loading" className="mb-4" />
          ) : error ? (
            <StateCard
              variant="error"
              title={t("general.error")}
              message={error}
              actionLabel={t("general.retry")}
              onAction={fetchDetails}
              className="mb-4"
            />
          ) : !college ? (
            <StateCard
              variant="empty"
              title={t("home.notAvailable")}
              message={t("profile.prepareDataError")}
              actionLabel={t("general.retry")}
              onAction={fetchDetails}
              className="mb-4"
            />
          ) : (
            desktopContent
          )}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
