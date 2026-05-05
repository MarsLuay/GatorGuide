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
  extractCourseCodes,
  getPreparatoryTrackCourseCodeSet,
  getResolvedTrackTermsForRequirementDisplay,
  hasCourseAndDistributionPlaceholderSignal,
  isMergedCourseDistributionRequirementLabel,
  normalizeCourseCode,
} = require("../../services/planning/transfer-planner.service");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const OUTPUT_JSON_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-grc-merged-required-label-audit.json"
);
const OUTPUT_MD_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-grc-merged-required-label-audit.md"
);
const GRC_TRACK_NOTE_TERM_LABEL_PATTERN = /\btransferability of credits\b/i;
const SUSPICIOUS_TEXT_PATTERNS = [
  /or\s+2\s*A/i,
  /or\s+2\s*B/i,
  /or\s+2\s*C/i,
  /or\s+H\s*1/i,
  /or\s+S\s*1/i,
  /or\s+A\s*&\s*H/i,
  /or\s+SSc/i,
  /or\s+Humanities/i,
  /or\s+Social Science/i,
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

function getPatternMatches(label) {
  return SUSPICIOUS_TEXT_PATTERNS
    .filter((pattern) => pattern.test(String(label ?? "")))
    .map((pattern) => pattern.source);
}

function auditTrack(track) {
  const sourceSuspiciousLabels = [];
  const renderedMergedLabels = [];
  const suppressedMergedLabels = [];
  const renderedRequiredLabels = [];
  const seenRequiredCourseCodes = new Set();
  const preparatoryCourseCodes = getPreparatoryTrackCourseCodeSet(track);

  for (const term of getResolvedTrackTermsForRequirementDisplay(track, [])) {
    if (GRC_TRACK_NOTE_TERM_LABEL_PATTERN.test(String(term.label ?? "").trim())) {
      continue;
    }

    for (const rawLabel of term.courses ?? []) {
      const label = String(rawLabel ?? "").replace(/\s+/g, " ").trim();
      if (!label) {
        continue;
      }

      const courseCodes = unique(extractCourseCodes(label).map(normalizeCourseCode));
      const patternMatches = getPatternMatches(label);
      if (
        hasCourseAndDistributionPlaceholderSignal(label) ||
        (courseCodes.length > 0 && patternMatches.length)
      ) {
        sourceSuspiciousLabels.push({
          termLabel: term.label,
          label,
          courseCodes,
          patternMatches,
        });
      }

      if (courseCodes.length !== 1) {
        continue;
      }

      const courseCode = courseCodes[0];
      if (!courseCode || preparatoryCourseCodes.has(courseCode) || seenRequiredCourseCodes.has(courseCode)) {
        continue;
      }

      if (isMergedCourseDistributionRequirementLabel(label)) {
        suppressedMergedLabels.push({
          termLabel: term.label,
          label,
          courseCode,
        });
        continue;
      }

      seenRequiredCourseCodes.add(courseCode);
      const renderedText = `${label} is required.`;
      renderedRequiredLabels.push({
        termLabel: term.label,
        label,
        courseCode,
        renderedText,
      });

      if (hasCourseAndDistributionPlaceholderSignal(renderedText)) {
        renderedMergedLabels.push({
          termLabel: term.label,
          label,
          courseCode,
          renderedText,
        });
      }
    }
  }

  return {
    trackId: track.id,
    trackCode: track.code,
    trackTitle: track.title,
    sourceUrl: track.officialLinks?.[0]?.url ?? null,
    sourceSuspiciousLabels,
    suppressedMergedLabels,
    renderedMergedLabels,
    renderedRequiredLabels,
  };
}

function buildReport() {
  const tracks = TRANSFER_PLANNER_TRACKS.filter(isGreenRiverTrack).map(auditTrack);
  const tracksWithSourceSuspiciousLabels = tracks.filter(
    (track) => track.sourceSuspiciousLabels.length > 0
  );
  const tracksWithRenderedMergedLabels = tracks.filter(
    (track) => track.renderedMergedLabels.length > 0
  );
  const tracksWithSuppressedMergedLabels = tracks.filter(
    (track) => track.suppressedMergedLabels.length > 0
  );

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      greenRiverTrackCount: tracks.length,
      tracksWithSourceSuspiciousLabels: tracksWithSourceSuspiciousLabels.length,
      sourceSuspiciousLabelCount: tracksWithSourceSuspiciousLabels.reduce(
        (total, track) => total + track.sourceSuspiciousLabels.length,
        0
      ),
      tracksWithSuppressedMergedLabels: tracksWithSuppressedMergedLabels.length,
      suppressedMergedLabelCount: tracksWithSuppressedMergedLabels.reduce(
        (total, track) => total + track.suppressedMergedLabels.length,
        0
      ),
      tracksWithRenderedMergedLabels: tracksWithRenderedMergedLabels.length,
      renderedMergedLabelCount: tracksWithRenderedMergedLabels.reduce(
        (total, track) => total + track.renderedMergedLabels.length,
        0
      ),
    },
    tracks: tracks.filter(
      (track) =>
        track.sourceSuspiciousLabels.length ||
        track.suppressedMergedLabels.length ||
        track.renderedMergedLabels.length
    ),
  };
}

