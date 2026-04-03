import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Keyboard,
  Alert,
  Platform,
  Image,
  KeyboardAvoidingView,
  useWindowDimensions,
  type DimensionValue,
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
import { normalizeQuestionnaireAnswers, QUESTIONNAIRE_RADIO_OPTIONS } from "@/services/app/questionnaire.enums";
import { useAppData } from "@/hooks/use-app-data";
import { ProfileField } from "@/components/ui/ProfileField";
import { DocumentExtractionReviewCard } from "@/components/ui/DocumentExtractionReviewCard";
import { StateCard } from "@/components/ui/StateCard";
import { StatusBanner } from "@/components/ui/StatusBanner";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { ROUTES } from "@/constants/routes";
import { collegeService } from "@/services/colleges/college.service";
import { APP_VERSION } from "@/constants/app-version";
import {
  QUESTIONNAIRE_FIELD_IDS,
  STORAGE_KEYS,
  type QuestionnaireFieldId,
} from "@/constants/schema";
import { documentReaderService, errorLoggingService, type DocumentExtractionReview } from "@/services";

type RadioOption = { key: string; label: string };
type Question =
  | { id: QuestionnaireFieldId; question: string; type: "text" | "textarea"; placeholder: string }
  | { id: QuestionnaireFieldId; question: string; type: "radio"; options: RadioOption[] };
type UploadedDocumentMeta = {
  name: string;
  url: string;
};

function looksLikeEncodedFileName(value: string | undefined | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return true;
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return true;
  if (raw.includes("base64,")) return true;
  return /^[A-Za-z0-9+/=]{120,}$/.test(raw.replace(/\s+/g, ""));
}

