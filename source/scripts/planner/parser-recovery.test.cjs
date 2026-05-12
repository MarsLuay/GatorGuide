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

function buildParsedBlockFixture(entry, html, structuredCourseCodes = []) {
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(entry, html);
  const baseResult = buildRecoveryOwnerFixture({
    ownerId: entry.ownerId,
    ownerTitle: entry.ownerTitle,
    planId: entry.planId,
    pathwayId: entry.pathwayId ?? null,
    campusId: entry.campusId,
    primaryParserType: entry.parserType,
    primarySourceUrl: entry.url,
    primarySourceLabel: entry.label,
    structuredUwCourseCodes: structuredCourseCodes,
    supportLists: [],
  });

  return parser.buildManifestParseSuccessForTest(
    baseResult,
    structuredCourseCodes,
    entry,
    parsed,
    "primary-source"
  );
}

test("Course-code parser ignores prose-only 300-level requirement references", () => {
  const line =
    "These courses may overlap with your General Education requirements (A&H, SSc, DIV, etc.), above, as long as they are 300-level or higher.";

  assert.deepEqual(parser.extractCourseCodesFromLineForTest(line), []);
  assert.deepEqual(parser.extractCourseCodesFromRequirementLineForTest(line), []);
});

test("Course-code parser ignores subject-number level references", () => {
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest(
      "CSS 337 and CSS 411 are required; CSS 300-level prerequisites may also apply."
    ),
    ["CSS 337", "CSS 411"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest(
      "CSS 337 and 411 are required; CSS 300 level prerequisites may also apply."
    ),
    ["CSS 337", "CSS 411"]
  );
});

