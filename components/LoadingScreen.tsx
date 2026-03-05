import { View, ActivityIndicator, Text } from "react-native";
import { ScreenBackground } from "./layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";

type LoadingScreenProps = {
  message?: string;
};

export function LoadingScreen({ message }: LoadingScreenProps) {
  const { isDark, isGreen, isLight } = useAppTheme();
  const { t } = useAppLanguage();
  const textClass = isDark ? "text-white" : isGreen ? "text-white" : isLight ? "text-emerald-900" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : isLight ? "text-emerald-700" : "text-gray-600";
  const resolvedMessage = message ?? t("general.loading");

  return (
    <ScreenBackground>
      <View className="flex-1 items-center justify-center px-6">
        <ActivityIndicator size="large" color="#008f4e" />
        <Text className={`text-lg ${textClass} mt-4`}>{resolvedMessage}</Text>
        <Text className={`${secondaryTextClass} mt-2`}>{t("general.pleaseWait")}</Text>
      </View>
    </ScreenBackground>
  );
}
