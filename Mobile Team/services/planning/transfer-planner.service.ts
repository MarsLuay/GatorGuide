import {
  getTransferPlannerCanonicalCourse,
  getTransferPlannerGrcCourseAvailabilitySummary,
  getTransferPlannerGrcCourseLatestPublishedQuarters,
  getTransferPlannerChainsForPlan,
  getTransferPlannerEquivalencyRulesForSourceCourse,
  TRANSFER_PLANNER_SOURCE_GAP_REGISTRY,
  TransferPlannerChecklistItem,
  TransferPlannerEquivalencyRule,
  TransferPlannerMajorPlan,
  TransferPlannerStudentCourseEvaluation,
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
  catalogYearLabel?: string | null;
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

export type HistoricalGrcTrackComparison = {
  trackId: string;
  trackCode: string;
  currentCatalogYearLabel: string;
  inferredCatalogYearLabel: string | null;
  selectedCatalogYearLabel: string | null;
  selectedCatalogYearSource: "transcript" | "current-default" | "unavailable";
  usesCurrentRecommendedPath: boolean;
  isHistoricalCatalogYear: boolean;
  terms: TransferPlannerTrack["terms"];
  trackCourseCodes: string[];
  currentRecommendedCourseCodes: string[];
  catalogYearCourseCodes: string[];
  legacyCatalogCourseCodes: string[];
  currentOnlyCourseCodes: string[];
  currentUwRequiredGrcCourseCodes: string[];
  legacyCourseCodesStillUsedByCurrentUwPlan: string[];
  sourceBackedLegacyCourseCodes: string[];
  unsupportedLegacyCourseCodes: string[];
  notes: string[];
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

export type TransferPlannerStudentEvaluationReportBucket = {
  id: TransferPlannerStudentCourseEvaluation["outcome"];
  label: string;
  description: string;
  courseCodes: string[];
  count: number;
};

export type TransferPlannerStudentEvaluationReport = {
  planId: string | null;
  pathwayId: string | null;
  majorTitle: string;
  campusLabel: string;
  completedCourseCount: number;
  studentFacingEvaluationCount: number;
  hiddenEvaluationCount: number;
  buckets: TransferPlannerStudentEvaluationReportBucket[];
  officialRuleIds: string[];
  sourceLinkCount: number;
  warningCourseCodes: string[];
  missingSequenceCourseCodes: string[];
  nextPlannedCourseLabels: string[];
  reportSummaryLines: string[];
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
  corequisiteCourseSets: string[][];
};

export type TransferPlannerCoursePlanningGraph = {
  prerequisiteCourseSetsByCourseCode: Record<string, string[][]>;
  corequisiteCourseSetsByCourseCode: Record<string, string[][]>;
  sourceCounts: {
    metadataPrerequisiteCourseCount: number;
    metadataCorequisiteCourseCount: number;
    chainPrerequisiteCourseCount: number;
  };
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

function sortCourseCodes(codes: string[]) {
  return unique(codes).sort((left, right) => left.localeCompare(right));
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

function parseCatalogYearStart(label: string | null | undefined) {
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

function getChecklistRequirementCourseCodes(plan: TransferPlannerMajorPlan | null | undefined) {
  if (!plan) return [];

  return sortCourseCodes(
    [
      ...plan.applicationChecklist,
      ...plan.beforeEnrollmentChecklist,
      ...plan.stayAtGrcChecklist,
    ].flatMap((item) =>
      getChecklistCourseOptions(item).flatMap((courseLabels) =>
        courseLabels.flatMap((label) => extractCourseCodes(label))
      )
    )
  );
}

function getTrackTermCourseCodes(terms: TransferPlannerTrack["terms"]) {
  return sortCourseCodes(terms.flatMap((term) => term.courses.flatMap((label) => extractCourseCodes(label))));
}

function getGuideTermForCatalogYear(catalogYearLabel: string | null | undefined) {
  const startYear = parseCatalogYearStart(catalogYearLabel);
  if (startYear === null) return null;
  return `SPR Qtr. ${startYear + 1}`;
}

function courseHasCatalogYearSupport(courseCode: string, catalogYearLabel: string | null) {
  if (!catalogYearLabel) return false;

  const course = getTransferPlannerCanonicalCourse("grc", courseCode);
  if (!course) return false;

  return course.effectiveYearRanges.some((range) => {
    if (range.startLabel === catalogYearLabel || range.endLabel === catalogYearLabel) return true;
    const startYear = parseCatalogYearStart(range.startLabel);
    const endYear = parseCatalogYearStart(range.endLabel);
    const catalogYear = parseCatalogYearStart(catalogYearLabel);
    if (startYear === null || catalogYear === null) return false;
    if (endYear === null) return catalogYear >= startYear;
    return catalogYear >= startYear && catalogYear <= endYear;
  });
}

function courseHasEffectiveEquivalencySupport(courseCode: string, catalogYearLabel: string | null) {
  const guideTerm = getGuideTermForCatalogYear(catalogYearLabel);
  if (!guideTerm) return false;
  return getTransferPlannerEquivalencyRulesForSourceCourse(courseCode, guideTerm).length > 0;
}

export function buildHistoricalGrcTrackComparison(input: {
  track: TransferPlannerTrack | null;
  plan?: TransferPlannerMajorPlan | null;
  completedCourses: TranscriptCourseEntry[];
  referenceDate?: Date;
}): HistoricalGrcTrackComparison | null {
  const { track } = input;
  if (!track) return null;

  const currentCatalogYearLabel = getCurrentTransferPlannerGrcCatalogYearLabel(input.referenceDate);
  const inferredCatalogYearLabel = inferTransferPlannerGrcCatalogYearLabel(input.completedCourses);
  const selectedCatalogYear =
    inferredCatalogYearLabel
      ? track.catalogYears?.find((entry) => entry.label === inferredCatalogYearLabel) ?? null
      : null;
  const latestCatalogYear =
    [...(track.catalogYears ?? [])].sort(
      (left, right) =>
        (parseCatalogYearStart(right.label) ?? 0) - (parseCatalogYearStart(left.label) ?? 0)
    )[0] ?? null;
  const currentRecommendedCourseCodes = getTrackTermCourseCodes(track.terms);
  const selectedTerms = selectedCatalogYear?.terms ?? track.terms;
  const catalogYearCourseCodes = selectedCatalogYear
    ? getTrackTermCourseCodes(selectedCatalogYear.terms)
    : [];
  const trackCourseCodes = getTrackTermCourseCodes(selectedTerms);
  const legacyCatalogCourseCodes = selectedCatalogYear
    ? sortCourseCodes(catalogYearCourseCodes.filter((code) => !currentRecommendedCourseCodes.includes(code)))
    : [];
  const currentOnlyCourseCodes = selectedCatalogYear
    ? sortCourseCodes(currentRecommendedCourseCodes.filter((code) => !catalogYearCourseCodes.includes(code)))
    : [];
  const currentUwRequiredGrcCourseCodes = getChecklistRequirementCourseCodes(input.plan);
  const legacyCourseCodesStillUsedByCurrentUwPlan = legacyCatalogCourseCodes.filter((code) =>
    currentUwRequiredGrcCourseCodes.includes(code)
  );
  const sourceBackedLegacyCourseCodes = legacyCatalogCourseCodes.filter(
    (code) =>
      courseHasCatalogYearSupport(code, selectedCatalogYear?.label ?? null) ||
      courseHasEffectiveEquivalencySupport(code, selectedCatalogYear?.label ?? null)
  );
  const unsupportedLegacyCourseCodes = legacyCatalogCourseCodes.filter(
    (code) => !sourceBackedLegacyCourseCodes.includes(code)
  );
  const usesCurrentRecommendedPath = !selectedCatalogYear;
  const isHistoricalCatalogYear = Boolean(
    selectedCatalogYear &&
      inferredCatalogYearLabel &&
      parseCatalogYearStart(inferredCatalogYearLabel) !== parseCatalogYearStart(currentCatalogYearLabel)
  );

  return {
    trackId: track.id,
    trackCode: track.code,
    currentCatalogYearLabel,
    inferredCatalogYearLabel,
    selectedCatalogYearLabel: selectedCatalogYear?.label ?? (usesCurrentRecommendedPath ? null : latestCatalogYear?.label ?? null),
    selectedCatalogYearSource: selectedCatalogYear
      ? "transcript"
      : inferredCatalogYearLabel
        ? "unavailable"
        : "current-default",
    usesCurrentRecommendedPath,
    isHistoricalCatalogYear,
    terms: selectedTerms,
    trackCourseCodes,
    currentRecommendedCourseCodes,
    catalogYearCourseCodes,
    legacyCatalogCourseCodes,
    currentOnlyCourseCodes,
    currentUwRequiredGrcCourseCodes,
    legacyCourseCodesStillUsedByCurrentUwPlan,
    sourceBackedLegacyCourseCodes,
    unsupportedLegacyCourseCodes,
    notes: [
      selectedCatalogYear
        ? `Using ${track.code} ${selectedCatalogYear.label} catalog-year terms inferred from transcript history.`
        : inferredCatalogYearLabel
          ? `Transcript history points to ${inferredCatalogYearLabel}, but ${track.code} has no source-backed catalog-year snapshot for that year, so the planner keeps the current recommended path.`
          : `No transcript catalog year was detected, so the planner keeps the current recommended ${track.code} path for new planning.`,
      ...(selectedCatalogYear?.notes ?? []),
    ],
  };
}

function getResolvedTrackTermsForPlanning(
  track: TransferPlannerTrack | null,
  completedCourses: TranscriptCourseEntry[],
  referenceDate?: Date
) {
  return buildHistoricalGrcTrackComparison({ track, completedCourses, referenceDate })?.terms ?? [];
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

export type BuildTransferPlannerStudentCourseEvaluationsInput = {
  plan?: TransferPlannerMajorPlan | null;
  planId?: string | null;
  pathwayId?: string | null;
  completedCourses: TranscriptCourseEntry[];
  requirementStatuses?: TransferRequirementStatus[];
  applicationStatuses?: TransferRequirementStatus[];
  beforeEnrollmentStatuses?: TransferRequirementStatus[];
  stayAtGrcStatuses?: TransferRequirementStatus[];
  effectiveTermLabel?: string | null;
};

type EvaluationRuleCandidate = {
  rule: TransferPlannerEquivalencyRule;
  sourceCourseSet: string[];
  missingSourceCourseCodes: string[];
};

function getEvaluationPathwayId(input: BuildTransferPlannerStudentCourseEvaluationsInput) {
  return (
    input.pathwayId ??
    (input.plan as { selectedPathwayId?: string | null } | null | undefined)?.selectedPathwayId ??
    null
  );
}

function getEvaluationRequirementStatuses(
  input: BuildTransferPlannerStudentCourseEvaluationsInput
) {
  if (input.requirementStatuses) {
    return input.requirementStatuses;
  }

  const explicitStatuses = [
    ...(input.applicationStatuses ?? []),
    ...(input.beforeEnrollmentStatuses ?? []),
    ...(input.stayAtGrcStatuses ?? []),
  ];
  if (explicitStatuses.length) {
    return explicitStatuses;
  }

  if (!input.plan) {
    return [];
  }

  return [
    ...buildRequirementStatuses(input.plan.applicationChecklist, input.completedCourses),
    ...buildRequirementStatuses(input.plan.beforeEnrollmentChecklist, input.completedCourses),
    ...buildRequirementStatuses(input.plan.stayAtGrcChecklist, input.completedCourses),
  ];
}

function findHiddenSourceGap(planId: string | null, pathwayId: string | null) {
  if (!planId) return null;

  return (
    TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.find(
      (entry) =>
        entry.planId === planId &&
        (pathwayId ? entry.pathwayId === pathwayId : entry.pathwayId === null)
    ) ?? null
  );
}

function getRequirementMissingCourseCodes(status: TransferRequirementStatus) {
  const matchedCodes = new Set(status.matchedCourses.map((course) => course.code));
  return status.explicitCourseCodes.filter((code) => !matchedCodes.has(code));
}

function getAppliedRequirementIds(
  statuses: TransferRequirementStatus[],
  courseCode: string
) {
  return statuses
    .filter((status) => status.matchedCourses.some((course) => course.code === courseCode))
    .map((status) => status.item.id);
}

function getIncompleteRequirementMissingCourseCodes(
  statuses: TransferRequirementStatus[],
  courseCode: string
) {
  return sortCourseCodes(
    statuses
      .filter(
        (status) =>
          !status.matched && status.matchedCourses.some((course) => course.code === courseCode)
      )
      .flatMap(getRequirementMissingCourseCodes)
  );
}

function getEvaluationEffectiveTermLabel(
  course: TranscriptCourseEntry,
  fallbackEffectiveTermLabel: string | null | undefined,
  fallbackCatalogYearLabel: string | null
) {
  if (fallbackEffectiveTermLabel) {
    return fallbackEffectiveTermLabel;
  }

  const courseCatalogYearLabel =
    course.catalogYearLabel ?? inferTransferPlannerGrcCatalogYearLabel([course]);
  return getGuideTermForCatalogYear(courseCatalogYearLabel ?? fallbackCatalogYearLabel);
}

function getEvaluationRuleCandidates(
  courseCode: string,
  completedCourseCodes: Set<string>,
  effectiveTermLabel: string | null
): EvaluationRuleCandidate[] {
  return getTransferPlannerEquivalencyRulesForSourceCourse(courseCode, effectiveTermLabel).flatMap(
    (rule) =>
      (rule.sourceCourseSets ?? [])
        .map((courseSet) => sortCourseCodes(courseSet.map(normalizeCourseCode)))
        .filter((courseSet) => courseSet.includes(courseCode))
        .map((sourceCourseSet) => ({
          rule,
          sourceCourseSet,
          missingSourceCourseCodes: sourceCourseSet.filter(
            (sourceCourseCode) => !completedCourseCodes.has(sourceCourseCode)
          ),
        }))
  );
}

function getRuleSourceKindRank(rule: TransferPlannerEquivalencyRule) {
  switch (rule.sourceKind) {
    case "uw-green-river-equivalency-guide":
      return 0;
    case "manual-planner-rule":
      return 1;
    case "chain-library":
      return 2;
    default:
      return 3;
  }
}

function getRuleStatusRank(rule: TransferPlannerEquivalencyRule) {
  if (rule.acceptanceCategory === "preferred") return 0;
  if (rule.ruleStatus === "active" || rule.acceptanceCategory === "accepted") return 1;
  if (rule.acceptanceCategory === "accepted-with-warning") return 2;
  if (rule.ruleStatus === "legacy" || rule.acceptanceCategory === "legacy-accepted") return 3;
  if (rule.type === "no-credit" || rule.acceptanceCategory === "no-credit") return 4;
  return 5;
}

function isReferenceOnlyCombinedEntryRule(rule: TransferPlannerEquivalencyRule) {
  const searchableText = [
    rule.title,
    rule.targetOutcome,
    ...rule.plannerWarnings,
    ...rule.notes,
  ].join(" ");

  return (
    rule.type === "sequence" &&
    (rule.targetCourseCodes?.length ?? 0) === 0 &&
    /combined[- ]entry|combined entries|see .*combined/i.test(searchableText)
  );
}

function compareEvaluationRuleCandidates(
  left: EvaluationRuleCandidate,
  right: EvaluationRuleCandidate
) {
  const referenceOnlyDelta =
    Number(isReferenceOnlyCombinedEntryRule(left.rule)) -
    Number(isReferenceOnlyCombinedEntryRule(right.rule));
  if (referenceOnlyDelta !== 0) return referenceOnlyDelta;

  const completionDelta =
    Number(left.missingSourceCourseCodes.length > 0) -
    Number(right.missingSourceCourseCodes.length > 0);
  if (completionDelta !== 0) return completionDelta;

  const sourceKindDelta = getRuleSourceKindRank(left.rule) - getRuleSourceKindRank(right.rule);
  if (sourceKindDelta !== 0) return sourceKindDelta;

  const sourceSetLengthDelta = right.sourceCourseSet.length - left.sourceCourseSet.length;
  if (sourceSetLengthDelta !== 0) return sourceSetLengthDelta;

  const statusDelta = getRuleStatusRank(left.rule) - getRuleStatusRank(right.rule);
  if (statusDelta !== 0) return statusDelta;

  return left.rule.id.localeCompare(right.rule.id);
}

function selectEvaluationRuleCandidate(candidates: EvaluationRuleCandidate[]) {
  return [...candidates].sort(compareEvaluationRuleCandidates)[0] ?? null;
}

function isElectiveCreditRule(rule: TransferPlannerEquivalencyRule) {
  return (
    rule.type === "elective-credit" ||
    rule.type === "limited-credit" ||
    /\b[A-Z][A-Z &]*\s+[1-4]XX\b/.test(rule.targetOutcome) ||
    rule.targetCourseCodes?.some((courseCode) => /\b[1-4]XX\b/.test(courseCode)) === true
  );
}

function getStudentEvaluationOutcome(input: {
  candidate: EvaluationRuleCandidate | null;
  missingSourceCourseCodes: string[];
  appliedRequirementIds: string[];
}) {
  const { candidate, missingSourceCourseCodes, appliedRequirementIds } = input;

  if (missingSourceCourseCodes.length > 0) {
    return "sequence-incomplete";
  }
  if (!candidate) {
    return "not-applicable-to-major";
  }
  if (candidate.rule.type === "no-credit" || candidate.rule.acceptanceCategory === "no-credit") {
    return "no-credit";
  }
  if (
    candidate.rule.ruleStatus === "legacy" ||
    candidate.rule.acceptanceCategory === "legacy-accepted"
  ) {
    return "legacy-rule-used";
  }
  if (isElectiveCreditRule(candidate.rule)) {
    return "elective-credit";
  }
  if (!appliedRequirementIds.length) {
    return "not-applicable-to-major";
  }

  return "auto-approved";
}

function makeStudentEvaluationId(
  planId: string | null,
  pathwayId: string | null,
  courseCode: string,
  index: number
) {
  const scope = [planId ?? "no-plan", pathwayId ?? "base", courseCode]
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `student-evaluation:${scope}:${index + 1}`;
}

export function buildTransferPlannerStudentCourseEvaluations(
  input: BuildTransferPlannerStudentCourseEvaluationsInput
): TransferPlannerStudentCourseEvaluation[] {
  const planId = input.plan?.id ?? input.planId ?? null;
  const pathwayId = getEvaluationPathwayId(input);
  const hiddenSourceGap = findHiddenSourceGap(planId, pathwayId);
  const completedCourses = input.completedCourses.map((course) => ({
    ...course,
    code: normalizeCourseCode(course.code),
  }));

  if (hiddenSourceGap) {
    return completedCourses.map((course, index) => ({
      id: makeStudentEvaluationId(planId, pathwayId, course.code, index),
      planId,
      pathwayId,
      courseCode: course.code,
      courseLabel: course.label,
      outcome: "source-unverified-hidden",
      studentFacing: false,
      appliedRequirementIds: [],
      approvedRuleId: null,
      alternativeApprovedRuleIds: [],
      ruleStatus: null,
      acceptanceCategory: null,
      targetOutcome: null,
      targetCourseCodes: [],
      sourceCourseSet: [],
      missingSourceCourseCodes: [],
      effectiveTermLabel: null,
      warnings: [],
      notes: [hiddenSourceGap.sourceGapReason],
      sourceLinks: hiddenSourceGap.suggestedPrimary
        ? [
            {
              label: hiddenSourceGap.suggestedPrimary.label ?? hiddenSourceGap.title,
              url: hiddenSourceGap.suggestedPrimary.url,
              note: "Internal source-gap candidate; hidden from student-facing evaluations until parser verification succeeds.",
            },
          ]
        : [],
    }));
  }

  const statuses = getEvaluationRequirementStatuses(input);
  const completedCourseCodes = new Set(completedCourses.map((course) => course.code));
  const fallbackCatalogYearLabel = inferTransferPlannerGrcCatalogYearLabel(completedCourses);

  return completedCourses.map((course, index) => {
    const effectiveTermLabel = getEvaluationEffectiveTermLabel(
      course,
      input.effectiveTermLabel,
      fallbackCatalogYearLabel
    );
    const candidates = getEvaluationRuleCandidates(
      course.code,
      completedCourseCodes,
      effectiveTermLabel
    );
    const candidate = selectEvaluationRuleCandidate(candidates);
    const appliedRequirementIds = getAppliedRequirementIds(statuses, course.code);
    const missingSourceCourseCodes = sortCourseCodes([
      ...(candidate?.missingSourceCourseCodes ?? []),
      ...getIncompleteRequirementMissingCourseCodes(statuses, course.code),
    ]);
    const outcome = getStudentEvaluationOutcome({
      candidate,
      missingSourceCourseCodes,
      appliedRequirementIds,
    });

    return {
      id: makeStudentEvaluationId(planId, pathwayId, course.code, index),
      planId,
      pathwayId,
      courseCode: course.code,
      courseLabel: course.label,
      outcome,
      studentFacing: true,
      appliedRequirementIds,
      approvedRuleId: candidate?.rule.id ?? null,
      alternativeApprovedRuleIds: candidates
        .map((entry) => entry.rule.id)
        .filter((ruleId) => ruleId !== candidate?.rule.id),
      ruleStatus: candidate?.rule.ruleStatus ?? null,
      acceptanceCategory: candidate?.rule.acceptanceCategory ?? null,
      targetOutcome: candidate?.rule.targetOutcome ?? null,
      targetCourseCodes: [...(candidate?.rule.targetCourseCodes ?? [])],
      sourceCourseSet: [...(candidate?.sourceCourseSet ?? [])],
      missingSourceCourseCodes,
      effectiveTermLabel,
      warnings: [...(candidate?.rule.plannerWarnings ?? [])],
      notes: [...(candidate?.rule.notes ?? [])],
      sourceLinks: [...(candidate?.rule.sourceLinks ?? [])],
    };
  });
}

const STUDENT_EVALUATION_REPORT_BUCKETS: Array<{
  id: TransferPlannerStudentCourseEvaluation["outcome"];
  label: string;
  description: string;
}> = [
  {
    id: "auto-approved",
    label: "Completed and applies",
    description: "Completed classes that match this UW plan through an approved source-backed rule.",
  },
  {
    id: "legacy-rule-used",
    label: "Applies with legacy warning",
    description: "Completed classes that use an older or legacy accepted source rule.",
  },
  {
    id: "elective-credit",
    label: "Completed as elective credit",
    description: "Completed classes that transfer, but not as a direct requirement for this major.",
  },
  {
    id: "sequence-incomplete",
    label: "Sequence incomplete",
    description: "Completed classes that need one or more paired GRC classes for the strongest UW outcome.",
  },
  {
    id: "no-credit",
    label: "No UW credit",
    description: "Completed classes that the official guide marks as no credit.",
  },
  {
    id: "not-applicable-to-major",
    label: "Not used for this major",
    description: "Completed classes with a source-backed transfer rule that do not apply to this selected major.",
  },
];

export function buildTransferPlannerStudentEvaluationReport(input: {
  plan?: TransferPlannerMajorPlan | null;
  planId?: string | null;
  pathwayId?: string | null;
  campusLabel: string;
  completedCourses: TranscriptCourseEntry[];
  evaluations: TransferPlannerStudentCourseEvaluation[];
  suggestedQuarterPlan?: SuggestedQuarterPlan[];
}): TransferPlannerStudentEvaluationReport {
  const planId = input.plan?.id ?? input.planId ?? null;
  const pathwayId =
    input.pathwayId ??
    (input.plan as { selectedPathwayId?: string | null } | null | undefined)?.selectedPathwayId ??
    null;
  const selectedPathwayLabel =
    (input.plan as { selectedPathwayLabel?: string | null } | null | undefined)
      ?.selectedPathwayLabel ?? null;
  const majorTitle = selectedPathwayLabel
    ? `${input.plan?.title ?? "Selected major"} (${selectedPathwayLabel})`
    : input.plan?.title ?? "Selected major";
  const studentFacingEvaluations = input.evaluations.filter((entry) => entry.studentFacing);
  const hiddenEvaluationCount = input.evaluations.length - studentFacingEvaluations.length;
  const officialRuleIds = unique(
    studentFacingEvaluations.flatMap((entry) => [
      entry.approvedRuleId,
      ...entry.alternativeApprovedRuleIds,
    ]).filter((ruleId): ruleId is string => Boolean(ruleId))
  ).sort((left, right) => left.localeCompare(right));
  const sourceLinkCount = unique(
    studentFacingEvaluations.flatMap((entry) => entry.sourceLinks.map((link) => link.url))
  ).length;
  const warningCourseCodes = sortCourseCodes(
    studentFacingEvaluations
      .filter((entry) => entry.warnings.length > 0 || entry.outcome === "legacy-rule-used")
      .map((entry) => entry.courseCode)
  );
  const missingSequenceCourseCodes = sortCourseCodes(
    studentFacingEvaluations.flatMap((entry) => entry.missingSourceCourseCodes)
  );
  const nextPlannedCourseLabels = unique(
    (input.suggestedQuarterPlan ?? [])
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses.map((course) => course.label))
  );
  const buckets = STUDENT_EVALUATION_REPORT_BUCKETS.map((bucket) => {
    const bucketEvaluations = studentFacingEvaluations.filter(
      (entry) => entry.outcome === bucket.id
    );
    return {
      ...bucket,
      courseCodes: sortCourseCodes(bucketEvaluations.map((entry) => entry.courseCode)),
      count: bucketEvaluations.length,
    };
  });

  return {
    planId,
    pathwayId,
    majorTitle,
    campusLabel: input.campusLabel,
    completedCourseCount: input.completedCourses.length,
    studentFacingEvaluationCount: studentFacingEvaluations.length,
    hiddenEvaluationCount,
    buckets,
    officialRuleIds,
    sourceLinkCount,
    warningCourseCodes,
    missingSequenceCourseCodes,
    nextPlannedCourseLabels,
    reportSummaryLines: [
      `${studentFacingEvaluations.length} completed transcript course(s) evaluated for ${majorTitle}.`,
      `${officialRuleIds.length} approved source rule(s) referenced by the evaluation.`,
      missingSequenceCourseCodes.length
        ? `Missing sequence course(s): ${missingSequenceCourseCodes.join(", ")}.`
        : "No incomplete transfer sequences were detected.",
      warningCourseCodes.length
        ? `Warning course(s): ${warningCourseCodes.join(", ")}.`
        : "No legacy or warning-course evaluations were detected.",
    ],
  };
}

export function buildTrackUsageSummary(
  track: TransferPlannerTrack | null,
  plan: TransferPlannerMajorPlan,
  completedCourses: TranscriptCourseEntry[] = []
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

  for (const term of getResolvedTrackTermsForPlanning(track, completedCourses)) {
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

function buildGeneralEducationPlaceholders(
  track: TransferPlannerTrack | null,
  completedCourses: TranscriptCourseEntry[],
  referenceDate?: Date
) {
  if (!track) return ["5 credits of Humanities", "5 credits of Social Science"];

  const mapped = unique(
    getResolvedTrackTermsForPlanning(track, completedCourses, referenceDate)
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

function normalizeCourseRequirementPath(courseCodes: string[]) {
  return sortCourseCodes(courseCodes.map((code) => normalizeCourseCode(code)).filter(Boolean));
}

function addCourseRequirementPath(
  requirementMap: Map<string, string[][]>,
  courseCode: string,
  coursePath: string[]
) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const normalizedPath = normalizeCourseRequirementPath(coursePath).filter(
    (code) => code !== normalizedCourseCode
  );
  if (!normalizedPath.length) return;

  const existingPaths = requirementMap.get(normalizedCourseCode) ?? [];
  const pathKey = normalizedPath.join("|");
  const alreadyRecorded = existingPaths.some((path) => path.join("|") === pathKey);
  if (alreadyRecorded) return;

  requirementMap.set(normalizedCourseCode, [...existingPaths, normalizedPath]);
}

function buildCourseMetadataRequirementPaths(
  requiredCourseCodes: string[],
  alternativeCourseCodeSets: string[][],
  actionableCourseCodes: Set<string>
) {
  const requiredCodes = normalizeCourseRequirementPath(requiredCourseCodes);
  const alternativePaths = alternativeCourseCodeSets
    .map((courseSet) => normalizeCourseRequirementPath(courseSet))
    .filter((courseSet) => courseSet.length > 0);
  const candidatePaths = alternativePaths.length
    ? alternativePaths.map((courseSet) => normalizeCourseRequirementPath([...requiredCodes, ...courseSet]))
    : requiredCodes.length
      ? [requiredCodes]
      : [];

  return candidatePaths.filter((courseSet) =>
    courseSet.every((courseCode) => actionableCourseCodes.has(courseCode))
  );
}

function buildMetadataCourseRequirementMap(
  actionableCourseCodes: Set<string>,
  kind: "prerequisite" | "corequisite"
) {
  const requirementMap = new Map<string, string[][]>();

  for (const courseCode of actionableCourseCodes) {
    const course = getTransferPlannerCanonicalCourse("grc", courseCode);
    if (!course) continue;

    const requirementPaths =
      kind === "prerequisite"
        ? buildCourseMetadataRequirementPaths(
            course.prerequisiteCourseCodes,
            course.prerequisiteAlternativeCourseCodeSets,
            actionableCourseCodes
          )
        : buildCourseMetadataRequirementPaths(
            course.corequisiteCourseCodes,
            course.corequisiteAlternativeCourseCodeSets,
            actionableCourseCodes
          );

    for (const requirementPath of requirementPaths) {
      addCourseRequirementPath(requirementMap, courseCode, requirementPath);
    }
  }

  return requirementMap;
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
      const currentSegment = segments[index].filter((courseCode) =>
        actionableCourseCodes.has(courseCode)
      );

      if (!previousSegment.length || !currentSegment.length) continue;

      for (const courseCode of currentSegment) {
        for (const previousCourseCode of previousSegment) {
          addCourseRequirementPath(prerequisiteMap, courseCode, [previousCourseCode]);
        }
      }
    }
  }

  return prerequisiteMap;
}

function mergeCourseRequirementMaps(...maps: Map<string, string[][]>[]) {
  const merged = new Map<string, string[][]>();

  for (const map of maps) {
    for (const [courseCode, requirementPaths] of map.entries()) {
      for (const requirementPath of requirementPaths) {
        addCourseRequirementPath(merged, courseCode, requirementPath);
      }
    }
  }

  return merged;
}

function mapRequirementPathsToRecord(map: Map<string, string[][]>) {
  return Object.fromEntries(
    [...map.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([courseCode, requirementPaths]) => [
        courseCode,
        requirementPaths
          .map((requirementPath) => [...requirementPath])
          .sort((left, right) => left.join("|").localeCompare(right.join("|"))),
      ])
  );
}

export function buildTransferPlannerCoursePlanningGraph(input: {
  plan?: TransferPlannerMajorPlan | null;
  actionableCourseCodes: Set<string> | string[];
}): TransferPlannerCoursePlanningGraph {
  const actionableCourseCodes = new Set(
    [...input.actionableCourseCodes].map((courseCode) => normalizeCourseCode(courseCode))
  );
  const metadataPrerequisiteMap = buildMetadataCourseRequirementMap(
    actionableCourseCodes,
    "prerequisite"
  );
  const metadataCorequisiteMap = buildMetadataCourseRequirementMap(
    actionableCourseCodes,
    "corequisite"
  );
  const chainPrerequisiteMap = buildPlannerChainPrerequisiteMap(input.plan, actionableCourseCodes);
  const prerequisiteMap = mergeCourseRequirementMaps(
    metadataPrerequisiteMap,
    chainPrerequisiteMap
  );

  return {
    prerequisiteCourseSetsByCourseCode: mapRequirementPathsToRecord(prerequisiteMap),
    corequisiteCourseSetsByCourseCode: mapRequirementPathsToRecord(metadataCorequisiteMap),
    sourceCounts: {
      metadataPrerequisiteCourseCount: metadataPrerequisiteMap.size,
      metadataCorequisiteCourseCount: metadataCorequisiteMap.size,
      chainPrerequisiteCourseCount: chainPrerequisiteMap.size,
    },
  };
}

function getCoursePlanningGraphRequirementMap(
  graph: TransferPlannerCoursePlanningGraph,
  key: "prerequisiteCourseSetsByCourseCode" | "corequisiteCourseSetsByCourseCode"
) {
  return new Map(
    Object.entries(graph[key]).map(([courseCode, requirementPaths]) => [
      courseCode,
      requirementPaths.map((requirementPath) => [...requirementPath]),
    ])
  );
}

function requirementPathsAreSatisfied(
  requirementPaths: string[][],
  satisfiedCourseCodes: Set<string>
) {
  if (!requirementPaths.length) {
    return true;
  }

  return requirementPaths.some((coursePath) =>
    coursePath.every((courseCode) => satisfiedCourseCodes.has(courseCode))
  );
}

function courseHasSatisfiedPrerequisites(
  course: PendingSuggestedCourse,
  completedCourseCodes: Set<string>
) {
  return requirementPathsAreSatisfied(course.prerequisiteCourseSets, completedCourseCodes);
}

function courseHasSatisfiedCorequisites(
  course: PendingSuggestedCourse,
  completedCourseCodes: Set<string>,
  selectedCourses: PendingSuggestedCourse[]
) {
  const satisfiedCourseCodes = new Set([
    ...completedCourseCodes,
    ...selectedCourses.flatMap((selectedCourse) => selectedCourse.explicitCourseCodes),
  ]);
  return requirementPathsAreSatisfied(course.corequisiteCourseSets, satisfiedCourseCodes);
}

function courseHasSatisfiedPlanningGraph(
  course: PendingSuggestedCourse,
  completedCourseCodes: Set<string>,
  selectedCourses: PendingSuggestedCourse[]
) {
  return (
    courseHasSatisfiedPrerequisites(course, completedCourseCodes) &&
    courseHasSatisfiedCorequisites(course, completedCourseCodes, selectedCourses)
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

    if (!courseHasSatisfiedPlanningGraph(course, completedCourseCodes, filtered)) {
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
      return courseHasSatisfiedPlanningGraph(course, completedCourseCodes, selectedCourses);
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
  prerequisiteCourseMap: Map<string, string[][]>,
  corequisiteCourseMap: Map<string, string[][]>
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
          corequisiteCourseSets: unique(
            (shouldScheduleAsChoiceBucket ? [] : extractCourseCodes(label)).flatMap(
              (courseCode) => corequisiteCourseMap.get(courseCode) ?? []
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

function buildPrerequisiteDependencyCoursesForEssentialPlan(
  essentialCourses: PendingSuggestedCourse[],
  candidateDependencyCourses: PendingSuggestedCourse[],
  completedCourseCodes: Set<string>
) {
  const candidateByCode = new Map<string, PendingSuggestedCourse>();
  for (const course of candidateDependencyCourses) {
    for (const courseCode of course.explicitCourseCodes) {
      if (!candidateByCode.has(courseCode)) {
        candidateByCode.set(courseCode, course);
      }
    }
  }

  const selectedByLabel = new Map<string, PendingSuggestedCourse>();
  const selectedCourseCodes = new Set<string>();
  const coursesToInspect = [...essentialCourses];

  for (let index = 0; index < coursesToInspect.length; index += 1) {
    const course = coursesToInspect[index];
    if (!course) continue;

    for (const requirementPaths of [
      course.prerequisiteCourseSets,
      course.corequisiteCourseSets,
    ]) {
      const selectedPath =
        requirementPaths.find((path) =>
          path.every((courseCode) => completedCourseCodes.has(courseCode) || candidateByCode.has(courseCode))
        ) ??
        requirementPaths.find((path) => path.some((courseCode) => candidateByCode.has(courseCode))) ??
        null;
      if (!selectedPath) continue;

      for (const courseCode of selectedPath) {
        if (completedCourseCodes.has(courseCode) || selectedCourseCodes.has(courseCode)) {
          continue;
        }

        const dependencyCourse = candidateByCode.get(courseCode);
        if (!dependencyCourse || selectedByLabel.has(dependencyCourse.label)) {
          continue;
        }

        const promotedDependencyCourse: PendingSuggestedCourse = {
          ...dependencyCourse,
          priorityRank: Math.min(
            dependencyCourse.priorityRank,
            REQUIREMENT_PRIORITY_RANK.beforeEnrollment
          ),
          guidanceSummary:
            dependencyCourse.guidanceSummary ??
            `Needed before ${course.label} can be completed for this plan.`,
        };
        selectedByLabel.set(promotedDependencyCourse.label, promotedDependencyCourse);
        for (const explicitCourseCode of promotedDependencyCourse.explicitCourseCodes) {
          selectedCourseCodes.add(explicitCourseCode);
        }
        coursesToInspect.push(promotedDependencyCourse);
      }
    }
  }

  return [...selectedByLabel.values()];
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
  const planningGraph = buildTransferPlannerCoursePlanningGraph({
    plan: input.plan,
    actionableCourseCodes,
  });
  const prerequisiteCourseMap = getCoursePlanningGraphRequirementMap(
    planningGraph,
    "prerequisiteCourseSetsByCourseCode"
  );
  const corequisiteCourseMap = getCoursePlanningGraphRequirementMap(
    planningGraph,
    "corequisiteCourseSetsByCourseCode"
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
  ], prerequisiteCourseMap, corequisiteCourseMap);
  const stayAtGrcRemainingCourses = buildRemainingSuggestedCourses([
    {
      bucket: "stayAtGrc",
      statuses: input.stayAtGrcStatuses,
    },
  ], prerequisiteCourseMap, corequisiteCourseMap);
  const essentialDependencyCourses = buildPrerequisiteDependencyCoursesForEssentialPlan(
    essentialRemainingCourses,
    stayAtGrcRemainingCourses,
    completedCourseCodes
  );
  const remainingCourses =
    input.includeStayAtGrcCourses === false
      ? essentialRemainingCourses.length || essentialDependencyCourses.length
        ? [...essentialRemainingCourses, ...essentialDependencyCourses]
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
        ], prerequisiteCourseMap, corequisiteCourseMap);
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
  const fillerPool = buildGeneralEducationPlaceholders(
    input.track,
    input.completedCourses,
    input.referenceDate
  ).map<PendingSuggestedCourse>((label) => ({
      label,
      type: "elective",
      status: "planned",
      guidanceSummary: null,
      sequenceGroup: null,
      priorityRank: REQUIREMENT_PRIORITY_RANK.stayAtGrc + 1,
      sourceOrder: Number.MAX_SAFE_INTEGER,
      explicitCourseCodes: [],
      prerequisiteCourseSets: [],
      corequisiteCourseSets: [],
    }));
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
