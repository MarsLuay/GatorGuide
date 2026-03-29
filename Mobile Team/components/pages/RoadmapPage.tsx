import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Animated,
  Alert,
  Platform,
  Linking,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { ROUTES } from "@/constants/routes";
import { STORAGE_KEYS } from "@/constants/schema";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppData } from "@/hooks/use-app-data";
import { useOpportunities } from "@/hooks/use-opportunities";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
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
import { getLocaleForLanguage } from "@/utils/locale-format";

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

const formatOpportunityDueLabel = (value: string | null, locale: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    }).format(parsed);
  } catch {
    return parsed.toDateString();
  }
};

const formatDocumentTimestamp = (value: string | null, locale: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed);
  } catch {
    return parsed.toLocaleString();
  }
};

const formatDocumentSize = (value: number | null, locale: string) => {
  if (!value || value <= 0) return null;
  const numberFormatter = new Intl.NumberFormat(locale);
  const compactFormatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (value >= 1024 * 1024) return `${compactFormatter.format(value / (1024 * 1024))} MB`;
  if (value >= 1024) return `${numberFormatter.format(Math.round(value / 1024))} KB`;
  return `${numberFormatter.format(value)} B`;
};

const formatDocumentType = (fileName: string | null, mimeType: string | null) => {
  const normalizedMime = String(mimeType ?? "").trim().toLowerCase();
  if (normalizedMime === "application/pdf") return "PDF";
  if (normalizedMime === "application/msword") return "DOC";
  if (normalizedMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "DOCX";
  if (normalizedMime === "text/plain") return "TXT";
  if (normalizedMime === "image/png") return "PNG";
  if (normalizedMime === "image/jpeg") return "JPG";
  if (normalizedMime === "image/webp") return "WEBP";

  const rawName = String(fileName ?? "").trim();
  const ext = rawName.split(".").pop()?.trim().toUpperCase();
  return ext || null;
};

const openDocumentUrl = (url: string) => {
  if (Platform.OS === "web") {
    (window as unknown as { open: (u: string, target: string) => void }).open(url, "_blank");
    return;
  }
  return Linking.openURL(url);
};

export default function RoadmapPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { getScrollContentPadding } = useResponsiveLayout();
  const styles = useThemeStyles();
  const { t, language } = useAppLanguage();
  const { theme, setTheme, isDark, isGreen } = useAppTheme();
  const back = useBack();
  const { state, restoreData, isHydrated } = useAppData();
  const { matchedOpportunities, setOpportunityDone } = useOpportunities();
  const { textClass, secondaryTextClass, cardBgClass, borderClass, progressBgClass } = styles;
  const locale = getLocaleForLanguage(language);
  const getOpportunityDueBadgeLabel = (value: string | null) => {
    const formatted = formatOpportunityDueLabel(value, locale);
    return formatted
      ? t("roadmap.dueOn", { date: formatted })
      : t("roadmap.openDeadline");
  };
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
    AsyncStorage.getItem(STORAGE_KEYS.guestRoadmapShow).then((value) => {
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
          route: ROUTES.roadmap,
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
        if (
          existing.fileName === uploaded.name &&
          existing.fileUrl === uploaded.url &&
          existing.status === "completed" &&
          existing.updatedAt === uploaded.uploadedAt &&
          existing.mimeType === uploaded.mimeType &&
          existing.sizeBytes === uploaded.sizeBytes
        ) continue;
        nextRoadmap = roadmapService.updateRoadmapDocument(nextRoadmap, docKey, {
          fileName: uploaded.name,
          fileUrl: uploaded.url,
          updatedAt: uploaded.uploadedAt,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
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
        route: ROUTES.roadmap,
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
      const asset = result.assets[0];
      const uploaded = await storageService.uploadDocument(userId, docKey, asset.uri, {
        fileName: asset.name,
        mimeType: asset.mimeType,
        sizeBytes: asset.size,
      });
      const nextRoadmap = roadmapService.updateRoadmapDocument(roadmap, docKey, {
        fileName: uploaded.name,
        fileUrl: uploaded.url,
        updatedAt: uploaded.uploadedAt,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
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
        route: ROUTES.roadmap,
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
        route: ROUTES.roadmap,
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
        route: ROUTES.roadmap,
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

  const roadmapOpportunities = useMemo(
    () => matchedOpportunities.filter((opportunity) => !opportunity.isDone).slice(0, 4),
    [matchedOpportunities]
  );

  const progress = roadmap?.progress.percent ?? 0;
  const isTabletLayout = width >= 768;
  const isDesktopLayout = width >= 1180;
  const shellMaxWidth = isDesktopLayout ? 1240 : isTabletLayout ? 1040 : 760;
  const shellPaddingHorizontal = width >= 960 ? 32 : 24;
  const shellPaddingTop = isTabletLayout ? 24 : 16;
  const earlyStateMaxWidth = Math.min(shellMaxWidth, isDesktopLayout ? 900 : isTabletLayout ? 760 : 448);
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 8,
  });
  const shouldStackInputActions = width < 640;
  const shouldStackDocumentDetails = width < 760;
  const shouldStackOpportunityActions = width < 520;
  const supportCardsLayoutStyle = isDesktopLayout
    ? { gap: 16 }
    : isTabletLayout
      ? { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 16 }
      : { gap: 16 };
  const supportCardStyle = !isDesktopLayout && isTabletLayout
    ? { flexBasis: 0, flexGrow: 1, minWidth: 280 }
    : undefined;
  const contentLayoutStyle = isDesktopLayout
    ? { flexDirection: "row" as const, gap: 20, alignItems: "flex-start" as const }
    : { gap: 20 };
  const guestFeatureList = [
    t("roadmap.applicationChecklist"),
    t("roadmap.documentManagement"),
    t("roadmap.aiGuidance"),
    t("roadmap.timelineProgress"),
  ];

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
    switch (key) {
      case "resume":
        return t("profile.resume");
      case "transcripts":
        return t("profile.transcript");
      case "personalStatement":
        return t("roadmap.personalStatement");
      case "recommendation1":
        return t("roadmap.recommendation1");
      case "recommendation2":
        return t("roadmap.recommendation2");
      default:
        return key;
    }
  };

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

  if (!user) {
    return (
      <ScreenBackground>
        <View className="flex-1 justify-center px-6">
          <View style={{ width: "100%", maxWidth: earlyStateMaxWidth, alignSelf: "center" }}>
            <StateCard
              variant="empty"
              icon="person-circle-outline"
              title={t("profile.notSignedIn")}
              message={t("profile.notSignedInMessage")}
              actionLabel={t("profile.goToLogin")}
              onAction={() => router.replace(ROUTES.login)}
              className="w-full"
            />
          </View>
        </View>
      </ScreenBackground>
    );
  }

  if (user?.isGuest && !showGuestRoadmap) {
    return (
      <ScreenBackground>
        <ScrollView
          className="flex-1"
          contentContainerStyle={scrollContentPadding}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              width: "100%",
              maxWidth: Math.min(shellMaxWidth, 880),
              alignSelf: "center",
              paddingHorizontal: shellPaddingHorizontal,
              paddingTop: shellPaddingTop,
            }}
          >
            <Pressable onPress={back} className="mb-4 flex-row items-center self-start">
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
              <View
                className="mb-6"
                style={
                  isTabletLayout
                    ? { flexDirection: "row", flexWrap: "wrap", gap: 12 }
                    : { gap: 12 }
                }
              >
                {guestFeatureList.map((feature) => (
                  <View
                    key={feature}
                    className={`${isDark ? "bg-gray-950/50 border-gray-800" : isGreen ? "bg-emerald-950/30 border-emerald-700" : "bg-emerald-50 border-emerald-200"} border rounded-xl px-4 py-3`}
                    style={isTabletLayout ? { flexBasis: 0, flexGrow: 1, minWidth: 240 } : undefined}
                  >
                    <Text className={textClass}>{feature}</Text>
                  </View>
                ))}
              </View>
              <View
                style={
                  isTabletLayout
                    ? { flexDirection: "row", gap: 12 }
                    : { gap: 12 }
                }
              >
                <Pressable
                  onPress={() => router.push(ROUTES.login)}
                  className="bg-emerald-500 rounded-lg py-4 items-center"
                  style={isTabletLayout ? { flex: 1 } : undefined}
                >
                  <Text className={`${isDark ? "text-white" : "text-emerald-900"} font-semibold`}>
                    {t("roadmap.createProfileToStart")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowGuestRoadmap(true);
                    AsyncStorage.setItem(STORAGE_KEYS.guestRoadmapShow, "true").catch(() => {});
                  }}
                  className={`${cardBgClass} border rounded-lg py-3 items-center justify-center`}
                  style={isTabletLayout ? { flex: 1 } : undefined}
                >
                  <Text className={secondaryTextClass}>{t("profile.continueAsGuest")}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView
        className="flex-1"
        contentContainerStyle={scrollContentPadding}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: "100%",
            maxWidth: shellMaxWidth,
            alignSelf: "center",
            paddingHorizontal: shellPaddingHorizontal,
            paddingTop: shellPaddingTop,
          }}
        >
          <Pressable onPress={back} className="mb-4 flex-row items-center self-start">
            <MaterialIcons name="arrow-back" size={20} color={styles.placeholderColor} />
            <Text className={`${secondaryTextClass} ml-2`}>{t("roadmap.back")}</Text>
          </Pressable>
          <View style={contentLayoutStyle}>
            <View style={{ flex: 1, minWidth: 0, width: "100%" }}>
              <View className={`${cardBgClass} border rounded-2xl p-5 mb-4`}>
                <View
                  style={
                    isTabletLayout
                      ? { flexDirection: "row", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }
                      : { gap: 12 }
                  }
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text className={`text-2xl ${textClass}`}>{t("roadmap.roadmapTitle")}</Text>
                    <Text className={`${secondaryTextClass} mt-2`}>{t("roadmap.subtitleChecklist")}</Text>
                  </View>
                  <View className={`${progressBgClass} rounded-xl px-4 py-3`} style={isTabletLayout ? { minWidth: 132 } : undefined}>
                    <Text className={`${secondaryTextClass} text-xs uppercase`}>Progress</Text>
                    <Text className={`${textClass} text-lg font-semibold mt-1`}>{Math.round(progress)}%</Text>
                  </View>
                </View>
                <View className={`mt-4 h-4 w-full ${progressBgClass} rounded-full overflow-hidden`}>
                  <Animated.View style={{ width: `${progress}%`, height: 16, backgroundColor: "#008f4e", borderRadius: 8 }} />
                </View>
                <Pressable
                  onPress={() => router.push(ROUTES.calendar)}
                  className="mt-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center flex-1 pr-3">
                    <Ionicons name="calendar-outline" size={18} color="#008f4e" />
                    <View className="ml-3 flex-1">
                      <Text className={`${textClass} font-medium`}>Deadline calendar</Text>
                      <Text className={`${secondaryTextClass} text-sm`}>
                        View roadmap tasks, scholarships, and college deadlines together
                      </Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={styles.placeholderColor} />
                </Pressable>
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
                                const updatedLabel = formatDocumentTimestamp(
                                  documentItem?.updatedAt ?? null,
                                  locale
                                );
                                const documentType = formatDocumentType(
                                  documentItem?.fileName ?? null,
                                  documentItem?.mimeType ?? null
                                );
                                const documentSize = formatDocumentSize(
                                  documentItem?.sizeBytes ?? null,
                                  locale
                                );
                                const metadataParts = [documentType, documentSize].filter(Boolean);
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
                                      <View
                                        className={`mt-2 ml-9 rounded-xl border p-3 ${
                                          isDark
                                            ? "bg-gray-900/80 border-gray-800"
                                            : isGreen
                                              ? "bg-emerald-950/25 border-emerald-700"
                                              : "bg-white/90 border-emerald-200"
                                        }`}
                                      >
                                        <View
                                          style={
                                            shouldStackDocumentDetails
                                              ? { gap: 12 }
                                              : { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }
                                          }
                                        >
                                          <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text className={`${textClass} text-sm font-medium`} numberOfLines={shouldStackDocumentDetails ? 2 : 1}>
                                              {documentItem.fileName}
                                            </Text>
                                            {updatedLabel ? (
                                              <Text className={`${secondaryTextClass} text-xs mt-1`}>
                                                {t("roadmap.lastUpdated", { date: updatedLabel })}
                                              </Text>
                                            ) : null}
                                            {metadataParts.length ? (
                                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                                                {metadataParts.map((part, index) => (
                                                  <View
                                                    key={`${docKey}-${index}`}
                                                    className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                                                  >
                                                    <Text className={`${isDark || isGreen ? "text-emerald-100" : "text-emerald-700"} text-xs font-medium`}>
                                                      {part}
                                                    </Text>
                                                  </View>
                                                ))}
                                              </View>
                                            ) : null}
                                          </View>

                                          {documentItem.fileUrl ? (
                                            <Pressable
                                              onPress={() => {
                                                void openDocumentUrl(documentItem.fileUrl as string);
                                              }}
                                              className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                                              style={shouldStackDocumentDetails ? { alignSelf: "stretch" } : { alignSelf: "flex-start" }}
                                              accessibilityRole="link"
                                            >
                                              <Text className="text-xs text-emerald-600 font-semibold text-center">
                                                {t("roadmap.openFileInNewTab")}
                                              </Text>
                                            </Pressable>
                                          ) : null}
                                        </View>
                                      </View>
                                    ) : (
                                      <Text className={`mt-1.5 ml-9 text-xs ${secondaryTextClass}`}>
                                        {t("profile.notUploaded")}
                                      </Text>
                                    )}
                                    {activeUpload === docKey ? (
                                      <View className="mt-2 border-2 border-dashed border-emerald-300 dark:border-gray-700 rounded-xl p-6 items-center justify-center bg-emerald-50/50 dark:bg-gray-900/80">
                                        <Ionicons name="cloud-upload" size={28} color="#008f4e" />
                                        <Text className={`${textClass} mt-2 text-sm font-medium text-center`}>
                                          {t("roadmap.uploadDocument").replace("{document}", formatDocLabel(docKey))}
                                        </Text>
                                        <Text className={`${secondaryTextClass} text-xs text-center`}>{t("roadmap.supportedFormats")}</Text>
                                        <Pressable
                                          onPress={() => handlePickDocument(docKey)}
                                          disabled={isUploadingDoc}
                                          className={`mt-3 bg-white dark:bg-gray-900/80 border border-emerald-200 dark:border-gray-700 px-4 py-1.5 rounded-lg ${isUploadingDoc ? "opacity-60" : ""}`}
                                          style={shouldStackDocumentDetails ? { alignSelf: "stretch" } : undefined}
                                        >
                                          <Text className={`${textClass} text-xs font-bold text-center`}>
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
                  <View
                    className="mt-2"
                    style={
                      shouldStackInputActions
                        ? { gap: 8 }
                        : { flexDirection: "row", alignItems: "center", gap: 8 }
                    }
                  >
                    <TextInput
                      value={newCourseInput}
                      onChangeText={setNewCourseInput}
                      placeholder={t("roadmap.addCoursePlaceholder")}
                      placeholderTextColor={styles.placeholderColor}
                      onSubmitEditing={(e) => addCourse(e.nativeEvent.text).catch(() => {})}
                      className={`border p-2 rounded-lg ${styles.inputBgClass} ${textClass}`}
                      style={shouldStackInputActions ? undefined : { flex: 1 }}
                    />
                    <Pressable
                      onPress={() => addCourse(newCourseInput).catch(() => {})}
                      className={`px-4 py-2 rounded-lg border items-center justify-center ${borderClass}`}
                      style={shouldStackInputActions ? { width: "100%" } : undefined}
                    >
                      <Text className={`${textClass} text-sm font-medium`}>{t("roadmap.addCourse")}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {group.id === "applications" ? (
                  <View
                    className="mt-2"
                    style={
                      shouldStackInputActions
                        ? { gap: 8 }
                        : { flexDirection: "row", alignItems: "center", gap: 8 }
                    }
                  >
                    <TextInput
                      value={newSchoolInput}
                      onChangeText={setNewSchoolInput}
                      placeholder={t("roadmap.addApplicationPlaceholder")}
                      placeholderTextColor={styles.placeholderColor}
                      onSubmitEditing={(e) => addApplication(e.nativeEvent.text).catch(() => {})}
                      className={`border p-2 rounded-lg ${styles.inputBgClass} ${textClass}`}
                      style={shouldStackInputActions ? undefined : { flex: 1 }}
                    />
                    <Pressable
                      onPress={() => addApplication(newSchoolInput).catch(() => {})}
                      className={`px-4 py-2 rounded-lg border items-center justify-center ${borderClass}`}
                      style={shouldStackInputActions ? { width: "100%" } : undefined}
                    >
                      <Text className={`${textClass} text-sm font-medium`}>{t("roadmap.addApplication")}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {group.id === "interests" ? (
                  <View
                    className="mt-2"
                    style={
                      shouldStackInputActions
                        ? { gap: 8 }
                        : { flexDirection: "row", alignItems: "center", gap: 8 }
                    }
                  >
                    <TextInput
                      value={newInterestInput}
                      onChangeText={setNewInterestInput}
                      placeholder={t("roadmap.addInterestPlaceholder")}
                      placeholderTextColor={styles.placeholderColor}
                      onSubmitEditing={(e) => addInterest(e.nativeEvent.text).catch(() => {})}
                      className={`border p-2 rounded-lg ${styles.inputBgClass} ${textClass}`}
                      style={shouldStackInputActions ? undefined : { flex: 1 }}
                    />
                    <Pressable
                      onPress={() => addInterest(newInterestInput).catch(() => {})}
                      className={`px-4 py-2 rounded-lg border items-center justify-center ${borderClass}`}
                      style={shouldStackInputActions ? { width: "100%" } : undefined}
                    >
                      <Text className={`${textClass} text-sm font-medium`}>{t("roadmap.addInterest")}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
            </View>

          <View style={{ width: isDesktopLayout ? 360 : "100%", minWidth: 0 }}>
            <View style={supportCardsLayoutStyle}>
              {user?.isGuest ? (
                <View style={supportCardStyle}>
                  <View className={`${cardBgClass} border rounded-2xl p-4`}>
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
                </View>
              ) : null}

              <View style={supportCardStyle}>
                <View className={`${cardBgClass} border rounded-2xl p-5`}>
                  <Text className={`${textClass} text-base mb-2`}>{t("roadmap.personalAssistant")}</Text>
                  <TextInput
                    value={aiInput}
                    onChangeText={setAiInput}
                    placeholder={t("roadmap.askAssistant")}
                    placeholderTextColor={styles.placeholderColor}
                    onSubmitEditing={handleSendAI}
                    className={`border p-2 rounded-lg mb-2 ${styles.inputBgClass} ${textClass}`}
                  />
                  <Pressable onPress={handleSendAI} className="bg-emerald-500 rounded-lg px-4 py-2 mb-3 items-center">
                    <Text className={`${isDark ? "text-white" : "text-emerald-900"} font-semibold`}>{t("roadmap.sendMessage")}</Text>
                  </Pressable>
                  {aiMessages.map((msg) => (
                    <View key={msg.id} className="mb-2">
                      <Text className={`${textClass} text-sm`}>
                        {msg.role === "user" ? t("roadmap.youPrefix").replace("{message}", msg.content) : msg.content}
                      </Text>
                      {msg.role === "assistant" && msg.source && msg.source !== "live" ? (
                        <Text className={`${secondaryTextClass} text-xs mt-0.5`}>
                          {msg.source === "cached" ? t("roadmap.cachedResponse") : msg.source === "stub" ? t("roadmap.sampleResponse") : null}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>

              {roadmapOpportunities.length ? (
                <View style={supportCardStyle}>
                  <View className={`${cardBgClass} border rounded-2xl p-5`}>
                    <View
                      className="mb-3"
                      style={
                        shouldStackOpportunityActions
                          ? { gap: 8 }
                          : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }
                      }
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text className={`${textClass} text-base font-semibold`}>Scholarships & Opportunities</Text>
                        <Text className={`${secondaryTextClass} text-sm`}>
                          Starter GRC-focused items using the shared opportunity model
                        </Text>
                      </View>
                      <Pressable onPress={() => router.push(ROUTES.tabsResources)} className="self-start">
                        <Text className="text-emerald-500 text-sm font-medium">
                          {t("roadmap.viewAll")}
                        </Text>
                      </Pressable>
                    </View>

                    <View className="gap-3">
                      {roadmapOpportunities.map((opportunity) => (
                        <View
                          key={opportunity.opportunityId}
                          className={`${isDark ? "bg-gray-950/60 border-gray-800" : isGreen ? "bg-emerald-950/20 border-emerald-700" : "bg-emerald-50 border-emerald-200"} border rounded-xl p-4`}
                        >
                          <Text className={`${textClass} font-medium`} numberOfLines={2}>
                            {opportunity.title}
                          </Text>
                          <Text className={`${secondaryTextClass} text-sm mt-1`} numberOfLines={3}>
                            {opportunity.summary}
                          </Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                            <View className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                              <Text className="text-emerald-500 text-xs font-semibold">
                                {getOpportunityDueBadgeLabel(opportunity.computedDueAt)}
                              </Text>
                            </View>
                          </View>
                          <View
                            className="mt-3"
                            style={
                              shouldStackOpportunityActions
                                ? { gap: 8 }
                                : { flexDirection: "row", gap: 8 }
                            }
                          >
                            <Pressable
                              onPress={() => {
                                void setOpportunityDone(opportunity.opportunityId, true);
                              }}
                              className="bg-emerald-500 rounded-lg px-3 py-2 items-center justify-center"
                              style={shouldStackOpportunityActions ? undefined : { flex: 1 }}
                            >
                              <Text className={`${isDark ? "text-white" : "text-emerald-900"} text-xs font-semibold`}>
                                {t("roadmap.markDone")}
                              </Text>
                            </Pressable>

                            <Pressable
                              onPress={() => {
                                if (opportunity.externalUrl) {
                                  void Linking.openURL(opportunity.externalUrl);
                                  return;
                                }
                                router.push(ROUTES.tabsResources);
                              }}
                              className={`${cardBgClass} border ${borderClass} rounded-lg px-3 py-2 items-center justify-center`}
                              style={shouldStackOpportunityActions ? undefined : { flex: 1 }}
                            >
                              <Text className={`${secondaryTextClass} text-xs font-semibold`}>
                                {t("roadmap.open")}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
