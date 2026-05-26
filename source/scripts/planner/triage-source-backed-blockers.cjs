/* global __dirname */
const fs = require("fs");
const path = require("path");
const {
  SOURCE_ROOT,
  ensurePlannerTmpLayout,
  getPlannerTmpPath,
  writePlannerJsonReport,
  writePlannerMarkdownReport,
} = require("./lib/script-harness.cjs");

const {
  AUDIT_ROW_COLLECTIONS,
  getRowIssueType,
  hasAuditIssue,
  getActionableIssueClass,
  getSuspectedLayerForActionableIssue,
  getRecommendedFixForLayer,
  buildActionableAuditIssueMetadata,
} = require("./source-backed-coverage-actionability.cjs");

const REPO_ROOT = SOURCE_ROOT;
ensurePlannerTmpLayout();
const AUDIT_PATH = getPlannerTmpPath("transfer-planner-source-backed-coverage-audit.json");
const AUTO_REPAIR_PLAN_PATH = getPlannerTmpPath("transfer-planner-auto-repair-plan.json");
const TRIAGE_JSON_PATH = getPlannerTmpPath("transfer-planner-source-backed-blocker-triage.json");
const TRIAGE_MD_PATH = getPlannerTmpPath("transfer-planner-source-backed-blocker-triage.md");
const REPAIR_QUEUE_JSON_PATH = getPlannerTmpPath("transfer-planner-repair-queue.json");
const REPAIR_QUEUE_MD_PATH = getPlannerTmpPath("transfer-planner-repair-queue.md");

const TOP_LIMIT = 30;

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found at ${path.relative(REPO_ROOT, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writePlannerJsonReport(filePath, value);
}

function writeText(filePath, value) {
  writePlannerMarkdownReport(filePath, value);
}

function compactText(value, maxLength = 260) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function firstPresent(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) {
      return value;
    }
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean).map(String))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function parseOwnerId(ownerId) {
  const owner = String(ownerId ?? "");
  const [planId, pathwayId] = owner.split(":pathway:");
  return {
    planId: planId || null,
    pathwayId: pathwayId || null,
  };
}

function getPlanContext(row) {
  const existing = row.planContext ?? {};
  const parsedOwner = parseOwnerId(row.ownerId);
  const planId = firstPresent(row.planId, row.majorId, existing.planId, parsedOwner.planId);
  const pathwayId = firstPresent(row.pathwayId, existing.pathwayId, parsedOwner.pathwayId);
  const ownerId = firstPresent(
    row.ownerId,
    existing.ownerId,
    planId ? `${planId}${pathwayId ? `:pathway:${pathwayId}` : ""}` : null
  );
  return {
    ownerId: ownerId ?? "unknown",
    planId: planId ?? null,
    pathwayId: pathwayId ?? null,
    campusId: firstPresent(row.campusId, existing.campusId) ?? null,
    majorTitle: firstPresent(row.majorTitle, existing.majorTitle, row.major) ?? null,
  };
}

function getReportedSourceRole(row) {
  return (
    firstPresent(
      row.auditSourceRole,
      row.detectedSourceRole,
      row.sourceRole,
      row.sourceRoleStatus,
      row.supportOnly === true ? "support-only" : null,
      row.nonSchedulable === true ? "non-schedulable" : null
    ) ?? "unknown"
  );
}

function getCanonicalIndexedSourceRoles(row, sourceRoleIndex = null) {
  const entry = sourceRoleIndex ? sourceRoleIndex.get(getOwnerSourceKey(row)) : null;
  return entry?.roles ?? [];
}

function hasSourceRoleCollision(row, sourceRoleIndex = null) {
  return getCanonicalIndexedSourceRoles(row, sourceRoleIndex).length > 1;
}

function getCanonicalIndexedSourceRole(row, sourceRoleIndex = null) {
  const roles = getCanonicalIndexedSourceRoles(row, sourceRoleIndex);
  return roles.length === 1 ? roles[0] : null;
}

