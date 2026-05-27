import type { TransferPlannerChecklistItem } from "@/constants/transfer-planner-source/student-runtime";

import {
  extractCourseCodes,
  normalizeCourseCode,
  type TranscriptCourseEntry,
} from "./course-code";

export type TransferRequirementStatus = {
  item: TransferPlannerChecklistItem;
  matched: boolean;
  matchedCourses: TranscriptCourseEntry[];
  explicitCourseCodes: string[];
  requiredCompletedCount: number;
  completedCredits?: number;
  requiredCreditCount?: number | null;
  maxCreditCount?: number | null;
  creditProgressLabel?: string | null;
};

export type RequirementGroupOption =
  NonNullable<TransferPlannerChecklistItem["requirementGroup"]>["options"][number];

export type RequirementCourseOption = {
  courseLabels: string[];
  explicitCourseCodes: string[];
  matchedCourses: TranscriptCourseEntry[];
  requiredCompletedCount: number;
  matched: boolean;
  remainingCourseCodes: string[];
  index: number;
};

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

type AdmissionPrerequisiteCompletionRule = {
  id: string;
  itemNotePattern: RegExp;
  itemGrcCourseCodes?: string[];
  satisfyingSubjects: string[];
  minimumCredits: number;
  minimumGrade: number;
};

const ADMISSION_PREREQUISITE_COMPLETION_RULES: AdmissionPrerequisiteCompletionRule[] = [
  {
    id: "uw-seattle-phgh-public-health-intro-or-department-course",
    itemNotePattern: /\bPH-GH admission prerequisite option\b/i,
    itemGrcCourseCodes: ["NUTR& 101"],
    satisfyingSubjects: [
      "AAS",
      "AES",
      "AFRAM",
      "AIS",
      "ANTH",
      "CHSTU",
      "ENVH",
      "EPI",
      "GEOG",
      "GH",
      "HSERV",
      "POLS",
      "PSYC",
      "PSYCH",
      "SOC",
    ],
    minimumCredits: 5,
    minimumGrade: 2.5,
  },
];

function getCourseSubjectKey(courseCode: string) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const match = normalizedCourseCode.match(/^([A-Z&]+(?:\s+[A-Z&]+)*)\s+\d/);
  return String(match?.[1] ?? "")
    .replace(/[&\s]/g, "")
    .trim();
}

function parseGradeValue(value: unknown) {
  const raw = String(value ?? "").replace(/\s+/g, "").trim();
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(numeric, 4));
  }

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
  return letterValues[raw.toUpperCase()] ?? null;
}

function courseMeetsMinimumGrade(course: TranscriptCourseEntry, minimumGrade: number) {
  const gradeValue =
    typeof course.gradeValue === "number" && Number.isFinite(course.gradeValue)
      ? course.gradeValue
      : parseGradeValue(course.grade);
  return gradeValue == null || gradeValue >= minimumGrade;
}

function courseMeetsMinimumCredits(course: TranscriptCourseEntry, minimumCredits: number) {
  const credits = Number(course.credits);
  return !Number.isFinite(credits) || credits >= minimumCredits;
}

function getAdmissionPrerequisiteSubjectSet(rule: AdmissionPrerequisiteCompletionRule) {
  return new Set(
    rule.satisfyingSubjects.map((subject) => subject.replace(/[&\s]/g, "").trim())
  );
}

function itemMatchesAdmissionPrerequisiteCompletionRule(
  item: TransferPlannerChecklistItem,
  rule: AdmissionPrerequisiteCompletionRule
) {
  const grcCourseCodes = (item.grcCourses ?? [])
    .flatMap((label) => extractCourseCodes(label))
    .map((courseCode) => normalizeCourseCode(courseCode));
  const ruleGrcCourseCodes = rule.itemGrcCourseCodes ?? [];
  return (
    (!ruleGrcCourseCodes.length ||
      ruleGrcCourseCodes.some((courseCode) =>
        grcCourseCodes.includes(normalizeCourseCode(courseCode))
      )) &&
    rule.itemNotePattern.test(
      `${item.note ?? ""} ${item.reason ?? ""}`
    )
  );
}

