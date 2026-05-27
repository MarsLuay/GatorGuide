const assert = require("node:assert/strict");
const test = require("node:test");

const {
  React,
  createSpy,
  getTextContents,
  hasText,
  pressByAccessibilityLabel,
  pressByText,
  render,
  resetReactNativeTestState,
  setTranslations,
  unmount,
} = require("../../scripts/qa/react-native-test-utils.cjs");

const {
  PlannerSelectionFields,
} = require("@/components/transfer-planner/PlannerSelectionFields");
const {
  SuggestedScheduleCourseRow,
  getSuggestedScheduleCourseSelectionState,
} = require("@/components/transfer-planner/SuggestedScheduleCourseRow");
const {
  SuggestedScheduleOptionsBox,
} = require("@/components/transfer-planner/SuggestedScheduleOptionsBox");
const {
  TranscriptEvaluationReportCard,
  formatTranscriptEvaluationCreditRange,
} = require("@/components/transfer-planner/TranscriptEvaluationReportCard");

function applyTransferPlannerTranslations() {
  setTranslations({
    "searchableSelect.browseHint": "Browse options",
    "searchableSelect.noMatches": "No matches",
    "suggestedSchedule.choosePlanOptions": "Choose plan options",
    "suggestedSchedule.closeOptionsFor": "Close options for {{title}}",
    "suggestedSchedule.markCurrentCourse": "Mark current: {{course}}",
    "suggestedSchedule.openOptionsFor": "Open options for {{title}}",
    "suggestedSchedule.selectedInRequirementChoice": "Selected in {{choice}}",
    "suggestedSchedule.satisfiedByCompletedTranscriptCourse": "Satisfied by {{course}}",
    "transferPlanner.campus": "Campus",
    "transferPlanner.college": "College",
    "transferPlanner.collegeHelper": "Pick a college.",
    "transferPlanner.directTransferCreditsSummary":
      "{{directTransferCredits}} transfer credits remain for {{campus}}; {{completedCredits}} completed.",
    "transferPlanner.major": "Major",
    "transferPlanner.ruleCount": "{{count}} {{noun}}",
    "transferPlanner.rulePlural": "rules",
    "transferPlanner.ruleSingular": "rule",
    "transferPlanner.searchMajors": "Search majors",
    "transferPlanner.transcriptEvaluation": "Transcript evaluation",
    "transferPlanner.transcriptEvaluationDescription": "Official transfer rule summary.",
    "transferPlanner.uwCampusHelper": "Pick a UW campus.",
    "transferPlanner.uwMajorHelper": "Pick a UW major.",
  });
}

function createOptionGroup(overrides = {}) {
  return {
    id: "math-choice",
    title: "Math choice",
    promptLabel: "Choose one math course",
    selectionCount: 1,
    selectedOptionIds: ["math-151"],
    options: [
      {
        id: "math-151",
        label: "Calculus I",
        selectedLabel: "Calculus I",
        courseLabels: ["MATH& 151"],
        courseCodes: ["MATH& 151"],
        creditAmount: 5,
      },
      {
        id: "math-152",
        label: "Calculus II",
        selectedLabel: "Calculus II",
        courseLabels: ["MATH& 152"],
        courseCodes: ["MATH& 152"],
        creditAmount: 5,
      },
    ],
    isSelectionPrompt: true,
    ...overrides,
  };
}

