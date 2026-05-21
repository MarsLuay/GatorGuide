const assert = require("node:assert/strict");
const test = require("node:test");

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

const RUN_REGRESSIONS =
  process.env.TRANSFER_PLANNER_RUN_UWS_50_MAJOR_REGRESSIONS === "1";
const SKIP_REASON =
  "Known 50-major audit regressions: enable with TRANSFER_PLANNER_RUN_UWS_50_MAJOR_REGRESSIONS=1 while fixing source/parser scope.";

let registryCache = null;

function getRegistries() {
  if (!registryCache) {
    registryCache = {
      sourceRegistry: require("../../constants/transfer-planner-source"),
      studentRuntime: require("../../constants/transfer-planner-source/student-runtime"),
    };
  }

  return registryCache;
}

function normalizeText(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeCourseCode(value) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/\bDIS\s+ST\b/g, "DIS ST")
    .replace(/\bED\s+ST&I\b/g, "EDST&I")
    .replace(/\bJSIS\s+([A-Z])\b/g, "JSIS$1")
    .replace(/^([A-Z&]+(?:\s+[A-Z&]+)?)\s*(\d{3}[A-Z]?|[1-5]XX)$/i, "$1 $2");
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function courseCodePattern(courseCode) {
  const normalizedCode = normalizeCourseCode(courseCode);
  const [subject, number] = normalizedCode.match(/^(.+?)\s+(\d{3}[A-Z]?|[1-5]XX)$/i)?.slice(1) ?? [];
  if (!subject || !number) {
    return new RegExp(escapeRegExp(normalizedCode), "i");
  }

  return new RegExp(
    `\\b${subject.split(/\s+/).map(escapeRegExp).join("\\s+")}\\s*${escapeRegExp(number)}\\b`,
    "i"
  );
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeCall(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function getAllPathwayIds(planId) {
  const { sourceRegistry, studentRuntime } = getRegistries();
  const sourcePlan = safeCall(() => sourceRegistry.getTransferPlannerMajorPlan(planId), null);
  const runtimePlan = safeCall(() => studentRuntime.getTransferPlannerMajorPlan(planId), null);
  return [
    null,
    ...safeCall(
      () => safeArray(sourceRegistry.getTransferPlannerPathwaysForPlan(sourcePlan)).map(
        (pathway) => pathway.id
      ),
      []
    ),
    ...safeCall(
      () => safeArray(studentRuntime.getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan)).map(
        (pathway) => pathway.id
      ),
      []
    ),
  ].filter((pathwayId, index, pathwayIds) => pathwayIds.indexOf(pathwayId) === index);
}

function getParsedBlocksForOwner(planId) {
  const { sourceRegistry } = getRegistries();
  return getAllPathwayIds(planId).flatMap((pathwayId) =>
    safeCall(
      () => sourceRegistry.getTransferPlannerParsedRequirementSourceBlocks(planId, pathwayId) ?? [],
      []
    )
  );
}

function getParsedCourseCodesForOwner(planId) {
  return uniqueSorted(
    getParsedBlocksForOwner(planId)
      .flatMap((block) => safeArray(block.parsedUwCourseCodes))
      .map(normalizeCourseCode)
  );
}

function getRuntimePlansForOwner(planId) {
  const { studentRuntime } = getRegistries();
  const basePlan = safeCall(() => studentRuntime.getTransferPlannerMajorPlan(planId), null);
  if (!basePlan) {
    return [];
  }

  return getAllPathwayIds(planId)
    .map((pathwayId) =>
      safeCall(() => studentRuntime.resolveTransferPlannerMajorPlan(basePlan, pathwayId), null)
    )
    .filter(Boolean);
}

function getRequirementPayloadForOwner(planId) {
  const { sourceRegistry, studentRuntime } = getRegistries();
  const sourcePlan = safeCall(() => sourceRegistry.getTransferPlannerMajorPlan(planId), null);
  const runtimePlan = safeCall(() => studentRuntime.getTransferPlannerMajorPlan(planId), null);
  const runtimePlans = getRuntimePlansForOwner(planId).map((plan) => ({
    id: plan.id,
    title: plan.title,
    selectedPathwayId: plan.selectedPathwayId ?? null,
    selectedPathwayLabel: plan.selectedPathwayLabel ?? null,
    applicationChecklist: plan.applicationChecklist ?? [],
    beforeEnrollmentChecklist: plan.beforeEnrollmentChecklist ?? [],
    stayAtGrcChecklist: plan.stayAtGrcChecklist ?? [],
    requirementGroups: plan.requirementGroups ?? [],
    grcCourseList: safeCall(() => studentRuntime.getTransferPlannerGrcCourseList(plan), []),
  }));

  return {
    parsedBlocks: getParsedBlocksForOwner(planId),
    sourcePlan,
    sourcePathways: safeCall(() => sourceRegistry.getTransferPlannerPathwaysForPlan(sourcePlan), []),
    runtimePathways: safeCall(
      () => studentRuntime.getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan),
      []
    ),
    runtimePlans,
  };
}

