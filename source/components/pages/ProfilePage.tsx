import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
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
import { useDataPortabilityActions } from "@/hooks/use-data-portability-actions";
import {
  normalizeQuestionnaireAnswers,
  US_STATE_OPTIONS,
} from "@/services/app/questionnaire.enums";
import { useAppData } from "@/hooks/use-app-data";
import {
  AnimatedCardPressable,
  AnimatedChipPressable,
  AnimatedIconPressable,
} from "@/components/ui/AnimatedPressables";
import { ProfileField } from "@/components/ui/ProfileField";
import { ProfileGuestDataActionsCard } from "@/components/pages/profile/ProfileGuestDataActionsCard";
import { DocumentExtractionReviewCard } from "@/components/ui/DocumentExtractionReviewCard";
import { StateCard } from "@/components/ui/StateCard";
import { StatusBanner } from "@/components/ui/StatusBanner";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { ROUTES, routeWithReturnTo } from "@/constants/routes";
import { GREEN_RIVER_MAJOR_OPTIONS } from "@/constants/green-river-major-options.generated";
import { collegeService } from "@/services/colleges/college.service";
import {
  PROFILE_QUESTIONNAIRE_FIELD_IDS,
  STORAGE_KEYS,
} from "@/constants/schema";
import { TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD } from "@/constants/planner-storage";
import type { SearchableSelectOption } from "@/components/ui/SearchableSelect";
import {
  documentReaderService,
  type DocumentExtractionReview,
} from "@/services/documents/document-reader.service";
import { transcriptPdfService } from "@/services/documents/transcript-pdf.service";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import {
  buildTransferPlannerTranscriptCachePatch,
} from "@/services/planning/transfer-planner-cache.service";
import type { UploadedFile } from "@/services/storage/storage.service";

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
};

const PROFILE_STATE_ABBREVIATIONS_BY_NAME: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
};

const PROFILE_STATE_NAMES_BY_ABBREVIATION = new Map(
  Object.entries(PROFILE_STATE_ABBREVIATIONS_BY_NAME).map(([name, abbreviation]) => [
    abbreviation,
    name,
  ])
);

function normalizeProfileStateSearchValue(value: string | undefined | null) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveProfileStateName(value: string | undefined | null) {
  const trimmedValue = String(value ?? "").trim();
  if (!trimmedValue) return null;

  const abbreviationMatch = PROFILE_STATE_NAMES_BY_ABBREVIATION.get(trimmedValue.toUpperCase());
  if (abbreviationMatch) {
    return abbreviationMatch;
  }

  const normalizedValue = normalizeProfileStateSearchValue(trimmedValue);
  return (
    US_STATE_OPTIONS.find(
      (stateName) => normalizeProfileStateSearchValue(stateName) === normalizedValue
    ) ?? null
  );
}

