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

const source = require("../../constants/transfer-planner-source");
const studentRuntime = require("../../constants/transfer-planner-source/student-runtime");
const {
  TRANSFER_PLANNER_UW_GRC_ALL_EQUIVALENCY_RULES,
} = require("../../constants/transfer-planner-source/equivalency-guide.generated");
const planner = require("../../services/planning/transfer-planner.service");

const REFERENCE_DATE = new Date("2026-05-06T12:00:00.000Z");

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function normalizeCourseCode(value) {
  return planner.normalizeCourseCode(String(value ?? ""));
}

function normalizeCourseCodes(values) {
  return uniqueSorted(values.map((value) => normalizeCourseCode(value)).filter(Boolean));
}

function getAllChecklistItems(plan) {
  return [
    ...(plan?.applicationChecklist ?? []),
    ...(plan?.beforeEnrollmentChecklist ?? []),
    ...(plan?.stayAtGrcChecklist ?? []),
  ];
}

function getRequiredRuntimePlan(planId, pathwayId = null) {
  const basePlan = studentRuntime.getTransferPlannerMajorPlan(planId);
  assert.ok(basePlan, `Expected runtime plan ${planId}.`);
  const resolvedPlan = studentRuntime.resolveTransferPlannerStudentRuntimeMajorPlan(
    basePlan,
    pathwayId
  );
  assert.ok(
    resolvedPlan,
    `Expected resolved runtime plan ${planId}${pathwayId ? ` / ${pathwayId}` : ""}.`
  );
  return resolvedPlan;
}

function findChecklistItem(plan, titlePattern) {
  const item = getAllChecklistItems(plan).find((candidate) =>
    titlePattern.test(candidate.title ?? "")
  );
  assert.ok(item, `Expected checklist item matching ${titlePattern}.`);
  return item;
}

function buildTransferOnlyScheduledLabels(plan) {
  return planner
    .buildSuggestedQuarterPlan({
      plan,
      applicationStatuses: planner.buildRequirementStatuses(plan.applicationChecklist ?? [], []),
      beforeEnrollmentStatuses: planner.buildRequirementStatuses(
        plan.beforeEnrollmentChecklist ?? [],
        []
      ),
      stayAtGrcStatuses: planner.buildRequirementStatuses(plan.stayAtGrcChecklist ?? [], []),
      completedCourses: [],
      track: studentRuntime.getTransferPlannerTrack(plan.bestTrackId ?? null),
      plannerCollegeId: "uw",
      includeStayAtGrcCourses: false,
      includeStemPrepCourses: false,
      includeSummerQuarter: false,
      referenceDate: REFERENCE_DATE,
    })
    .filter((quarter) => quarter.phase === "planned" || quarter.phase === "current")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
}

function getActiveOfficialGuideMappingsForUwTarget(uwTargetCourseCode) {
  const normalizedTarget = normalizeCourseCode(uwTargetCourseCode);
  return TRANSFER_PLANNER_UW_GRC_ALL_EQUIVALENCY_RULES.filter((rule) => {
    if (rule.sourceSchoolId !== "grc") return false;
    if (rule.ruleStatus !== "active") return false;
    if (rule.isObsoleteSourceCourse === true) return false;
    if (rule.acceptanceCategory === "legacy-accepted") return false;
    return (rule.targetCourseCodes ?? [])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .includes(normalizedTarget);
  }).map((rule) => ({
    ruleId: rule.id,
    ruleType: rule.type,
    sourceCourseSets: (rule.sourceCourseSets ?? []).map((courseSet) =>
      normalizeCourseCodes(courseSet)
    ),
    targetCourseCodes: normalizeCourseCodes(rule.targetCourseCodes ?? []),
    targetOutcome: rule.targetOutcome,
    officialRows: (rule.notes ?? []).filter((note) => /^Official /i.test(note)),
  }));
}

function getMappedGrcCoursesForUwTarget(uwTargetCourseCode) {
  return uniqueSorted(
    getActiveOfficialGuideMappingsForUwTarget(uwTargetCourseCode).flatMap((mapping) =>
      mapping.sourceCourseSets.flat()
    )
  );
}

function getRequirementGroupOptionSummary(item) {
  return (item.requirementGroup?.options ?? []).map((option) => ({
    id: option.id ?? null,
    label: option.label ?? null,
    uwCourses: normalizeCourseCodes(option.uwCourses ?? []),
    grcMatches: normalizeCourseCodes(option.grcMatches ?? []),
  }));
}

function buildMismatchReport(input) {
  return JSON.stringify(input, null, 2);
}

