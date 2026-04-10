const fs = require("fs");
const path = require("path");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const {
  TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS,
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY,
  getTransferPlannerMajorPlan,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerSourceManifestEntriesForPlan,
  getTransferPlannerStudentRuntimeMajorPlan,
  resolveTransferPlannerMajorPlan,
  resolveTransferPlannerStudentRuntimeMajorPlan,
} = require("../../constants/transfer-planner-source");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-owner-audit.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-owner-audit.md");

function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function buildOwnerKey(planId, pathwayId) {
  return `${String(planId)}::${String(pathwayId ?? "")}`;
}

function buildParsedBlockOwnerId(planId, pathwayId) {
  return pathwayId ? `${planId}:pathway:${pathwayId}` : planId;
}

function parseUrlOrNull(value) {
  try {
    return new URL(String(value ?? ""));
  } catch {
    return null;
  }
}

function urlLooksLikeBlockedPrimarySource(value) {
  return /\/saml\/login|shibboleth\.sso\/login|\/print\/courses|\/wp-login/i.test(
    String(value ?? "")
  );
}

function addIssue(issues, severity, code, message, details = null) {
  issues.push({
    severity,
    code,
    message,
    details,
  });
}

function compareIssues(left, right) {
  const severityScore = {
    error: 0,
    warning: 1,
  };

  const scoreDiff = (severityScore[left.severity] ?? 99) - (severityScore[right.severity] ?? 99);
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  return left.code.localeCompare(right.code);
}

function buildOwners() {
  const owners = [];

  for (const plan of TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS) {
    owners.push({
      ownerId: buildParsedBlockOwnerId(plan.id, null),
      ownerKey: buildOwnerKey(plan.id, null),
      planId: plan.id,
      pathwayId: null,
      title: plan.title,
      campusId: plan.campusId,
    });

    for (const pathway of plan.pathways ?? []) {
      owners.push({
        ownerId: buildParsedBlockOwnerId(plan.id, pathway.id),
        ownerKey: buildOwnerKey(plan.id, pathway.id),
        planId: plan.id,
        pathwayId: pathway.id,
        title: `${plan.title} - ${pathway.label}`,
        campusId: plan.campusId,
      });
    }
  }

  return owners.sort((left, right) => left.ownerId.localeCompare(right.ownerId));
}

function buildCountsBySeverity(entries) {
  return entries.reduce(
    (counts, entry) => {
      counts[entry.severity] = (counts[entry.severity] ?? 0) + 1;
      return counts;
    },
    { error: 0, warning: 0 }
  );
}

function formatIssueLine(issue) {
  const detailText =
    issue.details == null
      ? ""
      : typeof issue.details === "string"
        ? ` (${issue.details})`
        : ` (${JSON.stringify(issue.details)})`;
  return `- [${issue.severity}] ${issue.code}: ${issue.message}${detailText}`;
}

