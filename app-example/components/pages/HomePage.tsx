import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";

export default function HomePage() {
  const { isDark } = useAppTheme();
  const { state } = useAppData();
  const insets = useSafeAreaInsets();
  const user = state.user;

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);

  const capitalizedName = user?.name 
    ? user.name.split(' ')[0].charAt(0).toUpperCase() + user.name.split(' ')[0].slice(1).toLowerCase()
    : "Student";

  const hasCompletedQuestionnaire = state.questionnaireAnswers && Object.keys(state.questionnaireAnswers).length > 0;

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

  const showExtraInfoPrompt = !hasSubmittedSearch;

  return (
    <ScreenBackground>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 96 }}>
        <View className="max-w-md w-full self-center px-6 pt-10">
          <Text className={`text-2xl ${textClass} mb-1`}>Welcome back, {capitalizedName}!</Text>
          <Text className={`${secondaryTextClass} mb-6`}>Find your perfect college match</Text>

          <View className="relative mb-4">
            <View className="absolute left-4 top-4 z-10">
              <Ionicons name="search" size={20} color={placeholderTextColor} />
            </View>

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              placeholder="Press Enter to start"
              placeholderTextColor={placeholderTextColor}
              className={`w-full ${inputClass} ${textClass} border rounded-2xl pl-12 pr-24 py-4`}
              returnKeyType="search"
            />

            <Pressable
              onPress={handleSearch}
              className="absolute right-2 top-2 bg-green-500 rounded-xl px-4 py-2"
            >
              <Text className="text-black font-semibold">Search</Text>
            </Pressable>
          </View>

          {!hasCompletedQuestionnaire && (
            <Pressable
              onPress={() => router.push("/questionnaire")}
              className="w-full rounded-2xl p-4 flex-row items-center"
              style={{ backgroundColor: "#22C55E" }}
            >
              <View className="mr-3 p-2 rounded-xl" style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
                <Ionicons name="document-text" size={18} color="#000" />
              </View>

              <View className="flex-1">
                <Text className="font-semibold text-black">Complete Detailed Questionnaire</Text>
                <Text className="text-black/70 text-sm">Get personalized college recommendations</Text>
              </View>

              <Ionicons name="sparkles" size={18} color="#000" />
            </Pressable>
          )}

          <Pressable
            onPress={() => router.push("/roadmap")}
            className={`w-full rounded-2xl p-4 flex-row items-center ${!hasCompletedQuestionnaire ? "mt-3" : ""} ${cardClass} border`}
          >
            <View className="mr-3 p-2 rounded-xl" style={{ backgroundColor: "#22C55E20" }}>
              <Ionicons name="map" size={18} color="#22C55E" />
            </View>

            <View className="flex-1">
              <Text className={`font-semibold ${textClass}`}>View Your Roadmap</Text>
              <Text className={`${secondaryTextClass} text-sm`}>Track your college application journey</Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={placeholderTextColor} />
          </Pressable>

          {user.major ? (
            <View className="mt-4">
              <Pressable 
                onPress={() => setIsProfileExpanded(!isProfileExpanded)}
                className={`${cardClass} border rounded-2xl p-4`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className={`${textClass}`}>Your Profile</Text>
                  <Ionicons 
                    name={isProfileExpanded ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={placeholderTextColor} 
                  />
                </View>

                {isProfileExpanded && (
                  <View className="mt-3">
                    <View className="flex-row justify-between mb-2">
                      <Text className={secondaryTextClass}>Major</Text>
                      <Text className="text-green-500">{user.major || "Undecided"}</Text>
                    </View>

                    {user.gpa && (
                      <View className="flex-row justify-between mb-2">
                        <Text className={secondaryTextClass}>GPA</Text>
                        <Text className="text-green-500">{user.gpa}</Text>
                      </View>
                    )}

                    {user.sat && (
                      <View className="flex-row justify-between mb-2">
                        <Text className={secondaryTextClass}>SAT Score</Text>
                        <Text className="text-green-500">{user.sat}</Text>
                      </View>
                    )}

                    {user.act && (
                      <View className="flex-row justify-between">
                        <Text className={secondaryTextClass}>ACT Score</Text>
                        <Text className="text-green-500">{user.act}</Text>
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
                  <Text className={`${textClass} font-medium mb-1`}>Anything else?</Text>
                  <Text className={`${secondaryTextClass} text-sm`}>
                    Type anything you feel is relevant and hasn’t been answered elsewhere.
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {results.length > 0 && (
            <View className="mt-8">
              <Text className={`text-lg ${textClass} mb-4`}>Recommended Colleges</Text>

              <View className="gap-3">
                {results.map((college) => (
                  <Pressable key={college} className={`${cardClass} border rounded-xl p-4`}>
                    <Text className={textClass}>{college}</Text>
                    <Text className={`text-sm ${secondaryTextClass} mt-1`}>Great match based on your profile</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {user.major ? null : null}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
