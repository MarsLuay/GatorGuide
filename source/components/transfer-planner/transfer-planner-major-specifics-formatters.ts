
import {
  getTransferPlannerCanonicalCourse,
  getTransferPlannerEquivalencyRulesForSourceCourse,
  type TransferPlannerCampusId,
  type TransferPlannerGeneralRequirementSection,
  type TransferPlannerResolvedMajorPlan,
  type TransferPlannerStudentCourseEvaluation,
  type TransferPlannerTrack,
} from "@/constants/transfer-planner-source/student-runtime";
import {
  buildSourceBackedMajorGeneralEducationRequirementSection,
  buildSourceBackedGeneralEducationRequirementTargets,
  buildSourceBackedRequiredCourseCodes,
  buildSourceBackedRequiredCourseSummaryEntries,
  buildSourceBackedUwCourseConsideredSummaryEntries,
  extractCourseCodes,
  getPreparatoryTrackCourseCodeSet,
  getResolvedTrackTermsForRequirementDisplay,
  isMergedCourseDistributionRequirementLabel,
  type TranscriptCourseEntry,
} from "@/services/planning/transfer-planner.service";

import { getSuggestedScheduleCourseDisplayLabel } from "./transfer-planner-suggested-schedule";

type Translate = (key: string, params?: Record<string, string | number>) => string;

export function getEvaluationOutcomeBadgeLabel(
  outcome: TransferPlannerStudentCourseEvaluation["outcome"],
  t?: Translate
) {
  switch (outcome) {
    case "auto-approved":
      return t ? t("transferPlanner.outcomeApplies") : "Applies";
    case "legacy-rule-used":
      return t ? t("transferPlanner.outcomeLegacy") : "Legacy";
    case "elective-credit":
      return t ? t("transferPlanner.outcomeElective") : "Elective";
    case "sequence-incomplete":
      return t ? t("transferPlanner.outcomeSequence") : "Sequence";
    case "no-credit":
      return t ? t("transferPlanner.outcomeNoCredit") : "No credit";
    case "not-applicable-to-major":
      return t ? t("transferPlanner.outcomeNotUsed") : "Not used";
    case "source-unverified-hidden":
      return t ? t("transferPlanner.outcomeHidden") : "Hidden";
  }
}

export function getEvaluationOutcomeBadgeClass(outcome: TransferPlannerStudentCourseEvaluation["outcome"]) {
  switch (outcome) {
    case "auto-approved":
      return "bg-emerald-500/10 border-emerald-500/20";
    case "legacy-rule-used":
    case "sequence-incomplete":
      return "bg-amber-500/10 border-amber-500/20";
    case "elective-credit":
      return "bg-sky-500/10 border-sky-500/20";
    case "no-credit":
      return "bg-red-500/10 border-red-500/20";
    case "not-applicable-to-major":
    case "source-unverified-hidden":
      return "bg-white/5 border-white/10";
  }
}

export function getEvaluationOutcomeTextClass(
  outcome: TransferPlannerStudentCourseEvaluation["outcome"],
  fallbackTextClass: string
) {
  switch (outcome) {
    case "auto-approved":
      return "text-emerald-500";
    case "legacy-rule-used":
    case "sequence-incomplete":
      return "text-amber-500";
    case "elective-credit":
      return "text-sky-400";
    case "no-credit":
      return "text-red-400";
    case "not-applicable-to-major":
    case "source-unverified-hidden":
      return fallbackTextClass;
  }
}

