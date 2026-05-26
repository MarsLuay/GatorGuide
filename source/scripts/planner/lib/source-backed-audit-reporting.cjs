const {
  writeJsonReport,
  writeMarkdownReport,
} = require("./planner-reporting.cjs");

function assertReportPaths(options, label) {
  if (!options.jsonPath || !options.markdownPath) {
    throw new Error(`Missing output paths for ${label}.`);
  }
}

function writeMappingAuditReports(report, options = {}) {
  assertReportPaths(options, 'mapping audit');
  writeJsonReport(options.jsonPath, report);

  const issueRows = (report.mappingRegressionRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const lines = [
    "# Transfer Planner UW-GRC Mapping Regression Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Outcome: ${report.outcome}`,
    `- Mapping regression rows: ${report.summary.mappingRegressionRowCount}`,
    `- Mapping regression issues: ${report.summary.mappingRegressionIssueCount}`,
    "",
    "## Issue Counts",
    "",
    ...Object.entries(report.summary.issueCountsByType)
      .filter(([, count]) => count > 0)
      .map(([issueType, count]) => `- ${issueType}: ${count}`),
    "",
  ];

  if (issueRows.length) {
    lines.push("## Issue Sample", "");
    for (const row of issueRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (issueRows.length > 120) {
      lines.push(
        `- ... ${issueRows.length - 120} additional mapping regression issues omitted from markdown.`
      );
    }
    lines.push("");
  }

  lines.push("## Mapping Regression Report", "");
  for (const row of (report.mappingRegressionRows ?? []).slice(0, 160)) {
    lines.push(`- ${row.copyOnlyDebugText}`);
  }
  if ((report.mappingRegressionRows ?? []).length > 160) {
    lines.push(
      `- ... ${report.mappingRegressionRows.length - 160} additional mapping regression rows omitted from markdown.`
    );
  }
  lines.push("");

  writeMarkdownReport(options.markdownPath, lines);
}

function writeGeneratedRegistryReports(report, options = {}) {
  assertReportPaths(options, 'generated registry audit');
  writeJsonReport(options.jsonPath, report);

  const issueRows = (report.generatedRegistryRegressionRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const protectedRows = (report.generatedRegistryRegressionRows ?? []).filter(
    (row) => row.protectedPattern
  );
  const requirementShapeIssueRows = (report.requirementShapeAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const electiveApprovedListShapeIssueRows = (
    report.electiveApprovedListShapeAuditRows ?? []
  ).filter((row) => row.issue && row.issue !== "none");
  const creditCategoryShapeIssueRows = (report.creditCategoryShapeAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const categoryMappingIssueRows = (report.categoryMappingAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const programApprovedFilterIssueRows = (report.programApprovedFilterAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const sequencePathwayShapeIssueRows = (report.sequencePathwayShapeAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const singleEquivalencyIssueRows = (report.singleEquivalencyAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const lines = [
    "# Transfer Planner Generated Registry Regression Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Outcome: ${report.outcome}`,
    `- Owners audited: ${report.summary.ownerCount}`,
    `- Generated registry audit rows: ${report.summary.generatedRegistryRegressionRowCount}`,
    `- Generated registry issues: ${report.summary.generatedRegistryIssueCount}`,
    `- Generated source seed rows: ${report.summary.generatedSourceSeedAuditRowCount}`,
    `- Generated shape rows: ${report.summary.generatedShapeAuditRowCount}`,
    `- Requirement shape audit rows: ${report.summary.requirementShapeAuditRowCount}`,
    `- Requirement shape issues: ${report.summary.requirementShapeIssueCount}`,
    `- Elective/approved list shape audit rows: ${
      report.summary.electiveApprovedListShapeAuditRowCount ?? 0
    }`,
    `- Elective/approved list shape issues: ${
      report.summary.electiveApprovedListShapeIssueCount ?? 0
    }`,
    `- Credit/category shape audit rows: ${
      report.summary.creditCategoryShapeAuditRowCount ?? 0
    }`,
    `- Credit/category shape issues: ${
      report.summary.creditCategoryShapeIssueCount ?? 0
    }`,
    `- Category mapping audit rows: ${report.summary.categoryMappingAuditRowCount ?? 0}`,
    `- Category mapping issues: ${report.summary.categoryMappingIssueCount ?? 0}`,
    `- Program approved filter audit rows: ${
      report.summary.programApprovedFilterAuditRowCount ?? 0
    }`,
    `- Program approved filter issues: ${
      report.summary.programApprovedFilterIssueCount ?? 0
    }`,
    `- Sequence/pathway shape audit rows: ${
      report.summary.sequencePathwayShapeAuditRowCount ?? 0
    }`,
    `- Sequence/pathway shape issues: ${
      report.summary.sequencePathwayShapeIssueCount ?? 0
    }`,
    `- Single equivalency audit rows: ${
      report.summary.singleEquivalencyAuditRowCount ?? 0
    }`,
    `- Single equivalency issues: ${
      report.summary.singleEquivalencyIssueCount ?? 0
    }`,
    `- Protected owner rows: ${report.summary.protectedOwnerRowCount}`,
    "",
    "## Issue Counts",
    "",
    ...Object.entries(report.summary.issueCountsByType).map(([issueType, count]) => `- ${issueType}: ${count}`),
    "",
  ];

  if (issueRows.length) {
    lines.push("## Issue Sample", "");
    for (const row of issueRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (issueRows.length > 120) {
      lines.push(`- ... ${issueRows.length - 120} additional generated-registry issues omitted from markdown.`);
    }
    lines.push("");
  }

  if (requirementShapeIssueRows.length) {
    lines.push("## Requirement Shape Issue Sample", "");
    for (const row of requirementShapeIssueRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (electiveApprovedListShapeIssueRows.length) {
    lines.push("## Elective/Approved List Shape Issue Sample", "");
    for (const row of electiveApprovedListShapeIssueRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (creditCategoryShapeIssueRows.length) {
    lines.push("## Credit/Category Shape Issue Sample", "");
    for (const row of creditCategoryShapeIssueRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (sequencePathwayShapeIssueRows.length) {
    lines.push("## Sequence/Pathway Shape Issue Sample", "");
    for (const row of sequencePathwayShapeIssueRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (singleEquivalencyIssueRows.length) {
    lines.push("## Single Equivalency Issue Sample", "");
    for (const row of singleEquivalencyIssueRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (protectedRows.length) {
    lines.push("## Protected Owner Rows", "");
    for (const row of protectedRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if ((report.generatedRegistryRegressionRows ?? []).length) {
    lines.push("## Audit Sample", "");
    for (const row of report.generatedRegistryRegressionRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.generatedRegistryRegressionRows.length > 120) {
      lines.push(
        `- ... ${report.generatedRegistryRegressionRows.length - 120} additional generated registry audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.requirementShapeAuditRows ?? []).length) {
    lines.push("## Requirement Shape Audit Sample", "");
    for (const row of report.requirementShapeAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.requirementShapeAuditRows.length > 120) {
      lines.push(
        `- ... ${report.requirementShapeAuditRows.length - 120} additional requirement shape rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.electiveApprovedListShapeAuditRows ?? []).length) {
    lines.push("## Elective/Approved List Shape Audit Sample", "");
    for (const row of report.electiveApprovedListShapeAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.electiveApprovedListShapeAuditRows.length > 120) {
      lines.push(
        `- ... ${report.electiveApprovedListShapeAuditRows.length - 120} additional elective/approved list shape rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.creditCategoryShapeAuditRows ?? []).length) {
    lines.push("## Credit/Category Shape Audit Sample", "");
    for (const row of report.creditCategoryShapeAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.creditCategoryShapeAuditRows.length > 120) {
      lines.push(
        `- ... ${report.creditCategoryShapeAuditRows.length - 120} additional credit/category shape rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.sequencePathwayShapeAuditRows ?? []).length) {
    lines.push("## Sequence/Pathway Shape Audit Sample", "");
    for (const row of report.sequencePathwayShapeAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.sequencePathwayShapeAuditRows.length > 120) {
      lines.push(
        `- ... ${report.sequencePathwayShapeAuditRows.length - 120} additional sequence/pathway shape rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.singleEquivalencyAuditRows ?? []).length) {
    lines.push("## Single Equivalency Audit Sample", "");
    for (const row of report.singleEquivalencyAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.singleEquivalencyAuditRows.length > 120) {
      lines.push(
        `- ... ${report.singleEquivalencyAuditRows.length - 120} additional single equivalency rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  writeMarkdownReport(options.markdownPath, lines);
}

module.exports = {
  writeGeneratedRegistryReports,
  writeMappingAuditReports,
};
