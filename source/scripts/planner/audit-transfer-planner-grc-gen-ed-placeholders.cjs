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
} = require("../../services/planning/transfer-planner.service");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = ensureTmpLayout(REPO_ROOT).root;
const OUTPUT_JSON_PATH = getTmpPath(REPO_ROOT, "transfer-planner-grc-gen-ed-placeholder-audit.json");
const OUTPUT_MD_PATH = getTmpPath(REPO_ROOT, "transfer-planner-grc-gen-ed-placeholder-audit.md");
const GENERAL_ED_PLACEHOLDER_CREDITS = 5;
const TARGET_KIND = "official-grc-track-breadth";

const CATEGORY_LABELS = {
  ah: "Arts & Humanities Classes",
  ssc: "Social Science Classes",
  ahOrSsc: "Flexible Breadth Classes",
  nsc: "Natural Science Classes",
  elective: "Elective/General Education Classes",
};

const CATEGORY_ORDER = ["ah", "ssc", "ahOrSsc", "nsc", "elective"];

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

function normalizeText(value) {
  return String(value ?? "").toLowerCase();
}

function classifyGeneralEducationLabel(label) {
  const normalized = normalizeText(label);
  const hasHumanities = normalized.includes("humanit") || /\ba\s*&\s*h\b/i.test(String(label ?? ""));
  const hasSocialScience = normalized.includes("social") || /\bssc\b/i.test(String(label ?? ""));
  const hasNaturalScience =
    normalized.includes("natural science") || /\bnsc\b/i.test(String(label ?? ""));
  const hasElective =
    normalized.includes("elective") ||
    normalized.includes("general education") ||
    normalized.includes("general-education");

  if (hasHumanities && hasSocialScience) {
    return "ahOrSsc";
  }

  if (hasHumanities) {
    return "ah";
  }

  if (hasSocialScience) {
    return "ssc";
  }

  if (hasNaturalScience) {
    return "nsc";
  }

  if (hasElective) {
    return "elective";
  }

  return null;
}

function isChoiceBackedGeneralEducationLabel(label) {
  if (!classifyGeneralEducationLabel(label)) {
    return false;
  }

  if (!extractCourseCodes(label).length) {
    return false;
  }

  return /\b(?:or|select|choose)\b/i.test(String(label ?? ""));
}

function createEmptyCreditsByCategory() {
  return CATEGORY_ORDER.reduce((totals, category) => {
    totals[category] = 0;
    return totals;
  }, {});
}

function addCategoryCredits(totals, category, credits) {
  totals[category] = (totals[category] ?? 0) + credits;
}

function sumCategoryCredits(totals) {
  return CATEGORY_ORDER.reduce((total, category) => total + (totals[category] ?? 0), 0);
}

function formatCreditsByCategory(totals) {
  return CATEGORY_ORDER.filter((category) => totals[category])
    .map((category) => `${CATEGORY_LABELS[category]}: ${totals[category]}`)
    .join("; ");
}

function parsePublishedDurationCredits(track) {
  const text = [track.summary, ...(track.notes ?? [])].join("\n");
  const match = text.match(/\bPublished duration:\s*(\d+(?:\.\d+)?)\s*credits?\b/i);
  return match ? Number(match[1]) : null;
}

function getCatalogDurationLimitCredits(track) {
  const maximumCredits = Number(track.maximumCredits);
  if (Number.isFinite(maximumCredits) && maximumCredits > 0) {
    return maximumCredits;
  }

  const minimumCredits = Number(track.minimumCredits);
  if (
    Number.isFinite(minimumCredits) &&
    minimumCredits > 0 &&
    Number(track.maximumCredits) === minimumCredits
  ) {
    return minimumCredits;
  }

  return null;
}

function buildDeclaredPlaceholderEntries(track) {
  return (track.terms ?? []).flatMap((term) =>
    (term.courses ?? []).flatMap((label) => {
      const category = classifyGeneralEducationLabel(label);
      if (!category) {
        return [];
      }

      const ignoredAsChoiceAlternative = isChoiceBackedGeneralEducationLabel(label);
      return [
        {
          termLabel: term.label,
          sourceLabel: label,
          category,
          categoryLabel: CATEGORY_LABELS[category],
          credits: ignoredAsChoiceAlternative ? 0 : GENERAL_ED_PLACEHOLDER_CREDITS,
          ignoredAsChoiceAlternative,
        },
      ];
    })
  );
}

