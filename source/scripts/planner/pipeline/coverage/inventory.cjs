"use strict";

/**
 * P10-A coverage inventory — program rows + legacy count domain separation.
 */

function createCoverageInventory(rows = []) {
  const errors = [];
  const seen = new Set();
  let pathwayCount = 0;

  for (const row of rows) {
    const required = [
      "runtimeId",
      "campus",
      "programTitle",
      "primarySourceFamily",
      "catalogYear",
      "credential",
    ];
    for (const key of required) {
      if (!row?.[key]) {
        errors.push({ type: "missing-field", field: key, runtimeId: row?.runtimeId });
      }
    }
    if (row?.runtimeId) {
      if (seen.has(row.runtimeId)) {
        errors.push({ type: "duplicate-runtime-id", runtimeId: row.runtimeId });
      }
      seen.add(row.runtimeId);
    }
    if (row?.pathwayId) pathwayCount += 1;
  }

  return {
    ok: errors.length === 0,
    errors,
    counts: {
      programs: seen.size,
      pathways: pathwayCount,
      rows: rows.length,
    },
    rows,
  };
}

function reconcileLegacyCounts(inventory, legacy) {
  return {
    ...inventory,
    legacyMajorPlans: legacy.majorPlans,
    legacyPathways: legacy.pathways,
    legacyPrimaryOwners: legacy.primaryOwners,
    legacySourceOwnerBlocks: legacy.sourceOwnerBlocks,
    note: "majorPlans/pathways/primaryOwners/sourceOwnerBlocks are different identities — do not conflate",
  };
}

/** Alternate aggregate helper used by domain-count characterization. */
function buildCoverageInventory({
  majorPlans = [],
  pathways = [],
  primaryOwners = [],
  sourceOwnerBlocks = [],
} = {}) {
  const programs = majorPlans.map((p) => ({
    runtimeId: p.id || p.planId,
    campus: p.campus,
    title: p.title || p.name,
    primarySource: p.primarySource || null,
    family: p.family || null,
    catalogYear: p.catalogYear || null,
  }));
  const ownerIds = new Set(primaryOwners.map((o) => o.id || o.ownerId));
  const blockOwners = new Set(
    sourceOwnerBlocks.map((b) => b.ownerId || b.sourceOwnerId)
  );
  return {
    counts: {
      majorPlans: majorPlans.length,
      pathways: pathways.length,
      primaryOwners: ownerIds.size,
      sourceOwnerBlocks: sourceOwnerBlocks.length,
      distinctBlockOwners: blockOwners.size,
    },
    domains: [
      "majorPlans",
      "pathways",
      "primaryOwners",
      "sourceOwnerBlocks",
    ],
    programs,
    missingPrimarySource: programs.filter((p) => !p.primarySource),
    duplicateRuntimeIds: findDuplicates(programs.map((p) => p.runtimeId)),
  };
}

function findDuplicates(ids) {
  const seen = new Set();
  const dupes = new Set();
  for (const id of ids) {
    if (!id) continue;
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}

function assertCountDomainsSeparated(inventory) {
  const c = inventory.counts;
  return (
    typeof c.majorPlans === "number" &&
    typeof c.pathways === "number" &&
    typeof c.primaryOwners === "number" &&
    typeof c.sourceOwnerBlocks === "number"
  );
}

module.exports = {
  createCoverageInventory,
  reconcileLegacyCounts,
  buildCoverageInventory,
  assertCountDomainsSeparated,
};
