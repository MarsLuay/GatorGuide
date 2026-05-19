#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.join(REPO_ROOT, ".tmp");
const OUTPUT_JSON = path.join(TMP_DIR, "transfer-planner-source-block-course-presence-audit.json");
const OUTPUT_MD = path.join(TMP_DIR, "transfer-planner-source-block-course-presence-audit.md");

const CAMPUS_ORDER = ["uw-seattle", "uw-tacoma", "uw-bothell"];
const {
  normalizeTransferPlannerPathwayId,
} = require("../../constants/transfer-planner-source/pathway-id-normalization");
const {
  TRANSFER_PLANNER_SOURCE_GAP_ENTRIES,
} = require("../../constants/transfer-planner-source/source-gaps.generated");

function readGeneratedJson(relativePath, constName) {
  const filePath = path.join(REPO_ROOT, relativePath);
  const text = fs.readFileSync(filePath, "utf8");
  const match = text.match(new RegExp(`const ${constName} = "([\\s\\S]*?)";`));
  if (!match) {
    throw new Error(`Could not find ${constName} in ${relativePath}`);
  }
  return JSON.parse(JSON.parse(`"${match[1]}"`));
}

function normalizeCourseCode(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map(normalizeCourseCode).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right)
  );
}

function ownerKey(planId, pathwayId = null) {
  const normalizedPathwayId =
    pathwayId == null ? null : normalizeTransferPlannerPathwayId(planId, pathwayId);
  return `${planId}::${normalizedPathwayId ?? ""}`;
}

const HIDDEN_SOURCE_GAP_OWNER_KEYS = new Map(
  TRANSFER_PLANNER_SOURCE_GAP_ENTRIES.filter((entry) => entry.studentVisibility === "hidden").map(
    (entry) => [
      ownerKey(entry.planId, entry.pathwayId ?? null),
      entry,
    ]
  )
);

function flattenRuntimePlanCourses(plan) {
  const values = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.courseCode === "string") values.push(node.courseCode);
    if (Array.isArray(node.uwCourses)) values.push(...node.uwCourses);
    if (Array.isArray(node.equivalentUwCourseCodes)) values.push(...node.equivalentUwCourseCodes);
    if (Array.isArray(node.displayCourseCodes)) values.push(...node.displayCourseCodes);
    for (const [key, value] of Object.entries(node)) {
      if (key === "equivalencyEvidence") continue;
      if (value && typeof value === "object") visit(value);
    }
  };
  visit(plan);
  return uniqueSorted(values);
}

function getDegreeMapCourses(plan) {
  return uniqueSorted((plan.degreeMapSections ?? []).flatMap((section) => section.items ?? []));
}

function buildOwners(majorPlans, pathwaysByPlanId) {
  const owners = [];
  for (const plan of majorPlans) {
    if (!CAMPUS_ORDER.includes(plan.campusId)) continue;
    owners.push({
      campusId: plan.campusId,
      planId: plan.id,
      pathwayId: null,
      title: plan.title,
      parentTitle: plan.title,
      plan,
    });
    for (const pathway of pathwaysByPlanId[plan.id] ?? []) {
      owners.push({
        campusId: plan.campusId,
        planId: plan.id,
        pathwayId: pathway.id,
        title: `${plan.title} - ${pathway.label ?? pathway.id}`,
        parentTitle: plan.title,
        plan: pathway,
      });
    }
  }
  return owners.sort((left, right) => {
    const campusDelta = CAMPUS_ORDER.indexOf(left.campusId) - CAMPUS_ORDER.indexOf(right.campusId);
    if (campusDelta) return campusDelta;
    return ownerKey(left.planId, left.pathwayId).localeCompare(ownerKey(right.planId, right.pathwayId));
  });
}

function hasCoursePresenceContent(plan) {
  return getDegreeMapCourses(plan).length > 0 || flattenRuntimePlanCourses(plan).length > 0;
}

function classifyOwner({
  hiddenSourceGap,
  sourceBlocks,
  parsedCourses,
  missingFromDegreeMap,
  degreeMapCourses,
  generatedCourses,
  hasParsedNonCourseRequirement,
  hasContentBearingPathways,
}) {
  if (hiddenSourceGap) return "hidden-source-gap";
  if (
    hasContentBearingPathways &&
    parsedCourses.length === 0 &&
    degreeMapCourses.length === 0 &&
    generatedCourses.length === 0
  ) {
    return "pass";
  }
  if (!sourceBlocks.length) return "source-unavailable";
  if (!sourceBlocks.some((block) => isSchedulableSourceBlock(block))) {
    return "unclear-no-schedulable-source";
  }
  if (
    hasParsedNonCourseRequirement &&
    parsedCourses.length === 0 &&
    degreeMapCourses.length === 0 &&
    generatedCourses.length === 0
  ) {
    return "pass";
  }
  if (!parsedCourses.length) return "unclear-no-parsed-courses";
  if (missingFromDegreeMap.length) return "issue";
  return "pass";
}

