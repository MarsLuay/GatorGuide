import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";

import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { ROUTES } from "@/constants/routes";
import { StateCard } from "@/components/ui/StateCard";
import {
  getTransferPlannerMajorsForCampus,
  getTransferPlannerTrack,
  TRANSFER_PLANNER_CAMPUSES,
  type TransferPlannerCampusId,
  type TransferPlannerLink,
} from "@/constants/transfer-planner-data";
import { useAppData } from "@/hooks/use-app-data";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { errorLoggingService, transcriptPlannerDebugService } from "@/services";
import { storageService, type UploadedFile } from "@/services/storage.service";
import {
  buildSuggestedQuarterPlan,
  buildRequirementStatuses,
  buildTrackUsageSummary,
  countCompletedRequirements,
  parseCompletedTranscriptCourses,
  type SuggestedQuarterPlan,
  type TrackUsageSummary,
  type TranscriptCourseEntry,
  type TransferRequirementStatus,
} from "@/services/transfer-planner.service";
import { transcriptPdfService } from "@/services/transcript-pdf.service";

const CTCLINK_UNOFFICIAL_TRANSCRIPT_URL =
  "https://csprd.ctclink.us/psp/csprd/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSS_TSRQST_UNOFF.GBL?pts_Portal=EMPLOYEE&pts_PortalHostNode=SA&pts_Market=GBL";

const TRANSCRIPT_SOURCE_FIELD = "transferPlannerTranscriptSource";
const TRANSCRIPT_UPLOADED_AT_FIELD = "transferPlannerTranscriptUploadedAt";

type TranscriptDocument = UploadedFile;

function formatCourseList(items: string[]) {
  return items.join(" | ");
}

