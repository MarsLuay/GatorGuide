import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Animated } from "react-native";
import { router } from "expo-router";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useThemeStyles } from "@/hooks/use-theme-styles";

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
  const { textClass, secondaryTextClass, cardBgClass, borderClass } = styles;

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
  const [aiResponses, setAiResponses] = useState<string[]>([]);
  
  // Track which specific document is currently being "edited" or "uploaded"
  const [activeUpload, setActiveUpload] = useState<string | null>(null);

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

  const handleSendAI = () => {
    if (!aiInput) return;
    setAiResponses((prev) => [...prev, `You: ${aiInput}`, `AI: Suggestion for "${aiInput}"`]);
    setAiInput("");
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  const groupedTasks = useMemo(() => {
    return [
      { name: "Documents", data: tasks.filter((t) => t.id === "documents-checklist") },
      { name: "Current Courses", data: tasks.filter((t) => t.id.startsWith("course")) },
      { name: "Applications", data: tasks.filter((t) => t.id.startsWith("submit")) },
      { name: "Interests", data: tasks.filter((t) => t.id.startsWith("interest")) },
    ];
  }, [tasks]);

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
    if (key === 'personalStatement') return 'Personal Statement';
    if (key === 'recommendation1') return 'Recommendation (1)';
    if (key === 'recommendation2') return 'Recommendation (2)';
    return key.charAt(0).toUpperCase() + key.slice(1);
  };

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="max-w-md w-full self-center">
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
              {aiResponses.map((r, i) => (
                <Text key={i} className={`${textClass} text-sm mb-1`}>{r}</Text>
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