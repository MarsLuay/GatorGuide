const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");

const REPORT_PATHS = {
  sourceGap: path.resolve(TMP_DIR, "transfer-planner-source-gaps.json"),
  requirementParse: path.resolve(TMP_DIR, "transfer-planner-requirement-source-parse-report.json"),
  requirementDiff: path.resolve(TMP_DIR, "transfer-planner-requirement-diff-promotion-report.json"),
  ownerAudit: path.resolve(TMP_DIR, "transfer-planner-owner-audit.json"),
  hardening: path.resolve(TMP_DIR, "transfer-planner-hardening-report.json"),
  sourceYearCoverage: path.resolve(TMP_DIR, "transfer-planner-source-year-coverage.json"),
};

function readJsonOrNull(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function addRequiredAction(queue, message) {
  if (!message || queue.includes(message)) {
    return;
  }
  queue.push(message);
}

function buildRequiredUpdateQueue(reports) {
  const queue = [];

  if (reports.sourceGap && Number(reports.sourceGap.totalSourceGapOwners) > 0) {
    addRequiredAction(
      queue,
      "Resolve source gaps: add stronger official source discovery/parser support until hidden source-gap owners reaches 0."
    );
  }

  if (reports.requirementParse && Number(reports.requirementParse.failedCount) > 0) {
    addRequiredAction(
      queue,
      "Fix requirement parsing failures: update source manifest links or parser adapters for owners that did not parse cleanly."
    );
  }

  if (
    reports.requirementDiff &&
    (Number(reports.requirementDiff.reviewCandidateCount) > 0 ||
      Number(reports.requirementDiff.unmappedCount) > 0)
  ) {
    addRequiredAction(
      queue,
      "Resolve requirement diff promotion debt: reduce review-needed/unmapped requirement diffs to 0 through parser or mapping updates."
    );
  }

  const ownerErrors = Number(reports.ownerAudit?.issueCounts?.error ?? 0);
  const ownerWarnings = Number(reports.ownerAudit?.issueCounts?.warning ?? 0);
  if (reports.ownerAudit && (ownerErrors > 0 || ownerWarnings > 0)) {
    addRequiredAction(
      queue,
      "Address owner-audit issues: fix missing/invalid primary sources, manifest gaps, and parser fallback warnings."
    );
  }

  if (reports.hardening && String(reports.hardening.outcome).toLowerCase() !== "passed") {
    addRequiredAction(
      queue,
      "Clear hardening failures: fix failing checks in transfer-planner-hardening-report.md before shipping planner updates."
    );
  }

  if (reports.sourceYearCoverage && String(reports.sourceYearCoverage.outcome).toLowerCase() !== "ok") {
    const actions = Array.isArray(reports.sourceYearCoverage.requiredActions)
      ? reports.sourceYearCoverage.requiredActions
      : [];
    if (actions.length) {
      for (const action of actions) {
        addRequiredAction(queue, action);
      }
    } else {
      addRequiredAction(
        queue,
        "Source year coverage needs attention: latest schedule coverage is not aligned with current/future academic year baselines."
      );
    }
  }

  return queue;
}

function main() {
  const reports = {
    sourceGap: readJsonOrNull(REPORT_PATHS.sourceGap),
    requirementParse: readJsonOrNull(REPORT_PATHS.requirementParse),
    requirementDiff: readJsonOrNull(REPORT_PATHS.requirementDiff),
    ownerAudit: readJsonOrNull(REPORT_PATHS.ownerAudit),
    hardening: readJsonOrNull(REPORT_PATHS.hardening),
    sourceYearCoverage: readJsonOrNull(REPORT_PATHS.sourceYearCoverage),
  };

  const reportCount = Object.values(reports).filter(Boolean).length;
  if (reportCount === 0) {
    console.log("Required update queue:");
    console.log("- No maintenance reports found in .tmp.");
    console.log("- Run: npm run planner:full:verify");
    process.exit(0);
  }

  const queue = buildRequiredUpdateQueue(reports);

  console.log("Required update queue:");
  if (!queue.length) {
    console.log("- None. All monitored automation gates are clean.");
    return;
  }

  for (const item of queue) {
    console.log(`- ${item}`);
  }
}

main();