for (const pathwayId of ["advanced-data-science-option", "data-science-option"]) {
  test(`UW-GRC diagnostic mismatch: Atmospheric & Climate Science ${pathwayId} omits the active CSE 123 path`, () => {
    const plan = getRequiredRuntimePlan(
      "uw-seattle-atmospheric-and-climate-science",
      pathwayId
    );
    const item = findChecklistItem(plan, /CSE 123.*CSE 143.*CSE 163/i);
    const optionUwCourses = normalizeCourseCodes(
      (item.requirementGroup?.options ?? []).flatMap((option) => option.uwCourses ?? [])
    );
    const optionGrcMatches = normalizeCourseCodes(
      (item.requirementGroup?.options ?? []).flatMap((option) => option.grcMatches ?? [])
    );
    const scheduledLabels = buildTransferOnlyScheduledLabels(plan);
    const scheduledCourseCodes = normalizeCourseCodes(
      scheduledLabels.flatMap((label) => planner.extractCourseCodes(label))
    );
    const officialGuideMappings = getActiveOfficialGuideMappingsForUwTarget("CSE 123");
    const expectedCse123GrcPath = getMappedGrcCoursesForUwTarget("CSE 123");
    const report = {
      planId: plan.id,
      pathwayId,
      officialUwRequirementCodes: ["CSE 123", "CSE 143", "CSE 163"],
      officialGrcEquivalencyGuideMapping: officialGuideMappings,
      generatedRequirementOptions: getRequirementGroupOptionSummary(item),
      generatedOptionUwCourses: optionUwCourses,
      generatedOptionGrcMatches: optionGrcMatches,
      runtimeScheduledGrcCourses: scheduledCourseCodes,
      sourceBackedCoverageIssue:
        "The source-backed option title contains CSE 123, but generated options omit it and default to the CSE 143 / CS 145 legacy path.",
    };

    assert.deepEqual(
      optionUwCourses,
      ["CSE 123", "CSE 143", "CSE 163"],
      buildMismatchReport(report)
    );
    assert.ok(
      expectedCse123GrcPath.some((courseCode) => scheduledCourseCodes.includes(courseCode)),
      buildMismatchReport(report)
    );
  });
}

for (const planId of [
  "uw-seattle-environmental-design-and-sustainability",
  "uw-seattle-landscape-architecture",
]) {
  test(`UW-GRC diagnostic mismatch: ${planId} omits the active ESS 301 / GEOL& 208 option`, () => {
    const plan = getRequiredRuntimePlan(planId, "project-option");
    const item = findChecklistItem(plan, /Geology \(5 credits\).*ESS 301/i);
    const optionUwCourses = normalizeCourseCodes(
      (item.requirementGroup?.options ?? []).flatMap((option) => option.uwCourses ?? [])
    );
    const optionGrcMatches = normalizeCourseCodes(
      (item.requirementGroup?.options ?? []).flatMap((option) => option.grcMatches ?? [])
    );
    const scheduledLabels = buildTransferOnlyScheduledLabels(plan);
    const scheduledCourseCodes = normalizeCourseCodes(
      scheduledLabels.flatMap((label) => planner.extractCourseCodes(label))
    );
    const officialGuideMappings = getActiveOfficialGuideMappingsForUwTarget("ESS 301");
    const expectedEss301GrcPath = getMappedGrcCoursesForUwTarget("ESS 301");
    const report = {
      planId,
      pathwayId: "project-option",
      officialUwRequirementCodes: ["ESS 301", "ESS 305", "ESS 315", "ENVIR 313"],
      officialGrcEquivalencyGuideMapping: officialGuideMappings,
      generatedRequirementOptions: getRequirementGroupOptionSummary(item),
      generatedOptionUwCourses: optionUwCourses,
      generatedOptionGrcMatches: optionGrcMatches,
      runtimeScheduledGrcCourses: scheduledCourseCodes,
      sourceBackedCoverageIssue:
        "The source-backed option title contains ESS 301, but generated options omit it and default to ESS 305 / GEOL 200.",
    };

    assert.deepEqual(
      optionUwCourses,
      ["ENVIR 313", "ESS 301", "ESS 305", "ESS 315"],
      buildMismatchReport(report)
    );
    assert.ok(
      expectedEss301GrcPath.some((courseCode) => scheduledCourseCodes.includes(courseCode)),
      buildMismatchReport(report)
    );
  });
}

