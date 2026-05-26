const assert = require("node:assert/strict");
const test = require("node:test");

const fingerprints = require("./build-transfer-planner-source-fingerprints.cjs");

function req(overrides = {}) {
  return {
    ownerId: "uw-seattle-computer-science",
    ownerTitle: "Computer Science",
    planId: "uw-seattle-computer-science",
    pathwayId: null,
    campusId: "uw-seattle",
    parserType: "pdf-degree-sheet",
    sourceUrl: "https://www.cs.washington.edu/academics/ugrad/curriculum/CS_2025.pdf",
    sourceLabel: "CS degree requirements 2025",
    sourceRole: "primary-degree-requirements",
    sourceRoleStatus: "primary",
    canCreateSchedulableRows: true,
    canCreateRequiredRows: true,
    canCreateScheduleRows: true,
    supportOnly: false,
    nonSchedulable: false,
    ok: true,
    parseConfidence: "high",
    parsedUwCourseCodeCount: 1,
    sourceOnlyUwCourseCodeCount: 0,
    structuredOnlyUwCourseCodeCount: 0,
    approvedFilterUwCourseCodeCount: 0,
    electiveListUwCourseCodeCount: 0,
    supportOnlyUwCourseCodeCount: 0,
    supportListCount: 0,
    extractedHeadingCount: 2,
    requirementCueLineCount: 4,
    chooseStatementCount: 1,
    qualitySignalCodes: [],
    qualityWarningCount: 0,
    qualityNoteCount: 0,
    requirementFingerprint: "previous",
    parsedUwCourseCodes: ["CSE 121"],
    sourceOnlyUwCourseCodes: [],
    structuredOnlyUwCourseCodes: [],
    approvedFilterUwCourseCodes: [],
    electiveListUwCourseCodes: [],
    supportOnlyUwCourseCodes: [],
    ...overrides,
  };
}

function classifyMany(previousEntries, currentEntries) {
  const previousRequirementSourceFingerprints = (previousEntries ?? []).filter(Boolean);
  const currentRequirementSourceFingerprints = (currentEntries ?? []).filter(Boolean);
  const previousFingerprints = {
    sourceFingerprints: [],
    requirementSourceFingerprints: previousRequirementSourceFingerprints,
  };
  const requirementDiff = fingerprints.compareFingerprintsForTest(
    previousFingerprints.requirementSourceFingerprints,
    currentRequirementSourceFingerprints,
    "ownerId",
    "requirementFingerprint"
  );

  return fingerprints.buildSourceChangeClassificationReportForTest({
    previousFingerprints,
    sourceFingerprints: [],
    requirementSourceFingerprints: currentRequirementSourceFingerprints,
    sourceDiff: { added: [], changed: [], unchanged: [], removed: [] },
    requirementDiff,
  });
}

function classify(previousEntry, currentEntry) {
  return classifyMany(previousEntry ? [previousEntry] : [], currentEntry ? [currentEntry] : []);
}

test("source change classifier compares duplicate owner fingerprints by source URL", () => {
  const primary = req({
    ownerId: "uw-example-multi-source",
    planId: "uw-example-multi-source",
    sourceUrl: "https://example.edu/program/requirements",
    requirementFingerprint: "primary-source-fingerprint",
    parsedUwCourseCodes: ["EXAM 101"],
    parsedUwCourseCodeCount: 1,
  });
  const supplemental = req({
    ...primary,
    sourceUrl: "https://example.edu/program/supplemental-list",
    sourceRole: "approved-course-list",
    sourceRoleStatus: "support",
    canCreateSchedulableRows: false,
    canCreateRequiredRows: false,
    canCreateScheduleRows: false,
    supportOnly: true,
    requirementFingerprint: "supplemental-source-fingerprint",
    parsedUwCourseCodes: ["EXAM 201"],
    parsedUwCourseCodeCount: 1,
  });
  const previous = [primary, supplemental];
  const current = [primary, supplemental];
  const requirementDiff = fingerprints.compareFingerprintsForTest(
    previous,
    current,
    fingerprints.getRequirementFingerprintCompareKeyForTest,
    "requirementFingerprint"
  );
  const report = fingerprints.buildSourceChangeClassificationReportForTest({
    previousFingerprints: {
      sourceFingerprints: [],
      requirementSourceFingerprints: previous,
    },
    sourceFingerprints: [],
    requirementSourceFingerprints: current,
  });

  assert.equal(requirementDiff.changed.length, 0);
  assert.equal(requirementDiff.added.length, 0);
  assert.equal(requirementDiff.removed.length, 0);
  assert.equal(report.totalChangeCount, 0);
});

