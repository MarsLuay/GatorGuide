
import {
  getTransferPlannerCanonicalCourse,
  type TransferPlannerCampusId,
  type TransferPlannerResolvedMajorPlan,
} from "@/constants/transfer-planner-source/student-runtime";
import {
  auditOptionTitleFallback,
  extractCourseCodes,
  UW_TRANSFER_ADMISSION_CADR_EXEMPTION_QUARTER_CREDITS,
  type SuggestedQuarterPlan,
} from "@/services/planning/transfer-planner.service";

import type { PlannerCollegeId } from "./transfer-planner-storage";

export function formatSuggestedScheduleCreditCount(creditAmount: number) {
  const roundedCreditAmount = Number.isInteger(creditAmount)
    ? String(creditAmount)
    : creditAmount.toFixed(1).replace(/\.0$/, "");
  return `${roundedCreditAmount} ${creditAmount === 1 ? "credit" : "credits"}`;
}

export function formatSuggestedScheduleCreditNumber(creditAmount: number) {
  return Number.isInteger(creditAmount)
    ? String(creditAmount)
    : creditAmount.toFixed(1).replace(/\.0$/, "");
}

export function formatSuggestedScheduleCreditRange(input: {
  creditMin: number;
  creditMax: number;
}) {
  if (input.creditMin === input.creditMax) {
    return formatSuggestedScheduleCreditCount(input.creditMin);
  }

  return `${formatSuggestedScheduleCreditNumber(input.creditMin)}-${formatSuggestedScheduleCreditNumber(
    input.creditMax
  )} credits`;
}

export function getSuggestedScheduleCredentialLabel(
  degreeTitle: string,
  grcTrackRequirementNoun: string
) {
  const trimmedDegreeTitle = String(degreeTitle ?? "").trim() || "selected";
  if (/\b(degree|program|certificate)\b$/i.test(trimmedDegreeTitle)) {
    return trimmedDegreeTitle;
  }

  const credentialNoun =
    grcTrackRequirementNoun === "degree" ? "Degree" : "Program";
  return `${trimmedDegreeTitle} ${credentialNoun}`;
}

export type SuggestedScheduleQuarterSeason = "Winter" | "Spring" | "Summer" | "Fall";

export type SuggestedScheduleQuarterParts = {
  season: SuggestedScheduleQuarterSeason;
  year: number;
};

export const UW_TRANSFER_DEADLINE_MONTH_LABELS: Record<number, string> = {
  2: "February",
  9: "September",
};

export function getSuggestedCourseCreditAmount(
  course: SuggestedQuarterPlan["courses"][number]
) {
  const creditAmount = Number(course.creditAmount);
  return Number.isFinite(creditAmount) && creditAmount > 0 ? creditAmount : 0;
}

export function getSuggestedCourseCreditRange(
  course: SuggestedQuarterPlan["courses"][number]
) {
  const exactCreditAmount = getSuggestedCourseCreditAmount(course) || null;
  const creditMin = Number(course.creditMin);
  const creditMax = Number(course.creditMax);
  const minimumCreditAmount =
    Number.isFinite(creditMin) && creditMin > 0 ? creditMin : exactCreditAmount;
  const maximumCreditAmount =
    Number.isFinite(creditMax) && creditMax > 0
      ? creditMax
      : exactCreditAmount ?? minimumCreditAmount;

  return {
    creditMin: minimumCreditAmount ?? 0,
    creditMax: maximumCreditAmount ?? minimumCreditAmount ?? 0,
  };
}

export function getSuggestedQuarterCreditTotal(quarter: SuggestedQuarterPlan) {
  return quarter.courses.reduce(
    (totalCredits, course) => totalCredits + getSuggestedCourseCreditRange(course).creditMin,
    0
  );
}

export function parseSuggestedScheduleQuarterLabel(
  label: string | null | undefined
): SuggestedScheduleQuarterParts | null {
  const match = String(label ?? "").match(/\b(Winter|Spring|Summer|Fall|Autumn)\s+(\d{4})\b/i);
  if (!match) return null;

  const parsedYear = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(parsedYear)) return null;

  const rawSeason = String(match[1] ?? "").toLowerCase();
  const season: SuggestedScheduleQuarterSeason =
    rawSeason === "winter"
      ? "Winter"
      : rawSeason === "spring"
        ? "Spring"
        : rawSeason === "summer"
          ? "Summer"
          : "Fall";

  return {
    season,
    year: parsedYear,
  };
}

export function formatUwTransferDeadlineDate(month: number, day: number, year: number) {
  return `${UW_TRANSFER_DEADLINE_MONTH_LABELS[month] ?? `Month ${month}`} ${day}, ${year}`;
}

