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
  getTransferPlannerCanonicalCourse,
  getTransferPlannerEquivalencyRulesForSourceCourse,
  getTransferPlannerStudentRuntimeMajorsForCampus,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  getTransferPlannerTrack,
  resolveTransferPlannerStudentRuntimeMajorPlan,
  TRANSFER_PLANNER_CAMPUSES,
  type TransferPlannerCampusId,
  type TransferPlannerMajorPathway,
  type TransferPlannerResolvedMajorPlan,
  type TransferPlannerStudentCourseEvaluation,
} from "@/constants/transfer-planner-source";
import { useAppData } from "@/hooks/use-app-data";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { errorLoggingService, transcriptPlannerDebugService } from "@/services";
import { storageService, type UploadedFile } from "@/services/storage/storage.service";
import {
  buildSuggestedQuarterPlan,
  buildRequirementStatuses,
  buildTransferPlannerStudentCourseEvaluations,
  buildTransferPlannerStudentEvaluationReport,
  extractCourseCodes,
  parseCompletedTranscriptCourses,
  type SuggestedQuarterPlan,
  type TransferPlannerStudentEvaluationReport,
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
const LAST_SELECTED_PLAN_FIELD = "transferPlannerLastSelectedPlan";
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

function normalizePlannerLastSelectedPlan(rawValue: unknown) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
  }

  const rawCampusId = (rawValue as Record<string, unknown>).campusId;
  const rawMajorId = (rawValue as Record<string, unknown>).majorId;
  const campusId = String(rawCampusId ?? "").trim();
  const majorId = String(rawMajorId ?? "").trim();
  if (!campusId || !majorId) return null;

  return { campusId, majorId };
}

function getScheduleCampusLabel(campusLabel: string) {
  const trimmed = String(campusLabel ?? "").trim();
  if (!trimmed) return "UW";
  if (/^UW\s+/i.test(trimmed)) return trimmed;
  return `UW ${trimmed}`;
}

function getEvaluationOutcomeBadgeLabel(outcome: TransferPlannerStudentCourseEvaluation["outcome"]) {
  switch (outcome) {
    case "auto-approved":
      return "Applies";
    case "legacy-rule-used":
      return "Legacy";
    case "elective-credit":
      return "Elective";
    case "sequence-incomplete":
      return "Sequence";
    case "no-credit":
      return "No credit";
    case "not-applicable-to-major":
      return "Not used";
    case "source-unverified-hidden":
      return "Hidden";
  }
}

function getEvaluationOutcomeBadgeClass(outcome: TransferPlannerStudentCourseEvaluation["outcome"]) {
  switch (outcome) {
    case "auto-approved":
      return "bg-emerald-500/10 border-emerald-500/20";
    case "legacy-rule-used":
    case "sequence-incomplete":
      return "bg-amber-500/10 border-amber-500/20";
    case "elective-credit":
      return "bg-sky-500/10 border-sky-500/20";
    case "no-credit":
      return "bg-red-500/10 border-red-500/20";
    case "not-applicable-to-major":
    case "source-unverified-hidden":
      return "bg-white/5 border-white/10";
  }
}

function getEvaluationOutcomeTextClass(
  outcome: TransferPlannerStudentCourseEvaluation["outcome"],
  fallbackTextClass: string
) {
  switch (outcome) {
    case "auto-approved":
      return "text-emerald-500";
    case "legacy-rule-used":
    case "sequence-incomplete":
      return "text-amber-500";
    case "elective-credit":
      return "text-sky-400";
    case "no-credit":
      return "text-red-400";
    case "not-applicable-to-major":
    case "source-unverified-hidden":
      return fallbackTextClass;
  }
}