test("PlannerSelectionFields renders selectors and delegates selector presses", () => {
  resetReactNativeTestState();
  applyTransferPlannerTranslations();
  const onToggleCollege = createSpy();
  const onToggleCampus = createSpy();
  const onToggleMajor = createSpy();

  const renderer = render(
    React.createElement(PlannerSelectionFields, {
      collegeId: "uw",
      selectedCollegeId: "uw",
      selectedCollegeLabel: "University of Washington",
      selectedCampusId: "uw-seattle",
      selectedCampusLabel: "UW Seattle",
      selectedMajorId: "computer-science",
      selectedMajorLabel: "Computer Science",
      openSelector: null,
      collegeOptions: [{ id: "uw", label: "University of Washington" }],
      campusOptions: [{ id: "uw-seattle", label: "UW Seattle" }],
      majorOptions: [{ id: "computer-science", label: "Computer Science" }],
      onToggleCollege,
      onToggleCampus,
      onToggleMajor,
      onDismissCollege: createSpy(),
      onDismissCampus: createSpy(),
      onDismissMajor: createSpy(),
      onSelectCollege: createSpy(),
      onSelectCampus: createSpy(),
      onSelectMajor: createSpy(),
      onSelectorTouchStartInside: createSpy(),
      isDesktop: true,
      textClass: "text-slate-950",
      secondaryTextClass: "text-slate-600",
      borderClass: "border-emerald-200",
      dropdownBackgroundColor: "#ffffff",
    })
  );

  const renderedText = getTextContents(renderer).join("\n");
  assert.match(renderedText, /College/);
  assert.match(renderedText, /Campus/);
  assert.match(renderedText, /Major/);

  pressByText(renderer, "University of Washington");
  assert.equal(onToggleCollege.calls.length, 1);
  assert.equal(onToggleCampus.calls.length, 0);
  assert.equal(onToggleMajor.calls.length, 0);

  unmount(renderer);
});

test("TranscriptEvaluationReportCard formats and opens summary details", () => {
  resetReactNativeTestState();
  applyTransferPlannerTranslations();

  assert.equal(formatTranscriptEvaluationCreditRange(5, 5), "5");
  assert.equal(formatTranscriptEvaluationCreditRange(10, 15), "10-15");

  const renderer = render(
    React.createElement(TranscriptEvaluationReportCard, {
      report: {
        campusLabel: "UW Seattle",
        completedCourseCount: 1,
        completedDirectTransferCredits: 5,
        hiddenEvaluationCount: 0,
        officialRuleIds: ["rule-1"],
        remainingDirectTransferCreditMax: 15,
        remainingDirectTransferCreditMin: 10,
      },
      evaluations: [],
      plan: {
        campusId: "uw-seattle",
        degreeMapSections: [],
        id: "uw-seattle-computer-science",
      },
      textClass: "text-slate-950",
      secondaryTextClass: "text-slate-600",
      cardClass: "bg-white",
      borderClass: "border-emerald-200",
    })
  );

  assert.equal(hasText(renderer, "Transcript evaluation"), true);
  assert.equal(hasText(renderer, "10-15 transfer credits remain"), false);

  pressByAccessibilityLabel(renderer, "Transcript evaluation");
  assert.equal(hasText(renderer, "10-15 transfer credits remain for UW Seattle"), true);

  unmount(renderer);
});

test("SuggestedScheduleOptionsBox renders requirement options and dispatches selection", () => {
  resetReactNativeTestState();
  applyTransferPlannerTranslations();
  const onSelectRequirementOption = createSpy();

  const renderer = render(
    React.createElement(SuggestedScheduleOptionsBox, {
      optionGroups: [createOptionGroup()],
      plan: null,
      plannerPathKey: "uw-seattle|computer-science",
      optionBoxSummaryText: "Two math options available.",
      onSelectRequirementOption,
      textClass: "text-slate-950",
      secondaryTextClass: "text-slate-600",
      borderClass: "border-emerald-200",
    })
  );

  assert.equal(hasText(renderer, "Choose plan options"), true);
  assert.equal(hasText(renderer, "Math choice"), true);
  assert.equal(hasText(renderer, "Calculus II"), true);

  pressByText(renderer, "Calculus II");
  assert.deepEqual(onSelectRequirementOption.calls[0], [
    "math-choice",
    "math-152",
    1,
    ["math-151"],
  ]);

  unmount(renderer);
});

