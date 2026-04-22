import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useGlobalSearchParams, usePathname, useSegments } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_VERSION } from "@/constants/app-version";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useOpportunities } from "@/hooks/use-opportunities";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import {
  aiService,
  API_CONFIG,
  cacheManagerService,
  devConsoleLogService,
  hasCollegeScorecardApiKey,
  isStubMode,
  notificationsService,
  transcriptPlannerDebugService,
} from "@/services";
import { translations } from "@/services/app/translations";

type SavedLogStatus =
  | {
      kind: "saved";
      message: string;
      relativePath: string;
      fileUri: string;
    }
  | {
      kind: "failed";
      message: string;
    }
  | null;

type DevSnapshot = {
  meta: {
    generatedAt: string;
    appVersion: string;
    isDev: boolean;
    currentPage: {
      pathname: string;
      pageLabel: string;
      primaryTab: string;
      segments: string[];
      params: Record<string, unknown>;
      href: string | null;
    };
    notes: string[];
  };
  runtime: {
    platform: string;
    width: number;
    height: number;
    fontScale: number;
    breakpoint: string;
    isPhoneLikeViewport: boolean;
    topInset: number;
    bottomInset: number;
    currentTime: string;
    web:
      | {
          href: string | null;
          origin: string | null;
          path: string | null;
          query: Record<string, string>;
          userAgent: string | null;
          innerWidth: number | null;
          innerHeight: number | null;
          outerWidth: number | null;
          outerHeight: number | null;
          scrollX: number | null;
          scrollY: number | null;
          devicePixelRatio: number | null;
          online: boolean | null;
          readyState: string | null;
          visibilityState: string | null;
          documentDir: string | null;
          activeElement:
            | {
                tagName: string | null;
                id: string | null;
                className: string | null;
              }
            | null;
          iconFonts: {
            status: string | null;
            totalFontFaces: number | null;
            checks: Array<{
              family: string;
              available: boolean | null;
            }>;
            matchingFaces: Array<{
              family: string | null;
              status: string | null;
              style: string | null;
              weight: string | null;
            }>;
          };
          resourceDiagnostics: {
            relevantEntryCount: number;
            relevantEntries: Array<{
              name: string | null;
              initiatorType: string | null;
              durationMs: number | null;
              transferSize: number | null;
              encodedBodySize: number | null;
              decodedBodySize: number | null;
              startTimeMs: number | null;
              responseEndMs: number | null;
            }>;
            recentLoadErrors: Array<{
              timestamp: string;
              tagName: string | null;
              url: string | null;
              rel: string | null;
              as: string | null;
            }>;
          };
          navigationTiming:
            | {
                type: string | null;
                domContentLoadedMs: number | null;
                loadEventMs: number | null;
                responseEndMs: number | null;
              }
            | null;
        }
      | null;
  };
  theme: {
    selectedTheme: string;
    resolvedTheme: string;
    isDark: boolean;
    isGreen: boolean;
    isLight: boolean;
    hydrated: boolean;
  };
  language: {
    selectedLanguage: string;
    hydrated: boolean;
    isRTL: boolean;
    englishTranslationKeyCount: number;
    englishTranslationKeys: string[];
  };
  navigation: {
    visiblePrimaryTabs: string[];
    hiddenChildRoutes: string[];
    segments: string[];
    params: Record<string, unknown>;
  };
  layout: {
    defaultContentMaxWidth: number | null;
    defaultHorizontalPadding: number;
    tabBar: {
      minHeight: number;
      contentClearance: number;
      paddingTop: number;
      paddingBottom: number;
      iconSize: number;
      labelFontSize: number;
      labelLineHeight: number;
      labelMaxWidth: number;
      horizontalPadding: number;
      itemPaddingVertical: number;
      itemPaddingHorizontal: number;
    };
  };
  permissions: {
    notificationPermissionStatus: string;
    clipboardAvailable: boolean;
    saveLogAvailable: boolean;
  };
  config: {
    stubMode: boolean;
    firebase: {
      hasApiKey: boolean;
      hasAuthDomain: boolean;
      hasProjectId: boolean;
      hasStorageBucket: boolean;
      hasMessagingSenderId: boolean;
      hasAppId: boolean;
      hasMeasurementId: boolean;
    };
    collegeScorecard: {
      configured: boolean;
      baseUrl: string;
    };
    functions: {
      region: string;
      aiGatewayFunctionName: string;
      aiTimeoutMs: number;
      opportunityGatewayFunctionName: string;
      opportunityTimeoutMs: number;
    };
    oauth: {
      hasGoogleWebClientId: boolean;
      hasMicrosoftClientId: boolean;
      hasExpoUsername: boolean;
    };
    logging: {
      hasErrorWebhookUrl: boolean;
      maxQueuedErrorLogs: number;
    };
  };
  storage: {
    asyncStorageKeyCount: number;
    asyncStorageKeys: string[];
    autoClearEnabled: boolean | null;
    devLogDirectory: string;
  };
  account: {
    isHydrated: boolean;
    hasUser: boolean;
    userSummary: {
      uid: string | null;
      email: string | null;
      name: string | null;
      isGuest: boolean;
      hasAvatar: boolean;
      hasMajor: boolean;
      hasState: boolean;
      hasGpa: boolean;
      hasResume: boolean;
      hasTranscript: boolean;
      hasSeenOnboarding: boolean | null;
      savedCollegeCount: number;
      questionnaireFieldCount: number;
      notificationsEnabled: boolean;
    };
    rawState: unknown;
  };
  transcript: {
    userTranscriptUrlKind: string | null;
    userTranscriptUrlLength: number | null;
    storedTranscriptSource: string | null;
    storedTranscriptUploadedAt: string | null;
    completedCourseCount: number;
    completedCoursePreview: string[];
    lastPlannerDebug: unknown;
  };
  opportunities: {
    isHydrated: boolean;
    isRefreshing: boolean;
    catalogCount: number;
    matchedCount: number;
    statusCount: number;
    completedCount: number;
    pendingCount: number;
    byProgress: Record<string, number>;
    rawCatalog: unknown;
    rawMatched: unknown;
    rawStatusById: unknown;
  };
  ai: {
    lastRecommendationDebug: unknown;
  };
};

