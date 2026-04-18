import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import {
  RESOURCE_CATALOG,
  type ResourceCatalogItem,
  type ResourceCatalogSection,
  type ResourceCatalogSubsection,
} from "@/constants/resource-catalog";
import { ROUTES } from "@/constants/routes";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { AnimatedCardPressable, AnimatedChipPressable } from "@/components/ui/AnimatedPressables";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppData } from "@/hooks/use-app-data";
import { useOpportunities } from "@/hooks/use-opportunities";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import type { MatchedOpportunity } from "@/services/opportunities/opportunity-matching.service";
import { getLocaleForLanguage } from "@/utils/locale-format";

type ResourceItem = {
  title: string;
  description: string;
  url: string;
  tags?: string[];
  expiresAt?: string | null;
};

type ResourceSection = {
  id: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: ResourceItem[];
  subsections: ResourceSubsection[];
};

type ResourceSubsection = {
  id: string;
  title: string;
  items: ResourceItem[];
};

type OpportunitySubsection = {
  key: string;
  title: string;
  items: MatchedOpportunity[];
};

type OpportunitySection = {
  key: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: MatchedOpportunity[];
  subsections: OpportunitySubsection[];
};

function resolveCatalogText(
  entry: Pick<
    ResourceCatalogItem | ResourceCatalogSection | ResourceCatalogSubsection,
    "title" | "titleKey"
  > &
    Partial<Pick<ResourceCatalogItem, "description" | "descriptionKey">>,
  kind: "title" | "description",
  t: (key: string, options?: Record<string, string | number>) => string
) {
  const key = kind === "title" ? entry.titleKey : entry.descriptionKey;
  const value = kind === "title" ? entry.title : entry.description;
  if (key) return t(key);
  return String(value ?? "").trim();
}

function mapCatalogItem(
  item: ResourceCatalogItem,
  t: (key: string, options?: Record<string, string | number>) => string
): ResourceItem {
  return {
    title: resolveCatalogText(item, "title", t),
    description: resolveCatalogText(item, "description", t),
    url: item.url,
    tags: item.tags ?? [],
    expiresAt: item.expiresAt ?? null,
  };
}

function countResourceSectionItems(section: ResourceSection) {
  return (
    section.items.length +
    section.subsections.reduce((sum, subsection) => sum + subsection.items.length, 0)
  );
}

