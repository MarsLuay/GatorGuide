const assert = require("node:assert/strict");
const test = require("node:test");

const {
  React,
  act,
  createSpy,
  getRouter,
  render,
  resetReactNativeTestState,
  setAppData,
  unmount,
} = require("../scripts/qa/react-native-test-utils.cjs");

const { ROUTES } = require("@/constants/routes");
const Index = require("@/app/index").default;

async function waitForStartupNavigation() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
}

test("Index signs first-time unauthenticated users in as guests and opens home", async () => {
  resetReactNativeTestState();
  const signInAsGuest = createSpy(async () => undefined);
  setAppData({
    isHydrated: true,
    state: {
      user: null,
    },
    signInAsGuest,
  });

  const renderer = render(React.createElement(Index));
  await waitForStartupNavigation();

  assert.equal(signInAsGuest.calls.length, 1);
  assert.deepEqual(getRouter().replace.calls, [[ROUTES.tabs]]);

  unmount(renderer);
});
