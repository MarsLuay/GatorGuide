import {
  getTransferPlannerGrcCourseAvailabilitySummary,
  getTransferPlannerGrcCourseLatestPublishedQuarters,
  getTransferPlannerChainsForPlan,
  TransferPlannerChecklistItem,
  TransferPlannerMajorPlan,
  TransferPlannerTrack,
} from "@/constants/transfer-planner-source";

const COURSE_CODE_PATTERN = /\b[A-Z]{2,6}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;
const QUARTER_ORDER_ENFORCED_CHAIN_IDS = new Set([
  "WRIT-SEQ",
  "CS-NEW",
  "CS-LEGACY",
  "PHYS-CALC",
  "PHYS-ALG",
  "CHEM-GEN",
  "CHEM-ORG",
  "BIO-MAJORS",
  "BIO-ANAT",
  "LANG-CHIN",
  "LANG-FR",
  "LANG-GER",
  "LANG-JP",
  "LANG-SP",
]);
const CHECKLIST_CHOICE_PREVIEW_LIMIT = 8;

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
  guidanceSummary?: string | null;
  availabilitySummary?: string | null;
};

export type SuggestedQuarterPlan = {
  label: string;
  phase: "completed" | "current" | "planned";
  courses: SuggestedQuarterCourse[];
};

type RequirementPriorityBucket = "application" | "beforeEnrollment" | "stayAtGrc";
type ChecklistGuidanceTopic =
  | "programming"
  | "circuit"
  | "math"
  | "statistics"
  | "writing"
  | "physics"
  | "chemistry"
  | "biology"
  | "economics"
  | "gis"
  | "language"
  | "communication"
  | "design"
  | "general";

type PendingSuggestedCourse = SuggestedQuarterCourse & {
  sequenceGroup: string | null;
  priorityRank: number;
  sourceOrder: number;
  explicitCourseCodes: string[];
  prerequisiteCourseSets: string[][];
};

const REQUIREMENT_PRIORITY_RANK: Record<RequirementPriorityBucket, number> = {
  application: 0,
  beforeEnrollment: 1,
  stayAtGrc: 2,
};

function detectChecklistGuidanceTopic(item: TransferPlannerChecklistItem): ChecklistGuidanceTopic {
  const normalized = `${item.title} ${(item.grcCourses ?? []).join(" ")} ${(
    item.alternatives ?? []
  )
    .flat()
    .join(" ")}`
    .toUpperCase()
    .replace(/\s+/g, " ");

  if (
    /\b(CIRCUIT|EE 201|EE 215|ENGR& 204|ENGR& 214|ENGR& 224|ENGR& 225|ENGR 140)\b/.test(normalized)
  ) {
    return "circuit";
  }

  if (
    /\b(PROGRAMMING|COMPUTING|CS 12[123]|CS& 13[12]|CS& 14[15]|ENGR 250|TCSS 14[23]|CSE 12[23]|CSE 14[23]|CSS 14[23])\b/.test(
      normalized
    )
  ) {
    return "programming";
  }

  if (/\b(STAT|STATISTICS|Q SCI|QMETH)\b/.test(normalized)) {
    return "statistics";
  }

  if (
    /\b(CALCULUS|DIFFERENTIAL EQUATIONS|LINEAR ALGEBRA|MATRIX|MATH|AMATH|TMATH|STMATH)\b/.test(
      normalized
    )
  ) {
    return "math";
  }

  if (/\b(WRITING|ENGL|COMPOSITION|TECHNICAL WRITING)\b/.test(normalized)) {
    return "writing";
  }

  if (/\b(PHYS|PHYSICS)\b/.test(normalized)) {
    return "physics";
  }

  if (/\b(CHEM|CHEMISTRY)\b/.test(normalized)) {
    return "chemistry";
  }

  if (/\b(BIOL|BIOLOGY|BBIO|ANATOMY|PHYSIOLOGY|MICROBIOLOGY|NUTR)\b/.test(normalized)) {
    return "biology";
  }

  if (/\b(ECON|ECONOMICS)\b/.test(normalized)) {
    return "economics";
  }

  if (/\b(GIS|GEOGRAPHY|MAPPING|SPATIAL)\b/.test(normalized)) {
    return "gis";
  }

  if (
    /\b(CHINESE|JAPANESE|KOREAN|SPANISH|FRENCH|GERMAN|LATIN|GREEK|DANISH|FINNISH|NORWEGIAN|SWEDISH|ITALIAN|LANGUAGE)\b/.test(
      normalized
    )
  ) {
    return "language";
  }

  if (/\b(COMM|COMMUNICATION|MEDIA|JOURNALISM|FILM|CINEMA)\b/.test(normalized)) {
    return "communication";
  }

  if (/\b(DESIGN|ART|DRAWING|STUDIO|VISUAL)\b/.test(normalized)) {
    return "design";
  }

  return "general";
}

