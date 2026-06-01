import type { Href } from "expo-router";

export const TAB_ROUTE_NAMES = {
  home: "index",
  resources: "resources/index",
  profile: "profile",
  settings: "settings",
} as const;

export const PRIMARY_TAB_ROUTE_NAMES = [
  TAB_ROUTE_NAMES.home,
  TAB_ROUTE_NAMES.resources,
  TAB_ROUTE_NAMES.profile,
  TAB_ROUTE_NAMES.settings,
] as const;

export type PrimaryTabRouteName = (typeof PRIMARY_TAB_ROUTE_NAMES)[number];

type RouteParamValue = string | number | boolean | string[] | null | undefined;
type RouteParams = Record<string, RouteParamValue>;

type RouteMetadata = {
  href: string;
  tabScreen?: string;
  primaryTab?: PrimaryTabRouteName;
  hiddenTab?: boolean;
  returnTo?: string;
  aliases?: readonly string[];
};

function normalizeRouteParams(params?: RouteParams) {
  return Object.fromEntries(
    Object.entries(params ?? {})
      .map(([key, value]) => [key, value])
      .filter(([, value]) => {
        if (Array.isArray(value)) return value.length > 0;
        return value !== null && value !== undefined && String(value).trim().length > 0;
      })
  ) as Record<string, string | number | boolean | string[]>;
}

export function hrefWithParams(pathname: string, params?: RouteParams): Href {
  const normalizedParams = normalizeRouteParams(params);
  if (Object.keys(normalizedParams).length === 0) {
    return pathname as Href;
  }

  return {
    pathname,
    params: normalizedParams,
  } as Href;
}

export function routeWithReturnTo(
  pathname: string,
  returnTo?: string | null,
  params?: RouteParams
): Href {
  const normalizedReturnTo = String(returnTo ?? "").trim();
  return hrefWithParams(pathname, {
    ...(params ?? {}),
    ...(normalizedReturnTo ? { returnTo: normalizedReturnTo } : {}),
  });
}

export const APP_ROUTE_METADATA = {
  root: {
    href: "/",
    primaryTab: TAB_ROUTE_NAMES.home,
  },
  tabs: {
    href: "/(tabs)",
    tabScreen: TAB_ROUTE_NAMES.home,
    primaryTab: TAB_ROUTE_NAMES.home,
  },
  tabsResources: {
    href: "/(tabs)/resources",
    tabScreen: TAB_ROUTE_NAMES.resources,
    primaryTab: TAB_ROUTE_NAMES.resources,
    aliases: ["resources"],
  },
  tabsSettings: {
    href: "/(tabs)/settings",
    tabScreen: TAB_ROUTE_NAMES.settings,
    primaryTab: TAB_ROUTE_NAMES.settings,
  },
  login: {
    href: "/login",
  },
  onboarding: {
    href: "/onboarding",
  },
  profile: {
    href: "/profile",
    tabScreen: TAB_ROUTE_NAMES.profile,
    primaryTab: TAB_ROUTE_NAMES.profile,
  },
  profileSetup: {
    href: "/profile-setup",
  },
  questionnaire: {
    href: "/questionnaire",
    tabScreen: "questionnaire",
    primaryTab: TAB_ROUTE_NAMES.home,
    hiddenTab: true,
    returnTo: "/(tabs)",
    aliases: ["roadmap"],
  },
  calendar: {
    href: "/calendar",
    tabScreen: "calendar",
    primaryTab: TAB_ROUTE_NAMES.resources,
    hiddenTab: true,
    returnTo: "/(tabs)/resources",
  },
  opportunityAdmin: {
    href: "/opportunity-admin",
    tabScreen: "opportunity-admin",
    primaryTab: TAB_ROUTE_NAMES.resources,
    hiddenTab: true,
    returnTo: "/(tabs)/resources",
  },
  transferPlanner: {
    href: "/resources/transfer-planner",
    tabScreen: "resources/transfer-planner",
    primaryTab: TAB_ROUTE_NAMES.resources,
    hiddenTab: true,
    returnTo: "/(tabs)/resources",
  },
  transferPlannerMajor: {
    href: "/resources/transfer-planner/[college]/[campus]/[major]",
    tabScreen: "resources/transfer-planner/[college]/[campus]/[major]",
    primaryTab: TAB_ROUTE_NAMES.resources,
    hiddenTab: true,
    returnTo: "/(tabs)/resources",
  },
  transferPlannerLegacy: {
    href: "/transfer-planner",
    tabScreen: "transfer-planner",
    primaryTab: TAB_ROUTE_NAMES.resources,
    hiddenTab: true,
    returnTo: "/(tabs)/resources",
  },
  transferEquivalencies: {
    href: "/transfer-equivalencies",
    tabScreen: "transfer-equivalencies",
    primaryTab: TAB_ROUTE_NAMES.resources,
    hiddenTab: true,
    returnTo: "/(tabs)/resources",
  },
  compare: {
    href: "/compare",
    tabScreen: "compare",
    primaryTab: TAB_ROUTE_NAMES.resources,
    hiddenTab: true,
    returnTo: "/(tabs)/resources",
  },
  costCalculator: {
    href: "/cost-calculator",
    tabScreen: "cost-calculator",
    primaryTab: TAB_ROUTE_NAMES.resources,
    hiddenTab: true,
    returnTo: "/(tabs)/resources",
  },
  savedColleges: {
    href: "/saved-colleges",
    tabScreen: "saved-colleges",
    primaryTab: TAB_ROUTE_NAMES.resources,
    hiddenTab: true,
    returnTo: "/(tabs)/resources",
  },
  language: {
    href: "/language",
    tabScreen: "language",
    primaryTab: TAB_ROUTE_NAMES.settings,
    hiddenTab: true,
    returnTo: "/(tabs)/settings",
  },
  about: {
    href: "/about",
    tabScreen: "about",
    primaryTab: TAB_ROUTE_NAMES.settings,
    hiddenTab: true,
    returnTo: "/(tabs)/settings",
  },
  privacy: {
    href: "/privacy",
    tabScreen: "privacy",
    primaryTab: TAB_ROUTE_NAMES.settings,
    hiddenTab: true,
    returnTo: "/(tabs)/settings",
  },
  terms: {
    href: "/terms",
    tabScreen: "terms",
    primaryTab: TAB_ROUTE_NAMES.settings,
    hiddenTab: true,
    returnTo: "/(tabs)/settings",
  },
  forgotPassword: {
    href: "/forgot-password",
    returnTo: "/login",
  },
  collegeDetail: {
    href: "/college/[collegeId]",
    tabScreen: "college/[collegeId]",
    primaryTab: TAB_ROUTE_NAMES.resources,
    hiddenTab: true,
    returnTo: "/(tabs)/resources",
  },
} as const satisfies Record<string, RouteMetadata>;

