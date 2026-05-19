const assert = require("node:assert/strict");
const test = require("node:test");

const sourceBackedCoverageAudit = require("./source-backed-coverage-actionability.cjs");
const coverageAudit = require("./audit-transfer-planner-source-backed-coverage.cjs");
const source = require("../../constants/transfer-planner-source");
const studentRuntime = require("../../constants/transfer-planner-source/student-runtime");
const planner = require("../../services/planning/transfer-planner.service");
const suggestedScheduleFormatter = require("../../components/transfer-planner/transfer-planner-suggested-schedule");

test("Source-backed coverage audit classifies blocking maintainer failures", () => {
  const cases = [
    {
      name: "parsed source course missing from generated runtime",
      row: {
        issueType: "missing-detected-course",
        ownerId: "uw-seattle-computer-engineering",
        generatedRuntimeRow: false,
        visibleInTransferOnlyQuarterPlan: false,
        uwRequirementLabel: "BIOL 180",
      },
      expectedClass: "source-course-parsed-not-generated",
      expectedLayer: "generator",
      expectedFixPath: /generate-transfer-planner-student-runtime\.cjs/,
    },
    {
      name: "generated row exists but is hidden from students",
      row: {
        issueType: "missing-detected-course",
        ownerId: "uw-seattle-computer-engineering",
        generatedRuntimeRow: true,
        visibleInTransferOnlyQuarterPlan: false,
        hiddenInternalReason: "Known Green River equivalent is generated but is not visible",
      },
      expectedClass: "generated-row-exists-but-not-visible",
      expectedLayer: "runtime",
      expectedFixPath: /transfer-planner\.service\.ts/,
    },
    {
      name: "support-only approved list scheduled as required",
      row: {
        issue: "approved-list-generated-required-row",
        ownerId: "uw-seattle-computer-engineering",
        sourceRole: "approved-course-list",
        generatedArtifact: "source/constants/transfer-planner-source/student-runtime.generated.ts",
      },
      expectedClass: "support-only-course-scheduled-as-required",
      expectedLayer: "generator",
      expectedFixPath: /generate-transfer-planner-student-runtime\.cjs/,
    },
    {
      name: "credit bucket lost or flattened",
      row: {
        issue: "flattened-credit-bucket",
        ownerId: "uw-seattle-computer-engineering",
        requirementTitle: "Natural Science",
      },
      expectedClass: "credit-bucket-lost-or-flattened",
      expectedLayer: "generator",
      expectedFixPath: /generate-transfer-planner-student-runtime\.cjs/,
    },
    {
      name: "placeholder scheduled as false-required sibling",
      row: {
        issue: "placeholder-atom-scheduled",
        ownerId: "grc-associate-stem-engineering-associate-in-science-transfer-track-2",
        requirementTitle: "Choose one placeholder",
        scheduled: true,
      },
      expectedClass: "placeholder-scheduled-as-false-required",
      expectedLayer: "runtime",
      expectedFixPath: /transfer-planner\.service\.ts/,
    },
    {
      name: "option group collapsed to a single course",
      row: {
        issue: "flattened-option-group",
        ownerId: "uw-seattle-materials-science-engineering",
        requirementTitle: "MATH 207 or AMATH 351",
      },
      expectedClass: "option-group-collapsed-to-single-course",
      expectedLayer: "generator",
      expectedFixPath: /generate-transfer-planner-student-runtime\.cjs/,
    },
    {
      name: "visible row lacks source evidence",
      row: {
        issue: "generated-row-without-primary-source",
        ownerId: "uw-seattle-computer-science",
        requirementCourse: "PHYS& 222",
      },
      expectedClass: "visible-row-lacks-source-evidence",
      expectedLayer: "generator",
      expectedFixPath: /generate-transfer-planner-student-runtime\.cjs/,
    },
    {
      name: "GRC equivalent missing or over-selected",
      row: {
        issue: "missing-equivalency",
        ownerId: "uw-seattle-computer-engineering",
        requirementTitle: "CHEM 142",
      },
      expectedClass: "equivalent-grc-course-missing-or-over-selected",
      expectedLayer: "mapping",
      expectedFixPath: /parse-transfer-planner-equivalency-guide\.cjs/,
    },
    {
      name: "course-list section emitted as requirement points at parser emission gate",
      row: {
        issue: "course-list-emitted-requirement",
        ownerId: "uw-seattle-jewish-studies",
        detectedSectionRole: "elective-list",
        rawLine: "RELIG 145",
      },
      expectedClass: "source-role-misclassified",
      expectedLayer: "parser",
      expectedFixPath: /parse-transfer-planner-requirement-sources\.cjs/,
    },
    {
      name: "source-scope contamination stays discovery/source-selection work",
      row: {
        issue: "source-scope-contamination",
        ownerId: "uw-seattle-computer-science:pathway:data-science-option",
      },
      expectedClass: "source-role-misclassified",
      expectedLayer: "discovery",
      expectedFixPath: /discover-transfer-planner-primary-sources\.cjs/,
    },
  ];

  for (const testCase of cases) {
    const result = sourceBackedCoverageAudit.buildActionableAuditIssueMetadata(
      testCase.row,
      "unit-test"
    );
    assert.equal(result.blockingGate, sourceBackedCoverageAudit.SOURCE_BACKED_COVERAGE_GATE_LABEL);
    assert.equal(result.actionableIssueClass, testCase.expectedClass, testCase.name);
    assert.equal(result.suspectedLayer, testCase.expectedLayer, testCase.name);
    assert.match(result.recommendedFixPath, testCase.expectedFixPath, testCase.name);
    assert.ok(result.recommendedNonManualFix.includes("Fix"), testCase.name);
    assert.doesNotMatch(result.recommendedFixPath, /generated-major-plans\.ts/, testCase.name);
  }
});

test("Source-backed coverage gate counts requirement coverage rows as blocking issues", () => {
  const report = sourceBackedCoverageAudit.enrichSourceBackedCoverageReport({
    generatedAt: "2026-05-11T00:00:00.000Z",
    outcome: "failed",
    summary: {
      ownerCount: 1,
      requirementCoverageRowCount: 1,
    },
    requirementCoverageRows: [
      {
        issueType: "missing-detected-course",
        ownerId: "uw-seattle-computer-engineering",
        generatedRuntimeRow: true,
        visibleInTransferOnlyQuarterPlan: false,
      },
    ],
  });

  assert.equal(report.summary.blockingGate, "source-backed-runtime-coverage");
  assert.equal(report.summary.blockingGateIssueCount, 1);
  assert.deepEqual(report.summary.issueCountsBySuspectedLayer, { runtime: 1 });
  assert.deepEqual(report.summary.issueCountsByActionableClass, {
    "generated-row-exists-but-not-visible": 1,
  });
});

test("Protected physics sequence expectation does not apply when scoped source says not required", () => {
  const notRequired = coverageAudit.protectedSequenceExpectationAppliesForTest(
    [
      {
        sourceLabel: "Biology BA catalog section",
        snapshotLines: [
          "Bachelor of Arts degree with a major in Biology",
          "Physics: not required",
        ],
      },
    ],
    [
      ["PHYS 114", "PHYS 115"],
      ["PHYS 121", "PHYS 122"],
    ]
  );
  const required = coverageAudit.protectedSequenceExpectationAppliesForTest(
    [
      {
        sourceLabel: "Biology BS catalog section",
        snapshotLines: [
          "Two quarters of physics (8-10 credits): one of the following:",
          "PHYS 114, PHYS 115",
          "PHYS 121, PHYS 122",
        ],
      },
    ],
    [
      ["PHYS 114", "PHYS 115"],
      ["PHYS 121", "PHYS 122"],
    ]
  );

  assert.equal(notRequired.applies, false);
  assert.match(notRequired.reason, /not required/i);
  assert.equal(required.applies, true);
});

test("Source-backed coverage ignores legacy-only guide equivalents", () => {
  assert.deepEqual(
    coverageAudit.getGrcEquivalentsForUwCoursesForTest(["FRENCH 203"]),
    []
  );
  assert.deepEqual(
    coverageAudit.getGrcEquivalentsForUwCoursesForTest(["GERMAN 203"]),
    []
  );
});

test("Source-backed coverage does not count represented unselected options as over-scheduled", () => {
  assert.equal(
    coverageAudit.classifyCoverageIssueForTest({
      parsedUwCourseCodes: ["CHEM 142", "CHEM 152", "CHEM 220"],
      grcEquivalents: ["CHEM& 131", "CHEM& 161", "CHEM& 162", "CHEM& 163"],
      generatedRuntimeRow: true,
      visibleInTransferOnlyPlan: true,
      groupedChoiceMax: 1,
      visibleCourseCodes: ["CHEM& 161", "CHEM& 162", "CHEM& 163"],
      scheduledVisibleCourseCodes: ["CHEM& 161", "CHEM& 162", "CHEM& 163"],
      representedRuntimeUwOnlyOption: false,
      representedUnselectedRuntimeOption: true,
    }),
    null
  );
});

