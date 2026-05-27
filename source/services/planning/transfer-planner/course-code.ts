import {
  extractTransferPlannerCourseCodes,
  normalizeTransferPlannerCourseCode,
} from "@/constants/transfer-planner-source/student-runtime";

export const COURSE_CODE_PATTERN = /\b[A-Z]{2,6}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;

export type TranscriptCourseEntry = {
  code: string;
  label: string;
  credits?: number | null;
  grade?: string | null;
  gradeValue?: number | null;
  termLabel?: string | null;
  termStartDate?: string | null;
  termEndDate?: string | null;
  catalogYearLabel?: string | null;
};

function unique(items: string[]) {
  return Array.from(new Set(items));
}

const LEGACY_COURSE_CODE_ALIASES = new Map<string, string>([
  ["MATH& 254", "MATH& 264"],
]);

export function normalizeCourseCode(value: string) {
  const normalized = normalizeTransferPlannerCourseCode(value);
  return LEGACY_COURSE_CODE_ALIASES.get(normalized) ?? normalized;
}

export function extractCourseCodes(value: string) {
  return unique(
    [
      ...(String(value ?? "").toUpperCase().match(COURSE_CODE_PATTERN) ?? []),
      ...extractTransferPlannerCourseCodes(String(value ?? "")),
    ]
      .map((match) => normalizeCourseCode(match))
      .filter((courseCode) => !/^(?:AND|OR)\s+\d{3}/.test(courseCode))
  );
}

const GRC_DISTRIBUTION_PLACEHOLDER_CODE_PATTERN =
  /\b(?:[123]\s*[ABC]|[HSDN]\s*\d+)\b(?:\s*[-:]|\b)/i;
const GRC_DISTRIBUTION_PLACEHOLDER_TEXT_PATTERN =
  /\b(?:A\s*&\s*H|SSc|NSc|humanities|fine arts|arts and humanities|social sciences?|natural sciences?)\b/i;
const GRC_DISTRIBUTION_CHOICE_CUE_PATTERN = /\b(?:or|select|choose)\b/i;

export function hasCourseAndDistributionPlaceholderSignal(label: string) {
  const normalizedLabel = String(label ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedLabel || !extractCourseCodes(normalizedLabel).length) {
    return false;
  }

  const hasDistributionCode =
    GRC_DISTRIBUTION_PLACEHOLDER_CODE_PATTERN.test(normalizedLabel);
  const hasDistributionText =
    GRC_DISTRIBUTION_PLACEHOLDER_TEXT_PATTERN.test(normalizedLabel);
  const hasChoiceCue = GRC_DISTRIBUTION_CHOICE_CUE_PATTERN.test(normalizedLabel);

  return (
    (hasDistributionCode && (hasChoiceCue || hasDistributionText)) ||
    (hasDistributionText && hasChoiceCue)
  );
}

export function isMergedCourseDistributionRequirementLabel(label: string) {
  return hasCourseAndDistributionPlaceholderSignal(label);
}

