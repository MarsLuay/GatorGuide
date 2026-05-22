/* global __dirname */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-auto-repair-plan.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-auto-repair-plan.md");
const REPAIR_ATTEMPT_STATE_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-auto-repair-attempt-state.json"
);
const OWNER_AUDIT_PATH = path.resolve(TMP_DIR, "transfer-planner-owner-audit.json");
const OWNER_AUDIT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-owner-audit.md");
const REQUIREMENT_PARSE_REPORT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-requirement-source-parse-report.json"
);
const SOURCE_BACKED_AUDIT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-source-backed-coverage-audit.json"
);
const SOURCE_BACKED_AUDIT_MD_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-source-backed-coverage-audit.md"
);
const PRIMARY_SOURCE_DISCOVERY_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-primary-source-discovery.json"
);
const SOURCE_CHANGE_CLASSIFICATION_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-source-change-classification.json"
);
const GENERATED_SOURCE_DIR = path.resolve(REPO_ROOT, "constants", "transfer-planner-source");
const GENERATED_OUTPUT_PATHS = {
  primarySourcePromotions: path.resolve(
    GENERATED_SOURCE_DIR,
    "primary-source-promotions.generated.ts"
  ),
  sourceGaps: path.resolve(GENERATED_SOURCE_DIR, "source-gaps.generated.ts"),
  bootstrap: path.resolve(GENERATED_SOURCE_DIR, "bootstrap.generated.ts"),
  requirementSourceAdapters: path.resolve(
    GENERATED_SOURCE_DIR,
    "requirement-source-adapters.generated.ts"
  ),
  requirementSourceAdapterBlocks: path.resolve(
    GENERATED_SOURCE_DIR,
    "requirement-source-adapters.generated"
  ),
  programApprovedCourseFilters: path.resolve(
    GENERATED_SOURCE_DIR,
    "generated-program-approved-course-filters.ts"
  ),
  sourceFingerprints: path.resolve(GENERATED_SOURCE_DIR, "source-fingerprints.generated.ts"),
  studentRuntime: path.resolve(GENERATED_SOURCE_DIR, "student-runtime.generated.ts"),
  generatedMajorPlans: path.resolve(GENERATED_SOURCE_DIR, "generated-major-plans.ts"),
};
const REPORT_INPUTS = [
  { key: "ownerAudit", label: "owner audit", path: OWNER_AUDIT_PATH },
  { key: "requirementParse", label: "requirement parse", path: REQUIREMENT_PARSE_REPORT_PATH },
  { key: "sourceBackedCoverage", label: "source-backed coverage", path: SOURCE_BACKED_AUDIT_PATH },
  {
    key: "primarySourceDiscovery",
    label: "primary source discovery",
    path: PRIMARY_SOURCE_DISCOVERY_PATH,
  },
  {
    key: "sourceChangeClassification",
    label: "source-change classification",
    path: SOURCE_CHANGE_CLASSIFICATION_PATH,
  },
];
const REPORT_FRESHNESS_TOLERANCE_MS = 5 * 60 * 1000;
const POST_REPAIR_VERIFICATION_RESTORABLE_PATHS = [
  OWNER_AUDIT_PATH,
  OWNER_AUDIT_MD_PATH,
  SOURCE_BACKED_AUDIT_PATH,
  SOURCE_BACKED_AUDIT_MD_PATH,
];

const CATEGORY_LABELS = {
  "source-missing": "source missing",
  "source-too-broad": "source too broad",
  "source-unparseable": "source found but unparseable",
  "source-support-only": "source is support-only",
  "parser-low-coverage": "parser extracted too few courses",
  "runtime-row-mismatch": "runtime hid or scheduled the wrong rows",
  "source-new-course": "new official course added",
  "source-course-removed": "official course removed",
  "source-structure-changed": "source structure changed",
  "source-current-year-sibling": "current-year sibling found",
  "source-weak-overview": "source became weak or overview-only",
  "support-source-changed": "support-only source changed",
};

const CATEGORY_PRIORITY = {
  "source-missing": 10,
  "source-support-only": 20,
  "source-too-broad": 30,
  "source-unparseable": 40,
  "parser-low-coverage": 50,
  "runtime-row-mismatch": 60,
  "source-current-year-sibling": 25,
  "source-weak-overview": 35,
  "source-structure-changed": 45,
  "support-source-changed": 55,
  "source-new-course": 65,
  "source-course-removed": 70,
};

const SOURCE_LEVEL_CATEGORIES = new Set([
  "source-missing",
  "source-too-broad",
  "source-support-only",
  "source-current-year-sibling",
  "source-weak-overview",
]);
const PARSER_LEVEL_CATEGORIES = new Set([
  "source-missing",
  "source-too-broad",
  "source-unparseable",
  "source-support-only",
  "parser-low-coverage",
  "source-new-course",
  "source-course-removed",
  "source-structure-changed",
  "source-current-year-sibling",
  "source-weak-overview",
  "support-source-changed",
]);
const RUNTIME_LEVEL_CATEGORIES = new Set([
  "runtime-row-mismatch",
  "source-new-course",
  "source-course-removed",
  "support-source-changed",
]);

const LOW_COVERAGE_SIGNAL_CODES = new Set([
  "high-confidence-low-course-coverage",
  "large-structured-only-course-gap",
]);
const STRUCTURAL_DRIFT_SIGNAL_CODES = new Set(["material-source-structured-drift"]);
const OWNER_SOURCE_MISSING_CODES = new Set([
  "missing-primary-source",
  "missing-source-manifest-entries",
  "missing-parsed-source-block",
  "canonical-source-registry-missing-owner",
  "canonical-source-registry-drift",
]);
const OWNER_SOURCE_SUPPORT_CODES = new Set(["support-source-marked-primary"]);
const OWNER_UNPARSEABLE_CODES = new Set([
  "parsed-source-block-failed",
  "promoted-source-not-parsed",
  "registry-parser-drift",
  "used-snapshot-fallback",
]);
const SUPPORT_OR_NON_SCHEDULABLE_ROLE_STATUSES = new Set(["support", "non-schedulable"]);
const SUPPORT_OR_NON_SCHEDULABLE_SCOPE_ISSUES = new Set([
  "support-source-emitted-required-row",
  "support-source-created-required-row",
  "support-source-generated-required-row",
  "approved-list-source-created-required-row",
  "approved-course-list-promoted-to-required",
  "approved-list-generated-required-row",
  "elective-list-promoted-to-required",
  "elective-list-generated-required-row",
  "upper-division-prerequisite-table-scheduled",
  "non-schedulable-course-list-scheduled",
  "non-schedulable-source-scheduled",
  "course-list-emitted-requirement",
  "prerequisite-table-emitted-requirement",
  "support-metadata-became-required",
  "support-list-scheduled",
  "list-promoted-to-required",
  "elective-list-as-required",
]);
const BROAD_SOURCE_SCOPE_ISSUES = new Set([
  "parser-source-scope-violation",
  "source-scope-contamination",
  "gen-ed-scope-leak",
  "pathway-leak",
  "path-note-unscoped",
  "unscoped-generated-seed",
]);
const RUNTIME_ROW_ISSUES = new Set([
  "missing-detected-course",
  "option-group-disappears-after-refresh",
  "missing-option-group",
  "missing-category-option",
  "missing-credit-bucket",
  "required-count-used-for-credit-bucket",
  "flattened-option-group",
  "flattened-credit-bucket",
  "flattened-sequence-choice",
  "flattened-option",
  "credit-bucket-as-count",
  "sequence-choice-flattened",
  "wrong-shape",
  "false-required-promotion",
  "false-required-sibling",
  "placeholder-atom-scheduled",
  "placeholder-promoted-to-required",
  "hidden-row-as-required",
  "hidden-informational-row-scheduled",
  "selected-option-not-scheduled",
  "unselected-option-scheduled",
  "non-selected-compound-option-scheduled",
  "partial-compound-path-scheduled",
  "prep-credit-counted-as-main",
  "partial-compound-path",
  "missing-compound-path",
  "over-expanded-compound-path",
  "duplicate-compound-count",
  "partial-compound-path-scheduled",
  "missing-compound-component",
  "duplicate-compound-component",
]);

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

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

