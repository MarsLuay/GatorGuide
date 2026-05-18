const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const discovery = require("./discover-transfer-planner-primary-sources.cjs");
const parser = require("./parse-transfer-planner-requirement-sources.cjs");
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
const planner = require("../../services/planning/transfer-planner.service");
const programApprovedFilters = require("../../constants/transfer-planner-source/program-approved-course-filters");
const {
  isSuspiciousStructuralPathwayId,
  isSuspiciousStructuralPathwayLabel,
  materializeTransferPlannerPathways,
} = require("../../constants/transfer-planner-source/pathway-materialization");
const {
  normalizeTransferPlannerCourseCode,
} = require("../../constants/transfer-planner-source/course-code-normalization");
const {
  labelMentionsDifferentTransferPlannerMajor,
} = require("../../constants/transfer-planner-source/pathway-title-normalization");

const SBSE_PLAN_ID = "uw-seattle-sustainable-bioresource-systems-engineering";
const SBSE_CATALOG_URL =
  "https://www.washington.edu/students/gencat/program/S/SchoolofEnvironmentalandForestScience-1069.html#program-UG-SBSE-MAJOR";
const SBSE_CATALOG_BASE_URL =
  "https://www.washington.edu/students/gencat/program/S/SchoolofEnvironmentalandForestScience-1069.html";

function normalizeComparableUrl(value) {
  try {
    return new URL(String(value ?? "")).href;
  } catch {
    return String(value ?? "");
  }
}

function includesExactUrl(urls, expectedUrl) {
  const normalizedExpectedUrl = normalizeComparableUrl(expectedUrl);
  return (urls ?? []).some((url) => normalizeComparableUrl(url) === normalizedExpectedUrl);
}

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

const REQUIRED_COMPOUND_EQUIVALENCY_PATHS = [
  { uwTarget: "CHEM 152", sourceSet: ["CHEM& 162", "CHEM& 163"] },
  { uwTarget: "CHEM 162", sourceSet: ["CHEM& 162", "CHEM& 163"] },
  { uwTarget: "BIOL 180", sourceSet: ["BIOL& 211", "BIOL& 212", "BIOL& 213"] },
  { uwTarget: "BIOL 200", sourceSet: ["BIOL& 211", "BIOL& 212", "BIOL& 213"] },
  { uwTarget: "BIOL 220", sourceSet: ["BIOL& 211", "BIOL& 212", "BIOL& 213"] },
  { uwTarget: "PHYS 114", sourceSet: ["PHYS& 114", "PHYS& 154"] },
  { uwTarget: "PHYS 115", sourceSet: ["PHYS& 115", "PHYS& 155"] },
  { uwTarget: "PHYS 116", sourceSet: ["PHYS& 116", "PHYS& 156"] },
  { uwTarget: "CHEM 241", sourceSet: ["CHEM& 261", "CHEM& 262"] },
  { uwTarget: "CHEM 242", sourceSet: ["CHEM& 261", "CHEM& 262", "CHEM& 263"] },
];

function normalizeTestCourseCode(value) {
  return normalizeTransferPlannerCourseCode(String(value ?? ""));
}

function buildSbseTarget(overrides = {}) {
  return discovery.buildOwnerTargetRecord({
    analysisMode: "missing-primary",
    ownerType: "major",
    ownerKey: SBSE_PLAN_ID,
    planId: SBSE_PLAN_ID,
    pathwayId: null,
    campusId: "uw-seattle",
    title: "Sustainable Bioresource Systems Engineering",
    label: "Sustainable Bioresource Systems Engineering",
    officialLinks: [],
    existingPrimary: null,
    pathwayCount: 1,
    ...overrides,
  });
}

function buildParsedSourceScopeFixture({
  sourceRole,
  url = "https://example.edu/requirements",
  label = "Requirement source",
  courseCodes = ["CHEM 142", "BIOL 180"],
  snapshotLines = null,
  headings = [label],
  planId = "uw-seattle-scope-fixture-engineering",
  pathwayId = null,
  ownerId = null,
  ownerTitle = "Scope Fixture Engineering",
  parserType = "generic-html",
}) {
  const fixtureOwnerId = ownerId ?? `scope-fixture:${sourceRole}`;
  const lines =
    snapshotLines ??
    [`${label}: ${courseCodes.join(", ")} are listed for this source.`];
  const baseResult = {
    ownerId: fixtureOwnerId,
    ownerTitle,
    planId,
    pathwayId,
    campusId: "uw-seattle",
    primaryParserType: parserType,
    primarySourceUrl: url,
    primarySourceLabel: label,
    structuredUwCourseCodes: [],
  };
  const entry = {
    ownerTitle: baseResult.ownerTitle,
    planId: baseResult.planId,
    pathwayId: baseResult.pathwayId,
    campusId: baseResult.campusId,
    url,
    label,
    role: "other",
    parserType,
  };
  const parsed = {
    title: label,
    headings,
    requirementCueLines: lines,
    chooseStatements: [],
    pathwayLabels: [],
    courseCodes,
    snapshotLines: lines,
    snapshotPath: `${fixtureOwnerId}.snapshot.txt`,
    parseConfidence: "medium",
    resolvedSourceUrl: url,
    resolvedSourceLabel: label,
    resolvedParserType: parserType,
    sourceRole,
    sourceSectionAudit: null,
  };

  return parser.buildManifestParseSuccessForTest(
    baseResult,
    [],
    entry,
    parsed,
    "primary-source"
  );
}

function getChecklistItems(plan) {
  return [
    ...(plan?.applicationChecklist ?? []),
    ...(plan?.beforeEnrollmentChecklist ?? []),
    ...(plan?.stayAtGrcChecklist ?? []),
  ];
}

function getGeneratedRequirementGroups(plan) {
  return [
    ...(plan?.requirementGroups ?? []),
    ...getChecklistItems(plan)
      .map((item) => item.requirementGroup)
      .filter(Boolean),
  ];
}

function getSourceGeneratedRequirementGroups(planId, pathwayId = null) {
  return getGeneratedRequirementGroups(
    sourceRegistry.resolveTransferPlannerMajorPlan(
      sourceRegistry.getTransferPlannerSourceGeneratedMajorPlan(planId),
      pathwayId
    )
  );
}

function getCompactRuntimeRequirementGroups(planId, pathwayId = null) {
  return getGeneratedRequirementGroups(
    studentRuntime.resolveTransferPlannerMajorPlan(
      studentRuntime.getTransferPlannerMajorPlan(planId),
      pathwayId
    )
  );
}

test("PDF checklist extraction preserves two-column numbered sections", () => {
  const ordered = parser.orderPdfLineSegmentsForTest([
    { text: "1) Mathematics (MATH)", x: 40, y: 700 },
    { text: "6) Biochemistry (BIOC)", x: 320, y: 700 },
    { text: "Regular or Honors Calculus", x: 52, y: 680 },
    { text: "ï‚¨ 405 (3)", x: 332, y: 680 },
    { text: "ï‚¨ 124 (5)", x: 52, y: 660 },
    { text: "ï‚¨ 406 (3)", x: 332, y: 660 },
    { text: "ï‚¨ 125 (5)", x: 52, y: 640 },
    { text: "7) Physical Chemistry (CHEM)", x: 320, y: 640 },
    { text: "ï‚¨ 126 (5)", x: 52, y: 620 },
    { text: "ï‚¨ 452 (3)", x: 332, y: 620 },
    { text: "2) General Chemistry (CHEM)", x: 40, y: 600 },
    { text: "ï‚¨ 453 (3)", x: 332, y: 600 },
    { text: "ï‚¨ 142 (5) ï‚¨ 145 (5) ï‚¨ 143 (6)", x: 52, y: 580 },
    { text: "8) Science Electives", x: 320, y: 580 },
  ]).map((segment) => segment.text);

  assert.deepEqual(ordered.slice(0, 7), [
    "1) Mathematics (MATH)",
    "Regular or Honors Calculus",
    "ï‚¨ 124 (5)",
    "ï‚¨ 125 (5)",
    "ï‚¨ 126 (5)",
    "2) General Chemistry (CHEM)",
    "ï‚¨ 142 (5) ï‚¨ 145 (5) ï‚¨ 143 (6)",
  ]);
  assert.deepEqual(ordered.slice(7), [
    "6) Biochemistry (BIOC)",
    "ï‚¨ 405 (3)",
    "ï‚¨ 406 (3)",
    "7) Physical Chemistry (CHEM)",
    "ï‚¨ 452 (3)",
    "ï‚¨ 453 (3)",
    "8) Science Electives",
  ]);
});

test("PDF checklist parser carries numbered subject headings into bare course rows", () => {
  const entry = {
    parserType: "pdf-degree-sheet",
    label: "BA Biochemistry Checklist",
    url: "https://example.edu/biochemistry-checklist.pdf",
  };
  const codes = parser.extractCourseCodesFromLinesForTest(
    [
      "1) Mathematics (MATH)",
      "Regular or Honors Calculus",
      "ï‚¨ 124 (5)",
      "ï‚¨ 134 (5)",
      "ï‚¨ 125 (5)",
      "ï‚¨ 135 (5)",
      "ï‚¨ 126 (5)",
      "ï‚¨ 136 (5)",
      "3) Organic Chemistry (CHEM)",
      "Regular or Honors",
      "ï‚¨ 237 (4)",
      "ï‚¨ 335 (4)",
      "ï‚¨ 238 (4)",
      "ï‚¨ 336 (4)",
      "Laboratory",
      "ï‚¨ 241 (3)",
      "ï‚¨ 346 (3)",
    ],
    [],
    entry
  );

  assert.ok(codes.includes("MATH 124"));
  assert.ok(codes.includes("MATH 134"));
  assert.ok(codes.includes("CHEM 237"));
  assert.ok(codes.includes("CHEM 346"));
  assert.ok(!codes.includes("CHEM 124"));
});

test("PDF checklist parser materializes regular honors and accelerated sequence columns", () => {
  const entry = {
    parserType: "pdf-degree-sheet",
    label: "BA Biochemistry Checklist",
    url: "https://example.edu/biochemistry-checklist.pdf",
  };
  const snapshotLines = [
    "1) Mathematics (MATH)",
    "Regular or Honors Calculus",
    "ï‚¨ 124 (5)",
    "ï‚¨ 134 (5)",
    "ï‚¨ 125 (5)",
    "ï‚¨ 135 (5)",
    "ï‚¨ 126 (5)",
    "ï‚¨ 136 (5)",
    "2) General Chemistry (CHEM)",
    "Regular or Honors or Accelerated",
    "ï‚¨ 142 (5) ï‚¨ 145 (5) ï‚¨ 143 (6)",
    "ï‚¨ 152 (5) ï‚¨ 155 (5) ï‚¨ 153 (6)",
    "ï‚¨ 162 (5) ï‚¨ 165 (5)",
    "3) Organic Chemistry (CHEM)",
    "Regular or Honors",
    "ï‚¨ 237 (4)",
    "ï‚¨ 335 (4)",
    "ï‚¨ 238 (4)",
    "ï‚¨ 336 (4)",
    "ï‚¨ 239 (4)",
    "ï‚¨ 337 (4)",
  ];
  const groups = parser.buildParsedRequirementGroupsForTest(
    {
      ownerId: "uw-seattle-biochemistry",
      sourceRole: "primary-degree-requirements",
      sourceUrl: entry.url,
    },
    parser.extractCourseCodesFromLinesForTest(snapshotLines, [], entry),
    snapshotLines
  );
  const sequenceGroups = groups.filter((group) => group.requirementType === "sequence_choice");

  const paths = sequenceGroups.flatMap((group) =>
    group.sequencePaths.map((path) => path.uwCourses.join(">"))
  );

  assert.ok(paths.includes("MATH 124>MATH 125>MATH 126"));
  assert.ok(paths.includes("MATH 134>MATH 135>MATH 136"));
  assert.ok(paths.includes("CHEM 142>CHEM 152>CHEM 162"));
  assert.ok(paths.includes("CHEM 145>CHEM 155>CHEM 165"));
  assert.ok(paths.includes("CHEM 143>CHEM 153"));
  assert.ok(paths.some((path) => path.startsWith("CHEM 237>CHEM 238>CHEM 239")));
  assert.ok(paths.some((path) => path.startsWith("CHEM 335>CHEM 336>CHEM 337")));
});

function getCompactRuntimePlan(planId, pathwayId = null) {
  return studentRuntime.resolveTransferPlannerMajorPlan(
    studentRuntime.getTransferPlannerMajorPlan(planId),
    pathwayId
  );
}

function buildQuarterPlanForTest(plan, options = {}) {
  const completedCourses = options.completedCourses ?? [];
  return planner.buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: planner.buildRequirementStatuses(
      plan?.applicationChecklist ?? [],
      completedCourses
    ),
    beforeEnrollmentStatuses: planner.buildRequirementStatuses(
      plan?.beforeEnrollmentChecklist ?? [],
      completedCourses
    ),
    stayAtGrcStatuses: planner.buildRequirementStatuses(
      plan?.stayAtGrcChecklist ?? [],
      completedCourses
    ),
    completedCourses,
    track: sourceRegistry.getTransferPlannerTrack(plan?.bestTrackId ?? null),
    plannerCollegeId: options.plannerCollegeId ?? "uw",
    includeStayAtGrcCourses: options.includeStayAtGrcCourses ?? false,
    includeStemPrepCourses: options.includeStemPrepCourses ?? false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: options.selectedRequirementOptionIdsByGroup ?? {},
  });
}

function getCompactParsedRequirementGroups(planId, pathwayId = null) {
  return studentRuntime
    .getTransferPlannerParsedRequirementSourceBlocks(planId, pathwayId)
    .flatMap((block) => block.parsedRequirementGroups ?? []);
}

test("UW General Catalog URLs receive positive official-source scoring without a catalog penalty", () => {
  const catalogScore = discovery.getOfficialPrimaryScore({
    label: "UW General Catalog Sustainable Bioresource Systems Engineering major",
    url: SBSE_CATALOG_BASE_URL,
  });

  assert.ok(catalogScore > 50, `Expected a strong positive catalog score, got ${catalogScore}.`);
});

test("UW General Catalog URLs with a major-specific anchor receive extra score", () => {
  const target = buildSbseTarget();
  const baseCandidate = discovery.scoreCandidate(target, {
    url: SBSE_CATALOG_BASE_URL,
    label: "UW General Catalog Sustainable Bioresource Systems Engineering major",
  });
  const anchoredCandidate = discovery.scoreCandidate(target, {
    url: SBSE_CATALOG_URL,
    label: "UW General Catalog Sustainable Bioresource Systems Engineering major",
  });

  assert.equal(baseCandidate.sourceRole, "official-catalog");
  assert.equal(anchoredCandidate.sourceRole, "official-catalog");
  assert.ok(anchoredCandidate.score > baseCandidate.score);
  assert.ok(
    anchoredCandidate.reasons.includes("official catalog URL includes a major-specific anchor")
  );
});

test("Discovery confidence uses the primary discovery threshold boundary", () => {
  assert.equal(discovery.getDiscoveryConfidenceForTest(11), "low");
  assert.equal(discovery.getDiscoveryConfidenceForTest(12), "medium");
  assert.equal(discovery.getDiscoveryConfidenceForTest(13), "medium");
  assert.equal(discovery.getDiscoveryConfidenceForTest(27), "medium");
  assert.equal(discovery.getDiscoveryConfidenceForTest(28), "high");
});

test("SBSE discovery includes the anchored UW General Catalog source as official-catalog", async () => {
  const inspectedUrls = [];
  const target = buildSbseTarget({
    officialLinks: [
      {
        label: "UW SBSE schedule and major requirements",
        url: "https://sefs.uw.edu/students/undergraduate/sbse-major/requirements/",
      },
    ],
  });

  const result = await discovery.analyzeOwner(target, 1000, {
    inspectPageImpl: async (url) => {
      inspectedUrls.push(url);
      return {
        url,
        ok: true,
        status: 200,
        finalUrl: url,
        contentType: "text/html",
        title: "Sustainable Bioresource Systems Engineering",
        headings: ["Sustainable Bioresource Systems Engineering"],
        anchors: [],
        error: null,
      };
    },
  });
  const catalogCandidate = result.topCandidates.find((candidate) => candidate.url === SBSE_CATALOG_URL);

  assert.ok(catalogCandidate, `Expected ${SBSE_CATALOG_URL} in top discovery candidates.`);
  assert.equal(catalogCandidate.sourceRole, "official-catalog");
  assert.equal(catalogCandidate.discoveryDepth, 0);
  assert.ok(result.sourceDiscoveryAuditLines.some((line) => line.includes(SBSE_CATALOG_URL)));
  assert.ok(inspectedUrls.includes(SBSE_CATALOG_URL));
});

test("Catalog parser isolates the requested SBSE anchor section and excludes neighboring programs", () => {
  const fixtureHtml = `
    <h3 id="program-UG-ESRM-MAJOR">Program of Study: Major: Environmental Science and Terrestrial Resource Management</h3>
    <div id="program-UG-ESRM-MAJOR-block">
      <p>Major Requirements: ESRM 200, ESRM 323, ESRM 400.</p>
    </div>
    <h3 id="program-UG-SBSE-MAJOR">Program of Study: Major: Sustainable Bioresource Systems Engineering</h3>
    <div id="program-UG-SBSE-MAJOR-block">
      <p>Admission Requirements: CHEM 142, CHEM 152, CHEM 162; MATH 124, MATH 125, MATH 126; PHYS 121.</p>
      <p>Completion Requirements</p>
      <p>Major Requirements: SBSE 391, SBSE 392, SBSE 406, SBSE 410, SBSE 480, SBSE 481.</p>
      <p>Sustainable Bioresource Systems Engineering Electives: Computation and Data Science; Business, Policy, and Economics.</p>
    </div>
    <h3 id="program-UG-ECORES-MINOR">Program of Study: Minor: Ecological Restoration</h3>
    <div id="program-UG-ECORES-MINOR-block">
      <p>Old BSE/minor-only material: BSE 201, ESRM 362, ESRM 463.</p>
    </div>
  `;

  const parsed = parser.parseHtmlSourceFromArtifactsForTest(
    {
      ownerTitle: "Sustainable Bioresource Systems Engineering",
      planId: SBSE_PLAN_ID,
      pathwayId: null,
      url: SBSE_CATALOG_URL,
      label: "UW General Catalog Sustainable Bioresource Systems Engineering major",
      role: "catalog",
      parserType: "catalog-page",
    },
    fixtureHtml
  );
  const parsedCourses = new Set(parsed.courseCodes);
  const scopedText = parsed.snapshotLines.join(" ");

  assert.equal(parsed.sourceRole, "official-catalog");
  assert.equal(parsed.sourceSectionAudit.anchorFound, true);
  assert.equal(parsed.sourceSectionAudit.sectionMatchedSelectedMajor, true);
  assert.match(parsed.sourceSectionAudit.line, /^\[source section audit\]/);
  assert.ok(scopedText.includes("Sustainable Bioresource Systems Engineering"));
  assert.ok(parsedCourses.has("SBSE 391"));
  assert.ok(parsedCourses.has("MATH 124"));
  assert.equal(parsedCourses.has("ESRM 323"), false);
  assert.equal(parsedCourses.has("BSE 201"), false);
  assert.equal(parsedCourses.has("ESRM 362"), false);
  assert.doesNotMatch(scopedText, /Environmental Science and Terrestrial Resource Management/);
  assert.doesNotMatch(scopedText, /Old BSE/);
});

test("Weak-source deeper discovery runs only for low-confidence discovery contexts", async () => {
  const genericLandingUrl = "https://sefs.washington.edu/undergraduate/";
  const requirementsUrl = "https://sefs.washington.edu/undergraduate/requirements/";
  const weakTarget = buildSbseTarget({
    ownerKey: "weak-source-test",
    officialLinks: [{ label: "Undergraduate overview", url: genericLandingUrl }],
  });
  const weakInspectedUrls = [];

  await discovery.analyzeOwner(weakTarget, 1000, {
    inspectPageImpl: async (url) => {
      weakInspectedUrls.push(url);
      return {
        url,
        ok: true,
        status: 200,
        finalUrl: url,
        contentType: "text/html",
        title: url === genericLandingUrl ? "Undergraduate overview" : "Major Requirements",
        headings: url === genericLandingUrl ? ["Undergraduate overview"] : ["Major Requirements"],
        anchors:
          url === genericLandingUrl
            ? [{ url: requirementsUrl, text: "Major Requirements", sourceUrl: genericLandingUrl }]
            : [],
        error: null,
      };
    },
  });

  assert.ok(includesExactUrl(weakInspectedUrls, requirementsUrl));

  const strongTarget = buildSbseTarget({
    analysisMode: "existing-primary",
    ownerKey: "strong-source-test",
    officialLinks: [{ label: "Degree Requirements", url: requirementsUrl }],
    existingPrimary: { label: "Degree Requirements", url: requirementsUrl },
  });
  const strongInspectedUrls = [];

  const strongResult = await discovery.analyzeOwner(strongTarget, 1000, {
    inspectPageImpl: async (url) => {
      strongInspectedUrls.push(url);
      return {
        url,
        ok: true,
        status: 200,
        finalUrl: url,
        contentType: "text/html",
        title: "Sustainable Bioresource Systems Engineering Degree Requirements",
        headings: ["Sustainable Bioresource Systems Engineering Degree Requirements"],
        anchors: [{ url: `${requirementsUrl}sample-plan/`, text: "Sample plan", sourceUrl: url }],
        error: null,
      };
    },
  });

  assert.equal(strongResult.deeperDiscoveryEnabled, false);
  assert.deepEqual(strongInspectedUrls, [requirementsUrl]);
});

test("Allen School approved course lists are classified as support-only approved-course-list sources", () => {
  const target = buildSbseTarget({
    ownerKey: "uw-seattle-computer-engineering",
    planId: "uw-seattle-computer-engineering",
    title: "Computer Engineering",
    label: "Computer Engineering",
  });
  const approvedListUrl =
    "https://www.cs.washington.edu/academics/ugrad/current-students/degree/ce-approved-natural-science/";
  const approvedListLabel = "Allen School approved CE Natural Science course list";
  const candidate = discovery.scoreCandidate(target, {
    url: approvedListUrl,
    label: approvedListLabel,
    pageTitle: "Approved Natural Science Courses for Computer Engineering",
    sourceKind: "official-link",
  });

  assert.equal(candidate.sourceRole, "approved-course-list");
  assert.equal(candidate.sourceRoleStatus, "support");
  assert.equal(candidate.canCreateSchedulableRows, false);
  assert.ok(candidate.score > 0, `Expected support source to retain positive value, got ${candidate.score}.`);
  assert.equal(
    parser.classifyRequirementSourceRole({
      url: approvedListUrl,
      label: approvedListLabel,
      role: "other",
      parserType: "generic-html",
    }),
    "approved-course-list"
  );
  assert.equal(
    parser.classifyRequirementSourceRole({
      url: "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#core",
      label: "Allen School CE-approved Natural Science course list",
      role: "approved-course-list",
      parserType: "generic-html",
    }),
    "approved-course-list"
  );
});

test("ChemE/NME engineering elective lists are classified as support-only elective-list sources", () => {
  const target = buildSbseTarget({
    ownerKey: "uw-seattle-chemical-engineering",
    planId: "uw-seattle-chemical-engineering",
    title: "Chemical Engineering",
    label: "Chemical Engineering",
  });
  const candidate = discovery.scoreCandidate(target, {
    url: "https://www.cheme.washington.edu/undergraduate/engineering-electives",
    label: "ChemE/NME engineering elective list",
    pageTitle: "Chemical Engineering Elective Courses",
    sourceKind: "official-link",
  });

  assert.equal(candidate.sourceRole, "elective-list");
  assert.equal(candidate.sourceRoleStatus, "support");
  assert.equal(candidate.canCreateSchedulableRows, false);
  assert.ok(candidate.score > 0, `Expected elective support source to retain positive value, got ${candidate.score}.`);
});

test("Broad prerequisite and course-list pages are non-schedulable source roles", () => {
  const target = buildSbseTarget({
    ownerKey: "uw-seattle-computer-science",
    planId: "uw-seattle-computer-science",
    title: "Computer Science",
    label: "Computer Science",
  });
  const prerequisiteTable = discovery.scoreCandidate(target, {
    url: "https://www.cs.washington.edu/academics/ugrad/current-students/degree/cse-300-level-prerequisites",
    label: "Allen School CSE 300-level prerequisite table",
    pageTitle: "CSE 300-level prerequisite table",
    sourceKind: "official-link",
  });
  const courseListRole = parser.classifyRequirementSourceRole({
    url: "https://www.example.edu/undergraduate/print/courses",
    label: "Undergraduate course list",
    role: "other",
    parserType: "generic-html",
  });

  assert.equal(prerequisiteTable.sourceRole, "upper-division-prerequisite-table");
  assert.equal(prerequisiteTable.sourceRoleStatus, "non-schedulable");
  assert.equal(prerequisiteTable.canCreateSchedulableRows, false);
  assert.equal(courseListRole, "non-schedulable-course-list");
});

