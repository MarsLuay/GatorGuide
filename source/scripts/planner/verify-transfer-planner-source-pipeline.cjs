/* global __dirname */
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const {
  SOURCE_ROOT,
  ensurePlannerTmpLayout,
  getArgValues,
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
  TRANSFER_PLANNER_MANIFEST_REGISTRY,
  TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY,
  TRANSFER_PLANNER_GENERATED_MAJOR_PLANS,
  getTransferPlannerStudentRuntimeMajorPlan,
  getTransferPlannerStudentRuntimePathwaysForPlan,
} = require("../../constants/transfer-planner-source");
const {
  analyzeOwner,
  buildReplacementDecision,
  buildOwnerTargetRecord,
  buildWeakExistingPrimarySignals,
  scoreCandidate,
} = require("./discover-transfer-planner-primary-sources.cjs");
const {
  TRANSFER_PLANNER_PRIMARY_PROMOTIONS,
} = require("../../constants/transfer-planner-source/primary-source-promotions.generated");
const {
  TRANSFER_PLANNER_REQUIREMENT_FINGERPRINTS,
} = require("../../constants/transfer-planner-source/source-fingerprints.generated");
const {
  TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCKS,
} = require("../../constants/transfer-planner-source/requirement-source-adapters.generated");
const {
  buildTransferPlannerOwnerId,
  normalizeTransferPlannerOwnerId,
  normalizeTransferPlannerPathwayId,
} = require("../../constants/transfer-planner-source/pathway-id-normalization");
const {
  isSuspiciousStructuralPathwayId,
  isSuspiciousStructuralPathwayLabel,
} = require("../../constants/transfer-planner-source/pathway-materialization");
const {
  getParseablePrimaryEntries,
} = require("./parse-transfer-planner-requirement-sources.cjs");
const {
  getTransferPlannerStudentRuntimeAliasCoverage,
} = require("../../constants/transfer-planner-source/student-runtime");
const {
  shouldSkipTransferPlannerAutoPromotedPrimarySource,
} = require("../../constants/transfer-planner-source/manual-source-link-overrides");

const REPO_ROOT = SOURCE_ROOT;
ensurePlannerTmpLayout();
const DISCOVERY_REPORT_PATH = getPlannerTmpPath("transfer-planner-primary-source-discovery.json");
const REVIEW_QUEUE_REPORT_PATH = getPlannerTmpPath("transfer-planner-primary-source-review-queue.json");
const PROMOTION_REPORT_PATH = getPlannerTmpPath("transfer-planner-primary-source-promotions.json");
const GAP_REPORT_PATH = getPlannerTmpPath("transfer-planner-source-gaps.json");
const REQUIREMENT_PARSE_REPORT_PATH = getPlannerTmpPath("transfer-planner-requirement-source-parse-report.json");
const FINGERPRINT_REPORT_PATH = getPlannerTmpPath("transfer-planner-source-fingerprints.json");
const OUTPUT_JSON_PATH = getPlannerTmpPath("transfer-planner-source-pipeline-validation.json");
const OUTPUT_MD_PATH = getPlannerTmpPath("transfer-planner-source-pipeline-validation.md");

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
const CLEAR_SUPPORT_ONLY_PROMOTION_PATTERN =
  /\b(advising|adviser|advisor|study abroad|support sources?|student resources?|student support|forms?|petitions?|policies|policy[-\s]*(?:procedures?|resources?|forms?)|faq|frequently asked questions)\b/i;

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label} at ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function parseTargetPlanIdsFromArgs() {
  return uniqueSorted([
    ...getArgValues(["--target-plan-id", "--plan-id"]),
    ...getArgValues("--target-plan-ids").flatMap((value) => value.split(",")),
  ].map((value) => String(value ?? "").trim()));
}

function buildOwnerId(planId, pathwayId) {
  return buildTransferPlannerOwnerId(planId, pathwayId);
}

function getPlanIdFromOwnerId(ownerId) {
  return String(ownerId ?? "").split(":pathway:")[0] || null;
}

function buildOwnerKey(owner) {
  return normalizeTransferPlannerOwnerId(
    owner?.ownerKey ?? owner?.ownerId ?? null,
    owner?.planId ?? null,
    owner?.pathwayId ?? null
  );
}

function getReviewQueueEntries(reviewQueue) {
  return (reviewQueue.campuses ?? []).flatMap((campus) => campus.entries ?? []);
}

function getValidationScopedReviewQueueEntries(reviewQueue, targetPlanId = null) {
  const entries = getReviewQueueEntries(reviewQueue);
  if (!targetPlanId) {
    return entries;
  }

  return entries.filter((entry) => entry?.planId === targetPlanId);
}

function buildReviewOwnerKeySet(reviewQueue) {
  return new Set(getReviewQueueEntries(reviewQueue).map((entry) => buildOwnerKey(entry)));
}

