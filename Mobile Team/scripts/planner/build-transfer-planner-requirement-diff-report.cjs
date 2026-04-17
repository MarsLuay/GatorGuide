const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const {
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATIONS,
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_SUMMARY,
} = require("../../constants/transfer-planner-source/requirement-diff-classifications.generated");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-requirement-diff-promotion-report.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-requirement-diff-promotion-report.md");

function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function escapeMarkdown(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|");
}

function countBy(values, getKey) {
  return values.reduce((counts, value) => {
    const key = getKey(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function isPromotedClassification(entry) {
  return String(entry?.promotedRequirementAtomOverrideId ?? "").trim().length > 0;
}

function buildPromotedEntries(classifications, generatedAt) {
  const promotedOn = String(generatedAt ?? "").slice(0, 10) || null;

  return classifications.filter(isPromotedClassification).map((entry) => ({
    ownerId: entry.ownerId,
    planId: entry.planId,
    pathwayId: entry.pathwayId ?? null,
    campusId: entry.campusId,
    majorTitle: entry.majorTitle,
    id: entry.promotedRequirementAtomOverrideId ?? entry.id,
    title: entry.sourceUwCourseCode,
    grcCourseCodes: entry.grcCourseCodes ?? [],
    alternativeCourseCodeSets: entry.alternativeCourseCodeSets ?? [],
    phase: entry.displayPhase ?? null,
    displayPhase: entry.displayPhase ?? null,
    note: entry.note ?? "",
    sourceLinks: entry.sourceLinks ?? [],
    validationNotes: entry.validationNotes ?? [],
    sourceUwCourseCode: entry.sourceUwCourseCode,
    mappingConfidence: entry.mappingConfidence ?? null,
    phaseConfidence: entry.phaseConfidence ?? null,
    promotedOn,
    rationale: entry.rationale ?? "",
  }));
}

function buildReport() {
  const classifications = TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATIONS ?? [];
  const summary = TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_SUMMARY ?? {};
  const promotedEntries = buildPromotedEntries(classifications, summary.generatedAt);
  const countsByKind = countBy(classifications, (entry) => entry.classificationKind);
  const countsByCampus = countBy(classifications, (entry) => entry.campusId);

  assert.equal(
    summary.classifiedCount,
    classifications.length,
    "Requirement-diff summary classified count must match generated classification entries."
  );
  assert.equal(
    summary.promotedCount,
    promotedEntries.length,
    "Requirement-diff summary promoted count must match generated promoted entries."
  );
  assert.equal(
    summary.nonPromotedClassificationCount,
    classifications.length - promotedEntries.length,
    "Requirement-diff summary non-promoted count must match generated classification entries."
  );
  assert.deepEqual(
    summary.countsByKind,
    countsByKind,
    "Requirement-diff summary kind counts must match generated classification entries."
  );
  assert.deepEqual(
    summary.countsByCampus,
    countsByCampus,
    "Requirement-diff summary campus counts must match generated classification entries."
  );

  return {
    generatedAt: summary.generatedAt,
    totalOwners: summary.totalOwners,
    promotedCount: summary.promotedCount,
    classifiedCount: summary.classifiedCount,
    nonPromotedClassificationCount: summary.nonPromotedClassificationCount,
    reviewCandidateCount: summary.reviewCandidateCount,
    unmappedCount: summary.unmappedCount,
    promotedEntries,
    classifiedEntries: classifications,
    reviewCandidates: [],
    unmappedCandidates: [],
    classificationSummary: summary,
  };
}

function writeMarkdown(report) {
  const lines = [
    "# Transfer Planner Requirement Diff Promotion Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Classified entries: ${report.classifiedCount}`,
    `- Promoted entries: ${report.promotedCount}`,
    `- Non-promoted classifications: ${report.nonPromotedClassificationCount}`,
    `- Review-needed candidates: ${report.reviewCandidateCount}`,
    `- Unmapped candidates: ${report.unmappedCount}`,
    "",
    "## Counts By Kind",
    "",
    ...Object.entries(report.classificationSummary.countsByKind ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([kind, count]) => `- ${escapeMarkdown(kind)}: ${count}`),
    "",
    "## Counts By Campus",
    "",
    ...Object.entries(report.classificationSummary.countsByCampus ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([campusId, count]) => `- ${escapeMarkdown(campusId)}: ${count}`),
    "",
  ];

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function main() {
  ensureTmpDir();
  const report = buildReport();
  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeMarkdown(report);

  console.log(`Requirement-diff classifications: ${report.classifiedCount}`);
  console.log(`Auto-promoted classifications: ${report.promotedCount}`);
  console.log(`Review-needed candidates: ${report.reviewCandidateCount}`);
  console.log(`Unmapped candidates: ${report.unmappedCount}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);
}

main();
