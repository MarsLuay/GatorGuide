import type { TransferPlannerChecklistItem } from "@/constants/transfer-planner-source/student-runtime";

import {
  getChecklistChoiceLabels,
  getRequirementOptionCourseLabels,
  getRequirementOptionCreditValue,
  getRequirementOptionId,
  getRequirementOptionSelectionKey,
  normalizeSelectedRequirementOptionIds,
  normalizeUserUnselectedRequirementOptionIds,
} from "./requirement-status";

export type PlannerRequirementOptionSelectionMap = Record<
  string,
  string[] | string | null | undefined
>;

const CHECKLIST_CHOICE_PREVIEW_LIMIT = 8;

type PlannerOptionDisplay = {
  id: string;
  label?: string | null;
  selectedLabel?: string | null;
  optionKind?: string | null;
  categoryOption?: {
    title?: string | null;
    credits?: number | null;
    sourceCategoryCode?: string | null;
  } | null;
};

type PlannerOptionDisplayGroup = {
  options: PlannerOptionDisplay[];
};

type PlannerOptionSelectionCreditRange = {
  creditAmount?: number | null;
  creditMin?: number | null;
  creditMax?: number | null;
};

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function hasExplicitPlannerSelectedRequirementOptionIds(
  item: TransferPlannerChecklistItem,
  selectedRequirementOptionIdsByGroup?: PlannerRequirementOptionSelectionMap
) {
  const selectionKey = getRequirementOptionSelectionKey(item);
  return Boolean(
    selectedRequirementOptionIdsByGroup &&
      (Object.prototype.hasOwnProperty.call(selectedRequirementOptionIdsByGroup, selectionKey) ||
        Object.prototype.hasOwnProperty.call(selectedRequirementOptionIdsByGroup, item.id))
  );
}

export function getPlannerSelectedRequirementOptionIds(
  item: TransferPlannerChecklistItem,
  selectedRequirementOptionIdsByGroup?: PlannerRequirementOptionSelectionMap
) {
  const selectionKey = getRequirementOptionSelectionKey(item);
  const hasExplicitSelection = hasExplicitPlannerSelectedRequirementOptionIds(
    item,
    selectedRequirementOptionIdsByGroup
  );
  const selectedValue =
    selectedRequirementOptionIdsByGroup?.[selectionKey] ??
    selectedRequirementOptionIdsByGroup?.[item.id];
  const selectedIds = normalizeSelectedRequirementOptionIds(selectedValue);
  if (hasExplicitSelection) {
    return selectedIds;
  }
  if (selectedIds.length) {
    return selectedIds;
  }

  return normalizeSelectedRequirementOptionIds(item.selectedRequirementOptionIds);
}

export function getPlannerUserUnselectedRequirementOptionIds(
  item: TransferPlannerChecklistItem,
  selectedRequirementOptionIdsByGroup?: PlannerRequirementOptionSelectionMap
) {
  const selectionKey = getRequirementOptionSelectionKey(item);
  const selectedValue =
    selectedRequirementOptionIdsByGroup?.[selectionKey] ??
    selectedRequirementOptionIdsByGroup?.[item.id];
  return normalizeUserUnselectedRequirementOptionIds(selectedValue);
}

export function getRequirementOptionLabelsByIds(
  item: TransferPlannerChecklistItem,
  optionIds: string[] | null | undefined
) {
  const optionIdSet = new Set((optionIds ?? []).map((optionId) => String(optionId ?? "").trim()).filter(Boolean));
  if (!item.requirementGroup || !optionIdSet.size) {
    return [];
  }

  return unique(
    (item.requirementGroup.options ?? [])
      .filter((option) => option.id && optionIdSet.has(option.id))
      .flatMap((option) => getRequirementOptionCourseLabels(option))
  );
}

export function getRequirementOptionDisplayLabelsByIds(
  optionGroup: PlannerOptionDisplayGroup,
  optionIds: string[] | null | undefined
) {
  const optionIdSet = new Set(
    (optionIds ?? []).map((optionId) => String(optionId ?? "").trim()).filter(Boolean)
  );
  if (!optionIdSet.size) {
    return [] as string[];
  }

  return unique(
    optionGroup.options
      .filter((option) => optionIdSet.has(option.id))
      .map((option) => option.selectedLabel || option.label)
      .filter((label): label is string => Boolean(label))
  );
}

