"use strict";

/**
 * P16-A/B unknown-safe opportunity matching + timeline projection harness.
 */

function matchOpportunities({ opportunities = [], profile = {} } = {}) {
  const knownKeys = ["campus", "major", "transferYear", "gpa", "residency"];
  const hasAnySignal = knownKeys.some(
    (k) => profile[k] != null && String(profile[k]).trim() !== ""
  );
  if (!hasAnySignal || opportunities.length === 0) {
    return opportunities.map((o) => ({
      ...o,
      relevance: "fallback-all",
      reasons: [{ code: "NO_PROFILE_SIGNALS" }],
    }));
  }

  const matched = opportunities
    .map((o) => {
      const reasons = [];
      let excluded = false;
      if (
        o.campus &&
        profile.campus &&
        String(o.campus).toLowerCase() !== String(profile.campus).toLowerCase()
      ) {
        excluded = true;
        reasons.push({ code: "CAMPUS_MISMATCH", expected: o.campus, actual: profile.campus });
      }
      if (
        o.major &&
        profile.major &&
        String(o.major).toLowerCase() !== String(profile.major).toLowerCase()
      ) {
        // Soft: unknown majors elsewhere stay neutral; known mismatch excludes.
        excluded = true;
        reasons.push({ code: "MAJOR_MISMATCH", expected: o.major, actual: profile.major });
      }
      // Unknown attributes on either side never exclude.
      return excluded
        ? null
        : {
            ...o,
            relevance: reasons.length ? "partial" : "match",
            reasons: reasons.length ? reasons : [{ code: "ATTRIBUTE_MATCH" }],
          };
    })
    .filter(Boolean);

  // Plan exit: hard mismatch that empties the set falls back to all active opportunities.
  if (matched.length === 0) {
    return opportunities.map((o) => ({
      ...o,
      relevance: "fallback-all",
      reasons: [{ code: "FALLBACK_AFTER_MISMATCH" }],
    }));
  }
  return matched;
}

function projectTransferTimeline({
  activeTarget,
  planMilestones = [],
  opportunities = [],
  personalDeadlines = [],
  completion = {},
} = {}) {
  if (!activeTarget?.campus || !activeTarget?.programId) {
    throw new Error("activeTarget required");
  }
  const entries = [];
  for (const m of planMilestones) {
    entries.push({
      id: `plan:${m.id}`,
      sourceType: "plan-milestone",
      dueAt: m.dueAt,
      destination: "planner",
      message: { key: m.messageKey || "timeline.planMilestone", params: m.params || {} },
      done: Boolean(completion[m.id]),
    });
  }
  for (const o of opportunities) {
    if (!o.dueAt) continue;
    entries.push({
      id: `opp:${o.id}`,
      sourceType: "opportunity",
      dueAt: o.dueAt,
      destination: "resources",
      message: { key: "timeline.opportunity", params: { id: o.id } },
      done: Boolean(completion[`opp:${o.id}`]),
    });
  }
  for (const p of personalDeadlines) {
    entries.push({
      id: `personal:${p.id}`,
      sourceType: "personal",
      dueAt: p.dueAt,
      destination: null,
      message: { key: "timeline.personal", params: { id: p.id } },
      done: Boolean(completion[`personal:${p.id}`]),
    });
  }
  return entries.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
}

module.exports = { matchOpportunities, projectTransferTimeline };