test("Allen School CS discovery separates pathway PDFs from support and non-schedulable broad-page links", async () => {
  const broadUrl = "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/";
  const dataSciencePdfUrl =
    "https://s3-us-west-2.amazonaws.com/www-cse-public/ugrad/curriculum/CS_DS_degreq_fall23.pdf";
  const approvedScienceUrl =
    "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#natural-science";
  const prerequisiteTableUrl =
    "https://www.cs.washington.edu/academics/ugrad/current-students/degree/cse-300-level-prerequisites";
  const policyUrl =
    "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/policy-procedures/continuation-policy/";
  const target = buildSbseTarget({
    ownerType: "pathway",
    ownerKey: "uw-seattle-computer-science:pathway:data-science-option",
    planId: "uw-seattle-computer-science",
    pathwayId: "data-science-option",
    title: "Computer Science",
    label: "Data Science option",
    officialLinks: [{ label: "Allen School degree requirements", url: broadUrl }],
  });

  const result = await discovery.analyzeOwner(target, 1000, {
    inspectPageImpl: async (url) => ({
      url,
      ok: true,
      status: 200,
      finalUrl: url.replace(/#.*/, ""),
      contentType: /\.pdf$/i.test(url) ? "application/pdf" : "text/html",
      title: url === broadUrl ? "Computer Science degree requirements" : "Allen School support",
      headings:
        url === broadUrl
          ? ["Computer Science degree requirements", "Data Science option"]
          : ["Allen School support"],
      anchors:
        url === broadUrl
          ? [
              { url: dataSciencePdfUrl, text: "Data Science Option [PDF]", sourceUrl: url },
              { url: approvedScienceUrl, text: "Approved Natural Science course list", sourceUrl: url },
              { url: prerequisiteTableUrl, text: "CSE 300-level prerequisite table", sourceUrl: url },
              { url: policyUrl, text: "Continuation policy", sourceUrl: url },
            ]
          : [],
      error: null,
    }),
  });
  const candidates = [...(result.topCandidates ?? []), ...(result.supportCandidates ?? [])];
  const byUrl = new Map(candidates.map((candidate) => [candidate.url, candidate]));

  assert.equal(byUrl.get(dataSciencePdfUrl)?.sourceRole, "pathway-degree-sheet");
  assert.equal(byUrl.get(dataSciencePdfUrl)?.canBePrimary, true);
  assert.ok((byUrl.get(dataSciencePdfUrl)?.pathwayIdentityScore ?? 0) > 0);
  assert.equal(byUrl.get(approvedScienceUrl)?.sourceRole, "approved-course-list");
  assert.equal(byUrl.get(approvedScienceUrl)?.supportOnly, true);
  assert.equal(byUrl.get(approvedScienceUrl)?.canBePrimary, false);
  assert.equal(byUrl.get(prerequisiteTableUrl)?.sourceRole, "upper-division-prerequisite-table");
  assert.equal(byUrl.get(prerequisiteTableUrl)?.canCreateSchedulableRows, false);
  assert.equal(byUrl.get(policyUrl)?.sourceRole, "support-source");
  assert.equal(
    parser.classifyRequirementSourceRole({
      url: dataSciencePdfUrl,
      label: "Data Science Option [PDF]",
      parserType: "pdf-degree-sheet",
    }),
    "pathway-degree-sheet"
  );
});

test("Primary degree requirement pages outrank official support lists", () => {
  const target = buildSbseTarget({
    ownerKey: "uw-seattle-computer-engineering",
    planId: "uw-seattle-computer-engineering",
    title: "Computer Engineering",
    label: "Computer Engineering",
  });
  const degreeRequirements = discovery.scoreCandidate(target, {
    url: "https://www.ece.uw.edu/academics/undergrad/degree-requirements/computer-engineering/",
    label: "Computer Engineering degree requirements",
    pageTitle: "Computer Engineering Degree Requirements",
    sourceKind: "official-link",
  });
  const approvedList = discovery.scoreCandidate(target, {
    url: "https://www.cs.washington.edu/academics/ugrad/current-students/degree/ce-approved-natural-science/",
    label: "Allen School approved CE Natural Science course list",
    pageTitle: "Approved Natural Science Courses for Computer Engineering",
    sourceKind: "official-link",
  });

  assert.equal(degreeRequirements.sourceRole, "primary-degree-requirements");
  assert.equal(approvedList.sourceRole, "approved-course-list");
  assert.ok(degreeRequirements.score > approvedList.score);
});

test("Pathway degree sheets can outrank broad department pages for a specific pathway", () => {
  const target = buildSbseTarget({
    ownerKey: "uw-seattle-materials-science-engineering:pathway:nme-option",
    planId: "uw-seattle-materials-science-engineering",
    pathwayId: "nme-option",
    title: "Materials Science and Engineering",
    label: "Nanoscience and Molecular Engineering option",
  });
  const pathwaySheet = discovery.scoreCandidate(target, {
    url: "https://mse.washington.edu/files/nanoscience-and-molecular-engineering-option-degree-sheet.pdf",
    label: "Nanoscience and Molecular Engineering option degree sheet",
    sourceKind: "official-link",
  });
  const broadDepartment = discovery.scoreCandidate(target, {
    url: "https://mse.washington.edu/undergraduate/program",
    label: "Materials Science and Engineering undergraduate program",
    pageTitle: "Materials Science and Engineering Undergraduate Program",
    sourceKind: "official-link",
  });

  assert.equal(pathwaySheet.sourceRole, "pathway-degree-sheet");
  assert.equal(pathwaySheet.sourceRoleStatus, "primary");
  assert.equal(pathwaySheet.canCreateSchedulableRows, true);
  assert.ok(pathwaySheet.score > broadDepartment.score);
});

test("Pathway-ambiguous department pages cannot be high-confidence discoveries", () => {
  const target = buildSbseTarget({
    ownerType: "pathway",
    ownerKey: "uw-seattle-statistics:pathway:data-science-track",
    planId: "uw-seattle-statistics",
    pathwayId: "data-science-track",
    title: "Statistics - Data Science track",
    label: "Data Science track",
  });

  const broadDepartment = discovery.scoreCandidate(target, {
    url: "https://stat.uw.edu/academics/undergraduate/statistics-bs/double-major-and-double-degree",
    label: "Statistics undergraduate program",
    pageTitle: "Statistics BS double major and double degree",
    sourceKind: "official-link",
  });

  assert.equal(broadDepartment.sourceRole, "department-requirements");
  assert.ok(broadDepartment.score >= 28);
  assert.equal(broadDepartment.confidence, "medium");
  assert.ok(
    broadDepartment.reasons.includes("broad department page does not name the selected pathway")
  );
});

test("Graduate-only pages are ignored for undergraduate source discovery", () => {
  const target = buildSbseTarget({
    ownerKey: "uw-seattle-materials-science-engineering",
    planId: "uw-seattle-materials-science-engineering",
    title: "Materials Science & Engineering",
    label: "Materials Science & Engineering",
  });
  const graduateCandidate = discovery.scoreCandidate(target, {
    url: "https://mse.washington.edu/student/applied-masters",
    label: "Master's program students",
    pageTitle: "Applied Master's Program",
    pageHeadings: ["Applied Master's program", "Graduation requirements"],
  });

  assert.equal(graduateCandidate.sourceRole, "ignored");
  assert.equal(graduateCandidate.sourceRoleStatus, "ignored");
  assert.equal(graduateCandidate.canCreateSchedulableRows, false);
  assert.ok(graduateCandidate.score < 0);
});

test("Graduate catalog credential anchors are ignored even on mixed undergraduate pages", () => {
  const target = discovery.buildOwnerTargetRecord({
    analysisMode: "missing-primary",
    ownerType: "major",
    ownerKey: "uw-seattle-biology",
    planId: "uw-seattle-biology",
    pathwayId: null,
    campusId: "uw-seattle",
    title: "Biology",
    label: "Biology",
    officialLinks: [],
    existingPrimary: null,
    pathwayCount: 5,
  });
  const graduateCredential = discovery.scoreCandidate(target, {
    url: "https://www.washington.edu/students/gencat/program/S/Biology-112.html#credential-5b8ed1a9f3739c2e00e026e6",
    label: "Doctor Of Philosophy (Biology)",
    anchorText: "Doctor Of Philosophy (Biology)",
    pageTitle: "Biology",
    pageHeadings: [
      "Bachelor of Science degree with a major in Biology: Physiology",
      "Doctor Of Philosophy (Biology)",
    ],
    sourceKind: "discovered-anchor",
  });

  assert.equal(graduateCredential.sourceRole, "ignored");
  assert.equal(graduateCredential.sourceRoleStatus, "ignored");
  assert.equal(graduateCredential.canCreateSchedulableRows, false);
  assert.ok(graduateCredential.score < 0);
});

test("Official support sources are not downgraded to ignored", () => {
  const target = buildSbseTarget({
    ownerKey: "uw-seattle-environmental-engineering",
    planId: "uw-seattle-environmental-engineering",
    title: "Environmental Engineering",
    label: "Environmental Engineering",
  });
  const supportSource = discovery.scoreCandidate(target, {
    url: "https://cee.uw.edu/academics/undergraduate/advising",
    label: "Environmental Engineering advising support",
    pageTitle: "Environmental Engineering Advising",
    sourceKind: "official-link",
  });

  assert.equal(supportSource.sourceRole, "support-source");
  assert.equal(supportSource.sourceRoleStatus, "support");
  assert.notEqual(supportSource.sourceRole, "ignored");
});

test("Admission prerequisite pages get a support-only admission-prerequisite-source role", () => {
  const target = buildSbseTarget({
    ownerKey: "uw-bothell-business-administration",
    planId: "uw-bothell-business-administration",
    title: "Business Administration",
    label: "Business Administration",
  });
  const admissionPrerequisites = discovery.scoreCandidate(target, {
    url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
    label: "BBA admission prerequisite courses",
    pageTitle: "Admission prerequisite courses",
    sourceKind: "official-link",
  });

  assert.equal(admissionPrerequisites.sourceRole, "admission-prerequisite-source");
  assert.equal(admissionPrerequisites.sourceRoleStatus, "support");
  assert.equal(admissionPrerequisites.canCreateSchedulableRows, false);
});

test("Zero-course overview primaries are weak even when the label contains bachelor wording", () => {
  const signals = discovery.buildWeakExistingPrimarySignals({
    primarySource: {
      label: "UW Bothell Bachelor of Economics overview",
      url: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics",
    },
    parsedBlock: {
      ok: true,
      extractedTitle: "Bachelor of Economics",
      extractedHeadings: ["Bachelor of Economics"],
      parsedUwCourseCodes: [],
      qualitySignals: [],
      requirementCueLines: [],
      chooseStatements: [],
    },
    runtimeGrcCourseCount: 0,
    bestTrackId: null,
    trackRecommendationId: null,
    noPublicClassificationCount: 0,
  });

  assert.equal(signals.triggered, true);
  assert.ok(signals.signals.some((signal) => signal.code === "no-parsed-uw-course-codes"));
  assert.ok(signals.signals.some((signal) => signal.code === "primary-looks-overview-only"));
});

test("Zero-course requirement primaries are weak even without overview wording", () => {
  const signals = discovery.buildWeakExistingPrimarySignals({
    primarySource: {
      label: "RN to BSN degree requirements",
      url: "https://www.uwb.edu/nhs/undergraduate/rn-bsn/requirements",
    },
    parsedBlock: {
      ok: true,
      extractedTitle: "RN to BSN Degree Requirements",
      extractedHeadings: ["RN to BSN Degree Requirements"],
      parsedUwCourseCodes: [],
      qualitySignals: [],
      requirementCueLines: ["Degree Requirements", "Complete the following program requirements."],
      chooseStatements: [],
    },
    runtimeGrcCourseCount: 0,
    bestTrackId: null,
    trackRecommendationId: null,
    noPublicClassificationCount: 0,
  });

  assert.equal(signals.triggered, true);
  assert.ok(signals.signals.some((signal) => signal.code === "no-parsed-uw-course-codes"));
  assert.equal(
    signals.signals.some((signal) => signal.code === "primary-looks-overview-only"),
    false
  );
});

test("Weak overview primaries can promote same-program curriculum child pages", async () => {
  const overviewUrl =
    "https://www.uwb.edu/business/undergraduate/bachelor-of-economics";
  const curriculumUrl =
    "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/curriculum";
  const target = discovery.buildOwnerTargetRecord({
    analysisMode: "weak-existing-primary",
    ownerType: "major",
    ownerKey: "uw-bothell-economics",
    planId: "uw-bothell-economics",
    pathwayId: null,
    campusId: "uw-bothell",
    title: "Economics",
    label: "Economics",
    officialLinks: [
      {
        label: "UW Bothell Bachelor of Economics overview",
        url: overviewUrl,
      },
    ],
    existingPrimary: {
      label: "UW Bothell Bachelor of Economics overview",
      url: overviewUrl,
    },
    reevaluationSignals: [
      {
        code: "no-parsed-uw-course-codes",
        reason: "Parsed source block produced zero UW course codes.",
      },
      {
        code: "primary-looks-overview-only",
        reason: "Current primary is an overview page.",
      },
    ],
    reevaluationContext: {
      parsedUwCourseCodeCount: 0,
      currentSourceLatestYear: null,
    },
    parsedBlock: {
      primarySourceUrl: overviewUrl,
      sourceUrl: overviewUrl,
      extractedTitle: "Bachelor of Economics",
      extractedHeadings: ["Bachelor of Economics"],
      parsedUwCourseCodes: [],
      qualitySignals: [],
    },
    pathwayCount: 0,
  });
  const inspectedUrls = [];

  const result = await discovery.analyzeOwner(target, 1000, {
    inspectPageImpl: async (url) => {
      inspectedUrls.push(url);
      if (url === overviewUrl) {
        return {
          url,
          ok: true,
          status: 200,
          finalUrl: url,
          contentType: "text/html",
          title: "Bachelor of Economics",
          headings: ["Bachelor of Economics"],
          anchors: [{ url: curriculumUrl, text: "Curriculum", sourceUrl: url }],
          error: null,
        };
      }

      return {
        url,
        ok: true,
        status: 200,
        finalUrl: url,
        contentType: "text/html",
        title: "Bachelor of Economics Curriculum",
        headings: ["Bachelor of Economics Curriculum", "Requirements", "Core Courses"],
        anchors: [],
        error: null,
      };
    },
  });

  assert.ok(includesExactUrl(inspectedUrls, curriculumUrl));
  assert.equal(result.suggestedAction, "replace-existing-primary");
  assert.equal(result.suggestedPrimary?.url, curriculumUrl);
  assert.equal(result.suggestedPrimary?.sourceRole, "primary-degree-requirements");
  assert.equal(result.suggestedPrimary?.sourceRoleStatus, "primary");
  assert.equal(result.suggestedPrimary?.parserType, "html-curriculum-page");
  assert.equal(result.suggestedPrimary?.canCreateSchedulableRows, true);
  assert.ok(
    result.suggestedPrimary?.reasons.includes(
      "same-program curriculum child can replace a zero-course overview primary"
    )
  );
});

test("Zero-course primaries can promote same-program sibling requirement pages", () => {
  const overviewUrl = "https://www.uwb.edu/nhs/undergraduate/rn-bsn/overview";
  const requirementUrl = "https://www.uwb.edu/nhs/undergraduate/rn-bsn/degree-requirements";
  const target = discovery.buildOwnerTargetRecord({
    analysisMode: "weak-existing-primary",
    ownerType: "major",
    ownerKey: "uw-bothell-nursing-rn-to-bsn",
    planId: "uw-bothell-nursing-rn-to-bsn",
    pathwayId: null,
    campusId: "uw-bothell",
    title: "Nursing RN to BSN",
    label: "Nursing RN to BSN",
    officialLinks: [{ label: "RN to BSN overview", url: overviewUrl }],
    existingPrimary: { label: "RN to BSN overview", url: overviewUrl },
    reevaluationSignals: [
      {
        code: "no-parsed-uw-course-codes",
        reason: "Parsed source block produced zero UW course codes.",
      },
    ],
    reevaluationContext: {
      parsedUwCourseCodeCount: 0,
      hasStrongRequirementCue: true,
      currentSourceLatestYear: null,
    },
    parsedBlock: {
      primarySourceUrl: overviewUrl,
      sourceUrl: overviewUrl,
      extractedTitle: "RN to BSN Overview",
      extractedHeadings: ["Degree Requirements"],
      requirementCueLines: ["Degree Requirements"],
      parsedUwCourseCodes: [],
      qualitySignals: [],
    },
    pathwayCount: 0,
  });
  const currentInput = {
    url: overviewUrl,
    label: "RN to BSN overview",
    pageTitle: "RN to BSN Overview",
    sourceKind: "official-link",
  };
  const current = { ...currentInput, ...discovery.scoreCandidate(target, currentInput) };
  const requirementInput = {
    url: requirementUrl,
    label: "Degree requirements",
    pageTitle: "RN to BSN Degree Requirements",
    pageHeadings: ["RN to BSN Degree Requirements", "Courses"],
    sourceKind: "discovered-anchor",
  };
  const requirementPage = {
    ...requirementInput,
    ...discovery.scoreCandidate(target, requirementInput),
  };
  const decision = discovery.buildReplacementDecision(target, [current, requirementPage]);

  assert.equal(requirementPage.sourceRole, "primary-degree-requirements");
  assert.ok(
    requirementPage.reasons.includes(
      "same-program requirement source can replace a zero-course primary"
    )
  );
  assert.equal(decision.action, "replace-existing-primary");
  assert.equal(decision.suggestedPrimary?.url, requirementUrl);
});

test("Zero-course primaries can promote linked same-program worksheets", () => {
  const overviewUrl = "https://www.uwb.edu/nhs/undergraduate/rn-bsn/overview";
  const worksheetUrl = "https://admissions.uwb.edu/register/mpw-RN-BSN";
  const target = discovery.buildOwnerTargetRecord({
    analysisMode: "weak-existing-primary",
    ownerType: "major",
    ownerKey: "uw-bothell-nursing-rn-to-bsn",
    planId: "uw-bothell-nursing-rn-to-bsn",
    pathwayId: null,
    campusId: "uw-bothell",
    title: "Nursing RN to BSN",
    label: "Nursing RN to BSN",
    officialLinks: [{ label: "RN to BSN overview", url: overviewUrl }],
    existingPrimary: { label: "RN to BSN overview", url: overviewUrl },
    reevaluationSignals: [
      {
        code: "no-parsed-uw-course-codes",
        reason: "Parsed source block produced zero UW course codes.",
      },
    ],
    reevaluationContext: {
      parsedUwCourseCodeCount: 0,
      hasStrongRequirementCue: true,
      currentSourceLatestYear: null,
    },
    parsedBlock: {
      primarySourceUrl: overviewUrl,
      sourceUrl: overviewUrl,
      extractedTitle: "RN to BSN Overview",
      extractedHeadings: ["Degree Requirements"],
      requirementCueLines: ["Degree Requirements"],
      parsedUwCourseCodes: [],
      qualitySignals: [],
    },
    pathwayCount: 0,
  });
  const currentInput = {
    url: overviewUrl,
    label: "RN to BSN overview",
    pageTitle: "RN to BSN Overview",
    sourceKind: "official-link",
  };
  const current = { ...currentInput, ...discovery.scoreCandidate(target, currentInput) };
  const worksheetInput = {
    url: worksheetUrl,
    label: "Nursing RN to BSN major planning worksheet",
    pageTitle: "Nursing RN to BSN Major Planning Worksheet",
    pageHeadings: ["Nursing RN to BSN Major Planning Worksheet", "Degree Requirements"],
    sourceKind: "discovered-anchor",
  };
  const worksheet = { ...worksheetInput, ...discovery.scoreCandidate(target, worksheetInput) };
  const decision = discovery.buildReplacementDecision(target, [current, worksheet]);

  assert.equal(worksheet.sourceRole, "primary-degree-requirements");
  assert.ok(
    worksheet.reasons.includes(
      "same-program requirement source can replace a zero-course primary"
    )
  );
  assert.equal(decision.action, "replace-existing-primary");
  assert.equal(decision.suggestedPrimary?.url, worksheetUrl);
});

test("Same-program leaf pages without durable requirement identity are review-only", () => {
  const curriculumUrl = "https://www.uwb.edu/stem/undergraduate/majors/biology/curriculum";
  const fhlUrl = "https://www.uwb.edu/stem/undergraduate/majors/biology/fhl";
  const target = discovery.buildOwnerTargetRecord({
    analysisMode: "weak-existing-primary",
    ownerType: "major",
    ownerKey: "uw-bothell-biology",
    planId: "uw-bothell-biology",
    pathwayId: null,
    campusId: "uw-bothell",
    title: "Biology",
    label: "Biology",
    officialLinks: [{ label: "UW Bothell Biology curriculum", url: curriculumUrl }],
    existingPrimary: { label: "UW Bothell Biology curriculum", url: curriculumUrl },
    reevaluationSignals: [
      {
        code: "no-parsed-uw-course-codes",
        reason: "Parsed source block produced zero UW course codes.",
      },
    ],
    reevaluationContext: {
      parsedUwCourseCodeCount: 0,
      hasStrongRequirementCue: true,
      currentSourceLatestYear: null,
    },
    pathwayCount: 0,
  });
  const current = {
    url: curriculumUrl,
    label: "UW Bothell Biology curriculum",
    pageTitle: "Biology curriculum",
    sourceKind: "official-link",
    ...discovery.scoreCandidate(target, {
      url: curriculumUrl,
      label: "UW Bothell Biology curriculum",
      pageTitle: "Biology curriculum",
      sourceKind: "official-link",
    }),
    score: 50,
  };
  const fhlInput = {
    url: fhlUrl,
    label: "Friday Harbor Laboratories",
    pageTitle: "Friday Harbor Laboratories",
    pageHeadings: ["Biology Major Requirements", "Friday Harbor Laboratories"],
    sourceKind: "official-link",
  };
  const fhlCandidate = { ...fhlInput, ...discovery.scoreCandidate(target, fhlInput) };
  const decision = discovery.buildReplacementDecision(target, [current, fhlCandidate]);

  assert.equal(fhlCandidate.confidence, "high");
  assert.equal(fhlCandidate.sourceRole, "primary-degree-requirements");
  assert.equal(discovery.isAutoPromotablePrimaryCandidate(fhlCandidate), false);
  assert.equal(decision.action, "keep-existing-primary");
  assert.equal(decision.reviewCandidate?.url, fhlUrl);
});

test("Tacoma broad overview pages stay out of auto-promotion", () => {
  const target = discovery.buildOwnerTargetRecord({
    analysisMode: "missing-primary",
    ownerType: "major",
    ownerKey: "uw-tacoma-arts-media-culture",
    planId: "uw-tacoma-arts-media-culture",
    pathwayId: null,
    campusId: "uw-tacoma",
    title: "Arts, Media and Culture",
    label: "Arts, Media and Culture",
    officialLinks: [],
    existingPrimary: null,
    pathwayCount: 4,
  });
  const overviewInput = {
    url: "https://www.tacoma.uw.edu/sias/cac/arts-media-culture",
    label: "Arts, Media and Culture major",
    pageTitle: "Arts, Media and Culture",
    pageHeadings: ["Arts, Media and Culture", "Degree Options"],
    sourceKind: "campus-major-index",
  };
  const overview = { ...overviewInput, ...discovery.scoreCandidate(target, overviewInput) };

  assert.equal(overview.confidence, "high");
  assert.equal(overview.sourceRole, "department-requirements");
  assert.equal(discovery.isAutoPromotablePrimaryCandidate(overview), false);
});

test("Durable Bothell Electrical Engineering worksheets remain auto-promotable", () => {
  const target = discovery.buildOwnerTargetRecord({
    analysisMode: "missing-primary",
    ownerType: "major",
    ownerKey: "uw-bothell-electrical-engineering",
    planId: "uw-bothell-electrical-engineering",
    pathwayId: null,
    campusId: "uw-bothell",
    title: "Electrical Engineering",
    label: "Electrical Engineering",
    officialLinks: [],
    existingPrimary: null,
    pathwayCount: 0,
  });
  const worksheetInput = {
    url: "https://www.uwb.edu/stem/undergraduate/majors/electrical-engineering/electrical-engineering-major-planning-worksheet.pdf",
    label: "Electrical Engineering major planning worksheet",
    pageTitle: "Electrical Engineering Major Planning Worksheet",
    sourceKind: "official-link",
  };
  const worksheet = { ...worksheetInput, ...discovery.scoreCandidate(target, worksheetInput) };

  assert.equal(worksheet.confidence, "high");
  assert.equal(worksheet.sourceRole, "primary-degree-requirements");
  assert.equal(discovery.isAutoPromotablePrimaryCandidate(worksheet), true);
});

test("Auto-promotion rejects explicit different-major catalog anchors", () => {
  assert.equal(
    discovery.isAutoPromotablePrimaryCandidate({
      ownerTitle: "Computer Engineering - Cybersecurity Option",
      planId: "uw-tacoma-computer-engineering",
      pathwayId: "cybersecurity-option",
      url: "https://www.washington.edu/students/gencat/program/T/SchoolofEngineeringandTechnology-1023.html#program-UG-T%20CIVE-MAJOR",
      label: "Program of Study: Major: Civil Engineering",
      score: 87,
      confidence: "high",
      sourceRole: "official-catalog",
      parserType: "catalog-page",
      canCreateSchedulableRows: true,
      sourceRoleStatus: "primary",
      reasons: [
        "official catalog URL includes a major-specific anchor",
        "official UW General Catalog program page",
        "official source text matches the selected major",
      ],
    }),
    false
  );
});

test("Sentence-fragment pathway labels are rejected while real options stay materializable", () => {
  for (const value of [
    "You need to complete 60 credits track",
    "They can concentrate in one of five countries/regions track",
    "And Risk Management concentration (54 credits)",
    "Extent and quality of relevant 3 area of concentration selective courses from",
    "Credential Overview option",
    "Recommended Preparation option",
    "With Honors completion of departmental honors requirements in the major option",
    "Especially those who broaden into the related Control Systems pathway",
  ]) {
    assert.equal(
      isSuspiciousStructuralPathwayLabel(value),
      true,
      `Expected ${value} to be treated as a structural/prose label.`
    );
    assert.equal(
      isSuspiciousStructuralPathwayId(
        value
          .toLowerCase()
          .replace(/&/g, " and ")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      ),
      true,
      `Expected ${value} to be treated as a structural/prose id.`
    );
  }

  const plan = {
    id: "synthetic-prose-pathways",
    campusId: "uw-seattle",
    title: "Synthetic Major",
    shortTitle: "Synthetic Major",
    officialLinks: [],
    pathways: [
      {
        id: "you-need-to-complete-60-credits-track",
        label: "You need to complete 60 credits track",
      },
      { id: "credential-overview-option", label: "Credential Overview option" },
      { id: "course-option", label: "Course Option" },
      { id: "gis-option", label: "GIS option" },
    ],
  };

  assert.equal(isSuspiciousStructuralPathwayId("course-option"), false);
  assert.equal(isSuspiciousStructuralPathwayLabel("GIS option"), false);
  assert.deepEqual(
    materializeTransferPlannerPathways(plan, plan.pathways, []).map((pathway) => [
      pathway.id,
      pathway.label,
    ]),
    [
      ["course-option", "Course Option"],
      ["gis-option", "GIS option"],
    ]
  );
});

test("Parser pathway extraction drops prose fragments before source adapters are generated", () => {
  const entry = {
    id: "synthetic-ece:primary",
    ownerId: "synthetic-ece",
    ownerTitle: "Electrical and Computer Engineering",
    sourceLabel: "Electrical and Computer Engineering requirements",
    planId: "synthetic-ece",
    pathwayId: null,
    campusId: "uw-seattle",
    parserType: "html-degree-page",
    url: "https://example.edu/ece/requirements",
    label: "Electrical and Computer Engineering requirements",
    isPrimaryDegreeRequirementsLink: true,
    ownerType: "major",
  };
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(
    entry,
    `
      <h1>Electrical and Computer Engineering Requirements</h1>
      <h2>Especially those who broaden into the related Control Systems pathway</h2>
      <p>EE 215, EE 233, EE 235</p>
      <h2>Photonics Pathway</h2>
      <p>EE 361, EE 436, EE 437</p>
    `
  );

  assert.equal(
    parsed.pathwayLabels.some((label) => /especially those who/i.test(label)),
    false
  );
  assert.ok(parsed.pathwayLabels.some((label) => /photonics pathway/i.test(label)));
});

test("Cross-major title detection blocks Sustainable Urban Development labels for Urban Studies", () => {
  const titlesByPlanId = {
    "uw-tacoma-urban-studies": "Urban Studies",
    "uw-tacoma-sustainable-urban-development": "Sustainable Urban Development",
    "uw-bothell-business-administration": "Business Administration",
    "uw-bothell-business-administration-accounting": "Business Administration: Accounting",
  };

  assert.equal(
    labelMentionsDifferentTransferPlannerMajor(
      "uw-tacoma-urban-studies",
      "BA in Sustainable Urban Development",
      titlesByPlanId
    ),
    true
  );
  assert.equal(
    labelMentionsDifferentTransferPlannerMajor(
      "uw-tacoma-urban-studies",
      "Urban Studies GIS option",
      titlesByPlanId
    ),
    false
  );
  assert.equal(
    labelMentionsDifferentTransferPlannerMajor(
      "uw-bothell-business-administration",
      "Business Administration Accounting option",
      titlesByPlanId
    ),
    false
  );
});

test("DOCX major planning worksheets are primary parseable document candidates", () => {
  const target = discovery.buildOwnerTargetRecord({
    analysisMode: "missing-primary",
    ownerType: "major",
    ownerKey: "uw-bothell-business-administration",
    planId: "uw-bothell-business-administration",
    pathwayId: null,
    campusId: "uw-bothell",
    title: "Business Administration",
    label: "Business Administration",
    officialLinks: [],
    existingPrimary: null,
    pathwayCount: 0,
  });
  const overview = discovery.scoreCandidate(target, {
    url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration",
    label: "Business Administration overview",
    pageTitle: "Business Administration",
    sourceKind: "official-link",
  });
  const worksheet = discovery.scoreCandidate(target, {
    url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/bba-major-planning-worksheet.docx",
    label: "Business Administration major planning worksheet",
    sourceKind: "discovered-anchor",
  });

  assert.equal(worksheet.sourceRole, "primary-degree-requirements");
  assert.equal(worksheet.sourceRoleStatus, "primary");
  assert.equal(worksheet.parserType, "pdf-worksheet");
  assert.equal(worksheet.canCreateSchedulableRows, true);
  assert.ok(worksheet.score > overview.score);
});

test("Business major discovery penalizes sibling bachelor degree routes", () => {
  const target = discovery.buildOwnerTargetRecord({
    analysisMode: "weak-existing-primary",
    ownerType: "major",
    ownerKey: "uw-bothell-business-administration",
    planId: "uw-bothell-business-administration",
    pathwayId: null,
    campusId: "uw-bothell",
    title: "Business Administration",
    label: "Business Administration",
    officialLinks: [],
    existingPrimary: {
      label: "UW Bothell Bachelor of Business Administration curriculum",
      url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum",
    },
    pathwayCount: 8,
  });
  const businessCurriculum = discovery.scoreCandidate(target, {
    url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum",
    label: "UW Bothell Bachelor of Business Administration curriculum",
    pageTitle: "Bachelor of Business Administration Curriculum",
    pageHeadings: ["Bachelor of Business Administration Curriculum", "Requirements"],
    sourceKind: "official-link",
  });
  const economicsCurriculum = discovery.scoreCandidate(target, {
    url: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/curriculum",
    label: "UW Bothell Bachelor of Economics curriculum",
    pageTitle: "Bachelor of Economics Curriculum",
    pageHeadings: ["Bachelor of Economics Curriculum", "Requirements"],
    sourceKind: "discovered-anchor",
    sourcePageUrl:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum",
  });

  assert.ok(
    economicsCurriculum.reasons.includes(
      "candidate appears to describe a different degree route"
    )
  );
  assert.ok(economicsCurriculum.score < businessCurriculum.score);
});

test("Business major discovery will not suggest sibling bachelor routes as missing primaries", () => {
  const target = discovery.buildOwnerTargetRecord({
    analysisMode: "missing-primary",
    ownerType: "major",
    ownerKey: "uw-bothell-business-administration-finance",
    planId: "uw-bothell-business-administration-finance",
    pathwayId: null,
    campusId: "uw-bothell",
    title: "Business Administration: Finance (BA)",
    label: "Business Administration: Finance (BA)",
    officialLinks: [],
    existingPrimary: null,
    pathwayCount: 0,
  });
  const economicsCurriculum = {
    url: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/curriculum",
    label: "Curriculum",
    pageTitle: "Curriculum - School of Business",
    pageHeadings: [
      "Curriculum",
      "Degree Requirements",
      "General Education Requirements",
    ],
    sourceKind: "discovered-anchor",
    sourceRole: "primary-degree-requirements",
    sourceRoleStatus: "primary",
    parserType: "html-curriculum-page",
    canCreateSchedulableRows: true,
    canBePrimary: true,
    score: 82,
    confidence: "medium",
    reasons: [
      "curriculum wording",
      "explicit degree-requirements wording",
      "matches major keyword \"business\"",
      "primary degree requirements source role",
    ],
  };
  const financePage = {
    url: "https://www.uwb.edu/business/undergraduate/business-administration/finance",
    label: "Finance",
    sourceKind: "discovered-anchor",
    sourceRole: "department-requirements",
    sourceRoleStatus: "primary",
    parserType: "html-degree-page",
    canCreateSchedulableRows: true,
    canBePrimary: true,
    score: 81,
    confidence: "high",
    reasons: [
      "department requirements source role",
      "matches major keyword \"administration\"",
      "matches major keyword \"business\"",
      "matches major keyword \"finance\"",
      "official source path matches the selected major",
    ],
  };

  const decision = discovery.buildReplacementDecision(target, [
    economicsCurriculum,
    financePage,
  ]);

  assert.equal(decision.action, "add-missing-primary");
  assert.equal(decision.suggestedPrimary?.url, financePage.url);
});

test("Business pathway discovery will not infer concentration sources from sibling bachelor hubs", () => {
  const target = discovery.buildOwnerTargetRecord({
    analysisMode: "missing-primary",
    ownerType: "pathway",
    ownerKey:
      "uw-bothell-business-administration-finance:pathway:retail-management-concentration",
    planId: "uw-bothell-business-administration-finance",
    pathwayId: "retail-management-concentration",
    campusId: "uw-bothell",
    title: "Business Administration: Finance (BA) - Retail Management Concentration",
    label: "Retail Management Concentration",
    officialLinks: [],
    existingPrimary: null,
    pathwayCount: 1,
  });
  const economicsRetail = {
    url: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/curriculum#retail-management",
    label: "Retail Management Concentration inferred option/concentration requirements",
    anchorText: "Retail Management Concentration",
    linkText: "Retail Management Concentration",
    pageTitle: "Curriculum - School of Business",
    pageHeadings: [
      "Curriculum",
      "Degree Requirements",
      "General Education Requirements",
    ],
    sourcePageUrl:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/curriculum",
    discoveredFromUrl:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/curriculum",
    sourceKind: "inferred-hub-child-candidate",
    sourceRole: "primary-degree-requirements",
    sourceRoleStatus: "primary",
    parserType: "html-curriculum-page",
    canCreateSchedulableRows: true,
    canBePrimary: true,
    requiresVerification: true,
    verified: true,
    score: 146,
    confidence: "high",
    reasons: [
      "explicit degree-requirements wording",
      "explicitly names the selected pathway or route",
      "same-program option/concentration child source matches the selected pathway",
    ],
  };
  const economicsRetailChildPage = {
    url: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/retail-management-concentration#content",
    label: "Retail Management Concentration",
    anchorText: "Retail Management Concentration",
    linkText: "Retail Management Concentration",
    sourceKind: "discovered-anchor",
    sourceRole: "primary-degree-requirements",
    sourceRoleStatus: "primary",
    parserType: "html-degree-page",
    canCreateSchedulableRows: true,
    canBePrimary: true,
    score: 123,
    confidence: "high",
    reasons: [
      "explicitly names the selected pathway or route",
      "official source path matches the selected pathway",
      "same-program option/concentration child source matches the selected pathway",
    ],
  };
  const bbaRetail = {
    url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/retail",
    label: "Retail Management Concentration",
    pageTitle: "Retail Management Concentration",
    sourceKind: "discovered-anchor",
    sourceRole: "primary-degree-requirements",
    sourceRoleStatus: "primary",
    parserType: "html-degree-page",
    canCreateSchedulableRows: true,
    canBePrimary: true,
    score: 117,
    confidence: "high",
    reasons: [
      "explicitly names the selected pathway or route",
      "matches major keyword \"administration\"",
      "matches major keyword \"business\"",
      "matches major keyword \"retail\"",
      "same-program option/concentration child source matches the selected pathway",
    ],
  };

  const decision = discovery.buildReplacementDecision(target, [
    economicsRetail,
    economicsRetailChildPage,
    bbaRetail,
  ]);

  assert.equal(decision.action, "add-missing-primary");
  assert.equal(decision.suggestedPrimary?.url, bbaRetail.url);
});

test("Catalog credential discovery prefers the matching pathway credential anchor over sibling anchors", () => {
  const target = discovery.buildOwnerTargetRecord({
    analysisMode: "weak-existing-primary",
    ownerType: "pathway",
    ownerKey: "uw-seattle-atmospheric-and-climate-science:pathway:bs-option-family:climate",
    planId: "uw-seattle-atmospheric-and-climate-science",
    pathwayId: "bs-option-family:climate",
    campusId: "uw-seattle",
    title: "Atmospheric and Climate Science - B.S. Climate option",
    label: "B.S. Climate option",
    officialLinks: [],
    existingPrimary: {
      label: "Program of Study: Major: Atmospheric and Climate Science",
      url: "https://www.washington.edu/students/gencat/program/S/AtmosphericandClimateScience-1067.html#program-UG-ATMOS-MAJOR",
    },
    pathwayCount: 4,
  });
  const sharedPageHeadings = [
    "Bachelor of Science degree with a major in Atmospheric and Climate Science: Chemistry",
    "Bachelor of Science degree with a major in Atmospheric and Climate Science: Climate",
    "Bachelor of Science degree with a major in Atmospheric and Climate Science: Data Science",
    "Bachelor of Science degree with a major in Atmospheric and Climate Science: Meteorology",
  ];
  const climateCredential = discovery.scoreCandidate(target, {
    url: "https://www.washington.edu/students/gencat/program/S/AtmosphericandClimateScience-1067.html#credential-66eb4f7fc6df171928f9a3fb",
    anchorText: "Bachelor of Science degree with a major in Atmospheric and Climate Science: Climate",
    pageHeadings: sharedPageHeadings,
    sourceKind: "discovered-anchor",
    sourcePageUrl:
      "https://www.washington.edu/students/gencat/program/S/AtmosphericandClimateScience-1067.html#program-UG-ATMOS-MAJOR",
  });
  const dataScienceCredential = discovery.scoreCandidate(target, {
    url: "https://www.washington.edu/students/gencat/program/S/AtmosphericandClimateScience-1067.html#credential-66eb4be55e1578ddb9e20fcc",
    anchorText: "Bachelor of Science degree with a major in Atmospheric and Climate Science: Data Science",
    pageHeadings: sharedPageHeadings,
    sourceKind: "discovered-anchor",
    sourcePageUrl:
      "https://www.washington.edu/students/gencat/program/S/AtmosphericandClimateScience-1067.html#program-UG-ATMOS-MAJOR",
  });
  const majorAnchor = discovery.scoreCandidate(target, {
    url: "https://www.washington.edu/students/gencat/program/S/AtmosphericandClimateScience-1067.html#program-UG-ATMOS-MAJOR",
    anchorText: "Program of Study: Major: Atmospheric and Climate Science",
    pageHeadings: sharedPageHeadings,
    sourceKind: "official-link",
  });

  assert.ok(climateCredential.score > dataScienceCredential.score);
  assert.ok(climateCredential.score > majorAnchor.score);
});

test("Catalog credential anchor parser scopes to the selected credential only", () => {
  const html = `
    <div class="expandableGroup" data-expand="credential-alpha">
      <h4 class="expanded" id="credential-alpha">Bachelor of Arts degree with a major in Example: Alpha</h4>
    </div>
    <div id="credential-alpha-block" class="inner-block">
      <div class="credentialCompletionRequirements">
        <b>Completion Requirements</b>
        <p>55 credits</p>
        <ol>
          <li>Core courses (20 credits): ANTH 201; one from STAT 220 or STAT 311</li>
          <li>Option courses: include 20 credits from courses approved for the Alpha option.</li>
        </ol>
      </div>
      <div class="backToTop"><a href="#top">Back to Top</a></div>
    </div>
    <div class="expandableGroup" data-expand="credential-beta">
      <h4 class="expanded" id="credential-beta">Bachelor of Arts degree with a major in Example: Beta</h4>
    </div>
    <div id="credential-beta-block" class="inner-block">
      <div class="credentialCompletionRequirements">
        <b>Completion Requirements</b>
        <ol>
          <li>Option courses: include BIO A 351 or BIO A 355 and 15 credits from the Beta option.</li>
        </ol>
      </div>
    </div>
  `;
  const scope = parser.scopeCatalogHtmlByAnchor(
    {
      campusId: "uw-seattle",
      planId: "uw-seattle-example",
      ownerTitle: "Example - B.A. Alpha option",
      label: "B.A. Alpha option",
      role: "catalog",
      parserType: "catalog-page",
      url: "https://www.washington.edu/students/gencat/program/S/Example.html#credential-alpha",
    },
    html
  );
  const scopedText = scope?.lines?.join(" ") ?? "";

  assert.equal(scope?.scoped, true);
  assert.match(scopedText, /Alpha option/);
  assert.doesNotMatch(scopedText, /Beta option/);
  assert.match(scope?.sectionAudit?.stopBoundary ?? "", /credential-beta/);
});

test("Catalog program anchor parser stops major scope before child credential sections", () => {
  const html = `
    <div class="expandableGroup" data-expand="program-UG-ACMS-MAJOR">
      <h3 class="expanded" id="program-UG-ACMS-MAJOR">Program of Study: Major: Applied and Computational Mathematical Sciences</h3>
    </div>
    <div id="program-UG-ACMS-MAJOR-block" class="inner-block">
      <div class="programsOfStudy">
        <span>This program of study leads to the following credentials:</span>
        <ul>
          <li>Bachelor of Science degree with a major in Applied and Computational Math Sciences: Data Science and Statistics</li>
          <li>Bachelor of Science degree with a major in Applied and Computational Math Sciences: Discrete Mathematics and Algorithms</li>
        </ul>
      </div>
      <div class="programRecommendedPrep">
        <b>Recommended Preparation</b>
        <p>MATH 124, MATH 125, MATH 126; CSE 123 or CSE 143.</p>
      </div>
      <div class="programAdmissionRequirements">
        <b>Admission Requirements</b>
        <p>Minimum Course Requirements: MATH 208 and AMATH 352.</p>
      </div>
      <div class="continuationPolicy"><b>Continuation Policy</b></div>
      <div class="expandableGroup" data-expand="credential-67e1c469f30b814dcb572f9e">
        <h4 class="expanded" id="credential-67e1c469f30b814dcb572f9e">Bachelor of Science degree with a major in Applied and Computational Math Sciences: Data Science and Statistics</h4>
      </div>
      <div id="credential-67e1c469f30b814dcb572f9e-block" class="inner-block">
        <div class="credentialOverview"><b>Credential Overview</b></div>
        <div class="programCompletionRequirements">
          <b>Completion Requirements</b>
          <p>Machine Learning: STAT 435 or CFRM 421.</p>
        </div>
      </div>
    </div>
  `;
  const scope = parser.scopeCatalogHtmlByAnchor(
    {
      campusId: "uw-seattle",
      ownerType: "major",
      planId: "uw-seattle-applied-and-computational-mathematical-sciences",
      ownerTitle: "Applied & Computational Mathematical Sciences (ACMS)",
      label: "Applied & Computational Mathematical Sciences (ACMS)",
      role: "catalog",
      parserType: "catalog-page",
      url: "https://www.washington.edu/students/gencat/program/S/AppliedandComputationalMathSciences-994.html#program-UG-ACMS-MAJOR",
    },
    html
  );
  const scopedText = scope?.lines?.join(" ") ?? "";

  assert.equal(scope?.scoped, true);
  assert.match(scopedText, /Recommended Preparation/);
  assert.match(scopedText, /Admission Requirements/);
  assert.match(scopedText, /Data Science and Statistics/);
  assert.doesNotMatch(scopedText, /Machine Learning/);
  assert.match(scope?.sectionAudit?.stopBoundary ?? "", /Data Science and Statistics/);

  const scopedLines = parser.scopeHtmlLinesForTest(
    {
      campusId: "uw-seattle",
      ownerType: "major",
      planId: "uw-seattle-applied-and-computational-mathematical-sciences",
      ownerTitle: "Applied and Computational Mathematical Sciences",
      label: "Applied and Computational Mathematical Sciences",
      role: "degree-requirements",
      parserType: "html-degree-page",
      url: "https://www.washington.edu/students/gencat/program/S/AppliedandComputationalMathSciences-994.html",
    },
    "Applied and Computational Math Sciences",
    ["Program of Study: Major: Applied and Computational Mathematical Sciences"],
    [
      "Applied and Computational Math Sciences",
      "Program of Study: Major: Applied and Computational Mathematical Sciences",
      "This program of study leads to the following credentials:",
      "Bachelor of Science degree with a major in Applied and Computational Math Sciences: Data Science and Statistics",
      "Bachelor of Science degree with a major in Applied and Computational Math Sciences: Discrete Mathematics and Algorithms",
      "Recommended Preparation",
      "MATH 124, MATH 125, MATH 126; CSE 123 or CSE 143.",
      "Admission Requirements",
      "Minimum Course Requirements: MATH 208 and AMATH 352.",
      "Minimum grade requirements: Minimum 2.0 grade for each course required for admission.",
      "Determining Factors: Factors considered include performance in degree-related courses.",
      "When to Apply: Applications are accepted twice each year.",
      "Entering Transfers. Admission is capacity constrained.",
      "Transfer applicants must submit a departmental application.",
      "Minimum 30 graded college credits completed by the University transfer application deadline.",
      "Minimum Course Requirements: MATH 208 and AMATH 352.",
      "Minimum grade requirements: Minimum 2.0 grade for each course required for admission.",
      "Determining Factors: Factors considered include performance in degree-related courses.",
      "When to Apply: Application deadlines are published by the department.",
      "Continuation Policy",
      "Bachelor of Science degree with a major in Applied and Computational Math Sciences: Data Science and Statistics",
      "Credential Overview",
      "Completion Requirements",
      "Machine Learning: STAT 435 or CFRM 421.",
    ]
  );
  const scopedLineText = scopedLines.join(" ");

  assert.match(scopedLineText, /Admission Requirements/);
  assert.doesNotMatch(scopedLineText, /Machine Learning/);
});

test("Pathway hub pages can promote matching child option and concentration sources", async () => {
  const hubUrl =
    "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/options";
  const financeUrl =
    "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/finance-option";
  const accountingUrl =
    "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/accounting";
  const target = discovery.buildOwnerTargetRecord({
    analysisMode: "weak-existing-primary",
    ownerType: "pathway",
    ownerKey: "uw-bothell-business-administration:pathway:finance-option-and-concentration",
    planId: "uw-bothell-business-administration",
    pathwayId: "finance-option-and-concentration",
    campusId: "uw-bothell",
    title: "Business Administration - Finance option and concentration",
    label: "Finance option and concentration",
    officialLinks: [{ label: "BBA options hub", url: hubUrl }],
    existingPrimary: { label: "BBA options hub", url: hubUrl },
    reevaluationSignals: [
      {
        code: "primary-source-misses-selected-pathway",
        reason: "Current pathway primary source does not name the selected pathway.",
      },
    ],
    reevaluationContext: {
      parsedUwCourseCodeCount: 0,
      hasStrongRequirementCue: true,
      currentSourceLatestYear: null,
    },
    parsedBlock: {
      primarySourceUrl: hubUrl,
      sourceUrl: hubUrl,
      extractedTitle: "Business Administration options",
      extractedHeadings: ["Options and Concentrations"],
      requirementCueLines: ["Choose an option or concentration."],
      parsedUwCourseCodes: [],
      qualitySignals: [],
    },
    pathwayCount: 8,
  });
  const inspectedUrls = [];

  const result = await discovery.analyzeOwner(target, 1000, {
    inspectPageImpl: async (url) => {
      inspectedUrls.push(url);
      if (url === hubUrl) {
        return {
          url,
          ok: true,
          status: 200,
          finalUrl: url,
          contentType: "text/html",
          title: "Business Administration options and concentrations",
          headings: ["Options and Concentrations"],
          anchors: [
            { url: financeUrl, text: "Finance option", sourceUrl: url },
            { url: accountingUrl, text: "Accounting option", sourceUrl: url },
          ],
          error: null,
        };
      }

      return {
        url,
        ok: true,
        status: 200,
        finalUrl: url,
        contentType: "text/html",
        title: url === financeUrl ? "Finance Option and Concentration" : "Accounting Option",
        headings:
          url === financeUrl
            ? ["Finance Option and Concentration", "Major Requirements"]
            : ["Accounting Option", "Major Requirements"],
        anchors: [],
        error: null,
      };
    },
  });

  assert.ok(includesExactUrl(inspectedUrls, financeUrl));
  assert.equal(result.suggestedAction, "replace-existing-primary");
  assert.equal(result.suggestedPrimary?.url, financeUrl);
  assert.equal(result.suggestedPrimary?.sourceRole, "primary-degree-requirements");
  assert.equal(result.suggestedPrimary?.sourceRoleStatus, "primary");
  assert.equal(result.suggestedPrimary?.canCreateSchedulableRows, true);
  assert.ok(
    result.suggestedPrimary?.reasons.includes(
      "same-program option/concentration child source matches the selected pathway"
    )
  );
});

test("Pathway hub discovery infers and verifies child option URLs when hub anchors are absent", async () => {
  const hubUrl =
    "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/options";
  const financeUrl =
    "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/finance-option";
  const target = discovery.buildOwnerTargetRecord({
    analysisMode: "weak-existing-primary",
    ownerType: "pathway",
    ownerKey: "uw-bothell-business-administration:pathway:finance-option-and-concentration",
    planId: "uw-bothell-business-administration",
    pathwayId: "finance-option-and-concentration",
    campusId: "uw-bothell",
    title: "Business Administration - Finance option and concentration",
    label: "Finance option and concentration",
    officialLinks: [{ label: "BBA options hub", url: hubUrl }],
    existingPrimary: { label: "BBA options hub", url: hubUrl },
    reevaluationSignals: [
      {
        code: "primary-source-misses-selected-pathway",
        reason: "Current pathway primary source does not name the selected pathway.",
      },
    ],
    reevaluationContext: {
      parsedUwCourseCodeCount: 0,
      hasStrongRequirementCue: true,
      currentSourceLatestYear: null,
    },
    parsedBlock: {
      primarySourceUrl: hubUrl,
      sourceUrl: hubUrl,
      extractedTitle: "Business Administration options",
      extractedHeadings: ["Options and Concentrations"],
      requirementCueLines: ["Choose an option or concentration."],
      parsedUwCourseCodes: [],
      qualitySignals: [],
    },
    pathwayCount: 8,
  });
  const inspectedUrls = [];

  const result = await discovery.analyzeOwner(target, 1000, {
    inspectPageImpl: async (url) => {
      inspectedUrls.push(url);
      if (url === hubUrl) {
        return {
          url,
          ok: true,
          status: 200,
          finalUrl: url,
          contentType: "text/html",
          title: "Business Administration options and concentrations",
          headings: ["Options and Concentrations"],
          anchors: [],
          error: null,
        };
      }

      if (url === financeUrl) {
        return {
          url,
          ok: true,
          status: 200,
          finalUrl: url,
          contentType: "text/html",
          title: "Finance Option and Concentration",
          headings: ["Finance Option and Concentration", "Major Requirements"],
          anchors: [],
          error: null,
        };
      }

      return {
        url,
        ok: false,
        status: 404,
        finalUrl: url,
        contentType: "text/html",
        title: "Page not found",
        headings: ["Page not found"],
        anchors: [],
        error: "not found",
      };
    },
  });

  assert.ok(includesExactUrl(inspectedUrls, financeUrl));
  assert.equal(result.suggestedAction, "replace-existing-primary");
  assert.equal(result.suggestedPrimary?.url, financeUrl);
  assert.equal(result.suggestedPrimary?.sourceRole, "primary-degree-requirements");
  assert.equal(result.suggestedPrimary?.sourceRoleStatus, "primary");
  assert.equal(result.suggestedPrimary?.verified, true);
  assert.ok(
    result.suggestedPrimary?.reasons.includes(
      "inferred from an official option/concentration hub"
    )
  );
});

test("Approved-course-list source scope emits support metadata without required rows", () => {
  const scope = parser.buildRequirementSourceScope("approved-course-list");
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "approved-course-list",
    url: "https://www.cs.washington.edu/academics/ugrad/approved-natural-science/",
    label: "Approved Natural Science Courses",
    courseCodes: ["CHEM 142", "BIOL 180"],
  });

  assert.equal(scope.supportOnly, true);
  assert.equal(scope.canCreateApprovedFilters, true);
  assert.equal(scope.canCreateRequiredRows, false);
  assert.equal(scope.canCreateScheduleRows, false);
  assert.deepEqual(parsedBlock.approvedFilterUwCourseCodes, ["BIOL 180", "CHEM 142"]);
  assert.deepEqual(parsedBlock.electiveListUwCourseCodes, []);
  assert.deepEqual(parsedBlock.supportOnlyUwCourseCodes, ["BIOL 180", "CHEM 142"]);
  assert.equal(parsedBlock.supportLists.length, 1);
  assert.equal(parsedBlock.supportLists[0].shape, "approved-filter-list");
  assert.equal(parsedBlock.supportLists[0].supportOnly, true);
  assert.equal(parsedBlock.supportLists[0].canCreateRequiredRow, false);
  assert.equal(parsedBlock.supportLists[0].canCreateScheduleRow, false);
  assert.deepEqual(parsedBlock.supportLists[0].acceptedUwCourseCodes, ["BIOL 180", "CHEM 142"]);
  assert.deepEqual(parsedBlock.parsedRequirementAtomCandidates, []);
  assert.deepEqual(parsedBlock.parsedDegreeMapBlockCandidates, []);
  assert.deepEqual(parsedBlock.parsedRequirementGroups, []);
  assert.deepEqual(parsedBlock.parsedRequirementCourses, []);
  assert.ok(
    parsedBlock.sourceScopeAuditLines.every(
      (line) => line.includes("Emitted as: approved-list-entry") && line.includes("Scheduled: no")
    )
  );
});

