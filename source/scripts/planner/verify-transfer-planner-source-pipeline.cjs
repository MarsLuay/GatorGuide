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
  analyzeOwner,
  buildReplacementDecision,
  buildOwnerTargetRecord,
  buildWeakExistingPrimarySignals,
  scoreCandidate,
} = require("./discover-transfer-planner-primary-sources.cjs");
const {
  TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS,
} = require("../../constants/transfer-planner-source/primary-source-promotions.generated");
const {
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINTS,
} = require("../../constants/transfer-planner-source/source-fingerprints.generated");
const {
  getParseablePrimaryEntries,
} = require("./parse-transfer-planner-requirement-sources.cjs");

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

function getEligibleMissingPrimaryAutoPromotionOwners(discoveryReport, reviewQueue) {
  const reviewOwnerKeys = buildReviewOwnerKeySet(reviewQueue);
  return (discoveryReport.owners ?? [])
    .filter((owner) => !owner.existingPrimaryUrl)
    .filter((owner) => isSchedulablePrimarySuggestion(owner?.suggestedPrimary))
    .filter((owner) => !reviewOwnerKeys.has(owner.ownerKey))
    .map((owner) => ({
      ownerId: buildOwnerId(owner.planId, owner.pathwayId ?? null),
      ownerKey: owner.ownerKey,
      title: owner.title,
      promotedUrl: owner.suggestedPrimary.url,
    }));
}

function getEligibleWeakExistingReplacementOwners(discoveryReport) {
  return (discoveryReport.weakExistingOwners ?? [])
    .filter((owner) => owner?.suggestedAction === "replace-existing-primary")
    .filter((owner) => isSchedulablePrimarySuggestion(owner?.suggestedPrimary))
    .map((owner) => ({
      ownerId: buildOwnerId(owner.planId, owner.pathwayId ?? null),
      ownerKey: owner.ownerKey,
      title: owner.title,
      promotedUrl: owner.suggestedPrimary.url,
    }));

}

