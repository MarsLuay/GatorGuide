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

const {
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS,
} = require("../../constants/transfer-planner-source/grc-associate-tracks.generated");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const GENERATION_REPORT_PATH = path.resolve(TMP_DIR, "transfer-planner-grc-associate-tracks.json");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-grc-track-mismatch-report.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-grc-track-mismatch-report.md");

const CREDIT_PER_PLACEHOLDER = 5;
const ISSUE_METADATA = {
  "program-map-duration-vs-generated-range": {
    category: "credit-ranges",
    severity: "high",
    generatorPattern: "catalog-credit-range-priority-over-program-map-duration",
  },
  "catalog-source-leading-duration-misparsed": {
    category: "credit-ranges",
    severity: "high",
    generatorPattern: "credit-range-parser-uses-later-subrequirement-credit-span",
  },
  "official-catalog-program-map-credit-conflict": {
    category: "credit-ranges",
    severity: "medium",
    generatorPattern: "catalog-and-public-program-map-source-conflict",
  },
  "choose-n-default-option-count-shortfall": {
    category: "choose-n-groups",
    severity: "high",
    generatorPattern: "choose-n-defaults-derived-from-sample-rows-too-literally",
  },
  "choose-n-default-credit-shortfall": {
    category: "choose-n-groups",
    severity: "high",
    generatorPattern: "choose-n-defaults-do-not-fill-required-credit-bucket",
  },
  "choose-n-unresolved-defaults": {
    category: "unresolved-options",
    severity: "info",
    generatorPattern: "choose-n-source-options-without-sample-default-selection",
  },
  "grouped-choice-default-option-missing": {
    category: "grouped-choices",
    severity: "high",
    generatorPattern: "grouped-choice-default-id-does-not-resolve",
  },
  "grouped-choice-required-credits-missing": {
    category: "grouped-choices",
    severity: "medium",
    generatorPattern: "grouped-choice-heading-credit-not-materialized",
  },
  "placeholder-credit-omitted-from-sample-defaults": {
    category: "placeholders",
    severity: "medium",
    generatorPattern: "gen-ed-placeholder-not-preserved-in-default-schedule",
  },
  "placeholder-omitted-because-defaults-exceed-duration": {
    category: "placeholders",
    severity: "high",
    generatorPattern: "placeholder-suppressed-after-non-placeholder-defaults-overfill-duration",
  },
  "unresolved-option-credits-in-generated-track": {
    category: "unresolved-options",
    severity: "info",
    generatorPattern: "source-choice-left-as-unresolved-credit-bucket",
  },
  "unresolved-options-under-fixed-credit-display": {
    category: "unresolved-options",
    severity: "medium",
    generatorPattern: "unresolved-choice-paths-hidden-under-single-credit-display",
  },
  "scheduled-defaults-exceed-catalog-minimum": {
    category: "scheduled-defaults",
    severity: "medium",
    generatorPattern: "sample-defaults-above-published-minimum",
  },
  "scheduled-defaults-exceed-catalog-maximum": {
    category: "scheduled-defaults",
    severity: "high",
    generatorPattern: "sample-defaults-above-published-maximum",
  },
  "sample-credit-metadata-missing": {
    category: "sample-default-rows",
    severity: "info",
    generatorPattern: "sample-schedule-credit-metadata-not-emitted-for-core-only-map",
  },
};

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&ndash;|&#8211;/gi, "-")
    .replace(/&mdash;|&#8212;/gi, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePositiveNumber(value) {
  const number = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseCreditRange(value) {
  const text = stripHtml(value).replace(/\bquarter[-\s]*credits?\b/gi, "credits");
  if (!/\bcredits?\b/i.test(text)) {
    return null;
  }

  const rangeMatch = text.match(/\b(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*credits?\b/i);
  if (rangeMatch) {
    const left = parsePositiveNumber(rangeMatch[1]);
    const right = parsePositiveNumber(rangeMatch[2]);
    if (left !== null && right !== null) {
      return {
        minimumCredits: Math.min(left, right),
        maximumCredits: Math.max(left, right),
        sourceText: rangeMatch[0],
      };
    }
  }

  const minimumMatch = text.match(/\b(?:minimum(?:\s+of)?|at least)\s+(\d+(?:\.\d+)?)\s*credits?\b/i);
  if (minimumMatch) {
    const minimumCredits = parsePositiveNumber(minimumMatch[1]);
    if (minimumCredits !== null) {
      return {
        minimumCredits,
        maximumCredits: null,
        sourceText: minimumMatch[0],
      };
    }
  }

  const exactMatch = text.match(/\b(\d+(?:\.\d+)?)\s*credits?\b/i);
  if (exactMatch) {
    const exactCredits = parsePositiveNumber(exactMatch[1]);
    if (exactCredits !== null) {
      return {
        minimumCredits: exactCredits,
        maximumCredits: exactCredits,
        sourceText: exactMatch[0],
      };
    }
  }

  return null;
}

function parseLeadingCreditRange(value) {
  const text = stripHtml(value);
  if (!text) {
    return null;
  }
  return parseCreditRange(text.slice(0, 240));
}

function parseCreditsFromLabel(label) {
  const range = parseCreditRange(label);
  if (range?.maximumCredits !== null && range?.maximumCredits !== undefined) {
    return range.maximumCredits;
  }
  return range?.minimumCredits ?? null;
}

function formatCreditRange(range) {
  if (!range) {
    return "";
  }
  if (range.maximumCredits === null || range.maximumCredits === undefined) {
    return `${range.minimumCredits}+`;
  }
  return range.minimumCredits === range.maximumCredits
    ? String(range.minimumCredits)
    : `${range.minimumCredits}-${range.maximumCredits}`;
}

function getTrackRange(track) {
  const minimumCredits =
    parsePositiveNumber(track?.minimumCredits) ??
    parsePositiveNumber(track?.catalogCreditRange?.minimumCredits);
  const maximumCredits =
    parsePositiveNumber(track?.maximumCredits) ??
    parsePositiveNumber(track?.catalogCreditRange?.maximumCredits);
  if (minimumCredits === null && maximumCredits === null) {
    return null;
  }
  return {
    minimumCredits,
    maximumCredits,
  };
}

function rangesConflict(expected, actual) {
  if (!expected || !actual || expected.minimumCredits === null || actual.minimumCredits === null) {
    return false;
  }
  if (expected.minimumCredits !== actual.minimumCredits) {
    return true;
  }
  if (expected.maximumCredits === null || expected.maximumCredits === undefined) {
    return false;
  }
  return expected.maximumCredits !== actual.maximumCredits;
}

function rangesDiffer(left, right) {
  if (!left || !right) {
    return false;
  }
  return (
    left.minimumCredits !== right.minimumCredits ||
    (left.maximumCredits ?? null) !== (right.maximumCredits ?? null)
  );
}

function issue(code, details = {}) {
  return {
    code,
    ...ISSUE_METADATA[code],
    ...details,
  };
}

function countBy(values, getKey) {
  const counts = {};
  for (const value of values) {
    const key = getKey(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function extractCourseCodes(value) {
  const matches = String(value ?? "").match(/\b[A-Z]{2,5}&?\s+\d{3}[A-Z]?\b/gi) ?? [];
  return [...new Set(matches.map((match) => match.replace(/\s+/g, " ").trim().toUpperCase()))];
}

function isGenEdPlaceholderLabel(label) {
  const text = String(label ?? "");
  if (extractCourseCodes(text).length) {
    return false;
  }
  return /\b(?:humanities|social science|natural science|a\s*&\s*h|ssc|nsc|elective|general education|fine arts|english)\b/i.test(
    text
  );
}

function getDeclaredPlaceholderCredits(track) {
  const entries = [];
  for (const term of track.terms ?? []) {
    for (const rawLabel of term.courses ?? []) {
      const label = String(rawLabel ?? "").replace(/\s+/g, " ").trim();
      if (!isGenEdPlaceholderLabel(label)) {
        continue;
      }
      entries.push({
        termLabel: term.label,
        label,
        credits: parseCreditsFromLabel(label) ?? CREDIT_PER_PLACEHOLDER,
      });
    }
  }
  return {
    entries,
    credits: entries.reduce((total, entry) => total + entry.credits, 0),
  };
}

function getOptionCredits(option) {
  const labelCredits = (option?.courseLabels ?? []).reduce(
    (total, label) => total + (parseCreditsFromLabel(label) ?? CREDIT_PER_PLACEHOLDER),
    0
  );
  if (labelCredits > 0) {
    return labelCredits;
  }
  return (option?.courseCodes ?? []).length * CREDIT_PER_PLACEHOLDER;
}

function getScheduledCreditRange(track) {
  const sample = track.sampleSchedule ?? {};
  const sampleMin = parsePositiveNumber(sample.scheduledMinCredits);
  const sampleMax = parsePositiveNumber(sample.scheduledMaxCredits);
  if (sampleMin !== null || sampleMax !== null) {
    return {
      minimumCredits: sampleMin ?? sampleMax,
      maximumCredits: sampleMax ?? sampleMin,
    };
  }

  const termCredits = (track.terms ?? [])
    .map((term) => parseCreditsFromLabel(term.label))
    .filter((credits) => credits !== null);
  if (!termCredits.length) {
    return null;
  }
  const total = termCredits.reduce((sum, credits) => sum + credits, 0);
  return {
    minimumCredits: total,
    maximumCredits: total,
  };
}

function buildTrackDiagnostics(track, officialRecord = null) {
  const issues = [];
  const generatedRange = getTrackRange(track);
  const scheduledRange = getScheduledCreditRange(track);
  const programMapRange = parseCreditRange(officialRecord?.programMapDuration);
  const catalogLeadingRange = parseLeadingCreditRange(track.catalogCreditRange?.sourceText);
  const declaredPlaceholders = getDeclaredPlaceholderCredits(track);
  const scheduledPlaceholderCredits = Number(track.sampleSchedule?.placeholderCredits ?? 0) || 0;
  const unresolvedOptionCredits = Number(track.sampleSchedule?.unresolvedOptionCredits ?? 0) || 0;

  if (programMapRange && generatedRange && rangesDiffer(programMapRange, generatedRange)) {
    issues.push(
      issue("program-map-duration-vs-generated-range", {
        expectedRange: formatCreditRange(programMapRange),
        actualRange: formatCreditRange(generatedRange),
        sourceText: officialRecord?.programMapDuration ?? null,
      })
    );
  }

  if (catalogLeadingRange && generatedRange && rangesConflict(catalogLeadingRange, generatedRange)) {
    issues.push(
      issue("catalog-source-leading-duration-misparsed", {
        expectedRange: formatCreditRange(catalogLeadingRange),
        actualRange: formatCreditRange(generatedRange),
        sourceText: catalogLeadingRange.sourceText,
      })
    );
  }

  if (programMapRange && catalogLeadingRange && rangesDiffer(programMapRange, catalogLeadingRange)) {
    issues.push(
      issue("official-catalog-program-map-credit-conflict", {
        programMapRange: formatCreditRange(programMapRange),
        catalogLeadingRange: formatCreditRange(catalogLeadingRange),
        programMapSourceText: officialRecord?.programMapDuration ?? null,
        catalogSourceText: catalogLeadingRange.sourceText,
      })
    );
  }

  for (const groupedChoice of track.groupedChoices ?? []) {
    const optionById = new Map((groupedChoice.options ?? []).map((option) => [option.id, option]));
    const defaultOptions = (groupedChoice.defaultOptionIds ?? []).map((optionId) => optionById.get(optionId));
    const missingDefaultIds = (groupedChoice.defaultOptionIds ?? []).filter(
      (optionId) => !optionById.has(optionId)
    );
    const selectionCount = Number(groupedChoice.selectionCount ?? 1) || 1;
    const requiredCredits = Number(groupedChoice.requiredCredits ?? 0) || 0;
    const defaultCredits = defaultOptions.reduce((total, option) => total + getOptionCredits(option), 0);
    const choiceText = [groupedChoice.label, groupedChoice.sourceHeading].join(" ");
    const looksChooseN =
      selectionCount > 1 ||
      /\b(?:select|choose)\s+(?:at\s+least\s+)?(?:two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i.test(
        choiceText
      );

    if (missingDefaultIds.length) {
      issues.push(
        issue("grouped-choice-default-option-missing", {
          groupedChoiceId: groupedChoice.id,
          groupedChoiceLabel: groupedChoice.label,
          missingDefaultIds,
        })
      );
    }

    if (requiredCredits === 0 && /\b\d+(?:\.\d+)?\s*credits?\b/i.test(choiceText)) {
      issues.push(
        issue("grouped-choice-required-credits-missing", {
          groupedChoiceId: groupedChoice.id,
          groupedChoiceLabel: groupedChoice.label,
        })
      );
    }

    if (looksChooseN && (groupedChoice.defaultOptionIds ?? []).length === 0) {
      issues.push(
        issue("choose-n-unresolved-defaults", {
          groupedChoiceId: groupedChoice.id,
          groupedChoiceLabel: groupedChoice.label,
          selectionCount,
          requiredCredits: requiredCredits || null,
          optionCount: groupedChoice.options?.length ?? 0,
        })
      );
    }

    if (selectionCount > 1 && defaultOptions.length > 0 && defaultOptions.length < selectionCount) {
      issues.push(
        issue("choose-n-default-option-count-shortfall", {
          groupedChoiceId: groupedChoice.id,
          groupedChoiceLabel: groupedChoice.label,
          selectionCount,
          defaultOptionCount: defaultOptions.length,
          defaultOptionLabels: defaultOptions.map((option) => option?.label).filter(Boolean),
        })
      );
    }

    if (requiredCredits > 0 && defaultOptions.length > 0 && defaultCredits < requiredCredits) {
      issues.push(
        issue("choose-n-default-credit-shortfall", {
          groupedChoiceId: groupedChoice.id,
          groupedChoiceLabel: groupedChoice.label,
          requiredCredits,
          defaultCredits,
          defaultOptionLabels: defaultOptions.map((option) => option?.label).filter(Boolean),
        })
      );
    }
  }

  if (declaredPlaceholders.credits > scheduledPlaceholderCredits) {
    const code =
      track.sampleSchedule?.exceedsCatalogMinimum || track.sampleSchedule?.exceedsCatalogMaximum
        ? "placeholder-omitted-because-defaults-exceed-duration"
        : "placeholder-credit-omitted-from-sample-defaults";
    issues.push(
      issue(code, {
        declaredPlaceholderCredits: declaredPlaceholders.credits,
        scheduledPlaceholderCredits,
        omittedPlaceholderCredits: declaredPlaceholders.credits - scheduledPlaceholderCredits,
        placeholderLabels: declaredPlaceholders.entries.map((entry) => entry.label),
      })
    );
  }

  if (unresolvedOptionCredits > 0) {
    issues.push(
      issue("unresolved-option-credits-in-generated-track", {
        unresolvedOptionCredits,
      })
    );
    if (generatedRange?.minimumCredits && generatedRange.minimumCredits === generatedRange.maximumCredits) {
      issues.push(
        issue("unresolved-options-under-fixed-credit-display", {
          unresolvedOptionCredits,
          generatedRange: formatCreditRange(generatedRange),
        })
      );
    }
  }

  if (
    generatedRange?.minimumCredits &&
    scheduledRange?.maximumCredits &&
    scheduledRange.maximumCredits > generatedRange.minimumCredits
  ) {
    issues.push(
      issue("scheduled-defaults-exceed-catalog-minimum", {
        catalogRange: formatCreditRange(generatedRange),
        scheduledRange: formatCreditRange(scheduledRange),
      })
    );
  }

  if (
    generatedRange?.maximumCredits &&
    scheduledRange?.maximumCredits &&
    scheduledRange.maximumCredits > generatedRange.maximumCredits
  ) {
    issues.push(
      issue("scheduled-defaults-exceed-catalog-maximum", {
        catalogRange: formatCreditRange(generatedRange),
        scheduledRange: formatCreditRange(scheduledRange),
      })
    );
  }

  if (!scheduledRange && (track.terms ?? []).some((term) => (term.courses ?? []).length)) {
    issues.push(
      issue("sample-credit-metadata-missing", {
        termCount: track.terms?.length ?? 0,
        courseRowCount: (track.terms ?? []).reduce(
          (total, term) => total + (term.courses ?? []).length,
          0
        ),
      })
    );
  }

  return {
    trackId: track.id,
    code: track.code,
    title: track.title,
    officialUrl: officialRecord?.officialUrl ?? track.officialLinks?.[0]?.url ?? null,
    programKind: officialRecord?.programKind ?? inferProgramKind(track),
    generatedRange: formatCreditRange(generatedRange),
    programMapRange: formatCreditRange(programMapRange),
    catalogLeadingRange: formatCreditRange(catalogLeadingRange),
    scheduledRange: formatCreditRange(scheduledRange),
    groupedChoiceCount: track.groupedChoices?.length ?? 0,
    chooseNChoiceCount: (track.groupedChoices ?? []).filter(
      (choice) => Number(choice.selectionCount ?? 1) > 1
    ).length,
    declaredPlaceholderCredits: declaredPlaceholders.credits,
    scheduledPlaceholderCredits,
    unresolvedOptionCredits,
    issues,
  };
}

function inferProgramKind(track) {
  const id = String(track?.id ?? "");
  if (id.startsWith("grc-bas-")) {
    return "bas";
  }
  if (id.startsWith("grc-certificate-")) {
    return "certificate";
  }
  if (id.startsWith("grc-associate-")) {
    return "associate";
  }
  return "grc-track";
}

function getGreenRiverTracks(tracks = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS) {
  return tracks.filter((track) => String(track?.id ?? "").startsWith("grc-"));
}

function readOfficialRecordsFromGenerationReport(reportPath = GENERATION_REPORT_PATH) {
  if (!fs.existsSync(reportPath)) {
    return {
      sourcePath: reportPath,
      sourceSummary: null,
      records: [],
    };
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  return {
    sourcePath: reportPath,
    sourceSummary: report.summary ?? null,
    records: (report.records ?? []).map((record) => ({
      trackId: record.track?.id,
      code: record.track?.code,
      title: record.track?.title,
      programKind: record.programKind ?? inferProgramKind(record.track),
      officialUrl: record.page?.url ?? record.track?.officialLinks?.[0]?.url ?? null,
      programMapDuration: record.page?.duration ?? null,
      publicPageTitle: record.page?.h1 ?? null,
      publicPageDegree: record.page?.degree ?? null,
      publicPageProgramType: record.page?.programType ?? null,
      connectorProgramName: record.connectorProgramName ?? record.page?.connectorProgramName ?? null,
      catalogProgramId: record.catalogProgramId ?? null,
      catalogProgramName: record.catalogProgramName ?? null,
      requirementProgramId: record.requirementProgramId ?? null,
      requirementProgramName: record.requirementProgramName ?? null,
    })),
  };
}

function buildReport(options = {}) {
  const tracks = getGreenRiverTracks(options.tracks);
  const officialRecordsInput =
    options.officialRecords ?? readOfficialRecordsFromGenerationReport(options.generationReportPath);
  const officialRecords = Array.isArray(officialRecordsInput)
    ? officialRecordsInput
    : officialRecordsInput.records ?? [];
  const officialRecordByTrackId = new Map(
    officialRecords.filter((record) => record.trackId).map((record) => [record.trackId, record])
  );
  const trackDiagnostics = tracks.map((track) =>
    buildTrackDiagnostics(track, officialRecordByTrackId.get(track.id) ?? null)
  );
  const issues = trackDiagnostics.flatMap((track) =>
    track.issues.map((trackIssue) => ({
      trackId: track.trackId,
      code: track.code,
      title: track.title,
      programKind: track.programKind,
      officialUrl: track.officialUrl,
      ...trackIssue,
    }))
  );

  return {
    generatedAt: new Date().toISOString(),
    officialSourceReportPath: Array.isArray(officialRecordsInput)
      ? null
      : officialRecordsInput.sourcePath ?? null,
    officialSourceSummary: Array.isArray(officialRecordsInput)
      ? null
      : officialRecordsInput.sourceSummary ?? null,
    summary: {
      greenRiverTrackCount: tracks.length,
      officialRecordCount: officialRecords.length,
      tracksWithOfficialRecords: trackDiagnostics.filter((track) =>
        officialRecordByTrackId.has(track.trackId)
      ).length,
      tracksWithIssues: trackDiagnostics.filter((track) => track.issues.length).length,
      issueCount: issues.length,
      issueCountsByCategory: countBy(issues, (entry) => entry.category),
      issueCountsByCode: countBy(issues, (entry) => entry.code),
      issueCountsBySeverity: countBy(issues, (entry) => entry.severity),
      issueCountsByProgramKind: countBy(issues, (entry) => entry.programKind),
    },
    tracks: trackDiagnostics,
    issues,
    recurringGeneratorPatternIssues: Object.entries(countBy(issues, (entry) => entry.generatorPattern))
      .map(([generatorPattern, count]) => ({ generatorPattern, count }))
      .sort((left, right) => right.count - left.count || left.generatorPattern.localeCompare(right.generatorPattern)),
  };
}

function escapeMarkdown(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, " ")
    .split("|")
    .join("\\|");
}

function renderMarkdown(report) {
  const issueRows = report.issues.map(
    (entry) =>
      `| ${entry.severity} | ${entry.category} | ${entry.code} | ${entry.programKind} | ${escapeMarkdown(entry.title)} | ${escapeMarkdown(entry.actualRange ?? entry.generatedRange ?? entry.scheduledRange ?? "")} | ${escapeMarkdown(entry.expectedRange ?? entry.catalogRange ?? entry.programMapRange ?? "")} | ${escapeMarkdown(entry.sourceText ?? entry.groupedChoiceLabel ?? "")} |`
  );
  const patternRows = report.recurringGeneratorPatternIssues.map(
    (entry) => `| ${escapeMarkdown(entry.generatorPattern)} | ${entry.count} |`
  );
  const trackRows = report.tracks
    .filter((track) => track.issues.length)
    .map(
      (track) =>
        `| ${track.programKind} | ${escapeMarkdown(track.title)} | ${track.code} | ${track.generatedRange} | ${track.programMapRange} | ${track.scheduledRange} | ${track.issues.length} | ${escapeMarkdown([...new Set(track.issues.map((entry) => entry.code))].join(", "))} |`
    );

  return [
    "# Green River Track Mismatch Diagnostics",
    "",
    `Generated: ${report.generatedAt}`,
    `Official source harvest: ${report.officialSourceReportPath ?? "fixture/input records"}`,
    "",
    "## Summary",
    "",
    `- Green River tracks audited: ${report.summary.greenRiverTrackCount}`,
    `- Official program-map records available: ${report.summary.officialRecordCount}`,
    `- Tracks with official records: ${report.summary.tracksWithOfficialRecords}`,
    `- Tracks with issues: ${report.summary.tracksWithIssues}`,
    `- Issues: ${report.summary.issueCount}`,
    "",
    "## Recurring Generator Patterns",
    "",
    patternRows.length
      ? "| Pattern | Issues |\n| --- | ---: |\n" + patternRows.join("\n")
      : "No recurring patterns found.",
    "",
    "## Track Mismatches",
    "",
    trackRows.length
      ? "| Kind | Track | Code | Generated range | Program-map range | Scheduled range | Issues | Issue codes |\n| --- | --- | --- | ---: | ---: | ---: | ---: | --- |\n" +
          trackRows.join("\n")
      : "No track mismatches found.",
    "",
    "## Issue Details",
    "",
    issueRows.length
      ? "| Severity | Category | Issue | Kind | Track | Actual | Expected | Evidence |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n" +
          issueRows.join("\n")
      : "No issue details.",
    "",
  ].join("\n");
}

function writeReport(report, outputJsonPath = OUTPUT_JSON_PATH, outputMdPath = OUTPUT_MD_PATH) {
  fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
  fs.writeFileSync(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outputMdPath, renderMarkdown(report));
  return {
    outputJsonPath,
    outputMdPath,
  };
}

function main() {
  const officialInput = readOfficialRecordsFromGenerationReport();
  if (!officialInput.records.length && !hasArg("--allow-missing-official-report")) {
    console.error(
      `Missing ${path.relative(REPO_ROOT, GENERATION_REPORT_PATH)}. Run npm run planner:generate-grc-associate-tracks first, then rerun this diagnostic.`
    );
    process.exitCode = 1;
    return;
  }

  const report = buildReport({ officialRecords: officialInput });
  const outputs = writeReport(report);
  console.log(`Wrote ${path.relative(REPO_ROOT, outputs.outputJsonPath)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, outputs.outputMdPath)}`);
  console.log(
    `Audited ${report.summary.greenRiverTrackCount} Green River tracks; ${report.summary.tracksWithIssues} tracks have diagnostics; ${report.summary.issueCount} issues.`
  );

  if (hasArg("--fail-on-high") && report.issues.some((entry) => entry.severity === "high")) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildReport,
  buildTrackDiagnostics,
  parseCreditRange,
  parseLeadingCreditRange,
  readOfficialRecordsFromGenerationReport,
  renderMarkdown,
  writeReport,
};