test("Course-code parser keeps real course codes near generic level prose", () => {
  assert.deepEqual(
    parser.extractCourseCodesFromRequirementLineForTest(
      "Complete 15 credits of 300-level GREEK courses; GREEK 300 and GREEK 301 are excluded."
    ),
    ["GREEK 300", "GREEK 301"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("MATH 307, 308, 309, and 324 are accepted."),
    ["MATH 307", "MATH 308", "MATH 309", "MATH 324"]
  );
});

test("Structured UW course code reader filters prose-derived level references", () => {
  const courseCodes = parser.getStructuredUwCourseCodesForTest({
    planId: "uw-bothell-csse",
    pathwayId: "iac-option",
  });

  assert.equal(courseCodes.includes("THEY ARE 300"), false);
  assert.ok(courseCodes.includes("CSS 337"));
});

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

test("Parser recovery treats linked DOCX worksheets as real document candidates", () => {
  const entry = buildRecoveryEntryFixture({
    ownerTitle: "Business Administration",
    sourceLabel: "Business Administration curriculum",
    parserType: "html-degree-page",
  });
  const html = `
    <main>
      <a href="/business/undergraduate/bachelor-of-business-administration/bba-major-planning-worksheet.docx">
        Business Administration major planning worksheet
      </a>
    </main>
  `;
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(entry, html);
  const worksheet = candidates.find((candidate) => /\.docx$/i.test(candidate.url));

  assert.ok(worksheet);
  assert.equal(worksheet.strategy, "linked-official-document-recovery");
  assert.equal(worksheet.parserType, "pdf-worksheet");
  assert.equal(worksheet.sourceRoleStatus, "primary");
  assert.equal(worksheet.signals.documentSignal, true);
});

test("Supplemental linked document recovery includes DOCX and worksheet PDFs", () => {
  const entry = buildRecoveryEntryFixture({
    ownerTitle: "Business Administration",
    sourceLabel: "Business Administration curriculum",
    parserType: "html-degree-page",
  });
  const html = `
    <main>
      <a href="/business/undergraduate/bachelor-of-business-administration/bba-major-planning-worksheet.docx">
        Business Administration major planning worksheet
      </a>
      <a href="/business/undergraduate/bachelor-of-business-administration/bba-checklist.pdf">
        Business Administration checklist worksheet
      </a>
    </main>
  `;
  const candidates = parser.extractSupplementalDocumentLinkCandidatesForTest(entry, html);
  const docx = candidates.find((candidate) => /\.docx$/i.test(candidate.url));
  const worksheetPdf = candidates.find((candidate) => /bba-checklist\.pdf$/i.test(candidate.url));

  assert.ok(docx);
  assert.equal(docx.parserType, "pdf-worksheet");
  assert.ok(worksheetPdf);
  assert.equal(worksheetPdf.parserType, "pdf-worksheet");
});

test("Supplemental linked document recovery accepts official Bothell STEM acronym checklist labels", () => {
  const entry = buildRecoveryEntryFixture({
    id: "uw-bothell-electrical-engineering:primary",
    ownerId: "uw-bothell-electrical-engineering",
    ownerTitle: "Electrical Engineering (BS)",
    planId: "uw-bothell-electrical-engineering",
    campusId: "uw-bothell",
    parserType: "html-curriculum-page",
    url: "https://www.uwb.edu/stem/undergraduate/majors/electrical/curriculum",
    label: "UW Bothell Electrical Engineering curriculum",
    sourceLabel: "UW Bothell Electrical Engineering curriculum",
  });
  const html = `
    <main>
      <a href="/stem/wp-content/uploads/sites/31/2024/07/B-EE-Curriculum-AY24_25.pdf">
        EE degree checklist
      </a>
    </main>
  `;
  const candidates = parser.extractSupplementalDocumentLinkCandidatesForTest(entry, html);
  const eeChecklist = candidates.find((candidate) => /B-EE-Curriculum/i.test(candidate.url));

  assert.ok(eeChecklist);
  assert.equal(eeChecklist.exactTitleMatch, false);
  assert.equal(eeChecklist.titleAcronymMatch, true);
  assert.deepEqual(eeChecklist.titleAcronymMatches, ["ee"]);
});

test("Parser can prefer acronym-matched rich degree checklists over shallow HTML sources", () => {
  const entry = buildRecoveryEntryFixture({
    id: "uw-bothell-electrical-engineering:primary",
    ownerId: "uw-bothell-electrical-engineering",
    ownerTitle: "Electrical Engineering (BS)",
    planId: "uw-bothell-electrical-engineering",
    campusId: "uw-bothell",
    parserType: "html-curriculum-page",
    url: "https://www.uwb.edu/stem/undergraduate/majors/electrical/curriculum",
    label: "UW Bothell Electrical Engineering curriculum",
    sourceLabel: "UW Bothell Electrical Engineering curriculum",
  });
  const baseParsed = {
    title: "Electrical Engineering Curriculum",
    headings: ["Admissions", "Curriculum"],
    courseCodes: [
      "BWRIT 132",
      "BWRIT 133",
      "BWRIT 134",
      "BWRIT 135",
      "CSS 132",
      "CSS 133",
      "CSS 142",
      "CSS 143",
      "CSS 301",
      "ENGL 131",
      "ENGL 141",
    ],
    requirementCueLines: ["Admissions", "Curriculum"],
    chooseStatements: [],
    pathwayLabels: [],
    snapshotLines: ["Admissions", "Curriculum", "B WRIT 134", "CSS 132 or CSS 142"],
  };
  const candidate = {
    url: "https://www.uwb.edu/stem/wp-content/uploads/sites/31/2024/07/B-EE-Curriculum-AY24_25.pdf",
    label: "EE degree checklist",
    parserType: "pdf-degree-sheet",
    exactTitleMatch: false,
    titleAcronymMatch: true,
    titleAcronymMatches: ["ee"],
    sameProgramRequirementLink: false,
    historical: false,
  };
  const documentParsed = {
    title: "Electrical Engineering B.S.E.E. Curriculum",
    headings: [
      "Electrical Engineering B.S.E.E. Curriculum",
      "Before Applying",
      "Mathematics & Natural Sciences",
      "Fundamentals",
    ],
    courseCodes: [
      "BEE 200",
      "BEE 215",
      "BEE 233",
      "BPHYS 121",
      "BPHYS 122",
      "STMATH 124",
      "STMATH 125",
    ],
    requirementCueLines: [
      "Before Applying",
      "Mathematics & Natural Sciences",
      "Fundamentals",
    ],
    chooseStatements: [],
    pathwayLabels: [],
    snapshotLines: [
      "Electrical Engineering B.S.E.E. Curriculum",
      "Before Applying",
      "Mathematics & Natural Sciences",
      "Fundamentals",
      "B EE 200",
      "BPHYS 121",
    ],
  };

  assert.equal(
    parser.shouldPreferSupplementalDocumentSourceForTest(
      entry,
      baseParsed,
      candidate,
      documentParsed
    ),
    true
  );
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

test("Parser recovery treats overview sibling worksheets as linked primary candidates", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-bothell-nursing-rn-to-bsn",
    ownerTitle: "Nursing RN to BSN",
    sourceLabel: "RN to BSN overview",
    planId: "uw-bothell-nursing-rn-to-bsn",
    campusId: "uw-bothell",
    url: "https://www.uwb.edu/nhs/undergraduate/rn-bsn/overview",
    label: "RN to BSN overview",
    parserType: "html-overview-page",
  });
  const html = `
    <main>
      <a href="/nhs/undergraduate/rn-bsn/rn-to-bsn-degree-requirements.pdf">
        RN to BSN degree requirements worksheet
      </a>
    </main>
  `;
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(entry, html);
  const worksheet = candidates.find((candidate) =>
    /rn-to-bsn-degree-requirements\.pdf$/.test(candidate.url)
  );

  assert.ok(worksheet);
  assert.equal(worksheet.strategy, "linked-official-document-recovery");
  assert.equal(worksheet.parserType, "pdf-worksheet");
  assert.equal(worksheet.sourceRole, "primary-degree-requirements");
  assert.equal(worksheet.sourceRoleStatus, "primary");
});

