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

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildChecklistChoiceLabel,
  getRequirementOptionSelectionCountForSuggestedOptions,
  getPlannerSelectedRequirementOptionIds,
  getPlannerUserUnselectedRequirementOptionIds,
  hasExplicitPlannerSelectedRequirementOptionIds,
} = require("@/services/planning/transfer-planner/option-selection");
const {
  markUserUnselectedRequirementOptionId,
} = require("@/services/planning/transfer-planner/requirement-status");
const {
  buildTransferPlannerStudentEvaluationReport,
} = require("@/services/planning/transfer-planner/student-evaluation-report");
const {
  attachSelectedCategoryTranscriptSatisfactionToPlan,
} = require("@/services/planning/transfer-planner/transcript-satisfaction");
const {
  buildTransferPlannerCoursePlanningGraph,
  courseHasSatisfiedCorequisites,
  courseHasSatisfiedPrerequisites,
  getCoursePlanningGraphRequirementMap,
} = require("@/services/planning/transfer-planner/course-planning-graph");
const {
  buildQuarterSlotsAfterCurrent,
} = require("@/services/planning/transfer-planner/quarter-slots");
const {
  getCategoryOptionAuditDescriptor,
  getEvaluationTargetRequirementTags,
  getGuideBackedTransferCategoryOptionDescriptor,
  getSubsetMatchCompanionCourseCodes,
} = require("@/services/planning/transfer-planner/transfer-guidance");
const {
  GENERAL_ED_PLACEHOLDER_CREDITS,
  buildGeneralEducationPlaceholder,
  buildSingleCategoryGeneralEducationRequirementTargets,
  createEmptyGeneralEducationRequirementTargets,
  hasGeneralEducationRequirementTargets,
  isChoiceBackedGeneralEducationPlaceholderLabel,
  mergeGeneralEducationRequirementTargets,
} = require("@/services/planning/transfer-planner/general-education");

test("planner option selection reads explicit group selections without leaking generated defaults", () => {
  const item = {
    id: "requirement-one",
    selectedRequirementOptionIds: ["default-a"],
    requirementGroup: {
      id: "requirement-group-one",
    },
  };

  assert.equal(hasExplicitPlannerSelectedRequirementOptionIds(item, {}), false);
  assert.deepEqual(getPlannerSelectedRequirementOptionIds(item, {}), ["default-a"]);

  const explicitSelection = {
    "requirement-group-one": ["student-a", markUserUnselectedRequirementOptionId("default-a")],
  };
  assert.equal(
    hasExplicitPlannerSelectedRequirementOptionIds(item, explicitSelection),
    true
  );
  assert.deepEqual(
    getPlannerSelectedRequirementOptionIds(item, explicitSelection),
    ["student-a"]
  );
  assert.deepEqual(
    getPlannerUserUnselectedRequirementOptionIds(item, explicitSelection),
    ["default-a"]
  );
});

test("planner option selection treats an explicit empty legacy item key as student intent", () => {
  const item = {
    id: "requirement-two",
    selectedRequirementOptionIds: ["default-b"],
    requirementGroup: {
      id: "requirement-group-two",
    },
  };

  const explicitEmptySelection = {
    "requirement-two": [],
  };

  assert.equal(
    hasExplicitPlannerSelectedRequirementOptionIds(item, explicitEmptySelection),
    true
  );
  assert.deepEqual(
    getPlannerSelectedRequirementOptionIds(item, explicitEmptySelection),
    []
  );
});

test("planner option helpers keep choice labels and credit counts outside runtime", () => {
  const item = {
    id: "credit-bucket",
    title: "approved science electives",
    minCredits: 10,
    requirementGroup: {
      id: "credit-bucket-group",
      requirementType: "choose_credits",
      minCredits: 10,
      options: [{}, {}, {}],
    },
  };

  assert.equal(
    buildChecklistChoiceLabel(item, 2, 1),
    "Choose at least 10 credits from approved science electives"
  );
  assert.equal(
    getRequirementOptionSelectionCountForSuggestedOptions(item, [
      { creditMax: 5 },
      { creditMax: 5 },
      { creditMax: 3 },
    ]),
    2
  );
});

