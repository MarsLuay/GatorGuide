
import type { TransferPlannerTrack } from "@/constants/transfer-planner-source/student-runtime";

import type { PlannerCollegeId } from "./transfer-planner-storage";

type Translate = (key: string, params?: Record<string, string | number>) => string;

export const GENERATED_PROGRAM_MAP_SUMMARY_SENTENCE = [
  "Generated automatically",
  "from the current public program-map page",
  "and catalog API.",
].join(" ");

export function getCollegeOptionLabel(collegeId: PlannerCollegeId, t?: Translate) {
  if (collegeId === "grc") {
    return t ? t("transferEquivalencies.greenRiverCollege") : "Green River College";
  }
  return t ? t("transferEquivalencies.universityOfWashington") : "University of Washington";
}

export function getPlannerHeroContent(collegeId: PlannerCollegeId, t: Translate) {
  if (collegeId === "grc") {
    return {
      title: t("transferPlanner.grcHeroTitle"),
      description: t("transferPlanner.grcHeroDescription"),
    };
  }

  return {
    title: t("transferPlanner.uwHeroTitle"),
    description: t("transferPlanner.uwHeroDescription"),
  };
}

export function getPlannerSelectionHelperText(
  collegeId: PlannerCollegeId,
  field: "college" | "campus" | "major",
  t?: Translate
) {
  if (field === "college") {
    return t
      ? t("transferPlanner.collegeHelper")
      : "Pick the college whose program requirements you want this planner to follow.";
  }

  if (field === "campus") {
    return collegeId === "grc"
      ? t
        ? t("transferPlanner.grcCampusHelper")
        : "Green River currently has one supported campus in this planner."
      : t
        ? t("transferPlanner.uwCampusHelper")
        : "Set the UW campus and major you want this Green River plan to match against.";
  }

  return collegeId === "grc"
    ? t
      ? t("transferPlanner.grcMajorHelper")
      : "Pick the Green River program you want the course plan to follow."
    : t
      ? t("transferPlanner.uwMajorHelper")
      : "Pick the UW bachelor's degree you want the course plan to follow.";
}

export function getPlannerMajorSearchPlaceholder(collegeId: PlannerCollegeId, t?: Translate) {
  return collegeId === "grc"
    ? t
      ? t("transferPlanner.searchPrograms")
      : "Search programs"
    : t
      ? t("transferPlanner.searchMajors")
      : "Search majors";
}

export function getPlannerNoDataMessage(collegeId: PlannerCollegeId, t?: Translate) {
  return collegeId === "grc"
    ? t
      ? t("transferPlanner.noGrcProgramPlan")
      : "There is not a Green River program plan for this path yet."
    : t
      ? t("transferPlanner.noUwCoursePlan")
      : "There is not a course plan for this campus yet.";
}

export function stripGeneratedProgramMapSummarySentence(text: string | null | undefined) {
  return String(text ?? "")
    .replace(GENERATED_PROGRAM_MAP_SUMMARY_SENTENCE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export type GrcTrackCredentialKind = "associate" | "certificate" | "bas";

export function getGrcTrackCredentialKind(
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

export function getGrcTrackRequirementNoun(
  track: TransferPlannerTrack | null | undefined,
  t?: Translate
) {
  return getGrcTrackCredentialKind(track) === "associate"
    ? t
      ? t("transferPlanner.degreeNoun")
      : "degree"
    : t
      ? t("transferPlanner.programNoun")
      : "program";
}

export function getGrcTrackSpecificsTitle(
  track: TransferPlannerTrack | null | undefined,
  t?: Translate
) {
  return getGrcTrackCredentialKind(track) === "associate"
    ? t
      ? t("transferPlanner.degreeSpecifics")
      : "Degree Specifics"
    : t
      ? t("transferPlanner.programSpecifics")
      : "Program Specifics";
}

export function getGrcTrackClassesLabelSuffix(
  track: TransferPlannerTrack | null | undefined,
  t?: Translate
) {
  return getGrcTrackCredentialKind(track) === "associate"
    ? t
      ? t("transferPlanner.degreeClasses")
      : "Degree Classes"
    : t
      ? t("transferPlanner.programClasses")
      : "Program Classes";
}

export function getScheduleCampusLabel(
  collegeId: PlannerCollegeId,
  campusLabel: string,
  t?: Translate
) {
  const trimmed = String(campusLabel ?? "").trim();
  if (collegeId === "grc") {
    return trimmed || (t ? t("transferEquivalencies.greenRiverCollege") : "Green River College");
  }
  if (!trimmed) return "UW";
  if (/^UW\s+/i.test(trimmed)) return trimmed;
  return `UW ${trimmed}`;
}

export function getAutoTrackSummaryText(trackSummary: string) {
  return stripGeneratedProgramMapSummarySentence(trackSummary);
}

export function parseMatchedTrackSummaryCounts(trackSummary: string) {
  const match = String(trackSummary ?? "").match(
    /\bmatches\s+(\d+)\s+of\s+the\s+(\d+)\s+degree-specific Green River classes/i
  );
  if (!match) {
    return {
      matchCount: "unknown",
      totalTrackedGrcCompletableRequirements: "unknown",
    };
  }

  return {
    matchCount: match[1],
    totalTrackedGrcCompletableRequirements: match[2],
  };
}

export function buildCopyOnlyMatchedTrackDebugText(input: {
  headerTrackId: string | null;
  explanationTrackId: string | null;
  trackSummary: string;
}) {
  const counts = parseMatchedTrackSummaryCounts(input.trackSummary);
  return [
    "[copy-only matched track debug]",
    `Header track id: ${input.headerTrackId ?? "none"}`,
    `Explanation track id: ${input.explanationTrackId ?? "none"}`,
    `Match count: ${counts.matchCount}`,
    `Total tracked GRC-completable requirements: ${counts.totalTrackedGrcCompletableRequirements}`,
  ].join(" ");
}
