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

const { ROUTES } = require("@/constants/routes");
const {
  hasCompletedProfileSetup,
  resolveRouteAccessRedirect,
  shouldRenderRouteAccessLoading,
} = require("@/components/navigation/route-access-state");

test("hasCompletedProfileSetup treats explicit completion, major, or GPA as complete", () => {
  assert.equal(hasCompletedProfileSetup(null), false);
  assert.equal(hasCompletedProfileSetup({ uid: "u1", isProfileComplete: true }), true);
  assert.equal(hasCompletedProfileSetup({ uid: "u1", major: "Computer Science" }), true);
  assert.equal(hasCompletedProfileSetup({ uid: "u1", gpa: "3.7" }), true);
  assert.equal(hasCompletedProfileSetup({ uid: "u1", name: "Student" }), false);
});

test("resolveRouteAccessRedirect waits for hydration before redirecting", () => {
  assert.equal(
    resolveRouteAccessRedirect({
      isHydrated: false,
      user: null,
      requireUser: true,
    }),
    null
  );
});

test("resolveRouteAccessRedirect applies unauthenticated and guest guards before custom redirects", () => {
  const customRedirect = () => ROUTES.profileSetup;

  assert.equal(
    resolveRouteAccessRedirect({
      isHydrated: true,
      user: null,
      requireUser: true,
      resolveRedirect: customRedirect,
    }),
    ROUTES.login
  );

  assert.equal(
    resolveRouteAccessRedirect({
      allowGuest: false,
      guestRedirect: ROUTES.tabs,
      isHydrated: true,
      requireUser: true,
      resolveRedirect: customRedirect,
      user: { uid: "guest-1", isGuest: true },
    }),
    ROUTES.tabs
  );
});

test("resolveRouteAccessRedirect allows public routes and post-auth custom redirects", () => {
  assert.equal(
    resolveRouteAccessRedirect({
      isHydrated: true,
      user: null,
      requireUser: false,
    }),
    null
  );

  assert.equal(
    resolveRouteAccessRedirect({
      isHydrated: true,
      user: { uid: "u1", isGuest: false },
      resolveRedirect: (user) => (hasCompletedProfileSetup(user) ? ROUTES.tabs : ROUTES.profileSetup),
    }),
    ROUTES.profileSetup
  );
});

test("shouldRenderRouteAccessLoading covers hydration and redirect handoff states", () => {
  assert.equal(shouldRenderRouteAccessLoading({ isHydrated: false, redirectTarget: null }), true);
  assert.equal(shouldRenderRouteAccessLoading({ isHydrated: true, redirectTarget: ROUTES.login }), true);
  assert.equal(shouldRenderRouteAccessLoading({ isHydrated: true, redirectTarget: null }), false);
});
