import { useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Keyboard, useWindowDimensions, Alert } from "react-native";
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
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { FormInput } from "@/components/ui/FormInput";
import { roadmapService } from "@/services/roadmap.service";
import { useTranslation } from "react-i18next";

export default function ProfileSetupPage() {
  const { t } = useTranslation();
  const { state, updateUser } = useAppData();
  const styles = useThemeStyles();
  const { width } = useWindowDimensions();

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

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.replace("/login");
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

      if (resume) finalResumeUrl = await uploadFile(resume, 'resumes');
      if (transcript) finalTranscriptUrl = await uploadFile(transcript, 'transcripts');

      const flatData = {
        major,
        gpa: gpa || "", 
        sat: sat || "",
        act: act || "",
        resume: finalResumeUrl, 
        transcript: finalTranscriptUrl, 
        isProfileComplete: true, 
      };

      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, {
        ...flatData,
        updatedAt: serverTimestamp(),
      }, { merge: true });

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
      Alert.alert(t('common.save_failed'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <ScreenBackground>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <View className="w-full max-w-md self-center px-6 pt-20">
            <Pressable onPress={handleBack} className="mb-6 flex-row items-center">
              <MaterialIcons name="arrow-back" size={20} color={styles.placeholderColor} />
            </Pressable>

            <View className="mb-8">
              <Text className={`text-2xl ${styles.textClass} mb-2 font-bold`}>{t('setup.title')}</Text>
              <Text className={styles.secondaryTextClass}>
                {t('setup.subtitle')}
              </Text>
            </View>

            <View className="flex-row gap-2 mb-8">
              <View className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-green-500" : styles.progressBgClass}`} />
              <View className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-green-500" : styles.progressBgClass}`} />
              <View className={`h-1.5 flex-1 rounded-full ${step >= 3 ? "bg-green-500" : styles.progressBgClass}`} />
            </View>

            <View className="gap-4">
              {step === 1 && (
                <FormInput
                  label={t('setup.major')}
                  value={major}
                  onChangeText={setMajor}
                  placeholder={t('setup.major_placeholder')}
                  textClass={styles.textClass}
                  secondaryTextClass={styles.secondaryTextClass}
                  inputBgClass={styles.inputBgClass}
                  placeholderColor={styles.placeholderColor}
                />
              )}

              {step === 2 && (
                <>
                  <FormInput 
                    label={t('setup.gpa')} 
                    value={gpa} 
                    onChangeText={handleGpaChange} 
                    keyboardType="decimal-pad" 
                    placeholder={t('setup.gpa_placeholder')} 
                    textClass={styles.textClass} 
                    secondaryTextClass={styles.secondaryTextClass} 
                    inputBgClass={styles.inputBgClass} 
                    placeholderColor={styles.placeholderColor} 
                  />
                  <FormInput 
                    label={t('setup.sat')} 
                    value={sat} 
                    onChangeText={setSat} 
                    keyboardType="number-pad" 
                    placeholder={t('setup.sat_placeholder')} 
                    textClass={styles.textClass} 
                    secondaryTextClass={styles.secondaryTextClass} 
                    inputBgClass={styles.inputBgClass} 
                    placeholderColor={styles.placeholderColor} 
                  />
                  <FormInput 
                    label={t('setup.act')} 
                    value={act} 
                    onChangeText={setAct} 
                    keyboardType="number-pad" 
                    placeholder={t('setup.act_placeholder')} 
                    textClass={styles.textClass} 
                    secondaryTextClass={styles.secondaryTextClass} 
                    inputBgClass={styles.inputBgClass} 
                    placeholderColor={styles.placeholderColor} 
                  />
                </>
              )}

              {step === 3 && (
                <View className="gap-4">
                  <View>
                    <Text className={`text-sm ${styles.secondaryTextClass} mb-2 font-medium`}>{t('setup.resume')}</Text>
                    <Pressable onPress={() => handlePickDocument('resume')} className={`${styles.cardBgClass} border border-slate-800 rounded-xl p-4 flex-row justify-between items-center`}>
                      <Text numberOfLines={1} className={`flex-1 mr-2 ${resume ? styles.textClass : styles.secondaryTextClass}`}>
                        {resume ? resume.split('/').pop() : t('common.select_file')}
                      </Text>
                      <MaterialIcons name="file-present" size={20} color="#22C55E" />
                    </Pressable>
                  </View>
                  <View>
                    <Text className={`text-sm ${styles.secondaryTextClass} mb-2 font-medium`}>{t('setup.transcript')}</Text>
                    <Pressable onPress={() => handlePickDocument('transcript')} className={`${styles.cardBgClass} border border-slate-800 rounded-xl p-4 flex-row justify-between items-center`}>
                      <Text numberOfLines={1} className={`flex-1 mr-2 ${transcript ? styles.textClass : styles.secondaryTextClass}`}>
                        {transcript ? transcript.split('/').pop() : t('common.select_file')}
                      </Text>
                      <MaterialIcons name="description" size={20} color="#22C55E" />
                    </Pressable>
                  </View>
                </View>
              )}

              <View className="flex-row gap-4 pt-6">
                <Pressable onPress={handleBack} className={`flex-1 rounded-xl py-4 border ${styles.cardBgClass}`}>
                  <Text className={`text-center font-medium ${styles.secondaryTextClass}`}>
                    {step === 1 ? t('common.exit') : t('common.back')}
                  </Text>
                </Pressable>
                
                <Pressable 
                  onPress={() => (step < 3 ? handleNext() : handleContinue())} 
                  disabled={isUploading}
                  className={`flex-1 ${isUploading ? 'bg-gray-400' : 'bg-green-500'} rounded-xl py-4 items-center shadow-lg active:opacity-90`}
                >
                  <Text className="text-black font-bold">
                    {isUploading ? t('common.saving') : (step < 3 ? t('common.next') : t('common.finish'))}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </ScreenBackground>

      {isConfettiPlaying && (
        <ConfettiCannon 
          count={150} 
          origin={{ x: width / 2, y: -20 }} 
          autoStart={true} 
          fadeOut={true} 
        />
      )}
    </>
  );
}