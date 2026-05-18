#!/usr/bin/env node

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const NPM_CLI_PATH = process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)
  ? process.env.npm_execpath
  : null;
const NPX_CLI_PATH = NPM_CLI_PATH
  ? path.join(path.dirname(NPM_CLI_PATH), "npx-cli.js")
  : null;

function buildNpmInvocation(args) {
  if (NPM_CLI_PATH) {
    return {
      bin: process.execPath,
      args: [NPM_CLI_PATH, ...args],
    };
  }
  return {
    bin: process.platform === "win32" ? "npm.cmd" : "npm",
    args,
  };
}

function buildNpxInvocation(args) {
  if (NPX_CLI_PATH && fs.existsSync(NPX_CLI_PATH)) {
    return {
      bin: process.execPath,
      args: [NPX_CLI_PATH, ...args],
    };
  }
  return {
    bin: process.platform === "win32" ? "npx.cmd" : "npx",
    args,
  };
}

const STAGES = [
  {
    name: "source-backed-full",
    layer: "source-backed runtime coverage",
    group: "source-backed",
    command: "node scripts/planner/audit-transfer-planner-source-backed-coverage.cjs",
    args: ["scripts/planner/audit-transfer-planner-source-backed-coverage.cjs"],
    nextAction: "node scripts/planner/audit-transfer-planner-source-backed-coverage.cjs",
  },
  {
    name: "source-backed-mapping",
    layer: "mapping/equivalency coverage",
    group: "source-backed",
    command: "node scripts/planner/audit-transfer-planner-source-backed-coverage.cjs --mapping-only",
    args: ["scripts/planner/audit-transfer-planner-source-backed-coverage.cjs", "--mapping-only"],
    nextAction: "node scripts/planner/audit-transfer-planner-source-backed-coverage.cjs --mapping-only",
  },
  {
    name: "source-backed-generated-registry",
    layer: "generated registry shape",
    group: "source-backed",
    command: "node scripts/planner/audit-transfer-planner-source-backed-coverage.cjs --generated-registry-only",
    args: [
      "scripts/planner/audit-transfer-planner-source-backed-coverage.cjs",
      "--generated-registry-only",
    ],
    nextAction:
      "node scripts/planner/audit-transfer-planner-source-backed-coverage.cjs --generated-registry-only",
  },
  {
    name: "source-pipeline",
    layer: "source pipeline validation",
    group: "pipeline",
    command: "node scripts/planner/verify-transfer-planner-source-pipeline.cjs",
    args: ["scripts/planner/verify-transfer-planner-source-pipeline.cjs"],
    nextAction: "node scripts/planner/verify-transfer-planner-source-pipeline.cjs",
  },
  {
    name: "owner-audit",
    layer: "owner audit",
    group: "pipeline",
    command: "node scripts/planner/verify-transfer-planner-owner-audit.cjs",
    args: ["scripts/planner/verify-transfer-planner-owner-audit.cjs"],
    nextAction: "node scripts/planner/verify-transfer-planner-owner-audit.cjs",
  },
  {
    name: "parser-tests",
    layer: "parser/source-backed tests",
    group: "tests",
    command: "npm run planner:test:parser",
    ...buildNpmInvocation(["run", "planner:test:parser"]),
    nextAction: "npm run planner:test:parser",
  },
  {
    name: "source-discovery-tests",
    layer: "source discovery tests",
    group: "tests",
    command: "npm run planner:test:source-discovery",
    ...buildNpmInvocation(["run", "planner:test:source-discovery"]),
    nextAction: "npm run planner:test:source-discovery",
  },
  {
    name: "typescript",
    layer: "TypeScript static check",
    group: "static",
    command: "npx tsc --noEmit",
    ...buildNpxInvocation(["tsc", "--noEmit"]),
    nextAction: "npx tsc --noEmit",
  },
  {
    name: "lint",
    layer: "lint",
    group: "static",
    command: "npm run lint",
    ...buildNpmInvocation(["run", "lint"]),
    nextAction: "npm run lint",
  },
].map((stage) => ({
  bin: process.execPath,
  ...stage,
}));

