import {
  TRANSFER_PLANNER_RUNTIME_CAMPUSES,
  TRANSFER_PLANNER_RUNTIME_COMPACT_COURSE_REGISTRY,
  TRANSFER_PLANNER_RUNTIME_EQUIVALENCY_RULE_REGISTRY,
  TRANSFER_PLANNER_RUNTIME_MAJOR_PLANS,
  TRANSFER_PLANNER_RUNTIME_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY,
  TRANSFER_PLANNER_RUNTIME_PATHWAYS_BY_PLAN_ID,
  TRANSFER_PLANNER_RUNTIME_PRIMARY_DEGREE_SOURCES_BY_KEY,
  TRANSFER_PLANNER_RUNTIME_RESOLVED_MAJOR_PLANS_BY_KEY,
  TRANSFER_PLANNER_RUNTIME_SOURCE_GAP_REGISTRY,
  TRANSFER_PLANNER_RUNTIME_TRACKS,
  type TransferPlannerRuntimeCompactCourseRegistryEntry,
} from "./student-runtime.generated";
import type {
  TransferPlannerCampus,
  TransferPlannerCampusId,
  TransferPlannerChecklistItem,
  TransferPlannerGeneralRequirementSection,
  TransferPlannerGeneralRequirementSourceKind,
  TransferPlannerMajorPlan,
  TransferPlannerMajorPathway,
  TransferPlannerResolvedMajorPlan,
  TransferPlannerTrack,
} from "../transfer-planner-types";
import type {
  TransferPlannerCourseRegistryEntry,
  TransferPlannerEffectiveYearRange,
  TransferPlannerEquivalencyRule,
  TransferPlannerSourceManifestEntry,
  TransferPlannerSourceSchoolId,
} from "./schema";

export type {
  TransferPlannerCampus,
  TransferPlannerCampusId,
  TransferPlannerChecklistItem,
  TransferPlannerGeneralRequirementSection,
  TransferPlannerGeneralRequirementSourceKind,
  TransferPlannerMajorPlan,
  TransferPlannerMajorPathway,
  TransferPlannerRequirementType,
  TransferPlannerResolvedMajorPlan,
  TransferPlannerTrack,
} from "../transfer-planner-types";
export type {
  TransferPlannerEquivalencyRule,
  TransferPlannerStudentCourseEvaluation,
} from "./schema";

const EXPLICIT_COURSE_CODE_PATTERN =
  /\b([A-Za-z&]{2,8}|[A-Za-z&]{1,4}(?:\s+[A-Za-z&]{1,4}))\s+(\d{3}(?:\.\d+)?[A-Za-z]?)\b/g;
const COURSE_NUMBER_CONTINUATION_PATTERN =
  /(?:^|[,(;/]\s*|\b(?:or|and)\s+)(\d{3}(?:\.\d+)?[A-Za-z]?)(?=$|[\s,);/]|(?:\s*(?:or|and)\b))/gi;
const INVALID_EXTRACTED_COURSE_SUBJECTS = new Set([
  "AND",
  "ANY",
  "APPROVED",
  "AT",
  "BEFORE",
  "BREADTH",
  "BY",
  "COMPLETE",
  "COURSE",
  "COURSES",
  "CREDIT",
  "CREDITS",
  "EITHER",
  "FOR",
  "FROM",
  "IN",
  "INTO",
  "MINIMUM",
  "NOT",
  "OF",
  "ONE",
  "OR",
  "PLUS",
  "REQUIRED",
  "SECTION",
  "THE",
  "TO",
  "TOTAL",
  "TWO",
  "USE",
]);
const RECOVERABLE_LEADING_SUBJECT_TOKENS = new Set([
  "AND",
  "AS",
  "BOTH",
  "EITHER",
  "IN",
  "OR",
  "PREREQ",
  "PREREQUISITE",
]);
const EXPLICIT_SPACED_SUBJECT_ALIASES = new Map<string, string>([
  ["A A", "AA"],
  ["A MATH", "AMATH"],
  ["CHEM E", "CHEME"],
  ["E E", "EE"],
  ["IND E", "INDE"],
  ["M E", "ME"],
]);
const GRC_EQUIVALENT_COURSE_CODE_SETS = [
  ["MATH& 254", "MATH& 264"],
  ["PHYS 154", "PHYS& 154"],
  ["PHYS 155", "PHYS& 155"],
] as const;
const GUIDE_TERM_ORDER: Partial<Record<string, number>> = {
  WIN: 1,
  SPR: 2,
  SUM: 3,
  AUT: 4,
};

