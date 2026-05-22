import { Ionicons } from "@expo/vector-icons";
import { Text, View, type ViewStyle } from "react-native";

import {
  TouchOptionRow,
  TouchToggleRow,
} from "@/components/ui/TouchPrimitives";
import type { NotificationPreferences } from "@/hooks/use-app-data";

export type IconName = keyof typeof Ionicons.glyphMap;

export type SettingsItem =
  | {
      label: string;
      icon: IconName;
      type: "toggle";
      enabled: boolean;
      onPress: () => void;
    }
  | {
      label: string;
      icon: IconName;
      type: "nav";
      value?: string;
      onPress: () => void;
    }
  | {
      label: string;
      icon: IconName;
      type: "display";
      value: string;
    };

export type AdvancedSettingsItem = {
  key: string;
  icon: IconName;
  label: string;
  description: string;
  type: "toggle" | "nav";
  enabled?: boolean;
  onPress: () => void;
  danger?: boolean;
};

export type NotificationPreferenceItem = {
  key: keyof NotificationPreferences;
  icon: IconName;
  label: string;
};

type RowChrome = {
  flexDirection: string;
  isRTL: boolean;
  isDark: boolean;
  isGreen: boolean;
  isWideLayout: boolean;
  isTablet: boolean;
  useDesktopSettingsLayout: boolean;
  textClass: string;
  secondaryTextClass: string;
  dividerColor: string;
  accentColor: string;
  accessoryIconColor: string;
};

type SettingsRowsProps = RowChrome & {
  items: SettingsItem[];
  valueMaxWidth?: number;
  rowPaddingVertical?: number;
};

export function SettingsRows({
  items,
  flexDirection,
  isRTL,
  isDark,
  isGreen,
  isWideLayout,
  isTablet,
  useDesktopSettingsLayout,
  textClass,
  secondaryTextClass,
  dividerColor,
  accentColor,
  accessoryIconColor,
  valueMaxWidth,
  rowPaddingVertical,
}: SettingsRowsProps) {
  return (
    <>
      {items.map((item, index) => {
        const isDisplay = item.type === "display";
        const rowClassName = `${flexDirection} px-4`;
        const accessibilityLabel =
          "value" in item && item.value ? `${item.label}, ${item.value}` : item.label;
        const rowStyle = {
          alignItems: "center" as const,
          paddingVertical: rowPaddingVertical ?? (useDesktopSettingsLayout ? 18 : 20),
          borderBottomWidth: index !== items.length - 1 ? 1 : 0,
          borderColor: index !== items.length - 1 ? dividerColor : "transparent",
        };
        const rowContent = (
          <>
            <Ionicons name={item.icon} size={20} color={accentColor} />

            <View
              style={{
                flex: 1,
                minWidth: 0,
                marginLeft: isRTL ? 0 : 12,
                marginRight: isRTL ? 12 : 0,
              }}
            >
              <Text
                className={`${isRTL ? "text-right" : ""} ${textClass}`}
                style={{ lineHeight: 22 }}
              >
                {item.label}
              </Text>
            </View>

            {item.type === "toggle" ? (
              <View
                className={`w-12 h-6 rounded-full ${
                  item.enabled
                    ? "bg-emerald-500"
                    : isDark
                      ? "bg-gray-700"
                      : isGreen
                        ? "bg-emerald-700"
                        : "bg-emerald-300"
                }`}
              >
                <View
                  className={`w-5 h-5 bg-white rounded-full mt-0.5 ${
                    item.enabled ? "ml-6" : "ml-0.5"
                  }`}
                />
              </View>
            ) : item.type === "display" || ("value" in item && item.value) ? (
              <View
                style={{
                  flexShrink: 1,
                  maxWidth: valueMaxWidth ?? (isWideLayout ? 240 : isTablet ? 200 : 140),
                  marginLeft: isRTL ? 0 : 12,
                  marginRight: isRTL ? 12 : 0,
                }}
              >
                <Text
                  className={`${isRTL ? "text-left" : "text-right"} ${secondaryTextClass}`}
                  numberOfLines={2}
                  style={{ lineHeight: 20 }}
                >
                  {item.type === "display" ? item.value : item.value}
                </Text>
              </View>
            ) : (
              <Ionicons
                name={isRTL ? "chevron-back" : "chevron-forward"}
                size={22}
                color={accessoryIconColor}
              />
            )}
          </>
        );

        if (isDisplay) {
          return (
            <View key={`${item.label}-${index}`} className={rowClassName} style={rowStyle}>
              {rowContent}
            </View>
          );
        }

        if (item.type === "toggle") {
          return (
            <TouchToggleRow
              key={`${item.label}-${index}`}
              checked={item.enabled}
              onPress={item.onPress}
              accessibilityLabel={item.label}
              className={rowClassName}
              style={rowStyle}
            >
              {rowContent}
            </TouchToggleRow>
          );
        }

        return (
          <TouchOptionRow
            key={`${item.label}-${index}`}
            onPress={item.onPress}
            accessibilityLabel={accessibilityLabel}
            className={rowClassName}
            style={rowStyle}
          >
            {rowContent}
          </TouchOptionRow>
        );
      })}
    </>
  );
}