function findCompletedAdmissionPrerequisiteCourse(
  item: TransferPlannerChecklistItem,
  completedCourses: TranscriptCourseEntry[]
) {
  for (const rule of ADMISSION_PREREQUISITE_COMPLETION_RULES) {
    if (!itemMatchesAdmissionPrerequisiteCompletionRule(item, rule)) {
      continue;
    }

    const satisfyingSubjects = getAdmissionPrerequisiteSubjectSet(rule);
    const matchedCourse = completedCourses.find((course) => {
      const subjectKey = getCourseSubjectKey(course.code);
      return (
        satisfyingSubjects.has(subjectKey) &&
        courseMeetsMinimumCredits(course, rule.minimumCredits) &&
        courseMeetsMinimumGrade(course, rule.minimumGrade)
      );
    });
    if (matchedCourse) {
      return matchedCourse;
    }
  }

  return null;
}

export function getChecklistChoiceLabels(item: TransferPlannerChecklistItem) {
  const mappedLabels = unique(
    [item.grcCourses, ...(item.alternatives ?? [])]
      .flat()
      .map((label) => String(label ?? "").trim())
      .filter(Boolean)
  );
  if (mappedLabels.length) {
    return mappedLabels;
  }

  return unique(
    (item.requirementGroup?.options ?? [])
      .flatMap((option) => getRequirementOptionCourseLabels(option))
      .map((label) => String(label ?? "").trim())
      .filter(Boolean)
  );
}

export function getRequirementOptionCourseLabels(option: RequirementGroupOption) {
  if (option.optionKind === "category-option") {
    return [] as string[];
  }

  const grcMatches = (option.grcMatches ?? [])
    .map((label) => String(label ?? "").trim())
    .filter(Boolean);
  if (grcMatches.length) {
    return unique(grcMatches);
  }

  return unique(
    [...(option.uwCourses ?? []), ...(option.equivalentUwCourseCodes ?? [])]
      .map((label) => String(label ?? "").trim())
      .filter(Boolean)
  );
}

export function getRequirementOptionMappedGrcCourseLabels(option: RequirementGroupOption) {
  if (option.optionKind === "category-option") {
    return [] as string[];
  }

  return unique(
    (option.grcMatches ?? [])
      .map((label) => String(label ?? "").trim())
      .filter(Boolean)
  );
}

function isUwOnlyNoCurrentGrcEquivalentOption(option: RequirementGroupOption) {
  return (
    !(option.grcMatches ?? []).some((label) => String(label ?? "").trim()) &&
    (option.constraints ?? []).includes("uw_only_no_current_grc_equivalent")
  );
}

export function getRequirementOptionSchedulableCourseLabels(
  item: TransferPlannerChecklistItem,
  option: RequirementGroupOption
) {
  if (isUwOnlyNoCurrentGrcEquivalentOption(option)) {
    return [];
  }

  const mappedGrcCourseLabels = getRequirementOptionMappedGrcCourseLabels(option);
  if (
    item.requirementGroup?.requirementType === "sequence_choice" &&
    option.compoundComponents?.length
  ) {
    const compoundComponentLabels = uniqueBy(
      option.compoundComponents
        .map((component) =>
          unique(
            component
              .map((courseCode) => normalizeCourseCode(courseCode))
              .filter(Boolean)
          )
        )
        .filter((component) => component.length > 0),
      (component) => component.join("|")
    ).map((component) => component.join(" + "));
    const compoundComponentCodes = new Set(
      option.compoundComponents
        .flat()
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean)
    );
    const looseCourseLabels = mappedGrcCourseLabels.filter((label) => {
      const labelCodes = extractCourseCodes(label)
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean);
      return (
        labelCodes.length === 0 ||
        labelCodes.some((courseCode) => !compoundComponentCodes.has(courseCode))
      );
    });

    return unique([...compoundComponentLabels, ...looseCourseLabels]);
  }

  return mappedGrcCourseLabels;
}