test("Source-backed coverage accepts a visible selected sibling for choose-one alternatives", () => {
  const sourceUrl = "https://example.test/degree-sheet.pdf";
  assert.equal(
    coverageAudit.isParsedChoiceRepresentedBySelectedRuntimeAlternativeForTest({
      runtimePlan: {
        applicationChecklist: [],
        beforeEnrollmentChecklist: [
          {
            title: "Basic Science Elective",
            sourceUrl,
            grcCourses: ["NATRS 210"],
            alternatives: [["GEOL& 101"]],
          },
        ],
        stayAtGrcChecklist: [],
      },
      sourceUrl,
      groupedChoiceCardinality: "choose_one: 1 of 10",
      grcEquivalents: ["BIOL& 211", "GEOL& 101"],
      parsedRequirementContext: "Basic Science Elective",
      visibleCourseCodeSet: new Set(["NATRS 210"]),
    }),
    true
  );

  assert.equal(
    coverageAudit.isParsedChoiceRepresentedBySelectedRuntimeAlternativeForTest({
      runtimePlan: {
        applicationChecklist: [],
        beforeEnrollmentChecklist: [
          {
            title: "Statistics Elective",
            sourceUrl,
            grcCourses: ["MATH& 146"],
            alternatives: [["BIOL& 211"]],
          },
        ],
        stayAtGrcChecklist: [],
      },
      sourceUrl,
      groupedChoiceCardinality: "choose_one: 1 of 10",
      grcEquivalents: ["BIOL& 211", "GEOL& 101"],
      parsedRequirementContext: "Basic Science Elective",
      visibleCourseCodeSet: new Set(["MATH& 146"]),
    }),
    false
  );
});

test("Source-backed coverage treats explicit non-counting exploratory elective lists as contextual", () => {
  const row = {
    uwRequirementLabel:
      "Students should plan to take one exploratory course and relevant engineering electives from the list. While these are helpful for deepening your experience, they do not count toward the 9 credits required.",
  };

  assert.equal(coverageAudit.isNonSchedulableContextualSourceRowForTest(row), true);
  assert.equal(
    coverageAudit.classifyCoverageIssueForTest({
      ...row,
      parsedUwCourseCodes: ["ENGR 140"],
      grcEquivalents: ["ENGR 140"],
      generatedRuntimeRow: false,
      visibleInTransferOnlyPlan: false,
      groupedChoiceMax: null,
      visibleCourseCodes: [],
      scheduledVisibleCourseCodes: [],
      representedRuntimeUwOnlyOption: false,
      representedUnselectedRuntimeOption: false,
      nonSchedulableContextualSourceRow: true,
    }),
    null
  );

  const requiredRow = {
    uwRequirementLabel:
      "Students must complete one exploratory engineering elective from the list. This required engineering elective counts toward the required credits.",
  };
  assert.equal(coverageAudit.isNonSchedulableContextualSourceRowForTest(requiredRow), false);
  assert.equal(
    coverageAudit.classifyCoverageIssueForTest({
      ...requiredRow,
      parsedUwCourseCodes: ["ENGR 140"],
      grcEquivalents: ["ENGR 140"],
      generatedRuntimeRow: false,
      visibleInTransferOnlyPlan: false,
      groupedChoiceMax: null,
      visibleCourseCodes: [],
      scheduledVisibleCourseCodes: [],
      representedRuntimeUwOnlyOption: false,
      representedUnselectedRuntimeOption: false,
      nonSchedulableContextualSourceRow: false,
    }),
    "missing-detected-course"
  );
});

test("UWB BBA preserves current prerequisite source and materializes available lower-division rows", () => {
  const basePlan = source.getTransferPlannerStudentRuntimeMajorPlan(
    "uw-bothell-business-administration"
  );
  const pathwayPlan = source.resolveTransferPlannerStudentRuntimeMajorPlan(
    basePlan,
    "finance-option-and-concentration"
  );
  const checklistItems = [
    ...(pathwayPlan?.applicationChecklist ?? []),
    ...(pathwayPlan?.beforeEnrollmentChecklist ?? []),
    ...(pathwayPlan?.stayAtGrcChecklist ?? []),
  ];
  const generatedCourseCodes = new Set(
    [
      ...(pathwayPlan?.grcCourseList ?? []),
      ...checklistItems.flatMap((item) => [
        ...(item.grcCourses ?? []),
        ...((item.alternatives ?? []).flat()),
      ]),
    ].map((courseCode) => String(courseCode).toUpperCase().replace(/\s+/g, " ").trim())
  );

  assert.ok(
    checklistItems.some(
      (item) =>
        item.sourceUrl ===
          "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/finance-option" &&
        item.sourceScope === "generated-course-pool"
    )
  );
  assert.ok(generatedCourseCodes.has("MATH& 148"));
  assert.equal(
    generatedCourseCodes.has("CS 122"),
    false,
    "Expected current BBA prerequisite materialization not to retain stale CS 122 rows."
  );

  const prerequisiteSupportList = (pathwayPlan?.supportLists ?? []).find(
    (supportList) =>
      supportList.sourceUrl ===
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses"
  );
  assert.ok(
    prerequisiteSupportList,
    "Expected the current official BBA prerequisite page to remain attached as support evidence."
  );
  for (const expectedPrerequisiteCode of ["ACCTG 215", "ECON 200", "ENGL 131", "MATH 112"]) {
    assert.ok(
      prerequisiteSupportList.acceptedUwCourseCodes?.includes(expectedPrerequisiteCode),
      `Expected BBA prerequisite support source to include ${expectedPrerequisiteCode}.`
    );
  }
});

test("UW Bioengineering runtime normalization preserves parser-backed source rows", () => {
  const basePlan = source.getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-bioengineering"
  );
  const pathwayPlan = source.resolveTransferPlannerStudentRuntimeMajorPlan(
    basePlan,
    "data-science-option"
  );
  const checklistItems = [
    ...(pathwayPlan?.applicationChecklist ?? []),
    ...(pathwayPlan?.beforeEnrollmentChecklist ?? []),
    ...(pathwayPlan?.stayAtGrcChecklist ?? []),
  ];
  const generatedCourseCodes = new Set(
    [
      ...(pathwayPlan?.grcCourseList ?? []),
      ...checklistItems.flatMap((item) => [
        ...(item.grcCourses ?? []),
        ...((item.alternatives ?? []).flat()),
      ]),
    ].map((courseCode) => String(courseCode).toUpperCase().replace(/\s+/g, " ").trim())
  );

  assert.ok(
    checklistItems.some(
      (item) =>
        item.title === "CSE 121 or 160 plus BIOEN 217" &&
        item.sourceUrl ===
          "https://bioe.uw.edu/academic-programs/undergraduate/undergraduate-degree-requirements/" &&
        item.generatedFromParser === true &&
        (item.grcCourses ?? []).includes("CS 121")
    )
  );
  assert.ok(
    checklistItems.some(
      (item) =>
        item.title === "Approved Engineering Electives (9-12 credits)" &&
        item.sourceUrl ===
          "https://bioe.uw.edu/academic-programs/undergraduate/undergraduate-degree-requirements/" &&
        item.generatedFromParser === true &&
        (item.grcCourses ?? []).includes("ENGR& 214")
    )
  );
  assert.ok(generatedCourseCodes.has("CS 121"));
  assert.ok(generatedCourseCodes.has("CS 122"));
  assert.ok(generatedCourseCodes.has("ENGR& 214"));
});

test("UW Bioengineering excludes graduate navigation labels from undergraduate pathways", () => {
  const sourcePlan = source.getTransferPlannerMajorPlan("uw-seattle-bioengineering");
  const runtimePlan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-bioengineering");
  assert.ok(sourcePlan);
  assert.ok(runtimePlan);

  const pathwayLabels = [
    ...(sourcePlan.pathways ?? []).map((pathway) => pathway.label),
    ...studentRuntime
      .getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan)
      .map((pathway) => pathway.label),
  ];

  assert.ok(
    pathwayLabels.some((label) => /^Data Science Option$/i.test(label)),
    "Expected the undergraduate Bioengineering Data Science option to remain available."
  );
  assert.deepEqual(
    pathwayLabels.filter((label) => /\b(?:ph\.?\s*d\.?|graduate|doctoral)\b/i.test(label)),
    [],
    "Expected Bioengineering pathways to exclude PhD/graduate navigation labels."
  );
});