test("Parser recovery treats same-program curriculum children as primary candidates", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-bothell-economics",
    ownerTitle: "Economics",
    sourceLabel: "UW Bothell Bachelor of Economics overview",
    planId: "uw-bothell-economics",
    url: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics",
    label: "UW Bothell Bachelor of Economics overview",
    parserType: "html-overview-page",
  });
  const html = `
    <main>
      <a href="/business/undergraduate/bachelor-of-economics/curriculum">Curriculum</a>
    </main>
  `;
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(entry, html);
  const curriculumCandidate = candidates.find((candidate) =>
    /\/bachelor-of-economics\/curriculum$/.test(candidate.url)
  );

  assert.ok(curriculumCandidate);
  assert.equal(curriculumCandidate.parserType, "html-curriculum-page");
  assert.equal(curriculumCandidate.sourceRole, "primary-degree-requirements");
  assert.equal(curriculumCandidate.sourceRoleStatus, "primary");
  assert.equal(curriculumCandidate.strategy, "official-sibling-child-page-recovery");
});

test("Parser recovery rejects same-campus sibling requirement pages for different majors", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-bothell-csse",
    ownerTitle: "Computer Science & Software Engineering",
    sourceLabel: "Curriculum",
    planId: "uw-bothell-csse",
    campusId: "uw-bothell",
    url: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/curriculum",
    label: "Curriculum",
  });
  const html = `
    <main>
      <a href="/stem/undergraduate/majors/bscompe/curriculum">Computer Engineering curriculum</a>
      <a href="/stem/undergraduate/majors/chemistry/curriculum">Chemistry curriculum</a>
      <a href="/stem/undergraduate/minors/csse">Computer Science & Software Engineering (CSSE)</a>
      <a href="/stem/undergraduate/majors/bscsse/degree-requirements">CSSE degree requirements</a>
    </main>
  `;
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(entry, html);

  assert.equal(candidates.some((candidate) => /\/bscompe\/curriculum$/.test(candidate.url)), false);
  assert.equal(candidates.some((candidate) => /\/chemistry\/curriculum$/.test(candidate.url)), false);
  assert.equal(candidates.some((candidate) => /\/minors\/csse$/.test(candidate.url)), false);
  assert.ok(candidates.some((candidate) => /\/bscsse\/degree-requirements$/.test(candidate.url)));
});

test("Parser recovery rejects undergraduate credential sibling pages for other programs", () => {
  const entry = buildRecoveryEntryFixture({
    ownerTitle: "Business Administration",
    sourceLabel: "Accounting Option",
    planId: "uw-bothell-business-administration",
    pathwayId: "accounting-option",
    url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/accounting",
    label: "Accounting Option",
  });
  const html = `
    <main>
      <a href="/business/undergraduate/bachelor-of-economics/prerequisites">Prerequisites</a>
      <a href="/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses">BBA prerequisite courses</a>
    </main>
  `;
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(entry, html);

  assert.equal(candidates.some((candidate) => /bachelor-of-economics/.test(candidate.url)), false);
  assert.ok(candidates.some((candidate) => /bachelor-of-business-administration/.test(candidate.url)));
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

test("Parser recovery treats option hubs as same-program child source launchers", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId:
      "uw-bothell-business-administration:pathway:finance-option-and-concentration",
    ownerTitle: "Business Administration - Finance option and concentration",
    sourceLabel: "Business Administration options hub",
    planId: "uw-bothell-business-administration",
    pathwayId: "finance-option-and-concentration",
    url:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/options",
    label: "Business Administration options hub",
    parserType: "html-overview-page",
    ownerType: "pathway",
  });
  const html = `
    <main>
      <a href="/business/undergraduate/bachelor-of-business-administration/accounting">
        Accounting option
      </a>
      <a href="/business/undergraduate/bachelor-of-business-administration/finance-option">
        Finance option
      </a>
    </main>
  `;
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(entry, html);
  const finance = candidates.find((candidate) => /\/finance-option$/.test(candidate.url));

  assert.ok(finance);
  assert.equal(finance.strategy, "official-sibling-child-page-recovery");
  assert.equal(finance.sourceRole, "primary-degree-requirements");
  assert.equal(finance.sourceRoleStatus, "primary");
  assert.equal(candidates.some((candidate) => /\/accounting$/.test(candidate.url)), false);
  assert.equal(finance.signals.sameProgramSpecializationLink, true);
});