export function parseCompletedTranscriptCourses(rawValue: unknown): TranscriptCourseEntry[] {
  const seen = new Set<string>();
  const parsed: TranscriptCourseEntry[] = [];
  const parseCredits = (value: unknown) => {
    const credits = Number(value);
    return Number.isFinite(credits) && credits > 0 ? credits : null;
  };
  const parseGradeValue = (value: unknown) => {
    const raw = String(value ?? "").trim();
    if (!raw) return null;

    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.min(numeric, 4));
    }

    const grade = raw.toUpperCase();
    const letterValues: Record<string, number> = {
      "A+": 4,
      A: 4,
      "A-": 3.7,
      "B+": 3.3,
      B: 3,
      "B-": 2.7,
      "C+": 2.3,
      C: 2,
      "C-": 1.7,
      "D+": 1.3,
      D: 1,
      "D-": 0.7,
      F: 0,
    };
    return letterValues[grade] ?? null;
  };
  const pushEntry = (entry: TranscriptCourseEntry) => {
    if (seen.has(entry.code)) return;
    seen.add(entry.code);
    parsed.push(entry);
  };

  if (Array.isArray(rawValue)) {
    for (const rawEntry of rawValue) {
      if (rawEntry && typeof rawEntry === "object" && !Array.isArray(rawEntry)) {
        const record = rawEntry as Record<string, unknown>;
        const cleaned = String(
          record.label ?? [record.code, record.title].filter(Boolean).join(" ")
        )
          .replace(/\s+/g, " ")
          .trim();
        if (!cleaned) continue;

        const termLabel = String(record.termLabel ?? "").replace(/\s+/g, " ").trim() || null;
        const termStartDate =
          String(record.termStartDate ?? "").replace(/\s+/g, " ").trim() || null;
        const termEndDate =
          String(record.termEndDate ?? "").replace(/\s+/g, " ").trim() || null;
        const credits = parseCredits(
          record.credits ?? record.earnedCredits ?? record.credit
        );
        const grade = String(record.grade ?? "").replace(/\s+/g, " ").trim() || null;
        const gradeValue =
          parseGradeValue(record.gradeValue) ??
          parseGradeValue(grade);

        for (const code of extractCourseCodes(String(record.code ?? cleaned))) {
          pushEntry({
            code,
            label: cleaned,
            credits,
            grade,
            gradeValue,
            termLabel,
            termStartDate,
            termEndDate,
            catalogYearLabel:
              String(record.catalogYearLabel ?? "").replace(/\s+/g, " ").trim() || null,
          });
        }
        continue;
      }

      const cleaned = String(rawEntry ?? "").replace(/\s+/g, " ").trim();
      if (!cleaned) continue;

      for (const code of extractCourseCodes(cleaned)) {
        pushEntry({ code, label: cleaned });
      }
    }

    return parsed;
  }

  const lines = String(rawValue ?? "")
    .split(/\r?\n/)
    .map((entry) => entry.trim());

  for (const line of lines) {
    const cleaned = String(line ?? "").replace(/\s+/g, " ").trim();
    if (!cleaned) continue;

    for (const code of extractCourseCodes(cleaned)) {
      pushEntry({ code, label: cleaned });
    }
  }

  return parsed;
}

export function parseCatalogYearStart(label: string | null | undefined) {
  const match = String(label ?? "").match(/^(\d{4})-(\d{4})$/);
  if (!match) return null;
  return Number.parseInt(match[1] ?? "", 10);
}

function formatGrcCatalogYearLabel(startYear: number) {
  return `${startYear}-${startYear + 1}`;
}

function inferGrcCatalogYearLabelFromTermLabel(termLabel: string | null | undefined) {
  const normalized = String(termLabel ?? "").replace(/\s+/g, " ").trim();
  const match = normalized.match(/\b(Fall|Autumn|Winter|Spring|Summer)\s+(\d{4})\b/i);
  if (!match) return null;

  const term = String(match[1] ?? "").toLowerCase();
  const year = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(year)) return null;

  if (term === "fall" || term === "autumn") {
    return formatGrcCatalogYearLabel(year);
  }

  return formatGrcCatalogYearLabel(year - 1);
}

function inferGrcCatalogYearLabelFromDate(value: string | null | undefined) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

  return formatGrcCatalogYearLabel(month >= 8 ? year : year - 1);
}

export function inferTransferPlannerGrcCatalogYearLabel(
  completedCourses: TranscriptCourseEntry[]
) {
  const explicitCatalogYearLabels = completedCourses
    .map((course) => course.catalogYearLabel ?? null)
    .filter((label): label is string => Boolean(label) && parseCatalogYearStart(label) !== null)
    .sort((left, right) => (parseCatalogYearStart(left) ?? 0) - (parseCatalogYearStart(right) ?? 0));
  if (explicitCatalogYearLabels.length) {
    return explicitCatalogYearLabels[0] ?? null;
  }

  const candidateLabels = completedCourses
    .flatMap((course) => [
      inferGrcCatalogYearLabelFromDate(course.termStartDate),
      inferGrcCatalogYearLabelFromTermLabel(course.termLabel),
    ])
    .filter((label): label is string => Boolean(label));
  const sortedLabels = candidateLabels
    .filter((label) => parseCatalogYearStart(label) !== null)
    .sort((left, right) => (parseCatalogYearStart(left) ?? 0) - (parseCatalogYearStart(right) ?? 0));

  return sortedLabels[0] ?? null;
}

export function getCurrentTransferPlannerGrcCatalogYearLabel(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;
  return formatGrcCatalogYearLabel(month >= 8 ? year : year - 1);
}