test("Parser generates program-approved filters from official approved-list source sections", () => {
  const snapshotLines = [
    "Computer Science Natural Science Requirement",
    "To complete the Computer Science degree, students must complete 5 credits from the following list:",
    "Physics 121/141",
    "Chemistry 142, 143 or 145",
    "Biology 180",
    "Biology 162 (AP credit)",
    "Physics 116 *and* Physics 119 - generally from AP credit.",
    "Advanced coursework in these areas or other highly relevant courses may be petitioned",
    "Back to top",
    "Graduation Requirements",
    "CSE 123 Intro to Computer Programming III",
    "MATH 124, MATH 125, MATH 126",
  ];
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "approved-course-list",
    url: "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#natural-science",
    label: "Allen School CS-approved Natural Science course list",
    planId: "uw-seattle-computer-science",
    ownerId: "uw-seattle-computer-science",
    ownerTitle: "Computer Science",
    courseCodes: [
      "PHYS 121",
      "PHYS 141",
      "CHEM 142",
      "CHEM 143",
      "CHEM 145",
      "BIOL 180",
      "BIOL 162",
      "PHYS 116",
      "PHYS 119",
      "CSE 123",
      "MATH 124",
    ],
    snapshotLines,
  });
  const filters = parser.buildGeneratedProgramApprovedCourseFiltersForTest({
    generatedAt: "2026-05-11T00:00:00.000Z",
    owners: [{ ...parsedBlock, snapshotLines }],
  });
  const filter = filters.find((candidate) => candidate.filterKey === "computer-science-approved-science");

  assert.ok(filter, "Expected a generated CS approved-science filter.");
  assert.deepEqual(
    filter.approvedUwCourseCodes,
    ["BIOL 162", "BIOL 180", "CHEM 142", "CHEM 143", "CHEM 145", "PHYS 116", "PHYS 119", "PHYS 121", "PHYS 141"]
  );
  assert.equal(filter.approvedUwCourseCodes.includes("CSE 123"), false);
  assert.equal(filter.approvedUwCourseCodes.includes("MATH 124"), false);
  assert.ok(filter.sourceEvidenceLines.some((line) => /Computer Science Natural Science Requirement/i.test(line)));
  assert.ok(filter.sourceFingerprint);
  assert.deepEqual(parsedBlock.supportLists[0].acceptedUwCourseCodes, filter.approvedUwCourseCodes);
  assert.deepEqual(parsedBlock.parsedRequirementAtomCandidates, []);
});

