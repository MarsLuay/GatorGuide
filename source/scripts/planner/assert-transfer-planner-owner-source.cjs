#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const SOURCE_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_REPORT_PATH = path.join(
  SOURCE_ROOT,
  ".tmp",
  "transfer-planner-requirement-source-parse-report.json"
);

function getArgValue(...names) {
  const args = process.argv.slice(2);
  for (const name of names) {
    const index = args.indexOf(name);
    if (index >= 0) {
      return args[index + 1] ?? null;
    }
    const prefix = `${name}=`;
    const inline = args.find((arg) => arg.startsWith(prefix));
    if (inline) {
      return inline.slice(prefix.length);
    }
  }
  return null;
}

function getArgValues(...names) {
  const args = process.argv.slice(2);
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    for (const name of names) {
      if (arg === name && args[index + 1] != null) {
        values.push(args[index + 1]);
      }
      const prefix = `${name}=`;
      if (arg.startsWith(prefix)) {
        values.push(arg.slice(prefix.length));
      }
    }
  }
  return values;
}

function hasArg(name) {
  return process.argv.slice(2).includes(name);
}

function printUsageAndExit(exitCode = 1) {
  console.log(`Usage:
  node scripts/planner/assert-transfer-planner-owner-source.cjs --target-plan-id <plan-id> [checks]

Checks:
  --owner-id <owner-id>                         Select a specific owner instead of a plan.
  --pathway-id <pathway-id>                     Select a pathway owner under the target plan.
  --expect-codes "BEE 200,BPHYS 121"            Require exact parsed UW course codes.
  --expect-prefixes BEE:1,BPHYS:1,STMATH:1      Require at least N parsed codes by subject prefix.
  --expect-min-parsed-codes 20                  Require a minimum parsed UW course count.
  --expect-source-url-contains B-EE-Curriculum  Require the owner source URL to contain text.
  --expect-covered-url-contains B-EE-Curriculum Require a covered source URL to contain text.
  --expect-snapshot-contains "B EE 200"         Require the owner snapshot text to contain text.
  --expect-any-owner-snapshot-contains "B EE"   Search all snapshot files for this owner id.
  --expect-resolution-strategy primary-source   Require a specific resolution strategy.
  --expect-no-quality-warnings                  Fail if warning-severity quality signals are present.
  --report .tmp/custom-report.json              Read a non-default parse report.

Examples:
  npm run planner:assert-owner-source -- --target-plan-id uw-bothell-electrical-engineering --expect-prefixes BEE:1,BPHYS:1,STMATH:1
  npm run planner:assert-owner-source -- --target-plan-id uw-bothell-electrical-engineering --expect-codes "BEE 200,BEE 215"
`);
  process.exit(exitCode);
}

function splitList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitValues(values) {
  return values.flatMap((value) => splitList(value));
}

function normalizeCourseCode(value) {
  const normalized = String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  const match = normalized.match(/^([A-Z&]+(?:\s+[A-Z&]+)*)\s*(\d{3}[A-Z]?)$/);
  return match ? `${match[1].replace(/\s+/g, "")} ${match[2]}` : normalized;
}

function normalizeSubject(value) {
  return String(value ?? "")
    .replace(/[^A-Za-z&]+/g, "")
    .toUpperCase();
}

function getCourseSubject(courseCode) {
  const match = normalizeCourseCode(courseCode).match(/^(.+?)\s+\d{3}[A-Z]?$/);
  return match ? normalizeSubject(match[1]) : "";
}

function parsePrefixSpecs(value) {
  return splitList(value).map((spec) => {
    const match = spec.match(/^([^:=]+)(?::|=)?(\d+)?$/);
    if (!match) {
      throw new Error(`Invalid prefix expectation "${spec}". Use PREFIX or PREFIX:N.`);
    }
    return {
      prefix: normalizeSubject(match[1]),
      minCount: match[2] ? Number.parseInt(match[2], 10) : 1,
      raw: spec,
    };
  });
}

function readReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    throw new Error(
      `Parse report not found: ${reportPath}\nRun planner:parse-requirements:target first, or pass --report.`
    );
  }
  return JSON.parse(fs.readFileSync(reportPath, "utf8"));
}

function readTextIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

function getOwnerSnapshotSearchText(owner) {
  const snapshotParts = [];
  if (owner.snapshotPath) {
    snapshotParts.push(readTextIfExists(owner.snapshotPath));
  }
  return snapshotParts.join("\n");
}

function getAnyOwnerSnapshotSearchText(owner) {
  const snapshotDir = path.join(
    SOURCE_ROOT,
    ".tmp",
    "transfer-planner-requirement-source-snapshots"
  );
  if (!fs.existsSync(snapshotDir)) {
    return "";
  }
  const ownerPrefix = `${owner.ownerId}`;
  return fs
    .readdirSync(snapshotDir)
    .filter((entry) => entry === `${ownerPrefix}.txt` || entry.startsWith(`${ownerPrefix}-`))
    .map((entry) => readTextIfExists(path.join(snapshotDir, entry)))
    .join("\n");
}

function selectOwner(report, input) {
  const owners = Array.isArray(report.owners) ? report.owners : [];
  if (input.ownerId) {
    const owner = owners.find((candidate) => candidate.ownerId === input.ownerId);
    if (!owner) {
      throw new Error(`No owner found for --owner-id ${input.ownerId}.`);
    }
    return owner;
  }

  if (!input.targetPlanId) {
    printUsageAndExit(1);
  }

  let candidates = owners.filter((owner) => owner.planId === input.targetPlanId);
  if (input.pathwayId != null) {
    candidates = candidates.filter((owner) => String(owner.pathwayId ?? "") === input.pathwayId);
  }

  if (!candidates.length) {
    throw new Error(`No owner found for --target-plan-id ${input.targetPlanId}.`);
  }

  const directMajor = candidates.filter(
    (owner) => owner.ownerId === input.targetPlanId && owner.pathwayId == null
  );
  if (directMajor.length === 1) {
    return directMajor[0];
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  const candidateLabels = candidates
    .slice(0, 12)
    .map((owner) => `- ${owner.ownerId}${owner.pathwayId ? ` (${owner.pathwayId})` : ""}`)
    .join("\n");
  throw new Error(
    `Multiple owners matched ${input.targetPlanId}. Pass --owner-id or --pathway-id.\n${candidateLabels}`
  );
}

function main() {
  if (hasArg("--help") || hasArg("-h")) {
    printUsageAndExit(0);
  }

  const input = {
    ownerId: getArgValue("--owner-id"),
    targetPlanId: getArgValue("--target-plan-id", "--plan-id", "--target"),
    pathwayId: getArgValue("--pathway-id"),
    expectCodes: splitList(getArgValue("--expect-codes")),
    expectPrefixes: parsePrefixSpecs(getArgValue("--expect-prefixes")),
    expectMinParsedCodes: getArgValue("--expect-min-parsed-codes"),
    expectSourceUrlContains: splitValues(getArgValues("--expect-source-url-contains")),
    expectCoveredUrlContains: splitValues(getArgValues("--expect-covered-url-contains")),
    expectSnapshotContains: splitValues(getArgValues("--expect-snapshot-contains")),
    expectAnyOwnerSnapshotContains: splitValues(getArgValues("--expect-any-owner-snapshot-contains")),
    expectResolutionStrategy: getArgValue("--expect-resolution-strategy"),
    expectNoQualityWarnings: hasArg("--expect-no-quality-warnings"),
    reportPath: path.resolve(SOURCE_ROOT, getArgValue("--report") ?? DEFAULT_REPORT_PATH),
  };

  const report = readReport(input.reportPath);
  const owner = selectOwner(report, input);
  const parsedCodes = new Set((owner.parsedUwCourseCodes ?? []).map(normalizeCourseCode));
  const parsedCodeList = [...parsedCodes];
  const failures = [];

  for (const expectedCode of input.expectCodes.map(normalizeCourseCode)) {
    if (!parsedCodes.has(expectedCode)) {
      failures.push(`missing parsed UW course code ${expectedCode}`);
    }
  }

  for (const spec of input.expectPrefixes) {
    const count = parsedCodeList.filter((courseCode) =>
      getCourseSubject(courseCode).startsWith(spec.prefix)
    ).length;
    if (count < spec.minCount) {
      failures.push(`expected ${spec.raw} parsed code(s), found ${count}`);
    }
  }

  if (input.expectMinParsedCodes != null) {
    const minimum = Number.parseInt(input.expectMinParsedCodes, 10);
    if (!Number.isFinite(minimum)) {
      throw new Error(`Invalid --expect-min-parsed-codes value: ${input.expectMinParsedCodes}`);
    }
    if (parsedCodeList.length < minimum) {
      failures.push(`expected at least ${minimum} parsed UW course codes, found ${parsedCodeList.length}`);
    }
  }

  for (const expectedSourceText of input.expectSourceUrlContains) {
    if (!String(owner.sourceUrl ?? "").includes(expectedSourceText)) {
      failures.push(`sourceUrl does not contain "${expectedSourceText}"`);
    }
  }

  for (const expectedCoveredUrlText of input.expectCoveredUrlContains) {
    const coveredSourceUrls = owner.coveredSourceUrls ?? [];
    if (!coveredSourceUrls.some((url) => String(url).includes(expectedCoveredUrlText))) {
      failures.push(`no covered source URL contains "${expectedCoveredUrlText}"`);
    }
  }

  if (input.expectSnapshotContains.length) {
    const snapshotText = getOwnerSnapshotSearchText(owner);
    for (const expectedSnapshotText of input.expectSnapshotContains) {
      if (!snapshotText.includes(expectedSnapshotText)) {
        failures.push(`owner snapshot does not contain "${expectedSnapshotText}"`);
      }
    }
  }

  if (input.expectAnyOwnerSnapshotContains.length) {
    const snapshotText = getAnyOwnerSnapshotSearchText(owner);
    for (const expectedSnapshotText of input.expectAnyOwnerSnapshotContains) {
      if (!snapshotText.includes(expectedSnapshotText)) {
        failures.push(`no ${owner.ownerId} snapshot file contains "${expectedSnapshotText}"`);
      }
    }
  }

  if (
    input.expectResolutionStrategy &&
    owner.resolutionStrategy !== input.expectResolutionStrategy
  ) {
    failures.push(
      `resolutionStrategy is ${owner.resolutionStrategy ?? "n/a"}, expected ${input.expectResolutionStrategy}`
    );
  }

  const qualityWarnings = (owner.qualitySignals ?? []).filter(
    (signal) => signal.severity === "warning"
  );
  if (input.expectNoQualityWarnings && qualityWarnings.length) {
    failures.push(
      `expected no quality warnings, found ${qualityWarnings.map((signal) => signal.code).join(", ")}`
    );
  }

  console.log(`Owner: ${owner.ownerId}`);
  console.log(`Title: ${owner.ownerTitle ?? "n/a"}`);
  console.log(`Source: ${owner.sourceUrl ?? "n/a"}`);
  console.log(`Resolution: ${owner.resolutionStrategy ?? "n/a"}`);
  console.log(`Parsed UW course codes: ${parsedCodeList.length}`);
  if (owner.snapshotPath) {
    console.log(`Snapshot: ${owner.snapshotPath}`);
  }
  if (qualityWarnings.length) {
    console.log(`Quality warnings: ${qualityWarnings.map((signal) => signal.code).join(", ")}`);
  }

  if (failures.length) {
    console.error("Source assertion failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Source assertion passed.");
}

main();
