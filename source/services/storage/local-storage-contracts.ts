import {
  LOCAL_DOCUMENTS_DIR_NAME,
  PROFILE_DOCUMENT_TYPES,
  STORAGE_KEYS,
  buildLocalDocumentSubdirectory,
} from "@/constants/schema";

export const LOCAL_STORAGE_KEYS = {
  appTheme: "app-theme",
  appLanguage: "app-language",
  opportunitiesCatalog: STORAGE_KEYS.opportunitiesCatalog,
  aiGatewayClientId: "ai:gateway:clientId:v1",
  aiLastResponse: "ai:lastResponse",
  aiLastResponseMap: "ai:lastResponseMap",
  aiLastAssistantResponse: "ai:lastAssistantResponse",
  aiLastAssistantResponseMap: "ai:lastAssistantResponseMap",
  aiLastRoadmap: "ai:lastRoadmap",
  aiFactorCache: "ai:recommend:factorCache:v1",
  cacheAutoClearEnabled: "settings:cache:autoClear30d",
  cacheLastClearedAt: "settings:cache:lastClearedAt",
  collegeCacheCleanupVersion: "college:cache:cleanup:version",
} as const;

export const LOCAL_STORAGE_CACHE_POLICY = {
  autoClearWindowMs: 1000 * 60 * 60 * 24 * 5,
  collegeCacheTtlMs: 1000 * 60 * 60 * 24,
  collegeCacheVersion: "v5",
  zipGeocodeCacheTtlMs: 1000 * 60 * 60 * 24 * 3,
} as const;

export const COLLEGE_CACHE_PREFIX = "college:" as const;
export const ZIP_GEOCODE_CACHE_PREFIX = "zip:geocode:" as const;

export type LocalStorageContractId =
  | "app-data"
  | "app-theme"
  | "app-language"
  | "startup-seen"
  | "pending-account-data"
  | "pending-delete-account"
  | "guest-profile-show"
  | "guest-roadmap-show"
  | "onboarding-debug-log"
  | "managed-notifications"
  | "error-log-queue"
  | "opportunities-catalog"
  | "opportunities-guest-statuses"
  | "opportunities-guest-pending"
  | "saved-colleges-pending"
  | "opportunity-statuses"
  | "opportunity-pending"
  | "profile-document"
  | "roadmap-document"
  | "college-cache"
  | "college-cache-marker"
  | "zip-geocode-cache"
  | "ai-response-cache"
  | "ai-gateway-client"
  | "cache-setting";

export type LocalStorageContractCategory =
  | "cache"
  | "debug"
  | "document"
  | "error-log"
  | "notification"
  | "pending-sync"
  | "preference"
  | "profile-state"
  | "session"
  | "startup"
  | "user-state";

export type LocalStorageExportPolicy =
  | "app-data-payload"
  | "current-opportunity-user"
  | "current-user"
  | "guest-only"
  | "none"
  | "preference-payload";

export type LocalStorageValueKind = "boolean-string" | "json" | "string";

type LocalStorageContractBase = {
  category: LocalStorageContractCategory;
  clearWithCache: boolean;
  debugDescription: string;
  exportPolicy: LocalStorageExportPolicy;
  id: LocalStorageContractId;
  ttlMs?: number;
  valueKind: LocalStorageValueKind;
};

export type ExactLocalStorageContract = LocalStorageContractBase & {
  key: string;
  match: "exact";
};

export type PrefixLocalStorageContract = LocalStorageContractBase & {
  match: "prefix";
  prefix: string;
};

export type LocalStorageContract =
  | ExactLocalStorageContract
  | PrefixLocalStorageContract;

export type LocalDocumentStorageKind =
  | (typeof PROFILE_DOCUMENT_TYPES)[keyof typeof PROFILE_DOCUMENT_TYPES]
  | "roadmap";

export type LocalDocumentStorageKeyInfo = {
  docType?: string;
  kind: LocalDocumentStorageKind;
  key: string;
  userId: string;
};

export type LocalStorageOwnerContext = {
  isGuest: boolean;
  opportunityUserKey: string | null;
  userId: string | null;
};

