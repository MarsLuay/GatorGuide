const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const DISCOVERY_REPORT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-primary-source-discovery.json"
);
const REVIEW_QUEUE_REPORT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-primary-source-review-queue.json"
);
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-source-gaps.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-source-gaps.md");
const GENERATED_OUTPUT_PATH = path.resolve(
  REPO_ROOT,
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
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS,
} = require(path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "requirement-source-adapters.generated.ts"
));
const {
  TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY,
} = require(path.resolve(REPO_ROOT, "constants", "transfer-planner-source"));

const ACTIVE_PATHWAY_OWNER_KEYS = new Set(
  (TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY ?? []).map((entry) => entry.id)
);

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

function runDiscovery() {
  const result = spawnSync("node", ["scripts/planner/discover-transfer-planner-primary-sources.cjs"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error("Primary-source discovery failed, so source-gap reporting could not continue.");
  }
}

function runReviewQueue() {
  const result = spawnSync(
    "node",
    ["scripts/planner/build-transfer-planner-primary-source-review-queue.cjs"],
    {
      cwd: REPO_ROOT,
      stdio: "inherit",
      shell: false,
    }
  );

  if (result.status !== 0) {
    throw new Error("Primary-source review queue failed, so source-gap reporting could not continue.");
  }
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
  return `${owner.ownerType}:${owner.ownerKey}`;
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
  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS ?? []) {
    if (!block?.ok || !block.planId || !canParsedRequirementSourceBlockCreateRequiredScheduleRows(block)) {
      continue;
    }

    keys.add(`major:${block.planId}`);
    if (block.pathwayId) {
      keys.add(`pathway:${block.ownerId || `${block.planId}:pathway:${block.pathwayId}`}`);
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

  return !ACTIVE_PATHWAY_OWNER_KEYS.has(String(owner.ownerKey ?? ""));
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
    `export const TRANSFER_PLANNER_SOURCE_GAP_ENTRIES: TransferPlannerSourceGapEntry[] = ${JSON.stringify(report.entries, null, 2)};`,
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

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
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

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(sourceGapReport, null, 2)}\n`);
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
