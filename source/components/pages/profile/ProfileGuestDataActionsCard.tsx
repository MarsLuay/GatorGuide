import { MaterialIcons } from "@expo/vector-icons";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { AnimatedChipPressable } from "@/components/ui/AnimatedPressables";

type Translate = (key: string, params?: Record<string, string | number>) => string;

type ProfileGuestDataActionsCardProps = {
  variant: "desktop" | "default";
  cardBgClass: string;
  textClass: string;
  secondaryTextClass: string;
  isLight: boolean;
  isDark: boolean;
  isGreen: boolean;
  stackActions: boolean;
  frameStyle?: StyleProp<ViewStyle>;
  onImport: () => void;
  onExport: () => void;
  t: Translate;
};

export function ProfileGuestDataActionsCard({
  variant,
  cardBgClass,
  textClass,
  secondaryTextClass,
  isLight,
  isDark,
  isGreen,
  stackActions,
  frameStyle,
  onImport,
  onExport,
  t,
}: ProfileGuestDataActionsCardProps) {
  const importButtonClass = `${isLight ? "bg-emerald-200" : "bg-emerald-500"} rounded-xl px-4 py-3 flex-row items-center justify-center`;
  const exportButtonClass = `${cardBgClass} border-2 border-emerald-500 rounded-xl px-4 py-3 flex-row items-center justify-center`;
  const importTextClass = `${isDark || isGreen ? "text-white" : "text-emerald-900"} font-semibold ml-2`;
  const importIconColor = isDark || isGreen ? "#FFFFFF" : "#000";
  const buttonContainerStyle = stackActions
    ? { width: "100%" as const }
    : variant === "desktop"
      ? undefined
      : { flex: 1 };

  const actions = (
    <View
      style={{
        flexDirection: stackActions ? "column" : "row",
        gap: 8,
      }}
    >
      <AnimatedChipPressable
        onPress={onImport}
        className={importButtonClass}
        containerStyle={buttonContainerStyle}
      >
        <MaterialIcons name="file-download" size={18} color={importIconColor} />
        <Text className={importTextClass}>{t("settings.import")}</Text>
      </AnimatedChipPressable>
      <AnimatedChipPressable
        onPress={onExport}
        className={exportButtonClass}
        containerStyle={buttonContainerStyle}
      >
        <MaterialIcons name="file-upload" size={18} color="#008f4e" />
        <Text className="text-emerald-500 font-semibold ml-2">{t("settings.export")}</Text>
      </AnimatedChipPressable>
    </View>
  );

  if (variant === "desktop") {
    return (
      <View
        className={`${cardBgClass} border-2 border-emerald-500/20 rounded-2xl p-4 mb-4`}
        style={frameStyle}
      >
        <View className="flex-row items-center justify-between gap-4">
          <View className="flex-row items-center flex-1 min-w-0">
            <View className="bg-emerald-500/20 p-2 rounded-lg mr-3">
              <MaterialIcons name="cloud-upload" size={18} color="#008f4e" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className={`${textClass} font-semibold`}>{t("profile.guestMode")}</Text>
              <Text className={`${secondaryTextClass} text-xs mt-1`}>
                {t("profile.yourDataSaved")}
              </Text>
            </View>
          </View>
          <View style={stackActions ? { width: "100%" } : undefined}>{actions}</View>
        </View>
      </View>
    );
  }

  return (
    <View
      className={`${cardBgClass} border-2 border-emerald-500/20 rounded-2xl p-5 mb-4`}
      style={frameStyle}
    >
      <View className="flex-row items-center mb-3">
        <View className="bg-emerald-500/20 p-2 rounded-lg mr-3">
          <MaterialIcons name="cloud-upload" size={20} color="#008f4e" />
        </View>
        <View className="flex-1">
          <Text className={`${textClass} font-semibold`}>{t("profile.guestMode")}</Text>
          <Text className={`${secondaryTextClass} text-xs`}>{t("profile.yourDataSaved")}</Text>
        </View>
      </View>
      {actions}
    </View>
  );
}
