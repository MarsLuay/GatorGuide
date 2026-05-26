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

const sourceRegistry = require("../../constants/transfer-planner-source");
const studentRuntime = require("../../constants/transfer-planner-source/student-runtime");

function normalizeCourseCode(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizePathwayId(value) {
  return String(value ?? "").trim().toLowerCase();
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function getParsedUwCourseCodes(planId, pathwayId = null) {
  const blocks =
    sourceRegistry.getTransferPlannerParsedRequirementSourceBlocks(planId, pathwayId) ?? [];
  return uniqueSorted(
    blocks.flatMap((block) => block.parsedUwCourseCodes ?? []).map(normalizeCourseCode)
  );
}

function getRuntimeGrcCourseLabels(planId, pathwayId = null) {
  const runtimePlan = studentRuntime.resolveTransferPlannerMajorPlan(
    studentRuntime.getTransferPlannerMajorPlan(planId),
    pathwayId
  );
  return uniqueSorted(
    (runtimePlan ? studentRuntime.getTransferPlannerGrcCourseList(runtimePlan) : []).map(
      normalizeCourseCode
    )
  );
}

function getRuntimeRequirementText(planId, pathwayId = null) {
  const runtimePlan = studentRuntime.resolveTransferPlannerMajorPlan(
    studentRuntime.getTransferPlannerMajorPlan(planId),
    pathwayId
  );
  if (!runtimePlan) return "";

  const checklistItems = [
    ...(runtimePlan.applicationChecklist ?? []),
    ...(runtimePlan.beforeEnrollmentChecklist ?? []),
    ...(runtimePlan.stayAtGrcChecklist ?? []),
  ];
  const groups = [
    ...(runtimePlan.requirementGroups ?? []),
    ...checklistItems.map((item) => item.requirementGroup).filter(Boolean),
  ];
  return JSON.stringify({ checklistItems, groups }).toUpperCase();
}

function getRegisteredPathwayIds(planId) {
  return uniqueSorted(
    [
      ...(sourceRegistry.getTransferPlannerPathwaysForPlan(planId) ?? []),
      ...(studentRuntime.getTransferPlannerStudentRuntimePathwaysForPlan(planId) ?? []),
    ].map((pathway) => normalizePathwayId(pathway.id))
  );
}

function assertIncludesAll(actualValues, expectedValues, label) {
  const actual = new Set(actualValues.map(normalizeCourseCode));
  const missing = expectedValues
    .map(normalizeCourseCode)
    .filter((expected) => !actual.has(expected));
  assert.deepEqual(missing, [], `${label} missing expected value(s): ${missing.join(", ")}`);
}

function assertExcludesAll(actualValues, forbiddenValues, label) {
  const actual = new Set(actualValues.map(normalizeCourseCode));
  const present = forbiddenValues
    .map(normalizeCourseCode)
    .filter((forbidden) => actual.has(forbidden));
  assert.deepEqual(present, [], `${label} included forbidden value(s): ${present.join(", ")}`);
}

function assertRuntimeTextExcludes(planId, pathwayId, forbiddenSnippets, label) {
  const text = getRuntimeRequirementText(planId, pathwayId);
  const present = forbiddenSnippets
    .map((snippet) => String(snippet).toUpperCase())
    .filter((snippet) => text.includes(snippet));
  assert.deepEqual(present, [], `${label} leaked forbidden runtime text: ${present.join(", ")}`);
}

const PATHWAY_EXPECTATIONS = [
  {
    owner: "Geography",
    planId: "uw-seattle-geography",
    expectedPathwayIds: [
      "ba-option-family:data-science",
      "citizenship-and-migration-track",
      "economy-and-sustainability-track",
      "health-and-development-track",
      "mapping-and-society-track",
    ],
  },
  {
    owner: "Economics",
    planId: "uw-seattle-economics",
    expectedPathwayIds: [
      "ba-option-family:international-economics",
      "bs-option-family:data-science",
      "bs-option-family:financial-economics",
      "bs-option-family:strategy",
    ],
  },
  {
    owner: "Political Science",
    planId: "uw-seattle-political-science",
    expectedPathwayIds: ["international-security-option", "political-economy-option"],
  },
  {
    owner: "Psychology",
    planId: "uw-seattle-psychology",
    expectedPathwayIds: ["ba-route", "bs-route"],
  },
  {
    owner: "Anthropology",
    planId: "uw-seattle-anthropology",
    expectedPathwayIds: [
      "ba-option-family:anthropology-of-globalization",
      "ba-option-family:archaeological-sciences",
      "ba-option-family:human-evolutionary-biology",
      "ba-option-family:indigenous-archaeology",
      "ba-option-family:medical-anthropology-and-global-health",
      "bs-option-family:archaeological-sciences",
      "bs-option-family:human-evolutionary-biology",
      "bs-option-family:medical-anthropology-and-global-health",
    ],
  },
  {
    owner: "American Ethnic Studies",
    planId: "uw-seattle-american-ethnic-studies",
    expectedPathwayIds: [
      "african-american-studies-concentration",
      "asian-american-pia-studies-concentration",
      "chicano-a-studies-concentration",
      "comparative-american-ethnic-studies-concentration",
    ],
  },
  {
    owner: "Asian Studies / JSIS",
    planId: "uw-seattle-asian-studies",
    expectedPathwayIds: [
      "china-concentration",
      "japan-concentration",
      "korea-concentration",
      "south-asia-concentration",
      "southeast-asia-concentration",
    ],
  },
  {
    owner: "Education Studies",
    planId: "uw-seattle-education-studies",
    expectedPathwayIds: [
      "ba-option-family:early-childhood-studies",
      "ba-option-family:education-research-and-policy",
      "ba-option-family:foundations-of-teaching",
      "ba-option-family:multilingual-language-in-education",
      "ba-option-family:sports-and-education",
      "ba-option-family:wellness-and-social-emotional-learning",
    ],
  },
  {
    owner: "Informatics",
    planId: "uw-seattle-informatics",
    expectedPathwayIds: ["biomedical-and-health-informatics-option", "data-science-option"],
  },
];

const PARSER_EXPECTATIONS = [
  {
    owner: "Geography BA methods and support pages",
    planId: "uw-seattle-geography",
    expectedParsedCodes: ["GEOG 315", "GEOG 317", "GEOG 326", "GEOG 425", "GEOG 426"],
    expectedRuntimeGrcCourses: ["GEOG& 100", "GEOG 123", "GEOG& 200", "GEOG 201"],
  },
  {
    owner: "Anthropology undergraduate core and MAGH option",
    planId: "uw-seattle-anthropology",
    expectedRuntimeGrcCourses: ["ANTH& 204", "ANTH& 205", "ANTH& 206", "MATH& 146"],
    expectedPathwayParsedCodes: {
      "ba-option-family:medical-anthropology-and-global-health": ["ANTH 215"],
      "bs-option-family:medical-anthropology-and-global-health": ["ANTH 215"],
    },
  },
  {
    owner: "Sociology introductory transfer path",
    planId: "uw-seattle-sociology",
    expectedRuntimeGrcCourses: ["SOC& 101", "SOC& 201", "MATH& 146"],
  },
  {
    owner: "Social Welfare admission prerequisites",
    planId: "uw-seattle-social-welfare",
    expectedRuntimeGrcCourses: ["PSYC& 100", "SOC& 101", "MATH& 146"],
  },
  {
    owner: "Education, Communities & Organizations",
    planId: "uw-seattle-education-communities-and-organizations",
    expectedParsedCodes: [
      "EDUC 280",
      "EDUC 251",
      "EDUC 370",
      "EDPSY 302",
      "EDPSY 380",
      "EDPSY 404",
      "EDUC 472",
      "EDUC 473",
      "EDUC 460",
      "EDUC 481",
      "EDUC 482",
      "EDUC 483",
    ],
  },
  {
    owner: "Informatics core curriculum",
    planId: "uw-seattle-informatics",
    expectedParsedCodes: [
      "INFO 200",
      "INFO 201",
      "INFO 290",
      "INFO 300",
      "INFO 330",
      "INFO 340",
      "INFO 360",
      "INFO 380",
      "INFO 490",
      "INFO 491",
    ],
    expectedPathwayParsedCodes: {
      "data-science-option": ["INFO 370", "INFO 371", "INFO 430", "INFO 474"],
      "biomedical-and-health-informatics-option": [
        "BIME 300",
        "BIME 435",
        "INFO 468",
        "INFO 478",
      ],
    },
  },
  {
    owner: "Community, Environment & Planning undergraduate section",
    planId: "uw-seattle-community-environment-and-planning",
    expectedParsedCodes: [
      "CEP 200",
      "CEP 300",
      "CEP 301",
      "CEP 302",
      "CEP 303",
      "CEP 400",
      "CEP 446",
      "CEP 460",
      "CEP 461",
      "CEP 462",
      "CEP 490",
      "CEP 491",
    ],
  },
  {
    owner: "Law, Societies & Justice approved course list",
    planId: "uw-seattle-law-societies-and-justice",
    expectedParsedCodes: [
      "LSJ 300",
      "LSJ 320",
      "LSJ 321",
      "LSJ 329",
      "LSJ 401",
      "LSJ 410",
      "LSJ 490",
      "LSJ 491",
    ],
  },
];

const SCOPE_LEAKAGE_EXPECTATIONS = [
  {
    owner: "Anthropology",
    planId: "uw-seattle-anthropology",
    forbiddenParsedCodes: ["ANTH 550", "ANTH 600", "ANTH 700", "ANTH 800", "ARCHY 510"],
    forbiddenRuntimeSnippets: ["ANTH 550", "ANTH 800", "ARCHY 510"],
  },
  {
    owner: "Education Studies",
    planId: "uw-seattle-education-studies",
    forbiddenParsedCodes: ["ACCTG 560", "EDC&I 503", "EDLPS 520", "EDLPS 601"],
    forbiddenRuntimeSnippets: ["ACCTG 560", "EDC&I 503", "EDLPS 520", "EDLPS 601"],
  },
  {
    owner: "Community, Environment & Planning",
    planId: "uw-seattle-community-environment-and-planning",
    forbiddenParsedCodes: ["IPM 500", "IPM 501", "IPM 506", "URBAN 526", "URBAN 598"],
    forbiddenRuntimeSnippets: ["IPM 506", "URBAN 526", "URBAN 598"],
  },
  {
    owner: "Gender, Women & Sexuality Studies",
    planId: "uw-seattle-gender-women-and-sexuality-studies",
    forbiddenParsedCodes: ["GWSS 501", "GWSS 502", "GWSS 503", "GWSS 504", "GWSS 700", "GWSS 701"],
    forbiddenRuntimeSnippets: ["GWSS 700", "GWSS 701"],
  },
  {
    owner: "Public Service & Policy",
    planId: "uw-seattle-public-service-and-policy",
    forbiddenParsedCodes: ["PUBPOL 511", "PUBPOL 512", "PUBPOL 608", "PUBPOL 615"],
    forbiddenRuntimeSnippets: ["PUBPOL 511", "PUBPOL 512", "PUBPOL 608", "PUBPOL 615"],
  },
  {
    owner: "Social Welfare",
    planId: "uw-seattle-social-welfare",
    forbiddenParsedCodes: ["SOCW 500", "SOCW 501", "SOCW 524", "SOCW 550", "SOCW 598"],
    forbiddenRuntimeSnippets: ["SOCW 500", "SOCW 501", "SOCW 550", "SOCW 598"],
  },
];

for (const fixture of PATHWAY_EXPECTATIONS) {
  test(`diagnostic: ${fixture.owner} exposes all current UW Seattle pathways`, () => {
    const actualPathwayIds = getRegisteredPathwayIds(fixture.planId);
    const missing = fixture.expectedPathwayIds
      .map(normalizePathwayId)
      .filter((expected) => !actualPathwayIds.includes(expected));

    assert.deepEqual(
      missing,
      [],
      `${fixture.planId} missing expected pathway id(s): ${missing.join(", ")}`
    );
  });
}

for (const fixture of PARSER_EXPECTATIONS) {
  test(`diagnostic: ${fixture.owner} parser/runtime coverage matches official undergraduate requirements`, () => {
    if (fixture.expectedParsedCodes) {
      assertIncludesAll(
        getParsedUwCourseCodes(fixture.planId),
        fixture.expectedParsedCodes,
        `${fixture.planId} parsed UW courses`
      );
    }

    if (fixture.expectedRuntimeGrcCourses) {
      assertIncludesAll(
        getRuntimeGrcCourseLabels(fixture.planId),
        fixture.expectedRuntimeGrcCourses,
        `${fixture.planId} runtime Green River courses`
      );
    }

    for (const [pathwayId, expectedCodes] of Object.entries(
      fixture.expectedPathwayParsedCodes ?? {}
    )) {
      assertIncludesAll(
        getParsedUwCourseCodes(fixture.planId, pathwayId),
        expectedCodes,
        `${fixture.planId} ${pathwayId} parsed UW courses`
      );
    }
  });
}

for (const fixture of SCOPE_LEAKAGE_EXPECTATIONS) {
  test(`diagnostic: ${fixture.owner} undergraduate planner excludes sibling graduate requirements`, () => {
    assertExcludesAll(
      getParsedUwCourseCodes(fixture.planId),
      fixture.forbiddenParsedCodes,
      `${fixture.planId} parsed UW courses`
    );
    assertRuntimeTextExcludes(
      fixture.planId,
      null,
      fixture.forbiddenRuntimeSnippets,
      `${fixture.planId} runtime requirements`
    );
  });
}
