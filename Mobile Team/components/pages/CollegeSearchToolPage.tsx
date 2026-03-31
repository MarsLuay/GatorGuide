import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { MatchScoreBadge } from "@/components/ui/MatchScoreBadge";
import { StateCard } from "@/components/ui/StateCard";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { ROUTES } from "@/constants/routes";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import useBack from "@/hooks/use-back";
import { aiService, collegeService, errorLoggingService, type DisabledInfluences, type EmptyState, type College } from "@/services";
import { formatLocalizedRate } from "@/utils/locale-format";

type RecommendedCollege = {
  college: College;
  reason?: string;
  breakdown?: Record<string, number>;
  score?: number;
  scoreText?: string;
};

function getMatchText(item: RecommendedCollege, fallback: string) {
  if (typeof item.scoreText === "string" && item.scoreText.trim().length) return item.scoreText;
  const score = Number(item.score);
  if (Number.isFinite(score)) return `${Math.round(score)}/100`;
  return fallback;
}

function getMatchScore(item: RecommendedCollege): number | null {
  const score = Number(item.score);
  return Number.isFinite(score) ? score : null;
}

function buildSimpleWhy(
  item: RecommendedCollege,
  t: (key: string, params?: Record<string, string | number>) => string,
  language?: Parameters<typeof formatLocalizedRate>[1]
): string[] {
  const breakdown = (item.breakdown ?? {}) as Record<string, unknown>;
  const lines: string[] = [];

  const majorFit = Number(breakdown.majorFit);
  if (Number.isFinite(majorFit) && majorFit >= 75) lines.push(t("home.whyMajorAlignment"));
  const queryMatch = Number(breakdown.queryMatch);
  if (Number.isFinite(queryMatch) && queryMatch >= 75) lines.push(t("home.whySearchIntent"));
  const preferenceFit = Number(breakdown.preferenceFit);
  if (Number.isFinite(preferenceFit) && preferenceFit >= 55) lines.push(t("home.whyPreferences"));
  if (Number(breakdown.waMrpParticipant ?? 0) > 0) lines.push(t("home.whyTransferPathway"));

  if (!lines.length) {
    const admission = formatLocalizedRate(Number(item.college.admissionRate ?? NaN), language);
    lines.push(
      admission
        ? t("home.whyAdmissionRate", { value: admission })
        : t("home.whyGeneralMatch")
    );
  }

  return lines.slice(0, 2);
}

