const { spawnSync } = require("node:child_process");
const path = require("node:path");
const {
  ensureTmpLayout,
  getTmpPath,
  resolveTmpPath,
} = require("../../lib/tmp-layout.cjs");
const {
  writeJsonReport,
  writeMarkdownReport,
  writeReportPair,
} = require("./planner-reporting.cjs");

const PLANNER_ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.resolve(PLANNER_ROOT, "..", "..");
const NPM_BIN = process.platform === "win32" ? "npm.cmd" : "npm";
const NPX_BIN = process.platform === "win32" ? "npx.cmd" : "npx";

function getArgs(argv = process.argv.slice(2)) {
  return Array.from(argv);
}

function normalizeFlags(flagOrFlags) {
  return Array.isArray(flagOrFlags) ? flagOrFlags : [flagOrFlags];
}

function hasArg(flagOrFlags, argv = process.argv.slice(2)) {
  const args = getArgs(argv);
  return normalizeFlags(flagOrFlags).some((flag) => args.includes(flag));
}

function getArgValue(flagOrFlags, argv = process.argv.slice(2)) {
  const args = getArgs(argv);
  for (const flag of normalizeFlags(flagOrFlags)) {
    const directPrefix = `${flag}=`;
    const directMatch = args.find((arg) => arg.startsWith(directPrefix));
    if (directMatch) {
      return directMatch.slice(directPrefix.length).trim() || null;
    }

    const flagIndex = args.indexOf(flag);
    if (flagIndex === -1) {
      continue;
    }

    const nextValue = args[flagIndex + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      return null;
    }

    return String(nextValue).trim() || null;
  }

  return null;
}

function getArgValues(flagOrFlags, argv = process.argv.slice(2)) {
  const args = getArgs(argv);
  const flags = normalizeFlags(flagOrFlags);
  const values = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    for (const flag of flags) {
      const directPrefix = `${flag}=`;
      if (arg.startsWith(directPrefix)) {
        const value = arg.slice(directPrefix.length).trim();
        if (value) values.push(value);
        break;
      }

      if (arg === flag) {
        const nextValue = args[index + 1];
        if (nextValue && !nextValue.startsWith("--")) {
          values.push(String(nextValue).trim());
          index += 1;
        }
        break;
      }
    }
  }

  return values.filter(Boolean);
}

function getPositionalArgs(options = {}, argv = process.argv.slice(2)) {
  const args = getArgs(argv);
  const valueFlags = new Set(options.valueFlags ?? []);
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith("--")) {
      const flag = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg;
      if (!arg.includes("=") && valueFlags.has(flag)) {
        index += 1;
      }
      continue;
    }
    positional.push(arg);
  }

  return positional;
}

function ensurePlannerTmpLayout() {
  return ensureTmpLayout(SOURCE_ROOT);
}

function getPlannerTmpPath(...segments) {
  return getTmpPath(SOURCE_ROOT, ...segments);
}

function resolvePlannerTmpPath(...segments) {
  return resolveTmpPath(SOURCE_ROOT, ...segments);
}

function writePlannerJsonReport(fileNameOrPath, report) {
  writeJsonReport(path.resolve(SOURCE_ROOT, fileNameOrPath), report);
}

function writePlannerMarkdownReport(fileNameOrPath, markdownOrLines) {
  writeMarkdownReport(path.resolve(SOURCE_ROOT, fileNameOrPath), markdownOrLines);
}

function writePlannerReportPair(input) {
  writeReportPair({
    jsonPath: path.resolve(SOURCE_ROOT, input.jsonPath),
    markdownPath: path.resolve(SOURCE_ROOT, input.markdownPath),
    report: input.report,
    markdown: input.markdown,
  });
}

function runCommand(command, args = [], options = {}) {
  const {
    cwd = SOURCE_ROOT,
    env,
    errorMessage = `Command failed: ${command} ${args.join(" ")}`,
    stdio = "inherit",
    throwOnFailure = true,
    ...spawnOptions
  } = options;
  const isWindowsCmd = process.platform === "win32" && /\.cmd$/i.test(command);
  const result = spawnSync(
    isWindowsCmd ? "cmd" : command,
    isWindowsCmd ? ["/c", command, ...args] : args,
    {
      cwd,
      stdio,
      env: env ? { ...process.env, ...env } : process.env,
      shell: false,
      windowsHide: true,
      ...spawnOptions,
    }
  );

  if (throwOnFailure && result.status !== 0) {
    throw new Error(errorMessage);
  }

  return result;
}

function runNodeScript(scriptPath, args = [], options = {}) {
  const { errorMessage = `Node script failed: ${scriptPath}`, ...runOptions } = options;
  return runCommand(process.execPath, [scriptPath, ...args], {
    errorMessage,
    ...runOptions,
  });
}

module.exports = {
  NPM_BIN,
  NPX_BIN,
  PLANNER_ROOT,
  SOURCE_ROOT,
  ensurePlannerTmpLayout,
  getArgValue,
  getArgValues,
  getArgs,
  getPlannerTmpPath,
  getPositionalArgs,
  hasArg,
  resolvePlannerTmpPath,
  runCommand,
  runNodeScript,
  writePlannerJsonReport,
  writePlannerMarkdownReport,
  writePlannerReportPair,
};
