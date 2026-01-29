// components/pages/SettingsPage.tsx
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

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
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [selectedLanguage] = useState("English");

  const { theme, setTheme, isDark } = useAppTheme();
  const { isHydrated, signOut, clearAll } = useAppData();

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";
  const cardBgClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/90 border-gray-200";
  const cardBorderClass = isDark ? "border-gray-800" : "border-gray-200";

  const sections = useMemo(
    () => [
      {
        title: "Preferences",
        items: [
          {
            icon: "notifications",
            label: "Notifications",
            type: "toggle",
            enabled: isNotificationsEnabled,
            onPress: () => setIsNotificationsEnabled((v) => !v),
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
        title: "Support",
        items: [
          { icon: "info", label: "About", type: "nav", onPress: () => router.push("/about") },
          { icon: "map", label: "Roadmap", type: "nav", onPress: () => router.push("/roadmap") },
        ] as SettingsItem[],
      },
    ],
    [theme, isNotificationsEnabled, selectedLanguage, setTheme]
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
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
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
