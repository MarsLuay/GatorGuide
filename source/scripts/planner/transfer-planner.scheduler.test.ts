import {
  assert,
  auditCompoundEquivalencyPaths,
  auditCompoundSequenceOptionScheduling,
  auditCountedCourses,
  auditInvalidScheduledOptions,
  auditOptionAllocation,
  auditOptionCredits,
  auditOptionGroupSatisfaction,
  auditOptionTitleFallback,
  auditRequiredCoverageSequenceSuppression,
  auditRequiredMappedCourseCoverage,
  auditRequirementClassification,
  auditRuntimeCompoundScheduling,
  auditSbseCreditTotals,
  auditSbseCurrentVsOldSource,
  auditSbseScheduledRowSources,
  auditTrueOptionDetection,
  auditUnselectedOptionPrerequisiteScheduling,
  auditUwBioengineeringSourceBackedRequirements,
  auditUwCivilEngineeringLowerDivisionRequirements,
  auditVisibleGrcQuarterPlanScope,
  bioEPlan,
  bioETrack,
  buildAtOrAboveCadrThresholdTranscriptCourses,
  buildBelowCadrThresholdTranscriptCourses,
  buildChecklistItem,
  buildCompletedPhysicsCourses,
  buildPagedGrcCourseDescriptionsUrl,
  buildRequirementStatuses,
  buildRuntimeOptionResolutionTestPlan,
  buildRuntimeSequenceSuggestedPlan,
  buildSeattleMechanicalSuggestedPlanForTest,
  buildSourceBackedGeneralEducationRequirementTargets,
  buildSourceBackedMajorGeneralEducationRequirementSection,
  buildSourceBackedRequiredCourseCodes,
  buildStatuses,
  buildSuggestedQuarterPlan,
  buildSuggestedQuarterRemainingCreditRange,
  buildTranscriptCourses,
  buildTransferPlannerCoursePlanningGraph,
  buildUwGeneralTransferRequirementSection,
  collectVisibleOptionGroupsForTitleAudit,
  compEPlan,
  extractCourseCodes,
  extractCurrentGrcCatalogDetails,
  extractGrcAnnualSchedules,
  extractGrcCatalogArchiveEntries,
  filterRelevantAnnualSchedules,
  findCalcStatus,
  findPhysicsSequenceChoiceItem,
  findPhysicsSequenceOptionId,
  getChecklistCoverageForPlan,
  getPlannedCourseCodeSet,
  getPlannedCourseLabelList,
  getRequiredPlan,
  getRequiredRuntimeSequencePlan,
  getResolvedRuntimeQuarterPlanningState,
  getTransferPlannerCanonicalCourse,
  getTransferPlannerGrcCourseAvailability,
  getTransferPlannerGrcCourseAvailabilitySummary,
  getTransferPlannerGrcCourseList,
  getTransferPlannerMajorsForCampus,
  getTransferPlannerParsedRequirementSourceBlocks,
  getTransferPlannerStudentRuntimeMajorPlan,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  getTransferPlannerTrack,
  getUpcomingCourseLabels,
  normalizeCourseCode,
  resolveTransferPlannerMajorPlan,
  resolveTransferPlannerStudentRuntimeMajorPlan,
  test,
  TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY,
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY,
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS,
} from "./transfer-planner.test-support";
import type {
  TranscriptCourseEntry,
  TransferPlannerChecklistItem,
  TransferPlannerMajorPlan,
} from "./transfer-planner.test-support";

test("Seattle CompE accepts MATH& 163 as the Calc III path without scheduling MATH& 254", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152", "MATH& 163");
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(calcStatus.matched, true);
  assert.deepEqual(calcStatus.explicitCourseCodes, ["MATH& 151", "MATH& 152", "MATH& 163"]);

  const upcomingCourseLabels = getUpcomingCourseLabels(completedCourses);
  assert.equal(upcomingCourseLabels.includes("MATH& 254"), false);
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), false);
});

test("Planner keeps chained series courses in different quarters instead of stacking them together", () => {
  const sequencePlan: TransferPlannerMajorPlan = {
    id: "test-physics-sequence-plan",
    campusId: "uw-seattle",
    title: "Test Physics Sequence",
    shortTitle: "Test Physics Sequence",
    coverage: "detailed",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [
      buildChecklistItem("phys122", "PHYS 122", ["PHYS& 222"]),
    ],
    stayAtGrcChecklist: [
      buildChecklistItem("phys123", "PHYS 123", ["PHYS& 223"]),
    ],
    advisorFlags: [],
    officialLinks: [],
  };
  const completedCourses = buildTranscriptCourses("PHYS& 221");
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: sequencePlan,
    ...buildStatuses(sequencePlan, completedCourses),
    completedCourses,
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedQuarters = quarterPlan.filter((quarter) => quarter.phase === "planned");
  const phys222QuarterIndex = plannedQuarters.findIndex((quarter) =>
    quarter.courses.some((course) => course.label === "PHYS& 222")
  );
  const phys223QuarterIndex = plannedQuarters.findIndex((quarter) =>
    quarter.courses.some((course) => course.label === "PHYS& 223")
  );

  assert.notEqual(phys222QuarterIndex, -1, "Expected PHYS& 222 to be scheduled.");
  assert.notEqual(phys223QuarterIndex, -1, "Expected PHYS& 223 to be scheduled.");
  assert.equal(
    phys222QuarterIndex < phys223QuarterIndex,
    true,
    "Expected PHYS& 223 to land in a later quarter than PHYS& 222."
  );
});

test("Prompt 2 upstream recovery follows same-program curriculum and prerequisite links safely", () => {
  const bbaParsedBlocks = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-business-administration",
    null
  );
  const economicsParsedBlocks = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-economics",
    null
  );
  const bbaCourseCodes = new Set(bbaParsedBlocks.flatMap((entry) => entry.parsedUwCourseCodes));
  const economicsCourseCodes = new Set(
    economicsParsedBlocks.flatMap((entry) => entry.parsedUwCourseCodes)
  );

  assert.ok(
    bbaCourseCodes.has("BBUS 210") && bbaCourseCodes.has("BBUS 220"),
    "Expected Bothell BBA to recover official prerequisite course evidence from same-program linked pages."
  );
  assert.ok(
    economicsCourseCodes.has("BBECN 302") && economicsCourseCodes.has("BBUS 220"),
    "Expected Bothell Economics to recover official curriculum course evidence from its same-program curriculum link."
  );
});

test("Degree-needed guidance stays visible when prerequisite support is not yet actionable in fallback planning", () => {
  const beforeEnrollmentStatuses = buildRequirementStatuses(
    [
      buildChecklistItem(
        "phys121",
        "PHYS 121",
        ["PHYS& 221"],
        "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way."
      ),
      buildChecklistItem("phys122", "PHYS 122", ["PHYS& 222"]),
    ],
    []
  );

  const plannedCourses = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses,
    stayAtGrcStatuses: [],
    completedCourses: [],
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);

  const phys221Course = plannedCourses.find((course) => course.label === "PHYS& 221");

  assert.ok(phys221Course, "Expected fallback planning to include PHYS& 221.");
  assert.equal(
    phys221Course?.guidanceSummary,
    "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way."
  );
});

test.skip("Bothell and Tacoma campuses also include automatic prerequisite plus transfer guidance", () => {
  const fixtures: {
    campusId: TransferPlannerMajorPlan["campusId"];
    campusLabel: string;
  }[] = [
    { campusId: "uw-bothell", campusLabel: "Bothell" },
    { campusId: "uw-tacoma", campusLabel: "Tacoma" },
  ];

  for (const fixture of fixtures) {
    const plan: TransferPlannerMajorPlan = {
      id: `test-physics-transfer-guidance-${fixture.campusId}`,
      campusId: fixture.campusId,
      title: `Test ${fixture.campusLabel} Physics Transfer Guidance`,
      shortTitle: `Test ${fixture.campusLabel} Physics Transfer Guidance`,
      coverage: "detailed",
      summary: "",
      bestTrackId: null,
      recommendedTrackSummary: "",
      whyThisTrack: [],
      applicationChecklist: [],
      beforeEnrollmentChecklist: [
        buildChecklistItem("phys122", "PHYS 122", ["PHYS& 222"]),
        buildChecklistItem("phys123", "PHYS 123", ["PHYS& 223"]),
      ],
      stayAtGrcChecklist: [],
      advisorFlags: [],
      officialLinks: [],
    };

    const completedCourses = buildTranscriptCourses("PHYS& 221");
    const plannedCourses = buildSuggestedQuarterPlan({
      plan,
      ...buildStatuses(plan, completedCourses),
      completedCourses,
      track: null,
      includeStayAtGrcCourses: true,
      referenceDate: new Date("2026-01-15T12:00:00.000Z"),
    }).flatMap((quarter) => quarter.courses);

    const phys222Course = plannedCourses.find((course) => course.label === "PHYS& 222");

    assert.ok(phys222Course, `Expected PHYS& 222 to be planned for ${fixture.campusLabel}.`);
    assert.match(
      phys222Course?.guidanceSummary ?? "",
      /^Prerequisite for PHYS& 223\. Transfers into /i,
      `Expected prerequisite + transfer guidance for ${fixture.campusLabel}.`
    );
  }
});

