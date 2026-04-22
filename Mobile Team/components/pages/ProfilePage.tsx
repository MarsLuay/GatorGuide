import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Keyboard,
  Alert,
  Platform,
  Image,
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
import { normalizeQuestionnaireAnswers } from "@/services/app/questionnaire.enums";
import { useAppData } from "@/hooks/use-app-data";
import {
  AnimatedCardPressable,
  AnimatedChipPressable,
  AnimatedIconPressable,
} from "@/components/ui/AnimatedPressables";
import {
  ProfileField,
  getResponsiveFieldControlSpacingStyle,
} from "@/components/ui/ProfileField";
import { DocumentExtractionReviewCard } from "@/components/ui/DocumentExtractionReviewCard";
import { StateCard } from "@/components/ui/StateCard";
import { StatusBanner } from "@/components/ui/StatusBanner";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { ROUTES } from "@/constants/routes";
import { TRANSFER_PLANNER_TRACKS } from "@/constants/transfer-planner-source";
import { collegeService } from "@/services/colleges/college.service";
import { APP_VERSION } from "@/constants/app-version";
import {
  PROFILE_QUESTIONNAIRE_FIELD_IDS,
  STORAGE_KEYS,
} from "@/constants/schema";
import type { SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { documentReaderService, errorLoggingService, type DocumentExtractionReview } from "@/services";

type UploadedDocumentMeta = {
  name: string;
  url: string;
};

type EditableProfileSnapshot = {
  name: string;
  state: string;
  major: string;
  gender: string;
  gpa: string;
  transcript: string;
  residencyType: string;
  englishProficiency: string;
  englishTestType: string;
  englishTestValue: string;
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

  const isEditing = true;
  const [editData, setEditData] = useState({
    name: "",
    state: "",
    major: "",
    gender: "",
    gpa: "",
    transcript: "",
    residencyType: "",
    englishProficiency: "",
    englishTestType: "",
    englishTestValue: "",
  });

  const [isConfettiPlaying, setIsConfettiPlaying] = useState(false);
  const [confettiCooldown, setConfettiCooldown] = useState(false);
  const [showGuestProfile, setShowGuestProfile] = useState(false);
  const [isMajorDropdownOpen, setIsMajorDropdownOpen] = useState(false);
  const [uploadedDocumentMeta, setUploadedDocumentMeta] = useState<
    Partial<Record<"transcript", UploadedDocumentMeta>>
  >({});
  const [activeDocumentAnalysis, setActiveDocumentAnalysis] = useState<"transcript" | null>(null);
  const [documentReviews, setDocumentReviews] = useState<
    Partial<Record<"transcript", DocumentExtractionReview>>
  >({});

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
        const transcriptDocument = await storageService.getTranscript(user.uid);

        if (cancelled) return;

        setUploadedDocumentMeta({
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
  }, [user?.uid, user?.transcript]);
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
      englishProficiency: user?.englishProficiency ?? "",
      englishTestType: user?.englishTestType ?? "",
      englishTestValue: user?.englishTestValue ?? "",
    });
  }, [isHydrated, user?.name, user?.state, user?.major, user?.gender, user?.gpa, user?.transcript, user?.residencyType, user?.englishProficiency, user?.englishTestType, user?.englishTestValue]);

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
  const dropdownSurfaceColor = isDark ? "#111827" : isGreen ? "#064e3b" : "#FFFFFF";
  const guestCtaCardClass = isLight ? "bg-emerald-100 border border-emerald-200" : isDark ? "bg-emerald-500 border" : "bg-emerald-500";
  const guestCtaCardStyle = isDark ? { backgroundColor: "#00572b", borderColor: "#00753e" } : undefined;
  const guestCtaTextClass = isLight ? "text-emerald-900" : "text-white";
  const guestCtaBodyClass = isLight ? "text-emerald-800" : "text-emerald-100";
  const guestCtaIconColor = isLight ? "#1f8a5d" : isDark ? "#8cd19e" : "#FFFFFF";
  const hasOpenSelectorOverlay = isMajorDropdownOpen;
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
  const majorFieldOverlayStyle = hasOpenSelectorOverlay
    ? {
        position: "relative" as const,
        overflow: "visible" as const,
        zIndex: 90,
        elevation: 90,
      }
    : {
        position: "relative" as const,
        overflow: "visible" as const,
      };
  const isWideLayout = viewportWidth >= 820;
  const isDesktopLayout = viewportWidth >= 1200;
  const useDesktopFitLayout = Platform.OS === "web" && isDesktopLayout;
  const pageMaxWidth = isDesktopLayout ? 1280 : 1040;
  const earlyStateMaxWidth = Math.min(pageMaxWidth, isDesktopLayout ? 760 : isWideLayout ? 680 : 448);
  const sidebarWidth = isDesktopLayout ? 360 : 300;
  const avatarSize = isDesktopLayout ? 88 : isWideLayout ? 76 : 56;
  const avatarFallbackSize = isDesktopLayout ? 38 : isWideLayout ? 32 : 26;
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
  const useResponsiveFieldSectionSpacing = Platform.OS === "web" && viewportWidth >= 1080;
  const responsiveFieldSectionSpacingProps = useResponsiveFieldSectionSpacing
    ? { responsiveSectionSpacing: true as const }
    : {};
  const responsiveFieldControlSpacingStyle = getResponsiveFieldControlSpacingStyle({
    responsiveSectionSpacing: useResponsiveFieldSectionSpacing,
    viewportWidth,
    viewportHeight,
  });

  const hasQuestionnaireData = useMemo(
    () => Object.keys(state.questionnaireAnswers ?? {}).length > 0,
    [state.questionnaireAnswers]
  );

  // (removed unused hasExportableData helper to satisfy linter)

  const capitalizeWords = (text: string | undefined) => {
    if (!text) return "";
    return text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  };

  const greenRiverMajorOptions = useMemo<SearchableSelectOption[]>(() => {
    const groupedTrackCodes = new Map<string, Set<string>>();

    for (const track of TRANSFER_PLANNER_TRACKS) {
      const title = String(track.title ?? "").trim();
      if (!title) continue;

      if (!groupedTrackCodes.has(title)) {
        groupedTrackCodes.set(title, new Set<string>());
      }

      const code = String(track.code ?? "").trim();
      if (code) {
        groupedTrackCodes.get(title)?.add(code);
      }
    }

    return [...groupedTrackCodes.entries()]
      .sort(([leftTitle], [rightTitle]) =>
        leftTitle.localeCompare(rightTitle, undefined, { sensitivity: "base" })
      )
      .map(([title, codeSet]) => {
        const codes = [...codeSet].sort((left, right) =>
          left.localeCompare(right, undefined, { sensitivity: "base" })
        );

        return {
          id: title,
          label: title,
          description: codes.length ? codes.join(" | ") : undefined,
          searchText: [title, ...codes].join(" "),
        };
      });
  }, []);

  const greenRiverMajorLookup = useMemo(
    () =>
      new Map(
        greenRiverMajorOptions.map((option) => [option.id.toLowerCase(), option.id])
      ),
    [greenRiverMajorOptions]
  );

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

  function formatGpaDisplay(value: string | undefined | null) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const match = raw.match(/-?\d+(?:\.\d+)?/);
    if (!match) return raw;
    const num = Number.parseFloat(match[0]);
    if (!Number.isFinite(num)) return raw;
    const clamped = Math.max(0, Math.min(num, 4.0));
    const truncated = Math.floor(clamped * 100) / 100;
    return truncated.toFixed(2).replace(/\.0+$|0+$/g, '');
  }

  const transcriptDisplayName = (path: string | undefined) =>
    getReadableDocumentFileName({
      name:
        uploadedDocumentMeta.transcript?.url === String(path ?? "")
          ? uploadedDocumentMeta.transcript?.name
          : null,
      url: path,
      fallbackName: "unofficial-transcript.pdf",
    });
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
  const getResponsiveChipMinWidth = (optionCount: number) =>
    optionCount >= 4 ? 132 : optionCount === 3 ? 152 : 180;
  const currentMajor = formatMajorDisplayValue(editData.major || user?.major || "") || t("profile.undecided");
  const currentGpaRaw = editData.gpa || user?.gpa || "";
  const currentGpa = currentGpaRaw ? formatGpaDisplay(currentGpaRaw) : t("general.notSpecified");
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
  const currentEnglishProficiency = user?.englishProficiency
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
    : t("general.notSpecified");
  const openQuestionnairePage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(ROUTES.questionnaire);
  };

  const profileSummaryCards = [
    { key: "major", icon: "school" as const, label: t("profile.major"), value: currentMajor },
    { key: "gpa", icon: "description" as const, label: t("profile.gpa"), value: currentGpa },
    { key: "gender", icon: "wc" as const, label: t("profile.gender"), value: currentGender },
    { key: "residency", icon: "home" as const, label: t("profile.residencyType"), value: currentResidency },
    { key: "questionnaire", icon: "assignment" as const, label: t("profile.questionnaire"), value: questionnaireCompletionLabel },
  ];

  const normalizedProfileDraft = useMemo<EditableProfileSnapshot>(() => {
    const trimmedMajor = String(editData.major ?? "").trim();
    const resolvedMajor = trimmedMajor
      ? greenRiverMajorLookup.get(trimmedMajor.toLowerCase()) ?? trimmedMajor
      : "";

    return {
      name: editData.name,
      state: editData.state,
      major: resolvedMajor,
      gender: editData.gender,
      gpa: formatGpaDisplay(editData.gpa),
      transcript: editData.transcript,
      residencyType: editData.residencyType,
      englishProficiency: editData.englishProficiency,
      englishTestType: editData.englishProficiency === "native" ? "" : editData.englishTestType,
      englishTestValue: editData.englishProficiency === "native" ? "" : editData.englishTestValue,
    };
  }, [
    editData.englishProficiency,
    editData.englishTestType,
    editData.englishTestValue,
    editData.gender,
    editData.gpa,
    editData.major,
    editData.name,
    editData.residencyType,
    editData.state,
    editData.transcript,
    greenRiverMajorLookup,
  ]);

  const persistedProfileDraft = useMemo<EditableProfileSnapshot>(() => {
    const trimmedMajor = String(user?.major ?? "").trim();
    const resolvedMajor = trimmedMajor
      ? greenRiverMajorLookup.get(trimmedMajor.toLowerCase()) ?? trimmedMajor
      : "";
    const englishProficiency = String(user?.englishProficiency ?? "");

    return {
      name: String(user?.name ?? ""),
      state: String(user?.state ?? ""),
      major: resolvedMajor,
      gender: String(user?.gender ?? ""),
      gpa: formatGpaDisplay(user?.gpa),
      transcript: String(user?.transcript ?? ""),
      residencyType: String(user?.residencyType ?? ""),
      englishProficiency,
      englishTestType:
        englishProficiency === "native" ? "" : String(user?.englishTestType ?? ""),
      englishTestValue:
        englishProficiency === "native" ? "" : String(user?.englishTestValue ?? ""),
    };
  }, [
    greenRiverMajorLookup,
    user?.englishProficiency,
    user?.englishTestType,
    user?.englishTestValue,
    user?.gender,
    user?.gpa,
    user?.major,
    user?.name,
    user?.residencyType,
    user?.state,
    user?.transcript,
  ]);

  const profileDraftPatch = useMemo<Partial<EditableProfileSnapshot>>(() => {
    const patch: Partial<EditableProfileSnapshot> = {};

    (Object.keys(normalizedProfileDraft) as (keyof EditableProfileSnapshot)[]).forEach((key) => {
      if (normalizedProfileDraft[key] !== persistedProfileDraft[key]) {
        patch[key] = normalizedProfileDraft[key];
      }
    });

    return patch;
  }, [normalizedProfileDraft, persistedProfileDraft]);

  useEffect(() => {
    if (!isHydrated || !user) return;
    if (!Object.keys(profileDraftPatch).length) return;

    const autoSaveTimer = setTimeout(() => {
      void (async () => {
        try {
          await updateUser(profileDraftPatch);

          if (
            typeof profileDraftPatch.gpa === "string" &&
            editData.gpa !== normalizedProfileDraft.gpa
          ) {
            setEditData((prev) =>
              prev.gpa === normalizedProfileDraft.gpa
                ? prev
                : { ...prev, gpa: normalizedProfileDraft.gpa }
            );
          }
        } catch (error) {
          void errorLoggingService.captureException(error, {
            category: "firestore",
            operation: "auto-save-profile-edit",
            severity: "error",
            handled: true,
            source: "profile-page",
            screen: "profile",
            route: ROUTES.profile,
          });
        }
      })();
    }, 600);

    return () => {
      clearTimeout(autoSaveTimer);
    };
  }, [
    editData.gpa,
    isHydrated,
    normalizedProfileDraft.gpa,
    profileDraftPatch,
    updateUser,
    user,
  ]);

  const handleGpaChange = (value: string) => {
    // Allow digits and at most one decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      const parts = value.split('.');
      const intPart = parts[0] ?? '';
      const fracPart = parts[1] ?? '';

      // Prevent typing more than two decimal places
      if (fracPart.length > 2) return;

      // Disallow fractional values that reach 4.00 — decimals max at 3.99
      if (intPart === '4' && value.includes('.')) return;

      const num = Number(value);
      const isEmptyOrZeroish = value === '' || value === '0' || value === '0.';

      if (
        isEmptyOrZeroish ||
        (Number.isFinite(num) && (value.includes('.') ? num <= 3.99 : num <= 4.0))
      ) {
        setEditData((p) => ({ ...p, gpa: value }));

        // Celebrate perfect GPA! 🎉 — only when user types exact `4`
        if (num === 4.0 && value === '4' && !confettiCooldown) {
          setIsConfettiPlaying(true);
          setConfettiCooldown(true);
          setTimeout(() => setIsConfettiPlaying(false), 6000);
          setTimeout(() => setConfettiCooldown(false), 1000);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          cheerPlayer.play();
        } else if (value !== '4' && isConfettiPlaying) {
          setIsConfettiPlaying(false);
        }
      }
    }
  };

  const analyzeUploadedDocument = async (asset: {
    uri: string;
    name?: string | null;
    mimeType?: string | null;
    size?: number | null;
  }) => {
    setActiveDocumentAnalysis("transcript");
    try {
      const review = await documentReaderService.extractDocumentReview({
        documentType: "transcript",
        fileUri: asset.uri,
        fileName: asset.name || asset.uri.split("/").pop() || "transcript.pdf",
        mimeType: asset.mimeType,
        size: asset.size,
        currentProfile: {
          major: editData.major || user?.major || "",
          gpa: editData.gpa || user?.gpa || "",
        },
        questionnaireAnswers: state.questionnaireAnswers,
      });
      setDocumentReviews({ transcript: review });
    } catch (error) {
      Alert.alert(
        t("profile.documentReaderUnavailableTitle"),
        error instanceof Error ? error.message : t("profile.prepareDataError")
      );
    } finally {
      setActiveDocumentAnalysis(null);
    }
  };

  const dismissDocumentReview = () => {
    setDocumentReviews({});
  };

  const applyDocumentReview = async () => {
    const review = documentReviews.transcript;
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
            ...review.questionnairePatch,
          },
          language
        ) as Record<string, string>;
        await setQuestionnaireAnswers(nextQuestionnaire);
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

      dismissDocumentReview();
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
      await analyzeUploadedDocument(asset);
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

  const renderProfileHero = () => (
    <View className="bg-emerald-500/5 px-6 py-5 border-b border-emerald-500/20">
      <View className="flex-row items-center">
        <View className="relative mr-4 pb-1 pr-1">
          <AnimatedIconPressable
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
          </AnimatedIconPressable>

        </View>

        <View className="flex-1 min-w-0">
          <Text className={`${textClass} ${isWideLayout ? "text-xl" : "text-lg"} font-semibold`} numberOfLines={2}>
            {capitalizeWords(editData.name || user?.name || "") || t("general.notSpecified")}
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

  const renderEnglishProficiencyField = () => {
    const englishProficiencyContent = !isEditing ? (
      <Text className={textClass}>{currentEnglishProficiency}</Text>
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
              <AnimatedChipPressable
                key={option.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setEditData((prev) => ({
                    ...prev,
                    englishProficiency: option.key,
                    ...(option.key === "native" ? { englishTestType: "", englishTestValue: "" } : {}),
                  }));
                }}
                containerStyle={{
                  flexGrow: 1,
                  flexBasis: getResponsiveChipMinWidth(4),
                  minWidth: getResponsiveChipMinWidth(4),
                }}
                className={`px-4 py-2 rounded-lg border ${
                  isSelected ? "bg-emerald-500/10 border-emerald-500" : `border ${borderClass}`
                }`}
                style={{ width: "100%" }}
              >
                <Text className={isSelected ? "text-emerald-500 font-semibold" : secondaryTextClass}>
                  {t(option.labelKey)}
                </Text>
              </AnimatedChipPressable>
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
                  <AnimatedChipPressable
                    key={type}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setEditData((prev) => ({ ...prev, englishTestType: type, englishTestValue: "" }));
                    }}
                    containerStyle={{
                      flexGrow: 1,
                      flexBasis: getResponsiveChipMinWidth(4),
                      minWidth: getResponsiveChipMinWidth(4),
                    }}
                    className={`px-3 py-1.5 rounded-lg border ${
                      isSelected ? "bg-emerald-500/10 border-emerald-500" : `border ${borderClass}`
                    }`}
                    style={{ width: "100%" }}
                  >
                    <Text className={`text-sm ${isSelected ? "text-emerald-500 font-medium" : secondaryTextClass}`}>
                      {t(labelKey)}
                    </Text>
                  </AnimatedChipPressable>
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
    );

    return (
      <View className={`border-t ${borderClass} pt-4 mt-4`}>
        <View className="flex-row items-start min-w-0">
          <MaterialIcons name="translate" size={20} color="#008f4e" />
          <View className="flex-1 ml-3 min-w-0">
            <Text className={`text-sm ${secondaryTextClass} mb-1`}>
              {t("profile.englishProficiency")}
            </Text>
            <View className="min-w-0" style={responsiveFieldControlSpacingStyle}>
              {englishProficiencyContent}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderProfileFields = () => (
    <>
      {!user?.isGuest ? (
        <ProfileField
          {...responsiveFieldSectionSpacingProps}
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
        <AnimatedCardPressable
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
        </AnimatedCardPressable>
      ) : (
        <ProfileField
          {...responsiveFieldSectionSpacingProps}
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

      <View style={majorFieldOverlayStyle}>
        <ProfileField
          {...responsiveFieldSectionSpacingProps}
          type="select"
          icon="school"
          label={t("profile.major")}
          value={formatMajorDisplayValue(user?.major) || t("profile.undecided")}
          isEditing={isEditing}
          editValue={editData.major}
          displayEditValue={formatMajorDisplayValue(editData.major)}
          selectedOptionId={resolveGreenRiverMajorId(editData.major)}
          options={greenRiverMajorOptions}
          onSelect={(value) => setEditData((prev) => ({ ...prev, major: value }))}
          selectOpen={isMajorDropdownOpen}
          onSelectOpenChange={setIsMajorDropdownOpen}
          searchPlaceholder="Search Green River majors"
          placeholderColor={placeholderColor}
          dropdownBackgroundColor={dropdownSurfaceColor}
          overlayStrategy="inline-isolated"
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
        />
      </View>

      <ProfileField
        {...responsiveFieldSectionSpacingProps}
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
        {...responsiveFieldSectionSpacingProps}
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
        {...responsiveFieldSectionSpacingProps}
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

      {renderEnglishProficiencyField()}

      <ProfileField
        {...responsiveFieldSectionSpacingProps}
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
        {...responsiveFieldSectionSpacingProps}
        noDivider={noDivider}
        noTopSpacing={noTopSpacing}
        type="upload"
        icon="upload-file"
        label={t("profile.transcript")}
        value={transcriptDisplayName(user?.transcript)}
        isEditing={isEditing}
        editValue={transcriptDisplayName(editData.transcript)}
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

      {documentReviews.transcript ? (
        <View className="mt-4">
          <DocumentExtractionReviewCard
            title={t("profile.documentReaderReviewTitle")}
            subtitle={t("profile.documentReaderReviewSubtitle")}
            fileName={documentReviews.transcript.fileName}
            confidenceText={
              typeof documentReviews.transcript.confidence === "number"
                ? t("profile.documentReaderConfidence", {
                    confidence: documentReviews.transcript.confidence,
                  })
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
            items={documentReviews.transcript.items.map((item) => ({
              ...item,
              label: t(item.labelKey),
            }))}
            uncertainties={documentReviews.transcript.uncertainties}
            onApply={() => {
              applyDocumentReview().catch(() => {});
            }}
            onDismiss={dismissDocumentReview}
          />
        </View>
      ) : null}
    </>
  );

  const renderQuestionnaireAction = ({ compact = false }: { compact?: boolean } = {}) => (
    <View className="flex-row items-center">
      <Text
        className={`${compact ? "text-xs" : "text-sm"} font-semibold`}
        style={{ color: "#008f4e" }}
      >
        {questionnaireActionLabel}
      </Text>
      <MaterialIcons
        name="chevron-right"
        size={compact ? 16 : 18}
        color="#008f4e"
        style={{ marginLeft: 2 }}
      />
    </View>
  );

  const renderMetadataCard = (
    card: (typeof profileSummaryCards)[number],
    {
      compact = false,
      fillHeight = false,
      containerStyle,
    }: {
      compact?: boolean;
      fillHeight?: boolean;
      containerStyle?: object;
    } = {}
  ) => {
    const isQuestionnaireCard = card.key === "questionnaire";
    const centerSummaryContent = !isQuestionnaireCard;
    const summaryContent = (
      <View
        style={{
          ...(fillHeight ? { flex: 1 } : {}),
          ...(centerSummaryContent
            ? {
                alignItems: "center",
                justifyContent: "center",
              }
            : {}),
        }}
      >
        <View className="w-10 h-10 rounded-full bg-emerald-500/10 items-center justify-center">
          <MaterialIcons name={card.icon} size={20} color="#008f4e" />
        </View>
        <View
          className="mt-3"
          style={centerSummaryContent ? { alignItems: "center" } : undefined}
        >
          <Text
            className={`${secondaryTextClass} text-xs`}
            numberOfLines={compact ? 1 : 2}
            style={centerSummaryContent ? { textAlign: "center" } : undefined}
          >
            {card.label}
          </Text>
          <Text
            className={`${textClass} text-base font-semibold mt-1`}
            numberOfLines={compact ? 1 : 2}
            style={centerSummaryContent ? { textAlign: "center" } : undefined}
          >
            {card.value}
          </Text>

          {isQuestionnaireCard && !compact && !hasQuestionnaireData ? (
            <Text className={`${secondaryTextClass} text-sm mt-2`} numberOfLines={2}>
              {t("profile.questionnairePrompt")}
            </Text>
          ) : null}
        </View>

        {isQuestionnaireCard ? (
          <View
            className="flex-row items-center justify-end"
            style={{ marginTop: compact ? 10 : 14 }}
          >
            {renderQuestionnaireAction({ compact: true })}
          </View>
        ) : null}
      </View>
    );

    return isQuestionnaireCard ? (
      <AnimatedCardPressable
        key={card.key}
        onPress={openQuestionnairePage}
        accessibilityRole="button"
        accessibilityLabel={t("profile.questionnaire")}
        className={`${cardBgClass} border rounded-2xl p-4`}
        containerStyle={containerStyle}
      >
        {summaryContent}
      </AnimatedCardPressable>
    ) : (
      <View
        key={card.key}
        className={`${cardBgClass} border rounded-2xl p-4`}
        style={containerStyle}
      >
        {summaryContent}
      </View>
    );
  };

  const renderMetadataCards = ({
    compact = false,
    fillHeight = false,
  }: {
    compact?: boolean;
    fillHeight?: boolean;
  } = {}) => {
    const minimumCardHeight = compact ? 112 : 132;

    if (fillHeight) {
      const metadataRows = [
        profileSummaryCards.slice(0, 2),
        profileSummaryCards.slice(2, 4),
        profileSummaryCards.slice(4),
      ];

      return (
        <View style={{ flex: 1, minHeight: 0, gap: 12 }}>
          {metadataRows.map((row, rowIndex) => (
            <View
              key={`metadata-row-${rowIndex}`}
              style={{
                flex: 1,
                minHeight: minimumCardHeight,
                flexDirection: "row",
                gap: 12,
              }}
            >
              {row.map((card) =>
                renderMetadataCard(card, {
                  compact,
                  fillHeight,
                  containerStyle: {
                    flex: 1,
                    minWidth: 0,
                    minHeight: minimumCardHeight,
                  },
                })
              )}
            </View>
          ))}
        </View>
      );
    }

    return (
      <View className="flex-row flex-wrap gap-3">
        {profileSummaryCards.map((card) =>
          renderMetadataCard(card, {
            compact,
            containerStyle: {
              flexBasis: "47%" as const,
              flexGrow: 1,
              flexShrink: 1,
              minHeight: minimumCardHeight,
            },
          })
        )}
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

            <AnimatedChipPressable
              onPress={() => router.push(ROUTES.login)}
              className={`${isLight ? "bg-emerald-200" : "bg-emerald-500"} rounded-lg py-4 px-6 items-center flex-row justify-center`}
            >
              <MaterialIcons name="arrow-forward" size={20} color="#001f0f" />
              <Text className={`${isDark || isGreen ? 'text-white' : 'text-emerald-900'} font-semibold ml-2`}>{t("profile.createYourProfile")}</Text>
            </AnimatedChipPressable>

            <AnimatedChipPressable
              onPress={() => {
                setShowGuestProfile(true);
                AsyncStorage.setItem(STORAGE_KEYS.guestProfileShow, "true").catch(() => {});
              }}
              className={`${cardBgClass} border rounded-lg py-3 px-6 items-center mt-3`}
            >
              <Text className={secondaryTextClass}>{t("profile.continueAsGuest")}</Text>
            </AnimatedChipPressable>
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
                      <AnimatedChipPressable
                        onPress={handleImportData}
                        className={`rounded-xl px-4 py-3 flex-row items-center justify-center ${isLight ? "bg-emerald-200" : "bg-emerald-500"}`}
                      >
                        <MaterialIcons name="file-download" size={18} color={isDark || isGreen ? "#FFFFFF" : "#000"} />
                        <Text className={`${isDark || isGreen ? "text-white" : "text-emerald-900"} font-semibold ml-2`}>
                          {t("settings.import")}
                        </Text>
                      </AnimatedChipPressable>
                      <AnimatedChipPressable
                        onPress={handleExportData}
                        className={`rounded-xl px-4 py-3 flex-row items-center justify-center ${cardBgClass} border-2 border-emerald-500`}
                      >
                        <MaterialIcons name="file-upload" size={18} color="#008f4e" />
                        <Text className="text-emerald-500 font-semibold ml-2">{t("settings.export")}</Text>
                      </AnimatedChipPressable>
                    </View>
                  </View>
                </View>
              ) : null}

              <View className="pb-3">
                <View>
                  <Text className={`text-2xl ${textClass} font-semibold`}>{t("home.yourProfile")}</Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>{t("profile.yourDataSaved")}</Text>
                </View>
              </View>

              <View style={{ flex: 1, minHeight: 0, flexDirection: "row", gap: desktopPanelGap }}>
                <View style={{ flex: 1, minWidth: 0, gap: desktopPanelGap }}>
                  <View
                    className={`${cardBgClass} border rounded-2xl ${hasOpenSelectorOverlay ? "" : "overflow-hidden"}`}
                    style={{ ...profileCardOverlayStyle, flex: 1, minHeight: 0 }}
                  >
                    {renderProfileHero()}
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      style={{ flex: 1, minHeight: 0 }}
                      contentContainerStyle={{
                        flexGrow: 1,
                        justifyContent: "space-between",
                        paddingHorizontal: 24,
                        paddingVertical: 24,
                        paddingBottom: 28,
                      }}
                    >
                      {renderProfileFields()}
                      {renderDocumentFields()}
                    </ScrollView>
                  </View>
                </View>

                <View
                  style={{
                    width: desktopSidebarWidth,
                    flexShrink: 0,
                    minHeight: 0,
                    gap: desktopPanelGap,
                  }}
                >
                  <View
                    className={`${cardBgClass} border rounded-2xl p-5`}
                    style={{ flex: 1, minHeight: 0 }}
                  >
                    {renderMetadataCards({ compact: true, fillHeight: true })}
                  </View>
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
                  <AnimatedChipPressable
                    onPress={handleImportData}
                    className={`flex-1 ${isLight ? "bg-emerald-200" : "bg-emerald-500"} rounded-xl px-4 py-3 flex-row items-center justify-center`}
                  >
                    <MaterialIcons name="file-download" size={18} color={isDark || isGreen ? "#FFFFFF" : "#000"} />
                    <Text className={`${isDark || isGreen ? 'text-white' : 'text-emerald-900'} font-semibold ml-2`}>{t("settings.import")}</Text>
                  </AnimatedChipPressable>
                  <AnimatedChipPressable
                    onPress={handleExportData}
                    className={`flex-1 ${cardBgClass} border-2 border-emerald-500 rounded-xl px-4 py-3 flex-row items-center justify-center`}
                  >
                    <MaterialIcons name="file-upload" size={18} color="#008f4e" />
                    <Text className="text-emerald-500 font-semibold ml-2">{t("settings.export")}</Text>
                  </AnimatedChipPressable>
                </View>
              </View>
            </View>
          ) : null}
          {/* Header */}
          <View className="px-6 pt-6 pb-2">
            <View>
              <Text className={`text-2xl ${textClass} font-semibold`}>{t("home.yourProfile")}</Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>{t("profile.yourDataSaved")}</Text>
            </View>
          </View>

          <View className="px-6">
            {isWideLayout ? (
              <View style={{ flexDirection: "row", alignItems: "stretch", gap: desktopPanelGap }}>
                <View style={{ flex: 1, minWidth: 0, gap: desktopPanelGap }}>
                  <View
                    className={`${cardBgClass} border rounded-2xl ${hasOpenSelectorOverlay ? "" : "overflow-hidden"}`}
                    style={profileCardOverlayStyle}
                  >
                    {renderProfileHero()}
                    <View className="px-6 py-6">
                      {renderProfileFields()}
                      {renderDocumentFields()}
                    </View>
                  </View>
                </View>

                <View
                  className="min-w-0"
                  style={{ width: sidebarWidth, flexShrink: 0, gap: desktopPanelGap }}
                >
                  <View
                    className={`${cardBgClass} border rounded-2xl p-5`}
                    style={{ flex: 1, minHeight: 0 }}
                  >
                    {renderMetadataCards({ fillHeight: true })}
                  </View>
                </View>
              </View>
            ) : (
              <View
                className={`${cardBgClass} border rounded-2xl ${hasOpenSelectorOverlay ? "" : "overflow-hidden"}`}
                style={profileCardOverlayStyle}
              >
                {renderProfileHero()}
                <View className="px-6 py-6">
                  {renderProfileFields()}
                  {renderDocumentFields()}
                </View>
              </View>
            )}

            {!isWideLayout ? (
              <AnimatedCardPressable
                onPress={openQuestionnairePage}
                accessibilityRole="button"
                accessibilityLabel={t("profile.questionnaire")}
                className="rounded-2xl border px-5 py-5 mt-4"
                style={{
                  backgroundColor: isDark
                    ? "rgba(16,185,129,0.08)"
                    : isGreen
                      ? "rgba(16,185,129,0.12)"
                      : "rgba(16,185,129,0.06)",
                  borderColor: "rgba(16,185,129,0.18)",
                }}
              >
                <View className="flex-row items-start min-w-0">
                  <MaterialIcons name="assignment" size={20} color="#008f4e" />
                  <View className="flex-1 ml-3 min-w-0">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 min-w-0">
                        <Text className={`text-sm ${secondaryTextClass} mb-1`}>
                          {t("profile.questionnaire")}
                        </Text>
                        <Text className={`${textClass} text-base font-semibold`}>
                          {questionnaireCompletionLabel}
                        </Text>
                      </View>

                      <View className="bg-emerald-500/10 rounded-full px-2.5 py-1 border border-emerald-500/15">
                        <Text className="text-emerald-500 text-xs font-semibold">
                          {questionnaireCompletionLabel}
                        </Text>
                      </View>
                    </View>

                    {!hasQuestionnaireData ? (
                      <Text className={`${secondaryTextClass} text-sm mt-2`}>
                        {t("profile.questionnairePrompt")}
                      </Text>
                    ) : null}

                    <View className="mt-3 flex-row items-center justify-between">
                      <Text className="text-emerald-500 text-sm font-semibold">
                        {questionnaireActionLabel}
                      </Text>
                      <MaterialIcons name="chevron-right" size={20} color="#008f4e" />
                    </View>
                  </View>
                </View>
              </AnimatedCardPressable>
            ) : null}
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