export function getUwTransferApplicationCycleForQuarter(
  quarter: SuggestedScheduleQuarterParts
) {
  if (quarter.season === "Winter") {
    return {
      deadlineText: formatUwTransferDeadlineDate(2, 15, quarter.year),
      admissionTerm: `Autumn/Summer ${quarter.year}`,
    };
  }

  if (quarter.season === "Spring" || quarter.season === "Summer") {
    return {
      deadlineText: formatUwTransferDeadlineDate(9, 1, quarter.year),
      admissionTerm: `Winter ${quarter.year + 1}`,
    };
  }

  return {
    deadlineText: formatUwTransferDeadlineDate(2, 15, quarter.year + 1),
    admissionTerm: `Autumn/Summer ${quarter.year + 1}`,
  };
}

export function shouldUseGenericUwTransferMinimumRequirementSummary(input: {
  selectedCampusId: TransferPlannerCampusId | null;
  selectedMajorId: string | null;
  degreeTitle: string;
}) {
  const context = [input.selectedCampusId, input.selectedMajorId, input.degreeTitle]
    .map((value) => String(value ?? "").replace(/[-_]+/g, " ").toLowerCase())
    .join(" ");

  // Generic UW transfer timing is only a broad university-level credit milestone.
  // Do not show it for engineering-style majors because those usually have
  // source-specific departmental admission cycles and prerequisite gates.
  if (
    /\b(?:engineering|materials science|bioengineering|chemical engineering|computer engineering|electrical engineering|mechanical engineering|civil engineering|industrial engineering|aeronautics|astronautics|human centered design|hcde)\b/i.test(
      context
    )
  ) {
    return false;
  }

  return true;
}

export function buildUwTransferMinimumRequirementSummary(input: {
  quarters: SuggestedQuarterPlan[];
  selectedCampusId: TransferPlannerCampusId | null;
  selectedMajorId: string | null;
  degreeTitle: string;
}) {
  if (!shouldUseGenericUwTransferMinimumRequirementSummary(input)) {
    return null;
  }

  const quarters = input.quarters;
  const completedCredits = quarters
    .filter((quarter) => quarter.phase === "completed")
    .reduce(
      (totalCredits, quarter) => totalCredits + getSuggestedQuarterCreditTotal(quarter),
      0
    );
  let cumulativeCredits = completedCredits;
  const upcomingQuarters = quarters.filter((quarter) => quarter.phase !== "completed");

  for (const quarter of upcomingQuarters) {
    const quarterParts = parseSuggestedScheduleQuarterLabel(quarter.label);
    if (!quarterParts) {
      cumulativeCredits += getSuggestedQuarterCreditTotal(quarter);
      continue;
    }

    if (cumulativeCredits < UW_TRANSFER_ADMISSION_CADR_EXEMPTION_QUARTER_CREDITS) {
      cumulativeCredits += getSuggestedQuarterCreditTotal(quarter);
    }

    if (cumulativeCredits >= UW_TRANSFER_ADMISSION_CADR_EXEMPTION_QUARTER_CREDITS) {
      const applicationCycle = getUwTransferApplicationCycleForQuarter(quarterParts);
      return `${quarter.label} - Minimum transfer requirements are met. Apply by ${applicationCycle.deadlineText} to be considered for ${applicationCycle.admissionTerm} admission at UW.`;
    }
  }

  return null;
}

export function getSchedulePlaceholderRequirementLinkData(courseLabel: string) {
  const normalized = String(courseLabel ?? "").trim();
  if (!normalized) return null;
  const explicitCourseCodes = extractCourseCodes(normalized);
  const hasCreditPlaceholder = /\bcredits?\s+of\b/i.test(normalized);
  const hasGrcDistributionPlaceholder =
    explicitCourseCodes.length === 0 &&
    (/\b[HSN]\s*\d\b/i.test(normalized) ||
      /\b(?:humanities?|fine arts|arts and humanities|social sciences?|natural sciences?|natural science list)\b/i.test(
        normalized
      ));
  const hasGeneralPlaceholder =
    explicitCourseCodes.length === 0 &&
    /\b(?:electives?|general education|gen ed)\b/i.test(normalized);
  if (!hasCreditPlaceholder && !hasGrcDistributionPlaceholder && !hasGeneralPlaceholder) {
    return null;
  }

  const lower = normalized.toLowerCase();
  const hasComputerEngineeringNaturalScience =
    lower.includes("electrical & computer engineering natural science") ||
    lower.includes("electrical and computer engineering natural science") ||
    lower.includes("computer engineering natural science") ||
    lower.includes("ce-approved natural science");
  const hasUnresolvedApprovedListCue =
    /\b(?:approved|department-approved|program-approved|university-approved)\b[\s\S]*\blists?\b/i.test(
      normalized
    ) ||
    /\blists?\b[\s\S]*\b(?:approved|department-approved|program-approved|university-approved)\b/i.test(
      normalized
    );
  const hasHumanities =
    lower.includes("humanit") ||
    lower.includes("fine arts") ||
    lower.includes("a&h") ||
    lower.includes("arts and humanities") ||
    /\bh\s*\d\b/i.test(normalized);
  const hasSocialScience =
    lower.includes("social science") || /\bssc\b/i.test(lower) || /\bs\s*\d\b/i.test(normalized);
  const hasNaturalScience =
    lower.includes("natural science") || /\bnsc\b/i.test(lower) || /\bn\s*\d\b/i.test(normalized);

  if (hasComputerEngineeringNaturalScience) {
    return { kind: "major-source" as const };
  }
  if (hasUnresolvedApprovedListCue) {
    return null;
  }
  if (hasHumanities && hasSocialScience) {
    return { kind: "transfer-equivalency" as const, tags: ["AH", "SSC"] as const };
  }
  if (hasHumanities) {
    return { kind: "transfer-equivalency" as const, tags: ["AH"] as const };
  }
  if (hasSocialScience) {
    return { kind: "transfer-equivalency" as const, tags: ["SSC"] as const };
  }
  if (hasNaturalScience) {
    return { kind: "transfer-equivalency" as const, tags: ["NSC"] as const };
  }
  if (lower.includes("elective") || lower.includes("general education") || lower.includes("gen ed")) {
    return { kind: "transfer-equivalency" as const, tags: [] as const };
  }

  return { kind: "transfer-equivalency" as const, tags: [] as const };
}

