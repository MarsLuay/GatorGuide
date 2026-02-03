import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useTranslation } from "react-i18next";

export default function HomePage() {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  const { state } = useAppData();
  const insets = useSafeAreaInsets();
  
  const user = state.user;

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);

  if (!user) return null;

  const capitalizedName = user.name 
    ? user.name.split(' ')[0].charAt(0).toUpperCase() + user.name.split(' ')[0].slice(1).toLowerCase()
    : t("home.student");

  const hasCompletedQuestionnaire = !!(state.questionnaireAnswers && Object.keys(state.questionnaireAnswers).length > 0);

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";
  const cardClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/90 border-gray-200";
  const inputClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/90 border-gray-200";
  const placeholderTextColor = isDark ? "#9CA3AF" : "#6B7280";

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setHasSubmittedSearch(true);
    setResults([
      "Massachusetts Institute of Technology (MIT)",
      "Stanford University",
      "Harvard University",
      "California Institute of Technology",
      "University of California, Berkeley",
    ]);
  };

  return (
    <ScreenBackground>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 96 }}>
        <View className="max-w-md w-full self-center px-6 pt-10">
          <Text className={`text-2xl font-bold ${textClass} mb-1`}>
            {t("home.welcome")}, {capitalizedName}!
          </Text>
          <Text className={`${secondaryTextClass} mb-6`}>{t("home.subtitle")}</Text>

          <View className="relative mb-4">
            <View className="absolute left-4 top-4 z-10">
              <Ionicons name="search" size={20} color={placeholderTextColor} />
            </View>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              placeholder={t("home.search_placeholder")}
              placeholderTextColor={placeholderTextColor}
              className={`w-full ${inputClass} ${textClass} border rounded-2xl pl-12 pr-24 py-4`}
              returnKeyType="search"
            />
            <Pressable
              onPress={handleSearch}
              className="absolute right-2 top-2 bg-green-500 rounded-xl px-4 py-2"
            >
              <Text className="text-black font-semibold">{t("common.search")}</Text>
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
                <Text className="font-semibold text-black">{t("home.complete_survey")}</Text>
                <Text className="text-black/70 text-sm">{t("home.get_matches")}</Text>
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
              <Text className={`font-semibold ${textClass}`}>{t("home.view_roadmap")}</Text>
              <Text className={`${secondaryTextClass} text-sm`}>{t("home.track_journey")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={placeholderTextColor} />
          </Pressable>

          {user.major && (
            <View className="mt-4">
              <Pressable 
                onPress={() => setIsProfileExpanded(!isProfileExpanded)}
                className={`${cardClass} border rounded-2xl p-4`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className={`${textClass} font-medium`}>{t("home.your_profile")}</Text>
                  <Ionicons 
                    name={isProfileExpanded ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={placeholderTextColor} 
                  />
                </View>

                {isProfileExpanded && (
                  <View className="mt-3 gap-2">
                    <View className="flex-row justify-between">
                      <Text className={secondaryTextClass}>{t("setup.major")}</Text>
                      <Text className="text-green-500 font-medium">{user.major}</Text>
                    </View>
                    {user.gpa && (
                      <View className="flex-row justify-between">
                        <Text className={secondaryTextClass}>{t("setup.gpa")}</Text>
                        <Text className="text-green-500 font-medium">{user.gpa}</Text>
                      </View>
                    )}
                  </View>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}