export function normalizeRequirementTag(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

export function getRequirementTagLabel(normalizedTag: string) {
  switch (normalizedTag) {
    case "AH":
      return "A&H";
    case "SSC":
      return "SSc";
    case "NSC":
      return "NSc";
    case "QSR":
      return "QSR";
    case "VLPA":
      return "VLPA";
    case "DIV":
      return "DIV";
    case "NW":
      return "NW";
    case "IANDS":
      return "I&S";
    default:
      return normalizedTag;
  }
}

export function getRequirementTagSearchLabels(normalizedTag: string) {
  switch (normalizedTag) {
    case "AH":
      return ["A&H", "Arts and Humanities", "Humanities"];
    case "SSC":
      return ["SSc", "Social Sciences", "Social Science"];
    case "NSC":
      return ["NSc", "Natural Sciences", "Natural Science"];
    case "QSR":
      return ["QSR", "Quantitative and Symbolic Reasoning"];
    case "VLPA":
      return ["VLPA", "Visual, Literary, and Performing Arts"];
    case "DIV":
      return ["DIV", "Diversity"];
    case "NW":
      return ["NW", "Natural World"];
    case "IANDS":
      return ["I&S", "Individuals and Societies"];
    default:
      return [getRequirementTagLabel(normalizedTag)];
  }
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function inferRequirementCreditTotalFromText(text: string, normalizedTag: string) {
  const tagSearchLabels = Array.from(new Set(getRequirementTagSearchLabels(normalizedTag)));

  for (const tagLabel of tagSearchLabels) {
    const escapedTag = escapeRegExp(tagLabel);
    const patterns = [
      new RegExp(`${escapedTag}[^\\n]{0,80}?(\\d+(?:\\.\\d+)?)\\s*credits`, "i"),
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*credits[^\\n]{0,80}?${escapedTag}`, "i"),
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) continue;

      const parsed = Number.parseFloat(match[1] ?? "");
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

export function normalizePlannerCourseCode(value: string) {
  const normalized = String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^([A-Z&]+(?: [A-Z&]+)*) (\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (!match) {
    return normalized;
  }

  const subjectTokens = match[1].split(" ").filter(Boolean);
  const normalizedSubject = subjectTokens.every((token) => token.length === 1)
    ? subjectTokens.join("")
    : subjectTokens.join(" ");

  return `${normalizedSubject} ${match[2]}`;
}

export function getPlanDegreeMapSearchText(plan: TransferPlannerResolvedMajorPlan) {
  return (plan.degreeMapSections ?? [])
    .flatMap((section) => [section.title, section.note ?? "", ...section.items])
    .join("\n");
}

export type MajorSpecificsGeneralEducationCategoryId =
  | "ah"
  | "ssc"
  | "nsc"
  | "breadth"
  | "div"
  | "qsr"
  | "vlpa"
  | "nw"
  | "iands";

export type MajorSpecificsGeneralEducationCreditLine = {
  id: MajorSpecificsGeneralEducationCategoryId;
  label: string;
  credits: number;
};

export const MAJOR_SPECIFICS_GENERAL_ED_CATEGORIES: {
  id: MajorSpecificsGeneralEducationCategoryId;
  labelKey: string;
}[] = [
  { id: "ah", labelKey: "transferPlanner.generalEducationAh" },
  { id: "ssc", labelKey: "transferPlanner.generalEducationSsc" },
  { id: "nsc", labelKey: "transferPlanner.generalEducationNsc" },
  { id: "breadth", labelKey: "transferPlanner.generalEducationBreadth" },
  { id: "div", labelKey: "transferPlanner.generalEducationDiv" },
  { id: "qsr", labelKey: "transferPlanner.generalEducationQsr" },
  { id: "vlpa", labelKey: "transferPlanner.generalEducationVlpa" },
  { id: "nw", labelKey: "transferPlanner.generalEducationNw" },
  { id: "iands", labelKey: "transferPlanner.generalEducationIands" },
];

function getMajorSpecificsGeneralEducationCategoryLabel(
  entry: (typeof MAJOR_SPECIFICS_GENERAL_ED_CATEGORIES)[number],
  t?: Translate
) {
  if (t) return t(entry.labelKey);

  switch (entry.id) {
    case "ah":
      return "Arts & Humanities Classes";
    case "ssc":
      return "Social Science Classes";
    case "nsc":
      return "Natural Science Classes";
    case "breadth":
      return "Flexible Breadth Classes";
    case "div":
      return "Diversity Classes";
    case "qsr":
      return "Quantitative & Symbolic Reasoning Classes";
    case "vlpa":
      return "Visual, Literary & Performing Arts Classes";
    case "nw":
      return "Natural World Classes";
    case "iands":
      return "Individuals & Societies Classes";
  }
}

export type MajorSpecificsGeneralEducationCreditTotals = Record<
  MajorSpecificsGeneralEducationCategoryId,
  number
>;

export function createEmptyMajorSpecificsGeneralEducationCreditTotals(): MajorSpecificsGeneralEducationCreditTotals {
  return {
    ah: 0,
    ssc: 0,
    nsc: 0,
    breadth: 0,
    div: 0,
    qsr: 0,
    vlpa: 0,
    nw: 0,
    iands: 0,
  };
}

export function buildMajorSpecificsGeneralEducationCreditLinesFromTotals(
  totals: MajorSpecificsGeneralEducationCreditTotals,
  t?: Translate
): MajorSpecificsGeneralEducationCreditLine[] {
  return MAJOR_SPECIFICS_GENERAL_ED_CATEGORIES.map((entry) => ({
    id: entry.id,
    label: getMajorSpecificsGeneralEducationCategoryLabel(entry, t),
    credits: totals[entry.id] ?? 0,
  })).filter((entry) => entry.credits > 0);
}

export function inferMajorSpecificsGeneralEducationCreditsFromTrackLabel(courseLabel: string) {
  const normalizedLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedLabel) return 0;

  const explicitCreditsMatch = normalizedLabel.match(/(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b/i);
  if (explicitCreditsMatch) {
    const parsedCredits = Number.parseFloat(explicitCreditsMatch[1] ?? "");
    if (Number.isFinite(parsedCredits) && parsedCredits > 0) {
      return parsedCredits;
    }
  }

  if (/^\d+\s+[A-Z]\s*[-:]/i.test(normalizedLabel)) {
    return 5;
  }

  const repeatedCourseCountMatch = normalizedLabel.match(/^(\d+)\s+[A-Z]\b/i);
  if (repeatedCourseCountMatch) {
    const parsedCourseCount = Number.parseInt(repeatedCourseCountMatch[1] ?? "", 10);
    if (Number.isFinite(parsedCourseCount) && parsedCourseCount > 0) {
      return parsedCourseCount * 5;
    }
  }

  if (/^[A-Z]\s*\d+\b/i.test(normalizedLabel)) {
    return 5;
  }

  if (
    /\b(?:humanit|fine arts|arts and humanities|social sciences?|natural sciences?|diversity|qsr|quantitative|vlpa|visual,\s*literary|natural world|individuals?\s+and\s+societies|i&s)\b/i.test(
      normalizedLabel
    )
  ) {
    return 5;
  }

  return 0;
}

export function getMajorSpecificsGeneralEducationCategoryIdsForTrackLabel(
  courseLabel: string
): MajorSpecificsGeneralEducationCategoryId[] {
  const normalizedLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedLabel || extractCourseCodes(normalizedLabel).length > 0) {
    return [];
  }

  if (
    /^(?:suggested|recommend|consider|see\b|discuss\b|students?\s+are\s+responsible\b|green river college is fully accredited\b)/i.test(
      normalizedLabel
    )
  ) {
    return [];
  }

  const lower = normalizedLabel.toLowerCase();
  const categories = new Set<MajorSpecificsGeneralEducationCategoryId>();
  const hasHumanities =
    lower.includes("humanit") ||
    lower.includes("fine arts") ||
    lower.includes("arts and humanities") ||
    /\ba&h\b/i.test(normalizedLabel) ||
    /^\s*h\s*\d+\b/i.test(normalizedLabel);
  const hasSocialScience =
    lower.includes("social science") ||
    /\bssc\b/i.test(normalizedLabel) ||
    /^\s*s\s*\d+\b/i.test(normalizedLabel);
  const hasNaturalScience =
    lower.includes("natural science") ||
    /\bnsc\b/i.test(normalizedLabel) ||
    /^\s*n\s*\d+\b/i.test(normalizedLabel);
  const hasFlexibleBreadth =
    /(?:\badditional areas?\s+of inquiry\b|\bor\b)/i.test(normalizedLabel) &&
    [hasHumanities, hasSocialScience, hasNaturalScience].filter(Boolean).length >= 2;

  if (hasFlexibleBreadth) {
    categories.add("breadth");
  } else {
    if (hasHumanities) categories.add("ah");
    if (hasSocialScience) categories.add("ssc");
    if (hasNaturalScience) categories.add("nsc");
  }

  if (
    /^\s*d\s*\d+\b/i.test(normalizedLabel) ||
    /\bdiversity\b[^.]{0,48}\b(?:requirement|required|minimum|must|need)\b/i.test(normalizedLabel) ||
    /\b\d+\s*(?:credits?|cr)\b[^.]{0,48}\bdiversity\b/i.test(normalizedLabel)
  ) {
    categories.add("div");
  }

  if (
    /\bqsr\b/i.test(normalizedLabel) ||
    /quantitative(?:\s+and)?\s+symbolic reasoning/i.test(normalizedLabel)
  ) {
    categories.add("qsr");
  }

  if (
    /\bvlpa\b/i.test(normalizedLabel) ||
    /visual,\s*literary(?:,\s*and)?\s+performing arts/i.test(normalizedLabel)
  ) {
    categories.add("vlpa");
  }

  if (/\bnw\b/i.test(normalizedLabel) || /natural world/i.test(normalizedLabel)) {
    categories.add("nw");
  }

  if (/\bi&s\b/i.test(normalizedLabel) || /individuals?\s+and\s+societies/i.test(normalizedLabel)) {
    categories.add("iands");
  }

  return Array.from(categories);
}

export function buildMajorSpecificsSourceBackedUwGeneralEducationCreditLines(
  plan: TransferPlannerResolvedMajorPlan,
  t?: Translate
) {
  const searchableText = getPlanDegreeMapSearchText(plan);
  const parsedTargets = buildSourceBackedGeneralEducationRequirementTargets(plan);
  const totals = createEmptyMajorSpecificsGeneralEducationCreditTotals();

  totals.ah = parsedTargets.ahCredits ?? inferRequirementCreditTotalFromText(searchableText, "AH") ?? 0;
  totals.ssc = parsedTargets.sscCredits ?? inferRequirementCreditTotalFromText(searchableText, "SSC") ?? 0;
  totals.nsc = parsedTargets.nscCredits ?? inferRequirementCreditTotalFromText(searchableText, "NSC") ?? 0;
  totals.breadth = parsedTargets.breadthCredits ?? 0;
  totals.div = inferRequirementCreditTotalFromText(searchableText, "DIV") ?? 0;
  totals.qsr = inferRequirementCreditTotalFromText(searchableText, "QSR") ?? 0;
  totals.vlpa = inferRequirementCreditTotalFromText(searchableText, "VLPA") ?? 0;
  totals.nw = inferRequirementCreditTotalFromText(searchableText, "NW") ?? 0;
  totals.iands = inferRequirementCreditTotalFromText(searchableText, "IANDS") ?? 0;

  return buildMajorSpecificsGeneralEducationCreditLinesFromTotals(totals, t);
}

export function buildInferredMajorSpecificsSupplementalUwGeneralEducationItems(
  plan: TransferPlannerResolvedMajorPlan,
  t?: Translate
): TransferPlannerGeneralRequirementSection["items"] {
  const searchableText = getPlanDegreeMapSearchText(plan);
  const totals = createEmptyMajorSpecificsGeneralEducationCreditTotals();
  totals.div = inferRequirementCreditTotalFromText(searchableText, "DIV") ?? 0;
  totals.qsr = inferRequirementCreditTotalFromText(searchableText, "QSR") ?? 0;
  totals.vlpa = inferRequirementCreditTotalFromText(searchableText, "VLPA") ?? 0;
  totals.nw = inferRequirementCreditTotalFromText(searchableText, "NW") ?? 0;
  totals.iands = inferRequirementCreditTotalFromText(searchableText, "IANDS") ?? 0;

  return buildMajorSpecificsGeneralEducationCreditLinesFromTotals(totals, t).map((entry) => ({
    id: entry.id,
    label: entry.label,
    valueText: t
      ? t("transferPlanner.creditsCount", { count: entry.credits })
      : `${entry.credits} credits`,
    note: undefined,
    sourceKind: "source-backed-major" as const,
  }));
}

export function buildMajorSpecificsSourceBackedUwGeneralEducationSection(
  plan: TransferPlannerResolvedMajorPlan,
  t?: Translate
) {
  const sourceBackedSection = buildSourceBackedMajorGeneralEducationRequirementSection(plan);
  const supplementalItems = buildInferredMajorSpecificsSupplementalUwGeneralEducationItems(plan, t);
  const mergedItems = [
    ...(sourceBackedSection?.items ?? []),
    ...supplementalItems.filter(
      (item) => !(sourceBackedSection?.items ?? []).some((existingItem) => existingItem.id === item.id)
    ),
  ];

  if (!mergedItems.length) {
    return null;
  }

  return {
    id: sourceBackedSection?.id ?? "source-backed-major-general-education",
    title: sourceBackedSection?.title ?? (t ? t("transferPlanner.majorRequiredGenEds") : "Major Required Gen-Eds"),
    summary:
      sourceBackedSection?.summary ??
      (t
        ? t("transferPlanner.majorRequiredGenEdsDescription")
        : "Source-backed major-specific general education targets from the current official major materials."),
    campusId: sourceBackedSection?.campusId ?? plan.campusId,
    sourceKind: sourceBackedSection?.sourceKind ?? ("source-backed-major" as const),
    plannerUsage: sourceBackedSection?.plannerUsage ?? ("summary-only" as const),
    items: mergedItems,
  } satisfies TransferPlannerGeneralRequirementSection;
}

export function buildCopyOnlyGenEdSourceDebugText(input: {
  plannerMode: string;
  sourceBackedTargetCount: number;
  hiddenMatchedGrcTrackBreadthRowCount: number;
}) {
  return [
    "[copy-only gen-ed source debug]",
    `Planner mode: ${input.plannerMode}`,
    `UW source-backed targets: ${input.sourceBackedTargetCount}`,
    `Matched GRC track breadth rows hidden from UW gen-ed section: ${input.hiddenMatchedGrcTrackBreadthRowCount}`,
  ].join(" ");
}

export function buildMajorSpecificsGrcGeneralEducationCreditLines(args: {
  plan: TransferPlannerResolvedMajorPlan | null;
  track: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
  t?: Translate;
}) {
  const { plan, track, completedCourses, t } = args;
  if (!track) {
    return plan ? buildMajorSpecificsSourceBackedUwGeneralEducationCreditLines(plan, t) : [];
  }

  const totals = createEmptyMajorSpecificsGeneralEducationCreditTotals();
  const resolvedTerms = getResolvedTrackTermsForRequirementDisplay(track, completedCourses).filter(
    (term) => !GRC_TRACK_NOTE_TERM_LABEL_PATTERN.test(String(term.label ?? "").trim())
  );

  for (const courseLabel of resolvedTerms.flatMap((term) => term.courses)) {
    const categoryIds = getMajorSpecificsGeneralEducationCategoryIdsForTrackLabel(courseLabel);
    if (!categoryIds.length) continue;

    const credits = inferMajorSpecificsGeneralEducationCreditsFromTrackLabel(courseLabel);
    if (!credits) continue;

    for (const categoryId of categoryIds) {
      totals[categoryId] += credits;
    }
  }

  return buildMajorSpecificsGeneralEducationCreditLinesFromTotals(totals, t);
}

export function buildCourseDisplayLabel(
  schoolId: "grc" | TransferPlannerCampusId,
  courseCodeOrLabel: string
) {
  const rawValue = String(courseCodeOrLabel ?? "").trim();
  if (!rawValue) return "";
  if (rawValue.includes(" - ")) return rawValue;

  const extractedCourseCode = extractCourseCodes(rawValue)[0] ?? rawValue;
  const normalizedCourseCode = normalizePlannerCourseCode(extractedCourseCode);
  const canonicalCourse = getTransferPlannerCanonicalCourse(schoolId, normalizedCourseCode);
  if (canonicalCourse?.title) {
    return `${normalizedCourseCode} - ${canonicalCourse.title}`;
  }

  return rawValue === normalizedCourseCode ? rawValue : normalizedCourseCode;
}

export function appendUniqueCourseCode(
  orderedCourseCodes: string[],
  seenCourseCodes: Set<string>,
  courseCode: string
) {
  const normalizedCourseCode = normalizePlannerCourseCode(courseCode);
  if (!normalizedCourseCode || seenCourseCodes.has(normalizedCourseCode)) return;
  seenCourseCodes.add(normalizedCourseCode);
  orderedCourseCodes.push(normalizedCourseCode);
}

export function appendUniqueCourseCodesFromLabels(
  orderedCourseCodes: string[],
  seenCourseCodes: Set<string>,
  labels: string[]
) {
  for (const label of labels) {
    const extractedCourseCodes = extractCourseCodes(label);
    if (extractedCourseCodes.length) {
      for (const courseCode of extractedCourseCodes) {
        appendUniqueCourseCode(orderedCourseCodes, seenCourseCodes, courseCode);
      }
      continue;
    }

    appendUniqueCourseCode(orderedCourseCodes, seenCourseCodes, label);
  }
}

export function buildMajorSpecificsFallbackGrcCourseLabels(plan: TransferPlannerResolvedMajorPlan) {
  const orderedLabels: string[] = [];
  const seenLabels = new Set<string>();
  const addLabel = (label: string) => {
    const normalizedLabel = String(label ?? "").trim();
    if (!normalizedLabel || seenLabels.has(normalizedLabel)) return;
    seenLabels.add(normalizedLabel);
    orderedLabels.push(normalizedLabel);
  };

  for (const courseLabel of plan.grcCourseList ?? []) {
    addLabel(buildCourseDisplayLabel("grc", courseLabel));
  }

  if (orderedLabels.length) {
    return orderedLabels;
  }

  const fallbackCourseCodes: string[] = [];
  const seenCourseCodes = new Set<string>();
  const checklistItems = [...plan.applicationChecklist, ...plan.beforeEnrollmentChecklist];
  for (const item of checklistItems) {
    appendUniqueCourseCodesFromLabels(fallbackCourseCodes, seenCourseCodes, item.grcCourses ?? []);
  }

  return fallbackCourseCodes.map((courseCode) => buildCourseDisplayLabel("grc", courseCode));
}

export const GRC_TRACK_NOTE_TERM_LABEL_PATTERN = /\btransferability of credits\b/i;

export function buildRequiredCourseSentence(courseLabel: string) {
  const normalizedCourseLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
  return normalizedCourseLabel ? `${normalizedCourseLabel} is required.` : "";
}

export function getTrackGroupedChoiceSelectionCount(
  choice: NonNullable<TransferPlannerTrack["groupedChoices"]>[number]
) {
  const selectionCount = Number(choice.selectionCount ?? 1);
  if (!Number.isFinite(selectionCount) || selectionCount <= 0) {
    return 1;
  }
  return Math.max(1, Math.min(Math.ceil(selectionCount), choice.options.length || 1));
}

export function getTrackGroupedChoiceShortLabel(label: string) {
  return (
    String(label ?? "")
      .split(">")
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1) ?? "Green River track option"
  );
}

export function buildTrackGroupedChoiceRequiredCourseLine(
  choice: NonNullable<TransferPlannerTrack["groupedChoices"]>[number]
) {
  const selectionCount = getTrackGroupedChoiceSelectionCount(choice);
  const optionLabels = choice.options.map((option) => option.label).filter(Boolean);
  const previewOptions = optionLabels.slice(0, 10);
  const hiddenOptionCount = Math.max(optionLabels.length - previewOptions.length, 0);
  const optionsText = previewOptions.length
    ? `${previewOptions.join("; ")}${hiddenOptionCount > 0 ? `; plus ${hiddenOptionCount} more` : ""}`
    : "approved options";
  const actionText =
    selectionCount === 1
      ? "Choose one approved option"
      : `Choose ${selectionCount} approved options`;
  const defaultOptionLabels = (choice.defaultOptionIds ?? [])
    .map((optionId) => choice.options.find((option) => option.id === optionId)?.label ?? "")
    .filter(Boolean);
  const defaultText = defaultOptionLabels.length
    ? ` Default sample-map option${defaultOptionLabels.length === 1 ? "" : "s"}: ${defaultOptionLabels.join("; ")}.`
    : "";
  const creditText = choice.requiredCredits ? ` (${choice.requiredCredits} credits)` : "";

  return {
    id: choice.id,
    text: `${getTrackGroupedChoiceShortLabel(choice.label)}${creditText}: ${actionText}. Options: ${optionsText}.${defaultText}`,
  };
}

export function isTrackCourseLabelCoveredByGroupedChoice(
  label: string,
  groupedChoices: NonNullable<TransferPlannerTrack["groupedChoices"]>
) {
  const courseCodes = extractCourseCodes(label).map((courseCode) =>
    normalizePlannerCourseCode(courseCode)
  );
  if (!courseCodes.length || !groupedChoices.length) {
    return false;
  }

  return groupedChoices.some((choice) => {
    const choiceCourseCodes = new Set(
      choice.options
        .flatMap((option) => [...(option.courseCodes ?? []), ...(option.courseLabels ?? []).flatMap(extractCourseCodes)])
        .map((courseCode) => normalizePlannerCourseCode(courseCode))
        .filter(Boolean)
    );
    if (!choiceCourseCodes.size) {
      return false;
    }

    return courseCodes.some((courseCode) => choiceCourseCodes.has(courseCode));
  });
}

export function buildMajorSpecificsGrcRequiredMajorCourseLines(args: {
  plan: TransferPlannerResolvedMajorPlan | null;
  track: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
}) {
  const { plan, track, completedCourses } = args;
  if (plan) {
    const summaryEntries = buildSourceBackedRequiredCourseSummaryEntries(plan, {
      mode: "grc",
    });
    if (summaryEntries.length) {
      return summaryEntries.map((entry) => ({
        id: entry.id,
        text: entry.text,
      }));
    }
  }

  const orderedLines: { id: string; text: string }[] = [];
  const seenCourseCodes = new Set<string>();
  const preparatoryCourseCodes = getPreparatoryTrackCourseCodeSet(track);
  const groupedChoices = track?.groupedChoices ?? [];
  orderedLines.push(...groupedChoices.map(buildTrackGroupedChoiceRequiredCourseLine));
  const addCourseLabel = (courseLabel: string) => {
    const normalizedLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
    if (isMergedCourseDistributionRequirementLabel(normalizedLabel)) return;
    if (isTrackCourseLabelCoveredByGroupedChoice(normalizedLabel, groupedChoices)) return;

    const explicitCourseCodes = extractCourseCodes(normalizedLabel);
    if (!normalizedLabel || explicitCourseCodes.length !== 1) return;

    const normalizedCourseCode = normalizePlannerCourseCode(explicitCourseCodes[0]);
    if (
      !normalizedCourseCode ||
      preparatoryCourseCodes.has(normalizedCourseCode) ||
      seenCourseCodes.has(normalizedCourseCode)
    ) {
      return;
    }

    seenCourseCodes.add(normalizedCourseCode);
    orderedLines.push({
      id: normalizedCourseCode,
      text: buildRequiredCourseSentence(getSuggestedScheduleCourseDisplayLabel(normalizedLabel)),
    });
  };

  if (track) {
    for (const term of getResolvedTrackTermsForRequirementDisplay(track, completedCourses)) {
      if (GRC_TRACK_NOTE_TERM_LABEL_PATTERN.test(String(term.label ?? "").trim())) {
        continue;
      }

      for (const courseLabel of term.courses) {
        addCourseLabel(courseLabel);
      }
    }
  }

  if (orderedLines.length > 0) {
    return orderedLines;
  }

  if (plan) {
    for (const courseLabel of buildMajorSpecificsFallbackGrcCourseLabels(plan)) {
      addCourseLabel(courseLabel);
    }
  }

  return orderedLines;
}

export function buildRequiredPlannerCourseCodes(plan: TransferPlannerResolvedMajorPlan) {
  const orderedCourseCodes = buildSourceBackedRequiredCourseCodes(plan);

  if (!orderedCourseCodes.length) {
    const fallbackCourseCodes: string[] = [];
    const seenCourseCodes = new Set<string>();
    appendUniqueCourseCodesFromLabels(
      fallbackCourseCodes,
      seenCourseCodes,
      plan.grcCourseList ?? []
    );
    return fallbackCourseCodes;
  }

  return orderedCourseCodes;
}

export function buildUwCoursesConsideredEntries(plan: TransferPlannerResolvedMajorPlan) {
  return buildUwRequiredPathCourseEntries(plan);
}

export function buildUwRequiredPathCourseEntries(plan: TransferPlannerResolvedMajorPlan) {
  return buildSourceBackedUwCourseConsideredSummaryEntries(plan).map((entry) => ({
    id: entry.id,
    text: entry.text,
  }));
}

export function buildRequirementCreditTotalsByTag(
  plan: TransferPlannerResolvedMajorPlan,
  evaluations: TransferPlannerStudentCourseEvaluation[]
) {
  const totals = new Map<string, number>();
  const candidateTags = new Set(
    evaluations
      .flatMap((evaluation) => evaluation.targetRequirementTags)
      .map((tag) => normalizeRequirementTag(tag))
      .filter(Boolean)
  );

  if (!candidateTags.size || !plan.degreeMapSections?.length) {
    return totals;
  }

  const searchableText = plan.degreeMapSections
    .flatMap((section) => [section.title, section.note ?? "", ...section.items])
    .join("\n");

  for (const tag of candidateTags) {
    const detectedTotal = inferRequirementCreditTotalFromText(searchableText, tag);
    if (detectedTotal && detectedTotal > 0) {
      totals.set(tag, detectedTotal);
    }
  }

  return totals;
}

export function shouldShowRequirementCreditMessage(evaluation: TransferPlannerStudentCourseEvaluation) {
  return (
    (evaluation.outcome === "auto-approved" ||
      evaluation.outcome === "legacy-rule-used" ||
      evaluation.outcome === "elective-credit") &&
    evaluation.targetRequirementTags.length > 0
  );
}

export function getEvaluationRequirementCreditMessageParts(input: {
  evaluation: TransferPlannerStudentCourseEvaluation;
  totalsByTag: Map<string, number>;
  completedByTag: Map<string, number>;
  campusId: TransferPlannerCampusId;
}) {
  const { evaluation, totalsByTag, completedByTag, campusId } = input;
  if (!shouldShowRequirementCreditMessage(evaluation)) return null;

  const normalizedTags = Array.from(
    new Set(
      evaluation.targetRequirementTags
        .map((tag) => normalizeRequirementTag(tag))
        .filter(Boolean)
    )
  );
  if (!normalizedTags.length) return null;

  const selectedTag = normalizedTags.find((tag) => totalsByTag.has(tag)) ?? normalizedTags[0];
  if (!selectedTag) return null;

  const tagLabel = getRequirementTagLabel(selectedTag);
  const fulfilledCredits = evaluation.sourceCreditAmount ?? 5;
  const totalCredits = totalsByTag.get(selectedTag) ?? null;

  if (!totalCredits) {
    return {
      prefix: `Fulfills ${fulfilledCredits} credits of the `,
      clickableLabel: tagLabel,
      suffix: " requirement.",
      normalizedTag: selectedTag,
      campusId,
    };
  }

  const completedCredits = Math.min(completedByTag.get(selectedTag) ?? 0, totalCredits);
  return {
    prefix: `Fulfills ${fulfilledCredits} credits of the ${totalCredits}-credit `,
    clickableLabel: tagLabel,
    suffix: ` requirement. ${completedCredits}/${totalCredits} credits have been completed.`,
    normalizedTag: selectedTag,
    campusId,
  };
}

export function hasDirectEquivalentRuleForCourse(courseCode: string, campusId: TransferPlannerCampusId) {
  return getTransferPlannerEquivalencyRulesForSourceCourse(courseCode).some((rule) => {
    if (!rule.targetSchoolIds.includes(campusId)) return false;
    if (rule.acceptanceCategory === "no-credit") return false;
    if (rule.type === "elective-credit" || rule.type === "limited-credit") return false;
    return true;
  });
}

export function hasAnyDirectMajorEquivalencies(plan: TransferPlannerResolvedMajorPlan) {
  const requirementCourseCodes = buildRequiredPlannerCourseCodes(plan);
  if (!requirementCourseCodes.length) return false;

  return requirementCourseCodes.some((courseCode: string) =>
    hasDirectEquivalentRuleForCourse(courseCode, plan.campusId)
  );
}

export function buildAdmissionContextText(plan: TransferPlannerResolvedMajorPlan) {
  return [
    plan.summary,
    ...(plan.degreeMapSections ?? []).flatMap((section) => section.items),
    ...plan.advisorFlags,
    ...(plan.validationNotes ?? []),
  ]
    .map((item) => String(item ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isOpenAdmissionMajor(plan: TransferPlannerResolvedMajorPlan) {
  const admissionText = buildAdmissionContextText(plan);
  if (!admissionText) return false;
  if (/\bnot an open major\b|\brather than an open major\b/.test(admissionText)) {
    return false;
  }

  return /\bopen\s+major\b|\bopen\s+admission\b|\bdeclare (?:this|the) major at any time\b/.test(
    admissionText
  );
}
