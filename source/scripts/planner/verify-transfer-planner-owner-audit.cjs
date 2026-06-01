const fs = require("fs");
const {
  SOURCE_ROOT,
  ensurePlannerTmpLayout,
  getArgValue,
  getPlannerTmpPath,
  writePlannerJsonReport,
  writePlannerMarkdownReport,
} = require("./lib/script-harness.cjs");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const {
  TRANSFER_PLANNER_PRIMARY_PROMOTIONS,
  TRANSFER_PLANNER_GENERATED_MAJOR_PLANS,
  TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_REGISTRY,
  TRANSFER_PLANNER_MANIFEST_REGISTRY,
  getTransferPlannerPathwaysForPlan,
  getTransferPlannerMajorPlan,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerSourceManifestEntriesForPlan,
  getTransferPlannerGrcCourseList,
  getTransferPlannerStudentRuntimeMajorPlan,
  resolveTransferPlannerMajorPlan,
  resolveTransferPlannerStudentRuntimeMajorPlan,
} = require("../../constants/transfer-planner-source");
const {
  TRANSFER_PLANNER_GAP_ENTRIES,
} = require("../../constants/transfer-planner-source/source-gaps.generated");
const {
  normalizeTransferPlannerSemanticPathwayLabel,
} = require("../../constants/transfer-planner-source/pathway-title-normalization");
const {
  getTransferPlannerStudentRuntimeAliasCoverage,
} = require("../../constants/transfer-planner-source/student-runtime");

