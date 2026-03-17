import { View, ActivityIndicator, Text } from "react-native";
import { ScreenBackground } from "./layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";

type LoadingScreenProps = {
  message?: string;
};

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  const { isDark } = useAppTheme();
  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";

  return (
    <ScreenBackground>
      <View className="flex-1 items-center justify-center px-6">
        <ActivityIndicator size="large" color="#22C55E" />
        <Text className={`text-lg ${textClass} mt-4`}>{message}</Text>
        <Text className={`${secondaryTextClass} mt-2`}>Please wait</Text>
      </View>
    </ScreenBackground>
  );
}