export function getRequirementOptionSelectionKey(item: TransferPlannerChecklistItem) {
  return item.requirementGroup?.id ?? item.id;
}

export const USER_UNSELECTED_REQUIREMENT_OPTION_PREFIX = "__unselected__:";

export function markUserUnselectedRequirementOptionId(optionId: string) {
  const normalizedOptionId = String(optionId ?? "").trim();
  return normalizedOptionId
    ? `${USER_UNSELECTED_REQUIREMENT_OPTION_PREFIX}${normalizedOptionId}`
    : "";
}

export function isUserUnselectedRequirementOptionMarker(value: unknown) {
  return String(value ?? "").trim().startsWith(USER_UNSELECTED_REQUIREMENT_OPTION_PREFIX);
}

export function normalizeUserUnselectedRequirementOptionIds(value: unknown) {
  const rawValues = Array.isArray(value) ? value : value == null ? [] : [value];
  return unique(
    rawValues
      .map((entry) => String(entry ?? "").trim())
      .filter((entry) => entry.startsWith(USER_UNSELECTED_REQUIREMENT_OPTION_PREFIX))
      .map((entry) => entry.slice(USER_UNSELECTED_REQUIREMENT_OPTION_PREFIX.length).trim())
      .filter(Boolean)
  );
}

export function normalizeSelectedRequirementOptionIds(value: unknown) {
  const rawValues = Array.isArray(value) ? value : value == null ? [] : [value];
  return unique(
    rawValues
      .map((entry) => String(entry ?? "").trim())
      .filter((entry) => !isUserUnselectedRequirementOptionMarker(entry))
      .filter(Boolean)
  );
}

export function getRequirementOptionId(
  item: TransferPlannerChecklistItem,
  option: RequirementGroupOption,
  optionIndex: number
) {
  return (
    String(option.id ?? "").trim() ||
    `${getRequirementOptionSelectionKey(item)}:requirement-option:${optionIndex + 1}`
  );
}

export function getRequirementOptionCreditValue(option: RequirementGroupOption) {
  const credits = option.credits ?? 0;
  if (!Number.isFinite(credits) || credits <= 0) {
    return 0;
  }

  const maxCredits = option.maxCredits ?? null;
  if (maxCredits != null && Number.isFinite(maxCredits) && maxCredits > 0) {
    return Math.min(credits, maxCredits);
  }

  return credits;
}

type ChooseCreditsOptionMatchCandidate = {
  courseCodes: string[];
  allowCourseReuse: boolean;
  preferTranscriptCredits: boolean;
  creditValue: number;
  creditMaxValue: number;
};

function normalizeCandidateCourseCodes(courseCodes: string[]) {
  return unique(courseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean));
}

function getSourceCourseCandidateSets(option: RequirementGroupOption) {
  const sourceCodes = normalizeCandidateCourseCodes([
    ...(option.uwCourses ?? []),
    ...(option.equivalentUwCourseCodes ?? []),
  ]);
  if (!sourceCodes.length) {
    return [];
  }

  const displayText = (option.displayCourseCodes ?? []).join(" ");
  const hasAlternativeSignal =
    (option.equivalentUwCourseCodes ?? []).length > 0 ||
    /\b(?:or|either)\b|\/|\b(?:same\s+as|cross-listed)\b/i.test(displayText);

  return hasAlternativeSignal && sourceCodes.length > 1
    ? sourceCodes.map((courseCode) => [courseCode])
    : [sourceCodes];
}