test("Parser recovery treats promoted Tacoma track child pages as schedulable primary sources", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-communications:pathway:professional-track",
    ownerTitle: "Communications (BA) - Professional Track",
    sourceLabel: "Professional Track",
    planId: "uw-tacoma-communications",
    pathwayId: "professional-track",
    campusId: "uw-tacoma",
    role: "other",
    parserType: "generic-html",
    url: "https://www.tacoma.uw.edu/sias/cac/professional-track",
    label: "Professional Track",
  });
  const sourceRole = parser.classifyRequirementSourceRole(entry);
  const sourceScope = parser.buildRequirementSourceScope(sourceRole);

  assert.equal(sourceRole, "primary-degree-requirements");
  assert.equal(sourceScope.canCreateScheduleRows, true);
});

test("Parser classifies Tacoma primary overview pages with owner identity as schedulable primary sources", () => {
  const tacomaPrimaryOverviewFixtures = [
    {
      ownerId: "uw-tacoma-arts-media-culture",
      ownerTitle: "Arts, Media and Culture (BA)",
      planId: "uw-tacoma-arts-media-culture",
      url: "https://www.tacoma.uw.edu/sias/cac/arts-media-culture",
      label: "UW Tacoma Arts, Media and Culture overview",
    },
    {
      ownerId: "uw-tacoma-environmental-sustainability",
      ownerTitle: "Environmental Sustainability (BA)",
      planId: "uw-tacoma-environmental-sustainability",
      url: "https://www.tacoma.uw.edu/sias/sam/environmental-sustainability",
      label: "UW Tacoma Environmental Sustainability overview",
    },
    {
      ownerId: "uw-tacoma-urban-studies",
      ownerTitle: "Urban Studies (BA)",
      planId: "uw-tacoma-urban-studies",
      url: "https://www.tacoma.uw.edu/urban-studies/ba-urban-studies",
      label: "UW Tacoma Urban Studies overview",
    },
  ];

  for (const fixture of tacomaPrimaryOverviewFixtures) {
    const sourceRole = parser.classifyRequirementSourceRole({
      ...buildRecoveryEntryFixture(fixture),
      campusId: "uw-tacoma",
      role: "overview",
      parserType: "html-overview-page",
      isPrimaryDegreeRequirementsLink: true,
    });
    const sourceScope = parser.buildRequirementSourceScope(sourceRole);

    assert.equal(sourceRole, "primary-degree-requirements", fixture.ownerId);
    assert.equal(sourceScope.canCreateScheduleRows, true, fixture.ownerId);
  }
});

test("Parser classifies Tacoma primary pages with acronym and parent-major identity as schedulable", () => {
  const tacomaIdentityFixtures = [
    {
      ownerId: "uw-tacoma-computer-science-and-systems-ba",
      ownerTitle: "Computer Science and Systems (BA)",
      planId: "uw-tacoma-computer-science-and-systems-ba",
      pathwayId: null,
      ownerType: "major",
      role: "overview",
      parserType: "html-overview-page",
      url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
      label: "Bachelor of Arts in CSS page.",
    },
    {
      ownerId: "uw-tacoma-law-and-policy:pathway:ba-route",
      ownerTitle: "Law and Policy (BA) - B.A. route",
      planId: "uw-tacoma-law-and-policy",
      pathwayId: "ba-route",
      ownerType: "pathway",
      role: "overview",
      parserType: "html-overview-page",
      url: "https://www.tacoma.uw.edu/sias/socs/law-and-policy",
      label: "UW Tacoma Law and Policy overview",
    },
    {
      ownerId: "uw-tacoma-writing-studies:pathway:creative-writing-track",
      ownerTitle: "Writing Studies (BA) - Creative Writing Track",
      planId: "uw-tacoma-writing-studies",
      pathwayId: "creative-writing-track",
      ownerType: "pathway",
      role: "other",
      parserType: "generic-html",
      url: "https://www.tacoma.uw.edu/sias/cac/writing-studies",
      label: "Writing Studies",
    },
  ];

  for (const fixture of tacomaIdentityFixtures) {
    const sourceRole = parser.classifyRequirementSourceRole({
      ...buildRecoveryEntryFixture(fixture),
      campusId: "uw-tacoma",
      isPrimaryDegreeRequirementsLink: true,
    });
    const sourceScope = parser.buildRequirementSourceScope(sourceRole);

    assert.equal(sourceRole, "primary-degree-requirements", fixture.ownerId);
    assert.equal(sourceScope.canCreateScheduleRows, true, fixture.ownerId);
  }
});