const PRIMARY_TAB_LABELS = [
  { path: "/", label: "Home", primaryTab: "home" },
  { path: "/resources", label: "Resources", primaryTab: "resources" },
  { path: "/profile", label: "Profile", primaryTab: "profile" },
  { path: "/settings", label: "Settings", primaryTab: "settings" },
  { path: "/questionnaire", label: "Questionnaire", primaryTab: "home" },
  { path: "/calendar", label: "Deadline Calendar", primaryTab: "resources" },
  { path: "/resources/transfer-planner", label: "Transfer Planner", primaryTab: "resources" },
  { path: "/compare", label: "Compare Colleges", primaryTab: "resources" },
  { path: "/cost-calculator", label: "Cost Calculator", primaryTab: "resources" },
  { path: "/saved-colleges", label: "Saved Colleges", primaryTab: "resources" },
  { path: "/college-search", label: "College Search", primaryTab: "resources" },
  { path: "/opportunity-admin", label: "Opportunity Admin", primaryTab: "resources" },
  { path: "/language", label: "Language", primaryTab: "settings" },
  { path: "/about", label: "About", primaryTab: "settings" },
  { path: "/privacy", label: "Privacy", primaryTab: "settings" },
  { path: "/terms", label: "Terms", primaryTab: "settings" },
  { path: "/login", label: "Login", primaryTab: "none" },
  { path: "/profile-setup", label: "Profile Setup", primaryTab: "none" },
  { path: "/onboarding", label: "Onboarding", primaryTab: "none" },
  { path: "/forgot-password", label: "Forgot Password", primaryTab: "none" },
] as const;

const VISIBLE_PRIMARY_TABS = ["index", "resources/index", "profile", "settings"] as const;
const HIDDEN_CHILD_ROUTES = [
  "calendar",
  "resources/transfer-planner",
  "transfer-planner",
  "college-search",
  "opportunity-admin",
  "questionnaire",
  "compare",
  "cost-calculator",
  "saved-colleges",
  "language",
  "about",
  "privacy",
  "terms",
  "college/[collegeId]",
];

const ICON_FONT_FAMILIES = [
  "Ionicons",
  "MaterialIcons",
  "Material Icons",
  "FontAwesome",
  "FontAwesome5Free-Regular",
  "FontAwesome5Free-Solid",
  "FontAwesome5Brands-Regular",
] as const;

const MAX_WEB_RESOURCE_ENTRIES = 20;
const MAX_WEB_RESOURCE_ERRORS = 20;

type RecentWebLoadError = {
  timestamp: string;
  tagName: string | null;
  url: string | null;
  rel: string | null;
  as: string | null;
};

const recentWebLoadErrors: RecentWebLoadError[] = [];

function isRTL(language: string) {
  return language === "Arabic" || language === "Persian";
}