function buildScheduledPlaceholderEntries(track) {
  const quarterPlan = buildSuggestedQuarterPlan({
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

  const plannedCourses = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const entries = plannedCourses
    .filter((course) => course.sourceKind === TARGET_KIND)
    .map((course) => {
      const category = classifyGeneralEducationLabel(course.label) ?? "elective";
      return {
        quarterLabel: course.quarterLabel ?? null,
        sourceLabel: course.label,
        category,
        categoryLabel: CATEGORY_LABELS[category],
        credits: Number(course.creditAmount ?? GENERAL_ED_PLACEHOLDER_CREDITS),
      };
    });

  return {
    entries,
    plannedCredits: plannedCourses.reduce(
      (total, course) => total + Number(course.creditAmount ?? 0),
      0
    ),
  };
}

function buildCreditsByCategory(entries) {
  const totals = createEmptyCreditsByCategory();
  for (const entry of entries) {
    addCategoryCredits(totals, entry.category, entry.credits);
  }
  return totals;
}

function compareCreditsByCategory(declaredCreditsByCategory, scheduledCreditsByCategory) {
  return CATEGORY_ORDER.flatMap((category) => {
    const declaredCredits = declaredCreditsByCategory[category] ?? 0;
    const scheduledCredits = scheduledCreditsByCategory[category] ?? 0;
    if (declaredCredits === scheduledCredits) {
      return [];
    }

    return [
      {
        category,
        categoryLabel: CATEGORY_LABELS[category],
        declaredCredits,
        scheduledCredits,
        differenceCredits: scheduledCredits - declaredCredits,
      },
    ];
  });
}

function buildTrackAudit(track) {
  const declaredRawEntries = buildDeclaredPlaceholderEntries(track);
  const declaredEntries = declaredRawEntries.filter((entry) => !entry.ignoredAsChoiceAlternative);
  const ignoredChoiceAlternativeEntries = declaredRawEntries.filter(
    (entry) => entry.ignoredAsChoiceAlternative
  );
  const scheduledResult = declaredRawEntries.length
    ? buildScheduledPlaceholderEntries(track)
    : {
        entries: [],
        plannedCredits: null,
      };
  const declaredCreditsByCategory = buildCreditsByCategory(declaredEntries);
  const scheduledCreditsByCategory = buildCreditsByCategory(scheduledResult.entries);
  const categoryMismatches = compareCreditsByCategory(
    declaredCreditsByCategory,
    scheduledCreditsByCategory
  );
  const declaredTotalCredits = sumCategoryCredits(declaredCreditsByCategory);
  const scheduledTotalCredits = sumCategoryCredits(scheduledCreditsByCategory);
  const publishedDurationCredits = parsePublishedDurationCredits(track);
  const durationLimitCredits = publishedDurationCredits ?? getCatalogDurationLimitCredits(track);
  const defaultScheduleExceedsDurationLimit =
    durationLimitCredits !== null &&
    typeof scheduledResult.plannedCredits === "number" &&
    scheduledResult.plannedCredits > durationLimitCredits &&
    scheduledTotalCredits < declaredTotalCredits;
  const durationCappedPlaceholderCredits =
    durationLimitCredits !== null &&
    typeof scheduledResult.plannedCredits === "number" &&
    scheduledResult.plannedCredits <= durationLimitCredits &&
    scheduledTotalCredits < declaredTotalCredits
      ? declaredTotalCredits - scheduledTotalCredits
      : 0;
  const issues = [];

  if (
    categoryMismatches.length &&
    durationCappedPlaceholderCredits === 0 &&
    !defaultScheduleExceedsDurationLimit
  ) {
    issues.push({
      code: "gen-ed-category-credit-mismatch",
      generatorRule: "placeholder-category-preservation",
      message: "Declared gen-ed placeholder credits differ from scheduled placeholders.",
      categoryMismatches,
    });
  }

  if (scheduledCreditsByCategory.ahOrSsc > declaredCreditsByCategory.ahOrSsc) {
    issues.push({
      code: "duplicate-flexible-breadth-slot",
      generatorRule: "flexible-breadth-deduplication",
      message: "Scheduled flexible A&H/SSc placeholder credits exceed declared flexible credits.",
      declaredFlexibleCredits: declaredCreditsByCategory.ahOrSsc,
      scheduledFlexibleCredits: scheduledCreditsByCategory.ahOrSsc,
    });
  }

  if (
    scheduledTotalCredits !== declaredTotalCredits &&
    durationCappedPlaceholderCredits === 0 &&
    !defaultScheduleExceedsDurationLimit
  ) {
    issues.push({
      code: "gen-ed-total-credit-mismatch",
      generatorRule: "placeholder-credit-preservation",
      message: "Declared gen-ed placeholder total differs from scheduled placeholder total.",
      declaredTotalCredits,
      scheduledTotalCredits,
      differenceCredits: scheduledTotalCredits - declaredTotalCredits,
    });
  }

  if (defaultScheduleExceedsDurationLimit) {
    issues.push({
      code: "default-schedule-exceeds-published-duration",
      generatorRule: "default-exceeds-published-duration",
      message:
        "Non-placeholder/default planned credits already exceed the catalog credit limit; omitted gen-ed placeholders are not the cause.",
      durationLimitCredits,
      plannedCredits: scheduledResult.plannedCredits,
      declaredTotalCredits,
      scheduledTotalCredits,
      suppressedPlaceholderCredits: declaredTotalCredits - scheduledTotalCredits,
    });
  }

  if (
    durationLimitCredits !== null &&
    typeof scheduledResult.plannedCredits === "number" &&
    scheduledResult.plannedCredits - durationLimitCredits === GENERAL_ED_PLACEHOLDER_CREDITS &&
    scheduledTotalCredits >= declaredTotalCredits
  ) {
    issues.push({
      code: "planned-total-one-placeholder-over-published-duration",
      generatorRule: "placeholder-over-published-duration",
      message: "Total planned credits exceed the published duration by one placeholder course.",
      publishedDurationCredits: durationLimitCredits,
      plannedCredits: scheduledResult.plannedCredits,
      differenceCredits: GENERAL_ED_PLACEHOLDER_CREDITS,
    });
  }

  return {
    trackId: track.id,
    code: track.code,
    title: track.title,
    officialLinks: track.officialLinks ?? [],
    publishedDurationCredits,
    durationLimitCredits,
    plannedCredits: scheduledResult.plannedCredits,
    declaredTotalCredits,
    scheduledTotalCredits,
    durationCappedPlaceholderCredits,
    declaredCreditsByCategory,
    scheduledCreditsByCategory,
    declaredEntries,
    scheduledEntries: scheduledResult.entries,
    ignoredChoiceAlternativeEntries,
    issues,
  };
}

function isGreenRiverAssociateTrack(track) {
  return (
    String(track.id ?? "").startsWith("grc-associate-") ||
    (track.officialLinks ?? []).some((link) => /greenriver\.edu/i.test(String(link.url ?? "")))
  );
}

function escapeMarkdownTableCell(value) {
  const escapedBackslashes = String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, " ");
  return escapedBackslashes.split("|").join("\\|");
}

function renderMarkdownReport(report) {
  const issueRows = report.tracks.flatMap((track) =>
    track.issues.map((issue) => {
      const details =
        issue.code === "gen-ed-category-credit-mismatch"
          ? issue.categoryMismatches
              .map(
                (entry) =>
                  `${entry.categoryLabel} declared ${entry.declaredCredits}, scheduled ${entry.scheduledCredits}`
              )
              .join("; ")
          : issue.message;
      return `| ${track.code} | ${escapeMarkdownTableCell(track.title)} | ${issue.code} | ${issue.generatorRule ?? ""} | ${escapeMarkdownTableCell(details)} |`;
    })
  );
  const trackedRows = report.tracks
    .filter((track) => track.declaredTotalCredits || track.scheduledTotalCredits)
    .map(
      (track) =>
        `| ${track.code} | ${escapeMarkdownTableCell(track.title)} | ${track.declaredTotalCredits} | ${track.scheduledTotalCredits} | ${track.durationCappedPlaceholderCredits || ""} | ${formatCreditsByCategory(track.declaredCreditsByCategory) || "None"} | ${formatCreditsByCategory(track.scheduledCreditsByCategory) || "None"} |`
    );

  return [
    "# Green River Gen-Ed Placeholder Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Tracks audited: ${report.summary.tracksAudited}`,
    `Tracks with gen-ed placeholders: ${report.summary.tracksWithGenEdPlaceholders}`,
    `Tracks with issues: ${report.summary.tracksWithIssues}`,
    `Issues: ${report.summary.issueCount}`,
    "",
    "## Issues",
    "",
    issueRows.length
      ? "| Code | Track | Issue | Generator rule | Details |\n| --- | --- | --- | --- | --- |\n" + issueRows.join("\n")
      : "No mismatches found.",
    "",
    "## Placeholder Credits",
    "",
    trackedRows.length
      ? "| Code | Track | Declared | Scheduled | Duration-capped | Declared by category | Scheduled by category |\n| --- | --- | ---: | ---: | ---: | --- | --- |\n" +
          trackedRows.join("\n")
      : "No gen-ed placeholders found.",
    "",
  ].join("\n");
}

function main() {
  const tracks = TRANSFER_PLANNER_TRACKS.filter(isGreenRiverAssociateTrack);
  const auditedTracks = tracks.map(buildTrackAudit);
  const tracksWithGenEdPlaceholders = auditedTracks.filter(
    (track) => track.declaredTotalCredits || track.scheduledTotalCredits
  );
  const issueCount = auditedTracks.reduce(
    (total, track) => total + track.issues.length,
    0
  );
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      tracksAudited: auditedTracks.length,
      tracksWithGenEdPlaceholders: tracksWithGenEdPlaceholders.length,
      tracksWithIssues: auditedTracks.filter((track) => track.issues.length).length,
      issueCount,
    },
    tracks: auditedTracks,
  };

  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(OUTPUT_MD_PATH, renderMarkdownReport(report));

  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON_PATH)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_MD_PATH)}`);
  console.log(
    `Audited ${report.summary.tracksAudited} Green River tracks; ${report.summary.tracksWithIssues} tracks have issues.`
  );

  if (hasArg("--fail-on-issues") && issueCount > 0) {
    process.exitCode = 1;
  }
}

main();