function getChooseCreditsOptionMatchCandidates(option: RequirementGroupOption) {
  const candidates: ChooseCreditsOptionMatchCandidate[] = [];
  const seenCandidateKeys = new Set<string>();
  const optionCreditValue = getRequirementOptionCreditValue(option);
  const addCandidate = (
    courseCodes: string[],
    options: {
      allowCourseReuse?: boolean;
      preferTranscriptCredits?: boolean;
    } = {}
  ) => {
    const normalizedCodes = normalizeCandidateCourseCodes(courseCodes);
    if (!normalizedCodes.length) {
      return;
    }

    const key = normalizedCodes.join("|");
    if (seenCandidateKeys.has(key)) {
      return;
    }
    seenCandidateKeys.add(key);
    candidates.push({
      courseCodes: normalizedCodes,
      allowCourseReuse: Boolean(options.allowCourseReuse),
      preferTranscriptCredits: Boolean(options.preferTranscriptCredits),
      creditValue: optionCreditValue,
      creditMaxValue: Math.max(
        optionCreditValue,
        Number(option.creditMax ?? 0),
        Number(option.maxCredits ?? 0)
      ),
    });
  };

  for (const component of option.compoundComponents ?? []) {
    addCandidate(component, {
      allowCourseReuse: component.length > 1,
      preferTranscriptCredits: false,
    });
  }

  for (const grcMatch of getRequirementOptionMappedGrcCourseLabels(option)) {
    addCandidate(extractCourseCodes(grcMatch), {
      allowCourseReuse: false,
      preferTranscriptCredits: false,
    });
  }

  for (const sourceCandidateSet of getSourceCourseCandidateSets(option)) {
    addCandidate(sourceCandidateSet, {
      allowCourseReuse: false,
      preferTranscriptCredits: true,
    });
  }

  return candidates;
}

function getMatchedChooseCreditsOptionCandidate(
  candidates: ChooseCreditsOptionMatchCandidate[],
  completedByCode: Map<string, TranscriptCourseEntry>,
  usedCompletedCourseCodes: Set<string>
) {
  for (const candidate of candidates) {
    const matchedCourses = candidate.courseCodes
      .map((courseCode) => completedByCode.get(courseCode) ?? null)
      .filter((course): course is TranscriptCourseEntry => Boolean(course));
    if (matchedCourses.length !== candidate.courseCodes.length) {
      continue;
    }
    if (
      !candidate.allowCourseReuse &&
      matchedCourses.some((course) => usedCompletedCourseCodes.has(course.code))
    ) {
      continue;
    }

    return {
      candidate,
      matchedCourses,
    };
  }

  return null;
}

function getMatchedChooseCreditsValue(
  candidate: ChooseCreditsOptionMatchCandidate,
  matchedCourses: TranscriptCourseEntry[],
  expectedOptionCreditValue: number | null
) {
  const transcriptCredits = matchedCourses.reduce((sum, course) => {
    const credits = Number(course.credits ?? 0);
    return Number.isFinite(credits) && credits > 0 ? sum + credits : sum;
  }, 0);

  if (candidate.preferTranscriptCredits && transcriptCredits > 0) {
    return transcriptCredits;
  }

  if (
    expectedOptionCreditValue != null &&
    expectedOptionCreditValue > candidate.creditValue &&
    expectedOptionCreditValue <= candidate.creditMaxValue
  ) {
    return expectedOptionCreditValue;
  }

  if (candidate.creditValue > 0) {
    return candidate.creditValue;
  }

  return transcriptCredits;
}

export function getChecklistCourseOptions(item: TransferPlannerChecklistItem) {
  const baseOptions = [item.grcCourses, ...(item.alternatives ?? [])]
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

  const requirementGroupOptionLabels = unique(
    (item.requirementGroup?.options ?? [])
      .flatMap((option) => getRequirementOptionCourseLabels(option))
      .map((label) => String(label ?? "").trim())
      .filter(Boolean)
  );

  if (item.requirementGroup?.requirementType !== "choose_one") {
    return baseOptions.length || !requirementGroupOptionLabels.length
      ? baseOptions
      : [requirementGroupOptionLabels];
  }

  const hasMultiCourseGrcOption = (item.requirementGroup.options ?? []).some(
    (option) =>
      unique(
        (option.grcMatches ?? []).flatMap((label) => extractCourseCodes(label))
      ).length > 1
  );
  if (hasMultiCourseGrcOption) {
    return baseOptions;
  }

  if (!requirementGroupOptionLabels.length) {
    return baseOptions;
  }

  return uniqueBy(
    [...baseOptions, requirementGroupOptionLabels],
    (courseLabels) => courseLabels.join("||")
  );
}