function isElectricalComputerEngineeringNaturalScienceText(value: string | null | undefined) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return (
    normalized.includes("electrical & computer engineering natural science") ||
    normalized.includes("electrical and computer engineering natural science") ||
    normalized.includes("ece natural science")
  );
}

export function getSuggestedScheduleApprovedListDisplayTitle(input: {
  optionGroupTitle?: string | null;
  planId?: string | null;
  planTitle?: string | null;
  selectedPathwayLabel?: string | null;
}) {
  if (!isElectricalComputerEngineeringNaturalScienceText(input.optionGroupTitle)) {
    return null;
  }

  const planTitle = String(input.planTitle ?? "").trim() || "this major";
  const pathwayLabel =
    String(input.selectedPathwayLabel ?? "").trim() ||
    (input.planId === "uw-seattle-electrical-computer-engineering"
      ? "Embedded Systems Pathway"
      : "");
  const planLabel = pathwayLabel ? `${planTitle} (${pathwayLabel})` : planTitle;

  return `5 credits of Natural Sciences (Check approved list) This covers 40/40 NSc credits needed for ${planLabel}.`;
}

export function getSuggestedScheduleCourseDisplayLabel(courseLabel: string) {
  const normalizedLabel = String(courseLabel ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedLabel) return "";

  const explicitCourseCodes = extractCourseCodes(normalizedLabel);
  if (explicitCourseCodes.length !== 1) {
    return normalizedLabel;
  }

  const [canonicalCourseCode] = explicitCourseCodes;
  const rawLeadingCourseCode =
    normalizedLabel
      .match(/^[A-Z]{2,6}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/i)?.[0]
      ?.toUpperCase()
      .replace(/\s+/g, " ")
      .trim() ?? canonicalCourseCode;

  if (normalizedLabel.toUpperCase() !== rawLeadingCourseCode.toUpperCase()) {
    const normalizedCodePrefix = `${rawLeadingCourseCode} `.toUpperCase();
    if (normalizedLabel.toUpperCase().startsWith(normalizedCodePrefix)) {
      const remainder = normalizedLabel.slice(rawLeadingCourseCode.length).trim();
      if (remainder && !remainder.startsWith("-")) {
        return `${rawLeadingCourseCode} - ${remainder}`;
      }
    }
    return normalizedLabel;
  }

  const canonicalCourseTitle = String(
    getTransferPlannerCanonicalCourse("grc", rawLeadingCourseCode)?.title ??
      getTransferPlannerCanonicalCourse("grc", canonicalCourseCode)?.title ??
      ""
  ).trim();
  if (!canonicalCourseTitle) {
    return normalizedLabel;
  }

  return `${rawLeadingCourseCode} - ${canonicalCourseTitle}`;
}

export function removeGuidanceSummaryPrefixes(
  summary: string | null | undefined,
  prefixes: (string | null | undefined)[]
) {
  let remainingSummary = String(summary ?? "").trim();
  if (!remainingSummary) return null;

  for (const prefix of prefixes) {
    const normalizedPrefix = String(prefix ?? "").trim();
    if (!normalizedPrefix) continue;

    if (remainingSummary === normalizedPrefix) {
      return null;
    }

    if (remainingSummary.startsWith(`${normalizedPrefix} `)) {
      remainingSummary = remainingSummary.slice(normalizedPrefix.length).trim();
    }
  }

  return remainingSummary || null;
}

export function isSuggestedScheduleGeneratedOptionSummary(summary: string | null | undefined) {
  const normalizedSummary = String(summary ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedSummary) return false;

  return (
    /^Default sample-map options?:/i.test(normalizedSummary) ||
    /^Selected options?:/i.test(normalizedSummary) ||
    /^Options:/i.test(normalizedSummary)
  );
}

export type SuggestedScheduleOptionGroup = NonNullable<
  SuggestedQuarterPlan["courses"][number]["optionGroup"]
