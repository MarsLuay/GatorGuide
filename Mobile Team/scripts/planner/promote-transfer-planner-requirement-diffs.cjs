const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const {
  TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY,
} = require("../../constants/transfer-planner-source");
const {
  TRANSFER_PLANNER_PROMOTED_REQUIREMENT_ATOM_OVERRIDES,
} = require("../../constants/transfer-planner-source/requirement-atom-overrides.generated");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const PARSE_REPORT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-requirement-source-parse-report.json"
);
const OUTPUT_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "requirement-atom-overrides.generated.ts"
);
const OUTPUT_JSON_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-requirement-diff-promotion-report.json"
);
const OUTPUT_MD_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-requirement-diff-promotion-report.md"
);
const COURSE_CODE_PATTERN = /\b[A-Z]{2,8}\s*\d{3}[A-Z]?\b/g;
const CAMPUS_ORDER = ["uw-seattle", "uw-bothell", "uw-tacoma"];
const BEFORE_APPLICATION_PATTERN =
  /\b(admission|admissions|application|prereq|prerequisite|min(?:imum)? course requirements?|minimum requirements?|before entry|declaration requirement)\b/i;
const BEFORE_ENROLLMENT_PATTERN =
  /\b(before the first|before first|before the following|after admission|beyond admission|later adds|adds\b|still needs|needed to complete|to complete the degree|continuation|beyond the admission baseline)\b/i;

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