test("Runtime compound sequence scheduling defaults Biology EEC physics to one calculus path", () => {
  const plan = getRequiredRuntimeSequencePlan(
    "uw-seattle-biology",
    "bs-option-family:ecology-evolution-and-conservation"
  );
  const item = findPhysicsSequenceChoiceItem(plan);
  const suggestedPlan = buildRuntimeSequenceSuggestedPlan(plan);
  const plannedLabels = getPlannedCourseLabelList(suggestedPlan);
  const plannedCodes = getPlannedCourseCodeSet(suggestedPlan);
  const physicsLabels = plannedLabels.filter((label) => /^PHYS/.test(label));
  const compoundAudit = auditCompoundSequenceOptionScheduling({
    plan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => row.parentGroupRow === (item.requirementGroup?.label || item.title));
  const runtimeCompoundAudit = auditRuntimeCompoundScheduling({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  }).find(
    (row) =>
      row.selectedOption &&
      row.grcCompoundPath.includes("PHYS& 221") &&
      row.grcCompoundPath.includes("PHYS& 222")
  );
  const suppressionRows = auditRequiredCoverageSequenceSuppression({
    plan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  }).filter((row) => row.parentChooseOneGroup === (item.requirementGroup?.label || item.title));

  assert.equal(item.requirementGroup?.requirementType, "sequence_choice");
  assert.deepEqual(physicsLabels, ["PHYS& 221", "PHYS& 222"]);
  assert.equal(plannedCodes.has("PHYS& 154"), false);
  assert.equal(plannedCodes.has("PHYS& 155"), false);
  assert.equal(plannedCodes.has("PHYS& 114"), false);
  assert.equal(plannedCodes.has("PHYS& 115"), false);
  assert.equal(plannedCodes.has("PHYS 121"), false);
  assert.equal(plannedCodes.has("PHYS 122"), false);
  assert.equal(compoundAudit?.detectedChooseOneCompoundSequence, true);
  assert.equal(compoundAudit?.issue, "none");
  assert.equal(runtimeCompoundAudit?.issue, "none");
  assert.equal(runtimeCompoundAudit?.satisfied, true);
  assert.deepEqual(runtimeCompoundAudit?.missingComponents, []);
  assert.equal(suppressionRows.every((row) => row.issue === "none"), true);
  assert.match(compoundAudit?.copyOnlyDebugText ?? "", /^\[runtime compound sequence audit\]/);
});

test("Runtime compound sequence scheduling defaults Biochemistry BA physics to one calculus path", () => {
  const plan = getRequiredRuntimeSequencePlan("uw-seattle-biochemistry", "ba-route");
  const item = findPhysicsSequenceChoiceItem(plan);
  const suggestedPlan = buildRuntimeSequenceSuggestedPlan(plan);
  const plannedLabels = getPlannedCourseLabelList(suggestedPlan);
  const plannedCodes = getPlannedCourseCodeSet(suggestedPlan);
  const physicsLabels = plannedLabels.filter((label) => /^PHYS/.test(label));
  const compoundAudit = auditCompoundSequenceOptionScheduling({
    plan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => row.parentGroupRow === (item.requirementGroup?.label || item.title));

  assert.equal(item.requirementGroup?.requirementType, "sequence_choice");
  assert.deepEqual(physicsLabels, ["PHYS& 221", "PHYS& 222", "PHYS& 223"]);
  assert.equal(plannedCodes.has("PHYS& 154"), false);
  assert.equal(plannedCodes.has("PHYS& 155"), false);
  assert.equal(plannedCodes.has("PHYS 121"), false);
  assert.equal(plannedCodes.has("PHYS 122"), false);
  assert.equal(plannedCodes.has("PHYS 123"), false);
  assert.equal(compoundAudit?.issue, "none");
});

test("Runtime compound sequence scheduling defaults Chemistry BA physics to one calculus path", () => {
  const plan = getRequiredRuntimeSequencePlan("uw-seattle-chemistry", "ba-route");
  const item = findPhysicsSequenceChoiceItem(plan);
  const suggestedPlan = buildRuntimeSequenceSuggestedPlan(plan);
  const plannedLabels = getPlannedCourseLabelList(suggestedPlan);
  const plannedCodes = getPlannedCourseCodeSet(suggestedPlan);
  const physicsLabels = plannedLabels.filter((label) => /^PHYS/.test(label));
  const compoundAudit = auditCompoundSequenceOptionScheduling({
    plan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => row.parentGroupRow === (item.requirementGroup?.label || item.title));

  assert.equal(item.requirementGroup?.requirementType, "sequence_choice");
  assert.deepEqual(physicsLabels, ["PHYS& 221", "PHYS& 222", "PHYS& 223"]);
  assert.equal(plannedCodes.has("PHYS& 154"), false);
  assert.equal(plannedCodes.has("PHYS& 155"), false);
  assert.equal(plannedCodes.has("PHYS 121"), false);
  assert.equal(plannedCodes.has("PHYS 122"), false);
  assert.equal(plannedCodes.has("PHYS 123"), false);
  assert.equal(compoundAudit?.issue, "none");
});

test("Runtime compound sequence scheduling honors an algebra-based path selection atomically", () => {
  const plan = getRequiredRuntimeSequencePlan("uw-seattle-biochemistry", "ba-route");
  const item = findPhysicsSequenceChoiceItem(plan);
  const groupId = item.requirementGroup?.id ?? "";
  const algebraOptionId = findPhysicsSequenceOptionId(item, /algebra/i);
  const selectedRequirementOptionIdsByGroup = {
    [groupId]: [algebraOptionId],
  };
  const suggestedPlan = buildRuntimeSequenceSuggestedPlan(
    plan,
    [],
    selectedRequirementOptionIdsByGroup
  );
  const plannedLabels = getPlannedCourseLabelList(suggestedPlan);
  const plannedCodes = getPlannedCourseCodeSet(suggestedPlan);
  const compoundAudit = auditCompoundSequenceOptionScheduling({
    plan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup,
  }).find((row) => row.parentGroupRow === (item.requirementGroup?.label || item.title));

  assert.equal(plannedLabels.includes("PHYS& 114 + PHYS& 154"), true);
  assert.equal(plannedLabels.includes("PHYS& 115 + PHYS& 155"), true);
  assert.equal(plannedLabels.includes("PHYS& 116 + PHYS& 156"), true);
  assert.equal(plannedLabels.includes("PHYS& 154"), false);
  assert.equal(plannedLabels.includes("PHYS& 155"), false);
  assert.equal(plannedCodes.has("PHYS& 221"), false);
  assert.equal(plannedCodes.has("PHYS& 222"), false);
  assert.equal(plannedCodes.has("PHYS& 223"), false);
  assert.equal(compoundAudit?.phys154Scheduled, true);
  assert.equal(compoundAudit?.phys155Scheduled, true);
  assert.equal(compoundAudit?.issue, "none");
});

test("Runtime compound sequence scheduling suppresses algebra siblings after completed calculus path", () => {
  const plan = getRequiredRuntimeSequencePlan("uw-seattle-biochemistry", "ba-route");
  const item = findPhysicsSequenceChoiceItem(plan);
  const completedCourses = buildCompletedPhysicsCourses([
    "PHYS& 221",
    "PHYS& 222",
    "PHYS& 223",
  ]);
  const suggestedPlan = buildRuntimeSequenceSuggestedPlan(plan, completedCourses);
  const plannedCodes = getPlannedCourseCodeSet(suggestedPlan);
  const compoundAudit = auditCompoundSequenceOptionScheduling({
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => row.parentGroupRow === (item.requirementGroup?.label || item.title));

  assert.equal(plannedCodes.has("PHYS& 154"), false);
  assert.equal(plannedCodes.has("PHYS& 155"), false);
  assert.equal(plannedCodes.has("PHYS& 114"), false);
  assert.equal(plannedCodes.has("PHYS& 115"), false);
  assert.equal(compoundAudit?.issue, "none");
});

test("Runtime compound sequence scheduling continues a partial algebra path without mixing calculus", () => {
  const plan = getRequiredRuntimeSequencePlan("uw-seattle-biochemistry", "ba-route");
  const item = findPhysicsSequenceChoiceItem(plan);
  const completedCourses = buildCompletedPhysicsCourses(["PHYS& 114"]);
  const suggestedPlan = buildRuntimeSequenceSuggestedPlan(plan, completedCourses);
  const plannedLabels = getPlannedCourseLabelList(suggestedPlan);
  const plannedCodes = getPlannedCourseCodeSet(suggestedPlan);
  const compoundAudit = auditCompoundSequenceOptionScheduling({
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => row.parentGroupRow === (item.requirementGroup?.label || item.title));
  const suppressionRows = auditRequiredCoverageSequenceSuppression({
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).filter((row) => row.parentChooseOneGroup === (item.requirementGroup?.label || item.title));

  assert.equal(plannedLabels.includes("PHYS& 114 + PHYS& 154"), true);
  assert.equal(plannedLabels.includes("PHYS& 115 + PHYS& 155"), true);
  assert.equal(plannedLabels.includes("PHYS& 116 + PHYS& 156"), true);
  assert.equal(plannedLabels.includes("PHYS& 154"), false);
  assert.equal(plannedLabels.includes("PHYS& 155"), false);
  assert.equal(plannedCodes.has("PHYS& 221"), false);
  assert.equal(plannedCodes.has("PHYS& 222"), false);
  assert.equal(plannedCodes.has("PHYS& 223"), false);
  assert.equal(compoundAudit?.issue, "none");
  assert.equal(suppressionRows.every((row) => row.issue === "none"), true);
});

test("Runtime compound scheduling keeps selected organic chemistry paths atomic", () => {
  const groupId = "test-runtime-compound:requirement-group:organic-chemistry";
  const item: TransferPlannerChecklistItem = {
    id: "organic-chemistry",
    title: "Organic chemistry sequence",
    grcCourses: ["CHEM& 261", "CHEM& 262", "CHEM& 263"],
    minCompletedCount: 3,
    selectedRequirementOptionIds: [`${groupId}:chem-242`],
    scheduleSelectedRequirementOptions: true,
    requirementGroup: {
      id: groupId,
      label: "Organic chemistry sequence",
      category: "source-choice",
      requirementType: "choose_one",
      minCourses: 1,
      maxCourses: 1,
      selectionCount: 1,
      options: [
        {
          id: `${groupId}:chem-242`,
          uwCourses: ["CHEM 242"],
          grcMatches: ["CHEM& 261", "CHEM& 262", "CHEM& 263"],
          credits: 15,
          label: "CHEM 242 / CHEM& 261 + CHEM& 262 + CHEM& 263",
        },
      ],
    },
  };
  const plan = buildRuntimeOptionResolutionTestPlan(item, "test-runtime-compound");
  const completedCourses = [{ code: "CHEM& 261", label: "CHEM& 261", credits: 5 }];
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan,
    ...buildStatuses(plan, completedCourses),
    completedCourses,
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedLabels = getPlannedCourseLabelList(suggestedPlan);
  const compoundAudit = auditRuntimeCompoundScheduling({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((entry) => entry.uwTarget === "CHEM 242");

  assert.equal(plannedLabels.includes("CHEM& 262"), true);
  assert.equal(plannedLabels.includes("CHEM& 263"), true);
  assert.deepEqual(compoundAudit?.grcCompoundPath, [
    "CHEM& 261",
    "CHEM& 262",
    "CHEM& 263",
  ]);
  assert.deepEqual(compoundAudit?.scheduledComponents, ["CHEM& 262", "CHEM& 263"]);
  assert.deepEqual(compoundAudit?.missingComponents, []);
  assert.equal(compoundAudit?.satisfied, true);
  assert.equal(compoundAudit?.issue, "none");
});

test("UW-transfer-only planning does not fall back to stay-at-GRC rows or track filler slots", () => {
  const stayAtGrcStatuses = buildRequirementStatuses(
    [buildChecklistItem("cse143", "CSE 143", ["CS 145"])],
    []
  );

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses,
    completedCourses: buildTranscriptCourses("CS 123", "MATH 238", "MATH& 254"),
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });

  const plannedCourseLabels: string[] = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(plannedCourseLabels.length, 0);
  assert.equal(plannedCourseLabels.includes("CS 145"), false);
  assert.equal(plannedCourseLabels.includes("5 credits of Humanities"), false);
  assert.equal(plannedCourseLabels.includes("5 credits of Social Science"), false);
});

test("UW-transfer-only planning keeps required Computer Engineering Areas-of-Inquiry placeholders", () => {
  const plan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(plan, "Expected the Seattle Computer Engineering runtime plan.");
  const track = {
    id: "test-ah-ssc-required-placeholders",
    code: "TEST",
    title: "Test A&H/SSc placeholders",
    summary: "Synthetic placeholder-only track for UW-transfer-only filtering tests.",
    bestFor: ["testing"],
    terms: [
      {
        label: "Year 1 Fall",
        courses: ["Humanities", "Social Science", "Humanities or Social Science"],
      },
    ],
    notes: [],
  };

  const plannedCourses = buildSuggestedQuarterPlan({
    plan,
    ...buildStatuses(plan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  const guidanceSummaries = plannedCourses.map((course) => course.guidanceSummary ?? "");
  const areaOfInquiryPlaceholders = plannedCourses.filter((course) =>
    ["5 credits of Humanities", "5 credits of Social Science", "5 credits of A&H or SSc"].includes(
      course.label
    )
  );

  assert.deepEqual(
    areaOfInquiryPlaceholders.map((course) => course.label),
    [
      "5 credits of Humanities",
      "5 credits of Social Science",
      "5 credits of A&H or SSc",
      "5 credits of Humanities",
      "5 credits of Social Science",
      "5 credits of A&H or SSc",
    ]
  );
  assert.equal(
    guidanceSummaries.some((guidance) => /matched Green River associate pathway/i.test(guidance)),
    false
  );
  assert.ok(
    guidanceSummaries.some((guidance) =>
      /10\/10 A&H credits needed for Computer Engineering\./i.test(
        guidance
      )
    )
  );
  assert.ok(
    guidanceSummaries.some((guidance) =>
      /10\/10 SSc credits needed for Computer Engineering\./i.test(
        guidance
      )
    )
  );
  assert.ok(
    guidanceSummaries.some((guidance) =>
      /10\/10 additional A&H\/SSc credits needed for Computer Engineering\./i.test(
        guidance
      )
    )
  );
});

test("Manual current-course selections move one duplicate Gen-Ed placeholder by instance key", () => {
  const plan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(plan, "Expected the Seattle Computer Engineering runtime plan.");
  const track = {
    id: "test-duplicate-ssc-current-placeholders",
    code: "TEST",
    title: "Test duplicate SSc placeholders",
    summary: "Synthetic placeholder-only track for duplicate current-selection tests.",
    bestFor: ["testing"],
    terms: [
      {
        label: "Year 1 Fall",
        courses: ["Humanities", "Social Science", "Humanities or Social Science"],
      },
    ],
    notes: [],
  };
  const buildPlan = (currentCourseKeys: string[] = []) =>
    buildSuggestedQuarterPlan({
      plan,
      ...buildStatuses(plan, []),
      completedCourses: [],
      track,
      currentCourseKeys,
      includeStayAtGrcCourses: false,
      referenceDate: new Date("2026-01-15T12:00:00.000Z"),
    });

  const baseQuarterPlan = buildPlan();
  const baseSocialSciencePlaceholders = baseQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses)
    .filter((course) => course.label === "5 credits of Social Science");
  const [selectedSocialSciencePlaceholder, remainingSocialSciencePlaceholder] =
    baseSocialSciencePlaceholders;

  assert.equal(baseSocialSciencePlaceholders.length, 2);
  assert.ok(selectedSocialSciencePlaceholder?.instanceKey);
  assert.ok(remainingSocialSciencePlaceholder?.instanceKey);
  assert.notEqual(
    selectedSocialSciencePlaceholder.instanceKey,
    remainingSocialSciencePlaceholder.instanceKey
  );

  const selectedKey = selectedSocialSciencePlaceholder.instanceKey;
  const currentQuarterPlan = buildPlan([selectedKey]);
  const currentSocialSciencePlaceholders = currentQuarterPlan
    .filter((quarter) => quarter.phase === "current")
    .flatMap((quarter) => quarter.courses)
    .filter((course) => course.label === "5 credits of Social Science");
  const futureSocialSciencePlaceholders = currentQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses)
    .filter((course) => course.label === "5 credits of Social Science");

  assert.deepEqual(
    currentSocialSciencePlaceholders.map((course) => ({
      label: course.label,
      status: course.status,
      instanceKey: course.instanceKey,
    })),
    [
      {
        label: "5 credits of Social Science",
        status: "current",
        instanceKey: selectedKey,
      },
    ]
  );
  assert.equal(futureSocialSciencePlaceholders.length, 1);
  assert.equal(
    futureSocialSciencePlaceholders[0]?.instanceKey,
    remainingSocialSciencePlaceholder.instanceKey
  );
});

test.skip("Planner keeps extending future quarters until late elective filler reaches full progress", () => {
  const plan = getRequiredPlan("uw-seattle-computer-science");
  const track = {
    id: "test-crowded-general-education-elective-fillers",
    code: "TEST-CROWDED-ELECTIVES",
    title: "Crowded elective placeholder track",
    summary:
      "Synthetic placeholder track that crowds the third elective filler into a later quarter.",
    bestFor: ["testing"],
    terms: [
      {
        label: "Year 1",
        courses: [
          "Humanities",
          "Humanities",
          "Social Science",
          "Social Science",
          "Humanities or Social Science",
          "Elective or General Education",
          "Elective or General Education",
          "Elective or General Education",
        ],
      },
    ],
    notes: [],
  };

  const plannedQuarters = buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).filter((quarter) => quarter.phase === "planned");
  const electiveCourses = plannedQuarters.flatMap((quarter) =>
    quarter.courses
      .filter((course) => course.label === "5 credits of elective/general education")
      .map((course) => ({ quarterLabel: quarter.label, course }))
  );

  assert.ok(plannedQuarters.length >= 4);
  assert.equal(electiveCourses.length, 3);
  assert.equal(electiveCourses[2]?.quarterLabel, "Spring 2027");
  assert.match(
    electiveCourses[1]?.course.guidanceSummary ?? "",
    /10\/15 elective\/general-education credits needed for Computer Science\./i
  );
  assert.match(
    electiveCourses[2]?.course.guidanceSummary ?? "",
    /15\/15 elective\/general-education credits needed for Computer Science\./i
  );
});

test("Seattle Aeronautics runtime planning uses the authored 24-credit breadth target instead of the generic 40-credit fallback", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    applicationStatuses: buildRequirementStatuses(runtimePlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(runtimePlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const humanitiesPlaceholderEntries = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => course.label === "5 credits of Humanities")
        .map((course) => ({ quarterLabel: quarter.label, course }))
    );
  const socialSciencePlaceholderEntries = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => course.label === "5 credits of Social Science")
        .map((course) => ({ quarterLabel: quarter.label, course }))
    );
  const sharedBreadthPlaceholderEntries = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => course.label === "5 credits of A&H or SSc")
        .map((course) => ({ quarterLabel: quarter.label, course }))
    );
  const sourceBackedHumanitiesPlaceholderEntries = humanitiesPlaceholderEntries.filter((entry) =>
    /needed for Aeronautics & Astronautics/i.test(entry.course.guidanceSummary ?? "")
  );
  const sourceBackedSocialSciencePlaceholderEntries = socialSciencePlaceholderEntries.filter(
    (entry) => /needed for Aeronautics & Astronautics/i.test(entry.course.guidanceSummary ?? "")
  );
  const sourceBackedSharedBreadthPlaceholderEntries = sharedBreadthPlaceholderEntries.filter(
    (entry) => /needed for Aeronautics & Astronautics/i.test(entry.course.guidanceSummary ?? "")
  );

  assert.equal(sourceBackedSharedBreadthPlaceholderEntries.length, 1);
  assert.equal(sourceBackedHumanitiesPlaceholderEntries.length, 2);
  assert.equal(sourceBackedSocialSciencePlaceholderEntries.length, 2);
  assert.match(
    sourceBackedHumanitiesPlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /A&H credits needed for Aeronautics & Astronautics\./i
  );
  assert.match(
    sourceBackedHumanitiesPlaceholderEntries[sourceBackedHumanitiesPlaceholderEntries.length - 1]
      ?.course.guidanceSummary ?? "",
    /A&H credits needed for Aeronautics & Astronautics\./i
  );
  assert.match(
    sourceBackedSocialSciencePlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /SSc credits needed for Aeronautics & Astronautics\./i
  );
  assert.match(
    sourceBackedSocialSciencePlaceholderEntries[
      sourceBackedSocialSciencePlaceholderEntries.length - 1
    ]?.course.guidanceSummary ?? "",
    /10\/10 SSc credits needed for Aeronautics & Astronautics\./i
  );
  assert.doesNotMatch(
    sourceBackedHumanitiesPlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /A&H\/SSc credits needed for Aeronautics & Astronautics\./i
  );
  assert.match(
    sourceBackedSharedBreadthPlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /additional A&H\/SSc credits needed for Aeronautics & Astronautics\./i
  );
  assert.doesNotMatch(
    sourceBackedSocialSciencePlaceholderEntries[0]?.course.guidanceSummary ?? "",
    /40 A&H\/SSc credits needed for Aeronautics & Astronautics\./i
  );
  assert.equal(
    sharedBreadthPlaceholderEntries.some((entry) =>
      /not an official UW transfer admission requirement/i.test(entry.course.guidanceSummary ?? "")
    ),
    false
  );
});

test("Seattle Computer Engineering parsed source blocks and runtime planning no longer leak Allen School recommendation spillover", () => {
  const parsedBlock = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.find(
    (entry) => entry.ownerId === "uw-seattle-computer-engineering"
  );
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");

  assert.ok(parsedBlock, "Expected a parsed requirement source block for Seattle Computer Engineering.");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");

  assert.equal(parsedBlock?.parsedUwCourseCodes.includes("BIOL 180"), false);
  assert.equal(parsedBlock?.parsedUwCourseCodes.includes("CHEM 142"), false);
  assert.equal(parsedBlock?.parsedUwCourseCodes.includes("PHYS 116"), false);
  assert.equal(
    (parsedBlock?.parsedUwCourseCodes ?? []).some((code) => code.startsWith("ASTR ")),
    false
  );
  assert.ok(parsedBlock?.parsedUwCourseCodes.includes("EE 215"));
  assert.ok(parsedBlock?.parsedUwCourseCodes.includes("CSE 311"));

  const runtimeCourseList = getTransferPlannerGrcCourseList(runtimePlan);
  const checklistCoverage = [...getChecklistCoverageForPlan(runtimePlan)];

  assert.equal(
    runtimePlan?.bestTrackId,
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-computer-and-electrical-engineering"
  );
  assert.ok(runtimeCourseList.includes("MATH& 151"));
  assert.ok(runtimeCourseList.includes("MATH& 152"));
  assert.ok(runtimeCourseList.includes("MATH& 163"));
  assert.ok(runtimeCourseList.includes("PHYS& 221"));
  assert.ok(runtimeCourseList.includes("PHYS& 222"));
  assert.ok(runtimeCourseList.includes("MATH 240"));
  assert.ok(runtimeCourseList.includes("ENGR& 204"));
  assert.equal(runtimeCourseList.includes("BIOL& 211"), false);
  assert.equal(runtimeCourseList.includes("CHEM& 161"), false);
  assert.equal(runtimeCourseList.includes("CHEM& 261"), false);
  assert.equal(runtimeCourseList.includes("ENGL 128"), false);
  assert.deepEqual(
    runtimePlan?.applicationChecklist.map((item) => item.title),
    ["Calculus I-III sequence"]
  );
  assert.deepEqual(
    runtimePlan?.beforeEnrollmentChecklist.map((item) => item.title),
    [
      "CSE 123 or CSE 143",
      "10 additional credits approved natural science",
      "3-6 additional Math/Science",
      "PHYS 121",
      "PHYS 122",
      "MATH 208",
      "EE 215",
    ]
  );
  assert.equal(checklistCoverage.length <= runtimeCourseList.length, true);
});

test("Seattle Computer Engineering source-backed required-course summary stays aligned with the quarter planner", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");

  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");

  const requiredCourseCodes = buildSourceBackedRequiredCourseCodes(runtimePlan);
  const applicationStatuses = buildRequirementStatuses(runtimePlan.applicationChecklist, []);
  const beforeEnrollmentStatuses = buildRequirementStatuses(
    runtimePlan.beforeEnrollmentChecklist,
    []
  );
  const stayAtGrcStatuses = buildRequirementStatuses(runtimePlan.stayAtGrcChecklist, []);
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    applicationStatuses,
    beforeEnrollmentStatuses,
    stayAtGrcStatuses,
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId),
    includeStayAtGrcCourses: true,
  });
  const plannedCourseCodes = new Set(
    quarterPlan
      .flatMap((quarter) => quarter.courses)
      .flatMap((course) => extractCourseCodes(course.label))
  );

  for (const courseCode of requiredCourseCodes) {
    assert.equal(
      plannedCourseCodes.has(courseCode),
      true,
      `Expected the suggested quarter plan to include ${courseCode} because it appears in the source-backed required-course summary.`
    );
  }
});

