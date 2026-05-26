const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
    jsx: "react-jsx",
    baseUrl: ".",
    paths: {
      "@/*": ["./*"],
    },
  },
});
require("tsconfig-paths/register");

const planner = require("../../constants/transfer-planner-source");
const {
  computerEngineeringPrograms,
  relatedNonTargetPlanIds,
} = require("./fixtures/uw-computer-engineering-complete-diagnostics.fixture.cjs");

const RUN_DIAGNOSTICS =
  process.env.TRANSFER_PLANNER_RUN_UW_COMPUTER_ENGINEERING_DIAGNOSTICS === "1";
const diagnosticTest = RUN_DIAGNOSTICS ? test : test.skip;

function normalizeCourseCode(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .replace(/^([A-Z&]+(?:\s+[A-Z&]+)*)\s*(\d{3}[A-Z]?)$/, "$1 $2");
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function flattenExpectedCourseCodes(program) {
  return uniqueSorted([
    ...(program.requiredCourseCodes ?? []),
    ...(program.optionGroups ?? []).flatMap((group) => group.options ?? []).flat(),
    ...(program.courseBuckets ?? []).flatMap((bucket) => bucket.courseCodes ?? []),
  ].map(normalizeCourseCode));
}

function getParsedUwCourseCodes(program) {
  const blocks = planner.getTransferPlannerParsedRequirementSourceBlocks(program.planId) ?? [];
  return uniqueSorted(blocks.flatMap((block) => block.parsedUwCourseCodes ?? []).map(normalizeCourseCode));
}

function getCurrentPlanText(program) {
  const sourcePlan = planner.getTransferPlannerMajorPlan(program.planId);
  const runtimePlan = planner.getTransferPlannerStudentRuntimeMajorPlan(program.planId);
  const sourcePathways = planner.getTransferPlannerPathwaysForPlan(sourcePlan);
  const runtimePathways = planner.getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan);
  const parsedBlocks = planner.getTransferPlannerParsedRequirementSourceBlocks(program.planId);
  const resolvedRuntimePlans = [
    planner.resolveTransferPlannerMajorPlan(runtimePlan, null),
    ...runtimePathways.map((pathway) =>
      planner.resolveTransferPlannerMajorPlan(runtimePlan, pathway.id)
    ),
  ];

  return normalizeText(
    JSON.stringify({
      sourcePlan,
      runtimePlan,
      sourcePathways,
      runtimePathways,
      parsedBlocks,
      resolvedRuntimePlans,
    })
  );
}

function getRegisteredPathwayIds(program) {
  const sourcePlan = planner.getTransferPlannerMajorPlan(program.planId);
  const runtimePlan = planner.getTransferPlannerStudentRuntimeMajorPlan(program.planId);
  return uniqueSorted([
    ...planner.getTransferPlannerPathwaysForPlan(sourcePlan),
    ...planner.getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan),
  ].map((pathway) => String(pathway.id ?? "").trim().toLowerCase()));
}