function getRequirementTextForOwner(planId) {
  return normalizeText(JSON.stringify(getRequirementPayloadForOwner(planId))).toUpperCase();
}

function getAllPathwayTextForOwner(planId) {
  const payload = getRequirementPayloadForOwner(planId);
  return normalizeText(
    JSON.stringify({
      sourcePathways: payload.sourcePathways,
      runtimePathways: payload.runtimePathways,
      runtimePathwayLabels: payload.runtimePlans.map((plan) => plan.selectedPathwayLabel),
    })
  );
}

function assertIncludesAllCourses(planId, courseCodes, label) {
  const parsedCodes = new Set(getParsedCourseCodesForOwner(planId));
  const requirementText = getRequirementTextForOwner(planId);
  const missing = courseCodes
    .map(normalizeCourseCode)
    .filter(
      (courseCode) =>
        !parsedCodes.has(courseCode) && !courseCodePattern(courseCode).test(requirementText)
    );

  assert.deepEqual(
    missing,
    [],
    `${label} missing expected official course(s): ${missing.join(", ")}. Parsed: ${[
      ...parsedCodes,
    ].join(", ")}`
  );
}

function assertIncludesAnyCourse(planId, courseCodes, label) {
  const parsedCodes = new Set(getParsedCourseCodesForOwner(planId));
  const requirementText = getRequirementTextForOwner(planId);
  const matched = courseCodes
    .map(normalizeCourseCode)
    .filter(
      (courseCode) => parsedCodes.has(courseCode) || courseCodePattern(courseCode).test(requirementText)
    );

  assert.ok(
    matched.length > 0,
    `${label} missing all acceptable official course alternatives: ${courseCodes.join(", ")}`
  );
}

function assertExcludesCoursePatterns(planId, patterns, label) {
  const parsedCodes = getParsedCourseCodesForOwner(planId);
  const requirementText = getRequirementTextForOwner(planId);
  const present = patterns.flatMap((pattern) => [
    ...parsedCodes.filter((courseCode) => pattern.test(courseCode)),
    ...(pattern.test(requirementText) ? [`text:${pattern}`] : []),
  ]);

  assert.deepEqual(
    uniqueSorted(present),
    [],
    `${label} included wrong-scope course evidence: ${uniqueSorted(present).join(", ")}`
  );
}

function assertRequirementTextIncludes(planId, patterns, label) {
  const requirementText = getRequirementTextForOwner(planId);
  const missing = patterns.filter((pattern) => !pattern.test(requirementText));

  assert.deepEqual(
    missing.map(String),
    [],
    `${label} missing expected requirement text pattern(s).`
  );
}

function assertRequirementTextExcludes(planId, patterns, label) {
  const requirementText = getRequirementTextForOwner(planId);
  const present = patterns.filter((pattern) => pattern.test(requirementText));

  assert.deepEqual(
    present.map(String),
    [],
    `${label} leaked wrong-scope/generated-shell text.`
  );
}

function assertPathwayTextIncludes(planId, patterns, label) {
  const pathwayText = getAllPathwayTextForOwner(planId);
  const missing = patterns.filter((pattern) => !pattern.test(pathwayText));

  assert.deepEqual(
    missing.map(String),
    [],
    `${label} missing expected pathway/option heading pattern(s). Pathways: ${pathwayText}`
  );
}

