import { useCallback, useMemo, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import {
  RESOURCE_CATALOG,
  type ResourceCatalogItem,
  type ResourceCatalogSection,
  type ResourceCatalogSubsection,
} from "@/constants/resource-catalog";
import { OPPORTUNITY_LISTING_KINDS, OPPORTUNITY_TYPES } from "@/constants/opportunities";
import { ROUTES, routeWithDefaultReturnTo } from "@/constants/routes";
import {
  getTransferEquivalencyTagDisplayLabel,
  TRANSFER_EQUIVALENCY_ALL_TRACKED_TAGS_PARAM,
  TRANSFER_EQUIVALENCY_TRACKED_TAGS,
} from "@/constants/transfer-equivalency-tags";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useOpportunities } from "@/hooks/use-opportunities";
import type { MatchedOpportunity } from "@/services/opportunities/opportunity-matching.service";
import { getLocaleForLanguage } from "@/utils/locale-format";

export type ResourceItem = {
  title: string;
  description: string;
  url: string;
  tags?: string[];
  expiresAt?: string | null;
};

export type ResourceSection = {
  id: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: ResourceItem[];
  subsections: ResourceSubsection[];
};

export type ResourceSubsection = {
  id: string;
  title: string;
  items: ResourceItem[];
};

export type OpportunitySubsection = {
  key: string;
  title: string;
  items: MatchedOpportunity[];
};

export type OpportunitySection = {
  key: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: MatchedOpportunity[];
  subsections: OpportunitySubsection[];
};

type OpportunityListingGroup = "database" | "individual";

type InternalToolTarget = {
  pathname: string;
  params?: Record<string, string | string[]>;
};

type Translate = (key: string, options?: Record<string, string | number>) => string;

function resolveCatalogText(
  entry: Pick<
    ResourceCatalogItem | ResourceCatalogSection | ResourceCatalogSubsection,
    "title" | "titleKey"
  > &
    Partial<Pick<ResourceCatalogItem, "description" | "descriptionKey">>,
  kind: "title" | "description",
  t: Translate
) {
  const key = kind === "title" ? entry.titleKey : entry.descriptionKey;
  const value = kind === "title" ? entry.title : entry.description;
  if (key) return t(key);
  return String(value ?? "").trim();
}

function mapCatalogItem(item: ResourceCatalogItem, t: Translate): ResourceItem {
  return {
    title: resolveCatalogText(item, "title", t),
    description: resolveCatalogText(item, "description", t),
    url: item.url,
    tags: item.tags ?? [],
    expiresAt: item.expiresAt ?? null,
  };
}

function joinResourceLabelList(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function buildInternalAppUrl(
  pathname: string,
  params?: Record<string, string | null | undefined>
) {
  const normalizedPath = String(pathname ?? "").trim().replace(/^\/+/, "");
  if (!normalizedPath) return "app://";

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    const normalizedValue = String(value ?? "").trim();
    if (!normalizedValue) continue;
    searchParams.set(key, normalizedValue);
  }

  const query = searchParams.toString();
  return `app://${normalizedPath}${query ? `?${query}` : ""}`;
}

