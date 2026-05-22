import React from "react";
import {
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import {
  countOpportunitySectionItems,
  countResourceSectionItems,
  isTransferPlannerResourceUrl,
  preloadTransferPlannerPage,
  useResourcesPageModel,
  type OpportunitySection,
  type OpportunitySubsection,
  type ResourceItem,
  type ResourceSection,
  type ResourceSubsection,
} from "@/components/pages/resources/useResourcesPageModel";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { AnimatedCardPressable, AnimatedChipPressable } from "@/components/ui/AnimatedPressables";
import { TouchIconButton } from "@/components/ui/TouchPrimitives";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import type { MatchedOpportunity } from "@/services/opportunities/opportunity-matching.service";

export default function ResourcesPage() {
  const styles = useThemeStyles();
  const {
    t,
    isHydrated,
    query,
    setQuery,
    filteredReferenceSections,
    groupedOpportunities,
    toolsReferenceSection,
    otherReferenceSections,
    opportunityCountLabel,
    linkCountLabel,
    openLink,
    toggleSection,
    isSectionExpanded,
    getOpportunitySummaryParts,
    setOpportunityDone,
  } = useResourcesPageModel();
  const { width } = useWindowDimensions();
  const { getScrollContentPadding } = useResponsiveLayout();

  const { textClass, secondaryTextClass, borderClass, inactiveButtonClass, placeholderColor } = styles;
  const cardClass = styles.cardBgClass;
  const inputClass = styles.inputBgClass;
  const placeholderTextColor = placeholderColor;
  const isDesktop = width >= 1180;
  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const stackOpportunityActions = width < 760;
  const shellMaxWidth = isDesktop ? 1280 : width >= 900 ? 1040 : 720;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const shellTopPadding = width >= 900 ? 32 : isCompactPhone ? 28 : 32;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
  });
  const panelClass = `${cardClass} border rounded-[28px] p-5`;
  const mutedCardClass = `${inactiveButtonClass} border ${borderClass} rounded-3xl`;
  const emeraldBadgeClass = "px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20";
  const renderReferenceLinkItems = (
    items: ResourceItem[],
    keyPrefix: string,
    options?: { inset?: boolean }
  ) =>
    items.map((item, index) => (
      <View
        key={`${keyPrefix}-${item.title}`}
        className={`px-4 py-5 ${
          index !== items.length - 1 ? `border-b ${borderClass}` : ""
        }`}
        style={options?.inset ? { paddingLeft: isCompactPhone ? 36 : 52 } : undefined}
      >
        <View
          className={
            stackOpportunityActions
              ? "gap-4"
              : "flex-row items-center justify-between"
          }
        >
          <View
            style={
              stackOpportunityActions
                ? undefined
                : { flex: 1, minWidth: 0, paddingRight: 16 }
            }
          >
            <Text className={`${textClass} font-medium mb-1`}>{item.title}</Text>
            <Text className={`${secondaryTextClass} text-sm`}>{item.description}</Text>
          </View>

          <View
            className="flex-row items-center gap-2"
            style={stackOpportunityActions ? { width: "100%", justifyContent: "flex-end" } : undefined}
          >
            <AnimatedChipPressable
              onHoverIn={isTransferPlannerResourceUrl(item.url) ? preloadTransferPlannerPage : undefined}
              onPressIn={isTransferPlannerResourceUrl(item.url) ? preloadTransferPlannerPage : undefined}
              onPress={() => {
                void openLink(item.url);
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 items-center"
              accessibilityRole="link"
            >
              <Text className="text-emerald-500 text-sm">
                {t("resources.actionOpen")}
              </Text>
            </AnimatedChipPressable>
          </View>
        </View>
      </View>
    ));

  const renderReferenceSubsection = (
    section: ResourceSection,
    subsection: ResourceSubsection,
    index: number
  ) => {
    const subsectionKey = `resource:${section.id}:sub:${subsection.id}`;
    const expanded = isSectionExpanded(subsectionKey);

    return (
      <View
        key={subsection.id}
        className={index !== 0 || section.items.length ? `border-t ${borderClass}` : ""}
      >
        <AnimatedCardPressable
          onPress={() => toggleSection(subsectionKey)}
          className="px-4 py-4 flex-row items-center"
          accessibilityRole="button"
        >
          <View className="w-2 h-2 rounded-full bg-emerald-500/70 mr-3" />
          <Text className={`${textClass} flex-1`} numberOfLines={1}>
            {subsection.title}
          </Text>
          <View className={`${emeraldBadgeClass} mr-3`}>
            <Text className="text-emerald-500 text-xs font-semibold">{subsection.items.length}</Text>
          </View>
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-forward"}
            size={18}
            color={placeholderColor}
          />
        </AnimatedCardPressable>

        {expanded ? (
          <View className={`border-t ${borderClass}`}>
            {renderReferenceLinkItems(subsection.items, `${section.id}-${subsection.id}`, {
              inset: true,
            })}
          </View>
        ) : null}
      </View>
    );
  };

  const renderListStyleReferenceSection = (section: ResourceSection) => {
    const sectionKey = `resource:${section.id}`;
    const expanded = isSectionExpanded(sectionKey);
    const sectionItemCount = countResourceSectionItems(section);

    return (
      <View key={section.id} className={`${cardClass} border rounded-2xl overflow-hidden`}>
        <AnimatedCardPressable
          onPress={() => toggleSection(sectionKey)}
          className="px-4 py-4 flex-row items-center"
          accessibilityRole="button"
        >
          <MaterialIcons name={section.icon} size={18} color="#008f4e" />
          <Text className={`${textClass} ml-2 flex-1`} numberOfLines={1}>
            {section.title}
          </Text>
          <View className={`${emeraldBadgeClass} mr-3`}>
            <Text className="text-emerald-500 text-xs font-semibold">{sectionItemCount}</Text>
          </View>
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-forward"}
            size={18}
            color={placeholderColor}
          />
        </AnimatedCardPressable>

        {expanded ? (
          <View className={`border-t ${borderClass}`}>
            {renderReferenceLinkItems(section.items, section.id)}
            {section.subsections.map((subsection, index) =>
              renderReferenceSubsection(section, subsection, index)
            )}
          </View>
        ) : null}
      </View>
    );
  };

  const renderOpportunityItems = (
    items: MatchedOpportunity[],
    keyPrefix: string,
    options?: { inset?: boolean }
  ) =>
    items.map((item, index) => (
      <View
        key={`${keyPrefix}-${item.opportunityId}`}
        className={`px-4 py-5 ${
          index !== items.length - 1 ? `border-b ${borderClass}` : ""
        }`}
        style={options?.inset ? { paddingLeft: isCompactPhone ? 36 : 52 } : undefined}
      >
        <View
          className={
            stackOpportunityActions
              ? "gap-4"
              : "flex-row items-center justify-between"
          }
        >
          <View
            style={
              stackOpportunityActions
                ? undefined
                : { flex: 1, minWidth: 0, paddingRight: 16 }
            }
          >
            <Text className={`${textClass} font-medium mb-1`}>{item.title}</Text>
            <Text className={`${secondaryTextClass} text-sm mb-3`}>{item.summary}</Text>

            {getOpportunitySummaryParts(item).length ? (
              <Text className={`${secondaryTextClass} text-xs mb-3`}>
                {getOpportunitySummaryParts(item).join(" | ")}
              </Text>
            ) : null}
          </View>

          <View
            className="flex-row items-center gap-2"
            style={stackOpportunityActions ? { width: "100%", justifyContent: "flex-end" } : undefined}
          >
            {item.externalUrl ? (
              <AnimatedChipPressable
                onPress={() => {
                  void openLink(item.externalUrl ?? "");
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 items-center"
              >
                <Text className="text-emerald-500 text-sm">
                  {t("resources.actionOpen")}
                </Text>
              </AnimatedChipPressable>
            ) : (
              !stackOpportunityActions ? <View className="flex-1" /> : null
            )}

            <TouchIconButton
              onPress={() => {
                void setOpportunityDone(item.opportunityId, !item.isDone);
              }}
              accessibilityLabel={`${item.isDone ? t("resources.actionUndo") : t("resources.actionMarkDone")}: ${item.title}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.isDone }}
              className={`w-12 h-12 rounded-xl border items-center justify-center ${
                item.isDone
                  ? "bg-emerald-500 border-emerald-500"
                  : "bg-emerald-500/10 border-emerald-500/30"
              }`}
            >
              <MaterialIcons
                name={item.isDone ? "check-box" : "check-box-outline-blank"}
                size={22}
                color={item.isDone ? "#FFFFFF" : "#008f4e"}
              />
            </TouchIconButton>
          </View>
        </View>
      </View>
    ));

  const renderOpportunitySubsection = (
    section: OpportunitySection,
    subsection: OpportunitySubsection,
    index: number
  ) => {
    const subsectionKey = `opportunity:${section.key}:sub:${subsection.key}`;
    const expanded = isSectionExpanded(subsectionKey);

    return (
      <View
        key={subsection.key}
        className={index !== 0 || section.items.length ? `border-t ${borderClass}` : ""}
      >
        <AnimatedCardPressable
          onPress={() => toggleSection(subsectionKey)}
          className="px-4 py-4 flex-row items-center"
          accessibilityRole="button"
        >
          <View className="w-2 h-2 rounded-full bg-emerald-500/70 mr-3" />
          <Text className={`${textClass} flex-1`} numberOfLines={1}>
            {subsection.title}
          </Text>
          <View className={`${emeraldBadgeClass} mr-3`}>
            <Text className="text-emerald-500 text-xs font-semibold">{subsection.items.length}</Text>
          </View>
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-forward"}
            size={18}
            color={placeholderColor}
          />
        </AnimatedCardPressable>

        {expanded ? (
          <View className={`border-t ${borderClass}`}>
            {renderOpportunityItems(subsection.items, `${section.key}-${subsection.key}`, {
              inset: true,
            })}
          </View>
        ) : null}
      </View>
    );
  };

  const renderListStyleOpportunitySection = (section: OpportunitySection) => {
    const sectionKey = `opportunity:${section.key}`;
    const expanded = isSectionExpanded(sectionKey);
    const sectionItemCount = countOpportunitySectionItems(section);

    return (
      <View key={section.key} className={`${cardClass} border rounded-2xl overflow-hidden`}>
        <AnimatedCardPressable
          onPress={() => toggleSection(sectionKey)}
          className="px-4 py-4 flex-row items-center"
          accessibilityRole="button"
        >
          <MaterialIcons name={section.icon} size={18} color="#008f4e" />
          <Text className={`${textClass} ml-2 flex-1`} numberOfLines={1}>
            {section.title}
          </Text>
          <View className={`${emeraldBadgeClass} mr-3`}>
            <Text className="text-emerald-500 text-xs font-semibold">{sectionItemCount}</Text>
          </View>
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-forward"}
            size={18}
            color={placeholderColor}
          />
        </AnimatedCardPressable>

        {expanded ? (
          <View className={`border-t ${borderClass}`}>
            {renderOpportunityItems(section.items, section.key)}
            {section.subsections.map((subsection, index) =>
              renderOpportunitySubsection(section, subsection, index)
            )}
          </View>
        ) : null}
      </View>
    );
  };

  const desktopResourcesDashboard = isDesktop ? (
    <>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <View className={panelClass} style={{ width: "100%" }}>
          <View className="relative">
            <View className="absolute left-4 top-4 z-10">
              <Ionicons name="search" size={20} color={placeholderTextColor} />
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("resources.searchPlaceholder")}
              placeholderTextColor={placeholderTextColor}
              className={`w-full ${inputClass} ${textClass} border rounded-2xl pl-12 pr-4 py-4`}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View className="flex-row flex-wrap gap-2 mt-4">
            <View className={emeraldBadgeClass}>
              <Text className="text-emerald-500 text-xs font-semibold">{opportunityCountLabel}</Text>
            </View>
            <View className={emeraldBadgeClass}>
              <Text className="text-emerald-500 text-xs font-semibold">{linkCountLabel}</Text>
            </View>
          </View>

          <View className="mt-6">
            {!isHydrated ? (
              <View className={`${mutedCardClass} p-4 mb-4`}>
                <Text className={`${textClass} font-semibold`}>
                  {t("resources.loadingOpportunitiesTitle")}
                </Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  {t("resources.loadingOpportunitiesBody")}
                </Text>
              </View>
            ) : null}

            {groupedOpportunities.length > 0 || filteredReferenceSections.length > 0 ? (
              <View className="gap-6">
                {toolsReferenceSection ? renderListStyleReferenceSection(toolsReferenceSection) : null}
                {groupedOpportunities.map((section) => renderListStyleOpportunitySection(section))}
                {otherReferenceSections.map((section) => renderListStyleReferenceSection(section))}
              </View>
            ) : (
              <View className={`${mutedCardClass} p-4`}>
                <Text className={`${textClass} font-semibold`}>
                  {t("resources.noMatches")}
                </Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  {t("resources.tryDifferentSearch")}
                </Text>
              </View>
            )}

            <Text className={`${secondaryTextClass} text-xs mt-4 text-center`}>
              {t("resources.openInBrowser")}
            </Text>
          </View>
        </View>
      </View>
    </>
  ) : null;

  return (
    <ScreenBackground>
      <ScrollView
        className="flex-1"
        contentContainerStyle={scrollContentPadding}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="w-full self-center"
          style={{
            maxWidth: shellMaxWidth,
            paddingHorizontal: shellHorizontalPadding,
            paddingTop: shellTopPadding,
          }}
        >
          <View style={isDesktop ? { maxWidth: 720 } : undefined}>
            <Text className={`text-2xl ${textClass} mb-1`}>
              {t("resources.resources")}
            </Text>
            <Text className={`${secondaryTextClass} mb-6`}>
              {t("resources.resourcesDescription")}
            </Text>
          </View>

          {isDesktop ? (
            desktopResourcesDashboard
          ) : (
            <>
              <View className="relative mb-6">
                <View className="absolute left-4 top-4 z-10">
                  <Ionicons name="search" size={20} color={placeholderTextColor} />
                </View>

                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t("resources.searchPlaceholder")}
                  placeholderTextColor={placeholderTextColor}
                  className={`w-full ${inputClass} ${textClass} border rounded-2xl pl-12 pr-4 py-4`}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {!isHydrated ? (
                <View className={`${cardClass} border rounded-2xl p-5 mb-6`}>
                  <Text className={`${textClass} mb-1`}>
                    {t("resources.loadingOpportunitiesTitle")}
                  </Text>
                  <Text className={`${secondaryTextClass} text-sm`}>
                    {t("resources.loadingOpportunitiesBody")}
                  </Text>
                </View>
              ) : null}

              {groupedOpportunities.length > 0 || filteredReferenceSections.length > 0 ? (
                <View className="gap-6 mb-8">
                  {toolsReferenceSection ? renderListStyleReferenceSection(toolsReferenceSection) : null}
                  {groupedOpportunities.map((section) => renderListStyleOpportunitySection(section))}
                  {otherReferenceSections.map((section) => renderListStyleReferenceSection(section))}
                </View>
              ) : (
                <View className={`${cardClass} border rounded-2xl p-5 mb-6`}>
                  <Text className={`${textClass} mb-1`}>
                    {t("resources.noMatches")}
                  </Text>
                  <Text className={`${secondaryTextClass} text-sm`}>
                    {t("resources.tryDifferentSearch")}
                  </Text>
                </View>
              )}

              <View className="mb-8">
                <Text className={`text-xs ${secondaryTextClass} text-center`}>
                  {t("resources.openInBrowser")}
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
