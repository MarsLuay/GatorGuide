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
  const extractedHeadings = owner.extractedHeadings ?? [];
  const requirementCueLines = owner.requirementCueLines ?? [];
  const chooseStatements = owner.chooseStatements ?? [];
  const qualitySignals = owner.qualitySignals ?? [];
  const qualitySignalCodes = qualitySignals.map((signal) => signal.code).sort();
  const qualityWarningCount = qualitySignals.filter((signal) => signal.severity === "warning").length;
  const qualityNoteCount = qualitySignals.filter((signal) => signal.severity === "note").length;
  const fingerprintInput = {
    ok: owner.ok,
    parseConfidence: owner.parseConfidence,
    parsedUwCourseCodes,
    sourceOnlyUwCourseCodes,
    structuredOnlyUwCourseCodes,
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
    ok: Boolean(owner.ok),
    parseConfidence: owner.parseConfidence ?? "low",
    parsedUwCourseCodeCount: parsedUwCourseCodes.length,
    sourceOnlyUwCourseCodeCount: sourceOnlyUwCourseCodes.length,
    structuredOnlyUwCourseCodeCount: structuredOnlyUwCourseCodes.length,
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

  console.log(`Source fingerprints: ${report.totalSourceFingerprints}`);
  console.log(`Requirement-source fingerprints: ${report.totalRequirementSourceFingerprints}`);
  console.log(`Changed source resource fingerprints: ${report.changedSourceFingerprintCount}`);
  console.log(`Changed parsed requirement fingerprints: ${report.changedRequirementFingerprintCount}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);
  console.log(`Generated fingerprint registry: ${GENERATED_OUTPUT_PATH}`);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