function getReadableDocumentFileName({
  name,
  url,
  fallbackName,
}: {
  name?: string | null;
  url?: string | null;
  fallbackName: string;
}) {
  const rawName = String(name ?? "").trim();
  if (rawName && rawName.length <= 180 && !looksLikeEncodedFileName(rawName)) {
    return rawName;
  }

  const rawUrl = String(url ?? "").trim();
  if (!rawUrl) return "";
  if (rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) {
    return fallbackName;
  }

  const withoutQuery = rawUrl.split(/[?#]/)[0] ?? "";
  const lastSegment = withoutQuery.split("/").pop() ?? "";
  try {
    const decoded = decodeURIComponent(lastSegment).trim();
    if (decoded && decoded.length <= 180 && !looksLikeEncodedFileName(decoded)) {
      return decoded;
    }
  } catch {
    const trimmed = lastSegment.trim();
    if (trimmed && trimmed.length <= 180 && !looksLikeEncodedFileName(trimmed)) {
      return trimmed;
    }
  }

  return fallbackName;
}

export default function ProfilePage() {
  const router = useRouter();
  const { theme, setTheme, isDark, isGreen, isLight } = useAppTheme();
  const { t, language } = useAppLanguage();
  const { isHydrated, state, updateUser, setQuestionnaireAnswers, restoreData } = useAppData();
  const { getScrollContentPadding, tabBarContentClearance } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();

  // Initialize audio player for celebration sound
  const cheerPlayer = useAudioPlayer('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3');

  const user = state.user;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: "",
    state: "",
    major: "",
    gender: "",
    gpa: "",
    resume: "",
    transcript: "",
    residencyType: "",
    englishProficiency: "",
    englishTestType: "",
    englishTestValue: "",
  });

  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [questionnaireAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [isConfettiPlaying, setIsConfettiPlaying] = useState(false);
  const [confettiCooldown, setConfettiCooldown] = useState(false);
  const [showGuestProfile, setShowGuestProfile] = useState(false);
  const [uploadedDocumentMeta, setUploadedDocumentMeta] = useState<
    Partial<Record<"resume" | "transcript", UploadedDocumentMeta>>
  >({});
  const [activeDocumentAnalysis, setActiveDocumentAnalysis] = useState<"resume" | "transcript" | null>(null);
  const [documentReviews, setDocumentReviews] = useState<Partial<Record<"resume" | "transcript", DocumentExtractionReview>>>({});

  useEffect(() => {
    if (!user?.isGuest) return;
    AsyncStorage.getItem(STORAGE_KEYS.guestProfileShow).then((value) => {
      if (value === "true") setShowGuestProfile(true);
    });
  }, [user?.isGuest]);

  useEffect(() => {
    let cancelled = false;

    if (!user?.uid) {
      setUploadedDocumentMeta({});
      return;
    }

    void (async () => {
      try {
        const { storageService } = await import("@/services/storage/storage.service");
        const [resumeDocument, transcriptDocument] = await Promise.all([
          storageService.getResume(user.uid),
          storageService.getTranscript(user.uid),
        ]);

        if (cancelled) return;

        setUploadedDocumentMeta({
          ...(resumeDocument
            ? { resume: { name: resumeDocument.name, url: resumeDocument.url } }
            : {}),
          ...(transcriptDocument
            ? { transcript: { name: transcriptDocument.name, url: transcriptDocument.url } }
            : {}),
        });
      } catch {
        if (!cancelled) {
          setUploadedDocumentMeta({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.resume, user?.transcript]);
  const handleExportData = async () => {
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
      if (!canShare) {
        Alert.alert(t("settings.exportReady"), t("settings.exportNotAvailable"));
        return;
      }

      await Sharing.shareAsync(fileUri);
    } catch {
      Alert.alert(t("settings.exportFailed"), t("settings.exportError"));
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
        data?: typeof state;
        theme?: string;
      };

      if (!parsed?.data) {
        Alert.alert(t("settings.invalidFile"), t("settings.invalidFileMessage"));
        return;
      }

      const dataToRestore = parsed.data as typeof state;

      Alert.alert(
        t("settings.importConfirm"),
        t("settings.importOverwriteMessage"),
        [
          { text: t("general.cancel"), style: "cancel" },
          {
            text: t("settings.import"),
            style: "destructive",
            onPress: async () => {
              await restoreData(dataToRestore);
              if (parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "green" || parsed.theme === "system") {
                setTheme(parsed.theme);
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert(t("settings.importFailed"), t("settings.importError"));
    }
  };
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
      await AsyncStorage.setItem(STORAGE_KEYS.pendingAccountData, JSON.stringify(pendingData));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push(ROUTES.login);
    } catch {
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    }
  };
  const confettiRef = useRef<any>(null);

  const questions = useMemo<Question[]>(
    () => [
      // Keep profile questionnaire concise here; full questionnaire lives on its own page.
      { id: QUESTIONNAIRE_FIELD_IDS.costOfAttendance, question: t("questionnaire.costOfAttendance"), options: QUESTIONNAIRE_RADIO_OPTIONS.costOfAttendance.map((o) => ({ key: o.key, label: t(o.labelKey) })), type: "radio" },
      { id: QUESTIONNAIRE_FIELD_IDS.classSize, question: t("questionnaire.classSize"), options: QUESTIONNAIRE_RADIO_OPTIONS.classSize.map((o) => ({ key: o.key, label: t(o.labelKey) })), type: "radio" },
      { id: QUESTIONNAIRE_FIELD_IDS.transportation, question: t("questionnaire.transportation"), options: QUESTIONNAIRE_RADIO_OPTIONS.transportation.map((o) => ({ key: o.key, label: t(o.labelKey) })), type: "radio" },
      { id: QUESTIONNAIRE_FIELD_IDS.companiesNearby, question: t("questionnaire.companiesNearby"), placeholder: t("questionnaire.companiesNearbyPlaceholder"), type: "textarea" },
      { id: QUESTIONNAIRE_FIELD_IDS.inStateOutOfState, question: t("questionnaire.inStateOutOfState"), options: QUESTIONNAIRE_RADIO_OPTIONS.inStateOutOfState.map((o) => ({ key: o.key, label: t(o.labelKey) })), type: "radio" },
      { id: QUESTIONNAIRE_FIELD_IDS.housing, question: t("questionnaire.housingPreference"), options: QUESTIONNAIRE_RADIO_OPTIONS.housing.map((o) => ({ key: o.key, label: t(o.labelKey) })), type: "radio" },
      { id: QUESTIONNAIRE_FIELD_IDS.ranking, question: t("questionnaire.ranking"), options: QUESTIONNAIRE_RADIO_OPTIONS.ranking.map((o) => ({ key: o.key, label: t(o.labelKey) })), type: "radio" },
      { id: QUESTIONNAIRE_FIELD_IDS.continueEducation, question: t("questionnaire.continueEducation"), options: QUESTIONNAIRE_RADIO_OPTIONS.continueEducation.map((o) => ({ key: o.key, label: t(o.labelKey) })), type: "radio" },
      { id: QUESTIONNAIRE_FIELD_IDS.extracurriculars, question: t("questionnaire.extracurriculars"), placeholder: t("questionnaire.extracurricularsPlaceholder"), type: "textarea" },
    ],
    [t]
  );

  const blankAnswers = useMemo(() => {
    // Seed all question ids so controlled inputs always have stable values.
    const init: Record<string, string> = {};
    for (const q of questions) init[q.id] = "";
    return init;
  }, [questions]);

  useEffect(() => {
    if (!isHydrated) return;
    setEditData({
      name: user?.name ?? "",
      state: user?.state ?? "",
      major: user?.major ?? "",
      gender: user?.gender ?? "",
      gpa: user?.gpa ?? "",
      resume: user?.resume ?? "",
      transcript: user?.transcript ?? "",
      residencyType: user?.residencyType ?? "",
      englishProficiency: user?.englishProficiency ?? "",
      englishTestType: user?.englishTestType ?? "",
      englishTestValue: user?.englishTestValue ?? "",
    });
    setLocalAnswers({ ...blankAnswers, ...normalizeQuestionnaireAnswers(state.questionnaireAnswers ?? {}, language) });
  }, [isHydrated, user?.name, user?.state, user?.major, user?.gender, user?.gpa, user?.resume, user?.transcript, user?.residencyType, user?.englishProficiency, user?.englishTestType, user?.englishTestValue, blankAnswers, state.questionnaireAnswers, language]);

  const textClass = isDark ? "text-white" : isGreen ? "text-white" : isLight ? "text-emerald-900" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : isLight ? "text-emerald-700" : "text-gray-600";
  const cardBgClass = isDark
    ? "bg-gray-900/80 border-gray-800"
    : isGreen
      ? "bg-emerald-900/90 border-emerald-800"
      : isLight
        ? "bg-white border-emerald-200"
        : "bg-white/90 border-gray-200";
  const inputBgClass = isDark
    ? "bg-gray-800 border-gray-700"
    : isGreen
      ? "bg-emerald-900/70 border-emerald-700"
      : isLight
        ? "bg-white border-emerald-300"
        : "bg-gray-50 border-gray-300";
  const inputClass = `w-full ${inputBgClass} ${textClass} border rounded-lg px-3 py-2`;
  const borderClass = isDark ? "border-gray-800" : isGreen ? "border-emerald-700" : isLight ? "border-emerald-300" : "border-gray-200";
  const placeholderColor = isDark ? "#9CA3AF" : isGreen ? "#b6e2b6" : isLight ? "#1f8a5d" : "#6B7280";
  const guestCtaCardClass = isLight ? "bg-emerald-100 border border-emerald-200" : isDark ? "bg-emerald-500 border" : "bg-emerald-500";
  const guestCtaCardStyle = isDark ? { backgroundColor: "#00572b", borderColor: "#00753e" } : undefined;
  const guestCtaTextClass = isLight ? "text-emerald-900" : "text-white";
  const guestCtaBodyClass = isLight ? "text-emerald-800" : "text-emerald-100";
  const guestCtaIconColor = isLight ? "#1f8a5d" : isDark ? "#8cd19e" : "#FFFFFF";
  const isWideLayout = viewportWidth >= 820;
  const isDesktopLayout = viewportWidth >= 1200;
  const useDesktopFitLayout = Platform.OS === "web" && isDesktopLayout;
  const pageMaxWidth = isDesktopLayout ? 1280 : 1040;
  const earlyStateMaxWidth = Math.min(pageMaxWidth, isDesktopLayout ? 760 : isWideLayout ? 680 : 448);
  const sidebarWidth = isDesktopLayout ? 360 : 300;
  const avatarSize = isDesktopLayout ? 88 : isWideLayout ? 76 : 56;
  const avatarFallbackSize = isDesktopLayout ? 38 : isWideLayout ? 32 : 26;
  const avatarBadgeSize = isDesktopLayout ? 34 : isWideLayout ? 30 : 24;
  const avatarBadgeIconSize = isDesktopLayout ? 18 : 16;
  const avatarBadgeBorderColor = isDark ? "#111827" : isGreen ? "#065f46" : "#FFFFFF";
  const questionnaireScrollMaxHeight = isWideLayout
    ? Math.max(320, Math.min(viewportHeight * (isDesktopLayout ? 0.58 : 0.52), 640))
    : undefined;
  const desktopViewportHeight = useDesktopFitLayout
    ? Math.max(660, viewportHeight - insets.top - tabBarContentClearance - 20)
    : undefined;
  const desktopPanelGap = 16;
  const desktopSidebarWidth = Math.min(392, Math.max(344, sidebarWidth));
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 16,
  });
  const stackQuestionnaireActions = isWideLayout && !isDesktopLayout;

  const hasQuestionnaireData = useMemo(
    () => Object.keys(state.questionnaireAnswers ?? {}).length > 0,
    [state.questionnaireAnswers]
  );

  // (removed unused hasExportableData helper to satisfy linter)

  const capitalizeWords = (text: string | undefined) => {
    if (!text) return "";
    return text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  };

  const fileDisplayName = (documentType: "resume" | "transcript", path: string | undefined) =>
    getReadableDocumentFileName({
      name:
        uploadedDocumentMeta[documentType]?.url === String(path ?? "")
          ? uploadedDocumentMeta[documentType]?.name
          : null,
      url: path,
      fallbackName: documentType === "transcript" ? "unofficial-transcript.pdf" : "uploaded-file",
    });
  const questionnaireAnsweredCount = useMemo(
    () =>
      questions.reduce((count, question) => {
        const value = questionnaireAnswers[question.id];
        return typeof value === "string" && value.trim() ? count + 1 : count;
      }, 0),
    [questions, questionnaireAnswers]
  );
  const questionnaireCompletionLabel = `${questionnaireAnsweredCount}/${questions.length}`;
  const uploadedDocumentCount = [editData.resume, editData.transcript].filter((value) => value.trim().length > 0).length;
  const documentCompletionLabel = `${uploadedDocumentCount}/2`;
  const currentMajor = capitalizeWords(editData.major || user?.major || "") || t("profile.undecided");
  const currentGpa = editData.gpa || user?.gpa || t("general.notSpecified");
  const hasDocumentReviewCards = (["resume", "transcript"] as const).some((documentType) => !!documentReviews[documentType]);
  const shouldPrioritizeGuestProfileSpace =
    useDesktopFitLayout && !!user?.isGuest && !activeDocumentAnalysis && !hasDocumentReviewCards;
  const desktopProfileCardFlex = shouldPrioritizeGuestProfileSpace ? 1.28 : 1.1;
  const desktopDocumentsCardFlex = shouldPrioritizeGuestProfileSpace ? 0.78 : 0.95;
  const residencyLabels: Record<string, string> = {
    inState: t("profile.residencyInState"),
    outOfState: t("profile.residencyOutOfState"),
    international: t("profile.residencyInternational"),
  };
  const genderLabels: Record<string, string> = {
    woman: t("profile.genderWoman"),
    man: t("profile.genderMan"),
    nonbinary: t("profile.genderNonbinary"),
    preferNotToSay: t("profile.genderPreferNotToSay"),
  };
  const currentGender = editData.gender
    ? genderLabels[editData.gender] ?? editData.gender
    : user?.gender
      ? genderLabels[user.gender] ?? user.gender
      : t("general.notSpecified");
  const currentResidency = editData.residencyType
    ? residencyLabels[editData.residencyType] ?? editData.residencyType
    : user?.residencyType
      ? residencyLabels[user.residencyType] ?? user.residencyType
      : t("general.notSpecified");
  const profileSummaryCards = [
    { key: "major", icon: "school" as const, label: t("profile.major"), value: currentMajor },
    { key: "gpa", icon: "description" as const, label: t("profile.gpa"), value: currentGpa },
    { key: "gender", icon: "wc" as const, label: t("profile.gender"), value: currentGender },
    { key: "residency", icon: "home" as const, label: t("profile.residencyType"), value: currentResidency },
    { key: "questionnaire", icon: "assignment" as const, label: t("profile.questionnaire"), value: questionnaireCompletionLabel },
  ];

  const handleSave = async () => {
    if (!user) return;
    try {
      await updateUser({
        name: editData.name,
        state: editData.state,
        major: editData.major,
        gender: editData.gender,
        gpa: editData.gpa,
        resume: editData.resume,
        transcript: editData.transcript,
        residencyType: editData.residencyType,
        englishProficiency: editData.englishProficiency,
        englishTestType: editData.englishProficiency === "native" ? "" : editData.englishTestType,
        englishTestValue: editData.englishProficiency === "native" ? "" : editData.englishTestValue,
      });
      setIsEditing(false);
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "firestore",
        operation: "save-profile-edit",
        severity: "error",
        handled: true,
        source: "profile-page",
        screen: "profile",
        route: ROUTES.profile,
      });
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    }
  };

  const handleGpaChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      const num = parseFloat(value);
      if (value === "" || value === "0" || value === "0." || (Number.isFinite(num) && num <= 4.0)) {
        setEditData((p) => ({ ...p, gpa: value }));
        // Celebrate perfect GPA! 🎉
        if (num === 4.0 && value === "4" && !confettiCooldown) {
          setIsConfettiPlaying(true);
          setConfettiCooldown(true);
          setTimeout(() => setIsConfettiPlaying(false), 6000);
          setTimeout(() => setConfettiCooldown(false), 1000);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Play cheer sound
          cheerPlayer.play();
        } else if (value !== "4" && isConfettiPlaying) {
          setIsConfettiPlaying(false);
        }
      }
    }
  };

  const analyzeUploadedDocument = async (
    documentType: "resume" | "transcript",
    asset: { uri: string; name?: string | null; mimeType?: string | null; size?: number | null }
  ) => {
    setActiveDocumentAnalysis(documentType);
    try {
      const review = await documentReaderService.extractDocumentReview({
        documentType,
        fileUri: asset.uri,
        fileName: asset.name || asset.uri.split("/").pop() || `${documentType}.pdf`,
        mimeType: asset.mimeType,
        size: asset.size,
        currentProfile: {
          major: editData.major || user?.major || "",
          gpa: editData.gpa || user?.gpa || "",
        },
        questionnaireAnswers: {
          ...state.questionnaireAnswers,
          ...questionnaireAnswers,
        },
      });
      setDocumentReviews((prev) => ({ ...prev, [documentType]: review }));
    } catch (error) {
      Alert.alert(
        t("profile.documentReaderUnavailableTitle"),
        error instanceof Error ? error.message : t("profile.prepareDataError")
      );
    } finally {
      setActiveDocumentAnalysis(null);
    }
  };

  const dismissDocumentReview = (documentType: "resume" | "transcript") => {
    setDocumentReviews((prev) => {
      const next = { ...prev };
      delete next[documentType];
      return next;
    });
  };

  const applyDocumentReview = async (documentType: "resume" | "transcript") => {
    const review = documentReviews[documentType];
    if (!review || !user?.uid) return;

    try {
      if (Object.keys(review.userPatch).length) {
        setEditData((prev) => ({ ...prev, ...review.userPatch }));
        await updateUser(review.userPatch);
      }

      if (Object.keys(review.questionnairePatch).length) {
        const nextQuestionnaire = normalizeQuestionnaireAnswers(
          {
            ...state.questionnaireAnswers,
            ...questionnaireAnswers,
            ...review.questionnairePatch,
          },
          language
        ) as Record<string, string>;
        await setQuestionnaireAnswers(nextQuestionnaire);
        setLocalAnswers((prev) => ({
          ...prev,
          ...(review.questionnairePatch as Record<string, string>),
        }));
        try {
          await collegeService.saveQuestionnaireResult(nextQuestionnaire);
        } catch (error) {
          void errorLoggingService.captureException(error, {
            category: "firestore",
            operation: "apply-document-review-questionnaire-sync",
            severity: "warn",
            handled: true,
            source: "profile-page",
            screen: "profile",
            route: ROUTES.profile,
          });
        }
      }

      dismissDocumentReview(documentType);
      Alert.alert(t("profile.documentReaderAppliedTitle"), t("profile.documentReaderAppliedMessage"));
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "upload",
        operation: "apply-document-review",
        severity: "error",
        handled: true,
        source: "profile-page",
        screen: "profile",
        route: ROUTES.profile,
      });
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    }
  };

  const handlePickResume = async () => {
    if (!user?.uid || !isHydrated) return;
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
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const { storageService } = await import("@/services/storage/storage.service");
      const uploaded = await storageService.uploadResume(user.uid, asset.uri, {
        fileName: asset.name,
        mimeType: asset.mimeType,
        sizeBytes: asset.size,
      });
      await updateUser({ resume: uploaded.url });
      setEditData((p) => ({ ...p, resume: uploaded.url }));
      setUploadedDocumentMeta((current) => ({
        ...current,
        resume: { name: uploaded.name, url: uploaded.url },
      }));
      await analyzeUploadedDocument("resume", asset);
    } catch (err) {
      void errorLoggingService.captureException(err, {
        category: "upload",
        operation: "pick-resume",
        severity: "error",
        handled: true,
        source: "profile-page",
        screen: "profile",
        route: ROUTES.profile,
      });
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    }
  };

  const handlePickTranscript = async () => {
    if (!user?.uid || !isHydrated) return;
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
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const { storageService } = await import("@/services/storage/storage.service");
      const uploaded = await storageService.uploadTranscript(user.uid, asset.uri, {
        fileName: asset.name,
        mimeType: asset.mimeType,
        sizeBytes: asset.size,
      });
      await updateUser({ transcript: uploaded.url });
      setEditData((p) => ({ ...p, transcript: uploaded.url }));
      setUploadedDocumentMeta((current) => ({
        ...current,
        transcript: { name: uploaded.name, url: uploaded.url },
      }));
      await analyzeUploadedDocument("transcript", asset);
    } catch (err) {
      void errorLoggingService.captureException(err, {
        category: "upload",
        operation: "pick-transcript",
        severity: "error",
        handled: true,
        source: "profile-page",
        screen: "profile",
        route: ROUTES.profile,
      });
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
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

  const handleQuestionnaireAnswer = (id: string, value: string) => {
    setLocalAnswers((p) => ({ ...p, [id]: value }));
  };

  // Migration: normalize existing collegeSetting stored value to canonical keys
  const _collegeSettingMigrated = useRef(false);
  useEffect(() => {
    if (!isHydrated || _collegeSettingMigrated.current) return;
    const optionKeys = ["urban", "suburban", "rural", "noPreference"];
    const raw =
      questionnaireAnswers[QUESTIONNAIRE_FIELD_IDS.collegeSetting] ??
      state.questionnaireAnswers?.[QUESTIONNAIRE_FIELD_IDS.collegeSetting] ??
      '';
    const normalize = (val: unknown): string | undefined => {
      if (typeof val !== 'string') return undefined;
      if (val.startsWith('questionnaire.')) return val.replace(/^questionnaire\./, '');
      if (optionKeys.includes(val)) return val;
      for (const k of optionKeys) {
        try {
          if (t((`questionnaire.${k}`) as any) === val) return k;
        } catch {
          // ignore
        }
      }
      return undefined;
    };

    const normalized = normalize(raw);
    if (normalized && raw !== normalized) {
      // update local answers to canonical key (do not immediately persist to server)
      handleQuestionnaireAnswer(QUESTIONNAIRE_FIELD_IDS.collegeSetting, normalized);
    }
    _collegeSettingMigrated.current = true;
  }, [
    isHydrated,
    questionnaireAnswers,
    state.questionnaireAnswers,
    state.questionnaireAnswers?.[QUESTIONNAIRE_FIELD_IDS.collegeSetting],
    t,
  ]);

  const _environmentMigrated = useRef(false);
  useEffect(() => {
    if (!isHydrated || _environmentMigrated.current) return;
    const optionKeys = ["researchFocused","liberalArts","technical","preProfessional","mixed","noPreference"];
    const raw =
      questionnaireAnswers[QUESTIONNAIRE_FIELD_IDS.environment] ??
      state.questionnaireAnswers?.[QUESTIONNAIRE_FIELD_IDS.environment] ??
      '';
    const normalize = (val: unknown): string | undefined => {
      if (typeof val !== 'string') return undefined;
      if (val.startsWith('questionnaire.')) return val.replace(/^questionnaire\./, '');
      if (optionKeys.includes(val)) return val;
      for (const k of optionKeys) {
        try {
          if (t((`questionnaire.${k}`) as any) === val) return k;
        } catch {
          // ignore
        }
      }
      return undefined;
    };

    const normalized = normalize(raw);
    if (normalized && raw !== normalized) {
      handleQuestionnaireAnswer(QUESTIONNAIRE_FIELD_IDS.environment, normalized);
    }
    _environmentMigrated.current = true;
  }, [
    isHydrated,
    questionnaireAnswers,
    state.questionnaireAnswers,
    state.questionnaireAnswers?.[QUESTIONNAIRE_FIELD_IDS.environment],
    t,
  ]);

  const handleSaveQuestionnaire = async () => {
    // Normalize localized answers into canonical keys before persisting.
    const toSave = normalizeQuestionnaireAnswers({ ...questionnaireAnswers }, language) as Record<string, string>;
    // Major is captured on the user profile; do not store major in questionnaire
    delete toSave.major;
    delete toSave.majorChoice;
    await setQuestionnaireAnswers(toSave);
    try {
      await collegeService.saveQuestionnaireResult(toSave);
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "firestore",
        operation: "save-profile-questionnaire",
        severity: "warn",
        handled: true,
        source: "profile-page",
        screen: "profile",
        route: ROUTES.profile,
      });
    }
    setShowQuestionnaire(false);
  };

  const renderProfileHero = () => (
    <View className="bg-emerald-500/5 px-6 py-5 border-b border-emerald-500/20">
      <View className="flex-row items-center">
        <View className="relative mr-4 pb-1 pr-1">
          <Pressable
            onPress={isEditing ? handlePickAvatar : undefined}
            disabled={!isEditing}
            className="rounded-full overflow-hidden border border-emerald-500/20 bg-emerald-500/10"
            style={{ width: avatarSize, height: avatarSize }}
          >
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="w-full h-full bg-emerald-500 items-center justify-center">
                {user?.isGuest ? (
                  <MaterialIcons name="person" size={avatarFallbackSize} color="#001f0f" />
                ) : (
                  <Text className={`${isDark ? "text-white" : "text-emerald-900"} ${isWideLayout ? "text-2xl" : "text-lg"} font-bold`}>
                    {(user?.name?.[0] ?? "").toUpperCase()}
                  </Text>
                )}
              </View>
            )}
          </Pressable>

          {isEditing ? (
            <Pressable
              onPress={handlePickAvatar}
              className="absolute bottom-0 right-0 rounded-full bg-emerald-500 items-center justify-center"
              style={{
                width: avatarBadgeSize,
                height: avatarBadgeSize,
                borderWidth: 2,
                borderColor: avatarBadgeBorderColor,
              }}
              hitSlop={8}
            >
              <MaterialIcons name="edit" size={avatarBadgeIconSize} color="#001f0f" />
            </Pressable>
          ) : null}
        </View>

        <View className="flex-1 min-w-0">
          <Text className={`${textClass} ${isWideLayout ? "text-xl" : "text-lg"} font-semibold`} numberOfLines={2}>
            {capitalizeWords(user?.name ?? "") || t("general.notSpecified")}
          </Text>

          {user?.isGuest ? (
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              <View className="bg-emerald-500/20 rounded-full px-3 py-1 self-start">
                <Text className="text-emerald-500 text-xs font-semibold">{t("profile.guestMode")}</Text>
              </View>
              <Text className={`${secondaryTextClass} text-xs`}>{t("profile.yourDataSaved")}</Text>
            </View>
          ) : (
            <Text className={`${secondaryTextClass} text-sm mt-1`} numberOfLines={1}>
              {user?.email ?? t("profile.yourDataSaved")}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  const renderProfileFields = () => (
    <>
      {!user?.isGuest ? (
        <ProfileField
          noDivider
          noTopSpacing
          type="text"
          icon="person"
          label={t("profile.name")}
          value={capitalizeWords(user?.name ?? "")}
          isEditing={isEditing}
          editValue={editData.name}
          onChangeText={(value) => setEditData((prev) => ({ ...prev, name: value }))}
          placeholder={t("profile.enterYourName")}
          placeholderColor={placeholderColor}
          inputBgClass={inputBgClass}
          inputClass={inputClass}
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
        />
      ) : null}

      {user?.isGuest ? (
        <Pressable
          onPress={handleCreateAccount}
          className={`${guestCtaCardClass} rounded-xl p-5 flex-row items-center justify-between mb-4`}
          style={guestCtaCardStyle}
        >
          <View className="flex-1 pr-3">
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="stars" size={20} color={guestCtaIconColor} />
              <Text className={`${guestCtaTextClass} font-bold text-base ml-2`}>{t("profile.createAccount")}</Text>
            </View>
            <Text className={`${guestCtaBodyClass} text-sm`}>{t("profile.saveDataMessage")}</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={24} color={guestCtaIconColor} />
        </Pressable>
      ) : (
        <ProfileField
          type="display"
          icon="mail"
          label={t("profile.email")}
          value={user?.email ?? ""}
          isEditing={false}
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
        />
      )}

      <ProfileField
        type="text"
        icon="school"
        label={t("profile.major")}
        value={capitalizeWords(user?.major ?? "") || t("profile.undecided")}
        isEditing={isEditing}
        editValue={editData.major}
        onChangeText={(value) => setEditData((prev) => ({ ...prev, major: value }))}
        placeholder={t("profile.majorPlaceholder")}
        placeholderColor={placeholderColor}
        inputBgClass={inputBgClass}
        inputClass={inputClass}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />

      <ProfileField
        type="text"
        icon="place"
        label={t("profile.state")}
        value={String(user?.state ?? "").toUpperCase()}
        isEditing={isEditing}
        editValue={editData.state}
        onChangeText={(value) =>
          setEditData((prev) => ({
            ...prev,
            state: value.toUpperCase().replace(/[^A-Z\s]/g, "").slice(0, 20),
          }))
        }
        placeholder={t("profile.statePlaceholder")}
        placeholderColor={placeholderColor}
        inputBgClass={inputBgClass}
        inputClass={inputClass}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />

      <ProfileField
        type="radio"
        icon="wc"
        label={t("profile.gender")}
        value={user?.gender}
        isEditing={isEditing}
        editValue={editData.gender}
        options={[
          { key: "woman", labelKey: "profile.genderWoman" },
          { key: "man", labelKey: "profile.genderMan" },
          { key: "nonbinary", labelKey: "profile.genderNonbinary" },
          { key: "preferNotToSay", labelKey: "profile.genderPreferNotToSay" },
        ]}
        onSelect={(key) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setEditData((prev) => ({ ...prev, gender: key }));
        }}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />

      <ProfileField
        type="radio"
        icon="home"
        label={t("profile.residencyType")}
        value={user?.residencyType}
        isEditing={isEditing}
        editValue={editData.residencyType}
        options={[
          { key: "inState", labelKey: "profile.residencyInState" },
          { key: "outOfState", labelKey: "profile.residencyOutOfState" },
          { key: "international", labelKey: "profile.residencyInternational" },
        ]}
        onSelect={(key) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setEditData((prev) => ({ ...prev, residencyType: key }));
        }}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />

      <View className={`border-t ${borderClass} pt-4 mt-4`}>
        <View className="flex-row items-start">
          <MaterialIcons name="translate" size={20} color="#008f4e" />
          <View className="flex-1 ml-3">
            <Text className={`text-sm ${secondaryTextClass} mb-1`}>{t("profile.englishProficiency")}</Text>
            {!isEditing ? (
              <Text className={textClass}>
                {user?.englishProficiency
                  ? user.englishProficiency === "native"
                    ? t("profile.englishNative")
                    : (() => {
                        const levelLabels: Record<string, string> = {
                          advanced: t("profile.englishAdvanced"),
                          intermediate: t("profile.englishIntermediate"),
                          beginner: t("profile.englishBeginner"),
                        };
                        const level = levelLabels[user.englishProficiency] ?? user.englishProficiency;
                        if (user?.englishTestType && user?.englishTestValue) {
                          const testLabels: Record<string, string> = {
                            ielts: t("profile.englishTestIELTS"),
                            toefl: t("profile.englishTestTOEFL"),
                            duolingo: t("profile.englishTestDuolingo"),
                          };
                          const suffix =
                            user.englishTestType === "self"
                              ? user.englishTestValue
                              : `${testLabels[user.englishTestType] ?? user.englishTestType} ${user.englishTestValue}`;
                          return `${level} - ${suffix}`;
                        }
                        return level;
                      })()
                  : t("general.notSpecified")}
              </Text>
            ) : (
              <>
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {[
                    { key: "native", labelKey: "profile.englishNative" },
                    { key: "advanced", labelKey: "profile.englishAdvanced" },
                    { key: "intermediate", labelKey: "profile.englishIntermediate" },
                    { key: "beginner", labelKey: "profile.englishBeginner" },
                  ].map((option) => {
                    const isSelected = editData.englishProficiency === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setEditData((prev) => ({
                            ...prev,
                            englishProficiency: option.key,
                            ...(option.key === "native" ? { englishTestType: "", englishTestValue: "" } : {}),
                          }));
                        }}
                        className={`px-4 py-2 rounded-lg border ${
                          isSelected ? "bg-emerald-500/10 border-emerald-500" : `border ${borderClass}`
                        }`}
                      >
                        <Text className={isSelected ? "text-emerald-500 font-semibold" : secondaryTextClass}>
                          {t(option.labelKey)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {editData.englishProficiency && editData.englishProficiency !== "native" ? (
                  <>
                    <View className="flex-row flex-wrap gap-2 mb-2">
                      {(["ielts", "toefl", "duolingo", "self"] as const).map((type) => {
                        const labelKey = `profile.englishTest${type.charAt(0).toUpperCase()}${type.slice(1)}` as
                          | "profile.englishTestIELTS"
                          | "profile.englishTestTOEFL"
                          | "profile.englishTestDuolingo"
                          | "profile.englishTestSelf";
                        const isSelected = editData.englishTestType === type;

                        return (
                          <Pressable
                            key={type}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setEditData((prev) => ({ ...prev, englishTestType: type, englishTestValue: "" }));
                            }}
                            className={`px-3 py-1.5 rounded-lg border ${
                              isSelected ? "bg-emerald-500/10 border-emerald-500" : `border ${borderClass}`
                            }`}
                          >
                            <Text className={`text-sm ${isSelected ? "text-emerald-500 font-medium" : secondaryTextClass}`}>
                              {t(labelKey)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {editData.englishTestType ? (
                      <TextInput
                        value={editData.englishTestValue}
                        onChangeText={(value) => setEditData((prev) => ({ ...prev, englishTestValue: value }))}
                        placeholder={
                          editData.englishTestType === "ielts"
                            ? t("profile.englishTestIELTSPlaceholder")
                            : editData.englishTestType === "toefl"
                              ? t("profile.englishTestTOEFLPlaceholder")
                              : editData.englishTestType === "duolingo"
                                ? t("profile.englishTestDuolingoPlaceholder")
                                : t("profile.englishTestSelfPlaceholder")
                        }
                        placeholderTextColor={placeholderColor}
                        keyboardType={editData.englishTestType === "self" ? "default" : "decimal-pad"}
                        multiline={editData.englishTestType === "self"}
                        textAlignVertical={editData.englishTestType === "self" ? "top" : "center"}
                        className={`${inputClass} ${editData.englishTestType === "self" ? "min-h-[80px]" : ""}`}
                      />
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </View>
        </View>
      </View>

      <ProfileField
        type="text"
        icon="description"
        label={t("profile.gpa")}
        value={user?.gpa ?? ""}
        isEditing={isEditing}
        editValue={editData.gpa}
        onChangeText={handleGpaChange}
        placeholder={t("profile.gpaPlaceholder")}
        placeholderColor={placeholderColor}
        inputBgClass={inputBgClass}
        inputClass={inputClass}
        keyboardType="decimal-pad"
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />
    </>
  );

  const renderDocumentFields = ({
    noDivider = false,
    noTopSpacing = false,
  }: {
    noDivider?: boolean;
    noTopSpacing?: boolean;
  } = {}) => (
    <>
      <ProfileField
        noDivider={noDivider}
        noTopSpacing={noTopSpacing}
        type="upload"
        icon="upload-file"
        label={t("profile.resume")}
        value={fileDisplayName("resume", user?.resume)}
        isEditing={isEditing}
        editValue={fileDisplayName("resume", editData.resume)}
        onPress={handlePickResume}
        uploadText={t("profile.uploadResume")}
        emptyText={t("profile.notUploaded")}
        inputBgClass={inputBgClass}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />

      <ProfileField
        type="upload"
        icon="upload-file"
        label={t("profile.transcript")}
        value={fileDisplayName("transcript", user?.transcript)}
        isEditing={isEditing}
        editValue={fileDisplayName("transcript", editData.transcript)}
        onPress={handlePickTranscript}
        uploadText={t("profile.uploadTranscript")}
        emptyText={t("profile.notUploaded")}
        inputBgClass={inputBgClass}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />

      {activeDocumentAnalysis ? (
        <StatusBanner
          variant="info"
          title={t("general.loading")}
          message={t("profile.documentReaderAnalyzing")}
          className="mt-4"
        />
      ) : null}

      {(["resume", "transcript"] as const).map((documentType) => {
        const review = documentReviews[documentType];
        if (!review) return null;

        return (
          <View key={`review-${documentType}`} className="mt-4">
            <DocumentExtractionReviewCard
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
              cardBgClass={cardBgClass}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
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
          </View>
        );
      })}
    </>
  );

  const renderDocumentsCard = ({
    className = "",
    style,
    useInternalScroll = false,
  }: {
    className?: string;
    style?: object;
    useInternalScroll?: boolean;
  } = {}) => (
    <View className={`${cardBgClass} border rounded-2xl p-6 ${className}`.trim()} style={style}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center flex-1 min-w-0">
          <MaterialIcons name="upload-file" size={20} color="#008f4e" />
          <Text className={`text-lg ${textClass} ml-3 font-semibold`} numberOfLines={1}>
            {t("general.uploadFile")}
          </Text>
        </View>

        <View className="bg-emerald-500/10 rounded-full px-3 py-1">
          <Text className="text-emerald-500 text-xs font-semibold">{documentCompletionLabel}</Text>
        </View>
      </View>

      {useInternalScroll ? (
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          className="mt-4"
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ paddingBottom: 6 }}
        >
          {renderDocumentFields({ noDivider: true, noTopSpacing: true })}
        </ScrollView>
      ) : (
        <View className="mt-4">
          {renderDocumentFields({ noDivider: true, noTopSpacing: true })}
        </View>
      )}
    </View>
  );

  const renderMetadataCards = ({
    compact = false,
  }: {
    compact?: boolean;
  } = {}) => (
    <View className="flex-row flex-wrap gap-3">
      {profileSummaryCards.map((card) => (
        <View
          key={card.key}
          className={`${cardBgClass} border rounded-2xl p-4`}
          style={{ flexBasis: "47%", flexGrow: 1, minHeight: compact ? 112 : 132 }}
        >
          <View className="w-10 h-10 rounded-full bg-emerald-500/10 items-center justify-center">
            <MaterialIcons name={card.icon} size={20} color="#008f4e" />
          </View>
          <Text className={`${secondaryTextClass} text-xs mt-3`} numberOfLines={compact ? 1 : 2}>
            {card.label}
          </Text>
          <Text className={`${textClass} text-base font-semibold mt-1`} numberOfLines={compact ? 1 : 2}>
            {card.value}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderQuestionnaireCard = ({
    className = "",
    fitToContainer = false,
  }: {
    className?: string;
    fitToContainer?: boolean;
  } = {}) => {
    const useCompactGrid = fitToContainer && useDesktopFitLayout;
    const fieldGridStyle = useCompactGrid
      ? {
          flexDirection: "row" as const,
          flexWrap: "wrap" as const,
          gap: 16,
        }
      : undefined;
    const fieldItemStyle = useCompactGrid ? { width: "48.5%" as DimensionValue } : undefined;
    const optionGroupStyle = useCompactGrid
      ? {
          flexDirection: "row" as const,
          flexWrap: "wrap" as const,
          gap: 8,
        }
      : undefined;
    const optionItemStyle = useCompactGrid ? { width: "48.5%" as DimensionValue } : undefined;
    const questionnaireFields = (
      <View className="gap-6" style={fieldGridStyle}>
        {questions.map((question) => (
          <View key={question.id} style={fieldItemStyle}>
            <Text className={`text-sm font-semibold ${textClass} mb-3`}>
              {typeof question.question === "string" && question.question.startsWith("questionnaire.")
                ? t(question.question as any)
                : question.question}
            </Text>

            {(question.type === "text" || question.type === "textarea") ? (
              <TextInput
                value={questionnaireAnswers[question.id] ?? ""}
                onChangeText={(value) => handleQuestionnaireAnswer(question.id, value)}
                placeholder={question.placeholder}
                placeholderTextColor={placeholderColor}
                multiline={question.type === "textarea"}
                textAlignVertical={question.type === "textarea" ? "top" : undefined}
                className={`${inputClass} ${question.type === "textarea" ? (useCompactGrid ? "min-h-[76px]" : "min-h-[100px]") : "min-h-[44px]"}`}
              />
            ) : null}

            {question.type === "radio" ? (
              <View className="gap-2" style={optionGroupStyle}>
                {question.id === QUESTIONNAIRE_FIELD_IDS.collegeSetting ? (
                  (() => {
                    const optionKeys = ["urban", "suburban", "rural", "noPreference"];
                    const stored = questionnaireAnswers[question.id];
                    let savedKey: string | undefined = undefined;
                    if (typeof stored === "string") {
                      if (stored.startsWith("questionnaire.")) {
                        savedKey = stored.replace(/^questionnaire\./, "");
                      } else if (optionKeys.includes(stored)) {
                        savedKey = stored;
                      } else {
                        for (const key of optionKeys) {
                          try {
                            if (t(`questionnaire.${key}` as any) === stored) {
                              savedKey = key;
                              break;
                            }
                          } catch {
                          }
                        }
                      }
                    }

                    return optionKeys.map((key) => {
                      const optionLabel = t(`questionnaire.${key}` as any);
                      const isSelected = savedKey === key;

                      return (
                        <Pressable
                          key={key}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleQuestionnaireAnswer(question.id, key);
                          }}
                          className={`px-4 py-3 rounded-lg border ${
                            isSelected ? "bg-emerald-500/10 border-emerald-500" : borderClass
                          }`}
                          style={optionItemStyle}
                        >
                          <View className="flex-row items-center justify-between">
                            <Text className={isSelected ? "text-emerald-500 font-semibold" : textClass}>{optionLabel}</Text>
                            {isSelected ? <MaterialIcons name="check-circle" size={18} color="#008f4e" /> : null}
                          </View>
                        </Pressable>
                      );
                    });
                  })()
                ) : question.id === QUESTIONNAIRE_FIELD_IDS.environment ? (
                  (() => {
                    const optionKeys = ["researchFocused", "liberalArts", "technical", "preProfessional", "mixed", "noPreference"];
                    const stored = questionnaireAnswers[question.id];
                    let savedKey: string | undefined = undefined;
                    if (typeof stored === "string") {
                      if (stored.startsWith("questionnaire.")) {
                        savedKey = stored.replace(/^questionnaire\./, "");
                      } else if (optionKeys.includes(stored)) {
                        savedKey = stored;
                      } else {
                        for (const key of optionKeys) {
                          try {
                            if (t(`questionnaire.${key}` as any) === stored) {
                              savedKey = key;
                              break;
                            }
                          } catch {
                          }
                        }
                      }
                    }

                    return optionKeys.map((key) => {
                      const optionLabel = t(`questionnaire.${key}` as any);
                      const isSelected = savedKey === key;

                      return (
                        <Pressable
                          key={key}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleQuestionnaireAnswer(question.id, key);
                          }}
                          className={`px-4 py-3 rounded-lg border ${
                            isSelected ? "bg-emerald-500/10 border-emerald-500" : borderClass
                          }`}
                          style={optionItemStyle}
                        >
                          <View className="flex-row items-center justify-between">
                            <Text className={isSelected ? "text-emerald-500 font-semibold" : textClass}>{optionLabel}</Text>
                            {isSelected ? <MaterialIcons name="check-circle" size={18} color="#008f4e" /> : null}
                          </View>
                        </Pressable>
                      );
                    });
                  })()
                ) : (
                  question.options.map((option) => {
                    const stored = questionnaireAnswers[question.id];
                    const isSelected = stored === option.key;

                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          handleQuestionnaireAnswer(question.id, option.key);
                        }}
                        className={`px-4 py-3 rounded-lg border ${
                          isSelected ? "bg-emerald-500/10 border-emerald-500" : borderClass
                        }`}
                        style={optionItemStyle}
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className={isSelected ? "text-emerald-500 font-semibold" : textClass}>{option.label}</Text>
                          {isSelected ? <MaterialIcons name="check-circle" size={18} color="#008f4e" /> : null}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}
          </View>
        ))}
      </View>
    );

    return (
      <View
        className={`${cardBgClass} border rounded-2xl p-6 ${className}`.trim()}
        style={fitToContainer ? { flex: 1, minHeight: 0 } : undefined}
      >
        <View className="flex-row items-center justify-between mb-4 gap-3">
          <View className="flex-row items-center flex-1 min-w-0">
            <MaterialIcons name="assignment" size={20} color="#008f4e" />
            <Text className={`text-lg ${textClass} ml-3`} numberOfLines={1}>
              {t("profile.questionnaire")}
            </Text>

            {isWideLayout ? (
              <View className="ml-3 bg-emerald-500/10 rounded-full px-2.5 py-1">
                <Text className="text-emerald-500 text-xs font-semibold">{questionnaireCompletionLabel}</Text>
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowQuestionnaire(!showQuestionnaire);
            }}
          >
            <Text className="text-emerald-500 text-sm">
              {hasQuestionnaireData ? t("profile.edit") : t("profile.complete")}
            </Text>
          </Pressable>
        </View>

        {!hasQuestionnaireData ? (
          <Text className={`text-sm ${secondaryTextClass}`}>{t("profile.questionnairePrompt")}</Text>
        ) : null}

        {!showQuestionnaire && fitToContainer ? (
          <View className="mt-4 flex-row flex-wrap gap-2">
            <View className="bg-emerald-500/10 rounded-full px-3 py-1.5 border border-emerald-500/20">
              <Text className="text-emerald-500 text-xs font-semibold">
                {t("profile.questionnaireSummary", { count: questionnaireCompletionLabel })}
              </Text>
            </View>
            <View className="bg-emerald-500/10 rounded-full px-3 py-1.5 border border-emerald-500/20">
              <Text className="text-emerald-500 text-xs font-semibold">
                {hasQuestionnaireData
                  ? t("profile.questionnaireExpandHintAdjust")
                  : t("profile.questionnaireExpandHintSetup")}
              </Text>
            </View>
          </View>
        ) : null}

        {showQuestionnaire ? (
          <View
            className={`mt-6 pt-6 border-t ${borderClass}`}
            style={fitToContainer ? { flex: 1, minHeight: 0 } : undefined}
          >
            {fitToContainer ? (
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                style={{ flex: 1, minHeight: 0 }}
                contentContainerStyle={{ paddingBottom: 10 }}
              >
                {questionnaireFields}
              </ScrollView>
            ) : isWideLayout && questionnaireScrollMaxHeight ? (
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: questionnaireScrollMaxHeight }}
                contentContainerStyle={{ paddingBottom: 6 }}
              >
                {questionnaireFields}
              </ScrollView>
            ) : (
              questionnaireFields
            )}

            <View className={`${stackQuestionnaireActions ? "flex-col" : "flex-row"} gap-3 mt-6 pt-6 border-t border-emerald-300`}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowQuestionnaire(false);
                }}
                className={`flex-1 rounded-lg py-3 items-center border ${borderClass}`}
              >
                <Text className={secondaryTextClass}>{t("general.close")}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleSaveQuestionnaire();
                }}
                className="flex-1 bg-emerald-500 rounded-lg py-3 items-center"
              >
                <Text className={`${isDark ? "text-white" : "text-emerald-900"} font-semibold`}>
                  {t("profile.saveAnswers")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

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

  // If not signed in yet, show a simple prompt (prevents null crashes)
  if (!user) {
    return (
      <ScreenBackground>
        <View className="flex-1 justify-center px-6">
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
        <View className="flex-1 justify-center px-6">
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

            <Pressable
              onPress={() => router.push(ROUTES.login)}
              className={`${isLight ? "bg-emerald-200" : "bg-emerald-500"} rounded-lg py-4 px-6 items-center flex-row justify-center`}
            >
              <MaterialIcons name="arrow-forward" size={20} color="#001f0f" />
              <Text className={`${isDark || isGreen ? 'text-white' : 'text-emerald-900'} font-semibold ml-2`}>{t("profile.createYourProfile")}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowGuestProfile(true);
                AsyncStorage.setItem(STORAGE_KEYS.guestProfileShow, "true").catch(() => {});
              }}
              className={`${cardBgClass} border rounded-lg py-3 px-6 items-center mt-3`}
            >
              <Text className={secondaryTextClass}>{t("profile.continueAsGuest")}</Text>
            </Pressable>
          </View>
        </View>
      </ScreenBackground>
    );
  }

  if (useDesktopFitLayout && desktopViewportHeight) {
    return (
      <>
        <ScreenBackground>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
          >
            <View
              style={{
                width: "100%",
                maxWidth: pageMaxWidth,
                height: desktopViewportHeight,
                alignSelf: "center",
                paddingHorizontal: 24,
                paddingTop: 16,
              }}
            >
              {user?.isGuest && showGuestProfile ? (
                <View className={`${cardBgClass} border-2 border-emerald-500/20 rounded-2xl p-4 mb-4`}>
                  <View className="flex-row items-center justify-between gap-4">
                    <View className="flex-row items-center flex-1 min-w-0">
                      <View className="bg-emerald-500/20 p-2 rounded-lg mr-3">
                        <MaterialIcons name="cloud-upload" size={18} color="#008f4e" />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className={`${textClass} font-semibold`}>{t("profile.guestMode")}</Text>
                        <Text className={`${secondaryTextClass} text-xs mt-1`}>{t("profile.yourDataSaved")}</Text>
                      </View>
                    </View>
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={handleImportData}
                        className={`rounded-xl px-4 py-3 flex-row items-center justify-center ${isLight ? "bg-emerald-200" : "bg-emerald-500"}`}
                      >
                        <MaterialIcons name="file-download" size={18} color={isDark || isGreen ? "#FFFFFF" : "#000"} />
                        <Text className={`${isDark || isGreen ? "text-white" : "text-emerald-900"} font-semibold ml-2`}>
                          {t("settings.import")}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={handleExportData}
                        className={`rounded-xl px-4 py-3 flex-row items-center justify-center ${cardBgClass} border-2 border-emerald-500`}
                      >
                        <MaterialIcons name="file-upload" size={18} color="#008f4e" />
                        <Text className="text-emerald-500 font-semibold ml-2">{t("settings.export")}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : null}

              <View className="pb-3 flex-row items-center justify-between">
                <View>
                  <Text className={`text-2xl ${textClass} font-semibold`}>{t("home.yourProfile")}</Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>{t("profile.yourDataSaved")}</Text>
                </View>

                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    if (isEditing) {
                      void handleSave();
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  className="bg-emerald-500 p-3 rounded-full"
                >
                  <MaterialIcons name={isEditing ? "save" : "edit"} size={18} color="#001f0f" />
                </Pressable>
              </View>

              <View style={{ flex: 1, minHeight: 0, flexDirection: "row", gap: desktopPanelGap }}>
                <View style={{ flex: 1, minWidth: 0, gap: desktopPanelGap }}>
                  <View
                    className={`${cardBgClass} border rounded-2xl overflow-hidden`}
                    style={{ flex: desktopProfileCardFlex, minHeight: 0 }}
                  >
                    {renderProfileHero()}
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      style={{ flex: 1, minHeight: 0 }}
                      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 28 }}
                    >
                      {renderProfileFields()}
                    </ScrollView>
                  </View>

                  {renderDocumentsCard({
                    style: { flex: desktopDocumentsCardFlex, minHeight: 0 },
                    useInternalScroll: true,
                  })}
                </View>

                <View
                  style={{
                    width: desktopSidebarWidth,
                    flexShrink: 0,
                    minHeight: 0,
                    gap: desktopPanelGap,
                  }}
                >
                  <View className={`${cardBgClass} border rounded-2xl p-5`}>
                    {renderMetadataCards({ compact: true })}
                  </View>
                  {renderQuestionnaireCard({ fitToContainer: true })}
                </View>
              </View>
            </View>
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
            <View className="px-6 pt-6">
              <View className={`${cardBgClass} border-2 border-emerald-500/20 rounded-2xl p-5 mb-4`}>
                <View className="flex-row items-center mb-3">
                  <View className="bg-emerald-500/20 p-2 rounded-lg mr-3">
                    <MaterialIcons name="cloud-upload" size={20} color="#008f4e" />
                  </View>
                  <View className="flex-1">
                    <Text className={`${textClass} font-semibold`}>{t("profile.guestMode")}</Text>
                    <Text className={`${secondaryTextClass} text-xs`}>{t("profile.yourDataSaved")}</Text>
                  </View>
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={handleImportData}
                    className={`flex-1 ${isLight ? "bg-emerald-200" : "bg-emerald-500"} rounded-xl px-4 py-3 flex-row items-center justify-center`}
                  >
                    <MaterialIcons name="file-download" size={18} color={isDark || isGreen ? "#FFFFFF" : "#000"} />
                    <Text className={`${isDark || isGreen ? 'text-white' : 'text-emerald-900'} font-semibold ml-2`}>{t("settings.import")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleExportData}
                    className={`flex-1 ${cardBgClass} border-2 border-emerald-500 rounded-xl px-4 py-3 flex-row items-center justify-center`}
                  >
                    <MaterialIcons name="file-upload" size={18} color="#008f4e" />
                    <Text className="text-emerald-500 font-semibold ml-2">{t("settings.export")}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
          {/* Header */}
          <View className="px-6 pt-6 pb-2 flex-row items-center justify-between">
            <View>
              <Text className={`text-2xl ${textClass} font-semibold`}>{t("home.yourProfile")}</Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>{t("profile.yourDataSaved")}</Text>
            </View>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (isEditing) {
                  void handleSave();
                } else {
                  setIsEditing(true);
                }
              }}
              className="bg-emerald-500 p-3 rounded-full"
            >
              <MaterialIcons name={isEditing ? "save" : "edit"} size={18} color="#001f0f" />
            </Pressable>
          </View>

          <View className="px-6">
            {isWideLayout ? (
              <View className="flex-row items-start gap-6">
                <View className="flex-1 min-w-0 gap-4">
                  <View className={`${cardBgClass} border rounded-2xl overflow-hidden`}>
                    {renderProfileHero()}
                    <View className="px-6 py-6">
                      {renderProfileFields()}
                    </View>
                  </View>

                  {renderDocumentsCard()}
                </View>

                <View className="min-w-0 gap-4" style={{ width: sidebarWidth, flexShrink: 0 }}>
                  {renderMetadataCards()}
                  {renderQuestionnaireCard()}
                </View>
              </View>
            ) : (
              <View className={`${cardBgClass} border rounded-2xl overflow-hidden`}>
                {renderProfileHero()}
                <View className="px-6 py-6">
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

