import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppData } from "@/hooks/use-app-data";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { College } from "@/services/college.service";
import { aiService, collegeService } from "@/services";

export default function HomePage() {
  const router = useRouter();
  const { isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const { state } = useAppData();
  const insets = useSafeAreaInsets();

  const user = state.user;

  const [searchQuery, setSearchQuery] = useState("");
  type Recommended = { college: College; reason?: string; breakdown?: Record<string, number>; score?: number };
  const [results, setResults] = useState<Recommended[]>([]);
  const [useWeighted, setUseWeighted] = useState(true);
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

  const capitalizedName = user?.name 
    ? user.name.split(' ')[0].charAt(0).toUpperCase() + user.name.split(' ')[0].slice(1).toLowerCase()
    : t("home.student");

  const hasCompletedQuestionnaire = !!(state.questionnaireAnswers && Object.keys(state.questionnaireAnswers).length > 0);

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";
  const cardClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/90 border-gray-200";
  const inputClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/90 border-gray-200";
  const placeholderTextColor = isDark ? "#9CA3AF" : "#6B7280";

  const handleSearch = async () => {
    const q = searchQuery.trim();
    setHasSubmittedSearch(true);
    setSearchTooShort(false);

    const now = Date.now();
    if (cooldownUntil && now < cooldownUntil) {
      const secs = Math.ceil((cooldownUntil - now) / 1000);
      setRemainingSeconds(secs);
      setShowCooldownPopup(true);
      return;
    }

    if (q.length < 3) {
      setResults([]);
      setSearchTooShort(true);
      // let the service know we didn't hit network
      try { collegeService.getLastSource(); } catch {}
      return;
    }

    // compute preference weights for non-AI scoring too
    const prefWeights = aiService.buildPreferenceWeights(user, state.questionnaireAnswers);

    // set cooldown (5 seconds)
    const nextUntil = Date.now() + 5000;
    setCooldownUntil(nextUntil);
    cooldownRef.current = nextUntil;

    setIsSearching(true);
    try {
      if (useWeighted) {
        // Weighted: AI recommender (profile + questionnaire + query)
        const data = await aiService.recommendColleges({ query: q, userProfile: user, questionnaire: state.questionnaireAnswers, maxResults: 20 });
        setResults(data as Recommended[]);
        setResultsSource('live');
      } else {
        // Normal: run a plain college search and score locally
        const list = await collegeService.searchColleges(q);
        const mapped = list.slice(0, 20).map((c) => {
          const breakdown = aiService.computePreferenceBreakdown(c, prefWeights, user, state.questionnaireAnswers);
          return { college: c, reason: undefined, breakdown, score: breakdown.final } as Recommended;
        });
        setResults(mapped);
        setResultsSource(null);
      }
    } finally {
      setIsSearching(false);
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
              onSubmitEditing={handleSearch}
              placeholder={t("home.pressEnterToStart")}
              placeholderTextColor={placeholderTextColor}
              className={`w-full ${inputClass} ${textClass} border rounded-2xl pl-12 pr-24 py-4`}
              returnKeyType="search"
            />
            <Pressable
              onPress={handleSearch}
              disabled={showCooldownPopup}
              className={`absolute right-2 top-2 rounded-xl px-4 py-2 ${showCooldownPopup ? 'bg-gray-400' : 'bg-green-500'}`}
            >
              <Text className={`${showCooldownPopup ? 'text-gray-800' : 'text-black'} font-semibold`}>{t("home.search")}</Text>
            </Pressable>
          </View>

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

                    {user && user.sat && (
                      <View className="flex-row justify-between mb-2">
                        <Text className={secondaryTextClass}>{t("home.satScore")}</Text>
                        <Text className="text-green-500">{user ? user.sat : ""}</Text>
                      </View>
                    )}

                    {user && user.act && (
                      <View className="flex-row justify-between">
                        <Text className={secondaryTextClass}>{t("home.actScore")}</Text>
                        <Text className="text-green-500">{user ? user.act : ""}</Text>
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
                  onValueChange={(v) => setUseWeighted(v)}
                />
              </View>
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
                        <Text className={textClass}>{college.name}</Text>
                        { (r as any).scoreText ? (
                          <Text className={`text-sm ${secondaryTextClass} mt-1`}>{(r as any).scoreText}</Text>
                        ) : (
                          <Text className={`text-sm ${secondaryTextClass} mt-1`}>{t("home.scoreNotAvailable")}</Text>
                        ) }
                        <Text className={`text-sm ${secondaryTextClass} mt-1`}>
                          {college.location.city ? `${college.location.city}, ` : ""}{college.location.state}
                        </Text>
                        <Text className={`text-sm ${secondaryTextClass} mt-1`}>{t("home.admissionRate")}: {typeof college.admissionRate === 'number' ? `${Math.round(college.admissionRate * 100)}%` : t("home.notAvailable")}</Text>
                        {r.reason ? (
                          <Text className={`text-sm mt-2 ${secondaryTextClass}`}>{r.reason}</Text>
                        ) : null}

                        { (r as any).breakdownHuman ? (
                          <Text className={`text-xs mt-2 ${secondaryTextClass}`}>
                            {Object.entries((r as any).breakdownHuman).filter(([k])=>k!=='Overall').map(([k,v])=> `${k}: ${v}`).join(' • ')}
                          </Text>
                        ) : r.breakdown ? (
                          <Text className={`text-xs mt-2 ${secondaryTextClass}`}>
                            {Object.entries(r.breakdown).filter(([k])=>k!=='final').map(([k,v])=> `${k}: ${Math.round(v as number)}`).join(' • ')}
                          </Text>
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