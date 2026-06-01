const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertIncludesAll,
  assertTextIncludesAll,
  createDiagnosticTest,
  createSourceTextFetcher,
  flattenText,
  getExpectedCourseCodesFromProgram,
  getPlanner,
  isExtractableSource,
  loadCompleteDiagnosticPrograms,
  normalizePathwayId,
  normalizeText,
  uniqueSorted,
} = require("./lib/test-harness.cjs");

const {
  crossCampusEquivalentPlanIdsByFamily,
  crossCampusEquivalentPrograms,
  tacomaRemainingPrograms,
} = require("./fixtures/uw-tacoma-remaining-complete-diagnostics.fixture.cjs");
const {
  extractCourseCodesFromLineForTest,
} = require("./parse-transfer-planner-requirement-sources.cjs");

const diagnosticTest = createDiagnosticTest(
  test,
  "TRANSFER_PLANNER_RUN_UW_TACOMA_REMAINING_DIAGNOSTICS"
);
const onlineDiagnosticTest =
  process.env.TRANSFER_PLANNER_COMPLETE_DIAGNOSTICS_ONLINE === "1"
    ? diagnosticTest
    : test.skip;
const fetchSourceText = createSourceTextFetcher({
  operation: "Fetch Tacoma diagnostic official source",
});

function normalizeCourseCode(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .toUpperCase()
    .replace(/\bT\s+(ACCT|AMST|ARTS|BIOL|BIOMD|CHEM|COM|CORE|CSS|ECON|EDUC|EGL|ESC|EST|FILM|GEOG|GEOS|GH|GIS|HIST|HLEAD|HLTH|IAS|INFO|INST|LAW|LAX|LIT|MATH|NPRFT|PHIL|PHYS|POLS|PSYCH|RELIG|SOC|SOCWF|SPAN|STAT|SUD|UDE|URB|WOMN|WRT)\b/g, "T$1")
    .replace(/\bB\s+E\b/g, "BE")
    .replace(/\bBIO\s+A\b/g, "BIOA")
    .replace(/\bC\s+LIT\b/g, "CLIT")
    .replace(/\bCHEM\s+E\b/g, "CHEME")
    .replace(/\bENV\s+H\b/g, "ENVH")
    .replace(/\bG\s+H\b/g, "GH")
    .replace(/\bL\s+ARCH\b/g, "LARCH")
    .replace(/\bLAB\s+M\b/g, "LABM")
    .replace(/\bQ\s+SCI\b/g, "QSCI")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^([A-Z&]+(?:\s+[A-Z&]+)*)\s*(\d{3}[A-Z]?)$/, "$1 $2");
}

