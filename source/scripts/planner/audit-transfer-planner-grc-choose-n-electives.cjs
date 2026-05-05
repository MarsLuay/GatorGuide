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
  extractCourseCodes,
  getPreparatoryTrackCourseCodeSet,
  getResolvedTrackTermsForRequirementDisplay,
  isMergedCourseDistributionRequirementLabel,
  normalizeCourseCode,
} = require("../../services/planning/transfer-planner.service");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-grc-choose-n-elective-audit.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-grc-choose-n-elective-audit.md");
const GRC_TRACK_NOTE_TERM_LABEL_PATTERN = /\btransferability of credits\b/i;
const CHOOSE_N_TEXT_PATTERNS = [
  /\bselect\s+(?:at\s+least\s+)?(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+courses?\s+from\b/i,
  /\bchoose\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i,
  /\bselect\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i,
  /\bchoose\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+credits?\b/i,
  /\bafter consultation with an advisor\b/i,
  /\bafter consultation with a [^.;:]+ advisor\b/i,
];

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isGreenRiverTrack(track) {
  return (
    String(track?.id ?? "").startsWith("grc-") ||
    (track?.officialLinks ?? []).some((link) => /greenriver\.edu/i.test(String(link?.url ?? "")))
  );
}

function matchesChooseNText(value) {
  return CHOOSE_N_TEXT_PATTERNS.some((pattern) => pattern.test(String(value ?? "")));
}

function getGroupedChoiceCourseCodes(groupedChoice) {
  return unique(
    (groupedChoice.options ?? []).flatMap((option) => [
      ...(option.courseCodes ?? []),
      ...(option.courseLabels ?? []).flatMap((label) => extractCourseCodes(label)),
    ])
  )
    .map(normalizeCourseCode)
    .filter(Boolean);
}

function getChoiceDefaultOptionLabels(groupedChoice) {
  const optionsById = new Map((groupedChoice.options ?? []).map((option) => [option.id, option]));
  return unique(
    (groupedChoice.defaultOptionIds ?? [])
      .map((optionId) => optionsById.get(optionId)?.label ?? "")
      .filter(Boolean)
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

function auditChooseNChoice(track, groupedChoice, allGroupedChoiceCourseCodeSet) {
  const choiceCourseCodes = getGroupedChoiceCourseCodes(groupedChoice);
  const choiceCourseCodeSet = new Set(choiceCourseCodes);
  const preparatoryCourseCodes = getPreparatoryTrackCourseCodeSet(track);
  const sourceDefaultRows = [];
  const renderedPromotedRequiredRows = [];

  for (const term of getResolvedTrackTermsForRequirementDisplay(track, [])) {
    if (GRC_TRACK_NOTE_TERM_LABEL_PATTERN.test(String(term.label ?? "").trim())) {
      continue;
    }

    for (const rawLabel of term.courses ?? []) {
      const label = String(rawLabel ?? "").replace(/\s+/g, " ").trim();
      if (!label || isMergedCourseDistributionRequirementLabel(label)) {
        continue;
      }

      const courseCodes = unique(extractCourseCodes(label).map(normalizeCourseCode));
      if (courseCodes.length !== 1 || !choiceCourseCodeSet.has(courseCodes[0])) {
        continue;
      }

      sourceDefaultRows.push({
        termLabel: term.label,
        label,
        courseCode: courseCodes[0],
      });

      if (!preparatoryCourseCodes.has(courseCodes[0]) && !allGroupedChoiceCourseCodeSet.has(courseCodes[0])) {
        renderedPromotedRequiredRows.push({
          termLabel: term.label,
          label,
          courseCode: courseCodes[0],
          renderedText: `${label} is required.`,
        });
      }
    }
  }

  const plannedRows = buildQuarterPlan(track)
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses.map((course) => ({
        quarterLabel: quarter.label,
        course,
      }))
    );
  const groupedPlanRows = plannedRows.filter(
    (entry) => entry.course.optionGroup?.id === groupedChoice.id
  );
  const ungroupedPlannedOptionRows = plannedRows.filter((entry) => {
    if (entry.course.optionGroup?.id === groupedChoice.id) {
      return false;
    }
    if (entry.course.sourceKind !== "official-grc-track") {
      return false;
    }

    return extractCourseCodes(entry.course.label)
      .map(normalizeCourseCode)
      .some((courseCode) => choiceCourseCodeSet.has(courseCode));
  });
  const issues = [];

  if (renderedPromotedRequiredRows.length) {
    issues.push({
      code: "choose-n-option-promoted-to-required-course",
      message: "A member of a choose-N elective group would render as an individually required course.",
      rows: renderedPromotedRequiredRows,
    });
  }

  if (ungroupedPlannedOptionRows.length) {
    issues.push({
      code: "choose-n-option-planned-without-group-context",
      message: "A planned choose-N option row is missing the grouped elective option metadata.",
      rows: ungroupedPlannedOptionRows.map((entry) => ({
        quarterLabel: entry.quarterLabel,
        label: entry.course.label,
        sourceKind: entry.course.sourceKind ?? null,
      })),
    });
  }

  return {
    id: groupedChoice.id,
    label: groupedChoice.label,
    sourceHeading: groupedChoice.sourceHeading ?? null,
    requiredCredits: groupedChoice.requiredCredits ?? null,
    selectionCount: groupedChoice.selectionCount ?? 1,
    optionCourseCodes: choiceCourseCodes,
    optionLabels: (groupedChoice.options ?? []).map((option) => option.label),
    defaultOptionLabels: getChoiceDefaultOptionLabels(groupedChoice),
    sourceDefaultRows,
    groupedPlanRows: groupedPlanRows.map((entry) => ({
      quarterLabel: entry.quarterLabel,
      label: entry.course.label,
      creditAmount: entry.course.creditAmount ?? null,
      selectionSource: entry.course.optionGroup?.selectionSource ?? null,
      isSelectionPrompt: entry.course.optionGroup?.isSelectionPrompt ?? null,
    })),
    renderedPromotedRequiredRows,
    ungroupedPlannedOptionRows: ungroupedPlannedOptionRows.map((entry) => ({
      quarterLabel: entry.quarterLabel,
      label: entry.course.label,
    })),
    issues,
  };
}

function auditTrack(track) {
  const groupedChoices = track.groupedChoices ?? [];
  const allGroupedChoiceCourseCodeSet = new Set(
    groupedChoices.flatMap((groupedChoice) => getGroupedChoiceCourseCodes(groupedChoice))
  );
  const chooseNChoices = groupedChoices.filter(
    (groupedChoice) =>
      Number(groupedChoice.selectionCount ?? 1) > 1 ||
      matchesChooseNText(groupedChoice.label) ||
      matchesChooseNText(groupedChoice.sourceHeading)
  );
  const sourcePhraseMatches = [
    ...(track.terms ?? []).flatMap((term) =>
      (term.courses ?? [])
        .filter(matchesChooseNText)
        .map((label) => ({
          termLabel: term.label,
          label,
        }))
    ),
    ...groupedChoices
      .filter((groupedChoice) => matchesChooseNText(groupedChoice.label))
      .map((groupedChoice) => ({
        termLabel: "Grouped choice",
        label: groupedChoice.label,
      })),
    ...groupedChoices
      .filter((groupedChoice) => matchesChooseNText(groupedChoice.sourceHeading))
      .map((groupedChoice) => ({
        termLabel: "Grouped choice source",
        label: groupedChoice.sourceHeading,
      })),
  ];
  const choiceAudits = chooseNChoices.map((groupedChoice) =>
    auditChooseNChoice(track, groupedChoice, allGroupedChoiceCourseCodeSet)
  );

  return {
    trackId: track.id,
    code: track.code,
    title: track.title,
    sourceUrl: track.officialLinks?.[0]?.url ?? null,
    sourcePhraseMatches,
    chooseNChoiceCount: choiceAudits.length,
    chooseNChoices: choiceAudits,
    issues: choiceAudits.flatMap((choice) =>
      choice.issues.map((issue) => ({
        groupedChoiceId: choice.id,
        groupedChoiceLabel: choice.label,
        ...issue,
      }))
    ),
  };
}

function renderMarkdown(report) {
  const issueRows = report.tracks.flatMap((track) =>
    track.issues.map(
      (issue) =>
        `| ${track.code} | ${track.title.replace(/\|/g, "\\|")} | ${issue.groupedChoiceLabel.replace(/\|/g, "\\|")} | ${issue.code} | ${issue.message.replace(/\|/g, "\\|")} |`
    )
  );
  const choiceRows = report.tracks.flatMap((track) =>
    track.chooseNChoices.map(
      (choice) =>
        `| ${track.code} | ${track.title.replace(/\|/g, "\\|")} | ${choice.label.replace(/\|/g, "\\|")} | ${choice.selectionCount} | ${choice.requiredCredits ?? ""} | ${choice.optionLabels.join("; ").replace(/\|/g, "\\|")} | ${choice.defaultOptionLabels.join("; ").replace(/\|/g, "\\|")} | ${choice.groupedPlanRows.length} | ${choice.ungroupedPlannedOptionRows.length} |`
    )
  );

  return [
    "# Green River Choose-N Elective Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Green River tracks audited: ${report.summary.greenRiverTrackCount}`,
    `Tracks with choose-N source phrases: ${report.summary.tracksWithSourcePhraseMatches}`,
    `Tracks with choose-N grouped choices: ${report.summary.tracksWithChooseNChoices}`,
    `Choose-N grouped choices: ${report.summary.chooseNChoiceCount}`,
    `Issues: ${report.summary.issueCount}`,
    "",
    "## Issues",
    "",
    issueRows.length
      ? "| Code | Track | Grouped choice | Issue | Details |\n| --- | --- | --- | --- | --- |\n" +
          issueRows.join("\n")
      : "No choose-N elective promotion issues found.",
    "",
    "## Choose-N Choices",
    "",
    choiceRows.length
      ? "| Code | Track | Grouped choice | Select | Credits | Options | Defaults | Grouped plan rows | Ungrouped option rows |\n| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: |\n" +
          choiceRows.join("\n")
      : "No choose-N grouped choices found.",
    "",
  ].join("\n");
}

function main() {
  const greenRiverTracks = TRANSFER_PLANNER_TRACKS.filter(isGreenRiverTrack);
  const auditedTracks = greenRiverTracks.map(auditTrack).filter(
    (track) => track.chooseNChoiceCount > 0 || track.sourcePhraseMatches.length > 0
  );
  const issueCount = auditedTracks.reduce((total, track) => total + track.issues.length, 0);
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      greenRiverTrackCount: greenRiverTracks.length,
      tracksWithSourcePhraseMatches: auditedTracks.filter(
        (track) => track.sourcePhraseMatches.length > 0
      ).length,
      sourcePhraseMatchCount: auditedTracks.reduce(
        (total, track) => total + track.sourcePhraseMatches.length,
        0
      ),
      tracksWithChooseNChoices: auditedTracks.filter((track) => track.chooseNChoiceCount > 0).length,
      chooseNChoiceCount: auditedTracks.reduce(
        (total, track) => total + track.chooseNChoiceCount,
        0
      ),
      tracksWithIssues: auditedTracks.filter((track) => track.issues.length > 0).length,
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
    `Audited ${report.summary.greenRiverTrackCount} Green River tracks; ${report.summary.chooseNChoiceCount} choose-N grouped choices; ${report.summary.tracksWithIssues} tracks have issues.`
  );

  if (hasArg("--fail-on-issues") && issueCount > 0) {
    process.exitCode = 1;
  }
}

main();