test("Parser promotes Tacoma acronym primary pages when parsed source-only evidence says ignored", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-computer-science-and-systems-ba",
    ownerTitle: "Computer Science and Systems (BA)",
    planId: "uw-tacoma-computer-science-and-systems-ba",
    pathwayId: null,
    campusId: "uw-tacoma",
    role: "overview",
    parserType: "html-overview-page",
    url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
    label: "Bachelor of Arts in CSS page.",
    ownerType: "major",
    isPrimaryDegreeRequirementsLink: true,
  });
  const parsed = {
    title: "Bachelor of Arts in CSS",
    headings: ["Bachelor of Arts in CSS", "Degree Requirements"],
    requirementCueLines: ["Degree Requirements", "CSS major required courses"],
    chooseStatements: [],
    pathwayLabels: [],
    courseCodes: ["TCSS 101"],
    snapshotLines: [
      "Bachelor of Arts in CSS",
      "Degree Requirements",
      "TCSS 101 Introduction to Programming",
    ],
    parseConfidence: "high",
    sourceRole: "ignored",
  };
  const baseResult = buildRecoveryOwnerFixture({
    ownerId: entry.ownerId,
    ownerTitle: entry.ownerTitle,
    planId: entry.planId,
    campusId: entry.campusId,
    primaryParserType: entry.parserType,
    primarySourceUrl: entry.url,
    primarySourceLabel: entry.label,
    structuredUwCourseCodes: [],
  });
  const block = parser.buildManifestParseSuccessForTest(
    baseResult,
    [],
    entry,
    parsed,
    "primary-source"
  );

  assert.equal(block.sourceRole, "primary-degree-requirements");
  assert.equal(block.sourceRoleStatus, "primary");
  assert.equal(block.canCreateScheduleRows, true);
  assert.deepEqual(block.sourceOnlyUwCourseCodes, ["TCSS 101"]);
});

test("Parser promotes Tacoma alternate official track pages when parsed evidence is degree-like", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-arts-media-culture",
    ownerTitle: "Arts, Media and Culture (BA)",
    planId: "uw-tacoma-arts-media-culture",
    campusId: "uw-tacoma",
    role: "overview",
    parserType: "html-overview-page",
    url: "https://www.tacoma.uw.edu/sias/cac/arts-media-culture",
    label: "UW Tacoma Arts, Media and Culture overview",
    isPrimaryDegreeRequirementsLink: true,
  });
  const parsed = {
    title: "Film and Media Track",
    headings: ["Film and Media Track"],
    requirementCueLines: [
      "Degree Requirements",
      "Film and Media Track",
      "Required Courses",
    ],
    chooseStatements: [],
    pathwayLabels: ["Film and Media Track"],
    courseCodes: ["TARTS 151"],
    snapshotLines: [
      "Film and Media Track",
      "Degree Requirements",
      "Required Courses",
      "TARTS 151 Film and Media",
    ],
    parseConfidence: "high",
    resolvedSourceUrl: "https://www.tacoma.uw.edu/sias/cac/film-and-media-track",
    resolvedSourceLabel: "UW Tacoma Arts, Media and Culture - Film and Media Track",
    resolvedParserType: "generic-html",
    sourceRole: "ignored",
  };
  const baseResult = buildRecoveryOwnerFixture({
    ownerId: entry.ownerId,
    ownerTitle: entry.ownerTitle,
    planId: entry.planId,
    campusId: entry.campusId,
    primaryParserType: entry.parserType,
    primarySourceUrl: entry.url,
    primarySourceLabel: entry.label,
    structuredUwCourseCodes: [],
  });
  const block = parser.buildManifestParseSuccessForTest(
    baseResult,
    [],
    entry,
    parsed,
    "alternate-official-source"
  );

  assert.equal(block.sourceRole, "primary-degree-requirements");
  assert.equal(block.sourceRoleStatus, "primary");
  assert.equal(block.canCreateScheduleRows, true);
  assert.ok(block.parsedUwCourseCodes.includes("TARTS 151"));
});