>;
export type SuggestedScheduleOption = SuggestedScheduleOptionGroup["options"][number];

export function getSuggestedScheduleUniqueOptionIds(optionIds: string[] | null | undefined) {
  return [
    ...new Set(
      (optionIds ?? []).map((optionId) => String(optionId ?? "").trim()).filter(Boolean)
    ),
  ];
}

export function getSuggestedScheduleSelectedOptions(optionGroup: SuggestedScheduleOptionGroup) {
  const selectedOptionIdSet = new Set(
    getSuggestedScheduleResolvedOptionIds(optionGroup)
  );
  return optionGroup.options.filter((option) => selectedOptionIdSet.has(option.id));
}

export function getSuggestedScheduleOptionCourseDisplayLabels(option: SuggestedScheduleOption) {
  return option.courseLabels
    .map(getSuggestedScheduleCourseDisplayLabel)
    .map((label) => label.trim())
    .filter(Boolean);
}

export function isSuggestedScheduleDuplicateSingleCourseOptionLabel(
  option: SuggestedScheduleOption
) {
  if (option.courseLabels.length !== 1) return false;

  const normalizedOptionLabel = String(option.label ?? "").replace(/\s+/g, " ").trim();
  const normalizedCourseLabel = String(option.courseLabels[0] ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalizedOptionLabel || !normalizedCourseLabel) return false;

  return (
    normalizedOptionLabel.toUpperCase() === normalizedCourseLabel.toUpperCase() ||
    normalizedOptionLabel.toUpperCase() ===
      `${normalizedCourseLabel}: ${normalizedCourseLabel}`.toUpperCase()
  );
}

export function getSuggestedScheduleOptionDisplayLabel(option: SuggestedScheduleOption) {
  const courseDisplayLabels = getSuggestedScheduleOptionCourseDisplayLabels(option);
  const normalizedOptionLabel = String(option.label ?? "").replace(/\s+/g, " ").trim();
  if (
    courseDisplayLabels.length === 1 &&
    isSuggestedScheduleDuplicateSingleCourseOptionLabel(option)
  ) {
    return courseDisplayLabels[0];
  }

  return normalizedOptionLabel || courseDisplayLabels.join(" / ") || "Option";
}

export function getSuggestedScheduleOptionCourseDetailText(option: SuggestedScheduleOption) {
  const courseDisplayLabels = getSuggestedScheduleOptionCourseDisplayLabels(option);
  if (!courseDisplayLabels.length) return null;

  const optionDisplayLabel = getSuggestedScheduleOptionDisplayLabel(option);
  const courseDetailText = courseDisplayLabels.join(", ");
  return courseDetailText === optionDisplayLabel ? null : courseDetailText;
}

export function getSuggestedScheduleOptionSelectedDisplayLabel(option: SuggestedScheduleOption) {
  const optionDisplayLabel = getSuggestedScheduleOptionDisplayLabel(option);
  const courseDetailText = getSuggestedScheduleOptionCourseDetailText(option);
  return courseDetailText ? `${optionDisplayLabel} (${courseDetailText})` : optionDisplayLabel;
}

export function isSuggestedScheduleCategoryOption(option: SuggestedScheduleOption) {
  return option.optionKind === "category-option" && Boolean(option.categoryOption);
}

export function getSuggestedScheduleOptionCompletedTranscriptSatisfiers(
  optionGroup: SuggestedScheduleOptionGroup,
  optionId: string
) {
  return optionGroup.completedSatisfyingCourseCodesByOptionId?.[optionId] ?? [];
}

export function getSuggestedScheduleOptionCompletedTranscriptSatisfierText(
  optionGroup: SuggestedScheduleOptionGroup,
  optionId: string
) {
  const satisfiers = getSuggestedScheduleOptionCompletedTranscriptSatisfiers(
    optionGroup,
    optionId
  );
  return satisfiers.length ? satisfiers.join(", ") : null;
}

export function getSuggestedScheduleOptionStatusDisplayLabel(
  optionGroup: SuggestedScheduleOptionGroup,
  option: SuggestedScheduleOption
) {
  const selectedLabel = getSuggestedScheduleOptionSelectedDisplayLabel(option);
  const transcriptSatisfierText = isSuggestedScheduleCategoryOption(option)
    ? getSuggestedScheduleOptionCompletedTranscriptSatisfierText(optionGroup, option.id)
    : null;
  return transcriptSatisfierText
    ? `${selectedLabel}, satisfied by ${transcriptSatisfierText}`
    : selectedLabel;
}

export function getSuggestedScheduleSelectedOptionLabels(optionGroup: SuggestedScheduleOptionGroup) {
  return getSuggestedScheduleSelectedOptions(optionGroup).map((option) => {
    const selectedLabel = getSuggestedScheduleOptionStatusDisplayLabel(optionGroup, option);
    return option.guidanceSummary
      ? `${selectedLabel}. ${option.guidanceSummary}`
      : selectedLabel;
  });
}