function formatProfileStateDisplayValue(value: string | undefined | null) {
  const resolvedStateName = resolveProfileStateName(value);
  if (resolvedStateName) {
    return resolvedStateName;
  }

  const trimmedValue = String(value ?? "").trim();
  if (!trimmedValue) return "";

  return trimmedValue
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

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

function hasProfileGpaValue(value: string | undefined | null) {
  return String(value ?? "").trim().length > 0;
}

function omitProfileReviewField(
  review: DocumentExtractionReview,
  fieldId: string
): DocumentExtractionReview {
  const userPatch = { ...review.userPatch };
  delete userPatch[fieldId];

  return {
    ...review,
    userPatch,
    items: review.items.filter(
      (item) => !(item.target === "profile" && item.id === fieldId)
    ),
  };
}

function omitQuestionnaireReviewField(
  review: DocumentExtractionReview,
  fieldId: string
): DocumentExtractionReview {
  const questionnairePatch = { ...review.questionnairePatch };
  delete questionnairePatch[fieldId];

  return {
    ...review,
    questionnairePatch,
    items: review.items.filter(
      (item) => !(item.target === "questionnaire" && item.id === fieldId)
    ),
  };
}

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
  const [editData, setEditData] = useState({
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
  const [uploadedDocumentMeta, setUploadedDocumentMeta] = useState<
    Partial<Record<"transcript", UploadedDocumentMeta>>
  >({});
  const [activeDocumentAnalysis, setActiveDocumentAnalysis] = useState<"transcript" | null>(null);
  const [documentReviews, setDocumentReviews] = useState<
    Partial<Record<"transcript", DocumentExtractionReview>>
  >({});

  useEffect(() => {
    let cancelled = false;

    if (!user?.isGuest) {
      setShowGuestProfile(false);
      return;
    }

    AsyncStorage.getItem(STORAGE_KEYS.guestProfileShow).then((value) => {
      if (!cancelled) setShowGuestProfile(value === "true");
    });

    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.isGuest]);

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
  const responsiveFieldSectionSpacingProps = useResponsiveFieldSectionSpacing
    ? { responsiveSectionSpacing: true as const }
    : {};
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
  const openQuestionnairePage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(routeWithReturnTo(ROUTES.questionnaire, ROUTES.profile));
  };

  const normalizedProfileDraft = useMemo<EditableProfileSnapshot>(() => {
    const trimmedMajor = String(editData.major ?? "").trim();
    const resolvedMajor = trimmedMajor
      ? greenRiverMajorLookup.get(trimmedMajor.toLowerCase()) ?? trimmedMajor
      : "";

    return {
      name: editData.name,
      state: resolveProfileStateName(editData.state) ?? String(editData.state ?? "").trim(),
      major: resolvedMajor,
      gender: editData.gender,
      gpa: formatGpaDisplay(editData.gpa),
      transcript: editData.transcript,
      residencyType: editData.residencyType,
    };
  }, [
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

    return {
      name: String(user?.name ?? ""),
      state: resolveProfileStateName(user?.state) ?? String(user?.state ?? "").trim(),
      major: resolvedMajor,
      gender: String(user?.gender ?? ""),
      gpa: formatGpaDisplay(user?.gpa),
      transcript: String(user?.transcript ?? ""),
      residencyType: String(user?.residencyType ?? ""),
    };
  }, [
    greenRiverMajorLookup,
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

  useEffect(() => {
    if (!hasProfileGpaValue(editData.gpa || user?.gpa)) return;

    setDocumentReviews((current) => {
      const review = current.transcript;
      const hasGpaPatch = typeof review?.userPatch.gpa === "string";
      const hasGpaItem = review?.items.some(
        (item) => item.target === "profile" && item.id === "gpa"
      );
      if (!review || (!hasGpaPatch && !hasGpaItem)) return current;
      const nextReview = omitProfileReviewField(review, "gpa");

      return nextReview.items.length ? { ...current, transcript: nextReview } : {};
    });
  }, [editData.gpa, user?.gpa]);

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
        latestProfileGpaRef.current = value;
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

  const autoApplyTranscriptGpa = async (
    rawGpa: string | null | undefined,
    operation: string
  ) => {
    const transcriptGpa = formatGpaDisplay(rawGpa);
    if (!transcriptGpa || hasProfileGpaValue(latestProfileGpaRef.current)) {
      return false;
    }

    const previousGpa = latestProfileGpaRef.current;
    try {
      latestProfileGpaRef.current = transcriptGpa;
      await updateUser({ gpa: transcriptGpa });
      setEditData((prev) =>
        hasProfileGpaValue(prev.gpa) ? prev : { ...prev, gpa: transcriptGpa }
      );
      return true;
    } catch (error) {
      latestProfileGpaRef.current = previousGpa || editData.gpa || user?.gpa || "";
      void errorLoggingService.captureException(error, {
        category: "firestore",
        operation,
        severity: "warn",
        handled: true,
        source: "profile-page",
        screen: "profile",
        route: ROUTES.profile,
      });
      return false;
    }
  };

  const syncUploadedTranscriptToPlanner = async (uploaded: UploadedFile) => {
    try {
      const parsedTranscript = await transcriptPdfService.extractTranscriptDataFromPdf(
        uploaded.url
      );

      if (parsedTranscript.completedCourses.length) {
        await setQuestionnaireAnswers((currentAnswers) => ({
          ...currentAnswers,
          ...buildTransferPlannerTranscriptCachePatch(
            uploaded,
            parsedTranscript.completedCourses,
            parsedTranscript.earnedCreditsTotal
          ),
        }));
      }

      await autoApplyTranscriptGpa(
        parsedTranscript.gpa,
        "auto-apply-transcript-pdf-gpa"
      );

      return parsedTranscript.completedCourses.length;
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "upload",
        operation: "sync-profile-transcript-to-planner",
        severity: "warn",
        handled: true,
        source: "profile-page",
        screen: "profile",
        route: ROUTES.profile,
      });
      return 0;
    }
  };

  const analyzeUploadedDocument = async (asset: {
    uri: string;
    name?: string | null;
    mimeType?: string | null;
    size?: number | null;
  }, options?: { omitCompletedCoursesReview?: boolean }) => {
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
      const transcriptGpa = review.userPatch.gpa;
      let nextReview = options?.omitCompletedCoursesReview
        ? omitQuestionnaireReviewField(
            review,
            TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD
          )
        : review;

      if (transcriptGpa) {
        const didAutoApplyTranscriptGpa = await autoApplyTranscriptGpa(
          transcriptGpa,
          "auto-apply-transcript-gpa"
        );

        if (didAutoApplyTranscriptGpa || hasProfileGpaValue(latestProfileGpaRef.current)) {
          nextReview = omitProfileReviewField(nextReview, "gpa");
        }
      }

      setDocumentReviews(nextReview.items.length ? { transcript: nextReview } : {});
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
      const userPatch = { ...review.userPatch };
      if (hasProfileGpaValue(latestProfileGpaRef.current)) {
        delete userPatch.gpa;
      }

      if (Object.keys(userPatch).length) {
        if (userPatch.gpa) {
          latestProfileGpaRef.current = userPatch.gpa;
        }
        setEditData((prev) => ({ ...prev, ...userPatch }));
        await updateUser(userPatch);
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
      const syncedCompletedCourseCount = await syncUploadedTranscriptToPlanner(uploaded);
      await analyzeUploadedDocument(asset, {
        omitCompletedCoursesReview: syncedCompletedCourseCount > 0,
      });
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
    <View
      className="bg-emerald-500/5 py-5 border-b border-emerald-500/20"
      style={{ paddingHorizontal: profileContentPadding }}
    >
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
          className={`${guestCtaCardClass} rounded-xl p-5 mb-4`}
          style={[
            guestCtaCardStyle,
            {
              flexDirection: isWideLayout ? "row" : "column",
              alignItems: isWideLayout ? "center" : "stretch",
              justifyContent: "space-between",
              gap: 12,
            },
          ]}
        >
          <View style={{ flex: isWideLayout ? 1 : undefined, paddingRight: isWideLayout ? 12 : 0 }}>
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="stars" size={20} color={guestCtaIconColor} />
              <Text className={`${guestCtaTextClass} font-bold text-base ml-2`}>{t("profile.createAccount")}</Text>
            </View>
            <Text className={`${guestCtaBodyClass} text-sm`}>{t("profile.saveDataMessage")}</Text>
          </View>
          <MaterialIcons
            name="arrow-forward"
            size={24}
            color={guestCtaIconColor}
            style={isWideLayout ? undefined : { alignSelf: "flex-end" }}
          />
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
          onSelectOpenChange={(open) => {
            setIsMajorDropdownOpen(open);
            if (open) setIsStateDropdownOpen(false);
          }}
          searchPlaceholder="Search Green River majors"
          placeholderColor={placeholderColor}
          dropdownBackgroundColor={dropdownSurfaceColor}
          overlayStrategy="inline-isolated"
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
        />
      </View>

      <View style={stateFieldOverlayStyle}>
        <ProfileField
          {...responsiveFieldSectionSpacingProps}
          type="select"
          icon="place"
          label={t("profile.state")}
          value={formatProfileStateDisplayValue(user?.state)}
          isEditing={isEditing}
          editValue={editData.state}
          displayEditValue={formatProfileStateDisplayValue(editData.state)}
          selectedOptionId={resolveProfileStateName(editData.state)}
          options={profileStateOptions}
          onSelect={(value) => setEditData((prev) => ({ ...prev, state: value }))}
          selectOpen={isStateDropdownOpen}
          onSelectOpenChange={(open) => {
            setIsStateDropdownOpen(open);
            if (open) setIsMajorDropdownOpen(false);
          }}
          searchPlaceholder="Search states"
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

  const renderQuestionnaireCard = ({
    compact = false,
    className = "",
  }: {
    compact?: boolean;
    className?: string;
  } = {}) => (
    <AnimatedCardPressable
      onPress={openQuestionnairePage}
      accessibilityRole="button"
      accessibilityLabel={t("profile.questionnaire")}
      className={`rounded-2xl border ${compact ? "px-5 py-4" : "px-5 py-5"} ${className}`}
      style={{
        backgroundColor: isDark
          ? "rgba(16,185,129,0.08)"
          : isGreen
            ? "rgba(16,185,129,0.12)"
            : "rgba(16,185,129,0.06)",
        borderColor: "rgba(16,185,129,0.18)",
      }}
    >
      {compact ? (
        <View className="flex-row items-center min-w-0">
          <View className="w-11 h-11 rounded-full bg-emerald-500/10 items-center justify-center mr-4">
            <MaterialIcons name="assignment" size={20} color="#008f4e" />
          </View>

          <View className="flex-1 min-w-0">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className={`${textClass} text-base font-semibold`} numberOfLines={1}>
                {t("profile.questionnaire")}
              </Text>
              <View className="bg-emerald-500/10 rounded-full px-2.5 py-1 border border-emerald-500/15">
                <Text className="text-emerald-500 text-xs font-semibold">
                  {questionnaireCompletionLabel}
                </Text>
              </View>
            </View>

            {!hasQuestionnaireData ? (
              <Text className={`${secondaryTextClass} text-xs mt-1`} numberOfLines={1}>
                {t("profile.questionnairePrompt")}
              </Text>
            ) : null}
          </View>

          <View className="flex-row items-center ml-4">
            <Text className="text-emerald-500 text-sm font-semibold">
              {questionnaireActionLabel}
            </Text>
            <MaterialIcons name="chevron-right" size={20} color="#008f4e" />
          </View>
        </View>
      ) : (
        <View className="flex-row items-start min-w-0">
          <MaterialIcons name="assignment" size={20} color="#008f4e" />
          <View className="flex-1 ml-3 min-w-0">
            <View
              style={{
                flexDirection: stackProfileActionButtons ? "column" : "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: stackProfileActionButtons ? 8 : 12,
              }}
            >
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
      )}
    </AnimatedCardPressable>
  );

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
                AsyncStorage.setItem(STORAGE_KEYS.guestProfileShow, "true").catch(() => {});
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

