"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  validateShellContract,
  INTENDED_PRIMARY_TABS,
} = require("./shell/navigation-contract.cjs");
const {
  loadLocaleRegistry,
  planChangedKeys,
  translateChangedKeys,
  tokenMultiset,
} = require("./i18n/locale-automation.cjs");
const {
  createOfflineMutationQueue,
  resolvePlanConflict,
  deriveReminderIntents,
  scheduleLocalReminders,
} = require("./sync/offline-reminders.cjs");
const {
  evaluateA11yMatrix,
  evaluateReleaseReadiness,
  plannerRefreshWorkflowContract,
  A11Y_GATES,
  RELEASE_GATES,
} = require("./qa/a11y-release-gates.cjs");

test("P15 shell contract: four planner-first tabs, settings nested, home gone", () => {
  const bad = validateShellContract({
    primaryTabs: ["home", "resources", "profile", "settings"],
    settingsIsPrimaryTab: true,
    homeIsPrimaryTab: true,
  });
  assert.equal(bad.ok, false);
  const good = validateShellContract({
    primaryTabs: [...INTENDED_PRIMARY_TABS],
    settingsIsPrimaryTab: false,
    homeIsPrimaryTab: false,
  });
  assert.equal(good.ok, true);
});

test("P17 locale registry + changed-key translate preserves tokens", async () => {
  const registry = loadLocaleRegistry({
    locales: [
      { code: "en", enabled: true, rtl: false },
      { code: "es", enabled: true, rtl: false },
      { code: "fa", enabled: true, rtl: true },
    ],
  });
  assert.deepEqual(registry.codes, ["en", "es", "fa"]);
  assert.deepEqual(registry.rtl, ["fa"]);

  const english = {
    greeting: "Hello {name}",
    course: "Take MATH&151 at UW Seattle",
  };
  const planned = planChangedKeys({
    english,
    previousHashes: { greeting: "stale" },
  });
  assert.ok(planned.changed.includes("greeting"));
  assert.ok(planned.changed.includes("course"));

  const result = await translateChangedKeys({
    english,
    previousHashes: {},
    targetLocale: "es",
    provider: async ({ text }) => `ES:${text}`,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(tokenMultiset(english.greeting), tokenMultiset(result.translated.greeting));
  assert.ok(result.translated.course.includes("MATH&151"));
  assert.ok(result.translated.course.includes("UW Seattle"));
});

test("P17 translate rolls back hashes on provider/token failure", async () => {
  const previousHashes = { a: "keep" };
  const fail = await translateChangedKeys({
    english: { a: "Hello {name}" },
    previousHashes,
    targetLocale: "es",
    provider: async () => "Hola", // dropped placeholder
  });
  assert.equal(fail.ok, false);
  assert.deepEqual(fail.hashes, previousHashes);
});

test("P18 offline queue, conflict rule, reminder intents", async () => {
  const q = createOfflineMutationQueue();
  q.enqueue({ type: "set-target", campus: "seattle" });
  q.enqueue({ type: "complete-opp", id: "o1" });
  const applied = await q.replay(async () => {});
  assert.equal(applied.length, 2);
  assert.equal(q.list().length, 0);

  const conflict = resolvePlanConflict({
    local: { revision: 2, updatedAt: 10, id: "L" },
    remote: { revision: 3, updatedAt: 1, id: "R" },
  });
  assert.equal(conflict.winner, "remote");

  const intents = deriveReminderIntents({
    timeline: [
      { id: "apply", dueAt: "2027-01-15" },
      { id: "done", dueAt: "2026-01-01", completed: true },
    ],
    offsetsDays: [7, 1, 0],
  });
  assert.equal(intents.length, 3);
  const sched = scheduleLocalReminders({
    intents,
    existingIds: new Set(["reminder:apply:7d"]),
  });
  assert.equal(sched.scheduled.length, 2);
});

test("P19 a11y matrix and P20 release gates block unauthorized publish", () => {
  assert.ok(A11Y_GATES.includes("reduced-motion"));
  assert.ok(RELEASE_GATES.includes("V-PLANNER-FULL"));

  const a11yFail = evaluateA11yMatrix({ "axe-web": "pass" });
  assert.equal(a11yFail.ok, false);

  const a11yPass = evaluateA11yMatrix(
    Object.fromEntries(A11Y_GATES.map((g) => [g, "pass"]))
  );
  assert.equal(a11yPass.ok, true);

  const wf = plannerRefreshWorkflowContract({
    weeklyCron: true,
    workflowDispatch: true,
    node: 20,
    stageThenValidate: true,
    directMainWrite: false,
    uploadReportsAlways: true,
  });
  assert.equal(wf.ok, true);

  const release = evaluateReleaseReadiness({
    gateResults: Object.fromEntries(RELEASE_GATES.map((g) => [g, "pass"])),
    combinedUpdate: true,
    lkgRollbackProven: true,
    userAuthorizedPublish: false,
  });
  assert.equal(release.ok, true);
  assert.equal(release.mayPublish, false);
  assert.match(release.blockedReason, /authorization/i);
});