function parseInternalAppUrl(url: string): InternalToolTarget | null {
  const normalizedUrl = String(url ?? "").trim();
  if (!normalizedUrl.startsWith("app://")) return null;

  const withoutScheme = normalizedUrl.slice("app://".length);
  const queryIndex = withoutScheme.indexOf("?");
  const rawPath = queryIndex >= 0 ? withoutScheme.slice(0, queryIndex) : withoutScheme;
  const normalizedPath = `/${rawPath.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  if (normalizedPath === "/") return null;

  const rawQuery = queryIndex >= 0 ? withoutScheme.slice(queryIndex + 1) : "";
  if (!rawQuery) {
    return { pathname: normalizedPath };
  }

  const params: Record<string, string | string[]> = {};
  const searchParams = new URLSearchParams(rawQuery);
  for (const [key, value] of searchParams.entries()) {
    const existingValue = params[key];
    if (existingValue == null) {
      params[key] = value;
      continue;
    }
    if (Array.isArray(existingValue)) {
      existingValue.push(value);
      continue;
    }
    params[key] = [existingValue, value];
  }

  return {
    pathname: normalizedPath,
    params: Object.keys(params).length > 0 ? params : undefined,
  };
}

export function isTransferPlannerResourceUrl(url: string) {
  return parseInternalAppUrl(url)?.pathname === ROUTES.transferPlanner;
}

export function preloadTransferPlannerPage() {
  void import("@/components/pages/TransferPlannerPage");
}

function insertResourceItemAfterUrl(
  items: ResourceItem[],
  itemToInsert: ResourceItem,
  anchorUrl: string
) {
  if (items.some((item) => item.url === itemToInsert.url)) {
    return items;
  }

  const anchorIndex = items.findIndex((item) => item.url === anchorUrl);
  if (anchorIndex < 0) {
    return [...items, itemToInsert];
  }

  return [
    ...items.slice(0, anchorIndex + 1),
    itemToInsert,
    ...items.slice(anchorIndex + 1),
  ];
}

export function countResourceSectionItems(section: ResourceSection) {
  return (
    section.items.length +
    section.subsections.reduce((sum, subsection) => sum + subsection.items.length, 0)
  );
}

export function countOpportunitySectionItems(section: OpportunitySection) {
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

function formatFullDate(value: string | null, locale: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
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

function uniqueResourceSummaryParts(values: (string | null | undefined)[]) {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const value of values) {
    const normalizedValue = String(value ?? "").trim();
    if (!normalizedValue || seen.has(normalizedValue)) continue;
    seen.add(normalizedValue);
    parts.push(normalizedValue);
  }

  return parts;
}

function openExternalUrlOnWeb(url: string) {
  if (typeof window === "undefined") return false;

  const openedWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (openedWindow) return true;

  window.location.assign(url);
  return true;
}

function buildOpportunitySearchText(opportunity: MatchedOpportunity) {
  return [
    opportunity.title,
    opportunity.organizationName,
    opportunity.summary,
    opportunity.type,
    opportunity.listingKind,
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

const OPPORTUNITY_DATABASE_KEYWORDS = [
  "database",
  "directory",
  "job board",
  "career network",
  "search portal",
  "search tool",
  "listings",
  "opportunities page",
  "opportunity listing",
  "opportunity listings",
  "scholarship opportunities",
  "scholarship listing",
  "scholarship listings",
  "internship opportunities",
  "internship listing",
  "internship listings",
  "student employment",
  "work study jobs",
  "work-study jobs",
  "sites directory",
  "current openings",
  "positions page",
  "varies by posting",
  "varies by scholarship",
];

function getOpportunityListingGroup(
  opportunity: MatchedOpportunity
): OpportunityListingGroup {
  if (opportunity.listingKind === OPPORTUNITY_LISTING_KINDS.database) {
    return OPPORTUNITY_LISTING_KINDS.database;
  }
  if (opportunity.listingKind === OPPORTUNITY_LISTING_KINDS.individual) {
    return OPPORTUNITY_LISTING_KINDS.individual;
  }

  const searchableText = [
    opportunity.title,
    opportunity.organizationName,
    opportunity.summary,
    opportunity.externalUrl,
    opportunity.deadline?.label,
    opportunity.source?.sourceUrl,
    opportunity.source?.sourceLabel,
  ]
    .join(" ")
    .toLowerCase();

  return OPPORTUNITY_DATABASE_KEYWORDS.some((keyword) =>
    searchableText.includes(keyword)
  )
    ? OPPORTUNITY_LISTING_KINDS.database
    : OPPORTUNITY_LISTING_KINDS.individual;
}

function buildListingSubsections(
  items: MatchedOpportunity[],
  individualTitle: string
): OpportunitySubsection[] {
  const databases = items.filter(
    (opportunity) => getOpportunityListingGroup(opportunity) === "database"
  );
  const individualItems = items.filter(
    (opportunity) => getOpportunityListingGroup(opportunity) === "individual"
  );

  return [
    { key: "databases", title: "Databases", items: databases },
    { key: "individual", title: individualTitle, items: individualItems },
  ].filter((subsection) => subsection.items.length > 0);
}

export function useResourcesPageModel() {
  const router = useRouter();
  const { t, language } = useAppLanguage();
  const { state } = useAppData();
  const { isHydrated, matchedOpportunities, refreshOpportunitiesIfNeeded, setOpportunityDone } =
    useOpportunities();
  const [query, setQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const locale = getLocaleForLanguage(language);
  const canShowOpportunityAdminTool = !!state.user && !state.user.isGuest;

  const getStrictDeadlineLabel = useCallback(
    (item: MatchedOpportunity) => {
      const formatted = formatFullDate(item.computedDueAt, locale);
      return formatted ? t("resources.dueOn", { date: formatted }) : t("resources.openDeadline");
    },
    [locale, t]
  );

  const getOpportunityDueLabel = useCallback(
    (item: MatchedOpportunity) => {
      const formatted = formatDueDate(item.computedDueAt, locale);
      if (item.deadline.type === "rolling" && !formatted) {
        return t("resources.rollingDeadline");
      }
      if (!formatted) return t("resources.openDeadline");
      if (item.deadline.type === "priority") {
        return getStrictDeadlineLabel(item);
      }
      if (item.deadline.type === "rolling") {
        return t("resources.rollingDueOn", { date: formatted });
      }
      return getStrictDeadlineLabel(item);
    },
    [getStrictDeadlineLabel, locale, t]
  );

  const formatMoney = useCallback(
    (amount: number | null, currency: string) => {
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
    },
    [locale]
  );

  const getAwardLabel = useCallback(
    (item: MatchedOpportunity) => {
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
    },
    [formatMoney, t]
  );

  const getRecommendationLabel = useCallback(
    (item: MatchedOpportunity) => {
      const count =
        item.requirements.recommendationCountMin ||
        (item.requirements.needsRecommendations ? 1 : 0);
      if (count <= 0) return null;
      return t("resources.recommendationMinimum", { count });
    },
    [t]
  );

  const getEssayLabel = useCallback(
    (item: MatchedOpportunity) => {
      if (item.requirements.essayCount <= 0) return null;
      return item.requirements.essayCount === 1
        ? t("resources.essayLabelSingular", { count: item.requirements.essayCount })
        : t("resources.essayLabelPlural", { count: item.requirements.essayCount });
    },
    [t]
  );

  const getEligibilityLabels = useCallback(
    (item: MatchedOpportunity) => {
      const labels: string[] = [];
      if (item.eligibility.transferOnly) {
        labels.push(t("resources.transferOnly"));
      }
      if (item.eligibility.gpaMin != null && Number(item.eligibility.gpaMin) > 0) {
        labels.push(t("resources.gpaMinimum", { gpa: item.eligibility.gpaMin }));
      }
      return labels;
    },
    [t]
  );

  const getExpiredProgressLabel = useCallback(
    (item: MatchedOpportunity) => {
      const formatted = formatFullDate(item.computedDueAt ?? item.dueAt, locale);
      return formatted
        ? `${t("resources.statusExpired")} ${formatted}`
        : t("resources.statusExpired");
    },
    [locale, t]
  );

  const getProgressLabel = useCallback(
    (item: MatchedOpportunity) => {
      if (item.progress === "won") return t("resources.statusWon");
      if (item.progress === "expired") return getExpiredProgressLabel(item);
      if (item.progress === "submitted") return t("resources.statusSubmitted");
      return item.isDone ? t("resources.statusDone") : null;
    },
    [getExpiredProgressLabel, t]
  );

  const getOpportunitySummaryParts = useCallback(
    (item: MatchedOpportunity) => {
      if (item.matchReasons.length) {
        const dueLabel = item.computedDueAt && !item.isDone
          ? getStrictDeadlineLabel(item)
          : null;
        const reasonParts = item.matchReasons.map((reason) => {
          const normalizedReason = reason.trim().toLowerCase();
          const isStrictDeadlineReason =
            normalizedReason === "due soon" ||
            normalizedReason === "upcoming deadline" ||
            normalizedReason === "priority deadline" ||
            (
              item.deadline.type !== "rolling" &&
              normalizedReason.includes("deadline") &&
              Boolean(item.computedDueAt)
            );
          if (isStrictDeadlineReason) return getStrictDeadlineLabel(item);
          if (normalizedReason === "expired") return getExpiredProgressLabel(item);
          return reason;
        });
        return uniqueResourceSummaryParts([dueLabel, ...reasonParts]);
      }

      return uniqueResourceSummaryParts([
        getRecommendationLabel(item),
        getEssayLabel(item),
        getAwardLabel(item),
        ...getEligibilityLabels(item),
        item.recurrence.isYearly ? t("resources.yearly") : null,
        getOpportunityDueLabel(item),
        item.isDone ? getProgressLabel(item) ?? t("resources.statusDone") : null,
      ]);
    },
    [
      getAwardLabel,
      getEligibilityLabels,
      getEssayLabel,
      getExpiredProgressLabel,
      getOpportunityDueLabel,
      getProgressLabel,
      getRecommendationLabel,
      getStrictDeadlineLabel,
      t,
    ]
  );

  useFocusEffect(
    useCallback(() => {
      void refreshOpportunitiesIfNeeded();
    }, [refreshOpportunitiesIfNeeded])
  );

  const transferCategoryEquivalenciesResource = useMemo<ResourceItem>(() => {
    const trackedTagLabels = TRANSFER_EQUIVALENCY_TRACKED_TAGS.map((tag) =>
      getTransferEquivalencyTagDisplayLabel(tag)
    );

    return {
      title: t("resources.transferCategoryEquivalencies"),
      description: t("resources.transferCategoryEquivalenciesDescription", {
        categories: joinResourceLabelList(trackedTagLabels),
      }),
      url: buildInternalAppUrl(String(ROUTES.transferEquivalencies), {
        collegeId: "uw",
        tag: TRANSFER_EQUIVALENCY_ALL_TRACKED_TAGS_PARAM,
      }),
      tags: [
        "transfer category equivalencies",
        "transfer equivalencies",
        "a&h",
        "ssc",
        "nsc",
        "qsr",
        "vlpa",
        "div",
        "nw",
        "i&s",
        "tools",
      ],
    };
  }, [t]);

  const opportunityAdminResource = useMemo<ResourceItem>(
    () => ({
      title: t("resources.opportunityAdmin"),
      description: t("resources.opportunityAdminDescription"),
      url: buildInternalAppUrl(String(ROUTES.opportunityAdmin)),
      tags: ["admin", "opportunity editor", "catalog", "staff tools"],
    }),
    [t]
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
      })).filter((section) => countResourceSectionItems(section));

      return sections.map((section) => {
        if (section.id !== "tools") return section;

        let items = insertResourceItemAfterUrl(
          section.items,
          transferCategoryEquivalenciesResource,
          buildInternalAppUrl(String(ROUTES.transferPlanner))
        );

        if (
          canShowOpportunityAdminTool &&
          !items.some((item) => item.url === opportunityAdminResource.url)
        ) {
          items = [...items, opportunityAdminResource];
        }

        return {
          ...section,
          items,
        };
      });
    },
    [
      canShowOpportunityAdminTool,
      opportunityAdminResource,
      t,
      transferCategoryEquivalenciesResource,
    ]
  );

  const filteredOpportunities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return matchedOpportunities;
    return matchedOpportunities.filter((opportunity) =>
      buildOpportunitySearchText(opportunity).includes(normalizedQuery)
    );
  }, [matchedOpportunities, query]);

  const groupedOpportunities = useMemo(() => {
    const scholarships = filteredOpportunities.filter(
      (opportunity) => opportunity.type === OPPORTUNITY_TYPES.scholarship
    );
    const internships = filteredOpportunities.filter(
      (opportunity) => opportunity.type === OPPORTUNITY_TYPES.internship
    );
    const deadlineSubsections: OpportunitySubsection[] = [
      {
        key: "college_deadline",
        title: t("resources.collegeDeadlines"),
        items: filteredOpportunities.filter(
          (opportunity) => opportunity.type === OPPORTUNITY_TYPES.collegeDeadline
        ),
      },
      {
        key: "general_deadline",
        title: t("resources.generalDeadlines"),
        items: filteredOpportunities.filter(
          (opportunity) => opportunity.type === OPPORTUNITY_TYPES.generalDeadline
        ),
      },
      {
        key: "academic_calendar",
        title: t("resources.academicCalendar"),
        items: filteredOpportunities.filter(
          (opportunity) =>
            opportunity.type === OPPORTUNITY_TYPES.quarterStart ||
            opportunity.type === OPPORTUNITY_TYPES.quarterEnd
        ),
      },
    ].filter((subsection) => subsection.items.length > 0);

    const sections: OpportunitySection[] = [
      {
        key: "scholarship",
        title: t("resources.scholarships"),
        icon: "attach-money",
        items: [],
        subsections: buildListingSubsections(scholarships, t("resources.individualScholarships")),
      },
      {
        key: "internship",
        title: t("resources.internships"),
        icon: "work",
        items: [],
        subsections: buildListingSubsections(internships, t("resources.individualInternships")),
      },
      {
        key: "deadlines",
        title: t("resources.deadlines"),
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
  const toolsReferenceSection = useMemo(
    () => filteredReferenceSections.find((s) => s.id === "tools"),
    [filteredReferenceSections]
  );
  const otherReferenceSections = useMemo(
    () => filteredReferenceSections.filter((s) => s.id !== "tools"),
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
    (target: string | InternalToolTarget) => {
      const pathname =
        typeof target === "string"
          ? target
          : String(target.pathname ?? "").trim();
      const params = typeof target === "string" ? undefined : target.params;
      if (!pathname) return;

      router.push(routeWithDefaultReturnTo(pathname, params, ROUTES.tabsResources));
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

  const openLink = useCallback(
    async (url: string) => {
      const internalToolTarget = parseInternalAppUrl(url);
      if (internalToolTarget) {
        openInternalTool(internalToolTarget);
        return;
      }

      const safeUrl =
        url.startsWith("http://") || url.startsWith("https://")
          ? url
          : `https://${url}`;
      try {
        if (Platform.OS === "web" && openExternalUrlOnWeb(safeUrl)) {
          return;
        }

        const can = await Linking.canOpenURL(safeUrl);
        if (!can) {
          Alert.alert(t("resources.cannotOpenLink"), t("resources.couldNotOpenLink"));
          return;
        }
        await Linking.openURL(safeUrl);
      } catch {
        Alert.alert(t("resources.linkError"), t("resources.linkErrorMessage"));
      }
    },
    [openInternalTool, t]
  );

  return {
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
  };
}
