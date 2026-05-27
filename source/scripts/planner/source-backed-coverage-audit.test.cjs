const assert = require("node:assert/strict");
const test = require("node:test");

const sourceBackedCoverageAudit = require("./source-backed-coverage-actionability.cjs");
const coverageAudit = require("./audit-transfer-planner-source-backed-coverage.cjs");
const source = require("../../constants/transfer-planner-source");
const studentRuntime = require("../../constants/transfer-planner-source/student-runtime");
const {
  TRANSFER_PLANNER_UW_GRC_ALL_EQUIVALENCY_RULES,
} = require("../../constants/transfer-planner-source/equivalency-guide.generated");
const planner = require("../../services/planning/transfer-planner.service");
const suggestedScheduleFormatter = require("../../components/transfer-planner/transfer-planner-suggested-schedule");

const GUIDE_CATEGORY_ALIASES_BY_TAG = {
  AH: ["A&H", "AH", "Arts and Humanities"],
  SSC: ["SSc", "SSC", "Social Sciences", "Social Science"],
  NSC: ["NSc", "NSC", "Natural Sciences", "Natural Science"],
  QSR: ["QSR", "Quantitative and Symbolic Reasoning"],
  VLPA: ["VLPA", "Visual, Literary, and Performing Arts"],
  DIV: ["DIV", "Diversity"],
  NW: ["NW", "Natural World"],
  IS: ["I&S", "Individuals and Societies"],
  IANDS: ["I&S", "Individuals and Societies"],
};

function normalizeGuideCategoryText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGuideCategoryTag(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function buildGuideBackedTransferCategoryNeedles() {
  const guideTags = new Set(
    TRANSFER_PLANNER_UW_GRC_ALL_EQUIVALENCY_RULES.filter(
      (rule) =>
        rule.sourceSchoolId === "grc" &&
        rule.acceptanceCategory !== "no-credit" &&
        rule.type !== "no-credit"
    )
      .flatMap((rule) => rule.targetRequirementTags ?? [])
      .map(normalizeGuideCategoryTag)
      .filter(Boolean)
  );
  const aliases = new Set();

  for (const tag of guideTags) {
    for (const alias of GUIDE_CATEGORY_ALIASES_BY_TAG[tag] ?? [tag]) {
      const normalizedAlias = normalizeGuideCategoryText(alias);
      if (normalizedAlias) {
        aliases.add(normalizedAlias);
      }
    }
  }

  return aliases;
}

function getTransferCategoryGuidanceTarget(course) {
  const guidance = String(course.guidanceSummary ?? "");
  const carryingMatch = guidance.match(/\bcarrying\s+(.+?)(?:\.|$)/i);
  if (carryingMatch) {
    return carryingMatch[1];
  }
  return course.label;
}

function classifyTransferCategoryGuidanceInternalError(course, guideBackedNeedles) {
  const guidance = String(course.guidanceSummary ?? "");
  if (!/Transfer Category Equivalencies/i.test(guidance)) {
    return null;
  }
  if (/CE-approved Natural Science filter/i.test(guidance)) {
    return null;
  }

  const normalizedTarget = normalizeGuideCategoryText(
    [getTransferCategoryGuidanceTarget(course), course.label].filter(Boolean).join(" ")
  );
  const matchesGuideBackedCategory = Array.from(guideBackedNeedles).some((needle) =>
    normalizedTarget.includes(needle)
  );
  if (matchesGuideBackedCategory) {
    return null;
  }

  return {
    issue: "internal-error",
    reason:
      "Transfer Category Equivalencies guidance is only valid for gen-ed tags present in the parsed UW-GRC equivalency guide.",
    label: course.label,
    guidanceSummary: course.guidanceSummary ?? null,
  };
}

function buildTransferOnlySuggestedCourses(plan) {
  const completedCourses = [];
  return planner
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
      track: source.getTransferPlannerTrack(plan.bestTrackId ?? null),
      plannerCollegeId: "uw",
      includeStayAtGrcCourses: false,
      includeStemPrepCourses: false,
      includeSummerQuarter: false,
      referenceDate: new Date("2026-05-06T12:00:00.000Z"),
      selectedRequirementOptionIdsByGroup: {},
    })
    .flatMap((quarter) => quarter.courses ?? []);
}

test("coverage audit classifies blocking maintainer failures", () => {
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
    {
      name: "invalid transfer-category guidance is an internal planner error",
      row: {
        issue: "internal-error",
        ownerId: "uw-seattle-aeronautics-astronautics",
        requirementTitle: "22 credits of Expand All | Collapse All remaining",
        suspectedLayer: "runtime",
      },
      expectedClass: "internal-planner-error",
      expectedLayer: "runtime",
      expectedFixPath: /transfer-planner\.service\.ts/,
    },
  ];

  for (const testCase of cases) {
    const result = sourceBackedCoverageAudit.buildActionableAuditIssueMetadata(
      testCase.row,
      "unit-test"
    );
    assert.equal(result.blockingGate, sourceBackedCoverageAudit.COVERAGE_GATE_LABEL);
    assert.equal(result.actionableIssueClass, testCase.expectedClass, testCase.name);
    assert.equal(result.suspectedLayer, testCase.expectedLayer, testCase.name);
    assert.match(result.recommendedFixPath, testCase.expectedFixPath, testCase.name);
    assert.ok(result.recommendedNonManualFix.includes("Fix"), testCase.name);
    assert.doesNotMatch(result.recommendedFixPath, /generated-major-plans\.ts/, testCase.name);
  }
});