function getSourceRole(row, sourceRoleIndex = null) {
  return getCanonicalIndexedSourceRole(row, sourceRoleIndex) ?? getReportedSourceRole(row);
}

function getSourceUrl(row) {
  return firstPresent(row.auditSourceUrl, row.sourceUrl, row.uwSourceUrl, row.primarySourceUrl);
}

function normalizeUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

function getOwnerSourceKey(row) {
  const planContext = getPlanContext(row);
  return `${planContext.ownerId}|${normalizeUrl(getSourceUrl(row))}`;
}

function buildSourceRoleIndex(sourceBackedAudit) {
  const index = new Map();
  for (const row of sourceBackedAudit.sourceRoleCoverageRows ?? []) {
    const ownerId = row.ownerId ?? "unknown";
    const add = (url, role) => {
      const normalizedUrl = normalizeUrl(url);
      if (!normalizedUrl) {
        return;
      }
      const key = `${ownerId}|${normalizedUrl}`;
      if (!index.has(key)) {
        index.set(key, { roles: [] });
      }
      const entry = index.get(key);
      if (!entry.roles.includes(role)) {
        entry.roles.push(role);
      }
    };
    add(row.primarySource, "primary-degree-requirements");
    for (const url of row.supportSources ?? []) {
      add(url, "support-source");
    }
    for (const url of row.approvedCourseListSources ?? []) {
      add(url, "approved-course-list");
    }
    for (const url of row.electiveListSources ?? []) {
      add(url, "elective-list");
    }
    for (const url of row.nonSchedulableSources ?? []) {
      add(url, "non-schedulable-course-list");
    }
  }
  for (const entry of index.values()) {
    entry.roles.sort((left, right) => left.localeCompare(right));
    entry.hasRoleCollision = entry.roles.length > 1;
  }
  return index;
}

function getRequirementLabel(row) {
  return compactText(
    firstPresent(
      row.uwRequirementLabel,
      row.requirementTitle,
      row.requirement,
      row.parentGroupRow,
      row.rawLine,
      row.rawText,
      row.rawRowText,
      row.listTitle,
      row.protectedPattern,
      row.knownProtectedPattern,
      row.label
    )
  );
}

function getCourseCodes(row) {
  return uniqueSorted([
    ...asArray(row.parsedUwCourseCodes),
    ...asArray(row.visibleUwOnlyCourseCodes),
    ...asArray(row.uwCourses),
    ...asArray(row.acceptedUwCourseCodes),
    ...asArray(row.acceptedUwOptions),
    ...asArray(row.courseCodesExtracted),
    ...asArray(row.scheduledGrcCourses),
    ...asArray(row.scheduledOptionIds),
    ...asArray(row.scheduledComponents),
    ...asArray(row.missingComponents),
    ...asArray(row.grcCompoundPath),
    row.courseCode,
    row.uwCourse,
    row.uwTarget,
    row.grcCourse,
    row.uwEquivalent,
    row.requirementCourse,
  ]);
}

function getEquivalencyRule(row) {
  return (
    compactText(
      firstPresent(
        row.ruleId,
        row.grcMappingPath,
        row.mappedAs,
        row.usedByRequirement,
        row.uwEquivalent,
        row.grcCourse,
        row.uwTarget,
        asArray(row.grcCompoundPath).join(" + "),
        asArray(row.matchedGrcEquivalents).join(", "),
        asArray(row.generatedGrcCourseCodes).join(", ")
      ),
      180
    ) ?? "not reported"
  );
}