function getEligibleAutoPromotionOwners(discoveryReport, reviewQueue) {
  return [
    ...getEligibleMissingPrimaryAutoPromotionOwners(discoveryReport, reviewQueue),
    ...getEligibleWeakExistingReplacementOwners(discoveryReport),
  ].sort((left, right) =>
    left.ownerId.localeCompare(right.ownerId)
  );
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

function buildParseableRequirementSourceManifestEntries() {
  return getParseablePrimaryEntries();
}

function buildManifestParseKey(entry) {
  return `${entry.ownerId}::${entry.url}`;
}

function buildReportParseKey(owner) {
  return `${owner.ownerId}::${owner.primarySourceUrl ?? owner.sourceUrl}`;
}

function buildManifestPlanSourceKey(entry) {
  return `${entry.planId ?? entry.ownerId}::${entry.url}`;
}

function buildReportPlanSourceKey(owner) {
  return `${owner.planId ?? owner.ownerId?.split(":pathway:")[0] ?? owner.ownerId}::${
    owner.primarySourceUrl ?? owner.sourceUrl
  }`;
}

function compareSets(left, right) {
  const leftValues = new Set(left);
  const rightValues = new Set(right);
  return {
    leftOnly: [...leftValues].filter((value) => !rightValues.has(value)).sort(),
    rightOnly: [...rightValues].filter((value) => !leftValues.has(value)).sort(),
  };
}

const ASTRONOMY_TIMELINE_URL = "https://astro.washington.edu/timeline-and-requirements";
const ASTRONOMY_UNDERGRAD_URL = "https://astro.washington.edu/undergraduate-program";
const ASTRONOMY_GRAD_URL = "https://astro.washington.edu/graduate-program";
const ASTRONOMY_ROOT_URL = "https://astro.washington.edu/";
const BIOCHEM_BA_PDF_URL =
  "https://chem.washington.edu/sites/chem/files/documents/undergrad/babioccheck2017_001.pdf";
const BIOCHEM_BS_PDF_URL =
  "https://chem.washington.edu/sites/chem/files/documents/undergrad/biochem2018.pdf";
const BIOCHEM_BA_PAGE_URL = "https://chem.washington.edu/ba-biochemistry";
const BIOCHEM_BS_PAGE_URL = "https://chem.washington.edu/bs-biochemistry";

function buildMockHtmlPage(url, title, headings, anchors = []) {
  return {
    url,
    ok: true,
    status: 200,
    finalUrl: url,
    contentType: "text/html",
    title,
    headings,
    anchors: anchors.map((anchor) => ({
      url: anchor.url,
      text: anchor.text,
      sourceUrl: url,
    })),
    error: null,
  };
}

function buildMockPdfPage(url) {
  return {
    url,
    ok: true,
    status: 200,
    finalUrl: url,
    contentType: "application/pdf",
    title: null,
    headings: [],
    anchors: [],
    error: null,
  };
}

function createMockInspectPage(pagesByUrl) {
  return async (url) => {
    const normalizedUrl = String(url ?? "").trim();
    const page = pagesByUrl.get(normalizedUrl);
    if (page) {
      return page;
    }

    return {
      url: normalizedUrl,
      ok: false,
      status: 404,
      finalUrl: normalizedUrl,
      contentType: "text/html",
      title: null,
      headings: [],
      anchors: [],
      error: `No mock page registered for ${normalizedUrl}`,
    };
  };
}

function buildBiochemistryMockPages() {
  return new Map([
    [BIOCHEM_BA_PDF_URL, buildMockPdfPage(BIOCHEM_BA_PDF_URL)],
    [BIOCHEM_BS_PDF_URL, buildMockPdfPage(BIOCHEM_BS_PDF_URL)],
    [
      BIOCHEM_BA_PAGE_URL,
      buildMockHtmlPage(
        BIOCHEM_BA_PAGE_URL,
        "BA in Biochemistry | Department of Chemistry | University of Washington",
        ["BA in Biochemistry", "Degree Requirements", "Admissions"],
        [
          { url: BIOCHEM_BA_PDF_URL, text: "BA Biochemistry Checklist (PDF)" },
          { url: BIOCHEM_BS_PAGE_URL, text: "BS in Biochemistry" },
        ]
      ),
    ],
    [
      BIOCHEM_BS_PAGE_URL,
      buildMockHtmlPage(
        BIOCHEM_BS_PAGE_URL,
        "BS in Biochemistry | Department of Chemistry | University of Washington",
        ["BS in Biochemistry", "Degree Requirements", "Admissions"],
        [
          { url: BIOCHEM_BS_PDF_URL, text: "BS Biochemistry Checklist (PDF)" },
          { url: BIOCHEM_BA_PAGE_URL, text: "BA in Biochemistry" },
        ]
      ),
    ],
  ]);
}

async function buildBiochemistryReplacementFixtureResult(routeId) {
  const routeLabel = routeId === "bs-route" ? "B.S. route" : "B.A. route";
  const routeTitle = `Biochemistry - ${routeLabel}`;
  const trackId =
    "grc-associate-stem-chemistry-associate-in-science-transfer-track-1-chemistry";
  const target = buildOwnerTargetRecord({
    analysisMode: "weak-existing-primary",
    ownerType: "pathway",
    ownerKey: `uw-seattle-biochemistry:pathway:${routeId}`,
    planId: "uw-seattle-biochemistry",
    pathwayId: routeId,
    campusId: "uw-seattle",
    title: routeTitle,
    label: routeLabel,
    officialLinks: [
      {
        label: "BA Biochemistry Checklist (PDF)",
        url: BIOCHEM_BA_PDF_URL,
      },
      {
        label: "UW BA in Biochemistry requirements",
        url: BIOCHEM_BA_PAGE_URL,
      },
    ],
    existingPrimary: {
      label: "BA Biochemistry Checklist (PDF)",
      url: BIOCHEM_BA_PDF_URL,
    },
    reevaluationSignals: [
      {
        code: "primary-source-appears-year-specific",
        reason:
          "Current primary looks tied to 2017 in its source URL/title/document text, so discovery should compare it against sibling official sources.",
      },
    ],
    reevaluationContext: {
      runtimeGrcCourseCount: 10,
      bestTrackId: trackId,
      trackRecommendationId: trackId,
      noPublicClassificationCount: 0,
      parsedUwCourseCodeCount: 12,
      qualityWarningCodes: [],
      hasStrongRequirementCue: true,
      currentSourceYears: [2017],
      currentSourceLatestYear: 2017,
      yearSpecificRequirementSource: true,
    },
    parsedBlock: {
      ok: true,
      extractedTitle: null,
      extractedHeadings: [],
      parsedUwCourseCodes: ["CHEM 237", "CHEM 242", "MATH 124", "PHYS 114"],
      qualitySignals: [],
    },
  });

  return analyzeOwner(target, 15000, {
    inspectPageImpl: createMockInspectPage(buildBiochemistryMockPages()),
  });
}

function findCandidateByUrl(result, url) {
  return (result?.topCandidates ?? []).find((candidate) => candidate.url === url) ?? null;
}

async function buildAstronomyReplacementFixtureResult() {
  const target = buildOwnerTargetRecord({
    analysisMode: "weak-existing-primary",
    ownerType: "major",
    ownerKey: "uw-seattle-astronomy",
    planId: "uw-seattle-astronomy",
    pathwayId: null,
    campusId: "uw-seattle",
    title: "Astronomy",
    label: "Astronomy",
    officialLinks: [
      {
        label: "Timeline and Requirements",
        url: ASTRONOMY_TIMELINE_URL,
      },
    ],
    existingPrimary: {
      label: "Timeline and Requirements",
      url: ASTRONOMY_TIMELINE_URL,
    },
    reevaluationSignals: [
      {
        code: "safe-intentional-empty-state",
        reason: "Planner runtime still lands in a safe-empty state with no student-visible GRC course pool.",
      },
      {
        code: "primary-url-looks-graduate-or-timeline",
        reason: "Current primary URL looks like a timeline, graduate, or non-degree page.",
      },
    ],
    reevaluationContext: {
      runtimeGrcCourseCount: 0,
      bestTrackId: null,
      trackRecommendationId: null,
      noPublicClassificationCount: 0,
      parsedUwCourseCodeCount: 6,
      qualityWarningCodes: [],
      hasStrongRequirementCue: false,
    },
    parsedBlock: {
      ok: true,
      extractedTitle: "Timeline and Requirements | Department of Astronomy | University of Washington",
      extractedHeadings: ["Timeline & Requirements", "Overview", "Graduate Program"],
      parsedUwCourseCodes: ["PHYS 121", "PHYS 122", "MATH 124"],
      qualitySignals: [],
    },
  });

  const mockInspectPage = createMockInspectPage(
    new Map([
      [
        ASTRONOMY_TIMELINE_URL,
        buildMockHtmlPage(
          ASTRONOMY_TIMELINE_URL,
          "Timeline and Requirements | Department of Astronomy | University of Washington",
          ["Timeline & Requirements", "Overview", "Graduate Program"],
          [
            { url: ASTRONOMY_UNDERGRAD_URL, text: "Undergraduate Program" },
            { url: ASTRONOMY_GRAD_URL, text: "Graduate Program" },
          ]
        ),
      ],
      [
        ASTRONOMY_ROOT_URL,
        buildMockHtmlPage(
          ASTRONOMY_ROOT_URL,
          "Department of Astronomy | University of Washington",
          ["Department of Astronomy", "Undergraduate Program", "Graduate Program"],
          [
            { url: ASTRONOMY_UNDERGRAD_URL, text: "Undergraduate Program" },
            { url: ASTRONOMY_GRAD_URL, text: "Graduate Program" },
          ]
        ),
      ],
      [
        ASTRONOMY_UNDERGRAD_URL,
        buildMockHtmlPage(
          ASTRONOMY_UNDERGRAD_URL,
          "Undergraduate Program | Department of Astronomy | University of Washington",
          ["Undergraduate Program", "Major Admissions Requirements", "Degree Requirements"]
        ),
      ],
      [
        ASTRONOMY_GRAD_URL,
        buildMockHtmlPage(
          ASTRONOMY_GRAD_URL,
          "Graduate Program | Department of Astronomy | University of Washington",
          ["Graduate Program", "Timeline & Requirements", "PhD Requirements"]
        ),
      ],
    ])
  );

  return analyzeOwner(target, 100, {
    inspectPageImpl: mockInspectPage,
  });
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

async function runAsyncCheck(id, label, callback) {
  try {
    const details = await callback();
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
    `- Weak existing primaries re-evaluated: ${report.metrics.weakExistingOwnerCount}`,
    `- High-confidence replacements: ${report.metrics.highConfidenceReplacementOwnerCount}`,
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

async function main() {
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
  const eligibleMissingPrimaryAutoPromotionOwners = getEligibleMissingPrimaryAutoPromotionOwners(
    discoveryReport,
    reviewQueue
  );
  const eligibleWeakExistingReplacementOwners =
    getEligibleWeakExistingReplacementOwners(discoveryReport);
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
  const parseableRequirementSourceEntries = buildParseableRequirementSourceManifestEntries();
  const parsedOwnerIds = new Set((requirementParseReport.owners ?? []).map((owner) => owner.ownerId));
  const parsedRequirementSourceKeys = new Set(
    (requirementParseReport.owners ?? []).map(buildReportParseKey)
  );
  const parsedRequirementPlanSourceKeys = new Set(
    (requirementParseReport.owners ?? []).map(buildReportPlanSourceKey)
  );
  const requirementFingerprintOwnerIds = new Set(
    (TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINTS ?? []).map((entry) => entry.ownerId)
  );

  const checks = [
    runCheck(
      "discovery-partition",
      "Missing-primary discovery owners partition cleanly into eligible auto-promotions and review-queue owners",
      () => {
        assert.equal(
          discoveryReport.ownerCount,
          eligibleMissingPrimaryAutoPromotionOwners.length + reviewQueue.totalReviewOwners,
          "Discovery owner count should equal eligible auto-promotions plus review-queue owners."
        );
        return [
          `Discovery owners: ${discoveryReport.ownerCount}`,
          `Eligible missing-primary auto-promotions: ${eligibleMissingPrimaryAutoPromotionOwners.length}`,
          `Eligible weak-existing replacements: ${eligibleWeakExistingReplacementOwners.length}`,
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
      "Canonical parseable requirement sources align with parser input and parser output",
      () => {
        const parseableRequirementSourceKeys =
          parseableRequirementSourceEntries.map(buildManifestParseKey);
        const parserOutputDiff = compareSets(
          parseableRequirementSourceKeys,
          parsedRequirementSourceKeys
        );
        const missingCurrentSourceCoverage = parseableRequirementSourceEntries.filter(
          (entry) =>
            !parsedRequirementSourceKeys.has(buildManifestParseKey(entry)) &&
            !parsedRequirementPlanSourceKeys.has(buildManifestPlanSourceKey(entry))
        );
        assert.ok(
          requirementParseReport.totalOwners >= parseablePrimaryManifestOwners.size,
          "Parse report should cover at least the canonical parseable primary-owner count."
        );
        assert.deepEqual(
          missingCurrentSourceCoverage.map(buildManifestParseKey),
          [],
          `Current parseable registry source(s) missing parser coverage: ${missingCurrentSourceCoverage
            .map(buildManifestParseKey)
            .join(", ")}`
        );
        return [
          `Canonical parseable primary owners: ${parseablePrimaryManifestOwners.size}`,
          `Parseable requirement sources: ${parseableRequirementSourceEntries.length}`,
          `Parsed source blocks: ${requirementParseReport.totalOwners}`,
          `Exact parser/registry source delta: registry-only=${parserOutputDiff.leftOnly.length}, parsed-only=${parserOutputDiff.rightOnly.length}`,
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
        const fingerprintOwnerDiff = compareSets([...parsedOwnerIds], [...requirementFingerprintOwnerIds]);
        assert.equal(
          sourceFingerprintReport.totalRequirementSourceFingerprints,
          requirementParseReport.totalOwners,
          "Requirement fingerprint count should match parsed owner count."
        );
        assert.deepEqual(
          fingerprintOwnerDiff,
          { leftOnly: [], rightOnly: [] },
          `Requirement fingerprint owner mismatch. parsed-only=${fingerprintOwnerDiff.leftOnly.join(", ")} fingerprint-only=${fingerprintOwnerDiff.rightOnly.join(", ")}`
        );
        return [
          `Requirement fingerprints: ${sourceFingerprintReport.totalRequirementSourceFingerprints}`,
          `Parsed owners: ${requirementParseReport.totalOwners}`,
          `Touched source owners: ${(sourceFingerprintReport.touchedSourceOwnerIds ?? []).length}`,
          `Touched requirement owners: ${(sourceFingerprintReport.touchedRequirementOwnerIds ?? []).length}`,
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

  checks.push(
    await runAsyncCheck(
      "stale-year-replacement-trigger",
      "Year-tied primary degree sheets can trigger re-evaluation even when parsing still succeeds",
      async () => {
        const staleSignals = buildWeakExistingPrimarySignals({
          primarySource: {
            label: "BA Biochemistry Checklist (PDF)",
            url: BIOCHEM_BA_PDF_URL,
          },
          parsedBlock: {
            ok: true,
            extractedTitle: "Bachelor of Arts in Biochemistry",
            extractedHeadings: ["Degree Requirements", "Biochemistry"],
            parsedUwCourseCodes: ["CHEM 237", "CHEM 242", "MATH 124", "PHYS 114"],
            qualitySignals: [],
            requirementCueLines: ["Bachelor of Arts in Biochemistry"],
            chooseStatements: [],
          },
          runtimeGrcCourseCount: 10,
          bestTrackId:
            "grc-associate-stem-chemistry-associate-in-science-transfer-track-1-chemistry",
          trackRecommendationId:
            "grc-associate-stem-chemistry-associate-in-science-transfer-track-1-chemistry",
          noPublicClassificationCount: 0,
        });

        assert.equal(
          staleSignals.triggered,
          true,
          "Expected the stale year trigger to re-evaluate the current primary."
        );
        assert.ok(
          staleSignals.signals.some(
            (signal) => signal.code === "primary-source-appears-year-specific"
          ),
          "Expected the year-specific primary-source signal."
        );
        return staleSignals.signals.map((signal) => signal.code).join(", ");
      }
    )
  );

  checks.push(
    await runAsyncCheck(
      "weak-existing-primary-replacement-trigger",
      "Weak-source replacement can trigger for an owner that already has an official primary source",
      async () => {
        const weakSignals = buildWeakExistingPrimarySignals({
          primarySource: {
            label: "Timeline and Requirements",
            url: ASTRONOMY_TIMELINE_URL,
          },
          parsedBlock: {
            ok: true,
            extractedHeadings: ["Timeline & Requirements", "Overview", "Graduate Program"],
            parsedUwCourseCodes: ["PHYS 121", "PHYS 122", "MATH 124"],
            qualitySignals: [],
          },
          runtimeGrcCourseCount: 0,
          bestTrackId: null,
          trackRecommendationId: null,
          noPublicClassificationCount: 0,
        });

        assert.equal(weakSignals.triggered, true, "Expected the weak-source trigger to fire.");
        assert.ok(
          weakSignals.signals.some((signal) => signal.code === "safe-intentional-empty-state"),
          "Expected the safe-intentional-empty-state signal."
        );
        assert.ok(
          weakSignals.signals.some(
            (signal) => signal.code === "primary-url-looks-graduate-or-timeline"
          ),
          "Expected the timeline/graduate source-shape signal."
        );
        return weakSignals.signals.map((signal) => signal.code).join(", ");
      }
    )
  );

  checks.push(
    await runAsyncCheck(
      "biochemistry-sibling-discovery-finds-current-route-pages",
      "Biochemistry stale-year re-evaluation discovers current sibling route pages and checklist PDFs",
      async () => {
        const fixtureResult = await buildBiochemistryReplacementFixtureResult("bs-route");
        const newerPdfCandidate = findCandidateByUrl(fixtureResult, BIOCHEM_BS_PDF_URL);

        assert.equal(
          fixtureResult.suggestedAction,
          "replace-existing-primary",
          "Expected the stale BS-route fixture to recommend replacing the current primary."
        );
        assert.equal(
          fixtureResult.suggestedPrimary?.url,
          BIOCHEM_BS_PAGE_URL,
          "Expected the current BS degree page to become the preferred replacement."
        );
        assert.ok(
          newerPdfCandidate,
          "Expected discovery to find the newer BS checklist PDF from sibling official pages."
        );
        return [
          `Suggested replacement: ${fixtureResult.suggestedPrimary?.url}`,
          `Discovered newer sibling PDF: ${newerPdfCandidate?.url}`,
          `Newer sibling PDF score: ${newerPdfCandidate?.score}`,
        ];
      }
    )
  );

  checks.push(
    await runAsyncCheck(
      "newer-sibling-docs-outrank-older-pdfs-when-route-matches",
      "Newer official sibling requirement docs outrank older equivalent PDFs when the program route still matches",
      async () => {
        const fixtureResult = await buildBiochemistryReplacementFixtureResult("bs-route");
        const currentPdfCandidate = findCandidateByUrl(fixtureResult, BIOCHEM_BA_PDF_URL);
        const newerPdfCandidate = findCandidateByUrl(fixtureResult, BIOCHEM_BS_PDF_URL);

        assert.ok(currentPdfCandidate, "Expected the current PDF candidate.");
        assert.ok(newerPdfCandidate, "Expected the newer sibling PDF candidate.");
        assert.ok(
          newerPdfCandidate.score > currentPdfCandidate.score,
          `Expected newer sibling PDF score ${newerPdfCandidate.score} to exceed current PDF score ${currentPdfCandidate.score}.`
        );
        return [
          `Current PDF score: ${currentPdfCandidate.score}`,
          `Newer sibling PDF score: ${newerPdfCandidate.score}`,
        ];
      }
    )
  );

  checks.push(
    await runAsyncCheck(
      "year-signal-does-not-override-route-match",
      "Year recency does not override a stronger same-route major-program match",
      async () => {
        const fixtureResult = await buildBiochemistryReplacementFixtureResult("ba-route");

        assert.equal(
          fixtureResult.suggestedPrimary?.url,
          BIOCHEM_BA_PAGE_URL,
          "Expected the BA route to prefer the BA degree page instead of the newer BS checklist PDF."
        );
        assert.notEqual(
          fixtureResult.suggestedPrimary?.url,
          BIOCHEM_BS_PDF_URL,
          "A newer BS checklist PDF should not override the BA route match by year alone."
        );
        return [
          `Suggested BA-route replacement: ${fixtureResult.suggestedPrimary?.url}`,
          `Top BA-route candidate: ${fixtureResult.topCandidates?.[0]?.url ?? "none"}`,
        ];
      }
    )
  );

  checks.push(
    await runAsyncCheck(
      "multi-pathway-majors-do-not-auto-swap-to-single-route-pages",
      "Multi-pathway major owners keep review candidates instead of auto-replacing with a single-route page",
      async () => {
        const decision = buildReplacementDecision(
          {
            analysisMode: "weak-existing-primary",
            ownerType: "major",
            ownerKey: "uw-seattle-chemistry",
            planId: "uw-seattle-chemistry",
            pathwayId: null,
            campusId: "uw-seattle",
            title: "Chemistry",
            label: "Chemistry",
            officialLinks: [
              {
                label: "BS Chemistry Checklist - ACS Certified (PDF)",
                url: "https://chem.washington.edu/sites/chem/files/documents/undergrad/acs2018.pdf",
              },
              {
                label: "UW BA in Chemistry requirements",
                url: "https://chem.washington.edu/ba-chemistry",
              },
            ],
            existingPrimaryUrl:
              "https://chem.washington.edu/sites/chem/files/documents/undergrad/acs2018.pdf",
            existingPrimaryLabel: "BS Chemistry Checklist - ACS Certified (PDF)",
            pathwayCount: 3,
            reevaluationSignals: [
              {
                code: "primary-source-appears-year-specific",
                reason: "Current primary looks tied to 2018.",
              },
            ],
            reevaluationContext: {
              currentSourceLatestYear: 2018,
            },
          },
          [
            {
              url: "https://chem.washington.edu/ba-chemistry",
              label: "UW BA in Chemistry requirements",
              pageTitle: "BA Chemistry Degree Requirements",
              pageHeadings: ["Bachelor of Arts in Chemistry", "Degree Requirements"],
              sourceRole: "primary-degree-requirements",
              sourceRoleStatus: "primary",
              supportOnly: false,
              canBePrimary: true,
              canCreateSchedulableRows: true,
              score: 64,
              confidence: "high",
              latestDetectedYear: null,
              reasons: [
                "explicit degree-requirements wording",
                "explicitly names the selected major",
                "matches major keyword \"chemistry\"",
                "official source path matches the selected major",
                "stays on the current official department host",
                "stays on an official UW domain",
                "specific bachelor route wording",
              ],
            },
            {
              url: "https://chem.washington.edu/sites/chem/files/documents/undergrad/acs2018.pdf",
              label: "BS Chemistry Checklist - ACS Certified (PDF)",
              sourceRole: "primary-degree-requirements",
              sourceRoleStatus: "primary",
              supportOnly: false,
              canBePrimary: true,
              canCreateSchedulableRows: true,
              score: 28,
              confidence: "high",
              latestDetectedYear: 2018,
              reasons: [
                "already stored as an official source",
                "checklist-style wording",
                "explicitly names the selected major",
                "route-specific page may not cover every pathway in the selected major",
                "stays on the current official department host",
              ],
            },
          ]
        );

        assert.equal(
          decision.action,
          "keep-existing-primary",
          "Expected the multi-pathway chemistry major to keep the current primary instead of auto-swapping to a BA-only page."
        );
        assert.equal(
          decision.reviewCandidate?.url,
          "https://chem.washington.edu/ba-chemistry",
          "Expected the BA chemistry page to remain only a review candidate for the major owner."
        );
        return [
          `Action: ${decision.action}`,
          `Review candidate: ${decision.reviewCandidate?.url ?? "none"}`,
        ];
      }
    )
  );

  checks.push(
    await runAsyncCheck(
      "replacement-candidates-come-from-real-official-links",
      "Replacement candidates come from real official links and discovered anchors, not guessed URLs",
      async () => {
        const fixtureResult = await buildAstronomyReplacementFixtureResult();
        assert.equal(
          fixtureResult.suggestedPrimary?.url,
          ASTRONOMY_UNDERGRAD_URL,
          "Expected the astronomy undergraduate page to be the suggested replacement."
        );
        assert.ok(
          (fixtureResult.suggestedPrimary?.sourceKinds ?? []).includes("discovered-anchor"),
          "Expected the suggested replacement to be traced to a discovered official anchor."
        );
        assert.equal(
          fixtureResult.suggestedPrimary?.sourcePageUrl,
          ASTRONOMY_TIMELINE_URL,
          "Expected the replacement candidate to be discovered from the current official source page."
        );
        return [
          `Suggested replacement: ${fixtureResult.suggestedPrimary?.url}`,
          `Source kind: ${(fixtureResult.suggestedPrimary?.sourceKinds ?? []).join(", ")}`,
          `Discovered from: ${fixtureResult.suggestedPrimary?.sourcePageUrl}`,
        ];
      }
    )
  );

  checks.push(
    await runAsyncCheck(
      "undergraduate-pages-outrank-timeline-and-graduate-pages",
      "Undergraduate degree pages outrank timeline and graduate pages when all are official",
      async () => {
        const target = buildOwnerTargetRecord({
          analysisMode: "weak-existing-primary",
          ownerType: "major",
          ownerKey: "uw-seattle-astronomy",
          planId: "uw-seattle-astronomy",
          campusId: "uw-seattle",
          title: "Astronomy",
          label: "Astronomy",
          officialLinks: [
            {
              label: "Timeline and Requirements",
              url: ASTRONOMY_TIMELINE_URL,
            },
          ],
          existingPrimary: {
            label: "Timeline and Requirements",
            url: ASTRONOMY_TIMELINE_URL,
          },
        });

        const undergradScore = scoreCandidate(target, {
          url: ASTRONOMY_UNDERGRAD_URL,
          label: "Undergraduate Program",
          sourceKind: "discovered-anchor",
          anchorText: "Undergraduate Program",
          pageTitle: "Undergraduate Program | Department of Astronomy | University of Washington",
          pageHeadings: ["Undergraduate Program", "Major Admissions Requirements", "Degree Requirements"],
        }).score;
        const timelineScore = scoreCandidate(target, {
          url: ASTRONOMY_TIMELINE_URL,
          label: "Timeline and Requirements",
          sourceKind: "official-link",
          pageTitle: "Timeline and Requirements | Department of Astronomy | University of Washington",
          pageHeadings: ["Timeline & Requirements", "Overview", "Graduate Program"],
        }).score;
        const graduateScore = scoreCandidate(target, {
          url: ASTRONOMY_GRAD_URL,
          label: "Graduate Program",
          sourceKind: "discovered-anchor",
          pageTitle: "Graduate Program | Department of Astronomy | University of Washington",
          pageHeadings: ["Graduate Program", "Timeline & Requirements", "PhD Requirements"],
        }).score;

        assert.ok(
          undergradScore > timelineScore,
          `Expected undergrad score ${undergradScore} to exceed timeline score ${timelineScore}.`
        );
        assert.ok(
          undergradScore > graduateScore,
          `Expected undergrad score ${undergradScore} to exceed graduate score ${graduateScore}.`
        );
        return [
          `Undergraduate score: ${undergradScore}`,
          `Timeline score: ${timelineScore}`,
          `Graduate score: ${graduateScore}`,
        ];
      }
    )
  );

  checks.push(
    await runAsyncCheck(
      "strong-existing-primaries-do-not-churn",
      "Strong existing primaries are not replaced without a clearly better candidate",
      async () => {
        const strongSignals = buildWeakExistingPrimarySignals({
          primarySource: {
            label: "Degree requirements",
            url: ASTRONOMY_UNDERGRAD_URL,
          },
          parsedBlock: {
            ok: true,
            extractedHeadings: [
              "Undergraduate Program",
              "Major Admissions Requirements",
              "Degree Requirements",
            ],
            parsedUwCourseCodes: ["PHYS 121", "PHYS 122", "MATH 124", "ASTR 300"],
            qualitySignals: [],
          },
          runtimeGrcCourseCount: 8,
          bestTrackId: "grc-associate-stem-physics-associate-in-science-transfer-track-2-physics",
          trackRecommendationId:
            "grc-associate-stem-physics-associate-in-science-transfer-track-2-physics",
          noPublicClassificationCount: 0,
        });

        assert.equal(
          strongSignals.triggered,
          false,
          "A strong undergraduate primary should not be flagged for replacement."
        );
        return "Strong undergraduate primary left in place.";
      }
    )
  );

  checks.push(
    await runAsyncCheck(
      "astronomy-fixture-prefers-undergraduate-program",
      "Focused Astronomy fixture prefers the undergraduate-program page over timeline-and-requirements",
      async () => {
        const fixtureResult = await buildAstronomyReplacementFixtureResult();
        assert.equal(
          fixtureResult.suggestedAction,
          "replace-existing-primary",
          "Expected the fixture to recommend replacing the weak current primary."
        );
        assert.equal(
          fixtureResult.suggestedPrimary?.url,
          ASTRONOMY_UNDERGRAD_URL,
          "Expected the astronomy undergraduate program page to outrank the timeline page."
        );
        assert.ok(
          (fixtureResult.suggestedScoreDelta ?? 0) >= 10,
          `Expected a clear score delta, received ${fixtureResult.suggestedScoreDelta}.`
        );
        return [
          `Suggested action: ${fixtureResult.suggestedAction}`,
          `Replacement: ${fixtureResult.suggestedPrimary?.url}`,
          `Score delta: ${fixtureResult.suggestedScoreDelta}`,
        ];
      }
    )
  );

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
      weakExistingOwnerCount: (discoveryReport.weakExistingOwners ?? []).length,
      highConfidenceReplacementOwnerCount:
        discoveryReport.highConfidenceReplacementCount ??
        (discoveryReport.weakExistingOwners ?? []).filter(
          (owner) => owner.suggestedAction === "replace-existing-primary"
        ).length,
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