test("Elective-list source scope emits elective metadata without schedulable rows", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "elective-list",
    url: "https://www.cheme.washington.edu/undergraduate/engineering-electives",
    label: "Engineering Elective Courses",
    courseCodes: ["AA 210", "MSE 170"],
  });

  assert.equal(parsedBlock.supportOnly, true);
  assert.equal(parsedBlock.canCreateElectiveLists, true);
  assert.equal(parsedBlock.canCreateRequiredRows, false);
  assert.equal(parsedBlock.canCreateScheduleRows, false);
  assert.deepEqual(parsedBlock.approvedFilterUwCourseCodes, []);
  assert.deepEqual(parsedBlock.electiveListUwCourseCodes, ["AA 210", "MSE 170"]);
  assert.equal(parsedBlock.supportLists.length, 1);
  assert.equal(parsedBlock.supportLists[0].shape, "elective-list");
  assert.equal(parsedBlock.supportLists[0].supportOnly, true);
  assert.equal(parsedBlock.supportLists[0].canCreateRequiredRow, false);
  assert.equal(parsedBlock.supportLists[0].canCreateScheduleRow, false);
  assert.deepEqual(parsedBlock.supportLists[0].acceptedUwCourseCodes, ["AA 210", "MSE 170"]);
  assert.deepEqual(parsedBlock.parsedRequirementAtomCandidates, []);
  assert.deepEqual(parsedBlock.parsedDegreeMapBlockCandidates, []);
  assert.ok(
    parsedBlock.sourceScopeAuditLines.every(
      (line) => line.includes("Emitted as: elective-list-entry") && line.includes("Scheduled: no")
    )
  );
});

test("Parser drops non-schedulable course-list options from primary credit buckets", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "department-requirements",
    url: "https://www.uwb.edu/ias/undergraduate/majors/data-visualization",
    label: "Data Visualization Degree Requirements",
    planId: "uw-bothell-data-visualization-ba",
    ownerId: "uw-bothell-data-visualization-ba",
    ownerTitle: "Data Visualization (BA)",
    courseCodes: ["BDATA 200", "BIS 111", "BIS 312", "BIS 332", "GEOG 236"],
    headings: [
      "Data Visualization Degree Requirements",
      "D. Data Visualization Elective Courses (25 credits)",
      "Bachelor of Science Elective Courses",
    ],
    snapshotLines: [
      "Data Visualization Degree Requirements",
      "BDATA 200 Introduction to Data Studies (5 credits)",
      "D. Data Visualization Elective Courses (25 credits)",
      "Bachelor of Science Elective Courses",
      "BIS 111/CSS 101 Digital Thinking (5 credits)",
      "BIS 312 Approaches to Social Research Methods (5 credits)",
      "BIS 332 Digital Global Industries (5 credits)",
      "JSIS A/GEOG 236",
    ],
  });
  const electiveGroup = parsedBlock.parsedRequirementGroups.find((group) =>
    group.label.includes("Data Visualization Elective Courses")
  );
  const optionCodes = new Set(
    (electiveGroup?.options ?? []).flatMap((option) => option.uwCourses ?? [])
  );
  const blockedRows = parsedBlock.sourceSectionFilterAuditRows.filter((row) =>
    ["BIS 312", "BIS 332"].some((courseCode) =>
      (row.courseCodesExtracted ?? []).includes(courseCode)
    )
  );

  assert.ok(electiveGroup, "Expected the credit bucket itself to remain.");
  assert.equal(optionCodes.has("BIS 111"), true);
  assert.equal(optionCodes.has("BIS 312"), false);
  assert.equal(optionCodes.has("BIS 332"), false);
  assert.equal(optionCodes.has("GEOG 236"), false);
  assert.ok(blockedRows.every((row) => row.schedulable === false));
  assert.ok(
    parsedBlock.sourceScopeAuditLines.some(
      (line) =>
        line.includes("Course code: BIS 312") &&
        line.includes("Emitted as: hidden-support-metadata") &&
        line.includes("Scheduled: no")
    )
  );
});

test("Parser filters blocked cross-listed aliases while preserving schedulable primary options", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "department-requirements",
    url: "https://jsis.washington.edu/programs/undergraduate/asia-studies/",
    label: "Asian Studies Requirements",
    planId: "uw-seattle-asian-studies",
    ownerId: "uw-seattle-asian-studies",
    ownerTitle: "Asian Studies",
    courseCodes: ["JSISA 254", "HSTAS 254"],
    headings: [
      "Asian Studies Requirements",
      "Asia Electives 3-400 level *",
      "CHINA COURSE LIST",
    ],
    snapshotLines: [
      "Asian Studies Requirements",
      "Asia Electives 3-400 level * (10 credits)",
      "JSIS A 254 China in the Twentieth Century (5 credits)",
      "CHINA COURSE LIST",
      "JSIS A/HSTAS 254",
      "China in the Twentieth Century",
    ],
  });
  const group = parsedBlock.parsedRequirementGroups.find((candidate) =>
    /Asia Electives/i.test(candidate.label)
  );
  const jsisOption = (group?.options ?? []).find((option) =>
    (option.uwCourses ?? []).includes("JSISA 254")
  );
  const blockedRow = parsedBlock.sourceSectionFilterAuditRows.find(
    (row) => row.rawLine === "JSIS A/HSTAS 254"
  );

  assert.ok(group, "Expected the schedulable Asian Studies elective bucket to remain.");
  assert.ok(jsisOption, "Expected the schedulable JSIS A 254 option to remain.");
  assert.deepEqual(jsisOption.equivalentUwCourseCodes, []);
  assert.equal(blockedRow?.schedulable, false);
  assert.ok(
    parsedBlock.sourceScopeAuditLines.some(
      (line) =>
        line.includes("Course code: HSTAS 254") &&
        line.includes("Emitted as: hidden-support-metadata") &&
        line.includes("Scheduled: no")
    )
  );
});

test("Parser ignores prerequisite/application-only section rows as elective options", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    url: "https://foster.uw.edu/academics/degree-programs/undergraduate-programs/curriculum/",
    label: "Business Administration Curriculum",
    planId: "uw-seattle-business-administration",
    pathwayId: "ba-route",
    ownerId: "uw-seattle-business-administration:pathway:ba-route",
    ownerTitle: "Business Administration",
    courseCodes: ["MKTG 305", "MKTG 315", "MKTG 445"],
    headings: [
      "Business Administration Curriculum",
      "Elective Courses",
      "I BUS 490: Foster Exploration Seminar (*study abroad course by application only)",
      "Application-only elective courses",
    ],
    snapshotLines: [
      "Business Administration Curriculum",
      "Elective Courses (5 credits)",
      "MKTG 315: The Business of Personal Branding and Athletics (4 CR)",
      "I BUS 490: Foster Exploration Seminar (*study abroad course by application only)",
      "MKTG 445: Multicultural Marketing and Business Development (4 CR; prerequisite: MKTG 305; during Period 3 of Registration)",
      "Application-only elective courses",
      "MKTG 445",
    ],
  });
  const group = parsedBlock.parsedRequirementGroups.find((candidate) =>
    /Elective Courses/i.test(candidate.label)
  );
  const optionCodes = new Set(
    (group?.options ?? []).flatMap((option) => [
      ...(option.uwCourses ?? []),
      ...(option.equivalentUwCourseCodes ?? []),
    ])
  );
  const blockedRows = parsedBlock.sourceSectionFilterAuditRows.filter((row) =>
    (row.courseCodesExtracted ?? []).includes("MKTG 445")
  );

  assert.ok(group, "Expected the elective credit bucket itself to remain.");
  assert.equal(optionCodes.has("MKTG 315"), true);
  assert.equal(optionCodes.has("MKTG 445"), false);
  assert.ok(blockedRows.length >= 2);
  assert.ok(blockedRows.every((row) => row.schedulable === false));
  assert.ok(
    parsedBlock.sourceScopeAuditLines.some(
      (line) =>
        line.includes("Course code: MKTG 445") &&
        line.includes("Emitted as: hidden-support-metadata") &&
        line.includes("Scheduled: no")
    )
  );
});

test("Primary requirement source scope can emit schedulable requirement atoms", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    url: "https://www.cee.uw.edu/academics/undergraduate/environmental/degree-sheet",
    label: "Environmental Engineering Degree Requirements",
    courseCodes: ["CHEM 142", "MATH 124"],
    snapshotLines: ["Degree requirements: CHEM 142 and MATH 124 are required before enrollment."],
  });

  assert.equal(parsedBlock.supportOnly, false);
  assert.equal(parsedBlock.canCreateRequiredRows, true);
  assert.equal(parsedBlock.canCreateScheduleRows, true);
  assert.deepEqual(parsedBlock.approvedFilterUwCourseCodes, []);
  assert.deepEqual(parsedBlock.electiveListUwCourseCodes, []);
  assert.equal(parsedBlock.parsedRequirementAtomCandidates.length, 2);
  assert.ok(
    parsedBlock.sourceScopeAuditLines.every(
      (line) => line.includes("Emitted as: required-row") && line.includes("Scheduled: yes")
    )
  );
});

test("Parser extracts heading-backed comma-separated electives as a choose-one option group", () => {
  const earthScienceOptions = [
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
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    url: "https://www.ce.washington.edu/sites/default/files/pdfs/current/undergrad/uw-cee-bsenve-degree-sheet.pdf",
    label: "Environmental Engineering Degree Sheet",
    courseCodes: earthScienceOptions,
    snapshotLines: [
      "Earth science elective 5 credits",
      earthScienceOptions.join(", "),
    ],
  });
  const group = parsedBlock.parsedRequirementGroups.find((candidate) =>
    /Earth science elective/i.test(candidate.sourceRowText ?? candidate.sourceHeading ?? "")
  );

  assert.ok(group, "Expected the Earth science comma list to become one option group.");
  assert.equal(group.requirementType, "choose_one");
  assert.equal(group.selectionCount, 1);
  assert.equal(group.requiredCount, 1);
  assert.equal(group.supportOnly, false);
  assert.equal(group.sourceRole, "primary-degree-requirements");
  assert.deepEqual(parsedBlock.supportLists, []);
  assert.match(group.detectedOptionCue, /elective|choose/i);
  assert.deepEqual(
    new Set(group.options.flatMap((option) => option.uwCourses)),
    new Set(earthScienceOptions)
  );
});

test("Parser does not convert required comma-separated sequences into option groups", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Mathematics Requirement",
    courseCodes: ["MATH 124", "MATH 125", "MATH 126"],
    snapshotLines: [
      "Mathematics sequence 15 credits",
      "MATH 124, MATH 125, MATH 126",
    ],
  });

  assert.equal(parsedBlock.parsedRequirementGroups.length, 0);
});

test("Parser keeps Environmental Engineering Matrix/Linear Algebra separate from CEE 347", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Environmental Engineering Degree Sheet",
    planId: "uw-seattle-environmental-engineering",
    ownerId: "uw-seattle-environmental-engineering",
    courseCodes: ["AMATH 352", "MATH 208", "CEE 347"],
    snapshotLines: [
      "Matrix/Linear Algebra (AMATH 352 or MATH 208) 3cr",
      "CEE 347 Fundamentals of Fluid Mechanics (4)",
    ],
  });
  const matrixGroup = parsedBlock.parsedRequirementGroups.find((group) =>
    /Matrix\/Linear Algebra/i.test(group.sourceRowText ?? group.label ?? "")
  );
  const matrixOptions = matrixGroup?.options.flatMap((option) => option.uwCourses) ?? [];
  const atomCodes = parsedBlock.parsedRequirementAtomCandidates.map(
    (candidate) => candidate.uwCourseCode
  );

  assert.ok(matrixGroup, "Expected Matrix/Linear Algebra to parse as its own option group.");
  assert.equal(matrixGroup.requirementType, "choose_one");
  assert.deepEqual(new Set(matrixOptions), new Set(["AMATH 352", "MATH 208"]));
  assert.equal(matrixOptions.includes("CEE 347"), false);
  assert.ok(atomCodes.includes("CEE 347"), "Expected CEE 347 to remain a separate row.");
});

test("Parser extracts Biology physics alternatives as one sequence-choice group", () => {
  const sequenceCourses = [
    "PHYS 114",
    "PHYS 115",
    "PHYS 121",
    "PHYS 122",
    "PHYS 141",
    "PHYS 142",
  ];
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Biology Requirements",
    planId: "uw-seattle-biology",
    courseCodes: sequenceCourses,
    snapshotLines: [
      "Two quarters of physics (8-10 credits): one of the following:",
      "PHYS 114, PHYS 115",
      "PHYS 121, PHYS 122",
      "PHYS 141, PHYS 142",
      "Genetics (3-5 credits): either GENOME 361, GENOME 371, or FISH 340/BIOL 340.",
    ],
  });
  const group = parsedBlock.parsedRequirementGroups.find(
    (candidate) => candidate.requirementType === "sequence_choice"
  );

  assert.ok(group, "Expected Biology physics alternatives to become a sequence_choice group.");
  assert.equal(group.requiredCount, 1);
  assert.equal(group.selectionCount, 1);
  assert.deepEqual(
    group.sequencePaths.map((path) => path.uwCourses),
    [
      ["PHYS 114", "PHYS 115"],
      ["PHYS 121", "PHYS 122"],
      ["PHYS 141", "PHYS 142"],
    ]
  );
  assert.equal(
    parsedBlock.parsedRequirementAtomCandidates.some((atom) =>
      sequenceCourses.includes(atom.uwCourseCode)
    ),
    false
  );
  assert.equal(parsedBlock.parserSequenceChoiceAuditRows[0]?.issue, "none");
});

test("Parser extracts Biochemistry calculus/algebra physics table as sequence paths with lab notes", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Biochemistry BA Requirements",
    planId: "uw-seattle-biochemistry",
    courseCodes: [
      "PHYS 121",
      "PHYS 122",
      "PHYS 123",
      "PHYS 114",
      "PHYS 115",
      "PHYS 116",
      "PHYS 117",
      "PHYS 118",
      "PHYS 119",
    ],
    snapshotLines: [
      "5) Physics (PHYS)",
      "Calculus-based or Algebra-based",
      "121 (5) 114 (4)",
      "122 (5) 115 (4)",
      "123 (5) 116 (4)",
      "Students taking the algebra-based course may count one credit of physics lab (Phys 117, 118, 119) as a science elective.",
    ],
  });
  const group = parsedBlock.parsedRequirementGroups.find(
    (candidate) => candidate.requirementType === "sequence_choice"
  );

  assert.ok(group, "Expected Biochemistry physics table to become a sequence_choice group.");
  assert.deepEqual(
    group.sequencePaths.map((path) => path.uwCourses),
    [
      ["PHYS 121", "PHYS 122", "PHYS 123"],
      ["PHYS 114", "PHYS 115", "PHYS 116"],
    ]
  );
  const algebraPath = group.sequencePaths.find((path) => /algebra-based/i.test(path.label));
  assert.ok(algebraPath, "Expected the algebra-based path label to be preserved.");
  assert.deepEqual(algebraPath.conditionalLabCourses, ["PHYS 117", "PHYS 118", "PHYS 119"]);
  assert.equal(
    parsedBlock.parsedRequirementAtomCandidates.some((atom) =>
      ["PHYS 121", "PHYS 122", "PHYS 123", "PHYS 114", "PHYS 115", "PHYS 116"].includes(
        atom.uwCourseCode
      )
    ),
    false
  );
});

test("Parser ignores lateral chemistry rows in bare-number physics sequence tables", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Chemistry BS Requirements",
    planId: "uw-seattle-chemistry",
    courseCodes: ["PHYS 121", "PHYS 122", "PHYS 123", "PHYS 114", "PHYS 115", "PHYS 116"],
    snapshotLines: [
      "7) Physical Chemistry (CHEM)",
      "456 (3)",
      "2) Physics (PHYS)",
      "a) Calculus-based or Algebra-based",
      "457 (3)",
      "121 (5)",
      "114 (4)",
      "461 (3)",
      "122 (5)",
      "115 (4)",
      "123 (5) 116 (4) 8) Biochemistry",
    ],
  });
  const group = parsedBlock.parsedRequirementGroups.find(
    (candidate) =>
      candidate.requirementType === "sequence_choice" &&
      (candidate.sequencePaths ?? []).some((path) => path.uwCourses.includes("PHYS 121"))
  );

  assert.ok(group, "Expected Chemistry physics alternatives to become a sequence_choice group.");
  assert.deepEqual(
    group.sequencePaths.map((path) => path.uwCourses),
    [
      ["PHYS 121", "PHYS 122", "PHYS 123"],
      ["PHYS 114", "PHYS 115", "PHYS 116"],
    ]
  );
  assert.equal(
    group.sequencePaths.some((path) =>
      path.uwCourses.some((courseCode) => ["PHYS 457", "PHYS 461"].includes(courseCode))
    ),
    false
  );
});

test("Generated registry preserves Biochemistry physics sequence-choice paths", () => {
  const isBiochemistryPhysicsSequenceGroup = (group) =>
    group?.requirementType === "sequence_choice" &&
    (group.sequencePaths ?? []).some((path) => path.uwCourses?.includes("PHYS 121")) &&
    (group.sequencePaths ?? []).some((path) => path.uwCourses?.includes("PHYS 114"));
  const sourceGroup = getSourceGeneratedRequirementGroups("uw-seattle-biochemistry").find(
    isBiochemistryPhysicsSequenceGroup
  );
  const runtimeGroup = getCompactRuntimeRequirementGroups("uw-seattle-biochemistry").find(
    (group) => group.id === sourceGroup?.id
  );
  const compactParsedGroup = getCompactParsedRequirementGroups("uw-seattle-biochemistry").find(
    (group) => group.id === sourceGroup?.id
  );

  for (const group of [sourceGroup, runtimeGroup, compactParsedGroup]) {
    assert.equal(group?.requirementType, "sequence_choice");
    assert.equal(group?.requirementShape, "sequence-choice");
    assert.equal(group?.requiredCount, 1);
    assert.equal(group?.selectionCount, 1);
    assert.equal(group?.minCourses, 1);
    assert.equal(group?.maxCourses, 1);
    assert.deepEqual(
      group?.sequencePaths?.map((path) => path.uwCourses),
      [
        ["PHYS 121", "PHYS 122", "PHYS 123"],
        ["PHYS 114", "PHYS 115", "PHYS 116"],
      ]
    );
    assert.equal(group?.options?.length, group?.sequencePaths?.length);
    assert.ok(
      group?.sequencePaths?.every((path) =>
        group.options.some(
          (option) =>
            option.sequencePathId === path.id &&
            option.pathLabel === path.label &&
            option.uwCourses.join("|") === path.uwCourses.join("|")
        )
      )
    );
    const algebraPath = group?.sequencePaths?.find((path) => /algebra-based/i.test(path.label));
    const algebraOption = group?.options?.find((option) => option.sequencePathId === algebraPath?.id);
    assert.deepEqual(algebraPath?.conditionalLabCourses, ["PHYS 117", "PHYS 118", "PHYS 119"]);
    assert.deepEqual(algebraOption?.conditionalLabCourses, ["PHYS 117", "PHYS 118", "PHYS 119"]);
    assert.ok(
      group?.sequencePaths
        ?.find((path) => /calculus-based/i.test(path.label))
        ?.conditionalLabCourses.every((course) => !["PHYS 117", "PHYS 118", "PHYS 119"].includes(course))
    );
    if (group !== compactParsedGroup) {
      assert.ok(
        group?.sequencePaths?.every((path) => (path.mappedGrcCourseCodes ?? []).length > 0),
        "Expected generated/runtime sequence paths to preserve mapped GRC paths."
      );
    }
  }
});

test("Generated registry preserves sequence choices as one selected path and unselected alternatives", () => {
  for (const planId of ["uw-seattle-biology", "uw-seattle-biochemistry", "uw-seattle-chemistry"]) {
    const plan = sourceRegistry.resolveTransferPlannerMajorPlan(
      sourceRegistry.getTransferPlannerSourceGeneratedMajorPlan(planId),
      null
    );
    const sequenceItem = getChecklistItems(plan).find(
      (item) => item.requirementGroup?.requirementType === "sequence_choice"
    );
    const group = sequenceItem?.requirementGroup;

    assert.ok(group, `Expected ${planId} to expose a sequence_choice checklist group.`);
    assert.equal(group.requirementShape, "sequence-choice");
    assert.equal(group.requiredCount, 1);
    assert.equal(group.selectionCount, 1);
    assert.equal(sequenceItem.selectedRequirementOptionIds?.length, 1);
    assert.equal(
      sequenceItem.unselectedRequirementOptionIds?.length,
      Math.max(0, (group.options ?? []).length - 1)
    );
    assert.ok(
      (sequenceItem.grcCourses ?? []).length > 0,
      `Expected ${planId} selected sequence path to map to a GRC path.`
    );
    assert.ok(
      (sequenceItem.unselectedRequirementOptionIds ?? []).every(
        (optionId) => !sequenceItem.selectedRequirementOptionIds?.includes(optionId)
      )
    );
  }
});

test("Parser extracts standard versus honors sequence alternatives from inline source text", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Chemistry BA Requirements",
    planId: "uw-seattle-chemistry",
    courseCodes: ["CHEM 142", "CHEM 152", "CHEM 162", "CHEM 145", "CHEM 155", "CHEM 165"],
    snapshotLines: [
      "General Chemistry: choose one sequence: standard sequence CHEM 142, CHEM 152, CHEM 162 or honors sequence CHEM 145, CHEM 155, CHEM 165",
    ],
  });
  const group = parsedBlock.parsedRequirementGroups.find(
    (candidate) => candidate.requirementType === "sequence_choice"
  );

  assert.ok(group, "Expected Chemistry standard/honors text to become a sequence_choice group.");
  assert.deepEqual(
    group.sequencePaths.map((path) => path.uwCourses),
    [
      ["CHEM 142", "CHEM 152", "CHEM 162"],
      ["CHEM 145", "CHEM 155", "CHEM 165"],
    ]
  );
  assert.match(group.sequencePaths[0].label, /standard/i);
  assert.match(group.sequencePaths[1].label, /honors/i);
});

test("Parser extracts math sequence alternatives when the source says sequence", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Math Sequence Requirement",
    courseCodes: ["MATH 124", "MATH 125", "MATH 126", "MATH 134", "MATH 135", "MATH 136"],
    snapshotLines: [
      "Mathematics: choose one sequence: MATH 124, MATH 125, MATH 126 or MATH 134, MATH 135, MATH 136",
    ],
  });
  const group = parsedBlock.parsedRequirementGroups.find(
    (candidate) => candidate.requirementType === "sequence_choice"
  );

  assert.ok(group, "Expected math sequence alternatives to become one sequence_choice group.");
  assert.deepEqual(
    group.sequencePaths.map((path) => path.uwCourses),
    [
      ["MATH 124", "MATH 125", "MATH 126"],
      ["MATH 134", "MATH 135", "MATH 136"],
    ]
  );
});

test("Parser does not treat weak program option headings as comma-list choice context", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Business Administration Accounting Option",
    courseCodes: ["BBUS 300", "BBUS 310", "BBUS 490"],
    snapshotLines: [
      "Accounting option",
      "BBUS 490 - Special Topics in Business (300, 310), Only counts when approved for concentration; see your advisor before registering.",
    ],
  });

  assert.equal(parsedBlock.parsedRequirementGroups.length, 0);
});

