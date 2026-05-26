const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  PLANNER_ROOT,
  array,
  flattenText,
  getExpectedCourseCodesFromProgram,
  loadCompleteDiagnosticPrograms,
  loadCurrentBootstrapPlans,
  uniqueSorted,
} = require("./lib/test-harness.cjs");

function getProgramAuditText(program) {
  return flattenText([
    program.title,
    program.officialSources,
    program.requiredTextSnippets,
    program.genEdSnippets,
    program.genEdRequirements,
    program.requirementLabels,
    program.expectedPathwayIds,
    program.optionGroups,
    program.courseBuckets,
    program.pathwayGroups,
    program.forbiddenCourseCodes,
  ]);
}

function hasLowerDivisionCourse(program) {
  return getExpectedCourseCodesFromProgram(program).some((courseCode) => {
    const match = String(courseCode).match(/\b(\d{3})[A-Z]?\b/);
    return match && Number.parseInt(match[1], 10) < 300;
  });
}

function hasLowerDivisionFoundationEvidence(program) {
  return (
    hasLowerDivisionCourse(program) &&
    /(foundation|foundational|introductory|lower[-\s]?division|prereq|preparation|admission|core courses?)/i.test(
      getProgramAuditText(program)
    )
  );
}

function hasRouteCollapseEvidence(program) {
  return (
    array(program.expectedPathwayIds).length > 1 ||
    array(program.pathwayGroups).length > 1 ||
    /(route|track|pathway|option|concentration|emphasis)/i.test(getProgramAuditText(program))
  );
}

function hasGraduateScopeLeakageEvidence(program) {
  return (
    array(program.forbiddenCourseCodes).some((courseCode) => /\b[5-9]\d{2}[A-Z]?\b/.test(courseCode)) ||
    /(graduate|undergraduate|400[-\s]?level|300[-\s]?level|upper[-\s]?division|not count|except|excluding)/i.test(
      getProgramAuditText(program)
    )
  );
}

function hasSupportOnlyDriftEvidence(program) {
  const officialSources = array(program.officialSources);
  return (
    officialSources.length > 1 &&
    /(admissions?|advising|general-education|equivalency|overview|requirements?|curriculum|courses?|capstones?|degree)/i.test(
      officialSources.join(" ")
    )
  );
}

function hasChooseNUnderfillingEvidence(program) {
  return (
    array(program.courseBuckets).some(
      (bucket) =>
        (bucket.minCredits != null || bucket.minCourses != null) &&
        (array(bucket.courseCodes).length > (bucket.minCourses ?? 1) ||
          array(bucket.openEndedRules).length > 0)
    ) ||
    array(program.optionGroups).some(
      (group) =>
        array(group.options).length > 1 &&
        /(one|two|three|four|choose|chosen|additional|or|from|select|minimum|credits?)/i.test(
          group.label ?? ""
        )
    ) ||
    /(choose|chosen|select|minimum|at least|additional|from .*list)/i.test(
      getProgramAuditText(program)
    )
  );
}

const bootstrapPlans = loadCurrentBootstrapPlans();
const { fixtureFiles, programs } = loadCompleteDiagnosticPrograms();
const programsByPlanId = new Map();
for (const program of programs) {
  if (!programsByPlanId.has(program.planId)) {
    programsByPlanId.set(program.planId, []);
  }
  programsByPlanId.get(program.planId).push(program);
}

test("official-source complete diagnostics cover every current UW planner major", () => {
  const bootstrapPlanIds = bootstrapPlans.map((plan) => plan.id);
  const missingPlanIds = bootstrapPlanIds.filter((planId) => !programsByPlanId.has(planId));

  assert.deepEqual(
    missingPlanIds,
    [],
    [
      "Every generated UW Seattle/Bothell/Tacoma planner major should have an owner-level complete diagnostic fixture.",
      `Missing: ${missingPlanIds.join(", ")}`,
    ].join("\n")
  );
});

test("each complete diagnostic fixture has a matching test file", () => {
  const missingTestFiles = fixtureFiles
    .map((fixtureFile) => fixtureFile.replace(/\.fixture\.cjs$/, ".test.cjs"))
    .filter((testFile) => !fs.existsSync(path.join(PLANNER_ROOT, testFile)));

  assert.deepEqual(
    missingTestFiles,
    [],
    `Every complete diagnostic fixture should be paired with an executable test file: ${missingTestFiles.join(", ")}`
  );
});

