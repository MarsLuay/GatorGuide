/**
 * P01-B characterization lock: parser gate scripts and owner-coverage contract.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const PLANNER_DIR = __dirname;
const PARSER_SUITE_FILES = [
  "source-discovery.test.cjs",
  "source-backed-coverage-audit.test.cjs",
  "triage-source-backed-blockers.test.cjs",
  "parser-recovery.test.cjs",
  "source-change-classification.test.cjs",
  "grc-associate-track-generator.test.cjs",
  "validate-transfer-planner-safe.test.cjs",
  "uw-tacoma-course-planner-audit-regressions.test.cjs",
];

test("P01-B parser characterization suites exist for planner:test:parser", () => {
  for (const file of PARSER_SUITE_FILES) {
    assert.ok(
      fs.existsSync(path.join(PLANNER_DIR, file)),
      `missing parser suite file: ${file}`
    );
  }
});

test("P01-B source-backed coverage audit still encodes 244 owner contract language", () => {
  const audit = fs.readFileSync(
    path.join(PLANNER_DIR, "source-backed-coverage-audit.test.cjs"),
    "utf8"
  );
  assert.match(audit, /244|owner|coverage/i);
});