const ONLY_GROUPS = new Map([
  ["source-backed", (stage) => stage.group === "source-backed"],
  ["coverage", (stage) => stage.group === "source-backed"],
  ["pipeline", (stage) => stage.group === "pipeline"],
  ["audits", (stage) => stage.group === "pipeline"],
  ["tests", (stage) => stage.group === "tests"],
  ["static", (stage) => stage.group === "static"],
  ["all", () => true],
]);

function readNpmBoolean(env, key) {
  const value = env[`npm_config_${key}`];
  return value === true || value === "true" || value === "1";
}

function readNpmValue(env, key) {
  const value = env[`npm_config_${key}`];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseArgs(argv, env = process.env) {
  const options = {
    continueOnError: readNpmBoolean(env, "continue_on_error"),
    dryRun: readNpmBoolean(env, "dry_run"),
    help: readNpmBoolean(env, "help") || readNpmBoolean(env, "h"),
    only: readNpmValue(env, "only"),
    startAt: readNpmValue(env, "start_at"),
  };
  const npmForwardedValues = new Set(
    [options.only, options.startAt].filter((value) => typeof value === "string" && value)
  );
  const runningViaNpm = Boolean(env.npm_lifecycle_event);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--continue-on-error") {
      options.continueOnError = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--only") {
      options.only = argv[index + 1] ?? null;
      index += 1;
    } else if (arg.startsWith("--only=")) {
      options.only = arg.slice("--only=".length);
    } else if (arg === "--start-at") {
      options.startAt = argv[index + 1] ?? null;
      index += 1;
    } else if (arg.startsWith("--start-at=")) {
      options.startAt = arg.slice("--start-at=".length);
    } else if (arg === "continue-on-error" || arg === "keep-going") {
      options.continueOnError = true;
    } else if (arg === "dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("from:")) {
      options.startAt = arg.slice("from:".length);
    } else if (runningViaNpm && npmForwardedValues.has(arg)) {
      // Some npm versions consume forwarded flags with values as npm config
      // and pass only the value through to the lifecycle script.
      continue;
    } else if (getOnlySelectors().includes(arg)) {
      options.only = arg;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function getStageNames() {
  return STAGES.map((stage) => stage.name);
}

function getOnlySelectors() {
  return [...ONLY_GROUPS.keys(), ...getStageNames()];
}

function selectStages(options) {
  let selected = [...STAGES];

  if (options.only) {
    const selector = String(options.only).trim();
    const groupPredicate = ONLY_GROUPS.get(selector);
    if (groupPredicate) {
      selected = selected.filter(groupPredicate);
    } else {
      selected = selected.filter((stage) => stage.name === selector);
    }

    if (!selected.length) {
      throw new Error(
        `Unknown --only selector "${selector}". Valid selectors: ${getOnlySelectors().join(", ")}`
      );
    }
  }

  if (options.startAt) {
    const startAt = String(options.startAt).trim();
    const index = selected.findIndex((stage) => stage.name === startAt);
    if (index === -1) {
      throw new Error(
        `Unknown --start-at stage "${startAt}" for the selected run. Valid stages: ${selected
          .map((stage) => stage.name)
          .join(", ")}`
      );
    }
    selected = selected.slice(index);
  }

  return selected;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return "";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function pad(value, width) {
  const text = String(value ?? "");
  return text.length >= width ? text : `${text}${" ".repeat(width - text.length)}`;
}

function printSummary(results) {
  const headers = ["Stage", "Status", "Duration", "Layer", "Next action"];
  const rows = results.map((result) => [
    result.stage.name,
    result.status,
    result.duration,
    result.stage.layer,
    result.status === "passed" ? "" : result.stage.nextAction,
  ]);
  const widths = headers.map((header, index) =>
    Math.min(
      Math.max(header.length, ...rows.map((row) => String(row[index] ?? "").length)),
      index === 4 ? 72 : 34
    )
  );

  console.log("\nSafe planner validation summary");
  console.log(headers.map((header, index) => pad(header, widths[index])).join(" | "));
  console.log(widths.map((width) => "-".repeat(width)).join("-|-"));
  for (const row of rows) {
    console.log(row.map((value, index) => pad(value, widths[index])).join(" | "));
  }
}

function printHelp() {
  console.log(`Safe transfer planner validation

Runs read-only planner validation gates one by one. This command does not run
refresh-transfer-planner-sources.cjs, does not invoke closed-loop auto-repair,
and does not modify generated planner artifacts.

Usage:
  npm run planner:validate:safe
  npm run planner:validate:safe -- keep-going
  npm run planner:validate:safe -- from:owner-audit
  npm run planner:validate:safe -- source-backed
  npm run planner:validate:safe -- tests
  npm run planner:validate:safe -- static

Direct node usage also supports:
  node scripts/planner/validate-transfer-planner-safe.cjs --continue-on-error
  node scripts/planner/validate-transfer-planner-safe.cjs --start-at owner-audit
  node scripts/planner/validate-transfer-planner-safe.cjs --only source-backed

Options:
  --continue-on-error  Run all selected stages and summarize all failures.
  --start-at <stage>   Resume at a stage within the selected stage list.
  --only <selector>    Run a stage group or single stage.
  --dry-run            Print selected stages without executing commands.
  --help               Show this help.

Npm-safe aliases:
  keep-going           Same as --continue-on-error.
  from:<stage>         Same as --start-at <stage>.
  <selector>           Same as --only <selector>.
  dry-run              Same as --dry-run.

Stages:
${STAGES.map((stage) => `  ${stage.name}: ${stage.command}`).join("\n")}

Selectors:
  ${getOnlySelectors().join(", ")}
`);
}

function runStage(stage, dryRun = false) {
  const startedAt = Date.now();
  console.log(`\n[${stage.name}] ${stage.command}`);
  console.log(`Layer: ${stage.layer}`);

  if (dryRun) {
    return {
      stage,
      status: "dry-run",
      exitCode: 0,
      duration: "0ms",
    };
  }

  const result = spawnSync(stage.bin, stage.args, {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });
  const exitCode = result.status ?? (result.error ? 1 : 0);
  const duration = formatDuration(Date.now() - startedAt);

  if (result.error) {
    console.error(`[${stage.name}] failed to start: ${result.error.message}`);
  }

  if (exitCode !== 0) {
    console.error(`\nStage failed: ${stage.name}`);
    console.error(`Command: ${stage.command}`);
    console.error(`Exit code: ${exitCode}`);
    console.error(`Likely layer: ${stage.layer}`);
    console.error(`Next narrow command: ${stage.nextAction}`);
  }

  return {
    stage,
    status: exitCode === 0 ? "passed" : "failed",
    exitCode,
    duration,
  };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return 0;
  }

  const selectedStages = selectStages(options);
  const results = [];

  console.log("Safe transfer planner validation");
  console.log("Auto-repair: disabled");
  console.log(`Stop on failure: ${options.continueOnError ? "no" : "yes"}`);
  console.log(`Stages: ${selectedStages.map((stage) => stage.name).join(", ")}`);

  for (const stage of selectedStages) {
    const result = runStage(stage, options.dryRun);
    results.push(result);
    if (result.exitCode !== 0 && !options.continueOnError) {
      break;
    }
  }

  printSummary(results);

  const failed = results.filter((result) => result.exitCode !== 0);
  if (failed.length) {
    console.error(`\nSafe planner validation failed: ${failed.length} stage(s) failed.`);
    return 1;
  }

  console.log("\nSafe planner validation passed.");
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  STAGES,
  getOnlySelectors,
  getStageNames,
  parseArgs,
  selectStages,
};
