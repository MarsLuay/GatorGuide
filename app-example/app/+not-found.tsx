import React from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function NotFound() {
  const { isDark } = useAppTheme();

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";

  return (
    <ScreenBackground>
      <View className="flex-1 items-center justify-center px-6">
        <View className="max-w-md w-full items-center">
          <Text className={`text-xl ${textClass} mb-2`}>Route not found</Text>
          <Text className={`${secondaryTextClass} text-center mb-6`}>
            The page you’re looking for doesn’t exist or was moved.
          </Text>

          <Pressable
            onPress={() => router.replace("/(tabs)")}
            className="px-5 py-4 rounded-2xl bg-green-500 w-full items-center"
          >
            <Text className="text-black font-semibold">Go Home</Text>
          </Pressable>

          <Pressable onPress={() => router.back()} className="mt-4">
            <Text className="text-green-500">Go Back</Text>
          </Pressable>
        </View>
      </View>
    </ScreenBackground>
  );
}