export function buildRequirementCourseOption(
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

export function buildFullSequenceRequirementCourseOption(
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
  const matchedCodes = new Set(matchedCourses.map((course) => course.code));

  return {
    courseLabels,
    explicitCourseCodes,
    matchedCourses,
    requiredCompletedCount: explicitCourseCodes.length,
    matched: explicitCourseCodes.length > 0 && matchedCourses.length >= explicitCourseCodes.length,
    remainingCourseCodes: explicitCourseCodes.filter((code) => !matchedCodes.has(code)),
    index,
  };
}

export function buildSequenceChoiceRequirementStatus(
  item: TransferPlannerChecklistItem,
  completedByCode: Map<string, TranscriptCourseEntry>
): TransferRequirementStatus | null {
  const group = item.requirementGroup;
  if (!group || group.requirementType !== "sequence_choice") {
    return null;
  }

  const defaultOptionIds = new Set(
    normalizeSelectedRequirementOptionIds(item.selectedRequirementOptionIds)
  );
  const sequenceOptions = (group.options ?? [])
    .map((option, optionIndex) => {
      const courseLabels = getRequirementOptionCourseLabels(option);
      if (!courseLabels.length) {
        return null;
      }

      return {
        option,
        optionId: getRequirementOptionId(item, option, optionIndex),
        optionIndex,
        status: buildFullSequenceRequirementCourseOption(
          courseLabels,
          optionIndex,
          completedByCode
        ),
      };
    })
    .filter(
      (
        entry
      ): entry is {
        option: RequirementGroupOption;
        optionId: string;
        optionIndex: number;
        status: RequirementCourseOption;
      } => Boolean(entry)
    );

  if (!sequenceOptions.length) {
    return null;
  }

  const selectedOption =
    [...sequenceOptions].sort((left, right) => {
      const matchedStatusDelta = Number(right.status.matched) - Number(left.status.matched);
      if (matchedStatusDelta !== 0) return matchedStatusDelta;

      const matchedDelta =
        right.status.matchedCourses.length - left.status.matchedCourses.length;
      if (matchedDelta !== 0) return matchedDelta;

      const defaultDelta =
        Number(defaultOptionIds.has(right.optionId)) - Number(defaultOptionIds.has(left.optionId));
      if (defaultDelta !== 0) return defaultDelta;

      const remainingDelta =
        left.status.remainingCourseCodes.length - right.status.remainingCourseCodes.length;
      if (remainingDelta !== 0) return remainingDelta;

      const sizeDelta =
        left.status.explicitCourseCodes.length - right.status.explicitCourseCodes.length;
      if (sizeDelta !== 0) return sizeDelta;

      return left.optionIndex - right.optionIndex;
    })[0] ?? null;

  if (!selectedOption) {
    return null;
  }

  return {
    item,
    matched: selectedOption.status.matched,
    matchedCourses: selectedOption.status.matchedCourses,
    explicitCourseCodes: selectedOption.status.explicitCourseCodes,
    requiredCompletedCount: selectedOption.status.requiredCompletedCount,
  };
}

export function buildChooseCreditsRequirementStatus(
  item: TransferPlannerChecklistItem,
  completedByCode: Map<string, TranscriptCourseEntry>
): TransferRequirementStatus | null {
  const group = item.requirementGroup;
  if (!group || group.requirementType !== "choose_credits") {
    return null;
  }

  const requiredCreditCount = item.minCredits ?? group.minCredits ?? null;
  const maxCreditCount = item.maxCredits ?? group.maxCredits ?? null;
  if (completedByCode.size === 0) {
    const explicitCourseCodes = unique(
      (group.options ?? []).flatMap((option) =>
        getRequirementOptionCourseLabels(option).flatMap((label) => extractCourseCodes(label))
      )
    );
    const creditProgressLabel =
      requiredCreditCount != null && requiredCreditCount > 0
        ? `0/${requiredCreditCount} credits completed`
        : maxCreditCount != null && maxCreditCount > 0
          ? `0/${maxCreditCount} credits counted`
          : null;

    return {
      item,
      matched: requiredCreditCount != null && requiredCreditCount > 0 ? false : true,
      matchedCourses: [],
      explicitCourseCodes,
      requiredCompletedCount: requiredCreditCount != null && requiredCreditCount > 0 ? 1 : 0,
      completedCredits: 0,
      requiredCreditCount,
      maxCreditCount,
      creditProgressLabel,
    };
  }

  const optionsWithCandidates = (group.options ?? []).map((option) => ({
    option,
    candidates: getChooseCreditsOptionMatchCandidates(option),
  }));
  const explicitCourseCodes = unique(
    optionsWithCandidates
      .flatMap((entry) => entry.candidates.flatMap((candidate) => candidate.courseCodes))
      .filter(Boolean)
  );
  const matchedCourses: TranscriptCourseEntry[] = [];
  const usedCompletedCourseCodes = new Set<string>();
  const reportedMatchedCourseCodes = new Set<string>();
  let completedCredits = 0;
  const expectedOptionCreditValue =
    requiredCreditCount != null && requiredCreditCount > 0 && (group.options ?? []).length > 0
      ? requiredCreditCount / (group.options ?? []).length
      : null;

  for (const { candidates } of optionsWithCandidates) {
    const matchedOption = getMatchedChooseCreditsOptionCandidate(
      candidates,
      completedByCode,
      usedCompletedCourseCodes
    );
    if (!matchedOption) {
      continue;
    }

    for (const matchedCourse of matchedOption.matchedCourses) {
      if (!matchedOption.candidate.allowCourseReuse) {
        usedCompletedCourseCodes.add(matchedCourse.code);
      }
      if (!reportedMatchedCourseCodes.has(matchedCourse.code)) {
        reportedMatchedCourseCodes.add(matchedCourse.code);
        matchedCourses.push(matchedCourse);
      }
    }
    completedCredits += getMatchedChooseCreditsValue(
      matchedOption.candidate,
      matchedOption.matchedCourses,
      expectedOptionCreditValue
    );
  }

  const cappedCompletedCredits =
    maxCreditCount != null && maxCreditCount > 0
      ? Math.min(completedCredits, maxCreditCount)
      : completedCredits;
  const matched =
    requiredCreditCount != null && requiredCreditCount > 0
      ? cappedCompletedCredits >= requiredCreditCount
      : true;
  const creditProgressLabel =
    requiredCreditCount != null && requiredCreditCount > 0
      ? `${cappedCompletedCredits}/${requiredCreditCount} credits completed`
      : maxCreditCount != null && maxCreditCount > 0
        ? `${cappedCompletedCredits}/${maxCreditCount} credits counted`
        : null;

  return {
    item,
    matched,
    matchedCourses,
    explicitCourseCodes,
    requiredCompletedCount: requiredCreditCount != null && requiredCreditCount > 0 ? 1 : 0,
    completedCredits: cappedCompletedCredits,
    requiredCreditCount,
    maxCreditCount,
    creditProgressLabel,
  };
}

export function selectPreferredRequirementOption(options: RequirementCourseOption[]) {
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
    const admissionPrerequisiteCourse = findCompletedAdmissionPrerequisiteCourse(
      item,
      completedCourses
    );
    if (admissionPrerequisiteCourse) {
      return {
        item,
        matched: true,
        matchedCourses: [admissionPrerequisiteCourse],
        explicitCourseCodes: [admissionPrerequisiteCourse.code],
        requiredCompletedCount: 1,
      };
    }

    const creditStatus = buildChooseCreditsRequirementStatus(item, completedByCode);
    if (creditStatus) {
      return creditStatus;
    }

    const sequenceStatus = buildSequenceChoiceRequirementStatus(item, completedByCode);
    if (sequenceStatus) {
      return sequenceStatus;
    }

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
