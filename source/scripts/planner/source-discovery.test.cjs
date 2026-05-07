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
