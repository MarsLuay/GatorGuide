import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState, useCallback, useEffect } from "react";
import { Pressable, ScrollView, Text, View, Alert, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { notificationsService, cacheManagerService } from "@/services";
import { translations } from "@/services/translations";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";

const PENDING_DELETE_ACCOUNT_KEY = "gatorguide:pending-delete-account";

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
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false);
  const [showCacheClearedPopup, setShowCacheClearedPopup] = useState(false);
  const [cacheClearedCount, setCacheClearedCount] = useState(0);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [autoClearCacheEnabled, setAutoClearCacheEnabled] = useState(false);
  const [showDeleteDebugConsole, setShowDeleteDebugConsole] = useState(false);
  const [deleteDebugHotkeyEnabled, setDeleteDebugHotkeyEnabled] = useState(false);
  const [deleteDebugLogs, setDeleteDebugLogs] = useState<string[]>([]);
  const [deleteCopyStatus, setDeleteCopyStatus] = useState<"" | "copied" | "failed">("");

  const { theme, setTheme, isDark } = useAppTheme();
  const { t, language } = useAppLanguage();
  const { isHydrated, state, signOut, deleteAccount, setNotificationsEnabled, restoreData } = useAppData();
  const insets = useSafeAreaInsets();

  // removed currentLanguageName (unused) to satisfy linter

  const textClass = isDark ? "text-white" : "text-emerald-900";
  const secondaryTextClass = isDark ? "text-white/90" : "text-emerald-700";
  const cardBgClass = isDark ? "bg-emerald-900/90 border-emerald-800" : "bg-white border-emerald-200";
  const cardBorderClass = isDark ? "border-emerald-700" : "border-emerald-300";
  // Mirror row layout for RTL languages while keeping the same component tree.
  const isRTL = language === "Arabic" || language === "Persian";
  const flexDirection = isRTL ? "flex-row-reverse" : "flex-row";

  const pushDeleteDebugLog = useCallback((message: string) => {
    const line = `${new Date().toISOString()} | ${message}`;
    setDeleteDebugLogs((prev) => {
      const next = [...prev, line];
      return next.slice(-200);
    });
  }, []);

  const clearDeleteDebugLogs = useCallback(() => {
    setDeleteDebugLogs([]);
    setDeleteCopyStatus("");
  }, []);

  const copyDeleteDebugLogs = useCallback(async () => {
    try {
      const text = deleteDebugLogs.join("\n");
      if (!text || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        setDeleteCopyStatus("failed");
        return;
      }
      await navigator.clipboard.writeText(text);
      setDeleteCopyStatus("copied");
    } catch {
      setDeleteCopyStatus("failed");
    }
  }, [deleteDebugLogs]);

  const handleToggleNotifications = useCallback(async () => {
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
  }, [state.notificationsEnabled, setNotificationsEnabled, t]);

  const handleExportData = useCallback(async () => {
    if (!isHydrated) return;

    try {
      // Export includes app-level metadata to support future restore/migration flows.
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
    } catch {
      Alert.alert(t('settings.exportFailed'), t('settings.exportError'));
    }
  }, [isHydrated, state, theme, t]);

  const handleImportData = useCallback(async () => {
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
    } catch {
      Alert.alert(t('settings.importFailed'), t('settings.importError'));
    }
    }, [isHydrated, restoreData, setTheme, t]);

  // removed hasExportableData (unused) to satisfy linter

  const handleLogout = useCallback(async () => {
    // Simplified logout: directly sign out and navigate to login
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signOut();
    } catch {
      // ignore signOut errors for now
    } finally {
      router.replace("/login");
    }
  }, [signOut, router]);

  const loadAutoClearSetting = useCallback(async () => {
    const enabled = await cacheManagerService.getAutoClearEnabled();
    setAutoClearCacheEnabled(enabled);
  }, []);

  const handleToggleAutoClearCache = useCallback(async () => {
    const next = !autoClearCacheEnabled;
    setAutoClearCacheEnabled(next);
    await cacheManagerService.setAutoClearEnabled(next);
  }, [autoClearCacheEnabled]);

  const handleClearCacheNow = useCallback(() => {
    setShowClearCacheConfirm(true);
  }, []);

  const handleConfirmClearCache = useCallback(async () => {
    try {
      setIsClearingCache(true);
      const { clearedCount } = await cacheManagerService.clearRelevantCaches();
      setCacheClearedCount(clearedCount);
      setShowClearCacheConfirm(false);
      setShowCacheClearedPopup(true);
    } finally {
      setIsClearingCache(false);
    }
  }, []);

  const handleCopyEnglishKeyLog = useCallback(async () => {
    try {
      const keys = Object.keys(translations.English)
        .sort((a, b) => a.localeCompare(b));
      const logText = [
        `English key count: ${keys.length}`,
        "",
        ...keys,
      ].join("\n");

      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(logText);
        Alert.alert(t("settings.debugCopiedTitle"), t("settings.debugCopiedMessage"));
        return;
      }

      Alert.alert(t("settings.debugUnavailableTitle"), t("settings.debugUnavailableMessage"));
    } catch {
      Alert.alert(t("general.error"), t("settings.debugCopyFailed"));
    }
  }, [t]);

  const sections = useMemo(
    () => [
      // Build sections from translations/state so labels and values stay reactive.
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
    [theme, state.notificationsEnabled, language, setTheme, handleToggleNotifications, handleExportData, handleImportData, router, t]
  );

  const handleDeleteConfirm = async () => {
    if (!isHydrated || isDeletingAccount) return;
    setIsDeletingAccount(true);
    pushDeleteDebugLog(`Delete requested. user=${state.user?.uid ?? "none"} guest=${String(!!state.user?.isGuest)} hydrated=${String(isHydrated)}`);
    try {
      if (state.user?.isGuest) {
        pushDeleteDebugLog("Guest path: signOut()");
        await signOut();
      } else {
        pushDeleteDebugLog("Auth path: deleteAccount()");
        await Promise.race([
          deleteAccount(),
          new Promise((_, reject) =>
            setTimeout(() => {
              const err = new Error("Delete account timed out") as Error & { code?: string };
              err.code = "app/delete-timeout";
              reject(err);
            }, 15000)
          ),
        ]);
      }
      pushDeleteDebugLog("Delete succeeded. Navigating to /login");
      router.replace("/login");
    } catch (error: any) {
      const code = error?.code as string | undefined;
      pushDeleteDebugLog(`Delete failed. code=${code ?? "none"} message=${String(error?.message ?? "unknown")}`);
      if (code === "auth/requires-recent-login") {
        await AsyncStorage.setItem(PENDING_DELETE_ACCOUNT_KEY, "true").catch(() => {});
        pushDeleteDebugLog("Set pending-delete flag. Redirecting to /login for re-auth.");
        Alert.alert(
          t("general.error"),
          "For security, please sign in again. We will complete account deletion right after you log in."
        );
        router.replace("/login");
        return;
      }
      Alert.alert(
        t("general.error"),
        code === "app/delete-timeout"
          ? "Delete account request timed out. Please check network and try again."
          : (t("settings.deleteWarning") || "Account deletion failed. Please try again.")
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  useEffect(() => {
    void loadAutoClearSetting();
  }, [loadAutoClearSetting]);

  useEffect(() => {
    if (!__DEV__ || Platform.OS !== "web") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "~" || event.key === "`" || event.code === "Backquote") {
        setDeleteDebugHotkeyEnabled((v) => !v);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
                className={`flex-1 bg-emerald-800 rounded-lg py-4 items-center ${(!isHydrated || isDeletingAccount) ? "opacity-60" : ""}`}
                disabled={!isHydrated || isDeletingAccount}
              >
                <Text className="text-white font-semibold">{isDeletingAccount ? (t("general.pleaseWait") || "Please wait") : t("general.delete")}</Text>
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
            {__DEV__ && deleteDebugHotkeyEnabled ? (
              <View className={`${cardBgClass} border rounded-2xl p-4`}>
                <View className={`${flexDirection} items-center justify-between`}>
                  <Text className={textClass}>Delete Account Debug</Text>
                  <Pressable
                    onPress={() => setShowDeleteDebugConsole((v) => !v)}
                    className="px-3 py-1 rounded-lg bg-emerald-500"
                  >
                    <Text className={`${isDark ? "text-white" : "text-black"} font-semibold`}>
                      {showDeleteDebugConsole ? "Hide" : "Show"}
                    </Text>
                  </Pressable>
                </View>

                <View className="flex-row gap-2 mt-3">
                  <Pressable onPress={copyDeleteDebugLogs} className="px-3 py-2 rounded-lg bg-emerald-300">
                    <Text className={`${isDark ? "text-white" : "text-black"} text-xs font-semibold`}>Copy Logs</Text>
                  </Pressable>
                  <Pressable onPress={clearDeleteDebugLogs} className="px-3 py-2 rounded-lg bg-emerald-300">
                    <Text className={`${isDark ? "text-white" : "text-black"} text-xs font-semibold`}>Clear</Text>
                  </Pressable>
                </View>

                {deleteCopyStatus ? (
                  <Text className={`${secondaryTextClass} text-xs mt-2`}>
                    {deleteCopyStatus === "copied" ? "Delete logs copied to clipboard." : "Clipboard copy failed."}
                  </Text>
                ) : null}

                {showDeleteDebugConsole ? (
                  <Text selectable className={`${secondaryTextClass} text-xs mt-3`}>
                    {deleteDebugLogs.length ? deleteDebugLogs.join("\n") : "No delete logs yet. Trigger delete flow to capture events."}
                  </Text>
                ) : null}
              </View>
            ) : null}

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
                      <MaterialIcons name={item.icon} size={20} color="#008f4e" />
                      <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${textClass}`}>{item.label}</Text>

                      {item.type === "toggle" ? (
                        <View className={`w-12 h-6 rounded-full ${("enabled" in item && item.enabled) ? "bg-emerald-500" : isDark ? "bg-emerald-700" : "bg-emerald-300"}`}>
                          <View className={`w-5 h-5 bg-white rounded-full mt-0.5 ${("enabled" in item && item.enabled) ? "ml-6" : "ml-0.5"}`} />
                        </View>
                      ) : item.value ? (
                        <Text className={`${isRTL ? "text-left" : ""} ${secondaryTextClass}`}>{item.value}</Text>
                      ) : (
                        <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={22} color={isDark ? "#b6e2b6" : "#1f8a5d"} />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

            <View>
              <Text className={`text-sm font-medium ${secondaryTextClass} mb-3 px-2`}>{t("settings.advanced")}</Text>
              <View className={`${cardBgClass} border rounded-2xl overflow-hidden`}>
                <Pressable
                  onPress={() => setShowAdvancedSettings((v) => !v)}
                  className={`${flexDirection} items-center px-4 py-5`}
                >
                  <MaterialIcons name="tune" size={20} color="#008f4e" />
                  <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${textClass}`}>{t("settings.cacheSettings")}</Text>
                  <MaterialIcons name={showAdvancedSettings ? "expand-less" : "expand-more"} size={22} color={isDark ? "#b6e2b6" : "#1f8a5d"} />
                </Pressable>

                {showAdvancedSettings ? (
                  <>
                    <Pressable
                      onPress={handleToggleAutoClearCache}
                      className={`${flexDirection} items-center px-4 py-5 border-t ${cardBorderClass}`}
                    >
                      <MaterialIcons name="autorenew" size={20} color="#008f4e" />
                      <View className={`flex-1 ${isRTL ? "mr-3" : "ml-3"}`}>
                        <Text className={`${isRTL ? "text-right" : ""} ${textClass}`}>{t("settings.cacheAutoClear5d")}</Text>
                        <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} text-xs mt-1`}>
                          {t("settings.cacheAutoClearDescription")}
                        </Text>
                      </View>
                      <View className={`w-12 h-6 rounded-full ${autoClearCacheEnabled ? "bg-emerald-500" : isDark ? "bg-emerald-700" : "bg-emerald-300"}`}>
                        <View className={`w-5 h-5 bg-white rounded-full mt-0.5 ${autoClearCacheEnabled ? "ml-6" : "ml-0.5"}`} />
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={handleClearCacheNow}
                      className={`${flexDirection} items-center px-4 py-5 border-t ${cardBorderClass}`}
                    >
                      <MaterialIcons name="delete-sweep" size={20} color="#EF4444" />
                      <View className={`flex-1 ${isRTL ? "mr-3" : "ml-3"}`}>
                        <Text className={`${isRTL ? "text-right" : ""} text-red-500`}>{t("settings.clearCacheNow")}</Text>
                        <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} text-xs mt-1`}>
                          {t("settings.clearCacheDescription")}
                        </Text>
                      </View>
                      <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={22} color={isDark ? "#b6e2b6" : "#1f8a5d"} />
                    </Pressable>

                    <Pressable
                      onPress={handleCopyEnglishKeyLog}
                      className={`${flexDirection} items-center px-4 py-5 border-t ${cardBorderClass}`}
                    >
                      <MaterialIcons name="bug-report" size={20} color="#008f4e" />
                      <View className={`flex-1 ${isRTL ? "mr-3" : "ml-3"}`}>
                        <Text className={`${isRTL ? "text-right" : ""} ${textClass}`}>{t("settings.debugTools")}</Text>
                        <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} text-xs mt-1`}>
                          {t("settings.copyEnglishKeyLog")}
                        </Text>
                      </View>
                      <MaterialIcons name="content-copy" size={20} color={isDark ? "#b6e2b6" : "#1f8a5d"} />
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>

            <Pressable
              onPress={handleLogout}
              disabled={!isHydrated}
              className={`w-full ${
                isDark ? 'bg-emerald-900/90 border-emerald-800' : 'bg-white border-emerald-200'
              } border rounded-2xl px-4 py-5 ${flexDirection} items-center ${!isHydrated ? 'opacity-60' : ''}`}
            >
              <MaterialIcons name="logout" size={20} color="#EF4444" />
              <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${isDark ? 'text-red-400' : 'text-red-500'}`}>{t('settings.logout')}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                pushDeleteDebugLog("Opened delete confirmation popup.");
                setShowDeleteConfirm(true);
              }}
              disabled={!isHydrated}
              className={`w-full ${
                isDark ? 'bg-emerald-900/90 border-emerald-800' : 'bg-white border-emerald-200'
              } border rounded-2xl px-4 py-5 ${flexDirection} items-center ${!isHydrated ? 'opacity-60' : ''}`}
            >
              <MaterialIcons name="delete" size={20} color="#EF4444" />
              <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${isDark ? 'text-red-400' : 'text-red-500'}`}>{t('settings.deleteAccount')}</Text>
            </Pressable>

            <Text className={`text-center text-sm ${isDark ? 'text-white/90' : 'text-gray-500'} mt-2`}>
              {t('settings.appVersion')}
            </Text>
            <View className="mt-4 mb-2">
              <View className="flex-row justify-center items-center">
                <Text className={`text-center text-sm ${secondaryTextClass} mr-2`}>{t('general.needHelpQuestion') ?? 'Need Help?'}</Text>
                <Pressable onPress={() => Linking.openURL('mailto:gatorguide_mobiledevelopmentteam@outlook.com')} accessibilityRole="link">
                  <Text className={`text-sm ${isDark ? 'text-white/90' : 'text-emerald-600'} underline font-semibold`}>{t('general.emailUs') ?? 'Email Us!'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      {showClearCacheConfirm ? (
        <View className="absolute inset-0 items-center justify-center px-6 bg-black/50">
          <View className={`w-full max-w-md ${cardBgClass} border rounded-2xl p-6`}>
            <Text className={`text-xl ${isRTL ? "text-right" : ""} ${textClass} mb-3`}>{t("settings.clearCacheConfirmTitle")}</Text>
            <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mb-6`}>
              {t("settings.clearCacheConfirmMessage")}
            </Text>

            <View className={`${flexDirection} gap-3`}>
              <Pressable
                onPress={() => setShowClearCacheConfirm(false)}
                className={`flex-1 ${cardBgClass} border ${cardBorderClass} rounded-lg py-4 items-center`}
                disabled={isClearingCache}
              >
                <Text className={textClass}>{t("general.cancel")}</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmClearCache}
                className={`flex-1 bg-red-500 rounded-lg py-4 items-center ${isClearingCache ? "opacity-60" : ""}`}
                disabled={isClearingCache}
              >
                <Text className="text-white font-semibold">{isClearingCache ? t("settings.clearingCache") : t("settings.clearCacheAction")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
      {showCacheClearedPopup ? (
        <View className="absolute inset-0 items-center justify-center px-6 bg-black/50">
          <View className={`w-full max-w-md ${cardBgClass} border rounded-2xl p-6`}>
            <Text className={`text-xl ${isRTL ? "text-right" : ""} ${textClass} mb-3`}>{t("settings.cacheClearedTitle")}</Text>
            <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mb-6`}>
              {t("settings.cacheClearedMessage", { count: cacheClearedCount })}
            </Text>
            <Pressable
              onPress={() => setShowCacheClearedPopup(false)}
              className="bg-emerald-500 rounded-lg py-4 items-center"
            >
              <Text className={`${isDark ? 'text-white' : 'text-black'} font-semibold`}>{t("general.ok")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScreenBackground>
  );
}