function getTranscriptUrlKind(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:")) return "data-url";
  if (raw.startsWith("blob:")) return "blob-url";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return "remote-url";
  if (raw.startsWith("file://")) return "file-url";
  if (/^[A-Za-z]:[\\/]/.test(raw)) return "windows-local-path";
  if (raw.startsWith("/")) return "local-path";
  return "other";
}

function getCompletedCoursePreview(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeRouteValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRouteValue(item));
  }

  if (isObjectRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, innerValue]) => [key, sanitizeRouteValue(innerValue)])
    );
  }

  if (typeof value !== "string") {
    return value;
  }

  return value;
}

function isSensitiveKey(key: string) {
  return /token|secret|password|api[-_]?key|oobcode|verification|code/i.test(key);
}

function sanitizeQueryObject(input: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      isSensitiveKey(key) ? "[redacted]" : value,
    ])
  );
}

function sanitizeSearchParams(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      isSensitiveKey(key) ? "[redacted]" : sanitizeRouteValue(value),
    ])
  );
}

function sanitizeHref(rawHref: string | null) {
  if (!rawHref) return null;

  try {
    const parsed = new URL(rawHref);
    for (const key of parsed.searchParams.keys()) {
      if (isSensitiveKey(key)) {
        parsed.searchParams.set(key, "[redacted]");
      }
    }
    return parsed.toString();
  } catch {
    return rawHref;
  }
}

function pushRecentWebLoadError(entry: RecentWebLoadError) {
  recentWebLoadErrors.push(entry);
  if (recentWebLoadErrors.length > MAX_WEB_RESOURCE_ERRORS) {
    recentWebLoadErrors.splice(0, recentWebLoadErrors.length - MAX_WEB_RESOURCE_ERRORS);
  }
}

