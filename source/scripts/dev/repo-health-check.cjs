#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");

function packagePath(...parts) {
  return path.join(projectRoot, "node_modules", ...parts);
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function walkFiles(rootPath, extensions, results = []) {
  if (!fileExists(rootPath)) {
    return results;
  }

  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, extensions, results);
      continue;
    }

    if (extensions.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results;
}

function makeSuccess(id, message, details = []) {
  return { id, ok: true, message, details };
}

function makeFailure(id, message, details = [], fix = []) {
  return { id, ok: false, message, details, fix };
}

function checkRequiredFiles() {
  const requiredPaths = [
    "package.json",
    "metro.config.js",
    "babel.config.js",
    "tailwind.config.js",
    path.join("services", "app", "config.ts"),
  ];

  const missing = requiredPaths.filter((relativePath) => {
    return !fileExists(path.join(projectRoot, relativePath));
  });

  if (!missing.length) {
    return makeSuccess(
      "required-files",
      "Required Expo and app config files are present."
    );
  }

  return makeFailure(
    "required-files",
    "Required project files are missing.",
    missing.map((relativePath) => `Missing: ${relativePath}`),
    ["Restore the missing files or re-checkout the source app folder."]
  );
}

function checkBabelCoreInstall() {
  const babelCoreRoot = packagePath("@babel", "core");
  const packageJsonPath = path.join(babelCoreRoot, "package.json");

  if (!fileExists(packageJsonPath)) {
    return makeFailure(
      "babel-core-present",
      "@babel/core is not installed.",
      [],
      ["Run `npm install` from `source`."]
    );
  }

  const suspiciousMatches = [];
  const filesToScan = [
    ...walkFiles(path.join(babelCoreRoot, "lib"), new Set([".js"])),
    ...walkFiles(path.join(babelCoreRoot, "src"), new Set([".ts", ".js"])),
  ];

  const suspiciousPattern = /@\/(?:app|components|constants|hooks|services|utils)\//;

  for (const filePath of filesToScan) {
    const contents = readText(filePath);
    if (!suspiciousPattern.test(contents)) {
      continue;
    }

    suspiciousMatches.push(path.relative(projectRoot, filePath));
    if (suspiciousMatches.length >= 6) {
      break;
    }
  }

  if (!suspiciousMatches.length) {
    const version = JSON.parse(readText(packageJsonPath)).version;
    return makeSuccess(
      "babel-core-clean",
      `@babel/core looks healthy (version ${version}).`
    );
  }

  return makeFailure(
    "babel-core-clean",
    "@babel/core appears to be contaminated with app-specific imports.",
    [
      "This usually means a local node_modules file was accidentally overwritten.",
      ...suspiciousMatches.map((match) => `Suspicious file: ${match}`),
    ],
    [
      "Run `Remove-Item -LiteralPath node_modules/@babel/core -Recurse -Force` in PowerShell.",
      "Then run `npm install @babel/core@7.29.0 --no-save` or `npm install`.",
    ]
  );
}

function checkMetroConfigLoad() {
  const metroConfigPath = path.join(projectRoot, "metro.config.js");
  const previousCwd = process.cwd();

  try {
    process.chdir(projectRoot);
    delete require.cache[require.resolve(metroConfigPath)];
    require(metroConfigPath);
    return makeSuccess(
      "metro-config-load",
      "Metro config loads from the project root."
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const details = [message];
    const fix = [];

    if (/tailwind\.config/i.test(message)) {
      fix.push("Make sure `tailwind.config.js` exists at the source project root.");
    }

    if (/@\/services\//.test(message) || /@babel\/core/.test(message)) {
      fix.push("Run `npm run health:repo` to confirm whether @babel/core is corrupted.");
    }

    fix.push("Re-run `npm install` if Metro config dependencies are missing.");

    return makeFailure(
      "metro-config-load",
      "Metro config could not be loaded from the project root.",
      details,
      fix
    );
  } finally {
    process.chdir(previousCwd);
  }
}

function runRepoHealthCheck() {
  const checks = [
    checkRequiredFiles(),
    checkBabelCoreInstall(),
    checkMetroConfigLoad(),
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

function printRepoHealthCheck(result) {
  const prefix = result.ok ? "[repo-health] PASS" : "[repo-health] FAIL";
  process.stdout.write(`${prefix}\n`);

  for (const check of result.checks) {
    const checkPrefix = check.ok ? "  [ok]" : "  [x]";
    process.stdout.write(`${checkPrefix} ${check.message}\n`);

    for (const detail of check.details || []) {
      process.stdout.write(`      - ${detail}\n`);
    }

    if (!check.ok && check.fix?.length) {
      process.stdout.write("      Fix:\n");
      for (const step of check.fix) {
        process.stdout.write(`      - ${step}\n`);
      }
    }
  }
}

module.exports = {
  runRepoHealthCheck,
  printRepoHealthCheck,
};

if (require.main === module) {
  const result = runRepoHealthCheck();
  printRepoHealthCheck(result);
  process.exit(result.ok ? 0 : 1);
}
