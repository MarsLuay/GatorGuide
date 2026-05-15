/* global __dirname */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const {
  SOURCE_BACKED_AUDIT_ROW_COLLECTIONS,
  getActionableIssueClass,
  getRowIssueType,
  hasAuditIssue,
} = require("./source-backed-coverage-actionability.cjs");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");

const REPORTS = {
  sourceBacked: path.resolve(TMP_DIR, "transfer-planner-source-backed-coverage-audit.json"),
  repairQueue: path.resolve(TMP_DIR, "transfer-planner-repair-queue.json"),
  parse: path.resolve(TMP_DIR, "transfer-planner-requirement-source-parse-report.json"),
  sourcePipeline: path.resolve(TMP_DIR, "transfer-planner-source-pipeline-validation.json"),
  sourceGaps: path.resolve(TMP_DIR, "transfer-planner-source-gaps.json"),
  generatedRegistry: path.resolve(TMP_DIR, "transfer-planner-generated-registry-audit.json"),
  mapping: path.resolve(TMP_DIR, "transfer-planner-mapping-audit.json"),
  autoRepair: path.resolve(TMP_DIR, "transfer-planner-auto-repair-plan.json"),
};

const REQUIRED_RELEASE_REPORT_KEYS = [
  "sourceBacked",
  "repairQueue",
  "parse",
  "sourcePipeline",
  "sourceGaps",
  "generatedRegistry",
  "mapping",
  "autoRepair",
];

const MODES = {
  "course-source-coverage": {
    json: "transfer-planner-course-source-coverage.json",
    md: "transfer-planner-course-source-coverage.md",
    title: "Transfer Planner Course Source Coverage",
  },
  "requirement-source-fidelity": {
    json: "transfer-planner-requirement-source-fidelity.json",
    md: "transfer-planner-requirement-source-fidelity.md",
    title: "Transfer Planner Requirement Source Fidelity",
  },
  "student-visible-facts": {
    json: "transfer-planner-student-visible-facts.json",
    md: "transfer-planner-student-visible-facts.md",
    title: "Transfer Planner Student-Visible Facts",
  },
  "release-readiness": {
    json: "transfer-planner-release-readiness.json",
    md: "transfer-planner-release-readiness.md",
    title: "Transfer Planner Release Readiness",
  },
};

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, "/");
}