export const GUEST_OPPORTUNITY_USER_KEY = "guest" as const;

export const LOCAL_STORAGE_CONTRACTS = [
  {
    category: "user-state",
    clearWithCache: false,
    debugDescription: "Versioned app data envelope; exported as the top-level data payload.",
    exportPolicy: "app-data-payload",
    id: "app-data",
    key: STORAGE_KEYS.appData,
    match: "exact",
    valueKind: "json",
  },
  {
    category: "preference",
    clearWithCache: false,
    debugDescription: "App theme preference; exported through the export preferences envelope.",
    exportPolicy: "preference-payload",
    id: "app-theme",
    key: LOCAL_STORAGE_KEYS.appTheme,
    match: "exact",
    valueKind: "string",
  },
  {
    category: "preference",
    clearWithCache: false,
    debugDescription: "App language preference; exported through the export preferences envelope.",
    exportPolicy: "preference-payload",
    id: "app-language",
    key: LOCAL_STORAGE_KEYS.appLanguage,
    match: "exact",
    valueKind: "string",
  },
  {
    category: "startup",
    clearWithCache: false,
    debugDescription: "Startup animation has-run flag.",
    exportPolicy: "none",
    id: "startup-seen",
    key: STORAGE_KEYS.hasSeenStartup,
    match: "exact",
    valueKind: "boolean-string",
  },
  {
    category: "session",
    clearWithCache: false,
    debugDescription: "Temporary data used while turning a guest account into a real account.",
    exportPolicy: "none",
    id: "pending-account-data",
    key: STORAGE_KEYS.pendingAccountData,
    match: "exact",
    valueKind: "json",
  },
  {
    category: "session",
    clearWithCache: false,
    debugDescription: "Temporary delete-account confirmation state.",
    exportPolicy: "none",
    id: "pending-delete-account",
    key: STORAGE_KEYS.pendingDeleteAccount,
    match: "exact",
    valueKind: "string",
  },
  {
    category: "profile-state",
    clearWithCache: false,
    debugDescription: "Guest profile disclosure state.",
    exportPolicy: "guest-only",
    id: "guest-profile-show",
    key: STORAGE_KEYS.guestProfileShow,
    match: "exact",
    valueKind: "boolean-string",
  },
  {
    category: "profile-state",
    clearWithCache: false,
    debugDescription: "Guest roadmap disclosure state.",
    exportPolicy: "guest-only",
    id: "guest-roadmap-show",
    key: STORAGE_KEYS.guestRoadmapShow,
    match: "exact",
    valueKind: "boolean-string",
  },
  {
    category: "debug",
    clearWithCache: false,
    debugDescription: "Onboarding debug log.",
    exportPolicy: "none",
    id: "onboarding-debug-log",
    key: STORAGE_KEYS.onboardingDebugLog,
    match: "exact",
    valueKind: "json",
  },
  {
    category: "notification",
    clearWithCache: false,
    debugDescription: "Managed notification identifiers.",
    exportPolicy: "none",
    id: "managed-notifications",
    key: STORAGE_KEYS.notificationsManaged,
    match: "exact",
    valueKind: "json",
  },
  {
    category: "error-log",
    clearWithCache: false,
    debugDescription: "Queued handled-error logs waiting for upload.",
    exportPolicy: "none",
    id: "error-log-queue",
    key: STORAGE_KEYS.errorLogQueue,
    match: "exact",
    valueKind: "json",
  },
  {
    category: "cache",
    clearWithCache: true,
    debugDescription: "Opportunity catalog cache.",
    exportPolicy: "none",
    id: "opportunities-catalog",
    key: LOCAL_STORAGE_KEYS.opportunitiesCatalog,
    match: "exact",
    valueKind: "json",
  },
  {
    category: "profile-state",
    clearWithCache: true,
    debugDescription: "Guest opportunity progress statuses.",
    exportPolicy: "guest-only",
    id: "opportunities-guest-statuses",
    key: STORAGE_KEYS.opportunitiesGuestStatuses,
    match: "exact",
    valueKind: "json",
  },
  {
    category: "pending-sync",
    clearWithCache: true,
    debugDescription: "Guest opportunity status mutations queued while offline.",
    exportPolicy: "guest-only",
    id: "opportunities-guest-pending",
    key: STORAGE_KEYS.opportunitiesGuestPending,
    match: "exact",
    valueKind: "json",
  },
  {
    category: "pending-sync",
    clearWithCache: false,
    debugDescription: "Saved-college mutations queued per signed-in user.",
    exportPolicy: "current-user",
    id: "saved-colleges-pending",
    match: "prefix",
    prefix: STORAGE_KEYS.savedCollegesPendingPrefix,
    valueKind: "json",
  },
  {
    category: "profile-state",
    clearWithCache: true,
    debugDescription: "Opportunity progress statuses keyed by app user.",
    exportPolicy: "current-opportunity-user",
    id: "opportunity-statuses",
    match: "prefix",
    prefix: STORAGE_KEYS.opportunitiesStatusesPrefix,
    valueKind: "json",
  },
  {
    category: "pending-sync",
    clearWithCache: true,
    debugDescription: "Opportunity status mutations queued while offline.",
    exportPolicy: "current-opportunity-user",
    id: "opportunity-pending",
    match: "prefix",
    prefix: STORAGE_KEYS.opportunitiesPendingPrefix,
    valueKind: "json",
  },
  {
    category: "cache",
    clearWithCache: true,
    debugDescription: "College Scorecard cache cleanup version marker.",
    exportPolicy: "none",
    id: "college-cache-marker",
    key: LOCAL_STORAGE_KEYS.collegeCacheCleanupVersion,
    match: "exact",
    valueKind: "string",
  },
  {
    category: "cache",
    clearWithCache: true,
    debugDescription: "College Scorecard response cache.",
    exportPolicy: "none",
    id: "college-cache",
    match: "prefix",
    prefix: COLLEGE_CACHE_PREFIX,
    ttlMs: LOCAL_STORAGE_CACHE_POLICY.collegeCacheTtlMs,
    valueKind: "json",
  },
  {
    category: "cache",
    clearWithCache: true,
    debugDescription: "ZIP geocode cache.",
    exportPolicy: "none",
    id: "zip-geocode-cache",
    match: "prefix",
    prefix: ZIP_GEOCODE_CACHE_PREFIX,
    ttlMs: LOCAL_STORAGE_CACHE_POLICY.zipGeocodeCacheTtlMs,
    valueKind: "json",
  },
  {
    category: "cache",
    clearWithCache: true,
    debugDescription: "Last AI response and recommendation caches.",
    exportPolicy: "none",
    id: "ai-response-cache",
    key: LOCAL_STORAGE_KEYS.aiLastResponse,
    match: "exact",
    valueKind: "json",
  },
  {
    category: "cache",
    clearWithCache: true,
    debugDescription: "AI response map cache.",
    exportPolicy: "none",
    id: "ai-response-cache",
    key: LOCAL_STORAGE_KEYS.aiLastResponseMap,
    match: "exact",
    valueKind: "json",
  },
  {
    category: "cache",
    clearWithCache: true,
    debugDescription: "Last AI assistant response cache.",
    exportPolicy: "none",
    id: "ai-response-cache",
    key: LOCAL_STORAGE_KEYS.aiLastAssistantResponse,
    match: "exact",
    valueKind: "json",
  },
  {
    category: "cache",
    clearWithCache: true,
    debugDescription: "AI assistant response map cache.",
    exportPolicy: "none",
    id: "ai-response-cache",
    key: LOCAL_STORAGE_KEYS.aiLastAssistantResponseMap,
    match: "exact",
    valueKind: "json",
  },
  {
    category: "cache",
    clearWithCache: true,
    debugDescription: "Last generated roadmap task cache.",
    exportPolicy: "none",
    id: "ai-response-cache",
    key: LOCAL_STORAGE_KEYS.aiLastRoadmap,
    match: "exact",
    valueKind: "json",
  },
  {
    category: "cache",
    clearWithCache: true,
    debugDescription: "AI college scoring factor cache.",
    exportPolicy: "none",
    id: "ai-response-cache",
    key: LOCAL_STORAGE_KEYS.aiFactorCache,
    match: "exact",
    valueKind: "json",
  },
  {
    category: "session",
    clearWithCache: false,
    debugDescription: "Anonymous client id used for AI gateway quota grouping.",
    exportPolicy: "none",
    id: "ai-gateway-client",
    key: LOCAL_STORAGE_KEYS.aiGatewayClientId,
    match: "exact",
    valueKind: "string",
  },
  {
    category: "preference",
    clearWithCache: false,
    debugDescription: "Cache auto-clear setting.",
    exportPolicy: "none",
    id: "cache-setting",
    key: LOCAL_STORAGE_KEYS.cacheAutoClearEnabled,
    match: "exact",
    valueKind: "boolean-string",
  },
  {
    category: "cache",
    clearWithCache: false,
    debugDescription: "Last cache auto-clear timestamp.",
    exportPolicy: "none",
    id: "cache-setting",
    key: LOCAL_STORAGE_KEYS.cacheLastClearedAt,
    match: "exact",
    valueKind: "string",
  },
] as const satisfies readonly LocalStorageContract[];