test("each owner-level complete diagnostic carries source and audit evidence", () => {
  const underSpecifiedOwners = bootstrapPlans
    .filter((plan) => {
      const planPrograms = programsByPlanId.get(plan.id) ?? [];
      return !planPrograms.some((program) => {
        const hasSource = array(program.officialSources).length > 0;
        const hasCourseEvidence = getExpectedCourseCodesFromProgram(program).length > 0;
        const hasTextEvidence =
          array(program.requiredTextSnippets).length > 0 ||
          array(program.genEdSnippets).length > 0 ||
          array(program.genEdRequirements).length > 0 ||
          array(program.requirementLabels).length > 0;
        const hasShapeEvidence =
          array(program.expectedPathwayIds).length > 0 ||
          array(program.optionGroups).length > 0 ||
          array(program.courseBuckets).length > 0 ||
          array(program.pathwayGroups).length > 0;
        return hasSource && (hasCourseEvidence || hasTextEvidence || hasShapeEvidence);
      });
    })
    .map((plan) => plan.id);

  assert.deepEqual(
    underSpecifiedOwners,
    [],
    [
      "Complete diagnostics should read like human audit specs: source link plus course, text, route, option, or bucket evidence.",
      `Under-specified: ${underSpecifiedOwners.join(", ")}`,
    ].join("\n")
  );
});

const RISK_FAMILY_EXPECTATIONS = [
  {
    id: "missing lower-division foundations",
    minimumDistinctOwners: 20,
    representativePlanIds: [
      "uw-seattle-business-administration",
      "uw-bothell-computer-engineering",
      "uw-tacoma-communications",
      "uw-tacoma-biomedical-sciences",
    ],
    matches: hasLowerDivisionFoundationEvidence,
  },
  {
    id: "route collapse",
    minimumDistinctOwners: 25,
    representativePlanIds: [
      "uw-seattle-biology",
      "uw-seattle-business-administration",
      "uw-seattle-education-studies",
      "uw-tacoma-history",
    ],
    matches: hasRouteCollapseEvidence,
  },
  {
    id: "graduate-scope leakage",
    minimumDistinctOwners: 20,
    representativePlanIds: [
      "uw-seattle-chemistry",
      "uw-seattle-electrical-computer-engineering",
      "uw-seattle-psychology",
      "uw-bothell-applied-computing",
    ],
    matches: hasGraduateScopeLeakageEvidence,
  },
  {
    id: "support-only drift",
    minimumDistinctOwners: 20,
    representativePlanIds: [
      "uw-seattle-food-systems-nutrition-and-health",
      "uw-seattle-human-centered-design-engineering",
      "uw-bothell-computer-engineering",
      "uw-bothell-nursing-rn-to-bsn",
    ],
    matches: hasSupportOnlyDriftEvidence,
  },
  {
    id: "choose-N underfilling",
    minimumDistinctOwners: 25,
    representativePlanIds: [
      "uw-seattle-computer-engineering",
      "uw-bothell-applied-computing",
      "uw-seattle-landscape-architecture",
      "uw-tacoma-biomedical-sciences",
    ],
    matches: hasChooseNUnderfillingEvidence,
  },
];

for (const family of RISK_FAMILY_EXPECTATIONS) {
  test(`official-source diagnostics include owner evidence for ${family.id}`, () => {
    const coveredPlanIds = uniqueSorted(
      programs.filter(family.matches).map((program) => program.planId)
    );
    const missingRepresentativePlanIds = family.representativePlanIds.filter(
      (planId) => !coveredPlanIds.includes(planId)
    );

    assert.equal(
      coveredPlanIds.length >= family.minimumDistinctOwners,
      true,
      [
        `${family.id} should have broad owner-level diagnostic coverage.`,
        `Expected at least ${family.minimumDistinctOwners} owners; found ${coveredPlanIds.length}.`,
        `First owners: ${coveredPlanIds.slice(0, 40).join(", ")}`,
      ].join("\n")
    );
    assert.deepEqual(
      missingRepresentativePlanIds,
      [],
      [
        `${family.id} should keep named representative owners in the diagnostic fixture set.`,
        `Missing representatives: ${missingRepresentativePlanIds.join(", ")}`,
      ].join("\n")
    );
  });
}