test("Seattle Computer Engineering selected CSE 143 path schedules CS 145 with local prerequisites only", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");
  const cseGroup = runtimePlan.requirementGroups?.find((group) =>
    /cse-123-or-cse-143/.test(group.id)
  );
  const cse143Option = cseGroup?.options.find((option) =>
    (option.uwCourses ?? []).includes("CSE 143")
  );
  assert.ok(cseGroup, "Expected CSE 123/CSE 143 requirement group.");
  assert.ok(cse143Option?.id, "Expected CSE 143 option.");
  const selectedRequirementOptionIdsByGroup = {
    [cseGroup.id]: [cse143Option.id],
  };
  const completedCourses: TranscriptCourseEntry[] = [];
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, completedCourses),
    completedCourses,
    track: getTransferPlannerTrack(runtimePlan.bestTrackId),
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup,
    referenceDate: new Date("2026-05-08T12:00:00.000Z"),
  });
  const plannedCourses = suggestedPlan
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses);
  const plannedLabels = plannedCourses.map((course) => course.label);
  const cs141 = plannedCourses.find((course) => course.label === "CS& 141");
  const programmingAudit = auditTrueOptionDetection({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup,
  }).find((entry) => entry.requirement === "CSE 123 or CSE 143");

  assert.equal(plannedLabels.includes("CS 145"), true);
  assert.equal(plannedLabels.includes("CS& 141"), true);
  assert.equal(plannedLabels.includes("CS 123"), false);
  assert.equal(cs141?.sourceKind, "official-grc-track");
  assert.equal(cs141?.courseRole, "local_grc_prerequisite");
  assert.equal(programmingAudit?.satisfiedBy, "user-selected");
  assert.equal(programmingAudit?.issue, null);
});

test("Manual current-course selections stay per-course while still unlocking future planner sequencing", () => {
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: buildRequirementStatuses(
      [buildChecklistItem("programming-2", "Programming II", ["CS 122"])],
      []
    ),
    beforeEnrollmentStatuses: buildRequirementStatuses(
      [
        buildChecklistItem("programming-1", "Programming I", ["CS 121"]),
        buildChecklistItem("english-comp", "English composition", ["ENGL& 101"]),
      ],
      []
    ),
    stayAtGrcStatuses: [],
    completedCourses: [],
    currentCourseLabels: ["CS 121"],
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-04-23T12:00:00.000Z"),
  });
  const currentQuarter = quarterPlan.find((quarter) => quarter.phase === "current");
  const fall2026Quarter = quarterPlan.find(
    (quarter) => quarter.phase === "planned" && quarter.label === "Fall 2026"
  );

  assert.deepEqual(
    currentQuarter?.courses.map((course) => `${course.label}:${course.status}`),
    ["CS 121:current"]
  );
  assert.deepEqual(
    fall2026Quarter?.courses.map((course) => `${course.label}:${course.status}`),
    ["CS 122:planned", "ENGL& 101:planned"]
  );
});

test("Seattle Computer Engineering manual current CS 121 selection does not rebucket sibling courses", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, []),
    completedCourses: [],
    currentCourseLabels: ["CS 121"],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-04-23T12:00:00.000Z"),
  });
  const currentQuarter = quarterPlan.find((quarter) => quarter.phase === "current");
  const fall2026Quarter = quarterPlan.find(
    (quarter) => quarter.phase === "planned" && quarter.label === "Fall 2026"
  );

  assert.deepEqual(
    currentQuarter?.courses.map((course) => `${course.label}:${course.status}`),
    ["CS 121:current"]
  );
  const fall2026Labels = fall2026Quarter?.courses.map(
    (course) => `${course.label}:${course.status}`
  ) ?? [];
  assert.equal(fall2026Labels.includes("CS 122:planned"), true);
  assert.equal(fall2026Labels.includes("CS 121:planned"), false);
  assert.equal(fall2026Labels.includes("CS 123:planned"), false);
});

test("Seattle Computer Engineering manual current MATH& 141 selection does not rebucket sibling courses", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, []),
    completedCourses: [],
    currentCourseLabels: ["MATH& 141"],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-04-23T12:00:00.000Z"),
  });
  const currentQuarter = quarterPlan.find((quarter) => quarter.phase === "current");
  const fall2026Quarter = quarterPlan.find(
    (quarter) => quarter.phase === "planned" && quarter.label === "Fall 2026"
  );

  assert.deepEqual(
    currentQuarter?.courses.map((course) => `${course.label}:${course.status}`),
    ["MATH& 141:current"]
  );
  const fall2026Labels = fall2026Quarter?.courses.map(
    (course) => `${course.label}:${course.status}`
  ) ?? [];
  assert.equal(fall2026Labels.includes("MATH& 142:planned"), true);
  assert.equal(fall2026Labels.includes("MATH& 141:planned"), false);
  assert.equal(fall2026Labels.includes("CS 121:planned"), true);
});

test("UW-only planning keeps representative source-backed required-course summaries aligned", () => {
  const representativePlanIds = [
    "uw-seattle-aquatic-conservation-and-ecology",
    "uw-seattle-american-ethnic-studies",
    "uw-seattle-computer-engineering",
    "uw-tacoma-computer-engineering",
    "uw-tacoma-education",
    "uw-tacoma-urban-design",
  ];

  for (const planId of representativePlanIds) {
    const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(planId);
    assert.ok(runtimePlan, `Expected runtime plan ${planId}.`);

    const quarterPlan = buildSuggestedQuarterPlan({
      plan: runtimePlan,
      ...buildStatuses(runtimePlan, []),
      completedCourses: [],
      track: getTransferPlannerTrack(runtimePlan.bestTrackId),
      includeStayAtGrcCourses: false,
      referenceDate: new Date("2026-01-15T12:00:00.000Z"),
    });
    const plannedCourseCodes = new Set(
      quarterPlan.flatMap((quarter) =>
        quarter.courses.flatMap((course) => extractCourseCodes(course.label))
      )
    );

    for (const courseCode of buildSourceBackedRequiredCourseCodes(runtimePlan)) {
      assert.equal(
        plannedCourseCodes.has(courseCode),
        true,
        `Expected ${planId} UW-only planning to keep ${courseCode} because it appears in the source-backed required-course summary.`
      );
    }
  }
});

test("UW transfer credit buckets separate optional prep and local prerequisites from main range", () => {
  const unresolvedOptionGroup = {
    id: "test-unresolved-main-option",
    title: "Test unresolved UW-transfer options",
    promptLabel: "Choose one UW-transfer option",
    selectionCount: 1,
    selectedOptionIds: [],
    options: [
      {
        id: "test-option-a",
        label: "Option A",
        selectedLabel: "Option A",
        courseLabels: ["TEST 101"],
        courseCodes: ["TEST 101"],
        creditAmount: 8,
        creditMin: 8,
        creditMax: 8,
      },
      {
        id: "test-option-b",
        label: "Option B",
        selectedLabel: "Option B",
        courseLabels: ["TEST 201", "TEST 202"],
        courseCodes: ["TEST 201", "TEST 202"],
        creditAmount: 18,
        creditMin: 18,
        creditMax: 18,
      },
    ],
    isSelectionPrompt: true,
  };
  const range = buildSuggestedQuarterRemainingCreditRange({
    creditBucketMode: "uw-transfer",
    quarters: [
      {
        label: "Winter 2026",
        phase: "planned",
        courses: [
          {
            label: "MATH& 151",
            type: "core",
            status: "planned",
            creditAmount: 5,
            sourceKind: "uw-major-requirement",
            visibilityScope: "visible-grc-completable",
          },
          {
            label: "Choose one UW-transfer option",
            type: "elective",
            status: "planned",
            creditMin: 0,
            creditMax: 18,
            sourceKind: "uw-major-requirement",
            visibilityScope: "visible-grc-completable",
            optionGroup: unresolvedOptionGroup,
          },
          {
            label: "MATH& 141",
            type: "core",
            status: "planned",
            creditAmount: 5,
            sourceKind: "official-grc-track",
            visibilityScope: "visible-grc-optional-prep",
            courseRole: "optional_stem_prep",
            canTestOut: true,
          },
          {
            label: "LOCAL 099",
            type: "core",
            status: "planned",
            creditAmount: 4,
            sourceKind: "official-grc-track",
            visibilityScope: "visible-grc-prerequisite",
            courseRole: "local_grc_prerequisite",
          },
          {
            label: "UWONLY 101",
            type: "core",
            status: "planned",
            creditAmount: 3,
            sourceKind: "uw-major-requirement",
            visibilityScope: "hidden-uw-only",
            isUwOnlyRequirement: true,
          },
        ],
      },
    ],
  });

  assert.equal(range.mainMinRemainingCredits, 5);
  assert.equal(range.mainMaxRemainingCredits, 23);
  assert.equal(range.minRemainingCredits, 5);
  assert.equal(range.maxRemainingCredits, 23);
  assert.equal(range.stemPrepCredits, 5);
  assert.equal(range.localPrerequisiteCredits, 4);
  assert.equal(range.hiddenUwOnlyCredits, 3);
  assert.equal(range.scheduledMinRemainingCredits, 14);
  assert.equal(range.scheduledMaxRemainingCredits, 32);
  assert.deepEqual(range.unresolvedOptionGroupIds, ["test-unresolved-main-option"]);
});

test("NME local Green River prerequisites are labeled separately from prep and UW requirements", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const plannedCourses = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track: getTransferPlannerTrack(nmePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const engr100 = plannedCourses.find((course) => course.label === "ENGR 100");
  const engr106 = plannedCourses.find((course) => course.label === "ENGR 106");
  const math141 = plannedCourses.find((course) => course.label === "MATH& 141");
  const math151 = plannedCourses.find((course) => course.label === "MATH& 151");
  const range = buildSuggestedQuarterRemainingCreditRange({
    quarters: plannedCourses.length
      ? [{ label: "Planned", phase: "planned", courses: plannedCourses }]
      : [],
    creditBucketMode: "uw-transfer",
  });

  for (const localPrerequisite of [engr100, engr106]) {
    assert.ok(localPrerequisite, "Expected local engineering prerequisite course.");
    assert.equal(localPrerequisite?.courseRole, "local_grc_prerequisite");
    assert.equal(localPrerequisite?.visibilityScope, "visible-grc-prerequisite");
    assert.equal(localPrerequisite?.canTestOut, false);
    assert.match(
      localPrerequisite?.guidanceSummary ?? "",
      /Prerequisite for ENGR(?: 106|& 214)\./
    );
  }
  assert.equal(math141?.courseRole, "optional_stem_prep");
  assert.notEqual(math151?.courseRole, "local_grc_prerequisite");
  assert.ok(range.localPrerequisiteCredits > 0);
});

test("Materials NME planning can skip placement-dependent STEM prep classes", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const track = getTransferPlannerTrack(nmePlan.bestTrackId ?? null);
  const defaultPlannedCourses = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const noPrepPlannedCourses = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    includeStemPrepCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  const defaultLabels = new Set(defaultPlannedCourses.map((course) => course.label));
  const noPrepLabels = new Set(noPrepPlannedCourses.map((course) => course.label));

  assert.ok(defaultLabels.has("MATH& 141"));
  assert.ok(defaultLabels.has("MATH& 142"));
  assert.ok(defaultLabels.has("CHEM& 140"));
  assert.ok(defaultLabels.has("PHYS& 114"));
  assert.equal(
    defaultPlannedCourses.find((course) => course.label === "MATH& 141")?.creditAmount,
    5
  );
  assert.equal(noPrepLabels.has("MATH& 141"), false);
  assert.equal(noPrepLabels.has("MATH& 142"), false);
  assert.equal(noPrepLabels.has("CHEM& 140"), false);
  assert.equal(noPrepLabels.has("PHYS& 114"), false);
  assert.ok(noPrepLabels.has("MATH& 151"));
  assert.ok(noPrepLabels.has("MATH& 152"));
  assert.ok(noPrepLabels.has("MATH& 163"));
  assert.ok(noPrepLabels.has("CHEM& 161"));
  assert.ok(noPrepLabels.has("CHEM& 162"));
  assert.ok(noPrepLabels.has("PHYS& 221"));
  assert.ok(noPrepLabels.has("PHYS& 222"));
  assert.ok(noPrepLabels.has("PHYS& 223"));
  assert.ok(noPrepLabels.has("ENGR 140"));
  assert.equal(noPrepLabels.has("CS 122"), false);
  assert.equal(noPrepLabels.has("BIOL& 211"), false);
  assert.ok(
    noPrepPlannedCourses.some((course) =>
      /Scientific computing/i.test(course.optionGroup?.title ?? "")
    )
  );
  assert.ok(
    noPrepPlannedCourses.some((course) =>
      /Science Electives/i.test(course.optionGroup?.title ?? "")
    )
  );
  assert.deepEqual(
    Array.from(new Set(defaultPlannedCourses.map((course) => course.label)))
      .filter((label) => !noPrepLabels.has(label))
      .sort(),
    ["CHEM& 140", "MATH& 141", "MATH& 142", "PHYS& 114"]
  );
});

