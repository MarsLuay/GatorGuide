const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildFreshnessReport,
  buildGeneratedOutputKeysForRepairPlans,
  buildPostRepairVerificationPlanIds,
  buildRepairCommandPlan,
  runPostRepairVerification,
  resolveRepairStartCommandIndex,
  runRepairAttempt,
} = require("./build-transfer-planner-auto-repair-plan.cjs");

function writeFileWithMtime(filePath, mtimeMs) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "{}\n");
  const mtime = new Date(mtimeMs);
  fs.utimesSync(filePath, mtime, mtime);
}

test("auto-repair freshness maps repair plans to generated outputs", () => {
  const outputKeys = buildGeneratedOutputKeysForRepairPlans([
    {
      needsSourceDiscovery: true,
      needsRequirementParse: true,
      needsRuntimeGeneration: true,
    },
  ]);

  assert.deepEqual(outputKeys, [
    "bootstrap",
    "generatedMajorPlans",
    "primarySourcePromotions",
    "programApprovedCourseFilters",
    "requirementSourceAdapterBlocks",
    "requirementSourceAdapters",
    "sourceFingerprints",
    "sourceGaps",
    "studentRuntime",
  ]);
});

test("auto-repair freshness marks reports stale when generated outputs are newer", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gatorguide-repair-freshness-"));
  try {
    const ownerAuditPath = path.join(tmpDir, "owner-audit.json");
    const studentRuntimePath = path.join(tmpDir, "student-runtime.generated.ts");
    const base = Date.UTC(2026, 0, 1, 12, 0, 0);

    writeFileWithMtime(ownerAuditPath, base);
    writeFileWithMtime(studentRuntimePath, base + 10_000);

    const freshness = buildFreshnessReport(
      [{ needsSourceDiscovery: false, needsRequirementParse: false, needsRuntimeGeneration: true }],
      {
        toleranceMs: 1_000,
        reportInputs: [{ key: "ownerAudit", label: "owner audit", path: ownerAuditPath }],
        generatedOutputPaths: { studentRuntime: studentRuntimePath },
      }
    );

    assert.equal(freshness.outcome, "stale");
    assert.equal(freshness.staleReports.length, 1);
    assert.equal(freshness.staleReports[0].key, "ownerAudit");
    assert.equal(freshness.staleReports[0].newestGeneratedOutputKey, "studentRuntime");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("auto-repair freshness allows reports inside the freshness tolerance", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gatorguide-repair-freshness-"));
  try {
    const ownerAuditPath = path.join(tmpDir, "owner-audit.json");
    const studentRuntimePath = path.join(tmpDir, "student-runtime.generated.ts");
    const base = Date.UTC(2026, 0, 1, 12, 0, 0);

    writeFileWithMtime(ownerAuditPath, base);
    writeFileWithMtime(studentRuntimePath, base + 500);

    const freshness = buildFreshnessReport(
      [{ needsSourceDiscovery: false, needsRequirementParse: false, needsRuntimeGeneration: true }],
      {
        toleranceMs: 1_000,
        reportInputs: [{ key: "ownerAudit", label: "owner audit", path: ownerAuditPath }],
        generatedOutputPaths: { studentRuntime: studentRuntimePath },
      }
    );

    assert.equal(freshness.outcome, "fresh");
    assert.equal(freshness.staleReports.length, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("auto-repair resume accepts an explicit 1-based command index", () => {
  const commands = [
    ["node", "first.cjs"],
    ["node", "second.cjs"],
    ["node", "third.cjs"],
  ];

  assert.equal(
    resolveRepairStartCommandIndex(commands, {
      resumeFailed: false,
      fromCommandIndex: 3,
    }),
    3
  );
});

test("auto-repair resume retries the saved failed command", () => {
  const commands = [
    ["node", "first.cjs"],
    ["node", "second.cjs"],
    ["node", "third.cjs"],
  ];
  const savedState = {
    commandSequence: commands.map((command, index) => ({
      commandIndex: index + 1,
      command,
    })),
    attemptedCommands: [
      { commandIndex: 1, command: commands[0], status: 0 },
      { commandIndex: 2, command: commands[1], status: 1 },
    ],
  };

  assert.equal(
    resolveRepairStartCommandIndex(
      commands,
      {
        resumeFailed: true,
        fromCommandIndex: null,
      },
      savedState
    ),
    2
  );
});

test("auto-repair resume refuses stale saved command sequences", () => {
  const currentCommands = [
    ["node", "first.cjs"],
    ["node", "changed-second.cjs"],
  ];
  const savedState = {
    commandSequence: [
      { commandIndex: 1, command: ["node", "first.cjs"] },
      { commandIndex: 2, command: ["node", "second.cjs"] },
    ],
    attemptedCommands: [
      { commandIndex: 1, command: ["node", "first.cjs"], status: 0 },
      { commandIndex: 2, command: ["node", "second.cjs"], status: 1 },
    ],
  };

  assert.throws(
    () =>
      resolveRepairStartCommandIndex(
        currentCommands,
        {
          resumeFailed: true,
          fromCommandIndex: null,
        },
        savedState
      ),
    /no longer matches/
  );
});

test("auto-repair attempt starts at the requested command and saves state", () => {
  const report = {
    generatedAt: "2026-01-01T00:00:00.000Z",
    targetPlanId: null,
    repairPlans: [
      {
        planId: "alpha",
        needsSourceDiscovery: false,
        needsRequirementParse: true,
        needsRuntimeGeneration: false,
      },
      {
        planId: "beta",
        needsSourceDiscovery: false,
        needsRequirementParse: true,
        needsRuntimeGeneration: false,
      },
    ],
  };
  const options = {
    repair: true,
    maxRepairPlans: null,
    resumeFailed: false,
    fromCommandIndex: 2,
    repairAttemptStatePath: "attempt-state.json",
    postRepairVerification: false,
  };
  const runCommands = [];
  const savedStates = [];

  const attempt = runRepairAttempt(
    report,
    options,
    (command) => {
      runCommands.push(command);
      return { command, status: runCommands.length === 1 ? 0 : 1 };
    },
    (state, statePath) => {
      savedStates.push({ state, statePath });
    }
  );

  assert.equal(attempt.startCommandIndex, 2);
  assert.equal(attempt.commands.length, 2);
  assert.equal(attempt.commands[0].commandIndex, 2);
  assert.equal(attempt.commands[1].commandIndex, 3);
  assert.deepEqual(runCommands[0], [
    "node",
    "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
    "--target-plan-id",
    "beta",
  ]);
  assert.equal(savedStates.length, 1);
  assert.equal(savedStates[0].statePath, "attempt-state.json");
  assert.equal(savedStates[0].state.startCommandIndex, 2);
  assert.equal(savedStates[0].state.commandSequence.length, 5);
  assert.equal(savedStates[0].state.failedCommandCount, 1);
  assert.equal(savedStates[0].state.postRepairVerification.enabled, false);
});

test("auto-repair command planner batches parent-child and same-source target plans", () => {
  const commandPlan = buildRepairCommandPlan([
    {
      planId: "uw-bothell-business-administration",
      ownerIds: ["uw-bothell-business-administration"],
      sourceUrls: ["https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration"],
      needsSourceDiscovery: true,
      needsRequirementParse: true,
      needsRuntimeGeneration: false,
    },
    {
      planId: "uw-bothell-business-administration-finance",
      ownerIds: ["uw-bothell-business-administration-finance"],
      sourceUrls: ["https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration"],
      needsSourceDiscovery: true,
      needsRequirementParse: true,
      needsRuntimeGeneration: false,
    },
  ]);

  assert.deepEqual(commandPlan.commands[0], [
    "node",
    "scripts/planner/discover-transfer-planner-primary-sources.cjs",
    "--target-plan-ids",
    "uw-bothell-business-administration,uw-bothell-business-administration-finance",
  ]);
  assert.deepEqual(commandPlan.commands[4], [
    "node",
    "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
    "--target-plan-ids",
    "uw-bothell-business-administration,uw-bothell-business-administration-finance",
  ]);
  assert.equal(commandPlan.batches.length, 2);
  assert.equal(commandPlan.batches[0].planCount, 2);
  assert.ok(commandPlan.batches[0].reasonCodes.some((reason) => reason.startsWith("same-source:")));
  assert.ok(
    commandPlan.batches[0].reasonCodes.includes(
      "parent-child:uw-bothell-business-administration"
    )
  );
});

test("auto-repair post verification picks successful target plans for partial runs", () => {
  const selectedPlans = [
    { planId: "alpha" },
    { planId: "beta" },
    { planId: "gamma" },
  ];
  const attemptedCommands = [
    {
      command: [
        "node",
        "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
        "--target-plan-id",
        "alpha",
      ],
      status: 0,
    },
    {
      command: [
        "node",
        "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
        "--target-plan-id",
        "beta",
      ],
      status: 1,
    },
  ];

  assert.deepEqual(
    buildPostRepairVerificationPlanIds(selectedPlans, attemptedCommands, 5),
    ["alpha"]
  );
});

test("auto-repair post verification expands successful multi-target commands", () => {
  const selectedPlans = [
    { planId: "alpha" },
    { planId: "alpha-child" },
    { planId: "beta" },
  ];
  const attemptedCommands = [
    {
      command: [
        "node",
        "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
        "--target-plan-ids",
        "alpha,alpha-child",
      ],
      status: 0,
    },
  ];

  assert.deepEqual(
    buildPostRepairVerificationPlanIds(selectedPlans, attemptedCommands, 3),
    ["alpha", "alpha-child"]
  );
});

test("auto-repair post verification compares before and after case keys", () => {
  const report = {
    cases: [
      {
        ownerId: "alpha",
        planId: "alpha",
        category: "source-unparseable",
        severity: "error",
        actions: ["targeted-requirement-parse"],
      },
      {
        ownerId: "alpha:pathway:one",
        planId: "alpha",
        category: "runtime-row-mismatch",
        severity: "error",
        actions: ["student-runtime-regeneration"],
      },
    ],
  };
  const afterReport = {
    cases: [
      {
        ownerId: "alpha:pathway:one",
        planId: "alpha",
        category: "runtime-row-mismatch",
        severity: "error",
        actions: ["student-runtime-regeneration"],
      },
    ],
  };
  const commandCalls = [];

  const verification = runPostRepairVerification({
    report,
    options: {
      postRepairVerification: true,
      postRepairVerificationRestorablePaths: [],
    },
    selectedPlans: [
      {
        planId: "alpha",
        actions: ["targeted-requirement-parse", "student-runtime-regeneration"],
      },
    ],
    attemptedCommands: [
      {
        command: [
          "node",
          "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
          "--target-plan-id",
          "alpha",
        ],
        status: 0,
      },
    ],
    commandCount: 1,
    commandRunner: (command) => {
      commandCalls.push(command);
      return { command, status: 0 };
    },
    reportBuilder: (options) => {
      assert.equal(options.targetPlanId, "alpha");
      return afterReport;
    },
  });

  assert.equal(commandCalls.length, 2);
  assert.equal(verification.enabled, true);
  assert.equal(verification.verifiedPlanCount, 1);
  assert.equal(verification.summary.beforeCaseCount, 2);
  assert.equal(verification.summary.afterCaseCount, 1);
  assert.equal(verification.summary.fixedCaseCount, 1);
  assert.equal(verification.summary.newCaseCount, 0);
  assert.equal(verification.planResults[0].status, "improved");
});
