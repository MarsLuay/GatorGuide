#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SOURCE_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_COMMAND_FILE = path.join(SOURCE_ROOT, ".tmp", "planner-major-spot-check-commands.md");
const BOOTSTRAP_MAJOR_PLANS_PATH = path.join(
  SOURCE_ROOT,
  "constants",
  "transfer-planner-source",
  "bootstrap.generated.ts"
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

function hasArg(...names) {
  const args = process.argv.slice(2);
  return names.some((name) => args.includes(name));
}

function getPositionalArgs() {
  const args = process.argv.slice(2);
  const positional = [];
  const valueFlags = new Set([
    "--target-plan-id",
    "--plan-id",
    "--target",
    "--campus-id",
    "--write-command-file",
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith("--")) {
      if (valueFlags.has(arg)) {
        index += 1;
      }
      continue;
    }
    positional.push(arg);
  }
  return positional;
}

function printUsageAndExit(exitCode = 1) {
  console.log(`Usage:
  node scripts/planner/spot-check-transfer-planner-major.cjs --list
  node scripts/planner/spot-check-transfer-planner-major.cjs --commands [--write-command-file]
  node scripts/planner/spot-check-transfer-planner-major.cjs --target-plan-id <plan-id> [--parse] [--assert] [--probe] [--refresh]

Options:
  --target-plan-id <plan-id>   Select one major to spot check.
  --campus-id <campus-id>      Filter --list or --commands output.
  --list                       List every spot-checkable major.
  --commands                   Print direct node commands for every major.
  --write-command-file [path]  Write the command list to .tmp/planner-major-spot-check-commands.md.
  --parse                      Run targeted requirement parsing for the selected major.
  --assert                     Assert the selected major exists in the current parse report.
  --probe                      Probe source links for the selected major.
  --refresh                    Run targeted source refresh for the selected major.
  --standard                   Run the normal low-risk spot check: --parse then --assert.

Examples:
  node scripts/planner/spot-check-transfer-planner-major.cjs --list
  node scripts/planner/spot-check-transfer-planner-major.cjs --commands --write-command-file
  node scripts/planner/spot-check-transfer-planner-major.cjs --target-plan-id uw-bothell-electrical-engineering --standard
`);
  process.exit(exitCode);
}

function shellQuote(value) {
  const text = String(value);
  return /[\s"\\]/u.test(text) ? `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : text;
}

function readTopLevelJsonArrayFromGeneratedTs(filePath, exportName) {
  const source = fs.readFileSync(filePath, "utf8");
  const exportIndex = source.indexOf(`export const ${exportName}`);
  if (exportIndex < 0) {
    throw new Error(`Could not find ${exportName} in ${filePath}.`);
  }
  const equalsIndex = source.indexOf("=", exportIndex);
  if (equalsIndex < 0) {
    throw new Error(`Could not find initializer for ${exportName}.`);
  }
  const arrayStart = source.indexOf("[", equalsIndex);
  if (arrayStart < 0) {
    throw new Error(`Could not find array initializer for ${exportName}.`);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = arrayStart; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(source.slice(arrayStart, index + 1));
      }
    }
  }
  throw new Error(`Could not parse array initializer for ${exportName}.`);
}

function getPlannerMajors(campusId = null) {
  const plans = readTopLevelJsonArrayFromGeneratedTs(
    BOOTSTRAP_MAJOR_PLANS_PATH,
    "TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS"
  );
  return plans
    .filter((plan) => !campusId || plan.campusId === campusId)
    .map((plan) => ({
      planId: plan.id,
      campusId: plan.campusId,
      title: plan.title,
      pathwayCount: Array.isArray(plan.pathways) ? plan.pathways.length : 0,
    }))
    .sort((left, right) => {
    const campusDelta = String(left.campusId).localeCompare(String(right.campusId));
    return campusDelta || String(left.title).localeCompare(String(right.title));
    });
}

function findMajor(planId) {
  return getPlannerMajors().find((major) => major.planId === planId) ?? null;
}

function buildDirectCommands(planId) {
  const quotedPlanId = shellQuote(planId);
  return [
    `node scripts/planner/parse-transfer-planner-requirement-sources.cjs --target-plan-id ${quotedPlanId}`,
    `node scripts/planner/assert-transfer-planner-owner-source.cjs --target-plan-id ${quotedPlanId} --all-owners`,
    `node scripts/planner/probe-transfer-planner-owner-source-links.cjs --target-plan-id ${quotedPlanId}`,
    `node scripts/planner/audit-transfer-planner-source-backed-coverage.cjs --target-plan-id ${quotedPlanId} --report-only`,
  ];
}

