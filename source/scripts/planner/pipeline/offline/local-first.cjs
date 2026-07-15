"use strict";

/**
 * P18 offline/local-first repository harness.
 * Firestore is sync, not a read prerequisite.
 */

function createMemoryPlannerStateRepository(seed = {}) {
  let state = structuredClone(seed);
  let revision = Number(seed.revision || 0);

  return {
    async read() {
      return structuredClone(state);
    },
    async write(next) {
      revision += 1;
      state = { ...structuredClone(next), revision };
      return structuredClone(state);
    },
    async mergeRemote(remote) {
      const local = state;
      const remoteRev = Number(remote?.revision || 0);
      if (remoteRev > revision) {
        state = structuredClone(remote);
        revision = remoteRev;
        return { winner: "remote", state: structuredClone(state) };
      }
      return { winner: "local", state: structuredClone(local) };
    },
    getRevision() {
      return revision;
    },
  };
}

function projectTimelineOffline({ plan, opportunities }) {
  // Local projection — no network.
  const entries = [];
  for (const q of plan?.quarters || []) {
    entries.push({ id: `plan:${q.key}`, dueAt: q.key, sourceType: "living-plan" });
  }
  for (const o of opportunities || []) {
    if (o.dueAt) entries.push({ id: `opp:${o.id}`, dueAt: o.dueAt, sourceType: "opportunity" });
  }
  return entries.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
}

module.exports = {
  createMemoryPlannerStateRepository,
  projectTimelineOffline,
};