test("source fingerprints drop stale owner ids from mismatched source-link snapshots", () => {
  const requirementOwners = [
    req({
      ownerId: "uw-tacoma-computer-engineering",
      ownerTitle: "Computer Engineering",
      planId: "uw-tacoma-computer-engineering",
      campusId: "uw-tacoma",
      sourceUrl: "https://www.tacoma.uw.edu/set/programs/undergrad/cengr",
      sourceLabel: "Computer Engineering",
    }),
    req({
      ownerId: "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-arts",
      ownerTitle: "Computer Science and Systems - Bachelor of Arts",
      planId: "uw-tacoma-computer-science-and-systems",
      pathwayId: "bachelor-of-arts",
      campusId: "uw-tacoma",
      sourceUrl: "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
      sourceLabel: "UW Tacoma Computer Science and Systems BA degree requirements",
    }),
    req({
      ownerId: "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-science",
      ownerTitle: "Computer Science and Systems - Bachelor of Science",
      planId: "uw-tacoma-computer-science-and-systems",
      pathwayId: "bachelor-of-science",
      campusId: "uw-tacoma",
      sourceUrl: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
      sourceLabel: "UW Tacoma Computer Science and Systems BS degree requirements",
    }),
  ];
  const report = fingerprints.buildReport(
    {
      generatedAt: "test",
      sources: [
        {
          url: "https://www.tacoma.uw.edu/set/programs/undergrad/cengr",
          finalUrl: "https://www.tacoma.uw.edu/set/programs/undergrad/cengr",
          labels: ["Computer Engineering"],
          ownerIds: [
            "uw-tacoma-computer-engineering",
            "uw-tacoma-computer-science-and-systems",
            "uw-tacoma-computer-science-and-systems::bachelor-of-science",
          ],
          kinds: ["major", "pathway"],
          ok: true,
        },
        {
          url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
          finalUrl: "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
          labels: ["UW Tacoma Computer Science and Systems BA degree requirements"],
          ownerIds: [
            "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-arts",
            "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-science",
          ],
          kinds: ["pathway"],
          ok: true,
        },
      ],
    },
    {
      generatedAt: "test",
      owners: requirementOwners,
    },
    { sourceFingerprints: [], requirementSourceFingerprints: [] }
  );

  const cengr = report.sourceFingerprints.find((entry) =>
    String(entry.url).includes("/undergrad/cengr")
  );
  const cssBa = report.sourceFingerprints.find((entry) =>
    String(entry.url).includes("/undergrad/css/ba")
  );

  assert.deepEqual(cengr.ownerIds, ["uw-tacoma-computer-engineering"]);
  assert.ok(
    cssBa.ownerIds.includes(
      "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-arts"
    )
  );
  assert.equal(
    cssBa.ownerIds.includes(
      "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-science"
    ),
    false
  );
});

test("source change classifier detects new course additions", () => {
  const report = classify(
    req({ requirementFingerprint: "a", parsedUwCourseCodes: ["CSE 121"], parsedUwCourseCodeCount: 1 }),
    req({
      requirementFingerprint: "b",
      parsedUwCourseCodes: ["CSE 121", "CSE 122"],
      parsedUwCourseCodeCount: 2,
    })
  );
  const change = report.changes.find((entry) => entry.changeType === "new-course-added");

  assert.ok(change);
  assert.deepEqual(change.courseDelta.added, ["CSE 122"]);
  assert.ok(change.recommendedAction.includes("equivalency-mapping-refresh"));
});

test("source change classifier detects course removals", () => {
  const report = classify(
    req({
      requirementFingerprint: "a",
      parsedUwCourseCodes: ["MSE 170", "MSE 220"],
      parsedUwCourseCodeCount: 2,
      planId: "uw-seattle-materials-science-engineering",
      ownerId: "uw-seattle-materials-science-engineering",
    }),
    req({
      requirementFingerprint: "b",
      parsedUwCourseCodes: ["MSE 170"],
      parsedUwCourseCodeCount: 1,
      planId: "uw-seattle-materials-science-engineering",
      ownerId: "uw-seattle-materials-science-engineering",
    })
  );
  const change = report.changes.find((entry) => entry.changeType === "course-removed");

  assert.ok(change);
  assert.deepEqual(change.courseDelta.removed, ["MSE 220"]);
  assert.ok(change.recommendedAction.includes("verify-alternate-official-support"));
});

test("source change classifier detects structural parser drift", () => {
  const report = classify(
    req({ requirementFingerprint: "a", requirementCueLineCount: 4, qualitySignalCodes: [] }),
    req({
      requirementFingerprint: "b",
      requirementCueLineCount: 12,
      qualitySignalCodes: ["material-source-structured-drift"],
      qualityWarningCount: 1,
    })
  );
  const change = report.changes.find((entry) => entry.changeType === "source-structure-changed");

  assert.ok(change);
  assert.equal(change.actionStatus, "needs-parser-rule");
  assert.ok(change.recommendedAction.includes("targeted-parser-recovery"));
});