test("Parser extracts Tacoma broad track headings without single-token cross-major suppression", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-arts-media-culture",
    ownerTitle: "Arts, Media and Culture (BA)",
    planId: "uw-tacoma-arts-media-culture",
    campusId: "uw-tacoma",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/sias/cac/arts-media-culture",
    label: "Arts, Media and Culture",
  });
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(
    entry,
    `
      <main>
        <p>Arts, Media & Culture majors have five tracks to choose from:</p>
        <h2>AMERICAN CULTURES TRACK</h2>
        <p>TAMST 210 American Cultures</p>
        <h2>COMPARATIVE ARTS TRACK</h2>
        <p>TARTS 150 Introduction to Theatre</p>
        <h2>FILM AND MEDIA TRACK</h2>
        <p>TFILM 220 Film and the Arts</p>
        <h2>LITERATURE TRACK</h2>
        <p>TLIT 220 Literature and the Arts</p>
        <h2>VISUAL AND PERFORMING ARTS TRACK</h2>
        <p>TARTS 251 Intermediate Acting</p>
      </main>
    `
  );

  const normalizedPathwayLabels = parsed.pathwayLabels.map((label) => label.toLowerCase());
  for (const expectedLabel of [
    "american cultures track",
    "comparative arts track",
    "film and media track",
    "literature track",
    "visual and performing arts track",
  ]) {
    assert.ok(normalizedPathwayLabels.includes(expectedLabel), expectedLabel);
  }
});

test("Parser extracts enumerated Tacoma formal option section headings", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-urban-studies",
    ownerTitle: "Urban Studies (BA)",
    planId: "uw-tacoma-urban-studies",
    campusId: "uw-tacoma",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/urban-studies/ba-urban-studies",
    label: "Urban Studies",
  });
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(
    entry,
    `
      <main>
        <p>Urban Studies majors select one of two formal options: Community Engagement or Geographic Information Systems (GIS).</p>
        <h2>Formal options (choose one option)</h2>
        <h3>A. Community Engagement</h3>
        <p>T URB 360 Community Development and Planning</p>
        <h3>B. Geographic Information Systems (GIS)</h3>
        <p>T GIS 311 Maps and GIS</p>
      </main>
    `
  );

  assert.ok(parsed.pathwayLabels.includes("Community Engagement option"));
  assert.ok(parsed.pathwayLabels.includes("Geographic Information Systems (GIS) option"));
});

test("Parser scopes shared Tacoma option pages to the selected pathway section", () => {
  const sharedHtml = `
    <main>
      <h1>Urban Studies (BA)</h1>
      <p>Urban Studies majors select one of two formal options: Community Engagement or Geographic Information Systems (GIS).</p>
      <h2>Formal options (choose one option)</h2>
      <h3>A. Community Engagement</h3>
      <p>T URB 360 and T URB 361 are required.</p>
      <p>Choose one: T URB 380 or T URB 381.</p>
      <h3>B. Geographic Information Systems (GIS)</h3>
      <p>T GIS 311 and T GIS 312 are required.</p>
      <p>Choose one: T GIS 413 or T GIS 414.</p>
      <h2>Admissions</h2>
      <p>Meet with an adviser before applying.</p>
    </main>
  `;
  const baseEntry = {
    planId: "uw-tacoma-urban-studies",
    campusId: "uw-tacoma",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/urban-studies/ba-urban-studies",
    label: "UW Tacoma Urban Studies overview",
    sourceLabel: "UW Tacoma Urban Studies overview",
    ownerType: "pathway",
  };
  const communityParsed = parser.parseHtmlSourceFromArtifactsForTest(
    buildRecoveryEntryFixture({
      ...baseEntry,
      ownerId: "uw-tacoma-urban-studies:pathway:community-engagement-option",
      ownerTitle: "Urban Studies (BA) - Community Engagement option",
      pathwayId: "community-engagement-option",
    }),
    sharedHtml
  );
  const gisParsed = parser.parseHtmlSourceFromArtifactsForTest(
    buildRecoveryEntryFixture({
      ...baseEntry,
      ownerId: "uw-tacoma-urban-studies:pathway:gis-option",
      ownerTitle: "Urban Studies (BA) - GIS option",
      pathwayId: "gis-option",
    }),
    sharedHtml
  );

  assert.ok(communityParsed.courseCodes.includes("TURB 360"));
  assert.equal(communityParsed.courseCodes.includes("TGIS 311"), false);
  assert.ok(gisParsed.courseCodes.includes("TGIS 311"));
  assert.equal(gisParsed.courseCodes.includes("TURB 360"), false);
});