function printMajorList(majors) {
  console.log(`Planner majors: ${majors.length}`);
  for (const major of majors) {
    console.log(`${major.planId}\t${major.campusId}\t${major.pathwayCount}\t${major.title}`);
  }
}

function buildCommandMarkdown(majors) {
  const lines = [
    "# Planner Major Spot-Check Commands",
    "",
    "Run these from `source/`. Each block is targeted to one major and avoids full planner verification.",
    "",
  ];
  for (const major of majors) {
    lines.push(`## ${major.title}`);
    lines.push("");
    lines.push(`Plan id: \`${major.planId}\``);
    lines.push("");
    lines.push("```powershell");
    for (const command of buildDirectCommands(major.planId)) {
      lines.push(command);
    }
    lines.push("```");
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function printCommands(majors, writePath) {
  const markdown = buildCommandMarkdown(majors);
  if (writePath) {
    fs.mkdirSync(path.dirname(writePath), { recursive: true });
    fs.writeFileSync(writePath, markdown);
    console.log(`Wrote ${writePath}`);
    return;
  }
  process.stdout.write(markdown);
}

function runNode(args) {
  console.log(`\n> node ${args.map(shellQuote).join(" ")}`);
  const result = spawnSync(process.execPath, args, {
    cwd: SOURCE_ROOT,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runSelectedChecks(planId, phases) {
  if (phases.refresh) {
    runNode([
      "scripts/planner/refresh-transfer-planner-sources.cjs",
      "--target-plan-id",
      planId,
    ]);
  }
  if (phases.parse) {
    runNode([
      "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
      "--target-plan-id",
      planId,
    ]);
  }
  if (phases.assert) {
    runNode([
      "scripts/planner/assert-transfer-planner-owner-source.cjs",
      "--target-plan-id",
      planId,
      "--all-owners",
    ]);
  }
  if (phases.probe) {
    runNode([
      "scripts/planner/probe-transfer-planner-owner-source-links.cjs",
      "--target-plan-id",
      planId,
    ]);
  }
}

function main() {
  if (hasArg("--help", "-h")) {
    printUsageAndExit(0);
  }

  const positionalArgs = getPositionalArgs();
  const positionalCampusId = positionalArgs.find((arg) =>
    ["uw-bothell", "uw-seattle", "uw-tacoma"].includes(arg)
  );
  const campusId = getArgValue("--campus-id") ?? positionalCampusId;
  const planId =
    getArgValue("--target-plan-id", "--plan-id", "--target") ??
    (hasArg("--list", "--commands") ? null : positionalArgs[0]);
  const majors = getPlannerMajors(campusId);

  if (hasArg("--list")) {
    printMajorList(majors);
    return;
  }

  if (hasArg("--commands")) {
    const writeArg = getArgValue("--write-command-file");
    const shouldWrite = hasArg("--write-command-file");
    printCommands(majors, shouldWrite ? path.resolve(SOURCE_ROOT, writeArg ?? DEFAULT_COMMAND_FILE) : null);
    return;
  }

  if (!planId) {
    printUsageAndExit(1);
  }

  const major = findMajor(planId);
  if (!major) {
    throw new Error(
      `No planner major found for ${planId}. Run --list to see available plan ids.`
    );
  }

  const phases = {
    refresh: hasArg("--refresh") || positionalArgs.includes("refresh"),
    parse: hasArg("--parse", "--standard") || positionalArgs.includes("parse") || positionalArgs.includes("standard"),
    assert: hasArg("--assert", "--standard") || positionalArgs.includes("assert") || positionalArgs.includes("standard"),
    probe: hasArg("--probe") || positionalArgs.includes("probe"),
  };

  if (!phases.refresh && !phases.parse && !phases.assert && !phases.probe) {
    console.log(`${major.planId}\t${major.campusId}\t${major.title}`);
    console.log("");
    console.log("Direct commands:");
    for (const command of buildDirectCommands(major.planId)) {
      console.log(command);
    }
    return;
  }

  runSelectedChecks(major.planId, phases);
}

main();
