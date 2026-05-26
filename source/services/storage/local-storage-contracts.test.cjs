require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
    jsx: "react-jsx",
    baseUrl: ".",
    paths: {
      "@/*": ["./*"],
    },
  },
});
require("tsconfig-paths/register");

const assert = require("node:assert/strict");
const test = require("node:test");

const { STORAGE_KEYS } = require("@/constants/schema");
const {
  LOCAL_STORAGE_KEYS,
  getAvatarStorageKey,
  getCacheClearableLocalStorageKeys,
  getCollegeCacheKey,
  getImportedLocalDocumentDirectory,
  getLocalStorageOwnerContext,
  getOpportunityPendingStorageKey,
  getOpportunityStatusesStorageKey,
  getPortableLocalStorageKeysForOwner,
  getResumeStorageKey,
  getRoadmapDocumentStorageKey,
  getSavedCollegesPendingStorageKey,
  getTranscriptStorageKey,
  getZipGeocodeCacheKey,
  parseLocalDocumentStorageKey,
} = require("@/services/storage/local-storage-contracts");

test("portable storage keys are scoped to the signed-in owner", () => {
  const owner = getLocalStorageOwnerContext({ uid: "user-1", isGuest: false });
  const portableKeys = getPortableLocalStorageKeysForOwner(
    [
      STORAGE_KEYS.appData,
      LOCAL_STORAGE_KEYS.appTheme,
      getResumeStorageKey("user-1"),
      getTranscriptStorageKey("user-1"),
      getAvatarStorageKey("other-user"),
      getRoadmapDocumentStorageKey("user-1", "transfer-roadmap"),
      getRoadmapDocumentStorageKey("other-user", "transfer-roadmap"),
      getSavedCollegesPendingStorageKey("user-1"),
      getSavedCollegesPendingStorageKey("other-user"),
      getOpportunityStatusesStorageKey("user-1"),
      getOpportunityPendingStorageKey("other-user"),
      getCollegeCacheKey("search", "nursing"),
      LOCAL_STORAGE_KEYS.aiLastResponse,
    ],
    owner
  );

  assert.deepEqual(portableKeys.sort(), [
    getOpportunityStatusesStorageKey("user-1"),
    getResumeStorageKey("user-1"),
    getRoadmapDocumentStorageKey("user-1", "transfer-roadmap"),
    getSavedCollegesPendingStorageKey("user-1"),
    getTranscriptStorageKey("user-1"),
  ].sort());
});

test("portable storage keys include guest-only state for guest owners", () => {
  const owner = getLocalStorageOwnerContext({ uid: "guest-abc", isGuest: true });
  const portableKeys = getPortableLocalStorageKeysForOwner(
    [
      STORAGE_KEYS.guestProfileShow,
      STORAGE_KEYS.guestRoadmapShow,
      STORAGE_KEYS.opportunitiesGuestStatuses,
      STORAGE_KEYS.opportunitiesGuestPending,
      getTranscriptStorageKey("guest-abc"),
      getOpportunityStatusesStorageKey("user-1"),
    ],
    owner
  );

  assert.deepEqual(portableKeys.sort(), [
    STORAGE_KEYS.guestProfileShow,
    STORAGE_KEYS.guestRoadmapShow,
    STORAGE_KEYS.opportunitiesGuestPending,
    STORAGE_KEYS.opportunitiesGuestStatuses,
    getTranscriptStorageKey("guest-abc"),
  ].sort());
});

test("document storage keys parse to local document directories", () => {
  assert.deepEqual(parseLocalDocumentStorageKey(getResumeStorageKey("user-1")), {
    kind: "resume",
    key: getResumeStorageKey("user-1"),
    userId: "user-1",
  });
  assert.deepEqual(
    parseLocalDocumentStorageKey(getRoadmapDocumentStorageKey("user-1", "essay")),
    {
      docType: "essay",
      kind: "roadmap",
      key: getRoadmapDocumentStorageKey("user-1", "essay"),
      userId: "user-1",
    }
  );
  assert.equal(
    getImportedLocalDocumentDirectory({
      kind: "transcript",
      key: getTranscriptStorageKey("user-1"),
      userId: "user-1",
    }),
    "gatorguide_docs/transcript_user-1/"
  );
});

test("cache-clearable keys come from contract policy", () => {
  const keys = [
    STORAGE_KEYS.appData,
    LOCAL_STORAGE_KEYS.appTheme,
    getCollegeCacheKey("details", "123"),
    LOCAL_STORAGE_KEYS.collegeCacheCleanupVersion,
    getZipGeocodeCacheKey("98001"),
    LOCAL_STORAGE_KEYS.opportunitiesCatalog,
    STORAGE_KEYS.opportunitiesGuestStatuses,
    getOpportunityPendingStorageKey("user-1"),
    LOCAL_STORAGE_KEYS.aiLastResponse,
    LOCAL_STORAGE_KEYS.aiLastAssistantResponse,
    LOCAL_STORAGE_KEYS.aiFactorCache,
    getSavedCollegesPendingStorageKey("user-1"),
    LOCAL_STORAGE_KEYS.cacheAutoClearEnabled,
  ];

  assert.deepEqual(getCacheClearableLocalStorageKeys(keys).sort(), [
    LOCAL_STORAGE_KEYS.aiFactorCache,
    LOCAL_STORAGE_KEYS.aiLastAssistantResponse,
    LOCAL_STORAGE_KEYS.aiLastResponse,
    LOCAL_STORAGE_KEYS.opportunitiesCatalog,
    STORAGE_KEYS.opportunitiesGuestStatuses,
    getCollegeCacheKey("details", "123"),
    LOCAL_STORAGE_KEYS.collegeCacheCleanupVersion,
    getOpportunityPendingStorageKey("user-1"),
    getZipGeocodeCacheKey("98001"),
  ].sort());
});

test("cache key helpers preserve current college and ZIP key shapes", () => {
  assert.equal(getCollegeCacheKey("search", "abc"), "college:v5:search:abc");
  assert.equal(getZipGeocodeCacheKey("98001"), "zip:geocode:98001");
});