function isSchedulableSourceBlock(block) {
  return (
    block &&
    block.supportOnly !== true &&
    block.nonSchedulable !== true &&
    block.canCreateRequiredRows !== false &&
    block.canCreateScheduleRows !== false &&
    block.sourceScope?.supportOnly !== true &&
    block.sourceScope?.nonSchedulable !== true &&
    block.sourceScope?.canCreateRequiredRows !== false &&
    block.sourceScope?.canCreateScheduleRows !== false
  );
}

function normalizeSemanticText(value) {
  return String(value ?? "")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function sourceBlockOwnsIndependentCatalogCredential(block, parentTitle) {
  const label = normalizeSemanticText(
    block?.primarySourceLabel ?? block?.sourceLabel ?? block?.label ?? ""
  );
  const parent = normalizeSemanticText(parentTitle);
  if (!label || !parent) return false;

  const match = label.match(/\bdegree with a major in\s+(.+)$/i);
  if (!match) return false;

  return normalizeSemanticText(match[1]).startsWith(`${parent}:`);
}

function getBlocksForCoursePresence({ owner, ownBlocks, parentBlocks }) {
  if (!owner.pathwayId) return ownBlocks;
  const usesIndependentCatalogCredential = ownBlocks.some((block) =>
    sourceBlockOwnsIndependentCatalogCredential(block, owner.parentTitle)
  );
  return usesIndependentCatalogCredential ? ownBlocks : [...parentBlocks, ...ownBlocks];
}

function main() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const majorPlans = readGeneratedJson(
    "constants/transfer-planner-source/student-runtime.generated/major-plans.generated.ts",
    "TRANSFER_PLANNER_RUNTIME_MAJOR_PLANS_JSON"
  );
  const pathwaysByPlanId = readGeneratedJson(
    "constants/transfer-planner-source/student-runtime.generated/pathways-by-plan-id.generated.ts",
    "TRANSFER_PLANNER_RUNTIME_PATHWAYS_BY_PLAN_ID_JSON"
  );
  const sourceBlocks = readGeneratedJson(
    "constants/transfer-planner-source/student-runtime.generated/parsed-requirement-source-block-registry.generated.ts",
    "TRANSFER_PLANNER_RUNTIME_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY_JSON"
  );
  const blocksByOwner = new Map();
  for (const block of sourceBlocks) {
    const key = ownerKey(block.planId, block.pathwayId ?? null);
    const current = blocksByOwner.get(key) ?? [];
    current.push(block);
    blocksByOwner.set(key, current);
  }

  const owners = buildOwners(majorPlans, pathwaysByPlanId);
  const rows = owners.map((owner) => {
    const key = ownerKey(owner.planId, owner.pathwayId);
    const parentKey = ownerKey(owner.planId, null);
    const hiddenSourceGap = HIDDEN_SOURCE_GAP_OWNER_KEYS.get(key) ?? null;
    const ownBlocks = blocksByOwner.get(key) ?? [];
    const parentBlocks = owner.pathwayId ? blocksByOwner.get(parentKey) ?? [] : [];
    const blocks = getBlocksForCoursePresence({ owner, ownBlocks, parentBlocks });
    const schedulableBlocks = blocks.filter(isSchedulableSourceBlock);
    const ownSchedulableBlocks = ownBlocks.filter(isSchedulableSourceBlock);
    const parsedCourses = uniqueSorted(
      schedulableBlocks.flatMap((block) => block.parsedUwCourseCodes ?? [])
    );
    const hasParsedNonCourseRequirement = schedulableBlocks.some(
      (block) =>
        (block.parsedRequirementGroups ?? []).length > 0 &&
        !(block.parsedUwCourseCodes ?? []).length
    );
    const pathwayOwnedParsedCourses = uniqueSorted(
      (owner.pathwayId ? ownSchedulableBlocks : schedulableBlocks).flatMap(
        (block) => block.parsedUwCourseCodes ?? []
      )
    );
    const degreeMapCourses = getDegreeMapCourses(owner.plan);
    const generatedCourses = flattenRuntimePlanCourses(owner.plan);
    const hasContentBearingPathways =
      !owner.pathwayId &&
      (pathwaysByPlanId[owner.planId] ?? []).some((pathway) => hasCoursePresenceContent(pathway));
    const missingFromDegreeMap = pathwayOwnedParsedCourses.filter(
      (course) => !degreeMapCourses.includes(course)
    );
    const missingFromGenerated = pathwayOwnedParsedCourses.filter(
      (course) => !generatedCourses.includes(course)
    );
    const extraDegreeMapCourses = degreeMapCourses.filter((course) => !parsedCourses.includes(course));
    return {
      ownerId: owner.pathwayId
        ? `${owner.planId}:pathway:${owner.pathwayId}`
        : owner.planId,
      campusId: owner.campusId,
      planId: owner.planId,
      pathwayId: owner.pathwayId,
      title: owner.title,
      status: classifyOwner({
        hiddenSourceGap,
        sourceBlocks: blocks,
        parsedCourses,
        missingFromDegreeMap,
        degreeMapCourses,
        generatedCourses,
        hasParsedNonCourseRequirement,
        hasContentBearingPathways,
      }),
      hiddenSourceGap: hiddenSourceGap
        ? {
            reviewStatus: hiddenSourceGap.reviewStatus,
            sourceCoverageStatus: hiddenSourceGap.sourceCoverageStatus,
            reason: hiddenSourceGap.sourceGapReason,
            suggestedPrimaryUrl: hiddenSourceGap.suggestedPrimary?.url ?? null,
            suggestedPrimaryLabel: hiddenSourceGap.suggestedPrimary?.label ?? null,
          }
        : null,
      sourceUrls: uniqueStrings(
        blocks.flatMap((block) => [block.primarySourceUrl, block.sourceUrl, ...(block.coveredSourceUrls ?? [])])
      ),
      parsedCourseCount: parsedCourses.length,
      generatedCourseCount: generatedCourses.length,
      degreeMapCourseCount: degreeMapCourses.length,
      missingFromDegreeMap,
      missingFromGenerated,
      extraDegreeMapCourses,
      parsedCourses,
      degreeMapCourses,
      generatedCourses,
    };
  });

  const campusSummaries = CAMPUS_ORDER.map((campusId) => {
    const campusRows = rows.filter((row) => row.campusId === campusId);
    const byStatus = campusRows.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});
    return {
      campusId,
      owners: campusRows.length,
      byStatus,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    methodology:
      "Compares generated runtime/degree-map course presence against parsed official source blocks already selected by the planner source pipeline. This is a read-only source-block consistency report and does not fetch live official pages.",
    campusSummaries,
    rows,
  };
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    "# Transfer Planner Source-Block Course Presence Audit",
    "",
    report.methodology,
    "",
    "## Campus Summary",
    "",
    "| Campus | Owners | Pass | Issue | Unclear/no parsed courses | Source unavailable | Hidden source-gap |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const summary of campusSummaries) {
    lines.push(
      `| ${summary.campusId} | ${summary.owners} | ${summary.byStatus.pass ?? 0} | ${summary.byStatus.issue ?? 0} | ${(summary.byStatus["unclear-no-parsed-courses"] ?? 0) + (summary.byStatus["unclear-no-schedulable-source"] ?? 0)} | ${summary.byStatus["source-unavailable"] ?? 0} | ${summary.byStatus["hidden-source-gap"] ?? 0} |`
    );
  }
  lines.push("", "## Non-Passing Owners", "");
  for (const row of rows.filter((item) => item.status !== "pass")) {
    lines.push(`### ${row.ownerId}`);
    lines.push(`- Campus: ${row.campusId}`);
    lines.push(`- Status: ${row.status}`);
    lines.push(`- Source URLs: ${row.sourceUrls.length ? row.sourceUrls.join(", ") : "none"}`);
    if (row.hiddenSourceGap) {
      lines.push(`- Hidden source-gap reason: ${row.hiddenSourceGap.reason}`);
      if (row.hiddenSourceGap.suggestedPrimaryUrl) {
        lines.push(
          `- Suggested primary source candidate: ${row.hiddenSourceGap.suggestedPrimaryLabel ?? "candidate"} (${row.hiddenSourceGap.suggestedPrimaryUrl})`
        );
      }
    }
    lines.push(`- Parsed courses: ${row.parsedCourseCount}`);
    lines.push(`- Generated runtime traversal courses: ${row.generatedCourseCount}`);
    lines.push(`- Degree-map courses: ${row.degreeMapCourseCount}`);
    if (row.missingFromDegreeMap.length) {
      lines.push(`- Missing from degree map: ${row.missingFromDegreeMap.join(", ")}`);
    }
    if (row.missingFromGenerated.length) {
      lines.push(
        `- Not found in generated runtime traversal (usually unmapped/degree-map-only evidence): ${row.missingFromGenerated.join(", ")}`
      );
    }
    if (row.extraDegreeMapCourses.length) {
      lines.push(`- Extra degree-map courses not in parsed source block: ${row.extraDegreeMapCourses.join(", ")}`);
    }
    lines.push("");
  }
  fs.writeFileSync(OUTPUT_MD, `${lines.join("\n")}\n`);

  console.log("Official course-presence audit complete.");
  for (const summary of campusSummaries) {
    const unclearCount =
      (summary.byStatus["unclear-no-parsed-courses"] ?? 0) +
      (summary.byStatus["unclear-no-schedulable-source"] ?? 0);
    console.log(
      `${summary.campusId}: owners=${summary.owners} pass=${summary.byStatus.pass ?? 0} issues=${summary.byStatus.issue ?? 0} unclear=${unclearCount} source-unavailable=${summary.byStatus["source-unavailable"] ?? 0} hidden-source-gap=${summary.byStatus["hidden-source-gap"] ?? 0}`
    );
  }
  console.log(`JSON report: ${OUTPUT_JSON}`);
  console.log(`Markdown report: ${OUTPUT_MD}`);

  const issueCount = rows.filter((row) => row.status === "issue").length;
  if (issueCount) {
    process.exitCode = 1;
  }
}

main();
