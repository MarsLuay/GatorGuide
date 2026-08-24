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
  assert.ok(result.state.plannerV2);
  assert.ok(result.state.__legacy);
});

test("v1 envelopes missing plannerV2 request soft rewrite and mirror opaque legacy", () => {
  const result = parsePersistedAppDataPayload({
    schemaVersion: APP_DATA_SCHEMA_VERSION,
    data: {
      user: null,
      questionnaireAnswers: { roadmap: "legacy-alias" },
      notificationsEnabled: false,
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
      savedColleges: [{ id: "uw-seattle", name: "UW", city: "Seattle", state: "WA" }],
    },
  });
  assert.equal(result.shouldRewrite, true);
  assert.equal(result.state.savedColleges[0].id, "uw-seattle");
  assert.equal(result.state.__legacy.savedColleges[0].id, "uw-seattle");
  assert.equal(result.state.__legacy.questionnaireRoadmap, "legacy-alias");
  assert.ok(result.state.plannerV2);
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

test("legacy completed course lists migrate to the structured planner cache without data loss", () => {
  const legacyCourses = [
    "MATH& 151 Calculus I",
    "ENGL& 101 English Composition I",
  ];
  const result = parsePersistedAppDataPayload({
    schemaVersion: APP_DATA_SCHEMA_VERSION,
    data: {
      user: null,
      questionnaireAnswers: {
        completedCourses: legacyCourses,
      },
    },
  });

  assert.deepEqual(result.state.questionnaireAnswers.transferPlannerCompletedCourses, [
    { code: "MATH& 151", label: "MATH& 151 Calculus I" },
    { code: "ENGL& 101", label: "ENGL& 101 English Composition I" },
  ]);
  assert.deepEqual(result.state.questionnaireAnswers.completedCourses, legacyCourses);

  const normalizedAgain = parsePersistedAppDataPayload(
    buildPersistedAppDataEnvelope(result.state)
  );
  assert.deepEqual(
    normalizedAgain.state.questionnaireAnswers.transferPlannerCompletedCourses,
    result.state.questionnaireAnswers.transferPlannerCompletedCourses
  );
  assert.deepEqual(normalizedAgain.state.questionnaireAnswers.completedCourses, legacyCourses);
});

test("unparseable legacy completed course values remain available for compatibility", () => {
  const result = parsePersistedAppDataPayload({
    schemaVersion: APP_DATA_SCHEMA_VERSION,
    data: {
      user: null,
      questionnaireAnswers: {
        completedCourses: "course details pending advisor review",
      },
    },
  });

  assert.equal(result.state.questionnaireAnswers.transferPlannerCompletedCourses, undefined);
  assert.equal(
    result.state.questionnaireAnswers.completedCourses,
    "course details pending advisor review"
  );
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

test("P01-D characterization fixture round-trips removal-bound guest payload fields", () => {
  // Fixtures intentionally include saved-college and questionnaire shapes that
  // P14 will stop consuming at runtime while persistence must remain non-destructive.
  const state = buildState({
    user: {
      uid: "guest-p01d",
      name: "Characterization Guest",
      email: "",
      isGuest: true,
      state: "WA",
      major: "Computer Science",
      gpa: "3.4",
      transcript: "local://transcript-p01d",
      hasSeenOnboarding: true,
    },
    questionnaireAnswers: {
      major: "Computer Science",
      location: "washington_only",
      roadmap: "legacy-alias-should-survive",
    },
    notificationsEnabled: true,
    notificationPreferences: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      collegeDeadlines: true,
      scholarships: true,
      internships: false,
    },
    savedColleges: [
      {
        id: "uw-seattle",
        name: "University of Washington",
        city: "Seattle",
        state: "WA",
      },
    ],
  });

  const envelope = buildPersistedAppDataEnvelope(state);
  const guestResult = parsePersistedAppDataPayload(envelope);
  assert.equal(guestResult.shouldRewrite, false);
  assert.equal(guestResult.state.user?.uid, "guest-p01d");
  assert.equal(guestResult.state.questionnaireAnswers.major, "Computer Science");
  assert.equal(guestResult.state.savedColleges.length, 1);
  assert.equal(guestResult.state.savedColleges[0].id, "uw-seattle");

  const signedIn = buildState({
    user: {
      uid: "signed-p01d",
      name: "Signed Student",
      email: "student@example.com",
      isGuest: false,
      state: "WA",
      major: "Biology",
      gpa: "3.1",
      resume: "local://resume-p01d",
      transcript: "local://transcript-signed",
      isProfileComplete: true,
    },
    savedColleges: [
      { id: "uw-bothell", name: "UW Bothell", city: "Bothell", state: "WA" },
      { id: "uw-tacoma", name: "UW Tacoma", city: "Tacoma", state: "WA" },
    ],
  });
  const signedResult = parsePersistedAppDataPayload(
    buildPersistedAppDataEnvelope(signedIn)
  );
  assert.equal(signedResult.state.user?.uid, "signed-p01d");
  assert.equal(signedResult.state.savedColleges.length, 2);
});
