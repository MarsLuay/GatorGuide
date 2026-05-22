const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const DISCOVERY_REPORT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-primary-source-discovery.json"
);
const OUTPUT_JSON_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-primary-source-review-queue.json"
);
const OUTPUT_MD_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-primary-source-review-queue.md"
);

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});
require("tsconfig-paths/register");

const discovery = require("./discover-transfer-planner-primary-sources.cjs");
const {
  getTransferPlannerStudentRuntimeAliasCoverage,
} = require("../../constants/transfer-planner-source/student-runtime");

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

function runDiscovery() {
  const result = spawnSync("node", ["scripts/planner/discover-transfer-planner-primary-sources.cjs"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error("Primary-source discovery failed, so the source-gap report could not be built.");
  }
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

function normalizeReviewCandidate(candidate) {
  if (!candidate) {
    return null;
  }

  return {
    url: candidate.url,
    label:
      candidate.label ||
      candidate.anchorText ||
      candidate.linkText ||
      candidate.pageTitle ||
      null,
    score: candidate.score,
    confidence: candidate.confidence,
    sourceRole: candidate.sourceRole ?? null,
    parserType: candidate.parserType ?? null,
    reasons: candidate.reasons ?? [],
  };
}

function isReviewablePrimaryCandidate(candidate) {
  return (
    candidate &&
    (
      !discovery.isAutoPromotablePrimaryCandidate(candidate) ||
      candidate.parserType === "html-curriculum-page" ||
      candidate.sourceRole === "curriculum-map"
    ) &&
    (candidate.confidence === "high" || candidate.confidence === "medium")
  );
}

function pickOwnerReviewCandidate(owner) {
  const candidate = owner?.suggestedPrimary ?? owner?.reviewCandidate ?? null;
  return isReviewablePrimaryCandidate(candidate) ? candidate : null;
}

function pickTopGapCandidates(owner) {
  return (owner.topCandidates ?? [])
    .filter((candidate) => !discovery.isAutoPromotablePrimaryCandidate(candidate))
    .slice(0, 3)
    .map(normalizeReviewCandidate)
    .filter(Boolean);
}

function buildOwnerSourceGapEntry(owner, reviewCandidate = null) {
  const candidate = reviewCandidate ?? pickOwnerReviewCandidate(owner);
  const hasHighSafetyReview = candidate?.confidence === "high";
  const hasMediumSuggestion = candidate?.confidence === "medium";
  return {
    ownerType: owner.ownerType,
    ownerKey: owner.ownerKey,
    planId: owner.planId,
    pathwayId: owner.pathwayId,
    title: owner.title,
    campusId: owner.campusId,
    status: hasHighSafetyReview
      ? "high-confidence-needs-review"
      : hasMediumSuggestion
        ? "medium-confidence"
        : "needs-source-automation",
    suggestedPrimary: hasHighSafetyReview || hasMediumSuggestion
      ? normalizeReviewCandidate(candidate)
      : null,
    candidateCount: owner.candidateCount ?? 0,
    officialLinkCount: (owner.officialLinks ?? []).length,
    topReviewCandidates: pickTopGapCandidates(owner),
  };
}

function hasStudentRuntimeAliasCoverage(owner) {
  if (!owner?.planId) {
    return false;
  }

  return Boolean(
    getTransferPlannerStudentRuntimeAliasCoverage(owner.planId, owner.pathwayId ?? null)
  );
}

function buildQueue(report) {
  const highSafetyReviewOwners = [];
  const mediumOwners = [];
  const unresolvedOwners = [];

  for (const owner of report.owners ?? []) {
    if (hasStudentRuntimeAliasCoverage(owner)) {
      continue;
    }

    const reviewCandidate = pickOwnerReviewCandidate(owner);
    if (reviewCandidate?.confidence === "high") {
      highSafetyReviewOwners.push(buildOwnerSourceGapEntry(owner, reviewCandidate));
      continue;
    }

    if (reviewCandidate?.confidence === "medium") {
      mediumOwners.push(buildOwnerSourceGapEntry(owner, reviewCandidate));
      continue;
    }

    if (!owner?.suggestedPrimary || owner.suggestedPrimary.confidence === "low") {
      unresolvedOwners.push(buildOwnerSourceGapEntry(owner));
    }
  }

  for (const owner of report.weakExistingOwners ?? []) {
    if (hasStudentRuntimeAliasCoverage(owner)) {
      continue;
    }

    const reviewCandidate = pickOwnerReviewCandidate(owner);
    if (reviewCandidate?.confidence === "high") {
      highSafetyReviewOwners.push(buildOwnerSourceGapEntry(owner, reviewCandidate));
      continue;
    }

    if (reviewCandidate?.confidence === "medium") {
      mediumOwners.push(buildOwnerSourceGapEntry(owner, reviewCandidate));
    }
  }

  const allReviewOwners = [...highSafetyReviewOwners, ...mediumOwners, ...unresolvedOwners].sort(
    (left, right) => left.title.localeCompare(right.title)
  );

  const campuses = ["uw-seattle", "uw-bothell", "uw-tacoma"].map((campusId) => {
    const entries = allReviewOwners.filter((owner) => owner.campusId === campusId);
    return {
      campusId,
      campusLabel: normalizeCampusLabel(campusId),
      totalReviewOwners: entries.length,
      highConfidenceNeedsReviewCount: entries.filter(
        (owner) => owner.status === "high-confidence-needs-review"
      ).length,
      mediumConfidenceCount: entries.filter((owner) => owner.status === "medium-confidence").length,
      unresolvedCount: entries.filter((owner) => owner.status === "needs-source-automation").length,
      entries,
    };
  });

  return {
    generatedAt: report.generatedAt,
    totalReviewOwners: allReviewOwners.length,
    highConfidenceNeedsReviewCount: highSafetyReviewOwners.length,
    mediumConfidenceCount: mediumOwners.length,
    unresolvedCount: unresolvedOwners.length,
    campuses,
  };
}

function writeMarkdown(queue) {
  const lines = [
    "# Transfer Planner Primary Source Source-Gap Report",
    "",
    `Generated: ${queue.generatedAt}`,
    "",
    `- Total source-gap owners: ${queue.totalReviewOwners}`,
    `- High-confidence suggestions needing review: ${queue.highConfidenceNeedsReviewCount}`,
    `- Medium-confidence suggestions: ${queue.mediumConfidenceCount}`,
    `- Needs source automation: ${queue.unresolvedCount}`,
    "",
    "This queue is the source-automation follow-up list after the safe high-confidence auto-promotion step.",
    "Do not use it to make student-facing claims; add better official-source discovery or parser adapters instead.",
    "",
  ];

  for (const campus of queue.campuses) {
    if (!campus.entries.length) {
      continue;
    }

    lines.push(`## ${campus.campusLabel}`, "");
    lines.push(`- Source-gap owners: ${campus.totalReviewOwners}`);
    lines.push(`- High-confidence suggestions needing review: ${campus.highConfidenceNeedsReviewCount}`);
    lines.push(`- Medium-confidence suggestions: ${campus.mediumConfidenceCount}`);
    lines.push(`- Needs source automation: ${campus.unresolvedCount}`);
    lines.push("");

    const highReviewEntries = campus.entries.filter(
      (entry) => entry.status === "high-confidence-needs-review"
    );
    if (highReviewEntries.length) {
      lines.push("### High-confidence suggestions needing review", "");
      for (const entry of highReviewEntries) {
        lines.push(`#### ${entry.title}`);
        lines.push("");
        lines.push(`- Suggested primary: ${entry.suggestedPrimary?.url ?? "none"}`);
        lines.push(`- Score: ${entry.suggestedPrimary?.score ?? "n/a"}`);
        lines.push(`- Parser type: ${entry.suggestedPrimary?.parserType ?? "n/a"}`);
        lines.push(`- Source role: ${entry.suggestedPrimary?.sourceRole ?? "n/a"}`);
        lines.push(`- Why: ${(entry.suggestedPrimary?.reasons ?? []).join("; ") || "No reasons captured."}`);
        lines.push(`- Official links scanned: ${entry.officialLinkCount}`);
        lines.push(`- Candidate URLs inspected: ${entry.candidateCount}`);
        lines.push("");
      }
    }

    const mediumEntries = campus.entries.filter((entry) => entry.status === "medium-confidence");
    if (mediumEntries.length) {
      lines.push("### Medium-confidence suggestions", "");
      for (const entry of mediumEntries) {
        lines.push(`#### ${entry.title}`);
        lines.push("");
        lines.push(`- Suggested primary: ${entry.suggestedPrimary?.url ?? "none"}`);
        lines.push(`- Score: ${entry.suggestedPrimary?.score ?? "n/a"}`);
        lines.push(`- Why: ${(entry.suggestedPrimary?.reasons ?? []).join("; ") || "No reasons captured."}`);
        lines.push(`- Official links scanned: ${entry.officialLinkCount}`);
        lines.push(`- Candidate URLs inspected: ${entry.candidateCount}`);
        if (entry.topReviewCandidates.length) {
          lines.push("- Backup candidates:");
          entry.topReviewCandidates.forEach((candidate) => {
            lines.push(`  - ${candidate.url}`);
            lines.push(`    - score: ${candidate.score}`);
            lines.push(`    - confidence: ${candidate.confidence}`);
            lines.push(`    - reasons: ${candidate.reasons.join("; ") || "No reasons captured."}`);
          });
        }
        lines.push("");
      }
    }

    const unresolvedEntries = campus.entries.filter((entry) => entry.status === "needs-source-automation");
    if (unresolvedEntries.length) {
      lines.push("### Needs source automation", "");
      for (const entry of unresolvedEntries) {
        lines.push(`- ${entry.title}`);
        lines.push(`  - Official links scanned: ${entry.officialLinkCount}`);
        lines.push(`  - Candidate URLs inspected: ${entry.candidateCount}`);
      }
      lines.push("");
    }
  }

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function main() {
  const discoverFirst = hasArg("--discover-first") || !fs.existsSync(DISCOVERY_REPORT_PATH);

  fs.mkdirSync(TMP_DIR, { recursive: true });

  if (discoverFirst) {
    runDiscovery();
  }

  if (!fs.existsSync(DISCOVERY_REPORT_PATH)) {
    throw new Error(
      `Could not find discovery report at ${DISCOVERY_REPORT_PATH}. Run planner:discover-primary-sources first.`
    );
  }

  const report = JSON.parse(fs.readFileSync(DISCOVERY_REPORT_PATH, "utf8"));
  const queue = buildQueue(report);

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(queue, null, 2)}\n`);
  writeMarkdown(queue);

  console.log(`Source-gap owners: ${queue.totalReviewOwners}`);
  console.log(`High-confidence suggestions needing review: ${queue.highConfidenceNeedsReviewCount}`);
  console.log(`Medium-confidence suggestions: ${queue.mediumConfidenceCount}`);
  console.log(`Needs source automation: ${queue.unresolvedCount}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