test("SuggestedScheduleCourseRow centralizes current-course selection state", () => {
  resetReactNativeTestState();
  applyTransferPlannerTranslations();
  const onToggleCurrentCourse = createSpy();
  const course = {
    explicitCourseCodes: ["BIOL 100"],
    instanceKey: "quarter-1|biol-100",
    label: "BIOL 100 (5)",
    status: "planned",
    type: "elective",
  };

  assert.deepEqual(
    getSuggestedScheduleCourseSelectionState(course, new Set(["quarter-1|biol-100"])),
    {
      courseSelectionKey: "quarter-1|biol-100",
      isCurrentCourseSelected: true,
      shouldShowCurrentCourseCheckbox: true,
    }
  );
  assert.equal(
    getSuggestedScheduleCourseSelectionState(
      { ...course, status: "completed" },
      new Set(["quarter-1|biol-100"])
    ).shouldShowCurrentCourseCheckbox,
    false
  );

  const renderer = render(
    React.createElement(SuggestedScheduleCourseRow, {
      course,
      quarterLabel: "Fall 2026",
      courseIndex: 0,
      collegeId: "uw",
      selectedCampusId: "uw-seattle",
      selectedMajorId: "computer-science",
      selectedPathwayId: null,
      currentCourseSelections: new Set(),
      onToggleCurrentCourse,
      scheduleOptionDisplayTitleById: new Map(),
      plannedCourseContainerClass: "bg-white border border-emerald-200",
      textClass: "text-slate-950",
      secondaryTextClass: "text-slate-600",
    })
  );

  assert.equal(hasText(renderer, "BIOL 100"), true);
  pressByAccessibilityLabel(renderer, "Mark current: BIOL 100 - (5)");
  assert.deepEqual(onToggleCurrentCourse.calls[0], [
    "quarter-1|biol-100",
    "BIOL 100 (5)",
  ]);

  unmount(renderer);
});

test("SuggestedScheduleCourseRow keeps transcript-satisfied gen-ed rows in normal course format", () => {
  resetReactNativeTestState();
  applyTransferPlannerTranslations();

  const optionGroup = createOptionGroup({
    id: "ah-choice",
    title: "4 credits of Arts and Humanities",
    selectedOptionIds: [],
    resolvedSatisfiedOptionIds: ["ah-option"],
    completedSatisfyingCourseCodesByOptionId: {
      "ah-option": ["ART 114"],
    },
    optionSatisfactionSourcesById: {
      "ah-option": ["transcript-completed"],
    },
    isSelectionPrompt: false,
    options: [
      {
        id: "ah-option",
        label: "4 credits of Arts and Humanities (A&H)",
        selectedLabel: "4 credits of Arts and Humanities (A&H)",
        courseLabels: ["4 credits of Arts and Humanities (A&H)"],
        courseCodes: [],
        creditAmount: 4,
      },
      {
        id: "ssc-option",
        label: "4 credits of Social Sciences (SSc)",
        selectedLabel: "4 credits of Social Sciences (SSc)",
        courseLabels: ["4 credits of Social Sciences (SSc)"],
        courseCodes: [],
        creditAmount: 4,
      },
    ],
  });

  const renderer = render(
    React.createElement(SuggestedScheduleCourseRow, {
      course: {
        label: "ART 114",
        status: "completed",
        type: "elective",
        guidanceSummary:
          "This covers 4/4 A&H/SSc credits needed for Aeronautics & Astronautics.",
        optionGroup,
      },
      quarterLabel: "Fall 2024",
      courseIndex: 0,
      collegeId: "uw",
      selectedCampusId: "uw-seattle",
      selectedMajorId: "aeronautics",
      selectedPathwayId: null,
      currentCourseSelections: new Set(),
      onToggleCurrentCourse: createSpy(),
      scheduleOptionDisplayTitleById: new Map([["ah-choice", "Requirement Choice 1"]]),
      plannedCourseContainerClass: "bg-white border border-emerald-200",
      textClass: "text-slate-950",
      secondaryTextClass: "text-slate-600",
    })
  );

  assert.equal(hasText(renderer, "ART 114"), true);
  assert.equal(hasText(renderer, "Selected in Requirement Choice 1"), true);
  assert.equal(
    hasText(
      renderer,
      "This covers 4/4 A&H/SSc credits needed for Aeronautics & Astronautics."
    ),
    true
  );
  assert.equal(hasText(renderer, "4 credits of Arts and Humanities (A&H)"), false);

  unmount(renderer);
});
