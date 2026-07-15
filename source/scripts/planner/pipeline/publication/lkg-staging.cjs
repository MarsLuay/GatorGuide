"use strict";

/**
 * P09 staged validation + atomic Last-Known-Good promotion (harness).
 * Never mutates canonical paths until promote() after checks pass.
 */

function createPublicationStaging(options = {}) {
  const stage = new Map();
  let lkg = options.initialLkg ? { ...options.initialLkg } : null;

  return {
    stageArtifact(name, bytes) {
      stage.set(name, Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes)));
    },
    listStaged() {
      return [...stage.keys()];
    },
    async validate(runChecks) {
      const report = await runChecks({ staged: Object.fromEntries(stage) });
      return {
        ok: Boolean(report?.ok),
        report,
      };
    },
    promote({ ok }) {
      if (!ok) {
        return { promoted: false, lkg, reason: "validation-failed" };
      }
      lkg = {
        artifacts: Object.fromEntries(
          [...stage.entries()].map(([k, v]) => [k, Buffer.from(v)])
        ),
        promotedAt: "staged", // tests inject clock if needed
      };
      stage.clear();
      return { promoted: true, lkg };
    },
    getLkg() {
      return lkg;
    },
  };
}

module.exports = { createPublicationStaging };