function runRequirementParse() {
  const result = spawnSync("node", ["scripts/planner/parse-transfer-planner-requirement-sources.cjs"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error("Requirement-source parsing failed, so diff promotion could not continue.");
  }
}

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCourseCode(value) {
  return normalizeWhitespace(String(value ?? "").toUpperCase());
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function getOwnerScopeKey(planId, pathwayId) {
  return `${String(planId)}::${String(pathwayId ?? "")}`;
}

function extractCourseCodes(value) {
  return uniqueSorted(
    [...String(value ?? "").toUpperCase().matchAll(COURSE_CODE_PATTERN)].map((match) =>
      normalizeCourseCode(match[0])
    )
  );
}

function extractExactUwCourseCode(title) {
  const normalizedTitle = normalizeCourseCode(title);
  const codes = extractCourseCodes(normalizedTitle);
  if (codes.length !== 1) {
    return null;
  }

  return normalizedTitle === codes[0] ? codes[0] : null;
}

function getCatalogNumber(uwCourseCode) {
  const match = normalizeCourseCode(uwCourseCode).match(/\b(\d{3})[A-Z]?\b/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function isTransferRelevantUwCourseCode(uwCourseCode, consensus) {
  if (consensus?.grcCourseCodes?.length) {
    return true;
  }

  const catalogNumber = getCatalogNumber(uwCourseCode);
  return catalogNumber !== null && catalogNumber < 300;
}

function buildAlternativeSetKey(group) {
  return group.map((code) => normalizeCourseCode(code)).sort().join(" || ");
}

function buildMappingKey(entry) {
  const grcCourseCodes = [...(entry.grcCourseCodes ?? [])].map((code) => normalizeCourseCode(code)).sort();
  const alternativeCourseCodeSets = (entry.alternativeCourseCodeSets ?? [])
    .map((group) => group.map((code) => normalizeCourseCode(code)).sort())
    .sort((left, right) => left.join(" ").localeCompare(right.join(" ")));

  return JSON.stringify({
    grcCourseCodes,
    alternativeCourseCodeSets,
  });
}

function buildConsensusIndex() {
  const ownersByScope = new Map();
  const consensusByCourse = new Map();
  const promotedOverrideIds = new Set(
    (TRANSFER_PLANNER_PROMOTED_REQUIREMENT_ATOM_OVERRIDES ?? []).map((entry) => entry.id)
  );

  for (const atom of TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY) {
    if (promotedOverrideIds.has(atom.id)) {
      continue;
    }

    const ownerScopeKey = getOwnerScopeKey(atom.planId, atom.pathwayId);
    const ownerCodes = ownersByScope.get(ownerScopeKey) ?? new Set();
    const exactCourseCode = extractExactUwCourseCode(atom.title);

    if (exactCourseCode) {
      ownerCodes.add(exactCourseCode);
      ownersByScope.set(ownerScopeKey, ownerCodes);
    }

    if (!exactCourseCode || !(atom.grcCourseCodes ?? []).length) {
      continue;
    }

    const mappingKey = buildMappingKey(atom);
    const entryForCourse =
      consensusByCourse.get(exactCourseCode) ??
      {
        totalSamples: 0,
        mappings: new Map(),
      };
    entryForCourse.totalSamples += 1;

    const mappingEntry =
      entryForCourse.mappings.get(mappingKey) ??
      {
        mappingKey,
        grcCourseCodes: [...atom.grcCourseCodes].map((code) => normalizeCourseCode(code)).sort(),
        alternativeCourseCodeSets: (atom.alternativeCourseCodeSets ?? []).map((group) =>
          group.map((code) => normalizeCourseCode(code)).sort()
        ),
        sampleCount: 0,
        phases: new Map(),
      };

    mappingEntry.sampleCount += 1;
    mappingEntry.phases.set(
      atom.displayPhase,
      (mappingEntry.phases.get(atom.displayPhase) ?? 0) + 1
    );
    entryForCourse.mappings.set(mappingKey, mappingEntry);
    consensusByCourse.set(exactCourseCode, entryForCourse);
  }

  const summarizedConsensus = new Map();
  for (const [uwCourseCode, entry] of consensusByCourse.entries()) {
    const sortedMappings = [...entry.mappings.values()].sort((left, right) => {
      if (right.sampleCount !== left.sampleCount) {
        return right.sampleCount - left.sampleCount;
      }
      return left.mappingKey.localeCompare(right.mappingKey);
    });

    const topMapping = sortedMappings[0];
    const topPhase = [...topMapping.phases.entries()].sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })[0];

    const mappingRatio = topMapping ? topMapping.sampleCount / entry.totalSamples : 0;
    const phaseRatio =
      topPhase && topMapping ? topPhase[1] / topMapping.sampleCount : 0;
    const mappingConfidence =
      topMapping && topMapping.sampleCount >= 2 && mappingRatio >= 0.8 ? "high" : "medium";
    const phaseConfidence =
      topPhase && topPhase[1] >= 2 && phaseRatio >= 0.8
        ? "high"
        : topPhase
          ? "medium"
          : "low";

    summarizedConsensus.set(uwCourseCode, {
      uwCourseCode,
      totalSamples: entry.totalSamples,
      mappingSampleCount: topMapping?.sampleCount ?? 0,
      mappingRatio,
      mappingConfidence,
      grcCourseCodes: topMapping?.grcCourseCodes ?? [],
      alternativeCourseCodeSets: topMapping?.alternativeCourseCodeSets ?? [],
      phase: topPhase?.[0] ?? "stay-at-grc",
      phaseSampleCount: topPhase?.[1] ?? 0,
      phaseRatio,
      phaseConfidence,
    });
  }

  return {
    ownersByScope,
    summarizedConsensus,
  };
}

function readSnapshotLines(snapshotPath) {
  if (!snapshotPath || !fs.existsSync(snapshotPath)) {
    return [];
  }

  return fs
    .readFileSync(snapshotPath, "utf8")
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function inferPhase(owner, uwCourseCode, consensus) {
  const snapshotLines = readSnapshotLines(owner.snapshotPath);
  const matchingLines = snapshotLines.filter((line) => line.includes(uwCourseCode)).slice(0, 8);
  const relevantText = [...matchingLines, ...(owner.requirementCueLines ?? [])].join(" | ");

  if (BEFORE_ENROLLMENT_PATTERN.test(relevantText)) {
    return {
      phase: "before-enrollment",
      phaseConfidence: "high",
      matchedLines: matchingLines,
    };
  }

  if (BEFORE_APPLICATION_PATTERN.test(relevantText)) {
    return {
      phase: "before-application",
      phaseConfidence: "high",
      matchedLines: matchingLines,
    };
  }

  return {
    phase: consensus.phase,
    phaseConfidence: consensus.phaseConfidence,
    matchedLines: matchingLines,
  };
}

function normalizeCampusLabel(campusId) {
  switch (campusId) {
    case "uw-seattle":
      return "UW Seattle";
    case "uw-bothell":
      return "UW Bothell";
    case "uw-tacoma":
      return "UW Tacoma";
    default:
      return campusId;
  }
}

function formatHumanDate(isoString) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(date);
}

function buildGeneratedNote(phase, uwCourseCode) {
  const subjectCode = normalizeCourseCode(uwCourseCode).split(" ")[0];

  if (phase === "before-application") {
    return `The current official degree page names ${uwCourseCode} in the early transfer-preparation set, so keep the clean Green River equivalent in place before applying when that route matches the student's plan.`;
  }

  if (phase === "before-enrollment") {
    if (/^(MATH|STAT|TMATH|STMATH)$/.test(subjectCode)) {
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because the degree still needs this math requirement either way.";
    }
    if (/^(PHYS|TPHYS|BPHYS)$/.test(subjectCode)) {
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because the degree still needs this physics requirement either way.";
    }
    if (/^(CHEM|BCHEM)$/.test(subjectCode)) {
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because the degree still needs this chemistry requirement either way.";
    }
    if (/^(BIOL|BBIO|NURS|NUTR)$/.test(subjectCode)) {
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because the degree still needs this life-science requirement either way.";
    }
    if (/^(CSE|CS|TCSS|CSS|INFO|AMATH|ENGR)$/.test(subjectCode)) {
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because the degree still needs this computing or technical requirement either way.";
    }

    return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way.";
  }

  if (/^(MATH|STAT|TMATH|STMATH|PHYS|TPHYS|CHEM|BCHEM|BIOL|BBIO|CS|CSE|TCSS|CSS|INFO|ENGR|AMATH)$/.test(subjectCode)) {
    return "Useful to complete at Green River when it cleanly matches the published degree page, even if the department does not treat it as part of the minimum admission-side checklist.";
  }

  return "Useful to complete at Green River when it cleanly matches the published degree page, but confirm the exact timing with an advisor if the major has multiple internal routes.";
}

function sanitizeStringLiteral(value) {
  return JSON.stringify(String(value ?? ""));
}

function buildGeneratedFile(entries) {
  const lines = [
    "export type TransferPlannerPromotedRequirementAtomOverride = {",
    "  ownerId: string;",
    "  planId: string;",
    "  pathwayId?: string | null;",
    '  campusId: "uw-seattle" | "uw-bothell" | "uw-tacoma";',
    "  majorTitle: string;",
    "  id: string;",
    "  title: string;",
    "  grcCourseCodes: string[];",
    "  alternativeCourseCodeSets: string[][];",
    '  phase: "before-application" | "before-enrollment" | "stay-at-grc";',
    '  displayPhase: "before-application" | "before-enrollment" | "stay-at-grc";',
    "  note: string;",
    "  sourceLinks: Array<{",
    "    label: string;",
    "    url: string;",
    "    note?: string;",
    "  }>;",
    "  validationNotes: string[];",
    "  sourceUwCourseCode: string;",
    '  mappingConfidence: "high";',
    '  phaseConfidence: "high" | "medium";',
    "  promotedOn: string;",
    "  rationale: string;",
    "};",
    "",
    "// Generated by scripts/planner/promote-transfer-planner-requirement-diffs.cjs",
    "export const TRANSFER_PLANNER_PROMOTED_REQUIREMENT_ATOM_OVERRIDES: TransferPlannerPromotedRequirementAtomOverride[] = [",
  ];

  for (const entry of entries) {
    lines.push("  {");
    lines.push(`    ownerId: ${sanitizeStringLiteral(entry.ownerId)},`);
    lines.push(`    planId: ${sanitizeStringLiteral(entry.planId)},`);
    if (entry.pathwayId) {
      lines.push(`    pathwayId: ${sanitizeStringLiteral(entry.pathwayId)},`);
    }
    lines.push(`    campusId: ${sanitizeStringLiteral(entry.campusId)},`);
    lines.push(`    majorTitle: ${sanitizeStringLiteral(entry.majorTitle)},`);
    lines.push(`    id: ${sanitizeStringLiteral(entry.id)},`);
    lines.push(`    title: ${sanitizeStringLiteral(entry.title)},`);
    lines.push(
      `    grcCourseCodes: [${entry.grcCourseCodes.map((code) => sanitizeStringLiteral(code)).join(", ")}],`
    );
    lines.push("    alternativeCourseCodeSets: [");
    for (const group of entry.alternativeCourseCodeSets) {
      lines.push(
        `      [${group.map((code) => sanitizeStringLiteral(code)).join(", ")}],`
      );
    }
    lines.push("    ],");
    lines.push(`    phase: ${sanitizeStringLiteral(entry.phase)},`);
    lines.push(`    displayPhase: ${sanitizeStringLiteral(entry.displayPhase)},`);
    lines.push(`    note: ${sanitizeStringLiteral(entry.note)},`);
    lines.push("    sourceLinks: [");
    for (const link of entry.sourceLinks) {
      lines.push("      {");
      lines.push(`        label: ${sanitizeStringLiteral(link.label)},`);
      lines.push(`        url: ${sanitizeStringLiteral(link.url)},`);
      if (link.note) {
        lines.push(`        note: ${sanitizeStringLiteral(link.note)},`);
      }
      lines.push("      },");
    }
    lines.push("    ],");
    lines.push("    validationNotes: [");
    for (const note of entry.validationNotes) {
      lines.push(`      ${sanitizeStringLiteral(note)},`);
    }
    lines.push("    ],");
    lines.push(`    sourceUwCourseCode: ${sanitizeStringLiteral(entry.sourceUwCourseCode)},`);
    lines.push('    mappingConfidence: "high",');
    lines.push(`    phaseConfidence: ${sanitizeStringLiteral(entry.phaseConfidence)},`);
    lines.push(`    promotedOn: ${sanitizeStringLiteral(entry.promotedOn)},`);
    lines.push(`    rationale: ${sanitizeStringLiteral(entry.rationale)},`);
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");
  return lines.join("\n");
}

function buildReportMarkdown(report) {
  const lines = [
    "# Transfer Planner Requirement Diff Promotion Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Parsed owners inspected: ${report.totalOwners}`,
    `- High-confidence promoted requirement overrides: ${report.promotedCount}`,
    `- Review-needed candidates: ${report.reviewCandidateCount}`,
    `- Unmapped source-only course codes: ${report.unmappedCount}`,
    "",
    "This report is the follow-up step after parsing primary requirement sources. Only high-confidence requirement candidates are auto-promoted into the generated override layer.",
    "",
  ];

  for (const campusId of CAMPUS_ORDER) {
    const campusPromoted = report.promotedEntries.filter((entry) => entry.campusId === campusId);
    const campusReview = report.reviewCandidates.filter((entry) => entry.campusId === campusId);
    const campusUnmapped = report.unmappedCandidates.filter((entry) => entry.campusId === campusId);

    if (!campusPromoted.length && !campusReview.length && !campusUnmapped.length) {
      continue;
    }

    lines.push(`## ${normalizeCampusLabel(campusId)}`, "");

    if (campusPromoted.length) {
      lines.push("### Auto-promoted high-confidence requirement atoms", "");
      for (const entry of campusPromoted.slice(0, 50)) {
        lines.push(`#### ${entry.majorTitle}`);
        lines.push("");
        lines.push(`- UW course: ${entry.sourceUwCourseCode}`);
        lines.push(`- Planner phase: ${entry.displayPhase}`);
        lines.push(`- Green River match: ${entry.grcCourseCodes.join(", ")}`);
        lines.push(`- Source: ${entry.sourceLinks[0]?.url ?? "n/a"}`);
        lines.push(`- Rationale: ${entry.rationale}`);
        lines.push("");
      }
    }

    if (campusReview.length) {
      lines.push("### Review-needed requirement candidates", "");
      for (const entry of campusReview.slice(0, 50)) {
        lines.push(`- ${entry.majorTitle}`);
        lines.push(`  - UW course: ${entry.sourceUwCourseCode}`);
        lines.push(`  - Suggested Green River match: ${entry.grcCourseCodes.join(", ") || "none"}`);
        lines.push(`  - Suggested phase: ${entry.displayPhase}`);
        lines.push(`  - Mapping confidence: ${entry.mappingConfidence}`);
        lines.push(`  - Phase confidence: ${entry.phaseConfidence}`);
        lines.push(`  - Reason: ${entry.rationale}`);
      }
      lines.push("");
    }

    if (campusUnmapped.length) {
      lines.push("### Source-only UW courses still unmapped", "");
      for (const entry of campusUnmapped.slice(0, 50)) {
        lines.push(`- ${entry.majorTitle}`);
        lines.push(`  - UW course: ${entry.sourceUwCourseCode}`);
        lines.push(`  - Reason: ${entry.rationale}`);
      }
      lines.push("");
    }
  }

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function buildPromotionReport(parseReport) {
  const { ownersByScope, summarizedConsensus } = buildConsensusIndex();
  const generatedAt = new Date().toISOString();
  const humanDate = formatHumanDate(generatedAt);
  const promotedEntries = [];
  const reviewCandidates = [];
  const unmappedCandidates = [];

  for (const owner of parseReport.owners ?? []) {
    if (!owner.ok || !owner.planId || !owner.campusId || owner.campusId === "grc") {
      continue;
    }

    const ownerScopeKey = getOwnerScopeKey(owner.planId, owner.pathwayId);
    const existingCodes = ownersByScope.get(ownerScopeKey) ?? new Set();

    for (const uwCourseCode of owner.sourceOnlyUwCourseCodes ?? []) {
      if (existingCodes.has(uwCourseCode)) {
        continue;
      }

      const consensus = summarizedConsensus.get(uwCourseCode);
      if (!isTransferRelevantUwCourseCode(uwCourseCode, consensus)) {
        continue;
      }

      if (!consensus || !consensus.grcCourseCodes.length) {
        unmappedCandidates.push({
          campusId: owner.campusId,
          ownerId: owner.ownerId,
          majorTitle: owner.ownerTitle,
          sourceUwCourseCode: uwCourseCode,
          rationale:
            "No strong exact-title requirement consensus exists yet in the current planner data for this UW course code.",
        });
        continue;
      }

      const phaseInference = inferPhase(owner, uwCourseCode, consensus);
      const rationale = [
        `Parsed from the current primary degree page with ${owner.parseConfidence} source-parse confidence.`,
        `The planner already has ${consensus.mappingSampleCount}/${consensus.totalSamples} exact-title requirement samples mapping ${uwCourseCode} to ${consensus.grcCourseCodes.join(", ")}.`,
        `Phase inference is ${phaseInference.phaseConfidence} confidence and resolves to ${phaseInference.phase}.`,
      ].join(" ");

      const candidate = {
        ownerId: owner.ownerId,
        planId: owner.planId,
        pathwayId: owner.pathwayId ?? null,
        campusId: owner.campusId,
        majorTitle: owner.ownerTitle,
        id: `${owner.planId}${owner.pathwayId ? `:pathway:${owner.pathwayId}` : ""}:${phaseInference.phase}:auto-${uwCourseCode
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")}`,
        title: uwCourseCode,
        grcCourseCodes: [...consensus.grcCourseCodes],
        alternativeCourseCodeSets: (consensus.alternativeCourseCodeSets ?? []).map((group) => [
          ...group,
        ]),
        phase: phaseInference.phase,
        displayPhase: phaseInference.phase,
        note: buildGeneratedNote(phaseInference.phase, uwCourseCode),
        sourceLinks: [
          {
            label: owner.sourceLabel || "Primary degree requirements source",
            url: owner.sourceUrl,
            note: `Auto-promoted from the parsed primary degree page on ${humanDate}.`,
          },
        ],
        validationNotes: [
          `Auto-promoted parsed requirement diff on ${humanDate}.`,
          `Source parse confidence: ${owner.parseConfidence}.`,
          `Requirement-mapping consensus: ${consensus.mappingSampleCount}/${consensus.totalSamples} exact-title samples for ${uwCourseCode}.`,
          ...(phaseInference.matchedLines.length
            ? [`Requirement cue lines: ${phaseInference.matchedLines.slice(0, 3).join(" | ")}`]
            : []),
        ],
        sourceUwCourseCode: uwCourseCode,
        mappingConfidence: consensus.mappingConfidence,
        phaseConfidence: phaseInference.phaseConfidence,
        promotedOn: generatedAt.slice(0, 10),
        rationale,
      };

      const shouldPromote =
        owner.parseConfidence === "high" &&
        consensus.mappingConfidence === "high" &&
        phaseInference.phaseConfidence !== "low";

      if (shouldPromote) {
        promotedEntries.push(candidate);
      } else {
        reviewCandidates.push(candidate);
      }
    }
  }

  const promotedEntryMap = new Map(promotedEntries.map((entry) => [entry.id, entry]));
  const sortedPromotedEntries = [...promotedEntryMap.values()].sort((left, right) =>
    left.id.localeCompare(right.id)
  );

  return {
    generatedAt,
    totalOwners: parseReport.totalOwners ?? 0,
    promotedCount: sortedPromotedEntries.length,
    reviewCandidateCount: reviewCandidates.length,
    unmappedCount: unmappedCandidates.length,
    promotedEntries: sortedPromotedEntries,
    reviewCandidates: reviewCandidates.sort((left, right) =>
      left.id.localeCompare(right.id)
    ),
    unmappedCandidates: unmappedCandidates.sort((left, right) =>
      `${left.ownerId}:${left.sourceUwCourseCode}`.localeCompare(
        `${right.ownerId}:${right.sourceUwCourseCode}`
      )
    ),
  };
}

function main() {
  const parseFirst = hasArg("--parse-first") || !fs.existsSync(PARSE_REPORT_PATH);

  fs.mkdirSync(TMP_DIR, { recursive: true });

  if (parseFirst) {
    runRequirementParse();
  }

  if (!fs.existsSync(PARSE_REPORT_PATH)) {
    throw new Error(
      `Could not find requirement parse report at ${PARSE_REPORT_PATH}. Run planner:parse-requirement-sources first.`
    );
  }

  const parseReport = JSON.parse(fs.readFileSync(PARSE_REPORT_PATH, "utf8"));
  const promotionReport = buildPromotionReport(parseReport);

  fs.writeFileSync(OUTPUT_PATH, buildGeneratedFile(promotionReport.promotedEntries));
  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(promotionReport, null, 2)}\n`);
  buildReportMarkdown(promotionReport);

  console.log(
    `Auto-promoted ${promotionReport.promotedCount} high-confidence requirement override(s).`
  );
  console.log(`Review-needed candidates: ${promotionReport.reviewCandidateCount}`);
  console.log(`Unmapped source-only UW course codes: ${promotionReport.unmappedCount}`);
  console.log(`Override file: ${OUTPUT_PATH}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
