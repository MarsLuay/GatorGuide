const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildFreshnessReport,
  buildGeneratedOutputKeysForRepairPlans,
  buildIndexes,
  buildPostRepairVerificationPlanIds,
  buildRepairCommandPlan,
  collectDiscoveryCases,
  collectOwnerAuditCases,
  collectParseReportCases,
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

test("auto-repair freshness does not make discovery stale from downstream source registries", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gatorguide-repair-freshness-"));
  try {
    const discoveryPath = path.join(tmpDir, "primary-source-discovery.json");
    const generatedMajorPlansPath = path.join(tmpDir, "generated-major-plans.ts");
    const bootstrapPath = path.join(tmpDir, "bootstrap.generated.ts");
    const promotionsPath = path.join(tmpDir, "primary-source-promotions.generated.ts");
    const sourceGapsPath = path.join(tmpDir, "source-gaps.generated.ts");
    const base = Date.UTC(2026, 0, 1, 12, 0, 0);

    writeFileWithMtime(generatedMajorPlansPath, base);
    writeFileWithMtime(discoveryPath, base + 1_000);
    writeFileWithMtime(promotionsPath, base + 10_000);
    writeFileWithMtime(sourceGapsPath, base + 11_000);
    writeFileWithMtime(bootstrapPath, base + 12_000);

    const freshness = buildFreshnessReport(
      [{ needsSourceDiscovery: true, needsRequirementParse: false, needsRuntimeGeneration: false }],
      {
        toleranceMs: 1_000,
        reportInputs: [
          {
            key: "primarySourceDiscovery",
            label: "primary source discovery",
            path: discoveryPath,
          },
        ],
        generatedOutputPaths: {
          generatedMajorPlans: generatedMajorPlansPath,
          primarySourcePromotions: promotionsPath,
          sourceGaps: sourceGapsPath,
          bootstrap: bootstrapPath,
        },
      }
    );

    assert.equal(freshness.outcome, "fresh");
    assert.equal(freshness.staleReports.length, 0);
    assert.equal(
      freshness.sourceReports[0]?.newestRelevantGeneratedOutputKey,
      "generatedMajorPlans"
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("auto-repair freshness marks discovery stale when generated major plans are newer", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gatorguide-repair-freshness-"));
  try {
    const discoveryPath = path.join(tmpDir, "primary-source-discovery.json");
    const generatedMajorPlansPath = path.join(tmpDir, "generated-major-plans.ts");
    const base = Date.UTC(2026, 0, 1, 12, 0, 0);

    writeFileWithMtime(discoveryPath, base);
    writeFileWithMtime(generatedMajorPlansPath, base + 10_000);

    const freshness = buildFreshnessReport(
      [{ needsSourceDiscovery: true, needsRequirementParse: false, needsRuntimeGeneration: false }],
      {
        toleranceMs: 1_000,
        reportInputs: [
          {
            key: "primarySourceDiscovery",
            label: "primary source discovery",
            path: discoveryPath,
          },
        ],
        generatedOutputPaths: {
          generatedMajorPlans: generatedMajorPlansPath,
        },
      }
    );

    assert.equal(freshness.outcome, "stale");
    assert.equal(freshness.staleReports.length, 1);
    assert.equal(freshness.staleReports[0].key, "primarySourceDiscovery");
    assert.equal(freshness.staleReports[0].newestGeneratedOutputKey, "generatedMajorPlans");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("auto-repair freshness compares requirement reports only to parser-derived outputs", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gatorguide-repair-freshness-"));
  try {
    const requirementParsePath = path.join(tmpDir, "requirement-parse.json");
    const sourceChangePath = path.join(tmpDir, "source-change.json");
    const sourceGapsPath = path.join(tmpDir, "source-gaps.generated.ts");
    const sourceFingerprintsPath = path.join(tmpDir, "source-fingerprints.generated.ts");
    const requirementAdaptersPath = path.join(
      tmpDir,
      "requirement-source-adapters.generated.ts"
    );
    const base = Date.UTC(2026, 0, 1, 12, 0, 0);

    writeFileWithMtime(requirementParsePath, base);
    writeFileWithMtime(sourceChangePath, base + 500);
    writeFileWithMtime(requirementAdaptersPath, base + 800);
    writeFileWithMtime(sourceFingerprintsPath, base + 900);
    writeFileWithMtime(sourceGapsPath, base + 60_000);

    const freshness = buildFreshnessReport(
      [{ needsSourceDiscovery: true, needsRequirementParse: true, needsRuntimeGeneration: false }],
      {
        toleranceMs: 1_000,
        reportInputs: [
          { key: "requirementParse", label: "requirement parse", path: requirementParsePath },
          {
            key: "sourceChangeClassification",
            label: "source-change classification",
            path: sourceChangePath,
          },
        ],
        generatedOutputPaths: {
          requirementSourceAdapters: requirementAdaptersPath,
          sourceFingerprints: sourceFingerprintsPath,
          sourceGaps: sourceGapsPath,
        },
      }
    );

    assert.equal(freshness.outcome, "fresh");
    assert.equal(freshness.staleReports.length, 0);
    assert.equal(
      freshness.sourceReports.find((report) => report.key === "requirementParse")
        ?.newestRelevantGeneratedOutputKey,
      "sourceFingerprints"
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("auto-repair ignores no-code inactive major sources", () => {
  const parseOwner = {
    ownerId: "uw-seattle-italian",
    ownerTitle: "Italian",
    planId: "uw-seattle-italian",
    pathwayId: null,
    campusId: "uw-seattle",
    ok: true,
    sourceUrl: "https://frenchitalian.washington.edu/undergraduate-studies-italian",
    sourceRole: "non-schedulable-course-list",
    sourceRoleStatus: "non-schedulable",
    sourceInactiveMajor: true,
    parsedUwCourseCodes: [],
    structuredUwCourseCodes: [],
    sourceOnlyUwCourseCodes: [],
    structuredOnlyUwCourseCodes: [],
    requirementCueLines: ["Major Requirements"],
    qualitySignals: [
      {
        severity: "note",
        code: "inactive-major-source",
        message: "Inactive major source.",
      },
    ],
  };
  const ownerAudit = {
    owners: [
      {
        ownerId: parseOwner.ownerId,
        planId: parseOwner.planId,
        title: parseOwner.ownerTitle,
        rootIssues: [
          {
            code: "no-parsed-uw-course-codes",
            severity: "warning",
            message: "Parsed source produced no usable UW course codes.",
          },
        ],
      },
    ],
  };
  const parseReport = { owners: [parseOwner] };
  const discoveryReport = {
    owners: [],
    weakExistingOwners: [
      {
        ownerKey: parseOwner.ownerId,
        planId: parseOwner.planId,
        pathwayId: null,
        title: parseOwner.ownerTitle,
        campusId: parseOwner.campusId,
        existingPrimaryUrl: parseOwner.sourceUrl,
        suggestedPrimary: null,
        candidateCount: 3,
        reevaluationSignals: [
          {
            code: "no-parsed-uw-course-codes",
            reason: "Parsed source block produced zero UW course codes.",
          },
        ],
      },
    ],
  };
  const indexes = buildIndexes({ ownerAudit, parseReport, discoveryReport });
  const caseMap = new Map();

  collectOwnerAuditCases(caseMap, ownerAudit, indexes);
  collectParseReportCases(caseMap, parseReport, indexes);
  collectDiscoveryCases(caseMap, discoveryReport, indexes);

  assert.equal(caseMap.size, 0);
});

test("auto-repair ignores no-code parent owners covered by parsed child pathways", () => {
  const parentOwner = {
    ownerId: "uw-tacoma-egls",
    ownerTitle: "Ethnic, Gender and Labor Studies",
    planId: "uw-tacoma-egls",
    pathwayId: null,
    campusId: "uw-tacoma",
    ok: true,
    sourceUrl: "https://www.tacoma.uw.edu/sias/socs/ethnic-gender-and-labor-studies",
    sourceRole: "primary-degree-requirements",
    sourceRoleStatus: "primary",
    parsedUwCourseCodes: [],
    structuredUwCourseCodes: [],
    sourceOnlyUwCourseCodes: [],
    structuredOnlyUwCourseCodes: [],
    requirementCueLines: ["Major requirements"],
    qualitySignals: [],
  };
  const childOwner = {
    ...parentOwner,
    ownerId: "uw-tacoma-egls:pathway:ethnic-studies-option",
    ownerTitle: "Ethnic, Gender and Labor Studies - Ethnic Studies Option",
    pathwayId: "ethnic-studies-option",
    parsedUwCourseCodes: ["TEGL 101", "TEGL 201"],
  };
  const ownerAudit = {
    owners: [
      {
        ownerId: parentOwner.ownerId,
        planId: parentOwner.planId,
        title: parentOwner.ownerTitle,
        rootIssues: [
          {
            code: "no-parsed-uw-course-codes",
            severity: "warning",
            message: "Parsed source produced no usable UW course codes.",
          },
        ],
      },
    ],
  };
  const parseReport = { owners: [parentOwner, childOwner] };
  const discoveryReport = {
    owners: [],
    weakExistingOwners: [
      {
        ownerKey: parentOwner.ownerId,
        planId: parentOwner.planId,
        pathwayId: null,
        title: parentOwner.ownerTitle,
        campusId: parentOwner.campusId,
        existingPrimaryUrl: parentOwner.sourceUrl,
        suggestedPrimary: null,
        candidateCount: 160,
        reevaluationSignals: [
          {
            code: "no-parsed-uw-course-codes",
            reason: "Parsed source block produced zero UW course codes.",
          },
        ],
      },
    ],
  };
  const indexes = buildIndexes({ ownerAudit, parseReport, discoveryReport });
  const caseMap = new Map();

  collectOwnerAuditCases(caseMap, ownerAudit, indexes);
  collectParseReportCases(caseMap, parseReport, indexes);
  collectDiscoveryCases(caseMap, discoveryReport, indexes);

  assert.equal(caseMap.size, 0);
});

test("auto-repair ignores no-code duplicate owner blocks covered by another parsed source", () => {
  const parsedSource = {
    ownerId: "uw-tacoma-history:pathway:global-history-option",
    ownerTitle: "History - Global History Option",
    planId: "uw-tacoma-history",
    pathwayId: "global-history-option",
    campusId: "uw-tacoma",
    ok: true,
    sourceUrl: "https://www.tacoma.uw.edu/history/global-history",
    sourceRole: "primary-degree-requirements",
    sourceRoleStatus: "primary",
    parsedUwCourseCodes: ["THIST 201", "THIST 301"],
    structuredUwCourseCodes: ["THIST 201", "THIST 301"],
    sourceOnlyUwCourseCodes: [],
    structuredOnlyUwCourseCodes: [],
    requirementCueLines: ["Global History option requirements"],
    qualitySignals: [],
  };
  const overviewSource = {
    ...parsedSource,
    sourceUrl: "https://www.tacoma.uw.edu/history",
    parsedUwCourseCodes: [],
    structuredUwCourseCodes: [],
    structuredOnlyUwCourseCodes: ["THIST 201", "THIST 301"],
    requirementCueLines: [],
  };
  const parseReport = { owners: [parsedSource, overviewSource] };
  const indexes = buildIndexes({ ownerAudit: null, parseReport, discoveryReport: null });
  const caseMap = new Map();

  collectParseReportCases(caseMap, parseReport, indexes);

  assert.equal(caseMap.size, 0);
});

test("auto-repair ignores no-code duplicate owner blocks mostly covered by another parsed source", () => {
  const parsedSource = {
    ownerId: "uw-seattle-statistics:pathway:applied-statistics-track",
    ownerTitle: "Statistics - Applied Statistics Track",
    planId: "uw-seattle-statistics",
    pathwayId: "applied-statistics-track",
    campusId: "uw-seattle",
    ok: true,
    sourceUrl: "https://stat.uw.edu/academics/undergraduate/statistics-bs/major",
    sourceRole: "primary-degree-requirements",
    sourceRoleStatus: "primary",
    parsedUwCourseCodes: ["STAT 311", "STAT 390", "STAT 491", "MATH 124"],
    structuredUwCourseCodes: ["STAT 311", "STAT 390", "STAT 491", "MATH 124"],
    sourceOnlyUwCourseCodes: [],
    structuredOnlyUwCourseCodes: [],
    requirementCueLines: ["Applied Statistics track requirements"],
    qualitySignals: [],
  };
  const overviewSource = {
    ...parsedSource,
    sourceUrl: "https://stat.uw.edu/academics/undergraduate/statistics-bs/statistics-bs-tracks",
    parsedUwCourseCodes: [],
    structuredUwCourseCodes: [],
    structuredOnlyUwCourseCodes: ["STAT 311", "STAT 390", "STAT 491", "MATH 124", "MATH 134"],
    requirementCueLines: [],
  };
  const parseReport = { owners: [parsedSource, overviewSource] };
  const indexes = buildIndexes({ ownerAudit: null, parseReport, discoveryReport: null });
  const caseMap = new Map();

  collectParseReportCases(caseMap, parseReport, indexes);

  assert.equal(caseMap.size, 0);
});

test("auto-repair ignores low-coverage duplicate owner blocks covered by another parsed source", () => {
  const parsedSource = {
    ownerId: "uw-seattle-statistics:pathway:applied-statistics-track",
    ownerTitle: "Statistics - Applied Statistics Track",
    planId: "uw-seattle-statistics",
    pathwayId: "applied-statistics-track",
    campusId: "uw-seattle",
    ok: true,
    sourceUrl: "https://stat.uw.edu/academics/undergraduate/major/statistics-major",
    sourceRole: "primary-degree-requirements",
    sourceRoleStatus: "primary",
    parsedUwCourseCodes: ["STAT 311", "STAT 390", "STAT 491"],
    structuredUwCourseCodes: ["STAT 311", "STAT 390", "STAT 491"],
    sourceOnlyUwCourseCodes: [],
    structuredOnlyUwCourseCodes: [],
    requirementCueLines: ["Applied Statistics track requirements"],
    qualitySignals: [],
  };
  const overviewSource = {
    ...parsedSource,
    sourceUrl: "https://stat.uw.edu/academics/undergraduate/tracks",
    parsedUwCourseCodes: ["STAT 311"],
    structuredUwCourseCodes: ["STAT 311"],
    structuredOnlyUwCourseCodes: ["STAT 390", "STAT 491"],
    qualitySignals: [
      {
        severity: "warning",
        code: "large-structured-only-course-gap",
        message: "Most structured courses were not recovered from this source block.",
      },
    ],
  };
  const parseReport = { owners: [parsedSource, overviewSource] };
  const indexes = buildIndexes({ ownerAudit: null, parseReport, discoveryReport: null });
  const caseMap = new Map();

  collectParseReportCases(caseMap, parseReport, indexes);

  assert.equal(caseMap.size, 0);
});

test("auto-repair ignores stale discovery no-code signals when current parse has courses", () => {
  const parseOwner = {
    ownerId: "uw-tacoma-education:pathway:english-language-learners-dual-endorsement",
    ownerTitle: "Education (BA) - English Language Learners (ELL) Dual Endorsement Option",
    planId: "uw-tacoma-education",
    pathwayId: "english-language-learners-dual-endorsement",
    campusId: "uw-tacoma",
    ok: true,
    sourceUrl:
      "https://www.tacoma.uw.edu/sites/default/files/2026-02/bachelor-of-arts-in-education-with-dual-endorsement-ell.pdf",
    sourceRole: "primary-degree-requirements",
    sourceRoleStatus: "primary",
    parsedUwCourseCodes: ["TEDUC 290", "TEDUC 464"],
    structuredUwCourseCodes: ["TEDUC 290", "TEDUC 464"],
    sourceOnlyUwCourseCodes: [],
    structuredOnlyUwCourseCodes: [],
    requirementCueLines: ["Education Core Courses"],
    qualitySignals: [],
  };
  const discoveryReport = {
    owners: [],
    weakExistingOwners: [
      {
        ownerKey: parseOwner.ownerId,
        planId: parseOwner.planId,
        pathwayId: parseOwner.pathwayId,
        title: parseOwner.ownerTitle,
        campusId: parseOwner.campusId,
        existingPrimaryUrl: "https://www.tacoma.uw.edu/soe/bachelor-arts-education",
        suggestedPrimary: null,
        candidateCount: 2,
        reevaluationSignals: [
          {
            code: "no-parsed-uw-course-codes",
            reason: "Earlier primary source block produced zero UW course codes.",
          },
        ],
      },
    ],
  };
  const parseReport = { owners: [parseOwner] };
  const indexes = buildIndexes({ ownerAudit: null, parseReport, discoveryReport });
  const caseMap = new Map();

  collectDiscoveryCases(caseMap, discoveryReport, indexes);

  assert.equal(caseMap.size, 0);
});

test("auto-repair owner-audit cases prefer root causes over raw symptoms", () => {
  const ownerAudit = {
    owners: [
      {
        ownerId: "alpha:pathway:known-gap",
        planId: "alpha",
        pathwayId: "known-gap",
        title: "Alpha - Known Gap",
        rootIssues: [
          {
            severity: "warning",
            code: "known-source-gap-unresolved",
            message: "Owner is intentionally hidden behind a generated source-gap entry.",
          },
        ],
        symptomIssues: [
          {
            severity: "error",
            code: "missing-primary-source",
            message: "No primary degree-requirements source URL is registered for this owner.",
          },
          {
            severity: "error",
            code: "missing-source-manifest-entries",
            message: "No source manifest entries were found for this owner.",
          },
        ],
      },
    ],
  };
  const indexes = buildIndexes({ ownerAudit, parseReport: null, discoveryReport: null });
  const caseMap = new Map();

  collectOwnerAuditCases(caseMap, ownerAudit, indexes);

  const cases = [...caseMap.values()];
  assert.equal(cases.length, 1);
  assert.equal(cases[0].category, "source-missing");
  assert.equal(cases[0].severity, "warning");
  assert.deepEqual(
    cases[0].evidence.map((entry) => entry.code),
    ["known-source-gap-unresolved"]
  );
});

test("auto-repair owner-audit cases fall back to symptoms without root causes", () => {
  const ownerAudit = {
    owners: [
      {
        ownerId: "alpha",
        planId: "alpha",
        title: "Alpha",
        rootIssues: [],
        symptomIssues: [
          {
            severity: "error",
            code: "missing-primary-source",
            message: "No primary degree-requirements source URL is registered for this owner.",
          },
        ],
      },
    ],
  };
  const indexes = buildIndexes({ ownerAudit, parseReport: null, discoveryReport: null });
  const caseMap = new Map();

  collectOwnerAuditCases(caseMap, ownerAudit, indexes);

  const cases = [...caseMap.values()];
  assert.equal(cases.length, 1);
  assert.equal(cases[0].category, "source-missing");
  assert.equal(cases[0].severity, "error");
  assert.deepEqual(
    cases[0].evidence.map((entry) => entry.code),
    ["missing-primary-source"]
  );
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
