const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertIncludesAll,
  assertTextIncludesAll,
  createDiagnosticTest,
  createSourceTextFetcher,
  flattenText,
  getPlanner,
  isExtractableSource,
  normalizePathwayId,
  normalizeText,
  uniqueSorted,
} = require("./lib/test-harness.cjs");

const {
  bothellRemainingPlanIds,
  equivalentMajorGroups,
  remainingBothellPrograms,
} = require("./fixtures/uw-bothell-remaining-complete-diagnostics.fixture.cjs");

const diagnosticTest = createDiagnosticTest(
  test,
  "TRANSFER_PLANNER_RUN_UW_BOTHELL_REMAINING_DIAGNOSTICS"
);
const onlineDiagnosticTest =
  process.env.TRANSFER_PLANNER_COMPLETE_DIAGNOSTICS_ONLINE === "1"
    ? diagnosticTest
    : test.skip;
const fetchSourceText = createSourceTextFetcher({
  operation: "Fetch Bothell diagnostic official source",
});

function normalizeCourseCode(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .toUpperCase()
    .replace(/\bA\s+MATH\b/g, "AMATH")
    .replace(/\bB\s+(AES|BIO|BUS|CHEM|CORE|DATA|EARTH|EDUC|HLTH|HS|IMD|IS|MATH|PHYS|ST|WRIT)\b/g, "B$1")
    .replace(/\bQ\s+SCI\b/g, "QSCI")
    .replace(/\bST\s+MATH\b/g, "STMATH")
    .replace(/\bT\s+(ACCT|AMST|ARTS|BANLT|BIOL|BUS|COM|ECON|EGL|ESC|EST|FILM|GEOG|GEOS|GH|GIS|HIST|IAS|INFO|LAW|LAX|LIT|MATH|MKTG|PHIL|PHYS|POLS|PSYCH|RELIG|SOC|SOCWF|SPAN|UDE|URB|WOMN|WRT)\b/g, "T$1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^([A-Z&]+(?:\s+[A-Z&]+)*)\s*(\d{3}[A-Z]?)$/, "$1 $2");
}

function getParsedUwCourseCodes(planId) {
  const planner = getPlanner();
  const blocks = planner.getTransferPlannerParsedRequirementSourceBlocks(planId) ?? [];
  return uniqueSorted(
    blocks.flatMap((block) => block.parsedUwCourseCodes ?? []).map(normalizeCourseCode)
  );
}

function getCurrentPlanText(planId) {
  const planner = getPlanner();
  const sourcePlan = planner.getTransferPlannerMajorPlan(planId);
  const runtimePlan = planner.getTransferPlannerStudentRuntimeMajorPlan(planId);
  const sourcePathways = planner.getTransferPlannerPathwaysForPlan(sourcePlan);
  const runtimePathways = planner.getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan);
  const parsedBlocks = planner.getTransferPlannerParsedRequirementSourceBlocks(planId);
  const resolvedRuntimePlans = [
    runtimePlan ? planner.resolveTransferPlannerMajorPlan(runtimePlan, null) : null,
    ...(runtimePathways ?? []).map((pathway) =>
      planner.resolveTransferPlannerMajorPlan(runtimePlan, pathway.id)
    ),
  ];

  return normalizeText(
    flattenText({
      sourcePlan,
      runtimePlan,
      sourcePathways,
      runtimePathways,
      parsedBlocks,
      resolvedRuntimePlans,
    })
  );
}

function getRegisteredPathwayIds(planId) {
  const planner = getPlanner();
  const sourcePlan = planner.getTransferPlannerMajorPlan(planId);
  const runtimePlan = planner.getTransferPlannerStudentRuntimeMajorPlan(planId);
  return uniqueSorted([
    ...planner.getTransferPlannerPathwaysForPlan(sourcePlan),
    ...planner.getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan),
  ].map((pathway) => normalizePathwayId(pathway.id)));
}

function extractCourseCodesFromText(text) {
  const courseCodePattern = /\b(?:A\s*MATH|B\s*(?:AES|BIO|BUS|CHEM|CORE|DATA|EARTH|ECON|EDUC|HLTH|HS|IMD|IS|MATH|PHYS|ST|WRIT)|Q\s*SCI|ST\s*MATH|T\s*(?:ACCT|AMST|ARTS|BANLT|BIOL|BUS|COM|ECON|EGL|ESC|EST|FILM|GEOG|GEOS|GH|GIS|HIST|IAS|INFO|LAW|LAX|LIT|MATH|MKTG|PHIL|PHYS|POLS|PSYCH|RELIG|SOC|SOCWF|SPAN|UDE|URB|WOMN|WRT)|[A-Z]{2,7})\s+\d{3}[A-Z]?\b/g;
  return uniqueSorted((text.match(courseCodePattern) ?? []).map(normalizeCourseCode));
}