test("UW Mechanical Engineering excludes course/elective labels from pathways", () => {
  const sourcePlan = source.getTransferPlannerMajorPlan("uw-seattle-mechanical-engineering");
  const runtimePlan = studentRuntime.getTransferPlannerMajorPlan(
    "uw-seattle-mechanical-engineering"
  );
  assert.ok(sourcePlan);
  assert.ok(runtimePlan);

  const pathwayLabels = [
    ...(sourcePlan.pathways ?? []).map((pathway) => pathway.label),
    ...studentRuntime
      .getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan)
      .map((pathway) => pathway.label),
  ];

  assert.deepEqual(
    pathwayLabels.filter((label) => /Special Projects|graded option only/i.test(label)),
    [],
    "Expected Mechanical Engineering pathways not to expose course/elective labels."
  );
});

test("UW Informatics excludes approved elective bucket labels from pathways", () => {
  const sourcePlan = source.getTransferPlannerMajorPlan("uw-seattle-informatics");
  const runtimePlan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-informatics");
  assert.ok(sourcePlan);
  assert.ok(runtimePlan);

  const pathwayLabels = [
    ...(sourcePlan.pathways ?? []).map((pathway) => pathway.label),
    ...studentRuntime
      .getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan)
      .map((pathway) => pathway.label),
  ];

  assert.ok(
    pathwayLabels.some((label) => /^Data Science Option$/i.test(label)),
    "Expected the official Informatics Data Science option to remain available."
  );
  assert.ok(
    pathwayLabels.some((label) => /^Biomedical and Health Informatics Option$/i.test(label)),
    "Expected the official Informatics Biomedical and Health Informatics option to remain available."
  );
  assert.deepEqual(
    pathwayLabels.filter((label) => /^other\b.*\belectives?\s+option\b/i.test(label)),
    [],
    "Expected Informatics pathways to exclude approved elective bucket labels."
  );
});

test("UW MSE NME preserves source-backed known option groups with parsed groups", () => {
  const basePlan = source.getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-materials-science-engineering"
  );
  const pathwayPlan = source.resolveTransferPlannerStudentRuntimeMajorPlan(
    basePlan,
    "nme-option"
  );
  const scientificComputingGroup = (pathwayPlan?.requirementGroups ?? []).find((group) =>
    /Scientific computing/i.test(group.label)
  );

  assert.equal(scientificComputingGroup?.requirementType, "choose_one");
  assert.equal(scientificComputingGroup?.minCourses, 1);
  assert.deepEqual(
    (scientificComputingGroup?.options ?? []).flatMap((option) => option.uwCourses),
    ["AMATH 301", "CSE 142", "CSE 122"]
  );
});

test("Runtime option audit does not infer unselected siblings from other option groups", () => {
  const overlappingGroupItem = {
    id: "programming-admission",
    title: "CSE 122 or CSE 123",
    grcCourses: ["CS 122"],
    minCompletedCount: 1,
    requirementGroup: {
      id: "test-plan:requirement-group:programming-admission",
      label: "CSE 122 or CSE 123",
      requirementType: "choose_one",
      options: [
        {
          id: "test-plan:requirement-option:cse-122",
          optionKind: "course",
          uwCourses: ["CSE 122"],
          grcMatches: ["CS 122"],
          label: "CSE 122",
        },
        {
          id: "test-plan:requirement-option:cse-123",
          optionKind: "course",
          uwCourses: ["CSE 123"],
          grcMatches: ["CS 123"],
          label: "CSE 123",
        },
      ],
    },
    selectedRequirementOptionIds: ["test-plan:requirement-option:cse-122"],
  };
  const plan = {
    id: "test-plan",
    campusId: "uw-seattle",
    applicationChecklist: [overlappingGroupItem],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
  };
  const suggestedPlan = [
    {
      label: "Spring",
      phase: "planned",
      courses: [
        {
          label: "CS 123",
          status: "planned",
          optionGroup: {
            id: "test-plan:requirement-group:advanced-programming",
            selectedOptionIds: ["test-plan:requirement-option:advanced-cs-123"],
            isSelectionPrompt: false,
            options: [
              {
                id: "test-plan:requirement-option:advanced-cs-123",
                label: "CS 123",
                courseCodes: ["CS 123"],
              },
            ],
          },
        },
      ],
    },
  ];

  const row = planner
    .auditRuntimeOptionResolution({
      plan,
      suggestedPlan,
      completedCourses: [],
      selectedRequirementOptionIdsByGroup: {},
    })
    .find((entry) => entry.groupId === "test-plan:requirement-group:programming-admission");

  assert.equal(row?.scheduledOptionIds.includes("test-plan:requirement-option:cse-123"), false);
  assert.equal(row?.issue, "selected-option-not-scheduled");
});

test("STEM prep filtering preserves official compound equivalency components", () => {
  const plan = source.getTransferPlannerMajorPlan("uw-seattle-microbiology");
  const completedCourses = [];
  const suggestedPlan = planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(
      plan.applicationChecklist ?? [],
      completedCourses
    ),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(
      plan.beforeEnrollmentChecklist ?? [],
      completedCourses
    ),
    stayAtGrcStatuses: planner.buildRequirementStatuses(
      plan.stayAtGrcChecklist ?? [],
      completedCourses
    ),
    completedCourses,
    track: source.getTransferPlannerTrack(plan.bestTrackId ?? null),
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {},
  });
  const labels = suggestedPlan.flatMap((quarter) =>
    quarter.courses.map((course) => course.label)
  );

  assert.ok(labels.includes("PHYS& 154"));
  assert.ok(labels.includes("PHYS& 114"));
});

test("STEM prep toggle does not relabel source-backed UW requirements as optional prep", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-bothell-data-visualization-ba");
  assert.ok(plan);
  const completedCourses = [];
  const buildRows = (includeStemPrepCourses) =>
    planner
      .buildSuggestedQuarterPlan({
        plan,
        applicationStatuses: planner.buildRequirementStatuses(
          plan.applicationChecklist ?? [],
          completedCourses
        ),
        beforeEnrollmentStatuses: planner.buildRequirementStatuses(
          plan.beforeEnrollmentChecklist ?? [],
          completedCourses
        ),
        stayAtGrcStatuses: planner.buildRequirementStatuses(
          plan.stayAtGrcChecklist ?? [],
          completedCourses
        ),
        completedCourses,
        track: studentRuntime.getTransferPlannerTrack(plan.bestTrackId ?? null),
        plannerCollegeId: "uw",
        includeStayAtGrcCourses: false,
        includeStemPrepCourses,
        includeSummerQuarter: false,
        referenceDate: new Date("2026-05-06T12:00:00.000Z"),
        selectedRequirementOptionIdsByGroup: {},
      })
      .flatMap((quarter) => quarter.courses);

  const noPrepMath142 = buildRows(false).find((course) => course.label === "MATH& 142");
  const stemPrepMath142 = buildRows(true).find((course) => course.label === "MATH& 142");

  assert.equal(noPrepMath142?.sourceKind, "uw-major-requirement");
  assert.equal(noPrepMath142?.visibilityScope, "visible-grc-completable");
  assert.notEqual(noPrepMath142?.courseRole, "optional_stem_prep");
  assert.equal(stemPrepMath142?.sourceKind, "uw-major-requirement");
  assert.equal(stemPrepMath142?.visibilityScope, "visible-grc-completable");
  assert.notEqual(stemPrepMath142?.courseRole, "optional_stem_prep");
  assert.notEqual(stemPrepMath142?.canTestOut, true);
  assert.doesNotMatch(stemPrepMath142?.guidanceSummary ?? "", /Can be tested out/i);
});

test("Sequence suppression audit allows atoms from the selected compound path", () => {
  const plan = source.getTransferPlannerMajorPlan("uw-seattle-environmental-public-health");
  assert.ok(plan);
  const completedCourses = [];
  const suggestedPlan = planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(
      plan.applicationChecklist ?? [],
      completedCourses
    ),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(
      plan.beforeEnrollmentChecklist ?? [],
      completedCourses
    ),
    stayAtGrcStatuses: planner.buildRequirementStatuses(
      plan.stayAtGrcChecklist ?? [],
      completedCourses
    ),
    completedCourses,
    track: source.getTransferPlannerTrack(plan.bestTrackId ?? null),
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {},
  });
  const chemRows = planner.auditRequiredCoverageSequenceSuppression({
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).filter((row) => /CHEM 142/.test(row.parentChooseOneGroup));
  const compoundAudit = planner.auditCompoundSequenceOptionScheduling({
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => /CHEM 142/.test(row.parentGroupRow));
  const selectedPathAtoms = chemRows.filter((row) => row.selectedPath);

  assert.ok(selectedPathAtoms.length >= 2);
  assert.equal(selectedPathAtoms.every((row) => row.allowedToSchedule), true);
  assert.equal(chemRows.every((row) => row.issue === "none"), true);
  assert.notEqual(compoundAudit?.issue, "placeholder-atom-scheduled");
});

