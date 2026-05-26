#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..", "..");

const ignoredDirectoryNames = new Set([
  ".expo",
  ".git",
  ".tmp",
  ".tools",
  "coverage",
  "dist",
  "docs",
  "functions",
  "logs",
  "node_modules",
  "scripts",
]);

const ignoredGeneratedDirectoryPatterns = [
  /\.generated(?:[\\/]|$)/,
  /transfer-planner-source[\\/]student-runtime\.generated(?:[\\/]|$)/,
];

const testFilePattern = /(?:^|[\\/])[^\\/]+\.(?:test|spec)\.(?:cjs|js|mjs|ts|tsx)$/;
const typeScriptTestPattern = /\.(?:ts|tsx)$/;

function toRelativePath(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function shouldSkipDirectory(directoryPath, directoryName) {
  if (ignoredDirectoryNames.has(directoryName)) {
    return true;
  }

  const relativePath = toRelativePath(directoryPath);
  return ignoredGeneratedDirectoryPatterns.some((pattern) => pattern.test(relativePath));
}

function shouldSkipFile(filePath) {
  const relativePath = toRelativePath(filePath);
  return /\.generated\./.test(relativePath);
}

function collectTestFiles(directoryPath, testFiles = []) {
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (!shouldSkipDirectory(entryPath, entry.name)) {
        collectTestFiles(entryPath, testFiles);
      }
      continue;
    }

    if (entry.isFile() && testFilePattern.test(entryPath) && !shouldSkipFile(entryPath)) {
      testFiles.push(entryPath);
    }
  }

  return testFiles;
}

const testFiles = collectTestFiles(projectRoot)
  .map(toRelativePath)
  .sort((left, right) => left.localeCompare(right));

if (testFiles.length === 0) {
  console.error("No app test files were discovered.");
  process.exit(1);
}

const passThroughArgs = process.argv.slice(2);
const requiresTypeScriptLoader = testFiles.some((filePath) => typeScriptTestPattern.test(filePath));
const loaderArgs = requiresTypeScriptLoader
  ? ["--require", "ts-node/register/transpile-only", "--require", "tsconfig-paths/register"]
  : [];

const compilerOptions = {
  module: "CommonJS",
  moduleResolution: "node",
  jsx: "react-jsx",
  baseUrl: ".",
  paths: {
    "@/*": ["./*"],
  },
};

console.log(`Running ${testFiles.length} app test file(s):`);
for (const testFile of testFiles) {
  console.log(`- ${testFile}`);
}

const result = spawnSync(
  process.execPath,
  [...loaderArgs, "--test", ...passThroughArgs, ...testFiles],
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      TS_NODE_COMPILER_OPTIONS:
        process.env.TS_NODE_COMPILER_OPTIONS ?? JSON.stringify(compilerOptions),
      TS_NODE_SKIP_PROJECT: process.env.TS_NODE_SKIP_PROJECT ?? "true",
      TS_NODE_TRANSPILE_ONLY: process.env.TS_NODE_TRANSPILE_ONLY ?? "true",
    },
  }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
