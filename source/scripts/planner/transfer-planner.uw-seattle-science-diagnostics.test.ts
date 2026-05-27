import {
  assert,
  getRequiredPlan,
  getTransferPlannerGrcCourseList,
  getTransferPlannerParsedRequirementSourceBlocks,
  getTransferPlannerPathwaysForPlan,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerSourceManifestEntriesForPlan,
  getTransferPlannerStudentRuntimeMajorPlan,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  test,
} from "./transfer-planner.test-support";

const RUN_UWS_SCIENCE_DIAGNOSTICS =
  process.env.TRANSFER_PLANNER_RUN_UWS_SCIENCE_DIAGNOSTICS === "1";

const diagnosticTest = RUN_UWS_SCIENCE_DIAGNOSTICS ? test : test.skip;

type ParsedBlock = ReturnType<typeof getTransferPlannerParsedRequirementSourceBlocks>[number];
type ParsedGroup = NonNullable<ParsedBlock["parsedRequirementGroups"]>[number];
type ParsedSequencePath = NonNullable<ParsedGroup["sequencePaths"]>[number];

const AUDITED_UW_SEATTLE_SCIENCE_HEALTH_OWNER_IDS = [
  "uw-seattle-applied-and-computational-mathematical-sciences",
  "uw-seattle-applied-mathematics",
  "uw-seattle-aquatic-conservation-and-ecology",
  "uw-seattle-astronomy",
  "uw-seattle-atmospheric-and-climate-science",
  "uw-seattle-biochemistry",
  "uw-seattle-biology",
  "uw-seattle-chemical-engineering",
  "uw-seattle-chemistry",
  "uw-seattle-earth-and-space-sciences",
  "uw-seattle-environmental-design-and-sustainability",
  "uw-seattle-environmental-engineering",
  "uw-seattle-environmental-public-health",
  "uw-seattle-environmental-science-and-terrestrial-resource-management",
  "uw-seattle-environmental-studies",
  "uw-seattle-food-systems-nutrition-and-health",
  "uw-seattle-marine-biology",
  "uw-seattle-mathematics",
  "uw-seattle-medical-laboratory-science",
  "uw-seattle-microbiology",
  "uw-seattle-neuroscience",
  "uw-seattle-oceanography",
  "uw-seattle-physics",
  "uw-seattle-public-health-global-health",
  "uw-seattle-statistics",
  "uw-seattle-sustainable-bioresource-systems-engineering",
];

const SBSE_CATALOG_URL =
  "https://www.washington.edu/students/gencat/program/S/SchoolofEnvironmentalandForestScience-1069.html#program-UG-SBSE-MAJOR";

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function getParsedGroups(planId: string) {
  return getTransferPlannerParsedRequirementSourceBlocks(planId, null).flatMap(
    (block) => block.parsedRequirementGroups ?? []
  );
}

function getParsedCourseCodes(planId: string) {
  return uniqueSorted(
    getTransferPlannerParsedRequirementSourceBlocks(planId, null).flatMap(
      (block) => block.parsedUwCourseCodes ?? []
    )
  );
}

function getGroupOptionCodes(group: ParsedGroup) {
  return uniqueSorted(
    (group.options ?? []).flatMap((option) => [
      ...(option.displayCourseCodes ?? []),
      ...(option.uwCourses ?? []),
    ])
  );
}

function getSequencePathCodes(path: ParsedSequencePath) {
  return [...(path.displayCourseCodes?.length ? path.displayCourseCodes : path.uwCourses ?? [])];
}

function sequencePathKey(path: string[]) {
  return path.join(" > ");
}

function getSequencePathSummary(planId: string) {
  return getParsedGroups(planId)
    .filter((group) => (group.sequencePaths ?? []).length > 0)
    .map((group) => ({
      label: group.label,
      paths: (group.sequencePaths ?? []).map((path) => getSequencePathCodes(path)),
    }));
}