test("Compound sequence audit does not treat normal organic chemistry sequence courses as standalone labs", () => {
  const plan = source.getTransferPlannerMajorPlan("uw-seattle-chemistry");
  assert.ok(plan);
  const completedCourses = [];
  const suggestedPlan = planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(
      plan.applicationChecklist ?? [],
      completedCourses
    ),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(
      plan.beforeEnrollmentChecklist ?? [],
      completedCourses
    ),
    stayAtGrcStatuses: planner.buildRequirementStatuses(
      plan.stayAtGrcChecklist ?? [],
      completedCourses
    ),
    completedCourses,
    track: source.getTransferPlannerTrack(plan.bestTrackId ?? null),
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {},
  });
  const organicAudit = planner.auditCompoundSequenceOptionScheduling({
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => row.parentGroupRow === "Organic Chemistry");

  assert.equal(organicAudit?.scheduledGrcCourses.includes("CHEM& 262"), true);
  assert.notEqual(organicAudit?.issue, "standalone-lab-component-scheduled");
});

test("Runtime option audit ignores local GRC prerequisites when inferring UW option selection", () => {
  const plan = source.getTransferPlannerMajorPlan("uw-tacoma-electrical-engineering");
  assert.ok(plan);
  const completedCourses = [];
  const suggestedPlan = planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(
      plan.applicationChecklist ?? [],
      completedCourses
    ),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(
      plan.beforeEnrollmentChecklist ?? [],
      completedCourses
    ),
    stayAtGrcStatuses: planner.buildRequirementStatuses(
      plan.stayAtGrcChecklist ?? [],
      completedCourses
    ),
    completedCourses,
    track: source.getTransferPlannerTrack(plan.bestTrackId ?? null),
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {},
  });
  const rows = planner.auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  });
  const calculus = rows.find((row) => row.requirementTitle === "Calculus I");
  const physics = rows.find((row) => row.requirementTitle === "Physics I");

  assert.deepEqual(calculus?.scheduledOptionIds, [
    "uw-tacoma-electrical-engineering:requirement-option:math-124",
  ]);
  assert.equal(calculus?.issue, "none");
  assert.deepEqual(physics?.scheduledOptionIds, [
    "uw-tacoma-electrical-engineering:requirement-option:phys-121",
  ]);
  assert.equal(physics?.issue, "none");
});

test("SBSE current-source filter preserves selected physics sequence atoms", () => {
  const plan = source.getTransferPlannerMajorPlan(
    "uw-seattle-sustainable-bioresource-systems-engineering"
  );
  assert.ok(plan);
  const completedCourses = [];
  const suggestedPlan = planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(
      plan.applicationChecklist ?? [],
      completedCourses
    ),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(
      plan.beforeEnrollmentChecklist ?? [],
      completedCourses
    ),
    stayAtGrcStatuses: planner.buildRequirementStatuses(
      plan.stayAtGrcChecklist ?? [],
      completedCourses
    ),
    completedCourses,
    track: source.getTransferPlannerTrack(plan.bestTrackId ?? null),
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {},
  });
  const labels = suggestedPlan.flatMap((quarter) => quarter.courses.map((course) => course.label));
  const physicsOptionRow = planner.auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => row.requirementTitle === "PHYS 121, 122, 123 or PHYS 141, 142, 143");
  const physicsCompoundRow = planner.auditCompoundSequenceOptionScheduling({
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => row.parentGroupRow === "PHYS 121, 122, 123 or PHYS 141, 142, 143");

  assert.ok(labels.includes("PHYS& 223"));
  assert.equal(physicsOptionRow?.issue, "none");
  assert.equal(physicsCompoundRow?.issue, "none");
});

test("SBSE computation elective remains a choose-one prompt instead of required CSE rows", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan(
    "uw-seattle-sustainable-bioresource-systems-engineering"
  );
  assert.ok(plan);

  const computationGroup = (plan.requirementGroups ?? []).find((group) =>
    /^Computation and Data Science elective/i.test(group.label ?? "")
  );
  assert.ok(computationGroup);
  assert.equal(computationGroup.requirementType, "choose_one");
  assert.ok(
    (computationGroup.options ?? []).some((option) => option.label === "CSE 123"),
    "Expected CSE 123 to remain an accepted option."
  );
  assert.ok(
    (computationGroup.options ?? []).some((option) => option.label === "CSE 142"),
    "Expected CSE 142 to remain an accepted option."
  );

  assert.deepEqual(
    (plan.applicationChecklist ?? [])
      .filter((item) => /^auto-cse-(?:123|142)$/.test(item.id ?? ""))
      .map((item) => item.title),
    [],
    "Expected unselected computation elective alternatives not to be auto-promoted into required rows."
  );

  const completedCourses = [];
  const suggestedPlan = planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(
      plan.applicationChecklist ?? [],
      completedCourses
    ),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(
      plan.beforeEnrollmentChecklist ?? [],
      completedCourses
    ),
    stayAtGrcStatuses: planner.buildRequirementStatuses(
      plan.stayAtGrcChecklist ?? [],
      completedCourses
    ),
    completedCourses,
    track: studentRuntime.getTransferPlannerTrack(plan.bestTrackId ?? null),
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {},
  });
  const suggestedRows = suggestedPlan.flatMap((quarter) => quarter.courses);
  assert.deepEqual(
    suggestedRows
      .filter((course) => ["CS 123", "CS& 141"].includes(course.label))
      .map((course) => course.label),
    [],
    "Expected CSE 123/CSE 142 Green River equivalents not to be scheduled until the student selects that option."
  );
  assert.ok(
    suggestedRows.some(
      (course) =>
        course.optionGroup?.id === computationGroup.id &&
        course.optionGroup?.isSelectionPrompt === true
    ),
    "Expected the computation elective to remain visible as a choose-one prompt."
  );
});

test("Runtime option audit suppresses options scheduled for other source-backed requirements", () => {
  const plan = source.getTransferPlannerMajorPlan(
    "uw-seattle-sustainable-bioresource-systems-engineering"
  );
  assert.ok(plan);
  const completedCourses = [];
  const suggestedPlan = planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(
      plan.applicationChecklist ?? [],
      completedCourses
    ),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(
      plan.beforeEnrollmentChecklist ?? [],
      completedCourses
    ),
    stayAtGrcStatuses: planner.buildRequirementStatuses(
      plan.stayAtGrcChecklist ?? [],
      completedCourses
    ),
    completedCourses,
    track: source.getTransferPlannerTrack(plan.bestTrackId ?? null),
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {},
  });
  const statisticsRow = planner.auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) =>
    row.requirementTitle.startsWith("ACCTG 225 or ECON 200 or ECON 311")
  );

  assert.deepEqual(statisticsRow?.scheduledOptionIds, [
    "uw-seattle-sustainable-bioresource-systems-engineering:requirement-option:math-124",
    "uw-seattle-sustainable-bioresource-systems-engineering:requirement-option:math-125",
  ]);
  assert.equal(statisticsRow?.issue, "none");
});

test("Runtime option audit allows unresolved credit bucket remainders", () => {
  const plan = source.getTransferPlannerMajorPlan(
    "uw-seattle-environmental-science-and-terrestrial-resource-management"
  );
  assert.ok(plan);
  const completedCourses = [];
  const suggestedPlan = planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(
      plan.applicationChecklist ?? [],
      completedCourses
    ),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(
      plan.beforeEnrollmentChecklist ?? [],
      completedCourses
    ),
    stayAtGrcStatuses: planner.buildRequirementStatuses(
      plan.stayAtGrcChecklist ?? [],
      completedCourses
    ),
    completedCourses,
    track: source.getTransferPlannerTrack(plan.bestTrackId ?? null),
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {},
  });
  const coreRow = planner.auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => row.requirementTitle.startsWith("Core Courses (22 credits): ESRM 200"));
  const unresolvedRemainder = suggestedPlan
    .flatMap((quarter) => quarter.courses)
    .find((course) => course.sourceRequirementGroupId === coreRow?.groupId);

  assert.equal(unresolvedRemainder?.courseRole, "unresolved-credit-bucket-remainder");
  assert.equal(coreRow?.issue, "none");
});