function classifyRepairMode(blocker) {
  const issueType = blocker.issueType;
  const layer = blocker.suspectedLayer;
  const actionableClass = blocker.actionableIssueClass;

  if (actionableClass === "equivalent-grc-course-missing-or-over-selected") {
    if (issueType === "unmapped-uw-only") {
      return "mapping:evidence-needed-for-uw-only-course";
    }
    if (
      [
        "over-scheduled-alternatives",
        "over-expanded-compound-path",
        "duplicate-compound-count",
        "duplicate-compound-component",
      ].includes(issueType)
    ) {
      return "mapping:over-selection-or-compound-expansion";
    }
    if (["missing-compound-path", "partial-compound-path", "missing-compound-component"].includes(issueType)) {
      return "mapping:compound-equivalency-gap";
    }
    return "mapping:equivalency-normalization-gap";
  }

  if (actionableClass === "source-role-misclassified") {
    if (issueType === "course-list-emitted-requirement") {
      return "source-role:course-list-emission-gate";
    }
    if (issueType === "prerequisite-table-emitted-requirement") {
      return "source-role:prerequisite-only-emission-gate";
    }
    return "source-role:scope-or-primary-source-selection";
  }

  if (issueType === "selected-option-not-scheduled") {
    return "runtime:selected-option-scheduling";
  }
  if (layer === "runtime") {
    return "runtime:visibility-or-selection";
  }
  if (layer === "generator") {
    return "generator:shape-or-source-metadata";
  }
  if (layer === "parser") {
    return "parser:source-shape-recovery";
  }
  if (layer === "audit expectation") {
    return "audit-expectation:evidence-needed";
  }
  return `${layer}:review`;
}

function buildAutoRepairIndexes(autoRepairPlan) {
  const casesByOwner = new Map();
  const casesByPlan = new Map();
  const casesByOwnerIssue = new Map();

  for (const repairCase of autoRepairPlan?.cases ?? []) {
    const ownerId = repairCase.ownerId ?? null;
    const planId = repairCase.planId ?? null;
    if (ownerId) {
      if (!casesByOwner.has(ownerId)) {
        casesByOwner.set(ownerId, []);
      }
      casesByOwner.get(ownerId).push(repairCase);
    }
    if (planId) {
      if (!casesByPlan.has(planId)) {
        casesByPlan.set(planId, []);
      }
      casesByPlan.get(planId).push(repairCase);
    }
    for (const evidence of repairCase.evidence ?? []) {
      const key = `${ownerId ?? planId ?? "unknown"}|${evidence.code ?? "unknown"}`;
      if (!casesByOwnerIssue.has(key)) {
        casesByOwnerIssue.set(key, []);
      }
      casesByOwnerIssue.get(key).push(repairCase);
    }
  }

  return { casesByOwner, casesByPlan, casesByOwnerIssue };
}

function resolveAutoRepairMatch(blocker, indexes) {
  const directKey = `${blocker.ownerId}|${blocker.issueType}`;
  const ownerCases = indexes.casesByOwner.get(blocker.ownerId) ?? [];
  const planCases = blocker.planId ? indexes.casesByPlan.get(blocker.planId) ?? [] : [];
  const issueCases = indexes.casesByOwnerIssue.get(directKey) ?? [];
  const matchType = issueCases.length
    ? "exact_issue"
    : ownerCases.length
      ? "owner_fallback"
      : planCases.length
        ? "plan_fallback"
        : "none";
  const candidates =
    matchType === "exact_issue"
      ? issueCases
      : matchType === "owner_fallback"
        ? ownerCases
        : matchType === "plan_fallback"
          ? planCases
          : [];
  const categories = uniqueSorted(candidates.map((repairCase) => repairCase.category));
  const actions = uniqueSorted(candidates.flatMap((repairCase) => repairCase.actions ?? []));
  return {
    hasAutoRepairCase: candidates.length > 0,
    hasExactAutoRepairCase: matchType === "exact_issue",
    matchType,
    matchedCaseCount: candidates.length,
    exactCaseCount: issueCases.length,
    ownerContextCaseCount: ownerCases.length,
    planContextCaseCount: planCases.length,
    categories,
    actions,
  };
}

