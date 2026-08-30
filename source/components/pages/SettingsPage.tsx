import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { type NotificationPreferences, useAppData } from "@/hooks/use-app-data";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useDataPortabilityActions } from "@/hooks/use-data-portability-actions";
import { useRouter } from "expo-router";
import { useMemo, useState, useCallback, useEffect } from "react";
import { ScrollView, Text, View, Alert, Platform, TextInput, useWindowDimensions, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { notificationsService } from "@/services/notifications/notifications.service";
import { cacheManagerService } from "@/services/storage/cache-manager.service";
import { APP_VERSION } from "@/constants/app-version";
import { ROUTES, routeWithDefaultReturnTo } from "@/constants/routes";
import { StateCard } from "@/components/ui/StateCard";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { resetTranscriptState } from "@/services/planning/transcript-reset.service";
import { AnimatedChipPressable } from "@/components/ui/AnimatedPressables";
import {
  NotificationPreferenceRows,
  type AdvancedSettingsItem,
  type NotificationPreferenceItem,
  type SettingsItem,
} from "@/components/pages/settings/SettingsRows";
import { SettingsDialog } from "@/components/pages/settings/SettingsDialog";
import { SettingsSections } from "@/components/pages/settings/SettingsSections";
import { useAccountDeletion } from "@/components/pages/settings/useAccountDeletion";
import { useSupportContact } from "@/components/pages/settings/useSupportContact";

export default function SettingsPage() {
  const router = useRouter();
  const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false);
  const [showCacheClearedPopup, setShowCacheClearedPopup] = useState(false);
  const [cacheClearedCount, setCacheClearedCount] = useState(0);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [autoClearCacheEnabled, setAutoClearCacheEnabled] = useState(false);
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
  const {
    isSendingSupport,
    openSupportComposer,
    openSupportEmail,
    sendSupportMessage,
    setShowSupportComposer,
    setSupportMessage,
    showSupportComposer,
    supportMessage,
    supportStatus,
    supportStatusText,
  } = useSupportContact({ t, user });
  const {
    handleDeleteConfirm,
    handleLogout,
    setShowDeleteConfirm,
    showDeleteConfirm,
  } = useAccountDeletion({
    deleteAccount,
    isHydrated,
    router,
    signOut,
    state,
    t,
  });
  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isWideLayout = width >= 1120;
  const showSectionGrid = width >= 860;
  const stackDialogActions = width < 520;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const pageMaxWidth = isWideLayout ? 1280 : isTablet ? 960 : 720;
  const earlyStateMaxWidth = Math.min(pageMaxWidth, isWideLayout ? 760 : isTablet ? 680 : 448);
  const sectionCardWidth: ViewStyle["width"] = showSectionGrid
    ? isWideLayout
      ? "48.2%"
      : "48%"
    : "100%";
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
  const dangerIconColor = isDark || isGreen ? "#F87171" : "#DC2626";
  const dangerSurfaceStyle = {
    backgroundColor: isDark || isGreen ? "rgba(127, 29, 29, 0.22)" : "rgba(254, 242, 242, 0.92)",
    borderColor: isDark || isGreen ? "rgba(248, 113, 113, 0.28)" : "rgba(248, 113, 113, 0.34)",
    borderWidth: 1,
  };
  const dangerActionClassName = `rounded-2xl px-4 py-5 ${flexDirection} items-center`;
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
      ] satisfies NotificationPreferenceItem[],
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

  const { handleExportData, handleImportData } = useDataPortabilityActions({
    isHydrated,
    state,
    theme,
    language,
    restoreData,
    setTheme,
    setLanguage,
    t,
  });

  // removed hasExportableData (unused) to satisfy linter

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

  const openSettingsSubpage = useCallback(
    (pathname: string) => {
      router.push(routeWithDefaultReturnTo(pathname, undefined, ROUTES.tabsSettings));
    },
    [router]
  );

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
            onPress: () => openSettingsSubpage(ROUTES.language),
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
            onPress: openSupportComposer,
          },
          {
            icon: "information-circle-outline",
            label: t("settings.about"),
            type: "nav",
            onPress: () => openSettingsSubpage(ROUTES.about),
          },
          {
            icon: "shield-checkmark-outline",
            label: t("settings.privacyPolicy"),
            type: "nav",
            onPress: () => openSettingsSubpage(ROUTES.privacy),
          },
          {
            icon: "document-text-outline",
            label: t("settings.termsOfService"),
            type: "nav",
            onPress: () => openSettingsSubpage(ROUTES.terms),
          },
          { icon: "pricetag-outline", label: t("about.version"), type: "display", value: APP_VERSION },
        ] as SettingsItem[],
      },
    ],
    [currentThemeLabel, theme, notificationsEnabled, notificationPreferenceSummary, language, setTheme, handleToggleNotifications, handleExportData, handleImportData, openSettingsSubpage, openSupportComposer, t]
  );

  const [settingsSection, , aboutSection] = sections;

  const settingsRowChrome = {
    flexDirection,
    isRTL,
    isDark,
    isGreen,
    isWideLayout,
    isTablet,
    useDesktopSettingsLayout,
    textClass,
    secondaryTextClass,
    dividerColor,
    accentColor,
    accessoryIconColor,
  };

  const advancedDesktopItems: AdvancedSettingsItem[] = [
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
        <View className="flex-1 justify-center" style={{ paddingHorizontal: shellHorizontalPadding }}>
          <View style={{ width: "100%", maxWidth: earlyStateMaxWidth, alignSelf: "center" }}>
            <StateCard variant="loading" className="w-full" />
          </View>
        </View>
      </ScreenBackground>
    );
  }

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

          <SettingsSections
            aboutSection={aboutSection}
            accentColor={accentColor}
            accessoryIconColor={accessoryIconColor}
            advancedDesktopItems={advancedDesktopItems}
            advancedMobileItems={advancedMobileItems}
            cardBgClass={cardBgClass}
            dangerActionClassName={dangerActionClassName}
            dangerIconColor={dangerIconColor}
            dangerSurfaceStyle={dangerSurfaceStyle}
            dangerTextClass={dangerTextClass}
            desktopPanelClass={desktopPanelClass}
            flexDirection={flexDirection}
            handleLogout={handleLogout}
            isAdvancedSettingsOpen={isAdvancedSettingsOpen}
            isDark={isDark}
            isGreen={isGreen}
            isHydrated={isHydrated}
            isRTL={isRTL}
            nestedPanelClass={nestedPanelClass}
            onDeleteAccountPress={() => setShowDeleteConfirm(true)}
            onOpenSupportEmail={() => {
              void openSupportEmail();
            }}
            sectionCardWidth={sectionCardWidth}
            sections={sections}
            secondaryTextClass={secondaryTextClass}
            settingsRowChrome={settingsRowChrome}
            settingsSection={settingsSection}
            showSectionGrid={showSectionGrid}
            t={t}
            textClass={textClass}
            toggleAdvancedSettings={toggleAdvancedSettings}
            useDesktopSettingsLayout={useDesktopSettingsLayout}
          />
        </View>
      </ScrollView>
      <SettingsDialog
        visible={showNotificationPreferences}
        onRequestClose={() => setShowNotificationPreferences(false)}
        bottomPadding={modalBottomPadding}
        cardBgClass={cardBgClass}
        dialogHorizontalPadding={dialogHorizontalPadding}
        dialogMaxWidth={dialogMaxWidth}
        dialogPadding={dialogPadding}
        keyboardVerticalOffset={insets.top}
        topPadding={modalTopPadding}
      >
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
            <NotificationPreferenceRows
              {...settingsRowChrome}
              items={notificationPreferenceItems}
              preferences={notificationPreferences}
              onToggle={handleToggleNotificationPreference}
            />
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
      </SettingsDialog>
      <SettingsDialog
        visible={showSupportComposer}
        onRequestClose={() => setShowSupportComposer(false)}
        allowBackdropDismiss={!isSendingSupport}
        bottomPadding={modalBottomPadding}
        cardBgClass={cardBgClass}
        dialogHorizontalPadding={dialogHorizontalPadding}
        dialogMaxWidth={dialogMaxWidth}
        dialogPadding={dialogPadding}
        keyboardVerticalOffset={insets.top}
        topPadding={modalTopPadding}
      >
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
        </>
      </SettingsDialog>
      <SettingsDialog
        visible={showDeleteConfirm}
        onRequestClose={() => setShowDeleteConfirm(false)}
        bottomPadding={modalBottomPadding}
        cardBgClass={cardBgClass}
        dialogHorizontalPadding={dialogHorizontalPadding}
        dialogMaxWidth={dialogMaxWidth}
        dialogPadding={dialogPadding}
        keyboardVerticalOffset={insets.top}
        topPadding={modalTopPadding}
      >
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
              className={`${cardBgClass} border ${cardBorderClass} rounded-2xl py-4 items-center`}
              containerStyle={{ flex: stackDialogActions ? undefined : 1 }}
            >
              <Text className={textClass}>{t("general.cancel")}</Text>
            </AnimatedChipPressable>

            <AnimatedChipPressable
              onPress={handleDeleteConfirm}
              className={`rounded-2xl py-4 items-center ${!isHydrated ? "opacity-60" : ""}`}
              containerStyle={{ flex: stackDialogActions ? undefined : 1 }}
              style={{ backgroundColor: isDark || isGreen ? "#991B1B" : "#DC2626" }}
              disabled={!isHydrated}
            >
              <Text className="text-white font-semibold">{t("general.delete")}</Text>
            </AnimatedChipPressable>
          </View>
        </>
      </SettingsDialog>
      <SettingsDialog
        visible={showClearCacheConfirm}
        onRequestClose={() => setShowClearCacheConfirm(false)}
        allowBackdropDismiss={!isClearingCache}
        bottomPadding={modalBottomPadding}
        cardBgClass={cardBgClass}
        dialogHorizontalPadding={dialogHorizontalPadding}
        dialogMaxWidth={dialogMaxWidth}
        dialogPadding={dialogPadding}
        keyboardVerticalOffset={insets.top}
        topPadding={modalTopPadding}
      >
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
        </>
      </SettingsDialog>
      <SettingsDialog
        visible={showCacheClearedPopup}
        onRequestClose={() => setShowCacheClearedPopup(false)}
        bottomPadding={modalBottomPadding}
        cardBgClass={cardBgClass}
        dialogHorizontalPadding={dialogHorizontalPadding}
        dialogMaxWidth={dialogMaxWidth}
        dialogPadding={dialogPadding}
        keyboardVerticalOffset={insets.top}
        topPadding={modalTopPadding}
      >
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
      </SettingsDialog>
    </ScreenBackground>
  );
}

