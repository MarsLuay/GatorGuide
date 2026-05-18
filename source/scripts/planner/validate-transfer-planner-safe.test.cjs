const assert = require("assert/strict");
const test = require("node:test");

const safeValidate = require("./validate-transfer-planner-safe.cjs");

test("safe planner validation selects source-backed stages", () => {
  const stages = safeValidate.selectStages({ only: "source-backed", startAt: null });
  assert.deepEqual(
    stages.map((stage) => stage.name),
    [
      "source-backed-full",
      "source-backed-mapping",
      "source-backed-generated-registry",
    ]
  );
});

test("safe planner validation can resume at a selected stage", () => {
  const stages = safeValidate.selectStages({ only: null, startAt: "owner-audit" });
  assert.equal(stages[0].name, "owner-audit");
  assert.ok(stages.some((stage) => stage.name === "parser-tests"));
});

test("safe planner validation exposes test and static selectors", () => {
  assert.deepEqual(
    safeValidate.selectStages({ only: "tests", startAt: null }).map((stage) => stage.name),
    ["parser-tests", "source-discovery-tests"]
  );
  assert.deepEqual(
    safeValidate.selectStages({ only: "static", startAt: null }).map((stage) => stage.name),
    ["typescript", "lint"]
  );
});

test("safe planner validation rejects unknown stages", () => {
  assert.throws(
    () => safeValidate.selectStages({ only: null, startAt: "auto-repair" }),
    /Unknown --start-at stage/
  );
  assert.throws(
    () => safeValidate.selectStages({ only: "auto-repair", startAt: null }),
    /Unknown --only selector/
  );
});

test("safe planner validation parses flags without enabling auto-repair", () => {
  assert.deepEqual(safeValidate.parseArgs(["--continue-on-error", "--only", "tests"]), {
    continueOnError: true,
    dryRun: false,
    help: false,
    only: "tests",
    startAt: null,
  });
  assert.ok(!safeValidate.getStageNames().some((stage) => /repair/i.test(stage)));
});

test("safe planner validation reads npm config fallback flags", () => {
  assert.deepEqual(
    safeValidate.parseArgs(["owner-audit"], {
      npm_lifecycle_event: "planner:validate:safe",
      npm_config_continue_on_error: "true",
      npm_config_start_at: "owner-audit",
    }),
    {
      continueOnError: true,
      dryRun: false,
      help: false,
      only: null,
      startAt: "owner-audit",
    }
  );
});

test("safe planner validation accepts npm-safe positional aliases", () => {
  assert.deepEqual(safeValidate.parseArgs(["dry-run", "tests"]), {
    continueOnError: false,
    dryRun: true,
    help: false,
    only: "tests",
    startAt: null,
  });
  assert.deepEqual(safeValidate.parseArgs(["keep-going", "from:owner-audit"]), {
    continueOnError: true,
    dryRun: false,
    help: false,
    only: null,
    startAt: "owner-audit",
  });
});