function roundMetric(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function getWebIconFontDiagnostics() {
  if (typeof document === "undefined") {
    return {
      status: null,
      totalFontFaces: null,
      checks: ICON_FONT_FAMILIES.map((family) => ({ family, available: null })),
      matchingFaces: [] as Array<{
        family: string | null;
        status: string | null;
        style: string | null;
        weight: string | null;
      }>,
    };
  }

  const fontSet = (document as Document & { fonts?: any }).fonts;
  const checks = ICON_FONT_FAMILIES.map((family) => {
    if (!fontSet || typeof fontSet.check !== "function") {
      return { family, available: null };
    }

    const available =
      fontSet.check(`16px "${family}"`) || fontSet.check(`16px ${family}`);

    return { family, available };
  });

  const matchingFaces =
    fontSet && typeof fontSet[Symbol.iterator] === "function"
      ? Array.from(fontSet)
          .map((face: any) => ({
            family:
              typeof face?.family === "string"
                ? face.family.replace(/^["']|["']$/g, "")
                : null,
            status: typeof face?.status === "string" ? face.status : null,
            style: typeof face?.style === "string" ? face.style : null,
            weight:
              typeof face?.weight === "string" || typeof face?.weight === "number"
                ? String(face.weight)
                : null,
          }))
          .filter((face) =>
            ICON_FONT_FAMILIES.some((family) =>
              String(face.family || "").toLowerCase().includes(family.toLowerCase())
            )
          )
          .slice(0, MAX_WEB_RESOURCE_ENTRIES)
      : [];

  return {
    status: fontSet && typeof fontSet.status === "string" ? fontSet.status : null,
    totalFontFaces:
      fontSet && typeof fontSet.size === "number" && Number.isFinite(fontSet.size)
        ? fontSet.size
        : null,
    checks,
    matchingFaces,
  };
}

function getWebResourceDiagnostics() {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
    return {
      relevantEntryCount: 0,
      relevantEntries: [] as Array<{
        name: string | null;
        initiatorType: string | null;
        durationMs: number | null;
        transferSize: number | null;
        encodedBodySize: number | null;
        decodedBodySize: number | null;
        startTimeMs: number | null;
        responseEndMs: number | null;
      }>,
      recentLoadErrors: [...recentWebLoadErrors],
    };
  }

  const resourceEntries = performance
    .getEntriesByType("resource")
    .filter((entry) =>
      /entry\.bundle|expo-router|react-native-vector-icons|\/Fonts\/|\.ttf(\?|$)|\.otf(\?|$)|\.woff2?(\?|$)|\.(png|jpe?g|webp|svg)(\?|$)/i.test(
        String((entry as PerformanceResourceTiming).name || "")
      )
    )
    .slice(-MAX_WEB_RESOURCE_ENTRIES)
    .map((entry) => {
      const resource = entry as PerformanceResourceTiming;
      return {
        name: sanitizeHref(String(resource.name || "")) || null,
        initiatorType: resource.initiatorType || null,
        durationMs: roundMetric(resource.duration),
        transferSize:
          typeof resource.transferSize === "number" ? resource.transferSize : null,
        encodedBodySize:
          typeof resource.encodedBodySize === "number"
            ? resource.encodedBodySize
            : null,
        decodedBodySize:
          typeof resource.decodedBodySize === "number"
            ? resource.decodedBodySize
            : null,
        startTimeMs: roundMetric(resource.startTime),
        responseEndMs: roundMetric(resource.responseEnd),
      };
    });

  return {
    relevantEntryCount: resourceEntries.length,
    relevantEntries: resourceEntries,
    recentLoadErrors: [...recentWebLoadErrors],
  };
}

function getWebNavigationTiming() {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
    return null;
  }

  const entry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (!entry) return null;

  return {
    type: entry.type || null,
    domContentLoadedMs: roundMetric(entry.domContentLoadedEventEnd),
    loadEventMs: roundMetric(entry.loadEventEnd),
    responseEndMs: roundMetric(entry.responseEnd),
  };
}

function getPageLabel(pathname: string) {
  if (/^\/college\/.+/.test(pathname)) {
    return { label: "College Detail", primaryTab: "resources" };
  }

  const direct = PRIMARY_TAB_LABELS.find((entry) => entry.path === pathname);
  if (direct) {
    return { label: direct.label, primaryTab: direct.primaryTab };
  }

  return { label: pathname || "Unknown", primaryTab: "none" };
}

export function UniversalDevMode() {
  const pathname = usePathname();
  const segments = useSegments();
  const rawParams = useGlobalSearchParams();
  const params = useMemo(() => sanitizeSearchParams(rawParams ?? {}), [rawParams]);
  const insets = useSafeAreaInsets();
  const { theme, resolvedTheme, isDark, isGreen, isLight, hydrated: themeHydrated } = useAppTheme();
  const { language, hydrated: languageHydrated } = useAppLanguage();
  const { isHydrated: isAppHydrated, state } = useAppData();
  const {
    isHydrated: areOpportunitiesHydrated,
    isRefreshing: areOpportunitiesRefreshing,
    opportunities,
    matchedOpportunities,
    statusById,
  } = useOpportunities();
  const {
    width,
    height,
    fontScale,
    breakpoint,
    isPhoneLikeViewport,
    topInset,
    bottomInset,
    defaultContentMaxWidth,
    defaultHorizontalPadding,
    tabBarPaddingTop,
    tabBarPaddingBottom,
    tabBarIconSize,
    tabBarLabelFontSize,
    tabBarLabelLineHeight,
    tabBarLabelMaxWidth,
    tabBarHorizontalPadding,
    tabBarItemPaddingVertical,
    tabBarItemPaddingHorizontal,
    tabBarMinHeight,
    tabBarContentClearance,
  } = useResponsiveLayout();

  const [visible, setVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<DevSnapshot | null>(null);
  const [copyStatus, setCopyStatus] = useState<"" | "copied" | "failed">("");
  const [savedLogStatus, setSavedLogStatus] = useState<SavedLogStatus>(null);

  const routeInfo = useMemo(() => getPageLabel(pathname), [pathname]);

  const buildSnapshot = useCallback(async (): Promise<DevSnapshot> => {
    const now = new Date();
    const englishTranslationKeys = Object.keys(translations.English).sort((left, right) =>
      left.localeCompare(right)
    );
    const asyncStorageKeys = await AsyncStorage.getAllKeys().catch(() => []);
    const autoClearEnabled = await cacheManagerService.getAutoClearEnabled().catch(() => null);
    const notificationPermissionStatus = await notificationsService
      .getPermissionStatus()
      .catch(() => "unknown");

    const progressCounts = Object.values(statusById ?? {}).reduce<Record<string, number>>(
      (counts, status) => {
        const key = String(status?.progress ?? "saved");
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      },
      {}
    );

    const notes = [
      "Sensitive route/query values are redacted for safer sharing.",
      "This snapshot is app-shell scoped, so route-local component state is not guaranteed unless it already lives in shared services.",
    ];

    if (Platform.OS === "web") {
      notes.push("Use ~ or ` to toggle this overlay on web.");
    }

    const href =
      Platform.OS === "web" && typeof window !== "undefined"
        ? sanitizeHref(window.location.href)
        : null;

    const webQuery =
      Platform.OS === "web" && typeof window !== "undefined"
        ? sanitizeQueryObject(
            Object.fromEntries(new URLSearchParams(window.location.search).entries())
          )
        : {};

    const activeElement =
      Platform.OS === "web" &&
      typeof document !== "undefined" &&
      document.activeElement
        ? {
            tagName: document.activeElement.tagName ?? null,
            id: (document.activeElement as HTMLElement).id ?? null,
            className:
              typeof (document.activeElement as HTMLElement).className === "string"
                ? (document.activeElement as HTMLElement).className
                : null,
          }
        : null;

    const webIconFontDiagnostics =
      Platform.OS === "web" ? getWebIconFontDiagnostics() : null;
    const webResourceDiagnostics =
      Platform.OS === "web" ? getWebResourceDiagnostics() : null;
    const webNavigationTiming =
      Platform.OS === "web" ? getWebNavigationTiming() : null;

    return {
      meta: {
        generatedAt: now.toISOString(),
        appVersion: APP_VERSION,
        isDev: __DEV__,
        currentPage: {
          pathname,
          pageLabel: routeInfo.label,
          primaryTab: routeInfo.primaryTab,
          segments: [...segments],
          params,
          href,
        },
        notes,
      },
      runtime: {
        platform: Platform.OS,
        width,
        height,
        fontScale,
        breakpoint,
        isPhoneLikeViewport,
        topInset,
        bottomInset,
        currentTime: now.toString(),
        web:
          Platform.OS === "web"
            ? {
                href,
                origin: typeof window !== "undefined" ? window.location.origin : null,
                path: typeof window !== "undefined" ? window.location.pathname : null,
                query: webQuery,
                userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
                innerWidth: typeof window !== "undefined" ? window.innerWidth : null,
                innerHeight: typeof window !== "undefined" ? window.innerHeight : null,
                outerWidth: typeof window !== "undefined" ? window.outerWidth : null,
                outerHeight: typeof window !== "undefined" ? window.outerHeight : null,
                scrollX: typeof window !== "undefined" ? window.scrollX : null,
                scrollY: typeof window !== "undefined" ? window.scrollY : null,
                devicePixelRatio:
                  typeof window !== "undefined" ? window.devicePixelRatio : null,
                online: typeof navigator !== "undefined" ? navigator.onLine : null,
                readyState:
                  typeof document !== "undefined" ? document.readyState ?? null : null,
                visibilityState:
                  typeof document !== "undefined"
                    ? document.visibilityState ?? null
                    : null,
                documentDir:
                  typeof document !== "undefined"
                    ? document.documentElement.getAttribute("dir")
                    : null,
                activeElement,
                iconFonts:
                  webIconFontDiagnostics ?? {
                    status: null,
                    totalFontFaces: null,
                    checks: [],
                    matchingFaces: [],
                  },
                resourceDiagnostics:
                  webResourceDiagnostics ?? {
                    relevantEntryCount: 0,
                    relevantEntries: [],
                    recentLoadErrors: [],
                  },
                navigationTiming: webNavigationTiming,
              }
            : null,
      },
      theme: {
        selectedTheme: theme,
        resolvedTheme,
        isDark,
        isGreen,
        isLight,
        hydrated: themeHydrated,
      },
      language: {
        selectedLanguage: language,
        hydrated: languageHydrated,
        isRTL: isRTL(language),
        englishTranslationKeyCount: englishTranslationKeys.length,
        englishTranslationKeys,
      },
      navigation: {
        visiblePrimaryTabs: [...VISIBLE_PRIMARY_TABS],
        hiddenChildRoutes: [...HIDDEN_CHILD_ROUTES],
        segments: [...segments],
        params,
      },
      layout: {
        defaultContentMaxWidth,
        defaultHorizontalPadding,
        tabBar: {
          minHeight: tabBarMinHeight,
          contentClearance: tabBarContentClearance,
          paddingTop: tabBarPaddingTop,
          paddingBottom: tabBarPaddingBottom,
          iconSize: tabBarIconSize,
          labelFontSize: tabBarLabelFontSize,
          labelLineHeight: tabBarLabelLineHeight,
          labelMaxWidth: tabBarLabelMaxWidth,
          horizontalPadding: tabBarHorizontalPadding,
          itemPaddingVertical: tabBarItemPaddingVertical,
          itemPaddingHorizontal: tabBarItemPaddingHorizontal,
        },
      },
      permissions: {
        notificationPermissionStatus,
        clipboardAvailable:
          Platform.OS === "web"
            ? typeof navigator !== "undefined" && !!navigator.clipboard?.writeText
            : true,
        saveLogAvailable: true,
      },
      config: {
        stubMode: isStubMode(),
        firebase: {
          hasApiKey: !!API_CONFIG.firebase.apiKey,
          hasAuthDomain: !!API_CONFIG.firebase.authDomain,
          hasProjectId: !!API_CONFIG.firebase.projectId,
          hasStorageBucket: !!API_CONFIG.firebase.storageBucket,
          hasMessagingSenderId: !!API_CONFIG.firebase.messagingSenderId,
          hasAppId: !!API_CONFIG.firebase.appId,
          hasMeasurementId: !!API_CONFIG.firebase.measurementId,
        },
        collegeScorecard: {
          configured: hasCollegeScorecardApiKey(),
          baseUrl: API_CONFIG.collegeScorecard.baseUrl,
        },
        functions: {
          region: API_CONFIG.functions.region,
          aiGatewayFunctionName: API_CONFIG.ai.gatewayFunctionName,
          aiTimeoutMs: API_CONFIG.ai.timeoutMs,
          opportunityGatewayFunctionName: API_CONFIG.opportunities.gatewayFunctionName,
          opportunityTimeoutMs: API_CONFIG.opportunities.timeoutMs,
        },
        oauth: {
          hasGoogleWebClientId: !!API_CONFIG.googleWebClientId,
          hasMicrosoftClientId: !!API_CONFIG.microsoftClientId,
          hasExpoUsername: !!API_CONFIG.expoUsername,
        },
        logging: {
          hasErrorWebhookUrl: !!API_CONFIG.logging.errorWebhookUrl,
          maxQueuedErrorLogs: API_CONFIG.logging.maxQueuedErrorLogs,
        },
      },
      storage: {
        asyncStorageKeyCount: asyncStorageKeys.length,
        asyncStorageKeys: [...asyncStorageKeys].sort((left, right) => left.localeCompare(right)),
        autoClearEnabled,
        devLogDirectory: devConsoleLogService.logDirectory,
      },
      account: {
        isHydrated: isAppHydrated,
        hasUser: !!state.user,
        userSummary: {
          uid: state.user?.uid ?? null,
          email: state.user?.email ?? null,
          name: state.user?.name ?? null,
          isGuest: !!state.user?.isGuest,
          hasAvatar: !!state.user?.avatar,
          hasMajor: !!state.user?.major,
          hasState: !!state.user?.state,
          hasGpa: !!state.user?.gpa,
          hasResume: !!state.user?.resume,
          hasTranscript: !!state.user?.transcript,
          hasSeenOnboarding:
            typeof state.user?.hasSeenOnboarding === "boolean"
              ? state.user.hasSeenOnboarding
              : null,
          savedCollegeCount: state.savedColleges?.length ?? 0,
          questionnaireFieldCount: Object.keys(state.questionnaireAnswers ?? {}).length,
          notificationsEnabled: !!state.notificationsEnabled,
        },
        rawState: state,
      },
      transcript: {
        userTranscriptUrlKind: getTranscriptUrlKind(state.user?.transcript ?? null),
        userTranscriptUrlLength: state.user?.transcript ? state.user.transcript.length : null,
        storedTranscriptSource:
          String(state.questionnaireAnswers?.transferPlannerTranscriptSource ?? "").trim() ||
          null,
        storedTranscriptUploadedAt:
          String(state.questionnaireAnswers?.transferPlannerTranscriptUploadedAt ?? "").trim() ||
          null,
        completedCourseCount: Array.isArray(state.questionnaireAnswers?.completedCourses)
          ? state.questionnaireAnswers.completedCourses.length
          : 0,
        completedCoursePreview: getCompletedCoursePreview(
          state.questionnaireAnswers?.completedCourses
        ),
        lastPlannerDebug: transcriptPlannerDebugService.getLastTranscriptPlannerDebug(),
      },
      opportunities: {
        isHydrated: areOpportunitiesHydrated,
        isRefreshing: areOpportunitiesRefreshing,
        catalogCount: opportunities.length,
        matchedCount: matchedOpportunities.length,
        statusCount: Object.keys(statusById ?? {}).length,
        completedCount: matchedOpportunities.filter((opportunity) => opportunity.isDone).length,
        pendingCount: matchedOpportunities.filter((opportunity) => !opportunity.isDone).length,
        byProgress: progressCounts,
        rawCatalog: opportunities,
        rawMatched: matchedOpportunities,
        rawStatusById: statusById,
      },
      ai: {
        lastRecommendationDebug: aiService.getLastRecommendDebug(),
      },
    };
  }, [
    areOpportunitiesHydrated,
    areOpportunitiesRefreshing,
    bottomInset,
    breakpoint,
    defaultContentMaxWidth,
    defaultHorizontalPadding,
    fontScale,
    height,
    isAppHydrated,
    isDark,
    isGreen,
    isLight,
    isPhoneLikeViewport,
    language,
    languageHydrated,
    matchedOpportunities,
    opportunities,
    params,
    pathname,
    resolvedTheme,
    routeInfo.label,
    routeInfo.primaryTab,
    segments,
    state,
    statusById,
    tabBarContentClearance,
    tabBarHorizontalPadding,
    tabBarIconSize,
    tabBarItemPaddingHorizontal,
    tabBarItemPaddingVertical,
    tabBarLabelFontSize,
    tabBarLabelLineHeight,
    tabBarLabelMaxWidth,
    tabBarMinHeight,
    tabBarPaddingBottom,
    tabBarPaddingTop,
    theme,
    themeHydrated,
    topInset,
    width,
  ]);

  const refreshSnapshot = useCallback(async () => {
    setIsRefreshing(true);
    setCopyStatus("");
    setSavedLogStatus(null);
    try {
      const nextSnapshot = await buildSnapshot();
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    } finally {
      setIsRefreshing(false);
    }
  }, [buildSnapshot]);

  const copyLog = useCallback(async () => {
    try {
      const nextSnapshot = await refreshSnapshot();
      await Clipboard.setStringAsync(JSON.stringify(nextSnapshot, null, 2));
      setCopyStatus("copied");
    } catch (error) {
      setCopyStatus("failed");
      Alert.alert(
        "Copy failed",
        error instanceof Error ? error.message : "Could not copy the dev log."
      );
    }
  }, [refreshSnapshot]);

  const saveLog = useCallback(async () => {
    try {
      const nextSnapshot = await refreshSnapshot();
      const savedLog = await devConsoleLogService.saveSnapshot(nextSnapshot);
      const message =
        savedLog.delivery === "filesystem"
          ? `Saved log to ${savedLog.relativePath}`
          : `Downloaded ${savedLog.fileName}.`;
      setSavedLogStatus({
        kind: "saved",
        message,
        relativePath: savedLog.relativePath,
        fileUri: savedLog.fileUri,
      });
    } catch (error) {
      setSavedLogStatus({
        kind: "failed",
        message: error instanceof Error ? error.message : "Could not save the dev log.",
      });
    }
  }, [refreshSnapshot]);

  useEffect(() => {
    if (!__DEV__) return;
    if (!visible) return;
    void refreshSnapshot();
  }, [refreshSnapshot, visible]);

  useEffect(() => {
    if (!__DEV__ || Platform.OS !== "web" || typeof window === "undefined") return;

    const onResourceError = (event: Event) => {
      const target = event.target as
        | (EventTarget & {
            tagName?: string;
            src?: string;
            href?: string;
            rel?: string;
            as?: string;
            currentSrc?: string;
          })
        | null;

      if (!target || target === window) return;

      const url =
        sanitizeHref(
          typeof target.currentSrc === "string" && target.currentSrc
            ? target.currentSrc
            : typeof target.src === "string" && target.src
              ? target.src
              : typeof target.href === "string" && target.href
                ? target.href
                : null
        ) ?? null;

      if (!url) return;

      pushRecentWebLoadError({
        timestamp: new Date().toISOString(),
        tagName: typeof target.tagName === "string" ? target.tagName : null,
        url,
        rel: typeof target.rel === "string" ? target.rel : null,
        as: typeof target.as === "string" ? target.as : null,
      });
    };

    window.addEventListener("error", onResourceError, true);
    return () => window.removeEventListener("error", onResourceError, true);
  }, []);

  useEffect(() => {
    if (!__DEV__ || Platform.OS !== "web") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.key === "~" || event.key === "`" || event.code === "Backquote") {
        event.preventDefault();
        setVisible((current) => !current);
        return;
      }

      if (event.key === "Escape") {
        setVisible(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!__DEV__) {
    return null;
  }

  const panelBackground = isDark
    ? "#111827"
    : isGreen
      ? "#022c1a"
      : "#ffffff";
  const panelBorder = isDark ? "#1f2937" : isGreen ? "#14532d" : "#a7f3d0";
  const textColor = isDark || isGreen ? "#ffffff" : "#064e3b";
  const secondaryTextColor = isDark ? "#9ca3af" : isGreen ? "#b6e2b6" : "#047857";
  const actionTextColor = isDark || isGreen ? "#ffffff" : "#064e3b";
  const overlayMaxWidth = width >= 920 ? 860 : Math.max(300, width - 24);
  const overlayMaxHeight = Math.max(260, Math.min(height - insets.top - insets.bottom - 48, 620));

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}>
          <Pressable
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            onPress={() => setVisible(false)}
          />

          <View
            style={{
              width: "100%",
              paddingTop: Math.max(insets.top + 12, 12),
              paddingHorizontal: 12,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: overlayMaxWidth,
                maxHeight: overlayMaxHeight,
                backgroundColor: panelBackground,
                borderColor: panelBorder,
                borderWidth: 1,
                borderRadius: 22,
                padding: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textColor, fontSize: 18, fontWeight: "700" }}>
                    Dev Mode. Good luck.
                  </Text>
                  <Text style={{ color: secondaryTextColor, fontSize: 13, marginTop: 4 }}>
                    {routeInfo.label} • {pathname}
                  </Text>
                </View>
                <Pressable onPress={() => setVisible(false)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={22} color={secondaryTextColor} />
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 12 }}>
                {[
                  `Page: ${routeInfo.label}`,
                  `Tab: ${routeInfo.primaryTab}`,
                  `Breakpoint: ${breakpoint}`,
                  `Theme: ${resolvedTheme}`,
                  `Lang: ${language}`,
                  `User: ${state.user?.isGuest ? "Guest" : state.user?.email ?? "Signed out"}`,
                ].map((pill) => (
                  <View
                    key={pill}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: isDark || isGreen ? "rgba(16,185,129,0.12)" : "#ecfdf5",
                      borderWidth: 1,
                      borderColor: isDark || isGreen ? "rgba(16,185,129,0.25)" : "#a7f3d0",
                    }}
                  >
                    <Text style={{ color: secondaryTextColor, fontSize: 12, fontWeight: "600" }}>
                      {pill}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <Pressable
                  onPress={() => void copyLog()}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#10b981",
                  }}
                >
                  <Text style={{ color: actionTextColor, fontWeight: "700" }}>Copy Log</Text>
                </Pressable>
                <Pressable
                  onPress={() => void saveLog()}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: isDark || isGreen ? "#1f2937" : "#ecfdf5",
                    borderWidth: 1,
                    borderColor: panelBorder,
                  }}
                >
                  <Text style={{ color: textColor, fontWeight: "700" }}>Save Log</Text>
                </Pressable>
                <Pressable
                  onPress={() => void refreshSnapshot()}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: isDark || isGreen ? "#1f2937" : "#ecfdf5",
                    borderWidth: 1,
                    borderColor: panelBorder,
                  }}
                >
                  <Text style={{ color: textColor, fontWeight: "700" }}>
                    {isRefreshing ? "Refreshing..." : "Refresh"}
                  </Text>
                </Pressable>
              </View>

              {copyStatus ? (
                <Text style={{ color: copyStatus === "copied" ? "#10b981" : "#ef4444", fontSize: 12, marginBottom: 8 }}>
                  {copyStatus === "copied"
                    ? "Full dev log copied to clipboard."
                    : "Could not copy the dev log."}
                </Text>
              ) : null}

              {savedLogStatus ? (
                <View style={{ marginBottom: 8 }}>
                  <Text
                    style={{
                      color: savedLogStatus.kind === "saved" ? "#10b981" : "#ef4444",
                      fontSize: 12,
                    }}
                  >
                    {savedLogStatus.message}
                  </Text>
                  {"relativePath" in savedLogStatus ? (
                    <Text selectable style={{ color: secondaryTextColor, fontSize: 11, marginTop: 4 }}>
                      {savedLogStatus.relativePath}
                      {"\n"}
                      {savedLogStatus.fileUri}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <ScrollView
                nestedScrollEnabled
                style={{
                  maxHeight: overlayMaxHeight - 210,
                  borderWidth: 1,
                  borderColor: panelBorder,
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: isDark ? "#030712" : isGreen ? "#011a10" : "#f8fffb",
                }}
              >
                <Text
                  selectable={Platform.OS === "web"}
                  style={{
                    color: textColor,
                    fontSize: 11,
                    lineHeight: 17,
                    fontFamily:
                      Platform.OS === "ios"
                        ? "Menlo"
                        : Platform.OS === "android"
                          ? "monospace"
                          : "Consolas",
                  }}
                >
                  {snapshot
                    ? JSON.stringify(snapshot, null, 2)
                    : "Press Refresh or Copy Log to build the latest universal dev snapshot."}
                </Text>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