const LOCAL_STORAGE_CONTRACT_LIST: readonly LocalStorageContract[] =
  LOCAL_STORAGE_CONTRACTS;

export function normalizeLocalStorageUserId(userId: string | null | undefined) {
  const normalized = String(userId ?? "").trim();
  return normalized || null;
}

export function getLocalStorageOwnerContext(
  user: { isGuest?: boolean | null; uid?: string | null } | null | undefined
): LocalStorageOwnerContext {
  const userId = normalizeLocalStorageUserId(user?.uid);
  return {
    isGuest: !!user?.isGuest,
    opportunityUserKey: user
      ? userId && !user.isGuest
        ? userId
        : GUEST_OPPORTUNITY_USER_KEY
      : null,
    userId,
  };
}

export function getSavedCollegesPendingStorageKey(userId: string) {
  return `${STORAGE_KEYS.savedCollegesPendingPrefix}${userId}`;
}

export function getOpportunityStatusesStorageKey(userKey: string) {
  return userKey === GUEST_OPPORTUNITY_USER_KEY
    ? STORAGE_KEYS.opportunitiesGuestStatuses
    : `${STORAGE_KEYS.opportunitiesStatusesPrefix}${userKey}`;
}

export function getOpportunityPendingStorageKey(userKey: string) {
  return userKey === GUEST_OPPORTUNITY_USER_KEY
    ? STORAGE_KEYS.opportunitiesGuestPending
    : `${STORAGE_KEYS.opportunitiesPendingPrefix}${userKey}`;
}