function hasSequenceChoice(planId: string, expectedPaths: string[][]) {
  const expectedKeys = expectedPaths.map(sequencePathKey).sort();
  return getParsedGroups(planId).some((group) => {
    const actualKeys = (group.sequencePaths ?? []).map((path) =>
      sequencePathKey(getSequencePathCodes(path))
    );
    return expectedKeys.every((key) => actualKeys.includes(key));
  });
}

function assertParsedCodesInclude(planId: string, expectedCodes: string[], context: string) {
  const parsedCodes = getParsedCourseCodes(planId);
  const missing = expectedCodes.filter((courseCode) => !parsedCodes.includes(courseCode));

  assert.deepEqual(
    missing,
    [],
    `${context}. Missing parsed UW courses: ${missing.join(", ")}. Parsed: ${parsedCodes.join(", ")}`
  );
}

function assertRuntimeGrcCoursesInclude(planId: string, expectedCourses: string[], context: string) {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(planId);
  assert.ok(runtimePlan, `Expected runtime planner data for ${planId}.`);
  const grcCourses = getTransferPlannerGrcCourseList(runtimePlan);
  const missing = expectedCourses.filter((courseCode) => !grcCourses.includes(courseCode));

  assert.deepEqual(
    missing,
    [],
    `${context}. Missing runtime GRC courses: ${missing.join(", ")}. Runtime: ${grcCourses.join(", ")}`
  );
}

function getRuntimePathwayLabels(planId: string) {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(planId);
  assert.ok(runtimePlan, `Expected runtime planner data for ${planId}.`);
  return getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan)
    .map((pathway) => pathway.label)
    .sort((left, right) => left.localeCompare(right));
}

function getSourcePathwayLabels(planId: string) {
  return getTransferPlannerPathwaysForPlan(getRequiredPlan(planId))
    .map((pathway) => pathway.label)
    .sort((left, right) => left.localeCompare(right));
}

test("UW Seattle natural science, math, environment, and health diagnostic owner fixture stays resolvable", () => {
  const missingOwners = AUDITED_UW_SEATTLE_SCIENCE_HEALTH_OWNER_IDS.filter((planId) => {
    try {
      getRequiredPlan(planId);
      return false;
    } catch {
      return true;
    }
  });

  assert.deepEqual(missingOwners, []);
});

diagnosticTest("Biology should expose official BA/BS route choices instead of collapsing to one route-less prep list", () => {
  const expectedPathwayLabels = [
    "B.A. route",
    "B.S. Ecology, Evolution, and Conservation option",
    "B.S. General Biology option",
    "B.S. Molecular, Cellular, and Developmental Biology option",
    "B.S. Physiology option",
    "B.S. Plant Biology option",
  ].sort((left, right) => left.localeCompare(right));

  assert.deepEqual(getSourcePathwayLabels("uw-seattle-biology"), expectedPathwayLabels);
  assert.deepEqual(getRuntimePathwayLabels("uw-seattle-biology"), expectedPathwayLabels);
});

diagnosticTest("Biochemistry should preserve math, chemistry, biology, physics, and biochemistry foundations", () => {
  assertParsedCodesInclude(
    "uw-seattle-biochemistry",
    [
      "MATH 124",
      "MATH 125",
      "MATH 126",
      "CHEM 142",
      "CHEM 152",
      "CHEM 162",
      "CHEM 237",
      "CHEM 238",
      "CHEM 239",
      "CHEM 241",
      "CHEM 242",
      "BIOL 180",
      "BIOL 200",
      "PHYS 121",
      "PHYS 122",
      "PHYS 123",
      "BIOC 405",
      "BIOC 406",
      "CHEM 452",
      "CHEM 453",
    ],
    "Biochemistry official requirements list concrete lower-division math, chemistry, biology, physics, and biochemistry courses"
  );
  assertRuntimeGrcCoursesInclude(
    "uw-seattle-biochemistry",
    [
      "MATH& 151",
      "MATH& 152",
      "MATH& 163",
      "CHEM& 161",
      "CHEM& 162",
      "CHEM& 163",
      "CHEM& 261",
      "CHEM& 262",
      "CHEM& 263",
      "BIOL& 211",
      "BIOL& 212",
      "PHYS& 221",
      "PHYS& 222",
      "PHYS& 223",
    ],
    "Biochemistry runtime should carry Green River equivalents for the lower-division foundation"
  );
});