export const COPY_ONLY_OPTION_STATUS_TEXT_STYLE = {
  color: "transparent",
  opacity: 0.01,
  fontSize: 1,
  lineHeight: 1,
  height: 1,
  maxHeight: 1,
  overflow: "hidden" as const,
};

export function buildSuggestedScheduleCopyOnlyOptionStatusText(input: {
  optionGroup: SuggestedScheduleOptionGroup;
  option: SuggestedScheduleOption;
  isSelected: boolean;
  displayGroupTitle: string;
}) {
  const transcriptSatisfierText = getSuggestedScheduleOptionCompletedTranscriptSatisfierText(
    input.optionGroup,
    input.option.id
  );
  const satisfiedByText =
    isSuggestedScheduleCategoryOption(input.option) && transcriptSatisfierText
      ? `completed transcript course ${transcriptSatisfierText}`
      : getSuggestedScheduleOptionSatisfiedBy(input.optionGroup, input.option.id);

  return [
    "[copy-only option status]",
    `Option group: ${input.displayGroupTitle}`,
    `Original group title: ${input.optionGroup.title || "none"}`,
    `Option: ${getSuggestedScheduleOptionDisplayLabel(input.option)}`,
    `Is selected option: ${input.isSelected ? "yes" : "no"}`,
    `Option id: ${input.option.id}`,
    `Option group id: ${input.optionGroup.id}`,
    `Satisfied by: ${satisfiedByText}`,
  ].join(" ");
}

export function buildSuggestedScheduleCopyOnlyToggleStatusText(input: {
  collegeId: PlannerCollegeId;
  showOnlyUwEssentialClassesToggle: boolean;
  onlyUwEssentialClasses: boolean;
  allowStemPrepClasses: boolean;
  allowSummerClasses: boolean;
}) {
  return [
    "[copy-only planner toggle status]",
    `Planner college: ${input.collegeId}`,
    `Classes for UW transfer only toggle visible: ${
      input.showOnlyUwEssentialClassesToggle ? "yes" : "no"
    }`,
    `Classes for UW transfer only: ${
      input.showOnlyUwEssentialClassesToggle
        ? input.onlyUwEssentialClasses
          ? "on"
          : "off"
        : "not applicable"
    }`,
    `Allow STEM prep classes: ${input.allowStemPrepClasses ? "on" : "off"}`,
    `Allow summer classes: ${input.allowSummerClasses ? "on" : "off"}`,
  ].join(" ");
}

export function getSuggestedScheduleOptionCreditRange(option: SuggestedScheduleOption) {
  return {
    creditMin: Number(option.creditMin ?? option.creditAmount) || 0,
    creditMax:
      Number(option.creditMax ?? option.creditAmount ?? option.creditMin) || 0,
  };
}

export function getSuggestedScheduleOptionGroupSelectionTargetText(
  optionGroup: SuggestedScheduleOptionGroup
) {
  if (isSuggestedScheduleCreditBasedOptionGroup(optionGroup)) {
    const requiredCredits = Number(optionGroup.requiredCredits ?? 0);
    const maxRequiredCredits = Number(
      optionGroup.maxRequiredCredits ?? optionGroup.requiredCredits ?? 0
    );
    if (
      Number.isFinite(requiredCredits) &&
      requiredCredits > 0 &&
      Number.isFinite(maxRequiredCredits) &&
      maxRequiredCredits > 0 &&
      maxRequiredCredits !== requiredCredits
    ) {
      return `Choose ${formatSuggestedScheduleCreditRange({
        creditMin: requiredCredits,
        creditMax: maxRequiredCredits,
      })} from approved options`;
    }
    if (Number.isFinite(requiredCredits) && requiredCredits > 0) {
      return `Choose at least ${formatSuggestedScheduleCreditRange({
        creditMin: requiredCredits,
        creditMax: requiredCredits,
      })} from approved options`;
    }
  }

  const selectionCount = Math.max(
    1,
    Math.ceil(Number(optionGroup.selectionCount ?? 1) || 1)
  );
  return selectionCount === 1
    ? "Choose 1 approved option"
    : `Choose ${selectionCount} approved options`;
}

export function getSuggestedScheduleOptionGroupSelectedCount(
  optionGroup: SuggestedScheduleOptionGroup
) {
  return getSuggestedScheduleResolvedOptionIds(optionGroup).length;
}

export function isSuggestedScheduleCreditBasedOptionGroup(
  optionGroup: SuggestedScheduleOptionGroup
) {
  return (
    optionGroup.requirementType === "choose_credits" &&
    Number.isFinite(Number(optionGroup.requiredCredits)) &&
    Number(optionGroup.requiredCredits) > 0
  );
}

export function getSuggestedScheduleOptionGroupProgressText(
  optionGroup: SuggestedScheduleOptionGroup
) {
  if (isSuggestedScheduleCreditBasedOptionGroup(optionGroup)) {
    return optionGroup.displayedCreditProgress || "0/0";
  }

  const selectionCount = getSuggestedScheduleOptionGroupRequiredSelectionCount(optionGroup);
  const selectedCount = Math.min(
    getSuggestedScheduleOptionGroupSelectedCount(optionGroup),
    selectionCount
  );
  return `${selectedCount}/${selectionCount}`;
}

