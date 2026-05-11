import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { AppButton } from "@/components/ui/AppButton";
import { AnimatedChipPressable, AnimatedIconPressable } from "@/components/ui/AnimatedPressables";
import { ROUTES } from "@/constants/routes";
import { StateCard } from "@/components/ui/StateCard";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import useBack from "@/hooks/use-back";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import {
  QUESTIONNAIRE_FIELD_IDS,
  QUESTIONNAIRE_SECTION_IDS,
  type QuestionnaireFieldId,
  type QuestionnaireSectionId,
} from "@/constants/schema";
import { collegeService } from "@/services/colleges/college.service";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import {
  buildOtherLocationPreference,
  buildRegionLocationPreference,
  buildStateLocationPreference,
  LOCATION_PRIMARY_OPTIONS,
  LOCATION_REGION_OPTIONS,
  normalizeQuestionnaireAnswers,
  parseLocationPreference,
  type LocationPrimaryOptionKey,
  US_STATE_OPTIONS,
} from "@/services/app/questionnaire.enums";

type Question =
  | { id: QuestionnaireSectionId; question: string; type: "section" }
  | { id: QuestionnaireFieldId; question: string; type: "text" | "textarea"; placeholder: string }
  | { id: QuestionnaireFieldId; question: string; type: "radio"; options: string[] }
  | {
      id: QuestionnaireFieldId;
      question: string;
      type: "location";
      options: { key: LocationPrimaryOptionKey; label: string }[];
      regionOptions: { key: string; label: string }[];
    };

type QuestionnaireSectionSummary = {
  id: QuestionnaireSectionId;
  title: string;
  startIndex: number;
  endIndex: number;
};

