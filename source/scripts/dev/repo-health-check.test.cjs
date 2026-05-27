const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  checkGeneratedRenameFallout,
  checkTmpLayout,
} = require("./repo-health-check.cjs");
const {
  organizeTmpRoot,
} = require("../organize-tmp-artifacts.cjs");

function makeTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gatorguide-health-"));
  fs.mkdirSync(path.join(root, ".tmp"), { recursive: true });
  return root;
}

function writeFile(filePath, contents = "") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function setMtime(filePath, mtimeMs) {
  const seconds = mtimeMs / 1000;
  fs.utimesSync(filePath, seconds, seconds);
}

function writeGeneratedRuntimeContract(root) {
  const generatedRoot = path.join(root, "constants", "transfer-planner-source");
  const runtimeDir = path.join(generatedRoot, "student-runtime.generated");

  for (const fileName of [
    "campuses.generated.json",
    "compact-course-registry.generated.json",
    "equivalency-rule-registry.generated.json",
    "gap-registry.generated.json",
    "major-plan-campus-id-by-plan-id.generated.json",
    "major-plan-ids-by-campus.generated.json",
    "tracks.generated.json",
  ]) {
    writeFile(path.join(runtimeDir, fileName), "[]\n");
  }

  for (const dirName of [
    "major-plans-by-plan-id",
    "parsed-requirement-blocks-by-plan-id",
    "pathways-by-plan-id",
    "primary-degree-sources-by-plan-id",
    "resolved-major-plans-by-plan-id",
  ]) {
    writeFile(path.join(runtimeDir, dirName, "example.generated.json"), "[]\n");
  }

  writeFile(
    path.join(generatedRoot, "student-runtime.generated.ts"),
    [
      'const { createLazyGeneratedRecord, createLazyGeneratedValue } = require("./generated-lazy");',
      'function loadMajorPlans() { return require("./student-runtime.generated/major-plans-by-plan-id/example.generated.json"); }',
      'function loadPathways() { return require("./student-runtime.generated/pathways-by-plan-id/example.generated.json"); }',
      'function loadSources() { return require("./student-runtime.generated/primary-degree-sources-by-plan-id/example.generated.json"); }',
      'function loadResolved() { return require("./student-runtime.generated/resolved-major-plans-by-plan-id/example.generated.json"); }',
      'function loadParsed() { return require("./student-runtime.generated/parsed-requirement-blocks-by-plan-id/example.generated.json"); }',
      'function loadCampusIndex() { return require("./student-runtime.generated/major-plan-ids-by-campus.generated.json"); }',
      'function loadCampusByPlan() { return require("./student-runtime.generated/major-plan-campus-id-by-plan-id.generated.json"); }',
      "exports.TRANSFER_PLANNER_RUNTIME_MAJOR_PLANS = createLazyGeneratedValue(loadMajorPlans, []);",
      "exports.TRANSFER_PLANNER_RUNTIME_PATHWAYS_BY_PLAN_ID = createLazyGeneratedRecord(loadPathways, {});",
      "",
    ].join("\n")
  );

  writeFile(
    path.join(generatedRoot, "course-metadata.generated", "partition-index.generated.json"),
    "{}\n"
  );
  writeFile(
    path.join(
      generatedRoot,
      "course-metadata.generated",
      "entries-by-school-subject",
      "grc-math.generated.json"
    ),
    "[]\n"
  );
  writeFile(
    path.join(generatedRoot, "course-metadata.generated.ts"),
    [
      'const { createLazyGeneratedValue } = require("./generated-lazy");',
      'function loadCourseMetadataIndex() { return require("./course-metadata.generated/partition-index.generated.json"); }',
      'function loadCourseMetadata() { return require("./course-metadata.generated/entries-by-school-subject/grc-math.generated.json"); }',
      "exports.TRANSFER_PLANNER_GENERATED_COURSE_METADATA = createLazyGeneratedValue(loadCourseMetadata, []);",
      "",
    ].join("\n")
  );

  writeFile(
    path.join(
      generatedRoot,
      "requirement-source-adapters.generated",
      "blocks-by-block-id",
      "block-000.generated.json"
    ),
    "[]\n"
  );
  writeFile(
    path.join(generatedRoot, "requirement-source-adapters.generated.ts"),
    [
      'const { createLazyGeneratedValue } = require("./generated-lazy");',
      'function loadParsedBlocks() { return require("./requirement-source-adapters.generated/blocks-by-block-id/block-000.generated.json"); }',
      "exports.TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCKS = createLazyGeneratedValue(loadParsedBlocks, []);",
      "exports.getTransferPlannerParsedRequirementBlocksForPlanId = function getTransferPlannerParsedRequirementBlocksForPlanId() { return loadParsedBlocks(); };",
      "",
    ].join("\n")
  );
}

test("tmp health ignores recent Codex verification temp directories", () => {
  const nowMs = new Date("2026-05-25T12:00:00.000Z").getTime();
  const root = makeTempProject();
  const logPath = path.join(root, ".tmp", "codex-verify", "verify-only.out");
  writeFile(logPath, "active verification output");
  setMtime(logPath, nowMs - 1000 * 60 * 30);

  const result = checkTmpLayout(root, { nowMs });

  assert.equal(result.ok, true);
  assert.match(result.details.join("\n"), /Active Codex verification temp directory/);
});

