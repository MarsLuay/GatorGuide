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
  TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS,
  TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS,
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY,
  TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY,
  getTransferPlannerPathwaysForPlan,
  getTransferPlannerMajorPlan,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerSourceManifestEntriesForPlan,
  getTransferPlannerStudentRuntimeMajorPlan,
  resolveTransferPlannerMajorPlan,
  resolveTransferPlannerStudentRuntimeMajorPlan,
} = require("../../constants/transfer-planner-source");
const {
  normalizeTransferPlannerSemanticPathwayLabel,
} = require("../../constants/transfer-planner-source/pathway-title-normalization");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-owner-audit.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-owner-audit.md");
const SUPPORT_ONLY_PRIMARY_SOURCE_ROLES = new Set([
  "admission-prerequisite-source",
  "admissions",
  "approved-course-list",
  "availability",
  "elective-list",
  "equivalency",
  "non-schedulable-course-list",
  "support-source",
  "upper-division-prerequisite-table",
]);

function getArgValue(flag) {
  const args = process.argv.slice(2);
  const directPrefix = `${flag}=`;
  const directMatch = args.find((arg) => arg.startsWith(directPrefix));
  if (directMatch) {
    return directMatch.slice(directPrefix.length).trim() || null;
  }

  const flagIndex = args.indexOf(flag);
  if (flagIndex === -1) {
    return null;
  }

  const nextValue = args[flagIndex + 1];
  if (!nextValue || nextValue.startsWith("--")) {
    return null;
  }

  return String(nextValue).trim() || null;
}

function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function buildOwnerKey(planId, pathwayId) {
  return `${String(planId)}::${String(pathwayId ?? "")}`;
}

function buildParsedBlockOwnerId(planId, pathwayId) {
  return pathwayId ? `${planId}:pathway:${pathwayId}` : planId;
}

function buildParsedBlockPlanSourceKey(block) {
  return `${block.planId}::${block.primarySourceUrl ?? block.sourceUrl}`;
}

function buildManifestPlanSourceKey(entry) {
  return `${entry.planId ?? entry.ownerId}::${entry.url}`;
}

