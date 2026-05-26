const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const BOOTSTRAP_PATH = path.join(
  ROOT,
  "constants",
  "transfer-planner-source",
  "bootstrap.generated.ts"
);

function runSpotCheckList() {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/planner/spot-check-transfer-planner-major.cjs",
      "--list",
      "--campus-id",
      "uw-tacoma",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function parseListRows(output) {
  return output
    .split(/\r?\n/u)
    .filter((line) => line.includes("\t"))
    .map((line) => {
      const [planId, campusId, pathwayCount, title] = line.split("\t");
      return {
        planId,
        campusId,
        pathwayCount: Number.parseInt(pathwayCount, 10),
        title,
      };
    });
}

test("UW Tacoma spot-check list exposes the course-planner audit rows", () => {
  const bootstrapSource = fs.readFileSync(BOOTSTRAP_PATH, "utf8");
  assert.match(
    bootstrapSource,
    /export const TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS/u,
    "Expected bootstrap generated major-plan export to exist."
  );

  const rows = parseListRows(runSpotCheckList());
  const byId = new Map(rows.map((row) => [row.planId, row]));

  assert.ok(rows.length >= 25, "Expected Tacoma bootstrap list to stay populated.");
  assert.deepEqual(
    rows.filter((row) => row.campusId !== "uw-tacoma"),
    [],
    "Expected campus filter to return only Tacoma rows."
  );

  assert.equal(
    byId.get("uw-tacoma-bachelor-of-arts-in-business-administration")?.title,
    "Business Administration (BA)"
  );
  assert.equal(
    byId.get("uw-tacoma-bachelor-of-arts-in-business-administration")?.pathwayCount,
    5
  );

  assert.ok(byId.has("uw-tacoma-computer-science-and-systems"));
  assert.equal(byId.get("uw-tacoma-computer-science-and-systems")?.pathwayCount, 2);
  assert.equal(byId.has("uw-tacoma-computer-science-and-systems-ba"), false);
  assert.equal(byId.has("uw-tacoma-computer-science-and-systems-bs"), false);

  assert.equal(byId.get("uw-tacoma-criminal-justice")?.pathwayCount, 2);
  assert.equal(byId.get("uw-tacoma-history")?.pathwayCount, 5);
  assert.equal(byId.get("uw-tacoma-information-technology")?.pathwayCount, 2);

  assert.ok(byId.has("uw-tacoma-interdisciplinary-arts-and-sciences"));
  assert.equal(
    byId.has("uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed"),
    false
  );

  assert.ok(byId.has("uw-tacoma-urban-studies"));
});
