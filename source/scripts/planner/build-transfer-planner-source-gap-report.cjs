const fs = require("fs");
const path = require("path");
const {
  SOURCE_ROOT,
  ensurePlannerTmpLayout,
  getArgValue,
  getPlannerTmpPath,
  hasArg,
  runNodeScript,
  writePlannerJsonReport,
  writePlannerMarkdownReport,
} = require("./lib/script-harness.cjs");

const TMP_DIR = ensurePlannerTmpLayout().root;
const DISCOVERY_REPORT_PATH = getPlannerTmpPath("transfer-planner-primary-source-discovery.json");
const REVIEW_QUEUE_REPORT_PATH = getPlannerTmpPath("transfer-planner-primary-source-review-queue.json");
const OUTPUT_JSON_PATH = getPlannerTmpPath("transfer-planner-source-gaps.json");
const OUTPUT_MD_PATH = getPlannerTmpPath("transfer-planner-source-gaps.md");
const GENERATED_OUTPUT_PATH = path.resolve(
  SOURCE_ROOT,
  "constants",
  "transfer-planner-source",
  "source-gaps.generated.ts"
);

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});
require("tsconfig-paths/register");

const {
  TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCKS,
} = require(path.resolve(
  SOURCE_ROOT,
  "constants",
  "transfer-planner-source",
  "requirement-source-adapters.generated.ts"
));
const {
  TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY,
  TRANSFER_PLANNER_GENERATED_MAJOR_PLANS,
  getTransferPlannerStudentRuntimeMajorPlan,
  getTransferPlannerStudentRuntimePathwaysForPlan,
} = require(path.resolve(SOURCE_ROOT, "constants", "transfer-planner-source"));
const {
  buildTransferPlannerOwnerId,
  normalizeTransferPlannerOwnerId,
  normalizeTransferPlannerPathwayId,
} = require(path.resolve(
  SOURCE_ROOT,
  "constants",
  "transfer-planner-source",
  "pathway-id-normalization"
));
const {
  getTransferPlannerStudentRuntimeAliasCoverage,
} = require(path.resolve(
  SOURCE_ROOT,
  "constants",
  "transfer-planner-source",
  "student-runtime"
));

const ACTIVE_PATHWAY_OWNER_KEYS = new Set(
  (TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY ?? []).map((entry) =>
    buildOwnerKey({
      ownerType: "pathway",
      ownerKey: entry.id,
      planId: entry.planId,
      pathwayId: entry.pathwayId,
    })
  )
);
const ACTIVE_PATHWAYS_BY_PLAN_ID = new Map();
for (const entry of TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY ?? []) {
  const planId = String(entry?.planId ?? "").trim();
  if (!planId) {
    continue;
  }

  const existing = ACTIVE_PATHWAYS_BY_PLAN_ID.get(planId) ?? [];
  existing.push(entry);
  ACTIVE_PATHWAYS_BY_PLAN_ID.set(planId, existing);
}

function runDiscovery() {
  runNodeScript("scripts/planner/discover-transfer-planner-primary-sources.cjs", [], {
    cwd: SOURCE_ROOT,
    errorMessage: "Primary-source discovery failed, so source-gap reporting could not continue.",
  });
}

function runReviewQueue() {
  runNodeScript("scripts/planner/build-transfer-planner-primary-source-review-queue.cjs", [], {
    cwd: SOURCE_ROOT,
    errorMessage: "Primary-source review queue failed, so source-gap reporting could not continue.",
  });
}

function normalizeCampusLabel(campusId) {
  switch (campusId) {
    case "uw-seattle":
      return "UW Seattle";
    case "uw-bothell":
      return "UW Bothell";
    case "uw-tacoma":
      return "UW Tacoma";
    default:
      return campusId;
  }
}

function getCandidateLabel(candidate) {
  return candidate?.label || candidate?.anchorText || candidate?.pageTitle || null;
}

function toDiscoveryAttempt(candidate) {
  return {
    url: candidate.url,
    label: getCandidateLabel(candidate),
    score: candidate.score,
    confidence: candidate.confidence,
    reasons: candidate.reasons ?? [],
  };
}