diagnosticTest("Chemistry ACS should keep math, physics, general chemistry, organic chemistry, and lab requirements concrete", () => {
  assertParsedCodesInclude(
    "uw-seattle-chemistry",
    [
      "MATH 124",
      "MATH 125",
      "MATH 126",
      "MATH 307",
      "MATH 308",
      "AMATH 351",
      "AMATH 352",
      "PHYS 121",
      "PHYS 122",
      "PHYS 123",
      "CHEM 142",
      "CHEM 152",
      "CHEM 162",
      "CHEM 237",
      "CHEM 238",
      "CHEM 239",
      "CHEM 241",
      "CHEM 242",
      "CHEM 312",
      "CHEM 317",
      "CHEM 321",
    ],
    "Chemistry ACS source lists calculus, additional math, physics, general chemistry, organic chemistry, and lab courses"
  );
  assertRuntimeGrcCoursesInclude(
    "uw-seattle-chemistry",
    [
      "MATH& 151",
      "MATH& 152",
      "MATH& 163",
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
    ],
    "Chemistry runtime should retain Green River equivalents for ACS lower-division math, chemistry, and physics"
  );
});

diagnosticTest("Astronomy admission and degree requirements should preserve full physics and math sequences", () => {
  assert.ok(
    hasSequenceChoice("uw-seattle-astronomy", [["PHYS 121", "PHYS 122", "PHYS 123"]]),
    `Expected Astronomy to model PHYS 121 > 122 > 123 as a required sequence. Actual sequence groups: ${JSON.stringify(
      getSequencePathSummary("uw-seattle-astronomy")
    )}`
  );
  assert.ok(
    hasSequenceChoice("uw-seattle-astronomy", [
      ["MATH 124", "MATH 125", "MATH 126"],
      ["MATH 134", "MATH 135"],
    ]),
    `Expected Astronomy to model calculus as MATH 124 > 125 > 126 or MATH 134 > 135. Actual sequence groups: ${JSON.stringify(
      getSequencePathSummary("uw-seattle-astronomy")
    )}`
  );
});

diagnosticTest("Physics common requirements should include first-year physics and calculus in parsed and runtime output", () => {
  assertParsedCodesInclude(
    "uw-seattle-physics",
    ["PHYS 121", "PHYS 122", "PHYS 123", "MATH 124", "MATH 125", "MATH 126"],
    "Physics official common requirements list PHYS 121/122/123 and MATH 124/125/126"
  );
  assertRuntimeGrcCoursesInclude(
    "uw-seattle-physics",
    ["PHYS& 221", "PHYS& 222", "PHYS& 223", "MATH& 151", "MATH& 152", "MATH& 163"],
    "Physics transfer runtime should carry Green River equivalents for the common lower-division sequence"
  );
});

diagnosticTest("Statistics should keep admission math, computing, probability, and statistics prep concrete", () => {
  assertParsedCodesInclude(
    "uw-seattle-statistics",
    [
      "MATH 124",
      "MATH 125",
      "MATH 126",
      "MATH 134",
      "MATH 135",
      "MATH 136",
      "CSE 122",
      "CSE 123",
      "STAT 311",
      "STAT 390",
      "STAT 394",
    ],
    "Statistics admissions source lists calculus sequence alternatives, computing, probability, and statistics"
  );
  assertRuntimeGrcCoursesInclude(
    "uw-seattle-statistics",
    ["MATH& 151", "MATH& 152", "MATH& 163", "CS 122", "CS 123", "STAT 390"],
    "Statistics runtime should not start at upper-division math while omitting lower-division admission prep"
  );
});

