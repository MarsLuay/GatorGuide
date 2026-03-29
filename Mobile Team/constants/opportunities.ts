type ValueOf<T> = T[keyof T];

export const OPPORTUNITY_TYPES = {
  scholarship: "scholarship",
  internship: "internship",
  collegeDeadline: "college_deadline",
} as const;

export type OpportunityType = ValueOf<typeof OPPORTUNITY_TYPES>;

export const OPPORTUNITY_STATUSES = {
  draft: "draft",
  active: "active",
  archived: "archived",
} as const;

export type OpportunityCatalogStatus = ValueOf<typeof OPPORTUNITY_STATUSES>;

export const OPPORTUNITY_SOURCE_KINDS = {
  manual: "manual",
  seed: "seed",
  aiCollegeDeadline: "ai_college_deadline",
} as const;

export type OpportunitySourceKind = ValueOf<typeof OPPORTUNITY_SOURCE_KINDS>;

export const OPPORTUNITY_FINANCIAL_AID_TAGS = {
  needBased: "need_based",
  merit: "merit",
  lowCost: "low_cost",
  pellFriendly: "pell_friendly",
  fafsaRequired: "fafsa_required",
  workStudy: "work_study",
} as const;

export type OpportunityFinancialAidTag =
  ValueOf<typeof OPPORTUNITY_FINANCIAL_AID_TAGS>;

export const OPPORTUNITY_SCHEMA_VERSION = 1 as const;
export const OPPORTUNITY_NOTIFICATION_OFFSETS_DAYS = [7, 1, 0] as const;

export type OpportunityRecurrence = {
  isYearly: boolean;
  month: number | null;
  day: number | null;
  timezone: string | null;
};

export type OpportunityMatching = {
  financialAidTags: OpportunityFinancialAidTag[] | string[];
  suggestedMajors: string[];
  hasToBeMajor: boolean;
};

export type OpportunityRequirements = {
  needsRecommendations: boolean;
  essayCount: number;
};

export type OpportunityCollege = {
  collegeId: string | null;
  collegeName: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
};

export type OpportunitySource = {
  kind: OpportunitySourceKind | string;
  sourceUrl: string | null;
  sourceLabel: string | null;
  model: string | null;
  fetchedAt: string | null;
  verifiedAt: string | null;
};

export type Opportunity = {
  schemaVersion: number;
  opportunityId: string;
  type: OpportunityType;
  status: OpportunityCatalogStatus;
  title: string;
  organizationName: string;
  summary: string;
  externalUrl: string | null;
  dueAt: string | null;
  recurrence: OpportunityRecurrence;
  matching: OpportunityMatching;
  requirements: OpportunityRequirements;
  college: OpportunityCollege;
  source: OpportunitySource;
  createdAt: string | null;
  updatedAt: string | null;
};

export type UserOpportunityStatus = {
  schemaVersion: number;
  userId: string;
  opportunityId: string;
  isDone: boolean;
  doneAt: string | null;
  doneCycleKey: string | null;
  clientUpdatedAt: string;
  updatedAt: string | null;
};