test("Parser preserves choose-count output shape for choose-from course lists", () => {
  const options = ["IPM 506", "IPM 509", "IPM 510", "IPM 511", "IPM 512"];
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Community Environment and Planning Requirements",
    courseCodes: options,
    snapshotLines: [
      `Course Requirements (25 credits): Choose five from the following: ${options.join(", ")}`,
    ],
  });
  const group = parsedBlock.parsedRequirementGroups.find((candidate) =>
    /Choose five/i.test(candidate.sourceRowText ?? "")
  );

  assert.ok(group, "Expected choose-five text to become a choose_n group.");
  assert.equal(group.requirementType, "choose_n");
  assert.equal(group.selectionCount, 5);
  assert.equal(group.requiredCount, 5);
  assert.equal(group.detectedOptionCue, "choose count");
  assert.deepEqual(new Set(group.options.flatMap((option) => option.uwCourses)), new Set(options));
});

test("Parser extracts Computer Engineering approved science credit buckets as credit-based requirements", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Computer Engineering Degree Requirements",
    planId: "uw-seattle-computer-engineering",
    ownerId: "uw-seattle-computer-engineering",
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
  const naturalScienceBucket = parsedBlock.parsedRequirementGroups.find(
    (group) => group.approvedListKey === "computer-engineering-natural-science"
  );
  const mathScienceBucket = parsedBlock.parsedRequirementGroups.find(
    (group) => group.approvedListKey === "computer-engineering-math-science"
  );

  assert.ok(naturalScienceBucket, "Expected CE Natural Science approved bucket.");
  assert.equal(naturalScienceBucket.requirementType, "choose_credits");
  assert.equal(naturalScienceBucket.minCredits, 10);
  assert.equal(naturalScienceBucket.maxCredits, 10);
  assert.equal(naturalScienceBucket.requiredCount, null);
  assert.equal(naturalScienceBucket.canCreatePlaceholder, true);
  assert.equal(naturalScienceBucket.programSpecific, true);
  assert.equal(naturalScienceBucket.options[0]?.categoryOption?.category, "CE_NATURAL_SCIENCE");
  assert.equal(naturalScienceBucket.options[0]?.categoryOption?.programSpecific, true);
  assert.deepEqual(naturalScienceBucket.options[0]?.uwCourses, []);

  assert.ok(mathScienceBucket, "Expected CE Math/Science approved bucket.");
  assert.equal(mathScienceBucket.requirementType, "choose_credits");
  assert.equal(mathScienceBucket.minCredits, 3);
  assert.equal(mathScienceBucket.maxCredits, 6);
  assert.equal(mathScienceBucket.requiredCount, null);
  assert.equal(mathScienceBucket.canCreatePlaceholder, true);
  assert.equal(mathScienceBucket.programSpecific, true);
  assert.equal(mathScienceBucket.options[0]?.categoryOption?.category, "CE_MATH_SCIENCE");
});

test("Parser rule registry exposes reusable pattern rules", () => {
  const ruleIds = parser.getParserRuleRegistryForTest().map((rule) => rule.id);

  assert.ok(ruleIds.includes("option-replacement-group"));
  assert.ok(ruleIds.includes("sectioned-course-group"));
  assert.ok(ruleIds.includes("credit-bucket"));
  assert.ok(ruleIds.includes("sequence-or-either-or"));
  assert.ok(ruleIds.includes("support-source-filter"));
});

test("Parser extracts program-approved credit buckets from source text without a plan id hardcode", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Electrical Engineering Degree Requirements",
    planId: "uw-seattle-pattern-fixture",
    ownerId: "uw-seattle-pattern-fixture",
    ownerTitle: "Pattern Fixture",
    courseCodes: [],
    snapshotLines: [
      "Mathematics & Natural Sciences (41 credits)",
      "10 additional credits from the list of approved (10)",
      "natural science courses for Electrical Engineering on",
      "the department website",
    ],
  });
  const bucket = parsedBlock.parsedRequirementGroups.find(
    (group) => group.approvedListKey === "electrical-engineering-natural-science"
  );

  assert.ok(bucket, "Expected a source-derived Electrical Engineering Natural Science bucket.");
  assert.equal(bucket.requirementType, "choose_credits");
  assert.equal(bucket.minCredits, 10);
  assert.equal(bucket.programSpecific, true);
  assert.equal(bucket.options[0]?.categoryOption?.category, "EE_NATURAL_SCIENCE");
});

test("Parser keeps approved-list NSc credit buckets as placeholders when later approved lists are broad", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Electrical and Computer Engineering Degree Requirements",
    planId: "uw-seattle-electrical-computer-engineering",
    ownerId: "uw-seattle-electrical-computer-engineering",
    ownerTitle: "Electrical & Computer Engineering",
    courseCodes: ["EE 397", "EE 398", "EE 406", "EE 418", "CHEM 152", "CHEM 153", "CHEM 155", "CHEM 220"],
    snapshotLines: [
      "Mathematics (15-21 credits), complete one of the following:",
      "Additional NSc courses from approved list to reach 45 credits: see adviser for list of approved courses (scroll to Other Degree Information on bottom of page and open Department-Approved Lists accordion to review list).",
      "Department-Approved Lists",
      "Professional Issues:",
      "EE 397: Sex and Gender in Engineering",
      "EE 398: Introduction to Professional Issues",
      "EE 406: Teaching Engineering",
      "EE 418: Network Security and Cryptography",
      "Natural Sciences:",
      "CHEM 152: General Chemistry, CHEM 153: Accelerated General Chemistry, CHEM 155: Honors General Chemistry, CHEM 220: Principles of Chemistry II",
    ],
  });
  const bucket = parsedBlock.parsedRequirementGroups.find((group) =>
    /Additional NSc courses from approved list/i.test(group.sourceRowText ?? group.label ?? "")
  );

  assert.ok(bucket, "Expected the ECE approved NSc bucket to be retained.");
  assert.equal(bucket.requirementType, "choose_credits");
  assert.equal(bucket.minCredits, 45);
  assert.equal(bucket.maxCredits, 45);
  assert.equal(bucket.approvedListKey, "electrical-and-computer-engineering-natural-science");
  assert.equal(bucket.programSpecific, true);
  assert.equal(bucket.options.length, 1);
  assert.equal(bucket.options[0]?.optionKind, "category-option");
  assert.equal(bucket.options[0]?.categoryOption?.category, "ECE_NATURAL_SCIENCE");
  assert.equal(bucket.options[0]?.categoryOption?.programSpecific, true);
  assert.deepEqual(bucket.options[0]?.uwCourses, []);
});

test("Parser extracts option replacement groups from section headings instead of a course-list hardcode", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Nanoscience and Molecular Engineering Option",
    planId: "uw-seattle-materials-pattern-fixture",
    pathwayId: "nme-option",
    ownerId: "uw-seattle-materials-pattern-fixture:pathway:nme-option",
    ownerTitle: "Materials Science and Engineering - NME Option",
    courseCodes: ["NME 220", "BIOEN 423", "BIOEN 490", "CHEME 490", "MSE 486", "EE 486", "ENGR 321"],
    snapshotLines: [
      "Nanoscience and Molecular Engineering (NME) Option",
      "Students complete all MSE degree requirements except the 15 credit Technical Elective requirement. In place of the 15 credit Technical Elective requirement, NME Option students complete the 19 credit NME Core and Elective Requirements below.",
      "NME core (4 credits)",
      "NME 220*",
      "Introduction to Molecular and Nanoscale Principles",
      "*NME 220 must be taken in the spring of the sophomore or junior year.",
      "NME electives (15 credits required)",
      "BIOEN 423",
      "Introduction to Synthetic Biology (offered A) (Prereq MATH 207 or MATH 307 and MATH 208 or MATH 308)",
      "BIOEN/CHEM E 490",
      "Engineering Materials for Biomedical Applications (offered A)",
      "MSE 486/ EE 486",
      "Fundamentals of Integrated Circuit Technology (offered various quarters)",
      "ENGR 321",
      "Internship Class (maximum of 4 credits allowed towards degree)",
      "1-2",
      "B.S. degree requirements",
    ],
  });
  const group = parsedBlock.parsedRequirementGroups.find((candidate) =>
    candidate.id.endsWith(":mse-nme-core-elective-19-credits")
  );
  const replacement = parsedBlock.parsedRequirementReplacements[0];
  const bioen490 = group?.options.find((option) => option.uwCourses.includes("BIOEN 490"));
  const mse486 = group?.options.find((option) => option.uwCourses.includes("MSE 486"));
  const engr321 = group?.options.find((option) => option.uwCourses.includes("ENGR 321"));

  assert.ok(group, "Expected the NME option section to become a 19-credit group.");
  assert.equal(group.requirementType, "choose_credits");
  assert.equal(group.minCredits, 19);
  assert.ok(group.options.some((option) => option.uwCourses.includes("NME 220")));
  assert.ok(group.options.some((option) => option.uwCourses.includes("BIOEN 423")));
  assert.deepEqual(bioen490?.equivalentUwCourseCodes, ["CHEME 490"]);
  assert.deepEqual(mse486?.equivalentUwCourseCodes, ["EE 486"]);
  assert.equal(engr321?.creditText, "1-2");
  assert.ok(replacement?.baseRequirementId.endsWith(":mse-technical-electives-15-credits"));
  assert.equal(replacement?.replacedByRequirementId, group.id);
  assert.equal(replacement?.appliesWhen, 'selectedOption === "NME"');
  assert.ok(
    parsedBlock.sourceSectionFilterAuditRows.some(
      (row) =>
        /19 credit NME Core and Elective Requirements/i.test(row.rawLine ?? "") &&
        row.detectedSectionRole === "primary-requirement-section" &&
        row.schedulable === true
    ),
    "Expected option-replacement source text to scope the following section as schedulable."
  );
  assert.ok(
    parsedBlock.sourceSectionFilterAuditRows
      .filter((row) => (row.courseCodesExtracted ?? []).includes("NME 220"))
      .every((row) => row.schedulable === true),
    "Expected NME 220 evidence rows to stay schedulable under the option-replacement rule."
  );
});

test("Parser prefers focused pathway child HTML over merging a broad parent source", () => {
  const entry = {
    ownerType: "pathway",
    ownerId: "uw-seattle-materials-science-engineering:pathway:nme-option",
    ownerTitle: "Materials Science & Engineering - Nanoscience and Molecular Engineering (NME) Option",
    planId: "uw-seattle-materials-science-engineering",
    pathwayId: "nme-option",
    campusId: "uw-seattle",
    label: "UW Materials Science degree requirements",
    url: "https://mse.washington.edu/current/undergrad/courses",
    role: "non-schedulable-course-list",
    parserType: "generic-html",
  };
  const baseParsed = {
    title: "MSE undergraduate courses",
    headings: ["MSE undergraduate courses"],
    courseCodes: Array.from({ length: 110 }, (_, index) => `MSE ${400 + index}`),
    requirementCueLines: [
      "NME Option students complete all MSE degree requirements except the 15 credit Technical Elective requirement.",
    ],
    chooseStatements: [],
    pathwayLabels: ["Nanoscience and Molecular Engineering (NME) Option"],
    snapshotLines: [
      "NME Option students complete all MSE degree requirements except the 15 credit Technical Elective requirement.",
      "MSE technical electives",
    ],
  };
  const childCandidate = {
    url: "https://mse.washington.edu/current/undergrad/nmeoption",
    label: "Nanoscience & Molecular Engineering Option Requirements",
    type: "general",
    sameProgramRequirementLink: true,
  };
  const childParsed = {
    title: "Nanoscience and Molecular Engineering (NME) Option",
    headings: ["Nanoscience and Molecular Engineering (NME) Option"],
    courseCodes: ["NME 220", "BIOEN 423", "MSE 452", "ENGR 321"],
    requirementCueLines: [
      "Students complete all MSE degree requirements except the 15 credit Technical Elective requirement.",
      "In place of the 15 credit Technical Elective requirement, NME Option students complete the 19 credit NME Core and Elective Requirements below.",
    ],
    chooseStatements: [],
    pathwayLabels: ["Nanoscience and Molecular Engineering (NME) Option"],
    snapshotLines: [
      "Nanoscience and Molecular Engineering (NME) Option",
      "Students complete all MSE degree requirements except the 15 credit Technical Elective requirement. In place of the 15 credit Technical Elective requirement, NME Option students complete the 19 credit NME Core and Elective Requirements below.",
      "NME core (4 credits)",
      "NME 220",
      "NME electives (15 credits required)",
      "BIOEN 423",
      "MSE 452",
      "ENGR 321",
    ],
  };

  assert.equal(
    parser.shouldPreferSupplementalHtmlSourceForTest(entry, baseParsed, childCandidate, childParsed),
    true
  );
});

test("Parser extracts sectioned course groups from source headings without a plan id hardcode", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Sectioned course fixture",
    planId: "uw-seattle-sectioned-course-fixture",
    ownerId: "uw-seattle-sectioned-course-fixture",
    ownerTitle: "Sectioned Course Fixture",
    courseCodes: ["AA 260", "BIOEN 215", "NME 220", "MSE 450", "MSE 499", "AMATH 352", "ENGR 321"],
    snapshotLines: [
      "Engineering Fundamentals requirements",
      "8 Credits of Engineering Fundamentals Electives selected from the following list:",
      "AA 260",
      "Thermodynamics (4 Credits)",
      "BIOEN 215",
      "Introduction to Bioengineering Problem Solving (3 Credits)",
      "NME 220",
      "Introduction to Molecular and Nanoscale Principles (4 credits)",
      "Required core courses",
      "Technical electives: 15 credits total",
      "A minimum of 6 credits in MSE 400-level courses listed below are required.",
      "MSE 450",
      "Magnetism, Magnetic Materials, and Related Technologies",
      "3",
      "MSE 499",
      "Senior Project",
      "3-5",
      "Other technical electives",
      "A maximum of 9 credits in 400-level courses in the following departments will satisfy the technical electives requirement.",
      "A MATH 352",
      "Applied Linear Algebra & Numerical Analysis",
      "3",
      "ENGR 321",
      "Engineering Internship (can count a maximum of 4 cr. towards degree)",
      "1-2",
      "Undergraduate advising",
    ],
  });
  const engineeringGroup = parsedBlock.parsedRequirementGroups.find((group) =>
    /Engineering Fundamentals Electives/i.test(group.label)
  );
  const mseTechnicalGroup = parsedBlock.parsedRequirementGroups.find((group) =>
    /MSE 400-level courses/i.test(group.label)
  );
  const outsideTechnicalGroup = parsedBlock.parsedRequirementGroups.find((group) =>
    /maximum of 9 credits/i.test(group.label)
  );
  const engr321 = outsideTechnicalGroup?.options.find((option) =>
    option.uwCourses.includes("ENGR 321")
  );

  assert.ok(engineeringGroup, "Expected the engineering fundamentals list to become a credit group.");
  assert.equal(engineeringGroup.requirementType, "choose_credits");
  assert.equal(engineeringGroup.minCredits, 8);
  assert.ok(engineeringGroup.options.some((option) => option.uwCourses.includes("AA 260")));
  assert.ok(engineeringGroup.options.some((option) => option.uwCourses.includes("NME 220")));

  assert.ok(mseTechnicalGroup, "Expected the MSE 400-level list to become a credit group.");
  assert.equal(mseTechnicalGroup.minCredits, 6);
  assert.equal(mseTechnicalGroup.maxCredits, null);
  assert.ok(mseTechnicalGroup.options.some((option) => option.uwCourses.includes("MSE 450")));
  assert.equal(
    mseTechnicalGroup.options.find((option) => option.uwCourses.includes("MSE 499"))?.creditText,
    "3-5"
  );

  assert.ok(outsideTechnicalGroup, "Expected the outside technical electives list to become a capped credit group.");
  assert.equal(outsideTechnicalGroup.minCredits, 0);
  assert.equal(outsideTechnicalGroup.maxCredits, 9);
  assert.equal(engr321?.creditText, "1-2");
  assert.ok(engr321?.constraints.includes("max_degree_counting_credits:4"));
});

test("Parser uses extracted heading metadata to keep sectioned source rows under the correct heading", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "A&A degree requirements",
    planId: "uw-seattle-heading-metadata-fixture",
    ownerId: "uw-seattle-heading-metadata-fixture",
    ownerTitle: "Heading Metadata Fixture",
    courseCodes: ["MATH 124", "CHEM 142", "AA 301"],
    headings: [
      "Mathematics (27 credits)",
      "Sciences (25 credits)",
      "A&A Core Courses (50 credits)",
    ],
    snapshotLines: [
      "Mathematics (27 credits)",
      "MATH 124 Calculus with Analytic Geometry I (5)",
      "Sciences (25 credits)",
      "CHEM 142 General Chemistry (5)",
      "A&A Core Courses (50 credits)",
      "AA 301 Compressible Aerodynamics (4)",
    ],
  });

  const rowsByCode = new Map(
    parsedBlock.sourceSectionFilterAuditRows.flatMap((row) =>
      row.courseCodesExtracted.map((courseCode) => [courseCode, row])
    )
  );

  assert.equal(rowsByCode.get("MATH 124")?.sectionTitle, "Mathematics (27 credits)");
  assert.equal(rowsByCode.get("CHEM 142")?.sectionTitle, "Sciences (25 credits)");
  assert.equal(rowsByCode.get("AA 301")?.sectionTitle, "A&A Core Courses (50 credits)");
});

test("Parser ignores graduate sectioned course lists for undergraduate requirement groups", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    url: "https://mse.washington.edu/student/applied-masters",
    label: "Applied Master's Program",
    planId: "uw-seattle-sectioned-course-fixture",
    ownerId: "uw-seattle-sectioned-course-fixture",
    ownerTitle: "Sectioned Course Fixture",
    courseCodes: ["MSE 570", "MSE 571"],
    snapshotLines: [
      "Applied Master's Program",
      "All of the 36 required course credits outlined below must be at the 400-level or above to count toward graduate credits.",
      "Elective courses",
      "9 credits of elective courses selected from the following list:",
      "MSE 570",
      "Graduate Tutorial in Materials Science and Engineering",
      "MSE 571",
      "Graduate Tutorial in Materials Science and Engineering",
    ],
  });

  assert.equal(
    parsedBlock.parsedRequirementGroups.some((group) =>
      group.options.some((option) => option.uwCourses.includes("MSE 570"))
    ),
    false
  );
  assert.equal(parsedBlock.parsedRequirementCourses.length, 0);
});

test("Parser extracts split either-or course rows as alternatives without a major-specific branch", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Programming Requirement",
    planId: "uw-seattle-pattern-fixture",
    ownerId: "uw-seattle-pattern-fixture",
    courseCodes: ["CSE 123", "CSE 143"],
    snapshotLines: [
      "Fundamentals",
      "(5) \uF071 * CSE 123 Intro to Computer Programming III (4)",
      "OR",
      "* CSE 143 Computer Programming II (5)",
    ],
  });
  const group = parsedBlock.parsedRequirementGroups.find((candidate) =>
    /CSE 123 or CSE 143/i.test(candidate.label ?? "")
  );

  assert.ok(group, "Expected split OR rows to become a choose-one group.");
  assert.equal(group.requirementType, "choose_one");
  assert.deepEqual(
    new Set(group.options.flatMap((option) => option.uwCourses)),
    new Set(["CSE 123", "CSE 143"])
  );
  assert.equal(
    parsedBlock.parsedRequirementAtomCandidates.some((atom) =>
      ["CSE 123", "CSE 143"].includes(atom.uwCourseCode)
    ),
    false
  );
});

test("Parser extracts shorthand programming parenthetical lists as true options", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Engineering Fundamentals",
    planId: "uw-seattle-pattern-fixture",
    ownerId: "uw-seattle-pattern-fixture",
    courseCodes: ["AMATH 301", "CSE 121", "CSE 122", "CSE 123", "CSE 142", "CSE 160"],
    snapshotLines: [
      "Engineering Fundamentals (12 credits)",
      "Technical Electives are CEE 400-level courses that provide",
      "Computer Programming",
      "4cr",
      "students with in-depth knowledge and design experience.",
      "(AMATH 301, CSE 121, 122, 123, 142 or 160)",
      "See BSENVE Technical Electives list for details.",
    ],
  });
  const group = parsedBlock.parsedRequirementGroups.find((candidate) =>
    /Computer Programming/i.test(candidate.label ?? "")
  );

  assert.ok(group, "Expected Computer Programming to emit a true option group.");
  assert.equal(group.requirementType, "choose_one");
  assert.deepEqual(
    new Set(group.options.flatMap((option) => option.uwCourses)),
    new Set(["AMATH 301", "CSE 121", "CSE 122", "CSE 123", "CSE 142", "CSE 160"])
  );
});

test("Parser support-source filter does not schedule support-only approved-list note courses", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Computer Science Degree Requirements",
    planId: "uw-seattle-pattern-fixture",
    ownerId: "uw-seattle-pattern-fixture",
    courseCodes: ["CSE 121", "CSE 122", "CSE 123"],
    snapshotLines: [
      "Fundamentals",
      "CSE 123 Intro to Computer Programming III (4)",
      "Areas of Inquiry",
      "Note: All Mathematics & Science courses below as well as CSE 121, CSE 122, and CSE 123 count toward the 20 credits of Natural Sciences and 15 credits of Additional Coursework requirements.",
    ],
  });
  const atomCodes = parsedBlock.parsedRequirementAtomCandidates.map((candidate) => candidate.uwCourseCode);

  assert.deepEqual(atomCodes, ["CSE 123"]);
  assert.equal(parsedBlock.parsedUwCourseCodes.includes("CSE 121"), false);
  assert.equal(parsedBlock.parsedUwCourseCodes.includes("CSE 122"), false);
});

test("Generated registry preserves CE credit-bucket shapes and program-specific approved-list keys", () => {
  const sourceGroups = getSourceGeneratedRequirementGroups("uw-seattle-computer-engineering");
  const runtimeGroups = getCompactRuntimeRequirementGroups("uw-seattle-computer-engineering");
  const compactParsedGroups = getCompactParsedRequirementGroups("uw-seattle-computer-engineering");
  const sourceNaturalScience = sourceGroups.find(
    (group) => group.id === "uw-seattle-computer-engineering:requirement-group:approved-natural-science-10-credits"
  );
  const sourceMathScience = sourceGroups.find(
    (group) => group.id === "uw-seattle-computer-engineering:requirement-group:additional-math-science-3-6-credits"
  );
  const runtimeNaturalScience = runtimeGroups.find((group) => group.id === sourceNaturalScience?.id);
  const runtimeMathScience = runtimeGroups.find((group) => group.id === sourceMathScience?.id);
  const parsedMathScience = compactParsedGroups.find(
    (group) => group.approvedListKey === "computer-engineering-math-science"
  );

  assert.equal(sourceNaturalScience?.requirementType, "choose_credits");
  assert.equal(sourceNaturalScience?.requirementShape, "credit-bucket");
  assert.equal(sourceNaturalScience?.minCredits, 10);
  assert.equal(sourceNaturalScience?.maxCredits, 10);
  assert.equal(sourceNaturalScience?.creditText, "10");
  assert.equal(sourceNaturalScience?.satisfactionMode, "credit-based");
  assert.equal(sourceNaturalScience?.requiredCount, null);
  assert.equal(sourceNaturalScience?.selectionCount, null);
  assert.equal(sourceNaturalScience?.minCourses, null);
  assert.equal(sourceNaturalScience?.maxCourses, null);
  assert.equal(sourceNaturalScience?.approvedListKey, "computer-engineering-natural-science");
  assert.equal(sourceNaturalScience?.programSpecific, true);
  assert.equal(
    sourceNaturalScience?.options.find((option) => option.optionKind === "category-option")
      ?.categoryOption?.programSpecific,
    true
  );
  assert.deepEqual(
    sourceNaturalScience?.options.find((option) => option.optionKind === "category-option")
      ?.grcMatches,
    []
  );
  assert.equal(
    sourceNaturalScience?.options.find((option) => option.optionKind === "category-option")
      ?.categoryOption?.approvedListKey,
    "computer-engineering-natural-science"
  );

  assert.equal(sourceMathScience?.requirementType, "choose_credits");
  assert.equal(sourceMathScience?.requirementShape, "credit-bucket");
  assert.equal(sourceMathScience?.minCredits, 3);
  assert.equal(sourceMathScience?.maxCredits, 6);
  assert.equal(sourceMathScience?.creditText, "3-6");
  assert.equal(sourceMathScience?.satisfactionMode, "credit-based");
  assert.equal(sourceMathScience?.requiredCount, null);
  assert.equal(sourceMathScience?.selectionCount, null);
  assert.equal(sourceMathScience?.approvedListKey, "computer-engineering-math-science");
  assert.equal(sourceMathScience?.programSpecific, true);
  assert.equal(runtimeNaturalScience?.requirementType, "choose_credits");
  assert.equal(runtimeNaturalScience?.satisfactionMode, "credit-based");
  assert.equal(runtimeMathScience?.requirementType, "choose_credits");
  assert.equal(runtimeMathScience?.satisfactionMode, "credit-based");
  assert.equal(parsedMathScience?.requirementType, "choose_credits");
  assert.equal(parsedMathScience?.satisfactionMode, "credit-based");
  assert.equal(parsedMathScience?.approvedListKey, "computer-engineering-math-science");
});

test("Parser preserves A&A mixed course and NSc category options without inventing courses", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Aeronautics and Astronautics Degree Requirements",
    courseCodes: ["CSE 160", "ME 123"],
    snapshotLines: [
      "CSE 160 Data Programming (Python) or ME 123 Introduction to Visualization and Computer-Aided Design (Solidworks) (5) or other Natural Sciences - NSc (5)",
    ],
  });
  const group = parsedBlock.parsedRequirementGroups.find((candidate) =>
    (candidate.options ?? []).some((option) => option.categoryOption?.category === "NSC")
  );
  const categoryOption = group?.options.find((option) => option.categoryOption?.category === "NSC");

  assert.ok(group, "Expected the A&A mixed course/category choice group.");
  assert.equal(group.requirementType, "choose_one");
  assert.deepEqual(
    new Set(group.options.flatMap((option) => option.uwCourses)),
    new Set(["CSE 160", "ME 123"])
  );
  assert.ok(categoryOption, "Expected the NSc category option.");
  assert.equal(categoryOption.optionKind, "category-option");
  assert.equal(categoryOption.categoryOption?.credits, 5);
  assert.equal(categoryOption.categoryOption?.sourceCategoryCode, "NSc");
  assert.deepEqual(categoryOption.uwCourses, []);
  assert.deepEqual(categoryOption.displayCourseCodes, []);
  assert.equal(
    parsedBlock.parsedRequirementGroups.some((candidate) =>
      /Natural Sciences - NSc/i.test(candidate.sourceRowText ?? "") &&
      candidate.requirementType === "choose_credits"
    ),
    false
  );
});