test("coverage gate counts requirement coverage rows as blocking issues", () => {
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

test("Transfer Category guidance is limited to guide-backed gen-ed categories", () => {
  const guideBackedNeedles = buildGuideBackedTransferCategoryNeedles();
  assert.ok(
    guideBackedNeedles.has(normalizeGuideCategoryText("Arts and Humanities")),
    "Expected the parsed UW-GRC guide to expose A&H as a known transfer category."
  );
  assert.ok(
    guideBackedNeedles.has(normalizeGuideCategoryText("Social Sciences")),
    "Expected the parsed UW-GRC guide to expose SSc as a known transfer category."
  );
  assert.equal(
    classifyTransferCategoryGuidanceInternalError(
      {
        label: "10 credits of Arts and Humanities (A&H)",
        guidanceSummary:
          "Use Transfer Category Equivalencies to find Green River courses carrying A&H.",
      },
      guideBackedNeedles
    ),
    null
  );
  assert.equal(
    classifyTransferCategoryGuidanceInternalError(
      {
        label: "22 credits of Expand All | Collapse All remaining",
        guidanceSummary:
          "Use Transfer Category Equivalencies to find Green River courses approved for this requirement.",
      },
      guideBackedNeedles
    )?.issue,
    "internal-error"
  );

  const focusedPlanIds = [
    "uw-seattle-aeronautics-astronautics",
    "uw-seattle-art",
    "uw-seattle-art-history",
  ];
  const internalErrors = focusedPlanIds.flatMap((planId) => {
    const plan = studentRuntime.getTransferPlannerMajorPlan(planId);
    assert.ok(plan, `Expected focused runtime plan ${planId}.`);
    return buildTransferOnlySuggestedCourses(plan).flatMap((course) => {
      const issue = classifyTransferCategoryGuidanceInternalError(course, guideBackedNeedles);
      return issue ? [{ planId, ...issue }] : [];
    });
  });

  assert.deepEqual(internalErrors, []);
});

test("Detected gen-ed category buckets split into 5-credit Transfer Category placeholders", () => {
  const item = {
    id: "detected-ssc-bucket",
    title: "10 credits of Social Sciences",
    grcCourses: [],
    minCredits: 10,
    maxCredits: 10,
    requirementGroup: {
      id: "detected-ssc-bucket",
      label: "10 credits of Social Sciences",
      category: "general-education",
      requirementType: "choose_credits",
      requirementShape: "credit-bucket",
      satisfactionMode: "credit-based",
      minCredits: 10,
      maxCredits: 10,
      options: [
        {
          id: "detected-ssc-option",
          optionKind: "category-option",
          label: "10 credits of Social Sciences (SSc)",
          grcMatches: [],
          uwCourses: [],
          displayCourseCodes: [],
          categoryOption: {
            category: "SSC",
            sourceCategoryCode: "SSc",
            title: "10 credits of Social Sciences (SSc)",
            credits: 10,
            creditMin: 10,
            creditMax: 10,
            sourceText: "Social Sciences (SSc): 10 credits",
            approvedListKey: null,
            programSpecific: false,
          },
        },
      ],
    },
  };
  const plan = {
    id: "test-detected-gen-ed-category-bucket",
    campusId: "uw-seattle",
    title: "Runtime Option Resolution",
    shortTitle: "Runtime Options",
    coverage: "detailed",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [item],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
  };
  const suggestedPlan = planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(plan.applicationChecklist, []),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(plan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: planner.buildRequirementStatuses(plan.stayAtGrcChecklist, []),
    completedCourses: [],
    track: null,
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {},
  });
  const plannedCourses = suggestedPlan.flatMap((quarter) => quarter.courses ?? []);
  const socialSciencePlaceholders = plannedCourses.filter(
    (course) => course.label === "5 credits of Social Science"
  );

  assert.equal(
    plannedCourses.some((course) => course.label === "10 credits of Social Sciences (SSc)"),
    false
  );
  assert.equal(socialSciencePlaceholders.length, 2);
  assert.deepEqual(
    socialSciencePlaceholders.map((course) => course.creditAmount),
    [5, 5]
  );
  assert.match(
    socialSciencePlaceholders[0]?.guidanceSummary ?? "",
    /This covers 5\/10 SSc credits needed for Runtime Option Resolution\./
  );
  assert.match(
    socialSciencePlaceholders[0]?.guidanceSummary ?? "",
    /Use Transfer Category Equivalencies to find Green River courses carrying SSc\./
  );
  assert.match(
    socialSciencePlaceholders[1]?.guidanceSummary ?? "",
    /This covers 10\/10 SSc credits needed for Runtime Option Resolution\./
  );
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

test("coverage ignores legacy-only guide equivalents", () => {
  assert.deepEqual(
    coverageAudit.getGrcEquivalentsForUwCoursesForTest(["FRENCH 203"]),
    []
  );
  assert.deepEqual(
    coverageAudit.getGrcEquivalentsForUwCoursesForTest(["GERMAN 203"]),
    []
  );
});

test("coverage does not count represented unselected options as over-scheduled", () => {
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

test("coverage accepts a visible selected sibling for choose-one alternatives", () => {
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

test("coverage treats explicit non-counting exploratory elective lists as contextual", () => {
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

test("UW Aquatic Conservation sectioned source groups materialize in student runtime", () => {
  const runtimePlan = source.getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-aquatic-conservation-and-ecology"
  );
  assert.ok(runtimePlan, "Expected the Aquatic Conservation & Ecology runtime plan.");

  const groupCodesByLabel = new Map(
    (runtimePlan.requirementGroups ?? []).map((group) => [
      group.label,
      (group.options ?? []).flatMap((option) => option.uwCourses ?? []),
    ])
  );
  const expectedGroups = new Map([
    ["Biology", ["BIOL 180", "BIOL 200", "BIOL 220"]],
    ["Programming & Data Science", ["CSE 160", "QSCI 256"]],
    ["ACE Core required courses", ["FISH 312", "FISH 323"]],
    ["ACE Core choice", ["FISH 340", "FISH 370"]],
    ["Communicating Science", ["FISH 290", "MARBIO 305"]],
    ["Data Analysis & Modeling", ["FISH 454", "QSCI 483"]],
  ]);

  for (const [label, expectedCodes] of expectedGroups) {
    const actualCodes = groupCodesByLabel.get(label) ?? [];
    assert.deepEqual(
      expectedCodes.filter((courseCode) => !actualCodes.includes(courseCode)),
      [],
      `Expected ${label} to materialize official source courses. Actual: ${actualCodes.join(", ")}`
    );
  }

  const biologyGroup = (runtimePlan.requirementGroups ?? []).find(
    (group) => group.label === "Biology"
  );
  const biologyAltText = JSON.stringify(biologyGroup?.options ?? []);
  assert.match(biologyAltText, /BIOL 220/);
  assert.match(biologyAltText, /FISH 270/);
  assert.equal(biologyGroup?.requirementType, "choose_credits");
  assert.equal(biologyGroup?.minCredits, 15);

  const biologyChecklistItem = (runtimePlan.beforeEnrollmentChecklist ?? []).find(
    (item) => item.requirementGroup?.label === "Biology"
  );
  assert.ok(biologyChecklistItem, "Expected the Biology checklist row to be student-visible.");
  const grcBiologyStatus = planner.buildRequirementStatuses(
    [biologyChecklistItem],
    [
      { code: "BIOL& 211", credits: 5, grade: "4.0", term: "test" },
      { code: "BIOL& 212", credits: 5, grade: "4.0", term: "test" },
      { code: "BIOL& 213", credits: 5, grade: "4.0", term: "test" },
    ]
  )[0];
  assert.equal(grcBiologyStatus.matched, true);
  assert.equal(grcBiologyStatus.completedCredits, 15);
  const uwBiologyStatus = planner.buildRequirementStatuses(
    [biologyChecklistItem],
    [
      { code: "BIOL 180", credits: 5, grade: "4.0", term: "test" },
      { code: "BIOL 200", credits: 5, grade: "4.0", term: "test" },
      { code: "FISH 270", credits: 5, grade: "4.0", term: "test" },
    ]
  )[0];
  assert.equal(uwBiologyStatus.matched, true);
  assert.equal(uwBiologyStatus.completedCredits, 15);

  const aceCoreRequiredGroup = (runtimePlan.requirementGroups ?? []).find(
    (group) => group.label === "ACE Core required courses"
  );
  assert.equal(aceCoreRequiredGroup?.requirementType, "all_required");
  assert.equal(aceCoreRequiredGroup?.requiredCount, 2);
  const aceCoreChoiceGroup = (runtimePlan.requirementGroups ?? []).find(
    (group) => group.label === "ACE Core choice"
  );
  assert.equal(aceCoreChoiceGroup?.requirementType, "choose_credits");
  assert.equal(aceCoreChoiceGroup?.minCredits, 5);
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

test("Bothell Elementary Education excludes graduate concentration and guidance labels from undergraduate pathways", () => {
  const planId = "uw-bothell-educational-studies-elementary-education";
  const sourcePlan = source.getTransferPlannerMajorPlan(planId);
  const runtimePlan = studentRuntime.getTransferPlannerMajorPlan(planId);
  assert.ok(sourcePlan);
  assert.ok(runtimePlan);

  const sourcePathways = source.getTransferPlannerPathwaysForPlan(sourcePlan);
  const runtimePathways = studentRuntime.getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan);
  const pathwayIds = [...sourcePathways, ...runtimePathways].map((pathway) => pathway.id);
  const pathwayLabels = [...sourcePathways, ...runtimePathways].map((pathway) => pathway.label);

  assert.ok(
    pathwayIds.includes("esol-concentration"),
    "Expected the parsed ESOL endorsement pathway to remain available."
  );
  assert.deepEqual(
    pathwayIds.filter((pathwayId) =>
      /^(?:cecl-concentration|lede-concentration|if-adding-dual-endorsement-option)$/.test(
        pathwayId
      )
    ),
    [],
    "Expected graduate concentration and guidance-only pathway ids to stay hidden."
  );
  assert.deepEqual(
    pathwayLabels.filter((label) => /\b(?:CECL|LEDE|If Adding)\b/i.test(label)),
    [],
    "Expected graduate concentration and guidance-only pathway labels to stay hidden."
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

test("UW MSE NME preserves known option groups with parsed groups", () => {
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

test("Runtime option audit respects capped Materials Science NME science electives", () => {
  const basePlan = source.getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-materials-science-engineering"
  );
  const plan = source.resolveTransferPlannerStudentRuntimeMajorPlan(basePlan, "nme-option");
  assert.ok(plan, "Expected the Materials Science NME runtime plan.");

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
    includeStemPrepCourses: true,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const scienceElectivesRow = planner
    .auditRuntimeOptionResolution({
      ownerId: "uw-seattle-materials-science-engineering:pathway:nme-option",
      plan,
      suggestedPlan,
      completedCourses,
    })
    .find(
      (row) =>
        row.groupId ===
        "uw-seattle-materials-science-engineering:requirement-group:science-electives"
    );

  assert.deepEqual(scienceElectivesRow?.scheduledOptionIds, [
    "uw-seattle-materials-science-engineering:requirement-option:science-elective-chem-237",
    "uw-seattle-materials-science-engineering:requirement-option:science-elective-chem-238",
  ]);
  assert.equal(scienceElectivesRow?.issue, "none");
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

test("STEM prep toggle does not relabel UW requirements as optional prep", () => {
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
  }).find((row) => row.requirementTitle === "PHYS 121 and PHYS 122 or PHYS 141 and PHYS 142");
  const physicsCompoundRow = planner.auditCompoundSequenceOptionScheduling({
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => row.parentGroupRow === "PHYS 121 and PHYS 122 or PHYS 141 and PHYS 142");

  assert.ok(labels.includes("PHYS& 222"));
  assert.equal(labels.includes("PHYS& 223"), false);
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

test("Runtime option audit suppresses options scheduled for other requirements", () => {
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
  const optionRows = planner.auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  });
  const physicsSequenceRow = optionRows.find(
    (row) => row.requirementTitle === "PHYS 121 and PHYS 122 or PHYS 141 and PHYS 142"
  );
  const statisticsRows = optionRows.filter((row) =>
    /Statistics|QSCI 381|INDE 315|STAT 390/i.test(row.requirementTitle)
  );

  assert.deepEqual(physicsSequenceRow?.scheduledOptionIds, [
    "uw-seattle-sustainable-bioresource-systems-engineering:requirement-option:uw-seattle-sustainable-bioresource-systems-engineering-sequence-path-phys-121-122",
  ]);
  assert.equal(physicsSequenceRow?.issue, "none");
  assert.ok(statisticsRows.length > 0, "Expected SBSE statistics option rows to be audited.");
  for (const statisticsRow of statisticsRows) {
    assert.deepEqual(statisticsRow.scheduledOptionIds, []);
    assert.equal(statisticsRow.issue, "none");
  }
});

test("Environmental Studies optionless credit bucket does not suppress schedulable analytical-methods default", () => {
  const basePlan = source.getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-environmental-studies"
  );
  const plan = source.resolveTransferPlannerStudentRuntimeMajorPlan(basePlan, null);
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
  const suggestedRows = suggestedPlan.flatMap((quarter) => quarter.courses);
  const broadPlaceholder = suggestedRows.find((course) =>
    /^Integrating Disciplines:/.test(course.label)
  );
  assert.deepEqual(broadPlaceholder?.explicitCourseCodes ?? [], []);
  assert.ok(
    suggestedRows.some(
      (course) =>
        course.label === "MATH& 146" &&
        course.optionGroup?.selectedOptionIds.includes(
          "uw-seattle-environmental-studies:requirement-option:stat-220"
        )
    )
  );

  const analyticalMethodsRow = planner.auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => row.groupId.includes("envir-310-or-esrm-250"));

  assert.deepEqual(analyticalMethodsRow?.scheduledOptionIds, [
    "uw-seattle-environmental-studies:requirement-option:stat-220",
  ]);
  assert.equal(analyticalMethodsRow?.issue, "none");
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
  const runtimeOptionRows = planner.auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  });
  const sustainableForestRow = runtimeOptionRows.find((row) =>
    row.requirementTitle.startsWith("Sustainable Forest Management Courses")
  );
  const unresolvedRemainder = suggestedPlan
    .flatMap((quarter) => quarter.courses)
    .find((course) => course.sourceRequirementGroupId === sustainableForestRow?.groupId);

  assert.equal(unresolvedRemainder?.courseRole, "unresolved-credit-bucket-remainder");
  assert.equal(sustainableForestRow?.issue, "none");
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

test("Runtime option audit credits expected Astronomy mathematics options", () => {
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
  const mathRows = planner.auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  });
  const mathematicsElectivesRow = mathRows.find(
    (row) => row.requirementTitle === "Mathematics Electives"
  );

  assert.deepEqual(mathematicsElectivesRow?.scheduledOptionIds, [
    "uw-seattle-astronomy:requirement-option:mathematics-electives-math-208",
    "uw-seattle-astronomy:requirement-option:mathematics-electives-math-224",
  ]);
  assert.equal(mathematicsElectivesRow?.issue, "none");
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
    /(?:Electrical Engineering Electives|Engineering Elective Credit)/i.test(group.label) &&
    (group.options ?? []).some((option) => (option.uwCourses ?? []).length > 0)
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

test("Student runtime hides empty source-gap aliases without hiding variants", () => {
  const bothellMajorIds = studentRuntime
    .getTransferPlannerStudentRuntimeMajorsForCampus("uw-bothell")
    .map((plan) => plan.id);

  for (const emptyAliasPlanId of ["uw-bothell-chemistry-biochemistry"]) {
    assert.equal(
      bothellMajorIds.includes(emptyAliasPlanId),
      false,
      `Expected ${emptyAliasPlanId} to stay hidden until source/parser support produces planner content.`
    );
    assert.equal(studentRuntime.getTransferPlannerMajorPlan(emptyAliasPlanId), null);
  }

  const chemistryAliasPlanId = "uw-bothell-chemistry-biochemistry";
  const chemistrySourceGap = source.TRANSFER_PLANNER_GAP_REGISTRY.some(
    (entry) => entry.planId === chemistryAliasPlanId
  );
  assert.equal(
    chemistrySourceGap,
    false,
    "Expected the hidden Chemistry: Biochemistry alias to be suppressed because Chemistry BS / Biochemistry option owns the runtime source coverage."
  );

  assert.ok(
    bothellMajorIds.includes("uw-bothell-chemistry-ba"),
    "Expected Bothell Chemistry BA to remain visible."
  );
  assert.ok(studentRuntime.getTransferPlannerMajorPlan("uw-bothell-chemistry-ba"));

  assert.ok(
    bothellMajorIds.includes("uw-bothell-business-administration"),
    "Expected non-course Bothell BBA parent to remain visible because it owns pathways."
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
  assert.ok(
    sourceBackedAuditOwnerIds.has(
      "uw-bothell-business-administration:pathway:finance-option-and-concentration"
    ),
    "Expected the visible canonical Bothell BBA finance pathway to remain covered."
  );
  assert.ok(
    bothellMajorIds.includes("uw-bothell-electrical-engineering"),
    "Expected Bothell Electrical Engineering to remain visible."
  );
});

test("Compact runtime hides Bothell option aliases when parent pathway owns the route", () => {
  const bothellMajorIds = studentRuntime
    .getTransferPlannerStudentRuntimeMajorsForCampus("uw-bothell")
    .map((plan) => plan.id);
  const hiddenAliasPlanIds = [
    "uw-bothell-business-administration-accounting",
    "uw-bothell-business-administration-finance",
    "uw-bothell-business-administration-leadership-and-strategic-innovation",
    "uw-bothell-business-administration-marketing",
    "uw-bothell-business-administration-supply-chain-management",
    "uw-bothell-csse-information-assurance-and-cybersecurity",
  ];

  for (const hiddenAliasPlanId of hiddenAliasPlanIds) {
    assert.equal(
      bothellMajorIds.includes(hiddenAliasPlanId),
      false,
      `Expected ${hiddenAliasPlanId} to be hidden in the compact student runtime.`
    );
    assert.equal(studentRuntime.getTransferPlannerMajorPlan(hiddenAliasPlanId), null);
  }

  const bbaParentPlan = studentRuntime.getTransferPlannerMajorPlan(
    "uw-bothell-business-administration"
  );
  assert.ok(bbaParentPlan);
  const bbaPathwayIds = new Set(
    studentRuntime
      .getTransferPlannerStudentRuntimePathwaysForPlan(bbaParentPlan)
      .map((pathway) => pathway.id)
  );
  for (const expectedPathwayId of [
    "accounting-option",
    "finance-option-and-concentration",
    "leadership-and-strategic-innovation-option",
    "marketing-option-and-concentration",
    "supply-chain-management-option",
  ]) {
    assert.ok(
      bbaPathwayIds.has(expectedPathwayId),
      `Expected parent Bothell BBA pathway ${expectedPathwayId} to remain visible.`
    );
  }

  const csseParentPlan = studentRuntime.getTransferPlannerMajorPlan("uw-bothell-csse");
  assert.ok(csseParentPlan);
  const cssePathwayIds = new Set(
    studentRuntime
      .getTransferPlannerStudentRuntimePathwaysForPlan(csseParentPlan)
      .map((pathway) => pathway.id)
  );
  assert.ok(cssePathwayIds.has("iac-option"), "Expected parent CSSE IAC pathway to remain visible.");
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

test("Tacoma IAS individually designed concentration is modeled as a parent pathway", () => {
  const tacomaMajorIds = studentRuntime
    .getTransferPlannerStudentRuntimeMajorsForCampus("uw-tacoma")
    .map((plan) => plan.id);

  assert.ok(
    tacomaMajorIds.includes("uw-tacoma-interdisciplinary-arts-and-sciences"),
    "Expected the Tacoma IAS parent major to remain visible."
  );
  assert.equal(
    tacomaMajorIds.includes(
      "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed"
    ),
    false,
    "Expected the individually designed concentration alias not to appear as a top-level major."
  );

  const parentPlan = studentRuntime.getTransferPlannerMajorPlan(
    "uw-tacoma-interdisciplinary-arts-and-sciences"
  );
  assert.ok(parentPlan);
  const pathways = studentRuntime.getTransferPlannerStudentRuntimePathwaysForPlan(parentPlan);
  const aliasPathway = pathways.find((pathway) =>
    /individually-designed/i.test(`${pathway.id} ${pathway.label}`)
  );
  assert.ok(aliasPathway, "Expected Tacoma IAS to expose the individually designed pathway.");
  assert.equal(
    pathways.some((pathway) =>
      /important note for students|to fulfill this option/i.test(pathway.label)
    ),
    false,
    "Expected catalog guidance lines not to surface as Tacoma IAS pathways."
  );

  const resolvedAliasPlan = studentRuntime.resolveTransferPlannerMajorPlan(
    parentPlan,
    aliasPathway.id
  );
  assert.equal(resolvedAliasPlan?.selectedPathwayId, aliasPathway.id);
  assert.equal(resolvedAliasPlan?.id, parentPlan.id);
  assert.ok(
    ((resolvedAliasPlan?.degreeMapSections ?? []).flatMap((section) => section.items ?? [])
      .length ?? 0) > 0,
    "Expected the parent pathway to retain planner rows from the alias credential."
  );
  const resolvedAliasContent = JSON.stringify({
    degreeMapSections: resolvedAliasPlan?.degreeMapSections ?? [],
    requirementGroups: resolvedAliasPlan?.requirementGroups ?? [],
  });
  assert.match(
    resolvedAliasContent,
    /TIAS 497|individually-designed/i,
    "Expected the alias pathway content to come from the individually designed credential."
  );
  assert.doesNotMatch(
    resolvedAliasContent,
    /TECON 200|TPSYCH 101|THIST 379/,
    "Expected the alias pathway not to inherit sibling Social Sciences credential courses."
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

test("UW Seattle option-family pathway aliases resolve to parsed pathways", () => {
  const cases = [
    {
      planId: "uw-seattle-construction-management",
      aliasPathwayId: "early-admission-pathway",
      expectedSelectedPathwayId: "early-admission-pathway",
    },
    {
      planId: "uw-seattle-construction-management",
      aliasPathwayId: "freshmen-direct-pathway",
      expectedSelectedPathwayId: "freshmen-direct-pathway",
    },
    {
      planId: "uw-seattle-construction-management",
      aliasPathwayId: "upper-division-admission-pathway",
      expectedSelectedPathwayId: "upper-division-admission-pathway",
    },
    {
      planId: "uw-seattle-geography",
      aliasPathwayId: "ba-option-family:in-geography-data-science",
      expectedSelectedPathwayId: "geography-major-data-science-option",
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
      testCase.expectedSelectedPathwayId,
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
      `Expected ${testCase.aliasPathwayId} to resolve to parsed blocks`
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
  assert.equal(resolvedPlan?.selectedPathwayId, "geography-major-data-science-option");

  const parsedBlocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-geography",
    "ba-option-family:in-geography-data-science"
  );
  assert.equal(parsedBlocks.length, 1);
  assert.equal(parsedBlocks[0].pathwayId, "geography-major-data-science-option");

  const degreeMapCodes = new Set(
    (resolvedPlan.degreeMapSections ?? []).flatMap((section) => section.items ?? [])
  );
  for (const sourceCourseCode of ["GEOG 360", "CSE 122", "INFO 371", "QSCI 482"]) {
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

  assert.deepEqual(pathwayIds.sort(), [
    "history-of-religions-eastern-emphasis-track",
    "history-of-religions-western-emphasis-track",
    "religion-and-society-track",
    "religion-and-symbolic-expression-track",
  ].sort());
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

test("UW Anthropology undergraduate source requirements exclude graduate catalog sections", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-anthropology");
  assert.ok(plan);

  const blocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-anthropology"
  );
  assert.ok(blocks.length > 0);

  const baseBlocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-anthropology",
    null
  );
  assert.ok(baseBlocks.length > 0);

  const parsedCodes = new Set(blocks.flatMap((block) => block.parsedUwCourseCodes ?? []));
  assert.ok(parsedCodes.has("BIOA 201"));
  assert.ok(parsedCodes.has("ARCHY 495"));
  for (const graduateCode of [
    "ANTH 550",
    "ANTH 551",
    "ANTH 565",
    "ANTH 566",
    "ANTH 567",
    "ANTH 700",
    "ARCHY 510",
    "ARCHY 599",
    "BIOA 525",
  ]) {
    assert.equal(
      parsedCodes.has(graduateCode),
      false,
      `Expected Anthropology undergraduate source parsing not to include ${graduateCode}.`
    );
  }

  const runtimeText = JSON.stringify(plan.requirementGroups ?? []);
  for (const graduateCode of ["ANTH 550", "ANTH 565", "ARCHY 510", "BIOA 525"]) {
    assert.equal(
      runtimeText.includes(graduateCode),
      false,
      `Expected Anthropology student runtime requirements not to display ${graduateCode}.`
    );
  }

  const baseRequirementText = JSON.stringify(
    baseBlocks.flatMap((block) => block.parsedRequirementGroups ?? [])
  );
  assert.doesNotMatch(baseRequirementText, /ANTH 550|ANTH 565|ARCHY 510|BIOA 525/i);

  const getPathwayRequirementText = (pathwayId) =>
    JSON.stringify(
      studentRuntime
        .getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-anthropology", pathwayId)
        .flatMap((block) => block.parsedRequirementGroups ?? [])
    );

  const globalizationRequirementText = getPathwayRequirementText(
    "ba-option-family:anthropology-of-globalization"
  );
  assert.match(globalizationRequirementText, /Anthropology of Globalization option/i);
  assert.doesNotMatch(globalizationRequirementText, /Human Evolutionary Biology option/i);
  assert.doesNotMatch(globalizationRequirementText, /Indigenous Archaeology \(IA\) core/i);
  assert.doesNotMatch(globalizationRequirementText, /MAGH list/i);

  const hebRequirementText = getPathwayRequirementText(
    "ba-option-family:human-evolutionary-biology"
  );
  assert.match(hebRequirementText, /Human Evolutionary Biology option/i);
  assert.match(hebRequirementText, /BIOA 351/i);
  assert.match(hebRequirementText, /BIOA 355/i);
  assert.doesNotMatch(hebRequirementText, /Anthropology of Globalization option/i);
  assert.doesNotMatch(hebRequirementText, /Indigenous Archaeology \(IA\) core/i);

  const bsHebRequirementText = getPathwayRequirementText(
    "bs-option-family:human-evolutionary-biology"
  );
  const bsHebRuntimeText = JSON.stringify(
    source.getTransferPlannerStudentRuntimeMajorPlan(
      "uw-seattle-anthropology",
      "bs-option-family:human-evolutionary-biology"
    )?.requirementGroups ?? []
  );
  assert.match(bsHebRuntimeText, /minimum 35 credits from approved HEB course list/i);
  assert.doesNotMatch(bsHebRequirementText, /Anthropology of Globalization option/i);
  assert.doesNotMatch(bsHebRequirementText, /Indigenous Archaeology \(IA\) core/i);

  const indigenousArchaeologyRequirementText = getPathwayRequirementText(
    "ba-option-family:indigenous-archaeology"
  );
  assert.match(indigenousArchaeologyRequirementText, /Indigenous Archaeology \(IA\) core/i);
  assert.doesNotMatch(indigenousArchaeologyRequirementText, /Anthropology of Globalization option/i);
  assert.doesNotMatch(indigenousArchaeologyRequirementText, /Human Evolutionary Biology option/i);
});

test("UW Applied Mathematics inline source requirements materialize beyond the calculus sequence", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-applied-mathematics");
  assert.ok(plan);

  const blocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-applied-mathematics"
  );
  assert.ok(blocks.length > 0);
  const parsedGroups = blocks.flatMap((block) => block.parsedRequirementGroups ?? []);
  const computingGroup = parsedGroups.find((group) => /^Computing$/i.test(group.label ?? ""));
  const introGroup = parsedGroups.find((group) =>
    /^Introductory Applied Mathematics$/i.test(group.label ?? "")
  );
  const methodsGroup = parsedGroups.find((group) =>
    /^Methods of Applied Mathematics$/i.test(group.label ?? "")
  );

  assert.equal(computingGroup?.requirementType, "all_required");
  assert.deepEqual(
    computingGroup?.options.flatMap((option) => option.uwCourses),
    ["AMATH 301"]
  );
  assert.equal(introGroup?.requirementType, "all_required");
  assert.deepEqual(
    introGroup?.options.flatMap((option) => option.uwCourses),
    ["AMATH 351", "AMATH 352", "AMATH 353"]
  );
  assert.equal(methodsGroup?.requirementType, "choose_n");
  assert.equal(methodsGroup?.requiredCount, 2);
  assert.deepEqual(
    methodsGroup?.options.flatMap((option) => option.uwCourses),
    ["AMATH 401", "AMATH 402", "AMATH 403"]
  );

  const runtimeText = JSON.stringify(plan.requirementGroups ?? []);
  for (const courseCode of ["AMATH 301", "AMATH 351", "AMATH 352", "AMATH 353", "AMATH 401"]) {
    assert.ok(
      runtimeText.includes(courseCode),
      `Expected Applied Mathematics student runtime requirements to display ${courseCode}.`
    );
  }

  const dataScienceBlocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-applied-mathematics",
    "bs-option-family:data-science"
  );
  const dataScienceGroups = dataScienceBlocks.flatMap((block) => block.parsedRequirementGroups ?? []);
  const computingAndDataSciencesGroup = dataScienceGroups.find((group) =>
    /^Computing and Data Sciences$/i.test(group.label ?? "")
  );
  const computingAndDataSciencesCourses =
    computingAndDataSciencesGroup?.options.flatMap((option) => option.uwCourses) ?? [];
  assert.equal(computingAndDataSciencesGroup?.requirementType, "choose_n");
  assert.equal(computingAndDataSciencesGroup?.requiredCount, 2);
  for (const courseCode of ["AMATH 483", "CFRM 410", "CFRM 420"]) {
    assert.ok(
      computingAndDataSciencesCourses.includes(courseCode),
      `Expected Applied Mathematics Data Science computing pool to include ${courseCode}.`
    );
  }

  const dataSciencePlan = studentRuntime.resolveTransferPlannerMajorPlan(
    plan,
    "bs-option-family:data-science"
  );
  const dataScienceRuntimeText = JSON.stringify(dataSciencePlan?.requirementGroups ?? []);
  for (const courseCode of ["AMATH 483", "CFRM 410", "CFRM 420"]) {
    assert.ok(
      dataScienceRuntimeText.includes(courseCode),
      `Expected Applied Mathematics Data Science runtime requirements to display ${courseCode}.`
    );
  }
  const dataScienceRuntimeComputingGroup = (dataSciencePlan?.requirementGroups ?? []).find((group) =>
    /^Computing and Data Sciences$/i.test(group.label ?? "")
  );
  assert.equal(dataScienceRuntimeComputingGroup?.requirementType, "choose_n");
});

test("UW American Ethnic Studies materializes official core courses and selected concentration pools", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-american-ethnic-studies");
  assert.ok(plan);

  const rootBlocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-american-ethnic-studies",
    null
  );
  const rootGroups = rootBlocks.flatMap((block) => block.parsedRequirementGroups ?? []);
  const coreGroup = rootGroups.find((group) => /^Core Courses$/i.test(group.label ?? ""));
  assert.equal(coreGroup?.requirementType, "choose_credits");
  assert.equal(coreGroup?.minCredits, 30);
  assert.equal(coreGroup?.maxCredits, 30);
  assert.deepEqual(
    coreGroup?.options.flatMap((option) => option.uwCourses),
    ["AAS 101", "AFRAM 101", "CHSTU 101", "AES 150", "AES 151", "AES 212"]
  );

  const africanBlocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-american-ethnic-studies",
    "african-american-studies-concentration"
  );
  const africanGroups = africanBlocks.flatMap((block) => block.parsedRequirementGroups ?? []);
  const africanConcentrationGroup = africanGroups.find((group) =>
    /^African American Studies$/i.test(group.label ?? "")
  );
  const africanCodes =
    africanConcentrationGroup?.options.flatMap((option) => option.uwCourses) ?? [];

  assert.equal(africanConcentrationGroup?.requirementType, "choose_credits");
  assert.equal(africanConcentrationGroup?.minCredits, 25);
  assert.equal(africanConcentrationGroup?.maxCredits, 25);
  assert.ok(africanCodes.includes("AFRAM 150"));
  assert.ok(africanCodes.includes("AFRAM 214"));
  assert.ok(africanCodes.includes("AFRAM 370"));
  assert.equal(africanCodes.includes("AAS 220"), false);
  assert.equal(africanCodes.includes("CHSTU 330"), false);

  const normalizeAesLabel = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const concentrationExpectations = [
    {
      pathwayId: "african-american-studies-concentration",
      label: "African American Studies",
      expectedCodes: ["AFRAM 150", "AFRAM 214", "AFRAM 370"],
      rejectedCodes: ["AAS 220", "CHSTU 330", "AES 250"],
    },
    {
      pathwayId: "asian-american-pia-studies-concentration",
      label: "Asian American/PIA Studies",
      expectedCodes: ["AAS 206", "AAS 220"],
      rejectedCodes: ["AFRAM 150", "CHSTU 330", "AES 250"],
    },
    {
      pathwayId: "chicano-a-studies-concentration",
      label: "Chicano/a Studies",
      expectedCodes: ["CHSTU 200", "CHSTU 330", "CHSTU 356"],
      rejectedCodes: ["AFRAM 150", "AAS 220", "AES 250"],
    },
    {
      pathwayId: "comparative-american-ethnic-studies-concentration",
      label: "Comparative American Ethnic Studies",
      expectedCodes: ["AES 250", "AES 322", "AES 487"],
      rejectedCodes: ["AFRAM 150", "AAS 220", "CHSTU 330", "AES 496"],
    },
  ];

  for (const expectation of concentrationExpectations) {
    const pathwayBlocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
      "uw-seattle-american-ethnic-studies",
      expectation.pathwayId
    );
    const pathwayGroups = pathwayBlocks.flatMap((block) => block.parsedRequirementGroups ?? []);
    const group = pathwayGroups.find(
      (candidate) => normalizeAesLabel(candidate.label) === normalizeAesLabel(expectation.label)
    );
    const codes = group?.options.flatMap((option) => option.uwCourses) ?? [];
    assert.equal(group?.requirementType, "choose_credits", expectation.label);
    assert.equal(group?.minCredits, 25, expectation.label);
    assert.equal(group?.maxCredits, 25, expectation.label);
    for (const courseCode of expectation.expectedCodes) {
      assert.ok(codes.includes(courseCode), `Expected ${expectation.label} to include ${courseCode}.`);
    }
    for (const courseCode of expectation.rejectedCodes) {
      assert.equal(
        codes.includes(courseCode),
        false,
        `Expected ${expectation.label} not to include sibling or honors course ${courseCode}.`
      );
    }

    const resolvedPathwayPlan = studentRuntime.resolveTransferPlannerMajorPlan(
      plan,
      expectation.pathwayId
    );
    const resolvedGroup = (resolvedPathwayPlan?.requirementGroups ?? []).find(
      (candidate) => normalizeAesLabel(candidate.label) === normalizeAesLabel(expectation.label)
    );
    assert.ok(resolvedGroup, `Expected runtime pathway to expose ${expectation.label}.`);
    assert.equal(
      (resolvedPathwayPlan?.requirementGroups ?? []).some((candidate) =>
        /\binterdisciplinarity\b|\boverlapping\b|\btransnational communities\b/i.test(
          candidate.label ?? ""
        )
      ),
      false,
      `Expected ${expectation.label} pathway not to expose descriptive prose as a requirement group.`
    );
  }

  const resolvedAfricanPlan = studentRuntime.resolveTransferPlannerMajorPlan(
    plan,
    "african-american-studies-concentration"
  );
  const runtimeText = JSON.stringify(resolvedAfricanPlan?.requirementGroups ?? []);
  for (const courseCode of ["AAS 101", "AFRAM 101", "AES 212", "AFRAM 214", "AFRAM 370"]) {
    assert.ok(
      runtimeText.includes(courseCode),
      `Expected American Ethnic Studies runtime requirements to display ${courseCode}.`
    );
  }
  assert.equal(
    runtimeText.includes("ENGL 131"),
    false,
    "Expected AES requirement groups not to promote recommended composition prose."
  );

  const staleManualTitles = [
    "Ethnic studies and related social-science foundation",
    "History and humanities support for concentration work",
    "Writing-heavy humanities support",
  ];
  const staleManualCourses = ["AMES 100", "HUMAN 100", "ENGL& 101"];
  for (const pathwayId of [null, ...concentrationExpectations.map((entry) => entry.pathwayId)]) {
    const resolvedPlan = pathwayId
      ? studentRuntime.resolveTransferPlannerMajorPlan(plan, pathwayId)
      : plan;
    const visibleItems = [
      ...(resolvedPlan?.applicationChecklist ?? []),
      ...(resolvedPlan?.beforeEnrollmentChecklist ?? []),
      ...(resolvedPlan?.stayAtGrcChecklist ?? []),
    ];
    for (const item of visibleItems) {
      assert.equal(
        item.manualOverride === true,
        false,
        `Expected AES ${pathwayId ?? "base"} not to expose manual checklist item ${item.title}.`
      );
      assert.equal(
        staleManualTitles.includes(item.title),
        false,
        `Expected AES ${pathwayId ?? "base"} not to expose stale manual title ${item.title}.`
      );
      const visibleCourses = item.grcCourses ?? [];
      for (const courseCode of staleManualCourses) {
        assert.equal(
          visibleCourses.includes(courseCode),
          false,
          `Expected AES ${pathwayId ?? "base"} not to expose stale manual course ${courseCode}.`
        );
      }
    }
  }
});

test("UW American Indian Studies preserves all concentration-course sections", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-american-indian-studies");
  assert.ok(plan);

  const blocks = studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-american-indian-studies",
    "ba-route"
  );
  const groups = blocks.flatMap((block) => block.parsedRequirementGroups ?? []);
  const resolvedPlan = studentRuntime.resolveTransferPlannerMajorPlan(plan, "ba-route");
  assert.ok(resolvedPlan);
  const concentrationExpectations = [
    {
      label: "Governance Concentration Courses",
      expectedCodes: ["AIS 212", "AIS 230", "AIS 492"],
      rejectedCodes: ["AIS 306", "AIS 309"],
    },
    {
      label: "Environment and Health Concentration Courses",
      expectedCodes: ["AIS 306", "AIS 307", "AIS 451"],
      rejectedCodes: ["AIS 212", "AIS 309"],
    },
    {
      label: "Culture and History Concentration Courses",
      expectedCodes: ["AIS 215", "AIS 309", "AIS 443"],
      rejectedCodes: ["AIS 212", "AIS 306"],
    },
  ];

  for (const expectation of concentrationExpectations) {
    const group = groups.find((candidate) => candidate.label === expectation.label);
    const codes = group?.options.flatMap((option) => option.uwCourses) ?? [];
    assert.equal(group?.requirementType, "choose_credits", expectation.label);
    assert.equal(group?.minCredits, 5, expectation.label);
    assert.equal(group?.maxCredits, null, expectation.label);
    for (const courseCode of expectation.expectedCodes) {
      assert.ok(codes.includes(courseCode), `Expected ${expectation.label} to include ${courseCode}.`);
    }
    for (const courseCode of expectation.rejectedCodes) {
      assert.equal(
        codes.includes(courseCode),
        false,
        `Expected ${expectation.label} not to include sibling concentration course ${courseCode}.`
      );
    }
  }

  const runtimeText = JSON.stringify(resolvedPlan.requirementGroups ?? []);
  for (const label of concentrationExpectations.map((entry) => entry.label)) {
    assert.ok(runtimeText.includes(label), `Expected AIS runtime requirements to display ${label}.`);
  }

  const parsedCodes = new Set(blocks.flatMap((block) => block.parsedUwCourseCodes ?? []));
  for (const graduateCode of ["AIS 552", "AIS 570", "AIS 592"]) {
    assert.equal(
      parsedCodes.has(graduateCode),
      false,
      `Expected AIS undergraduate source parsing not to include graduate course ${graduateCode}.`
    );
    assert.equal(
      runtimeText.includes(graduateCode),
      false,
      `Expected AIS runtime requirements not to display graduate course ${graduateCode}.`
    );
  }
});

test("UW Cinema and Media Studies does not expose sibling Comparative Literature Cinema Studies pathways", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-cinema-and-media-studies");
  assert.ok(plan);
  const pathways = studentRuntime.getTransferPlannerStudentRuntimePathwaysForPlan(plan);
  assert.deepEqual(
    pathways.filter((pathway) =>
      /comparative literature|c lit|comparative-literature/i.test(`${pathway.id} ${pathway.label}`)
    ),
    []
  );
  const resolvedPlan = studentRuntime.resolveTransferPlannerStudentRuntimeMajorPlan(
    plan,
    "ba-route"
  );
  assert.ok(
    (resolvedPlan?.requirementGroups ?? []).some((group) =>
      /^CMS course:.*CMS 310.*CMS 321/i.test(group.label ?? "")
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

test("Tacoma Communication keeps concise student-facing pathway labels", () => {
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-tacoma-communications");
  assert.ok(plan);
  assert.equal(plan.title, "Communication (BA)");
  assert.equal(plan.shortTitle, "Communication");

  const pathwayLabelsById = studentRuntime
    .getTransferPlannerStudentRuntimePathwaysForPlan(plan)
    .map((pathway) => [pathway.id, pathway.label])
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));

  assert.deepEqual(pathwayLabelsById, [
    ["professional-track", "Professional Track"],
    ["research-track", "Research Track"],
  ]);
  assert.deepEqual(
    pathwayLabelsById.filter(([, label]) => /Communications\s*\(BA\)/i.test(label)),
    []
  );
});

test("Tacoma History canonicalizes retired option labels to current student-visible pathways", () => {
  const expectedPathwayIds = [
    "arts-culture-and-society-option",
    "general-history-option",
    "global-history-option",
    "labor-and-social-movements-option",
    "power-gender-and-identity-option",
  ];
  const forbiddenPathwayIds = ["culture-and-society-option", "gender-and-identity-option"];

  const sourcePlan = source.getTransferPlannerMajorPlan("uw-tacoma-history");
  const runtimePlan = studentRuntime.getTransferPlannerMajorPlan("uw-tacoma-history");
  assert.ok(sourcePlan, "Expected Tacoma History source-generated plan.");
  assert.ok(runtimePlan, "Expected Tacoma History compact runtime plan.");

  const sourcePathwayIds = source
    .getTransferPlannerPathwaysForPlan(sourcePlan)
    .map((pathway) => pathway.id)
    .sort();
  const runtimePathwayIds = studentRuntime
    .getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan)
    .map((pathway) => pathway.id)
    .sort();

  assert.deepEqual(sourcePathwayIds, expectedPathwayIds);
  assert.deepEqual(runtimePathwayIds, expectedPathwayIds);
  assert.deepEqual(
    sourcePathwayIds.filter((pathwayId) => forbiddenPathwayIds.includes(pathwayId)),
    []
  );
  assert.deepEqual(
    runtimePathwayIds.filter((pathwayId) => forbiddenPathwayIds.includes(pathwayId)),
    []
  );
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
      `Expected ${testCase.planId} to expose gen-ed rows in the quarter plan.`
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
    plan.requirementGroups?.some((group) =>
      /(?:Electrical Engineering Electives|Engineering Elective Credit)/i.test(group.label)
    ),
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
