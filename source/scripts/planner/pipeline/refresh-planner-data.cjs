"use strict";

const { PIPELINE_STAGES, createStageRegistry } = require("./stages.cjs");
const {
  createAcquisitionStage,
  createParsingStage,
} = require("./orchestration/legacy-bridge.cjs");

/**
 * Public Official Source Pipeline orchestration interface (P02-A / P04-D).
 * Hides acquisition → publication. Legacy parser remains behind temporary adapter.
 *
 * @param {{
 *   stages?: string[],
 *   dryRun?: boolean,
 *   urls?: string[],
 *   adapters?: Record<string, Function>,
 * }} [options]
 */
async function refreshPlannerData(options = {}) {
  const requested = options.stages?.length
    ? options.stages.filter((s) => PIPELINE_STAGES.includes(s))
    : [...PIPELINE_STAGES];

  const defaultAdapters = {
    acquisition: createAcquisitionStage(options),
    parsing: createParsingStage({
      ...options,
      legacyAdapter: options.legacyAdapter,
    }),
  };

  const registry = createStageRegistry({
    ...defaultAdapters,
    ...(options.adapters || {}),
  });

  const results = [];
  for (const stage of requested) {
    const result = await registry[stage]({
      stage,
      dryRun: Boolean(options.dryRun),
      options: {
        ...options,
        __priorResults: results,
      },
    });
    results.push(result);
    if (result?.status === "failed") {
      return {
        ok: false,
        stages: requested,
        results,
        error: result,
      };
    }
  }
  return {
    ok: true,
    stages: requested,
    results,
    dryRun: Boolean(options.dryRun),
  };
}

module.exports = {
  refreshPlannerData,
  PIPELINE_STAGES,
};