test("Parser does not re-add sibling courses when scoped Tacoma tracks share a subject", () => {
  const sharedHtml = `
    <main>
      <h1>Writing Studies</h1>
      <p>Writing Studies students choose from three tracks.</p>
      <h2>CREATIVE WRITING TRACK</h2>
      <p>TWRT 210 and TWRT 270 are required.</p>
      <h2>RHETORIC, WRITING AND SOCIAL CHANGE TRACK</h2>
      <p>TWRT 211 and TWRT 280 are required.</p>
      <h2>TECHNICAL COMMUNICATION TRACK</h2>
      <p>TWRT 212 and TWRT 290 are required.</p>
    </main>
  `;
  const baseEntry = {
    planId: "uw-tacoma-writing-studies",
    campusId: "uw-tacoma",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/sias/cac/writing-studies",
    label: "Writing Studies",
    sourceLabel: "Writing Studies",
    ownerType: "pathway",
  };
  const creativeParsed = parser.parseHtmlSourceFromArtifactsForTest(
    buildRecoveryEntryFixture({
      ...baseEntry,
      ownerId: "uw-tacoma-writing-studies:pathway:creative-writing-track",
      ownerTitle: "Writing Studies (BA) - CREATIVE WRITING TRACK",
      pathwayId: "creative-writing-track",
    }),
    sharedHtml
  );
  const socialChangeParsed = parser.parseHtmlSourceFromArtifactsForTest(
    buildRecoveryEntryFixture({
      ...baseEntry,
      ownerId: "uw-tacoma-writing-studies:pathway:rhetoric-writing-and-social-change-track",
      ownerTitle: "Writing Studies (BA) - RHETORIC, WRITING AND SOCIAL CHANGE TRACK",
      pathwayId: "rhetoric-writing-and-social-change-track",
    }),
    sharedHtml
  );

  assert.ok(creativeParsed.courseCodes.includes("TWRT 210"));
  assert.equal(creativeParsed.courseCodes.includes("TWRT 211"), false);
  assert.equal(creativeParsed.courseCodes.includes("TWRT 212"), false);
  assert.ok(socialChangeParsed.courseCodes.includes("TWRT 211"));
  assert.equal(socialChangeParsed.courseCodes.includes("TWRT 210"), false);
  assert.equal(socialChangeParsed.courseCodes.includes("TWRT 212"), false);
});

test("Parser recovery keeps promoted prerequisite pages support-only", () => {
  const entry = buildRecoveryEntryFixture({
    sourceLabel: "Prerequisites",
    role: "other",
    parserType: "generic-html",
    url: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/prerequisites",
    label: "Prerequisites",
    isPrimaryDegreeRequirementsLink: true,
  });
  const sourceRole = parser.classifyRequirementSourceRole(entry);
  const sourceScope = parser.buildRequirementSourceScope(sourceRole);

  assert.equal(sourceRole, "admissions-preparation");
  assert.equal(sourceScope.canCreateScheduleRows, false);
});

test("Parser recovery treats matched BA pathway child pages as primary sources", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId:
      "uw-seattle-slavic-languages-and-literatures:pathway:eastern-european-languages-literature-and-culture",
    ownerTitle:
      "Slavic Languages & Literatures - Eastern European Languages, Literature, and Culture",
    sourceLabel: "Eastern European Languages, Literature, and Culture",
    planId: "uw-seattle-slavic-languages-and-literatures",
    pathwayId: "eastern-european-languages-literature-and-culture",
    campusId: "uw-seattle",
    role: "other",
    parserType: "generic-html",
    url: "https://slavic.washington.edu/ba-eastern-european-languages-literature-and-culture",
    label: "BA Eastern European Languages, Literature, and Culture",
    isPrimaryDegreeRequirementsLink: true,
  });
  const sourceRole = parser.classifyRequirementSourceRole(entry);
  const sourceScope = parser.buildRequirementSourceScope(sourceRole);

  assert.equal(sourceRole, "primary-degree-requirements");
  assert.equal(sourceScope.canCreateScheduleRows, true);
});

test("Parser keeps Tacoma Communications admission and track rows schedulable on primary pages", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-communications",
    ownerTitle: "Communications (BA)",
    sourceLabel: "Communications",
    planId: "uw-tacoma-communications",
    campusId: "uw-tacoma",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/sias/cac/communication",
    label: "Communication",
  });
  const html = `
    <main>
      <h2>Admission Requirements</h2>
      <ul>
        <li>TCOM 201 Media and Society OR</li>
        <li>TCOM 230 Media Globalization and Citizenship</li>
      </ul>
      <h2>Degree Requirements</h2>
      <p>Professional Track students complete TCOM 320 and TCOM 420.</p>
    </main>
  `;
  const block = buildParsedBlockFixture(entry, html);
  const auditRows = parser.buildParserPrerequisiteFilterAuditRowsForTest({
    ownerId: entry.ownerId,
    sourceUrl: entry.url,
    sourceRole: block.sourceRole,
    snapshotLines: parser.buildHtmlLines(html),
  });

  assert.ok(block.parsedUwCourseCodes.includes("TCOM 201"));
  assert.ok(block.parsedUwCourseCodes.includes("TCOM 230"));
  assert.ok(
    auditRows.some(
      (row) => row.courseCodesExtracted.includes("TCOM 201") && row.schedulable
    )
  );
});

