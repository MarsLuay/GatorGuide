const fs = require("fs");
const path = require("path");

process.env.TS_NODE_TRANSPILE_ONLY = "true";
process.env.TS_NODE_BASEURL = process.env.TS_NODE_BASEURL || ".";
process.env.TS_NODE_COMPILER_OPTIONS =
  process.env.TS_NODE_COMPILER_OPTIONS ||
  JSON.stringify({
    module: "Node16",
    moduleResolution: "node16",
    baseUrl: ".",
    paths: {
      "@/*": ["./*"],
    },
  });

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const { TRANSFER_PLANNER_TRACKS } = require("../../constants/transfer-planner-source");
const {
  buildSuggestedQuarterPlan,
  buildSuggestedQuarterRemainingCreditRange,
} = require("../../services/planning/transfer-planner.service");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-grc-remaining-credit-range-audit.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-grc-remaining-credit-range-audit.md");

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

function isGreenRiverTrack(track) {
  return (
    String(track?.id ?? "").startsWith("grc-") ||
    (track?.officialLinks ?? []).some((link) => /greenriver\.edu/i.test(String(link?.url ?? "")))
  );
}

function buildQuarterPlan(track) {
  return buildSuggestedQuarterPlan({
    plan: null,
    plannerCollegeId: "grc",
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
}

function formatCredits(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatRange(minimumCredits, maximumCredits) {
  return minimumCredits === maximumCredits
    ? formatCredits(minimumCredits)
    : `${formatCredits(minimumCredits)}-${formatCredits(maximumCredits)}`;
}

function getOptionGroupKinds(track) {
  const kinds = new Set();
  for (const groupedChoice of track.groupedChoices ?? []) {
    const selectionCount = Number(groupedChoice.selectionCount ?? 1) || 1;
    if (selectionCount > 1) {
      kinds.add("choose-n");
    } else if ((groupedChoice.options ?? []).some((option) => (option.courseCodes ?? []).length > 1)) {
      kinds.add("grouped-sequence");
    } else {
      kinds.add("choose-one");
    }
    if ((groupedChoice.defaultOptionIds ?? []).length) {
      kinds.add("sample-default");
    }
  }
  return [...kinds].sort();
}

function getPlannedCourseRows(quarters) {
  return quarters
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) =>
      quarter.courses.map((course) => ({
        quarterLabel: quarter.label,
        label: course.label,
        creditAmount: course.creditAmount ?? null,
        creditMin: course.creditMin ?? null,
        creditMax: course.creditMax ?? null,
        sourceKind: course.sourceKind ?? null,
        optionGroupId: course.optionGroup?.id ?? null,
        optionGroupTitle: course.optionGroup?.title ?? null,
        optionGroupSelectionSource: course.optionGroup?.selectionSource ?? null,
        optionGroupIsPrompt: course.optionGroup?.isSelectionPrompt ?? null,
      }))
    );
}

function isFlexiblePlaceholder(row) {
  if (row.sourceKind === "official-grc-track-breadth") {
    return true;
  }
  if (/\b(?:A&H|SSc|NSc)\b/i.test(row.label)) {
    return true;
  }
  return /\b(?:credits? of|elective|general education|humanities|social science|natural science|a&h|ssc|nsc)\b/i.test(
    row.label
  );
}

function auditTrack(track) {
  const quarters = buildQuarterPlan(track);
  const range = buildSuggestedQuarterRemainingCreditRange({ quarters, track });
  const plannedRows = getPlannedCourseRows(quarters);
  const optionRows = plannedRows.filter((row) => row.optionGroupId);
  const flexiblePlaceholderRows = plannedRows.filter(isFlexiblePlaceholder);
  const plannedCreditTotal = plannedRows.reduce(
    (total, row) => total + (Number(row.creditAmount ?? row.creditMin ?? row.creditMax) || 0),
    0
  );
  const displayKind = range.minRemainingCredits === range.maxRemainingCredits ? "single" : "range";
  const flags = [];

  if (range.hasUnresolvedOptions) {
    flags.push("unresolved-options");
  }
  if (displayKind === "range") {
    flags.push("range-display-needed");
  }
  if (range.hasUnresolvedOptions && displayKind === "single") {
    flags.push("single-display-with-unresolved-path");
  }
  if (
    range.catalogMinimumCredits !== null &&
    range.scheduledMaxRemainingCredits > range.catalogMinimumCredits
  ) {
    flags.push("scheduled-defaults-exceed-catalog-minimum");
  }

  return {
    trackId: track.id,
    code: track.code,
    title: track.title,
    sourceUrl: track.officialLinks?.[0]?.url ?? null,
    catalogMinimumCredits: range.catalogMinimumCredits,
    catalogMaximumCredits: range.catalogMaximumCredits,
    plannedCreditTotal,
    scheduledMinRemainingCredits: range.scheduledMinRemainingCredits,
    scheduledMaxRemainingCredits: range.scheduledMaxRemainingCredits,
    minRemainingCredits: range.minRemainingCredits,
    maxRemainingCredits: range.maxRemainingCredits,
    exactRemainingCredits: range.exactRemainingCredits,
    displayKind,
    displayCreditText: formatRange(range.minRemainingCredits, range.maxRemainingCredits),
    hasUnresolvedOptions: range.hasUnresolvedOptions,
    unresolvedOptionGroupIds: range.unresolvedOptionGroupIds,
    unresolvedPlaceholderLabels: range.unresolvedPlaceholderLabels,
    optionGroupKinds: getOptionGroupKinds(track),
    optionRows,
    flexiblePlaceholderRows,
    flags,
  };
}

function renderMarkdown(report) {
  const rows = report.tracks
    .filter((track) => track.flags.length)
    .map(
      (track) =>
        `| ${track.code} | ${track.title.replace(/\|/g, "\\|")} | ${track.displayKind} | ${track.displayCreditText} | ${track.scheduledMinRemainingCredits}-${track.scheduledMaxRemainingCredits} | ${track.catalogMinimumCredits ?? ""}-${track.catalogMaximumCredits ?? ""} | ${track.optionGroupKinds.join(", ")} | ${track.unresolvedPlaceholderLabels.join("; ").replace(/\|/g, "\\|")} | ${track.flags.join(", ")} |`
    );

  return [
    "# Green River Remaining-Credit Range Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Green River tracks audited: ${report.summary.greenRiverTrackCount}`,
    `Tracks with unresolved options/placeholders: ${report.summary.tracksWithUnresolvedOptions}`,
    `Tracks needing range display: ${report.summary.tracksWithCreditRanges}`,
    `Tracks with single display but unresolved path choices: ${report.summary.tracksWithSingleDisplayAndUnresolvedOptions}`,
    `Tracks where scheduled defaults exceed catalog minimum: ${report.summary.tracksWithScheduledDefaultsAboveCatalogMinimum}`,
    "",
    rows.length
      ? "| Code | Track | Display | Remaining credits | Scheduled credits | Catalog credits | Option kinds | Flexible placeholders | Flags |\n| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |\n" +
          rows.join("\n")
      : "No remaining-credit range flags found.",
    "",
  ].join("\n");
}

function main() {
  const greenRiverTracks = TRANSFER_PLANNER_TRACKS.filter(isGreenRiverTrack);
  const tracks = greenRiverTracks.map(auditTrack);
  const flaggedTracks = tracks.filter((track) => track.flags.length);
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      greenRiverTrackCount: greenRiverTracks.length,
      tracksWithUnresolvedOptions: tracks.filter((track) => track.hasUnresolvedOptions).length,
      tracksWithCreditRanges: tracks.filter((track) => track.displayKind === "range").length,
      tracksWithSingleDisplayAndUnresolvedOptions: tracks.filter(
        (track) =>
          track.hasUnresolvedOptions &&
          track.minRemainingCredits === track.maxRemainingCredits
      ).length,
      tracksWithScheduledDefaultsAboveCatalogMinimum: tracks.filter((track) =>
        track.flags.includes("scheduled-defaults-exceed-catalog-minimum")
      ).length,
      flaggedTrackCount: flaggedTracks.length,
    },
    tracks,
  };

  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(OUTPUT_MD_PATH, renderMarkdown(report));

  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON_PATH)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_MD_PATH)}`);
  console.log(
    `Audited ${report.summary.greenRiverTrackCount} Green River tracks; ${report.summary.tracksWithCreditRanges} need a credit range; ${report.summary.tracksWithSingleDisplayAndUnresolvedOptions} still have unresolved paths with a single credit count.`
  );

  if (hasArg("--fail-on-single-unresolved") && report.summary.tracksWithSingleDisplayAndUnresolvedOptions > 0) {
    process.exitCode = 1;
  }
}

main();
