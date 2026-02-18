import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import useBack from "@/hooks/use-back";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { collegeService } from "@/services/college.service";
import { normalizeQuestionnaireAnswers, QUESTIONNAIRE_RADIO_OPTIONS } from "@/services/questionnaire.enums";

type RadioOption = { key: string; label: string };

type Question =
  | { id: string; question: string; type: "section" }
  | { id: string; question: string; type: "text" | "textarea"; placeholder: string }
  | { id: string; question: string; type: "radio"; options: RadioOption[] };

export default function QuestionnairePage() {
  const router = useRouter();
  const back = useBack();
  const { isDark } = useAppTheme();
  const { isHydrated, state, setQuestionnaireAnswers } = useAppData();
  const { t, language } = useAppLanguage();

  const questions = useMemo<Question[]>(
    () => [
      { id: "costOfAttendance", question: t("questionnaire.costOfAttendance"), options: QUESTIONNAIRE_RADIO_OPTIONS.costOfAttendance.map((o) => ({ key: o.key, label: t(o.labelKey) })), type: "radio" },
      { id: "classSize", question: t("questionnaire.classSize"), options: QUESTIONNAIRE_RADIO_OPTIONS.classSize.map((o) => ({ key: o.key, label: t(o.labelKey) })), type: "radio" },
      { id: "transportation", question: t("questionnaire.transportation"), options: QUESTIONNAIRE_RADIO_OPTIONS.transportation.map((o) => ({ key: o.key, label: t(o.labelKey) })), type: "radio" },
      { id: "companiesNearby", question: t("questionnaire.companiesNearby"), placeholder: t("questionnaire.companiesNearbyPlaceholder"), type: "textarea" },
      { id: "inStateOutOfState", question: t("questionnaire.inStateOutOfState"), options: QUESTIONNAIRE_RADIO_OPTIONS.inStateOutOfState.map((o) => ({ key: o.key, label: t(o.labelKey) })), type: "radio" },
      { id: "housing", question: t("questionnaire.housingPreference"), options: QUESTIONNAIRE_RADIO_OPTIONS.housing.map((o) => ({ key: o.key, label: t(o.labelKey) })), type: "radio" },
      { id: "ranking", question: t("questionnaire.ranking"), options: QUESTIONNAIRE_RADIO_OPTIONS.ranking.map((o) => ({ key: o.key, label: t(o.labelKey) })), type: "radio" },
      { id: "continueEducation", question: t("questionnaire.continueEducation"), options: QUESTIONNAIRE_RADIO_OPTIONS.continueEducation.map((o) => ({ key: o.key, label: t(o.labelKey) })), type: "radio" },
      { id: "extracurriculars", question: t("questionnaire.extracurriculars"), placeholder: t("questionnaire.extracurricularsPlaceholder"), type: "textarea" },
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
    setAnswers({ ...blankAnswers, ...normalizeQuestionnaireAnswers(state.questionnaireAnswers ?? {}, language) });
  }, [isHydrated, blankAnswers, state.questionnaireAnswers, language]);

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
    // final step: do not store major in questionnaire; major lives on the profile
    const toSave = normalizeQuestionnaireAnswers({ ...answers }, language);
    delete toSave.major;
    delete toSave.majorChoice;

    await setQuestionnaireAnswers(toSave);

    try {
      await collegeService.saveQuestionnaireResult(toSave);
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
    const toSave = normalizeQuestionnaireAnswers({ ...answers }, language);
    delete toSave.major;
    delete toSave.majorChoice;
    await setQuestionnaireAnswers(toSave); 

    try {
      await collegeService.saveQuestionnaireResult(toSave);
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
                if (currentStep > 0) handleBack();
                else back();
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
                    const isSelected = answers[currentQuestion.id] === option.key;

                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          handleAnswer(currentQuestion.id, option.key);
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
                          <Text className={isSelected ? "text-green-500" : textClass}>{option.label}</Text>
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