function buildBeforeEnrollmentFallbackNote(topic: ChecklistGuidanceTopic) {
  switch (topic) {
    case "programming":
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because stronger programming prep makes the first UW terms easier.";
    case "circuit":
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it gives a stronger circuit foundation for later UW engineering coursework.";
    case "math":
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way.";
    case "statistics":
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because later UW coursework still depends on statistics or data-method work either way.";
    case "writing":
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because stronger writing prep helps right away after transfer.";
    case "physics":
    case "chemistry":
    case "biology":
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because later UW coursework still depends on this science preparation either way.";
    case "economics":
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because the degree still uses this background either way.";
    case "gis":
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it gives a useful technical foundation before upper-division UW coursework.";
    case "language":
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it can reduce early UW language bottlenecks.";
    case "communication":
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it gives a stronger foundation before upper-division UW coursework.";
    case "design":
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it gives a stronger creative foundation before upper-division UW coursework.";
    default:
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment.";
  }
}

function buildStayAtGrcFallbackNote(topic: ChecklistGuidanceTopic) {
  switch (topic) {
    case "programming":
      return "Useful programming head start to finish at Green River if time and aid allow before transfer.";
    case "circuit":
      return "Useful circuit head start to finish at Green River if time and aid allow before transfer.";
    case "math":
      return "Useful extra math head start to finish at Green River if time and aid allow before transfer.";
    case "statistics":
      return "Useful statistics head start to finish at Green River if time and aid allow before transfer.";
    case "writing":
      return "Useful writing head start to finish at Green River if time and aid allow before transfer.";
    case "physics":
    case "chemistry":
    case "biology":
      return "Useful science head start to finish at Green River if time and aid allow before transfer.";
    case "economics":
      return "Useful economics head start to finish at Green River if time and aid allow before transfer.";
    case "gis":
      return "Useful GIS or mapping head start to finish at Green River if time and aid allow before transfer.";
    case "language":
      return "Useful language head start to finish at Green River if time and aid allow before transfer.";
    case "communication":
      return "Useful communication or media head start to finish at Green River if time and aid allow before transfer.";
    case "design":
      return "Useful design head start to finish at Green River if time and aid allow before transfer.";
    default:
      return "Useful Green River head start if time and aid allow before transfer.";
  }
}

function buildChecklistGuidanceSummary(
  bucket: RequirementPriorityBucket,
  item: TransferPlannerChecklistItem
) {
  const explicitNote = String(item.note ?? "").trim();
  if (explicitNote) {
    return explicitNote;
  }

  const topic = detectChecklistGuidanceTopic(item);

  if (bucket === "beforeEnrollment") {
    return buildBeforeEnrollmentFallbackNote(topic);
  }

  if (bucket === "stayAtGrc") {
    return buildStayAtGrcFallbackNote(topic);
  }

  return null;
}

function getChecklistChoiceLabels(item: TransferPlannerChecklistItem) {
  return unique(
    [item.grcCourses, ...(item.alternatives ?? [])]
      .flat()
      .map((label) => String(label ?? "").trim())
      .filter(Boolean)
  );
}

function buildChecklistChoiceLabel(
  item: TransferPlannerChecklistItem,
  remainingNeeded: number,
  matchedCount: number
) {
  const chooseLabel = `choose ${remainingNeeded}${matchedCount > 0 ? " more" : ""} from this list`;
  return `${item.title} - ${chooseLabel}`;
}

function buildChecklistChoiceGuidanceSummary(
  item: TransferPlannerChecklistItem,
  remainingNeeded: number,
  matchedCount: number,
  baseGuidanceSummary: string | null
) {
  const choiceLabels = getChecklistChoiceLabels(item);
  const previewLabels = choiceLabels.slice(0, CHECKLIST_CHOICE_PREVIEW_LIMIT);
  const hiddenCount = Math.max(choiceLabels.length - previewLabels.length, 0);
  const chooseLabel = `Choose ${remainingNeeded}${matchedCount > 0 ? " more" : ""} from this list`;
  const choicesSummary = previewLabels.length
    ? `${chooseLabel}: ${previewLabels.join(", ")}${hiddenCount > 0 ? `, plus ${hiddenCount} more` : ""}.`
    : `${chooseLabel}.`;

  return baseGuidanceSummary ? `${choicesSummary} ${baseGuidanceSummary}` : choicesSummary;
}

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

