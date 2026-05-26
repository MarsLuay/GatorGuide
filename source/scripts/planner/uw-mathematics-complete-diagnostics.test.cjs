const assert = require("node:assert/strict");
const test = require("node:test");

const {
  mathematicsPrograms,
} = require("./fixtures/uw-mathematics-complete-diagnostics.fixture.cjs");

const RUN_DIAGNOSTICS =
  process.env.TRANSFER_PLANNER_RUN_UW_MATHEMATICS_DIAGNOSTICS === "1";
const diagnosticTest = RUN_DIAGNOSTICS ? test : test.skip;

let plannerModule;

function getPlanner() {
  if (plannerModule) {
    return plannerModule;
  }

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

  plannerModule = require("../../constants/transfer-planner-source");
  return plannerModule;
}

function normalizeCourseCode(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .toUpperCase()
    .replace(/\bA\s+MATH\b/g, "AMATH")
    .replace(/\bC\s+SCI\b/g, "CSCI")
    .replace(/\bQ\s+SCI\b/g, "QSCI")
    .replace(/\bST\s+MATH\b/g, "STMATH")
    .replace(/\bB\s+(BUS|MATH)\b/g, "B$1")
    .replace(/\bCSS\s+SKL\b/g, "CSSSKL")
    .replace(/\bT\s+(BECON|BGEN|CSS|ESC|MATH|ME|PHYS|STAT|URB|WOMN)\b/g, "T$1")
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
  const planner = getPlanner();
  const blocks = planner.getTransferPlannerParsedRequirementSourceBlocks(program.planId) ?? [];
  return uniqueSorted(
    blocks.flatMap((block) => block.parsedUwCourseCodes ?? []).map(normalizeCourseCode)
  );
}

function getCurrentPlanText(program) {
  const planner = getPlanner();
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
  const planner = getPlanner();
  const sourcePlan = planner.getTransferPlannerMajorPlan(program.planId);
  const runtimePlan = planner.getTransferPlannerStudentRuntimeMajorPlan(program.planId);
  return uniqueSorted([
    ...planner.getTransferPlannerPathwaysForPlan(sourcePlan),
    ...planner.getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan),
  ].map((pathway) => normalizePathwayId(pathway.id)));
}

function getDirectMathematicsPlanIds() {
  const planner = getPlanner();
  const exactMathTitles = new Set([
    "applied & computational mathematical sciences (acms)",
    "applied & computational mathematical sciences",
    "applied mathematics",
    "mathematics",
    "mathematical thinking & visualization",
  ]);

  return uniqueSorted(
    ["uw-seattle", "uw-bothell", "uw-tacoma"].flatMap((campusId) =>
      planner
        .getTransferPlannerMajorsForCampus(campusId)
        .filter((plan) => {
          const titles = [plan.title, plan.shortTitle].map((value) =>
            String(value ?? "").trim().toLowerCase()
          );
          return titles.some((title) => exactMathTitles.has(title));
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

test("UW mathematics complete diagnostic fixture is source scoped and UW-course only", () => {
  assert.deepEqual(
    mathematicsPrograms.map((program) => program.planId),
    [
      "uw-seattle-applied-and-computational-mathematical-sciences",
      "uw-seattle-applied-mathematics",
      "uw-seattle-mathematics",
      "uw-bothell-mathematical-thinking-and-visualization",
      "uw-bothell-mathematics",
      "uw-tacoma-mathematics",
    ]
  );

  for (const program of mathematicsPrograms) {
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

diagnosticTest("UW mathematics target roster matches direct official math-family majors", () => {
  const expectedPlanIds = uniqueSorted(mathematicsPrograms.map((program) => program.planId));
  const actualPlanIds = getDirectMathematicsPlanIds();

  assert.deepEqual(
    actualPlanIds,
    expectedPlanIds,
    [
      "Direct Mathematics roster should include ACMS, Applied Mathematics, Mathematics, and Mathematical Thinking & Visualization only.",
      "Statistics, Computational Finance, and Data Visualization are adjacent programs and should remain outside this target fixture.",
      `Expected: ${expectedPlanIds.join(", ")}`,
      `Actual: ${actualPlanIds.join(", ")}`,
    ].join("\n")
  );
});

for (const program of mathematicsPrograms) {
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
