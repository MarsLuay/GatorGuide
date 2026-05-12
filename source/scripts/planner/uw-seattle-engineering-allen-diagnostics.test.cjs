const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const { auditOwners } = require("./fixtures/uw-seattle-engineering-allen-diagnostics.fixture.cjs");

const RUN_DIAGNOSTICS =
  process.env.TRANSFER_PLANNER_RUN_UWS_ENGINEERING_ALLEN_DIAGNOSTICS === "1";
const diagnosticTest = RUN_DIAGNOSTICS ? test : test.skip;
const FOCUSED_PLAN_ID =
  process.env.TRANSFER_PLANNER_UWS_ENGINEERING_ALLEN_PLAN_ID?.trim() ?? "";
const diagnosticOwners = FOCUSED_PLAN_ID
  ? auditOwners.filter((owner) => owner.planId === FOCUSED_PLAN_ID)
  : auditOwners;

const SOURCE_ROOT = path.resolve(__dirname, "..", "..");
const AUDIT_SCRIPT = path.join(
  SOURCE_ROOT,
  "scripts",
  "planner",
  "audit-transfer-planner-source-backed-coverage.cjs"
);
const AUDIT_JSON_PATH = path.join(
  SOURCE_ROOT,
  ".tmp",
  "transfer-planner-source-backed-coverage-audit.json"
);

const ISSUE_ROW_COLLECTIONS = [
  "requirementCoverageRows",
  "sourceScopeAuditRows",
  "generatedSourceSeedAuditRows",
  "generatedShapeAuditRows",
  "requirementShapeAuditRows",
  "electiveApprovedListShapeAuditRows",
  "creditCategoryShapeAuditRows",
  "categoryMappingAuditRows",
  "programApprovedFilterAuditRows",
  "sequencePathwayShapeAuditRows",
  "singleEquivalencyAuditRows",
  "runtimeOptionResolutionAuditRows",
  "runtimeCompoundSequenceAuditRows",
  "requiredCoverageSequenceSuppressionAuditRows",
  "runtimeCompoundSchedulingAuditRows",
  "parserOptionExtractionAuditRows",
  "parserCreditBucketAuditRows",
  "parserCategoryOptionAuditRows",
  "parserPrerequisiteFilterAuditRows",
  "parserSequenceChoiceAuditRows",
  "parserExtractionRegressionRows",
  "sourceScopeRegressionRows",
];

function firstNonEmpty(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value != null && String(value).trim()) {
      return value;
    }
  }
  return null;
}

function issueValue(row) {
  const value = firstNonEmpty(row, ["issueType", "issue"]);
  return value && value !== "none" ? value : null;
}

function collectIssueRows(report) {
  const issues = [];

  for (const collection of ISSUE_ROW_COLLECTIONS) {
    for (const row of report[collection] ?? []) {
      const issue = issueValue(row);
      if (!issue) {
        continue;
      }

      issues.push({
        collection,
        issue,
        ownerId: row.ownerId ?? null,
        sourceRole: row.sourceRole ?? null,
        sourceUrl: row.sourceUrl ?? null,
        requirement:
          firstNonEmpty(row, [
            "uwRequirementLabel",
            "requirementTitle",
            "requirementCourse",
            "courseCode",
            "groupId",
            "id",
          ]) ?? null,
        detail: row.copyOnlyDebugText ?? null,
      });
    }
  }

  for (const check of report.regressionChecks ?? []) {
    if (check.status !== "failed") {
      continue;
    }

    issues.push({
      collection: "regressionChecks",
      issue: check.issueType ?? "failed-regression-check",
      ownerId: check.ownerId ?? null,
      sourceRole: null,
      sourceUrl: null,
      requirement: check.label ?? null,
      detail: (check.details ?? []).join("; ") || null,
    });
  }

  return issues;
}

function runSourceBackedAudit(planId) {
  const result = spawnSync(
    process.execPath,
    [AUDIT_SCRIPT, "--target-plan-id", planId, "--report-only"],
    {
      cwd: SOURCE_ROOT,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 80,
    }
  );

  assert.equal(
    result.status,
    0,
    [
      `Expected source-backed audit CLI to run for ${planId}.`,
      result.stdout,
      result.stderr,
    ]
      .filter(Boolean)
      .join("\n")
  );

  return JSON.parse(fs.readFileSync(AUDIT_JSON_PATH, "utf8"));
}

function formatIssues(issues) {
  return issues
    .map((issue) =>
      [
        issue.collection,
        issue.issue,
        issue.ownerId,
        issue.requirement,
        issue.sourceRole,
        issue.sourceUrl,
      ]
        .filter(Boolean)
        .join(" | ")
    )
    .join("\n");
}

test("UW Seattle Engineering and Allen diagnostic fixture covers the requested owners", () => {
  assert.deepEqual(
    auditOwners.map((owner) => owner.planId),
    [
      "uw-seattle-computer-science",
      "uw-seattle-computer-engineering",
      "uw-seattle-materials-science-engineering",
      "uw-seattle-aeronautics-astronautics",
      "uw-seattle-civil-engineering",
      "uw-seattle-environmental-engineering",
      "uw-seattle-chemical-engineering",
      "uw-seattle-electrical-computer-engineering",
      "uw-seattle-mechanical-engineering",
      "uw-seattle-industrial-systems-engineering",
      "uw-seattle-bioengineering",
      "uw-seattle-human-centered-design-engineering",
    ]
  );

  assert.equal(
    auditOwners.every((owner) => owner.officialSources.length > 0),
    true
  );

  if (FOCUSED_PLAN_ID) {
    assert.equal(
      diagnosticOwners.length,
      1,
      `Unknown focused UW Seattle Engineering/Allen plan id: ${FOCUSED_PLAN_ID}`
    );
  }
});

for (const owner of diagnosticOwners) {
  diagnosticTest(`${owner.title} source, generated, and runtime rows agree`, () => {
    const report = runSourceBackedAudit(owner.planId);
    const issues = collectIssueRows(report);

    assert.deepEqual(
      issues,
      [],
      [
        `${owner.title} should have no source/parser/generator/runtime disagreements.`,
        "Known current mismatch summary:",
        ...(owner.knownMismatchSummary.length
          ? owner.knownMismatchSummary.map((entry) => `- ${entry}`)
          : ["- No known mismatches from this audit pass."]),
        "Actual audit issues:",
        formatIssues(issues) || "- none",
      ].join("\n")
    );
  });
}
