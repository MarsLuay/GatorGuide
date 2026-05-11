const assert = require("node:assert/strict");
const test = require("node:test");

const parser = require("./parse-transfer-planner-requirement-sources.cjs");

function buildRecoveryOwnerFixture(overrides = {}) {
  return {
    ownerId: "uw-bothell-business-administration",
    ownerTitle: "Business Administration",
    planId: "uw-bothell-business-administration",
    pathwayId: null,
    campusId: "uw-bothell",
    ok: true,
    sourceUrl:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration",
    sourceLabel: "Business Administration",
    sourceRole: "primary-degree-requirements",
    sourceRoleStatus: "primary",
    canCreateSchedulableRows: true,
    canCreateRequiredRows: true,
    canCreateScheduleRows: true,
    parseConfidence: "low",
    parsedUwCourseCodes: [],
    sourceOnlyUwCourseCodes: [],
    structuredOnlyUwCourseCodes: [],
    requirementCueLines: ["Degree requirements"],
    chooseStatements: [],
    pathwayLabels: [],
    qualitySignals: [],
    parsedRequirementGroups: [],
    parsedRequirementAtomCandidates: [],
    parsedRequirementCourses: [],
    usedSnapshotFallback: false,
    resolutionStrategy: "primary-source",
    ...overrides,
  };
}

function buildRecoveryEntryFixture(overrides = {}) {
  return {
    id: "uw-bothell-business-administration:primary",
    ownerId: "uw-bothell-business-administration",
    ownerTitle: "Business Administration",
    sourceLabel: "Business Administration",
    planId: "uw-bothell-business-administration",
    pathwayId: null,
    campusId: "uw-bothell",
    parserType: "html-degree-page",
    url:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration",
    label: "Business Administration",
    isPrimaryDegreeRequirementsLink: true,
    ownerType: "major",
    ...overrides,
  };
}

test("Parser recovery triggers on zero-course and low-confidence quality warnings", () => {
  const owner = buildRecoveryOwnerFixture();
  const signals = parser.buildParseQualitySignalsForTest(owner);
  const signalCodes = signals.map((signal) => signal.code);

  assert.ok(signalCodes.includes("no-parsed-uw-course-codes"));
  assert.ok(signalCodes.includes("low-confidence-parsed-source"));
  assert.equal(parser.shouldTriggerParserRecoveryForTest({ ...owner, qualitySignals: signals }), true);
});

test("Parser recovery finds linked official requirement documents", () => {
  const entry = buildRecoveryEntryFixture();
  const html = `
    <main>
      <a href="/business/undergraduate/bachelor-of-business-administration/bba-degree-requirements.pdf">
        Business Administration degree requirements worksheet
      </a>
      <a href="/business/news">News</a>
    </main>
  `;
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(entry, html);

  assert.equal(candidates[0].strategy, "linked-official-document-recovery");
  assert.match(candidates[0].url, /bba-degree-requirements\.pdf$/);
  assert.equal(candidates[0].sourceRoleStatus, "primary");
});

test("Parser recovery finds official child and sibling requirement pages", () => {
  const entry = buildRecoveryEntryFixture();
  const html = `
    <nav>
      <a href="/business/undergraduate/bachelor-of-business-administration/degree-requirements">
        Business Administration degree requirements
      </a>
      <a href="/business/undergraduate/bachelor-of-business-administration/options/accounting-option">
        Accounting option requirements
      </a>
    </nav>
  `;
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(entry, html);

  assert.ok(
    candidates.some(
      (candidate) =>
        candidate.strategy === "official-sibling-child-page-recovery" &&
        /\/degree-requirements$/.test(candidate.url)
    )
  );
});

test("Parser recovery rejects sibling pages for a different pathway option", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-bothell-business-administration:pathway:finance-option-and-concentration",
    ownerTitle: "Business Administration (BA) - Finance Option and Concentration",
    sourceLabel: "Finance Option and Concentration",
    pathwayId: "finance-option-and-concentration",
    url:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/finance-option",
    label: "Finance Option",
  });
  const html = `
    <main>
      <a href="/business/undergraduate/bachelor-of-business-administration/accounting">
        Accounting Option
      </a>
      <a href="/business/undergraduate/bachelor-of-business-administration/finance-option/requirements">
        Finance option requirements
      </a>
    </main>
  `;
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(entry, html);

  assert.equal(candidates.some((candidate) => /\/accounting$/.test(candidate.url)), false);
  assert.ok(candidates.some((candidate) => /finance-option\/requirements$/.test(candidate.url)));
});

test("Parser recovery rejects broad campus graduation pages as primary recovery", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-communications",
    ownerTitle: "Communications (BA)",
    sourceLabel: "Communications major requirements",
    planId: "uw-tacoma-communications",
    campusId: "uw-tacoma",
    url: "https://www.tacoma.uw.edu/sias/cac/communications",
    label: "Communications",
  });
  const html = `
    <main>
      <a href="https://www.tacoma.uw.edu/registrar/graduation-requirements">
        graduation requirements
      </a>
      <a href="/sias/cac/communications/degree-requirements">
        Communications degree requirements
      </a>
    </main>
  `;
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(entry, html);

  assert.equal(candidates.some((candidate) => /registrar\/graduation-requirements$/.test(candidate.url)), false);
  assert.ok(candidates.some((candidate) => /communications\/degree-requirements$/.test(candidate.url)));
});