test("Classes for UW transfer only mode keeps matched-associate filler behavior separate from the CADR visibility rule", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");
  const belowThresholdSection = buildUwGeneralTransferRequirementSection(runtimePlan, {
    completedCourses: buildBelowCadrThresholdTranscriptCourses(),
    hasTranscriptDerivedCreditSource: true,
  });
  const atOrAboveThresholdSection = buildUwGeneralTransferRequirementSection(runtimePlan, {
    completedCourses: buildAtOrAboveCadrThresholdTranscriptCourses(),
    hasTranscriptDerivedCreditSource: true,
  });

  const transferOnlyQuarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    applicationStatuses: buildRequirementStatuses(runtimePlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(runtimePlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const fullQuarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    applicationStatuses: buildRequirementStatuses(runtimePlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(runtimePlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const transferOnlyPlannedCourses = transferOnlyQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const fullPlannedCourses = fullQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  assert.ok(belowThresholdSection);
  assert.equal(atOrAboveThresholdSection, null);
  assert.equal(
    transferOnlyPlannedCourses.some((course) =>
      /not an official UW transfer admission requirement/i.test(course.guidanceSummary ?? "")
    ),
    false
  );
  assert.ok(
    transferOnlyPlannedCourses.some((course) =>
      /needed for Aeronautics & Astronautics/i.test(
        course.guidanceSummary ?? ""
      )
    )
  );
  assert.ok(transferOnlyPlannedCourses.some((course) => course.label === "PHYS& 114"));
  assert.equal(
    fullPlannedCourses.some((course) =>
      /not an official UW transfer admission requirement/i.test(course.guidanceSummary ?? "")
    ),
    false
  );
  assert.ok(fullPlannedCourses.some((course) => course.label === "PHYS& 114"));
});

test("GRC public-material discovery extracts annual schedules and current catalog details from public pages", () => {
  const schedules = extractGrcAnnualSchedules(`
    <a href="/students/media/documents/schedules-and-catalog/2026-2027%20Annual%20Schedule.pdf">
      2026-2027 Annual Schedule (PDF)
    </a>
    <a href="/students/media/documents/schedules-and-catalog/2025-2026%20Annual%20Schedule%20w%20Cover.pdf">
      2025-2026 Annual Schedule (PDF)
    </a>
  `);
  const catalogEntries = extractGrcCatalogArchiveEntries(`
    <a href="https://catalog.greenriver.edu/">Green River College 2025-2026 Catalog</a>
    <a href="https://catalog.greenriver.edu/index.php?catoid=8">Green River College 2024-2025 Catalog</a>
  `);
  const currentCatalog = extractCurrentGrcCatalogDetails(
    `
      <a href="/content.php?catoid=10&amp;navoid=624">Course Descriptions</a>
    `,
    "https://catalog.greenriver.edu/",
    "2025-2026"
  );

  assert.deepEqual(
    schedules.map((entry: { label: string }) => entry.label),
    ["2025-2026", "2026-2027"]
  );
  assert.equal(
    schedules[1]?.url,
    "https://www.greenriver.edu/students/media/documents/schedules-and-catalog/2026-2027%20Annual%20Schedule.pdf"
  );

  assert.deepEqual(
    catalogEntries.map((entry: { label: string }) => entry.label),
    ["2025-2026", "2024-2025"]
  );
  assert.equal(currentCatalog.courseDescriptionsUrl, "https://catalog.greenriver.edu/content.php?catoid=10&navoid=624");
  assert.equal(
    currentCatalog.courseDescriptionsExpandedUrl,
    "https://catalog.greenriver.edu/content.php?catoid=10&navoid=624&expand=1&print="
  );
  const pagedCatalogUrl = buildPagedGrcCourseDescriptionsUrl(
    currentCatalog.courseDescriptionsExpandedUrl,
    3
  );
  assert.match(pagedCatalogUrl, /catoid=10/);
  assert.match(pagedCatalogUrl, /navoid=624/);
  assert.match(pagedCatalogUrl, /filter%5Bcpage%5D=3/);
  assert.match(pagedCatalogUrl, /expand=1/);
  assert.deepEqual(
    filterRelevantAnnualSchedules(
      [
        { label: "2020-2021" },
        { label: "2024-2025" },
        { label: "2025-2026" },
        { label: "2026-2027" },
      ],
      "2025-2026"
    ).map((entry: { label: string }) => entry.label),
    ["2024-2025", "2025-2026", "2026-2027"]
  );
});

test("Planner-tracked Green River courses now expose annual-schedule availability history", () => {
  const engr250Availability = getTransferPlannerGrcCourseAvailability("ENGR 250");
  const math240Availability = getTransferPlannerGrcCourseAvailability("MATH 240");
  const priorOnlyAvailability = getTransferPlannerGrcCourseAvailability("ENGL& 237");
  const catalogOnlyAvailability = getTransferPlannerGrcCourseAvailability("AMES 150");
  const noSourceEntry = Object.entries(TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY).find(
    ([, entry]) => entry.status === "planner-course-no-current-public-source"
  );
  const noSourceAvailability = noSourceEntry
    ? getTransferPlannerGrcCourseAvailability(noSourceEntry[0])
    : null;

  assert.ok(engr250Availability, "Expected ENGR 250 availability history.");
  assert.equal(engr250Availability.status, "published-in-recent-history-not-latest");
  assert.ok(
    engr250Availability.years.some(
      (year) => year.label === "2024-2025" && year.quarters.join(",") === "winter"
    )
  );
  assert.ok(
    engr250Availability.years.some(
      (year) =>
        year.label === "2025-2026" &&
        year.quarters.includes("summer") &&
        year.quarters.includes("winter")
    )
  );
  assert.ok(
    engr250Availability.years.some(
      (year) => year.label === "2026-2027" && year.quarters.length === 0
    )
  );

  assert.ok(math240Availability, "Expected MATH 240 availability history.");
  assert.equal(math240Availability.status, "published-in-latest-schedule");
  assert.deepEqual(math240Availability.latestPublishedQuarters, [
    "summer",
    "fall",
    "winter",
    "spring",
  ]);
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary("ENGR 250") ?? "",
    /2024-2025: Winter/
  );
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary("ENGR 250") ?? "",
    /2025-2026: Summer, Winter/
  );
  assert.ok(priorOnlyAvailability, "Expected ENGL& 237 availability history.");
  assert.equal(priorOnlyAvailability.status, "published-in-recent-history-not-latest");
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary("ENGL& 237") ?? "",
    /Recent GRC annual schedule history: 2024-2025: Fall, Spring\./
  );
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary("ENGL& 237") ?? "",
    /Not published in the latest 20\d{2}-20\d{2} annual schedule\./
  );

  assert.ok(catalogOnlyAvailability, "Expected AMES 150 availability classification.");
  assert.equal(catalogOnlyAvailability.status, "catalog-listed-not-in-latest-schedules");
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary("AMES 150") ?? "",
    /Listed in the current Green River catalog, but not found/
  );

  assert.ok(noSourceAvailability, "Expected at least one planner-course-no-current-public-source classification.");
  assert.equal(noSourceAvailability.status, "planner-course-no-current-public-source");
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary(noSourceEntry?.[0] ?? "") ?? "",
    /Still referenced by the planner, but not found in the current Green River catalog/
  );

  assert.equal(Object.hasOwn(engr250Availability, "note"), false);
  assert.equal(Object.hasOwn(catalogOnlyAvailability, "note"), false);
});

test.skip("Phase 7 planning graph derives prerequisite paths from source-backed course metadata", () => {
  const graph = buildTransferPlannerCoursePlanningGraph({
    plan: null,
    actionableCourseCodes: ["MATH& 153", "MATH& 163", "MATH& 254", "MATH 238", "MATH 240"],
  });

  assert.ok(
    graph.prerequisiteCourseSetsByCourseCode["MATH& 254"] === undefined ||
      Array.isArray(graph.prerequisiteCourseSetsByCourseCode["MATH& 254"])
  );
  assert.deepEqual(
    graph.prerequisiteCourseSetsByCourseCode["MATH 240"]?.map((path) => path.join(" + ")).sort(),
    ["MATH& 153", "MATH& 163"]
  );
  assert.equal(graph.prerequisiteCourseSetsByCourseCode["MATH 238"], undefined);
  const math238Corequisites = graph.corequisiteCourseSetsByCourseCode["MATH 238"] ?? [];
  assert.ok(
    math238Corequisites.some(
      (path) => path.includes("MATH& 254") || path.includes("MATH& 264")
    )
  );
  assert.equal(graph.sourceCounts.metadataPrerequisiteCourseCount, 2);
  assert.equal(graph.sourceCounts.chainPrerequisiteCourseCount, 0);
  assert.equal(graph.sourceCounts.metadataCorequisiteCourseCount, 1);
});

test("Phase 7 planning graph drops non-actionable corequisites instead of inventing replacement prerequisite paths", () => {
  const graph = buildTransferPlannerCoursePlanningGraph({
    plan: null,
    actionableCourseCodes: ["MATH& 153", "MATH 238"],
  });

  assert.equal(graph.prerequisiteCourseSetsByCourseCode["MATH 238"], undefined);
  assert.equal(graph.corequisiteCourseSetsByCourseCode["MATH 238"], undefined);
});

test.skip("Phase 7 planning graph keeps curated chain rules as a fallback while metadata coverage grows", () => {
  const graph = buildTransferPlannerCoursePlanningGraph({
    plan: {
      ...compEPlan,
    },
    actionableCourseCodes: ["PHYS& 221", "PHYS& 222", "PHYS& 223"],
  });

  assert.deepEqual(graph.prerequisiteCourseSetsByCourseCode["PHYS& 222"], [["PHYS& 221"]]);
  assert.deepEqual(graph.prerequisiteCourseSetsByCourseCode["PHYS& 223"], [["PHYS& 222"]]);
  assert.equal(graph.sourceCounts.metadataPrerequisiteCourseCount, 0);
  assert.equal(graph.sourceCounts.chainPrerequisiteCourseCount, 2);
});

test.skip("Phase 7 planning graph keeps chain fallback targets inside the actionable planner set", () => {
  const graph = buildTransferPlannerCoursePlanningGraph({
    plan: {
      ...compEPlan,
    },
    actionableCourseCodes: ["PHYS& 221", "PHYS& 222"],
  });

  assert.deepEqual(graph.prerequisiteCourseSetsByCourseCode["PHYS& 222"], [["PHYS& 221"]]);
  assert.equal(graph.prerequisiteCourseSetsByCourseCode["PHYS& 223"], undefined);
});

test("Phase 7 quarter planning respects metadata prerequisites even without a hardcoded chain", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152", "MATH& 153");
  const applicationStatuses = buildRequirementStatuses(
    [
      buildChecklistItem("calc4", "Calculus IV", ["MATH& 254"]),
      buildChecklistItem("diffeq", "Differential equations", ["MATH 238"]),
    ],
    completedCourses
  );
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses,
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses,
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedQuarterLabelForCourse = (courseLabel: string) =>
    quarterPlan.find((quarter) =>
      quarter.phase === "planned" &&
      quarter.courses.some((course) => course.label === courseLabel)
    )?.label ?? null;
  const plannedCourses = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const math238Course = plannedCourses.find((course) => course.label === "MATH 238");

  const math254QuarterLabel = plannedQuarterLabelForCourse("MATH& 254");
  assert.ok(math254QuarterLabel === "Fall 2026" || math254QuarterLabel === null);
  const math238QuarterLabel = plannedQuarterLabelForCourse("MATH 238");
  assert.ok(math238QuarterLabel === "Fall 2026" || math238QuarterLabel === null);
  assert.equal(math238Course?.guidanceSummary ?? null, null);
});

test("Phase 7 quarter planning pulls in Statics support courses before scheduling ENGR& 214", () => {
  const completedCourses: TranscriptCourseEntry[] = [];
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: buildRequirementStatuses(
      [buildChecklistItem("statics", "Statics", ["ENGR& 214"])],
      completedCourses
    ),
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: buildRequirementStatuses(
      [
        buildChecklistItem("calc1", "Calculus I", ["MATH& 151"]),
        buildChecklistItem("calc2", "Calculus II", ["MATH& 152"]),
        buildChecklistItem("engr106", "Introduction to Engineering Problems", ["ENGR 106"]),
      ],
      completedCourses
    ),
    completedCourses,
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedQuarters = quarterPlan.filter((quarter) => quarter.phase === "planned");
  const plannedQuarterIndexForCourse = (courseLabel: string) =>
    plannedQuarters.findIndex((quarter) =>
      quarter.courses.some((course) => course.label === courseLabel)
    );

  const math151QuarterIndex = plannedQuarterIndexForCourse("MATH& 151");
  const math152QuarterIndex = plannedQuarterIndexForCourse("MATH& 152");
  const engr106QuarterIndex = plannedQuarterIndexForCourse("ENGR 106");
  const engr214QuarterIndex = plannedQuarterIndexForCourse("ENGR& 214");

  assert.notEqual(math151QuarterIndex, -1);
  assert.notEqual(math152QuarterIndex, -1);
  assert.notEqual(engr106QuarterIndex, -1);
  assert.notEqual(engr214QuarterIndex, -1);
  assert.equal(engr214QuarterIndex > math151QuarterIndex, true);
  assert.equal(engr214QuarterIndex >= math152QuarterIndex, true);
  assert.equal(engr214QuarterIndex >= engr106QuarterIndex, true);
});

test("Phase 7 quarter planning does not schedule a course before a partial alternative path is finished", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152", "MATH& 153");
  const applicationStatuses = buildRequirementStatuses(
    [
      buildChecklistItem("older-calc-diffeq", "Older calculus path", [
        "MATH& 153",
        "MATH& 254",
        "MATH 238",
      ]),
    ],
    completedCourses
  );
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses,
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses,
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedCourseLabels = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  const math254Index = plannedCourseLabels.indexOf("MATH& 254");
  const math238Index = plannedCourseLabels.indexOf("MATH 238");
  assert.ok(math254Index >= -1);
  if (math238Index !== -1) {
    assert.equal(math254Index <= math238Index, true);
  }
});

test("Phase 7 quarter planning accepts a completed alternative prerequisite path", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 254"
  );
  const applicationStatuses = buildRequirementStatuses(
    [
      buildChecklistItem("older-calc-diffeq", "Older calculus path", [
        "MATH& 153",
        "MATH& 254",
        "MATH 238",
      ]),
    ],
    completedCourses
  );
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses,
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses,
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedCourseLabels = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(plannedCourseLabels.includes("MATH 238"), true);
});

test("Quarter-plan synthesis gives Seattle ECE structured runtime rows and planned quarters", () => {
  const planningState = getResolvedRuntimeQuarterPlanningState(
    "uw-seattle-electrical-computer-engineering",
    null
  );
  const nonChecklistCourses = getTransferPlannerGrcCourseList(planningState.resolvedPlan)
    .flatMap((label) => extractCourseCodes(label))
    .map((code) => normalizeCourseCode(code))
    .filter((code) => !getChecklistCoverageForPlan(planningState.resolvedPlan).has(code));

  assert.equal(
    planningState.diagnostics.hasStructuredPlannerData,
    true,
    JSON.stringify(planningState.diagnostics)
  );
  assert.equal(
    planningState.diagnostics.hasPlannedQuarterRows,
    true,
    JSON.stringify(planningState.diagnostics)
  );
  assert.ok(
    planningState.resolvedPlan.applicationChecklist.some((item) =>
      /CSE 122 or CSE 123/i.test(item.title)
    )
  );
  assert.ok(
    planningState.plannedQuarters
      .flatMap((quarter) => quarter.courses)
      .some((course) => course.label === "CS 121")
  );
  assert.ok(
    planningState.plannedQuarters
      .flatMap((quarter) => quarter.courses)
      .some((course) => course.label === "MATH 238")
  );
  assert.deepEqual(
    [...new Set(nonChecklistCourses)],
    [],
    `Expected ECE runtime planner rows to stay checklist-backed. ${JSON.stringify(
      planningState.diagnostics
    )}`
  );
});

