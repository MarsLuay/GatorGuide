import {
  QUESTIONNAIRE_FIELD_IDS,
  QUESTIONNAIRE_SECTION_IDS,
  type QuestionnaireFieldId,
  type QuestionnaireSectionId,
} from "@/constants/schema";
import type { Language } from "@/services/app/translations";
import {
  LOCATION_PRIMARY_OPTIONS,
  LOCATION_REGION_OPTIONS,
  parseLocationPreference,
  type QuestionnaireAnswers,
  type LocationPrimaryOptionKey,
} from "@/services/app/questionnaire.enums";

export type RadioQuestionOption = string | { value: string; label: string };

export type Question =
  | { id: QuestionnaireSectionId; question: string; type: "section" }
  | {
      id: QuestionnaireFieldId;
      question: string;
      type: "text" | "textarea";
      placeholder: string;
    }
  | {
      id: QuestionnaireFieldId;
      question: string;
      type: "radio";
      options: RadioQuestionOption[];
    }
  | {
      id: QuestionnaireFieldId;
      question: string;
      type: "location";
      options: { key: LocationPrimaryOptionKey; label: string }[];
      regionOptions: { key: string; label: string }[];
    };

export type QuestionnaireMode = "basic" | "full";

export type QuestionnaireSectionSummary = {
  id: QuestionnaireSectionId;
  title: string;
  startIndex: number;
  endIndex: number;
};

type Translate = (key: string, params?: Record<string, string | number>) => string;

const BASIC_MATCHING_FIELD_IDS = new Set<QuestionnaireFieldId>([
  QUESTIONNAIRE_FIELD_IDS.major,
  QUESTIONNAIRE_FIELD_IDS.gpa,
  QUESTIONNAIRE_FIELD_IDS.costOfAttendance,
  QUESTIONNAIRE_FIELD_IDS.inStateOutOfState,
  QUESTIONNAIRE_FIELD_IDS.lgbtqCommunity,
]);

export function getRadioOptionValue(option: RadioQuestionOption) {
  return typeof option === "string" ? option : option.value;
}

export function getRadioOptionLabel(option: RadioQuestionOption) {
  return typeof option === "string" ? option : option.label;
}

export function getLocationPrimarySelection(
  value: string,
  language: Language
): LocationPrimaryOptionKey | null {
  const parsed = parseLocationPreference(value, language);

  switch (parsed.kind) {
    case "washington_only":
    case "near_current_location":
    case "no_preference":
      return parsed.kind;
    case "state":
      return "specific_state";
    case "region":
      return "specific_region";
    case "other":
      return "other";
    default:
      return null;
  }
}

export function getQuestionIconName(question: Question) {
  switch (question.type) {
    case "location":
      return "place";
    case "radio":
      return "check-circle-outline";
    case "section":
      return "assignment";
    case "textarea":
      return "notes";
    case "text":
    default:
      return "edit";
  }
}

