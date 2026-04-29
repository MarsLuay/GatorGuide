import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { type NotificationPreferences, useAppData } from "@/hooks/use-app-data";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState, useCallback, useEffect } from "react";
import { Pressable, ScrollView, Text, View, Alert, Platform, Linking, TextInput, KeyboardAvoidingView, Modal, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildDataExportPayload,
  normalizeDataImportPayload,
  restoreDataImportSnapshot,
  stringifyDataExportPayload,
  writeDataExportFile,
} from "@/services/app/data-portability.service";
import { notificationsService } from "@/services/notifications/notifications.service";
import { cacheManagerService } from "@/services/storage/cache-manager.service";
import { APP_VERSION } from "@/constants/app-version";
import { ROUTES } from "@/constants/routes";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/constants/support";
import { StateCard } from "@/components/ui/StateCard";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { resetTranscriptState } from "@/services/planning/transcript-reset.service";
import {
  AnimatedCardPressable,
  AnimatedChipPressable,
  AnimatedIconPressable,
} from "@/components/ui/AnimatedPressables";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";

type IconName = keyof typeof Ionicons.glyphMap;

type SettingsItem =
  | {
      label: string;
      icon: IconName;
      type: "toggle";
      enabled: boolean;
      onPress: () => void;
    }
  | {
      label: string;
      icon: IconName;
      type: "nav";
      value?: string;
      onPress: () => void;
    }
  | {
      label: string;
      icon: IconName;
      type: "display";
      value: string;
    };

const SUPPORT_MESSAGE_WEBHOOK =
  process.env.EXPO_PUBLIC_SUPPORT_MESSAGE_WEBHOOK ||
  "https://us-central1-gatorguide.cloudfunctions.net/sendSupportMessage";