export function getCategoryOptionDisplayLabelsByIds(
  optionGroup: PlannerOptionDisplayGroup,
  optionIds: string[] | null | undefined
) {
  const optionIdSet = new Set(
    (optionIds ?? []).map((optionId) => String(optionId ?? "").trim()).filter(Boolean)
  );
  if (!optionIdSet.size) {
    return [] as string[];
  }

  return unique(
    optionGroup.options
      .filter((option) => optionIdSet.has(option.id) && isRequirementCategoryOption(option))
      .map((option) => getRequirementCategoryOptionLabel(option))
      .filter((label): label is string => Boolean(label))
  );
}

function buildChooseNRequirementLabel(item: TransferPlannerChecklistItem, chooseCount: number) {
  const cleanedTitle = String(item.title ?? "")
    .replace(/^One\s*(?:\(\s*1\s*\))?\s*/i, "")
    .replace(/^Two\s+/i, "")
    .trim();
  return `Choose ${chooseCount} ${cleanedTitle || "options"}`;
}

function buildChooseCreditsRequirementLabel(item: TransferPlannerChecklistItem) {
  const minCredits = item.minCredits ?? item.requirementGroup?.minCredits ?? null;
  const maxCredits = item.maxCredits ?? item.requirementGroup?.maxCredits ?? null;
  const labelContext = `${item.requirementGroup?.id ?? ""} ${item.requirementGroup?.subcategory ?? ""} ${item.title ?? ""}`;

  if (minCredits != null && minCredits > 0) {
    if (/mse-nme-core-elective|nme_core_elective/i.test(labelContext)) {
      return `NME Option Core/Elective Requirement: ${minCredits} credits`;
    }
    if (/engineering-fundamentals/i.test(labelContext)) {
      return `Choose at least ${minCredits} credits from Engineering Fundamentals electives`;
    }
    if (/mse-400-level|mse_400_level/i.test(labelContext)) {
      return `Choose at least ${minCredits} credits from MSE 400-level technical electives`;
    }
    return `Choose at least ${minCredits} credits from ${String(item.title ?? "approved options").trim()}`;
  }

  if (maxCredits != null && maxCredits > 0) {
    if (/outside-mse|outside_mse/i.test(labelContext)) {
      return `Up to ${maxCredits} credits may count from approved outside-MSE technical electives`;
    }
    return `Up to ${maxCredits} credits may count from ${String(item.title ?? "approved options").trim()}`;
  }

  return `${String(item.title ?? "Approved options").trim()} - choose approved credits`;
}

export function buildChecklistChoiceLabel(
  item: TransferPlannerChecklistItem,
  remainingNeeded: number,
  matchedCount: number
) {
  if (item.requirementGroup?.requirementType === "choose_n") {
    return buildChooseNRequirementLabel(item, remainingNeeded);
  }

  if (item.requirementGroup?.requirementType === "choose_credits") {
    return buildChooseCreditsRequirementLabel(item);
  }

  const chooseLabel =
    `Choose ${remainingNeeded === 1 ? "one" : remainingNeeded}${
      matchedCount > 0 ? " more" : ""
    } from this list`;
  return `${item.title} - ${chooseLabel}`;
}

export function buildChecklistChoiceGuidanceSummary(
  item: TransferPlannerChecklistItem,
  remainingNeeded: number,
  matchedCount: number,
  baseGuidanceSummary: string | null
) {
  const choiceLabels = getChecklistChoiceLabels(item);
  const previewLabels = choiceLabels.slice(0, CHECKLIST_CHOICE_PREVIEW_LIMIT);
  const hiddenCount = Math.max(choiceLabels.length - previewLabels.length, 0);
  const chooseLabel =
    item.requirementGroup?.requirementType === "choose_n"
      ? buildChooseNRequirementLabel(item, remainingNeeded)
      : item.requirementGroup?.requirementType === "choose_credits"
      ? buildChooseCreditsRequirementLabel(item)
      : `Choose ${
          remainingNeeded === 1 ? "one" : remainingNeeded
        }${matchedCount > 0 ? " more" : ""} from this list`;
  const choicesSummary = previewLabels.length
    ? `${chooseLabel}: ${previewLabels.join(", ")}${hiddenCount > 0 ? `, plus ${hiddenCount} more` : ""}.`
    : `${chooseLabel}.`;

  return baseGuidanceSummary ? `${choicesSummary} ${baseGuidanceSummary}` : choicesSummary;
}

