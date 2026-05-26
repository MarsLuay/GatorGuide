"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

if (process.env.TRANSFER_PLANNER_RUN_UW_PHYSICS_ASTRONOMY_DIAGNOSTICS !== "1") {
  test("UW Physics/Astronomy complete diagnostics are opt-in", { skip: true }, () => {});
  return;
}

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
    jsx: "react-jsx",
    baseUrl: ".",
    paths: { "@/*": ["./*"] },
  },
});
require("tsconfig-paths/register");

const planner = require("../../constants/transfer-planner-source");
const {
  physicsAstronomyPrograms,
} = require("./fixtures/uw-physics-astronomy-complete-diagnostics.fixture.cjs");

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}

function normalizeCourseCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\bA\s+MATH\b/g, "AMATH")
    .replace(/\bB\s+(CHEM|PHYS)\b/g, "B$1")
    .replace(/\bST\s+MATH\b/g, "STMATH")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flattenText).join(" ");
  if (typeof value === "object") return Object.values(value).map(flattenText).join(" ");
  return String(value);
}

function getSourceBlocks(planId) {
  const blocks = planner.getTransferPlannerParsedRequirementSourceBlocks(planId);
  assert.ok(Array.isArray(blocks), `${planId} should expose parsed source blocks`);
  assert.ok(blocks.length > 0, `${planId} should have parsed source blocks`);
  return blocks;
}

function getRuntimePlan(planId) {
  const plan = planner.getTransferPlannerStudentRuntimeMajorPlan(planId);
  assert.ok(plan, `${planId} should exist in the runtime registry`);
  return plan;
}

function getSourcePlan(planId) {
  const plan = planner.getTransferPlannerMajorPlan(planId);
  assert.ok(plan, `${planId} should exist in the source registry`);
  return plan;
}

function getParsedCourseCodes(planId) {
  return unique(
    getSourceBlocks(planId).flatMap((block) =>
      (block.parsedUwCourseCodes || []).map(normalizeCourseCode)
    )
  );
}

function getRuntimeCourseCodes(planId) {
  const runtimePlan = getRuntimePlan(planId);
  return unique(flattenText(runtimePlan).match(courseCodePattern()) || []).map(normalizeCourseCode);
}

function courseCodePattern() {
  return /\b(?:A\s*MATH|AMATH|ASTR|B\s*(?:CHEM|PHYS)|BCHEM|BPHYS|BIOC|BIOL|CHEM|CSS|ENGL|GENOME|GRDSCH|MATH|MICROM|NEUSCI|PHYS|ST\s*MATH|STMATH)\s+\d{3}[A-Z]?\b/g;
}

function getPlanText(planId) {
  return [
    flattenText(getSourcePlan(planId)),
    flattenText(getRuntimePlan(planId)),
    flattenText(getSourceBlocks(planId)),
  ].join(" ");
}

function getPathwayIds(planId) {
  const sourcePathways = planner.getTransferPlannerPathwaysForPlan(getSourcePlan(planId)) || [];
  const runtimePathways =
    planner.getTransferPlannerStudentRuntimePathwaysForPlan(getRuntimePlan(planId)) || [];
  return unique([...sourcePathways, ...runtimePathways].map((pathway) => pathway.id));
}

function getPathwayText(planId, pathwayId) {
  const sourcePathways = planner.getTransferPlannerPathwaysForPlan(getSourcePlan(planId)) || [];
  const runtimePathways =
    planner.getTransferPlannerStudentRuntimePathwaysForPlan(getRuntimePlan(planId)) || [];
  return flattenText([
    sourcePathways.find((pathway) => pathway.id === pathwayId),
    runtimePathways.find((pathway) => pathway.id === pathwayId),
  ]);
}

function missing(expected, actual) {
  const actualSet = new Set(actual.map(normalizeCourseCode));
  return expected.map(normalizeCourseCode).filter((course) => !actualSet.has(course));
}

function getDirectPhysicsAstronomyPlanIds() {
  const includedTitles = new Set(["astronomy", "physics"]);
  const campuses = ["uw-seattle", "uw-bothell", "uw-tacoma"];
  const plans = campuses.flatMap((campusId) =>
    planner.getTransferPlannerMajorsForCampus(campusId).map((plan) => ({
      campusId,
      id: plan.id,
      title: String(plan.title || plan.shortTitle || "").toLowerCase().replace(/\s*\(.+?\)\s*/g, ""),
    }))
  );
  return unique(
    plans
      .filter((plan) => includedTitles.has(plan.title.trim()))
      .map((plan) => plan.id)
  );
}

