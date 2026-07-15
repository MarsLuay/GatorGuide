#!/usr/bin/env node
"use strict";

/**
 * Cross-platform Course Planner maintenance (bat `maintenance` mode).
 * Used when PowerShell is unavailable or cannot start (e.g. CoreCLR OOM).
 *
 * Mirrors: run-transfer-planner-maintenance.ps1 -NoPrompt -RunPostChecks
 * Windows QA / Playwright Chromium are skipped unless --windows-qa.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));
const skipDownloads = args.has("--skip-downloads");
const skipVerify = args.has("--skip-verify");
const skipHardening = args.has("--skip-hardening");
const windowsQa = args.has("--windows-qa");
const refreshOnly = args.has("--refresh-only");

/** health:repo ids that npm install can plausibly fix */
const INSTALL_RELATED_HEALTH_IDS = new Set([
  "babel-core-present",
  "babel-core-clean",
  "metro-config-load",
  "required-files",
]);

/** Known emulator/debug logs health:repo rejects in source root */
const AUTO_MOVE_ROOT_SCRATCH = /^(?:firebase|firestore|storage)-debug\.log$/i;

function log(msg) {
  console.log(`[maintenance] ${msg}`);
}

function fail(msg, code = 1) {
  console.error(`[maintenance] ${msg}`);
  process.exit(code);
}

function run(command, commandArgs, { cwd = projectRoot, env = process.env } = {}) {
  log(`$ ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    cwd,
    env,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    fail(`${command} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${command} exited with code ${result.status ?? "unknown"}`, result.status || 1);
  }
}

function commandExists(command) {
  const probe = spawnSync(command, ["--version"], { stdio: "ignore", shell: false });
  return !probe.error && probe.status === 0;
}

function moveKnownRootScratchLogs() {
  const scratchDir = path.join(projectRoot, ".tmp", "scratch");
  let moved = 0;
  let entries;
  try {
    entries = fs.readdirSync(projectRoot, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !AUTO_MOVE_ROOT_SCRATCH.test(entry.name)) {
      continue;
    }
    fs.mkdirSync(scratchDir, { recursive: true });
    const src = path.join(projectRoot, entry.name);
    const dest = path.join(scratchDir, entry.name);
    try {
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
      }
      fs.renameSync(src, dest);
      log(`Moved ${entry.name} -> .tmp/scratch/${entry.name}`);
      moved += 1;
    } catch (error) {
      log(`Could not move ${entry.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return moved;
}

function runHealthCheck() {
  const health = require("./dev/repo-health-check.cjs");
  const result = health.runRepoHealthCheck();
  health.printRepoHealthCheck(result);
  return result;
}

function failedHealthIds(result) {
  return result.checks.filter((check) => !check.ok).map((check) => check.id);
}

function ensureDeps() {
  const nodeModules = path.join(projectRoot, "node_modules");
  if (!fs.existsSync(nodeModules)) {
    log("node_modules missing; running npm install...");
    run("npm", ["install"]);
  }

  moveKnownRootScratchLogs();
  let result = runHealthCheck();
  if (result.ok) {
    return;
  }

  const failedIds = failedHealthIds(result);
  const installRelated = failedIds.some((id) => INSTALL_RELATED_HEALTH_IDS.has(id));
  if (!installRelated) {
    fail(
      `health:repo failed with non-install issues (npm install will not help): ${failedIds.join(", ")}. ` +
        "Move scratch files into .tmp/scratch/, run `npm run tmp:organize`, then retry."
    );
  }

  log("health:repo failed with install-related issues; repairing with npm install (one attempt)...");
  run("npm", ["install"]);
  moveKnownRootScratchLogs();
  result = runHealthCheck();
  if (!result.ok) {
    fail(
      `health:repo still failing after npm install: ${failedHealthIds(result).join(", ")}. ` +
        "Fix the reported checks before retrying maintenance."
    );
  }
}

function main() {
  if (!commandExists("node") || !commandExists("npm")) {
    fail("Node.js and npm are required.");
  }

  process.chdir(projectRoot);
  log(`Project: ${projectRoot}`);
  ensureDeps();

  const refreshArgs = ["scripts/planner/refresh-transfer-planner-sources.cjs"];
  if (skipDownloads) refreshArgs.push("--skip-downloads");
  if (skipVerify) refreshArgs.push("--skip-verify");

  run("node", refreshArgs);

  if (refreshOnly) {
    log("Refresh-only mode complete.");
    return;
  }

  if (windowsQa) {
    run("npx", ["playwright", "install", "chromium"]);
    run("npm", ["run", "qa:windows:ci"]);
  } else {
    log("Skipping Windows QA / Playwright (use --windows-qa to enable).");
  }

  if (!skipHardening) {
    run("node", ["scripts/planner/verify-transfer-planner-hardening.cjs"]);
  }

  log("Success. Planner maintenance finished cleanly.");
}

main();