function normalizeBlocker(row, collectionName, index, autoRepairIndexes, sourceRoleIndex) {
  const metadata = { ...row, ...buildActionableAuditIssueMetadata(row, collectionName) };
  const issueType = metadata.issueTypeNormalized ?? getRowIssueType(metadata);
  const actionableIssueClass = metadata.actionableIssueClass ?? getActionableIssueClass(metadata);
  const suspectedLayer =
    metadata.suspectedLayer ?? getSuspectedLayerForActionableIssue(metadata) ?? "audit expectation";
  const recommendation =
    metadata.recommendedFixPath && metadata.recommendedNonManualFix
      ? metadata
      : getRecommendedFixForLayer(suspectedLayer, metadata);
  const planContext = getPlanContext(metadata);
  const reportedSourceRole = getReportedSourceRole(metadata);
  const canonicalIndexedSourceRole = getCanonicalIndexedSourceRole(metadata, sourceRoleIndex);
  const canonicalIndexedSourceRoles = getCanonicalIndexedSourceRoles(metadata, sourceRoleIndex);
  const sourceRoleCollision = hasSourceRoleCollision(metadata, sourceRoleIndex);
  const blocker = {
    id: `${collectionName}:${index}`,
    auditCollection: collectionName,
    issueType,
    actionableIssueClass,
    suspectedLayer,
    repairMode: null,
    ownerId: planContext.ownerId,
    planId: planContext.planId,
    pathwayId: planContext.pathwayId,
    campusId: planContext.campusId,
    majorTitle: planContext.majorTitle,
    sourceRole: canonicalIndexedSourceRole ?? reportedSourceRole,
    reportedSourceRole,
    canonicalIndexedSourceRole,
    canonicalIndexedSourceRoles,
    sourceRoleCollision,
    sourceRoleStatus: metadata.sourceRoleStatus ?? null,
    sourceUrl: getSourceUrl(metadata),
    requirementLabel: getRequirementLabel(metadata),
    courseCodes: getCourseCodes(metadata),
    equivalencyRule: getEquivalencyRule(metadata),
    likelyRepairTarget: recommendation.recommendedFixPath,
    recommendedNonManualFix: recommendation.recommendedNonManualFix,
    runtimeVisibilityStatus: metadata.runtimeVisibilityStatus ?? null,
    evidence: compactText(
      firstPresent(metadata.parsedSourceEvidence, metadata.copyOnlyDebugText, metadata.reason, metadata.details),
      420
    ),
  };
  blocker.repairMode = classifyRepairMode(blocker);
  blocker.autoRepair = resolveAutoRepairMatch(blocker, autoRepairIndexes);
  return blocker;
}

function collectBlockers(sourceBackedAudit, autoRepairPlan) {
  const autoRepairIndexes = buildAutoRepairIndexes(autoRepairPlan);
  const sourceRoleIndex = buildSourceRoleIndex(sourceBackedAudit);
  const blockers = [];

  for (const collectionName of AUDIT_ROW_COLLECTIONS) {
    const rows = sourceBackedAudit[collectionName] ?? [];
    rows.forEach((row, index) => {
      if (hasAuditIssue(row)) {
        blockers.push(normalizeBlocker(row, collectionName, index, autoRepairIndexes, sourceRoleIndex));
      }
    });
  }

  return blockers;
}

function increment(map, key, amount = 1) {
  const safeKey = key ?? "unknown";
  map.set(safeKey, (map.get(safeKey) ?? 0) + amount);
}

