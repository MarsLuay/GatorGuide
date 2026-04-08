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
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";

import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import {
  AnimatedCardPressable,
  AnimatedChipPressable,
  AnimatedIconPressable,
} from "@/components/ui/AnimatedPressables";
import { ROUTES } from "@/constants/routes";
import { StateCard } from "@/components/ui/StateCard";
import {
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerGrcCourseList,
  getTransferPlannerGrcCourseListGuidance,
  getTransferPlannerMajorsForCampus,
  getTransferPlannerPathwaysForPlan,
  getTransferPlannerTrack,
  resolveTransferPlannerMajorPlan,
  TRANSFER_PLANNER_CAMPUSES,
  type TransferPlannerCampusId,
  type TransferPlannerMajorPlan,
  type TransferPlannerMajorPathway,
  type TransferPlannerResolvedMajorPlan,
} from "@/constants/transfer-planner-source";
import { useAppData } from "@/hooks/use-app-data";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { errorLoggingService, transcriptPlannerDebugService } from "@/services";
import { storageService, type UploadedFile } from "@/services/storage/storage.service";
import {
  buildSuggestedQuarterPlan,
  buildRequirementStatuses,
  extractCourseCodes,
  parseCompletedTranscriptCourses,
  type SuggestedQuarterPlan,
  type TranscriptCourseEntry,
} from "@/services/planning/transfer-planner.service";
import { transcriptPdfService } from "@/services/documents/transcript-pdf.service";

const CTCLINK_UNOFFICIAL_TRANSCRIPT_URL =
  "https://csprd.ctclink.us/psp/csprd/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSS_TSRQST_UNOFF.GBL?pts_Portal=EMPLOYEE&pts_PortalHostNode=SA&pts_Market=GBL";

const TRANSCRIPT_COURSES_FIELD = "transferPlannerCompletedCourses";
const TRANSCRIPT_SOURCE_FIELD = "transferPlannerTranscriptSource";
const TRANSCRIPT_UPLOADED_AT_FIELD = "transferPlannerTranscriptUploadedAt";
const TRANSCRIPT_PARSER_VERSION_FIELD = "transferPlannerTranscriptParserVersion";
const CURRENT_PLANNED_COURSES_FIELD = "transferPlannerCurrentCoursesByPath";
const SELECTED_PATHWAY_FIELD = "transferPlannerSelectedPathwayByPlan";
const TRANSCRIPT_PARSER_VERSION = 2;

type TranscriptDocument = UploadedFile;

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

function buildParsedCourseAssignmentsPreview(courses: TranscriptCourseEntry[]) {
  return courses.slice(0, 24).map((course) => ({
    code: course.code,
    label: course.label,
    termLabel: course.termLabel ?? null,
    termStartDate: course.termStartDate ?? null,
  }));
}

function buildParsedQuarterBuckets(courses: TranscriptCourseEntry[]) {
  const grouped = new Map<
    string,
    {
      termLabel: string | null;
      termStartDate: string | null;
      courseCodes: string[];
    }
  >();

  for (const course of courses) {
    const termLabel = String(course.termLabel ?? "").trim() || null;
    const termStartDate = String(course.termStartDate ?? "").trim() || null;
    const groupKey = `${termStartDate ?? ""}|${termLabel ?? ""}`;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        termLabel,
        termStartDate,
        courseCodes: [],
      });
    }

    const bucket = grouped.get(groupKey);
    if (!bucket) continue;
    if (!bucket.courseCodes.includes(course.code)) {
      bucket.courseCodes.push(course.code);
    }
  }

  return [...grouped.values()]
    .sort((left, right) =>
      `${left.termStartDate ?? ""}|${left.termLabel ?? ""}`.localeCompare(
        `${right.termStartDate ?? ""}|${right.termLabel ?? ""}`
      )
    )
    .slice(0, 12);
}

function getPlannerPathKey(campusId: string, majorId: string, pathwayId?: string | null) {
  return `${String(campusId ?? "").trim()}::${String(majorId ?? "").trim()}::${String(
    pathwayId ?? "base"
  ).trim()}`;
}

function normalizePlannerCurrentCourseMap(rawValue: unknown) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {} as Record<string, string[]>;
  }

  const normalized: Record<string, string[]> = {};

  for (const [pathKey, value] of Object.entries(rawValue)) {
    if (!Array.isArray(value)) continue;
    const nextValues = Array.from(
      new Set(
        value
          .map((entry) => String(entry ?? "").trim())
          .filter(Boolean)
      )
    );
    if (nextValues.length) {
      normalized[pathKey] = nextValues;
    }
  }

  return normalized;
}

function normalizePlannerSelectedPathwayMap(rawValue: unknown) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {} as Record<string, string>;
  }

  const normalized: Record<string, string> = {};

  for (const [planId, value] of Object.entries(rawValue)) {
    const normalizedPlanId = String(planId ?? "").trim();
    const normalizedPathwayId = String(value ?? "").trim();
    if (!normalizedPlanId || !normalizedPathwayId) continue;
    normalized[normalizedPlanId] = normalizedPathwayId;
  }

  return normalized;
}

function getScheduleCampusLabel(campusLabel: string) {
  const trimmed = String(campusLabel ?? "").trim();
  if (!trimmed) return "UW";
  if (/^UW\s+/i.test(trimmed)) return trimmed;
  return `UW ${trimmed}`;
}

