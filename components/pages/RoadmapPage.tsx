import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Animated, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppData } from "@/hooks/use-app-data";
import { roadmapService, RoadmapTask } from "@/services/roadmap.service";

export default function RoadmapPage() {
  const styles = useThemeStyles();
  const { state } = useAppData();
  const { textClass, secondaryTextClass, cardBgClass, borderClass } = styles;

  const [tasks, setTasks] = useState<RoadmapTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInput, setAiInput] = useState("");
  const [aiResponses, setAiResponses] = useState<string[]>([]);
  const [activeUpload, setActiveUpload] = useState<string | null>(null);

  const userId = (state.user as any)?.uid;
  const userProfile = state.user;

  useEffect(() => {
    async function loadRoadmap() {
      if (!userId) return;
      try {
        const cloudTasks = await roadmapService.getUserRoadmap(userId);
        if (cloudTasks && cloudTasks.length > 0) {
          setTasks(cloudTasks);
        } else {
          // 如果云端没数据，则根据当前资料生成
          const initial = await roadmapService.generateInitialRoadmap(
            userId, 
            userProfile?.major || "College", 
            userProfile?.gpa || "0.0"
          );
          setTasks(initial);
        }
      } catch (error) {
        console.error("Failed to load roadmap:", error);
      } finally {
        setLoading(false);
      }
    }
    loadRoadmap();
  }, [userId]);

  const toggleCompleted = async (id: string) => {
    const updatedTasks = tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    );
    setTasks(updatedTasks);
    if (userId) {
      await roadmapService.toggleTaskStatus(userId, updatedTasks);
    }
  };

  const toggleExpanded = (id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, expanded: !task.expanded } : task
      )
    );
  };

  const handleSendAI = () => {
    if (!aiInput) return;
    setAiResponses((prev) => [...prev, `You: ${aiInput}`, `AI: Analyzing your ${userProfile?.major} path...`]);
    setAiInput("");
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const groupedTasks = useMemo(() => {
    const categories = ["Documents", "Academics", "Applications", "Interests"];
    return categories.map(cat => ({
      name: cat,
      data: tasks.filter(t => t.category === cat)
    })).filter(group => group.data.length > 0);
  }, [tasks]);

  const getDocIcon = (key: string) => {
    switch(key) {
      case 'resume': return 'document-text-outline';
      case 'transcripts': return 'school-outline';
      default: return 'file-tray-outline';
    }
  };

  if (loading) {
    return (
      <ScreenBackground>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#22C55E" />
          <Text className={`${secondaryTextClass} mt-4`}>Loading your roadmap...</Text>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="max-w-md w-full self-center">
          <View className="px-6 pt-8 pb-6">
            <Pressable onPress={() => router.back()} className="mb-4 flex-row items-center">
              <MaterialIcons name="arrow-back" size={20} color={styles.placeholderColor} />
              <Text className={`${secondaryTextClass} ml-2`}>Back</Text>
            </Pressable>
            <Text className={`text-2xl ${textClass}`}>Roadmap</Text>
            <Text className={`${secondaryTextClass} mt-2`}>
              {userProfile?.major} Plan for {userProfile?.name || 'Student'}
            </Text>
            <View className="mt-4 h-4 w-full bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <View style={{ width: `${progress}%`, height: 16, backgroundColor: "#22C55E", borderRadius: 8 }} />
            </View>
            <Text className={`${secondaryTextClass} text-xs mt-2 text-right`}>{progress}% Complete</Text>
          </View>

          <View className="px-6 mb-4">
            <View className={`${cardBgClass} border ${borderClass} rounded-2xl p-5`}>
              <Text className={`${textClass} text-base mb-2 font-bold`}>AI Advisor</Text>
              <TextInput
                value={aiInput}
                onChangeText={setAiInput}
                placeholder="Ask about transfer requirements..."
                placeholderTextColor={styles.placeholderColor}
                className={`border ${borderClass} p-3 rounded-xl mb-3 ${styles.inputBgClass} ${textClass}`}
              />
              <Pressable onPress={handleSendAI} className="bg-green-500 rounded-xl px-4 py-3 items-center">
                <Text className="text-black font-bold">Get Advice</Text>
              </Pressable>
              {aiResponses.slice(-2).map((r, i) => (
                <Text key={i} className={`${textClass} text-sm mt-2 opacity-80 italic`}>{r}</Text>
              ))}
            </View>
          </View>

          <View className="px-6 gap-4">
            {groupedTasks.map((group) => (
              <View key={group.name} className="mb-4">
                <Text className={`${textClass} text-lg mb-2 font-bold`}>{group.name}</Text>
                {group.data.map((task) => (
                  <View key={task.id} className={`${cardBgClass} border ${borderClass} rounded-2xl overflow-hidden mb-2`}>
                    <Pressable className="px-5 py-5" onPress={() => toggleExpanded(task.id)}>
                      <View className="flex-row items-start">
                        <Pressable
                          onPress={() => toggleCompleted(task.id)}
                          className={`w-6 h-6 rounded-full border-2 ${task.completed ? "bg-green-500 border-green-500" : borderClass} mr-4 items-center justify-center`}
                        >
                          {task.completed && <Ionicons name="checkmark" size={16} color="white" />}
                        </Pressable>
                        <View className="flex-1">
                          <Text className={`${textClass} text-base mb-1 ${task.completed ? "line-through opacity-50" : ""}`}>
                            {task.title}
                          </Text>
                          <Text className={`${secondaryTextClass} text-sm`}>{task.description}</Text>
                          
                          {task.expanded && (
                            <View className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
                               <Text className={`${secondaryTextClass} text-xs italic`}>Task Details for {group.name}</Text>
                            </View>
                          )}
                        </View>
                        <Ionicons 
                          name={task.expanded ? "chevron-up" : "chevron-down"} 
                          size={20} 
                          color={styles.placeholderColor} 
                        />
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}