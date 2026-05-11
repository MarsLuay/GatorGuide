const SOURCE_BACKED_COVERAGE_GATE_LABEL = "source-backed-runtime-coverage";
const SOURCE_BACKED_COVERAGE_GATE_DESCRIPTION =
  "Blocking gate from official source parse through generated data to the student-visible runtime.";
const HIGH_RISK_SOURCE_BACKED_AUDIT_CATEGORIES = [
  "CE/CS approved-course-list support sources",
  "credit buckets",
  "option groups",
  "pathways/tracks",
  "generated filters",
  "owners with parser extraction regressions",
  "owners with source-role/fingerprint deltas",
];

const SOURCE_BACKED_AUDIT_ROW_COLLECTIONS = [
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

function getRowIssueType(row) {
  if (row?.issueType) {
    return row.issueType;
  }
  if (row?.issue && row.issue !== "none") {
    return row.issue;
  }
  return null;
}

function hasAuditIssue(row) {
  return Boolean(getRowIssueType(row));
}

function getActionableIssueClass(row) {
  const issueType = getRowIssueType(row);
  if (!issueType) {
    return null;
  }

  if (issueType === "missing-detected-course") {
    if (row.generatedRuntimeRow === false) {
      return "source-course-parsed-not-generated";
    }
    if (row.visibleInTransferOnlyQuarterPlan === false || row.visibleInPlan === false) {
      return "generated-row-exists-but-not-visible";
    }
    return "primary-required-course-missing-from-runtime";
  }

  if (
    [
      "generated-row-without-primary-source",
      "hidden-row-as-required",
      "hidden-informational-row-scheduled",
    ].includes(issueType)
  ) {
    return "visible-row-lacks-source-evidence";
  }

  if (
    [
      "support-source-emitted-required-row",
      "support-source-created-required-row",
      "approved-list-source-created-required-row",
      "approved-course-list-promoted-to-required",
      "elective-list-promoted-to-required",
      "support-source-generated-required-row",
      "support-metadata-became-required",
      "approved-list-generated-required-row",
      "elective-list-generated-required-row",
      "list-promoted-to-required",
      "support-list-scheduled",
      "elective-list-as-required",
      "non-schedulable-source-scheduled",
      "non-schedulable-course-list-scheduled",
      "upper-division-prerequisite-table-scheduled",
    ].includes(issueType)
  ) {
    return "support-only-course-scheduled-as-required";
  }

  if (
    [
      "missing-credit-bucket",
      "required-count-used-for-credit-bucket",
      "flattened-credit-bucket",
      "credit-bucket-as-count",
    ].includes(issueType)
  ) {
    return "credit-bucket-lost-or-flattened";
  }

  if (
    [
      "placeholder-atom-scheduled",
      "placeholder-promoted-to-required",
      "false-required-sibling",
      "false-required-promotion",
      "fake-category-course",
      "category-option-invented-course",
    ].includes(issueType)
  ) {
    return "placeholder-scheduled-as-false-required";
  }

  if (
    [
      "missing-option-group",
      "missed-option-group",
      "option-group-disappears-after-refresh",
      "missing-category-option",
      "flattened-option-group",
      "flattened-option",
      "wrong-shape",
      "missing-list-shape",
      "missed-sequence-choice",
      "flattened-sequence-choice",
      "sequence-choice-flattened",
      "flattened-sequence-paths",
    ].includes(issueType)
  ) {
    return "option-group-collapsed-to-single-course";
  }

  if (
    [
      "missing-equivalency",
      "fake-equivalency",
      "unsupported-substitution",
      "stale-equivalency",
      "missing-compound-path",
      "partial-compound-path",
      "over-expanded-compound-path",
      "duplicate-compound-count",
      "partial-compound-path-scheduled",
      "missing-compound-component",
      "duplicate-compound-component",
      "over-scheduled-alternatives",
      "unmapped-uw-only",
    ].includes(issueType)
  ) {
    return "equivalent-grc-course-missing-or-over-selected";
  }

  if (
    [
      "parser-source-scope-violation",
      "source-scope-contamination",
      "unscoped-generated-seed",
      "stale-manual-seed",
      "pathway-leak",
      "path-note-unscoped",
      "prerequisite-table-emitted-requirement",
      "course-list-emitted-requirement",
    ].includes(issueType)
  ) {
    return "source-role-misclassified";
  }

  return issueType;
}

function getSuspectedLayerForActionableIssue(row) {
  const issueType = getRowIssueType(row);
  const actionableClass = getActionableIssueClass(row);
  if (!issueType) {
    return null;
  }

  if (
    [
      "missing-approved-course-list-source",
      "missing-elective-list-source",
      "source-role-misclassified",
    ].includes(issueType) ||
    actionableClass === "source-role-misclassified"
  ) {
    return "discovery";
  }

  if (
    [
      "parser-source-scope-violation",
      "source-scope-contamination",
      "prerequisite-table-emitted-requirement",
      "course-list-emitted-requirement",
      "missed-option-group",
      "missing-option-group",
      "missing-credit-bucket",
      "missed-sequence-choice",
      "unsafe-comma-list",
      "flattened-sequence-paths",
      "merged-adjacent-rows",
      "false-required-promotion",
      "approved-list-source-created-required-row",
      "elective-list-promoted-to-required",
      "approved-course-list-promoted-to-required",
      "support-source-created-required-row",
      "support-source-emitted-required-row",
      "missing-category-option",
    ].includes(issueType)
  ) {
    return "parser";
  }

  if (
    actionableClass === "source-course-parsed-not-generated" ||
    actionableClass === "primary-required-course-missing-from-runtime" ||
    actionableClass === "credit-bucket-lost-or-flattened" ||
    actionableClass === "option-group-collapsed-to-single-course" ||
    actionableClass === "visible-row-lacks-source-evidence" ||
    [
      "unscoped-generated-seed",
      "support-source-generated-required-row",
      "support-metadata-became-required",
      "approved-list-generated-required-row",
      "elective-list-generated-required-row",
      "generated-row-without-primary-source",
      "stale-manual-seed",
      "flattened-option-group",
      "flattened-credit-bucket",
      "flattened-sequence-choice",
      "wrong-shape",
      "credit-bucket-as-count",
      "sequence-choice-flattened",
      "missing-list-shape",
      "missing-program-approved-filter",
      "missing-approved-filter",
      "missing-ce-approved-filter",
    ].includes(issueType)
  ) {
    return "generator";
  }

  if (
    actionableClass === "generated-row-exists-but-not-visible" ||
    actionableClass === "placeholder-scheduled-as-false-required" ||
    [
      "unselected-option-scheduled",
      "selected-option-not-scheduled",
      "stale-selection",
      "false-required-sibling",
      "placeholder-atom-scheduled",
      "non-selected-compound-option-scheduled",
      "mixed-sequence-paths",
      "standalone-lab-component-scheduled",
      "placeholder-promoted-to-required",
      "partial-compound-path-scheduled",
      "missing-compound-component",
      "duplicate-compound-component",
    ].includes(issueType)
  ) {
    return "runtime";
  }

  if (actionableClass === "equivalent-grc-course-missing-or-over-selected") {
    return "mapping";
  }

  if (actionableClass === "support-only-course-scheduled-as-required") {
    return row.generatedArtifact || row.generatedFile || row.generatedRuntimeRow ? "generator" : "parser";
  }

  return "audit expectation";
}

function getRecommendedFixForLayer(layer, row) {
  const issueType = getRowIssueType(row);
  switch (layer) {
    case "discovery":
      return {
        recommendedFixPath: "source/scripts/planner/discover-transfer-planner-primary-sources.cjs",
        recommendedNonManualFix:
          "Fix source discovery or manifest role selection so the official primary/support source is classified before parsing.",
      };
    case "parser":
      return {
        recommendedFixPath: "source/scripts/planner/parse-transfer-planner-requirement-sources.cjs",
        recommendedNonManualFix:
          "Fix parser extraction, row-boundary, or source-role rules, then regenerate planner artifacts.",
      };
    case "generator":
      if (
        [
          "missing-program-approved-filter",
          "missing-approved-filter",
          "missing-ce-approved-filter",
        ].includes(issueType)
      ) {
        return {
          recommendedFixPath:
            "source/scripts/planner/parse-transfer-planner-requirement-sources.cjs -> source/scripts/planner/generate-transfer-planner-student-runtime.cjs",
          recommendedNonManualFix:
            "Fix approved-list parsing or generated filter wiring so support lists constrain choices without creating required rows.",
        };
      }
      return {
        recommendedFixPath: "source/scripts/planner/generate-transfer-planner-student-runtime.cjs",
        recommendedNonManualFix:
          "Fix generated runtime shape/source metadata rules and rerun the generator; do not hand-edit generated planner data.",
      };
    case "runtime":
      return {
        recommendedFixPath: "source/services/planning/transfer-planner.service.ts",
        recommendedNonManualFix:
          "Fix runtime visibility, option selection, or scheduling logic so generated source-backed rows surface accurately.",
      };
    case "mapping":
      return {
        recommendedFixPath: "source/scripts/planner/parse-transfer-planner-equivalency-guide.cjs",
        recommendedNonManualFix:
          "Fix official UW-GRC equivalency parsing or mapping normalization, then regenerate planner metadata.",
      };
    default:
      return {
        recommendedFixPath: "source/scripts/planner/audit-transfer-planner-source-backed-coverage.cjs",
        recommendedNonManualFix:
          "Review the audit expectation and tighten it only if the official source/runtime behavior is already correct.",
      };
  }
}

function parseOwnerId(ownerId) {
  const owner = String(ownerId ?? "");
  const [planId, pathwayId] = owner.split(":pathway:");
  return {
    planId: planId || null,
    pathwayId: pathwayId || null,
  };
}

function getDefaultPlanContextForAuditRow(row) {
  const parsedOwner = parseOwnerId(row.ownerId);
  const planId = row.planId ?? row.majorId ?? parsedOwner.planId;
  const pathwayId = row.pathwayId ?? parsedOwner.pathwayId ?? null;
  return {
    ownerId: row.ownerId ?? (planId ? `${planId}${pathwayId ? `:pathway:${pathwayId}` : ""}` : "unknown"),
    planId: planId ?? null,
    campusId: row.campusId ?? null,
    collegeId: row.collegeId ?? null,
    majorTitle: row.majorTitle ?? null,
    pathwayId,
    pathwayTitle: row.pathwayTitle ?? null,
  };
}

function getAuditRowSourceUrl(row) {
  return row.sourceUrl ?? row.uwSourceUrl ?? row.primarySourceUrl ?? row.primarySource ?? null;
}

function getAuditRowSourceRole(row) {
  return row.sourceRole ?? row.detectedSourceRole ?? null;
}

function getGeneratedRowId(row) {
  return (
    row.generatedRowId ??
    row.requirementId ??
    row.requirementGroupId ??
    row.requirementCourse ??
    row.usedByRequirement ??
    null
  );
}

function getRuntimeVisibilityStatus(row) {
  const parts = [];
  if (typeof row.generatedRuntimeRow === "boolean") {
    parts.push(`generated-row=${row.generatedRuntimeRow ? "yes" : "no"}`);
  }
  if (typeof row.visibleInTransferOnlyQuarterPlan === "boolean") {
    parts.push(`student-visible=${row.visibleInTransferOnlyQuarterPlan ? "yes" : "no"}`);
  }
  if (typeof row.visibleInPlan === "boolean") {
    parts.push(`student-visible=${row.visibleInPlan ? "yes" : "no"}`);
  }
  if (typeof row.visibleInTransferOnlyPlan === "boolean") {
    parts.push(`student-visible=${row.visibleInTransferOnlyPlan ? "yes" : "no"}`);
  }
  if (typeof row.scheduled === "boolean") {
    parts.push(`scheduled=${row.scheduled ? "yes" : "no"}`);
  }
  if (typeof row.canCreateScheduleRow === "boolean") {
    parts.push(`can-create-schedule-row=${row.canCreateScheduleRow ? "yes" : "no"}`);
  }
  if (typeof row.canCreateSchedulableRows === "boolean") {
    parts.push(`can-create-schedulable-rows=${row.canCreateSchedulableRows ? "yes" : "no"}`);
  }
  if (row.hiddenInternalReason) {
    parts.push(`hidden-reason=${row.hiddenInternalReason}`);
  }
  return parts.length ? parts.join("; ") : "not reported";
}

function getParsedSourceEvidence(row) {
  const parts = [
    row.parsedSourceEvidence,
    row.sourceSection,
    row.sourceHeading,
    row.sourceParserShape,
    row.expectedParserShape,
    row.uwRequirementLabel,
    row.requirementTitle,
    row.listTitle,
    Array.isArray(row.sourceLineHints) ? row.sourceLineHints.join(" | ") : null,
    row.rawRowText,
    row.copyOnlyDebugText,
  ]
    .map((part) => String(part ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const evidence = parts.find(Boolean) ?? "not reported";
  return evidence.length > 420 ? `${evidence.slice(0, 417)}...` : evidence;
}

function buildActionableAuditIssueMetadata(row, collectionName = "unknown", options = {}) {
  const issueType = getRowIssueType(row);
  if (!issueType) {
    return {};
  }

  const actionableIssueClass = getActionableIssueClass(row);
  const suspectedLayer = getSuspectedLayerForActionableIssue(row);
  const recommendation = getRecommendedFixForLayer(suspectedLayer, row);
  const planContext = options.planContextResolver
    ? options.planContextResolver(row)
    : getDefaultPlanContextForAuditRow(row);
  const metadata = {
    blockingGate: SOURCE_BACKED_COVERAGE_GATE_LABEL,
    auditCollection: collectionName,
    issueTypeNormalized: issueType,
    actionableIssueClass,
    suspectedLayer,
    recommendedFixPath: recommendation.recommendedFixPath,
    recommendedNonManualFix: recommendation.recommendedNonManualFix,
    planContext,
    auditSourceUrl: getAuditRowSourceUrl(row),
    auditSourceRole: getAuditRowSourceRole(row),
    parsedSourceEvidence: getParsedSourceEvidence(row),
    generatedRowId: getGeneratedRowId(row),
    runtimeVisibilityStatus: getRuntimeVisibilityStatus(row),
  };
  const actionableText = [
    "[actionable source-backed gate]",
    `Class: ${actionableIssueClass}`,
    `Layer: ${suspectedLayer}`,
    `Generated row id: ${metadata.generatedRowId ?? "none"}`,
    `Runtime visibility: ${metadata.runtimeVisibilityStatus}`,
    `Recommended non-manual fix: ${metadata.recommendedFixPath}`,
  ].join(" ");

  if (
    row.copyOnlyDebugText &&
    !String(row.copyOnlyDebugText).includes("[actionable source-backed gate]")
  ) {
    metadata.copyOnlyDebugText = `${row.copyOnlyDebugText} ${actionableText}`;
  }

  return metadata;
}

function enrichAuditRowsInPlace(rows, collectionName, options = {}) {
  for (const row of rows ?? []) {
    if (!hasAuditIssue(row)) {
      continue;
    }
    Object.assign(row, buildActionableAuditIssueMetadata(row, collectionName, options));
  }
}

function collectActionableIssueRows(report) {
  return SOURCE_BACKED_AUDIT_ROW_COLLECTIONS.flatMap((collectionName) =>
    (report[collectionName] ?? []).filter(hasAuditIssue)
  );
}

function countBy(values) {
  const counts = {};
  for (const value of values.filter(Boolean)) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
}

function enrichSourceBackedCoverageReport(report, options = {}) {
  for (const collectionName of SOURCE_BACKED_AUDIT_ROW_COLLECTIONS) {
    enrichAuditRowsInPlace(report[collectionName] ?? [], collectionName, options);
  }
  const actionableIssueRows = collectActionableIssueRows(report);
  report.summary = {
    ...report.summary,
    blockingGate: SOURCE_BACKED_COVERAGE_GATE_LABEL,
    blockingGateDescription: SOURCE_BACKED_COVERAGE_GATE_DESCRIPTION,
    blockingGateIssueCount: actionableIssueRows.length,
    highRiskAuditCategories: HIGH_RISK_SOURCE_BACKED_AUDIT_CATEGORIES,
    issueCountsBySuspectedLayer: countBy(
      actionableIssueRows.map((row) => row.suspectedLayer ?? "audit expectation")
    ),
    issueCountsByActionableClass: countBy(
      actionableIssueRows.map((row) => row.actionableIssueClass ?? getRowIssueType(row))
    ),
  };
  return report;
}

module.exports = {
  SOURCE_BACKED_COVERAGE_GATE_LABEL,
  SOURCE_BACKED_COVERAGE_GATE_DESCRIPTION,
  HIGH_RISK_SOURCE_BACKED_AUDIT_CATEGORIES,
  SOURCE_BACKED_AUDIT_ROW_COLLECTIONS,
  getRowIssueType,
  hasAuditIssue,
  getActionableIssueClass,
  getSuspectedLayerForActionableIssue,
  getRecommendedFixForLayer,
  buildActionableAuditIssueMetadata,
  collectActionableIssueRows,
  enrichSourceBackedCoverageReport,
};
