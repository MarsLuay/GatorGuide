const fs = require("fs");
const path = require("path");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
    jsx: "react-jsx",
    baseUrl: ".",
    paths: {
      "@/*": ["./*"],
    },
  },
});
require("tsconfig-paths/register");

const source = require("../../constants/transfer-planner-source");
const studentRuntime = require("../../constants/transfer-planner-source/student-runtime");
const planner = require("../../services/planning/transfer-planner.service");
const parser = require("./parse-transfer-planner-requirement-sources.cjs");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const OUTPUT_JSON_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-source-backed-coverage-audit.json"
);
const OUTPUT_MD_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-source-backed-coverage-audit.md"
);
const GENERATED_REGISTRY_OUTPUT_JSON_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-generated-registry-audit.json"
);
const GENERATED_REGISTRY_OUTPUT_MD_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-generated-registry-audit.md"
);
const MAPPING_AUDIT_OUTPUT_JSON_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-mapping-audit.json"
);
const MAPPING_AUDIT_OUTPUT_MD_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-mapping-audit.md"
);

const ISSUE_TYPES = [
  "missing-detected-course",
  "unmapped-uw-only",
  "over-scheduled-alternatives",
  "stale-match-count",
  "gen-ed-scope-leak",
  "option-group-disappears-after-refresh",
  "prep-credit-counted-as-main",
  "partial-compound-path",
  "missing-compound-path",
  "over-expanded-compound-path",
  "duplicate-compound-count",
  "missing-option-group",
  "missing-category-option",
  "missing-credit-bucket",
  "required-count-used-for-credit-bucket",
  "missed-option-group",
  "unsafe-comma-list",
  "missed-sequence-choice",
  "flattened-sequence-paths",
  "merged-adjacent-rows",
  "missing-ce-approved-filter",
  "missing-approved-filter",
  "missing-program-approved-filter",
  "missing-approved-course-list-source",
  "missing-elective-list-source",
  "generic-category-used-as-ce-approved",
  "generic-category-used-as-approved",
  "generic-category-used-as-program-approved",
  "generic-category-used-for-program-specific",
  "fake-course-invented",
  "fake-category-course",
  "category-option-invented-course",
  "false-required-promotion",
  "parser-source-scope-violation",
  "source-scope-contamination",
  "prerequisite-table-emitted-requirement",
  "course-list-emitted-requirement",
  "support-source-emitted-required-row",
  "support-source-created-required-row",
  "approved-list-source-created-required-row",
  "approved-course-list-promoted-to-required",
  "elective-list-promoted-to-required",
  "upper-division-prerequisite-table-scheduled",
  "non-schedulable-course-list-scheduled",
  "non-schedulable-source-scheduled",
  "unscoped-generated-seed",
  "support-source-generated-required-row",
  "stale-manual-seed",
  "flattened-option-group",
  "flattened-credit-bucket",
  "flattened-sequence-choice",
  "support-metadata-became-required",
  "pathway-leak",
  "path-note-unscoped",
  "approved-list-generated-required-row",
  "elective-list-generated-required-row",
  "hidden-informational-row-scheduled",
  "generated-row-without-primary-source",
  "wrong-shape",
  "flattened-option",
  "credit-bucket-as-count",
  "sequence-choice-flattened",
  "elective-list-as-required",
  "hidden-row-as-required",
  "list-promoted-to-required",
  "support-list-scheduled",
  "missing-list-shape",
  "missing-equivalency",
  "fake-equivalency",
  "unsupported-substitution",
  "stale-equivalency",
  "unselected-option-scheduled",
  "selected-option-not-scheduled",
  "stale-selection",
  "false-required-sibling",
  "placeholder-atom-scheduled",
  "non-selected-compound-option-scheduled",
  "mixed-sequence-paths",
  "standalone-lab-component-scheduled",
  "placeholder-promoted-to-required",
  "partial-compound-path-scheduled",
  "missing-compound-component",
  "duplicate-compound-component",
];
const SOURCE_SCOPE_ISSUE_TYPES = [
  "parser-source-scope-violation",
  "source-scope-contamination",
  "support-source-emitted-required-row",
  "support-source-created-required-row",
  "approved-list-source-created-required-row",
  "approved-course-list-promoted-to-required",
  "elective-list-promoted-to-required",
  "upper-division-prerequisite-table-scheduled",
  "non-schedulable-course-list-scheduled",
  "non-schedulable-source-scheduled",
  "unscoped-generated-seed",
  "support-source-generated-required-row",
  "stale-manual-seed",
  "support-metadata-became-required",
  "approved-list-generated-required-row",
  "elective-list-generated-required-row",
  "hidden-informational-row-scheduled",
  "generated-row-without-primary-source",
  "pathway-leak",
  "path-note-unscoped",
  "list-promoted-to-required",
  "support-list-scheduled",
  "missing-list-shape",
];

const GENERATED_REGISTRY_PROTECTED_PLAN_IDS = new Set([
  "uw-seattle-computer-science",
  "uw-seattle-computer-engineering",
  "uw-seattle-environmental-engineering",
  "uw-seattle-aeronautics-astronautics",
  "uw-seattle-biology",
  "uw-seattle-biochemistry",
  "uw-seattle-chemistry",
  "uw-seattle-chemical-engineering",
  "uw-seattle-materials-science-engineering",
  "uw-seattle-sustainable-bioresource-systems-engineering",
  "uw-seattle-informatics",
]);

const REQUIRED_SINGLE_EQUIVALENCY_MAPPINGS = [
  ["CHEM& 161", "CHEM 142"],
  ["PHYS& 221", "PHYS 121"],
  ["PHYS& 222", "PHYS 122"],
  ["PHYS& 223", "PHYS 123"],
  ["ENGL& 101", "ENGL 131"],
  ["MATH& 151", "MATH 124"],
  ["MATH& 152", "MATH 125"],
  ["MATH& 163", "MATH 126"],
  ["MATH 240", "MATH 208"],
  ["MATH 238", "MATH 207"],
  ["ENGR& 204", "EE 215"],
];

const REQUIRED_COMPOUND_EQUIVALENCY_MAPPINGS = [
  {
    sourceCourseSet: ["CHEM& 162", "CHEM& 163"],
    expectedUwTargets: ["CHEM 152", "CHEM 162"],
  },
  {
    sourceCourseSet: ["BIOL& 211", "BIOL& 212", "BIOL& 213"],
    expectedUwTargets: ["BIOL 180", "BIOL 200", "BIOL 220"],
  },
  {
    sourceCourseSet: ["PHYS& 114", "PHYS& 154"],
    expectedUwTargets: ["PHYS 114", "PHYS 117"],
  },
  {
    sourceCourseSet: ["PHYS& 115", "PHYS& 155"],
    expectedUwTargets: ["PHYS 115", "PHYS 118"],
  },
  {
    sourceCourseSet: ["PHYS& 116", "PHYS& 156"],
    expectedUwTargets: ["PHYS 116", "PHYS 119"],
  },
  {
    sourceCourseSet: ["CHEM& 261", "CHEM& 262"],
    expectedUwTargets: ["CHEM 237", "CHEM 238", "CHEM 241"],
  },
  {
    sourceCourseSet: ["CHEM& 261", "CHEM& 262", "CHEM& 263"],
    expectedUwTargets: ["CHEM 237", "CHEM 238", "CHEM 239", "CHEM 241", "CHEM 242"],
  },
];

const CATEGORY_MAPPING_AUDIT_SOURCE_SETS = [
  ["ANTH& 205"],
  ["PHYS& 223"],
  ["CS 121"],
  ["CHEM& 162", "CHEM& 163"],
  ["BIOL& 211", "BIOL& 212", "BIOL& 213"],
];

const UW_CAMPUSES = new Set(["uw-seattle", "uw-bothell", "uw-tacoma"]);
const CONCRETE_UW_ONLY_PATTERN = /\b[A-Z]{2,8}\s*[123]\d{2}\b/i;
const UPPER_DIVISION_UW_PATTERN = /\b[A-Z]{2,8}\s*[3-5]\d{2}\b/i;
const SOURCE_BACKED_REQUIRED_COURSE_NON_REQUIREMENT_CUE_PATTERN =
  /\b(approved list|not required for transferring|electives?|general electives?|free electives?|replacement|course list|course lists|course evaluation|course evaluations|recommended|suggested|consider|first year students|suggested general education|suggested course pathways?|choose\s+(?:one|[0-9]+)|one\s+of|select(?:ed|ing)?|\d+\s+credits?\s+from|minimum\s+\d+\s+credits?[^.]{0,80}\bfrom)\b/i;
const SCHEDULABLE_SOURCE_ROLES = new Set([
  "degree-requirements",
  "catalog",
  "curriculum",
  "worksheet",
  "official-catalog",
  "primary-degree-requirements",
  "department-requirements",
  "pathway-degree-sheet",
]);
const SOURCE_ROLE_STATUS_BY_ROLE = {
  "degree-requirements": "primary",
  catalog: "primary",
  curriculum: "primary",
  worksheet: "primary",
  admissions: "support",
  overview: "support",
  equivalency: "support",
  availability: "support",
  other: "support",
  "official-catalog": "primary",
  "primary-degree-requirements": "primary",
  "department-requirements": "primary",
  "pathway-degree-sheet": "primary",
  "approved-course-list": "support",
  "elective-list": "support",
  "support-source": "support",
  "admission-prerequisite-source": "support",
  "admissions-preparation": "support",
  "sample-schedule": "support",
  "curriculum-map": "support",
  "transfer-equivalency": "support",
  "matched-grc-track": "support",
  "upper-division-prerequisite-table": "non-schedulable",
  "non-schedulable-course-list": "non-schedulable",
  "old-archival": "ignored",
  ignored: "ignored",
};

function getSourceRoleStatus(role) {
  return SOURCE_ROLE_STATUS_BY_ROLE[role] ?? "ignored";
}

function canSourceRoleCreateSchedulableRows(role) {
  return SCHEDULABLE_SOURCE_ROLES.has(role);
}

function canParsedBlockCreateSchedulableRows(block) {
  if (
    block?.canCreateSchedulableRows === false ||
    block?.canCreateScheduleRows === false ||
    block?.canCreateRequiredRows === false ||
    block?.supportOnly === true ||
    block?.nonSchedulable === true
  ) {
    return false;
  }

  const role = block?.sourceRole ?? null;
  return !role || canSourceRoleCreateSchedulableRows(role);
}

const TRACK_IDS = {
  accountingAaa: "grc-associate-business-entrepreneurship-accounting-aaa",
  ast2ComputerElectrical:
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-computer-and-electrical-engineering",
  ast2CivilMechanical:
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-civil-and-mechanical-engineering",
  ast2BioChemical:
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-bioengineering-and-chemical-engineering",
};

const ME_EXPECTED_REQUIREMENTS = [
  ["AA 210", ["AA 210"], ["ENGR& 214"]],
  ["AMATH 301", ["AMATH 301"], ["ENGR 250"]],
  ["CHEM 152", ["CHEM 152"], ["CHEM& 162", "CHEM& 163"]],
  ["CEE 220", ["CEE 220"], ["ENGR& 225"]],
  ["E E 215", ["E E 215", "EE 215"], ["ENGR& 204"]],
  ["M E 123", ["M E 123", "ME 123"], ["ENGR& 114"]],
  ["ME 230", ["ME 230"], ["ENGR& 215"]],
  ["MSE 170", ["MSE 170"], ["ENGR 140"]],
  ["PHYS 123", ["PHYS 123"], ["PHYS& 223"]],
  ["MATH 207", ["MATH 207"], ["MATH 238"]],
  ["MATH 208", ["MATH 208"], ["MATH 240"]],
  ["ENGL 131", ["ENGL 131"], ["ENGL& 101"]],
];
const ME_ENGINEERING_FUNDAMENTALS_UW_CODES = [
  "AA 210",
  "AMATH 301",
  "CEE 220",
  "EE 215",
  "ME 123",
  "ME 230",
  "MSE 170",
];

const CIVIL_EXPECTED_REQUIREMENTS = [
  ["CHEM 152", ["CHEM 152"], ["CHEM& 162", "CHEM& 163"]],
  ["Basic Science Elective", ["BIOL 180", "ESS 101"], ["NATRS 210", "GEOL& 101"], "choose 1"],
  [
    "Statistics: IND E 315, QSCI 381, STAT 290, or STAT 390",
    ["INDE 315", "QSCI 381", "STAT 290", "STAT 390"],
    [],
    "choose 1",
  ],
];

const BIOENGINEERING_EXPECTED_REQUIREMENTS = [
  ["MATH 124", ["MATH 124"], ["MATH& 151"]],
  ["MATH 125", ["MATH 125"], ["MATH& 152"]],
  ["MATH 126", ["MATH 126"], ["MATH& 163"]],
  ["MATH 207 or AMATH 351", ["MATH 207", "AMATH 351"], ["MATH 238"], "choose 1"],
  ["MATH 208 or AMATH 352", ["MATH 208", "AMATH 352"], ["MATH 240"], "choose 1"],
  ["CHEM 142", ["CHEM 142"], ["CHEM& 161"]],
  ["CHEM 152", ["CHEM 152"], ["CHEM& 162"]],
  ["CHEM 162", ["CHEM 162"], ["CHEM& 163"]],
  ["CHEM 223 or CHEM 237", ["CHEM 223", "CHEM 237"], ["CHEM& 261"], "choose 1"],
  ["PHYS 121", ["PHYS 121"], ["PHYS& 221"]],
  ["PHYS 122", ["PHYS 122"], ["PHYS& 222"]],
  ["BIOL 180", ["BIOL 180"], ["BIOL& 211"]],
  ["BIOL 200", ["BIOL 200"], ["BIOL& 212"]],
  ["BIOL 220", ["BIOL 220"], ["BIOL& 213"]],
  ["AMATH 301", ["AMATH 301"], ["ENGR 250"]],
  ["English Composition", ["ENGL 131"], ["ENGL& 101"]],
  [
    "STAT 311, STAT 390, IND E 315, or Q SCI 381",
    ["STAT 311", "STAT 390", "INDE 315", "QSCI 381"],
    [],
    "choose 1",
  ],
];

function getArgValue(flag) {
  const args = process.argv.slice(2);
  const directPrefix = `${flag}=`;
  const directMatch = args.find((arg) => arg.startsWith(directPrefix));
  if (directMatch) {
    return directMatch.slice(directPrefix.length).trim() || null;
  }

  const flagIndex = args.indexOf(flag);
  if (flagIndex === -1) {
    return null;
  }

  const nextValue = args[flagIndex + 1];
  if (!nextValue || nextValue.startsWith("--")) {
    return null;
  }

  return String(nextValue).trim() || null;
}

function hasFlag(flag) {
  return process.argv.slice(2).includes(flag);
}

function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function normalizeCourseCode(value) {
  return planner.normalizeCourseCode(String(value ?? ""));
}

function extractCourseCodes(value) {
  return planner.extractCourseCodes(String(value ?? ""));
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map(String).map((value) => value.trim()).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right)
  );
}

function slugifyAuditId(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeMarkdown(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|");
}

function joinList(values) {
  return values.length ? values.join(", ") : "none";
}

function joinSourceUrls(values) {
  const urls = uniqueSorted(values.filter(Boolean));
  return urls.length ? urls.join(" | ") : "none";
}

function getSuggestedFileForIssue(issueType) {
  switch (issueType) {
    case "parser-source-scope-violation":
    case "support-source-emitted-required-row":
    case "support-source-created-required-row":
    case "approved-list-source-created-required-row":
    case "approved-course-list-promoted-to-required":
    case "elective-list-promoted-to-required":
    case "upper-division-prerequisite-table-scheduled":
    case "non-schedulable-course-list-scheduled":
    case "non-schedulable-source-scheduled":
    case "source-scope-contamination":
    case "prerequisite-table-emitted-requirement":
    case "course-list-emitted-requirement":
    case "missed-option-group":
    case "unsafe-comma-list":
    case "false-required-promotion":
    case "missed-sequence-choice":
    case "flattened-sequence-paths":
    case "merged-adjacent-rows":
    case "missing-credit-bucket":
      return "source/scripts/planner/parse-transfer-planner-requirement-sources.cjs";
    case "unscoped-generated-seed":
    case "support-source-generated-required-row":
    case "stale-manual-seed":
    case "flattened-option-group":
    case "flattened-credit-bucket":
    case "flattened-sequence-choice":
    case "pathway-leak":
    case "path-note-unscoped":
    case "support-metadata-became-required":
    case "approved-list-generated-required-row":
    case "elective-list-generated-required-row":
    case "hidden-informational-row-scheduled":
    case "generated-row-without-primary-source":
    case "wrong-shape":
    case "flattened-option":
    case "credit-bucket-as-count":
    case "sequence-choice-flattened":
    case "elective-list-as-required":
    case "hidden-row-as-required":
    case "list-promoted-to-required":
    case "support-list-scheduled":
    case "missing-list-shape":
      return "source/constants/transfer-planner-source/generated-major-plans.ts";
    case "missing-approved-course-list-source":
    case "missing-elective-list-source":
      return "source/scripts/planner/discover-transfer-planner-primary-sources.cjs";
    case "missing-equivalency":
    case "fake-equivalency":
    case "unsupported-substitution":
    case "stale-equivalency":
    case "missing-compound-path":
    case "partial-compound-path":
    case "over-expanded-compound-path":
    case "duplicate-compound-count":
      return "source/scripts/planner/parse-transfer-planner-equivalency-guide.cjs";
    case "missing-program-approved-filter":
    case "generic-category-used-as-program-approved":
    case "generic-category-used-as-ce-approved":
    case "generic-category-used-for-program-specific":
    case "generic-category-used-as-approved":
    case "fake-course-invented":
    case "category-option-invented-course":
    case "required-count-used-for-credit-bucket":
      return "source/constants/transfer-planner-source/generated-major-plans.ts";
    case "unselected-option-scheduled":
    case "selected-option-not-scheduled":
    case "stale-selection":
    case "false-required-sibling":
    case "placeholder-atom-scheduled":
    case "non-selected-compound-option-scheduled":
    case "mixed-sequence-paths":
    case "standalone-lab-component-scheduled":
    case "placeholder-promoted-to-required":
    case "partial-compound-path-scheduled":
    case "missing-compound-component":
    case "duplicate-compound-component":
      return "source/services/planning/transfer-planner.service.ts";
    default:
      return "source/scripts/planner/audit-transfer-planner-source-backed-coverage.cjs";
  }
}

function getCourseLevel(courseCode) {
  const match = String(courseCode ?? "").match(/\b(\d{3})/);
  return match ? Number(match[1]) : null;
}

function isLowerDivisionCourseCode(courseCode) {
  const level = getCourseLevel(courseCode);
  return level !== null && level < 300;
}

function sourceLineLooksRequirementBacked(lines) {
  const normalizedLines = (lines ?? [])
    .map((line) => String(line ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!normalizedLines.length) {
    return true;
  }

  return normalizedLines.some(
    (line) => !SOURCE_BACKED_REQUIRED_COURSE_NON_REQUIREMENT_CUE_PATTERN.test(line)
  );
}

function buildOwnerId(planId, pathwayId) {
  return pathwayId ? `${planId}:pathway:${pathwayId}` : planId;
}

function buildOwners(targetPlanId = null) {
  const owners = [];

  for (const plan of source.TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS ?? []) {
    if (!UW_CAMPUSES.has(plan.campusId)) {
      continue;
    }
    if (targetPlanId && plan.id !== targetPlanId) {
      continue;
    }

    owners.push({
      ownerId: buildOwnerId(plan.id, null),
      planId: plan.id,
      pathwayId: null,
      title: plan.title,
      campusId: plan.campusId,
    });

    for (const pathway of source.getTransferPlannerPathwaysForPlan(plan) ?? []) {
      owners.push({
        ownerId: buildOwnerId(plan.id, pathway.id),
        planId: plan.id,
        pathwayId: pathway.id,
        title: `${plan.title} - ${pathway.label}`,
        campusId: plan.campusId,
      });
    }
  }

  return owners.sort((left, right) => left.ownerId.localeCompare(right.ownerId));
}

function buildGeneratedRegistryAuditOwners(targetPlanId = null, protectedOnly = false) {
  return buildOwners(targetPlanId).filter(
    (owner) => !protectedOnly || GENERATED_REGISTRY_PROTECTED_PLAN_IDS.has(owner.planId)
  );
}

function resolveRuntimePlan(planId, pathwayId) {
  const runtimePlan = source.getTransferPlannerStudentRuntimeMajorPlan(planId);
  if (!runtimePlan) {
    return null;
  }

  return source.resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, pathwayId ?? null);
}

function resolveCompactStudentRuntimePlan(planId, pathwayId) {
  const runtimePlan = studentRuntime.getTransferPlannerMajorPlan(planId);
  if (!runtimePlan) {
    return null;
  }

  return studentRuntime.resolveTransferPlannerMajorPlan(runtimePlan, pathwayId ?? null);
}

function getPrimarySourceUrl(planId, pathwayId) {
  return source.getTransferPlannerPrimaryDegreeRequirementsSource(planId, pathwayId ?? null)?.url ?? null;
}

function getChecklistItems(plan) {
  return [
    ...(plan?.applicationChecklist ?? []),
    ...(plan?.beforeEnrollmentChecklist ?? []),
    ...(plan?.stayAtGrcChecklist ?? []),
  ];
}

function getRuntimeGeneratedCourseCodes(plan) {
  return new Set(
    [
      ...source.getTransferPlannerGrcCourseList(plan),
      ...getChecklistItems(plan).flatMap((item) => [
        ...(item.grcCourses ?? []),
        ...(item.alternatives ?? []).flat(),
        ...(item.requirementGroup?.options ?? []).flatMap((option) => option.grcMatches ?? []),
      ]),
    ]
      .flatMap((label) => extractCourseCodes(label))
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
}

function normalizeSourceAuditUrl(value) {
  return String(value ?? "").trim();
}

function getRuntimeGeneratedCourseCodesForSource(plan, sourceUrl) {
  const normalizedSourceUrl = normalizeSourceAuditUrl(sourceUrl);
  if (!normalizedSourceUrl) {
    return new Set();
  }

  return new Set(
    getChecklistItems(plan)
      .filter((item) => normalizeSourceAuditUrl(item.sourceUrl) === normalizedSourceUrl)
      .flatMap((item) => [
        ...(item.grcCourses ?? []),
        ...(item.alternatives ?? []).flat(),
        ...(item.requirementGroup?.options ?? []).flatMap((option) => option.grcMatches ?? []),
      ])
      .flatMap((label) => extractCourseCodes(label))
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
}

function collectRequirementGroupUwCourses(group) {
  return uniqueSorted(
    (group?.options ?? [])
      .flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
        ...(option.displayCourseCodes ?? []),
      ])
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
}

function getChecklistItemUwCourseCodes(item) {
  const groupCodes = collectRequirementGroupUwCourses(item?.requirementGroup);
  if (groupCodes.length) {
    return groupCodes;
  }
  return uniqueSorted(extractCourseCodes(`${item?.title ?? ""} ${item?.note ?? ""}`).map(normalizeCourseCode));
}

function getChecklistItemGrcCourseCodes(item) {
  return uniqueSorted(
    [
      ...(item?.grcCourses ?? []),
      ...(item?.alternatives ?? []).flat(),
      ...(item?.requirementGroup?.options ?? []).flatMap((option) => option.grcMatches ?? []),
    ]
      .flatMap((label) => extractCourseCodes(label))
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
}

function isSupportOrNonSchedulableGeneratedSourceRole(role) {
  const status = getSourceRoleStatus(String(role ?? "ignored"));
  return status === "support" || status === "non-schedulable" || status === "ignored";
}

function checklistItemCreatesGeneratedScheduleRow(item) {
  return getChecklistItemGrcCourseCodes(item).length > 0;
}

function getSchedulableParsedUwCoursesForOwner(owner) {
  return uniqueSorted(
    source
      .getTransferPlannerParsedRequirementSourceBlocks(owner.planId, owner.pathwayId)
      .filter(canParsedBlockCreateSchedulableRows)
      .flatMap((block) => [
        ...(block.parsedUwCourseCodes ?? []),
        ...(block.parsedRequirementAtomCandidates ?? []).map((candidate) => candidate.uwCourseCode),
        ...(block.parsedRequirementCourses ?? []).map(
          (course) => course.normalizedCourseCode ?? course.courseCode
        ),
        ...(block.parsedRequirementGroups ?? []).flatMap((group) =>
          (group.options ?? []).flatMap((option) => [
            ...(option.uwCourses ?? []),
            ...(option.equivalentUwCourseCodes ?? []),
            ...(option.displayCourseCodes ?? []),
          ])
        ),
      ])
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
}

function getScopedUwCoursesBackingGrcCourse(owner, grcCourseCode) {
  const normalizedGrcCourseCode = normalizeCourseCode(grcCourseCode);
  if (!normalizedGrcCourseCode) {
    return [];
  }
  return getSchedulableParsedUwCoursesForOwner(owner).filter((uwCourseCode) =>
    getGrcEquivalentsForUwCourse(uwCourseCode).includes(normalizedGrcCourseCode)
  );
}

const GENERATED_COURSE_LIST_SEED_WATCHLIST_BY_PLAN = {
  "uw-seattle-computer-science": new Set(["MATH 240", "PHYS& 222"]),
};

function getGeneratedCourseListSeedWatchlist(owner) {
  return GENERATED_COURSE_LIST_SEED_WATCHLIST_BY_PLAN[owner.planId] ?? new Set();
}

function classifyGeneratedSeedIssue(row) {
  const hasScheduleSurface =
    row.canCreateScheduleRow !== false && row.generatedGrcCourseCodes.length > 0;
  const primaryScoped = /primary-schedulable/i.test(String(row.sourceScope ?? ""));
  const trustedSchedulableScope =
    row.canCreateScheduleRow &&
    row.sourceUrl &&
    !/support|non-schedulable|unscoped/i.test(String(row.sourceScope ?? ""));
  if (!hasScheduleSurface) {
    return "none";
  }

  if (String(row.sourceRole ?? "") === "approved-course-list") {
    return "approved-list-generated-required-row";
  }

  if (String(row.sourceRole ?? "") === "elective-list") {
    return "elective-list-generated-required-row";
  }

  if (
    ["upper-division-prerequisite-table", "non-schedulable-course-list", "ignored", "old-archival"].includes(
      String(row.sourceRole ?? "")
    ) ||
    /hidden|informational|non-schedulable|ignored/i.test(String(row.sourceScope ?? ""))
  ) {
    return "hidden-informational-row-scheduled";
  }

  if (
    !primaryScoped &&
    !trustedSchedulableScope &&
    (isSupportOrNonSchedulableGeneratedSourceRole(row.sourceRole) ||
      /support|non-schedulable/i.test(String(row.sourceScope ?? "")))
  ) {
    return "support-metadata-became-required";
  }

  if (!row.sourceUrl) {
    return "generated-row-without-primary-source";
  }

  if (
    !primaryScoped &&
    !trustedSchedulableScope &&
    !canSourceRoleCreateSchedulableRows(row.sourceRole)
  ) {
    return row.manualOverride ? "stale-manual-seed" : "unscoped-generated-seed";
  }

  return "none";
}

function buildGeneratedSourceSeedAuditRowsForOwner(owner) {
  const runtimePlan = resolveCompactStudentRuntimePlan(owner.planId, owner.pathwayId);
  if (!runtimePlan) {
    return [];
  }

  const rows = [];
  const checklistItems = getChecklistItems(runtimePlan);
  const checklistGrcCodes = new Set(
    checklistItems.flatMap(getChecklistItemGrcCourseCodes).map(normalizeCourseCode)
  );
  const primarySource = studentRuntime.getTransferPlannerPrimaryDegreeRequirementsSource(
    owner.planId,
    owner.pathwayId
  );

  for (const item of checklistItems) {
    const sourceRole =
      item.sourceRole ??
      item.requirementGroup?.sourceRole ??
      primarySource?.role ??
      null;
    const sourceUrl =
      item.sourceUrl ??
      item.requirementGroup?.sourceUrl ??
      primarySource?.url ??
      null;
    const sourceScope =
      item.sourceScope ??
      (item.requirementGroup?.supportOnly
        ? "support-only"
        : item.requirementGroup?.sourceSectionSchedulable === false
          ? "non-schedulable"
          : "primary-schedulable");
    const sourceSection =
      item.sourceSection ??
      item.requirementGroup?.sourceSection ??
      item.requirementGroup?.sourceHeading ??
      null;
    const generatedGrcCourseCodes = getChecklistItemGrcCourseCodes(item);
    const manualOverride = item.manualOverride === true;
    const canCreateScheduleRow =
      item.canCreateScheduleRow ??
      (canSourceRoleCreateSchedulableRows(sourceRole) &&
        !/support|non-schedulable/i.test(String(sourceScope ?? "")));
    const row = {
      ownerId: owner.ownerId,
      generatedFile: manualOverride
        ? "source/constants/transfer-planner-source/generated-major-plans.ts"
        : "source/constants/transfer-planner-source/student-runtime.generated.ts",
      requirementCourse: item.title,
      uwCourse: joinList(getChecklistItemUwCourseCodes(item)),
      grcMappingPath: joinList(generatedGrcCourseCodes),
      generatedGrcCourseCodes,
      sourceUrl,
      sourceRole,
      sourceScope,
      sourceSection,
      generatedFromParser: item.generatedFromParser === true,
      manualOverride,
      canCreateScheduleRow,
      reason: item.reason ?? null,
    };
    const issue = classifyGeneratedSeedIssue(row);
    rows.push({
      ...row,
      issue,
      copyOnlyDebugText: [
        "[generated source seed audit]",
        `Owner id: ${owner.ownerId}`,
        `Generated file: ${row.generatedFile}`,
        `Requirement/course: ${row.requirementCourse}`,
        `UW course: ${row.uwCourse}`,
        `GRC mapping/path: ${row.grcMappingPath}`,
        `Source URL: ${row.sourceUrl ?? "none"}`,
        `Source role: ${row.sourceRole ?? "none"}`,
        `Source scope: ${row.sourceScope ?? "none"}`,
        `Manual override: ${row.manualOverride ? "yes" : "no"}`,
        `Can create schedule row: ${row.canCreateScheduleRow ? "yes" : "no"}`,
        `Issue: ${issue}`,
      ].join(" "),
    });
  }

  const watchlist = getGeneratedCourseListSeedWatchlist(owner);
  for (const courseCode of studentRuntime.getTransferPlannerGrcCourseList(runtimePlan).map(normalizeCourseCode)) {
    if (!watchlist.has(courseCode) || checklistGrcCodes.has(courseCode)) {
      continue;
    }

    const scopedUwCourses = getScopedUwCoursesBackingGrcCourse(owner, courseCode);
    const sourceRole = primarySource?.role ?? null;
    const sourceUrl = primarySource?.url ?? null;
    const canCreateScheduleRow =
      Boolean(scopedUwCourses.length) &&
      (primarySource?.isPrimaryDegreeRequirementsLink === true ||
        canSourceRoleCreateSchedulableRows(sourceRole));
    const issue = canCreateScheduleRow ? "none" : "unscoped-generated-seed";
    const row = {
      ownerId: owner.ownerId,
      generatedFile: "source/constants/transfer-planner-source/student-runtime.generated.ts",
      requirementCourse: courseCode,
      uwCourse: joinList(scopedUwCourses),
      grcMappingPath: courseCode,
      generatedGrcCourseCodes: [courseCode],
      sourceUrl,
      sourceRole,
      sourceScope: canCreateScheduleRow ? "primary-schedulable-course-list" : "unscoped-course-list",
      sourceSection: null,
      generatedFromParser: false,
      manualOverride: false,
      canCreateScheduleRow,
      reason: canCreateScheduleRow
        ? "Generated course-list seed is backed by a scoped primary parsed UW requirement."
        : "Generated course-list seed is not backed by a scoped primary parsed UW requirement.",
      issue,
      copyOnlyDebugText: [
        "[generated source seed audit]",
        `Owner id: ${owner.ownerId}`,
        "Generated file: source/constants/transfer-planner-source/student-runtime.generated.ts",
        `Requirement/course: ${courseCode}`,
        `UW course: ${joinList(scopedUwCourses)}`,
        `GRC mapping/path: ${courseCode}`,
        `Source URL: ${sourceUrl ?? "none"}`,
        `Source role: ${sourceRole ?? "none"}`,
        `Source scope: ${canCreateScheduleRow ? "primary-schedulable-course-list" : "unscoped-course-list"}`,
        "Manual override: no",
        `Can create schedule row: ${canCreateScheduleRow ? "yes" : "no"}`,
        `Issue: ${issue}`,
      ].join(" "),
    };
    rows.push(row);
  }

  return rows;
}

function buildQuarterPlan(plan, options = {}) {
  const completedCourses = options.completedCourses ?? [];
  return planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(plan?.applicationChecklist ?? [], completedCourses),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(
      plan?.beforeEnrollmentChecklist ?? [],
      completedCourses
    ),
    stayAtGrcStatuses: planner.buildRequirementStatuses(plan?.stayAtGrcChecklist ?? [], completedCourses),
    completedCourses,
    track: source.getTransferPlannerTrack(plan?.bestTrackId ?? null),
    plannerCollegeId: options.plannerCollegeId ?? "uw",
    includeStayAtGrcCourses: options.includeStayAtGrcCourses ?? false,
    includeStemPrepCourses: options.includeStemPrepCourses ?? false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: options.selectedRequirementOptionIdsByGroup ?? {},
  });
}

function buildRuntimeOptionResolutionAuditRowsForOwner(owner) {
  const plan = resolveRuntimePlan(owner.planId, owner.pathwayId);
  if (!plan) {
    return [];
  }

  const selectedRequirementOptionIdsByGroup = {};
  const suggestedPlan = buildQuarterPlan(plan, {
    completedCourses: [],
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    selectedRequirementOptionIdsByGroup,
  });

  return planner.auditRuntimeOptionResolution({
    ownerId: owner.ownerId,
    plan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup,
  });
}

function buildRuntimeCompoundSequenceAuditRowsForOwner(owner) {
  const plan = resolveRuntimePlan(owner.planId, owner.pathwayId);
  if (!plan) {
    return [];
  }

  const selectedRequirementOptionIdsByGroup = {};
  const completedCourses = [];
  const suggestedPlan = buildQuarterPlan(plan, {
    completedCourses,
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    selectedRequirementOptionIdsByGroup,
  });

  return planner.auditCompoundSequenceOptionScheduling({
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup,
  });
}

function buildRequiredCoverageSequenceSuppressionAuditRowsForOwner(owner) {
  const plan = resolveRuntimePlan(owner.planId, owner.pathwayId);
  if (!plan) {
    return [];
  }

  const selectedRequirementOptionIdsByGroup = {};
  const completedCourses = [];
  const suggestedPlan = buildQuarterPlan(plan, {
    completedCourses,
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    selectedRequirementOptionIdsByGroup,
  });

  return planner.auditRequiredCoverageSequenceSuppression({
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup,
  });
}

function buildRuntimeCompoundSchedulingAuditRowsForOwner(owner) {
  const plan = resolveRuntimePlan(owner.planId, owner.pathwayId);
  if (!plan) {
    return [];
  }

  const selectedRequirementOptionIdsByGroup = {};
  const completedCourses = [];
  const suggestedPlan = buildQuarterPlan(plan, {
    completedCourses,
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    selectedRequirementOptionIdsByGroup,
  });

  return planner.auditRuntimeCompoundScheduling({
    ownerId: owner.ownerId,
    plan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup,
  });
}

function buildGrcQuarterPlan(track, options = {}) {
  return planner.buildSuggestedQuarterPlan({
    plan: null,
    plannerCollegeId: "grc",
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    includeStemPrepCourses: options.includeStemPrepCourses ?? false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: options.selectedRequirementOptionIdsByGroup ?? {},
  });
}

function getVisiblePlannedCourses(quarterPlan) {
  return quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
}

function getVisiblePlannedLabels(quarterPlan) {
  return getVisiblePlannedCourses(quarterPlan).map((course) => course.label);
}

function getVisibleCourseCodeSet(quarterPlan) {
  return new Set(
    getVisiblePlannedLabels(quarterPlan)
      .flatMap((label) => extractCourseCodes(label))
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
}

function getVisibleCourseCodesForRequirement(quarterPlan, grcEquivalents) {
  const visibleCourseCodes = getVisibleCourseCodeSet(quarterPlan);
  return grcEquivalents.filter((courseCode) => visibleCourseCodes.has(normalizeCourseCode(courseCode)));
}

function getGrcEquivalentsForUwCourse(uwCourseCode) {
  const normalizedUwCourseCode = normalizeCourseCode(uwCourseCode);
  if (!normalizedUwCourseCode) {
    return [];
  }

  const equivalents = [];
  for (const rule of source.TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY ?? []) {
    if (rule.sourceSchoolId !== "grc") {
      continue;
    }
    if (!(rule.targetSchoolIds ?? []).some((schoolId) => UW_CAMPUSES.has(schoolId))) {
      continue;
    }
    const targetCodes = (rule.targetCourseCodes ?? []).map(normalizeCourseCode);
    if (!targetCodes.includes(normalizedUwCourseCode)) {
      continue;
    }

    for (const courseSet of rule.sourceCourseSets ?? []) {
      for (const courseCode of courseSet) {
        const normalizedCourseCode = normalizeCourseCode(courseCode);
        if (normalizedCourseCode && !/\b[0-9]XX\b/i.test(normalizedCourseCode)) {
          equivalents.push(normalizedCourseCode);
        }
      }
    }
  }

  return uniqueSorted(equivalents);
}

function getOfficialSingleCourseEquivalencyRules(grcCourseCode, uwCourseCode) {
  const normalizedGrcCourseCode = normalizeCourseCode(grcCourseCode);
  const normalizedUwCourseCode = normalizeCourseCode(uwCourseCode);
  if (!normalizedGrcCourseCode || !normalizedUwCourseCode) {
    return [];
  }

  return (source.getTransferPlannerEquivalencyRulesForSourceCourse(normalizedGrcCourseCode) ?? [])
    .filter((rule) => rule.sourceKind === "uw-green-river-equivalency-guide")
    .filter((rule) => rule.sourceSchoolId === "grc")
    .filter((rule) => (rule.targetSchoolIds ?? []).some((schoolId) => UW_CAMPUSES.has(schoolId)))
    .filter((rule) => rule.acceptanceCategory !== "no-credit")
    .filter((rule) => rule.type !== "elective-credit")
    .filter((rule) =>
      (rule.sourceCourseSets ?? []).some((sourceCourseSet) => {
        const normalizedSourceCourseSet = (sourceCourseSet ?? [])
          .map(normalizeCourseCode)
          .filter(Boolean);
        return (
          normalizedSourceCourseSet.length === 1 &&
          normalizedSourceCourseSet[0] === normalizedGrcCourseCode
        );
      })
    )
    .filter((rule) =>
      (rule.targetCourseCodes ?? [])
        .map(normalizeCourseCode)
        .includes(normalizedUwCourseCode)
    )
    .sort((left, right) => {
      const statusDelta =
        (left.ruleStatus === "active" ? 0 : left.ruleStatus === "legacy" ? 1 : 2) -
        (right.ruleStatus === "active" ? 0 : right.ruleStatus === "legacy" ? 1 : 2);
      if (statusDelta !== 0) return statusDelta;
      return left.id.localeCompare(right.id);
    });
}

function getSingleEquivalencyRuleSourceRow(rule) {
  if (!rule) {
    return "none";
  }
  const greenRiverRow =
    rule.sourceCourseLabel ??
    (rule.notes ?? [])
      .find((note) => /^Official Green River row:/i.test(note))
      ?.replace(/^Official Green River row:\s*/i, "")
      .replace(/\.$/, "") ??
    "unknown GRC row";
  const uwRow =
    rule.targetOutcome ??
    (rule.notes ?? [])
      .find((note) => /^Official UW equivalency row:/i.test(note))
      ?.replace(/^Official UW equivalency row:\s*/i, "")
      .replace(/\.$/, "") ??
    "unknown UW row";
  return `${greenRiverRow} -> ${uwRow}`;
}

function getCourseSubject(courseCode) {
  return normalizeCourseCode(courseCode).replace(/\s+\d{3}(?:\.\d+)?[A-Z]?$/, "");
}

function looksLikeUnsupportedSameSchoolSubstitution(grcCourseCode, uwCourseCode) {
  const normalizedGrcCourseCode = normalizeCourseCode(grcCourseCode);
  const normalizedUwCourseCode = normalizeCourseCode(uwCourseCode);
  if (!normalizedGrcCourseCode || !normalizedUwCourseCode) {
    return false;
  }
  if (normalizedGrcCourseCode === normalizedUwCourseCode) {
    return true;
  }
  return (
    getCourseSubject(normalizedGrcCourseCode) === getCourseSubject(normalizedUwCourseCode) &&
    !/[&]/.test(normalizedGrcCourseCode)
  );
}

function classifySingleEquivalencyIssue(grcCourseCode, uwCourseCode, options = {}) {
  const rules = getOfficialSingleCourseEquivalencyRules(grcCourseCode, uwCourseCode);
  if (!rules.length) {
    if (options.watchlist) {
      return "missing-equivalency";
    }
    return looksLikeUnsupportedSameSchoolSubstitution(grcCourseCode, uwCourseCode)
      ? "unsupported-substitution"
      : "fake-equivalency";
  }
  return rules.some(
    (rule) => rule.ruleStatus !== "legacy" && rule.isObsoleteSourceCourse !== true
  )
    ? "none"
    : "stale-equivalency";
}

function buildSingleEquivalencyAuditRow(input) {
  const grcCourse = normalizeCourseCode(input.grcCourse);
  const uwEquivalent = normalizeCourseCode(input.uwEquivalent);
  const rules = getOfficialSingleCourseEquivalencyRules(grcCourse, uwEquivalent);
  const rule = rules[0] ?? null;
  const issue = classifySingleEquivalencyIssue(grcCourse, uwEquivalent, {
    watchlist: input.watchlist === true,
  });
  const sourceRow = getSingleEquivalencyRuleSourceRow(rule);
  return {
    grcCourse,
    uwEquivalent,
    ruleType: rule?.type ?? "single",
    ruleId: rule?.id ?? null,
    sourceKind: rule?.sourceKind ?? null,
    sourceRow,
    sourceUrl: rule?.sourceLinks?.find((link) => link.url)?.url ?? null,
    effectiveDateLabel: rule?.effectiveDateLabel ?? null,
    warning: (rule?.plannerWarnings ?? []).join(" | ") || null,
    usedByOwnerId: input.usedByOwnerId,
    usedByRequirement: input.usedByRequirement,
    mappedAs: input.mappedAs,
    issue,
    copyOnlyDebugText: [
      "[single equivalency audit]",
      `GRC course: ${grcCourse}`,
      `UW equivalent: ${uwEquivalent}`,
      "Rule type: single",
      `Source row: ${sourceRow}`,
      `Used by owner id: ${input.usedByOwnerId}`,
      `Used by requirement: ${input.usedByRequirement}`,
      `Mapped as required/option/hidden: ${input.mappedAs}`,
      `Issue: ${issue}`,
    ].join(" "),
  };
}

function getGrcEquivalentsForUwCourses(uwCourseCodes) {
  return uniqueSorted(uwCourseCodes.flatMap(getGrcEquivalentsForUwCourse));
}

function hasCompleteGrcEquivalentCourseSetForUwCourse(uwCourseCode, visibleCourseCodes) {
  const normalizedUwCourseCode = normalizeCourseCode(uwCourseCode);
  if (!normalizedUwCourseCode) {
    return false;
  }

  for (const rule of source.TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY ?? []) {
    if (rule.sourceSchoolId !== "grc") {
      continue;
    }
    if (!(rule.targetSchoolIds ?? []).some((schoolId) => UW_CAMPUSES.has(schoolId))) {
      continue;
    }
    const targetCodes = (rule.targetCourseCodes ?? []).map(normalizeCourseCode);
    if (!targetCodes.includes(normalizedUwCourseCode)) {
      continue;
    }

    for (const courseSet of rule.sourceCourseSets ?? []) {
      const normalizedSourceCourseSet = (courseSet ?? [])
        .map(normalizeCourseCode)
        .filter((courseCode) => courseCode && !/\b[0-9]XX\b/i.test(courseCode));
      if (
        normalizedSourceCourseSet.length > 0 &&
        normalizedSourceCourseSet.every((courseCode) => visibleCourseCodes.has(courseCode))
      ) {
        return true;
      }
    }
  }

  return false;
}

function buildParsedRequirementRows(block) {
  if (!canParsedBlockCreateSchedulableRows(block)) {
    return [];
  }

  const rows = [];
  const groupsById = new Map((block.parsedRequirementGroups ?? []).map((group) => [group.id, group]));

  if ((block.parsedRequirementCourses ?? []).length > 0) {
    const coursesByGroup = new Map();
    for (const course of block.parsedRequirementCourses ?? []) {
      if (!isLowerDivisionCourseCode(course.normalizedCourseCode ?? course.courseCode)) {
        continue;
      }
      if (course.optionRole === "alias" || course.optionRole === "note_only") {
        continue;
      }

      const current = coursesByGroup.get(course.requirementGroupId) ?? [];
      current.push(course);
      coursesByGroup.set(course.requirementGroupId, current);
    }

    for (const [groupId, courses] of coursesByGroup.entries()) {
      const group = groupsById.get(groupId);
      const parsedUwCourseCodes = uniqueSorted(
        courses.map((course) => normalizeCourseCode(course.normalizedCourseCode ?? course.courseCode))
      );
      if (!parsedUwCourseCodes.length) {
        continue;
      }

      rows.push({
        uwRequirementLabel: group?.label ?? courses[0]?.sourceHeading ?? parsedUwCourseCodes.join(", "),
        parsedUwCourseCodes,
        groupedChoiceCardinality: formatGroupCardinality(group, courses.length),
        sourceHeading: courses[0]?.sourceHeading ?? group?.sourceHeading ?? null,
      });
    }

    return rows;
  }

  for (const candidate of block.parsedRequirementAtomCandidates ?? []) {
    const courseCode = normalizeCourseCode(candidate.uwCourseCode ?? "");
    if (!courseCode || !isLowerDivisionCourseCode(courseCode)) {
      continue;
    }
    if (!sourceLineLooksRequirementBacked(candidate.sourceLineHints ?? [])) {
      continue;
    }

    rows.push({
      uwRequirementLabel: candidate.title ?? courseCode,
      parsedUwCourseCodes: [courseCode],
      groupedChoiceCardinality: null,
      sourceHeading: candidate.phase ?? null,
    });
  }

  return rows;
}

function isBlockSupportOnly(block) {
  return (
    block?.supportOnly === true ||
    block?.sourceRoleStatus === "support" ||
    ["approved-course-list", "elective-list", "sample-schedule", "support-source", "admission-prerequisite-source", "admissions-preparation"].includes(
      String(block?.sourceRole ?? "")
    )
  );
}

function isBlockNonSchedulable(block) {
  return (
    block?.nonSchedulable === true ||
    block?.sourceRoleStatus === "non-schedulable" ||
    ["upper-division-prerequisite-table", "non-schedulable-course-list", "ignored", "old-archival"].includes(
      String(block?.sourceRole ?? "")
    )
  );
}

function getBlockScopeBoolean(block, key, fallback) {
  if (typeof block?.[key] === "boolean") {
    return block[key];
  }
  if (block?.sourceScope && typeof block.sourceScope[key] === "boolean") {
    return block.sourceScope[key];
  }
  return fallback;
}

function buildSourceScopeEmissionKind(block, courseCode) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const sourceRole = String(block?.sourceRole ?? "");

  if (
    (block.parsedRequirementCourses ?? []).some(
      (course) =>
        course.optionRole === "required" &&
        normalizeCourseCode(course.normalizedCourseCode ?? course.courseCode) === normalizedCourseCode
    )
  ) {
    return "required-row";
  }

  if (
    (block.parsedRequirementAtomCandidates ?? []).some(
      (candidate) => normalizeCourseCode(candidate.uwCourseCode ?? "") === normalizedCourseCode
    )
  ) {
    return "required-row";
  }

  if (
    (block.parsedRequirementGroups ?? []).some((group) =>
      (group.options ?? []).some((option) =>
        [
          ...(option.uwCourses ?? []),
          ...(option.equivalentUwCourseCodes ?? []),
          ...(option.displayCourseCodes ?? []),
        ]
          .map((code) => normalizeCourseCode(code))
          .includes(normalizedCourseCode)
      )
    )
  ) {
    return "option-group";
  }

  if (
    getBlockScopeBoolean(block, "canCreateApprovedFilters", false) ||
    sourceRole === "approved-course-list" ||
    (block.approvedFilterUwCourseCodes ?? []).map(normalizeCourseCode).includes(normalizedCourseCode)
  ) {
    return "approved-list-entry";
  }

  if (
    getBlockScopeBoolean(block, "canCreateElectiveLists", false) ||
    sourceRole === "elective-list" ||
    (block.electiveListUwCourseCodes ?? []).map(normalizeCourseCode).includes(normalizedCourseCode)
  ) {
    return "elective-list-entry";
  }

  return "hidden-support-metadata";
}

function parsedBlockSchedulableEvidenceIncludesCourse(block, courseCode) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  if (!normalizedCourseCode || !canParsedBlockCreateSchedulableRows(block)) {
    return false;
  }

  if (
    (block.parsedRequirementCourses ?? []).some(
      (course) =>
        normalizeCourseCode(course.normalizedCourseCode ?? course.courseCode) === normalizedCourseCode
    )
  ) {
    return true;
  }

  if (
    (block.parsedRequirementAtomCandidates ?? []).some(
      (candidate) => normalizeCourseCode(candidate.uwCourseCode ?? "") === normalizedCourseCode
    )
  ) {
    return true;
  }

  return (block.parsedRequirementGroups ?? []).some((group) =>
    (group.options ?? []).some((option) =>
      [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
        ...(option.displayCourseCodes ?? []),
      ]
        .map((code) => normalizeCourseCode(code))
        .includes(normalizedCourseCode)
    )
  );
}

function buildSourceScopeAuditRowsForOwner(owner) {
  const runtimePlan = resolveRuntimePlan(owner.planId, owner.pathwayId);
  const parsedBlocks = source.getTransferPlannerParsedRequirementSourceBlocks(
    owner.planId,
    owner.pathwayId
  );
  const transferOnlyQuarterPlan = runtimePlan ? buildQuarterPlan(runtimePlan) : [];
  const visibleCourseCodeSet = getVisibleCourseCodeSet(transferOnlyQuarterPlan);
  const generatedRuntimeCourseCodes = getRuntimeGeneratedCourseCodes(runtimePlan);

  return parsedBlocks.flatMap((block) => {
    const supportOnly = isBlockSupportOnly(block);
    const nonSchedulable = isBlockNonSchedulable(block);
    const canCreateRequiredRows = getBlockScopeBoolean(
      block,
      "canCreateRequiredRows",
      canParsedBlockCreateSchedulableRows(block)
    );
    const canCreateOptionGroups = getBlockScopeBoolean(
      block,
      "canCreateOptionGroups",
      canParsedBlockCreateSchedulableRows(block)
    );
    const canCreateApprovedFilters = getBlockScopeBoolean(
      block,
      "canCreateApprovedFilters",
      String(block.sourceRole ?? "") === "approved-course-list"
    );
    const courseCodes = uniqueSorted(
      [
        ...(block.parsedUwCourseCodes ?? []),
        ...(block.approvedFilterUwCourseCodes ?? []),
        ...(block.electiveListUwCourseCodes ?? []),
        ...(block.supportOnlyUwCourseCodes ?? []),
      ].map(normalizeCourseCode).filter(Boolean)
    );
    const generatedRuntimeCourseCodesForSource = getRuntimeGeneratedCourseCodesForSource(
      runtimePlan,
      block.sourceUrl
    );

    return courseCodes.map((courseCode) => {
      const emittedAs = buildSourceScopeEmissionKind(block, courseCode);
      const scheduled = hasCompleteGrcEquivalentCourseSetForUwCourse(
        courseCode,
        visibleCourseCodeSet
      );
      const generatedRuntimeRow = hasCompleteGrcEquivalentCourseSetForUwCourse(
        courseCode,
        generatedRuntimeCourseCodes
      );
      const generatedRuntimeRowFromThisSource = hasCompleteGrcEquivalentCourseSetForUwCourse(
        courseCode,
        generatedRuntimeCourseCodesForSource
      );
      const primaryBackedAsSchedulable = parsedBlocks.some((candidateBlock) =>
        parsedBlockSchedulableEvidenceIncludesCourse(candidateBlock, courseCode)
      );
      const sourceRole = String(block.sourceRole ?? "ignored");
      const emittedRequiredSurface = ["required-row", "option-group"].includes(emittedAs);
      let issue = "none";
      if (supportOnly && emittedRequiredSurface) {
        if (sourceRole === "approved-course-list") {
          issue = "approved-course-list-promoted-to-required";
        } else if (sourceRole === "elective-list") {
          issue = "elective-list-promoted-to-required";
        } else {
          issue = "support-source-created-required-row";
        }
      } else if (
        (supportOnly || nonSchedulable) &&
        generatedRuntimeRowFromThisSource &&
        scheduled &&
        !primaryBackedAsSchedulable
      ) {
        if (sourceRole === "upper-division-prerequisite-table") {
          issue = "upper-division-prerequisite-table-scheduled";
        } else if (sourceRole === "non-schedulable-course-list") {
          issue = "non-schedulable-course-list-scheduled";
        } else {
          issue = "non-schedulable-source-scheduled";
        }
      } else if (
        generatedRuntimeRow &&
        !primaryBackedAsSchedulable &&
        ["required-row", "option-group"].includes(emittedAs)
      ) {
        issue = "unscoped-generated-seed";
      }

      return {
        ownerId: owner.ownerId,
        planId: owner.planId,
        pathwayId: owner.pathwayId ?? null,
        sourceUrl: block.sourceUrl,
        sourceRole,
        supportOnly,
        nonSchedulable,
        canCreateRequiredRows,
        canCreateOptionGroups,
        canCreateApprovedFilters,
        courseCode,
        emittedAs,
        scheduled,
        generatedRuntimeRow,
        primaryBackedAsSchedulable,
        issue,
        copyOnlyDebugText: [
          "[source scope audit]",
          `Owner id: ${owner.ownerId}`,
          `Source URL: ${block.sourceUrl ?? "n/a"}`,
          `Source role: ${block.sourceRole ?? "ignored"}`,
          `Support-only: ${supportOnly ? "yes" : "no"}`,
          `Can create required rows: ${canCreateRequiredRows ? "yes" : "no"}`,
          `Can create option groups: ${canCreateOptionGroups ? "yes" : "no"}`,
          `Can create approved filters: ${canCreateApprovedFilters ? "yes" : "no"}`,
          `Course code: ${courseCode}`,
          `Emitted as: ${emittedAs}`,
          `Scheduled: ${scheduled ? "yes" : "no"}`,
          `Issue: ${issue}`,
        ].join(" "),
      };
    });
  });
}

function buildSourceRoleCoverageRows(owners, sourceScopeAuditRows) {
  const sourceScopeIssuesByOwner = new Map();
  for (const row of sourceScopeAuditRows) {
    if (!row.issue || row.issue === "none") {
      continue;
    }
    const current = sourceScopeIssuesByOwner.get(row.ownerId) ?? [];
    current.push(row.issue);
    sourceScopeIssuesByOwner.set(row.ownerId, current);
  }

  return owners.map((owner) => {
    const primarySource = getPrimarySourceUrl(owner.planId, owner.pathwayId);
    const parsedBlocks = source.getTransferPlannerParsedRequirementSourceBlocks(
      owner.planId,
      owner.pathwayId
    );
    const manifestEntries =
      source.getTransferPlannerSourceManifestEntriesForPlan?.(
        owner.planId,
        owner.pathwayId ?? null
      ) ?? [];
    const entries = [
      ...manifestEntries.map((entry) => ({
        url: entry.url,
        role: entry.role ?? "ignored",
        roleStatus: getSourceRoleStatus(entry.role ?? "ignored"),
        supportOnly: getSourceRoleStatus(entry.role ?? "ignored") === "support",
        nonSchedulable: getSourceRoleStatus(entry.role ?? "ignored") === "non-schedulable",
      })),
      ...parsedBlocks.map((block) => ({
        url: block.sourceUrl,
        role: block.sourceRole ?? "ignored",
        roleStatus: block.sourceRoleStatus ?? getSourceRoleStatus(block.sourceRole ?? "ignored"),
        supportOnly: isBlockSupportOnly(block),
        nonSchedulable: isBlockNonSchedulable(block),
      })),
    ];
    const supportSources = entries
      .filter((entry) => entry.supportOnly || entry.roleStatus === "support")
      .map((entry) => entry.url);
    const approvedCourseListSources = entries
      .filter((entry) => entry.role === "approved-course-list")
      .map((entry) => entry.url);
    const electiveListSources = entries
      .filter((entry) => entry.role === "elective-list")
      .map((entry) => entry.url);
    const nonSchedulableSources = entries
      .filter((entry) => entry.nonSchedulable || entry.roleStatus === "non-schedulable")
      .map((entry) => entry.url);
    const sourceScopeIssues = uniqueSorted(sourceScopeIssuesByOwner.get(owner.ownerId) ?? []);

    return {
      ownerId: owner.ownerId,
      planId: owner.planId,
      pathwayId: owner.pathwayId ?? null,
      primarySource,
      supportSources: uniqueSorted(supportSources),
      approvedCourseListSources: uniqueSorted(approvedCourseListSources),
      electiveListSources: uniqueSorted(electiveListSources),
      nonSchedulableSources: uniqueSorted(nonSchedulableSources),
      sourceScopeIssues,
      copyOnlyDebugText: [
        "[source-role coverage report]",
        `Owner id: ${owner.ownerId}`,
        `Primary source: ${primarySource ?? "none"}`,
        `Support sources: ${joinSourceUrls(supportSources)}`,
        `Approved-course-list sources: ${joinSourceUrls(approvedCourseListSources)}`,
        `Elective-list sources: ${joinSourceUrls(electiveListSources)}`,
        `Non-schedulable sources: ${joinSourceUrls(nonSchedulableSources)}`,
        `Source-scope issues: ${sourceScopeIssues.length ? sourceScopeIssues.join(", ") : "none"}`,
      ].join(" "),
    };
  });
}

function buildSourceScopeRegressionRows(checks) {
  return checks.map((check) => {
    const ownerId = (check.ownerId ?? String(check.id ?? "").split(":")[0]) || "unknown";
    const issue = check.status === "passed" ? "none" : check.issueType ?? "source-scope-contamination";
    const suggestedFile = getSuggestedFileForIssue(issue);

    return {
      ownerId,
      knownProtectedPattern: check.label,
      passed: check.status === "passed",
      issue,
      suggestedFileToInspect: suggestedFile,
      copyOnlyDebugText: [
        "[source-scope regression report]",
        `Owner id: ${ownerId}`,
        `Known protected pattern: ${check.label}`,
        `Passed: ${check.status === "passed" ? "yes" : "no"}`,
        `Issue: ${issue}`,
        `Suggested file to inspect: ${suggestedFile}`,
      ].join(" "),
    };
  });
}

function detectParserOptionCue(value) {
  const text = String(value ?? "");
  const countWords = "one|two|three|four|five|six|seven|eight|nine|ten";
  const cuePatterns = [
    [/\bchoose\s+one\b/i, "choose one"],
    [/\bchoose\s+from\b/i, "choose from"],
    [new RegExp(`\\bchoose\\s+(?:${countWords}|\\d+)\\b`, "i"), "choose count"],
    [/\bchoose\b/i, "choose"],
    [/\bone\s+(?:course\s+)?from\b/i, "one from"],
    [/\bone\s+of(?:\s+the\s+following)?\b/i, "one of the following"],
    [/\bselect\s+one\b/i, "select one"],
    [/\bselect\s+from\b/i, "select from"],
    [new RegExp(`\\bselect\\s+(?:${countWords}|\\d+)\\b`, "i"), "select count"],
    [/\bselect\b/i, "select"],
    [/\beither\b/i, "either"],
    [/\bor\b/i, "or"],
    [/\bapproved\s+electives?\b/i, "approved elective"],
    [/\bapproved\s+list\b/i, "approved list"],
    [/\belective\s+list\b/i, "elective list"],
    [/\belectives?\b/i, "elective"],
  ];
  return cuePatterns.find(([pattern]) => pattern.test(text))?.[1] ?? "none";
}

function getGroupAcceptedOptionCount(group) {
  return (group.options ?? []).filter(
    (option) =>
      (option.uwCourses ?? []).length ||
      (option.equivalentUwCourseCodes ?? []).length ||
      (option.displayCourseCodes ?? []).length ||
      option.optionKind === "category-option" ||
      option.categoryOption
  ).length;
}

function getGroupAcceptedUwOptions(group) {
  return uniqueSorted(
    (group.options ?? [])
      .flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
        ...(option.displayCourseCodes ?? []),
      ])
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
}

function getParserOptionEmissionKind(group) {
  if (group.requirementType === "choose_one") {
    return "choose_one";
  }
  if (group.requirementType === "choose_n") {
    return "choose_n";
  }
  if (group.requirementType === "choose_credits") {
    return "choose_credits";
  }
  return "ignored";
}

function getParserOptionRequiredCount(group) {
  if (group.requiredCount != null) {
    return String(group.requiredCount);
  }
  if (group.selectionCount != null) {
    return String(group.selectionCount);
  }
  if (group.minCourses != null && group.minCourses === group.maxCourses) {
    return String(group.minCourses);
  }
  if (group.minCredits != null) {
    return `${group.minCredits}${group.maxCredits && group.maxCredits !== group.minCredits ? `-${group.maxCredits}` : ""} credits`;
  }
  return "unknown";
}

function buildParserOptionExtractionAuditRowsForOwner(owner) {
  const parsedBlocks = source.getTransferPlannerParsedRequirementSourceBlocks(
    owner.planId,
    owner.pathwayId
  );

  return parsedBlocks.flatMap((block) => {
    const blockSupportOnly = isBlockSupportOnly(block);
    const groupRows = (block.parsedRequirementGroups ?? []).map((group) => {
      const rawRowText = String(group.sourceRowText ?? group.sourceHeading ?? group.label ?? "");
      const acceptedUwOptions = getGroupAcceptedUwOptions(group);
      const acceptedOptionCount = getGroupAcceptedOptionCount(group);
      const emittedAs = getParserOptionEmissionKind(group);
      const detectedOptionCue =
        group.detectedOptionCue ?? detectParserOptionCue(`${group.sourceSection ?? ""} ${rawRowText}`);
      const unsafeCommaList =
        emittedAs !== "ignored" &&
        /,/.test(rawRowText) &&
        acceptedUwOptions.length >= 2 &&
        detectedOptionCue === "none";
      const issue =
        blockSupportOnly && emittedAs !== "ignored"
          ? "false-required-promotion"
          : emittedAs !== "ignored" && emittedAs !== "choose_credits" && acceptedOptionCount < 2
            ? "missed-option-group"
            : unsafeCommaList
              ? "unsafe-comma-list"
              : "none";

      return {
        ownerId: owner.ownerId,
        planId: owner.planId,
        pathwayId: owner.pathwayId ?? null,
        sourceUrl: block.sourceUrl,
        rawRowText,
        detectedOptionCue,
        parsedRequirementTitle: group.label,
        acceptedUwOptions,
        requiredCount: getParserOptionRequiredCount(group),
        emittedAs,
        issue,
        copyOnlyDebugText: [
          "[parser option extraction audit]",
          `Owner id: ${owner.ownerId}`,
          `Source URL: ${block.sourceUrl ?? "n/a"}`,
          `Raw row text: ${rawRowText || "none"}`,
          `Detected option cue: ${detectedOptionCue}`,
          `Parsed requirement title: ${group.label ?? "none"}`,
          `Accepted UW options: ${acceptedUwOptions.length ? acceptedUwOptions.join(", ") : "none"}`,
          `Required count: ${getParserOptionRequiredCount(group)}`,
          `Emitted as: ${emittedAs}`,
          `Issue: ${issue}`,
        ].join(" "),
      };
    });

    const electiveListCodes = uniqueSorted(
      (block.electiveListUwCourseCodes ?? []).map(normalizeCourseCode).filter(Boolean)
    );
    const electiveListRow = electiveListCodes.length
      ? [
          {
            ownerId: owner.ownerId,
            planId: owner.planId,
            pathwayId: owner.pathwayId ?? null,
            sourceUrl: block.sourceUrl,
            rawRowText: block.sourceLabel ?? block.sourceUrl ?? "elective-list source",
            detectedOptionCue: "elective-list source role",
            parsedRequirementTitle: block.sourceLabel ?? "Elective list",
            acceptedUwOptions: electiveListCodes,
            requiredCount: "0",
            emittedAs: "elective-list-entry",
            issue:
              blockSupportOnly && block.canCreateRequiredRows !== true
                ? "none"
                : "false-required-promotion",
            copyOnlyDebugText: [
              "[parser option extraction audit]",
              `Owner id: ${owner.ownerId}`,
              `Source URL: ${block.sourceUrl ?? "n/a"}`,
              `Raw row text: ${block.sourceLabel ?? block.sourceUrl ?? "elective-list source"}`,
              "Detected option cue: elective-list source role",
              `Parsed requirement title: ${block.sourceLabel ?? "Elective list"}`,
              `Accepted UW options: ${electiveListCodes.join(", ")}`,
              "Required count: 0",
              "Emitted as: elective-list-entry",
              `Issue: ${
                blockSupportOnly && block.canCreateRequiredRows !== true
                  ? "none"
                  : "false-required-promotion"
              }`,
            ].join(" "),
          },
        ]
      : [];

    return [...groupRows, ...electiveListRow];
  });
}

const GENERIC_CATEGORY_OPTION_CODES = new Set(["AH", "A&H", "SSC", "SSc", "IS", "I&S", "VLPA", "DIV", "QSR", "NSC", "NSc", "NW"]);

function normalizeCategoryCode(value) {
  const code = String(value ?? "").trim();
  if (!code) {
    return "";
  }
  const upperCode = code.toUpperCase();
  if (upperCode === "A&H") {
    return "AH";
  }
  if (upperCode === "I&S") {
    return "IS";
  }
  return upperCode;
}

function formatCreditRange(minCredits, maxCredits) {
  if (minCredits == null && maxCredits == null) {
    return "none";
  }
  if (minCredits != null && maxCredits != null && minCredits !== maxCredits) {
    return `${minCredits}-${maxCredits}`;
  }
  if (minCredits != null) {
    return String(minCredits);
  }
  return String(maxCredits);
}

function getGroupRawText(group) {
  return String(group?.sourceRowText ?? group?.sourceHeading ?? group?.label ?? "").trim();
}

function groupLooksLikeProgramSpecificCreditBucket(owner, text, group = null) {
  const combinedText = `${owner.ownerId} ${group?.label ?? ""} ${text}`.replace(/\s+/g, " ");
  if (!/\bComputer Engineering\b/i.test(combinedText)) {
    return false;
  }
  const hasCreditBucketLanguage =
    group?.requirementType === "choose_credits" ||
    /\b(?:additional\s+)?credits?\s+(?:from|of)\b/i.test(combinedText) ||
    /\bchosen\s+from\s+approved\b/i.test(combinedText) ||
    /\blist\s+of\s+approved\b/i.test(combinedText);
  if (/\bNatural Science\b/i.test(combinedText)) {
    return hasCreditBucketLanguage || /\bnatural science requirement\b/i.test(combinedText);
  }
  if (/\bMath\/Science\b|\bMath Science\b/i.test(combinedText)) {
    return hasCreditBucketLanguage && !/\bmay\s+not\s+use\s+the\s+same\s+course\b/i.test(combinedText);
  }
  return false;
}

function groupLooksLikeApprovedCreditBucket(text) {
  return /\b(?:minimum|at least|min\.?)?\s*\d+(?:\s*(?:-|to)\s*\d+)?\s+(?:additional\s+)?credits?\s+(?:from|of)\b[^.]{0,120}\bapproved\b/i.test(
    text
  );
}

function groupLooksLikeGenericCategoryCreditBucket(text) {
  const categoryPattern = "\\b(?:NSc|A&H|SSc|I&S|VLPA|DIV|QSR|NW)\\b";
  return new RegExp(
    `\\b(?:minimum|at least|min\\.?)?\\s*\\d+(?:\\s*(?:-|to)\\s*\\d+)?\\s+credits?\\s+(?:of|from)\\b[^.]{0,120}${categoryPattern}`,
    "i"
  ).test(text);
}

function groupLooksLikeCreditBucket(text, owner, group = null) {
  if (group?.requirementType === "choose_credits") {
    return true;
  }
  if (!/\bcredits?\b/i.test(text)) {
    return false;
  }
  if (group?.requirementType !== "choose_credits" && extractCourseCodes(text).length >= 2) {
    return false;
  }
  if (groupLooksLikeProgramSpecificCreditBucket(owner, text, group)) {
    return true;
  }
  if (groupLooksLikeApprovedCreditBucket(text) || groupLooksLikeGenericCategoryCreditBucket(text)) {
    return extractCourseCodes(text).length < 2 || /\bapproved\b/i.test(text);
  }
  return false;
}

function getGroupCategoryOptions(group) {
  return (group?.options ?? []).map((option) => option.categoryOption).filter(Boolean);
}

function getGroupProgramSpecificFilter(group) {
  if (group?.programSpecific && group?.approvedListKey) {
    return group.approvedListKey;
  }
  const optionFilter = getGroupCategoryOptions(group).find(
    (categoryOption) => categoryOption.programSpecific && categoryOption.approvedListKey
  )?.approvedListKey;
  return optionFilter ?? "none";
}

function getGroupGenericCategories(group) {
  return uniqueSorted(
    getGroupCategoryOptions(group)
      .filter((categoryOption) => !categoryOption.programSpecific)
      .map((categoryOption) => categoryOption.sourceCategoryCode ?? categoryOption.category)
      .filter(Boolean)
  );
}

function buildParserCreditBucketAuditRowsForOwner(owner) {
  const parsedBlocks = source.getTransferPlannerParsedRequirementSourceBlocks(
    owner.planId,
    owner.pathwayId
  );

  return parsedBlocks.flatMap((block) =>
    (block.parsedRequirementGroups ?? [])
      .filter((group) => groupLooksLikeCreditBucket(getGroupRawText(group), owner, group))
      .map((group) => {
        const rawText = getGroupRawText(group);
        const detectedBucket = group.requirementType === "choose_credits";
        const issue = !detectedBucket
          ? "missing-credit-bucket"
          : group.requiredCount != null || group.selectionCount != null
            ? "required-count-used-for-credit-bucket"
            : "none";
        const programSpecificFilter = getGroupProgramSpecificFilter(group);
        const genericCategories = getGroupGenericCategories(group);

        return {
          ownerId: owner.ownerId,
          planId: owner.planId,
          pathwayId: owner.pathwayId ?? null,
          sourceUrl: block.sourceUrl,
          rawText,
          detectedBucket,
          minCredits: group.minCredits ?? null,
          maxCredits: group.maxCredits ?? null,
          programSpecificFilter,
          genericCategory: genericCategories.length ? genericCategories.join(", ") : "none",
          emittedRequirementType: group.requirementType ?? "unknown",
          issue,
          copyOnlyDebugText: [
            "[parser credit bucket audit]",
            `Owner id: ${owner.ownerId}`,
            `Raw text: ${rawText || "none"}`,
            `Detected bucket: ${detectedBucket ? "yes" : "no"}`,
            `Min credits: ${group.minCredits ?? "none"}`,
            `Max credits: ${group.maxCredits ?? "none"}`,
            `Program-specific filter: ${programSpecificFilter}`,
            `Generic category: ${genericCategories.length ? genericCategories.join(", ") : "none"}`,
            `Emitted requirement type: ${group.requirementType ?? "unknown"}`,
            `Issue: ${issue}`,
          ].join(" "),
        };
      })
  );
}

function groupLooksLikeCategoryOptionRequirement(text, group, owner) {
  if (getGroupCategoryOptions(group).length) {
    return true;
  }
  if (groupLooksLikeProgramSpecificCreditBucket(owner, text, group)) {
    return true;
  }
  const categoryPattern = /\b(?:NSc|A&H|SSc|I&S|VLPA|DIV|QSR|NW)\b/i;
  if (!categoryPattern.test(text)) {
    return false;
  }
  if (!getGroupCategoryOptions(group).length && extractCourseCodes(text).length >= 2) {
    return false;
  }
  return (
    group?.requirementType === "choose_credits" ||
    group?.requirementType === "choose_one" ||
    group?.requirementType === "choose_n" ||
    detectParserOptionCue(text) !== "none"
  );
}

function optionHasConcreteCourses(option) {
  return [
    ...(option?.uwCourses ?? []),
    ...(option?.equivalentUwCourseCodes ?? []),
    ...(option?.displayCourseCodes ?? []),
    ...(option?.grcMatches ?? []),
  ]
    .map(String)
    .some((value) => extractCourseCodes(value).length > 0);
}

function categoryOptionLooksGenericForProgramSpecific(owner, rawText, group, categoryOption) {
  if (!groupLooksLikeProgramSpecificCreditBucket(owner, rawText, group)) {
    return false;
  }
  const category = normalizeCategoryCode(categoryOption?.category ?? categoryOption?.sourceCategoryCode);
  return !categoryOption?.programSpecific || GENERIC_CATEGORY_OPTION_CODES.has(category);
}

function buildParserCategoryOptionAuditRowsForOwner(owner) {
  const parsedBlocks = source.getTransferPlannerParsedRequirementSourceBlocks(
    owner.planId,
    owner.pathwayId
  );

  return parsedBlocks.flatMap((block) =>
    (block.parsedRequirementGroups ?? []).flatMap((group) => {
      const rawText = getGroupRawText(group);
      if (!groupLooksLikeCategoryOptionRequirement(rawText, group, owner)) {
        return [];
      }

      const categoryOptions = (group.options ?? [])
        .map((option) => ({ option, categoryOption: option.categoryOption }))
        .filter(({ categoryOption }) => categoryOption);

      if (!categoryOptions.length) {
        return [
          {
            ownerId: owner.ownerId,
            planId: owner.planId,
            pathwayId: owner.pathwayId ?? null,
            sourceUrl: block.sourceUrl,
            rawText,
            detectedCategoryOption: false,
            category: "none",
            credits: "none",
            programSpecific: false,
            inventedConcreteCourse: false,
            issue: "missing-category-option",
            copyOnlyDebugText: [
              "[parser category option audit]",
              `Owner id: ${owner.ownerId}`,
              `Raw text: ${rawText || "none"}`,
              "Detected category option: no",
              "Category: none",
              "Credits: none",
              "Program-specific: no",
              "Invented concrete course: no",
              "Issue: missing-category-option",
            ].join(" "),
          },
        ];
      }

      return categoryOptions.map(({ option, categoryOption }) => {
        const inventedConcreteCourse = optionHasConcreteCourses(option);
        const issue = inventedConcreteCourse
          ? "fake-course-invented"
          : categoryOptionLooksGenericForProgramSpecific(owner, rawText, group, categoryOption)
            ? "generic-category-used-for-program-specific"
            : "none";
        const credits = formatCreditRange(
          categoryOption.creditMin ?? categoryOption.credits ?? option.creditMin ?? option.credits ?? null,
          categoryOption.creditMax ?? option.creditMax ?? option.maxCredits ?? null
        );
        const category = categoryOption.sourceCategoryCode ?? categoryOption.category ?? "none";

        return {
          ownerId: owner.ownerId,
          planId: owner.planId,
          pathwayId: owner.pathwayId ?? null,
          sourceUrl: block.sourceUrl,
          rawText,
          detectedCategoryOption: true,
          category,
          credits,
          programSpecific: categoryOption.programSpecific === true,
          inventedConcreteCourse,
          issue,
          copyOnlyDebugText: [
            "[parser category option audit]",
            `Owner id: ${owner.ownerId}`,
            `Raw text: ${rawText || "none"}`,
            "Detected category option: yes",
            `Category: ${category}`,
            `Credits: ${credits}`,
            `Program-specific: ${categoryOption.programSpecific === true ? "yes" : "no"}`,
            `Invented concrete course: ${inventedConcreteCourse ? "yes" : "no"}`,
            `Issue: ${issue}`,
          ].join(" "),
        };
      });
    })
  );
}

function getParserPrerequisiteFilterIssue(block, row) {
  if (row.schedulable) {
    return "none";
  }

  const emittedAsRequirement = (row.courseCodesExtracted ?? []).some((courseCode) =>
    ["required-row", "option-group"].includes(buildSourceScopeEmissionKind(block, courseCode)) &&
    !(block.sourceSectionFilterAuditRows ?? []).some(
      (candidateRow) =>
        candidateRow.schedulable === true &&
        (candidateRow.courseCodesExtracted ?? [])
          .map(normalizeCourseCode)
          .includes(normalizeCourseCode(courseCode))
    )
  );
  if (!emittedAsRequirement) {
    return "none";
  }

  const role = String(row.detectedSectionRole ?? "");
  if (role === "upper-division-prerequisite-table" || role === "support-metadata") {
    return "prerequisite-table-emitted-requirement";
  }
  if (
    role === "approved-course-list" ||
    role === "elective-list" ||
    role === "non-schedulable-course-list"
  ) {
    return "course-list-emitted-requirement";
  }
  return "source-scope-contamination";
}

function buildParserPrerequisiteFilterAuditRowsForOwner(owner) {
  const parsedBlocks = source.getTransferPlannerParsedRequirementSourceBlocks(
    owner.planId,
    owner.pathwayId
  );

  return parsedBlocks.flatMap((block) =>
    (block.sourceSectionFilterAuditRows ?? []).map((row) => {
      const issue = getParserPrerequisiteFilterIssue(block, row);
      const courseCodes = uniqueSorted(
        (row.courseCodesExtracted ?? []).map(normalizeCourseCode).filter(Boolean)
      );
      return {
        ownerId: owner.ownerId,
        planId: owner.planId,
        pathwayId: owner.pathwayId ?? null,
        sourceUrl: block.sourceUrl,
        sectionTitle: row.sectionTitle ?? "source root",
        rawLine: row.rawLine ?? "",
        courseCodesExtracted: courseCodes,
        detectedSectionRole: row.detectedSectionRole ?? "support-metadata",
        schedulable: row.schedulable === true,
        reason: row.reason ?? "none",
        issue,
        copyOnlyDebugText: [
          "[parser prerequisite filter audit]",
          `Owner id: ${owner.ownerId}`,
          `Source URL: ${block.sourceUrl ?? "n/a"}`,
          `Section title: ${row.sectionTitle ?? "source root"}`,
          `Raw line: ${row.rawLine || "none"}`,
          `Course codes extracted: ${courseCodes.length ? courseCodes.join(", ") : "none"}`,
          `Detected section role: ${row.detectedSectionRole ?? "support-metadata"}`,
          `Schedulable: ${row.schedulable === true ? "yes" : "no"}`,
          `Reason: ${row.reason ?? "none"}`,
          `Issue: ${issue}`,
        ].join(" "),
      };
    })
  );
}

function buildParserSequenceChoiceAuditRowsForOwner(owner) {
  const parsedBlocks = source.getTransferPlannerParsedRequirementSourceBlocks(
    owner.planId,
    owner.pathwayId
  );

  return parsedBlocks.flatMap((block) =>
    (block.parserSequenceChoiceAuditRows ?? []).map((row) => {
      const issue = row.issue ?? "none";
      return {
        ownerId: owner.ownerId,
        planId: owner.planId,
        pathwayId: owner.pathwayId ?? null,
        sourceUrl: row.sourceUrl ?? block.sourceUrl,
        rawText: row.rawText ?? "",
        detectedSequenceChoice: row.detectedSequenceChoice === true,
        sequencePaths: row.sequencePaths ?? [],
        selectedDefaultPath: row.selectedDefaultPath ?? null,
        emittedIndependentRequiredRows: row.emittedIndependentRequiredRows === true,
        issue,
        copyOnlyDebugText:
          row.copyOnlyDebugText ??
          [
            "[parser sequence-choice audit]",
            `Owner id: ${owner.ownerId}`,
            `Source URL: ${row.sourceUrl ?? block.sourceUrl ?? "n/a"}`,
            `Raw text: ${row.rawText || "none"}`,
            `Detected sequence choice: ${row.detectedSequenceChoice ? "yes" : "no"}`,
            `Sequence paths: ${(row.sequencePaths ?? []).length ? row.sequencePaths.join(" | ") : "none"}`,
            `Selected/default path: ${row.selectedDefaultPath ?? "none"}`,
            `Emitted independent required rows: ${
              row.emittedIndependentRequiredRows ? "yes" : "no"
            }`,
            `Issue: ${issue}`,
          ].join(" "),
      };
    })
  );
}

function getParsedBlocksForOwnerId(ownerId) {
  const [planId, pathwayId] = String(ownerId ?? "").split(":pathway:");
  return source.getTransferPlannerParsedRequirementSourceBlocks(planId, pathwayId ?? null) ?? [];
}

function getParsedGroupsForOwnerId(ownerId) {
  return getParsedBlocksForOwnerId(ownerId).flatMap((block) =>
    (block.parsedRequirementGroups ?? []).map((group) => ({ block, group }))
  );
}

function getGroupOptionUwCourses(group) {
  return uniqueSorted(
    (group?.options ?? []).flatMap((option) => option.uwCourses ?? []).map(normalizeCourseCode)
  );
}

function getGroupSequencePathCourseSets(group) {
  return (group?.sequencePaths ?? []).map((path) =>
    uniqueSorted((path.uwCourses ?? []).map(normalizeCourseCode))
  );
}

function groupHasSequencePath(group, expectedCourseCodes) {
  const expected = uniqueSorted(expectedCourseCodes.map(normalizeCourseCode));
  return getGroupSequencePathCourseSets(group).some(
    (pathCourses) =>
      pathCourses.length === expected.length &&
      expected.every((courseCode) => pathCourses.includes(courseCode))
  );
}

function getGroupShapeSummary(group) {
  if (!group) {
    return "missing";
  }
  const optionCourses = getGroupOptionUwCourses(group);
  const sequencePaths = getGroupSequencePathCourseSets(group)
    .map((pathCourses) => pathCourses.join(", "))
    .join(" | ");
  const categoryOptions = uniqueSorted(
    (group.options ?? [])
      .map((option) => option.categoryOption?.sourceCategoryCode ?? option.categoryOption?.category)
      .filter(Boolean)
  );
  return [
    `type=${group.requirementType ?? "unknown"}`,
    `required=${group.requiredCount ?? group.selectionCount ?? group.minCourses ?? "none"}`,
    `credits=${formatCreditRange(group.minCredits ?? null, group.maxCredits ?? null)}`,
    `options=${optionCourses.length ? optionCourses.join(", ") : "none"}`,
    `categories=${categoryOptions.length ? categoryOptions.join(", ") : "none"}`,
    `sequencePaths=${sequencePaths || "none"}`,
  ].join("; ");
}

function getGroupAllUwCoursesForShape(group) {
  return uniqueSorted(
    [
      ...(group?.options ?? []).flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
        ...(option.displayCourseCodes ?? []),
      ]),
      ...(group?.sequencePaths ?? []).flatMap((path) => [
        ...(path.uwCourses ?? []),
        ...(path.displayCourseCodes ?? []),
        ...(path.conditionalLabCourses ?? []),
      ]),
    ]
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
}

function getGroupGrcMappingsForShape(group) {
  return uniqueSorted(
    (group?.options ?? [])
      .flatMap((option) => option.grcMatches ?? [])
      .flatMap((label) => extractCourseCodes(label))
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
}

function getGeneratedShapeIssueForGroup(group) {
  if (group?.requirementType === "choose_credits") {
    return "flattened-credit-bucket";
  }
  if (group?.requirementType === "sequence_choice") {
    return "flattened-sequence-choice";
  }
  return "flattened-option-group";
}

function normalizeOptionCourseSet(option) {
  return uniqueSorted(
    [
      ...(option?.uwCourses ?? []),
      ...(option?.equivalentUwCourseCodes ?? []),
      ...(option?.displayCourseCodes ?? []),
    ]
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
}

function getGroupOptionCourseSetsForShape(group) {
  return (group?.options ?? [])
    .map(normalizeOptionCourseSet)
    .filter((courseSet) => courseSet.length > 0);
}

function courseSetsMatch(left, right) {
  return (
    left.length === right.length &&
    left.every((courseCode) => right.includes(courseCode))
  );
}

function generatedGroupHasOptionCourseSet(generatedGroup, expectedCourseSet) {
  return getGroupOptionCourseSetsForShape(generatedGroup).some((courseSet) =>
    courseSetsMatch(courseSet, expectedCourseSet)
  );
}

function getGroupCategoryOptionDescriptorsForShape(group) {
  return (group?.options ?? [])
    .filter((option) => option.optionKind === "category-option" || option.categoryOption)
    .map((option) => {
      const categoryOption = option.categoryOption ?? {};
      return {
        category: normalizeCategoryCode(
          categoryOption.sourceCategoryCode ?? categoryOption.category ?? option.sourceCategory ?? option.category
        ),
        creditRange: formatCreditRange(
          categoryOption.creditMin ?? categoryOption.credits ?? option.creditMin ?? option.credits ?? null,
          categoryOption.creditMax ?? option.creditMax ?? option.maxCredits ?? null
        ),
        approvedListKey: categoryOption.approvedListKey ?? null,
        programSpecific: categoryOption.programSpecific === true,
        inventedConcreteCourse: optionHasConcreteCourses(option),
      };
    })
    .filter((descriptor) => descriptor.category);
}

function categoryDescriptorMatches(left, right) {
  const categoryMatches =
    left.category === right.category ||
    (left.approvedListKey && left.approvedListKey === right.approvedListKey) ||
    (/\bMATH\b.*\bSCIENCE\b|\bSCIENCE\b.*\bMATH\b/i.test(left.category) &&
      /\bMATH\b.*\bSCIENCE\b|\bSCIENCE\b.*\bMATH\b/i.test(right.category)) ||
    (/\bNATURAL\b.*\bSCIENCE\b|\bSCIENCE\b.*\bNATURAL\b/i.test(left.category) &&
      /\bNATURAL\b.*\bSCIENCE\b|\bSCIENCE\b.*\bNATURAL\b/i.test(right.category));
  return (
    categoryMatches &&
    (left.creditRange === "none" ||
      right.creditRange === "none" ||
      left.creditRange === right.creditRange) &&
    (!left.approvedListKey || left.approvedListKey === right.approvedListKey) &&
    (!left.programSpecific || right.programSpecific)
  );
}

function generatedGroupPreservesCategoryOptions(parsedGroup, generatedGroup) {
  const parsedCategoryOptions = getGroupCategoryOptionDescriptorsForShape(parsedGroup);
  if (!parsedCategoryOptions.length) {
    return true;
  }

  const generatedCategoryOptions = getGroupCategoryOptionDescriptorsForShape(generatedGroup);
  if (generatedCategoryOptions.some((descriptor) => descriptor.inventedConcreteCourse)) {
    return false;
  }

  return parsedCategoryOptions.every((parsedDescriptor) =>
    generatedCategoryOptions.some((generatedDescriptor) =>
      categoryDescriptorMatches(parsedDescriptor, generatedDescriptor)
    )
  );
}

function getGroupSequencePathDescriptorsForShape(group) {
  return (group?.sequencePaths ?? []).map((path) => ({
    label: String(path.label ?? "").replace(/\s+/g, " ").trim().toLowerCase(),
    uwCourses: uniqueSorted((path.uwCourses ?? []).map(normalizeCourseCode).filter(Boolean)),
    conditionalLabCourses: uniqueSorted(
      (path.conditionalLabCourses ?? []).map(normalizeCourseCode).filter(Boolean)
    ),
  }));
}

function generatedGroupPreservesSequencePaths(parsedGroup, generatedGroup) {
  const parsedPaths = getGroupSequencePathDescriptorsForShape(parsedGroup);
  const generatedPaths = getGroupSequencePathDescriptorsForShape(generatedGroup);
  if (!parsedPaths.length || parsedPaths.length !== generatedPaths.length) {
    return false;
  }

  return parsedPaths.every((parsedPath) =>
    generatedPaths.some(
      (generatedPath) =>
        courseSetsMatch(parsedPath.uwCourses, generatedPath.uwCourses) &&
        (!parsedPath.label || parsedPath.label === generatedPath.label) &&
        courseSetsMatch(parsedPath.conditionalLabCourses, generatedPath.conditionalLabCourses)
    )
  );
}

function generatedGroupPreservesOptionShape(parsedGroup, generatedGroup) {
  const parsedOptionCourseSets = getGroupOptionCourseSetsForShape(parsedGroup);
  if (
    (parsedGroup.requirementType === "choose_one" || parsedGroup.requirementType === "choose_n") &&
    parsedOptionCourseSets.some(
      (expectedCourseSet) => !generatedGroupHasOptionCourseSet(generatedGroup, expectedCourseSet)
    )
  ) {
    return false;
  }

  return generatedGroupPreservesCategoryOptions(parsedGroup, generatedGroup);
}

function getGeneratedGroupShapeIssue(parsedGroup, generatedGroup) {
  if (!generatedGroup) {
    return getGeneratedShapeIssueForGroup(parsedGroup);
  }

  if (generatedGroup.requirementType !== parsedGroup.requirementType) {
    return getGeneratedShapeIssueForGroup(parsedGroup);
  }

  if (parsedGroup.requirementType === "choose_credits") {
    const minCreditsPreserved =
      parsedGroup.minCredits == null || parsedGroup.minCredits === generatedGroup.minCredits;
    const maxCreditsPreserved =
      parsedGroup.maxCredits == null || parsedGroup.maxCredits === generatedGroup.maxCredits;
    const approvedListPreserved =
      !parsedGroup.approvedListKey || parsedGroup.approvedListKey === generatedGroup.approvedListKey;
    if (
      !minCreditsPreserved ||
      !maxCreditsPreserved ||
      !approvedListPreserved ||
      generatedGroup.requiredCount != null ||
      generatedGroup.selectionCount != null ||
      !generatedGroupPreservesCategoryOptions(parsedGroup, generatedGroup)
    ) {
      return "flattened-credit-bucket";
    }
    return "none";
  }

  if (parsedGroup.requirementType === "sequence_choice") {
    return generatedGroupPreservesSequencePaths(parsedGroup, generatedGroup)
      ? "none"
      : "flattened-sequence-choice";
  }

  if (
    parsedGroup.requirementType === "choose_one" ||
    parsedGroup.requirementType === "choose_n" ||
    getGroupCategoryOptions(parsedGroup).length
  ) {
    return generatedGroupPreservesOptionShape(parsedGroup, generatedGroup)
      ? "none"
      : "flattened-option-group";
  }

  return "none";
}

function parsedGroupHasGeneratedShapeAuditSurface(group) {
  return (
    ["choose_one", "choose_n", "choose_credits", "sequence_choice"].includes(
      String(group?.requirementType ?? "")
    ) || getGroupCategoryOptions(group).length > 0
  );
}

function collectGeneratedRequirementGroupsById(plan) {
  const groupsById = new Map();
  const addGroup = (group) => {
    if (group?.id && !groupsById.has(group.id)) {
      groupsById.set(group.id, group);
    }
  };

  for (const group of plan?.requirementGroups ?? []) {
    addGroup(group);
  }
  for (const item of getChecklistItems(plan)) {
    addGroup(item.requirementGroup);
  }
  return groupsById;
}

function normalizeShapeLabel(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function generatedCreditBucketLooksEquivalent(parsedGroup, generatedGroup) {
  if (generatedGroup?.requirementType !== "choose_credits") {
    return false;
  }
  const minCreditsMatches =
    parsedGroup.minCredits == null || generatedGroup.minCredits === parsedGroup.minCredits;
  const maxCreditsMatches =
    parsedGroup.maxCredits == null || generatedGroup.maxCredits === parsedGroup.maxCredits;
  if (!minCreditsMatches || !maxCreditsMatches) {
    return false;
  }
  if (parsedGroup.approvedListKey && parsedGroup.approvedListKey === generatedGroup.approvedListKey) {
    return true;
  }
  const parsedHasCategoryIdentity =
    getGroupCategoryOptionDescriptorsForShape(parsedGroup).length > 0 ||
    Boolean(parsedGroup.programSpecific);
  if (parsedHasCategoryIdentity && generatedGroupPreservesCategoryOptions(parsedGroup, generatedGroup)) {
    return true;
  }

  const parsedLabel = normalizeShapeLabel(`${parsedGroup.label ?? ""} ${parsedGroup.sourceHeading ?? ""}`);
  const generatedLabel = normalizeShapeLabel(`${generatedGroup.label ?? ""} ${generatedGroup.sourceHeading ?? ""}`);
  return Boolean(
    parsedLabel &&
      generatedLabel &&
      (parsedLabel.includes(generatedLabel) || generatedLabel.includes(parsedLabel))
  );
}

function generatedOptionGroupLooksEquivalent(parsedGroup, generatedGroup) {
  if (generatedGroup?.requirementType !== parsedGroup.requirementType) {
    return false;
  }
  if (parsedGroup.requirementType === "sequence_choice") {
    return generatedGroupPreservesSequencePaths(parsedGroup, generatedGroup);
  }
  if (!generatedGroupPreservesOptionShape(parsedGroup, generatedGroup)) {
    return false;
  }
  const parsedOptionCourseSets = getGroupOptionCourseSetsForShape(parsedGroup);
  const generatedOptionCourseSets = getGroupOptionCourseSetsForShape(generatedGroup);
  return (
    parsedOptionCourseSets.length === 0 ||
    parsedOptionCourseSets.some((parsedCourseSet) =>
      generatedOptionCourseSets.some((generatedCourseSet) =>
        parsedCourseSet.some((courseCode) => generatedCourseSet.includes(courseCode))
      )
    )
  );
}

function findGeneratedGroupForParsedGroup(groupsById, parsedGroup) {
  const directMatch = groupsById.get(parsedGroup.id);
  if (directMatch) {
    return directMatch;
  }

  const candidates = [...groupsById.values()];
  if (parsedGroup.requirementType === "choose_credits") {
    return candidates.find((candidate) => generatedCreditBucketLooksEquivalent(parsedGroup, candidate)) ?? null;
  }
  return candidates.find((candidate) => generatedOptionGroupLooksEquivalent(parsedGroup, candidate)) ?? null;
}

function resolveSourceGeneratedPlan(planId, pathwayId) {
  return source.resolveTransferPlannerMajorPlan(
    source.getTransferPlannerSourceGeneratedMajorPlan(planId),
    pathwayId ?? null
  );
}

function resolveCompactRuntimeGeneratedPlan(planId, pathwayId) {
  return studentRuntime.resolveTransferPlannerMajorPlan(
    studentRuntime.getTransferPlannerMajorPlan(planId),
    pathwayId ?? null
  );
}

function getCompactParsedRequirementGroupsBySourceBlockId(owner) {
  const groupsByBlockId = new Map();
  for (const block of studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
    owner.planId,
    owner.pathwayId
  ) ?? []) {
    groupsByBlockId.set(
      block.id,
      new Map((block.parsedRequirementGroups ?? []).map((group) => [group.id, group]))
    );
  }
  return groupsByBlockId;
}

function buildGeneratedShapeAuditGroupRow(input) {
  const generatedCandidates = [
    input.compactBlockGroup,
    input.sourcePlanGroup,
    input.runtimePlanGroup,
  ].filter(Boolean);
  const sourceRole = input.parsedGroup.sourceRole ?? null;
  const supportOnly = input.parsedGroup.supportOnly === true;
  const canCreateScheduleRow =
    !supportOnly &&
    input.parsedGroup.sourceSectionSchedulable !== false &&
    canSourceRoleCreateSchedulableRows(sourceRole);
  const issue =
    generatedCandidates
      .map((candidate) => getGeneratedGroupShapeIssue(input.parsedGroup, candidate))
      .find((candidateIssue) => candidateIssue !== "none") ??
    (!generatedCandidates.length ? getGeneratedShapeIssueForGroup(input.parsedGroup) : "none");
  const generatedShape = [
    `compact-source-block=${getGroupShapeSummary(input.compactBlockGroup)}`,
    `source-plan=${getGroupShapeSummary(input.sourcePlanGroup)}`,
    `compact-runtime-plan=${getGroupShapeSummary(input.runtimePlanGroup)}`,
  ].join(" | ");
  return {
    ownerId: input.owner.ownerId,
    planId: input.owner.planId,
    pathwayId: input.owner.pathwayId ?? null,
    generatedArtifact: "source/constants/transfer-planner-source/student-runtime.generated.ts",
    sourceParserShape: getGroupShapeSummary(input.parsedGroup),
    generatedShape,
    requirementId: input.parsedGroup.id,
    requirementTitle: input.parsedGroup.label,
    sourceUrl: input.parsedGroup.sourceUrl ?? null,
    sourceRole,
    supportOnly,
    canCreateScheduleRow,
    primarySourceBacking: Boolean(input.parsedGroup.sourceUrl && canCreateScheduleRow),
    uwCourses: getGroupAllUwCoursesForShape(input.parsedGroup),
    grcMappings: uniqueSorted(
      generatedCandidates.flatMap((candidate) => getGroupGrcMappingsForShape(candidate))
    ),
    preservedShape: issue === "none",
    issue,
    copyOnlyDebugText: [
      "[generated shape audit]",
      `Owner id: ${input.owner.ownerId}`,
      `Source parser shape: ${getGroupShapeSummary(input.parsedGroup)}`,
      `Generated shape: ${generatedShape}`,
      `Requirement id: ${input.parsedGroup.id}`,
      `Requirement title: ${input.parsedGroup.label ?? "none"}`,
      `UW courses: ${joinList(getGroupAllUwCoursesForShape(input.parsedGroup))}`,
      `GRC mappings: ${joinList(uniqueSorted(generatedCandidates.flatMap((candidate) => getGroupGrcMappingsForShape(candidate))))}`,
      `Preserved shape: ${issue === "none" ? "yes" : "no"}`,
      `Issue: ${issue}`,
    ].join(" "),
  };
}

function getSupportMetadataParserShape(block) {
  if ((block.approvedFilterUwCourseCodes ?? []).length) {
    return "approved-list/support metadata";
  }
  if ((block.electiveListUwCourseCodes ?? []).length) {
    return "elective-list/support metadata";
  }
  return "hidden/support metadata";
}

function getSupportMetadataCodes(block) {
  return uniqueSorted(
    [
      ...(block.approvedFilterUwCourseCodes ?? []),
      ...(block.electiveListUwCourseCodes ?? []),
      ...(block.supportOnlyUwCourseCodes ?? []),
    ]
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
}

function buildGeneratedShapeAuditSupportRow(owner, block, compactBlock, seedRowsForOwner) {
  const parserCodes = getSupportMetadataCodes(block);
  const compactCodes = getSupportMetadataCodes(compactBlock ?? {});
  const supportShapePreserved =
    compactBlock &&
    parserCodes.every((courseCode) => compactCodes.includes(courseCode)) &&
    (compactBlock.canCreateScheduleRows === false ||
      compactBlock.canCreateRequiredRows === false ||
      compactBlock.supportOnly === true ||
      compactBlock.nonSchedulable === true ||
      isSupportOrNonSchedulableGeneratedSourceRole(compactBlock.sourceRole));
  const seedIssue = (seedRowsForOwner ?? []).some(
    (row) =>
      row.sourceUrl === block.sourceUrl &&
      row.issue &&
      row.issue !== "none" &&
      (row.issue === "support-source-generated-required-row" ||
        row.issue === "stale-manual-seed" ||
        row.issue === "unscoped-generated-seed")
  );
  const issue = supportShapePreserved && !seedIssue ? "none" : "support-metadata-became-required";
  const parserShape = `${getSupportMetadataParserShape(block)}; codes=${joinList(parserCodes)}`;
  const generatedShape = compactBlock
    ? `${getSupportMetadataParserShape(compactBlock)}; supportOnly=${
        compactBlock.supportOnly === true ? "yes" : "no"
      }; canCreateScheduleRows=${compactBlock.canCreateScheduleRows === true ? "yes" : "no"}; codes=${joinList(
        compactCodes
      )}`
    : "missing";

  return {
    ownerId: owner.ownerId,
    planId: owner.planId,
    pathwayId: owner.pathwayId ?? null,
    generatedArtifact: "source/constants/transfer-planner-source/student-runtime.generated.ts",
    sourceParserShape: parserShape,
    generatedShape,
    requirementId: block.id,
    requirementTitle: block.sourceLabel ?? block.sourceUrl ?? "support metadata",
    sourceUrl: block.sourceUrl ?? null,
    sourceRole: block.sourceRole ?? null,
    supportOnly: true,
    canCreateScheduleRow: false,
    primarySourceBacking: false,
    uwCourses: parserCodes,
    grcMappings: [],
    preservedShape: issue === "none",
    issue,
    copyOnlyDebugText: [
      "[generated shape audit]",
      `Owner id: ${owner.ownerId}`,
      `Source parser shape: ${parserShape}`,
      `Generated shape: ${generatedShape}`,
      `Requirement id: ${block.id}`,
      `Requirement title: ${block.sourceLabel ?? block.sourceUrl ?? "support metadata"}`,
      `UW courses: ${joinList(parserCodes)}`,
      "GRC mappings: none",
      `Preserved shape: ${issue === "none" ? "yes" : "no"}`,
      `Issue: ${issue}`,
    ].join(" "),
  };
}

function buildGeneratedShapeAuditRowsForOwner(owner, seedRowsForOwner = []) {
  const sourcePlanGroups = collectGeneratedRequirementGroupsById(
    resolveSourceGeneratedPlan(owner.planId, owner.pathwayId)
  );
  const runtimePlanGroups = collectGeneratedRequirementGroupsById(
    resolveCompactRuntimeGeneratedPlan(owner.planId, owner.pathwayId)
  );
  const compactGroupsByBlockId = getCompactParsedRequirementGroupsBySourceBlockId(owner);
  const compactBlocksById = new Map(
    (studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
      owner.planId,
      owner.pathwayId
    ) ?? []).map((block) => [block.id, block])
  );
  const parsedBlocks = source.getTransferPlannerParsedRequirementSourceBlocks(
    owner.planId,
    owner.pathwayId
  );
  const rows = [];

  for (const block of parsedBlocks) {
    const compactBlockGroups = compactGroupsByBlockId.get(block.id) ?? new Map();
    for (const parsedGroup of block.parsedRequirementGroups ?? []) {
      if (!parsedGroupHasGeneratedShapeAuditSurface(parsedGroup)) {
        continue;
      }
      rows.push(
        buildGeneratedShapeAuditGroupRow({
          owner,
          parsedGroup,
          compactBlockGroup: compactBlockGroups.get(parsedGroup.id) ?? null,
          sourcePlanGroup: findGeneratedGroupForParsedGroup(sourcePlanGroups, parsedGroup),
          runtimePlanGroup: findGeneratedGroupForParsedGroup(runtimePlanGroups, parsedGroup),
        })
      );
    }

    if (
      isBlockSupportOnly(block) &&
      getSupportMetadataCodes(block).length > 0 &&
      !((block.parsedRequirementGroups ?? []).some(parsedGroupHasGeneratedShapeAuditSurface))
    ) {
      rows.push(
        buildGeneratedShapeAuditSupportRow(
          owner,
          block,
          compactBlocksById.get(block.id) ?? null,
          seedRowsForOwner
        )
      );
    }
  }

  return rows;
}

function boolLabel(value) {
  return value ? "yes" : "no";
}

function sourceRoleLooksSupportOnly(role) {
  const status = getSourceRoleStatus(String(role ?? "ignored"));
  return status === "support" || status === "non-schedulable" || status === "ignored";
}

function hasPrimarySourceBacking(input) {
  if (typeof input.primarySourceBacking === "boolean") {
    return input.primarySourceBacking;
  }
  return Boolean(
    input.sourceUrl &&
      input.canCreateScheduleRow &&
      !sourceRoleLooksSupportOnly(input.sourceRole) &&
      /primary-schedulable/i.test(String(input.sourceScope ?? "primary-schedulable"))
  );
}

function normalizeGeneratedRegistryIssue(issue) {
  if (!issue || issue === "none") {
    return "none";
  }
  if (issue === "support-source-generated-required-row") {
    return "support-metadata-became-required";
  }
  return issue;
}

function buildGeneratedRegistryRegressionRow(input) {
  const issue = normalizeGeneratedRegistryIssue(input.issue);
  const supportOnly =
    input.supportOnly === true ||
    sourceRoleLooksSupportOnly(input.sourceRole) ||
    /support|non-schedulable|hidden|informational|ignored/i.test(String(input.sourceScope ?? ""));
  const primarySourceBacking = hasPrimarySourceBacking({
    primarySourceBacking: input.primarySourceBacking,
    sourceUrl: input.sourceUrl,
    sourceRole: input.sourceRole,
    sourceScope: input.sourceScope,
    canCreateScheduleRow: input.canCreateScheduleRow,
  });
  return {
    ownerId: input.ownerId,
    generatedArtifact: input.generatedArtifact,
    requirementGroupId: input.requirementGroupId,
    expectedShape: input.expectedShape,
    actualShape: input.actualShape,
    sourceRole: input.sourceRole ?? null,
    sourceScope: input.sourceScope ?? null,
    supportOnly,
    canCreateScheduleRow: input.canCreateScheduleRow === true,
    primarySourceBacking,
    protectedPattern: input.protectedPattern ?? null,
    issue,
    copyOnlyDebugText: [
      "[generated registry regression audit]",
      `Owner id: ${input.ownerId}`,
      `Generated artifact: ${input.generatedArtifact}`,
      `Requirement/group id: ${input.requirementGroupId}`,
      `Expected shape: ${input.expectedShape}`,
      `Actual shape: ${input.actualShape}`,
      `Source role: ${input.sourceRole ?? "none"}`,
      `Support-only: ${supportOnly ? "yes" : "no"}`,
      `Can create schedule row: ${input.canCreateScheduleRow === true ? "yes" : "no"}`,
      `Primary source backing: ${primarySourceBacking ? "yes" : "no"}`,
      `Issue: ${issue}`,
    ].join(" "),
  };
}

function buildGeneratedRegistryRowsFromSeedRows(seedRows) {
  return seedRows.map((row) =>
    buildGeneratedRegistryRegressionRow({
      ownerId: row.ownerId,
      generatedArtifact: row.generatedFile,
      requirementGroupId: row.requirementCourse,
      expectedShape: "scoped generated checklist row with primary backing before scheduling",
      actualShape: [
        `grc=${joinList(row.generatedGrcCourseCodes ?? [])}`,
        `uw=${row.uwCourse ?? "none"}`,
        `manualOverride=${boolLabel(row.manualOverride)}`,
        `generatedFromParser=${boolLabel(row.generatedFromParser)}`,
      ].join("; "),
      sourceUrl: row.sourceUrl,
      sourceRole: row.sourceRole,
      sourceScope: row.sourceScope,
      supportOnly: sourceRoleLooksSupportOnly(row.sourceRole),
      canCreateScheduleRow: row.canCreateScheduleRow === true,
      primarySourceBacking: Boolean(
        row.sourceUrl &&
          row.canCreateScheduleRow === true &&
          !sourceRoleLooksSupportOnly(row.sourceRole) &&
          /primary-schedulable/i.test(String(row.sourceScope ?? ""))
      ),
      issue: row.issue,
    })
  );
}

function buildGeneratedRegistryRowsFromShapeRows(shapeRows) {
  return shapeRows.map((row) =>
    buildGeneratedRegistryRegressionRow({
      ownerId: row.ownerId,
      generatedArtifact:
        row.generatedArtifact ??
        "source/constants/transfer-planner-source/student-runtime.generated.ts",
      requirementGroupId: row.requirementId,
      expectedShape: row.sourceParserShape,
      actualShape: row.generatedShape,
      sourceUrl: row.sourceUrl,
      sourceRole: row.sourceRole,
      supportOnly: row.supportOnly === true,
      canCreateScheduleRow: row.canCreateScheduleRow === true,
      primarySourceBacking: row.primarySourceBacking === true,
      issue: row.issue,
    })
  );
}

function generatedRegistryOwnerShouldRun(targetPlanId, planId) {
  return !targetPlanId || targetPlanId === planId;
}

function findGeneratedShapeRowsForOwner(rows, ownerId) {
  return rows.filter((row) => row.ownerId === ownerId);
}

function shapeRowsContain(rows, predicate) {
  return rows.some((row) => predicate(row));
}

function buildGeneratedRegistryProtectedRows(targetPlanId, seedRows, shapeRows) {
  const rows = [];
  const seedRowsByOwner = new Map();
  const shapeRowsByOwner = new Map();
  for (const row of seedRows) {
    const ownerRows = seedRowsByOwner.get(row.ownerId) ?? [];
    ownerRows.push(row);
    seedRowsByOwner.set(row.ownerId, ownerRows);
  }
  for (const row of shapeRows) {
    const ownerRows = shapeRowsByOwner.get(row.ownerId) ?? [];
    ownerRows.push(row);
    shapeRowsByOwner.set(row.ownerId, ownerRows);
  }

  const addProtectedRow = (input) => {
    rows.push(
      buildGeneratedRegistryRegressionRow({
        ...input,
        generatedArtifact: "protected-owner-generated-registry-regression",
        sourceRole: input.sourceRole ?? "primary-degree-requirements",
        supportOnly: input.supportOnly === true,
        canCreateScheduleRow: input.canCreateScheduleRow === true,
        primarySourceBacking: input.primarySourceBacking === true,
        issue: input.passed ? "none" : input.issue,
      })
    );
  };

  if (generatedRegistryOwnerShouldRun(targetPlanId, "uw-seattle-computer-science")) {
    const ownerId = "uw-seattle-computer-science:pathway:data-science-option";
    const ownerSeedRows = seedRowsByOwner.get(ownerId) ?? [];
    const unsafeCsRows = ownerSeedRows.filter(
      (row) =>
        ["MATH 240", "PHYS& 222"].includes(normalizeCourseCode(row.requirementCourse)) ||
        (row.generatedGrcCourseCodes ?? []).some((courseCode) =>
          ["MATH 240", "PHYS& 222"].includes(normalizeCourseCode(courseCode))
        )
    );
    const csSupportRows = findGeneratedShapeRowsForOwner(shapeRows, ownerId).filter(
      (row) => row.sourceRole === "approved-course-list"
    );
    addProtectedRow({
      ownerId,
      requirementGroupId: "cs-data-science-source-scope",
      protectedPattern:
        "Computer Science Data Science generated rows cannot bypass source scoping",
      expectedShape:
        "no unscoped PHYS 122/MATH 208 generated seeds and approved science support metadata stays support-only",
      actualShape: [
        `watchlistRows=${unsafeCsRows.length}`,
        `approvedSupportRows=${csSupportRows.length}`,
        `approvedSupportIssues=${
          csSupportRows.filter((row) => row.issue && row.issue !== "none").length
        }`,
      ].join("; "),
      sourceRole: "approved-course-list",
      supportOnly: true,
      canCreateScheduleRow: false,
      primarySourceBacking: false,
      passed:
        unsafeCsRows.every((row) => !row.issue || row.issue === "none") &&
        csSupportRows.length > 0 &&
        csSupportRows.every((row) => row.issue === "none" && row.supportOnly === true),
      issue: unsafeCsRows.some((row) => row.issue && row.issue !== "none")
        ? "unscoped-generated-seed"
        : "support-metadata-became-required",
    });
  }

  if (generatedRegistryOwnerShouldRun(targetPlanId, "uw-seattle-computer-engineering")) {
    const ownerId = "uw-seattle-computer-engineering";
    const ownerShapeRows = findGeneratedShapeRowsForOwner(shapeRows, ownerId);
    const sourcePlanGroups = collectGeneratedRequirementGroupsById(
      resolveSourceGeneratedPlan("uw-seattle-computer-engineering", null)
    );
    const runtimePlanGroups = collectGeneratedRequirementGroupsById(
      resolveCompactRuntimeGeneratedPlan("uw-seattle-computer-engineering", null)
    );
    const naturalScienceGroup =
      sourcePlanGroups.get(
        "uw-seattle-computer-engineering:requirement-group:approved-natural-science-10-credits"
      ) ??
      runtimePlanGroups.get(
        "uw-seattle-computer-engineering:requirement-group:approved-natural-science-10-credits"
      ) ??
      null;
    const mathScienceGroup =
      sourcePlanGroups.get(
        "uw-seattle-computer-engineering:requirement-group:additional-math-science-3-6-credits"
      ) ??
      runtimePlanGroups.get(
        "uw-seattle-computer-engineering:requirement-group:additional-math-science-3-6-credits"
      ) ??
      null;
    const approvedRows = ownerShapeRows.filter((row) => row.sourceRole === "approved-course-list");
    addProtectedRow({
      ownerId,
      requirementGroupId: "ce-credit-buckets-and-approved-list",
      protectedPattern:
        "Computer Engineering credit buckets remain choose_credits and approved list remains support-only",
      expectedShape:
        "Natural Science choose_credits, Math/Science choose_credits, approved science support metadata",
      actualShape: [
        `naturalScience=${getGroupShapeSummary(naturalScienceGroup)}`,
        `mathScience=${getGroupShapeSummary(mathScienceGroup)}`,
        `approvedSupportRows=${approvedRows.length}`,
      ].join("; "),
      sourceRole: "primary-degree-requirements",
      supportOnly: false,
      canCreateScheduleRow: true,
      primarySourceBacking: true,
      passed:
        naturalScienceGroup?.requirementType === "choose_credits" &&
        naturalScienceGroup.minCredits === 10 &&
        naturalScienceGroup.maxCredits === 10 &&
        mathScienceGroup?.requirementType === "choose_credits" &&
        mathScienceGroup.minCredits === 3 &&
        mathScienceGroup.maxCredits === 6 &&
        approvedRows.length > 0 &&
        approvedRows.every((row) => row.issue === "none" && row.supportOnly === true),
      issue: naturalScienceGroup && mathScienceGroup
        ? "support-metadata-became-required"
        : "flattened-credit-bucket",
    });
  }

  if (generatedRegistryOwnerShouldRun(targetPlanId, "uw-seattle-environmental-engineering")) {
    const ownerId = "uw-seattle-environmental-engineering";
    const ownerShapeRows = findGeneratedShapeRowsForOwner(shapeRows, ownerId);
    const earthScienceRow = ownerShapeRows.find((row) =>
      /earth science/i.test(`${row.requirementTitle ?? ""} ${row.requirementId ?? ""}`)
    );
    addProtectedRow({
      ownerId,
      requirementGroupId: "environmental-engineering-earth-science",
      protectedPattern: "Environmental Engineering Earth science elective remains one choose_one group",
      expectedShape: "choose_one if emitted by parser/generated registry",
      actualShape: earthScienceRow ? earthScienceRow.generatedShape : "not emitted by generated registry",
      sourceRole: earthScienceRow?.sourceRole ?? "primary-degree-requirements",
      supportOnly: earthScienceRow?.supportOnly === true,
      canCreateScheduleRow: earthScienceRow?.canCreateScheduleRow === true,
      primarySourceBacking: earthScienceRow?.primarySourceBacking === true,
      passed:
        !earthScienceRow ||
        (earthScienceRow.issue === "none" && /type=choose_one/.test(earthScienceRow.generatedShape)),
      issue: "flattened-option-group",
    });
  }

  if (generatedRegistryOwnerShouldRun(targetPlanId, "uw-seattle-aeronautics-astronautics")) {
    const ownerId = "uw-seattle-aeronautics-astronautics";
    const ownerShapeRows = findGeneratedShapeRowsForOwner(shapeRows, ownerId);
    const nscRow = ownerShapeRows.find((row) => /categories=.*NSc|categories=.*NSC/i.test(row.generatedShape ?? ""));
    addProtectedRow({
      ownerId,
      requirementGroupId: "aa-nsc-category-option",
      protectedPattern: "A&A NSc mixed option remains a category-option",
      expectedShape: "choose_one with non-concrete NSc category option",
      actualShape: nscRow ? nscRow.generatedShape : "missing",
      sourceRole: nscRow?.sourceRole ?? "primary-degree-requirements",
      supportOnly: nscRow?.supportOnly === true,
      canCreateScheduleRow: nscRow?.canCreateScheduleRow === true,
      primarySourceBacking: nscRow?.primarySourceBacking === true,
      passed: Boolean(nscRow && nscRow.issue === "none"),
      issue: nscRow ? "fake-course-invented" : "missing-category-option",
    });
  }

  for (const planId of [
    "uw-seattle-biology",
    "uw-seattle-biochemistry",
    "uw-seattle-chemistry",
  ]) {
    if (!generatedRegistryOwnerShouldRun(targetPlanId, planId)) {
      continue;
    }
    const ownerId = planId;
    const ownerShapeRows = findGeneratedShapeRowsForOwner(shapeRows, ownerId);
    const sequenceRows = ownerShapeRows.filter(
      (row) =>
        /type=sequence_choice/.test(row.sourceParserShape ?? "") &&
        /PHYS 1/.test(row.sourceParserShape ?? "")
    );
    addProtectedRow({
      ownerId,
      requirementGroupId: `${planId}:physics-sequence-choice`,
      protectedPattern: "Physics sequence alternatives stay sequence_choice if parser emits them",
      expectedShape: "sequence_choice paths preserved from parser through generated registry",
      actualShape: sequenceRows.length
        ? sequenceRows.map((row) => row.generatedShape).join(" || ")
        : "parser did not emit physics sequence_choice",
      sourceRole: sequenceRows[0]?.sourceRole ?? "primary-degree-requirements",
      supportOnly: sequenceRows[0]?.supportOnly === true,
      canCreateScheduleRow: sequenceRows[0]?.canCreateScheduleRow === true,
      primarySourceBacking: sequenceRows[0]?.primarySourceBacking === true,
      passed: sequenceRows.length === 0 || sequenceRows.every((row) => row.issue === "none"),
      issue: "flattened-sequence-choice",
    });
  }

  for (const ownerId of [
    "uw-seattle-chemical-engineering",
    "uw-seattle-materials-science-engineering:pathway:nme-option",
  ]) {
    const [planId] = ownerId.split(":pathway:");
    if (!generatedRegistryOwnerShouldRun(targetPlanId, planId)) {
      continue;
    }
    const ownerShapeRows = findGeneratedShapeRowsForOwner(shapeRows, ownerId);
    const electiveRows = ownerShapeRows.filter((row) => row.sourceRole === "elective-list");
    addProtectedRow({
      ownerId,
      requirementGroupId: `${ownerId}:engineering-electives-support-only`,
      protectedPattern: "ChemE/NME engineering electives remain elective-list support metadata",
      expectedShape: "elective-list/support-only rows do not become generated required rows",
      actualShape: `electiveRows=${electiveRows.length}; issues=${
        electiveRows.filter((row) => row.issue !== "none").length
      }`,
      sourceRole: "elective-list",
      supportOnly: true,
      canCreateScheduleRow: false,
      primarySourceBacking: false,
      passed: electiveRows.length === 0 || electiveRows.every((row) => row.issue === "none"),
      issue: "elective-list-generated-required-row",
    });
  }

  if (generatedRegistryOwnerShouldRun(targetPlanId, "uw-seattle-sustainable-bioresource-systems-engineering")) {
    const ownerId = "uw-seattle-sustainable-bioresource-systems-engineering";
    const primarySource = studentRuntime.getTransferPlannerPrimaryDegreeRequirementsSource(ownerId, null);
    const primaryUrl = primarySource?.url ?? "";
    const primaryIsCatalogUrl = /washington\.edu\/students\/gencat/i.test(primaryUrl);
    addProtectedRow({
      ownerId,
      requirementGroupId: "sbse-catalog-anchor",
      protectedPattern: "SBSE catalog anchor section-scoping survives generation",
      expectedShape:
        "catalog URL keeps #program-UG-SBSE-MAJOR anchor when a catalog source is generated; department primary remains source-scoped",
      actualShape: primaryUrl || "missing",
      sourceUrl: primarySource?.url,
      sourceRole: primarySource?.role ?? "official-catalog",
      supportOnly: false,
      canCreateScheduleRow: true,
      primarySourceBacking: Boolean(primarySource?.url),
      passed:
        Boolean(primaryUrl) &&
        (!primaryIsCatalogUrl || /#program-UG-SBSE-MAJOR\b/.test(primaryUrl)),
      issue: "unscoped-generated-seed",
    });
  }

  if (generatedRegistryOwnerShouldRun(targetPlanId, "uw-seattle-informatics")) {
    const ownerId = "uw-seattle-informatics";
    const ownerSeedRows = seedRowsByOwner.get(ownerId) ?? [];
    const fakeInfoRows = ownerSeedRows.filter(
      (row) =>
        /\bINFO\s*\d{3}\b/i.test(`${row.requirementCourse ?? ""} ${row.uwCourse ?? ""}`) &&
        (row.generatedGrcCourseCodes ?? []).length > 0
    );
    addProtectedRow({
      ownerId,
      requirementGroupId: "informatics-unmapped-info-hidden",
      protectedPattern: "Informatics INFO-only requirements stay hidden/unmapped without fake GRC rows",
      expectedShape: "INFO-only rows have no generated GRC schedule row unless primary-backed equivalent exists",
      actualShape: `fakeInfoRows=${fakeInfoRows.length}`,
      sourceRole: "primary-degree-requirements",
      supportOnly: false,
      canCreateScheduleRow: false,
      primarySourceBacking: false,
      passed: fakeInfoRows.length === 0,
      issue: "hidden-informational-row-scheduled",
    });
  }

  return rows;
}

function buildGeneratedRegistryAuditRows(targetPlanId, protectedOnly = false) {
  const owners = buildGeneratedRegistryAuditOwners(targetPlanId, protectedOnly);
  const generatedSourceSeedAuditRows = owners.flatMap(buildGeneratedSourceSeedAuditRowsForOwner);
  const generatedSourceSeedAuditRowsByOwner = new Map();
  for (const row of generatedSourceSeedAuditRows) {
    const ownerRows = generatedSourceSeedAuditRowsByOwner.get(row.ownerId) ?? [];
    ownerRows.push(row);
    generatedSourceSeedAuditRowsByOwner.set(row.ownerId, ownerRows);
  }
  const generatedShapeAuditRows = owners.flatMap((owner) =>
    buildGeneratedShapeAuditRowsForOwner(
      owner,
      generatedSourceSeedAuditRowsByOwner.get(owner.ownerId) ?? []
    )
  );
  const generatedRegistryRows = [
    ...buildGeneratedRegistryRowsFromSeedRows(generatedSourceSeedAuditRows),
    ...buildGeneratedRegistryRowsFromShapeRows(generatedShapeAuditRows),
    ...buildGeneratedRegistryProtectedRows(
      targetPlanId,
      generatedSourceSeedAuditRows,
      generatedShapeAuditRows
    ),
  ];
  return {
    owners,
    generatedSourceSeedAuditRows,
    generatedShapeAuditRows,
    generatedRegistryRows,
  };
}

function getSingleEquivalencyOptionUwCodes(option) {
  const directCodes = uniqueSorted(
    [
      ...(option?.uwCourses ?? []),
      ...(option?.equivalentUwCourseCodes ?? []),
    ]
      .map(normalizeCourseCode)
      .filter(Boolean)
      .filter((courseCode) => !/\b[1-4]XX\b/i.test(courseCode))
  );
  if (directCodes.length) {
    return directCodes;
  }
  return uniqueSorted(
    (option?.displayCourseCodes ?? [])
      .map(normalizeCourseCode)
      .filter(Boolean)
      .filter((courseCode) => !/\b[1-4]XX\b/i.test(courseCode))
  );
}

function getSingleEquivalencyOptionGrcCodes(option) {
  return uniqueSorted(
    (option?.grcMatches ?? [])
      .flatMap((label) => extractCourseCodes(label))
      .map(normalizeCourseCode)
      .filter(Boolean)
      .filter((courseCode) => !/\b[1-4]XX\b/i.test(courseCode))
  );
}

function getMappedAsForSingleEquivalencyGroup(group) {
  if (
    group?.supportOnly === true ||
    group?.sourceSectionSchedulable === false ||
    group?.canCreateScheduleRow === false ||
    isSupportOrNonSchedulableGeneratedSourceRole(group?.sourceRole)
  ) {
    return "hidden";
  }
  return group?.requirementType === "all_required" ? "required" : "option";
}

function buildSingleEquivalencyAuditRowsForPlan(owner, plan, generatedArtifact) {
  if (!plan) {
    return [];
  }
  const rows = [];
  const seen = new Set();
  for (const group of collectGeneratedRequirementGroupsById(plan).values()) {
    for (const option of group.options ?? []) {
      if (option.optionKind === "category-option" || option.categoryOption) {
        continue;
      }
      const uwCodes = getSingleEquivalencyOptionUwCodes(option);
      const grcCodes = getSingleEquivalencyOptionGrcCodes(option);
      if (uwCodes.length !== 1 || grcCodes.length !== 1) {
        continue;
      }
      const key = [
        generatedArtifact,
        owner.ownerId,
        group.id,
        option.id ?? option.label ?? "",
        grcCodes[0],
        uwCodes[0],
      ].join("|");
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      rows.push(
        buildSingleEquivalencyAuditRow({
          grcCourse: grcCodes[0],
          uwEquivalent: uwCodes[0],
          usedByOwnerId: owner.ownerId,
          usedByRequirement: `${group.label ?? group.id} (${generatedArtifact})`,
          mappedAs: getMappedAsForSingleEquivalencyGroup(group),
        })
      );
    }
  }
  return rows;
}

function buildKnownSingleEquivalencyAuditRows() {
  return REQUIRED_SINGLE_EQUIVALENCY_MAPPINGS.map(([grcCourse, uwEquivalent]) =>
    buildSingleEquivalencyAuditRow({
      grcCourse,
      uwEquivalent,
      usedByOwnerId: "uw-green-river-equivalency-guide",
      usedByRequirement: "official single-course equivalency watchlist",
      mappedAs: "hidden",
      watchlist: true,
    })
  );
}

function buildSingleEquivalencyAuditRowsForOwner(owner) {
  return [
    ...buildSingleEquivalencyAuditRowsForPlan(
      owner,
      resolveSourceGeneratedPlan(owner.planId, owner.pathwayId),
      "source/constants/transfer-planner-source/generated-major-plans.ts"
    ),
    ...buildSingleEquivalencyAuditRowsForPlan(
      owner,
      resolveCompactRuntimeGeneratedPlan(owner.planId, owner.pathwayId),
      "source/constants/transfer-planner-source/student-runtime.generated.ts"
    ),
  ];
}

function hasCategoryOption(group) {
  return (group?.options ?? []).some(
    (option) => option.optionKind === "category-option" || option.categoryOption
  );
}

function getRequirementStructuralShapeForAudit(input) {
  const explicitShape = input.requirementShape ?? null;
  if (explicitShape) {
    return explicitShape;
  }
  const sourceRole = String(input.sourceRole ?? "");
  if (sourceRole === "elective-list" || input.requirementType === "elective_list") {
    return "elective-list";
  }
  if (input.requirementType === "approved_filter_list") {
    return "approved-filter-list";
  }
  if (sourceRole === "approved-course-list" || input.requirementType === "approved_course_list") {
    return "approved-course-list";
  }
  if (
    input.supportOnly === true ||
    sourceRole === "support-source" ||
    input.sourceSectionSchedulable === false ||
    input.requirementType === "hidden_informational"
  ) {
    return "hidden-informational-row";
  }
  if (input.requirementType === "choose_credits") {
    return "credit-bucket";
  }
  if (input.requirementType === "sequence_choice") {
    return "sequence-choice";
  }
  if (hasCategoryOption(input)) {
    return "category-option";
  }
  if (input.requirementType === "choose_one" || input.requirementType === "choose_n") {
    return "option-group";
  }
  return "required-row";
}

function getRequirementAuditCurrentShape(group, item = null, block = null) {
  if (block) {
    if (block.requirementShape) {
      return block.requirementShape;
    }
    if ((block.electiveListUwCourseCodes ?? []).length || block.sourceRole === "elective-list") {
      return "elective-list";
    }
    if ((block.approvedFilterUwCourseCodes ?? []).length) {
      return "approved-filter-list";
    }
    if (block.sourceRole === "approved-course-list") {
      return "approved-course-list";
    }
    if (
      (block.supportOnlyUwCourseCodes ?? []).length ||
      block.supportOnly === true ||
      block.canCreateScheduleRows === false
    ) {
      return "hidden-informational-row";
    }
  }
  return getRequirementStructuralShapeForAudit({
    requirementShape: group?.requirementShape ?? item?.requirementShape ?? null,
    requirementType: group?.requirementType ?? null,
    supportOnly: group?.supportOnly ?? item?.supportOnly ?? false,
    sourceRole: group?.sourceRole ?? item?.sourceRole ?? null,
    sourceSectionSchedulable: group?.sourceSectionSchedulable ?? null,
    options: group?.options ?? [],
  });
}

function getRequirementAuditExpectedShape(group, item = null, block = null) {
  if (block) {
    if ((block.electiveListUwCourseCodes ?? []).length || block.sourceRole === "elective-list") {
      return "elective-list/support-only";
    }
    if ((block.approvedFilterUwCourseCodes ?? []).length) {
      return "approved-filter-list/support-only";
    }
    if (block.sourceRole === "approved-course-list") {
      return "approved-course-list/support-only";
    }
    if (
      (block.supportOnlyUwCourseCodes ?? []).length ||
      block.supportOnly === true ||
      block.canCreateScheduleRows === false
    ) {
      return block.sourceRole === "approved-course-list"
        ? "approved-list/support-only"
        : "hidden-informational-row";
    }
  }
  if (group?.requirementType === "choose_credits") {
    return "choose_credits";
  }
  if (group?.requirementType === "sequence_choice") {
    return "sequence_choice";
  }
  if (group?.requirementType === "choose_one" && hasCategoryOption(group)) {
    return "choose_one with category-option";
  }
  if (group?.requirementType === "choose_one") {
    return "choose_one";
  }
  if (group?.requirementType === "choose_n") {
    return "choose_n";
  }
  if (group?.requirementType === "elective_list") {
    return "elective-list/support-only";
  }
  if (group?.requirementType === "hidden_informational") {
    return "hidden-informational-row";
  }
  return item?.canCreateScheduleRow === false ? "hidden-informational-row" : "all_required";
}

function getRequirementShapeAuditIssue({ group, item, block, schedulable }) {
  const sourceRole = String(group?.sourceRole ?? item?.sourceRole ?? block?.sourceRole ?? "");
  const supportOnly = group?.supportOnly === true || block?.supportOnly === true;
  const currentShape = getRequirementAuditCurrentShape(group, item, block);

  if ((sourceRole === "elective-list" || currentShape === "elective-list") && schedulable) {
    return "elective-list-as-required";
  }
  if (
    (sourceRole === "approved-course-list" ||
      currentShape === "approved-course-list" ||
      currentShape === "approved-filter-list") &&
    schedulable
  ) {
    return "list-promoted-to-required";
  }
  if (
    (supportOnly ||
      sourceRole === "support-source" ||
      currentShape === "hidden-informational-row") &&
    schedulable
  ) {
    return "hidden-row-as-required";
  }
  if (
    group?.requirementType === "choose_credits" &&
    (group.requiredCount != null || group.selectionCount != null)
  ) {
    return "credit-bucket-as-count";
  }
  if (
    group?.requirementType === "sequence_choice" &&
    !(group.sequencePaths ?? []).length
  ) {
    return "sequence-choice-flattened";
  }
  if (
    (group?.requirementType === "choose_one" || group?.requirementType === "choose_n") &&
    (!group.options || group.options.length < 2) &&
    /choose|select|one of|\bor\b/i.test(
      `${group.label ?? ""} ${group.sourceHeading ?? ""} ${group.sourceRowText ?? ""}`
    )
  ) {
    return "flattened-option";
  }
  if (
    group?.requirementType === "choose_credits" &&
    getRequirementAuditCurrentShape(group, item, block) !== "credit-bucket"
  ) {
    return "wrong-shape";
  }
  return "none";
}

function buildRequirementShapeAuditRow(input) {
  const issue =
    input.issue ??
    getRequirementShapeAuditIssue({
      group: input.group,
      item: input.item,
      block: input.block,
      schedulable: input.schedulable,
    });
  const requirementId =
    input.requirementId ??
    input.group?.id ??
    input.item?.id ??
    input.block?.id ??
    "unknown-requirement";
  const requirementTitle =
    input.requirementTitle ??
    input.group?.label ??
    input.item?.title ??
    input.block?.sourceLabel ??
    input.block?.sourceUrl ??
    "unknown requirement";
  const sourceRole =
    input.sourceRole ??
    input.group?.sourceRole ??
    input.item?.sourceRole ??
    input.block?.sourceRole ??
    null;
  const currentShape =
    input.currentShape ??
    getRequirementAuditCurrentShape(input.group, input.item, input.block);
  const expectedShape =
    input.expectedShape ??
    getRequirementAuditExpectedShape(input.group, input.item, input.block);
  return {
    ownerId: input.ownerId,
    requirementId,
    requirementTitle,
    sourceRole,
    currentShape,
    expectedShape,
    schedulable: input.schedulable === true,
    issue,
    copyOnlyDebugText: [
      "[requirement shape audit]",
      `Owner id: ${input.ownerId}`,
      `Requirement id: ${requirementId}`,
      `Requirement title: ${requirementTitle}`,
      `Source role: ${sourceRole ?? "none"}`,
      `Current shape: ${currentShape}`,
      `Expected shape: ${expectedShape}`,
      `Schedulable: ${input.schedulable === true ? "yes" : "no"}`,
      `Issue: ${issue}`,
    ].join(" "),
  };
}

function buildRequirementShapeRowsForPlan(owner, plan, generatedArtifact) {
  const rows = [];
  if (!plan) {
    return rows;
  }
  const groups = collectGeneratedRequirementGroupsById(plan);
  for (const group of groups.values()) {
    const groupChecklistItems = getChecklistItems(plan).filter(
      (item) => item.requirementGroup?.id === group.id
    );
    const schedulable = groupChecklistItems.some(
      (item) =>
        (item.canCreateScheduleRow !== false) &&
        getChecklistItemGrcCourseCodes(item).length > 0
    );
    rows.push(
      buildRequirementShapeAuditRow({
        ownerId: owner.ownerId,
        group,
        schedulable,
        generatedArtifact,
      })
    );
  }

  for (const item of getChecklistItems(plan)) {
    if (item.requirementGroup) {
      continue;
    }
    const schedulable =
      item.canCreateScheduleRow !== false &&
      getChecklistItemGrcCourseCodes(item).length > 0;
    rows.push(
      buildRequirementShapeAuditRow({
        ownerId: owner.ownerId,
        item,
        schedulable,
        generatedArtifact,
      })
    );
  }

  return rows;
}

function buildRequirementShapeRowsForSourceBlocks(owner) {
  return [
    ...source.getTransferPlannerParsedRequirementSourceBlocks(owner.planId, owner.pathwayId),
    ...studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(owner.planId, owner.pathwayId),
  ]
    .filter(
      (block) =>
        block.supportOnly === true ||
        block.canCreateScheduleRows === false ||
        (block.approvedFilterUwCourseCodes ?? []).length ||
        (block.electiveListUwCourseCodes ?? []).length ||
        (block.supportOnlyUwCourseCodes ?? []).length
    )
    .map((block) =>
      buildRequirementShapeAuditRow({
        ownerId: owner.ownerId,
        block,
        schedulable:
          block.canCreateScheduleRows === true &&
          ((block.parsedRequirementGroups ?? []).length > 0 ||
            (block.parsedRequirementAtomCandidates ?? []).length > 0),
      })
    );
}

function buildRequirementShapeAuditRowsForOwner(owner) {
  return [
    ...buildRequirementShapeRowsForPlan(
      owner,
      resolveSourceGeneratedPlan(owner.planId, owner.pathwayId),
      "source/constants/transfer-planner-source/generated-major-plans.ts"
    ),
    ...buildRequirementShapeRowsForPlan(
      owner,
      resolveCompactRuntimeGeneratedPlan(owner.planId, owner.pathwayId),
      "source/constants/transfer-planner-source/student-runtime.generated.ts"
    ),
    ...buildRequirementShapeRowsForSourceBlocks(owner),
  ];
}

function getCreditCategoryAuditCategoryOptions(group) {
  return (group?.options ?? [])
    .map((option) => ({ option, categoryOption: option.categoryOption }))
    .filter(
      ({ option, categoryOption }) =>
        option.optionKind === "category-option" || Boolean(categoryOption)
    );
}

function getCreditCategoryAuditConcreteOptions(group) {
  return uniqueSorted(
    (group?.options ?? [])
      .filter((option) => option.optionKind !== "category-option" && !option.categoryOption)
      .flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
        ...(option.displayCourseCodes ?? []),
        ...(option.grcMatches ?? []),
      ])
      .map(String)
      .filter(Boolean)
  );
}

function groupHasCreditCategoryAuditSurface(owner, group) {
  const rawText = getGroupRawText(group);
  return (
    group?.requirementType === "choose_credits" ||
    group?.requirementShape === "credit-bucket" ||
    getCreditCategoryAuditCategoryOptions(group).length > 0 ||
    groupLooksLikeCreditBucket(rawText, owner, group) ||
    groupLooksLikeCategoryOptionRequirement(rawText, group, owner)
  );
}

function getCreditCategoryShapeIssue(owner, group) {
  const rawText = getGroupRawText(group);
  const isCreditBucket =
    group?.requirementType === "choose_credits" || group?.requirementShape === "credit-bucket";
  if (
    isCreditBucket &&
    (group?.requirementType !== "choose_credits" ||
      group?.requirementShape !== "credit-bucket" ||
      group?.requiredCount != null ||
      group?.selectionCount != null ||
      group?.minCourses != null ||
      group?.maxCourses != null ||
      group?.minCredits == null ||
      group?.satisfactionMode !== "credit-based")
  ) {
    return "credit-bucket-as-count";
  }

  const categoryOptions = getCreditCategoryAuditCategoryOptions(group);
  if (groupLooksLikeCategoryOptionRequirement(rawText, group, owner) && !categoryOptions.length) {
    return "missing-category-option";
  }
  if (categoryOptions.some(({ option }) => optionHasConcreteCourses(option))) {
    return "fake-category-course";
  }
  if (
    categoryOptions.some(({ categoryOption }) =>
      categoryOptionLooksGenericForProgramSpecific(owner, rawText, group, categoryOption)
    )
  ) {
    return "generic-category-used-for-program-specific";
  }
  return "none";
}

function buildCreditCategoryShapeAuditRow({ owner, group, generatedArtifact }) {
  const categoryOptions = getCreditCategoryAuditCategoryOptions(group);
  const concreteOptions = getCreditCategoryAuditConcreteOptions(group);
  const categoryOptionText = categoryOptions.length
    ? categoryOptions
        .map(({ categoryOption, option }) => {
          const category =
            categoryOption?.sourceCategoryCode ??
            categoryOption?.category ??
            option.sourceCategory ??
            option.category ??
            "unknown";
          const credits = formatCreditRange(
            categoryOption?.creditMin ?? categoryOption?.credits ?? option.creditMin ?? option.credits ?? null,
            categoryOption?.creditMax ?? option.creditMax ?? option.maxCredits ?? null
          );
          return `${category} (${credits})`;
        })
        .join(", ")
    : "none";
  const issue = getCreditCategoryShapeIssue(owner, group);
  const requirementShape = [
    group?.requirementType ?? "unknown",
    group?.requirementShape ?? "none",
    group?.satisfactionMode ?? "none",
  ].join(" / ");
  const programSpecificFilter = getGroupProgramSpecificFilter(group);

  return {
    ownerId: owner.ownerId,
    generatedArtifact,
    requirementId: group?.id ?? "unknown-requirement",
    requirementTitle: group?.label ?? "unknown requirement",
    requirementShape,
    minCredits: group?.minCredits ?? null,
    maxCredits: group?.maxCredits ?? null,
    categoryOption: categoryOptionText,
    programSpecificFilter,
    concreteOptions: concreteOptions.length ? concreteOptions.join(", ") : "none",
    issue,
    copyOnlyDebugText: [
      "[credit/category shape audit]",
      `Owner id: ${owner.ownerId}`,
      `Requirement title: ${group?.label ?? "unknown requirement"}`,
      `Requirement shape: ${requirementShape}`,
      `Min credits: ${group?.minCredits ?? "none"}`,
      `Max credits: ${group?.maxCredits ?? "none"}`,
      `Category option: ${categoryOptionText}`,
      `Program-specific filter: ${programSpecificFilter}`,
      `Concrete options: ${concreteOptions.length ? concreteOptions.join(", ") : "none"}`,
      `Issue: ${issue}`,
    ].join(" "),
  };
}

function buildCreditCategoryShapeRowsForPlan(owner, plan, generatedArtifact) {
  if (!plan) {
    return [];
  }
  return [...collectGeneratedRequirementGroupsById(plan).values()]
    .filter((group) => groupHasCreditCategoryAuditSurface(owner, group))
    .map((group) => buildCreditCategoryShapeAuditRow({ owner, group, generatedArtifact }));
}

function buildCreditCategoryShapeAuditRowsForOwner(owner) {
  return [
    ...buildCreditCategoryShapeRowsForPlan(
      owner,
      resolveSourceGeneratedPlan(owner.planId, owner.pathwayId),
      "source/constants/transfer-planner-source/generated-major-plans.ts"
    ),
    ...buildCreditCategoryShapeRowsForPlan(
      owner,
      resolveCompactRuntimeGeneratedPlan(owner.planId, owner.pathwayId),
      "source/constants/transfer-planner-source/student-runtime.generated.ts"
    ),
  ];
}

function buildCategoryMappingAuditRowsForOwner(owner) {
  const plan = resolveRuntimePlan(owner.planId, owner.pathwayId);
  if (!plan) {
    return [];
  }

  return planner.auditCategoryMapping({
    ownerId: owner.ownerId,
    plan,
    candidateSourceCourseSets: CATEGORY_MAPPING_AUDIT_SOURCE_SETS,
  });
}

function buildProgramApprovedFilterAuditRowsForOwner(owner) {
  return planner.auditProgramApprovedCourseFilters({
    ownerId: owner.ownerId,
  });
}

function getNormalizedCourseSetKey(courseCodes) {
  return uniqueSorted((courseCodes ?? []).map(normalizeCourseCode).filter(Boolean)).join("|");
}

function getOfficialCompoundEquivalencyRules(sourceCourseSet) {
  const expectedKey = getNormalizedCourseSetKey(sourceCourseSet);
  return (source.TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY ?? [])
    .filter((rule) => rule.sourceSchoolId === "grc")
    .filter((rule) => rule.acceptanceCategory !== "no-credit")
    .filter((rule) => rule.type !== "direct-course")
    .filter((rule) =>
      (rule.sourceCourseSets ?? []).some(
        (candidateSet) => getNormalizedCourseSetKey(candidateSet) === expectedKey
      )
    );
}

function buildMappingRegressionRow(input) {
  const issue = input.issue ?? "none";
  return {
    ownerId: input.ownerId,
    requirement: input.requirement,
    mappingType: input.mappingType,
    expectedMapping: input.expectedMapping,
    actualMapping: input.actualMapping,
    eligible: input.eligible === true,
    issue,
    suggestedFileFunction: input.suggestedFileFunction ?? getSuggestedFileForIssue(issue),
    copyOnlyDebugText: [
      "[mapping regression report]",
      `Owner id: ${input.ownerId}`,
      `Requirement: ${input.requirement}`,
      `Mapping type: ${input.mappingType}`,
      `Expected mapping: ${input.expectedMapping}`,
      `Actual mapping: ${input.actualMapping}`,
      `Eligible: ${input.eligible === true ? "yes" : "no"}`,
      `Issue: ${issue}`,
      `Suggested file/function: ${input.suggestedFileFunction ?? getSuggestedFileForIssue(issue)}`,
    ].join(" "),
  };
}

function buildSingleEquivalencyMappingRegressionRows() {
  return buildKnownSingleEquivalencyAuditRows().map((row) =>
    buildMappingRegressionRow({
      ownerId: row.usedByOwnerId,
      requirement: row.usedByRequirement,
      mappingType: "single",
      expectedMapping: `${row.grcCourse} -> ${row.uwEquivalent}`,
      actualMapping: row.ruleId
        ? `${row.ruleId}; ${row.sourceRow}`
        : `no official Green River equivalency rule found for ${row.grcCourse} -> ${row.uwEquivalent}`,
      eligible: row.issue === "none",
      issue: row.issue,
      suggestedFileFunction:
        "source/scripts/planner/parse-transfer-planner-equivalency-guide.cjs:getOfficialSingleCourseEquivalencyRules",
    })
  );
}

function buildCompoundEquivalencyMappingRegressionRows() {
  return REQUIRED_COMPOUND_EQUIVALENCY_MAPPINGS.map((mapping) => {
    const expectedSourceSet = mapping.sourceCourseSet.map(normalizeCourseCode);
    const expectedTargets = mapping.expectedUwTargets.map(normalizeCourseCode);
    const rules = getOfficialCompoundEquivalencyRules(expectedSourceSet);
    const matchingRules = rules.filter((rule) => {
      const targetCodes = (rule.targetCourseCodes ?? []).map(normalizeCourseCode).filter(Boolean);
      return expectedTargets.every((targetCode) => targetCodes.includes(targetCode));
    });
    const partialRules = rules.filter((rule) => {
      const targetCodes = (rule.targetCourseCodes ?? []).map(normalizeCourseCode).filter(Boolean);
      return expectedTargets.some((targetCode) => targetCodes.includes(targetCode));
    });
    const issue = matchingRules.length
      ? "none"
      : partialRules.length
        ? "partial-compound-path"
        : "missing-compound-path";
    const actualMapping = (matchingRules.length ? matchingRules : partialRules)
      .map((rule) => {
        const targets = uniqueSorted((rule.targetCourseCodes ?? []).map(normalizeCourseCode).filter(Boolean));
        return `${rule.id}: ${expectedSourceSet.join(" + ")} -> ${targets.join(", ") || rule.targetOutcome}`;
      })
      .join(" | ");

    return buildMappingRegressionRow({
      ownerId: "uw-green-river-equivalency-guide",
      requirement: `compound watchlist: ${expectedTargets.join(", ")}`,
      mappingType: "compound",
      expectedMapping: `${expectedSourceSet.join(" + ")} -> ${expectedTargets.join(", ")}`,
      actualMapping: actualMapping || "none",
      eligible: issue === "none",
      issue,
      suggestedFileFunction:
        "source/scripts/planner/parse-transfer-planner-equivalency-guide.cjs:buildRule",
    });
  });
}

function buildRuntimeCompoundMappingRegressionRows() {
  const plan = resolveRuntimePlan("uw-seattle-civil-engineering", null);
  if (!plan) {
    return [
      buildMappingRegressionRow({
        ownerId: "uw-seattle-civil-engineering",
        requirement: "CHEM 152 compound path",
        mappingType: "compound",
        expectedMapping: "CHEM 152 -> CHEM& 162 + CHEM& 163",
        actualMapping: "runtime plan missing",
        eligible: false,
        issue: "missing-compound-path",
        suggestedFileFunction: "source/services/planning/transfer-planner.service.ts:auditCompoundEquivalencyPaths",
      }),
    ];
  }

  const quarterPlan = buildQuarterPlan(plan);
  const rows = planner.auditCompoundEquivalencyPaths({
    ownerId: "uw-seattle-civil-engineering",
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  return rows
    .filter((row) => row.uwCourse === "CHEM 152")
    .map((row) =>
      buildMappingRegressionRow({
        ownerId: row.ownerId,
        requirement: row.uwRequirement,
        mappingType: "compound",
        expectedMapping: "CHEM 152 schedules CHEM& 162 + CHEM& 163 atomically",
        actualMapping: `path=${joinList(row.grcCompoundPath)}; scheduled=${joinList(row.scheduledComponents)}; missing=${joinList(row.missingComponents)}`,
        eligible: row.issue === null && row.satisfied === true,
        issue: row.issue ?? "none",
        suggestedFileFunction: "source/services/planning/transfer-planner.service.ts:auditCompoundEquivalencyPaths",
      })
    );
}

function buildCategoryMappingRegressionRows() {
  const aaPlan = resolveCompactStudentRuntimePlan("uw-seattle-aeronautics-astronautics", null);
  const cePlan = resolveCompactStudentRuntimePlan("uw-seattle-computer-engineering", null);
  const csPlan = resolveCompactStudentRuntimePlan("uw-seattle-computer-science", "data-science-option");
  const rows = [];

  const aaNsc = planner.auditCategoryMapping({
    ownerId: "uw-seattle-aeronautics-astronautics",
    plan: aaPlan,
    candidateCourseCodes: ["ANTH& 205"],
  }).find((row) => /NSc|Natural Sciences/i.test(`${row.requirement} ${row.category}`));
  rows.push(
    buildMappingRegressionRow({
      ownerId: "uw-seattle-aeronautics-astronautics",
      requirement: aaNsc?.requirement ?? "A&A generic NSc category option",
      mappingType: "category",
      expectedMapping: "ANTH& 205 can satisfy generic NSc only through category tags; no concrete course invented",
      actualMapping: aaNsc
        ? `category=${aaNsc.category}; tags=${joinList(aaNsc.genericCategoryTags)}; eligible=${boolLabel(aaNsc.eligible)}`
        : "missing category audit row",
      eligible: aaNsc?.eligible === true && aaNsc?.issue == null,
      issue: aaNsc?.issue === "fake-category-course"
        ? "category-option-invented-course"
        : aaNsc
          ? aaNsc.issue ?? "none"
          : "missing-category-option",
      suggestedFileFunction: "source/services/planning/transfer-planner.service.ts:auditCategoryMapping",
    })
  );

  for (const [ownerId, plan, candidateCourse] of [
    ["uw-seattle-computer-engineering", cePlan, "ANTH& 205"],
    ["uw-seattle-computer-science:pathway:data-science-option", csPlan, "ANTH& 205"],
  ]) {
    const auditRow = planner.auditCategoryMapping({
      ownerId,
      plan,
      candidateCourseCodes: [candidateCourse],
    }).find((row) => /Natural Sciences?|Natural Science/i.test(row.requirement));
    rows.push(
      buildMappingRegressionRow({
        ownerId,
        requirement: auditRow?.requirement ?? "program-specific science category",
        mappingType: "program-filter",
        expectedMapping: `${candidateCourse} is generic NSc only and is rejected by program-approved science`,
        actualMapping: auditRow
          ? `filter=${auditRow.programSpecificFilter ?? "none"}; tags=${joinList(auditRow.genericCategoryTags)}; programApproved=${boolLabel(auditRow.programApproved)}; eligible=${boolLabel(auditRow.eligible)}`
          : "missing category audit row",
        eligible: auditRow?.eligible === false && auditRow?.reason === "rejected-generic-only",
        issue:
          auditRow?.eligible === false && auditRow?.reason === "rejected-generic-only"
            ? "none"
            : "generic-category-used-as-program-approved",
        suggestedFileFunction: "source/services/planning/transfer-planner.service.ts:auditCategoryMapping",
      })
    );
  }

  return rows;
}

function buildProgramFilterMappingRegressionRows() {
  const filterKeys = ["computer-engineering-natural-science", "computer-science-approved-science"];
  return filterKeys.flatMap((filterKey) => {
    const auditRows = planner.auditProgramApprovedCourseFilters({ filterKey });
    const includedRows = auditRows.filter((row) => row.included);
    const supportOnlyBlocks = (studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(
      filterKey === "computer-engineering-natural-science"
        ? "uw-seattle-computer-engineering"
        : "uw-seattle-computer-science",
      filterKey === "computer-engineering-natural-science" ? null : "data-science-option"
    ) ?? []).filter((block) => block.supportLists?.some((list) => list.approvedListKey === filterKey));
    const unsafeSupportBlock = supportOnlyBlocks.find(
      (block) =>
        block.supportOnly !== true ||
        block.canCreateRequiredRows === true ||
        block.canCreateScheduleRows === true ||
        (block.parsedRequirementGroups ?? []).length > 0 ||
        (block.parsedRequirementAtomCandidates ?? []).length > 0
    );
    const issue = !includedRows.length
      ? "missing-program-approved-filter"
      : unsafeSupportBlock
        ? "approved-list-source-created-required-row"
        : "none";
    const summaryRow = buildMappingRegressionRow({
      ownerId: filterKey === "computer-engineering-natural-science"
        ? "uw-seattle-computer-engineering"
        : "uw-seattle-computer-science:pathway:data-science-option",
      requirement: `${filterKey} approved filter`,
      mappingType: "program-filter",
      expectedMapping: "official UW approved codes cross-checked against GRC equivalency rules; support list cannot create rows",
      actualMapping: `included=${includedRows.length}; supportBlocks=${supportOnlyBlocks.length}; sample=${includedRows
        .slice(0, 3)
        .map((row) => `${row.approvedUwCode}->${row.grcEquivalentPath.join("+")}`)
        .join(" | ") || "none"}`,
      eligible: issue === "none",
      issue,
      suggestedFileFunction: "source/services/planning/transfer-planner.service.ts:auditProgramApprovedCourseFilters",
    });
    const representativeRows = auditRows
      .filter((row) => row.included || row.reason === "generic-category-only")
      .slice(0, 8)
      .map((row) =>
        buildMappingRegressionRow({
          ownerId: row.ownerId ?? summaryRow.ownerId,
          requirement: `${filterKey}: ${row.approvedUwCode}`,
          mappingType: "program-filter",
          expectedMapping: row.reason === "generic-category-only"
            ? "generic category-only GRC course is excluded from program-approved filter"
            : "approved UW equivalent maps through official GRC path",
          actualMapping: `${row.grcEquivalentPath.join(" + ") || "none"}; included=${boolLabel(row.included)}; reason=${row.reason}`,
          eligible: row.issue == null,
          issue: row.issue ?? "none",
          suggestedFileFunction: "source/services/planning/transfer-planner.service.ts:auditProgramApprovedCourseFilters",
        })
      );
    return [summaryRow, ...representativeRows];
  });
}

function buildHiddenUnmappedMappingRegressionRows() {
  const rows = [];
  const envePlan = resolveRuntimePlan("uw-seattle-environmental-engineering", null);
  if (envePlan) {
    const quarterPlan = buildQuarterPlan(envePlan);
    const coverageRow = planner.auditRequiredMappedCourseCoverage({
      plan: envePlan,
      suggestedPlan: quarterPlan,
      completedCourses: [],
    }).find((row) => row.uwCourse === "CEE 347");
    rows.push(
      buildMappingRegressionRow({
        ownerId: "uw-seattle-environmental-engineering",
        requirement: "CEE 347",
        mappingType: "hidden-unmapped",
        expectedMapping: "CEE 347 has no fake GRC replacement and stays hidden/unmapped",
        actualMapping: coverageRow
          ? `type=${coverageRow.requirementType}; visible=${boolLabel(coverageRow.visibleInPlan)}; mapped=${joinList(coverageRow.mappedGrcEquivalentPath ?? [])}`
          : "missing coverage row",
        eligible:
          coverageRow?.requirementType === "hidden-unmapped" &&
          coverageRow.visibleInPlan === false &&
          (coverageRow.mappedGrcEquivalentPath ?? []).length === 0,
        issue:
          coverageRow?.requirementType === "hidden-unmapped" &&
          coverageRow.visibleInPlan === false &&
          (coverageRow.mappedGrcEquivalentPath ?? []).length === 0
            ? "none"
            : "fake-equivalency",
        suggestedFileFunction: "source/services/planning/transfer-planner.service.ts:auditRequiredMappedCourseCoverage",
      })
    );
  }

  const infoPlan = resolveRuntimePlan("uw-seattle-informatics", null);
  if (infoPlan) {
    const quarterPlan = buildQuarterPlan(infoPlan);
    const suspiciousVisibleLabels = getVisiblePlannedLabels(quarterPlan).filter((label) =>
      /\b(?:PHYS|CHEM|BIOL|ENGR)&?\s*\d{3}\b|\b(?:INFO|BIME|CSE)\s*[34]\d{2}\b/i.test(label)
    );
    rows.push(
      buildMappingRegressionRow({
        ownerId: "uw-seattle-informatics",
        requirement: "INFO-only and upper-division rows",
        mappingType: "hidden-unmapped",
        expectedMapping: "unmapped INFO/upper-division requirements stay hidden without engineering/science spillover",
        actualMapping: suspiciousVisibleLabels.length
          ? suspiciousVisibleLabels.join(", ")
          : "no suspicious visible GRC rows",
        eligible: suspiciousVisibleLabels.length === 0,
        issue: suspiciousVisibleLabels.length ? "fake-equivalency" : "none",
        suggestedFileFunction: "source/services/planning/transfer-planner.service.ts:auditVisibleGrcQuarterPlanScope",
      })
    );
  }

  return rows;
}

function buildMappingRegressionRows() {
  return [
    ...buildSingleEquivalencyMappingRegressionRows(),
    ...buildCompoundEquivalencyMappingRegressionRows(),
    ...buildRuntimeCompoundMappingRegressionRows(),
    ...buildCategoryMappingRegressionRows(),
    ...buildProgramFilterMappingRegressionRows(),
    ...buildHiddenUnmappedMappingRegressionRows(),
  ];
}

function getSequenceShapePathSummaries(group) {
  return (group?.sequencePaths ?? []).map((path) => {
    const uwCourses = uniqueSorted((path.uwCourses ?? []).map(normalizeCourseCode).filter(Boolean));
    const grcCourses = uniqueSorted(
      [
        ...(path.mappedGrcCourseCodes ?? []),
        ...(group.options ?? [])
          .filter((option) => option.sequencePathId === path.id)
          .flatMap((option) => option.grcMatches ?? []),
      ]
        .flatMap((label) => extractCourseCodes(label))
        .map(normalizeCourseCode)
        .filter(Boolean)
    );
    return `${path.label ?? path.id}: UW ${uwCourses.join(", ") || "none"} -> GRC ${
      grcCourses.join(", ") || "none"
    }`;
  });
}

function getSequencePathScopedNotesSummary(group) {
  return (group?.sequencePaths ?? [])
    .filter(
      (path) =>
        (path.conditionalLabCourses ?? []).length ||
        (path.notes ?? []).length
    )
    .map((path) => {
      const labs = uniqueSorted(
        (path.conditionalLabCourses ?? []).map(normalizeCourseCode).filter(Boolean)
      );
      return `${path.label ?? path.id}: labs ${labs.join(", ") || "none"}; notes ${
        (path.notes ?? []).join(" | ") || "none"
      }`;
    });
}

function getSequenceShapeSelectedPath(group, item) {
  const selectedIds = new Set((item?.selectedRequirementOptionIds ?? []).filter(Boolean));
  const selectedOption =
    (group?.options ?? []).find((option) => option.id && selectedIds.has(option.id)) ??
    (group?.options ?? [])[0] ??
    null;
  if (!selectedOption) {
    return "none";
  }
  const path = (group.sequencePaths ?? []).find((candidate) => candidate.id === selectedOption.sequencePathId);
  return path?.label ?? selectedOption.pathLabel ?? selectedOption.label ?? selectedOption.id ?? "none";
}

function sequenceChoiceHasFlattenedIndependentRows(group, item) {
  if (group?.requirementType !== "sequence_choice") {
    return false;
  }
  const sequencePaths = group.sequencePaths ?? [];
  const sequenceOptions = group.options ?? [];
  const selectedIds = (item?.selectedRequirementOptionIds ?? []).filter(Boolean);
  if (
    group.requirementShape !== "sequence-choice" ||
    group.requiredCount !== 1 ||
    group.selectionCount !== 1 ||
    group.minCourses !== 1 ||
    group.maxCourses !== 1 ||
    sequencePaths.length < 2 ||
    sequenceOptions.length !== sequencePaths.length ||
    selectedIds.length > 1
  ) {
    return true;
  }

  const sequenceOptionIds = new Set(sequenceOptions.map((option) => option.id).filter(Boolean));
  if (selectedIds.some((optionId) => !sequenceOptionIds.has(optionId))) {
    return true;
  }

  const selectedOption = sequenceOptions.find((option) => option.id && selectedIds.includes(option.id));
  const selectedCourseCodes = new Set(
    (selectedOption?.grcMatches ?? [])
      .flatMap((label) => extractCourseCodes(label))
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
  const itemCourseCodes = uniqueSorted(
    (item?.grcCourses ?? [])
      .flatMap((label) => extractCourseCodes(label))
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
  return Boolean(
    selectedCourseCodes.size &&
      itemCourseCodes.some((courseCode) => !selectedCourseCodes.has(courseCode))
  );
}

function sequenceChoiceHasUnscopedPathNotes(group) {
  if (group?.requirementType !== "sequence_choice") {
    return false;
  }
  const options = group.options ?? [];
  for (const path of group.sequencePaths ?? []) {
    const pathLabs = uniqueSorted(
      (path.conditionalLabCourses ?? []).map(normalizeCourseCode).filter(Boolean)
    );
    if (!pathLabs.length && !(path.notes ?? []).length) {
      continue;
    }
    const matchingOption = options.find((option) => option.sequencePathId === path.id);
    if (
      pathLabs.length &&
      !pathLabs.every((labCode) =>
        (matchingOption?.conditionalLabCourses ?? [])
          .map(normalizeCourseCode)
          .includes(labCode)
      )
    ) {
      return true;
    }
    const otherOptions = options.filter((option) => option.sequencePathId !== path.id);
    if (
      pathLabs.some((labCode) =>
        otherOptions.some((option) =>
          (option.conditionalLabCourses ?? []).map(normalizeCourseCode).includes(labCode)
        )
      )
    ) {
      return true;
    }
  }
  return false;
}

function getSequencePathwayShapeIssue(owner, plan, group, item) {
  const effectivePathwayId =
    owner.pathwayId ?? plan?.selectedPathwayId ?? null;
  const groupPathwayId = group?.pathwayId ?? null;
  if (groupPathwayId && effectivePathwayId && groupPathwayId !== effectivePathwayId) {
    return "pathway-leak";
  }
  if (groupPathwayId && !effectivePathwayId) {
    return "pathway-leak";
  }
  if (sequenceChoiceHasUnscopedPathNotes(group)) {
    return "path-note-unscoped";
  }
  if (sequenceChoiceHasFlattenedIndependentRows(group, item)) {
    return "sequence-choice-flattened";
  }
  return "none";
}

function groupHasSequencePathwayAuditSurface(group) {
  return (
    group?.requirementType === "sequence_choice" ||
    group?.requirementShape === "sequence-choice" ||
    Boolean(group?.pathwayId) ||
    /\b:pathway:/i.test(String(group?.id ?? "")) ||
    /\bpathway\b/i.test(String(group?.sourceScope ?? ""))
  );
}

function buildSequencePathwayShapeRowsForPlan(owner, plan, generatedArtifact) {
  if (!plan) {
    return [];
  }
  const itemsByGroupId = new Map();
  for (const item of getChecklistItems(plan)) {
    const groupId = item.requirementGroup?.id;
    if (!groupId) continue;
    itemsByGroupId.set(groupId, item);
  }

  return [...collectGeneratedRequirementGroupsById(plan).values()]
    .filter(groupHasSequencePathwayAuditSurface)
    .map((group) => {
      const item = itemsByGroupId.get(group.id) ?? null;
      const sequencePaths = getSequenceShapePathSummaries(group);
      const pathScopedNotes = getSequencePathScopedNotesSummary(group);
      const flattenedIndependentRows = sequenceChoiceHasFlattenedIndependentRows(group, item);
      const issue = getSequencePathwayShapeIssue(owner, plan, group, item);
      const requirementShape = [
        group.requirementType ?? "unknown",
        group.requirementShape ?? "none",
        group.pathwayId ? `pathway:${group.pathwayId}` : "base",
      ].join(" / ");
      return {
        ownerId: owner.ownerId,
        pathwayId: owner.pathwayId ?? plan.selectedPathwayId ?? null,
        generatedArtifact,
        requirementId: group.id,
        requirementTitle: group.label ?? "unknown requirement",
        requirementShape,
        sequencePaths,
        selectedDefaultPath:
          group.requirementType === "sequence_choice"
            ? getSequenceShapeSelectedPath(group, item)
            : "none",
        pathScopedNotes,
        flattenedIndependentRows,
        issue,
        copyOnlyDebugText: [
          "[sequence/pathway shape audit]",
          `Owner id: ${owner.ownerId}`,
          `Pathway id: ${owner.pathwayId ?? plan.selectedPathwayId ?? "none"}`,
          `Requirement title: ${group.label ?? "unknown requirement"}`,
          `Requirement shape: ${requirementShape}`,
          `Sequence paths: ${sequencePaths.length ? sequencePaths.join(" | ") : "none"}`,
          `Selected/default path: ${
            group.requirementType === "sequence_choice"
              ? getSequenceShapeSelectedPath(group, item)
              : "none"
          }`,
          `Path-scoped notes: ${pathScopedNotes.length ? pathScopedNotes.join(" | ") : "none"}`,
          `Flattened independent rows: ${flattenedIndependentRows ? "yes" : "no"}`,
          `Issue: ${issue}`,
        ].join(" "),
      };
    });
}

function buildSequencePathwayShapeAuditRowsForOwner(owner) {
  return [
    ...buildSequencePathwayShapeRowsForPlan(
      owner,
      resolveSourceGeneratedPlan(owner.planId, owner.pathwayId),
      "source/constants/transfer-planner-source/generated-major-plans.ts"
    ),
    ...buildSequencePathwayShapeRowsForPlan(
      owner,
      resolveCompactRuntimeGeneratedPlan(owner.planId, owner.pathwayId),
      "source/constants/transfer-planner-source/student-runtime.generated.ts"
    ),
  ];
}

function getSupportListAuditContext(block) {
  return [
    block.planId,
    block.ownerId,
    block.ownerTitle,
    block.sourceLabel,
    block.sourceUrl,
    block.primarySourceLabel,
    block.primarySourceUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function inferSupportListAuditApprovedListKey(block) {
  const context = getSupportListAuditContext(block);
  if (
    (block.planId === "uw-seattle-computer-engineering" ||
      /\bcomputer engineering\b/.test(context)) &&
    /\b(?:natural science|science)\b/.test(context)
  ) {
    return "computer-engineering-natural-science";
  }
  if (
    (block.planId === "uw-seattle-computer-science" ||
      /\b(?:computer science|allen school|data science)\b/.test(context)) &&
    /\b(?:natural science|science)\b/.test(context)
  ) {
    return "computer-science-approved-science";
  }
  if (/\bapproved\b/.test(context) && /\belectives?\b/.test(context)) {
    return `${slugifyAuditId(block.planId || block.ownerId || "unknown-owner")}-approved-electives`;
  }
  return null;
}

function buildSupportListAuditEntry({ block, shape, acceptedUwCourseCodes, approvedListKey }) {
  const sourceUrl = block.sourceUrl ?? block.primarySourceUrl ?? null;
  return {
    id: `${block.id ?? slugifyAuditId(sourceUrl ?? block.sourceLabel ?? "support-list")}:support-list:${shape}`,
    shape,
    sourceUrl,
    sourceRole: block.sourceRole ?? null,
    listTitle:
      block.sourceLabel ??
      block.primarySourceLabel ??
      (shape === "elective-list" ? "Elective list" : "Approved course list"),
    acceptedUwCourseCodes: uniqueSorted(acceptedUwCourseCodes.map(normalizeCourseCode)),
    approvedListKey: approvedListKey ?? null,
    supportOnly: true,
    canCreateRequiredRow: false,
    canCreateScheduleRow: false,
    linkedPrimaryRequirementIds: [],
  };
}

function getSupportListsForAuditBlock(block) {
  if (Array.isArray(block.supportLists) && block.supportLists.length) {
    return block.supportLists.map((supportList) => ({
      ...supportList,
      acceptedUwCourseCodes: uniqueSorted(
        (supportList.acceptedUwCourseCodes ?? []).map(normalizeCourseCode)
      ),
      supportOnly: supportList.supportOnly !== false,
      canCreateRequiredRow: supportList.canCreateRequiredRow === true,
      canCreateScheduleRow: supportList.canCreateScheduleRow === true,
      linkedPrimaryRequirementIds: supportList.linkedPrimaryRequirementIds ?? [],
    }));
  }

  const approvedCodes = uniqueSorted((block.approvedFilterUwCourseCodes ?? []).map(normalizeCourseCode));
  const electiveCodes = uniqueSorted((block.electiveListUwCourseCodes ?? []).map(normalizeCourseCode));
  const supportOnlyCodes = uniqueSorted((block.supportOnlyUwCourseCodes ?? []).map(normalizeCourseCode));
  const usedCodes = new Set([...approvedCodes, ...electiveCodes]);
  const remainingSupportOnlyCodes = supportOnlyCodes.filter((courseCode) => !usedCodes.has(courseCode));
  const approvedListKey = inferSupportListAuditApprovedListKey(block);
  const supportLists = [];

  if (approvedCodes.length) {
    supportLists.push(
      buildSupportListAuditEntry({
        block,
        shape: "approved-filter-list",
        acceptedUwCourseCodes: approvedCodes,
        approvedListKey,
      })
    );
  }
  if (electiveCodes.length) {
    supportLists.push(
      buildSupportListAuditEntry({
        block,
        shape: "elective-list",
        acceptedUwCourseCodes: electiveCodes,
      })
    );
  }
  if (remainingSupportOnlyCodes.length) {
    const sourceRole = String(block.sourceRole ?? "");
    const shape =
      sourceRole === "elective-list"
        ? "elective-list"
        : sourceRole === "approved-course-list"
          ? "approved-course-list"
          : null;
    if (shape) {
      supportLists.push(
        buildSupportListAuditEntry({
          block,
          shape,
          acceptedUwCourseCodes: remainingSupportOnlyCodes,
          approvedListKey: shape === "approved-course-list" ? approvedListKey : null,
        })
      );
    }
  }

  return supportLists;
}

function getSupportListLinkedPrimaryRequirementIds(owner, supportList) {
  if (!supportList.approvedListKey) {
    return [];
  }
  const plans = [
    resolveSourceGeneratedPlan(owner.planId, owner.pathwayId),
    resolveCompactRuntimeGeneratedPlan(owner.planId, owner.pathwayId),
  ].filter(Boolean);
  return uniqueSorted(
    plans.flatMap((plan) =>
      Array.from(collectGeneratedRequirementGroupsById(plan).values())
        .filter((group) => group.approvedListKey === supportList.approvedListKey)
        .map((group) => group.id)
    )
  );
}

function buildElectiveApprovedListShapeAuditRowsForOwner(owner) {
  const blocks = [
    ...source.getTransferPlannerParsedRequirementSourceBlocks(owner.planId, owner.pathwayId),
    ...studentRuntime.getTransferPlannerParsedRequirementSourceBlocks(owner.planId, owner.pathwayId),
  ];
  const rowsByKey = new Map();

  for (const block of blocks) {
    const supportLists = getSupportListsForAuditBlock(block);
    for (const supportList of supportLists) {
      const linkedPrimaryRequirementIds = getSupportListLinkedPrimaryRequirementIds(owner, supportList);
      const normalizedSupportList = {
        ...supportList,
        linkedPrimaryRequirementIds,
      };
      const issue = !["elective-list", "approved-course-list", "approved-filter-list"].includes(
        String(normalizedSupportList.shape ?? "")
      )
        ? "missing-list-shape"
        : normalizedSupportList.supportOnly !== true || normalizedSupportList.canCreateRequiredRow === true
          ? "list-promoted-to-required"
          : normalizedSupportList.canCreateScheduleRow === true
            ? "support-list-scheduled"
            : "none";
      const linkedPrimaryRequirement =
        linkedPrimaryRequirementIds.length ? linkedPrimaryRequirementIds.join(", ") : "none";
      const key = `${owner.ownerId}:${normalizedSupportList.id}:${normalizedSupportList.shape}:${normalizedSupportList.sourceUrl}`;
      if (rowsByKey.has(key)) {
        continue;
      }
      rowsByKey.set(key, {
        ownerId: owner.ownerId,
        listTitle: normalizedSupportList.listTitle,
        sourceUrl: normalizedSupportList.sourceUrl ?? "none",
        shape: normalizedSupportList.shape ?? "unknown",
        supportOnly: normalizedSupportList.supportOnly === true,
        canCreateScheduleRow: normalizedSupportList.canCreateScheduleRow === true,
        linkedPrimaryRequirement,
        acceptedUwCourseCodes: normalizedSupportList.acceptedUwCourseCodes ?? [],
        approvedListKey: normalizedSupportList.approvedListKey ?? null,
        issue,
        copyOnlyDebugText: [
          "[elective/approved list shape audit]",
          `Owner id: ${owner.ownerId}`,
          `List title: ${normalizedSupportList.listTitle}`,
          `Source URL: ${normalizedSupportList.sourceUrl ?? "none"}`,
          `Shape: ${normalizedSupportList.shape ?? "unknown"}`,
          `Support-only: ${normalizedSupportList.supportOnly === true ? "yes" : "no"}`,
          `Can create schedule row: ${normalizedSupportList.canCreateScheduleRow === true ? "yes" : "no"}`,
          `Linked primary requirement: ${linkedPrimaryRequirement}`,
          `Issue: ${issue}`,
        ].join(" "),
      });
    }
  }

  return Array.from(rowsByKey.values());
}

function buildParserExtractionRegressionRow(input) {
  const issue = input.passed ? "none" : input.issue;
  const suggestedFileFunction =
    input.suggestedFileFunction ??
    `${getSuggestedFileForIssue(issue)}::buildParsedRequirementGroups`;
  return {
    ownerId: input.ownerId,
    protectedPattern: input.protectedPattern,
    sourceUrl: input.sourceUrl ?? "n/a",
    expectedParserShape: input.expectedParserShape,
    actualParserShape: input.actualParserShape,
    passed: input.passed,
    issue,
    suggestedFileFunction,
    copyOnlyDebugText: [
      "[parser extraction regression report]",
      `Owner id: ${input.ownerId}`,
      `Protected pattern: ${input.protectedPattern}`,
      `Source URL: ${input.sourceUrl ?? "n/a"}`,
      `Expected parser shape: ${input.expectedParserShape}`,
      `Actual parser shape: ${input.actualParserShape}`,
      `Passed: ${input.passed ? "yes" : "no"}`,
      `Issue: ${issue}`,
      `Suggested file/function: ${suggestedFileFunction}`,
    ].join(" "),
  };
}

function includeParserExtractionTarget(targetPlanId, planId) {
  return !targetPlanId || targetPlanId === planId;
}

function buildParserFixtureBlock({
  ownerId,
  planId,
  sourceRole,
  sourceUrl,
  sourceLabel,
  courseCodes,
  snapshotLines,
}) {
  const baseResult = {
    ownerId,
    ownerTitle: sourceLabel,
    planId,
    pathwayId: null,
    campusId: "uw-seattle",
    primaryParserType: "generic-html",
    primarySourceUrl: sourceUrl,
    primarySourceLabel: sourceLabel,
    structuredUwCourseCodes: [],
  };
  const entry = {
    ownerTitle: sourceLabel,
    planId,
    pathwayId: null,
    campusId: "uw-seattle",
    url: sourceUrl,
    label: sourceLabel,
    role: "other",
    parserType: "generic-html",
  };
  const parsed = {
    title: sourceLabel,
    headings: [sourceLabel],
    requirementCueLines: snapshotLines,
    chooseStatements: [],
    pathwayLabels: [],
    courseCodes,
    snapshotLines,
    snapshotPath: `${ownerId}.parser-regression-fixture.txt`,
    parseConfidence: "high",
    resolvedSourceUrl: sourceUrl,
    resolvedSourceLabel: sourceLabel,
    resolvedParserType: "generic-html",
    sourceRole,
    sourceSectionAudit: null,
  };

  return parser.buildManifestParseSuccessForTest(baseResult, [], entry, parsed, "primary-source");
}

function buildParserExtractionRegressionRows(targetPlanId) {
  const rows = [];

  if (includeParserExtractionTarget(targetPlanId, "uw-seattle-environmental-engineering")) {
    const ownerId = "uw-seattle-environmental-engineering";
    const envSourceUrl = getPrimarySourceUrl(ownerId, null);
    const earthScienceExpectedOptions = [
      "ATMS 101",
      "ATMS 211",
      "ATMS 212",
      "ESRM 100",
      "ESRM 101",
      "ESRM 210",
      "ESS 106",
      "ESS 201",
      "ESS 211",
      "ESS 212",
      "NUTR 200",
      "OCEAN 102",
      "OCEAN 200",
    ];
    const envEarthScienceFixtureBlock = buildParserFixtureBlock({
      ownerId,
      planId: ownerId,
      sourceRole: "primary-degree-requirements",
      sourceUrl: envSourceUrl,
      sourceLabel: "Environmental Engineering Degree Sheet",
      courseCodes: earthScienceExpectedOptions,
      snapshotLines: [
        "Earth science elective 5 credits",
        earthScienceExpectedOptions.join(", "),
      ],
    });
    const envMatrixFixtureBlock = buildParserFixtureBlock({
      ownerId,
      planId: ownerId,
      sourceRole: "primary-degree-requirements",
      sourceUrl: envSourceUrl,
      sourceLabel: "Environmental Engineering Degree Sheet",
      courseCodes: ["AMATH 352", "MATH 208", "CEE 347"],
      snapshotLines: [
        "Matrix/Linear Algebra (AMATH 352 or MATH 208) 3cr",
        "CEE 347 Fundamentals of Fluid Mechanics (4)",
      ],
    });
    const earthScienceGroup = (envEarthScienceFixtureBlock.parsedRequirementGroups ?? []).find((group) =>
      /Earth science elective/i.test(group.sourceRowText ?? group.sourceHeading ?? group.label ?? "")
    );
    const matrixGroup = (envMatrixFixtureBlock.parsedRequirementGroups ?? []).find((group) =>
      /Matrix\/Linear Algebra/i.test(group.sourceRowText ?? group.label ?? "")
    );
    const matrixOptions = getGroupOptionUwCourses(matrixGroup);
    const atomCodes = uniqueSorted(
      (envMatrixFixtureBlock.parsedRequirementAtomCandidates ?? []).map((candidate) =>
        normalizeCourseCode(candidate.uwCourseCode)
      )
    );
    const earthSciencePassed =
      earthScienceGroup?.requirementType === "choose_one" &&
      earthScienceGroup.requiredCount === 1 &&
      getGroupOptionUwCourses(earthScienceGroup).length === earthScienceExpectedOptions.length &&
      earthScienceExpectedOptions.every((courseCode) =>
        getGroupOptionUwCourses(earthScienceGroup).includes(courseCode)
      );

    rows.push(
      buildParserExtractionRegressionRow({
        ownerId,
        protectedPattern: "Environmental Engineering Earth science comma choose-one list",
        sourceUrl: envSourceUrl,
        expectedParserShape: "one choose_one group with 13 UW course options and requiredCount=1",
        actualParserShape: getGroupShapeSummary(earthScienceGroup),
        passed: earthSciencePassed,
        issue: earthScienceGroup ? "missed-option-group" : "missing-option-group",
        suggestedFileFunction:
          "source/scripts/planner/parse-transfer-planner-requirement-sources.cjs::buildHeadingBackedChoiceRequirementGroups",
      })
    );

    const matrixPassed =
      matrixGroup?.requirementType === "choose_one" &&
      matrixOptions.includes("AMATH 352") &&
      matrixOptions.includes("MATH 208") &&
      !matrixOptions.includes("CEE 347");

    rows.push(
      buildParserExtractionRegressionRow({
        ownerId,
        protectedPattern: "Environmental Engineering Matrix/Linear Algebra boundary",
        sourceUrl: envSourceUrl,
        expectedParserShape: "AMATH 352 / MATH 208 option group does not absorb CEE 347",
        actualParserShape: `${getGroupShapeSummary(matrixGroup)}; atomRows=${joinList(atomCodes)}`,
        passed: matrixPassed,
        issue: "merged-adjacent-rows",
        suggestedFileFunction:
          "source/scripts/planner/parse-transfer-planner-requirement-sources.cjs::buildChoiceListSourceLine",
      })
    );
  }

  if (includeParserExtractionTarget(targetPlanId, "uw-seattle-aeronautics-astronautics")) {
    const ownerId = "uw-seattle-aeronautics-astronautics";
    const mixedGroupEntry = getParsedGroupsForOwnerId(ownerId).find(({ group }) =>
      (group.options ?? []).some((option) => option.categoryOption?.category === "NSC")
    );
    const mixedGroup = mixedGroupEntry?.group ?? null;
    const optionCourses = getGroupOptionUwCourses(mixedGroup);
    const categoryOption = (mixedGroup?.options ?? []).find(
      (option) => option.categoryOption?.category === "NSC"
    );
    const passed =
      mixedGroup?.requirementType === "choose_one" &&
      optionCourses.includes("CSE 160") &&
      optionCourses.includes("ME 123") &&
      Boolean(categoryOption) &&
      (categoryOption.uwCourses ?? []).length === 0;

    rows.push(
      buildParserExtractionRegressionRow({
        ownerId,
        protectedPattern: "A&A mixed CSE 160 / ME 123 / NSc category option",
        sourceUrl: mixedGroupEntry?.block?.sourceUrl,
        expectedParserShape: "choose_one group with CSE 160, ME 123, and non-concrete NSc category option",
        actualParserShape: getGroupShapeSummary(mixedGroup),
        passed,
        issue: categoryOption ? "fake-course-invented" : "missing-category-option",
        suggestedFileFunction:
          "source/scripts/planner/parse-transfer-planner-requirement-sources.cjs::buildCategoryCreditRequirementGroups",
      })
    );
  }

  if (includeParserExtractionTarget(targetPlanId, "uw-seattle-computer-engineering")) {
    const ownerId = "uw-seattle-computer-engineering";
    const ceSourceUrl = getPrimarySourceUrl(ownerId, null);
    const ceFixtureBlock = buildParserFixtureBlock({
      ownerId,
      planId: ownerId,
      sourceRole: "primary-degree-requirements",
      sourceUrl: ceSourceUrl,
      sourceLabel: "Computer Engineering Degree Requirements",
      courseCodes: [],
      snapshotLines: [
        "Mathematics & Natural Sciences (41 credits)",
        "10 additional credits from the list of approved (10)",
        "natural science courses for Computer Engineering on",
        "the CSE website",
        "3 to 6 additional credits of Math/Science (to (3-6)",
        "bring the total to 41) chosen from approved",
        "natural science courses for Computer Engineering on",
        "the CSE website, as well as STAT 391, 394, MATH 207, 209, 318, 334, 335, 394, AMATH 351, 353.",
      ],
    });
    const naturalScienceGroup = (ceFixtureBlock.parsedRequirementGroups ?? []).find(
      (group) => group.approvedListKey === "computer-engineering-natural-science"
    );
    const mathScienceGroup = (ceFixtureBlock.parsedRequirementGroups ?? []).find(
      (group) => group.approvedListKey === "computer-engineering-math-science"
    );
    const approvedListBlock = getParsedBlocksForOwnerId(ownerId).find(
      (block) => block.sourceRole === "approved-course-list"
    );
    const approvedListRequiredRows = [
      ...(approvedListBlock?.parsedRequirementAtomCandidates ?? []),
      ...(approvedListBlock?.parsedRequirementGroups ?? []),
    ];

    rows.push(
      buildParserExtractionRegressionRow({
        ownerId,
        protectedPattern: "Computer Engineering 10-credit approved Natural Science bucket",
        sourceUrl: ceSourceUrl,
        expectedParserShape: "choose_credits bucket with minCredits=10 maxCredits=10 and CE approved filter",
        actualParserShape: getGroupShapeSummary(naturalScienceGroup),
        passed:
          naturalScienceGroup?.requirementType === "choose_credits" &&
          naturalScienceGroup.minCredits === 10 &&
          naturalScienceGroup.maxCredits === 10,
        issue: "missing-credit-bucket",
        suggestedFileFunction:
          "source/scripts/planner/parse-transfer-planner-requirement-sources.cjs::buildCreditBucketRequirementGroups",
      })
    );

    rows.push(
      buildParserExtractionRegressionRow({
        ownerId,
        protectedPattern: "Computer Engineering 3-6 credit approved Math/Science bucket",
        sourceUrl: ceSourceUrl,
        expectedParserShape: "choose_credits bucket with minCredits=3 maxCredits=6 and CE approved filter",
        actualParserShape: getGroupShapeSummary(mathScienceGroup),
        passed:
          mathScienceGroup?.requirementType === "choose_credits" &&
          mathScienceGroup.minCredits === 3 &&
          mathScienceGroup.maxCredits === 6,
        issue: "missing-credit-bucket",
        suggestedFileFunction:
          "source/scripts/planner/parse-transfer-planner-requirement-sources.cjs::buildCreditBucketRequirementGroups",
      })
    );

    rows.push(
      buildParserExtractionRegressionRow({
        ownerId,
        protectedPattern: "Computer Engineering approved science list remains support metadata",
        sourceUrl: approvedListBlock?.sourceUrl,
        expectedParserShape: "approved-course-list source emits approved/support codes with no required rows or groups",
        actualParserShape: approvedListBlock
          ? `approved=${(approvedListBlock.approvedFilterUwCourseCodes ?? []).length}; support=${
              (approvedListBlock.supportOnlyUwCourseCodes ?? []).length
            }; requiredSurface=${approvedListRequiredRows.length}`
          : "missing approved-course-list block",
        passed:
          Boolean(approvedListBlock) &&
          (approvedListBlock.approvedFilterUwCourseCodes ?? []).length > 0 &&
          approvedListRequiredRows.length === 0,
        issue: "support-source-emitted-required-row",
        suggestedFileFunction:
          "source/scripts/planner/parse-transfer-planner-requirement-sources.cjs::buildManifestParseSuccess",
      })
    );
  }

  if (includeParserExtractionTarget(targetPlanId, "uw-seattle-computer-science")) {
    const owner = {
      ownerId: "uw-seattle-computer-science",
      planId: "uw-seattle-computer-science",
      pathwayId: null,
    };
    const csFixtureBlock = buildParserFixtureBlock({
      ownerId: owner.ownerId,
      planId: owner.planId,
      sourceRole: "primary-degree-requirements",
      sourceUrl: getPrimarySourceUrl(owner.planId, null),
      sourceLabel: "Computer Science Degree Requirements",
      courseCodes: [
        "CSE 123",
        "CSE 332",
        "CSE 403",
        "CSE 414",
        "CSE 421",
        "CSE 442",
        "MATH 208",
        "PHYS 122",
      ],
      snapshotLines: [
        "Graduation Requirements",
        "Fundamentals",
        "CSE 123 Intro to Computer Programming III (4)",
        "CSE 300-level prerequisites",
        "CSE 421 Prerequisites: CSE 332 and MATH 208",
        "Data Science option prerequisites: MATH 208 or AMATH 352",
        "CSE elective course list",
        "CSE 403, CSE 414, CSE 421, CSE 442",
        "Approved electives",
        "PHYS 122, MATH 208",
      ],
    });
    const prerequisiteRows = (csFixtureBlock.sourceSectionFilterAuditRows ?? []).map((row) => {
      const issue = getParserPrerequisiteFilterIssue(csFixtureBlock, row);
      return {
        ...row,
        courseCodesExtracted: uniqueSorted(
          (row.courseCodesExtracted ?? []).map(normalizeCourseCode).filter(Boolean)
        ),
        issue,
      };
    });
    const blockedCourseRows = prerequisiteRows.filter(
      (row) =>
        row.schedulable === false &&
        ["MATH 208", "PHYS 122", "CSE 403", "CSE 414", "CSE 421", "CSE 442"].some((courseCode) =>
          row.courseCodesExtracted.includes(courseCode)
        )
    );
    const issues = blockedCourseRows.filter((row) => row.issue !== "none");
    const requiredAtoms = (csFixtureBlock.parsedRequirementAtomCandidates ?? []).map(
      (candidate) => candidate.uwCourseCode
    );

    rows.push(
      buildParserExtractionRegressionRow({
        ownerId: owner.ownerId,
        protectedPattern: "Computer Science broad prerequisite/course-list sections are non-schedulable",
        sourceUrl: getPrimarySourceUrl(owner.planId, null),
        expectedParserShape: "upper-division prerequisite and course-list rows have Schedulable=no and Issue=none",
        actualParserShape: blockedCourseRows.length
          ? `${blockedCourseRows.map((row) => `${row.detectedSectionRole}:${joinList(row.courseCodesExtracted)}:${row.issue}`).join(" | ")}; requiredAtoms=${joinList(requiredAtoms)}`
          : `no blocked prerequisite/course-list audit rows found; requiredAtoms=${joinList(requiredAtoms)}`,
        passed:
          blockedCourseRows.length > 0 &&
          issues.length === 0 &&
          requiredAtoms.length === 1 &&
          requiredAtoms[0] === "CSE 123",
        issue: issues[0]?.issue ?? "prerequisite-table-emitted-requirement",
        suggestedFileFunction:
          "source/scripts/planner/parse-transfer-planner-requirement-sources.cjs::classifySourceSectionRoleForLine",
      })
    );
  }

  if (includeParserExtractionTarget(targetPlanId, "uw-seattle-chemical-engineering")) {
    const ownerId = "uw-seattle-chemical-engineering";
    const electiveFixtureBlock = buildParserFixtureBlock({
      ownerId,
      planId: ownerId,
      sourceRole: "elective-list",
      sourceUrl: "https://www.cheme.washington.edu/undergraduate/engineering-electives",
      sourceLabel: "ChemE/NME Engineering Elective Courses",
      courseCodes: ["AA 210", "MSE 170"],
      snapshotLines: ["Engineering elective courses: AA 210, MSE 170"],
    });
    const supportListRequiredSurfaces = [
      ...(electiveFixtureBlock.parsedRequirementAtomCandidates ?? []),
      ...(electiveFixtureBlock.parsedRequirementGroups ?? []),
    ];
    const passed =
      electiveFixtureBlock.supportOnly === true &&
      (electiveFixtureBlock.electiveListUwCourseCodes ?? []).length === 2 &&
      supportListRequiredSurfaces.length === 0;

    rows.push(
      buildParserExtractionRegressionRow({
        ownerId,
        protectedPattern: "ChemE/NME engineering elective lists do not emit required rows",
        sourceUrl: electiveFixtureBlock.sourceUrl,
        expectedParserShape: "elective-list/non-schedulable support sources emit metadata only",
        actualParserShape: `supportOnly=${electiveFixtureBlock.supportOnly ? "yes" : "no"}; electiveEntries=${joinList(
          electiveFixtureBlock.electiveListUwCourseCodes ?? []
        )}; requiredSurface=${supportListRequiredSurfaces.length}`,
        passed,
        issue: "false-required-promotion",
        suggestedFileFunction:
          "source/scripts/planner/parse-transfer-planner-requirement-sources.cjs::buildRequirementSourceScope",
      })
    );
  }

  for (const sequenceOwnerId of [
    "uw-seattle-biology",
    "uw-seattle-biochemistry",
    "uw-seattle-chemistry",
  ]) {
    const [planId] = sequenceOwnerId.split(":pathway:");
    if (!includeParserExtractionTarget(targetPlanId, planId)) {
      continue;
    }
    const sequenceGroupEntry = getParsedGroupsForOwnerId(sequenceOwnerId).find(({ group }) => {
      if (group.requirementType !== "sequence_choice") {
        return false;
      }
      if (sequenceOwnerId === "uw-seattle-biology") {
        return (
          groupHasSequencePath(group, ["PHYS 114", "PHYS 115"]) &&
          groupHasSequencePath(group, ["PHYS 121", "PHYS 122"]) &&
          groupHasSequencePath(group, ["PHYS 141", "PHYS 142"])
        );
      }
      return (
        groupHasSequencePath(group, ["PHYS 121", "PHYS 122", "PHYS 123"]) &&
        groupHasSequencePath(group, ["PHYS 114", "PHYS 115", "PHYS 116"])
      );
    });
    const sequenceGroup = sequenceGroupEntry?.group ?? null;
    const sequenceAuditRows = getParsedBlocksForOwnerId(sequenceOwnerId).flatMap(
      (block) => block.parserSequenceChoiceAuditRows ?? []
    );
    const flattened = sequenceAuditRows.some(
      (row) => row.emittedIndependentRequiredRows === true || row.issue === "flattened-sequence-paths"
    );

    rows.push(
      buildParserExtractionRegressionRow({
        ownerId: sequenceOwnerId,
        protectedPattern: `${sequenceOwnerId.replace(/^uw-seattle-/, "")} physics alternatives parse as sequence_choice`,
        sourceUrl: sequenceGroupEntry?.block?.sourceUrl ?? getPrimarySourceUrl(planId, null),
        expectedParserShape:
          sequenceOwnerId === "uw-seattle-biology"
            ? "sequence_choice paths PHYS 114/115, PHYS 121/122, PHYS 141/142"
            : "sequence_choice paths PHYS 121/122/123 and PHYS 114/115/116",
        actualParserShape: getGroupShapeSummary(sequenceGroup),
        passed: Boolean(sequenceGroup) && !flattened,
        issue: sequenceGroup ? "flattened-sequence-paths" : "missed-sequence-choice",
        suggestedFileFunction:
          "source/scripts/planner/parse-transfer-planner-requirement-sources.cjs::buildGenericSequenceChoiceRequirementGroups",
      })
    );
  }

  if (includeParserExtractionTarget(targetPlanId, "uw-seattle-sustainable-bioresource-systems-engineering")) {
    const ownerId = "uw-seattle-sustainable-bioresource-systems-engineering";
    const catalogUrl =
      "https://www.washington.edu/students/gencat/program/S/SchoolofEnvironmentalandForestScience-1069.html#program-UG-SBSE-MAJOR";
    const parsedCatalog = parser.parseHtmlSourceFromArtifactsForTest(
      {
        ownerTitle: "Sustainable Bioresource Systems Engineering",
        planId: ownerId,
        pathwayId: null,
        campusId: "uw-seattle",
        url: catalogUrl,
        label: "UW General Catalog SBSE anchored section",
        role: "official-catalog",
        parserType: "catalog-page",
      },
      `
      <h3 id="program-UG-ESRM-MAJOR">Program of Study: Major: Environmental Science and Terrestrial Resource Management</h3>
      <div id="program-UG-ESRM-MAJOR-block">
        <p>Major Requirements: ESRM 301, ESRM 320.</p>
      </div>
      <h3 id="program-UG-SBSE-MAJOR">Program of Study: Major: Sustainable Bioresource Systems Engineering</h3>
      <div id="program-UG-SBSE-MAJOR-block">
        <p>Major Requirements: SBSE 391, SBSE 392, SBSE 406, SBSE 410, SBSE 480, SBSE 481.</p>
      </div>
      <h3 id="program-UG-ESRM-MINOR">Minor Requirements</h3>
      <p>ESRM 250, ESRM 350.</p>
      `
    );
    const parsedCodes = uniqueSorted((parsedCatalog.courseCodes ?? []).map(normalizeCourseCode));
    const passed =
      parsedCodes.includes("SBSE 391") &&
      !parsedCodes.includes("ESRM 301");

    rows.push(
      buildParserExtractionRegressionRow({
        ownerId,
        protectedPattern: "SBSE anchored catalog section isolates requested major",
        sourceUrl: catalogUrl,
        expectedParserShape: "anchored SBSE catalog block includes SBSE requirements and excludes neighboring ESRM rows",
        actualParserShape: `codes=${joinList(parsedCodes.slice(0, 20))}; anchor=${
          parsedCatalog.sourceSectionAudit?.anchor ?? "#program-UG-SBSE-MAJOR"
        }`,
        passed,
        issue: "parser-source-scope-violation",
        suggestedFileFunction:
          "source/scripts/planner/parse-transfer-planner-requirement-sources.cjs::scopeCatalogHtmlByAnchor",
      })
    );
  }

  return rows;
}

function formatGroupCardinality(group, fallbackOptionCount = null) {
  if (!group) {
    return null;
  }

  if (group.requirementType === "choose_credits") {
    return `choose ${group.minCredits ?? "?"} credits`;
  }

  const minCourses = group.minCourses ?? (group.requirementType === "choose_one" ? 1 : null);
  const maxCourses = group.maxCourses ?? minCourses;
  const optionCount = group.options?.length ?? fallbackOptionCount;

  if (minCourses !== null && maxCourses !== null && minCourses === maxCourses) {
    return `${group.requirementType}: ${minCourses} of ${optionCount ?? "?"}`;
  }

  return `${group.requirementType}: ${minCourses ?? "?"}-${maxCourses ?? "?"} of ${
    optionCount ?? "?"
  }`;
}

function getHiddenReason(input) {
  if (!input.grcEquivalents.length) {
    return "No source-backed Green River equivalent is currently mapped.";
  }
  if (!input.generatedRuntimeRow) {
    return "Known Green River equivalent is missing from the generated runtime checklist/course list.";
  }
  if (!input.visibleInTransferOnlyPlan) {
    return "Known Green River equivalent is generated but is not visible in the transfer-only quarter plan.";
  }
  return null;
}

function classifyCoverageIssue(input) {
  if (input.groupedChoiceMax != null && input.visibleCourseCodes.length > input.groupedChoiceMax) {
    return "over-scheduled-alternatives";
  }
  if (!input.grcEquivalents.length && input.parsedUwCourseCodes.some(isLowerDivisionCourseCode)) {
    return "unmapped-uw-only";
  }
  if (input.grcEquivalents.length && (!input.generatedRuntimeRow || !input.visibleInTransferOnlyPlan)) {
    return "missing-detected-course";
  }
  return null;
}

function buildCoverageRowsForOwner(owner) {
  const runtimePlan = resolveRuntimePlan(owner.planId, owner.pathwayId);
  const primarySourceUrl = getPrimarySourceUrl(owner.planId, owner.pathwayId);
  const parsedBlocks = source.getTransferPlannerParsedRequirementSourceBlocks(
    owner.planId,
    owner.pathwayId
  );
  const generatedRuntimeCourseCodes = getRuntimeGeneratedCourseCodes(runtimePlan);
  const transferOnlyQuarterPlan = runtimePlan ? buildQuarterPlan(runtimePlan) : [];
  const visibleCourseCodeSet = getVisibleCourseCodeSet(transferOnlyQuarterPlan);

  return parsedBlocks.flatMap((block) =>
    buildParsedRequirementRows(block).map((parsedRow) => {
      const grcEquivalents = getGrcEquivalentsForUwCourses(parsedRow.parsedUwCourseCodes);
      const generatedRuntimeRow =
        grcEquivalents.length > 0 &&
        grcEquivalents.some((courseCode) => generatedRuntimeCourseCodes.has(normalizeCourseCode(courseCode)));
      const visibleCourseCodes = grcEquivalents.filter((courseCode) =>
        visibleCourseCodeSet.has(normalizeCourseCode(courseCode))
      );
      const visibleInTransferOnlyPlan = visibleCourseCodes.length > 0;
      const groupedChoiceMax = parseGroupedChoiceMax(parsedRow.groupedChoiceCardinality);
      const hiddenReason = getHiddenReason({
        grcEquivalents,
        generatedRuntimeRow,
        visibleInTransferOnlyPlan,
      });
      const issueType = classifyCoverageIssue({
        parsedUwCourseCodes: parsedRow.parsedUwCourseCodes,
        grcEquivalents,
        generatedRuntimeRow,
        visibleInTransferOnlyPlan,
        groupedChoiceMax,
        visibleCourseCodes,
      });

      return {
        majorId: owner.planId,
        ownerId: owner.ownerId,
        pathwayId: owner.pathwayId,
        majorTitle: owner.title,
        campusId: owner.campusId,
        uwSourceUrl: primarySourceUrl,
        detectedSourceRole: block.sourceRole ?? "ignored",
        sourceRoleStatus: block.sourceRoleStatus ?? getSourceRoleStatus(block.sourceRole ?? "ignored"),
        parserType: block.parserType ?? "unknown",
        canCreateSchedulableRows: canParsedBlockCreateSchedulableRows(block),
        uwRequirementLabel: parsedRow.uwRequirementLabel,
        parsedUwCourseCodes: parsedRow.parsedUwCourseCodes,
        matchedGrcEquivalents: grcEquivalents,
        generatedRuntimeRow,
        visibleInTransferOnlyQuarterPlan: visibleInTransferOnlyPlan,
        hiddenInternalReason: hiddenReason,
        groupedChoiceCardinality: parsedRow.groupedChoiceCardinality,
        issueType,
        copyOnlyDebugText: [
          "[copy-only source-backed requirement audit]",
          `Source URL: ${block.sourceUrl ?? primarySourceUrl ?? "unknown"}`,
          `Owner id: ${owner.ownerId}`,
          `Detected source role: ${block.sourceRole ?? "ignored"}`,
          `Primary/support/non-schedulable status: ${
            block.sourceRoleStatus ?? getSourceRoleStatus(block.sourceRole ?? "ignored")
          }`,
          `Parser type: ${block.parserType ?? "unknown"}`,
          `Can create schedulable rows: ${canParsedBlockCreateSchedulableRows(block) ? "yes" : "no"}`,
          `UW requirement: ${parsedRow.uwRequirementLabel}`,
          `GRC equivalent: ${grcEquivalents.length ? grcEquivalents.join(", ") : "none"}`,
          `Visible in plan: ${visibleInTransferOnlyPlan ? "yes" : "no"}`,
          `Hidden reason: ${hiddenReason ?? "none"}`,
        ].join(" "),
      };
    })
  );
}

function parseGroupedChoiceMax(cardinality) {
  const match = String(cardinality ?? "").match(/:\s*(\d+)(?:-\d+)?\s+of\b/i);
  return match ? Number(match[1]) : null;
}

function buildProtectedRequirementRows(planId, pathwayId, rows) {
  const runtimePlan = resolveRuntimePlan(planId, pathwayId ?? null);
  const primarySourceUrl = getPrimarySourceUrl(planId, pathwayId ?? null);
  const generatedRuntimeCourseCodes = getRuntimeGeneratedCourseCodes(runtimePlan);
  const transferOnlyQuarterPlan = runtimePlan ? buildQuarterPlan(runtimePlan) : [];
  const visibleCourseCodeSet = getVisibleCourseCodeSet(transferOnlyQuarterPlan);

  return rows.map(([uwRequirementLabel, parsedUwCourseCodes, grcEquivalents, cardinality]) => {
    const normalizedGrcEquivalents = uniqueSorted(grcEquivalents.map(normalizeCourseCode));
    const generatedRuntimeRow =
      normalizedGrcEquivalents.length > 0 &&
      normalizedGrcEquivalents.some((courseCode) => generatedRuntimeCourseCodes.has(courseCode));
    const visibleCourseCodes = normalizedGrcEquivalents.filter((courseCode) =>
      visibleCourseCodeSet.has(courseCode)
    );
    const visibleInTransferOnlyPlan = visibleCourseCodes.length > 0;
    const hiddenReason = getHiddenReason({
      grcEquivalents: normalizedGrcEquivalents,
      generatedRuntimeRow,
      visibleInTransferOnlyPlan,
    });
    const issueType = classifyCoverageIssue({
      parsedUwCourseCodes,
      grcEquivalents: normalizedGrcEquivalents,
      generatedRuntimeRow,
      visibleInTransferOnlyPlan,
      groupedChoiceMax: parseGroupedChoiceMax(cardinality),
      visibleCourseCodes,
    });

    return {
      majorId: planId,
      ownerId: buildOwnerId(planId, pathwayId ?? null),
      pathwayId: pathwayId ?? null,
      majorTitle: runtimePlan?.title ?? planId,
      campusId: runtimePlan?.campusId ?? null,
      uwSourceUrl: primarySourceUrl,
      uwRequirementLabel,
      parsedUwCourseCodes: uniqueSorted(parsedUwCourseCodes.map(normalizeCourseCode)),
      matchedGrcEquivalents: normalizedGrcEquivalents,
      generatedRuntimeRow,
      visibleInTransferOnlyQuarterPlan: visibleInTransferOnlyPlan,
      hiddenInternalReason: hiddenReason,
      groupedChoiceCardinality: cardinality ?? null,
      issueType,
      protectedRegressionRow: true,
      copyOnlyDebugText: [
        "[copy-only source-backed requirement audit]",
        `UW requirement: ${uwRequirementLabel}`,
        `GRC equivalent: ${normalizedGrcEquivalents.length ? normalizedGrcEquivalents.join(", ") : "none"}`,
        `Visible in plan: ${visibleInTransferOnlyPlan ? "yes" : "no"}`,
        `Hidden reason: ${hiddenReason ?? "none"}`,
      ].join(" "),
    };
  });
}

function addCheck(checks, id, label, passed, details = [], issueType = null, ownerId = null) {
  checks.push({
    id,
    ownerId,
    label,
    status: passed ? "passed" : "failed",
    issueType,
    details: Array.isArray(details) ? details.map(String) : [String(details)],
  });
}

function assertVisibleCourses(checks, idPrefix, label, plannedLabels, courseCodes) {
  const missing = courseCodes.filter((courseCode) => !plannedLabels.includes(courseCode));
  addCheck(
    checks,
    `${idPrefix}:visible-courses`,
    label,
    missing.length === 0,
    missing.length ? [`Missing: ${missing.join(", ")}`] : [`Visible: ${courseCodes.join(", ")}`],
    "missing-detected-course"
  );
}

function assertOrder(checks, id, label, plannedLabels, beforeCourseCode, afterCourseCode) {
  const beforeIndex = plannedLabels.indexOf(beforeCourseCode);
  const afterIndex = plannedLabels.indexOf(afterCourseCode);
  addCheck(
    checks,
    id,
    label,
    beforeIndex !== -1 && afterIndex !== -1 && beforeIndex < afterIndex,
    [`${beforeCourseCode} index: ${beforeIndex}`, `${afterCourseCode} index: ${afterIndex}`],
    "missing-detected-course"
  );
}

function getConfidenceScore(confidence) {
  if (confidence === "high") {
    return 100;
  }
  if (confidence === "medium") {
    return 60;
  }
  if (confidence === "low") {
    return 20;
  }
  return 0;
}

function getParsedEngineeringFundamentalsFromBlocks(parsedBlocks) {
  const parsedCourseCodes = new Set(
    (parsedBlocks ?? [])
      .flatMap((block) => block.parsedUwCourseCodes ?? [])
      .map(normalizeCourseCode)
      .filter(Boolean)
  );
  return ME_ENGINEERING_FUNDAMENTALS_UW_CODES.filter((courseCode) =>
    parsedCourseCodes.has(courseCode)
  );
}

function buildMechanicalSourceDiscoveryAuditLines() {
  const planId = "uw-seattle-mechanical-engineering";
  const parsedBlocks = source.getTransferPlannerParsedRequirementSourceBlocks(planId, null);
  const parsedBlocksByUrl = new Map(parsedBlocks.map((block) => [block.sourceUrl, block]));

  return source.getTransferPlannerSourceManifestEntriesForPlan(planId, null).map((entry) => {
    const parsedBlock = parsedBlocksByUrl.get(entry.url);
    const extractedEngineeringFundamentals = getParsedEngineeringFundamentalsFromBlocks(
      parsedBlock ? [parsedBlock] : []
    );
    const reason = entry.isPrimaryDegreeRequirementsLink
      ? "selected primary degree requirements source"
      : entry.note || (entry.validationNotes ?? []).join("; ") || "candidate retained for source traceability";

    return [
      "[source discovery audit]",
      "Major: Mechanical Engineering",
      `Owner id: ${entry.ownerId ?? planId}`,
      `Source URL: ${entry.url}`,
      `Candidate URL: ${entry.url}`,
      `Detected source role: ${entry.role ?? "unknown"}`,
      `Source role: ${entry.role ?? "unknown"}`,
      `Primary/support/non-schedulable status: ${getSourceRoleStatus(entry.role ?? "ignored")}`,
      `Parser type: ${entry.parserType ?? "unknown"}`,
      `Ranking score: ${getConfidenceScore(entry.confidence)}`,
      `Score: ${getConfidenceScore(entry.confidence)}`,
      `Reason for role: ${reason}`,
      `Can create schedulable rows: ${canSourceRoleCreateSchedulableRows(entry.role ?? "ignored") ? "yes" : "no"}`,
      `Used for parsing: ${parsedBlock ? "yes" : "no"}`,
      `Reason: ${reason}`,
      `Extracted Engineering Fundamentals: ${
        extractedEngineeringFundamentals.length
          ? extractedEngineeringFundamentals.join(", ")
          : "none"
      }`,
    ].join(" ");
  });
}

function buildMechanicalSourceSectionAuditLines() {
  const planId = "uw-seattle-mechanical-engineering";
  const parsedBlocks = source.getTransferPlannerParsedRequirementSourceBlocks(planId, null);
  if (!parsedBlocks.length) {
    return [
      [
        "[source section audit]",
        "Major: Mechanical Engineering",
        "Source URL: none",
        "Section heading: Engineering Fundamentals",
        "Section matched selected major: no",
        "Parsed UW courses: none",
        "Ignored reason if skipped: no parsed source block",
      ].join(" "),
    ];
  }

  return parsedBlocks.map((block) => {
    const extractedEngineeringFundamentals = getParsedEngineeringFundamentalsFromBlocks([block]);
    const sectionAudit = block.sourceSectionAudit ?? null;
    const ignoredReason =
      extractedEngineeringFundamentals.length === ME_ENGINEERING_FUNDAMENTALS_UW_CODES.length
        ? "none"
        : "cached/generated parser artifact does not include the full Engineering Fundamentals section";

    return [
      "[source section audit]",
      "Major: Mechanical Engineering",
      `Source URL: ${block.sourceUrl ?? "unknown"}`,
      `Section heading: ${sectionAudit?.sectionHeading ?? "Engineering Fundamentals"}`,
      `Section matched selected major: ${
        sectionAudit
          ? sectionAudit.sectionMatchedSelectedMajor
            ? "yes"
            : "no"
          : "yes"
      }`,
      `Parsed UW courses: ${
        extractedEngineeringFundamentals.length
          ? extractedEngineeringFundamentals.join(", ")
          : "none"
      }`,
      `Ignored reason if skipped: ${ignoredReason}`,
    ].join(" ");
  });
}

function auditMechanicalEngineering(checks) {
  const plan = resolveRuntimePlan("uw-seattle-mechanical-engineering", null);
  const quarterPlan = buildQuarterPlan(plan);
  const labels = getVisiblePlannedLabels(quarterPlan);
  const expectedCourses = [
    "ENGL& 101",
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "PHYS& 221",
    "PHYS& 222",
    "PHYS& 223",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "ENGR& 214",
    "ENGR 250",
    "ENGR& 225",
    "ENGR& 204",
    "ENGR& 114",
    "ENGR& 215",
    "ENGR 140",
    "MATH& 264",
    "MATH 238",
    "MATH 240",
  ];
  const sourceDiscoveryAuditLines = buildMechanicalSourceDiscoveryAuditLines();
  const sourceSectionAuditLines = buildMechanicalSourceSectionAuditLines();

  assertVisibleCourses(
    checks,
    "uw-mechanical-engineering",
    "UW Mechanical Engineering lower-division GRC equivalents are visible",
    labels,
    expectedCourses
  );
  addCheck(
    checks,
    "uw-mechanical-engineering:no-upper-division",
    "UW Mechanical Engineering transfer-only plan excludes UW-only upper-division ME/CEE rows",
    !labels.some((label) => /^(?:M\s*E|ME|CEE)\s*[34]\d{2}/i.test(label)),
    labels.filter((label) => /^(?:M\s*E|ME|CEE)\s*[34]\d{2}/i.test(label)),
    "unmapped-uw-only"
  );
  assertOrder(checks, "uw-mechanical-engineering:engr214-before-engr215", "ENGR& 214 before ENGR& 215", labels, "ENGR& 214", "ENGR& 215");
  assertOrder(checks, "uw-mechanical-engineering:engr214-before-engr225", "ENGR& 214 before ENGR& 225", labels, "ENGR& 214", "ENGR& 225");
  assertOrder(checks, "uw-mechanical-engineering:chem161-before-chem162", "CHEM& 161 before CHEM& 162", labels, "CHEM& 161", "CHEM& 162");
  assertOrder(checks, "uw-mechanical-engineering:chem162-before-chem163", "CHEM& 162 before CHEM& 163", labels, "CHEM& 162", "CHEM& 163");
  assertOrder(checks, "uw-mechanical-engineering:phys221-before-phys222", "PHYS& 221 before PHYS& 222", labels, "PHYS& 221", "PHYS& 222");
  assertOrder(checks, "uw-mechanical-engineering:phys222-before-phys223", "PHYS& 222 before PHYS& 223", labels, "PHYS& 222", "PHYS& 223");
  assertOrder(checks, "uw-mechanical-engineering:math264-before-math238", "MATH& 264 before MATH 238", labels, "MATH& 264", "MATH 238");
  addCheck(
    checks,
    "uw-mechanical-engineering:source-discovery-audit",
    "UW Mechanical Engineering source discovery audit records selected source",
    sourceDiscoveryAuditLines.some((line) =>
      /Candidate URL: https:\/\/www\.me\.washington\.edu\/students\/ug\/requirements\b/.test(line)
    ),
    sourceDiscoveryAuditLines,
    "missing-detected-course"
  );
  addCheck(
    checks,
    "uw-mechanical-engineering:source-section-audit",
    "UW Mechanical Engineering source section audit records Engineering Fundamentals extraction",
    sourceSectionAuditLines.length > 0,
    sourceSectionAuditLines,
    "missing-detected-course"
  );
  const requiredCoverageAudit = planner.auditRequiredMappedCourseCoverage({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const missingFundamentalsCoverage = ME_ENGINEERING_FUNDAMENTALS_UW_CODES.filter(
    (uwCourseCode) =>
      !requiredCoverageAudit.some(
        (row) => row.uwCourse === uwCourseCode && row.visibleInPlan && row.issue === null
      )
  );
  addCheck(
    checks,
    "uw-mechanical-engineering:required-coverage-engineering-fundamentals",
    "UW Mechanical Engineering required coverage includes all Engineering Fundamentals rows",
    missingFundamentalsCoverage.length === 0,
    missingFundamentalsCoverage.length
      ? [
          `Missing coverage: ${missingFundamentalsCoverage.join(", ")}`,
          ...requiredCoverageAudit.map((row) => row.copyOnlyDebugText),
        ]
      : requiredCoverageAudit
          .filter((row) => ME_ENGINEERING_FUNDAMENTALS_UW_CODES.includes(row.uwCourse))
          .map((row) => row.copyOnlyDebugText),
    "missing-detected-course"
  );
  addCheck(
    checks,
    "uw-mechanical-engineering:quarter-audit-clean",
    "UW Mechanical Engineering visible-quarter audit is clean",
    planner.auditVisibleGrcQuarterPlanScope({
      plan,
      suggestedPlan: quarterPlan,
      completedCourses: [],
      transferOnlyMode: true,
    }).length === 0,
    [],
    "missing-detected-course"
  );
}

function auditCivilEngineering(checks) {
  const plan = resolveRuntimePlan("uw-seattle-civil-engineering", null);
  const quarterPlan = buildQuarterPlan(plan);
  const labels = getVisiblePlannedLabels(quarterPlan);
  const requiredCoverageAudit = planner.auditRequiredMappedCourseCoverage({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const chem152Coverage = requiredCoverageAudit.find((row) => row.uwCourse === "CHEM 152");
  const compoundAudit = planner.auditCompoundEquivalencyPaths({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const chem152Compound = compoundAudit.find((row) => row.uwCourse === "CHEM 152");
  const trueOptionAudit = planner.auditTrueOptionDetection({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const computingTrueOption = trueOptionAudit.find((row) =>
    /computing|programming/i.test(row.requirement)
  );
  const visibleOptionGroups = getVisiblePlannedCourses(quarterPlan)
    .map((course) => course.optionGroup)
    .filter(Boolean);
  const computingOptionGroup = visibleOptionGroups.find((group) =>
    /computing|programming/i.test(group.title)
  );
  const civilAudit = planner.auditUwCivilEngineeringLowerDivisionRequirements({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const byRequirement = new Map(civilAudit.map((entry) => [entry.uwRequirement, entry]));
  const scienceVisibleCount = ["NATRS 210", "GEOL& 101"].filter((courseCode) =>
    labels.includes(courseCode)
  ).length;
  const stats = byRequirement.get("Statistics: IND E 315, QSCI 381, STAT 290, or STAT 390");

  addCheck(
    checks,
    "uw-civil-engineering:chem152-visible",
    "UW Civil Engineering CHEM 152 maps to visible CHEM& 162 and CHEM& 163",
    byRequirement.get("CHEM 152")?.visibleInQuarterPlan === true &&
      ["CHEM& 162", "CHEM& 163"].every((courseCode) =>
        byRequirement.get("CHEM 152")?.visibleCourseCodes?.includes(courseCode)
      ),
    JSON.stringify(byRequirement.get("CHEM 152") ?? null),
    "missing-detected-course"
  );
  addCheck(
    checks,
    "uw-civil-engineering:chem152-required-coverage",
    "UW Civil Engineering CHEM 152 required coverage uses the full compound GRC path",
    JSON.stringify(chem152Coverage?.mappedGrcEquivalentPath ?? []) ===
      JSON.stringify(["CHEM& 162", "CHEM& 163"]) &&
      chem152Coverage?.visibleInPlan === true &&
      chem152Coverage?.issue === null,
    chem152Coverage?.copyOnlyDebugText ?? labels.join(", "),
    "partial-compound-path"
  );
  addCheck(
    checks,
    "uw-civil-engineering:chem152-compound-audit",
    "UW Civil Engineering CHEM 152 compound audit is satisfied by scheduled components",
    JSON.stringify(chem152Compound?.grcCompoundPath ?? []) ===
      JSON.stringify(["CHEM& 162", "CHEM& 163"]) &&
      chem152Compound?.satisfied === true &&
      chem152Compound?.issue === null,
    chem152Compound?.copyOnlyDebugText ?? labels.join(", "),
    "partial-compound-path"
  );
  addCheck(
    checks,
    "uw-civil-engineering:computing-option-visible-unresolved",
    "UW Civil Engineering computing/programming true option appears as unresolved 0/1 without auto-scheduling",
    computingOptionGroup?.selectionCount === 1 &&
      (computingOptionGroup.resolvedSatisfiedOptionIds ?? []).length === 0 &&
      ["ENGR 250", "CS 121", "CS 122", "CS 123", "CS& 141"].every(
        (courseCode) => !labels.includes(courseCode)
      ) &&
      computingTrueOption?.detectedAsTrueOption === true &&
      computingTrueOption?.visibleOptionGroup === true &&
      computingTrueOption?.satisfiedBy === "none" &&
      computingTrueOption?.issue === null,
    [
      computingTrueOption?.copyOnlyDebugText,
      JSON.stringify(computingOptionGroup ?? null),
      labels.join(", "),
    ].filter(Boolean).join("\n"),
    "missing-option-group"
  );
  addCheck(
    checks,
    "uw-civil-engineering:one-basic-science",
    "UW Civil Engineering schedules exactly one Basic Science Elective",
    scienceVisibleCount === 1,
    `Visible alternatives: ${["NATRS 210", "GEOL& 101"].filter((courseCode) => labels.includes(courseCode)).join(", ")}`,
    "over-scheduled-alternatives"
  );
  addCheck(
    checks,
    "uw-civil-engineering:statistics-hidden",
    "UW Civil Engineering statistics stays hidden/internal when unmapped",
    stats?.visibleInQuarterPlan === false &&
      /No source-backed Green River equivalent/i.test(stats?.hiddenUnmappedReason ?? ""),
    JSON.stringify(stats ?? null),
    "unmapped-uw-only"
  );
  assertOrder(checks, "uw-civil-engineering:chem161-before-chem162", "CHEM& 161 before CHEM& 162", labels, "CHEM& 161", "CHEM& 162");
  assertOrder(checks, "uw-civil-engineering:chem162-before-chem163", "CHEM& 162 before CHEM& 163", labels, "CHEM& 162", "CHEM& 163");
  assertOrder(checks, "uw-civil-engineering:engr214-before-engr215", "ENGR& 214 before ENGR& 215", labels, "ENGR& 214", "ENGR& 215");
  assertOrder(checks, "uw-civil-engineering:engr214-before-engr225", "ENGR& 214 before ENGR& 225", labels, "ENGR& 214", "ENGR& 225");
  assertOrder(checks, "uw-civil-engineering:math264-before-math238", "MATH& 264 before MATH 238", labels, "MATH& 264", "MATH 238");

  const cs122Completed = [{ code: "CS 122", label: "CS 122", credits: 5 }];
  const cs122QuarterPlan = buildQuarterPlan(plan, { completedCourses: cs122Completed });
  const cs122Labels = getVisiblePlannedLabels(cs122QuarterPlan);
  const cs122TrueOption = planner.auditTrueOptionDetection({
    plan,
    suggestedPlan: cs122QuarterPlan,
    completedCourses: cs122Completed,
  }).find((row) => /computing|programming/i.test(row.requirement));
  addCheck(
    checks,
    "uw-civil-engineering:computing-option-satisfied-by-transcript",
    "UW Civil Engineering completed CS 122 satisfies computing/programming without scheduling another computing course",
    cs122TrueOption?.satisfiedBy === "transcript-completed" &&
      ["ENGR 250", "CS 123", "CS& 141"].every((courseCode) => !cs122Labels.includes(courseCode)),
    cs122TrueOption?.copyOnlyDebugText ?? cs122Labels.join(", "),
    "missing-option-group"
  );

  const chem162Completed = [{ code: "CHEM& 162", label: "CHEM& 162", credits: 5 }];
  const chem162QuarterPlan = buildQuarterPlan(plan, { completedCourses: chem162Completed });
  const chem162Labels = getVisiblePlannedLabels(chem162QuarterPlan);
  addCheck(
    checks,
    "uw-civil-engineering:partial-chem152-schedules-missing-component",
    "UW Civil Engineering completed CHEM& 162 only schedules CHEM& 163 for the CHEM 152 compound path",
    chem162Labels.includes("CHEM& 163") && !chem162Labels.includes("CHEM& 162"),
    chem162Labels.join(", "),
    "partial-compound-path"
  );

  const chemFullCompleted = [
    { code: "CHEM& 162", label: "CHEM& 162", credits: 5 },
    { code: "CHEM& 163", label: "CHEM& 163", credits: 5 },
  ];
  const chemFullQuarterPlan = buildQuarterPlan(plan, { completedCourses: chemFullCompleted });
  const chemFullLabels = getVisiblePlannedLabels(chemFullQuarterPlan);
  addCheck(
    checks,
    "uw-civil-engineering:completed-chem152-compound-not-rescheduled",
    "UW Civil Engineering completed CHEM& 162 and CHEM& 163 fully satisfy CHEM 152 without rescheduling either component",
    !chemFullLabels.includes("CHEM& 162") && !chemFullLabels.includes("CHEM& 163"),
    chemFullLabels.join(", "),
    "partial-compound-path"
  );
}

function auditComputerEngineering(checks) {
  const plan = resolveRuntimePlan("uw-seattle-computer-engineering", null);
  const track = source.getTransferPlannerTrack(plan?.bestTrackId ?? null);
  const quarterPlan = buildQuarterPlan(plan, {
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
  });
  const labels = getVisiblePlannedLabels(quarterPlan);
  const trueOptionAudit = planner.auditTrueOptionDetection({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  });
  const programmingAudit = trueOptionAudit.find(
    (row) => row.requirement === "CSE 123 or CSE 143"
  );
  const requiredCoverageAudit = planner.auditRequiredMappedCourseCoverage({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const phys121Coverage = requiredCoverageAudit.find((row) => row.uwCourse === "PHYS 121");
  const phys122Coverage = requiredCoverageAudit.find((row) => row.uwCourse === "PHYS 122");
  const bucketAudit = planner.auditComputerEngineeringCreditBuckets({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const naturalScienceBucket = bucketAudit.find((row) =>
    /10 additional credits approved natural science/i.test(row.requirement)
  );
  const mathScienceBucket = bucketAudit.find((row) =>
    /3-6 additional Math\/Science/i.test(row.requirement)
  );
  const creditRange = planner.buildSuggestedQuarterRemainingCreditRange({
    quarters: quarterPlan,
    track,
  });

  addCheck(
    checks,
    "uw-computer-engineering:cse-123-or-cse-143-option-group",
    "UW Computer Engineering models CSE 123 / CSE 143 as one true option group and defaults to CS 123",
    programmingAudit?.detectedAsTrueOption === true &&
      programmingAudit?.visibleOptionGroup === true &&
      programmingAudit?.requiredCount === 1 &&
      JSON.stringify(programmingAudit?.acceptedUwOptions ?? []) ===
        JSON.stringify(["CSE 123", "CSE 143"]) &&
      JSON.stringify(programmingAudit?.mappedGrcOptions ?? []) ===
        JSON.stringify(["CS 123", "CS 145"]) &&
      programmingAudit?.issue === null &&
      labels.includes("CS 123") &&
      !labels.includes("CS 145") &&
      !requiredCoverageAudit.some(
        (row) => row.uwCourse === "CSE 143" && row.issue === "missing-required-mapped-course"
      ),
    [
      programmingAudit?.copyOnlyDebugText ?? "missing programming audit row",
      `Labels: ${labels.join(", ")}`,
      requiredCoverageAudit.map((row) => row.copyOnlyDebugText).join("\n"),
    ],
    "missing-option-group"
  );

  addCheck(
    checks,
    "uw-computer-engineering:math-science-credit-buckets",
    "UW Computer Engineering preserves and counts the approved Natural Science and Math/Science credit buckets",
    naturalScienceBucket?.categoryListPlaceholderVisible === true &&
      naturalScienceBucket?.plannedUnresolvedCredits === "10" &&
      naturalScienceBucket?.issue === null &&
      naturalScienceBucket?.mappedConcreteOptions?.includes("CHEM& 161") &&
      naturalScienceBucket?.mappedConcreteOptions?.includes("PHYS& 223") &&
      mathScienceBucket?.categoryListPlaceholderVisible === true &&
      mathScienceBucket?.plannedUnresolvedCredits === "3-6" &&
      mathScienceBucket?.issue === null &&
      mathScienceBucket?.mappedConcreteOptions?.includes("MATH 238") &&
      creditRange.scheduledMinRemainingCredits === 68 &&
      creditRange.scheduledMaxRemainingCredits === 71,
    [
      naturalScienceBucket?.copyOnlyDebugText ?? "missing natural science bucket",
      mathScienceBucket?.copyOnlyDebugText ?? "missing Math/Science bucket",
      `Credit range: ${JSON.stringify(creditRange)}`,
    ],
    "missing-credit-bucket"
  );

  const ceApprovedFilterAudit =
    planner.auditComputerEngineeringApprovedNaturalScienceTransferCategoryFilter({
      courseCodes: [
        "CHEM& 161",
        "CHEM& 162",
        "CHEM& 163",
        "PHYS& 223",
        "BIOL& 211",
        "BIOL& 212",
        "BIOL& 213",
        "ANTH& 205",
      ],
    });
  const ceApprovedSourceAudit =
    planner.auditComputerEngineeringApprovedNaturalScienceEquivalencies();
  const ceApprovedManifestSources = (
    source.getTransferPlannerSourceManifestEntriesForPlan?.(
      "uw-seattle-computer-engineering",
      null
    ) ?? []
  ).filter((entry) => entry.role === "approved-course-list");
  const hasIncludedFilterCourse = (coursePattern, uwPattern) =>
    ceApprovedFilterAudit.some(
      (row) =>
        row.included === true &&
        coursePattern.test(row.course) &&
        uwPattern.test(row.uwEquivalent)
    );
  const hasExcludedGenericCourse = (coursePattern) =>
    ceApprovedFilterAudit.some(
      (row) =>
        row.included === false &&
        row.reason === "generic-category-only" &&
        coursePattern.test(row.course)
    );

  addCheck(
    checks,
    "uw-computer-engineering:approved-course-list-source-role",
    "UW Computer Engineering keeps the Allen School CE-approved Natural Science list as a support source",
    ceApprovedManifestSources.some(
      (entry) =>
        /degree-requirements\/courses\/#core/i.test(entry.url ?? "") &&
        getSourceRoleStatus(entry.role) === "support"
    ),
    ceApprovedManifestSources.map(
      (entry) =>
        `[source-role coverage report] Owner id: uw-seattle-computer-engineering Primary source: ${
          getPrimarySourceUrl("uw-seattle-computer-engineering", null) ?? "none"
        } Support sources: ${entry.url} Approved-course-list sources: ${
          entry.url
        } Elective-list sources: none Non-schedulable sources: none Source-scope issues: none`
    ),
    "missing-approved-course-list-source"
  );

  addCheck(
    checks,
    "uw-computer-engineering:ce-approved-natural-science-filter",
    "UW Computer Engineering uses the Allen School CE-approved Natural Science filter instead of generic NSc/NW",
    naturalScienceBucket?.filterSource === "ce-approved-natural-science" &&
      hasIncludedFilterCourse(/CHEM& 161/, /CHEM 142/) &&
      hasIncludedFilterCourse(/CHEM& 162.*CHEM& 163/, /CHEM 152.*CHEM 162/) &&
      hasIncludedFilterCourse(/PHYS& 223/, /PHYS 123/) &&
      hasIncludedFilterCourse(/BIOL& 211.*BIOL& 212.*BIOL& 213/, /BIOL 180.*BIOL 200.*BIOL 220/) &&
      hasExcludedGenericCourse(/ANTH& 205/) &&
      ceApprovedSourceAudit.some(
        (row) => row.uwApprovedCourse === "CHEM 142" && row.includedInFilter === true
      ) &&
      ceApprovedSourceAudit.some(
        (row) => row.reason === "petition-only" && row.includedInFilter === false
      ),
    [
      naturalScienceBucket?.copyOnlyDebugText ?? "missing natural science bucket",
      ceApprovedFilterAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      ceApprovedSourceAudit
        .filter((row) => /CHEM 142|petition/i.test(row.copyOnlyDebugText))
        .map((row) => row.copyOnlyDebugText)
        .join("\n"),
    ],
    "missing-ce-approved-filter"
  );

  addCheck(
    checks,
    "uw-computer-engineering:phys121-source-backed-required",
    "UW Computer Engineering marks PHYS 121 and PHYS 122 as source-backed required rows",
    phys121Coverage?.visibleInPlan === true &&
      phys121Coverage?.issue === null &&
      JSON.stringify(phys121Coverage?.mappedGrcEquivalentPath ?? []) ===
        JSON.stringify(["PHYS& 221"]) &&
      phys122Coverage?.visibleInPlan === true &&
      phys122Coverage?.issue === null &&
      JSON.stringify(phys122Coverage?.mappedGrcEquivalentPath ?? []) ===
        JSON.stringify(["PHYS& 222"]),
    [
      phys121Coverage?.copyOnlyDebugText ?? "missing PHYS 121 coverage",
      phys122Coverage?.copyOnlyDebugText ?? "missing PHYS 122 coverage",
    ],
    "missing-detected-course"
  );

  for (const completedCourseCode of ["CS 123", "CS 145"]) {
    const completedCourses = [
      { code: completedCourseCode, label: completedCourseCode, credits: 5 },
    ];
    const completedQuarterPlan = buildQuarterPlan(plan, {
      completedCourses,
      plannerCollegeId: "uw",
      includeStayAtGrcCourses: false,
      includeStemPrepCourses: false,
    });
    const completedLabels = getVisiblePlannedLabels(completedQuarterPlan);
    const completedProgrammingAudit = planner.auditTrueOptionDetection({
      plan,
      suggestedPlan: completedQuarterPlan,
      completedCourses,
      selectedRequirementOptionIdsByGroup: {},
    }).find((row) => row.requirement === "CSE 123 or CSE 143");

    addCheck(
      checks,
      `uw-computer-engineering:${completedCourseCode.toLowerCase().replace(/\s+/g, "-")}-satisfies-programming-option`,
      `UW Computer Engineering completed ${completedCourseCode} satisfies the CSE 123/CSE 143 option group`,
      completedProgrammingAudit?.satisfiedBy === "transcript-completed" &&
        completedProgrammingAudit?.issue === null &&
        !completedLabels.includes("CS 123") &&
        !completedLabels.includes("CS 145"),
      [
        completedProgrammingAudit?.copyOnlyDebugText ?? "missing completed programming audit row",
        `Labels: ${completedLabels.join(", ")}`,
      ],
      "missing-option-group"
    );
  }

  const cseGroup = plan?.requirementGroups?.find((group) =>
    /cse-123-or-cse-143/.test(group.id)
  );
  const cse143Option = cseGroup?.options.find((option) =>
    (option.uwCourses ?? []).includes("CSE 143")
  );
  const selectedRequirementOptionIdsByGroup =
    cseGroup?.id && cse143Option?.id
      ? {
          [cseGroup.id]: [cse143Option.id],
        }
      : {};
  const selectedQuarterPlan = buildQuarterPlan(plan, {
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    selectedRequirementOptionIdsByGroup,
  });
  const selectedLabels = getVisiblePlannedLabels(selectedQuarterPlan);
  const selectedCs141 = getVisiblePlannedCourses(selectedQuarterPlan).find(
    (course) => course.label === "CS& 141"
  );
  const selectedProgrammingAudit = planner.auditTrueOptionDetection({
    plan,
    suggestedPlan: selectedQuarterPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup,
  }).find((row) => row.requirement === "CSE 123 or CSE 143");

  addCheck(
    checks,
    "uw-computer-engineering:selected-cse143-path",
    "UW Computer Engineering selected CSE 143 path schedules CS 145 and its local prerequisite without CS 123",
    Boolean(cseGroup) &&
      Boolean(cse143Option) &&
      selectedLabels.includes("CS 145") &&
      selectedLabels.includes("CS& 141") &&
      !selectedLabels.includes("CS 123") &&
      selectedCs141?.sourceKind === "official-grc-track" &&
      selectedCs141?.courseRole === "local_grc_prerequisite" &&
      selectedProgrammingAudit?.satisfiedBy === "user-selected" &&
      selectedProgrammingAudit?.issue === null,
    [
      selectedProgrammingAudit?.copyOnlyDebugText ?? "missing selected programming audit row",
      `Labels: ${selectedLabels.join(", ")}`,
      `CS& 141: ${JSON.stringify(selectedCs141 ?? null)}`,
    ],
    "missing-detected-course"
  );
}

function auditComputerScience(checks) {
  const plan = resolveRuntimePlan("uw-seattle-computer-science", "data-science-option");
  const quarterPlan = buildQuarterPlan(plan, {
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
  });
  const labels = getVisiblePlannedLabels(quarterPlan);
  const parsedBlocks = source.getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-computer-science",
    "data-science-option"
  );
  const dataScienceBlock = parsedBlocks.find((block) =>
    /CS_DS_degreq_fall23\.pdf/i.test(block.sourceUrl ?? "")
  );
  const sourceScopeRows = buildSourceScopeAuditRowsForOwner({
    ownerId: "uw-seattle-computer-science:pathway:data-science-option",
    planId: "uw-seattle-computer-science",
    pathwayId: "data-science-option",
    title: "Computer Science - Data Science option",
    campusId: "uw-seattle",
  });
  const sourceScopeRowsByCourse = new Map(sourceScopeRows.map((row) => [row.courseCode, row]));
  const requiredCoverageAudit = planner.auditRequiredMappedCourseCoverage({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const trueOptionAudit = planner.auditTrueOptionDetection({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  });
  const programmingAudit = trueOptionAudit.find(
    (row) => row.requirement === "CSE 123 or CSE 143"
  );
  const pollutedLabels = [
    "PHYS& 222",
    "PHYS& 221",
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
    "CS 145",
    "CS& 141",
  ];
  const forbiddenParsedCodes = ["PHYS 122", "BIOL 180", "BIOL 200"];
  const forbiddenCoverageCodes = ["PHYS 122", "BIOL 180", "BIOL 200"];
  const csApprovedManifestSources = (
    source.getTransferPlannerSourceManifestEntriesForPlan?.(
      "uw-seattle-computer-science",
      "data-science-option"
    ) ?? []
  ).filter((entry) => entry.role === "approved-course-list");
  const completedProgrammingCourses = [{ code: "CS 123", label: "CS 123", credits: 5 }];
  const completedProgrammingQuarterPlan = buildQuarterPlan(plan, {
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    completedCourses: completedProgrammingCourses,
  });
  const completedProgrammingLabels = getVisiblePlannedLabels(completedProgrammingQuarterPlan);
  const completedProgrammingAudit = planner.auditTrueOptionDetection({
    plan,
    suggestedPlan: completedProgrammingQuarterPlan,
    completedCourses: completedProgrammingCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((row) => row.requirement === "CSE 123 or CSE 143");

  addCheck(
    checks,
    "uw-computer-science:data-science-source-scope",
    "UW Computer Science Data Science uses the scoped degree sheet without broad Allen page contamination",
    Boolean(plan) &&
      Boolean(dataScienceBlock) &&
      dataScienceBlock?.sourceRole === "pathway-degree-sheet" &&
      (dataScienceBlock?.canCreateRequiredRows ?? true) !== false &&
      (dataScienceBlock?.supportOnly ?? false) === false &&
      (dataScienceBlock?.parsedRequirementGroups ?? []).some(
        (group) => group.label === "CSE 123 or CSE 143"
      ) &&
      forbiddenParsedCodes.every(
        (courseCode) => !(dataScienceBlock?.parsedUwCourseCodes ?? []).includes(courseCode)
      ) &&
      ["CS 121", "CS 122", "CS 123", "MATH 240"].every((courseCode) =>
        labels.includes(courseCode)
      ) &&
      pollutedLabels.every((courseCode) => !labels.includes(courseCode)) &&
      !labels.some((label) => /CSE 4\d{2}|upper-division|Prerequisites:/i.test(label)) &&
      programmingAudit?.detectedAsTrueOption === true &&
      programmingAudit?.satisfiedBy === "planner-defaulted" &&
      sourceScopeRowsByCourse.get("CSE 123")?.emittedAs === "option-group" &&
      sourceScopeRowsByCourse.get("CSE 123")?.scheduled === true &&
      sourceScopeRowsByCourse.get("CSE 143")?.emittedAs === "option-group" &&
      sourceScopeRowsByCourse.get("CSE 143")?.scheduled === false &&
      sourceScopeRowsByCourse.get("MATH 208")?.scheduled === true &&
      sourceScopeRows.every((row) => row.issue === "none") &&
      forbiddenCoverageCodes.every(
        (courseCode) => !requiredCoverageAudit.some((row) => row.uwCourse === courseCode)
      ) &&
      completedProgrammingAudit?.satisfiedBy === "transcript-completed" &&
      !completedProgrammingLabels.includes("CS 123") &&
      !completedProgrammingLabels.includes("CS 145"),
    [
      `[copy-only source scope audit] Major: Computer Science Pathway: Data Science option Source URL: ${
        dataScienceBlock?.sourceUrl ?? "missing"
      } Section title: Data Science option degree sheet Detected section role: ${
        dataScienceBlock?.sourceRole ?? "missing"
      } Course codes extracted: ${(dataScienceBlock?.parsedUwCourseCodes ?? []).join(
        ", "
      )} Allowed to create scheduled rows: yes Rows created: ${labels.join(", ")} Issue: none`,
      sourceScopeRows
        .filter((row) => ["CSE 123", "CSE 143", "MATH 208"].includes(row.courseCode))
        .map((row) => row.copyOnlyDebugText)
        .join("\n"),
      requiredCoverageAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      programmingAudit?.copyOnlyDebugText ?? "missing programming true-option audit row",
      completedProgrammingAudit?.copyOnlyDebugText ??
        "missing completed-programming true-option audit row",
      `Completed-programming labels: ${completedProgrammingLabels.join(", ")}`,
    ],
    "source-scope-contamination",
    "uw-seattle-computer-science:pathway:data-science-option"
  );

  addCheck(
    checks,
    "uw-computer-science:approved-science-support-source",
    "UW Computer Science keeps the Allen School CS-approved Natural Science list as a support source",
    csApprovedManifestSources.some(
      (entry) =>
        /degree-requirements\/courses\/#natural-science/i.test(entry.url ?? "") &&
        getSourceRoleStatus(entry.role) === "support"
    ),
    csApprovedManifestSources.map(
      (entry) =>
        `[source-role coverage report] Owner id: uw-seattle-computer-science:pathway:data-science-option Primary source: ${
          getPrimarySourceUrl("uw-seattle-computer-science", "data-science-option") ?? "none"
        } Support sources: ${entry.url} Approved-course-list sources: ${
          entry.url
        } Elective-list sources: none Non-schedulable sources: none Source-scope issues: none`
    ),
    "missing-approved-course-list-source",
    "uw-seattle-computer-science:pathway:data-science-option"
  );
}

function auditChemicalEngineering(checks) {
  const plan = resolveRuntimePlan("uw-seattle-chemical-engineering", "nme-option");
  const quarterPlan = buildQuarterPlan(plan, { includeStemPrepCourses: false });
  const labels = getVisiblePlannedLabels(quarterPlan);
  const falseEngineeringRows = [
    "ENGR& 214",
    "ENGR& 225",
    "ENGR& 204",
    "ENGR& 114",
    "ENGR& 215",
    "ENGR 140",
    "CS 145",
    "ENGR 100",
    "ENGR 106",
  ];
  const requiredCoreRows = [
    "ENGL& 101",
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "MATH& 264",
    "MATH 238",
    "MATH 240",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "CHEM& 261",
    "CHEM& 262",
    "CHEM& 263",
    "PHYS& 221",
    "PHYS& 222",
    "PHYS& 223",
  ];
  const sourceScopeAudit = planner.auditSourceScope({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const requiredCoverageAudit = planner.auditRequiredMappedCourseCoverage({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const falseCoverageRows = requiredCoverageAudit.filter((row) =>
    ["AA 210", "CEE 220", "EE 215", "ME 123", "ME 230", "MSE 170", "CSE 143"].includes(
      row.uwCourse
    )
  );
  const creditRange = planner.buildSuggestedQuarterRemainingCreditRange({
    quarters: quarterPlan,
    track: null,
  });
  const electiveListScopeRows = sourceScopeAudit.filter(
    (row) => row.detectedRole === "elective-list"
  );

  addCheck(
    checks,
    "uw-cheme-nme:false-engineering-elective-required-promotion",
    "UW Chemical Engineering NME does not promote engineering elective rows as required transfer courses",
    falseEngineeringRows.every((courseCode) => !labels.includes(courseCode)) &&
      requiredCoreRows.every((courseCode) => labels.includes(courseCode)) &&
      sourceScopeAudit.length >= 7 &&
      sourceScopeAudit.every(
        (row) =>
          row.detectedRole === "elective-list" &&
          row.promotedToRequired === false &&
          row.allowedToSchedule === false &&
          row.issue === null
      ) &&
      falseCoverageRows.length === 0 &&
      requiredCoverageAudit.every((row) => row.issue === null) &&
      creditRange.exactRemainingCredits === 86,
    [
      `Labels: ${labels.join(", ")}`,
      sourceScopeAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      requiredCoverageAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      `Credit range: ${JSON.stringify(creditRange)}`,
    ].join("\n"),
    "false-required-promotion"
  );

  addCheck(
    checks,
    "uw-cheme-nme:elective-list-source-role",
    "UW Chemical Engineering NME keeps engineering elective lists scoped as support-only elective-list sources",
    electiveListScopeRows.length >= 7 &&
      electiveListScopeRows.every(
        (row) =>
          row.promotedToRequired === false &&
          row.allowedToSchedule === false &&
          row.issue === null
      ),
    electiveListScopeRows.map((row) => row.copyOnlyDebugText),
    "missing-elective-list-source"
  );
}

function auditBioengineering(checks) {
  const plan = resolveRuntimePlan("uw-seattle-bioengineering", null);
  const quarterPlan = buildQuarterPlan(plan);
  const labels = getVisiblePlannedLabels(quarterPlan);
  const expectedCourses = [
    "ENGL& 101",
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "MATH 238",
    "MATH 240",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "CHEM& 261",
    "PHYS& 221",
    "PHYS& 222",
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
    "ENGR 250",
  ];
  const sourceBackedAudit = planner.auditUwBioengineeringSourceBackedRequirements({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const byRequirement = new Map(sourceBackedAudit.map((entry) => [entry.uwRequirement, entry]));
  const statAudit = byRequirement.get("STAT 311, STAT 390, IND E 315, or Q SCI 381");
  const matchSummary = parseMatchedTrackSummary(plan?.recommendedTrackSummary ?? "");

  assertVisibleCourses(
    checks,
    "uw-bioengineering",
    "UW Bioengineering mapped math/chem/physics/bio/organic/English/programming rows are visible",
    labels,
    expectedCourses
  );
  addCheck(
    checks,
    "uw-bioengineering:statistics-hidden",
    "UW Bioengineering statistics stays hidden/internal when unmapped",
    statAudit?.visibleInQuarterPlan === false &&
      /No source-backed Green River equivalent/i.test(statAudit?.hiddenReason ?? ""),
    JSON.stringify(statAudit ?? null),
    "unmapped-uw-only"
  );
  addCheck(
    checks,
    "uw-bioengineering:gen-ed-source-backed",
    "UW Bioengineering Gen-Ed targets come from the official BioE source-backed section",
    JSON.stringify(planner.buildSourceBackedGeneralEducationRequirementTargets(plan)) ===
      JSON.stringify({
        ahCredits: 10,
        sscCredits: 10,
        nscCredits: null,
        breadthCredits: 4,
        electiveCredits: 8,
      }),
    JSON.stringify(planner.buildSourceBackedGeneralEducationRequirementTargets(plan)),
    "gen-ed-scope-leak"
  );
  addCheck(
    checks,
    "uw-bioengineering:match-count-fresh",
    "UW Bioengineering matched-track summary is no longer the stale 3 of 4 AA-DTA copy",
    plan?.bestTrackId === TRACK_IDS.ast2BioChemical &&
      matchSummary?.trackCode === "AST-2" &&
      matchSummary?.matchCount === 14 &&
      matchSummary?.totalTracked === 18 &&
      !/\bAA-DTA\b|3 of the 4/i.test(plan?.recommendedTrackSummary ?? ""),
    plan?.recommendedTrackSummary ?? "",
    "stale-match-count"
  );
}

function auditMajorGenEdScope(checks) {
  const mechanical = resolveRuntimePlan("uw-seattle-mechanical-engineering", null);
  const mechanicalSection = planner.buildSourceBackedMajorGeneralEducationRequirementSection(mechanical);
  const mechanicalTrack = source.getTransferPlannerTrack(mechanical?.bestTrackId ?? null);
  const fullMechanicalPlan = planner.buildSuggestedQuarterPlan({
    plan: mechanical,
    applicationStatuses: planner.buildRequirementStatuses(mechanical?.applicationChecklist ?? [], []),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(mechanical?.beforeEnrollmentChecklist ?? [], []),
    stayAtGrcStatuses: planner.buildRequirementStatuses(mechanical?.stayAtGrcChecklist ?? [], []),
    completedCourses: [],
    track: mechanicalTrack,
    includeStayAtGrcCourses: true,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const transferOnlyMechanicalPlan = buildQuarterPlan(mechanical);
  const fullMatchedBreadthRows = getVisiblePlannedCourses(fullMechanicalPlan).filter(
    (course) => course.sourceKind === "official-grc-track-breadth"
  );
  const transferOnlyMatchedBreadthRows = getVisiblePlannedCourses(transferOnlyMechanicalPlan).filter(
    (course) => course.sourceKind === "official-grc-track-breadth"
  );
  const debugText = [
    "[copy-only gen-ed source debug]",
    "Planner mode: grc-to-uw",
    `UW source-backed targets: ${mechanicalSection?.items.length ?? 0}`,
    `Matched GRC track breadth rows hidden from UW gen-ed section: ${fullMatchedBreadthRows.length}`,
  ].join(" ");

  addCheck(
    checks,
    "uw-major-gen-ed:no-mechanical-source-backed-targets",
    "UW Mechanical Engineering does not invent UW major Gen-Ed targets from matched GRC breadth",
    !mechanicalSection && transferOnlyMatchedBreadthRows.length === 0,
    debugText,
    "gen-ed-scope-leak"
  );
}

function auditAccounting(checks) {
  const track = source.getTransferPlannerTrack(TRACK_IDS.accountingAaa);
  const rawGroups = planner.buildSuggestedQuarterCourseOptionGroupsForTrack({ track });
  const noSelectionQuarterPlan = buildGrcQuarterPlan(track);
  const noSelectionGroups = getVisiblePlannedCourses(noSelectionQuarterPlan).flatMap((course) =>
    course.optionGroup ? [course.optionGroup] : []
  );
  const cmstGroup = rawGroups.find((group) => group.title === "Select one");
  const electiveGroup = rawGroups.find((group) => group.title === "Elective - select 5 credits");
  const selectedCmstOption = cmstGroup?.options.find((option) => option.label === "CMST& 230");
  const selectedElectiveOption = electiveGroup?.options.find((option) => option.label === "ECON& 201");
  const selectedQuarterPlan = buildGrcQuarterPlan(track, {
    selectedRequirementOptionIdsByGroup:
      cmstGroup && electiveGroup && selectedCmstOption && selectedElectiveOption
        ? {
            [cmstGroup.id]: [selectedCmstOption.id],
            [electiveGroup.id]: [selectedElectiveOption.id],
          }
        : {},
  });
  const selectedGroups = getVisiblePlannedCourses(selectedQuarterPlan).flatMap((course) =>
    course.optionGroup ? [course.optionGroup] : []
  );
  const stableGroups = planner.buildSuggestedQuarterCourseOptionGroupsForTrack({
    track,
    selectedRequirementOptionIdsByGroup:
      cmstGroup && electiveGroup && selectedCmstOption && selectedElectiveOption
        ? {
            [cmstGroup.id]: [selectedCmstOption.id],
            [electiveGroup.id]: [selectedElectiveOption.id],
          }
        : {},
  });
  const noSelectionRange = planner.buildSuggestedQuarterRemainingCreditRange({
    quarters: noSelectionQuarterPlan,
    track,
    creditBucketMode: "combined",
  });
  const selectedRange = planner.buildSuggestedQuarterRemainingCreditRange({
    quarters: selectedQuarterPlan,
    track,
    creditBucketMode: "combined",
  });
  const debugText = [
    "[copy-only option group visibility]",
    `Raw group count: ${rawGroups.length}`,
    `Displayed group count: ${noSelectionGroups.length}`,
  ].join(" ");

  addCheck(
    checks,
    "grc-accounting-aaa:two-option-groups",
    "GRC Accounting AAA keeps both source-backed option groups",
    rawGroups.length === 2 &&
      noSelectionGroups.length === 2 &&
      rawGroups.map((group) => group.title).join("|") === "Select one|Elective - select 5 credits",
    debugText,
    "option-group-disappears-after-refresh"
  );
  addCheck(
    checks,
    "grc-accounting-aaa:selected-options-refresh-safe",
    "GRC Accounting AAA selected option groups persist and remain editable after refresh",
    stableGroups.length === 2 &&
      selectedGroups.filter((group) => group.selectedOptionIds.length > 0).length === 2,
    JSON.stringify(stableGroups.map((group) => ({ title: group.title, selected: group.selectedOptionIds }))),
    "option-group-disappears-after-refresh"
  );
  addCheck(
    checks,
    "grc-accounting-aaa:selected-total-90",
    "GRC Accounting AAA totals 90 credits after both options are selected",
    selectedRange.exactRemainingCredits === 90,
    JSON.stringify(selectedRange),
    "option-group-disappears-after-refresh"
  );
  addCheck(
    checks,
    "grc-accounting-aaa:fresh-range-80-90",
    "GRC Accounting AAA fresh/no-selection range exposes unresolved option flexibility",
    noSelectionRange.minRemainingCredits === 80 && noSelectionRange.maxRemainingCredits === 90,
    JSON.stringify(noSelectionRange),
    "option-group-disappears-after-refresh"
  );
}

function auditAst2ComputerElectrical(checks) {
  const track = source.getTransferPlannerTrack(TRACK_IDS.ast2ComputerElectrical);
  const quarterPlan = buildGrcQuarterPlan(track, { includeStemPrepCourses: false });
  const courses = getVisiblePlannedCourses(quarterPlan);
  const labels = courses.map((course) => course.label);
  const range = planner.buildSuggestedQuarterRemainingCreditRange({
    quarters: quarterPlan,
    track,
    creditBucketMode: "combined",
  });
  const programmingGroup = track?.groupedChoices?.find((choice) =>
    /computer programming/i.test(choice.label)
  );
  const electiveGroup = track?.groupedChoices?.find((choice) =>
    /math, science.*engr elective/i.test(choice.label)
  );
  const breadthRows = courses.filter((course) => course.sourceKind === "official-grc-track-breadth");

  addCheck(
    checks,
    "grc-ast2-computer-electrical:total-98-no-prep",
    "AST-2/MRP Computer and Electrical totals 98 credits with STEM prep off",
    range.minRemainingCredits === 98 && range.catalogMinimumCredits === 98,
    JSON.stringify(range),
    "prep-credit-counted-as-main"
  );
  addCheck(
    checks,
    "grc-ast2-computer-electrical:programming-grouped",
    "AST-2/MRP Computer and Electrical programming choices remain grouped",
    JSON.stringify(programmingGroup?.options.map((option) => option.label)) ===
      JSON.stringify(["Group 1: CS 122 + CS 123", "Group 2: CS& 131 + CS 132"]),
    JSON.stringify(programmingGroup ?? null),
    "option-group-disappears-after-refresh"
  );
  addCheck(
    checks,
    "grc-ast2-computer-electrical:no-bad-merged-label",
    "AST-2/MRP Computer and Electrical suppresses bad merged CS/distribution labels",
    !labels.some((label) => /CS\s*123\s*-\s*or\s*2\s*C/i.test(label)),
    labels.filter((label) => /CS\s*123|2\s*C/i.test(label)),
    "over-scheduled-alternatives"
  );
  addCheck(
    checks,
    "grc-ast2-computer-electrical:breadth-15",
    "AST-2/MRP Computer and Electrical breadth is 15 credits total",
    JSON.stringify(breadthRows.map((course) => [course.label, course.creditAmount])) ===
      JSON.stringify([
        ["5 credits of A&H or SSc", 5],
        ["5 credits of Humanities", 5],
        ["5 credits of Social Science", 5],
      ]),
    JSON.stringify(breadthRows.map((course) => ({ label: course.label, credits: course.creditAmount }))),
    "over-scheduled-alternatives"
  );
  addCheck(
    checks,
    "grc-ast2-computer-electrical:choose-two-elective",
    "AST-2/MRP Computer and Electrical Math/Science/Engineering elective remains choose-2",
    electiveGroup?.selectionCount === 2 &&
      planner
        .buildSuggestedQuarterCourseOptionGroupsForTrack({ track })
        .some((group) => group.id === electiveGroup.id && group.selectionCount === 2),
    JSON.stringify(electiveGroup ?? null),
    "option-group-disappears-after-refresh"
  );
}

function auditAst2CivilMechanical(checks) {
  const track = source.getTransferPlannerTrack(TRACK_IDS.ast2CivilMechanical);
  const quarterPlan = buildGrcQuarterPlan(track, { includeStemPrepCourses: false });
  const labels = getVisiblePlannedLabels(quarterPlan);
  const range = planner.buildSuggestedQuarterRemainingCreditRange({
    quarters: quarterPlan,
    track,
    creditBucketMode: "combined",
  });
  const sectionDGroup = track?.groupedChoices?.find((choice) =>
    /select 2 courses/i.test(choice.label)
  );

  addCheck(
    checks,
    "grc-ast2-civil-mechanical:official-total-107",
    "AST-2/MRP Civil and Mechanical keeps source-backed 107-credit generated total",
    track?.minimumCredits === 107 && range.minRemainingCredits === 107,
    JSON.stringify({ trackMinimumCredits: track?.minimumCredits, range }),
    "prep-credit-counted-as-main"
  );
  addCheck(
    checks,
    "grc-ast2-civil-mechanical:choose-two-refresh-safe",
    "AST-2/MRP Civil and Mechanical choose-2 group remains editable and refresh-safe",
    sectionDGroup?.selectionCount === 2 &&
      planner
        .buildSuggestedQuarterCourseOptionGroupsForTrack({ track })
        .some((group) => group.id === sectionDGroup.id && group.selectionCount === 2),
    JSON.stringify(sectionDGroup ?? null),
    "option-group-disappears-after-refresh"
  );
  assertOrder(checks, "grc-ast2-civil-mechanical:engr106-before-engr214", "ENGR 106 before ENGR& 214", labels, "ENGR 106", "ENGR& 214");
  assertOrder(checks, "grc-ast2-civil-mechanical:engr214-before-engr215", "ENGR& 214 before ENGR& 215", labels, "ENGR& 214", "ENGR& 215");
  assertOrder(checks, "grc-ast2-civil-mechanical:engr214-before-engr225", "ENGR& 214 before ENGR& 225", labels, "ENGR& 214", "ENGR& 225");
  assertOrder(checks, "grc-ast2-civil-mechanical:math264-before-math238", "MATH& 264 before MATH 238", labels, "MATH& 264", "MATH 238");
}

function auditPrepCreditSeparation(checks) {
  const plan = resolveRuntimePlan("uw-seattle-materials-science-engineering", "nme-option");
  const defaultPlan = planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(plan?.applicationChecklist ?? [], []),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(plan?.beforeEnrollmentChecklist ?? [], []),
    stayAtGrcStatuses: planner.buildRequirementStatuses(plan?.stayAtGrcChecklist ?? [], []),
    completedCourses: [],
    track: source.getTransferPlannerTrack(plan?.bestTrackId ?? null),
    includeStayAtGrcCourses: true,
    includeStemPrepCourses: true,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const noPrepPlan = planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(plan?.applicationChecklist ?? [], []),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(plan?.beforeEnrollmentChecklist ?? [], []),
    stayAtGrcStatuses: planner.buildRequirementStatuses(plan?.stayAtGrcChecklist ?? [], []),
    completedCourses: [],
    track: source.getTransferPlannerTrack(plan?.bestTrackId ?? null),
    includeStayAtGrcCourses: true,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const defaultCourses = getVisiblePlannedCourses(defaultPlan);
  const noPrepLabels = new Set(getVisiblePlannedLabels(noPrepPlan));
  const prepCourses = ["MATH& 141", "MATH& 142", "CHEM& 140", "PHYS& 114"];
  const range = planner.buildSuggestedQuarterRemainingCreditRange({
    quarters: defaultPlan,
    track: source.getTransferPlannerTrack(plan?.bestTrackId ?? null),
    creditBucketMode: "uw-transfer",
  });
  const debugText = [
    "[copy-only credit buckets]",
    `Main degree min: ${range.mainMinRemainingCredits}`,
    `Main degree max: ${range.mainMaxRemainingCredits}`,
    `Prep credits: ${range.stemPrepCredits}`,
    `Local prerequisite credits: ${range.localPrerequisiteCredits}`,
    "Selected option credits: n/a",
    `Unresolved option min/max: ${range.hasUnresolvedOptions ? `${range.minRemainingCredits}/${range.maxRemainingCredits}` : "none"}`,
    `Official source total: ${range.catalogMinimumCredits ?? "n/a"}`,
  ].join(" ");

  addCheck(
    checks,
    "prep-credit-separation:toggle-and-guidance",
    "Prep courses toggle separately and carry test-out guidance",
    prepCourses.every((courseCode) =>
      defaultCourses.some(
        (course) =>
          course.label === courseCode &&
          course.courseRole === "optional_stem_prep" &&
          course.canTestOut === true &&
          /Can be tested out of if not needed\. Check with advisor for details\./.test(
            course.guidanceSummary ?? ""
          )
      )
    ) && prepCourses.every((courseCode) => !noPrepLabels.has(courseCode)),
    debugText,
    "prep-credit-counted-as-main"
  );
}

function auditMatchedTrackSummary(checks) {
  for (const [planId, pathwayId] of [
    ["uw-seattle-bioengineering", null],
    ["uw-seattle-mechanical-engineering", null],
    ["uw-seattle-materials-science-engineering", "nme-option"],
  ]) {
    const plan = resolveRuntimePlan(planId, pathwayId);
    const track = source.getTransferPlannerTrack(plan?.bestTrackId ?? null);
    const summary = parseMatchedTrackSummary(plan?.recommendedTrackSummary ?? "");
    const trackedRequirements = uniqueSorted(
      source.getTransferPlannerGrcCourseList(plan).flatMap((label) => extractCourseCodes(label))
    );
    const debugText = [
      "[copy-only matched track debug]",
      `Header track id: ${track?.id ?? ""}`,
      `Explanation track id: ${plan?.bestTrackId ?? ""}`,
      `Match count: ${summary?.matchCount ?? ""}`,
      `Total tracked GRC-completable requirements: ${summary?.totalTracked ?? trackedRequirements.length}`,
    ].join(" ");

    addCheck(
      checks,
      `matched-track-summary:${planId}${pathwayId ? `:${pathwayId}` : ""}`,
      `${plan?.title ?? planId} matched-track header/explanation stay consistent`,
      Boolean(track && plan?.bestTrackId === track.id && summary?.trackCode === track.code),
      debugText,
      "stale-match-count"
    );
  }
}

function parseMatchedTrackSummary(summary) {
  const match = String(summary ?? "").match(
    /^\s*([A-Z0-9&/-]+)\s+is\b.*?\bmatches\s+(\d+)\s+of\s+the\s+(\d+)\b/i
  );
  if (!match) {
    return null;
  }
  return {
    trackCode: match[1],
    matchCount: Number(match[2]),
    totalTracked: Number(match[3]),
  };
}

function auditMseNme(checks) {
  const plan = resolveRuntimePlan("uw-seattle-materials-science-engineering", "nme-option");
  const quarterPlan = buildQuarterPlan(plan, { includeStayAtGrcCourses: true });
  const transferOnlyQuarterPlan = buildQuarterPlan(plan, { includeStayAtGrcCourses: false });
  const labels = getVisiblePlannedLabels(quarterPlan);
  const transferOnlyLabels = getVisiblePlannedLabels(transferOnlyQuarterPlan);
  const optionGroups = getVisiblePlannedCourses(quarterPlan).flatMap((course) =>
    course.optionGroup ? [course.optionGroup] : []
  );
  const requiredCoverageAudit = planner.auditRequiredMappedCourseCoverage({
    plan,
    suggestedPlan: transferOnlyQuarterPlan,
    completedCourses: [],
  });
  const chem152Coverage = requiredCoverageAudit.find((row) => row.uwCourse === "CHEM 152");
  const optionSatisfactionAudit = planner.auditOptionGroupSatisfaction({
    plan,
    suggestedPlan: transferOnlyQuarterPlan,
    completedCourses: [],
  });
  const mathElectiveAudit = optionSatisfactionAudit.find((row) =>
    /Math Elective/i.test(row.requirement)
  );
  const countedMath264 = planner.auditCountedCourses({ suggestedPlan: transferOnlyQuarterPlan }).find(
    (row) => row.course === "MATH& 264"
  );

  addCheck(
    checks,
    "uw-mse-nme:source-backed-key-rows",
    "UW MSE/NME keeps source-backed lower-division transfer rows visible",
    ["MATH& 151", "MATH& 152", "MATH& 163", "CHEM& 161", "CHEM& 162", "PHYS& 221", "PHYS& 222", "PHYS& 223", "ENGR 140"].every((courseCode) =>
      labels.includes(courseCode)
    ),
    labels.join(", "),
    "missing-detected-course"
  );
  addCheck(
    checks,
    "uw-mse-nme:option-groups",
    "UW MSE/NME option groups keep source-backed cardinality",
    optionGroups.some((group) => /Scientific computing/i.test(group.title) && group.selectionCount === 1) &&
      optionGroups.some((group) => /Science Electives/i.test(group.title) && group.selectionCount === 2) &&
      optionGroups.some((group) => /Engineering Fundamentals Electives/i.test(group.title) && group.requiredCredits === 8),
    JSON.stringify(optionGroups.map((group) => ({ title: group.title, selectionCount: group.selectionCount, requiredCredits: group.requiredCredits }))),
    "option-group-disappears-after-refresh"
  );
  addCheck(
    checks,
    "uw-mse-nme:required-chem152-coverage",
    "UW MSE/NME transfer-only plan covers required CHEM 152 with the mapped GRC chemistry continuation path",
    Boolean(chem152Coverage) &&
      JSON.stringify(chem152Coverage.mappedGrcEquivalentPath) ===
        JSON.stringify(["CHEM& 162", "CHEM& 163"]) &&
      chem152Coverage.visibleInPlan === true &&
      chem152Coverage.issue === null &&
      transferOnlyLabels.includes("CHEM& 162") &&
      transferOnlyLabels.includes("CHEM& 163"),
    chem152Coverage?.copyOnlyDebugText ?? `Transfer-only labels: ${transferOnlyLabels.join(", ")}`,
    "missing-detected-course"
  );
  addCheck(
    checks,
    "uw-mse-nme:math264-option-progress",
    "UW MSE/NME scheduled MATH& 264 resolves the Math Elective group to 1/1",
    mathElectiveAudit?.displayedProgress === "1/1" &&
      mathElectiveAudit?.scheduledSatisfyingCourses?.includes("MATH& 264") &&
      mathElectiveAudit?.countedSatisfyingCourses?.includes("MATH& 264") &&
      mathElectiveAudit?.issue === null,
    mathElectiveAudit?.copyOnlyDebugText ?? `Transfer-only labels: ${transferOnlyLabels.join(", ")}`,
    "option-group-disappears-after-refresh"
  );
  addCheck(
    checks,
    "uw-mse-nme:math264-counted-once",
    "UW MSE/NME counts MATH& 264 once while allowing prerequisite and option roles",
    countedMath264?.countedOnce === true &&
      countedMath264?.requirementRoles?.includes("prerequisite") &&
      countedMath264?.requirementRoles?.includes("option-satisfaction") &&
      /credit is counted once/i.test(countedMath264?.duplicateCountReason ?? ""),
    countedMath264?.copyOnlyDebugText ?? `Transfer-only labels: ${transferOnlyLabels.join(", ")}`,
    "prep-credit-counted-as-main"
  );
  const unselectedOptionPrerequisiteLeaks = planner
    .auditUnselectedOptionPrerequisiteScheduling({
      plan,
      suggestedPlan: transferOnlyQuarterPlan,
      completedCourses: [],
      selectedRequirementOptionIdsByGroup: {},
    })
    .filter((row) => !row.optionSelected && row.prerequisiteScheduled && !row.shouldSchedule);
  addCheck(
    checks,
    "uw-mse-nme:unselected-option-prerequisites",
    "UW MSE/NME does not schedule prerequisites for unselected option courses",
    unselectedOptionPrerequisiteLeaks.length === 0,
    unselectedOptionPrerequisiteLeaks.map((row) => row.copyOnlyDebugText).join("\n") || "No leaked unselected option prerequisites.",
    "over-scheduled-alternatives"
  );
}

function auditSbseOptionSatisfaction(checks) {
  const runtimePlan = source.getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-sustainable-bioresource-systems-engineering"
  );
  const baseGroup = runtimePlan?.requirementGroups?.find((group) =>
    group.id.endsWith(":computation-data-science-elective")
  );
  const plan = source.resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, "business-option");
  const completedCourses = [
    { code: "CS 121", label: "CS 121", credits: 5 },
    { code: "CS 122", label: "CS 122", credits: 5 },
    { code: "CHEM& 161", label: "CHEM& 161", credits: 5 },
    { code: "CHEM& 162", label: "CHEM& 162", credits: 5 },
    { code: "CHEM& 163", label: "CHEM& 163", credits: 5 },
    { code: "MATH& 151", label: "MATH& 151", credits: 5 },
    { code: "MATH& 152", label: "MATH& 152", credits: 5 },
    { code: "MATH& 163", label: "MATH& 163", credits: 5 },
    { code: "ENGL& 101", label: "ENGL& 101", credits: 5 },
  ];
  const noTranscriptStatuses = {
    applicationStatuses: planner.buildRequirementStatuses(plan?.applicationChecklist ?? [], []),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(plan?.beforeEnrollmentChecklist ?? [], []),
    stayAtGrcStatuses: planner.buildRequirementStatuses(plan?.stayAtGrcChecklist ?? [], []),
  };
  const noTranscriptQuarterPlan = planner.buildSuggestedQuarterPlan({
    plan,
    ...noTranscriptStatuses,
    completedCourses: [],
    track: source.getTransferPlannerTrack(plan?.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup: {},
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const noTranscriptCourses = getVisiblePlannedCourses(noTranscriptQuarterPlan);
  const noTranscriptLabels = noTranscriptCourses.map((course) => course.label);
  const noTranscriptOptionGroups = noTranscriptCourses.flatMap((course) =>
    course.optionGroup ? [course.optionGroup] : []
  );
  const noTranscriptBusinessOptionGroup = noTranscriptOptionGroups.find((group) =>
    /Business, Policy, and Economics/i.test(group.title)
  );
  const noTranscriptCreditRange = planner.buildSuggestedQuarterRemainingCreditRange({
    quarters: noTranscriptQuarterPlan,
    track: source.getTransferPlannerTrack(plan?.bestTrackId ?? null),
    creditBucketMode: "uw-transfer",
  });
  const noTranscriptInvalidOptionAudit = planner.auditInvalidScheduledOptions({
    plan,
    suggestedPlan: noTranscriptQuarterPlan,
  });
  const noTranscriptCurrentVsOldAudit = planner.auditSbseCurrentVsOldSource({
    plan,
    suggestedPlan: noTranscriptQuarterPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  });
  const noTranscriptCreditAudit = planner.auditSbseCreditTotals({
    plan,
    suggestedPlan: noTranscriptQuarterPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
    track: source.getTransferPlannerTrack(plan?.bestTrackId ?? null),
  });
  const classificationAudit = planner.auditRequirementClassification({
    plan,
    suggestedPlan: noTranscriptQuarterPlan,
    completedCourses: [],
  });
  const classificationByRequirement = new Map(
    classificationAudit.map((row) => [row.requirement, row])
  );
  const statuses = {
    applicationStatuses: planner.buildRequirementStatuses(plan?.applicationChecklist ?? [], completedCourses),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(
      plan?.beforeEnrollmentChecklist ?? [],
      completedCourses
    ),
    stayAtGrcStatuses: planner.buildRequirementStatuses(plan?.stayAtGrcChecklist ?? [], completedCourses),
  };
  const quarterPlan = planner.buildSuggestedQuarterPlan({
    plan,
    ...statuses,
    completedCourses,
    track: source.getTransferPlannerTrack(plan?.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup: {},
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const plannedLabels = getVisiblePlannedLabels(quarterPlan);
  const transcriptCreditRange = planner.buildSuggestedQuarterRemainingCreditRange({
    quarters: quarterPlan,
    track: source.getTransferPlannerTrack(plan?.bestTrackId ?? null),
    creditBucketMode: "uw-transfer",
  });
  const computationGroup = plan?.requirementGroups?.find((group) =>
    group.id.endsWith(":computation-data-science-elective")
  );
  const businessGroup = plan?.requirementGroups?.find((group) =>
    group.id.endsWith(":business-policy-economics-elective")
  );
  const acceptedUwCodes = new Set(
    (computationGroup?.options ?? [])
      .flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
      ])
      .map(normalizeCourseCode)
  );
  const acceptedBusinessUwCodes = new Set(
    (businessGroup?.options ?? [])
      .flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
      ])
      .map(normalizeCourseCode)
  );
  const optionAudit = planner.auditOptionGroupSatisfaction({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses,
  });
  const invalidOptionAudit = planner.auditInvalidScheduledOptions({
    plan,
    suggestedPlan: quarterPlan,
  });
  const currentVsOldAudit = planner.auditSbseCurrentVsOldSource({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  });
  const creditAudit = planner.auditSbseCreditTotals({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
    track: source.getTransferPlannerTrack(plan?.bestTrackId ?? null),
  });
  const auditRow = optionAudit.find((row) => row.groupId === computationGroup?.id);

  addCheck(
    checks,
    "uw-sbse-business:no-transcript-classification",
    "UW SBSE Business no-transcript plan exposes only true elective option groups and schedules sequences normally",
    noTranscriptOptionGroups.length === 2 &&
      JSON.stringify(noTranscriptOptionGroups.map((group) => group.title)) ===
        JSON.stringify([
          "Computation and Data Science elective: choose one approved course",
          "Business, Policy, and Economics elective: choose one approved course",
        ]) &&
      [
        "MATH& 151",
        "MATH& 152",
        "MATH& 163",
        "CHEM& 161",
        "CHEM& 162",
        "CHEM& 163",
        "PHYS& 221",
        "ENGL& 101",
      ].every((courseCode) => noTranscriptLabels.includes(courseCode)) &&
      !noTranscriptLabels.includes("ACCT& 203") &&
      !(plan?.grcCourseList ?? []).some((courseCode) => /^ACCT\b|^ACCT&\b/i.test(courseCode)) &&
      JSON.stringify((noTranscriptBusinessOptionGroup?.options ?? []).map((option) => option.courseCodes)) ===
        JSON.stringify([["ECON& 201"], ["ECON& 202"]]) &&
      !noTranscriptLabels.some((label) =>
        /this requirement|\+ %|AMATH 351 or MATH 125|AMATH 352 or MATH 126/i.test(label)
      ) &&
      noTranscriptCreditRange.maxRemainingCredits < 129 &&
      noTranscriptInvalidOptionAudit.every((row) => row.isAcceptedByCurrentSource) &&
      noTranscriptCurrentVsOldAudit.every((row) => row.transferOnlyShouldShow) &&
      noTranscriptCreditAudit[0]?.oldBseMatchedTrackFilteredCredits === 0 &&
      classificationByRequirement.get("MATH 124, MATH 125, and MATH 126 calculus sequence")?.classification ===
        "required-sequence" &&
      classificationByRequirement.get("CHEM 142, CHEM 152, and CHEM 162 chemistry sequence")?.classification ===
        "required-sequence" &&
      classificationByRequirement.get("Computation and Data Science elective: choose one approved course")?.classification ===
        "true-option" &&
      classificationByRequirement.get("Business, Policy, and Economics elective: choose one approved course")?.classification ===
        "true-option",
    [
      classificationAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      noTranscriptInvalidOptionAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      noTranscriptCurrentVsOldAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      noTranscriptCreditAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      `SBSE plan ACCT course-list entries: ${(plan?.grcCourseList ?? []).filter((courseCode) =>
        /^ACCT\b|^ACCT&\b/i.test(courseCode)
      ).join(", ")}`,
      `No-transcript option groups: ${noTranscriptOptionGroups.map((group) => group.title).join(", ")}`,
      `No-transcript business mapped options: ${JSON.stringify(
        (noTranscriptBusinessOptionGroup?.options ?? []).map((option) => option.courseCodes)
      )}`,
      `No-transcript credit range: ${JSON.stringify(noTranscriptCreditRange)}`,
    ].join("\n"),
    "over-scheduled-alternatives"
  );

  addCheck(
    checks,
    "uw-sbse-business:computation-option-satisfied-by-cs122",
    "UW SBSE Business computation/data science option accepts completed CS 122 without scheduling CS 123",
    Boolean(baseGroup) &&
      Boolean(computationGroup) &&
      !plan?.requirementGroups?.some((group) => group.id.endsWith(":cse-123-or-cse-143")) &&
      [
        "AMATH 301",
        "CSE 121",
        "CSE 122",
        "CSE 123",
        "CSE 142",
        "CSE 143",
        "CSE 160",
        "INFO 180",
        "CSE 180",
        "STAT 180",
        "Q SCI 256",
      ].every((courseCode) => acceptedUwCodes.has(normalizeCourseCode(courseCode))) &&
      Boolean(businessGroup) &&
      ["ECON 200", "ECON 201", "ESRM 235", "ECON 235", "ENVIR 235", "ESRM 320", "ESRM 321", "ESRM 400", "ESRM 423", "ESRM 465"].every(
        (courseCode) => acceptedBusinessUwCodes.has(normalizeCourseCode(courseCode))
      ) &&
      auditRow?.shouldScheduleExtra === false &&
      (auditRow?.satisfiedBy ?? []).includes("CS 122") &&
      (auditRow?.scheduledExtraCourses ?? []).length === 0 &&
      auditRow?.independentSchedulingReason === "none" &&
      !plannedLabels.includes("CS 123") &&
      !plannedLabels.includes("CS& 141") &&
      !plannedLabels.includes("ACCT& 203") &&
      transcriptCreditRange.maxRemainingCredits < 87 &&
      invalidOptionAudit.every((row) => row.isAcceptedByCurrentSource) &&
      currentVsOldAudit.every((row) => row.transferOnlyShouldShow) &&
      creditAudit[0]?.oldBseMatchedTrackFilteredCredits === 0 &&
      !["MATH& 151", "MATH& 152", "MATH& 163", "CHEM& 161", "CHEM& 162", "CHEM& 163", "ENGL& 101"].some(
        (courseCode) => plannedLabels.includes(courseCode)
      ),
    [
      auditRow?.copyOnlyDebugText ?? "Missing option satisfaction audit row.",
      invalidOptionAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      currentVsOldAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      creditAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      `Transcript credit range: ${JSON.stringify(transcriptCreditRange)}`,
      `Planned labels: ${plannedLabels.join(", ")}`,
    ].join(" "),
    "over-scheduled-alternatives"
  );
}

function auditEcePhotonics(checks) {
  const plan = resolveRuntimePlan("uw-seattle-electrical-computer-engineering", "photonics-pathway");
  const quarterPlan = buildQuarterPlan(plan);
  const labels = getVisiblePlannedLabels(quarterPlan);
  const indexOf = (label) => labels.indexOf(label);
  const optionAllocationAudit = planner.auditOptionAllocation({
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const transferProgrammingAllocation = optionAllocationAudit.find((row) =>
    /ece-transfer-programming-admission/.test(row.groupId)
  );
  const preenrollProgrammingAllocation = optionAllocationAudit.find((row) =>
    /ece-preenroll-programming/.test(row.groupId)
  );
  const transferProgrammingResolvedIds =
    transferProgrammingAllocation?.resolvedDisplayedOptionIdsAfterCap ?? [];
  const preenrollProgrammingResolvedIds =
    preenrollProgrammingAllocation?.resolvedDisplayedOptionIdsAfterCap ?? [];

  addCheck(
    checks,
    "uw-ece-photonics:programming-and-science",
    "UW ECE Photonics transfer-only plan schedules programming and math rows in order",
    ["CS 121", "CS 122", "CS 123", "MATH 238", "MATH 240"].every((courseCode) =>
      labels.includes(courseCode)
    ) &&
      indexOf("CS 121") < indexOf("CS 122") &&
      indexOf("CS 122") < indexOf("CS 123") &&
      !["CHEM& 131", "CHEM 220", "ENGL 126", "ENGL 128", "ENGR 140"].some((courseCode) =>
        labels.includes(courseCode)
      ),
    JSON.stringify({
      labels,
    }),
    "missing-detected-course"
  );

  addCheck(
    checks,
    "uw-ece-photonics:programming-option-allocation",
    "UW ECE Photonics overlapping programming options display only the allocated satisfying option",
    transferProgrammingResolvedIds.length === 1 &&
      transferProgrammingResolvedIds.some((optionId) => /cse-122$/.test(optionId)) &&
      !transferProgrammingResolvedIds.some((optionId) => /cse-123$/.test(optionId)) &&
      preenrollProgrammingResolvedIds.length === 1 &&
      preenrollProgrammingResolvedIds.some((optionId) => /cse-123$/.test(optionId)),
    optionAllocationAudit
      .filter((row) => /ece-(?:transfer|preenroll)-programming/.test(row.groupId))
      .map((row) => row.copyOnlyDebugText),
    "option-group-disappears-after-refresh"
  );
}

function auditEnvironmentalEngineering(checks) {
  const plan = resolveRuntimePlan("uw-seattle-environmental-engineering", null);
  const quarterPlan = buildQuarterPlan(plan);
  const labels = getVisiblePlannedLabels(quarterPlan);
  const trueOptionAudit = planner.auditTrueOptionDetection({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  });
  const programmingAudit = trueOptionAudit.find((row) =>
    /computer programming/i.test(row.requirement)
  );
  const matrixAudit = trueOptionAudit.find((row) =>
    /matrix|linear algebra/i.test(row.requirement)
  );
  const earthScienceAudit = trueOptionAudit.find((row) =>
    /earth science elective/i.test(row.requirement)
  );
  const requiredCoverageAudit = planner.auditRequiredMappedCourseCoverage({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const sourceScopeAudit = planner.auditSourceScope({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const cee347Coverage = requiredCoverageAudit.find((row) => row.uwCourse === "CEE 347");
  const rowBoundaryAudit = planner.auditSourceRowBoundaries({ plan });
  const mergedMatrixRows = rowBoundaryAudit.filter(
    (row) => /Matrix\/Linear Algebra/i.test(row.rawRowText) && row.issue === "merged-adjacent-rows"
  );
  const cee347Boundary = rowBoundaryAudit.find((row) =>
    row.parsedUwCourses.includes("CEE 347")
  );
  const earthScienceBoundary = rowBoundaryAudit.find((row) =>
    /earth science elective/i.test(row.parsedRequirementTitle)
  );
  const earthScienceAcceptedOptions = [
    "ATMS 101",
    "ATMS 211",
    "ATMS 212",
    "ESRM 100",
    "ESRM 101",
    "ESRM 210",
    "ESS 106",
    "ESS 201",
    "ESS 211",
    "ESS 212",
    "NUTR 200",
    "OCEAN 102",
    "OCEAN 200",
  ];
  const earthScienceMappedOptions = [
    "GEOL& 101",
    "NATRS 100",
    "NATRS 210",
    "NUTR& 101",
  ];

  addCheck(
    checks,
    "uw-enve:programming-option",
    "UW Environmental Engineering exposes Computer Programming as an unresolved true option",
    Boolean(programmingAudit) &&
      ["AMATH 301", "CSE 121", "CSE 122", "CSE 123", "CSE 142", "CSE 160"].every((courseCode) =>
        programmingAudit.acceptedUwOptions.includes(courseCode)
      ) &&
      ["ENGR 250", "CS 121", "CS 122", "CS 123", "CS& 141"].every((courseCode) =>
        programmingAudit.mappedGrcOptions.includes(courseCode)
      ) &&
      programmingAudit.visibleOptionGroup &&
      programmingAudit.satisfiedBy === "none" &&
      !["ENGR 250", "CS 121", "CS 122", "CS 123", "CS& 141"].some((courseCode) =>
        labels.includes(courseCode)
      ),
    [
      programmingAudit?.copyOnlyDebugText ?? "Missing programming true-option audit.",
      `Planned labels: ${labels.join(", ")}`,
    ],
    "missing-option-group"
  );

  addCheck(
    checks,
    "uw-enve:matrix-row-boundary",
    "UW Environmental Engineering Matrix/Linear Algebra no longer absorbs CEE 347",
    Boolean(matrixAudit) &&
      matrixAudit.acceptedUwOptions.includes("AMATH 352") &&
      matrixAudit.acceptedUwOptions.includes("MATH 208") &&
      !matrixAudit.acceptedUwOptions.includes("CEE 347") &&
      matrixAudit.mappedGrcOptions.includes("MATH 240") &&
      mergedMatrixRows.length === 0,
    [
      matrixAudit?.copyOnlyDebugText ?? "Missing matrix true-option audit.",
      ...mergedMatrixRows.map((row) => row.copyOnlyDebugText),
    ],
    "over-scheduled-alternatives"
  );

  addCheck(
    checks,
    "uw-enve:earth-science-elective-option",
    "UW Environmental Engineering Earth science elective is one unresolved choose-one option group",
    Boolean(earthScienceAudit) &&
      earthScienceAcceptedOptions.every((courseCode) =>
        earthScienceAudit.acceptedUwOptions.includes(courseCode)
      ) &&
      earthScienceMappedOptions.every((courseCode) =>
        earthScienceAudit.mappedGrcOptions.includes(courseCode)
      ) &&
      earthScienceAudit.requiredCount === 1 &&
      earthScienceAudit.visibleOptionGroup === true &&
      earthScienceAudit.satisfiedBy === "none" &&
      earthScienceAudit.issue === null &&
      earthScienceMappedOptions.every((courseCode) => !labels.includes(courseCode)) &&
      Boolean(earthScienceBoundary) &&
      earthScienceBoundary.issue === null &&
      sourceScopeAudit.filter((row) =>
        ["ESS 212", "ESRM 101", "ESRM 210", "NUTR 200"].includes(row.uwCourse)
      ).length === 4 &&
      sourceScopeAudit
        .filter((row) => ["ESS 212", "ESRM 101", "ESRM 210", "NUTR 200"].includes(row.uwCourse))
        .every(
          (row) =>
            row.detectedRole === "option-list" &&
            row.promotedToRequired === false &&
            row.allowedToSchedule === false &&
            row.issue === null
        ),
    [
      earthScienceAudit?.copyOnlyDebugText ?? "Missing Earth science true-option audit.",
      earthScienceBoundary?.copyOnlyDebugText ?? "Missing Earth science row-boundary audit.",
      sourceScopeAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      `Planned labels: ${labels.join(", ")}`,
    ].join("\n"),
    "false-required-promotion"
  );

  addCheck(
    checks,
    "uw-enve:cee-347-hidden-unmapped",
    "UW Environmental Engineering keeps CEE 347 as a hidden unmapped core row",
    Boolean(cee347Coverage) &&
      cee347Coverage.requirementType === "hidden-unmapped" &&
      cee347Coverage.visibleInPlan === false &&
      cee347Coverage.issue === null &&
      Boolean(cee347Boundary) &&
      cee347Boundary?.issue === null,
    [
      cee347Coverage?.copyOnlyDebugText ?? "Missing CEE 347 required coverage audit.",
      cee347Boundary?.copyOnlyDebugText ?? "Missing CEE 347 row-boundary audit.",
    ],
    "missing-detected-course"
  );
}

function auditAeronauticsCategoryOptions(checks) {
  const plan = resolveRuntimePlan("uw-seattle-aeronautics-astronautics", null);
  const quarterPlan = buildQuarterPlan(plan);
  const scienceRequirementGroup = plan?.requirementGroups?.find((group) =>
    (group.options ?? []).some((option) => option.categoryOption?.category === "NSC")
  );
  const categoryOption = scienceRequirementGroup?.options?.find(
    (option) => option.categoryOption?.category === "NSC"
  );
  const selectedCategoryQuarterPlan =
    scienceRequirementGroup && categoryOption?.id
      ? buildQuarterPlan(plan, {
          selectedRequirementOptionIdsByGroup: {
            [scienceRequirementGroup.id]: [categoryOption.id],
          },
        })
      : [];
  const chem140CompletedCourses = [
    { code: "CHEM& 140", label: "CHEM& 140", credits: 5 },
    { code: "CHEM& 161", label: "CHEM& 161", credits: 5 },
  ];
  const selectedCategoryTranscriptQuarterPlan =
    scienceRequirementGroup && categoryOption?.id
      ? buildQuarterPlan(plan, {
          completedCourses: chem140CompletedCourses,
          selectedRequirementOptionIdsByGroup: {
            [scienceRequirementGroup.id]: [categoryOption.id],
          },
        })
      : [];
  const optionGroups = getVisiblePlannedCourses(quarterPlan).flatMap((course) =>
    course.optionGroup ? [course.optionGroup] : []
  );
  const scienceChoiceGroup = optionGroups.find(
    (group) =>
      (group.options ?? []).some((option) => (option.courseCodes ?? []).includes("ENGR& 114")) &&
      (group.options ?? []).some((option) => option.categoryOption?.category === "NSC")
  );
  const categoryAudit = planner.auditCategoryOptionDetection({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const satisfactionAudit = planner.auditOptionGroupSatisfaction({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const scienceSatisfactionAudit = satisfactionAudit.find(
    (row) => row.groupId === scienceChoiceGroup?.id
  );
  const selectedCategoryGroups = getVisiblePlannedCourses(selectedCategoryQuarterPlan).flatMap(
    (course) => (course.optionGroup ? [course.optionGroup] : [])
  );
  const selectedCategoryGroup = selectedCategoryGroups.find(
    (group) => group.id === scienceRequirementGroup?.id
  );
  const selectedCategoryLabels = getVisiblePlannedLabels(selectedCategoryQuarterPlan);
  const selectedCategoryAudit =
    scienceRequirementGroup && categoryOption?.id
      ? planner.auditCategoryOptionDetection({
          plan,
          suggestedPlan: selectedCategoryQuarterPlan,
          completedCourses: [],
          selectedRequirementOptionIdsByGroup: {
            [scienceRequirementGroup.id]: [categoryOption.id],
          },
        })
      : [];
  const selectedCategorySatisfactionAudit =
    scienceRequirementGroup && categoryOption?.id
      ? planner.auditOptionGroupSatisfaction({
          plan,
          suggestedPlan: selectedCategoryQuarterPlan,
          completedCourses: [],
          selectedRequirementOptionIdsByGroup: {
            [scienceRequirementGroup.id]: [categoryOption.id],
          },
        })
      : [];
  const selectedCategorySatisfactionRow = selectedCategorySatisfactionAudit.find(
    (row) => row.groupId === scienceRequirementGroup?.id
  );
  const selectedCategoryTranscriptLabels = getVisiblePlannedLabels(
    selectedCategoryTranscriptQuarterPlan
  );
  const selectedCategoryTranscriptAudit =
    scienceRequirementGroup && categoryOption?.id
      ? planner.auditCategoryTranscriptSatisfaction({
          plan,
          suggestedPlan: selectedCategoryTranscriptQuarterPlan,
          completedCourses: chem140CompletedCourses,
          selectedRequirementOptionIdsByGroup: {
            [scienceRequirementGroup.id]: [categoryOption.id],
          },
        })
      : [];
  const selectedCategoryTranscriptSatisfactionAudit =
    scienceRequirementGroup && categoryOption?.id
      ? planner.auditOptionGroupSatisfaction({
          plan,
          suggestedPlan: selectedCategoryTranscriptQuarterPlan,
          completedCourses: chem140CompletedCourses,
          selectedRequirementOptionIdsByGroup: {
            [scienceRequirementGroup.id]: [categoryOption.id],
          },
        })
      : [];
  const selectedCategoryTranscriptSatisfactionRow =
    selectedCategoryTranscriptSatisfactionAudit.find(
      (row) => row.groupId === scienceRequirementGroup?.id
    );

  addCheck(
    checks,
    "uw-seattle-aeronautics-astronautics:mixed-course-category-science-option",
    "UW Aeronautics & Astronautics preserves the CSE 160 / ME 123 / other NSc mixed option group",
    Boolean(scienceChoiceGroup) &&
      scienceChoiceGroup.selectionCount === 1 &&
      (scienceChoiceGroup.resolvedSatisfiedOptionIds ?? []).length === 0 &&
      (scienceChoiceGroup.options ?? []).some((option) =>
        /5 credits of Natural Sciences \(NSc\)/i.test(option.label ?? "")
      ) &&
      !(scienceChoiceGroup.options ?? []).some((option) =>
        (option.courseCodes ?? []).includes("CSE 160")
      ) &&
      categoryAudit.some(
        (row) => row.visibleOption && row.issue === null && /NSc|Natural Sciences/i.test(row.copyOnlyDebugText)
      ) &&
      scienceSatisfactionAudit?.displayedProgress === "0/1" &&
      /Category options: .*Natural Sciences/i.test(scienceSatisfactionAudit?.copyOnlyDebugText ?? ""),
    [
      `Option groups: ${optionGroups
        .map((group) => `${group.id}: ${(group.options ?? []).map((option) => option.label).join(" | ")}`)
        .join("\n")}`,
      categoryAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      satisfactionAudit
        .filter((row) => row.groupId === scienceChoiceGroup?.id)
        .map((row) => row.copyOnlyDebugText)
        .join("\n"),
    ],
    "missing-category-option"
  );

  addCheck(
    checks,
    "uw-seattle-aeronautics-astronautics:selected-category-science-option",
    "UW Aeronautics & Astronautics selected NSc category option remains visible and counts without a fake course",
    Boolean(selectedCategoryGroup) &&
      selectedCategoryGroup?.resolvedSatisfiedOptionIds?.length === 1 &&
      selectedCategoryGroup?.resolvedSatisfiedOptionIds?.[0] === categoryOption?.id &&
      selectedCategoryGroup?.optionSatisfactionSourcesById?.[categoryOption?.id ?? ""]?.includes(
        "user-selected"
      ) &&
      !selectedCategoryLabels.includes("ENGR& 114") &&
      selectedCategoryLabels.some((label) => /5 credits of Natural Sciences \(NSc\)/i.test(label)) &&
      selectedCategoryAudit.some(
        (row) =>
          row.visibleOption &&
          row.selected &&
          row.issue === null &&
          /NSc|Natural Sciences/i.test(row.copyOnlyDebugText)
      ) &&
      selectedCategorySatisfactionRow?.displayedProgress === "1/1" &&
      /Selected category options: 5 credits of Natural Sciences \(NSc\)/i.test(
        selectedCategorySatisfactionRow?.copyOnlyDebugText ?? ""
      ),
    [
      `Selected category labels: ${selectedCategoryLabels.join(", ")}`,
      selectedCategoryAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      selectedCategorySatisfactionAudit.map((row) => row.copyOnlyDebugText).join("\n"),
    ],
    "missing-category-option"
  );

  addCheck(
    checks,
    "uw-seattle-aeronautics-astronautics:selected-category-transcript-satisfaction",
    "UW Aeronautics & Astronautics selected NSc category option uses completed CHEM& 140 without a duplicate placeholder",
    !selectedCategoryTranscriptLabels.some((label) =>
      /5 credits of Natural Sciences \(NSc\)/i.test(label)
    ) &&
      !selectedCategoryTranscriptLabels.includes("ENGR& 114") &&
      selectedCategoryTranscriptAudit.some(
        (row) =>
          row.chosenTranscriptSatisfier === "CHEM& 140" &&
          row.genericCategoryRowScheduled === false &&
          /satisfied by CHEM& 140/i.test(row.visibleOptionStatusText ?? "") &&
          row.issue === null
      ) &&
      selectedCategoryTranscriptSatisfactionRow?.displayedProgress === "1/1" &&
      selectedCategoryTranscriptSatisfactionRow?.chosenTranscriptCategorySatisfier ===
        "CHEM& 140" &&
      selectedCategoryTranscriptSatisfactionRow?.genericPlannedCategoryCredits === 0,
    [
      `Selected category transcript labels: ${selectedCategoryTranscriptLabels.join(", ")}`,
      selectedCategoryTranscriptAudit.map((row) => row.copyOnlyDebugText).join("\n"),
      selectedCategoryTranscriptSatisfactionAudit
        .map((row) => row.copyOnlyDebugText)
        .join("\n"),
    ],
    "missing-category-option"
  );
}

function auditInformatics(checks) {
  const plan = resolveRuntimePlan("uw-seattle-informatics", null);
  const quarterPlan = buildQuarterPlan(plan, {
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
  });
  const labels = getVisiblePlannedLabels(quarterPlan);
  const leakedRows = labels.filter((label) =>
    /\b(?:PHYS|CHEM|BIOL|ENGR)&?\s*\d{3}\b|\b(?:INFO|BIME|CSE)\s*[34]\d{2}\b/i.test(label)
  );

  addCheck(
    checks,
    "uw-seattle-informatics:hidden-unmapped-info-only",
    "UW Informatics keeps INFO-only and upper-division requirements hidden/unmapped without engineering or science spillover",
    leakedRows.length === 0,
    [
      `Planned labels: ${labels.join(", ")}`,
      `Leaked rows: ${leakedRows.join(", ") || "none"}`,
    ],
    "source-scope-contamination"
  );
}

function buildProtectedRows(targetPlanId) {
  const rows = [];
  if (!targetPlanId || targetPlanId === "uw-seattle-mechanical-engineering") {
    rows.push(...buildProtectedRequirementRows("uw-seattle-mechanical-engineering", null, ME_EXPECTED_REQUIREMENTS));
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-civil-engineering") {
    rows.push(...buildProtectedRequirementRows("uw-seattle-civil-engineering", null, CIVIL_EXPECTED_REQUIREMENTS));
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-bioengineering") {
    rows.push(...buildProtectedRequirementRows("uw-seattle-bioengineering", null, BIOENGINEERING_EXPECTED_REQUIREMENTS));
  }
  return rows;
}

function runRegressionChecks(targetPlanId) {
  const checks = [];
  if (!targetPlanId || targetPlanId === "uw-seattle-mechanical-engineering") {
    auditMechanicalEngineering(checks);
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-civil-engineering") {
    auditCivilEngineering(checks);
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-computer-engineering") {
    auditComputerEngineering(checks);
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-computer-science") {
    auditComputerScience(checks);
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-chemical-engineering") {
    auditChemicalEngineering(checks);
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-bioengineering") {
    auditBioengineering(checks);
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-materials-science-engineering") {
    auditMseNme(checks);
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-sustainable-bioresource-systems-engineering") {
    auditSbseOptionSatisfaction(checks);
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-electrical-computer-engineering") {
    auditEcePhotonics(checks);
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-environmental-engineering") {
    auditEnvironmentalEngineering(checks);
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-aeronautics-astronautics") {
    auditAeronauticsCategoryOptions(checks);
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-informatics") {
    auditInformatics(checks);
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-mechanical-engineering") {
    auditMajorGenEdScope(checks);
  }
  if (!targetPlanId || targetPlanId === "uw-seattle-materials-science-engineering") {
    auditPrepCreditSeparation(checks);
  }
  if (!targetPlanId) {
    auditAccounting(checks);
    auditAst2ComputerElectrical(checks);
    auditAst2CivilMechanical(checks);
  }
  if (
    !targetPlanId ||
    ["uw-seattle-bioengineering", "uw-seattle-mechanical-engineering", "uw-seattle-materials-science-engineering"].includes(
      targetPlanId
    )
  ) {
    auditMatchedTrackSummary(checks);
  }
  return checks;
}

function buildIssueCounts(rows, checks) {
  const counts = Object.fromEntries(ISSUE_TYPES.map((issueType) => [issueType, 0]));
  for (const row of rows) {
    if (row.issueType && counts[row.issueType] != null) {
      counts[row.issueType] += 1;
    }
    if (row.issue && row.issue !== "none" && counts[row.issue] != null) {
      counts[row.issue] += 1;
    }
  }
  for (const check of checks) {
    if (check.status === "failed" && check.issueType && counts[check.issueType] != null) {
      counts[check.issueType] += 1;
    }
  }
  return counts;
}

function buildSourceScopeIssueCounts(rows) {
  const counts = Object.fromEntries(
    SOURCE_SCOPE_ISSUE_TYPES.map((issueType) => [issueType, 0])
  );
  for (const row of rows) {
    if (row.issue && row.issue !== "none" && counts[row.issue] != null) {
      counts[row.issue] += 1;
    }
  }
  return counts;
}

function buildGeneratedRegistryIssueCounts(rows) {
  const counts = Object.fromEntries(
    [
      "unscoped-generated-seed",
      "stale-manual-seed",
      "flattened-option-group",
      "flattened-credit-bucket",
      "flattened-sequence-choice",
      "pathway-leak",
      "path-note-unscoped",
      "support-metadata-became-required",
      "approved-list-generated-required-row",
      "elective-list-generated-required-row",
      "hidden-informational-row-scheduled",
      "generated-row-without-primary-source",
      "wrong-shape",
      "flattened-option",
      "credit-bucket-as-count",
      "sequence-choice-flattened",
      "elective-list-as-required",
      "hidden-row-as-required",
      "list-promoted-to-required",
      "support-list-scheduled",
      "missing-list-shape",
      "missing-category-option",
      "generic-category-used-for-program-specific",
      "fake-category-course",
      "fake-course-invented",
      "missing-equivalency",
      "fake-equivalency",
      "unsupported-substitution",
      "stale-equivalency",
    ].map((issueType) => [issueType, 0])
  );
  for (const row of rows) {
    if (row.issue && row.issue !== "none" && counts[row.issue] != null) {
      counts[row.issue] += 1;
    }
  }
  return counts;
}

function buildMappingIssueCounts(rows) {
  return buildIssueCounts(rows, []);
}

function writeMappingAuditReports(report) {
  ensureTmpDir();
  fs.writeFileSync(MAPPING_AUDIT_OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const issueRows = (report.mappingRegressionRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const lines = [
    "# Transfer Planner UW-GRC Mapping Regression Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Outcome: ${report.outcome}`,
    `- Mapping regression rows: ${report.summary.mappingRegressionRowCount}`,
    `- Mapping regression issues: ${report.summary.mappingRegressionIssueCount}`,
    "",
    "## Issue Counts",
    "",
    ...Object.entries(report.summary.issueCountsByType)
      .filter(([, count]) => count > 0)
      .map(([issueType, count]) => `- ${issueType}: ${count}`),
    "",
  ];

  if (issueRows.length) {
    lines.push("## Issue Sample", "");
    for (const row of issueRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (issueRows.length > 120) {
      lines.push(
        `- ... ${issueRows.length - 120} additional mapping regression issues omitted from markdown.`
      );
    }
    lines.push("");
  }

  lines.push("## Mapping Regression Report", "");
  for (const row of (report.mappingRegressionRows ?? []).slice(0, 160)) {
    lines.push(`- ${row.copyOnlyDebugText}`);
  }
  if ((report.mappingRegressionRows ?? []).length > 160) {
    lines.push(
      `- ... ${report.mappingRegressionRows.length - 160} additional mapping regression rows omitted from markdown.`
    );
  }
  lines.push("");

  fs.writeFileSync(MAPPING_AUDIT_OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function writeGeneratedRegistryReports(report) {
  ensureTmpDir();
  fs.writeFileSync(GENERATED_REGISTRY_OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const issueRows = (report.generatedRegistryRegressionRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const protectedRows = (report.generatedRegistryRegressionRows ?? []).filter(
    (row) => row.protectedPattern
  );
  const requirementShapeIssueRows = (report.requirementShapeAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const electiveApprovedListShapeIssueRows = (
    report.electiveApprovedListShapeAuditRows ?? []
  ).filter((row) => row.issue && row.issue !== "none");
  const creditCategoryShapeIssueRows = (report.creditCategoryShapeAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const categoryMappingIssueRows = (report.categoryMappingAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const programApprovedFilterIssueRows = (report.programApprovedFilterAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const sequencePathwayShapeIssueRows = (report.sequencePathwayShapeAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const singleEquivalencyIssueRows = (report.singleEquivalencyAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const lines = [
    "# Transfer Planner Generated Registry Regression Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Outcome: ${report.outcome}`,
    `- Owners audited: ${report.summary.ownerCount}`,
    `- Generated registry audit rows: ${report.summary.generatedRegistryRegressionRowCount}`,
    `- Generated registry issues: ${report.summary.generatedRegistryIssueCount}`,
    `- Generated source seed rows: ${report.summary.generatedSourceSeedAuditRowCount}`,
    `- Generated shape rows: ${report.summary.generatedShapeAuditRowCount}`,
    `- Requirement shape audit rows: ${report.summary.requirementShapeAuditRowCount}`,
    `- Requirement shape issues: ${report.summary.requirementShapeIssueCount}`,
    `- Elective/approved list shape audit rows: ${
      report.summary.electiveApprovedListShapeAuditRowCount ?? 0
    }`,
    `- Elective/approved list shape issues: ${
      report.summary.electiveApprovedListShapeIssueCount ?? 0
    }`,
    `- Credit/category shape audit rows: ${
      report.summary.creditCategoryShapeAuditRowCount ?? 0
    }`,
    `- Credit/category shape issues: ${
      report.summary.creditCategoryShapeIssueCount ?? 0
    }`,
    `- Category mapping audit rows: ${report.summary.categoryMappingAuditRowCount ?? 0}`,
    `- Category mapping issues: ${report.summary.categoryMappingIssueCount ?? 0}`,
    `- Program approved filter audit rows: ${
      report.summary.programApprovedFilterAuditRowCount ?? 0
    }`,
    `- Program approved filter issues: ${
      report.summary.programApprovedFilterIssueCount ?? 0
    }`,
    `- Sequence/pathway shape audit rows: ${
      report.summary.sequencePathwayShapeAuditRowCount ?? 0
    }`,
    `- Sequence/pathway shape issues: ${
      report.summary.sequencePathwayShapeIssueCount ?? 0
    }`,
    `- Single equivalency audit rows: ${
      report.summary.singleEquivalencyAuditRowCount ?? 0
    }`,
    `- Single equivalency issues: ${
      report.summary.singleEquivalencyIssueCount ?? 0
    }`,
    `- Protected owner rows: ${report.summary.protectedOwnerRowCount}`,
    "",
    "## Issue Counts",
    "",
    ...Object.entries(report.summary.issueCountsByType).map(([issueType, count]) => `- ${issueType}: ${count}`),
    "",
  ];

  if (issueRows.length) {
    lines.push("## Issue Sample", "");
    for (const row of issueRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (issueRows.length > 120) {
      lines.push(`- ... ${issueRows.length - 120} additional generated-registry issues omitted from markdown.`);
    }
    lines.push("");
  }

  if (requirementShapeIssueRows.length) {
    lines.push("## Requirement Shape Issue Sample", "");
    for (const row of requirementShapeIssueRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (electiveApprovedListShapeIssueRows.length) {
    lines.push("## Elective/Approved List Shape Issue Sample", "");
    for (const row of electiveApprovedListShapeIssueRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (creditCategoryShapeIssueRows.length) {
    lines.push("## Credit/Category Shape Issue Sample", "");
    for (const row of creditCategoryShapeIssueRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (sequencePathwayShapeIssueRows.length) {
    lines.push("## Sequence/Pathway Shape Issue Sample", "");
    for (const row of sequencePathwayShapeIssueRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (singleEquivalencyIssueRows.length) {
    lines.push("## Single Equivalency Issue Sample", "");
    for (const row of singleEquivalencyIssueRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (protectedRows.length) {
    lines.push("## Protected Owner Rows", "");
    for (const row of protectedRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if ((report.generatedRegistryRegressionRows ?? []).length) {
    lines.push("## Audit Sample", "");
    for (const row of report.generatedRegistryRegressionRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.generatedRegistryRegressionRows.length > 120) {
      lines.push(
        `- ... ${report.generatedRegistryRegressionRows.length - 120} additional generated registry audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.requirementShapeAuditRows ?? []).length) {
    lines.push("## Requirement Shape Audit Sample", "");
    for (const row of report.requirementShapeAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.requirementShapeAuditRows.length > 120) {
      lines.push(
        `- ... ${report.requirementShapeAuditRows.length - 120} additional requirement shape rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.electiveApprovedListShapeAuditRows ?? []).length) {
    lines.push("## Elective/Approved List Shape Audit Sample", "");
    for (const row of report.electiveApprovedListShapeAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.electiveApprovedListShapeAuditRows.length > 120) {
      lines.push(
        `- ... ${report.electiveApprovedListShapeAuditRows.length - 120} additional elective/approved list shape rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.creditCategoryShapeAuditRows ?? []).length) {
    lines.push("## Credit/Category Shape Audit Sample", "");
    for (const row of report.creditCategoryShapeAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.creditCategoryShapeAuditRows.length > 120) {
      lines.push(
        `- ... ${report.creditCategoryShapeAuditRows.length - 120} additional credit/category shape rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.sequencePathwayShapeAuditRows ?? []).length) {
    lines.push("## Sequence/Pathway Shape Audit Sample", "");
    for (const row of report.sequencePathwayShapeAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.sequencePathwayShapeAuditRows.length > 120) {
      lines.push(
        `- ... ${report.sequencePathwayShapeAuditRows.length - 120} additional sequence/pathway shape rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.singleEquivalencyAuditRows ?? []).length) {
    lines.push("## Single Equivalency Audit Sample", "");
    for (const row of report.singleEquivalencyAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.singleEquivalencyAuditRows.length > 120) {
      lines.push(
        `- ... ${report.singleEquivalencyAuditRows.length - 120} additional single equivalency rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  fs.writeFileSync(GENERATED_REGISTRY_OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function writeReports(report) {
  ensureTmpDir();
  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const failedChecks = report.regressionChecks.filter((check) => check.status === "failed");
  const issueRows = report.requirementCoverageRows.filter((row) => row.issueType);
  const sourceScopeIssueRows = (report.sourceScopeAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const generatedSourceSeedIssueRows = (report.generatedSourceSeedAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const generatedShapeIssueRows = (report.generatedShapeAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const requirementShapeIssueRows = (report.requirementShapeAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const electiveApprovedListShapeIssueRows = (
    report.electiveApprovedListShapeAuditRows ?? []
  ).filter((row) => row.issue && row.issue !== "none");
  const creditCategoryShapeIssueRows = (report.creditCategoryShapeAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const categoryMappingIssueRows = (report.categoryMappingAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const programApprovedFilterIssueRows = (report.programApprovedFilterAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const sequencePathwayShapeIssueRows = (report.sequencePathwayShapeAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const singleEquivalencyIssueRows = (report.singleEquivalencyAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const runtimeOptionResolutionIssueRows = (
    report.runtimeOptionResolutionAuditRows ?? []
  ).filter((row) => row.issue && row.issue !== "none");
  const runtimeCompoundSequenceIssueRows = (
    report.runtimeCompoundSequenceAuditRows ?? []
  ).filter((row) => row.issue && row.issue !== "none");
  const requiredCoverageSequenceSuppressionIssueRows = (
    report.requiredCoverageSequenceSuppressionAuditRows ?? []
  ).filter((row) => row.issue && row.issue !== "none");
  const runtimeCompoundSchedulingIssueRows = (
    report.runtimeCompoundSchedulingAuditRows ?? []
  ).filter((row) => row.issue && row.issue !== "none");
  const parserOptionIssueRows = (report.parserOptionExtractionAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const parserCreditBucketIssueRows = (report.parserCreditBucketAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const parserCategoryOptionIssueRows = (report.parserCategoryOptionAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const parserPrerequisiteFilterIssueRows = (
    report.parserPrerequisiteFilterAuditRows ?? []
  ).filter((row) => row.issue && row.issue !== "none");
  const parserSequenceChoiceIssueRows = (report.parserSequenceChoiceAuditRows ?? []).filter(
    (row) => row.issue && row.issue !== "none"
  );
  const parserExtractionRegressionIssueRows = (
    report.parserExtractionRegressionRows ?? []
  ).filter((row) => row.issue && row.issue !== "none");
  const lines = [
    "# Transfer Planner Source-Backed Coverage Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Outcome: ${report.outcome}`,
    `- UW owners audited: ${report.summary.ownerCount}`,
    `- Requirement coverage rows: ${report.summary.requirementCoverageRowCount}`,
    `- Source scope audit rows: ${report.summary.sourceScopeAuditRowCount ?? 0}`,
    `- Source scope issues: ${report.summary.sourceScopeIssueCount ?? 0}`,
    `- Generated source seed audit rows: ${
      report.summary.generatedSourceSeedAuditRowCount ?? 0
    }`,
    `- Generated source seed issues: ${report.summary.generatedSourceSeedIssueCount ?? 0}`,
    `- Generated shape audit rows: ${report.summary.generatedShapeAuditRowCount ?? 0}`,
    `- Generated shape issues: ${report.summary.generatedShapeIssueCount ?? 0}`,
    `- Requirement shape audit rows: ${report.summary.requirementShapeAuditRowCount ?? 0}`,
    `- Requirement shape issues: ${report.summary.requirementShapeIssueCount ?? 0}`,
    `- Elective/approved list shape audit rows: ${
      report.summary.electiveApprovedListShapeAuditRowCount ?? 0
    }`,
    `- Elective/approved list shape issues: ${
      report.summary.electiveApprovedListShapeIssueCount ?? 0
    }`,
    `- Credit/category shape audit rows: ${
      report.summary.creditCategoryShapeAuditRowCount ?? 0
    }`,
    `- Credit/category shape issues: ${
      report.summary.creditCategoryShapeIssueCount ?? 0
    }`,
    `- Sequence/pathway shape audit rows: ${
      report.summary.sequencePathwayShapeAuditRowCount ?? 0
    }`,
    `- Sequence/pathway shape issues: ${
      report.summary.sequencePathwayShapeIssueCount ?? 0
    }`,
    `- Single equivalency audit rows: ${
      report.summary.singleEquivalencyAuditRowCount ?? 0
    }`,
    `- Single equivalency issues: ${
      report.summary.singleEquivalencyIssueCount ?? 0
    }`,
    `- Runtime option resolution audit rows: ${
      report.summary.runtimeOptionResolutionAuditRowCount ?? 0
    }`,
    `- Runtime option resolution issues: ${
      report.summary.runtimeOptionResolutionIssueCount ?? 0
    }`,
    `- Runtime compound sequence audit rows: ${
      report.summary.runtimeCompoundSequenceAuditRowCount ?? 0
    }`,
    `- Runtime compound sequence issues: ${
      report.summary.runtimeCompoundSequenceIssueCount ?? 0
    }`,
    `- Required coverage sequence suppression audit rows: ${
      report.summary.requiredCoverageSequenceSuppressionAuditRowCount ?? 0
    }`,
    `- Required coverage sequence suppression issues: ${
      report.summary.requiredCoverageSequenceSuppressionIssueCount ?? 0
    }`,
    `- Runtime compound scheduling audit rows: ${
      report.summary.runtimeCompoundSchedulingAuditRowCount ?? 0
    }`,
    `- Runtime compound scheduling issues: ${
      report.summary.runtimeCompoundSchedulingIssueCount ?? 0
    }`,
    `- Source role coverage rows: ${report.summary.sourceRoleCoverageRowCount ?? 0}`,
    `- Parser option extraction audit rows: ${
      report.summary.parserOptionExtractionAuditRowCount ?? 0
    }`,
    `- Parser option extraction issues: ${
      report.summary.parserOptionExtractionIssueCount ?? 0
    }`,
    `- Parser credit bucket audit rows: ${
      report.summary.parserCreditBucketAuditRowCount ?? 0
    }`,
    `- Parser credit bucket issues: ${
      report.summary.parserCreditBucketIssueCount ?? 0
    }`,
    `- Parser category option audit rows: ${
      report.summary.parserCategoryOptionAuditRowCount ?? 0
    }`,
    `- Parser category option issues: ${
      report.summary.parserCategoryOptionIssueCount ?? 0
    }`,
    `- Parser prerequisite filter audit rows: ${
      report.summary.parserPrerequisiteFilterAuditRowCount ?? 0
    }`,
    `- Parser prerequisite filter issues: ${
      report.summary.parserPrerequisiteFilterIssueCount ?? 0
    }`,
    `- Parser sequence-choice audit rows: ${
      report.summary.parserSequenceChoiceAuditRowCount ?? 0
    }`,
    `- Parser sequence-choice issues: ${
      report.summary.parserSequenceChoiceIssueCount ?? 0
    }`,
    `- Parser extraction regression rows: ${
      report.summary.parserExtractionRegressionRowCount ?? 0
    }`,
    `- Parser extraction regression issues: ${
      report.summary.parserExtractionRegressionIssueCount ?? 0
    }`,
    `- Source-scope regression report rows: ${
      report.summary.sourceScopeRegressionReportRowCount ?? 0
    }`,
    `- Protected regression rows: ${report.summary.protectedRegressionRowCount}`,
    `- Regression checks passed: ${report.summary.passedRegressionCheckCount}`,
    `- Regression checks failed: ${report.summary.failedRegressionCheckCount}`,
    "",
    "## Issue Counts",
    "",
    ...Object.entries(report.summary.issueCountsByType).map(([issueType, count]) => `- ${issueType}: ${count}`),
    "",
  ];

  if (report.summary.sourceScopeIssueCountsByType) {
    lines.push("## Source Scope Issue Counts", "");
    lines.push(
      ...Object.entries(report.summary.sourceScopeIssueCountsByType).map(
        ([issueType, count]) => `- ${issueType}: ${count}`
      )
    );
    lines.push("");
  }

  if (failedChecks.length) {
    lines.push("## Failed Regression Checks", "");
    for (const check of failedChecks) {
      lines.push(`### ${check.label}`, "");
      lines.push(`- Id: ${check.id}`);
      lines.push(`- Issue type: ${check.issueType ?? "none"}`);
      for (const detail of check.details ?? []) {
        lines.push(`- Detail: ${detail}`);
      }
      lines.push("");
    }
  }

  if (issueRows.length) {
    lines.push("## Requirement Coverage Issue Sample", "");
    lines.push(
      "| Major | UW requirement | UW codes | GRC equivalents | Runtime row | Visible | Hidden/internal reason | Issue type |"
    );
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const row of issueRows.slice(0, 80)) {
      lines.push(
        `| ${escapeMarkdown(row.ownerId)} | ${escapeMarkdown(row.uwRequirementLabel)} | ${escapeMarkdown(joinList(row.parsedUwCourseCodes))} | ${escapeMarkdown(joinList(row.matchedGrcEquivalents))} | ${row.generatedRuntimeRow ? "yes" : "no"} | ${row.visibleInTransferOnlyQuarterPlan ? "yes" : "no"} | ${escapeMarkdown(row.hiddenInternalReason ?? "none")} | ${escapeMarkdown(row.issueType ?? "none")} |`
      );
    }
    lines.push("");
  }

  if (sourceScopeIssueRows.length) {
    lines.push("## Source Scope Audit Issue Sample", "");
    for (const row of sourceScopeIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (generatedSourceSeedIssueRows.length) {
    lines.push("## Generated Source Seed Audit Issue Sample", "");
    for (const row of generatedSourceSeedIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (generatedShapeIssueRows.length) {
    lines.push("## Generated Shape Audit Issue Sample", "");
    for (const row of generatedShapeIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (requirementShapeIssueRows.length) {
    lines.push("## Requirement Shape Audit Issue Sample", "");
    for (const row of requirementShapeIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (electiveApprovedListShapeIssueRows.length) {
    lines.push("## Elective/Approved List Shape Issue Sample", "");
    for (const row of electiveApprovedListShapeIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (creditCategoryShapeIssueRows.length) {
    lines.push("## Credit/Category Shape Issue Sample", "");
    for (const row of creditCategoryShapeIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (categoryMappingIssueRows.length) {
    lines.push("## Category Mapping Issue Sample", "");
    for (const row of categoryMappingIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (programApprovedFilterIssueRows.length) {
    lines.push("## Program Approved Filter Issue Sample", "");
    for (const row of programApprovedFilterIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (sequencePathwayShapeIssueRows.length) {
    lines.push("## Sequence/Pathway Shape Issue Sample", "");
    for (const row of sequencePathwayShapeIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (singleEquivalencyIssueRows.length) {
    lines.push("## Single Equivalency Issue Sample", "");
    for (const row of singleEquivalencyIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (runtimeOptionResolutionIssueRows.length) {
    lines.push("## Runtime Option Resolution Issue Sample", "");
    for (const row of runtimeOptionResolutionIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (runtimeCompoundSequenceIssueRows.length) {
    lines.push("## Runtime Compound Sequence Issue Sample", "");
    for (const row of runtimeCompoundSequenceIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (requiredCoverageSequenceSuppressionIssueRows.length) {
    lines.push("## Required Coverage Sequence Suppression Issue Sample", "");
    for (const row of requiredCoverageSequenceSuppressionIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (runtimeCompoundSchedulingIssueRows.length) {
    lines.push("## Runtime Compound Scheduling Issue Sample", "");
    for (const row of runtimeCompoundSchedulingIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (parserOptionIssueRows.length) {
    lines.push("## Parser Option Extraction Issue Sample", "");
    for (const row of parserOptionIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (parserCreditBucketIssueRows.length) {
    lines.push("## Parser Credit Bucket Issue Sample", "");
    for (const row of parserCreditBucketIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (parserCategoryOptionIssueRows.length) {
    lines.push("## Parser Category Option Issue Sample", "");
    for (const row of parserCategoryOptionIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (parserPrerequisiteFilterIssueRows.length) {
    lines.push("## Parser Prerequisite Filter Issue Sample", "");
    for (const row of parserPrerequisiteFilterIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (parserSequenceChoiceIssueRows.length) {
    lines.push("## Parser Sequence-Choice Issue Sample", "");
    for (const row of parserSequenceChoiceIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if (parserExtractionRegressionIssueRows.length) {
    lines.push("## Parser Extraction Regression Issue Sample", "");
    for (const row of parserExtractionRegressionIssueRows.slice(0, 80)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    lines.push("");
  }

  if ((report.sourceRoleCoverageRows ?? []).length) {
    lines.push("## Source Role Coverage Sample", "");
    for (const row of report.sourceRoleCoverageRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.sourceRoleCoverageRows.length > 120) {
      lines.push(
        `- ... ${report.sourceRoleCoverageRows.length - 120} additional source-role coverage rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.sourceScopeRegressionRows ?? []).length) {
    lines.push("## Source Scope Regression Report", "");
    for (const row of report.sourceScopeRegressionRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.sourceScopeRegressionRows.length > 120) {
      lines.push(
        `- ... ${report.sourceScopeRegressionRows.length - 120} additional source-scope regression rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.parserOptionExtractionAuditRows ?? []).length) {
    lines.push("## Parser Option Extraction Audit Sample", "");
    for (const row of report.parserOptionExtractionAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.parserOptionExtractionAuditRows.length > 120) {
      lines.push(
        `- ... ${report.parserOptionExtractionAuditRows.length - 120} additional parser option extraction audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.categoryMappingAuditRows ?? []).length) {
    lines.push("## Category Mapping Audit Sample", "");
    for (const row of report.categoryMappingAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.categoryMappingAuditRows.length > 120) {
      lines.push(
        `- ... ${report.categoryMappingAuditRows.length - 120} additional category mapping audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.programApprovedFilterAuditRows ?? []).length) {
    lines.push("## Program Approved Filter Audit Sample", "");
    for (const row of report.programApprovedFilterAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.programApprovedFilterAuditRows.length > 120) {
      lines.push(
        `- ... ${report.programApprovedFilterAuditRows.length - 120} additional program approved filter audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.parserCreditBucketAuditRows ?? []).length) {
    lines.push("## Parser Credit Bucket Audit Sample", "");
    for (const row of report.parserCreditBucketAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.parserCreditBucketAuditRows.length > 120) {
      lines.push(
        `- ... ${report.parserCreditBucketAuditRows.length - 120} additional parser credit bucket audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.parserCategoryOptionAuditRows ?? []).length) {
    lines.push("## Parser Category Option Audit Sample", "");
    for (const row of report.parserCategoryOptionAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.parserCategoryOptionAuditRows.length > 120) {
      lines.push(
        `- ... ${report.parserCategoryOptionAuditRows.length - 120} additional parser category option audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.parserPrerequisiteFilterAuditRows ?? []).length) {
    lines.push("## Parser Prerequisite Filter Audit Sample", "");
    for (const row of report.parserPrerequisiteFilterAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.parserPrerequisiteFilterAuditRows.length > 120) {
      lines.push(
        `- ... ${report.parserPrerequisiteFilterAuditRows.length - 120} additional parser prerequisite filter audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.parserSequenceChoiceAuditRows ?? []).length) {
    lines.push("## Parser Sequence-Choice Audit Sample", "");
    for (const row of report.parserSequenceChoiceAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.parserSequenceChoiceAuditRows.length > 120) {
      lines.push(
        `- ... ${report.parserSequenceChoiceAuditRows.length - 120} additional parser sequence-choice audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.parserExtractionRegressionRows ?? []).length) {
    lines.push("## Parser Extraction Regression Report", "");
    for (const row of report.parserExtractionRegressionRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.parserExtractionRegressionRows.length > 120) {
      lines.push(
        `- ... ${report.parserExtractionRegressionRows.length - 120} additional parser extraction regression rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.generatedSourceSeedAuditRows ?? []).length) {
    lines.push("## Generated Source Seed Audit Sample", "");
    for (const row of report.generatedSourceSeedAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.generatedSourceSeedAuditRows.length > 120) {
      lines.push(
        `- ... ${report.generatedSourceSeedAuditRows.length - 120} additional generated source seed audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.generatedShapeAuditRows ?? []).length) {
    lines.push("## Generated Shape Audit Sample", "");
    for (const row of report.generatedShapeAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.generatedShapeAuditRows.length > 120) {
      lines.push(
        `- ... ${report.generatedShapeAuditRows.length - 120} additional generated shape audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.requirementShapeAuditRows ?? []).length) {
    lines.push("## Requirement Shape Audit Sample", "");
    for (const row of report.requirementShapeAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.requirementShapeAuditRows.length > 120) {
      lines.push(
        `- ... ${report.requirementShapeAuditRows.length - 120} additional requirement shape audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.electiveApprovedListShapeAuditRows ?? []).length) {
    lines.push("## Elective/Approved List Shape Audit Sample", "");
    for (const row of report.electiveApprovedListShapeAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.electiveApprovedListShapeAuditRows.length > 120) {
      lines.push(
        `- ... ${report.electiveApprovedListShapeAuditRows.length - 120} additional elective/approved list shape audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.creditCategoryShapeAuditRows ?? []).length) {
    lines.push("## Credit/Category Shape Audit Sample", "");
    for (const row of report.creditCategoryShapeAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.creditCategoryShapeAuditRows.length > 120) {
      lines.push(
        `- ... ${report.creditCategoryShapeAuditRows.length - 120} additional credit/category shape audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.sequencePathwayShapeAuditRows ?? []).length) {
    lines.push("## Sequence/Pathway Shape Audit Sample", "");
    for (const row of report.sequencePathwayShapeAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.sequencePathwayShapeAuditRows.length > 120) {
      lines.push(
        `- ... ${report.sequencePathwayShapeAuditRows.length - 120} additional sequence/pathway shape audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.singleEquivalencyAuditRows ?? []).length) {
    lines.push("## Single Equivalency Audit Sample", "");
    for (const row of report.singleEquivalencyAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.singleEquivalencyAuditRows.length > 120) {
      lines.push(
        `- ... ${report.singleEquivalencyAuditRows.length - 120} additional single equivalency rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.runtimeOptionResolutionAuditRows ?? []).length) {
    lines.push("## Runtime Option Resolution Audit Sample", "");
    for (const row of report.runtimeOptionResolutionAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.runtimeOptionResolutionAuditRows.length > 120) {
      lines.push(
        `- ... ${report.runtimeOptionResolutionAuditRows.length - 120} additional runtime option resolution rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.runtimeCompoundSequenceAuditRows ?? []).length) {
    lines.push("## Runtime Compound Sequence Audit Sample", "");
    for (const row of report.runtimeCompoundSequenceAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.runtimeCompoundSequenceAuditRows.length > 120) {
      lines.push(
        `- ... ${report.runtimeCompoundSequenceAuditRows.length - 120} additional runtime compound sequence rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.requiredCoverageSequenceSuppressionAuditRows ?? []).length) {
    lines.push("## Required Coverage Sequence Suppression Audit Sample", "");
    for (const row of report.requiredCoverageSequenceSuppressionAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.requiredCoverageSequenceSuppressionAuditRows.length > 120) {
      lines.push(
        `- ... ${report.requiredCoverageSequenceSuppressionAuditRows.length - 120} additional required coverage sequence suppression rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.runtimeCompoundSchedulingAuditRows ?? []).length) {
    lines.push("## Runtime Compound Scheduling Audit Sample", "");
    for (const row of report.runtimeCompoundSchedulingAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.runtimeCompoundSchedulingAuditRows.length > 120) {
      lines.push(
        `- ... ${report.runtimeCompoundSchedulingAuditRows.length - 120} additional runtime compound scheduling rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  if ((report.sourceScopeAuditRows ?? []).length) {
    lines.push("## Source Scope Audit Sample", "");
    for (const row of report.sourceScopeAuditRows.slice(0, 120)) {
      lines.push(`- ${row.copyOnlyDebugText}`);
    }
    if (report.sourceScopeAuditRows.length > 120) {
      lines.push(
        `- ... ${report.sourceScopeAuditRows.length - 120} additional source-scope audit rows omitted from markdown.`
      );
    }
    lines.push("");
  }

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function runGeneratedRegistryAuditMode() {
  ensureTmpDir();
  const targetPlanId = getArgValue("--target-plan-id");
  const reportOnly = hasFlag("--report-only");
  const protectedOnly = hasFlag("--protected-only");
  const {
    owners,
    generatedSourceSeedAuditRows,
    generatedShapeAuditRows,
    generatedRegistryRows,
  } = buildGeneratedRegistryAuditRows(targetPlanId, protectedOnly);
  const requirementShapeAuditRows = owners.flatMap(buildRequirementShapeAuditRowsForOwner);
  const electiveApprovedListShapeAuditRows = owners.flatMap(
    buildElectiveApprovedListShapeAuditRowsForOwner
  );
  const creditCategoryShapeAuditRows = owners.flatMap(buildCreditCategoryShapeAuditRowsForOwner);
  const sequencePathwayShapeAuditRows = owners.flatMap(buildSequencePathwayShapeAuditRowsForOwner);
  const singleEquivalencyAuditRows = [
    ...buildKnownSingleEquivalencyAuditRows(),
    ...owners.flatMap(buildSingleEquivalencyAuditRowsForOwner),
  ];
  const generatedRegistryIssueRows = generatedRegistryRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const requirementShapeIssueRows = requirementShapeAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const electiveApprovedListShapeIssueRows = electiveApprovedListShapeAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const creditCategoryShapeIssueRows = creditCategoryShapeAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const sequencePathwayShapeIssueRows = sequencePathwayShapeAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const singleEquivalencyIssueRows = singleEquivalencyAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const report = {
    generatedAt: new Date().toISOString(),
    outcome:
      generatedRegistryIssueRows.length +
      requirementShapeIssueRows.length +
      electiveApprovedListShapeIssueRows.length +
      creditCategoryShapeIssueRows.length +
      sequencePathwayShapeIssueRows.length +
      singleEquivalencyIssueRows.length
        ? "failed"
        : "passed",
    summary: {
      ownerCount: owners.length,
      generatedRegistryRegressionRowCount: generatedRegistryRows.length,
      generatedRegistryIssueCount: generatedRegistryIssueRows.length,
      generatedSourceSeedAuditRowCount: generatedSourceSeedAuditRows.length,
      generatedShapeAuditRowCount: generatedShapeAuditRows.length,
      requirementShapeAuditRowCount: requirementShapeAuditRows.length,
      requirementShapeIssueCount: requirementShapeIssueRows.length,
      electiveApprovedListShapeAuditRowCount: electiveApprovedListShapeAuditRows.length,
      electiveApprovedListShapeIssueCount: electiveApprovedListShapeIssueRows.length,
      creditCategoryShapeAuditRowCount: creditCategoryShapeAuditRows.length,
      creditCategoryShapeIssueCount: creditCategoryShapeIssueRows.length,
      sequencePathwayShapeAuditRowCount: sequencePathwayShapeAuditRows.length,
      sequencePathwayShapeIssueCount: sequencePathwayShapeIssueRows.length,
      singleEquivalencyAuditRowCount: singleEquivalencyAuditRows.length,
      singleEquivalencyIssueCount: singleEquivalencyIssueRows.length,
      protectedOwnerRowCount: generatedRegistryRows.filter((row) => row.protectedPattern).length,
      issueCountsByType: buildGeneratedRegistryIssueCounts([
        ...generatedRegistryRows,
        ...requirementShapeAuditRows,
        ...electiveApprovedListShapeAuditRows,
        ...creditCategoryShapeAuditRows,
        ...sequencePathwayShapeAuditRows,
        ...singleEquivalencyAuditRows,
      ]),
    },
    generatedRegistryRegressionRows: generatedRegistryRows,
    generatedSourceSeedAuditRows,
    generatedShapeAuditRows,
    requirementShapeAuditRows,
    electiveApprovedListShapeAuditRows,
    creditCategoryShapeAuditRows,
    sequencePathwayShapeAuditRows,
    singleEquivalencyAuditRows,
  };

  writeGeneratedRegistryReports(report);

  console.log(`Generated registry regression audit outcome: ${report.outcome}`);
  console.log(`Owners audited: ${report.summary.ownerCount}`);
  console.log(`Generated registry audit rows: ${report.summary.generatedRegistryRegressionRowCount}`);
  console.log(`Generated registry issues: ${report.summary.generatedRegistryIssueCount}`);
  console.log(`Generated source seed rows: ${report.summary.generatedSourceSeedAuditRowCount}`);
  console.log(`Generated shape rows: ${report.summary.generatedShapeAuditRowCount}`);
  console.log(`Requirement shape audit rows: ${report.summary.requirementShapeAuditRowCount}`);
  console.log(`Requirement shape issues: ${report.summary.requirementShapeIssueCount}`);
  console.log(
    `Elective/approved list shape audit rows: ${report.summary.electiveApprovedListShapeAuditRowCount}`
  );
  console.log(
    `Elective/approved list shape issues: ${report.summary.electiveApprovedListShapeIssueCount}`
  );
  console.log(`Credit/category shape audit rows: ${report.summary.creditCategoryShapeAuditRowCount}`);
  console.log(`Credit/category shape issues: ${report.summary.creditCategoryShapeIssueCount}`);
  console.log(`Sequence/pathway shape audit rows: ${report.summary.sequencePathwayShapeAuditRowCount}`);
  console.log(`Sequence/pathway shape issues: ${report.summary.sequencePathwayShapeIssueCount}`);
  console.log(`Single equivalency audit rows: ${report.summary.singleEquivalencyAuditRowCount}`);
  console.log(`Single equivalency issues: ${report.summary.singleEquivalencyIssueCount}`);
  console.log(`Protected owner rows: ${report.summary.protectedOwnerRowCount}`);
  console.log(`JSON report: ${GENERATED_REGISTRY_OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${GENERATED_REGISTRY_OUTPUT_MD_PATH}`);

  if (
    !reportOnly &&
    (generatedRegistryIssueRows.length ||
      requirementShapeIssueRows.length ||
      electiveApprovedListShapeIssueRows.length ||
      creditCategoryShapeIssueRows.length ||
      sequencePathwayShapeIssueRows.length ||
      singleEquivalencyIssueRows.length)
  ) {
    for (const row of generatedRegistryIssueRows.slice(0, 80)) {
      console.error(`Generated registry regression failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of requirementShapeIssueRows.slice(0, 80)) {
      console.error(`Requirement shape audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of electiveApprovedListShapeIssueRows.slice(0, 80)) {
      console.error(`Elective/approved list shape audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of creditCategoryShapeIssueRows.slice(0, 80)) {
      console.error(`Credit/category shape audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of sequencePathwayShapeIssueRows.slice(0, 80)) {
      console.error(`Sequence/pathway shape audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of singleEquivalencyIssueRows.slice(0, 80)) {
      console.error(`Single equivalency audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    process.exitCode = 1;
  }
}

function runMappingAuditMode() {
  ensureTmpDir();
  const reportOnly = hasFlag("--report-only");
  const mappingRegressionRows = buildMappingRegressionRows();
  const mappingRegressionIssueRows = mappingRegressionRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const report = {
    generatedAt: new Date().toISOString(),
    outcome: mappingRegressionIssueRows.length ? "failed" : "passed",
    summary: {
      mappingRegressionRowCount: mappingRegressionRows.length,
      mappingRegressionIssueCount: mappingRegressionIssueRows.length,
      issueCountsByType: buildMappingIssueCounts(mappingRegressionRows),
    },
    mappingRegressionRows,
  };

  writeMappingAuditReports(report);

  console.log(`Mapping regression audit outcome: ${report.outcome}`);
  console.log(`Mapping regression rows: ${report.summary.mappingRegressionRowCount}`);
  console.log(`Mapping regression issues: ${report.summary.mappingRegressionIssueCount}`);
  console.log(`JSON report: ${MAPPING_AUDIT_OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${MAPPING_AUDIT_OUTPUT_MD_PATH}`);

  if (!reportOnly && mappingRegressionIssueRows.length) {
    for (const row of mappingRegressionIssueRows.slice(0, 120)) {
      console.error(`Mapping regression failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    process.exitCode = 1;
  }
}

function main() {
  if (hasFlag("--mapping-only")) {
    runMappingAuditMode();
    return;
  }

  if (hasFlag("--generated-registry-only")) {
    runGeneratedRegistryAuditMode();
    return;
  }

  ensureTmpDir();
  const targetPlanId = getArgValue("--target-plan-id");
  const reportOnly = hasFlag("--report-only");
  const owners = buildOwners(targetPlanId);
  const coverageRows = owners.flatMap(buildCoverageRowsForOwner);
  const protectedRows = buildProtectedRows(targetPlanId);
  const allRows = [...coverageRows, ...protectedRows];
  const sourceScopeAuditRows = owners.flatMap(buildSourceScopeAuditRowsForOwner);
  const sourceScopeIssueRows = sourceScopeAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const generatedSourceSeedAuditRows = owners.flatMap(buildGeneratedSourceSeedAuditRowsForOwner);
  const generatedSourceSeedIssueRows = generatedSourceSeedAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const generatedSourceSeedAuditRowsByOwner = new Map();
  for (const row of generatedSourceSeedAuditRows) {
    const ownerRows = generatedSourceSeedAuditRowsByOwner.get(row.ownerId) ?? [];
    ownerRows.push(row);
    generatedSourceSeedAuditRowsByOwner.set(row.ownerId, ownerRows);
  }
  const generatedShapeAuditRows = owners.flatMap((owner) =>
    buildGeneratedShapeAuditRowsForOwner(
      owner,
      generatedSourceSeedAuditRowsByOwner.get(owner.ownerId) ?? []
    )
  );
  const generatedShapeIssueRows = generatedShapeAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const requirementShapeAuditRows = owners.flatMap(buildRequirementShapeAuditRowsForOwner);
  const requirementShapeIssueRows = requirementShapeAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const electiveApprovedListShapeAuditRows = owners.flatMap(
    buildElectiveApprovedListShapeAuditRowsForOwner
  );
  const electiveApprovedListShapeIssueRows = electiveApprovedListShapeAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const creditCategoryShapeAuditRows = owners.flatMap(buildCreditCategoryShapeAuditRowsForOwner);
  const creditCategoryShapeIssueRows = creditCategoryShapeAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const categoryMappingAuditRows = owners.flatMap(buildCategoryMappingAuditRowsForOwner);
  const categoryMappingIssueRows = categoryMappingAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const programApprovedFilterAuditRows = owners.flatMap(buildProgramApprovedFilterAuditRowsForOwner);
  const programApprovedFilterIssueRows = programApprovedFilterAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const sequencePathwayShapeAuditRows = owners.flatMap(buildSequencePathwayShapeAuditRowsForOwner);
  const sequencePathwayShapeIssueRows = sequencePathwayShapeAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const singleEquivalencyAuditRows = [
    ...buildKnownSingleEquivalencyAuditRows(),
    ...owners.flatMap(buildSingleEquivalencyAuditRowsForOwner),
  ];
  const singleEquivalencyIssueRows = singleEquivalencyAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const runtimeOptionResolutionAuditRows = owners.flatMap(
    buildRuntimeOptionResolutionAuditRowsForOwner
  );
  const runtimeOptionResolutionIssueRows = runtimeOptionResolutionAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const runtimeCompoundSequenceAuditRows = owners.flatMap(
    buildRuntimeCompoundSequenceAuditRowsForOwner
  );
  const runtimeCompoundSequenceIssueRows = runtimeCompoundSequenceAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const requiredCoverageSequenceSuppressionAuditRows = owners.flatMap(
    buildRequiredCoverageSequenceSuppressionAuditRowsForOwner
  );
  const requiredCoverageSequenceSuppressionIssueRows =
    requiredCoverageSequenceSuppressionAuditRows.filter(
      (row) => row.issue && row.issue !== "none"
    );
  const runtimeCompoundSchedulingAuditRows = owners.flatMap(
    buildRuntimeCompoundSchedulingAuditRowsForOwner
  );
  const runtimeCompoundSchedulingIssueRows = runtimeCompoundSchedulingAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const parserOptionExtractionAuditRows = owners.flatMap(
    buildParserOptionExtractionAuditRowsForOwner
  );
  const parserOptionExtractionIssueRows = parserOptionExtractionAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const parserCreditBucketAuditRows = owners.flatMap(buildParserCreditBucketAuditRowsForOwner);
  const parserCreditBucketIssueRows = parserCreditBucketAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const parserCategoryOptionAuditRows = owners.flatMap(buildParserCategoryOptionAuditRowsForOwner);
  const parserCategoryOptionIssueRows = parserCategoryOptionAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const parserPrerequisiteFilterAuditRows = owners.flatMap(
    buildParserPrerequisiteFilterAuditRowsForOwner
  );
  const parserPrerequisiteFilterIssueRows = parserPrerequisiteFilterAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const parserSequenceChoiceAuditRows = owners.flatMap(buildParserSequenceChoiceAuditRowsForOwner);
  const parserSequenceChoiceIssueRows = parserSequenceChoiceAuditRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const parserExtractionRegressionRows = buildParserExtractionRegressionRows(targetPlanId);
  const parserExtractionRegressionIssueRows = parserExtractionRegressionRows.filter(
    (row) => row.issue && row.issue !== "none"
  );
  const regressionChecks = runRegressionChecks(targetPlanId);
  const failedRegressionChecks = regressionChecks.filter((check) => check.status === "failed");
  const sourceRoleCoverageRows = buildSourceRoleCoverageRows(owners, sourceScopeAuditRows);
  const sourceScopeRegressionRows = buildSourceScopeRegressionRows(regressionChecks);
  const issueCountsByType = buildIssueCounts(
    [
      ...allRows,
      ...sourceScopeAuditRows,
      ...generatedSourceSeedAuditRows,
      ...generatedShapeAuditRows,
      ...requirementShapeAuditRows,
      ...electiveApprovedListShapeAuditRows,
      ...creditCategoryShapeAuditRows,
      ...categoryMappingAuditRows,
      ...programApprovedFilterAuditRows,
      ...sequencePathwayShapeAuditRows,
      ...singleEquivalencyAuditRows,
      ...runtimeOptionResolutionAuditRows,
      ...runtimeCompoundSequenceAuditRows,
      ...requiredCoverageSequenceSuppressionAuditRows,
      ...runtimeCompoundSchedulingAuditRows,
      ...parserOptionExtractionAuditRows,
      ...parserCreditBucketAuditRows,
      ...parserCategoryOptionAuditRows,
      ...parserPrerequisiteFilterAuditRows,
      ...parserSequenceChoiceAuditRows,
      ...parserExtractionRegressionRows,
    ],
    regressionChecks
  );
  const sourceScopeIssueCountsByType = buildSourceScopeIssueCounts([
    ...sourceScopeAuditRows,
    ...generatedSourceSeedAuditRows,
    ...generatedShapeAuditRows,
    ...requirementShapeAuditRows,
    ...electiveApprovedListShapeAuditRows,
    ...creditCategoryShapeAuditRows,
    ...categoryMappingAuditRows,
    ...programApprovedFilterAuditRows,
    ...sequencePathwayShapeAuditRows,
    ...singleEquivalencyAuditRows,
  ]);
  const failedSourceScopeChecks =
    sourceScopeIssueRows.length +
    generatedSourceSeedIssueRows.length +
    generatedShapeIssueRows.length +
    requirementShapeIssueRows.length +
    electiveApprovedListShapeIssueRows.length +
    creditCategoryShapeIssueRows.length +
    categoryMappingIssueRows.length +
    programApprovedFilterIssueRows.length +
    sequencePathwayShapeIssueRows.length +
    singleEquivalencyIssueRows.length +
    runtimeOptionResolutionIssueRows.length +
    runtimeCompoundSequenceIssueRows.length +
    requiredCoverageSequenceSuppressionIssueRows.length +
    runtimeCompoundSchedulingIssueRows.length +
    parserOptionExtractionIssueRows.length +
    parserCreditBucketIssueRows.length +
    parserCategoryOptionIssueRows.length +
    parserPrerequisiteFilterIssueRows.length +
    parserSequenceChoiceIssueRows.length +
    parserExtractionRegressionIssueRows.length +
    failedRegressionChecks.length;
  const report = {
    generatedAt: new Date().toISOString(),
    outcome: failedSourceScopeChecks ? "failed" : "passed",
    summary: {
      ownerCount: owners.length,
      requirementCoverageRowCount: allRows.length,
      sourceScopeAuditRowCount: sourceScopeAuditRows.length,
      sourceScopeIssueCount: sourceScopeIssueRows.length,
      generatedSourceSeedAuditRowCount: generatedSourceSeedAuditRows.length,
      generatedSourceSeedIssueCount: generatedSourceSeedIssueRows.length,
      generatedShapeAuditRowCount: generatedShapeAuditRows.length,
      generatedShapeIssueCount: generatedShapeIssueRows.length,
      requirementShapeAuditRowCount: requirementShapeAuditRows.length,
      requirementShapeIssueCount: requirementShapeIssueRows.length,
      electiveApprovedListShapeAuditRowCount: electiveApprovedListShapeAuditRows.length,
      electiveApprovedListShapeIssueCount: electiveApprovedListShapeIssueRows.length,
      creditCategoryShapeAuditRowCount: creditCategoryShapeAuditRows.length,
      creditCategoryShapeIssueCount: creditCategoryShapeIssueRows.length,
      categoryMappingAuditRowCount: categoryMappingAuditRows.length,
      categoryMappingIssueCount: categoryMappingIssueRows.length,
      programApprovedFilterAuditRowCount: programApprovedFilterAuditRows.length,
      programApprovedFilterIssueCount: programApprovedFilterIssueRows.length,
      sequencePathwayShapeAuditRowCount: sequencePathwayShapeAuditRows.length,
      sequencePathwayShapeIssueCount: sequencePathwayShapeIssueRows.length,
      singleEquivalencyAuditRowCount: singleEquivalencyAuditRows.length,
      singleEquivalencyIssueCount: singleEquivalencyIssueRows.length,
      runtimeOptionResolutionAuditRowCount: runtimeOptionResolutionAuditRows.length,
      runtimeOptionResolutionIssueCount: runtimeOptionResolutionIssueRows.length,
      runtimeCompoundSequenceAuditRowCount: runtimeCompoundSequenceAuditRows.length,
      runtimeCompoundSequenceIssueCount: runtimeCompoundSequenceIssueRows.length,
      requiredCoverageSequenceSuppressionAuditRowCount:
        requiredCoverageSequenceSuppressionAuditRows.length,
      requiredCoverageSequenceSuppressionIssueCount:
        requiredCoverageSequenceSuppressionIssueRows.length,
      runtimeCompoundSchedulingAuditRowCount: runtimeCompoundSchedulingAuditRows.length,
      runtimeCompoundSchedulingIssueCount: runtimeCompoundSchedulingIssueRows.length,
      sourceRoleCoverageRowCount: sourceRoleCoverageRows.length,
      parserOptionExtractionAuditRowCount: parserOptionExtractionAuditRows.length,
      parserOptionExtractionIssueCount: parserOptionExtractionIssueRows.length,
      parserCreditBucketAuditRowCount: parserCreditBucketAuditRows.length,
      parserCreditBucketIssueCount: parserCreditBucketIssueRows.length,
      parserCategoryOptionAuditRowCount: parserCategoryOptionAuditRows.length,
      parserCategoryOptionIssueCount: parserCategoryOptionIssueRows.length,
      parserPrerequisiteFilterAuditRowCount: parserPrerequisiteFilterAuditRows.length,
      parserPrerequisiteFilterIssueCount: parserPrerequisiteFilterIssueRows.length,
      parserSequenceChoiceAuditRowCount: parserSequenceChoiceAuditRows.length,
      parserSequenceChoiceIssueCount: parserSequenceChoiceIssueRows.length,
      parserExtractionRegressionRowCount: parserExtractionRegressionRows.length,
      parserExtractionRegressionIssueCount: parserExtractionRegressionIssueRows.length,
      sourceScopeRegressionReportRowCount: sourceScopeRegressionRows.length,
      protectedRegressionRowCount: protectedRows.length,
      passedRegressionCheckCount: regressionChecks.length - failedRegressionChecks.length,
      failedRegressionCheckCount: failedRegressionChecks.length,
      issueCountsByType,
      sourceScopeIssueCountsByType,
    },
    requirementCoverageRows: allRows,
    sourceScopeAuditRows,
    generatedSourceSeedAuditRows,
    generatedShapeAuditRows,
    requirementShapeAuditRows,
    electiveApprovedListShapeAuditRows,
    creditCategoryShapeAuditRows,
    categoryMappingAuditRows,
    programApprovedFilterAuditRows,
    sequencePathwayShapeAuditRows,
    singleEquivalencyAuditRows,
    runtimeOptionResolutionAuditRows,
    runtimeCompoundSequenceAuditRows,
    requiredCoverageSequenceSuppressionAuditRows,
    runtimeCompoundSchedulingAuditRows,
    parserOptionExtractionAuditRows,
    parserCreditBucketAuditRows,
    parserCategoryOptionAuditRows,
    parserPrerequisiteFilterAuditRows,
    parserSequenceChoiceAuditRows,
    parserExtractionRegressionRows,
    sourceRoleCoverageRows,
    sourceScopeRegressionRows,
    regressionChecks,
  };

  writeReports(report);

  console.log(`Source-backed coverage audit outcome: ${report.outcome}`);
  console.log(`UW owners audited: ${report.summary.ownerCount}`);
  console.log(`Requirement coverage rows: ${report.summary.requirementCoverageRowCount}`);
  console.log(`Source scope audit rows: ${report.summary.sourceScopeAuditRowCount}`);
  console.log(`Source scope issues: ${report.summary.sourceScopeIssueCount}`);
  console.log(`Generated source seed audit rows: ${report.summary.generatedSourceSeedAuditRowCount}`);
  console.log(`Generated source seed issues: ${report.summary.generatedSourceSeedIssueCount}`);
  console.log(`Generated shape audit rows: ${report.summary.generatedShapeAuditRowCount}`);
  console.log(`Generated shape issues: ${report.summary.generatedShapeIssueCount}`);
  console.log(`Requirement shape audit rows: ${report.summary.requirementShapeAuditRowCount}`);
  console.log(`Requirement shape issues: ${report.summary.requirementShapeIssueCount}`);
  console.log(
    `Elective/approved list shape audit rows: ${report.summary.electiveApprovedListShapeAuditRowCount}`
  );
  console.log(
    `Elective/approved list shape issues: ${report.summary.electiveApprovedListShapeIssueCount}`
  );
  console.log(`Credit/category shape audit rows: ${report.summary.creditCategoryShapeAuditRowCount}`);
  console.log(`Credit/category shape issues: ${report.summary.creditCategoryShapeIssueCount}`);
  console.log(`Category mapping audit rows: ${report.summary.categoryMappingAuditRowCount}`);
  console.log(`Category mapping issues: ${report.summary.categoryMappingIssueCount}`);
  console.log(
    `Program approved filter audit rows: ${report.summary.programApprovedFilterAuditRowCount}`
  );
  console.log(
    `Program approved filter issues: ${report.summary.programApprovedFilterIssueCount}`
  );
  console.log(`Sequence/pathway shape audit rows: ${report.summary.sequencePathwayShapeAuditRowCount}`);
  console.log(`Sequence/pathway shape issues: ${report.summary.sequencePathwayShapeIssueCount}`);
  console.log(`Single equivalency audit rows: ${report.summary.singleEquivalencyAuditRowCount}`);
  console.log(`Single equivalency issues: ${report.summary.singleEquivalencyIssueCount}`);
  console.log(
    `Runtime option resolution audit rows: ${report.summary.runtimeOptionResolutionAuditRowCount}`
  );
  console.log(
    `Runtime option resolution issues: ${report.summary.runtimeOptionResolutionIssueCount}`
  );
  console.log(
    `Runtime compound sequence audit rows: ${report.summary.runtimeCompoundSequenceAuditRowCount}`
  );
  console.log(
    `Runtime compound sequence issues: ${report.summary.runtimeCompoundSequenceIssueCount}`
  );
  console.log(
    `Required coverage sequence suppression audit rows: ${report.summary.requiredCoverageSequenceSuppressionAuditRowCount}`
  );
  console.log(
    `Required coverage sequence suppression issues: ${report.summary.requiredCoverageSequenceSuppressionIssueCount}`
  );
  console.log(
    `Runtime compound scheduling audit rows: ${report.summary.runtimeCompoundSchedulingAuditRowCount}`
  );
  console.log(
    `Runtime compound scheduling issues: ${report.summary.runtimeCompoundSchedulingIssueCount}`
  );
  console.log(`Source role coverage rows: ${report.summary.sourceRoleCoverageRowCount}`);
  console.log(
    `Parser option extraction audit rows: ${report.summary.parserOptionExtractionAuditRowCount}`
  );
  console.log(
    `Parser option extraction issues: ${report.summary.parserOptionExtractionIssueCount}`
  );
  console.log(`Parser credit bucket audit rows: ${report.summary.parserCreditBucketAuditRowCount}`);
  console.log(`Parser credit bucket issues: ${report.summary.parserCreditBucketIssueCount}`);
  console.log(
    `Parser category option audit rows: ${report.summary.parserCategoryOptionAuditRowCount}`
  );
  console.log(`Parser category option issues: ${report.summary.parserCategoryOptionIssueCount}`);
  console.log(
    `Parser prerequisite filter audit rows: ${report.summary.parserPrerequisiteFilterAuditRowCount}`
  );
  console.log(
    `Parser prerequisite filter issues: ${report.summary.parserPrerequisiteFilterIssueCount}`
  );
  console.log(
    `Parser sequence-choice audit rows: ${report.summary.parserSequenceChoiceAuditRowCount}`
  );
  console.log(`Parser sequence-choice issues: ${report.summary.parserSequenceChoiceIssueCount}`);
  console.log(
    `Parser extraction regression rows: ${report.summary.parserExtractionRegressionRowCount}`
  );
  console.log(
    `Parser extraction regression issues: ${report.summary.parserExtractionRegressionIssueCount}`
  );
  console.log(`Failed regression checks: ${report.summary.failedRegressionCheckCount}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);

  if (!reportOnly && failedSourceScopeChecks) {
    for (const row of sourceScopeIssueRows.slice(0, 40)) {
      console.error(`Source scope audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of generatedSourceSeedIssueRows.slice(0, 40)) {
      console.error(`Generated source seed audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of generatedShapeIssueRows.slice(0, 40)) {
      console.error(`Generated shape audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of requirementShapeIssueRows.slice(0, 40)) {
      console.error(`Requirement shape audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of electiveApprovedListShapeIssueRows.slice(0, 40)) {
      console.error(`Elective/approved list shape audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of creditCategoryShapeIssueRows.slice(0, 40)) {
      console.error(`Credit/category shape audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of categoryMappingIssueRows.slice(0, 40)) {
      console.error(`Category mapping audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of programApprovedFilterIssueRows.slice(0, 40)) {
      console.error(`Program approved filter audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of sequencePathwayShapeIssueRows.slice(0, 40)) {
      console.error(`Sequence/pathway shape audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of singleEquivalencyIssueRows.slice(0, 40)) {
      console.error(`Single equivalency audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of runtimeOptionResolutionIssueRows.slice(0, 40)) {
      console.error(`Runtime option resolution audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of runtimeCompoundSequenceIssueRows.slice(0, 40)) {
      console.error(`Runtime compound sequence audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of requiredCoverageSequenceSuppressionIssueRows.slice(0, 40)) {
      console.error(`Required coverage sequence suppression audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of runtimeCompoundSchedulingIssueRows.slice(0, 40)) {
      console.error(`Runtime compound scheduling audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of parserOptionExtractionIssueRows.slice(0, 40)) {
      console.error(`Parser option extraction audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of parserCreditBucketIssueRows.slice(0, 40)) {
      console.error(`Parser credit bucket audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of parserCategoryOptionIssueRows.slice(0, 40)) {
      console.error(`Parser category option audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of parserPrerequisiteFilterIssueRows.slice(0, 40)) {
      console.error(`Parser prerequisite filter audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of parserSequenceChoiceIssueRows.slice(0, 40)) {
      console.error(`Parser sequence-choice audit failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const row of parserExtractionRegressionIssueRows.slice(0, 40)) {
      console.error(`Parser extraction regression failed: ${row.issue}`);
      console.error(`- ${row.copyOnlyDebugText}`);
    }
    for (const check of failedRegressionChecks) {
      console.error(`Coverage regression failed: ${check.label}`);
      for (const detail of check.details ?? []) {
        console.error(`- ${detail}`);
      }
    }
    process.exitCode = 1;
  }
}

main();
