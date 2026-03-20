import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Animated, Alert, Platform, Linking } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppData } from "@/hooks/use-app-data";
import {
  aiService,
  buildAiConversationContext,
  ChatMessage,
  errorLoggingService,
  roadmapService,
  ROADMAP_DOCUMENT_KEYS,
  ROADMAP_SECTION_ORDER,
  type RoadmapDocumentKey,
  type RoadmapSectionId,
  type RoadmapTask,
  type UserRoadmapDocument,
} from "@/services";
import { useAppTheme } from "@/hooks/use-app-theme";
import useBack from "@/hooks/use-back";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storageService } from "@/services/storage.service";
import { APP_VERSION } from "@/constants/app-version";
import { StateCard } from "@/components/ui/StateCard";

type GroupedTasks = { id: RoadmapSectionId; name: string; data: RoadmapTask[] };

const slugify = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const getDisplayFileName = (value?: string | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const withoutQuery = raw.split("?")[0];
  const segments = withoutQuery.split("/");
  return decodeURIComponent(segments[segments.length - 1] || raw);
};

export default function RoadmapPage() {
  const router = useRouter();
  const styles = useThemeStyles();
  const { t } = useAppLanguage();
  const { theme, setTheme, isDark, isGreen } = useAppTheme();
  const back = useBack();
  const { state, restoreData, isHydrated } = useAppData();
  const { textClass, secondaryTextClass, cardBgClass, borderClass } = styles;
  const user = state.user;
  const userId = user?.uid ?? "";

  const [roadmap, setRoadmap] = useState<UserRoadmapDocument | null>(null);
  const [isRoadmapLoading, setIsRoadmapLoading] = useState(false);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({ "documents-checklist": true });
  const [newInterestInput, setNewInterestInput] = useState("");
  const [newCourseInput, setNewCourseInput] = useState("");
  const [newSchoolInput, setNewSchoolInput] = useState("");
  const [activeClubs, setActiveClubs] = useState<string[]>([]);
  const [currentCourses, setCurrentCourses] = useState<string[]>([]);
  const [targetSchools, setTargetSchools] = useState<string[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [activeUpload, setActiveUpload] = useState<RoadmapDocumentKey | null>(null);
  const [showGuestRoadmap, setShowGuestRoadmap] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [roadmapLoadError, setRoadmapLoadError] = useState<string | null>(null);
  const [roadmapLoadAttempt, setRoadmapLoadAttempt] = useState(0);

  const roadmapSeed = useMemo(
    () =>
      roadmapService.buildRoadmapSeedInput({
        major: user?.major,
        gpa: user?.gpa,
        questionnaireAnswers: state.questionnaireAnswers,
        targetSchools: (state.savedColleges ?? []).map((college) => college.name),
        documents: {
          ...(user?.resume ? { resume: { fileName: getDisplayFileName(user.resume), fileUrl: user.resume } } : {}),
          ...(user?.transcript
            ? { transcripts: { fileName: getDisplayFileName(user.transcript), fileUrl: user.transcript } }
            : {}),
        },
      }),
    [state.questionnaireAnswers, state.savedColleges, user?.gpa, user?.major, user?.resume, user?.transcript]
  );

  const applyRoadmap = useCallback((nextRoadmap: UserRoadmapDocument) => {
    setRoadmap(nextRoadmap);
    setCurrentCourses(nextRoadmap.profileSnapshot.currentCourses);
    setTargetSchools(nextRoadmap.profileSnapshot.targetSchools);
    setActiveClubs(nextRoadmap.profileSnapshot.interests);
  }, []);

  const persistRoadmap = useCallback(
    async (nextRoadmap: UserRoadmapDocument) => {
      if (!userId) return;
      if (user?.isGuest) {
        applyRoadmap(nextRoadmap);
        return;
      }
      const savedRoadmap = await roadmapService.saveUserRoadmap(userId, nextRoadmap);
      applyRoadmap(savedRoadmap);
    },
    [applyRoadmap, user?.isGuest, userId]
  );

  useEffect(() => {
    if (!user?.isGuest) return;
    AsyncStorage.getItem("gatorguide:guestRoadmap:show").then((value) => {
      if (value === "true") setShowGuestRoadmap(true);
    });
  }, [user?.isGuest]);

  useEffect(() => {
    if (!isHydrated || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) setRoadmapLoadError(null);
        setIsRoadmapLoading(true);
        const nextRoadmap = user?.isGuest
          ? roadmapService.createInitialRoadmap(userId, roadmapSeed)
          : await roadmapService.ensureUserRoadmap(userId, roadmapSeed);
        if (!cancelled) applyRoadmap(nextRoadmap);
      } catch (error) {
        void errorLoggingService.captureException(error, {
          category: "firestore",
          operation: "load-roadmap",
          severity: "error",
          handled: true,
          source: "roadmap-page",
          screen: "roadmap",
          route: "/roadmap",
          metadata: {
            userId,
            isGuest: !!user?.isGuest,
          },
        });
        if (!cancelled) {
          setRoadmap(null);
          setRoadmapLoadError(error instanceof Error ? error.message : t("profile.prepareDataError"));
        }
      } finally {
        if (!cancelled) setIsRoadmapLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyRoadmap, isHydrated, roadmapLoadAttempt, roadmapSeed, t, user?.isGuest, userId]);

  useEffect(() => {
    if (!roadmap || !userId) return;
    let cancelled = false;
    (async () => {
      const documentsTask = roadmap.sections.documents.tasks.find((task) => task.id === "documents-checklist");
      if (!documentsTask?.documents) return;
      const storedDocuments = {
        resume: await storageService.getResume(userId),
        transcripts: await storageService.getTranscript(userId),
        personalStatement: await storageService.getDocument(userId, "personalStatement"),
        recommendation1: await storageService.getDocument(userId, "recommendation1"),
        recommendation2: await storageService.getDocument(userId, "recommendation2"),
      } satisfies Record<RoadmapDocumentKey, Awaited<ReturnType<typeof storageService.getDocument>>>;
      let nextRoadmap = roadmap;
      let changed = false;
      for (const docKey of ROADMAP_DOCUMENT_KEYS) {
        const uploaded = storedDocuments[docKey];
        if (!uploaded) continue;
        const existing = documentsTask.documents[docKey];
        if (existing.fileName === uploaded.name && existing.fileUrl === uploaded.url && existing.status === "completed") continue;
        nextRoadmap = roadmapService.updateRoadmapDocument(nextRoadmap, docKey, {
          fileName: uploaded.name,
          fileUrl: uploaded.url,
        });
        changed = true;
      }
      if (!changed || cancelled) return;
      if (user?.isGuest) applyRoadmap(nextRoadmap);
      else await persistRoadmap(nextRoadmap);
    })().catch((error) => {
      void errorLoggingService.captureException(error, {
        category: "sync",
        operation: "hydrate-roadmap-documents",
        severity: "warn",
        handled: true,
        source: "roadmap-page",
        screen: "roadmap",
        route: "/roadmap",
        metadata: {
          userId,
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [applyRoadmap, persistRoadmap, roadmap, user?.isGuest, userId]);

  const toggleExpanded = (id: string) => {
    setExpandedTaskIds((prev) => ({ ...prev, [id]: !(prev[id] ?? id === "documents-checklist") }));
  };

  const toggleDocument = (docKey: RoadmapDocumentKey) => {
    setActiveUpload((prev) => (prev === docKey ? null : docKey));
  };

  const updateRoadmapSnapshot = useCallback(
    async (nextRoadmap: UserRoadmapDocument, snapshotPatch: Partial<UserRoadmapDocument["profileSnapshot"]>) => {
      await persistRoadmap({
        ...nextRoadmap,
        profileSnapshot: { ...nextRoadmap.profileSnapshot, ...snapshotPatch },
      });
    },
    [persistRoadmap]
  );

  const toggleCompleted = async (sectionId: RoadmapSectionId, task: RoadmapTask) => {
    if (!roadmap || !userId) return;
    const nextRoadmap = roadmapService.setTaskCompletion(roadmap, sectionId, task.id, task.status !== "completed");
    await persistRoadmap(nextRoadmap);
  };

  const addNote = async (sectionId: RoadmapSectionId, taskId: string, note: string) => {
    if (!roadmap || !userId) return;
    const cleaned = note.trim();
    if (!cleaned) return;
    const nextRoadmap = roadmapService.addTaskNote(roadmap, sectionId, taskId, cleaned);
    await persistRoadmap(nextRoadmap);
  };

  const addCourse = async (rawName: string) => {
    if (!roadmap) return;
    const name = rawName.trim();
    if (!name || currentCourses.some((course) => course.toLowerCase() === name.toLowerCase())) return;
    const nextRoadmap = roadmapService.addSectionTask(roadmap, "courses", {
      id: `course-${slugify(name)}`,
      type: "course",
      title: `Stay on track in ${name}`,
      description: "Check this course against your transfer requirements and keep your materials organized.",
      metadata: { courseName: name },
    });
    await updateRoadmapSnapshot(nextRoadmap, {
      currentCourses: [...nextRoadmap.profileSnapshot.currentCourses, name],
    });
    setNewCourseInput("");
  };

  const removeCourse = async (task: RoadmapTask) => {
    if (!roadmap) return;
    const courseName = task.metadata?.courseName ?? "";
    const nextRoadmap = roadmapService.removeSectionTask(roadmap, "courses", task.id);
    await updateRoadmapSnapshot(nextRoadmap, {
      currentCourses: nextRoadmap.profileSnapshot.currentCourses.filter(
        (course) => course.toLowerCase() !== courseName.toLowerCase()
      ),
    });
  };

  const addApplication = async (rawName: string) => {
    if (!roadmap) return;
    const schoolName = rawName.trim();
    if (!schoolName || targetSchools.some((school) => school.toLowerCase() === schoolName.toLowerCase())) return;
    const nextRoadmap = roadmapService.addSectionTask(roadmap, "applications", {
      id: `submit-${slugify(schoolName)}`,
      type: "application",
      title: `Prepare your ${schoolName} application`,
      description: "Track requirements, essay work, and document readiness for this school.",
      metadata: { schoolName },
    });
    await updateRoadmapSnapshot(nextRoadmap, {
      targetSchools: [...nextRoadmap.profileSnapshot.targetSchools, schoolName],
    });
    setNewSchoolInput("");
  };

  const removeApplication = async (task: RoadmapTask) => {
    if (!roadmap) return;
    const schoolName = task.metadata?.schoolName ?? "";
    const nextRoadmap = roadmapService.removeSectionTask(roadmap, "applications", task.id);
    await updateRoadmapSnapshot(nextRoadmap, {
      targetSchools: nextRoadmap.profileSnapshot.targetSchools.filter(
        (school) => school.toLowerCase() !== schoolName.toLowerCase()
      ),
    });
  };

  const addInterest = async (rawName: string) => {
    if (!roadmap) return;
    const interestName = rawName.trim();
    if (!interestName || activeClubs.some((interest) => interest.toLowerCase() === interestName.toLowerCase())) return;
    const nextRoadmap = roadmapService.addSectionTask(roadmap, "interests", {
      id: `interest-${slugify(interestName)}`,
      type: "interest",
      title: `Build momentum around ${interestName}`,
      description: "Use this as a place to capture ideas, next steps, and related opportunities.",
      metadata: { interestName },
    });
    await updateRoadmapSnapshot(nextRoadmap, {
      interests: [...nextRoadmap.profileSnapshot.interests, interestName],
    });
    setNewInterestInput("");
  };

  const removeInterest = async (task: RoadmapTask) => {
    if (!roadmap) return;
    const interestName = task.metadata?.interestName ?? "";
    const nextRoadmap = roadmapService.removeSectionTask(roadmap, "interests", task.id);
    await updateRoadmapSnapshot(nextRoadmap, {
      interests: nextRoadmap.profileSnapshot.interests.filter(
        (interest) => interest.toLowerCase() !== interestName.toLowerCase()
      ),
    });
  };

  const handlePickDocument = async (docKey: RoadmapDocumentKey) => {
    if (!userId || isUploadingDoc || !roadmap) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "image/png",
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setIsUploadingDoc(true);
      const uploaded = await storageService.uploadDocument(userId, docKey, result.assets[0].uri, result.assets[0].name);
      const nextRoadmap = roadmapService.updateRoadmapDocument(roadmap, docKey, {
        fileName: uploaded.name,
        fileUrl: uploaded.url,
      });
      await persistRoadmap(nextRoadmap);
      setActiveUpload(null);
    } catch (err) {
      void errorLoggingService.captureException(err, {
        category: "upload",
        operation: `upload-roadmap-document-${docKey}`,
        severity: "error",
        handled: true,
        source: "roadmap-page",
        screen: "roadmap",
        route: "/roadmap",
        metadata: {
          userId,
        },
      });
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleSendAI = async () => {
    if (!aiInput.trim()) return;
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: aiInput.trim(),
      timestamp: new Date().toISOString(),
    };
    setAiMessages((prev) => [...prev, userMessage]);
    setAiInput("");
    const aiContext = buildAiConversationContext({
      source: {
        screen: "roadmap-chat",
        route: "/roadmap",
      },
      user,
      questionnaireAnswers: state.questionnaireAnswers,
      savedColleges: state.savedColleges,
      roadmap,
    });
    try {
      const aiReply = await aiService.chatAssistant({
        query: userMessage.content,
        context: aiContext,
        outputFormat: "text",
      });
      setAiMessages((prev) => [...prev, aiReply.message]);
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "ai",
        operation: "roadmap-chat-assistant",
        severity: "error",
        handled: true,
        source: "roadmap-page",
        screen: "roadmap",
        route: "/roadmap",
      });
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    }
  };

  const handleExportData = async () => {
    if (!isHydrated) return;
    try {
      const payload = { exportedAt: new Date().toISOString(), app: "GatorGuide", version: APP_VERSION, data: state, theme };
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
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), { encoding: "utf8" });
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
      const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: "utf8" });
      const parsed = JSON.parse(raw) as { data?: typeof state; theme?: string };
      if (!parsed?.data) {
        Alert.alert(t("settings.invalidFile"), t("settings.invalidFileMessage"));
        return;
      }
      Alert.alert(t("settings.importConfirm"), t("settings.importOverwriteMessage"), [
        { text: t("general.cancel"), style: "cancel" },
        {
          text: t("settings.import"),
          style: "destructive",
          onPress: async () => {
            await restoreData(parsed.data as typeof state);
            if (parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "green" || parsed.theme === "system") {
              setTheme(parsed.theme);
            }
          },
        },
      ]);
    } catch {
      Alert.alert(t("settings.importFailed"), t("settings.importError"));
    }
  };

  const groupedTasks = useMemo<GroupedTasks[]>(
    () =>
      roadmap
        ? ROADMAP_SECTION_ORDER.map((sectionId) => ({
            id: sectionId,
            name:
              sectionId === "documents"
                ? t("roadmap.documents")
                : sectionId === "courses"
                  ? t("roadmap.currentCourses")
                  : sectionId === "applications"
                    ? t("roadmap.applications")
                    : t("roadmap.interests"),
            data: roadmap.sections[sectionId].tasks,
          }))
        : [],
    [roadmap, t]
  );

  const progress = roadmap?.progress.percent ?? 0;

  const getDocIcon = (key: RoadmapDocumentKey) => {
    switch (key) {
      case "resume":
        return "document-text-outline";
      case "transcripts":
        return "school-outline";
      case "personalStatement":
        return "create-outline";
      case "recommendation1":
      case "recommendation2":
        return "people-outline";
      default:
        return "file-tray-outline";
    }
  };

  const formatDocLabel = (key: RoadmapDocumentKey) => {
    if (key === "personalStatement") return t("roadmap.personalStatement");
    if (key === "recommendation1") return t("roadmap.recommendation1");
    if (key === "recommendation2") return t("roadmap.recommendation2");
    return key.charAt(0).toUpperCase() + key.slice(1);
  };

  if (!isHydrated) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center px-6">
          <StateCard variant="loading" className="w-full max-w-md" />
        </View>
      </ScreenBackground>
    );
  }

  if (!user) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center px-6">
          <StateCard
            variant="empty"
            icon="person-circle-outline"
            title={t("profile.notSignedIn")}
            message={t("profile.notSignedInMessage")}
            actionLabel={t("profile.goToLogin")}
            onAction={() => router.replace("/login")}
            className="w-full max-w-md"
          />
        </View>
      </ScreenBackground>
    );
  }

  if (user?.isGuest && !showGuestRoadmap) {
    return (
      <ScreenBackground>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="max-w-md w-full self-center px-6 pt-8">
            <Pressable onPress={back} className="mb-4 flex-row items-center">
              <MaterialIcons name="arrow-back" size={20} color={styles.placeholderColor} />
              <Text className={`${secondaryTextClass} ml-2`}>{t("roadmap.back")}</Text>
            </Pressable>
            <View className={`${cardBgClass} border rounded-2xl p-6`}>
              <View className="items-center mb-6">
                <View className="bg-emerald-500 p-4 rounded-full mb-4">
                  <MaterialIcons name="map" size={44} color="#001f0f" />
                </View>
                <Text className={`text-3xl ${textClass} text-center font-semibold mb-3`}>{t("roadmap.yourCollegeRoadmap")}</Text>
                <Text className={`${secondaryTextClass} text-center`}>{t("roadmap.unlockJourney")}</Text>
              </View>
              <View className="gap-3 mb-6">
                <Text className={textClass}>{t("roadmap.applicationChecklist")}</Text>
                <Text className={textClass}>{t("roadmap.documentManagement")}</Text>
                <Text className={textClass}>{t("roadmap.aiGuidance")}</Text>
                <Text className={textClass}>{t("roadmap.timelineProgress")}</Text>
              </View>
              <Pressable onPress={() => router.push("/login")} className="bg-emerald-500 rounded-lg py-4 items-center mb-3">
                <Text className={`${isDark ? "text-white" : "text-emerald-900"} font-semibold`}>{t("roadmap.createProfileToStart")}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowGuestRoadmap(true);
                  AsyncStorage.setItem("gatorguide:guestRoadmap:show", "true").catch(() => {});
                }}
                className={`${cardBgClass} border rounded-lg py-3 items-center`}
              >
                <Text className={secondaryTextClass}>{t("profile.continueAsGuest")}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="max-w-md w-full self-center px-6 pt-8">
          <Pressable onPress={back} className="mb-4 flex-row items-center">
            <MaterialIcons name="arrow-back" size={20} color={styles.placeholderColor} />
            <Text className={`${secondaryTextClass} ml-2`}>{t("roadmap.back")}</Text>
          </Pressable>
          <View className={`${cardBgClass} border rounded-2xl p-5 mb-4`}>
            <Text className={`text-2xl ${textClass}`}>{t("roadmap.roadmapTitle")}</Text>
            <Text className={`${secondaryTextClass} mt-2`}>{t("roadmap.subtitleChecklist")}</Text>
            <View className="mt-4 h-4 w-full bg-emerald-300 rounded-full overflow-hidden">
              <Animated.View style={{ width: `${progress}%`, height: 16, backgroundColor: "#008f4e", borderRadius: 8 }} />
            </View>
          </View>

          {user?.isGuest ? (
            <View className={`${cardBgClass} border rounded-2xl p-4 mb-4`}>
              <Text className={textClass}>{t("roadmap.guestTools")}</Text>
              <Text className={`${secondaryTextClass} text-sm mb-3`}>{t("roadmap.importExport")}</Text>
              <View className="gap-2">
                <Pressable onPress={handleImportData} className="bg-emerald-500 rounded-lg px-4 py-3 items-center">
                  <Text className={`${isDark ? "text-white" : "text-emerald-900"} font-semibold`}>{t("settings.import")}</Text>
                </Pressable>
                <Pressable onPress={handleExportData} className={`${cardBgClass} border rounded-lg px-4 py-3 items-center`}>
                  <Text className={secondaryTextClass}>{t("settings.export")}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View className={`${cardBgClass} border rounded-2xl p-5 mb-4`}>
            <Text className={`${textClass} text-base mb-2`}>{t("roadmap.personalAssistant")}</Text>
            <TextInput
              value={aiInput}
              onChangeText={setAiInput}
              placeholder={t("roadmap.askAssistant")}
              placeholderTextColor={styles.placeholderColor}
              onSubmitEditing={handleSendAI}
              className={`border p-2 rounded-lg mb-2 ${styles.inputBgClass} ${textClass}`}
            />
            <Pressable onPress={handleSendAI} className="bg-emerald-500 rounded-lg px-4 py-2 mb-2 items-center">
              <Text className={`${isDark ? "text-white" : "text-emerald-900"} font-semibold`}>{t("roadmap.sendMessage")}</Text>
            </Pressable>
            {aiMessages.map((msg) => (
              <View key={msg.id} className="mb-2">
                <Text className={`${textClass} text-sm`}>{msg.role === "user" ? t("roadmap.youPrefix").replace("{message}", msg.content) : msg.content}</Text>
                {msg.role === "assistant" && msg.source && msg.source !== "live" ? (
                  <Text className={`${secondaryTextClass} text-xs mt-0.5`}>
                    {msg.source === "cached" ? t("roadmap.cachedResponse") : msg.source === "stub" ? t("roadmap.sampleResponse") : null}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          {isRoadmapLoading && !roadmap ? (
            <StateCard variant="loading" className="mb-4" />
          ) : roadmapLoadError && !roadmap ? (
            <StateCard
              variant="error"
              title={t("general.error")}
              message={roadmapLoadError}
              actionLabel={t("general.retry")}
              onAction={() => setRoadmapLoadAttempt((value) => value + 1)}
              className="mb-4"
            />
          ) : !roadmap ? (
            <StateCard
              variant="empty"
              title={t("roadmap.roadmapTitle")}
              message={t("roadmap.subtitleChecklist")}
              actionLabel={t("general.retry")}
              onAction={() => setRoadmapLoadAttempt((value) => value + 1)}
              className="mb-4"
            />
          ) : null}

          <View className="gap-4">
            {groupedTasks.map((group) => (
              <View key={group.id} className="mb-2">
                <Text className={`${textClass} text-lg mb-2 font-bold`}>{group.name}</Text>
                {group.data.map((task) => {
                  const isExpanded = expandedTaskIds[task.id] ?? task.id === "documents-checklist";
                  const isCompleted = task.status === "completed";
                  const canRemoveCourse = group.id === "courses" && task.type === "course" && !!task.metadata?.courseName;
                  const canRemoveApplication = group.id === "applications" && task.type === "application" && !!task.metadata?.schoolName;
                  const canRemoveInterest = group.id === "interests" && task.type === "interest" && !!task.metadata?.interestName;

                  return (
                    <View key={task.id} className={`${cardBgClass} border rounded-2xl overflow-hidden mb-2`}>
                      <Pressable className="px-5 py-5" onPress={() => toggleExpanded(task.id)}>
                        <View className="flex-row items-start">
                          {task.id !== "documents-checklist" ? (
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                toggleCompleted(group.id, task).catch(() => {});
                              }}
                              className={`w-6 h-6 rounded-full border-2 flex-shrink-0 ${isCompleted ? "bg-emerald-500 border-emerald-500" : borderClass} mr-4`}
                            />
                          ) : null}
                          <View className="flex-1 min-w-0">
                            <Text className={`${textClass} text-base mb-1 ${isCompleted ? "line-through opacity-70" : ""}`}>{task.title}</Text>
                            <Text className={`${secondaryTextClass} text-sm`}>{task.description}</Text>
                          </View>
                          {canRemoveCourse ? (
                            <Pressable onPress={() => removeCourse(task).catch(() => {})} className="p-2 -mr-2" hitSlop={8}>
                              <MaterialIcons name="close" size={20} color={styles.placeholderColor} />
                            </Pressable>
                          ) : null}
                          {canRemoveApplication ? (
                            <Pressable onPress={() => removeApplication(task).catch(() => {})} className="p-2 -mr-2" hitSlop={8}>
                              <MaterialIcons name="close" size={20} color={styles.placeholderColor} />
                            </Pressable>
                          ) : null}
                          {canRemoveInterest ? (
                            <Pressable onPress={() => removeInterest(task).catch(() => {})} className="p-2 -mr-2" hitSlop={8}>
                              <MaterialIcons name="close" size={20} color={styles.placeholderColor} />
                            </Pressable>
                          ) : null}
                        </View>
                      </Pressable>

                      {isExpanded ? (
                        <View className="px-5 pb-5">
                          {task.documents ? (
                            <View className="mt-2 gap-3">
                              {ROADMAP_DOCUMENT_KEYS.map((docKey) => {
                                const documentItem = task.documents?.[docKey];
                                const isUploaded = documentItem?.status === "completed";
                                return (
                                  <View key={docKey}>
                                    <Pressable
                                      onPress={() => toggleDocument(docKey)}
                                      className={`flex-row items-center p-3 rounded-xl ${isUploaded ? "bg-emerald-50 dark:bg-gray-900/80" : "bg-emerald-50 dark:bg-gray-900/70"}`}
                                    >
                                      <Ionicons name={getDocIcon(docKey)} size={18} color={isUploaded ? "#008f4e" : styles.placeholderColor} />
                                      <Text className={`flex-1 ml-3 text-sm ${isUploaded ? (isDark || isGreen ? "text-emerald-100 font-medium" : "text-emerald-700 font-medium") : textClass}`}>
                                        {formatDocLabel(docKey)}
                                      </Text>
                                      <Ionicons name={isUploaded ? "checkmark-circle" : "cloud-upload-outline"} size={20} color={isUploaded ? "#008f4e" : styles.placeholderColor} />
                                    </Pressable>
                                    {documentItem?.fileName ? (
                                      documentItem.fileUrl ? (
                                        <Pressable
                                          onPress={() => {
                                            const url = documentItem.fileUrl as string;
                                            if (Platform.OS === "web") {
                                              (window as unknown as { open: (u: string, target: string) => void }).open(url, "_blank");
                                            } else {
                                              Linking.openURL(url);
                                            }
                                          }}
                                          className="mt-1.5 ml-9"
                                          accessibilityRole="link"
                                        >
                                          <Text className="text-xs text-blue-600 dark:text-blue-400 underline">{documentItem.fileName}</Text>
                                        </Pressable>
                                      ) : (
                                        <Text className="mt-1.5 ml-9 text-xs text-blue-600 dark:text-blue-400">{documentItem.fileName}</Text>
                                      )
                                    ) : null}
                                    {activeUpload === docKey ? (
                                      <View className="mt-2 border-2 border-dashed border-emerald-300 dark:border-gray-700 rounded-xl p-6 items-center justify-center bg-emerald-50/50 dark:bg-gray-900/80">
                                        <Ionicons name="cloud-upload" size={28} color="#008f4e" />
                                        <Text className={`${textClass} mt-2 text-sm font-medium`}>
                                          {t("roadmap.uploadDocument").replace("{document}", formatDocLabel(docKey))}
                                        </Text>
                                        <Text className={`${secondaryTextClass} text-xs`}>{t("roadmap.supportedFormats")}</Text>
                                        <Pressable
                                          onPress={() => handlePickDocument(docKey)}
                                          disabled={isUploadingDoc}
                                          className={`mt-3 bg-white dark:bg-gray-900/80 border border-emerald-200 dark:border-gray-700 px-4 py-1.5 rounded-lg ${isUploadingDoc ? "opacity-60" : ""}`}
                                        >
                                          <Text className={`${textClass} text-xs font-bold`}>
                                            {isUploadingDoc ? t("general.pleaseWait") : t("roadmap.selectFile")}
                                          </Text>
                                        </Pressable>
                                      </View>
                                    ) : null}
                                  </View>
                                );
                              })}
                            </View>
                          ) : null}
                          <TextInput
                            placeholder={t("roadmap.addNotePlaceholder")}
                            placeholderTextColor={styles.placeholderColor}
                            onSubmitEditing={(e) => addNote(group.id, task.id, e.nativeEvent.text).catch(() => {})}
                            className={`mt-4 border p-2 rounded-lg ${styles.inputBgClass} ${textClass}`}
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}

                {group.id === "courses" ? (
                  <View className="flex-row items-center gap-2 mt-2">
                    <TextInput
                      value={newCourseInput}
                      onChangeText={setNewCourseInput}
                      placeholder={t("roadmap.addCoursePlaceholder")}
                      placeholderTextColor={styles.placeholderColor}
                      onSubmitEditing={(e) => addCourse(e.nativeEvent.text).catch(() => {})}
                      className={`flex-1 border p-2 rounded-lg ${styles.inputBgClass} ${textClass}`}
                    />
                    <Pressable onPress={() => addCourse(newCourseInput).catch(() => {})} className={`px-4 py-2 rounded-lg border items-center justify-center ${borderClass}`}>
                      <Text className={`${textClass} text-sm font-medium`}>{t("roadmap.addCourse")}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {group.id === "applications" ? (
                  <View className="flex-row items-center gap-2 mt-2">
                    <TextInput
                      value={newSchoolInput}
                      onChangeText={setNewSchoolInput}
                      placeholder={t("roadmap.addApplicationPlaceholder")}
                      placeholderTextColor={styles.placeholderColor}
                      onSubmitEditing={(e) => addApplication(e.nativeEvent.text).catch(() => {})}
                      className={`flex-1 border p-2 rounded-lg ${styles.inputBgClass} ${textClass}`}
                    />
                    <Pressable onPress={() => addApplication(newSchoolInput).catch(() => {})} className={`px-4 py-2 rounded-lg border items-center justify-center ${borderClass}`}>
                      <Text className={`${textClass} text-sm font-medium`}>{t("roadmap.addApplication")}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {group.id === "interests" ? (
                  <View className="flex-row items-center gap-2 mt-2">
                    <TextInput
                      value={newInterestInput}
                      onChangeText={setNewInterestInput}
                      placeholder={t("roadmap.addInterestPlaceholder")}
                      placeholderTextColor={styles.placeholderColor}
                      onSubmitEditing={(e) => addInterest(e.nativeEvent.text).catch(() => {})}
                      className={`flex-1 border p-2 rounded-lg ${styles.inputBgClass} ${textClass}`}
                    />
                    <Pressable onPress={() => addInterest(newInterestInput).catch(() => {})} className={`px-4 py-2 rounded-lg border items-center justify-center ${borderClass}`}>
                      <Text className={`${textClass} text-sm font-medium`}>{t("roadmap.addInterest")}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
