import { useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Keyboard, Alert, Dimensions } from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import ConfettiCannon from "react-native-confetti-cannon";
import * as DocumentPicker from 'expo-document-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from "@/services/firebase";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { FormInput } from "@/components/ui/FormInput";
import { roadmapService } from "@/services/roadmap.service";

export default function ProfileSetupPage() {
  const { updateUser, state } = useAppData();
  const { t } = useAppLanguage();
  const styles = useThemeStyles();

  const confettiRef = useRef<ConfettiCannon | null>(null);

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
  const [isUploading, setIsUploading] = useState(false);

  const handlePickDocument = async (type: 'resume' | 'transcript') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf', 
          'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const fileUri = result.assets[0].uri;
        if (type === 'resume') {
          setResume(fileUri);
        } else {
          setTranscript(fileUri);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePickResume = () => handlePickDocument('resume');
  const handlePickTranscript = () => handlePickDocument('transcript');

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
        if (num === 4.0 && (value === "4" || value === "4.0") && !confettiCooldown) {
          setIsConfettiPlaying(true);
          setConfettiCooldown(true);
          setTimeout(() => setIsConfettiPlaying(false), 6000);
          setTimeout(() => setConfettiCooldown(false), 1000);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (cheerPlayer) cheerPlayer.play();
        }
      }
    }
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleContinue = async () => {
    try {
      const userId = state.user?.uid;
      
      if (!userId) {
        router.replace("/login");
        return;
      }

      setIsUploading(true);

      const canUseFirebase = !!db;

      const uploadFile = async (uri: string, folder: string) => {
        if (!uri || !uri.startsWith('file')) return uri;
        const response = await fetch(uri);
        const blob = await response.blob();
        const storage = getStorage();
        const fileRef = ref(storage, `users/${userId}/${folder}/${Date.now()}`);
        await uploadBytes(fileRef, blob);
        return await getDownloadURL(fileRef);
      };

      let finalResumeUrl = resume;
      let finalTranscriptUrl = transcript;

      if (canUseFirebase) {
        if (resume) finalResumeUrl = await uploadFile(resume, 'resumes');
        if (transcript) finalTranscriptUrl = await uploadFile(transcript, 'transcripts');
      }

      const flatData = {
        major,
        gpa: gpa || "", 
        sat: sat || "",
        act: act || "",
        resume: finalResumeUrl, 
        transcript: finalTranscriptUrl, 
        isProfileComplete: true, 
      };

      if (db) {
        const userDocRef = doc(db, 'users', userId);
        await setDoc(userDocRef, {
          ...flatData,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      await updateUser(flatData);
      
      try {
        await roadmapService.generateInitialRoadmap(userId, major, gpa);
      } catch (e) {
        console.warn("Roadmap generation failed, but profile saved.");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)"); 
    } catch (error) {
      console.error(error);
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    } finally {
      setIsUploading(false);
    }
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