function dedupeLinks(links: TransferPlannerLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

function buildFriendlyTranscriptError() {
  return "We couldn't read past classes from this unofficial transcript yet. Upload the PDF directly from ctcLink using the link below.";
}

function getReadableTranscriptFileName(document: TranscriptDocument | null) {
  const rawName = String(document?.name ?? "").trim();
  if (
    rawName &&
    rawName.length <= 180 &&
    !rawName.startsWith("data:") &&
    !rawName.startsWith("blob:") &&
    !rawName.includes("base64,")
  ) {
    return rawName;
  }

  const rawUrl = String(document?.url ?? "").trim();
  if (rawUrl && !rawUrl.startsWith("data:") && !rawUrl.startsWith("blob:")) {
    const withoutQuery = rawUrl.split(/[?#]/)[0] ?? "";
    const lastSegment = withoutQuery.split("/").pop() ?? "";
    try {
      const decoded = decodeURIComponent(lastSegment).trim();
      if (decoded && decoded.length <= 180) {
        return decoded;
      }
    } catch {
      if (lastSegment.trim() && lastSegment.trim().length <= 180) {
        return lastSegment.trim();
      }
    }
  }

  return "unofficial-transcript.pdf";
}

function getTranscriptUrlKind(url: string | null | undefined) {
  const raw = String(url ?? "").trim();
  if (!raw) return "missing";
  if (raw.startsWith("data:")) return "data-url";
  if (raw.startsWith("blob:")) return "blob-url";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return "remote-url";
  if (raw.startsWith("file://")) return "file-url";
  if (/^[A-Za-z]:[\\/]/.test(raw)) return "windows-local-path";
  if (raw.startsWith("/")) return "local-path";
  return "other";
}

function buildTranscriptDebugSnapshot({
  phase,
  document,
  transcriptSourceKey,
  storedTranscriptSource,
  completedCoursesBeforeCount,
  questionnaireCompletedCourseCount,
  parsedCourseCount,
  parsedCourseCodesPreview,
  error,
}: {
  phase: "analysis-start" | "analysis-success" | "analysis-failure" | "upload-failure";
  document: TranscriptDocument;
  transcriptSourceKey: string;
  storedTranscriptSource: string;
  completedCoursesBeforeCount: number;
  questionnaireCompletedCourseCount: number;
  parsedCourseCount: number | null;
  parsedCourseCodesPreview: string[];
  error: unknown;
}) {
  const normalizedError =
    error instanceof Error
      ? {
          name: error.name || "Error",
          message: error.message || "Unexpected transcript error",
          code: String((error as Error & { code?: unknown }).code ?? "").trim() || null,
        }
      : error
        ? {
            name: "Error",
            message: String((error as { message?: unknown })?.message ?? error),
            code: String((error as { code?: unknown })?.code ?? "").trim() || null,
          }
        : null;

  return {
    timestamp: new Date().toISOString(),
    phase,
    document: {
      name: document.name ?? null,
      displayName: getReadableTranscriptFileName(document),
      urlKind: getTranscriptUrlKind(document.url),
      urlLength: String(document.url ?? "").length,
      mimeType: document.mimeType ?? null,
      sizeBytes: document.sizeBytes ?? null,
      uploadedAt: document.uploadedAt || null,
    },
    transcriptSourceKey: transcriptSourceKey || null,
    storedTranscriptSource: storedTranscriptSource || null,
    completedCoursesBeforeCount,
    questionnaireCompletedCourseCount,
    parsedCourseCount,
    parsedCourseCodesPreview,
    error: normalizedError,
  };
}

async function openExternalLink(url: string) {
  const safeUrl =
    url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
  try {
    const canOpen = await Linking.canOpenURL(safeUrl);
    if (!canOpen) {
      Alert.alert("Link unavailable", "This link could not be opened on this device.");
      return;
    }
    await Linking.openURL(safeUrl);
  } catch {
    Alert.alert("Link unavailable", "This link could not be opened on this device.");
  }
}

function SelectorCard({
  label,
  value,
  helper,
  open,
  onToggle,
  options,
  onSelect,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
}: {
  label: string;
  value: string;
  helper: string;
  open: boolean;
  onToggle: () => void;
  options: { id: string; label: string; description?: string }[];
  onSelect: (id: string) => void;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
}) {
  return (
    <View className={`${cardClass} border rounded-[28px] p-5`}>
      <Text className={`${textClass} text-base font-semibold`}>{label}</Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>{helper}</Text>

      <Pressable
        onPress={onToggle}
        className={`mt-4 border ${borderClass} rounded-2xl px-4 py-4 flex-row items-center justify-between`}
      >
        <View className="flex-1 min-w-0 pr-3">
          <Text className={`${textClass} font-semibold`} numberOfLines={1}>
            {value}
          </Text>
        </View>
        <MaterialIcons
          name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
          size={22}
          color="#008f4e"
        />
      </Pressable>

      {open ? (
        <View className="gap-3 mt-3">
          {options.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => onSelect(option.id)}
              className={`border ${borderClass} rounded-2xl px-4 py-4`}
            >
              <Text className={`${textClass} font-semibold`}>{option.label}</Text>
              {option.description ? (
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  {option.description}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TranscriptSummaryCard({
  transcriptDocument,
  completedCourses,
  isAnalyzing,
  errorMessage,
  onUpload,
  onOpenTranscriptLink,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
}: {
  transcriptDocument: TranscriptDocument | null;
  completedCourses: TranscriptCourseEntry[];
  isAnalyzing: boolean;
  errorMessage: string | null;
  onUpload: () => void;
  onOpenTranscriptLink: () => void;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
}) {
  if (!transcriptDocument) {
    return (
      <View className={`${cardClass} border rounded-[28px] p-5`}>
        <View className="flex-row items-start">
          <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
            <Ionicons name="document-text-outline" size={20} color="#008f4e" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>
              Upload your unofficial transcript
            </Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              This planner uses your past completed classes from the unofficial transcript PDF. It does not need current in-progress classes.
            </Text>
          </View>
        </View>

        <View className="gap-3 mt-4">
          <Pressable
            onPress={onUpload}
            className="px-4 py-3 rounded-2xl bg-emerald-500 border border-emerald-500 items-center"
          >
            <Text className="text-white font-medium">Upload unofficial transcript</Text>
          </Pressable>
          <Pressable
            onPress={onOpenTranscriptLink}
            className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 items-center"
          >
            <Text className="text-emerald-500 font-medium">Get transcript in ctcLink</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className={`${cardClass} border rounded-[28px] p-5`}>
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1 min-w-0">
          <Text className={`${textClass} text-lg font-semibold`}>
            Transcript-based course plan
          </Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            The planner is reading past completed classes from your unofficial transcript so it can mark what is already done.
          </Text>
        </View>
      </View>

      <Pressable onPress={onUpload} className="self-start mt-3">
        <Text className="text-emerald-500 text-sm font-medium">Update transcript</Text>
      </Pressable>

      <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
        <Text className={`${textClass} font-semibold`} numberOfLines={1}>
          {getReadableTranscriptFileName(transcriptDocument)}
        </Text>
        <Text className={`${secondaryTextClass} text-sm mt-1`}>
          {isAnalyzing
            ? "Reading your past classes from the PDF now."
            : completedCourses.length
              ? `${completedCourses.length} past classes found from your transcript.`
              : "Transcript on file. We still need to read the past classes from it."}
        </Text>
      </View>

      {isAnalyzing ? (
        <View className="flex-row items-center mt-4">
          <ActivityIndicator color="#008f4e" />
          <Text className={`${secondaryTextClass} text-sm ml-3`}>
            Pulling completed classes from your unofficial transcript...
          </Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View className="mt-4 px-4 py-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <Text className="text-amber-500 font-semibold">Transcript needs another try</Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>{errorMessage}</Text>
          <Pressable
            onPress={() => void openExternalLink(CTCLINK_UNOFFICIAL_TRANSCRIPT_URL)}
            className="self-start mt-3"
          >
            <Text className="text-emerald-500 font-medium">Open unofficial transcript in ctcLink</Text>
          </Pressable>
        </View>
      ) : null}

      {completedCourses.length ? (
        <View className="mt-4">
          <Text className={`${textClass} font-semibold`}>Past classes found</Text>
          <View className="flex-row flex-wrap gap-2 mt-3">
            {completedCourses.map((course) => (
              <View
                key={course.code}
                className="px-3 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20"
              >
                <Text className="text-emerald-500 text-xs font-semibold">{course.code}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function RequirementSection({
  title,
  subtitle,
  statuses,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
}: {
  title: string;
  subtitle: string;
  statuses: TransferRequirementStatus[];
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
}) {
  if (!statuses.length) return null;

  return (
    <View className={`${cardClass} border rounded-[28px] p-5`}>
      <Text className={`${textClass} text-lg font-semibold`}>{title}</Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>{subtitle}</Text>

      <View className="gap-3 mt-4">
        {statuses.map((status) => (
          <View
            key={status.item.id}
            className={`${status.matched ? "bg-emerald-500/8 border-emerald-500/25" : ""} border ${borderClass} rounded-2xl px-4 py-4 flex-row items-start`}
          >
            <View className="mt-0.5">
              <Ionicons
                name={status.matched ? "checkmark-circle" : "ellipse-outline"}
                size={20}
                color={status.matched ? "#008f4e" : "#9CA3AF"}
              />
            </View>

            <View className="flex-1 ml-3 min-w-0">
              <Text className={`${textClass} font-semibold`}>{status.item.title}</Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                Best Green River class match: {formatCourseList(status.item.grcCourses)}
              </Text>
              <Text
                className={`${status.matched ? "text-emerald-500" : secondaryTextClass} text-sm mt-2`}
              >
                {status.matched
                  ? `Already found in your transcript: ${formatCourseList(
                      status.matchedCourses.map((course) => course.code)
                    )}`
                  : "Not found in your transcript yet."}
              </Text>
              {status.item.note ? (
                <Text className={`${secondaryTextClass} text-xs mt-2`}>{status.item.note}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function TrackUsageCard({
  trackCode,
  trackTitle,
  trackSummary,
  financialAidNote,
  usageSummary,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
}: {
  trackCode: string | null;
  trackTitle: string;
  trackSummary: string;
  financialAidNote: string;
  usageSummary: TrackUsageSummary | null;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
}) {
  return (
    <View className={`${cardClass} border rounded-[28px] p-5`}>
      <Text className={`${textClass} text-lg font-semibold`}>Best Green River path</Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>
        This tells the student which Green River associate path best supports the UW bachelor&apos;s they chose.
      </Text>

      <View className={`mt-4 border ${borderClass} rounded-2xl px-4 py-4`}>
        <Text className={`${textClass} font-semibold`}>
          {trackCode ? `${trackCode} | ${trackTitle}` : trackTitle}
        </Text>
        <Text className={`${secondaryTextClass} text-sm mt-2`}>{trackSummary}</Text>
        <Text className={`${secondaryTextClass} text-sm mt-3`}>{financialAidNote}</Text>
      </View>

      {usageSummary ? (
        <View className="mt-4 gap-3">
          <View className="px-4 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <Text className="text-emerald-500 font-semibold">
              {usageSummary.directUseCount} of {usageSummary.specificCourseCount} specific track classes feed directly into this UW bachelor&apos;s plan
            </Text>
            <Text className={`${secondaryTextClass} text-sm mt-2`}>
              This count includes the UW prerequisites and lower-division classes the planner is explicitly trying to keep at Green River.
            </Text>
          </View>

          {usageSummary.extraSpecificEntries.length ? (
            <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
              <Text className={`${textClass} font-semibold`}>
                Classes in the associate path that are not direct must-haves for this UW bachelor&apos;s path
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-2`}>
                {formatCourseList(usageSummary.extraSpecificEntries)}
              </Text>
            </View>
          ) : null}

          {usageSummary.generalEdEntryCount ? (
            <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
              <Text className={`${textClass} font-semibold`}>
                General-ed and elective slots
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-2`}>
                {usageSummary.generalEdEntries.join(" | ")}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SuggestedScheduleCard({
  quarters,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
}: {
  quarters: SuggestedQuarterPlan[];
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
}) {
  return (
    <View className={`${cardClass} border rounded-[28px] p-5`}>
      <Text className={`${textClass} text-lg font-semibold`}>Suggested GRC quarter plan</Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>
        This is the ideal next-step schedule based on what is still left for UW. It prefers one core STEM class plus two lighter or general-ed classes each quarter whenever possible.
      </Text>

      <View className="gap-4 mt-4">
        {quarters.map((quarter) => (
          <View key={quarter.label} className={`border ${borderClass} rounded-2xl px-4 py-4`}>
            <Text className={`${textClass} font-semibold`}>{quarter.label}</Text>
            <View className="gap-2 mt-3">
              {quarter.courses.length ? (
                quarter.courses.map((course) => (
                  <View
                    key={`${quarter.label}-${course.label}`}
                    className={`px-3 py-3 rounded-2xl ${course.type === "core" ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-white/5 border border-white/10"}`}
                  >
                    <Text
                      className={`${course.type === "core" ? "text-emerald-500" : textClass} text-sm font-medium`}
                    >
                      {course.label}
                    </Text>
                  </View>
                ))
              ) : (
                <Text className={`${secondaryTextClass} text-sm`}>
                  Nothing else is required in this draft quarter.
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function TransferPlannerPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { t } = useTranslation();
  const styles = useThemeStyles();
  const { width } = useWindowDimensions();
  const { state, updateUser, setQuestionnaireAnswers } = useAppData();
  const { getScrollContentPadding } = useResponsiveLayout();

  const [selectedCampusId, setSelectedCampusId] =
    useState<TransferPlannerCampusId>("uw-seattle");
  const [selectedMajorId, setSelectedMajorId] = useState<string>(
    getTransferPlannerMajorsForCampus("uw-seattle")[0]?.id ?? ""
  );
  const [openSelector, setOpenSelector] = useState<"campus" | "major" | null>(null);
  const [transcriptDocument, setTranscriptDocument] = useState<TranscriptDocument | null>(null);
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const transcriptAnalysisAttemptsRef = useRef<Set<string>>(new Set());

  const { textClass, secondaryTextClass, cardBgClass, inactiveButtonClass, borderClass } = styles;
  const isDesktop = width >= 1180;
  const isTablet = width >= 768;
  const shellMaxWidth = isDesktop ? 1280 : isTablet ? 980 : 760;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : 20;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 16,
  });

  const user = state.user;
  const completedCourses = useMemo(
    () => parseCompletedTranscriptCourses(state.questionnaireAnswers?.completedCourses),
    [state.questionnaireAnswers?.completedCourses]
  );
  const storedTranscriptSource = String(
    state.questionnaireAnswers?.[TRANSCRIPT_SOURCE_FIELD] ?? ""
  ).trim();

  const campus = useMemo(
    () =>
      TRANSFER_PLANNER_CAMPUSES.find((entry) => entry.id === selectedCampusId) ??
      TRANSFER_PLANNER_CAMPUSES[0],
    [selectedCampusId]
  );
  const campusMajors = useMemo(
    () => getTransferPlannerMajorsForCampus(selectedCampusId),
    [selectedCampusId]
  );
  const plan = useMemo(
    () => campusMajors.find((entry) => entry.id === selectedMajorId) ?? campusMajors[0] ?? null,
    [campusMajors, selectedMajorId]
  );
  const track = useMemo(() => getTransferPlannerTrack(plan?.bestTrackId ?? null), [plan]);
  const transcriptSourceKey = transcriptDocument
    ? `${transcriptDocument.url}|${transcriptDocument.uploadedAt}`
    : "";
  const autoMajorSelectionRef = useRef(false);
  const returnTo = useMemo(() => {
    const raw = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
    const normalized = String(raw ?? "").trim();
    return normalized.startsWith("/") ? normalized : null;
  }, [params.returnTo]);
  const backLabel = useMemo(() => {
    const translated = t("general.back");
    return translated && translated !== "general.back" ? translated : "Back";
  }, [t]);

  const handleGoBack = useCallback(() => {
    if (returnTo) {
      router.replace(returnTo as never);
      return;
    }

    if (typeof window !== "undefined") {
      if (window.history.length > 1) {
        router.back();
        return;
      }

      router.replace(ROUTES.tabsResources);
      return;
    }

    router.back();
  }, [returnTo, router]);

  useEffect(() => {
    const nextFirstMajorId = campusMajors[0]?.id ?? "";
    if (!campusMajors.some((entry) => entry.id === selectedMajorId)) {
      setSelectedMajorId(nextFirstMajorId);
    }
  }, [campusMajors, selectedMajorId]);

  useEffect(() => {
    if (autoMajorSelectionRef.current) return;
    const rawMajor = String(user?.major ?? "").trim().toLowerCase();
    if (!rawMajor) return;

    const matchedMajor = campusMajors.find((entry) =>
      entry.title.toLowerCase().includes(rawMajor) ||
      rawMajor.includes(entry.shortTitle.toLowerCase()) ||
      rawMajor.includes(entry.title.toLowerCase())
    );

    if (!matchedMajor) return;
    autoMajorSelectionRef.current = true;
    setSelectedMajorId(matchedMajor.id);
  }, [campusMajors, user?.major]);

  useEffect(() => {
    let active = true;

    if (!user?.uid || !user?.transcript) {
      setTranscriptDocument(null);
      return () => {
        active = false;
      };
    }

    const transcriptUrl = user.transcript;

    void (async () => {
      const stored = await storageService.getTranscript(user.uid).catch(() => null);
      const fallbackName = getReadableTranscriptFileName({
        name: "",
        url: transcriptUrl,
        uploadedAt: "",
        mimeType: "application/pdf",
        sizeBytes: null,
      });
      const nextDocument: TranscriptDocument =
        stored && stored.url
          ? stored
          : {
              name: fallbackName,
              url: transcriptUrl,
              uploadedAt: "",
              mimeType: "application/pdf",
              sizeBytes: null,
            };

      if (!active) return;
      setTranscriptDocument(nextDocument);
    })();

    return () => {
      active = false;
    };
  }, [user?.uid, user?.transcript]);

  const analyzeTranscript = useCallback(
    async (document: TranscriptDocument) => {
      setIsAnalyzingTranscript(true);
      setTranscriptError(null);
      const debugBase = {
        document,
        transcriptSourceKey:
          document.url || document.uploadedAt ? `${document.url}|${document.uploadedAt}` : "",
        storedTranscriptSource,
        completedCoursesBeforeCount: completedCourses.length,
        questionnaireCompletedCourseCount: Array.isArray(state.questionnaireAnswers?.completedCourses)
          ? state.questionnaireAnswers.completedCourses.length
          : 0,
      };

      transcriptPlannerDebugService.setLastTranscriptPlannerDebug(
        buildTranscriptDebugSnapshot({
          ...debugBase,
          phase: "analysis-start",
          parsedCourseCount: null,
          parsedCourseCodesPreview: [],
          error: null,
        })
      );

      try {
        const parsedCourses = await transcriptPdfService.extractCompletedCoursesFromPdf(
          document.url
        );

        if (!parsedCourses.length) throw new Error("No completed courses extracted.");

        transcriptPlannerDebugService.setLastTranscriptPlannerDebug(
          buildTranscriptDebugSnapshot({
            ...debugBase,
            phase: "analysis-success",
            parsedCourseCount: parsedCourses.length,
            parsedCourseCodesPreview: parsedCourses
              .slice(0, 20)
              .map((course) => course.code),
            error: null,
          })
        );

        await setQuestionnaireAnswers({
          ...state.questionnaireAnswers,
          completedCourses: parsedCourses.map((course) => course.label),
          [TRANSCRIPT_SOURCE_FIELD]: document.url,
          [TRANSCRIPT_UPLOADED_AT_FIELD]:
            document.uploadedAt || new Date().toISOString(),
        });
      } catch (error) {
        const failureSnapshot = buildTranscriptDebugSnapshot({
          ...debugBase,
          phase: "analysis-failure",
          parsedCourseCount: null,
          parsedCourseCodesPreview: [],
          error,
        });

        transcriptPlannerDebugService.setLastTranscriptPlannerDebug(failureSnapshot);
        void errorLoggingService.captureException(error, {
          category: "storage",
          operation: "transfer-planner-analyze-transcript",
          severity: "warn",
          handled: true,
          source: "TransferPlannerPage",
          screen: "TransferPlannerPage",
          route: "/transfer-planner",
          tags: ["transcript", "transfer-planner", failureSnapshot.document.urlKind],
          metadata: failureSnapshot,
        });
        setTranscriptError(buildFriendlyTranscriptError());
      } finally {
        setIsAnalyzingTranscript(false);
      }
    },
    [
      completedCourses.length,
      setQuestionnaireAnswers,
      state.questionnaireAnswers,
      storedTranscriptSource,
    ]
  );

  useEffect(() => {
    if (!transcriptDocument) return;
    if (completedCourses.length && storedTranscriptSource === transcriptDocument.url) return;
    if (!transcriptSourceKey) return;
    if (transcriptAnalysisAttemptsRef.current.has(transcriptSourceKey)) return;

    transcriptAnalysisAttemptsRef.current.add(transcriptSourceKey);
    void analyzeTranscript(transcriptDocument);
  }, [
    analyzeTranscript,
    completedCourses.length,
    storedTranscriptSource,
    transcriptDocument,
    transcriptSourceKey,
  ]);

  const handlePickTranscript = useCallback(async () => {
    if (!user?.uid) {
      Alert.alert("Profile needed", "Open the app as a guest or signed-in student first.");
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      const uploaded = await storageService.uploadTranscript(user.uid, asset.uri, {
        fileName: asset.name,
        mimeType: asset.mimeType,
        sizeBytes: asset.size,
      });
      await updateUser({ transcript: uploaded.url });
      setTranscriptDocument(uploaded);
      transcriptAnalysisAttemptsRef.current.delete(
        `${uploaded.url}|${uploaded.uploadedAt}`
      );
      await analyzeTranscript(uploaded);
    } catch (error) {
      transcriptPlannerDebugService.setLastTranscriptPlannerDebug(
        buildTranscriptDebugSnapshot({
          phase: "upload-failure",
          document: {
            name: "unofficial-transcript.pdf",
            url: "",
            uploadedAt: "",
            mimeType: "application/pdf",
            sizeBytes: null,
          },
          transcriptSourceKey: "",
          storedTranscriptSource,
          completedCoursesBeforeCount: completedCourses.length,
          questionnaireCompletedCourseCount: Array.isArray(state.questionnaireAnswers?.completedCourses)
            ? state.questionnaireAnswers.completedCourses.length
            : 0,
          parsedCourseCount: null,
          parsedCourseCodesPreview: [],
          error,
        })
      );
      void errorLoggingService.captureException(error, {
        category: "upload",
        operation: "transfer-planner-upload-transcript",
        severity: "warn",
        handled: true,
        source: "TransferPlannerPage",
        screen: "TransferPlannerPage",
        route: "/transfer-planner",
        tags: ["transcript", "transfer-planner", "upload"],
      });
      Alert.alert("Transcript upload failed", "We couldn't use that transcript yet.", [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Open ctcLink",
          onPress: () => {
            void openExternalLink(CTCLINK_UNOFFICIAL_TRANSCRIPT_URL);
          },
        },
      ]);
    }
  }, [
    analyzeTranscript,
    completedCourses.length,
    state.questionnaireAnswers?.completedCourses,
    storedTranscriptSource,
    updateUser,
    user?.uid,
  ]);

  const applicationStatuses = useMemo(
    () =>
      plan ? buildRequirementStatuses(plan.applicationChecklist, completedCourses) : [],
    [completedCourses, plan]
  );
  const beforeEnrollmentStatuses = useMemo(
    () =>
      plan ? buildRequirementStatuses(plan.beforeEnrollmentChecklist, completedCourses) : [],
    [completedCourses, plan]
  );
  const stayAtGrcStatuses = useMemo(
    () =>
      plan ? buildRequirementStatuses(plan.stayAtGrcChecklist, completedCourses) : [],
    [completedCourses, plan]
  );
  const totalRequirementCount =
    applicationStatuses.length + beforeEnrollmentStatuses.length + stayAtGrcStatuses.length;
  const completedRequirementCount =
    countCompletedRequirements(applicationStatuses) +
    countCompletedRequirements(beforeEnrollmentStatuses) +
    countCompletedRequirements(stayAtGrcStatuses);
  const trackUsageSummary = useMemo(
    () => (plan ? buildTrackUsageSummary(track, plan) : null),
    [plan, track]
  );
  const suggestedQuarterPlan = useMemo(
    () =>
      buildSuggestedQuarterPlan({
        applicationStatuses,
        beforeEnrollmentStatuses,
        stayAtGrcStatuses,
        track,
      }),
    [applicationStatuses, beforeEnrollmentStatuses, stayAtGrcStatuses, track]
  );
  const visibleOfficialLinks = useMemo(
    () => dedupeLinks([...(plan?.officialLinks ?? []), ...campus.officialLinks]),
    [campus.officialLinks, plan?.officialLinks]
  );

  const campusOptions = useMemo(
    () =>
      TRANSFER_PLANNER_CAMPUSES.map((entry) => ({
        id: entry.id,
        label: entry.title,
      })),
    []
  );
  const majorOptions = useMemo(
    () =>
      campusMajors.map((entry) => ({
        id: entry.id,
        label: entry.title,
      })),
    [campusMajors]
  );

  if (!user) {
    return (
      <ScreenBackground includeTopInset includeBottomInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <StateCard
            variant="empty"
            title="Open this as a student profile first"
            message="Start as a guest or sign in, then come back here to build a transcript-based transfer course plan."
          />
        </View>
      </ScreenBackground>
    );
  }

  if (!plan) {
    return (
      <ScreenBackground includeTopInset includeBottomInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <StateCard
            variant="empty"
            title="No planner data yet"
            message="There is not a course plan for this campus yet."
          />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground includeTopInset includeBottomInset={false}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: scrollContentPadding.paddingBottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            alignSelf: "center",
            width: "100%",
            maxWidth: shellMaxWidth,
            paddingHorizontal: shellHorizontalPadding,
            paddingTop: scrollContentPadding.paddingTop + 12,
            gap: 24,
          }}
        >
          <View className="gap-4">
            <Pressable
              onPress={handleGoBack}
              className="flex-row items-center self-start"
            >
              <MaterialIcons
                name="arrow-back"
                size={20}
                color="#1f8a5d"
              />
              <Text className={`${secondaryTextClass} ml-2`}>
                {backLabel}
              </Text>
            </Pressable>

            <View className="flex-row items-start">
              <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
                <Ionicons name="trail-sign-outline" size={22} color="#008f4e" />
              </View>
              <View className="flex-1">
                <Text className={`${textClass} text-2xl font-semibold`}>
                  {"GRC -> UW Course Planner"}
                </Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  Upload your unofficial transcript, pick a UW campus and major, and the planner will show which Green River classes already count, which ones still matter before transfer, and how much of the Green River associate path is actually used by the UW bachelor&apos;s.
                </Text>
              </View>
            </View>

            <View className="px-4 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <Text className="text-emerald-500 font-semibold">
                This planner uses past completed classes from the unofficial transcript.
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                Current or in-progress classes are intentionally ignored here because unofficial transcripts usually only show finished coursework.
              </Text>
            </View>
          </View>

          <TranscriptSummaryCard
            transcriptDocument={transcriptDocument}
            completedCourses={completedCourses}
            isAnalyzing={isAnalyzingTranscript}
            errorMessage={transcriptError}
            onUpload={handlePickTranscript}
            onOpenTranscriptLink={() => {
              void openExternalLink(CTCLINK_UNOFFICIAL_TRANSCRIPT_URL);
            }}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            cardClass={cardBgClass}
            borderClass={borderClass}
          />

          <View
            style={isDesktop ? { flexDirection: "row", alignItems: "flex-start", gap: 16 } : { gap: 16 }}
          >
            <View style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}>
              <SelectorCard
                label="Campus"
                value={campus.title}
                helper="The default is UW Seattle. Switch campuses here if the student is targeting Bothell or Tacoma."
                open={openSelector === "campus"}
                onToggle={() =>
                  setOpenSelector((current) => (current === "campus" ? null : "campus"))
                }
                options={campusOptions}
                onSelect={(id) => {
                  setSelectedCampusId(id as TransferPlannerCampusId);
                  setOpenSelector(null);
                }}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                cardClass={cardBgClass}
                borderClass={borderClass}
              />
            </View>

            <View style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}>
              <SelectorCard
                label="Major"
                value={plan.title}
                helper="Pick the UW bachelor&apos;s degree you want the Green River course plan to match against."
                open={openSelector === "major"}
                onToggle={() =>
                  setOpenSelector((current) => (current === "major" ? null : "major"))
                }
                options={majorOptions}
                onSelect={(id) => {
                  setSelectedMajorId(id);
                  setOpenSelector(null);
                }}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                cardClass={cardBgClass}
                borderClass={borderClass}
              />
            </View>
          </View>

          <View
            style={isDesktop ? { flexDirection: "row", alignItems: "stretch", gap: 16 } : { gap: 16 }}
          >
            <View
              className={`${cardBgClass} border rounded-[28px] p-5`}
              style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}
            >
              <Text className={`${textClass} text-lg font-semibold`}>
                Your transcript progress
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                This is how many UW-aligned checklist items the planner can already confirm from your past Green River classes.
              </Text>

              <View className="mt-4 flex-row items-end justify-between gap-4">
                <View>
                  <Text className={`${textClass} text-3xl font-semibold`}>
                    {completedCourses.length ? `${completedRequirementCount}/${totalRequirementCount}` : "--"}
                  </Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>
                    planner items already covered
                  </Text>
                </View>
                <View className="px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <Text className="text-emerald-500 text-xs font-semibold">
                    {completedCourses.length
                      ? `${completedCourses.length} past classes found`
                      : "Waiting for transcript"}
                  </Text>
                </View>
              </View>

              {!completedCourses.length && transcriptDocument && !isAnalyzingTranscript ? (
                <Text className={`${secondaryTextClass} text-sm mt-4`}>
                  Once the planner reads your unofficial transcript, it will automatically mark matching classes as already done.
                </Text>
              ) : null}
            </View>

            <View
              className={`${cardBgClass} border rounded-[28px] p-5`}
              style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}
            >
              <Text className={`${textClass} text-lg font-semibold`}>
                What this UW plan uses
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                This helps students see that not every class in a Green River associate path is necessarily used by the UW bachelor&apos;s.
              </Text>

              {trackUsageSummary ? (
                <View className="mt-4">
                  <Text className={`${textClass} text-3xl font-semibold`}>
                    {trackUsageSummary.directUseCount}/{trackUsageSummary.specificCourseCount}
                  </Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>
                    specific Green River track classes directly support this UW bachelor&apos;s
                  </Text>
                  {trackUsageSummary.generalEdEntryCount ? (
                    <Text className={`${secondaryTextClass} text-sm mt-3`}>
                      Plus {trackUsageSummary.generalEdEntryCount} general-ed or elective slots in the associate path.
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text className={`${secondaryTextClass} text-sm mt-4`}>
                  This major uses a custom Green River plan instead of one stock associate template.
                </Text>
              )}
            </View>
          </View>

          <TrackUsageCard
            trackCode={track?.code ?? null}
            trackTitle={track?.title ?? "Custom Green River path"}
            trackSummary={plan.bestTrackSummary}
            financialAidNote={plan.financialAidNote}
            usageSummary={trackUsageSummary}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            cardClass={cardBgClass}
            borderClass={borderClass}
          />

          <RequirementSection
            title="Still needed before you apply"
            subtitle="These are the strongest UW-facing prerequisites the planner expects a student to finish first."
            statuses={applicationStatuses}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            cardClass={cardBgClass}
            borderClass={borderClass}
          />

          <RequirementSection
            title="Good to finish before UW starts"
            subtitle="These are the extra Green River classes that make the transfer cleaner or help the student start stronger after admission."
            statuses={beforeEnrollmentStatuses}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            cardClass={cardBgClass}
            borderClass={borderClass}
          />

          <RequirementSection
            title="Worth keeping at Green River"
            subtitle="These are the lower-division classes the planner still tries to keep at Green River because they are cleaner, cheaper, or easier to finish before transfer."
            statuses={stayAtGrcStatuses}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            cardClass={cardBgClass}
            borderClass={borderClass}
          />

          <SuggestedScheduleCard
            quarters={suggestedQuarterPlan}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            cardClass={cardBgClass}
            borderClass={borderClass}
          />

          <View className={`${cardBgClass} border rounded-[28px] p-5`}>
            <Text className={`${textClass} text-lg font-semibold`}>Official UW and Green River links</Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              Use these pages when the student wants to double-check the current campus materials before final registration.
            </Text>

            <View className="gap-3 mt-4">
              {visibleOfficialLinks.map((link) => (
                <Pressable
                  key={`${plan.id}-${link.url}`}
                  onPress={() => {
                    void openExternalLink(link.url);
                  }}
                  className={`border ${borderClass} rounded-2xl px-4 py-4 flex-row items-start ${inactiveButtonClass}`}
                >
                  <View className="w-9 h-9 rounded-full bg-emerald-500/10 items-center justify-center mr-3">
                    <Ionicons name="link-outline" size={18} color="#008f4e" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className={`${textClass} font-semibold`}>{link.label}</Text>
                    {link.note ? (
                      <Text className={`${secondaryTextClass} text-sm mt-1`}>{link.note}</Text>
                    ) : null}
                  </View>
                  <MaterialIcons name="open-in-new" size={18} color="#008f4e" />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