function isTacomaProgram(program) {
  return program.planId.startsWith("uw-tacoma-");
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

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCourseSubject(code) {
  return normalizeCourseCode(code).replace(/\s+\d{3}[A-Z]?$/, "");
}

function extractCourseCodesFromText(text, allowedSubjects = null) {
  const source = String(text ?? "").replace(
    /\b(GIS|SUD|UDE|URB)\s+(\d{3}[A-Z]?)\b/g,
    "T$1 $2"
  );
  const allowedSubjectPattern =
    allowedSubjects && allowedSubjects.size > 0
      ? [...allowedSubjects]
          .sort((left, right) => right.length - left.length)
          .map((subject) => escapeRegExp(subject).replace(/\s+/g, "\\s+"))
          .join("|")
      : null;
  const directMatches = allowedSubjectPattern
    ? source.match(new RegExp(`\\b(?:${allowedSubjectPattern})\\s+\\d{3}[A-Z]?\\b`, "gi")) ?? []
    : source.match(/\b[A-Z]{1,8}(?:\s+[A-Z]{1,8}){0,2}\s+\d{3}[A-Z]?\b/g) ?? [];
  const sharedSubjectMatches = [...source.matchAll(/\b([A-Z]{1,8})\/([A-Z]{1,8})\s+(\d{3}[A-Z]?)\b/g)]
    .flatMap((match) => [`${match[1]} ${match[3]}`, `${match[2]} ${match[3]}`]);
  const sharedNumberMatches = [...source.matchAll(/\b([A-Z]{1,8})\s+(\d{3}[A-Z]?)\/(\d{3}[A-Z]?)\b/g)]
    .flatMap((match) => [`${match[1]} ${match[2]}`, `${match[1]} ${match[3]}`]);
  return uniqueSorted(
    [
      ...directMatches,
      ...sharedSubjectMatches,
      ...sharedNumberMatches,
      ...source
        .split(/\r?\n/)
        .flatMap(extractCourseCodesFromLineForTest),
    ]
      .map(normalizeCourseCode)
      .filter((code) => !allowedSubjects || allowedSubjects.has(getCourseSubject(code)))
  );
}

function getProgramSourceUrls(program) {
  const planner = getPlanner();
  const parsedBlocks = planner.getTransferPlannerParsedRequirementSourceBlocks(program.planId) ?? [];
  return uniqueSorted([
    ...(program.officialSources ?? []),
    ...parsedBlocks.map((block) => block.sourceUrl).filter(Boolean),
  ]).filter(isExtractableSource);
}

async function getOnlineCourseCodes(program) {
  const sourceTexts = await Promise.all(getProgramSourceUrls(program).map(fetchSourceText));
  const allowedSubjects = new Set(getExpectedCourseCodesFromProgram(program).map(getCourseSubject));
  return uniqueSorted(sourceTexts.flatMap((text) => extractCourseCodesFromText(text, allowedSubjects)));
}

function getDegreeContextSnippets(program) {
  return [
    ...(program.requiredTextSnippets ?? []),
    ...(program.genEdRequirements ?? []),
    ...(program.requirementLabels ?? []),
    ...(program.courseBuckets ?? []).flatMap((bucket) => [
      bucket.label,
      bucket.minCredits != null ? `${bucket.minCredits}` : null,
      bucket.minCourses != null ? `${bucket.minCourses}` : null,
      bucket.maxCredits != null ? `${bucket.maxCredits}` : null,
      ...(bucket.openEndedRules ?? []),
    ]),
  ];
}

test("UW Tacoma remaining diagnostic fixture is source scoped and UW-course only", () => {
  assert.deepEqual(
    tacomaRemainingPrograms.map((program) => program.planId),
    [
      "uw-tacoma-biomedical-sciences",
      "uw-tacoma-ethnic-gender-and-labor-studies",
      "uw-tacoma-history",
      "uw-tacoma-interdisciplinary-arts-and-sciences",
      "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed",
      "uw-tacoma-spanish-language-and-cultures",
      "uw-tacoma-urban-design",
      "uw-tacoma-urban-studies",
      "uw-tacoma-writing-studies",
    ]
  );

  for (const program of [...tacomaRemainingPrograms, ...crossCampusEquivalentPrograms]) {
    assert.equal(program.officialSources.length > 0, true, `${program.planId} needs sources`);
    const expectedCodes = getExpectedCourseCodesFromProgram(program).map(normalizeCourseCode);
    assert.equal(expectedCodes.length > 0, true, `${program.planId} needs course expectations`);
    const communityCollegeCodes = expectedCodes.filter((code) => /\b[A-Z]+&\s+\d/.test(code));
    assert.deepEqual(
      communityCollegeCodes,
      [],
      `${program.planId} fixture should contain UW course codes only`
    );
  }
});

diagnosticTest("complete diagnostics now cover every UW Tacoma planner major", () => {
  const { programs } = loadCompleteDiagnosticPrograms();
  const coveredPlanIds = new Set(programs.map((program) => program.planId));
  const planner = getPlanner();
  const missingTacomaPlanIds = uniqueSorted(
    planner
      .getTransferPlannerStudentVisibleMajorsForCampus("uw-tacoma")
      .map((plan) => plan.id)
      .filter((planId) => !coveredPlanIds.has(planId))
  );

  assert.deepEqual(
    missingTacomaPlanIds,
    [],
    [
      "Every Tacoma planner major should now be represented by an opt-in complete diagnostic fixture.",
      `Missing: ${missingTacomaPlanIds.join(", ")}`,
    ].join("\n")
  );
});

diagnosticTest("cross-campus equivalents for remaining Tacoma families are represented", () => {
  const planner = getPlanner();
  const { programs } = loadCompleteDiagnosticPrograms();
  const coveredPlanIds = new Set(programs.map((program) => program.planId));
  const missingFixtureCoverage = [];

  for (const [family, planIds] of Object.entries(crossCampusEquivalentPlanIdsByFamily)) {
    for (const planId of planIds) {
      assert.ok(
        planner.getTransferPlannerMajorPlan(planId),
        `${family} references missing planner major ${planId}`
      );
      if (!coveredPlanIds.has(planId)) {
        missingFixtureCoverage.push(`${family}:${planId}`);
      }
    }
  }

  assert.deepEqual(
    missingFixtureCoverage,
    [],
    [
      "Cross-campus equivalent plans should be represented by a complete diagnostic fixture.",
      `Missing complete fixture coverage: ${missingFixtureCoverage.join(", ")}`,
    ].join("\n")
  );
});

for (const program of tacomaRemainingPrograms) {
  diagnosticTest(`${program.planId} keeps every official source link`, () => {
    if (!isTacomaProgram(program)) {
      return;
    }
    assertTextIncludesAll(
      getCurrentPlanText(program.planId),
      program.officialSources,
      `${program.planId} official source links`
    );
  });

  onlineDiagnosticTest(`${program.planId} verifies every reviewed UW course against live official sources`, async () => {
    if (!isTacomaProgram(program)) {
      return;
    }
    assertIncludesAll(
      await getOnlineCourseCodes(program),
      getExpectedCourseCodesFromProgram(program),
      `${program.planId} live official source course evidence`,
      { normalize: normalizeCourseCode }
    );
  });

  diagnosticTest(`${program.planId} exposes every reviewed UW course`, () => {
    if (!isTacomaProgram(program)) {
      return;
    }
    assertIncludesAll(
      getParsedUwCourseCodes(program.planId),
      getExpectedCourseCodesFromProgram(program),
      `${program.planId} parsed requirement-source blocks`,
      { normalize: normalizeCourseCode }
    );
  });

  diagnosticTest(`${program.planId} preserves every known pathway`, () => {
    if (!isTacomaProgram(program)) {
      return;
    }
    const actualPathwayIds = getRegisteredPathwayIds(program.planId);
    const expectedPathwayIds = uniqueSorted(
      (program.expectedPathwayIds ?? []).map(normalizePathwayId)
    );
    assert.deepEqual(
      actualPathwayIds,
      expectedPathwayIds,
      `${program.planId} should preserve the reviewed pathway set`
    );
  });

  diagnosticTest(`${program.planId} preserves degree/gen-ed context snippets`, () => {
    if (!isTacomaProgram(program)) {
      return;
    }
    assertTextIncludesAll(
      getCurrentPlanText(program.planId),
      getDegreeContextSnippets(program),
      `${program.planId} degree/gen-ed context`
    );
  });
}
