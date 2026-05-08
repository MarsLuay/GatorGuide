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
const planner = require("../../services/planning/transfer-planner.service");

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
  "missing-option-group",
  "missing-category-option",
  "false-required-promotion",
];

const UW_CAMPUSES = new Set(["uw-seattle", "uw-bothell", "uw-tacoma"]);
const CONCRETE_UW_ONLY_PATTERN = /\b[A-Z]{2,8}\s*[123]\d{2}\b/i;
const UPPER_DIVISION_UW_PATTERN = /\b[A-Z]{2,8}\s*[3-5]\d{2}\b/i;
const SOURCE_BACKED_REQUIRED_COURSE_NON_REQUIREMENT_CUE_PATTERN =
  /\b(approved list|not required for transferring|electives?|general electives?|free electives?|replacement|course list|course lists|course evaluation|course evaluations|recommended|suggested|consider|first year students|suggested general education|suggested course pathways?|choose\s+(?:one|[0-9]+)|one\s+of|select(?:ed|ing)?|\d+\s+credits?\s+from|minimum\s+\d+\s+credits?[^.]{0,80}\bfrom)\b/i;

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

function escapeMarkdown(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|");
}

function joinList(values) {
  return values.length ? values.join(", ") : "none";
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

function resolveRuntimePlan(planId, pathwayId) {
  const runtimePlan = source.getTransferPlannerStudentRuntimeMajorPlan(planId);
  if (!runtimePlan) {
    return null;
  }

  return source.resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, pathwayId ?? null);
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
    includeStayAtGrcCourses: options.includeStayAtGrcCourses ?? false,
    includeStemPrepCourses: options.includeStemPrepCourses ?? false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: options.selectedRequirementOptionIdsByGroup ?? {},
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

function getGrcEquivalentsForUwCourses(uwCourseCodes) {
  return uniqueSorted(uwCourseCodes.flatMap(getGrcEquivalentsForUwCourse));
}

function buildParsedRequirementRows(block) {
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

function addCheck(checks, id, label, passed, details = [], issueType = null) {
  checks.push({
    id,
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
      `Candidate URL: ${entry.url}`,
      `Source role: ${entry.role ?? "unknown"}`,
      `Score: ${getConfidenceScore(entry.confidence)}`,
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
  if (!targetPlanId || targetPlanId === "uw-seattle-aeronautics-astronautics") {
    auditAeronauticsCategoryOptions(checks);
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
  }
  for (const check of checks) {
    if (check.status === "failed" && check.issueType && counts[check.issueType] != null) {
      counts[check.issueType] += 1;
    }
  }
  return counts;
}

function writeReports(report) {
  ensureTmpDir();
  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const failedChecks = report.regressionChecks.filter((check) => check.status === "failed");
  const issueRows = report.requirementCoverageRows.filter((row) => row.issueType);
  const lines = [
    "# Transfer Planner Source-Backed Coverage Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Outcome: ${report.outcome}`,
    `- UW owners audited: ${report.summary.ownerCount}`,
    `- Requirement coverage rows: ${report.summary.requirementCoverageRowCount}`,
    `- Protected regression rows: ${report.summary.protectedRegressionRowCount}`,
    `- Regression checks passed: ${report.summary.passedRegressionCheckCount}`,
    `- Regression checks failed: ${report.summary.failedRegressionCheckCount}`,
    "",
    "## Issue Counts",
    "",
    ...Object.entries(report.summary.issueCountsByType).map(([issueType, count]) => `- ${issueType}: ${count}`),
    "",
  ];

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

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function main() {
  ensureTmpDir();
  const targetPlanId = getArgValue("--target-plan-id");
  const reportOnly = hasFlag("--report-only");
  const owners = buildOwners(targetPlanId);
  const coverageRows = owners.flatMap(buildCoverageRowsForOwner);
  const protectedRows = buildProtectedRows(targetPlanId);
  const allRows = [...coverageRows, ...protectedRows];
  const regressionChecks = runRegressionChecks(targetPlanId);
  const failedRegressionChecks = regressionChecks.filter((check) => check.status === "failed");
  const issueCountsByType = buildIssueCounts(allRows, regressionChecks);
  const report = {
    generatedAt: new Date().toISOString(),
    outcome: failedRegressionChecks.length ? "failed" : "passed",
    summary: {
      ownerCount: owners.length,
      requirementCoverageRowCount: allRows.length,
      protectedRegressionRowCount: protectedRows.length,
      passedRegressionCheckCount: regressionChecks.length - failedRegressionChecks.length,
      failedRegressionCheckCount: failedRegressionChecks.length,
      issueCountsByType,
    },
    requirementCoverageRows: allRows,
    regressionChecks,
  };

  writeReports(report);

  console.log(`Source-backed coverage audit outcome: ${report.outcome}`);
  console.log(`UW owners audited: ${report.summary.ownerCount}`);
  console.log(`Requirement coverage rows: ${report.summary.requirementCoverageRowCount}`);
  console.log(`Failed regression checks: ${report.summary.failedRegressionCheckCount}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);

  if (!reportOnly && failedRegressionChecks.length) {
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
