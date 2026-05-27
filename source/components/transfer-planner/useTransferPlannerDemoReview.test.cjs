const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(".");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function stripComments(source) {
  return String(source ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function readCode(relativePath) {
  return stripComments(readSource(relativePath));
}

function getImportDeclarations(source) {
  return source.match(/^\s*import[\s\S]*?;\s*/gm) ?? [];
}

test("transfer planner demo review source keeps the payload behind a dynamic import", () => {
  const hookSource = readCode("components/transfer-planner/useTransferPlannerDemoReview.ts");
  const demoStaticImportDeclarations = getImportDeclarations(hookSource).filter((declaration) =>
    declaration.includes('from "@/constants/transfer-planner-source/demo/complete-diagnostics"')
  );

  assert.equal(
    (
      hookSource.match(
        /import\(\s*"@\/constants\/transfer-planner-source\/demo\/complete-diagnostics"\s*\)/g
      ) ?? []
    ).length,
    1
  );
  assert.deepEqual(
    demoStaticImportDeclarations.filter((declaration) => !/^\s*import\s+type\b/.test(declaration)),
    []
  );
  assert.match(hookSource, /if \(!isTransferPlannerDemoMode\) \{\s*return;/);
});

test("demo mode source wiring widens planner majors and passes review data into major specifics", () => {
  const englishLocale = require("../../constants/locales/en.json");
  const controllerSource = readCode(
    "components/transfer-planner/useTransferPlannerController.ts"
  );
  const pageSource = readCode("components/pages/TransferPlannerPage.tsx");
  const transcriptCardSource = readCode(
    "components/transfer-planner/TranscriptSummaryCard.tsx"
  );
  const majorSpecificsSource = readCode(
    "components/transfer-planner/MajorSpecificsSection.tsx"
  );

  assert.match(controllerSource, /includeAllUwMajors:\s*isTransferPlannerDemoMode/);
  assert.match(controllerSource, /useTransferPlannerDemoReview\(selection\.plan\?\.id \?\? null\)/);
  assert.match(pageSource, /demoReview=\{demoReview\}/);
  assert.equal((transcriptCardSource.match(/demoReview=\{demoReview\}/g) ?? []).length, 2);
  assert.match(majorSpecificsSource, /transferPlanner\.demoReviewTitle/);
  assert.equal(
    englishLocale.transferPlanner.demoReviewTitle,
    "Demo mode human-reviewed courses"
  );
  assert.match(majorSpecificsSource, /TransferPlannerDemoReviewState/);
});
