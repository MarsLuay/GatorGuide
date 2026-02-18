import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Switch, Platform, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppData } from "@/hooks/use-app-data";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { College } from "@/services/college.service";
import { aiService, collegeService } from "@/services";
import type { DisabledInfluences, EmptyState, RecommendDebug } from "@/services";

const AI_USAGE_STORAGE_KEY = "gatorguide:ai-usage:v1";
const GUEST_DAILY_AI_LIMIT = 15;
const USER_DAILY_AI_LIMIT = 50;

type DailyUsageRecord = {
  date: string;
  count: number;
};

type DailyUsageStore = Record<string, DailyUsageRecord>;
type DebugAiLimitMeta = {
  reached: boolean;
  limit: number;
  requestedWeighted: boolean;
  effectiveWeighted: boolean;
  aiComponentEnabled: boolean;
};
type DebugSnapshotWithLimit = RecommendDebug & {
  aiLimit?: DebugAiLimitMeta;
};

export default function HomePage() {
  const router = useRouter();
  const { isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const { state, setQuestionnaireAnswers } = useAppData();
  const insets = useSafeAreaInsets();

  const user = state.user;

  const [searchQuery, setSearchQuery] = useState("");
  type Recommended = { college: College; reason?: string; breakdown?: Record<string, number>; score?: number };
  const [results, setResults] = useState<Recommended[]>([]);
  const [emptyState, setEmptyState] = useState<EmptyState | undefined>(undefined);
  const [useWeighted, setUseWeighted] = useState<boolean>(state.questionnaireAnswers?.useWeightedSearch !== "false" && state.questionnaireAnswers?.useWeightedSearch !== false);
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [dismissedGuestPrompt, setDismissedGuestPrompt] = useState(false);
  const showExtraInfoPrompt = !hasSubmittedSearch;
  const [resultsSource, setResultsSource] = useState<'live' | 'cached' | 'stub' | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTooShort, setSearchTooShort] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [showCooldownPopup, setShowCooldownPopup] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const cooldownRef = useRef<number | null>(null);
  const [showDebugConsole, setShowDebugConsole] = useState(false);
  const [debugSnapshot, setDebugSnapshot] = useState<DebugSnapshotWithLimit | null>(null);
  const [debugHotkeyEnabled, setDebugHotkeyEnabled] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"" | "copied" | "failed">("");
  const [aiLimitNotice, setAiLimitNotice] = useState<string | null>(null);
  const [lastAiLimitMeta, setLastAiLimitMeta] = useState<DebugAiLimitMeta>({
    reached: false,
    limit: GUEST_DAILY_AI_LIMIT,
    requestedWeighted: true,
    effectiveWeighted: true,
    aiComponentEnabled: true,
  });
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [disabledInfluences, setDisabledInfluences] = useState<DisabledInfluences>({});
  type SearchRunOptions = {
    overrideUseWeighted?: boolean;
    overrideDisabledInfluences?: DisabledInfluences;
    bypassCooldown?: boolean;
  };

  const capitalizedName = user?.name 
    ? user.name.split(' ')[0].charAt(0).toUpperCase() + user.name.split(' ')[0].slice(1).toLowerCase()
    : t("home.student");

  const hasCompletedQuestionnaire = !!(state.questionnaireAnswers && Object.keys(state.questionnaireAnswers).length > 0);

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";
  const cardClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/90 border-gray-200";
  const inputClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/90 border-gray-200";
  const placeholderTextColor = isDark ? "#9CA3AF" : "#6B7280";

  const formatPercent = (value: unknown) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return `${Math.round(n)}%`;
  };

  const getMatchText = (item: Recommended) => {
    const scoreText = (item as any)?.scoreText;
    if (typeof scoreText === "string" && scoreText.trim().length) return scoreText;
    const score = Number((item as any)?.score);
    if (Number.isFinite(score)) return `${Math.round(score)}/100`;
    return t("home.scoreNotAvailable");
  };

  const buildSimpleWhy = (item: Recommended): string[] => {
    const b = ((item as any)?.breakdown ?? {}) as Record<string, unknown>;
    const lines: string[] = [];

    const majorFit = Number(b.majorFit);
    if (Number.isFinite(majorFit) && majorFit >= 75) lines.push("Strong major/program alignment");
    const queryMatch = Number(b.queryMatch);
    if (Number.isFinite(queryMatch) && queryMatch >= 75) lines.push("Matches your search intent");
    const preferenceFit = Number(b.preferenceFit);
    if (Number.isFinite(preferenceFit) && preferenceFit >= 55) lines.push("Fits your preferences");
    if (Number(b.waMrpParticipant ?? 0) > 0) lines.push("Washington transfer pathway support");
    if (!lines.length) {
      const admission = formatPercent((item.college as any)?.admissionRate ? Number((item.college as any).admissionRate) * 100 : null);
      lines.push(admission ? `Admission rate: ${admission}` : "General profile match");
    }
    return lines.slice(0, 2);
  };

  const getLocalDateKey = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const getAiUsageUserKey = () => {
    const uid = user?.uid || "anonymous";
    return user?.isGuest ? `guest:${uid}` : `user:${uid}`;
  };

  const consumeAiUsageIfAllowed = async (): Promise<{ allowed: boolean; limit: number }> => {
    const limit = user?.isGuest ? GUEST_DAILY_AI_LIMIT : USER_DAILY_AI_LIMIT;
    const today = getLocalDateKey();
    const userKey = getAiUsageUserKey();

    let store: DailyUsageStore = {};
    try {
      const raw = await AsyncStorage.getItem(AI_USAGE_STORAGE_KEY);
      if (raw) store = JSON.parse(raw) as DailyUsageStore;
    } catch {
      store = {};
    }

    const current = store[userKey];
    const currentCount = current?.date === today ? current.count : 0;
    if (currentCount >= limit) return { allowed: false, limit };

    store[userKey] = { date: today, count: currentCount + 1 };
    try {
      await AsyncStorage.setItem(AI_USAGE_STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Ignore persistence failure; request still proceeds.
    }
    return { allowed: true, limit };
  };

  const withAiLimitMeta = (snap: RecommendDebug | null, override?: DebugAiLimitMeta): DebugSnapshotWithLimit | null => {
    if (!snap) return null;
    return {
      ...snap,
      aiLimit: override ?? lastAiLimitMeta,
    };
  };

  const handleSearch = async (runOptions: SearchRunOptions = {}) => {
    const activeUseWeighted = runOptions.overrideUseWeighted ?? useWeighted;
    const activeDisabledInfluences = runOptions.overrideDisabledInfluences ?? disabledInfluences;
    const q = searchQuery.trim();
    setHasSubmittedSearch(true);
    setSearchTooShort(false);
    setAiLimitNotice(null);

    const now = Date.now();
    if (!runOptions.bypassCooldown && cooldownUntil && now < cooldownUntil) {
      const secs = Math.ceil((cooldownUntil - now) / 1000);
      setRemainingSeconds(secs);
      setShowCooldownPopup(true);
      return;
    }

    if (activeUseWeighted && q.length < 2) {
      setResults([]);
      setSearchTooShort(true);
      try { collegeService.getLastSource(); } catch {}
      return;
    }

    // set cooldown (5 seconds)
    const nextUntil = Date.now() + 5000;
    setCooldownUntil(nextUntil);
    cooldownRef.current = nextUntil;

    let effectiveUseWeighted = activeUseWeighted;
    let disableAiComponent = false;
    const defaultLimit = user?.isGuest ? GUEST_DAILY_AI_LIMIT : USER_DAILY_AI_LIMIT;
    let aiLimitMeta: DebugAiLimitMeta = {
      reached: false,
      limit: defaultLimit,
      requestedWeighted: activeUseWeighted,
      effectiveWeighted: effectiveUseWeighted,
      aiComponentEnabled: true,
    };
    if (activeUseWeighted) {
      const quota = await consumeAiUsageIfAllowed();
      if (!quota.allowed) {
        disableAiComponent = true;
        aiLimitMeta = {
          reached: true,
          limit: quota.limit,
          requestedWeighted: activeUseWeighted,
          effectiveWeighted: true,
          aiComponentEnabled: false,
        };
        setAiLimitNotice(`Daily AI limit reached (${quota.limit}). Weighted search stays on; AI factor is disabled.`);
      } else {
        aiLimitMeta = {
          reached: false,
          limit: quota.limit,
          requestedWeighted: activeUseWeighted,
          effectiveWeighted: true,
          aiComponentEnabled: true,
        };
      }
    }
    setLastAiLimitMeta(aiLimitMeta);

    setIsSearching(true);
    try {
      const resp = await aiService.recommendColleges({
        query: q,
        userProfile: user,
        questionnaire: state.questionnaireAnswers,
        maxResults: 20,
        useWeightedSearch: effectiveUseWeighted,
        disableAiComponent,
        disabledInfluences: activeDisabledInfluences,
      });
      setResults(resp.results as Recommended[]);
      setEmptyState(resp.emptyState);
      setResultsSource('live');
      setDebugSnapshot(withAiLimitMeta(aiService.getLastRecommendDebug(), aiLimitMeta));
    } catch (e) {
      setResults([]);
      setEmptyState({
        code: "UPSTREAM_ERROR",
        title: "Search temporarily unavailable",
        message: "The college data service is taking too long. Please try again in a moment.",
      });
      setAiLimitNotice((e as any)?.message || "Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const refreshDebugSnapshot = () => {
    setDebugSnapshot(withAiLimitMeta(aiService.getLastRecommendDebug()));
  };

  const logDebugSnapshot = () => {
    const snap = withAiLimitMeta(aiService.getLastRecommendDebug());
    setDebugSnapshot(snap);
    console.log('[RecommendDebug]', JSON.stringify(snap, null, 2));
  };

  const copyDebugSnapshot = async () => {
    try {
      const snap = withAiLimitMeta(aiService.getLastRecommendDebug());
      const text = JSON.stringify(snap, null, 2);
      if (!text) {
        setCopyStatus("failed");
        return;
      }
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        setCopyStatus("failed");
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };


  useEffect(() => {
    const stored = state.questionnaireAnswers?.useWeightedSearch;
    if (typeof stored === 'boolean') setUseWeighted(stored);
  }, [state.questionnaireAnswers?.useWeightedSearch]);

  const handleToggleWeighted = async (v: boolean) => {
    setUseWeighted(v);
    await setQuestionnaireAnswers({ ...state.questionnaireAnswers, useWeightedSearch: v } as any);
    if (searchQuery.trim().length > 0 || hasSubmittedSearch || results.length > 0) {
      await handleSearch({ overrideUseWeighted: v, bypassCooldown: true });
    }
  };

  const toggleDisabledInfluence = (key: keyof DisabledInfluences, value: boolean) => {
    const next = {
      ...disabledInfluences,
      [key]: value,
    };
    setDisabledInfluences(next);
    if (searchQuery.trim().length > 0 || hasSubmittedSearch || results.length > 0) {
      void handleSearch({ overrideDisabledInfluences: next, bypassCooldown: true });
    }
  };
  // countdown effect for cooldown popup
  useEffect(() => {
    if (!showCooldownPopup && !cooldownUntil) return;

    let interval: number | null = null;
    interval = setInterval(() => {
      const now = Date.now();
      const until = cooldownRef.current ?? cooldownUntil ?? 0;
      const diff = Math.max(0, until - now);
      const secs = Math.ceil(diff / 1000);
      setRemainingSeconds(secs);
      if (diff <= 0) {
        setShowCooldownPopup(false);
        setCooldownUntil(null);
        cooldownRef.current = null;
        if (interval) clearInterval(interval as any);
      }
    }, 250);

    return () => {
      if (interval) clearInterval(interval as any);
    };
  }, [showCooldownPopup, cooldownUntil]);

  useEffect(() => {
    if (!__DEV__ || Platform.OS !== "web") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "~" || event.key === "`" || event.code === "Backquote") {
        setDebugHotkeyEnabled((v) => !v);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <ScreenBackground>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 96 }}>
        <View className="max-w-md w-full self-center px-6 pt-10">
          <Text className={`text-2xl ${textClass} mb-1`}>{t("home.welcomeBack").replace("{name}", capitalizedName)}</Text>
          <Text className={`${secondaryTextClass} mb-6`}>{t("home.findPerfectCollege")}</Text>

          {user?.isGuest && !dismissedGuestPrompt && (
            <View className="mb-6 rounded-2xl p-4 bg-green-500">
              <View className="flex-row items-start gap-3">
                <View className="p-2 rounded-full bg-black/10 mt-1">
                  <Ionicons name="person-add" size={20} color="black" />
                </View>

                <View className="flex-1">
                  <Text className="font-semibold text-black text-base mb-1">{t("home.createAccount")}</Text>
                  <Text className="text-black/80 text-sm mb-3">{t("home.signUpMessage")}</Text>

                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => router.push("/login")}
                      className="flex-1 bg-black rounded-lg py-2 items-center"
                    >
                      <Text className="text-white font-semibold text-sm">{t("home.signUp")}</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setDismissedGuestPrompt(true)}
                      className="flex-1 bg-black/20 rounded-lg py-2 items-center"
                    >
                      <Text className="text-black font-semibold text-sm">{t("home.later")}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          )}

          <View className="relative mb-4">
            <View className="absolute left-4 top-4 z-10">
              <Ionicons name="search" size={20} color={placeholderTextColor} />
            </View>
            <TextInput
              value={searchQuery}
              onChangeText={(v) => { setSearchQuery(v); setSearchTooShort(false); }}
              onSubmitEditing={() => { void handleSearch(); }}
              placeholder={t("home.pressEnterToStart")}
              placeholderTextColor={placeholderTextColor}
              className={`w-full ${inputClass} ${textClass} border rounded-2xl pl-12 pr-24 py-4`}
              returnKeyType="search"
            />
            <Pressable
              onPress={() => { void handleSearch(); }}
              disabled={showCooldownPopup || isSearching}
              className={`absolute right-2 top-2 rounded-xl px-4 py-2 ${showCooldownPopup || isSearching ? 'bg-gray-400' : 'bg-green-500'}`}
            >
              {isSearching ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#111827" />
                  <Text className="text-gray-800 font-semibold">{t("home.searching")}</Text>
                </View>
              ) : (
                <Text className={`${showCooldownPopup ? 'text-gray-800' : 'text-black'} font-semibold`}>{t("home.search")}</Text>
              )}
            </Pressable>
          </View>
          {isSearching ? (
            <View className="flex-row items-center gap-2 mb-3">
              <ActivityIndicator size="small" color={isDark ? "#9CA3AF" : "#6B7280"} />
              <Text className={`${secondaryTextClass} text-sm`}>{t("home.searching")}</Text>
            </View>
          ) : null}
          {aiLimitNotice ? (
            <Text className={`${secondaryTextClass} text-sm mb-3`}>{aiLimitNotice}</Text>
          ) : null}

          {__DEV__ && debugHotkeyEnabled ? (
            <View className={`${cardClass} border rounded-2xl p-3 mb-4`}>
              <View className="flex-row items-center justify-between">
                <Text className={`${textClass} font-semibold`}>Recommendation Dev Console</Text>
                <Pressable
                  onPress={() => setShowDebugConsole((v) => !v)}
                  className="px-3 py-1 rounded-lg bg-green-500"
                >
                  <Text className="text-black font-semibold">{showDebugConsole ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
              <View className="flex-row gap-2 mt-3">
                <Pressable onPress={refreshDebugSnapshot} className="px-3 py-2 rounded-lg bg-gray-300">
                  <Text className="text-black text-xs font-semibold">Refresh Snapshot</Text>
                </Pressable>
                <Pressable onPress={logDebugSnapshot} className="px-3 py-2 rounded-lg bg-gray-300">
                  <Text className="text-black text-xs font-semibold">Log Snapshot</Text>
                </Pressable>
                <Pressable onPress={copyDebugSnapshot} className="px-3 py-2 rounded-lg bg-gray-300">
                  <Text className="text-black text-xs font-semibold">Copy Snapshot</Text>
                </Pressable>
              </View>
              {copyStatus ? (
                <Text className={`${secondaryTextClass} text-xs mt-2`}>
                  {copyStatus === "copied" ? "Snapshot copied to clipboard." : "Clipboard copy failed."}
                </Text>
              ) : null}
              {showDebugConsole ? (
                <Text selectable className={`${secondaryTextClass} text-xs mt-3`}>
                  {debugSnapshot ? JSON.stringify(debugSnapshot, null, 2) : "Run a search first, then tap Refresh Snapshot."}
                </Text>
              ) : null}
            </View>
          ) : null}

          {!hasCompletedQuestionnaire && (
            <Pressable
              onPress={() => router.push("/questionnaire")}
              className="w-full rounded-2xl p-4 flex-row items-center bg-green-500 mb-4"
            >
              <View className="mr-3 p-2 rounded-xl bg-black/10">
                <Ionicons name="document-text" size={18} color="#000" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-black">{t("home.completeQuestionnaire")}</Text>
                <Text className="text-black/70 text-sm">{t("home.getPersonalizedRecommendations")}</Text>
              </View>
              <Ionicons name="sparkles" size={18} color="#000" />
            </Pressable>
          )}

          <Pressable
            onPress={() => router.push("/roadmap")}
            className={`w-full rounded-2xl p-4 flex-row items-center ${cardClass} border`}
          >
            <View className="mr-3 p-2 rounded-xl bg-green-500/20">
              <Ionicons name="map" size={18} color="#22C55E" />
            </View>
            <View className="flex-1">
              <Text className={`font-semibold ${textClass}`}>{t("home.viewRoadmap")}</Text>
              <Text className={`${secondaryTextClass} text-sm`}>{t("home.trackApplicationJourney")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={placeholderTextColor} />
          </Pressable>

          {user && user.major ? (
            <View className="mt-4">
              <Pressable 
                onPress={() => setIsProfileExpanded(!isProfileExpanded)}
                className={`${cardClass} border rounded-2xl p-4`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className={`${textClass}`}>{t("home.yourProfile")}</Text>
                  <Ionicons 
                    name={isProfileExpanded ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={placeholderTextColor} 
                  />
                </View>

                {isProfileExpanded && (
                  <View className="mt-3">
                    <View className="flex-row justify-between mb-2">
                      <Text className={secondaryTextClass}>{t("home.major")}</Text>
                      <Text className="text-green-500">{user ? user.major || t("home.undecided") : t("home.undecided")}</Text>
                    </View>
                    {user && user.gpa && (
                      <View className="flex-row justify-between mb-2">
                        <Text className={secondaryTextClass}>{t("home.gpa")}</Text>
                        <Text className="text-green-500">{user ? user.gpa : ""}</Text>
                      </View>
                    )}

                  </View>
                )}
              </Pressable>
            </View>
          ) : null}

          {showExtraInfoPrompt ? (
            <View className={`${cardClass} border rounded-2xl p-4 mt-4`}>
              <View className="flex-row items-start">
                <View className="mt-0.5 mr-3">
                  <Ionicons name="chatbubble-ellipses" size={18} color={placeholderTextColor} />
                </View>

                <View className="flex-1">
                  <Text className={`${textClass} font-medium mb-1`}>{t("home.anythingElse")}</Text>
                  <Text className={`${secondaryTextClass} text-sm`}>
                    {t("home.anythingElseDescription")}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {results.length > 0 ? (
            <View className="mt-8">
              <View className="flex-row items-center justify-between mb-3">
                <Text className={`${textClass} mr-2`}>{t("home.weightedSearch")}</Text>
                <Switch
                  value={useWeighted}
                  onValueChange={handleToggleWeighted}
                />
              </View>
              {useWeighted ? (
                <View className="mb-3">
                  <Pressable
                    onPress={() => setShowAdvancedSearch((v) => !v)}
                    className={`${cardClass} border rounded-xl px-3 py-2 flex-row items-center justify-between`}
                  >
                    <Text className={`${textClass} font-medium`}>Advanced search</Text>
                    <Ionicons
                      name={showAdvancedSearch ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={placeholderTextColor}
                    />
                  </Pressable>
                  {showAdvancedSearch ? (
                    <View className={`${cardClass} border rounded-xl p-3 mt-2`}>
                      <Text className={`${secondaryTextClass} text-xs mb-2`}>
                        Switch ON to include a factor in ranking. Switch OFF to ignore it.
                      </Text>
                      {([
                        ["gpa", "GPA / academic profile"],
                        ["prestige", "School reputation"],
                        ["major", "Major and program match"],
                        ["preference", "Your questionnaire preferences"],
                        ["query", "Search text relevance"],
                        ["ai", "AI personalization"],
                      ] as [keyof DisabledInfluences, string][]).map(([key, label]) => (
                        <View key={key} className="flex-row items-center justify-between py-1.5">
                          <Text className={textClass}>{label}</Text>
                          <Switch
                            value={!Boolean(disabledInfluences[key])}
                            onValueChange={(v) => toggleDisabledInfluence(key, !v)}
                          />
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View className="flex-row items-center justify-between mb-2">
                <Text className={`text-lg ${textClass}`}>{t("home.recommendedColleges")}</Text>
                {resultsSource ? (
                  <Text className={`${secondaryTextClass} text-xs`}>
                    {resultsSource === 'cached' ? t("home.cachedResults") : resultsSource === 'stub' ? t("home.sampleData") : null}
                  </Text>
                ) : null}
              </View>

              {isSearching ? (
                <Text className={`${secondaryTextClass} text-sm`}>{t("home.searching")}</Text>
              ) : searchTooShort ? (
                <Text className={`${secondaryTextClass} text-sm`}>{t("home.searchTooShort")}</Text>
              ) : results.length === 0 ? (
                <View className="mt-4">
                  <Text className={`${secondaryTextClass} text-sm`}>{emptyState?.title ?? 'No results'}</Text>
                  <Text className={`${secondaryTextClass} text-sm`}>{emptyState?.message ?? 'Try adjusting your filters.'}</Text>
                </View>
              ) : (
                <View className="gap-3">
                  {results.map((r) => {
                    const college = r.college;
                    return (
                      <Pressable
                        key={college.id}
                        className={`${cardClass} border rounded-xl p-4`}
                        onPress={() => router.push({ pathname: "/college/[collegeId]", params: { collegeId: String(college.id) } })}
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className={textClass}>{college.name}</Text>
                          <Text className="text-green-500 font-semibold">Match {getMatchText(r)}</Text>
                        </View>
                        <Text className={`text-sm ${secondaryTextClass} mt-1`}>
                          {college.location.city ? `${college.location.city}, ` : ""}{college.location.state}
                        </Text>
                        {buildSimpleWhy(r).length ? (
                          <View className="mt-2">
                            {buildSimpleWhy(r).map((line) => (
                              <Text key={`${college.id}-${line}`} className={`text-xs ${secondaryTextClass}`}>{line}</Text>
                            ))}
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}
          {showCooldownPopup ? (
            <View className="absolute left-0 right-0 bottom-8 items-center px-4">
              <View className="px-4 py-2 bg-black/70 rounded-full">
                <Text className="text-white text-sm">Try again in {remainingSeconds}s</Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