const ACTIVE_PATHWAY_OWNER_KEYS = new Set(
  (TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY ?? []).map((entry) =>
    normalizeTransferPlannerOwnerId(entry.id, entry.planId, entry.pathwayId)
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

function slugifyPathwayId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getParserBackedReviewOwnerKeysFromLabels(block) {
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
    const ownerKey = normalizeTransferPlannerOwnerId(
      ownerId,
      block.planId,
      normalizedPathwayId
    );
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

function getParserBackedReviewOwnerKeysFromSourceText(block) {
  if (!block?.planId || block?.pathwayId) {
    return [];
  }

  return (ACTIVE_PATHWAYS_BY_PLAN_ID.get(block.planId) ?? [])
    .filter((pathway) => parserBackedBlockMentionsPathway(block, pathway))
    .map((pathway) =>
      normalizeTransferPlannerOwnerId(
        pathway.id,
        pathway.planId,
        pathway.pathwayId
      )
    )
    .filter((ownerKey) => ACTIVE_PATHWAY_OWNER_KEYS.has(ownerKey));
}

function buildParserBackedReviewOwnerKeys() {
  const keys = new Set();
  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCKS ?? []) {
    if (!block?.ok || !block.planId || !canParsedRequirementSourceBlockCreateRequiredScheduleRows(block)) {
      continue;
    }

    keys.add(normalizeTransferPlannerOwnerId(block.planId, block.planId, null));
    if (block.pathwayId) {
      keys.add(
        normalizeTransferPlannerOwnerId(
          block.ownerId || buildTransferPlannerOwnerId(block.planId, block.pathwayId),
          block.planId,
          block.pathwayId
        )
      );
    }
    for (const ownerKey of getParserBackedReviewOwnerKeysFromLabels(block)) {
      keys.add(ownerKey);
    }
    for (const ownerKey of getParserBackedReviewOwnerKeysFromSourceText(block)) {
      keys.add(ownerKey);
    }
  }

  return keys;
}

function isStructuralPlaceholderReviewOwner(owner) {
  const pathwayId = String(owner?.pathwayId ?? "").trim();
  const ownerKey = String(owner?.ownerKey ?? "");
  return pathwayId === "four-option" || /:pathway:four-option$/i.test(ownerKey);
}

function isInactivePathwayReviewOwner(owner) {
  if (owner?.ownerType !== "pathway") {
    return false;
  }

  return !ACTIVE_PATHWAY_OWNER_KEYS.has(buildOwnerKey(owner));
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

function getValidationScopedDiscoveryOwners(discoveryReport, fieldName, targetPlanId = null) {
  const owners = discoveryReport?.[fieldName] ?? [];
  if (!targetPlanId) {
    return owners;
  }

  return owners.filter((owner) => owner?.planId === targetPlanId);
}

function getValidationScopedDiscoveryOwnerCount(discoveryReport, targetPlanId = null) {
  return getValidationScopedDiscoveryOwners(discoveryReport, "owners", targetPlanId).length;
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

const GENERATED_PLANS_BY_ID = new Map(
  TRANSFER_PLANNER_GENERATED_MAJOR_PLANS.map((plan) => [plan.id, plan])
);

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

const TACOMA_LEGACY_SOURCE_URL_REPLACEMENTS = new Map([
  [
    "https://www.tacoma.uw.edu/sias-new/socs-new/general-option",
    "https://www.tacoma.uw.edu/sias/socs/general-history-option",
  ],
  [
    "https://www.tacoma.uw.edu/sias-new/socs-new/arts-culture-and-society-history-option",
    "https://www.tacoma.uw.edu/sias/socs/arts-culture-and-society-option",
  ],
  [
    "https://www.tacoma.uw.edu/sias-new/socs-new/ethnic-studies-option",
    "https://www.tacoma.uw.edu/sias/socs/ethnic-studies-option",
  ],
  [
    "https://www.tacoma.uw.edu/sias-new/socs-new/global-history-option",
    "https://www.tacoma.uw.edu/sias/socs/global-history-option",
  ],
  [
    "https://www.tacoma.uw.edu/sias-new/socs-new/labor-and-social-movements-option",
    "https://www.tacoma.uw.edu/sias/socs/labor-and-social-movements-option",
  ],
  [
    "https://www.tacoma.uw.edu/sias-new/socs-new/power-gender-and-identity-option",
    "https://www.tacoma.uw.edu/sias/socs/power-gender-and-identity-option",
  ],
  [
    "https://www.tacoma.uw.edu/sias-new/cac-new/rhetoric-writing-and-social-change-track",
    "https://www.tacoma.uw.edu/sias/cac/rhetoric-writing-and-social-change-track",
  ],
]);

function normalizeRequirementSourceUrlForCoverage(value) {
  try {
    const url = new URL(String(value ?? ""));
    if (url.hostname.endsWith("washington.edu")) {
      url.protocol = "https:";
    }
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/u, "");
    const normalized = url.toString().toLowerCase();
    return TACOMA_LEGACY_SOURCE_URL_REPLACEMENTS.get(normalized) ?? normalized;
  } catch {
    const normalized = String(value ?? "")
      .trim()
      .replace(/[?#].*$/u, "")
      .replace(/\/+$/u, "")
      .toLowerCase();
    return TACOMA_LEGACY_SOURCE_URL_REPLACEMENTS.get(normalized) ?? normalized;
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

function suggestedPrimaryMatchesSpecializedPlanSource(owner) {
  const officialUrl = getSingleSpecializedPlanOfficialUrl(
    GENERATED_PLANS_BY_ID.get(owner?.planId)
  );
  if (!officialUrl) {
    return true;
  }

  const suggestedUrl = normalizePromotionUrlForComparison(owner?.suggestedPrimary?.url);
  return !suggestedUrl || suggestedUrl === officialUrl;
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
  const planTitle = GENERATED_PLANS_BY_ID.get(entry?.planId)?.title ?? entry?.ownerTitle ?? "";
  return String(planTitle)
    .split(/\s+-\s+/u)[0]
    .replace(/\([^)]*\)/g, " ")
    .split(":")[0]
    .trim();
}

const PROMOTION_PLAN_TITLE_ALIASES_BY_PLAN_ID = new Map([
  ["uw-seattle-european-studies", ["International Studies: Europe"]],
]);

function getPromotionPlanComparableTitles(entry) {
  return [
    getPromotionPlanBaseTitle(entry),
    ...(PROMOTION_PLAN_TITLE_ALIASES_BY_PLAN_ID.get(entry?.planId) ?? []),
  ]
    .map(normalizeCatalogCredentialMajorName)
    .filter(Boolean);
}

function extractCatalogCredentialMajorName(label) {
  const match = String(label ?? "").match(/\bmajor\s+in\s+([^:()]+?)(?::|$)/i);
  return match ? match[1].trim() : null;
}

function extractCatalogProgramMajorName(label) {
  const match = String(label ?? "").match(/^Program of Study:\s*Major:\s*(.+)$/i);
  return match ? match[1].trim() : null;
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
  const targetMajors = getPromotionPlanComparableTitles(entry);
  return Boolean(candidateMajor && targetMajors.length && !targetMajors.includes(candidateMajor));
}

function isCatalogProgramPromotionEntry(entry) {
  return /#program-/i.test(String(entry?.url ?? "")) &&
    /^Program of Study:\s*Major:/i.test(String(entry?.label ?? ""));
}

function isCatalogProgramPromotionForDifferentMajor(entry) {
  if (!isCatalogProgramPromotionEntry(entry)) {
    return false;
  }

  const candidateMajor = normalizeCatalogCredentialMajorName(
    extractCatalogProgramMajorName(entry?.label)
  );
  const targetMajors = getPromotionPlanComparableTitles(entry);
  return Boolean(candidateMajor && targetMajors.length && !targetMajors.includes(candidateMajor));
}

function isLikelyCatalogProgramTitleLabel(label) {
  const normalized = normalizeCatalogCredentialMajorName(label);
  if (!normalized) {
    return false;
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  return (
    tokens.length >= 2 &&
    tokens.length <= 6 &&
    !/\b(requirements?|options?|routes?|degree|scoped|section|home|program|credential)\b/i.test(
      String(label ?? "")
    )
  );
}

function isCatalogProgramPagePromotionForDifferentMajor(entry) {
  if (!/\/students\/gencat\/program\//i.test(String(entry?.url ?? ""))) {
    return false;
  }
  if (!isLikelyCatalogProgramTitleLabel(entry?.label)) {
    return false;
  }

  const candidateMajor = normalizeCatalogCredentialMajorName(entry?.label);
  const targetMajors = getPromotionPlanComparableTitles(entry);
  return Boolean(
    candidateMajor &&
      targetMajors.length &&
      !targetMajors.some(
        (targetMajor) =>
          targetMajor === candidateMajor ||
          targetMajor.includes(candidateMajor) ||
          candidateMajor.includes(targetMajor)
      )
  );
}

function isPathwayScopedCatalogCredentialPromotionForBroadMajorOwner(entry) {
  if (entry?.ownerType !== "major" || entry?.pathwayId || !isCatalogCredentialPromotionEntry(entry)) {
    return false;
  }

  const planTitle = GENERATED_PLANS_BY_ID.get(entry?.planId)?.title ?? entry?.ownerTitle ?? "";
  return !String(planTitle ?? "").includes(":") && /\bmajor\s+in\s+[^:()]+:\s*\S/i.test(String(entry?.label ?? ""));
}

function hasDocumentUrlWithAppendedPath(entry) {
  return /\.(?:pdf|docx?)(?:\/|%2f)[^?#]/i.test(String(entry?.url ?? ""));
}

function isMinorCredentialPromotionForMajorOwner(entry) {
  if (entry?.ownerType !== "major" || entry?.pathwayId) {
    return false;
  }
  return /#(?:credential|program)-/i.test(String(entry?.url ?? "")) && /\bminor\b/i.test(String(entry?.label ?? ""));
}

function getBaBsDegreeKind(...values) {
  const searchable = values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  if (/\b(?:b\s*a|ba|bachelor\s+of\s+arts)\b/.test(searchable)) {
    return "ba";
  }
  if (/\b(?:b\s*s|bs|bachelor\s+of\s+science)\b/.test(searchable)) {
    return "bs";
  }
  return null;
}

function pathwayHasExplicitBaBsDegreeRoute(pathway) {
  const text = `${pathway?.id ?? ""} ${pathway?.label ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  return /\b(?:ba|bs|bachelor of arts|bachelor of science)\s+route\b/.test(text) ||
    /\bbachelor of (?:arts|science)\b/.test(text) ||
    /\b(?:ba|bs)\s+option\b/.test(text) ||
    /^(?:ba|bs|bachelor of arts|bachelor of science)$/.test(text.trim());
}

function planHasExplicitBaBsPathwayRoutes(planId) {
  return Boolean(
    GENERATED_PLANS_BY_ID.get(planId)?.pathways?.some(pathwayHasExplicitBaBsDegreeRoute)
  );
}

function isBaBsRoutePromotionForBroadMajorOwner(entry) {
  return (
    entry?.ownerType === "major" &&
    !entry?.pathwayId &&
    planHasExplicitBaBsPathwayRoutes(entry?.planId) &&
    getBaBsDegreeKind(entry?.label, entry?.url) !== null
  );
}

function textHasAcsCertifiedRoute(value) {
  return /\bacs(?:[-_\s]?(?:certified|\d{2,4}))?\b|\bamerican chemical society\b/i.test(String(value ?? ""));
}

function isUnscopedAcsRoutePromotionForBroadMajorOwner(entry) {
  if (entry?.ownerType !== "major" || entry?.pathwayId) {
    return false;
  }

  const sourceText = `${entry?.label ?? ""} ${entry?.url ?? ""}`;
  if (!textHasAcsCertifiedRoute(sourceText)) {
    return false;
  }

  const ownerText = `${entry?.ownerId ?? ""} ${entry?.planId ?? ""} ${entry?.ownerTitle ?? ""}`;
  return !textHasAcsCertifiedRoute(ownerText);
}

function isSkipNavigationPromotionEntry(entry) {
  const text = `${entry?.label ?? ""} ${entry?.url ?? ""}`.toLowerCase();
  return /\bskip\s+to\s+(?:main\s+)?content\b/.test(text) || /#content(?:$|[?&])/i.test(String(entry?.url ?? ""));
}

function isClearlySupportOnlyPromotionEntry(entry) {
  return CLEAR_SUPPORT_ONLY_PROMOTION_PATTERN.test(`${entry?.label ?? ""} ${entry?.url ?? ""}`);
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

function isTacomaGlobalStudiesLeakedPromotionEntry(entry) {
  return (
    entry?.campusId === "uw-tacoma" &&
    entry?.planId !== "uw-tacoma-global-studies" &&
    normalizeTransferPlannerPathwayId(entry?.planId, entry?.pathwayId ?? null) ===
      "global-studies-concentration"
  );
}

function isSeattleJsisAsiaConcentrationLeakedPromotionEntry(entry) {
  const pathwayId = normalizeTransferPlannerPathwayId(entry?.planId, entry?.pathwayId ?? null);
  if (
    entry?.campusId !== "uw-seattle" ||
    entry?.planId === "uw-seattle-asian-studies" ||
    !/^(?:china|general|japan|korea|south-asia|southeast-asia)-concentration$/i.test(
      pathwayId ?? ""
    )
  ) {
    return false;
  }

  const text = `${entry?.label ?? ""} ${entry?.url ?? ""} ${entry?.ownerTitle ?? ""}`;
  return /\/programs\/undergraduate\/asia-studies\//i.test(text) || /\bAsian Studies\b/i.test(text);
}

function isManualOverrideSkippedPromotionEntry(entry) {
  return shouldSkipTransferPlannerAutoPromotedPrimarySource(
    entry?.planId,
    entry?.pathwayId ?? null,
    entry?.url
  );
}

function isUnsafeAutomaticPromotionEntry(entry) {
  return isClearlySupportOnlyPromotionEntry(entry) ||
    isMinorCredentialPromotionForMajorOwner(entry) ||
    isBaBsRoutePromotionForBroadMajorOwner(entry) ||
    isUnscopedAcsRoutePromotionForBroadMajorOwner(entry) ||
    isCatalogCredentialPromotionForDifferentMajor(entry) ||
    isCatalogProgramPromotionForDifferentMajor(entry) ||
    isCatalogProgramPagePromotionForDifferentMajor(entry) ||
    isPathwayScopedCatalogCredentialPromotionForBroadMajorOwner(entry) ||
    isSuspiciousStructuralPathwayPromotionEntry(entry) ||
    isTacomaGlobalStudiesLeakedPromotionEntry(entry) ||
    isSeattleJsisAsiaConcentrationLeakedPromotionEntry(entry) ||
    isSkipNavigationPromotionEntry(entry) ||
    isManualOverrideSkippedPromotionEntry(entry) ||
    hasDocumentUrlWithAppendedPath(entry);
}

function buildPromotionEntryCandidateFromOwner(owner) {
  const pathwayId = owner?.pathwayId ?? null;
  return {
    ownerType: owner?.ownerType,
    ownerId: buildOwnerId(owner?.planId, pathwayId),
    planId: owner?.planId,
    pathwayId,
    ownerTitle: owner?.title,
    campusId: owner?.campusId,
    url: owner?.suggestedPrimary?.url,
    label:
      owner?.suggestedPrimary?.label ||
      owner?.suggestedPrimary?.anchorText ||
      owner?.suggestedPrimary?.pageTitle ||
      `${owner?.title ?? ""} requirements`,
  };
}

function suggestedPrimaryIsSafeForAutomaticPromotion(owner) {
  return !isUnsafeAutomaticPromotionEntry(buildPromotionEntryCandidateFromOwner(owner));
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

function getMissingPrimaryAutoPromotionBlockReason(owner) {
  if (!isSchedulablePrimarySuggestion(owner?.suggestedPrimary)) {
    return "suggested primary is not a high-confidence schedulable primary";
  }

  if (!suggestedPrimaryMatchesSpecializedPlanSource(owner)) {
    return "suggested primary does not match the specialized plan source";
  }

  if (!suggestedPrimaryIsSafeForAutomaticPromotion(owner)) {
    return "suggested primary is catalog-scoped to a different major or child option";
  }

  return null;
}

function getEligibleMissingPrimaryAutoPromotionOwners(
  discoveryReport,
  reviewQueue,
  targetPlanId = null
) {
  const reviewOwnerKeys = buildReviewOwnerKeySet(reviewQueue);
  return getValidationScopedDiscoveryOwners(discoveryReport, "owners", targetPlanId)
    .filter((owner) => !owner.existingPrimaryUrl)
    .filter((owner) => !hasStudentRuntimeAliasCoverage(owner))
    .filter((owner) => isSchedulablePrimarySuggestion(owner?.suggestedPrimary))
    .filter((owner) => suggestedPrimaryMatchesSpecializedPlanSource(owner))
    .filter((owner) => suggestedPrimaryIsSafeForAutomaticPromotion(owner))
    .filter((owner) => !reviewOwnerKeys.has(buildOwnerKey(owner)))
    .map((owner) => ({
      ownerId: buildOwnerId(owner.planId, owner.pathwayId ?? null),
      ownerKey: buildOwnerKey(owner),
      title: owner.title,
      promotedUrl: owner.suggestedPrimary.url,
    }));
}

function getBlockedMissingPrimaryAutoPromotionOwners(
  discoveryReport,
  reviewQueue,
  targetPlanId = null
) {
  const reviewOwnerKeys = buildReviewOwnerKeySet(reviewQueue);
  return getValidationScopedDiscoveryOwners(discoveryReport, "owners", targetPlanId)
    .filter((owner) => !owner.existingPrimaryUrl)
    .filter((owner) => !hasStudentRuntimeAliasCoverage(owner))
    .filter((owner) => !reviewOwnerKeys.has(buildOwnerKey(owner)))
    .map((owner) => ({
      ownerId: buildOwnerId(owner.planId, owner.pathwayId ?? null),
      ownerKey: buildOwnerKey(owner),
      title: owner.title,
      promotedUrl: owner.suggestedPrimary?.url ?? null,
      blockReason: getMissingPrimaryAutoPromotionBlockReason(owner),
    }))
    .filter((owner) => owner.blockReason);
}

function getEligibleWeakExistingReplacementOwners(
  discoveryReport,
  reviewQueue = null,
  targetPlanId = null
) {
  const reviewOwnerKeys = reviewQueue ? buildReviewOwnerKeySet(reviewQueue) : new Set();
  return getValidationScopedDiscoveryOwners(discoveryReport, "weakExistingOwners", targetPlanId)
    .filter((owner) => owner?.suggestedAction === "replace-existing-primary")
    .filter((owner) => !hasStudentRuntimeAliasCoverage(owner))
    .filter((owner) => isSchedulablePrimarySuggestion(owner?.suggestedPrimary))
    .filter((owner) => suggestedPrimaryMatchesSpecializedPlanSource(owner))
    .filter((owner) => suggestedPrimaryIsSafeForAutomaticPromotion(owner))
    .filter((owner) => {
      const ownerKey = buildOwnerKey(owner);
      return !reviewOwnerKeys.has(ownerKey) || currentPrimaryCannotCreateSchedulableRows(owner);
    })
    .map((owner) => ({
      ownerId: buildOwnerId(owner.planId, owner.pathwayId ?? null),
      ownerKey: buildOwnerKey(owner),
      title: owner.title,
      promotedUrl: owner.suggestedPrimary.url,
    }));

}

function getEligibleAutoPromotionOwners(discoveryReport, reviewQueue, targetPlanId = null) {
  return uniqueByOwnerId([
    ...getEligibleMissingPrimaryAutoPromotionOwners(discoveryReport, reviewQueue, targetPlanId),
    ...getEligibleWeakExistingReplacementOwners(discoveryReport, reviewQueue, targetPlanId),
  ]).sort((left, right) =>
    left.ownerId.localeCompare(right.ownerId)
  );
}

function uniqueByOwnerId(entries) {
  return Array.from(new Map((entries ?? []).map((entry) => [entry.ownerId, entry])).values());
}

function buildPrimaryManifestOwnerMap() {
  return new Map(
    TRANSFER_PLANNER_MANIFEST_REGISTRY.filter(
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
    TRANSFER_PLANNER_MANIFEST_REGISTRY.filter(
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
  return `${entry.ownerId}::${normalizeRequirementSourceUrlForCoverage(entry.url)}`;
}

function buildReportParseKeys(owner) {
  return uniqueSorted(
    [owner.primarySourceUrl, owner.sourceUrl, ...(owner.coveredSourceUrls ?? [])].map((sourceUrl) =>
      sourceUrl ? `${owner.ownerId}::${normalizeRequirementSourceUrlForCoverage(sourceUrl)}` : null
    )
  );
}

function buildManifestPlanSourceKey(entry) {
  return `${entry.planId ?? entry.ownerId}::${normalizeRequirementSourceUrlForCoverage(entry.url)}`;
}

function summarizeParseableRequirementSourceEntry(entry) {
  return {
    ownerId: entry.ownerId,
    planId: entry.planId ?? null,
    pathwayId: entry.pathwayId ?? null,
    ownerType: entry.ownerType ?? null,
    url: entry.url,
    role: entry.role ?? null,
    parserType: entry.parserType ?? null,
    isPrimaryDegreeRequirementsLink: Boolean(entry.isPrimaryDegreeRequirementsLink),
  };
}

function buildReportPlanSourceKeys(owner) {
  const planId = owner.planId ?? owner.ownerId?.split(":pathway:")[0] ?? owner.ownerId;
  return uniqueSorted(
    [owner.primarySourceUrl, owner.sourceUrl, ...(owner.coveredSourceUrls ?? [])].map((sourceUrl) =>
      planId && sourceUrl
        ? `${planId}::${normalizeRequirementSourceUrlForCoverage(sourceUrl)}`
        : null
    )
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
  ensurePlannerTmpLayout();
  writePlannerJsonReport(OUTPUT_JSON_PATH, report);

  const lines = [
    "# Transfer Planner Source Pipeline Validation",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Outcome: ${report.outcome}`,
    `- Passed checks: ${report.passedCount}`,
    `- Failed checks: ${report.failedCount}`,
    `- Validation target: ${report.metrics.validationTargetPlanId ?? "all owners"}`,
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

  writePlannerMarkdownReport(OUTPUT_MD_PATH, lines);
}

async function main() {
  const requestedTargetPlanIds = parseTargetPlanIdsFromArgs();
  if (requestedTargetPlanIds.length > 1) {
    throw new Error(
      `Source pipeline validation supports one target plan at a time; received ${requestedTargetPlanIds.join(", ")}.`
    );
  }
  const validationTargetPlanId = requestedTargetPlanIds[0] ?? null;
  const discoveryReport = readJson(DISCOVERY_REPORT_PATH, "primary-source discovery report");
  const reviewQueue = readJson(REVIEW_QUEUE_REPORT_PATH, "primary-source review queue");
  const promotionReport = readJson(PROMOTION_REPORT_PATH, "primary-source promotion report");
  const sourceGapReport = readJson(GAP_REPORT_PATH, "source-gap report");
  const requirementParseReport = readJson(
    REQUIREMENT_PARSE_REPORT_PATH,
    "requirement source parse report"
  );
  const sourceFingerprintReport = readJson(
    FINGERPRINT_REPORT_PATH,
    "source fingerprint report"
  );

  const eligibleAutoPromotionOwners = getEligibleAutoPromotionOwners(
    discoveryReport,
    reviewQueue,
    validationTargetPlanId
  );
  const eligibleMissingPrimaryAutoPromotionOwners = getEligibleMissingPrimaryAutoPromotionOwners(
    discoveryReport,
    reviewQueue,
    validationTargetPlanId
  );
  const blockedMissingPrimaryAutoPromotionOwners = getBlockedMissingPrimaryAutoPromotionOwners(
    discoveryReport,
    reviewQueue,
    validationTargetPlanId
  );
  const eligibleWeakExistingReplacementOwners = getEligibleWeakExistingReplacementOwners(
    discoveryReport,
    reviewQueue,
    validationTargetPlanId
  );
  const eligibleAutoPromotionOwnerIds = new Set(
    eligibleAutoPromotionOwners.map((owner) => owner.ownerId)
  );
  const eligibleAutoPromotionOwnerKeys = new Set(
    eligibleAutoPromotionOwners.map((owner) => owner.ownerKey)
  );
  const reviewOwnerKeys = buildReviewOwnerKeySet(reviewQueue);
  const targetPlanId = validationTargetPlanId;
  const validationScopedDiscoveryOwnerKeys = new Set(
    getValidationScopedDiscoveryOwners(discoveryReport, "owners", targetPlanId).map((owner) =>
      buildOwnerKey(owner)
    )
  );
  const parserBackedReviewOwnerKeys = buildParserBackedReviewOwnerKeys();
  const validationScopedSourceGapDiscoveryOwnerKeys = new Set(
    getValidationScopedDiscoveryOwners(discoveryReport, "owners", targetPlanId)
      .filter((owner) => !parserBackedReviewOwnerKeys.has(buildOwnerKey(owner)))
      .filter((owner) => !isStructuralPlaceholderReviewOwner(owner))
      .filter((owner) => !isInactivePathwayReviewOwner(owner))
      .filter((owner) => !hasStudentRuntimeAliasCoverage(owner))
      .map((owner) => buildOwnerKey(owner))
  );
  const validationScopedReviewEntries = getValidationScopedReviewQueueEntries(
    reviewQueue,
    targetPlanId
  );
  const validationScopedMissingPrimaryReviewOwnerKeys = new Set(
    validationScopedReviewEntries
      .filter((entry) => validationScopedDiscoveryOwnerKeys.has(buildOwnerKey(entry)))
      .filter((entry) => !parserBackedReviewOwnerKeys.has(buildOwnerKey(entry)))
      .filter((entry) => !isStructuralPlaceholderReviewOwner(entry))
      .filter((entry) => !isInactivePathwayReviewOwner(entry))
      .filter((entry) => !hasStudentRuntimeAliasCoverage(entry))
      .map((entry) => buildOwnerKey(entry))
  );
  const validationScopedReviewOwnerCount = validationScopedReviewEntries.length;
  const validationScopedSourceGapEntries = targetPlanId
    ? (sourceGapReport.entries ?? []).filter((entry) => entry?.planId === targetPlanId)
    : (sourceGapReport.entries ?? []);
  const sourceGapOwnerKeys = new Set(
    validationScopedSourceGapEntries.map((entry) => buildOwnerKey(entry))
  );
  const promotedOwnerIds = new Set(
    (TRANSFER_PLANNER_PRIMARY_PROMOTIONS ?? []).map((entry) => entry.ownerId)
  );
  const promotedOwnerKeys = new Set(
    (TRANSFER_PLANNER_PRIMARY_PROMOTIONS ?? []).map((entry) => entry.ownerKey)
  );
  const primaryManifestOwners = buildPrimaryManifestOwnerMap();
  const parseablePrimaryManifestOwners = buildParseablePrimaryManifestOwnerMap();
  const parseableRequirementSourceEntries = buildParseableRequirementSourceManifestEntries();
  const parsedOwnerIds = new Set((requirementParseReport.owners ?? []).map((owner) => owner.ownerId));
  const parsedRequirementSourceKeys = new Set(
    (requirementParseReport.owners ?? []).flatMap(buildReportParseKeys)
  );
  const parsedRequirementPlanSourceKeys = new Set(
    (requirementParseReport.owners ?? []).flatMap(buildReportPlanSourceKeys)
  );
  const generatedParsedRequirementSourceKeys = new Set(
    (TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCKS ?? []).flatMap(buildReportParseKeys)
  );
  const generatedParsedRequirementPlanSourceKeys = new Set(
    (TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCKS ?? []).flatMap(buildReportPlanSourceKeys)
  );
  const requirementFingerprintOwnerIds = new Set(
    (TRANSFER_PLANNER_REQUIREMENT_FINGERPRINTS ?? []).map((entry) => entry.ownerId)
  );
  const promotedSourceEntries = TRANSFER_PLANNER_PRIMARY_PROMOTIONS ?? [];
  const missingPromotedParsedOwners = promotedSourceEntries.filter(
    (entry) => !parsedOwnerIds.has(entry.ownerId)
  );
  const missingPromotedFingerprintOwners = promotedSourceEntries.filter(
    (entry) => !requirementFingerprintOwnerIds.has(entry.ownerId)
  );
  const fingerprintOwnerDiff = compareSets([...parsedOwnerIds], [...requirementFingerprintOwnerIds]);
  let registryParserAlignmentRepair = {
    needed: false,
    targetPlanIds: [],
    missingCurrentSourceCoverage: [],
    missingGeneratedSourceCoverage: [],
  };
  const promotedOwnerCoverageRepair = {
    needed: missingPromotedParsedOwners.length > 0 || missingPromotedFingerprintOwners.length > 0,
    targetPlanIds: uniqueSorted(
      [...missingPromotedParsedOwners, ...missingPromotedFingerprintOwners].map(
        (entry) => entry.planId ?? getPlanIdFromOwnerId(entry.ownerId)
      )
    ),
    missingParsedOwnerIds: missingPromotedParsedOwners.map((entry) => entry.ownerId).sort(),
    missingFingerprintOwnerIds: missingPromotedFingerprintOwners
      .map((entry) => entry.ownerId)
      .sort(),
  };
  const fingerprintAlignmentRepair = {
    needed:
      sourceFingerprintReport.totalRequirementSourceFingerprints !== requirementParseReport.totalOwners ||
      fingerprintOwnerDiff.leftOnly.length > 0 ||
      fingerprintOwnerDiff.rightOnly.length > 0,
    parsedOnlyOwnerIds: fingerprintOwnerDiff.leftOnly,
    fingerprintOnlyOwnerIds: fingerprintOwnerDiff.rightOnly,
  };

  const checks = [
    runCheck(
      "discovery-partition",
      "Missing-primary discovery owners partition cleanly into eligible, review, and blocked buckets",
      () => {
        const scopedEligibleMissingPrimaryAutoPromotionOwners =
          eligibleMissingPrimaryAutoPromotionOwners.filter((owner) =>
            validationScopedSourceGapDiscoveryOwnerKeys.has(buildOwnerKey(owner))
          );
        const scopedBlockedMissingPrimaryAutoPromotionOwners =
          blockedMissingPrimaryAutoPromotionOwners.filter((owner) =>
            validationScopedSourceGapDiscoveryOwnerKeys.has(buildOwnerKey(owner))
          );
        assert.equal(
          validationScopedSourceGapDiscoveryOwnerKeys.size,
          scopedEligibleMissingPrimaryAutoPromotionOwners.length +
            validationScopedMissingPrimaryReviewOwnerKeys.size +
            scopedBlockedMissingPrimaryAutoPromotionOwners.length,
          "Discovery owner count should equal eligible auto-promotions plus review-queue owners plus explicitly blocked auto-promotions."
        );
        return [
          `Discovery owners: ${validationScopedSourceGapDiscoveryOwnerKeys.size}`,
          `Eligible missing-primary auto-promotions: ${scopedEligibleMissingPrimaryAutoPromotionOwners.length}`,
          `Blocked missing-primary auto-promotions: ${scopedBlockedMissingPrimaryAutoPromotionOwners.length}`,
          `Eligible weak-existing replacements: ${eligibleWeakExistingReplacementOwners.length}`,
          `Review-queue owners: ${validationScopedReviewOwnerCount}`,
          `Missing-primary review owners: ${validationScopedMissingPrimaryReviewOwnerKeys.size}`,
        ];
      }
    ),
    runCheck(
      "promotion-report-matches-generated-registry",
      "Generated promotion registry matches the promotion report",
      () => {
        assert.equal(
          promotionReport.totalPromotions,
          TRANSFER_PLANNER_PRIMARY_PROMOTIONS.length,
          "Promotion report count should match the generated promotion registry."
        );
        return `Promoted owners: ${promotionReport.totalPromotions}`;
      }
    ),
    runCheck(
      "eligible-discoveries-promoted",
      "Eligible high-confidence discoveries are promoted unless they remain in the review queue",
      () => {
        if (targetPlanId) {
          return `Skipped canonical promotion check for requested target plan: ${targetPlanId}`;
        }

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
      "Missing-primary review queue and source-gap report point at the same unresolved owners",
      () => {
        const setDiff = compareSets(validationScopedMissingPrimaryReviewOwnerKeys, sourceGapOwnerKeys);
        assert.deepEqual(
          setDiff,
          { leftOnly: [], rightOnly: [] },
          `Review/source-gap mismatch. review-only=${setDiff.leftOnly.join(", ")} source-gap-only=${setDiff.rightOnly.join(", ")}`
        );
        return `Shared unresolved owners: ${sourceGapOwnerKeys.size}`;
      }
    ),
    runCheck(
      "promotions-materialized-in-canonical-registry",
      "Auto-promoted owners are materialized in the canonical primary-source registry",
      () => {
        const missingCanonicalPrimaryEntries = (TRANSFER_PLANNER_PRIMARY_PROMOTIONS ?? []).filter(
          (entry) => !primaryManifestOwners.has(entry.ownerId)
        );
        const promotionReviewIntersection = uniqueSorted(
          (TRANSFER_PLANNER_PRIMARY_PROMOTIONS ?? [])
            .filter((entry) => {
              if (!reviewOwnerKeys.has(entry.ownerKey)) {
                return false;
              }
              const discoveryOwner = [
                ...(discoveryReport.weakExistingOwners ?? []),
                ...(discoveryReport.owners ?? []),
              ].find((owner) => buildOwnerKey(owner) === entry.ownerKey);
              return !currentPrimaryCannotCreateSchedulableRows(discoveryOwner);
            })
            .map((entry) => entry.ownerId)
        );
        const promotionGapIntersection = uniqueSorted(
          (TRANSFER_PLANNER_PRIMARY_PROMOTIONS ?? [])
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
          `Promoted owners: ${TRANSFER_PLANNER_PRIMARY_PROMOTIONS.length}`,
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
        const canonicalParseableSourceKeyCount = new Set(parseableRequirementSourceKeys).size;
        const parserOutputDiff = compareSets(
          parseableRequirementSourceKeys,
          parsedRequirementSourceKeys
        );
        const missingCurrentSourceCoverage = parseableRequirementSourceEntries.filter(
          (entry) =>
            !parsedRequirementSourceKeys.has(buildManifestParseKey(entry)) &&
            !parsedRequirementPlanSourceKeys.has(buildManifestPlanSourceKey(entry))
        );
        const missingGeneratedSourceCoverage = parseableRequirementSourceEntries.filter(
          (entry) =>
            !generatedParsedRequirementSourceKeys.has(buildManifestParseKey(entry)) &&
            !generatedParsedRequirementPlanSourceKeys.has(buildManifestPlanSourceKey(entry))
        );
        const missingCoverageEntries = [
          ...missingCurrentSourceCoverage,
          ...missingGeneratedSourceCoverage,
        ];
        registryParserAlignmentRepair = {
          needed: missingCoverageEntries.length > 0,
          targetPlanIds: uniqueSorted(missingCoverageEntries.map((entry) => entry.planId)),
          missingCurrentSourceCoverage: missingCurrentSourceCoverage.map(
            summarizeParseableRequirementSourceEntry
          ),
          missingGeneratedSourceCoverage: missingGeneratedSourceCoverage.map(
            summarizeParseableRequirementSourceEntry
          ),
        };
        assert.equal(
          canonicalParseableSourceKeyCount - missingCurrentSourceCoverage.length,
          canonicalParseableSourceKeyCount,
          `Parse report should cover every canonical parseable source owner/url, allowing canonicalized duplicate owner/source blocks: ${missingCurrentSourceCoverage
            .map(buildManifestParseKey)
            .join(", ")}`
        );
        assert.deepEqual(
          missingCurrentSourceCoverage.map(buildManifestParseKey),
          [],
          `Current parseable registry source(s) missing parser coverage: ${missingCurrentSourceCoverage
            .map(buildManifestParseKey)
            .join(", ")}`
        );
        assert.deepEqual(
          missingGeneratedSourceCoverage.map(buildManifestParseKey),
          [],
          `Generated parsed-source registry missing parser coverage: ${missingGeneratedSourceCoverage
            .map(buildManifestParseKey)
            .join(", ")}`
        );
        return [
          `Canonical parseable primary owners: ${parseablePrimaryManifestOwners.size}`,
          `Parseable requirement sources: ${parseableRequirementSourceEntries.length}`,
          `Canonical parseable owner/source keys: ${canonicalParseableSourceKeyCount}`,
          `Parsed source blocks: ${requirementParseReport.totalOwners}`,
          `Generated parsed source blocks: ${TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCKS.length}`,
          `Exact parser/registry source delta: registry-only=${parserOutputDiff.leftOnly.length}, parsed-only=${parserOutputDiff.rightOnly.length}`,
        ];
      }
    ),
    runCheck(
      "promoted-owners-parsed-and-fingerprinted",
      "Promoted owners appear in parser output and requirement fingerprints",
      () => {
        assert.deepEqual(
          missingPromotedParsedOwners.map((entry) => entry.ownerId),
          [],
          `Promoted owners missing parsed blocks: ${missingPromotedParsedOwners
            .map((entry) => entry.ownerId)
            .slice(0, 12)
            .join(", ")}`
        );
        assert.deepEqual(
          missingPromotedFingerprintOwners.map((entry) => entry.ownerId),
          [],
          `Promoted owners missing requirement fingerprints: ${missingPromotedFingerprintOwners
            .map((entry) => entry.ownerId)
            .slice(0, 12)
            .join(", ")}`
        );
        return `Promoted owners verified end-to-end: ${TRANSFER_PLANNER_PRIMARY_PROMOTIONS.length}`;
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
      validationTargetPlanId,
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
    autoRepair: {
      registryParserAlignment: registryParserAlignmentRepair,
      promotedOwnerCoverage: promotedOwnerCoverageRepair,
      fingerprintAlignment: fingerprintAlignmentRepair,
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
