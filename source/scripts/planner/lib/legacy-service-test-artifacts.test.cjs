const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  buildLegacyServiceTestArtifactStatus,
  retireStaleLegacyServiceTestArtifacts,
} = require("./legacy-service-test-artifacts.cjs");

test("legacy service-test artifact status retires stale monolithic TAP output", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gg-legacy-service-test-"));
  const entryPoint = path.join(tmpRoot, "transfer-planner.service.test.ts");
  const staleLog = path.join(tmpRoot, "legacy-transfer-planner-service-test.log");
  const staleTap = path.join(tmpRoot, "legacy-transfer-planner-service-test.tap");
  const staleJsonl = path.join(tmpRoot, "legacy-transfer-planner-service-test.jsonl");

  fs.writeFileSync(
    entryPoint,
    [
      "// Compatibility entry point",
      'import "./transfer-planner.source-backed.test";',
      "",
    ].join("\n")
  );
  fs.writeFileSync(
    staleLog,
    [
      "test at scripts\\planner\\transfer-planner.service.test.ts:10892:10",
      "254 pass / 143 fail / 63 skipped",
    ].join("\n")
  );
  fs.writeFileSync(
    staleTap,
    [
      "TAP version 13",
      "# Subtest: old monolithic failure",
      "not ok 1 - old monolithic failure",
      "  ---",
      `  location: '${entryPoint}:10892:10'`,
      "  ...",
      "# tests 460",
      "# pass 254",
      "# fail 143",
      "# skipped 63",
    ].join("\n")
  );
  fs.writeFileSync(
    staleJsonl,
    "Error: Cannot find package 'json' imported from C:\\Users\\marwa\\GatorGuide\\source\\\n"
  );

  const status = buildLegacyServiceTestArtifactStatus({
    entryPointPath: entryPoint,
    artifactPaths: [staleLog, staleTap, staleJsonl],
  });

  assert.equal(status.status, "stale-legacy-artifacts-found");
  assert.equal(status.artifacts[1].tapSummary.fail, 143);
  assert.match(status.artifacts[0].staleReasons[0], /references line 10892/);
  assert.match(status.artifacts[2].staleReasons[0], /JSON reporter/);

  const retiredStatus = retireStaleLegacyServiceTestArtifacts(status);

  assert.equal(retiredStatus.status, "stale-legacy-artifacts-retired");
  assert.equal(retiredStatus.retiredArtifactCount, 3);
  assert.equal(fs.existsSync(staleLog), false);
  assert.equal(fs.existsSync(staleTap), false);
  assert.equal(fs.existsSync(staleJsonl), false);
  assert.equal(fs.existsSync(retiredStatus.artifacts[0].retiredPath), true);
  assert.equal(fs.existsSync(retiredStatus.artifacts[1].retiredPath), true);
  assert.equal(fs.existsSync(retiredStatus.artifacts[2].retiredPath), true);
});
