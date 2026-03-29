import React, { useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, Linking, Alert, TextInput, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { collegeService, College } from "@/services";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";
import { MatchScoreBadge } from "@/components/ui/MatchScoreBadge";
import { StateCard } from "@/components/ui/StateCard";
import { Ionicons } from "@expo/vector-icons";

export default function CollegeDetailsPage() {
  const params = useLocalSearchParams<{ collegeId?: string | string[] }>();
  const rawId = params?.collegeId;
  const collegeId = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { getScrollContentPadding } = useResponsiveLayout();
  const { width } = useWindowDimensions();
  const { t } = useAppLanguage();

  const [college, setCollege] = useState<College | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const styles = useThemeStyles();
  const { isDark } = useAppTheme();
  const { state, addSavedCollege, removeSavedCollege, isCollegeSaved } = useAppData();
  const savedCollege = state.savedColleges?.find((c) => String(c.id) === String(collegeId));
  const { textClass, secondaryTextClass, cardBgClass, borderClass, placeholderColor, inputBgClass } = styles;

  // All-data UI state
  const [showAllDataCollapsed, setShowAllDataCollapsed] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [rowLimit, setRowLimit] = useState(300);

  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isDesktop = width >= 1080;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const shellMaxWidth = isDesktop ? 1280 : isTablet ? 1040 : 720;
  const contentGap = isDesktop ? 20 : 16;
  const sidebarWidth = isDesktop ? 340 : undefined;
  const nestedDataMaxHeight = isDesktop ? 560 : isTablet ? 480 : isCompactPhone ? 320 : 380;
  const stackDetailRows = width < 540;
  const stackHeaderRow = width < 780;
  const cardPadding = isTablet ? 20 : 16;
  const keyStatCardWidth = isDesktop ? "31%" : width >= 520 ? "48%" : "100%";
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 12,
  });

  const inputClass = `w-full ${inputBgClass} ${textClass} border ${borderClass} rounded-2xl px-4 py-3`;

  // Flatten raw Scorecard JSON into path/value pairs (primitive leaves only)
  const flattened = useMemo(() => {
    if (!college?.raw) return [] as { path: string; value: any }[];
    const out: { path: string; value: any }[] = [];
    const visit = (obj: any, prefix = "") => {
      if (obj === null) {
        return; // skip null leaves entirely
      }
      if (typeof obj !== "object") {
        out.push({ path: prefix || "root", value: obj });
        return;
      }
      if (Array.isArray(obj)) {
        obj.forEach((item, i) => visit(item, prefix ? `${prefix}[${i}]` : `[${i}]`));
        return;
      }
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        const path = prefix ? `${prefix}.${key}` : key;
        if (val === null) {
          // skip nulls
          continue;
        }
        if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
          out.push({ path, value: val });
        } else {
          visit(val, path);
        }
      }
    };
    visit(college.raw, "");
    return out;
  }, [college?.raw]);

  // filtered and display rows with truncation and url detection
  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const urlLike = (s: string) => {
      if (!s) return false;
      return /^https?:\/\//i.test(s) || /^www\./i.test(s) || /\.[a-z]{2,}(\/|$)/i.test(s);
    };

    return flattened
      .map((r) => {
        const v = r.value;
        const isUrl = typeof v === "string" && urlLike(v);
        const str = v === null ? "null" : String(v);
        const isTruncated = typeof v === "string" && v.length > 120;
        const display = isTruncated ? `${str.slice(0, 120)}...` : str;
        // Hybrid label: try translations first, then fall back to humanized path
        const humanize = (p: string) =>
          p
            .replace(/\[\d+\]/g, "")
            .replace(/\./g, " ")
            .replace(/_/g, " ")
            .split(" ")
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");

        let label = humanize(r.path);
        try {
          const tKey1 = `scorecard.${r.path}`;
          const tKey2 = r.path;
          const trans1 = t(tKey1 as any);
          if (trans1 && trans1 !== tKey1) label = trans1;
          else {
            const trans2 = t(tKey2 as any);
            if (trans2 && trans2 !== tKey2) label = trans2;
          }
        } catch {
          // ignore missing translations and keep humanized label
        }

        return { path: r.path, label, value: v, display, isUrl, isTruncated };
      })
      .filter((r) => {
        if (!term) return true;
        return (
          r.path.toLowerCase().includes(term) ||
          String(r.value).toLowerCase().includes(term) ||
          (r.label && String(r.label).toLowerCase().includes(term))
        );
      });
  }, [flattened, searchTerm, t]);

  const displayRows = useMemo(() => filteredRows.slice(0, rowLimit), [filteredRows, rowLimit]);

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!collegeId) throw new Error("missing id");
      const c = await collegeService.getCollegeDetails(String(collegeId));
      setCollege(c);
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

  const formatRate = (r: number | null) => {
    if (r === null || typeof r !== "number") return t("home.notAvailable");
    return Math.round(r * 100) + "%";
  };

  const formatMoney = (n: number | null) => {
    if (n === null || typeof n !== "number") return t("home.notAvailable");
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
    } catch {
      return "$" + Math.round(n).toString();
    }
  };

  const normalizeUrl = (url?: string | null) => {
    if (!url) return null;
    const s = String(url).trim();
    if (!/^https?:\/\//i.test(s)) return `https://${s}`;
    return s;
  };

  const openUrl = async (url?: string | null) => {
    const normalized = normalizeUrl(url);
    if (!normalized) return Alert.alert(t("resources.couldNotOpenLink"));
    try {
      const supported = await Linking.canOpenURL(normalized);
      if (supported) await Linking.openURL(normalized);
      else Alert.alert(t("resources.couldNotOpenLink"));
    } catch {
      Alert.alert(t("resources.couldNotOpenLink"));
    }
  };

  const keyStats = [
    college?.admissionRate != null
      ? { key: "admission-rate", label: t("details.admissionRate"), value: formatRate(college.admissionRate) }
      : null,
    college?.completionRate != null
      ? { key: "completion-rate", label: t("details.completionRate"), value: formatRate(college.completionRate ?? null) }
      : null,
    college?.studentSize != null
      ? { key: "student-size", label: t("details.studentSize"), value: `${String(college.studentSize)} (${college.size ?? "unknown"})` }
      : null,
  ].filter((item): item is { key: string; label: string; value: string } => !!item);

  const costRows = [
    college?.tuitionInState != null
      ? { key: "in-state", label: t("details.inStateTuition"), value: formatMoney((college as any).tuitionInState) }
      : null,
    college?.tuitionOutOfState != null
      ? { key: "out-of-state", label: t("details.outOfStateTuition"), value: formatMoney((college as any).tuitionOutOfState) }
      : null,
  ].filter((item): item is { key: string; label: string; value: string } => !!item);

  const moreInfoRows = [
    college?.degreesAwarded?.highest
      ? { key: "school-type", label: "School type", value: String(college.degreesAwarded.highest) }
      : null,
    college?.degreesAwarded?.predominant
      ? { key: "predominant-degree", label: "Predominant degree", value: String(college.degreesAwarded.predominant) }
      : null,
    college?.locale
      ? { key: "locale", label: "Locale", value: String(college.locale) }
      : null,
    college?.avgNetPriceOverall != null
      ? { key: "avg-net-price", label: "Avg net price", value: formatMoney(college.avgNetPriceOverall) }
      : null,
    college?.attendanceAcademicYear != null
      ? { key: "attendance-year", label: "Attendance year", value: String(college.attendanceAcademicYear) }
      : null,
    college?.pellGrantRate != null
      ? { key: "pell-grant-rate", label: "Pell grant rate", value: formatRate(college.pellGrantRate) }
      : null,
    college?.medianDebtCompletersOverall != null
      ? {
          key: "median-debt",
          label: "Median debt (completers)",
          value: formatMoney(college.medianDebtCompletersOverall),
        }
      : null,
  ].filter((item): item is { key: string; label: string; value: string } => !!item);

  const renderDataRow = (row: { key: string; label: string; value: string }) => (
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
        style={stackDetailRows ? { fontSize: 13, lineHeight: 18 } : { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18, paddingRight: 12 }}
      >
        {row.label}
      </Text>
      <Text
        className={textClass}
        style={
          stackDetailRows
            ? { fontSize: 15, lineHeight: 22 }
            : { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 22, textAlign: "right" }
        }
      >
        {row.value}
      </Text>
    </View>
  );

  const keyStatsCard =
    keyStats.length > 0 ? (
      <View className={`${cardBgClass} border rounded-3xl`} style={{ padding: cardPadding }}>
        <Text className={`text-sm ${secondaryTextClass} mb-3`}>{t("details.keyStats")}</Text>
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {keyStats.map((stat) => (
            <View key={stat.key} className={`${inputBgClass} border rounded-2xl px-4 py-4`} style={{ width: keyStatCardWidth }}>
              <Text className={`${secondaryTextClass} text-xs`}>{stat.label}</Text>
              <Text className={`${textClass} mt-2 font-semibold`} style={{ fontSize: 21, lineHeight: 28 }}>
                {stat.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    ) : null;

  const costCard =
    costRows.length > 0 ? (
      <View className={`${cardBgClass} border rounded-3xl`} style={{ padding: cardPadding }}>
        <Text className={`text-sm ${secondaryTextClass} mb-3`}>{t("details.cost")}</Text>
        <View style={{ gap: 12 }}>
          {costRows.map((row) => renderDataRow(row))}
        </View>
      </View>
    ) : null;

  const moreInfoCard =
    moreInfoRows.length > 0 ? (
      <View className={`${cardBgClass} border rounded-3xl`} style={{ padding: cardPadding }}>
        <Text className={`text-sm ${secondaryTextClass} mb-3`}>{t("details.moreInfo") ?? "More details"}</Text>
        <View style={{ gap: 12 }}>
          {moreInfoRows.map((row) => renderDataRow(row))}
        </View>
      </View>
    ) : null;

  const hasSidebarCards = costRows.length > 0 || !!college?.website;

  const linksCard =
    college?.website ? (
      <View className={`${cardBgClass} border rounded-3xl`} style={{ padding: cardPadding }}>
        <Text className={`text-sm ${secondaryTextClass} mb-3`}>{t("details.links")}</Text>

        <Pressable
          onPress={() => openUrl(college.website)}
          className={`${inputBgClass} border rounded-2xl px-4 py-4`}
        >
          <View className="flex-row items-start justify-between">
            <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
              <Text className={secondaryTextClass}>{t("details.website")}</Text>
              <Text className={`${textClass} mt-2`} numberOfLines={isDesktop ? 2 : 3} ellipsizeMode="tail" style={{ fontSize: 15, lineHeight: 22 }}>
                {college.website}
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color={placeholderColor} />
          </View>
        </Pressable>
      </View>
    ) : null;

  const allDataCard =
    flattened.length > 0 ? (
      <View className={`${cardBgClass} border rounded-3xl`} style={{ padding: cardPadding }}>
        <Pressable
          onPress={() => setShowAllDataCollapsed((s) => !s)}
          className="flex-row items-center justify-between mb-3"
        >
          <Text className={`text-sm ${secondaryTextClass}`}>All data (Scorecard)</Text>
          <Text className={`${secondaryTextClass}`}>{showAllDataCollapsed ? "+" : "-"}</Text>
        </Pressable>

        {!showAllDataCollapsed ? (
          <>
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder={(t("details.searchData") as any) ?? "Search keys or values"}
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
                displayRows.map((row, idx) => (
                  <View
                    key={`${row.path}-${idx}`}
                    className={`py-3 ${idx < displayRows.length - 1 ? "border-b " + borderClass : ""}`}
                  >
                    <Text className={`${secondaryTextClass} text-xs`} style={{ lineHeight: 18 }}>
                      {row.label}
                    </Text>

                    {row.isUrl ? (
                      <Pressable onPress={() => openUrl(row.value as string)} className="mt-2">
                        <Text className={`${textClass} text-sm underline`} style={{ lineHeight: 22 }}>
                          {String(row.value)}
                        </Text>
                      </Pressable>
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
                          <Pressable onPress={() => Alert.alert(row.path, String(row.value))} style={stackDetailRows ? undefined : { flexShrink: 0 }}>
                            <Text className={`${secondaryTextClass} text-xs`}>
                              {(t("details.showFull") as any) ?? "Show full"}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>

            {filteredRows.length > rowLimit ? (
              <Pressable
                onPress={() => setRowLimit(filteredRows.length)}
                className="mt-3 rounded-2xl py-3 items-center bg-emerald-500"
              >
                <Text className={`${isDark ? "text-white" : "text-emerald-900"} font-semibold`}>
                  {(t("details.showMore") as any) ?? "Show more"}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>
    ) : null;

  return (
    <ScreenBackground>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={scrollContentPadding}
      >
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
                  <Pressable onPress={() => router.back()} className={`flex-row items-center self-start rounded-2xl border px-3 py-2 ${inputBgClass}`}>
                    <Ionicons name="chevron-back" size={18} color={placeholderColor} />
                    <Text className={`${secondaryTextClass} ml-2`}>{t("general.back")}</Text>
                  </Pressable>

                  {college ? (
                    <Pressable
                      onPress={() => (isCollegeSaved(college.id) ? removeSavedCollege(college.id) : addSavedCollege(college))}
                      className={`h-11 w-11 rounded-2xl border items-center justify-center ${inputBgClass}`}
                    >
                      <Ionicons
                        name={isCollegeSaved(college.id) ? "bookmark" : "bookmark-outline"}
                        size={20}
                        color={isCollegeSaved(college.id) ? "#008f4e" : placeholderColor}
                      />
                    </Pressable>
                  ) : null}
                </View>

                <Text className={`${textClass} font-semibold`} numberOfLines={isDesktop ? 3 : 2} style={{ fontSize: isTablet ? 32 : 28, lineHeight: isTablet ? 40 : 34 }}>
                  {college?.name ?? t("home.notAvailable")}
                </Text>
                <Text className={`${secondaryTextClass} mt-2`} style={{ fontSize: 15, lineHeight: 22 }}>
                  {college?.location?.city ? `${college.location.city}, ` : ""}
                  {college?.location?.state ?? ""}
                </Text>
              </View>

              {typeof savedCollege?.matchScore === "number" ? (
                <View style={{ width: stackHeaderRow ? "100%" : isDesktop ? 260 : 240, flexShrink: 0 }}>
                  <MatchScoreBadge
                    score={savedCollege.matchScore}
                    text={t("savedColleges.matchLabel", { score: Math.round(savedCollege.matchScore) })}
                  />
                </View>
              ) : null}
            </View>
          </View>

          {/* Loading */}
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
            isDesktop && hasSidebarCards ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: contentGap,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ gap: 16 }}>
                    {keyStatsCard}
                    {moreInfoCard}
                    {allDataCard}
                  </View>
                </View>

                <View style={{ width: sidebarWidth, flexShrink: 0 }}>
                  <View style={{ gap: 16 }}>
                    {costCard}
                    {linksCard}
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                {keyStatsCard}
                {costCard}
                {moreInfoCard}
                {linksCard}
                {allDataCard}
              </View>
            )
          )}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