test("Runtime option audit recognizes complete atomic paths with local-prerequisite atoms", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-computer-science");
  assert.ok(plan);
  const completedCourses = [];
  const suggestedPlan = planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(
      plan.applicationChecklist ?? [],
      completedCourses
    ),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(
      plan.beforeEnrollmentChecklist ?? [],
      completedCourses
    ),
    stayAtGrcStatuses: planner.buildRequirementStatuses(
      plan.stayAtGrcChecklist ?? [],
      completedCourses
    ),
    completedCourses,
    track: source.getTransferPlannerTrack(plan.bestTrackId ?? null),
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {},
  });
  const mathSequenceRow = planner.auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => row.requirementTitle === "MATH 124, 125, 126 or 134, 135, 136 (honors) (15)");

  assert.deepEqual(mathSequenceRow?.scheduledOptionIds, [
    "uw-seattle-computer-science:requirement-option:uw-seattle-computer-science-requirement-group-sequence-choice-math-124-or-math-125-or-math-126-or-math-134-or-math-135-or-math-136-path-math-sequence-math-124-math-125-math-126",
  ]);
  assert.equal(mathSequenceRow?.issue, "none");
});

test("Runtime option audit credits expected options scheduled as local support atoms", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-astronomy");
  assert.ok(plan);
  const completedCourses = [];
  const suggestedPlan = planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(
      plan.applicationChecklist ?? [],
      completedCourses
    ),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(
      plan.beforeEnrollmentChecklist ?? [],
      completedCourses
    ),
    stayAtGrcStatuses: planner.buildRequirementStatuses(
      plan.stayAtGrcChecklist ?? [],
      completedCourses
    ),
    completedCourses,
    track: source.getTransferPlannerTrack(plan.bestTrackId ?? null),
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {},
  });
  const mathRow = planner.auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => row.requirementTitle === "Mathematics 126 or 136");

  assert.deepEqual(mathRow?.scheduledOptionIds, [
    "uw-seattle-astronomy:requirement-option:math-126",
  ]);
  assert.equal(mathRow?.issue, "none");
});

test("Bothell Electrical Engineering generated output preserves official curriculum course coverage", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-bothell-electrical-engineering");
  assert.ok(plan);

  const sourceBlocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-electrical-engineering",
    null
  );
  assert.equal(sourceBlocks.length, 1);
  assert.equal(
    sourceBlocks[0].sourceUrl,
    "https://www.uwb.edu/stem/undergraduate/majors/electrical/curriculum"
  );

  const parsedCodes = new Set(sourceBlocks[0].parsedUwCourseCodes ?? []);
  for (const courseCode of [
    "BEE 200",
    "BEE 233",
    "BEE 381",
    "BEE 417",
    "BEE 425",
    "BEE 427",
    "BENGR 494",
    "BENGR 496",
    "BPHYS 123",
    "CSS 132",
    "CSS 142",
    "CSS 427",
    "STMATH 390",
  ]) {
    assert.ok(parsedCodes.has(courseCode), `Expected parsed source block to include ${courseCode}`);
  }

  const degreeMapCodes = new Set((plan.degreeMapSections ?? []).flatMap((section) => section.items));
  for (const courseCode of [
    "BCHEM 143",
    "BCHEM 144",
    "BEE 200",
    "BEE 215",
    "BEE 233",
    "BEE 235",
    "BEE 271",
    "BEE 331",
    "BEE 332",
    "BEE 341",
    "BEE 361",
    "BEE 381",
    "BEE 417",
    "BEE 425",
    "BEE 427",
    "BEE 433",
    "BEE 436",
    "BEE 437",
    "BEE 440",
    "BEE 442",
    "BEE 445",
    "BEE 447",
    "BEE 450",
    "BEE 451",
    "BEE 454",
    "BEE 455",
    "BEE 457",
    "BEE 477",
    "BEE 478",
    "BEE 482",
    "BEE 484",
    "BEE 486",
    "BEE 490",
    "BEE 498",
    "BEE 499",
    "BENGR 494",
    "BENGR 495",
    "BENGR 496",
    "BPHYS 121",
    "BPHYS 122",
    "BPHYS 123",
    "BWRIT 134",
    "CSS 132",
    "CSS 133",
    "CSS 142",
    "CSS 143",
    "CSS 301",
    "CSS 427",
    "STMATH 124",
    "STMATH 125",
    "STMATH 126",
    "STMATH 207",
    "STMATH 208",
    "STMATH 224",
    "STMATH 390",
  ]) {
    assert.ok(degreeMapCodes.has(courseCode), `Expected generated degree map to include ${courseCode}`);
  }

  const electiveGroup = plan.requirementGroups?.find((group) =>
    /Electrical Engineering Electives/i.test(group.label)
  );
  assert.ok(electiveGroup, "Expected generated runtime to include the B EE elective credit bucket.");
  assert.equal(electiveGroup.requirementType, "choose_credits");
  assert.equal(electiveGroup.minCredits, 15);
  const electiveOptionCodes = new Set(
    (electiveGroup.options ?? []).flatMap((option) => option.uwCourses ?? [])
  );
  for (const courseCode of ["BEE 381", "BEE 490", "CSS 427"]) {
    assert.ok(
      electiveOptionCodes.has(courseCode),
      `Expected B EE elective bucket to include ${courseCode}`
    );
  }
  assert.equal(
    electiveOptionCodes.has("STMATH 124"),
    false,
    "Expected B EE elective bucket not to absorb foundational math rows."
  );
});

test("Bothell Business Administration hides prose-fragment pathways while keeping official options", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-bothell-business-administration");
  assert.ok(plan);

  const pathways = studentRuntime.getTransferPlannerStudentRuntimePathwaysForPlan(plan);
  const pathwayIds = pathways.map((pathway) => pathway.id);
  assert.deepEqual(
    pathwayIds.filter((pathwayId) => /learn-more-about|can-also-be-taken/.test(pathwayId)),
    [],
    "Expected generated Bothell BBA pathways to exclude prose fragments."
  );
  for (const pathwayId of [
    "accounting-option",
    "finance-option-and-concentration",
    "leadership-and-strategic-innovation-option",
    "marketing-option-and-concentration",
    "mis-concentration",
    "supply-chain-management-option",
    "tim-concentration",
  ]) {
    assert.ok(pathwayIds.includes(pathwayId), `Expected official BBA pathway ${pathwayId}`);
  }
});

test("Bothell BBA pathways do not inherit sibling option source courses", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-bothell-business-administration");
  assert.ok(plan);

  const resolvedPlan = studentRuntime.resolveTransferPlannerStudentRuntimeMajorPlan(
    plan,
    "leadership-and-strategic-innovation-option"
  );
  assert.ok(resolvedPlan);

  const degreeMapCourses = new Set(
    (resolvedPlan.degreeMapSections ?? []).flatMap((section) => section.items ?? [])
  );
  for (const expectedCourse of [
    "BBUS 402",
    "BBUS 441",
    "BBUS 461",
    "BBUS 473",
    "BBUS 475",
    "BBUS 491",
  ]) {
    assert.ok(
      degreeMapCourses.has(expectedCourse),
      `Expected LSI source requirements to include ${expectedCourse}.`
    );
  }
  for (const siblingCourse of [
    "BBUS 330",
    "BBUS 361",
    "BBUS 421",
    "BBUS 435",
    "ELCBUS 350",
  ]) {
    assert.equal(
      degreeMapCourses.has(siblingCourse),
      false,
      `Expected LSI source requirements not to inherit sibling option course ${siblingCourse}.`
    );
  }
});

test("Bothell Economics uses the official curriculum page as student-visible source evidence", () => {
  const sourceBlocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-economics"
  );
  assert.ok(sourceBlocks.length, "Expected Bothell Economics parsed source block.");
  assert.equal(
    sourceBlocks[0].sourceUrl,
    "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/curriculum"
  );
  assert.equal(
    sourceBlocks[0].primarySourceUrl,
    "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/curriculum"
  );

  const parsedCodes = new Set(sourceBlocks.flatMap((block) => block.parsedUwCourseCodes ?? []));
  for (const expectedCode of ["BBECN 302", "BBECN 303", "BBECN 382", "BBECN 460", "BBECN 469"]) {
    assert.ok(parsedCodes.has(expectedCode), `Expected Bothell Economics source to include ${expectedCode}.`);
  }
});