test("UW-GRC source-backed diagnostic: Seattle Computer Engineering preserves the EE 205 / EE 215 source option", () => {
  const plan = getRequiredRuntimePlan("uw-seattle-computer-engineering");
  const parsedBlocks = source.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-computer-engineering",
    null
  );
  const parsedCodes = normalizeCourseCodes(
    parsedBlocks.flatMap((block) => block.parsedUwCourseCodes ?? [])
  );
  const sourceCueLines = parsedBlocks.flatMap((block) =>
    (block.requirementCueLines ?? []).filter((line) => /EE 205|EE 215/i.test(line))
  );
  const eeItem = findChecklistItem(plan, /EE 205.*EE 215/i);
  const runtimeCourseList = studentRuntime.getTransferPlannerGrcCourseList(plan);
  const report = {
    planId: plan.id,
    officialUwRequirementCodes: ["EE 205", "EE 215"],
    officialGrcEquivalencyGuideMapping: {
      "EE 205": getActiveOfficialGuideMappingsForUwTarget("EE 205"),
      "EE 215": getActiveOfficialGuideMappingsForUwTarget("EE 215"),
    },
    parsedSourceCodes: parsedCodes.filter((courseCode) => /^(?:EE 205|EE 215)$/.test(courseCode)),
    parsedSourceCueLines: sourceCueLines,
    generatedRuntimeItem: {
      title: eeItem.title,
      grcCourses: normalizeCourseCodes(eeItem.grcCourses ?? []),
      requirementGroup: eeItem.requirementGroup
        ? getRequirementGroupOptionSummary(eeItem)
        : null,
    },
    runtimeScheduledGrcCourses: normalizeCourseCodes(runtimeCourseList),
    sourceBackedCoverageIssue:
      "The official degree sheet exposes EE 205 or EE 215; runtime should keep EE 205 as a UW-only option and default to the mapped EE 215 / ENGR& 204 branch.",
  };

  assert.ok(parsedCodes.includes("EE 205"), buildMismatchReport(report));
  assert.ok(parsedCodes.includes("EE 215"), buildMismatchReport(report));
  assert.ok(
    getAllChecklistItems(plan).some(
      (item) =>
        /EE 205/i.test(item.title ?? "") &&
        /EE 215/i.test(item.title ?? "") &&
        item.requirementGroup?.requirementType === "choose_one"
    ),
    buildMismatchReport(report)
  );
  assert.deepEqual(
    eeItem.requirementGroup.options.find((option) => option.uwCourses.includes("EE 205"))?.grcMatches,
    [],
    buildMismatchReport(report)
  );
  assert.deepEqual(
    eeItem.requirementGroup.options.find((option) => option.uwCourses.includes("EE 215"))?.grcMatches,
    ["ENGR& 204"],
    buildMismatchReport(report)
  );
});

test("UW-GRC source-backed diagnostic: Seattle Mathematics turns an excluded/elective MATH 300 line into schedulable upper-division rows", () => {
  const plan = getRequiredRuntimePlan("uw-seattle-mathematics");
  const suspectItems = getAllChecklistItems(plan).filter((item) =>
    /Major Option Electives exclude MATH 300/i.test(item.title ?? "")
  );
  const scheduledLabels = buildTransferOnlyScheduledLabels(plan);
  const report = {
    planId: plan.id,
    officialUwRequirementCodesMentionedBySourceText: ["MATH 300"],
    officialGrcEquivalencyGuideMapping: getActiveOfficialGuideMappingsForUwTarget("MATH 300"),
    generatedRuntimeItems: suspectItems.map((item) => ({
      title: item.title,
      grcCourses: normalizeCourseCodes(item.grcCourses ?? []),
      requirementType: item.requirementGroup?.requirementType ?? null,
      options: getRequirementGroupOptionSummary(item),
      sourceRole: item.sourceRole ?? null,
      sourceScope: item.sourceScope ?? null,
      sourceUrl: item.sourceUrl ?? null,
    })),
    runtimeScheduledGrcCourses: normalizeCourseCodes(
      scheduledLabels.flatMap((label) => planner.extractCourseCodes(label))
    ),
    sourceBackedCoverageIssue:
      "The source wording excludes MATH 300 and describes major-option electives, but generated runtime creates schedulable upper-division option rows instead of treating the section as non-schedulable/support-only.",
  };

  assert.deepEqual(suspectItems, [], buildMismatchReport(report));
});

test("UW-GRC diagnostic controls: current high-risk active STEM mappings remain guide-backed", () => {
  const controls = [
    ["CHEM 142", ["CHEM& 161"]],
    ["CHEM 152", ["CHEM& 162", "CHEM& 163"]],
    ["PHYS 121", ["PHYS& 221"]],
    ["PHYS 122", ["PHYS& 222"]],
    ["PHYS 123", ["PHYS& 223"]],
    ["BIOL 180", ["BIOL& 211", "BIOL& 212", "BIOL& 213"]],
    ["MATH 124", ["MATH& 151"]],
    ["MATH 125", ["MATH& 152"]],
    ["MATH 126", ["MATH& 163"]],
    ["MATH 207", ["MATH 238"]],
    ["MATH 208", ["MATH 240"]],
    ["CSE 143", ["CS 145"]],
    ["EE 215", ["ENGR& 204"]],
  ];

  const report = controls.map(([uwTarget, expectedGrcCourses]) => {
    const actualGrcCourses = getMappedGrcCoursesForUwTarget(uwTarget);
    return {
      uwTarget,
      expectedGrcCourses,
      actualGrcCourses,
      guideMappings: getActiveOfficialGuideMappingsForUwTarget(uwTarget),
    };
  });

  for (const [uwTarget, expectedGrcCourses] of controls) {
    const actualGrcCourses = getMappedGrcCoursesForUwTarget(uwTarget);
    for (const expectedGrcCourse of expectedGrcCourses) {
      assert.ok(
        actualGrcCourses.includes(expectedGrcCourse),
        buildMismatchReport({ uwTarget, expectedGrcCourse, report })
      );
    }
  }
});
