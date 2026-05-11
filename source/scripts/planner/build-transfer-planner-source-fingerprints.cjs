const crypto = require("crypto");
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

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const SOURCE_LINK_SNAPSHOT_PATH = path.resolve(TMP_DIR, "transfer-planner-source-link-snapshot.json");
const REQUIREMENT_PARSE_REPORT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-requirement-source-parse-report.json"
);
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-source-fingerprints.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-source-fingerprints.md");
const SOURCE_CHANGE_CLASSIFICATION_JSON_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-source-change-classification.json"
);
const SOURCE_CHANGE_CLASSIFICATION_MD_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-source-change-classification.md"
);
const GENERATED_OUTPUT_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "source-fingerprints.generated.ts"
);

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

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
      sourceFingerprints: loaded.TRANSFER_PLANNER_SOURCE_FINGERPRINTS ?? [],
      requirementSourceFingerprints:
        loaded.TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINTS ?? [],
    };
  } catch (error) {
    console.log(`Could not load previous source fingerprints: ${error.message}`);
    return {
      sourceFingerprints: [],
      requirementSourceFingerprints: [],
    };
  }
}

function buildSourceFingerprintEntry(source) {
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
    ownerIds: source.ownerIds ?? [],
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

function buildRequirementBackedSourceFingerprintEntry(owner) {
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
    ownerIds: [owner.ownerId].filter(Boolean),
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

function addRequirementBackedSourceFingerprints(sourceFingerprints, requirementOwners) {
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

    let entry = entryByUrl.get(normalizedSourceUrl);
    if (!entry) {
      entry = buildRequirementBackedSourceFingerprintEntry(owner);
      entries.push(entry);
      addLookup(entry);
    }

    entry.labels = mergeUniqueStrings(entry.labels, [owner.sourceLabel]);
    entry.ownerIds = mergeUniqueStrings(entry.ownerIds, [owner.ownerId]);
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

function compareFingerprints(previousEntries, currentEntries, keyName, hashName) {
  const previousByKey = new Map(previousEntries.map((entry) => [entry[keyName], entry]));
  const currentByKey = new Map(currentEntries.map((entry) => [entry[keyName], entry]));
  const added = [];
  const changed = [];
  const unchanged = [];
  const removed = [];

  for (const current of currentEntries) {
    const previous = previousByKey.get(current[keyName]);
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
    if (!currentByKey.has(previous[keyName])) {
      removed.push(previous);
    }
  }

  return { added, changed, unchanged, removed };
}

function collectSourceDiffOwnerIds(entries) {
  return uniqueSorted(
    (entries ?? []).flatMap((entry) => entry.ownerIds ?? []).map((ownerId) => String(ownerId ?? "").trim())
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

function classifyActionStatus(category, previousEntry, currentEntry, courseDelta) {
  if (category === "support-only-source-changed") {
    return "generated-evidence-only";
  }
  if (category === "source-became-weak-or-overview") {
    return "needs-discovery-rule";
  }
  if (category === "source-structure-changed") {
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

function recommendedActionsForChange(category, currentEntry) {
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
  } = input;
  const effectiveEntry = currentEntry ?? previousEntry;

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
    recommendedAction: recommendedActionsForChange(category, currentEntry ?? previousEntry),
    actionStatus: classifyActionStatus(category, previousEntry ?? {}, currentEntry ?? {}, courseDelta),
    autoApplied:
      ["auto-applied", "generated-evidence-only"].includes(
        classifyActionStatus(category, previousEntry ?? {}, currentEntry ?? {}, courseDelta)
      ),
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
  } = input;
  const previousCodes = normalizeCourseCodes(previousEntry?.parsedUwCourseCodes ?? []);
  const currentCodes = normalizeCourseCodes(currentEntry?.parsedUwCourseCodes ?? []);
  const courseDelta = diffValues(previousCodes, currentCodes);
  const signalDelta = getQualitySignalDelta(previousEntry, currentEntry);
  const records = [];
  const currentIsSupportOnly = isSupportOnlyRequirementFingerprint(currentEntry);
  const previousIsSupportOnly = isSupportOnlyRequirementFingerprint(previousEntry);

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
        reason: "Previously source-backed UW course code(s) disappeared from the parsed official source.",
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
          "Parsed structure, parser confidence, requirement cues, headings, or quality warnings changed materially.",
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
      "ownerId",
      "requirementFingerprint"
    );
  const previousRequirementByOwnerId = mapBy(
    previousFingerprints.requirementSourceFingerprints,
    "ownerId"
  );
  const currentRequirementByOwnerId = mapBy(requirementSourceFingerprints, "ownerId");
  const previousSourceByUrl = mapBy(previousFingerprints.sourceFingerprints, "url");
  const currentSourceByUrl = mapBy(sourceFingerprints, "url");
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
  const sourceFingerprints = addRequirementBackedSourceFingerprints(
    (sourceSnapshot.sources ?? []).map(buildSourceFingerprintEntry),
    requirementReport.owners ?? []
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
    "ownerId",
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
      reportJsonPath: SOURCE_CHANGE_CLASSIFICATION_JSON_PATH,
      reportMarkdownPath: SOURCE_CHANGE_CLASSIFICATION_MD_PATH,
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
    `export const TRANSFER_PLANNER_SOURCE_FINGERPRINTS: TransferPlannerSourceFingerprintEntry[] = ${JSON.stringify(report.sourceFingerprints, null, 2)};`,
    "",
    `export const TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINTS: TransferPlannerRequirementSourceFingerprintEntry[] = ${JSON.stringify(report.requirementSourceFingerprints, null, 2)};`,
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
    `- Source-change report: ${SOURCE_CHANGE_CLASSIFICATION_MD_PATH}`,
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

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function writeSourceChangeClassificationReport(report) {
  fs.writeFileSync(
    SOURCE_CHANGE_CLASSIFICATION_JSON_PATH,
    `${JSON.stringify(report.sourceChangeClassification, null, 2)}\n`
  );

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

  fs.writeFileSync(SOURCE_CHANGE_CLASSIFICATION_MD_PATH, `${lines.join("\n")}\n`);
}

function main() {
  fs.mkdirSync(TMP_DIR, { recursive: true });

  if (hasArg("--check-sources-first") || !fs.existsSync(SOURCE_LINK_SNAPSHOT_PATH)) {
    runCommand("node", ["scripts/planner/check-transfer-planner-sources.cjs"]);
  }

  if (hasArg("--parse-requirements-first") || !fs.existsSync(REQUIREMENT_PARSE_REPORT_PATH)) {
    runCommand("node", ["scripts/planner/parse-transfer-planner-requirement-sources.cjs"]);
  }

  const sourceSnapshot = readJson(SOURCE_LINK_SNAPSHOT_PATH, "source-link snapshot");
  const requirementReport = readJson(REQUIREMENT_PARSE_REPORT_PATH, "requirement parse report");
  const previousFingerprints = loadPreviousFingerprints();
  const report = buildReport(sourceSnapshot, requirementReport, previousFingerprints);

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
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
  console.log(`Source-change report: ${SOURCE_CHANGE_CLASSIFICATION_MD_PATH}`);
  console.log(`Generated fingerprint registry: ${GENERATED_OUTPUT_PATH}`);
}

module.exports = {
  buildReport,
  buildRequirementFingerprintEntryForTest: buildRequirementFingerprintEntry,
  buildSourceChangeClassificationReportForTest: buildSourceChangeClassificationReport,
  compareFingerprintsForTest: compareFingerprints,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