test("Student runtime hides source-gap aliases with no schedulable planner content", () => {
  const bothellMajorIds = studentRuntime
    .getTransferPlannerStudentRuntimeMajorsForCampus("uw-bothell")
    .map((plan) => plan.id);

  for (const emptyAliasPlanId of [
    "uw-bothell-chemistry-ba",
    "uw-bothell-chemistry-biochemistry",
  ]) {
    assert.equal(
      bothellMajorIds.includes(emptyAliasPlanId),
      false,
      `Expected ${emptyAliasPlanId} to stay hidden until source/parser support produces planner content.`
    );
    assert.equal(studentRuntime.getTransferPlannerMajorPlan(emptyAliasPlanId), null);
  }

  assert.ok(
    bothellMajorIds.includes("uw-bothell-business-administration"),
    "Expected non-course Bothell BBA parent to remain visible because it owns source-backed pathways."
  );
  assert.ok(
    studentRuntime
      .getTransferPlannerStudentRuntimePathwaysForPlan(
        studentRuntime.getTransferPlannerMajorPlan("uw-bothell-business-administration")
      )
      .some((pathway) => pathway.degreeMapSections?.some((section) => section.items?.length)),
    "Expected Bothell BBA pathways to retain generated planner content."
  );
  const sourceBackedAuditOwnerIds = new Set(
    coverageAudit.buildOwnersForTest().map((owner) => owner.ownerId)
  );
  for (const hiddenSourceGapOwnerId of [
    "uw-bothell-business-administration-finance",
    "uw-bothell-chemistry-bs",
    "uw-seattle-english-language-literature-and-culture",
  ]) {
    assert.equal(
      sourceBackedAuditOwnerIds.has(hiddenSourceGapOwnerId),
      false,
      `Expected hidden source-gap owner ${hiddenSourceGapOwnerId} to stay out of the student-facing source-backed coverage gate.`
    );
  }
  assert.ok(
    sourceBackedAuditOwnerIds.has(
      "uw-bothell-business-administration:pathway:finance-option-and-concentration"
    ),
    "Expected the visible canonical Bothell BBA finance pathway to remain covered."
  );
  assert.ok(
    bothellMajorIds.includes("uw-bothell-electrical-engineering"),
    "Expected source-backed Bothell Electrical Engineering to remain visible."
  );
});

test("Bothell CSSE IAC stays a parent option rather than an incomplete duplicate major", () => {
  const bothellMajorIds = studentRuntime
    .getTransferPlannerStudentRuntimeMajorsForCampus("uw-bothell")
    .map((plan) => plan.id);

  assert.equal(
    bothellMajorIds.includes("uw-bothell-csse-information-assurance-and-cybersecurity"),
    false,
    "Expected the standalone IAC option alias to stay hidden until it has complete own planner rows."
  );

  const parentPlan = studentRuntime.getTransferPlannerMajorPlan("uw-bothell-csse");
  assert.ok(parentPlan);
  const parentPathways = studentRuntime.getTransferPlannerStudentRuntimePathwaysForPlan(parentPlan);
  const iacPathway = parentPathways.find((pathway) => pathway.id === "iac-option");
  assert.ok(iacPathway, "Expected parent CSSE to retain the official IAC option pathway.");
  assert.ok(
    (iacPathway.applicationChecklist?.length ?? 0) +
      (iacPathway.beforeEnrollmentChecklist?.length ?? 0) +
      (iacPathway.stayAtGrcChecklist?.length ?? 0) >
      0,
    "Expected the parent IAC pathway to retain planner content."
  );
});

test("Bothell Physics BS does not expose the sibling BA route", () => {
  const physicsBsPlan = studentRuntime.getTransferPlannerMajorPlan("uw-bothell-physics-bs");
  assert.ok(physicsBsPlan);
  const physicsBsPathways = studentRuntime
    .getTransferPlannerStudentRuntimePathwaysForPlan(physicsBsPlan)
    .map((pathway) => pathway.id);
  assert.equal(
    physicsBsPathways.includes("ba-route"),
    false,
    "Expected the Physics BS plan not to inherit the separate BA route."
  );

  const physicsBaPlan = studentRuntime.getTransferPlannerMajorPlan("uw-bothell-physics-ba");
  assert.ok(physicsBaPlan);
  const physicsBaPathways = studentRuntime
    .getTransferPlannerStudentRuntimePathwaysForPlan(physicsBaPlan)
    .map((pathway) => pathway.id);
  assert.ok(
    physicsBaPathways.includes("ba-route"),
    "Expected the Physics BA plan to keep its matching BA route."
  );
});

test("UW Physics exposes track pathways without course-title option fragments", () => {
  const physicsPlan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-physics");
  assert.ok(physicsPlan);

  const pathwayIds = studentRuntime
    .getTransferPlannerStudentRuntimePathwaysForPlan(physicsPlan)
    .map((pathway) => pathway.id);

  assert.ok(
    pathwayIds.includes("applied-physics-track"),
    "Expected the official Applied Physics track to remain visible."
  );
  assert.ok(
    pathwayIds.includes("comprehensive-track"),
    "Expected the official Comprehensive track to remain visible."
  );
  assert.deepEqual(
    pathwayIds.filter((pathwayId) =>
      /(?:mechanics|calculus|electromagnetism|physics-lab|cognate-electives|topics)-.*option|no-longer-accepting-new-students/i.test(
        pathwayId
      )
    ),
    [],
    "Expected course-title and retired Physics pathway fragments to stay hidden."
  );
});

test("UW Seattle option-family pathway aliases resolve to parsed source-backed pathways", () => {
  const cases = [
    {
      planId: "uw-seattle-construction-management",
      aliasPathwayId: "early-admission-pathway",
    },
    {
      planId: "uw-seattle-construction-management",
      aliasPathwayId: "freshmen-direct-pathway",
    },
    {
      planId: "uw-seattle-construction-management",
      aliasPathwayId: "upper-division-admission-pathway",
    },
    {
      planId: "uw-seattle-geography",
      aliasPathwayId: "ba-option-family:in-geography-data-science",
    },
  ];

  for (const testCase of cases) {
    const plan = studentRuntime.getTransferPlannerMajorPlan(testCase.planId);
    assert.ok(plan, `Expected generated plan ${testCase.planId}`);
    const resolvedPlan = studentRuntime.resolveTransferPlannerMajorPlan(
      plan,
      testCase.aliasPathwayId
    );
    assert.equal(
      resolvedPlan?.selectedPathwayId,
      testCase.aliasPathwayId,
      `Expected ${testCase.aliasPathwayId} to select the matching generated pathway instead of falling back.`
    );
    assert.ok(
      resolvedPlan?.beforeEnrollmentChecklist?.length ||
        resolvedPlan?.applicationChecklist?.length ||
        resolvedPlan?.requirementGroups?.length ||
        resolvedPlan?.grcCourseList?.length,
      `Expected ${testCase.aliasPathwayId} to resolve to planner content.`
    );
    assert.ok(
      studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
        testCase.planId,
        testCase.aliasPathwayId
      ).length > 0,
      `Expected ${testCase.aliasPathwayId} to resolve to parsed source-backed blocks`
    );
  }
});

test("UW Seattle Geography Data Science materializes parsed official source courses into its generated pathway", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-geography");
  assert.ok(plan);

  const resolvedPlan = studentRuntime.resolveTransferPlannerMajorPlan(
    plan,
    "ba-option-family:in-geography-data-science"
  );
  assert.equal(resolvedPlan?.selectedPathwayId, "ba-option-family:in-geography-data-science");

  const parsedBlocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-geography",
    "ba-option-family:in-geography-data-science"
  );
  assert.equal(parsedBlocks.length, 1);
  assert.equal(parsedBlocks[0].pathwayId, "geography-major-data-science-option");

  const degreeMapCodes = new Set(
    (resolvedPlan.degreeMapSections ?? []).flatMap((section) => section.items ?? [])
  );
  for (const sourceCourseCode of ["GEOG 245", "GEOG 258", "CSE 122", "INFO 201"]) {
    assert.ok(
      degreeMapCodes.has(sourceCourseCode),
      `Expected Geography Data Science generated pathway to include ${sourceCourseCode}`
    );
  }
});