export default function CollegeSearchToolPage() {
  const router = useRouter();
  const { t, language } = useAppLanguage();
  const back = useBack(ROUTES.tabsResources);
  const { textClass, secondaryTextClass, cardBgClass, inputBgClass, placeholderColor } =
    useThemeStyles();
  const {
    state,
    addSavedCollege,
    removeSavedCollege,
    isCollegeSaved,
    setQuestionnaireAnswers,
  } = useAppData();
  const { width } = useWindowDimensions();
  const { getScrollContentPadding } = useResponsiveLayout();

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<RecommendedCollege[]>([]);
  const [emptyState, setEmptyState] = useState<EmptyState | undefined>(undefined);
  const [useWeighted, setUseWeighted] = useState<boolean>(
    state.questionnaireAnswers?.useWeightedSearch !== "false" &&
      state.questionnaireAnswers?.useWeightedSearch !== false
  );
  const [isSearching, setIsSearching] = useState(false);
  const [searchTooShort, setSearchTooShort] = useState(false);
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(false);
  const [resultsSource, setResultsSource] = useState<"live" | "cached" | "stub" | null>(null);
  const [aiLimitNotice, setAiLimitNotice] = useState<string | null>(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [disabledInfluences, setDisabledInfluences] = useState<DisabledInfluences>({});

  const isTablet = width >= 768;
  const isDesktop = width >= 1180;
  const stackSearchActions = width < 760;
  const showSplitLayout = width >= 1120;
  const shellMaxWidth = isDesktop ? 1280 : isTablet ? 980 : 720;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : 20;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 16,
  });
  const panelClass = `${cardBgClass} border rounded-[28px] p-5`;
  const nestedPanelClass = `${cardBgClass} border rounded-2xl`;
  const mutedPanelClass = `${cardBgClass} border rounded-2xl px-4 py-4`;
  const showRecommendationSection =
    hasSubmittedSearch || isSearching || searchTooShort || !!emptyState || results.length > 0;
  const hasCompletedQuestionnaire = !!(
    state.questionnaireAnswers && Object.keys(state.questionnaireAnswers).length > 0
  );

  useEffect(() => {
    const stored = state.questionnaireAnswers?.useWeightedSearch;
    if (typeof stored === "boolean") {
      setUseWeighted(stored);
    }
  }, [state.questionnaireAnswers?.useWeightedSearch]);

  const handleSearch = useCallback(
    async (runOptions?: {
      overrideUseWeighted?: boolean;
      overrideDisabledInfluences?: DisabledInfluences;
    }) => {
      const activeUseWeighted = runOptions?.overrideUseWeighted ?? useWeighted;
      const activeDisabledInfluences =
        runOptions?.overrideDisabledInfluences ?? disabledInfluences;
      const query = searchQuery.trim();

      setHasSubmittedSearch(true);
      setSearchTooShort(false);
      setAiLimitNotice(null);

      if (activeUseWeighted && query.length < 2) {
        setResults([]);
        setEmptyState(undefined);
        setResultsSource(null);
        setSearchTooShort(true);
        return;
      }

      setIsSearching(true);
      try {
        const response = await aiService.recommendColleges({
          query,
          userProfile: state.user,
          questionnaire: state.questionnaireAnswers,
          maxResults: 20,
          useWeightedSearch: activeUseWeighted,
          disableAiComponent: false,
          disabledInfluences: activeDisabledInfluences,
        });

        setResults(response.results as RecommendedCollege[]);
        setEmptyState(response.emptyState);

        const source = collegeService.getLastSource();
        setResultsSource(source === "cached" ? "cached" : source === "stub" ? "stub" : "live");
      } catch (error) {
        void errorLoggingService.captureException(error, {
          category: "ai",
          operation: "recommend-colleges-tool-search",
          severity: "error",
          handled: true,
          source: "CollegeSearchToolPage",
          screen: "CollegeSearchToolPage",
          route: ROUTES.collegeSearch,
          metadata: {
            queryLength: query.length,
            useWeightedSearch: activeUseWeighted,
            disabledInfluences: activeDisabledInfluences,
          },
        });

        setResults([]);
        setResultsSource(null);
        setEmptyState({
          code: "UPSTREAM_ERROR",
          title: t("home.searchUnavailableTitle"),
          message: t("home.searchUnavailableMessage"),
        });
        setAiLimitNotice(error instanceof Error ? error.message : t("home.searchFailed"));
      } finally {
        setIsSearching(false);
      }
    },
    [
      disabledInfluences,
      searchQuery,
      setResults,
      state.questionnaireAnswers,
      state.user,
      t,
      useWeighted,
    ]
  );

  const handleToggleWeighted = useCallback(
    async (value: boolean) => {
      setUseWeighted(value);
      await setQuestionnaireAnswers({
        ...state.questionnaireAnswers,
        useWeightedSearch: value,
      } as any);

      if (searchQuery.trim().length > 0 || hasSubmittedSearch || results.length > 0) {
        await handleSearch({ overrideUseWeighted: value });
      }
    },
    [
      handleSearch,
      hasSubmittedSearch,
      results.length,
      searchQuery,
      setQuestionnaireAnswers,
      state.questionnaireAnswers,
    ]
  );

  const toggleDisabledInfluence = useCallback(
    (key: keyof DisabledInfluences, value: boolean) => {
      const next = {
        ...disabledInfluences,
        [key]: value,
      };
      setDisabledInfluences(next);

      if (searchQuery.trim().length > 0 || hasSubmittedSearch || results.length > 0) {
        void handleSearch({ overrideDisabledInfluences: next });
      }
    },
    [disabledInfluences, handleSearch, hasSubmittedSearch, results.length, searchQuery]
  );

  const headerSubtitle = hasCompletedQuestionnaire
    ? t("collegeSearchTool.subtitleReady")
    : t("collegeSearchTool.subtitleSetup");

  const controlsPanel = (
    <View style={showSplitLayout ? { width: 372, flexShrink: 0 } : undefined}>
      <View className={panelClass}>
        <View className="flex-row items-start mb-4">
          <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
            <Ionicons name="search-outline" size={18} color="#008f4e" />
          </View>
          <View className="flex-1">
            <Text className={`${textClass} text-lg font-semibold`}>{t("collegeSearchTool.searchSectionTitle")}</Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              {t("collegeSearchTool.searchSectionBody")}
            </Text>
          </View>
        </View>

        <View
          style={stackSearchActions ? { gap: 12 } : { flexDirection: "row", gap: 12, alignItems: "stretch" }}
        >
          <View className="relative" style={{ flex: 1, minWidth: 0 }}>
            <View className="absolute left-4 top-4 z-10">
              <Ionicons name="search" size={20} color={placeholderColor} />
            </View>
            <TextInput
              value={searchQuery}
              onChangeText={(value) => {
                setSearchQuery(value);
                setSearchTooShort(false);
              }}
              onSubmitEditing={() => {
                void handleSearch();
              }}
              placeholder={t("home.pressEnterToStart")}
              placeholderTextColor={placeholderColor}
              className={`w-full ${inputBgClass} ${textClass} border rounded-2xl pl-12 pr-4 py-4`}
              returnKeyType="search"
            />
          </View>

          <Pressable
            onPress={() => {
              void handleSearch();
            }}
            disabled={isSearching}
            className={`rounded-2xl px-4 py-3 items-center justify-center ${isSearching ? "bg-emerald-400" : "bg-emerald-500"}`}
            style={stackSearchActions ? undefined : { minWidth: 132 }}
          >
            {isSearching ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text className="text-white font-semibold">{t("home.searching")}</Text>
              </View>
            ) : (
              <Text className="text-white font-semibold">{t("home.search")}</Text>
            )}
          </Pressable>
        </View>

        {aiLimitNotice ? (
          <StatusBanner
            variant={emptyState?.code === "UPSTREAM_ERROR" ? "error" : "warning"}
            title={emptyState?.code === "UPSTREAM_ERROR" ? t("general.error") : undefined}
            message={aiLimitNotice}
            className="mt-4"
          />
        ) : null}

        {!hasCompletedQuestionnaire ? (
          <Pressable
            onPress={() => router.push(ROUTES.questionnaire)}
            className="mt-4 rounded-2xl p-4 flex-row items-center bg-emerald-500"
          >
            <View className="mr-3 p-2 rounded-xl bg-emerald-900/10">
              <Ionicons name="document-text" size={18} color="#001f0f" />
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-emerald-900">{t("home.completeQuestionnaire")}</Text>
              <Text className="text-emerald-900/70 text-sm">{t("home.getPersonalizedRecommendations")}</Text>
            </View>
            <Ionicons name="sparkles" size={18} color="#001f0f" />
          </Pressable>
        ) : null}
      </View>

      <View className={`${panelClass} mt-6`}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className={`${textClass} text-lg font-semibold`}>{t("collegeSearchTool.rankingTitle")}</Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              {t("collegeSearchTool.rankingBody")}
            </Text>
          </View>
          <Switch value={useWeighted} onValueChange={handleToggleWeighted} />
        </View>

        {useWeighted ? (
          <View className="mt-4">
            <Pressable
              onPress={() => setShowAdvancedSearch((value) => !value)}
              className={`${nestedPanelClass} px-4 py-3 flex-row items-center justify-between`}
            >
              <Text className={`${textClass} font-medium`}>{t("home.advancedSearch")}</Text>
              <Ionicons
                name={showAdvancedSearch ? "chevron-up" : "chevron-down"}
                size={18}
                color={placeholderColor}
              />
            </Pressable>

            {showAdvancedSearch ? (
              <View className={`${nestedPanelClass} p-4 mt-3`}>
                <Text className={`${secondaryTextClass} text-xs mb-2`}>
                  {t("home.advancedSearchHint")}
                </Text>
                {([
                  ["gpa", t("home.rankingFactorGpa")],
                  ["prestige", t("home.rankingFactorPrestige")],
                  ["major", t("home.rankingFactorMajor")],
                  ["preference", t("home.rankingFactorPreference")],
                  ["query", t("home.rankingFactorQuery")],
                  ["ai", t("home.rankingFactorAi")],
                ] as [keyof DisabledInfluences, string][]).map(([key, label]) => (
                  <View key={key} className="flex-row items-center justify-between py-2">
                    <Text className={`${textClass} flex-1 pr-4`}>{label}</Text>
                    <Switch
                      value={!Boolean(disabledInfluences[key])}
                      onValueChange={(value) => toggleDisabledInfluence(key, !value)}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View className={`${mutedPanelClass} mt-4`}>
            <Text className={`${secondaryTextClass} text-sm`}>
              {t("collegeSearchTool.weightedOffBody")}
            </Text>
          </View>
        )}
      </View>

      <View className={`${panelClass} mt-6`}>
        <Text className={`${textClass} text-lg font-semibold`}>{t("collegeSearchTool.otherToolsTitle")}</Text>
        <Text className={`${secondaryTextClass} text-sm mt-1 mb-4`}>
          {t("collegeSearchTool.otherToolsBody")}
        </Text>

        <View className="gap-3">
          {[
            {
              id: "calendar",
              icon: "calendar-outline" as const,
              title: t("home.deadlineCalendarTitle"),
              description: t("deadlineCalendar.subtitle"),
              onPress: () => router.push(ROUTES.calendar),
            },
            {
              id: "saved-colleges",
              icon: "bookmark-outline" as const,
              title: t("resources.savedColleges"),
              description: t("resources.savedCollegesDesc"),
              onPress: () => router.push(ROUTES.savedColleges),
            },
            {
              id: "compare",
              icon: "git-compare-outline" as const,
              title: t("resources.compareColleges"),
              description: t("resources.compareCollegesDesc"),
              onPress: () => router.push(ROUTES.compare),
            },
          ].map((tool) => (
            <Pressable
              key={tool.id}
              onPress={tool.onPress}
              className={`${nestedPanelClass} px-4 py-4 flex-row items-center`}
            >
              <View className="w-10 h-10 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
                <Ionicons name={tool.icon} size={18} color="#008f4e" />
              </View>
              <View className="flex-1">
                <Text className={`${textClass} font-semibold`}>{tool.title}</Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>{tool.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={placeholderColor} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  const resultsPanel = (
    <View style={showSplitLayout ? { flex: 1, minWidth: 0 } : undefined}>
      <View className={panelClass}>
        <View className="flex-row items-start justify-between gap-4 mb-4">
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>{t("home.recommendedColleges")}</Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              {t("collegeSearchTool.resultsBody")}
            </Text>
          </View>
          {resultsSource ? (
            <View className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Text className="text-emerald-500 text-xs font-semibold">
                {resultsSource === "cached"
                  ? t("home.cachedResults")
                  : resultsSource === "stub"
                    ? t("home.sampleData")
                    : t("collegeSearchTool.liveResults")}
              </Text>
            </View>
          ) : null}
        </View>

        {!showRecommendationSection ? (
          <StateCard
            variant="info"
            title={t("collegeSearchTool.searchPromptTitle")}
            message={t("collegeSearchTool.searchPromptBody")}
            compact
          />
        ) : isSearching ? (
          <StateCard
            variant="loading"
            title={t("home.searching")}
            message={t("general.pleaseWait")}
            compact
          />
        ) : searchTooShort ? (
          <StateCard
            variant="empty"
            title={t("home.searchTooShort")}
            message={t("home.pressEnterToStart")}
            compact
          />
        ) : results.length === 0 ? (
          <StateCard
            variant={emptyState?.code === "UPSTREAM_ERROR" ? "error" : "empty"}
            title={emptyState?.title ?? t("home.noResults")}
            message={emptyState?.message ?? t("home.adjustFilters")}
            actionLabel={emptyState?.code === "UPSTREAM_ERROR" ? t("general.retry") : undefined}
            onAction={
              emptyState?.code === "UPSTREAM_ERROR"
                ? () => {
                    void handleSearch();
                  }
                : undefined
            }
            compact
          />
        ) : (
          <View className="gap-3">
            {results.map((result) => {
              const { college } = result;
              const saved = isCollegeSaved(college.id);
              const matchScore = getMatchScore(result);

              return (
                <Pressable
                  key={college.id}
                  className={`${nestedPanelClass} p-4`}
                  onPress={() => router.push(ROUTES.collegeDetail(String(college.id)))}
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1 min-w-0">
                      <Text className={`${textClass} font-semibold`} numberOfLines={2}>
                        {college.name}
                      </Text>

                      {matchScore != null ? (
                        <MatchScoreBadge
                          score={matchScore}
                          text={t("home.matchLabel", {
                            value: getMatchText(result, t("home.scoreNotAvailable")),
                          })}
                          className="mt-2"
                          textClassName="text-sm"
                        />
                      ) : (
                        <Text className={`${secondaryTextClass} font-semibold mt-2`}>
                          {t("home.matchLabel", {
                            value: getMatchText(result, t("home.scoreNotAvailable")),
                          })}
                        </Text>
                      )}
                    </View>

                    <Pressable
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        if (saved) {
                          void removeSavedCollege(college.id);
                          return;
                        }
                        void addSavedCollege(matchScore != null ? { ...college, matchScore } : college);
                      }}
                      className="p-2"
                    >
                      <Ionicons
                        name={saved ? "bookmark" : "bookmark-outline"}
                        size={24}
                        color={saved ? "#008f4e" : placeholderColor}
                      />
                    </Pressable>
                  </View>

                  <Text className={`text-sm ${secondaryTextClass} mt-2`}>
                    {college.location.city ? `${college.location.city}, ` : ""}
                    {college.location.state}
                  </Text>

                  {buildSimpleWhy(result, t, language).length ? (
                    <View className="mt-3">
                      {buildSimpleWhy(result, t, language).map((line) => (
                        <Text key={`${college.id}-${line}`} className={`text-xs ${secondaryTextClass}`}>
                          {line}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <ScreenBackground includeBottomInset={false}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={scrollContentPadding}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: "100%",
            maxWidth: shellMaxWidth,
            alignSelf: "center",
            paddingHorizontal: shellHorizontalPadding,
          }}
        >
          <View className="pt-8 pb-6">
            <Pressable onPress={back} className="mb-4 flex-row items-center self-start">
              <MaterialIcons name="arrow-back" size={24} color={placeholderColor} />
              <Text className={`${secondaryTextClass} ml-2`}>{t("general.back")}</Text>
            </Pressable>

            <Text className={`text-3xl ${textClass}`}>{t("collegeSearchTool.title")}</Text>
            <Text className={`${secondaryTextClass} mt-2`} style={{ lineHeight: 22 }}>
              {headerSubtitle}
            </Text>
          </View>

          <View
            style={
              showSplitLayout
                ? { flexDirection: "row", alignItems: "flex-start", gap: 24 }
                : { gap: 24 }
            }
          >
            {controlsPanel}
            {resultsPanel}
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