test("Seattle ECE Photonics transfer-only planning orders programming and restores differential equations", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-electrical-computer-engineering"
  );
  assert.ok(runtimePlan, "Expected runtime Seattle ECE plan.");
  const photonicsPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimePlan,
    "photonics-pathway"
  );
  assert.ok(photonicsPlan, "Expected resolved ECE Photonics plan.");

  const completedCourses: TranscriptCourseEntry[] = [];
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: photonicsPlan,
    applicationStatuses: buildRequirementStatuses(
      photonicsPlan.applicationChecklist,
      completedCourses
    ),
    beforeEnrollmentStatuses: buildRequirementStatuses(
      photonicsPlan.beforeEnrollmentChecklist,
      completedCourses
    ),
    stayAtGrcStatuses: buildRequirementStatuses(
      photonicsPlan.stayAtGrcChecklist,
      completedCourses
    ),
    completedCourses,
    track: getTransferPlannerTrack(photonicsPlan.bestTrackId),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-05T12:00:00.000Z"),
  });
  const plannedCourses = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const plannedLabels = plannedCourses.map((course) => course.label);
  const indexOf = (label: string) => plannedLabels.indexOf(label);

  assert.notEqual(indexOf("CS 121"), -1);
  assert.notEqual(indexOf("CS 122"), -1);
  assert.notEqual(indexOf("CS 123"), -1);
  assert.equal(indexOf("CS 121") < indexOf("CS 122"), true);
  assert.equal(indexOf("CS 122") < indexOf("CS 123"), true);
  assert.equal(plannedLabels.includes("MATH 238"), true);
  assert.equal(plannedLabels.includes("MATH 240"), true);
  assert.equal(plannedLabels.includes("CHEM& 131"), false);
  assert.equal(plannedLabels.includes("CHEM 220"), false);
  assert.equal(plannedLabels.includes("ENGL 126"), false);
  assert.equal(plannedLabels.includes("ENGL 128"), false);
  assert.equal(plannedLabels.includes("ENGR 140"), false);
  const optionGroupsById = new Map(
    quarterPlan
      .flatMap((quarter) => quarter.courses)
      .map((course) => course.optionGroup)
      .filter(Boolean)
      .map((optionGroup) => [optionGroup!.id, optionGroup!])
  );
  const transferProgrammingGroup = optionGroupsById.get(
    "uw-seattle-electrical-computer-engineering:requirement-group:ece-transfer-programming-admission"
  );
  const preenrollProgrammingGroup = optionGroupsById.get(
    "uw-seattle-electrical-computer-engineering:requirement-group:ece-preenroll-programming"
  );
  assert.deepEqual(transferProgrammingGroup?.resolvedSatisfiedOptionIds, [
    "uw-seattle-electrical-computer-engineering:requirement-option:cse-122",
  ]);
  assert.equal(
    transferProgrammingGroup?.droppedSatisfiedOptionIds?.includes(
      "uw-seattle-electrical-computer-engineering:requirement-option:cse-123"
    ),
    true
  );
  assert.deepEqual(preenrollProgrammingGroup?.resolvedSatisfiedOptionIds, [
    "uw-seattle-electrical-computer-engineering:requirement-option:cse-123",
  ]);
  const optionAllocationAudit = auditOptionAllocation({
    suggestedPlan: quarterPlan,
    completedCourses,
  });
  const transferProgrammingAllocation = optionAllocationAudit.find((entry) =>
    /ece-transfer-programming-admission/.test(entry.groupId)
  );
  const preenrollProgrammingAllocation = optionAllocationAudit.find((entry) =>
    /ece-preenroll-programming/.test(entry.groupId)
  );
  assert.deepEqual(transferProgrammingAllocation?.resolvedDisplayedOptionIdsAfterCap, [
    "uw-seattle-electrical-computer-engineering:requirement-option:cse-122",
  ]);
  assert.deepEqual(preenrollProgrammingAllocation?.resolvedDisplayedOptionIdsAfterCap, [
    "uw-seattle-electrical-computer-engineering:requirement-option:cse-123",
  ]);
  assert.match(
    transferProgrammingAllocation?.copyOnlyDebugText ?? "",
    /^\[copy-only option allocation audit\]/
  );
  const optionTitleFallbackAudit = auditOptionTitleFallback({
    optionGroups: collectVisibleOptionGroupsForTitleAudit(quarterPlan),
    forceNumberedTitles: true,
  });
  const transferProgrammingTitleAudit = optionTitleFallbackAudit.find((entry) =>
    /ece-transfer-programming-admission/.test(entry.groupId)
  );
  const preenrollProgrammingTitleAudit = optionTitleFallbackAudit.find((entry) =>
    /ece-preenroll-programming/.test(entry.groupId)
  );
  assert.equal(transferProgrammingTitleAudit?.originalTitle, "this requirement");
  assert.equal(transferProgrammingTitleAudit?.displayedTitle, "Requirement Choice 1");
  assert.equal(transferProgrammingTitleAudit?.reason, "forced-numbered-option-title");
  assert.equal(preenrollProgrammingTitleAudit?.originalTitle, "this requirement");
  assert.equal(preenrollProgrammingTitleAudit?.displayedTitle, "Requirement Choice 2");
  assert.equal(preenrollProgrammingTitleAudit?.reason, "forced-numbered-option-title");
  assert.equal(
    optionTitleFallbackAudit.some((entry) => entry.displayedTitle === "this requirement"),
    false
  );
  assert.match(
    transferProgrammingTitleAudit?.copyOnlyDebugText ?? "",
    /^\[copy-only option title fallback audit\]/
  );
  const countedCourseAudit = auditCountedCourses({ suggestedPlan: quarterPlan });
  for (const courseCode of ["CS 121", "CS 122", "CS 123"]) {
    const countedCourse = countedCourseAudit.find((entry) => entry.course === courseCode);
    assert.equal(countedCourse?.countedOnce, true);
  }
  assert.deepEqual(
    auditVisibleGrcQuarterPlanScope({
      plan: photonicsPlan,
      suggestedPlan: quarterPlan,
      transferOnlyMode: true,
    }),
    []
  );
});

test("Quarter-plan audit flags prerequisite order, missing required GRC courses, and unsupported transfer-only rows", () => {
  const auditPlan: TransferPlannerMajorPlan = {
    id: "test-ece-audit-plan",
    campusId: "uw-seattle",
    title: "Test ECE Audit Plan",
    shortTitle: "Test ECE Audit Plan",
    coverage: "detailed",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [
      buildChecklistItem("programming", "CSE 123", ["CS 123"]),
      buildChecklistItem("diffeq", "MATH 207", ["MATH 238"]),
    ],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    grcCourseList: ["CS 123", "MATH 238"],
  };

  const auditEntries = auditVisibleGrcQuarterPlanScope({
    plan: auditPlan,
    transferOnlyMode: true,
    suggestedPlan: [
      {
        label: "Fall 2026",
        phase: "planned",
        courses: [
          {
            label: "CS 123",
            type: "core",
            status: "planned",
            sourceKind: "uw-major-requirement",
            visibilityScope: "visible-grc-completable",
          },
          {
            label: "CHEM& 131",
            type: "core",
            status: "planned",
            sourceKind: "uw-major-requirement",
            visibilityScope: "visible-grc-completable",
          },
        ],
      },
    ],
  });

  const cs123Audit = auditEntries.find((entry) => entry.label === "CS 123");
  const math238Audit = auditEntries.find((entry) => entry.label === "MATH 238");
  const chem131Audit = auditEntries.find((entry) => entry.label === "CHEM& 131");

  assert.ok(cs123Audit?.flags.includes("course-scheduled-before-prerequisite"));
  assert.ok(math238Audit?.flags.includes("uw-required-course-missing-grc-equivalent"));
  assert.ok(
    chem131Audit?.flags.includes(
      "non-required-transfer-only-course-without-source-backed-evidence"
    )
  );
});

test("Quarter-plan synthesis gives Seattle Mechanical Engineering structured runtime rows and planned quarters", () => {
  const planningState = getResolvedRuntimeQuarterPlanningState(
    "uw-seattle-mechanical-engineering",
    null
  );
  const nonChecklistCourses = getTransferPlannerGrcCourseList(planningState.resolvedPlan)
    .flatMap((label) => extractCourseCodes(label))
    .map((code) => normalizeCourseCode(code))
    .filter((code) => !getChecklistCoverageForPlan(planningState.resolvedPlan).has(code));

  assert.equal(
    planningState.diagnostics.hasStructuredPlannerData,
    true,
    JSON.stringify(planningState.diagnostics)
  );
  assert.equal(
    planningState.diagnostics.hasPlannedQuarterRows,
    true,
    JSON.stringify(planningState.diagnostics)
  );
  assert.ok(
    planningState.resolvedPlan.applicationChecklist.some(
      (item) => item.title === "MATH 124, 125, 126"
    )
  );
  assert.ok(
    planningState.resolvedPlan.applicationChecklist.some(
      (item) => item.title === "AA 210" && item.grcCourses.includes("ENGR& 214")
    )
  );
  assert.ok(
    planningState.resolvedPlan.applicationChecklist.some(
      (item) => item.title === "AMATH 301" && item.grcCourses.includes("ENGR 250")
    )
  );
  assert.ok(
    planningState.resolvedPlan.applicationChecklist.some(
      (item) => item.title === "M E 123" && item.grcCourses.includes("ENGR& 114")
    )
  );
  assert.ok(
    planningState.resolvedPlan.applicationChecklist.some(
      (item) => item.title === "MSE 170" && item.grcCourses.includes("ENGR 140")
    )
  );
  assert.ok(
    planningState.resolvedPlan.beforeEnrollmentChecklist.some(
      (item) => item.title === "CEE 220" && item.grcCourses.includes("ENGR& 225")
    )
  );
  assert.ok(
    planningState.resolvedPlan.beforeEnrollmentChecklist.some(
      (item) => item.title === "E E 215" && item.grcCourses.includes("ENGR& 204")
    )
  );
  assert.ok(
    planningState.resolvedPlan.beforeEnrollmentChecklist.some(
      (item) => item.title === "ME 230" && item.grcCourses.includes("ENGR& 215")
    )
  );
  assert.ok(
    planningState.plannedQuarters
      .flatMap((quarter) => quarter.courses)
      .some((course) => course.label === "MATH 238")
  );
  assert.deepEqual(
    [...new Set(nonChecklistCourses)],
    [],
    `Expected Mechanical Engineering runtime planner rows to stay checklist-backed. ${JSON.stringify(
      planningState.diagnostics
    )}`
  );
});

test("Seattle Mechanical Engineering transfer-only planning includes source-backed GRC enrollment rows in prerequisite order", () => {
  const { resolvedPlan, suggestedPlan, plannedLabels } =
    buildSeattleMechanicalSuggestedPlanForTest();
  const requiredCourseCodes = buildSourceBackedRequiredCourseCodes(resolvedPlan);

  assert.deepEqual(
    [
      "ENGL& 101",
      "MATH& 151",
      "MATH& 152",
      "MATH& 163",
      "PHYS& 221",
      "PHYS& 222",
      "PHYS& 223",
      "CHEM& 161",
      "CHEM& 162",
      "CHEM& 163",
      "ENGR& 214",
      "ENGR 250",
      "ENGR& 225",
      "ENGR& 204",
      "ENGR& 114",
      "ENGR& 215",
      "ENGR 140",
      "MATH& 264",
      "MATH 238",
      "MATH 240",
    ].filter((courseCode) => !plannedLabels.includes(courseCode)),
    []
  );
  assert.deepEqual(
    [
      "ENGR& 214",
      "ENGR 250",
      "CHEM& 162",
      "CHEM& 163",
      "ENGR& 225",
      "ENGR& 204",
      "ENGR& 114",
      "ENGR& 215",
      "ENGR 140",
    ].filter((courseCode) => !requiredCourseCodes.includes(courseCode)),
    []
  );
  const engineeringFundamentalsCoverage = auditRequiredMappedCourseCoverage({
    plan: resolvedPlan,
    suggestedPlan,
    completedCourses: [],
  }).filter((row) =>
    ["AA 210", "AMATH 301", "CEE 220", "EE 215", "ME 123", "ME 230", "MSE 170"].includes(
      row.uwCourse
    )
  );
  assert.deepEqual(
    engineeringFundamentalsCoverage
      .filter((row) => row.issue !== null || !row.visibleInPlan)
      .map((row) => row.copyOnlyDebugText),
    []
  );
  assert.equal(
    auditCountedCourses({ suggestedPlan }).reduce((sum, row) => sum + row.credits, 0) > 88,
    true
  );
  assert.equal(plannedLabels.indexOf("ENGR& 214") < plannedLabels.indexOf("ENGR& 225"), true);
  assert.equal(plannedLabels.indexOf("ENGR& 214") < plannedLabels.indexOf("ENGR& 215"), true);
  assert.equal(plannedLabels.indexOf("PHYS& 222") < plannedLabels.indexOf("PHYS& 223"), true);
  assert.equal(plannedLabels.indexOf("CHEM& 161") < plannedLabels.indexOf("CHEM& 162"), true);
  assert.equal(plannedLabels.indexOf("CHEM& 162") < plannedLabels.indexOf("CHEM& 163"), true);
  assert.equal(
    plannedLabels.some((label) => /^(?:M\s*E|ME|CEE)\s*[34]\d{2}/i.test(label)),
    false
  );
  assert.deepEqual(
    auditVisibleGrcQuarterPlanScope({
      plan: resolvedPlan,
      suggestedPlan,
      completedCourses: [],
      transferOnlyMode: true,
    }),
    []
  );

  const missingEngr214Audit = auditVisibleGrcQuarterPlanScope({
    plan: resolvedPlan,
    suggestedPlan: suggestedPlan.map((quarter) => ({
      ...quarter,
      courses: quarter.courses.filter((course) => course.label !== "ENGR& 214"),
    })),
    completedCourses: [],
    transferOnlyMode: true,
  });

  assert.ok(
    missingEngr214Audit.some(
      (entry) =>
        entry.label === "ENGR& 214" &&
        entry.flags.includes("uw-required-course-missing-grc-equivalent")
    )
  );
});

test("Seattle Bioengineering transfer-only planning includes source-backed lower-division GRC rows and gen-ed targets", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-bioengineering");
  assert.ok(runtimePlan, "Expected runtime Seattle Bioengineering plan.");

  const resolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, null);
  assert.ok(resolvedPlan, "Expected resolved Seattle Bioengineering plan.");
  assert.equal(
    resolvedPlan.bestTrackId,
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-bioengineering-and-chemical-engineering"
  );

  const completedCourses: TranscriptCourseEntry[] = [];
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: resolvedPlan,
    applicationStatuses: buildRequirementStatuses(
      resolvedPlan.applicationChecklist,
      completedCourses
    ),
    beforeEnrollmentStatuses: buildRequirementStatuses(
      resolvedPlan.beforeEnrollmentChecklist,
      completedCourses
    ),
    stayAtGrcStatuses: buildRequirementStatuses(
      resolvedPlan.stayAtGrcChecklist,
      completedCourses
    ),
    completedCourses,
    track: getTransferPlannerTrack(resolvedPlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const plannedLabels = suggestedPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const indexOf = (label: string) => plannedLabels.indexOf(label);
  const duplicateMathChemScienceRows = plannedLabels.filter(
    (label, index) =>
      /^(?:MATH|CHEM|PHYS|BIOL)/.test(label) && plannedLabels.indexOf(label) !== index
  );

  assert.deepEqual(
    [
      "ENGL& 101",
      "MATH& 151",
      "MATH& 152",
      "MATH& 163",
      "MATH& 264",
      "MATH 238",
      "MATH 240",
      "CHEM& 161",
      "CHEM& 162",
      "CHEM& 163",
      "CHEM& 261",
      "PHYS& 221",
      "PHYS& 222",
      "BIOL& 211",
      "BIOL& 212",
      "BIOL& 213",
      "ENGR 250",
    ].filter((courseCode) => !plannedLabels.includes(courseCode)),
    []
  );
  assert.deepEqual(duplicateMathChemScienceRows, []);
  assert.deepEqual(
    auditOptionCredits({ suggestedPlan })
      .filter((entry) => entry.componentCourses.length > 1)
      .filter((entry) => entry.issue !== null)
      .map((entry) => entry.copyOnlyDebugText),
    []
  );
  assert.equal(indexOf("MATH& 151") < indexOf("MATH& 152"), true);
  assert.equal(indexOf("MATH& 152") < indexOf("MATH& 163"), true);
  assert.equal(indexOf("MATH& 264") < indexOf("MATH 238"), true);
  assert.equal(indexOf("CHEM& 161") < indexOf("CHEM& 162"), true);
  assert.equal(indexOf("CHEM& 162") < indexOf("CHEM& 163"), true);
  assert.equal(indexOf("CHEM& 163") < indexOf("BIOL& 211"), true);
  assert.equal(indexOf("CHEM& 163") < indexOf("CHEM& 261"), true);
  assert.equal(indexOf("PHYS& 221") < indexOf("PHYS& 222"), true);
  assert.equal(indexOf("BIOL& 211") < indexOf("BIOL& 212"), true);
  assert.equal(indexOf("BIOL& 212") < indexOf("BIOL& 213"), true);
  assert.deepEqual(
    ["STAT 311", "STAT 390", "IND E 315", "INDE 315", "QSCI 381"].filter((courseCode) =>
      plannedLabels.includes(courseCode)
    ),
    []
  );
  assert.equal(
    plannedLabels.some((label) => /^BIOEN\s*[34]\d{2}/i.test(label)),
    false
  );
  assert.deepEqual(
    auditVisibleGrcQuarterPlanScope({
      plan: resolvedPlan,
      suggestedPlan,
      completedCourses,
      transferOnlyMode: true,
    }),
    []
  );

  const sourceBackedAudit = auditUwBioengineeringSourceBackedRequirements({
    plan: resolvedPlan,
    suggestedPlan,
    completedCourses,
  });
  const auditByRequirement = new Map(
    sourceBackedAudit.map((entry) => [entry.uwRequirement, entry])
  );

  assert.deepEqual(auditByRequirement.get("CHEM 162")?.visibleCourseCodes, ["CHEM& 163"]);
  assert.equal(
    auditByRequirement.get("STAT 311, STAT 390, IND E 315, or Q SCI 381")
      ?.visibleInQuarterPlan,
    false
  );
  assert.match(
    auditByRequirement.get("STAT 311, STAT 390, IND E 315, or Q SCI 381")?.hiddenReason ?? "",
    /No source-backed Green River equivalent/
  );
  assert.match(
    auditByRequirement.get("STAT 311, STAT 390, IND E 315, or Q SCI 381")
      ?.copyOnlyDebugText ?? "",
    /^\[copy-only source-backed requirement audit\]/
  );

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(resolvedPlan), {
    ahCredits: 10,
    sscCredits: 10,
    nscCredits: null,
    breadthCredits: 4,
    electiveCredits: 8,
  });
  const genEdSection = buildSourceBackedMajorGeneralEducationRequirementSection(resolvedPlan);
  assert.ok(genEdSection, "Expected Bioengineering source-backed Gen-Ed section.");
  assert.deepEqual(
    genEdSection.items.map((item) => `${item.label}: ${item.valueText}`),
    [
      "Arts & Humanities: 10 credits",
      "Social Sciences: 10 credits",
      "Additional Arts & Humanities / Social Sciences: 4 credits",
      "Diversity: 3 credits",
      "Additional Areas of Inquiry: 8 credits",
    ]
  );
});

