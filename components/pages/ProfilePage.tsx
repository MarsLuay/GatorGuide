import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Keyboard, Dimensions, Alert, Platform } from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import ConfettiCannon from "react-native-confetti-cannon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppData } from "@/hooks/use-app-data";
import { ProfileField } from "@/components/ui/ProfileField";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

type Question =
  | { id: string; question: string; type: "text" | "textarea"; placeholder: string }
  | { id: string; question: string; type: "radio"; options: string[] };

export default function ProfilePage() {
  const { theme, setTheme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const { isHydrated, state, updateUser, setQuestionnaireAnswers, restoreData } = useAppData();
  const insets = useSafeAreaInsets();

  // Initialize audio player for celebration sound
  const cheerPlayer = useAudioPlayer('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3');

  const user = state.user;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: "",
    major: "",
    gpa: "",
    sat: "",
    act: "",
    resume: "",
    transcript: "",
  });

  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [questionnaireAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [isConfettiPlaying, setIsConfettiPlaying] = useState(false);
  const [confettiCooldown, setConfettiCooldown] = useState(false);
  const [showGuestProfile, setShowGuestProfile] = useState(false);

  useEffect(() => {
    if (!user?.isGuest) return;
    AsyncStorage.getItem("gatorguide:guestProfile:show").then((value) => {
      if (value === "true") setShowGuestProfile(true);
    });
  }, [user?.isGuest]);
  const handleExportData = async () => {
    if (!isHydrated) return;

    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        app: "GatorGuide",
        version: "1.0.0",
        data: state,
        theme,
      };

      if (Platform.OS === "web") {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "GatorGuide_export.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      const fileUri = new FileSystem.File(FileSystem.Paths.document, "GatorGuide_export.json").uri;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), {
        encoding: "utf8",
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(t("settings.exportReady"), t("settings.exportNotAvailable"));
        return;
      }

      await Sharing.shareAsync(fileUri);
    } catch {
      Alert.alert(t("settings.exportFailed"), t("settings.exportError"));
    }
  };

  const handleImportData = async () => {
    if (!isHydrated) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const fileUri = result.assets[0].uri;
      const raw = await FileSystem.readAsStringAsync(fileUri, {
        encoding: "utf8",
      });

      const parsed = JSON.parse(raw) as {
        data?: typeof state;
        theme?: string;
      };

      if (!parsed?.data) {
        Alert.alert(t("settings.invalidFile"), t("settings.invalidFileMessage"));
        return;
      }

      const dataToRestore = parsed.data as typeof state;

      Alert.alert(
        t("settings.importConfirm"),
        t("settings.importOverwriteMessage"),
        [
          { text: t("general.cancel"), style: "cancel" },
          {
            text: t("settings.import"),
            style: "destructive",
            onPress: async () => {
              await restoreData(dataToRestore);
              if (parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system") {
                setTheme(parsed.theme);
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert(t("settings.importFailed"), t("settings.importError"));
    }
  };
  const handleCreateAccount = async () => {
    if (!user?.isGuest || !isHydrated) return;

    try {
      // Save current guest data to temporary storage
      const pendingData = {
        user: {
          ...user,
          isGuest: false, // Will become a real user
        },
        questionnaireAnswers: state.questionnaireAnswers,
      };
      await AsyncStorage.setItem("gatorguide:pending-account-data", JSON.stringify(pendingData));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push("/login");
    } catch {
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    }
  };
  const confettiRef = useRef<any>(null);

  const questions = useMemo<Question[]>(
    () => [
      {
        id: "volunteerActivities",
        question: t("questionnaire.volunteerActivities"),
        placeholder: t("questionnaire.volunteerPlaceholder"),
        type: "textarea",
      },
      {
        id: "extracurriculars",
        question: t("questionnaire.extracurriculars"),
        placeholder: t("questionnaire.extracurricularsPlaceholder"),
        type: "textarea",
      },
      {
        id: "collegeSetting",
        question: t("questionnaire.collegeSetting"),
        options: [t("questionnaire.urban"), t("questionnaire.suburban"), t("questionnaire.rural"), t("questionnaire.noPreference")],
        type: "radio",
      },
      {
        id: "collegeSize",
        question: t("questionnaire.collegeSize"),
        options: [t("questionnaire.small"), t("questionnaire.medium"), t("questionnaire.large"), t("questionnaire.noPreference")],
        type: "radio",
      },
      {
        id: "environment",
        question: t("questionnaire.environment"),
        options: [t("questionnaire.researchFocused"), t("questionnaire.liberalArts"), t("questionnaire.technical"), t("questionnaire.preProfessional"), t("questionnaire.mixed")],
        type: "radio",
      },
      {
        id: "programs",
        question: t("questionnaire.programs"),
        placeholder: t("questionnaire.programsPlaceholder"),
        type: "textarea",
      },
      {
        id: "budget",
        question: t("questionnaire.budget"),
        options: [t("questionnaire.under20k"), t("questionnaire.20to40k"), t("questionnaire.40to60k"), t("questionnaire.over60k"), t("questionnaire.needFinancialAid")],
        type: "radio",
      },
      {
        id: "location",
        question: t("questionnaire.location"),
        placeholder: t("questionnaire.locationPlaceholder"),
        type: "text",
      },
      {
        id: "housingPreference",
        question: t("questionnaire.housingPreference"),
        options: [t("questionnaire.onCampus"), t("questionnaire.offCampus"), t("questionnaire.commute"), t("questionnaire.noPreference")],
        type: "radio",
      },
      {
        id: "careerGoals",
        question: t("questionnaire.careerGoals"),
        placeholder: t("questionnaire.careerGoalsPlaceholder"),
        type: "textarea",
      },
    ],
    [t]
  );

  const blankAnswers = useMemo(() => {
    const init: Record<string, string> = {};
    for (const q of questions) init[q.id] = "";
    return init;
  }, [questions]);

  useEffect(() => {
    if (!isHydrated) return;
    setEditData({
      name: user?.name ?? "",
      major: user?.major ?? "",
      gpa: user?.gpa ?? "",
      sat: user?.sat ?? "",
      act: user?.act ?? "",
      resume: user?.resume ?? "",
      transcript: user?.transcript ?? "",
    });
    setLocalAnswers({ ...blankAnswers, ...(state.questionnaireAnswers ?? {}) });
  }, [isHydrated, user?.name, user?.major, user?.gpa, user?.sat, user?.act, user?.resume, user?.transcript, blankAnswers, state.questionnaireAnswers]);

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

  const capitalizeWords = (text: string | undefined) => {
    if (!text) return "";
    return text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  };

  const handleSave = () => {
    if (!user) return;
    updateUser({
      name: editData.name,
      major: editData.major,
      gpa: editData.gpa,
      sat: editData.sat,
      act: editData.act,
      resume: editData.resume,
      transcript: editData.transcript,
    });
    setIsEditing(false);
  };

  const handleGpaChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      const num = parseFloat(value);
      if (value === "" || value === "0" || value === "0." || (Number.isFinite(num) && num <= 4.0)) {
        setEditData((p) => ({ ...p, gpa: value }));
        // Celebrate perfect GPA! 🎉
        if (num === 4.0 && value === "4" && !confettiCooldown) {
          setIsConfettiPlaying(true);
          setConfettiCooldown(true);
          setTimeout(() => setIsConfettiPlaying(false), 6000);
          setTimeout(() => setConfettiCooldown(false), 1000);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Play cheer sound
          cheerPlayer.play();
        } else if (value !== "4" && isConfettiPlaying) {
          setIsConfettiPlaying(false);
        }
      }
    }
  };

  const handlePickResume = () => {
    // stub for now; can add expo-document-picker later
    setEditData((p) => ({ ...p, resume: "resume.pdf" }));
  };

  const handlePickTranscript = () => {
    // stub for now; can add expo-document-picker later
    setEditData((p) => ({ ...p, transcript: "transcript.pdf" }));
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
            <Text className={`text-xl ${textClass} mb-2`}>{t("profile.notSignedIn")}</Text>
            <Text className={`${secondaryTextClass} mb-4`}>
              {t("profile.notSignedInMessage")}
            </Text>
            <Pressable
              onPress={() => router.replace("/login")}
              className="bg-green-500 rounded-lg py-4 items-center"
              disabled={!isHydrated}
            >
              <Text className="text-black font-semibold">{t("profile.goToLogin")}</Text>
            </Pressable>
          </View>
        </View>
      </ScreenBackground>
    );
  }

  // If guest user, show only create profile button
  if (user.isGuest && !showGuestProfile) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-md">
            <View className="items-center mb-8">
              <View className="bg-green-500 p-4 rounded-full mb-4">
                <MaterialIcons name="person-add" size={48} color="black" />
              </View>
              
              <Text className={`text-3xl ${textClass} text-center font-semibold mb-2`}>{t("profile.createYourProfile")}</Text>
              <Text className={`${secondaryTextClass} text-center text-base`}>
                {t("profile.createProfileMessage")}
              </Text>
            </View>

            <Pressable
              onPress={() => router.push("/login")}
              className="bg-green-500 rounded-lg py-4 px-6 items-center flex-row justify-center"
            >
              <MaterialIcons name="arrow-forward" size={20} color="black" />
              <Text className="text-black font-semibold ml-2">{t("profile.createYourProfile")}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowGuestProfile(true);
                AsyncStorage.setItem("gatorguide:guestProfile:show", "true").catch(() => {});
              }}
              className={`${cardBgClass} border rounded-lg py-3 px-6 items-center mt-3`}
            >
              <Text className={secondaryTextClass}>{t("profile.continueAsGuest")}</Text>
            </Pressable>
          </View>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <>
      <ScreenBackground>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        <View className="max-w-md w-full self-center">
          {user.isGuest && showGuestProfile ? (
            <View className="px-6 pt-6">
              <View className={`${cardBgClass} border-2 border-green-500/20 rounded-2xl p-5 mb-4`}>
                <View className="flex-row items-center mb-3">
                  <View className="bg-green-500/20 p-2 rounded-lg mr-3">
                    <MaterialIcons name="cloud-upload" size={20} color="#22C55E" />
                  </View>
                  <View className="flex-1">
                    <Text className={`${textClass} font-semibold`}>{t("profile.guestMode")}</Text>
                    <Text className={`${secondaryTextClass} text-xs`}>{t("profile.yourDataSaved")}</Text>
                  </View>
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={handleImportData}
                    className="flex-1 bg-green-500 rounded-xl px-4 py-3 flex-row items-center justify-center"
                  >
                    <MaterialIcons name="file-download" size={18} color="black" />
                    <Text className="text-black font-semibold ml-2">{t("settings.import")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleExportData}
                    className={`flex-1 ${cardBgClass} border-2 border-green-500 rounded-xl px-4 py-3 flex-row items-center justify-center`}
                  >
                    <MaterialIcons name="file-upload" size={18} color="#22C55E" />
                    <Text className="text-green-500 font-semibold ml-2">{t("settings.export")}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
          {/* Header */}
          <View className="px-6 pt-8 pb-6 flex-row items-center justify-between">
            <Text className={`text-2xl ${textClass}`}>{t("profile.edit")}</Text>

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
              <Text className="text-black font-semibold ml-2">{isEditing ? t("profile.save") : t("profile.edit")}</Text>
            </Pressable>
          </View>

          <View className="px-6">
            {/* Profile Card */}
            <View className={`${cardBgClass} border rounded-2xl overflow-hidden`}>
              {/* Header with gradient effect for guests */}
              {user.isGuest ? (
                <View className="bg-gradient-to-br from-green-500/10 to-green-500/5 px-6 py-6 border-b border-green-500/20">
                  <View className="flex-row items-center">
                    <View className="w-20 h-20 bg-green-500 rounded-full items-center justify-center mr-4 shadow-lg">
                      <MaterialIcons name="person" size={36} color="black" />
                    </View>
                    <View className="flex-1">
                      <Text className={`${textClass} text-2xl font-bold mb-1`}>{capitalizeWords(user.name)}</Text>
                      <View className="bg-green-500/20 rounded-full px-3 py-1 self-start">
                        <Text className="text-green-500 text-xs font-semibold">{t("profile.guestMode")}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ) : (
                <View className="px-6 pt-6 pb-4">
                  <View className="flex-row items-center mb-2">
                    <View className="w-20 h-20 bg-green-500 rounded-full items-center justify-center mr-4">
                      <Text className="text-black text-2xl font-bold">{user.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className={`${textClass} text-xl font-semibold mb-1`}>{capitalizeWords(user.name)}</Text>
                      <Text className={secondaryTextClass}>{user.email}</Text>
                    </View>
                  </View>
                </View>
              )}

              <View className="px-6 py-6">

              {!user.isGuest && (
                <ProfileField
                  type="text"
                  icon="person"
                  label={t("profile.name")}
                  value={capitalizeWords(user.name)}
                  isEditing={isEditing}
                  editValue={editData.name}
                  onChangeText={(t) => setEditData((p) => ({ ...p, name: t }))}
                  placeholder={t("profile.enterYourName")}
                  placeholderColor={placeholderColor}
                  inputBgClass={inputBgClass}
                  inputClass={inputClass}
                  textClass={textClass}
                  secondaryTextClass={secondaryTextClass}
                  borderClass={borderClass}
                />
              )}

              {user.isGuest ? (
                <Pressable
                  onPress={handleCreateAccount}
                  className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-5 flex-row items-center justify-between mb-4"
                >
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center mb-2">
                      <MaterialIcons name="stars" size={20} color="black" />
                      <Text className="text-black font-bold text-base ml-2">{t("profile.createAccount")}</Text>
                    </View>
                    <Text className="text-black/80 text-sm">{t("profile.saveDataMessage")}</Text>
                  </View>
                  <MaterialIcons name="arrow-forward" size={24} color="black" />
                </Pressable>
              ) : (
                <ProfileField
                  type="display"
                  icon="mail"
                  label={t("profile.email")}
                  value={user.email}
                  isEditing={false}
                  textClass={textClass}
                  secondaryTextClass={secondaryTextClass}
                  borderClass={borderClass}
                />
              )}

              <ProfileField
                type="text"
                icon="school"
                label={t("profile.major")}
                value={capitalizeWords(user.major) || t("profile.undecided")}
                isEditing={isEditing}
                editValue={editData.major}
                onChangeText={(t) => setEditData((p) => ({ ...p, major: t }))}
                placeholder={t("profile.majorPlaceholder")}
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
                label={t("profile.gpa")}
                value={user.gpa}
                isEditing={isEditing}
                editValue={editData.gpa}
                onChangeText={handleGpaChange}
                placeholder={t("profile.gpaPlaceholder")}
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
                label={t("profile.sat")}
                value={user.sat}
                isEditing={isEditing}
                editValue={editData.sat}
                onChangeText={(t) => setEditData((p) => ({ ...p, sat: t }))}
                placeholder={t("profile.satPlaceholder")}
                placeholderColor={placeholderColor}
                inputBgClass={inputBgClass}
                inputClass={inputClass}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                borderClass={borderClass}
              />

              <ProfileField
                type="text"
                icon="notes"
                label={t("profile.act")}
                value={user.act}
                isEditing={isEditing}
                editValue={editData.act}
                onChangeText={(t) => setEditData((p) => ({ ...p, act: t }))}
                placeholder={t("profile.actPlaceholder")}
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
                label={t("profile.resume")}
                value={user.resume}
                isEditing={isEditing}
                editValue={editData.resume}
                onPress={handlePickResume}
                uploadText={t("profile.uploadResume")}
                emptyText={t("profile.notUploaded")}
                inputBgClass={inputBgClass}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                borderClass={borderClass}
              />

              <ProfileField
                type="upload"
                icon="upload-file"
                label={t("profile.transcript")}
                value={user.transcript}
                isEditing={isEditing}
                editValue={editData.transcript}
                onPress={handlePickTranscript}
                uploadText={t("profile.uploadTranscript")}
                emptyText={t("profile.notUploaded")}
                inputBgClass={inputBgClass}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                borderClass={borderClass}
              />              </View>            </View>

            {/* Questionnaire */}
            <View className={`${cardBgClass} border rounded-2xl p-6 mt-4`}>
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <MaterialIcons name="assignment" size={20} color="#22C55E" />
                  <Text className={`text-lg ${textClass} ml-3`}>{t("profile.questionnaire")}</Text>
                </View>

                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowQuestionnaire(!showQuestionnaire);
                  }}
                >
                  <Text className="text-green-500 text-sm">
                    {hasQuestionnaireData ? t("profile.edit") : t("profile.complete")}
                  </Text>
                </Pressable>
              </View>

              <Text className={`text-sm ${secondaryTextClass}`}>
                {hasQuestionnaireData
                  ? t("profile.questionnaireCompleted")
                  : t("profile.questionnairePrompt")}
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
                      <Text className={secondaryTextClass}>{t("general.close")}</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        handleSaveQuestionnaire();
                      }}
                      className="flex-1 bg-green-500 rounded-lg py-3 items-center"
                    >
                      <Text className="text-black font-semibold">{t("profile.saveAnswers")}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
    {isConfettiPlaying && (
      <ConfettiCannon
        key="confetti"
        ref={confettiRef}
        count={150}
        origin={{ x: Dimensions.get('window').width / 2, y: -10 }}
        autoStart={true}
        fadeOut={true}
        fallSpeed={3000}
      />
    )}
    </>
  );
}