function buildTranscriptDebugSnapshot({
  phase,
  document,
  parserVersion,
  storedParserVersion,
  transcriptSourceKey,
  storedTranscriptSource,
  completedCoursesBeforeCount,
  questionnaireCompletedCourseCount,
  parsedCourseCount,
  parsedCourseCodesPreview,
  parsedCourseAssignmentsPreview,
  parsedQuarterBuckets,
  error,
}: {
  phase: "analysis-start" | "analysis-success" | "analysis-failure" | "upload-failure";
  document: TranscriptDocument;
  parserVersion: number;
  storedParserVersion: number | null;
  transcriptSourceKey: string;
  storedTranscriptSource: string;
  completedCoursesBeforeCount: number;
  questionnaireCompletedCourseCount: number;
  parsedCourseCount: number | null;
  parsedCourseCodesPreview: string[];
  parsedCourseAssignmentsPreview?: {
    code: string;
    label: string;
    termLabel: string | null;
    termStartDate: string | null;
  }[];
  parsedQuarterBuckets?: {
    termLabel: string | null;
    termStartDate: string | null;
    courseCodes: string[];
  }[];
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
    parserVersion,
    storedParserVersion,
    transcriptSourceKey: transcriptSourceKey || null,
    storedTranscriptSource: storedTranscriptSource || null,
    completedCoursesBeforeCount,
    questionnaireCompletedCourseCount,
    parsedCourseCount,
    parsedCourseCodesPreview,
    parsedCourseAssignmentsPreview: parsedCourseAssignmentsPreview ?? [],
    parsedQuarterBuckets: parsedQuarterBuckets ?? [],
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

function normalizeSelectorSearchValue(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function SelectorField({
  label,
  value,
  helper,
  open,
  onToggle,
  options,
  onSelect,
  searchable,
  searchPlaceholder,
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
  searchable?: boolean;
  searchPlaceholder?: string;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  const normalizedQuery = normalizeSelectorSearchValue(searchQuery);
  const normalizedSelectedValue = normalizeSelectorSearchValue(value);
  const effectiveQuery =
    searchable && open && normalizedQuery === normalizedSelectedValue
      ? ""
      : normalizedQuery;
  const filteredOptions = useMemo(() => {
    if (!searchable || !effectiveQuery) {
      return searchable ? options.slice(0, 12) : options;
    }

    const startsWithMatches: { id: string; label: string; description?: string }[] = [];
    const includesMatches: { id: string; label: string; description?: string }[] = [];

    for (const option of options) {
      const normalizedLabel = normalizeSelectorSearchValue(option.label);
      if (normalizedLabel.startsWith(effectiveQuery)) {
        startsWithMatches.push(option);
        continue;
      }
      if (normalizedLabel.includes(effectiveQuery)) {
        includesMatches.push(option);
      }
    }

    return [...startsWithMatches, ...includesMatches];
  }, [effectiveQuery, options, searchable]);

  return (
    <View>
      <Text className={`${textClass} text-base font-semibold`}>{label}</Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>{helper}</Text>

      {searchable ? (
        <View
          className={`mt-4 border ${borderClass} rounded-2xl px-4 py-2 flex-row items-center`}
        >
          <TextInput
            value={open ? searchQuery : value}
            onChangeText={(nextValue) => {
              if (!open) {
                onToggle();
              }
              setSearchQuery(nextValue);
            }}
            onFocus={() => {
              if (!open) {
                setSearchQuery(value);
                onToggle();
              } else if (!searchQuery) {
                setSearchQuery(value);
              }
            }}
            placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            selectTextOnFocus
            className={`${textClass} text-sm flex-1 min-w-0`}
          />
          <AnimatedIconPressable
            onPress={onToggle}
            className="ml-3"
            hitSlop={8}
          >
            <MaterialIcons
              name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
              size={22}
              color="#008f4e"
            />
          </AnimatedIconPressable>
        </View>
      ) : (
        <AnimatedCardPressable
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
        </AnimatedCardPressable>
      )}

      {open ? (
        <View className="gap-3 mt-3">
          {searchable && !effectiveQuery ? (
            <Text className={`${secondaryTextClass} text-xs`}>
              Edit the major field to search all majors. Showing the first 12 until you type.
            </Text>
          ) : null}

          {filteredOptions.map((option) => (
            <AnimatedCardPressable
              key={option.id}
              onPress={() => {
                setSearchQuery("");
                onSelect(option.id);
              }}
              className={`border ${borderClass} rounded-2xl px-4 py-4`}
            >
              <Text className={`${textClass} font-semibold`}>{option.label}</Text>
              {option.description ? (
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  {option.description}
                </Text>
              ) : null}
            </AnimatedCardPressable>
          ))}

          {searchable && effectiveQuery && !filteredOptions.length ? (
            <Text className={`${secondaryTextClass} text-sm`}>
              No majors match that search yet.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function TranscriptSummaryCard({
  transcriptDocument,
  isAnalyzing,
  errorMessage,
  plan,
  pathwayOptions,
  selectedPathwayLabel,
  selectedCampusLabel,
  selectedMajorLabel,
  trackCode,
  trackTitle,
  trackSummary,
  financialAidNote,
  completedCourses,
  currentCourseLabels,
  openSelector,
  campusOptions,
  majorOptions,
  onToggleCampus,
  onToggleMajor,
  onSelectCampus,
  onSelectMajor,
  onSelectPathway,
  onUpload,
  onOpenTranscriptLink,
  isDesktop,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
}: {
  transcriptDocument: TranscriptDocument | null;
  isAnalyzing: boolean;
  errorMessage: string | null;
  plan: TransferPlannerResolvedMajorPlan;
  pathwayOptions: TransferPlannerMajorPathway[];
  selectedPathwayLabel: string | null;
  selectedCampusLabel: string;
  selectedMajorLabel: string;
  trackCode: string | null;
  trackTitle: string;
  trackSummary: string;
  financialAidNote: string;
  completedCourses: TranscriptCourseEntry[];
  currentCourseLabels: Set<string>;
  openSelector: "campus" | "major" | null;
  campusOptions: { id: string; label: string; description?: string }[];
  majorOptions: { id: string; label: string; description?: string }[];
  onToggleCampus: () => void;
  onToggleMajor: () => void;
  onSelectCampus: (id: string) => void;
  onSelectMajor: (id: string) => void;
  onSelectPathway: (pathwayId: string) => void;
  onUpload: () => void;
  onOpenTranscriptLink: () => void;
  isDesktop: boolean;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
}) {
  const [isPathwaySelectorOpen, setIsPathwaySelectorOpen] = useState(false);

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
          <AnimatedChipPressable
            onPress={onUpload}
            className="px-4 py-3 rounded-2xl bg-emerald-500 border border-emerald-500 items-center"
          >
            <Text className="text-white font-medium">Upload unofficial transcript</Text>
          </AnimatedChipPressable>
          <AnimatedChipPressable
            onPress={onOpenTranscriptLink}
            className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 items-center"
          >
            <Text className="text-emerald-500 font-medium">Get transcript in ctcLink</Text>
          </AnimatedChipPressable>
        </View>

      <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-5`}>
        <Text className={`${textClass} text-base font-semibold`}>
          Choose your UW path
          </Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            Set the campus and major you want this Green River plan to match against.
          </Text>

          <View
            className="mt-4"
            style={isDesktop ? { flexDirection: "row", alignItems: "flex-start", gap: 16 } : { gap: 16 }}
          >
            <View style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}>
              <SelectorField
                label="Campus"
                value={selectedCampusLabel}
                helper="UW Seattle is the default. Switch this if you are aiming for Bothell or Tacoma."
                open={openSelector === "campus"}
                onToggle={onToggleCampus}
                options={campusOptions}
                onSelect={onSelectCampus}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                cardClass={cardClass}
                borderClass={borderClass}
              />
            </View>

            <View style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}>
              <SelectorField
                label="Major"
                value={selectedMajorLabel}
                helper="Pick the UW bachelor's degree you want the course plan to follow."
                open={openSelector === "major"}
                onToggle={onToggleMajor}
                options={majorOptions}
                onSelect={onSelectMajor}
                searchable
                searchPlaceholder="Search majors"
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                cardClass={cardClass}
                borderClass={borderClass}
              />
          </View>
        </View>
      </View>

      <MajorPathwaySection
        pathwayOptions={pathwayOptions}
        selectedPathwayLabel={selectedPathwayLabel}
        isPathwaySelectorOpen={isPathwaySelectorOpen}
        onTogglePathway={() => setIsPathwaySelectorOpen((currentValue) => !currentValue)}
        onSelectPathway={(pathwayId) => {
          setIsPathwaySelectorOpen(false);
          onSelectPathway(pathwayId);
        }}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        cardClass={cardClass}
        borderClass={borderClass}
      />

      <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
        <Text className={`${textClass} text-base font-semibold`}>Best Green River Transfer Associates path</Text>
        <Text className={`${secondaryTextClass} text-sm mt-1`}>
          This shows the Green River degree path that best matches the UW degree you picked.
        </Text>

        <View className={`mt-4 border ${borderClass} rounded-2xl px-4 py-4`}>
          <Text className={`${textClass} font-semibold`}>
            {trackCode ? `${trackCode} | ${trackTitle}` : trackTitle}
          </Text>
          <Text className={`${secondaryTextClass} text-sm mt-2`}>{trackSummary}</Text>
          <Text className={`${secondaryTextClass} text-sm mt-3`}>{financialAidNote}</Text>
        </View>
      </View>

      <MajorSpecificsSection
        plan={plan}
        selectedPathwayLabel={selectedPathwayLabel}
        completedCourses={completedCourses}
        currentCourseLabels={currentCourseLabels}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />
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

      <AnimatedIconPressable onPress={onUpload} className="self-start" containerStyle={{ marginTop: 12 }}>
        <Text className="text-emerald-500 text-sm font-medium">Update transcript</Text>
      </AnimatedIconPressable>

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
          <AnimatedIconPressable
            onPress={() => void openExternalLink(CTCLINK_UNOFFICIAL_TRANSCRIPT_URL)}
            className="self-start"
            containerStyle={{ marginTop: 12 }}
          >
            <Text className="text-emerald-500 font-medium">Open unofficial transcript in ctcLink</Text>
          </AnimatedIconPressable>
        </View>
      ) : null}

      <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
        <Text className={`${textClass} text-base font-semibold`}>
          Choose your UW path
        </Text>
        <Text className={`${secondaryTextClass} text-sm mt-1`}>
          Set the campus and major you want this Green River plan to match against.
        </Text>

        <View
          className="mt-4"
          style={isDesktop ? { flexDirection: "row", alignItems: "flex-start", gap: 16 } : { gap: 16 }}
        >
          <View style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}>
            <SelectorField
              label="Campus"
              value={selectedCampusLabel}
              helper="UW Seattle is the default. Switch this if you are aiming for Bothell or Tacoma."
              open={openSelector === "campus"}
              onToggle={onToggleCampus}
              options={campusOptions}
              onSelect={onSelectCampus}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              cardClass={cardClass}
              borderClass={borderClass}
            />
          </View>

          <View style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}>
            <SelectorField
              label="Major"
              value={selectedMajorLabel}
              helper="Pick the UW bachelor's degree you want the course plan to follow."
              open={openSelector === "major"}
              onToggle={onToggleMajor}
              options={majorOptions}
              onSelect={onSelectMajor}
              searchable
              searchPlaceholder="Search majors"
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              cardClass={cardClass}
              borderClass={borderClass}
            />
          </View>
        </View>
      </View>

      <MajorPathwaySection
        pathwayOptions={pathwayOptions}
        selectedPathwayLabel={selectedPathwayLabel}
        isPathwaySelectorOpen={isPathwaySelectorOpen}
        onTogglePathway={() => setIsPathwaySelectorOpen((currentValue) => !currentValue)}
        onSelectPathway={(pathwayId) => {
          setIsPathwaySelectorOpen(false);
          onSelectPathway(pathwayId);
        }}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        cardClass={cardClass}
        borderClass={borderClass}
      />

      <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
        <Text className={`${textClass} text-base font-semibold`}>Best Green River Transfer Associates path</Text>
        <Text className={`${secondaryTextClass} text-sm mt-1`}>
          This shows the Green River degree path that best matches the UW degree you picked.
        </Text>

        <View className={`mt-4 border ${borderClass} rounded-2xl px-4 py-4`}>
          <Text className={`${textClass} font-semibold`}>
            {trackCode ? `${trackCode} | ${trackTitle}` : trackTitle}
          </Text>
          <Text className={`${secondaryTextClass} text-sm mt-2`}>{trackSummary}</Text>
          <Text className={`${secondaryTextClass} text-sm mt-3`}>{financialAidNote}</Text>
        </View>
      </View>

      <MajorSpecificsSection
        plan={plan}
        selectedPathwayLabel={selectedPathwayLabel}
        completedCourses={completedCourses}
        currentCourseLabels={currentCourseLabels}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />

    </View>
  );
}

function MajorPathwaySection({
  pathwayOptions,
  selectedPathwayLabel,
  isPathwaySelectorOpen,
  onTogglePathway,
  onSelectPathway,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
}: {
  pathwayOptions: TransferPlannerMajorPathway[];
  selectedPathwayLabel: string | null;
  isPathwaySelectorOpen: boolean;
  onTogglePathway: () => void;
  onSelectPathway: (pathwayId: string) => void;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
}) {
  if (pathwayOptions.length <= 1) {
    return null;
  }

  return (
    <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
      <Text className={`${textClass} text-base font-semibold`}>Major pathway</Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>
        This major has multiple supported routes. Pick the route you want this planner to follow.
      </Text>

      <View className="mt-4">
        <SelectorField
          label="Pathway"
          value={selectedPathwayLabel ?? pathwayOptions[0]?.label ?? "Select pathway"}
          helper=""
          open={isPathwaySelectorOpen}
          onToggle={onTogglePathway}
          options={pathwayOptions.map((pathway) => ({
            id: pathway.id,
            label: pathway.label,
            description: pathway.summary,
          }))}
          onSelect={onSelectPathway}
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          cardClass={cardClass}
          borderClass={borderClass}
        />
      </View>
    </View>
  );
}

function SuggestedScheduleCard({
  quarters,
  degreeTitle,
  campusLabel,
  onlyUwEssentialClasses,
  showOnlyUwEssentialClassesToggle,
  onToggleOnlyUwEssentialClasses,
  currentCourseLabels,
  onToggleCurrentCourse,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
}: {
  quarters: SuggestedQuarterPlan[];
  degreeTitle: string;
  campusLabel: string;
  onlyUwEssentialClasses: boolean;
  showOnlyUwEssentialClassesToggle: boolean;
  onToggleOnlyUwEssentialClasses: () => void;
  currentCourseLabels: Set<string>;
  onToggleCurrentCourse: (courseLabel: string) => void;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
}) {
  const visibleQuarters = quarters.filter(
    (quarter) => quarter.phase !== "planned" || quarter.courses.length > 0
  );

  return (
    <View className={`${cardClass} border rounded-[28px] p-5`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 min-w-0">
          <Text className={`${textClass} text-lg font-semibold`}>GRC Quarter Plan</Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            {`This is your ideal plan on finishing the ${degreeTitle} degree at ${getScheduleCampusLabel(campusLabel)}! Make sure to confirm with your advisor before scheduling classes.`}
          </Text>
        </View>

        {showOnlyUwEssentialClassesToggle ? (
          <Pressable
            onPress={onToggleOnlyUwEssentialClasses}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: onlyUwEssentialClasses }}
            accessibilityLabel="Only show classes that transfer into UW on this track"
            accessibilityHint="Hides optional Green River classes that do not count toward the UW track."
            className={`border ${borderClass} rounded-xl px-3 py-2 flex-row items-center justify-center gap-2`}
            hitSlop={8}
          >
            <Text className={`${secondaryTextClass} text-xs font-medium`}>
              Classes for UW transfer only
            </Text>
            <Ionicons
              name={onlyUwEssentialClasses ? "checkbox" : "square-outline"}
              size={20}
              color={onlyUwEssentialClasses ? "#008f4e" : "#9CA3AF"}
            />
          </Pressable>
        ) : null}
      </View>

      <View className="gap-4 mt-4">
        {visibleQuarters.map((quarter) => (
          <View key={quarter.label} className={`border ${borderClass} rounded-2xl px-4 py-4`}>
            <View className="flex-row items-center justify-between gap-3">
              <Text className={`${textClass} font-semibold flex-1`}>{quarter.label}</Text>
              <View
                className={`px-3 py-1 rounded-full border ${
                  quarter.phase === "completed"
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : quarter.phase === "current"
                      ? "bg-sky-500/10 border-sky-500/20"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    quarter.phase === "completed"
                      ? "text-emerald-500"
                      : quarter.phase === "current"
                        ? "text-sky-400"
                        : textClass
                  }`}
                >
                  {quarter.phase === "completed"
                    ? "Completed"
                    : quarter.phase === "current"
                      ? "Current"
                      : "Planned"}
                </Text>
              </View>
            </View>
            <View className="gap-2 mt-3">
              {quarter.courses.length ? (
                quarter.courses.map((course) => (
                  <View
                    key={`${quarter.label}-${course.label}`}
                    className={`px-3 py-3 rounded-2xl ${
                      course.status === "completed"
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : course.status === "current"
                          ? "bg-sky-500/10 border border-sky-500/20"
                          : course.type === "core"
                            ? "bg-emerald-500/10 border border-emerald-500/20"
                            : "bg-white/5 border border-white/10"
                    }`}
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-row items-start flex-1 min-w-0">
                        {course.status === "completed" ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color="#008f4e"
                            style={{ marginTop: 1, marginRight: 8 }}
                          />
                        ) : null}
                        <View style={{ flex: 1 }}>
                          <Text
                            className={`text-sm font-medium ${
                              course.status === "completed"
                                ? "text-emerald-500"
                                : course.status === "current"
                                  ? "text-sky-400"
                                  : course.type === "core"
                                    ? "text-emerald-500"
                                    : textClass
                            }`}
                          >
                            {course.label}
                          </Text>
                          {course.guidanceSummary ? (
                            <Text className={`${secondaryTextClass} text-xs mt-1`}>
                              {course.guidanceSummary}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {course.status !== "completed" ? (
                        <Pressable
                          onPress={() => onToggleCurrentCourse(course.label)}
                          hitSlop={8}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: currentCourseLabels.has(course.label) }}
                          className="self-start"
                        >
                          <Ionicons
                            name={
                              currentCourseLabels.has(course.label)
                                ? "checkbox"
                                : "square-outline"
                            }
                            size={20}
                            color={currentCourseLabels.has(course.label) ? "#008f4e" : "#9CA3AF"}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))
              ) : (
                <Text className={`${secondaryTextClass} text-sm`}>
                  Nothing else is required in this planned quarter.
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function MajorSpecificsSection({
  plan,
  selectedPathwayLabel,
  completedCourses,
  currentCourseLabels,
  textClass,
  secondaryTextClass,
  borderClass,
}: {
  plan: TransferPlannerResolvedMajorPlan;
  selectedPathwayLabel: string | null;
  completedCourses: TranscriptCourseEntry[];
  currentCourseLabels: Set<string>;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
}) {
  const grcCourseList = getTransferPlannerGrcCourseList(plan);
  const grcCourseListGuidance = getTransferPlannerGrcCourseListGuidance(plan);
  const degreeMapSections = plan.degreeMapSections ?? [];
  const primaryDegreeSource = getTransferPlannerPrimaryDegreeRequirementsSource(
    plan.id,
    plan.selectedPathwayId
  );
  const primaryUwDegreeLink = primaryDegreeSource?.url
    ? {
        label: primaryDegreeSource.label,
        url: primaryDegreeSource.url,
      }
    : plan.officialLinks[0] ?? null;
  const completedCourseCodeSet = new Set(completedCourses.map((course) => course.code));
  const currentCourseCodeSet = new Set(
    [...currentCourseLabels].flatMap((label) => extractCourseCodes(label))
  );
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);

  return (
    <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
      <AnimatedCardPressable
        onPress={() => setIsReferenceOpen((currentValue) => !currentValue)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isReferenceOpen }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>
              Major Specifics
            </Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              {plan.sourceType === "detailed"
                ? "Open this dropdown for the major-specific Green River class list and UW degree details tied to your selected major."
                : "Open this dropdown for the major-specific Green River planning guidance and the extra notes attached to this major."}
            </Text>
          </View>
          <Ionicons
            name={isReferenceOpen ? "chevron-up" : "chevron-down"}
            size={20}
            color="#9CA3AF"
          />
        </View>
      </AnimatedCardPressable>

      {isReferenceOpen ? (
        <>
          {primaryUwDegreeLink ? (
            <View className="mt-5 gap-4">
              <Text className={`${textClass} text-base font-semibold`}>Official UW degree page</Text>
              <Text className={`${secondaryTextClass} text-sm`}>
                This is the main UW page the planner should use for the full degree requirements for this major.
              </Text>
              <AnimatedCardPressable
                onPress={() => void openExternalLink(primaryUwDegreeLink.url)}
                className={`border ${borderClass} rounded-2xl px-4 py-4`}
              >
                <Text className="text-emerald-500 font-semibold">
                  {primaryUwDegreeLink.label}
                </Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  {primaryUwDegreeLink.url}
                </Text>
              </AnimatedCardPressable>
            </View>
          ) : null}

          {grcCourseList.length || grcCourseListGuidance ? (
            <View className="mt-5 gap-4">
              <Text className={`${textClass} text-base font-semibold`}>Green River classes</Text>
              <Text className={`${secondaryTextClass} text-sm`}>
                {grcCourseList.length
                  ? selectedPathwayLabel
                    ? `This is the explicit Green River course list currently attached to the ${selectedPathwayLabel} route for this major.`
                    : "This is the explicit Green River course list currently attached to this UW major."
                  : "This major does not use one fixed universal Green River course list. Follow the custom planning guidance below instead of treating the empty list like missing data."}
              </Text>
              {grcCourseList.length ? (
                <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                  <View className="flex-row flex-wrap gap-2">
                    {grcCourseList.map((course) => {
                      const courseCodes = extractCourseCodes(course);
                      const isCompleted = courseCodes.some((code) => completedCourseCodeSet.has(code));
                      const isCurrent =
                        !isCompleted && courseCodes.some((code) => currentCourseCodeSet.has(code));

                      return (
                        <View
                          key={`${plan.id}-${course}`}
                          className={`px-3 py-2 rounded-full border ${
                            isCompleted
                              ? "bg-emerald-500/10 border-emerald-500/20"
                              : isCurrent
                                ? "bg-sky-500/10 border-sky-500/20"
                                : "bg-white/5 border-white/10"
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              isCompleted
                                ? "text-emerald-500"
                                : isCurrent
                                  ? "text-sky-400"
                                  : textClass
                            }`}
                          >
                            {course}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                  <Text className={`${textClass} font-semibold`}>
                    Custom Green River planning guidance
                  </Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>
                    {grcCourseListGuidance}
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {degreeMapSections.length ? (
            <View className="mt-5 gap-4">
              <Text className={`${textClass} text-base font-semibold`}>
                Degree Specifics
              </Text>
              <Text className={`${secondaryTextClass} text-sm`}>
                {selectedPathwayLabel
                  ? `These sections summarize the official UW degree structure currently attached to the ${selectedPathwayLabel} route for this major.`
                  : "These sections summarize the official UW degree structure already lifted into the planner for this major."}
              </Text>
              {degreeMapSections.map((section) => (
                <View key={section.id} className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                  <Text className={`${textClass} font-semibold`}>{section.title}</Text>
                  {section.note ? (
                    <Text className={`${secondaryTextClass} text-sm mt-1`}>
                      {section.note}
                    </Text>
                  ) : null}
                  <View className="mt-3 gap-2">
                    {section.items.map((item) => (
                      <View key={`${section.id}-${item}`} className="flex-row items-start gap-2">
                        <Text className={`${secondaryTextClass} text-sm`}>{"•"}</Text>
                        <Text className={`${secondaryTextClass} flex-1 text-sm`}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
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
  const [onlyUwEssentialClasses, setOnlyUwEssentialClasses] = useState(true);

  const transcriptAnalysisAttemptsRef = useRef<Set<string>>(new Set());

  const { textClass, secondaryTextClass, cardBgClass, borderClass } = styles;
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
  const storedDetailedTranscriptCourses =
    state.questionnaireAnswers?.[TRANSCRIPT_COURSES_FIELD];
  const hasDetailedCompletedCourses = useMemo(
    () =>
      Array.isArray(storedDetailedTranscriptCourses) &&
      storedDetailedTranscriptCourses.some(
        (entry: unknown) => !!entry && typeof entry === "object" && !Array.isArray(entry)
      ),
    [storedDetailedTranscriptCourses]
  );
  const storedTranscriptSource = String(
    state.questionnaireAnswers?.[TRANSCRIPT_SOURCE_FIELD] ?? ""
  ).trim();
  const storedTranscriptParserVersion = useMemo(() => {
    const raw = state.questionnaireAnswers?.[TRANSCRIPT_PARSER_VERSION_FIELD];
    const parsed =
      typeof raw === "number" ? raw : Number.parseInt(String(raw ?? "").trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [state.questionnaireAnswers]);
  const shouldUseDetailedCompletedCourses =
    hasDetailedCompletedCourses &&
    storedTranscriptParserVersion === TRANSCRIPT_PARSER_VERSION;
  const rawCompletedCourses = shouldUseDetailedCompletedCourses
    ? storedDetailedTranscriptCourses
    : state.questionnaireAnswers?.completedCourses;
  const completedCourses = useMemo(
    () => parseCompletedTranscriptCourses(rawCompletedCourses),
    [rawCompletedCourses]
  );
  const needsTranscriptReparse =
    hasDetailedCompletedCourses &&
    storedTranscriptParserVersion !== TRANSCRIPT_PARSER_VERSION;

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
  const selectedBasePlan = useMemo(
    () => campusMajors.find((entry) => entry.id === selectedMajorId) ?? campusMajors[0] ?? null,
    [campusMajors, selectedMajorId]
  );
  const selectedPathwayByPlan = useMemo(
    () =>
      normalizePlannerSelectedPathwayMap(
        state.questionnaireAnswers?.[SELECTED_PATHWAY_FIELD]
      ),
    [state.questionnaireAnswers]
  );
  const pathwayOptions = useMemo(
    () => getTransferPlannerPathwaysForPlan(selectedBasePlan),
    [selectedBasePlan]
  );
  const selectedPathwayId = useMemo(() => {
    if (!selectedBasePlan) return null;
    const storedPathwayId = selectedPathwayByPlan[selectedBasePlan.id] ?? null;
    if (storedPathwayId && pathwayOptions.some((entry) => entry.id === storedPathwayId)) {
      return storedPathwayId;
    }
    return pathwayOptions[0]?.id ?? null;
  }, [pathwayOptions, selectedBasePlan, selectedPathwayByPlan]);
  const plan = useMemo(
    () => resolveTransferPlannerMajorPlan(selectedBasePlan, selectedPathwayId),
    [selectedBasePlan, selectedPathwayId]
  );
  const track = useMemo(() => getTransferPlannerTrack(plan?.bestTrackId ?? null), [plan]);
  const plannerPathKey = useMemo(
    () => getPlannerPathKey(selectedCampusId, plan?.id ?? selectedMajorId, selectedPathwayId),
    [plan?.id, selectedCampusId, selectedMajorId, selectedPathwayId]
  );
  const currentCourseSelectionsByPath = useMemo(
    () =>
      normalizePlannerCurrentCourseMap(
        state.questionnaireAnswers?.[CURRENT_PLANNED_COURSES_FIELD]
      ),
    [state.questionnaireAnswers]
  );
  const currentPlannedCourseLabels = useMemo(
    () => currentCourseSelectionsByPath[plannerPathKey] ?? [],
    [currentCourseSelectionsByPath, plannerPathKey]
  );
  const currentPlannedCourseSet = useMemo(
    () => new Set(currentPlannedCourseLabels),
    [currentPlannedCourseLabels]
  );
  const transcriptSourceKey = transcriptDocument
    ? `${transcriptDocument.url}|${transcriptDocument.uploadedAt}`
    : "";
  const transcriptAnalysisKey = transcriptSourceKey
    ? `${transcriptSourceKey}|v${TRANSCRIPT_PARSER_VERSION}`
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
        parserVersion: TRANSCRIPT_PARSER_VERSION,
        storedParserVersion: storedTranscriptParserVersion,
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
          parsedCourseAssignmentsPreview: [],
          parsedQuarterBuckets: [],
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
            parsedCourseAssignmentsPreview: buildParsedCourseAssignmentsPreview(parsedCourses),
            parsedQuarterBuckets: buildParsedQuarterBuckets(parsedCourses),
            error: null,
          })
        );

        await setQuestionnaireAnswers({
          ...state.questionnaireAnswers,
          [TRANSCRIPT_COURSES_FIELD]: parsedCourses,
          completedCourses: parsedCourses.map((course) => course.label),
          [TRANSCRIPT_SOURCE_FIELD]: document.url,
          [TRANSCRIPT_PARSER_VERSION_FIELD]: TRANSCRIPT_PARSER_VERSION,
          [TRANSCRIPT_UPLOADED_AT_FIELD]:
            document.uploadedAt || new Date().toISOString(),
        });
      } catch (error) {
        const failureSnapshot = buildTranscriptDebugSnapshot({
          ...debugBase,
          phase: "analysis-failure",
          parsedCourseCount: null,
          parsedCourseCodesPreview: [],
          parsedCourseAssignmentsPreview: [],
          parsedQuarterBuckets: [],
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
      storedTranscriptParserVersion,
      storedTranscriptSource,
    ]
  );

  useEffect(() => {
    if (!transcriptDocument) return;
    if (
      completedCourses.length &&
      storedTranscriptSource === transcriptDocument.url &&
      shouldUseDetailedCompletedCourses
    ) {
      return;
    }
    if (!transcriptAnalysisKey) return;
    if (transcriptAnalysisAttemptsRef.current.has(transcriptAnalysisKey)) return;

    transcriptAnalysisAttemptsRef.current.add(transcriptAnalysisKey);
    void analyzeTranscript(transcriptDocument);
  }, [
    analyzeTranscript,
    transcriptAnalysisKey,
    completedCourses.length,
    storedTranscriptSource,
    shouldUseDetailedCompletedCourses,
    transcriptDocument,
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
        `${uploaded.url}|${uploaded.uploadedAt}|v${TRANSCRIPT_PARSER_VERSION}`
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
          parserVersion: TRANSCRIPT_PARSER_VERSION,
          storedParserVersion: storedTranscriptParserVersion,
          transcriptSourceKey: "",
          storedTranscriptSource,
          completedCoursesBeforeCount: completedCourses.length,
          questionnaireCompletedCourseCount: Array.isArray(state.questionnaireAnswers?.completedCourses)
            ? state.questionnaireAnswers.completedCourses.length
            : 0,
          parsedCourseCount: null,
          parsedCourseCodesPreview: [],
          parsedCourseAssignmentsPreview: [],
          parsedQuarterBuckets: [],
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
    storedTranscriptParserVersion,
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
  const hasOptionalStayAtGrcChecklist = plan?.stayAtGrcChecklist.length
    ? plan.stayAtGrcChecklist.some((item) => item.grcCourses.length > 0)
    : false;
  const suggestedQuarterPlan = useMemo(
    () =>
      buildSuggestedQuarterPlan({
        plan,
        applicationStatuses,
        beforeEnrollmentStatuses,
        stayAtGrcStatuses,
        completedCourses,
        currentCourseLabels: currentPlannedCourseLabels,
        track,
        includeStayAtGrcCourses: !onlyUwEssentialClasses,
      }),
    [
      applicationStatuses,
      beforeEnrollmentStatuses,
      completedCourses,
      currentPlannedCourseLabels,
      onlyUwEssentialClasses,
      plan,
      stayAtGrcStatuses,
      track,
    ]
  );
  const hasStructuredPlannerData = useMemo(
    () =>
      !!plan &&
      (
        plan.applicationChecklist.length > 0 ||
        plan.beforeEnrollmentChecklist.length > 0 ||
        plan.stayAtGrcChecklist.length > 0
      ),
    [plan]
  );
  const handleToggleCurrentCourse = useCallback(
    async (courseLabel: string) => {
      const normalizedLabel = String(courseLabel ?? "").trim();
      if (!normalizedLabel) return;

      const nextPathLabels = currentPlannedCourseSet.has(normalizedLabel)
        ? currentPlannedCourseLabels.filter((label) => label !== normalizedLabel)
        : [...currentPlannedCourseLabels, normalizedLabel];
      const nextSelectionMap = {
        ...currentCourseSelectionsByPath,
        [plannerPathKey]: nextPathLabels,
      };

      if (!nextPathLabels.length) {
        delete nextSelectionMap[plannerPathKey];
      }

      await setQuestionnaireAnswers({
        ...state.questionnaireAnswers,
        [CURRENT_PLANNED_COURSES_FIELD]: nextSelectionMap,
      });
    },
    [
      currentCourseSelectionsByPath,
      currentPlannedCourseLabels,
      currentPlannedCourseSet,
      plannerPathKey,
      setQuestionnaireAnswers,
      state.questionnaireAnswers,
    ]
  );
  const handleSelectPathway = useCallback(
    async (pathwayId: string) => {
      if (!selectedBasePlan) return;

      const nextSelectionMap = {
        ...selectedPathwayByPlan,
        [selectedBasePlan.id]: pathwayId,
      };

      await setQuestionnaireAnswers({
        ...state.questionnaireAnswers,
        [SELECTED_PATHWAY_FIELD]: nextSelectionMap,
      });
    },
    [
      selectedBasePlan,
      selectedPathwayByPlan,
      setQuestionnaireAnswers,
      state.questionnaireAnswers,
    ]
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
            <AnimatedIconPressable
              onPress={handleGoBack}
              className="flex-row items-center"
              containerStyle={{ alignSelf: "flex-start" }}
            >
              <MaterialIcons
                name="arrow-back"
                size={20}
                color="#1f8a5d"
              />
              <Text className={`${secondaryTextClass} ml-2`}>
                {backLabel}
              </Text>
            </AnimatedIconPressable>

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
          </View>

          <TranscriptSummaryCard
            transcriptDocument={transcriptDocument}
            isAnalyzing={isAnalyzingTranscript || needsTranscriptReparse}
            errorMessage={transcriptError}
            plan={plan}
            pathwayOptions={pathwayOptions}
            selectedPathwayLabel={plan.selectedPathwayLabel}
            selectedCampusLabel={campus.title}
            selectedMajorLabel={plan?.title ?? "Select major"}
            trackCode={track?.code ?? null}
            trackTitle={track?.title ?? "Custom Green River path"}
            trackSummary={plan.bestTrackSummary}
            financialAidNote={plan.financialAidNote}
            completedCourses={completedCourses}
            currentCourseLabels={currentPlannedCourseSet}
            openSelector={openSelector}
            campusOptions={campusOptions}
            majorOptions={majorOptions}
            onToggleCampus={() =>
              setOpenSelector((current) => (current === "campus" ? null : "campus"))
            }
            onToggleMajor={() =>
              setOpenSelector((current) => (current === "major" ? null : "major"))
            }
            onSelectCampus={(id) => {
              setSelectedCampusId(id as TransferPlannerCampusId);
              setOpenSelector(null);
            }}
            onSelectMajor={(id) => {
              setSelectedMajorId(id);
              setOpenSelector(null);
            }}
            onSelectPathway={handleSelectPathway}
            onUpload={handlePickTranscript}
            onOpenTranscriptLink={() => {
              void openExternalLink(CTCLINK_UNOFFICIAL_TRANSCRIPT_URL);
            }}
            isDesktop={isDesktop}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            cardClass={cardBgClass}
            borderClass={borderClass}
          />

          {!hasStructuredPlannerData ? (
            <View className={`${cardBgClass} border rounded-[28px] p-5`}>
              <Text className={`${textClass} text-lg font-semibold`}>
                Quarter plan note
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                This degree does not have a fixed quarter-by-quarter plan yet. Use the Green River class list and class-order notes above as your starting point, then confirm the final class order with an advisor.
              </Text>
            </View>
          ) : null}

          {hasStructuredPlannerData ? (
            <SuggestedScheduleCard
              quarters={suggestedQuarterPlan}
              degreeTitle={
                plan.selectedPathwayLabel
                  ? `${plan.title} (${plan.selectedPathwayLabel})`
                  : plan.title
              }
              campusLabel={campus.title}
              onlyUwEssentialClasses={onlyUwEssentialClasses}
              showOnlyUwEssentialClassesToggle={hasOptionalStayAtGrcChecklist}
              onToggleOnlyUwEssentialClasses={() =>
                setOnlyUwEssentialClasses((current) => !current)
              }
              currentCourseLabels={currentPlannedCourseSet}
              onToggleCurrentCourse={handleToggleCurrentCourse}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              cardClass={cardBgClass}
              borderClass={borderClass}
            />
          ) : null}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
