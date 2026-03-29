import { useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Keyboard, Alert, Platform, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import ConfettiCannon from "react-native-confetti-cannon";
import * as DocumentPicker from "expo-document-picker";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROUTES } from "@/constants/routes";
import { FIRESTORE_COLLECTIONS } from "@/constants/schema";
import { db } from "@/services/firebase";
import { storageService } from "@/services/storage.service";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppTheme } from "@/hooks/use-app-theme";
import { FormInput } from "@/components/ui/FormInput";
import { DocumentExtractionReviewCard } from "@/components/ui/DocumentExtractionReviewCard";
import { documentReaderService, errorLoggingService, type DocumentExtractionReview } from "@/services";
import { roadmapService } from "@/services/roadmap.service";

type SelectedDocument = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export default function ProfileSetupPage() {
  const router = useRouter();
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
  const [resumeDoc, setResumeDoc] = useState<SelectedDocument | null>(null);
  const [transcriptDoc, setTranscriptDoc] = useState<SelectedDocument | null>(null);
  const [gpa, setGpa] = useState("");

  const [isConfettiPlaying, setIsConfettiPlaying] = useState(false);
  const [confettiCooldown, setConfettiCooldown] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeDocumentAnalysis, setActiveDocumentAnalysis] = useState<"resume" | "transcript" | null>(null);
  const [documentReviews, setDocumentReviews] = useState<Partial<Record<"resume" | "transcript", DocumentExtractionReview>>>({});
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
        : `${t("setup.resume")} / ${t("setup.transcript")}`;
  const stepItems = [
    { id: 1, label: t("setup.major") },
    { id: 2, label: t("setup.gpa") },
    { id: 3, label: `${t("setup.resume")} / ${t("setup.transcript")}` },
  ];

  const dismissDocumentReview = (documentType: "resume" | "transcript") => {
    setDocumentReviews((prev) => {
      const next = { ...prev };
      delete next[documentType];
      return next;
    });
  };

  const handlePickDocument = async (type: "resume" | "transcript") => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "image/png",
          "image/jpeg",
          "image/webp",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const selected: SelectedDocument = {
        uri: asset.uri,
        name: asset.name || asset.uri.split("/").pop() || `${type}_${Date.now()}`,
        mimeType: asset.mimeType,
        size: asset.size,
      };

      if (type === "resume") setResumeDoc(selected);
      else setTranscriptDoc(selected);

      setActiveDocumentAnalysis(type);
      try {
        const review = await documentReaderService.extractDocumentReview({
          documentType: type,
          fileUri: selected.uri,
          fileName: selected.name,
          mimeType: selected.mimeType,
          size: selected.size,
          currentProfile: {
            major,
            gpa,
          },
          questionnaireAnswers: state.questionnaireAnswers,
        });
        setDocumentReviews((prev) => ({ ...prev, [type]: review }));
      } catch (error) {
        Alert.alert(
          t("profile.documentReaderUnavailableTitle"),
          error instanceof Error ? error.message : t("profile.prepareDataError")
        );
      } finally {
        setActiveDocumentAnalysis(null);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      void errorLoggingService.captureException(err, {
        category: "upload",
        operation: `analyze-${type}-document`,
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
    else router.replace(ROUTES.tabs);
  };

  const handleGpaChange = (value: string) => {
    // Accept only valid decimal input and clamp user-entered GPA to a 4.0 scale.
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      const num = parseFloat(value);
      if (value === "" || (Number.isFinite(num) && num <= 4.0) || value === "0" || value === "0.") {
        setGpa(value);
        // Trigger celebration once per cooldown window when GPA hits exactly 4.0.
        if (num === 4.0 && (value === "4" || value === "4.0") && !confettiCooldown) {
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

  const applyDocumentReview = async (documentType: "resume" | "transcript") => {
    const review = documentReviews[documentType];
    if (!review) return;

    if (review.userPatch.major) setMajor(review.userPatch.major);
    if (review.userPatch.gpa) setGpa(review.userPatch.gpa);

    if (Object.keys(review.questionnairePatch).length) {
      await setQuestionnaireAnswers({
        ...state.questionnaireAnswers,
        ...review.questionnairePatch,
      });
    }

    dismissDocumentReview(documentType);
    Alert.alert(t("profile.documentReaderAppliedTitle"), t("profile.documentReaderAppliedMessage"));
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const uploadSelectedDocument = async (
    userId: string,
    selectedDoc: SelectedDocument | null,
    _folder: "resumes" | "transcripts",
    type: "resume" | "transcript"
  ): Promise<string> => {
    // Single upload helper keeps the submit path consistent for both file types.
    if (!selectedDoc?.uri) return "";
    if (type === "resume") {
      const localFile = await storageService.uploadResume(userId, selectedDoc.uri, {
        fileName: selectedDoc.name,
        mimeType: selectedDoc.mimeType,
        sizeBytes: selectedDoc.size,
      });
      return localFile.url;
    }
    const localFile = await storageService.uploadTranscript(userId, selectedDoc.uri, {
      fileName: selectedDoc.name,
      mimeType: selectedDoc.mimeType,
      sizeBytes: selectedDoc.size,
    });
    return localFile.url;
  };

  const handleContinue = async () => {
    try {
      const userId = state.user?.uid;
      if (!userId) {
        router.replace(ROUTES.login);
        return;
      }

      setIsUploading(true);

      const finalResumeUrl = await uploadSelectedDocument(userId, resumeDoc, "resumes", "resume");
      const finalTranscriptUrl = await uploadSelectedDocument(userId, transcriptDoc, "transcripts", "transcript");

      const flatData = {
        major,
        gpa: gpa || "",
        resume: finalResumeUrl,
        transcript: finalTranscriptUrl,
        isProfileComplete: true,
      };

      if (db) {
        const userDocRef = doc(db, FIRESTORE_COLLECTIONS.users, userId);
        await setDoc(
          userDocRef,
          {
            ...flatData,
            resumeFileName: resumeDoc?.name || "",
            transcriptFileName: transcriptDoc?.name || "",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      await updateUser(flatData);

      try {
        await roadmapService.ensureUserRoadmap(userId, {
          major,
          gpa,
          questionnaireAnswers: state.questionnaireAnswers,
          targetSchools: (state.savedColleges ?? []).map((college) => college.name),
          documents: {
            ...(finalResumeUrl
              ? {
                  resume: {
                    fileName: resumeDoc?.name || "",
                    fileUrl: finalResumeUrl,
                  },
                }
              : {}),
            ...(finalTranscriptUrl
              ? {
                  transcripts: {
                    fileName: transcriptDoc?.name || "",
                    fileUrl: finalTranscriptUrl,
                  },
                }
              : {}),
          },
        });
      } catch {
        void errorLoggingService.captureMessage("Roadmap generation failed, but profile saved.", {
          category: "ai",
          operation: "post-profile-setup-roadmap-generation",
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
    selectedDoc: SelectedDocument | null,
    onPick: () => void,
    onClear: () => void
  ) => (
    <View style={{ width: showUploadGrid ? "48.8%" : "100%" }}>
      <Text className={`text-sm ${styles.secondaryTextClass} mb-2`}>{label}</Text>

      <View className={`${styles.cardBgClass} border rounded-2xl px-4 py-4`} style={{ minHeight: isTablet ? 104 : 92 }}>
        <Pressable onPress={onPick} className="flex-row items-center justify-between">
          <Text
            numberOfLines={selectedDoc ? 2 : 1}
            className={`flex-1 mr-3 ${selectedDoc ? styles.textClass : styles.secondaryTextClass}`}
            style={{ lineHeight: 20 }}
          >
            {selectedDoc?.name || placeholder}
          </Text>
          <MaterialIcons name={selectedDoc ? "check-circle" : "upload-file"} size={20} color="#008f4e" />
        </Pressable>

        {!!selectedDoc && (
          <View className="mt-3 pt-3 border-t border-emerald-300/40 dark:border-gray-700/60" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text numberOfLines={1} className={`flex-1 text-xs ${styles.secondaryTextClass}`}>
              {selectedDoc.mimeType || "document"}
            </Text>
            <Pressable onPress={onClear} hitSlop={8}>
              <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
            </Pressable>
          </View>
        )}
      </View>
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
            <Pressable onPress={handleBack} className="mb-6 flex-row items-center self-start">
              <MaterialIcons name="arrow-back" size={20} color={styles.placeholderColor} />
              <Text className={`ml-2 ${styles.secondaryTextClass}`}>{t("setup.previous")}</Text>
            </Pressable>

            <View className={`${styles.cardBgClass} border`} style={{ padding: cardPadding, borderRadius: 28 }}>
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
                      />
                    </>
                  )}

                  {step === 3 && (
                    <View className="gap-4">
                      <View
                        style={{
                          flexDirection: showUploadGrid ? "row" : "column",
                          flexWrap: showUploadGrid ? "wrap" : "nowrap",
                          gap: 16,
                        }}
                      >
                        {renderUploadCard(
                          t("setup.resume"),
                          t("setup.uploadResume"),
                          resumeDoc,
                          () => handlePickDocument("resume"),
                          () => {
                            setResumeDoc(null);
                            dismissDocumentReview("resume");
                          }
                        )}

                        {renderUploadCard(
                          t("setup.transcript"),
                          t("setup.uploadTranscript"),
                          transcriptDoc,
                          () => handlePickDocument("transcript"),
                          () => {
                            setTranscriptDoc(null);
                            dismissDocumentReview("transcript");
                          }
                        )}
                      </View>

                      {activeDocumentAnalysis ? (
                        <Text className={`text-sm ${styles.secondaryTextClass}`}>{t("profile.documentReaderAnalyzing")}</Text>
                      ) : null}

                      {(["resume", "transcript"] as const).map((documentType) => {
                        const review = documentReviews[documentType];
                        if (!review) return null;
                        return (
                          <DocumentExtractionReviewCard
                            key={`setup-review-${documentType}`}
                            title={t("profile.documentReaderReviewTitle")}
                            subtitle={t("profile.documentReaderReviewSubtitle")}
                            fileName={review.fileName}
                            confidenceText={
                              typeof review.confidence === "number"
                                ? t("profile.documentReaderConfidence", { confidence: review.confidence })
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
                            items={review.items.map((item) => ({
                              ...item,
                              label: t(item.labelKey),
                            }))}
                            uncertainties={review.uncertainties}
                            onApply={() => {
                              applyDocumentReview(documentType).catch(() => {});
                            }}
                            onDismiss={() => dismissDocumentReview(documentType)}
                          />
                        );
                      })}
                    </View>
                  )}

                  <View
                    style={{
                      flexDirection: stackFooterActions ? "column" : "row",
                      gap: 16,
                      paddingTop: 24,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleBack();
                      }}
                      className={`rounded-lg py-4 items-center border ${styles.cardBgClass}`}
                      style={{ flex: stackFooterActions ? undefined : 1 }}
                    >
                      <Text className={styles.secondaryTextClass}>{step === 1 ? t("setup.exit") : t("setup.previous")}</Text>
                    </Pressable>

                    {step < 3 ? (
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          handleNext();
                        }}
                        className="bg-emerald-500 rounded-lg py-4 items-center flex-row justify-center"
                        style={{ flex: stackFooterActions ? undefined : 1 }}
                      >
                        <Text className={`${isDark ? 'text-white' : 'text-emerald-900'} font-semibold mr-2`}>{t("setup.next")}</Text>
                        <MaterialIcons name="arrow-forward" size={18} color={isDark ? "#FFFFFF" : "#000"} />
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => {
                          if (isUploading) return;
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          handleContinue();
                        }}
                        className="bg-emerald-500 rounded-lg py-4 items-center flex-row justify-center"
                        style={{ flex: stackFooterActions ? undefined : 1 }}
                      >
                        <Text className={`${isDark ? 'text-white' : 'text-emerald-900'} font-semibold mr-2`}>{isUploading ? `${t("setup.continue")}...` : t("setup.continue")}</Text>
                        <MaterialIcons name="arrow-forward" size={18} color={isDark ? "#FFFFFF" : "#000"} />
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            </View>
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