test("Generated registry preserves A&A mixed course/category option shape", () => {
  const sourceGroups = getSourceGeneratedRequirementGroups("uw-seattle-aeronautics-astronautics");
  const runtimeGroups = getCompactRuntimeRequirementGroups("uw-seattle-aeronautics-astronautics");
  const compactParsedGroups = getCompactParsedRequirementGroups("uw-seattle-aeronautics-astronautics");
  const sourceGroup = sourceGroups.find((group) =>
    (group.options ?? []).some((option) => option.categoryOption?.sourceCategoryCode === "NSc")
  );
  const runtimeGroup = runtimeGroups.find((group) => group.id === sourceGroup?.id);
  const parsedGroup = compactParsedGroups.find((group) =>
    (group.options ?? []).some((option) => option.categoryOption?.sourceCategoryCode === "NSc")
  );

  for (const group of [sourceGroup, runtimeGroup, parsedGroup]) {
    assert.equal(group?.requirementType, "choose_one");
    const nscOption = group?.options.find(
      (option) => option.categoryOption?.sourceCategoryCode === "NSc"
    );
    assert.equal(nscOption?.optionKind, "category-option");
    assert.equal(nscOption?.categoryOption?.credits, 5);
    assert.deepEqual(nscOption?.uwCourses, []);
    assert.deepEqual(nscOption?.equivalentUwCourseCodes ?? [], []);
    assert.deepEqual(nscOption?.displayCourseCodes ?? [], []);
    assert.deepEqual(nscOption?.grcMatches, []);
  }
  assert.deepEqual(
    studentRuntime.getTransferPlannerMajorPlan("uw-seattle-aeronautics-astronautics")?.supportLists ?? [],
    []
  );
});

test("Generated registry preserves A&A sectioned elective row credits from source text", () => {
  const runtimeGroups = getCompactRuntimeRequirementGroups("uw-seattle-aeronautics-astronautics");
  const technicalElectives = runtimeGroups.find((group) =>
    /A&A Technical Electives/i.test(group.label ?? group.sourceHeading ?? "")
  );
  assert.ok(technicalElectives, "Expected the A&A technical electives group.");

  const creditsByCourse = new Map(
    (technicalElectives.options ?? []).flatMap((option) =>
      (option.uwCourses ?? []).map((courseCode) => [courseCode, option.credits])
    )
  );
  assert.equal(creditsByCourse.get("AA 516"), 3);
  assert.equal(creditsByCourse.get("AA 532"), 3);
});

test("Category mapping keeps generic NSc separate from program-approved science filters", () => {
  const aaPlan = getCompactRuntimePlan("uw-seattle-aeronautics-astronautics");
  const cePlan = getCompactRuntimePlan("uw-seattle-computer-engineering");
  const csPlan = getCompactRuntimePlan("uw-seattle-computer-science", "data-science-option");

  const aaNsc = planner.auditCategoryMapping({
    ownerId: "uw-seattle-aeronautics-astronautics",
    plan: aaPlan,
    candidateCourseCodes: ["ANTH& 205"],
  }).find((row) => /NSc|Natural Sciences/i.test(row.category));
  assert.equal(aaNsc?.programSpecificFilter, null);
  assert.equal(aaNsc?.eligible, true);
  assert.equal(aaNsc?.reason, "generic-category-match");
  assert.equal(aaNsc?.issue, null);

  const ceRows = planner.auditCategoryMapping({
    ownerId: "uw-seattle-computer-engineering",
    plan: cePlan,
    candidateCourseCodes: ["ANTH& 205", "PHYS& 223"],
  });
  const ceAnth = ceRows.find(
    (row) =>
      /Natural Science/i.test(row.requirement) &&
      row.candidateGrcCourse === "ANTH& 205"
  );
  const cePhys = ceRows.find(
    (row) =>
      /Natural Science/i.test(row.requirement) &&
      row.candidateGrcCourse === "PHYS& 223"
  );
  assert.equal(ceAnth?.programSpecificFilter, "computer-engineering-natural-science");
  assert.deepEqual(ceAnth?.genericCategoryTags, ["NSC"]);
  assert.equal(ceAnth?.programApproved, false);
  assert.equal(ceAnth?.eligible, false);
  assert.equal(ceAnth?.reason, "rejected-generic-only");
  assert.equal(ceAnth?.issue, null);
  assert.equal(cePhys?.programApproved, true);
  assert.equal(cePhys?.eligible, true);
  assert.equal(cePhys?.reason, "program-approved-equivalent");

  const csRows = planner.auditCategoryMapping({
    ownerId: "uw-seattle-computer-science:pathway:data-science-option",
    plan: csPlan,
    candidateCourseCodes: ["ANTH& 205", "CS 121", "PHYS& 221"],
  });
  const csAnth = csRows.find(
    (row) =>
      /Natural Sciences/i.test(row.requirement) &&
      row.candidateGrcCourse === "ANTH& 205"
  );
  const cs121 = csRows.find(
    (row) =>
      /Natural Sciences/i.test(row.requirement) &&
      row.candidateGrcCourse === "CS 121"
  );
  const csPhys = csRows.find(
    (row) =>
      /Natural Sciences/i.test(row.requirement) &&
      row.candidateGrcCourse === "PHYS& 221"
  );
  assert.equal(csAnth?.programSpecificFilter, "computer-science-approved-science");
  assert.deepEqual(csAnth?.genericCategoryTags, ["NSC"]);
  assert.equal(csAnth?.programApproved, false);
  assert.equal(csAnth?.eligible, false);
  assert.equal(csAnth?.reason, "rejected-generic-only");
  assert.equal(cs121?.programSpecificFilter, "computer-science-approved-science");
  assert.equal(cs121?.programApproved, false);
  assert.equal(cs121?.eligible, false);
  assert.equal(cs121?.reason, "rejected-generic-only");
  assert.equal(csPhys?.programSpecificFilter, "computer-science-approved-science");
  assert.equal(csPhys?.programApproved, true);
  assert.equal(csPhys?.eligible, true);
  assert.equal(csPhys?.reason, "program-approved-equivalent");
});

test("Completed generic NSc course does not satisfy CE approved Natural Science", () => {
  const plan = getCompactRuntimePlan("uw-seattle-computer-engineering");
  const completedCourses = [{ code: "ANTH& 205", label: "ANTH& 205", credits: 5 }];
  const quarterPlan = buildQuarterPlanForTest(plan, { completedCourses });
  const transcriptAudit = planner.auditCategoryTranscriptSatisfaction({
    plan,
    suggestedPlan: quarterPlan,
    completedCourses,
  });
  const naturalScience = transcriptAudit.find((row) =>
    /Computer Engineering Natural Science/i.test(row.categoryOption)
  );

  assert.deepEqual(naturalScience?.completedCandidateCourses, []);
  assert.equal(naturalScience?.chosenTranscriptSatisfier, null);
  assert.match(naturalScience?.copyOnlyDebugText ?? "", /Completed candidate courses: none/);
});

test("Program approved filters cross-check official UW lists against GRC equivalencies", () => {
  const ceRows = planner.auditProgramApprovedCourseFilters({
    filterKey: "computer-engineering-natural-science",
  });
  const csRows = planner.auditProgramApprovedCourseFilters({
    filterKey: "computer-science-approved-science",
  });

  const ceChem161 = ceRows.find(
    (row) =>
      row.included &&
      row.approvedUwCode === "CHEM 142" &&
      row.grcEquivalentPath.join(" + ") === "CHEM& 161"
  );
  const cePhys223 = ceRows.find(
    (row) =>
      row.included &&
      row.approvedUwCode === "PHYS 123" &&
      row.grcEquivalentPath.join(" + ") === "PHYS& 223"
  );
  const ceBiolSequence = ceRows.find(
    (row) =>
      row.included &&
      row.approvedUwCode.includes("BIOL 180") &&
      row.grcEquivalentPath.join(" + ") === "BIOL& 211 + BIOL& 212 + BIOL& 213"
  );
  const csPhys221 = csRows.find(
    (row) =>
      row.included &&
      row.approvedUwCode === "PHYS 121" &&
      row.grcEquivalentPath.join(" + ") === "PHYS& 221"
  );
  const csChem161 = csRows.find(
    (row) =>
      row.included &&
      row.approvedUwCode === "CHEM 142" &&
      row.grcEquivalentPath.join(" + ") === "CHEM& 161"
  );
  const csCse121 = csRows.find(
    (row) => /CSE 121/.test(row.approvedUwCode) && row.grcEquivalentPath.includes("CS 121")
  );

  assert.equal(ceChem161?.reason, "approved-uw-equivalent");
  assert.equal(cePhys223?.reason, "approved-uw-equivalent");
  assert.equal(ceBiolSequence?.reason, "compound-path");
  assert.equal(csPhys221?.reason, "approved-uw-equivalent");
  assert.equal(csChem161?.reason, "approved-uw-equivalent");
  assert.equal(csCse121?.included, false);
  assert.equal(csCse121?.reason, "generic-category-only");
  assert.ok(
    ceRows.some((row) => row.reason === "generic-category-only" && /ANTH& 205/.test(row.copyOnlyDebugText)),
    "Expected generic NSc rows to be explicitly excluded from CE approved filter."
  );
});

test("Parser extracts generic category credit buckets without concrete course options", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Generic Areas of Inquiry",
    courseCodes: [],
    snapshotLines: [
      "Areas of Inquiry Requirements (24 credits)",
      "Arts and Humanities - A&H (10)",
      "Social Sciences - SSc (10)",
      "5 additional diversity credits are required and can overlap with other areas of inquiry requirements - DIV",
      "5 credits of A&H or SSc",
      "minimum 10 credits of NSc",
      "15 credits from approved electives",
    ],
  });
  const ahSscBucket = parsedBlock.parsedRequirementGroups.find((group) =>
    /A&H or SSc/i.test(group.sourceRowText ?? "")
  );
  const nscBucket = parsedBlock.parsedRequirementGroups.find((group) =>
    /minimum 10 credits of NSc/i.test(group.sourceRowText ?? "")
  );
  const approvedElectiveBucket = parsedBlock.parsedRequirementGroups.find((group) =>
    /approved electives/i.test(group.sourceRowText ?? "")
  );
  const artsBucket = parsedBlock.parsedRequirementGroups.find((group) =>
    /Arts and Humanities - A&H/i.test(group.sourceRowText ?? "")
  );
  const socialBucket = parsedBlock.parsedRequirementGroups.find((group) =>
    /Social Sciences - SSc/i.test(group.sourceRowText ?? "")
  );
  const diversityBucket = parsedBlock.parsedRequirementGroups.find((group) =>
    /additional diversity credits/i.test(group.sourceRowText ?? "")
  );
  const socialWelfareDistributionLine =
    "Please note, students with admission requirement or Social Welfare prerequisite deficiencies must meet with the academic advisor regarding completion of deficiencies. Also, students who have not completed at least 20 credits of Arts and Humanities (A&H) or 20 credits of Natural Sciences (NSc) distribution within their lower-division coursework must meet with the academic advisor regarding selection of appropriate courses within an elective category to complete requirements.";
  const socialWelfareBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Tacoma Social Welfare distribution note",
    planId: "uw-tacoma-social-welfare",
    ownerId: "uw-tacoma-social-welfare",
    ownerTitle: "Social Welfare (BA)",
    courseCodes: [],
    snapshotLines: [socialWelfareDistributionLine],
  });
  const socialWelfareDistributionBucket = socialWelfareBlock.parsedRequirementGroups.find(
    (group) => group.requirementType === "choose_credits" && /Arts and Humanities/i.test(group.sourceRowText ?? "")
  );
  const socialWelfareDuplicateChoice = socialWelfareBlock.parsedRequirementGroups.find(
    (group) => group.requirementType === "choose_one" && /Arts and Humanities/i.test(group.sourceRowText ?? "")
  );

  assert.equal(ahSscBucket?.requirementType, "choose_credits");
  assert.equal(ahSscBucket?.requirementShape, "credit-bucket");
  assert.equal(ahSscBucket?.minCredits, 5);
  assert.equal(ahSscBucket?.maxCredits, 5);
  assert.equal(ahSscBucket?.creditText, "5");
  assert.equal(ahSscBucket?.satisfactionMode, "credit-based");
  assert.equal(ahSscBucket?.requiredCount, null);
  assert.equal(ahSscBucket?.selectionCount, null);
  assert.deepEqual(
    new Set(ahSscBucket?.options.map((option) => option.categoryOption?.category)),
    new Set(["AH", "SSC"])
  );
  assert.ok(
    ahSscBucket?.options.every(
      (option) =>
        option.optionKind === "category-option" &&
        option.uwCourses.length === 0 &&
        option.displayCourseCodes.length === 0
    )
  );
  assert.equal(nscBucket?.requirementType, "choose_credits");
  assert.equal(nscBucket?.minCredits, 10);
  assert.equal(nscBucket?.maxCredits, null);
  assert.equal(nscBucket?.satisfactionMode, "credit-based");
  assert.equal(nscBucket?.options[0]?.categoryOption?.category, "NSC");
  assert.equal(approvedElectiveBucket?.requirementType, "choose_credits");
  assert.equal(approvedElectiveBucket?.satisfactionMode, "credit-based");
  assert.match(approvedElectiveBucket?.approvedListKey ?? "", /approved-electives/);
  assert.equal(approvedElectiveBucket?.canCreatePlaceholder, true);
  assert.equal(artsBucket?.minCredits, 10);
  assert.equal(artsBucket?.options[0]?.categoryOption?.sourceCategoryCode, "A&H");
  assert.equal(socialBucket?.minCredits, 10);
  assert.equal(socialBucket?.options[0]?.categoryOption?.sourceCategoryCode, "SSc");
  assert.equal(diversityBucket?.minCredits, 5);
  assert.equal(diversityBucket?.options[0]?.categoryOption?.sourceCategoryCode, "DIV");
  assert.equal(socialWelfareDistributionBucket?.requirementType, "choose_credits");
  assert.equal(socialWelfareDistributionBucket?.minCredits, 20);
  assert.deepEqual(
    new Set(socialWelfareDistributionBucket?.options.map((option) => option.categoryOption?.category)),
    new Set(["AH", "NSC"])
  );
  assert.equal(socialWelfareDuplicateChoice, undefined);
});

test("Parser keeps approved-list credit buckets that also name concrete courses", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Anthropology Indigenous Archaeology option",
    planId: "uw-seattle-anthropology",
    ownerId: "uw-seattle-anthropology:pathway:ba-option-family:indigenous-archaeology",
    courseCodes: ["AIS 102"],
    snapshotLines: [
      "Option courses: Requirements for the general anthropology major, as shown above, to include AIS 102, three courses from the approved Indigenous Archaeology (IA) core list, and 15 credits from courses approved for the IA elective list.",
    ],
  });
  const optionBucket = parsedBlock.parsedRequirementGroups.find((group) =>
    /Indigenous Archaeology/i.test(group.sourceRowText ?? "")
  );

  assert.equal(optionBucket?.requirementType, "choose_credits");
  assert.equal(optionBucket?.minCredits, 15);
  assert.match(optionBucket?.approvedListKey ?? "", /approved/);
});

test("Parser ignores admission decision prose with approved-list credit text", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Architectural Studies PDF",
    planId: "uw-seattle-architectural-studies",
    ownerId: "uw-seattle-architectural-studies",
    courseCodes: [],
    snapshotLines: [
      "Admission decisions are based on an applicant's academic",
      "performance and potential, extent and quality of relevant",
      "experience, and personal motivation. Completion of Year Two approved lists (minimum 9cr)",
      "requirements does not guarantee admission.",
    ],
  });

  assert.equal(
    parsedBlock.parsedRequirementGroups.some((group) =>
      /does not guarantee admission|personal motivation/i.test(group.sourceRowText ?? group.label ?? "")
    ),
    false
  );
});

test("Parser builds requirement groups from sectioned credit course lists", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "American Indian Studies degree requirements",
    planId: "uw-seattle-american-indian-studies",
    ownerId: "uw-seattle-american-indian-studies",
    courseCodes: ["AIS 102", "AIS 103", "AIS 170", "AIS 202"],
    headings: ["1. Introductory courses", "2. Content courses"],
    snapshotLines: [
      "1. Introductory courses",
      "10 credits/both courses:",
      "AIS 102 Introduction to American Indian Studies",
      "AIS 103 The Indigenous Pacific Northwest",
      "2. Content courses",
      "10 credits, two courses selected from:",
      "AIS 170 American Indian Art and Aesthetics",
      "AIS 202 Introduction to American Indian Contemporary and Social Issues",
      "3. Concentrations",
      "25 credits total, 5 credits minimum chosen from each concentration",
      "Governance Concentration Courses:",
      "AIS 212 Indigenous Leaders and Activists",
      "AIS 230 Contemporary Indian Gaming and Casinos",
      "Environment and Health Concentration Courses:",
      "AIS 306 Contemporary Indigenous Environmental Issues",
      "AIS 307 Indigenous Literature and the Environment",
    ],
  });
  const contentGroup = parsedBlock.parsedRequirementGroups.find((group) =>
    /selected from/i.test(group.sourceRowText ?? group.label ?? "")
  );
  assert.equal(contentGroup?.requirementType, "choose_credits");
  assert.equal(contentGroup?.minCredits, 10);
  assert.deepEqual(
    new Set(contentGroup?.options.flatMap((option) => option.uwCourses)),
    new Set(["AIS 170", "AIS 202"])
  );
});

test("Parser extracts following-list course and credit groups without leaking adjacent headings into titles", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Asian Studies South Asia Concentration",
    planId: "uw-seattle-asian-studies",
    ownerId: "uw-seattle-asian-studies:pathway:south-asia-concentration",
    ownerTitle: "Asian Studies - South Asia Concentration",
    courseCodes: [
      "JSISA 206",
      "JSISA 202",
      "HSTAS 202",
      "HSTAS 201",
      "JSISA 303",
      "HSTAS 303",
      "JSISA 316",
      "ANTH 316",
      "JSISA 339",
      "ANTH 339",
      "JSISA 340",
      "POL S 340",
      "JSISA 341",
      "ANTH 341",
      "JSISA 417",
      "POL S 417",
      "JSISA 438",
      "GEOG 438",
      "JSISA 461",
      "JSISA 485",
      "RELIG 352",
      "RELIG 354",
      "RELIG 356",
      "RELIG 456",
      "HSTAS 401",
      "HSTAS 402",
      "HSTAS 403",
      "HSTAS 404",
    ],
    headings: ["Coursework Requirements"],
    snapshotLines: [
      "Coursework Requirements",
      "One South Asia history course from the following list",
      "JSIS A 206 Contemporary India & Pakistan",
      "JSIS A/HSTAS 202 South Asian History 1500-present",
      "HSTAS 201 South Asian History pre-history to 1500",
      "A minimum of ten credits from the following list of core South Asia courses",
      "JSIS A/HSTAS 303 - Divided Lands/Divided Lives: An Environmental History of South Asia",
      "JSIS A/ANTH 316 - Modern South Asia",
      "JSIS A/ANTH 339 - Social Movements in Contemporary India",
      "JSIS A/POL S 340 - Politics of India, Pakistan, and South Asia",
      "JSIS A/ANTH 341 - Political Violence and the Post-Colonial State in South Asia",
      "JSIS A/POL S 417 - Political Economy of India",
      "JSIS A/ GEOG 438 - Social and Political Geographies of South Asia",
      "JSIS A 461 - Ramayana in Comparative Perspective",
      "JSIS A 485 - Special Topics on South Asia",
      "RELIG 352 - Hinduism",
      "RELIG 354 - Buddhism",
      "RELIG 356 - Buddhism & Society: The Theravada Buddhist Tradition in South & SE Asia",
      "RELIG 456 - Perceptions of the Feminine Divine in Hinduism",
      "HSTAS 401 - History of Ancient India",
      "HSTAS 402 - History of Medieval and Mughal India",
      "HSTAS 403 - History of Modern India",
      "HSTAS 404 - History of Twentieth-Century India",
      "Electives - 25 credits from the list of approved South Asia electives, found below.",
    ],
  });

  const historyGroup = parsedBlock.parsedRequirementGroups.find((group) =>
    /South Asia history course/i.test(group.label)
  );
  const coreGroup = parsedBlock.parsedRequirementGroups.find((group) =>
    /core South Asia courses/i.test(group.label)
  );

  assert.equal(historyGroup?.requirementType, "choose_n");
  assert.equal(historyGroup?.requiredCount, 1);
  assert.deepEqual(
    new Set(historyGroup?.options.flatMap((option) => [...option.uwCourses, ...option.equivalentUwCourseCodes])),
    new Set(["JSISA 206", "JSISA 202", "HSTAS 202", "HSTAS 201"])
  );
  assert.doesNotMatch(
    historyGroup?.options.find((option) => option.uwCourses.includes("HSTAS 201"))?.title ?? "",
    /minimum of ten credits/i
  );

  assert.equal(coreGroup?.requirementType, "choose_credits");
  assert.equal(coreGroup?.minCredits, 10);
  assert.ok(coreGroup?.options.some((option) => option.uwCourses.includes("JSISA 303")));
  assert.ok(coreGroup?.options.some((option) => option.equivalentUwCourseCodes.includes("GEOG 438")));
  assert.ok(coreGroup?.options.some((option) => option.uwCourses.includes("HSTAS 404")));
});

test("Parser materializes split heading credit course lists", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Astronomy Undergraduate Program",
    planId: "uw-seattle-astronomy",
    ownerId: "uw-seattle-astronomy",
    ownerTitle: "Astronomy",
    courseCodes: [
      "MATH 207",
      "MATH 208",
      "AMATH 352",
      "MATH 209",
      "AMATH 353",
      "MATH 224",
      "MATH 326",
      "ASTR 300",
      "ASTR 302",
      "ASTR 321",
      "ASTR 324",
      "ASTR 322",
      "ASTR 323",
      "PHYS 323",
      "PHYS 324",
      "PHYS 325",
      "PHYS 328",
      "PHYS 331",
      "PHYS 335",
      "PHYS 421",
      "PHYS 422",
      "PHYS 423",
      "PHYS 431",
      "PHYS 432",
      "PHYS 433",
      "PHYS 434",
    ],
    headings: ["Degree Requirements"],
    snapshotLines: [
      "Degree Requirements",
      "Mathematics Electives",
      "6 credits, from:",
      "Mathematics 207",
      "Ordinary Differential Equations",
      "3",
      "Mathematics 208",
      "or Applied Mathematics 352",
      "Linear Algebra",
      "3",
      "Mathematics 209",
      "or Applied Mathematics 353",
      "Partial Differential Equations & Fourier Analysis",
      "3",
      "Mathematics 224",
      "Advanced Multi-variable Calculus",
      "3",
      "Mathematics 326",
      "Advanced Calculus",
      "3",
      "Core Astronomy",
      "12 credits",
      "Astronomy 300 or Astronomy 302",
      "Astronomy Computing or Python for Astronomy",
      "3",
      "Astronomy 321 or Astronomy 324",
      "Solar System or Intro. to Astrostatistics & Machine Learning",
      "3",
      "Astronomy 322",
      "Contents of Our Galaxy",
      "3",
      "Astronomy 323",
      "Extragalactic Astronomy & Cosmology",
      "3",
      "Physics Electives",
      "6 credits, from:",
      "Physics 323",
      "Electromagnetism III",
      "4",
      "Physics 324",
      "Quantum Mechanics I",
      "4",
      "Physics 325",
      "Quantum Mechanics II",
      "4",
      "Physics 328",
      "Statistical Physics",
      "3",
      "Physics 331",
      "Optics Lab.",
      "3",
      "Physics 335",
      "Electric Circuits Lab.",
      "3",
      "Physics 421",
      "Atomic & Molecular Physics",
      "3",
      "Physics 422",
      "Nuclear & Elementary Particle Physics",
      "3",
      "Physics 423",
      "Solid State Physics",
      "3",
      "Physics 431 or 432 or 433",
      "Modern Physics Lab.",
      "3",
      "Physics 434",
      "Application of Computers to Physical Measurement & Data Acquisition",
      "3",
      "The minimum grade point to fulfill the above requirements is 2.00 in every course.",
    ],
  });

  const mathElectives = parsedBlock.parsedRequirementGroups.find((group) =>
    /Mathematics Electives/i.test(group.label)
  );
  const coreAstronomy = parsedBlock.parsedRequirementGroups.find((group) =>
    /Core Astronomy/i.test(group.label)
  );
  const physicsElectives = parsedBlock.parsedRequirementGroups.find((group) =>
    /Physics Electives/i.test(group.label)
  );

  assert.equal(mathElectives?.requirementType, "choose_credits");
  assert.equal(mathElectives?.minCredits, 6);
  assert.ok(mathElectives?.options.some((option) => option.uwCourses.includes("MATH 207")));
  assert.ok(
    mathElectives?.options.some(
      (option) =>
        option.uwCourses.includes("MATH 208") &&
        option.equivalentUwCourseCodes.includes("AMATH 352")
    )
  );
  assert.ok(
    mathElectives?.options.some(
      (option) =>
        option.uwCourses.includes("MATH 209") &&
        option.equivalentUwCourseCodes.includes("AMATH 353")
    )
  );
  assert.ok(mathElectives?.options.some((option) => option.uwCourses.includes("MATH 326")));

  assert.equal(coreAstronomy?.requirementType, "choose_credits");
  assert.equal(coreAstronomy?.minCredits, 12);
  assert.ok(
    coreAstronomy?.options.some(
      (option) =>
        option.uwCourses.includes("ASTR 300") &&
        option.equivalentUwCourseCodes.includes("ASTR 302")
    )
  );
  assert.ok(
    coreAstronomy?.options.some(
      (option) =>
        option.uwCourses.includes("ASTR 321") &&
        option.equivalentUwCourseCodes.includes("ASTR 324")
    )
  );
  assert.ok(coreAstronomy?.options.some((option) => option.uwCourses.includes("ASTR 323")));
  assert.equal(
    parsedBlock.parsedRequirementGroups.some((group) => group.label === "Astronomy 300 or Astronomy 302"),
    false
  );

  assert.equal(physicsElectives?.requirementType, "choose_credits");
  assert.equal(physicsElectives?.minCredits, 6);
  assert.ok(physicsElectives?.options.some((option) => option.uwCourses.includes("PHYS 335")));
  assert.ok(physicsElectives?.options.some((option) => option.uwCourses.includes("PHYS 421")));
  assert.ok(
    physicsElectives?.options.some(
      (option) =>
        option.uwCourses.includes("PHYS 431") &&
        option.equivalentUwCourseCodes.includes("PHYS 432") &&
        option.equivalentUwCourseCodes.includes("PHYS 433")
    )
  );
  assert.ok(physicsElectives?.options.some((option) => option.uwCourses.includes("PHYS 434")));
  assert.equal(
    parsedBlock.parsedRequirementGroups.some((group) => group.label === "Physics 431 or 432 or 433"),
    false
  );
});

