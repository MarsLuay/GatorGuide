type ValueOf<T> = T[keyof T];

export const OPPORTUNITY_TYPES = {
  scholarship: "scholarship",
  internship: "internship",
  generalDeadline: "general_deadline",
  collegeDeadline: "college_deadline",
  quarterStart: "quarter-start",
  quarterEnd: "quarter-end",
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

export const OPPORTUNITY_DEADLINE_TYPES = {
  priority: "priority",
  final: "final",
  rolling: "rolling",
} as const;

export type OpportunityDeadlineType = ValueOf<typeof OPPORTUNITY_DEADLINE_TYPES>;

export const OPPORTUNITY_PROGRESS_STATES = {
  saved: "saved",
  started: "started",
  submitted: "submitted",
  won: "won",
  expired: "expired",
} as const;

export type OpportunityProgressState = ValueOf<typeof OPPORTUNITY_PROGRESS_STATES>;

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
  recommendationCountMin: number;
  essayCount: number;
};

export type OpportunityAward = {
  amountMin: number | null;
  amountMax: number | null;
  currency: string;
  amountText: string | null;
  renewable: boolean | null;
};

export type OpportunityEligibility = {
  gpaMin: number | null;
  residencyTypes: string[];
  transferOnly: boolean;
};

export type OpportunityDeadline = {
  type: OpportunityDeadlineType;
  label: string | null;
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
  deadline: OpportunityDeadline;
  matching: OpportunityMatching;
  eligibility: OpportunityEligibility;
  requirements: OpportunityRequirements;
  award: OpportunityAward;
  college: OpportunityCollege;
  source: OpportunitySource;
  createdAt: string | null;
  updatedAt: string | null;
};

