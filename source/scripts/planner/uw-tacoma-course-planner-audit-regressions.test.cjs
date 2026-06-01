const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  getExpectedCourseCodesFromProgram,
  loadCompleteDiagnosticPrograms,
} = require("./lib/test-harness.cjs");

const ROOT = path.resolve(__dirname, "../..");
const BOOTSTRAP_PATH = path.join(
  ROOT,
  "constants",
  "transfer-planner-source",
  "bootstrap.generated.ts"
);
const TACOMA_BABA_RUNTIME_PATH = path.join(
  ROOT,
  "constants",
  "transfer-planner-source",
  "student-runtime.generated",
  "resolved-major-plans-by-plan-id",
  "uw-tacoma-bachelor-of-arts-in-business-administration.generated.json"
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

test("UW Tacoma audited fixtures avoid known false course requirements", () => {
  const { programs } = loadCompleteDiagnosticPrograms();
  const byId = new Map(programs.map((program) => [program.planId, program]));
  const getProgram = (planId) => {
    const program = byId.get(planId);
    assert.ok(program, `Missing complete diagnostic fixture for ${planId}`);
    return program;
  };
  const getExpectedCodes = (planId) => new Set(getExpectedCourseCodesFromProgram(getProgram(planId)));

  const businessSources = getProgram(
    "uw-tacoma-bachelor-of-arts-in-business-administration"
  ).officialSources;
  assert.ok(
    businessSources.includes("https://www.tacoma.uw.edu/business/baba-admissions"),
    "Tacoma BABA prerequisites should be backed by the current admissions page."
  );
  assert.ok(
    businessSources.includes("https://www.tacoma.uw.edu/business/design-courses-baba"),
    "Tacoma BABA option requirements should be backed by the current design/courses page."
  );
  assert.equal(
    [...getExpectedCodes("uw-tacoma-bachelor-of-arts-in-business-administration")].some(
      (code) => /^TFIN\s/.test(code)
    ),
    false,
    "Tacoma BABA finance is an open TFIN/TBECON bucket, not an all-required TFIN catalog list."
  );

  const tacomaCssExpectedCodes = getExpectedCodes("uw-tacoma-computer-science-and-systems");
  for (const falseRequiredCode of ["TCSS 390", "TMATH 310", "TCSS 440"]) {
    assert.equal(
      tacomaCssExpectedCodes.has(falseRequiredCode),
      false,
      `Tacoma CSS should not assert excluded or honors-only ${falseRequiredCode} as a degree requirement.`
    );
  }

  const history = getProgram("uw-tacoma-history");
  assert.deepEqual(
    history.officialSources.filter((url) => /history-option/.test(url)).sort(),
    [
      "https://www.tacoma.uw.edu/sias/socs/general-history-option",
      "https://www.tacoma.uw.edu/sias/socs/global-history-option",
    ],
    "General and Global History sources should stay explicit."
  );
  assert.ok(
    history.officialSources.includes(
      "https://www.tacoma.uw.edu/sias/socs/arts-culture-and-society-option"
    )
  );
  assert.ok(
    history.officialSources.includes(
      "https://www.tacoma.uw.edu/sias/socs/labor-and-social-movements-option"
    )
  );
  assert.ok(
    history.officialSources.includes(
      "https://www.tacoma.uw.edu/sias/socs/power-gender-and-identity-option"
    )
  );
  assert.ok(getExpectedCodes("uw-tacoma-history").has("TLAX 238"));
  assert.ok(getExpectedCodes("uw-tacoma-history").has("TWOMN 347"));
});

test("UW Tacoma BABA resolved pathways do not display sibling option courses", () => {
  const resolvedPlans = JSON.parse(fs.readFileSync(TACOMA_BABA_RUNTIME_PATH, "utf8"));
  const getDegreeMapCodes = (key) =>
    new Set(
      (resolvedPlans[key]?.degreeMapSections ?? []).flatMap((section) => section.items ?? [])
    );
  const getBeforeEnrollmentTitles = (key) =>
    (resolvedPlans[key]?.beforeEnrollmentChecklist ?? []).map((item) => item.title ?? "");

  const accountingCodes = getDegreeMapCodes(
    "uw-tacoma-bachelor-of-arts-in-business-administration::accounting-option"
  );
  assert.equal(accountingCodes.has("TACCT 301"), true);
  assert.equal(accountingCodes.has("TBANLT 433"), false);
  assert.equal(accountingCodes.has("TMKTG 450"), false);

  const financeCodes = getDegreeMapCodes(
    "uw-tacoma-bachelor-of-arts-in-business-administration::finance-option"
  );
  assert.equal(financeCodes.has("TBANLT 433"), true);
  assert.equal(financeCodes.has("TACCT 301"), false);
  assert.equal(financeCodes.has("TMKTG 450"), false);

  const marketingCodes = getDegreeMapCodes(
    "uw-tacoma-bachelor-of-arts-in-business-administration::marketing-option"
  );
  assert.equal(marketingCodes.has("TMKTG 450"), true);
  assert.equal(marketingCodes.has("TACCT 301"), false);

  assert.deepEqual(
    getBeforeEnrollmentTitles(
      "uw-tacoma-bachelor-of-arts-in-business-administration::finance-option"
    ).filter((title) => /upper-division Business courses/i.test(title)),
    [],
    "Finance should not inherit the General Business open credit bucket."
  );
});