type SettingsSectionCardProps = Omit<SettingsRowsProps, "items"> & {
  section: { title: string; items: SettingsItem[] };
  sectionCardWidth: ViewStyle["width"];
  cardBgClass: string;
};

export function SettingsSectionCard({
  section,
  sectionCardWidth,
  cardBgClass,
  ...rowProps
}: SettingsSectionCardProps) {
  return (
    <View key={section.title} style={{ width: sectionCardWidth }}>
      <Text className={`text-sm font-medium ${rowProps.secondaryTextClass} mb-3 px-2`}>
        {section.title}
      </Text>
      <View className={`${cardBgClass} border rounded-2xl overflow-hidden`}>
        <SettingsRows {...rowProps} items={section.items} />
      </View>
    </View>
  );
}

type AdvancedSettingsRowsProps = RowChrome & {
  items: AdvancedSettingsItem[];
  dangerTextClass: string;
  dangerIconColor: string;
  rowPaddingVertical?: number;
};

export function AdvancedSettingsRows({
  items,
  flexDirection,
  isRTL,
  isDark,
  isGreen,
  textClass,
  secondaryTextClass,
  dividerColor,
  accentColor,
  accessoryIconColor,
  dangerTextClass,
  dangerIconColor,
  rowPaddingVertical,
}: AdvancedSettingsRowsProps) {
  return (
    <>
      {items.map((item, index) => {
        const rowClassName = `${flexDirection} items-center px-4`;
        const accessibilityLabel = item.danger
          ? `${item.label}. ${item.description}`
          : item.label;
        const rowStyle = {
          paddingVertical: rowPaddingVertical ?? 18,
          borderTopWidth: index === 0 ? 0 : 1,
          borderColor: dividerColor,
        };
        const rowContent = (
          <>
            <Ionicons
              name={item.icon}
              size={20}
              color={item.danger ? dangerIconColor : accentColor}
            />
            <View className={`flex-1 ${isRTL ? "mr-3" : "ml-3"}`}>
              <Text
                className={`${isRTL ? "text-right" : ""} ${
                  item.danger ? dangerTextClass : textClass
                }`}
              >
                {item.label}
              </Text>
              <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} text-xs mt-1`}>
                {item.description}
              </Text>
            </View>

            {item.type === "toggle" ? (
              <View
                className={`w-12 h-6 rounded-full ${
                  item.enabled
                    ? "bg-emerald-500"
                    : isDark
                      ? "bg-gray-700"
                      : isGreen
                        ? "bg-emerald-700"
                        : "bg-emerald-300"
                }`}
              >
                <View
                  className={`w-5 h-5 bg-white rounded-full mt-0.5 ${
                    item.enabled ? "ml-6" : "ml-0.5"
                  }`}
                />
              </View>
            ) : (
              <Ionicons
                name={isRTL ? "chevron-back" : "chevron-forward"}
                size={22}
                color={accessoryIconColor}
              />
            )}
          </>
        );

        if (item.type === "toggle") {
          return (
            <TouchToggleRow
              key={item.key}
              checked={!!item.enabled}
              onPress={item.onPress}
              accessibilityLabel={accessibilityLabel}
              className={rowClassName}
              style={rowStyle}
            >
              {rowContent}
            </TouchToggleRow>
          );
        }

        return (
          <TouchOptionRow
            key={item.key}
            onPress={item.onPress}
            accessibilityLabel={accessibilityLabel}
            className={rowClassName}
            style={rowStyle}
          >
            {rowContent}
          </TouchOptionRow>
        );
      })}
    </>
  );
}

type NotificationPreferenceRowsProps = RowChrome & {
  items: NotificationPreferenceItem[];
  preferences: NotificationPreferences;
  onToggle: (key: keyof NotificationPreferences) => void;
};

export function NotificationPreferenceRows({
  items,
  preferences,
  onToggle,
  flexDirection,
  isRTL,
  isDark,
  isGreen,
  textClass,
  dividerColor,
  accentColor,
}: NotificationPreferenceRowsProps) {
  return (
    <>
      {items.map((item, index) => {
        const enabled = preferences[item.key];

        return (
          <TouchToggleRow
            key={item.key}
            checked={enabled}
            onPress={() => onToggle(item.key)}
            accessibilityLabel={item.label}
            className={`${flexDirection} items-center`}
            style={{
              paddingVertical: 18,
              borderTopWidth: index === 0 ? 0 : 1,
              borderColor: dividerColor,
            }}
          >
            <Ionicons name={item.icon} size={20} color={accentColor} />
            <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${textClass}`}>
              {item.label}
            </Text>
            <View
              className={`w-12 h-6 rounded-full ${
                enabled
                  ? "bg-emerald-500"
                  : isDark
                    ? "bg-gray-700"
                    : isGreen
                      ? "bg-emerald-700"
                      : "bg-emerald-300"
              }`}
            >
              <View
                className={`w-5 h-5 bg-white rounded-full mt-0.5 ${
                  enabled ? "ml-6" : "ml-0.5"
                }`}
              />
            </View>
          </TouchToggleRow>
        );
      })}
    </>
  );
}
