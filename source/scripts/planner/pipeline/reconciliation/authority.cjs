"use strict";

/** P07-E authority reconciliation — block publication on material conflict. */

const AUTHORITY_ORDER = Object.freeze([
  "program-owned-current",
  "campus-catalog",
  "uw-grc-equivalency",
  "grc-catalog-schedule",
]);

function reconcileFacts(facts = []) {
  const byKey = new Map();
  const conflicts = [];
  for (const fact of facts) {
    const key = fact.key;
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, fact);
      continue;
    }
    if (existing.value === fact.value) {
      existing.evidence = [...(existing.evidence || []), ...(fact.evidence || [])];
      continue;
    }
    const existingRank = AUTHORITY_ORDER.indexOf(existing.authority);
    const nextRank = AUTHORITY_ORDER.indexOf(fact.authority);
    if (existingRank === -1 || (nextRank !== -1 && nextRank < existingRank)) {
      conflicts.push({ key, kept: fact, displaced: existing });
      byKey.set(key, fact);
    } else if (nextRank === existingRank || nextRank === -1) {
      conflicts.push({ key, left: existing, right: fact, material: true });
    }
  }
  return {
    facts: [...byKey.values()],
    conflicts,
    publishBlocked: conflicts.some((c) => c.material),
  };
}

module.exports = { AUTHORITY_ORDER, reconcileFacts };
