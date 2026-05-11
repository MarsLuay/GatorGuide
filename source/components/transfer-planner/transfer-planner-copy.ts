
import type { TransferPlannerTrack } from "@/constants/transfer-planner-source/student-runtime";

import type { PlannerCollegeId } from "./transfer-planner-storage";

export const GENERATED_PROGRAM_MAP_SUMMARY_SENTENCE = [
  "Generated automatically",
  "from the current public program-map page",
  "and catalog API.",
].join(" ");

export function getCollegeOptionLabel(collegeId: PlannerCollegeId) {
  return collegeId === "grc" ? "Green River College" : "University of Washington";
}

export function getPlannerHeroContent(collegeId: PlannerCollegeId) {
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

export function getPlannerSelectionHelperText(
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

export function getPlannerMajorSearchPlaceholder(collegeId: PlannerCollegeId) {
  return collegeId === "grc" ? "Search programs" : "Search majors";
}

export function getPlannerNoDataMessage(collegeId: PlannerCollegeId) {
  return collegeId === "grc"
    ? "There is not a Green River program plan for this path yet."
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

export function getGrcTrackRequirementNoun(track: TransferPlannerTrack | null | undefined) {
  return getGrcTrackCredentialKind(track) === "associate" ? "degree" : "program";
}

export function getGrcTrackSpecificsTitle(track: TransferPlannerTrack | null | undefined) {
  return getGrcTrackRequirementNoun(track) === "degree" ? "Degree Specifics" : "Program Specifics";
}

export function getGrcTrackClassesLabelSuffix(track: TransferPlannerTrack | null | undefined) {
  return getGrcTrackRequirementNoun(track) === "degree" ? "Degree Classes" : "Program Classes";
}

export function getScheduleCampusLabel(collegeId: PlannerCollegeId, campusLabel: string) {
  const trimmed = String(campusLabel ?? "").trim();
  if (collegeId === "grc") {
    return trimmed || "Green River College";
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