function buildSourceGapEntryFromReviewEntry(entry, generatedAt) {
  const suggestedPrimary =
    entry?.suggestedPrimary &&
    (entry.suggestedPrimary.confidence === "high" || entry.suggestedPrimary.confidence === "medium")
      ? {
          url: entry.suggestedPrimary.url,
          label: entry.suggestedPrimary.label ?? null,
          score: entry.suggestedPrimary.score,
          confidence: entry.suggestedPrimary.confidence,
          reasons: entry.suggestedPrimary.reasons ?? [],
        }
      : null;
  const sourceCoverageStatus =
    entry?.status === "needs-source-automation" ? "source-unfindable" : "parser-unsupported";
  const sourceGapReason =
    entry?.status === "high-confidence-needs-review"
      ? "Official primary-source candidate is high confidence but still requires human/source-pipeline review before student visibility."
      : entry?.status === "medium-confidence"
        ? "Official primary-source candidate is below the auto-promotion threshold; keep hidden until source discovery or parser support verifies it."
        : "No official primary degree-requirements source candidate met the minimum discovery threshold.";

  return {
    ownerType: entry.ownerType,
    ownerKey: entry.ownerKey,
    planId: entry.planId,
    pathwayId: entry.pathwayId ?? null,
    title: entry.title,
    campusId: entry.campusId,
    sourceCoverageStatus,
    reviewStatus: entry?.status ?? null,
    studentVisibility: "hidden",
    sourceGapReason,
    generatedAt,
    officialLinkCount: entry.officialLinkCount ?? 0,
    candidateCount: entry.candidateCount ?? 0,
    suggestedPrimary,
    sourceDiscoveryAttempts: (entry.topReviewCandidates ?? []).slice(0, 5).map(toDiscoveryAttempt),
  };
}

function buildSourceGapEntryFromDiscoveryOwner(owner, generatedAt) {
  const suggestedPrimary =
    owner?.suggestedPrimary &&
    (owner.suggestedPrimary.confidence === "high" || owner.suggestedPrimary.confidence === "medium")
      ? {
          url: owner.suggestedPrimary.url,
          label: getCandidateLabel(owner.suggestedPrimary),
          score: owner.suggestedPrimary.score,
          confidence: owner.suggestedPrimary.confidence,
          reasons: owner.suggestedPrimary.reasons ?? [],
        }
      : null;
  const sourceCoverageStatus = suggestedPrimary ? "parser-unsupported" : "source-unfindable";
  const sourceGapReason = suggestedPrimary
    ? "Official primary-source candidate is not yet safe for automatic student-visible scheduling; keep hidden until source discovery or parser support verifies it."
    : "No official primary degree-requirements source candidate met the minimum discovery threshold.";

  return {
    ownerType: owner.ownerType,
    ownerKey: owner.ownerKey,
    planId: owner.planId,
    pathwayId: owner.pathwayId ?? null,
    title: owner.title,
    campusId: owner.campusId,
    sourceCoverageStatus,
    reviewStatus: null,
    studentVisibility: "hidden",
    sourceGapReason,
    generatedAt,
    officialLinkCount: (owner.officialLinks ?? []).length,
    candidateCount: owner.candidateCount ?? 0,
    suggestedPrimary,
    sourceDiscoveryAttempts: (owner.topCandidates ?? []).slice(0, 5).map(toDiscoveryAttempt),
  };
}

function getReviewQueueEntries(reviewQueue) {
  return (reviewQueue.campuses ?? []).flatMap((campus) => campus.entries ?? []);
}

function buildOwnerKey(owner) {
  const ownerType = String(owner?.ownerType ?? "").trim();
  if (ownerType === "pathway") {
    return `pathway:${normalizeTransferPlannerOwnerId(
      owner?.ownerKey ?? owner?.ownerId ?? null,
      owner?.planId ?? null,
      owner?.pathwayId ?? null
    )}`;
  }

  return `${ownerType || "major"}:${String(owner?.ownerKey ?? owner?.ownerId ?? owner?.planId ?? "").trim()}`;
}

