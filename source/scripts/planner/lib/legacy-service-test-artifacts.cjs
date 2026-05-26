const fs = require("node:fs");
const path = require("node:path");
const {
  SOURCE_ROOT,
  ensurePlannerTmpLayout,
  getPlannerTmpPath,
  writePlannerJsonReport,
  writePlannerMarkdownReport,
} = require("./script-harness.cjs");

const LEGACY_SERVICE_TEST_ENTRYPOINT = path.join(
  SOURCE_ROOT,
  "scripts",
  "planner",
  "transfer-planner.service.test.ts"
);

const LEGACY_SERVICE_TEST_ARTIFACT_FILENAMES = [
  "legacy-transfer-planner-service-test.log",
  "legacy-transfer-planner-service-test.tap",
  "legacy-transfer-planner-service-test.jsonl",
];

const DEFAULT_STATUS_JSON_PATH = getPlannerTmpPath(
  "legacy-transfer-planner-service-test.status.json"
);
const DEFAULT_STATUS_MD_PATH = getPlannerTmpPath(
  "legacy-transfer-planner-service-test.status.md"
);

function countFileLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return 0;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  if (!contents) {
    return 0;
  }

  return contents.split(/\r\n|\r|\n/).length;
}

function readTextOrNull(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, "utf8");
}

function extractLegacyServiceTestLocations(text) {
  const locations = [];
  const pattern = /transfer-planner\.service\.test\.ts:(\d+):(\d+)/gi;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    locations.push({
      line: Number(match[1]),
      column: Number(match[2]),
    });
  }

  return locations;
}

function parseTapSummary(text) {
  const summary = {};
  for (const key of ["tests", "pass", "fail", "cancelled", "skipped", "todo"]) {
    const match = text.match(new RegExp(`# ${key} (\\d+)`, "i"));
    if (match) {
      summary[key] = Number(match[1]);
    }
  }

  return Object.keys(summary).length ? summary : null;
}

function getDefaultArtifactPaths() {
  const reportRoot = path.dirname(DEFAULT_STATUS_JSON_PATH);
  const paths = LEGACY_SERVICE_TEST_ARTIFACT_FILENAMES.flatMap((filename) => {
    const currentLayoutPath = getPlannerTmpPath(filename);
    const legacyReportPath = path.join(reportRoot, filename);
    return currentLayoutPath === legacyReportPath
      ? [currentLayoutPath]
      : [currentLayoutPath, legacyReportPath];
  });

  return Array.from(new Set(paths));
}