test("UW Seattle Classical Studies uses its own official source instead of inheriting Classics rows", () => {
  const sourcePlan = source.getTransferPlannerSourceGeneratedMajorPlan(
    "uw-seattle-classical-studies"
  );
  assert.ok(sourcePlan);

  const sourceUrls = new Set((sourcePlan.officialLinks ?? []).map((link) => link.url));
  assert.ok(
    sourceUrls.has("https://classics.washington.edu/ba-classical-studies"),
    "Expected Classical Studies to expose its own official UW source page."
  );

  const sourceBlocks = source.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-classical-studies"
  );
  assert.equal(sourceBlocks.length, 1);
  assert.equal(
    sourceBlocks[0].primarySourceUrl,
    "https://classics.washington.edu/ba-classical-studies"
  );
  assert.deepEqual(sourceBlocks[0].parsedUwCourseCodes, ["CLAS 495"]);

  const degreeMapCodes = new Set(
    (sourcePlan.degreeMapSections ?? []).flatMap((section) => section.items ?? [])
  );
  assert.ok(
    [...degreeMapCodes].some((item) => /\bCLAS 495\b/.test(item)),
    "Expected Classical Studies degree-map evidence to include CLAS 495 from its own source."
  );
  for (const inheritedClassicsCode of ["LATIN 101", "LATIN 102", "LATIN 103", "LATIN 300", "LATIN 301"]) {
    assert.equal(
      degreeMapCodes.has(inheritedClassicsCode),
      false,
      `Expected Classical Studies not to inherit ${inheritedClassicsCode} from the separate Classics major.`
    );
  }
});

test("UW catalog sibling-major pathways do not inherit parent major requirements", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-international-studies");
  assert.ok(plan);

  const asiaPlan = studentRuntime.resolveTransferPlannerMajorPlan(
    plan,
    "ba-option-family:asia"
  );
  assert.equal(asiaPlan?.selectedPathwayId, "ba-option-family:asia");
  const asiaDegreeMapCodes = new Set(
    (asiaPlan?.degreeMapSections ?? []).flatMap((section) => section.items ?? [])
  );
  for (const expectedAsiaCode of ["JSIS 201", "JSIS 203", "JSISA 207", "HSTAS 201"]) {
    assert.ok(
      asiaDegreeMapCodes.has(expectedAsiaCode),
      `Expected International Studies Asia to include ${expectedAsiaCode}.`
    );
  }
  for (const inheritedOrSiblingCode of [
    "ECON 200",
    "ECON 201",
    "JSIS 495",
    "JSIS 498",
    "RELIG 201",
    "RELIG 202",
  ]) {
    assert.equal(
      asiaDegreeMapCodes.has(inheritedOrSiblingCode),
      false,
      `Expected International Studies Asia not to inherit ${inheritedOrSiblingCode}.`
    );
  }
  assert.equal(
    (asiaPlan?.requirementGroups ?? []).some((group) =>
      /Introductory Courses: 15 credits from JSIS 200.*RELIG 202/i.test(group.label ?? "")
    ),
    false,
    "Expected International Studies Asia not to inherit parent International Studies intro group."
  );

  const canadaPlan = studentRuntime.resolveTransferPlannerMajorPlan(
    plan,
    "ba-option-family:canada"
  );
  assert.equal(canadaPlan?.selectedPathwayId, "ba-option-family:canada");
  const canadaDegreeMapCodes = new Set(
    (canadaPlan?.degreeMapSections ?? []).flatMap((section) => section.items ?? [])
  );
  for (const expectedCanadaCode of [
    "ECON 200",
    "ECON 201",
    "JSIS 200",
    "JSIS 201",
    "JSIS 202",
    "JSISA 356",
    "JSISA 498",
  ]) {
    assert.ok(
      canadaDegreeMapCodes.has(expectedCanadaCode),
      `Expected International Studies Canada to include ${expectedCanadaCode}.`
    );
  }
  for (const inheritedOrSiblingCode of ["JSIS 203", "JSISA 207", "HSTAS 201", "RELIG 201"]) {
    assert.equal(
      canadaDegreeMapCodes.has(inheritedOrSiblingCode),
      false,
      `Expected International Studies Canada not to inherit ${inheritedOrSiblingCode}.`
    );
  }
  assert.equal(
    (canadaPlan?.requirementGroups ?? []).some((group) =>
      /Capstone Experience.*JSIS 495.*JSIS 498/i.test(group.label ?? "")
    ),
    false,
    "Expected International Studies Canada not to inherit parent International Studies capstone group."
  );
});

test("UW Comparative Religion materializes every official semicolon-listed track", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-comparative-religion");
  assert.ok(plan);

  const pathwayIds = studentRuntime
    .getTransferPlannerStudentRuntimePathwaysForPlan(plan)
    .map((pathway) => pathway.id);

  assert.deepEqual(pathwayIds, [
    "religion-and-society-track",
    "history-of-religions-eastern-emphasis-track",
    "history-of-religions-western-emphasis-track",
    "religion-and-symbolic-expression-track",
  ]);
});

test("UW Economics Strategy exposes undergraduate source requirements without graduate courses", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-economics");
  assert.ok(plan);

  const strategyPlan = studentRuntime.resolveTransferPlannerMajorPlan(plan, "strategy");
  assert.equal(strategyPlan?.selectedPathwayId, "bs-option-family:strategy");
  const degreeMapCodes = new Set(
    (strategyPlan?.degreeMapSections ?? []).flatMap((section) => section.items ?? [])
  );
  for (const expectedCode of ["ECON 400", "ECON 482", "ECON 404", "ECON 485"]) {
    assert.ok(
      degreeMapCodes.has(expectedCode),
      `Expected Economics Strategy to include ${expectedCode}.`
    );
  }
  for (const graduateCode of ["ECON 500", "ECON 501", "ECON 580", "ECON 800"]) {
    assert.equal(
      degreeMapCodes.has(graduateCode),
      false,
      `Expected Economics Strategy not to include graduate course ${graduateCode}.`
    );
  }

  const strategyBlocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-economics",
    "strategy"
  );
  assert.ok(strategyBlocks.length > 0);
  const parsedCodes = new Set(strategyBlocks.flatMap((block) => block.parsedUwCourseCodes ?? []));
  assert.ok(parsedCodes.has("ECON 400"));
  assert.ok(parsedCodes.has("ECON 482"));
  assert.equal(parsedCodes.has("ECON 800"), false);
});

test("UW Cinema and Media Studies does not expose sibling Comparative Literature Cinema Studies pathways", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-cinema-and-media-studies");
  assert.ok(plan);
  const pathways = studentRuntime.getTransferPlannerStudentRuntimePathwaysForPlan(plan);
  assert.deepEqual(
    pathways.map((pathway) => pathway.id),
    []
  );
  assert.ok(
    (plan.requirementGroups ?? []).some((group) =>
      /Core courses.*CMS 301.*CMS 480/i.test(group.label ?? "")
    )
  );
});

test("UW Astronomy does not expose recommended capstone guidance as a pathway", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-astronomy");
  assert.ok(plan);

  const pathways = studentRuntime.getTransferPlannerStudentRuntimePathwaysForPlan(plan);
  assert.deepEqual(
    pathways.filter((pathway) => /capstone/i.test(`${pathway.id} ${pathway.label}`)),
    [],
    "Expected the recommended Astronomy capstone sequence not to materialize as a formal pathway."
  );

  const sourcePlan = source.getTransferPlannerSourceGeneratedMajorPlan("uw-seattle-astronomy");
  assert.ok(sourcePlan);
  const sourcePathways = source.getTransferPlannerStudentVisiblePathwaysForPlan(sourcePlan);
  assert.deepEqual(
    sourcePathways.filter((pathway) => /capstone/i.test(`${pathway.id} ${pathway.label}`)),
    [],
    "Expected source-generated student-visible pathways to suppress capstone guidance as well."
  );
});

test("Tacoma Social Welfare preserves elective credits without scheduling degree-total prose", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-tacoma-social-welfare");
  assert.ok(plan);

  const socialWelfareElectiveGroups = (plan.requirementGroups ?? []).filter((group) =>
    /^Ten \(10\) credits of Social Welfare Electives/i.test(group.label ?? "")
  );
  assert.equal(socialWelfareElectiveGroups.length, 1);
  const socialWelfareElectives = socialWelfareElectiveGroups[0];
  assert.equal(socialWelfareElectives.requirementType, "choose_credits");
  assert.equal(socialWelfareElectives.minCredits, 10);
  assert.equal(socialWelfareElectives.maxCredits, 10);
  assert.equal(
    (socialWelfareElectives.options ?? []).some((option) => /TSOCWF 350/i.test(option.label ?? "")),
    true
  );
  assert.deepEqual(
    (plan.requirementGroups ?? [])
      .filter(
        (group) =>
          group.requirementType === "choose_credits" &&
          (group.minCredits === 180 ||
            /bring your total to 180|schedule permitting|sample plan/i.test(
              `${group.label ?? ""} ${group.sourceRowText ?? ""}`
            ))
      )
      .map((group) => group.label),
    []
  );
});

