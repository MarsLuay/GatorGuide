"use strict";

/**
 * P20 refresh automation contract — workflow shape validation (no GitHub writes).
 */

function validatePlannerRefreshWorkflow(doc = {}) {
  const errors = [];
  if (!doc.on?.schedule && !doc.on?.workflow_dispatch) {
    errors.push({ type: "missing-triggers" });
  }
  if (!doc.jobs || typeof doc.jobs !== "object") {
    errors.push({ type: "missing-jobs" });
  } else {
    const job = Object.values(doc.jobs)[0] || {};
    const steps = job.steps || [];
    const runTexts = steps.map((s) => String(s.run || s.uses || "")).join("\n");
    if (!/npm ci|npm install/.test(runTexts)) {
      errors.push({ type: "missing-npm-ci" });
    }
    if (!/refreshPlannerData|planner:refresh|refresh-planner/.test(runTexts)) {
      errors.push({ type: "missing-refresh-invocation" });
    }
  }
  if (doc.permissions?.contents === "write" && doc.allow_direct_main === true) {
    errors.push({ type: "direct-main-write-forbidden" });
  }
  return { ok: errors.length === 0, errors };
}

function validateNoDiffSuccess({ beforeHash, afterHash, published }) {
  if (beforeHash === afterHash && published === true) {
    return { ok: false, reason: "no-diff-must-not-publish" };
  }
  if (beforeHash === afterHash && published === false) {
    return { ok: true, reason: "no-diff-success" };
  }
  return { ok: true, reason: "diff-present" };
}

module.exports = {
  validatePlannerRefreshWorkflow,
  validateNoDiffSuccess,
};
