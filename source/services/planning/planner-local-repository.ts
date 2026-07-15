/**
 * P18 local-first planner state repository (TS port of pipeline/offline/local-first.cjs).
 *
 * AppData / AsyncStorage / localStorage holds plannerV2 as the offline source of truth.
 * Firestore (and any remote merge) is sync-only — not a read prerequisite for Living Plan
 * timeline projection or calendar offline entries.
 */

import type { PlannerV2State } from "@/hooks/app-data/planner-state-v2";
import { createEmptyPlannerV2 } from "@/hooks/app-data/planner-state-v2";

export type PlannerLocalSnapshot = {
  plannerV2: PlannerV2State;
  revision: number;
};

export type OfflineTimelineEntry = {
  id: string;
  dueAt: string;
  sourceType: "living-plan" | "opportunity";
};

export function createMemoryPlannerStateRepository(seed?: Partial<PlannerLocalSnapshot>) {
  let state: PlannerLocalSnapshot = {
    plannerV2: seed?.plannerV2
      ? { ...createEmptyPlannerV2(), ...seed.plannerV2 }
      : createEmptyPlannerV2(),
    revision: Number(seed?.revision || 0),
  };

  return {
    async read(): Promise<PlannerLocalSnapshot> {
      return structuredClone(state);
    },
    async write(next: PlannerV2State): Promise<PlannerLocalSnapshot> {
      state = {
        plannerV2: structuredClone(next),
        revision: state.revision + 1,
      };
      return structuredClone(state);
    },
    async mergeRemote(remote: PlannerLocalSnapshot): Promise<{
      winner: "local" | "remote";
      state: PlannerLocalSnapshot;
    }> {
      // Higher remote revision wins; local wins ties / older remotes.
      // Remote presence is never required before local reads/writes.
      const remoteRev = Number(remote?.revision || 0);
      if (remoteRev > state.revision) {
        state = structuredClone(remote);
        return { winner: "remote", state: structuredClone(state) };
      }
      return { winner: "local", state: structuredClone(state) };
    },
    getRevision(): number {
      return state.revision;
    },
  };
}

/**
 * Project Living Plan quarters (+ optional local opportunities) into timeline
 * entries with no network. Mirrors CJS `projectTimelineOffline`.
 */
export function projectTimelineOffline(input: {
  plan?: {
    quarters?: Array<{
      key?: string;
      id?: string;
      label?: string;
      courseIds?: string[];
    }>;
  } | null;
  opportunities?: Array<{ id: string; dueAt?: string | null }>;
}): OfflineTimelineEntry[] {
  const entries: OfflineTimelineEntry[] = [];
  for (const q of input.plan?.quarters || []) {
    const key = String(q.key || q.id || "").trim();
    if (!key) continue;
    entries.push({
      id: `plan:${key}`,
      dueAt: key,
      sourceType: "living-plan",
    });
  }
  for (const o of input.opportunities || []) {
    if (!o?.dueAt) continue;
    entries.push({
      id: `opp:${o.id}`,
      dueAt: String(o.dueAt),
      sourceType: "opportunity",
    });
  }
  return entries.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
}
