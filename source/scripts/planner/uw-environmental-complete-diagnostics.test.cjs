const assert = require("node:assert/strict");
const test = require("node:test");

const {
  environmentalPrograms,
} = require("./fixtures/uw-environmental-complete-diagnostics.fixture.cjs");

const RUN_DIAGNOSTICS =
  process.env.TRANSFER_PLANNER_RUN_UW_ENVIRONMENTAL_DIAGNOSTICS === "1";
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
    .replace(/\bATM\s+S\b/g, "ATMS")
    .replace(/\bB\s+(BIO|BUS|CHEM|EARTH|ENGR|GIS|HLTH|MATH|PHYS|WRIT)\b/g, "B$1")
    .replace(/\bIND\s+E\b/g, "INDE")
    .replace(/\bJSIS\s+([AB])\b/g, "JSIS$1")
    .replace(/\bL\s+ARCH\b/g, "LARCH")
    .replace(/\bQ\s+SCI\b/g, "QSCI")
    .replace(/\bT\s+(ARTS|BGEN|BIOL|BIOMD|BUS|CHEM|COM|ECON|EDUC|EGL|ESC|EST|GEOG|GEOS|GH|GIS|HIST|IAS|INST|LAW|LIT|MATH|MGMT|NPRFT|PHIL|PHYS|POLS|PSYCH|RELIG|SOC|SUD|UDE|URB|WOMN|WRT)\b/g, "T$1")
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

function getDirectEnvironmentalPlanIds() {
  const planner = getPlanner();
  const exactTitles = new Set([
    "environmental science & terrestrial resource management",
    "environmental studies",
    "environmental design & sustainability",
    "sustainable bioresource systems engineering",
    "conservation & restoration science",
    "earth system science",
    "environmental science",
    "environmental sustainability",
    "sustainable urban development",
  ]);
  const excludedTitles = new Set([
    "environmental engineering",
    "environmental public health",
  ]);

  return uniqueSorted(
    ["uw-seattle", "uw-bothell", "uw-tacoma"].flatMap((campusId) =>
      planner
        .getTransferPlannerMajorsForCampus(campusId)
        .filter((plan) => {
          const titles = [plan.title, plan.shortTitle].map((value) =>
            String(value ?? "")
              .trim()
              .toLowerCase()
              .replace(/\s*\([^)]*\)\s*/g, "")
          );
          return titles.some((title) => exactTitles.has(title)) &&
            !titles.some((title) => excludedTitles.has(title));
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

test("UW environmental complete diagnostic fixture is source scoped and UW-course only", () => {
  assert.deepEqual(
    environmentalPrograms.map((program) => program.planId),
    [
      "uw-seattle-environmental-science-and-terrestrial-resource-management",
      "uw-seattle-environmental-studies",
      "uw-seattle-environmental-design-and-sustainability",
      "uw-seattle-sustainable-bioresource-systems-engineering",
      "uw-bothell-conservation-and-restoration-science",
      "uw-bothell-earth-system-science",
      "uw-bothell-environmental-studies",
      "uw-tacoma-environmental-science",
      "uw-tacoma-environmental-sustainability",
      "uw-tacoma-sustainable-urban-development",
    ]
  );

  for (const program of environmentalPrograms) {
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

diagnosticTest("UW environmental target roster matches direct official environmental/sustainability-family majors", () => {
  const expectedPlanIds = uniqueSorted(environmentalPrograms.map((program) => program.planId));
  const actualPlanIds = getDirectEnvironmentalPlanIds();

  assert.deepEqual(
    actualPlanIds,
    expectedPlanIds,
    [
      "Direct Environmental/Sustainability-family roster should include explicit Environmental Science, Environmental Studies, Environmental Sustainability, Sustainable, Conservation & Restoration, and Earth System Science majors across UW campuses.",
      "Environmental Engineering belongs to the Civil/Environmental Engineering family; Environmental Public Health belongs to the Health/Public Health family.",
      "Bothell's retired Environmental Science page is excluded because it is no longer accepting new students and points students to Conservation & Restoration Science or Earth System Science.",
      `Expected: ${expectedPlanIds.join(", ")}`,
      `Actual: ${actualPlanIds.join(", ")}`,
    ].join("\n")
  );
});

for (const program of environmentalPrograms) {
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
