import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { notificationsService } from "@/services";
import { useTranslation } from "react-i18next";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, isDark } = useAppTheme();
  const { state, signOut, setNotificationsEnabled } = useAppData();
  const insets = useSafeAreaInsets();

  const currentLanguageName = useMemo(() => {
    const langMap: Record<string, string> = {
      en: "English",
      zh: "简体中文",
      "zh-Hant": "繁體中文",
      es: "Español",
      fr: "Français",
      de: "Deutsch",
      it: "Italiano",
      ja: "日本語",
      ko: "한국어",
      pt: "Português",
      ru: "Русский",
      ar: "العربية",
      hi: "हिन्दी",
      vi: "Tiếng Việt",
      tl: "Tagalog",
    };
    return langMap[i18n.language] || "English";
  }, [i18n.language]);

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";
  const cardBgClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/90 border-gray-200";
  const cardBorderClass = isDark ? "border-gray-800" : "border-gray-200";

  const sections = useMemo(() => [
    {
      title: t("settings.preferences"),
      items: [
        {
          icon: "notifications",
          label: t("settings.notifications"),
          type: "toggle",
          enabled: !!state.notificationsEnabled,
          onPress: async () => {
            if (!state.notificationsEnabled) {
              const status = await notificationsService.requestPermissions();
              if (status === 'granted') await setNotificationsEnabled(true);
            } else {
              await setNotificationsEnabled(false);
            }
          },
        },
        {
          icon: "dark-mode",
          label: t("settings.theme"),
          type: "nav",
          value: theme === "system" ? t("theme.system") : theme === "dark" ? t("theme.dark") : t("theme.light"),
          onPress: () => setTheme(theme === "system" ? "dark" : theme === "dark" ? "light" : "system"),
        },
        {
          icon: "language",
          label: t("common.language"),
          type: "nav",
          value: currentLanguageName,
          onPress: () => router.push("/language"),
        },
      ],
    },
    {
      title: t("settings.support"),
      items: [
        { icon: "info", label: t("settings.about"), type: "nav", onPress: () => router.push("/about") },
      ],
    },
  ], [theme, state.notificationsEnabled, currentLanguageName, t]);

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 32 }}>
        <View className="max-w-md w-full self-center">
          <View className="px-6 pt-8 pb-6">
            <Text className={`text-2xl font-bold ${textClass}`}>{t("common.settings")}</Text>
          </View>
          <View className="px-6 gap-6">
            {sections.map((section) => (
              <View key={section.title}>
                <Text className={`text-sm font-medium ${secondaryTextClass} mb-3 px-2`}>{section.title}</Text>
                <View className={`${cardBgClass} border rounded-2xl overflow-hidden`}>
                  {section.items.map((item, index) => (
                    <Pressable
                      key={item.label}
                      onPress={item.onPress}
                      className={`flex-row items-center px-4 py-5 ${index !== section.items.length - 1 ? `border-b ${cardBorderClass}` : ""}`}
                    >
                      <MaterialIcons name={item.icon as any} size={20} color="#22C55E" />
                      <Text className={`flex-1 ml-3 ${textClass}`}>{item.label}</Text>
                      {item.type === "toggle" ? (
                        <View className={`w-12 h-6 rounded-full ${("enabled" in item && item.enabled) ? "bg-green-500" : isDark ? "bg-gray-700" : "bg-gray-300"}`}>
                          <View className={`w-5 h-5 bg-white rounded-full mt-0.5 ${("enabled" in item && item.enabled) ? "ml-6" : "ml-0.5"}`} />
                        </View>
                      ) : (
                        <View className="flex-row items-center">
                           <Text className={`${secondaryTextClass} mr-1`}>{("value" in item) ? item.value : ""}</Text>
                           <MaterialIcons name="chevron-right" size={20} color={isDark ? "#4B5563" : "#9CA3AF"} />
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            <Pressable
              onPress={signOut}
              className={`w-full ${isDark ? "bg-red-500/10" : "bg-red-50"} border border-red-200 rounded-2xl px-4 py-5 flex-row items-center`}
            >
              <MaterialIcons name="logout" size={20} color="#EF4444" />
              <Text className="flex-1 ml-3 text-red-500 font-medium">{t("common.logout")}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}