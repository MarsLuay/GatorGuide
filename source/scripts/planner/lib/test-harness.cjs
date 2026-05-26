const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { fetchWithHandling } = require("../../lib/fetch-with-handling.cjs");

const PLANNER_ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.resolve(PLANNER_ROOT, "..", "..");
const FIXTURE_ROOT = path.join(PLANNER_ROOT, "fixtures");
const BOOTSTRAP_FILE = path.join(
  SOURCE_ROOT,
  "constants",
  "transfer-planner-source",
  "bootstrap.generated.ts"
);

const DEFAULT_UW_CAMPUSES = new Set(["uw-seattle", "uw-bothell", "uw-tacoma"]);
const COMPLETE_DIAGNOSTIC_FIXTURE_PATTERN = /^uw-.*-complete-diagnostics\.fixture\.cjs$/;

let tsNodeRegistered = false;
let plannerModule = null;

function array(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueSorted(values) {
  return Array.from(new Set(array(values).filter(Boolean))).sort((left, right) =>
    String(left).localeCompare(String(right))
  );
}

function flattenText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flattenText).join(" ");
  if (typeof value === "object") return Object.values(value).map(flattenText).join(" ");
  return String(value);
}

function normalizePathwayId(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createDiagnosticTest(testFn, envVarName) {
  return process.env[envVarName] === "1" ? testFn : testFn.skip;
}

function registerPlannerTsNode(options = {}) {
  if (tsNodeRegistered) return;

  require("ts-node").register({
    skipProject: true,
    transpileOnly: true,
    compilerOptions: {
      module: "CommonJS",
      moduleResolution: "node",
      jsx: "react-jsx",
      baseUrl: ".",
      paths: {
        "@/*": ["./*"],
      },
      ...(options.compilerOptions ?? {}),
    },
    ...options,
  });
  require("tsconfig-paths/register");
  tsNodeRegistered = true;
}

function getPlanner() {
  if (plannerModule) return plannerModule;
  registerPlannerTsNode();
  plannerModule = require(path.join(SOURCE_ROOT, "constants", "transfer-planner-source"));
  return plannerModule;
}

function loadCurrentBootstrapPlans(options = {}) {
  const campuses = options.campuses ?? DEFAULT_UW_CAMPUSES;
  const source = fs.readFileSync(options.bootstrapFile ?? BOOTSTRAP_FILE, "utf8");
  const plans = [];
  const pattern = /\{\r?\n\s+"id": "([^"]+)",\r?\n\s+"campusId": "([^"]+)"/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const [, id, campusId] = match;
    if (campuses.has(campusId)) {
      plans.push({ id, campusId });
    }
  }

  const byId = new Map(plans.map((plan) => [plan.id, plan]));
  return uniqueSorted(Array.from(byId.keys())).map((id) => byId.get(id));
}

function loadCompleteDiagnosticPrograms(options = {}) {
  const fixtureRoot = options.fixtureRoot ?? FIXTURE_ROOT;
  const pattern = options.fixturePattern ?? COMPLETE_DIAGNOSTIC_FIXTURE_PATTERN;
  const fixtureFiles = fs
    .readdirSync(fixtureRoot)
    .filter((file) => pattern.test(file))
    .sort((left, right) => left.localeCompare(right));
  const programs = [];

  for (const fixtureFile of fixtureFiles) {
    const fixturePath = path.join(fixtureRoot, fixtureFile);
    const fixture = require(fixturePath);
    for (const [fixtureExport, value] of Object.entries(fixture)) {
      if (!Array.isArray(value)) continue;
      for (const entry of value) {
        if (!entry || typeof entry.planId !== "string") continue;
        programs.push({
          ...entry,
          fixtureFile,
          fixtureExport,
        });
      }
    }
  }

  return { fixtureFiles, programs };
}

function getExpectedCourseCodesFromProgram(program) {
  return uniqueSorted([
    ...array(program.requiredCourseCodes),
    ...array(program.optionGroups).flatMap((group) => array(group.options).flat()),
    ...array(program.courseBuckets).flatMap((bucket) => array(bucket.courseCodes)),
    ...array(program.pathwayGroups).flatMap((pathway) => [
      ...array(pathway.suggestedCourses),
      ...array(pathway.capstoneCourses),
      ...array(pathway.enrichingCourses),
    ]),
  ]);
}

function isExtractableSource(url) {
  return !/\.pdf(?:$|[?#])/i.test(String(url ?? ""));
}

function htmlToPlainText(html) {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

function createSourceTextFetcher(options = {}) {
  const cache = new Map();
  const operation = options.operation ?? "Fetch planner diagnostic official source";
  const timeoutMs = options.timeoutMs ?? 30000;
  const userAgent = options.userAgent ?? "GatorGuide transfer planner diagnostic/1.0";

  return async function fetchSourceText(url) {
    if (cache.has(url)) {
      return cache.get(url);
    }

    const response = await fetchWithHandling(url, {
      operation,
      throwOnHttpError: false,
      timeoutMs,
      userAgent,
      fetchImpl: options.fetchImpl,
    });
    assert.equal(response.ok, true, `Official source did not load: ${url} (${response.status})`);
    const text = htmlToPlainText(await response.text());
    cache.set(url, text);
    return text;
  };
}

function assertIncludesAll(actualValues, expectedValues, label, options = {}) {
  const normalize = options.normalize ?? ((value) => value);
  const actual = new Set(array(actualValues).map(normalize));
  const missing = array(expectedValues)
    .map(normalize)
    .filter((expected) => !actual.has(expected));

  assert.equal(
    missing.length,
    0,
    [
      `${label} missing ${missing.length} expected value(s).`,
      `Missing: ${missing.slice(0, options.limit ?? 180).join(", ")}`,
      `Actual count: ${actual.size}`,
    ].join("\n")
  );
}

function assertTextIncludesAll(text, snippets, label, options = {}) {
  const normalize = options.normalize ?? normalizeText;
  const normalizedText = normalize(text);
  const missing = array(snippets)
    .map((snippet) => String(snippet ?? "").trim())
    .filter(Boolean)
    .filter((snippet) => !normalizedText.includes(normalize(snippet)));

  assert.equal(
    missing.length,
    0,
    [
      `${label} missing ${missing.length} expected text snippet(s).`,
      `Missing: ${missing.slice(0, options.limit ?? 140).join(" | ")}`,
    ].join("\n")
  );
}

module.exports = {
  BOOTSTRAP_FILE,
  COMPLETE_DIAGNOSTIC_FIXTURE_PATTERN,
  DEFAULT_UW_CAMPUSES,
  FIXTURE_ROOT,
  PLANNER_ROOT,
  SOURCE_ROOT,
  array,
  assertIncludesAll,
  assertTextIncludesAll,
  createDiagnosticTest,
  createSourceTextFetcher,
  escapeRegExp,
  flattenText,
  getExpectedCourseCodesFromProgram,
  getPlanner,
  htmlToPlainText,
  isExtractableSource,
  loadCompleteDiagnosticPrograms,
  loadCurrentBootstrapPlans,
  normalizePathwayId,
  normalizeText,
  registerPlannerTsNode,
  uniqueSorted,
};
