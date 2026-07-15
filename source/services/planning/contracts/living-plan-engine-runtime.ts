/**
 * P11-A/B Living Transfer Plan engine — pure planner boundary.
 * Does not yet replace transfer-planner runtime.ts producers.
 */

import {
  clampPreferredLoad,
  DEFAULT_PREFERRED_LOAD,
} from "@/services/planning/contracts/planner-v2-constraints";

export type CatalogSnapshotId = string;

export type PlannerCatalog = {
  getCampuses(): readonly string[];
  getProgram(runtimeId: string): unknown | null;
  getSnapshotId(): CatalogSnapshotId;
};

export type LivingTransferPlanInput = {
  catalogSnapshotId: CatalogSnapshotId;
  activeTargetRuntimeId: string;
  intendedTransferQuarterId: string;
  preferredLoadCredits?: number;
  unavailableQuarterIds?: string[];
  normalizedCourseIds?: string[];
  placementOverrides?: PlacementOverride[];
};

export type PlacementOverride = {
  courseInstanceId: string;
  preferredQuarterId: string;
  locked: boolean;
};

export type LivingTransferPlan = {
  catalogSnapshotId: CatalogSnapshotId;
  activeTargetRuntimeId: string;
  intendedTransferQuarterId: string;
  quarters: Array<{ quarterId: string; courseInstanceIds: string[] }>;
  conflicts: Array<{ code: string; message: string }>;
};

const QUARTER_ORDER = ["winter", "spring", "summer", "fall"] as const;

function parseQuarterId(quarterId: string): { year: number; season: string } | null {
  const raw = String(quarterId || "").trim().toLowerCase().replace(/\bautumn\b/g, "fall");
  const m = raw.match(/^(20\d{2})[-_ ]?(winter|spring|summer|fall)$/);
  if (m) return { year: Number(m[1]), season: m[2] };
  const m2 = raw.match(/^(winter|spring|summer|fall)[-_ ]?(20\d{2})$/);
  if (m2) return { year: Number(m2[2]), season: m2[1] };
  // ISO date → academic-ish quarter bucket by month
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    const month = d.getMonth();
    const year = d.getFullYear();
    if (month <= 2) return { year, season: "winter" };
    if (month <= 5) return { year, season: "spring" };
    if (month <= 7) return { year, season: "summer" };
    return { year, season: "fall" };
  }
  return null;
}

function formatQuarterId(year: number, season: string) {
  return `${year}-${season}`;
}

function previousQuarter(year: number, season: string): { year: number; season: string } {
  const idx = QUARTER_ORDER.indexOf(season as (typeof QUARTER_ORDER)[number]);
  if (idx <= 0) return { year: year - 1, season: "fall" };
  return { year, season: QUARTER_ORDER[idx - 1] };
}

/** Walk backward from intended transfer quarter, skipping unavailable. */
export function buildPlanningQuarterSequence(
  intendedTransferQuarterId: string,
  count: number,
  unavailableQuarterIds: string[] = []
): string[] {
  const blocked = new Set(
    unavailableQuarterIds.map((q) => String(q).trim().toLowerCase()).filter(Boolean)
  );
  const intended = parseQuarterId(intendedTransferQuarterId);
  if (!intended || count <= 0) return [];

  const out: string[] = [];
  let cursor = intended;
  // Start at the quarter before transfer (planning window).
  cursor = previousQuarter(cursor.year, cursor.season);
  let guard = 0;
  while (out.length < count && guard < count * 8) {
    guard += 1;
    const id = formatQuarterId(cursor.year, cursor.season);
    if (!blocked.has(id.toLowerCase())) out.push(id);
    cursor = previousQuarter(cursor.year, cursor.season);
  }
  return out.reverse();
}

