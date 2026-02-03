import { useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Keyboard, Dimensions } from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import ConfettiCannon from "react-native-confetti-cannon";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { FormInput } from "@/components/ui/FormInput";

export default function ProfileSetupPage() {
  const { updateUser } = useAppData();
  const { t } = useAppLanguage();
  const styles = useThemeStyles();

  // Initialize audio player for celebration sound
  const cheerPlayer = useAudioPlayer('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3');

  const [step, setStep] = useState(1);
  const [major, setMajor] = useState("");
  const [resume, setResume] = useState("");
  const [transcript, setTranscript] = useState("");
  const [gpa, setGpa] = useState("");
  const [sat, setSat] = useState("");
  const [act, setAct] = useState("");
  const [isConfettiPlaying, setIsConfettiPlaying] = useState(false);
  const [confettiCooldown, setConfettiCooldown] = useState(false);

  const confettiRef = useRef<any>(null);

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.replace("/(tabs)");
    }
  };

  const handleGpaChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      const num = parseFloat(value);
      if (value === "" || (Number.isFinite(num) && num <= 4.0) || value === "0" || value === "0.") {
        setGpa(value);
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

  const handleSkip = () => {
    router.replace("/(tabs)");
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleContinue = async () => {
    await updateUser({
      major,
      gpa,
      sat,
      act,
      resume,
      transcript,
    });
    router.replace("/(tabs)");
  };

  const handlePickResume = () => {
    // stub for now (Expo Go file picking will be added later)
    setResume("resume.pdf");
  };

  const handlePickTranscript = () => {
    // stub for now (Expo Go file picking will be added later)
    setTranscript("transcript.pdf");
  };

  return (
    <>
      <ScreenBackground>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
        >
          <View className="w-full max-w-md self-center px-6 pt-20">
            <Pressable onPress={handleBack} className="mb-6 flex-row items-center">
              <MaterialIcons name="arrow-back" size={20} color={styles.placeholderColor} />
            </Pressable>

            <View className="mb-8">
              <Text className={`text-2xl ${styles.textClass} mb-2`}>{t("setup.setupProfile")}</Text>
              <Text className={styles.secondaryTextClass}>
                {t("setup.tellUs")}
              </Text>
            </View>

            <View className="flex-row gap-2 mb-8">
              <View className={`h-1 flex-1 rounded ${step >= 1 ? "bg-green-500" : styles.progressBgClass}`} />
              <View className={`h-1 flex-1 rounded ${step >= 2 ? "bg-green-500" : styles.progressBgClass}`} />
              <View className={`h-1 flex-1 rounded ${step >= 3 ? "bg-green-500" : styles.progressBgClass}`} />
            </View>

            <View className="gap-4">
              {/* Step 1: Major */}
              {step === 1 && (
                <FormInput
                  label={t("setup.major")}
                  value={major}
                  onChangeText={setMajor}
                  placeholder={t("setup.majorPlaceholder")}
                  textClass={styles.textClass}
                  secondaryTextClass={styles.secondaryTextClass}
                  inputBgClass={styles.inputBgClass}
                  placeholderColor={styles.placeholderColor}
                />
              )}

              {/* Step 2: GPA & Test Scores */}
              {step === 2 && (
                <>
                  <FormInput
                    label={t("setup.gpa")}
                    value={gpa}
                    onChangeText={handleGpaChange}
                    placeholder={t("setup.gpaPlaceholder")}
                    keyboardType="decimal-pad"
                    textClass={styles.textClass}
                    secondaryTextClass={styles.secondaryTextClass}
                    inputBgClass={styles.inputBgClass}
                    placeholderColor={styles.placeholderColor}
                  />

                  <FormInput
                    label={t("setup.sat")}
                    value={sat}
                    onChangeText={setSat}
                    placeholder={t("setup.satPlaceholder")}
                    keyboardType="number-pad"
                    textClass={styles.textClass}
                    secondaryTextClass={styles.secondaryTextClass}
                    inputBgClass={styles.inputBgClass}
                    placeholderColor={styles.placeholderColor}
                  />

                  <FormInput
                    label={t("setup.act")}
                    value={act}
                    onChangeText={setAct}
                    placeholder={t("setup.actPlaceholder")}
                    keyboardType="number-pad"
                    textClass={styles.textClass}
                    secondaryTextClass={styles.secondaryTextClass}
                    inputBgClass={styles.inputBgClass}
                    placeholderColor={styles.placeholderColor}
                  />
                </>
              )}

              {/* Step 3: Resume & Transcript */}
              {step === 3 && (
                <View className="gap-4">
                  <View>
                    <Text className={`text-sm ${styles.secondaryTextClass} mb-2`}>{t("setup.resume")}</Text>

                    <Pressable
                      onPress={handlePickResume}
                      className={`${styles.cardBgClass} border rounded-lg px-4 py-4 flex-row items-center justify-between`}
                    >
                      <Text className={resume ? styles.textClass : styles.secondaryTextClass}>{resume || t("setup.uploadResume")}</Text>
                      <MaterialIcons name="upload-file" size={20} color="#22C55E" />
                    </Pressable>

                    <Text className={`text-xs ${styles.secondaryTextClass} mt-2`}>
                      {t("setup.fileUploadStub")}
                    </Text>
                  </View>

                  <View>
                    <Text className={`text-sm ${styles.secondaryTextClass} mb-2`}>{t("setup.transcript")}</Text>

                    <Pressable
                      onPress={handlePickTranscript}
                      className={`${styles.cardBgClass} border rounded-lg px-4 py-4 flex-row items-center justify-between`}
                    >
                      <Text className={transcript ? styles.textClass : styles.secondaryTextClass}>{transcript || t("setup.uploadTranscript")}</Text>
                      <MaterialIcons name="upload-file" size={20} color="#22C55E" />
                    </Pressable>

                    <Text className={`text-xs ${styles.secondaryTextClass} mt-2`}>
                      {t("setup.fileUploadStub")}
                    </Text>
                  </View>
                </View>
              )}

              {/* Navigation Buttons */}
              <View className="flex-row gap-4 pt-6">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleBack();
                  }}
                  className={`flex-1 rounded-lg py-4 items-center border ${styles.cardBgClass}`}
                >
                  <Text className={styles.secondaryTextClass}>{step === 1 ? t("setup.exit") : t("setup.previous")}</Text>
                </Pressable>
                {step < 3 ? (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleNext();
                    }}
                    className="flex-1 bg-green-500 rounded-lg py-4 items-center flex-row justify-center"
                  >
                    <Text className="text-black font-semibold mr-2">{t("setup.next")}</Text>
                    <MaterialIcons name="arrow-forward" size={18} color="black" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      handleContinue();
                    }}
                    className="flex-1 bg-green-500 rounded-lg py-4 items-center flex-row justify-center"
                  >
                    <Text className="text-black font-semibold mr-2">{t("setup.continue")}</Text>
                    <MaterialIcons name="arrow-forward" size={18} color="black" />
                  </Pressable>
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
