import React, { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type DimensionValue,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  RESOURCE_CATALOG,
  type ResourceCatalogItem,
  type ResourceCatalogSection,
} from "@/constants/resource-catalog";
import { ROUTES } from "@/constants/routes";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppData } from "@/hooks/use-app-data";
import { useOpportunities } from "@/hooks/use-opportunities";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import type { MatchedOpportunity } from "@/services/opportunity-matching.service";
import { getLocaleForLanguage } from "@/utils/locale-format";

type ResourceItem = {
  title: string;
  description: string;
  url: string;
  tags?: string[];
};

type ResourceSection = {
  id: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: ResourceItem[];
};

function resolveCatalogText(
  entry: Pick<ResourceCatalogItem, "title" | "titleKey" | "description" | "descriptionKey">,
  kind: "title" | "description",
  t: (key: string, options?: Record<string, string | number>) => string
) {
  const key = kind === "title" ? entry.titleKey : entry.descriptionKey;
  const value = kind === "title" ? entry.title : entry.description;
  if (key) return t(key);
  return String(value ?? "").trim();
}

function formatDueDate(value: string | null, locale: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsed);
  } catch {
    return parsed.toDateString();
  }
}

function buildOpportunitySearchText(opportunity: MatchedOpportunity) {
  return [
    opportunity.title,
    opportunity.organizationName,
    opportunity.summary,
    opportunity.type,
    opportunity.deadline?.label,
    opportunity.award?.amountText,
    ...(opportunity.matchReasons ?? []),
    ...(opportunity.matching?.suggestedMajors ?? []),
    ...(opportunity.matching?.financialAidTags ?? []),
    ...(opportunity.eligibility?.residencyTypes ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

export default function ResourcesPage() {
  const router = useRouter();
  const styles = useThemeStyles();
  const { t, language } = useAppLanguage();
  const { state } = useAppData();
  const { isHydrated, isRefreshing, matchedOpportunities, refreshOpportunities, setOpportunityDone } =
    useOpportunities();
  const { width } = useWindowDimensions();
  const { getScrollContentPadding } = useResponsiveLayout();
  const [query, setQuery] = useState("");

  const { textClass, secondaryTextClass, borderClass, inactiveButtonClass, placeholderColor } = styles;
  const cardClass = styles.cardBgClass;
  const inputClass = styles.inputBgClass;
  const placeholderTextColor = placeholderColor;
  const isTablet = width >= 768;
  const isDesktop = width >= 1180;
  const stackHeaderActions = width < 620;
  const stackOpportunityActions = width < 760;
  const shellMaxWidth = isDesktop ? 1280 : width >= 900 ? 1040 : 720;
  const shellHorizontalPadding = width >= 1280 ? 32 : 24;
  const shellTopPadding = width >= 900 ? 32 : 40;
  const contentColumnsClass = isDesktop ? "flex-row items-start gap-6" : "gap-6";
  const opportunityColumnStyle = isDesktop ? { flex: 1, minWidth: 0 } : undefined;
  const referenceColumnStyle = isDesktop
    ? { width: width >= 1440 ? 420 : 392, flexShrink: 0 }
    : undefined;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
  });
  const panelClass = `${cardClass} border rounded-[28px] p-5`;
  const nestedCardClass = `${cardClass} border rounded-3xl`;
  const mutedCardClass = `${inactiveButtonClass} border ${borderClass} rounded-3xl`;
  const emeraldBadgeClass = "px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20";
  const desktopFullWidthStyle = { width: "100%" as DimensionValue };
  const locale = getLocaleForLanguage(language);
  const canShowOpportunityAdminTool = !!state.user && !state.user.isGuest;
  const getOpportunityDueLabel = (item: MatchedOpportunity) => {
    const formatted = formatDueDate(item.computedDueAt, locale);
    if (item.deadline.type === "rolling" && !formatted) {
      return t("resources.rollingDeadline");
    }
    if (!formatted) return t("resources.openDeadline");
    if (item.deadline.type === "priority") {
      return t("resources.priorityDueOn", { date: formatted });
    }
    if (item.deadline.type === "rolling") {
      return t("resources.rollingDueOn", { date: formatted });
    }
    return t("resources.dueOn", { date: formatted });
  };
  const formatMoney = (amount: number | null, currency: string) => {
    if (amount == null) return null;
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return String(amount);
    }
  };
  const getAwardLabel = (item: MatchedOpportunity) => {
    if (item.award.amountText) return item.award.amountText;
    const amountMin = formatMoney(item.award.amountMin, item.award.currency);
    const amountMax = formatMoney(item.award.amountMax, item.award.currency);
    if (amountMin && amountMax && amountMin !== amountMax) {
      return t("resources.awardRange", { min: amountMin, max: amountMax });
    }
    if (amountMin || amountMax) {
      return t("resources.awardAmount", { amount: amountMin ?? amountMax ?? "" });
    }
    return null;
  };
  const getRecommendationLabel = (item: MatchedOpportunity) => {
    const count =
      item.requirements.recommendationCountMin ||
      (item.requirements.needsRecommendations ? 1 : 0);
    if (count <= 0) return null;
    return t("resources.recommendationMinimum", { count });
  };
  const getEligibilityLabels = (item: MatchedOpportunity) => {
    const labels: string[] = [];
    if (item.eligibility.transferOnly) {
      labels.push(t("resources.transferOnly"));
    }
    if (item.eligibility.gpaMin != null) {
      labels.push(t("resources.gpaMinimum", { gpa: item.eligibility.gpaMin }));
    }
    return labels;
  };
  const getProgressLabel = (item: MatchedOpportunity) => {
    if (item.progress === "won") return t("resources.statusWon");
    if (item.progress === "expired") return t("resources.statusExpired");
    if (item.progress === "submitted") return t("resources.statusSubmitted");
    return item.isDone ? t("resources.statusDone") : null;
  };

  const referenceSections: ResourceSection[] = useMemo(
    () => {
      const sections = RESOURCE_CATALOG.map((section: ResourceCatalogSection) => ({
        id: section.id,
        title: resolveCatalogText(section, "title", t),
        icon: section.icon,
        items: section.items.map((item) => ({
          title: resolveCatalogText(item, "title", t),
          description: resolveCatalogText(item, "description", t),
          url: item.url,
          tags: item.tags ?? [],
        })),
      }));

      if (!canShowOpportunityAdminTool) {
        return sections;
      }

      return sections.map((section) => {
        if (section.id !== "tools") return section;
        return {
          ...section,
          items: [
            ...section.items,
            {
              title: "Opportunity Admin",
              description:
                "Create, edit, archive, and review shared opportunity records without touching source files.",
              url: "app://opportunity-admin",
              tags: ["admin", "opportunity editor", "catalog", "staff tools"],
            },
          ],
        };
      });
    },
    [canShowOpportunityAdminTool, t]
  );

  const filteredOpportunities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return matchedOpportunities;
    return matchedOpportunities.filter((opportunity) =>
      buildOpportunitySearchText(opportunity).includes(normalizedQuery)
    );
  }, [matchedOpportunities, query]);

  const groupedOpportunities = useMemo(() => {
    const sections = [
      {
        key: "scholarship",
        title: t("resources.scholarships"),
        icon: "attach-money" as const,
      },
      {
        key: "internship",
        title: t("resources.internships"),
        icon: "work" as const,
      },
      {
        key: "college_deadline",
        title: t("resources.collegeDeadlines"),
        icon: "event" as const,
      },
    ];

    return sections
      .map((section) => ({
        ...section,
        items: filteredOpportunities.filter(
          (opportunity) => opportunity.type === section.key
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [filteredOpportunities, t]);

  const filteredReferenceSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return referenceSections;

    const matches = (item: ResourceItem) => {
      const haystack = (
        item.title +
        " " +
        item.description +
        " " +
        (item.tags ?? []).join(" ")
      ).toLowerCase();
      return haystack.includes(normalizedQuery);
    };

    return referenceSections
      .map((section) => ({
        ...section,
        items: section.items.filter(matches),
      }))
      .filter((section) => section.items.length > 0);
  }, [query, referenceSections]);

  const visibleReferenceLinks = useMemo(
    () => filteredReferenceSections.reduce((sum, section) => sum + section.items.length, 0),
    [filteredReferenceSections]
  );
  const opportunityCountLabel =
    filteredOpportunities.length === 1
      ? t("resources.countOpportunitySingular", { count: filteredOpportunities.length })
      : t("resources.countOpportunityPlural", { count: filteredOpportunities.length });
  const linkCountLabel =
    visibleReferenceLinks === 1
      ? t("resources.countLinkSingular", { count: visibleReferenceLinks })
      : t("resources.countLinkPlural", { count: visibleReferenceLinks });

  const openLink = async (url: string) => {
    if (url.startsWith("app://")) {
      const path = url.replace("app://", "/");
      router.push(path as never);
      return;
    }

    const safeUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://${url}`;
    try {
      const can = await Linking.canOpenURL(safeUrl);
      if (!can) {
        Alert.alert(t("resources.cannotOpenLink"), t("resources.couldNotOpenLink"));
        return;
      }
      await Linking.openURL(safeUrl);
    } catch {
      Alert.alert(t("resources.linkError"), t("resources.linkErrorMessage"));
    }
  };

  const renderDesktopOpportunityItem = (item: MatchedOpportunity) => (
    <View key={item.opportunityId} className={`${nestedCardClass} p-4`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 min-w-0">
          <Text className={`${textClass} font-semibold`} numberOfLines={2}>
            {item.title}
          </Text>
          <Text className={`${secondaryTextClass} text-sm mt-2`} numberOfLines={3}>
            {item.summary}
          </Text>
        </View>
        {item.isDone ? (
          <View className={emeraldBadgeClass}>
            <Text className="text-emerald-500 text-xs font-semibold">
              {getProgressLabel(item) ?? t("resources.statusDone")}
            </Text>
          </View>
        ) : null}
        {getAwardLabel(item) ? (
          <View className={emeraldBadgeClass}>
            <Text className="text-emerald-500 text-xs font-semibold">
              {getAwardLabel(item)}
            </Text>
          </View>
        ) : null}
        {getEligibilityLabels(item).map((label) => (
          <View key={`${item.opportunityId}-${label}`} className={emeraldBadgeClass}>
            <Text className="text-emerald-500 text-xs font-semibold">{label}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap gap-2 mt-3">
        <View className={emeraldBadgeClass}>
          <Text className="text-emerald-500 text-xs font-semibold">
            {getOpportunityDueLabel(item)}
          </Text>
        </View>
        {item.recurrence.isYearly ? (
          <View className={emeraldBadgeClass}>
            <Text className="text-emerald-500 text-xs font-semibold">
              {t("resources.yearly")}
            </Text>
          </View>
        ) : null}
        {getRecommendationLabel(item) ? (
          <View className={emeraldBadgeClass}>
            <Text className="text-emerald-500 text-xs font-semibold">
              {getRecommendationLabel(item)}
            </Text>
          </View>
        ) : null}
        {item.requirements.essayCount > 0 ? (
          <View className={emeraldBadgeClass}>
            <Text className="text-emerald-500 text-xs font-semibold">
              {item.requirements.essayCount === 1
                ? t("resources.essayLabelSingular", { count: item.requirements.essayCount })
                : t("resources.essayLabelPlural", { count: item.requirements.essayCount })}
            </Text>
          </View>
        ) : null}
      </View>

      {item.matchReasons.length ? (
        <Text className={`${secondaryTextClass} text-xs mt-3`}>
          {item.matchReasons.join(" • ")}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-2 mt-4">
        {item.externalUrl ? (
          <Pressable
            onPress={() => {
              void openLink(item.externalUrl ?? "");
            }}
            className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30"
          >
            <Text className="text-emerald-500 text-sm font-medium">
              {t("resources.actionOpen")}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => {
            void setOpportunityDone(item.opportunityId, !item.isDone);
          }}
          className={`px-4 py-2.5 rounded-xl border ${item.isDone ? `${inactiveButtonClass} ${borderClass}` : "bg-emerald-500 border-emerald-500"}`}
        >
          <Text className={`text-sm font-medium ${item.isDone ? textClass : "text-white"}`}>
            {item.isDone ? t("resources.actionUndo") : t("resources.actionMarkDone")}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderDesktopReferenceSection = (section: ResourceSection) => (
    <View key={section.id} className={`${nestedCardClass} p-4`}>
      <View className="flex-row items-center justify-between gap-3 mb-4">
        <View className="flex-row items-center flex-1 min-w-0">
          <View className="w-10 h-10 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
            <MaterialIcons name={section.icon} size={18} color="#008f4e" />
          </View>
          <Text className={`${textClass} font-semibold flex-1`} numberOfLines={2}>
            {section.title}
          </Text>
        </View>
        <View className={emeraldBadgeClass}>
          <Text className="text-emerald-500 text-xs font-semibold">{section.items.length}</Text>
        </View>
      </View>

      <View className="gap-2">
        {section.items.map((item) => (
          <Pressable
            key={`${section.id}-${item.title}`}
            onPress={() => {
              void openLink(item.url);
            }}
            className={`${mutedCardClass} px-4 py-3 flex-row items-start`}
            accessibilityRole="link"
          >
            <View className="mt-0.5">
              <Ionicons name="link-outline" size={18} color={placeholderColor} />
            </View>
            <View className="flex-1 ml-3">
              <Text className={`${textClass} font-medium mb-1`}>{item.title}</Text>
              <Text className={`${secondaryTextClass} text-sm`}>{item.description}</Text>
            </View>
            <MaterialIcons name="open-in-new" size={18} color={placeholderColor} />
          </Pressable>
        ))}
      </View>
    </View>
  );

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
        <View className={panelClass} style={desktopFullWidthStyle}>
          <View className="flex-row items-start mb-4">
            <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
              <Ionicons name="search-outline" size={18} color="#008f4e" />
            </View>
            <View className="flex-1">
              <Text className={`${textClass} text-lg font-semibold`}>
                {t("resources.searchPanelTitle")}
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                {t("resources.searchPanelBody")}
              </Text>
            </View>
          </View>

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

          <View className="flex-row flex-wrap gap-3 mt-4">
            <Pressable
              onPress={() => router.push(ROUTES.transferPlanner)}
              className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 items-center"
              style={{ flexGrow: 1, minWidth: 150 }}
            >
              <Text className="text-emerald-500 text-sm font-medium">
                {t("resources.transferPlanner")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(ROUTES.collegeSearch)}
              className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 items-center"
              style={{ flexGrow: 1, minWidth: 150 }}
            >
              <Text className="text-emerald-500 text-sm font-medium">
                {t("resources.collegeSearchTool")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(ROUTES.calendar)}
              className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 items-center"
              style={{ flexGrow: 1, minWidth: 150 }}
            >
              <Text className="text-emerald-500 text-sm font-medium">
                {t("resources.deadlineCalendar")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void refreshOpportunities();
              }}
              className="px-4 py-3 rounded-2xl bg-emerald-500 border border-emerald-500 items-center"
              style={{ flexGrow: 1, minWidth: 150 }}
            >
              <Text className="text-white text-sm font-medium">
                {isRefreshing ? t("resources.actionRefreshing") : t("resources.actionRefresh")}
              </Text>
            </Pressable>
          </View>

          <View className={`mt-6 pt-6 border-t ${borderClass}`}>
            <View className="flex-row items-start mb-4">
              <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
                <Ionicons name="compass-outline" size={18} color="#008f4e" />
              </View>
              <View className="flex-1">
                <Text className={`${textClass} text-lg font-semibold`}>
                  {t("resources.referenceHubTitle")}
                </Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  {t("resources.referenceHubBody")}
                </Text>
              </View>
            </View>

            {filteredReferenceSections.length > 0 ? (
              <View className="gap-4">
                {filteredReferenceSections.map((section) => renderDesktopReferenceSection(section))}
              </View>
            ) : (
              <View className={`${mutedCardClass} p-4`}>
                <Text className={`${textClass} font-semibold`}>
                  {t("resources.noResourceLinksTitle")}
                </Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  {t("resources.noResourceLinksBody")}
                </Text>
              </View>
            )}

            <Text className={`${secondaryTextClass} text-xs mt-4 text-center`}>
              {t("resources.openInBrowser")}
            </Text>
          </View>

          {!isHydrated ? (
            <View className={`${mutedCardClass} p-4 mt-4`}>
              <Text className={`${textClass} font-semibold`}>
                {t("resources.loadingCachedTitle")}
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                {t("resources.loadingCachedBody")}
              </Text>
            </View>
          ) : null}
        </View>

        <View className={panelClass} style={desktopFullWidthStyle}>
          <View className="flex-row items-start mb-4">
            <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
              <Ionicons name="sparkles-outline" size={18} color="#008f4e" />
            </View>
            <View className="flex-1">
              <Text className={`${textClass} text-lg font-semibold`}>
                {t("resources.opportunitiesPanelTitle")}
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                {t("resources.opportunitiesPanelBody")}
              </Text>
            </View>
          </View>

          {!isHydrated ? (
            <View className={`${mutedCardClass} p-4`}>
              <Text className={`${textClass} font-semibold`}>
                {t("resources.loadingOpportunitiesTitle")}
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                {t("resources.loadingOpportunitiesBody")}
              </Text>
            </View>
          ) : groupedOpportunities.length === 0 ? (
            <View className={`${mutedCardClass} p-4`}>
              <Text className={`${textClass} font-semibold`}>
                {t("resources.noOpportunitiesTitle")}
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                {t("resources.noOpportunitiesBody")}
              </Text>
            </View>
          ) : (
            <View className="gap-5">
              {groupedOpportunities.map((section) => (
                <View key={section.key}>
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center flex-1 min-w-0">
                      <View className="w-10 h-10 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
                        <MaterialIcons name={section.icon} size={18} color="#008f4e" />
                      </View>
                      <Text className={`${textClass} font-semibold flex-1`} numberOfLines={1}>
                        {section.title}
                      </Text>
                    </View>
                    <View className={emeraldBadgeClass}>
                      <Text className="text-emerald-500 text-xs font-semibold">
                        {section.items.length}
                      </Text>
                    </View>
                  </View>

                  <View className="gap-3">
                    {section.items.map((item) => renderDesktopOpportunityItem(item))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </>
  ) : null;

  return (
    <ScreenBackground>
      <ScrollView
        className="flex-1"
        contentContainerStyle={scrollContentPadding}
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

              <View className={`${cardClass} border rounded-2xl p-5 mb-6`}>
                <View
                  className={stackHeaderActions ? "gap-4" : "flex-row items-start justify-between gap-4"}
                >
                  <View style={stackHeaderActions ? undefined : { flex: 1, minWidth: 0, paddingRight: 16 }}>
                    <Text className={`${textClass} font-medium mb-1`}>
                      {t("resources.mobileOpportunitiesTitle")}
                    </Text>
                    <Text className={`${secondaryTextClass} text-sm`}>
                      {t("resources.mobileOpportunitiesBody")}
                    </Text>
                  </View>

                  <View
                    className={stackHeaderActions ? "gap-2" : "flex-row flex-wrap justify-end gap-2"}
                    style={stackHeaderActions ? { width: "100%" } : { maxWidth: isTablet ? 320 : 260 }}
                  >
                    <Pressable
                      onPress={() => router.push(ROUTES.calendar)}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 items-center"
                      style={stackHeaderActions ? { width: "100%" } : undefined}
                    >
                      <Text className="text-emerald-500 text-sm">
                        {t("resources.deadlineCalendar")}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        void refreshOpportunities();
                      }}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 items-center"
                      style={stackHeaderActions ? { width: "100%" } : undefined}
                    >
                      <Text className="text-emerald-500 text-sm">
                        {isRefreshing ? t("resources.actionRefreshing") : t("resources.actionRefresh")}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <View className={contentColumnsClass}>
                <View style={opportunityColumnStyle}>
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

                  {groupedOpportunities.length === 0 ? (
                    <View className={`${cardClass} border rounded-2xl p-5 mb-6`}>
                      <Text className={`${textClass} mb-1`}>
                        {t("resources.noOpportunitiesTitle")}
                      </Text>
                      <Text className={`${secondaryTextClass} text-sm`}>
                        {t("resources.noOpportunitiesBody")}
                      </Text>
                    </View>
                  ) : (
                    <View className="gap-6 mb-8">
                      {groupedOpportunities.map((section) => (
                        <View key={section.key}>
                          <View className="flex-row items-center mb-3 px-2">
                            <MaterialIcons
                              name={section.icon}
                              size={18}
                              color={placeholderColor}
                            />
                            <Text className={`${textClass} ml-2`}>{section.title}</Text>
                          </View>

                          <View className={`${cardClass} border rounded-2xl overflow-hidden`}>
                            {section.items.map((item, index) => (
                              <View
                                key={item.opportunityId}
                                className={`px-4 py-5 ${
                                  index !== section.items.length - 1
                                    ? `border-b ${borderClass}`
                                    : ""
                                }`}
                              >
                                <View
                                  className={
                                    stackOpportunityActions
                                      ? "gap-4"
                                      : "flex-row items-start justify-between"
                                  }
                                >
                                  <View
                                    style={
                                      stackOpportunityActions
                                        ? undefined
                                        : { flex: 1, minWidth: 0, paddingRight: 16 }
                                    }
                                  >
                                    <Text className={`${textClass} font-medium mb-1`}>
                                      {item.title}
                                    </Text>
                                    <Text className={`${secondaryTextClass} text-sm mb-3`}>
                                      {item.summary}
                                    </Text>

                                    <View className="flex-row flex-wrap gap-2 mb-3">
                                      <View className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                        <Text className="text-emerald-500 text-xs">
                                          {getOpportunityDueLabel(item)}
                                        </Text>
                                      </View>
                                      {item.recurrence.isYearly ? (
                                        <View className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                          <Text className="text-emerald-500 text-xs">
                                            {t("resources.yearly")}
                                          </Text>
                                        </View>
                                      ) : null}
                                      {getRecommendationLabel(item) ? (
                                        <View className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                          <Text className="text-emerald-500 text-xs">
                                            {getRecommendationLabel(item)}
                                          </Text>
                                        </View>
                                      ) : null}
                                      {item.requirements.essayCount > 0 ? (
                                        <View className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                          <Text className="text-emerald-500 text-xs">
                                            {item.requirements.essayCount === 1
                                              ? t("resources.essayLabelSingular", {
                                                  count: item.requirements.essayCount,
                                                })
                                              : t("resources.essayLabelPlural", {
                                                  count: item.requirements.essayCount,
                                                })}
                                          </Text>
                                        </View>
                                      ) : null}
                                      {getAwardLabel(item) ? (
                                        <View className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                          <Text className="text-emerald-500 text-xs">
                                            {getAwardLabel(item)}
                                          </Text>
                                        </View>
                                      ) : null}
                                      {getEligibilityLabels(item).map((label) => (
                                        <View
                                          key={`${item.opportunityId}-${label}`}
                                          className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                                        >
                                          <Text className="text-emerald-500 text-xs">
                                            {label}
                                          </Text>
                                        </View>
                                      ))}
                                      {item.isDone ? (
                                        <View className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                          <Text className="text-emerald-500 text-xs">
                                            {getProgressLabel(item) ?? t("resources.statusDone")}
                                          </Text>
                                        </View>
                                      ) : null}
                                    </View>

                                    {item.matchReasons.length ? (
                                      <Text className={`${secondaryTextClass} text-xs`}>
                                        {item.matchReasons.join(" | ")}
                                      </Text>
                                    ) : null}
                                  </View>

                                  <View
                                    className={stackOpportunityActions ? "gap-2" : "items-end gap-2"}
                                    style={stackOpportunityActions ? { width: "100%" } : undefined}
                                  >
                                    {item.externalUrl ? (
                                      <Pressable
                                        onPress={() => {
                                          void openLink(item.externalUrl ?? "");
                                        }}
                                        className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 items-center"
                                        style={stackOpportunityActions ? { width: "100%" } : undefined}
                                      >
                                        <Text className="text-emerald-500 text-sm">
                                          {t("resources.actionOpen")}
                                        </Text>
                                      </Pressable>
                                    ) : null}

                                    <Pressable
                                      onPress={() => {
                                        void setOpportunityDone(
                                          item.opportunityId,
                                          !item.isDone
                                        );
                                      }}
                                      className={`px-4 py-2.5 rounded-xl border items-center ${
                                        item.isDone
                                          ? "bg-white/10 border-white/20"
                                          : "bg-emerald-500 border-emerald-500"
                                      }`}
                                      style={stackOpportunityActions ? { width: "100%" } : undefined}
                                    >
                                      <Text
                                        className={`text-sm ${
                                          item.isDone ? textClass : "text-white"
                                        }`}
                                      >
                                        {item.isDone
                                          ? t("resources.actionUndo")
                                          : t("resources.actionMarkDone")}
                                      </Text>
                                    </Pressable>
                                  </View>
                                </View>
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View style={referenceColumnStyle}>
                  {filteredReferenceSections.length > 0 ? (
                    <View className="gap-6">
                      {filteredReferenceSections.map((section) => (
                        <View key={section.id}>
                          <View className="flex-row items-center mb-3 px-2">
                            <MaterialIcons
                              name={section.icon}
                              size={18}
                              color={placeholderColor}
                            />
                            <Text className={`${textClass} ml-2`}>{section.title}</Text>
                          </View>

                          <View className={`${cardClass} border rounded-2xl overflow-hidden`}>
                            {section.items.map((item, index) => (
                              <Pressable
                                key={`${section.id}-${item.title}`}
                                onPress={() => {
                                  void openLink(item.url);
                                }}
                                className={`px-4 py-5 flex-row items-start ${
                                  index !== section.items.length - 1
                                    ? `border-b ${borderClass}`
                                    : ""
                                }`}
                                accessibilityRole="link"
                              >
                                <View className="mt-0.5">
                                  <Ionicons
                                    name="link-outline"
                                    size={18}
                                    color={placeholderColor}
                                  />
                                </View>

                                <View className="flex-1 ml-3">
                                  <Text className={`${textClass} font-medium mb-1`}>
                                    {item.title}
                                  </Text>
                                  <Text className={`${secondaryTextClass} text-sm`}>
                                    {item.description}
                                  </Text>
                                </View>

                                <MaterialIcons
                                  name="open-in-new"
                                  size={18}
                                  color={placeholderColor}
                                />
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View className={filteredReferenceSections.length > 0 ? "mt-8" : isDesktop ? "mt-2" : "mt-0"}>
                    <Text className={`text-xs ${secondaryTextClass} text-center`}>
                      {t("resources.openInBrowser")}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
