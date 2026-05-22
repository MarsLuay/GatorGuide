import React from "react";
import { ScrollView, View, Text, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { ROUTES } from "@/constants/routes";
import useBack from "@/hooks/use-back";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";
import { AnimatedChipPressable, AnimatedIconPressable } from "@/components/ui/AnimatedPressables";

export default function NotFound() {
  const router = useRouter();
  const back = useBack();
  const { isDark, isGreen, isLight } = useAppTheme();
  const { t } = useAppLanguage();
  const { width } = useWindowDimensions();
  const shellHorizontalPadding = width < 390 ? 16 : 20;

  const textClass = isDark ? "text-white" : isGreen ? "text-white" : isLight ? "text-emerald-900" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : isLight ? "text-emerald-700" : "text-gray-600";

  return (
    <ScreenBackground>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: shellHorizontalPadding,
          paddingVertical: 32,
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="max-w-md w-full items-center self-center">
          <Text className={`text-xl ${textClass} mb-2`}>{t("notFound.title")}</Text>
          <Text className={`${secondaryTextClass} text-center mb-6`}>
            {t("notFound.body")}
          </Text>

          <AnimatedChipPressable
            onPress={() => router.replace(ROUTES.tabs)}
            containerStyle={{ width: "100%" }}
            className="px-5 py-4 rounded-2xl bg-emerald-500 w-full items-center"
          >
            <Text className={`${isDark ? "text-white" : "text-emerald-900"} font-semibold`}>{t("notFound.goHome")}</Text>
          </AnimatedChipPressable>

          <AnimatedIconPressable onPress={back} containerClassName="mt-4">
            <Text className="text-emerald-500">{t("notFound.goBack")}</Text>
          </AnimatedIconPressable>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
