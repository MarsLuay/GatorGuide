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

const asyncStorageValues = new Map();
const ensuredDirectories = [];
const writtenBase64Files = new Map();

const asyncStorageMock = {
  getAllKeys: async () => [...asyncStorageValues.keys()],
  multiGet: async (keys) => keys.map((key) => [key, asyncStorageValues.get(key) ?? null]),
  multiRemove: async (keys) => {
    for (const key of keys) asyncStorageValues.delete(key);
  },
  multiSet: async (pairs) => {
    for (const [key, value] of pairs) asyncStorageValues.set(key, value);
  },
};

const originalLoad = Module._load;
Module._load = function loadWithDataPortabilityMocks(request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return {
      __esModule: true,
      default: asyncStorageMock,
      ...asyncStorageMock,
    };
  }

  if (request === "@/services/storage/file-system-adapter.service") {
    return {
      ensureDirectory: async (uri) => {
        ensuredDirectories.push(uri);
      },
      getWritableBaseDirectory: () => "file:///documents/",
      readBase64File: async (uri) => `BASE64:${uri}`,
      readJsonFile: async () => ({}),
      saveTextFileForUser: async ({ fileName }) => ({
        fileName,
        fileUri: `file:///documents/${fileName}`,
        delivery: "filesystem",
        shared: false,
      }),
      writeBase64File: async (uri, content) => {
        writtenBase64Files.set(uri, content);
      },
      writeTextFile: async () => {},
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

const {
  buildDataExportPayload,
  normalizeDataImportPayload,
  restoreDataImportSnapshot,
} = require("@/services/app/data-portability.service");
const {
  STORAGE_KEYS,
} = require("@/constants/schema");
const {
  getOpportunityStatusesStorageKey,
  getTranscriptStorageKey,
} = require("@/services/storage/local-storage-contracts");

function resetStorage() {
  asyncStorageValues.clear();
  ensuredDirectories.length = 0;
  writtenBase64Files.clear();
}

function buildState(overrides = {}) {
  return {
    user: {
      uid: "user-1",
      name: "Student",
      isGuest: false,
      transcript: "",
    },
    questionnaireAnswers: {},
    savedColleges: [],
    ...overrides,
  };
}

test("buildDataExportPayload keeps only portable storage for the current user and embeds local documents", async () => {
  resetStorage();
  const transcriptKey = getTranscriptStorageKey("user-1");
  asyncStorageValues.set(
    transcriptKey,
    JSON.stringify({
      name: "Transcript.pdf",
      url: "file:///documents/transcript.pdf",
      mimeType: "application/pdf",
      sizeBytes: 123,
    })
  );
  asyncStorageValues.set(getTranscriptStorageKey("other-user"), "{}");
  asyncStorageValues.set(getOpportunityStatusesStorageKey("user-1"), "{\"saved\":true}");
  asyncStorageValues.set("unrelated:key", "ignore me");

  const payload = await buildDataExportPayload({
    state: buildState(),
    theme: "dark",
    language: "Spanish",
  });

  assert.equal(payload.app, "GatorGuide");
  assert.equal(payload.theme, "dark");
  assert.equal(payload.preferences.language, "Spanish");
  assert.deepEqual(Object.keys(payload.localStorage).sort(), [
    getOpportunityStatusesStorageKey("user-1"),
    transcriptKey,
  ]);
  assert.equal(payload.embeddedFiles[transcriptKey].base64, "BASE64:file:///documents/transcript.pdf");
});

test("normalizeDataImportPayload filters storage to the imported owner and supported preferences", () => {
  const transcriptKey = getTranscriptStorageKey("user-1");
  const snapshot = normalizeDataImportPayload({
    data: buildState(),
    theme: "dark",
    preferences: {
      language: "French",
    },
    localStorage: {
      [transcriptKey]: JSON.stringify({ name: "Transcript.pdf", url: "file:///old.pdf" }),
      [getTranscriptStorageKey("other-user")]: JSON.stringify({ url: "file:///other.pdf" }),
      [STORAGE_KEYS.guestProfileShow]: "true",
      "unrelated:key": "ignore me",
    },
    embeddedFiles: {
      [transcriptKey]: {
        base64: "PDFDATA",
        name: "Transcript.pdf",
        mimeType: "application/pdf",
      },
    },
  });

  assert.ok(snapshot);
  assert.equal(snapshot.theme, "dark");
  assert.equal(snapshot.language, "French");
  assert.deepEqual(Object.keys(snapshot.localStorage), [transcriptKey]);
  assert.equal(snapshot.embeddedFiles[transcriptKey].name, "Transcript.pdf");
});

test("restoreDataImportSnapshot writes embedded files and points the restored user at the new local URI", async () => {
  resetStorage();
  const originalNow = Date.now;
  Date.now = () => 123456;

  try {
    const transcriptKey = getTranscriptStorageKey("user-1");
    const snapshot = {
      data: buildState(),
      localStorage: {
        [transcriptKey]: JSON.stringify({
          name: "Transcript.pdf",
          url: "file:///old/transcript.pdf",
          mimeType: "application/pdf",
        }),
      },
      embeddedFiles: {
        [transcriptKey]: {
          storageKey: transcriptKey,
          name: "Transcript.pdf",
          mimeType: "application/pdf",
          uploadedAt: null,
          sizeBytes: 123,
          base64: "PDFDATA",
        },
      },
    };

    const restored = await restoreDataImportSnapshot(snapshot);
    const expectedUri =
      "file:///documents/gatorguide_docs/transcript_user-1/123456_Transcript.pdf";

    assert.deepEqual(ensuredDirectories, [
      "file:///documents/gatorguide_docs/transcript_user-1/",
    ]);
    assert.equal(writtenBase64Files.get(expectedUri), "PDFDATA");
    assert.equal(restored.user.transcript, expectedUri);
    assert.equal(JSON.parse(asyncStorageValues.get(transcriptKey)).url, expectedUri);
  } finally {
    Date.now = originalNow;
  }
});