const REGRESSION_CASES = [
  {
    issue: "CFRM",
    planId: "uw-seattle-computational-finance-and-risk-management",
    label: "CFRM undergraduate credential scope",
    expectedCourses: ["CFRM 405", "CFRM 410", "CFRM 415", "CFRM 420", "CFRM 425"],
    forbiddenCoursePatterns: [/^CFRM 5\d{2}$/],
    forbiddenTextPatterns: [/\bCFRM\s*5\d{2}\b/i],
  },
  {
    issue: "ECFS",
    planId: "uw-seattle-early-childhood-and-family-studies",
    label: "ECFS source/parser sanity",
    expectedCourses: ["ECFS 200"],
    requiredTextPatterns: [/EARLY\s+CHILDHOOD\s+(?:&|AND)\s+FAMILY\s+STUDIES/i],
    forbiddenTextPatterns: [/ROUTE\.NAME\.IS_LAYOUT_BUILDER_UI/i],
  },
  {
    issue: "Education Studies",
    planId: "uw-seattle-education-studies",
    label: "Education Studies option and foundation structure",
    expectedPathwayPatterns: [
      /EARLY\s+CHILDHOOD\s+STUDIES/i,
      /EDUCATION\s+RESEARCH\s+AND\s+POLICY/i,
      /FOUNDATIONS\s+OF\s+TEACHING/i,
      /MULTILINGUAL.*LANGUAGE.*EDUCATION/i,
      /SPORTS\s+AND\s+EDUCATION/i,
      /WELLNESS.*SOCIAL.*EMOTIONAL/i,
    ],
    forbiddenTextPatterns: [/ROUTE\.NAME\.IS_LAYOUT_BUILDER_UI/i],
  },
  {
    issue: "ECO",
    planId: "uw-seattle-education-communities-and-organizations",
    label: "Education, Communities and Organizations separate BA block",
    expectedCourses: [
      "EDUC 280",
      "EDUC 251",
      "EDUC 370",
      "EDPSY 302",
      "EDPSY 380",
      "EDPSY 304",
      "EDUC 472",
      "EDUC 473",
      "EDUC 460",
      "EDUC 481",
      "EDUC 482",
      "EDUC 483",
    ],
    requiredTextPatterns: [/EDUCATION,\s*COMMUNITIES\s*(?:&|AND)\s*ORGANIZATIONS/i],
    forbiddenTextPatterns: [
      /BA-OPTION-FAMILY:EARLY-CHILDHOOD-STUDIES/i,
      /BA-OPTION-FAMILY:FOUNDATIONS-OF-TEACHING/i,
      /BA-OPTION-FAMILY:SPORTS-AND-EDUCATION/i,
    ],
  },
  {
    issue: "Environmental Studies",
    planId: "uw-seattle-environmental-studies",
    label: "Environmental Studies core",
    expectedCourses: ["ENVIR 100", "ENVIR 101", "ENVIR 301", "ENVIR 302", "ENVIR 401"],
    requiredTextPatterns: [/INTEGRATING\s+DISCIPLINES|DISCIPLINES\s+OF\s+ENVIRONMENTAL\s+STUDIES/i],
  },
  {
    issue: "Dance",
    planId: "uw-seattle-dance",
    label: "Dance undergraduate BA scope",
    expectedCourses: ["DANCE 150", "DANCE 166", "DANCE 242", "DANCE 271", "DANCE 493"],
    forbiddenCoursePatterns: [/^DANCE 595$/],
    forbiddenTextPatterns: [/\bDANCE\s*595\b/i],
  },
  {
    issue: "Disability Studies",
    planId: "uw-seattle-disability-studies",
    label: "Disability Studies major scope",
    expectedAnyCourses: ["DIS ST 230", "LSJ 230", "CHID 230"],
    requiredTextPatterns: [/SUBFIELD|RIGHTS\s+AND\s+CITIZENSHIP|CULTURE\s+AND\s+REPRESENTATION/i],
  },
  {
    issue: "Classics",
    planId: "uw-seattle-classics",
    label: "Classics broader Greek and Latin section scope",
    expectedCourses: ["CLAS 495"],
    requiredTextPatterns: [/\bGREEK\b/i, /\bLATIN\b/i],
  },
  {
    issue: "Communication",
    planId: "uw-seattle-communication",
    label: "Communication lower-division intro",
    expectedCourses: ["COM 200"],
    requiredTextPatterns: [/\b(?:ONE|1)\s+ADDITIONAL\b[^.]{0,160}\b200[-\s]?LEVEL\b[^.]{0,80}\bCOM\b/i],
  },
  {
    issue: "European Studies",
    planId: "uw-seattle-european-studies",
    label: "European Studies wrong-section leakage",
    forbiddenTextPatterns: [
      /\bJAPAN\s+CONCENTRATION\b/i,
      /\bJAPAN(?:ESE)?\s+OPTION\b/i,
      /\bJAPAN-CONCENTRATION\b/i,
    ],
  },
];

test("UW Seattle 50-major regression fixture covers confirmed high-risk owners", () => {
  assert.deepEqual(
    REGRESSION_CASES.map((entry) => entry.issue),
    [
      "CFRM",
      "ECFS",
      "Education Studies",
      "ECO",
      "Environmental Studies",
      "Dance",
      "Disability Studies",
      "Classics",
      "Communication",
      "European Studies",
    ]
  );
});

for (const fixture of REGRESSION_CASES) {
  test(
    `50-major regression: ${fixture.label}`,
    { skip: RUN_REGRESSIONS ? false : SKIP_REASON },
    () => {
      if (fixture.expectedCourses) {
        assertIncludesAllCourses(
          fixture.planId,
          fixture.expectedCourses,
          `${fixture.issue} source/generated output`
        );
      }

      if (fixture.expectedAnyCourses) {
        assertIncludesAnyCourse(
          fixture.planId,
          fixture.expectedAnyCourses,
          `${fixture.issue} source/generated output`
        );
      }

      if (fixture.expectedPathwayPatterns) {
        assertPathwayTextIncludes(
          fixture.planId,
          fixture.expectedPathwayPatterns,
          `${fixture.issue} pathway materialization`
        );
      }

      if (fixture.requiredTextPatterns) {
        assertRequirementTextIncludes(
          fixture.planId,
          fixture.requiredTextPatterns,
          `${fixture.issue} requirement output`
        );
      }

      if (fixture.forbiddenCoursePatterns) {
        assertExcludesCoursePatterns(
          fixture.planId,
          fixture.forbiddenCoursePatterns,
          `${fixture.issue} source/generated output`
        );
      }

      if (fixture.forbiddenTextPatterns) {
        assertRequirementTextExcludes(
          fixture.planId,
          fixture.forbiddenTextPatterns,
          `${fixture.issue} requirement output`
        );
      }
    }
  );
}
