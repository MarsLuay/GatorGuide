import { AnimatedCardPressable } from "@/components/ui/AnimatedPressables";
import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

export function ProfileQuestionnaireCard({
  className = "",
  compact = false,
  hasQuestionnaireData,
  isDark,
  isGreen,
  onPress,
  questionnaireActionLabel,
  questionnaireCompletionLabel,
  secondaryTextClass,
  stackProfileActionButtons,
  t,
  textClass,
}: {
  className?: string;
  compact?: boolean;
  hasQuestionnaireData: boolean;
  isDark: boolean;
  isGreen: boolean;
  onPress: () => void;
  questionnaireActionLabel: string;
  questionnaireCompletionLabel: string;
  secondaryTextClass: string;
  stackProfileActionButtons: boolean;
  t: (key: string) => string;
  textClass: string;
}) {
  return (
    <AnimatedCardPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("profile.questionnaire")}
      className={`rounded-2xl border ${compact ? "px-5 py-4" : "px-5 py-5"} ${className}`}
      style={{
        backgroundColor: isDark
          ? "rgba(16,185,129,0.08)"
          : isGreen
            ? "rgba(16,185,129,0.12)"
            : "rgba(16,185,129,0.06)",
        borderColor: "rgba(16,185,129,0.18)",
      }}
    >
      {compact ? (
        <View className="flex-row items-center min-w-0">
          <View className="w-11 h-11 rounded-full bg-emerald-500/10 items-center justify-center mr-4">
            <MaterialIcons name="assignment" size={20} color="#008f4e" />
          </View>

          <View className="flex-1 min-w-0">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className={`${textClass} text-base font-semibold`} numberOfLines={1}>
                {t("profile.questionnaire")}
              </Text>
              <View className="bg-emerald-500/10 rounded-full px-2.5 py-1 border border-emerald-500/15">
                <Text className="text-emerald-500 text-xs font-semibold">
                  {questionnaireCompletionLabel}
                </Text>
              </View>
            </View>

            {!hasQuestionnaireData ? (
              <Text className={`${secondaryTextClass} text-xs mt-1`} numberOfLines={1}>
                {t("profile.questionnairePrompt")}
              </Text>
            ) : null}
          </View>

          <View className="flex-row items-center ml-4">
            <Text className="text-emerald-500 text-sm font-semibold">
              {questionnaireActionLabel}
            </Text>
            <MaterialIcons name="chevron-right" size={20} color="#008f4e" />
          </View>
        </View>
      ) : (
        <View className="flex-row items-start min-w-0">
          <MaterialIcons name="assignment" size={20} color="#008f4e" />
          <View className="flex-1 ml-3 min-w-0">
            <View
              style={{
                flexDirection: stackProfileActionButtons ? "column" : "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: stackProfileActionButtons ? 8 : 12,
              }}
            >
              <View className="flex-1 min-w-0">
                <Text className={`text-sm ${secondaryTextClass} mb-1`}>
                  {t("profile.questionnaire")}
                </Text>
                <Text className={`${textClass} text-base font-semibold`}>
                  {questionnaireCompletionLabel}
                </Text>
              </View>

              <View className="bg-emerald-500/10 rounded-full px-2.5 py-1 border border-emerald-500/15">
                <Text className="text-emerald-500 text-xs font-semibold">
                  {questionnaireCompletionLabel}
                </Text>
              </View>
            </View>

            {!hasQuestionnaireData ? (
              <Text className={`${secondaryTextClass} text-sm mt-2`}>
                {t("profile.questionnairePrompt")}
              </Text>
            ) : null}

            <View className="mt-3 flex-row items-center justify-between">
              <Text className="text-emerald-500 text-sm font-semibold">
                {questionnaireActionLabel}
              </Text>
              <MaterialIcons name="chevron-right" size={20} color="#008f4e" />
            </View>
          </View>
        </View>
      )}
    </AnimatedCardPressable>
  );
}