function getDirectComputerEngineeringPlanIds() {
  return uniqueSorted(
    computerEngineeringPrograms.flatMap((program) =>
      planner
        .getTransferPlannerMajorsForCampus(program.campusId)
        .filter((plan) => {
          const titles = [plan.title, plan.shortTitle].map((value) => String(value ?? ""));
          return titles.some((title) => /^Computer Engineering(?:\s|\(|$)/i.test(title.trim()));
        })
        .map((plan) => plan.id)
    )
  );
}

function assertIncludesAll(actualValues, expectedValues, label) {
  const actual = new Set(actualValues.map(normalizeCourseCode));
  const missing = expectedValues
    .map(normalizeCourseCode)
    .filter((expected) => !actual.has(expected));

  assert.equal(
    missing.length,
    0,
    [
      `${label} missing ${missing.length} expected UW course code(s).`,
      `Missing: ${missing.slice(0, 160).join(", ")}`,
      `Actual count: ${actual.size}`,
    ].join("\n")
  );
}

function assertTextIncludesAll(text, snippets, label) {
  const missing = snippets
    .map((snippet) => String(snippet ?? "").trim())
    .filter(Boolean)
    .filter((snippet) => !text.includes(normalizeText(snippet)));

  assert.equal(
    missing.length,
    0,
    [
      `${label} missing ${missing.length} expected requirement text snippet(s).`,
      `Missing: ${missing.slice(0, 120).join(" | ")}`,
    ].join("\n")
  );
}

test("UW computer engineering complete diagnostic fixture is source scoped and UW-course only", () => {
  assert.deepEqual(
    computerEngineeringPrograms.map((program) => program.planId),
    [
      "uw-seattle-computer-engineering",
      "uw-bothell-computer-engineering",
      "uw-tacoma-computer-engineering",
    ]
  );

  for (const program of computerEngineeringPrograms) {
    assert.equal(program.officialSources.length > 0, true, `${program.planId} needs sources`);
    const expectedCodes = flattenExpectedCourseCodes(program);
    assert.equal(expectedCodes.length > 0, true, `${program.planId} needs course expectations`);
    const communityCollegeCodes = expectedCodes.filter((code) => /\b[A-Z]+&\s+\d/.test(code));
    assert.deepEqual(
      communityCollegeCodes,
      [],
      `${program.planId} fixture should contain UW course codes only`
    );
  }
});

diagnosticTest("UW computer engineering target roster matches the direct official majors", () => {
  const expectedPlanIds = uniqueSorted(computerEngineeringPrograms.map((program) => program.planId));
  const actualPlanIds = getDirectComputerEngineeringPlanIds();

  assert.deepEqual(
    actualPlanIds,
    expectedPlanIds,
    [
      "Direct Computer Engineering roster should include Seattle, Bothell, and Tacoma only.",
      `Expected: ${expectedPlanIds.join(", ")}`,
      `Actual: ${actualPlanIds.join(", ")}`,
      `Related non-target plan ids: ${relatedNonTargetPlanIds.join(", ")}`,
    ].join("\n")
  );
});

for (const program of computerEngineeringPrograms) {
  diagnosticTest(`${program.title} (${program.campusId}) exposes every official UW course`, () => {
    assertIncludesAll(
      getParsedUwCourseCodes(program),
      flattenExpectedCourseCodes(program),
      `${program.planId} parsed requirement-source blocks`
    );
  });

  diagnosticTest(`${program.title} (${program.campusId}) preserves every official option and pathway`, () => {
    const actualPathwayIds = getRegisteredPathwayIds(program);
    const expectedPathwayIds = uniqueSorted(
      (program.expectedPathwayIds ?? []).map((pathwayId) => String(pathwayId).toLowerCase())
    );
    assert.deepEqual(
      actualPathwayIds,
      expectedPathwayIds,
      `${program.planId} should preserve the complete official pathway set`
    );

    const text = getCurrentPlanText(program);
    const optionLabels = (program.optionGroups ?? []).map((group) => group.label);
    assertTextIncludesAll(text, optionLabels, `${program.planId} option labels`);

    for (const group of program.optionGroups ?? []) {
      for (const option of group.options ?? []) {
        assertIncludesAll(
          getParsedUwCourseCodes(program),
          option,
          `${program.planId} option group ${group.id}`
        );
      }
    }
  });

  diagnosticTest(`${program.title} (${program.campusId}) preserves gen-ed and credit-bucket shape`, () => {
    const text = getCurrentPlanText(program);
    assertTextIncludesAll(
      text,
      [
        ...(program.genEdRequirements ?? []),
        ...(program.requirementLabels ?? []),
        ...(program.courseBuckets ?? []).flatMap((bucket) => [
          bucket.label,
          bucket.minCredits != null ? `${bucket.minCredits}` : null,
          bucket.minCourses != null ? `${bucket.minCourses}` : null,
          bucket.maxCredits != null ? `${bucket.maxCredits}` : null,
          ...(bucket.openEndedRules ?? []),
        ]),
      ],
      `${program.planId} gen-ed/requirement text`
    );
  });
}
