"use strict";

/** Ordered Official Source Pipeline stages (P02-A contract). Parsing not migrated yet. */
const PIPELINE_STAGES = Object.freeze([
  "acquisition",
  "parsing",
  "reconciliation",
  "validation",
  "compilation",
  "reporting",
  "publication",
]);

function createStageRegistry(overrides = {}) {
  const registry = {};
  for (const stage of PIPELINE_STAGES) {
    registry[stage] =
      overrides[stage] ||
      (async () => ({
        stage,
        status: "noop",
        message: "legacy strangler — stage not migrated",
      }));
  }
  return registry;
}

module.exports = {
  PIPELINE_STAGES,
  createStageRegistry,
};
