import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { notificationsService } from "@/services";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

type SettingsItem =
  | {
      label: string;
      icon: keyof typeof MaterialIcons.glyphMap;
      type: "toggle";
      enabled: boolean;
      onPress: () => void;
    }
  | {
      label: string;
      icon: keyof typeof MaterialIcons.glyphMap;
      type: "nav";
      value?: string;
      onPress: () => void;
    };

export default function SettingsPage() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { theme, setTheme, isDark } = useAppTheme();
  const { t, language } = useAppLanguage();
  const { isHydrated, state, signOut, clearAll, setNotificationsEnabled, restoreData } = useAppData();
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
    return langMap[language] || "English";
  }, [language]);

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";
  const cardBgClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/90 border-gray-200";
  const cardBorderClass = isDark ? "border-gray-800" : "border-gray-200";
  const isRTL = language === "Arabic";
  const flexDirection = isRTL ? "flex-row-reverse" : "flex-row";

  const handleToggleNotifications = async () => {
    const currentStatus = state.notificationsEnabled;
    
    if (!currentStatus) {
      // User is trying to enable notifications - request permission
      const permissionStatus = await notificationsService.requestPermissions();
      
      if (permissionStatus === 'granted') {
        await setNotificationsEnabled(true);
        notificationsService.configureNotificationHandler();
      } else if (permissionStatus === 'denied') {
        Alert.alert(
          t('settings.permissionDenied'),
          t('settings.notificationPermissionMessage'),
          [{ text: t('general.close') }]
        );
      }
    } else {
      // User is disabling notifications
      await setNotificationsEnabled(false);
      await notificationsService.cancelAllNotifications();
    }
  };

  const handleExportData = async () => {
    if (!isHydrated) return;

    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        app: "GatorGuide",
        version: "1.0.0",
        data: state,
        theme,
      };

      if (Platform.OS === "web") {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "GatorGuide_export.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      const fileUri = new FileSystem.File(FileSystem.Paths.document, "GatorGuide_export.json").uri;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), {
        encoding: "utf8",
      });

      const canShare = await Sharing.isAvailableAsync();
      // Platform.OS does not include 'web' in React Native types, but Expo web sets Platform.OS to 'web' at runtime.
      // To avoid type error, use (Platform as any).OS === 'web'.
      if (!canShare || (Platform as any).OS === "web") {
        Alert.alert(t('settings.exportReady'), t('settings.exportNotAvailable'));
        return;
      }

      await Sharing.shareAsync(fileUri);
    } catch (error) {
      Alert.alert(t('settings.exportFailed'), t('settings.exportError'));
    }
  };

  const handleImportData = async () => {
    if (!isHydrated) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const fileUri = result.assets[0].uri;
      const raw = await FileSystem.readAsStringAsync(fileUri, {
        encoding: "utf8",
      });

      const parsed = JSON.parse(raw) as {
        exportedAt?: string;
        app?: string;
        version?: string;
        data?: typeof state;
        theme?: string;
      };

      if (!parsed?.data) {
        Alert.alert(t('settings.invalidFile'), t('settings.invalidFileMessage'));
        return;
      }

      Alert.alert(
        t('settings.importConfirm'),
        t('settings.importOverwriteMessage'),
        [
          { text: t('general.cancel'), style: "cancel" },
          {
            text: t('settings.import'),
            style: "destructive",
            onPress: async () => {
              if (parsed.data) {
                await restoreData(parsed.data);
              }
              if (parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system") {
                setTheme(parsed.theme);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(t('settings.importFailed'), t('settings.importError'));
    }
  };

  const sections = useMemo(
    () => [
      {
        title: t("settings.settings"),
        items: [
          {
            icon: "notifications",
            label: t("settings.notifications"),
            type: "toggle",
            enabled: state.notificationsEnabled,
            onPress: handleToggleNotifications,
          },
          {
            icon: "dark-mode",
            label: t("settings.theme"),
            type: "nav",
            value: theme === "system" ? t("settings.system") : theme === "dark" ? t("settings.dark") : t("settings.light"),
            onPress: () => {
              const next = theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
              setTheme(next);
            },
          },
          {
            icon: "language",
            label: t("settings.language"),
            type: "nav",
            value: language,
            onPress: () => router.push("/language"),
          },
        ] as SettingsItem[],
      },
      {
        title: t("settings.data"),
        items: [
          {
            icon: "upload",
            label: t("settings.import"),
            type: "nav",
            onPress: handleImportData,
          },
          {
            icon: "download",
            label: t("settings.export"),
            type: "nav",
            onPress: handleExportData,
          },
        ] as SettingsItem[],
      },
      {
        title: t("settings.about"),
        items: [
          { icon: "info", label: t("settings.about"), type: "nav", onPress: () => router.push("/about") },
        ] as SettingsItem[],
      },
    ],
    [theme, state.notificationsEnabled, language, setTheme, handleToggleNotifications, handleExportData, t]
  );

  const handleLogout = async () => {
    if (!isHydrated) return;
    await signOut();
    router.replace("/login");
  };

  const handleDeleteConfirm = async () => {
    if (!isHydrated) return;
    await clearAll();
    router.replace("/login");
  };

  if (showDeleteConfirm) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center px-6">
          <View className={`w-full max-w-md ${cardBgClass} border rounded-2xl p-6`}>
            <Text className={`text-xl ${isRTL ? "text-right" : ""} ${textClass} mb-4`}>{t('settings.deleteAccount')}</Text>
            <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mb-6`}>
              {t('settings.deleteWarning')}
            </Text>

            <View className={`${flexDirection} gap-3`}>
              <Pressable
                onPress={() => setShowDeleteConfirm(false)}
                className={`flex-1 ${cardBgClass} border ${cardBorderClass} rounded-lg py-4 items-center`}
              >
                <Text className={textClass}>{t("general.cancel")}</Text>
              </Pressable>

              <Pressable
                onPress={handleDeleteConfirm}
                className={`flex-1 bg-red-500 rounded-lg py-4 items-center ${!isHydrated ? "opacity-60" : ""}`}
                disabled={!isHydrated}
              >
                <Text className="text-white font-semibold">{t("general.delete")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 96 }}>
        <View className="max-w-md w-full self-center">
          <View className="px-6 pt-8 pb-6">
            <Text className={`text-2xl ${textClass}`}>{t("settings.settings")}</Text>
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
                      className={`${flexDirection} items-center px-4 py-5 ${
                        index !== section.items.length - 1 ? `border-b ${cardBorderClass}` : ""
                      }`}
                    >
                      <MaterialIcons name={item.icon} size={20} color="#22C55E" />
                      <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${textClass}`}>{item.label}</Text>

                      {item.type === "toggle" ? (
                        <View className={`w-12 h-6 rounded-full ${("enabled" in item && item.enabled) ? "bg-green-500" : isDark ? "bg-gray-700" : "bg-gray-300"}`}>
                          <View className={`w-5 h-5 bg-white rounded-full mt-0.5 ${("enabled" in item && item.enabled) ? "ml-6" : "ml-0.5"}`} />
                        </View>
                      ) : item.value ? (
                        <Text className={`${isRTL ? "text-left" : ""} ${secondaryTextClass}`}>{item.value}</Text>
                      ) : (
                        <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={22} color={isDark ? "#9CA3AF" : "#6B7280"} />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            <Pressable
              onPress={handleLogout}
              disabled={!isHydrated}
              className={`w-full ${
                isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
              } border rounded-2xl px-4 py-5 ${flexDirection} items-center ${!isHydrated ? 'opacity-60' : ''}`}
            >
              <MaterialIcons name="logout" size={20} color="#EF4444" />
              <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} text-red-500`}>{t('settings.logout')}</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowDeleteConfirm(true)}
              disabled={!isHydrated}
              className={`w-full ${
                isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
              } border rounded-2xl px-4 py-5 ${flexDirection} items-center ${!isHydrated ? 'opacity-60' : ''}`}
            >
              <MaterialIcons name="delete" size={20} color="#EF4444" />
              <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} text-red-500`}>{t('settings.deleteAccount')}</Text>
            </Pressable>

            <Text className={`text-center text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'} mt-2`}>
              {t('settings.appVersion')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}