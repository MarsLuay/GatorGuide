import { TRANSFER_PLANNER_CURRENT_COURSES_BY_PATH_FIELD } from "@/constants/planner-storage";
import type { DeadlineCalendarEntry } from "@/services/deadlines/deadline-calendar.service";
import { hasConcreteSuggestedQuarterCourse } from "@/services/planning/transfer-planner.service";
import { getSuggestedScheduleCourseDisplayLabel } from "@/components/transfer-planner/transfer-planner-suggested-schedule";

export type HomeCurrentCourse = {
  id: string;
  label: string;
};

export type HomeTranslate = (
  key: string,
  params?: Record<string, string | number>
) => string;

export function formatImportantDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  try {
    const options: Intl.DateTimeFormatOptions = {
      month: "long",
      day: "numeric",
      year: "numeric",
    };
    return new Intl.DateTimeFormat(undefined, options).format(parsed);
  } catch {
    return value;
  }
}

export function formatGpaDisplay(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return raw;
  const num = Number.parseFloat(match[0]);
  if (!Number.isFinite(num)) return raw;
  const clamped = Math.max(0, Math.min(num, 4.0));
  const truncated = Math.floor(clamped * 100) / 100;
  return truncated.toFixed(2).replace(/\.0+$|0+$/g, "");
}

export function getHomeFirstNameDisplay(value: string | null | undefined, fallback: string) {
  const firstName = String(value ?? "").trim().split(/\s+/)[0] ?? "";
  if (!firstName) return fallback;
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

export function getDeadlineOpportunityId(entry: DeadlineCalendarEntry) {
  if (entry.target.type === "resources") return entry.target.opportunityId;
  const opportunityPrefix = "opportunity:";
  return entry.id.startsWith(opportunityPrefix)
    ? entry.id.slice(opportunityPrefix.length)
    : null;
}

export function getDeadlineEntrySubtitle(
  entry: DeadlineCalendarEntry,
  t: HomeTranslate
) {
  return entry.subtitle || (entry.subtitleKey ? t(entry.subtitleKey) : "");
}

export function getPlannerCurrentCourseDisplayLabel(value: string) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const parts = normalized.split("|").map((part) => part.trim());
  const sourceGroup = parts[0];
  const isPlannerInstanceKey =
    (sourceGroup === "gen-ed" || sourceGroup === "requirement") && parts.length >= 8;

  if (!isPlannerInstanceKey) {
    return normalized;
  }

  const occurrenceIndex = Number(parts[parts.length - 1]);
  const sourceOrder = Number(parts[parts.length - 3]);
  const priorityRank = Number(parts[parts.length - 4]);
  const label = parts.slice(2, -5).join("|").trim();

  if (
    !label ||
    !Number.isInteger(occurrenceIndex) ||
    !Number.isFinite(sourceOrder) ||
    !Number.isFinite(priorityRank)
  ) {
    return normalized;
  }

  return getSuggestedScheduleCourseDisplayLabel(label) || label;
}

export function getPlannerCurrentCourseKeys(
  questionnaireAnswers: Record<string, unknown> | null | undefined
) {
  const rawValue = questionnaireAnswers?.[TRANSFER_PLANNER_CURRENT_COURSES_BY_PATH_FIELD];
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return [] as string[];
  }

  const seen = new Set<string>();
  const merged: string[] = [];

  for (const value of Object.values(rawValue)) {
    if (!Array.isArray(value)) continue;

    for (const entry of value) {
      const normalized = String(entry ?? "").trim();
      if (!normalized || seen.has(normalized)) continue;
      const displayLabel = getPlannerCurrentCourseDisplayLabel(normalized);
      if (!hasConcreteSuggestedQuarterCourse({ label: displayLabel })) continue;
      seen.add(normalized);
      merged.push(normalized);
    }
  }

  return merged;
}

export function mergeHomeCurrentCourses(
  desktopCurrentCourses: readonly string[],
  plannerCurrentCourses: readonly string[]
) {
  const seen = new Set<string>();
  const merged: HomeCurrentCourse[] = [];

  for (const source of [desktopCurrentCourses, plannerCurrentCourses]) {
    for (const entry of source) {
      const normalized = String(entry ?? "").trim();
      const label = getPlannerCurrentCourseDisplayLabel(normalized);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push({ id: normalized, label });
    }
  }

  return merged;
}

export function getHomeDeadlineKindLabelKey(kind: DeadlineCalendarEntry["kind"]) {
  if (kind === "roadmap_task") return "home.deadlineKindSchool";
  if (kind === "scholarship") return "home.deadlineKindScholarship";
  if (kind === "internship") return "home.deadlineKindInternship";
  return "home.deadlineKindCollege";
}
