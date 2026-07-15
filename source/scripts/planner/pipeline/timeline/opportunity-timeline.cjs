"use strict";

/**
 * P16-A unknown-safe opportunity relevance + P16-B timeline projection harness.
 */

function matchOpportunities({ opportunities = [], profile = {} } = {}) {
  const knownKeys = ["campus", "major", "transferYear", "gpa", "residency"];
  const hasAnySignal = knownKeys.some(
    (k) => profile[k] !== undefined && profile[k] !== null && profile[k] !== ""
  );
  if (!hasAnySignal || opportunities.length === 0) {
    return opportunities.map((o) => ({
      ...o,
      relevance: "fallback-all",
      reasons: [{ code: "fallback_all" }],
    }));
  }

  const matched = [];
  for (const opportunity of opportunities) {
    const reasons = [];
    let hardMismatch = false;
    if (opportunity.campus && profile.campus && opportunity.campus !== profile.campus) {
      hardMismatch = true;
      reasons.push({ code: "campus_mismatch", expected: opportunity.campus });
    }
    if (opportunity.major && profile.major && opportunity.major !== profile.major) {
      hardMismatch = true;
      reasons.push({ code: "major_mismatch", expected: opportunity.major });
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
      relevance: "fallback-all",
      reasons: [{ code: "fallback_all_after_mismatch" }],
    }));
  }
  return matched;
}

function projectTransferTimeline({
  plan = null,
  opportunities = [],
  personalDeadlines = [],
} = {}) {
  const entries = [];
  for (const q of plan?.quarters || []) {
    entries.push({
      id: `plan:${q.key}`,
      sourceType: "living-plan",
      dueAt: q.key,
      destination: "transferPlanner",
      message: { code: "quarter_milestone", params: { quarter: q.key } },
    });
  }
  for (const o of opportunities) {
    if (!o.dueAt) continue;
    entries.push({
      id: `opp:${o.id}`,
      sourceType: "opportunity",
      dueAt: o.dueAt,
      destination: "resources",
      message: { code: "opportunity_deadline", params: { id: o.id } },
    });
  }
  for (const p of personalDeadlines) {
    entries.push({
      id: `personal:${p.id}`,
      sourceType: "personal",
      dueAt: p.dueAt,
      destination: null,
      message: { code: "personal_deadline", params: { id: p.id } },
    });
  }
  return entries.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
}

module.exports = { matchOpportunities, projectTransferTimeline };
