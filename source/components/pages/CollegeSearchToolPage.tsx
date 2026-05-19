import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import {
  AnimatedCardPressable,
  AnimatedChipPressable,
  AnimatedIconPressable,
} from "@/components/ui/AnimatedPressables";
import { PageBackButton } from "@/components/ui/PageBackButton";
import { StateCard } from "@/components/ui/StateCard";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { ROUTES } from "@/constants/routes";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import useBack from "@/hooks/use-back";
import type { EmptyState } from "@/services/ai/ai.service";
import { collegeService, type College } from "@/services/colleges/college.service";
import { errorLoggingService } from "@/services/logging/error-logging.service";

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenizeSearchText(value: string) {
  return Array.from(new Set(normalizeSearchText(value).split(/\s+/).filter(Boolean)));
}

function isDisplayProgramTitle(value: string) {
  return /[a-z]/i.test(value) && !/^\d{4,6}$/.test(value);
}

function getProgramMatchScore(query: string, title: string) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedTitle = normalizeSearchText(title);
  if (!normalizedQuery || !normalizedTitle) return 0;

  if (normalizedTitle === normalizedQuery) return 150;
  if (normalizedTitle.startsWith(`${normalizedQuery} `) || normalizedTitle.startsWith(normalizedQuery)) {
    return 125;
  }
  if (normalizedTitle.includes(normalizedQuery)) return 105;

  const queryTokens = tokenizeSearchText(normalizedQuery);
  const titleTokens = tokenizeSearchText(normalizedTitle);
  const exactTokenHits = queryTokens.filter((token) => titleTokens.includes(token)).length;
  if (!queryTokens.length || exactTokenHits === 0) return 0;
  if (exactTokenHits === queryTokens.length) {
    return 90 - Math.max(0, titleTokens.length - queryTokens.length) * 3;
  }
  return Math.round((exactTokenHits / queryTokens.length) * 70);
}

function getMatchingProgramsForQuery(college: College, query: string) {
  return Array.from(
    new Set(
      (college.programs ?? [])
        .map((program) => String(program ?? "").trim())
        .filter((program) => program.length > 0 && isDisplayProgramTitle(program))
    )
  )
    .map((program) => ({ program, score: getProgramMatchScore(query, program) }))
    .filter(({ score }) => score >= 70)
    .sort((a, b) => b.score - a.score || a.program.localeCompare(b.program))
    .slice(0, 3)
    .map(({ program }) => program);
}

function matchesSchoolName(college: College, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  const name = normalizeSearchText(college.name);
  if (!normalizedQuery || !name) return false;
  if (name.includes(normalizedQuery)) return true;
  const queryTokens = tokenizeSearchText(normalizedQuery);
  return queryTokens.length > 0 && queryTokens.every((token) => name.includes(token));
}