const TAB_ROUTE_METADATA = (Object.values(APP_ROUTE_METADATA) as RouteMetadata[]).filter(
  (route): route is RouteMetadata & { tabScreen: string; primaryTab: PrimaryTabRouteName } =>
    !!route.tabScreen && !!route.primaryTab
);

export const HIDDEN_TAB_ROUTE_SCREENS = TAB_ROUTE_METADATA.filter((route) => route.hiddenTab).map(
  (route) => route.tabScreen
);

export const TAB_ROUTE_PRIMARY_TAB_BY_SCREEN = TAB_ROUTE_METADATA.reduce<
  Record<string, PrimaryTabRouteName>
>((aliases, route) => {
  aliases[route.tabScreen] = route.primaryTab;
  for (const alias of route.aliases ?? []) {
    aliases[alias] = route.primaryTab;
  }
  return aliases;
}, {});

const ROUTE_METADATA_BY_HREF = Object.values(APP_ROUTE_METADATA).reduce<Record<string, RouteMetadata>>(
  (routesByHref, route) => {
    routesByHref[route.href] = route;
    return routesByHref;
  },
  {}
);

export function routeWithDefaultReturnTo(
  pathname: string,
  params?: RouteParams,
  returnToOverride?: string | null
): Href {
  const configuredReturnTo = ROUTE_METADATA_BY_HREF[pathname]?.returnTo ?? null;
  return routeWithReturnTo(pathname, returnToOverride ?? configuredReturnTo, params);
}

export const ROUTES = {
  root: APP_ROUTE_METADATA.root.href,
  tabs: APP_ROUTE_METADATA.tabs.href,
  tabsSettings: APP_ROUTE_METADATA.tabsSettings.href,
  tabsResources: APP_ROUTE_METADATA.tabsResources.href,
  login: APP_ROUTE_METADATA.login.href,
  onboarding: APP_ROUTE_METADATA.onboarding.href,
  profile: APP_ROUTE_METADATA.profile.href,
  profileSetup: APP_ROUTE_METADATA.profileSetup.href,
  questionnaire: APP_ROUTE_METADATA.questionnaire.href,
  calendar: APP_ROUTE_METADATA.calendar.href,
  opportunityAdmin: APP_ROUTE_METADATA.opportunityAdmin.href,
  transferPlanner: APP_ROUTE_METADATA.transferPlanner.href,
  transferPlannerMajor({
    college,
    campus,
    major,
    params,
  }: {
    college: string;
    campus: string;
    major: string;
    params?: RouteParams;
  }): Href {
    return hrefWithParams(APP_ROUTE_METADATA.transferPlannerMajor.href, {
      college,
      campus,
      major,
      ...(params ?? {}),
    });
  },
  transferEquivalencies: APP_ROUTE_METADATA.transferEquivalencies.href,
  compare: APP_ROUTE_METADATA.compare.href,
  costCalculator: APP_ROUTE_METADATA.costCalculator.href,
  savedColleges: APP_ROUTE_METADATA.savedColleges.href,
  language: APP_ROUTE_METADATA.language.href,
  about: APP_ROUTE_METADATA.about.href,
  privacy: APP_ROUTE_METADATA.privacy.href,
  terms: APP_ROUTE_METADATA.terms.href,
  forgotPassword: APP_ROUTE_METADATA.forgotPassword.href,
  collegeDetail(
    collegeId: string,
    params?: Record<string, string | number | boolean | null | undefined>
  ): Href {
    return hrefWithParams("/college/[collegeId]", { collegeId, ...(params ?? {}) });
  },
  loginWithQuery(query: string): Href {
    return `${ROUTES.login}?${query}` as Href;
  },
} as const;