function getNumericArgValue(flag) {
  const value = getArgValue(flag);
  if (value == null) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getCommandIndexArgValue(flag) {
  const value = getArgValue(flag);
  if (value == null) {
    return null;
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${flag} must be 1 or greater.`);
  }
  return parsed;
}

function readJsonReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(reportPath, "utf8"));
}

function snapshotFiles(filePaths) {
  return new Map(
    filePaths.map((filePath) => {
      if (!fs.existsSync(filePath)) {
        return [filePath, { exists: false, contents: null, atimeMs: null, mtimeMs: null }];
      }
      const stats = fs.statSync(filePath);
      return [
        filePath,
        {
          exists: true,
          contents: fs.readFileSync(filePath),
          atimeMs: stats.atimeMs,
          mtimeMs: stats.mtimeMs,
        },
      ];
    })
  );
}

function restoreFileSnapshot(snapshot) {
  for (const [filePath, record] of snapshot.entries()) {
    if (record.exists) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, record.contents);
      if (Number.isFinite(record.atimeMs) && Number.isFinite(record.mtimeMs)) {
        fs.utimesSync(filePath, record.atimeMs / 1000, record.mtimeMs / 1000);
      }
    } else if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  }
}

function readPathMtimeMs(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.statSync(filePath).mtimeMs;
}

function readNewestPathMtimeMs(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stats = fs.statSync(filePath);
  if (!stats.isDirectory()) {
    return stats.mtimeMs;
  }

  let newest = stats.mtimeMs;
  for (const entryName of fs.readdirSync(filePath)) {
    const entryMtime = readNewestPathMtimeMs(path.join(filePath, entryName));
    if (entryMtime !== null && entryMtime > newest) {
      newest = entryMtime;
    }
  }
  return newest;
}

function formatIsoFromMtime(mtimeMs) {
  return Number.isFinite(mtimeMs) ? new Date(mtimeMs).toISOString() : null;
}

function buildGeneratedOutputKeysForRepairPlans(repairPlans) {
  const outputKeys = new Set();
  for (const plan of repairPlans) {
    if (plan.needsSourceDiscovery) {
      outputKeys.add("primarySourcePromotions");
      outputKeys.add("sourceGaps");
      outputKeys.add("bootstrap");
    }
    if (plan.needsRequirementParse) {
      outputKeys.add("requirementSourceAdapters");
      outputKeys.add("requirementSourceAdapterBlocks");
      outputKeys.add("programApprovedCourseFilters");
      outputKeys.add("sourceFingerprints");
      outputKeys.add("bootstrap");
      outputKeys.add("studentRuntime");
    }
    if (plan.needsRuntimeGeneration) {
      outputKeys.add("studentRuntime");
      outputKeys.add("generatedMajorPlans");
    }
  }
  return [...outputKeys].sort((left, right) => left.localeCompare(right));
}

function buildFreshnessOutputRecords(outputKeys, generatedOutputPaths = GENERATED_OUTPUT_PATHS) {
  return outputKeys
    .map((key) => {
      const filePath = generatedOutputPaths[key];
      const mtimeMs = filePath ? readNewestPathMtimeMs(filePath) : null;
      return {
        key,
        path: filePath ?? null,
        exists: mtimeMs !== null,
        mtimeMs,
        mtimeIso: formatIsoFromMtime(mtimeMs),
      };
    })
    .sort((left, right) => left.key.localeCompare(right.key));
}

function buildFreshnessReport(repairPlans, options = {}) {
  const toleranceMs = options.toleranceMs ?? REPORT_FRESHNESS_TOLERANCE_MS;
  const reportInputs = options.reportInputs ?? REPORT_INPUTS;
  const generatedOutputPaths = options.generatedOutputPaths ?? GENERATED_OUTPUT_PATHS;
  const outputKeys = buildGeneratedOutputKeysForRepairPlans(repairPlans);
  const generatedOutputs = buildFreshnessOutputRecords(outputKeys, generatedOutputPaths);
  const existingGeneratedOutputs = generatedOutputs.filter((record) => record.exists);
  const newestGeneratedOutput = existingGeneratedOutputs.reduce((newest, record) => {
    if (!newest || record.mtimeMs > newest.mtimeMs) {
      return record;
    }
    return newest;
  }, null);
  const sourceReports = reportInputs.map((input) => {
    const mtimeMs = readPathMtimeMs(input.path);
    return {
      key: input.key,
      label: input.label,
      path: input.path,
      exists: mtimeMs !== null,
      mtimeMs,
      mtimeIso: formatIsoFromMtime(mtimeMs),
    };
  });

  if (!newestGeneratedOutput) {
    return {
      outcome: "fresh",
      toleranceMs,
      newestGeneratedOutput: null,
      generatedOutputs,
      sourceReports,
      staleReports: [],
    };
  }

  const staleReports = sourceReports
    .filter((report) => report.exists)
    .filter((report) => report.mtimeMs + toleranceMs < newestGeneratedOutput.mtimeMs)
    .map((report) => ({
      ...report,
      newestGeneratedOutputKey: newestGeneratedOutput.key,
      newestGeneratedOutputPath: newestGeneratedOutput.path,
      newestGeneratedOutputMtimeMs: newestGeneratedOutput.mtimeMs,
      newestGeneratedOutputMtimeIso: newestGeneratedOutput.mtimeIso,
      staleByMs: Math.max(0, newestGeneratedOutput.mtimeMs - report.mtimeMs),
    }));

  return {
    outcome: staleReports.length ? "stale" : "fresh",
    toleranceMs,
    newestGeneratedOutput,
    generatedOutputs,
    sourceReports,
    staleReports,
  };
}

function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function buildOwnerId(planId, pathwayId) {
  return pathwayId ? `${planId}:pathway:${pathwayId}` : planId;
}

function inferPlanIdFromOwnerId(ownerId) {
  const value = String(ownerId ?? "");
  return value.split(":pathway:")[0] || null;
}

function getRowPlanId(row) {
  return row?.planId ?? row?.majorId ?? inferPlanIdFromOwnerId(row?.ownerId) ?? null;
}

function getRowOwnerId(row) {
  if (row?.ownerId && row?.pathwayId && !String(row.ownerId).includes(":pathway:")) {
    return buildOwnerId(row.ownerId, row.pathwayId);
  }
  return row?.ownerId ?? buildOwnerId(getRowPlanId(row), row?.pathwayId ?? null);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean).map(String))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function summarizeArray(values, limit = 10) {
  const uniqueValues = uniqueSorted(values);
  if (uniqueValues.length <= limit) {
    return uniqueValues;
  }
  return [...uniqueValues.slice(0, limit), `... ${uniqueValues.length - limit} more`];
}

function buildIndexes({ ownerAudit, parseReport, discoveryReport }) {
  const ownerAuditByOwnerId = new Map();
  for (const owner of ownerAudit?.owners ?? []) {
    ownerAuditByOwnerId.set(owner.ownerId, owner);
  }

  const parseOwnerByOwnerId = new Map();
  for (const owner of parseReport?.owners ?? []) {
    parseOwnerByOwnerId.set(owner.ownerId, owner);
  }

  const discoveryOwnerByOwnerId = new Map();
  for (const owner of [
    ...(discoveryReport?.owners ?? []),
    ...(discoveryReport?.weakExistingOwners ?? []),
  ]) {
    if (owner?.ownerKey) {
      discoveryOwnerByOwnerId.set(owner.ownerKey, owner);
    }
    if (owner?.planId) {
      discoveryOwnerByOwnerId.set(buildOwnerId(owner.planId, owner.pathwayId ?? null), owner);
    }
  }

  return {
    ownerAuditByOwnerId,
    parseOwnerByOwnerId,
    discoveryOwnerByOwnerId,
  };
}

function resolveOwnerIdentity(row, indexes) {
  const ownerId = getRowOwnerId(row);
  const planId = getRowPlanId(row) ?? inferPlanIdFromOwnerId(ownerId);
  const pathwayId = row?.pathwayId ?? (String(ownerId).includes(":pathway:") ? String(ownerId).split(":pathway:")[1] : null);
  const ownerAudit = indexes.ownerAuditByOwnerId.get(ownerId);
  const parseOwner = indexes.parseOwnerByOwnerId.get(ownerId);
  const discoveryOwner = indexes.discoveryOwnerByOwnerId.get(ownerId);
  return {
    ownerId,
    planId,
    pathwayId,
    campusId: row?.campusId ?? ownerAudit?.campusId ?? parseOwner?.campusId ?? discoveryOwner?.campusId ?? null,
    title:
      row?.title ??
      row?.majorTitle ??
      row?.ownerTitle ??
      ownerAudit?.title ??
      parseOwner?.ownerTitle ??
      discoveryOwner?.title ??
      ownerId,
    sourceUrl:
      row?.sourceUrl ??
      row?.uwSourceUrl ??
      row?.primarySourceUrl ??
      ownerAudit?.primarySourceUrl ??
      parseOwner?.sourceUrl ??
      parseOwner?.primarySourceUrl ??
      discoveryOwner?.existingPrimaryUrl ??
      null,
  };
}

function categoryActions(category) {
  const actions = [];
  if (SOURCE_LEVEL_CATEGORIES.has(category)) {
    actions.push(
      "targeted-source-discovery",
      "primary-source-review-queue",
      "high-confidence-source-promotion"
    );
  }
  if (PARSER_LEVEL_CATEGORIES.has(category)) {
    actions.push("targeted-requirement-parse", "source-fingerprint-refresh");
  }
  if (RUNTIME_LEVEL_CATEGORIES.has(category)) {
    actions.push("student-runtime-regeneration");
  }
  return actions;
}

function addRepairCase(caseMap, identity, category, severity, evidence) {
  if (!identity.ownerId || !identity.planId || !category) {
    return;
  }

  const key = `${identity.ownerId}::${category}`;
  const existing =
    caseMap.get(key) ??
    {
      ownerId: identity.ownerId,
      planId: identity.planId,
      pathwayId: identity.pathwayId ?? null,
      campusId: identity.campusId ?? null,
      title: identity.title,
      sourceUrl: identity.sourceUrl,
      category,
      categoryLabel: CATEGORY_LABELS[category] ?? category,
      severity,
      actions: [],
      evidence: [],
    };

  existing.severity =
    existing.severity === "error" || severity === "error" ? "error" : "warning";
  existing.sourceUrl = existing.sourceUrl ?? identity.sourceUrl ?? null;
  existing.actions = uniqueSorted([...existing.actions, ...categoryActions(category)]);

  const evidenceKey = JSON.stringify(evidence);
  if (!existing.evidence.some((entry) => JSON.stringify(entry) === evidenceKey)) {
    existing.evidence.push(evidence);
  }

  caseMap.set(key, existing);
}

function classifyNoParsedOwner(parseOwner) {
  if (!parseOwner) {
    return "source-unparseable";
  }

  if (!parseOwner.sourceUrl && !parseOwner.primarySourceUrl) {
    return "source-missing";
  }

  if (SUPPORT_OR_NON_SCHEDULABLE_ROLE_STATUSES.has(parseOwner.sourceRoleStatus)) {
    return "source-support-only";
  }

  if (parseOwner.sourceRoleStatus === "ignored" || parseOwner.canCreateSchedulableRows === false) {
    return "source-too-broad";
  }

  return "source-unparseable";
}

function collectOwnerAuditCases(caseMap, ownerAudit, indexes) {
  for (const owner of ownerAudit?.owners ?? []) {
    const issues = [...(owner.rootIssues ?? []), ...(owner.symptomIssues ?? [])];
    if (!issues.length) {
      continue;
    }

    const parseOwner = indexes.parseOwnerByOwnerId.get(owner.ownerId);
    const identity = resolveOwnerIdentity(owner, indexes);
    for (const issue of issues) {
      let category = null;
      if (OWNER_SOURCE_MISSING_CODES.has(issue.code)) {
        category = "source-missing";
      } else if (OWNER_SOURCE_SUPPORT_CODES.has(issue.code)) {
        category = "source-support-only";
      } else if (OWNER_UNPARSEABLE_CODES.has(issue.code)) {
        category = "source-unparseable";
      } else if (issue.code === "no-parsed-uw-course-codes") {
        category = classifyNoParsedOwner(parseOwner);
      }

      if (!category) {
        continue;
      }

      addRepairCase(caseMap, identity, category, issue.severity ?? "warning", {
        report: "owner-audit",
        code: issue.code,
        message: issue.message,
        details: issue.details ?? null,
        parsedUwCourseCodeCount: parseOwner?.parsedUwCourseCodes?.length ?? null,
        requirementCueLineCount: parseOwner?.requirementCueLines?.length ?? null,
        sourceRole: parseOwner?.sourceRole ?? null,
        sourceRoleStatus: parseOwner?.sourceRoleStatus ?? null,
      });
    }
  }
}

function collectParseReportCases(caseMap, parseReport, indexes) {
  for (const owner of parseReport?.owners ?? []) {
    const identity = resolveOwnerIdentity(owner, indexes);
    const parsedCount = owner.parsedUwCourseCodes?.length ?? 0;
    const structuredCount = owner.structuredUwCourseCodes?.length ?? 0;
    const structuredOnlyCount = owner.structuredOnlyUwCourseCodes?.length ?? 0;
    const sourceOnlyCount = owner.sourceOnlyUwCourseCodes?.length ?? 0;
    const qualitySignals = owner.qualitySignals ?? [];

    if (!owner.ok) {
      addRepairCase(caseMap, identity, "source-unparseable", "error", {
        report: "requirement-source-parse",
        code: "parse-failed",
        message: owner.error ?? "Requirement source parse failed.",
        adapterId: owner.adapterId ?? null,
        sourceRole: owner.sourceRole ?? null,
        sourceRoleStatus: owner.sourceRoleStatus ?? null,
      });
    }

    if (owner.ok && parsedCount === 0) {
      addRepairCase(caseMap, identity, classifyNoParsedOwner(owner), "warning", {
        report: "requirement-source-parse",
        code: "no-parsed-uw-course-codes",
        message: "Parsed source produced no usable UW course codes.",
        adapterId: owner.adapterId ?? null,
        parseConfidence: owner.parseConfidence ?? null,
        requirementCueLineCount: owner.requirementCueLines?.length ?? 0,
        structuredUwCourseCodeCount: structuredCount,
        sourceRole: owner.sourceRole ?? null,
        sourceRoleStatus: owner.sourceRoleStatus ?? null,
      });
    }

    for (const signal of qualitySignals) {
      if (LOW_COVERAGE_SIGNAL_CODES.has(signal.code)) {
        addRepairCase(caseMap, identity, "parser-low-coverage", signal.severity ?? "warning", {
          report: "requirement-source-parse",
          code: signal.code,
          message: signal.message,
          details: signal.details ?? null,
          parsedUwCourseCodeCount: parsedCount,
          structuredUwCourseCodeCount: structuredCount,
          structuredOnlyUwCourseCodeCount: structuredOnlyCount,
          sourceRole: owner.sourceRole ?? null,
          sourceRoleStatus: owner.sourceRoleStatus ?? null,
        });
      } else if (
        STRUCTURAL_DRIFT_SIGNAL_CODES.has(signal.code) &&
        sourceOnlyCount >= Math.max(10, structuredCount * 2) &&
        owner.sourceRoleStatus !== "primary"
      ) {
        addRepairCase(caseMap, identity, "source-too-broad", signal.severity ?? "warning", {
          report: "requirement-source-parse",
          code: signal.code,
          message: signal.message,
          details: signal.details ?? null,
          parsedUwCourseCodeCount: parsedCount,
          sourceOnlyUwCourseCodeCount: sourceOnlyCount,
          sourceRole: owner.sourceRole ?? null,
          sourceRoleStatus: owner.sourceRoleStatus ?? null,
        });
      }
    }
  }
}

function classifySourceBackedIssue(row) {
  const issueType = row?.issueType ?? row?.issue ?? null;
  if (!issueType || issueType === "unmapped-uw-only") {
    return null;
  }
  if (SUPPORT_OR_NON_SCHEDULABLE_SCOPE_ISSUES.has(issueType)) {
    return "source-support-only";
  }
  if (BROAD_SOURCE_SCOPE_ISSUES.has(issueType)) {
    return "source-too-broad";
  }
  if (RUNTIME_ROW_ISSUES.has(issueType)) {
    return "runtime-row-mismatch";
  }
  return null;
}

function collectSourceBackedAuditCases(caseMap, sourceBackedAudit, indexes) {
  const rows = [
    ...(sourceBackedAudit?.requirementCoverageRows ?? []),
    ...(sourceBackedAudit?.sourceScopeAuditRows ?? []),
    ...(sourceBackedAudit?.runtimeOptionResolutionAuditRows ?? []),
    ...(sourceBackedAudit?.runtimeCompoundSequenceAuditRows ?? []),
    ...(sourceBackedAudit?.requiredCoverageSequenceSuppressionAuditRows ?? []),
    ...(sourceBackedAudit?.runtimeCompoundSchedulingAuditRows ?? []),
  ];

  for (const row of rows) {
    const category = classifySourceBackedIssue(row);
    if (!category) {
      continue;
    }

    const issueType = row.issueType ?? row.issue;
    const identity = resolveOwnerIdentity(row, indexes);
    addRepairCase(caseMap, identity, category, "error", {
      report: "source-backed-coverage-audit",
      code: issueType,
      message: row.copyOnlyDebugText ?? row.hiddenInternalReason ?? "Source-backed audit issue.",
      sourceRole: row.detectedSourceRole ?? row.sourceRole ?? null,
      sourceRoleStatus: row.sourceRoleStatus ?? null,
      courseCodes: summarizeArray([
        ...(row.parsedUwCourseCodes ?? []),
        row.courseCode,
      ]),
      generatedRuntimeRow: row.generatedRuntimeRow ?? null,
      visibleInTransferOnlyQuarterPlan: row.visibleInTransferOnlyQuarterPlan ?? null,
      scheduled: row.scheduled ?? null,
    });
  }
}

function collectDiscoveryCases(caseMap, discoveryReport, indexes) {
  for (const owner of [
    ...(discoveryReport?.owners ?? []),
    ...(discoveryReport?.weakExistingOwners ?? []),
  ]) {
    if (!owner || !owner.planId) {
      continue;
    }
    const identity = resolveOwnerIdentity(
      {
        ownerId: buildOwnerId(owner.planId, owner.pathwayId ?? null),
        planId: owner.planId,
        pathwayId: owner.pathwayId ?? null,
        title: owner.title,
        campusId: owner.campusId,
        primarySourceUrl: owner.existingPrimaryUrl,
      },
      indexes
    );
    const signalCodes = new Set((owner.reevaluationSignals ?? []).map((signal) => signal.code));

    if (!owner.existingPrimaryUrl && owner.suggestedAction === "no-suggestion") {
      addRepairCase(caseMap, identity, "source-missing", "warning", {
        report: "primary-source-discovery",
        code: "no-primary-source-suggestion",
        message: "Discovery did not find a usable primary degree-requirements source.",
        candidateCount: owner.candidateCount ?? 0,
      });
    }

    if (signalCodes.has("no-parsed-uw-course-codes") && !owner.suggestedPrimary) {
      addRepairCase(caseMap, identity, "source-unparseable", "warning", {
        report: "primary-source-discovery",
        code: "weak-existing-no-parsed-courses",
        message:
          "Existing primary source was re-evaluated because it produced no parsed UW course codes.",
        candidateCount: owner.candidateCount ?? 0,
      });
    }
  }
}

function classifySourceChange(change) {
  switch (change?.changeType) {
    case "new-course-added":
      return "source-new-course";
    case "course-removed":
      return "source-course-removed";
    case "source-structure-changed":
      return "source-structure-changed";
    case "current-year-sibling-found":
      return "source-current-year-sibling";
    case "source-became-weak-or-overview":
      return "source-weak-overview";
    case "support-only-source-changed":
      return "support-source-changed";
    default:
      return null;
  }
}

function collectSourceChangeClassificationCases(caseMap, sourceChangeReport, indexes) {
  for (const change of sourceChangeReport?.changes ?? []) {
    const category = classifySourceChange(change);
    if (!category) {
      continue;
    }

    const identity = resolveOwnerIdentity(change, indexes);
    addRepairCase(caseMap, identity, category, "warning", {
      report: "source-change-classification",
      code: change.changeType,
      message: change.reason,
      details: `actionStatus=${change.actionStatus}; recommended=${(change.recommendedAction ?? []).join(", ")}`,
      sourceRole: change.sourceRole ?? null,
      sourceRoleStatus: change.sourceRoleStatus ?? null,
      addedCourseCodes: change.courseDelta?.added ?? [],
      removedCourseCodes: change.courseDelta?.removed ?? [],
      previousFingerprint: change.previousFingerprintSummary?.requirementFingerprint ?? null,
      currentFingerprint: change.currentFingerprintSummary?.requirementFingerprint ?? null,
    });
  }
}

function sortCases(cases) {
  return [...cases].sort((left, right) => {
    const severityDelta =
      (left.severity === "error" ? 0 : 1) - (right.severity === "error" ? 0 : 1);
    if (severityDelta !== 0) {
      return severityDelta;
    }
    const categoryDelta =
      (CATEGORY_PRIORITY[left.category] ?? 99) - (CATEGORY_PRIORITY[right.category] ?? 99);
    if (categoryDelta !== 0) {
      return categoryDelta;
    }
    return left.ownerId.localeCompare(right.ownerId);
  });
}

function buildCountsBy(values, getKey) {
  return values.reduce((counts, value) => {
    const key = getKey(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function buildRepairPlans(cases) {
  const plansById = new Map();
  for (const repairCase of cases) {
    const plan =
      plansById.get(repairCase.planId) ??
      {
        planId: repairCase.planId,
        ownerIds: [],
        categories: [],
        actions: [],
        needsSourceDiscovery: false,
        needsRequirementParse: false,
        needsRuntimeGeneration: false,
        caseCount: 0,
        pathwayIds: [],
        sourceUrls: [],
        commands: [],
      };
    plan.ownerIds = uniqueSorted([...plan.ownerIds, repairCase.ownerId]);
    plan.pathwayIds = uniqueSorted([...plan.pathwayIds, repairCase.pathwayId]);
    plan.sourceUrls = uniqueSorted([...plan.sourceUrls, repairCase.sourceUrl]);
    plan.categories = uniqueSorted([...plan.categories, repairCase.category]);
    plan.actions = uniqueSorted([...plan.actions, ...repairCase.actions]);
    plan.needsSourceDiscovery =
      plan.needsSourceDiscovery ||
      repairCase.actions.some((action) => action === "targeted-source-discovery");
    plan.needsRequirementParse =
      plan.needsRequirementParse ||
      repairCase.actions.some((action) => action === "targeted-requirement-parse");
    plan.needsRuntimeGeneration =
      plan.needsRuntimeGeneration ||
      repairCase.actions.some((action) => action === "student-runtime-regeneration");
    plan.caseCount += 1;
    plansById.set(repairCase.planId, plan);
  }

  for (const plan of plansById.values()) {
    if (plan.needsSourceDiscovery) {
      plan.commands.push([
        "node",
        "scripts/planner/discover-transfer-planner-primary-sources.cjs",
        "--target-plan-id",
        plan.planId,
      ]);
    }
    if (plan.needsRequirementParse) {
      plan.commands.push([
        "node",
        "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
        "--target-plan-id",
        plan.planId,
      ]);
    }
    if (plan.needsRuntimeGeneration) {
      plan.commands.push(["node", "scripts/planner/generate-transfer-planner-student-runtime.cjs"]);
    }
  }

  return [...plansById.values()].sort((left, right) => {
    const severityDelta = right.caseCount - left.caseCount;
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return left.planId.localeCompare(right.planId);
  });
}

function buildReport(options) {
  const ownerAudit = readJsonReport(OWNER_AUDIT_PATH);
  const parseReport = readJsonReport(REQUIREMENT_PARSE_REPORT_PATH);
  const sourceBackedAudit = readJsonReport(SOURCE_BACKED_AUDIT_PATH);
  const discoveryReport = readJsonReport(PRIMARY_SOURCE_DISCOVERY_PATH);
  const sourceChangeReport = readJsonReport(SOURCE_CHANGE_CLASSIFICATION_PATH);
  const indexes = buildIndexes({ ownerAudit, parseReport, discoveryReport });
  const caseMap = new Map();

  collectOwnerAuditCases(caseMap, ownerAudit, indexes);
  collectParseReportCases(caseMap, parseReport, indexes);
  collectSourceBackedAuditCases(caseMap, sourceBackedAudit, indexes);
  collectDiscoveryCases(caseMap, discoveryReport, indexes);
  collectSourceChangeClassificationCases(caseMap, sourceChangeReport, indexes);

  const allCases = sortCases([...caseMap.values()]);
  const cases = options.targetPlanId
    ? allCases.filter((repairCase) => repairCase.planId === options.targetPlanId)
    : allCases;
  const repairPlans = buildRepairPlans(cases);
  const repairCommandPlan = buildRepairCommandPlan(repairPlans);
  const repairCommandSequence = repairCommandPlan.commands;
  const sourceReportFreshness = buildFreshnessReport(repairPlans);

  return {
    generatedAt: new Date().toISOString(),
    targetPlanId: options.targetPlanId ?? null,
    sourceReports: {
      ownerAudit: fs.existsSync(OWNER_AUDIT_PATH) ? OWNER_AUDIT_PATH : null,
      requirementParse: fs.existsSync(REQUIREMENT_PARSE_REPORT_PATH)
        ? REQUIREMENT_PARSE_REPORT_PATH
        : null,
      sourceBackedCoverage: fs.existsSync(SOURCE_BACKED_AUDIT_PATH)
        ? SOURCE_BACKED_AUDIT_PATH
        : null,
      primarySourceDiscovery: fs.existsSync(PRIMARY_SOURCE_DISCOVERY_PATH)
        ? PRIMARY_SOURCE_DISCOVERY_PATH
        : null,
      sourceChangeClassification: fs.existsSync(SOURCE_CHANGE_CLASSIFICATION_PATH)
        ? SOURCE_CHANGE_CLASSIFICATION_PATH
        : null,
    },
    caseCount: cases.length,
    ownerCount: new Set(cases.map((repairCase) => repairCase.ownerId)).size,
    planCount: new Set(cases.map((repairCase) => repairCase.planId)).size,
    errorCaseCount: cases.filter((repairCase) => repairCase.severity === "error").length,
    warningCaseCount: cases.filter((repairCase) => repairCase.severity === "warning").length,
    countsByCategory: buildCountsBy(cases, (repairCase) => repairCase.category),
    countsByAction: buildCountsBy(
      cases.flatMap((repairCase) => repairCase.actions),
      (action) => action
    ),
    ignoredIssueTypes: {
      sourceBackedCoverage: ["unmapped-uw-only"],
    },
    repairCommandSequence,
    repairCommandBatches: repairCommandPlan.batches,
    repairPlans,
    cases,
    sourceReportFreshness,
    repairAttempt: null,
  };
}

function formatCommand(commandParts) {
  return commandParts.join(" ");
}

function getRepairResumeMode(options) {
  if (options.resumeFailed) {
    return "resume-failed";
  }
  if (options.fromCommandIndex != null) {
    return "from-command-index";
  }
  return "from-start";
}

function extractCommand(record) {
  if (Array.isArray(record)) {
    return record;
  }
  if (Array.isArray(record?.command)) {
    return record.command;
  }
  return null;
}

function commandsMatch(left, right) {
  const leftCommand = extractCommand(left);
  const rightCommand = extractCommand(right);
  return (
    Array.isArray(leftCommand) &&
    Array.isArray(rightCommand) &&
    formatCommand(leftCommand) === formatCommand(rightCommand)
  );
}

function readRepairAttemptState(statePath = REPAIR_ATTEMPT_STATE_PATH) {
  if (!fs.existsSync(statePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function writeRepairAttemptState(state, statePath = REPAIR_ATTEMPT_STATE_PATH) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function buildRepairCommandRecords(commands) {
  return commands.map((command, index) => ({
    commandIndex: index + 1,
    command,
  }));
}

function getSavedRepairCommandSequence(state) {
  if (!Array.isArray(state?.commandSequence)) {
    return [];
  }
  return state.commandSequence.map((record) => extractCommand(record));
}

function getSavedFailedCommandRecord(state) {
  const attemptedCommands = Array.isArray(state?.attemptedCommands)
    ? state.attemptedCommands
    : Array.isArray(state?.commands)
      ? state.commands
      : [];
  return attemptedCommands.find((command) => command?.status !== 0) ?? null;
}

function resolveSavedFailedCommandIndex(commands, state) {
  const failedCommand = getSavedFailedCommandRecord(state);
  if (!failedCommand) {
    return null;
  }

  const explicitIndex = Number.parseInt(String(failedCommand.commandIndex ?? ""), 10);
  if (Number.isFinite(explicitIndex) && explicitIndex > 0) {
    return explicitIndex;
  }

  const failedCommandParts = extractCommand(failedCommand);
  if (!failedCommandParts) {
    return null;
  }

  const commandIndex = commands.findIndex((command) => commandsMatch(command, failedCommandParts));
  return commandIndex === -1 ? null : commandIndex + 1;
}

function resolveRepairStartCommandIndex(commands, options, savedState = undefined) {
  if (options.fromCommandIndex != null) {
    if (options.fromCommandIndex < 1) {
      throw new Error("--from-command-index must be 1 or greater.");
    }
    if (options.fromCommandIndex > commands.length) {
      throw new Error(
        `Cannot start from command #${options.fromCommandIndex}; the current repair sequence has ${commands.length} command(s).`
      );
    }
    return options.fromCommandIndex;
  }

  if (!options.resumeFailed) {
    return 1;
  }

  const statePath = options.repairAttemptStatePath ?? REPAIR_ATTEMPT_STATE_PATH;
  const state = savedState === undefined ? readRepairAttemptState(statePath) : savedState;
  if (!state) {
    throw new Error(`Cannot --resume-failed: no repair-attempt state exists at ${statePath}.`);
  }

  const failedCommandIndex = resolveSavedFailedCommandIndex(commands, state);
  if (failedCommandIndex == null) {
    throw new Error("Cannot --resume-failed: the saved repair-attempt state has no failed command.");
  }
  if (failedCommandIndex > commands.length) {
    throw new Error(
      `Cannot --resume-failed: saved failed command #${failedCommandIndex} is outside the current repair sequence of ${commands.length} command(s).`
    );
  }

  const savedSequence = getSavedRepairCommandSequence(state);
  const savedFailedCommand =
    savedSequence[failedCommandIndex - 1] ?? extractCommand(getSavedFailedCommandRecord(state));
  const currentFailedCommand = commands[failedCommandIndex - 1];
  if (savedFailedCommand && !commandsMatch(savedFailedCommand, currentFailedCommand)) {
    throw new Error(
      `Cannot --resume-failed: saved failed command #${failedCommandIndex} no longer matches the current repair sequence. Saved "${formatCommand(
        savedFailedCommand
      )}", current "${formatCommand(currentFailedCommand)}". Use --from-command-index ${failedCommandIndex} to override.`
    );
  }

  return failedCommandIndex;
}

