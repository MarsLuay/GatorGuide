const assert = require("node:assert/strict");
const test = require("node:test");

require("../../scripts/qa/react-native-test-utils.cjs");

const { QUESTIONNAIRE_FIELD_IDS, QUESTIONNAIRE_SECTION_IDS } = require("@/constants/schema");
const {
  buildBlankQuestionnaireAnswers,
  buildQuestionnaireQuestions,
  buildQuestionnaireSectionSummaries,
  countAnsweredQuestionnaireQuestions,
  filterQuestionnaireQuestionsForMode,
  getAnswerableQuestionnaireQuestions,
  getCurrentSectionPreviewQuestions,
} = require("@/components/pages/questionnaire/questionnaire-logic");
const {
  getQuestionnaireAnswerText,
  isQuestionnaireAnswerValue,
  normalizeQuestionnaireAnswers,
} = require("@/services/app/questionnaire.enums");
const {
  buildAgendaPreviewText,
  addMonths,
  formatGroupDate,
  getPrimaryActionLabel,
} = require("@/components/pages/deadline-calendar/deadline-calendar-view-utils");
const {
  formatGpaDisplay,
  getDeadlineOpportunityId,
  getHomeFirstNameDisplay,
  mergeHomeCurrentCourses,
} = require("@/components/pages/home/home-page-utils");
const {
  buildHomeTourSteps,
  resolveHomeTourBubbleLayout,
} = require("@/components/pages/home/home-tour");
const {
  filterEquivalenciesBySearch,
  normalizeEquivalencySearchValue,
  resolveVisibleTransferEquivalencyTags,
} = require("@/components/pages/transfer-equivalency-catalog/transfer-equivalency-catalog-logic");

const t = (key, params) =>
  params ? `${key}:${Object.values(params).join(",")}` : key;

test("questionnaire helpers keep basic mode matcher-facing and preserve blank answer keys", () => {
  const questions = buildQuestionnaireQuestions(t);
  const basicQuestions = filterQuestionnaireQuestionsForMode(questions, "basic");
  const basicIds = new Set(basicQuestions.map((question) => question.id));

  assert.equal(basicQuestions[0].id, QUESTIONNAIRE_SECTION_IDS.data);
  assert.equal(basicIds.has(QUESTIONNAIRE_FIELD_IDS.major), true);
  assert.equal(basicIds.has(QUESTIONNAIRE_FIELD_IDS.gpa), true);
  assert.equal(basicIds.has(QUESTIONNAIRE_FIELD_IDS.lgbtqCommunity), true);
  assert.equal(basicIds.has(QUESTIONNAIRE_FIELD_IDS.advisor), false);

  const blankAnswers = buildBlankQuestionnaireAnswers(questions);
  assert.equal(blankAnswers[QUESTIONNAIRE_FIELD_IDS.advisor], "");
  assert.equal(blankAnswers[QUESTIONNAIRE_FIELD_IDS.major], "");

  const answerableQuestions = getAnswerableQuestionnaireQuestions(basicQuestions);
  assert.equal(
    countAnsweredQuestionnaireQuestions(answerableQuestions, {
      [QUESTIONNAIRE_FIELD_IDS.major]: "Computer Science",
      [QUESTIONNAIRE_FIELD_IDS.gpa]: "3.8",
    }),
    2
  );

  const sectionSummaries = buildQuestionnaireSectionSummaries(questions);
  const previewQuestions = getCurrentSectionPreviewQuestions({
    currentQuestion: questions[0],
    currentSectionIndex: 0,
    currentStep: 0,
    questions,
    sectionSummaries,
    previewLimit: 2,
  });
  assert.deepEqual(
    previewQuestions.map((question) => question.id),
    [QUESTIONNAIRE_FIELD_IDS.advisor, QUESTIONNAIRE_FIELD_IDS.gpa]
  );
});

