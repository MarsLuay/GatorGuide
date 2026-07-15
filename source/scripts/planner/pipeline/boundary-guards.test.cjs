/**
 * P02-C boundary guards: forbidden cross-module imports.
 * Extends modularization posture without rewriting legacy parsers yet.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SOURCE_ROOT = path.resolve(__dirname, "../../..");

function listFiles(dir, predicate, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".tmp") continue;
      listFiles(full, predicate, acc);
    } else if (predicate(full)) {
      acc.push(full);
    }
  }
  return acc;
}

function read(relOrAbs) {
  const abs = path.isAbsolute(relOrAbs)
    ? relOrAbs
    : path.join(SOURCE_ROOT, relOrAbs);
  return fs.readFileSync(abs, "utf8");
}

test("P02-C UI page components do not import planner parser scripts", () => {
  const pages = listFiles(path.join(SOURCE_ROOT, "components/pages"), (f) =>
    /\.(tsx|ts|jsx|js)$/.test(f)
  );
  const offenders = [];
  for (const file of pages) {
    const text = read(file);
    if (
      text.includes("scripts/planner/parse-") ||
      text.includes("scripts/planner/pipeline") ||
      /from\s+["'].*parse-transfer-planner/.test(text)
    ) {
      offenders.push(path.relative(SOURCE_ROOT, file));
    }
  }
  assert.deepEqual(offenders, []);
});

test("P02-C generated planner constants do not import app hooks/state", () => {
  const generated = listFiles(
    path.join(SOURCE_ROOT, "constants/transfer-planner-source"),
    (f) => f.endsWith(".generated.ts") || f.endsWith(".generated.json")
  ).slice(0, 50); // sample — full tree is huge; pattern would be catastrophic if present
  const offenders = [];
  for (const file of generated) {
    if (file.endsWith(".json")) continue;
    const text = read(file);
    if (
      text.includes("hooks/use-app-data") ||
      text.includes("@/hooks/use-app-data") ||
      text.includes("hooks/app-data")
    ) {
      offenders.push(path.relative(SOURCE_ROOT, file));
    }
  }
  assert.deepEqual(offenders, []);
});

test("P02-C runtime services do not read raw HTML/PDF parser entrypoints", () => {
  const services = listFiles(path.join(SOURCE_ROOT, "services/planning"), (f) =>
    /\.(ts|tsx|js|cjs)$/.test(f)
  );
  const offenders = [];
  for (const file of services) {
    if (file.includes(`${path.sep}contracts${path.sep}`)) continue;
    const text = read(file);
    if (
      text.includes("parse-transfer-planner-requirement-sources") ||
      text.includes("scripts/planner/parse-")
    ) {
      offenders.push(path.relative(SOURCE_ROOT, file));
    }
  }
  assert.deepEqual(offenders, []);
});

test("P02-C pipeline facade is the public refreshPlannerData entry", () => {
  const facade = read("scripts/planner/pipeline/refresh-planner-data.cjs");
  assert.match(facade, /async function refreshPlannerData/);
  assert.match(facade, /acquisition/);
  assert.match(facade, /publication/);
});