function canParsedRequirementSourceBlockCreateRequiredScheduleRows(block) {
  if (
    block.canCreateScheduleRows === false ||
    block.canCreateRequiredRows === false ||
    block.canCreateSchedulableRows === false ||
    block.supportOnly === true ||
    block.nonSchedulable === true
  ) {
    return false;
  }

  if (["support", "non-schedulable", "ignored"].includes(String(block.sourceRoleStatus ?? ""))) {
    return false;
  }

  return ![
    "approved-course-list",
    "elective-list",
    "upper-division-prerequisite-table",
    "non-schedulable-course-list",
    "sample-schedule",
    "support-source",
    "admission-prerequisite-source",
    "admissions-preparation",
    "transfer-equivalency",
    "matched-grc-track",
    "old-archival",
    "ignored",
  ].includes(String(block.sourceRole ?? ""));
}

function buildParserBackedOwnerKeys() {
  const keys = new Set();
  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCKS ?? []) {
    if (!block?.ok || !block.planId || !canParsedRequirementSourceBlockCreateRequiredScheduleRows(block)) {
      continue;
    }

    keys.add(`major:${block.planId}`);
    if (block.pathwayId) {
      keys.add(
        buildOwnerKey({
          ownerType: "pathway",
          ownerKey: block.ownerId || `${block.planId}:pathway:${block.pathwayId}`,
          planId: block.planId,
          pathwayId: block.pathwayId,
        })
      );
    }
    for (const ownerKey of getParserBackedPathwayKeysFromLabels(block)) {
      keys.add(ownerKey);
    }
    for (const ownerKey of getParserBackedPathwayKeysFromSourceText(block)) {
      keys.add(ownerKey);
    }
  }

  return keys;
}

function isStructuralPlaceholderSourceGapOwner(owner) {
  const pathwayId = String(owner?.pathwayId ?? "").trim();
  const ownerKey = String(owner?.ownerKey ?? "");
  return (
    pathwayId === "four-option" ||
    /:pathway:four-option$/i.test(ownerKey)
  );
}

function isInactivePathwaySourceGapOwner(owner) {
  if (owner?.ownerType !== "pathway") {
    return false;
  }

  return !ACTIVE_PATHWAY_OWNER_KEYS.has(buildOwnerKey(owner));
}

function slugifyPathwayId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getParserBackedPathwayKeysFromLabels(block) {
  if (!block?.planId || !Array.isArray(block.pathwayLabels)) {
    return [];
  }

  const keys = new Set();
  for (const label of block.pathwayLabels) {
    const normalizedPathwayId = normalizeTransferPlannerPathwayId(
      block.planId,
      slugifyPathwayId(label)
    );
    if (!normalizedPathwayId) {
      continue;
    }

    const ownerId = buildTransferPlannerOwnerId(block.planId, normalizedPathwayId);
    const ownerKey = buildOwnerKey({
      ownerType: "pathway",
      ownerKey: ownerId,
      planId: block.planId,
      pathwayId: normalizedPathwayId,
    });
    if (ACTIVE_PATHWAY_OWNER_KEYS.has(ownerKey)) {
      keys.add(ownerKey);
    }
  }

  return [...keys];
}

const PARSER_BACKED_PATHWAY_TEXT_STOPWORDS = new Set([
  "and",
  "ba",
  "bachelor",
  "bs",
  "degree",
  "major",
  "of",
  "option",
  "pathway",
  "program",
  "route",
  "the",
  "track",
  "uw",
  "washington",
]);

