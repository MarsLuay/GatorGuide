#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = path.resolve(projectRoot, "..");
const sharedFetchContractPath = path.join(sourceRoot, "services", "network", "fetch-contract.cjs");
const functionsFetchContractPath = path.join(projectRoot, "fetch-contract.cjs");
const sourceExtensions = new Set([".cjs", ".js", ".mjs"]);
const ignoredDirectoryNames = new Set([".git", "node_modules"]);
const runtimeFilePattern = /^(?!scripts\/)(?!.*\.test\.js$).+\.js$/;

function toRelativePath(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function walkFiles(rootPath, results = []) {
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectoryNames.has(entry.name)) {
        walkFiles(entryPath, results);
      }
      continue;
    }

    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      results.push(entryPath);
    }
  }

  return results;
}

function lineForIndex(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function pushIssue(issues, filePath, line, message) {
  issues.push(`${toRelativePath(filePath)}:${line}: ${message}`);
}

function runSyntaxCheck(files) {
  const issues = [];
  for (const filePath of files) {
    const result = spawnSync(process.execPath, ["--check", filePath], {
      cwd: projectRoot,
      encoding: "utf8",
    });

    if (result.status !== 0) {
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
      pushIssue(
        issues,
        filePath,
        1,
        `syntax check failed${output ? `: ${output.split(/\r?\n/)[0]}` : ""}`
      );
    }
  }
  return issues;
}

function checkRestrictedRuntimePatterns(filePath, source) {
  const issues = [];
  const rules = [
    {
      pattern: /\beval\s*\(/g,
      message: "dynamic eval is not allowed in deployed Functions code",
    },
    {
      pattern: /\bnew\s+Function\s*\(/g,
      message: "dynamic Function constructors are not allowed in deployed Functions code",
    },
    {
      pattern: /require\(\s*["'](?:node:)?child_process["']\s*\)/g,
      message: "child_process is not allowed in deployed Functions code",
    },
    {
      pattern: /require\(\s*["'](?:node:)?vm["']\s*\)/g,
      message: "vm execution is not allowed in deployed Functions code",
    },
    {
      pattern: /["'`]http:\/\/(?!localhost\b|127\.0\.0\.1\b|\[::1\])/g,
      message: "outbound URLs in deployed Functions code must use HTTPS",
    },
    {
      pattern: /\b(?:apiKey|api_key|token|secret|password)\b\s*[:=]\s*["'`](?=.{12,})[^"'`$]+["'`]/gi,
      message: "possible hard-coded credential; read secrets from environment/config instead",
    },
    {
      pattern: /\bdebugger\b/g,
      message: "debugger statements are not allowed in deployed Functions code",
    },
    {
      pattern: /\bconsole\.log\s*\(/g,
      message: "console.log is not allowed in deployed Functions code; use structured errors or explicit logging",
    },
  ];

  for (const rule of rules) {
    for (const match of source.matchAll(rule.pattern)) {
      pushIssue(issues, filePath, lineForIndex(source, match.index ?? 0), rule.message);
    }
  }

  return issues;
}

function findCallRanges(source, calleeName) {
  const ranges = [];
  const callPattern = new RegExp(`\\b${calleeName}\\s*\\(`, "g");
  let match;

  while ((match = callPattern.exec(source)) !== null) {
    const start = match.index;
    let index = callPattern.lastIndex;
    let depth = 1;
    let quote = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;

    while (index < source.length && depth > 0) {
      const char = source[index];
      const next = source[index + 1];

      if (lineComment) {
        if (char === "\n") lineComment = false;
        index += 1;
        continue;
      }

      if (blockComment) {
        if (char === "*" && next === "/") {
          blockComment = false;
          index += 2;
          continue;
        }
        index += 1;
        continue;
      }

      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === quote) {
          quote = null;
        }
        index += 1;
        continue;
      }

      if (char === "/" && next === "/") {
        lineComment = true;
        index += 2;
        continue;
      }

      if (char === "/" && next === "*") {
        blockComment = true;
        index += 2;
        continue;
      }

      if (char === "\"" || char === "'" || char === "`") {
        quote = char;
        index += 1;
        continue;
      }

      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      index += 1;
    }

    ranges.push({ start, end: index, text: source.slice(start, index) });
  }

  return ranges;
}

function checkFetchTimeouts(filePath, source) {
  const issues = [];
  for (const call of findCallRanges(source, "fetch")) {
    if (!/\bsignal\s*:/.test(call.text)) {
      pushIssue(
        issues,
        filePath,
        lineForIndex(source, call.start),
        "fetch calls in deployed Functions code must pass an AbortController signal"
      );
    }
  }
  return issues;
}

function runStaticChecks(runtimeFiles) {
  const issues = [];
  for (const filePath of runtimeFiles) {
    const source = fs.readFileSync(filePath, "utf8");
    issues.push(...checkRestrictedRuntimePatterns(filePath, source));
    issues.push(...checkFetchTimeouts(filePath, source));
  }
  return issues;
}

function checkFetchContractCopy() {
  const issues = [];

  if (!fs.existsSync(sharedFetchContractPath)) {
    pushIssue(
      issues,
      sharedFetchContractPath,
      1,
      "shared fetch contract source is missing"
    );
    return issues;
  }

  if (!fs.existsSync(functionsFetchContractPath)) {
    pushIssue(
      issues,
      functionsFetchContractPath,
      1,
      "Functions fetch contract copy is missing"
    );
    return issues;
  }

  const sharedSource = fs.readFileSync(sharedFetchContractPath, "utf8").replace(/\r\n/g, "\n");
  const functionsSource = fs.readFileSync(functionsFetchContractPath, "utf8").replace(/\r\n/g, "\n");

  if (sharedSource !== functionsSource) {
    pushIssue(
      issues,
      functionsFetchContractPath,
      1,
      "Functions fetch contract copy is stale; run node scripts/lib/sync-fetch-contract.cjs from source/"
    );
  }

  return issues;
}

function main() {
  const allFiles = walkFiles(projectRoot).sort((left, right) =>
    toRelativePath(left).localeCompare(toRelativePath(right))
  );
  const runtimeFiles = allFiles.filter((filePath) =>
    runtimeFilePattern.test(toRelativePath(filePath))
  );
  const issues = [
    ...runSyntaxCheck(allFiles),
    ...runStaticChecks(runtimeFiles),
    ...checkFetchContractCopy(),
  ];

  if (issues.length) {
    process.stderr.write("[functions-static] FAIL\n");
    for (const issue of issues) {
      process.stderr.write(`  - ${issue}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `[functions-static] PASS: checked ${allFiles.length} JS file(s), including ${runtimeFiles.length} deployed runtime file(s).\n`
  );
}

if (require.main === module) {
  main();
}