export default function SettingsPage() {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false);
  const [showCacheClearedPopup, setShowCacheClearedPopup] = useState(false);
  const [cacheClearedCount, setCacheClearedCount] = useState(0);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [autoClearCacheEnabled, setAutoClearCacheEnabled] = useState(false);
  const [showSupportComposer, setShowSupportComposer] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [supportStatus, setSupportStatus] = useState<"" | "sent" | "error">("");
  const [supportStatusText, setSupportStatusText] = useState("");
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);
  const [showNotificationPreferences, setShowNotificationPreferences] = useState(false);

  const { theme, isDark, isGreen, setTheme } = useAppTheme();
  const { t, language, setLanguage } = useAppLanguage();
  const {
    isHydrated,
    state,
    signOut,
    deleteAccount,
    setNotificationsEnabled,
    setNotificationPreferences,
    restoreData,
    setQuestionnaireAnswers,
    patchUserLocally,
    updateUser,
  } = useAppData();
  const { getScrollContentPadding } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // removed currentLanguageName (unused) to satisfy linter

  const textClass = isDark ? "text-white" : isGreen ? "text-white" : "text-emerald-900";
  const secondaryTextClass = isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : "text-emerald-700";
  const cardBgClass = isDark
    ? "bg-gray-900/80 border-gray-800"
    : isGreen
      ? "bg-emerald-900/90 border-emerald-800"
      : "bg-white border-emerald-200";
  const cardBorderClass = isDark ? "border-gray-800" : isGreen ? "border-emerald-700" : "border-emerald-300";
  const inputClass = isDark ? "bg-gray-800 border-gray-700" : isGreen ? "bg-emerald-900/70 border-emerald-700" : "bg-white border-emerald-300";
  const placeholderTextColor = isDark ? "#9CA3AF" : isGreen ? "#b6e2b6" : "#1f8a5d";
  const notificationsEnabled = state.notificationsEnabled ?? false;
  const notificationPreferences = state.notificationPreferences;
  const isRTL = language === "Arabic" || language === "Persian";
  const flexDirection = isRTL ? "flex-row-reverse" : "flex-row";
  const user = state.user;
  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isWideLayout = width >= 1120;
  const showSectionGrid = width >= 860;
  const stackDialogActions = width < 520;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const pageMaxWidth = isWideLayout ? 1280 : isTablet ? 960 : 720;
  const earlyStateMaxWidth = Math.min(pageMaxWidth, isWideLayout ? 760 : isTablet ? 680 : 448);
  const sectionCardWidth = showSectionGrid ? (isWideLayout ? "48.2%" : "48%") : "100%";
  const dialogMaxWidth = isWideLayout ? 620 : isTablet ? 560 : 420;
  const dialogPadding = isTablet ? 28 : 20;
  const dialogHorizontalPadding = isCompactPhone ? 16 : 24;
  const useDesktopSettingsLayout = Platform.OS === "web" && isWideLayout;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 16,
  });
  const modalBottomPadding = Math.max(insets.bottom + 24, 24);
  const modalTopPadding = Math.max(insets.top + 24, 24);
  const supportInputMinHeight = isTablet ? 160 : 132;
  const accentColor = "#008f4e";
  const accessoryIconColor = isDark ? "#9CA3AF" : isGreen ? "#b6e2b6" : "#1f8a5d";
  const dividerColor = isDark ? "#1F2937" : isGreen ? "#166534" : "#A7F3D0";
  const dangerTextClass = isDark || isGreen ? "text-red-400" : "text-red-500";
  const nestedPanelClass = isDark
    ? "bg-black/20 border border-gray-800"
    : isGreen
      ? "bg-emerald-950/40 border border-emerald-800"
      : "bg-emerald-50/90 border border-emerald-200";
  const desktopPanelClass = `${cardBgClass} border rounded-3xl p-6`;
  const currentThemeLabel =
    theme === "system"
      ? t("settings.system")
      : theme === "dark"
        ? t("settings.dark")
        : t("settings.light");
  const notificationPreferenceItems = useMemo(
    () =>
      [
        {
          key: "transferDeadlines",
          icon: "calendar-outline",
          label: t("settings.notificationTypeTransferDeadlines"),
        },
        {
          key: "collegeDeadlines",
          icon: "school-outline",
          label: t("settings.notificationTypeCollegeDeadlines"),
        },
        {
          key: "scholarships",
          icon: "cash-outline",
          label: t("settings.notificationTypeScholarships"),
        },
        {
          key: "internships",
          icon: "briefcase-outline",
          label: t("settings.notificationTypeInternships"),
        },
        {
          key: "generalDeadlines",
          icon: "time-outline",
          label: t("settings.notificationTypeGeneralDeadlines"),
        },
      ] satisfies {
        key: keyof NotificationPreferences;
        icon: IconName;
        label: string;
      }[],
    [t]
  );
  const enabledNotificationPreferenceCount = notificationPreferenceItems.filter(
    (item) => notificationPreferences[item.key]
  ).length;
  const notificationPreferenceSummary =
    enabledNotificationPreferenceCount === notificationPreferenceItems.length
      ? t("settings.allNotifications")
      : enabledNotificationPreferenceCount === 0
        ? t("settings.noNotifications")
        : t("settings.selectedNotificationsCount", {
            count: enabledNotificationPreferenceCount,
          });

  const handleToggleNotifications = useCallback(async () => {
    const currentStatus = state.notificationsEnabled ?? false;

    if (!currentStatus) {
      // User is trying to enable notifications - request permission
      const permissionStatus = await notificationsService.requestPermissions();

      if (permissionStatus === 'granted') {
        await setNotificationsEnabled(true);
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
    }
  }, [state.notificationsEnabled, setNotificationsEnabled, t]);

  const handleToggleNotificationPreference = useCallback(
    (key: keyof NotificationPreferences) => {
      void setNotificationPreferences({
        [key]: !notificationPreferences[key],
      } as Partial<NotificationPreferences>);
    },
    [notificationPreferences, setNotificationPreferences]
  );

  const handleExportData = useCallback(async () => {
    if (!isHydrated) return;

    try {
      const payload = await buildDataExportPayload({ state, theme, language });

      if (Platform.OS === "web") {
        const blob = new Blob([stringifyDataExportPayload(payload)], { type: "application/json" });
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
      await writeDataExportFile(fileUri, payload);

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
  }, [isHydrated, language, state, theme, t]);

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

      const snapshot = normalizeDataImportPayload(JSON.parse(raw));

      if (!snapshot) {
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
              try {
                const restoredData = await restoreDataImportSnapshot(snapshot);
                await restoreData(restoredData);
                if (snapshot.theme) {
                  setTheme(snapshot.theme);
                }
                if (snapshot.language) {
                  setLanguage(snapshot.language);
                }
              } catch {
                Alert.alert(t('settings.importFailed'), t('settings.importError'));
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert(t('settings.importFailed'), t('settings.importError'));
    }
    }, [isHydrated, restoreData, setLanguage, setTheme, t]);

  // removed hasExportableData (unused) to satisfy linter

  const handleLogout = useCallback(async () => {
    // Simplified logout: directly sign out and navigate to login
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signOut();
    } catch {
      // ignore signOut errors for now
    } finally {
      router.replace(ROUTES.login);
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
  const toggleAdvancedSettings = useCallback(() => {
    setIsAdvancedSettingsOpen((currentValue) => !currentValue);
  }, []);

  const handleConfirmClearCache = useCallback(async () => {
    try {
      setIsClearingCache(true);
      const { clearedCount } = await cacheManagerService.clearRelevantCaches();

      if (user?.uid) {
        await resetTranscriptState({
          userId: user.uid,
          setQuestionnaireAnswers,
          patchUserLocally,
          updateUser,
        });

        if (user.isGuest) {
          await updateUser({
            resume: undefined,
            avatar: undefined,
          });
        }
      }

      setCacheClearedCount(clearedCount);
      setShowClearCacheConfirm(false);
      setShowCacheClearedPopup(true);
    } finally {
      setIsClearingCache(false);
    }
  }, [patchUserLocally, setQuestionnaireAnswers, updateUser, user]);

  const sendSupportMessage = async () => {
    const message = supportMessage.trim();
    if (!message) {
      Alert.alert(t("settings.support"), t("settings.supportEmptyMessage"));
      return;
    }

    const fallbackToMailto = async () => {
      const subject = encodeURIComponent("GatorGuide Support Request");
      const userLine = user?.email ? `User: ${user.email}\n` : "";
      const body = encodeURIComponent(`${userLine}\n${message}`);
      const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

      try {
        const canOpen = await Linking.canOpenURL(mailtoUrl);
        if (!canOpen) {
          Alert.alert(t("settings.support"), t("settings.supportEmailAppUnavailable"));
          return;
        }
        await Linking.openURL(mailtoUrl);
        setSupportStatus("sent");
        setSupportStatusText(t("settings.supportOpenedEmailApp"));
      } catch {
        Alert.alert(t("settings.support"), t("settings.supportEmailAppUnavailable"));
      }
    };

    setSupportStatus("");
    setSupportStatusText("");
    setIsSendingSupport(true);
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      if (!SUPPORT_MESSAGE_WEBHOOK) {
        await fallbackToMailto();
        return;
      }

      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(SUPPORT_MESSAGE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          app: "GatorGuide",
          timestamp: new Date().toISOString(),
          platform: Platform.OS,
          userName: user?.name || "",
          userEmail: user?.email || "",
          userUid: user?.uid || "",
          message,
        }),
      });
      if (timer) clearTimeout(timer);

      if (!res.ok) {
        setSupportStatus("error");
        setSupportStatusText(t("settings.supportFallbackEmail"));
        await fallbackToMailto();
        return;
      }

      setSupportMessage("");
      setShowSupportComposer(false);
      setSupportStatus("sent");
      setSupportStatusText(t("settings.supportMessageSent"));
      Alert.alert(t("settings.support"), t("settings.supportMessageSent"));
    } catch {
      setSupportStatus("error");
      setSupportStatusText(t("settings.supportFallbackEmail"));
      await fallbackToMailto();
    } finally {
      if (timer) clearTimeout(timer);
      setIsSendingSupport(false);
    }
  };

  const sections = useMemo(
    () => [
      {
        title: t("settings.settings"),
        items: [
          {
            icon: "notifications-outline",
            label: t("settings.notifications"),
            type: "toggle",
            enabled: notificationsEnabled,
            onPress: handleToggleNotifications,
          },
          ...(notificationsEnabled
            ? ([
                {
                  icon: "options-outline",
                  label: t("settings.automaticNotifications"),
                  type: "nav",
                  value: notificationPreferenceSummary,
                  onPress: () => setShowNotificationPreferences(true),
                },
              ] as SettingsItem[])
            : []),
          {
            icon: "moon-outline",
            label: t("settings.theme"),
            type: "nav",
            value: currentThemeLabel,
            onPress: () => {
              const order = ["system", "dark", "light"] as const;
              const currentIndex = order.indexOf(theme === "green" ? "dark" : theme);
              const next = order[(currentIndex + 1) % order.length];
              setTheme(next);
            },
          },
          {
            icon: "language-outline",
            label: t("settings.language"),
            type: "nav",
            value: language,
            onPress: () => router.push(ROUTES.language),
          },
        ] as SettingsItem[],
      },
      {
        title: t("settings.data"),
        items: [
          {
            icon: "cloud-upload-outline",
            label: t("settings.import"),
            type: "nav",
            onPress: handleImportData,
          },
          {
            icon: "cloud-download-outline",
            label: t("settings.export"),
            type: "nav",
            onPress: handleExportData,
          },
        ] as SettingsItem[],
      },
      {
        title: t("settings.about"),
        items: [
          {
            icon: "help-circle-outline",
            label: t("settings.support"),
            type: "nav",
            onPress: () => {
              setSupportStatus("");
              setSupportStatusText("");
              setShowSupportComposer(true);
            },
          },
          { icon: "information-circle-outline", label: t("settings.about"), type: "nav", onPress: () => router.push(ROUTES.about) },
          { icon: "shield-checkmark-outline", label: t("settings.privacyPolicy"), type: "nav", onPress: () => router.push(ROUTES.privacy) },
          { icon: "document-text-outline", label: t("settings.termsOfService"), type: "nav", onPress: () => router.push(ROUTES.terms) },
          { icon: "pricetag-outline", label: t("about.version"), type: "display", value: APP_VERSION },
        ] as SettingsItem[],
      },
    ],
    [currentThemeLabel, theme, notificationsEnabled, notificationPreferenceSummary, language, setTheme, handleToggleNotifications, handleExportData, handleImportData, router, t]
  );

  const [settingsSection, , aboutSection] = sections;

  const renderSettingsRows = (
    items: SettingsItem[],
    options?: {
      valueMaxWidth?: number;
      rowPaddingVertical?: number;
    }
  ) =>
    items.map((item, index) => {
      const isDisplay = item.type === "display";
      const Wrapper = isDisplay ? View : item.type === "toggle" ? Pressable : AnimatedCardPressable;
      const wrapperProps = isDisplay ? {} : { onPress: (item as { onPress: () => void }).onPress };

      return (
        <Wrapper
          key={`${item.label}-${index}`}
          {...wrapperProps}
          className={`${flexDirection} px-4`}
          style={{
            alignItems: "center",
            paddingVertical: options?.rowPaddingVertical ?? (useDesktopSettingsLayout ? 18 : 20),
            borderBottomWidth: index !== items.length - 1 ? 1 : 0,
            borderColor: index !== items.length - 1 ? dividerColor : "transparent",
          }}
        >
          <Ionicons name={item.icon} size={20} color={accentColor} />

          <View
            style={{
              flex: 1,
              minWidth: 0,
              marginLeft: isRTL ? 0 : 12,
              marginRight: isRTL ? 12 : 0,
            }}
          >
            <Text className={`${isRTL ? "text-right" : ""} ${textClass}`} style={{ lineHeight: 22 }}>
              {item.label}
            </Text>
          </View>

          {item.type === "toggle" ? (
            <View
              className={`w-12 h-6 rounded-full ${
                ("enabled" in item && item.enabled)
                  ? "bg-emerald-500"
                  : isDark
                    ? "bg-gray-700"
                    : isGreen
                      ? "bg-emerald-700"
                      : "bg-emerald-300"
              }`}
            >
              <View className={`w-5 h-5 bg-white rounded-full mt-0.5 ${("enabled" in item && item.enabled) ? "ml-6" : "ml-0.5"}`} />
            </View>
          ) : item.type === "display" || ("value" in item && item.value) ? (
            <View
              style={{
                flexShrink: 1,
                maxWidth: options?.valueMaxWidth ?? (isWideLayout ? 240 : isTablet ? 200 : 140),
                marginLeft: isRTL ? 0 : 12,
                marginRight: isRTL ? 12 : 0,
              }}
            >
              <Text className={`${isRTL ? "text-left" : "text-right"} ${secondaryTextClass}`} numberOfLines={2} style={{ lineHeight: 20 }}>
                {item.type === "display" ? item.value : (item as { value?: string }).value}
              </Text>
            </View>
          ) : (
            <Ionicons
              name={isRTL ? "chevron-back" : "chevron-forward"}
              size={22}
              color={accessoryIconColor}
            />
          )}
        </Wrapper>
      );
    });

  const renderSectionCard = (section: { title: string; items: SettingsItem[] }) => (
    <View key={section.title} style={{ width: sectionCardWidth }}>
      <Text className={`text-sm font-medium ${secondaryTextClass} mb-3 px-2`}>{section.title}</Text>
      <View className={`${cardBgClass} border rounded-2xl overflow-hidden`}>
        {renderSettingsRows(section.items)}
      </View>
    </View>
  );

  const advancedDesktopItems: {
    key: string;
    icon: IconName;
    label: string;
    description: string;
    type: "toggle" | "nav";
    enabled?: boolean;
    onPress: () => void;
    danger?: boolean;
  }[] = [
    {
      key: "import",
      icon: "cloud-upload-outline",
      label: t("settings.import"),
      description: t("settings.importDescription"),
      type: "nav",
      onPress: handleImportData,
    },
    {
      key: "export",
      icon: "cloud-download-outline",
      label: t("settings.export"),
      description: t("settings.exportDescription"),
      type: "nav",
      onPress: handleExportData,
    },
    {
      key: "auto-clear",
      icon: "refresh-outline",
      label: t("settings.cacheAutoClear5d"),
      description: t("settings.cacheAutoClearDescription"),
      type: "toggle",
      enabled: autoClearCacheEnabled,
      onPress: handleToggleAutoClearCache,
    },
    {
      key: "clear-cache",
      icon: "trash-outline",
      label: t("settings.clearCacheNow"),
      description: t("settings.clearCacheDescription"),
      type: "nav",
      onPress: handleClearCacheNow,
      danger: true,
    },
  ];
  const advancedMobileItems = advancedDesktopItems.filter(
    (item) => item.key === "auto-clear" || item.key === "clear-cache"
  );

  const renderAdvancedRows = (
    items: typeof advancedDesktopItems,
    options?: {
      rowPaddingVertical?: number;
    }
  ) =>
    items.map((item, index) => {
      const AdvancedRow = item.type === "toggle" ? Pressable : AnimatedCardPressable;

      return (
        <AdvancedRow
          key={item.key}
          onPress={item.onPress}
          className={`${flexDirection} items-center px-4`}
          style={{
            paddingVertical: options?.rowPaddingVertical ?? 18,
            borderTopWidth: index === 0 ? 0 : 1,
            borderColor: dividerColor,
          }}
        >
          <Ionicons name={item.icon} size={20} color={item.danger ? "#EF4444" : accentColor} />
          <View className={`flex-1 ${isRTL ? "mr-3" : "ml-3"}`}>
            <Text className={`${isRTL ? "text-right" : ""} ${item.danger ? dangerTextClass : textClass}`}>
              {item.label}
            </Text>
            <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} text-xs mt-1`}>
              {item.description}
            </Text>
          </View>

          {item.type === "toggle" ? (
            <View className={`w-12 h-6 rounded-full ${item.enabled ? "bg-emerald-500" : isDark ? "bg-gray-700" : isGreen ? "bg-emerald-700" : "bg-emerald-300"}`}>
              <View className={`w-5 h-5 bg-white rounded-full mt-0.5 ${item.enabled ? "ml-6" : "ml-0.5"}`} />
            </View>
          ) : (
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={22} color={accessoryIconColor} />
          )}
        </AdvancedRow>
      );
    });

  const renderNotificationPreferenceRows = () =>
    notificationPreferenceItems.map((item, index) => {
      const enabled = notificationPreferences[item.key];

      return (
        <Pressable
          key={item.key}
          onPress={() => handleToggleNotificationPreference(item.key)}
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled }}
          className={`${flexDirection} items-center`}
          style={{
            paddingVertical: 18,
            borderTopWidth: index === 0 ? 0 : 1,
            borderColor: dividerColor,
          }}
        >
          <Ionicons name={item.icon} size={20} color={accentColor} />
          <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${textClass}`}>
            {item.label}
          </Text>
          <View className={`w-12 h-6 rounded-full ${enabled ? "bg-emerald-500" : isDark ? "bg-gray-700" : isGreen ? "bg-emerald-700" : "bg-emerald-300"}`}>
            <View className={`w-5 h-5 bg-white rounded-full mt-0.5 ${enabled ? "ml-6" : "ml-0.5"}`} />
          </View>
        </Pressable>
      );
    });

  const handleDeleteConfirm = async () => {
    if (!isHydrated) return;
    try {
      if (state.user?.isGuest) {
        await signOut();
      } else {
        await deleteAccount();
      }
      router.replace(ROUTES.login);
    } catch {
      Alert.alert(
        t("general.error"),
        t("settings.deleteWarning") || "Account deletion failed. You may need to sign in again and try again."
      );
    }
  };

  const renderOverlay = (
    visible: boolean,
    onRequestClose: () => void,
    content: React.ReactNode,
    options?: { allowBackdropDismiss?: boolean }
  ) => {
    const allowBackdropDismiss = options?.allowBackdropDismiss ?? true;

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={onRequestClose}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              className="absolute inset-0 bg-black/55"
              onPress={allowBackdropDismiss ? onRequestClose : undefined}
            />

            <ScrollView
              className="flex-1"
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: "center",
                paddingHorizontal: dialogHorizontalPadding,
                paddingTop: modalTopPadding,
                paddingBottom: modalBottomPadding,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <View
                className={`w-full self-center ${cardBgClass} border rounded-3xl`}
                style={{ maxWidth: dialogMaxWidth, padding: dialogPadding }}
              >
                {content}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  useEffect(() => {
    void loadAutoClearSetting();
  }, [loadAutoClearSetting]);

  useEffect(() => {
    if (!notificationsEnabled) {
      setShowNotificationPreferences(false);
    }
  }, [notificationsEnabled]);

  if (!isHydrated) {
    return (
      <ScreenBackground>
        <View className="flex-1 justify-center px-6">
          <View style={{ width: "100%", maxWidth: earlyStateMaxWidth, alignSelf: "center" }}>
            <StateCard variant="loading" className="w-full" />
          </View>
        </View>
      </ScreenBackground>
    );
  }

  const desktopDashboard = useDesktopSettingsLayout ? (
    <>
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "stretch",
          gap: 24,
        }}
      >
        <View className={desktopPanelClass} style={{ flex: 1, minHeight: 0 }}>
          <View className={`${flexDirection} items-start mb-5`}>
            <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center">
              <Ionicons name="settings-outline" size={20} color={accentColor} />
            </View>
            <View className={`flex-1 ${isRTL ? "mr-4" : "ml-4"}`}>
              <Text className={`${isRTL ? "text-right" : ""} ${textClass} text-xl font-semibold`}>
                {settingsSection.title}
              </Text>
              <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mt-1`} style={{ lineHeight: 21 }}>
                {t("settings.desktopSettingsDescription")}
              </Text>
            </View>
          </View>

          <View className={`${nestedPanelClass} rounded-2xl overflow-hidden`}>
            {renderSettingsRows(settingsSection.items, { valueMaxWidth: 260, rowPaddingVertical: 18 })}
          </View>
        </View>

        <View className={desktopPanelClass} style={{ flex: 1, minHeight: 0 }}>
          <View className={`${flexDirection} items-start mb-5`}>
            <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center">
              <Ionicons name="information-circle-outline" size={20} color={accentColor} />
            </View>
            <View className={`flex-1 ${isRTL ? "mr-4" : "ml-4"}`}>
              <Text className={`${isRTL ? "text-right" : ""} ${textClass} text-xl font-semibold`}>
                {aboutSection.title}
              </Text>
              <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mt-1`} style={{ lineHeight: 21 }}>
                {t("settings.desktopAboutDescription")}
              </Text>
            </View>
          </View>

          <View className={`${nestedPanelClass} rounded-2xl overflow-hidden`} style={{ flex: 1, minHeight: 0 }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {renderSettingsRows(aboutSection.items, { valueMaxWidth: 260, rowPaddingVertical: 18 })}
            </ScrollView>
          </View>
        </View>
      </View>

      <View className={desktopPanelClass} style={{ marginTop: 24 }}>
        <AnimatedCardPressable
          onPress={toggleAdvancedSettings}
          accessibilityRole="button"
          accessibilityState={{ expanded: isAdvancedSettingsOpen }}
        >
          <View className={`${flexDirection} items-start justify-between gap-4`}>
            <View className={`${flexDirection} items-start flex-1`}>
              <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center">
                <Ionicons name="construct-outline" size={20} color={accentColor} />
              </View>
              <View className={`flex-1 ${isRTL ? "mr-4" : "ml-4"}`}>
                <Text className={`${isRTL ? "text-right" : ""} ${textClass} text-xl font-semibold`}>
                  {t("settings.advanced")}
                </Text>
                <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mt-1`} style={{ lineHeight: 21 }}>
                  {isAdvancedSettingsOpen
                    ? t("settings.desktopAdvancedDescription")
                    : t("settings.desktopAdvancedCollapsedDescription")}
                </Text>
              </View>
            </View>
            <Ionicons
              name={isAdvancedSettingsOpen ? "chevron-up" : "chevron-down"}
              size={22}
              color={accessoryIconColor}
            />
          </View>
        </AnimatedCardPressable>

        {isAdvancedSettingsOpen ? (
          <View className={`${nestedPanelClass} rounded-2xl overflow-hidden`} style={{ marginTop: 20, maxHeight: 320 }}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
              {renderAdvancedRows(advancedDesktopItems)}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <View className={desktopPanelClass} style={{ marginTop: 24 }}>
        <View className={`${flexDirection} items-start justify-between`} style={{ gap: 16, flexWrap: "wrap" }}>
          <View style={{ flex: 1, minWidth: 280 }}>
            <Text className={`${isRTL ? "text-right" : ""} ${textClass} text-xl font-semibold`}>
              {t("settings.accountActions")}
            </Text>
            <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mt-1`} style={{ lineHeight: 21 }}>
              {t("settings.accountActionsDescription")}
            </Text>
          </View>

          <View
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              gap: 16,
              minWidth: 360,
              flex: 1,
            }}
          >
            <AnimatedCardPressable
              onPress={handleLogout}
              disabled={!isHydrated}
              className={`${nestedPanelClass} rounded-2xl px-4 py-5 ${flexDirection} items-center ${!isHydrated ? "opacity-60" : ""}`}
              containerStyle={{ flex: 1 }}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${dangerTextClass}`}>{t("settings.logout")}</Text>
            </AnimatedCardPressable>

            <AnimatedCardPressable
              onPress={() => setShowDeleteConfirm(true)}
              disabled={!isHydrated}
              className={`${nestedPanelClass} rounded-2xl px-4 py-5 ${flexDirection} items-center ${!isHydrated ? "opacity-60" : ""}`}
              containerStyle={{ flex: 1 }}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${dangerTextClass}`}>{t("settings.deleteAccount")}</Text>
            </AnimatedCardPressable>
          </View>
        </View>
      </View>
    </>
  ) : null;

  return (
    <ScreenBackground includeBottomInset={false}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={scrollContentPadding}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: "100%",
            maxWidth: pageMaxWidth,
            alignSelf: "center",
            paddingHorizontal: shellHorizontalPadding,
          }}
        >
          {supportStatusText && !showSupportComposer ? (
            <StatusBanner
              variant={supportStatus === "error" ? "error" : "success"}
              message={supportStatusText}
              className="mb-6"
            />
          ) : null}

          <View
            className="pt-8 pb-6"
            style={useDesktopSettingsLayout ? { maxWidth: 720 } : undefined}
          >
            <Text className={`text-2xl ${isRTL ? "text-right" : ""} ${textClass} mb-1`}>
              {t("settings.settings")}
            </Text>
            <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass}`}>
              {t("settings.desktopIntro")}
            </Text>
          </View>

          {useDesktopSettingsLayout ? (
            desktopDashboard
          ) : (
            <>
              <View
                style={{
                  flexDirection: showSectionGrid ? "row" : "column",
                  flexWrap: showSectionGrid ? "wrap" : "nowrap",
                  gap: 24,
                }}
              >
                {sections.map(renderSectionCard)}

                <View style={{ width: sectionCardWidth }}>
                  <View className={`${cardBgClass} border rounded-2xl overflow-hidden`}>
                    <AnimatedCardPressable
                      onPress={toggleAdvancedSettings}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isAdvancedSettingsOpen }}
                      className="px-4 py-4"
                    >
                      <View className={`${flexDirection} items-start justify-between gap-3`}>
                        <View className={`${flexDirection} items-start flex-1`}>
                          <View className="w-10 h-10 rounded-2xl bg-emerald-500/10 items-center justify-center">
                            <Ionicons name="construct-outline" size={18} color={accentColor} />
                          </View>
                          <View className={`flex-1 ${isRTL ? "mr-3" : "ml-3"}`}>
                            <Text className={`text-sm font-medium ${secondaryTextClass} ${isRTL ? "text-right" : ""}`}>
                              {t("settings.advanced")}
                            </Text>
                            <Text className={`${secondaryTextClass} text-sm mt-1 ${isRTL ? "text-right" : ""}`}>
                              {isAdvancedSettingsOpen
                                ? t("settings.desktopAdvancedDescription")
                                : t("settings.desktopAdvancedCollapsedDescription")}
                            </Text>
                          </View>
                        </View>
                        <Ionicons
                          name={isAdvancedSettingsOpen ? "chevron-up" : "chevron-down"}
                          size={20}
                          color={accessoryIconColor}
                        />
                      </View>
                    </AnimatedCardPressable>
                    {isAdvancedSettingsOpen ? renderAdvancedRows(advancedMobileItems, { rowPaddingVertical: 20 }) : null}
                  </View>
                </View>
              </View>

              <View
                style={{
                  flexDirection: showSectionGrid ? (isRTL ? "row-reverse" : "row") : "column",
                  gap: 16,
                  marginTop: 24,
                }}
              >
                <AnimatedCardPressable
                  onPress={handleLogout}
                  disabled={!isHydrated}
                  className={`${
                    isDark ? "bg-gray-900/80 border-gray-800" : isGreen ? "bg-emerald-900/90 border-emerald-800" : "bg-white border-emerald-200"
                  } border rounded-2xl px-4 py-5 ${flexDirection} items-center ${!isHydrated ? "opacity-60" : ""}`}
                  containerStyle={{ flex: showSectionGrid ? 1 : undefined }}
                >
                  <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                  <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${dangerTextClass}`}>{t("settings.logout")}</Text>
                </AnimatedCardPressable>

                <AnimatedCardPressable
                  onPress={() => setShowDeleteConfirm(true)}
                  disabled={!isHydrated}
                  className={`${
                    isDark ? "bg-gray-900/80 border-gray-800" : isGreen ? "bg-emerald-900/90 border-emerald-800" : "bg-white border-emerald-200"
                  } border rounded-2xl px-4 py-5 ${flexDirection} items-center ${!isHydrated ? "opacity-60" : ""}`}
                  containerStyle={{ flex: showSectionGrid ? 1 : undefined }}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${dangerTextClass}`}>{t("settings.deleteAccount")}</Text>
                </AnimatedCardPressable>
              </View>

              <Text className={`text-center text-sm ${isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : "text-gray-500"} mt-4`}>
                {t("settings.appVersion")}: {APP_VERSION}
              </Text>
              <View className="mt-4 mb-2">
                <View className={`${flexDirection} justify-center items-center`} style={{ flexWrap: "wrap" }}>
                  <Text className={`text-center text-sm ${secondaryTextClass} ${isRTL ? "ml-2" : "mr-2"}`}>{t("general.needHelpQuestion") ?? "Need Help?"}</Text>
                  <AnimatedIconPressable onPress={() => Linking.openURL(SUPPORT_MAILTO)} accessibilityRole="link">
                    <Text className={`text-sm ${isDark ? "text-emerald-200" : isGreen ? "text-emerald-100" : "text-emerald-600"} underline font-semibold`}>{t("general.emailUs") ?? "Email Us!"}</Text>
                  </AnimatedIconPressable>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
      {renderOverlay(
        showNotificationPreferences,
        () => setShowNotificationPreferences(false),
        <>
          <Text className={`text-xl ${isRTL ? "text-right" : ""} ${textClass} mb-3`}>
            {t("settings.automaticNotifications")}
          </Text>
          <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mb-2`}>
            {t("settings.automaticNotificationsSubtitle")}
          </Text>

          <View
            style={{
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: dividerColor,
              marginTop: 8,
            }}
          >
            {renderNotificationPreferenceRows()}
          </View>

          <AnimatedChipPressable
            onPress={() => setShowNotificationPreferences(false)}
            className="bg-emerald-500 rounded-lg py-4 items-center mt-5"
          >
            <Text className={`${isDark || isGreen ? "text-white" : "text-emerald-900"} font-semibold`}>
              {t("general.close")}
            </Text>
          </AnimatedChipPressable>
        </>
      )}
      {renderOverlay(
        showSupportComposer,
        () => setShowSupportComposer(false),
        <>
          <Text className={`text-xl ${isRTL ? "text-right" : ""} ${textClass} mb-3`}>{t("settings.support")}</Text>
          <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mb-4`}>
            {t("settings.supportComposerSubtitle")}
          </Text>
          <TextInput
            multiline
            numberOfLines={6}
            value={supportMessage}
            onChangeText={setSupportMessage}
            placeholder={t("settings.supportComposerPlaceholder")}
            placeholderTextColor={placeholderTextColor}
            className={`${inputClass} rounded-xl p-3 text-sm mb-3`}
            style={{ minHeight: supportInputMinHeight }}
            textAlignVertical="top"
            autoFocus
          />
          {supportStatusText ? (
            <StatusBanner
              variant={supportStatus === "error" ? "error" : "success"}
              message={supportStatusText}
              className="mt-3"
            />
          ) : null}

          <View
            style={{
              flexDirection: stackDialogActions ? "column" : isRTL ? "row-reverse" : "row",
              gap: 12,
              marginTop: 20,
            }}
          >
            <AnimatedChipPressable
              onPress={() => setShowSupportComposer(false)}
              className={`${cardBgClass} border ${cardBorderClass} rounded-lg py-4 items-center ${isSendingSupport ? "opacity-60" : ""}`}
              containerStyle={{ flex: stackDialogActions ? undefined : 1 }}
              disabled={isSendingSupport}
            >
              <Text className={textClass}>{t("general.close")}</Text>
            </AnimatedChipPressable>

            <AnimatedChipPressable
              onPress={() => {
                void sendSupportMessage();
              }}
              className={`bg-emerald-500 rounded-lg py-4 items-center ${isSendingSupport ? "opacity-60" : ""}`}
              containerStyle={{ flex: stackDialogActions ? undefined : 1 }}
              disabled={isSendingSupport}
            >
              <Text className={`${isDark || isGreen ? "text-white" : "text-emerald-900"} font-semibold`}>
                {isSendingSupport ? t("settings.sending") : t("settings.send")}
              </Text>
            </AnimatedChipPressable>
          </View>
        </>,
        { allowBackdropDismiss: !isSendingSupport }
      )}
      {renderOverlay(
        showDeleteConfirm,
        () => setShowDeleteConfirm(false),
        <>
          <Text className={`text-xl ${isRTL ? "text-right" : ""} ${textClass} mb-4`}>{t("settings.deleteAccount")}</Text>
          <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mb-6`}>
            {t("settings.deleteWarning")}
          </Text>

          <View
            style={{
              flexDirection: stackDialogActions ? "column" : isRTL ? "row-reverse" : "row",
              gap: 12,
            }}
          >
            <AnimatedChipPressable
              onPress={() => setShowDeleteConfirm(false)}
              className={`${cardBgClass} border ${cardBorderClass} rounded-lg py-4 items-center`}
              containerStyle={{ flex: stackDialogActions ? undefined : 1 }}
            >
              <Text className={textClass}>{t("general.cancel")}</Text>
            </AnimatedChipPressable>

            <AnimatedChipPressable
              onPress={handleDeleteConfirm}
              className={`bg-emerald-800 rounded-lg py-4 items-center ${!isHydrated ? "opacity-60" : ""}`}
              containerStyle={{ flex: stackDialogActions ? undefined : 1 }}
              disabled={!isHydrated}
            >
              <Text className="text-white font-semibold">{t("general.delete")}</Text>
            </AnimatedChipPressable>
          </View>
        </>
      )}
      {renderOverlay(
        showClearCacheConfirm,
        () => setShowClearCacheConfirm(false),
        <>
          <Text className={`text-xl ${isRTL ? "text-right" : ""} ${textClass} mb-3`}>{t("settings.clearCacheConfirmTitle")}</Text>
          <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mb-6`}>
            {t("settings.clearCacheConfirmMessage")}
          </Text>

          <View
            style={{
              flexDirection: stackDialogActions ? "column" : isRTL ? "row-reverse" : "row",
              gap: 12,
            }}
          >
            <AnimatedChipPressable
              onPress={() => setShowClearCacheConfirm(false)}
              className={`${cardBgClass} border ${cardBorderClass} rounded-lg py-4 items-center`}
              containerStyle={{ flex: stackDialogActions ? undefined : 1 }}
              disabled={isClearingCache}
            >
              <Text className={textClass}>{t("general.cancel")}</Text>
            </AnimatedChipPressable>

            <AnimatedChipPressable
              onPress={handleConfirmClearCache}
              className={`bg-red-500 rounded-lg py-4 items-center ${isClearingCache ? "opacity-60" : ""}`}
              containerStyle={{ flex: stackDialogActions ? undefined : 1 }}
              disabled={isClearingCache}
            >
              <Text className="text-white font-semibold">{isClearingCache ? t("settings.clearingCache") : t("settings.clearCacheAction")}</Text>
            </AnimatedChipPressable>
          </View>
        </>,
        { allowBackdropDismiss: !isClearingCache }
      )}
      {renderOverlay(
        showCacheClearedPopup,
        () => setShowCacheClearedPopup(false),
        <>
          <Text className={`text-xl ${isRTL ? "text-right" : ""} ${textClass} mb-3`}>{t("settings.cacheClearedTitle")}</Text>
          <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mb-6`}>
            {t("settings.cacheClearedMessage", { count: cacheClearedCount })}
          </Text>
          <AnimatedChipPressable
            onPress={() => setShowCacheClearedPopup(false)}
            className="bg-emerald-500 rounded-lg py-4 items-center"
          >
            <Text className={`${isDark || isGreen ? "text-white" : "text-emerald-900"} font-semibold`}>{t("general.ok")}</Text>
          </AnimatedChipPressable>
        </>
      )}
    </ScreenBackground>
  );
}