function clampInteger(value: unknown, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

export function normalizeMajorTag(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeOpportunityId(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeOpportunityType(value: unknown): OpportunityType {
  const parsed = String(value ?? "").trim();
  if (parsed === OPPORTUNITY_TYPES.internship) return OPPORTUNITY_TYPES.internship;
  if (parsed === OPPORTUNITY_TYPES.collegeDeadline) return OPPORTUNITY_TYPES.collegeDeadline;
  return OPPORTUNITY_TYPES.scholarship;
}

export function normalizeOpportunityStatus(
  value: unknown
): OpportunityCatalogStatus {
  const parsed = String(value ?? "").trim();
  if (parsed === OPPORTUNITY_STATUSES.draft) return OPPORTUNITY_STATUSES.draft;
  if (parsed === OPPORTUNITY_STATUSES.archived) return OPPORTUNITY_STATUSES.archived;
  return OPPORTUNITY_STATUSES.active;
}

export function normalizeOpportunityDate(value: unknown): string | null {
  if (value && typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function") {
    try {
      const parsed = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    } catch {
      return null;
    }
  }
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return null;
  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildRecurrenceDate(
  year: number,
  recurrence: OpportunityRecurrence
): Date | null {
  if (!recurrence.isYearly || recurrence.month == null || recurrence.day == null) {
    return null;
  }

  const parsed = new Date(year, recurrence.month - 1, recurrence.day, 9, 0, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== recurrence.month - 1 ||
    parsed.getDate() !== recurrence.day
  ) {
    return null;
  }

  return parsed;
}

export function resolveOpportunityDueDate(
  opportunity: Pick<Opportunity, "dueAt" | "recurrence">,
  now: Date = new Date()
): Date | null {
  if (opportunity.recurrence?.isYearly) {
    const recurrence = normalizeOpportunityRecurrence(opportunity.recurrence);
    const currentYear = now.getFullYear();
    const thisYear = buildRecurrenceDate(currentYear, recurrence);
    if (thisYear && thisYear.getTime() > now.getTime()) {
      return thisYear;
    }

    const nextYear = buildRecurrenceDate(currentYear + 1, recurrence);
    if (nextYear) return nextYear;
  }

  const dueAt = normalizeOpportunityDate(opportunity.dueAt);
  if (!dueAt) return null;
  const parsed = new Date(dueAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveOpportunityCycleKey(
  opportunity: Pick<Opportunity, "dueAt" | "recurrence">,
  now: Date = new Date()
): string {
  if (!opportunity.recurrence?.isYearly) return "one_time";
  const dueDate = resolveOpportunityDueDate(opportunity, now);
  return dueDate ? String(dueDate.getFullYear()) : String(now.getFullYear());
}

export function isOpportunityDoneForCurrentCycle(
  opportunity: Pick<Opportunity, "dueAt" | "recurrence">,
  status: Pick<UserOpportunityStatus, "isDone" | "doneCycleKey"> | null | undefined,
  now: Date = new Date()
) {
  if (!status?.isDone) return false;
  return status.doneCycleKey === resolveOpportunityCycleKey(opportunity, now);
}

export function normalizeOpportunityRecurrence(
  value: Partial<OpportunityRecurrence> | null | undefined
): OpportunityRecurrence {
  const isYearly = !!value?.isYearly;
  return {
    isYearly,
    month: isYearly ? clampInteger(value?.month, 1, 12) : null,
    day: isYearly ? clampInteger(value?.day, 1, 31) : null,
    timezone: String(value?.timezone ?? "").trim() || "America/Los_Angeles",
  };
}

export function normalizeOpportunity(input: Partial<Opportunity>): Opportunity {
  const matching: Partial<OpportunityMatching> = input.matching ?? {};
  const requirements: Partial<OpportunityRequirements> = input.requirements ?? {};
  const college: Partial<OpportunityCollege> = input.college ?? {};
  const source: Partial<OpportunitySource> = input.source ?? {};

  return {
    schemaVersion: Number(input.schemaVersion) || OPPORTUNITY_SCHEMA_VERSION,
    opportunityId: normalizeOpportunityId(input.opportunityId),
    type: normalizeOpportunityType(input.type),
    status: normalizeOpportunityStatus(input.status),
    title: String(input.title ?? "").trim() || "Untitled Opportunity",
    organizationName: String(input.organizationName ?? "").trim(),
    summary: String(input.summary ?? "").trim(),
    externalUrl: String(input.externalUrl ?? "").trim() || null,
    dueAt: normalizeOpportunityDate(input.dueAt),
    recurrence: normalizeOpportunityRecurrence(input.recurrence),
    matching: {
      financialAidTags: Array.from(
        new Set(
          (Array.isArray(matching.financialAidTags) ? matching.financialAidTags : [])
            .map((tag) => String(tag ?? "").trim())
            .filter(Boolean)
        )
      ),
      suggestedMajors: Array.from(
        new Set(
          (Array.isArray(matching.suggestedMajors) ? matching.suggestedMajors : [])
            .map(normalizeMajorTag)
            .filter(Boolean)
        )
      ),
      hasToBeMajor: !!matching.hasToBeMajor,
    },
    requirements: {
      needsRecommendations: !!requirements.needsRecommendations,
      essayCount: Math.max(0, Number.parseInt(String(requirements.essayCount ?? 0), 10) || 0),
    },
    college: {
      collegeId: String(college.collegeId ?? "").trim() || null,
      collegeName: String(college.collegeName ?? "").trim() || null,
      city: String(college.city ?? "").trim() || null,
      state: String(college.state ?? "").trim() || null,
      website: String(college.website ?? "").trim() || null,
    },
    source: {
      kind: String(source.kind ?? OPPORTUNITY_SOURCE_KINDS.manual).trim() || OPPORTUNITY_SOURCE_KINDS.manual,
      sourceUrl: String(source.sourceUrl ?? "").trim() || null,
      sourceLabel: String(source.sourceLabel ?? "").trim() || null,
      model: String(source.model ?? "").trim() || null,
      fetchedAt: normalizeOpportunityDate(source.fetchedAt),
      verifiedAt: normalizeOpportunityDate(source.verifiedAt),
    },
    createdAt: normalizeOpportunityDate(input.createdAt),
    updatedAt: normalizeOpportunityDate(input.updatedAt),
  };
}

export function normalizeUserOpportunityStatus(
  input: Partial<UserOpportunityStatus>,
  userId: string,
  opportunityId: string
): UserOpportunityStatus {
  const clientUpdatedAt =
    normalizeOpportunityDate(input.clientUpdatedAt) ?? new Date().toISOString();

  return {
    schemaVersion: Number(input.schemaVersion) || OPPORTUNITY_SCHEMA_VERSION,
    userId: String(input.userId ?? userId).trim() || userId,
    opportunityId: normalizeOpportunityId(input.opportunityId ?? opportunityId),
    isDone: !!input.isDone,
    doneAt: normalizeOpportunityDate(input.doneAt),
    doneCycleKey: String(input.doneCycleKey ?? "").trim() || null,
    clientUpdatedAt,
    updatedAt: normalizeOpportunityDate(input.updatedAt),
  };
}