export function getSuggestedScheduleOptionGroupInteractionSelectionCount(
  optionGroup: SuggestedScheduleOptionGroup
) {
  if (isSuggestedScheduleCreditBasedOptionGroup(optionGroup)) {
    return Math.max(1, optionGroup.options.length || 1);
  }

  return getSuggestedScheduleOptionGroupRequiredSelectionCount(optionGroup);
}

export function getSuggestedScheduleResolvedOptionIds(optionGroup: SuggestedScheduleOptionGroup) {
  if (optionGroup.resolvedSatisfiedOptionIds) {
    return getSuggestedScheduleUniqueOptionIds(optionGroup.resolvedSatisfiedOptionIds);
  }

  return getSuggestedScheduleUniqueOptionIds(optionGroup.selectedOptionIds);
}

export function getSuggestedScheduleOptionSatisfactionSources(
  optionGroup: SuggestedScheduleOptionGroup,
  optionId: string
) {
  return optionGroup.optionSatisfactionSourcesById?.[optionId] ?? [];
}

export function getSuggestedScheduleOptionSatisfiedBy(
  optionGroup: SuggestedScheduleOptionGroup,
  optionId: string
) {
  const sources = new Set(
    getSuggestedScheduleOptionSatisfactionSources(optionGroup, optionId)
  );
  if (sources.has("user-selected")) return "user-selected";
  if (sources.has("transcript-completed")) return "transcript";
  if (sources.has("planner-defaulted")) return "default";
  if (sources.has("scheduled-and-counted")) return "scheduled-counted";
  if (optionGroup.selectedOptionIds.includes(optionId)) {
    return optionGroup.selectionSource === "default" ? "default" : "user-selected";
  }
  return "none";
}

export function getSuggestedScheduleOptionGroupStatusVerb(
  optionGroup: SuggestedScheduleOptionGroup
) {
  const selectedSourceLabels = getSuggestedScheduleResolvedOptionIds(optionGroup)
    .map((optionId) => getSuggestedScheduleOptionSatisfiedBy(optionGroup, optionId))
    .filter((sourceLabel) => sourceLabel !== "none");
  const uniqueSourceLabels = getSuggestedScheduleUniqueOptionIds(selectedSourceLabels);
  if (!uniqueSourceLabels.length) return "Selected";
  if (uniqueSourceLabels.length > 1) return "Satisfied";
  if (uniqueSourceLabels[0] === "default") return "Default";
  if (uniqueSourceLabels[0] === "transcript") return "Completed";
  if (uniqueSourceLabels[0] === "scheduled-counted") return "Satisfied";
  return "Selected";
}

export function shouldPreferSuggestedScheduleOptionGroup(
  currentOptionGroup: SuggestedScheduleOptionGroup,
  nextOptionGroup: SuggestedScheduleOptionGroup
) {
  const currentSelectedCount = getSuggestedScheduleOptionGroupSelectedCount(
    currentOptionGroup
  );
  const nextSelectedCount = getSuggestedScheduleOptionGroupSelectedCount(nextOptionGroup);

  return (
    (nextOptionGroup.selectionSource === "student" &&
      currentOptionGroup.selectionSource !== "student") ||
    (nextOptionGroup.isSelectionPrompt && !currentOptionGroup.isSelectionPrompt) ||
    nextSelectedCount > currentSelectedCount
  );
}

export function mergeSuggestedScheduleOptionGroups(
  existingOptionGroups: SuggestedScheduleOptionGroup[],
  nextOptionGroups: SuggestedScheduleOptionGroup[]
) {
  const optionGroupsById = new Map<string, SuggestedScheduleOptionGroup>();

  for (const optionGroup of existingOptionGroups) {
    optionGroupsById.set(optionGroup.id, optionGroup);
  }

  for (const optionGroup of nextOptionGroups) {
    const currentOptionGroup = optionGroupsById.get(optionGroup.id);
    if (
      !currentOptionGroup ||
      shouldPreferSuggestedScheduleOptionGroup(currentOptionGroup, optionGroup)
    ) {
      optionGroupsById.set(optionGroup.id, optionGroup);
    }
  }

  return [...optionGroupsById.values()];
}

export function addStableSuggestedScheduleOptionGroupId(
  optionGroupIds: string[],
  seenOptionGroupIds: Set<string>,
  rawOptionGroupId: string | null | undefined
) {
  const optionGroupId = String(rawOptionGroupId ?? "").trim();
  if (!optionGroupId || seenOptionGroupIds.has(optionGroupId)) {
    return;
  }

  seenOptionGroupIds.add(optionGroupId);
  optionGroupIds.push(optionGroupId);
}