function writeMarkdown(report) {
  const lines = [
    "# Transfer Planner Auto-Repair Plan",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Target plan id: ${report.targetPlanId ?? "all"}`,
    `- Repair cases: ${report.caseCount}`,
    `- Affected owners: ${report.ownerCount}`,
    `- Affected plans: ${report.planCount}`,
    `- Error cases: ${report.errorCaseCount}`,
    `- Warning cases: ${report.warningCaseCount}`,
    "",
    "## Classification Counts",
    "",
  ];

  if (Object.keys(report.countsByCategory).length) {
    for (const [category, count] of Object.entries(report.countsByCategory).sort(
      ([left], [right]) =>
        (CATEGORY_PRIORITY[left] ?? 99) - (CATEGORY_PRIORITY[right] ?? 99)
    )) {
      lines.push(`- ${CATEGORY_LABELS[category] ?? category}: ${count}`);
    }
  } else {
    lines.push("- No repair cases found.");
  }

  lines.push("", "## Automation Actions", "");
  if (Object.keys(report.countsByAction).length) {
    for (const [action, count] of Object.entries(report.countsByAction).sort(([left], [right]) =>
      left.localeCompare(right)
    )) {
      lines.push(`- ${action}: ${count}`);
    }
  } else {
    lines.push("- none");
  }

  lines.push("", "## Source Report Freshness", "");
  lines.push(`- Outcome: ${report.sourceReportFreshness.outcome}`);
  lines.push(`- Tolerance: ${Math.round(report.sourceReportFreshness.toleranceMs / 1000)} seconds`);
  if (report.sourceReportFreshness.newestGeneratedOutput) {
    lines.push(
      `- Newest generated output: ${report.sourceReportFreshness.newestGeneratedOutput.key} (${report.sourceReportFreshness.newestGeneratedOutput.mtimeIso})`
    );
  } else {
    lines.push("- Newest generated output: none found for selected repair plans");
  }
  if (report.sourceReportFreshness.staleReports.length) {
    lines.push("- Stale source reports:");
    for (const staleReport of report.sourceReportFreshness.staleReports) {
      lines.push(
        `  - ${staleReport.label}: ${staleReport.mtimeIso} older than ${staleReport.newestGeneratedOutputKey} at ${staleReport.newestGeneratedOutputMtimeIso}`
      );
    }
  } else {
    lines.push("- Stale source reports: none");
  }

  lines.push("", "## Full Repair Command Sequence", "");
  if (report.repairCommandSequence.length) {
    for (const [index, command] of report.repairCommandSequence.slice(0, 120).entries()) {
      lines.push(`- #${index + 1} ${formatCommand(command)}`);
    }
    if (report.repairCommandSequence.length > 120) {
      lines.push(
        `- ... ${report.repairCommandSequence.length - 120} additional command(s) omitted.`
      );
    }
  } else {
    lines.push("- none");
  }

  lines.push("", "## Command Batching", "");
  if (report.repairCommandBatches?.length) {
    for (const batch of report.repairCommandBatches.slice(0, 120)) {
      lines.push(
        `- ${batch.stage}: ${batch.planIds.join(", ")} (${batch.reasonCodes.join("; ")})`
      );
      lines.push(`  - Command: ${formatCommand(batch.command)}`);
    }
    if (report.repairCommandBatches.length > 120) {
      lines.push(
        `- ... ${report.repairCommandBatches.length - 120} additional batch(es) omitted.`
      );
    }
  } else {
    lines.push("- none");
  }

  lines.push("", "## Repair Plans", "");
  if (report.repairPlans.length) {
    for (const plan of report.repairPlans.slice(0, 80)) {
      lines.push(`### ${plan.planId}`, "");
      lines.push(`- Cases: ${plan.caseCount}`);
      lines.push(`- Owners: ${plan.ownerIds.join(", ")}`);
      lines.push(
        `- Classifications: ${plan.categories
          .map((category) => CATEGORY_LABELS[category] ?? category)
          .join(", ")}`
      );
      lines.push(`- Actions: ${plan.actions.join(", ")}`);
      if (plan.commands.length) {
        lines.push("- Targeted repair commands:");
        for (const command of plan.commands) {
          lines.push(`  - ${formatCommand(command)}`);
        }
      }
      lines.push("");
    }
    if (report.repairPlans.length > 80) {
      lines.push(`- ... ${report.repairPlans.length - 80} additional repair plans omitted.`);
      lines.push("");
    }
  } else {
    lines.push("- none", "");
  }

  lines.push("## Cases", "");
  for (const repairCase of report.cases.slice(0, 120)) {
    lines.push(`### ${repairCase.title}`);
    lines.push("");
    lines.push(`- Owner: ${repairCase.ownerId}`);
    lines.push(`- Plan: ${repairCase.planId}`);
    lines.push(`- Campus: ${repairCase.campusId ?? "unknown"}`);
    lines.push(`- Classification: ${repairCase.categoryLabel}`);
    lines.push(`- Severity: ${repairCase.severity}`);
    lines.push(`- Source: ${repairCase.sourceUrl ?? "none"}`);
    lines.push(`- Actions: ${repairCase.actions.join(", ")}`);
    for (const evidence of repairCase.evidence.slice(0, 4)) {
      const details = evidence.details ? `; ${evidence.details}` : "";
      const sourceRole = evidence.sourceRole ? `; role=${evidence.sourceRole}` : "";
      const sourceRoleStatus = evidence.sourceRoleStatus
        ? `; status=${evidence.sourceRoleStatus}`
        : "";
      lines.push(
        `- Evidence: ${evidence.report}:${evidence.code} - ${evidence.message ?? "n/a"}${details}${sourceRole}${sourceRoleStatus}`
      );
    }
    if (repairCase.evidence.length > 4) {
      lines.push(`- Evidence: ... ${repairCase.evidence.length - 4} more signal(s)`);
    }
    lines.push("");
  }
  if (report.cases.length > 120) {
    lines.push(`- ... ${report.cases.length - 120} additional cases omitted.`);
    lines.push("");
  }

  if (report.repairAttempt) {
    lines.push("## Repair Attempt", "");
    lines.push(`- Mode: ${report.repairAttempt.mode}`);
    lines.push(`- Resume mode: ${report.repairAttempt.resumeMode}`);
    if (report.repairAttempt.statePath) {
      lines.push(`- State: ${report.repairAttempt.statePath}`);
    }
    lines.push(`- Total commands in sequence: ${report.repairAttempt.commandCount}`);
    lines.push(`- Start command index: ${report.repairAttempt.startCommandIndex ?? "n/a"}`);
    if (report.repairAttempt.blocked) {
      lines.push(`- Blocked: ${report.repairAttempt.blockedReason}`);
    }
    lines.push(`- Commands attempted: ${report.repairAttempt.commands.length}`);
    lines.push(`- Failed commands: ${report.repairAttempt.failedCommandCount}`);
    for (const command of report.repairAttempt.commands) {
      lines.push(
        `- [${command.status === 0 ? "ok" : "failed"}] #${
          command.commandIndex ?? "?"
        } ${formatCommand(command.command)}`
      );
    }
    lines.push("");

    if (report.repairAttempt.postRepairVerification) {
      const verification = report.repairAttempt.postRepairVerification;
      lines.push("## Post-Repair Verification", "");
      lines.push(`- Enabled: ${verification.enabled ? "yes" : "no"}`);
      if (verification.skippedReason) {
        lines.push(`- Skipped: ${verification.skippedReason}`);
      }
      lines.push(`- Plans verified: ${verification.verifiedPlanCount}`);
      lines.push(`- Cases before: ${verification.summary.beforeCaseCount}`);
      lines.push(`- Cases after: ${verification.summary.afterCaseCount}`);
      lines.push(`- Cases fixed: ${verification.summary.fixedCaseCount}`);
      lines.push(`- New cases: ${verification.summary.newCaseCount}`);
      lines.push(
        `- Verification command failures: ${verification.summary.failedVerificationCommandCount}`
      );
      for (const planResult of verification.planResults.slice(0, 80)) {
        lines.push(
          `- [${planResult.status}] ${planResult.planId}: ${planResult.before.caseCount} -> ${planResult.after.caseCount} case(s), fixed ${planResult.fixedCaseCount}, new ${planResult.newCaseCount}`
        );
        for (const command of planResult.commands) {
          lines.push(
            `  - [${command.status === 0 ? "ok" : "failed"}] ${formatCommand(command.command)}`
          );
        }
      }
      if (verification.planResults.length > 80) {
        lines.push(
          `- ... ${verification.planResults.length - 80} additional verified plan(s) omitted.`
        );
      }
      lines.push("");
    }
  }

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function runCommand(commandParts) {
  const [command, ...args] = commandParts;
  const isWindowsCmd = process.platform === "win32" && /\.cmd$/i.test(command);
  const result = spawnSync(
    isWindowsCmd ? "cmd" : command,
    isWindowsCmd ? ["/c", command, ...args] : args,
    {
      cwd: REPO_ROOT,
      stdio: "inherit",
      shell: false,
      env: process.env,
    }
  );
  return {
    command: commandParts,
    status: result.status ?? 1,
  };
}

