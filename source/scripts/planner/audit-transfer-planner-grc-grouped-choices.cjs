const fs = require("fs");
const path = require("path");
const { ensureTmpLayout, getTmpPath } = require("../lib/tmp-layout.cjs");

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
  extractCourseCodes,
  normalizeCourseCode,
} = require("../../services/planning/transfer-planner.service");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = ensureTmpLayout(REPO_ROOT).root;
const OUTPUT_JSON_PATH = getTmpPath(REPO_ROOT, "transfer-planner-grc-grouped-choice-audit.json");
const OUTPUT_MD_PATH = getTmpPath(REPO_ROOT, "transfer-planner-grc-grouped-choice-audit.md");

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

function getGroupedChoiceCourseCodes(groupedChoice) {
  return unique(
    (groupedChoice.options ?? []).flatMap((option) => [
      ...(option.courseCodes ?? []),
      ...(option.courseLabels ?? []).flatMap((label) => extractCourseCodes(label)),
    ])
  ).map(normalizeCourseCode);
}

function labelTouchesGroupedChoice(label, groupedCourseCodeSet) {
  const labelCourseCodes = extractCourseCodes(label);
  return labelCourseCodes.some((courseCode) => groupedCourseCodeSet.has(courseCode));
}

function isSplitChoiceLabel(label, groupedCourseCodeSet) {
  const labelCourseCodes = extractCourseCodes(label);
  if (!labelCourseCodes.length || !labelTouchesGroupedChoice(label, groupedCourseCodeSet)) {
    return false;
  }

  return (
    /\b(?:or|select|choose)\b/i.test(String(label ?? "")) ||
    labelCourseCodes.every((courseCode) => groupedCourseCodeSet.has(courseCode))
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

function auditGroupedChoice(track, groupedChoice) {
  const groupedCourseCodes = getGroupedChoiceCourseCodes(groupedChoice);
  const groupedCourseCodeSet = new Set(groupedCourseCodes);
  const officialGroupedChoiceIds = new Set(
    (track.groupedChoices ?? []).map((choice) => choice.id).filter(Boolean)
  );
  const sourceSplitLabels = (track.terms ?? []).flatMap((term) =>
    (term.courses ?? [])
      .filter((label) => isSplitChoiceLabel(label, groupedCourseCodeSet))
      .map((label) => ({
        termLabel: term.label,
        label,
        courseCodes: extractCourseCodes(label),
      }))
  );
  const quarterPlan = buildQuarterPlan(track);
  const plannedCourses = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses.map((course) => ({
        quarterLabel: quarter.label,
        course,
      }))
    );
  const groupedPromptRows = plannedCourses.filter(
    (entry) => entry.course.optionGroup?.id === groupedChoice.id
  );
  const unrelatedSplitOptionRows = plannedCourses.filter((entry) => {
    const optionGroup = entry.course.optionGroup;
    if (!optionGroup || optionGroup.id === groupedChoice.id) {
      return false;
    }
    if (officialGroupedChoiceIds.has(optionGroup.id)) {
      return false;
    }

    return optionGroup.options.some((option) =>
      (option.courseCodes ?? []).some((courseCode) => groupedCourseCodeSet.has(courseCode))
    );
  });
  const issues = [];

  if (!groupedPromptRows.length) {
    issues.push({
      code: "missing-grouped-choice-prompt",
      message: "Planner did not render the official grouped-choice prompt.",
    });
  }

  if (unrelatedSplitOptionRows.length) {
    issues.push({
      code: "grouped-choice-split-into-unrelated-option-rows",
      message: "Grouped-choice courses still appear in unrelated per-row option groups.",
      rows: unrelatedSplitOptionRows.map((entry) => ({
        quarterLabel: entry.quarterLabel,
        label: entry.course.label,
        optionGroupId: entry.course.optionGroup?.id ?? null,
        optionLabels: entry.course.optionGroup?.options.map((option) => option.label) ?? [],
      })),
    });
  }

  return {
    id: groupedChoice.id,
    label: groupedChoice.label,
    requiredCredits: groupedChoice.requiredCredits ?? null,
    sourceHeading: groupedChoice.sourceHeading ?? null,
    sourceProgramId: groupedChoice.sourceProgramId ?? null,
    groupedCourseCodes,
    options: groupedChoice.options ?? [],
    sourceSplitLabels,
    groupedPromptRows: groupedPromptRows.map((entry) => ({
      quarterLabel: entry.quarterLabel,
      label: entry.course.label,
      creditAmount: entry.course.creditAmount ?? null,
      optionLabels: entry.course.optionGroup?.options.map((option) => option.label) ?? [],
    })),
    unrelatedSplitOptionRows: unrelatedSplitOptionRows.map((entry) => ({
      quarterLabel: entry.quarterLabel,
      label: entry.course.label,
      optionGroupId: entry.course.optionGroup?.id ?? null,
    })),
    issues,
  };
}

function isGreenRiverTrack(track) {
  return (
    String(track.id ?? "").startsWith("grc-") ||
    (track.officialLinks ?? []).some((link) => /greenriver\.edu/i.test(String(link.url ?? "")))
  );
}

function auditTrack(track) {
  const groupedChoices = track.groupedChoices ?? [];
  const groupedChoiceAudits = groupedChoices.map((groupedChoice) =>
    auditGroupedChoice(track, groupedChoice)
  );

  return {
    trackId: track.id,
    code: track.code,
    title: track.title,
    groupedChoiceCount: groupedChoices.length,
    groupedChoices: groupedChoiceAudits,
    issues: groupedChoiceAudits.flatMap((choice) =>
      choice.issues.map((issue) => ({
        groupedChoiceId: choice.id,
        groupedChoiceLabel: choice.label,
        ...issue,
      }))
    ),
  };
}

function renderMarkdown(report) {
  const escapeMarkdownTableCell = (value) =>
    String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, " ")
      .split("|")
      .join("\\|");

  const issueRows = report.tracks.flatMap((track) =>
    track.issues.map(
      (issue) =>
        `| ${track.code} | ${escapeMarkdownTableCell(track.title)} | ${escapeMarkdownTableCell(issue.groupedChoiceLabel)} | ${issue.code} | ${escapeMarkdownTableCell(issue.message)} |`
    )
  );
  const groupedRows = report.tracks.flatMap((track) =>
    track.groupedChoices.map(
      (choice) =>
        `| ${track.code} | ${escapeMarkdownTableCell(track.title)} | ${escapeMarkdownTableCell(choice.label)} | ${choice.requiredCredits ?? ""} | ${escapeMarkdownTableCell(choice.options.map((option) => option.label).join("; "))} | ${choice.sourceSplitLabels.length} | ${choice.groupedPromptRows.length} |`
    )
  );

  return [
    "# Green River Grouped Choice Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Tracks audited: ${report.summary.tracksAudited}`,
    `Tracks with grouped choices: ${report.summary.tracksWithGroupedChoices}`,
    `Grouped choices: ${report.summary.groupedChoiceCount}`,
    `Tracks with issues: ${report.summary.tracksWithIssues}`,
    `Issues: ${report.summary.issueCount}`,
    "",
    "## Issues",
    "",
    issueRows.length
      ? "| Code | Track | Grouped choice | Issue | Details |\n| --- | --- | --- | --- | --- |\n" +
          issueRows.join("\n")
      : "No grouped-choice split issues found.",
    "",
    "## Grouped Choices",
    "",
    groupedRows.length
      ? "| Code | Track | Grouped choice | Credits | Options | Source split labels | Prompt rows |\n| --- | --- | --- | ---: | --- | ---: | ---: |\n" +
          groupedRows.join("\n")
      : "No grouped choices found.",
    "",
  ].join("\n");
}

function main() {
  const tracks = TRANSFER_PLANNER_TRACKS.filter(isGreenRiverTrack);
  const auditedTracks = tracks.filter((track) => track.groupedChoices?.length).map(auditTrack);
  const issueCount = auditedTracks.reduce((total, track) => total + track.issues.length, 0);
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      tracksAudited: tracks.length,
      tracksWithGroupedChoices: auditedTracks.length,
      groupedChoiceCount: auditedTracks.reduce(
        (total, track) => total + track.groupedChoiceCount,
        0
      ),
      tracksWithIssues: auditedTracks.filter((track) => track.issues.length).length,
      issueCount,
    },
    tracks: auditedTracks,
  };

  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(OUTPUT_MD_PATH, renderMarkdown(report));

  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON_PATH)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_MD_PATH)}`);
  console.log(
    `Audited ${report.summary.tracksAudited} Green River tracks; ${report.summary.groupedChoiceCount} grouped choices; ${report.summary.tracksWithIssues} tracks have issues.`
  );

  if (hasArg("--fail-on-issues") && issueCount > 0) {
    process.exitCode = 1;
  }
}

main();
