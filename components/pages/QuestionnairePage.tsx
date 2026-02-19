import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Keyboard } from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { collegeService } from "@/services/college.service";

type Question =
  | { id: string; question: string; type: "section" }
  | { id: string; question: string; type: "text" | "textarea"; placeholder: string }
  | { id: string; question: string; type: "radio"; options: string[] };

export default function QuestionnairePage() {
  const { isDark } = useAppTheme();
  const { isHydrated, state, setQuestionnaireAnswers } = useAppData();
  const { t } = useAppLanguage();

  const questions = useMemo<Question[]>(
    () => [
      { id: "sectionData", question: t("questionnaire.sectionDataWeNeed"), type: "section" },
      { id: "advisor", question: t("questionnaire.advisor"), placeholder: t("questionnaire.advisorPlaceholder"), type: "text" },
      { id: "gpa", question: t("questionnaire.gpa"), placeholder: t("questionnaire.gpaPlaceholder"), type: "text" },
      { id: "weather", question: t("questionnaire.weather"), options: [t("questionnaire.weatherWarm"), t("questionnaire.weatherCold"), t("questionnaire.weatherMild"), t("questionnaire.noPreference")], type: "radio" },
      { id: "costOfAttendance", question: t("questionnaire.costOfAttendance"), options: [t("questionnaire.under20k"), t("questionnaire.20to40k"), t("questionnaire.40to60k"), t("questionnaire.over60k"), t("questionnaire.needFinancialAid")], type: "radio" },
      { id: "graduationRate", question: t("questionnaire.graduationRate"), options: [t("questionnaire.veryImportant"), t("questionnaire.somewhatImportant"), t("questionnaire.notImportant")], type: "radio" },
      { id: "acceptanceRate", question: t("questionnaire.acceptanceRate"), options: [t("questionnaire.veryImportant"), t("questionnaire.somewhatImportant"), t("questionnaire.notImportant")], type: "radio" },
      { id: "location", question: t("questionnaire.location"), placeholder: t("questionnaire.locationPlaceholder"), type: "text" },
      { id: "collegeVibe", question: t("questionnaire.collegeVibe"), placeholder: t("questionnaire.collegeVibePlaceholder"), type: "textarea" },
      { id: "transportation", question: t("questionnaire.transportation"), options: [t("questionnaire.transportCar"), t("questionnaire.transportTransit"), t("questionnaire.transportBike"), t("questionnaire.transportWalk"), t("questionnaire.noPreference")], type: "radio" },
      { id: "companiesNearby", question: t("questionnaire.companiesNearby"), placeholder: t("questionnaire.companiesNearbyPlaceholder"), type: "textarea" },
      { id: "inStateOutOfState", question: t("questionnaire.inStateOutOfState"), options: [t("questionnaire.inState"), t("questionnaire.outOfState"), t("questionnaire.noPreference")], type: "radio" },
      { id: "housing", question: t("questionnaire.housingPreference"), options: [t("questionnaire.onCampus"), t("questionnaire.offCampus"), t("questionnaire.commute"), t("questionnaire.noPreference")], type: "radio" },
      { id: "studentStaffRatio", question: t("questionnaire.studentStaffRatio"), placeholder: t("questionnaire.studentStaffRatioPlaceholder"), type: "text" },
      { id: "internationalStudentRatio", question: t("questionnaire.internationalStudentRatio"), placeholder: t("questionnaire.ratioPlaceholder"), type: "text" },
      { id: "taxRates", question: t("questionnaire.taxRates"), placeholder: t("questionnaire.taxRatesPlaceholder"), type: "text" },
      { id: "ranking", question: t("questionnaire.ranking"), options: [t("questionnaire.veryImportant"), t("questionnaire.somewhatImportant"), t("questionnaire.notImportant")], type: "radio" },
      { id: "researchOpportunities", question: t("questionnaire.researchOpportunities"), placeholder: t("questionnaire.researchOpportunitiesPlaceholder"), type: "textarea" },
      { id: "major", question: t("questionnaire.major"), placeholder: t("questionnaire.majorPlaceholder"), type: "text" },
      { id: "continueEducation", question: t("questionnaire.continueEducation"), options: [t("questionnaire.yes"), t("questionnaire.no"), t("questionnaire.maybe")], type: "radio" },
      { id: "graduationDate", question: t("questionnaire.graduationDate"), placeholder: t("questionnaire.graduationDatePlaceholder"), type: "text" },
      { id: "quarterSemesterSystem", question: t("questionnaire.quarterSemesterSystem"), options: [t("questionnaire.quarter"), t("questionnaire.semester"), t("questionnaire.noPreference")], type: "radio" },
      { id: "transferStudentRate", question: t("questionnaire.transferStudentRate"), placeholder: t("questionnaire.ratioPlaceholder"), type: "text" },
      { id: "extracurriculars", question: t("questionnaire.extracurriculars"), placeholder: t("questionnaire.extracurricularsPlaceholder"), type: "textarea" },
      { id: "timeZone", question: t("questionnaire.timeZone"), placeholder: t("questionnaire.timeZonePlaceholder"), type: "text" },
      { id: "deadline", question: t("questionnaire.deadline"), placeholder: t("questionnaire.deadlinePlaceholder"), type: "text" },
      { id: "majorExploration", question: t("questionnaire.majorExploration"), placeholder: t("questionnaire.majorExplorationPlaceholder"), type: "textarea" },
      { id: "certifications", question: t("questionnaire.certifications"), placeholder: t("questionnaire.certificationsPlaceholder"), type: "textarea" },
      { id: "associatesForTransfer", question: t("questionnaire.associatesForTransfer"), options: [t("questionnaire.yes"), t("questionnaire.no"), t("questionnaire.considering")], type: "radio" },
      { id: "salary", question: t("questionnaire.salary"), placeholder: t("questionnaire.salaryPlaceholder"), type: "text" },
      { id: "workEnvironment", question: t("questionnaire.workEnvironment"), placeholder: t("questionnaire.workEnvironmentPlaceholder"), type: "textarea" },
      { id: "yearsToComplete", question: t("questionnaire.yearsToComplete"), placeholder: t("questionnaire.yearsToCompletePlaceholder"), type: "text" },
      { id: "demand", question: t("questionnaire.demand"), options: [t("questionnaire.demandHigh"), t("questionnaire.demandMedium"), t("questionnaire.demandLow"), t("questionnaire.unsure")], type: "radio" },
      { id: "howCompetitive", question: t("questionnaire.howCompetitive"), options: [t("questionnaire.veryCompetitive"), t("questionnaire.moderate"), t("questionnaire.lessCompetitive"), t("questionnaire.unsure")], type: "radio" },
      { id: "personalInterest", question: t("questionnaire.personalInterest"), placeholder: t("questionnaire.personalInterestPlaceholder"), type: "textarea" },
      { id: "typesOfOccupation", question: t("questionnaire.typesOfOccupation"), placeholder: t("questionnaire.typesOfOccupationPlaceholder"), type: "textarea" },
      { id: "opportunitiesToExpatriate", question: t("questionnaire.opportunitiesToExpatriate"), options: [t("questionnaire.yes"), t("questionnaire.no"), t("questionnaire.maybe")], type: "radio" },
      { id: "sectionAcademicPlan", question: t("questionnaire.sectionAcademicPlan"), type: "section" },
      { id: "requiredCourses", question: t("questionnaire.requiredCourses"), placeholder: t("questionnaire.requiredCoursesPlaceholder"), type: "textarea" },
      { id: "recommendedCourses", question: t("questionnaire.recommendedCourses"), placeholder: t("questionnaire.recommendedCoursesPlaceholder"), type: "textarea" },
      { id: "resourcesOnCampus", question: t("questionnaire.resourcesOnCampus"), placeholder: t("questionnaire.resourcesOnCampusPlaceholder"), type: "textarea" },
      { id: "sectionPersonalStatement", question: t("questionnaire.sectionPersonalStatement"), type: "section" },
      { id: "personalStatementFocus", question: t("questionnaire.personalStatementFocus"), options: [t("questionnaire.grammar"), t("questionnaire.spelling"), t("questionnaire.punctuation"), t("questionnaire.allOfTheAbove")], type: "radio" },
      { id: "sectionOccupation", question: t("questionnaire.sectionOccupation"), type: "section" },
      { id: "internships", question: t("questionnaire.internships"), placeholder: t("questionnaire.internshipsPlaceholder"), type: "textarea" },
      { id: "entryLevelPosition", question: t("questionnaire.entryLevelPosition"), placeholder: t("questionnaire.entryLevelPositionPlaceholder"), type: "textarea" },
      { id: "resumeSkills", question: t("questionnaire.resumeSkills"), placeholder: t("questionnaire.resumeSkillsPlaceholder"), type: "textarea" },
      { id: "platforms", question: t("questionnaire.platforms"), placeholder: t("questionnaire.platformsPlaceholder"), type: "textarea" },
    ],
    [t]
  );

  const blankAnswers = useMemo(() => {
    const init: Record<string, string> = {};
    for (const q of questions) if (q.type !== "section") init[q.id] = "";
    return init;
  }, [questions]);

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => blankAnswers);

  useEffect(() => {
    if (!isHydrated) return;
    setAnswers({ ...blankAnswers, ...(state.questionnaireAnswers ?? {}) });
  }, [isHydrated, blankAnswers, state.questionnaireAnswers]);

  const currentQuestion = questions[currentStep];
  const progress = Math.round(((currentStep + 1) / questions.length) * 100);

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";
  const cardBgClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white border-gray-200";
  const inputBgClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/90 border-gray-200";
  const borderClass = isDark ? "border-gray-800" : "border-gray-200";
  const progressBgClass = isDark ? "bg-gray-900/70" : "bg-gray-200";
  const placeholderColor = isDark ? "#9CA3AF" : "#6B7280";

  const handleAnswer = (id: string, value: string) => setAnswers((p) => ({ ...p, [id]: value }));

  const handleNext = async () => { 
    if (currentStep < questions.length - 1) {
      setCurrentStep((s) => s + 1);
      return;
    }
    
    await setQuestionnaireAnswers(answers); 
    
    try {

      await collegeService.saveQuestionnaireResult(answers); 
    } catch (error) {
      console.error("Firebase sync failed", error);
    }
    
    router.back(); 
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
    else router.back();
  };

  const handleSaveAndExit = async () => { 
    await setQuestionnaireAnswers(answers); 
    
    try {
      await collegeService.saveQuestionnaireResult(answers);
    } catch (error) {
      console.error("Firebase sync failed", error);
    }
    
    router.back();
  };

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="max-w-md w-full self-center">
          {/* Header */}
          <View className="px-6 pt-8 pb-4 flex-row items-center">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                handleBack();
              }}
              className="mr-4"
            >
              <MaterialIcons name="arrow-back" size={24} color={isDark ? "#9CA3AF" : "#6B7280"} />
            </Pressable>

            <View className="flex-1">
              <Text className={`text-xl ${textClass}`}>{t("questionnaire.title")}</Text>
              <Text className={`text-sm ${secondaryTextClass}`}>
                {t("questionnaire.stepOf", { step: currentStep + 1, total: questions.length })}
              </Text>
            </View>
          </View>

          {/* Progress */}
          <View className="px-6 mb-8">
            <View className={`h-2 ${progressBgClass} rounded-full overflow-hidden`}>
              <View className="h-full bg-green-500" style={{ width: `${progress}%` }} />
            </View>
          </View>

          {/* Card */}
          <View className="px-6">
            <View className={`${cardBgClass} border rounded-2xl p-6`}>
              <Text className={`text-lg ${textClass} mb-6`}>{currentQuestion.question}</Text>

              {currentQuestion.type === "section" ? (
                <Text className={`text-sm ${secondaryTextClass} mb-2`}>{t("questionnaire.sectionContinue")}</Text>
              ) : null}

              {currentQuestion.type === "textarea" ? (
                <TextInput
                  value={answers[currentQuestion.id]}
                  onChangeText={(t) => handleAnswer(currentQuestion.id, t)}
                  placeholder={currentQuestion.placeholder}
                  placeholderTextColor={placeholderColor}
                  multiline
                  textAlignVertical="top"
                  className={`min-h-[220px] ${inputBgClass} ${textClass} border rounded-lg px-4 py-3`}
                />
              ) : null}

              {currentQuestion.type === "text" ? (
                <TextInput
                  value={answers[currentQuestion.id]}
                  onChangeText={(t) => handleAnswer(currentQuestion.id, t)}
                  placeholder={currentQuestion.placeholder}
                  placeholderTextColor={placeholderColor}
                  className={`${inputBgClass} ${textClass} border rounded-lg px-4 py-3`}
                />
              ) : null}

              {currentQuestion.type === "radio" ? (
                <View className="gap-3">
                  {currentQuestion.options.map((option) => {
                    const isSelected = answers[currentQuestion.id] === option;

                    return (
                      <Pressable
                        key={option}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          handleAnswer(currentQuestion.id, option);
                        }}
                        className={`w-full px-4 py-4 rounded-lg border ${
                          isSelected
                            ? "bg-green-500/10 border-green-500"
                            : isDark
                            ? "bg-gray-900/70 border-gray-800"
                            : "bg-white/90 border-gray-200"
                        }`}
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className={isSelected ? "text-green-500" : textClass}>{option}</Text>
                          {isSelected ? <MaterialIcons name="check-circle" size={20} color="#22C55E" /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {/* Footer */}
              <View className={`mt-6 pt-6 border-t ${borderClass} gap-3`}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleNext();
                  }}
                  className={`w-full bg-green-500 rounded-lg py-4 items-center ${!isHydrated ? "opacity-60" : ""}`}
                  disabled={!isHydrated}
                >
                  <Text className="text-black font-semibold">
                    {currentStep === questions.length - 1 ? t("questionnaire.complete") : t("questionnaire.next")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleSaveAndExit();
                  }}
                  className={`w-full ${isDark ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-300"} border rounded-lg py-4 items-center ${!isHydrated ? "opacity-60" : ""}`}
                  disabled={!isHydrated}
                >
                  <Text className={`${textClass} font-semibold`}>{t("questionnaire.saveAndExit")}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
