const fs = require("fs");
const path = require("path");
const { ensureTmpLayout, getTmpPath } = require("../lib/tmp-layout.cjs");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = ensureTmpLayout(REPO_ROOT).root;
const MATERIALS_PATH = getTmpPath(REPO_ROOT, "transfer-planner-grc-public-materials.json");
const OUTPUT_JSON_PATH = getTmpPath(REPO_ROOT, "transfer-planner-source-year-coverage.json");
const OUTPUT_MD_PATH = getTmpPath(REPO_ROOT, "transfer-planner-source-year-coverage.md");

const CURRENT_ACADEMIC_START_MONTH = 7; // July
const FUTURE_COVERAGE_EXPECTED_MONTH = 10; // October
const FUTURE_COVERAGE_EXPECTED_DAY = 1;

function parseAcademicYearStart(label) {
  const match = String(label ?? "").match(/^(20\d{2})-(20\d{2})$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function getCurrentAcademicStartYear(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return month >= CURRENT_ACADEMIC_START_MONTH ? year : year - 1;
}

function dateToIso(value) {
  return new Date(value).toISOString();
}

function buildReport(materials, now = new Date()) {
  const scheduleLabels = [...new Set((materials.annualSchedules ?? []).map((entry) => entry.label))];
  const scheduleStartYears = scheduleLabels
    .map((label) => parseAcademicYearStart(label))
    .filter((value) => Number.isFinite(value));

  const latestScheduleStartYear = scheduleStartYears.length
    ? Math.max(...scheduleStartYears)
    : null;

  const currentAcademicStartYear = getCurrentAcademicStartYear(now);
  const nextAcademicStartYear = currentAcademicStartYear + 1;

  const futureCoverageExpectedAfterUtcMs = Date.UTC(
    currentAcademicStartYear,
    FUTURE_COVERAGE_EXPECTED_MONTH - 1,
    FUTURE_COVERAGE_EXPECTED_DAY,
    0,
    0,
    0,
    0
  );

  const futureCoverageExpectedByNow = now.getTime() >= futureCoverageExpectedAfterUtcMs;

  const coversCurrentAcademicYear =
    latestScheduleStartYear !== null && latestScheduleStartYear >= currentAcademicStartYear;

  const coversFutureAcademicYear =
    latestScheduleStartYear !== null && latestScheduleStartYear >= nextAcademicStartYear;

  const staleYearCoverage = !coversCurrentAcademicYear;
  const missingFutureCoverage = futureCoverageExpectedByNow && !coversFutureAcademicYear;

  const requiredActions = [];
  if (staleYearCoverage) {
    requiredActions.push(
      `Annual schedule coverage is stale. Latest detected schedule starts in ${latestScheduleStartYear ?? "unknown"}, which does not cover current academic year ${currentAcademicStartYear}-${currentAcademicStartYear + 1}.`
    );
  }

  if (missingFutureCoverage) {
    requiredActions.push(
      `Future schedule coverage is missing. Expected at least ${nextAcademicStartYear}-${nextAcademicStartYear + 1} by now, but latest detected schedule is ${latestScheduleStartYear}-${latestScheduleStartYear + 1}.`
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    nowUtc: new Date(now).toISOString(),
    currentAcademicStartYear,
    nextAcademicStartYear,
    futureCoverageExpectedAfterUtc: dateToIso(futureCoverageExpectedAfterUtcMs),
    futureCoverageExpectedByNow,
    latestScheduleStartYear,
    discoveredScheduleLabels: scheduleLabels.sort(),
    scheduleCount: scheduleLabels.length,
    coversCurrentAcademicYear,
    coversFutureAcademicYear,
    staleYearCoverage,
    missingFutureCoverage,
    currentCatalogLabel: materials.currentCatalog?.label ?? null,
    currentCatalogRootUrl: materials.currentCatalog?.rootUrl ?? null,
    usedSnapshotFallback: Boolean(materials.usedSnapshotFallback),
    snapshotFallbackReason: materials.snapshotFallbackReason ?? null,
    outcome: requiredActions.length ? "action-required" : "ok",
    requiredActions,
  };
}

function writeMarkdown(report) {
  const lines = [
    "# Transfer Planner Source Year Coverage",
    "",
    `Generated: ${report.generatedAt}`,
    `Now (UTC): ${report.nowUtc}`,
    "",
    `- Current academic year baseline: ${report.currentAcademicStartYear}-${report.currentAcademicStartYear + 1}`,
    `- Next academic year baseline: ${report.nextAcademicStartYear}-${report.nextAcademicStartYear + 1}`,
    `- Future coverage expected after: ${report.futureCoverageExpectedAfterUtc}`,
    `- Future coverage expected by now: ${report.futureCoverageExpectedByNow ? "yes" : "no"}`,
    `- Latest detected schedule start year: ${report.latestScheduleStartYear ?? "none"}`,
    `- Covers current academic year: ${report.coversCurrentAcademicYear ? "yes" : "no"}`,
    `- Covers next academic year: ${report.coversFutureAcademicYear ? "yes" : "no"}`,
    `- Used snapshot fallback: ${report.usedSnapshotFallback ? "yes" : "no"}`,
    `- Outcome: ${report.outcome}`,
    "",
    "## Discovered Schedule Labels",
    "",
    ...(report.discoveredScheduleLabels.length
      ? report.discoveredScheduleLabels.map((label) => `- ${label}`)
      : ["- None"]),
    "",
    "## Required Actions",
    "",
    ...(report.requiredActions.length
      ? report.requiredActions.map((action) => `- ${action}`)
      : ["- None. Year coverage is up to date."]),
    "",
  ];

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`, "utf8");
}

function main() {
  if (!fs.existsSync(MATERIALS_PATH)) {
    throw new Error(
      `Missing ${MATERIALS_PATH}. Run planner refresh first so public source discovery is available.`
    );
  }

  const materials = JSON.parse(fs.readFileSync(MATERIALS_PATH, "utf8"));
  const report = buildReport(materials);

  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeMarkdown(report);

  console.log(`Source year coverage outcome: ${report.outcome}`);
  console.log(`Latest schedule: ${report.latestScheduleStartYear ?? "none"}`);
  console.log(`Current baseline: ${report.currentAcademicStartYear}-${report.currentAcademicStartYear + 1}`);
  console.log(`Next baseline: ${report.nextAcademicStartYear}-${report.nextAcademicStartYear + 1}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);

  if (report.requiredActions.length) {
    for (const action of report.requiredActions) {
      console.log(`- ${action}`);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
