import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { AnimatedIconPressable } from "@/components/ui/AnimatedPressables";

type BannerVariant = "info" | "success" | "warning" | "error";
type IconName = keyof typeof Ionicons.glyphMap;

type StatusBannerProps = {
  variant: BannerVariant;
  message: string;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: IconName;
  className?: string;
};

const BANNER_STYLES: Record<BannerVariant, { icon: string; iconName: IconName; badgeClass: string }> = {
  info: { icon: "#0ea5e9", iconName: "information-circle-outline", badgeClass: "bg-sky-500/10" },
  success: { icon: "#008f4e", iconName: "checkmark-circle-outline", badgeClass: "bg-emerald-500/10" },
  warning: { icon: "#f59e0b", iconName: "warning-outline", badgeClass: "bg-amber-500/10" },
  error: { icon: "#ef4444", iconName: "alert-circle-outline", badgeClass: "bg-red-500/10" },
};

export function StatusBanner({
  variant,
  message,
  title,
  actionLabel,
  onAction,
  icon,
  className,
}: StatusBannerProps) {
  const { textClass, secondaryTextClass, cardBgClass, borderClass } = useThemeStyles();
  const style = BANNER_STYLES[variant];

  return (
    <View className={`${cardBgClass} border ${borderClass} rounded-2xl px-4 py-3 ${className ?? ""}`}>
      <View className="flex-row items-start">
        <View className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${style.badgeClass}`}>
          <Ionicons name={icon ?? style.iconName} size={18} color={style.icon} />
        </View>

        <View className="flex-1 min-w-0">
          {title ? <Text className={`${textClass} font-semibold mb-1`}>{title}</Text> : null}
          <Text className={`${secondaryTextClass} text-sm`}>{message}</Text>

          {actionLabel && onAction ? (
            <AnimatedIconPressable onPress={onAction} containerClassName="mt-3 self-start">
              <Text className="text-sm font-semibold text-emerald-500">{actionLabel}</Text>
            </AnimatedIconPressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
