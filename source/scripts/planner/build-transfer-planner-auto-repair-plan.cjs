/* global __dirname */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-auto-repair-plan.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-auto-repair-plan.md");
const OWNER_AUDIT_PATH = path.resolve(TMP_DIR, "transfer-planner-owner-audit.json");
const REQUIREMENT_PARSE_REPORT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-requirement-source-parse-report.json"
);
const SOURCE_BACKED_AUDIT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-source-backed-coverage-audit.json"
);
const PRIMARY_SOURCE_DISCOVERY_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-primary-source-discovery.json"
);
const SOURCE_CHANGE_CLASSIFICATION_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-source-change-classification.json"
);

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

function readJsonReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(reportPath, "utf8"));
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
        commands: [],
      };
    plan.ownerIds = uniqueSorted([...plan.ownerIds, repairCase.ownerId]);
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
  const repairCommandSequence = buildRepairCommandSequence(repairPlans);

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
    repairPlans,
    cases,
    repairAttempt: null,
  };
}

function formatCommand(commandParts) {
  return commandParts.join(" ");
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

  lines.push("", "## Full Repair Command Sequence", "");
  if (report.repairCommandSequence.length) {
    for (const command of report.repairCommandSequence.slice(0, 120)) {
      lines.push(`- ${formatCommand(command)}`);
    }
    if (report.repairCommandSequence.length > 120) {
      lines.push(
        `- ... ${report.repairCommandSequence.length - 120} additional command(s) omitted.`
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
    lines.push(`- Commands attempted: ${report.repairAttempt.commands.length}`);
    lines.push(`- Failed commands: ${report.repairAttempt.failedCommandCount}`);
    for (const command of report.repairAttempt.commands) {
      lines.push(
        `- [${command.status === 0 ? "ok" : "failed"}] ${formatCommand(command.command)}`
      );
    }
    lines.push("");
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

function buildRepairCommandSequence(repairPlans) {
  const discoveryPlanIds = uniqueSorted(
    repairPlans.filter((plan) => plan.needsSourceDiscovery).map((plan) => plan.planId)
  );
  const parsePlanIds = uniqueSorted(
    repairPlans.filter((plan) => plan.needsRequirementParse).map((plan) => plan.planId)
  );
  const needsRuntimeGeneration = repairPlans.some(
    (plan) => plan.needsRuntimeGeneration || plan.needsRequirementParse
  );
  const commands = [];

  for (const planId of discoveryPlanIds) {
    commands.push([
      "node",
      "scripts/planner/discover-transfer-planner-primary-sources.cjs",
      "--target-plan-id",
      planId,
    ]);
  }
  if (discoveryPlanIds.length) {
    commands.push(["node", "scripts/planner/build-transfer-planner-primary-source-review-queue.cjs"]);
    commands.push(["node", "scripts/planner/build-transfer-planner-primary-source-promotions.cjs"]);
    commands.push(["node", "scripts/planner/build-transfer-planner-source-gap-report.cjs"]);
  }

  for (const planId of parsePlanIds) {
    commands.push([
      "node",
      "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
      "--target-plan-id",
      planId,
    ]);
  }
  if (parsePlanIds.length) {
    commands.push(["node", "scripts/planner/build-transfer-planner-source-fingerprints.cjs"]);
    commands.push(["node", "scripts/planner/generate-transfer-planner-source-bootstrap.cjs"]);
  }
  if (needsRuntimeGeneration) {
    commands.push(["node", "scripts/planner/generate-transfer-planner-student-runtime.cjs"]);
  }

  return commands;
}

function runRepairAttempt(report, options) {
  const maxRepairPlans = options.maxRepairPlans;
  const selectedPlans =
    maxRepairPlans == null ? report.repairPlans : report.repairPlans.slice(0, maxRepairPlans);
  const skippedPlanCount = report.repairPlans.length - selectedPlans.length;
  const commands = buildRepairCommandSequence(selectedPlans);
  const attemptedCommands = [];

  for (const command of commands) {
    const result = runCommand(command);
    attemptedCommands.push(result);
    if (result.status !== 0) {
      break;
    }
  }

  return {
    mode: options.repair ? "repair" : "plan-only",
    maxRepairPlans: maxRepairPlans ?? null,
    selectedPlanCount: selectedPlans.length,
    skippedPlanCount,
    commands: attemptedCommands,
    failedCommandCount: attemptedCommands.filter((command) => command.status !== 0).length,
  };
}

function parseOptions() {
  return {
    repair: hasArg("--repair"),
    targetPlanId: getArgValue("--target-plan-id"),
    maxRepairPlans: getNumericArgValue("--max-repair-plans"),
  };
}

function main() {
  ensureTmpDir();
  const options = parseOptions();
  const report = buildReport(options);

  if (options.repair && report.repairPlans.length) {
    report.repairAttempt = runRepairAttempt(report, options);
  } else {
    report.repairAttempt = {
      mode: options.repair ? "repair" : "plan-only",
      maxRepairPlans: options.maxRepairPlans ?? null,
      selectedPlanCount: 0,
      skippedPlanCount: report.repairPlans.length,
      commands: [],
      failedCommandCount: 0,
    };
  }

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeMarkdown(report);

  console.log(`Auto-repair cases: ${report.caseCount}`);
  console.log(`Affected owners: ${report.ownerCount}`);
  console.log(`Affected plans: ${report.planCount}`);
  console.log(`Repair plans: ${report.repairPlans.length}`);
  if (report.repairAttempt?.commands?.length) {
    console.log(`Repair commands attempted: ${report.repairAttempt.commands.length}`);
    console.log(`Repair command failures: ${report.repairAttempt.failedCommandCount}`);
  }
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);

  if (report.repairAttempt?.failedCommandCount > 0) {
    process.exitCode = 1;
  }
}

main();