test("transfer guidance helpers infer gen-ed tags and companion courses without runtime imports", () => {
  assert.deepEqual(
    getEvaluationTargetRequirementTags({
      title: "Natural Science transfer category",
      targetOutcome: "Counts as NSc",
      targetCourseCodes: [],
      notes: [],
      plannerWarnings: [],
    }),
    ["NSC"]
  );
  assert.deepEqual(
    getSubsetMatchCompanionCourseCodes(
      {
        sourceCourseSets: [["CHEM& 161", "CHEM& 162", "CHEM& 163"]],
      },
      ["CHEM& 161"],
      ["CHEM& 162"]
    ),
    ["CHEM& 163"]
  );
  assert.equal(
    getGuideBackedTransferCategoryOptionDescriptor("Not a distribution category"),
    null
  );
  const descriptor = getCategoryOptionAuditDescriptor("Choose one Natural Science course");
  assert.equal(descriptor.category, "NSC");
  assert.equal(descriptor.sourceCategoryCode, "NSc");
});

test("general education helpers keep placeholder primitives outside runtime", () => {
  assert.equal(GENERAL_ED_PLACEHOLDER_CREDITS, 5);
  assert.deepEqual(buildGeneralEducationPlaceholder("Natural Sciences"), {
    label: "5 credits of Natural Sciences",
    kind: "nsc",
  });
  assert.deepEqual(buildGeneralEducationPlaceholder("Arts and Humanities / Social Sciences"), {
    label: "5 credits of A&H or SSc",
    kind: "ahOrSsc",
  });
  assert.equal(
    isChoiceBackedGeneralEducationPlaceholderLabel(
      "Choose CSE 160 or ME 123 for Natural Sciences"
    ),
    true
  );
  assert.equal(
    isChoiceBackedGeneralEducationPlaceholderLabel("5 credits of Natural Sciences"),
    false
  );

  const emptyTargets = createEmptyGeneralEducationRequirementTargets();
  assert.equal(hasGeneralEducationRequirementTargets(emptyTargets), false);
  assert.deepEqual(buildSingleCategoryGeneralEducationRequirementTargets("nsc", 10), {
    ahCredits: null,
    sscCredits: null,
    nscCredits: 10,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.deepEqual(
    mergeGeneralEducationRequirementTargets(
      {
        ahCredits: 5,
        sscCredits: null,
        nscCredits: null,
        breadthCredits: null,
        electiveCredits: null,
      },
      {
        ahCredits: 10,
        sscCredits: 5,
        nscCredits: null,
        breadthCredits: null,
        electiveCredits: null,
      }
    ),
    {
      ahCredits: 10,
      sscCredits: 5,
      nscCredits: null,
      breadthCredits: null,
      electiveCredits: null,
    }
  );
});

test("student evaluation report assembler buckets visible evaluations and ignores hidden rows", () => {
  const report = buildTransferPlannerStudentEvaluationReport({
    plan: {
      id: "plan-one",
      title: "Sample Major",
      selectedPathwayId: "path-one",
      selectedPathwayLabel: "Sample Path",
    },
    campusLabel: "UW Test",
    completedCourses: [
      { code: "MATH 141", label: "MATH 141" },
      { code: "CHEM 161", label: "CHEM 161" },
      { code: "HIST 101", label: "HIST 101" },
    ],
    evaluations: [
      {
        outcome: "auto-approved",
        studentFacing: true,
        courseCode: "MATH 141",
        sourceCreditAmount: 5,
        approvedRuleId: "rule-b",
        alternativeApprovedRuleIds: ["rule-a"],
        sourceLinks: [{ url: "https://example.edu/rule-a" }],
        warnings: [],
        missingSourceCourseCodes: [],
      },
      {
        outcome: "sequence-incomplete",
        studentFacing: true,
        courseCode: "CHEM 161",
        sourceCreditAmount: 5,
        approvedRuleId: null,
        alternativeApprovedRuleIds: [],
        sourceLinks: [
          { url: "https://example.edu/rule-a" },
          { url: "https://example.edu/rule-c" },
        ],
        warnings: ["Pair with CHEM 162."],
        missingSourceCourseCodes: ["CHEM 162"],
      },
      {
        outcome: "source-unverified-hidden",
        studentFacing: false,
        courseCode: "HIST 101",
        sourceCreditAmount: null,
        approvedRuleId: "hidden-rule",
        alternativeApprovedRuleIds: [],
        sourceLinks: [{ url: "https://example.edu/hidden" }],
        warnings: [],
        missingSourceCourseCodes: [],
      },
    ],
    suggestedQuarterPlan: [
      {
        phase: "planned",
        courses: [{ label: "MATH 142" }, { label: "MATH 142" }, { label: "CHEM 162" }],
      },
      {
        phase: "completed",
        courses: [{ label: "MATH 141" }],
      },
    ],
    remainingDirectTransferCreditRange: {
      mainScheduledMinRemainingCredits: 15,
      mainScheduledMaxRemainingCredits: 20,
    },
  });

  assert.equal(report.planId, "plan-one");
  assert.equal(report.pathwayId, "path-one");
  assert.equal(report.majorTitle, "Sample Major (Sample Path)");
  assert.equal(report.studentFacingEvaluationCount, 2);
  assert.equal(report.hiddenEvaluationCount, 1);
  assert.deepEqual(report.officialRuleIds, ["rule-a", "rule-b"]);
  assert.equal(report.sourceLinkCount, 2);
  assert.deepEqual(report.warningCourseCodes, ["CHEM 161"]);
  assert.deepEqual(report.missingSequenceCourseCodes, ["CHEM 162"]);
  assert.deepEqual(report.nextPlannedCourseLabels, ["MATH 142", "CHEM 162"]);
  assert.equal(report.completedDirectTransferCredits, 5);
  assert.equal(report.remainingDirectTransferCreditMin, 15);
  assert.equal(report.remainingDirectTransferCreditMax, 20);
  assert.deepEqual(
    report.buckets.map((bucket) => [bucket.id, bucket.count]),
    [
      ["auto-approved", 1],
      ["legacy-rule-used", 0],
      ["elective-credit", 0],
      ["sequence-incomplete", 1],
      ["no-credit", 0],
      ["not-applicable-to-major", 0],
    ]
  );
});

test("course planning graph module keeps curated prerequisite chains isolated from runtime", () => {
  const graph = buildTransferPlannerCoursePlanningGraph({
    actionableCourseCodes: ["CS 121", "CS 122", "CS 123"],
  });
  const prerequisiteMap = getCoursePlanningGraphRequirementMap(
    graph,
    "prerequisiteCourseSetsByCourseCode"
  );

  assert.deepEqual(prerequisiteMap.get("CS 122"), [["CS 121"]]);
  assert.deepEqual(prerequisiteMap.get("CS 123"), [["CS 122"]]);
  assert.equal(graph.sourceCounts.chainPrerequisiteCourseCount, 2);

  assert.equal(
    courseHasSatisfiedPrerequisites(
      {
        explicitCourseCodes: ["CS 122"],
        prerequisiteCourseSets: [["CS 121"]],
        corequisiteCourseSets: [],
      },
      new Set(["CS 121"])
    ),
    true
  );
  assert.equal(
    courseHasSatisfiedCorequisites(
      {
        explicitCourseCodes: ["LAB 101"],
        prerequisiteCourseSets: [],
        corequisiteCourseSets: [["LAB 102"]],
      },
      new Set(),
      [
        {
          explicitCourseCodes: ["LAB 102"],
          prerequisiteCourseSets: [],
          corequisiteCourseSets: [],
        },
      ]
    ),
    true
  );
});

test("quarter slot module returns future planning slots without runtime imports", () => {
  const withoutSummer = buildQuarterSlotsAfterCurrent(new Date(2026, 2, 25), false);
  assert.deepEqual(
    withoutSummer.map((slot) => slot.label),
    ["Fall 2026", "Winter 2027", "Spring 2027"]
  );

  const withSummer = buildQuarterSlotsAfterCurrent(new Date(2026, 2, 25), true);
  assert.deepEqual(
    withSummer.map((slot) => slot.label),
    ["Summer 2026", "Fall 2026", "Winter 2027"]
  );
});

test("transcript satisfaction helper removes satisfied planned category rows and annotates completed courses", () => {
  const optionGroup = { id: "group-one" };
  const suggestedPlan = [
    {
      phase: "completed",
      courses: [{ label: "MATH 141", guidanceSummary: "Already completed." }],
    },
    {
      phase: "planned",
      courses: [
        { label: "Calculus category", optionGroup },
        { label: "CHEM 162", optionGroup: { id: "group-two" } },
      ],
    },
  ];

  const updatedPlan = attachSelectedCategoryTranscriptSatisfactionToPlan({
    suggestedPlan,
    satisfiedCategoryResolutions: [
      {
        groupId: "group-one",
        categoryOptionLabel: "Calculus category",
        chosenTranscriptSatisfier: "MATH 141",
        optionGroup,
      },
    ],
  });

  assert.deepEqual(
    updatedPlan[0].courses.map((course) => course.label),
    ["MATH 141"]
  );
  assert.equal(updatedPlan[0].courses[0].optionGroup, optionGroup);
  assert.equal(
    updatedPlan[0].courses[0].guidanceSummary,
    "Already completed. Calculus category is satisfied by this completed transcript course."
  );
  assert.deepEqual(
    updatedPlan[1].courses.map((course) => course.label),
    ["CHEM 162"]
  );
});
