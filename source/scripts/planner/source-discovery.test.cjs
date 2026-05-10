const assert = require("node:assert/strict");
const test = require("node:test");

const discovery = require("./discover-transfer-planner-primary-sources.cjs");
const parser = require("./parse-transfer-planner-requirement-sources.cjs");

const SBSE_PLAN_ID = "uw-seattle-sustainable-bioresource-systems-engineering";
const SBSE_CATALOG_URL =
  "https://www.washington.edu/students/gencat/program/S/SchoolofEnvironmentalandForestScience-1069.html#program-UG-SBSE-MAJOR";
const SBSE_CATALOG_BASE_URL =
  "https://www.washington.edu/students/gencat/program/S/SchoolofEnvironmentalandForestScience-1069.html";

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
