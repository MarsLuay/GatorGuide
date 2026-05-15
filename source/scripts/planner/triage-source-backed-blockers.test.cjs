const assert = require("node:assert/strict");
const test = require("node:test");

const triage = require("./triage-source-backed-blockers.cjs");

test("auto-repair matching separates exact evidence from owner and plan context", () => {
  const indexes = triage.buildAutoRepairIndexes({
    cases: [
      {
        ownerId: "owner-a",
        planId: "plan-a",
        category: "runtime-row-mismatch",
        actions: ["targeted-requirement-parse"],
        evidence: [{ code: "selected-option-not-scheduled" }],
      },
      {
        ownerId: "owner-b",
        planId: "plan-b",
        category: "source-missing",
        actions: ["targeted-source-discovery"],
        evidence: [{ code: "missing-primary-source" }],
      },
      {
        ownerId: "owner-c:pathway:x",
        planId: "plan-c",
        category: "parser-low-coverage",
        actions: ["targeted-requirement-parse"],
        evidence: [{ code: "parser-low-coverage" }],
      },
    ],
  });

  assert.equal(
    triage.resolveAutoRepairMatch(
      { ownerId: "owner-a", planId: "plan-a", issueType: "selected-option-not-scheduled" },
      indexes
    ).matchType,
    "exact_issue"
  );
  assert.equal(
    triage.resolveAutoRepairMatch(
      { ownerId: "owner-b", planId: "plan-b", issueType: "unmapped-uw-only" },
      indexes
    ).matchType,
    "owner_fallback"
  );
  assert.equal(
    triage.resolveAutoRepairMatch(
      { ownerId: "plan-c:pathway:other", planId: "plan-c", issueType: "unmapped-uw-only" },
      indexes
    ).matchType,
    "plan_fallback"
  );
  assert.equal(
    triage.resolveAutoRepairMatch(
      { ownerId: "owner-d", planId: "plan-d", issueType: "unmapped-uw-only" },
      indexes
    ).matchType,
    "none"
  );
});

test("triage reports exact auto-repair coverage separately from context fallback", () => {
  const indexes = triage.buildAutoRepairIndexes({
    cases: [
      {
        ownerId: "owner-a",
        planId: "plan-a",
        category: "runtime-row-mismatch",
        evidence: [{ code: "selected-option-not-scheduled" }],
      },
      {
        ownerId: "owner-b",
        planId: "plan-b",
        category: "source-missing",
        evidence: [{ code: "missing-primary-source" }],
      },
    ],
  });
  const blockers = [
    {
      ownerId: "owner-a",
      planId: "plan-a",
      issueType: "selected-option-not-scheduled",
      autoRepair: triage.resolveAutoRepairMatch(
        { ownerId: "owner-a", planId: "plan-a", issueType: "selected-option-not-scheduled" },
        indexes
      ),
    },
    {
      ownerId: "owner-b",
      planId: "plan-b",
      issueType: "unmapped-uw-only",
      autoRepair: triage.resolveAutoRepairMatch(
        { ownerId: "owner-b", planId: "plan-b", issueType: "unmapped-uw-only" },
        indexes
      ),
    },
    {
      ownerId: "owner-c",
      planId: "plan-c",
      issueType: "unmapped-uw-only",
      autoRepair: triage.resolveAutoRepairMatch(
        { ownerId: "owner-c", planId: "plan-c", issueType: "unmapped-uw-only" },
        indexes
      ),
    },
  ].map((blocker) => ({
    ...blocker,
    actionableIssueClass: "unit-test",
    suspectedLayer: "mapping",
    repairMode: "mapping:evidence-needed-for-uw-only-course",
    auditCollection: "requirementCoverageRows",
    sourceRole: "primary-degree-requirements",
    reportedSourceRole: "primary-degree-requirements",
    canonicalIndexedSourceRole: null,
    likelyRepairTarget: "source/scripts/planner/parse-transfer-planner-equivalency-guide.cjs",
  }));

  const report = triage.buildTriage(blockers, { caseCount: 2, ownerCount: 2, planCount: 2 });
  assert.equal(report.autoRepairOverlap.exactIssueMatchCount, 1);
  assert.equal(report.autoRepairOverlap.ownerFallbackMatchCount, 1);
  assert.equal(report.autoRepairOverlap.planFallbackMatchCount, 0);
  assert.equal(report.autoRepairOverlap.blockerCountWithoutAutoRepairCase, 1);
  assert.equal(report.autoRepairOverlap.exactIssueCoverageRate, 0.333);
  assert.equal(report.autoRepairOverlap.coverageRate, 0.667);
});

test("canonical indexed source role is grouped separately from reported row role", () => {
  const sourceRoleIndex = triage.buildSourceRoleIndex({
    sourceRoleCoverageRows: [
      {
        ownerId: "owner-a",
        primarySource: "https://example.edu/major",
        supportSources: ["https://example.edu/major"],
        approvedCourseListSources: [],
        electiveListSources: ["https://example.edu/electives"],
        nonSchedulableSources: [],
      },
    ],
  });

  const sharedUrlRow = {
    ownerId: "owner-a",
    sourceUrl: "https://example.edu/major/",
    detectedSourceRole: "primary-degree-requirements",
  };
  assert.equal(triage.getReportedSourceRole(sharedUrlRow), "primary-degree-requirements");
  assert.deepEqual(triage.getCanonicalIndexedSourceRoles(sharedUrlRow, sourceRoleIndex), [
    "primary-degree-requirements",
    "support-source",
  ]);
  assert.equal(triage.hasSourceRoleCollision(sharedUrlRow, sourceRoleIndex), true);
  assert.equal(triage.getCanonicalIndexedSourceRole(sharedUrlRow, sourceRoleIndex), null);
  assert.equal(triage.getSourceRole(sharedUrlRow, sourceRoleIndex), "primary-degree-requirements");

  const electiveRow = {
    ownerId: "owner-a",
    sourceUrl: "https://example.edu/electives",
    sourceRoleStatus: "primary",
  };
  assert.equal(triage.getCanonicalIndexedSourceRole(electiveRow, sourceRoleIndex), "elective-list");
  assert.equal(triage.getSourceRole(electiveRow, sourceRoleIndex), "elective-list");
});

test("repair mode classification uses normalized issue types instead of page text", () => {
  assert.equal(
    triage.classifyRepairMode({
      issueType: "source-scope-contamination",
      suspectedLayer: "discovery",
      actionableIssueClass: "source-role-misclassified",
      requirementLabel: "This text mentions prerequisite but is not a prerequisite-table issue",
    }),
    "source-role:scope-or-primary-source-selection"
  );
  assert.equal(
    triage.classifyRepairMode({
      issueType: "prerequisite-table-emitted-requirement",
      suspectedLayer: "parser",
      actionableIssueClass: "source-role-misclassified",
    }),
    "source-role:prerequisite-only-emission-gate"
  );
});