test("Seattle Civil Engineering transfer-only planning includes CHEM 152 and keeps one basic science elective", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-civil-engineering");
  assert.ok(runtimePlan, "Expected runtime Seattle Civil Engineering plan.");

  const resolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, null);
  assert.ok(resolvedPlan, "Expected resolved Seattle Civil Engineering plan.");

  const buildCivilSuggestedPlan = (
    completedCourses: TranscriptCourseEntry[],
    selectedRequirementOptionIdsByGroup: Record<string, string[]> = {}
  ) =>
    buildSuggestedQuarterPlan({
      plan: resolvedPlan,
      applicationStatuses: buildRequirementStatuses(
        resolvedPlan.applicationChecklist,
        completedCourses
      ),
      beforeEnrollmentStatuses: buildRequirementStatuses(
        resolvedPlan.beforeEnrollmentChecklist,
        completedCourses
      ),
      stayAtGrcStatuses: buildRequirementStatuses(
        resolvedPlan.stayAtGrcChecklist,
        completedCourses
      ),
      completedCourses,
      track: getTransferPlannerTrack(resolvedPlan.bestTrackId ?? null),
      includeStayAtGrcCourses: false,
      includeStemPrepCourses: false,
      includeSummerQuarter: false,
      referenceDate: new Date("2026-05-06T12:00:00.000Z"),
      selectedRequirementOptionIdsByGroup,
    });
  const getPlannedLabels = (suggestedPlan: ReturnType<typeof buildSuggestedQuarterPlan>) =>
    suggestedPlan
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses.map((course) => course.label));

  const completedCourses: TranscriptCourseEntry[] = [];
  const suggestedPlan = buildCivilSuggestedPlan(completedCourses);
  const plannedLabels = getPlannedLabels(suggestedPlan);
  const indexOf = (label: string) => plannedLabels.indexOf(label);

  assert.deepEqual(
    [
      "ENGL& 101",
      "MATH& 151",
      "MATH& 152",
      "MATH& 163",
      "PHYS& 221",
      "PHYS& 222",
      "PHYS& 223",
      "CHEM& 161",
      "CHEM& 162",
      "CHEM& 163",
      "ENGR& 214",
      "ENGR& 225",
      "ENGR& 215",
      "MATH& 264",
      "MATH 238",
      "MATH 240",
      "ECON& 202",
    ].filter((courseCode) => !plannedLabels.includes(courseCode)),
    []
  );
  assert.equal(indexOf("CHEM& 161") < indexOf("CHEM& 162"), true);
  assert.equal(indexOf("CHEM& 162") < indexOf("CHEM& 163"), true);
  assert.equal(indexOf("ENGR& 214") < indexOf("ENGR& 215"), true);
  assert.equal(indexOf("ENGR& 214") < indexOf("ENGR& 225"), true);
  assert.equal(indexOf("MATH& 264") < indexOf("MATH 238"), true);
  assert.deepEqual(
    ["ENGR 250", "CS 121", "CS 122", "CS 123", "CS& 141"].filter((courseCode) =>
      plannedLabels.includes(courseCode)
    ),
    []
  );
  const computingPrompt = suggestedPlan
    .flatMap((quarter) => quarter.courses)
    .find((course) => /Computing\/programming/i.test(course.optionGroup?.title ?? ""));
  assert.ok(computingPrompt?.optionGroup, "Expected Civil computing true option prompt.");
  assert.equal(computingPrompt.optionGroup.selectionCount, 1);
  assert.deepEqual(computingPrompt.optionGroup.selectedOptionIds, []);
  assert.deepEqual(computingPrompt.optionGroup.resolvedSatisfiedOptionIds ?? [], []);
  const civilOptionTitleAudit = auditOptionTitleFallback({
    optionGroups: collectVisibleOptionGroupsForTitleAudit(suggestedPlan),
    forceNumberedTitles: true,
  });
  const civilComputingTitleAudit = civilOptionTitleAudit.find((entry) =>
    /civil-computing-programming/.test(entry.groupId)
  );
  assert.match(civilComputingTitleAudit?.displayedTitle ?? "", /^Requirement Choice \d+$/);
  assert.equal(
    civilComputingTitleAudit?.originalTitle,
    "Computing/programming Engineering Fundamentals"
  );
  assert.equal(civilComputingTitleAudit?.reason, "forced-numbered-option-title");
  const civilComputingAllocation = auditOptionAllocation({
    suggestedPlan,
    completedCourses,
  }).find((entry) => /Computing\/programming/i.test(entry.groupTitle));
  assert.deepEqual(civilComputingAllocation?.resolvedDisplayedOptionIdsAfterCap, []);
  assert.equal(
    ["NATRS 210", "GEOL& 101"].filter((courseCode) => plannedLabels.includes(courseCode))
      .length,
    1
  );
  assert.deepEqual(
    ["IND E 315", "INDE 315", "QSCI 381", "STAT 290", "STAT 390"].filter((courseCode) =>
      plannedLabels.includes(courseCode)
    ),
    []
  );
  assert.deepEqual(
    auditVisibleGrcQuarterPlanScope({
      plan: resolvedPlan,
      suggestedPlan,
      completedCourses,
      transferOnlyMode: true,
    }),
    []
  );

  const civilAudit = auditUwCivilEngineeringLowerDivisionRequirements({
    plan: resolvedPlan,
    suggestedPlan,
    completedCourses,
  });
  const auditByRequirement = new Map(civilAudit.map((entry) => [entry.uwRequirement, entry]));

  assert.deepEqual(auditByRequirement.get("CHEM 152"), {
    uwRequirement: "CHEM 152",
    grcEquivalents: ["CHEM& 162", "CHEM& 163"],
    visibleInQuarterPlan: true,
    visibleCourseCodes: ["CHEM& 162", "CHEM& 163"],
    hiddenUnmappedReason: null,
  });
  const chem152Coverage = auditRequiredMappedCourseCoverage({
    plan: resolvedPlan,
    suggestedPlan,
    completedCourses,
  }).find((entry) => entry.uwCourse === "CHEM 152");
  assert.deepEqual(chem152Coverage?.mappedGrcEquivalentPath, ["CHEM& 162", "CHEM& 163"]);
  assert.equal(chem152Coverage?.requirementType, "compound-path");
  assert.equal(chem152Coverage?.visibleInPlan, true);
  assert.equal(chem152Coverage?.issue, null);
  assert.match(chem152Coverage?.copyOnlyDebugText ?? "", /^\[copy-only required coverage audit\]/);

  const chem152CompoundAudit = auditCompoundEquivalencyPaths({
    plan: resolvedPlan,
    suggestedPlan,
    completedCourses,
  }).find((entry) => entry.uwCourse === "CHEM 152");
  assert.deepEqual(chem152CompoundAudit?.grcCompoundPath, ["CHEM& 162", "CHEM& 163"]);
  assert.deepEqual(chem152CompoundAudit?.scheduledComponents, ["CHEM& 162", "CHEM& 163"]);
  assert.equal(chem152CompoundAudit?.satisfied, true);
  assert.equal(chem152CompoundAudit?.issue, null);
  assert.match(
    chem152CompoundAudit?.copyOnlyDebugText ?? "",
    /^\[copy-only compound equivalency audit\]/
  );
  const chem152RuntimeCompoundAudit = auditRuntimeCompoundScheduling({
    ownerId: resolvedPlan.id,
    plan: resolvedPlan,
    suggestedPlan,
    completedCourses,
  }).find((entry) => entry.uwTarget === "CHEM 152");
  assert.deepEqual(chem152RuntimeCompoundAudit?.grcCompoundPath, [
    "CHEM& 162",
    "CHEM& 163",
  ]);
  assert.deepEqual(chem152RuntimeCompoundAudit?.scheduledComponents, [
    "CHEM& 162",
    "CHEM& 163",
  ]);
  assert.deepEqual(chem152RuntimeCompoundAudit?.missingComponents, []);
  assert.equal(chem152RuntimeCompoundAudit?.satisfied, true);
  assert.equal(chem152RuntimeCompoundAudit?.issue, "none");
  assert.match(
    chem152RuntimeCompoundAudit?.copyOnlyDebugText ?? "",
    /^\[runtime compound scheduling audit\]/
  );

  const computingOptionAudit = auditTrueOptionDetection({
    plan: resolvedPlan,
    suggestedPlan,
    completedCourses,
  }).find((entry) => /Computing\/programming/i.test(entry.requirement));
  assert.deepEqual(computingOptionAudit?.acceptedUwOptions, [
    "AMATH 301",
    "CSE 121",
    "CSE 122",
    "CSE 123",
    "CSE 142",
    "CSE 160",
  ]);
  assert.deepEqual(computingOptionAudit?.mappedGrcOptions, [
    "CS 121",
    "CS 122",
    "CS 123",
    "CS& 141",
    "ENGR 250",
  ]);
  assert.equal(computingOptionAudit?.detectedAsTrueOption, true);
  assert.equal(computingOptionAudit?.visibleOptionGroup, true);
  assert.equal(computingOptionAudit?.satisfiedBy, "none");
  assert.equal(computingOptionAudit?.issue, null);
  assert.match(
    computingOptionAudit?.copyOnlyDebugText ?? "",
    /^\[copy-only true option detection audit\]/
  );

  const cs122CompletedCourses: TranscriptCourseEntry[] = [
    { code: "CS 122", label: "CS 122", credits: 5 },
  ];
  const cs122SuggestedPlan = buildCivilSuggestedPlan(cs122CompletedCourses);
  const cs122PlannedLabels = getPlannedLabels(cs122SuggestedPlan);
  const cs122ComputingAudit = auditTrueOptionDetection({
    plan: resolvedPlan,
    suggestedPlan: cs122SuggestedPlan,
    completedCourses: cs122CompletedCourses,
  }).find((entry) => /Computing\/programming/i.test(entry.requirement));
  assert.equal(cs122ComputingAudit?.satisfiedBy, "transcript-completed");
  const cs122ComputingAllocation = auditOptionAllocation({
    suggestedPlan: cs122SuggestedPlan,
    completedCourses: cs122CompletedCourses,
  }).find((entry) => /Computing\/programming/i.test(entry.groupTitle));
  assert.deepEqual(cs122ComputingAllocation?.resolvedDisplayedOptionIdsAfterCap, [
    "uw-seattle-civil-engineering:requirement-option:cse-122",
  ]);
  assert.deepEqual(
    ["ENGR 250", "CS 123", "CS& 141"].filter((courseCode) =>
      cs122PlannedLabels.includes(courseCode)
    ),
    []
  );

  const chem162CompletedCourses: TranscriptCourseEntry[] = [
    { code: "CHEM& 162", label: "CHEM& 162", credits: 5 },
  ];
  const chem162SuggestedPlan = buildCivilSuggestedPlan(chem162CompletedCourses);
  const chem162PlannedLabels = getPlannedLabels(chem162SuggestedPlan);
  assert.equal(chem162PlannedLabels.includes("CHEM& 162"), false);
  assert.equal(chem162PlannedLabels.includes("CHEM& 163"), true);
  const chem162RuntimeCompoundAudit = auditRuntimeCompoundScheduling({
    ownerId: resolvedPlan.id,
    plan: resolvedPlan,
    suggestedPlan: chem162SuggestedPlan,
    completedCourses: chem162CompletedCourses,
  }).find((entry) => entry.uwTarget === "CHEM 152");
  assert.deepEqual(chem162RuntimeCompoundAudit?.scheduledComponents, ["CHEM& 163"]);
  assert.deepEqual(chem162RuntimeCompoundAudit?.missingComponents, []);
  assert.equal(chem162RuntimeCompoundAudit?.satisfied, true);
  assert.equal(chem162RuntimeCompoundAudit?.issue, "none");

  const chemFullCompletedCourses: TranscriptCourseEntry[] = [
    { code: "CHEM& 162", label: "CHEM& 162", credits: 5 },
    { code: "CHEM& 163", label: "CHEM& 163", credits: 5 },
  ];
  const chemFullSuggestedPlan = buildCivilSuggestedPlan(chemFullCompletedCourses);
  const chemFullPlannedLabels = getPlannedLabels(chemFullSuggestedPlan);
  assert.equal(chemFullPlannedLabels.includes("CHEM& 162"), false);
  assert.equal(chemFullPlannedLabels.includes("CHEM& 163"), false);
  const chemFullRuntimeCompoundAudit = auditRuntimeCompoundScheduling({
    ownerId: resolvedPlan.id,
    plan: resolvedPlan,
    suggestedPlan: chemFullSuggestedPlan,
    completedCourses: chemFullCompletedCourses,
  }).find((entry) => entry.uwTarget === "CHEM 152");
  assert.deepEqual(chemFullRuntimeCompoundAudit?.scheduledComponents, []);
  assert.deepEqual(chemFullRuntimeCompoundAudit?.missingComponents, []);
  assert.equal(chemFullRuntimeCompoundAudit?.satisfied, true);
  assert.equal(chemFullRuntimeCompoundAudit?.issue, "none");

  const computingItem = resolvedPlan.beforeEnrollmentChecklist.find((item) =>
    /Computing\/programming/i.test(item.title)
  );
  assert.ok(computingItem?.requirementGroup, "Expected Civil computing requirement group.");
  const engr250Option = computingItem.requirementGroup.options.find((option) =>
    (option.grcMatches ?? []).includes("ENGR 250")
  );
  assert.ok(engr250Option, "Expected ENGR 250 computing option.");
  const engr250OptionId = engr250Option.id;
  assert.ok(engr250OptionId, "Expected ENGR 250 computing option id.");
  const selectedEngr250Plan = buildCivilSuggestedPlan([], {
    [computingItem.requirementGroup.id]: [engr250OptionId],
  });
  const selectedEngr250Labels = getPlannedLabels(selectedEngr250Plan);
  assert.equal(selectedEngr250Labels.includes("ENGR 250"), true);
  assert.deepEqual(
    ["CS 121", "CS 122", "CS 123", "CS& 141"].filter((courseCode) =>
      selectedEngr250Labels.includes(courseCode)
    ),
    []
  );
  assert.deepEqual(
    auditByRequirement.get("Basic Science Elective")?.visibleCourseCodes,
    ["NATRS 210"]
  );
  assert.equal(
    auditByRequirement.get("Statistics: IND E 315, QSCI 381, STAT 290, or STAT 390")
      ?.visibleInQuarterPlan,
    false
  );
  assert.match(
    auditByRequirement.get("Statistics: IND E 315, QSCI 381, STAT 290, or STAT 390")
      ?.hiddenUnmappedReason ?? "",
    /No source-backed Green River equivalent/
  );
});

