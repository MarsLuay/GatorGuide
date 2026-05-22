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
const Module = require("node:module");

const originalLoad = Module._load;
Module._load = function loadWithAppDataTestMocks(request, parent, isMain) {
  if (request === "@/services/colleges/saved-colleges.service") {
    return {
      savedCollegesService: {
        mergeSavedCollegeLists: (_base, incoming) => incoming ?? [],
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { APP_DATA_SCHEMA_VERSION } = require("@/constants/schema");
const {
  buildPersistedAppDataEnvelope,
  parsePersistedAppDataPayload,
  parsePersistedAppDataState,
  serializeAppDataState,
} = require("@/hooks/app-data/app-data-persistence");
const {
  DEFAULT_NOTIFICATION_PREFERENCES,
  initialState,
} = require("@/hooks/app-data/app-data-state");

function buildState(overrides = {}) {
  return {
    ...initialState,
    user: {
      uid: "guest-1",
      name: "Guest Student",
      email: "",
      isGuest: true,
      state: "WA",
    },
    questionnaireAnswers: {
      major: "Computer Science",
    },
    ...overrides,
  };
}

test("serializeAppDataState writes the explicit schema envelope", () => {
  const state = buildState();
  const parsed = JSON.parse(serializeAppDataState(state));

  assert.equal(parsed.schemaVersion, APP_DATA_SCHEMA_VERSION);
  assert.equal(parsed.data.user.uid, "guest-1");
  assert.equal(parsed.data.questionnaireAnswers.major, "Computer Science");
  assert.deepEqual(parsed.data.notificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES);
});

test("schema v1 envelopes hydrate without migration rewrite", () => {
  const state = buildState({
    notificationsEnabled: true,
    notificationPreferences: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      internships: false,
    },
  });
  const result = parsePersistedAppDataPayload(buildPersistedAppDataEnvelope(state));

  assert.equal(result.schemaVersion, APP_DATA_SCHEMA_VERSION);
  assert.equal(result.migratedFromLegacy, false);
  assert.equal(result.shouldRewrite, false);
  assert.equal(result.state.notificationsEnabled, true);
  assert.equal(result.state.notificationPreferences.internships, false);
});

test("legacy raw app-data payloads migrate into normalized state", () => {
  const legacyPayload = {
    user: {
      uid: "guest-legacy",
      name: "Legacy Guest",
      email: "",
      isGuest: true,
    },
    questionnaireAnswers: {
      location: "Washington",
    },
    notificationsEnabled: true,
  };

  const result = parsePersistedAppDataState(JSON.stringify(legacyPayload));

  assert.equal(result.schemaVersion, 0);
  assert.equal(result.migratedFromLegacy, true);
  assert.equal(result.shouldRewrite, true);
  assert.equal(result.state.user?.uid, "guest-legacy");
  assert.equal(result.state.questionnaireAnswers.location, "washington_only");
  assert.equal(result.state.notificationsEnabled, true);
  assert.deepEqual(result.state.notificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES);
});

test("future or malformed envelopes preserve usable data but request rewrite", () => {
  const result = parsePersistedAppDataPayload({
    schemaVersion: APP_DATA_SCHEMA_VERSION + 1,
    data: {
      user: {
        uid: "future-user",
        name: "Future User",
        email: "future@example.com",
      },
      notificationPreferences: {
        transferDeadlines: false,
      },
    },
  });

  assert.equal(result.schemaVersion, APP_DATA_SCHEMA_VERSION + 1);
  assert.equal(result.migratedFromLegacy, false);
  assert.equal(result.shouldRewrite, true);
  assert.equal(result.state.user?.uid, "future-user");
  assert.equal(result.state.notificationPreferences.transferDeadlines, false);
  assert.equal(result.state.notificationPreferences.collegeDeadlines, true);
});

test("unrecognized persisted payloads fall back to initial state and rewrite", () => {
  const result = parsePersistedAppDataPayload({ schemaVersion: "nope" });

  assert.equal(result.state.user, null);
  assert.deepEqual(result.state.questionnaireAnswers, {});
  assert.equal(result.migratedFromLegacy, false);
  assert.equal(result.shouldRewrite, true);
});
