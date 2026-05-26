const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  SOURCE_ROOT,
  ensurePlannerTmpLayout,
  getPlannerTmpPath,
  hasArg,
  runCommand,
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

const REPO_ROOT = SOURCE_ROOT;
ensurePlannerTmpLayout();
const LINK_SNAPSHOT_PATH = getPlannerTmpPath("transfer-planner-source-link-snapshot.json");
const REQUIREMENT_PARSE_REPORT_PATH = getPlannerTmpPath("transfer-planner-requirement-source-parse-report.json");
const OUTPUT_JSON_PATH = getPlannerTmpPath("transfer-planner-source-fingerprints.json");
const OUTPUT_MD_PATH = getPlannerTmpPath("transfer-planner-source-fingerprints.md");
const CHANGE_CLASSIFICATION_JSON_PATH = getPlannerTmpPath("transfer-planner-source-change-classification.json");
const CHANGE_CLASSIFICATION_MD_PATH = getPlannerTmpPath("transfer-planner-source-change-classification.md");
const GENERATED_OUTPUT_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "source-fingerprints.generated.ts"
);
const {
  normalizeTransferPlannerOwnerId,
  normalizeTransferPlannerPathwayId,
} = require("../../constants/transfer-planner-source/pathway-id-normalization");
const {
  labelMentionsDifferentTransferPlannerMajor,
  normalizeTransferPlannerText,
} = require("../../constants/transfer-planner-source/pathway-title-normalization");

function stableForHash(value) {
  if (Array.isArray(value)) {
    return value.map(stableForHash);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableForHash(value[key])])
    );
  }

  return value;
}

function sha256Json(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableForHash(value)))
    .digest("hex");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label} at ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadPreviousFingerprints() {
  if (!fs.existsSync(GENERATED_OUTPUT_PATH)) {
    return {
      sourceFingerprints: [],
      requirementSourceFingerprints: [],
    };
  }

  try {
    delete require.cache[require.resolve(GENERATED_OUTPUT_PATH)];
    const loaded = require(GENERATED_OUTPUT_PATH);
    return {
      sourceFingerprints: loaded.TRANSFER_PLANNER_FINGERPRINTS ?? [],
      requirementSourceFingerprints:
        loaded.TRANSFER_PLANNER_REQUIREMENT_FINGERPRINTS ?? [],
    };
  } catch (error) {
    console.log(`Could not load previous source fingerprints: ${error.message}`);
    return {
      sourceFingerprints: [],
      requirementSourceFingerprints: [],
    };
  }
}

function buildSourceFingerprintEntry(source, titlesByPlanId = new Map()) {
  const fingerprintInput = {
    ok: source.ok,
    status: source.status,
    finalUrl: source.finalUrl,
    contentType: source.contentType,
    contentLength: source.contentLength,
    etag: source.etag,
    lastModified: source.lastModified,
    bodyHash: source.bodyHash,
    title: source.title,
    error: source.error,
    fetchMode: source.fetchMode,
  };

  return {
    url: source.url,
    finalUrl: source.finalUrl ?? null,
    labels: source.labels ?? [],
    ownerIds: normalizeAndFilterSourceOwnerIds(source.ownerIds, source, titlesByPlanId),
    kinds: source.kinds ?? [],
    ok: Boolean(source.ok),
    status: source.status ?? null,
    contentType: source.contentType ?? null,
    contentLength: source.contentLength ?? null,
    etag: source.etag ?? null,
    lastModified: source.lastModified ?? null,
    title: source.title ?? null,
    fetchMode: source.fetchMode ?? "unknown",
    resourceFingerprint: sha256Json(fingerprintInput),
  };
}

function normalizeSourceUrlKey(value) {
  return String(value ?? "").trim();
}

function normalizeSourceOwnerId(value) {
  const rawOwnerId = String(value ?? "").trim();
  if (!rawOwnerId) {
    return "";
  }

  const sourceOwnerKeyMatch = rawOwnerId.match(/^(.+?)::(.+)$/);
  if (sourceOwnerKeyMatch) {
    const [, planId, pathwayId] = sourceOwnerKeyMatch;
    const normalizedPathwayId = normalizeTransferPlannerPathwayId(planId, pathwayId);
    return normalizeTransferPlannerOwnerId("", planId, normalizedPathwayId);
  }

  return normalizeTransferPlannerOwnerId(rawOwnerId);
}

function normalizeSourceOwnerIds(values) {
  return uniqueSorted((values ?? []).map(normalizeSourceOwnerId).filter(Boolean));
}

function getPlanIdFromOwnerId(ownerId) {
  const normalizedOwnerId = String(ownerId ?? "").trim();
  const pathwaySeparator = ":pathway:";
  const pathwayIndex = normalizedOwnerId.indexOf(pathwaySeparator);
  return pathwayIndex === -1 ? normalizedOwnerId : normalizedOwnerId.slice(0, pathwayIndex);
}

function getPathwayIdFromOwnerId(ownerId) {
  const normalizedOwnerId = String(ownerId ?? "").trim();
  const pathwaySeparator = ":pathway:";
  const pathwayIndex = normalizedOwnerId.indexOf(pathwaySeparator);
  return pathwayIndex === -1
    ? null
    : normalizedOwnerId.slice(pathwayIndex + pathwaySeparator.length);
}

function getBaBsDegreeKind(value) {
  const text = normalizeTransferPlannerText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  if (/\b(?:b\s*a|ba|bachelor\s+of\s+arts)\b/.test(text)) return "ba";
  if (/\b(?:b\s*s|bs|bachelor\s+of\s+science)\b/.test(text)) return "bs";
  return null;
}

function buildSourceOwnerIdentityText(source) {
  return [
    ...(source?.labels ?? []),
    source?.title,
    source?.url,
    source?.finalUrl,
  ]
    .filter(Boolean)
    .join(" ");
}

function sourceOwnerIdConflictsWithSource(ownerId, source, titlesByPlanId) {
  const planId = getPlanIdFromOwnerId(ownerId);
  if (!planId) {
    return false;
  }

  const identityCandidates = [
    ...(source?.labels ?? []),
    source?.title,
  ].filter(Boolean);
  if (
    identityCandidates.some((candidate) =>
      labelMentionsDifferentTransferPlannerMajor(planId, candidate, titlesByPlanId)
    )
  ) {
    return true;
  }

  const pathwayId = getPathwayIdFromOwnerId(ownerId);
  const ownerDegreeKind = getBaBsDegreeKind(`${ownerId} ${pathwayId ?? ""}`);
  const sourceDegreeKind = getBaBsDegreeKind(buildSourceOwnerIdentityText(source));
  return Boolean(ownerDegreeKind && sourceDegreeKind && ownerDegreeKind !== sourceDegreeKind);
}

function normalizeAndFilterSourceOwnerIds(values, source, titlesByPlanId = new Map()) {
  return uniqueSorted(
    normalizeSourceOwnerIds(values).filter(
      (ownerId) => !sourceOwnerIdConflictsWithSource(ownerId, source, titlesByPlanId)
    )
  );
}

