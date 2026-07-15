/**
 * P16-A/B TypeScript ports of unknown-safe opportunity matching + timeline projection.
 */

export type OpportunityMatchProfile = {
  campus?: string | null;
  major?: string | null;
  transferYear?: string | number | null;
  gpa?: string | number | null;
  residency?: string | null;
};

export type OpportunityCandidate = {
  id: string;
  campus?: string | null;
  major?: string | null;
  dueAt?: string | null;
  [key: string]: unknown;
};

export type OpportunityMatchReason = {
  code: string;
  expected?: string | null;
  actual?: string | null;
};

export type MatchedOpportunity = OpportunityCandidate & {
  relevance: "fallback-all" | "matched";
  reasons: OpportunityMatchReason[];
};

const KNOWN_KEYS = ["campus", "major", "transferYear", "gpa", "residency"] as const;

export function matchOpportunities(input: {
  opportunities?: OpportunityCandidate[];
  profile?: OpportunityMatchProfile;
}): MatchedOpportunity[] {
  const opportunities = input.opportunities ?? [];
  const profile = input.profile ?? {};
  const hasAnySignal = KNOWN_KEYS.some((k) => {
    const v = profile[k];
    return v !== undefined && v !== null && String(v).trim() !== "";
  });

  if (!hasAnySignal || opportunities.length === 0) {
    return opportunities.map((o) => ({
      ...o,
      relevance: "fallback-all" as const,
      reasons: [{ code: "fallback_all" }],
    }));
  }

  const matched: MatchedOpportunity[] = [];
  for (const opportunity of opportunities) {
    const reasons: OpportunityMatchReason[] = [];
    let hardMismatch = false;
    if (opportunity.campus && profile.campus && opportunity.campus !== profile.campus) {
      hardMismatch = true;
      reasons.push({
        code: "campus_mismatch",
        expected: opportunity.campus,
        actual: profile.campus,
      });
    }
    if (opportunity.major && profile.major && opportunity.major !== profile.major) {
      hardMismatch = true;
      reasons.push({
        code: "major_mismatch",
        expected: opportunity.major,
        actual: profile.major,
      });
    }
    if (!hardMismatch) {
      matched.push({
        ...opportunity,
        relevance: "matched",
        reasons: reasons.length ? reasons : [{ code: "compatible" }],
      });
    }
  }

  if (matched.length === 0) {
    return opportunities.map((o) => ({
      ...o,
      relevance: "fallback-all" as const,
      reasons: [{ code: "fallback_all_after_mismatch" }],
    }));
  }
  return matched;
}

export type TimelineEntry = {
  id: string;
  sourceType: "living-plan" | "opportunity" | "personal";
  dueAt: string;
  destination: "transferPlanner" | "resources" | null;
  message: { code: string; params: Record<string, string> };
  done?: boolean;
};

export function projectTransferTimeline(input: {
  plan?: { quarters?: Array<{ key: string }> } | null;
  opportunities?: Array<{ id: string; dueAt?: string | null }>;
  personalDeadlines?: Array<{ id: string; dueAt: string }>;
  completion?: Record<string, boolean>;
}): TimelineEntry[] {
  const completion = input.completion ?? {};
  const entries: TimelineEntry[] = [];
  for (const q of input.plan?.quarters || []) {
    entries.push({
      id: `plan:${q.key}`,
      sourceType: "living-plan",
      dueAt: q.key,
      destination: "transferPlanner",
      message: { code: "quarter_milestone", params: { quarter: q.key } },
      done: Boolean(completion[`plan:${q.key}`]),
    });
  }
  for (const o of input.opportunities || []) {
    if (!o.dueAt) continue;
    entries.push({
      id: `opp:${o.id}`,
      sourceType: "opportunity",
      dueAt: o.dueAt,
      destination: "resources",
      message: { code: "opportunity_deadline", params: { id: o.id } },
      done: Boolean(completion[`opp:${o.id}`]),
    });
  }
  for (const p of input.personalDeadlines || []) {
    entries.push({
      id: `personal:${p.id}`,
      sourceType: "personal",
      dueAt: p.dueAt,
      destination: null,
      message: { code: "personal_deadline", params: { id: p.id } },
      done: Boolean(completion[`personal:${p.id}`]),
    });
  }
  return entries.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
}