test("Existing structured runtime planners keep their key checklist rows and quarter plans", () => {
  const compEState = getResolvedRuntimeQuarterPlanningState(
    "uw-seattle-computer-engineering",
    null
  );
  const csState = getResolvedRuntimeQuarterPlanningState("uw-seattle-computer-science");
  const compEBeforeEnrollmentTitles = compEState.resolvedPlan.beforeEnrollmentChecklist.map(
    (item) => item.title
  );
  const csBeforeEnrollmentTitles = csState.resolvedPlan.beforeEnrollmentChecklist.map(
    (item) => item.title
  );
  const csGrcCourseList = getTransferPlannerGrcCourseList(csState.resolvedPlan);

  assert.equal(compEState.diagnostics.hasStructuredPlannerData, true);
  assert.equal(compEState.diagnostics.hasPlannedQuarterRows, true);
  assert.ok(compEBeforeEnrollmentTitles.includes("EE 215"));
  assert.ok(compEBeforeEnrollmentTitles.includes("CSE 123 or CSE 143"));

  assert.equal(csState.diagnostics.hasStructuredPlannerData, true);
  assert.equal(csState.diagnostics.hasPlannedQuarterRows, true);
  assert.ok(csBeforeEnrollmentTitles.includes("CSE 123 or CSE 143"));
  assert.equal(csBeforeEnrollmentTitles.includes("PHYS 122"), false);
  assert.equal(csGrcCourseList.includes("MATH 240"), true);
  assert.equal(csGrcCourseList.includes("PHYS& 222"), false);
  assert.equal(csGrcCourseList.includes("BIOL& 211"), false);
  assert.deepEqual(
    ["CS 121", "CS 122", "CS 123"].filter((courseCode) =>
      csGrcCourseList.includes(courseCode)
    ),
    ["CS 121", "CS 122", "CS 123"]
  );
});

test.skip("Quarter planning falls back cleanly when a course is not in the newest published GRC schedule", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "PHYS& 221",
    "PHYS& 222",
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
    "CHEM& 261",
    "ENGL& 101"
  );
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: bioEPlan,
    ...buildStatuses(bioEPlan, completedCourses),
    completedCourses,
    track: bioETrack,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-04-02T12:00:00.000Z"),
  });
  const plannedQuarters = quarterPlan.filter((quarter) => quarter.phase === "planned");
  const engr250Quarter = plannedQuarters.find((quarter) =>
    quarter.courses.some((course) => course.label === "ENGR 250")
  );
  const engr250Course = engr250Quarter?.courses.find((course) => course.label === "ENGR 250");

  assert.ok(engr250Quarter, "Expected ENGR 250 to still be planned.");
  assert.equal(engr250Quarter?.label, "Winter 2027");
  assert.match(engr250Course?.availabilitySummary ?? "", /2024-2025: Winter/);
  assert.match(engr250Course?.availabilitySummary ?? "", /2025-2026: Summer, Winter/);
  assert.match(
    engr250Course?.availabilitySummary ?? "",
    /Not published in the latest 2026-2027 annual schedule/
  );
});

test("Quarter planning keeps UW-required classes ahead of optional Green River add-ons", () => {
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: buildRequirementStatuses(
      [buildChecklistItem("uw-required-writing", "UW required writing", ["ENGL& 101"])],
      []
    ),
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: buildRequirementStatuses(
      [buildChecklistItem("optional-diffeq", "Optional differential equations", ["MATH 238"])],
      []
    ),
    completedCourses: [],
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });

  const plannedLabels = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(plannedLabels.includes("ENGL& 101"), true);
  assert.equal(plannedLabels.includes("MATH 238"), true);
  assert.equal(plannedLabels.indexOf("ENGL& 101") < plannedLabels.indexOf("MATH 238"), true);
});

test("UW-only planning keeps track prerequisites when they unlock required classes", () => {
  const mockTrack = {
    id: "mock-physics-track",
    code: "999X",
    title: "Mock Physics Track",
    summary: "",
    bestFor: [],
    terms: [
      { label: "Fall 1", courses: ["MATH& 151", "PHYS& 221"] },
      { label: "Winter 1", courses: ["PHYS& 222"] },
    ],
    notes: [],
  };
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: buildRequirementStatuses(
      [buildChecklistItem("uw-phys122", "PHYS 122", ["PHYS& 222"])],
      []
    ),
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track: mockTrack as ReturnType<typeof getTransferPlannerTrack>,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });

  const plannedLabels = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(plannedLabels.includes("MATH& 151"), true);
  assert.equal(plannedLabels.includes("PHYS& 221"), true);
  assert.equal(plannedLabels.includes("PHYS& 222"), true);
  assert.equal(plannedLabels.indexOf("MATH& 151") < plannedLabels.indexOf("PHYS& 221"), true);
  assert.equal(plannedLabels.indexOf("PHYS& 221") < plannedLabels.indexOf("PHYS& 222"), true);
});

test("Astronomy quarter planning keeps PHYS& 114 ahead of PHYS& 221 when both are planned", () => {
  const astronomyState = getResolvedRuntimeQuarterPlanningState("uw-seattle-astronomy");
  const plannedLabels = astronomyState.plannedQuarters.flatMap((quarter) =>
    quarter.courses.map((course) => course.label)
  );

  assert.equal(
    astronomyState.resolvedPlan.bestTrackId,
    "grc-associate-stem-physics-associate-in-science-transfer-track-2-physics"
  );
  assert.ok(plannedLabels.includes("PHYS& 114"));
  assert.ok(plannedLabels.includes("PHYS& 221"));
  assert.ok(plannedLabels.includes("PHYS& 222"));
  assert.equal(plannedLabels.indexOf("PHYS& 114") < plannedLabels.indexOf("PHYS& 221"), true);
  assert.equal(plannedLabels.indexOf("PHYS& 221") < plannedLabels.indexOf("PHYS& 222"), true);
});

test("Bothell Biology quarter planning now keeps the AST-2 physics support course ahead of PHYS& 221", () => {
  const biologyState = getResolvedRuntimeQuarterPlanningState("uw-bothell-biology");
  const plannedLabels = biologyState.plannedQuarters.flatMap((quarter) =>
    quarter.courses.map((course) => course.label)
  );

  assert.equal(
    biologyState.resolvedPlan.bestTrackId,
    "grc-associate-stem-physics-associate-in-science-transfer-track-2-physics"
  );
  assert.ok(plannedLabels.includes("PHYS& 114"));
  assert.ok(plannedLabels.includes("PHYS& 221"));
  assert.equal(plannedLabels.indexOf("PHYS& 114") < plannedLabels.indexOf("PHYS& 221"), true);
});

test("Quarter-plan synthesis does not place direct prerequisites after dependent courses across runtime plans", () => {
  const violations: string[] = [];

  for (const campusId of ["uw-seattle", "uw-bothell", "uw-tacoma"] as const) {
    for (const plan of getTransferPlannerMajorsForCampus(campusId)) {
      const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(plan.id);
      assert.ok(runtimePlan, `Expected a runtime planner row for ${plan.id}.`);

      const pathwayIds = [
        null,
        ...getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan).map((pathway) => pathway.id),
      ];
      for (const pathwayId of pathwayIds) {
        const planningState = getResolvedRuntimeQuarterPlanningState(plan.id, pathwayId);
        const quarterIndexByCourseCode = new Map<string, number>();

        planningState.plannedQuarters.forEach((quarter, quarterIndex) => {
          for (const course of quarter.courses) {
            for (const courseCode of extractCourseCodes(course.label)) {
              if (!quarterIndexByCourseCode.has(courseCode)) {
                quarterIndexByCourseCode.set(courseCode, quarterIndex);
              }
            }
          }
        });

        for (const [courseCode, courseQuarterIndex] of quarterIndexByCourseCode.entries()) {
          const canonicalCourse = getTransferPlannerCanonicalCourse("grc", courseCode);
          if (!canonicalCourse) {
            continue;
          }

          for (const prerequisiteCode of canonicalCourse.prerequisiteCourseCodes ?? []) {
            const prerequisiteQuarterIndex = quarterIndexByCourseCode.get(prerequisiteCode);
            if (prerequisiteQuarterIndex === undefined) {
              continue;
            }
            if (prerequisiteQuarterIndex > courseQuarterIndex) {
              violations.push(
                `${plan.id}/${pathwayId ?? "base"} scheduled ${courseCode} before ${prerequisiteCode}`
              );
            }
          }
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("SBSE Business Option no-transcript planning classifies sequences and exposes only true electives", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-sustainable-bioresource-systems-engineering"
  );
  assert.ok(runtimePlan, "Expected the SBSE runtime plan.");
  const businessPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimePlan,
    "business-option"
  );
  assert.ok(businessPlan, "Expected the SBSE Business Option runtime plan.");
  const parsedSbseBaseCourseCodes = new Set(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY
      .filter(
        (block) =>
          block.planId === "uw-seattle-sustainable-bioresource-systems-engineering" &&
          !block.pathwayId
      )
      .flatMap((block) => block.parsedRequirementAtomCandidates ?? [])
      .map((candidate) => normalizeCourseCode(candidate.uwCourseCode))
  );

  assert.equal(parsedSbseBaseCourseCodes.has("MATH 207"), true);
  assert.equal(parsedSbseBaseCourseCodes.has("MATH 208"), true);

  const statuses = buildStatuses(businessPlan, []);
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: businessPlan,
    ...statuses,
    completedCourses: [],
    track: getTransferPlannerTrack(businessPlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup: {},
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const plannedCourses = suggestedPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const plannedLabels = new Set(plannedCourses.map((course) => course.label));
  const visibleOptionGroups = plannedCourses.flatMap((course) =>
    course.optionGroup ? [course.optionGroup] : []
  );
  const visibleOptionGroupTitles = visibleOptionGroups.map((group) => group.title);
  const businessPolicyOptionGroup = visibleOptionGroups.find((group) =>
    /Business, Policy, and Economics/i.test(group.title)
  );
  const creditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: suggestedPlan,
    track: getTransferPlannerTrack(businessPlan.bestTrackId ?? null),
    creditBucketMode: "uw-transfer",
  });
  const classificationAudit = auditRequirementClassification({
    plan: businessPlan,
    suggestedPlan,
    completedCourses: [],
  });
  const byRequirement = new Map(
    classificationAudit.map((entry) => [entry.requirement, entry])
  );
  const invalidScheduledOptionAudit = auditInvalidScheduledOptions({
    plan: businessPlan,
    suggestedPlan,
  });
  const currentVsOldSourceAudit = auditSbseCurrentVsOldSource({
    plan: businessPlan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  });
  const scheduledRowSourceAudit = auditSbseScheduledRowSources({
    plan: businessPlan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  });
  const sbseCreditAudit = auditSbseCreditTotals({
    plan: businessPlan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
    track: getTransferPlannerTrack(businessPlan.bestTrackId ?? null),
  });

  assert.deepEqual(visibleOptionGroupTitles, [
    "Computation and Data Science elective: choose one approved course",
    "Business, Policy, and Economics elective: choose one approved course",
  ]);
  const sbseOptionTitleAudit = auditOptionTitleFallback({
    optionGroups: visibleOptionGroups,
    forceNumberedTitles: true,
  });
  assert.deepEqual(
    sbseOptionTitleAudit.map((entry) => [entry.displayedTitle, entry.reason]),
    [
      ["Requirement Choice 1", "forced-numbered-option-title"],
      ["Requirement Choice 2", "forced-numbered-option-title"],
    ]
  );
  assert.deepEqual(
    sbseOptionTitleAudit.map((entry) => entry.originalTitle),
    [
      "Computation and Data Science elective: choose one approved course",
      "Business, Policy, and Economics elective: choose one approved course",
    ]
  );
  assert.deepEqual(
    (businessPolicyOptionGroup?.options ?? []).map((option) => option.courseCodes),
    [["ECON& 201"], ["ECON& 202"]]
  );
  assert.equal(visibleOptionGroups.length < 10, true);
  for (const requiredCourse of [
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "MATH& 264",
    "MATH 238",
    "MATH 240",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "PHYS& 221",
    "ENGL& 101",
  ]) {
    assert.equal(plannedLabels.has(requiredCourse), true, `Expected ${requiredCourse}.`);
  }
  assert.equal(plannedLabels.has("CS 123"), false);
  assert.equal(plannedLabels.has("CS& 141"), false);
  assert.equal(plannedLabels.has("ACCT& 203"), false);
  for (const staleOrTrackOnlyCourse of [
    "CHEM& 262",
    "PHYS& 223",
    "ENGR& 204",
    "ENGR& 214",
    "ENGR& 215",
    "ENGR& 225",
    "ENGR& 114",
    "ENGR 140",
    "ENGL 128",
    "ENGR 100",
    "ENGR 106",
  ]) {
    assert.equal(
      plannedLabels.has(staleOrTrackOnlyCourse),
      false,
      `Did not expect stale or matched-track-only ${staleOrTrackOnlyCourse} to be scheduled.`
    );
  }
  assert.equal(
    businessPlan.grcCourseList?.some((courseCode) => /^ACCT\b|^ACCT&\b/i.test(courseCode)),
    false
  );
  assert.equal(creditRange.maxRemainingCredits < 129, true);
  assert.equal(
    [...plannedLabels].some((label) =>
      /this requirement|\+ %|AMATH 351 or MATH 125|AMATH 352 or MATH 126/i.test(label)
    ),
    false
  );
  assert.equal(
    byRequirement.get("MATH 124, MATH 125, and MATH 126 calculus sequence")?.classification,
    "required-sequence"
  );
  assert.equal(
    byRequirement.get("MATH 207 or AMATH 351")?.classification,
    "required-sequence"
  );
  assert.deepEqual(
    byRequirement.get("MATH 207 or AMATH 351")?.scheduledCourses,
    ["MATH 238"]
  );
  assert.equal(
    byRequirement.get("MATH 208 or AMATH 352")?.classification,
    "required-sequence"
  );
  assert.deepEqual(
    byRequirement.get("MATH 208 or AMATH 352")?.scheduledCourses,
    ["MATH 240"]
  );
  assert.equal(
    byRequirement.get("CHEM 142, CHEM 152, and CHEM 162 chemistry sequence")?.classification,
    "required-sequence"
  );
  assert.equal(
    byRequirement.get("Computation and Data Science elective: choose one approved course")?.classification,
    "true-option"
  );
  assert.equal(
    byRequirement.get("Business, Policy, and Economics elective: choose one approved course")?.classification,
    "true-option"
  );
  assert.ok(
    classificationAudit.every((entry) =>
      entry.copyOnlyDebugText.startsWith("[copy-only requirement classification audit]")
    )
  );
  assert.deepEqual(
    invalidScheduledOptionAudit.filter((entry) => !entry.isAcceptedByCurrentSource),
    []
  );
  assert.equal(
    currentVsOldSourceAudit.every((entry) => entry.transferOnlyShouldShow),
    true
  );
  assert.equal(
    currentVsOldSourceAudit.some((entry) => entry.course.includes("ACCT& 203")),
    false
  );
  assert.ok(
    currentVsOldSourceAudit.some(
      (entry) =>
        entry.course === "PHYS& 221" &&
        entry.currentSbseSourceBacked &&
        /current SBSE source-backed requirement/i.test(entry.reason)
    )
  );
  assert.ok(
    currentVsOldSourceAudit.every((entry) =>
      entry.copyOnlyDebugText.startsWith("[copy-only current-vs-old-source audit]")
    )
  );
  assert.equal(
    scheduledRowSourceAudit.every((entry) => entry.shouldSchedule),
    true
  );
  assert.ok(
    scheduledRowSourceAudit.every((entry) =>
      entry.copyOnlyDebugText.startsWith("[copy-only SBSE scheduled row source audit]")
    )
  );
  for (const sourceBackedCourse of [
    "CHEM& 261",
    "ENGR& 224",
    "MATH 238",
    "MATH 240",
    "PHYS& 222",
  ]) {
    assert.ok(
      scheduledRowSourceAudit.some(
        (entry) => entry.course === sourceBackedCourse && entry.source === "current-sbse"
      ),
      `Expected ${sourceBackedCourse} to be classified as current SBSE.`
    );
  }
  assert.deepEqual(
    scheduledRowSourceAudit.filter((entry) =>
      ["old-bse", "matched-track", "stale-supplemental"].includes(entry.source)
    ),
    []
  );
  assert.ok(
    scheduledRowSourceAudit.some(
      (entry) => entry.course === "MATH& 264" && entry.source === "prerequisite"
    )
  );
  assert.equal(sbseCreditAudit.length, 1);
  assert.match(
    sbseCreditAudit[0]?.copyOnlyDebugText ?? "",
    /^\[copy-only SBSE credit audit\]/
  );
  assert.equal(sbseCreditAudit[0]?.oldBseMatchedTrackFilteredCredits, 0);

  const suggestedPlanWithStemPrep = buildSuggestedQuarterPlan({
    plan: businessPlan,
    ...statuses,
    completedCourses: [],
    track: getTransferPlannerTrack(businessPlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: true,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup: {},
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const plannedStemPrepLabels = new Set(
    suggestedPlanWithStemPrep
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses.map((course) => course.label))
  );
  const stemPrepCreditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: suggestedPlanWithStemPrep,
    track: getTransferPlannerTrack(businessPlan.bestTrackId ?? null),
    creditBucketMode: "uw-transfer",
  });
  const stemPrepDisplayedCreditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: suggestedPlanWithStemPrep,
    track: null,
  });
  const stemPrepScheduledRowSourceAudit = auditSbseScheduledRowSources({
    plan: businessPlan,
    suggestedPlan: suggestedPlanWithStemPrep,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  });

  for (const staleOrTrackOnlyCourse of [
    "ACCT& 203",
    "CHEM& 262",
    "PHYS& 223",
    "ENGR& 204",
    "ENGR& 214",
    "ENGR& 215",
    "ENGR& 225",
    "ENGR& 114",
    "ENGR 140",
    "ENGL 128",
  ]) {
    assert.equal(
      plannedStemPrepLabels.has(staleOrTrackOnlyCourse),
      false,
      `Did not expect ${staleOrTrackOnlyCourse} in transfer-only STEM prep mode.`
    );
  }
  assert.equal(plannedStemPrepLabels.has("MATH 238"), true);
  assert.equal(plannedStemPrepLabels.has("MATH& 264"), true);
  assert.equal(plannedStemPrepLabels.has("MATH 240"), true);
  assert.equal(stemPrepCreditRange.maxRemainingCredits < 115, true);
  assert.equal(stemPrepDisplayedCreditRange.maxRemainingCredits < 115, true);
  assert.equal(
    stemPrepScheduledRowSourceAudit.every((entry) => entry.shouldSchedule),
    true
  );
  assert.ok(
    stemPrepScheduledRowSourceAudit.some(
      (entry) => entry.source === "prerequisite" && entry.course === "MATH& 141"
    )
  );
});