function courseInstanceId(code: string, quarterId: string, index: number) {
  const compact = String(code || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  return `${compact}@${quarterId}#${index}`;
}

export function buildLivingTransferPlan(
  input: LivingTransferPlanInput
): LivingTransferPlan {
  const catalogSnapshotId = input?.catalogSnapshotId || "";
  const activeTargetRuntimeId = input?.activeTargetRuntimeId || "";
  const intendedTransferQuarterId = input?.intendedTransferQuarterId || "";

  if (!catalogSnapshotId || !activeTargetRuntimeId || !intendedTransferQuarterId) {
    return {
      catalogSnapshotId,
      activeTargetRuntimeId,
      intendedTransferQuarterId,
      quarters: [],
      conflicts: [{ code: "invalid-input", message: "catalog, target, and intended quarter required" }],
    };
  }

  const conflicts: Array<{ code: string; message: string }> = [];
  const load = clampPreferredLoad(Number(input.preferredLoadCredits) || DEFAULT_PREFERRED_LOAD);
  const courseIds = [...(input.normalizedCourseIds || [])].filter(Boolean);
  const overrides = [...(input.placementOverrides || [])];
  const lockedByInstance = new Map(
    overrides.filter((o) => o.locked).map((o) => [o.courseInstanceId, o.preferredQuarterId])
  );

  const quarterCount = Math.max(1, Math.ceil(courseIds.length / load) || 1);
  const sequence = buildPlanningQuarterSequence(
    intendedTransferQuarterId,
    quarterCount,
    input.unavailableQuarterIds || []
  );

  if (!sequence.length) {
    conflicts.push({
      code: "no-available-quarters",
      message: "no planning quarters after unavailable filter",
    });
  }

  const quarterMap = new Map<string, string[]>();
  for (const q of sequence) quarterMap.set(q, []);

  // Honor locked overrides first (may introduce quarters outside sequence).
  const placed = new Set<string>();
  for (const [instanceId, quarterId] of lockedByInstance) {
    if (!quarterMap.has(quarterId)) quarterMap.set(quarterId, []);
    quarterMap.get(quarterId)!.push(instanceId);
    placed.add(instanceId);
  }

  let cursor = 0;
  for (const code of courseIds) {
    const preferredOverride = overrides.find(
      (o) =>
        !o.locked &&
        o.courseInstanceId.startsWith(
          String(code).toUpperCase().replace(/\s+/g, "") + "@"
        )
    );
    let quarterId =
      preferredOverride?.preferredQuarterId ||
      sequence[Math.min(cursor, Math.max(0, sequence.length - 1))] ||
      sequence[0];
    if (!quarterId) {
      conflicts.push({ code: "unplaced-course", message: `no quarter for ${code}` });
      continue;
    }
    if (!quarterMap.has(quarterId)) quarterMap.set(quarterId, []);
    const bucket = quarterMap.get(quarterId)!;
    // Soft load: advance to next sequence quarter when full.
    if (
      !preferredOverride &&
      bucket.length >= load &&
      cursor < sequence.length - 1
    ) {
      cursor += 1;
      quarterId = sequence[cursor];
      if (!quarterMap.has(quarterId)) quarterMap.set(quarterId, []);
    }
    const instanceId = courseInstanceId(code, quarterId, quarterMap.get(quarterId)!.length);
    if (placed.has(instanceId)) continue;
    quarterMap.get(quarterId)!.push(instanceId);
    if (!preferredOverride && quarterMap.get(quarterId)!.length >= load) {
      cursor = Math.min(cursor + 1, Math.max(0, sequence.length - 1));
    }
  }

  const quarters = [...quarterMap.entries()]
    .map(([quarterId, courseInstanceIds]) => ({ quarterId, courseInstanceIds }))
    .sort((a, b) => a.quarterId.localeCompare(b.quarterId));

  return {
    catalogSnapshotId,
    activeTargetRuntimeId,
    intendedTransferQuarterId,
    quarters,
    conflicts,
  };
}

export function createInMemoryPlannerCatalog(
  campuses: string[],
  programs: Record<string, unknown>,
  snapshotId: string
): PlannerCatalog {
  return {
    getCampuses: () => campuses,
    getProgram: (runtimeId) => programs[runtimeId] ?? null,
    getSnapshotId: () => snapshotId,
  };
}
