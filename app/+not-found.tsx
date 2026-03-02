import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import useBack from "@/hooks/use-back";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function NotFound() {
  const router = useRouter();
  const back = useBack();
  const { isDark } = useAppTheme();

  const textClass = isDark ? "text-white" : "text-emerald-900";
  const secondaryTextClass = isDark ? "text-white/90" : "text-emerald-700";

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
            className="px-5 py-4 rounded-2xl bg-emerald-500 w-full items-center"
          >
            <Text className={`${isDark ? 'text-white' : 'text-black'} font-semibold`}>Go Home</Text>
          </Pressable>

          <Pressable onPress={back} className="mt-4">
            <Text className="text-emerald-500">Go Back</Text>
          </Pressable>
        </View>
      </View>
    </ScreenBackground>
  );
}
