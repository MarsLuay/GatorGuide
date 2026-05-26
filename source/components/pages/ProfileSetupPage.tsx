import { useRef, useState } from "react";
import { View, Text, ScrollView, Keyboard, Alert, Platform, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import ConfettiCannon from "react-native-confetti-cannon";
import { deleteField, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROUTES } from "@/constants/routes";
import { FIRESTORE_COLLECTIONS } from "@/constants/schema";
import { db } from "@/services/firebase/firebase";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppTheme } from "@/hooks/use-app-theme";
import useBack from "@/hooks/use-back";
import { FormInput } from "@/components/ui/FormInput";
import { AppButton } from "@/components/ui/AppButton";
import { AnimatedCardPressable, AnimatedIconPressable } from "@/components/ui/AnimatedPressables";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageBackButton } from "@/components/ui/PageBackButton";
import { DocumentExtractionReviewCard } from "@/components/ui/DocumentExtractionReviewCard";
import type { DocumentExtractionReview } from "@/services/documents/document-reader.service";
import {
  ensureProfileSetupRoadmap,
  extractProfileTranscriptDocumentReview,
  pickProfileTranscriptDocument,
  prepareTranscriptDocumentReview,
  uploadProfileTranscriptDocument,
  type SelectedProfileDocument,
} from "@/components/pages/profile/profile-document-workflow";
import {
  formatProfileGpaDisplay,
  getProfileGpaInputState,
  hasProfileGpaValue,
  omitProfileReviewField,
} from "@/components/pages/profile/profile-state-utils";
import { errorLoggingService } from "@/services/logging/error-logging.service";

