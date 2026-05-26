import React, { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, View, Text, TextInput, ScrollView, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { AppButton } from "@/components/ui/AppButton";
import { AnimatedChipPressable } from "@/components/ui/AnimatedPressables";
import { PageBackButton } from "@/components/ui/PageBackButton";
import { ROUTES } from "@/constants/routes";
import { StateCard } from "@/components/ui/StateCard";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import useBack from "@/hooks/use-back";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import {
  buildOtherLocationPreference,
  buildRegionLocationPreference,
  buildStateLocationPreference,
  getQuestionnaireAnswerText,
  normalizeQuestionnaireAnswers,
  parseLocationPreference,
  type QuestionnaireAnswers,
  type LocationPrimaryOptionKey,
  US_STATE_OPTIONS,
} from "@/services/app/questionnaire.enums";
import { collegeService } from "@/services/colleges/college.service";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import {
  buildBlankQuestionnaireAnswers,
  buildQuestionnaireQuestions,
  buildQuestionnaireSectionSummaries,
  countAnsweredQuestionnaireQuestions,
  filterQuestionnaireQuestionsForMode,
  findCurrentQuestionnaireSection,
  getAnswerableQuestionnaireQuestions,
  getCurrentSectionPreviewQuestions,
  getLocationPrimarySelection,
  getQuestionIconName,
  getRadioOptionLabel,
  getRadioOptionValue,
  type Question,
  type QuestionnaireMode,
  type QuestionnaireSectionSummary,
} from "@/components/pages/questionnaire/questionnaire-logic";

export default function QuestionnairePage() {
  const { isDark, isGreen, isLight } = useAppTheme();
  const { isHydrated, state, setQuestionnaireAnswers } = useAppData();
  const { t, language } = useAppLanguage();
  const { width } = useWindowDimensions();
  const { getScrollContentPadding } = useResponsiveLayout();
  const back = useBack(ROUTES.tabs);
  const questionnaireScrollRef = useRef<ScrollView>(null);
  const [questionnaireMode, setQuestionnaireMode] =
    useState<QuestionnaireMode>("basic");

  const allQuestions = useMemo<Question[]>(
    () => buildQuestionnaireQuestions(t),
    [t]
  );

  const questions = useMemo<Question[]>(
    () => filterQuestionnaireQuestionsForMode(allQuestions, questionnaireMode),
    [allQuestions, questionnaireMode]
  );

  const blankAnswers = useMemo(
    () => buildBlankQuestionnaireAnswers(allQuestions),
    [allQuestions]
  );

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(() => blankAnswers);
  const [locationModeDraft, setLocationModeDraft] = useState<LocationPrimaryOptionKey | null>(null);
  const [isActionLocked, setIsActionLocked] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;
    setAnswers({ ...blankAnswers, ...(state.questionnaireAnswers ?? {}) });
  }, [isHydrated, blankAnswers, state.questionnaireAnswers]);

  useEffect(() => {
    const locationAnswer = getQuestionnaireAnswerText(answers, "location");
    const derived = getLocationPrimarySelection(locationAnswer, language);
    if (derived) setLocationModeDraft(derived);
  }, [answers, language]);

  const currentQuestion = questions[currentStep];
  const progress = Math.round(((currentStep + 1) / questions.length) * 100);
  const locationAnswer = getQuestionnaireAnswerText(answers, "location");
  const parsedLocation = useMemo(() => parseLocationPreference(locationAnswer, language), [locationAnswer, language]);
  const selectedLocationMode = locationModeDraft ?? getLocationPrimarySelection(locationAnswer, language);
  const sectionSummaries = useMemo<QuestionnaireSectionSummary[]>(
    () => buildQuestionnaireSectionSummaries(questions),
    [questions]
  );
  const currentSection = useMemo(
    () => findCurrentQuestionnaireSection(sectionSummaries, currentStep),
    [currentStep, sectionSummaries]
  );
  const currentSectionIndex = currentSection ? sectionSummaries.findIndex((section) => section.id === currentSection.id) : -1;
  const answerableQuestions = useMemo(
    () => getAnswerableQuestionnaireQuestions(questions),
    [questions]
  );
  const answeredQuestionCount = useMemo(
    () => countAnsweredQuestionnaireQuestions(answerableQuestions, answers),
    [answerableQuestions, answers]
  );
  const completionLabel = `${answeredQuestionCount}/${answerableQuestions.length}`;
  const currentSectionPreviewQuestions = useMemo(() => {
    return getCurrentSectionPreviewQuestions({
      currentQuestion,
      currentSectionIndex,
      currentStep,
      questions,
      sectionSummaries,
      previewLimit: width >= 820 ? 4 : 2,
    });
  }, [currentQuestion, currentSectionIndex, currentStep, questions, sectionSummaries, width]);

  const isCompactPhone = width < 390;
  const isWideLayout = width >= 820;
  const usePhoneQuestionLayout = !isWideLayout;
  const isDesktopLayout = width >= 1200;
  const pageMaxWidth = isDesktopLayout ? 1280 : 1040;
  const questionnaireMaxWidth = isWideLayout ? 900 : undefined;
  const earlyStateMaxWidth = Math.min(pageMaxWidth, isDesktopLayout ? 760 : isWideLayout ? 680 : 448);
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: isWideLayout ? 24 : 16,
  });
  const horizontalPadding = isCompactPhone ? 16 : 24;
  const cardPadding = isWideLayout ? 24 : 20;
  const textAreaMinHeight = isWideLayout ? 180 : 150;
  const questionTitleStyle = {
    fontSize: isWideLayout ? 22 : 19,
    lineHeight: isWideLayout ? 30 : 26,
    maxWidth: isWideLayout ? 680 : undefined,
  };
  const optionTextStyle = {
    fontSize: 15,
    lineHeight: 22,
  };
  const inputTextStyle = {
    fontSize: 15,
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
  const optionContentStyle = {
    minHeight: 48,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 12,
  };

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

  const handleQuestionnaireModeSelect = (nextMode: QuestionnaireMode) => {
    if (nextMode === questionnaireMode || isActionLocked) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuestionnaireMode(nextMode);
    setCurrentStep(0);
    questionnaireScrollRef.current?.scrollTo({ y: 0, animated: false });
  };

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

  const renderSectionChips = () => (
    <View
      className={`border-b ${borderClass}`}
      style={{ paddingHorizontal: cardPadding, paddingVertical: usePhoneQuestionLayout ? 14 : 16 }}
    >
      <View
        style={
          usePhoneQuestionLayout
            ? { flexDirection: "column", gap: 8 }
            : { flexDirection: "row", flexWrap: "wrap", gap: 8 }
        }
      >
        {sectionSummaries.map((section, index) => {
          const isActive = currentSection?.id === section.id;
          const isComplete = currentStep > section.endIndex;

          return (
            <AnimatedChipPressable
              key={section.id}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                void handleJumpToSection(section.startIndex);
              }}
              className={`rounded-full border px-3 py-2 ${
                isActive ? selectedOptionClass : idleOptionClass
              }`}
              containerStyle={usePhoneQuestionLayout ? { width: "100%" } : undefined}
              style={
                usePhoneQuestionLayout
                  ? {
                      width: "100%",
                      minHeight: 44,
                      justifyContent: "center",
                    }
                  : undefined
              }
              disabled={isActionLocked}
            >
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <MaterialIcons
                  name={isComplete ? "check-circle" : isActive ? "radio-button-checked" : "radio-button-unchecked"}
                  size={16}
                  color={isComplete ? "#10b981" : isActive ? selectedOptionIconColor : placeholderColor}
                />
                <Text className={`${isActive ? selectedOptionTextClass : secondaryTextClass} text-xs font-semibold`}>
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <Text
                  className={`${isActive ? selectedOptionTextClass : textClass} text-sm font-semibold`}
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {section.title}
                </Text>
              </View>
            </AnimatedChipPressable>
          );
        })}
      </View>
    </View>
  );

  const renderQuestionInput = () => {
    if (currentQuestion.type === "section") {
      return (
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
                  className={`${inputBgClass} border rounded-lg px-3 py-3`}
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
      );
    }

    if (currentQuestion.type === "textarea") {
      return (
        <TextInput
          value={getQuestionnaireAnswerText(answers, currentQuestion.id)}
          onChangeText={(value) => handleAnswer(currentQuestion.id, value)}
          placeholder={currentQuestion.placeholder}
          placeholderTextColor={placeholderColor}
          multiline
          textAlignVertical="top"
          className={`${inputBgClass} ${textClass} border rounded-lg px-3 py-3`}
          style={[inputTextStyle, { minHeight: textAreaMinHeight }]}
        />
      );
    }

    if (currentQuestion.type === "text") {
      return (
        <TextInput
          value={getQuestionnaireAnswerText(answers, currentQuestion.id)}
          onChangeText={(value) => handleAnswer(currentQuestion.id, value)}
          placeholder={currentQuestion.placeholder}
          placeholderTextColor={placeholderColor}
          className={`${inputBgClass} ${textClass} border rounded-lg px-3 py-2`}
          style={inputTextStyle}
        />
      );
    }

    if (currentQuestion.type === "location") {
      return (
        <View>
          <Text className={`text-sm ${secondaryTextClass} mb-4`} style={{ lineHeight: 22 }}>
            {t("questionnaire.locationHint")}
          </Text>

          <View style={{ gap: 10 }}>
            {currentQuestion.options.map((option) => {
              const isSelected = selectedLocationMode === option.key;

              return (
                <AnimatedChipPressable
                  key={option.key}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                  className={`rounded-lg border px-3 py-2 ${
                    isSelected ? selectedOptionClass : idleOptionClass
                  }`}
                  containerStyle={{ width: "100%" }}
                >
                  <View style={optionContentStyle}>
                    <Text className={isSelected ? selectedOptionTextClass : textClass} style={[optionTextStyle, { flex: 1 }]}>
                      {option.label}
                    </Text>
                    {isSelected ? <MaterialIcons name="check-circle" size={18} color={selectedOptionIconColor} /> : null}
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
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setLocationModeDraft("specific_state");
                        handleAnswer(currentQuestion.id, buildStateLocationPreference(stateOption));
                      }}
                      className={`px-3 py-2 rounded-lg border ${
                        isSelected ? selectedOptionClass : idleOptionClass
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
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setLocationModeDraft("specific_region");
                        handleAnswer(currentQuestion.id, buildRegionLocationPreference(option.key));
                      }}
                      className={`rounded-lg border px-3 py-2 ${
                        isSelected ? selectedOptionClass : idleOptionClass
                      }`}
                      containerStyle={{ width: "100%" }}
                    >
                      <View style={optionContentStyle}>
                        <Text
                          className={`${isSelected ? selectedOptionTextClass : textClass} font-semibold`}
                          style={[optionTextStyle, { flex: 1 }]}
                        >
                          {option.label}
                        </Text>
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
                className={`${inputBgClass} ${textClass} border rounded-lg px-3 py-2`}
                style={inputTextStyle}
              />
            </View>
          ) : null}
        </View>
      );
    }

    if (currentQuestion.type === "radio") {
      return (
        <View
          style={{
            width: "100%",
            flexDirection: usePhoneQuestionLayout ? "column" : "row",
            flexWrap: usePhoneQuestionLayout ? "nowrap" : "wrap",
            gap: usePhoneQuestionLayout ? 8 : 8,
          }}
        >
          {currentQuestion.options.map((option) => {
            const optionValue = getRadioOptionValue(option);
            const optionLabel = getRadioOptionLabel(option);
            const isSelected = getQuestionnaireAnswerText(answers, currentQuestion.id) === optionValue;

            return (
              <AnimatedChipPressable
                key={optionValue}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleAnswer(currentQuestion.id, optionValue);
                }}
                className={`rounded-lg border px-3 py-2 ${
                  isSelected ? selectedOptionClass : idleOptionClass
                }`}
                containerStyle={
                  usePhoneQuestionLayout
                    ? { width: "100%" }
                    : {
                        flexGrow: 1,
                        flexBasis: 220,
                        minWidth: 220,
                      }
                }
                style={usePhoneQuestionLayout ? { width: "100%" } : undefined}
              >
                <View
                  style={{
                    minHeight: usePhoneQuestionLayout ? 46 : 44,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 8,
                  }}
                >
                  <Text
                    className={isSelected ? `${selectedOptionTextClass} font-semibold` : textClass}
                    style={[optionTextStyle, { textAlign: "center", flexShrink: 1 }]}
                  >
                    {optionLabel}
                  </Text>
                  {isSelected ? <MaterialIcons name="check-circle" size={18} color={selectedOptionIconColor} /> : null}
                </View>
              </AnimatedChipPressable>
            );
          })}
        </View>
      );
    }

    return null;
  };

  return (
    <ScreenBackground>
      <ScrollView
        ref={questionnaireScrollRef}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={scrollContentPadding}
        contentInsetAdjustmentBehavior="automatic"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        <View
          style={{
            width: "100%",
            maxWidth: pageMaxWidth,
            alignSelf: "center",
            paddingHorizontal: horizontalPadding,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: questionnaireMaxWidth,
              alignSelf: "center",
            }}
          >
            <PageBackButton
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                void handleExitQuestionnaire();
              }}
              label={t("general.back")}
              textClassName={secondaryTextClass}
              disabled={isActionLocked}
            />

            <View className="pb-3">
              <Text className={`text-2xl ${textClass} font-semibold`}>
                {t("questionnaire.title")}
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                {currentSection?.title ?? t("questionnaire.stepOf", { step: currentStep + 1, total: questions.length })}
              </Text>
            </View>

            <View
              className={`${cardBgClass} border rounded-2xl p-2 mb-3`}
              style={{
                flexDirection: usePhoneQuestionLayout ? "column" : "row",
                gap: 8,
              }}
            >
              {(["basic", "full"] as const).map((mode) => {
                const isSelected = questionnaireMode === mode;
                const label =
                  mode === "basic"
                    ? t("questionnaire.modeBasic")
                    : t("questionnaire.modeFull");
                const description =
                  mode === "basic"
                    ? t("questionnaire.modeBasicDescription")
                    : t("questionnaire.modeFullDescription");

                return (
                  <AnimatedChipPressable
                    key={mode}
                    onPress={() => handleQuestionnaireModeSelect(mode)}
                    className={`rounded-xl border px-4 py-3 ${
                      isSelected ? selectedOptionClass : idleOptionClass
                    }`}
                    containerStyle={{
                      flex: usePhoneQuestionLayout ? undefined : 1,
                      width: usePhoneQuestionLayout ? "100%" : undefined,
                    }}
                    disabled={isActionLocked}
                  >
                    <View className="flex-row items-center" style={{ gap: 10 }}>
                      <MaterialIcons
                        name={isSelected ? "radio-button-checked" : "radio-button-unchecked"}
                        size={18}
                        color={isSelected ? selectedOptionIconColor : placeholderColor}
                      />
                      <View className="flex-1 min-w-0">
                        <Text className={`${isSelected ? selectedOptionTextClass : textClass} text-sm font-semibold`}>
                          {label}
                        </Text>
                        <Text className={`${isSelected ? selectedOptionTextClass : secondaryTextClass} text-xs mt-1`}>
                          {description}
                        </Text>
                      </View>
                    </View>
                  </AnimatedChipPressable>
                );
              })}
            </View>

            <View className={`${cardBgClass} border rounded-2xl overflow-hidden`}>
              <View className="bg-emerald-500/5 px-6 py-5 border-b border-emerald-500/20">
                <View className="flex-row items-center">
                  <View className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 items-center justify-center mr-4">
                    <MaterialIcons name="assignment" size={24} color="#008f4e" />
                  </View>

                  <View className="flex-1 min-w-0">
                    <Text className={`${textClass} ${isWideLayout ? "text-xl" : "text-lg"} font-semibold`} numberOfLines={2}>
                      {t("questionnaire.title")}
                    </Text>
                    <View className="mt-2 flex-row flex-wrap items-center gap-2">
                      <View className="bg-emerald-500/10 rounded-full px-2.5 py-1 border border-emerald-500/15">
                        <Text className="text-emerald-500 text-xs font-semibold">
                          {completionLabel}
                        </Text>
                      </View>
                      <Text className={`${secondaryTextClass} text-xs`}>
                        {t("questionnaire.stepOf", { step: currentStep + 1, total: questions.length })}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className={`mt-4 h-2 ${progressBgClass} rounded-full overflow-hidden`}>
                  <View className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
                </View>
              </View>

              {renderSectionChips()}

              <View style={{ padding: cardPadding }}>
                {usePhoneQuestionLayout ? (
                  <View className="min-w-0">
                    <View className="flex-row items-start min-w-0">
                      <MaterialIcons name={getQuestionIconName(currentQuestion)} size={20} color="#008f4e" />
                      <View className="flex-1 ml-3 min-w-0">
                        {currentQuestion.type !== "section" && currentSection ? (
                          <Text className={`text-sm ${secondaryTextClass} mb-1`}>
                            {currentSection.title}
                          </Text>
                        ) : null}
                        <Text className={`${textClass} font-semibold`} style={questionTitleStyle}>
                          {currentQuestion.question}
                        </Text>
                      </View>
                    </View>
                    <View className="mt-5">
                      {renderQuestionInput()}
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-start min-w-0">
                    <MaterialIcons name={getQuestionIconName(currentQuestion)} size={20} color="#008f4e" />
                    <View className="flex-1 ml-3 min-w-0">
                      {currentQuestion.type !== "section" && currentSection ? (
                        <Text className={`text-sm ${secondaryTextClass} mb-1`}>
                          {currentSection.title}
                        </Text>
                      ) : null}
                      <Text className={`${textClass} font-semibold`} style={questionTitleStyle}>
                        {currentQuestion.question}
                      </Text>
                      <View className="mt-5">
                        {renderQuestionInput()}
                      </View>
                    </View>
                  </View>
                )}

                <View className={`mt-6 pt-6 border-t ${borderClass}`} style={{ gap: 12 }}>
                  <View style={{ flexDirection: isWideLayout ? "row" : "column", gap: 12 }}>
                    <AppButton
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handlePreviousQuestion();
                      }}
                      label={t("general.back")}
                      variant="secondary"
                      icon={(color) => <MaterialIcons name="arrow-back" size={18} color={color} />}
                      style={{
                        flex: isWideLayout ? 1 : undefined,
                        width: isWideLayout ? undefined : "100%",
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
                        flex: isWideLayout ? 1 : undefined,
                        width: isWideLayout ? undefined : "100%",
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

