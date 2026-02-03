// components/pages/SettingsPage.tsx
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useAppTheme } from "@/hooks/use-app-theme";
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
  const [selectedLanguage] = useState("English");

  const { theme, setTheme, isDark } = useAppTheme();
  const { isHydrated, state, signOut, clearAll, setNotificationsEnabled, restoreData } = useAppData();
  const insets = useSafeAreaInsets();

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";
  const cardBgClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/90 border-gray-200";
  const cardBorderClass = isDark ? "border-gray-800" : "border-gray-200";

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
          'Permission Denied',
          'Notification permissions were denied. You can enable them in your device settings.',
          [{ text: 'OK' }]
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
      if (!canShare || Platform.OS === "web") {
        Alert.alert("Export ready", "Your export file was created on device, but sharing isn’t available on this platform.");
        return;
      }

      await Sharing.shareAsync(fileUri);
    } catch (error) {
      Alert.alert("Export failed", "We couldn’t export your data. Please try again.");
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
        Alert.alert("Invalid file", "This file doesn’t look like a GatorGuide export.");
        return;
      }

      Alert.alert(
        "Import data?",
        "This will overwrite your current data on this device.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Import",
            style: "destructive",
            onPress: async () => {
              await restoreData(parsed.data);
              if (parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system") {
                setTheme(parsed.theme);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert("Import failed", "We couldn’t import your data. Please try again.");
    }
  };

  const sections = useMemo(
    () => [
      {
        title: "Preferences",
        items: [
          {
            icon: "notifications",
            label: "Notifications",
            type: "toggle",
            enabled: state.notificationsEnabled,
            onPress: handleToggleNotifications,
          },
          {
            icon: "dark-mode",
            label: "Theme",
            type: "nav",
            value: theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light",
            onPress: () => {
              const next = theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
              setTheme(next);
            },
          },
          {
            icon: "language",
            label: "Language",
            type: "nav",
            value: selectedLanguage,
            onPress: () => router.push("/language"),
          },
        ] as SettingsItem[],
      },
      {
        title: "Data",
        items: [
          {
            icon: "upload",
            label: "Import Data",
            type: "nav",
            onPress: handleImportData,
          },
          {
            icon: "download",
            label: "Export Data",
            type: "nav",
            onPress: handleExportData,
          },
        ] as SettingsItem[],
      },
      {
        title: "Support",
        items: [
          { icon: "info", label: "About", type: "nav", onPress: () => router.push("/about") },
        ] as SettingsItem[],
      },
    ],
    [theme, state.notificationsEnabled, selectedLanguage, setTheme, handleToggleNotifications, handleExportData]
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
            <Text className={`text-xl ${textClass} mb-4`}>Delete Account?</Text>
            <Text className={`${secondaryTextClass} mb-6`}>
              This action cannot be undone. All your data will be permanently deleted.
            </Text>

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowDeleteConfirm(false)}
                className={`flex-1 ${cardBgClass} border ${cardBorderClass} rounded-lg py-4 items-center`}
              >
                <Text className={textClass}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleDeleteConfirm}
                className={`flex-1 bg-red-500 rounded-lg py-4 items-center ${!isHydrated ? "opacity-60" : ""}`}
                disabled={!isHydrated}
              >
                <Text className="text-white font-semibold">Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 32 }}>
        <View className="max-w-md w-full self-center">
          <View className="px-6 pt-8 pb-6">
            <Text className={`text-2xl ${textClass}`}>Settings</Text>
          </View>

          <View className="px-6 gap-6">
            {sections.map((section) => (
              <View key={section.title}>
                <Text className={`text-sm ${secondaryTextClass} mb-3 px-2`}>{section.title}</Text>

                <View className={`${cardBgClass} border rounded-2xl overflow-hidden`}>
                  {section.items.map((item, index) => (
                    <Pressable
                      key={item.label}
                      onPress={item.onPress}
                      className={`flex-row items-center px-4 py-5 ${
                        index !== section.items.length - 1 ? `border-b ${cardBorderClass}` : ""
                      }`}
                    >
                      <MaterialIcons name={item.icon} size={20} color="#22C55E" />
                      <Text className={`flex-1 ml-3 ${textClass}`}>{item.label}</Text>

                      {item.type === "toggle" ? (
                        <View
                          className={`w-12 h-6 rounded-full ${
                            item.enabled ? "bg-green-500" : isDark ? "bg-gray-700" : "bg-gray-300"
                          }`}
                        >
                          <View className={`w-5 h-5 bg-white rounded-full mt-0.5 ${item.enabled ? "ml-6" : "ml-0.5"}`} />
                        </View>
                      ) : item.value ? (
                        <Text className={secondaryTextClass}>{item.value}</Text>
                      ) : (
                        <MaterialIcons name="chevron-right" size={22} color={isDark ? "#9CA3AF" : "#6B7280"} />
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
                isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200"
              } border rounded-2xl px-4 py-5 flex-row items-center ${!isHydrated ? "opacity-60" : ""}`}
            >
              <MaterialIcons name="logout" size={20} color="#EF4444" />
              <Text className="flex-1 ml-3 text-red-500">Logout</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowDeleteConfirm(true)}
              disabled={!isHydrated}
              className={`w-full ${
                isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200"
              } border rounded-2xl px-4 py-5 flex-row items-center ${!isHydrated ? "opacity-60" : ""}`}
            >
              <MaterialIcons name="delete" size={20} color="#EF4444" />
              <Text className="flex-1 ml-3 text-red-500">Delete Account</Text>
            </Pressable>

            <Text className={`text-center text-sm ${isDark ? "text-gray-600" : "text-gray-400"} mt-2`}>
              Gator Guide v1.0.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