export default function CollegeSearchToolPage() {
  const router = useRouter();
  const { t } = useAppLanguage();
  const back = useBack(ROUTES.tabsResources);
  const { textClass, secondaryTextClass, cardBgClass, inputBgClass, placeholderColor } =
    useThemeStyles();
  const {
    state,
    addSavedCollege,
    removeSavedCollege,
    isCollegeSaved,
  } = useAppData();
  const { width } = useWindowDimensions();
  const { getScrollContentPadding } = useResponsiveLayout();

  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [results, setResults] = useState<College[]>([]);
  const [emptyState, setEmptyState] = useState<EmptyState | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTooShort, setSearchTooShort] = useState(false);
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(false);
  const [resultsSource, setResultsSource] = useState<"live" | "cached" | "stub" | null>(null);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);

  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isDesktop = width >= 1180;
  const stackSearchActions = width < 760;
  const showSplitLayout = width >= 1120;
  const shellMaxWidth = isDesktop ? 1280 : isTablet ? 980 : 720;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 16,
  });
  const panelClass = `${cardBgClass} border rounded-[28px] p-5`;
  const nestedPanelClass = `${cardBgClass} border rounded-2xl`;
  const showResultsSection =
    hasSubmittedSearch || isSearching || searchTooShort || !!emptyState || results.length > 0;
  const hasCompletedQuestionnaire = !!(
    state.questionnaireAnswers && Object.keys(state.questionnaireAnswers).length > 0
  );

  const handleSearch = useCallback(
    async () => {
      const query = searchQuery.trim();

      setHasSubmittedSearch(true);
      setSearchTooShort(false);
      setSearchNotice(null);

      if (query.length < 2) {
        setResults([]);
        setEmptyState(undefined);
        setResultsSource(null);
        setSubmittedQuery("");
        setSearchTooShort(true);
        return;
      }

      setIsSearching(true);
      try {
        const colleges = await collegeService.searchColleges(query);
        setResults(colleges);
        setSubmittedQuery(query);
        setEmptyState(undefined);

        const source = collegeService.getLastSource();
        setResultsSource(source === "cached" ? "cached" : source === "stub" ? "stub" : "live");
      } catch (error) {
        void errorLoggingService.captureException(error, {
          category: "api",
          operation: "college-search-tool-search",
          severity: "error",
          handled: true,
          source: "CollegeSearchToolPage",
          screen: "CollegeSearchToolPage",
          route: ROUTES.collegeSearch,
          metadata: {
            queryLength: query.length,
          },
        });

        setResults([]);
        setSubmittedQuery(query);
        setResultsSource(null);
        setEmptyState({
          code: "UPSTREAM_ERROR",
          title: t("home.searchUnavailableTitle"),
          message: t("home.searchUnavailableMessage"),
        });
        setSearchNotice(error instanceof Error ? error.message : t("home.searchFailed"));
      } finally {
        setIsSearching(false);
      }
    },
    [searchQuery, t]
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

          <AnimatedChipPressable
            onPress={() => {
              void handleSearch();
            }}
            disabled={isSearching}
            className={`rounded-2xl px-4 py-3 items-center justify-center ${isSearching ? "bg-emerald-400" : "bg-emerald-500"}`}
            containerStyle={stackSearchActions ? { width: "100%" } : { minWidth: 132 }}
            style={stackSearchActions ? { width: "100%", minHeight: 50 } : undefined}
          >
            {isSearching ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text className="text-white font-semibold">{t("home.searching")}</Text>
              </View>
            ) : (
              <Text className="text-white font-semibold">{t("home.search")}</Text>
            )}
          </AnimatedChipPressable>
        </View>

        {searchNotice ? (
          <StatusBanner
            variant={emptyState?.code === "UPSTREAM_ERROR" ? "error" : "warning"}
            title={emptyState?.code === "UPSTREAM_ERROR" ? t("general.error") : undefined}
            message={searchNotice}
            className="mt-4"
          />
        ) : null}

        {!hasCompletedQuestionnaire ? (
          <AnimatedCardPressable
            onPress={() =>
              router.push({
                pathname: ROUTES.questionnaire,
                params: { returnTo: ROUTES.collegeSearch },
              } as never)
            }
            className="mt-4 rounded-2xl p-4 bg-emerald-500"
            style={{
              flexDirection: stackSearchActions ? "column" : "row",
              alignItems: stackSearchActions ? "flex-start" : "center",
              gap: 12,
            }}
          >
            <View className="p-2 rounded-xl bg-emerald-900/10">
              <Ionicons name="document-text" size={18} color="#001f0f" />
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-emerald-900">{t("home.completeQuestionnaire")}</Text>
              <Text className="text-emerald-900/70 text-sm">
                {t("collegeSearchTool.questionnaireCardBody")}
              </Text>
            </View>
            <Ionicons
              name="sparkles"
              size={18}
              color="#001f0f"
              style={stackSearchActions ? { alignSelf: "flex-end" } : undefined}
            />
          </AnimatedCardPressable>
        ) : null}
      </View>

    </View>
  );

  const resultsPanel = (
    <View style={showSplitLayout ? { flex: 1, minWidth: 0 } : undefined}>
      <View className={panelClass}>
        <View
          style={{
            flexDirection: stackSearchActions ? "column" : "row",
            alignItems: stackSearchActions ? "stretch" : "flex-start",
            justifyContent: "space-between",
            gap: stackSearchActions ? 12 : 16,
            marginBottom: 16,
          }}
        >
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>
              {t("collegeSearchTool.resultsTitle")}
            </Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              {t("collegeSearchTool.resultsBody")}
            </Text>
          </View>
          {resultsSource ? (
            <View
              className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20"
              style={stackSearchActions ? { alignItems: "center", width: "100%" } : undefined}
            >
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

        {!showResultsSection ? (
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
            {results.map((college) => {
              const saved = isCollegeSaved(college.id);
              const matchingPrograms = getMatchingProgramsForQuery(college, submittedQuery);
              const matchedBySchoolName = matchesSchoolName(college, submittedQuery);

              return (
                <AnimatedCardPressable
                  key={college.id}
                  className={`${nestedPanelClass} p-4`}
                  onPress={() =>
                    router.push(
                      ROUTES.collegeDetail(String(college.id), {
                        returnTo: ROUTES.collegeSearch,
                      })
                    )
                  }
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1 min-w-0">
                      <Text className={`${textClass} font-semibold`} numberOfLines={2}>
                        {college.name}
                      </Text>
                    </View>

                    <AnimatedIconPressable
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        if (saved) {
                          void removeSavedCollege(college.id);
                          return;
                        }
                        void addSavedCollege(college);
                      }}
                      className="p-2"
                    >
                      <Ionicons
                        name={saved ? "bookmark" : "bookmark-outline"}
                        size={24}
                        color={saved ? "#008f4e" : placeholderColor}
                      />
                    </AnimatedIconPressable>
                  </View>

                  <Text className={`text-sm ${secondaryTextClass} mt-2`}>
                    {college.location.city ? `${college.location.city}, ` : ""}
                    {college.location.state}
                  </Text>

                  {matchingPrograms.length ? (
                    <View className="mt-3">
                      <Text className={`text-xs ${secondaryTextClass} font-semibold`}>
                        {t("collegeSearchTool.matchingProgramsLabel")}
                      </Text>
                      <Text className={`text-xs ${secondaryTextClass} mt-1`}>
                        {matchingPrograms.join(", ")}
                      </Text>
                    </View>
                  ) : matchedBySchoolName ? (
                    <Text className={`text-xs ${secondaryTextClass} mt-3`}>
                      {t("collegeSearchTool.matchedBySchoolName")}
                    </Text>
                  ) : null}
                </AnimatedCardPressable>
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
            <PageBackButton onPress={back} label={t("general.back")} textClassName={secondaryTextClass} />

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