function formatLabelList(items) {
  if (!items.length) {
    return "- None";
  }

  return items
    .map((item) => `- ${item.termLabel}: ${item.label}`)
    .join("\n");
}

function buildMarkdownReport(report) {
  const lines = [
    "# Green River Merged Required Label Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Green River tracks audited: ${report.summary.greenRiverTrackCount}`,
    `- Source suspicious labels: ${report.summary.sourceSuspiciousLabelCount}`,
    `- Suppressed merged labels: ${report.summary.suppressedMergedLabelCount}`,
    `- Rendered merged required-course labels: ${report.summary.renderedMergedLabelCount}`,
    "",
    "## Rendered Merged Required-Course Labels",
    "",
  ];

  const renderedIssueTracks = report.tracks.filter(
    (track) => track.renderedMergedLabels.length > 0
  );
  if (!renderedIssueTracks.length) {
    lines.push("- None");
  } else {
    for (const track of renderedIssueTracks) {
      lines.push("", `### ${track.trackCode} | ${track.trackTitle}`, "");
      lines.push(formatLabelList(track.renderedMergedLabels));
    }
  }

  lines.push("", "## Suppressed Source Labels", "");
  const suppressedTracks = report.tracks.filter(
    (track) => track.suppressedMergedLabels.length > 0
  );
  if (!suppressedTracks.length) {
    lines.push("- None");
  } else {
    for (const track of suppressedTracks) {
      lines.push("", `### ${track.trackCode} | ${track.trackTitle}`, "");
      lines.push(formatLabelList(track.suppressedMergedLabels));
    }
  }

  lines.push("", "## Source Labels Requiring Review", "");
  const sourceTracks = report.tracks.filter(
    (track) => track.sourceSuspiciousLabels.length > 0
  );
  if (!sourceTracks.length) {
    lines.push("- None");
  } else {
    for (const track of sourceTracks) {
      lines.push("", `### ${track.trackCode} | ${track.trackTitle}`, "");
      lines.push(formatLabelList(track.sourceSuspiciousLabels));
    }
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const report = buildReport();
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(OUTPUT_MD_PATH, buildMarkdownReport(report));

  console.log(
    [
      `Audited ${report.summary.greenRiverTrackCount} Green River track(s).`,
      `${report.summary.sourceSuspiciousLabelCount} suspicious source label(s).`,
      `${report.summary.suppressedMergedLabelCount} suppressed merged label(s).`,
      `${report.summary.renderedMergedLabelCount} rendered merged required-course label(s).`,
      `Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON_PATH)} and ${path.relative(REPO_ROOT, OUTPUT_MD_PATH)}.`,
    ].join(" ")
  );

  if (hasArg("--fail-on-issues") && report.summary.renderedMergedLabelCount > 0) {
    process.exitCode = 1;
  }
}

main();