function buildRequirementReportTitlesByPlanId(requirementOwners) {
  const titlesByPlanId = new Map();

  for (const owner of requirementOwners ?? []) {
    const planId = String(owner?.planId ?? getPlanIdFromOwnerId(owner?.ownerId)).trim();
    const ownerTitle = String(owner?.ownerTitle ?? "").trim();
    if (!planId || !ownerTitle) {
      continue;
    }

    const existing = titlesByPlanId.get(planId);
    const ownerHasPathway = Boolean(String(owner?.pathwayId ?? "").trim());
    if (!existing || !ownerHasPathway) {
      titlesByPlanId.set(planId, ownerHasPathway ? ownerTitle.replace(/\s+-\s+.+$/, "") : ownerTitle);
    }
  }

  return titlesByPlanId;
}

function mergeUniqueStrings(existing, values) {
  const merged = new Set(existing ?? []);
  for (const value of values ?? []) {
    if (value) {
      merged.add(value);
    }
  }
  return [...merged].sort();
}

function uniqueSorted(values) {
  return Array.from(new Set((values ?? []).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function uniqueInOrder(values) {
  const seen = new Set();
  const result = [];
  for (const value of values ?? []) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function normalizeCourseCodes(values) {
  return uniqueSorted((values ?? []).map((value) => String(value ?? "").trim()).filter(Boolean));
}

function diffValues(previousValues, currentValues) {
  const previousSet = new Set(previousValues ?? []);
  const currentSet = new Set(currentValues ?? []);
  return {
    added: uniqueSorted([...currentSet].filter((value) => !previousSet.has(value))),
    removed: uniqueSorted([...previousSet].filter((value) => !currentSet.has(value))),
  };
}

function readRequirementSnapshotHash(owner) {
  if (!owner.snapshotPath) {
    return null;
  }

  const snapshotPath = path.isAbsolute(owner.snapshotPath)
    ? owner.snapshotPath
    : path.resolve(REPO_ROOT, owner.snapshotPath);

  if (!fs.existsSync(snapshotPath)) {
    return null;
  }

  return sha256Text(fs.readFileSync(snapshotPath, "utf8"));
}

function buildRequirementBackedSourceFingerprintEntry(owner, ownerIds = normalizeSourceOwnerIds([owner.ownerId])) {
  const snapshotHash = readRequirementSnapshotHash(owner);
  const fingerprintInput = {
    ok: owner.ok,
    finalUrl: owner.sourceUrl,
    contentType: "requirement-source-snapshot",
    contentLength: null,
    etag: null,
    lastModified: null,
    bodyHash: snapshotHash,
    title: owner.extractedTitle,
    error: owner.error,
    fetchMode: "requirement-snapshot",
  };

  return {
    url: owner.sourceUrl,
    finalUrl: owner.sourceUrl,
    labels: [owner.sourceLabel].filter(Boolean),
    ownerIds,
    kinds: [owner.pathwayId ? "pathway" : "major"],
    ok: Boolean(owner.ok),
    status: null,
    contentType: "requirement-source-snapshot",
    contentLength: null,
    etag: null,
    lastModified: null,
    title: owner.extractedTitle ?? null,
    fetchMode: "requirement-snapshot",
    resourceFingerprint: sha256Json(fingerprintInput),
  };
}

function addRequirementBackedSourceFingerprints(sourceFingerprints, requirementOwners, titlesByPlanId = new Map()) {
  const entries = [...sourceFingerprints];
  const entryByUrl = new Map();

  function addLookup(entry) {
    for (const lookupUrl of [entry.url, entry.finalUrl]) {
      const normalized = normalizeSourceUrlKey(lookupUrl);
      if (normalized && !entryByUrl.has(normalized)) {
        entryByUrl.set(normalized, entry);
      }
    }
  }

  for (const entry of entries) {
    addLookup(entry);
  }

  for (const owner of requirementOwners ?? []) {
    const normalizedSourceUrl = normalizeSourceUrlKey(owner.sourceUrl);
    if (!normalizedSourceUrl) {
      continue;
    }
    const normalizedOwnerIds = normalizeAndFilterSourceOwnerIds(
      [owner.ownerId],
      {
        url: owner.sourceUrl,
        finalUrl: owner.sourceUrl,
        labels: [owner.sourceLabel].filter(Boolean),
        title: owner.extractedTitle,
      },
      titlesByPlanId
    );
    if (!normalizedOwnerIds.length) {
      continue;
    }

    let entry = entryByUrl.get(normalizedSourceUrl);
    if (!entry) {
      entry = buildRequirementBackedSourceFingerprintEntry(owner, normalizedOwnerIds);
      entries.push(entry);
      addLookup(entry);
    }

    entry.labels = mergeUniqueStrings(entry.labels, [owner.sourceLabel]);
    entry.ownerIds = mergeUniqueStrings(entry.ownerIds, normalizedOwnerIds);
    entry.kinds = mergeUniqueStrings(entry.kinds, [owner.pathwayId ? "pathway" : "major"]);
  }

  return entries.sort((left, right) => left.url.localeCompare(right.url));
}

function buildRequirementFingerprintEntry(owner) {
  const parsedUwCourseCodes = owner.parsedUwCourseCodes ?? [];
  const sourceOnlyUwCourseCodes = owner.sourceOnlyUwCourseCodes ?? [];
  const structuredOnlyUwCourseCodes = owner.structuredOnlyUwCourseCodes ?? [];
  const approvedFilterUwCourseCodes = owner.approvedFilterUwCourseCodes ?? [];
  const electiveListUwCourseCodes = owner.electiveListUwCourseCodes ?? [];
  const supportOnlyUwCourseCodes = owner.supportOnlyUwCourseCodes ?? [];
  const extractedHeadings = owner.extractedHeadings ?? [];
  const requirementCueLines = owner.requirementCueLines ?? [];
  const chooseStatements = owner.chooseStatements ?? [];
  const qualitySignals = owner.qualitySignals ?? [];
  const qualitySignalCodes = qualitySignals.map((signal) => signal.code).sort();
  const qualityWarningCount = qualitySignals.filter((signal) => signal.severity === "warning").length;
  const qualityNoteCount = qualitySignals.filter((signal) => signal.severity === "note").length;
  const sourceRole = owner.sourceRole ?? null;
  const sourceRoleStatus = owner.sourceRoleStatus ?? null;
  const canCreateSchedulableRows = owner.canCreateSchedulableRows !== false;
  const supportOnly = owner.supportOnly === true;
  const fingerprintInput = {
    ok: owner.ok,
    parseConfidence: owner.parseConfidence,
    sourceRole,
    sourceRoleStatus,
    canCreateSchedulableRows,
    supportOnly,
    parsedUwCourseCodes,
    sourceOnlyUwCourseCodes,
    structuredOnlyUwCourseCodes,
    approvedFilterUwCourseCodes,
    electiveListUwCourseCodes,
    supportOnlyUwCourseCodes,
    extractedHeadings,
    requirementCueLines,
    chooseStatements,
    qualitySignalCodes,
    error: owner.error,
  };

  return {
    ownerId: owner.ownerId,
    ownerTitle: owner.ownerTitle,
    planId: owner.planId,
    pathwayId: owner.pathwayId ?? null,
    campusId: owner.campusId,
    parserType: owner.parserType,
    sourceUrl: owner.sourceUrl,
    sourceLabel: owner.sourceLabel,
    primarySourceUrl: owner.primarySourceUrl ?? owner.sourceUrl,
    primarySourceLabel: owner.primarySourceLabel ?? owner.sourceLabel,
    sourceRole,
    sourceRoleStatus,
    canCreateSchedulableRows,
    canCreateRequiredRows: owner.canCreateRequiredRows === true,
    canCreateScheduleRows: owner.canCreateScheduleRows === true,
    supportOnly,
    nonSchedulable: owner.nonSchedulable === true,
    ok: Boolean(owner.ok),
    parseConfidence: owner.parseConfidence ?? "low",
    parsedUwCourseCodeCount: parsedUwCourseCodes.length,
    sourceOnlyUwCourseCodeCount: sourceOnlyUwCourseCodes.length,
    structuredOnlyUwCourseCodeCount: structuredOnlyUwCourseCodes.length,
    approvedFilterUwCourseCodeCount: approvedFilterUwCourseCodes.length,
    electiveListUwCourseCodeCount: electiveListUwCourseCodes.length,
    supportOnlyUwCourseCodeCount: supportOnlyUwCourseCodes.length,
    supportListCount: (owner.supportLists ?? []).length,
    extractedHeadingCount: extractedHeadings.length,
    requirementCueLineCount: requirementCueLines.length,
    chooseStatementCount: chooseStatements.length,
    qualitySignalCodes,
    qualityWarningCount,
    qualityNoteCount,
    requirementFingerprint: sha256Json(fingerprintInput),
    parsedUwCourseCodes,
    sourceOnlyUwCourseCodes,
    structuredOnlyUwCourseCodes,
    approvedFilterUwCourseCodes,
    electiveListUwCourseCodes,
    supportOnlyUwCourseCodes,
  };
}

function getRequirementFingerprintCompareKey(entry) {
  const ownerId = getEntryKey(entry, "ownerId");
  const sourceUrl =
    normalizeSourceUrlKey(entry?.sourceUrl) ||
    normalizeSourceUrlKey(entry?.primarySourceUrl) ||
    "unknown-source";
  const parserType = getEntryKey(entry, "parserType") || "unknown-parser";
  const sourceRole = getEntryKey(entry, "sourceRole") || "unknown-role";
  return ownerId ? [ownerId, sourceUrl, parserType, sourceRole].join("\u0000") : "";
}

function getCompareKey(entry, keyNameOrGetter) {
  if (typeof keyNameOrGetter === "function") {
    return String(keyNameOrGetter(entry) ?? "").trim();
  }
  return getEntryKey(entry, keyNameOrGetter);
}

function compareFingerprints(previousEntries, currentEntries, keyNameOrGetter, hashName) {
  const previousByKey = new Map(
    previousEntries.map((entry) => [getCompareKey(entry, keyNameOrGetter), entry])
  );
  const currentByKey = new Map(
    currentEntries.map((entry) => [getCompareKey(entry, keyNameOrGetter), entry])
  );
  const added = [];
  const changed = [];
  const unchanged = [];
  const removed = [];

  for (const current of currentEntries) {
    const key = getCompareKey(current, keyNameOrGetter);
    const previous = previousByKey.get(key);
    if (!previous) {
      added.push(current);
      continue;
    }

    if (previous[hashName] !== current[hashName]) {
      changed.push(current);
    } else {
      unchanged.push(current);
    }
  }

  for (const previous of previousEntries) {
    if (!currentByKey.has(getCompareKey(previous, keyNameOrGetter))) {
      removed.push(previous);
    }
  }

  return { added, changed, unchanged, removed };
}

function collectSourceDiffOwnerIds(entries) {
  return uniqueSorted(
    (entries ?? []).flatMap((entry) => normalizeSourceOwnerIds(entry.ownerIds ?? []))
  );
}

function collectRequirementDiffOwnerIds(entries) {
  return uniqueSorted(
    (entries ?? []).map((entry) => String(entry.ownerId ?? "").trim())
  );
}

function getEntryKey(entry, keyName) {
  return String(entry?.[keyName] ?? "").trim();
}

function mapBy(entries, keyName) {
  const mapped = new Map();
  for (const entry of entries ?? []) {
    const key = getEntryKey(entry, keyName);
    if (key) {
      mapped.set(key, entry);
    }
  }
  return mapped;
}

function getRequirementFingerprintSummary(entry) {
  if (!entry) {
    return null;
  }

  return {
    sourceUrl: entry.sourceUrl ?? null,
    sourceRole: entry.sourceRole ?? null,
    sourceRoleStatus: entry.sourceRoleStatus ?? null,
    parserType: entry.parserType ?? null,
    ok: entry.ok === true,
    parseConfidence: entry.parseConfidence ?? null,
    parsedUwCourseCodeCount: entry.parsedUwCourseCodeCount ?? 0,
    sourceOnlyUwCourseCodeCount: entry.sourceOnlyUwCourseCodeCount ?? 0,
    structuredOnlyUwCourseCodeCount: entry.structuredOnlyUwCourseCodeCount ?? 0,
    approvedFilterUwCourseCodeCount: entry.approvedFilterUwCourseCodeCount ?? 0,
    electiveListUwCourseCodeCount: entry.electiveListUwCourseCodeCount ?? 0,
    supportOnlyUwCourseCodeCount: entry.supportOnlyUwCourseCodeCount ?? 0,
    supportListCount: entry.supportListCount ?? 0,
    extractedHeadingCount: entry.extractedHeadingCount ?? 0,
    requirementCueLineCount: entry.requirementCueLineCount ?? 0,
    chooseStatementCount: entry.chooseStatementCount ?? 0,
    qualitySignalCodes: entry.qualitySignalCodes ?? [],
    qualityWarningCount: entry.qualityWarningCount ?? 0,
    requirementFingerprint: entry.requirementFingerprint ?? null,
  };
}

function buildSourceResourceSummary(entry) {
  if (!entry) {
    return null;
  }

  return {
    url: entry.url ?? null,
    finalUrl: entry.finalUrl ?? null,
    ok: entry.ok === true,
    status: entry.status ?? null,
    contentType: entry.contentType ?? null,
    contentLength: entry.contentLength ?? null,
    etag: entry.etag ?? null,
    lastModified: entry.lastModified ?? null,
    title: entry.title ?? null,
    fetchMode: entry.fetchMode ?? null,
    resourceFingerprint: entry.resourceFingerprint ?? null,
  };
}

function getSourceResourceForRequirement(entry, sourceByUrl) {
  if (!entry) {
    return null;
  }

  return (
    sourceByUrl.get(normalizeSourceUrlKey(entry.sourceUrl)) ??
    sourceByUrl.get(normalizeSourceUrlKey(entry.primarySourceUrl)) ??
    null
  );
}

function isSupportOnlyRequirementFingerprint(entry) {
  return (
    entry?.supportOnly === true ||
    entry?.sourceRoleStatus === "support" ||
    entry?.canCreateSchedulableRows === false ||
    entry?.canCreateScheduleRows === false
  );
}

function hasNoUsableParsedCourses(entry) {
  return (entry?.parsedUwCourseCodeCount ?? 0) === 0;
}

function isParentPlanRequirementFingerprint(entry) {
  const ownerId = String(entry?.ownerId ?? "").trim();
  const planId = String(entry?.planId ?? "").trim();
  return Boolean(ownerId && planId && ownerId === planId && !entry?.pathwayId);
}

function isChildPathwayRequirementFingerprint(entry, planId) {
  const ownerId = String(entry?.ownerId ?? "").trim();
  const entryPlanId = String(entry?.planId ?? "").trim();
  if (!ownerId || !planId || entryPlanId !== planId || ownerId === planId) {
    return false;
  }

  return Boolean(entry?.pathwayId) || ownerId.startsWith(`${planId}:pathway:`);
}

function buildPlanChildPathwayCoverage(requirementSourceFingerprints) {
  const coverageByPlanId = new Map();
  for (const entry of requirementSourceFingerprints ?? []) {
    const planId = String(entry?.planId ?? "").trim();
    if (!isChildPathwayRequirementFingerprint(entry, planId)) {
      continue;
    }
    if (isSupportOnlyRequirementFingerprint(entry) || (entry.parsedUwCourseCodeCount ?? 0) <= 0) {
      continue;
    }

    const coverage = coverageByPlanId.get(planId) ?? {
      childOwnerIds: new Set(),
      parsedUwCourseCodeCount: 0,
    };
    coverage.childOwnerIds.add(entry.ownerId);
    coverage.parsedUwCourseCodeCount += entry.parsedUwCourseCodeCount ?? 0;
    coverageByPlanId.set(planId, coverage);
  }

  return new Map(
    [...coverageByPlanId.entries()].map(([planId, coverage]) => [
      planId,
      {
        childOwnerIds: [...coverage.childOwnerIds].sort((left, right) => left.localeCompare(right)),
        parsedUwCourseCodeCount: coverage.parsedUwCourseCodeCount,
      },
    ])
  );
}

function getChildPathwayCoverageForParent(entry, planChildPathwayCoverageByPlanId) {
  if (!isParentPlanRequirementFingerprint(entry) || (entry?.parsedUwCourseCodeCount ?? 0) > 0) {
    return null;
  }

  const planId = String(entry?.planId ?? "").trim();
  const coverage = planChildPathwayCoverageByPlanId?.get(planId) ?? null;
  return coverage?.childOwnerIds?.length ? coverage : null;
}

function parseConfidenceRank(value) {
  switch (value) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function extractYearSignals(value) {
  const text = String(value ?? "");
  const years = [];
  for (const match of text.matchAll(/\b(20\d{2})\b/g)) {
    years.push(Number.parseInt(match[1], 10));
  }
  for (const match of text.matchAll(/\b(?:ay|academic[-\s]*year)?\s*(\d{2})[_/-](\d{2})\b/gi)) {
    const start = Number.parseInt(match[1], 10);
    const end = Number.parseInt(match[2], 10);
    if (Number.isFinite(start)) {
      years.push(2000 + start);
    }
    if (Number.isFinite(end)) {
      years.push(2000 + end);
    }
  }
  return years.filter((year) => Number.isFinite(year));
}

function getMaxYearSignal(entry) {
  const years = extractYearSignals(
    [
      entry?.sourceUrl,
      entry?.sourceLabel,
      entry?.primarySourceUrl,
      entry?.primarySourceLabel,
    ].join(" ")
  );
  return years.length ? Math.max(...years) : null;
}

function sourceUrlsLookLikeSiblings(previousUrl, currentUrl) {
  try {
    const previous = new URL(previousUrl);
    const current = new URL(currentUrl);
    if (previous.hostname !== current.hostname) {
      return false;
    }

    const previousSegments = previous.pathname.split("/").filter(Boolean);
    const currentSegments = current.pathname.split("/").filter(Boolean);
    const sharedSegments = previousSegments.filter(
      (segment, index) => currentSegments[index] === segment
    ).length;
    return sharedSegments >= Math.max(1, Math.min(3, previousSegments.length - 1));
  } catch {
    return false;
  }
}

function isCurrentYearSiblingPromotion(previousEntry, currentEntry) {
  if (!previousEntry || !currentEntry || previousEntry.sourceUrl === currentEntry.sourceUrl) {
    return false;
  }

  const previousYear = getMaxYearSignal(previousEntry);
  const currentYear = getMaxYearSignal(currentEntry);
  const equalOrBetterCoverage =
    (currentEntry.parsedUwCourseCodeCount ?? 0) >= (previousEntry.parsedUwCourseCodeCount ?? 0) &&
    (currentEntry.qualityWarningCount ?? 0) <= Math.max(previousEntry.qualityWarningCount ?? 0, 1);

  return (
    equalOrBetterCoverage &&
    sourceUrlsLookLikeSiblings(previousEntry.sourceUrl, currentEntry.sourceUrl) &&
    (previousYear == null || currentYear == null || currentYear >= previousYear)
  );
}

function classifyActionStatus(category, previousEntry, currentEntry, courseDelta, options = {}) {
  if (category === "support-only-source-changed") {
    return "generated-evidence-only";
  }
  if (category === "source-became-weak-or-overview") {
    return "needs-discovery-rule";
  }
  if (category === "source-structure-changed") {
    if (options.childPathwayCoverage) {
      return "generated-evidence-only";
    }
    return currentEntry?.qualityWarningCount > previousEntry?.qualityWarningCount
      ? "needs-parser-rule"
      : "auto-applied";
  }
  if (category === "current-year-sibling-found") {
    return "auto-applied";
  }
  if (category === "new-course-added") {
    return courseDelta.added.length ? "auto-applied" : "no-op";
  }
  if (category === "course-removed") {
    return courseDelta.removed.length ? "auto-applied" : "no-op";
  }
  return "auto-applied";
}

function recommendedActionsForChange(category, currentEntry, options = {}) {
  switch (category) {
    case "new-course-added":
      return [
        "targeted-requirement-parse",
        "equivalency-mapping-refresh",
        currentEntry?.canCreateSchedulableRows === false
          ? "preserve-as-support-evidence"
          : "student-runtime-regeneration",
        "source-fingerprint-refresh",
      ];
    case "course-removed":
      return [
        "targeted-requirement-parse",
        "verify-alternate-official-support",
        "student-runtime-regeneration",
        "source-fingerprint-refresh",
      ];
    case "source-structure-changed":
      if (options.childPathwayCoverage) {
        return [
          "preserve-parent-overview-evidence",
          "targeted-requirement-parse",
          "source-fingerprint-refresh",
        ];
      }
      return [
        "targeted-parser-recovery",
        "targeted-requirement-parse",
        "source-fingerprint-refresh",
      ];
    case "current-year-sibling-found":
      return [
        "high-confidence-source-promotion",
        "targeted-requirement-parse",
        "source-fingerprint-refresh",
      ];
    case "source-became-weak-or-overview":
      return [
        "targeted-source-discovery",
        "primary-source-review-queue",
        "targeted-parser-recovery",
      ];
    case "support-only-source-changed":
      return [
        "regenerate-support-filters",
        "preserve-support-only-no-required-rows",
        "source-fingerprint-refresh",
      ];
    default:
      return ["source-fingerprint-refresh"];
  }
}

function buildSourceChangeRecord(input) {
  const {
    category,
    previousEntry,
    currentEntry,
    previousSourceResource,
    currentSourceResource,
    courseDelta,
    signalDelta,
    reason,
    childPathwayCoverage,
  } = input;
  const effectiveEntry = currentEntry ?? previousEntry;
  const actionStatus = classifyActionStatus(
    category,
    previousEntry ?? {},
    currentEntry ?? {},
    courseDelta,
    { childPathwayCoverage }
  );

  return {
    changeType: category,
    ownerId: effectiveEntry?.ownerId ?? null,
    ownerTitle: effectiveEntry?.ownerTitle ?? null,
    planId: effectiveEntry?.planId ?? null,
    pathwayId: effectiveEntry?.pathwayId ?? null,
    campusId: effectiveEntry?.campusId ?? null,
    sourceUrl: currentEntry?.sourceUrl ?? previousEntry?.sourceUrl ?? null,
    previousSourceUrl: previousEntry?.sourceUrl ?? null,
    currentSourceUrl: currentEntry?.sourceUrl ?? null,
    sourceRole: currentEntry?.sourceRole ?? previousEntry?.sourceRole ?? null,
    sourceRoleStatus: currentEntry?.sourceRoleStatus ?? previousEntry?.sourceRoleStatus ?? null,
    supportOnly: isSupportOnlyRequirementFingerprint(currentEntry ?? previousEntry),
    previousFingerprintSummary: getRequirementFingerprintSummary(previousEntry),
    currentFingerprintSummary: getRequirementFingerprintSummary(currentEntry),
    previousSourceResource: buildSourceResourceSummary(previousSourceResource),
    currentSourceResource: buildSourceResourceSummary(currentSourceResource),
    courseDelta,
    headingDelta: {
      previousHeadingCount: previousEntry?.extractedHeadingCount ?? null,
      currentHeadingCount: currentEntry?.extractedHeadingCount ?? null,
      delta:
        currentEntry && previousEntry
          ? (currentEntry.extractedHeadingCount ?? 0) - (previousEntry.extractedHeadingCount ?? 0)
          : null,
    },
    sectionDelta: {
      previousRequirementCueLineCount: previousEntry?.requirementCueLineCount ?? null,
      currentRequirementCueLineCount: currentEntry?.requirementCueLineCount ?? null,
      previousChooseStatementCount: previousEntry?.chooseStatementCount ?? null,
      currentChooseStatementCount: currentEntry?.chooseStatementCount ?? null,
    },
    qualitySignalDelta: signalDelta,
    childPathwayCoverage: childPathwayCoverage
      ? {
          childOwnerIds: childPathwayCoverage.childOwnerIds,
          parsedUwCourseCodeCount: childPathwayCoverage.parsedUwCourseCodeCount,
        }
      : null,
    recommendedAction: recommendedActionsForChange(category, currentEntry ?? previousEntry, {
      childPathwayCoverage,
    }),
    actionStatus,
    autoApplied: ["auto-applied", "generated-evidence-only"].includes(actionStatus),
    reason,
  };
}

function getQualitySignalDelta(previousEntry, currentEntry) {
  return diffValues(previousEntry?.qualitySignalCodes ?? [], currentEntry?.qualitySignalCodes ?? []);
}

function buildRequirementChangeRecords(input) {
  const {
    previousEntry,
    currentEntry,
    previousSourceResource,
    currentSourceResource,
    planChildPathwayCoverageByPlanId,
  } = input;
  const previousCodes = normalizeCourseCodes(previousEntry?.parsedUwCourseCodes ?? []);
  const currentCodes = normalizeCourseCodes(currentEntry?.parsedUwCourseCodes ?? []);
  const courseDelta = diffValues(previousCodes, currentCodes);
  const signalDelta = getQualitySignalDelta(previousEntry, currentEntry);
  const records = [];
  const currentIsSupportOnly = isSupportOnlyRequirementFingerprint(currentEntry);
  const previousIsSupportOnly = isSupportOnlyRequirementFingerprint(previousEntry);
  const currentChildPathwayCoverage = getChildPathwayCoverageForParent(
    currentEntry,
    planChildPathwayCoverageByPlanId
  );

  if (currentIsSupportOnly || previousIsSupportOnly) {
    if (
      courseDelta.added.length ||
      courseDelta.removed.length ||
      previousEntry?.requirementFingerprint !== currentEntry?.requirementFingerprint
    ) {
      records.push(
        buildSourceChangeRecord({
          category: "support-only-source-changed",
          previousEntry,
          currentEntry,
          previousSourceResource,
          currentSourceResource,
          courseDelta,
          signalDelta,
          reason:
            "Support-only official source changed; regenerate filters/evidence without creating required schedule rows.",
        })
      );
    }
    return records;
  }

  if (isCurrentYearSiblingPromotion(previousEntry, currentEntry)) {
    records.push(
      buildSourceChangeRecord({
        category: "current-year-sibling-found",
        previousEntry,
        currentEntry,
        previousSourceResource,
        currentSourceResource,
        courseDelta,
        signalDelta,
        reason:
          "Owner source URL changed to a sibling/current-year source with equal or better parsed coverage.",
      })
    );
  }

  if (courseDelta.added.length) {
    records.push(
      buildSourceChangeRecord({
        category: "new-course-added",
        previousEntry,
        currentEntry,
        previousSourceResource,
        currentSourceResource,
        courseDelta,
        signalDelta,
        reason: "New UW course code(s) appeared in the parsed official source.",
      })
    );
  }

  if (courseDelta.removed.length) {
    records.push(
      buildSourceChangeRecord({
        category: "course-removed",
        previousEntry,
        currentEntry,
        previousSourceResource,
        currentSourceResource,
        courseDelta,
        signalDelta,
        reason: "Previously UW course code(s) disappeared from the parsed official source.",
      })
    );
  }

  const previousConfidenceRank = parseConfidenceRank(previousEntry?.parseConfidence);
  const currentConfidenceRank = parseConfidenceRank(currentEntry?.parseConfidence);
  const warningIncrease =
    (currentEntry?.qualityWarningCount ?? 0) > (previousEntry?.qualityWarningCount ?? 0);
  const cueDelta = Math.abs(
    (currentEntry?.requirementCueLineCount ?? 0) - (previousEntry?.requirementCueLineCount ?? 0)
  );
  const headingDelta = Math.abs(
    (currentEntry?.extractedHeadingCount ?? 0) - (previousEntry?.extractedHeadingCount ?? 0)
  );
  const changedStructure =
    warningIncrease ||
    signalDelta.added.length > 0 ||
    cueDelta >= 5 ||
    headingDelta >= 3 ||
    previousConfidenceRank !== currentConfidenceRank;

  if (changedStructure) {
    records.push(
      buildSourceChangeRecord({
        category: "source-structure-changed",
        previousEntry,
        currentEntry,
        previousSourceResource,
        currentSourceResource,
        courseDelta,
        signalDelta,
        reason:
          currentChildPathwayCoverage
            ? "Parent overview structure changed, but same-plan child pathway sources provide schedulable requirement coverage."
            : "Parsed structure, parser confidence, requirement cues, headings, or quality warnings changed materially.",
        childPathwayCoverage: currentChildPathwayCoverage,
      })
    );
  }

  const becameWeak =
    !hasNoUsableParsedCourses(previousEntry) &&
    hasNoUsableParsedCourses(currentEntry) ||
    currentConfidenceRank < previousConfidenceRank ||
    (currentEntry?.qualitySignalCodes ?? []).some((code) =>
      ["no-parsed-uw-course-codes", "low-confidence-parsed-source"].includes(code)
    );
  if (becameWeak) {
    records.push(
      buildSourceChangeRecord({
        category: "source-became-weak-or-overview",
        previousEntry,
        currentEntry,
        previousSourceResource,
        currentSourceResource,
        courseDelta,
        signalDelta,
        reason:
          "Official source became weak, overview-only, or stopped yielding schedulable requirement coverage.",
      })
    );
  }

  return records;
}

function buildSourceOnlyChangeRecords(input) {
  const {
    sourceDiff,
    previousSourceByUrl,
    currentSourceByUrl,
    previousRequirementByOwnerId,
    currentRequirementByOwnerId,
    planChildPathwayCoverageByPlanId,
  } = input;
  const records = [];
  const changedRequirementOwnerIds = new Set(
    [
      ...(input.requirementDiff?.changed ?? []),
      ...(input.requirementDiff?.added ?? []),
      ...(input.requirementDiff?.removed ?? []),
    ].map((entry) => entry.ownerId)
  );

  for (const sourceEntry of [
    ...(sourceDiff?.changed ?? []),
    ...(sourceDiff?.added ?? []),
  ]) {
    for (const ownerId of sourceEntry.ownerIds ?? []) {
      if (changedRequirementOwnerIds.has(ownerId)) {
        continue;
      }

      const currentEntry = currentRequirementByOwnerId.get(ownerId);
      const previousEntry = previousRequirementByOwnerId.get(ownerId) ?? currentEntry;
      if (!currentEntry && !previousEntry) {
        continue;
      }

      const previousSourceResource =
        previousSourceByUrl.get(normalizeSourceUrlKey(sourceEntry.url)) ??
        getSourceResourceForRequirement(previousEntry, previousSourceByUrl);
      const currentSourceResource =
        currentSourceByUrl.get(normalizeSourceUrlKey(sourceEntry.url)) ??
        getSourceResourceForRequirement(currentEntry, currentSourceByUrl);
      records.push(
        buildSourceChangeRecord({
          category: isSupportOnlyRequirementFingerprint(currentEntry)
            ? "support-only-source-changed"
            : "source-structure-changed",
          previousEntry,
          currentEntry,
          previousSourceResource,
          currentSourceResource,
          courseDelta: { added: [], removed: [] },
          signalDelta: getQualitySignalDelta(previousEntry, currentEntry),
          reason:
            "Official source resource fingerprint changed while parsed requirement facts stayed stable.",
          childPathwayCoverage: getChildPathwayCoverageForParent(
            currentEntry,
            planChildPathwayCoverageByPlanId
          ),
        })
      );
    }
  }

  return records;
}

function buildSourceChangeClassificationReport(input) {
  const previousFingerprints = input.previousFingerprints ?? {
    sourceFingerprints: [],
    requirementSourceFingerprints: [],
  };
  const sourceFingerprints = input.sourceFingerprints ?? [];
  const requirementSourceFingerprints = input.requirementSourceFingerprints ?? [];
  const sourceDiff =
    input.sourceDiff ??
    compareFingerprints(
      previousFingerprints.sourceFingerprints,
      sourceFingerprints,
      "url",
      "resourceFingerprint"
    );
  const requirementDiff =
    input.requirementDiff ??
    compareFingerprints(
      previousFingerprints.requirementSourceFingerprints,
      requirementSourceFingerprints,
      getRequirementFingerprintCompareKey,
      "requirementFingerprint"
    );
  const previousRequirementByOwnerId = mapBy(
    previousFingerprints.requirementSourceFingerprints,
    "ownerId"
  );
  const currentRequirementByOwnerId = mapBy(requirementSourceFingerprints, "ownerId");
  const previousSourceByUrl = mapBy(previousFingerprints.sourceFingerprints, "url");
  const currentSourceByUrl = mapBy(sourceFingerprints, "url");
  const planChildPathwayCoverageByPlanId =
    buildPlanChildPathwayCoverage(requirementSourceFingerprints);
  const records = [];

  for (const currentEntry of [...(requirementDiff.changed ?? []), ...(requirementDiff.added ?? [])]) {
    const previousEntry = previousRequirementByOwnerId.get(currentEntry.ownerId);
    const previousSourceResource = getSourceResourceForRequirement(previousEntry, previousSourceByUrl);
    const currentSourceResource = getSourceResourceForRequirement(currentEntry, currentSourceByUrl);

    if (!previousEntry) {
      const courseDelta = {
        added: normalizeCourseCodes(currentEntry.parsedUwCourseCodes ?? []),
        removed: [],
      };
      records.push(
        buildSourceChangeRecord({
          category: isSupportOnlyRequirementFingerprint(currentEntry)
            ? "support-only-source-changed"
            : courseDelta.added.length
              ? "new-course-added"
              : "source-structure-changed",
          previousEntry: null,
          currentEntry,
          previousSourceResource: null,
          currentSourceResource,
          courseDelta,
          signalDelta: { added: currentEntry.qualitySignalCodes ?? [], removed: [] },
          reason: "New parsed requirement-source fingerprint appeared for this owner.",
          childPathwayCoverage: getChildPathwayCoverageForParent(
            currentEntry,
            planChildPathwayCoverageByPlanId
          ),
        })
      );
      continue;
    }

    records.push(
      ...buildRequirementChangeRecords({
        previousEntry,
        currentEntry,
        previousSourceResource,
        currentSourceResource,
        planChildPathwayCoverageByPlanId,
      })
    );
  }

  for (const previousEntry of requirementDiff.removed ?? []) {
    const previousSourceResource = getSourceResourceForRequirement(previousEntry, previousSourceByUrl);
    records.push(
      buildSourceChangeRecord({
        category: "course-removed",
        previousEntry,
        currentEntry: null,
        previousSourceResource,
        currentSourceResource: null,
        courseDelta: {
          added: [],
          removed: normalizeCourseCodes(previousEntry.parsedUwCourseCodes ?? []),
        },
        signalDelta: { added: [], removed: previousEntry.qualitySignalCodes ?? [] },
        reason: "Parsed requirement-source fingerprint disappeared for this owner.",
      })
    );
  }

  records.push(
    ...buildSourceOnlyChangeRecords({
      sourceDiff,
      requirementDiff,
      previousSourceByUrl,
      currentSourceByUrl,
      previousRequirementByOwnerId,
      currentRequirementByOwnerId,
      planChildPathwayCoverageByPlanId,
    })
  );

  const uniqueRecords = uniqueInOrder(
    records.map((record) => JSON.stringify(record))
  ).map((record) => JSON.parse(record));

  return {
    generatedAt: new Date().toISOString(),
    totalChangeCount: uniqueRecords.length,
    countsByChangeType: countBy(uniqueRecords, (record) => record.changeType),
    countsByActionStatus: countBy(uniqueRecords, (record) => record.actionStatus),
    affectedOwnerCount: new Set(uniqueRecords.map((record) => record.ownerId).filter(Boolean)).size,
    affectedPlanCount: new Set(uniqueRecords.map((record) => record.planId).filter(Boolean)).size,
    changes: uniqueRecords.sort(
      (left, right) =>
        String(left.planId ?? "").localeCompare(String(right.planId ?? "")) ||
        String(left.ownerId ?? "").localeCompare(String(right.ownerId ?? "")) ||
        String(left.changeType ?? "").localeCompare(String(right.changeType ?? ""))
    ),
  };
}

function countBy(values, getKey) {
  return (values ?? []).reduce((counts, value) => {
    const key = getKey(value) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function buildReport(sourceSnapshot, requirementReport, previousFingerprints) {
  const titlesByPlanId = buildRequirementReportTitlesByPlanId(requirementReport.owners ?? []);
  const sourceFingerprints = addRequirementBackedSourceFingerprints(
    (sourceSnapshot.sources ?? []).map((source) =>
      buildSourceFingerprintEntry(source, titlesByPlanId)
    ),
    requirementReport.owners ?? [],
    titlesByPlanId
  );
  const requirementSourceFingerprints = (requirementReport.owners ?? []).map(
    buildRequirementFingerprintEntry
  );
  const sourceDiff = compareFingerprints(
    previousFingerprints.sourceFingerprints,
    sourceFingerprints,
    "url",
    "resourceFingerprint"
  );
  const requirementDiff = compareFingerprints(
    previousFingerprints.requirementSourceFingerprints,
    requirementSourceFingerprints,
    getRequirementFingerprintCompareKey,
    "requirementFingerprint"
  );
  const addedSourceOwnerIds = collectSourceDiffOwnerIds(sourceDiff.added);
  const changedSourceOwnerIds = collectSourceDiffOwnerIds(sourceDiff.changed);
  const removedSourceOwnerIds = collectSourceDiffOwnerIds(sourceDiff.removed);
  const addedRequirementOwnerIds = collectRequirementDiffOwnerIds(requirementDiff.added);
  const changedRequirementOwnerIds = collectRequirementDiffOwnerIds(requirementDiff.changed);
  const removedRequirementOwnerIds = collectRequirementDiffOwnerIds(requirementDiff.removed);
  const sourceChangeClassification = buildSourceChangeClassificationReport({
    previousFingerprints,
    sourceFingerprints,
    requirementSourceFingerprints,
    sourceDiff,
    requirementDiff,
  });

  return {
    generatedAt: new Date().toISOString(),
    sourceSnapshotGeneratedAt: sourceSnapshot.generatedAt,
    requirementParseReportGeneratedAt: requirementReport.generatedAt,
    totalSourceFingerprints: sourceFingerprints.length,
    totalRequirementSourceFingerprints: requirementSourceFingerprints.length,
    changedSourceFingerprintCount: sourceDiff.changed.length,
    changedRequirementFingerprintCount: requirementDiff.changed.length,
    addedSourceFingerprintCount: sourceDiff.added.length,
    addedRequirementFingerprintCount: requirementDiff.added.length,
    removedSourceFingerprintCount: sourceDiff.removed.length,
    removedRequirementFingerprintCount: requirementDiff.removed.length,
    sourceFingerprintOwnerIds: uniqueSorted(
      sourceFingerprints.flatMap((entry) => entry.ownerIds ?? [])
    ),
    requirementFingerprintOwnerIds: uniqueSorted(
      requirementSourceFingerprints.map((entry) => entry.ownerId)
    ),
    addedSourceOwnerIds,
    changedSourceOwnerIds,
    removedSourceOwnerIds,
    touchedSourceOwnerIds: uniqueSorted([
      ...addedSourceOwnerIds,
      ...changedSourceOwnerIds,
      ...removedSourceOwnerIds,
    ]),
    addedRequirementOwnerIds,
    changedRequirementOwnerIds,
    removedRequirementOwnerIds,
    touchedRequirementOwnerIds: uniqueSorted([
      ...addedRequirementOwnerIds,
      ...changedRequirementOwnerIds,
      ...removedRequirementOwnerIds,
    ]),
    sourceChangeClassificationSummary: {
      reportJsonPath: CHANGE_CLASSIFICATION_JSON_PATH,
      reportMarkdownPath: CHANGE_CLASSIFICATION_MD_PATH,
      totalChangeCount: sourceChangeClassification.totalChangeCount,
      affectedOwnerCount: sourceChangeClassification.affectedOwnerCount,
      affectedPlanCount: sourceChangeClassification.affectedPlanCount,
      countsByChangeType: sourceChangeClassification.countsByChangeType,
      countsByActionStatus: sourceChangeClassification.countsByActionStatus,
    },
    sourceChangeClassification,
    sourceDiff,
    requirementDiff,
    sourceFingerprints,
    requirementSourceFingerprints,
  };
}

function buildGeneratedFile(report) {
  return [
    'import type { TransferPlannerRequirementSourceFingerprintEntry, TransferPlannerSourceFingerprintEntry } from "./schema";',
    "",
    "// Generated by scripts/planner/build-transfer-planner-source-fingerprints.cjs",
    `export const TRANSFER_PLANNER_FINGERPRINTS: TransferPlannerSourceFingerprintEntry[] = ${JSON.stringify(report.sourceFingerprints, null, 2)};`,
    "",
    `export const TRANSFER_PLANNER_REQUIREMENT_FINGERPRINTS: TransferPlannerRequirementSourceFingerprintEntry[] = ${JSON.stringify(report.requirementSourceFingerprints, null, 2)};`,
    "",
  ].join("\n");
}

function writeMarkdown(report) {
  const lines = [
    "# Transfer Planner Source Fingerprints",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Source snapshot generated: ${report.sourceSnapshotGeneratedAt}`,
    `- Requirement parse report generated: ${report.requirementParseReportGeneratedAt}`,
    `- Source fingerprints: ${report.totalSourceFingerprints}`,
    `- Requirement-source fingerprints: ${report.totalRequirementSourceFingerprints}`,
    `- Changed source resource fingerprints: ${report.changedSourceFingerprintCount}`,
    `- Changed parsed requirement fingerprints: ${report.changedRequirementFingerprintCount}`,
    `- Added source fingerprints: ${report.addedSourceFingerprintCount}`,
    `- Added requirement fingerprints: ${report.addedRequirementFingerprintCount}`,
    `- Removed source fingerprints: ${report.removedSourceFingerprintCount}`,
    `- Removed requirement fingerprints: ${report.removedRequirementFingerprintCount}`,
    `- Touched source owners: ${report.touchedSourceOwnerIds.length}`,
    `- Touched requirement owners: ${report.touchedRequirementOwnerIds.length}`,
    `- Classified source changes: ${report.sourceChangeClassificationSummary.totalChangeCount}`,
    `- Source-change report: ${CHANGE_CLASSIFICATION_MD_PATH}`,
    "",
    "Source resource fingerprints track official URL metadata/body hashes.",
    "Requirement-source fingerprints track parsed requirement facts separately, so cosmetic page changes do not automatically become planner requirement changes.",
    "",
  ];

  if (report.sourceDiff.changed.length) {
    lines.push("## Changed Source Resources", "");
    for (const entry of report.sourceDiff.changed.slice(0, 40)) {
      lines.push(`- ${entry.url}`);
      lines.push(`  - owners: ${entry.ownerIds.join(", ")}`);
      lines.push(`  - fingerprint: ${entry.resourceFingerprint}`);
    }
    lines.push("");
  }

  if (report.requirementDiff.changed.length) {
    lines.push("## Changed Parsed Requirement Facts", "");
    for (const entry of report.requirementDiff.changed.slice(0, 40)) {
      lines.push(`- ${entry.ownerTitle} (${entry.ownerId})`);
      lines.push(`  - source: ${entry.sourceUrl}`);
      lines.push(`  - fingerprint: ${entry.requirementFingerprint}`);
      lines.push(`  - source-only UW course codes: ${entry.sourceOnlyUwCourseCodeCount}`);
      lines.push(`  - structured-only UW course codes: ${entry.structuredOnlyUwCourseCodeCount}`);
      if (entry.qualitySignalCodes.length) {
        lines.push(`  - quality signals: ${entry.qualitySignalCodes.join(", ")}`);
      }
    }
    lines.push("");
  }

  writePlannerMarkdownReport(OUTPUT_MD_PATH, lines);
}

function writeSourceChangeClassificationReport(report) {
  writePlannerJsonReport(CHANGE_CLASSIFICATION_JSON_PATH, report.sourceChangeClassification);

  const changeReport = report.sourceChangeClassification;
  const lines = [
    "# Transfer Planner Source Change Classification",
    "",
    `Generated: ${changeReport.generatedAt}`,
    "",
    `- Classified changes: ${changeReport.totalChangeCount}`,
    `- Affected owners: ${changeReport.affectedOwnerCount}`,
    `- Affected plans: ${changeReport.affectedPlanCount}`,
    "",
    "## Change Types",
    "",
    ...Object.entries(changeReport.countsByChangeType ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([changeType, count]) => `- ${changeType}: ${count}`),
    "",
    "## Action Statuses",
    "",
    ...Object.entries(changeReport.countsByActionStatus ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([status, count]) => `- ${status}: ${count}`),
    "",
  ];

  if ((changeReport.changes ?? []).length) {
    lines.push("## Classified Changes", "");
    for (const change of changeReport.changes.slice(0, 120)) {
      lines.push(`### ${change.ownerTitle ?? change.ownerId ?? "Unknown owner"}`);
      lines.push("");
      lines.push(`- Change type: ${change.changeType}`);
      lines.push(`- Owner: ${change.ownerId ?? "n/a"}`);
      lines.push(`- Plan: ${change.planId ?? "n/a"}`);
      lines.push(`- Source: ${change.sourceUrl ?? "n/a"}`);
      lines.push(`- Source role: ${change.sourceRole ?? "n/a"} (${change.sourceRoleStatus ?? "n/a"})`);
      lines.push(`- Action status: ${change.actionStatus}`);
      lines.push(`- Recommended action: ${(change.recommendedAction ?? []).join(", ") || "none"}`);
      lines.push(`- Reason: ${change.reason}`);
      lines.push(
        `- Course delta: +${(change.courseDelta?.added ?? []).join(", ") || "none"}; -${
          (change.courseDelta?.removed ?? []).join(", ") || "none"
        }`
      );
      lines.push(
        `- Heading count: ${change.headingDelta?.previousHeadingCount ?? "n/a"} -> ${
          change.headingDelta?.currentHeadingCount ?? "n/a"
        }`
      );
      lines.push(
        `- Requirement cue lines: ${
          change.sectionDelta?.previousRequirementCueLineCount ?? "n/a"
        } -> ${change.sectionDelta?.currentRequirementCueLineCount ?? "n/a"}`
      );
      const warningBefore =
        change.previousFingerprintSummary?.qualitySignalCodes?.join(", ") || "none";
      const warningAfter =
        change.currentFingerprintSummary?.qualitySignalCodes?.join(", ") || "none";
      lines.push(`- Quality signals: ${warningBefore} -> ${warningAfter}`);
      if (change.childPathwayCoverage?.childOwnerIds?.length) {
        lines.push(
          `- Child pathway coverage: ${change.childPathwayCoverage.childOwnerIds.length} owner(s), ${change.childPathwayCoverage.parsedUwCourseCodeCount} parsed UW course code(s)`
        );
      }
      lines.push(
        `- Fingerprint: ${
          change.previousFingerprintSummary?.requirementFingerprint ?? "n/a"
        } -> ${change.currentFingerprintSummary?.requirementFingerprint ?? "n/a"}`
      );
      lines.push("");
    }
    if (changeReport.changes.length > 120) {
      lines.push(
        `- ... ${changeReport.changes.length - 120} additional classified changes omitted from markdown.`
      );
      lines.push("");
    }
  } else {
    lines.push("## Classified Changes", "", "- None.", "");
  }

  writePlannerMarkdownReport(CHANGE_CLASSIFICATION_MD_PATH, lines);
}

function main() {
  ensurePlannerTmpLayout();

  if (hasArg("--check-sources-first") || !fs.existsSync(LINK_SNAPSHOT_PATH)) {
    runCommand(process.execPath, ["scripts/planner/check-transfer-planner-sources.cjs"]);
  }

  if (hasArg("--parse-requirements-first") || !fs.existsSync(REQUIREMENT_PARSE_REPORT_PATH)) {
    runCommand(process.execPath, ["scripts/planner/parse-transfer-planner-requirement-sources.cjs"]);
  }

  const sourceSnapshot = readJson(LINK_SNAPSHOT_PATH, "source-link snapshot");
  const requirementReport = readJson(REQUIREMENT_PARSE_REPORT_PATH, "requirement parse report");
  const previousFingerprints = loadPreviousFingerprints();
  const report = buildReport(sourceSnapshot, requirementReport, previousFingerprints);

  writePlannerJsonReport(OUTPUT_JSON_PATH, report);
  fs.writeFileSync(GENERATED_OUTPUT_PATH, buildGeneratedFile(report));
  writeMarkdown(report);
  writeSourceChangeClassificationReport(report);

  console.log(`Source fingerprints: ${report.totalSourceFingerprints}`);
  console.log(`Requirement-source fingerprints: ${report.totalRequirementSourceFingerprints}`);
  console.log(`Changed source resource fingerprints: ${report.changedSourceFingerprintCount}`);
  console.log(`Changed parsed requirement fingerprints: ${report.changedRequirementFingerprintCount}`);
  console.log(
    `Classified source changes: ${report.sourceChangeClassificationSummary.totalChangeCount}`
  );
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);
  console.log(`Source-change report: ${CHANGE_CLASSIFICATION_MD_PATH}`);
  console.log(`Generated fingerprint registry: ${GENERATED_OUTPUT_PATH}`);
}

module.exports = {
  buildReport,
  buildRequirementFingerprintEntryForTest: buildRequirementFingerprintEntry,
  buildSourceChangeClassificationReportForTest: buildSourceChangeClassificationReport,
  compareFingerprintsForTest: compareFingerprints,
  getRequirementFingerprintCompareKeyForTest: getRequirementFingerprintCompareKey,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