export function getRequirementOptionSelectionCount(item: TransferPlannerChecklistItem) {
  const group = item.requirementGroup;
  const optionCount = group?.options.length ?? 0;
  const rawSelectionCount =
    item.minCompletedCount ??
    group?.minCourses ??
    (group?.requirementType === "choose_one" || group?.requirementType === "sequence_choice"
      ? 1
      : 0);
  const selectionCount = Number(rawSelectionCount);

  if (!Number.isFinite(selectionCount) || selectionCount <= 0) {
    return optionCount > 0 ? 1 : 0;
  }

  return optionCount > 0
    ? Math.max(1, Math.min(optionCount, Math.ceil(selectionCount)))
    : Math.max(1, Math.ceil(selectionCount));
}

export function getRequirementOptionSelectionCountForSuggestedOptions(
  item: TransferPlannerChecklistItem,
  options: PlannerOptionSelectionCreditRange[]
) {
  const group = item.requirementGroup;
  const optionCount = options.length;
  if (!optionCount) return 0;

  if (group?.requirementType === "choose_credits") {
    const requiredCredits = Number(item.minCredits ?? group.minCredits ?? 0);
    if (Number.isFinite(requiredCredits) && requiredCredits > 0) {
      let selectedCreditTotal = 0;
      let selectedOptionCount = 0;
      const optionCredits = options
        .map(getSuggestedQuarterCourseOptionMaximumCreditValue)
        .filter((creditValue) => creditValue > 0)
        .sort((left, right) => right - left);

      for (const creditValue of optionCredits) {
        selectedCreditTotal += creditValue;
        selectedOptionCount += 1;
        if (selectedCreditTotal >= requiredCredits) {
          return selectedOptionCount;
        }
      }

      return Math.max(1, Math.min(optionCount, optionCredits.length || optionCount));
    }
  }

  return Math.min(getRequirementOptionSelectionCount(item), optionCount);
}

function getSuggestedQuarterCourseOptionMaximumCreditValue(
  option: PlannerOptionSelectionCreditRange
) {
  const creditValue = Number(option.creditMax ?? option.creditAmount ?? option.creditMin ?? 0);
  return Number.isFinite(creditValue) && creditValue > 0 ? creditValue : 0;
}

export function getRequirementOptionIds(item: TransferPlannerChecklistItem) {
  return (item.requirementGroup?.options ?? []).map((option, optionIndex) =>
    getRequirementOptionId(item, option, optionIndex)
  );
}

export function selectedCreditBucketOptionsAreInsufficientForDefault(
  item: TransferPlannerChecklistItem,
  optionIds: string[]
) {
  const group = item.requirementGroup;
  if (!requirementGroupLooksLikeStudentChoiceCreditBucket(group) || !optionIds.length) {
    return false;
  }

  const minCredits = Number(item.minCredits ?? group?.minCredits ?? 0);
  if (!Number.isFinite(minCredits) || minCredits <= 0) {
    return false;
  }

  const optionIdSet = new Set(optionIds);
  const selectedCredits = (group?.options ?? []).reduce((total, option, optionIndex) => {
    const optionId = getRequirementOptionId(item, option, optionIndex);
    return optionIdSet.has(optionId) ? total + getRequirementOptionCreditValue(option) : total;
  }, 0);
  return selectedCredits > 0 && selectedCredits < minCredits;
}

function requirementGroupLooksLikeStudentChoiceCreditBucket(
  group: TransferPlannerChecklistItem["requirementGroup"] | null | undefined
) {
  if (!group || group.requirementType !== "choose_credits") {
    return false;
  }

  const labelContext = `${group.category} ${group.subcategory ?? ""} ${group.label} ${group.sourceHeading ?? ""}`;
  return /\b(?:approved|electives?)\b/i.test(labelContext);
}

function isRequirementCategoryOption(
  option: PlannerOptionDisplay | null | undefined
) {
  return option?.optionKind === "category-option" && !!option.categoryOption;
}

function getRequirementCategoryOptionLabel(option: PlannerOptionDisplay) {
  const categoryOption = option.categoryOption;
  return (
    categoryOption?.title ||
    option.label ||
    (categoryOption?.credits && categoryOption?.sourceCategoryCode
      ? `${categoryOption.credits} credits of ${categoryOption.sourceCategoryCode}`
      : "")
  );
}