function compactText(value, maxLength = 260) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(`${filePath}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(`${filePath}.tmp`, filePath);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(`${filePath}.tmp`, value.endsWith("\n") ? value : `${value}\n`);
  fs.renameSync(`${filePath}.tmp`, filePath);
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) {
    const key = value ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || String(left.key).localeCompare(String(right.key)));
}

function isStudentVisible(row) {
  return (
    row?.visibleInTransferOnlyQuarterPlan === true ||
    row?.visibleInTransferOnlyPlan === true ||
    row?.visibleInPlan === true ||
    row?.scheduled === true
  );
}

function getPlanContext(row) {
  const existing = row?.planContext ?? {};
  const ownerId = row?.ownerId ?? existing.ownerId ?? "unknown";
  const [ownerPlanId, ownerPathwayId] = String(ownerId).split(":pathway:");
  return {
    ownerId,
    planId: row?.planId ?? row?.majorId ?? existing.planId ?? ownerPlanId ?? null,
    pathwayId: row?.pathwayId ?? existing.pathwayId ?? ownerPathwayId ?? null,
    campusId: row?.campusId ?? existing.campusId ?? null,
  };
}

function collectSourceBackedBlockers(sourceBacked) {
  const blockers = [];
  for (const collectionName of SOURCE_BACKED_AUDIT_ROW_COLLECTIONS) {
    const rows = sourceBacked?.[collectionName] ?? [];
    rows.forEach((row, index) => {
      if (!hasAuditIssue(row)) {
        return;
      }
      const context = getPlanContext(row);
      blockers.push({
        id: `${collectionName}:${index}`,
        auditCollection: collectionName,
        issueType: row.issueTypeNormalized ?? getRowIssueType(row),
        actionableIssueClass: row.actionableIssueClass ?? getActionableIssueClass(row),
        suspectedLayer: row.suspectedLayer ?? "unknown",
        studentVisible: isStudentVisible(row),
        ownerId: context.ownerId,
        planId: context.planId,
        pathwayId: context.pathwayId,
        campusId: context.campusId,
        sourceUrl: row.auditSourceUrl ?? row.sourceUrl ?? row.uwSourceUrl ?? row.primarySourceUrl ?? null,
        sourceRole: row.auditSourceRole ?? row.detectedSourceRole ?? row.sourceRole ?? null,
        requirement: compactText(
          row.uwRequirementLabel ??
            row.requirementTitle ??
            row.requirement ??
            row.rawLine ??
            row.rawText ??
            row.copyOnlyDebugText
        ),
        courseCodes: [
          ...(row.parsedUwCourseCodes ?? []),
          ...(row.matchedGrcEquivalents ?? []),
          ...(row.courseCodesExtracted ?? []),
          row.courseCode,
          row.uwCourse,
          row.grcCourse,
          row.uwEquivalent,
        ].filter(Boolean),
        evidence: compactText(row.parsedSourceEvidence ?? row.copyOnlyDebugText ?? row.reason, 420),
      });
    });
  }
  return blockers;
}

function summarizeReportStatus(report, issueKey = "issueCount") {
  if (!report) {
    return { present: false, outcome: "missing", issueCount: null };
  }
  const summary = report.summary ?? report;
  return {
    present: true,
    outcome: report.outcome ?? summary.outcome ?? "unknown",
    issueCount:
      summary.blockingGateIssueCount ??
      summary[issueKey] ??
      report.issueCount ??
      report.errorCaseCount ??
      null,
  };
}

function getMissingRequiredReportKeys(inputs) {
  return REQUIRED_RELEASE_REPORT_KEYS.filter((key) => !inputs[key]);
}

function getSourcePipelineFailures(sourcePipeline) {
  return (sourcePipeline?.checks ?? [])
    .filter((check) => check.status === "failed" || check.passed === false)
    .map((check) => ({
      id: check.id,
      label: check.label,
      details: (check.details ?? []).map((detail) => compactText(detail, 600)),
    }));
}

function buildCourseSourceCoverage(inputs) {
  const blockers = collectSourceBackedBlockers(inputs.sourceBacked);
  const courseRelevant = blockers.filter((blocker) =>
    [
      "equivalent-grc-course-missing-or-over-selected",
      "source-course-parsed-not-generated",
      "generated-row-exists-but-not-visible",
      "primary-required-course-missing-from-runtime",
      "support-only-course-scheduled-as-required",
    ].includes(blocker.actionableIssueClass)
  );
  const studentVisibleUnsupported = courseRelevant.filter((blocker) => blocker.studentVisible);
  const singleEquivalencyIssues = (inputs.sourceBacked?.singleEquivalencyAuditRows ?? []).filter(hasAuditIssue);
  const generatedSeedIssues = (inputs.sourceBacked?.generatedSourceSeedAuditRows ?? []).filter(hasAuditIssue);
  const outcome =
    studentVisibleUnsupported.length || singleEquivalencyIssues.length || generatedSeedIssues.length
      ? "blocked"
      : "passed";
  return {
    generatedAt: new Date().toISOString(),
    outcome,
    summary: {
      courseRelevantBlockerCount: courseRelevant.length,
      studentVisibleUnsupportedCourseFactCount: studentVisibleUnsupported.length,
      singleEquivalencyIssueCount: singleEquivalencyIssues.length,
      generatedSourceSeedIssueCount: generatedSeedIssues.length,
      countsByCampus: countBy(courseRelevant.map((blocker) => blocker.campusId ?? "unknown")),
      countsByIssueType: countBy(courseRelevant.map((blocker) => blocker.issueType)),
    },
    studentVisibleUnsupported: studentVisibleUnsupported.slice(0, 250),
    blockers: courseRelevant,
  };
}

function buildRequirementSourceFidelity(inputs) {
  const blockers = collectSourceBackedBlockers(inputs.sourceBacked);
  const fidelityBlockers = blockers.filter((blocker) =>
    [
      "source-role-misclassified",
      "option-group-collapsed-to-single-course",
      "credit-bucket-lost-or-flattened",
      "support-only-course-scheduled-as-required",
    ].includes(blocker.actionableIssueClass)
  );
  const parserCollections = blockers.filter((blocker) =>
    [
      "parserPrerequisiteFilterAuditRows",
      "parserOptionExtractionAuditRows",
      "parserCreditBucketAuditRows",
      "parserCategoryOptionAuditRows",
      "parserSequenceChoiceAuditRows",
      "parserExtractionRegressionRows",
      "sourceScopeRegressionRows",
    ].includes(blocker.auditCollection)
  );
  const parseReport = inputs.parse ?? {};
  const parseFailureRows = (parseReport.owners ?? parseReport.sources ?? parseReport.blocks ?? []).filter(
    (row) => row.parseSuccess === false || row.status === "failed"
  );
  const failedCount = Number.isFinite(parseReport.failedCount) ? parseReport.failedCount : 0;
  const parseFailureCount = Math.max(failedCount, parseFailureRows.length);
  const outcome =
    fidelityBlockers.length || parserCollections.length || parseFailureCount ? "blocked" : "passed";
  return {
    generatedAt: new Date().toISOString(),
    outcome,
    summary: {
      fidelityBlockerCount: fidelityBlockers.length,
      parserAuditBlockerCount: parserCollections.length,
      parseFailureCount,
      countsByIssueType: countBy(fidelityBlockers.map((blocker) => blocker.issueType)),
      countsByCollection: countBy(fidelityBlockers.map((blocker) => blocker.auditCollection)),
    },
    fidelityBlockers,
    parserAuditBlockers: parserCollections.slice(0, 500),
    parseFailures: parseFailureRows.slice(0, 50),
  };
}

function buildStudentVisibleFacts(inputs) {
  const blockers = collectSourceBackedBlockers(inputs.sourceBacked);
  const visibleBlockers = blockers.filter((blocker) => blocker.studentVisible);
  const sourceGapEntries = inputs.sourceGaps?.entries ?? [];
  const outcome = visibleBlockers.length || sourceGapEntries.length ? "blocked" : "passed";
  return {
    generatedAt: new Date().toISOString(),
    outcome,
    summary: {
      studentVisibleUnsupportedFactCount: visibleBlockers.length,
      hiddenSourceGapOwnerCount: sourceGapEntries.length,
      countsByActionableClass: countBy(visibleBlockers.map((blocker) => blocker.actionableIssueClass)),
      countsByIssueType: countBy(visibleBlockers.map((blocker) => blocker.issueType)),
      countsByCampus: countBy(visibleBlockers.map((blocker) => blocker.campusId ?? "unknown")),
    },
    studentVisibleUnsupportedFacts: visibleBlockers,
    hiddenSourceGaps: sourceGapEntries,
  };
}

function runCommand(command, args, options = {}) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: options.timeoutMs ?? 120000,
    maxBuffer: 1024 * 1024 * 20,
  });
  return {
    command: [command, ...args].join(" "),
    startedAt,
    finishedAt: new Date().toISOString(),
    status: result.status,
    signal: result.signal,
    timedOut: result.error?.code === "ETIMEDOUT",
    stdoutTail: compactText(result.stdout, 1200),
    stderrTail: compactText(result.stderr, 1200),
  };
}

function buildReleaseReadiness(inputs, options = {}) {
  const commands = [];
  if (options.runChecks) {
    commands.push(runCommand("npm", ["run", "planner:parse-requirement-sources"], { timeoutMs: 600000 }));
    commands.push(runCommand("npm", ["run", "planner:build-auto-repair-plan"], { timeoutMs: 300000 }));
    commands.push(runCommand("npm", ["run", "planner:audit:source-backed-coverage"], { timeoutMs: 600000 }));
    commands.push(runCommand("npm", ["run", "planner:validate-source-pipeline"], { timeoutMs: 300000 }));
    commands.push(runCommand("npm", ["run", "planner:repair-queue"], { timeoutMs: 120000 }));
    commands.push(runCommand("npm", ["run", "planner:test:parser"], { timeoutMs: 300000 }));
    commands.push(runCommand("npx", ["tsc", "--noEmit"], { timeoutMs: 300000 }));
  }

  const currentInputs = options.runChecks ? loadInputs() : inputs;
  const courseCoverage = buildCourseSourceCoverage(currentInputs);
  const requirementFidelity = buildRequirementSourceFidelity(currentInputs);
  const studentVisibleFacts = buildStudentVisibleFacts(currentInputs);
  const sourcePipelineFailures = getSourcePipelineFailures(currentInputs.sourcePipeline);
  const sourceBackedStatus = summarizeReportStatus(currentInputs.sourceBacked);
  const generatedRegistryStatus = summarizeReportStatus(currentInputs.generatedRegistry);
  const mappingStatus = summarizeReportStatus(currentInputs.mapping);
  const repairQueueStatus = summarizeReportStatus(currentInputs.repairQueue);
  const missingRequiredReportKeys = getMissingRequiredReportKeys(currentInputs);
  const blockingReasons = [];

  if (missingRequiredReportKeys.length) {
    blockingReasons.push(`missing required reports: ${missingRequiredReportKeys.join(", ")}`);
  }
  if (sourceBackedStatus.issueCount > 0) {
    blockingReasons.push(`source-backed coverage blockers: ${sourceBackedStatus.issueCount}`);
  }
  if (studentVisibleFacts.summary.studentVisibleUnsupportedFactCount > 0) {
    blockingReasons.push(
      `student-visible unsupported facts: ${studentVisibleFacts.summary.studentVisibleUnsupportedFactCount}`
    );
  }
  if (studentVisibleFacts.summary.hiddenSourceGapOwnerCount > 0) {
    blockingReasons.push(`hidden source-gap owners: ${studentVisibleFacts.summary.hiddenSourceGapOwnerCount}`);
  }
  if (sourcePipelineFailures.length) {
    blockingReasons.push(`source-pipeline validation failures: ${sourcePipelineFailures.length}`);
  }
  if (courseCoverage.outcome !== "passed") {
    blockingReasons.push("course source coverage audit blocked");
  }
  if (requirementFidelity.outcome !== "passed") {
    blockingReasons.push("requirement source fidelity audit blocked");
  }
  if (commands.some((command) => command.status !== 0 || command.timedOut)) {
    blockingReasons.push("release command failed or timed out");
  }

  return {
    generatedAt: new Date().toISOString(),
    outcome: blockingReasons.length ? "blocked" : "passed",
    blockingReasons,
    sourceReports: Object.fromEntries(
      Object.entries(REPORTS).map(([key, filePath]) => [key, { path: relative(filePath), present: fs.existsSync(filePath) }])
    ),
    missingRequiredReportKeys,
    commands,
    gateStatuses: {
      sourceBackedCoverage: sourceBackedStatus,
      generatedRegistry: generatedRegistryStatus,
      mapping: mappingStatus,
      repairQueue: repairQueueStatus,
      sourcePipeline: {
        present: Boolean(inputs.sourcePipeline),
        outcome: sourcePipelineFailures.length ? "failed" : "passed",
        failureCount: sourcePipelineFailures.length,
      },
      courseSourceCoverage: courseCoverage.summary,
      requirementSourceFidelity: requirementFidelity.summary,
      studentVisibleFacts: studentVisibleFacts.summary,
    },
    sourcePipelineFailures,
    topStudentVisibleUnsupportedFacts: studentVisibleFacts.studentVisibleUnsupportedFacts.slice(0, 100),
    topRequirementFidelityBlockers: requirementFidelity.fidelityBlockers.slice(0, 100),
    topCourseCoverageBlockers: courseCoverage.blockers.slice(0, 100),
  };
}

function markdownTable(headers, rows) {
  const safeRows = rows.length ? rows : [headers.map(() => "")];
  const escape = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
  return [
    `| ${headers.map(escape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...safeRows.map((row) => `| ${row.map(escape).join(" | ")} |`),
  ].join("\n");
}

function renderMarkdown(title, report) {
  const lines = [
    `# ${title}`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Outcome: ${report.outcome}`,
    "",
  ];
  if (report.blockingReasons?.length) {
    lines.push("## Blocking Reasons", "");
    for (const reason of report.blockingReasons) {
      lines.push(`- ${reason}`);
    }
    lines.push("");
  }
  lines.push("## Summary", "");
  lines.push(
    markdownTable(
      ["Metric", "Value"],
      Object.entries(report.summary ?? report.gateStatuses ?? {}).map(([key, value]) => [
        key,
        typeof value === "object" ? JSON.stringify(value) : value,
      ])
    )
  );
  const examples =
    report.studentVisibleUnsupported ??
    report.studentVisibleUnsupportedFacts ??
    report.topStudentVisibleUnsupportedFacts ??
    report.fidelityBlockers ??
    report.blockers ??
    report.topCourseCoverageBlockers ??
    [];
  if (examples.length) {
    lines.push("", "## Examples", "");
    lines.push(
      markdownTable(
        ["ID", "Owner", "Issue", "Class", "Visible", "Source URL", "Requirement", "Courses"],
        examples.slice(0, 50).map((row) => [
          row.id,
          row.ownerId,
          row.issueType,
          row.actionableIssueClass,
          row.studentVisible ? "yes" : "no",
          row.sourceUrl ?? "not reported",
          row.requirement ?? "not reported",
          (row.courseCodes ?? []).join(", ") || "not reported",
        ])
      )
    );
  }
  if (report.sourcePipelineFailures?.length) {
    lines.push("", "## Source Pipeline Failures", "");
    lines.push(
      markdownTable(
        ["ID", "Label", "Details"],
        report.sourcePipelineFailures.map((failure) => [
          failure.id,
          failure.label,
          (failure.details ?? []).join(" | "),
        ])
      )
    );
  }
  if (report.commands?.length) {
    lines.push("", "## Commands", "");
    lines.push(
      markdownTable(
        ["Command", "Status", "Timed out", "Stdout tail", "Stderr tail"],
        report.commands.map((command) => [
          command.command,
          command.status ?? command.signal ?? "unknown",
          command.timedOut ? "yes" : "no",
          command.stdoutTail ?? "",
          command.stderrTail ?? "",
        ])
      )
    );
  }
  return lines.join("\n");
}

function loadInputs() {
  return Object.fromEntries(
    Object.entries(REPORTS).map(([key, filePath]) => [key, readJsonIfExists(filePath)])
  );
}

function main() {
  const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
  const mode = modeArg ? modeArg.slice("--mode=".length) : "release-readiness";
  const config = MODES[mode];
  if (!config) {
    throw new Error(`Unknown publish-readiness audit mode: ${mode}`);
  }
  const inputs = loadInputs();
  const report =
    mode === "course-source-coverage"
      ? buildCourseSourceCoverage(inputs)
      : mode === "requirement-source-fidelity"
        ? buildRequirementSourceFidelity(inputs)
        : mode === "student-visible-facts"
          ? buildStudentVisibleFacts(inputs)
          : buildReleaseReadiness(inputs, { runChecks: hasArg("--run-checks") });
  const jsonPath = path.resolve(TMP_DIR, config.json);
  const mdPath = path.resolve(TMP_DIR, config.md);
  writeJson(jsonPath, report);
  writeText(mdPath, renderMarkdown(config.title, report));
  console.log(`${config.title} outcome: ${report.outcome}`);
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Markdown report: ${mdPath}`);
  if (report.outcome !== "passed") {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildCourseSourceCoverage,
  buildRequirementSourceFidelity,
  buildReleaseReadiness,
  buildStudentVisibleFacts,
  collectSourceBackedBlockers,
  isStudentVisible,
};
