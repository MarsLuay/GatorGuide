import type {
  TransferPlannerChecklistItem,
  TransferPlannerMajorPlan,
  TransferPlannerTrack,
} from "@/constants/transfer-planner-data";

const COURSE_CODE_PATTERN = /\b[A-Z]{2,6}&?\s*\d{3}[A-Z]?\b/g;

export type TranscriptCourseEntry = {
  code: string;
  label: string;
};

export type TransferRequirementStatus = {
  item: TransferPlannerChecklistItem;
  matched: boolean;
  matchedCourses: TranscriptCourseEntry[];
  explicitCourseCodes: string[];
};

export type TrackUsageSummary = {
  specificCourseCount: number;
  directUseCount: number;
  directUseEntries: string[];
  extraSpecificEntries: string[];
  generalEdEntryCount: number;
  generalEdEntries: string[];
};

export type SuggestedQuarterCourse = {
  label: string;
  type: "core" | "elective";
};

export type SuggestedQuarterPlan = {
  label: string;
  courses: SuggestedQuarterCourse[];
};

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function normalizeCourseCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export function extractCourseCodes(value: string) {
  return unique(
    (String(value ?? "").toUpperCase().match(COURSE_CODE_PATTERN) ?? []).map((match) =>
      normalizeCourseCode(match)
    )
  );
}

export function parseCompletedTranscriptCourses(rawValue: unknown): TranscriptCourseEntry[] {
  const lines = Array.isArray(rawValue)
    ? rawValue.map((entry) => String(entry ?? ""))
    : String(rawValue ?? "")
        .split(/\r?\n/)
        .map((entry) => entry.trim());

  const seen = new Set<string>();
  const parsed: TranscriptCourseEntry[] = [];

  for (const line of lines) {
    const cleaned = String(line ?? "").replace(/\s+/g, " ").trim();
    if (!cleaned) continue;

    const codes = extractCourseCodes(cleaned);
    for (const code of codes) {
      if (seen.has(code)) continue;
      seen.add(code);
      parsed.push({ code, label: cleaned });
    }
  }

  return parsed;
}

export function buildRequirementStatuses(
  items: TransferPlannerChecklistItem[],
  completedCourses: TranscriptCourseEntry[]
) {
  const completedByCode = new Map<string, TranscriptCourseEntry>();
  for (const course of completedCourses) {
    completedByCode.set(course.code, course);
  }

  return items.map<TransferRequirementStatus>((item) => {
    const explicitCourseCodes = unique(
      item.grcCourses.flatMap((courseLabel) => extractCourseCodes(courseLabel))
    );
    const matchedCourses = explicitCourseCodes
      .map((code) => completedByCode.get(code) ?? null)
      .filter((course): course is TranscriptCourseEntry => !!course);

    return {
      item,
      matched: matchedCourses.length > 0,
      matchedCourses,
      explicitCourseCodes,
    };
  });
}

export function countCompletedRequirements(statuses: TransferRequirementStatus[]) {
  return statuses.filter((status) => status.matched).length;
}

export function buildTrackUsageSummary(
  track: TransferPlannerTrack | null,
  plan: TransferPlannerMajorPlan
): TrackUsageSummary | null {
  if (!track) return null;

  const requiredCourseCodes = new Set(
    unique(
      [
        ...plan.applicationChecklist,
        ...plan.beforeEnrollmentChecklist,
        ...plan.stayAtGrcChecklist,
      ].flatMap((item) => item.grcCourses.flatMap((course) => extractCourseCodes(course)))
    )
  );

  const specificEntries: string[] = [];
  const generalEdEntries: string[] = [];

  for (const term of track.terms) {
    for (const courseEntry of term.courses) {
      if (extractCourseCodes(courseEntry).length > 0) {
        specificEntries.push(courseEntry);
      } else {
        generalEdEntries.push(courseEntry);
      }
    }
  }

  const directUseEntries = specificEntries.filter((entry) =>
    extractCourseCodes(entry).some((code) => requiredCourseCodes.has(code))
  );
  const extraSpecificEntries = specificEntries.filter(
    (entry) => !directUseEntries.includes(entry)
  );

  return {
    specificCourseCount: specificEntries.length,
    directUseCount: directUseEntries.length,
    directUseEntries,
    extraSpecificEntries,
    generalEdEntryCount: generalEdEntries.length,
    generalEdEntries,
  };
}

