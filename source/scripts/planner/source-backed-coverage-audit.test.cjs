const assert = require("node:assert/strict");
const test = require("node:test");

const sourceBackedCoverageAudit = require("./source-backed-coverage-actionability.cjs");

test("Source-backed coverage audit classifies blocking maintainer failures", () => {
  const cases = [
    {
      name: "parsed source course missing from generated runtime",
      row: {
        issueType: "missing-detected-course",
        ownerId: "uw-seattle-computer-engineering",
        generatedRuntimeRow: false,
        visibleInTransferOnlyQuarterPlan: false,
        uwRequirementLabel: "BIOL 180",
      },
      expectedClass: "source-course-parsed-not-generated",
      expectedLayer: "generator",
      expectedFixPath: /generate-transfer-planner-student-runtime\.cjs/,
    },
    {
      name: "generated row exists but is hidden from students",
      row: {
        issueType: "missing-detected-course",
        ownerId: "uw-seattle-computer-engineering",
        generatedRuntimeRow: true,
        visibleInTransferOnlyQuarterPlan: false,
        hiddenInternalReason: "Known Green River equivalent is generated but is not visible",
      },
      expectedClass: "generated-row-exists-but-not-visible",
      expectedLayer: "runtime",
      expectedFixPath: /transfer-planner\.service\.ts/,
    },
    {
      name: "support-only approved list scheduled as required",
      row: {
        issue: "approved-list-generated-required-row",
        ownerId: "uw-seattle-computer-engineering",
        sourceRole: "approved-course-list",
        generatedArtifact: "source/constants/transfer-planner-source/student-runtime.generated.ts",
      },
      expectedClass: "support-only-course-scheduled-as-required",
      expectedLayer: "generator",
      expectedFixPath: /generate-transfer-planner-student-runtime\.cjs/,
    },
    {
      name: "credit bucket lost or flattened",
      row: {
        issue: "flattened-credit-bucket",
        ownerId: "uw-seattle-computer-engineering",
        requirementTitle: "Natural Science",
      },
      expectedClass: "credit-bucket-lost-or-flattened",
      expectedLayer: "generator",
      expectedFixPath: /generate-transfer-planner-student-runtime\.cjs/,
    },
    {
      name: "placeholder scheduled as false-required sibling",
      row: {
        issue: "placeholder-atom-scheduled",
        ownerId: "grc-associate-stem-engineering-associate-in-science-transfer-track-2",
        requirementTitle: "Choose one placeholder",
        scheduled: true,
      },
      expectedClass: "placeholder-scheduled-as-false-required",
      expectedLayer: "runtime",
      expectedFixPath: /transfer-planner\.service\.ts/,
    },
    {
      name: "option group collapsed to a single course",
      row: {
        issue: "flattened-option-group",
        ownerId: "uw-seattle-materials-science-engineering",
        requirementTitle: "MATH 207 or AMATH 351",
      },
      expectedClass: "option-group-collapsed-to-single-course",
      expectedLayer: "generator",
      expectedFixPath: /generate-transfer-planner-student-runtime\.cjs/,
    },
    {
      name: "visible row lacks source evidence",
      row: {
        issue: "generated-row-without-primary-source",
        ownerId: "uw-seattle-computer-science",
        requirementCourse: "PHYS& 222",
      },
      expectedClass: "visible-row-lacks-source-evidence",
      expectedLayer: "generator",
      expectedFixPath: /generate-transfer-planner-student-runtime\.cjs/,
    },
    {
      name: "GRC equivalent missing or over-selected",
      row: {
        issue: "missing-equivalency",
        ownerId: "uw-seattle-computer-engineering",
        requirementTitle: "CHEM 142",
      },
      expectedClass: "equivalent-grc-course-missing-or-over-selected",
      expectedLayer: "mapping",
      expectedFixPath: /parse-transfer-planner-equivalency-guide\.cjs/,
    },
  ];

  for (const testCase of cases) {
    const result = sourceBackedCoverageAudit.buildActionableAuditIssueMetadata(
      testCase.row,
      "unit-test"
    );
    assert.equal(result.blockingGate, sourceBackedCoverageAudit.SOURCE_BACKED_COVERAGE_GATE_LABEL);
    assert.equal(result.actionableIssueClass, testCase.expectedClass, testCase.name);
    assert.equal(result.suspectedLayer, testCase.expectedLayer, testCase.name);
    assert.match(result.recommendedFixPath, testCase.expectedFixPath, testCase.name);
    assert.ok(result.recommendedNonManualFix.includes("Fix"), testCase.name);
    assert.doesNotMatch(result.recommendedFixPath, /generated-major-plans\.ts/, testCase.name);
  }
});