function normalizeRequirementTag(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function getRequirementTagLabel(normalizedTag: string) {
  switch (normalizedTag) {
    case "AH":
      return "A&H";
    case "SSC":
      return "SSc";
    case "NSC":
      return "NSc";
    case "QSR":
      return "QSR";
    case "VLPA":
      return "VLPA";
    case "DIV":
      return "DIV";
    case "NW":
      return "NW";
    case "IANDS":
      return "I&S";
    default:
      return normalizedTag;
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferRequirementCreditTotalFromText(text: string, normalizedTag: string) {
  const tagLabel = getRequirementTagLabel(normalizedTag);
  const escapedTag = escapeRegExp(tagLabel);
  const patterns = [
    new RegExp(`${escapedTag}[^\\n]{0,60}?(\\d+(?:\\.\\d+)?)\\s*credits`, "i"),
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*credits[^\\n]{0,60}?${escapedTag}`, "i"),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const parsed = Number.parseFloat(match[1] ?? "");
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function buildRequirementCreditTotalsByTag(
  plan: TransferPlannerResolvedMajorPlan,
  evaluations: TransferPlannerStudentCourseEvaluation[]
) {
  const totals = new Map<string, number>();
  const candidateTags = new Set(
    evaluations
      .flatMap((evaluation) => evaluation.targetRequirementTags)
      .map((tag) => normalizeRequirementTag(tag))
      .filter(Boolean)
  );

  if (!candidateTags.size || !plan.degreeMapSections?.length) {
    return totals;
  }

  const searchableText = plan.degreeMapSections
    .flatMap((section) => [section.title, section.note ?? "", ...section.items])
    .join("\n");

  for (const tag of candidateTags) {
    const detectedTotal = inferRequirementCreditTotalFromText(searchableText, tag);
    if (detectedTotal && detectedTotal > 0) {
      totals.set(tag, detectedTotal);
    }
  }

  return totals;
}

function shouldShowRequirementCreditMessage(evaluation: TransferPlannerStudentCourseEvaluation) {
  return (
    (evaluation.outcome === "auto-approved" ||
      evaluation.outcome === "legacy-rule-used" ||
      evaluation.outcome === "elective-credit") &&
    evaluation.targetRequirementTags.length > 0
  );
}

function getEvaluationRequirementCreditMessageParts(input: {
  evaluation: TransferPlannerStudentCourseEvaluation;
  totalsByTag: Map<string, number>;
  completedByTag: Map<string, number>;
  campusId: TransferPlannerCampusId;
}) {
  const { evaluation, totalsByTag, completedByTag, campusId } = input;
  if (!shouldShowRequirementCreditMessage(evaluation)) return null;

  const normalizedTags = Array.from(
    new Set(
      evaluation.targetRequirementTags
        .map((tag) => normalizeRequirementTag(tag))
        .filter(Boolean)
    )
  );
  if (!normalizedTags.length) return null;

  const selectedTag = normalizedTags.find((tag) => totalsByTag.has(tag)) ?? normalizedTags[0];
  if (!selectedTag) return null;

  const tagLabel = getRequirementTagLabel(selectedTag);
  const fulfilledCredits = evaluation.sourceCreditAmount ?? 5;
  const totalCredits = totalsByTag.get(selectedTag) ?? null;

  if (!totalCredits) {
    return {
      prefix: `Fulfills ${fulfilledCredits} credits of the `,
      clickableLabel: tagLabel,
      suffix: " requirement.",
      normalizedTag: selectedTag,
      campusId,
    };
  }

  const completedCredits = Math.min(completedByTag.get(selectedTag) ?? 0, totalCredits);
  return {
    prefix: `Fulfills ${fulfilledCredits} credits of the ${totalCredits}-credit `,
    clickableLabel: tagLabel,
    suffix: ` requirement. ${completedCredits}/${totalCredits} credits have been completed.`,
    normalizedTag: selectedTag,
    campusId,
  };
}

function getPlanRequirementCourseCodes(plan: TransferPlannerResolvedMajorPlan) {
  const checklistItems = [
    ...plan.applicationChecklist,
    ...plan.beforeEnrollmentChecklist,
    ...plan.stayAtGrcChecklist,
  ];

  return Array.from(
    new Set(
      checklistItems.flatMap((item) =>
        extractCourseCodes([item.grcCourses, ...(item.alternatives ?? [])].flat().join(" "))
      )
    )
  );
}

function hasDirectEquivalentRuleForCourse(courseCode: string, campusId: TransferPlannerCampusId) {
  return getTransferPlannerEquivalencyRulesForSourceCourse(courseCode).some((rule) => {
    if (!rule.targetSchoolIds.includes(campusId)) return false;
    if (rule.acceptanceCategory === "no-credit") return false;
    if (rule.type === "elective-credit" || rule.type === "limited-credit") return false;
    return true;
  });
}

function hasAnyDirectMajorEquivalencies(plan: TransferPlannerResolvedMajorPlan) {
  const requirementCourseCodes = getPlanRequirementCourseCodes(plan);
  if (!requirementCourseCodes.length) return false;

  return requirementCourseCodes.some((courseCode: string) =>
    hasDirectEquivalentRuleForCourse(courseCode, plan.campusId)
  );
}

function buildAdmissionContextText(plan: TransferPlannerResolvedMajorPlan) {
  return [
    plan.applicationWindow,
    plan.summary,
    ...(plan.degreeMapSections ?? []).flatMap((section) => section.items),
    ...plan.advisorFlags,
    ...(plan.manualReviewNotes ?? []),
  ]
    .map((item) => String(item ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isOpenAdmissionMajor(plan: TransferPlannerResolvedMajorPlan) {
  const admissionText = buildAdmissionContextText(plan);
  if (!admissionText) return false;
  if (/\bnot an open major\b|\brather than an open major\b/.test(admissionText)) {
    return false;
  }

  return /\bopen\s+major\b|\bopen\s+admission\b|\bdeclare (?:this|the) major at any time\b/.test(
    admissionText
  );
}

function getSchedulePlaceholderRequirementLinkData(courseLabel: string) {
  const normalized = String(courseLabel ?? "").trim();
  if (!normalized) return null;
  if (!/\bcredits?\s+of\b/i.test(normalized)) return null;

  const lower = normalized.toLowerCase();
  const hasHumanities =
    lower.includes("humanit") || lower.includes("a&h") || lower.includes("arts and humanities");
  const hasSocialScience = lower.includes("social science") || /\bssc\b/i.test(lower);
  const hasNaturalScience = lower.includes("natural science") || /\bnsc\b/i.test(lower);

  if (hasHumanities && hasSocialScience) {
    return { tags: ["AH", "SSC"] as const };
  }
  if (hasHumanities) {
    return { tags: ["AH"] as const };
  }
  if (hasSocialScience) {
    return { tags: ["SSC"] as const };
  }
  if (hasNaturalScience) {
    return { tags: ["NSC"] as const };
  }
  if (lower.includes("elective") || lower.includes("general education") || lower.includes("gen ed")) {
    return { tags: [] as const };
  }

  return { tags: [] as const };
}

function getSuggestedScheduleCourseDisplayLabel(courseLabel: string) {
  const normalizedLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedLabel) return "";

  const explicitCourseCodes = extractCourseCodes(normalizedLabel);
  if (explicitCourseCodes.length !== 1) {
    return normalizedLabel;
  }

  const [canonicalCourseCode] = explicitCourseCodes;
  const rawLeadingCourseCode =
    normalizedLabel
      .match(/^[A-Z]{2,6}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/i)?.[0]
      ?.toUpperCase()
      .replace(/\s+/g, " ")
      .trim() ?? canonicalCourseCode;

  if (normalizedLabel.toUpperCase() !== rawLeadingCourseCode.toUpperCase()) {
    const normalizedCodePrefix = `${rawLeadingCourseCode} `.toUpperCase();
    if (normalizedLabel.toUpperCase().startsWith(normalizedCodePrefix)) {
      const remainder = normalizedLabel.slice(rawLeadingCourseCode.length).trim();
      if (remainder && !remainder.startsWith("-")) {
        return `${rawLeadingCourseCode} - ${remainder}`;
      }
    }
    return normalizedLabel;
  }

  const canonicalCourseTitle = String(
    getTransferPlannerCanonicalCourse("grc", rawLeadingCourseCode)?.title ??
      getTransferPlannerCanonicalCourse("grc", canonicalCourseCode)?.title ??
      ""
  ).trim();
  if (!canonicalCourseTitle) {
    return normalizedLabel;
  }

  return `${rawLeadingCourseCode} - ${canonicalCourseTitle}`;
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

function getAutoTrackSummaryText(trackSummary: string) {
  return String(trackSummary ?? "").trim();
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
  onDismiss,
  options,
  onSelect,
  selectedOptionId,
  hideSelectedOptionWhenOpen,
  searchable,
  searchPlaceholder,
  textClass,
  secondaryTextClass,
  borderClass,
  dropdownBackgroundColor,
  onTouchStartInside,
}: {
  label: string;
  value: string;
  helper: string;
  open: boolean;
  onToggle: () => void;
  onDismiss?: () => void;
  options: { id: string; label: string; description?: string }[];
  onSelect: (id: string) => void;
  selectedOptionId?: string | null;
  hideSelectedOptionWhenOpen?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
  dropdownBackgroundColor: string;
  onTouchStartInside?: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (!open) {
      searchInputRef.current?.blur();
      setSearchQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !searchable) return;

    const focusTimer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(focusTimer);
    };
  }, [open, searchable]);

  const normalizedQuery = normalizeSelectorSearchValue(searchQuery);
  const normalizedSelectedValue = normalizeSelectorSearchValue(value);
  const effectiveQuery =
    searchable && open && normalizedQuery === normalizedSelectedValue
      ? ""
      : normalizedQuery;
  const filteredOptions = useMemo(() => {
    const visibleOptions =
      hideSelectedOptionWhenOpen && open && selectedOptionId
        ? options.filter((option) => option.id !== selectedOptionId)
        : options;

    if (!searchable || !effectiveQuery) {
      return visibleOptions;
    }

    const startsWithMatches: { id: string; label: string; description?: string }[] = [];
    const includesMatches: { id: string; label: string; description?: string }[] = [];

    for (const option of visibleOptions) {
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
  }, [
    effectiveQuery,
    hideSelectedOptionWhenOpen,
    open,
    options,
    searchable,
    selectedOptionId,
  ]);

  return (
    <View
      className="relative"
      style={open ? { zIndex: 30 } : undefined}
      onTouchStart={onTouchStartInside}
    >
      <Text className={`${textClass} text-base font-semibold`}>{label}</Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>{helper}</Text>

      {searchable ? (
        <View
          className={`mt-4 border ${borderClass} rounded-2xl px-4 py-2 flex-row items-center`}
        >
          <TextInput
            ref={searchInputRef}
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
        <View
          className={`absolute left-0 right-0 mt-3 border ${borderClass} rounded-2xl p-3`}
          style={{
            top: "100%",
            zIndex: 35,
            elevation: 16,
            maxHeight: 320,
            backgroundColor: dropdownBackgroundColor,
            overflow: "hidden",
            opacity: 1,
          }}
        >
          {searchable && !effectiveQuery ? (
            <Text className={`${secondaryTextClass} text-xs mb-2`}>
              Scroll to browse all majors, or type to filter.
            </Text>
          ) : null}

          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="always"
            style={{ maxHeight: 270, backgroundColor: dropdownBackgroundColor }}
            contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
          >
            {filteredOptions.map((option) => (
              <AnimatedCardPressable
                key={option.id}
                onPress={() => {
                  searchInputRef.current?.blur();
                  setSearchQuery("");
                  onSelect(option.id);
                }}
                className={`border ${borderClass} rounded-2xl px-4 py-4`}
                style={{ backgroundColor: dropdownBackgroundColor, opacity: 1 }}
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
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function TranscriptSummaryCard({
  transcriptDocument,
  isAnalyzing,
  errorMessage,
  studentEvaluationReport,
  studentCourseEvaluations,
  plan,
  pathwayOptions,
  selectedPathwayLabel,
  hasNoDirectMajorEquivalencies,
  selectedCampusId,
  selectedCampusLabel,
  selectedMajorId,
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
  onSelectorTouchStartInside,
  onDismissCampus,
  onDismissMajor,
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
  dropdownBackgroundColor,
}: {
  transcriptDocument: TranscriptDocument | null;
  isAnalyzing: boolean;
  errorMessage: string | null;
  studentEvaluationReport: TransferPlannerStudentEvaluationReport | null;
  studentCourseEvaluations: TransferPlannerStudentCourseEvaluation[];
  plan: TransferPlannerResolvedMajorPlan;
  pathwayOptions: TransferPlannerMajorPathway[];
  selectedPathwayLabel: string | null;
  hasNoDirectMajorEquivalencies: boolean;
  selectedCampusId: TransferPlannerCampusId;
  selectedCampusLabel: string;
  selectedMajorId: string;
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
  onSelectorTouchStartInside: () => void;
  onDismissCampus: () => void;
  onDismissMajor: () => void;
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
  dropdownBackgroundColor: string;
}) {
  const [isPathwaySelectorOpen, setIsPathwaySelectorOpen] = useState(false);
  const visibleTrackSummary = getAutoTrackSummaryText(trackSummary);
  const visibleFinancialAidNote = String(financialAidNote ?? "").trim();
  const shouldShowBestTrackCard = Boolean(trackCode) && !hasNoDirectMajorEquivalencies;
  const hasOpenSelectorOverlay = openSelector !== null || isPathwaySelectorOpen;
  const cardOverlayStyle = hasOpenSelectorOverlay
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

  if (!transcriptDocument) {
    return (
      <View className={`${cardClass} border rounded-[28px] p-5`} style={cardOverlayStyle}>
        <View className="flex-row items-start">
          <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
            <Ionicons name="document-text-outline" size={20} color="#008f4e" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>
              Upload your unofficial transcript
            </Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              This planner uses the classes from your unofficial transcript PDF. The unofficial transcript is only stored locally.
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

      <View
        className={`border ${borderClass} rounded-2xl px-4 py-4 mt-5`}
        style={
          hasOpenSelectorOverlay
            ? { position: "relative", overflow: "visible", zIndex: 90, elevation: 90 }
            : { position: "relative", overflow: "visible" }
        }
      >
          <View
            className="mt-4"
            style={isDesktop ? { flexDirection: "row", alignItems: "flex-start", gap: 16 } : { gap: 16 }}
          >
            <View style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}>
              <SelectorField
                label="Campus"
                value={selectedCampusLabel}
                helper="Set the campus and major you want this Green River plan to match against."
                open={openSelector === "campus"}
                onToggle={onToggleCampus}
                onTouchStartInside={onSelectorTouchStartInside}
                onDismiss={onDismissCampus}
                options={campusOptions}
                onSelect={onSelectCampus}
                selectedOptionId={selectedCampusId}
                hideSelectedOptionWhenOpen
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                borderClass={borderClass}
                dropdownBackgroundColor={dropdownBackgroundColor}
              />
            </View>

            <View style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}>
              <SelectorField
                label="Major"
                value={selectedMajorLabel}
                helper="Pick the UW bachelor's degree you want the course plan to follow."
                open={openSelector === "major"}
                onToggle={onToggleMajor}
                onTouchStartInside={onSelectorTouchStartInside}
                onDismiss={onDismissMajor}
                options={majorOptions}
                onSelect={onSelectMajor}
                selectedOptionId={selectedMajorId}
                searchable
                searchPlaceholder="Search majors"
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                borderClass={borderClass}
                dropdownBackgroundColor={dropdownBackgroundColor}
              />
          </View>
        </View>
      </View>

      <MajorPathwaySection
        pathwayOptions={pathwayOptions}
        selectedPathwayId={plan.selectedPathwayId}
        selectedPathwayLabel={selectedPathwayLabel}
        isPathwaySelectorOpen={isPathwaySelectorOpen}
        onTogglePathway={() => setIsPathwaySelectorOpen((currentValue) => !currentValue)}
        onSelectPathway={(pathwayId) => {
          setIsPathwaySelectorOpen(false);
          onSelectPathway(pathwayId);
        }}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
        dropdownBackgroundColor={dropdownBackgroundColor}
      />

      {shouldShowBestTrackCard ? (
        <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
          <Text className={`${textClass} text-base font-semibold`}>Best Green River Transfer Associates path</Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            This shows the Green River degree path that best matches the UW degree you picked.
          </Text>

          <View className={`mt-4 border ${borderClass} rounded-2xl px-4 py-4`}>
            <Text className={`${textClass} font-semibold`}>
              {trackCode ? `${trackCode} | ${trackTitle}` : trackTitle}
            </Text>
            <Text className={`${secondaryTextClass} text-sm mt-2`}>{visibleTrackSummary}</Text>
            {visibleFinancialAidNote ? (
              <Text className={`${secondaryTextClass} text-sm mt-3`}>{visibleFinancialAidNote}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <MajorSpecificsSection
        plan={plan}
        selectedPathwayLabel={selectedPathwayLabel}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />
    </View>
  );
  }

  return (
    <View className={`${cardClass} border rounded-[28px] p-5`} style={cardOverlayStyle}>
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

      <View className="mt-3 flex-row items-center gap-4">
        <AnimatedIconPressable onPress={onUpload} className="self-start">
          <Text className="text-emerald-500 text-sm font-medium">Update transcript</Text>
        </AnimatedIconPressable>
        <AnimatedIconPressable onPress={onOpenTranscriptLink} className="self-start">
          <Text className="text-emerald-500 text-sm font-medium">Transcript</Text>
        </AnimatedIconPressable>
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
          <AnimatedIconPressable
            onPress={() => void openExternalLink(CTCLINK_UNOFFICIAL_TRANSCRIPT_URL)}
            className="self-start"
            containerStyle={{ marginTop: 12 }}
          >
            <Text className="text-emerald-500 font-medium">Open unofficial transcript in ctcLink</Text>
          </AnimatedIconPressable>
        </View>
      ) : null}

      <View
        className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}
        style={
          hasOpenSelectorOverlay
            ? { position: "relative", overflow: "visible", zIndex: 90, elevation: 90 }
            : { position: "relative", overflow: "visible" }
        }
      >
        <View
          className="mt-4"
          style={isDesktop ? { flexDirection: "row", alignItems: "flex-start", gap: 16 } : { gap: 16 }}
        >
          <View style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}>
            <SelectorField
              label="Campus"
              value={selectedCampusLabel}
              helper="Set the campus and major you want this Green River plan to match against."
              open={openSelector === "campus"}
              onToggle={onToggleCampus}
              onTouchStartInside={onSelectorTouchStartInside}
              onDismiss={onDismissCampus}
              options={campusOptions}
              onSelect={onSelectCampus}
              selectedOptionId={selectedCampusId}
              hideSelectedOptionWhenOpen
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
              dropdownBackgroundColor={dropdownBackgroundColor}
            />
          </View>

          <View style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}>
            <SelectorField
              label="Major"
              value={selectedMajorLabel}
              helper="Pick the UW bachelor's degree you want the course plan to follow."
              open={openSelector === "major"}
              onToggle={onToggleMajor}
              onTouchStartInside={onSelectorTouchStartInside}
              onDismiss={onDismissMajor}
              options={majorOptions}
              onSelect={onSelectMajor}
              selectedOptionId={selectedMajorId}
              searchable
              searchPlaceholder="Search majors"
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
              dropdownBackgroundColor={dropdownBackgroundColor}
            />
          </View>
        </View>
      </View>

      <MajorPathwaySection
        pathwayOptions={pathwayOptions}
        selectedPathwayId={plan.selectedPathwayId}
        selectedPathwayLabel={selectedPathwayLabel}
        isPathwaySelectorOpen={isPathwaySelectorOpen}
        onTogglePathway={() => setIsPathwaySelectorOpen((currentValue) => !currentValue)}
        onSelectPathway={(pathwayId) => {
          setIsPathwaySelectorOpen(false);
          onSelectPathway(pathwayId);
        }}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
        dropdownBackgroundColor={dropdownBackgroundColor}
      />

      {shouldShowBestTrackCard ? (
        <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
          <Text className={`${textClass} text-base font-semibold`}>Best Green River Transfer Associates path</Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            This shows the Green River degree path that best matches the UW degree you picked.
          </Text>

          <View className={`mt-4 border ${borderClass} rounded-2xl px-4 py-4`}>
            <Text className={`${textClass} font-semibold`}>
              {trackCode ? `${trackCode} | ${trackTitle}` : trackTitle}
            </Text>
            <Text className={`${secondaryTextClass} text-sm mt-2`}>{visibleTrackSummary}</Text>
            {visibleFinancialAidNote ? (
              <Text className={`${secondaryTextClass} text-sm mt-3`}>{visibleFinancialAidNote}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <MajorSpecificsSection
        plan={plan}
        selectedPathwayLabel={selectedPathwayLabel}
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
      />

      {studentEvaluationReport && completedCourses.length ? (
        <TranscriptEvaluationReportCard
          report={studentEvaluationReport}
          evaluations={studentCourseEvaluations}
          plan={plan}
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          cardClass={cardClass}
          borderClass={borderClass}
          embedded
        />
      ) : null}

    </View>
  );
}

function MajorPathwaySection({
  pathwayOptions,
  selectedPathwayId,
  selectedPathwayLabel,
  isPathwaySelectorOpen,
  onTogglePathway,
  onSelectPathway,
  textClass,
  secondaryTextClass,
  borderClass,
  dropdownBackgroundColor,
}: {
  pathwayOptions: TransferPlannerMajorPathway[];
  selectedPathwayId: string | null;
  selectedPathwayLabel: string | null;
  isPathwaySelectorOpen: boolean;
  onTogglePathway: () => void;
  onSelectPathway: (pathwayId: string) => void;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
  dropdownBackgroundColor: string;
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
          selectedOptionId={selectedPathwayId ?? pathwayOptions[0]?.id ?? null}
          hideSelectedOptionWhenOpen
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
          dropdownBackgroundColor={dropdownBackgroundColor}
        />
      </View>
    </View>
  );
}

function SuggestedScheduleCard({
  quarters,
  degreeTitle,
  campusLabel,
  selectedCampusId,
  onlyUwEssentialClasses,
  showOnlyUwEssentialClassesToggle,
  onToggleOnlyUwEssentialClasses,
  allowSummerClasses,
  onToggleAllowSummerClasses,
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
  selectedCampusId: TransferPlannerCampusId;
  onlyUwEssentialClasses: boolean;
  showOnlyUwEssentialClassesToggle: boolean;
  onToggleOnlyUwEssentialClasses: () => void;
  allowSummerClasses: boolean;
  onToggleAllowSummerClasses: () => void;
  currentCourseLabels: Set<string>;
  onToggleCurrentCourse: (courseLabel: string) => void;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
}) {
  const router = useRouter();
  const { isLight } = useAppTheme();
  const visibleQuarters = quarters.filter(
    (quarter) => quarter.phase !== "planned" || quarter.courses.length > 0
  );
  const plannedQuarterBadgeClass = isLight
    ? `bg-white border ${borderClass}`
    : "bg-white/5 border-white/10";
  const plannedCourseContainerClass = isLight
    ? `bg-white border ${borderClass}`
    : "bg-white/5 border border-white/10";

  return (
    <View className={`${cardClass} border rounded-[28px] p-5`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 min-w-0">
          <Text className={`${textClass} text-lg font-semibold`}>GRC Quarter Plan</Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            {`This is your transfer plan for finishing the ${degreeTitle} degree at ${getScheduleCampusLabel(campusLabel)}. Press the Classes for UW transfer only button to hide optional Green River track classes and focus on UW-required classes plus prerequisite dependencies.`}
          </Text>
        </View>

        {showOnlyUwEssentialClassesToggle ? (
          <View className="gap-2">
            <Pressable
              onPress={onToggleOnlyUwEssentialClasses}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: onlyUwEssentialClasses }}
              accessibilityLabel="Only show classes that transfer into UW on this track"
              accessibilityHint="Hides nonessential Green River track classes while keeping prerequisite classes that still unlock UW-required work."
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
            <Pressable
              onPress={onToggleAllowSummerClasses}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allowSummerClasses }}
              accessibilityLabel="Allow summer classes in quarter planning"
              accessibilityHint="Includes summer quarter when building your future course plan."
              className={`border ${borderClass} rounded-xl px-3 py-2 flex-row items-center justify-center gap-2`}
              hitSlop={8}
            >
              <Text className={`${secondaryTextClass} text-xs font-medium`}>
                Allow summer classes
              </Text>
              <Ionicons
                name={allowSummerClasses ? "checkbox" : "square-outline"}
                size={20}
                color={allowSummerClasses ? "#008f4e" : "#9CA3AF"}
              />
            </Pressable>
          </View>
        ) : null}
      </View>

      <View className="gap-4 mt-4">
        {visibleQuarters.map((quarter, quarterIndex) => (
          <View
            key={`${quarter.phase}-${quarter.label}-${quarterIndex}`}
            className={`border ${borderClass} rounded-2xl px-4 py-4`}
          >
            <View className="flex-row items-center justify-between gap-3">
              <Text className={`${textClass} font-semibold flex-1`}>{quarter.label}</Text>
              <View
                className={`px-3 py-1 rounded-full border ${
                  quarter.phase === "completed"
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : quarter.phase === "current"
                      ? "bg-sky-500/10 border-sky-500/20"
                    : plannedQuarterBadgeClass
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
                quarter.courses.map((course, courseIndex) => {
                  const courseDisplayLabel = getSuggestedScheduleCourseDisplayLabel(course.label);

                  return (
                    <View
                      key={`${quarter.label}-${course.label}-${courseIndex}`}
                      className={`px-3 py-3 rounded-2xl ${
                        course.status === "completed"
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : course.status === "current"
                            ? "bg-sky-500/10 border border-sky-500/20"
                            : course.type === "core"
                              ? "bg-emerald-500/10 border border-emerald-500/20"
                              : plannedCourseContainerClass
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
                            {(() => {
                              const courseTextClass = `text-sm font-medium ${
                                course.status === "completed"
                                  ? "text-emerald-500"
                                  : course.status === "current"
                                    ? "text-sky-400"
                                    : course.type === "core"
                                      ? "text-emerald-500"
                                      : textClass
                              }`;
                              const linkData = getSchedulePlaceholderRequirementLinkData(course.label);

                              if (!linkData) {
                                return (
                                  <Text className={courseTextClass}>
                                    {courseDisplayLabel}
                                  </Text>
                                );
                              }

                              const params: Record<string, string> = {
                                campusId: selectedCampusId,
                              };
                              if (linkData.tags.length) {
                                params.tag = linkData.tags.join(",");
                              }

                              return (
                                <Text
                                  className={`${courseTextClass} underline`}
                                  onPress={() =>
                                    router.push({
                                      pathname: ROUTES.transferEquivalencies,
                                      params,
                                    })
                                  }
                                >
                                  {courseDisplayLabel}
                                </Text>
                              );
                            })()}
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
                  );
                })
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

function TranscriptEvaluationReportCard({
  report,
  evaluations,
  plan,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
  embedded = false,
}: {
  report: TransferPlannerStudentEvaluationReport;
  evaluations: TransferPlannerStudentCourseEvaluation[];
  plan: TransferPlannerResolvedMajorPlan;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const studentFacingEvaluations = evaluations.filter((entry) => entry.studentFacing);
  const creditTotalsByTag = useMemo(
    () => buildRequirementCreditTotalsByTag(plan, studentFacingEvaluations),
    [plan, studentFacingEvaluations]
  );
  const completedCreditsByTag = useMemo(() => {
    const totals = new Map<string, number>();

    for (const evaluation of studentFacingEvaluations) {
      if (!shouldShowRequirementCreditMessage(evaluation)) continue;

      const creditAmount = evaluation.sourceCreditAmount ?? 5;
      const normalizedTags = Array.from(
        new Set(
          evaluation.targetRequirementTags
            .map((tag) => normalizeRequirementTag(tag))
            .filter(Boolean)
        )
      );

      for (const tag of normalizedTags) {
        totals.set(tag, (totals.get(tag) ?? 0) + creditAmount);
      }
    }

    return totals;
  }, [studentFacingEvaluations]);
  const activeBuckets = report.buckets.filter((bucket) => bucket.count > 0);
  const activeBucketLabels = activeBuckets.map((bucket) => bucket.label);
  const bucketLabelSummary =
    activeBucketLabels.length <= 1
      ? (activeBucketLabels[0] ?? "completed-class coverage")
      : activeBucketLabels.length === 2
        ? `${activeBucketLabels[0]} and ${activeBucketLabels[1]}`
        : `${activeBucketLabels.slice(0, -1).join(", ")}, and ${activeBucketLabels[activeBucketLabels.length - 1]}`;
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);

  if (!report.completedCourseCount) {
    return null;
  }

  const containerClass = embedded
    ? `border ${borderClass} rounded-2xl px-4 py-4 mt-4`
    : `${cardClass} border rounded-[28px] p-5`;

  return (
    <View className={containerClass}>
      <AnimatedCardPressable
        onPress={() => setIsEvaluationOpen((currentValue) => !currentValue)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isEvaluationOpen }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>Transcript evaluation</Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              This gives you {bucketLabelSummary} for completed classes in {report.majorTitle}. These buckets come from approved equivalency rules, not custom guessing.
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10">
              <Text className="text-emerald-500 text-xs font-semibold">
                {report.officialRuleIds.length} rule{report.officialRuleIds.length === 1 ? "" : "s"}
              </Text>
            </View>
            <Ionicons
              name={isEvaluationOpen ? "chevron-up" : "chevron-down"}
              size={20}
              color="#9CA3AF"
            />
          </View>
        </View>
      </AnimatedCardPressable>

      {isEvaluationOpen ? (
        <>
          <View className="flex-row flex-wrap gap-2 mt-4">
            {activeBuckets.map((bucket) => (
              <View key={bucket.id} className={`border ${borderClass} rounded-2xl px-3 py-2`}>
                <Text className={`${textClass} text-xs font-semibold`}>{bucket.label}</Text>
                <Text className={`${secondaryTextClass} text-xs mt-1`}>
                  {bucket.count} course{bucket.count === 1 ? "" : "s"}
                </Text>
              </View>
            ))}
          </View>

          <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
            <Text className={`${textClass} font-semibold`}>Source-backed summary</Text>
            <View className="gap-2 mt-3">
              {report.reportSummaryLines.map((line) => (
                <View key={line} className="flex-row items-start gap-2">
                  <Text className={`${secondaryTextClass} text-sm`}>{"-"}</Text>
                  <Text className={`${secondaryTextClass} text-sm flex-1`}>{line}</Text>
                </View>
              ))}
            </View>
            <Text className={`${secondaryTextClass} text-xs mt-3`}>
              {`${report.sourceLinkCount} official source link${report.sourceLinkCount === 1 ? "" : "s"} attached to the evaluated rules.`}
            </Text>
          </View>

          {studentFacingEvaluations.length ? (
            <View className="gap-3 mt-4">
              {studentFacingEvaluations.map((evaluation) => {
                const requirementCreditMessage = getEvaluationRequirementCreditMessageParts({
                  evaluation,
                  totalsByTag: creditTotalsByTag,
                  completedByTag: completedCreditsByTag,
                  campusId: plan.campusId,
                });

                return (
                  <View
                    key={evaluation.id}
                    className={`border ${borderClass} rounded-2xl px-4 py-4`}
                  >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1 min-w-0">
                      <Text className={`${textClass} font-semibold`}>{evaluation.courseCode}</Text>
                      <Text className={`${secondaryTextClass} text-xs mt-1`} numberOfLines={2}>
                        {evaluation.targetOutcome ?? "No source-backed UW target outcome for this selected major."}
                      </Text>
                    </View>
                    <View className={`px-3 py-1 rounded-full border ${getEvaluationOutcomeBadgeClass(evaluation.outcome)}`}>
                      <Text
                        className={`text-xs font-semibold ${getEvaluationOutcomeTextClass(
                          evaluation.outcome,
                          textClass
                        )}`}
                      >
                        {getEvaluationOutcomeBadgeLabel(evaluation.outcome)}
                      </Text>
                    </View>
                  </View>

                  {evaluation.missingSourceCourseCodes.length ? (
                    <Text className={`${secondaryTextClass} text-xs mt-2`}>
                      Missing for strongest sequence: {evaluation.missingSourceCourseCodes.join(", ")}
                    </Text>
                  ) : null}

                  {evaluation.automaticGuidanceSummary ? (
                    <Text className={`${secondaryTextClass} text-xs mt-2`}>
                      {evaluation.automaticGuidanceSummary}
                    </Text>
                  ) : null}

                  {requirementCreditMessage ? (
                    <Text className={`${secondaryTextClass} text-xs mt-2`}>
                      {requirementCreditMessage.prefix}
                      <Text
                        className="text-emerald-500 underline"
                        onPress={() =>
                          router.push({
                            pathname: ROUTES.transferEquivalencies,
                            params: {
                              tag: requirementCreditMessage.normalizedTag,
                              campusId: requirementCreditMessage.campusId,
                            },
                          })
                        }
                      >
                        {requirementCreditMessage.clickableLabel}
                      </Text>
                      {requirementCreditMessage.suffix}
                    </Text>
                  ) : null}
                </View>
                );
              })}
            </View>
          ) : null}

          {report.hiddenEvaluationCount ? (
            <View className="mt-4 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <Text className="text-amber-500 text-sm font-semibold">
                Hidden source-gap evaluation
              </Text>
              <Text className={`${secondaryTextClass} text-xs mt-1`}>
                {report.hiddenEvaluationCount} course evaluation{report.hiddenEvaluationCount === 1 ? "" : "s"} stayed internal because this planner path is not source-verified for students.
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function MajorSpecificsSection({
  plan,
  selectedPathwayLabel,
  textClass,
  secondaryTextClass,
  borderClass,
}: {
  plan: TransferPlannerResolvedMajorPlan;
  selectedPathwayLabel: string | null;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
}) {
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
  const majorSpecificsSummaryText = primaryUwDegreeLink
    ? degreeMapSections.length
      ? "Open this dropdown for the official UW degree page and degree-specific requirement sections for your selected major."
      : "Open this dropdown for the official UW degree page for your selected major."
    : degreeMapSections.length
      ? "Open this dropdown for degree-specific requirement sections for your selected major."
      : "Open this dropdown for major details as they become available.";
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
              {majorSpecificsSummaryText}
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
  const { isHydrated, state, updateUser, setQuestionnaireAnswers } = useAppData();
  const { getScrollContentPadding } = useResponsiveLayout();

  const [selectedCampusId, setSelectedCampusId] =
    useState<TransferPlannerCampusId>("uw-seattle");
  const [selectedMajorId, setSelectedMajorId] = useState<string>(
    getTransferPlannerStudentRuntimeMajorsForCampus("uw-seattle")[0]?.id ?? ""
  );
  const [openSelector, setOpenSelector] = useState<"campus" | "major" | null>(null);
  const [transcriptDocument, setTranscriptDocument] = useState<TranscriptDocument | null>(null);
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [onlyUwEssentialClasses, setOnlyUwEssentialClasses] = useState(false);
  const [allowSummerClasses, setAllowSummerClasses] = useState(false);

  const transcriptAnalysisAttemptsRef = useRef<Set<string>>(new Set());
  const selectorWasOpenOnTouchStartRef = useRef(false);
  const selectorTouchStartedInsideRef = useRef(false);

  const { textClass, secondaryTextClass, cardBgClass, borderClass, dropdownSurfaceColor } = styles;
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
    () => getTransferPlannerStudentRuntimeMajorsForCampus(selectedCampusId),
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
  const storedLastSelectedPlan = useMemo(
    () => normalizePlannerLastSelectedPlan(state.questionnaireAnswers?.[LAST_SELECTED_PLAN_FIELD]),
    [state.questionnaireAnswers]
  );
  const pathwayOptions = useMemo(
    () => getTransferPlannerStudentRuntimePathwaysForPlan(selectedBasePlan),
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
    () => resolveTransferPlannerStudentRuntimeMajorPlan(selectedBasePlan, selectedPathwayId),
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
  const hydratedLastSelectionRef = useRef(false);
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
    if (!isHydrated || hydratedLastSelectionRef.current) return;

    hydratedLastSelectionRef.current = true;
    if (!storedLastSelectedPlan) return;

    const matchedCampus = TRANSFER_PLANNER_CAMPUSES.find(
      (entry) => entry.id === storedLastSelectedPlan.campusId
    );
    if (!matchedCampus) return;

    const nextMajors = getTransferPlannerStudentRuntimeMajorsForCampus(matchedCampus.id);
    const matchedMajor = nextMajors.find((entry) => entry.id === storedLastSelectedPlan.majorId);
    if (!matchedMajor) return;

    autoMajorSelectionRef.current = true;
    setSelectedCampusId(matchedCampus.id);
    setSelectedMajorId(matchedMajor.id);
  }, [isHydrated, storedLastSelectedPlan]);

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
    if (!isHydrated || !selectedMajorId) return;

    const currentCampusId = String(storedLastSelectedPlan?.campusId ?? "").trim();
    const currentMajorId = String(storedLastSelectedPlan?.majorId ?? "").trim();
    if (currentCampusId === selectedCampusId && currentMajorId === selectedMajorId) return;

    void setQuestionnaireAnswers({
      ...state.questionnaireAnswers,
      [LAST_SELECTED_PLAN_FIELD]: {
        campusId: selectedCampusId,
        majorId: selectedMajorId,
      },
    });
  }, [
    isHydrated,
    selectedCampusId,
    selectedMajorId,
    setQuestionnaireAnswers,
    state.questionnaireAnswers,
    storedLastSelectedPlan,
  ]);

  useEffect(() => {
    let active = true;

    if (!user?.uid) {
      setTranscriptDocument(null);
      return () => {
        active = false;
      };
    }

    void (async () => {
      const stored = await storageService.getTranscript(user.uid).catch(() => null);
      if (!active) return;
      setTranscriptDocument(stored && stored.url ? stored : null);
    })();

    return () => {
      active = false;
    };
  }, [user?.uid]);

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
  const shouldShowUwOnlyToggle = Boolean(track) || hasOptionalStayAtGrcChecklist;
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
        includeSummerQuarter: allowSummerClasses,
      }),
    [
      applicationStatuses,
      beforeEnrollmentStatuses,
      completedCourses,
      currentPlannedCourseLabels,
      allowSummerClasses,
      onlyUwEssentialClasses,
      plan,
      stayAtGrcStatuses,
      track,
    ]
  );
  const studentCourseEvaluations = useMemo(
    () =>
      plan
        ? buildTransferPlannerStudentCourseEvaluations({
            plan,
            completedCourses,
            applicationStatuses,
            beforeEnrollmentStatuses,
            stayAtGrcStatuses,
          })
        : [],
    [
      applicationStatuses,
      beforeEnrollmentStatuses,
      completedCourses,
      plan,
      stayAtGrcStatuses,
    ]
  );
  const studentEvaluationReport = useMemo(
    () =>
      plan
        ? buildTransferPlannerStudentEvaluationReport({
            plan,
            campusLabel: campus.title,
            completedCourses,
            evaluations: studentCourseEvaluations,
            suggestedQuarterPlan,
          })
        : null,
    [
      campus.title,
      completedCourses,
      plan,
      studentCourseEvaluations,
      suggestedQuarterPlan,
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
  const hasNoDirectMajorEquivalencies = useMemo(
    () => !!plan && !hasAnyDirectMajorEquivalencies(plan),
    [plan]
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
          keyboardShouldPersistTaps="always"
          onTouchStart={() => {
            selectorWasOpenOnTouchStartRef.current = openSelector !== null;
            selectorTouchStartedInsideRef.current = false;
          }}
          onTouchEnd={() => {
            if (
              selectorWasOpenOnTouchStartRef.current &&
              !selectorTouchStartedInsideRef.current
            ) {
              setOpenSelector(null);
            }
            selectorWasOpenOnTouchStartRef.current = false;
            selectorTouchStartedInsideRef.current = false;
          }}
          onScrollBeginDrag={() => setOpenSelector(null)}
          scrollEnabled
        >
        <View
          style={{
            alignSelf: "center",
            width: "100%",
            maxWidth: shellMaxWidth,
            paddingHorizontal: shellHorizontalPadding,
            paddingTop: scrollContentPadding.paddingTop + 12,
            gap: 24,
            position: "relative",
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
                  Classes for Green River College are cheaper/easier than those at the University of Washington. This tool matches you with a transfer track most compatible with your major, letting you take advantage of it by showing you every course that directly transfers in.
                </Text>
              </View>
            </View>
          </View>

          <TranscriptSummaryCard
            transcriptDocument={transcriptDocument}
            isAnalyzing={isAnalyzingTranscript || needsTranscriptReparse}
            errorMessage={transcriptError}
            studentEvaluationReport={studentEvaluationReport}
            studentCourseEvaluations={studentCourseEvaluations}
            plan={plan}
            pathwayOptions={pathwayOptions}
            selectedPathwayLabel={plan.selectedPathwayLabel}
            hasNoDirectMajorEquivalencies={hasNoDirectMajorEquivalencies}
            selectedCampusId={selectedCampusId}
            selectedCampusLabel={campus.title}
            selectedMajorId={selectedMajorId}
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
            onSelectorTouchStartInside={() => {
              selectorTouchStartedInsideRef.current = true;
            }}
            onDismissCampus={() =>
              setOpenSelector((current) => (current === "campus" ? null : current))
            }
            onDismissMajor={() =>
              setOpenSelector((current) => (current === "major" ? null : current))
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
            dropdownBackgroundColor={dropdownSurfaceColor}
          />

          {hasNoDirectMajorEquivalencies ? (
            <View className={`${cardBgClass} border rounded-[28px] p-5`}>
              <Text className={`${textClass} text-lg font-semibold`}>
                No class equivalencies for {plan.title}
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-2`}>
                There are no class equivalencies for this path right now.
              </Text>
              {isOpenAdmissionMajor(plan) ? (
                <Text className={`${secondaryTextClass} text-sm mt-2`}>
                  This is an open major. You would transfer through general UW admission first,
                  then declare {plan.title} through the department&apos;s current process after you
                  enroll.
                </Text>
              ) : null}
            </View>
          ) : null}

          {!hasStructuredPlannerData ? (
            <View className={`${cardBgClass} border rounded-[28px] p-5`}>
              <Text className={`${textClass} text-lg font-semibold`}>
                Quarter plan note
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                This degree does not have a fixed quarter-by-quarter plan yet. Use the Green River class list and source-backed class-order notes above as your starting point. Unsupported ordering details stay hidden until public sources can verify them.
              </Text>
            </View>
          ) : null}

          {hasStructuredPlannerData ? (
            <>
              <SuggestedScheduleCard
                key={plannerPathKey}
                quarters={suggestedQuarterPlan}
                degreeTitle={
                  plan.selectedPathwayLabel
                    ? `${plan.title} (${plan.selectedPathwayLabel})`
                    : plan.title
                }
                campusLabel={campus.title}
                selectedCampusId={plan.campusId}
                onlyUwEssentialClasses={onlyUwEssentialClasses}
                showOnlyUwEssentialClassesToggle={shouldShowUwOnlyToggle}
                onToggleOnlyUwEssentialClasses={() =>
                  setOnlyUwEssentialClasses((current) => !current)
                }
                allowSummerClasses={allowSummerClasses}
                onToggleAllowSummerClasses={() =>
                  setAllowSummerClasses((current) => !current)
                }
                currentCourseLabels={currentPlannedCourseSet}
                onToggleCurrentCourse={handleToggleCurrentCourse}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                cardClass={cardBgClass}
                borderClass={borderClass}
              />
            </>
          ) : null}

        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