test("Parser recovery rejects graduate and masters requirement pages", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-seattle-materials-science-engineering",
    ownerTitle: "Materials Science & Engineering",
    sourceLabel: "MSE undergraduate course requirements",
    planId: "uw-seattle-materials-science-engineering",
    campusId: "uw-seattle",
    url: "https://mse.washington.edu/current/undergrad/courses",
    label: "MSE undergraduate courses",
  });
  const html = `
    <main>
      <a href="https://mse.washington.edu/student/masters/graduation">
        Graduation requirements
      </a>
      <a href="https://mse.washington.edu/student/amp/requirements">
        Final project and internship/industrial option
      </a>
      <a href="/current/undergrad/degree-requirements">
        Materials Science and Engineering undergraduate degree requirements
      </a>
    </main>
  `;
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(entry, html);

  assert.equal(candidates.some((candidate) => /masters\/graduation$/.test(candidate.url)), false);
  assert.equal(candidates.some((candidate) => /student\/amp\/requirements$/.test(candidate.url)), false);
  assert.ok(candidates.some((candidate) => /undergrad\/degree-requirements$/.test(candidate.url)));
});

test("Parser recovery does not section-scope graduate primary pages for undergrad owners", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-seattle-materials-science-engineering:pathway:nme-option",
    ownerTitle: "Materials Science & Engineering - NME Option",
    sourceLabel: "Applied Master's Program",
    planId: "uw-seattle-materials-science-engineering",
    pathwayId: "nme-option",
    campusId: "uw-seattle",
    url: "https://mse.washington.edu/student/applied-masters",
    label: "Applied Master's Program",
  });
  const candidates = parser.buildParserRecoverySectionCandidatesForTest(entry, {
    title: "Applied Master's Program",
    headings: ["Graduation requirements"],
    lines: ["Graduation requirements", "MSE 500, MSE 510, MSE 520"],
  });

  assert.deepEqual(candidates, []);
});

test("Parser recovery builds scoped section candidates for broad multi-program pages", () => {
  const entry = buildRecoveryEntryFixture({
    ownerTitle: "Communications",
    sourceLabel: "Communications",
    planId: "uw-tacoma-communications",
    ownerId: "uw-tacoma-communications",
    campusId: "uw-tacoma",
    url: "https://www.tacoma.uw.edu/sias/cac/communications",
    label: "Communications",
  });
  const lines = [
    "Graduate Programs",
    "Master of Arts sample schedule",
    "TCOM 501",
    "Communications Major Requirements",
    "Complete TCOM 201, TCOM 230, and TCOM 320.",
    "Choose one of TCOM 340 or TCOM 350.",
    "Admissions",
    "Apply by the priority deadline.",
  ];
  const candidates = parser.buildParserRecoverySectionCandidatesForTest(entry, {
    title: "Communications",
    headings: ["Communications Major Requirements"],
    lines,
  });

  assert.equal(candidates[0].strategy, "section-scoping-recovery");
  assert.ok(candidates[0].sectionLines.some((line) => line.includes("TCOM 201")));
  assert.equal(candidates[0].sectionLines.some((line) => line.includes("TCOM 501")), false);
});

test("Parser recovery does not section-scope a different pathway on the same page", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId:
      "uw-seattle-materials-science-engineering:pathway:final-project-and-internship-industrial-option",
    ownerTitle:
      "Materials Science & Engineering - Final Project and Internship/Industrial Option",
    sourceLabel: "Final Project and Internship/Industrial Option",
    planId: "uw-seattle-materials-science-engineering",
    pathwayId: "final-project-and-internship-industrial-option",
    campusId: "uw-seattle",
    url: "https://mse.washington.edu/current/undergrad/courses",
    label: "MSE undergraduate courses",
  });
  const candidates = parser.buildParserRecoverySectionCandidatesForTest(entry, {
    title: "MSE undergraduate courses",
    headings: ["NME Option"],
    lines: [
      "NME Option students complete all MSE degree requirements below.",
      "NME 220, MSE 450, MSE 452",
      "Final project and internship/industrial option requirements",
      "MSE 499 and ENGR 321",
    ],
  });

  assert.equal(candidates.some((candidate) => /NME Option/.test(candidate.label)), false);
  assert.ok(candidates.some((candidate) => /Final project/.test(candidate.label)));
});

test("Parser recovery can attach support sources without scheduling support-only courses", () => {
  const primaryOwner = buildRecoveryOwnerFixture({
    parsedUwCourseCodes: ["CSE 121"],
    parseConfidence: "medium",
    supportLists: [],
  });
  const supportOwner = {
    ...primaryOwner,
    sourceUrl: "https://www.cs.washington.edu/academics/ugrad/approved-natural-science/",
    sourceLabel: "Approved Natural Science Courses",
    sourceRole: "approved-course-list",
    sourceRoleStatus: "support",
    supportOnly: true,
    canCreateScheduleRows: false,
    parsedUwCourseCodes: ["BIOL 180", "CHEM 142"],
    supportLists: [
      {
        id: "support-block:support-list:approved-filter-list",
        shape: "approved-filter-list",
        sourceUrl:
          "https://www.cs.washington.edu/academics/ugrad/approved-natural-science/",
        sourceRole: "approved-course-list",
        listTitle: "Approved Natural Science Courses",
        acceptedUwCourseCodes: ["BIOL 180", "CHEM 142"],
        approvedListKey: "computer-science-approved-science",
        supportOnly: true,
        canCreateRequiredRow: false,
        canCreateScheduleRow: false,
        linkedPrimaryRequirementIds: [],
      },
    ],
  };
  const merged = parser.mergeRecoveredSupportSourcesForTest(primaryOwner, [supportOwner]);

  assert.deepEqual(merged.parsedUwCourseCodes, ["CSE 121"]);
  assert.equal(merged.supportLists.length, 1);
  assert.equal(merged.supportLists[0].canCreateScheduleRow, false);
  assert.deepEqual(merged.supportLists[0].acceptedUwCourseCodes, ["BIOL 180", "CHEM 142"]);
});
