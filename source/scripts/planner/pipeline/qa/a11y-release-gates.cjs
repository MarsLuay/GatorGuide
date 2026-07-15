"use strict";

/**
 * P19 accessibility + P20 release gate harness (contract shapes).
 */

const A11Y_GATES = Object.freeze([
  "axe-web",
  "contrast",
  "keyboard-focus",
  "reduced-motion",
  "rtl",
  "text-200pct",
  "narrow-320",
  "touch-targets",
  "mobile-harness",
]);

const RELEASE_GATES = Object.freeze([
  "V-CHECK",
  "V-PLANNER",
  "V-PLANNER-FULL",
  "V-FIREBASE",
  "V-WEB",
  "V-MOBILE",
  "V-WINDOWS",
  "V-TOUCH",
  "privacy",
  "offline-sync",
  "i18n",
  "a11y",
]);

function evaluateA11yMatrix(results = {}) {
  const failed = [];
  for (const gate of A11Y_GATES) {
    if (results[gate] !== "pass") {
      failed.push(gate);
    }
  }
  return { ok: failed.length === 0, failed };
}

function evaluateReleaseReadiness({
  gateResults = {},
  combinedUpdate = false,
  userAuthorizedPublish = false,
  lkgRollbackProven = false,
} = {}) {
  const failed = RELEASE_GATES.filter((g) => gateResults[g] !== "pass");
  const readyToShipCandidate =
    failed.length === 0 && combinedUpdate && lkgRollbackProven;
  return {
    ok: readyToShipCandidate,
    failed,
    mayPublish: readyToShipCandidate && userAuthorizedPublish === true,
    blockedReason:
      userAuthorizedPublish === true
        ? null
        : "publish requires explicit user authorization",
  };
}

function plannerRefreshWorkflowContract(workflow = {}) {
  const errors = [];
  if (!workflow.weeklyCron) errors.push("weekly-cron");
  if (!workflow.workflowDispatch) errors.push("workflow-dispatch");
  if (workflow.node !== 20) errors.push("node-20");
  if (!workflow.stageThenValidate) errors.push("stage-then-validate");
  if (workflow.directMainWrite) errors.push("no-direct-main");
  if (!workflow.uploadReportsAlways) errors.push("upload-reports");
  return { ok: errors.length === 0, errors };
}

module.exports = {
  A11Y_GATES,
  RELEASE_GATES,
  evaluateA11yMatrix,
  evaluateReleaseReadiness,
  plannerRefreshWorkflowContract,
};