function topCounts(values, limit = TOP_LIMIT) {
  const counts = new Map();
  for (const value of values) {
    increment(counts, value ?? "unknown");
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
    .slice(0, limit);
}

function buildNestedCounts(blockers, selectors) {
  const groups = new Map();
  for (const blocker of blockers) {
    const key = selectors.map((selector) => selector(blocker) ?? "unknown").join(" | ");
    increment(groups, key);
  }
  return [...groups.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function buildQueue(blockers) {
  const groups = new Map();
  for (const blocker of blockers) {
    const key = [
      blocker.actionableIssueClass,
      blocker.suspectedLayer,
      blocker.repairMode,
      blocker.likelyRepairTarget,
      blocker.sourceRole,
      blocker.auditCollection,
    ].join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        actionableIssueClass: blocker.actionableIssueClass,
        suspectedLayer: blocker.suspectedLayer,
        repairMode: blocker.repairMode,
        likelyRepairTarget: blocker.likelyRepairTarget,
        sourceRole: blocker.sourceRole,
        auditCollection: blocker.auditCollection,
        blockerCount: 0,
        ownerCount: 0,
        planCount: 0,
        exactAutoRepairBlockerCount: 0,
        contextualAutoRepairBlockerCount: 0,
        ownerFallbackBlockerCount: 0,
        planFallbackBlockerCount: 0,
        issueTypes: new Map(),
        owners: new Map(),
        plans: new Map(),
        courseCodes: new Map(),
        equivalencyRules: new Map(),
        examples: [],
      });
    }
    const group = groups.get(key);
    group.blockerCount += 1;
    if (blocker.autoRepair.hasExactAutoRepairCase) {
      group.exactAutoRepairBlockerCount += 1;
    } else if (blocker.autoRepair.hasAutoRepairCase) {
      group.contextualAutoRepairBlockerCount += 1;
      if (blocker.autoRepair.matchType === "owner_fallback") {
        group.ownerFallbackBlockerCount += 1;
      }
      if (blocker.autoRepair.matchType === "plan_fallback") {
        group.planFallbackBlockerCount += 1;
      }
    }
    increment(group.issueTypes, blocker.issueType);
    increment(group.owners, blocker.ownerId);
    increment(group.plans, blocker.planId);
    for (const courseCode of blocker.courseCodes.slice(0, 12)) {
      increment(group.courseCodes, courseCode);
    }
    increment(group.equivalencyRules, blocker.equivalencyRule);
    if (group.examples.length < 5) {
      group.examples.push({
        id: blocker.id,
        ownerId: blocker.ownerId,
        planId: blocker.planId,
        auditCollection: blocker.auditCollection,
        issueType: blocker.issueType,
        requirementLabel: blocker.requirementLabel,
        courseCodes: blocker.courseCodes.slice(0, 12),
        sourceUrl: blocker.sourceUrl,
        reportedSourceRole: blocker.reportedSourceRole,
        canonicalIndexedSourceRole: blocker.canonicalIndexedSourceRole,
        autoRepairMatchType: blocker.autoRepair.matchType,
        evidence: blocker.evidence,
      });
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      ownerCount: group.owners.size,
      planCount: group.plans.size,
      issueTypes: topCounts([...group.issueTypes.entries()].flatMap(([key, count]) => Array(count).fill(key)), 12),
      topOwners: topCounts([...group.owners.entries()].flatMap(([key, count]) => Array(count).fill(key)), 12),
      topPlans: topCounts([...group.plans.entries()].flatMap(([key, count]) => Array(count).fill(key)), 12),
      topCourseCodes: topCounts(
        [...group.courseCodes.entries()].flatMap(([key, count]) => Array(count).fill(key)),
        16
      ),
      topEquivalencyRules: topCounts(
        [...group.equivalencyRules.entries()].flatMap(([key, count]) => Array(count).fill(key)),
        12
      ),
      exactAutoRepairCoverageRate: group.blockerCount
        ? Number((group.exactAutoRepairBlockerCount / group.blockerCount).toFixed(3))
        : 0,
      contextualAutoRepairCoverageRate: group.blockerCount
        ? Number((group.contextualAutoRepairBlockerCount / group.blockerCount).toFixed(3))
        : 0,
      owners: undefined,
      plans: undefined,
      courseCodes: undefined,
      equivalencyRules: undefined,
    }))
    .sort(
      (left, right) =>
        right.blockerCount - left.blockerCount ||
        left.suspectedLayer.localeCompare(right.suspectedLayer) ||
        left.repairMode.localeCompare(right.repairMode)
    );
}