export function getProfileDocumentStorageKey(
  kind: Exclude<LocalDocumentStorageKind, "roadmap">,
  userId: string
) {
  return `${kind}:${userId}`;
}

export function getResumeStorageKey(userId: string) {
  return getProfileDocumentStorageKey(PROFILE_DOCUMENT_TYPES.resume, userId);
}

export function getTranscriptStorageKey(userId: string) {
  return getProfileDocumentStorageKey(PROFILE_DOCUMENT_TYPES.transcript, userId);
}

export function getAvatarStorageKey(userId: string) {
  return getProfileDocumentStorageKey(PROFILE_DOCUMENT_TYPES.avatar, userId);
}

export function getRoadmapDocumentStorageKey(userId: string, docType: string) {
  return `roadmap:${userId}:${docType}`;
}

export function parseLocalDocumentStorageKey(
  key: string
): LocalDocumentStorageKeyInfo | null {
  const profileMatch = /^(resume|transcript|avatar):(.+)$/.exec(key);
  if (profileMatch?.[1] && profileMatch?.[2]) {
    return {
      kind: profileMatch[1] as Exclude<LocalDocumentStorageKind, "roadmap">,
      key,
      userId: profileMatch[2],
    };
  }

  const roadmapMatch = /^roadmap:([^:]+):(.+)$/.exec(key);
  if (roadmapMatch?.[1] && roadmapMatch?.[2]) {
    return {
      docType: roadmapMatch[2],
      kind: "roadmap",
      key,
      userId: roadmapMatch[1],
    };
  }

  return null;
}