function getLocationPrimarySelection(value: string, language: ReturnType<typeof useAppLanguage>["language"]): LocationPrimaryOptionKey | null {
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

export default function QuestionnairePage() {
  const { isDark, isGreen, isLight } = useAppTheme();
  const { isHydrated, state, setQuestionnaireAnswers } = useAppData();
  const { t, language } = useAppLanguage();
  const { width, height } = useWindowDimensions();
  const { getScrollContentPadding } = useResponsiveLayout();
  const back = useBack(ROUTES.tabs);
  const questionnaireScrollRef = useRef<ScrollView>(null);

  // Questionnaire is translation-driven so prompts/options update when language changes.
  const questions = useMemo<Question[]>(
    () => [
      { id: QUESTIONNAIRE_SECTION_IDS.data, question: t("questionnaire.sectionDataWeNeed"), type: "section" },
      { id: QUESTIONNAIRE_FIELD_IDS.advisor, question: t("questionnaire.advisor"), placeholder: t("questionnaire.advisorPlaceholder"), type: "text" },
      { id: QUESTIONNAIRE_FIELD_IDS.gpa, question: t("questionnaire.gpa"), placeholder: t("questionnaire.gpaPlaceholder"), type: "text" },
      { id: QUESTIONNAIRE_FIELD_IDS.weather, question: t("questionnaire.weather"), options: [t("questionnaire.weatherWarm"), t("questionnaire.weatherCold"), t("questionnaire.weatherMild"), t("questionnaire.noPreference")], type: "radio" },
      { id: QUESTIONNAIRE_FIELD_IDS.costOfAttendance, question: t("questionnaire.costOfAttendance"), options: [t("questionnaire.under20k"), t("questionnaire.20to40k"), t("questionnaire.40to60k"), t("questionnaire.over60k"), t("questionnaire.needFinancialAid")], type: "radio" },
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
    ],
    [t]
  );

  const blankAnswers = useMemo(() => {
    // Pre-seed non-section question ids so input bindings always have stable keys.
    const init: Record<string, string> = {};
    for (const q of questions) if (q.type !== "section") init[q.id] = "";
    return init;
  }, [questions]);

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => blankAnswers);
  const [locationModeDraft, setLocationModeDraft] = useState<LocationPrimaryOptionKey | null>(null);
  const [isActionLocked, setIsActionLocked] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;
    setAnswers({ ...blankAnswers, ...(state.questionnaireAnswers ?? {}) });
  }, [isHydrated, blankAnswers, state.questionnaireAnswers]);

  useEffect(() => {
    const derived = getLocationPrimarySelection(answers.location ?? "", language);
    if (derived) setLocationModeDraft(derived);
  }, [answers.location, language]);

  const currentQuestion = questions[currentStep];
  const progress = Math.round(((currentStep + 1) / questions.length) * 100);
  const parsedLocation = useMemo(() => parseLocationPreference(answers.location ?? "", language), [answers.location, language]);
  const selectedLocationMode = locationModeDraft ?? getLocationPrimarySelection(answers.location ?? "", language);
  const sectionSummaries = useMemo<QuestionnaireSectionSummary[]>(() => {
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
  }, [questions]);
  const currentSection = useMemo(
    () =>
      [...sectionSummaries].reverse().find((section) => currentStep >= section.startIndex) ??
      sectionSummaries[0] ??
      null,
    [currentStep, sectionSummaries]
  );
  const currentSectionIndex = currentSection ? sectionSummaries.findIndex((section) => section.id === currentSection.id) : -1;
  const currentSectionPreviewQuestions = useMemo(() => {
    if (!currentQuestion || currentQuestion.type !== "section" || currentSectionIndex < 0) return [];
    const nextSectionStart = sectionSummaries[currentSectionIndex + 1]?.startIndex ?? questions.length;
    return questions.slice(currentStep + 1, nextSectionStart).filter((question) => question.type !== "section").slice(0, width >= 1080 ? 4 : 2);
  }, [currentQuestion, currentSectionIndex, currentStep, questions, sectionSummaries, width]);

  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isWideLayout = width >= 1080;
  const containerMaxWidth = isWideLayout ? 1280 : isTablet ? 960 : 680;
  const earlyStateMaxWidth = Math.min(containerMaxWidth, isWideLayout ? 840 : isTablet ? 720 : 448);
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: isTablet ? 24 : 16,
  });
  const railWidth = width >= 1320 ? 320 : 292;
  const horizontalPadding = isCompactPhone ? 16 : isTablet ? 24 : 20;
  const headerPadding = isTablet ? 24 : isCompactPhone ? 16 : 20;
  const cardPadding = isTablet ? 28 : isCompactPhone ? 18 : 22;
  const textAreaMinHeight = isWideLayout ? 260 : isTablet ? 230 : 200;
  const questionCardMinHeight = isWideLayout
    ? Math.max(700, Math.min(height * 0.74, 860))
    : isTablet
      ? Math.max(560, Math.min(height * 0.68, 720))
      : undefined;
  const questionTitleMinHeight = isWideLayout ? 112 : isTablet ? 96 : 72;
  const questionBodyMinHeight = typeof questionCardMinHeight === "number"
    ? Math.max(280, questionCardMinHeight - (isWideLayout ? 280 : 250))
    : undefined;
  const questionTitleStyle = {
    fontSize: isTablet ? 26 : 22,
    lineHeight: isTablet ? 36 : 30,
    maxWidth: isWideLayout ? 720 : undefined,
  };
  const optionTextStyle = {
    fontSize: isTablet ? 16 : 15,
    lineHeight: isTablet ? 24 : 22,
  };
  const inputTextStyle = {
    fontSize: isTablet ? 16 : 15,
    lineHeight: 22,
  };
  const textClass = isDark ? "text-white" : isGreen ? "text-white" : isLight ? "text-emerald-900" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : isLight ? "text-emerald-700" : "text-gray-600";
  const cardBgClass = isDark
    ? "bg-gray-900/80 border-gray-800"
    : isGreen
      ? "bg-emerald-900/90 border-emerald-800"
      : isLight
        ? "bg-white border-emerald-200"
        : "bg-white/90 border-gray-200";
  const inputBgClass = isDark
    ? "bg-gray-800 border-gray-700"
    : isGreen
      ? "bg-emerald-900/70 border-emerald-700"
      : isLight
        ? "bg-white border-emerald-300"
        : "bg-gray-50 border-gray-300";
  const borderClass = isDark ? "border-gray-800" : isGreen ? "border-emerald-700" : isLight ? "border-emerald-300" : "border-gray-200";
  const progressBgClass = isDark ? "bg-gray-800" : isGreen ? "bg-emerald-800" : "bg-emerald-200";
  const placeholderColor = isDark ? "#9CA3AF" : isGreen ? "#b6e2b6" : isLight ? "#1f8a5d" : "#6B7280";
  const idleOptionClass = isDark
    ? "bg-gray-800 border-gray-700"
    : isGreen
      ? "bg-emerald-900/60 border-emerald-800"
      : isLight
        ? "bg-white border-emerald-200"
        : "bg-white border-gray-200";
  const selectedOptionClass = isDark
    ? "bg-gray-700 border-gray-500"
    : isGreen
      ? "bg-emerald-800 border-emerald-500"
      : "bg-emerald-500/10 border-emerald-500";
  const selectedOptionTextClass = isDark || isGreen ? "text-white" : "text-emerald-500";
  const selectedOptionIconColor = isDark || isGreen ? "#F9FAFB" : "#008f4e";
  const sidebarItemClass = isDark
    ? "bg-gray-900/75 border-gray-800"
    : isGreen
      ? "bg-emerald-900/70 border-emerald-800"
      : isLight
        ? "bg-white/95 border-emerald-200"
        : "bg-white/95 border-gray-200";
  const activeSidebarItemClass = isDark
    ? "bg-gray-800 border-gray-600"
    : isGreen
      ? "bg-emerald-800 border-emerald-500"
      : "bg-emerald-500/10 border-emerald-500";
  const activeSidebarTextClass = isDark || isGreen ? "text-white" : "text-emerald-500";
  const activeSidebarIconColor = isDark || isGreen ? "#F9FAFB" : "#10b981";

  useEffect(() => {
    questionnaireScrollRef.current?.scrollTo({ y: 0, animated: false });
    setIsActionLocked(false);
  }, [currentStep]);

  if (!isHydrated) {
    return (
      <ScreenBackground>
        <View className="flex-1 justify-center px-6">
          <View style={{ width: "100%", maxWidth: earlyStateMaxWidth, alignSelf: "center" }}>
            <StateCard variant="loading" className="w-full" />
          </View>
        </View>
      </ScreenBackground>
    );
  }

  if (!currentQuestion) {
    return (
      <ScreenBackground>
        <View className="flex-1 justify-center px-6">
          <View style={{ width: "100%", maxWidth: earlyStateMaxWidth, alignSelf: "center" }}>
            <StateCard
              variant="error"
              title={t("general.error")}
              message={t("profile.prepareDataError")}
              actionLabel={t("general.close")}
              onAction={back}
              className="w-full"
            />
          </View>
        </View>
      </ScreenBackground>
    );
  }

  const handleAnswer = (id: string, value: string) => setAnswers((p) => ({ ...p, [id]: value }));

  const persistQuestionnaireDraft = async () => {
    const normalized = normalizeQuestionnaireAnswers(answers, language);
    await setQuestionnaireAnswers(normalized);
    return normalized;
  };

  const handleJumpToSection = async (sectionStartIndex: number) => {
    if (isActionLocked) return;

    setIsActionLocked(true);

    try {
      await persistQuestionnaireDraft();
      setCurrentStep(Math.max(0, Math.min(sectionStartIndex, questions.length - 1)));
      questionnaireScrollRef.current?.scrollTo({ y: 0, animated: false });
    } finally {
      setIsActionLocked(false);
    }
  };

  const handleNext = async () => {
    if (isActionLocked) return;

    if (currentStep < questions.length - 1) {
      setIsActionLocked(true);
      setCurrentStep((s) => Math.min(s + 1, questions.length - 1));
      return;
    }

    setIsActionLocked(true);

    try {
      const normalized = await persistQuestionnaireDraft();
      await collegeService.saveQuestionnaireResult(normalized); 
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "firestore",
        operation: "submit-questionnaire",
        severity: "warn",
        handled: true,
        source: "questionnaire-page",
        screen: "questionnaire",
        route: ROUTES.questionnaire,
      });
    } finally {
      setIsActionLocked(false);
    }

    back();
  };

  const handlePreviousQuestion = () => {
    if (isActionLocked || currentStep <= 0) return;
    setIsActionLocked(true);
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleExitQuestionnaire = async () => {
    if (isActionLocked) return;

    setIsActionLocked(true);

    try {
      await persistQuestionnaireDraft();
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "firestore",
        operation: "leave-questionnaire-page",
        severity: "warn",
        handled: true,
        source: "questionnaire-page",
        screen: "questionnaire",
        route: ROUTES.questionnaire,
      });
    } finally {
      setIsActionLocked(false);
    }

    back();
  };

  const handleSaveAndExit = async () => {
    if (isActionLocked) return;

    setIsActionLocked(true);

    try {
      const normalized = await persistQuestionnaireDraft();
      await collegeService.saveQuestionnaireResult(normalized);
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "firestore",
        operation: "save-and-exit-questionnaire",
        severity: "warn",
        handled: true,
        source: "questionnaire-page",
        screen: "questionnaire",
        route: ROUTES.questionnaire,
      });
    } finally {
      setIsActionLocked(false);
    }

    back();
  };

  return (
    <ScreenBackground>
      <ScrollView
        ref={questionnaireScrollRef}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={scrollContentPadding}
      >
        <View
          style={{
            width: "100%",
            maxWidth: containerMaxWidth,
            alignSelf: "center",
            paddingHorizontal: horizontalPadding,
          }}
        >
          <View
            style={{
              width: "100%",
              flexDirection: isWideLayout ? "row" : "column",
              alignItems: "stretch",
              gap: 24,
            }}
          >
            {isWideLayout ? (
              <View style={{ width: railWidth, flexShrink: 0 }}>
                <View className={`${cardBgClass} border rounded-3xl`} style={{ padding: cardPadding }}>
                  <Text className={`text-xs uppercase ${secondaryTextClass}`} style={{ letterSpacing: 1.8 }}>
                    {t("questionnaire.title")}
                  </Text>
                  <Text className={`mt-3 font-semibold ${textClass}`} style={{ fontSize: 24, lineHeight: 32 }}>
                    {currentSection?.title ?? t("questionnaire.title")}
                  </Text>
                  <Text className={`mt-2 text-sm ${secondaryTextClass}`}>
                    {t("questionnaire.stepOf", { step: currentStep + 1, total: questions.length })}
                  </Text>

                  <View className={`mt-6 h-2 ${progressBgClass} rounded-full overflow-hidden`}>
                    <View className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
                  </View>

                  <View className="mt-6" style={{ gap: 12 }}>
                    {sectionSummaries.map((section, index) => {
                      const isActive = currentSection?.id === section.id;
                      const isComplete = currentStep > section.endIndex;
                      const sectionDescription =
                        isActive && currentQuestion.type !== "section" ? currentQuestion.question : null;

                      return (
                        <AnimatedChipPressable
                          key={section.id}
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            void handleJumpToSection(section.startIndex);
                          }}
                          className={`rounded-2xl border px-4 py-4 ${
                            isActive ? activeSidebarItemClass : sidebarItemClass
                          }`}
                          containerStyle={{ width: "100%" }}
                          disabled={isActionLocked}
                        >
                          <View className="flex-row items-start justify-between">
                            <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                              <Text className={isActive ? `${activeSidebarTextClass} text-xs font-semibold` : `text-xs font-semibold ${secondaryTextClass}`}>
                                {String(index + 1).padStart(2, "0")}
                              </Text>
                              <Text
                                className={`${isActive ? activeSidebarTextClass : textClass} mt-2 font-semibold`}
                                style={{ fontSize: 15, lineHeight: 22 }}
                              >
                                {section.title}
                              </Text>
                              {sectionDescription ? (
                                <Text className={`mt-2 text-sm ${secondaryTextClass}`} numberOfLines={3}>
                                  {sectionDescription}
                                </Text>
                              ) : null}
                            </View>

                            <MaterialIcons
                              name={isComplete ? "check-circle" : isActive ? "radio-button-checked" : "radio-button-unchecked"}
                              size={18}
                              color={isComplete ? "#10b981" : isActive ? activeSidebarIconColor : placeholderColor}
                            />
                          </View>
                        </AnimatedChipPressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            ) : null}

            <View style={{ flex: 1, minWidth: 0, width: "100%", maxWidth: isWideLayout ? 820 : undefined, alignSelf: "center" }}>
              <View className={`${cardBgClass} border rounded-3xl`} style={{ padding: headerPadding }}>
                <View className="flex-row items-start">
                  <AnimatedIconPressable
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      void handleExitQuestionnaire();
                    }}
                    className={`h-11 w-11 mr-4 items-center justify-center rounded-2xl border ${inputBgClass}`}
                    disabled={isActionLocked}
                  >
                    <MaterialIcons name="arrow-back" size={24} color={placeholderColor} />
                  </AnimatedIconPressable>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text className={`${textClass} font-semibold`} style={{ fontSize: isTablet ? 28 : 22, lineHeight: isTablet ? 34 : 28 }}>
                      {t("questionnaire.title")}
                    </Text>
                    <Text className={`mt-1 text-sm ${secondaryTextClass}`}>
                      {t("questionnaire.stepOf", { step: currentStep + 1, total: questions.length })}
                    </Text>
                    {!isWideLayout && currentSection ? (
                      <Text className={`mt-3 ${secondaryTextClass}`} numberOfLines={2} style={{ fontSize: 14, lineHeight: 20 }}>
                        {currentSection.title}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View className={`mt-5 h-2 ${progressBgClass} rounded-full overflow-hidden`}>
                  <View className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
                </View>
              </View>

              <View
                className={`${cardBgClass} border rounded-3xl mt-5`}
                style={{ padding: cardPadding, minHeight: questionCardMinHeight }}
              >
                <View style={{ minHeight: questionTitleMinHeight, marginBottom: 24 }}>
                  <Text className={`${textClass} font-semibold`} style={questionTitleStyle}>
                    {currentQuestion.question}
                  </Text>
                </View>

                <View style={{ flexGrow: 1, minHeight: questionBodyMinHeight }}>
                {currentQuestion.type === "section" ? (
                  <View>
                    <Text className={`text-sm ${secondaryTextClass} mb-3`} style={{ lineHeight: 22 }}>
                      {t("questionnaire.sectionContinue")}
                    </Text>

                    {currentSectionPreviewQuestions.length > 0 ? (
                      <View
                        style={{
                          flexDirection: isWideLayout ? "row" : "column",
                          flexWrap: isWideLayout ? "wrap" : "nowrap",
                          gap: 12,
                        }}
                      >
                        {currentSectionPreviewQuestions.map((question, index) => (
                          <View
                            key={question.id}
                            className={`${inputBgClass} border rounded-2xl px-4 py-4`}
                            style={{ width: isWideLayout ? "48.8%" : "100%" }}
                          >
                            <Text className={`text-xs font-semibold ${secondaryTextClass}`}>
                              {String(index + 1).padStart(2, "0")}
                            </Text>
                            <Text className={`${textClass} mt-2`} style={{ fontSize: 15, lineHeight: 22 }}>
                              {question.question}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {currentQuestion.type === "textarea" ? (
                  <TextInput
                    value={answers[currentQuestion.id]}
                    onChangeText={(value) => handleAnswer(currentQuestion.id, value)}
                    placeholder={currentQuestion.placeholder}
                    placeholderTextColor={placeholderColor}
                    multiline
                    textAlignVertical="top"
                    className={`${inputBgClass} ${textClass} border rounded-2xl px-4 py-3`}
                    style={[inputTextStyle, { minHeight: textAreaMinHeight }]}
                  />
                ) : null}

                {currentQuestion.type === "text" ? (
                  <TextInput
                    value={answers[currentQuestion.id]}
                    onChangeText={(value) => handleAnswer(currentQuestion.id, value)}
                    placeholder={currentQuestion.placeholder}
                    placeholderTextColor={placeholderColor}
                    className={`${inputBgClass} ${textClass} border rounded-2xl px-4 py-3`}
                    style={inputTextStyle}
                  />
                ) : null}

                {currentQuestion.type === "location" ? (
                  <View>
                    <Text className={`text-sm ${secondaryTextClass} mb-4`} style={{ lineHeight: 22 }}>
                      {t("questionnaire.locationHint")}
                    </Text>

                    <View style={{ gap: 12 }}>
                      {currentQuestion.options.map((option) => {
                        const isSelected = selectedLocationMode === option.key;

                        return (
                          <AnimatedChipPressable
                            key={option.key}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setLocationModeDraft(option.key);

                              if (
                                option.key === "washington_only" ||
                                option.key === "near_current_location" ||
                                option.key === "no_preference"
                              ) {
                                handleAnswer(currentQuestion.id, option.key);
                                return;
                              }

                              if (option.key === "specific_state") {
                                handleAnswer(
                                  currentQuestion.id,
                                  parsedLocation.kind === "state" ? buildStateLocationPreference(parsedLocation.state) : ""
                                );
                                return;
                              }

                              if (option.key === "specific_region") {
                                handleAnswer(
                                  currentQuestion.id,
                                  parsedLocation.kind === "region" ? buildRegionLocationPreference(parsedLocation.regionKey) : ""
                                );
                                return;
                              }

                              handleAnswer(
                                currentQuestion.id,
                                parsedLocation.kind === "other" ? buildOtherLocationPreference(parsedLocation.otherText) : ""
                              );
                            }}
                            className={`rounded-2xl border px-4 py-4 ${
                              isSelected ? selectedOptionClass : idleOptionClass
                            }`}
                            containerStyle={{ width: "100%" }}
                          >
                            <View className="flex-row items-start justify-between">
                              <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                                <Text className={isSelected ? selectedOptionTextClass : textClass} style={optionTextStyle}>
                                  {option.label}
                                </Text>
                              </View>
                              {isSelected ? <MaterialIcons name="check-circle" size={20} color={selectedOptionIconColor} /> : null}
                            </View>
                          </AnimatedChipPressable>
                        );
                      })}
                    </View>

                    {selectedLocationMode === "specific_state" ? (
                      <View className="mt-5">
                        <Text className={`text-sm font-medium ${textClass} mb-3`}>
                          {t("questionnaire.locationSelectState")}
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                          {US_STATE_OPTIONS.map((stateOption) => {
                            const isSelected = parsedLocation.kind === "state" && parsedLocation.state === stateOption;

                            return (
                              <AnimatedChipPressable
                                key={stateOption}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setLocationModeDraft("specific_state");
                                  handleAnswer(currentQuestion.id, buildStateLocationPreference(stateOption));
                                }}
                                className={`px-3 py-2 rounded-xl border ${
                                  isSelected ? selectedOptionClass : borderClass
                                }`}
                              >
                                <Text className={`${isSelected ? selectedOptionTextClass : textClass} font-semibold`}>
                                  {stateOption}
                                </Text>
                              </AnimatedChipPressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}

                    {selectedLocationMode === "specific_region" ? (
                      <View className="mt-5">
                        <Text className={`text-sm font-medium ${textClass} mb-3`}>
                          {t("questionnaire.locationSelectRegion")}
                        </Text>
                        <View style={{ gap: 10 }}>
                          {currentQuestion.regionOptions.map((option) => {
                            const isSelected = parsedLocation.kind === "region" && parsedLocation.regionKey === option.key;

                            return (
                              <AnimatedChipPressable
                                key={option.key}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setLocationModeDraft("specific_region");
                                  handleAnswer(currentQuestion.id, buildRegionLocationPreference(option.key));
                                }}
                                className={`rounded-2xl border px-4 py-3 ${
                                  isSelected ? selectedOptionClass : borderClass
                                }`}
                                containerStyle={{ width: "100%" }}
                              >
                                <View className="flex-row items-start justify-between">
                                  <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                                    <Text className={`${isSelected ? selectedOptionTextClass : textClass} font-semibold`} style={optionTextStyle}>
                                      {option.label}
                                    </Text>
                                  </View>
                                  {isSelected ? <MaterialIcons name="check-circle" size={18} color={selectedOptionIconColor} /> : null}
                                </View>
                              </AnimatedChipPressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}

                    {selectedLocationMode === "other" ? (
                      <View className="mt-5">
                        <TextInput
                          value={parsedLocation.kind === "other" ? parsedLocation.otherText : ""}
                          onChangeText={(value) => handleAnswer(currentQuestion.id, buildOtherLocationPreference(value))}
                          placeholder={t("questionnaire.locationOtherPlaceholder")}
                          placeholderTextColor={placeholderColor}
                          className={`${inputBgClass} ${textClass} border rounded-2xl px-4 py-3`}
                          style={inputTextStyle}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {currentQuestion.type === "radio" ? (
                  <View style={{ gap: 12 }}>
                    {currentQuestion.options.map((option) => {
                      const isSelected = answers[currentQuestion.id] === option;

                      return (
                        <AnimatedChipPressable
                          key={option}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleAnswer(currentQuestion.id, option);
                          }}
                          className={`rounded-2xl border px-4 py-4 ${
                            isSelected ? selectedOptionClass : idleOptionClass
                          }`}
                          containerStyle={{ width: "100%" }}
                        >
                          <View className="flex-row items-start justify-between">
                            <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                              <Text className={isSelected ? selectedOptionTextClass : textClass} style={optionTextStyle}>
                                {option}
                              </Text>
                            </View>
                            {isSelected ? <MaterialIcons name="check-circle" size={20} color={selectedOptionIconColor} /> : null}
                          </View>
                        </AnimatedChipPressable>
                      );
                    })}
                  </View>
                ) : null}
                </View>

                <View className={`mt-6 pt-6 border-t ${borderClass}`} style={{ gap: 12 }}>
                  <View style={{ flexDirection: isTablet ? "row" : "column", gap: 12 }}>
                    <AppButton
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handlePreviousQuestion();
                      }}
                      label={t("general.back")}
                      variant="secondary"
                      icon={(color) => <MaterialIcons name="arrow-back" size={18} color={color} />}
                      style={{
                        flex: isTablet ? 1 : undefined,
                        width: isTablet ? undefined : "100%",
                      }}
                      disabled={!isHydrated || isActionLocked || currentStep === 0}
                    />

                    <AppButton
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        void handleNext();
                      }}
                      label={
                        isActionLocked && currentStep === questions.length - 1
                          ? t("general.loading")
                          : currentStep === questions.length - 1
                            ? t("questionnaire.complete")
                            : t("questionnaire.next")
                      }
                      icon={(color) => (
                        <MaterialIcons
                          name={currentStep === questions.length - 1 ? "check-circle-outline" : "arrow-forward"}
                          size={18}
                          color={color}
                        />
                      )}
                      style={{
                        flex: isTablet ? 1 : undefined,
                        width: isTablet ? undefined : "100%",
                      }}
                      disabled={!isHydrated || isActionLocked}
                    />
                  </View>

                  <AppButton
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      void handleSaveAndExit();
                    }}
                    label={isActionLocked ? t("general.loading") : t("questionnaire.saveAndExit")}
                    variant="secondary"
                    icon={(color) => <MaterialIcons name="save-alt" size={18} color={color} />}
                    style={{ width: "100%" }}
                    disabled={!isHydrated || isActionLocked}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

