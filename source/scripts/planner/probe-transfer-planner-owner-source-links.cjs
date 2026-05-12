#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const parser = require("./parse-transfer-planner-requirement-sources.cjs");

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

function splitValues(values) {
  return values.flatMap((value) =>
    String(value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function printUsageAndExit(exitCode = 1) {
  console.log(`Usage:
  node scripts/planner/probe-transfer-planner-owner-source-links.cjs --target-plan-id <plan-id> [checks]

Checks:
  --owner-id <owner-id>                              Select a specific owner instead of a plan.
  --pathway-id <pathway-id>                          Select a pathway owner under the target plan.
  --source-url <url>                                 Probe an explicit source URL for the selected owner.
  --html-file <path>                                 Use local HTML instead of fetching the source URL.
  --expect-document-url-contains B-EE-Curriculum     Require a recovered document candidate URL.
  --expect-document-label-contains "EE degree"       Require a recovered document candidate label.
  --expect-min-document-candidates 1                 Require at least N document candidates.
  --expect-title-acronym-match                       Require at least one candidate matched by owner acronym.
  --timeout-ms 30000                                 Fetch timeout.

Examples:
  npm run planner:probe-owner-source-links -- --target-plan-id uw-bothell-electrical-engineering --expect-document-url-contains B-EE-Curriculum --expect-title-acronym-match
  npm run planner:probe-owner-source-links -- --target-plan-id uw-bothell-electrical-engineering --html-file .tmp/source.html --expect-document-url-contains B-EE-Curriculum
`);
  process.exit(exitCode);
}

function selectEntry(input) {
  const entries = parser.getParseablePrimaryEntries(input.targetPlanId);
  let candidates = entries;

  if (input.ownerId) {
    candidates = candidates.filter((entry) => entry.ownerId === input.ownerId);
  }
  if (input.pathwayId != null) {
    candidates = candidates.filter((entry) => String(entry.pathwayId ?? "") === input.pathwayId);
  }

  if (!candidates.length) {
    throw new Error(
      `No parseable source entry matched ${input.ownerId ?? input.targetPlanId ?? "(missing target)"}.`
    );
  }

  const directMajor = candidates.filter(
    (entry) => entry.ownerId === input.targetPlanId && entry.pathwayId == null
  );
  if (directMajor.length === 1) {
    return directMajor[0];
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  const labels = candidates
    .slice(0, 12)
    .map((entry) => `- ${entry.ownerId}${entry.pathwayId ? ` (${entry.pathwayId})` : ""}`)
    .join("\n");
  throw new Error(`Multiple entries matched. Pass --owner-id or --pathway-id.\n${labels}`);
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "GatorGuide planner source probe",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function readHtml(input, sourceUrl) {
  if (input.htmlFile) {
    return fs.readFileSync(path.resolve(input.htmlFile), "utf8");
  }
  return fetchText(sourceUrl, input.timeoutMs);
}

function candidateMatchesText(candidate, field, expectedText) {
  return String(candidate[field] ?? "").toLowerCase().includes(expectedText.toLowerCase());
}

async function main() {
  if (hasArg("--help") || hasArg("-h")) {
    printUsageAndExit(0);
  }

  const input = {
    ownerId: getArgValue("--owner-id"),
    targetPlanId: getArgValue("--target-plan-id", "--plan-id", "--target"),
    pathwayId: getArgValue("--pathway-id"),
    sourceUrl: getArgValue("--source-url"),
    htmlFile: getArgValue("--html-file"),
    expectDocumentUrlContains: splitValues(getArgValues("--expect-document-url-contains")),
    expectDocumentLabelContains: splitValues(getArgValues("--expect-document-label-contains")),
    expectMinDocumentCandidates: getArgValue("--expect-min-document-candidates"),
    expectTitleAcronymMatch: hasArg("--expect-title-acronym-match"),
    timeoutMs: Number.parseInt(getArgValue("--timeout-ms") ?? "30000", 10),
  };

  if (!input.targetPlanId && !input.ownerId) {
    printUsageAndExit(1);
  }
  if (!Number.isFinite(input.timeoutMs) || input.timeoutMs <= 0) {
    throw new Error(`Invalid --timeout-ms value: ${input.timeoutMs}`);
  }

  const entry = selectEntry(input);
  const sourceUrl = input.sourceUrl ?? entry.url;
  const html = await readHtml(input, sourceUrl);
  const probeEntry = {
    ...entry,
    url: sourceUrl,
  };
  const candidates = parser.extractSupplementalDocumentLinkCandidatesForTest(probeEntry, html);
  const failures = [];

  if (input.expectMinDocumentCandidates != null) {
    const minimum = Number.parseInt(input.expectMinDocumentCandidates, 10);
    if (!Number.isFinite(minimum)) {
      throw new Error(
        `Invalid --expect-min-document-candidates value: ${input.expectMinDocumentCandidates}`
      );
    }
    if (candidates.length < minimum) {
      failures.push(`expected at least ${minimum} document candidate(s), found ${candidates.length}`);
    }
  }

  for (const expectedText of input.expectDocumentUrlContains) {
    if (!candidates.some((candidate) => candidateMatchesText(candidate, "url", expectedText))) {
      failures.push(`no document candidate URL contains "${expectedText}"`);
    }
  }

  for (const expectedText of input.expectDocumentLabelContains) {
    if (!candidates.some((candidate) => candidateMatchesText(candidate, "label", expectedText))) {
      failures.push(`no document candidate label contains "${expectedText}"`);
    }
  }

  if (
    input.expectTitleAcronymMatch &&
    !candidates.some((candidate) => candidate.titleAcronymMatch === true)
  ) {
    failures.push("no document candidate had titleAcronymMatch=true");
  }

  console.log(`Owner: ${entry.ownerId}`);
  console.log(`Title: ${entry.ownerTitle ?? "n/a"}`);
  console.log(`Source: ${sourceUrl}`);
  console.log(`Document candidates: ${candidates.length}`);
  for (const candidate of candidates) {
    console.log(
      `- ${candidate.label} | ${candidate.url} | score=${candidate.score} | exactTitle=${Boolean(
        candidate.exactTitleMatch
      )} | acronym=${Boolean(candidate.titleAcronymMatch)}`
    );
  }

  if (failures.length) {
    console.error("Source link probe failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Source link probe passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