function normalizeRepairSourceUrl(value) {
  try {
    const parsed = new URL(String(value ?? ""));
    parsed.hash = "";
    const normalizedPathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${normalizedPathname}${parsed.search}`;
  } catch {
    return normalizeWhitespace(String(value ?? "")).replace(/#.*$/u, "");
  }
}

function buildTargetPlanArgs(planIds) {
  const uniquePlanIds = uniqueSorted(planIds);
  if (uniquePlanIds.length === 1) {
    return ["--target-plan-id", uniquePlanIds[0]];
  }
  return ["--target-plan-ids", uniquePlanIds.join(",")];
}

function buildTargetedCommand(scriptPath, planIds) {
  return ["node", scriptPath, ...buildTargetPlanArgs(planIds)];
}

function createDisjointSet(values) {
  const parentByValue = new Map(values.map((value) => [value, value]));
  const find = (value) => {
    const parent = parentByValue.get(value);
    if (parent == null || parent === value) {
      return value;
    }
    const root = find(parent);
    parentByValue.set(value, root);
    return root;
  };
  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parentByValue.set(rightRoot, leftRoot);
    }
  };
  return { find, union };
}

function buildRepairPlanBatches(repairPlans, stage) {
  const relevantPlans = repairPlans.filter((plan) =>
    stage === "discovery" ? plan.needsSourceDiscovery : plan.needsRequirementParse
  );
  const planIds = uniqueSorted(relevantPlans.map((plan) => plan.planId));
  if (!planIds.length) {
    return [];
  }

  const planById = new Map(relevantPlans.map((plan) => [plan.planId, plan]));
  const disjointSet = createDisjointSet(planIds);
  const reasonsByEdge = new Map();
  const connect = (left, right, reason) => {
    if (!left || !right || left === right) {
      return;
    }
    disjointSet.union(left, right);
    const key = uniqueSorted([left, right]).join("\u0000");
    const reasons = reasonsByEdge.get(key) ?? [];
    reasons.push(reason);
    reasonsByEdge.set(key, uniqueSorted(reasons));
  };

  for (const planId of planIds) {
    for (const candidateParentId of planIds) {
      if (planId !== candidateParentId && planId.startsWith(`${candidateParentId}-`)) {
        connect(candidateParentId, planId, `parent-child:${candidateParentId}`);
      }
    }
  }

  const sourcePlanIdsByUrl = new Map();
  for (const plan of relevantPlans) {
    for (const sourceUrl of plan.sourceUrls ?? []) {
      const normalizedUrl = normalizeRepairSourceUrl(sourceUrl);
      if (!normalizedUrl) {
        continue;
      }
      const sourcePlanIds = sourcePlanIdsByUrl.get(normalizedUrl) ?? [];
      sourcePlanIds.push(plan.planId);
      sourcePlanIdsByUrl.set(normalizedUrl, uniqueSorted(sourcePlanIds));
    }
  }
  for (const [sourceUrl, sourcePlanIds] of sourcePlanIdsByUrl.entries()) {
    if (sourcePlanIds.length < 2) {
      continue;
    }
    for (const planId of sourcePlanIds.slice(1)) {
      connect(sourcePlanIds[0], planId, `same-source:${sourceUrl}`);
    }
  }

  const planIdsByRoot = new Map();
  for (const planId of planIds) {
    const root = disjointSet.find(planId);
    const rootPlanIds = planIdsByRoot.get(root) ?? [];
    rootPlanIds.push(planId);
    planIdsByRoot.set(root, uniqueSorted(rootPlanIds));
  }

  return [...planIdsByRoot.values()]
    .map((batchPlanIds) => {
      const reasons = [];
      for (let leftIndex = 0; leftIndex < batchPlanIds.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < batchPlanIds.length; rightIndex += 1) {
          const edgeKey = uniqueSorted([batchPlanIds[leftIndex], batchPlanIds[rightIndex]]).join(
            "\u0000"
          );
          reasons.push(...(reasonsByEdge.get(edgeKey) ?? []));
        }
      }
      return {
        stage,
        planIds: batchPlanIds,
        planCount: batchPlanIds.length,
        ownerIds: uniqueSorted(batchPlanIds.flatMap((planId) => planById.get(planId)?.ownerIds ?? [])),
        sourceUrls: uniqueSorted(
          batchPlanIds.flatMap((planId) => planById.get(planId)?.sourceUrls ?? [])
        ),
        reasonCodes: uniqueSorted(reasons).length ? uniqueSorted(reasons) : ["single-target"],
      };
    })
    .sort((left, right) => left.planIds[0].localeCompare(right.planIds[0]));
}

function buildRepairCommandPlan(repairPlans) {
  const discoveryBatches = buildRepairPlanBatches(repairPlans, "discovery");
  const parseBatches = buildRepairPlanBatches(repairPlans, "parse");
  const needsRuntimeGeneration = repairPlans.some(
    (plan) => plan.needsRuntimeGeneration || plan.needsRequirementParse
  );
  const commands = [];
  const batches = [];

  for (const batch of discoveryBatches) {
    const command = buildTargetedCommand(
      "scripts/planner/discover-transfer-planner-primary-sources.cjs",
      batch.planIds
    );
    commands.push(command);
    batches.push({ ...batch, command });
  }
  if (discoveryBatches.length) {
    commands.push(["node", "scripts/planner/build-transfer-planner-primary-source-review-queue.cjs"]);
    commands.push(["node", "scripts/planner/build-transfer-planner-primary-source-promotions.cjs"]);
    commands.push(["node", "scripts/planner/build-transfer-planner-source-gap-report.cjs"]);
  }

  for (const batch of parseBatches) {
    const command = buildTargetedCommand(
      "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
      batch.planIds
    );
    commands.push(command);
    batches.push({ ...batch, command });
  }
  if (parseBatches.length) {
    commands.push(["node", "scripts/planner/build-transfer-planner-source-fingerprints.cjs"]);
    commands.push(["node", "scripts/planner/generate-transfer-planner-source-bootstrap.cjs"]);
  }
  if (needsRuntimeGeneration) {
    commands.push(["node", "scripts/planner/generate-transfer-planner-student-runtime.cjs"]);
  }

  return { commands, batches };
}

function buildRepairCommandSequence(repairPlans) {
  return buildRepairCommandPlan(repairPlans).commands;
}

function buildCaseKey(repairCase) {
  return `${repairCase.ownerId}::${repairCase.category}`;
}

function getCasesForPlan(report, planId) {
  return (report.cases ?? []).filter((repairCase) => repairCase.planId === planId);
}

function buildPlanCaseSummary(report, planId) {
  const cases = getCasesForPlan(report, planId);
  return {
    caseCount: cases.length,
    errorCaseCount: cases.filter((repairCase) => repairCase.severity === "error").length,
    warningCaseCount: cases.filter((repairCase) => repairCase.severity === "warning").length,
    countsByCategory: buildCountsBy(cases, (repairCase) => repairCase.category),
    countsByAction: buildCountsBy(
      cases.flatMap((repairCase) => repairCase.actions),
      (action) => action
    ),
    caseKeys: uniqueSorted(cases.map(buildCaseKey)),
  };
}

function comparePlanCaseSummaries(before, after) {
  const beforeKeys = new Set(before.caseKeys ?? []);
  const afterKeys = new Set(after.caseKeys ?? []);
  const fixedCaseKeys = [...beforeKeys].filter((caseKey) => !afterKeys.has(caseKey)).sort();
  const newCaseKeys = [...afterKeys].filter((caseKey) => !beforeKeys.has(caseKey)).sort();
  return {
    fixedCaseKeys,
    newCaseKeys,
    fixedCaseCount: fixedCaseKeys.length,
    newCaseCount: newCaseKeys.length,
  };
}

function getTargetPlanIdsFromCommand(commandParts) {
  const targetPlanIds = [];
  for (let index = 0; index < commandParts.length; index += 1) {
    const part = commandParts[index];
    if (part === "--target-plan-id") {
      targetPlanIds.push(commandParts[index + 1] ?? null);
    } else if (part === "--target-plan-ids") {
      targetPlanIds.push(...String(commandParts[index + 1] ?? "").split(","));
    }
    if (typeof part === "string" && part.startsWith("--target-plan-id=")) {
      targetPlanIds.push(part.slice("--target-plan-id=".length) || null);
    } else if (typeof part === "string" && part.startsWith("--target-plan-ids=")) {
      targetPlanIds.push(...part.slice("--target-plan-ids=".length).split(","));
    }
  }
  return uniqueSorted(targetPlanIds.map((planId) => String(planId ?? "").trim()));
}

function buildPostRepairVerificationPlanIds(selectedPlans, attemptedCommands, commandCount) {
  if (!attemptedCommands.length) {
    return [];
  }

  const selectedPlanIds = new Set(selectedPlans.map((plan) => plan.planId));
  const failedCommandCount = attemptedCommands.filter((command) => command.status !== 0).length;
  if (failedCommandCount === 0 && attemptedCommands.length === commandCount) {
    return [...selectedPlanIds].sort((left, right) => left.localeCompare(right));
  }

  const successfulTargetPlanIds = uniqueSorted(
    attemptedCommands
      .filter((command) => command.status === 0)
      .flatMap((command) => getTargetPlanIdsFromCommand(command.command))
      .filter((planId) => planId && selectedPlanIds.has(planId))
  );
  if (successfulTargetPlanIds.length) {
    return successfulTargetPlanIds;
  }

  const successfulGlobalCommandCount = attemptedCommands.filter(
    (command) => command.status === 0 && !getTargetPlanIdsFromCommand(command.command).length
  ).length;
  return successfulGlobalCommandCount > 0
    ? [...selectedPlanIds].sort((left, right) => left.localeCompare(right))
    : [];
}

function buildPostRepairVerificationCommands(planId) {
  return [
    [
      "node",
      "scripts/planner/verify-transfer-planner-owner-audit.cjs",
      "--target-plan-id",
      planId,
    ],
    [
      "node",
      "scripts/planner/audit-transfer-planner-source-backed-coverage.cjs",
      "--target-plan-id",
      planId,
      "--report-only",
    ],
  ];
}

function buildSkippedPostRepairVerification(report, selectedPlans, reason) {
  const beforeCaseCount = selectedPlans.reduce(
    (count, plan) => count + buildPlanCaseSummary(report, plan.planId).caseCount,
    0
  );
  return {
    enabled: false,
    skippedReason: reason,
    verifiedPlanCount: 0,
    planResults: [],
    summary: {
      beforeCaseCount,
      afterCaseCount: beforeCaseCount,
      fixedCaseCount: 0,
      newCaseCount: 0,
      failedVerificationCommandCount: 0,
    },
  };
}

function summarizePostRepairVerification(planResults) {
  return planResults.reduce(
    (summary, planResult) => {
      summary.beforeCaseCount += planResult.before.caseCount;
      summary.afterCaseCount += planResult.after.caseCount;
      summary.fixedCaseCount += planResult.fixedCaseCount;
      summary.newCaseCount += planResult.newCaseCount;
      summary.failedVerificationCommandCount += planResult.failedVerificationCommandCount;
      return summary;
    },
    {
      beforeCaseCount: 0,
      afterCaseCount: 0,
      fixedCaseCount: 0,
      newCaseCount: 0,
      failedVerificationCommandCount: 0,
    }
  );
}

function getPostRepairVerificationStatus(comparison) {
  if (comparison.newCaseCount > 0 && comparison.fixedCaseCount === 0) {
    return "regressed";
  }
  if (comparison.fixedCaseCount > 0) {
    return comparison.newCaseCount > 0 ? "changed" : "improved";
  }
  return "unchanged";
}

function runPostRepairVerification({
  report,
  options,
  selectedPlans,
  attemptedCommands,
  commandCount,
  commandRunner = runCommand,
  reportBuilder = buildReport,
}) {
  if (options.postRepairVerification === false) {
    return buildSkippedPostRepairVerification(
      report,
      selectedPlans,
      "post-repair verification disabled"
    );
  }

  const selectedPlansById = new Map(selectedPlans.map((plan) => [plan.planId, plan]));
  const planIds = buildPostRepairVerificationPlanIds(
    selectedPlans,
    attemptedCommands,
    commandCount
  );
  if (!planIds.length) {
    return buildSkippedPostRepairVerification(
      report,
      selectedPlans,
      "no successfully touched target plans"
    );
  }

  const restorablePaths =
    options.postRepairVerificationRestorablePaths ?? POST_REPAIR_VERIFICATION_RESTORABLE_PATHS;
  const reportFileSnapshot = snapshotFiles(restorablePaths);
  const planResults = [];

  for (const planId of planIds) {
    restoreFileSnapshot(reportFileSnapshot);
    const plan = selectedPlansById.get(planId);
    const before = buildPlanCaseSummary(report, planId);
    const commands = buildPostRepairVerificationCommands(planId);
    const commandResults = commands.map((command) => ({ ...commandRunner(command), command }));
    let after = before;
    let status = "verification-error";
    let error = null;

    try {
      const afterReport = reportBuilder({ ...options, targetPlanId: planId, repair: false });
      after = buildPlanCaseSummary(afterReport, planId);
      const comparison = comparePlanCaseSummaries(before, after);
      status = getPostRepairVerificationStatus(comparison);
      planResults.push({
        planId,
        actions: plan?.actions ?? [],
        commands: commandResults,
        failedVerificationCommandCount: commandResults.filter((command) => command.status !== 0)
          .length,
        before,
        after,
        ...comparison,
        status,
        error,
      });
    } catch (caughtError) {
      error = caughtError instanceof Error ? caughtError.message : String(caughtError);
      planResults.push({
        planId,
        actions: plan?.actions ?? [],
        commands: commandResults,
        failedVerificationCommandCount: commandResults.filter((command) => command.status !== 0)
          .length,
        before,
        after,
        fixedCaseKeys: [],
        newCaseKeys: [],
        fixedCaseCount: 0,
        newCaseCount: 0,
        status,
        error,
      });
    } finally {
      restoreFileSnapshot(reportFileSnapshot);
    }
  }

  return {
    enabled: true,
    skippedReason: null,
    verifiedPlanCount: planResults.length,
    planResults,
    summary: summarizePostRepairVerification(planResults),
  };
}

function buildRepairAttemptState({
  report,
  options,
  selectedPlans,
  skippedPlanCount,
  commands,
  commandBatches,
  attemptedCommands,
  startCommandIndex,
  postRepairVerification,
}) {
  return {
    generatedAt: new Date().toISOString(),
    planGeneratedAt: report.generatedAt,
    targetPlanId: report.targetPlanId,
    maxRepairPlans: options.maxRepairPlans ?? null,
    selectedPlanCount: selectedPlans.length,
    selectedPlanIds: selectedPlans.map((plan) => plan.planId),
    skippedPlanCount,
    commandCount: commands.length,
    startCommandIndex,
    resumeMode: getRepairResumeMode(options),
    commandSequence: buildRepairCommandRecords(commands),
    commandBatches,
    attemptedCommands,
    failedCommandCount: attemptedCommands.filter((command) => command.status !== 0).length,
    postRepairVerification,
  };
}

function runRepairAttempt(
  report,
  options,
  commandRunner = runCommand,
  stateWriter = writeRepairAttemptState,
  savedState = undefined,
  postRepairVerifier = runPostRepairVerification
) {
  const maxRepairPlans = options.maxRepairPlans;
  const selectedPlans =
    maxRepairPlans == null ? report.repairPlans : report.repairPlans.slice(0, maxRepairPlans);
  const skippedPlanCount = report.repairPlans.length - selectedPlans.length;
  const commandPlan = buildRepairCommandPlan(selectedPlans);
  const commands = commandPlan.commands;
  const startCommandIndex = resolveRepairStartCommandIndex(commands, options, savedState);
  const attemptedCommands = [];

  for (
    let commandIndex = startCommandIndex - 1;
    commandIndex < commands.length;
    commandIndex += 1
  ) {
    const result = commandRunner(commands[commandIndex]);
    attemptedCommands.push({
      ...result,
      command: result.command ?? commands[commandIndex],
      commandIndex: commandIndex + 1,
    });
    if (result.status !== 0) {
      break;
    }
  }

  const postRepairVerification = postRepairVerifier({
    report,
    options,
    selectedPlans,
    attemptedCommands,
    commandCount: commands.length,
    commandRunner,
  });

  const state = buildRepairAttemptState({
    report,
    options,
    selectedPlans,
    skippedPlanCount,
    commands,
    commandBatches: commandPlan.batches,
    attemptedCommands,
    startCommandIndex,
    postRepairVerification,
  });
  const statePath = options.repairAttemptStatePath ?? REPAIR_ATTEMPT_STATE_PATH;
  stateWriter(state, statePath);

  return {
    mode: options.repair ? "repair" : "plan-only",
    resumeMode: getRepairResumeMode(options),
    maxRepairPlans: maxRepairPlans ?? null,
    selectedPlanCount: selectedPlans.length,
    skippedPlanCount,
    commandCount: commands.length,
    commandBatches: commandPlan.batches,
    startCommandIndex,
    statePath,
    commands: attemptedCommands,
    failedCommandCount: attemptedCommands.filter((command) => command.status !== 0).length,
    postRepairVerification,
    blocked: false,
    blockedReason: null,
  };
}

function parseOptions() {
  const resumeFailed = hasArg("--resume-failed");
  const fromCommandIndex = getCommandIndexArgValue("--from-command-index");
  if (resumeFailed && fromCommandIndex != null) {
    throw new Error("Use either --resume-failed or --from-command-index, not both.");
  }

  return {
    repair: hasArg("--repair"),
    targetPlanId: getArgValue("--target-plan-id"),
    maxRepairPlans: getNumericArgValue("--max-repair-plans"),
    resumeFailed,
    fromCommandIndex,
    repairAttemptStatePath: REPAIR_ATTEMPT_STATE_PATH,
    postRepairVerification: !hasArg("--skip-post-repair-verification"),
  };
}

function buildEmptyRepairAttempt(report, options, overrides = {}) {
  return {
    mode: options.repair ? "repair" : "plan-only",
    resumeMode: getRepairResumeMode(options),
    maxRepairPlans: options.maxRepairPlans ?? null,
    selectedPlanCount: 0,
    skippedPlanCount: report.repairPlans.length,
    commandCount: 0,
    commandBatches: [],
    startCommandIndex: null,
    statePath: null,
    commands: [],
    failedCommandCount: 0,
    postRepairVerification: null,
    blocked: false,
    blockedReason: null,
    ...overrides,
  };
}

function main() {
  ensureTmpDir();
  let options;
  try {
    options = parseOptions();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  const report = buildReport(options);

  if (
    options.repair &&
    report.repairPlans.length &&
    report.sourceReportFreshness.outcome === "stale"
  ) {
    report.repairAttempt = buildEmptyRepairAttempt(report, options, {
      blocked: true,
      blockedReason:
        "One or more source reports are older than the generated outputs selected for repair. Rerun the relevant audits/reports before auto-repair.",
    });
  } else if (options.repair && report.repairPlans.length) {
    try {
      report.repairAttempt = runRepairAttempt(report, options);
    } catch (error) {
      report.repairAttempt = buildEmptyRepairAttempt(report, options, {
        blocked: true,
        blockedReason: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    report.repairAttempt = buildEmptyRepairAttempt(report, options);
  }

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeMarkdown(report);

  console.log(`Auto-repair cases: ${report.caseCount}`);
  console.log(`Affected owners: ${report.ownerCount}`);
  console.log(`Affected plans: ${report.planCount}`);
  console.log(`Repair plans: ${report.repairPlans.length}`);
  console.log(`Source report freshness: ${report.sourceReportFreshness.outcome}`);
  if (report.sourceReportFreshness.staleReports.length) {
    console.warn(
      `Stale source reports: ${report.sourceReportFreshness.staleReports
        .map((entry) => entry.label)
        .join(", ")}`
    );
  }
  if (report.repairAttempt?.blocked) {
    console.error(`Auto-repair blocked: ${report.repairAttempt.blockedReason}`);
  }
  if (report.repairAttempt?.commands?.length) {
    console.log(`Repair commands attempted: ${report.repairAttempt.commands.length}`);
    console.log(`Repair command failures: ${report.repairAttempt.failedCommandCount}`);
  }
  if (report.repairAttempt?.postRepairVerification?.enabled) {
    const summary = report.repairAttempt.postRepairVerification.summary;
    console.log(
      `Post-repair verification: ${report.repairAttempt.postRepairVerification.verifiedPlanCount} plan(s), cases ${summary.beforeCaseCount} -> ${summary.afterCaseCount}, fixed ${summary.fixedCaseCount}, new ${summary.newCaseCount}`
    );
    console.log(
      `Post-repair verification command failures: ${summary.failedVerificationCommandCount}`
    );
  } else if (report.repairAttempt?.postRepairVerification?.skippedReason) {
    console.log(
      `Post-repair verification skipped: ${report.repairAttempt.postRepairVerification.skippedReason}`
    );
  }
  if (report.repairAttempt?.startCommandIndex != null) {
    console.log(`Repair start command index: ${report.repairAttempt.startCommandIndex}`);
  }
  if (report.repairAttempt?.statePath) {
    console.log(`Repair state: ${report.repairAttempt.statePath}`);
  }
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);

  if (report.repairAttempt?.blocked || report.repairAttempt?.failedCommandCount > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  REPAIR_ATTEMPT_STATE_PATH,
  REPORT_FRESHNESS_TOLERANCE_MS,
  buildFreshnessReport,
  buildGeneratedOutputKeysForRepairPlans,
  buildPlanCaseSummary,
  buildRepairCommandPlan,
  buildPostRepairVerificationPlanIds,
  runPostRepairVerification,
  resolveRepairStartCommandIndex,
  runRepairAttempt,
};