diagnosticTest("Mathematics should model the WIN 2026 core as concrete standard-or-honors calculus plus required core courses", () => {
  assert.ok(
    hasSequenceChoice("uw-seattle-mathematics", [
      ["MATH 124", "MATH 125", "MATH 126", "MATH 207", "MATH 208"],
      ["MATH 134", "MATH 135", "MATH 136"],
    ]),
    `Expected Mathematics to preserve the current core sequence alternatives. Actual sequence groups: ${JSON.stringify(
      getSequencePathSummary("uw-seattle-mathematics")
    )}`
  );
  assertParsedCodesInclude(
    "uw-seattle-mathematics",
    ["MATH 200", "MATH 224", "MATH 300"],
    "Mathematics current core requires MATH 200, MATH 224, and MATH 300"
  );
});

diagnosticTest("Atmospheric and Climate Science should not collapse math and physics foundations into one choose-one bucket", () => {
  assert.ok(
    hasSequenceChoice("uw-seattle-atmospheric-and-climate-science", [
      ["MATH 124", "MATH 125", "MATH 126"],
      ["MATH 134", "MATH 135", "MATH 136"],
    ]),
    `Expected Atmospheric and Climate Science to preserve calculus sequence alternatives. Actual sequence groups: ${JSON.stringify(
      getSequencePathSummary("uw-seattle-atmospheric-and-climate-science")
    )}`
  );
  assert.ok(
    hasSequenceChoice("uw-seattle-atmospheric-and-climate-science", [
      ["PHYS 121", "PHYS 122", "PHYS 123"],
      ["PHYS 141", "PHYS 142", "PHYS 143"],
    ]),
    `Expected Atmospheric and Climate Science to preserve physics sequence alternatives. Actual sequence groups: ${JSON.stringify(
      getSequencePathSummary("uw-seattle-atmospheric-and-climate-science")
    )}`
  );
  assertParsedCodesInclude(
    "uw-seattle-atmospheric-and-climate-science",
    ["CSE 123"],
    "Atmospheric and Climate Science data-science option lists CSE 123 alongside CSE 143 and CSE 163"
  );
});

diagnosticTest("Aquatic Conservation and Ecology should expose concrete basic-science, statistics, chemistry, and biology prep", () => {
  assertParsedCodesInclude(
    "uw-seattle-aquatic-conservation-and-ecology",
    [
      "MATH 124",
      "MATH 125",
      "QSCI 291",
      "QSCI 292",
      "QSCI 381",
      "STAT 311",
      "CHEM 120",
      "CHEM 142",
      "CHEM 152",
      "CHEM 220",
      "CHEM 223",
      "CHEM 237",
      "OCEAN 295",
      "BIOL 180",
      "BIOL 200",
      "BIOL 220",
      "FISH 270",
    ],
    "ACE official basic science requirements are concrete lower-division courses, not only generic calculus/chemistry/biology labels"
  );
});

diagnosticTest("Environmental Public Health should include the Winter 2026 ENV H 312 core and statistics alternatives", () => {
  assertParsedCodesInclude(
    "uw-seattle-environmental-public-health",
    [
      "ENVH 312",
      "BIOST 310",
      "STAT 220",
      "STAT 311",
      "QSCI 381",
      "BIOL 180",
      "BIOL 200",
      "BIOL 220",
      "PHYS 114",
      "PHYS 117",
      "CHEM 142",
      "CHEM 152",
      "CHEM 220",
    ],
    "Environmental Public Health source lists ENV H 312, statistics alternatives, and supporting science courses"
  );
});