test("questionnaire answer schema preserves JSON values and filters invalid boundaries", () => {
  const normalized = normalizeQuestionnaireAnswers({
    [QUESTIONNAIRE_FIELD_IDS.major]: "Computer Science",
    [QUESTIONNAIRE_FIELD_IDS.useWeightedSearch]: "false",
    localPlannerObject: { planId: "uw-seattle-cs", selected: ["CSE 121"] },
    badFunction: () => "nope",
    badNumber: Number.NaN,
  });

  assert.equal(normalized[QUESTIONNAIRE_FIELD_IDS.major], "Computer Science");
  assert.equal(normalized[QUESTIONNAIRE_FIELD_IDS.useWeightedSearch], false);
  assert.deepEqual(normalized.localPlannerObject, {
    planId: "uw-seattle-cs",
    selected: ["CSE 121"],
  });
  assert.equal("badFunction" in normalized, false);
  assert.equal("badNumber" in normalized, false);
  assert.equal(getQuestionnaireAnswerText(normalized, QUESTIONNAIRE_FIELD_IDS.major), "Computer Science");
  assert.equal(isQuestionnaireAnswerValue({ nested: [true, null, "ok"] }), true);
  assert.equal(isQuestionnaireAnswerValue({ nested: [Symbol("bad")] }), false);
});

test("deadline calendar view helpers format dates and action copy without page rendering", () => {
  const nextMonth = addMonths(new Date(2026, 0, 15), 1);
  assert.equal(nextMonth.getFullYear(), 2026);
  assert.equal(nextMonth.getMonth(), 1);
  assert.equal(nextMonth.getDate(), 1);
  assert.match(formatGroupDate("2026-05-25", "en-US"), /May|Mon|25|2026/);
  assert.equal(buildAgendaPreviewText("  Apply   before   midnight  ", 15), "Apply before m...");
  assert.equal(
    getPrimaryActionLabel(
      {
        target: { type: "resources", opportunityId: "opp-1" },
      },
      t
    ),
    "deadlineCalendar.actionViewOpportunity"
  );
});

test("home helpers normalize profile, GPA, current courses, and tour geometry", () => {
  assert.equal(getHomeFirstNameDisplay("mARWA coder", "Student"), "Marwa");
  assert.equal(formatGpaDisplay("4.29 cumulative"), "4");
  assert.equal(formatGpaDisplay("3.456"), "3.45");
  assert.equal(
    getDeadlineOpportunityId({
      id: "opportunity:scholarship-1",
      target: { type: "url", url: "https://example.test" },
    }),
    "scholarship-1"
  );

  const mergedCourses = mergeHomeCurrentCourses(
    ["MATH& 151"],
    ["MATH& 151", "ENGL& 101"]
  );
  assert.deepEqual(mergedCourses, [
    { id: "MATH& 151", label: "MATH& 151" },
    { id: "ENGL& 101", label: "ENGL& 101" },
  ]);

  const tourSteps = buildHomeTourSteps({
    t,
    screenWidth: 400,
    tabAnchorY: 760,
    tourCardLeft: 20,
    tourCardWidth: 360,
    topAnchor: 40,
  });
  assert.equal(tourSteps.length, 5);

  const bubble = resolveHomeTourBubbleLayout({
    activeTourStep: tourSteps[1],
    bottomInset: 12,
    effectiveFontScale: 1,
    screenHeight: 800,
    screenWidth: 400,
    topInset: 20,
  });
  assert.equal(bubble.preferBubbleTop, true);
  assert.equal(bubble.bubbleWidth, 360);
});

test("transfer equivalency catalog helpers handle normalized search and visible tags", () => {
  const rowsByTag = new Map([
    [
      "NSC",
      [
        {
          id: "bio",
          targetSchoolIds: ["uw-seattle"],
          sourceCourseLabel: "BIOL& 211",
          sourceCourseTitle: "Majors Biology",
          targetOutcome: "Natural Sciences",
          tags: ["NSC"],
        },
      ],
    ],
    [
      "AH",
      [
        {
          id: "art",
          targetSchoolIds: ["uw-seattle"],
          sourceCourseLabel: "ART& 100",
          sourceCourseTitle: "Art Appreciation",
          targetOutcome: "Arts and Humanities",
          tags: ["AH"],
        },
      ],
    ],
  ]);

  assert.equal(normalizeEquivalencySearchValue(" BIOL& 211 "), "biol 211");
  assert.deepEqual(
    resolveVisibleTransferEquivalencyTags({
      ceApprovedNaturalScienceRowCount: 0,
      equivalenciesByTag: rowsByTag,
      selectedTags: [],
    }),
    ["AH", "NSC"]
  );

  const filtered = filterEquivalenciesBySearch({
    equivalenciesByTag: rowsByTag,
    isGreenRiverCollegeMode: false,
    normalizedSearchQuery: "biology",
    visibleTags: ["AH", "NSC"],
  });
  assert.equal(filtered.has("NSC"), true);
  assert.equal(filtered.has("AH"), false);
});
