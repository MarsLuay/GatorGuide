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
  biologyPrograms,
} = require("./fixtures/uw-biology-complete-diagnostics.fixture.cjs");

const RUN_DIAGNOSTICS =
  process.env.TRANSFER_PLANNER_RUN_UW_BIOLOGY_DIAGNOSTICS === "1";
const diagnosticTest = RUN_DIAGNOSTICS ? test : test.skip;

function normalizeCourseCode(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .toUpperCase()
    .replace(/\bB\s+(BIO|CHEM|PHYS)\b/g, "B$1")
    .replace(/\bST\s+MATH\b/g, "STMATH")
    .replace(/\bQ\s*SCI\b/g, "QSCI")
    .replace(/\bBIO\s+A\b/g, "BIO A")
    .replace(/\bENV\s+H\b/g, "ENV H")
    .replace(/\bP\s+BIO\b/g, "P BIO")
    .replace(/\bB\s+STR\b/g, "B STR")
    .replace(/\bL\s+ARCH\b/g, "L ARCH")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^([A-Z&]+(?:\s+[A-Z&]+)*)\s*(\d{3}[A-Z]?)$/, "$1 $2");
}

function normalizePathwayId(value) {
  return String(value ?? "").trim().toLowerCase();
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
    ...(program.pathwayGroups ?? []).flatMap((pathway) => [
      ...(pathway.suggestedCourses ?? []),
      ...(pathway.capstoneCourses ?? []),
      ...(pathway.enrichingCourses ?? []),
    ]),
  ].map(normalizeCourseCode));
}

function getParsedUwCourseCodes(program) {
  const blocks = planner.getTransferPlannerParsedRequirementSourceBlocks(program.planId) ?? [];
  return uniqueSorted(
    blocks.flatMap((block) => block.parsedUwCourseCodes ?? []).map(normalizeCourseCode)
  );
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
  ].map((pathway) => normalizePathwayId(pathway.id)));
}

function getDirectBiologyPlanIds() {
  return uniqueSorted(
    ["uw-seattle", "uw-bothell", "uw-tacoma"].flatMap((campusId) =>
      planner
        .getTransferPlannerMajorsForCampus(campusId)
        .filter((plan) => {
          const title = String(plan.title ?? "").trim();
          const shortTitle = String(plan.shortTitle ?? "").trim();
          return [title, shortTitle].some((value) => /^Biology(?:\s|\(|$)/i.test(value));
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
      `Missing: ${missing.slice(0, 180).join(", ")}`,
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
      `Missing: ${missing.slice(0, 140).join(" | ")}`,
    ].join("\n")
  );
}

test("UW biology complete diagnostic fixture is source scoped and UW-course only", () => {
  assert.deepEqual(
    biologyPrograms.map((program) => program.planId),
    ["uw-seattle-biology", "uw-bothell-biology"]
  );

  for (const program of biologyPrograms) {
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

diagnosticTest("UW biology target roster matches direct official Biology majors", () => {
  const expectedPlanIds = uniqueSorted(biologyPrograms.map((program) => program.planId));
  const actualPlanIds = getDirectBiologyPlanIds();

  assert.deepEqual(
    actualPlanIds,
    expectedPlanIds,
    [
      "Direct Biology roster should include Seattle Biology and Bothell Biology only.",
      "Tacoma has biology coursework and biomedical/environmental majors but no standalone Biology major.",
      "Seattle Marine Biology, Microbiology, Biochemistry, and Tacoma Biomedical Sciences should remain separate majors.",
      `Expected: ${expectedPlanIds.join(", ")}`,
      `Actual: ${actualPlanIds.join(", ")}`,
    ].join("\n")
  );
});

for (const program of biologyPrograms) {
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
      (program.expectedPathwayIds ?? []).map(normalizePathwayId)
    );
    assert.deepEqual(
      actualPathwayIds,
      expectedPathwayIds,
      `${program.planId} should preserve the complete official pathway set`
    );

    const text = getCurrentPlanText(program);
    assertTextIncludesAll(
      text,
      [
        ...(program.optionGroups ?? []).map((group) => group.label),
        ...(program.pathwayGroups ?? []).map((pathway) => pathway.label),
      ],
      `${program.planId} option/pathway labels`
    );

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