test("Parser keeps catalog option requirements scoped and preserves leading one-of course codes", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "official-catalog",
    label: "Atmospheric and Climate Science Data Science option",
    planId: "uw-seattle-atmospheric-and-climate-science",
    ownerId: "uw-seattle-atmospheric-and-climate-science:pathway:bs-option-family:data-science",
    ownerTitle: "Atmospheric and Climate Science - B.S. Data Science option",
    courseCodes: [
      "STAT 390",
      "QSCI 381",
      "ATMOS 220",
      "ATMOS 301",
      "ATMOS 321",
      "ATMOS 340",
      "ATMOS 341",
      "ATMOS 370",
      "ATMOS 431",
      "CSE 123",
      "CSE 143",
      "CSE 163",
      "CSE 416",
      "STAT 416",
      "STAT 435",
      "INFO 371",
      "ESS 469",
      "CSE 414",
      "INFO 430",
      "MATH 124",
      "MATH 125",
      "MATH 126",
      "MATH 134",
      "MATH 135",
      "MATH 136",
      "PHYS 121",
      "PHYS 122",
      "PHYS 123",
      "PHYS 141",
      "PHYS 142",
      "PHYS 143",
    ],
    headings: ["Bachelor of Science degree with a major in Atmospheric and Climate Science: Data Science"],
    snapshotLines: [
      "Bachelor of Science degree with a major in Atmospheric and Climate Science: Data Science",
      "Completion Requirements",
      "Foundation requirements (30 credits): MATH 124, MATH 125, MATH 126 (or MATH 134, MATH 135, MATH 136); PHYS 121, PHYS 122, PHYS 123 (or PHYS 141, PHYS 142, PHYS 143)",
      "Core requirements (27-28 credits): STAT 390 (or Q SCI 381 for options in meteorology, climate, chemistry); ATMOS 220 (1 credit), ATMOS 301, ATMOS 321, ATMOS 340, ATMOS 341, ATMOS 370, ATMOS 431.",
      "Additional Completion Requirements",
      "Option specific credits (28-39 credits)",
      "Requirements (28-39 credits):",
      "one of CSE 123, CSE 143, or CSE 163",
      "one of CSE 416/STAT 416, STAT 435, INFO 371, or ESS 469",
      "CSE 414 or INFO 430",
      "Back to Top",
    ],
  });

  const coreGroups = parsedBlock.parsedRequirementGroups.filter((group) =>
    /Core requirements/i.test(group.label)
  );
  const programmingGroup = parsedBlock.parsedRequirementGroups.find((group) =>
    /CSE 123/i.test(group.label)
  );
  const statisticsGroup = parsedBlock.parsedRequirementGroups.find((group) =>
    /CSE 416/i.test(group.label)
  );
  const sequenceGroups = parsedBlock.parsedRequirementGroups.filter(
    (group) => group.requirementType === "sequence_choice"
  );
  const sequencePathSets = sequenceGroups.map((group) =>
    group.sequencePaths.map((path) => path.uwCourses)
  );

  assert.equal(coreGroups.length, 1);
  assert.equal(coreGroups[0].requirementType, "choose_credits");
  assert.equal(coreGroups[0].minCredits, 27);
  assert.ok(coreGroups[0].options.some((option) => option.uwCourses.includes("STAT 390")));
  assert.ok(coreGroups[0].options.some((option) => option.uwCourses.includes("ATMOS 431")));

  assert.ok(programmingGroup, "Expected leading CSE 123 to stay in the one-of programming row.");
  assert.deepEqual(
    new Set(programmingGroup.options.flatMap((option) => option.uwCourses)),
    new Set(["CSE 123", "CSE 143", "CSE 163"])
  );
  assert.ok(statisticsGroup?.options.some((option) => option.uwCourses.includes("CSE 416")));
  assert.deepEqual(
    sequencePathSets.find((paths) =>
      paths.some((path) => path.includes("MATH 124")) &&
      paths.some((path) => path.includes("MATH 134"))
    ),
    [
      ["MATH 124", "MATH 125", "MATH 126"],
      ["MATH 134", "MATH 135", "MATH 136"],
    ]
  );
  assert.deepEqual(
    sequencePathSets.find((paths) =>
      paths.some((path) => path.includes("PHYS 121")) &&
      paths.some((path) => path.includes("PHYS 141"))
    ),
    [
      ["PHYS 121", "PHYS 122", "PHYS 123"],
      ["PHYS 141", "PHYS 142", "PHYS 143"],
    ]
  );
  assert.equal(
    parsedBlock.parsedRequirementGroups.some((group) =>
      /^Foundation requirements/i.test(group.label) && group.requirementType === "choose_credits"
    ),
    false
  );
});

test("Parser does not reclassify Environmental Earth science course lists as generic categories", () => {
  const earthScienceOptions = [
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
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Environmental Engineering Degree Sheet",
    courseCodes: earthScienceOptions,
    snapshotLines: [
      "Earth science elective 5 credits",
      earthScienceOptions.join(", "),
    ],
  });
  const earthScienceGroups = parsedBlock.parsedRequirementGroups.filter((group) =>
    /Earth science elective/i.test(group.sourceRowText ?? group.sourceHeading ?? "")
  );

  assert.equal(earthScienceGroups.length, 1);
  assert.equal(earthScienceGroups[0].requirementType, "choose_one");
  assert.equal(
    earthScienceGroups.some((group) =>
      (group.options ?? []).some((option) => option.categoryOption)
    ),
    false
  );
});

test("Parser filters prerequisite-only and course-list sections from schedulable rows", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Computer Science Degree Requirements",
    planId: "uw-seattle-computer-science",
    ownerId: "uw-seattle-computer-science:pathway:data-science-option",
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
  const atomCodes = parsedBlock.parsedRequirementAtomCandidates.map(
    (candidate) => candidate.uwCourseCode
  );
  const emittedGroupCodes = parsedBlock.parsedRequirementGroups.flatMap((group) =>
    (group.options ?? []).flatMap((option) => option.uwCourses ?? [])
  );
  const blockedRows = parsedBlock.sourceSectionFilterAuditRows.filter(
    (row) => row.schedulable === false
  );

  assert.deepEqual(atomCodes, ["CSE 123"]);
  assert.equal(emittedGroupCodes.some((code) => ["CSE 403", "CSE 414", "CSE 421", "CSE 442"].includes(code)), false);
  assert.equal(atomCodes.includes("MATH 208"), false);
  assert.equal(atomCodes.includes("PHYS 122"), false);
  assert.ok(
    blockedRows.some(
      (row) =>
        row.detectedSectionRole === "upper-division-prerequisite-table" &&
        row.courseCodesExtracted.includes("MATH 208")
    )
  );
  assert.ok(
    blockedRows.some(
      (row) =>
        ["elective-list", "non-schedulable-course-list"].includes(row.detectedSectionRole) &&
        row.courseCodesExtracted.includes("CSE 403")
    )
  );
  assert.ok(
    blockedRows.every((row) => /Schedulable: no/.test(row.copyOnlyDebugText))
  );
});

test("Parser treats credit-limit course notes as support metadata", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Aeronautics & Astronautics Degree Requirements",
    planId: "uw-seattle-aeronautics-astronautics",
    ownerId: "uw-seattle-aeronautics-astronautics",
    courseCodes: ["AA 499", "ENGR 321"],
    headings: ["A&A Technical Electives (15 credits)"],
    snapshotLines: [
      "A&A Technical Electives (15 credits)",
      "A A 499 Undergraduate Research *",
      "ENGR 321 Engineering Internship Education *",
      "Up to 6 credits combined from A A 499 and ENGR 321 may be applied toward technical electives",
    ],
  });
  const supportNoteRow = parsedBlock.sourceSectionFilterAuditRows.find((row) =>
    /Up to 6 credits combined/i.test(row.rawLine)
  );

  assert.ok(supportNoteRow, "Expected the credit-limit footnote to be audited.");
  assert.equal(supportNoteRow.schedulable, false);
  assert.equal(supportNoteRow.detectedSectionRole, "support-metadata");
  assert.deepEqual(supportNoteRow.courseCodesExtracted, ["AA 499", "ENGR 321"]);
});

test("Parser materializes sectioned technical electives as a credit option group", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Aeronautics & Astronautics Degree Requirements",
    planId: "uw-seattle-aeronautics-astronautics",
    ownerId: "uw-seattle-aeronautics-astronautics",
    courseCodes: ["AA 402", "AA 405", "AA 499", "ENGR 321"],
    headings: ["A&A Technical Electives (15 credits)"],
    snapshotLines: [
      "A&A Technical Electives (15 credits)",
      "Choose from the following:",
      "A A 402 Viscous Fluid Mechanics (3)",
      "A A 405 Introduction to Aerospace Plasmas (3)",
      "A A 499 Undergraduate Research *",
      "ENGR 321 Engineering Internship Education *",
      "Up to 6 credits combined from A A 499 and ENGR 321 may be applied toward technical electives",
    ],
  });

  const technicalElectiveGroup = parsedBlock.parsedRequirementGroups.find((group) =>
    /Technical Electives/i.test(group.label)
  );
  const optionCodes = (technicalElectiveGroup?.options ?? []).flatMap((option) => option.uwCourses);

  assert.ok(technicalElectiveGroup, "Expected the technical elective heading to become a requirement group.");
  assert.equal(technicalElectiveGroup.requirementType, "choose_credits");
  assert.equal(technicalElectiveGroup.minCredits, 15);
  assert.deepEqual(optionCodes, ["AA 402", "AA 405", "AA 499", "ENGR 321"]);
});

test("Parser materializes course-code credit buckets with course options", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Art Degree Requirements",
    planId: "uw-seattle-art",
    ownerId: "uw-seattle-art",
    courseCodes: ["ART 400", "ART 440", "ART 453", "ART 494"],
    headings: ["Core courses"],
    snapshotLines: ["10 credits from ART 400, ART 440, ART 453, ART 494"],
  });

  const creditBucket = parsedBlock.parsedRequirementGroups.find((group) =>
    /10 credits from ART 400/i.test(group.label)
  );
  const optionCodes = (creditBucket?.options ?? []).flatMap((option) => option.uwCourses);

  assert.ok(creditBucket, "Expected explicit course-code credit bucket to become a requirement group.");
  assert.equal(creditBucket.requirementType, "choose_credits");
  assert.equal(creditBucket.minCredits, 10);
  assert.deepEqual(optionCodes, ["ART 400", "ART 440", "ART 453", "ART 494"]);
});

test("Parser normalizes spaced subject aliases before credit-bucket dedupe", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Art History Degree Requirements",
    planId: "uw-seattle-art-history",
    ownerId: "uw-seattle-art-history",
    courseCodes: ["ARTH 200", "ARTH 201", "ARTH 202"],
    headings: ["Completion Requirements"],
    snapshotLines: ["10 credits from ART H 200, ART H 201, ART H 202"],
  });

  const creditBucket = parsedBlock.parsedRequirementGroups.find((group) =>
    /10 credits from ART H 200/i.test(group.label)
  );
  const optionCodes = (creditBucket?.options ?? []).flatMap((option) => option.uwCourses);

  assert.ok(creditBucket, "Expected the Art History credit bucket to become a requirement group.");
  assert.equal(creditBucket.requirementType, "choose_credits");
  assert.deepEqual(optionCodes, ["ARTH 200", "ARTH 201", "ARTH 202"]);
});

test("Parser materializes subject-prefix elective buckets as program-specific filters", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Art History Degree Requirements",
    planId: "uw-seattle-art-history",
    ownerId: "uw-seattle-art-history",
    ownerTitle: "Art History",
    courseCodes: ["ARTH 200", "ARTH 273", "ARTH 400"],
    headings: ["Completion Requirements"],
    snapshotLines: [
      "10 credits from ART H electives to include any ART H courses listed above or other courses with an ART H prefix (10 credits)",
    ],
  });

  const prefixBucket = parsedBlock.parsedRequirementGroups.find(
    (group) => group.approvedListKey === "uw-seattle-art-history-arth-prefix-courses"
  );
  const categoryOption = prefixBucket?.options?.[0]?.categoryOption;
  const supportList = parsedBlock.supportLists?.find(
    (list) => list.approvedListKey === "uw-seattle-art-history-arth-prefix-courses"
  );

  assert.ok(prefixBucket, "Expected the ART H prefix elective row to become a credit bucket.");
  assert.equal(prefixBucket.requirementType, "choose_credits");
  assert.equal(prefixBucket.programSpecific, true);
  assert.equal(prefixBucket.approvedListKey, "uw-seattle-art-history-arth-prefix-courses");
  assert.equal(categoryOption?.programSpecific, true);
  assert.equal(categoryOption?.approvedListKey, "uw-seattle-art-history-arth-prefix-courses");
  assert.ok(
    supportList?.acceptedUwCourseCodes?.includes("ARTH 200"),
    "Expected the generated support list to include ARTH metadata courses."
  );
  assert.ok(
    supportList?.acceptedUwCourseCodes?.includes("ARTH 494"),
    "Expected the generated support list to include upper-division ARTH metadata courses."
  );

  const generatedFilters = parser.buildGeneratedProgramApprovedCourseFiltersForTest({
    owners: [parsedBlock],
  });
  const generatedFilter = generatedFilters.find(
    (filter) => filter.filterKey === "uw-seattle-art-history-arth-prefix-courses"
  );
  assert.ok(generatedFilter, "Expected the prefix support list to generate a program-approved filter.");
  assert.ok(generatedFilter.approvedUwCourseCodes.includes("ARTH 419"));
  assert.ok(generatedFilter.approvedUwCourseCodes.includes("ARTH 273"));
  assert.equal(generatedFilter.approvedUwCourseCodes.includes("BIOL 162"), false);
});

test("Parser splits same-subject comma course-list rows into separate options", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Asian Languages and Cultures",
    planId: "uw-seattle-asian-languages-and-cultures",
    ownerId: "uw-seattle-asian-languages-and-cultures",
    ownerTitle: "Asian Languages & Cultures",
    courseCodes: ["ASIAN 204", "JAPAN 431", "JAPAN 432", "JAPAN 433"],
    headings: ["II. Elective courses"],
    snapshotLines: [
      "1) 10 credits Literature, Culture, Linguistics: Complete two courses from the approved list of electives",
      "ASIAN 204 Literature and Culture of China from Tradition to Modernity",
      "JAPAN 431, 432, 433 Readings in Modern Japanese Literature",
    ],
  });

  const electiveBucket = parsedBlock.parsedRequirementGroups.find((group) =>
    /approved list of electives/i.test(group.label)
  );
  const optionCodes = (electiveBucket?.options ?? []).flatMap((option) => option.uwCourses);

  assert.ok(electiveBucket, "Expected the approved elective list to become a credit bucket.");
  assert.deepEqual(optionCodes, ["ASIAN 204", "JAPAN 431", "JAPAN 432", "JAPAN 433"]);
});

test("Parser materializes colon course-list credit buckets", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Art Degree Requirements",
    planId: "uw-seattle-art",
    ownerId: "uw-seattle-art",
    courseCodes: ["ART 101", "ART 140", "ART 190"],
    headings: ["Core courses"],
    snapshotLines: [
      "15 credits introductory art classes: ART 101, ART 140, ART 190",
    ],
  });

  const introBucket = parsedBlock.parsedRequirementGroups.find((group) =>
    /introductory art classes/i.test(group.label)
  );
  const optionCodes = (introBucket?.options ?? []).flatMap((option) => option.uwCourses);

  assert.ok(introBucket, "Expected colon-separated introductory art list to become a credit group.");
  assert.equal(introBucket.requirementType, "choose_credits");
  assert.equal(introBucket.minCredits, 15);
  assert.deepEqual(optionCodes, ["ART 101", "ART 140", "ART 190"]);
});

test("Parser splits semicolon-separated credit buckets and suppresses duplicate choice groups", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Art Degree Requirements",
    planId: "uw-seattle-art",
    ownerId: "uw-seattle-art",
    courseCodes: ["ART 300", "ART 301", "ART 400", "ART 450"],
    headings: ["Concentrations"],
    snapshotLines: [
      "Interdisciplinary Visual Art: 5-credit additional introductory ART class; 20 credits from ART 300, ART 301; 5 credits from the following: ART 400, ART 450",
    ],
  });

  const creditBuckets = parsedBlock.parsedRequirementGroups.filter(
    (group) => group.requirementType === "choose_credits"
  );
  const choiceGroups = parsedBlock.parsedRequirementGroups.filter(
    (group) => group.requirementType === "choose_one"
  );
  const twentyCreditBucket = creditBuckets.find((group) => group.minCredits === 20);
  const fiveCreditCourseBucket = creditBuckets.find(
    (group) =>
      group.minCredits === 5 &&
      (group.options ?? []).some((option) => option.uwCourses.includes("ART 400"))
  );

  assert.ok(twentyCreditBucket, "Expected the 20-credit concentration course list to become a bucket.");
  assert.deepEqual(
    (twentyCreditBucket.options ?? []).flatMap((option) => option.uwCourses),
    ["ART 300", "ART 301"]
  );
  assert.ok(fiveCreditCourseBucket, "Expected the 5-credit following-list segment to become a bucket.");
  assert.deepEqual(
    (fiveCreditCourseBucket.options ?? []).flatMap((option) => option.uwCourses),
    ["ART 400", "ART 450"]
  );
  assert.deepEqual(choiceGroups, []);
});

test("Generated registry keeps Computer Science approved science list as support metadata", () => {
  const supportBlock = studentRuntime
    .getTransferPlannerParsedRequirementSourceBlocks(
      "uw-seattle-computer-science",
      "data-science-option"
    )
    .find((block) => block.sourceRole === "approved-course-list");

  assert.ok(supportBlock, "Expected CS approved-list support source in compact registry.");
  assert.equal(supportBlock.supportOnly, true);
  assert.equal(supportBlock.canCreateScheduleRows, false);
  assert.equal(supportBlock.canCreateRequiredRows, false);
  assert.ok(
    (supportBlock.approvedFilterUwCourseCodes ?? []).length > 0,
    "Expected approved-list metadata to be retained."
  );
  assert.equal(supportBlock.supportLists?.length, 1);
  assert.equal(supportBlock.supportLists[0].shape, "approved-filter-list");
  assert.equal(supportBlock.supportLists[0].approvedListKey, "computer-science-approved-science");
  assert.notEqual(
    supportBlock.supportLists[0].approvedListKey,
    "computer-engineering-natural-science"
  );
  assert.ok(
    supportBlock.supportLists[0].acceptedUwCourseCodes.includes("PHYS 121"),
    "Expected CS approved science filter to use the source-backed CS science list."
  );
  assert.equal(
    supportBlock.supportLists[0].acceptedUwCourseCodes.includes("CSE 121"),
    false,
    "CS approved science filter must not reuse broad CSE course-list text."
  );
  assert.equal(supportBlock.supportLists[0].supportOnly, true);
  assert.equal(supportBlock.supportLists[0].canCreateRequiredRow, false);
  assert.equal(supportBlock.supportLists[0].canCreateScheduleRow, false);
  assert.deepEqual(supportBlock.parsedRequirementGroups ?? [], []);
  assert.deepEqual(supportBlock.parsedRequirementAtomCandidates ?? [], []);
});

test("Generated program-approved filters carry official support evidence", () => {
  const ceFilter = programApprovedFilters.getTransferPlannerProgramApprovedCourseFilterDefinition(
    "computer-engineering-natural-science"
  );
  const ceMathScienceFilter =
    programApprovedFilters.getTransferPlannerProgramApprovedCourseFilterDefinition(
      "computer-engineering-math-science"
    );
  const csFilter = programApprovedFilters.getTransferPlannerProgramApprovedCourseFilterDefinition(
    "computer-science-approved-science"
  );

  assert.ok(ceFilter, "Expected generated CE Natural Science filter.");
  assert.ok(ceMathScienceFilter, "Expected generated CE Math/Science filter.");
  assert.ok(csFilter, "Expected generated CS approved-science filter.");
  assert.equal(ceFilter.generatedFromOfficialSupportSource, true);
  assert.equal(ceFilter.sourceRole, "approved-course-list");
  assert.equal(csFilter.sourceRole, "approved-course-list");
  assert.equal(ceMathScienceFilter.sourceRole, "primary-degree-requirements");
  assert.ok(ceFilter.sourceFingerprint);
  const ceEvidenceText = [
    ...(ceFilter.sourceEvidenceHeadings ?? []),
    ...(ceFilter.sourceEvidenceLines ?? []),
  ].join("\n");
  const csEvidenceText = [
    ...(csFilter.sourceEvidenceHeadings ?? []),
    ...(csFilter.sourceEvidenceLines ?? []),
  ].join("\n");
  assert.ok(
    /Computer Engineering Natural Science Requirement/i.test(ceEvidenceText)
  );
  assert.ok(ceFilter.approvedUwCourseCodes.includes("ATMOS 460"));
  assert.equal(ceFilter.approvedUwCourseCodes.includes("AMATH 351"), false);
  assert.ok(ceMathScienceFilter.approvedUwCourseCodes.includes("AMATH 351"));
  assert.ok(ceMathScienceFilter.approvedUwCourseCodes.includes("MATH 207"));
  assert.ok(
    /Computer Science Natural Science Requirement/i.test(csEvidenceText)
  );
  assert.ok(csFilter.approvedUwCourseCodes.includes("PHYS 121"));
  assert.equal(csFilter.approvedUwCourseCodes.includes("CSE 123"), false);
  assert.equal(csFilter.approvedUwCourseCodes.includes("MATH 124"), false);
});

test("Generated registry keeps Computer Engineering approved science as an approved filter list", () => {
  const supportBlock = studentRuntime
    .getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-computer-engineering", null)
    .find((block) => block.sourceRole === "approved-course-list");
  const plan = studentRuntime.getTransferPlannerMajorPlan("uw-seattle-computer-engineering");
  const supportList = supportBlock?.supportLists?.[0];
  const naturalScienceBucket = (plan?.requirementGroups ?? []).find(
    (group) => group.approvedListKey === "computer-engineering-natural-science"
  );

  assert.ok(supportBlock, "Expected CE approved-list support source in compact registry.");
  assert.ok(supportList, "Expected first-class CE support-list metadata.");
  assert.equal(supportList.shape, "approved-filter-list");
  assert.equal(supportList.approvedListKey, "computer-engineering-natural-science");
  assert.equal(supportList.supportOnly, true);
  assert.equal(supportList.canCreateRequiredRow, false);
  assert.equal(supportList.canCreateScheduleRow, false);
  assert.ok(supportList.acceptedUwCourseCodes.length > 0);
  assert.ok(
    (supportBlock.approvedFilterUwCourseCodes ?? []).length > 0,
    "Expected compact approved-list block to carry approved filter codes, not only nested support metadata."
  );
  assert.ok((supportBlock.approvedFilterUwCourseCodes ?? []).includes("PHYS 123"));
  assert.ok(naturalScienceBucket, "Expected primary CE Natural Science bucket to reference the filter key.");
  assert.equal(naturalScienceBucket.requirementType, "choose_credits");
});

test("Generated registry keeps SBSE pathway source groups without reintroducing unsafe sequence choices", () => {
  const sourceGroups = getSourceGeneratedRequirementGroups(SBSE_PLAN_ID, "business-option");
  const runtimeGroups = getCompactRuntimeRequirementGroups(SBSE_PLAN_ID, "business-option");
  const diversityBucket = sourceGroups.find((group) =>
    /5 credits of Diversity/i.test(group.label ?? "")
  );
  const socialScienceBucket = sourceGroups.find((group) =>
    /10 credits of Social Sciences/i.test(group.label ?? "")
  );
  const statisticsOption = sourceGroups.find((group) =>
    /QSCI 381/i.test(`${group.label ?? ""} ${group.sourceHeading ?? ""}`)
  );
  const unsafeMathChoice = sourceGroups.find(
    (group) =>
      group.requirementType === "choose_one" &&
      /MATH 124/i.test(group.label ?? "") &&
      /MATH 125/i.test(group.label ?? "") &&
      /MATH 126/i.test(group.label ?? "")
  );
  const knownMathSequence = sourceGroups.find((group) =>
    group.id.endsWith(":sbse-math-124-125-126-sequence")
  );

  assert.equal(diversityBucket?.requirementType, "choose_credits");
  assert.equal(diversityBucket?.minCredits, 5);
  assert.equal(
    diversityBucket?.options?.[0]?.categoryOption?.sourceCategoryCode,
    "DIV"
  );
  assert.equal(socialScienceBucket?.requirementType, "choose_credits");
  assert.equal(socialScienceBucket?.minCredits, 10);
  assert.equal(
    socialScienceBucket?.options?.[0]?.categoryOption?.sourceCategoryCode,
    "SSc"
  );
  assert.equal(statisticsOption?.requirementType, "choose_one");
  assert.ok(knownMathSequence, "Expected curated SBSE math sequence to remain materialized.");
  assert.equal(unsafeMathChoice, undefined);
  assert.ok(
    runtimeGroups.some((group) => group.id === diversityBucket?.id),
    "Expected compact runtime to retain the source-backed SBSE Diversity bucket."
  );
});

test("Generated registry keeps Computer Science Data Science requirements pathway-scoped", () => {
  const basePlan = sourceRegistry.getTransferPlannerSourceGeneratedMajorPlan(
    "uw-seattle-computer-science"
  );
  const dataSciencePlan = sourceRegistry.resolveTransferPlannerMajorPlan(
    basePlan,
    "data-science-option"
  );
  const baseGroups = getGeneratedRequirementGroups(basePlan);
  const dataScienceGroups = getGeneratedRequirementGroups(dataSciencePlan);
  const dataScienceSpecificGroups = dataScienceGroups.filter(
    (group) =>
      group.pathwayId === "data-science-option" ||
      group.id.includes(":pathway:data-science-option:")
  );

  assert.ok(
    dataScienceSpecificGroups.length > 0,
    "Expected Data Science-specific generated groups to remain identifiable."
  );
  assert.ok(
    dataScienceSpecificGroups.every(
      (group) =>
        group.pathwayId === "data-science-option" &&
        group.routeId === "data-science-option" &&
        /pathway/i.test(group.sourceScope ?? "") &&
        group.canCreateScheduleRow === true
    )
  );
  assert.equal(
    baseGroups.some(
      (group) =>
        group.pathwayId === "data-science-option" ||
        group.id.includes(":pathway:data-science-option:")
    ),
    false
  );
  assert.equal(
    dataScienceGroups.some(
      (group) => group.approvedListKey === "computer-engineering-natural-science"
    ),
    false,
    "CS Data Science should not inherit the CE-approved science filter."
  );
});

