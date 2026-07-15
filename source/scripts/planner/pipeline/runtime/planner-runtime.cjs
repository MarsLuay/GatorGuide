"use strict";

/**
 * P11-A/B runtime boundary harness — catalog read port + pure engine signature.
 */

function createPlannerCatalogPort(snapshot) {
  const data = snapshot || {};
  return {
    getCampuses: () => data.campuses || [],
    getPrograms: (campus) =>
      (data.programs || []).filter((p) => !campus || p.campus === campus),
    getPathways: (programId) =>
      (data.pathways || []).filter((p) => p.programId === programId),
    getRequirements: (programId) => data.requirements?.[programId] || null,
    getEquivalencies: () => data.equivalencies || [],
    getCourse: (code) => data.courses?.[code] || null,
    getAvailability: (code) => data.availability?.[code] || null,
    getCatalogYear: () => data.catalogYear || null,
    getEvidence: (factId) => data.evidence?.[factId] || null,
    getSnapshotId: () => data.snapshotId || null,
  };
}

/**
 * Pure Living Plan Engine entry (behavior still delegated / strangler).
 * @param {object} input
 * @param {{ build?: Function }} [deps]
 */
function buildLivingTransferPlan(input, deps = {}) {
  if (!input?.catalogSnapshotId) {
    throw new Error("catalogSnapshotId required");
  }
  if (!input?.activeTarget?.campus || !input?.activeTarget?.programId) {
    throw new Error("activeTarget.campus and programId required");
  }
  if (typeof deps.build === "function") {
    return deps.build(input);
  }
  return {
    kind: "living-transfer-plan",
    catalogSnapshotId: input.catalogSnapshotId,
    activeTarget: input.activeTarget,
    quarters: [],
    status: "noop-strangler",
    message: "engine facade — migrate runtime.ts incrementally (P11-B)",
  };
}

module.exports = {
  createPlannerCatalogPort,
  buildLivingTransferPlan,
};