export function buildQuestionnaireQuestions(t: Translate): Question[] {
  return [
    { id: QUESTIONNAIRE_SECTION_IDS.data, question: t("questionnaire.sectionDataWeNeed"), type: "section" },
    { id: QUESTIONNAIRE_FIELD_IDS.advisor, question: t("questionnaire.advisor"), placeholder: t("questionnaire.advisorPlaceholder"), type: "text" },
    { id: QUESTIONNAIRE_FIELD_IDS.gpa, question: t("questionnaire.gpa"), placeholder: t("questionnaire.gpaPlaceholder"), type: "text" },
    { id: QUESTIONNAIRE_FIELD_IDS.weather, question: t("questionnaire.weather"), options: [t("questionnaire.weatherWarm"), t("questionnaire.weatherCold"), t("questionnaire.weatherMild"), t("questionnaire.noPreference")], type: "radio" },
    { id: QUESTIONNAIRE_FIELD_IDS.costOfAttendance, question: t("questionnaire.costOfAttendance"), options: [t("questionnaire.under20k"), t("questionnaire.20to40k"), t("questionnaire.40to60k"), t("questionnaire.over60k"), t("questionnaire.needFinancialAid")], type: "radio" },
    {
      id: QUESTIONNAIRE_FIELD_IDS.lgbtqCommunity,
      question: t("questionnaire.lgbtqCommunity"),
      options: [
        { value: "yes", label: t("questionnaire.yes") },
        { value: "no", label: t("questionnaire.no") },
        { value: "prefer_not_to_say", label: t("questionnaire.preferNotToSay") },
      ],
      type: "radio",
    },
    { id: QUESTIONNAIRE_FIELD_IDS.graduationRate, question: t("questionnaire.graduationRate"), options: [t("questionnaire.veryImportant"), t("questionnaire.somewhatImportant"), t("questionnaire.notImportant")], type: "radio" },
    { id: QUESTIONNAIRE_FIELD_IDS.acceptanceRate, question: t("questionnaire.acceptanceRate"), options: [t("questionnaire.veryImportant"), t("questionnaire.somewhatImportant"), t("questionnaire.notImportant")], type: "radio" },
    {
      id: QUESTIONNAIRE_FIELD_IDS.location,
      question: t("questionnaire.location"),
      options: LOCATION_PRIMARY_OPTIONS.map((option) => ({ key: option.key, label: t(option.labelKey) })),
      regionOptions: LOCATION_REGION_OPTIONS.map((option) => ({ key: option.key, label: t(option.labelKey) })),
      type: "location",
    },
    { id: QUESTIONNAIRE_FIELD_IDS.collegeVibe, question: t("questionnaire.collegeVibe"), placeholder: t("questionnaire.collegeVibePlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_FIELD_IDS.transportation, question: t("questionnaire.transportation"), options: [t("questionnaire.transportCar"), t("questionnaire.transportTransit"), t("questionnaire.transportBike"), t("questionnaire.transportWalk"), t("questionnaire.noPreference")], type: "radio" },
    { id: QUESTIONNAIRE_FIELD_IDS.companiesNearby, question: t("questionnaire.companiesNearby"), placeholder: t("questionnaire.companiesNearbyPlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_FIELD_IDS.inStateOutOfState, question: t("questionnaire.inStateOutOfState"), options: [t("questionnaire.inState"), t("questionnaire.outOfState"), t("questionnaire.noPreference")], type: "radio" },
    { id: QUESTIONNAIRE_FIELD_IDS.housing, question: t("questionnaire.housingPreference"), options: [t("questionnaire.onCampus"), t("questionnaire.offCampus"), t("questionnaire.commute"), t("questionnaire.noPreference")], type: "radio" },
    { id: QUESTIONNAIRE_FIELD_IDS.studentStaffRatio, question: t("questionnaire.studentStaffRatio"), placeholder: t("questionnaire.studentStaffRatioPlaceholder"), type: "text" },
    { id: QUESTIONNAIRE_FIELD_IDS.internationalStudentRatio, question: t("questionnaire.internationalStudentRatio"), placeholder: t("questionnaire.ratioPlaceholder"), type: "text" },
    { id: QUESTIONNAIRE_FIELD_IDS.taxRates, question: t("questionnaire.taxRates"), placeholder: t("questionnaire.taxRatesPlaceholder"), type: "text" },
    { id: QUESTIONNAIRE_FIELD_IDS.ranking, question: t("questionnaire.ranking"), options: [t("questionnaire.veryImportant"), t("questionnaire.somewhatImportant"), t("questionnaire.notImportant")], type: "radio" },
    { id: QUESTIONNAIRE_FIELD_IDS.researchOpportunities, question: t("questionnaire.researchOpportunities"), placeholder: t("questionnaire.researchOpportunitiesPlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_FIELD_IDS.major, question: t("questionnaire.major"), placeholder: t("questionnaire.majorPlaceholder"), type: "text" },
    { id: QUESTIONNAIRE_FIELD_IDS.continueEducation, question: t("questionnaire.continueEducation"), options: [t("questionnaire.yes"), t("questionnaire.no"), t("questionnaire.maybe")], type: "radio" },
    { id: QUESTIONNAIRE_FIELD_IDS.graduationDate, question: t("questionnaire.graduationDate"), placeholder: t("questionnaire.graduationDatePlaceholder"), type: "text" },
    { id: QUESTIONNAIRE_FIELD_IDS.quarterSemesterSystem, question: t("questionnaire.quarterSemesterSystem"), options: [t("questionnaire.quarter"), t("questionnaire.semester"), t("questionnaire.noPreference")], type: "radio" },
    { id: QUESTIONNAIRE_FIELD_IDS.transferStudentRate, question: t("questionnaire.transferStudentRate"), placeholder: t("questionnaire.ratioPlaceholder"), type: "text" },
    { id: QUESTIONNAIRE_FIELD_IDS.extracurriculars, question: t("questionnaire.extracurriculars"), placeholder: t("questionnaire.extracurricularsPlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_FIELD_IDS.timeZone, question: t("questionnaire.timeZone"), placeholder: t("questionnaire.timeZonePlaceholder"), type: "text" },
    { id: QUESTIONNAIRE_FIELD_IDS.deadline, question: t("questionnaire.deadline"), placeholder: t("questionnaire.deadlinePlaceholder"), type: "text" },
    { id: QUESTIONNAIRE_FIELD_IDS.majorExploration, question: t("questionnaire.majorExploration"), placeholder: t("questionnaire.majorExplorationPlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_FIELD_IDS.certifications, question: t("questionnaire.certifications"), placeholder: t("questionnaire.certificationsPlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_FIELD_IDS.associatesForTransfer, question: t("questionnaire.associatesForTransfer"), options: [t("questionnaire.yes"), t("questionnaire.no"), t("questionnaire.considering")], type: "radio" },
    { id: QUESTIONNAIRE_FIELD_IDS.salary, question: t("questionnaire.salary"), placeholder: t("questionnaire.salaryPlaceholder"), type: "text" },
    { id: QUESTIONNAIRE_FIELD_IDS.workEnvironment, question: t("questionnaire.workEnvironment"), placeholder: t("questionnaire.workEnvironmentPlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_FIELD_IDS.yearsToComplete, question: t("questionnaire.yearsToComplete"), placeholder: t("questionnaire.yearsToCompletePlaceholder"), type: "text" },
    { id: QUESTIONNAIRE_FIELD_IDS.demand, question: t("questionnaire.demand"), options: [t("questionnaire.demandHigh"), t("questionnaire.demandMedium"), t("questionnaire.demandLow"), t("questionnaire.unsure")], type: "radio" },
    { id: QUESTIONNAIRE_FIELD_IDS.howCompetitive, question: t("questionnaire.howCompetitive"), options: [t("questionnaire.veryCompetitive"), t("questionnaire.moderate"), t("questionnaire.lessCompetitive"), t("questionnaire.unsure")], type: "radio" },
    { id: QUESTIONNAIRE_FIELD_IDS.personalInterest, question: t("questionnaire.personalInterest"), placeholder: t("questionnaire.personalInterestPlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_FIELD_IDS.typesOfOccupation, question: t("questionnaire.typesOfOccupation"), placeholder: t("questionnaire.typesOfOccupationPlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_FIELD_IDS.opportunitiesToExpatriate, question: t("questionnaire.opportunitiesToExpatriate"), options: [t("questionnaire.yes"), t("questionnaire.no"), t("questionnaire.maybe")], type: "radio" },
    { id: QUESTIONNAIRE_SECTION_IDS.academicPlan, question: t("questionnaire.sectionAcademicPlan"), type: "section" },
    { id: QUESTIONNAIRE_FIELD_IDS.requiredCourses, question: t("questionnaire.requiredCourses"), placeholder: t("questionnaire.requiredCoursesPlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_FIELD_IDS.recommendedCourses, question: t("questionnaire.recommendedCourses"), placeholder: t("questionnaire.recommendedCoursesPlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_FIELD_IDS.resourcesOnCampus, question: t("questionnaire.resourcesOnCampus"), placeholder: t("questionnaire.resourcesOnCampusPlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_SECTION_IDS.personalStatement, question: t("questionnaire.sectionPersonalStatement"), type: "section" },
    { id: QUESTIONNAIRE_FIELD_IDS.personalStatementFocus, question: t("questionnaire.personalStatementFocus"), options: [t("questionnaire.grammar"), t("questionnaire.spelling"), t("questionnaire.punctuation"), t("questionnaire.allOfTheAbove")], type: "radio" },
    { id: QUESTIONNAIRE_SECTION_IDS.occupation, question: t("questionnaire.sectionOccupation"), type: "section" },
    { id: QUESTIONNAIRE_FIELD_IDS.internships, question: t("questionnaire.internships"), placeholder: t("questionnaire.internshipsPlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_FIELD_IDS.entryLevelPosition, question: t("questionnaire.entryLevelPosition"), placeholder: t("questionnaire.entryLevelPositionPlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_FIELD_IDS.resumeSkills, question: t("questionnaire.resumeSkills"), placeholder: t("questionnaire.resumeSkillsPlaceholder"), type: "textarea" },
    { id: QUESTIONNAIRE_FIELD_IDS.platforms, question: t("questionnaire.platforms"), placeholder: t("questionnaire.platformsPlaceholder"), type: "textarea" },
  ];
}

export function filterQuestionnaireQuestionsForMode(
  questions: Question[],
  mode: QuestionnaireMode
) {
  if (mode === "full") return questions;

  return questions.filter(
    (question) =>
      (question.type === "section" && question.id === QUESTIONNAIRE_SECTION_IDS.data) ||
      (question.type !== "section" && BASIC_MATCHING_FIELD_IDS.has(question.id))
  );
}

export function buildBlankQuestionnaireAnswers(questions: Question[]) {
  const init: Record<string, string> = {};
  for (const question of questions) {
    if (question.type !== "section") init[question.id] = "";
  }
  return init;
}

export function buildQuestionnaireSectionSummaries(questions: Question[]) {
  const sectionEntries = questions.flatMap((question, index) =>
    question.type === "section" ? [{ question, index }] : []
  );

  return sectionEntries.map((entry, index) => {
    const nextSectionStart = sectionEntries[index + 1]?.index ?? questions.length;

    return {
      id: entry.question.id,
      title: entry.question.question,
      startIndex: entry.index,
      endIndex: nextSectionStart - 1,
    };
  });
}

export function findCurrentQuestionnaireSection(
  sections: QuestionnaireSectionSummary[],
  currentStep: number
) {
  return (
    [...sections].reverse().find((section) => currentStep >= section.startIndex) ??
    sections[0] ??
    null
  );
}

export function getAnswerableQuestionnaireQuestions(questions: Question[]) {
  return questions.filter(
    (question): question is Exclude<Question, { type: "section" }> =>
      question.type !== "section"
  );
}

export function countAnsweredQuestionnaireQuestions(
  questions: Exclude<Question, { type: "section" }>[],
  answers: QuestionnaireAnswers
) {
  return questions.filter(
    (question) => String(answers[question.id] ?? "").trim().length > 0
  ).length;
}

export function getCurrentSectionPreviewQuestions({
  currentQuestion,
  currentSectionIndex,
  currentStep,
  questions,
  sectionSummaries,
  previewLimit,
}: {
  currentQuestion: Question | undefined;
  currentSectionIndex: number;
  currentStep: number;
  questions: Question[];
  sectionSummaries: QuestionnaireSectionSummary[];
  previewLimit: number;
}) {
  if (!currentQuestion || currentQuestion.type !== "section" || currentSectionIndex < 0) {
    return [] as Question[];
  }

  const nextSectionStart =
    sectionSummaries[currentSectionIndex + 1]?.startIndex ?? questions.length;

  return questions
    .slice(currentStep + 1, nextSectionStart)
    .filter((question) => question.type !== "section")
    .slice(0, previewLimit);
}