function normalizeParserBackedPathwayToken(token) {
  const normalized = String(token ?? "").trim().toLowerCase();
  if (normalized.endsWith("ies") && normalized.length > 4) {
    return `${normalized.slice(0, -3)}y`;
  }
  if (normalized.endsWith("s") && normalized.length > 4) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function getParserBackedPathwayTokens(...values) {
  return [
    ...new Set(
      values
        .flatMap((value) => normalizeAliasMatchText(value).split(/\s+/))
        .map(normalizeParserBackedPathwayToken)
        .filter(
          (token) =>
            token.length >= 3 && !PARSER_BACKED_PATHWAY_TEXT_STOPWORDS.has(token)
        )
    ),
  ];
}

function parserBackedBlockMentionsPathway(block, pathway) {
  const pathwayTokens = getParserBackedPathwayTokens(pathway?.pathwayId);
  const fallbackTokens = pathwayTokens.length
    ? pathwayTokens
    : getParserBackedPathwayTokens(pathway?.label);
  if (!fallbackTokens.length) {
    return false;
  }

  const evidenceTokens = new Set(
    getParserBackedPathwayTokens(
      block?.ownerTitle,
      block?.sourceLabel,
      block?.primarySourceLabel,
      block?.sourceUrl,
      block?.primarySourceUrl,
      ...(block?.pathwayLabels ?? []),
      ...(block?.requirementCueLines ?? []),
      ...(block?.chooseStatements ?? [])
    )
  );
  return fallbackTokens.every((token) => evidenceTokens.has(token));
}

function getParserBackedPathwayKeysFromSourceText(block) {
  if (!block?.planId || block?.pathwayId) {
    return [];
  }

  return (ACTIVE_PATHWAYS_BY_PLAN_ID.get(block.planId) ?? [])
    .filter((pathway) => parserBackedBlockMentionsPathway(block, pathway))
    .map((pathway) =>
      buildOwnerKey({
        ownerType: "pathway",
        ownerKey: pathway.id,
        planId: pathway.planId,
        pathwayId: pathway.pathwayId,
      })
    );
}

function normalizeAliasMatchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseDerivedOptionAliasTitle(title) {
  const normalizedTitle = String(title ?? "").trim();
  const match = normalizedTitle.match(/^(.+?):\s*(.+?)(?:\s+(\([^)]+\)))?$/);
  if (!match) {
    return null;
  }

  const parentBaseTitle = String(match[1] ?? "").trim();
  const optionTitle = String(match[2] ?? "").trim();
  const credentialSuffix = String(match[3] ?? "").trim();
  if (!parentBaseTitle || !optionTitle || !credentialSuffix) {
    return null;
  }

  return {
    parentTitle: `${parentBaseTitle} ${credentialSuffix}`,
    optionTitle,
  };
}

function titlesMatch(left, right) {
  return normalizeAliasMatchText(left) === normalizeAliasMatchText(right);
}

function pathwayMatchesOptionAlias(pathway, optionTitle) {
  const normalizedOptionTitle = normalizeAliasMatchText(optionTitle);
  const normalizedPathwayText = normalizeAliasMatchText(
    [pathway?.id, pathway?.label, pathway?.title].filter(Boolean).join(" ")
  );
  if (!normalizedOptionTitle || !normalizedPathwayText) {
    return false;
  }

  if (normalizedPathwayText.includes(normalizedOptionTitle)) {
    return true;
  }

  const optionTokens = normalizedOptionTitle
    .split(/\s+/)
    .filter((token) => token && !["option", "route", "track", "degree"].includes(token));
  return optionTokens.length > 0 && optionTokens.every((token) => normalizedPathwayText.includes(token));
}

function hasDerivedParentPathwayRuntimeCoverage(owner) {
  if (owner?.ownerType !== "major") {
    return false;
  }

  const aliasTitle = parseDerivedOptionAliasTitle(owner.title);
  if (!aliasTitle) {
    return false;
  }

  const campusId = String(owner.campusId ?? "").trim();
  const parentPlans = (TRANSFER_PLANNER_GENERATED_MAJOR_PLANS ?? []).filter(
    (plan) =>
      (!campusId || String(plan?.campusId ?? "").trim() === campusId) &&
      titlesMatch(plan?.title, aliasTitle.parentTitle)
  );

  for (const parentPlan of parentPlans) {
    const parentRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(parentPlan.id);
    if (!parentRuntimePlan) {
      continue;
    }

    const parentPathways = getTransferPlannerStudentRuntimePathwaysForPlan(parentRuntimePlan);
    if (parentPathways.some((pathway) => pathwayMatchesOptionAlias(pathway, aliasTitle.optionTitle))) {
      return true;
    }
  }

  return false;
}

function hasStudentRuntimeAliasCoverage(owner) {
  if (!owner?.planId) {
    return false;
  }

  return (
    Boolean(getTransferPlannerStudentRuntimeAliasCoverage(owner.planId, owner.pathwayId ?? null)) ||
    hasDerivedParentPathwayRuntimeCoverage(owner)
  );
}

function uniqueOwnersByKey(entries) {
  const seen = new Set();
  const uniqueEntries = [];
  for (const entry of entries) {
    const ownerKey = buildOwnerKey(entry);
    if (seen.has(ownerKey)) {
      continue;
    }
    seen.add(ownerKey);
    uniqueEntries.push(entry);
  }
  return uniqueEntries;
}

