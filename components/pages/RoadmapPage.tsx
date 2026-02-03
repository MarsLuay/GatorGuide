import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Animated, Alert, Platform } from "react-native";
import { router } from "expo-router";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppData } from "@/hooks/use-app-data";
import { aiService, ChatMessage } from "@/services";
import { useAppTheme } from "@/hooks/use-app-theme";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  notes: string[];
  expanded: boolean;
  documents?: DocumentChecklist;
}

interface DocumentChecklist {
  resume: boolean;
  transcripts: boolean;
  personalStatement: boolean;
  recommendation1: boolean;
  recommendation2: boolean;
}

interface StudentProfile {
  name: string;
  gradeLevel: number;
  intendedMajor: string;
  targetSchools: string[];
  currentCourses: string[];
  interests: string[];
}

export default function RoadmapPage() {
  const styles = useThemeStyles();
  const { t } = useAppLanguage();
  const { theme, setTheme } = useAppTheme();
  const { state, restoreData, isHydrated } = useAppData();
  const { textClass, secondaryTextClass, cardBgClass, borderClass } = styles;

  const user = state.user;

  const studentProfile: StudentProfile = {
    name: "Retee",
    gradeLevel: 11,
    intendedMajor: "Computer Science",
    targetSchools: ["UW", "CWU"],
    currentCourses: ["Math 101", "English 101", "CS 50"],
    interests: ["Robotics Club", "Volunteer Work"],
  };

  const [activeClubs, setActiveClubs] = useState<string[]>([
    "Robotics Club",
    "Dance Club",
    "Math Club",
  ]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  
  // Track which specific document is currently being "edited" or "uploaded"
  const [activeUpload, setActiveUpload] = useState<string | null>(null);
  const [showGuestRoadmap, setShowGuestRoadmap] = useState(false);

  useEffect(() => {
    if (!user?.isGuest) return;
    AsyncStorage.getItem("gatorguide:guestRoadmap:show").then((value) => {
      if (value === "true") setShowGuestRoadmap(true);
    });
  }, [user?.isGuest]);

  const generateTasks = (profile: StudentProfile): Task[] => {
    const docTask: Task = {
      id: "documents-checklist",
      title: "Documents",
      description: "Manage your application files",
      completed: false,
      notes: [],
      expanded: true,
      documents: {
        resume: false,
        transcripts: false,
        personalStatement: false,
        recommendation1: false,
        recommendation2: false,
      },
    };

    const courseTasks: Task[] = profile.currentCourses.map((course) => ({
      id: `course-${course}`,
      title: `Complete ${course}`,
      description: `Finish all assignments and exams for ${course}.`,
      completed: false,
      notes: [],
      expanded: false,
    }));

    const appTasks: Task[] = profile.targetSchools.map((school) => ({
      id: `submit-${school.toLowerCase()}`,
      title: `Submit application for ${school}`,
      description: `Complete the final submission for ${school}.`,
      completed: false,
      notes: [],
      expanded: false,
    }));

    const interestTasks: Task[] = profile.interests.map((interest, idx) => ({
      id: `interest-${idx}`,
      title: `Join ${interest}`,
      description: `Participate in ${interest} activities.`,
      completed: false,
      notes: [],
      expanded: false,
    }));

    return [docTask, ...courseTasks, ...appTasks, ...interestTasks];
  };

  useEffect(() => {
    setTasks(generateTasks(studentProfile));
  }, []);

  const toggleCompleted = (id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const toggleExpanded = (id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, expanded: !task.expanded } : task
      )
    );
  };

  const toggleDocument = (taskId: string, doc: keyof DocumentChecklist) => {
    // If it's not active, set it to active to show upload box
    if (activeUpload === doc) {
        setActiveUpload(null);
    } else {
        setActiveUpload(doc);
    }

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId && task.documents
          ? { ...task, documents: { ...task.documents, [doc]: !task.documents[doc] } }
          : task
      )
    );
  };

  const addNote = (id: string, note: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, notes: [...task.notes, note] } : task
      )
    );
  };

  const handleSendAI = async () => {
    if (!aiInput.trim()) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: aiInput.trim(),
      timestamp: new Date(),
    };

    setAiMessages((prev) => [...prev, userMessage]);
    setAiInput("");

    const aiReply = await aiService.chat(userMessage.content);
    setAiMessages((prev) => [...prev, aiReply]);
  };

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
        Alert.alert(t('settings.exportReady'), t('settings.exportNotAvailable'));
        return;
      }

      await Sharing.shareAsync(fileUri);
    } catch {
      Alert.alert(t('settings.exportFailed'), t('settings.exportError'));
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
        Alert.alert(t('settings.invalidFile'), t('settings.invalidFileMessage'));
        return;
      }

      Alert.alert(
        t('settings.importConfirm'),
        t('settings.importOverwriteMessage'),
        [
          { text: t('settings.cancel'), style: "cancel" },
          {
            text: t('settings.import'),
            style: "destructive",
            onPress: async () => {
              await restoreData(parsed.data);
              if (parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system") {
                setTheme(parsed.theme);
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert(t('settings.importFailed'), t('settings.importError'));
    }
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  const groupedTasks = useMemo(() => {
    return [
      { name: t("roadmap.documents"), data: tasks.filter((t) => t.id === "documents-checklist") },
      { name: t("roadmap.currentCourses"), data: tasks.filter((t) => t.id.startsWith("course")) },
      { name: t("roadmap.applications"), data: tasks.filter((t) => t.id.startsWith("submit")) },
      { name: t("roadmap.interests"), data: tasks.filter((t) => t.id.startsWith("interest")) },
    ];
  }, [tasks, t]);

  const getDocIcon = (key: string) => {
    switch(key) {
      case 'resume': return 'document-text-outline';
      case 'transcripts': return 'school-outline';
      case 'personalStatement': return 'create-outline';
      case 'recommendation1': 
      case 'recommendation2': return 'people-outline';
      default: return 'file-tray-outline';
    }
  };

  const formatDocLabel = (key: string) => {
    if (key === 'personalStatement') return t('roadmap.personalStatement');
    if (key === 'recommendation1') return 'Recommendation (1)';
    if (key === 'recommendation2') return 'Recommendation (2)';
    return key.charAt(0).toUpperCase() + key.slice(1);
  };

  // If guest user, show roadmap benefits and create profile CTA
  if (user?.isGuest && !showGuestRoadmap) {
    return (
      <ScreenBackground>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="max-w-md w-full self-center">
            <View className="px-6 pt-8 pb-6">
              <Pressable onPress={() => router.back()} className="mb-4 flex-row items-center">
                <MaterialIcons name="arrow-back" size={20} color={styles.placeholderColor} />
                <Text className={`${secondaryTextClass} ml-2`}>{t("roadmap.back")}</Text>
              </Pressable>
            </View>

            <View className="px-6">
              <View className="items-center mb-8">
                <View className="bg-green-500 p-4 rounded-full mb-4">
                  <MaterialIcons name="map" size={48} color="black" />
                </View>
                
                <Text className={`text-3xl ${textClass} text-center font-semibold mb-3`}>Your College Roadmap</Text>
                <Text className={`${secondaryTextClass} text-center text-base`}>
                  Create an account to unlock a personalized college application journey with:
                </Text>
              </View>

              <View className={`${cardBgClass} border rounded-2xl p-6 mb-6`}>
                <View className="gap-4">
                  <View className="flex-row gap-3">
                    <View className="bg-green-500/20 rounded-full p-2 justify-center items-center w-10 h-10 flex-shrink-0">
                      <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                    </View>
                    <View className="flex-1">
                      <Text className={`${textClass} font-semibold mb-1`}>Application Checklist</Text>
                      <Text className={secondaryTextClass}>Track all requirements and deadlines</Text>
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <View className="bg-green-500/20 rounded-full p-2 justify-center items-center w-10 h-10 flex-shrink-0">
                      <Ionicons name="document-text" size={24} color="#22C55E" />
                    </View>
                    <View className="flex-1">
                      <Text className={`${textClass} font-semibold mb-1`}>Document Management</Text>
                      <Text className={secondaryTextClass}>Upload and organize essays, transcripts & more</Text>
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <View className="bg-green-500/20 rounded-full p-2 justify-center items-center w-10 h-10 flex-shrink-0">
                      <Ionicons name="sparkles" size={24} color="#22C55E" />
                    </View>
                    <View className="flex-1">
                      <Text className={`${textClass} font-semibold mb-1`}>AI-Powered Guidance</Text>
                      <Text className={secondaryTextClass}>Get personalized advice and task suggestions</Text>
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <View className="bg-green-500/20 rounded-full p-2 justify-center items-center w-10 h-10 flex-shrink-0">
                      <Ionicons name="calendar" size={24} color="#22C55E" />
                    </View>
                    <View className="flex-1">
                      <Text className={`${textClass} font-semibold mb-1`}>Timeline & Progress</Text>
                      <Text className={secondaryTextClass}>Stay on track with milestones and deadlines</Text>
                    </View>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => router.push("/login")}
                className="bg-green-500 rounded-lg py-4 px-6 items-center flex-row justify-center mb-3"
              >
                <MaterialIcons name="arrow-forward" size={20} color="black" />
                <Text className="text-black font-semibold ml-2">Create Profile to Get Started</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowGuestRoadmap(true);
                  AsyncStorage.setItem("gatorguide:guestRoadmap:show", "true").catch(() => {});
                }}
                className={`${cardBgClass} border rounded-lg py-3 px-6 items-center`}
              >
                <Text className={secondaryTextClass}>Continue as Guest</Text>
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
        <View className="max-w-md w-full self-center">
          {user?.isGuest && showGuestRoadmap ? (
            <View className="px-6 pt-6">
              <View className={`${cardBgClass} border rounded-2xl p-4 flex-row items-center justify-between`}>
                <View>
                  <Text className={textClass}>Guest tools</Text>
                  <Text className={`${secondaryTextClass} text-sm`}>Import or export your data</Text>
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={handleImportData}
                    className="bg-green-500 rounded-lg px-3 py-2"
                  >
                    <Text className="text-black font-semibold text-xs">Import</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleExportData}
                    className={`${cardBgClass} border rounded-lg px-3 py-2`}
                  >
                    <Text className={secondaryTextClass + " text-xs"}>Export</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          {/* Header */}
          <View className="px-6 pt-8 pb-6">
            <Pressable onPress={() => router.back()} className="mb-4 flex-row items-center">
              <MaterialIcons name="arrow-back" size={20} color={styles.placeholderColor} />
              <Text className={`${secondaryTextClass} ml-2`}>Back</Text>
            </Pressable>
            <Text className={`text-2xl ${textClass}`}>Roadmap</Text>
            <Text className={`${secondaryTextClass} mt-2`}>Personalized transfer plan checklist</Text>
            <View className="mt-4 h-4 w-full bg-gray-300 rounded-full overflow-hidden">
              <Animated.View style={{ width: `${progress}%`, height: 16, backgroundColor: "#22C55E", borderRadius: 8 }} />
            </View>
          </View>

          {/* AI Assistant */}
          <View className="px-6 mb-4">
            <View className={`${cardBgClass} border rounded-2xl p-5`}>
              <Text className={`${textClass} text-base mb-2`}>Personal AI Assistant</Text>
              <TextInput
                value={aiInput}
                onChangeText={setAiInput}
                placeholder="Ask your AI assistant..."
                placeholderTextColor={styles.placeholderColor}
                onSubmitEditing={handleSendAI}
                className={`border p-2 rounded-lg mb-2 ${styles.inputBgClass} ${textClass}`}
              />
              <Pressable onPress={handleSendAI} className="bg-green-500 rounded-lg px-4 py-2 mb-2 items-center">
                <Text className="text-black font-semibold">Send</Text>
              </Pressable>
              {aiMessages.map((msg) => (
                <View key={msg.id} className="mb-2">
                  <Text className={`${textClass} text-sm`}>
                    {msg.role === 'user' ? `You: ${msg.content}` : msg.content}
                  </Text>
                  {msg.role === 'assistant' && msg.source && msg.source !== 'live' ? (
                    <Text className={`${secondaryTextClass} text-xs mt-0.5`}>
                      {msg.source === 'cached' ? 'Cached response' : 'Sample response'}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          {/* Task List */}
          <View className="px-6 gap-4">
            {groupedTasks.map((group) => (
              <View key={group.name} className="mb-4">
                <Text className={`${textClass} text-lg mb-2 font-bold`}>{group.name}</Text>
                {group.data.map((task) => (
                  <View key={task.id} className={`${cardBgClass} border rounded-2xl overflow-hidden mb-2`}>
                    <Pressable className="px-5 py-5" onPress={() => toggleExpanded(task.id)}>
                      <View className="flex-row items-start">
                        {task.id !== "documents-checklist" && (
                          <Pressable
                            onPress={() => toggleCompleted(task.id)}
                            className={`w-6 h-6 rounded-full border-2 ${task.completed ? "bg-green-500 border-green-500" : borderClass} mr-4`}
                          />
                        )}
                        <View className="flex-1">
                          <Text className={`${textClass} text-base mb-1 ${task.completed ? "line-through text-gray-400" : ""}`}>
                            {task.title}
                          </Text>
                          <Text className={`${secondaryTextClass} text-sm`}>{task.description}</Text>

                          {task.expanded && (
                            <View className="mt-2">
                              {task.documents && (
                                <View className="mt-2 gap-3">
                                  {(Object.keys(task.documents) as (keyof DocumentChecklist)[]).map((docKey) => (
                                    <View key={docKey}>
                                      <Pressable
                                        onPress={() => toggleDocument(task.id, docKey)}
                                        className={`flex-row items-center p-3 rounded-xl ${task.documents![docKey] ? "bg-green-50 dark:bg-green-900/10" : "bg-zinc-50 dark:bg-zinc-800/50"}`}
                                      >
                                        <Ionicons name={getDocIcon(docKey)} size={18} color={task.documents![docKey] ? "#22C55E" : styles.placeholderColor} />
                                        <Text className={`flex-1 ml-3 text-sm ${task.documents![docKey] ? "text-green-700 dark:text-green-400 font-medium" : textClass}`}>
                                          {formatDocLabel(docKey)}
                                        </Text>
                                        <Ionicons name={task.documents![docKey] ? "checkmark-circle" : "cloud-upload-outline"} size={20} color={task.documents![docKey] ? "#22C55E" : borderClass} />
                                      </Pressable>
                                      
                                      {/* Upload Box Logic */}
                                      {activeUpload === docKey && (
                                        <View className="mt-2 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl p-6 items-center justify-center bg-gray-50/50 dark:bg-zinc-900/30">
                                            <Ionicons name="cloud-upload" size={28} color="#22C55E" />
                                            <Text className={`${textClass} mt-2 text-sm font-medium`}>Upload {formatDocLabel(docKey)}</Text>
                                            <Text className={`${secondaryTextClass} text-xs`}>PDF, DOCX or PNG up to 10MB</Text>
                                            <Pressable className="mt-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 px-4 py-1.5 rounded-lg">
                                                <Text className={`${textClass} text-xs font-bold`}>Select File</Text>
                                            </Pressable>
                                        </View>
                                      )}
                                    </View>
                                  ))}
                                </View>
                              )}
                              
                              <TextInput
                                placeholder="Add a note..."
                                placeholderTextColor={styles.placeholderColor}
                                onSubmitEditing={(e) => addNote(task.id, e.nativeEvent.text)}
                                className={`mt-4 border p-2 rounded-lg ${styles.inputBgClass} ${textClass}`}
                              />
                            </View>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* Active Clubs */}
          <View className="px-6 mt-6 mb-8">
            <View className={`${cardBgClass} border rounded-2xl p-5`}>
              <Text className={`${textClass} text-base mb-2 font-bold`}>Active Clubs</Text>
              <View className="flex-row flex-wrap">
                {activeClubs.map((club, i) => (
                  <View key={i} className="bg-green-500 px-3 py-1 rounded-full mr-2 mb-2">
                    <Text className="text-black text-sm font-medium">{club}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}