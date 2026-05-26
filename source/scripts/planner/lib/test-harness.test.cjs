const assert = require("node:assert/strict");
const test = require("node:test");

const {
  array,
  assertIncludesAll,
  assertTextIncludesAll,
  createDiagnosticTest,
  getExpectedCourseCodesFromProgram,
  htmlToPlainText,
  loadCurrentBootstrapPlans,
  normalizePathwayId,
  normalizeText,
  uniqueSorted,
} = require("./test-harness.cjs");
const {
  getArgValue,
  getArgValues,
  getPositionalArgs,
  getPlannerTmpPath,
  hasArg,
  runCommand,
} = require("./script-harness.cjs");
const {
  filterRequestedTestFiles,
  getCompleteDiagnosticTestFiles,
  getOptInEnvVars,
  parseUnexpectedSkippedTests,
} = require("../run-complete-diagnostics.cjs");

test("planner test harness normalizes common diagnostic values", () => {
  assert.deepEqual(array("nope"), []);
  assert.deepEqual(uniqueSorted(["b", "a", "a"]), ["a", "b"]);
  assert.equal(normalizePathwayId(" BA-Route "), "ba-route");
  assert.equal(normalizeText("Arts & Humanities"), "ARTS AND HUMANITIES");
  assert.equal(htmlToPlainText("<p>A&nbsp;&amp;&nbsp;B</p>"), " A & B ");
});

test("planner test harness flattens complete diagnostic course evidence", () => {
  const expected = getExpectedCourseCodesFromProgram({
    requiredCourseCodes: ["A 101"],
    optionGroups: [{ options: [["B 201"], ["C 301", "D 401"]] }],
    courseBuckets: [{ courseCodes: ["E 111"] }],
    pathwayGroups: [{ suggestedCourses: ["F 222"], capstoneCourses: ["G 333"] }],
  });

  assert.deepEqual(expected, ["A 101", "B 201", "C 301", "D 401", "E 111", "F 222", "G 333"]);
  assertIncludesAll(["A", "B"], ["A"], "letters");
  assertTextIncludesAll("General Education: Diversity", ["diversity"], "text");
});

test("planner script harness parses flags and tmp report paths", () => {
  const argv = [
    "--target-plan-id=uw-seattle-x",
    "--flag",
    "--item",
    "a",
    "--item=b",
    "--report",
    "custom.json",
    "positional-plan",
  ];

  assert.equal(hasArg(["--missing", "--flag"], argv), true);
  assert.equal(getArgValue(["--plan-id", "--target-plan-id"], argv), "uw-seattle-x");
  assert.deepEqual(getArgValues(["--item", "--items"], argv), ["a", "b"]);
  assert.deepEqual(
    getPositionalArgs({ valueFlags: ["--target-plan-id", "--item", "--report"] }, argv),
    ["positional-plan"]
  );
  assert.ok(
    getPlannerTmpPath("transfer-planner-test-report.json")
      .replace(/\\/g, "/")
      .includes("/.tmp/reports/")
  );
});

test("opt-in diagnostic helper returns skip test unless enabled", () => {
  const diagnosticTest = createDiagnosticTest(test, "TRANSFER_PLANNER_FAKE_DIAGNOSTIC_SWITCH");
  assert.equal(diagnosticTest, test.skip);
});

test("planner script harness can run commands without throwing on inspected failures", () => {
  const result = runCommand(process.execPath, ["-e", "process.exit(3)"], {
    stdio: "ignore",
    throwOnFailure: false,
  });
  assert.equal(result.status, 3);
});

test("complete diagnostic runner discovers opt-in gates and rejects unexpected skips", () => {
  const testFiles = getCompleteDiagnosticTestFiles();
  const normalizedFiles = testFiles.map((file) => file.replace(/\\/g, "/"));
  assert.ok(
    normalizedFiles.includes("scripts/planner/uw-biology-complete-diagnostics.test.cjs")
  );

  const optInEnvVars = getOptInEnvVars(testFiles);
  assert.ok(optInEnvVars.includes("TRANSFER_PLANNER_RUN_UW_BIOLOGY_DIAGNOSTICS"));
  assert.ok(
    optInEnvVars.includes("TRANSFER_PLANNER_RUN_UW_SEATTLE_REMAINING_DIAGNOSTICS")
  );

  const originalArgv = process.argv;
  try {
    process.argv = [...originalArgv.slice(0, 2), "uw-biology"];
    assert.deepEqual(filterRequestedTestFiles(testFiles).map((file) => file.replace(/\\/g, "/")), [
      "scripts/planner/uw-biology-complete-diagnostics.test.cjs",
    ]);
  } finally {
    process.argv = originalArgv;
  }

  const tap = [
    "ok 1 - uw-seattle-art exposes every online official UW course # SKIP",
    "ok 2 - Biology exposes every official UW course # SKIP",
  ].join("\n");

  assert.deepEqual(parseUnexpectedSkippedTests(tap, { allowOnlineSkips: true }), [
    "Biology exposes every official UW course",
  ]);
  assert.deepEqual(parseUnexpectedSkippedTests(tap, { allowOnlineSkips: false }), [
    "uw-seattle-art exposes every online official UW course",
    "Biology exposes every official UW course",
  ]);
});

test("bootstrap plan reader sees current UW planner owners without importing generated modules", () => {
  const plans = loadCurrentBootstrapPlans();
  const planIds = plans.map((plan) => plan.id);

  assert.ok(planIds.includes("uw-seattle-computer-science"));
  assert.ok(planIds.includes("uw-bothell-business-administration"));
  assert.ok(planIds.includes("uw-tacoma-computer-science-and-systems"));
});