function isSchedulablePrimarySuggestion(candidate) {
  return (
    candidate &&
    candidate.confidence === "high" &&
    candidate.canCreateSchedulableRows !== false &&
    candidate.sourceRoleStatus !== "support" &&
    candidate.sourceRole !== "support-source" &&
    candidate.sourceRole !== "curriculum-map" &&
    candidate.parserType !== "html-curriculum-page"
  );
}

function buildSourceGapReport(discoveryReport, options = {}) {
  const discoveryOwnerKeys = new Set((discoveryReport.owners ?? []).map(buildOwnerKey));
  const parserBackedOwnerKeys = options.parserBackedOwnerKeys ?? new Set();
  const reviewEntries = options.reviewQueue
    ? uniqueOwnersByKey(
        getReviewQueueEntries(options.reviewQueue)
          .filter((entry) => discoveryOwnerKeys.has(buildOwnerKey(entry)))
          .filter((entry) => !parserBackedOwnerKeys.has(buildOwnerKey(entry)))
          .filter((entry) => !isStructuralPlaceholderSourceGapOwner(entry))
          .filter((entry) => !isInactivePathwaySourceGapOwner(entry))
          .filter((entry) => !hasStudentRuntimeAliasCoverage(entry))
      )
    : [];
  const sourceGapEntriesFromReview = reviewEntries.map((entry) =>
        buildSourceGapEntryFromReviewEntry(entry, options.reviewQueue.generatedAt ?? discoveryReport.generatedAt)
  );
  const entries = (options.reviewQueue
    ? sourceGapEntriesFromReview
    : (discoveryReport.owners ?? [])
    .filter((owner) => owner?.suggestedPrimary?.confidence !== "high")
    .filter((owner) => !parserBackedOwnerKeys.has(buildOwnerKey(owner)))
    .filter((owner) => !isStructuralPlaceholderSourceGapOwner(owner))
    .filter((owner) => !isInactivePathwaySourceGapOwner(owner))
    .filter((owner) => !hasStudentRuntimeAliasCoverage(owner))
    .map((owner) => buildSourceGapEntryFromDiscoveryOwner(owner, discoveryReport.generatedAt))
  )
    .sort((left, right) =>
      left.campusId.localeCompare(right.campusId) ||
      left.title.localeCompare(right.title) ||
      left.ownerKey.localeCompare(right.ownerKey)
    );
  const scopedEntries = options.targetPlanId
    ? entries.filter((entry) => entry.planId === options.targetPlanId)
    : entries;

  const countsByStatus = scopedEntries.reduce((counts, entry) => {
    counts[entry.sourceCoverageStatus] = (counts[entry.sourceCoverageStatus] ?? 0) + 1;
    return counts;
  }, {});
  const countsByCampus = scopedEntries.reduce((counts, entry) => {
    counts[entry.campusId] = (counts[entry.campusId] ?? 0) + 1;
    return counts;
  }, {});

  return {
    generatedAt: options.reviewQueue?.generatedAt ?? discoveryReport.generatedAt,
    totalSourceGapOwners: scopedEntries.length,
    countsByStatus,
    countsByCampus,
    entries,
  };
}

function buildGeneratedFile(report) {
  return [
    'import type { TransferPlannerSourceGapEntry } from "./schema";',
    "",
    "// Generated by scripts/planner/build-transfer-planner-source-gap-report.cjs",
    `export const TRANSFER_PLANNER_GAP_ENTRIES: TransferPlannerSourceGapEntry[] = ${JSON.stringify(report.entries, null, 2)};`,
    "",
  ].join("\n");
}