test("SBSE post-calculus math schedules MATH 238 unless MATH 207 is already satisfied", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-sustainable-bioresource-systems-engineering"
  );
  assert.ok(runtimePlan, "Expected the SBSE runtime plan.");
  const businessPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimePlan,
    "business-option"
  );
  assert.ok(businessPlan, "Expected the SBSE Business Option runtime plan.");

  const buildPlanForCompletedCourses = (completedCourses: TranscriptCourseEntry[]) => {
    const statuses = buildStatuses(businessPlan, completedCourses);
    return buildSuggestedQuarterPlan({
      plan: businessPlan,
      ...statuses,
      completedCourses,
      track: getTransferPlannerTrack(businessPlan.bestTrackId ?? null),
      includeStayAtGrcCourses: false,
      includeStemPrepCourses: false,
      includeSummerQuarter: false,
      selectedRequirementOptionIdsByGroup: {},
      referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    });
  };
  const getPlannedLabels = (suggestedPlan: ReturnType<typeof buildSuggestedQuarterPlan>) =>
    new Set(
      suggestedPlan
        .filter((quarter) => quarter.phase === "planned")
        .flatMap((quarter) => quarter.courses.map((course) => course.label))
    );

  const unsatisfiedPlan = buildPlanForCompletedCourses([]);
  const unsatisfiedPlannedLabels = getPlannedLabels(unsatisfiedPlan);
  assert.equal(unsatisfiedPlannedLabels.has("MATH 238"), true);
  assert.equal(unsatisfiedPlannedLabels.has("MATH& 264"), true);
  assert.equal(unsatisfiedPlannedLabels.has("MATH 240"), true);

  const math207SatisfiedPlan = buildPlanForCompletedCourses([
    { code: "MATH 207", label: "MATH 207", credits: 5 },
  ]);
  const math207SatisfiedPlannedLabels = getPlannedLabels(math207SatisfiedPlan);
  assert.equal(math207SatisfiedPlannedLabels.has("MATH 238"), false);
  assert.equal(math207SatisfiedPlannedLabels.has("MATH& 264"), false);
  assert.equal(math207SatisfiedPlannedLabels.has("MATH 240"), true);

  const math208OnlyPlan = buildPlanForCompletedCourses([
    { code: "MATH 240", label: "MATH 240", credits: 5 },
  ]);
  const math208OnlyPlannedLabels = getPlannedLabels(math208OnlyPlan);
  assert.equal(math208OnlyPlannedLabels.has("MATH 238"), true);
  assert.equal(math208OnlyPlannedLabels.has("MATH& 264"), true);
  assert.equal(math208OnlyPlannedLabels.has("MATH 240"), false);
  assert.equal(math208OnlyPlannedLabels.has("ACCT& 203"), false);

  const math238Audit = auditSbseScheduledRowSources({
    plan: businessPlan,
    suggestedPlan: unsatisfiedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  }).find((entry) => entry.course === "MATH 238");
  assert.equal(math238Audit?.uwEquivalent, "MATH 207");
  assert.equal(math238Audit?.source, "current-sbse");
  assert.match(math238Audit?.reason ?? "", /MATH 207 \/ AMATH 351/);
});

test("SBSE Business Option transcript-loaded planning does not reschedule satisfied math, chemistry, or computation options", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-sustainable-bioresource-systems-engineering"
  );
  assert.ok(runtimePlan, "Expected the SBSE runtime plan.");
  const businessPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimePlan,
    "business-option"
  );
  assert.ok(businessPlan, "Expected the SBSE Business Option runtime plan.");

  const completedCourses: TranscriptCourseEntry[] = [
    { code: "CS 121", label: "CS 121", credits: 5 },
    { code: "CS 122", label: "CS 122", credits: 5 },
    { code: "CHEM& 161", label: "CHEM& 161", credits: 5 },
    { code: "CHEM& 162", label: "CHEM& 162", credits: 5 },
    { code: "CHEM& 163", label: "CHEM& 163", credits: 5 },
    { code: "MATH& 151", label: "MATH& 151", credits: 5 },
    { code: "MATH& 152", label: "MATH& 152", credits: 5 },
    { code: "MATH& 163", label: "MATH& 163", credits: 5 },
    { code: "ENGL& 101", label: "ENGL& 101", credits: 5 },
  ];
  const statuses = buildStatuses(businessPlan, completedCourses);
  const allStatuses = [
    ...statuses.applicationStatuses,
    ...statuses.beforeEnrollmentStatuses,
    ...statuses.stayAtGrcStatuses,
  ];
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: businessPlan,
    ...statuses,
    completedCourses,
    track: getTransferPlannerTrack(businessPlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup: {},
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const plannedLabels = new Set(
    suggestedPlan
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses.map((course) => course.label))
  );
  const creditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: suggestedPlan,
    track: getTransferPlannerTrack(businessPlan.bestTrackId ?? null),
    creditBucketMode: "uw-transfer",
  });
  const getStatus = (title: string) => allStatuses.find((status) => status.item.title === title);

  assert.equal(
    getStatus("MATH 124, MATH 125, and MATH 126 calculus sequence")?.matched,
    true
  );
  assert.equal(
    getStatus("CHEM 142, CHEM 152, and CHEM 162 chemistry sequence")?.matched,
    true
  );
  assert.equal(getStatus("English Composition: 5 credits")?.matched, true);
  for (const alreadyCompleted of [
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "ENGL& 101",
    "CS 123",
    "CS& 141",
    "ACCT& 203",
  ]) {
    assert.equal(
      plannedLabels.has(alreadyCompleted),
      false,
      `Did not expect ${alreadyCompleted} to be scheduled.`
    );
  }

  const optionAudit = auditOptionGroupSatisfaction({
    plan: businessPlan,
    suggestedPlan,
    completedCourses,
  });
  const computationAudit = optionAudit.find((entry) =>
    /Computation and Data Science/i.test(entry.requirement)
  );
  assert.ok(computationAudit, "Expected computation option audit.");
  assert.equal(computationAudit?.satisfiedBy.includes("CS 122"), true);
  assert.deepEqual(computationAudit?.scheduledExtraCourses, []);
  assert.equal(computationAudit?.shouldScheduleExtra, false);
  assert.equal(computationAudit?.independentSchedulingReason, "none");
  assert.equal(creditRange.maxRemainingCredits < 87, true);
  assert.deepEqual(
    auditInvalidScheduledOptions({
      plan: businessPlan,
      suggestedPlan,
    }).filter((entry) => !entry.isAcceptedByCurrentSource),
    []
  );
  assert.deepEqual(
    auditSbseCurrentVsOldSource({
      plan: businessPlan,
      suggestedPlan,
      completedCourses,
      selectedRequirementOptionIdsByGroup: {},
    }).filter((entry) => !entry.transferOnlyShouldShow),
    []
  );
  assert.deepEqual(
    auditSbseScheduledRowSources({
      plan: businessPlan,
      suggestedPlan,
      completedCourses,
      selectedRequirementOptionIdsByGroup: {},
    }).filter((entry) => !entry.shouldSchedule),
    []
  );
  assert.equal(
    auditSbseCreditTotals({
      plan: businessPlan,
      suggestedPlan,
      completedCourses,
      selectedRequirementOptionIdsByGroup: {},
      track: getTransferPlannerTrack(businessPlan.bestTrackId ?? null),
    })[0]?.oldBseMatchedTrackFilteredCredits,
    0
  );
  for (const row of optionAudit) {
    if (!row.shouldScheduleExtra && row.scheduledExtraCourses.length > 0) {
      assert.notEqual(row.independentSchedulingReason, "none");
    }
  }
});

test("SBSE computation/data science options satisfy from completed CS 122 without scheduling CS 123", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-sustainable-bioresource-systems-engineering"
  );
  assert.ok(runtimePlan, "Expected the SBSE runtime plan.");

  const baseComputationGroup = runtimePlan.requirementGroups?.find((group) =>
    group.id.endsWith(":computation-data-science-elective")
  );
  assert.ok(
    baseComputationGroup,
    "Expected the SBSE base/default runtime plan to preserve the computation/data science group."
  );

  const businessPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimePlan,
    "business-option"
  );
  assert.ok(businessPlan, "Expected the SBSE Business Option runtime plan.");

  const computationGroup = businessPlan.requirementGroups?.find((group) =>
    group.id.endsWith(":computation-data-science-elective")
  );
  assert.ok(
    computationGroup,
    "Expected SBSE Business Option to expose the broad computation/data science option group."
  );
  assert.equal(
    businessPlan.requirementGroups?.some((group) => group.id.endsWith(":cse-123-or-cse-143")),
    false,
    "Expected the narrow CSE 123/CSE 143 group to be replaced by the source-backed broad option group."
  );

  const acceptedUwCodes = new Set(
    (computationGroup?.options ?? [])
      .flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
      ])
      .map((courseCode) => normalizeCourseCode(courseCode))
  );
  for (const courseCode of [
    "AMATH 301",
    "CSE 121",
    "CSE 122",
    "CSE 123",
    "CSE 142",
    "CSE 143",
    "CSE 160",
    "INFO 180",
    "CSE 180",
    "STAT 180",
    "Q SCI 256",
  ]) {
    assert.equal(
      acceptedUwCodes.has(normalizeCourseCode(courseCode)),
      true,
      `Expected SBSE computation/data science options to include ${courseCode}.`
    );
  }

  const cse122Option = computationGroup?.options.find((option) =>
    option.uwCourses.includes("CSE 122")
  );
  assert.deepEqual(cse122Option?.grcMatches, ["CS 122"]);

  const completedCourses: TranscriptCourseEntry[] = [
    { code: "CS 121", label: "CS 121", credits: 5 },
    { code: "CS 122", label: "CS 122", credits: 5 },
  ];
  const statuses = buildStatuses(businessPlan, completedCourses);
  const computationStatus = [
    ...statuses.applicationStatuses,
    ...statuses.beforeEnrollmentStatuses,
    ...statuses.stayAtGrcStatuses,
  ].find((status) => status.item.requirementGroup?.id === computationGroup?.id);

  assert.equal(computationStatus?.matched, true);
  assert.equal(
    computationStatus?.matchedCourses.some((course) => course.code === "CS 122"),
    true
  );

  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: businessPlan,
    ...statuses,
    completedCourses,
    track: getTransferPlannerTrack(businessPlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const plannedLabels = new Set(
    suggestedPlan
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses.map((course) => course.label))
  );

  assert.equal(plannedLabels.has("CS 123"), false);
  assert.equal(plannedLabels.has("CS& 141"), false);
  assert.equal(plannedLabels.has("ACCT& 203"), false);
  assert.deepEqual(
    auditSbseScheduledRowSources({
      plan: businessPlan,
      suggestedPlan,
      completedCourses,
      selectedRequirementOptionIdsByGroup: {},
    }).filter((entry) => !entry.shouldSchedule),
    []
  );

  const optionSatisfactionAudit = auditOptionGroupSatisfaction({
    plan: businessPlan,
    suggestedPlan,
    completedCourses,
  });
  const computationAudit = optionSatisfactionAudit.find(
    (entry) => entry.groupId === computationGroup?.id
  );
  assert.ok(computationAudit, "Expected option-group satisfaction audit for SBSE computation.");
  assert.equal(computationAudit?.satisfiedBy.includes("CS 122"), true);
  assert.deepEqual(computationAudit?.scheduledExtraCourses, []);
  assert.equal(computationAudit?.shouldScheduleExtra, false);
  assert.match(
    computationAudit?.copyOnlyDebugText ?? "",
    /^\[copy-only option satisfaction resolver audit\]/
  );
  assert.match(computationAudit?.copyOnlyDebugText ?? "", /Accepted options: .*CSE 122/);
  const computationAllocation = auditOptionAllocation({
    suggestedPlan,
    completedCourses,
  }).find((entry) => entry.groupId === computationGroup?.id);
  assert.equal(
    (computationAllocation?.resolvedDisplayedOptionIdsAfterCap.length ?? 0) <=
      (computationAllocation?.requiredCount ?? 0),
    true
  );

  const unselectedPrerequisiteLeaks = auditUnselectedOptionPrerequisiteScheduling({
    plan: businessPlan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).filter(
    (row) =>
      row.groupId === computationGroup?.id &&
      !row.optionSelected &&
      row.prerequisiteScheduled &&
      !row.shouldSchedule
  );
  assert.deepEqual(unselectedPrerequisiteLeaks, []);
});

