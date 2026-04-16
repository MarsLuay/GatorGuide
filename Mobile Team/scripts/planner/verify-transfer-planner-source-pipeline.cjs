const assert = require("assert/strict");
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
  TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY,
} = require("../../constants/transfer-planner-source");
const {
  TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS,
} = require("../../constants/transfer-planner-source/primary-source-promotions.generated");
const {
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINTS,
} = require("../../constants/transfer-planner-source/source-fingerprints.generated");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const DISCOVERY_REPORT_PATH = path.resolve(TMP_DIR, "transfer-planner-primary-source-discovery.json");
const REVIEW_QUEUE_REPORT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-primary-source-review-queue.json"
);
const PROMOTION_REPORT_PATH = path.resolve(TMP_DIR, "transfer-planner-primary-source-promotions.json");
const SOURCE_GAP_REPORT_PATH = path.resolve(TMP_DIR, "transfer-planner-source-gaps.json");
const REQUIREMENT_PARSE_REPORT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-requirement-source-parse-report.json"
);
const SOURCE_FINGERPRINT_REPORT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-source-fingerprints.json"
);
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-source-pipeline-validation.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-source-pipeline-validation.md");

const PARSEABLE_PARSER_TYPES = new Set([
  "html-degree-page",
  "html-curriculum-page",
  "html-overview-page",
  "catalog-page",
  "generic-html",
  "pdf-degree-sheet",
  "pdf-worksheet",
  "generic-pdf",
]);

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label} at ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function buildOwnerId(planId, pathwayId) {
  return pathwayId ? `${planId}:pathway:${pathwayId}` : planId;
}

function buildReviewOwnerKeySet(reviewQueue) {
  return new Set(
    (reviewQueue.campuses ?? []).flatMap((campus) =>
      (campus.entries ?? []).map(
        (entry) => entry.ownerKey ?? buildOwnerId(entry.planId, entry.pathwayId ?? null)
      )
    )
  );
}

function getEligibleAutoPromotionOwners(discoveryReport, reviewQueue) {
  const reviewOwnerKeys = buildReviewOwnerKeySet(reviewQueue);
  return (discoveryReport.owners ?? [])
    .filter((owner) => !owner.existingPrimaryUrl)
    .filter((owner) => owner?.suggestedPrimary?.confidence === "high")
    .filter((owner) => !reviewOwnerKeys.has(owner.ownerKey))
    .map((owner) => ({
      ownerId: buildOwnerId(owner.planId, owner.pathwayId ?? null),
      ownerKey: owner.ownerKey,
      title: owner.title,
      promotedUrl: owner.suggestedPrimary.url,
    }))
    .sort((left, right) => left.ownerId.localeCompare(right.ownerId));
}

function buildPrimaryManifestOwnerMap() {
  return new Map(
    TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
      (entry) =>
        (entry.ownerType === "major" || entry.ownerType === "pathway") &&
        entry.campusId &&
        entry.campusId !== "grc" &&
        entry.isPrimaryDegreeRequirementsLink
    ).map((entry) => [entry.ownerId, entry])
  );
}

function buildParseablePrimaryManifestOwnerMap() {
  return new Map(
    TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
      (entry) =>
        (entry.ownerType === "major" || entry.ownerType === "pathway") &&
        entry.campusId &&
        entry.campusId !== "grc" &&
        entry.isPrimaryDegreeRequirementsLink &&
        PARSEABLE_PARSER_TYPES.has(entry.parserType)
    ).map((entry) => [entry.ownerId, entry])
  );
}

function compareSets(left, right) {
  const leftValues = new Set(left);
  const rightValues = new Set(right);
  return {
    leftOnly: [...leftValues].filter((value) => !rightValues.has(value)).sort(),
    rightOnly: [...rightValues].filter((value) => !leftValues.has(value)).sort(),
  };
}