diagnosticTest("Earth and Space Sciences supporting science should preserve required categories instead of a single mixed choose-one", () => {
  assert.ok(
    hasSequenceChoice("uw-seattle-earth-and-space-sciences", [
      ["QSCI 291", "QSCI 292"],
      ["MATH 124", "MATH 125"],
    ]),
    `Expected ESS supporting science to model Q SCI 291 > 292 or MATH 124 > 125. Actual sequence groups: ${JSON.stringify(
      getSequencePathSummary("uw-seattle-earth-and-space-sciences")
    )}`
  );

  const mixedBasicScienceGroups = getParsedGroups("uw-seattle-earth-and-space-sciences").filter(
    (group) => {
      const optionCodes = getGroupOptionCodes(group);
      return (
        optionCodes.includes("CHEM 142") &&
        optionCodes.includes("MATH 124") &&
        optionCodes.includes("PHYS 121")
      );
    }
  );
  assert.deepEqual(
    mixedBasicScienceGroups.map((group) => group.label),
    [],
    "ESS should not merge CHEM, MATH/Q SCI, and PHYS requirements into one choose-one group."
  );
});

diagnosticTest("Food Systems, Nutrition, and Health should materialize Research Methods & Technologies choices", () => {
  const researchGroups = getParsedGroups("uw-seattle-food-systems-nutrition-and-health").filter(
    (group) => /Research Methods|statistics|qualitative methods/i.test(group.label ?? "")
  );
  const researchGroupOptionCodes = uniqueSorted(researchGroups.flatMap(getGroupOptionCodes));

  assert.deepEqual(
    researchGroupOptionCodes,
    [
      "BIOST 310",
      "ENVIR 301",
      "GEOG 425",
      "NUTR 202",
      "QMETH 201",
      "QSCI 381",
      "SOC 300",
      "STAT 220",
      "STAT 221",
      "STAT 290",
      "STAT 311",
    ],
    "Food Systems Research Methods & Technologies should expose the official statistics and qualitative-methods alternatives."
  );
});

diagnosticTest("Marine Biology should retain chemistry, biology, statistics, math, and physics sequence choices", () => {
  assertParsedCodesInclude(
    "uw-seattle-marine-biology",
    [
      "CHEM 120",
      "CHEM 142",
      "CHEM 152",
      "CHEM 223",
      "BIOL 180",
      "BIOL 200",
      "BIOL 220",
      "QSCI 381",
      "STAT 311",
      "QSCI 291",
      "QSCI 292",
      "MATH 124",
      "MATH 125",
      "PHYS 114",
      "PHYS 115",
      "PHYS 121",
      "PHYS 122",
      "OCEAN 285",
      "OCEAN 286",
      "FISH 250",
      "OCEAN 200",
      "OCEAN 201",
      "OCEAN 210",
    ],
    "Marine Biology source lists concrete chemistry, biology, statistics, math, physics, and introductory marine science choices"
  );
  assertRuntimeGrcCoursesInclude(
    "uw-seattle-marine-biology",
    [
      "BIOL& 211",
      "BIOL& 212",
      "BIOL& 213",
      "CHEM& 121",
      "CHEM& 161",
      "CHEM& 162",
      "MATH& 146",
      "MATH& 151",
      "MATH& 152",
      "PHYS& 114",
      "PHYS& 115",
      "PHYS& 154",
      "PHYS& 155",
      "PHYS& 221",
      "PHYS& 222",
    ],
    "Marine Biology runtime should include Green River equivalents for supporting science sequence choices"
  );
});

diagnosticTest("Public Health - Global Health should expose BA/BS pathway options and service-learning sequence logic", () => {
  const expectedPathwayLabels = [
    "Global Health (BA Option)",
    "Global Health (BS Option)",
    "Health Education & Promotion (BA Option)",
    "Nutritional Sciences (BS Option)",
  ].sort((left, right) => left.localeCompare(right));

  assert.deepEqual(getSourcePathwayLabels("uw-seattle-public-health-global-health"), expectedPathwayLabels);
  assert.deepEqual(getRuntimePathwayLabels("uw-seattle-public-health-global-health"), expectedPathwayLabels);
  assert.ok(
    hasSequenceChoice("uw-seattle-public-health-global-health", [
      ["SPH 391", "SPH 392"],
      ["SPH 396"],
    ]),
    `Expected PH-GH service learning to be SPH 391 > 392 or SPH 396. Actual sequence groups: ${JSON.stringify(
      getSequencePathSummary("uw-seattle-public-health-global-health")
    )}`
  );
});