export function getImportedLocalDocumentDirectory(
  info: LocalDocumentStorageKeyInfo
) {
  return `${LOCAL_DOCUMENTS_DIR_NAME}/${buildLocalDocumentSubdirectory(
    info.kind,
    info.userId
  )}/`;
}

function exactContractForKey(key: string) {
  return LOCAL_STORAGE_CONTRACT_LIST.find(
    (contract): contract is ExactLocalStorageContract =>
      contract.match === "exact" && contract.key === key
  );
}

function prefixContractForKey(key: string) {
  return LOCAL_STORAGE_CONTRACT_LIST.find(
    (contract): contract is PrefixLocalStorageContract =>
      contract.match === "prefix" && key.startsWith(contract.prefix)
  );
}

export function getLocalStorageContractForKey(key: string): LocalStorageContract | null {
  const exactContract = exactContractForKey(key);
  if (exactContract) return exactContract;

  if (parseLocalDocumentStorageKey(key)) {
    return {
      category: "document",
      clearWithCache: false,
      debugDescription: "User-owned profile or roadmap document metadata.",
      exportPolicy: "current-user",
      id: key.startsWith("roadmap:") ? "roadmap-document" : "profile-document",
      match: "prefix",
      prefix: key.startsWith("roadmap:") ? "roadmap:" : key.split(":", 1)[0] + ":",
      valueKind: "json",
    };
  }

  return prefixContractForKey(key) ?? null;
}

function suffixAfterPrefix(key: string, prefix: string) {
  return key.slice(prefix.length);
}

export function isPortableLocalStorageKeyForOwner(
  key: string,
  owner: LocalStorageOwnerContext
) {
  const contract = getLocalStorageContractForKey(key);
  if (!contract) return false;

  if (contract.exportPolicy === "none" || contract.exportPolicy === "app-data-payload") {
    return false;
  }

  if (contract.exportPolicy === "preference-payload") {
    return false;
  }

  if (contract.exportPolicy === "guest-only") {
    if (!owner.isGuest) return false;
    if (
      contract.id === "opportunities-guest-statuses" ||
      contract.id === "opportunities-guest-pending"
    ) {
      return owner.opportunityUserKey === GUEST_OPPORTUNITY_USER_KEY;
    }
    return true;
  }

  const documentInfo = parseLocalDocumentStorageKey(key);
  if (documentInfo) {
    return !!owner.userId && documentInfo.userId === owner.userId;
  }

  if (contract.match !== "prefix") return false;

  if (contract.exportPolicy === "current-user") {
    return !!owner.userId && suffixAfterPrefix(key, contract.prefix) === owner.userId;
  }

  if (contract.exportPolicy === "current-opportunity-user") {
    return (
      !!owner.opportunityUserKey &&
      suffixAfterPrefix(key, contract.prefix) === owner.opportunityUserKey
    );
  }

  return false;
}

export function getPortableLocalStorageKeysForOwner(
  keys: readonly string[],
  owner: LocalStorageOwnerContext
) {
  return keys.filter((key) => isPortableLocalStorageKeyForOwner(key, owner));
}

export function getCacheClearableLocalStorageKeys(keys: readonly string[]) {
  return keys.filter((key) => !!getLocalStorageContractForKey(key)?.clearWithCache);
}

export function isGuestLocalDocumentStorageKey(key: string) {
  const documentInfo = parseLocalDocumentStorageKey(key);
  return !!documentInfo && /^guest-/i.test(documentInfo.userId);
}

export function getGuestLocalDocumentStorageKeys(keys: readonly string[]) {
  return keys.filter((key) => isGuestLocalDocumentStorageKey(key));
}

export function getCollegeCacheKey(type: "details" | "matches" | "search", payload: string) {
  return `${COLLEGE_CACHE_PREFIX}${LOCAL_STORAGE_CACHE_POLICY.collegeCacheVersion}:${type}:${payload}`;
}

export function getZipGeocodeCacheKey(zipCode: string) {
  return `${ZIP_GEOCODE_CACHE_PREFIX}${zipCode}`;
}