test("Tacoma Communications Research Track keeps its dedicated official source block", () => {
  const blocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-communications",
    "research-track"
  );
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].sourceUrl, "https://www.tacoma.uw.edu/sias/cac/research-track");

  const parsedCodes = new Set(blocks[0].parsedUwCourseCodes ?? []);
  for (const courseCode of ["TWRT 211", "TCOM 101", "TCOM 495", "TLAX 441"]) {
    assert.ok(
      parsedCodes.has(courseCode),
      `Expected Research Track official source block to include ${courseCode}`
    );
  }
});

test("Tacoma Electrical Engineering does not inherit sibling SET option pathways", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-tacoma-electrical-engineering");
  assert.ok(plan);

  const pathways = studentRuntime.getTransferPlannerStudentRuntimePathwaysForPlan(plan);
  const pathwayLabels = pathways.map((pathway) => pathway.label);
  assert.deepEqual(
    pathwayLabels.filter((label) =>
      /(?:Bioinformatics|Cybersecurity|Course)\s+Option/i.test(label)
    ),
    [],
    "Expected Tacoma EE not to expose sibling SET option pathways from the broad catalog page."
  );
});

function collectDegreeMapCourseCodes(plan) {
  return new Set(
    (plan?.degreeMapSections ?? [])
      .flatMap((section) => section.items ?? [])
      .flatMap((item) => String(item).match(/[A-Z]{1,5}\s*\d{3}/g) ?? [])
      .map((courseCode) => courseCode.toUpperCase().replace(/\s+/g, " ").trim())
  );
}

test("Tacoma Sustainable Urban Development pathways retain shared requirements without inheriting sibling option courses", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan(
    "uw-tacoma-sustainable-urban-development"
  );
  assert.ok(plan);

  const communityPlan = studentRuntime.resolveTransferPlannerMajorPlan(
    plan,
    "community-engagement-option"
  );
  const gisPlan = studentRuntime.resolveTransferPlannerMajorPlan(plan, "gis-option");
  assert.ok(communityPlan);
  assert.ok(gisPlan);

  const communityCodes = collectDegreeMapCourseCodes(communityPlan);
  const gisCodes = collectDegreeMapCourseCodes(gisPlan);

  for (const sharedCode of ["TURB 101", "TSUD 222"]) {
    assert.ok(
      communityCodes.has(sharedCode),
      `Expected Community Engagement pathway to retain shared SUD requirement ${sharedCode}.`
    );
    assert.ok(
      gisCodes.has(sharedCode),
      `Expected GIS pathway to retain shared SUD requirement ${sharedCode}.`
    );
  }

  assert.ok(communityCodes.has("TURB 235"));
  assert.equal(communityCodes.has("TGIS 312"), false);
  assert.ok(gisCodes.has("TGIS 312"));
  assert.equal(gisCodes.has("TURB 235"), false);
});

function buildRepresentativeSuggestedPlanCourses(planId, pathwayId = null) {
  const basePlan = studentRuntime.getTransferPlannerMajorPlan(planId);
  assert.ok(basePlan, `Expected generated plan ${planId}`);
  const plan = studentRuntime.resolveTransferPlannerMajorPlan(basePlan, pathwayId);
  assert.ok(plan, `Expected resolved generated plan ${planId}`);
  const suggestedPlan = planner.buildSuggestedQuarterPlan({
    plan,
    plannerCollegeId: "uw",
    applicationStatuses: planner.buildRequirementStatuses(plan.applicationChecklist, []),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(plan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: planner.buildRequirementStatuses(plan.stayAtGrcChecklist, []),
    completedCourses: [],
    track: null,
    includeStayAtGrcCourses: true,
  });

  return suggestedPlan.flatMap((quarter) =>
    quarter.courses.map((course) => ({
      ...course,
      quarterLabel: quarter.label,
    }))
  );
}

function getVisibleSourceBackedGenEdCourses(planId, pathwayId = null) {
  return buildRepresentativeSuggestedPlanCourses(planId, pathwayId).filter(
    (course) =>
      course.sourceKind === "uw-major-breadth" &&
      course.visibilityScope === "visible-grc-completable" &&
      course.isVisibleInGrcQuarterPlan === true &&
      course.isUwOnlyRequirement === false
  );
}

test("UW major plans expose campus general education buckets in actual quarter-plan output", () => {
  const cases = [
    {
      planId: "uw-seattle-bioengineering",
      expectedLabels: [
        /5 credits of Humanities/i,
        /5 credits of Social Science/i,
        /5 credits of Natural Sciences/i,
      ],
    },
    {
      planId: "uw-tacoma-civil-engineering",
      expectedLabels: [
        /5 credits of Humanities/i,
        /5 credits of Social Science/i,
        /5 credits of Natural Sciences/i,
      ],
    },
    {
      planId: "uw-bothell-business-administration",
      pathwayId: "finance-option-and-concentration",
      expectedLabels: [
        /5 credits of Humanities/i,
        /5 credits of Social Science/i,
        /5 credits of Natural Sciences/i,
      ],
    },
  ];

  for (const testCase of cases) {
    const genEdCourses = getVisibleSourceBackedGenEdCourses(
      testCase.planId,
      testCase.pathwayId ?? null
    );
    assert.ok(
      genEdCourses.length > 0,
      `Expected ${testCase.planId} to expose source-backed gen-ed rows in the quarter plan.`
    );
    for (const expectedLabel of testCase.expectedLabels) {
      assert.ok(
        genEdCourses.some((course) => expectedLabel.test(course.label)),
        `Expected ${testCase.planId} quarter plan to include ${expectedLabel}.`
      );
    }
    assert.ok(
      genEdCourses.every((course) => !course.optionGroup && !course.sourceRequirementGroupId),
      `Expected ${testCase.planId} gen-ed placeholders to stay separate from major-specific requirement groups.`
    );
  }
});

test("UW Bothell Electrical Engineering keeps major-specific source rows and campus gen-ed placeholders separate", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-bothell-electrical-engineering");
  assert.ok(plan);
  const courses = buildRepresentativeSuggestedPlanCourses("uw-bothell-electrical-engineering");
  const sourceBackedGenEdRows = courses.filter((course) => course.sourceKind === "uw-major-breadth");
  const majorRequirementRows = courses.filter((course) => course.sourceKind === "uw-major-requirement");

  assert.ok(
    sourceBackedGenEdRows.some((course) => /5 credits of Humanities/i.test(course.label)),
    "Expected campus A&H gen-ed placeholder to be visible."
  );
  assert.ok(
    plan.requirementGroups?.some((group) => /Electrical Engineering Electives/i.test(group.label)),
    "Expected official B-EE elective source group to remain present in generated runtime."
  );
  assert.ok(
    sourceBackedGenEdRows.every((course) => !course.sourceRequirementGroupId),
    "Expected campus gen-ed placeholders not to impersonate major-specific source requirement groups."
  );
  assert.ok(
    majorRequirementRows.every((course) => course.sourceKind !== "uw-major-breadth"),
    "Expected major-specific rows not to be collapsed into campus gen-ed placeholders."
  );
});

test("approved-list placeholders without detected lists do not link to the equivalency guide", () => {
  const getLinkData = suggestedScheduleFormatter.getSchedulePlaceholderRequirementLinkData;

  assert.equal(getLinkData("Additional NSc courses from approved list"), null);
  assert.equal(
    getLinkData("Additional Natural Science courses from department-approved list"),
    null
  );
  assert.equal(
    getLinkData("Additional science courses from University-approved list"),
    null
  );
});

test("real category and program-approved placeholder links still resolve", () => {
  const getLinkData = suggestedScheduleFormatter.getSchedulePlaceholderRequirementLinkData;

  assert.deepEqual(getLinkData("5 credits of Natural Sciences"), {
    kind: "transfer-equivalency",
    tags: ["NSC"],
  });
  assert.deepEqual(getLinkData("45 credits of approved Computer Engineering Natural Science"), {
    kind: "major-source",
  });
});

test("ECE approved Natural Science option prompts point students to the major source", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan(
    "uw-seattle-electrical-computer-engineering"
  );
  assert.ok(plan);

  const optionGroup = {
    id: "test-ece-approved-natural-science",
    title: "45 credits of approved Electrical & Computer Engineering Natural Science",
  };
  const displayTitle = suggestedScheduleFormatter.getSuggestedScheduleOptionGroupDisplayTitle({
    optionGroup,
    titleFallbackAuditRows: [],
    visibleOptionIndex: 1,
    plan,
  });

  assert.equal(
    displayTitle,
    "5 credits of Natural Sciences (Check approved list) This covers 40/40 NSc credits needed for Electrical & Computer Engineering (Embedded Systems Pathway)."
  );
});
