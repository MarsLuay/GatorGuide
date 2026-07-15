"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  migrateToPlannerStateV2,
  ingestTranscript,
  assertNoTranscriptSourceLeak,
} = require("./runtime/planner-state-v2.cjs");
const {
  matchOpportunities,
  projectTransferTimeline,
} = require("./runtime/timeline-opportunities.cjs");
const {
  INTENDED_PRIMARY_TABS,
  validateShellContract,
} = require("./shell/navigation-contract.cjs");

test("P13-A v2 migration preserves opaque legacy saved-college/AI payloads", () => {
  const v2 = migrateToPlannerStateV2({
    user: { uid: "g1", isGuest: true },
    savedColleges: [{ id: "uw-seattle" }],
    questionnaireAnswers: { roadmap: "legacy" },
    aiRoadmapCache: { courses: ["MATH&151"] },
  });
  assert.equal(v2.schemaVersion, 2);
  assert.equal(v2.__legacyOpaque.savedColleges[0].id, "uw-seattle");
  assert.equal(v2.__legacyOpaque.aiRoadmapCache.courses[0], "MATH&151");
  assert.equal(Object.prototype.hasOwnProperty.call(v2, "savedColleges"), false);
});

test("P13-B transcript ingest disposes source on success and failure", async () => {
  const disposed = [];
  const ok = await ingestTranscript({
    source: { uri: "blob:tmp" },
    parse: async () => [{ code: "MATH&151" }],
    dispose: async (s) => disposed.push(s.uri),
  });
  assert.equal(ok.ok, true);
  assert.deepEqual(disposed, ["blob:tmp"]);

  const fail = await ingestTranscript({
    source: { uri: "blob:bad" },
    parse: async () => {
      throw new Error("parse-failed");
    },
    dispose: async (s) => disposed.push(s.uri),
  });
  assert.equal(fail.ok, false);
  assert.ok(disposed.includes("blob:bad"));
  assert.equal(assertNoTranscriptSourceLeak({ records: ok.records }), true);
  assert.equal(
    assertNoTranscriptSourceLeak({ transcriptUri: "file:///tmp/t.pdf" }),
    false
  );
});

test("P15 shell contract: four tabs, no Home, Settings nested", () => {
  const ok = validateShellContract({
    primaryTabs: [...INTENDED_PRIMARY_TABS],
    settingsIsPrimaryTab: false,
    homeIsPrimaryTab: false,
  });
  assert.equal(ok.ok, true);
  const bad = validateShellContract({
    primaryTabs: ["home", "resources", "calendar", "profile"],
    settingsIsPrimaryTab: true,
    homeIsPrimaryTab: true,
  });
  assert.equal(bad.ok, false);
});

test("P16-A unknown-safe matcher falls back to all when signals missing", () => {
  const opps = [
    { id: "1", campus: "seattle", major: "CS" },
    { id: "2", campus: "bothell", major: "EE" },
  ];
  const all = matchOpportunities({ opportunities: opps, profile: {} });
  assert.equal(all.length, 2);
  assert.equal(all[0].relevance, "fallback-all");

  const filtered = matchOpportunities({
    opportunities: opps,
    profile: { campus: "seattle", major: "CS" },
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "1");

  // Zero matches after hard mismatch → fallback-all (plan exit gate).
  const fallback = matchOpportunities({
    opportunities: opps,
    profile: { campus: "tacoma", major: "IAS" },
  });
  assert.equal(fallback.length, 2);
  assert.equal(fallback[0].relevance, "fallback-all");
});

test("P16-B timeline projection is plan-derived and sorted", () => {
  const entries = projectTransferTimeline({
    activeTarget: { campus: "seattle", programId: "cs" },
    planMilestones: [
      { id: "apply", dueAt: "2027-01-15", messageKey: "timeline.apply" },
    ],
    opportunities: [{ id: "schol", dueAt: "2026-12-01" }],
    personalDeadlines: [{ id: "visit", dueAt: "2026-11-01" }],
  });
  assert.equal(entries[0].id, "personal:visit");
  assert.equal(entries[1].id, "opp:schol");
  assert.equal(entries[2].sourceType, "plan-milestone");
});
