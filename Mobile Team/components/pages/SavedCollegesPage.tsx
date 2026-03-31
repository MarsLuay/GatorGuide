import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type GestureResponderEvent } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ROUTES } from "@/constants/routes";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { MatchScoreBadge } from "@/components/ui/MatchScoreBadge";
import useBack from "@/hooks/use-back";
import type { College } from "@/services/college.service";
import { formatLocalizedCurrency, formatLocalizedNumber, formatLocalizedRate } from "@/utils/locale-format";

function getCollegeTuition(college: College): number | null {
  const tuition = typeof college.tuition === "number" ? college.tuition : college.tuitionInState ?? college.tuitionOutOfState ?? null;
  return typeof tuition === "number" ? tuition : null;
}

export default function SavedCollegesPage() {
  const router = useRouter();
  const back = useBack(ROUTES.tabsResources);
  const { width } = useWindowDimensions();
  const { t, language } = useAppLanguage();
  const { getScrollContentPadding } = useResponsiveLayout();
  const styles = useThemeStyles();
  const { state, removeSavedCollege } = useAppData();
  const [query, setQuery] = useState("");

  const savedColleges = useMemo(() => state.savedColleges ?? [], [state.savedColleges]);
  const { textClass, secondaryTextClass, borderClass, cardBgClass, inputBgClass, placeholderColor } = styles;
  const columns = width >= 900 ? 2 : 1;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
  });

  const filteredColleges = useMemo(() => {
    const search = query.trim().toLowerCase();
    const base = search
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
            .includes(search)
        )
      : savedColleges;

    return [...base].sort((left, right) => {
      const leftMatch = typeof left.matchScore === "number" ? left.matchScore : -1;
      const rightMatch = typeof right.matchScore === "number" ? right.matchScore : -1;
      if (leftMatch !== rightMatch) return rightMatch - leftMatch;
      return left.name.localeCompare(right.name);
    });
  }, [query, savedColleges]);

  const matchedCount = useMemo(
    () => savedColleges.filter((college) => typeof college.matchScore === "number").length,
    [savedColleges]
  );

  const formatTuition = (value: number | null) => {
    if (value === null) return t("home.notAvailable");
    return formatLocalizedCurrency(value, language);
  };

  const formatRate = (value: number | null | undefined) => {
    return formatLocalizedRate(value, language) ?? t("home.notAvailable");
  };

  return (
    <ScreenBackground>
      <ScrollView
        className="flex-1"
        contentContainerStyle={scrollContentPadding}
      >
        <View
          style={{ width: "100%", maxWidth: 1040, alignSelf: "center", paddingHorizontal: 24, paddingTop: 24 }}
        >
          <Pressable onPress={back} className="mb-4 flex-row items-center self-start">
            <MaterialIcons name="arrow-back" size={24} color={placeholderColor} />
            <Text className={`${secondaryTextClass} ml-2`}>{t("general.back")}</Text>
          </Pressable>

          <Text className={`text-2xl ${textClass} mb-1`}>
            {t("savedColleges.title")}
          </Text>
          <Text className={`${secondaryTextClass} mb-6`}>
            {t("savedColleges.subtitle")}
          </Text>

          {savedColleges.length > 0 ? (
            <>
              <View className="flex-row flex-wrap gap-3 mb-4">
                <View className={`${cardBgClass} border rounded-2xl px-4 py-3`}>
                  <Text className={`${secondaryTextClass} text-xs uppercase`}>{t("savedColleges.summarySaved")}</Text>
                  <Text className={`${textClass} text-lg font-semibold`}>{formatLocalizedNumber(savedColleges.length, language)}</Text>
                </View>
                <View className={`${cardBgClass} border rounded-2xl px-4 py-3`}>
                  <Text className={`${secondaryTextClass} text-xs uppercase`}>{t("savedColleges.summaryMatched")}</Text>
                  <Text className={`${textClass} text-lg font-semibold`}>{formatLocalizedNumber(matchedCount, language)}</Text>
                </View>
              </View>

              <View className={`${cardBgClass} border rounded-2xl p-4 mb-5`}>
                <View className="relative">
                  <View className="absolute left-4 top-4 z-10">
                    <Ionicons name="search" size={18} color={placeholderColor} />
                  </View>
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t("savedColleges.searchPlaceholder")}
                    placeholderTextColor={placeholderColor}
                    className={`w-full ${inputBgClass} ${textClass} border ${borderClass} rounded-xl pl-11 pr-4 py-3`}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <Text className={`${secondaryTextClass} text-sm mt-3`}>
                  {t("savedColleges.resultsCount", { count: formatLocalizedNumber(filteredColleges.length, language) })}
                </Text>
              </View>
            </>
          ) : null}

          {savedColleges.length === 0 ? (
            <View className={`${cardBgClass} border rounded-2xl p-6`}>
              <MaterialIcons
                name="bookmark-border"
                size={48}
                color={placeholderColor}
                style={{ alignSelf: "center", marginBottom: 12 }}
              />
              <Text className={`${textClass} text-center font-medium mb-2`}>
                {t("savedColleges.emptyTitle")}
              </Text>
              <Text className={`${secondaryTextClass} text-center text-sm`}>
                {t("savedColleges.emptyHint")}
              </Text>
            </View>
          ) : filteredColleges.length === 0 ? (
            <View className={`${cardBgClass} border rounded-2xl p-6`}>
              <MaterialIcons
                name="search-off"
                size={42}
                color={placeholderColor}
                style={{ alignSelf: "center", marginBottom: 12 }}
              />
              <Text className={`${textClass} text-center font-medium mb-2`}>
                {t("savedColleges.noSearchResultsTitle")}
              </Text>
              <Text className={`${secondaryTextClass} text-center text-sm`}>
                {t("savedColleges.noSearchResultsHint")}
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {filteredColleges.map((college) => {
                const tuition = getCollegeTuition(college);
                const location = [college.location.city, college.location.state].filter(Boolean).join(", ");
                const topPrograms = (college.programs ?? []).slice(0, 2).join(", ");

                return (
                  <Pressable
                    key={college.id}
                    onPress={() => router.push(ROUTES.collegeDetail(String(college.id)))}
                    className={`${cardBgClass} border rounded-2xl p-4 mb-4`}
                    style={{ width: columns === 1 ? "100%" : "48.7%" }}
                  >
                    <View className="flex-row items-start justify-between mb-3">
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text className={`${textClass} font-semibold`} numberOfLines={2}>
                          {college.name}
                        </Text>
                        <Text className={`${secondaryTextClass} text-sm mt-1`} numberOfLines={1}>
                          {location || t("home.notAvailable")}
                        </Text>
                      </View>
                      <Pressable
                        onPress={(event: GestureResponderEvent) => {
                          event?.stopPropagation?.();
                          void removeSavedCollege(college.id);
                        }}
                        className="p-1"
                      >
                        <Ionicons name="bookmark" size={22} color="#008f4e" />
                      </Pressable>
                    </View>

                    {typeof college.matchScore === "number" ? (
                      <MatchScoreBadge
                        score={college.matchScore}
                        text={t("savedColleges.matchLabel", {
                          score: formatLocalizedNumber(Math.round(college.matchScore), language),
                        })}
                        className="mb-3"
                      />
                    ) : null}

                    <View className={`border ${borderClass} rounded-xl p-3 mb-3`}>
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className={`${secondaryTextClass} text-xs`}>{t("savedColleges.tuitionLabel")}</Text>
                        <Text className={`${textClass} text-sm font-medium`}>{formatTuition(tuition)}</Text>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className={`${secondaryTextClass} text-xs`}>{t("savedColleges.admissionRateLabel")}</Text>
                        <Text className={`${textClass} text-sm font-medium`}>
                          {formatRate(college.admissionRate)}
                        </Text>
                      </View>
                    </View>

                    <View className="mb-4">
                      <Text className={`${secondaryTextClass} text-xs mb-1`}>
                        {t("savedColleges.programsLabel")}
                      </Text>
                      <Text className={`${textClass} text-sm`} numberOfLines={2}>
                        {topPrograms || t("home.notAvailable")}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <Text className={`${secondaryTextClass} text-xs`}>
                        {t("savedColleges.viewDetails")}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={placeholderColor} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