function writeMarkdown(report, options = {}) {
  const scopedEntries = options.targetPlanId
    ? report.entries.filter((entry) => entry.planId === options.targetPlanId)
    : report.entries;
  const lines = [
    "# Transfer Planner Source Gap Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Total hidden source-gap owners: ${report.totalSourceGapOwners}`,
    `- Parser/source adapter needed: ${report.countsByStatus["parser-unsupported"] ?? 0}`,
    `- Official source not found yet: ${report.countsByStatus["source-unfindable"] ?? 0}`,
    "",
    "This is the student-visibility source-gap registry for unresolved primary-source review owners.",
    "Do not use these entries to make student-facing claims. Keep these owners hidden until source discovery and parser support can verify them automatically.",
    "",
  ];

  for (const campusId of ["uw-seattle", "uw-bothell", "uw-tacoma"]) {
    const campusEntries = scopedEntries.filter((entry) => entry.campusId === campusId);
    if (!campusEntries.length) {
      continue;
    }

    lines.push(`## ${normalizeCampusLabel(campusId)}`, "");
    for (const entry of campusEntries) {
      lines.push(`### ${entry.title}`);
      lines.push("");
      lines.push(`- Owner: ${entry.ownerKey}`);
      lines.push(`- Status: ${entry.sourceCoverageStatus}`);
      if (entry.reviewStatus) {
        lines.push(`- Review status: ${entry.reviewStatus}`);
      }
      lines.push(`- Student visibility: ${entry.studentVisibility}`);
      lines.push(`- Reason: ${entry.sourceGapReason}`);
      lines.push(`- Official links scanned: ${entry.officialLinkCount}`);
      lines.push(`- Candidate URLs inspected: ${entry.candidateCount}`);
      if (entry.suggestedPrimary) {
        lines.push(`- Best candidate: ${entry.suggestedPrimary.url}`);
        lines.push(`- Candidate score: ${entry.suggestedPrimary.score}`);
        lines.push(`- Candidate reasons: ${entry.suggestedPrimary.reasons.join("; ") || "No reasons captured."}`);
      }
      if (entry.sourceDiscoveryAttempts.length) {
        lines.push("- Discovery attempts:");
        for (const attempt of entry.sourceDiscoveryAttempts.slice(0, 3)) {
          lines.push(`  - ${attempt.url}`);
          lines.push(`    - confidence: ${attempt.confidence}`);
          lines.push(`    - score: ${attempt.score}`);
        }
      }
      lines.push("");
    }
  }

  writePlannerMarkdownReport(OUTPUT_MD_PATH, lines);
}

function main() {
  const discoverFirst = hasArg("--discover-first") || !fs.existsSync(DISCOVERY_REPORT_PATH);
  const targetPlanId = getArgValue("--target-plan-id");

  fs.mkdirSync(TMP_DIR, { recursive: true });

  if (discoverFirst) {
    runDiscovery();
  }

  if (discoverFirst || !fs.existsSync(REVIEW_QUEUE_REPORT_PATH)) {
    runReviewQueue();
  }

  if (!fs.existsSync(DISCOVERY_REPORT_PATH)) {
    throw new Error(
      `Could not find discovery report at ${DISCOVERY_REPORT_PATH}. Run planner:discover-primary-sources first.`
    );
  }
  if (!fs.existsSync(REVIEW_QUEUE_REPORT_PATH)) {
    throw new Error(
      `Could not find review queue report at ${REVIEW_QUEUE_REPORT_PATH}. Run planner:build-primary-review-queue first.`
    );
  }

  const discoveryReport = JSON.parse(fs.readFileSync(DISCOVERY_REPORT_PATH, "utf8"));
  const reviewQueue = JSON.parse(fs.readFileSync(REVIEW_QUEUE_REPORT_PATH, "utf8"));
  const sourceGapReport = buildSourceGapReport(discoveryReport, {
    targetPlanId,
    reviewQueue,
    parserBackedOwnerKeys: buildParserBackedOwnerKeys(),
  });

  writePlannerJsonReport(OUTPUT_JSON_PATH, sourceGapReport);
  fs.writeFileSync(GENERATED_OUTPUT_PATH, buildGeneratedFile(sourceGapReport));
  writeMarkdown(sourceGapReport, { targetPlanId });

  console.log(`Source-gap owners: ${sourceGapReport.totalSourceGapOwners}`);
  console.log(`Parser/source adapter needed: ${sourceGapReport.countsByStatus["parser-unsupported"] ?? 0}`);
  console.log(`Official source not found yet: ${sourceGapReport.countsByStatus["source-unfindable"] ?? 0}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);
  console.log(`Generated source-gap registry: ${GENERATED_OUTPUT_PATH}`);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