type TransferPlannerRuntimeSourceGapEntry = {
  planId: string;
  pathwayId: string | null;
  title: string;
  sourceGapReason: string;
  suggestedPrimary?: {
    label?: string | null;
    url: string;
  } | null;
};

const KNOWN_TRANSFER_PLANNER_SUBJECT_CODES = new Set(
  TRANSFER_PLANNER_RUNTIME_COMPACT_COURSE_REGISTRY.map((entry) =>
    String(entry.code ?? "").match(/^([A-Z&]+(?: [A-Z&]+)*)\s+\d/)
  )
    .map((match) => match?.[1] ?? null)
    .filter((subjectCode): subjectCode is string => Boolean(subjectCode))
);

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function getPlannerPathwayKey(planId: string, pathwayId?: string | null) {
  return `${planId}::${pathwayId ?? ""}`;
}

export function normalizeTransferPlannerCourseCode(value: string) {
  const normalized = String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^([A-Z&]+(?: [A-Z&]+)*) (\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (!match) {
    return normalized;
  }

  let subjectTokens = match[1].split(" ").filter(Boolean);
  while (
    subjectTokens.length > 1 &&
    RECOVERABLE_LEADING_SUBJECT_TOKENS.has(subjectTokens[0])
  ) {
    const candidateTokens = subjectTokens.slice(1);
    const candidateSpacedSubject = candidateTokens.join(" ");
    const candidateCollapsedSubject = candidateTokens.join("");
    if (
      KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(candidateSpacedSubject) ||
      KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(candidateCollapsedSubject)
    ) {
      subjectTokens = candidateTokens;
      continue;
    }
    break;
  }

  const spacedSubject = subjectTokens.join(" ");
  const explicitAlias = EXPLICIT_SPACED_SUBJECT_ALIASES.get(spacedSubject);
  if (explicitAlias) {
    return `${explicitAlias} ${match[2]}`;
  }

  const collapsedSubject = subjectTokens.join("");
  const normalizedSubject =
    subjectTokens.every((token) => token.length === 1) ||
    (subjectTokens.length > 1 &&
      KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(collapsedSubject) &&
      !KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(spacedSubject))
      ? collapsedSubject
      : spacedSubject;

  return `${normalizedSubject} ${match[2]}`;
}

function normalizeCourseCode(value: string | null | undefined) {
  return normalizeTransferPlannerCourseCode(String(value ?? ""));
}

function normalizeExtractedCourseSubject(rawSubject: string | null | undefined) {
  let subjectTokens = String(rawSubject ?? "")
    .toUpperCase()
    .replace(/[^A-Z&]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  while (
    subjectTokens.length > 1 &&
    RECOVERABLE_LEADING_SUBJECT_TOKENS.has(subjectTokens[0])
  ) {
    subjectTokens = subjectTokens.slice(1);
  }

  const subject = subjectTokens.join(" ");
  const collapsedSubject = subjectTokens.join("");
  if (
    subjectTokens.length > 1 &&
    KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(collapsedSubject) &&
    !KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(subject)
  ) {
    return collapsedSubject;
  }

  if (
    !subjectTokens.length ||
    subjectTokens.length > 2 ||
    (subjectTokens.length === 1 && subjectTokens[0].length < 2) ||
    subjectTokens.some((token) => token.length > 8 || !/^[A-Z&]+$/.test(token)) ||
    INVALID_EXTRACTED_COURSE_SUBJECTS.has(subject) ||
    subjectTokens.some((token) => INVALID_EXTRACTED_COURSE_SUBJECTS.has(token))
  ) {
    return null;
  }

  return subject;
}

function normalizeExtractedCourseCode(rawSubject: string, rawNumber: string) {
  const subject = normalizeExtractedCourseSubject(rawSubject);
  const number = String(rawNumber ?? "").toUpperCase().trim().replace(/\s+/g, "");
  if (!subject || !/^\d{3}(?:\.\d+)?[A-Z]?$/.test(number)) {
    return null;
  }
  return normalizeCourseCode(`${subject} ${number}`);
}

export function extractTransferPlannerCourseCodes(value: string) {
  const normalizedValue = String(value ?? "").toUpperCase().replace(/\s+/g, " ");
  const extractedCourseCodes: string[] = [];
  const explicitMatches = [...normalizedValue.matchAll(EXPLICIT_COURSE_CODE_PATTERN)];

  for (let index = 0; index < explicitMatches.length; index += 1) {
    const match = explicitMatches[index];
    const subject = normalizeExtractedCourseSubject(match[1]);
    const explicitCode = normalizeExtractedCourseCode(match[1], match[2]);
    if (!subject || !explicitCode) continue;

    extractedCourseCodes.push(explicitCode);

    const currentMatchEnd = (match.index ?? 0) + match[0].length;
    const nextMatchStart =
      index + 1 < explicitMatches.length
        ? explicitMatches[index + 1]?.index ?? normalizedValue.length
        : normalizedValue.length;
    const trailingSegment = normalizedValue.slice(currentMatchEnd, nextMatchStart);

    for (const numberMatch of trailingSegment.matchAll(COURSE_NUMBER_CONTINUATION_PATTERN)) {
      const continuationCode = normalizeExtractedCourseCode(subject, numberMatch[1]);
      if (continuationCode) {
        extractedCourseCodes.push(continuationCode);
      }
    }
  }

  return unique(extractedCourseCodes);
}

export const TRANSFER_PLANNER_CAMPUSES: TransferPlannerCampus[] =
  TRANSFER_PLANNER_RUNTIME_CAMPUSES;
export const TRANSFER_PLANNER_TRACKS: TransferPlannerTrack[] = TRANSFER_PLANNER_RUNTIME_TRACKS;
export const TRANSFER_PLANNER_SOURCE_GAP_REGISTRY =
  TRANSFER_PLANNER_RUNTIME_SOURCE_GAP_REGISTRY as TransferPlannerRuntimeSourceGapEntry[];

const TRACKS_BY_ID = new Map(TRANSFER_PLANNER_TRACKS.map((track) => [track.id, track]));
const MAJOR_PLANS_BY_ID = new Map(
  TRANSFER_PLANNER_RUNTIME_MAJOR_PLANS.map((plan) => [plan.id, plan])
);
const COMPACT_COURSES_BY_KEY = new Map(
  TRANSFER_PLANNER_RUNTIME_COMPACT_COURSE_REGISTRY.map((entry) => [
    `${entry.schoolId}|${normalizeCourseCode(entry.code)}`,
    entry,
  ])
);
const EQUIVALENT_GRC_COURSE_CODES_BY_CODE = new Map<string, string[]>();

for (const courseSet of GRC_EQUIVALENT_COURSE_CODE_SETS) {
  const normalizedCourseSet = courseSet.map((code) => normalizeCourseCode(code)).filter(Boolean);
  for (const code of normalizedCourseSet) {
    EQUIVALENT_GRC_COURSE_CODES_BY_CODE.set(
      code,
      normalizedCourseSet.filter((candidateCode) => candidateCode !== code)
    );
  }
}

function getEquivalentCourseCodes(schoolId: TransferPlannerSourceSchoolId, code: string) {
  const normalizedCode = normalizeCourseCode(code);
  if (!normalizedCode) return [] as string[];
  const equivalentCourseCodes =
    schoolId === "grc" ? EQUIVALENT_GRC_COURSE_CODES_BY_CODE.get(normalizedCode) ?? [] : [];
  return unique([normalizedCode, ...equivalentCourseCodes].filter(Boolean));
}

function parseCourseParts(code: string) {
  const normalizedCode = normalizeCourseCode(code);
  const match = normalizedCode.match(/^([A-Z&]+(?: [A-Z&]+)*)\s+(\d{3}(?:\.\d+)?[A-Z]?)$/);
  const catalogNumber = match?.[2] ?? "";
  const levelMatch = catalogNumber.match(/^(\d{3})/);
  return {
    subjectCode: match?.[1] ?? normalizedCode.replace(/\s+\d.*$/, ""),
    catalogNumber,
    level: levelMatch ? Number.parseInt(levelMatch[1], 10) : null,
  };
}

function expandCourseEntry(
  entry: TransferPlannerRuntimeCompactCourseRegistryEntry,
  requestedCode?: string
): TransferPlannerCourseRegistryEntry {
  const code = normalizeCourseCode(requestedCode ?? entry.code);
  const parts = parseCourseParts(code);
  return {
    id: `${entry.schoolId}:${code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    schoolId: entry.schoolId,
    code,
    displayLabel: code,
    title: entry.title ?? null,
    creditValue: entry.creditValue ?? null,
    creditLabel: entry.creditLabel ?? null,
    catalogDescription: entry.catalogDescription ?? null,
    subjectCode: parts.subjectCode,
    catalogNumber: parts.catalogNumber,
    level: parts.level,
    sourceKinds: [],
    sourceContexts: [],
    referencedByPlanIds: [],
    referencedByTrackIds: [],
    sourceLinks: [],
    effectiveYearLabels: [],
    effectiveYearRanges: [],
    prerequisiteCourseCodes: entry.prerequisiteCourseCodes ?? [],
    prerequisiteAlternativeCourseCodeSets: entry.prerequisiteAlternativeCourseCodeSets ?? [],
    prerequisiteNotes: [],
    corequisiteCourseCodes: entry.corequisiteCourseCodes ?? [],
    corequisiteAlternativeCourseCodeSets: entry.corequisiteAlternativeCourseCodeSets ?? [],
    corequisiteNotes: [],
    latestAvailabilitySummary: entry.latestAvailabilitySummary ?? null,
    latestPublishedQuarters: entry.latestPublishedQuarters ?? [],
    notes: [],
  };
}

function getCourseRegistryEntryScore(
  entry: TransferPlannerRuntimeCompactCourseRegistryEntry,
  requestedCode: string
) {
  let score = 0;
  if (entry.title) score += 32;
  if (entry.creditValue !== undefined && entry.creditValue !== null) score += 16;
  if (entry.creditLabel) score += 8;
  if ((entry.prerequisiteCourseCodes ?? []).length > 0) score += 8;
  if ((entry.prerequisiteAlternativeCourseCodeSets ?? []).length > 0) score += 6;
  if ((entry.corequisiteCourseCodes ?? []).length > 0) score += 8;
  if ((entry.corequisiteAlternativeCourseCodeSets ?? []).length > 0) score += 6;
  if (normalizeCourseCode(entry.code) === requestedCode) score += 1;
  return score;
}

export function getTransferPlannerCanonicalCourse(
  schoolId: TransferPlannerSourceSchoolId,
  code: string
) {
  const normalizedCode = normalizeCourseCode(code);
  const exactEntry = COMPACT_COURSES_BY_KEY.get(`${schoolId}|${normalizedCode}`) ?? null;
  const bestEquivalentEntry =
    getEquivalentCourseCodes(schoolId, normalizedCode)
      .map((candidateCode) => COMPACT_COURSES_BY_KEY.get(`${schoolId}|${candidateCode}`) ?? null)
      .filter((entry): entry is TransferPlannerRuntimeCompactCourseRegistryEntry =>
        Boolean(entry)
      )
      .sort((left, right) => {
        const scoreDelta =
          getCourseRegistryEntryScore(right, normalizedCode) -
          getCourseRegistryEntryScore(left, normalizedCode);
        if (scoreDelta !== 0) return scoreDelta;
        return left.code.localeCompare(right.code);
      })[0] ?? null;

  const selectedEntry = bestEquivalentEntry ?? exactEntry;
  return selectedEntry ? expandCourseEntry(selectedEntry, normalizedCode) : undefined;
}

function parseGuideTermSortValue(label: string | null | undefined) {
  const match = String(label ?? "")
    .toUpperCase()
    .match(/\b(WIN|SPR|SUM|AUT)\s+QTR\.\s+(\d{4})\b/);
  if (!match) return null;
  const quarter = GUIDE_TERM_ORDER[match[1]];
  if (!quarter) return null;
  return Number.parseInt(match[2], 10) * 10 + quarter;
}

function isEffectiveRangeActiveForGuideTerm(
  range: TransferPlannerEffectiveYearRange,
  termLabel: string
) {
  const termValue = parseGuideTermSortValue(termLabel);
  if (termValue === null) return true;

  const endValue = parseGuideTermSortValue(range.endLabel);
  if (range.startLabel === "prior-to-guide-cutoff") {
    return endValue === null ? true : termValue < endValue;
  }

  const startValue = parseGuideTermSortValue(range.startLabel);
  if (startValue !== null && termValue < startValue) return false;
  if (endValue !== null && termValue > endValue) return false;
  return true;
}

export function isTransferPlannerEquivalencyRuleEffectiveForTerm(
  rule: TransferPlannerEquivalencyRule,
  termLabel: string
) {
  if (rule.effectiveYearRanges.length === 0) return true;
  return rule.effectiveYearRanges.some((range) =>
    isEffectiveRangeActiveForGuideTerm(range, termLabel)
  );
}

let equivalencyRulesBySourceCourse: Map<string, TransferPlannerEquivalencyRule[]> | null = null;

function getEquivalencyRulesBySourceCourse() {
  if (equivalencyRulesBySourceCourse) return equivalencyRulesBySourceCourse;

  const rulesBySourceCourse = new Map<string, TransferPlannerEquivalencyRule[]>();
  for (const rule of TRANSFER_PLANNER_RUNTIME_EQUIVALENCY_RULE_REGISTRY) {
    const sourceCourses = unique(
      (rule.sourceCourseSets ?? [])
        .flatMap((courseSet) => courseSet)
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean)
    );

    for (const sourceCourse of sourceCourses) {
      const matchingRules = rulesBySourceCourse.get(sourceCourse) ?? [];
      matchingRules.push(rule);
      rulesBySourceCourse.set(sourceCourse, matchingRules);
    }
  }

  equivalencyRulesBySourceCourse = rulesBySourceCourse;
  return equivalencyRulesBySourceCourse;
}

export function getTransferPlannerEquivalencyRulesForSourceCourse(
  sourceCourseCode: string,
  effectiveTermLabel?: string | null
) {
  const normalizedCode = normalizeCourseCode(sourceCourseCode);
  const matchingRules = getEquivalencyRulesBySourceCourse().get(normalizedCode) ?? [];
  return matchingRules.filter((rule) =>
    effectiveTermLabel
      ? isTransferPlannerEquivalencyRuleEffectiveForTerm(rule, effectiveTermLabel)
      : true
  );
}

export function getTransferPlannerStudentRuntimeMajorsForCampus(
  campusId: TransferPlannerCampusId
) {
  return TRANSFER_PLANNER_RUNTIME_MAJOR_PLANS.filter((plan) => plan.campusId === campusId);
}

export function getTransferPlannerStudentRuntimePathwaysForPlan(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) return [] as TransferPlannerMajorPathway[];
  return TRANSFER_PLANNER_RUNTIME_PATHWAYS_BY_PLAN_ID[plan.id] ?? plan.pathways ?? [];
}

export function resolveTransferPlannerStudentRuntimeMajorPlan(
  plan: TransferPlannerMajorPlan | null | undefined,
  pathwayId: string | null | undefined
) {
  if (!plan) return null as TransferPlannerResolvedMajorPlan | null;
  const pathways = getTransferPlannerStudentRuntimePathwaysForPlan(plan);
  const selectedPathwayId =
    pathwayId && pathways.some((pathway) => pathway.id === pathwayId)
      ? pathwayId
      : pathways[0]?.id ?? null;
  return (
    TRANSFER_PLANNER_RUNTIME_RESOLVED_MAJOR_PLANS_BY_KEY[
      getPlannerPathwayKey(plan.id, selectedPathwayId)
    ] ??
    TRANSFER_PLANNER_RUNTIME_RESOLVED_MAJOR_PLANS_BY_KEY[getPlannerPathwayKey(plan.id, null)] ??
    ({ ...plan, selectedPathwayId: null, selectedPathwayLabel: null, selectedPathwaySummary: null } satisfies TransferPlannerResolvedMajorPlan)
  );
}

export function getTransferPlannerMajorPlan(planId: string) {
  return MAJOR_PLANS_BY_ID.get(planId) ?? null;
}

export function resolveTransferPlannerMajorPlan(
  plan: TransferPlannerMajorPlan | null | undefined,
  pathwayId: string | null | undefined
) {
  return resolveTransferPlannerStudentRuntimeMajorPlan(plan, pathwayId);
}

export function getTransferPlannerTrack(trackId: string | null) {
  if (!trackId) return null;
  return TRACKS_BY_ID.get(trackId) ?? null;
}

export function getTransferPlannerPrimaryDegreeRequirementsSource(
  planId: string,
  pathwayId?: string | null
) {
  return (
    TRANSFER_PLANNER_RUNTIME_PRIMARY_DEGREE_SOURCES_BY_KEY[
      getPlannerPathwayKey(planId, pathwayId ?? null)
    ] ??
    TRANSFER_PLANNER_RUNTIME_PRIMARY_DEGREE_SOURCES_BY_KEY[getPlannerPathwayKey(planId, null)] ??
    null
  ) as TransferPlannerSourceManifestEntry | null;
}

export function getTransferPlannerParsedRequirementSourceBlocks(
  planId: string,
  pathwayId?: string | null
) {
  return TRANSFER_PLANNER_RUNTIME_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.filter(
    (entry) =>
      entry.planId === planId &&
      (pathwayId === undefined
        ? true
        : pathwayId === null
          ? !entry.pathwayId
          : entry.pathwayId === pathwayId)
  );
}

function getChecklistReferenceCourses(plan: TransferPlannerMajorPlan) {
  return [
    ...(plan.applicationChecklist ?? []),
    ...(plan.beforeEnrollmentChecklist ?? []),
    ...(plan.stayAtGrcChecklist ?? []),
  ].flatMap((item) => [item.grcCourses, ...(item.alternatives ?? [])].flat());
}

export function getTransferPlannerGrcCourseList(
  plan: TransferPlannerMajorPlan | TransferPlannerResolvedMajorPlan | null | undefined
) {
  if (!plan) return [] as string[];
  return unique([...(plan.grcCourseList ?? []), ...getChecklistReferenceCourses(plan)])
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter(Boolean);
}

export function getTransferPlannerGrcCourseAvailabilitySummary(
  courseLabel: string | null | undefined
) {
  for (const courseCode of extractTransferPlannerCourseCodes(String(courseLabel ?? ""))) {
    const summary = getTransferPlannerCanonicalCourse("grc", courseCode)?.latestAvailabilitySummary;
    if (summary) return summary;
  }
  return null;
}

export function getTransferPlannerGrcCourseLatestPublishedQuarters(
  courseLabel: string | null | undefined
) {
  for (const courseCode of extractTransferPlannerCourseCodes(String(courseLabel ?? ""))) {
    const quarters = getTransferPlannerCanonicalCourse("grc", courseCode)?.latestPublishedQuarters;
    if (quarters?.length) return [...quarters];
  }
  return null;
}
