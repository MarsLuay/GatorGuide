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
  normalizeTransferPlannerCourseCode,
} = require("../../constants/transfer-planner-source/course-code-normalization");

const SBSE_PLAN_ID = "uw-seattle-sustainable-bioresource-systems-engineering";
const SBSE_CATALOG_URL =
  "https://www.washington.edu/students/gencat/program/S/SchoolofEnvironmentalandForestScience-1069.html#program-UG-SBSE-MAJOR";
const SBSE_CATALOG_BASE_URL =
  "https://www.washington.edu/students/gencat/program/S/SchoolofEnvironmentalandForestScience-1069.html";

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
    headings: [label],
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

  assert.ok(weakInspectedUrls.includes(requirementsUrl));

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

test("Generated registry preserves Biochemistry physics sequence-choice paths", () => {
  const sourceGroup = getSourceGeneratedRequirementGroups("uw-seattle-biochemistry").find(
    (group) => group.requirementType === "sequence_choice"
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

test("Parser extracts split either-or course rows as alternatives without a major-specific branch", () => {
  const parsedBlock = buildParsedSourceScopeFixture({
    sourceRole: "primary-degree-requirements",
    label: "Programming Requirement",
    planId: "uw-seattle-pattern-fixture",
    ownerId: "uw-seattle-pattern-fixture",
    courseCodes: ["CSE 123", "CSE 143"],
    snapshotLines: [
      "Fundamentals",
      "* CSE 123 Intro to Computer Programming III (4)",
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
  assert.ok(naturalScienceBucket, "Expected primary CE Natural Science bucket to reference the filter key.");
  assert.equal(naturalScienceBucket.requirementType, "choose_credits");
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
  assert.ok(inspectedUrls.includes(curriculumUrl));
  assert.equal(inspectedUrls.includes(facultyUrl), false);
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
        line.includes(approvedUrl) &&
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
  assert.ok(stepPlan.labels.includes("Audit source-backed source scope"));
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

  const biologyOptions = getSourceGeneratedRequirementGroups("uw-seattle-biology")
    .flatMap((group) => group.options ?? []);
  const phys114 = biologyOptions.find((option) =>
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