function isCoreCourseLabel(label: string) {
  const normalized = String(label ?? "").toUpperCase();
  if (
    /\b(MATH|PHYS|CHEM|BIOL|ENGR|CS|CSE|EE|ECE|AMATH|STAT)\b/.test(normalized)
  ) {
    return true;
  }
  return extractCourseCodes(normalized).some((code) =>
    /^(MATH|PHYS|CHEM|BIOL|ENGR|CS|CSE|EE|ECE|AMATH|STAT)/.test(code)
  );
}

function buildQuarterLabels(referenceDate = new Date()) {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  const fallYear = month >= 8 ? year + 1 : year;
  return [`Fall ${fallYear}`, `Winter ${fallYear + 1}`, `Spring ${fallYear + 1}`];
}

function buildGeneralEducationPlaceholders(track: TransferPlannerTrack | null) {
  if (!track) return ["5 credits of Humanities", "5 credits of Social Science"];

  const mapped = unique(
    track.terms
      .flatMap((term) => term.courses)
      .filter((entry) => extractCourseCodes(entry).length === 0)
      .map((entry) => String(entry).toLowerCase())
      .map((entry) => {
        if (entry.includes("humanit")) return "5 credits of Humanities";
        if (entry.includes("social")) return "5 credits of Social Science";
        return "5 credits of elective/general education";
      })
  );

  return mapped.length
    ? mapped
    : ["5 credits of Humanities", "5 credits of Social Science"];
}

export function buildSuggestedQuarterPlan(input: {
  applicationStatuses: TransferRequirementStatus[];
  beforeEnrollmentStatuses: TransferRequirementStatus[];
  stayAtGrcStatuses: TransferRequirementStatus[];
  track: TransferPlannerTrack | null;
  referenceDate?: Date;
}) {
  const remainingCourses = [
    ...input.applicationStatuses,
    ...input.beforeEnrollmentStatuses,
    ...input.stayAtGrcStatuses,
  ]
    .filter((status) => !status.matched)
    .map((status) => status.item.grcCourses[0] ?? status.item.title)
    .filter(Boolean);

  const corePool = remainingCourses
    .filter((course) => isCoreCourseLabel(course))
    .map<SuggestedQuarterCourse>((label) => ({ label, type: "core" }));
  const electivePool = remainingCourses
    .filter((course) => !isCoreCourseLabel(course))
    .map<SuggestedQuarterCourse>((label) => ({ label, type: "elective" }));
  const fillerPool = buildGeneralEducationPlaceholders(input.track).map<SuggestedQuarterCourse>(
    (label) => ({
      label,
      type: "elective",
    })
  );

  const quarterPlans: SuggestedQuarterPlan[] = [];
  for (const label of buildQuarterLabels(input.referenceDate)) {
    const courses: SuggestedQuarterCourse[] = [];

    if (corePool.length) {
      courses.push(corePool.shift() as SuggestedQuarterCourse);
    } else if (electivePool.length) {
      courses.push(electivePool.shift() as SuggestedQuarterCourse);
    }

    while (courses.length < 3 && electivePool.length) {
      courses.push(electivePool.shift() as SuggestedQuarterCourse);
    }

    while (courses.length < 3 && fillerPool.length) {
      courses.push(fillerPool.shift() as SuggestedQuarterCourse);
    }

    if (
      courses.filter((course) => course.type === "core").length < 2 &&
      courses.length < 2 &&
      corePool.length
    ) {
      courses.push(corePool.shift() as SuggestedQuarterCourse);
    }

    while (courses.length < 3 && corePool.length) {
      courses.push(corePool.shift() as SuggestedQuarterCourse);
    }

    quarterPlans.push({ label, courses });
  }

  return quarterPlans;
}
