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
const Module = require("node:module");
const test = require("node:test");

const calls = [];
const asyncStorageMock = {
  getAllKeys: async () => {
    calls.push(["getAllKeys"]);
    return [];
  },
  getItem: async (key) => {
    calls.push(["getItem", key]);
    return null;
  },
  multiGet: async (keys) => {
    calls.push(["multiGet", keys]);
    return keys.map((key) => [key, null]);
  },
  multiRemove: async (keys) => {
    calls.push(["multiRemove", keys]);
  },
  multiSet: async (entries) => {
    calls.push(["multiSet", entries]);
  },
  removeItem: async (key) => {
    calls.push(["removeItem", key]);
  },
  setItem: async (key, value) => {
    calls.push(["setItem", key, value]);
  },
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return {
      __esModule: true,
      default: asyncStorageMock,
      ...asyncStorageMock,
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const {
  LOCAL_STORAGE_KEYS,
} = require("@/services/storage/local-storage-contracts");
const {
  localStorageService,
} = require("@/services/storage/local-storage.service");

test("localStorageService forwards registered keys to AsyncStorage", async () => {
  calls.length = 0;

  await localStorageService.setItem(LOCAL_STORAGE_KEYS.appTheme, "dark");
  await localStorageService.multiSet([[LOCAL_STORAGE_KEYS.appLanguage, "es"]]);
  await localStorageService.removeItem(LOCAL_STORAGE_KEYS.appTheme);

  assert.deepEqual(calls, [
    ["setItem", LOCAL_STORAGE_KEYS.appTheme, "dark"],
    ["multiSet", [[LOCAL_STORAGE_KEYS.appLanguage, "es"]]],
    ["removeItem", LOCAL_STORAGE_KEYS.appTheme],
  ]);
});

test("localStorageService rejects keys missing from the contract registry", async () => {
  calls.length = 0;

  await assert.rejects(
    () => localStorageService.getItem("unknown:local-storage-key"),
    /Unregistered local storage key/
  );
  assert.deepEqual(calls, []);
});