diagnosticTest("Neuroscience should preserve physics and math alternatives as sequence choices", () => {
  assert.ok(
    hasSequenceChoice("uw-seattle-neuroscience", [
      ["PHYS 114", "PHYS 115"],
      ["PHYS 121", "PHYS 122"],
    ]),
    `Expected Neuroscience physics to be PHYS 114 > 115 or PHYS 121 > 122. Actual sequence groups: ${JSON.stringify(
      getSequencePathSummary("uw-seattle-neuroscience")
    )}`
  );
  assert.ok(
    hasSequenceChoice("uw-seattle-neuroscience", [
      ["MATH 124", "MATH 125"],
      ["QSCI 291", "QSCI 292"],
    ]),
    `Expected Neuroscience math to be MATH 124 > 125 or Q SCI 291 > 292. Actual sequence groups: ${JSON.stringify(
      getSequencePathSummary("uw-seattle-neuroscience")
    )}`
  );
});

diagnosticTest("Microbiology should keep physics and math/Q SCI sequences instead of partial single-option rows", () => {
  assert.ok(
    hasSequenceChoice("uw-seattle-microbiology", [
      ["PHYS 114", "PHYS 115"],
      ["PHYS 121", "PHYS 122"],
    ]),
    `Expected Microbiology physics to include algebra-based and calculus-based sequence alternatives. Actual sequence groups: ${JSON.stringify(
      getSequencePathSummary("uw-seattle-microbiology")
    )}`
  );
  assert.ok(
    hasSequenceChoice("uw-seattle-microbiology", [
      ["MATH 124", "MATH 125", "MATH 126"],
      ["QSCI 291", "QSCI 292", "QSCI 381"],
    ]),
    `Expected Microbiology math/statistics to model MATH 124 > 125 > 126 or Q SCI 291 > 292 > 381. Actual sequence groups: ${JSON.stringify(
      getSequencePathSummary("uw-seattle-microbiology")
    )}`
  );
});

diagnosticTest("SEFS/ESRM requirements should not merge biology, chemistry, and earth-systems rows into one option group", () => {
  const mixedGroups = getParsedGroups(
    "uw-seattle-environmental-science-and-terrestrial-resource-management"
  ).filter((group) => {
    const optionCodes = getGroupOptionCodes(group);
    return (
      /Biology|Chemistry/i.test(group.label ?? "") &&
      optionCodes.includes("BIOL 180") &&
      optionCodes.includes("CHEM 142") &&
      optionCodes.includes("ESS 212")
    );
  });

  assert.deepEqual(
    mixedGroups.map((group) => group.label),
    [],
    "ESRM Biology/Chemistry/Earth Systems source rows should remain separate requirement groups."
  );
});

diagnosticTest("Sustainable Bioresource Systems Engineering should carry the anchored catalog source and full calculus sequence", () => {
  const primarySource = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-sustainable-bioresource-systems-engineering",
    null
  );
  const manifestUrls = getTransferPlannerSourceManifestEntriesForPlan(
    "uw-seattle-sustainable-bioresource-systems-engineering",
    null
  ).map((entry) => entry.url);

  assert.ok(
    primarySource?.url === SBSE_CATALOG_URL || manifestUrls.includes(SBSE_CATALOG_URL),
    `Expected SBSE owner sources to include anchored catalog source ${SBSE_CATALOG_URL}. Actual primary=${
      primarySource?.url ?? "none"
    }; manifest=${manifestUrls.join(", ")}`
  );
  assert.ok(
    hasSequenceChoice("uw-seattle-sustainable-bioresource-systems-engineering", [
      ["MATH 124", "MATH 125", "MATH 126"],
      ["MATH 134", "MATH 135", "MATH 136"],
    ]),
    `Expected SBSE calculus to preserve MATH 124 > 125 > 126 or MATH 134 > 135 > 136. Actual sequence groups: ${JSON.stringify(
      getSequencePathSummary("uw-seattle-sustainable-bioresource-systems-engineering")
    )}`
  );
});
