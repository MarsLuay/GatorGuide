import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
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
import { SUPPORT_EMAIL } from "@/constants/support";
import { StateCard } from "@/components/ui/StateCard";
import {
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerCanonicalCourse,
  getTransferPlannerEquivalencyRulesForSourceCourse,
  getTransferPlannerStudentRuntimeMajorsForCampus,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  getTransferPlannerTrack,
  TRANSFER_PLANNER_TRACKS,
  resolveTransferPlannerStudentRuntimeMajorPlan,
  TRANSFER_PLANNER_CAMPUSES,
  type TransferPlannerCampusId,
  type TransferPlannerEquivalencyRule,
  type TransferPlannerGeneralRequirementSection,
  type TransferPlannerMajorPathway,
  type TransferPlannerResolvedMajorPlan,
  type TransferPlannerStudentCourseEvaluation,
  type TransferPlannerTrack,
} from "@/constants/transfer-planner-source";
import { useAppData } from "@/hooks/use-app-data";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { errorLoggingService, transcriptPlannerDebugService } from "@/services";
import { storageService, type UploadedFile } from "@/services/storage/storage.service";
import {
  buildSourceBackedMajorGeneralEducationRequirementSection,
  buildSourceBackedGeneralEducationRequirementTargets,
  buildSourceBackedRequiredCourseSummaryEntries,
  buildSourceBackedRequiredCourseCodes,
  buildSuggestedQuarterPlan,
  buildUwGeneralTransferRequirementSection,
  buildRequirementStatuses,
  buildTransferPlannerStudentCourseEvaluations,
  buildTransferPlannerStudentEvaluationReport,
  extractCourseCodes,
  getPreparatoryTrackCourseCodeSet,
  getResolvedTrackTermsForRequirementDisplay,
  parseCompletedTranscriptCourses,
  type SuggestedQuarterPlan,
  type TransferPlannerStudentEvaluationReport,
  type TranscriptCourseEntry,
} from "@/services/planning/transfer-planner.service";
import { resetTranscriptState } from "@/services/planning/transcript-reset.service";
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
const GRC_PLANNER_CAMPUS_ID = "grc";
const GENERATED_PROGRAM_MAP_SUMMARY_SENTENCE = [
  "Generated automatically",
  "from the current public program-map page",
  "and catalog API.",
].join(" ");

type PlannerCollegeId = "uw" | "grc";
type PlannerCampusSelectionId = TransferPlannerCampusId | typeof GRC_PLANNER_CAMPUS_ID;
type PlannerSelectorKey = "college" | "campus" | "major" | null;
type SelectorOverlayStrategy = "inline" | "inline-isolated" | "modal";

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

  const rawCollegeId = (rawValue as Record<string, unknown>).collegeId;
  const rawCampusId = (rawValue as Record<string, unknown>).campusId;
  const rawMajorId = (rawValue as Record<string, unknown>).majorId;
  const collegeId = String(rawCollegeId ?? "").trim().toLowerCase();
  const campusId = String(rawCampusId ?? "").trim();
  const majorId = String(rawMajorId ?? "").trim();
  if (!campusId || !majorId) return null;

  return {
    collegeId: collegeId === "grc" || campusId === GRC_PLANNER_CAMPUS_ID ? "grc" : "uw",
    campusId,
    majorId,
  } as {
    collegeId: PlannerCollegeId;
    campusId: PlannerCampusSelectionId;
    majorId: string;
  };
}

function isPlannerUwCampusId(value: string): value is TransferPlannerCampusId {
  return TRANSFER_PLANNER_CAMPUSES.some((entry) => entry.id === value);
}

function getDefaultPlannerCampusId(collegeId: PlannerCollegeId): PlannerCampusSelectionId {
  return collegeId === "grc" ? GRC_PLANNER_CAMPUS_ID : "uw-seattle";
}

function getCollegeOptionLabel(collegeId: PlannerCollegeId) {
  return collegeId === "grc" ? "Green River College" : "University of Washington";
}

function getPlannerHeroContent(collegeId: PlannerCollegeId) {
  if (collegeId === "grc") {
    return {
      title: "Green River Course Planner",
      description:
        "This planner reads your completed Green River classes and maps them against the currently tracked Green River program paths so you can see what is already done and what is still needed for the program you pick.",
    };
  }

  return {
    title: "GRC -> UW Course Planner",
    description:
      "Classes for Green River College are cheaper/easier than those at the University of Washington. This tool matches you with a transfer track most compatible with your major, letting you take advantage of it by showing you every course that directly transfers in. Always check with your advisor before scheduling classes!",
  };
}

function getPlannerSelectionHelperText(
  collegeId: PlannerCollegeId,
  field: "college" | "campus" | "major"
) {
  if (field === "college") {
    return "Pick the college whose program requirements you want this planner to follow.";
  }

  if (field === "campus") {
    return collegeId === "grc"
      ? "Green River currently has one supported campus in this planner."
      : "Set the UW campus and major you want this Green River plan to match against.";
  }

  return collegeId === "grc"
    ? "Pick the Green River program you want the course plan to follow."
    : "Pick the UW bachelor's degree you want the course plan to follow.";
}

function getPlannerMajorSearchPlaceholder(collegeId: PlannerCollegeId) {
  return collegeId === "grc" ? "Search programs" : "Search majors";
}

function getPlannerNoDataMessage(collegeId: PlannerCollegeId) {
  return collegeId === "grc"
    ? "There is not a Green River program plan for this path yet."
    : "There is not a course plan for this campus yet.";
}