test("Parser keeps legitimate Computer Engineering lower-division requirements schedulable", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Computer Engineering Degree Requirements",
    planId: "uw-seattle-computer-engineering",
    ownerId: "uw-seattle-computer-engineering",
    courseCodes: ["PHYS 121", "PHYS 122", "MATH 208"],
    snapshotLines: [
      "Degree Requirements",
      "Mathematics & Natural Sciences",
      "PHYS 121 Mechanics (or PHYS 141) (5)",
      "PHYS 122 Electromagnetism (or PHYS 142) (5)",
      "MATH 208 Matrix Algebra (3)",
    ],
  });
  const atomCodes = parsedBlock.parsedRequirementAtomCandidates.map(
    (candidate) => candidate.uwCourseCode
  );

  assert.ok(atomCodes.includes("PHYS 121"));
  assert.ok(atomCodes.includes("PHYS 122"));
  assert.ok(atomCodes.includes("MATH 208"));
  assert.ok(
    parsedBlock.sourceSectionFilterAuditRows
      .filter((row) => row.courseCodesExtracted.length)
      .every((row) => row.detectedSectionRole === "primary-requirement-section")
  );
});

test("Catalog anchors are retained as distinct discovered candidate URLs", async () => {
  const esrmCatalogUrl = `${SBSE_CATALOG_BASE_URL}#program-UG-ESRM-MAJOR`;
  const target = buildSbseTarget({
    ownerKey: "anchor-preservation-test",
    officialLinks: [
      {
        label: "UW catalog SEFS undergraduate programs",
        url: SBSE_CATALOG_BASE_URL,
      },
    ],
  });

  const result = await discovery.analyzeOwner(target, 1000, {
    inspectPageImpl: async (url) => ({
      url,
      ok: true,
      status: 200,
      finalUrl: url.replace(/#.*/, ""),
      contentType: "text/html",
      title: "School of Environmental and Forest Sciences",
      headings: ["Undergraduate Programs"],
      anchors: url.includes("#")
        ? []
        : [
            { url: SBSE_CATALOG_URL, text: "SBSE major requirements", sourceUrl: url },
            { url: esrmCatalogUrl, text: "ESRM major requirements", sourceUrl: url },
          ],
      error: null,
    }),
  });

  const candidateUrls = new Set(result.topCandidates.map((candidate) => candidate.url));
  const sbseCandidate = result.topCandidates.find((candidate) => candidate.url === SBSE_CATALOG_URL);
  const esrmCandidate = result.topCandidates.find((candidate) => candidate.url === esrmCatalogUrl);

  assert.ok(candidateUrls.has(SBSE_CATALOG_URL));
  assert.ok(candidateUrls.has(esrmCatalogUrl));
  assert.equal(sbseCandidate.sectionAnchor, "#program-UG-SBSE-MAJOR");
  assert.equal(esrmCandidate.sectionAnchor, "#program-UG-ESRM-MAJOR");
  assert.notEqual(SBSE_CATALOG_URL, esrmCatalogUrl);
});

test("Targeted official support links are followed even when deeper primary discovery is disabled", async () => {
  const degreeUrl =
    "https://www.ece.uw.edu/academics/undergrad/degree-requirements/computer-engineering/";
  const curriculumUrl =
    "https://www.ece.uw.edu/academics/undergrad/degree-requirements/computer-engineering/curriculum/";
  const approvedUrl =
    "https://www.ece.uw.edu/academics/undergrad/degree-requirements/computer-engineering/approved-natural-science/";
  const electiveUrl =
    "https://www.ece.uw.edu/academics/undergrad/degree-requirements/computer-engineering/engineering-electives/";
  const facultyUrl = "https://www.ece.uw.edu/people/faculty/";
  const target = buildSbseTarget({
    analysisMode: "existing-primary",
    ownerKey: "uw-seattle-computer-engineering",
    planId: "uw-seattle-computer-engineering",
    title: "Computer Engineering",
    label: "Computer Engineering",
    officialLinks: [{ label: "Computer Engineering degree requirements", url: degreeUrl }],
    existingPrimary: { label: "Computer Engineering degree requirements", url: degreeUrl },
  });
  const inspectedUrls = [];

  const result = await discovery.analyzeOwner(target, 1000, {
    inspectPageImpl: async (url) => {
      inspectedUrls.push(url);
      if (url === degreeUrl) {
        return {
          url,
          ok: true,
          status: 200,
          finalUrl: url,
          contentType: "text/html",
          title: "Computer Engineering Degree Requirements",
          headings: ["Computer Engineering Degree Requirements"],
          anchors: [
            { url: curriculumUrl, text: "Curriculum requirements", sourceUrl: url },
            { url: facultyUrl, text: "Faculty", sourceUrl: url },
          ],
          error: null,
        };
      }

      if (url === curriculumUrl) {
        return {
          url,
          ok: true,
          status: 200,
          finalUrl: url,
          contentType: "text/html",
          title: "Computer Engineering Curriculum",
          headings: ["Computer Engineering Curriculum"],
          anchors: [
            { url: approvedUrl, text: "Approved Natural Science course list", sourceUrl: url },
            { url: electiveUrl, text: "Engineering elective list", sourceUrl: url },
          ],
          error: null,
        };
      }

      return {
        url,
        ok: true,
        status: 200,
        finalUrl: url,
        contentType: "text/html",
        title: "Ignored",
        headings: [],
        anchors: [],
        error: null,
      };
    },
  });

  const approvedCandidate = result.supportCandidates.find(
    (candidate) => candidate.url === approvedUrl
  );
  const electiveCandidate = result.supportCandidates.find(
    (candidate) => candidate.url === electiveUrl
  );

  assert.equal(result.deeperDiscoveryEnabled, false);
  assert.ok(includesExactUrl(inspectedUrls, curriculumUrl));
  assert.equal(includesExactUrl(inspectedUrls, facultyUrl), false);
  assert.equal(result.suggestedAction, "keep-existing-primary");
  assert.equal(result.currentPrimary.url, degreeUrl);
  assert.ok(approvedCandidate);
  assert.ok(electiveCandidate);
  assert.equal(approvedCandidate.sourceRole, "approved-course-list");
  assert.equal(approvedCandidate.supportOnly, true);
  assert.equal(approvedCandidate.canBePrimary, false);
  assert.equal(approvedCandidate.discoveredFromUrl, curriculumUrl);
  assert.equal(approvedCandidate.sameDepartment, true);
  assert.equal(electiveCandidate.sourceRole, "elective-list");
  assert.equal(electiveCandidate.supportOnly, true);
  assert.equal(electiveCandidate.canBePrimary, false);
  assert.ok(
    result.sourceDiscoveryAuditLines.some(
      (line) =>
        line.includes("Support-only: yes") &&
        line.includes("Can be primary: no")
    )
  );
});

test("Support-only sources remain collected but are not suggested as missing primaries", async () => {
  const approvedUrl =
    "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#core";
  const target = buildSbseTarget({
    ownerKey: "support-only-primary-suggestion-test",
    planId: "uw-seattle-computer-engineering",
    title: "Computer Engineering",
    label: "Computer Engineering",
    officialLinks: [{ label: "Allen School approved CE course list", url: approvedUrl }],
  });

  const result = await discovery.analyzeOwner(target, 1000, {
    inspectPageImpl: async (url) => ({
      url,
      ok: true,
      status: 200,
      finalUrl: url.replace(/#.*/, ""),
      contentType: "text/html",
      title: "Approved Natural Science Courses for Computer Engineering",
      headings: ["Approved Natural Science Courses for Computer Engineering"],
      anchors: [],
      error: null,
    }),
  });

  assert.equal(result.suggestedPrimary, null);
  assert.equal(result.suggestedAction, "no-suggestion");
  assert.ok(result.supportCandidates.some((candidate) => candidate.url === approvedUrl));
});

test("Discovered pathway PDFs can become primary candidates ahead of broad pathway pages", async () => {
  const broadUrl = "https://mse.washington.edu/undergraduate/program";
  const pathwayPdfUrl =
    "https://mse.washington.edu/files/nanoscience-and-molecular-engineering-option-degree-sheet.pdf";
  const target = buildSbseTarget({
    ownerType: "pathway",
    ownerKey: "uw-seattle-materials-science-engineering:pathway:nme-option",
    planId: "uw-seattle-materials-science-engineering",
    pathwayId: "nme-option",
    title: "Materials Science and Engineering",
    label: "Nanoscience and Molecular Engineering option",
    officialLinks: [{ label: "Materials Science and Engineering undergraduate program", url: broadUrl }],
  });

  const result = await discovery.analyzeOwner(target, 1000, {
    inspectPageImpl: async (url) => ({
      url,
      ok: true,
      status: 200,
      finalUrl: url,
      contentType: "text/html",
      title: "Materials Science and Engineering Undergraduate Program",
      headings: ["Materials Science and Engineering Undergraduate Program"],
      anchors:
        url === broadUrl
          ? [
              {
                url: pathwayPdfUrl,
                text: "Nanoscience and Molecular Engineering option degree sheet",
                sourceUrl: url,
              },
            ]
          : [],
      error: null,
    }),
  });

  assert.equal(result.suggestedPrimary.url, pathwayPdfUrl);
  assert.equal(result.suggestedPrimary.sourceRole, "pathway-degree-sheet");
  assert.equal(result.suggestedPrimary.canBePrimary, true);
  assert.ok(result.suggestedPrimary.pathwayIdentityScore > 0);
});

test("Pathway discovery follows parent track links and chooses the matching child page", async () => {
  const parentUrl = "https://www.tacoma.uw.edu/sias/cac/communication";
  const professionalUrl = "https://www.tacoma.uw.edu/sias/cac/professional-track";
  const researchUrl = "https://www.tacoma.uw.edu/sias/cac/research-track";
  const policyUrl = "https://www.tacoma.uw.edu/sias/cac/communication-policies";
  const target = buildSbseTarget({
    ownerType: "pathway",
    ownerKey: "uw-tacoma-communications:pathway:professional-track",
    planId: "uw-tacoma-communications",
    pathwayId: "professional-track",
    campusId: "uw-tacoma",
    title: "Communications (BA)",
    label: "Professional track",
    officialLinks: [{ label: "Communications major requirements", url: parentUrl }],
  });
  const inspectedUrls = [];

  const result = await discovery.analyzeOwner(target, 1000, {
    inspectPageImpl: async (url) => {
      inspectedUrls.push(url);
      if (url === parentUrl) {
        return {
          url,
          ok: true,
          status: 200,
          finalUrl: url,
          contentType: "text/html",
          title: "Communication major requirements",
          headings: ["Communication major requirements", "Tracks"],
          anchors: [
            { url: professionalUrl, text: "Professional Track", sourceUrl: url },
            { url: researchUrl, text: "Research Track", sourceUrl: url },
            { url: policyUrl, text: "Communication policies and advising", sourceUrl: url },
          ],
          error: null,
        };
      }

      if (url === professionalUrl) {
        return {
          url,
          ok: true,
          status: 200,
          finalUrl: url,
          contentType: "text/html",
          title: "Professional Track | Communication",
          headings: ["Professional Track", "Professional Track major requirements"],
          anchors: [],
          error: null,
        };
      }

      if (url === researchUrl) {
        return {
          url,
          ok: true,
          status: 200,
          finalUrl: url,
          contentType: "text/html",
          title: "Research Track | Communication",
          headings: ["Research Track"],
          anchors: [],
          error: null,
        };
      }

      return {
        url,
        ok: true,
        status: 200,
        finalUrl: url,
        contentType: "text/html",
        title: "Communication policies and advising",
        headings: ["Communication policies and advising"],
        anchors: [],
        error: null,
      };
    },
  });
  const parentCandidate = result.primaryCandidates.find((candidate) => candidate.url === parentUrl);
  const policyCandidate = result.supportCandidates.find((candidate) => candidate.url === policyUrl);

  assert.ok(includesExactUrl(inspectedUrls, professionalUrl));
  assert.equal(result.suggestedPrimary.url, professionalUrl);
  assert.equal(result.suggestedPrimary.sourceRole, "primary-degree-requirements");
  assert.ok(result.suggestedPrimary.score > parentCandidate.score);
  assert.equal(policyCandidate.sourceRole, "support-source");
  assert.equal(policyCandidate.supportOnly, true);
  assert.equal(policyCandidate.canBePrimary, false);
});

test("Matching pathway child pages can replace broad weak pathway primaries", async () => {
  const parentUrl = "https://www.tacoma.uw.edu/sias/cac/communication";
  const professionalUrl = "https://www.tacoma.uw.edu/sias/cac/professional-track";
  const target = buildSbseTarget({
    analysisMode: "weak-existing-primary",
    ownerType: "pathway",
    ownerKey: "uw-tacoma-communications:pathway:professional-track",
    planId: "uw-tacoma-communications",
    pathwayId: "professional-track",
    campusId: "uw-tacoma",
    title: "Communications (BA)",
    label: "Professional track",
    officialLinks: [{ label: "Communications major requirements", url: parentUrl }],
    existingPrimary: { label: "Communications major requirements", url: parentUrl },
    reevaluationSignals: [
      {
        code: "primary-source-misses-selected-pathway",
        reason: "Current pathway primary source does not name the selected pathway.",
      },
    ],
  });

  const result = await discovery.analyzeOwner(target, 1000, {
    inspectPageImpl: async (url) => ({
      url,
      ok: true,
      status: 200,
      finalUrl: url,
      contentType: "text/html",
      title:
        url === parentUrl
          ? "Communication major requirements"
          : "Professional Track | Communication",
      headings:
        url === parentUrl
          ? ["Communication major requirements", "Tracks"]
          : ["Professional Track", "Professional Track major requirements"],
      anchors:
        url === parentUrl
          ? [{ url: professionalUrl, text: "Professional Track", sourceUrl: url }]
          : [],
      error: null,
    }),
  });

  assert.equal(result.suggestedAction, "replace-existing-primary");
  assert.equal(result.suggestedPrimary.url, professionalUrl);
  assert.ok(result.suggestedScoreDelta > 0);
});

test("Tacoma missing-primary discovery can use the generic campus major index", async () => {
  const indexUrl = "https://www.tacoma.uw.edu/admissions/majors-degrees";
  const communicationUrl = "https://www.tacoma.uw.edu/sias/cac/communication";
  const target = buildSbseTarget({
    ownerKey: "uw-tacoma-communications",
    planId: "uw-tacoma-communications",
    campusId: "uw-tacoma",
    title: "Communications (BA)",
    label: "Communications (BA)",
    officialLinks: [],
  });
  const inspectedUrls = [];

  const result = await discovery.analyzeOwner(target, 1000, {
    inspectPageImpl: async (url) => {
      inspectedUrls.push(url);
      if (url === indexUrl) {
        return {
          url,
          ok: true,
          status: 200,
          finalUrl: url,
          contentType: "text/html",
          title: "UW Tacoma majors and degrees",
          headings: ["Majors and degrees"],
          anchors: [
            {
              url: communicationUrl,
              text: "Communication (major)",
              sourceUrl: url,
            },
          ],
          error: null,
        };
      }

      return {
        url,
        ok: true,
        status: 200,
        finalUrl: url,
        contentType: "text/html",
        title: "Communication major requirements",
        headings: ["Communication major requirements", "Professional Track", "Research Track"],
        anchors: [],
        error: null,
      };
    },
  });

  assert.ok(includesExactUrl(inspectedUrls, indexUrl));
  assert.ok(includesExactUrl(inspectedUrls, communicationUrl));
  assert.equal(result.suggestedPrimary.url, communicationUrl);
  assert.equal(result.suggestedPrimary.sourceRole, "primary-degree-requirements");
  assert.equal(result.suggestedAction, "add-missing-primary");
});

test("Pathway manifest sources prefer matching parent track links over sibling tracks", () => {
  const primary = sourceRegistry.getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-tacoma-arts-media-culture",
    "film-and-media-track"
  );

  assert.equal(primary?.url, "https://www.tacoma.uw.edu/sias/cac/film-and-media-track");
});

test("Policy and advising pages stay support-only even with owner identity matches", () => {
  const target = buildSbseTarget({
    ownerKey: "uw-seattle-slavic-languages-and-literatures",
    planId: "uw-seattle-slavic-languages-and-literatures",
    title: "Slavic Languages & Literatures",
    label: "Slavic Languages & Literatures",
  });
  const policyCandidate = discovery.scoreCandidate(target, {
    url: "https://slavic.washington.edu/undergraduate-policies",
    label: "UW Slavic Languages & Literatures undergraduate policies",
    pageTitle: "Slavic Languages & Literatures undergraduate policies",
    sourceKind: "official-link",
  });
  const advisingCandidate = discovery.scoreCandidate(target, {
    url: "https://slavic.washington.edu/undergraduate-advising",
    label: "Slavic Languages & Literatures undergraduate advising",
    pageTitle: "Slavic Languages & Literatures undergraduate advising",
    sourceKind: "official-link",
  });

  assert.equal(policyCandidate.sourceRole, "support-source");
  assert.equal(policyCandidate.sourceRoleStatus, "support");
  assert.equal(policyCandidate.canCreateSchedulableRows, false);
  assert.equal(advisingCandidate.sourceRole, "support-source");
  assert.equal(advisingCandidate.sourceRoleStatus, "support");
  assert.equal(advisingCandidate.canCreateSchedulableRows, false);
});

test("Planner verify step plan includes parser, source-discovery, and source-scope gates", () => {
  const refreshScriptPath = path.resolve(
    __dirname,
    "refresh-transfer-planner-sources.cjs"
  );
  const result = spawnSync(
    process.execPath,
    [refreshScriptPath, "--verify-only", "--print-step-plan-json"],
    {
      cwd: path.resolve(__dirname, "..", ".."),
      encoding: "utf8",
    }
  );

  assert.equal(result.status, 0, result.stderr);

  const stepPlan = JSON.parse(result.stdout);
  assert.equal(stepPlan.mode, "verify-only");
  assert.ok(
    stepPlan.labels.includes("Run parser extraction and source-discovery tests")
  );
  assert.ok(stepPlan.labels.includes("Audit source-backed runtime coverage (blocking)"));
  assert.ok(stepPlan.labels.includes("Audit generated source registry"));
  assert.ok(stepPlan.labels.includes("Audit UW-GRC mapping regressions"));
});

test("Generated registry audit passes protected source-to-runtime owners", () => {
  const auditScriptPath = path.resolve(
    __dirname,
    "audit-transfer-planner-source-backed-coverage.cjs"
  );
  const result = spawnSync(
    process.execPath,
    [auditScriptPath, "--generated-registry-only", "--protected-only"],
    {
      cwd: path.resolve(__dirname, "..", ".."),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 8,
    }
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Generated registry regression audit outcome: passed/);
  assert.match(result.stdout, /Single equivalency issues: 0/);
});

test("Mapping audit passes protected equivalency and filter cases", () => {
  const auditScriptPath = path.resolve(
    __dirname,
    "audit-transfer-planner-source-backed-coverage.cjs"
  );
  const result = spawnSync(
    process.execPath,
    [auditScriptPath, "--mapping-only"],
    {
      cwd: path.resolve(__dirname, "..", ".."),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 8,
    }
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Mapping regression audit outcome: passed/);
  assert.match(result.stdout, /Mapping regression issues: 0/);
});

test("UW Green River single-course mappings are official-guide backed", () => {
  for (const [grcCourse, uwEquivalent] of REQUIRED_SINGLE_EQUIVALENCY_MAPPINGS) {
    const normalizedGrcCourse = normalizeTestCourseCode(grcCourse);
    const normalizedUwEquivalent = normalizeTestCourseCode(uwEquivalent);
    const rules = sourceRegistry
      .getTransferPlannerEquivalencyRulesForSourceCourse(normalizedGrcCourse)
      .filter(
        (rule) =>
          rule.sourceKind === "uw-green-river-equivalency-guide" &&
          rule.parsedFromOfficialGuide === true &&
          rule.type === "direct-course" &&
          rule.acceptanceCategory !== "no-credit" &&
          (rule.sourceCourseSets ?? []).some((sourceCourseSet) => {
            const normalizedSourceCourseSet = (sourceCourseSet ?? []).map(
              normalizeTestCourseCode
            );
            return (
              normalizedSourceCourseSet.length === 1 &&
              normalizedSourceCourseSet[0] === normalizedGrcCourse
            );
          }) &&
          (rule.targetCourseCodes ?? [])
            .map(normalizeTestCourseCode)
            .includes(normalizedUwEquivalent)
      );

    assert.ok(
      rules.length > 0,
      `Expected official single-course equivalency for ${grcCourse} -> ${uwEquivalent}.`
    );
    assert.ok(
      rules.some((rule) =>
        rule.sourceLinks.some((link) =>
          /admit\.washington\.edu\/apply\/transfer\/equivalency-guide\/green-river/i.test(
            link.url
          )
        )
      ),
      `Expected ${grcCourse} -> ${uwEquivalent} to cite the UW Green River equivalency guide.`
    );
  }
});

test("UW Green River compound mappings preserve atomic source-course sets", () => {
  for (const { uwTarget, sourceSet } of REQUIRED_COMPOUND_EQUIVALENCY_PATHS) {
    const normalizedUwTarget = normalizeTestCourseCode(uwTarget);
    const normalizedSourceSet = sourceSet.map(normalizeTestCourseCode);
    const exactPathRules = sourceRegistry
      .getTransferPlannerEquivalencyRulesForSourceCourse(normalizedSourceSet[0])
      .filter(
        (rule) =>
          rule.sourceKind === "uw-green-river-equivalency-guide" &&
          rule.parsedFromOfficialGuide === true &&
          rule.acceptanceCategory !== "no-credit" &&
          (rule.targetCourseCodes ?? []).map(normalizeTestCourseCode).includes(normalizedUwTarget) &&
          (rule.sourceCourseSets ?? []).some(
            (candidateSourceSet) =>
              JSON.stringify((candidateSourceSet ?? []).map(normalizeTestCourseCode)) ===
              JSON.stringify(normalizedSourceSet)
          )
      );

    assert.ok(
      exactPathRules.length > 0,
      `Expected official compound equivalency ${sourceSet.join(" + ")} -> ${uwTarget}.`
    );

    for (const component of normalizedSourceSet) {
      const singleComponentRule = sourceRegistry
        .getTransferPlannerEquivalencyRulesForSourceCourse(component)
        .find(
          (rule) =>
            rule.sourceKind === "uw-green-river-equivalency-guide" &&
            rule.acceptanceCategory !== "no-credit" &&
            (rule.targetCourseCodes ?? [])
              .map(normalizeTestCourseCode)
              .includes(normalizedUwTarget) &&
            (rule.sourceCourseSets ?? []).some((candidateSourceSet) => {
              const normalizedCandidateSet = (candidateSourceSet ?? []).map(normalizeTestCourseCode);
              return normalizedCandidateSet.length === 1 && normalizedCandidateSet[0] === component;
            })
        );

      assert.equal(
        singleComponentRule,
        undefined,
        `${component} must not satisfy ${uwTarget} without the full compound path.`
      );
    }
  }
});

test("Generated requirement options retain compound component metadata", () => {
  const ceGroups = getSourceGeneratedRequirementGroups("uw-seattle-computer-engineering");
  const ceOptions = ceGroups.flatMap((group) => group.options ?? []);
  const chem152 = ceOptions.find((option) =>
    (option.uwCourses ?? []).map(normalizeTestCourseCode).includes("CHEM 152")
  );
  const biol180 = ceOptions.find((option) =>
    (option.uwCourses ?? []).map(normalizeTestCourseCode).includes("BIOL 180")
  );

  assert.ok(
    chem152?.compoundComponents?.some(
      (component) =>
        JSON.stringify(component.map(normalizeTestCourseCode)) ===
        JSON.stringify(["CHEM& 162", "CHEM& 163"])
    ),
    "Expected CE CHEM 152 option to retain CHEM& 162 + CHEM& 163 as one compound path."
  );
  assert.ok(
    biol180?.compoundComponents?.some(
      (component) =>
        JSON.stringify(component.map(normalizeTestCourseCode)) ===
        JSON.stringify(["BIOL& 211", "BIOL& 212", "BIOL& 213"])
    ),
    "Expected CE BIOL 180 option to retain BIOL& 211 + BIOL& 212 + BIOL& 213 as one compound path."
  );

  const biochemistryOptions = getSourceGeneratedRequirementGroups("uw-seattle-biochemistry")
    .flatMap((group) => group.options ?? []);
  const phys114 = biochemistryOptions.find((option) =>
    (option.uwCourses ?? []).map(normalizeTestCourseCode).includes("PHYS 114")
  );
  assert.ok(
    phys114?.compoundComponents?.some(
      (component) =>
        JSON.stringify(component.map(normalizeTestCourseCode)) ===
        JSON.stringify(["PHYS& 114", "PHYS& 154"])
    ),
    "Expected PHYS 114 option to retain PHYS& 114 + PHYS& 154 as one compound path."
  );
});

test("Compound equivalency audit reports full scheduled paths instead of partial components", () => {
  const plan = getCompactRuntimePlan("uw-seattle-civil-engineering", null);
  const quarterPlan = buildQuarterPlanForTest(plan);
  const compoundAudit = planner.auditCompoundEquivalencyPaths({
    ownerId: "uw-seattle-civil-engineering",
    plan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
  });
  const chem152 = compoundAudit.find((row) => row.uwCourse === "CHEM 152");

  assert.deepEqual(chem152?.grcCompoundPath, ["CHEM& 162", "CHEM& 163"]);
  assert.deepEqual(chem152?.scheduledComponents, ["CHEM& 162", "CHEM& 163"]);
  assert.deepEqual(chem152?.missingComponents, []);
  assert.equal(chem152?.satisfied, true);
  assert.equal(chem152?.issue, null);
  assert.match(chem152?.copyOnlyDebugText ?? "", /^\[compound equivalency audit\]/);
  assert.match(chem152?.copyOnlyDebugText ?? "", /Owner id: uw-seattle-civil-engineering/);
});
