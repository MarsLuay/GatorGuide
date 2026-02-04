import { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";
import { Language } from "@/services/translations";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";

export default function LanguagePage() {
  const { isDark } = useAppTheme();
  const { language, setLanguage, t } = useAppLanguage();

  const languages = useMemo(
    () => [
      { key: "English" as Language, label: "English" },
      { key: "Spanish" as Language, label: "Español" },
      { key: "Chinese (Simplified)" as Language, label: "简体中文" },
      { key: "Chinese (Traditional)" as Language, label: "繁體中文" },
      { key: "French" as Language, label: "Français" },
      { key: "German" as Language, label: "Deutsch" },
      { key: "Italian" as Language, label: "Italiano" },
      { key: "Japanese" as Language, label: "日本語" },
      { key: "Korean" as Language, label: "한국어" },
      { key: "Portuguese" as Language, label: "Português" },
      { key: "Russian" as Language, label: "Русский" },
      { key: "Arabic" as Language, label: "العربية" },
      { key: "Hindi" as Language, label: "हिन्दी" },
      { key: "Vietnamese" as Language, label: "Tiếng Việt" },
      { key: "Tagalog" as Language, label: "Tagalog" },
    ],
    []
  );

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";
  const cardBgClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/90 border-gray-200";
  const itemBorderClass = isDark ? "border-gray-800" : "border-gray-200";
  const iconColor = isDark ? "#9CA3AF" : "#6B7280";

  const handleSelectLanguage = (lang: Language) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLanguage(lang);
    setTimeout(() => {
      router.replace("/(tabs)/settings");
    }, 300);
  };

  return (
    <ScreenBackground>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="max-w-md w-full self-center pt-20">
          <View className="px-6 pb-6">
            <Pressable onPress={() => router.back()} className="mb-4 flex-row items-center">
              <MaterialIcons name="arrow-back" size={20} color={iconColor} />
              <Text className={`${secondaryTextClass} ml-2`}>{t("general.back")}</Text>
            </Pressable>

            <Text className={`text-2xl ${textClass}`}>{t("settings.language")}</Text>
          </View>

          <View className="px-6">
            <View className={`${cardBgClass} border rounded-2xl overflow-hidden`}>
              {languages.map((lang, index) => {
                const isSelected = language === lang.key;

                return (
                  <Pressable
                    key={lang.key}
                    onPress={() => handleSelectLanguage(lang.key)}
                    className={`flex-row items-center justify-between px-4 py-5 ${
                      index !== languages.length - 1 ? `border-b ${itemBorderClass}` : ""
                    }`}
                  >
                    <Text className={textClass}>{lang.label}</Text>
                    {isSelected ? <MaterialIcons name="check" size={20} color="#22C55E" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}