export function buildStableSuggestedScheduleOptionGroupIds(input: {
  plan: TransferPlannerResolvedMajorPlan | null;
  trackOptionGroups: SuggestedScheduleOptionGroup[];
}) {
  const optionGroupIds: string[] = [];
  const seenOptionGroupIds = new Set<string>();

  for (const optionGroup of input.trackOptionGroups) {
    addStableSuggestedScheduleOptionGroupId(
      optionGroupIds,
      seenOptionGroupIds,
      optionGroup.id
    );
  }

  const planChecklistItems = [
    ...(input.plan?.applicationChecklist ?? []),
    ...(input.plan?.beforeEnrollmentChecklist ?? []),
    ...(input.plan?.stayAtGrcChecklist ?? []),
  ];

  for (const item of planChecklistItems) {
    if (!item.requirementGroup?.options?.length) {
      continue;
    }

    addStableSuggestedScheduleOptionGroupId(
      optionGroupIds,
      seenOptionGroupIds,
      item.requirementGroup.id
    );
  }

  for (const group of input.plan?.requirementGroups ?? []) {
    addStableSuggestedScheduleOptionGroupId(
      optionGroupIds,
      seenOptionGroupIds,
      group.id
    );
  }

  return optionGroupIds;
}

export function orderSuggestedScheduleOptionGroupsByStableIds(
  optionGroups: SuggestedScheduleOptionGroup[],
  stableOptionGroupIds: string[]
) {
  if (optionGroups.length < 2 || !stableOptionGroupIds.length) {
    return optionGroups;
  }

  const stableIndexByGroupId = new Map(
    stableOptionGroupIds.map((groupId, index) => [groupId, index])
  );
  const fallbackBaseIndex = stableOptionGroupIds.length;

  return optionGroups
    .map((optionGroup, currentIndex) => ({
      optionGroup,
      currentIndex,
      stableIndex: stableIndexByGroupId.get(optionGroup.id) ?? fallbackBaseIndex + currentIndex,
    }))
    .sort((left, right) => {
      const stableDelta = left.stableIndex - right.stableIndex;
      if (stableDelta !== 0) return stableDelta;
      return left.currentIndex - right.currentIndex;
    })
    .map((entry) => entry.optionGroup);
}

export function collectSuggestedScheduleOptionGroups(quarters: SuggestedQuarterPlan[]) {
  const optionGroups: SuggestedScheduleOptionGroup[] = [];

  for (const quarter of quarters) {
    for (const course of quarter.courses) {
      const optionGroup = course.optionGroup ?? null;
      if (!optionGroup) continue;
      optionGroups.push(optionGroup);
    }
  }

  return mergeSuggestedScheduleOptionGroups([], optionGroups);
}

export function getSuggestedScheduleOptionGroupDisplayTitle(input: {
  optionGroup: SuggestedScheduleOptionGroup;
  titleFallbackAuditRows: ReturnType<typeof auditOptionTitleFallback>;
  visibleOptionIndex: number;
  plan?: TransferPlannerResolvedMajorPlan | null;
}) {
  const approvedListDisplayTitle = getSuggestedScheduleApprovedListDisplayTitle({
    optionGroupTitle: input.optionGroup.title,
    planId: input.plan?.id ?? null,
    planTitle: input.plan?.title ?? null,
    selectedPathwayLabel: input.plan?.selectedPathwayLabel ?? null,
  });
  if (approvedListDisplayTitle) {
    return approvedListDisplayTitle;
  }

  return (
    input.titleFallbackAuditRows[input.visibleOptionIndex - 1]?.displayedTitle ||
    input.optionGroup.title ||
    `Requirement Choice ${input.visibleOptionIndex}`
  );
}

export function buildSuggestedScheduleCopyOnlyOptionBoxSummaryText(input: {
  rawOptionGroups: SuggestedScheduleOptionGroup[];
  trackOptionGroups: SuggestedScheduleOptionGroup[];
  displayedOptionGroups: SuggestedScheduleOptionGroup[];
  forceNumberedOptionTitles?: boolean;
  preserveOriginalOptionTitles?: boolean;
}) {
  const displayedTitleFallbackAuditRows = auditOptionTitleFallback({
    optionGroups: input.displayedOptionGroups,
    forceNumberedTitles: input.forceNumberedOptionTitles,
    preserveOriginalTitles: input.preserveOriginalOptionTitles,
  });
  const formatIds = (
    optionGroups: SuggestedScheduleOptionGroup[],
    titleFallbackAuditRows?: ReturnType<typeof auditOptionTitleFallback>
  ) =>
    optionGroups.length
      ? optionGroups
          .map((optionGroup, index) => {
            const title =
              titleFallbackAuditRows?.[index]?.displayedTitle ?? optionGroup.title;
            return `${title}::${optionGroup.id}`;
          })
          .join(" | ")
      : "none";

  return [
    "[copy-only option box summary]",
    `Raw group count: ${input.rawOptionGroups.length}`,
    `Raw quarter option group count: ${input.rawOptionGroups.length}`,
    `Raw quarter option groups: ${formatIds(input.rawOptionGroups)}`,
    `Matched track option group count: ${input.trackOptionGroups.length}`,
    `Matched track option groups: ${formatIds(input.trackOptionGroups)}`,
    `Displayed group count: ${input.displayedOptionGroups.length}`,
    `Displayed option group count: ${input.displayedOptionGroups.length}`,
    `Displayed option groups: ${formatIds(
      input.displayedOptionGroups,
      displayedTitleFallbackAuditRows
    )}`,
  ].join(" ");
}