function buildLegacyServiceTestArtifactStatus(options = {}) {
  const entryPointPath = options.entryPointPath ?? LEGACY_SERVICE_TEST_ENTRYPOINT;
  const artifactPaths = options.artifactPaths ?? getDefaultArtifactPaths();
  const entryPointLineCount = countFileLines(entryPointPath);
  const entryPointMtimeMs = fs.existsSync(entryPointPath)
    ? fs.statSync(entryPointPath).mtimeMs
    : null;

  const artifacts = artifactPaths.map((artifactPath) => {
    const text = readTextOrNull(artifactPath);
    const exists = text !== null;
    const stat = exists ? fs.statSync(artifactPath) : null;
    const locations = exists ? extractLegacyServiceTestLocations(text) : [];
    const maxReferencedLine = locations.reduce(
      (maxLine, location) => Math.max(maxLine, location.line),
      0
    );
    const staleReasons = [];

    if (exists && maxReferencedLine > entryPointLineCount) {
      staleReasons.push(
        `references line ${maxReferencedLine} in transfer-planner.service.test.ts, but the current entry point has ${entryPointLineCount} line(s)`
      );
    }

    if (exists && /Cannot find package 'json' imported from/i.test(text)) {
      staleReasons.push("captures a failed JSON reporter invocation, not planner test results");
    }

    if (
      exists &&
      entryPointMtimeMs !== null &&
      stat.mtimeMs < entryPointMtimeMs &&
      staleReasons.length === 0
    ) {
      staleReasons.push("older than the current legacy diagnostic entry point");
    }

    return {
      path: artifactPath,
      exists,
      status: staleReasons.length ? "stale" : exists ? "current-or-unclassified" : "missing",
      staleReasons,
      maxReferencedLine,
      currentEntryPointLineCount: entryPointLineCount,
      tapSummary: exists ? parseTapSummary(text) : null,
      lastModified: stat ? new Date(stat.mtimeMs).toISOString() : null,
      retiredPath: null,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    status: artifacts.some((artifact) => artifact.status === "stale")
      ? "stale-legacy-artifacts-found"
      : "no-stale-legacy-artifacts",
    meaning:
      "Legacy transfer-planner service-test artifacts are opt-in diagnostics only. Planner accuracy pass/fail is the source-backed-runtime-coverage gate.",
    trustedAccuracyGate: {
      label: "source-backed-runtime-coverage",
      jsonReport: getPlannerTmpPath("transfer-planner-source-backed-coverage-audit.json"),
      markdownReport: getPlannerTmpPath("transfer-planner-source-backed-coverage-audit.md"),
    },
    legacyDiagnosticEntryPoint: entryPointPath,
    legacyDiagnosticEntryPointLineCount: entryPointLineCount,
    artifacts,
  };
}

function buildRetiredArtifactPath(artifactPath) {
  const parsed = path.parse(artifactPath);
  let candidate = path.join(parsed.dir, `${parsed.name}.stale${parsed.ext}`);
  let index = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(parsed.dir, `${parsed.name}.stale-${index}${parsed.ext}`);
    index += 1;
  }

  return candidate;
}

function retireStaleLegacyServiceTestArtifacts(status, options = {}) {
  const retire = options.retire !== false;

  for (const artifact of status.artifacts) {
    if (!artifact.exists || artifact.status !== "stale") {
      continue;
    }

    const retiredPath = buildRetiredArtifactPath(artifact.path);
    artifact.retiredPath = retiredPath;
    artifact.status = retire ? "retired-stale" : "stale";

    if (retire) {
      fs.renameSync(artifact.path, retiredPath);
      artifact.exists = false;
    }
  }

  status.retiredArtifactCount = status.artifacts.filter(
    (artifact) => artifact.status === "retired-stale"
  ).length;
  status.status = status.retiredArtifactCount
    ? "stale-legacy-artifacts-retired"
    : status.status;

  return status;
}

function buildLegacyServiceTestArtifactStatusMarkdown(status) {
  const lines = [
    "# Legacy Transfer Planner Service-Test Artifact Status",
    "",
    `Generated: ${status.generatedAt}`,
    "",
    `- Status: ${status.status}`,
    `- Meaning: ${status.meaning}`,
    `- Trusted accuracy gate: ${status.trustedAccuracyGate.label}`,
    `- Trusted accuracy report: ${status.trustedAccuracyGate.markdownReport}`,
    `- Legacy diagnostic entry point: ${status.legacyDiagnosticEntryPoint}`,
    `- Current entry point lines: ${status.legacyDiagnosticEntryPointLineCount}`,
    `- Retired stale artifacts: ${status.retiredArtifactCount ?? 0}`,
    "",
    "## Artifacts",
    "",
    "| Artifact | Status | Reason | Retired Path | TAP Summary |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const artifact of status.artifacts) {
    const reasons = artifact.staleReasons.length ? artifact.staleReasons.join("; ") : "n/a";
    const tapSummary = artifact.tapSummary
      ? Object.entries(artifact.tapSummary)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ")
      : "n/a";
    lines.push(
      `| ${artifact.path} | ${artifact.status} | ${reasons.replace(/\|/g, "\\|")} | ${
        artifact.retiredPath ?? ""
      } | ${tapSummary} |`
    );
  }

  lines.push("");
  lines.push(
    "Use the source-backed coverage audit for planner accuracy. Run this legacy diagnostic only when investigating old service-test behavior."
  );
  lines.push("");

  return lines.join("\n");
}

function writeLegacyServiceTestArtifactStatus(status, options = {}) {
  const jsonPath = options.jsonPath ?? DEFAULT_STATUS_JSON_PATH;
  const markdownPath = options.markdownPath ?? DEFAULT_STATUS_MD_PATH;

  writePlannerJsonReport(jsonPath, status);
  writePlannerMarkdownReport(markdownPath, buildLegacyServiceTestArtifactStatusMarkdown(status));

  return {
    jsonPath,
    markdownPath,
  };
}

function refreshLegacyServiceTestArtifactStatus(options = {}) {
  ensurePlannerTmpLayout();
  let status = buildLegacyServiceTestArtifactStatus(options);

  status = retireStaleLegacyServiceTestArtifacts(status, {
    retire: options.retireStaleArtifacts !== false,
  });

  const output = writeLegacyServiceTestArtifactStatus(status, options);
  return {
    ...status,
    output,
  };
}

function main() {
  const status = refreshLegacyServiceTestArtifactStatus({
    retireStaleArtifacts: !process.argv.includes("--no-retire"),
  });

  console.log("Legacy transfer planner service-test artifact status:");
  console.log(`- Status: ${status.status}`);
  console.log(`- Trusted accuracy gate: ${status.trustedAccuracyGate.label}`);
  console.log(`- Retired stale artifacts: ${status.retiredArtifactCount ?? 0}`);
  console.log(`- Wrote ${status.output.jsonPath}`);
  console.log(`- Wrote ${status.output.markdownPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  LEGACY_SERVICE_TEST_ARTIFACT_FILENAMES,
  buildLegacyServiceTestArtifactStatus,
  buildLegacyServiceTestArtifactStatusMarkdown,
  refreshLegacyServiceTestArtifactStatus,
  retireStaleLegacyServiceTestArtifacts,
};
