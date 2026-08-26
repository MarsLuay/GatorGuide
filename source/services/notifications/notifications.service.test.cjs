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

let getStatus = 'undetermined';
let requestStatus = 'granted';
let requestError = null;

const expoNotificationsMock = {
  getPermissionsAsync: async () => ({ status: getStatus }),
  requestPermissionsAsync: async () => {
    if (requestError) throw requestError;
    return { status: requestStatus };
  },
};

const errorLoggingMockCalls = [];
const errorLoggingMock = {
  captureException: (error, metadata) => {
    errorLoggingMockCalls.push({ error, metadata });
  }
};

const reactNativeMock = {
  Platform: { OS: 'ios' }
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "expo-notifications") {
    return {
      __esModule: true,
      default: expoNotificationsMock,
      ...expoNotificationsMock,
      getPermissionsAsync: expoNotificationsMock.getPermissionsAsync,
      requestPermissionsAsync: expoNotificationsMock.requestPermissionsAsync,
    };
  }
  if (request === "@/services/logging/error-logging.service") {
    return {
      __esModule: true,
      errorLoggingService: errorLoggingMock,
    };
  }
  if (request === "react-native") {
    return {
      __esModule: true,
      Platform: reactNativeMock.Platform,
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

// Clear require cache for the service so it requires our mocks
delete require.cache[require.resolve("@/services/notifications/notifications.service")];
const { notificationsService } = require("@/services/notifications/notifications.service");

test.afterEach(() => {
  errorLoggingMockCalls.length = 0;
  getStatus = 'undetermined';
  requestStatus = 'granted';
  requestError = null;
});

test("requestPermissions handles getPermissionsAsync returning already granted", async () => {
  getStatus = 'granted';
  const status = await notificationsService.requestPermissions();
  assert.equal(status, 'granted');
  assert.equal(errorLoggingMockCalls.length, 0);
});

test("requestPermissions handles requesting permissions resulting in granted", async () => {
  getStatus = 'undetermined';
  requestStatus = 'granted';
  const status = await notificationsService.requestPermissions();
  assert.equal(status, 'granted');
  assert.equal(errorLoggingMockCalls.length, 0);
});

test("requestPermissions handles requesting permissions resulting in denied", async () => {
  getStatus = 'undetermined';
  requestStatus = 'denied';
  const status = await notificationsService.requestPermissions();
  assert.equal(status, 'denied');
  assert.equal(errorLoggingMockCalls.length, 0);
});

test("requestPermissions handles errors during requestPermissionsAsync and logs them", async () => {
  getStatus = 'undetermined';
  const mockError = new Error("Simulated denial");
  requestError = mockError;

  const status = await notificationsService.requestPermissions();
  assert.equal(status, 'denied');
  assert.equal(errorLoggingMockCalls.length, 1);
  assert.equal(errorLoggingMockCalls[0].error, mockError);
  assert.equal(errorLoggingMockCalls[0].metadata.category, 'notifications');
  assert.equal(errorLoggingMockCalls[0].metadata.operation, 'request-notification-permissions');
  assert.equal(errorLoggingMockCalls[0].metadata.severity, 'warn');
  assert.equal(errorLoggingMockCalls[0].metadata.handled, true);
  assert.equal(errorLoggingMockCalls[0].metadata.metadata.platform, 'ios');
});