const REPO_ROOT = SOURCE_ROOT;
ensurePlannerTmpLayout();
const OUTPUT_JSON_PATH = getPlannerTmpPath("transfer-planner-owner-audit.json");
const OUTPUT_MD_PATH = getPlannerTmpPath("transfer-planner-owner-audit.md");
const SUPPORT_ONLY_PRIMARY_ROLES = new Set([
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
const NON_ACTIONABLE_NON_SCHEDULABLE_SYMPTOM_CODES = new Set([
  "missing-runtime-base-plan",
  "missing-runtime-resolved-plan",
  "no-runtime-schedulable-grc-rows",
  "no-parsed-uw-course-codes",
]);

function ensureTmpDir() {
  ensurePlannerTmpLayout();
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

const GAP_OWNER_IDS = new Set(
  (TRANSFER_PLANNER_GAP_ENTRIES ?? []).map((entry) =>
    buildParsedBlockOwnerId(entry.planId, entry.pathwayId ?? null)
  )
);
const GAP_PLAN_IDS = new Set(
  (TRANSFER_PLANNER_GAP_ENTRIES ?? [])
    .filter((entry) => !entry.pathwayId)
    .map((entry) => entry.planId)
);

function isCoveredBySourceGap(owner) {
  return (
    GAP_OWNER_IDS.has(owner.ownerId) ||
    Boolean(owner.pathwayId && GAP_PLAN_IDS.has(owner.planId))
  );
}

function parsedSourceBlockCanCreateSchedulableRows(block) {
  const sourceRoleStatus = String(block?.sourceRoleStatus ?? "").trim();
  return (
    block?.canCreateSchedulableRows !== false &&
    block?.supportOnly !== true &&
    block?.nonSchedulable !== true &&
    sourceRoleStatus === "primary"
  );
}

function getParsedSourceBlockAuditScore(block) {
  if (!block) {
    return -1;
  }

  const parsedCourseCount = Array.isArray(block.parsedUwCourseCodes)
    ? block.parsedUwCourseCodes.length
    : 0;
  const parsedGroupCount = Array.isArray(block.parsedRequirementGroups)
    ? block.parsedRequirementGroups.length
    : 0;
  const parsedRequirementCourseCount = Array.isArray(block.parsedRequirementCourses)
    ? block.parsedRequirementCourses.length
    : 0;
  const qualityWarningCount = Array.isArray(block.qualitySignals)
    ? block.qualitySignals.filter((signal) => signal?.severity === "warning").length
    : 0;

  let score = 0;
  if (block.ok) {
    score += 1000;
  }
  if (parsedSourceBlockCanCreateSchedulableRows(block)) {
    score += 300;
  }
  if (block.isPrimaryDegreeRequirementsLink) {
    score += 200;
  }
  if (block.primarySourceUrl && block.sourceUrl && block.primarySourceUrl === block.sourceUrl) {
    score += 100;
  }
  score += Math.min(500, parsedCourseCount * 4);
  score += Math.min(200, parsedGroupCount * 8);
  score += Math.min(200, parsedRequirementCourseCount * 2);
  score -= qualityWarningCount * 25;
  return score;
}

function buildBestParsedBlocksByOwnerId(blocks) {
  const parsedBlocksByOwnerId = new Map();
  for (const block of blocks ?? []) {
    const ownerId = block?.ownerId;
    if (!ownerId) {
      continue;
    }

    const current = parsedBlocksByOwnerId.get(ownerId);
    if (!current || getParsedSourceBlockAuditScore(block) > getParsedSourceBlockAuditScore(current)) {
      parsedBlocksByOwnerId.set(ownerId, block);
    }
  }

  return parsedBlocksByOwnerId;
}

function parsedSourceBlockIsNonSchedulable(block) {
  const sourceRoleStatus = String(block?.sourceRoleStatus ?? "").trim();
  return (
    block?.canCreateSchedulableRows === false ||
    block?.nonSchedulable === true ||
    ["non-schedulable", "ignored"].includes(sourceRoleStatus)
  );
}

function parsedSourceBlockIsCoveredByChildPathwayRequirements(owner, parsedBlocksByOwnerId) {
  if (owner.pathwayId) {
    return false;
  }

  const childBlocks = [...parsedBlocksByOwnerId.values()].filter(
    (block) =>
      block?.planId === owner.planId &&
      block?.pathwayId &&
      block?.ok &&
      parsedSourceBlockCanCreateSchedulableRows(block) &&
      (block.parsedUwCourseCodes ?? []).length > 0
  );
  if (!childBlocks.length) {
    return false;
  }

  const overviewText = [
    owner.title,
    childBlocks.map((block) => block.pathwayId).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\b(options?|tracks?|routes?|pathways?|concentrations?)\b/.test(overviewText);
}

function shouldWarnOnNoParsedUwCourseCodes(owner, parsedBlock, parsedBlocksByOwnerId) {
  if (!parsedBlock?.ok || (parsedBlock.parsedUwCourseCodes ?? []).length > 0) {
    return false;
  }
  if (!parsedSourceBlockCanCreateSchedulableRows(parsedBlock)) {
    return false;
  }
  return !parsedSourceBlockIsCoveredByChildPathwayRequirements(owner, parsedBlocksByOwnerId);
}

function buildRuntimeAliasOwnerId(runtimeAliasCoverage) {
  if (!runtimeAliasCoverage?.parentPlanId) {
    return null;
  }
  return buildParsedBlockOwnerId(
    runtimeAliasCoverage.parentPlanId,
    runtimeAliasCoverage.parentPathwayId ?? null
  );
}

function getRuntimeAliasManifestEntries(runtimeAliasCoverage) {
  if (!runtimeAliasCoverage?.parentPlanId) {
    return [];
  }
  return getTransferPlannerSourceManifestEntriesForPlan(
    runtimeAliasCoverage.parentPlanId,
    runtimeAliasCoverage.parentPathwayId ?? null
  );
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
    TRANSFER_PLANNER_MANIFEST_REGISTRY.filter(
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

function getParsedBlockSourceUrl(block) {
  return block?.primarySourceUrl ?? block?.sourceUrl ?? null;
}

function buildParsedBlockSourceEvidenceEntry(block) {
  if (!block?.ok || !parsedSourceBlockCanCreateSchedulableRows(block)) {
    return null;
  }

  const url = getParsedBlockSourceUrl(block);
  if (!url) {
    return null;
  }

  return {
    ownerId: block.ownerId,
    ownerType: block.pathwayId ? "pathway" : "major",
    planId: block.planId,
    pathwayId: block.pathwayId ?? null,
    campusId: block.campusId,
    label: block.sourceLabel ?? block.primarySourceLabel ?? block.ownerTitle ?? block.ownerId,
    url,
    role: block.sourceRole ?? "primary-degree-requirements",
    parserType: block.parserType ?? block.primaryParserType ?? null,
    isPrimaryDegreeRequirementsLink: true,
  };
}

function findChildPathwayParsedBlocks(owner, parsedBlocksByOwnerId) {
  if (owner.pathwayId) {
    return [];
  }

  return [...parsedBlocksByOwnerId.values()].filter(
    (block) =>
      block?.planId === owner.planId &&
      block?.pathwayId &&
      block?.ok &&
      parsedSourceBlockCanCreateSchedulableRows(block)
  );
}

function findPathwayParsedBlockAliases(owner, planTitle, parsedBlocksByOwnerId) {
  if (!owner.pathwayId || !owner.pathwayLabel) {
    return [];
  }

  const normalizedOwnerLabel = normalizePathwayAliasLabel(planTitle, owner.pathwayLabel);
  if (!normalizedOwnerLabel) {
    return [];
  }

  return [...parsedBlocksByOwnerId.values()].filter((block) => {
    if (block?.planId !== owner.planId || !block?.pathwayId || !block?.ok) {
      return false;
    }

    const candidateLabels = [
      block.pathwayId,
      block.ownerTitle,
      ...(Array.isArray(block.pathwayLabels) ? block.pathwayLabels : []),
    ]
      .map((label) => normalizePathwayAliasLabel(planTitle, label))
      .filter(Boolean);

    return candidateLabels.some(
      (label) =>
        label === normalizedOwnerLabel ||
        label.includes(normalizedOwnerLabel) ||
        normalizedOwnerLabel.includes(label)
    );
  });
}

const GENERIC_OWNER_ALIAS_TOKENS = new Set([
  "a",
  "and",
  "ba",
  "bs",
  "degree",
  "general",
  "in",
  "major",
  "of",
  "option",
  "pathway",
  "program",
  "route",
  "the",
  "track",
]);

function tokenizeOwnerAlias(value) {
  return [
    ...new Set(
      String(value ?? "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token && !GENERIC_OWNER_ALIAS_TOKENS.has(token))
    ),
  ];
}

function findPlanOwnerPathwayAliasCoverage(owner, parsedBlocksByOwnerId) {
  if (owner.pathwayId) {
    return null;
  }

  const ownerTokens = tokenizeOwnerAlias(owner.title);
  if (!ownerTokens.length) {
    return null;
  }
  const ownerTokenSet = new Set(ownerTokens);
  let best = null;

  for (const candidatePlan of TRANSFER_PLANNER_GENERATED_MAJOR_PLANS) {
    if (candidatePlan.id === owner.planId || candidatePlan.campusId !== owner.campusId) {
      continue;
    }

    const candidatePlanTokens = tokenizeOwnerAlias(candidatePlan.title);
    const sharedPlanTokens = candidatePlanTokens.filter((token) => ownerTokenSet.has(token));
    if (!sharedPlanTokens.length) {
      continue;
    }

    for (const candidatePathway of getTransferPlannerPathwaysForPlan(candidatePlan)) {
      const pathwayTokens = tokenizeOwnerAlias(candidatePathway.label);
      if (!pathwayTokens.length || !pathwayTokens.every((token) => ownerTokenSet.has(token))) {
        continue;
      }

      const aliasOwnerId = buildParsedBlockOwnerId(candidatePlan.id, candidatePathway.id);
      const manifestEntries = TRANSFER_PLANNER_MANIFEST_REGISTRY.filter(
        (entry) => entry.ownerId === aliasOwnerId
      );
      const parsedBlock = parsedBlocksByOwnerId.get(aliasOwnerId) ?? null;
      if (
        !manifestEntries.some((entry) => entry.isPrimaryDegreeRequirementsLink) &&
        !buildParsedBlockSourceEvidenceEntry(parsedBlock)
      ) {
        continue;
      }

      const score = sharedPlanTokens.length * 10 + pathwayTokens.length * 20;
      if (!best || score > best.score) {
        best = {
          score,
          ownerId: aliasOwnerId,
          planId: candidatePlan.id,
          pathwayId: candidatePathway.id,
          manifestEntries,
          parsedBlock,
        };
      }
    }
  }

  return best;
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

function getChecklistItems(plan) {
  return [
    ...(plan?.applicationChecklist ?? []),
    ...(plan?.beforeEnrollmentChecklist ?? []),
    ...(plan?.stayAtGrcChecklist ?? []),
  ];
}

function getSchedulableGrcCourseLabelCount(plan) {
  if (!plan) {
    return 0;
  }

  const labels = [
    ...(getTransferPlannerGrcCourseList(plan) ?? []),
    ...getChecklistItems(plan).flatMap((item) => [
      ...(item.grcCourses ?? []),
      ...(item.alternatives ?? []).flat(),
      ...(item.requirementGroup?.options ?? []).flatMap((option) => option.grcMatches ?? []),
    ]),
  ];

  return new Set(labels.map((label) => String(label ?? "").trim()).filter(Boolean)).size;
}

function collapseOwnerIssues(ownerId, symptomIssues, isAutoPromotedOwner, isKnownSourceGapOwner = false) {
  const rootIssues = [];
  const symptomIssueByCode = buildIssueIndex(symptomIssues);
  const groupedSymptomCodes = new Set();
  const missingPrimarySource = symptomIssueByCode.has("missing-primary-source");
  const missingManifestEntries = symptomIssueByCode.has("missing-source-manifest-entries");
  const missingParsedSourceBlock = symptomIssueByCode.has("missing-parsed-source-block");
  const missingRuntimeBasePlan = symptomIssueByCode.has("missing-runtime-base-plan");
  const missingRuntimeResolvedPlan = symptomIssueByCode.has("missing-runtime-resolved-plan");
  const noRuntimeSchedulableGrcRows = symptomIssueByCode.has("no-runtime-schedulable-grc-rows");

  if (missingPrimarySource && missingManifestEntries) {
    groupedSymptomCodes.add("missing-primary-source");
    groupedSymptomCodes.add("missing-source-manifest-entries");
    if (missingParsedSourceBlock) {
      groupedSymptomCodes.add("missing-parsed-source-block");
    }
    addIssue(
      rootIssues,
      isKnownSourceGapOwner || !isAutoPromotedOwner ? "warning" : "error",
      isKnownSourceGapOwner
        ? "known-source-gap-unresolved"
        : "canonical-source-registry-missing-owner",
      isKnownSourceGapOwner
        ? "Owner is intentionally hidden behind a generated source-gap entry until a safe primary source is validated."
        : "Canonical source registry is missing the owner's primary source registration.",
      {
        ownerId,
        autoPromotedPrimarySource: isAutoPromotedOwner,
        sourceGapRegistered: isKnownSourceGapOwner,
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
    if (isKnownSourceGapOwner && missingParsedSourceBlock) {
      groupedSymptomCodes.add("missing-parsed-source-block");
    }
    addIssue(
      rootIssues,
      isKnownSourceGapOwner || !isAutoPromotedOwner ? "warning" : "error",
      isKnownSourceGapOwner
        ? "known-source-gap-registry-drift"
        : "canonical-source-registry-drift",
      isKnownSourceGapOwner
        ? "Generated source-gap entry covers an owner whose canonical source registry is incomplete."
        : "Canonical source registry is internally inconsistent for this owner.",
      {
        ownerId,
        autoPromotedPrimarySource: isAutoPromotedOwner,
        sourceGapRegistered: isKnownSourceGapOwner,
        symptoms: [
          ...(missingPrimarySource ? ["missing-primary-source"] : []),
          ...(missingManifestEntries ? ["missing-source-manifest-entries"] : []),
          ...(isKnownSourceGapOwner && missingParsedSourceBlock ? ["missing-parsed-source-block"] : []),
        ],
      }
    );
  }

  if (missingParsedSourceBlock && !missingPrimarySource && !missingManifestEntries) {
    groupedSymptomCodes.add("missing-parsed-source-block");
    addIssue(
      rootIssues,
      isKnownSourceGapOwner || !isAutoPromotedOwner ? "warning" : "error",
      isKnownSourceGapOwner
        ? "known-source-gap-parser-drift"
        : isAutoPromotedOwner ? "promoted-source-not-parsed" : "registry-parser-drift",
      isAutoPromotedOwner
        ? "An auto-promoted primary source exists in the canonical registry but did not produce a parsed requirement block."
        : isKnownSourceGapOwner
          ? "Generated source-gap entry covers an owner that does not have a parsed requirement block."
          : "Canonical registry and parsed requirement blocks drifted for this owner.",
      {
        ownerId,
        autoPromotedPrimarySource: isAutoPromotedOwner,
        sourceGapRegistered: isKnownSourceGapOwner,
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

  if (isKnownSourceGapOwner && (missingRuntimeBasePlan || missingRuntimeResolvedPlan)) {
    if (missingRuntimeBasePlan) {
      groupedSymptomCodes.add("missing-runtime-base-plan");
    }
    if (missingRuntimeResolvedPlan) {
      groupedSymptomCodes.add("missing-runtime-resolved-plan");
    }
    addIssue(
      rootIssues,
      "warning",
      "known-source-gap-runtime-hidden",
      "Owner is intentionally hidden behind a generated source-gap entry, so it is not expected to resolve in the student runtime until promoted.",
      {
        ownerId,
        sourceGapRegistered: true,
        symptoms: [
          ...(missingRuntimeBasePlan ? ["missing-runtime-base-plan"] : []),
          ...(missingRuntimeResolvedPlan ? ["missing-runtime-resolved-plan"] : []),
        ],
      }
    );
  }
  if (
    !isKnownSourceGapOwner &&
    noRuntimeSchedulableGrcRows &&
    (missingRuntimeBasePlan || missingRuntimeResolvedPlan)
  ) {
    groupedSymptomCodes.add("no-runtime-schedulable-grc-rows");
    if (missingRuntimeBasePlan) {
      groupedSymptomCodes.add("missing-runtime-base-plan");
    }
    if (missingRuntimeResolvedPlan) {
      groupedSymptomCodes.add("missing-runtime-resolved-plan");
    }
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

  for (const plan of TRANSFER_PLANNER_GENERATED_MAJOR_PLANS) {
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

const AUTO_PROMOTED_PRIMARY_OWNER_IDS = new Set(
  (TRANSFER_PLANNER_PRIMARY_PROMOTIONS ?? []).map((entry) => entry.ownerId)
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

  writePlannerMarkdownReport(OUTPUT_MD_PATH, lines);
}

function main() {
  ensureTmpDir();
  const targetPlanId = getArgValue("--target-plan-id");

  const parsedBlocksByOwnerId = buildBestParsedBlocksByOwnerId(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_REGISTRY
  );
  const parsedBlocksByPlanSourceKey = new Map(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_REGISTRY.map((block) => [
      buildParsedBlockPlanSourceKey(block),
      block,
    ])
  );

  const owners = buildOwners(targetPlanId).map((owner) => {
    const symptomIssues = [];
    let sourceOnlyUwCourseCodeCount = 0;
    const isAutoPromotedPrimarySource = AUTO_PROMOTED_PRIMARY_OWNER_IDS.has(owner.ownerId);
    const basePlan = getTransferPlannerMajorPlan(owner.planId);
    const aliasOwnerIds = owner.pathwayId && basePlan
      ? findPathwayOwnerAliases(owner, basePlan.title)
      : [];
    const aliasManifestEntries = aliasOwnerIds.flatMap((aliasOwnerId) =>
      TRANSFER_PLANNER_MANIFEST_REGISTRY.filter((entry) => entry.ownerId === aliasOwnerId)
    );
    const planOwnerAliasCoverage = findPlanOwnerPathwayAliasCoverage(owner, parsedBlocksByOwnerId);
    const planOwnerAliasManifestEntries = planOwnerAliasCoverage?.manifestEntries ?? [];
    const effectiveAliasManifestEntries = [
      ...aliasManifestEntries,
      ...planOwnerAliasManifestEntries,
    ];
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
    const sourceSchedulableGrcCourseLabelCount = getSchedulableGrcCourseLabelCount(resolvedPlan);

    const runtimeAliasCoverage = getTransferPlannerStudentRuntimeAliasCoverage(
      owner.planId,
      owner.pathwayId
    );
    const runtimeAliasOwnerId = buildRuntimeAliasOwnerId(runtimeAliasCoverage);
    const runtimeAliasManifestEntries = getRuntimeAliasManifestEntries(runtimeAliasCoverage);
    const runtimeBasePlan =
      getTransferPlannerStudentRuntimeMajorPlan(owner.planId) ??
      runtimeAliasCoverage?.parentPlan ??
      null;
    if (!runtimeBasePlan) {
      addIssue(
        symptomIssues,
        "error",
        "missing-runtime-base-plan",
        "Student runtime base plan could not be resolved."
      );
    }
    if (!runtimeBasePlan && resolvedPlan && sourceSchedulableGrcCourseLabelCount === 0) {
      addIssue(
        symptomIssues,
        "warning",
        "no-runtime-schedulable-grc-rows",
        "Source plan resolved, but it has no Green River schedulable course rows to materialize into the student runtime."
      );
    }

    const runtimeResolvedPlan =
      runtimeAliasCoverage?.resolvedPlan ??
      (runtimeBasePlan
        ? owner.pathwayId
          ? resolveTransferPlannerStudentRuntimeMajorPlan(runtimeBasePlan, owner.pathwayId)
          : runtimeBasePlan
        : null);
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
    const runtimeAliasPrimarySource = runtimeAliasCoverage?.parentPlanId
      ? getTransferPlannerPrimaryDegreeRequirementsSource(
          runtimeAliasCoverage.parentPlanId,
          runtimeAliasCoverage.parentPathwayId ?? null
        )
      : null;
    const manifestEntries = getTransferPlannerSourceManifestEntriesForPlan(
      owner.planId,
      owner.pathwayId
    );
    const planPrimaryManifestEntries = owner.pathwayId
      ? getTransferPlannerSourceManifestEntriesForPlan(owner.planId, null).filter(
          (entry) =>
            entry.isPrimaryDegreeRequirementsLink &&
            !SUPPORT_ONLY_PRIMARY_ROLES.has(entry.role)
        )
      : [];
    const directOrAliasManifestEntries =
      (manifestEntries ?? []).length > 0
        ? manifestEntries
        : effectiveAliasManifestEntries.length > 0
          ? effectiveAliasManifestEntries
          : runtimeAliasManifestEntries;
    const directPrimaryManifestEntry = directOrAliasManifestEntries.find(
      (entry) => entry.isPrimaryDegreeRequirementsLink
    );
    const pathwayParsedBlockAliases = owner.pathwayId && basePlan
      ? findPathwayParsedBlockAliases(owner, basePlan.title, parsedBlocksByOwnerId)
      : [];
    const parentParsedBlock = owner.pathwayId
      ? parsedBlocksByOwnerId.get(buildParsedBlockOwnerId(owner.planId, null)) ??
        planPrimaryManifestEntries
          .map((entry) => parsedBlocksByPlanSourceKey.get(buildManifestPlanSourceKey(entry)))
          .find(Boolean) ??
        null
      : null;
    const childPathwayParsedBlocks = findChildPathwayParsedBlocks(owner, parsedBlocksByOwnerId);
    const parsedBlock =
      parsedBlocksByOwnerId.get(owner.ownerId) ??
      (runtimeAliasOwnerId ? parsedBlocksByOwnerId.get(runtimeAliasOwnerId) : null) ??
      aliasOwnerIds.map((aliasOwnerId) => parsedBlocksByOwnerId.get(aliasOwnerId)).find(Boolean) ??
      planOwnerAliasCoverage?.parsedBlock ??
      pathwayParsedBlockAliases.find(Boolean) ??
      (directPrimaryManifestEntry
        ? parsedBlocksByPlanSourceKey.get(buildManifestPlanSourceKey(directPrimaryManifestEntry))
        : null) ??
      planPrimaryManifestEntries
        .map((entry) => parsedBlocksByPlanSourceKey.get(buildManifestPlanSourceKey(entry)))
        .find(Boolean) ??
      childPathwayParsedBlocks.find(Boolean) ??
      parentParsedBlock ??
      null;
    const parsedBlockEvidenceEntry = buildParsedBlockSourceEvidenceEntry(parsedBlock);
    const childParsedBlockEvidenceEntry = childPathwayParsedBlocks
      .map(buildParsedBlockSourceEvidenceEntry)
      .find(Boolean);
    const parentParsedBlockEvidenceEntry = buildParsedBlockSourceEvidenceEntry(parentParsedBlock);
    const inheritedEvidenceEntries = [
      parsedBlockEvidenceEntry,
      childParsedBlockEvidenceEntry,
      ...planPrimaryManifestEntries,
      parentParsedBlockEvidenceEntry,
    ].filter(Boolean);
    const effectiveManifestEntries =
      directOrAliasManifestEntries.length > 0
        ? [...directOrAliasManifestEntries, ...inheritedEvidenceEntries]
        : inheritedEvidenceEntries;
    const primaryManifestEntry = effectiveManifestEntries.find(
      (entry) => entry.isPrimaryDegreeRequirementsLink
    );
    const effectivePrimarySourceUrl =
      primarySource?.url ??
      effectiveAliasManifestEntries.find((entry) => entry.isPrimaryDegreeRequirementsLink)?.url ??
      runtimeAliasPrimarySource?.url ??
      runtimeAliasManifestEntries.find((entry) => entry.isPrimaryDegreeRequirementsLink)?.url ??
      primaryManifestEntry?.url ??
      getParsedBlockSourceUrl(parsedBlock) ??
      childParsedBlockEvidenceEntry?.url ??
      parentParsedBlockEvidenceEntry?.url ??
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
          SUPPORT_ONLY_PRIMARY_ROLES.has(entry.role)
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
      if (
        parsedUwCourseCodeCount === 0 &&
        shouldWarnOnNoParsedUwCourseCodes(owner, parsedBlock, parsedBlocksByOwnerId)
      ) {
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

    const effectiveSymptomIssues = parsedSourceBlockIsNonSchedulable(parsedBlock)
      ? symptomIssues.filter(
          (issue) => !NON_ACTIONABLE_NON_SCHEDULABLE_SYMPTOM_CODES.has(issue.code)
        )
      : symptomIssues;

    effectiveSymptomIssues.sort(compareIssues);
    const rootIssues = collapseOwnerIssues(
      owner.ownerId,
      effectiveSymptomIssues,
      isAutoPromotedPrimarySource,
      isCoveredBySourceGap(owner)
    );

    return {
      ...owner,
      isAutoPromotedPrimarySource,
      primarySourceUrl: effectivePrimarySourceUrl,
      sourceOnlyUwCourseCodeCount,
      issueCounts: buildCountsBySeverity(rootIssues),
      symptomIssueCounts: buildCountsBySeverity(effectiveSymptomIssues),
      rootIssues,
      symptomIssues: effectiveSymptomIssues,
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
      owner.rootIssues.some(
        (issue) => issue.severity === "error" && PROMOTED_OWNER_INVARIANT_VIOLATION_CODES.has(issue.code)
      )
    ).length,
    owners,
  };

  writePlannerJsonReport(OUTPUT_JSON_PATH, report);
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