function buildTriage(blockers, autoRepairPlan) {
  const exactAutoRepair = blockers.filter((blocker) => blocker.autoRepair.matchType === "exact_issue").length;
  const ownerFallback = blockers.filter((blocker) => blocker.autoRepair.matchType === "owner_fallback").length;
  const planFallback = blockers.filter((blocker) => blocker.autoRepair.matchType === "plan_fallback").length;
  const withoutAutoRepair = blockers.filter((blocker) => blocker.autoRepair.matchType === "none").length;
  const contextualAutoRepair = ownerFallback + planFallback;
  const anyAutoRepair = exactAutoRepair + contextualAutoRepair;
  return {
    generatedAt: new Date().toISOString(),
    sourceReports: {
      sourceBackedAudit: path.relative(REPO_ROOT, AUDIT_PATH).replace(/\\/g, "/"),
      autoRepairPlan: path.relative(REPO_ROOT, AUTO_REPAIR_PLAN_PATH).replace(/\\/g, "/"),
    },
    blockerCount: blockers.length,
    autoRepairCaseCount: autoRepairPlan?.caseCount ?? autoRepairPlan?.cases?.length ?? 0,
    autoRepairOwnerCount: autoRepairPlan?.ownerCount ?? null,
    autoRepairPlanCount: autoRepairPlan?.planCount ?? null,
    autoRepairOverlap: {
      exactIssueMatchCount: exactAutoRepair,
      ownerFallbackMatchCount: ownerFallback,
      planFallbackMatchCount: planFallback,
      contextualFallbackMatchCount: contextualAutoRepair,
      blockerCountWithAutoRepairCase: anyAutoRepair,
      blockerCountWithoutAutoRepairCase: withoutAutoRepair,
      exactIssueCoverageRate: blockers.length ? Number((exactAutoRepair / blockers.length).toFixed(3)) : 0,
      contextualCoverageRate: blockers.length ? Number((contextualAutoRepair / blockers.length).toFixed(3)) : 0,
      coverageRate: blockers.length ? Number((anyAutoRepair / blockers.length).toFixed(3)) : 0,
    },
    countsByActionableClass: topCounts(blockers.map((blocker) => blocker.actionableIssueClass), 100),
    countsBySuspectedLayer: topCounts(blockers.map((blocker) => blocker.suspectedLayer), 100),
    countsByIssueType: topCounts(blockers.map((blocker) => blocker.issueType), 100),
    countsByRepairMode: topCounts(blockers.map((blocker) => blocker.repairMode), 100),
    countsByAuditCollection: topCounts(blockers.map((blocker) => blocker.auditCollection), 100),
    countsBySourceRole: topCounts(blockers.map((blocker) => blocker.sourceRole), 100),
    countsByReportedSourceRole: topCounts(blockers.map((blocker) => blocker.reportedSourceRole), 100),
    countsByCanonicalIndexedSourceRole: topCounts(
      blockers.map((blocker) =>
        blocker.sourceRoleCollision
          ? `collision: ${blocker.canonicalIndexedSourceRoles.join(", ")}`
          : blocker.canonicalIndexedSourceRole ?? "not indexed"
      ),
      100
    ),
    countsByAutoRepairMatchType: topCounts(blockers.map((blocker) => blocker.autoRepair.matchType), 100),
    countsByRepairTarget: topCounts(blockers.map((blocker) => blocker.likelyRepairTarget), 100),
    groupedByClassAndLayer: buildNestedCounts(blockers, [
      (blocker) => blocker.actionableIssueClass,
      (blocker) => blocker.suspectedLayer,
    ]),
    groupedByPlanOwner: buildNestedCounts(blockers, [
      (blocker) => blocker.planId,
      (blocker) => blocker.ownerId,
    ]).slice(0, 250),
    groupedBySourceRoleAndIssue: buildNestedCounts(blockers, [
      (blocker) => blocker.sourceRole,
      (blocker) => blocker.issueType,
    ]),
    groupedByCourseOrEquivalency: buildNestedCounts(blockers, [
      (blocker) => blocker.equivalencyRule,
    ]).slice(0, 250),
    blockers,
  };
}

