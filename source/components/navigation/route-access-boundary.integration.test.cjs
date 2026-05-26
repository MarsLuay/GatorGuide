const assert = require("node:assert/strict");
const test = require("node:test");

const {
  React,
  getRouter,
  hasText,
  render,
  resetReactNativeTestState,
  setAppData,
  unmount,
} = require("../../scripts/qa/react-native-test-utils.cjs");

const { ROUTES } = require("@/constants/routes");
const { RouteAccessBoundary } = require("@/components/navigation/RouteAccessBoundary");

function renderBoundary(props = {}) {
  return render(
    React.createElement(
      RouteAccessBoundary,
      props,
      React.createElement("Text", null, "Protected dashboard")
    )
  );
}

test("RouteAccessBoundary renders the real loading shell while app data hydrates", () => {
  resetReactNativeTestState();
  setAppData({
    isHydrated: false,
    state: {
      user: null,
    },
  });

  const renderer = renderBoundary({ loadingMessage: "Checking account" });

  assert.equal(hasText(renderer, "Checking account"), true);
  assert.equal(hasText(renderer, "Protected dashboard"), false);
  assert.equal(getRouter().replace.calls.length, 0);

  unmount(renderer);
});

test("RouteAccessBoundary redirects unauthenticated users before rendering protected children", () => {
  resetReactNativeTestState();
  setAppData({
    isHydrated: true,
    state: {
      user: null,
    },
  });

  const renderer = renderBoundary();

  assert.deepEqual(getRouter().replace.calls, [[ROUTES.login]]);
  assert.equal(hasText(renderer, "Preparing your data"), true);
  assert.equal(hasText(renderer, "Protected dashboard"), false);

  unmount(renderer);
});

test("RouteAccessBoundary renders protected children for signed-in users", () => {
  resetReactNativeTestState();
  setAppData({
    isHydrated: true,
    state: {
      user: {
        email: "student@example.edu",
        isGuest: false,
        name: "Student",
        uid: "student-1",
      },
    },
  });

  const renderer = renderBoundary();

  assert.equal(hasText(renderer, "Protected dashboard"), true);
  assert.equal(getRouter().replace.calls.length, 0);

  unmount(renderer);
});