export default function ProfileSetupPage() {
  const router = useRouter();
  const back = useBack(ROUTES.tabs);
  const { updateUser, setQuestionnaireAnswers, state } = useAppData();
  const { t } = useAppLanguage();
  const styles = useThemeStyles();
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const confettiRef = useRef<ConfettiCannon | null>(null);
  const cheerPlayer = useAudioPlayer("https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3");

  const [step, setStep] = useState(1);
  const [major, setMajor] = useState("");
  const [transcriptDoc, setTranscriptDoc] = useState<SelectedProfileDocument | null>(null);
  const [gpa, setGpa] = useState("");
  const latestGpaRef = useRef("");
  latestGpaRef.current = gpa;

  const [isConfettiPlaying, setIsConfettiPlaying] = useState(false);
  const [confettiCooldown, setConfettiCooldown] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscriptAnalysisActive, setIsTranscriptAnalysisActive] = useState(false);
  const [transcriptReview, setTranscriptReview] = useState<DocumentExtractionReview | null>(null);
  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isWideLayout = width >= 1080;
  const showUploadGrid = width >= 900;
  const stackFooterActions = width < 460;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const pageMaxWidth = isWideLayout ? 1120 : isTablet ? 920 : 720;
  const contentTopPadding = insets.top + 16;
  const contentBottomPadding = Math.max(insets.bottom + 32, 40);
  const cardPadding = isTablet ? 28 : 20;
  const introPanelWidth = isWideLayout ? 310 : undefined;
  const currentStepLabel =
    step === 1
      ? t("setup.major")
      : step === 2
        ? t("setup.gpa")
        : t("setup.transcript");
  const stepItems = [
    { id: 1, label: t("setup.major") },
    { id: 2, label: t("setup.gpa") },
    { id: 3, label: t("setup.transcript") },
  ];

  const dismissDocumentReview = () => {
    setTranscriptReview(null);
  };

  const handlePickTranscript = async () => {
    try {
      const selected = await pickProfileTranscriptDocument();
      if (!selected) return;
      setTranscriptDoc(selected);

      setIsTranscriptAnalysisActive(true);
      try {
        const review = await extractProfileTranscriptDocumentReview({
          document: selected,
          currentProfile: {
            major,
            gpa,
          },
          questionnaireAnswers: state.questionnaireAnswers,
        });
        const transcriptGpa = review.userPatch.gpa;
        if (transcriptGpa) {
          if (!hasProfileGpaValue(latestGpaRef.current)) {
            const formattedTranscriptGpa = formatProfileGpaDisplay(transcriptGpa);
            if (formattedTranscriptGpa) {
              latestGpaRef.current = formattedTranscriptGpa;
              setGpa(formattedTranscriptGpa);
            }
          }
          setTranscriptReview(
            prepareTranscriptDocumentReview({
              removeGpa: true,
              review,
            })
          );
        } else {
          setTranscriptReview(
            prepareTranscriptDocumentReview({
              hideEmpty: false,
              review,
            })
          );
        }
      } catch (error) {
        Alert.alert(
          t("profile.documentReaderUnavailableTitle"),
          error instanceof Error ? error.message : t("profile.prepareDataError")
        );
      } finally {
        setIsTranscriptAnalysisActive(false);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      void errorLoggingService.captureException(err, {
        category: "upload",
        operation: "analyze-transcript-document",
        severity: "error",
        handled: true,
        source: "profile-setup-page",
        screen: "profile-setup",
        route: ROUTES.profileSetup,
      });
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else back();
  };

  const handleGpaChange = (value: string) => {
    // Allow digits and at most one decimal point
    const gpaInput = getProfileGpaInputState(value);
    if (gpaInput.accepted) {
      const parts = value.split('.');
      const intPart = parts[0] ?? '';
      const fracPart = parts[1] ?? '';

      // Prevent more than two decimal places
      if (fracPart.length > 2) return;

      // Disallow fractional values that reach 4.00 — decimals max at 3.99
      if (intPart === '4' && value.includes('.')) return;

      const num = gpaInput.numericValue ?? Number(value);
      const isEmptyOrZeroish = value === '' || value === '0' || value === '0.';

      if (
        isEmptyOrZeroish ||
        (Number.isFinite(num) && (value.includes('.') ? num <= 3.99 : num <= 4.0))
      ) {
        latestGpaRef.current = value;
        setGpa(value);
        if (hasProfileGpaValue(value)) {
          setTranscriptReview((review) => {
            if (!review) return review;
            const nextReview = omitProfileReviewField(review, "gpa");
            return nextReview.items.length ? nextReview : null;
          });
        }

        // Celebrate perfect GPA when user types exact '4'
        if (num === 4.0 && value === '4' && !confettiCooldown) {
          setIsConfettiPlaying(true);
          setConfettiCooldown(true);
          setTimeout(() => setIsConfettiPlaying(false), 6000);
          setTimeout(() => setConfettiCooldown(false), 1000);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (cheerPlayer) cheerPlayer.play();
        }
      }
    }
  };

  const applyDocumentReview = async () => {
    const review = transcriptReview;
    if (!review) return;

    if (review.userPatch.major) setMajor(review.userPatch.major);
    if (review.userPatch.gpa && !hasProfileGpaValue(latestGpaRef.current)) {
      const formattedGpa = formatProfileGpaDisplay(review.userPatch.gpa);
      latestGpaRef.current = formattedGpa;
      setGpa(formattedGpa);
    }

    if (Object.keys(review.questionnairePatch).length) {
      await setQuestionnaireAnswers({
        ...state.questionnaireAnswers,
        ...review.questionnairePatch,
      });
    }

    dismissDocumentReview();
    Alert.alert(t("profile.documentReaderAppliedTitle"), t("profile.documentReaderAppliedMessage"));
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const uploadTranscriptDocument = async (
    userId: string,
    selectedDoc: SelectedProfileDocument | null
  ): Promise<string> => {
    const uploaded = await uploadProfileTranscriptDocument(userId, selectedDoc);
    return uploaded?.url ?? "";
  };

  const handleContinue = async () => {
    try {
      const userId = state.user?.uid;
      if (!userId) {
        router.replace(ROUTES.login);
        return;
      }

      setIsUploading(true);

      const finalTranscriptUrl = await uploadTranscriptDocument(userId, transcriptDoc);

      const sanitizedGpa = formatProfileGpaDisplay(gpa);

      const flatData = {
        major,
        gpa: sanitizedGpa || "",
        resume: "",
        transcript: finalTranscriptUrl,
        isProfileComplete: true,
      };

      if (db) {
        const userDocRef = doc(db, FIRESTORE_COLLECTIONS.users, userId);
        await setDoc(
          userDocRef,
          {
            major,
            gpa: sanitizedGpa || "",
            resume: "",
            isProfileComplete: true,
            transcript: deleteField(),
            resumeFileName: "",
            transcriptFileName: deleteField(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      await updateUser(flatData);
      // reflect sanitized GPA locally for consistent display
      setGpa(sanitizedGpa);

      try {
        await ensureProfileSetupRoadmap({
          gpa,
          major,
          questionnaireAnswers: state.questionnaireAnswers,
          savedCollegeNames: (state.savedColleges ?? []).map((college) => college.name),
          transcriptFileName: finalTranscriptUrl ? transcriptDoc?.name : null,
          userId,
        });
      } catch {
        void errorLoggingService.captureMessage("Planning data generation failed, but profile saved.", {
          category: "ai",
          operation: "post-profile-setup-planning-generation",
          severity: "warn",
          handled: true,
          source: "profile-setup-page",
          screen: "profile-setup",
          route: ROUTES.profileSetup,
          metadata: {
            userId,
          },
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(ROUTES.tabs);
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "firestore",
        operation: "complete-profile-setup",
        severity: "error",
        handled: true,
        source: "profile-setup-page",
        screen: "profile-setup",
        route: ROUTES.profileSetup,
      });
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    } finally {
      setIsUploading(false);
    }
  };

  const renderUploadCard = (
    label: string,
    placeholder: string,
    selectedDoc: SelectedProfileDocument | null,
    onPick: () => void,
    onClear: () => void
  ) => (
    <View style={{ width: showUploadGrid ? "48.8%" : "100%" }}>
      <Text className={`text-sm ${styles.secondaryTextClass} mb-2`}>{label}</Text>

      <AnimatedCardPressable onPress={onPick}>
        <GlassCard borderRadius={16} noPadding>
          <View className="px-4 py-4" style={{ minHeight: isTablet ? 104 : 92 }}>
            <View className="flex-row items-center justify-between">
              <Text
                numberOfLines={selectedDoc ? 2 : 1}
                className={`flex-1 mr-3 ${selectedDoc ? styles.textClass : styles.secondaryTextClass}`}
                style={{ lineHeight: 20 }}
              >
                {selectedDoc?.name || placeholder}
              </Text>
              <MaterialIcons name={selectedDoc ? "check-circle" : "upload-file"} size={20} color="#008f4e" />
            </View>

            {!!selectedDoc && (
              <View
                className="mt-3 pt-3 border-t border-emerald-300/40 dark:border-gray-700/60"
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}
              >
                <Text numberOfLines={1} className={`flex-1 text-xs ${styles.secondaryTextClass}`}>
                  {selectedDoc.mimeType || "document"}
                </Text>
                <AnimatedIconPressable
                  onPress={(event) => {
                    event.stopPropagation();
                    onClear();
                  }}
                >
                  <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                </AnimatedIconPressable>
              </View>
            )}
          </View>
        </GlassCard>
      </AnimatedCardPressable>
    </View>
  );

  return (
    <>
      <ScreenBackground includeBottomInset={false}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: contentTopPadding, paddingBottom: contentBottomPadding }}
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
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
            <PageBackButton
              onPress={handleBack}
              label={t("setup.previous")}
              textClassName={styles.secondaryTextClass}
              containerStyle={{ marginBottom: 20 }}
            />

            <GlassCard borderRadius={28} noPadding>
              <View style={{ padding: cardPadding }}>
              <View
                style={{
                  flexDirection: isWideLayout ? "row" : "column",
                  gap: isWideLayout ? 28 : 20,
                }}
              >
                <View
                  style={{
                    width: introPanelWidth,
                    flexShrink: 0,
                  }}
                >
                  <Text className={`text-2xl font-semibold ${styles.textClass}`}>{t("setup.title")}</Text>
                  <Text className={`${styles.secondaryTextClass} mt-1`}>{t("setup.subtitle")}</Text>

                  <View className="mt-6">
                    <View className="h-2 rounded-full bg-emerald-200 dark:bg-gray-700 overflow-hidden">
                      <View className="h-full bg-emerald-500" style={{ width: `${(step / 3) * 100}%` }} />
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: isWideLayout ? "column" : isTablet ? "row" : "column",
                      flexWrap: isWideLayout ? "nowrap" : isTablet ? "wrap" : "nowrap",
                      gap: 12,
                      marginTop: 18,
                    }}
                  >
                    {stepItems.map((item) => {
                      const isActive = step === item.id;
                      const isComplete = step > item.id;

                      return (
                        <View
                          key={item.id}
                          className="rounded-2xl border px-4 py-3"
                          style={{
                            width: isWideLayout ? undefined : isTablet ? "31%" : "100%",
                            borderColor: isActive || isComplete ? "#10B981" : isDark ? "rgba(75, 85, 99, 0.95)" : "rgba(167, 243, 208, 0.9)",
                            backgroundColor: isActive
                              ? isDark
                                ? "rgba(16, 185, 129, 0.14)"
                                : "rgba(16, 185, 129, 0.1)"
                              : undefined,
                          }}
                        >
                          <View className="flex-row items-center">
                            <View
                              className="mr-3 h-7 w-7 items-center justify-center rounded-full"
                              style={{
                                backgroundColor: isActive || isComplete ? "#10B981" : isDark ? "#1F2937" : "#D1FAE5",
                              }}
                            >
                              {isComplete ? (
                                <MaterialIcons name="check" size={16} color={isDark ? "#04130b" : "#064E3B"} />
                              ) : (
                                <Text
                                  className="text-xs font-semibold"
                                  style={{ color: isDark && !isActive ? "#E5E7EB" : "#04130b" }}
                                >
                                  {item.id}
                                </Text>
                              )}
                            </View>
                            <Text className={`flex-1 ${isActive ? styles.textClass : styles.secondaryTextClass}`} numberOfLines={2}>
                              {item.label}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text className={`text-lg font-semibold ${styles.textClass}`}>{currentStepLabel}</Text>
                  <Text className={`${styles.secondaryTextClass} mt-1 mb-5`}>{`${step}/3`}</Text>

                  {step === 1 && (
                    <FormInput
                      label={t("setup.major")}
                      value={major}
                      onChangeText={setMajor}
                      placeholder={t("setup.majorPlaceholder")}
                      textClass={styles.textClass}
                      secondaryTextClass={styles.secondaryTextClass}
                      inputBgClass={styles.inputBgClass}
                      placeholderColor={styles.placeholderColor}
                      variant="glass"
                    />
                  )}

                  {step === 2 && (
                    <>
                      <FormInput
                        label={t("setup.gpa")}
                        value={gpa}
                        onChangeText={handleGpaChange}
                        placeholder={t("setup.gpaPlaceholder")}
                        keyboardType="decimal-pad"
                        textClass={styles.textClass}
                        secondaryTextClass={styles.secondaryTextClass}
                        inputBgClass={styles.inputBgClass}
                        placeholderColor={styles.placeholderColor}
                        variant="glass"
                      />
                    </>
                  )}

                  {step === 3 && (
                    <View className="gap-4">
                      {renderUploadCard(
                        t("setup.transcript"),
                        t("setup.uploadTranscript"),
                        transcriptDoc,
                        () => handlePickTranscript(),
                        () => {
                          setTranscriptDoc(null);
                          dismissDocumentReview();
                        }
                      )}

                      {isTranscriptAnalysisActive ? (
                        <Text className={`text-sm ${styles.secondaryTextClass}`}>{t("profile.documentReaderAnalyzing")}</Text>
                      ) : null}

                      {transcriptReview ? (
                        <DocumentExtractionReviewCard
                          key="setup-review-transcript"
                          title={t("profile.documentReaderReviewTitle")}
                          subtitle={t("profile.documentReaderReviewSubtitle")}
                          fileName={transcriptReview.fileName}
                          confidenceText={
                            typeof transcriptReview.confidence === "number"
                              ? t("profile.documentReaderConfidence", { confidence: transcriptReview.confidence })
                              : null
                          }
                          emptyStateText={t("profile.documentReaderNoFields")}
                          applyLabel={t("profile.documentReaderApply")}
                          dismissLabel={t("profile.documentReaderDismiss")}
                          currentValueLabel={t("profile.documentReaderCurrent")}
                          suggestedValueLabel={t("profile.documentReaderSuggested")}
                          confidenceLabel={t("profile.documentReaderConfidenceShort")}
                          cardBgClass={styles.cardBgClass}
                          textClass={styles.textClass}
                          secondaryTextClass={styles.secondaryTextClass}
                          items={transcriptReview.items.map((item) => ({
                            ...item,
                            label: t(item.labelKey),
                          }))}
                          uncertainties={transcriptReview.uncertainties}
                          onApply={() => {
                            applyDocumentReview().catch(() => {});
                          }}
                          onDismiss={() => dismissDocumentReview()}
                        />
                      ) : null}
                    </View>
                  )}

                    <View
                      style={{
                        flexDirection: stackFooterActions ? "column" : "row",
                        gap: 16,
                        paddingTop: 24,
                      }}
                    >
                      <AppButton
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          handleBack();
                        }}
                        label={step === 1 ? t("setup.exit") : t("setup.previous")}
                        variant="secondary"
                        style={{
                          flex: stackFooterActions ? undefined : 1,
                          width: stackFooterActions ? "100%" : undefined,
                        }}
                      />

                      {step < 3 ? (
                        <AppButton
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleNext();
                          }}
                          label={t("setup.next")}
                          icon={(color) => <MaterialIcons name="arrow-forward" size={18} color={color} />}
                          style={{
                            flex: stackFooterActions ? undefined : 1,
                            width: stackFooterActions ? "100%" : undefined,
                          }}
                        />
                      ) : (
                        <AppButton
                          onPress={() => {
                            if (isUploading) return;
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            handleContinue();
                          }}
                          disabled={isUploading}
                          label={isUploading ? `${t("setup.continue")}...` : t("setup.continue")}
                          icon={(color) => <MaterialIcons name="arrow-forward" size={18} color={color} />}
                          style={{
                            flex: stackFooterActions ? undefined : 1,
                            width: stackFooterActions ? "100%" : undefined,
                          }}
                        />
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </GlassCard>
          </View>
        </ScrollView>
      </ScreenBackground>

      {isConfettiPlaying && (
        <ConfettiCannon
          key="confetti"
          ref={confettiRef}
          count={150}
          origin={{ x: width / 2, y: -10 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={3000}
        />
      )}
    </>
  );
}

