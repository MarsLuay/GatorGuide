import type {
  TransferPlannerChecklistItem,
  TransferPlannerMajorPlan,
  TransferPlannerTrack,
} from "@/constants/transfer-planner-data";

const COURSE_CODE_PATTERN = /\b[A-Z]{2,6}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;

export type TranscriptCourseEntry = {
  code: string;
  label: string;
  termLabel?: string | null;
  termStartDate?: string | null;
  termEndDate?: string | null;
};

export type TransferRequirementStatus = {
  item: TransferPlannerChecklistItem;
  matched: boolean;
  matchedCourses: TranscriptCourseEntry[];
  explicitCourseCodes: string[];
  requiredCompletedCount: number;
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
  status: "completed" | "current" | "planned";
};

export type SuggestedQuarterPlan = {
  label: string;
  phase: "completed" | "current" | "planned";
  courses: SuggestedQuarterCourse[];
};

type PendingSuggestedCourse = SuggestedQuarterCourse & {
  sequenceGroup: string | null;
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
  const seen = new Set<string>();
  const parsed: TranscriptCourseEntry[] = [];
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

        for (const code of extractCourseCodes(String(record.code ?? cleaned))) {
          pushEntry({
            code,
            label: cleaned,
            termLabel,
            termStartDate,
            termEndDate,
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

type RequirementCourseOption = {
  courseLabels: string[];
  explicitCourseCodes: string[];
  matchedCourses: TranscriptCourseEntry[];
  requiredCompletedCount: number;
  matched: boolean;
  remainingCourseCodes: string[];
  index: number;
};

function getChecklistCourseOptions(item: TransferPlannerChecklistItem) {
  return [item.grcCourses, ...(item.alternatives ?? [])]
    .map((courseLabels) =>
      Array.from(
        new Set(
          courseLabels
            .map((label) => String(label ?? "").trim())
            .filter(Boolean)
        )
      )
    )
    .filter((courseLabels) => courseLabels.length > 0);
}

function buildRequirementCourseOption(
  item: TransferPlannerChecklistItem,
  courseLabels: string[],
  index: number,
  completedByCode: Map<string, TranscriptCourseEntry>
): RequirementCourseOption {
  const explicitCourseCodes = unique(
    courseLabels.flatMap((courseLabel) => extractCourseCodes(courseLabel))
  );
  const matchedCourses = explicitCourseCodes
    .map((code) => completedByCode.get(code) ?? null)
    .filter((course): course is TranscriptCourseEntry => !!course);
  const requiredCompletedCount = explicitCourseCodes.length
    ? Math.max(
        1,
        Math.min(item.minCompletedCount ?? explicitCourseCodes.length, explicitCourseCodes.length)
      )
    : 0;
  const matchedCodes = new Set(matchedCourses.map((course) => course.code));
  const remainingCourseCodes = explicitCourseCodes.filter((code) => !matchedCodes.has(code));

  return {
    courseLabels,
    explicitCourseCodes,
    matchedCourses,
    requiredCompletedCount,
    matched: requiredCompletedCount > 0 && matchedCourses.length >= requiredCompletedCount,
    remainingCourseCodes,
    index,
  };
}

function selectPreferredRequirementOption(options: RequirementCourseOption[]) {
  return [...options].sort((left, right) => {
    const matchedStatusDelta = Number(right.matched) - Number(left.matched);
    if (matchedStatusDelta !== 0) return matchedStatusDelta;

    const matchedDelta = right.matchedCourses.length - left.matchedCourses.length;
    if (matchedDelta !== 0) return matchedDelta;

    const remainingDelta = left.remainingCourseCodes.length - right.remainingCourseCodes.length;
    if (remainingDelta !== 0) return remainingDelta;

    const sizeDelta = left.explicitCourseCodes.length - right.explicitCourseCodes.length;
    if (sizeDelta !== 0) return sizeDelta;

    return left.index - right.index;
  })[0] ?? null;
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
    const selectedOption =
      selectPreferredRequirementOption(
        getChecklistCourseOptions(item).map((courseLabels, index) =>
          buildRequirementCourseOption(item, courseLabels, index, completedByCode)
        )
      ) ??
      buildRequirementCourseOption(item, item.grcCourses, 0, completedByCode);

    return {
      item,
      matched: selectedOption.matched,
      matchedCourses: selectedOption.matchedCourses,
      explicitCourseCodes: selectedOption.explicitCourseCodes,
      requiredCompletedCount: selectedOption.requiredCompletedCount,
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
      ].flatMap((item) =>
        getChecklistCourseOptions(item).flatMap((courseLabels) =>
          courseLabels.flatMap((course) => extractCourseCodes(course))
        )
      )
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

type PlanningQuarterKind = "Winter" | "Spring" | "Summer" | "Fall";

type PlanningQuarterSlot = {
  kind: PlanningQuarterKind;
  year: number;
  label: string;
  start: Date;
  end: Date;
};

function buildLocalQuarterDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function buildPlanningQuarterSlot(
  kind: PlanningQuarterKind,
  year: number
): PlanningQuarterSlot {
  switch (kind) {
    case "Winter":
      return {
        kind,
        year,
        label: `Winter ${year}`,
        start: buildLocalQuarterDate(year, 1, 2),
        end: buildLocalQuarterDate(year, 3, 20),
      };
    case "Spring":
      return {
        kind,
        year,
        label: `Spring ${year}`,
        start: buildLocalQuarterDate(year, 4, 1),
        end: buildLocalQuarterDate(year, 6, 18),
      };
    case "Summer":
      return {
        kind,
        year,
        label: `Summer ${year}`,
        start: buildLocalQuarterDate(year, 7, 1),
        end: buildLocalQuarterDate(year, 8, 21),
      };
    case "Fall":
      return {
        kind,
        year,
        label: `Fall ${year}`,
        start: buildLocalQuarterDate(year, 9, 22),
        end: buildLocalQuarterDate(year, 12, 11),
      };
  }
}

function getCurrentOrNextQuarterSlot(referenceDate = new Date()) {
  const normalizedReference = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );
  const year = normalizedReference.getFullYear();
  const candidateSlots = [
    buildPlanningQuarterSlot("Winter", year),
    buildPlanningQuarterSlot("Spring", year),
    buildPlanningQuarterSlot("Fall", year),
    buildPlanningQuarterSlot("Winter", year + 1),
  ];

  for (const slot of candidateSlots) {
    if (normalizedReference >= slot.start && normalizedReference <= slot.end) {
      return slot;
    }

    if (normalizedReference < slot.start) {
      return slot;
    }
  }

  return buildPlanningQuarterSlot("Winter", year + 1);
}

function getNextPlannedQuarterSlot(currentSlot: PlanningQuarterSlot): PlanningQuarterSlot {
  switch (currentSlot.kind) {
    case "Winter":
      return buildPlanningQuarterSlot("Spring", currentSlot.year);
    case "Spring":
      return buildPlanningQuarterSlot("Fall", currentSlot.year);
    case "Summer":
      return buildPlanningQuarterSlot("Fall", currentSlot.year);
    case "Fall":
      return buildPlanningQuarterSlot("Winter", currentSlot.year + 1);
  }
}

function buildQuarterLabels(referenceDate = new Date()) {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  const fallYear = month >= 8 ? year + 1 : year;
  return [`Fall ${fallYear}`, `Winter ${fallYear + 1}`, `Spring ${fallYear + 1}`];
}

function buildQuarterLabelsAfterCurrent(referenceDate = new Date()) {
  const labels: string[] = [];
  let slot = getCurrentOrNextQuarterSlot(referenceDate);

  while (labels.length < 3) {
    slot = getNextPlannedQuarterSlot(slot);
    labels.push(slot.label);
  }

  return labels;
}

function buildCompletedQuarterPlans(completedCourses: TranscriptCourseEntry[]) {
  const grouped = new Map<
    string,
    { label: string; sortKey: string; courses: SuggestedQuarterCourse[] }
  >();

  for (const course of completedCourses) {
    const label = String(course.termLabel ?? "").trim() || "Past completed courses";
    const sortKey = String(course.termStartDate ?? "").trim() || label;
    const groupKey = `${sortKey}|${label}`;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        label,
        sortKey,
        courses: [],
      });
    }

    grouped.get(groupKey)?.courses.push({
      label: course.label,
      type: isCoreCourseLabel(course.code) ? "core" : "elective",
      status: "completed",
    });
  }

  return [...grouped.values()]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map<SuggestedQuarterPlan>((group) => ({
      label: group.label,
      phase: "completed",
      courses: group.courses,
    }));
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

function takeNextEligibleCourse(
  pool: PendingSuggestedCourse[],
  selectedCourses: PendingSuggestedCourse[]
) {
  const selectedSequenceGroups = new Set(
    selectedCourses
      .map((course) => course.sequenceGroup)
      .filter((group): group is string => !!group)
  );

  const nextIndex = pool.findIndex((course) => {
    if (!course.sequenceGroup) return true;
    return !selectedSequenceGroups.has(course.sequenceGroup);
  });

  if (nextIndex === -1) {
    return null;
  }

  const [course] = pool.splice(nextIndex, 1);
  return course ?? null;
}

function allocateQuarterCourses({
  seedCourses,
  corePool,
  electivePool,
  fillerPool,
}: {
  seedCourses?: PendingSuggestedCourse[];
  corePool: PendingSuggestedCourse[];
  electivePool: PendingSuggestedCourse[];
  fillerPool: PendingSuggestedCourse[];
}) {
  const courses = [...(seedCourses ?? [])];

  if (courses.length >= 3) {
    return courses.map<SuggestedQuarterCourse>(({ label, type, status }) => ({
      label,
      type,
      status,
    }));
  }

  const hasCoreCourse = courses.some((course) => course.type === "core");

  if (!hasCoreCourse && corePool.length) {
    const nextCore = takeNextEligibleCourse(corePool, courses);
    if (nextCore) {
      courses.push(nextCore);
    }
  }

  while (courses.length < 3 && electivePool.length) {
    const nextElective = takeNextEligibleCourse(electivePool, courses);
    if (!nextElective) break;
    courses.push(nextElective);
  }

  while (courses.length < 3 && fillerPool.length) {
    const nextFiller = takeNextEligibleCourse(fillerPool, courses);
    if (!nextFiller) break;
    courses.push(nextFiller);
  }

  while (courses.length < 3 && corePool.length) {
    const nextCore = takeNextEligibleCourse(corePool, courses);
    if (!nextCore) break;
    courses.push(nextCore);
  }

  return courses.map<SuggestedQuarterCourse>(({ label, type, status }) => ({
    label,
    type,
    status,
  }));
}

function buildRemainingSuggestedCourses(statuses: TransferRequirementStatus[]) {
  const remainingByLabel = new Map<string, PendingSuggestedCourse>();

  for (const status of statuses.filter((entry) => !entry.matched)) {
    const matchedCodes = new Set(status.matchedCourses.map((course) => course.code));
    const missingExplicitCodes = status.explicitCourseCodes.filter((code) => !matchedCodes.has(code));
    const remainingNeeded =
      status.requiredCompletedCount < status.explicitCourseCodes.length
        ? Math.max(1, status.requiredCompletedCount - status.matchedCourses.length)
        : status.explicitCourseCodes.length;
    const labelsToSchedule = !missingExplicitCodes.length
      ? [status.item.grcCourses[0] ?? status.item.title]
      : status.requiredCompletedCount < status.explicitCourseCodes.length
        ? missingExplicitCodes.slice(0, remainingNeeded)
        : missingExplicitCodes;
    const shouldSequenceCourses =
      status.requiredCompletedCount === status.explicitCourseCodes.length &&
      status.explicitCourseCodes.length > 1;

    for (const label of labelsToSchedule) {
      if (remainingByLabel.has(label)) continue;

      remainingByLabel.set(label, {
        label,
        type: isCoreCourseLabel(label) ? "core" : "elective",
        status: "planned",
        sequenceGroup: shouldSequenceCourses ? status.item.id : null,
      });
    }
  }

  return [...remainingByLabel.values()];
}

export function buildSuggestedQuarterPlan(input: {
  applicationStatuses: TransferRequirementStatus[];
  beforeEnrollmentStatuses: TransferRequirementStatus[];
  stayAtGrcStatuses: TransferRequirementStatus[];
  completedCourses: TranscriptCourseEntry[];
  track: TransferPlannerTrack | null;
  currentCourseLabels?: string[];
  referenceDate?: Date;
  includeStayAtGrcCourses?: boolean;
}) {
  const selectedCurrentCourseLabels = new Set(
    unique(
      (input.currentCourseLabels ?? [])
        .map((label) => String(label ?? "").trim())
        .filter(Boolean)
    )
  );

  const remainingCourses = buildRemainingSuggestedCourses([
    ...input.applicationStatuses,
    ...input.beforeEnrollmentStatuses,
    ...(input.includeStayAtGrcCourses === false ? [] : input.stayAtGrcStatuses),
  ]);
  const completedQuarterPlans = buildCompletedQuarterPlans(input.completedCourses);
  const currentQuarterCourses = remainingCourses
    .filter((course) => selectedCurrentCourseLabels.has(course.label))
    .map<PendingSuggestedCourse>((course) => ({
      ...course,
      status: "current",
    }));
  const currentQuarterSlot = currentQuarterCourses.length
    ? getCurrentOrNextQuarterSlot(input.referenceDate)
    : null;
  const coursesStillToPlan = remainingCourses.filter(
    (course) => !selectedCurrentCourseLabels.has(course.label)
  );

  const corePool = coursesStillToPlan
    .filter((course) => isCoreCourseLabel(course.label))
    .map<PendingSuggestedCourse>((course) => ({
      ...course,
      type: "core",
      status: "planned",
    }));
  const electivePool = coursesStillToPlan
    .filter((course) => !isCoreCourseLabel(course.label))
    .map<PendingSuggestedCourse>((course) => ({
      ...course,
      type: "elective",
      status: "planned",
    }));
  const fillerPool = buildGeneralEducationPlaceholders(input.track).map<PendingSuggestedCourse>(
    (label) => ({
      label,
      type: "elective",
      status: "planned",
      sequenceGroup: null,
    })
  );
  const currentQuarterPlan = currentQuarterCourses.length
    ? {
        label: currentQuarterSlot?.label ?? "Current / In progress",
        phase: "current" as const,
        courses: allocateQuarterCourses({
          seedCourses: currentQuarterCourses,
          corePool,
          electivePool,
          fillerPool,
        }),
      }
    : null;

  const futureQuarterPlans: SuggestedQuarterPlan[] = [];
  if (coursesStillToPlan.length || (!completedQuarterPlans.length && !currentQuarterCourses.length)) {
    const futureQuarterLabels = currentQuarterSlot
      ? buildQuarterLabelsAfterCurrent(input.referenceDate)
      : buildQuarterLabels(input.referenceDate);

    for (const label of futureQuarterLabels) {
      futureQuarterPlans.push({
        label,
        phase: "planned",
        courses: allocateQuarterCourses({
          corePool,
          electivePool,
          fillerPool,
        }),
      });
    }
  }

  return [
    ...completedQuarterPlans,
    ...(currentQuarterPlan ? [currentQuarterPlan] : []),
    ...futureQuarterPlans,
  ];
}