test("tmp health reports stale unlocked Codex verification directories clearly", () => {
  const nowMs = new Date("2026-05-25T12:00:00.000Z").getTime();
  const root = makeTempProject();
  const logPath = path.join(root, ".tmp", "codex-verify", "verify-only.out");
  writeFile(logPath, "old verification output");
  setMtime(logPath, nowMs - 1000 * 60 * 60 * 48);
  setMtime(path.dirname(logPath), nowMs - 1000 * 60 * 60 * 48);

  const result = checkTmpLayout(root, { nowMs });

  assert.equal(result.ok, false);
  assert.match(result.details.join("\n"), /Stale Codex verification temp directory/);
});

test("tmp health classifies locked stale logs as active temp artifacts", () => {
  const nowMs = new Date("2026-05-25T12:00:00.000Z").getTime();
  const root = makeTempProject();
  const logPath = path.join(root, ".tmp", "logs", "codex-verify", "verify-only.err");
  writeFile(logPath, "locked verification error output");
  setMtime(logPath, nowMs - 1000 * 60 * 60 * 24 * 4);

  const result = checkTmpLayout(root, {
    nowMs,
    detectLock: (filePath) => ({
      locked: filePath === logPath,
      message: filePath === logPath ? "EBUSY: resource busy or locked" : null,
    }),
  });

  assert.equal(result.ok, true);
  assert.match(result.details.join("\n"), /Locked temp artifact/);
});

test("tmp organizer archives stale logs so repo health can pass", () => {
  const nowMs = new Date("2026-05-25T12:00:00.000Z").getTime();
  const root = makeTempProject();
  const tmpRoot = path.join(root, ".tmp");
  const staleOutLog = path.join(tmpRoot, "logs", "codex-old.out.log");
  const staleErrLog = path.join(tmpRoot, "error_logs", "codex-old.err");
  const recentLog = path.join(tmpRoot, "logs", "codex-active.out.log");
  writeFile(staleOutLog, "old stdout");
  writeFile(staleErrLog, "old stderr");
  writeFile(recentLog, "recent stdout");
  setMtime(staleOutLog, nowMs - 1000 * 60 * 60 * 24 * 4);
  setMtime(staleErrLog, nowMs - 1000 * 60 * 60 * 24 * 4);
  setMtime(recentLog, nowMs - 1000 * 60 * 30);

  const before = checkTmpLayout(root, { nowMs });
  assert.equal(before.ok, false);
  assert.match(before.details.join("\n"), /Stale log/);

  const result = organizeTmpRoot(tmpRoot, { nowMs });

  assert.equal(result.skipped.length, 0);
  assert.equal(result.moved.length, 2);
  assert.equal(fs.existsSync(staleOutLog), false);
  assert.equal(fs.existsSync(staleErrLog), false);
  assert.equal(
    fs.existsSync(path.join(tmpRoot, "reports", "stale-logs", "logs", "codex-old.out.log")),
    true
  );
  assert.equal(
    fs.existsSync(path.join(tmpRoot, "reports", "stale-logs", "error_logs", "codex-old.err")),
    true
  );
  assert.equal(fs.existsSync(recentLog), true);
  assert.equal(checkTmpLayout(root, { nowMs }).ok, true);
});

test("generated runtime health accepts plan-level partitioned JSON contract", () => {
  const root = makeTempProject();
  writeGeneratedRuntimeContract(root);

  const result = checkGeneratedRenameFallout(root);

  assert.equal(result.ok, true);
});

test("generated runtime health rejects stale monolithic runtime chunks", () => {
  const root = makeTempProject();
  writeGeneratedRuntimeContract(root);
  writeFile(
    path.join(
      root,
      "constants",
      "transfer-planner-source",
      "student-runtime.generated",
      "major-plans.generated.json"
    ),
    "[]\n"
  );

  const result = checkGeneratedRenameFallout(root);

  assert.equal(result.ok, false);
  assert.match(result.details.join("\n"), /Stale monolithic runtime JSON chunk/);
});

test("generated runtime health rejects stale course metadata monolith", () => {
  const root = makeTempProject();
  writeGeneratedRuntimeContract(root);
  writeFile(
    path.join(
      root,
      "constants",
      "transfer-planner-source",
      "course-metadata.generated.data.json"
    ),
    "[]\n"
  );

  const result = checkGeneratedRenameFallout(root);

  assert.equal(result.ok, false);
  assert.match(result.details.join("\n"), /Stale monolithic course metadata JSON/);
});

test("generated runtime health rejects stale requirement adapter TS chunks", () => {
  const root = makeTempProject();
  writeGeneratedRuntimeContract(root);
  writeFile(
    path.join(
      root,
      "constants",
      "transfer-planner-source",
      "requirement-source-adapters.generated",
      "blocks-000.generated.ts"
    ),
    "exports.LEGACY = [];\n"
  );

  const result = checkGeneratedRenameFallout(root);

  assert.equal(result.ok, false);
  assert.match(result.details.join("\n"), /Stale requirement-source adapter TS chunk/);
});
