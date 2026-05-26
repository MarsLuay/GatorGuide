"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { PLANNER_ROOT, SOURCE_ROOT } = require("./lib/script-harness.cjs");

const COMPLETE_DIAGNOSTIC_TEST_PATTERN = /^uw-.*-complete-diagnostics\.test\.cjs$/;
const OPT_IN_ENV_PATTERN = /\bTRANSFER_PLANNER_RUN_[A-Z0-9_]+/g;
const ONLINE_TEST_NAME_PATTERN = /\bonline official UW course\b/i;

function hasArg(...names) {
  return process.argv.slice(2).some((arg) => names.includes(arg));
}

function getArgValues(...names) {
  const values = [];
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    for (const name of names) {
      const directPrefix = `${name}=`;
      if (arg.startsWith(directPrefix)) {
        const value = arg.slice(directPrefix.length).trim();
        if (value) values.push(value);
        break;
      }

      if (arg === name) {
        const value = args[index + 1];
        if (value && !value.startsWith("--")) {
          values.push(value.trim());
          index += 1;
        }
        break;
      }
    }
  }

  return values.filter(Boolean);
}

function getPositionalFilters() {
  const args = process.argv.slice(2);
  const valueFlags = new Set(["--file", "--test-file"]);
  const values = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith("--")) {
      const flag = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg;
      if (!arg.includes("=") && valueFlags.has(flag)) {
        index += 1;
      }
      continue;
    }
    values.push(arg);
  }

  return values;
}

function getCompleteDiagnosticTestFiles() {
  return fs
    .readdirSync(PLANNER_ROOT)
    .filter((file) => COMPLETE_DIAGNOSTIC_TEST_PATTERN.test(file))
    .sort((left, right) => left.localeCompare(right))
    .map((file) => path.join("scripts", "planner", file));
}

function filterRequestedTestFiles(testFiles) {
  const requested = [...getArgValues("--file", "--test-file"), ...getPositionalFilters()];
  if (requested.length === 0) return testFiles;

  const selected = [];
  const missing = [];

  for (const request of requested) {
    const normalizedRequest = request.replace(/\\/g, "/");
    const matches = testFiles.filter((testFile) =>
      testFile.replace(/\\/g, "/").includes(normalizedRequest)
    );
    if (matches.length === 0) {
      missing.push(request);
      continue;
    }
    selected.push(...matches);
  }

  if (missing.length > 0) {
    throw new Error(`No complete diagnostic test matched: ${missing.join(", ")}`);
  }

  return Array.from(new Set(selected));
}

function getOptInEnvVars(testFiles) {
  const envVars = new Set();

  for (const testFile of testFiles) {
    const source = fs.readFileSync(path.join(SOURCE_ROOT, testFile), "utf8");
    for (const match of source.matchAll(OPT_IN_ENV_PATTERN)) {
      envVars.add(match[0]);
    }
  }

  return Array.from(envVars).sort((left, right) => left.localeCompare(right));
}

function parseUnexpectedSkippedTests(output, options = {}) {
  const allowOnlineSkips = options.allowOnlineSkips ?? true;
  const unexpected = [];

  for (const line of String(output ?? "").split(/\r?\n/)) {
    const match = line.match(/^ok\s+\d+\s+-\s+(.+?)\s+#\s+SKIP\b/i);
    if (!match) continue;

    const testName = match[1].trim();
    if (allowOnlineSkips && ONLINE_TEST_NAME_PATTERN.test(testName)) {
      continue;
    }
    unexpected.push(testName);
  }

  return unexpected;
}

function runTestFile(testFile, env) {
  return new Promise((resolve) => {
    console.log(`\n# Running ${testFile}`);
    const child = spawn(
      process.execPath,
      [
        "--max-old-space-size=8192",
        "--test",
        "--test-concurrency=1",
        "--test-reporter=tap",
        testFile,
      ],
      {
        cwd: SOURCE_ROOT,
        env,
        windowsHide: true,
      }
    );
    let output = "";

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      output += text;
      process.stderr.write(text);
    });
    child.on("error", (error) => {
      output += `${error.message}\n`;
      console.error(error.message);
      resolve({ output, status: 1, testFile });
    });
    child.on("close", (status) => {
      resolve({ output, status: status ?? 1, testFile });
    });
  });
}

async function main() {
  const online = hasArg("--online", "--live");
  const listOnly = hasArg("--list", "--dry-run");
  const testFiles = filterRequestedTestFiles(getCompleteDiagnosticTestFiles());
  const optInEnvVars = getOptInEnvVars(testFiles);

  if (listOnly) {
    console.log(`Complete diagnostic test files: ${testFiles.length}`);
    for (const testFile of testFiles) console.log(`- ${testFile}`);
    console.log(`Opt-in env vars enabled by this runner: ${optInEnvVars.length}`);
    for (const envVar of optInEnvVars) console.log(`- ${envVar}=1`);
    console.log(`Live online official-source probes: ${online ? "enabled" : "disabled"}`);
    return;
  }

  const env = {
    ...process.env,
    TRANSFER_PLANNER_COMPLETE_DIAGNOSTICS_ONLINE: online ? "1" : "0",
  };
  for (const envVar of optInEnvVars) {
    env[envVar] = "1";
  }

  const unexpectedSkips = [];
  const failures = [];

  for (const testFile of testFiles) {
    const result = await runTestFile(testFile, env);
    if (result.status !== 0) {
      failures.push({ testFile: result.testFile, status: result.status });
    }
    unexpectedSkips.push(
      ...parseUnexpectedSkippedTests(result.output, {
        allowOnlineSkips: !online,
      }).map((testName) => `${result.testFile}: ${testName}`)
    );
  }

  if (failures.length > 0) {
    console.error(
      `Complete diagnostics failed in ${failures.length} file(s): ${failures
        .map((failure) => `${failure.testFile} (${failure.status})`)
        .join(", ")}`
    );
    process.exit(1);
  }

  if (unexpectedSkips.length > 0) {
    console.error(
      [
        `Complete diagnostics left ${unexpectedSkips.length} unexpected skipped test(s).`,
        "This runner enables every TRANSFER_PLANNER_RUN_* opt-in flag; only live online probes may skip in offline mode.",
        `Skipped: ${unexpectedSkips.slice(0, 40).join(" | ")}`,
      ].join("\n")
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  filterRequestedTestFiles,
  getCompleteDiagnosticTestFiles,
  getOptInEnvVars,
  parseUnexpectedSkippedTests,
};