export type UserOpportunityStatus = {
  schemaVersion: number;
  userId: string;
  opportunityId: string;
  progress: OpportunityProgressState | null;
  progressUpdatedAt: string | null;
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

function clampNumber(value: unknown, min: number, max: number) {
  const parsed = Number(String(value ?? ""));
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

export function normalizeResidencyTag(value: unknown): string {
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
  if ((Object.values(OPPORTUNITY_TYPES) as string[]).includes(parsed)) {
    return parsed as OpportunityType;
  }
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

export function normalizeOpportunityDeadlineType(
  value: unknown
): OpportunityDeadlineType {
  const parsed = String(value ?? "").trim();
  if (parsed === OPPORTUNITY_DEADLINE_TYPES.priority) {
    return OPPORTUNITY_DEADLINE_TYPES.priority;
  }
  if (parsed === OPPORTUNITY_DEADLINE_TYPES.rolling) {
    return OPPORTUNITY_DEADLINE_TYPES.rolling;
  }
  return OPPORTUNITY_DEADLINE_TYPES.final;
}

export function normalizeOpportunityProgress(
  value: unknown
): OpportunityProgressState | null {
  const parsed = String(value ?? "").trim();
  if (parsed === OPPORTUNITY_PROGRESS_STATES.saved) {
    return OPPORTUNITY_PROGRESS_STATES.saved;
  }
  if (parsed === OPPORTUNITY_PROGRESS_STATES.started) {
    return OPPORTUNITY_PROGRESS_STATES.started;
  }
  if (parsed === OPPORTUNITY_PROGRESS_STATES.submitted) {
    return OPPORTUNITY_PROGRESS_STATES.submitted;
  }
  if (parsed === OPPORTUNITY_PROGRESS_STATES.won) {
    return OPPORTUNITY_PROGRESS_STATES.won;
  }
  if (parsed === OPPORTUNITY_PROGRESS_STATES.expired) {
    return OPPORTUNITY_PROGRESS_STATES.expired;
  }
  return null;
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

function getLocalDateStartTime(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate()
  ).getTime();
}

function isBeforeLocalToday(value: Date, now: Date) {
  return getLocalDateStartTime(value) < getLocalDateStartTime(now);
}

export function resolveOpportunityDueDate(
  opportunity: Pick<Opportunity, "dueAt" | "recurrence">,
  now: Date = new Date()
): Date | null {
  if (opportunity.recurrence?.isYearly) {
    const recurrence = normalizeOpportunityRecurrence(opportunity.recurrence);
    const currentYear = now.getFullYear();
    const thisYear = buildRecurrenceDate(currentYear, recurrence);
    if (thisYear && !isBeforeLocalToday(thisYear, now)) {
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

export function isCompletedOpportunityProgress(
  progress: OpportunityProgressState | null | undefined
) {
  return (
    progress === OPPORTUNITY_PROGRESS_STATES.submitted ||
    progress === OPPORTUNITY_PROGRESS_STATES.won ||
    progress === OPPORTUNITY_PROGRESS_STATES.expired
  );
}

function getStoredOpportunityProgress(
  status: Pick<UserOpportunityStatus, "progress" | "isDone"> | null | undefined
) {
  const normalized = normalizeOpportunityProgress(status?.progress);
  if (normalized) return normalized;
  return status?.isDone ? OPPORTUNITY_PROGRESS_STATES.submitted : null;
}

function shouldAutoExpireOpportunity(
  opportunity: Pick<Opportunity, "dueAt" | "recurrence">,
  now: Date = new Date()
) {
  if (opportunity.recurrence?.isYearly) return false;
  const dueAt = normalizeOpportunityDate(opportunity.dueAt);
  if (!dueAt) return false;
  const parsed = new Date(dueAt);
  if (Number.isNaN(parsed.getTime())) return false;
  return isBeforeLocalToday(parsed, now);
}

export function resolveOpportunityProgress(
  opportunity: Pick<Opportunity, "dueAt" | "recurrence">,
  status:
    | Pick<UserOpportunityStatus, "progress" | "isDone" | "doneCycleKey">
    | null
    | undefined,
  now: Date = new Date()
): OpportunityProgressState | null {
  const storedProgress = getStoredOpportunityProgress(status);
  if (storedProgress && isCompletedOpportunityProgress(storedProgress)) {
    const cycleKey = resolveOpportunityCycleKey(opportunity, now);
    if (!status?.doneCycleKey || status.doneCycleKey === cycleKey) {
      return storedProgress;
    }
    return null;
  }

  if (storedProgress && !isCompletedOpportunityProgress(storedProgress)) {
    return storedProgress;
  }

  if (shouldAutoExpireOpportunity(opportunity, now)) {
    return OPPORTUNITY_PROGRESS_STATES.expired;
  }

  return null;
}

export function isOpportunityDoneForCurrentCycle(
  opportunity: Pick<Opportunity, "dueAt" | "recurrence">,
  status:
    | Pick<UserOpportunityStatus, "progress" | "isDone" | "doneCycleKey">
    | null
    | undefined,
  now: Date = new Date()
) {
  return isCompletedOpportunityProgress(
    resolveOpportunityProgress(opportunity, status, now)
  );
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

export function normalizeOpportunityEligibility(
  value: Partial<OpportunityEligibility> | null | undefined
): OpportunityEligibility {
  return {
    gpaMin: clampNumber(value?.gpaMin, 0, 5),
    residencyTypes: Array.from(
      new Set(
        (Array.isArray(value?.residencyTypes) ? value?.residencyTypes : [])
          .map(normalizeResidencyTag)
          .filter(Boolean)
      )
    ),
    transferOnly: !!value?.transferOnly,
  };
}

export function normalizeOpportunityAward(
  value: Partial<OpportunityAward> | null | undefined
): OpportunityAward {
  const amountMin = clampNumber(value?.amountMin, 0, Number.MAX_SAFE_INTEGER);
  const amountMax = clampNumber(value?.amountMax, 0, Number.MAX_SAFE_INTEGER);
  return {
    amountMin,
    amountMax,
    currency: String(value?.currency ?? "").trim().toUpperCase() || "USD",
    amountText: String(value?.amountText ?? "").trim() || null,
    renewable:
      typeof value?.renewable === "boolean" ? value.renewable : null,
  };
}

export function normalizeOpportunityDeadline(
  value: Partial<OpportunityDeadline> | null | undefined,
  dueAt: string | null
): OpportunityDeadline {
  return {
    type: normalizeOpportunityDeadlineType(
      value?.type ?? (dueAt ? OPPORTUNITY_DEADLINE_TYPES.final : OPPORTUNITY_DEADLINE_TYPES.rolling)
    ),
    label: String(value?.label ?? "").trim() || null,
  };
}

export function normalizeOpportunity(input: Partial<Opportunity>): Opportunity {
  const matching: Partial<OpportunityMatching> = input.matching ?? {};
  const eligibility: Partial<OpportunityEligibility> = input.eligibility ?? {};
  const requirements: Partial<OpportunityRequirements> = input.requirements ?? {};
  const award: Partial<OpportunityAward> = input.award ?? {};
  const deadline: Partial<OpportunityDeadline> = input.deadline ?? {};
  const college: Partial<OpportunityCollege> = input.college ?? {};
  const source: Partial<OpportunitySource> = input.source ?? {};
  const dueAt = normalizeOpportunityDate(input.dueAt);
  const recommendationCountMin = Math.max(
    0,
    Number.parseInt(
      String(
        requirements.recommendationCountMin ??
          (requirements.needsRecommendations ? 1 : 0)
      ),
      10
    ) || 0
  );

  return {
    schemaVersion: Number(input.schemaVersion) || OPPORTUNITY_SCHEMA_VERSION,
    opportunityId: normalizeOpportunityId(input.opportunityId),
    type: normalizeOpportunityType(input.type),
    status: normalizeOpportunityStatus(input.status),
    title: String(input.title ?? "").trim() || "Untitled Opportunity",
    organizationName: String(input.organizationName ?? "").trim(),
    summary: String(input.summary ?? "").trim(),
    externalUrl: String(input.externalUrl ?? "").trim() || null,
    dueAt,
    recurrence: normalizeOpportunityRecurrence(input.recurrence),
    deadline: normalizeOpportunityDeadline(deadline, dueAt),
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
    eligibility: normalizeOpportunityEligibility(eligibility),
    requirements: {
      needsRecommendations:
        recommendationCountMin > 0 || !!requirements.needsRecommendations,
      recommendationCountMin,
      essayCount: Math.max(0, Number.parseInt(String(requirements.essayCount ?? 0), 10) || 0),
    },
    award: normalizeOpportunityAward(award),
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
  const progress = normalizeOpportunityProgress(
    input.progress ?? (input.isDone ? OPPORTUNITY_PROGRESS_STATES.submitted : null)
  );
  const isDone = isCompletedOpportunityProgress(progress) || !!input.isDone;
  const progressUpdatedAt =
    normalizeOpportunityDate(input.progressUpdatedAt ?? input.doneAt) ?? null;

  return {
    schemaVersion: Number(input.schemaVersion) || OPPORTUNITY_SCHEMA_VERSION,
    userId: String(input.userId ?? userId).trim() || userId,
    opportunityId: normalizeOpportunityId(input.opportunityId ?? opportunityId),
    progress,
    progressUpdatedAt,
    isDone,
    doneAt: isDone
      ? normalizeOpportunityDate(input.doneAt ?? progressUpdatedAt)
      : null,
    doneCycleKey: String(input.doneCycleKey ?? "").trim() || null,
    clientUpdatedAt,
    updatedAt: normalizeOpportunityDate(input.updatedAt),
  };
}
