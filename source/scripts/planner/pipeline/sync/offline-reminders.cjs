"use strict";

/**
 * P18 offline mutation queue + reminder intents harness.
 */

function createOfflineMutationQueue() {
  const queue = [];
  return {
    enqueue(mutation) {
      queue.push({ ...mutation, id: `m${queue.length + 1}` });
    },
    list() {
      return queue.slice();
    },
    async replay(apply) {
      const applied = [];
      while (queue.length) {
        const next = queue[0];
        await apply(next);
        applied.push(queue.shift());
      }
      return applied;
    },
  };
}

function resolvePlanConflict({ local, remote, rule = "higher-revision-wins" } = {}) {
  const lr = Number(local?.revision ?? 0);
  const rr = Number(remote?.revision ?? 0);
  if (rule !== "higher-revision-wins") {
    throw new Error(`unsupported-rule:${rule}`);
  }
  if (rr > lr) return { winner: "remote", plan: remote };
  if (lr > rr) return { winner: "local", plan: local };
  // equal revision → newer timestamp
  const lt = Number(local?.updatedAt ?? 0);
  const rt = Number(remote?.updatedAt ?? 0);
  if (rt > lt) return { winner: "remote", plan: remote };
  return { winner: "local", plan: local };
}

function deriveReminderIntents({ timeline = [], offsetsDays = [7, 1, 0], nowMs = Date.now() } = {}) {
  const intents = [];
  for (const entry of timeline) {
    if (!entry?.dueAt || entry.completed) continue;
    for (const offset of offsetsDays) {
      intents.push({
        id: `reminder:${entry.id}:${offset}d`,
        entryId: entry.id,
        fireAt: entry.dueAt,
        offsetDays: offset,
        localeNeutral: true,
        createdAtMs: nowMs,
      });
    }
  }
  return intents;
}

function scheduleLocalReminders({ intents = [], existingIds = new Set() } = {}) {
  const scheduled = [];
  const cancelled = [];
  for (const intent of intents) {
    if (existingIds.has(intent.id)) continue;
    scheduled.push({ ...intent, deviceLocalId: `local:${intent.id}` });
  }
  return { scheduled, cancelled };
}

module.exports = {
  createOfflineMutationQueue,
  resolvePlanConflict,
  deriveReminderIntents,
  scheduleLocalReminders,
};
