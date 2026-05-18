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
const {
  isSuspiciousStructuralPathwayId,
  isSuspiciousStructuralPathwayLabel,
} = require("../../constants/transfer-planner-source/pathway-materialization");
const discovery = require("./discover-transfer-planner-primary-sources.cjs");

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
const LEGACY_HARDCODED_SOURCE_REASON_PATTERN =
  /\bhardcoded official source candidate for source-gap resolution\b/i;
const LEGACY_HARDCODED_SOURCE_REASON_REPLACEMENT =
  "verified against an official source candidate";
const CLEAR_SUPPORT_ONLY_PROMOTION_PATTERN =
  /\b(advising|adviser|advisor|support sources?|student resources?|student support|forms?|petitions?|policies|policy[-\s]*(?:procedures?|resources?|forms?)|faq|frequently asked questions)\b/i;
const SOURCE_GENERATED_PLANS_BY_ID = new Map(
  TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.map((plan) => [plan.id, plan])
);

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

function normalizePromotionReasons(reasons) {
  const normalizedReasons = [];

  for (const reason of reasons ?? []) {
    const normalizedReason = LEGACY_HARDCODED_SOURCE_REASON_PATTERN.test(
      String(reason ?? "")
    )
      ? LEGACY_HARDCODED_SOURCE_REASON_REPLACEMENT
      : reason;

    if (!normalizedReasons.includes(normalizedReason)) {
      normalizedReasons.push(normalizedReason);
    }
  }

  return normalizedReasons;
}

function normalizePromotionEntry(entry) {
  if (!entry) {
    return entry;
  }

  const normalizedEntry = {
    ...entry,
    reasons: normalizePromotionReasons(entry.reasons),
  };

  if (normalizedEntry.ownerType !== "pathway") {
    return normalizedEntry;
  }

  const pathwayId = normalizeTransferPlannerPathwayId(
    normalizedEntry.planId,
    normalizedEntry.pathwayId
  );
  if (!pathwayId) {
    return normalizedEntry;
  }

  const ownerId = buildOwnerId(normalizedEntry.planId, pathwayId);
  return {
    ...normalizedEntry,
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
    discovery.isAutoPromotablePrimaryCandidate(candidate) &&
    candidate?.canCreateSchedulableRows !== false &&
    candidate?.sourceRoleStatus !== "support" &&
    candidate?.sourceRole !== "support-source" &&
    candidate?.sourceRole !== "curriculum-map"
  );
}

function isClearlySupportOnlyPromotionEntry(entry) {
  return CLEAR_SUPPORT_ONLY_PROMOTION_PATTERN.test(`${entry?.label ?? ""} ${entry?.url ?? ""}`);
}