function writeMarkdown(report) {
  const lines = [
    "# Transfer Planner Owner Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Owners audited: ${report.totalOwners}`,
    `- Owners with errors: ${report.ownersWithErrorsCount}`,
    `- Owners with warnings: ${report.ownersWithWarningsCount}`,
    `- Owners with source-only UW course codes: ${report.ownersWithSourceOnlyUwCourseCodesCount}`,
    `- Total errors: ${report.issueCounts.error}`,
    `- Total warnings: ${report.issueCounts.warning}`,
    `- Total source-only UW course codes: ${report.totalSourceOnlyUwCourseCodes}`,
    "",
  ];

  if (report.ownersWithErrorsCount > 0) {
    lines.push("## Owners With Errors", "");
    for (const owner of report.owners.filter((entry) =>
      entry.issues.some((issue) => issue.severity === "error")
    )) {
      lines.push(
        `### ${owner.title}`,
        "",
        `- Owner: ${owner.ownerId}`,
        `- Campus: ${owner.campusId}`,
        `- Source: ${owner.primarySourceUrl ?? "none"}`,
        ...owner.issues.filter((issue) => issue.severity === "error").map(formatIssueLine),
        ""
      );
    }
  }

  if (report.ownersWithWarningsCount > 0) {
    lines.push("## Owners With Warnings", "");
    for (const owner of report.owners.filter((entry) =>
      entry.issues.some((issue) => issue.severity === "warning")
    )) {
      lines.push(
        `### ${owner.title}`,
        "",
        `- Owner: ${owner.ownerId}`,
        `- Campus: ${owner.campusId}`,
        `- Source: ${owner.primarySourceUrl ?? "none"}`,
        ...owner.issues.filter((issue) => issue.severity === "warning").map(formatIssueLine),
        ""
      );
    }
  }

  if (report.ownersWithSourceOnlyUwCourseCodesCount > 0) {
    lines.push(
      "## Coverage Notes",
      "",
      "- Source-only UW course codes are tracked in the JSON report as coverage gaps, but they are not treated as warnings in this audit because that bucket is still broadly expected across many majors.",
      ""
    );
  }

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function main() {
  ensureTmpDir();

  const parsedBlocksByOwnerId = new Map(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.map((block) => [block.ownerId, block])
  );

  const owners = buildOwners().map((owner) => {
    const issues = [];
    let sourceOnlyUwCourseCodeCount = 0;
    const basePlan = getTransferPlannerMajorPlan(owner.planId);
    if (!basePlan) {
      addIssue(issues, "error", "missing-base-plan", "Planner base plan could not be resolved.");
    }

    const resolvedPlan = basePlan
      ? owner.pathwayId
        ? resolveTransferPlannerMajorPlan(basePlan, owner.pathwayId)
        : basePlan
      : null;
    if (!resolvedPlan) {
      addIssue(
        issues,
        "error",
        "missing-resolved-plan",
        "Planner resolved plan could not be built for this owner."
      );
    }

    const runtimeBasePlan = getTransferPlannerStudentRuntimeMajorPlan(owner.planId);
    if (!runtimeBasePlan) {
      addIssue(
        issues,
        "error",
        "missing-runtime-base-plan",
        "Student runtime base plan could not be resolved."
      );
    }

    const runtimeResolvedPlan = runtimeBasePlan
      ? owner.pathwayId
        ? resolveTransferPlannerStudentRuntimeMajorPlan(runtimeBasePlan, owner.pathwayId)
        : runtimeBasePlan
      : null;
    if (!runtimeResolvedPlan) {
      addIssue(
        issues,
        "error",
        "missing-runtime-resolved-plan",
        "Student runtime resolved plan could not be built for this owner."
      );
    }

    const primarySource = getTransferPlannerPrimaryDegreeRequirementsSource(
      owner.planId,
      owner.pathwayId
    );
    if (!primarySource?.url) {
      addIssue(
        issues,
        "error",
        "missing-primary-source",
        "No primary degree-requirements source URL is registered for this owner."
      );
    } else {
      const parsedPrimaryUrl = parseUrlOrNull(primarySource.url);
      if (!parsedPrimaryUrl) {
        addIssue(
          issues,
          "error",
          "invalid-primary-source-url",
          "Primary degree-requirements source URL is not a valid absolute URL.",
          primarySource.url
        );
      } else if (urlLooksLikeBlockedPrimarySource(primarySource.url)) {
        addIssue(
          issues,
          "error",
          "blocked-primary-source-url",
          "Primary degree-requirements source URL looks like a login or blocked page.",
          primarySource.url
        );
      }
    }

    const manifestEntries = getTransferPlannerSourceManifestEntriesForPlan(
      owner.planId,
      owner.pathwayId
    );
    if ((manifestEntries ?? []).length === 0) {
      addIssue(
        issues,
        "error",
        "missing-source-manifest-entries",
        "No source manifest entries were found for this owner."
      );
    } else if (!manifestEntries.some((entry) => entry.isPrimaryDegreeRequirementsLink)) {
      addIssue(
        issues,
        "warning",
        "missing-primary-manifest-flag",
        "Source manifest entries exist, but none are marked as the primary degree-requirements link."
      );
    }

    const parsedBlock = parsedBlocksByOwnerId.get(owner.ownerId);
    if (!parsedBlock) {
      addIssue(
        issues,
        "error",
        "missing-parsed-source-block",
        "No parsed requirement source block was generated for this owner."
      );
    } else {
      if (!parsedBlock.ok) {
        addIssue(
          issues,
          "error",
          "parsed-source-block-failed",
          "Requirement source parsing did not succeed for this owner.",
          parsedBlock.error ?? null
        );
      }

      if (parsedBlock.usedSnapshotFallback) {
        addIssue(
          issues,
          "warning",
          "used-snapshot-fallback",
          "Requirement source parsing used a cached snapshot fallback.",
          parsedBlock.snapshotFallbackReason ?? null
        );
      }

      const parsedUwCourseCodeCount = Array.isArray(parsedBlock.parsedUwCourseCodes)
        ? parsedBlock.parsedUwCourseCodes.length
        : 0;
      if (parsedUwCourseCodeCount === 0) {
        addIssue(
          issues,
          "warning",
          "no-parsed-uw-course-codes",
          "Parsed requirement source block produced zero UW course codes."
        );
      }

      const parsedSourceOnlyUwCourseCodeCount = Array.isArray(parsedBlock.sourceOnlyUwCourseCodes)
        ? parsedBlock.sourceOnlyUwCourseCodes.length
        : 0;
      sourceOnlyUwCourseCodeCount = parsedSourceOnlyUwCourseCodeCount;
    }

    issues.sort(compareIssues);

    return {
      ...owner,
      primarySourceUrl: primarySource?.url ?? null,
      sourceOnlyUwCourseCodeCount,
      issueCounts: buildCountsBySeverity(issues),
      issues,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    totalOwners: owners.length,
    ownersWithErrorsCount: owners.filter((owner) => owner.issueCounts.error > 0).length,
    ownersWithWarningsCount: owners.filter((owner) => owner.issueCounts.warning > 0).length,
    ownersWithSourceOnlyUwCourseCodesCount: owners.filter(
      (owner) => owner.sourceOnlyUwCourseCodeCount > 0
    ).length,
    totalSourceOnlyUwCourseCodes: owners.reduce(
      (total, owner) => total + owner.sourceOnlyUwCourseCodeCount,
      0
    ),
    issueCounts: owners.reduce(
      (counts, owner) => {
        counts.error += owner.issueCounts.error;
        counts.warning += owner.issueCounts.warning;
        return counts;
      },
      { error: 0, warning: 0 }
    ),
    owners,
  };

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeMarkdown(report);

  console.log(`Owners audited: ${report.totalOwners}`);
  console.log(`Owners with errors: ${report.ownersWithErrorsCount}`);
  console.log(`Owners with warnings: ${report.ownersWithWarningsCount}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);

  if (report.ownersWithErrorsCount > 0) {
    process.exitCode = 1;
  }
}

main();