export function buildSuggestedScheduleCopyOnlyOptionGroupVisibilityText(input: {
  optionGroup: SuggestedScheduleOptionGroup;
  displayTitle: string;
  isOpen: boolean;
}) {
  return [
    "[copy-only option group visibility]",
    `Group id: ${input.optionGroup.id}`,
    `Group title: ${input.displayTitle}`,
    `Original group title: ${input.optionGroup.title || "none"}`,
    "Is visible: yes",
    "Is in option box: yes",
    `Is open: ${input.isOpen ? "yes" : "no"}`,
    `Selected count: ${getSuggestedScheduleOptionGroupSelectedCount(input.optionGroup)}`,
    `Required count: ${getSuggestedScheduleOptionGroupRequiredSelectionCount(input.optionGroup)}`,
    `Resolved satisfied option ids: ${
      getSuggestedScheduleResolvedOptionIds(input.optionGroup).join(", ") || "none"
    }`,
  ].join(" ");
}

export function buildSuggestedScheduleCopyOnlySelectedOptionStateText(input: {
  plannerPathKey: string;
  optionGroup: SuggestedScheduleOptionGroup;
}) {
  return [
    "[copy-only selected option state]",
    `Path key: ${input.plannerPathKey}`,
    `Group id: ${input.optionGroup.id}`,
    `Selected ids: ${
      getSuggestedScheduleUniqueOptionIds(input.optionGroup.selectedOptionIds).join(", ") ||
      "none"
    }`,
    `Resolved satisfied ids: ${
      getSuggestedScheduleResolvedOptionIds(input.optionGroup).join(", ") || "none"
    }`,
  ].join(" ");
}

export function buildSuggestedScheduleCopyOnlyOptionDropdownHeaderText(input: {
  optionGroup: SuggestedScheduleOptionGroup;
  isOpen: boolean;
  displayTitle: string;
  statusText: string;
  progressText: string;
  transcriptSatisfierText?: string | null;
}) {
  return [
    "[copy-only option dropdown header]",
    `Group id: ${input.optionGroup.id}`,
    `Visible header title: ${input.displayTitle}`,
    `Visible header status: ${input.statusText}`,
    `Transcript satisfier: ${input.transcriptSatisfierText || "none"}`,
    `Visible header progress: ${input.progressText}`,
    `Is open: ${input.isOpen ? "yes" : "no"}`,
  ].join(" ");
}

export function getSuggestedScheduleOptionGroupTranscriptSatisfierText(
  optionGroup: SuggestedScheduleOptionGroup
) {
  return getSuggestedScheduleSelectedOptions(optionGroup)
    .map((option) =>
      isSuggestedScheduleCategoryOption(option)
        ? getSuggestedScheduleOptionCompletedTranscriptSatisfierText(optionGroup, option.id)
        : null
    )
    .filter(Boolean)
    .join(", ");
}

export function getSuggestedScheduleOptionGroupRequiredSelectionCount(
  optionGroup: SuggestedScheduleOptionGroup
) {
  return Math.max(1, Math.ceil(Number(optionGroup.selectionCount ?? 1) || 1));
}

export function isSuggestedScheduleUnresolvedOptionPromptCourse(
  course: SuggestedQuarterPlan["courses"][number]
) {
  const optionGroup = course.optionGroup ?? null;
  if (!optionGroup?.isSelectionPrompt || course.status === "completed") {
    return false;
  }

  const selectedCount = getSuggestedScheduleOptionGroupSelectedCount(optionGroup);
  const requiredSelectionCount = getSuggestedScheduleOptionGroupRequiredSelectionCount(optionGroup);
  return selectedCount < requiredSelectionCount;
}

export function buildSuggestedScheduleRenderedQuarters(quarters: SuggestedQuarterPlan[]) {
  return quarters
    .map((quarter) => ({
      ...quarter,
      courses: quarter.courses.filter(
        (course) => !isSuggestedScheduleUnresolvedOptionPromptCourse(course)
      ),
    }))
    .filter((quarter) => quarter.phase !== "planned" || quarter.courses.length > 0);
}

export function buildSuggestedScheduleCreditRangeQuarters(quarters: SuggestedQuarterPlan[]) {
  return quarters.map((quarter) => ({
    ...quarter,
    courses: quarter.courses.map((course) => {
      if (!isSuggestedScheduleUnresolvedOptionPromptCourse(course)) {
        return course;
      }

      const creditRange = getSuggestedCourseCreditRange(course);
      return {
        ...course,
        creditAmount: null,
        creditMin: 0,
        creditMax: creditRange.creditMax,
      };
    }),
  }));
}