function countOpportunitySectionItems(section: OpportunitySection) {
  return (
    section.items.length +
    section.subsections.reduce((sum, subsection) => sum + subsection.items.length, 0)
  );
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

function getLocalDateOnly() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isExpiredResource(value: string | null | undefined) {
  const expiresAt = String(value ?? "").trim();
  if (!expiresAt) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) return false;
  return expiresAt < getLocalDateOnly();
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
  const { isHydrated, matchedOpportunities, refreshOpportunitiesIfNeeded, setOpportunityDone } =
    useOpportunities();
  const { width } = useWindowDimensions();
  const { getScrollContentPadding } = useResponsiveLayout();
  const [query, setQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const { textClass, secondaryTextClass, borderClass, inactiveButtonClass, placeholderColor } = styles;
  const cardClass = styles.cardBgClass;
  const inputClass = styles.inputBgClass;
  const placeholderTextColor = placeholderColor;
  const isDesktop = width >= 1180;
  const stackOpportunityActions = width < 760;
  const shellMaxWidth = isDesktop ? 1280 : width >= 900 ? 1040 : 720;
  const shellHorizontalPadding = width >= 1280 ? 32 : 24;
  const shellTopPadding = width >= 900 ? 32 : 40;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
  });
  const panelClass = `${cardClass} border rounded-[28px] p-5`;
  const mutedCardClass = `${inactiveButtonClass} border ${borderClass} rounded-3xl`;
  const emeraldBadgeClass = "px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20";
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
    const amountMin =
      item.award.amountMin != null && Number(item.award.amountMin) > 0
        ? formatMoney(item.award.amountMin, item.award.currency)
        : null;
    const amountMax =
      item.award.amountMax != null && Number(item.award.amountMax) > 0
        ? formatMoney(item.award.amountMax, item.award.currency)
        : null;
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
  const getEssayLabel = (item: MatchedOpportunity) => {
    if (item.requirements.essayCount <= 0) return null;
    return item.requirements.essayCount === 1
      ? t("resources.essayLabelSingular", { count: item.requirements.essayCount })
      : t("resources.essayLabelPlural", { count: item.requirements.essayCount });
  };
  const getEligibilityLabels = (item: MatchedOpportunity) => {
    const labels: string[] = [];
    if (item.eligibility.transferOnly) {
      labels.push(t("resources.transferOnly"));
    }
    if (item.eligibility.gpaMin != null && Number(item.eligibility.gpaMin) > 0) {
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
  const getOpportunitySummaryParts = (item: MatchedOpportunity) => {
    if (item.matchReasons.length) {
      return item.matchReasons;
    }

    return [
      getRecommendationLabel(item),
      getEssayLabel(item),
      getAwardLabel(item),
      ...getEligibilityLabels(item),
      item.recurrence.isYearly ? t("resources.yearly") : null,
      getOpportunityDueLabel(item),
      item.isDone ? getProgressLabel(item) ?? t("resources.statusDone") : null,
    ].filter((value): value is string => Boolean(value));
  };

  useFocusEffect(
    useCallback(() => {
      void refreshOpportunitiesIfNeeded();
    }, [refreshOpportunitiesIfNeeded])
  );

  const referenceSections: ResourceSection[] = useMemo(
    () => {
      const sections = RESOURCE_CATALOG.map((section: ResourceCatalogSection) => ({
        id: section.id,
        title: resolveCatalogText(section, "title", t),
        icon: section.icon,
        items: (section.items ?? [])
          .filter((item) => !isExpiredResource(item.expiresAt))
          .map((item) => mapCatalogItem(item, t)),
        subsections: (section.subsections ?? [])
          .map((subsection) => ({
            id: subsection.id,
            title: resolveCatalogText(subsection, "title", t),
            items: subsection.items
              .filter((item) => !isExpiredResource(item.expiresAt))
              .map((item) => mapCatalogItem(item, t)),
          }))
          .filter((subsection) => subsection.items.length > 0),
      })).filter((section) => countResourceSectionItems(section) > 0);

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
    const deadlineSubsections: OpportunitySubsection[] = [
      {
        key: "college_deadline",
        title: t("resources.collegeDeadlines"),
        items: filteredOpportunities.filter(
          (opportunity) => opportunity.type === "college_deadline"
        ),
      },
      {
        key: "general_deadline",
        title: "General deadlines",
        items: filteredOpportunities.filter(
          (opportunity) => opportunity.type === "general_deadline"
        ),
      },
    ].filter((subsection) => subsection.items.length > 0);

    const sections: OpportunitySection[] = [
      {
        key: "scholarship",
        title: t("resources.scholarships"),
        icon: "attach-money",
        items: filteredOpportunities.filter(
          (opportunity) => opportunity.type === "scholarship"
        ),
        subsections: [],
      },
      {
        key: "internship",
        title: t("resources.internships"),
        icon: "work",
        items: filteredOpportunities.filter(
          (opportunity) => opportunity.type === "internship"
        ),
        subsections: [],
      },
      {
        key: "deadlines",
        title: "Deadlines",
        icon: "event",
        items: [],
        subsections: deadlineSubsections,
      },
    ];

    return sections.filter((section) => countOpportunitySectionItems(section) > 0);
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
        subsections: section.subsections
          .map((subsection) => ({
            ...subsection,
            items: subsection.items.filter(matches),
          }))
          .filter((subsection) => subsection.items.length > 0),
      }))
      .filter((section) => countResourceSectionItems(section) > 0);
  }, [query, referenceSections]);

  const visibleReferenceLinks = useMemo(
    () => filteredReferenceSections.reduce((sum, section) => sum + countResourceSectionItems(section), 0),
    [filteredReferenceSections]
  );
  const hasActiveSearch = query.trim().length > 0;
  const opportunityCountLabel =
    filteredOpportunities.length === 1
      ? t("resources.countOpportunitySingular", { count: filteredOpportunities.length })
      : t("resources.countOpportunityPlural", { count: filteredOpportunities.length });
  const linkCountLabel =
    visibleReferenceLinks === 1
      ? t("resources.countLinkSingular", { count: visibleReferenceLinks })
      : t("resources.countLinkPlural", { count: visibleReferenceLinks });

  const openInternalTool = useCallback(
    (path: string | Parameters<typeof router.push>[0]) => {
      const pathname =
        typeof path === "string"
          ? path
          : String((path as { pathname?: unknown })?.pathname ?? "").trim();
      router.push(
        {
          pathname: pathname as never,
          params: { returnTo: ROUTES.tabsResources },
        } as never
      );
    },
    [router]
  );

  const toggleSection = useCallback((sectionKey: string) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  }, []);

  const isSectionExpanded = useCallback(
    (sectionKey: string) => hasActiveSearch || Boolean(expandedSections[sectionKey]),
    [expandedSections, hasActiveSearch]
  );

  const openLink = async (url: string) => {
    if (url.startsWith("app://")) {
      const path = url.replace("app://", "/");
      openInternalTool(path);
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

  /*
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
          <AnimatedChipPressable
            onPress={() => {
              void openLink(item.externalUrl ?? "");
            }}
            className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30"
          >
            <Text className="text-emerald-500 text-sm font-medium">
              {t("resources.actionOpen")}
            </Text>
          </AnimatedChipPressable>
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
          <AnimatedCardPressable
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
          </AnimatedCardPressable>
        ))}
      </View>
    </View>
  );

  */
  const renderReferenceLinkItems = (
    items: ResourceItem[],
    keyPrefix: string,
    options?: { inset?: boolean }
  ) =>
    items.map((item, index) => (
      <AnimatedCardPressable
        key={`${keyPrefix}-${item.title}`}
        onPress={() => {
          void openLink(item.url);
        }}
        className={`px-4 py-5 flex-row items-start ${
          index !== items.length - 1 ? `border-b ${borderClass}` : ""
        }`}
        style={options?.inset ? { paddingLeft: 52 } : undefined}
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
      </AnimatedCardPressable>
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
          <MaterialIcons name={section.icon} size={18} color={placeholderColor} />
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
        style={options?.inset ? { paddingLeft: 52 } : undefined}
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
            style={stackOpportunityActions ? { width: "100%" } : undefined}
          >
            {item.externalUrl ? (
              <AnimatedChipPressable
                onPress={() => {
                  void openLink(item.externalUrl ?? "");
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 items-center"
                style={stackOpportunityActions ? { flex: 1, minWidth: 0 } : undefined}
              >
                <Text className="text-emerald-500 text-sm">
                  {t("resources.actionOpen")}
                </Text>
              </AnimatedChipPressable>
            ) : (
              <View className="flex-1" />
            )}

            <Pressable
              onPress={() => {
                void setOpportunityDone(item.opportunityId, !item.isDone);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.isDone }}
              className={`w-11 h-11 rounded-xl border items-center justify-center ${
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
            </Pressable>
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
          <MaterialIcons name={section.icon} size={18} color={placeholderColor} />
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
                {groupedOpportunities.map((section) => renderListStyleOpportunitySection(section))}
                {filteredReferenceSections.map((section) => renderListStyleReferenceSection(section))}
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
                  {groupedOpportunities.map((section) => renderListStyleOpportunitySection(section))}
                  {filteredReferenceSections.map((section) => renderListStyleReferenceSection(section))}
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