function buildQuarterSlots(referenceDate = new Date()) {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  const fallYear = month >= 8 ? year + 1 : year;
  return [
    buildPlanningQuarterSlot("Fall", fallYear),
    buildPlanningQuarterSlot("Winter", fallYear + 1),
    buildPlanningQuarterSlot("Spring", fallYear + 1),
  ];
}

function buildQuarterSlotsAfterCurrent(referenceDate = new Date()) {
  const slots: PlanningQuarterSlot[] = [];
  let slot = getCurrentOrNextQuarterSlot(referenceDate);

  while (slots.length < 3) {
    slot = getNextPlannedQuarterSlot(slot);
    slots.push(slot);
  }

  return slots;
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
        availabilitySummary: getTransferPlannerGrcCourseAvailabilitySummary(course.label),
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

function getAvailabilityQuarterForPlanningKind(kind: PlanningQuarterKind) {
  switch (kind) {
    case "Winter":
      return "winter" as const;
    case "Spring":
      return "spring" as const;
    case "Summer":
      return "summer" as const;
    case "Fall":
      return "fall" as const;
  }
}

function getCourseAvailabilityMatch(
  label: string,
  preferredQuarterKind: PlanningQuarterKind | null | undefined
) {
  if (!preferredQuarterKind) return null;

  const latestPublishedQuarters = getTransferPlannerGrcCourseLatestPublishedQuarters(label);
  if (!latestPublishedQuarters) return null;
  if (!latestPublishedQuarters.length) return null;

  return latestPublishedQuarters.includes(getAvailabilityQuarterForPlanningKind(preferredQuarterKind));
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

function buildPlannerChainPrerequisiteMap(
  plan: TransferPlannerMajorPlan | null | undefined,
  actionableCourseCodes: Set<string>
) {
  const prerequisiteMap = new Map<string, string[][]>();
  if (!plan) return prerequisiteMap;

  for (const chain of getTransferPlannerChainsForPlan(plan)) {
    if (!QUARTER_ORDER_ENFORCED_CHAIN_IDS.has(chain.id)) {
      continue;
    }

    const segments = chain.rule
      .split(/\s*->\s*/i)
      .map((segment) => unique(extractCourseCodes(segment)))
      .filter((segment) => segment.length > 0);

    for (let index = 1; index < segments.length; index += 1) {
      const previousSegment = segments[index - 1].filter((courseCode) =>
        actionableCourseCodes.has(courseCode)
      );
      const currentSegment = segments[index];

      if (!previousSegment.length || !currentSegment.length) continue;

      for (const courseCode of currentSegment) {
        const existing = prerequisiteMap.get(courseCode) ?? [];
        const alreadyRecorded = existing.some(
          (group) =>
            group.length === previousSegment.length &&
            group.every((code, groupIndex) => code === previousSegment[groupIndex])
        );

        if (!alreadyRecorded) {
          prerequisiteMap.set(courseCode, [...existing, [...previousSegment]]);
        }
      }
    }
  }

  return prerequisiteMap;
}

function courseHasSatisfiedPrerequisites(
  course: PendingSuggestedCourse,
  completedCourseCodes: Set<string>
) {
  if (!course.prerequisiteCourseSets.length) {
    return true;
  }

  return course.prerequisiteCourseSets.every((courseSet) =>
    courseSet.some((courseCode) => completedCourseCodes.has(courseCode))
  );
}

function buildSeedCoursesForQuarter(
  seedCourses: PendingSuggestedCourse[] | undefined,
  completedCourseCodes: Set<string>
) {
  if (!seedCourses?.length) return [];

  const filtered: PendingSuggestedCourse[] = [];
  const selectedSequenceGroups = new Set<string>();

  for (const course of seedCourses) {
    if (
      course.sequenceGroup &&
      selectedSequenceGroups.has(course.sequenceGroup)
    ) {
      continue;
    }

    if (!courseHasSatisfiedPrerequisites(course, completedCourseCodes)) {
      continue;
    }

    filtered.push(course);
    if (course.sequenceGroup) {
      selectedSequenceGroups.add(course.sequenceGroup);
    }
  }

  return filtered;
}

function takeNextEligibleCourse(
  pool: PendingSuggestedCourse[],
  selectedCourses: PendingSuggestedCourse[],
  completedCourseCodes: Set<string>,
  preferredQuarterKind?: PlanningQuarterKind | null
) {
  const selectedSequenceGroups = new Set(
    selectedCourses
      .map((course) => course.sequenceGroup)
      .filter((group): group is string => !!group)
  );

  const eligibleIndices = pool
    .map((course, index) => ({ course, index }))
    .filter(({ course }) => {
      if (course.sequenceGroup && selectedSequenceGroups.has(course.sequenceGroup)) return false;
      return courseHasSatisfiedPrerequisites(course, completedCourseCodes);
    });

  const rankedEligibleIndices = [...eligibleIndices].sort((left, right) => {
    const leftAvailability = getCourseAvailabilityMatch(left.course.label, preferredQuarterKind);
    const rightAvailability = getCourseAvailabilityMatch(right.course.label, preferredQuarterKind);
    const leftUnavailable = leftAvailability === false;
    const rightUnavailable = rightAvailability === false;

    if (leftUnavailable !== rightUnavailable) {
      return Number(leftUnavailable) - Number(rightUnavailable);
    }

    const priorityDelta = left.course.priorityRank - right.course.priorityRank;
    if (priorityDelta !== 0) return priorityDelta;

    const leftAvailabilityRank = leftAvailability === true ? 0 : leftAvailability === null ? 1 : 2;
    const rightAvailabilityRank =
      rightAvailability === true ? 0 : rightAvailability === null ? 1 : 2;
    if (leftAvailabilityRank !== rightAvailabilityRank) {
      return leftAvailabilityRank - rightAvailabilityRank;
    }

    const sourceOrderDelta = left.course.sourceOrder - right.course.sourceOrder;
    if (sourceOrderDelta !== 0) return sourceOrderDelta;

    return left.index - right.index;
  });

  const nextMatch = rankedEligibleIndices[0] ?? null;
  if (!nextMatch) {
    return null;
  }

  if (
    preferredQuarterKind &&
    getCourseAvailabilityMatch(nextMatch.course.label, preferredQuarterKind) === false
  ) {
    return null;
  }

  const [course] = pool.splice(nextMatch.index, 1);
  return course ?? null;
}

function takeNextEligibleCourseFromPools(
  pools: PendingSuggestedCourse[][],
  selectedCourses: PendingSuggestedCourse[],
  completedCourseCodes: Set<string>,
  preferredQuarterKind?: PlanningQuarterKind | null
) {
  for (const pool of pools) {
    const nextCourse = takeNextEligibleCourse(
      pool,
      selectedCourses,
      completedCourseCodes,
      preferredQuarterKind
    );
    if (nextCourse) {
      return nextCourse;
    }
  }

  return null;
}

function allocateQuarterCourses({
  seedCourses,
  essentialCorePool,
  essentialElectivePool,
  optionalCorePool,
  optionalElectivePool,
  fillerPool,
  completedCourseCodes,
  preferredQuarterKind,
}: {
  seedCourses?: PendingSuggestedCourse[];
  essentialCorePool: PendingSuggestedCourse[];
  essentialElectivePool: PendingSuggestedCourse[];
  optionalCorePool: PendingSuggestedCourse[];
  optionalElectivePool: PendingSuggestedCourse[];
  fillerPool: PendingSuggestedCourse[];
  completedCourseCodes: Set<string>;
  preferredQuarterKind?: PlanningQuarterKind | null;
}) {
  const courses = [...buildSeedCoursesForQuarter(seedCourses, completedCourseCodes)];

  if (courses.length >= 3) {
    return courses.map<SuggestedQuarterCourse>(({ label, type, status, guidanceSummary }) => ({
      label,
      type,
      status,
      guidanceSummary,
      availabilitySummary: getTransferPlannerGrcCourseAvailabilitySummary(label),
    }));
  }

  const hasCoreCourse = courses.some((course) => course.type === "core");

  if (!hasCoreCourse && essentialCorePool.length) {
    const nextCore = takeNextEligibleCourse(
      essentialCorePool,
      courses,
      completedCourseCodes,
      preferredQuarterKind
    );
    if (nextCore) {
      courses.push(nextCore);
    }
  }

  while (courses.length < 3) {
    const nextEssential = takeNextEligibleCourseFromPools(
      [essentialCorePool, essentialElectivePool],
      courses,
      completedCourseCodes,
      preferredQuarterKind
    );
    if (!nextEssential) break;
    courses.push(nextEssential);
  }

  while (courses.length < 3 && fillerPool.length) {
    const nextFiller = takeNextEligibleCourse(
      fillerPool,
      courses,
      completedCourseCodes,
      preferredQuarterKind
    );
    if (!nextFiller) break;
    courses.push(nextFiller);
  }

  while (courses.length < 3) {
    const nextOptional = takeNextEligibleCourseFromPools(
      [optionalCorePool, optionalElectivePool],
      courses,
      completedCourseCodes,
      preferredQuarterKind
    );
    if (!nextOptional) break;
    courses.push(nextOptional);
  }

  return courses.map<SuggestedQuarterCourse>(({ label, type, status, guidanceSummary }) => ({
    label,
    type,
    status,
    guidanceSummary,
    availabilitySummary: getTransferPlannerGrcCourseAvailabilitySummary(label),
  }));
}

function buildRemainingSuggestedCourses(
  sections: {
    bucket: RequirementPriorityBucket;
    statuses: TransferRequirementStatus[];
  }[],
  prerequisiteCourseMap: Map<string, string[][]>
) {
  const remainingByLabel = new Map<string, PendingSuggestedCourse>();
  let sourceOrder = 0;

  for (const section of sections) {
    for (const status of section.statuses.filter((entry) => !entry.matched)) {
      const matchedCodes = new Set(status.matchedCourses.map((course) => course.code));
      const missingExplicitCodes = status.explicitCourseCodes.filter(
        (code) => !matchedCodes.has(code)
      );
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
      const shouldScheduleAsChoiceBucket =
        status.requiredCompletedCount > 0 &&
        status.requiredCompletedCount < status.explicitCourseCodes.length;
      const guidanceSummary = buildChecklistGuidanceSummary(section.bucket, status.item);

      const labelsForPlanner = shouldScheduleAsChoiceBucket
        ? [
            buildChecklistChoiceLabel(
              status.item,
              remainingNeeded,
              status.matchedCourses.length
            ),
          ]
        : labelsToSchedule;

      for (const label of labelsForPlanner) {
        const nextCourse: PendingSuggestedCourse = {
          label,
          type: isCoreCourseLabel(
            shouldScheduleAsChoiceBucket
              ? `${status.item.title} ${getChecklistChoiceLabels(status.item).join(" ")}`
              : label
          )
            ? "core"
            : "elective",
          status: "planned",
          guidanceSummary: shouldScheduleAsChoiceBucket
            ? buildChecklistChoiceGuidanceSummary(
                status.item,
                remainingNeeded,
                status.matchedCourses.length,
                guidanceSummary
              )
            : guidanceSummary,
          sequenceGroup: shouldSequenceCourses ? status.item.id : null,
          priorityRank: REQUIREMENT_PRIORITY_RANK[section.bucket],
          sourceOrder,
          explicitCourseCodes: shouldScheduleAsChoiceBucket ? [] : extractCourseCodes(label),
          prerequisiteCourseSets: unique(
            (shouldScheduleAsChoiceBucket ? [] : extractCourseCodes(label)).flatMap(
              (courseCode) => prerequisiteCourseMap.get(courseCode) ?? []
            )
          ).map((courseSet) => [...courseSet]),
        };

        sourceOrder += 1;

        const existing = remainingByLabel.get(label);
        if (
          existing &&
          (
            existing.priorityRank < nextCourse.priorityRank ||
            (
              existing.priorityRank === nextCourse.priorityRank &&
              existing.sourceOrder <= nextCourse.sourceOrder
            )
          )
        ) {
          continue;
        }

        remainingByLabel.set(label, nextCourse);
      }
    }
  }

  return [...remainingByLabel.values()].sort((left, right) => {
    const priorityDelta = left.priorityRank - right.priorityRank;
    if (priorityDelta !== 0) return priorityDelta;

    const sourceOrderDelta = left.sourceOrder - right.sourceOrder;
    if (sourceOrderDelta !== 0) return sourceOrderDelta;

    return left.label.localeCompare(right.label);
  });
}

export function buildSuggestedQuarterPlan(input: {
  plan?: TransferPlannerMajorPlan | null;
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
  const actionableCourseCodes = new Set(
    [
      ...input.applicationStatuses,
      ...input.beforeEnrollmentStatuses,
      ...input.stayAtGrcStatuses,
    ].flatMap((status) => status.explicitCourseCodes)
  );
  const prerequisiteCourseMap = buildPlannerChainPrerequisiteMap(
    input.plan,
    actionableCourseCodes
  );
  const completedCourseCodes = new Set(input.completedCourses.map((course) => course.code));

  const essentialRemainingCourses = buildRemainingSuggestedCourses([
    {
      bucket: "application",
      statuses: input.applicationStatuses,
    },
    {
      bucket: "beforeEnrollment",
      statuses: input.beforeEnrollmentStatuses,
    },
  ], prerequisiteCourseMap);
  const stayAtGrcRemainingCourses = buildRemainingSuggestedCourses([
    {
      bucket: "stayAtGrc",
      statuses: input.stayAtGrcStatuses,
    },
  ], prerequisiteCourseMap);
  const remainingCourses =
    input.includeStayAtGrcCourses === false
      ? essentialRemainingCourses.length
        ? essentialRemainingCourses
        : stayAtGrcRemainingCourses
      : buildRemainingSuggestedCourses([
          {
            bucket: "application",
            statuses: input.applicationStatuses,
          },
          {
            bucket: "beforeEnrollment",
            statuses: input.beforeEnrollmentStatuses,
          },
          {
            bucket: "stayAtGrc",
            statuses: input.stayAtGrcStatuses,
          },
        ], prerequisiteCourseMap);
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

  const essentialCorePool = coursesStillToPlan
    .filter((course) => isCoreCourseLabel(course.label))
    .filter((course) => course.priorityRank < REQUIREMENT_PRIORITY_RANK.stayAtGrc)
    .map<PendingSuggestedCourse>((course) => ({
      ...course,
      type: "core",
      status: "planned",
    }));
  const essentialElectivePool = coursesStillToPlan
    .filter((course) => !isCoreCourseLabel(course.label))
    .filter((course) => course.priorityRank < REQUIREMENT_PRIORITY_RANK.stayAtGrc)
    .map<PendingSuggestedCourse>((course) => ({
      ...course,
      type: "elective",
      status: "planned",
    }));
  const optionalCorePool = coursesStillToPlan
    .filter((course) => isCoreCourseLabel(course.label))
    .filter((course) => course.priorityRank >= REQUIREMENT_PRIORITY_RANK.stayAtGrc)
    .map<PendingSuggestedCourse>((course) => ({
      ...course,
      type: "core",
      status: "planned",
    }));
  const optionalElectivePool = coursesStillToPlan
    .filter((course) => !isCoreCourseLabel(course.label))
    .filter((course) => course.priorityRank >= REQUIREMENT_PRIORITY_RANK.stayAtGrc)
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
      guidanceSummary: null,
      sequenceGroup: null,
      priorityRank: REQUIREMENT_PRIORITY_RANK.stayAtGrc + 1,
      sourceOrder: Number.MAX_SAFE_INTEGER,
      explicitCourseCodes: [],
      prerequisiteCourseSets: [],
    })
  );
  const currentQuarterPlan = currentQuarterCourses.length
    ? {
        label: currentQuarterSlot?.label ?? "Current / In progress",
        phase: "current" as const,
        courses: allocateQuarterCourses({
          seedCourses: currentQuarterCourses,
          essentialCorePool,
          essentialElectivePool,
          optionalCorePool,
          optionalElectivePool,
          fillerPool,
          completedCourseCodes,
          preferredQuarterKind: currentQuarterSlot?.kind ?? null,
        }),
      }
    : null;

  const futureQuarterPlans: SuggestedQuarterPlan[] = [];
  if (coursesStillToPlan.length || (!completedQuarterPlans.length && !currentQuarterCourses.length)) {
    const futureQuarterSlots = currentQuarterSlot
      ? buildQuarterSlotsAfterCurrent(input.referenceDate)
      : buildQuarterSlots(input.referenceDate);

    for (const slot of futureQuarterSlots) {
      const courses = allocateQuarterCourses({
        essentialCorePool,
        essentialElectivePool,
        optionalCorePool,
        optionalElectivePool,
        fillerPool,
        completedCourseCodes,
        preferredQuarterKind: slot.kind,
      });

      futureQuarterPlans.push({
        label: slot.label,
        phase: "planned",
        courses,
      });

      for (const course of courses) {
        for (const courseCode of extractCourseCodes(course.label)) {
          completedCourseCodes.add(courseCode);
        }
      }
    }
  }

  return [
    ...completedQuarterPlans,
    ...(currentQuarterPlan ? [currentQuarterPlan] : []),
    ...futureQuarterPlans,
  ];
}