function normalizePathwayAliasLabel(planTitle, label) {
  return normalizeTransferPlannerSemanticPathwayLabel(planTitle, label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findPathwayOwnerAliases(owner, planTitle) {
  if (!owner.pathwayId || !owner.pathwayLabel) {
    return [];
  }

  const normalizedOwnerLabel = normalizePathwayAliasLabel(planTitle, owner.pathwayLabel);
  if (!normalizedOwnerLabel) {
    return [];
  }

  const aliasOwnerIds = new Set(
    TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
      (entry) => entry.planId === owner.planId && entry.ownerType === "pathway"
    )
      .filter((entry) => {
        const normalizedCandidateLabel = normalizePathwayAliasLabel(planTitle, entry.ownerTitle);
        return (
          normalizedCandidateLabel === normalizedOwnerLabel ||
          normalizedCandidateLabel.includes(normalizedOwnerLabel) ||
          normalizedOwnerLabel.includes(normalizedCandidateLabel)
        );
      })
      .map((entry) => entry.ownerId)
  );

  return [...aliasOwnerIds];
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

function isTransientHttpThrottleFallback(details) {
  return /\bHTTP 429\b.*\bToo Many Requests\b/i.test(String(details ?? ""));
}

function shouldWarnOnSnapshotFallback(parsedBlock) {
  if (!parsedBlock?.usedSnapshotFallback) {
    return false;
  }

  const parsedUwCourseCodeCount = Array.isArray(parsedBlock.parsedUwCourseCodes)
    ? parsedBlock.parsedUwCourseCodes.length
    : 0;
  const qualityWarningCount = Array.isArray(parsedBlock.qualitySignals)
    ? parsedBlock.qualitySignals.filter((signal) => signal?.severity === "warning").length
    : 0;

  if (parsedUwCourseCodeCount === 0 || qualityWarningCount > 0) {
    return true;
  }

  return !isTransientHttpThrottleFallback(parsedBlock.snapshotFallbackReason);
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

function buildIssueIndex(issues) {
  return new Map(issues.map((issue) => [issue.code, issue]));
}

function buildCountsByCode(entries) {
  return entries.reduce((counts, entry) => {
    counts[entry.code] = (counts[entry.code] ?? 0) + 1;
    return counts;
  }, {});
}

function collapseOwnerIssues(ownerId, symptomIssues, isAutoPromotedOwner) {
  const rootIssues = [];
  const symptomIssueByCode = buildIssueIndex(symptomIssues);
  const groupedSymptomCodes = new Set();
  const missingPrimarySource = symptomIssueByCode.has("missing-primary-source");
  const missingManifestEntries = symptomIssueByCode.has("missing-source-manifest-entries");
  const missingParsedSourceBlock = symptomIssueByCode.has("missing-parsed-source-block");

  if (missingPrimarySource && missingManifestEntries) {
    groupedSymptomCodes.add("missing-primary-source");
    groupedSymptomCodes.add("missing-source-manifest-entries");
    if (missingParsedSourceBlock) {
      groupedSymptomCodes.add("missing-parsed-source-block");
    }
    addIssue(
      rootIssues,
      "error",
      "canonical-source-registry-missing-owner",
      "Canonical source registry is missing the owner's primary source registration.",
      {
        ownerId,
        autoPromotedPrimarySource: isAutoPromotedOwner,
        symptoms: [
          "missing-primary-source",
          "missing-source-manifest-entries",
          ...(missingParsedSourceBlock ? ["missing-parsed-source-block"] : []),
        ],
      }
    );
  } else if (missingPrimarySource || missingManifestEntries) {
    if (missingPrimarySource) {
      groupedSymptomCodes.add("missing-primary-source");
    }
    if (missingManifestEntries) {
      groupedSymptomCodes.add("missing-source-manifest-entries");
    }
    addIssue(
      rootIssues,
      "error",
      "canonical-source-registry-drift",
      "Canonical source registry is internally inconsistent for this owner.",
      {
        ownerId,
        autoPromotedPrimarySource: isAutoPromotedOwner,
        symptoms: [
          ...(missingPrimarySource ? ["missing-primary-source"] : []),
          ...(missingManifestEntries ? ["missing-source-manifest-entries"] : []),
        ],
      }
    );
  }

  if (missingParsedSourceBlock && !missingPrimarySource && !missingManifestEntries) {
    groupedSymptomCodes.add("missing-parsed-source-block");
    addIssue(
      rootIssues,
      "error",
      isAutoPromotedOwner ? "promoted-source-not-parsed" : "registry-parser-drift",
      isAutoPromotedOwner
        ? "An auto-promoted primary source exists in the canonical registry but did not produce a parsed requirement block."
        : "Canonical registry and parsed requirement blocks drifted for this owner.",
      {
        ownerId,
        autoPromotedPrimarySource: isAutoPromotedOwner,
        symptoms: ["missing-parsed-source-block"],
      }
    );
  }

  if (symptomIssueByCode.has("invalid-primary-source-url")) {
    rootIssues.push(symptomIssueByCode.get("invalid-primary-source-url"));
  }
  if (symptomIssueByCode.has("blocked-primary-source-url")) {
    rootIssues.push(symptomIssueByCode.get("blocked-primary-source-url"));
  }
  if (symptomIssueByCode.has("parsed-source-block-failed")) {
    rootIssues.push(symptomIssueByCode.get("parsed-source-block-failed"));
  }
  if (symptomIssueByCode.has("missing-primary-manifest-flag")) {
    groupedSymptomCodes.add("missing-primary-manifest-flag");
    addIssue(
      rootIssues,
      "warning",
      "manifest-primary-metadata-drift",
      "Source manifest entries exist, but the primary degree-requirements flag is missing.",
      {
        ownerId,
        symptoms: ["missing-primary-manifest-flag"],
      }
    );
  }
  if (symptomIssueByCode.has("used-snapshot-fallback")) {
    groupedSymptomCodes.add("used-snapshot-fallback");
    rootIssues.push(symptomIssueByCode.get("used-snapshot-fallback"));
  }
  if (symptomIssueByCode.has("no-parsed-uw-course-codes")) {
    groupedSymptomCodes.add("no-parsed-uw-course-codes");
    rootIssues.push(symptomIssueByCode.get("no-parsed-uw-course-codes"));
  }

  for (const issue of symptomIssues) {
    if (!groupedSymptomCodes.has(issue.code) && !rootIssues.some((rootIssue) => rootIssue.code === issue.code)) {
      rootIssues.push(issue);
    }
  }

  rootIssues.sort(compareIssues);
  return rootIssues;
}

function buildOwners(targetPlanId = null) {
  const owners = [];

  for (const plan of TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS) {
    if (targetPlanId && plan.id !== targetPlanId) {
      continue;
    }

    const visiblePathways = getTransferPlannerPathwaysForPlan(plan);
    owners.push({
      ownerId: buildParsedBlockOwnerId(plan.id, null),
      ownerKey: buildOwnerKey(plan.id, null),
      planId: plan.id,
      pathwayId: null,
      pathwayLabel: null,
      title: plan.title,
      campusId: plan.campusId,
    });

    for (const pathway of visiblePathways) {
      owners.push({
        ownerId: buildParsedBlockOwnerId(plan.id, pathway.id),
        ownerKey: buildOwnerKey(plan.id, pathway.id),
        planId: plan.id,
        pathwayId: pathway.id,
        pathwayLabel: pathway.label,
        title: `${plan.title} - ${pathway.label}`,
        campusId: plan.campusId,
      });
    }
  }

  return owners.sort((left, right) => left.ownerId.localeCompare(right.ownerId));
}

const AUTO_PROMOTED_PRIMARY_SOURCE_OWNER_IDS = new Set(
  (TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS ?? []).map((entry) => entry.ownerId)
);
const PROMOTED_OWNER_INVARIANT_VIOLATION_CODES = new Set([
  "canonical-source-registry-missing-owner",
  "canonical-source-registry-drift",
  "promoted-source-not-parsed",
]);

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
    `- Root-cause errors: ${report.issueCounts.error}`,
    `- Root-cause warnings: ${report.issueCounts.warning}`,
    `- Raw symptom errors: ${report.symptomIssueCounts.error}`,
    `- Raw symptom warnings: ${report.symptomIssueCounts.warning}`,
    `- Auto-promoted owner invariant violations: ${report.promotedOwnerInvariantViolationCount}`,
    `- Total source-only UW course codes: ${report.totalSourceOnlyUwCourseCodes}`,
    "",
  ];

  if (Object.keys(report.countsByIssueCode).length) {
    lines.push("## Root Cause Counts", "");
    for (const [code, count] of Object.entries(report.countsByIssueCode).sort(([left], [right]) =>
      left.localeCompare(right)
    )) {
      lines.push(`- ${code}: ${count}`);
    }
    lines.push("");
  }

  if (report.ownersWithErrorsCount > 0) {
    lines.push("## Owners With Errors", "");
    for (const owner of report.owners.filter((entry) =>
      entry.rootIssues.some((issue) => issue.severity === "error")
    )) {
      const ownerLines = [
        `### ${owner.title}`,
        "",
        `- Owner: ${owner.ownerId}`,
        `- Campus: ${owner.campusId}`,
        `- Source: ${owner.primarySourceUrl ?? "none"}`,
        `- Auto-promoted primary source: ${owner.isAutoPromotedPrimarySource ? "yes" : "no"}`,
        ...owner.rootIssues.filter((issue) => issue.severity === "error").map(formatIssueLine),
        owner.symptomIssues.length
          ? `- Diagnostic signals: ${owner.symptomIssues.map((issue) => issue.code).join(", ")}`
          : null,
        "",
      ].filter(Boolean);
      lines.push(...ownerLines);
    }
  }

  if (report.ownersWithWarningsCount > 0) {
    lines.push("## Owners With Warnings", "");
    for (const owner of report.owners.filter((entry) =>
      entry.rootIssues.some((issue) => issue.severity === "warning")
    )) {
      const ownerLines = [
        `### ${owner.title}`,
        "",
        `- Owner: ${owner.ownerId}`,
        `- Campus: ${owner.campusId}`,
        `- Source: ${owner.primarySourceUrl ?? "none"}`,
        ...owner.rootIssues.filter((issue) => issue.severity === "warning").map(formatIssueLine),
        owner.symptomIssues.length
          ? `- Diagnostic signals: ${owner.symptomIssues.map((issue) => issue.code).join(", ")}`
          : null,
        "",
      ].filter(Boolean);
      lines.push(...ownerLines);
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
  const targetPlanId = getArgValue("--target-plan-id");

  const parsedBlocksByOwnerId = new Map(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.map((block) => [block.ownerId, block])
  );
  const parsedBlocksByPlanSourceKey = new Map(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.map((block) => [
      buildParsedBlockPlanSourceKey(block),
      block,
    ])
  );

  const owners = buildOwners(targetPlanId).map((owner) => {
    const symptomIssues = [];
    let sourceOnlyUwCourseCodeCount = 0;
    const isAutoPromotedPrimarySource = AUTO_PROMOTED_PRIMARY_SOURCE_OWNER_IDS.has(owner.ownerId);
    const basePlan = getTransferPlannerMajorPlan(owner.planId);
    const aliasOwnerIds = owner.pathwayId && basePlan
      ? findPathwayOwnerAliases(owner, basePlan.title)
      : [];
    const aliasManifestEntries = aliasOwnerIds.flatMap((aliasOwnerId) =>
      TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter((entry) => entry.ownerId === aliasOwnerId)
    );
    if (!basePlan) {
      addIssue(
        symptomIssues,
        "error",
        "missing-base-plan",
        "Planner base plan could not be resolved."
      );
    }

    const resolvedPlan = basePlan
      ? owner.pathwayId
        ? resolveTransferPlannerMajorPlan(basePlan, owner.pathwayId)
        : basePlan
      : null;
    if (!resolvedPlan) {
      addIssue(
        symptomIssues,
        "error",
        "missing-resolved-plan",
        "Planner resolved plan could not be built for this owner."
      );
    }

    const runtimeBasePlan = getTransferPlannerStudentRuntimeMajorPlan(owner.planId);
    if (!runtimeBasePlan) {
      addIssue(
        symptomIssues,
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
        symptomIssues,
        "error",
        "missing-runtime-resolved-plan",
        "Student runtime resolved plan could not be built for this owner."
      );
    }

    const primarySource = getTransferPlannerPrimaryDegreeRequirementsSource(
      owner.planId,
      owner.pathwayId
    );
    const effectivePrimarySourceUrl =
      primarySource?.url ??
      aliasManifestEntries.find((entry) => entry.isPrimaryDegreeRequirementsLink)?.url ??
      null;
    if (!effectivePrimarySourceUrl) {
      addIssue(
        symptomIssues,
        "error",
        "missing-primary-source",
        "No primary degree-requirements source URL is registered for this owner."
      );
    } else {
      const parsedPrimaryUrl = parseUrlOrNull(effectivePrimarySourceUrl);
      if (!parsedPrimaryUrl) {
        addIssue(
          symptomIssues,
          "error",
          "invalid-primary-source-url",
          "Primary degree-requirements source URL is not a valid absolute URL.",
          effectivePrimarySourceUrl
        );
      } else if (urlLooksLikeBlockedPrimarySource(effectivePrimarySourceUrl)) {
        addIssue(
          symptomIssues,
          "error",
          "blocked-primary-source-url",
          "Primary degree-requirements source URL looks like a login or blocked page.",
          effectivePrimarySourceUrl
        );
      }
    }

    const manifestEntries = getTransferPlannerSourceManifestEntriesForPlan(
      owner.planId,
      owner.pathwayId
    );
    const effectiveManifestEntries =
      (manifestEntries ?? []).length > 0 ? manifestEntries : aliasManifestEntries;
    if ((effectiveManifestEntries ?? []).length === 0) {
      addIssue(
        symptomIssues,
        "error",
        "missing-source-manifest-entries",
        "No source manifest entries were found for this owner."
      );
    } else if (!effectiveManifestEntries.some((entry) => entry.isPrimaryDegreeRequirementsLink)) {
      addIssue(
        symptomIssues,
        "warning",
        "missing-primary-manifest-flag",
        "Source manifest entries exist, but none are marked as the primary degree-requirements link."
      );
    } else {
      const supportOnlyPrimaryEntry = effectiveManifestEntries.find(
        (entry) =>
          entry.isPrimaryDegreeRequirementsLink &&
          SUPPORT_ONLY_PRIMARY_SOURCE_ROLES.has(entry.role)
      );
      if (supportOnlyPrimaryEntry) {
        addIssue(
          symptomIssues,
          "error",
          "support-source-marked-primary",
          "A support-only or non-schedulable source role is marked as the primary degree-requirements link.",
          `${supportOnlyPrimaryEntry.role}: ${supportOnlyPrimaryEntry.url}`
        );
      }
    }

    const primaryManifestEntry = effectiveManifestEntries.find(
      (entry) => entry.isPrimaryDegreeRequirementsLink
    );
    const parsedBlock =
      parsedBlocksByOwnerId.get(owner.ownerId) ??
      aliasOwnerIds.map((aliasOwnerId) => parsedBlocksByOwnerId.get(aliasOwnerId)).find(Boolean) ??
      (primaryManifestEntry
        ? parsedBlocksByPlanSourceKey.get(buildManifestPlanSourceKey(primaryManifestEntry))
        : null) ??
      null;
    if (!parsedBlock) {
      addIssue(
        symptomIssues,
        "error",
        "missing-parsed-source-block",
        "No parsed requirement source block was generated for this owner."
      );
    } else {
      if (!parsedBlock.ok) {
        addIssue(
          symptomIssues,
          "error",
          "parsed-source-block-failed",
          "Requirement source parsing did not succeed for this owner.",
          parsedBlock.error ?? null
        );
      }

      if (shouldWarnOnSnapshotFallback(parsedBlock)) {
        addIssue(
          symptomIssues,
          "warning",
          "used-snapshot-fallback",
          isTransientHttpThrottleFallback(parsedBlock.snapshotFallbackReason)
            ? "Requirement source parsing fell back to a cached snapshot after live-source throttling and still needs attention."
            : "Requirement source parsing used a cached snapshot fallback.",
          parsedBlock.snapshotFallbackReason ?? null
        );
      }

      const parsedUwCourseCodeCount = Array.isArray(parsedBlock.parsedUwCourseCodes)
        ? parsedBlock.parsedUwCourseCodes.length
        : 0;
      if (parsedUwCourseCodeCount === 0) {
        addIssue(
          symptomIssues,
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

    symptomIssues.sort(compareIssues);
    const rootIssues = collapseOwnerIssues(
      owner.ownerId,
      symptomIssues,
      isAutoPromotedPrimarySource
    );

    return {
      ...owner,
      isAutoPromotedPrimarySource,
      primarySourceUrl: effectivePrimarySourceUrl,
      sourceOnlyUwCourseCodeCount,
      issueCounts: buildCountsBySeverity(rootIssues),
      symptomIssueCounts: buildCountsBySeverity(symptomIssues),
      rootIssues,
      symptomIssues,
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
    symptomIssueCounts: owners.reduce(
      (counts, owner) => {
        counts.error += owner.symptomIssueCounts.error;
        counts.warning += owner.symptomIssueCounts.warning;
        return counts;
      },
      { error: 0, warning: 0 }
    ),
    countsByIssueCode: buildCountsByCode(owners.flatMap((owner) => owner.rootIssues)),
    countsBySymptomCode: buildCountsByCode(owners.flatMap((owner) => owner.symptomIssues)),
    promotedOwnerInvariantViolationCount: owners.filter((owner) =>
      owner.rootIssues.some((issue) => PROMOTED_OWNER_INVARIANT_VIOLATION_CODES.has(issue.code))
    ).length,
    owners,
  };

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeMarkdown(report);

  console.log(`Owners audited: ${report.totalOwners}`);
  console.log(`Owners with errors: ${report.ownersWithErrorsCount}`);
  console.log(`Owners with warnings: ${report.ownersWithWarningsCount}`);
  console.log(`Auto-promoted owner invariant violations: ${report.promotedOwnerInvariantViolationCount}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);

  if (report.ownersWithErrorsCount > 0) {
    process.exitCode = 1;
  }
}

main();
