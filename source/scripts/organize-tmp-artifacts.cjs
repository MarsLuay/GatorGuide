#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  TMP_CATEGORY_NAMES,
  ensureTmpLayout,
  getTmpCategory,
} = require("./lib/tmp-layout.cjs");

const repoRoot = path.resolve(__dirname, "..", "..");
const ignoredDirectoryNames = new Set([
  ".git",
  ".expo",
  ".tools",
  "android",
  "dist",
  "ios",
  "node_modules",
]);
const tmpCategorySet = new Set(TMP_CATEGORY_NAMES);

function parseArgs(argv) {
  return {
    quiet: argv.includes("--quiet"),
  };
}

function findTmpRoots(startDir) {
  const roots = [];
  const stack = [startDir];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries;

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      if (entry.name === ".tmp") {
        roots.push(path.join(current, entry.name));
        continue;
      }

      if (ignoredDirectoryNames.has(entry.name)) {
        continue;
      }

      stack.push(path.join(current, entry.name));
    }
  }

  return roots.sort((left, right) => left.localeCompare(right));
}

function uniqueDestinationPath(destinationPath) {
  if (!fs.existsSync(destinationPath)) {
    return destinationPath;
  }

  const parsed = path.parse(destinationPath);
  for (let index = 1; index < 1000; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);
    if (!fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not find an unused destination for ${destinationPath}`);
}

function moveEntry(sourcePath, destinationPath) {
  const finalDestinationPath = uniqueDestinationPath(destinationPath);
  fs.mkdirSync(path.dirname(finalDestinationPath), { recursive: true });
  fs.renameSync(sourcePath, finalDestinationPath);
  return finalDestinationPath;
}

function organizeTmpRoot(tmpRoot) {
  const layout = ensureTmpLayout(path.dirname(tmpRoot));
  const result = {
    root: tmpRoot,
    moved: [],
    skipped: [],
  };

  let entries;
  try {
    entries = fs.readdirSync(tmpRoot, { withFileTypes: true });
  } catch (error) {
    result.skipped.push({
      path: tmpRoot,
      reason: error instanceof Error ? error.message : String(error),
    });
    return result;
  }

  for (const entry of entries) {
    if (tmpCategorySet.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(tmpRoot, entry.name);
    const category = getTmpCategory(entry.name);
    const destinationPath = path.join(layout[category], entry.name);

    try {
      const finalDestinationPath = moveEntry(sourcePath, destinationPath);
      result.moved.push({
        from: sourcePath,
        to: finalDestinationPath,
      });
    } catch (error) {
      result.skipped.push({
        path: sourcePath,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const results = findTmpRoots(repoRoot).map(organizeTmpRoot);
  const movedCount = results.reduce((count, result) => count + result.moved.length, 0);
  const skipped = results.flatMap((result) => result.skipped);

  if (!options.quiet) {
    console.log(`Organized ${results.length} .tmp folder(s); moved ${movedCount} item(s).`);
    for (const item of skipped) {
      console.log(`Skipped ${item.path}: ${item.reason}`);
    }
  }

  // Active dev servers can keep log files locked; leave those in place and
  // sweep them on the next run instead of failing the caller.
}

main();
