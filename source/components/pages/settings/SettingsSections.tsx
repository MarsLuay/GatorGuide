import { Ionicons } from "@expo/vector-icons";
import { ScrollView, Text, View, type ViewStyle } from "react-native";

import { APP_VERSION } from "@/constants/app-version";
import {
  TouchCard,
  TouchIconButton,
  TouchOptionRow,
} from "@/components/ui/TouchPrimitives";
import {
  AdvancedSettingsRows,
  SettingsRows,
  SettingsSectionCard,
  type AdvancedSettingsItem,
  type RowChrome,
  type SettingsItem,
} from "@/components/pages/settings/SettingsRows";

type SettingsSection = {
  title: string;
  items: SettingsItem[];
};

type Translate = (key: string, params?: Record<string, string | number>) => string;

type SettingsSectionsProps = {
  aboutSection: SettingsSection;
  accentColor: string;
  accessoryIconColor: string;
  advancedDesktopItems: AdvancedSettingsItem[];
  advancedMobileItems: AdvancedSettingsItem[];
  cardBgClass: string;
  dangerActionClassName: string;
  dangerIconColor: string;
  dangerSurfaceStyle: ViewStyle;
  dangerTextClass: string;
  desktopPanelClass: string;
  flexDirection: string;
  handleLogout: () => void;
  isAdvancedSettingsOpen: boolean;
  isDark: boolean;
  isGreen: boolean;
  isHydrated: boolean;
  isRTL: boolean;
  nestedPanelClass: string;
  onDeleteAccountPress: () => void;
  onOpenSupportEmail: () => void;
  sectionCardWidth: ViewStyle["width"];
  sections: SettingsSection[];
  secondaryTextClass: string;
  settingsRowChrome: RowChrome;
  settingsSection: SettingsSection;
  showSectionGrid: boolean;
  t: Translate;
  textClass: string;
  toggleAdvancedSettings: () => void;
  useDesktopSettingsLayout: boolean;
};

