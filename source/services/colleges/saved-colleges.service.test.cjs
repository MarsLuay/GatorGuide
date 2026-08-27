const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

let getDocsMock = async () => ({ docs: [] });
let setDocMock = async () => {};
let deleteDocMock = async () => {};
let deleteFieldMock = () => "delete-field";
let serverTimestampMock = () => "timestamp";
let collectionMock = () => "mock-collection";
let docMock = () => "mock-doc";
let updateDocMock = async () => {};
let getItemMock = async () => null;

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "expo-modules-core" || request.startsWith("expo-")) {
    return { requireNativeModule: () => ({}), useAssets: () => [], useFonts: () => [], default: { expoConfig: {} } };
  }
  if (request === "@react-native-async-storage/async-storage") {
    return {
      __esModule: true,
      default: {
        getAllKeys: async () => [],
        getItem: async (...args) => getItemMock(...args),
        multiGet: async () => [],
        multiRemove: async () => {},
        multiSet: async () => {},
        removeItem: async () => {},
        setItem: async () => {},
      }
    };
  }
  if (request === "firebase/firestore") {
    return {
      collection: (...args) => collectionMock(...args),
      doc: (...args) => docMock(...args),
      getDocs: (...args) => getDocsMock(...args),
      setDoc: (...args) => setDocMock(...args),
      deleteDoc: (...args) => deleteDocMock(...args),
      updateDoc: (...args) => updateDocMock(...args),
      deleteField: (...args) => deleteFieldMock(...args),
      serverTimestamp: (...args) => serverTimestampMock(...args),
    };
  }
  if (request === "@/services/firebase/firebase") {
    return { db: "mock-db" };
  }
  if (request === "@/services/colleges/college.service") {
    return {
      collegeService: {
        getCollegeDetails: async (id) => ({ id, name: "Test College" })
      }
    };
  }
  if (request.includes("react-native")) {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};

// Use ts-node directly to require the typescript source file within this mock environment context
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

const { savedCollegesService } = require("@/services/colleges/saved-colleges.service");

test("syncSavedColleges handles network failure by rejecting so the hook can catch it", async () => {
  getDocsMock = async () => {
    throw new Error("Failed to load saved colleges");
  };

  await assert.rejects(
    async () => {
        await savedCollegesService.syncSavedColleges("user-1", []);
    },
    (err) => err.message === "Failed to load saved colleges"
  );
});

test("readPendingMutations handles storage failure returning empty array", async () => {
  getItemMock = async () => {
    throw new Error("Storage is corrupt");
  };

  getDocsMock = async () => ({ docs: [] });

  const result = await savedCollegesService.syncSavedColleges("user-1", []);
  assert.deepEqual(result, []);
});
