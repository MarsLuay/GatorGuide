import React, { type ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { AppButton } from "@/components/ui/AppButton";

type StateCardVariant = "loading" | "empty" | "error" | "info";
type IconName = keyof typeof Ionicons.glyphMap;

type StateCardProps = {
  variant: StateCardVariant;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: IconName;
  className?: string;
  compact?: boolean;
  centered?: boolean;
  children?: ReactNode;
};

const VARIANT_ICONS: Record<StateCardVariant, IconName> = {
  loading: "time-outline",
  empty: "search-outline",
  error: "alert-circle-outline",
  info: "information-circle-outline",
};

const VARIANT_COLORS: Record<StateCardVariant, { icon: string; badgeClass: string }> = {
  loading: { icon: "#008f4e", badgeClass: "bg-emerald-500/10" },
  empty: { icon: "#008f4e", badgeClass: "bg-emerald-500/10" },
  error: { icon: "#ef4444", badgeClass: "bg-red-500/10" },
  info: { icon: "#0ea5e9", badgeClass: "bg-sky-500/10" },
};

export function StateCard({
  variant,
  title,
  message,
  actionLabel,
  onAction,
  icon,
  className,
  compact = false,
  centered = true,
  children,
}: StateCardProps) {
  const { t } = useAppLanguage();
  const { textClass, secondaryTextClass, cardBgClass, borderClass } = useThemeStyles();

  const resolvedTitle =
    title ??
    (variant === "loading"
      ? t("general.loading")
      : variant === "error"
        ? t("general.error")
        : undefined);
  const resolvedMessage = message ?? (variant === "loading" ? t("general.pleaseWait") : undefined);
  const resolvedIcon = icon ?? VARIANT_ICONS[variant];
  const accent = VARIANT_COLORS[variant];
  const alignmentClass = centered ? "items-center" : "items-start";
  const textAlignmentClass = centered ? "text-center" : "";
  const spacingClass = compact ? "p-4" : "p-5";

  return (
    <View className={`${cardBgClass} border ${borderClass} rounded-2xl ${spacingClass} ${alignmentClass} ${className ?? ""}`}>
      <View className={`w-12 h-12 rounded-full items-center justify-center ${accent.badgeClass}`}>
        {variant === "loading" ? (
          <ActivityIndicator size="small" color={accent.icon} />
        ) : (
          <Ionicons name={resolvedIcon} size={22} color={accent.icon} />
        )}
      </View>

      {resolvedTitle ? (
        <Text className={`${textClass} ${textAlignmentClass} ${compact ? "text-base mt-3" : "text-lg mt-4"} font-semibold`}>
          {resolvedTitle}
        </Text>
      ) : null}

      {resolvedMessage ? (
        <Text className={`${secondaryTextClass} ${textAlignmentClass} ${compact ? "text-sm mt-1" : "mt-2"}`}>
          {resolvedMessage}
        </Text>
      ) : null}

      {children ? <View className={`w-full ${resolvedMessage || resolvedTitle ? "mt-3" : ""}`}>{children}</View> : null}

      {actionLabel && onAction ? (
        <AppButton
          onPress={onAction}
          label={actionLabel}
          style={{ alignSelf: "stretch", marginTop: compact ? 12 : 16 }}
          contentStyle={compact ? { minHeight: 46, paddingVertical: 10 } : undefined}
        />
      ) : null}
    </View>
  );
}
