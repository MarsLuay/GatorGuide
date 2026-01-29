import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";
import { ProfileField } from "@/components/ui/ProfileField";

type Question =
  | { id: string; question: string; type: "text" | "textarea"; placeholder: string }
  | { id: string; question: string; type: "radio"; options: string[] };

export default function ProfilePage() {
  const { isDark } = useAppTheme();
  const { isHydrated, state, updateUser, setQuestionnaireAnswers } = useAppData();

  const user = state.user;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    major: "",
    gpa: "",
    testScores: "",
    resume: "",
  });

  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [questionnaireAnswers, setLocalAnswers] = useState<Record<string, string>>({});

  const questions = useMemo<Question[]>(
    () => [
      {
        id: "volunteerActivities",
        question: "What volunteer activities have you participated in?",
        placeholder: "Describe your volunteer experiences...",
        type: "textarea",
      },
      {
        id: "extracurriculars",
        question: "What extracurricular activities are you involved in?",
        placeholder: "List your activities and roles...",
        type: "textarea",
      },
      {
        id: "collegeSetting",
        question: "What type of college setting do you prefer?",
        options: ["Urban", "Suburban", "Rural", "No Preference"],
        type: "radio",
      },
      {
        id: "collegeSize",
        question: "What size college are you looking for?",
        options: ["Small (< 5,000)", "Medium (5,000-15,000)", "Large (> 15,000)", "No Preference"],
        type: "radio",
      },
      {
        id: "environment",
        question: "What kind of campus environment appeals to you?",
        options: ["Research-focused", "Liberal Arts", "Technical/Engineering", "Pre-professional", "Mixed"],
        type: "radio",
      },
      {
        id: "programs",
        question: "Are there specific programs or resources you're looking for?",
        placeholder: "e.g., Study abroad, research opportunities, internships...",
        type: "textarea",
      },
      {
        id: "budget",
        question: "What is your budget range for annual tuition?",
        options: ["< $20,000", "$20,000 - $40,000", "$40,000 - $60,000", "> $60,000", "Need financial aid"],
        type: "radio",
      },
      {
        id: "location",
        question: "Do you have a preferred geographic location?",
        placeholder: "Enter preferred states, regions, or countries...",
        type: "text",
      },
      {
        id: "housingPreference",
        question: "What are your housing preferences?",
        options: ["On-campus dormitory", "Off-campus apartment", "Commute from home", "No preference"],
        type: "radio",
      },
      {
        id: "careerGoals",
        question: "What are your career goals after graduation?",
        placeholder: "Describe your aspirations and career path...",
        type: "textarea",
      },
    ],
    []
  );

  const blankAnswers = useMemo(() => {
    const init: Record<string, string> = {};
    for (const q of questions) init[q.id] = "";
    return init;
  }, [questions]);

  useEffect(() => {
    if (!isHydrated) return;
    setEditData({
      major: user?.major ?? "",
      gpa: user?.gpa ?? "",
      testScores: user?.testScores ?? "",
      resume: user?.resume ?? "",
    });
    setLocalAnswers({ ...blankAnswers, ...(state.questionnaireAnswers ?? {}) });
  }, [isHydrated, user?.major, user?.gpa, user?.testScores, user?.resume, blankAnswers, state.questionnaireAnswers]);

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";
  const cardBgClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/90 border-gray-200";
  const inputBgClass = isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/90 border-gray-200";
  const inputClass = `w-full ${inputBgClass} ${textClass} border rounded-lg px-3 py-2`;
  const borderClass = isDark ? "border-gray-800" : "border-gray-200";
  const placeholderColor = isDark ? "#9CA3AF" : "#6B7280";

  const hasQuestionnaireData = useMemo(
    () => Object.keys(state.questionnaireAnswers ?? {}).length > 0,
    [state.questionnaireAnswers]
  );

  const handleSave = () => {
    if (!user) return;
    updateUser({
      major: editData.major,
      gpa: editData.gpa,
      testScores: editData.testScores,
      resume: editData.resume,
    });
    setIsEditing(false);
  };

  const handleGpaChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      const num = parseFloat(value);
      if (value === "" || value === "0" || value === "0." || (Number.isFinite(num) && num <= 4.0)) {
        setEditData((p) => ({ ...p, gpa: value }));
      }
    }
  };

  const handlePickResume = () => {
    // stub for now; can add expo-document-picker later
    setEditData((p) => ({ ...p, resume: "resume.pdf" }));
  };

  const handleQuestionnaireAnswer = (id: string, value: string) => {
    setLocalAnswers((p) => ({ ...p, [id]: value }));
  };

  const handleSaveQuestionnaire = async () => {
    await setQuestionnaireAnswers(questionnaireAnswers);
    setShowQuestionnaire(false);
  };

  // If not signed in yet, show a simple prompt (prevents null crashes)
  if (!user) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center px-6">
          <View className={`${cardBgClass} border rounded-2xl p-6 w-full max-w-md`}>
            <Text className={`text-xl ${textClass} mb-2`}>Not signed in</Text>
            <Text className={`${secondaryTextClass} mb-4`}>
              Create an account or sign in to edit your profile.
            </Text>
            <Pressable
              onPress={() => router.replace("/login")}
              className="bg-green-500 rounded-lg py-4 items-center"
              disabled={!isHydrated}
            >
              <Text className="text-black font-semibold">Go to Login</Text>
            </Pressable>
          </View>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="max-w-md w-full self-center">
          {/* Header */}
          <View className="px-6 pt-8 pb-6 flex-row items-center justify-between">
            <Text className={`text-2xl ${textClass}`}>Profile</Text>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (isEditing) {
                  handleSave();
                } else {
                  setIsEditing(true);
                }
              }}
              className="bg-green-500 rounded-lg px-4 py-3 flex-row items-center"
            >
              <MaterialIcons name={isEditing ? "save" : "edit"} size={16} color="black" />
              <Text className="text-black font-semibold ml-2">{isEditing ? "Save" : "Edit"}</Text>
            </Pressable>
          </View>

          <View className="px-6">
            {/* Profile Card */}
            <View className={`${cardBgClass} border rounded-2xl p-6`}>
              <View className="flex-row items-center mb-6">
                <View className="w-20 h-20 bg-green-500 rounded-full items-center justify-center mr-4">
                  <Text className="text-black text-2xl font-bold">{user.name.charAt(0).toUpperCase()}</Text>
                </View>

                <View>
                  <Text className={`text-xl ${textClass}`}>{user.name}</Text>
                  <Text className={secondaryTextClass}>{user.email}</Text>
                </View>
              </View>

              <ProfileField
                type="display"
                icon="mail"
                label="Email"
                value={user.email}
                isEditing={false}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                borderClass={borderClass}
              />

              <ProfileField
                type="text"
                icon="school"
                label="Major"
                value={user.major}
                isEditing={isEditing}
                editValue={editData.major}
                onChangeText={(t) => setEditData((p) => ({ ...p, major: t }))}
                placeholder="e.g., Computer Science"
                placeholderColor={placeholderColor}
                inputBgClass={inputBgClass}
                inputClass={inputClass}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                borderClass={borderClass}
              />

              <ProfileField
                type="text"
                icon="description"
                label="GPA (0.0 - 4.0)"
                value={user.gpa}
                isEditing={isEditing}
                editValue={editData.gpa}
                onChangeText={handleGpaChange}
                placeholder="e.g., 3.8"
                placeholderColor={placeholderColor}
                inputBgClass={inputBgClass}
                inputClass={inputClass}
                keyboardType="decimal-pad"
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                borderClass={borderClass}
              />

              <ProfileField
                type="text"
                icon="notes"
                label="Test Scores"
                value={user.testScores}
                isEditing={isEditing}
                editValue={editData.testScores}
                onChangeText={(t) => setEditData((p) => ({ ...p, testScores: t }))}
                placeholder="e.g., SAT: 1450"
                placeholderColor={placeholderColor}
                inputBgClass={inputBgClass}
                inputClass={inputClass}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                borderClass={borderClass}
              />

              <ProfileField
                type="upload"
                icon="upload-file"
                label="Resume"
                value={user.resume}
                isEditing={isEditing}
                editValue={editData.resume}
                onPress={handlePickResume}
                uploadText="Upload resume"
                emptyText="Not uploaded"
                inputBgClass={inputBgClass}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                borderClass={borderClass}
              />
            </View>

            {/* Questionnaire */}
            <View className={`${cardBgClass} border rounded-2xl p-6 mt-4`}>
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <MaterialIcons name="assignment" size={20} color="#22C55E" />
                  <Text className={`text-lg ${textClass} ml-3`}>Questionnaire</Text>
                </View>

                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowQuestionnaire(!showQuestionnaire);
                  }}
                >
                  <Text className="text-green-500 text-sm">{hasQuestionnaireData ? "Edit" : "Complete"}</Text>
                </Pressable>
              </View>

              <Text className={`text-sm ${secondaryTextClass}`}>
                {hasQuestionnaireData
                  ? "Your preferences have been saved. Tap Edit to update your responses."
                  : "Complete the questionnaire to get personalized college recommendations."}
              </Text>

              {/* Questionnaire Expanded View - All Questions at Once */}
              {showQuestionnaire && (
                <View className={`mt-6 pt-6 border-t ${borderClass}`}>
                  <ScrollView nestedScrollEnabled>
                    <View className="gap-6">
                      {questions.map((question) => (
                        <View key={question.id}>
                          <Text className={`text-sm font-semibold ${textClass} mb-3`}>{question.question}</Text>

                          {/* Text/Textarea Input */}
                          {(question.type === "text" || question.type === "textarea") && (
                            <TextInput
                              value={questionnaireAnswers[question.id] ?? ""}
                              onChangeText={(value) => handleQuestionnaireAnswer(question.id, value)}
                              placeholder={question.placeholder}
                              placeholderTextColor={placeholderColor}
                              multiline={question.type === "textarea"}
                              textAlignVertical={question.type === "textarea" ? "top" : undefined}
                              className={`${inputClass} ${question.type === "textarea" ? "min-h-[100px]" : "min-h-[44px]"}`}
                            />
                          )}

                          {/* Radio Options */}
                          {question.type === "radio" && (
                            <View className="gap-2">
                              {question.options.map((option) => {
                                const isSelected = questionnaireAnswers[question.id] === option;
                                return (
                                  <Pressable
                                    key={option}
                                    onPress={() => {
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                      handleQuestionnaireAnswer(question.id, option);
                                    }}
                                    className={`px-4 py-3 rounded-lg border ${
                                      isSelected
                                        ? "bg-green-500/10 border-green-500"
                                        : borderClass
                                    }`}
                                  >
                                    <View className="flex-row items-center justify-between">
                                      <Text className={isSelected ? "text-green-500 font-semibold" : textClass}>{option}</Text>
                                      {isSelected && <MaterialIcons name="check-circle" size={18} color="#22C55E" />}
                                    </View>
                                  </Pressable>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Save/Close Buttons */}
                  <View className="flex-row gap-3 mt-6 pt-6 border-t border-gray-300">
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowQuestionnaire(false);
                      }}
                      className={`flex-1 rounded-lg py-3 items-center border ${borderClass}`}
                    >
                      <Text className={secondaryTextClass}>Close</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        handleSaveQuestionnaire();
                      }}
                      className="flex-1 bg-green-500 rounded-lg py-3 items-center"
                    >
                      <Text className="text-black font-semibold">Save Answers</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