test("Parser keeps UWB CSSE-style accordion elective requirement rows schedulable", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-bothell-csse:pathway:iac-option",
    ownerTitle: "Computer Science & Software Engineering - Information Assurance & Cybersecurity Option",
    sourceLabel: "Information Assurance & Cybersecurity Option",
    planId: "uw-bothell-csse",
    pathwayId: "iac-option",
    campusId: "uw-bothell",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/options/iac",
    label: "Information Assurance & Cybersecurity Option",
  });
  const html = `
    <main>
      <h2>Information Assurance & Cybersecurity Option Requirements</h2>
      <p>Minimum 15 credits (3 courses) of elective coursework from the lists below.</p>
      <div class="accordion">
        <button>Cybersecurity electives</button>
        <ul>
          <li>CSS 337 Secure Systems</li>
          <li>CSS 411 Network Security</li>
          <li>INFO 314 Computer Networks and Distributed Applications</li>
        </ul>
      </div>
    </main>
  `;
  const block = buildParsedBlockFixture(entry, html);
  const auditRows = parser.buildParserPrerequisiteFilterAuditRowsForTest({
    ownerId: entry.ownerId,
    sourceUrl: entry.url,
    sourceRole: block.sourceRole,
    snapshotLines: parser.buildHtmlLines(html),
  });

  assert.ok(block.parsedUwCourseCodes.includes("CSS 337"));
  assert.ok(block.parsedUwCourseCodes.includes("CSS 411"));
  assert.ok(
    auditRows.some((row) => row.courseCodesExtracted.includes("CSS 337") && row.schedulable)
  );
});

test("Parser scopes nested bare option accordion sections to the selected pathway label", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-bothell-business-administration:pathway:finance-option-and-concentration",
    ownerTitle: "Business Administration - Finance option and concentration",
    sourceLabel: "Business Administration options and concentrations",
    planId: "uw-bothell-business-administration",
    pathwayId: "finance-option-and-concentration",
    campusId: "uw-bothell",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum",
    label: "Business Administration curriculum",
  });
  const html = `
    <main>
      <h2>Options and Concentrations</h2>
      <p>Students choose one option or concentration.</p>
      <div class="accordion">
        <button>Accounting</button>
        <div>
          <h3>Required Coursework</h3>
          <ul>
            <li>BBUS 320 Accounting Information Systems</li>
          </ul>
        </div>
        <button>Finance</button>
        <div>
          <h3>Core Courses</h3>
          <ul>
            <li>BBUS 350 Business Finance</li>
            <li>BBUS 451 Investments</li>
          </ul>
        </div>
        <button>Marketing</button>
        <div>
          <h3>Required Coursework</h3>
          <ul>
            <li>BBUS 470 Marketing Research</li>
          </ul>
        </div>
      </div>
    </main>
  `;
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(entry, html);
  const block = buildParsedBlockFixture(entry, html);

  assert.deepEqual(
    parsed.courseCodes,
    ["BBUS 350", "BBUS 451"]
  );
  assert.ok(block.parsedUwCourseCodes.includes("BBUS 350"));
  assert.ok(block.parsedUwCourseCodes.includes("BBUS 451"));
  assert.equal(block.parsedUwCourseCodes.includes("BBUS 320"), false);
  assert.equal(block.parsedUwCourseCodes.includes("BBUS 470"), false);
});

test("Parser recovery carries UWB BBA-style prerequisite pages as support only", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-bothell-business-administration",
    ownerTitle: "Business Administration",
    sourceLabel: "Prerequisite Courses",
    role: "admission-prerequisite-source",
    parserType: "html-degree-page",
    url:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
    label: "Prerequisite Courses",
  });
  const html = `
    <main>
      <h2>Prerequisites for admission</h2>
      <table>
        <tr><th>Course</th><th>Title</th></tr>
        <tr><td>B BUS 210</td><td>Financial Accounting</td></tr>
        <tr><td>B BUS 211</td><td>Managerial Accounting</td></tr>
      </table>
    </main>
  `;
  const block = buildParsedBlockFixture(entry, html);

  assert.equal(block.sourceRoleStatus, "support");
  assert.equal(block.canCreateSchedulableRows, false);
  assert.ok(block.supportOnlyUwCourseCodes.includes("BBUS 210"));
  assert.equal(block.supportLists.length, 1);
  assert.equal(block.supportLists[0].canCreateScheduleRow, false);
  assert.deepEqual(block.supportLists[0].acceptedUwCourseCodes, ["BBUS 210", "BBUS 211"]);
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
