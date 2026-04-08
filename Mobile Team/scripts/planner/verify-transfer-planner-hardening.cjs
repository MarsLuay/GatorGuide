const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const {
  TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY,
} = require("../../constants/transfer-planner-grc-availability.generated");
const {
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_SUMMARY,
} = require("../../constants/transfer-planner-source/requirement-diff-classifications.generated");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-hardening-report.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-hardening-report.md");
const SOURCE_GAP_REPORT_PATH = path.resolve(TMP_DIR, "transfer-planner-source-gaps.json");
const REQUIREMENT_PARSE_REPORT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-requirement-source-parse-report.json"
);
const REQUIREMENT_DIFF_REPORT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-requirement-diff-promotion-report.json"
);
const ALLOWED_GRC_AVAILABILITY_STATUSES = new Set([
  "published-in-latest-schedule",
  "published-in-recent-history-not-latest",
  "catalog-listed-not-in-latest-schedules",
  "planner-course-no-current-public-source",
  "legacy-track-only-no-current-public-source",
]);

function ensureDir(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.resolve(REPO_ROOT, relativePath), "utf8");
}

function escapeMarkdown(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}

function runCheck(id, label, callback) {
  try {
    const details = callback();
    return {
      id,
      label,
      status: "passed",
      details: Array.isArray(details) ? details.map(String) : details ? [String(details)] : [],
    };
  } catch (error) {
    return {
      id,
      label,
      status: "failed",
      details: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function writeReports(report) {
  ensureDir(TMP_DIR);
  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    "# Transfer Planner Hardening Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Outcome: ${report.outcome}`,
    `- Passed checks: ${report.passedCount}`,
    `- Failed checks: ${report.failedCount}`,
    "",
    "| Check | Status | Details |",
    "| --- | --- | --- |",
    ...report.checks.map((check) => {
      const details = check.details.length ? check.details.map(escapeMarkdown).join("<br>") : "";
      return `| ${escapeMarkdown(check.label)} | ${check.status} | ${details} |`;
    }),
    "",
  ];

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function main() {
  const sourceGapReport = readJson(SOURCE_GAP_REPORT_PATH);
  const requirementParseReport = readJson(REQUIREMENT_PARSE_REPORT_PATH);
  const requirementDiffReport = readJson(REQUIREMENT_DIFF_REPORT_PATH);
  const availabilityEntries = Object.values(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY);

  const checks = [
    runCheck("source-gaps-cleared", "No hidden source-gap owners remain", () => {
      assert.equal(sourceGapReport.totalSourceGapOwners, 0);
      return `Hidden source-gap owners: ${sourceGapReport.totalSourceGapOwners}`;
    }),
    runCheck("requirement-source-parse-clean", "All primary requirement sources parse cleanly", () => {
      assert.equal(requirementParseReport.failedCount, 0);
      assert.equal(requirementParseReport.okCount, requirementParseReport.totalOwners);
      return [
        `Primary degree sources parsed: ${requirementParseReport.totalOwners}`,
        `Parsed successfully: ${requirementParseReport.okCount}`,
        `Parse failures: ${requirementParseReport.failedCount}`,
      ];
    }),
    runCheck("requirement-diffs-classified", "Requirement diffs are fully machine-classified", () => {
      assert.equal(requirementDiffReport.reviewCandidateCount, 0);
      assert.equal(requirementDiffReport.unmappedCount, 0);
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_SUMMARY.countsByKind ?? {},
          "source-backed-no-clean-grc-consensus"
        ),
        false
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_SUMMARY.countsByKind ?? {},
          "source-backed-clean-title-no-shared-grc-match"
        ),
        false
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_SUMMARY.countsByKind ?? {},
          "source-backed-campus-specific-no-clean-grc-match"
        ),
        false
      );
      return [
        `Review-needed candidates: ${requirementDiffReport.reviewCandidateCount}`,
        `Unmapped candidates: ${requirementDiffReport.unmappedCount}`,
        "Legacy ambiguous requirement-diff classifications removed",
      ];
    }),
    runCheck("availability-statuses-machine-readable", "Green River availability uses machine statuses only", () => {
      const invalidStatuses = Array.from(
        new Set(
          availabilityEntries.map((entry) => entry.status).filter(
            (status) => !ALLOWED_GRC_AVAILABILITY_STATUSES.has(status)
          )
        )
      );
      assert.equal(
        JSON.stringify(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY).includes("manual-review"),
        false
      );
      assert.deepEqual(invalidStatuses, []);
      return [
        `Tracked availability rows: ${availabilityEntries.length}`,
        `Allowed status families: ${ALLOWED_GRC_AVAILABILITY_STATUSES.size}`,
      ];
    }),
    runCheck("planner-docs-say-source-backed-or-hidden", "Planner docs and UI use source-backed-or-hidden language", () => {
      const filesToInspect = [
        "README.md",
        "docs/README.md",
        "docs/planner/TRANSFER_PLANNER_TOOL_SUMMARY.md",
        "docs/planner/TRANSFER_PLANNER_GENERAL_TODO.md",
        "docs/planner/TRANSFER_PLANNER_SOURCE_VERIFIED_AUTOMATION_PLAN.md",
        "components/pages/TransferPlannerPage.tsx",
        "constants/transfer-planner-source/bootstrap.generated.ts",
      ];

      for (const relativePath of filesToInspect) {
        const contents = readText(relativePath);
        assert.doesNotMatch(contents, /review queue/i, relativePath);
        assert.doesNotMatch(contents, /advisor review/i, relativePath);
        assert.doesNotMatch(contents, /manual review/i, relativePath);
      }

      const transferPlannerPage = readText("components/pages/TransferPlannerPage.tsx");
      assert.match(transferPlannerPage, /source-backed plan/i);
      assert.match(transferPlannerPage, /unsupported majors, rules, or sequences stay hidden/i);

      return [
        "Docs checked: README, docs/README, planner summary, planner todo, automation plan, bootstrap source layer",
        "UI checked: TransferPlannerPage",
      ];
    }),
  ];

  const failedChecks = checks.filter((check) => check.status === "failed");
  const report = {
    generatedAt: new Date().toISOString(),
    outcome: failedChecks.length ? "failed" : "passed",
    passedCount: checks.length - failedChecks.length,
    failedCount: failedChecks.length,
    checks,
  };

  writeReports(report);

  if (failedChecks.length) {
    for (const failedCheck of failedChecks) {
      console.error(`Hardening check failed: ${failedCheck.label}`);
      for (const detail of failedCheck.details) {
        console.error(`- ${detail}`);
      }
    }
    process.exit(1);
  }

  console.log("Transfer planner hardening checks passed.");
  console.log(`Report: ${OUTPUT_MD_PATH}`);
}

main();