function isGraduateOnlyPromotionEntry(entry) {
  const text = `${entry?.label ?? ""} ${entry?.url ?? ""} ${entry?.ownerTitle ?? ""}`;
  const ownerText = `${entry?.ownerTitle ?? ""}`.toLowerCase();
  if (/\b(?:graduate|masters?|master(?:'s)?|m\.?\s*s\.?|m\.?\s*a\.?|ph\.?\s*d\.?|doctoral|doctor(?:\s+of\s+philosophy)?)\b/i.test(ownerText)) {
    return false;
  }
  return (
    (/\b(?:graduate|masters?|master(?:'s)?|m\.?\s*s\.?|m\.?\s*a\.?|ph\.?\s*d\.?|doctoral|doctor(?:\s+of\s+philosophy)?)\b/i.test(text) ||
      /\/(?:student\/)?(?:applied-masters|masters?|graduate|amp)(?:[-/?#]|$)/i.test(text)) &&
    !/\b(?:undergrad(?:uate)?|bachelor|b\.?\s*s\.?|b\.?\s*a\.?)\b|\/undergrad(?:uate)?(?:[-/?#]|$)/i.test(text)
  );
}

function isMinorCredentialPromotionForMajorOwner(entry) {
  if (entry?.ownerType !== "major" || entry?.pathwayId) {
    return false;
  }
  return /#(?:credential|program)-/i.test(String(entry?.url ?? "")) && /\bminor\b/i.test(String(entry?.label ?? ""));
}

function normalizeCatalogCredentialMajorName(value) {
  return String(value ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/\b(?:bachelor|degree|with|major|minor|option|concentration|track|route|pathway|of|in|the|a|an)\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function getPromotionPlanBaseTitle(entry) {
  const planTitle = SOURCE_GENERATED_PLANS_BY_ID.get(entry?.planId)?.title ?? entry?.ownerTitle ?? "";
  return String(planTitle)
    .split(/\s+-\s+/u)[0]
    .replace(/\([^)]*\)/g, " ")
    .split(":")[0]
    .trim();
}

function extractCatalogCredentialMajorName(label) {
  const match = String(label ?? "").match(/\bmajor\s+in\s+([^:()]+?)(?::|$)/i);
  return match ? match[1].trim() : null;
}

function hasCatalogCredentialOptionTail(label) {
  return /\bmajor\s+in\s+[^:()]+:\s*\S/i.test(String(label ?? ""));
}

function isCatalogCredentialPromotionEntry(entry) {
  return /#credential-/i.test(String(entry?.url ?? "")) && /\bmajor\s+in\b/i.test(String(entry?.label ?? ""));
}

function isCatalogCredentialPromotionForDifferentMajor(entry) {
  if (!isCatalogCredentialPromotionEntry(entry)) {
    return false;
  }

  const candidateMajor = normalizeCatalogCredentialMajorName(
    extractCatalogCredentialMajorName(entry?.label)
  );
  const targetMajor = normalizeCatalogCredentialMajorName(getPromotionPlanBaseTitle(entry));
  return Boolean(candidateMajor && targetMajor && candidateMajor !== targetMajor);
}

function isPathwayScopedCatalogCredentialPromotionForBroadMajorOwner(entry) {
  if (entry?.ownerType !== "major" || entry?.pathwayId || !isCatalogCredentialPromotionEntry(entry)) {
    return false;
  }

  const planTitle = SOURCE_GENERATED_PLANS_BY_ID.get(entry?.planId)?.title ?? entry?.ownerTitle ?? "";
  if (String(planTitle ?? "").includes(":")) {
    return false;
  }

  return hasCatalogCredentialOptionTail(entry?.label);
}

function hasDocumentUrlWithAppendedPath(entry) {
  return /\.(?:pdf|docx?)(?:\/|%2f)[^?#]/i.test(String(entry?.url ?? ""));
}

function isSuspiciousStructuralPathwayPromotionEntry(entry) {
  if (entry?.ownerType !== "pathway") {
    return false;
  }

  return (
    isSuspiciousStructuralPathwayId(entry?.pathwayId) ||
    isSuspiciousStructuralPathwayLabel(entry?.label) ||
    isSuspiciousStructuralPathwayLabel(entry?.ownerTitle)
  );
}

function isUnsafeAutomaticPromotionEntry(entry) {
  return (
    isMinorCredentialPromotionForMajorOwner(entry) ||
    isCatalogCredentialPromotionForDifferentMajor(entry) ||
    isPathwayScopedCatalogCredentialPromotionForBroadMajorOwner(entry) ||
    isSuspiciousStructuralPathwayPromotionEntry(entry) ||
    hasDocumentUrlWithAppendedPath(entry)
  );
}

function buildPromotionEntryCandidateFromOwner(owner) {
  const pathwayId = normalizeTransferPlannerPathwayId(owner?.planId, owner?.pathwayId ?? null);
  const ownerId = buildOwnerId(owner?.planId, pathwayId);
  return {
    ownerType: owner?.ownerType,
    ownerId,
    ownerKey: ownerId,
    planId: owner?.planId,
    pathwayId,
    ownerTitle: owner?.title,
    campusId: owner?.campusId,
    url: owner?.suggestedPrimary?.url,
    label: normalizeLabel(owner),
    sourceRole: owner?.suggestedPrimary?.sourceRole ?? null,
    sourceRoleStatus: owner?.suggestedPrimary?.sourceRoleStatus ?? null,
    parserType: owner?.suggestedPrimary?.parserType ?? null,
  };
}

function suggestedPrimaryIsSafeForAutomaticPromotion(owner) {
  return !isUnsafeAutomaticPromotionEntry(buildPromotionEntryCandidateFromOwner(owner));
}

function normalizePromotionUrlForComparison(value) {
  try {
    const url = new URL(String(value ?? ""));
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/u, "");
    return url.toString().toLowerCase();
  } catch {
    return String(value ?? "")
      .trim()
      .replace(/[?#].*$/u, "")
      .replace(/\/+$/u, "")
      .toLowerCase();
  }
}

function getSingleSpecializedPlanOfficialUrl(plan) {
  if (!plan || !String(plan.title ?? "").includes(":")) {
    return null;
  }

  const urls = Array.from(
    new Set(
      (plan.officialLinks ?? [])
        .map((link) => normalizePromotionUrlForComparison(link?.url))
        .filter(Boolean)
    )
  );

  return urls.length === 1 ? urls[0] : null;
}

function previousPromotionMatchesSpecializedPlanSource(entry) {
  if (entry?.ownerType !== "pathway") {
    return true;
  }

  const officialUrl = getSingleSpecializedPlanOfficialUrl(
    SOURCE_GENERATED_PLANS_BY_ID.get(entry.planId)
  );
  if (!officialUrl) {
    return true;
  }

  const entryUrl = normalizePromotionUrlForComparison(entry.url);
  return !entryUrl || entryUrl === officialUrl;
}

function suggestedPrimaryMatchesSpecializedPlanSource(owner) {
  const officialUrl = getSingleSpecializedPlanOfficialUrl(
    SOURCE_GENERATED_PLANS_BY_ID.get(owner?.planId)
  );
  if (!officialUrl) {
    return true;
  }

  const suggestedUrl = normalizePromotionUrlForComparison(owner?.suggestedPrimary?.url);
  return !suggestedUrl || suggestedUrl === officialUrl;
}

function currentPrimaryCannotCreateSchedulableRows(owner) {
  const currentPrimary = owner?.currentPrimary ?? null;
  return Boolean(
    currentPrimary &&
      (
        currentPrimary.sourceRoleStatus !== "primary" ||
        currentPrimary.canCreateSchedulableRows === false ||
        currentPrimary.canBePrimary === false
      )
  );
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
      .filter((entry) => !isGraduateOnlyPromotionEntry(entry))
      .filter((entry) => !isUnsafeAutomaticPromotionEntry(entry))
      .filter((entry) => previousPromotionMatchesSpecializedPlanSource(entry))
      .filter((entry) => activeOwnerIds.has(entry.ownerId))
      .filter((entry) => discovery.isAutoPromotablePrimaryCandidate(entry))
      .filter((entry) => !reviewOwnerKeys.has(buildOwnerKey(entry)))
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
    .filter((owner) => suggestedPrimaryMatchesSpecializedPlanSource(owner))
    .filter((owner) => suggestedPrimaryIsSafeForAutomaticPromotion(owner))
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
        sourceRole: owner.suggestedPrimary.sourceRole ?? null,
        sourceRoleStatus: owner.suggestedPrimary.sourceRoleStatus ?? null,
        parserType: owner.suggestedPrimary.parserType ?? null,
        canCreateSchedulableRows:
          owner.suggestedPrimary.canCreateSchedulableRows ?? null,
        score: owner.suggestedPrimary.score,
        confidence: "high",
        reasons: owner.suggestedPrimary.reasons ?? [],
        generatedAt: discoveryReport.generatedAt,
      });
    });

  (discoveryReport.weakExistingOwners ?? [])
    .concat(
      (discoveryReport.owners ?? []).filter(
        (owner) => owner?.existingPrimaryUrl && owner?.suggestedAction === "replace-existing-primary"
      )
    )
    .filter((owner) => owner?.suggestedAction === "replace-existing-primary")
    .filter((owner) => isSchedulablePrimarySuggestion(owner?.suggestedPrimary))
    .filter((owner) => suggestedPrimaryMatchesSpecializedPlanSource(owner))
    .filter((owner) => suggestedPrimaryIsSafeForAutomaticPromotion(owner))
    .filter((owner) => {
      const ownerKey = buildOwnerKey(owner);
      const blockedByReviewQueue = reviewOwnerKeys.has(ownerKey);
      if (blockedByReviewQueue && !currentPrimaryCannotCreateSchedulableRows(owner)) {
        skippedInReviewQueue.push(ownerKey);
      }
      return !blockedByReviewQueue || currentPrimaryCannotCreateSchedulableRows(owner);
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
        sourceRole: owner.suggestedPrimary.sourceRole ?? null,
        sourceRoleStatus: owner.suggestedPrimary.sourceRoleStatus ?? null,
        parserType: owner.suggestedPrimary.parserType ?? null,
        canCreateSchedulableRows:
          owner.suggestedPrimary.canCreateSchedulableRows ?? null,
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
