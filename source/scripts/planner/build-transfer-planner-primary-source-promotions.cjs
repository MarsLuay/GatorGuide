const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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
  getTransferPlannerPathwaysForPlan,
} = require("../../constants/transfer-planner-source");
const {
  buildTransferPlannerOwnerId,
  normalizeTransferPlannerOwnerId,
  normalizeTransferPlannerPathwayId,
} = require("../../constants/transfer-planner-source/pathway-id-normalization");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const DISCOVERY_REPORT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-primary-source-discovery.json"
);
const REVIEW_QUEUE_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-primary-source-review-queue.json"
);
const OUTPUT_JSON_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-primary-source-promotions.json"
);
const OUTPUT_MD_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-primary-source-promotions.md"
);
const GENERATED_OUTPUT_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "primary-source-promotions.generated.ts"
);
const WEAK_SOURCE_REPLACEMENT_REASON_PATTERN = /Replaces existing primary .*weak-source re-evaluation/i;
const CLEAR_SUPPORT_ONLY_PROMOTION_PATTERN =
  /\b(advising|adviser|advisor|support sources?|student resources?|student support|forms?|petitions?|policies|policy[-\s]*(?:procedures?|resources?|forms?)|faq|frequently asked questions)\b/i;

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

function runReviewQueue(discoverFirst) {
  const args = ["scripts/planner/build-transfer-planner-primary-source-review-queue.cjs"];
  if (discoverFirst) {
    args.push("--discover-first");
  }

  const result = spawnSync("node", args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error("Primary-source review queue generation failed, so promotion could not continue.");
  }
}

function buildOwnerId(planId, pathwayId) {
  return buildTransferPlannerOwnerId(planId, pathwayId);
}

function buildOwnerKey(owner) {
  return normalizeTransferPlannerOwnerId(
    owner?.ownerKey ?? owner?.ownerId ?? null,
    owner?.planId ?? null,
    owner?.pathwayId ?? null
  );
}

function normalizePromotionEntry(entry) {
  if (!entry || entry.ownerType !== "pathway") {
    return entry;
  }

  const pathwayId = normalizeTransferPlannerPathwayId(entry.planId, entry.pathwayId);
  if (!pathwayId) {
    return entry;
  }

  const ownerId = buildOwnerId(entry.planId, pathwayId);
  return {
    ...entry,
    ownerId,
    ownerKey: ownerId,
    pathwayId,
  };
}

function normalizeLabel(owner) {
  return (
    owner?.suggestedPrimary?.label ||
    owner?.suggestedPrimary?.anchorText ||
    owner?.suggestedPrimary?.pageTitle ||
    `${owner.title} requirements`
  );
}

function isSchedulablePrimarySuggestion(candidate) {
  return (
    candidate &&
    candidate.confidence === "high" &&
    candidate.canCreateSchedulableRows !== false &&
    candidate.sourceRoleStatus === "primary"
  );
}

function isClearlySupportOnlyPromotionEntry(entry) {
  return CLEAR_SUPPORT_ONLY_PROMOTION_PATTERN.test(`${entry?.label ?? ""} ${entry?.url ?? ""}`);
}

function buildReviewOwnerKeySet(reviewQueue) {
  return new Set(
    (reviewQueue.campuses ?? []).flatMap((campus) =>
      (campus.entries ?? []).map(
        (entry) => buildOwnerKey(entry)
      )
    )
  );
}

function loadPreviousPromotions() {
  if (!fs.existsSync(GENERATED_OUTPUT_PATH)) {
    return [];
  }

  try {
    delete require.cache[require.resolve(GENERATED_OUTPUT_PATH)];
    const loaded = require(GENERATED_OUTPUT_PATH);
    return loaded.TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS ?? [];
  } catch (error) {
    console.log(`Could not load previous promoted primary sources: ${error.message}`);
    return [];
  }
}

function buildActiveOwnerIdSet() {
  const ownerIds = new Set();

  for (const plan of TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS) {
    ownerIds.add(buildOwnerId(plan.id, null));

    for (const pathway of getTransferPlannerPathwaysForPlan(plan)) {
      ownerIds.add(buildOwnerId(plan.id, pathway.id));
    }
  }

  return ownerIds;
}