export function SettingsSections({
  aboutSection,
  accentColor,
  accessoryIconColor,
  advancedDesktopItems,
  advancedMobileItems,
  cardBgClass,
  dangerActionClassName,
  dangerIconColor,
  dangerSurfaceStyle,
  dangerTextClass,
  desktopPanelClass,
  flexDirection,
  handleLogout,
  isAdvancedSettingsOpen,
  isDark,
  isGreen,
  isHydrated,
  isRTL,
  nestedPanelClass,
  onDeleteAccountPress,
  onOpenSupportEmail,
  sectionCardWidth,
  sections,
  secondaryTextClass,
  settingsRowChrome,
  settingsSection,
  showSectionGrid,
  t,
  textClass,
  toggleAdvancedSettings,
  useDesktopSettingsLayout,
}: SettingsSectionsProps) {
  if (useDesktopSettingsLayout) {
    return (
      <>
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            alignItems: "stretch",
            gap: 24,
          }}
        >
          <View className={desktopPanelClass} style={{ flex: 1, minHeight: 0 }}>
            <View className={`${flexDirection} items-start mb-5`}>
              <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center">
                <Ionicons name="settings-outline" size={20} color={accentColor} />
              </View>
              <View className={`flex-1 ${isRTL ? "mr-4" : "ml-4"}`}>
                <Text className={`${isRTL ? "text-right" : ""} ${textClass} text-xl font-semibold`}>
                  {settingsSection.title}
                </Text>
                <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mt-1`} style={{ lineHeight: 21 }}>
                  {t("settings.desktopSettingsDescription")}
                </Text>
              </View>
            </View>

            <View className={`${nestedPanelClass} rounded-2xl overflow-hidden`}>
              <SettingsRows
                {...settingsRowChrome}
                items={settingsSection.items}
                valueMaxWidth={260}
                rowPaddingVertical={18}
              />
            </View>
          </View>

          <View className={desktopPanelClass} style={{ flex: 1, minHeight: 0 }}>
            <View className={`${flexDirection} items-start mb-5`}>
              <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center">
                <Ionicons name="information-circle-outline" size={20} color={accentColor} />
              </View>
              <View className={`flex-1 ${isRTL ? "mr-4" : "ml-4"}`}>
                <Text className={`${isRTL ? "text-right" : ""} ${textClass} text-xl font-semibold`}>
                  {aboutSection.title}
                </Text>
                <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mt-1`} style={{ lineHeight: 21 }}>
                  {t("settings.desktopAboutDescription")}
                </Text>
              </View>
            </View>

            <View className={`${nestedPanelClass} rounded-2xl overflow-hidden`} style={{ flex: 1, minHeight: 0 }}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ flexGrow: 1 }}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                <SettingsRows
                  {...settingsRowChrome}
                  items={aboutSection.items}
                  valueMaxWidth={260}
                  rowPaddingVertical={18}
                />
              </ScrollView>
            </View>
          </View>
        </View>

        <View className={desktopPanelClass} style={{ marginTop: 24 }}>
          <TouchOptionRow
            onPress={toggleAdvancedSettings}
            accessibilityLabel={t("settings.advanced")}
            expanded={isAdvancedSettingsOpen}
          >
            <View className={`${flexDirection} items-start justify-between gap-4`}>
              <View className={`${flexDirection} items-start flex-1`}>
                <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center">
                  <Ionicons name="construct-outline" size={20} color={accentColor} />
                </View>
                <View className={`flex-1 ${isRTL ? "mr-4" : "ml-4"}`}>
                  <Text className={`${isRTL ? "text-right" : ""} ${textClass} text-xl font-semibold`}>
                    {t("settings.advanced")}
                  </Text>
                  <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mt-1`} style={{ lineHeight: 21 }}>
                    {isAdvancedSettingsOpen
                      ? t("settings.desktopAdvancedDescription")
                      : t("settings.desktopAdvancedCollapsedDescription")}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={isAdvancedSettingsOpen ? "chevron-up" : "chevron-down"}
                size={22}
                color={accessoryIconColor}
              />
            </View>
          </TouchOptionRow>

          {isAdvancedSettingsOpen ? (
            <View className={`${nestedPanelClass} rounded-2xl overflow-hidden`} style={{ marginTop: 20, maxHeight: 320 }}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                <AdvancedSettingsRows
                  {...settingsRowChrome}
                  items={advancedDesktopItems}
                  dangerTextClass={dangerTextClass}
                  dangerIconColor={dangerIconColor}
                />
              </ScrollView>
            </View>
          ) : null}
        </View>

        <View className={desktopPanelClass} style={{ marginTop: 24 }}>
          <View className={`${flexDirection} items-start justify-between`} style={{ gap: 16, flexWrap: "wrap" }}>
            <View style={{ flex: 1, minWidth: 280 }}>
              <Text className={`${isRTL ? "text-right" : ""} ${textClass} text-xl font-semibold`}>
                {t("settings.accountActions")}
              </Text>
              <Text className={`${isRTL ? "text-right" : ""} ${secondaryTextClass} mt-1`} style={{ lineHeight: 21 }}>
                {t("settings.accountActionsDescription")}
              </Text>
            </View>

            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                gap: 16,
                minWidth: 360,
                flex: 1,
              }}
            >
              <AccountActionCard
                dangerActionClassName={dangerActionClassName}
                dangerIconColor={dangerIconColor}
                dangerSurfaceStyle={dangerSurfaceStyle}
                dangerTextClass={dangerTextClass}
                disabled={!isHydrated}
                icon="log-out-outline"
                isRTL={isRTL}
                label={t("settings.logout")}
                onPress={handleLogout}
                showSectionGrid
              />

              <AccountActionCard
                dangerActionClassName={dangerActionClassName}
                dangerIconColor={dangerIconColor}
                dangerSurfaceStyle={dangerSurfaceStyle}
                dangerTextClass={dangerTextClass}
                disabled={!isHydrated}
                icon="trash-outline"
                isRTL={isRTL}
                label={t("settings.deleteAccount")}
                onPress={onDeleteAccountPress}
                showSectionGrid
              />
            </View>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <View
        style={{
          flexDirection: showSectionGrid ? "row" : "column",
          flexWrap: showSectionGrid ? "wrap" : "nowrap",
          gap: 24,
        }}
      >
        {sections.map((section) => (
          <SettingsSectionCard
            key={section.title}
            {...settingsRowChrome}
            section={section}
            sectionCardWidth={sectionCardWidth}
            cardBgClass={cardBgClass}
          />
        ))}

        <View style={{ width: sectionCardWidth }}>
          <View className={`${cardBgClass} border rounded-2xl overflow-hidden`}>
            <TouchOptionRow
              onPress={toggleAdvancedSettings}
              accessibilityLabel={t("settings.advanced")}
              expanded={isAdvancedSettingsOpen}
              className="px-4 py-4"
            >
              <View className={`${flexDirection} items-start justify-between gap-3`}>
                <View className={`${flexDirection} items-start flex-1`}>
                  <View className="w-10 h-10 rounded-2xl bg-emerald-500/10 items-center justify-center">
                    <Ionicons name="construct-outline" size={18} color={accentColor} />
                  </View>
                  <View className={`flex-1 ${isRTL ? "mr-3" : "ml-3"}`}>
                    <Text className={`text-sm font-medium ${secondaryTextClass} ${isRTL ? "text-right" : ""}`}>
                      {t("settings.advanced")}
                    </Text>
                    <Text className={`${secondaryTextClass} text-sm mt-1 ${isRTL ? "text-right" : ""}`}>
                      {isAdvancedSettingsOpen
                        ? t("settings.desktopAdvancedDescription")
                        : t("settings.desktopAdvancedCollapsedDescription")}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={isAdvancedSettingsOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={accessoryIconColor}
                />
              </View>
            </TouchOptionRow>
            {isAdvancedSettingsOpen ? (
              <AdvancedSettingsRows
                {...settingsRowChrome}
                items={advancedMobileItems}
                dangerTextClass={dangerTextClass}
                dangerIconColor={dangerIconColor}
                rowPaddingVertical={20}
              />
            ) : null}
          </View>
        </View>
      </View>

      <View
        style={{
          flexDirection: showSectionGrid ? (isRTL ? "row-reverse" : "row") : "column",
          gap: 16,
          marginTop: 24,
        }}
      >
        <AccountActionCard
          dangerActionClassName={dangerActionClassName}
          dangerIconColor={dangerIconColor}
          dangerSurfaceStyle={dangerSurfaceStyle}
          dangerTextClass={dangerTextClass}
          disabled={!isHydrated}
          icon="log-out-outline"
          isRTL={isRTL}
          label={t("settings.logout")}
          onPress={handleLogout}
          showSectionGrid={showSectionGrid}
        />

        <AccountActionCard
          dangerActionClassName={dangerActionClassName}
          dangerIconColor={dangerIconColor}
          dangerSurfaceStyle={dangerSurfaceStyle}
          dangerTextClass={dangerTextClass}
          disabled={!isHydrated}
          icon="trash-outline"
          isRTL={isRTL}
          label={t("settings.deleteAccount")}
          onPress={onDeleteAccountPress}
          showSectionGrid={showSectionGrid}
        />
      </View>

      <Text className={`text-center text-sm ${isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : "text-gray-500"} mt-4`}>
        {t("settings.appVersion")}: {APP_VERSION}
      </Text>
      <View className="mt-4 mb-2">
        <View className={`${flexDirection} justify-center items-center`} style={{ flexWrap: "wrap" }}>
          <Text className={`text-center text-sm ${secondaryTextClass} ${isRTL ? "ml-2" : "mr-2"}`}>
            {t("general.needHelpQuestion")}
          </Text>
          <TouchIconButton
            onPress={onOpenSupportEmail}
            accessibilityRole="link"
            accessibilityLabel={t("general.emailUs")}
          >
            <Text className={`text-sm ${isDark ? "text-emerald-200" : isGreen ? "text-emerald-100" : "text-emerald-600"} underline font-semibold`}>
              {t("general.emailUs")}
            </Text>
          </TouchIconButton>
        </View>
      </View>
    </>
  );
}

function AccountActionCard({
  dangerActionClassName,
  dangerIconColor,
  dangerSurfaceStyle,
  dangerTextClass,
  disabled,
  icon,
  isRTL,
  label,
  onPress,
  showSectionGrid,
}: {
  dangerActionClassName: string;
  dangerIconColor: string;
  dangerSurfaceStyle: ViewStyle;
  dangerTextClass: string;
  disabled: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  isRTL: boolean;
  label: string;
  onPress: () => void;
  showSectionGrid: boolean;
}) {
  return (
    <TouchCard
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      className={`${dangerActionClassName} ${disabled ? "opacity-60" : ""}`}
      containerStyle={{ flex: showSectionGrid ? 1 : undefined }}
      style={dangerSurfaceStyle}
    >
      <Ionicons name={icon} size={20} color={dangerIconColor} />
      <Text className={`flex-1 ${isRTL ? "mr-3 text-right" : "ml-3"} ${dangerTextClass}`}>
        {label}
      </Text>
    </TouchCard>
  );
}