function runCheck(id, label, callback) {
  try {
    const details = callback();
    return {
      id,
      label,
      status: "passed",
      details: Array.isArray(details) ? details.map(String) : details ? [String(details)] : [],
    };
  } catch (error) {
    return {
      id,
      label,
      status: "failed",
      details: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function escapeMarkdown(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|");
}

function writeReports(report) {
  ensureDir(TMP_DIR);
  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    "# Transfer Planner Source Pipeline Validation",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Outcome: ${report.outcome}`,
    `- Passed checks: ${report.passedCount}`,
    `- Failed checks: ${report.failedCount}`,
    `- Eligible auto-promotions from discovery: ${report.metrics.eligibleAutoPromotionOwnerCount}`,
    `- Review-queue owners: ${report.metrics.reviewQueueOwnerCount}`,
    `- Source-gap owners: ${report.metrics.sourceGapOwnerCount}`,
    `- Promoted owners in canonical registry: ${report.metrics.promotedOwnerCount}`,
    `- Parseable primary owners: ${report.metrics.parseablePrimaryOwnerCount}`,
    `- Parsed owners: ${report.metrics.parsedOwnerCount}`,
    `- Requirement fingerprints: ${report.metrics.requirementFingerprintOwnerCount}`,
    "",
    "| Check | Status | Details |",
    "| --- | --- | --- |",
    ...report.checks.map((check) => {
      const details = check.details.length ? check.details.map(escapeMarkdown).join("<br>") : "";
      return `| ${escapeMarkdown(check.label)} | ${check.status} | ${details} |`;
    }),
    "",
  ];

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function main() {
  const discoveryReport = readJson(DISCOVERY_REPORT_PATH, "primary-source discovery report");
  const reviewQueue = readJson(REVIEW_QUEUE_REPORT_PATH, "primary-source review queue");
  const promotionReport = readJson(PROMOTION_REPORT_PATH, "primary-source promotion report");
  const sourceGapReport = readJson(SOURCE_GAP_REPORT_PATH, "source-gap report");
  const requirementParseReport = readJson(
    REQUIREMENT_PARSE_REPORT_PATH,
    "requirement source parse report"
  );
  const sourceFingerprintReport = readJson(
    SOURCE_FINGERPRINT_REPORT_PATH,
    "source fingerprint report"
  );

  const eligibleAutoPromotionOwners = getEligibleAutoPromotionOwners(discoveryReport, reviewQueue);
  const eligibleAutoPromotionOwnerIds = new Set(
    eligibleAutoPromotionOwners.map((owner) => owner.ownerId)
  );
  const eligibleAutoPromotionOwnerKeys = new Set(
    eligibleAutoPromotionOwners.map((owner) => owner.ownerKey)
  );
  const reviewOwnerKeys = buildReviewOwnerKeySet(reviewQueue);
  const sourceGapOwnerKeys = new Set(
    (sourceGapReport.entries ?? []).map((entry) => entry.ownerKey)
  );
  const promotedOwnerIds = new Set(
    (TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS ?? []).map((entry) => entry.ownerId)
  );
  const promotedOwnerKeys = new Set(
    (TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS ?? []).map((entry) => entry.ownerKey)
  );
  const primaryManifestOwners = buildPrimaryManifestOwnerMap();
  const parseablePrimaryManifestOwners = buildParseablePrimaryManifestOwnerMap();
  const parsedOwnerIds = new Set((requirementParseReport.owners ?? []).map((owner) => owner.ownerId));
  const requirementFingerprintOwnerIds = new Set(
    (TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINTS ?? []).map((entry) => entry.ownerId)
  );

  const checks = [
    runCheck(
      "discovery-partition",
      "Discovery owners partition cleanly into eligible auto-promotions and review-queue owners",
      () => {
        assert.equal(
          discoveryReport.ownerCount,
          eligibleAutoPromotionOwners.length + reviewQueue.totalReviewOwners,
          "Discovery owner count should equal eligible auto-promotions plus review-queue owners."
        );
        return [
          `Discovery owners: ${discoveryReport.ownerCount}`,
          `Eligible auto-promotions: ${eligibleAutoPromotionOwners.length}`,
          `Review-queue owners: ${reviewQueue.totalReviewOwners}`,
        ];
      }
    ),
    runCheck(
      "promotion-report-matches-generated-registry",
      "Generated promotion registry matches the promotion report",
      () => {
        assert.equal(
          promotionReport.totalPromotions,
          TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS.length,
          "Promotion report count should match the generated promotion registry."
        );
        return `Promoted owners: ${promotionReport.totalPromotions}`;
      }
    ),
    runCheck(
      "eligible-discoveries-promoted",
      "Eligible high-confidence discoveries are promoted unless they remain in the review queue",
      () => {
        const missingPromotions = eligibleAutoPromotionOwners.filter(
          (owner) => !promotedOwnerIds.has(owner.ownerId)
        );
        assert.deepEqual(
          missingPromotions.map((owner) => owner.ownerId),
          [],
          `Missing promoted owners: ${missingPromotions
            .map((owner) => owner.ownerId)
            .slice(0, 12)
            .join(", ")}`
        );
        return `Eligible promoted owners verified: ${eligibleAutoPromotionOwners.length}`;
      }
    ),
    runCheck(
      "review-queue-aligned-with-source-gaps",
      "Review queue and source-gap report point at the same unresolved owners",
      () => {
        const setDiff = compareSets(reviewOwnerKeys, sourceGapOwnerKeys);
        assert.deepEqual(
          setDiff,
          { leftOnly: [], rightOnly: [] },
          `Review/source-gap mismatch. review-only=${setDiff.leftOnly.join(", ")} source-gap-only=${setDiff.rightOnly.join(", ")}`
        );
        return `Shared unresolved owners: ${sourceGapReport.totalSourceGapOwners}`;
      }
    ),
    runCheck(
      "promotions-materialized-in-canonical-registry",
      "Auto-promoted owners are materialized in the canonical primary-source registry",
      () => {
        const missingCanonicalPrimaryEntries = (TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS ?? []).filter(
          (entry) => !primaryManifestOwners.has(entry.ownerId)
        );
        const promotionReviewIntersection = uniqueSorted(
          (TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS ?? [])
            .filter((entry) => reviewOwnerKeys.has(entry.ownerKey))
            .map((entry) => entry.ownerId)
        );
        const promotionGapIntersection = uniqueSorted(
          (TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS ?? [])
            .filter((entry) => sourceGapOwnerKeys.has(entry.ownerKey))
            .map((entry) => entry.ownerId)
        );

        assert.deepEqual(
          missingCanonicalPrimaryEntries.map((entry) => entry.ownerId),
          [],
          `Promoted owners missing canonical primary entries: ${missingCanonicalPrimaryEntries
            .map((entry) => entry.ownerId)
            .slice(0, 12)
            .join(", ")}`
        );
        assert.deepEqual(
          promotionReviewIntersection,
          [],
          `Promoted owners should not remain in the review queue: ${promotionReviewIntersection.join(", ")}`
        );
        assert.deepEqual(
          promotionGapIntersection,
          [],
          `Promoted owners should not remain hidden as source gaps: ${promotionGapIntersection.join(", ")}`
        );
        return [
          `Promoted owners: ${TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS.length}`,
          `Canonical primary owners: ${primaryManifestOwners.size}`,
        ];
      }
    ),
    runCheck(
      "registry-parser-alignment",
      "Canonical parseable primary owners align with parser input and parser output",
      () => {
        const parseablePrimaryOwnerIds = [...parseablePrimaryManifestOwners.keys()];
        const parserOutputDiff = compareSets(parseablePrimaryOwnerIds, parsedOwnerIds);
        assert.equal(
          requirementParseReport.totalOwners,
          parseablePrimaryManifestOwners.size,
          "Parse report owner count should match the canonical parseable primary-owner count."
        );
        assert.deepEqual(
          parserOutputDiff,
          { leftOnly: [], rightOnly: [] },
          `Registry/parser owner mismatch. registry-only=${parserOutputDiff.leftOnly.join(", ")} parsed-only=${parserOutputDiff.rightOnly.join(", ")}`
        );
        return [
          `Canonical parseable primary owners: ${parseablePrimaryManifestOwners.size}`,
          `Parsed owners: ${requirementParseReport.totalOwners}`,
        ];
      }
    ),
    runCheck(
      "promoted-owners-parsed-and-fingerprinted",
      "Promoted owners appear in parser output and requirement fingerprints",
      () => {
        const missingParsedOwners = (TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS ?? []).filter(
          (entry) => !parsedOwnerIds.has(entry.ownerId)
        );
        const missingFingerprintOwners = (TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS ?? []).filter(
          (entry) => !requirementFingerprintOwnerIds.has(entry.ownerId)
        );
        assert.deepEqual(
          missingParsedOwners.map((entry) => entry.ownerId),
          [],
          `Promoted owners missing parsed blocks: ${missingParsedOwners
            .map((entry) => entry.ownerId)
            .slice(0, 12)
            .join(", ")}`
        );
        assert.deepEqual(
          missingFingerprintOwners.map((entry) => entry.ownerId),
          [],
          `Promoted owners missing requirement fingerprints: ${missingFingerprintOwners
            .map((entry) => entry.ownerId)
            .slice(0, 12)
            .join(", ")}`
        );
        return `Promoted owners verified end-to-end: ${TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS.length}`;
      }
    ),
    runCheck(
      "fingerprint-alignment",
      "Requirement fingerprint coverage stays aligned with parsed requirement owners",
      () => {
        assert.equal(
          sourceFingerprintReport.totalRequirementSourceFingerprints,
          requirementParseReport.totalOwners,
          "Requirement fingerprint count should match parsed owner count."
        );
        if (
          eligibleAutoPromotionOwners.length > 0 &&
          sourceFingerprintReport.addedSourceFingerprintCount > 0
        ) {
          assert.notEqual(
            sourceFingerprintReport.addedRequirementFingerprintCount,
            0,
            "Detected added source fingerprints for a refresh with eligible auto-promotions, but no new requirement fingerprints were produced."
          );
        }
        return [
          `Requirement fingerprints: ${sourceFingerprintReport.totalRequirementSourceFingerprints}`,
          `Parsed owners: ${requirementParseReport.totalOwners}`,
          `Added source fingerprints: ${sourceFingerprintReport.addedSourceFingerprintCount}`,
          `Added requirement fingerprints: ${sourceFingerprintReport.addedRequirementFingerprintCount}`,
        ];
      }
    ),
    runCheck(
      "eligible-promotions-cleared-from-review-and-gap-reports",
      "Eligible auto-promotions are fully cleared from the review queue and source-gap report",
      () => {
        const lingeringReviewOwners = eligibleAutoPromotionOwners
          .filter((owner) => reviewOwnerKeys.has(owner.ownerKey))
          .map((owner) => owner.ownerId);
        const lingeringGapOwners = eligibleAutoPromotionOwners
          .filter((owner) => sourceGapOwnerKeys.has(owner.ownerKey))
          .map((owner) => owner.ownerId);
        assert.deepEqual(
          lingeringReviewOwners,
          [],
          `Eligible auto-promotions still in review queue: ${lingeringReviewOwners.join(", ")}`
        );
        assert.deepEqual(
          lingeringGapOwners,
          [],
          `Eligible auto-promotions still in source-gap report: ${lingeringGapOwners.join(", ")}`
        );
        return `Eligible owners fully cleared: ${eligibleAutoPromotionOwners.length}`;
      }
    ),
  ];

  const failedChecks = checks.filter((check) => check.status === "failed");
  const report = {
    generatedAt: new Date().toISOString(),
    outcome: failedChecks.length ? "failed" : "passed",
    passedCount: checks.length - failedChecks.length,
    failedCount: failedChecks.length,
    metrics: {
      eligibleAutoPromotionOwnerCount: eligibleAutoPromotionOwnerIds.size,
      eligibleAutoPromotionOwnerIds: [...eligibleAutoPromotionOwnerIds].sort(),
      eligibleAutoPromotionOwnerKeys: [...eligibleAutoPromotionOwnerKeys].sort(),
      reviewQueueOwnerCount: reviewOwnerKeys.size,
      sourceGapOwnerCount: sourceGapOwnerKeys.size,
      promotedOwnerCount: promotedOwnerIds.size,
      promotedOwnerKeys: [...promotedOwnerKeys].sort(),
      canonicalPrimaryOwnerCount: primaryManifestOwners.size,
      parseablePrimaryOwnerCount: parseablePrimaryManifestOwners.size,
      parsedOwnerCount: parsedOwnerIds.size,
      requirementFingerprintOwnerCount: requirementFingerprintOwnerIds.size,
    },
    checks,
  };

  writeReports(report);

  if (failedChecks.length) {
    for (const failedCheck of failedChecks) {
      console.error(`Source pipeline validation failed: ${failedCheck.label}`);
      for (const detail of failedCheck.details) {
        console.error(`- ${detail}`);
      }
    }
    process.exit(1);
  }

  console.log("Transfer planner source pipeline invariants passed.");
  console.log(`Report: ${OUTPUT_MD_PATH}`);
}

main();
