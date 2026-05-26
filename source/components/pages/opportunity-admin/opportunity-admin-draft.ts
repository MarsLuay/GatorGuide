import {
  OPPORTUNITY_DEADLINE_TYPES,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  type Opportunity,
} from "@/constants/opportunities";
import type { UpsertManualOpportunityInput } from "@/services/opportunities/opportunity-gateway.service";

export type OpportunityAdminDraft = {
  opportunityId: string;
  type: string;
  status: string;
  title: string;
  organizationName: string;
  summary: string;
  externalUrl: string;
  dueDate: string;
  isYearly: boolean;
  timezone: string;
  deadlineType: string;
  deadlineLabel: string;
  financialAidTags: string;
  suggestedMajors: string;
  hasToBeMajor: boolean;
  gpaMin: string;
  residencyTypes: string;
  communityTags: string;
  transferOnly: boolean;
  recommendationCountMin: string;
  essayCount: string;
  awardAmountMin: string;
  awardAmountMax: string;
  awardCurrency: string;
  awardAmountText: string;
  awardRenewable: "" | "true" | "false";
  collegeId: string;
  collegeName: string;
  collegeCity: string;
  collegeState: string;
  collegeWebsite: string;
  sourceUrl: string;
  sourceLabel: string;
};

export const TYPE_OPTIONS = [
  OPPORTUNITY_TYPES.scholarship,
  OPPORTUNITY_TYPES.internship,
  OPPORTUNITY_TYPES.generalDeadline,
  OPPORTUNITY_TYPES.collegeDeadline,
  OPPORTUNITY_TYPES.quarterStart,
  OPPORTUNITY_TYPES.quarterEnd,
] as const;

export const STATUS_OPTIONS = [
  OPPORTUNITY_STATUSES.active,
  OPPORTUNITY_STATUSES.draft,
  OPPORTUNITY_STATUSES.archived,
] as const;

export const DEADLINE_TYPE_OPTIONS = [
  OPPORTUNITY_DEADLINE_TYPES.final,
  OPPORTUNITY_DEADLINE_TYPES.priority,
  OPPORTUNITY_DEADLINE_TYPES.rolling,
] as const;

export function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function parseNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatChoiceLabel(option: string) {
  return option.replace(/_/g, " ");
}

export function createBlankDraft(): OpportunityAdminDraft {
  return {
    opportunityId: "",
    type: OPPORTUNITY_TYPES.scholarship,
    status: OPPORTUNITY_STATUSES.active,
    title: "",
    organizationName: "",
    summary: "",
    externalUrl: "",
    dueDate: "",
    isYearly: false,
    timezone: "America/Los_Angeles",
    deadlineType: OPPORTUNITY_DEADLINE_TYPES.final,
    deadlineLabel: "",
    financialAidTags: "",
    suggestedMajors: "",
    hasToBeMajor: false,
    gpaMin: "",
    residencyTypes: "",
    communityTags: "",
    transferOnly: false,
    recommendationCountMin: "",
    essayCount: "",
    awardAmountMin: "",
    awardAmountMax: "",
    awardCurrency: "USD",
    awardAmountText: "",
    awardRenewable: "",
    collegeId: "",
    collegeName: "",
    collegeCity: "",
    collegeState: "",
    collegeWebsite: "",
    sourceUrl: "",
    sourceLabel: "",
  };
}

