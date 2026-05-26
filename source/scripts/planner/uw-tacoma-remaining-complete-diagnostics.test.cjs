const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  crossCampusEquivalentPlanIdsByFamily,
  crossCampusEquivalentPrograms,
  tacomaRemainingPrograms,
} = require("./fixtures/uw-tacoma-remaining-complete-diagnostics.fixture.cjs");

const RUN_DIAGNOSTICS =
  process.env.TRANSFER_PLANNER_RUN_UW_TACOMA_REMAINING_DIAGNOSTICS === "1";
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
    .replace(/\bT\s+(AMST|ARTS|BIOL|BIOMD|CHEM|COM|CORE|CSS|ECON|EDUC|EGL|ESC|EST|FILM|GEOG|GEOS|GH|GIS|HIST|IAS|INFO|INST|LAW|LAX|LIT|MATH|NPRFT|PHIL|PHYS|POLS|PSYCH|RELIG|SOC|SOCWF|SPAN|UDE|URB|WOMN|WRT)\b/g, "T$1")
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
  ].map(normalizeCourseCode));
}

function getParsedUwCourseCodes(program) {
  const planner = getPlanner();
  const blocks = planner.getTransferPlannerParsedRequirementSourceBlocks(program.planId) ?? [];
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

  return normalizeText(
    JSON.stringify({
      sourcePlan,
      runtimePlan,
      sourcePathways,
      runtimePathways,
      parsedBlocks,
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

function getAllFixtureCoveredPlanIds() {
  const fixtureRoot = path.join(process.cwd(), "scripts", "planner", "fixtures");
  const ids = new Set(tacomaRemainingPrograms.map((program) => program.planId));
  for (const file of fs.readdirSync(fixtureRoot)) {
    if (!/^uw-.*-complete-diagnostics\.fixture\.cjs$/.test(file)) continue;
    const mod = require(path.join(fixtureRoot, file));
    for (const value of Object.values(mod)) {
      if (!Array.isArray(value)) continue;
      for (const item of value) {
        if (item && typeof item.planId === "string") {
          ids.add(item.planId);
        }
      }
    }
  }
  return ids;
}

function getTacomaPlanIds() {
  const planner = getPlanner();
  return uniqueSorted(
    planner.getTransferPlannerMajorsForCampus("uw-tacoma").map((plan) => plan.id)
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

  for (const program of tacomaRemainingPrograms) {
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

test("UW Tacoma cross-campus equivalent fixture is source scoped and UW-course only", () => {
  assert.deepEqual(
    crossCampusEquivalentPrograms.map((program) => program.planId),
    [
      "uw-seattle-marine-biology",
      "uw-seattle-medical-laboratory-science",
      "uw-seattle-microbiology",
      "uw-seattle-neuroscience",
      "uw-seattle-american-indian-studies",
      "uw-seattle-history",
      "uw-seattle-spanish",
      "uw-seattle-community-environment-and-planning",
      "uw-seattle-landscape-architecture",
      "uw-seattle-comparative-literature",
      "uw-seattle-english-creative-writing",
      "uw-seattle-english-language-literature-and-culture",
    ]
  );

  for (const program of crossCampusEquivalentPrograms) {
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

diagnosticTest("complete diagnostics now cover every UW Tacoma planner major", () => {
  const coveredPlanIds = getAllFixtureCoveredPlanIds();
  const missingTacomaPlanIds = getTacomaPlanIds().filter((planId) => !coveredPlanIds.has(planId));

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
  const coveredPlanIds = getAllFixtureCoveredPlanIds();
  const missingEquivalentPlans = [];
  const equivalentPlansWithoutCompleteFixture = [];

  for (const [family, planIds] of Object.entries(crossCampusEquivalentPlanIdsByFamily)) {
    for (const planId of planIds) {
      if (!planner.getTransferPlannerMajorPlan(planId)) {
        missingEquivalentPlans.push(`${family}:${planId}`);
        continue;
      }
      if (!coveredPlanIds.has(planId)) {
        equivalentPlansWithoutCompleteFixture.push(`${family}:${planId}`);
      }
    }
  }

  assert.deepEqual(missingEquivalentPlans, []);
  assert.deepEqual(
    equivalentPlansWithoutCompleteFixture,
    [],
    [
      "Cross-campus equivalent plans should be represented by an opt-in complete diagnostic fixture.",
      `Missing complete fixture coverage: ${equivalentPlansWithoutCompleteFixture.join(", ")}`,
    ].join("\n")
  );
});

for (const program of [...tacomaRemainingPrograms, ...crossCampusEquivalentPrograms]) {
  diagnosticTest(`${program.title} keeps every official source link`, () => {
    const text = getCurrentPlanText(program.planId);
    assertTextIncludesAll(text, program.officialSources, `${program.planId} official source links`);
  });

  diagnosticTest(`${program.title} exposes every official UW course`, () => {
    assertIncludesAll(
      getParsedUwCourseCodes(program),
      flattenExpectedCourseCodes(program),
      `${program.planId} parsed requirement-source blocks`
    );
  });

  diagnosticTest(`${program.title} preserves every official option and pathway`, () => {
    const actualPathwayIds = getRegisteredPathwayIds(program);
    const expectedPathwayIds = uniqueSorted(
      (program.expectedPathwayIds ?? []).map(normalizePathwayId)
    );
    assert.deepEqual(
      actualPathwayIds,
      expectedPathwayIds,
      `${program.planId} should preserve the complete official pathway set`
    );

    const text = getCurrentPlanText(program.planId);
    assertTextIncludesAll(
      text,
      (program.optionGroups ?? []).map((group) => group.label),
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

  diagnosticTest(`${program.title} preserves gen-ed and credit-bucket shape`, () => {
    const text = getCurrentPlanText(program.planId);
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