function buildPromotionReport(discoveryReport, reviewQueue, previousEntries) {
  const reviewOwnerKeys = buildReviewOwnerKeySet(reviewQueue);
  const skippedInReviewQueue = [];
  const activeOwnerIds = buildActiveOwnerIdSet();
  const entriesByOwnerId = new Map(
    (previousEntries ?? [])
      .map(normalizePromotionEntry)
      .filter(
        (entry) =>
          !(entry.reasons ?? []).some((reason) =>
            WEAK_SOURCE_REPLACEMENT_REASON_PATTERN.test(String(reason ?? ""))
          )
      )
      .filter((entry) => !isClearlySupportOnlyPromotionEntry(entry))
      .filter((entry) => activeOwnerIds.has(entry.ownerId))
      .map((entry) => [
        entry.ownerId,
        {
          ...entry,
        },
      ])
  );

  (discoveryReport.owners ?? [])
    .filter((owner) => !owner.existingPrimaryUrl)
    .filter((owner) => isSchedulablePrimarySuggestion(owner?.suggestedPrimary))
    .filter((owner) => {
      const ownerKey = buildOwnerKey(owner);
      const blockedByReviewQueue = reviewOwnerKeys.has(ownerKey);
      if (blockedByReviewQueue) {
        skippedInReviewQueue.push(ownerKey);
      }
      return !blockedByReviewQueue;
    })
    .forEach((owner) => {
      const pathwayId = normalizeTransferPlannerPathwayId(owner.planId, owner.pathwayId ?? null);
      const ownerId = buildOwnerId(owner.planId, pathwayId);
      entriesByOwnerId.set(ownerId, {
        ownerType: owner.ownerType,
        ownerId,
        ownerKey: ownerId,
        planId: owner.planId,
        pathwayId,
        ownerTitle: owner.title,
        campusId: owner.campusId,
        url: owner.suggestedPrimary.url,
        label: normalizeLabel(owner),
        score: owner.suggestedPrimary.score,
        confidence: "high",
        reasons: owner.suggestedPrimary.reasons ?? [],
        generatedAt: discoveryReport.generatedAt,
      });
    });

  (discoveryReport.weakExistingOwners ?? [])
    .filter((owner) => owner?.suggestedAction === "replace-existing-primary")
    .filter((owner) => isSchedulablePrimarySuggestion(owner?.suggestedPrimary))
    .forEach((owner) => {
      const pathwayId = normalizeTransferPlannerPathwayId(owner.planId, owner.pathwayId ?? null);
      const ownerId = buildOwnerId(owner.planId, pathwayId);
      entriesByOwnerId.set(ownerId, {
        ownerType: owner.ownerType,
        ownerId,
        ownerKey: ownerId,
        planId: owner.planId,
        pathwayId,
        ownerTitle: owner.title,
        campusId: owner.campusId,
        url: owner.suggestedPrimary.url,
        label: normalizeLabel(owner),
        score: owner.suggestedPrimary.score,
        confidence: "high",
        reasons: [
          ...(owner.suggestedPrimary.reasons ?? []),
          `Replaces existing primary ${owner.existingPrimaryUrl} after weak-source re-evaluation.`,
        ],
        generatedAt: discoveryReport.generatedAt,
      });
    });

  const entries = Array.from(entriesByOwnerId.values())
    .sort((left, right) =>
      left.campusId.localeCompare(right.campusId) ||
      left.ownerTitle.localeCompare(right.ownerTitle) ||
      left.ownerId.localeCompare(right.ownerId)
    );

  const countsByCampus = entries.reduce((counts, entry) => {
    counts[entry.campusId] = (counts[entry.campusId] ?? 0) + 1;
    return counts;
  }, {});

  return {
    generatedAt: discoveryReport.generatedAt,
    totalPromotions: entries.length,
    countsByCampus,
    skippedInReviewQueueCount: skippedInReviewQueue.length,
    entries,
  };
}

function buildGeneratedFile(report) {
  return [
    'import type { TransferPlannerPrimarySourcePromotionEntry } from "./schema";',
    "",
    "// Generated by scripts/planner/build-transfer-planner-primary-source-promotions.cjs",
    `export const TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS: TransferPlannerPrimarySourcePromotionEntry[] = ${JSON.stringify(report.entries, null, 2)};`,
    "",
  ].join("\n");
}

function writeMarkdown(report) {
  const lines = [
    "# Transfer Planner Primary Source Promotions",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Auto-promoted high-confidence primary sources: ${report.totalPromotions}`,
    `- Skipped because they still appear in the review queue: ${report.skippedInReviewQueueCount}`,
    "",
  ];

  for (const campusId of ["uw-seattle", "uw-bothell", "uw-tacoma"]) {
    const campusEntries = report.entries.filter((entry) => entry.campusId === campusId);
    if (!campusEntries.length) {
      continue;
    }

    lines.push(`## ${campusId}`, "");
    lines.push(`- Auto-promoted owners: ${campusEntries.length}`);
    lines.push("");

    for (const entry of campusEntries) {
      lines.push(`### ${entry.ownerTitle}`);
      lines.push("");
      lines.push(`- Owner: ${entry.ownerId}`);
      lines.push(`- Primary source: ${entry.url}`);
      lines.push(`- Label: ${entry.label}`);
      lines.push(`- Discovery score: ${entry.score}`);
      lines.push(`- Why: ${entry.reasons.join("; ") || "No reasons captured."}`);
      lines.push("");
    }
  }

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function main() {
  const discoverFirst = hasArg("--discover-first");
  const reviewQueueFirst =
    hasArg("--review-queue-first") ||
    discoverFirst ||
    !fs.existsSync(DISCOVERY_REPORT_PATH) ||
    !fs.existsSync(REVIEW_QUEUE_PATH);

  fs.mkdirSync(TMP_DIR, { recursive: true });

  if (reviewQueueFirst) {
    runReviewQueue(discoverFirst);
  }

  if (!fs.existsSync(DISCOVERY_REPORT_PATH)) {
    throw new Error(
      `Could not find discovery report at ${DISCOVERY_REPORT_PATH}. Run planner:discover-primary-sources first.`
    );
  }

  if (!fs.existsSync(REVIEW_QUEUE_PATH)) {
    throw new Error(
      `Could not find review queue at ${REVIEW_QUEUE_PATH}. Run planner:build-primary-review-queue first.`
    );
  }

  const discoveryReport = JSON.parse(fs.readFileSync(DISCOVERY_REPORT_PATH, "utf8"));
  const reviewQueue = JSON.parse(fs.readFileSync(REVIEW_QUEUE_PATH, "utf8"));
  const previousEntries = loadPreviousPromotions();
  const report = buildPromotionReport(discoveryReport, reviewQueue, previousEntries);

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(GENERATED_OUTPUT_PATH, buildGeneratedFile(report));
  writeMarkdown(report);

  console.log(`Auto-promoted primary sources: ${report.totalPromotions}`);
  console.log(`Skipped in review queue: ${report.skippedInReviewQueueCount}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);
  console.log(`Generated promotion registry: ${GENERATED_OUTPUT_PATH}`);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