test("source change classifier treats child-covered parent overview drift as generated evidence", () => {
  const planId = "uw-tacoma-ethnic-gender-and-labor-studies";
  const previousParent = req({
    ownerId: planId,
    planId,
    campusId: "uw-tacoma",
    sourceUrl: "https://www.tacoma.uw.edu/sias/socs/ethnic-gender-and-labor-studies",
    parserType: "html-overview-page",
    parsedUwCourseCodes: [],
    parsedUwCourseCodeCount: 0,
    requirementFingerprint: "parent-before",
    qualitySignalCodes: ["no-parsed-uw-course-codes"],
    qualityWarningCount: 1,
  });
  const currentParent = req({
    ...previousParent,
    requirementFingerprint: "parent-after",
    qualitySignalCodes: ["large-structured-only-course-gap", "material-source-structured-drift"],
    qualityWarningCount: 2,
  });
  const child = req({
    ownerId: `${planId}:pathway:ethnic-studies-option`,
    ownerTitle: "Ethnic, Gender and Labor Studies (BA) - Ethnic Studies Option",
    planId,
    pathwayId: "ethnic-studies-option",
    campusId: "uw-tacoma",
    sourceUrl: "https://www.tacoma.uw.edu/sias/socs/ethnic-studies-option",
    parsedUwCourseCodes: ["TEGL 101", "TSOC 439"],
    parsedUwCourseCodeCount: 2,
    requirementFingerprint: "child-stable",
  });

  const report = classifyMany([previousParent, child], [currentParent, child]);
  const change = report.changes.find(
    (entry) => entry.ownerId === planId && entry.changeType === "source-structure-changed"
  );

  assert.ok(change);
  assert.equal(change.actionStatus, "generated-evidence-only");
  assert.equal(change.autoApplied, true);
  assert.ok(change.recommendedAction.includes("preserve-parent-overview-evidence"));
  assert.deepEqual(change.childPathwayCoverage.childOwnerIds, [
    `${planId}:pathway:ethnic-studies-option`,
  ]);
});

test("source change classifier detects current-year sibling promotion", () => {
  const report = classify(
    req({
      requirementFingerprint: "a",
      sourceUrl: "https://www.cs.washington.edu/academics/ugrad/curriculum/CS_2025.pdf",
      sourceLabel: "CS degree requirements 2025",
      parsedUwCourseCodeCount: 2,
      parsedUwCourseCodes: ["CSE 121", "CSE 122"],
    }),
    req({
      requirementFingerprint: "b",
      sourceUrl: "https://www.cs.washington.edu/academics/ugrad/curriculum/CS_2026.pdf",
      sourceLabel: "CS degree requirements 2026",
      parsedUwCourseCodeCount: 2,
      parsedUwCourseCodes: ["CSE 121", "CSE 122"],
    })
  );
  const change = report.changes.find((entry) => entry.changeType === "current-year-sibling-found");

  assert.ok(change);
  assert.equal(change.actionStatus, "auto-applied");
  assert.ok(change.recommendedAction.includes("high-confidence-source-promotion"));
});

test("source change classifier detects weak overview regression", () => {
  const report = classify(
    req({
      requirementFingerprint: "a",
      parseConfidence: "high",
      parsedUwCourseCodeCount: 3,
      parsedUwCourseCodes: ["TCOM 201", "TCOM 230", "TCOM 320"],
    }),
    req({
      requirementFingerprint: "b",
      parseConfidence: "low",
      parsedUwCourseCodeCount: 0,
      parsedUwCourseCodes: [],
      qualitySignalCodes: ["no-parsed-uw-course-codes", "low-confidence-parsed-source"],
      qualityWarningCount: 2,
    })
  );
  const change = report.changes.find((entry) => entry.changeType === "source-became-weak-or-overview");

  assert.ok(change);
  assert.equal(change.actionStatus, "needs-discovery-rule");
  assert.ok(change.recommendedAction.includes("targeted-source-discovery"));
});

test("support-only source changes regenerate filters without required-row scheduling", () => {
  const previous = req({
    requirementFingerprint: "a",
    sourceRole: "approved-course-list",
    sourceRoleStatus: "support",
    canCreateSchedulableRows: false,
    canCreateRequiredRows: false,
    canCreateScheduleRows: false,
    supportOnly: true,
    parsedUwCourseCodes: ["PHYS 121"],
    parsedUwCourseCodeCount: 1,
    approvedFilterUwCourseCodes: ["PHYS 121"],
    approvedFilterUwCourseCodeCount: 1,
  });
  const current = req({
    ...previous,
    requirementFingerprint: "b",
    parsedUwCourseCodes: ["PHYS 121", "CHEM 142"],
    parsedUwCourseCodeCount: 2,
    approvedFilterUwCourseCodes: ["PHYS 121", "CHEM 142"],
    approvedFilterUwCourseCodeCount: 2,
  });
  const report = classify(previous, current);
  const change = report.changes.find((entry) => entry.changeType === "support-only-source-changed");

  assert.ok(change);
  assert.equal(change.actionStatus, "generated-evidence-only");
  assert.ok(change.recommendedAction.includes("preserve-support-only-no-required-rows"));
  assert.equal(change.recommendedAction.includes("student-runtime-regeneration"), false);
});
