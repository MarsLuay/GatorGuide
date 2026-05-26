import type { DeadlineCalendarEntry } from "@/services/deadlines/deadline-calendar.service";

export type DeadlineCalendarTranslate = (
  key: string,
  params?: Record<string, string | number>
) => string;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function formatMonthTitle(value: Date, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(value);
  } catch {
    return value.toDateString();
  }
}

export function formatGroupDate(value: string, locale: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(parsed);
  } catch {
    return parsed.toDateString();
  }
}

export function formatRelativeDate(
  value: string,
  locale: string,
  t: DeadlineCalendarTranslate
) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const startTarget = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  );
  const diffDays = Math.round(
    (startTarget.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < -14 || diffDays > 14) return "";

  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      diffDays,
      "day"
    );
  } catch {
    if (diffDays === 0) return t("general.today");
    if (diffDays === 1) return t("general.tomorrow");
    if (diffDays === -1) return t("general.yesterday");
    if (diffDays > 1) return t("general.inDays", { count: diffDays });
    return t("general.daysAgo", { count: Math.abs(diffDays) });
  }
}

export function normalizeAgendaText(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

export function buildAgendaPreviewText(
  value: string | null | undefined,
  maxChars: number
) {
  const normalized = normalizeAgendaText(value);
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`;
}

export function getEntryTranslatedText(
  value: string | null | undefined,
  key: string | undefined,
  t: DeadlineCalendarTranslate
) {
  return value || (key ? t(key) : "");
}

export function getEntrySubtitle(
  item: DeadlineCalendarEntry,
  t: DeadlineCalendarTranslate
) {
  return getEntryTranslatedText(item.subtitle, item.subtitleKey, t);
}

export function getEntrySourceLabel(
  item: DeadlineCalendarEntry,
  t: DeadlineCalendarTranslate
) {
  return getEntryTranslatedText(item.sourceLabel, item.sourceLabelKey, t);
}

export function formatKindLabel(
  item: DeadlineCalendarEntry,
  t: DeadlineCalendarTranslate
) {
  if (item.kind === "scholarship") return t("deadlineCalendar.kindScholarship");
  if (item.kind === "internship") return t("deadlineCalendar.kindOpportunity");
  if (item.kind === "college_deadline") return t("deadlineCalendar.kindCollegeDeadline");
  if (item.kind === "quarter-start") return t("deadlineCalendar.kindQuarterStart");
  if (item.kind === "quarter-end") return t("deadlineCalendar.kindQuarterEnd");
  if (item.kind === "general_deadline") return t("deadlineCalendar.kindGeneralDeadline");
  return t("deadlineCalendar.kindRoadmapTask");
}

export function getItemIcon(item: DeadlineCalendarEntry) {
  if (item.kind === "scholarship") return "attach-money";
  if (item.kind === "internship") return "work-outline";
  if (item.kind === "college_deadline") return "school";
  if (item.kind === "quarter-start") return "event-available";
  if (item.kind === "quarter-end") return "event-note";
  if (item.kind === "general_deadline") return "event";
  return "checklist";
}

export function getPrimaryActionLabel(
  item: DeadlineCalendarEntry,
  t: DeadlineCalendarTranslate
) {
  if (item.target.type === "college") return t("deadlineCalendar.actionOpenCollege");
  if (item.target.type === "roadmap") return t("deadlineCalendar.actionShownHere");
  if (item.target.type === "resources") return t("deadlineCalendar.actionViewOpportunity");
  return t("deadlineCalendar.actionOpenLink");
}
