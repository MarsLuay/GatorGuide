import { useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Keyboard, Alert, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import ConfettiCannon from "react-native-confetti-cannon";
import * as DocumentPicker from "expo-document-picker";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";
import { storageService } from "@/services/storage.service";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { FormInput } from "@/components/ui/FormInput";
import { roadmapService } from "@/services/roadmap.service";

type SelectedDocument = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export default function ProfileSetupPage() {
  const router = useRouter();
  const { updateUser, state } = useAppData();
  const { t } = useAppLanguage();
  const styles = useThemeStyles();

  const confettiRef = useRef<ConfettiCannon | null>(null);
  const cheerPlayer = useAudioPlayer("https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3");

  const [step, setStep] = useState(1);
  const [major, setMajor] = useState("");
  const [resumeDoc, setResumeDoc] = useState<SelectedDocument | null>(null);
  const [transcriptDoc, setTranscriptDoc] = useState<SelectedDocument | null>(null);
  const [gpa, setGpa] = useState("");

  const [isConfettiPlaying, setIsConfettiPlaying] = useState(false);
  const [confettiCooldown, setConfettiCooldown] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handlePickDocument = async (type: "resume" | "transcript") => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const selected: SelectedDocument = {
        uri: asset.uri,
        name: asset.name || asset.uri.split("/").pop() || `${type}_${Date.now()}`,
        mimeType: asset.mimeType,
        size: asset.size,
      };

      if (type === "resume") setResumeDoc(selected);
      else setTranscriptDoc(selected);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error(err);
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else router.replace("/(tabs)");
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

  const uploadSelectedDocument = async (
    userId: string,
    selectedDoc: SelectedDocument | null,
    folder: "resumes" | "transcripts",
    type: "resume" | "transcript"
  ): Promise<string> => {
    if (!selectedDoc?.uri) return "";
    if (!selectedDoc.uri.startsWith("file")) return selectedDoc.uri;

    if (db) {
      try {
        const response = await fetch(selectedDoc.uri);
        const blob = await response.blob();
        const storage = getStorage();
        const fileRef = ref(storage, `users/${userId}/${folder}/${Date.now()}-${selectedDoc.name}`);
        await uploadBytes(fileRef, blob);
        return await getDownloadURL(fileRef);
      } catch (error) {
        console.warn(`Failed to upload ${type} to Firebase, falling back to local storage.`, error);
      }
    }

    if (type === "resume") {
      const localFile = await storageService.uploadResume(userId, selectedDoc.uri);
      return localFile.url;
    }
    const localFile = await storageService.uploadTranscript(userId, selectedDoc.uri);
    return localFile.url;
  };

  const handleContinue = async () => {
    try {
      const userId = state.user?.uid;
      if (!userId) {
        router.replace("/login");
        return;
      }

      setIsUploading(true);

      const finalResumeUrl = await uploadSelectedDocument(userId, resumeDoc, "resumes", "resume");
      const finalTranscriptUrl = await uploadSelectedDocument(userId, transcriptDoc, "transcripts", "transcript");

      const flatData = {
        major,
        gpa: gpa || "",
        resume: finalResumeUrl,
        transcript: finalTranscriptUrl,
        isProfileComplete: true,
      };

      if (db) {
        const userDocRef = doc(db, "users", userId);
        await setDoc(
          userDocRef,
          {
            ...flatData,
            resumeFileName: resumeDoc?.name || "",
            transcriptFileName: transcriptDoc?.name || "",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      await updateUser(flatData);

      try {
        await roadmapService.generateInitialRoadmap(userId, major, gpa);
      } catch {
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

  const renderUploadCard = (
    label: string,
    placeholder: string,
    selectedDoc: SelectedDocument | null,
    onPick: () => void,
    onClear: () => void
  ) => (
    <View>
      <Text className={`text-sm ${styles.secondaryTextClass} mb-2`}>{label}</Text>

      <View className={`${styles.cardBgClass} border rounded-lg px-4 py-4`}>
        <Pressable onPress={onPick} className="flex-row items-center justify-between">
          <Text numberOfLines={1} className={`flex-1 mr-3 ${selectedDoc ? styles.textClass : styles.secondaryTextClass}`}>
            {selectedDoc?.name || placeholder}
          </Text>
          <MaterialIcons name={selectedDoc ? "check-circle" : "upload-file"} size={20} color="#22C55E" />
        </Pressable>

        {!!selectedDoc && (
          <View className="mt-3 pt-3 border-t border-zinc-300/40 dark:border-zinc-700/60 flex-row items-center justify-between">
            <Text className={`text-xs ${styles.secondaryTextClass}`}>{selectedDoc.mimeType || "document"}</Text>
            <Pressable onPress={onClear} hitSlop={8}>
              <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );

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
              <MaterialIcons name="arrow-back" size={20} color={styles.secondaryTextClass.includes("white") ? "#9CA3AF" : "#6B7280"} />
              <Text className={`ml-2 ${styles.secondaryTextClass}`}>{t("setup.previous")}</Text>
            </Pressable>

            <View className={`${styles.cardBgClass} border rounded-2xl p-5`}>
              <Text className={`text-2xl font-semibold ${styles.textClass}`}>{t("setup.title")}</Text>
              <Text className={`${styles.secondaryTextClass} mt-1 mb-5`}>{t("setup.subtitle")}</Text>

              <View className="mb-4">
                <View className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <View className="h-full bg-green-500" style={{ width: `${(step / 3) * 100}%` }} />
                </View>
              </View>

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
                </>
              )}

              {step === 3 && (
                <View className="gap-4">
                  {renderUploadCard(
                    t("setup.resume"),
                    t("setup.uploadResume"),
                    resumeDoc,
                    () => handlePickDocument("resume"),
                    () => setResumeDoc(null)
                  )}

                  {renderUploadCard(
                    t("setup.transcript"),
                    t("setup.uploadTranscript"),
                    transcriptDoc,
                    () => handlePickDocument("transcript"),
                    () => setTranscriptDoc(null)
                  )}
                </View>
              )}

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
                      if (isUploading) return;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      handleContinue();
                    }}
                    className="flex-1 bg-green-500 rounded-lg py-4 items-center flex-row justify-center"
                  >
                    <Text className="text-black font-semibold mr-2">{isUploading ? `${t("setup.continue")}...` : t("setup.continue")}</Text>
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
          origin={{ x: Dimensions.get("window").width / 2, y: -10 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={3000}
        />
      )}
    </>
  );
}
