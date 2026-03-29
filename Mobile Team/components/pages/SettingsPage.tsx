import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useOpportunities } from "@/hooks/use-opportunities";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState, useCallback, useEffect } from "react";
import { Pressable, ScrollView, Text, View, Alert, Platform, Linking, TextInput, KeyboardAvoidingView, Modal, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { notificationsService, cacheManagerService } from "@/services";
import { APP_VERSION } from "@/constants/app-version";
import { ROUTES } from "@/constants/routes";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/constants/support";
import { translations } from "@/services/translations";
import { StateCard } from "@/components/ui/StateCard";
import { StatusBanner } from "@/components/ui/StatusBanner";
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

type SettingsDevLogSnapshot = {
  meta: {
    generatedAt: string;
    screen: "SettingsPage";
    route: string;
    appVersion: string;
    isDev: boolean;
  };
  runtime: {
    platform: string;
    width: number;
    height: number;
    fontScale: number;
    language: string;
    isRTL: boolean;
    breakpoint: string;
    isPhoneLikeViewport: boolean;
    topInset: number;
    bottomInset: number;
    currentTime: string;
    web:
      | {
          href: string | null;
          userAgent: string | null;
          innerWidth: number | null;
          innerHeight: number | null;
          devicePixelRatio: number | null;
          clipboardAvailable: boolean;
        }
      | null;
  };
  theme: {
    selectedTheme: string;
    resolvedTheme: string;
    isDark: boolean;
    isGreen: boolean;
    isLight: boolean;
    themeHydrated: boolean;
  };
  layout: {
    isCompactPhone: boolean;
    isTablet: boolean;
    isWideLayout: boolean;
    showSectionGrid: boolean;
    stackDialogActions: boolean;
    useDesktopSettingsLayout: boolean;
    shellHorizontalPadding: number;
    pageMaxWidth: number;
    earlyStateMaxWidth: number;
    sectionCardWidth: string;
    dialogMaxWidth: number;
    dialogPadding: number;
    dialogHorizontalPadding: number;
    modalTopPadding: number;
    modalBottomPadding: number;
    supportInputMinHeight: number;
    scrollContentPadding: {
      paddingTop: number;
      paddingBottom: number;
    };
    tabBar: {
      minHeight: number;
      paddingTop: number;
      paddingBottom: number;
      iconSize: number;
      labelFontSize: number;
      labelLineHeight: number;
      labelMaxWidth: number;
      horizontalPadding: number;
      itemPaddingVertical: number;
      itemPaddingHorizontal: number;
      contentClearance: number;
    };
  };
  settingsPage: {
    notificationsEnabled: boolean;
    showAdvancedSettings: boolean;
    autoClearCacheEnabled: boolean;
    showSupportComposer: boolean;
    supportMessage: string;
    supportMessageLength: number;
    isSendingSupport: boolean;
    supportStatus: string;
    supportStatusText: string;
    showDeleteConfirm: boolean;
    showClearCacheConfirm: boolean;
    showCacheClearedPopup: boolean;
    cacheClearedCount: number;
    isClearingCache: boolean;
    supportWebhookConfigured: boolean;
  };
  account: {
    isHydrated: boolean;
    hasUser: boolean;
    user: unknown;
    summary: {
      uid: string | null;
      email: string | null;
      isGuest: boolean;
      hasAvatar: boolean;
      hasMajor: boolean;
      hasGpa: boolean;
      hasResume: boolean;
      hasTranscript: boolean;
      hasCompletedQuestionnaire: boolean;
      hasSeenOnboarding: boolean | null;
      savedCollegeCount: number;
      questionnaireFieldCount: number;
    };
  };
  opportunities: {
    isHydrated: boolean;
    isRefreshing: boolean;
    catalogCount: number;
    statusCount: number;
    totalMatched: number;
    completedMatched: number;
    pendingMatched: number;
    upcomingWithDueDate: number;
    statusById: unknown;
    catalogPreview: {
      opportunityId: string;
      title: string;
      type: string;
      status: string;
      dueAt: string | null;
    }[];
    preview: {
      opportunityId: string;
      title: string;
      type: string;
      isDone: boolean;
      computedDueAt: string | null;
      externalUrl: string | null;
      matchReasons: string[];
    }[];
  };
  sections: {
    title: string;
    items: {
      label: string;
      type: string;
      value?: string;
      enabled?: boolean;
    }[];
  }[];
  appState: unknown;
  notes: string[];
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
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [autoClearCacheEnabled, setAutoClearCacheEnabled] = useState(false);
  const [showSupportComposer, setShowSupportComposer] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [supportStatus, setSupportStatus] = useState<"" | "sent" | "error">("");
  const [supportStatusText, setSupportStatusText] = useState("");
  const [showDevLog, setShowDevLog] = useState(false);
  const [devLogSnapshot, setDevLogSnapshot] = useState<SettingsDevLogSnapshot | null>(null);
  const [devLogCopyStatus, setDevLogCopyStatus] = useState<"" | "copied" | "failed">("");

  const { theme, resolvedTheme, isDark, isGreen, isLight, hydrated: themeHydrated, setTheme } = useAppTheme();
  const { t, language } = useAppLanguage();
  const { isHydrated, state, signOut, deleteAccount, setNotificationsEnabled, restoreData } = useAppData();
  const {
    isHydrated: areOpportunitiesHydrated,
    isRefreshing: areOpportunitiesRefreshing,
    opportunities,
    matchedOpportunities,
    statusById,
  } = useOpportunities();
  const {
    getScrollContentPadding,
    breakpoint,
    isPhoneLikeViewport,
    topInset,
    bottomInset,
    tabBarPaddingTop,
    tabBarPaddingBottom,
    tabBarIconSize,
    tabBarLabelFontSize,
    tabBarLabelLineHeight,
    tabBarLabelMaxWidth,
    tabBarHorizontalPadding,
    tabBarItemPaddingVertical,
    tabBarItemPaddingHorizontal,
    tabBarMinHeight,
    tabBarContentClearance,
  } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale = 1 } = useWindowDimensions();

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
        : theme === "light"
          ? t("settings.light")
          : t("settings.green");

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

  const handleExportData = useCallback(async () => {
    if (!isHydrated) return;

    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        app: "GatorGuide",
        version: APP_VERSION,
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
              if (parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "green" || parsed.theme === "system") {
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
          {
            icon: "moon-outline",
            label: t("settings.theme"),
            type: "nav",
            value: currentThemeLabel,
            onPress: () => {
              const order = ["system", "dark", "light", "green"] as const;
              const currentIndex = order.indexOf(theme);
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
    [currentThemeLabel, theme, notificationsEnabled, language, setTheme, handleToggleNotifications, handleExportData, handleImportData, router, t]
  );

  const [settingsSection, dataSection, aboutSection] = sections;

  const buildSettingsDevLogSnapshot = useCallback((): SettingsDevLogSnapshot => {
    const now = new Date();
    const questionnaireKeys = Object.keys(state.questionnaireAnswers ?? {});
    const webSnapshot =
      Platform.OS === "web"
        ? {
            href: typeof window !== "undefined" ? window.location.href : null,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            innerWidth: typeof window !== "undefined" ? window.innerWidth : null,
            innerHeight: typeof window !== "undefined" ? window.innerHeight : null,
            devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : null,
            clipboardAvailable:
              typeof navigator !== "undefined" && !!navigator.clipboard?.writeText,
          }
        : null;

    const matchedPreview = matchedOpportunities.slice(0, 20).map((opportunity) => ({
      opportunityId: opportunity.opportunityId,
      title: opportunity.title,
      type: opportunity.type,
      isDone: opportunity.isDone,
      computedDueAt: opportunity.computedDueAt ?? null,
      externalUrl: opportunity.externalUrl ?? null,
      matchReasons: opportunity.matchReasons ?? [],
    }));

    const notes: string[] = [];
    if (useDesktopSettingsLayout) {
      notes.push("Settings is using the desktop dashboard layout.");
    } else {
      notes.push("Settings is using the mobile/tablet stacked layout.");
    }
    if (showSupportComposer) {
      notes.push("Support composer modal is open.");
    }
    if (showDeleteConfirm || showClearCacheConfirm || showCacheClearedPopup) {
      notes.push("At least one confirmation/status modal is currently open.");
    }
    if (!notificationsEnabled) {
      notes.push("Notifications are currently disabled in app state.");
    }
    if ((state.savedColleges?.length ?? 0) === 0) {
      notes.push("No saved colleges are currently stored in app state.");
    }
    if (!questionnaireKeys.length) {
      notes.push("Questionnaire answers are currently empty.");
    }

    return {
      meta: {
        generatedAt: now.toISOString(),
        screen: "SettingsPage",
        route: ROUTES.tabsSettings,
        appVersion: APP_VERSION,
        isDev: __DEV__,
      },
      runtime: {
        platform: Platform.OS,
        width,
        height,
        fontScale,
        language,
        isRTL,
        breakpoint,
        isPhoneLikeViewport,
        topInset,
        bottomInset,
        currentTime: now.toString(),
        web: webSnapshot,
      },
      theme: {
        selectedTheme: theme,
        resolvedTheme,
        isDark,
        isGreen,
        isLight,
        themeHydrated,
      },
      layout: {
        isCompactPhone,
        isTablet,
        isWideLayout,
        showSectionGrid,
        stackDialogActions,
        useDesktopSettingsLayout,
        shellHorizontalPadding,
        pageMaxWidth,
        earlyStateMaxWidth,
        sectionCardWidth,
        dialogMaxWidth,
        dialogPadding,
        dialogHorizontalPadding,
        modalTopPadding,
        modalBottomPadding,
        supportInputMinHeight,
        scrollContentPadding,
        tabBar: {
          minHeight: tabBarMinHeight,
          paddingTop: tabBarPaddingTop,
          paddingBottom: tabBarPaddingBottom,
          iconSize: tabBarIconSize,
          labelFontSize: tabBarLabelFontSize,
          labelLineHeight: tabBarLabelLineHeight,
          labelMaxWidth: tabBarLabelMaxWidth,
          horizontalPadding: tabBarHorizontalPadding,
          itemPaddingVertical: tabBarItemPaddingVertical,
          itemPaddingHorizontal: tabBarItemPaddingHorizontal,
          contentClearance: tabBarContentClearance,
        },
      },
      settingsPage: {
        notificationsEnabled,
        showAdvancedSettings,
        autoClearCacheEnabled,
        showSupportComposer,
        supportMessage,
        supportMessageLength: supportMessage.length,
        isSendingSupport,
        supportStatus,
        supportStatusText,
        showDeleteConfirm,
        showClearCacheConfirm,
        showCacheClearedPopup,
        cacheClearedCount,
        isClearingCache,
        supportWebhookConfigured: !!SUPPORT_MESSAGE_WEBHOOK,
      },
      account: {
        isHydrated,
        hasUser: !!user,
        user,
        summary: {
          uid: user?.uid ?? null,
          email: user?.email ?? null,
          isGuest: !!user?.isGuest,
          hasAvatar: !!user?.avatar,
          hasMajor: !!String(user?.major ?? "").trim(),
          hasGpa: !!String(user?.gpa ?? "").trim(),
          hasResume: !!String(user?.resume ?? "").trim(),
          hasTranscript: !!String(user?.transcript ?? "").trim(),
          hasCompletedQuestionnaire: questionnaireKeys.length > 0,
          hasSeenOnboarding: user?.hasSeenOnboarding ?? null,
          savedCollegeCount: state.savedColleges?.length ?? 0,
          questionnaireFieldCount: questionnaireKeys.length,
        },
      },
      opportunities: {
        isHydrated: areOpportunitiesHydrated,
        isRefreshing: areOpportunitiesRefreshing,
        catalogCount: opportunities.length,
        statusCount: Object.keys(statusById ?? {}).length,
        totalMatched: matchedOpportunities.length,
        completedMatched: matchedOpportunities.filter((opportunity) => opportunity.isDone).length,
        pendingMatched: matchedOpportunities.filter((opportunity) => !opportunity.isDone).length,
        upcomingWithDueDate: matchedOpportunities.filter(
          (opportunity) => !opportunity.isDone && !!opportunity.computedDueAt
        ).length,
        statusById,
        catalogPreview: opportunities.slice(0, 20).map((opportunity) => ({
          opportunityId: opportunity.opportunityId,
          title: opportunity.title,
          type: opportunity.type,
          status: opportunity.status,
          dueAt: opportunity.dueAt ?? null,
        })),
        preview: matchedPreview,
      },
      sections: [
        ...sections.map((section) => ({
          title: section.title,
          items: section.items.map((item) => ({
            label: item.label,
            type: item.type,
            value:
              item.type === "display" || ("value" in item && item.value)
                ? String(item.type === "display" ? item.value : item.value)
                : undefined,
            enabled: item.type === "toggle" ? item.enabled : undefined,
          })),
        })),
        {
          title: t("settings.advanced"),
          items: [
            {
              label: t("settings.cacheSettings"),
              type: "toggle-group",
              value: showAdvancedSettings ? "expanded" : "collapsed",
            },
            {
              label: t("settings.cacheAutoClear5d"),
              type: "toggle",
              enabled: autoClearCacheEnabled,
            },
            {
              label: t("settings.clearCacheNow"),
              type: "action",
            },
            {
              label: t("settings.debugTools"),
              type: "action",
            },
          ],
        },
      ],
      appState: state,
      notes,
    };
  }, [
    areOpportunitiesHydrated,
    areOpportunitiesRefreshing,
    autoClearCacheEnabled,
    bottomInset,
    breakpoint,
    cacheClearedCount,
    dialogHorizontalPadding,
    dialogMaxWidth,
    dialogPadding,
    earlyStateMaxWidth,
    fontScale,
    height,
    isCompactPhone,
    isClearingCache,
    isDark,
    isGreen,
    isHydrated,
    isLight,
    isPhoneLikeViewport,
    isRTL,
    isSendingSupport,
    isTablet,
    isWideLayout,
    language,
    matchedOpportunities,
    modalBottomPadding,
    modalTopPadding,
    notificationsEnabled,
    opportunities,
    pageMaxWidth,
    resolvedTheme,
    scrollContentPadding,
    sectionCardWidth,
    sections,
    shellHorizontalPadding,
    showAdvancedSettings,
    showCacheClearedPopup,
    showClearCacheConfirm,
    showDeleteConfirm,
    showSectionGrid,
    showSupportComposer,
    stackDialogActions,
    state,
    supportInputMinHeight,
    supportMessage,
    supportStatus,
    supportStatusText,
    statusById,
    tabBarContentClearance,
    tabBarHorizontalPadding,
    tabBarIconSize,
    tabBarItemPaddingHorizontal,
    tabBarItemPaddingVertical,
    tabBarLabelFontSize,
    tabBarLabelLineHeight,
    tabBarLabelMaxWidth,
    tabBarMinHeight,
    tabBarPaddingBottom,
    tabBarPaddingTop,
    t,
    theme,
    themeHydrated,
    topInset,
    useDesktopSettingsLayout,
    user,
    width,
  ]);

  const copySettingsDevLog = useCallback(async () => {
    try {
      const snapshot = buildSettingsDevLogSnapshot();
      setDevLogSnapshot(snapshot);

      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        setDevLogCopyStatus("failed");
        return;
      }

      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setDevLogCopyStatus("copied");
    } catch {
      setDevLogCopyStatus("failed");
    }
  }, [buildSettingsDevLogSnapshot]);

  const renderSettingsRows = (
    items: SettingsItem[],
    options?: {
      valueMaxWidth?: number;
      rowPaddingVertical?: number;
    }
  ) =>
    items.map((item, index) => {
      const isDisplay = item.type === "display";
      const Wrapper = isDisplay ? View : Pressable;
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
    if (!showDevLog) return;
    setDevLogSnapshot(buildSettingsDevLogSnapshot());
    setDevLogCopyStatus("");
  }, [buildSettingsDevLogSnapshot, showDevLog]);

  useEffect(() => {
    void loadAutoClearSetting();
  }, [loadAutoClearSetting]);

  useEffect(() => {
    if (!__DEV__ || Platform.OS !== "web") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.key === "~" || event.key === "`" || event.code === "Backquote") {
        event.preventDefault();
        setShowDevLog((visible) => !visible);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
          flexWrap: "wrap",
          gap: 12,
          justifyContent: isRTL ? "flex-end" : "flex-start",
          marginBottom: 24,
        }}
      >
        {[
          { label: t("settings.theme"), value: currentThemeLabel },
          { label: t("settings.language"), value: language },
          { label: t("settings.notifications"), value: notificationsEnabled ? t("settings.on") : t("settings.off") },
          {
            label: user?.isGuest ? t("settings.mode") : t("settings.account"),
            value: user?.isGuest ? t("settings.guest") : user?.email || user?.name || t("settings.signedIn"),
          },
        ].map((item) => (
          <View
            key={item.label}
            className={`${nestedPanelClass} rounded-2xl px-4 py-3`}
            style={{ minWidth: 160, flexGrow: 1 }}
          >
            <Text className={`${secondaryTextClass} text-xs uppercase tracking-[0.8px]`}>
              {item.label}
            </Text>
            <Text className={`${textClass} mt-1 font-semibold`} numberOfLines={1}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "stretch",
          gap: 24,
        }}
      >
        <View style={{ flex: 1.02, gap: 24 }}>
          <View className={desktopPanelClass}>
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

          <View className={desktopPanelClass}>
            <View className={`${flexDirection} items-start mb-5`}>
              <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center">
                <Ionicons name="cloud-outline" size={20} color={accentColor} />
              </View>
              <View className={`flex-1 ${isRTL ? "mr-4" : "ml-4"}`}>
                <Text className={`${isRTL ? "text-right" : ""} ${textClass} text-xl font-semibold`}>
                  {dataSection.title}
                </Text>
                <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mt-1`} style={{ lineHeight: 21 }}>
                  {t("settings.desktopDataDescription")}
                </Text>
              </View>
            </View>

            <View className={`${nestedPanelClass} rounded-2xl overflow-hidden`}>
              {renderSettingsRows(dataSection.items, { valueMaxWidth: 240, rowPaddingVertical: 18 })}
            </View>
          </View>
        </View>

        <View style={{ flex: 0.98, gap: 24 }}>
          <View className={desktopPanelClass}>
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

            <View className={`${nestedPanelClass} rounded-2xl overflow-hidden`}>
              {renderSettingsRows(aboutSection.items, { valueMaxWidth: 260, rowPaddingVertical: 18 })}
            </View>
          </View>

          <View className={desktopPanelClass}>
            <View className={`${flexDirection} items-start mb-5`}>
              <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center">
                <Ionicons name="construct-outline" size={20} color={accentColor} />
              </View>
              <View className={`flex-1 ${isRTL ? "mr-4" : "ml-4"}`}>
                <Text className={`${isRTL ? "text-right" : ""} ${textClass} text-xl font-semibold`}>
                  {t("settings.advanced")}
                </Text>
                <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mt-1`} style={{ lineHeight: 21 }}>
                  {t("settings.desktopAdvancedDescription")}
                </Text>
              </View>
            </View>

            <View className={`${nestedPanelClass} rounded-2xl overflow-hidden`}>
              <Pressable
                onPress={() => setShowAdvancedSettings((v) => !v)}
                className={`${flexDirection} items-center px-4`}
                style={{ paddingVertical: 18 }}
              >
                <Ionicons name="construct-outline" size={20} color={accentColor} />
                <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${textClass}`}>
                  {t("settings.cacheSettings")}
                </Text>
                <Ionicons name={showAdvancedSettings ? "chevron-up" : "chevron-down"} size={22} color={accessoryIconColor} />
              </Pressable>

              {showAdvancedSettings ? (
                <>
                  <Pressable
                    onPress={handleToggleAutoClearCache}
                    className={`${flexDirection} items-center px-4`}
                    style={{ paddingVertical: 18, borderTopWidth: 1, borderColor: dividerColor }}
                  >
                    <Ionicons name="refresh-outline" size={20} color={accentColor} />
                    <View className={`flex-1 ${isRTL ? "mr-3" : "ml-3"}`}>
                      <Text className={`${isRTL ? "text-right" : ""} ${textClass}`}>{t("settings.cacheAutoClear5d")}</Text>
                      <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} text-xs mt-1`}>
                        {t("settings.cacheAutoClearDescription")}
                      </Text>
                    </View>
                    <View className={`w-12 h-6 rounded-full ${autoClearCacheEnabled ? "bg-emerald-500" : isDark ? "bg-gray-700" : isGreen ? "bg-emerald-700" : "bg-emerald-300"}`}>
                      <View className={`w-5 h-5 bg-white rounded-full mt-0.5 ${autoClearCacheEnabled ? "ml-6" : "ml-0.5"}`} />
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={handleClearCacheNow}
                    className={`${flexDirection} items-center px-4`}
                    style={{ paddingVertical: 18, borderTopWidth: 1, borderColor: dividerColor }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    <View className={`flex-1 ${isRTL ? "mr-3" : "ml-3"}`}>
                      <Text className={`${isRTL ? "text-right" : ""} ${dangerTextClass}`}>{t("settings.clearCacheNow")}</Text>
                      <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} text-xs mt-1`}>
                        {t("settings.clearCacheDescription")}
                      </Text>
                    </View>
                    <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={22} color={accessoryIconColor} />
                  </Pressable>

                  <Pressable
                    onPress={handleCopyEnglishKeyLog}
                    className={`${flexDirection} items-center px-4`}
                    style={{ paddingVertical: 18, borderTopWidth: 1, borderColor: dividerColor }}
                  >
                    <Ionicons name="bug-outline" size={20} color={accentColor} />
                    <View className={`flex-1 ${isRTL ? "mr-3" : "ml-3"}`}>
                      <Text className={`${isRTL ? "text-right" : ""} ${textClass}`}>{t("settings.debugTools")}</Text>
                      <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} text-xs mt-1`}>
                        {t("settings.copyEnglishKeyLog")}
                      </Text>
                    </View>
                    <Ionicons name="copy-outline" size={20} color={accessoryIconColor} />
                  </Pressable>
                </>
              ) : (
                <View style={{ borderTopWidth: 1, borderColor: dividerColor }} className="px-4 py-4">
                  <Text className={`${secondaryTextClass} text-sm ${isRTL ? "text-right" : ""}`}>
                    {t("settings.desktopAdvancedCollapsedDescription")}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
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
            <Pressable
              onPress={handleLogout}
              disabled={!isHydrated}
              className={`${nestedPanelClass} rounded-2xl px-4 py-5 ${flexDirection} items-center ${!isHydrated ? "opacity-60" : ""}`}
              style={{ flex: 1 }}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${dangerTextClass}`}>{t("settings.logout")}</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowDeleteConfirm(true)}
              disabled={!isHydrated}
              className={`${nestedPanelClass} rounded-2xl px-4 py-5 ${flexDirection} items-center ${!isHydrated ? "opacity-60" : ""}`}
              style={{ flex: 1 }}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${dangerTextClass}`}>{t("settings.deleteAccount")}</Text>
            </Pressable>
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
                  <Text className={`text-sm font-medium ${secondaryTextClass} mb-3 px-2`}>{t("settings.advanced")}</Text>
                  <View className={`${cardBgClass} border rounded-2xl overflow-hidden`}>
                    <Pressable
                      onPress={() => setShowAdvancedSettings((v) => !v)}
                      className={`${flexDirection} items-center px-4 py-5`}
                    >
                      <Ionicons name="construct-outline" size={20} color={accentColor} />
                      <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${textClass}`}>{t("settings.cacheSettings")}</Text>
                      <Ionicons name={showAdvancedSettings ? "chevron-up" : "chevron-down"} size={22} color={accessoryIconColor} />
                    </Pressable>

                    {showAdvancedSettings ? (
                      <>
                        <Pressable
                          onPress={handleToggleAutoClearCache}
                          className={`${flexDirection} items-center px-4 py-5 border-t ${cardBorderClass}`}
                        >
                          <Ionicons name="refresh-outline" size={20} color={accentColor} />
                          <View className={`flex-1 ${isRTL ? "mr-3" : "ml-3"}`}>
                            <Text className={`${isRTL ? "text-right" : ""} ${textClass}`}>{t("settings.cacheAutoClear5d")}</Text>
                            <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} text-xs mt-1`}>
                              {t("settings.cacheAutoClearDescription")}
                            </Text>
                          </View>
                          <View className={`w-12 h-6 rounded-full ${autoClearCacheEnabled ? "bg-emerald-500" : isDark ? "bg-gray-700" : isGreen ? "bg-emerald-700" : "bg-emerald-300"}`}>
                            <View className={`w-5 h-5 bg-white rounded-full mt-0.5 ${autoClearCacheEnabled ? "ml-6" : "ml-0.5"}`} />
                          </View>
                        </Pressable>

                        <Pressable
                          onPress={handleClearCacheNow}
                          className={`${flexDirection} items-center px-4 py-5 border-t ${cardBorderClass}`}
                        >
                          <Ionicons name="trash-outline" size={20} color="#EF4444" />
                          <View className={`flex-1 ${isRTL ? "mr-3" : "ml-3"}`}>
                            <Text className={`${isRTL ? "text-right" : ""} ${dangerTextClass}`}>{t("settings.clearCacheNow")}</Text>
                            <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} text-xs mt-1`}>
                              {t("settings.clearCacheDescription")}
                            </Text>
                          </View>
                          <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={22} color={accessoryIconColor} />
                        </Pressable>

                        <Pressable
                          onPress={handleCopyEnglishKeyLog}
                          className={`${flexDirection} items-center px-4 py-5 border-t ${cardBorderClass}`}
                        >
                          <Ionicons name="bug-outline" size={20} color={accentColor} />
                          <View className={`flex-1 ${isRTL ? "mr-3" : "ml-3"}`}>
                            <Text className={`${isRTL ? "text-right" : ""} ${textClass}`}>{t("settings.debugTools")}</Text>
                            <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} text-xs mt-1`}>
                              {t("settings.copyEnglishKeyLog")}
                            </Text>
                          </View>
                          <Ionicons name="copy-outline" size={20} color={accessoryIconColor} />
                        </Pressable>
                      </>
                    ) : null}
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
                <Pressable
                  onPress={handleLogout}
                  disabled={!isHydrated}
                  className={`${
                    isDark ? "bg-gray-900/80 border-gray-800" : isGreen ? "bg-emerald-900/90 border-emerald-800" : "bg-white border-emerald-200"
                  } border rounded-2xl px-4 py-5 ${flexDirection} items-center ${!isHydrated ? "opacity-60" : ""}`}
                  style={{ flex: showSectionGrid ? 1 : undefined }}
                >
                  <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                  <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${dangerTextClass}`}>{t("settings.logout")}</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowDeleteConfirm(true)}
                  disabled={!isHydrated}
                  className={`${
                    isDark ? "bg-gray-900/80 border-gray-800" : isGreen ? "bg-emerald-900/90 border-emerald-800" : "bg-white border-emerald-200"
                  } border rounded-2xl px-4 py-5 ${flexDirection} items-center ${!isHydrated ? "opacity-60" : ""}`}
                  style={{ flex: showSectionGrid ? 1 : undefined }}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${dangerTextClass}`}>{t("settings.deleteAccount")}</Text>
                </Pressable>
              </View>

              <Text className={`text-center text-sm ${isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : "text-gray-500"} mt-4`}>
                {t("settings.appVersion")}: {APP_VERSION}
              </Text>
              <View className="mt-4 mb-2">
                <View className={`${flexDirection} justify-center items-center`} style={{ flexWrap: "wrap" }}>
                  <Text className={`text-center text-sm ${secondaryTextClass} ${isRTL ? "ml-2" : "mr-2"}`}>{t("general.needHelpQuestion") ?? "Need Help?"}</Text>
                  <Pressable onPress={() => Linking.openURL(SUPPORT_MAILTO)} accessibilityRole="link">
                    <Text className={`text-sm ${isDark ? "text-emerald-200" : isGreen ? "text-emerald-100" : "text-emerald-600"} underline font-semibold`}>{t("general.emailUs") ?? "Email Us!"}</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
      {__DEV__
        ? renderOverlay(
            showDevLog,
            () => setShowDevLog(false),
            <>
              <Text className={`text-xl ${isRTL ? "text-right" : ""} ${textClass} mb-2`}>
                Dev Log
              </Text>
              <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mb-4`}>
                Copy one full JSON snapshot with runtime, layout, settings, account, opportunities, and raw app state for debugging.
              </Text>

              {devLogCopyStatus === "copied" ? (
                <StatusBanner variant="success" message="Full dev log copied to clipboard." className="mb-4" />
              ) : devLogCopyStatus === "failed" ? (
                <StatusBanner variant="error" message="Could not copy the dev log on this platform." className="mb-4" />
              ) : null}

              <View
                style={{
                  flexDirection: stackDialogActions ? "column" : isRTL ? "row-reverse" : "row",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <Pressable
                  onPress={copySettingsDevLog}
                  className="bg-emerald-500 rounded-lg py-4 items-center"
                  style={{ flex: stackDialogActions ? undefined : 1 }}
                >
                  <Text className={`${isDark || isGreen ? "text-white" : "text-emerald-900"} font-semibold`}>
                    Copy Log
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowDevLog(false)}
                  className={`${cardBgClass} border ${cardBorderClass} rounded-lg py-4 items-center`}
                  style={{ flex: stackDialogActions ? undefined : 1 }}
                >
                  <Text className={textClass}>{t("general.close")}</Text>
                </Pressable>
              </View>

              <View className={`${inputClass} border rounded-2xl p-3`} style={{ maxHeight: 420 }}>
                <ScrollView nestedScrollEnabled>
                  <Text
                    className={`${textClass} text-xs`}
                    selectable={Platform.OS === "web"}
                    style={{ fontFamily: Platform.OS === "ios" ? "Menlo" : Platform.OS === "android" ? "monospace" : "Consolas" }}
                  >
                    {devLogSnapshot
                      ? JSON.stringify(devLogSnapshot, null, 2)
                      : "Press Copy Log to generate the latest snapshot."}
                  </Text>
                </ScrollView>
              </View>
            </>
          )
        : null}
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
            <Pressable
              onPress={() => setShowSupportComposer(false)}
              className={`${cardBgClass} border ${cardBorderClass} rounded-lg py-4 items-center ${isSendingSupport ? "opacity-60" : ""}`}
              style={{ flex: stackDialogActions ? undefined : 1 }}
              disabled={isSendingSupport}
            >
              <Text className={textClass}>{t("general.close")}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                void sendSupportMessage();
              }}
              className={`bg-emerald-500 rounded-lg py-4 items-center ${isSendingSupport ? "opacity-60" : ""}`}
              style={{ flex: stackDialogActions ? undefined : 1 }}
              disabled={isSendingSupport}
            >
              <Text className={`${isDark || isGreen ? "text-white" : "text-emerald-900"} font-semibold`}>
                {isSendingSupport ? t("settings.sending") : t("settings.send")}
              </Text>
            </Pressable>
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
            <Pressable
              onPress={() => setShowDeleteConfirm(false)}
              className={`${cardBgClass} border ${cardBorderClass} rounded-lg py-4 items-center`}
              style={{ flex: stackDialogActions ? undefined : 1 }}
            >
              <Text className={textClass}>{t("general.cancel")}</Text>
            </Pressable>

            <Pressable
              onPress={handleDeleteConfirm}
              className={`bg-emerald-800 rounded-lg py-4 items-center ${!isHydrated ? "opacity-60" : ""}`}
              style={{ flex: stackDialogActions ? undefined : 1 }}
              disabled={!isHydrated}
            >
              <Text className="text-white font-semibold">{t("general.delete")}</Text>
            </Pressable>
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
            <Pressable
              onPress={() => setShowClearCacheConfirm(false)}
              className={`${cardBgClass} border ${cardBorderClass} rounded-lg py-4 items-center`}
              style={{ flex: stackDialogActions ? undefined : 1 }}
              disabled={isClearingCache}
            >
              <Text className={textClass}>{t("general.cancel")}</Text>
            </Pressable>

            <Pressable
              onPress={handleConfirmClearCache}
              className={`bg-red-500 rounded-lg py-4 items-center ${isClearingCache ? "opacity-60" : ""}`}
              style={{ flex: stackDialogActions ? undefined : 1 }}
              disabled={isClearingCache}
            >
              <Text className="text-white font-semibold">{isClearingCache ? t("settings.clearingCache") : t("settings.clearCacheAction")}</Text>
            </Pressable>
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
          <Pressable
            onPress={() => setShowCacheClearedPopup(false)}
            className="bg-emerald-500 rounded-lg py-4 items-center"
          >
            <Text className={`${isDark || isGreen ? "text-white" : "text-emerald-900"} font-semibold`}>{t("general.ok")}</Text>
          </Pressable>
        </>
      )}
    </ScreenBackground>
  );
}