test("fixture is source scoped to every direct UW Physics/Astronomy planner target", () => {
  const expectedIds = physicsAstronomyPrograms.map((program) => program.planId);
  assert.deepEqual(
    expectedIds,
    [
      "uw-seattle-astronomy",
      "uw-seattle-physics",
      "uw-bothell-physics-ba",
      "uw-bothell-physics-bs",
    ],
    "fixture should enumerate the direct all-campus Physics/Astronomy target roster"
  );
  assert.deepEqual(getDirectPhysicsAstronomyPlanIds(), unique(expectedIds));
});

test("each Physics/Astronomy target keeps its official UW source links", () => {
  for (const program of physicsAstronomyPrograms) {
    const text = getPlanText(program.planId);
    for (const source of program.officialSources) {
      assert.match(
        text,
        new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `${program.planId} should preserve official source ${source}`
      );
    }
  }
});

test("each Physics/Astronomy target exposes every official UW course in parsed source and runtime", () => {
  for (const program of physicsAstronomyPrograms) {
    const parsedCourses = getParsedCourseCodes(program.planId);
    const runtimeCourses = getRuntimeCourseCodes(program.planId);
    const parsedMissing = missing(program.requiredCourseCodes, parsedCourses);
    const runtimeMissing = missing(program.requiredCourseCodes, runtimeCourses);
    assert.deepEqual(
      parsedMissing,
      [],
      `${program.planId} parsed source is missing: ${parsedMissing.join(", ")}`
    );
    assert.deepEqual(
      runtimeMissing,
      [],
      `${program.planId} runtime is missing: ${runtimeMissing.join(", ")}`
    );
  }
});

test("each Physics/Astronomy target preserves major-specific course buckets", () => {
  for (const program of physicsAstronomyPrograms) {
    const parsedCourses = getParsedCourseCodes(program.planId);
    for (const [bucketName, expectedCourses] of Object.entries(program.courseBuckets || {})) {
      const bucketMissing = missing(expectedCourses, parsedCourses);
      assert.deepEqual(
        bucketMissing,
        [],
        `${program.planId} ${bucketName} bucket is missing: ${bucketMissing.join(", ")}`
      );
    }
  }
});

test("each Physics/Astronomy target preserves every official option and pathway", () => {
  for (const program of physicsAstronomyPrograms) {
    const actualPathwayIds = getPathwayIds(program.planId);
    assert.deepEqual(
      actualPathwayIds,
      program.expectedPathwayIds,
      `${program.planId} pathway roster should match official options`
    );

    const planText = getPlanText(program.planId).toLowerCase();
    for (const optionGroup of program.optionGroups || []) {
      assert.match(
        planText,
        new RegExp(optionGroup.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        `${program.planId} should name option group ${optionGroup.label}`
      );
      for (const option of optionGroup.options || []) {
        const missingOptionText = option.filter(
          (entry) => !planText.includes(String(entry).toLowerCase())
        );
        assert.deepEqual(
          missingOptionText,
          [],
          `${program.planId} ${optionGroup.label} option is missing: ${missingOptionText.join(", ")}`
        );
      }
    }
  }
});

test("each Physics/Astronomy pathway exposes its track-specific courses", () => {
  for (const program of physicsAstronomyPrograms) {
    for (const [pathwayId, expectedCourses] of Object.entries(
      program.pathwayCourseExpectations || {}
    )) {
      const pathwayText = getPathwayText(program.planId, pathwayId);
      assert.ok(pathwayText, `${program.planId} should expose pathway ${pathwayId}`);
      const pathwayCourses = unique(
        (pathwayText.match(courseCodePattern()) || []).map(normalizeCourseCode)
      );
      const pathwayMissing = missing(expectedCourses, pathwayCourses);
      assert.deepEqual(
        pathwayMissing,
        [],
        `${program.planId} ${pathwayId} is missing: ${pathwayMissing.join(", ")}`
      );
    }
  }
});

test("each Physics/Astronomy target preserves actual UW gen-ed and degree context", () => {
  for (const program of physicsAstronomyPrograms) {
    const planText = getPlanText(program.planId).toLowerCase();
    for (const expectation of program.genEdExpectations || []) {
      assert.match(
        planText,
        new RegExp(expectation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        `${program.planId} should preserve gen-ed/degree context: ${expectation}`
      );
    }
  }
});
