const assert = require("node:assert/strict");
const test = require("node:test");

const sourceBackedCoverageAudit = require("./source-backed-coverage-actionability.cjs");
const coverageAudit = require("./audit-transfer-planner-source-backed-coverage.cjs");
const source = require("../../constants/transfer-planner-source");
const studentRuntime = require("../../constants/transfer-planner-source/student-runtime");
const planner = require("../../services/planning/transfer-planner.service");

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

test("UWB BBA materializes parser-backed lower-division pathway rows", () => {
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
  assert.ok(generatedCourseCodes.has("CS 122"));
  assert.ok(generatedCourseCodes.has("CS& 141"));
  assert.ok(generatedCourseCodes.has("CS 145"));
  assert.ok(generatedCourseCodes.has("MATH& 148"));
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
