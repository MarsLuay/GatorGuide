import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Keyboard,
  Alert,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import ConfettiCannon from "react-native-confetti-cannon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useDataPortabilityActions } from "@/hooks/use-data-portability-actions";
import { US_STATE_OPTIONS } from "@/services/app/questionnaire.enums";
import { useAppData } from "@/hooks/use-app-data";
import {
  AnimatedChipPressable,
} from "@/components/ui/AnimatedPressables";
import { ProfileGuestDataActionsCard } from "@/components/pages/profile/ProfileGuestDataActionsCard";
import { StateCard } from "@/components/ui/StateCard";
import { localStorageService } from "@/services/storage/local-storage.service";
import * as ImagePicker from "expo-image-picker";
import { ROUTES, routeWithReturnTo } from "@/constants/routes";
import { GREEN_RIVER_MAJOR_OPTIONS } from "@/constants/green-river-major-options.generated";
import {
  PROFILE_QUESTIONNAIRE_FIELD_IDS,
  STORAGE_KEYS,
} from "@/constants/schema";
import type { SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import { useProfileAutosave } from "@/components/pages/profile/useProfileAutosave";
import { useProfileTranscriptWorkflow } from "@/components/pages/profile/useProfileTranscriptWorkflow";
import { ProfileDocumentPanel } from "@/components/pages/profile/ProfileDocumentPanel";
import { ProfileFieldsPanel } from "@/components/pages/profile/ProfileFieldsPanel";
import { ProfileHero } from "@/components/pages/profile/ProfileHero";
import { ProfileQuestionnaireCard } from "@/components/pages/profile/ProfileQuestionnaireCard";
import {
  PROFILE_STATE_ABBREVIATIONS_BY_NAME,
  getProfileGpaInputState,
  type EditableProfileSnapshot,
} from "@/components/pages/profile/profile-state-utils";

export default function ProfilePage() {
  const router = useRouter();
  const { theme, setTheme, isDark, isGreen, isLight } = useAppTheme();
  const { t, language, setLanguage } = useAppLanguage();
  const { isHydrated, state, updateUser, setQuestionnaireAnswers, restoreData } = useAppData();
  const { getScrollContentPadding } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();

  // Initialize audio player for celebration sound
  const cheerPlayer = useAudioPlayer('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3');

  const user = state.user;
  const latestProfileGpaRef = useRef("");

  const isEditing = true;
  const [editData, setEditData] = useState<EditableProfileSnapshot>({
    name: "",
    state: "",
    major: "",
    gender: "",
    gpa: "",
    transcript: "",
    residencyType: "",
  });
  latestProfileGpaRef.current = editData.gpa || user?.gpa || "";

  const [isConfettiPlaying, setIsConfettiPlaying] = useState(false);
  const [confettiCooldown, setConfettiCooldown] = useState(false);
  const [showGuestProfile, setShowGuestProfile] = useState(false);
  const [isMajorDropdownOpen, setIsMajorDropdownOpen] = useState(false);
  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!user?.isGuest) {
      setShowGuestProfile(false);
      return;
    }

    localStorageService.getItem(STORAGE_KEYS.guestProfileShow).then((value) => {
      if (!cancelled) setShowGuestProfile(value === "true");
    });

    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.isGuest]);

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
  const handleCreateAccount = async () => {
    if (!user?.isGuest || !isHydrated) return;

    try {
      // Save current guest data to temporary storage
      const pendingData = {
        user: {
          ...user,
          isGuest: false, // Will become a real user
        },
        questionnaireAnswers: state.questionnaireAnswers,
      };
      await localStorageService.setItem(STORAGE_KEYS.pendingAccountData, JSON.stringify(pendingData));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push(ROUTES.login);
    } catch {
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    }
  };
  const confettiRef = useRef<ConfettiCannon | null>(null);

  useEffect(() => {
    if (!isHydrated) return;
    setEditData({
      name: user?.name ?? "",
      state: user?.state ?? "",
      major: user?.major ?? "",
      gender: user?.gender ?? "",
      gpa: user?.gpa ?? "",
      transcript: user?.transcript ?? "",
      residencyType: user?.residencyType ?? "",
    });
  }, [isHydrated, user?.name, user?.state, user?.major, user?.gender, user?.gpa, user?.transcript, user?.residencyType]);

  const textClass = isDark ? "text-white" : isGreen ? "text-white" : isLight ? "text-emerald-900" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : isLight ? "text-emerald-700" : "text-gray-600";
  const cardBgClass = isDark
    ? "bg-gray-900/80 border-gray-800"
    : isGreen
      ? "bg-emerald-900/90 border-emerald-800"
      : isLight
        ? "bg-emerald-500/5 border-emerald-200"
        : "bg-white/90 border-gray-200";
  const inputBgClass = isDark
    ? "bg-gray-800 border-gray-700"
    : isGreen
      ? "bg-emerald-900/70 border-emerald-700"
      : isLight
        ? "bg-emerald-500/5 border-emerald-300"
        : "bg-gray-50 border-gray-300";
  const inputClass = `w-full ${inputBgClass} ${textClass} border rounded-lg px-3 py-2`;
  const borderClass = isDark ? "border-gray-800" : isGreen ? "border-emerald-700" : isLight ? "border-emerald-300" : "border-gray-200";
  const placeholderColor = isDark ? "#9CA3AF" : isGreen ? "#b6e2b6" : isLight ? "#1f8a5d" : "#6B7280";
  const dropdownSurfaceColor = isDark ? "#111827" : isGreen ? "#064e3b" : "#FFFFFF";
  const guestCtaCardClass = isLight ? "bg-emerald-100 border border-emerald-200" : isDark ? "bg-emerald-500 border" : "bg-emerald-500";
  const guestCtaCardStyle = isDark ? { backgroundColor: "#00572b", borderColor: "#00753e" } : undefined;
  const guestCtaTextClass = isLight ? "text-emerald-900" : "text-white";
  const guestCtaBodyClass = isLight ? "text-emerald-800" : "text-emerald-100";
  const guestCtaIconColor = isLight ? "#1f8a5d" : isDark ? "#8cd19e" : "#FFFFFF";
  const hasOpenSelectorOverlay = isMajorDropdownOpen || isStateDropdownOpen;
  const profileCardOverlayStyle = hasOpenSelectorOverlay
    ? {
        position: "relative" as const,
        overflow: "visible" as const,
        zIndex: 80,
        elevation: 80,
      }
    : {
        position: "relative" as const,
        overflow: "visible" as const,
      };
  const selectorFieldBaseOverlayStyle = {
    position: "relative" as const,
    overflow: "visible" as const,
  };
  const selectorFieldOpenOverlayStyle = {
    ...selectorFieldBaseOverlayStyle,
    zIndex: 90,
    elevation: 90,
  };
  const majorFieldOverlayStyle = isMajorDropdownOpen
    ? selectorFieldOpenOverlayStyle
    : selectorFieldBaseOverlayStyle;
  const stateFieldOverlayStyle = isStateDropdownOpen
    ? selectorFieldOpenOverlayStyle
    : selectorFieldBaseOverlayStyle;
  const isWideLayout = viewportWidth >= 820;
  const isDesktopLayout = viewportWidth >= 1200;
  const isCompactPhone = viewportWidth < 390;
  const useDesktopFitLayout = Platform.OS === "web" && isDesktopLayout;
  const pageMaxWidth = isDesktopLayout ? 1280 : 1040;
  const earlyStateMaxWidth = Math.min(pageMaxWidth, isDesktopLayout ? 760 : isWideLayout ? 680 : 448);
  const shellHorizontalPadding = isWideLayout ? 24 : isCompactPhone ? 16 : 20;
  const profileContentPadding = isWideLayout ? 24 : isCompactPhone ? 18 : 20;
  const stackProfileActionButtons = viewportWidth < 460;
  const avatarSize = isDesktopLayout ? 88 : isWideLayout ? 76 : 56;
  const avatarFallbackSize = isDesktopLayout ? 38 : isWideLayout ? 32 : 26;
  const desktopPanelGap = 16;
  const desktopProfileMaxWidth = isDesktopLayout ? 900 : 820;
  const desktopProfileFrameStyle = {
    width: "100%" as const,
    maxWidth: desktopProfileMaxWidth,
    alignSelf: "center" as const,
  };
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 16,
  });
  const useResponsiveFieldSectionSpacing = Platform.OS === "web" && viewportWidth >= 1080;
  const hasQuestionnaireData = useMemo(
    () => Object.keys(state.questionnaireAnswers ?? {}).length > 0,
    [state.questionnaireAnswers]
  );

  // (removed unused hasExportableData helper to satisfy linter)

  const capitalizeWords = (text: string | undefined) => {
    if (!text) return "";
    return text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  };

  const greenRiverMajorOptions = GREEN_RIVER_MAJOR_OPTIONS;

  const profileStateOptions = useMemo<SearchableSelectOption[]>(
    () =>
      US_STATE_OPTIONS.map((stateName) => {
        const abbreviation = PROFILE_STATE_ABBREVIATIONS_BY_NAME[stateName];

        return {
          id: stateName,
          label: stateName,
          description: abbreviation,
          searchText: `${stateName} ${abbreviation ?? ""}`,
        };
      }),
    []
  );

  const greenRiverMajorLookup = useMemo(
    () =>
      new Map(
        greenRiverMajorOptions.map((option) => [option.id.toLowerCase(), option.id])
      ),
    [greenRiverMajorOptions]
  );

  useProfileAutosave({
    editData,
    greenRiverMajorLookup,
    isHydrated,
    setEditData,
    updateUser,
    user,
  });

  const {
    activeDocumentAnalysis,
    applyDocumentReview,
    dismissDocumentReview,
    documentReviews,
    handlePickTranscript,
    transcriptDisplayName,
  } = useProfileTranscriptWorkflow({
    editData,
    isHydrated,
    language,
    latestProfileGpaRef,
    questionnaireAnswers: state.questionnaireAnswers,
    setEditData,
    setQuestionnaireAnswers,
    t,
    updateUser,
    user,
  });

  const resolveGreenRiverMajorId = (value: string | undefined) => {
    const trimmedValue = String(value ?? "").trim();
    if (!trimmedValue) return null;

    return greenRiverMajorLookup.get(trimmedValue.toLowerCase()) ?? null;
  };

  const formatMajorDisplayValue = (value: string | undefined) => {
    const trimmedValue = String(value ?? "").trim();
    if (!trimmedValue) return "";

    const canonicalMajor = resolveGreenRiverMajorId(trimmedValue);
    if (canonicalMajor) {
      return canonicalMajor;
    }

    return trimmedValue === trimmedValue.toLowerCase()
      ? capitalizeWords(trimmedValue)
      : trimmedValue;
  };

  const questionnaireAnsweredCount = useMemo(
    () =>
      PROFILE_QUESTIONNAIRE_FIELD_IDS.reduce((count, questionId) => {
        const value = state.questionnaireAnswers?.[questionId];
        return typeof value === "string" && value.trim() ? count + 1 : count;
      }, 0),
    [state.questionnaireAnswers]
  );
  const questionnaireCompletionLabel = `${questionnaireAnsweredCount}/${PROFILE_QUESTIONNAIRE_FIELD_IDS.length}`;
  const questionnaireActionLabel = hasQuestionnaireData
    ? t("profile.edit")
    : t("profile.complete");
  const openQuestionnairePage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(routeWithReturnTo(ROUTES.questionnaire, ROUTES.profile));
  };

  const handleGpaChange = (value: string) => {
    const gpaInput = getProfileGpaInputState(value);
    if (!gpaInput.accepted) return;

    const num = gpaInput.numericValue ?? Number.NaN;
    latestProfileGpaRef.current = value;
    setEditData((p) => ({ ...p, gpa: value }));

    // Celebrate perfect GPA only when user types exact `4`.
    if (num === 4.0 && value === "4" && !confettiCooldown) {
      setIsConfettiPlaying(true);
      setConfettiCooldown(true);
      setTimeout(() => setIsConfettiPlaying(false), 6000);
      setTimeout(() => setConfettiCooldown(false), 1000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      cheerPlayer.play();
    } else if (value !== "4" && isConfettiPlaying) {
      setIsConfettiPlaying(false);
    }
  };

  const handlePickAvatar = async () => {
    if (!user?.uid || !isHydrated) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("general.error"), t("profile.prepareDataError"));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;
      const { storageService } = await import("@/services/storage/storage.service");
      const uploaded = await storageService.uploadAvatar(user.uid, uri);
      await updateUser({ avatar: uploaded.url });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      void errorLoggingService.captureException(err, {
        category: "upload",
        operation: "pick-avatar",
        severity: "error",
        handled: true,
        source: "profile-page",
        screen: "profile",
        route: ROUTES.profile,
      });
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    }
  };

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

  // If not signed in yet, show a simple prompt (prevents null crashes)
  if (!user) {
    return (
      <ScreenBackground>
        <View className="flex-1 justify-center" style={{ paddingHorizontal: shellHorizontalPadding }}>
          <View style={{ width: "100%", maxWidth: earlyStateMaxWidth, alignSelf: "center" }}>
            <StateCard
              variant="empty"
              icon="person-circle-outline"
              title={t("profile.notSignedIn")}
              message={t("profile.notSignedInMessage")}
              actionLabel={t("profile.goToLogin")}
              onAction={() => router.replace(ROUTES.login)}
              className="w-full"
            />
          </View>
        </View>
      </ScreenBackground>
    );
  }

  // If guest user, show only create profile button
  if (user?.isGuest && !showGuestProfile) {
    return (
      <ScreenBackground>
        <View className="flex-1 justify-center" style={{ paddingHorizontal: shellHorizontalPadding }}>
          <View style={{ width: "100%", maxWidth: earlyStateMaxWidth, alignSelf: "center" }}>
            <View className="items-center mb-8">
              <View className="bg-emerald-500 p-4 rounded-full mb-4">
                <MaterialIcons name="person-add" size={48} color="#001f0f" />
              </View>
              
              <Text className={`text-3xl ${textClass} text-center font-semibold mb-2`}>{t("profile.createYourProfile")}</Text>
              <Text className={`${secondaryTextClass} text-center text-base`}>
                {t("profile.createProfileMessage")}
              </Text>
            </View>

            <AnimatedChipPressable
              onPress={() => router.push(ROUTES.login)}
              className={`${isLight ? "bg-emerald-200" : "bg-emerald-500"} rounded-2xl py-4 px-6 items-center flex-row justify-center`}
            >
              <MaterialIcons name="arrow-forward" size={20} color="#001f0f" />
              <Text className={`${isDark || isGreen ? 'text-white' : 'text-emerald-900'} font-semibold ml-2`}>{t("profile.createYourProfile")}</Text>
            </AnimatedChipPressable>

            <AnimatedChipPressable
              onPress={() => {
                setShowGuestProfile(true);
                localStorageService.setItem(STORAGE_KEYS.guestProfileShow, "true").catch(() => {});
              }}
              className={`${cardBgClass} border rounded-2xl py-3 px-6 items-center mt-3`}
            >
              <Text className={secondaryTextClass}>{t("profile.continueAsGuest")}</Text>
            </AnimatedChipPressable>
          </View>
        </View>
      </ScreenBackground>
    );
  }

  const renderProfileHero = () => (
    <ProfileHero
      avatarFallbackSize={avatarFallbackSize}
      avatarSize={avatarSize}
      capitalizeWords={capitalizeWords}
      editData={editData}
      handlePickAvatar={handlePickAvatar}
      isDark={isDark}
      isEditing={isEditing}
      isWideLayout={isWideLayout}
      profileContentPadding={profileContentPadding}
      secondaryTextClass={secondaryTextClass}
      t={t}
      textClass={textClass}
      user={user}
    />
  );

  const renderProfileFields = () => (
    <ProfileFieldsPanel
      borderClass={borderClass}
      capitalizeWords={capitalizeWords}
      dropdownSurfaceColor={dropdownSurfaceColor}
      editData={editData}
      formatMajorDisplayValue={formatMajorDisplayValue}
      greenRiverMajorOptions={greenRiverMajorOptions}
      guestCtaBodyClass={guestCtaBodyClass}
      guestCtaCardClass={guestCtaCardClass}
      guestCtaCardStyle={guestCtaCardStyle}
      guestCtaIconColor={guestCtaIconColor}
      guestCtaTextClass={guestCtaTextClass}
      handleCreateAccount={handleCreateAccount}
      handleGpaChange={handleGpaChange}
      inputBgClass={inputBgClass}
      inputClass={inputClass}
      isEditing={isEditing}
      isMajorDropdownOpen={isMajorDropdownOpen}
      isStateDropdownOpen={isStateDropdownOpen}
      isWideLayout={isWideLayout}
      majorFieldOverlayStyle={majorFieldOverlayStyle}
      placeholderColor={placeholderColor}
      profileStateOptions={profileStateOptions}
      resolveGreenRiverMajorId={resolveGreenRiverMajorId}
      responsiveSectionSpacing={useResponsiveFieldSectionSpacing}
      secondaryTextClass={secondaryTextClass}
      setEditData={setEditData}
      setIsMajorDropdownOpen={setIsMajorDropdownOpen}
      setIsStateDropdownOpen={setIsStateDropdownOpen}
      stateFieldOverlayStyle={stateFieldOverlayStyle}
      t={t}
      textClass={textClass}
      user={user}
    />
  );

  const renderDocumentFields = ({
    noDivider = false,
    noTopSpacing = false,
  }: {
    noDivider?: boolean;
    noTopSpacing?: boolean;
  } = {}) => (
    <ProfileDocumentPanel
      activeDocumentAnalysis={!!activeDocumentAnalysis}
      applyDocumentReview={applyDocumentReview}
      borderClass={borderClass}
      cardBgClass={cardBgClass}
      dismissDocumentReview={dismissDocumentReview}
      documentReview={documentReviews.transcript}
      editData={editData}
      handlePickTranscript={handlePickTranscript}
      inputBgClass={inputBgClass}
      isEditing={isEditing}
      noDivider={noDivider}
      noTopSpacing={noTopSpacing}
      responsiveSectionSpacing={useResponsiveFieldSectionSpacing}
      secondaryTextClass={secondaryTextClass}
      t={t}
      textClass={textClass}
      transcriptDisplayName={transcriptDisplayName}
      user={user}
    />
  );

  const renderQuestionnaireCard = ({
    compact = false,
    className = "",
  }: {
    compact?: boolean;
    className?: string;
  } = {}) => (
    <ProfileQuestionnaireCard
      className={className}
      compact={compact}
      hasQuestionnaireData={hasQuestionnaireData}
      isDark={isDark}
      isGreen={isGreen}
      onPress={openQuestionnairePage}
      questionnaireActionLabel={questionnaireActionLabel}
      questionnaireCompletionLabel={questionnaireCompletionLabel}
      secondaryTextClass={secondaryTextClass}
      stackProfileActionButtons={stackProfileActionButtons}
      t={t}
      textClass={textClass}
    />
  );

  if (useDesktopFitLayout) {
    return (
      <>
        <ScreenBackground>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
          >
            <ScrollView
              className="flex-1"
              contentContainerStyle={{
                flexGrow: 1,
                ...scrollContentPadding,
              }}
              contentInsetAdjustmentBehavior="automatic"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              onScrollBeginDrag={Keyboard.dismiss}
            >
              <View
                style={{
                  width: "100%",
                  maxWidth: pageMaxWidth,
                  alignSelf: "center",
                  paddingHorizontal: shellHorizontalPadding,
                }}
              >
              {user?.isGuest && showGuestProfile ? (
                <ProfileGuestDataActionsCard
                  variant="desktop"
                  cardBgClass={cardBgClass}
                  textClass={textClass}
                  secondaryTextClass={secondaryTextClass}
                  isLight={isLight}
                  isDark={isDark}
                  isGreen={isGreen}
                  stackActions={stackProfileActionButtons}
                  frameStyle={desktopProfileFrameStyle}
                  onImport={handleImportData}
                  onExport={handleExportData}
                  t={t}
                />
              ) : null}

              <View className="pb-3" style={desktopProfileFrameStyle}>
                <View>
                  <Text className={`text-2xl ${textClass} font-semibold`}>{t("home.yourProfile")}</Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>{t("profile.yourDataSaved")}</Text>
                </View>
              </View>

              <View
                style={{
                  ...desktopProfileFrameStyle,
                  gap: desktopPanelGap,
                }}
              >
                <View
                  className={`${cardBgClass} border rounded-2xl ${hasOpenSelectorOverlay ? "" : "overflow-hidden"}`}
                  style={profileCardOverlayStyle}
                >
                  {renderProfileHero()}
                  <View
                    style={{
                      paddingHorizontal: profileContentPadding,
                      paddingVertical: 24,
                      paddingBottom: 28,
                    }}
                  >
                    {renderProfileFields()}
                    {renderDocumentFields()}
                  </View>
                </View>

                {renderQuestionnaireCard({ compact: true })}
              </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </ScreenBackground>
        {isConfettiPlaying && (
          <ConfettiCannon
            key="confetti"
            ref={confettiRef}
            count={150}
            origin={{ x: viewportWidth / 2, y: -10 }}
            autoStart={true}
            fadeOut={true}
            fallSpeed={3000}
          />
        )}
      </>
    );
  }

  // Main profile page
  return (
    <>
      <ScreenBackground>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              flexGrow: 1,
              ...scrollContentPadding,
            }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={isWideLayout}
            onScrollBeginDrag={Keyboard.dismiss}
          >
            <View style={{ width: "100%", maxWidth: pageMaxWidth }} className="self-center">
          {user?.isGuest && showGuestProfile ? (
            <View className="pt-6" style={{ paddingHorizontal: shellHorizontalPadding }}>
              <ProfileGuestDataActionsCard
                variant="default"
                cardBgClass={cardBgClass}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                isLight={isLight}
                isDark={isDark}
                isGreen={isGreen}
                stackActions={stackProfileActionButtons}
                frameStyle={isWideLayout ? desktopProfileFrameStyle : undefined}
                onImport={handleImportData}
                onExport={handleExportData}
                t={t}
              />
            </View>
          ) : null}
          {/* Header */}
          <View className="pt-6 pb-2" style={{ paddingHorizontal: shellHorizontalPadding }}>
            <View style={isWideLayout ? desktopProfileFrameStyle : undefined}>
              <Text className={`text-2xl ${textClass} font-semibold`}>{t("home.yourProfile")}</Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>{t("profile.yourDataSaved")}</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: shellHorizontalPadding }}>
            {isWideLayout ? (
              <View
                style={{
                  ...desktopProfileFrameStyle,
                  gap: desktopPanelGap,
                }}
              >
                <View
                  className={`${cardBgClass} border rounded-2xl ${hasOpenSelectorOverlay ? "" : "overflow-hidden"}`}
                  style={profileCardOverlayStyle}
                >
                  {renderProfileHero()}
                  <View className="py-6" style={{ paddingHorizontal: profileContentPadding }}>
                    {renderProfileFields()}
                    {renderDocumentFields()}
                  </View>
                </View>

                {renderQuestionnaireCard({ compact: true })}
              </View>
            ) : (
              <View
                className={`${cardBgClass} border rounded-2xl ${hasOpenSelectorOverlay ? "" : "overflow-hidden"}`}
                style={profileCardOverlayStyle}
              >
                {renderProfileHero()}
                <View className="py-6" style={{ paddingHorizontal: profileContentPadding }}>
                  {renderProfileFields()}
                  {renderDocumentFields()}
                </View>
              </View>
            )}

            {!isWideLayout ? renderQuestionnaireCard({ className: "mt-4" }) : null}
          </View>
        </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenBackground>
      {isConfettiPlaying && (
        <ConfettiCannon
          key="confetti"
          ref={confettiRef}
          count={150}
          origin={{ x: viewportWidth / 2, y: -10 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={3000}
        />
      )}
    </>
  );
}