export function buildDraftFromOpportunity(opportunity: Opportunity): OpportunityAdminDraft {
  return {
    opportunityId: opportunity.opportunityId,
    type: opportunity.type,
    status: opportunity.status,
    title: opportunity.title,
    organizationName: opportunity.organizationName,
    summary: opportunity.summary,
    externalUrl: opportunity.externalUrl ?? "",
    dueDate: toDateInput(opportunity.dueAt),
    isYearly: !!opportunity.recurrence.isYearly,
    timezone: opportunity.recurrence.timezone ?? "America/Los_Angeles",
    deadlineType: opportunity.deadline.type,
    deadlineLabel: opportunity.deadline.label ?? "",
    financialAidTags: (opportunity.matching.financialAidTags ?? []).join(", "),
    suggestedMajors: (opportunity.matching.suggestedMajors ?? []).join(", "),
    hasToBeMajor: !!opportunity.matching.hasToBeMajor,
    gpaMin: opportunity.eligibility.gpaMin == null ? "" : String(opportunity.eligibility.gpaMin),
    residencyTypes: (opportunity.eligibility.residencyTypes ?? []).join(", "),
    communityTags: (opportunity.eligibility.communityTags ?? []).join(", "),
    transferOnly: !!opportunity.eligibility.transferOnly,
    recommendationCountMin:
      opportunity.requirements.recommendationCountMin == null
        ? ""
        : String(opportunity.requirements.recommendationCountMin),
    essayCount:
      opportunity.requirements.essayCount == null
        ? ""
        : String(opportunity.requirements.essayCount),
    awardAmountMin:
      opportunity.award.amountMin == null ? "" : String(opportunity.award.amountMin),
    awardAmountMax:
      opportunity.award.amountMax == null ? "" : String(opportunity.award.amountMax),
    awardCurrency: opportunity.award.currency || "USD",
    awardAmountText: opportunity.award.amountText ?? "",
    awardRenewable:
      opportunity.award.renewable == null
        ? ""
        : opportunity.award.renewable
          ? "true"
          : "false",
    collegeId: opportunity.college.collegeId ?? "",
    collegeName: opportunity.college.collegeName ?? "",
    collegeCity: opportunity.college.city ?? "",
    collegeState: opportunity.college.state ?? "",
    collegeWebsite: opportunity.college.website ?? "",
    sourceUrl: opportunity.source.sourceUrl ?? "",
    sourceLabel: opportunity.source.sourceLabel ?? "",
  };
}

export function validateOpportunityAdminDraft(draft: OpportunityAdminDraft) {
  if (!draft.title.trim()) {
    return {
      isValid: false,
      title: "Missing title",
      message: "Add a title before saving this opportunity.",
    };
  }

  if (!draft.summary.trim()) {
    return {
      isValid: false,
      title: "Missing summary",
      message: "Add a short summary before saving this opportunity.",
    };
  }

  return {
    isValid: true,
    title: "",
    message: "",
  };
}

export function buildSaveInput(draft: OpportunityAdminDraft): UpsertManualOpportunityInput {
  return {
    opportunityId: draft.opportunityId.trim() || null,
    type: draft.type,
    status: draft.status,
    title: draft.title.trim(),
    organizationName: draft.organizationName.trim(),
    summary: draft.summary.trim(),
    externalUrl: draft.externalUrl.trim() || null,
    dueDate: draft.deadlineType === OPPORTUNITY_DEADLINE_TYPES.rolling ? null : draft.dueDate.trim() || null,
    isYearly: draft.isYearly,
    timezone: draft.timezone.trim() || null,
    deadlineType: draft.deadlineType,
    deadlineLabel: draft.deadlineLabel.trim() || null,
    financialAidTags: parseList(draft.financialAidTags),
    suggestedMajors: parseList(draft.suggestedMajors),
    hasToBeMajor: draft.hasToBeMajor,
    gpaMin: parseNullableNumber(draft.gpaMin),
    residencyTypes: parseList(draft.residencyTypes),
    communityTags: parseList(draft.communityTags),
    transferOnly: draft.transferOnly,
    recommendationCountMin: parseNullableNumber(draft.recommendationCountMin),
    essayCount: parseNullableNumber(draft.essayCount),
    awardAmountMin: parseNullableNumber(draft.awardAmountMin),
    awardAmountMax: parseNullableNumber(draft.awardAmountMax),
    awardCurrency: draft.awardCurrency.trim() || "USD",
    awardAmountText: draft.awardAmountText.trim() || null,
    awardRenewable:
      draft.awardRenewable === ""
        ? null
        : draft.awardRenewable === "true",
    collegeId: draft.collegeId.trim() || null,
    collegeName: draft.collegeName.trim() || null,
    collegeCity: draft.collegeCity.trim() || null,
    collegeState: draft.collegeState.trim() || null,
    collegeWebsite: draft.collegeWebsite.trim() || null,
    sourceUrl: draft.sourceUrl.trim() || null,
    sourceLabel: draft.sourceLabel.trim() || null,
  };
}

export function formatOpportunityMeta(opportunity: Opportunity) {
  return [opportunity.type, opportunity.status, opportunity.source.kind]
    .filter(Boolean)
    .join(" \u00e2\u20ac\u00a2 ");
}

export function formatOpportunityDue(opportunity: Opportunity) {
  if (opportunity.deadline.type === OPPORTUNITY_DEADLINE_TYPES.rolling) {
    return "Rolling deadline";
  }
  return toDateInput(opportunity.dueAt) || "No due date";
}