function stripGeneratedProgramMapSummarySentence(text: string | null | undefined) {
  return String(text ?? "")
    .replace(GENERATED_PROGRAM_MAP_SUMMARY_SENTENCE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type GrcTrackCredentialKind = "associate" | "certificate" | "bas";

function getGrcTrackCredentialKind(
  track: TransferPlannerTrack | null | undefined
): GrcTrackCredentialKind {
  const normalizedText = [
    String(track?.code ?? ""),
    String(track?.title ?? ""),
    String(track?.summary ?? ""),
    ...(Array.isArray(track?.notes) ? track.notes : []),
  ]
    .join(" ")
    .toLowerCase();

  if (/\bbas\b|bachelor of applied science/i.test(normalizedText)) {
    return "bas";
  }

  if (
    /\bcertificate\b|certificate of completion|certificate of accomplishment|certificate of proficiency/i.test(
      normalizedText
    )
  ) {
    return "certificate";
  }

  return "associate";
}

function getGrcTrackRequirementNoun(track: TransferPlannerTrack | null | undefined) {
  return getGrcTrackCredentialKind(track) === "associate" ? "degree" : "program";
}

function getGrcTrackSpecificsTitle(track: TransferPlannerTrack | null | undefined) {
  return getGrcTrackRequirementNoun(track) === "degree" ? "Degree Specifics" : "Program Specifics";
}

function getGrcTrackClassesLabelSuffix(track: TransferPlannerTrack | null | undefined) {
  return getGrcTrackRequirementNoun(track) === "degree" ? "Degree Classes" : "Program Classes";
}

function getScheduleCampusLabel(collegeId: PlannerCollegeId, campusLabel: string) {
  const trimmed = String(campusLabel ?? "").trim();
  if (collegeId === "grc") {
    return trimmed || "Green River College";
  }
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

function getRequirementTagSearchLabels(normalizedTag: string) {
  switch (normalizedTag) {
    case "AH":
      return ["A&H", "Arts and Humanities", "Humanities"];
    case "SSC":
      return ["SSc", "Social Sciences", "Social Science"];
    case "NSC":
      return ["NSc", "Natural Sciences", "Natural Science"];
    case "QSR":
      return ["QSR", "Quantitative and Symbolic Reasoning"];
    case "VLPA":
      return ["VLPA", "Visual, Literary, and Performing Arts"];
    case "DIV":
      return ["DIV", "Diversity"];
    case "NW":
      return ["NW", "Natural World"];
    case "IANDS":
      return ["I&S", "Individuals and Societies"];
    default:
      return [getRequirementTagLabel(normalizedTag)];
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferRequirementCreditTotalFromText(text: string, normalizedTag: string) {
  const tagSearchLabels = Array.from(new Set(getRequirementTagSearchLabels(normalizedTag)));

  for (const tagLabel of tagSearchLabels) {
    const escapedTag = escapeRegExp(tagLabel);
    const patterns = [
      new RegExp(`${escapedTag}[^\\n]{0,80}?(\\d+(?:\\.\\d+)?)\\s*credits`, "i"),
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*credits[^\\n]{0,80}?${escapedTag}`, "i"),
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) continue;

      const parsed = Number.parseFloat(match[1] ?? "");
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

function normalizePlannerCourseCode(value: string) {
  const normalized = String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^([A-Z&]+(?: [A-Z&]+)*) (\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (!match) {
    return normalized;
  }

  const subjectTokens = match[1].split(" ").filter(Boolean);
  const normalizedSubject = subjectTokens.every((token) => token.length === 1)
    ? subjectTokens.join("")
    : subjectTokens.join(" ");

  return `${normalizedSubject} ${match[2]}`;
}

function joinPlannerLabelList(labels: string[]) {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function getPlanDegreeMapSearchText(plan: TransferPlannerResolvedMajorPlan) {
  return (plan.degreeMapSections ?? [])
    .flatMap((section) => [section.title, section.note ?? "", ...section.items])
    .join("\n");
}

type MajorSpecificsGeneralEducationCategoryId =
  | "ah"
  | "ssc"
  | "nsc"
  | "breadth"
  | "div"
  | "qsr"
  | "vlpa"
  | "nw"
  | "iands";

type MajorSpecificsGeneralEducationCreditLine = {
  id: MajorSpecificsGeneralEducationCategoryId;
  label: string;
  credits: number;
};

const MAJOR_SPECIFICS_GENERAL_ED_CATEGORIES: {
  id: MajorSpecificsGeneralEducationCategoryId;
  label: string;
}[] = [
  { id: "ah", label: "Arts & Humanities Classes" },
  { id: "ssc", label: "Social Science Classes" },
  { id: "nsc", label: "Natural Science Classes" },
  { id: "breadth", label: "Flexible Breadth Classes" },
  { id: "div", label: "Diversity Classes" },
  { id: "qsr", label: "Quantitative & Symbolic Reasoning Classes" },
  { id: "vlpa", label: "Visual, Literary & Performing Arts Classes" },
  { id: "nw", label: "Natural World Classes" },
  { id: "iands", label: "Individuals & Societies Classes" },
];

type MajorSpecificsGeneralEducationCreditTotals = Record<
  MajorSpecificsGeneralEducationCategoryId,
  number
>;

function createEmptyMajorSpecificsGeneralEducationCreditTotals(): MajorSpecificsGeneralEducationCreditTotals {
  return {
    ah: 0,
    ssc: 0,
    nsc: 0,
    breadth: 0,
    div: 0,
    qsr: 0,
    vlpa: 0,
    nw: 0,
    iands: 0,
  };
}

function buildMajorSpecificsGeneralEducationCreditLinesFromTotals(
  totals: MajorSpecificsGeneralEducationCreditTotals
): MajorSpecificsGeneralEducationCreditLine[] {
  return MAJOR_SPECIFICS_GENERAL_ED_CATEGORIES.map((entry) => ({
    id: entry.id,
    label: entry.label,
    credits: totals[entry.id] ?? 0,
  })).filter((entry) => entry.credits > 0);
}

function inferMajorSpecificsGeneralEducationCreditsFromTrackLabel(courseLabel: string) {
  const normalizedLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedLabel) return 0;

  const explicitCreditsMatch = normalizedLabel.match(/(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b/i);
  if (explicitCreditsMatch) {
    const parsedCredits = Number.parseFloat(explicitCreditsMatch[1] ?? "");
    if (Number.isFinite(parsedCredits) && parsedCredits > 0) {
      return parsedCredits;
    }
  }

  const repeatedCourseCountMatch = normalizedLabel.match(/^(\d+)\s+[A-Z]\b/i);
  if (repeatedCourseCountMatch) {
    const parsedCourseCount = Number.parseInt(repeatedCourseCountMatch[1] ?? "", 10);
    if (Number.isFinite(parsedCourseCount) && parsedCourseCount > 0) {
      return parsedCourseCount * 5;
    }
  }

  if (/^[A-Z]\s*\d+\b/i.test(normalizedLabel)) {
    return 5;
  }

  if (
    /\b(?:humanit|fine arts|arts and humanities|social sciences?|natural sciences?|diversity|qsr|quantitative|vlpa|visual,\s*literary|natural world|individuals?\s+and\s+societies|i&s)\b/i.test(
      normalizedLabel
    )
  ) {
    return 5;
  }

  return 0;
}

function getMajorSpecificsGeneralEducationCategoryIdsForTrackLabel(
  courseLabel: string
): MajorSpecificsGeneralEducationCategoryId[] {
  const normalizedLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedLabel || extractCourseCodes(normalizedLabel).length > 0) {
    return [];
  }

  if (
    /^(?:suggested|recommend|consider|see\b|discuss\b|students?\s+are\s+responsible\b|green river college is fully accredited\b)/i.test(
      normalizedLabel
    )
  ) {
    return [];
  }

  const lower = normalizedLabel.toLowerCase();
  const categories = new Set<MajorSpecificsGeneralEducationCategoryId>();
  const hasHumanities =
    lower.includes("humanit") ||
    lower.includes("fine arts") ||
    lower.includes("arts and humanities") ||
    /\ba&h\b/i.test(normalizedLabel) ||
    /^\s*h\s*\d+\b/i.test(normalizedLabel);
  const hasSocialScience =
    lower.includes("social science") ||
    /\bssc\b/i.test(normalizedLabel) ||
    /^\s*s\s*\d+\b/i.test(normalizedLabel);
  const hasNaturalScience =
    lower.includes("natural science") ||
    /\bnsc\b/i.test(normalizedLabel) ||
    /^\s*n\s*\d+\b/i.test(normalizedLabel);
  const hasFlexibleBreadth =
    /(?:\badditional areas?\s+of inquiry\b|\bor\b)/i.test(normalizedLabel) &&
    [hasHumanities, hasSocialScience, hasNaturalScience].filter(Boolean).length >= 2;

  if (hasFlexibleBreadth) {
    categories.add("breadth");
  } else {
    if (hasHumanities) categories.add("ah");
    if (hasSocialScience) categories.add("ssc");
    if (hasNaturalScience) categories.add("nsc");
  }

  if (
    /^\s*d\s*\d+\b/i.test(normalizedLabel) ||
    /\bdiversity\b[^.]{0,48}\b(?:requirement|required|minimum|must|need)\b/i.test(normalizedLabel) ||
    /\b\d+\s*(?:credits?|cr)\b[^.]{0,48}\bdiversity\b/i.test(normalizedLabel)
  ) {
    categories.add("div");
  }

  if (
    /\bqsr\b/i.test(normalizedLabel) ||
    /quantitative(?:\s+and)?\s+symbolic reasoning/i.test(normalizedLabel)
  ) {
    categories.add("qsr");
  }

  if (
    /\bvlpa\b/i.test(normalizedLabel) ||
    /visual,\s*literary(?:,\s*and)?\s+performing arts/i.test(normalizedLabel)
  ) {
    categories.add("vlpa");
  }

  if (/\bnw\b/i.test(normalizedLabel) || /natural world/i.test(normalizedLabel)) {
    categories.add("nw");
  }

  if (/\bi&s\b/i.test(normalizedLabel) || /individuals?\s+and\s+societies/i.test(normalizedLabel)) {
    categories.add("iands");
  }

  return Array.from(categories);
}

function buildMajorSpecificsSourceBackedUwGeneralEducationCreditLines(
  plan: TransferPlannerResolvedMajorPlan
) {
  const searchableText = getPlanDegreeMapSearchText(plan);
  const parsedTargets = buildSourceBackedGeneralEducationRequirementTargets(plan);
  const totals = createEmptyMajorSpecificsGeneralEducationCreditTotals();

  totals.ah = parsedTargets.ahCredits ?? inferRequirementCreditTotalFromText(searchableText, "AH") ?? 0;
  totals.ssc = parsedTargets.sscCredits ?? inferRequirementCreditTotalFromText(searchableText, "SSC") ?? 0;
  totals.nsc = parsedTargets.nscCredits ?? inferRequirementCreditTotalFromText(searchableText, "NSC") ?? 0;
  totals.breadth = parsedTargets.breadthCredits ?? 0;
  totals.div = inferRequirementCreditTotalFromText(searchableText, "DIV") ?? 0;
  totals.qsr = inferRequirementCreditTotalFromText(searchableText, "QSR") ?? 0;
  totals.vlpa = inferRequirementCreditTotalFromText(searchableText, "VLPA") ?? 0;
  totals.nw = inferRequirementCreditTotalFromText(searchableText, "NW") ?? 0;
  totals.iands = inferRequirementCreditTotalFromText(searchableText, "IANDS") ?? 0;

  return buildMajorSpecificsGeneralEducationCreditLinesFromTotals(totals);
}

function buildInferredMajorSpecificsSupplementalUwGeneralEducationItems(
  plan: TransferPlannerResolvedMajorPlan
): TransferPlannerGeneralRequirementSection["items"] {
  const searchableText = getPlanDegreeMapSearchText(plan);
  const totals = createEmptyMajorSpecificsGeneralEducationCreditTotals();
  totals.div = inferRequirementCreditTotalFromText(searchableText, "DIV") ?? 0;
  totals.qsr = inferRequirementCreditTotalFromText(searchableText, "QSR") ?? 0;
  totals.vlpa = inferRequirementCreditTotalFromText(searchableText, "VLPA") ?? 0;
  totals.nw = inferRequirementCreditTotalFromText(searchableText, "NW") ?? 0;
  totals.iands = inferRequirementCreditTotalFromText(searchableText, "IANDS") ?? 0;

  return buildMajorSpecificsGeneralEducationCreditLinesFromTotals(totals).map((entry) => ({
    id: entry.id,
    label: entry.label,
    valueText: `${entry.credits} credits`,
    note: undefined,
    sourceKind: "source-backed-major" as const,
  }));
}

function buildMajorSpecificsSourceBackedUwGeneralEducationSection(
  plan: TransferPlannerResolvedMajorPlan
) {
  const sourceBackedSection = buildSourceBackedMajorGeneralEducationRequirementSection(plan);
  const supplementalItems = buildInferredMajorSpecificsSupplementalUwGeneralEducationItems(plan);
  const mergedItems = [
    ...(sourceBackedSection?.items ?? []),
    ...supplementalItems.filter(
      (item) => !(sourceBackedSection?.items ?? []).some((existingItem) => existingItem.id === item.id)
    ),
  ];

  if (!mergedItems.length) {
    return null;
  }

  return {
    id: sourceBackedSection?.id ?? "source-backed-major-general-education",
    title: sourceBackedSection?.title ?? "Major Required Gen-Eds",
    summary:
      sourceBackedSection?.summary ??
      "Source-backed major-specific general education targets from the current official major materials.",
    campusId: sourceBackedSection?.campusId ?? plan.campusId,
    sourceKind: sourceBackedSection?.sourceKind ?? ("source-backed-major" as const),
    plannerUsage: sourceBackedSection?.plannerUsage ?? ("summary-only" as const),
    items: mergedItems,
  } satisfies TransferPlannerGeneralRequirementSection;
}

function buildMajorSpecificsGrcGeneralEducationCreditLines(args: {
  plan: TransferPlannerResolvedMajorPlan | null;
  track: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
}) {
  const { plan, track, completedCourses } = args;
  if (!track) {
    return plan ? buildMajorSpecificsSourceBackedUwGeneralEducationCreditLines(plan) : [];
  }

  const totals = createEmptyMajorSpecificsGeneralEducationCreditTotals();
  const resolvedTerms = getResolvedTrackTermsForRequirementDisplay(track, completedCourses).filter(
    (term) => !GRC_TRACK_NOTE_TERM_LABEL_PATTERN.test(String(term.label ?? "").trim())
  );

  for (const courseLabel of resolvedTerms.flatMap((term) => term.courses)) {
    const categoryIds = getMajorSpecificsGeneralEducationCategoryIdsForTrackLabel(courseLabel);
    if (!categoryIds.length) continue;

    const credits = inferMajorSpecificsGeneralEducationCreditsFromTrackLabel(courseLabel);
    if (!credits) continue;

    for (const categoryId of categoryIds) {
      totals[categoryId] += credits;
    }
  }

  return buildMajorSpecificsGeneralEducationCreditLinesFromTotals(totals);
}

function buildCourseDisplayLabel(
  schoolId: "grc" | TransferPlannerCampusId,
  courseCodeOrLabel: string
) {
  const rawValue = String(courseCodeOrLabel ?? "").trim();
  if (!rawValue) return "";
  if (rawValue.includes(" - ")) return rawValue;

  const extractedCourseCode = extractCourseCodes(rawValue)[0] ?? rawValue;
  const normalizedCourseCode = normalizePlannerCourseCode(extractedCourseCode);
  const canonicalCourse = getTransferPlannerCanonicalCourse(schoolId, normalizedCourseCode);
  if (canonicalCourse?.title) {
    return `${normalizedCourseCode} - ${canonicalCourse.title}`;
  }

  return rawValue === normalizedCourseCode ? rawValue : normalizedCourseCode;
}

function appendUniqueCourseCode(
  orderedCourseCodes: string[],
  seenCourseCodes: Set<string>,
  courseCode: string
) {
  const normalizedCourseCode = normalizePlannerCourseCode(courseCode);
  if (!normalizedCourseCode || seenCourseCodes.has(normalizedCourseCode)) return;
  seenCourseCodes.add(normalizedCourseCode);
  orderedCourseCodes.push(normalizedCourseCode);
}

function appendUniqueCourseCodesFromLabels(
  orderedCourseCodes: string[],
  seenCourseCodes: Set<string>,
  labels: string[]
) {
  for (const label of labels) {
    const extractedCourseCodes = extractCourseCodes(label);
    if (extractedCourseCodes.length) {
      for (const courseCode of extractedCourseCodes) {
        appendUniqueCourseCode(orderedCourseCodes, seenCourseCodes, courseCode);
      }
      continue;
    }

    appendUniqueCourseCode(orderedCourseCodes, seenCourseCodes, label);
  }
}

function buildMajorSpecificsFallbackGrcCourseLabels(plan: TransferPlannerResolvedMajorPlan) {
  const orderedLabels: string[] = [];
  const seenLabels = new Set<string>();
  const addLabel = (label: string) => {
    const normalizedLabel = String(label ?? "").trim();
    if (!normalizedLabel || seenLabels.has(normalizedLabel)) return;
    seenLabels.add(normalizedLabel);
    orderedLabels.push(normalizedLabel);
  };

  for (const courseLabel of plan.grcCourseList ?? []) {
    addLabel(buildCourseDisplayLabel("grc", courseLabel));
  }

  if (orderedLabels.length) {
    return orderedLabels;
  }

  const fallbackCourseCodes: string[] = [];
  const seenCourseCodes = new Set<string>();
  const checklistItems = [...plan.applicationChecklist, ...plan.beforeEnrollmentChecklist];
  for (const item of checklistItems) {
    appendUniqueCourseCodesFromLabels(fallbackCourseCodes, seenCourseCodes, item.grcCourses ?? []);
  }

  return fallbackCourseCodes.map((courseCode) => buildCourseDisplayLabel("grc", courseCode));
}

const GRC_TRACK_NOTE_TERM_LABEL_PATTERN = /\btransferability of credits\b/i;

function buildRequiredCourseSentence(courseLabel: string) {
  const normalizedCourseLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
  return normalizedCourseLabel ? `${normalizedCourseLabel} is required.` : "";
}

function buildMajorSpecificsGrcRequiredMajorCourseLines(args: {
  plan: TransferPlannerResolvedMajorPlan | null;
  track: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
}) {
  const { plan, track, completedCourses } = args;
  if (plan) {
    const summaryEntries = buildSourceBackedRequiredCourseSummaryEntries(plan, {
      mode: "grc",
    });
    if (summaryEntries.length) {
      return summaryEntries.map((entry) => ({
        id: entry.id,
        text: entry.text,
      }));
    }
  }

  const orderedLines: { id: string; text: string }[] = [];
  const seenCourseCodes = new Set<string>();
  const preparatoryCourseCodes = getPreparatoryTrackCourseCodeSet(track);
  const addCourseLabel = (courseLabel: string) => {
    const normalizedLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
    const explicitCourseCodes = extractCourseCodes(normalizedLabel);
    if (!normalizedLabel || explicitCourseCodes.length !== 1) return;

    const normalizedCourseCode = normalizePlannerCourseCode(explicitCourseCodes[0]);
    if (
      !normalizedCourseCode ||
      preparatoryCourseCodes.has(normalizedCourseCode) ||
      seenCourseCodes.has(normalizedCourseCode)
    ) {
      return;
    }

    seenCourseCodes.add(normalizedCourseCode);
    orderedLines.push({
      id: normalizedCourseCode,
      text: buildRequiredCourseSentence(getSuggestedScheduleCourseDisplayLabel(normalizedLabel)),
    });
  };

  if (track) {
    for (const term of getResolvedTrackTermsForRequirementDisplay(track, completedCourses)) {
      if (GRC_TRACK_NOTE_TERM_LABEL_PATTERN.test(String(term.label ?? "").trim())) {
        continue;
      }

      for (const courseLabel of term.courses) {
        addCourseLabel(courseLabel);
      }
    }
  }

  if (orderedLines.length > 0) {
    return orderedLines;
  }

  if (plan) {
    for (const courseLabel of buildMajorSpecificsFallbackGrcCourseLabels(plan)) {
      addCourseLabel(courseLabel);
    }
  }

  return orderedLines;
}

function getTransferGuidanceRuleStatusScore(rule: TransferPlannerEquivalencyRule) {
  switch (rule.ruleStatus) {
    case "active":
      return 3;
    case "legacy":
      return 2;
    case "deprecated":
      return 1;
    default:
      return 2;
  }
}

function getTransferGuidanceRuleAcceptanceScore(rule: TransferPlannerEquivalencyRule) {
  switch (rule.acceptanceCategory) {
    case "preferred":
      return 4;
    case "accepted":
      return 3;
    case "accepted-with-warning":
      return 2;
    case "legacy-accepted":
      return 1;
    default:
      return 0;
  }
}

function getTransferGuidanceRuleTypeScore(rule: TransferPlannerEquivalencyRule) {
  switch (rule.type) {
    case "direct-course":
      return 5;
    case "full-credit-combo":
      return 4;
    case "sequence":
      return 3;
    case "alternate-path":
      return 2;
    default:
      return 1;
  }
}

function compareTransferGuidanceRules(
  left: TransferPlannerEquivalencyRule,
  right: TransferPlannerEquivalencyRule
) {
  const statusDelta =
    getTransferGuidanceRuleStatusScore(right) - getTransferGuidanceRuleStatusScore(left);
  if (statusDelta !== 0) return statusDelta;

  const acceptanceDelta =
    getTransferGuidanceRuleAcceptanceScore(right) -
    getTransferGuidanceRuleAcceptanceScore(left);
  if (acceptanceDelta !== 0) return acceptanceDelta;

  const typeDelta = getTransferGuidanceRuleTypeScore(right) - getTransferGuidanceRuleTypeScore(left);
  if (typeDelta !== 0) return typeDelta;

  const targetCodeCountDelta =
    (left.targetCourseCodes?.length ?? Number.MAX_SAFE_INTEGER) -
    (right.targetCourseCodes?.length ?? Number.MAX_SAFE_INTEGER);
  if (targetCodeCountDelta !== 0) return targetCodeCountDelta;

  return left.id.localeCompare(right.id);
}

function isSpecificTransferTargetCourseCode(courseCode: string) {
  return !/\b\dXX(?:\.\d+)?[A-Z]?\b/i.test(String(courseCode ?? "").trim());
}

function getTransferGuidanceCandidateRulesForSourceCourse(
  sourceCourseCode: string,
  campusId: TransferPlannerCampusId
) {
  const allCandidateRules = getTransferPlannerEquivalencyRulesForSourceCourse(sourceCourseCode)
    .filter((rule) => rule.sourceKind === "uw-green-river-equivalency-guide")
    .filter((rule) => rule.acceptanceCategory !== "no-credit")
    .filter((rule) => (rule.targetCourseCodes ?? []).length > 0);

  const campusScopedRules = allCandidateRules.filter((rule) =>
    rule.targetSchoolIds.includes(campusId)
  );
  if (campusScopedRules.length || campusId === "uw-seattle") {
    return campusScopedRules;
  }

  return allCandidateRules.filter((rule) => rule.targetSchoolIds.includes("uw-seattle"));
}

function buildRequiredPlannerCourseCodes(plan: TransferPlannerResolvedMajorPlan) {
  const orderedCourseCodes = buildSourceBackedRequiredCourseCodes(plan);

  if (!orderedCourseCodes.length) {
    const fallbackCourseCodes: string[] = [];
    const seenCourseCodes = new Set<string>();
    appendUniqueCourseCodesFromLabels(
      fallbackCourseCodes,
      seenCourseCodes,
      plan.grcCourseList ?? []
    );
    return fallbackCourseCodes;
  }

  return orderedCourseCodes;
}

function buildUwRequiredPathCourseEntries(plan: TransferPlannerResolvedMajorPlan) {
  const summaryEntries = buildSourceBackedRequiredCourseSummaryEntries(plan, {
    mode: "uw",
  });
  if (!summaryEntries.length) {
    return [] as {
      id: string;
      text: string;
    }[];
  }

  return summaryEntries.map((entry) => ({
    id: entry.id,
    text: entry.text,
  }));
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

function hasDirectEquivalentRuleForCourse(courseCode: string, campusId: TransferPlannerCampusId) {
  return getTransferPlannerEquivalencyRulesForSourceCourse(courseCode).some((rule) => {
    if (!rule.targetSchoolIds.includes(campusId)) return false;
    if (rule.acceptanceCategory === "no-credit") return false;
    if (rule.type === "elective-credit" || rule.type === "limited-credit") return false;
    return true;
  });
}

function hasAnyDirectMajorEquivalencies(plan: TransferPlannerResolvedMajorPlan) {
  const requirementCourseCodes = buildRequiredPlannerCourseCodes(plan);
  if (!requirementCourseCodes.length) return false;

  return requirementCourseCodes.some((courseCode: string) =>
    hasDirectEquivalentRuleForCourse(courseCode, plan.campusId)
  );
}

function buildAdmissionContextText(plan: TransferPlannerResolvedMajorPlan) {
  return [
    plan.summary,
    ...(plan.degreeMapSections ?? []).flatMap((section) => section.items),
    ...plan.advisorFlags,
    ...(plan.validationNotes ?? []),
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
  return stripGeneratedProgramMapSummarySentence(trackSummary);
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
  overlayStrategy = "inline",
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
  overlayStrategy?: SelectorOverlayStrategy;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput | null>(null);
  const selectorFieldRef = useRef<View | null>(null);
  const [modalAnchor, setModalAnchor] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const markTouchInside = useCallback(() => {
    onTouchStartInside?.();
  }, [onTouchStartInside]);
  const dismissDropdown = useCallback(() => {
    if (onDismiss) {
      onDismiss();
      return;
    }
    onToggle();
  }, [onDismiss, onToggle]);
  const measureModalAnchor = useCallback(() => {
    if (!selectorFieldRef.current) {
      return;
    }

    selectorFieldRef.current.measureInWindow((x, y, width, height) => {
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height)
      ) {
        return;
      }

      setModalAnchor({
        left: x,
        top: y,
        width,
        height,
      });
    });
  }, []);
  const shouldUseInlineIsolation = overlayStrategy === "inline-isolated";

  useEffect(() => {
    if (!open) {
      searchInputRef.current?.blur();
      setSearchQuery("");
      setModalAnchor(null);
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

  useEffect(() => {
    if (!open || overlayStrategy !== "modal") {
      return;
    }

    const frame = requestAnimationFrame(() => {
      measureModalAnchor();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [measureModalAnchor, open, overlayStrategy, options.length, value]);

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
  const modalDropdownLayout = useMemo(() => {
    if (!modalAnchor) {
      return null;
    }

    const sideMargin = 16;
    const verticalGap = 12;
    const viewportPadding = 24;
    const availableBelow = Math.max(
      windowHeight - (modalAnchor.top + modalAnchor.height + verticalGap) - viewportPadding,
      0
    );
    const availableAbove = Math.max(modalAnchor.top - verticalGap - viewportPadding, 0);
    const shouldOpenUpward = availableBelow < 220 && availableAbove > availableBelow;
    const maxHeight = Math.max(
      160,
      Math.min(320, shouldOpenUpward ? availableAbove : availableBelow)
    );
    const width = Math.min(modalAnchor.width, Math.max(windowWidth - sideMargin * 2, 0));
    const left = Math.min(
      Math.max(modalAnchor.left, sideMargin),
      Math.max(sideMargin, windowWidth - width - sideMargin)
    );
    const top = shouldOpenUpward
      ? Math.max(viewportPadding, modalAnchor.top - verticalGap - maxHeight)
      : modalAnchor.top + modalAnchor.height + verticalGap;

    return {
      left,
      top,
      width,
      maxHeight,
    };
  }, [modalAnchor, windowHeight, windowWidth]);
  const dropdownMaxHeight = modalDropdownLayout?.maxHeight ?? 320;
  const scrollAreaMaxHeight = Math.max(
    120,
    dropdownMaxHeight - (searchable && !effectiveQuery ? 72 : 28)
  );
  const dropdownContent = (
    <View
      className={`border ${borderClass} rounded-2xl p-3`}
      onTouchStart={markTouchInside}
      renderToHardwareTextureAndroid={shouldUseInlineIsolation}
      needsOffscreenAlphaCompositing={shouldUseInlineIsolation}
      style={{
        maxHeight: dropdownMaxHeight,
        backgroundColor: dropdownBackgroundColor,
        overflow: "hidden",
        opacity: 1,
        ...(shouldUseInlineIsolation
          ? {
              shadowColor: "#000000",
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 10 },
            }
          : null),
      }}
    >
      {shouldUseInlineIsolation ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: dropdownBackgroundColor,
            opacity: 1,
          }}
        />
      ) : null}

      {searchable && !effectiveQuery ? (
        <Text className={`${secondaryTextClass} text-xs mb-2`}>
          Scroll to browse all options, or type to filter.
        </Text>
      ) : null}

      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="always"
        onTouchStart={markTouchInside}
        style={{ maxHeight: scrollAreaMaxHeight, backgroundColor: dropdownBackgroundColor }}
        contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
      >
        {filteredOptions.map((option) => (
          <AnimatedCardPressable
            key={option.id}
            onPressIn={markTouchInside}
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
            No options match that search yet.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );

  return (
    <View
      ref={selectorFieldRef}
      className="relative"
      style={
        open
          ? shouldUseInlineIsolation
            ? { zIndex: 120, elevation: 120 }
            : { zIndex: 30 }
          : undefined
      }
      onTouchStart={markTouchInside}
      onLayout={() => {
        if (open && overlayStrategy === "modal") {
          measureModalAnchor();
        }
      }}
      renderToHardwareTextureAndroid={open && shouldUseInlineIsolation}
      needsOffscreenAlphaCompositing={open && shouldUseInlineIsolation}
    >
      <Text className={`${textClass} text-base font-semibold`}>{label}</Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>{helper}</Text>

      {searchable ? (
        <View
          className={`mt-4 border ${borderClass} rounded-2xl px-4 py-2 flex-row items-center`}
          onTouchStart={markTouchInside}
        >
          <TextInput
            ref={searchInputRef}
            value={open ? searchQuery : value}
            onTouchStart={markTouchInside}
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
            onPressIn={markTouchInside}
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
          onPressIn={markTouchInside}
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

      {open && overlayStrategy !== "modal" ? (
        <View
          className="absolute left-0 right-0 mt-3"
          style={{
            top: "100%",
            zIndex: shouldUseInlineIsolation ? 125 : 35,
            elevation: shouldUseInlineIsolation ? 125 : 16,
          }}
        >
          {dropdownContent}
        </View>
      ) : null}

      {open && overlayStrategy === "modal" && modalDropdownLayout ? (
        <Modal transparent visible animationType="none" onRequestClose={dismissDropdown}>
          <View style={{ flex: 1 }}>
            <Pressable
              onPress={dismissDropdown}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              }}
            />
            <View pointerEvents="box-none" style={{ flex: 1 }}>
              <View
                style={{
                  position: "absolute",
                  left: modalDropdownLayout.left,
                  top: modalDropdownLayout.top,
                  width: modalDropdownLayout.width,
                  zIndex: 200,
                  elevation: 200,
                }}
              >
                {dropdownContent}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function PlannerSelectionFields({
  collegeId,
  selectedCollegeId,
  selectedCollegeLabel,
  selectedCampusId,
  selectedCampusLabel,
  selectedMajorId,
  selectedMajorLabel,
  openSelector,
  collegeOptions,
  campusOptions,
  majorOptions,
  onToggleCollege,
  onToggleCampus,
  onToggleMajor,
  onDismissCollege,
  onDismissCampus,
  onDismissMajor,
  onSelectCollege,
  onSelectCampus,
  onSelectMajor,
  onSelectorTouchStartInside,
  isDesktop,
  textClass,
  secondaryTextClass,
  borderClass,
  dropdownBackgroundColor,
}: {
  collegeId: PlannerCollegeId;
  selectedCollegeId: PlannerCollegeId;
  selectedCollegeLabel: string;
  selectedCampusId: PlannerCampusSelectionId;
  selectedCampusLabel: string;
  selectedMajorId: string;
  selectedMajorLabel: string;
  openSelector: PlannerSelectorKey;
  collegeOptions: { id: string; label: string; description?: string }[];
  campusOptions: { id: string; label: string; description?: string }[];
  majorOptions: { id: string; label: string; description?: string }[];
  onToggleCollege: () => void;
  onToggleCampus: () => void;
  onToggleMajor: () => void;
  onDismissCollege: () => void;
  onDismissCampus: () => void;
  onDismissMajor: () => void;
  onSelectCollege: (id: string) => void;
  onSelectCampus: (id: string) => void;
  onSelectMajor: (id: string) => void;
  onSelectorTouchStartInside: () => void;
  isDesktop: boolean;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
  dropdownBackgroundColor: string;
}) {
  const getFieldContainerStyle = (
    selectorKey: Exclude<PlannerSelectorKey, null>,
    shouldElevateInlineOverlay = false
  ) => {
    const baseStyle = isDesktop ? { flex: 1, minWidth: 0 } : {};

    if (!shouldElevateInlineOverlay || openSelector !== selectorKey) {
      return Object.keys(baseStyle).length ? baseStyle : undefined;
    }

    return {
      ...baseStyle,
      position: "relative" as const,
      zIndex: 130,
      elevation: 130,
    };
  };

  return (
    <View
      className="mt-4"
      style={
        isDesktop ? { flexDirection: "row", alignItems: "flex-start", gap: 16 } : { gap: 16 }
      }
    >
      <View style={getFieldContainerStyle("college", true)}>
        <SelectorField
          label="College"
          value={selectedCollegeLabel}
          helper={getPlannerSelectionHelperText(collegeId, "college")}
          open={openSelector === "college"}
          onToggle={onToggleCollege}
          onTouchStartInside={onSelectorTouchStartInside}
          onDismiss={onDismissCollege}
          options={collegeOptions}
          onSelect={onSelectCollege}
          selectedOptionId={selectedCollegeId}
          hideSelectedOptionWhenOpen
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
          dropdownBackgroundColor={dropdownBackgroundColor}
          overlayStrategy="inline-isolated"
        />
      </View>

      <View style={getFieldContainerStyle("campus")}>
        <SelectorField
          label="Campus"
          value={selectedCampusLabel}
          helper={getPlannerSelectionHelperText(collegeId, "campus")}
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
          overlayStrategy="modal"
        />
      </View>

      <View style={getFieldContainerStyle("major")}>
        <SelectorField
          label="Major"
          value={selectedMajorLabel}
          helper={getPlannerSelectionHelperText(collegeId, "major")}
          open={openSelector === "major"}
          onToggle={onToggleMajor}
          onTouchStartInside={onSelectorTouchStartInside}
          onDismiss={onDismissMajor}
          options={majorOptions}
          onSelect={onSelectMajor}
          selectedOptionId={selectedMajorId}
          searchable
          searchPlaceholder={getPlannerMajorSearchPlaceholder(collegeId)}
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
          dropdownBackgroundColor={dropdownBackgroundColor}
        />
      </View>
    </View>
  );
}

function PlannerTrackOverviewCard({
  collegeId,
  trackCode,
  trackTitle,
  trackSummary,
  trackOfficialLinkUrl,
  hasNoDirectMajorEquivalencies,
  textClass,
  secondaryTextClass,
  borderClass,
}: {
  collegeId: PlannerCollegeId;
  trackCode: string | null;
  trackTitle: string;
  trackSummary: string;
  trackOfficialLinkUrl: string | null;
  hasNoDirectMajorEquivalencies: boolean;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
}) {
  const visibleTrackSummary = getAutoTrackSummaryText(trackSummary);
  const shouldShowBestTrackCard =
    collegeId === "uw" ? Boolean(trackCode) && !hasNoDirectMajorEquivalencies : Boolean(trackTitle);
  const headingText = trackCode ? `${trackCode} | ${trackTitle}` : trackTitle;

  if (!shouldShowBestTrackCard) {
    return null;
  }

  return (
    <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
      <Text className={`${textClass} text-base font-semibold`}>
        {collegeId === "grc"
          ? "Selected Green River Program Path"
          : "Best Green River Transfer Associates path"}
      </Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>
        {collegeId === "grc"
          ? "This is the Green River program path the planner is currently following."
          : "This shows the Green River degree path that best matches the UW degree you picked."}
      </Text>

      <View className={`mt-4 border ${borderClass} rounded-2xl px-4 py-4`}>
        {trackOfficialLinkUrl ? (
          <AnimatedIconPressable
            onPress={() => void openExternalLink(trackOfficialLinkUrl)}
            className="self-start"
          >
            <Text className="text-emerald-500 underline font-semibold">{headingText}</Text>
          </AnimatedIconPressable>
        ) : (
          <Text className={`${textClass} font-semibold`}>{headingText}</Text>
        )}
        {visibleTrackSummary ? (
          <Text className={`${secondaryTextClass} text-sm mt-2`}>{visibleTrackSummary}</Text>
        ) : null}
        {/* Official program map link removed per request */}
      </View>
    </View>
  );
}

function GrcDegreeSpecificsSection({
  track,
  completedCourses,
  textClass,
  secondaryTextClass,
  borderClass,
}: {
  track: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
}) {
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [isGrcClassesOpen, setIsGrcClassesOpen] = useState(false);
  const grcGeneralEducationCreditLines = useMemo(
    () => buildMajorSpecificsGrcGeneralEducationCreditLines({ plan: null, track, completedCourses }),
    [completedCourses, track]
  );
  const grcRequiredMajorCourseLines = useMemo(
    () => buildMajorSpecificsGrcRequiredMajorCourseLines({ plan: null, track, completedCourses }),
    [completedCourses, track]
  );
  const grcTrackRequirementNoun = getGrcTrackRequirementNoun(track);
  const grcSpecificsTitle = getGrcTrackSpecificsTitle(track);
  const grcClassesLabelSuffix = getGrcTrackClassesLabelSuffix(track);
  const grcTrackTitle = String(track?.title ?? "").trim() || "Selected Green River program";
  const grcTrackDescription = track
    ? `Open this dropdown for all classes needed to complete the ${grcTrackTitle} ${grcTrackRequirementNoun} at GRC.`
    : "Open this dropdown for the Green River class list attached to this program.";
  const grcRequiredMajorCourseFallbackText =
    grcTrackRequirementNoun === "degree"
      ? "No Green River degree-counting major-course list is available for this degree yet."
      : "No Green River major-course list is available for this program yet.";

  if (!track) {
    return null;
  }

  return (
    <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
      <AnimatedCardPressable
        onPress={() => setIsReferenceOpen((currentValue) => !currentValue)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isReferenceOpen }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>{grcSpecificsTitle}</Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              {`Open this dropdown for the currently tracked Green River ${grcTrackRequirementNoun} requirements.`}
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
        <View className="mt-5 gap-4">
          <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
            <AnimatedCardPressable
              onPress={() => setIsGrcClassesOpen((currentValue) => !currentValue)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isGrcClassesOpen }}
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 min-w-0">
                  <Text className={`${textClass} text-base font-semibold`}>
                    {`GRC ${grcTrackTitle} ${grcClassesLabelSuffix}`}
                  </Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>
                    {grcTrackDescription}
                  </Text>
                </View>
                <Ionicons
                  name={isGrcClassesOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#9CA3AF"
                />
              </View>
            </AnimatedCardPressable>

            {isGrcClassesOpen ? (
              <View className="mt-4 gap-4">
                <View>
                  <Text className={`${textClass} text-sm font-semibold`}>Gen-Ed Courses</Text>
                  <View className="mt-2 gap-2">
                    {grcGeneralEducationCreditLines.map((entry) => (
                      <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                        {`${entry.label}: ${entry.credits} credits`}
                      </Text>
                    ))}
                  </View>
                </View>

                <View>
                  <Text className={`${textClass} text-sm font-semibold`}>
                    Required Major Courses
                  </Text>
                  {grcRequiredMajorCourseLines.length ? (
                    <View className="mt-2 gap-2">
                      {grcRequiredMajorCourseLines.map((entry) => (
                        <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                          {entry.text}
                        </Text>
                      ))}
                    </View>
                  ) : (
                    <Text className={`${secondaryTextClass} text-sm mt-2`}>
                      {grcRequiredMajorCourseFallbackText}
                    </Text>
                  )}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function TranscriptSummaryCard({
  collegeId,
  transcriptDocument,
  isAnalyzing,
  errorMessage,
  studentEvaluationReport,
  studentCourseEvaluations,
  plan,
  pathwayOptions,
  selectedPathwayLabel,
  hasNoDirectMajorEquivalencies,
  selectedCollegeId,
  selectedCollegeLabel,
  selectedCampusId,
  selectedCampusLabel,
  selectedMajorId,
  selectedMajorLabel,
  track,
  trackCode,
  trackTitle,
  trackSummary,
  trackOfficialLinkUrl,
  completedCourses,
  transcriptDerivedCompletedCourses,
  hasTranscriptDerivedCreditSource,
  openSelector,
  collegeOptions,
  campusOptions,
  majorOptions,
  isPathwaySelectorOpen,
  onToggleCollege,
  onToggleCampus,
  onToggleMajor,
  onTogglePathway,
  onSelectorTouchStartInside,
  onDismissCollege,
  onDismissCampus,
  onDismissMajor,
  onSelectCollege,
  onSelectCampus,
  onSelectMajor,
  onSelectPathway,
  onUpload,
  onOpenTranscriptLink,
  onRemoveTranscript,
  isDesktop,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
  dropdownBackgroundColor,
}: {
  collegeId: PlannerCollegeId;
  transcriptDocument: TranscriptDocument | null;
  isAnalyzing: boolean;
  errorMessage: string | null;
  studentEvaluationReport: TransferPlannerStudentEvaluationReport | null;
  studentCourseEvaluations: TransferPlannerStudentCourseEvaluation[];
  plan: TransferPlannerResolvedMajorPlan | null;
  pathwayOptions: TransferPlannerMajorPathway[];
  selectedPathwayLabel: string | null;
  hasNoDirectMajorEquivalencies: boolean;
  selectedCollegeId: PlannerCollegeId;
  selectedCollegeLabel: string;
  selectedCampusId: PlannerCampusSelectionId;
  selectedCampusLabel: string;
  selectedMajorId: string;
  selectedMajorLabel: string;
  track: TransferPlannerTrack | null;
  trackCode: string | null;
  trackTitle: string;
  trackSummary: string;
  trackOfficialLinkUrl: string | null;
  completedCourses: TranscriptCourseEntry[];
  transcriptDerivedCompletedCourses: TranscriptCourseEntry[];
  hasTranscriptDerivedCreditSource: boolean;
  openSelector: PlannerSelectorKey;
  collegeOptions: { id: string; label: string; description?: string }[];
  campusOptions: { id: string; label: string; description?: string }[];
  majorOptions: { id: string; label: string; description?: string }[];
  isPathwaySelectorOpen: boolean;
  onToggleCollege: () => void;
  onToggleCampus: () => void;
  onToggleMajor: () => void;
  onTogglePathway: () => void;
  onSelectorTouchStartInside: () => void;
  onDismissCollege: () => void;
  onDismissCampus: () => void;
  onDismissMajor: () => void;
  onSelectCollege: (id: string) => void;
  onSelectCampus: (id: string) => void;
  onSelectMajor: (id: string) => void;
  onSelectPathway: (pathwayId: string) => void;
  onUpload: () => void;
  onOpenTranscriptLink: () => void;
  onRemoveTranscript: () => void;
  isDesktop: boolean;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
  dropdownBackgroundColor: string;
}) {
  const isUwPlanner = collegeId === "uw";
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
  const selectionFields = (
    <PlannerSelectionFields
      collegeId={collegeId}
      selectedCollegeId={selectedCollegeId}
      selectedCollegeLabel={selectedCollegeLabel}
      selectedCampusId={selectedCampusId}
      selectedCampusLabel={selectedCampusLabel}
      selectedMajorId={selectedMajorId}
      selectedMajorLabel={selectedMajorLabel}
      openSelector={openSelector}
      collegeOptions={collegeOptions}
      campusOptions={campusOptions}
      majorOptions={majorOptions}
      onToggleCollege={onToggleCollege}
      onToggleCampus={onToggleCampus}
      onToggleMajor={onToggleMajor}
      onDismissCollege={onDismissCollege}
      onDismissCampus={onDismissCampus}
      onDismissMajor={onDismissMajor}
      onSelectCollege={onSelectCollege}
      onSelectCampus={onSelectCampus}
      onSelectMajor={onSelectMajor}
      onSelectorTouchStartInside={onSelectorTouchStartInside}
      isDesktop={isDesktop}
      textClass={textClass}
      secondaryTextClass={secondaryTextClass}
      borderClass={borderClass}
      dropdownBackgroundColor={dropdownBackgroundColor}
    />
  );

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
          {selectionFields}
        </View>

        {isUwPlanner && plan ? (
          <>
            <MajorPathwaySection
              pathwayOptions={pathwayOptions}
              selectedPathwayId={plan.selectedPathwayId}
              selectedPathwayLabel={selectedPathwayLabel}
              isPathwaySelectorOpen={isPathwaySelectorOpen}
              onTogglePathway={onTogglePathway}
              onSelectorTouchStartInside={onSelectorTouchStartInside}
              onSelectPathway={(pathwayId) => {
                onSelectPathway(pathwayId);
              }}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
              dropdownBackgroundColor={dropdownBackgroundColor}
            />

            <PlannerTrackOverviewCard
              collegeId={collegeId}
              trackCode={trackCode}
              trackTitle={trackTitle}
              trackSummary={trackSummary}
              trackOfficialLinkUrl={trackOfficialLinkUrl}
              hasNoDirectMajorEquivalencies={hasNoDirectMajorEquivalencies}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
            />

            <MajorSpecificsSection
              plan={plan}
              track={track}
              completedCourses={completedCourses}
              transcriptDerivedCompletedCourses={transcriptDerivedCompletedCourses}
              hasTranscriptDerivedCreditSource={hasTranscriptDerivedCreditSource}
              selectedPathwayLabel={selectedPathwayLabel}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
            />
          </>
        ) : null}

        {!isUwPlanner ? (
          <>
            <PlannerTrackOverviewCard
              collegeId={collegeId}
              trackCode={trackCode}
              trackTitle={trackTitle}
              trackSummary={trackSummary}
              trackOfficialLinkUrl={trackOfficialLinkUrl}
              hasNoDirectMajorEquivalencies={false}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
            />

            <GrcDegreeSpecificsSection
              track={track}
              completedCourses={completedCourses}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
            />
          </>
        ) : null}
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

      <View className="mt-3 flex-row items-center gap-2">
        <AnimatedIconPressable onPress={onUpload} className="self-start">
          <Text className="text-emerald-500 text-sm font-medium">Update Transcript</Text>
        </AnimatedIconPressable>
        <Text className={`${secondaryTextClass} text-sm text-emerald-500`}>|</Text>
        <AnimatedIconPressable
          onPress={onRemoveTranscript}
          className="self-start"
        >
          <Text className="text-emerald-500 text-sm font-medium">Remove Transcript</Text>
        </AnimatedIconPressable>
        <Text className={`${secondaryTextClass} text-sm text-emerald-500`}>|</Text>
        <AnimatedIconPressable onPress={onOpenTranscriptLink} className="self-start">
          <Text className="text-emerald-500 text-sm font-medium">Transcript Link</Text>
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
        {selectionFields}
      </View>

      {isUwPlanner && plan ? (
        <>
          <MajorPathwaySection
            pathwayOptions={pathwayOptions}
            selectedPathwayId={plan.selectedPathwayId}
            selectedPathwayLabel={selectedPathwayLabel}
            isPathwaySelectorOpen={isPathwaySelectorOpen}
            onTogglePathway={onTogglePathway}
            onSelectorTouchStartInside={onSelectorTouchStartInside}
            onSelectPathway={(pathwayId) => {
              onSelectPathway(pathwayId);
            }}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            borderClass={borderClass}
            dropdownBackgroundColor={dropdownBackgroundColor}
          />

          <PlannerTrackOverviewCard
            collegeId={collegeId}
            trackCode={trackCode}
            trackTitle={trackTitle}
            trackSummary={trackSummary}
            trackOfficialLinkUrl={trackOfficialLinkUrl}
            hasNoDirectMajorEquivalencies={hasNoDirectMajorEquivalencies}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            borderClass={borderClass}
          />

          <MajorSpecificsSection
            plan={plan}
            track={track}
            completedCourses={completedCourses}
            transcriptDerivedCompletedCourses={transcriptDerivedCompletedCourses}
            hasTranscriptDerivedCreditSource={hasTranscriptDerivedCreditSource}
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
        </>
      ) : null}

      {!isUwPlanner ? (
        <>
          <PlannerTrackOverviewCard
            collegeId={collegeId}
            trackCode={trackCode}
            trackTitle={trackTitle}
            trackSummary={trackSummary}
            trackOfficialLinkUrl={trackOfficialLinkUrl}
            hasNoDirectMajorEquivalencies={false}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            borderClass={borderClass}
          />

          <GrcDegreeSpecificsSection
            track={track}
            completedCourses={completedCourses}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            borderClass={borderClass}
          />
        </>
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
  onSelectorTouchStartInside,
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
  onSelectorTouchStartInside: () => void;
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
    <View
      className="mt-4"
      style={
        isPathwaySelectorOpen
          ? {
              position: "relative",
              zIndex: 40,
            }
          : {
              position: "relative",
            }
      }
    >
      <SelectorField
        label="Pathway"
        value={selectedPathwayLabel ?? pathwayOptions[0]?.label ?? "Select pathway"}
        helper="This major has multiple supported routes. Pick the route you want this planner to follow."
        open={isPathwaySelectorOpen}
        onToggle={onTogglePathway}
        onTouchStartInside={onSelectorTouchStartInside}
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
  );
}

function SuggestedScheduleCard({
  collegeId,
  quarters,
  degreeTitle,
  grcTrack,
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
  collegeId: PlannerCollegeId;
  quarters: SuggestedQuarterPlan[];
  degreeTitle: string;
  grcTrack: TransferPlannerTrack | null;
  campusLabel: string;
  selectedCampusId: TransferPlannerCampusId | null;
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
  const grcTrackRequirementNoun = getGrcTrackRequirementNoun(grcTrack);
  const scheduleTitle =
    collegeId === "grc"
      ? grcTrackRequirementNoun === "degree"
        ? "GRC Degree Plan"
        : "GRC Program Plan"
      : "GRC Quarter Plan";
  const scheduleDescription =
    collegeId === "grc"
      ? `This is your Green River plan for finishing the ${degreeTitle} ${grcTrackRequirementNoun} at ${getScheduleCampusLabel(collegeId, campusLabel)}. Completed transcript classes stay marked as done, and the planner fills in the remaining GRC ${grcTrackRequirementNoun} courses still ahead.`
      : `This is your transfer plan for finishing the ${degreeTitle} degree at ${getScheduleCampusLabel(collegeId, campusLabel)}. Press the Classes for UW transfer only button to hide optional Green River track classes and focus on UW-required classes, official UW transfer admission guidance when applicable, major-specific breadth requirements, and prerequisite dependencies.`;

  return (
    <View className={`${cardClass} border rounded-[28px] p-5`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 min-w-0">
          <Text className={`${textClass} text-lg font-semibold`}>{scheduleTitle}</Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            {scheduleDescription}
          </Text>
        </View>

        {showOnlyUwEssentialClassesToggle || collegeId === "grc" ? (
          <View className="gap-2">
            {showOnlyUwEssentialClassesToggle ? (
              <Pressable
                onPress={onToggleOnlyUwEssentialClasses}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: onlyUwEssentialClasses }}
                accessibilityLabel="Only show classes that transfer into UW on this track"
                accessibilityHint="Hides nonessential Green River track classes while keeping prerequisite classes, official UW transfer admission guidance when applicable, and major-specific breadth requirements that still unlock UW-required work."
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

                              if (!linkData || !selectedCampusId) {
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
              Open this dropdown for specifics on how your transcript gets applied
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
  track,
  completedCourses,
  transcriptDerivedCompletedCourses,
  hasTranscriptDerivedCreditSource,
  selectedPathwayLabel,
  textClass,
  secondaryTextClass,
  borderClass,
}: {
  plan: TransferPlannerResolvedMajorPlan;
  track: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
  transcriptDerivedCompletedCourses: TranscriptCourseEntry[];
  hasTranscriptDerivedCreditSource: boolean;
  selectedPathwayLabel: string | null;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
}) {
  const degreeMapSections = plan.degreeMapSections ?? [];
  const grcGeneralEducationCreditLines = useMemo(
    () => buildMajorSpecificsGrcGeneralEducationCreditLines({ plan, track, completedCourses }),
    [completedCourses, plan, track]
  );
  const grcRequiredMajorCourseLines = useMemo(
    () => buildMajorSpecificsGrcRequiredMajorCourseLines({ plan, track, completedCourses }),
    [completedCourses, plan, track]
  );
  const sourceBackedUwGeneralEducationSection = useMemo(
    () => buildMajorSpecificsSourceBackedUwGeneralEducationSection(plan),
    [plan]
  );
  const uwGeneralTransferRequirementSection = useMemo(
    () =>
      buildUwGeneralTransferRequirementSection(plan, {
        completedCourses: transcriptDerivedCompletedCourses,
        hasTranscriptDerivedCreditSource,
      }),
    [hasTranscriptDerivedCreditSource, plan, transcriptDerivedCompletedCourses]
  );
  const uwRequiredPathCourseEntries = useMemo(() => buildUwRequiredPathCourseEntries(plan), [plan]);
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
  const [isGrcClassesOpen, setIsGrcClassesOpen] = useState(false);
  const [isUwClassesOpen, setIsUwClassesOpen] = useState(false);
  const grcTrackTitle = String(track?.title ?? "").trim() || plan.title;
  const grcTrackDescription = track
    ? `Open this dropdown for all classes needed to complete the ${grcTrackTitle} transfer track at GRC.`
    : "Open this dropdown for the Green River class list currently attached to this major.";

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

          <View className="mt-5 gap-4">
            <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
              <AnimatedCardPressable
                onPress={() => setIsGrcClassesOpen((currentValue) => !currentValue)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isGrcClassesOpen }}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 min-w-0">
                    <Text className={`${textClass} text-base font-semibold`}>
                      {`GRC ${grcTrackTitle} Degree Classes`}
                    </Text>
                    <Text className={`${secondaryTextClass} text-sm mt-1`}>
                      {grcTrackDescription}
                    </Text>
                  </View>
                  <Ionicons
                    name={isGrcClassesOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#9CA3AF"
                  />
                </View>
              </AnimatedCardPressable>

              {isGrcClassesOpen ? (
                <View className="mt-4 gap-4">
                  <View>
                    <Text className={`${textClass} text-sm font-semibold`}>Gen-Ed Courses</Text>
                    {grcGeneralEducationCreditLines.length ? (
                      <View className="mt-2 gap-2">
                        {grcGeneralEducationCreditLines.map((entry) => (
                          <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                            {`${entry.label}: ${entry.credits} credits`}
                          </Text>
                        ))}
                      </View>
                    ) : (
                      <Text className={`${secondaryTextClass} text-sm mt-2`}>
                        No Green River track general-education targets are currently tagged for this route yet.
                      </Text>
                    )}
                  </View>

                  <View>
                    <Text className={`${textClass} text-sm font-semibold`}>Required Major Courses</Text>
                    {grcRequiredMajorCourseLines.length ? (
                      <View className="mt-2 gap-2">
                        {grcRequiredMajorCourseLines.map((entry) => (
                          <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                            {entry.text}
                          </Text>
                        ))}
                      </View>
                    ) : (
                      <Text className={`${secondaryTextClass} text-sm mt-2`}>
                        No Green River degree-counting major-course list is available for this track yet.
                      </Text>
                    )}
                  </View>
                </View>
              ) : null}
            </View>

            <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
              <AnimatedCardPressable
                onPress={() => setIsUwClassesOpen((currentValue) => !currentValue)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isUwClassesOpen }}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 min-w-0">
                    <Text className={`${textClass} text-base font-semibold`}>
                      {`UW ${plan.title} Required Classes`}
                    </Text>
                    <Text className={`${secondaryTextClass} text-sm mt-1`}>
                      {uwRequiredPathCourseEntries.length
                        ? "Open this dropdown for source-backed major requirements and Green River classes that count toward the UW-required path for this major."
                        : "Open this dropdown for source-backed major requirements and mapped Green River equivalents as they become available."}
                    </Text>
                  </View>
                  <Ionicons
                    name={isUwClassesOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#9CA3AF"
                  />
                </View>
              </AnimatedCardPressable>

              {isUwClassesOpen ? (
                <View className="mt-4 gap-4">
                  {uwGeneralTransferRequirementSection ? (
                    <View>
                      <Text className={`${textClass} text-sm font-semibold`}>
                        {uwGeneralTransferRequirementSection.title}
                      </Text>
                      <Text className={`${secondaryTextClass} text-sm mt-1`}>
                        {uwGeneralTransferRequirementSection.summary}
                      </Text>
                      <View className="mt-2 gap-2">
                        {uwGeneralTransferRequirementSection.items.map((entry) => (
                          <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                            {`${entry.label}: ${entry.valueText}${entry.note ? ` (${entry.note})` : ""}`}
                          </Text>
                        ))}
                      </View>
                      {uwGeneralTransferRequirementSection.note ? (
                        <Text className={`${secondaryTextClass} text-xs mt-3`}>
                          {uwGeneralTransferRequirementSection.note}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <View>
                    <Text className={`${textClass} text-sm font-semibold`}>
                      Major Required Gen-Eds
                    </Text>
                    {sourceBackedUwGeneralEducationSection?.items.length ? (
                      <View className="mt-2 gap-2">
                        {sourceBackedUwGeneralEducationSection.items.map((entry) => (
                          <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                            {`${entry.label}: ${entry.valueText}${entry.note ? ` (${entry.note})` : ""}`}
                          </Text>
                        ))}
                      </View>
                    ) : (
                      <Text className={`${secondaryTextClass} text-sm mt-2`}>
                        No source-backed major-specific general education targets are currently published for this major.
                      </Text>
                    )}
                  </View>

                  <View>
                    <Text className={`${textClass} text-sm font-semibold`}>Required Major Courses</Text>
                    {uwRequiredPathCourseEntries.length ? (
                      <View className="mt-2 gap-2">
                        {uwRequiredPathCourseEntries.map((entry) => (
                          <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                            {entry.text}
                          </Text>
                        ))}
                      </View>
                    ) : (
                      <Text className={`${secondaryTextClass} text-sm mt-2`}>
                        No source-backed UW-required major-course path is available for this major yet.
                      </Text>
                    )}
                  </View>
                </View>
              ) : null}
            </View>
          </View>
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
  const { isHydrated, state, patchUserLocally, updateUser, setQuestionnaireAnswers } = useAppData();
  const { getScrollContentPadding } = useResponsiveLayout();

  const [selectedCollegeId, setSelectedCollegeId] = useState<PlannerCollegeId>("uw");
  const [selectedCampusId, setSelectedCampusId] =
    useState<PlannerCampusSelectionId>("uw-seattle");
  const [selectedMajorId, setSelectedMajorId] = useState<string>(
    getTransferPlannerStudentRuntimeMajorsForCampus("uw-seattle")[0]?.id ?? ""
  );
  const [openSelector, setOpenSelector] = useState<PlannerSelectorKey>(null);
  const [isPathwaySelectorOpen, setIsPathwaySelectorOpen] = useState(false);
  const [transcriptDocument, setTranscriptDocument] = useState<TranscriptDocument | null>(null);
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [onlyUwEssentialClasses, setOnlyUwEssentialClasses] = useState(false);
  const [allowSummerClasses, setAllowSummerClasses] = useState(false);

  const transcriptAnalysisAttemptsRef = useRef<Set<string>>(new Set());
  const transcriptAnalysisGenerationRef = useRef(0);
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
  const transcriptDerivedCompletedCourses = useMemo(
    () =>
      shouldUseDetailedCompletedCourses
        ? parseCompletedTranscriptCourses(storedDetailedTranscriptCourses)
        : [],
    [shouldUseDetailedCompletedCourses, storedDetailedTranscriptCourses]
  );
  const needsTranscriptReparse =
    hasDetailedCompletedCourses &&
    storedTranscriptParserVersion !== TRANSCRIPT_PARSER_VERSION;

  const isUwPlanner = selectedCollegeId === "uw";
  const selectedUwCampusId = useMemo<TransferPlannerCampusId>(
    () =>
      isUwPlanner && isPlannerUwCampusId(selectedCampusId)
        ? selectedCampusId
        : "uw-seattle",
    [isUwPlanner, selectedCampusId]
  );
  const effectiveSelectedCampusId = useMemo<PlannerCampusSelectionId>(
    () => (isUwPlanner ? selectedUwCampusId : GRC_PLANNER_CAMPUS_ID),
    [isUwPlanner, selectedUwCampusId]
  );
  const campus = useMemo(
    () =>
      isUwPlanner
        ? TRANSFER_PLANNER_CAMPUSES.find((entry) => entry.id === selectedUwCampusId) ??
          TRANSFER_PLANNER_CAMPUSES[0]
        : null,
    [isUwPlanner, selectedUwCampusId]
  );
  const campusMajors = useMemo(
    () =>
      isUwPlanner ? getTransferPlannerStudentRuntimeMajorsForCampus(selectedUwCampusId) : [],
    [isUwPlanner, selectedUwCampusId]
  );
  const selectedBasePlan = useMemo(
    () =>
      isUwPlanner
        ? campusMajors.find((entry) => entry.id === selectedMajorId) ?? campusMajors[0] ?? null
        : null,
    [campusMajors, isUwPlanner, selectedMajorId]
  );
  const selectedGrcTrack = useMemo(
    () =>
      !isUwPlanner
        ? TRANSFER_PLANNER_TRACKS.find((entry) => entry.id === selectedMajorId) ??
          TRANSFER_PLANNER_TRACKS[0] ??
          null
        : null,
    [isUwPlanner, selectedMajorId]
  );
  const effectiveSelectedMajorId = useMemo(
    () =>
      isUwPlanner
        ? selectedBasePlan?.id ?? campusMajors[0]?.id ?? selectedMajorId
        : selectedGrcTrack?.id ?? TRANSFER_PLANNER_TRACKS[0]?.id ?? selectedMajorId,
    [campusMajors, isUwPlanner, selectedBasePlan?.id, selectedGrcTrack?.id, selectedMajorId]
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
    () => (isUwPlanner ? getTransferPlannerStudentRuntimePathwaysForPlan(selectedBasePlan) : []),
    [isUwPlanner, selectedBasePlan]
  );
  const selectedPathwayId = useMemo(() => {
    if (!isUwPlanner || !selectedBasePlan) return null;
    const storedPathwayId = selectedPathwayByPlan[selectedBasePlan.id] ?? null;
    if (storedPathwayId && pathwayOptions.some((entry) => entry.id === storedPathwayId)) {
      return storedPathwayId;
    }
    return pathwayOptions[0]?.id ?? null;
  }, [isUwPlanner, pathwayOptions, selectedBasePlan, selectedPathwayByPlan]);
  const plan = useMemo(
    () =>
      isUwPlanner
        ? resolveTransferPlannerStudentRuntimeMajorPlan(selectedBasePlan, selectedPathwayId)
        : null,
    [isUwPlanner, selectedBasePlan, selectedPathwayId]
  );
  const track = useMemo(
    () => (isUwPlanner ? getTransferPlannerTrack(plan?.bestTrackId ?? null) : selectedGrcTrack),
    [isUwPlanner, plan, selectedGrcTrack]
  );
  const plannerPathKey = useMemo(
    () => getPlannerPathKey(effectiveSelectedCampusId, plan?.id ?? effectiveSelectedMajorId, selectedPathwayId),
    [effectiveSelectedCampusId, effectiveSelectedMajorId, plan?.id, selectedPathwayId]
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
  const reportBugMailtoUrl = useMemo(() => {
    const subject = encodeURIComponent("GatorGuide Course Planner Bug Report");
    const body = encodeURIComponent(
      "Please describe what happened in Course Planner:\n\n"
    );
    return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }, []);

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
  const handleReportBug = useCallback(async () => {
    try {
      const canOpen = await Linking.canOpenURL(reportBugMailtoUrl);
      if (!canOpen) {
        Alert.alert(
          "Email unavailable",
          `We couldn't open your email app. Please email ${SUPPORT_EMAIL} to report the bug.`
        );
        return;
      }

      await Linking.openURL(reportBugMailtoUrl);
    } catch {
      Alert.alert(
        "Email unavailable",
        `We couldn't open your email app. Please email ${SUPPORT_EMAIL} to report the bug.`
      );
    }
  }, [reportBugMailtoUrl]);

  useEffect(() => {
    if (!isHydrated || hydratedLastSelectionRef.current) return;

    hydratedLastSelectionRef.current = true;
    if (!storedLastSelectedPlan) return;

    if (storedLastSelectedPlan.collegeId === "grc") {
      const matchedTrack = TRANSFER_PLANNER_TRACKS.find(
        (entry) => entry.id === storedLastSelectedPlan.majorId
      );
      if (!matchedTrack) return;

      autoMajorSelectionRef.current = true;
      setSelectedCollegeId("grc");
      setSelectedCampusId(GRC_PLANNER_CAMPUS_ID);
      setSelectedMajorId(matchedTrack.id);
      return;
    }

    const matchedCampus = TRANSFER_PLANNER_CAMPUSES.find(
      (entry) => entry.id === storedLastSelectedPlan.campusId
    );
    if (!matchedCampus) return;

    const nextMajors = getTransferPlannerStudentRuntimeMajorsForCampus(matchedCampus.id);
    const matchedMajor = nextMajors.find((entry) => entry.id === storedLastSelectedPlan.majorId);
    if (!matchedMajor) return;

    autoMajorSelectionRef.current = true;
    setSelectedCollegeId("uw");
    setSelectedCampusId(matchedCampus.id);
    setSelectedMajorId(matchedMajor.id);
  }, [isHydrated, storedLastSelectedPlan]);

  useEffect(() => {
    const nextCampusId = getDefaultPlannerCampusId(selectedCollegeId);
    if (selectedCollegeId === "grc") {
      if (selectedCampusId !== GRC_PLANNER_CAMPUS_ID) {
        setSelectedCampusId(GRC_PLANNER_CAMPUS_ID);
      }
      return;
    }

    if (!isPlannerUwCampusId(selectedCampusId)) {
      setSelectedCampusId(nextCampusId);
    }
  }, [selectedCollegeId, selectedCampusId]);

  useEffect(() => {
    const nextFirstMajorId =
      selectedCollegeId === "grc"
        ? TRANSFER_PLANNER_TRACKS[0]?.id ?? ""
        : campusMajors[0]?.id ?? "";

    if (selectedCollegeId === "grc") {
      if (!TRANSFER_PLANNER_TRACKS.some((entry) => entry.id === selectedMajorId)) {
        setSelectedMajorId(nextFirstMajorId);
      }
      return;
    }

    if (!campusMajors.some((entry) => entry.id === selectedMajorId)) {
      setSelectedMajorId(nextFirstMajorId);
    }
  }, [campusMajors, selectedCollegeId, selectedMajorId]);

  useEffect(() => {
    if (autoMajorSelectionRef.current) return;
    const rawMajor = String(user?.major ?? "").trim().toLowerCase();
    if (!rawMajor) return;

    const matchedMajor =
      selectedCollegeId === "grc"
        ? TRANSFER_PLANNER_TRACKS.find((entry) => {
            const trackTitle = entry.title.toLowerCase();
            const trackCode = entry.code.toLowerCase();
            return (
              trackTitle.includes(rawMajor) ||
              rawMajor.includes(trackTitle) ||
              rawMajor.includes(trackCode)
            );
          })
        : campusMajors.find((entry) =>
            entry.title.toLowerCase().includes(rawMajor) ||
            rawMajor.includes(entry.shortTitle.toLowerCase()) ||
            rawMajor.includes(entry.title.toLowerCase())
          );

    if (!matchedMajor) return;
    autoMajorSelectionRef.current = true;
    setSelectedMajorId(matchedMajor.id);
  }, [campusMajors, selectedCollegeId, user?.major]);

  useEffect(() => {
    if (!isHydrated || !selectedMajorId) return;
    if (selectedCollegeId === "uw" && !isPlannerUwCampusId(selectedCampusId)) return;
    if (selectedCollegeId === "grc" && selectedCampusId !== GRC_PLANNER_CAMPUS_ID) return;
    if (selectedCollegeId === "uw" && !campusMajors.some((entry) => entry.id === effectiveSelectedMajorId)) {
      return;
    }
    if (
      selectedCollegeId === "grc" &&
      !TRANSFER_PLANNER_TRACKS.some((entry) => entry.id === effectiveSelectedMajorId)
    ) {
      return;
    }

    const currentCollegeId = String(storedLastSelectedPlan?.collegeId ?? "").trim().toLowerCase();
    const currentCampusId = String(storedLastSelectedPlan?.campusId ?? "").trim();
    const currentMajorId = String(storedLastSelectedPlan?.majorId ?? "").trim();
    if (
      currentCollegeId === selectedCollegeId &&
      currentCampusId === effectiveSelectedCampusId &&
      currentMajorId === effectiveSelectedMajorId
    ) {
      return;
    }

    void setQuestionnaireAnswers((currentAnswers) => ({
      ...currentAnswers,
      [LAST_SELECTED_PLAN_FIELD]: {
        collegeId: selectedCollegeId,
        campusId: effectiveSelectedCampusId,
        majorId: effectiveSelectedMajorId,
      },
    }));
  }, [
    campusMajors,
    effectiveSelectedMajorId,
    effectiveSelectedCampusId,
    isHydrated,
    selectedCollegeId,
    selectedCampusId,
    selectedMajorId,
    setQuestionnaireAnswers,
    state.questionnaireAnswers,
    storedLastSelectedPlan,
  ]);

  useEffect(() => {
    let active = true;

    if (!user?.uid) {
      transcriptAnalysisGenerationRef.current += 1;
      setTranscriptDocument(null);
      return () => {
        active = false;
      };
    }

    void (async () => {
      const stored = await storageService.getTranscript(user.uid).catch(() => null);
      if (!active) return;
      transcriptAnalysisGenerationRef.current += 1;
      setTranscriptDocument(stored && stored.url ? stored : null);
    })();

    return () => {
      active = false;
    };
  }, [user?.uid]);

  const analyzeTranscript = useCallback(
    async (document: TranscriptDocument) => {
      const analysisGeneration = transcriptAnalysisGenerationRef.current;
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
        if (analysisGeneration !== transcriptAnalysisGenerationRef.current) return;

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

        await setQuestionnaireAnswers((currentAnswers) => ({
          ...currentAnswers,
          [TRANSCRIPT_COURSES_FIELD]: parsedCourses,
          completedCourses: parsedCourses.map((course) => course.label),
          [TRANSCRIPT_SOURCE_FIELD]: document.url,
          [TRANSCRIPT_PARSER_VERSION_FIELD]: TRANSCRIPT_PARSER_VERSION,
          [TRANSCRIPT_UPLOADED_AT_FIELD]:
            document.uploadedAt || new Date().toISOString(),
        }));
      } catch (error) {
        if (analysisGeneration !== transcriptAnalysisGenerationRef.current) return;
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
          route: ROUTES.transferPlanner,
          tags: ["transcript", "transfer-planner", failureSnapshot.document.urlKind],
          metadata: failureSnapshot,
        });
        setTranscriptError(buildFriendlyTranscriptError());
      } finally {
        if (analysisGeneration === transcriptAnalysisGenerationRef.current) {
          setIsAnalyzingTranscript(false);
        }
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
      transcriptAnalysisGenerationRef.current += 1;
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
        route: ROUTES.transferPlanner,
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

  const removeTranscriptNow = useCallback(async () => {
    if (!user?.uid) return;

    try {
      transcriptAnalysisGenerationRef.current += 1;
      setTranscriptDocument(null);
      transcriptAnalysisAttemptsRef.current.clear();
      setTranscriptError(null);
      setIsAnalyzingTranscript(false);

      await resetTranscriptState({
        userId: user.uid,
        setQuestionnaireAnswers,
        patchUserLocally,
        updateUser,
      });
    } catch (err) {
      const restoredTranscript = await storageService.getTranscript(user.uid).catch(() => null);
      transcriptAnalysisGenerationRef.current += 1;
      setTranscriptDocument(restoredTranscript && restoredTranscript.url ? restoredTranscript : null);
      void errorLoggingService.captureException(err, {
        category: 'storage',
        operation: 'delete-transcript',
        severity: 'warn',
        handled: true,
        source: 'TransferPlannerPage',
      });

      if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert("Couldn't remove transcript.");
      } else {
        Alert.alert('Remove failed', "Couldn't remove transcript.");
      }
    }
  }, [patchUserLocally, setQuestionnaireAnswers, updateUser, user?.uid]);

  const handleRemoveTranscript = useCallback(() => {
    if (!user?.uid) return;

    const title = "Remove transcript";
    const message = "Are you sure you want to remove your uploaded unofficial transcript?";

    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.confirm === "function") {
      if (window.confirm(`${title}\n\n${message}`)) {
        void removeTranscriptNow();
      }
      return;
    }

    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void removeTranscriptNow();
          },
        },
      ]
    );
  }, [removeTranscriptNow, user?.uid]);

  const applicationStatuses = useMemo(
    () =>
      isUwPlanner && plan ? buildRequirementStatuses(plan.applicationChecklist, completedCourses) : [],
    [completedCourses, isUwPlanner, plan]
  );
  const beforeEnrollmentStatuses = useMemo(
    () =>
      isUwPlanner && plan ? buildRequirementStatuses(plan.beforeEnrollmentChecklist, completedCourses) : [],
    [completedCourses, isUwPlanner, plan]
  );
  const stayAtGrcStatuses = useMemo(
    () =>
      isUwPlanner && plan ? buildRequirementStatuses(plan.stayAtGrcChecklist, completedCourses) : [],
    [completedCourses, isUwPlanner, plan]
  );
  const hasOptionalStayAtGrcChecklist = plan?.stayAtGrcChecklist.length
    ? plan.stayAtGrcChecklist.some((item) => item.grcCourses.length > 0)
    : false;
  const shouldShowUwOnlyToggle =
    isUwPlanner && (Boolean(track) || hasOptionalStayAtGrcChecklist);
  const suggestedQuarterPlan = useMemo(
    () =>
      buildSuggestedQuarterPlan({
        plan: isUwPlanner ? plan : null,
        applicationStatuses,
        beforeEnrollmentStatuses,
        stayAtGrcStatuses,
        completedCourses,
        currentCourseLabels: currentPlannedCourseLabels,
        track,
        includeStayAtGrcCourses: isUwPlanner ? !onlyUwEssentialClasses : true,
        includeSummerQuarter: allowSummerClasses,
      }),
    [
      applicationStatuses,
      beforeEnrollmentStatuses,
      completedCourses,
      currentPlannedCourseLabels,
      isUwPlanner,
      allowSummerClasses,
      onlyUwEssentialClasses,
      plan,
      stayAtGrcStatuses,
      track,
    ]
  );
  const studentCourseEvaluations = useMemo(
    () =>
      isUwPlanner && plan
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
      isUwPlanner,
      plan,
      stayAtGrcStatuses,
    ]
  );
  const studentEvaluationReport = useMemo(
    () =>
      isUwPlanner && plan
        ? buildTransferPlannerStudentEvaluationReport({
            plan,
            campusLabel: campus?.title ?? getCollegeOptionLabel(selectedCollegeId),
            completedCourses,
            evaluations: studentCourseEvaluations,
            suggestedQuarterPlan,
          })
        : null,
    [
      campus?.title,
      completedCourses,
      isUwPlanner,
      plan,
      selectedCollegeId,
      studentCourseEvaluations,
      suggestedQuarterPlan,
    ]
  );
  const hasStructuredPlannerData = useMemo(
    () =>
      isUwPlanner
        ? !!plan &&
          (
            plan.applicationChecklist.length > 0 ||
            plan.beforeEnrollmentChecklist.length > 0 ||
            plan.stayAtGrcChecklist.length > 0
          )
        : Boolean(track),
    [isUwPlanner, plan, track]
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

      await setQuestionnaireAnswers((currentAnswers) => ({
        ...currentAnswers,
        [CURRENT_PLANNED_COURSES_FIELD]: nextSelectionMap,
      }));
    },
    [
      currentCourseSelectionsByPath,
      currentPlannedCourseLabels,
      currentPlannedCourseSet,
      plannerPathKey,
      setQuestionnaireAnswers,
    ]
  );
  const handleSelectPathway = useCallback(
    async (pathwayId: string) => {
      if (!selectedBasePlan) return;

      const nextSelectionMap = {
        ...selectedPathwayByPlan,
        [selectedBasePlan.id]: pathwayId,
      };

      await setQuestionnaireAnswers((currentAnswers) => ({
        ...currentAnswers,
        [SELECTED_PATHWAY_FIELD]: nextSelectionMap,
      }));
    },
    [
      selectedBasePlan,
      selectedPathwayByPlan,
      setQuestionnaireAnswers,
    ]
  );
  const plannerHeroContent = useMemo(
    () => getPlannerHeroContent(selectedCollegeId),
    [selectedCollegeId]
  );
  const selectedCollegeLabel = useMemo(
    () => getCollegeOptionLabel(selectedCollegeId),
    [selectedCollegeId]
  );
  const selectedCampusLabel = useMemo(
    () => (isUwPlanner ? campus?.title ?? "UW Seattle" : "Green River College"),
    [campus?.title, isUwPlanner]
  );
  const selectedMajorLabel = useMemo(() => {
    if (!isUwPlanner) {
      return selectedGrcTrack
        ? `${selectedGrcTrack.code} | ${selectedGrcTrack.title}`
        : "Select program";
    }

    return plan?.title ?? selectedBasePlan?.title ?? "Select major";
  }, [isUwPlanner, plan?.title, selectedBasePlan?.title, selectedGrcTrack]);
  const selectedGrcTrackRequirementNoun = useMemo(
    () => getGrcTrackRequirementNoun(selectedGrcTrack),
    [selectedGrcTrack]
  );
  const activeDegreeTitle = useMemo(() => {
    if (!isUwPlanner) {
      return selectedGrcTrack?.title ?? "Selected Green River program";
    }

    return plan?.selectedPathwayLabel ? `${plan.title} (${plan.selectedPathwayLabel})` : plan?.title ?? "Selected UW degree";
  }, [isUwPlanner, plan, selectedGrcTrack]);
  const activeTrackCode = track?.code ?? null;
  const activeTrackTitle = useMemo(
    () =>
      track?.title ??
      (isUwPlanner
        ? "Custom Green River path"
        : selectedGrcTrack?.title ?? "Selected Green River program"),
    [isUwPlanner, selectedGrcTrack, track]
  );
  const activeTrackSummary = useMemo(
    () => (isUwPlanner ? plan?.recommendedTrackSummary ?? "" : track?.summary ?? ""),
    [isUwPlanner, plan?.recommendedTrackSummary, track]
  );
  const activeTrackOfficialLinkUrl = useMemo(
    () =>
      track?.officialLinks?.find((entry) => String(entry?.url ?? "").trim())?.url ?? null,
    [track]
  );
  const collegeOptions = useMemo(
    () => [
      {
        id: "uw",
        label: getCollegeOptionLabel("uw"),
      },
      {
        id: "grc",
        label: getCollegeOptionLabel("grc"),
      },
    ],
    []
  );
  const campusOptions = useMemo(
    () =>
      isUwPlanner
        ? TRANSFER_PLANNER_CAMPUSES.map((entry) => ({
            id: entry.id,
            label: entry.title,
          }))
        : [
            {
              id: GRC_PLANNER_CAMPUS_ID,
              label: "Green River College",
            },
          ],
    [isUwPlanner]
  );
  const majorOptions = useMemo(
    () =>
      isUwPlanner
        ? campusMajors.map((entry) => ({
            id: entry.id,
            label: entry.title,
          }))
        : TRANSFER_PLANNER_TRACKS.map((entry) => ({
            id: entry.id,
            label: `${entry.code} | ${entry.title}`,
            description: stripGeneratedProgramMapSummarySentence(entry.summary),
          })),
    [campusMajors, isUwPlanner]
  );
  const hasNoDirectMajorEquivalencies = useMemo(
    () => isUwPlanner && !!plan && !hasAnyDirectMajorEquivalencies(plan),
    [isUwPlanner, plan]
  );

  if (!user) {
    return (
      <ScreenBackground includeTopInset includeBottomInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <StateCard
            variant="empty"
            title="Open this as a student profile first"
            message="Start as a guest or sign in, then come back here to build a transcript-based course plan."
          />
        </View>
      </ScreenBackground>
    );
  }

  if (isUwPlanner && !plan) {
    return (
      <ScreenBackground includeTopInset includeBottomInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <StateCard
            variant="empty"
            title="No planner data yet"
            message={getPlannerNoDataMessage(selectedCollegeId)}
          />
        </View>
      </ScreenBackground>
    );
  }

  if (!isUwPlanner && !selectedGrcTrack) {
    return (
      <ScreenBackground includeTopInset includeBottomInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <StateCard
            variant="empty"
            title="No planner data yet"
            message={getPlannerNoDataMessage(selectedCollegeId)}
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
            selectorWasOpenOnTouchStartRef.current =
              openSelector !== null || isPathwaySelectorOpen;
            selectorTouchStartedInsideRef.current = false;
          }}
          onTouchEnd={() => {
            if (
              selectorWasOpenOnTouchStartRef.current &&
              !selectorTouchStartedInsideRef.current
            ) {
              setOpenSelector(null);
              setIsPathwaySelectorOpen(false);
            }
            selectorWasOpenOnTouchStartRef.current = false;
            selectorTouchStartedInsideRef.current = false;
          }}
          onScrollBeginDrag={() => {
            setOpenSelector(null);
            setIsPathwaySelectorOpen(false);
          }}
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
                  {plannerHeroContent.title}
                </Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  {plannerHeroContent.description}
                </Text>
              </View>
            </View>
          </View>

          <TranscriptSummaryCard
            collegeId={selectedCollegeId}
            transcriptDocument={transcriptDocument}
            isAnalyzing={isAnalyzingTranscript || needsTranscriptReparse}
            errorMessage={transcriptError}
            studentEvaluationReport={studentEvaluationReport}
            studentCourseEvaluations={studentCourseEvaluations}
            plan={plan}
            pathwayOptions={pathwayOptions}
            selectedPathwayLabel={plan?.selectedPathwayLabel ?? null}
            hasNoDirectMajorEquivalencies={hasNoDirectMajorEquivalencies}
            selectedCollegeId={selectedCollegeId}
            selectedCollegeLabel={selectedCollegeLabel}
            selectedCampusId={effectiveSelectedCampusId}
            selectedCampusLabel={selectedCampusLabel}
            selectedMajorId={effectiveSelectedMajorId}
            selectedMajorLabel={selectedMajorLabel}
            track={track}
            trackCode={activeTrackCode}
            trackTitle={activeTrackTitle}
            trackSummary={activeTrackSummary}
            trackOfficialLinkUrl={activeTrackOfficialLinkUrl}
            completedCourses={completedCourses}
            transcriptDerivedCompletedCourses={transcriptDerivedCompletedCourses}
            hasTranscriptDerivedCreditSource={shouldUseDetailedCompletedCourses}
            openSelector={openSelector}
            collegeOptions={collegeOptions}
            campusOptions={campusOptions}
            majorOptions={majorOptions}
            isPathwaySelectorOpen={isPathwaySelectorOpen}
            onToggleCollege={() =>
              {
                setIsPathwaySelectorOpen(false);
                setOpenSelector((current) => (current === "college" ? null : "college"));
              }
            }
            onToggleCampus={() =>
              {
                setIsPathwaySelectorOpen(false);
                setOpenSelector((current) => (current === "campus" ? null : "campus"));
              }
            }
            onToggleMajor={() =>
              {
                setIsPathwaySelectorOpen(false);
                setOpenSelector((current) => (current === "major" ? null : "major"));
              }
            }
            onTogglePathway={() => {
              setOpenSelector(null);
              setIsPathwaySelectorOpen((current) => !current);
            }}
            onSelectorTouchStartInside={() => {
              selectorTouchStartedInsideRef.current = true;
            }}
            onDismissCampus={() =>
              setOpenSelector((current) => (current === "campus" ? null : current))
            }
            onDismissMajor={() =>
              setOpenSelector((current) => (current === "major" ? null : current))
            }
            onDismissCollege={() =>
              setOpenSelector((current) => (current === "college" ? null : current))
            }
            onSelectCollege={(id) => {
              setSelectedCollegeId(id === "grc" ? "grc" : "uw");
              setIsPathwaySelectorOpen(false);
              setOpenSelector(null);
            }}
            onSelectCampus={(id) => {
              setSelectedCampusId(
                id === GRC_PLANNER_CAMPUS_ID ? GRC_PLANNER_CAMPUS_ID : (id as TransferPlannerCampusId)
              );
              setIsPathwaySelectorOpen(false);
              setOpenSelector(null);
            }}
            onSelectMajor={(id) => {
              setSelectedMajorId(id);
              setIsPathwaySelectorOpen(false);
              setOpenSelector(null);
            }}
            onSelectPathway={(pathwayId) => {
              setIsPathwaySelectorOpen(false);
              handleSelectPathway(pathwayId);
            }}
            onUpload={handlePickTranscript}
            onOpenTranscriptLink={() => {
              void openExternalLink(CTCLINK_UNOFFICIAL_TRANSCRIPT_URL);
            }}
            onRemoveTranscript={handleRemoveTranscript}
            isDesktop={isDesktop}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            cardClass={cardBgClass}
            borderClass={borderClass}
            dropdownBackgroundColor={dropdownSurfaceColor}
          />

          {isUwPlanner && hasNoDirectMajorEquivalencies ? (
            <View className={`${cardBgClass} border rounded-[28px] p-5`}>
              <Text className={`${textClass} text-lg font-semibold`}>
                No class equivalencies for {plan?.title ?? selectedMajorLabel}
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-2`}>
                There are no class equivalencies for this major right now.
              </Text>
              {plan && isOpenAdmissionMajor(plan) ? (
                <Text className={`${secondaryTextClass} text-sm mt-2`}>
                  This is an open major. You would transfer through general UW admission first, then
                  declare {plan.title} through the department&apos;s current process after you enroll.
                </Text>
              ) : null}
            </View>
          ) : null}

          {!hasStructuredPlannerData && !(isUwPlanner && hasNoDirectMajorEquivalencies) ? (
            <View className={`${cardBgClass} border rounded-[28px] p-5`}>
              <Text className={`${textClass} text-lg font-semibold`}>
                Quarter plan note
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                {isUwPlanner
                  ? "This degree does not have a fixed quarter-by-quarter plan yet. Use the Green River class list and source-backed class-order notes above as your starting point. This planner only shows a source-backed plan, and unsupported majors, rules, or sequences stay hidden until public sources can verify them."
                  : `This ${selectedGrcTrackRequirementNoun} does not have a fixed quarter-by-quarter plan yet. Use the tracked Green River ${selectedGrcTrackRequirementNoun} classes above as your starting point while more source-backed sequencing data is added.`}
              </Text>
            </View>
          ) : null}

          {hasStructuredPlannerData ? (
            <>
              <SuggestedScheduleCard
                key={plannerPathKey}
                quarters={suggestedQuarterPlan}
                collegeId={selectedCollegeId}
                degreeTitle={activeDegreeTitle}
                grcTrack={track}
                campusLabel={selectedCampusLabel}
                selectedCampusId={isUwPlanner ? plan?.campusId ?? null : null}
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

          <View className="items-center pb-2">
            <AnimatedIconPressable
              onPress={() => {
                void handleReportBug();
              }}
              accessibilityRole="link"
            >
              <Text className={`${secondaryTextClass} text-sm underline`}>
                Click here to report a bug
              </Text>
            </AnimatedIconPressable>
          </View>

        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