async function getOnlineCourseCodes(program) {
  const sourceTexts = await Promise.all(
    program.officialSources.filter(isExtractableSource).map(fetchSourceText)
  );
  return uniqueSorted(sourceTexts.flatMap(extractCourseCodesFromText));
}

test("UW Bothell remaining diagnostic fixture is source scoped and UW-course only", () => {
  assert.deepEqual(bothellRemainingPlanIds, [
    "uw-bothell-american-and-ethnic-studies",
    "uw-bothell-business-administration-accounting",
    "uw-bothell-business-administration-finance",
    "uw-bothell-business-administration-leadership-and-strategic-innovation",
    "uw-bothell-business-administration-marketing",
    "uw-bothell-business-administration-supply-chain-management",
    "uw-bothell-csse-information-assurance-and-cybersecurity",
    "uw-bothell-culture-literature-and-the-arts",
    "uw-bothell-data-visualization-ba",
    "uw-bothell-data-visualization-bs",
    "uw-bothell-gender-women-and-sexuality-studies",
    "uw-bothell-global-studies",
    "uw-bothell-interactive-media-design",
    "uw-bothell-interdisciplinary-arts",
    "uw-bothell-science-technology-and-society",
    "uw-bothell-society-ethics-and-human-behavior",
    "uw-bothell-chemistry-biochemistry",
  ]);

  const fixturePlanIds = uniqueSorted(remainingBothellPrograms.map((program) => program.planId));
  const groupPlanIds = uniqueSorted(equivalentMajorGroups.flatMap((group) => group.planIds));
  assert.deepEqual(fixturePlanIds, groupPlanIds);

  for (const program of remainingBothellPrograms) {
    assert.equal(program.officialSources.length > 0, true, `${program.planId} needs sources`);
    const communityCollegeCodes = extractCourseCodesFromText(
      [...(program.requiredTextSnippets ?? []), ...(program.officialSources ?? [])].join(" ")
    ).filter((code) => /\b[A-Z]+&\s+\d/.test(code));
    assert.deepEqual(
      communityCollegeCodes,
      [],
      `${program.planId} fixture should contain UW course codes only`
    );
  }
});

diagnosticTest("UW Bothell remaining target roster exists in the current planner", () => {
  const planner = getPlanner();
  const actualBothellPlanIds = uniqueSorted(
    planner.getTransferPlannerMajorsForCampus("uw-bothell").map((plan) => plan.id)
  );
  assertIncludesAll(
    actualBothellPlanIds,
    bothellRemainingPlanIds,
    "UW Bothell remaining major roster"
  );
});

diagnosticTest("UW Bothell remaining equivalent groups reference real planner majors", () => {
  const planner = getPlanner();
  for (const group of equivalentMajorGroups) {
    for (const planId of group.planIds) {
      assert.ok(
        planner.getTransferPlannerMajorPlan(planId),
        `${group.id} references missing planner major ${planId}`
      );
    }
  }
});

for (const program of remainingBothellPrograms) {
  diagnosticTest(`${program.planId} keeps every official source link`, () => {
    assertTextIncludesAll(
      getCurrentPlanText(program.planId),
      program.officialSources,
      `${program.planId} official source links`
    );
  });

  onlineDiagnosticTest(`${program.planId} exposes every online official UW course`, async () => {
    const onlineCourses = await getOnlineCourseCodes(program);
    if (onlineCourses.length === 0) {
      return;
    }
    assertIncludesAll(
      getParsedUwCourseCodes(program.planId),
      onlineCourses,
      `${program.planId} parsed requirement-source blocks`,
      { normalize: normalizeCourseCode }
    );
  });

  diagnosticTest(`${program.planId} preserves every known pathway`, () => {
    assert.deepEqual(
      getRegisteredPathwayIds(program.planId),
      uniqueSorted((program.expectedPathwayIds ?? []).map(normalizePathwayId)),
      `${program.planId} should preserve the complete pathway set`
    );
  });

  diagnosticTest(`${program.planId} preserves degree/gen-ed context snippets`, () => {
    assertTextIncludesAll(
      getCurrentPlanText(program.planId),
      program.requiredTextSnippets ?? [],
      `${program.planId} degree/gen-ed context`
    );
  });
}