function markdownTable(headers, rows) {
  const safeRows = rows.length ? rows : [headers.map(() => "")];
  const escapeCell = (cell) =>
    String(cell ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\|/g, "\\|");
  const lines = [
    `| ${headers.map(escapeCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...safeRows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
  ];
  return lines.join("\n");
}

function renderCountsTable(counts, keyLabel = "Key") {
  return markdownTable(
    [keyLabel, "Count"],
    counts.slice(0, TOP_LIMIT).map((entry) => [entry.key, entry.count])
  );
}

function renderTriageMarkdown(triage, queue) {
  return [
    "# Transfer Planner Blocker Triage",
    "",
    `Generated: ${triage.generatedAt}`,
    "",
    "## Summary",
    "",
    markdownTable(
      ["Metric", "Value"],
      [
        ["blockers", triage.blockerCount],
        ["Auto-repair cases", triage.autoRepairCaseCount],
        ["Auto-repair owners", triage.autoRepairOwnerCount ?? "unknown"],
        ["Auto-repair plans", triage.autoRepairPlanCount ?? "unknown"],
        ["Exact blocker-to-repair evidence matches", triage.autoRepairOverlap.exactIssueMatchCount],
        ["Owner fallback repair context", triage.autoRepairOverlap.ownerFallbackMatchCount],
        ["Plan fallback repair context", triage.autoRepairOverlap.planFallbackMatchCount],
        ["Blockers without auto-repair context", triage.autoRepairOverlap.blockerCountWithoutAutoRepairCase],
        ["Exact auto-repair coverage rate", triage.autoRepairOverlap.exactIssueCoverageRate],
        ["Any auto-repair context rate", triage.autoRepairOverlap.coverageRate],
      ]
    ),
    "",
    "## By Suspected Layer",
    "",
    renderCountsTable(triage.countsBySuspectedLayer, "Layer"),
    "",
    "## By Actionable Class",
    "",
    renderCountsTable(triage.countsByActionableClass, "Class"),
    "",
    "## By Repair Mode",
    "",
    renderCountsTable(triage.countsByRepairMode, "Repair mode"),
    "",
    "## Top Queue Entries",
    "",
    markdownTable(
      ["Count", "Class", "Layer", "Repair mode", "Auto-repair", "Target"],
      queue.slice(0, TOP_LIMIT).map((entry) => [
        entry.blockerCount,
        entry.actionableIssueClass,
        entry.suspectedLayer,
        entry.repairMode,
        `${entry.exactAutoRepairBlockerCount} exact; ${entry.contextualAutoRepairBlockerCount} context`,
        entry.likelyRepairTarget,
      ])
    ),
    "",
    "## Top Plan/Owner Pairs",
    "",
    renderCountsTable(triage.groupedByPlanOwner, "Plan | Owner"),
  ].join("\n");
}

function renderRepairQueueMarkdown(queue, triage) {
  const parts = [
    "# Transfer Planner Repair Queue",
    "",
    `Generated: ${triage.generatedAt}`,
    "",
    `blockers: ${triage.blockerCount}`,
    "",
  ];

  queue.slice(0, TOP_LIMIT).forEach((entry, index) => {
    parts.push(`## ${index + 1}. ${entry.repairMode}`);
    parts.push("");
    parts.push(
      markdownTable(
        ["Metric", "Value"],
        [
          ["Blockers", entry.blockerCount],
          ["Owners", entry.ownerCount],
          ["Plans", entry.planCount],
          ["Actionable class", entry.actionableIssueClass],
          ["Suspected layer", entry.suspectedLayer],
          ["Source role", entry.sourceRole],
          ["Audit collection", entry.auditCollection],
          ["Exact auto-repair matches", `${entry.exactAutoRepairBlockerCount}/${entry.blockerCount}`],
          ["Context-only auto-repair matches", `${entry.contextualAutoRepairBlockerCount}/${entry.blockerCount}`],
          ["Owner fallback matches", `${entry.ownerFallbackBlockerCount}/${entry.blockerCount}`],
          ["Plan fallback matches", `${entry.planFallbackBlockerCount}/${entry.blockerCount}`],
          ["Likely target", entry.likelyRepairTarget],
        ]
      )
    );
    parts.push("");
    parts.push("Top issue types:");
    parts.push(renderCountsTable(entry.issueTypes, "Issue"));
    parts.push("");
    parts.push("Top owners:");
    parts.push(renderCountsTable(entry.topOwners, "Owner"));
    parts.push("");
    parts.push("Examples:");
    parts.push(
      markdownTable(
        ["ID", "Owner", "Collection", "Issue", "Auto-repair", "Source URL", "Requirement", "Courses"],
        entry.examples.map((example) => [
          example.id,
          example.ownerId,
          example.auditCollection,
          example.issueType,
          example.autoRepairMatchType,
          example.sourceUrl ?? "not reported",
          example.requirementLabel ?? "not reported",
          example.courseCodes.join(", ") || "not reported",
        ])
      )
    );
    parts.push("");
  });

  return parts.join("\n");
}

function main() {
  const sourceBackedAudit = readJson(AUDIT_PATH, "coverage audit");
  const autoRepairPlan = readJson(AUTO_REPAIR_PLAN_PATH, "auto-repair plan");
  const blockers = collectBlockers(sourceBackedAudit, autoRepairPlan);
  const triage = buildTriage(blockers, autoRepairPlan);
  const queue = buildQueue(blockers);
  const repairQueue = {
    generatedAt: triage.generatedAt,
    sourceReports: triage.sourceReports,
    blockerCount: triage.blockerCount,
    autoRepairOverlap: triage.autoRepairOverlap,
    queue,
  };

  writeJson(TRIAGE_JSON_PATH, triage);
  writeText(TRIAGE_MD_PATH, renderTriageMarkdown(triage, queue));
  writeJson(REPAIR_QUEUE_JSON_PATH, repairQueue);
  writeText(REPAIR_QUEUE_MD_PATH, renderRepairQueueMarkdown(queue, triage));

  console.log(
    [
      `Wrote ${path.relative(REPO_ROOT, TRIAGE_JSON_PATH)}`,
      `Wrote ${path.relative(REPO_ROOT, TRIAGE_MD_PATH)}`,
      `Wrote ${path.relative(REPO_ROOT, REPAIR_QUEUE_JSON_PATH)}`,
      `Wrote ${path.relative(REPO_ROOT, REPAIR_QUEUE_MD_PATH)}`,
      `Blockers triaged: ${triage.blockerCount}`,
      `Exact auto-repair matches: ${triage.autoRepairOverlap.exactIssueMatchCount}/${triage.blockerCount}`,
      `Auto-repair context: ${triage.autoRepairOverlap.blockerCountWithAutoRepairCase}/${triage.blockerCount}`,
    ].join("\n")
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  buildAutoRepairIndexes,
  buildSourceRoleIndex,
  buildTriage,
  buildQueue,
  classifyRepairMode,
  collectBlockers,
  getCanonicalIndexedSourceRole,
  getCanonicalIndexedSourceRoles,
  getReportedSourceRole,
  getSourceRole,
  hasSourceRoleCollision,
  normalizeBlocker,
  resolveAutoRepairMatch,
};
