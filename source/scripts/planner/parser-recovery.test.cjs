const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
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

test("Pathway HTML scoping keeps selected subsection requirements after credit headings", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-seattle-applied-mathematics:pathway:bs-option-family:data-science",
    ownerTitle: "Applied Mathematics - B.S. Data Science option",
    planId: "uw-seattle-applied-mathematics",
    pathwayId: "bs-option-family:data-science",
    campusId: "uw-seattle",
    url: "https://amath.washington.edu/applied-mathematics-data-science-option",
    label: "B.S. in Applied Mathematics: Data Science Option",
    sourceLabel: "B.S. in Applied Mathematics: Data Science Option",
  });
  const html = `
    <html>
      <head><title>Applied Mathematics: Data Science Option</title></head>
      <body>
        <nav>
          <a>B.S. in Applied Mathematics: Data Science Option</a>
          <a>B.S. in Computational Finance & Risk Management: Data Science Option</a>
        </nav>
        <h1>Applied Mathematics: Data Science Option</h1>
        <h2>Degree requirements:</h2>
        <p>Computing: AMATH 301 (4 credits)</p>
        <h2>Requirements for Data Science Option: (26-30 credits)</h2>
        <p>Data Science (23-25 credits):</p>
        <p>1. one of AMATH 481 or CSE 163 (4-5 credits)</p>
        <p>2. one of AMATH 482, CSE 414, or INFO 430 (4-5 credits)</p>
        <p>3. AMATH 483, CFRM 410, and CFRM 420 (11 credits)</p>
        <p>4. one of CFRM 421, CSE 416/STAT 416, or STAT 435 (4 credits)</p>
        <p>Society and Data (3-5 credits):</p>
        <p>5. INFO 351 (4 credits) or SOC 225 (3 or 5 credits)</p>
      </body>
    </html>
  `;

  const parsed = parser.parseHtmlSourceFromArtifactsForTest(entry, html);
  assert.ok(parsed.snapshotLines.includes("Society and Data (3-5 credits):"));
  assert.ok(parsed.snapshotLines.includes("5. INFO 351 (4 credits) or SOC 225 (3 or 5 credits)"));

  const groups = parser.buildParsedRequirementGroupsForTest(
    entry,
    parsed.courseCodes,
    parsed.snapshotLines
  );
  const societyAndDataGroup = groups.find((group) => {
    const optionCodes = (group.options ?? []).flatMap((option) => option.uwCourses ?? []);
    return optionCodes.includes("INFO 351") && optionCodes.includes("SOC 225");
  });

  assert.equal(societyAndDataGroup?.requirementType, "choose_one");
  assert.equal(societyAndDataGroup?.requiredCount, 1);
  assert.deepEqual(
    societyAndDataGroup?.options.flatMap((option) => option.uwCourses),
    ["INFO 351", "SOC 225"]
  );
  assert.doesNotMatch(
    JSON.stringify(groups.filter((group) => group.requirementType === "all_required")),
    /INFO 351.*SOC 225|SOC 225.*INFO 351/
  );
});

test("Parser keeps credit-bearing requirement rows schedulable when they include prerequisite notes", () => {
  const rows = parser.buildParserPrerequisiteFilterAuditRowsForTest({
    ownerId: "uw-seattle-aquatic-conservation-and-ecology",
    sourceUrl: "https://fish.uw.edu/students/undergraduate-program/bachelor-of-science/major-requirements/",
    sourceRole: "primary-degree-requirements",
    snapshotLines: [
      "Core Knowledge & Skills Courses",
      "ACE Core",
      "(15 credits) All of these courses will count towards the UW Additional Writing (W) requirement.",
      "FISH 312 (5; prereq BIOL 220/FISH 270) Fisheries Ecology",
      "FISH 323 (5) Conservation & Management of Aquatic Resources",
      "FISH 340 (5; prereq BIOL 200) Genetics & Molecular Ecology",
      "FISH 370 (5; prereq BIOL 220/FISH 270) Marine Evolutionary Biology",
    ],
  });
  const rowsByLine = new Map(rows.map((row) => [row.rawLine, row]));

  for (const rawLine of [
    "FISH 312 (5; prereq BIOL 220/FISH 270) Fisheries Ecology",
    "FISH 340 (5; prereq BIOL 200) Genetics & Molecular Ecology",
    "FISH 370 (5; prereq BIOL 220/FISH 270) Marine Evolutionary Biology",
  ]) {
    assert.equal(rowsByLine.get(rawLine)?.schedulable, true, rawLine);
    assert.equal(
      rowsByLine.get(rawLine)?.detectedSectionRole,
      "primary-requirement-section",
      rawLine
    );
  }
});

test("Parser groups titled credit sections without core/elective cue words", () => {
  const owner = buildRecoveryOwnerFixture({
    ownerId: "uw-seattle-aquatic-conservation-and-ecology",
    ownerTitle: "Aquatic Conservation & Ecology",
    planId: "uw-seattle-aquatic-conservation-and-ecology",
    campusId: "uw-seattle",
    sourceUrl:
      "https://fish.uw.edu/students/undergraduate-program/bachelor-of-science/major-requirements/",
    sourceRole: "primary-degree-requirements",
  });
  const snapshotLines = [
    "Basic Sciences",
    "Biology",
    "(15 credits)",
    "BIOL 180, 200",
    "BIOL 220 or FISH 270",
    "Majors are encouraged to complete the BIOL series as soon as possible, as many upper-level FISH Core and Elective courses have BIOL pre-requisites",
    "Introductory Courses",
    "Programming & Data Science",
    "(4 credits)",
    "CSE 160 (4) Data Programming",
    "Q SCI 256 (4) Intro to Data Science Methods for Environmental Sciences",
    "Core Knowledge & Skills Courses",
    "ACE Core",
    "(15 credits) All of these courses will count towards the UW Additional Writing (W) requirement.",
    "FISH 312 (5; prereq BIOL 220/FISH 270) Fisheries Ecology",
    "FISH 323 (5) Conservation & Management of Aquatic Resources",
    "One of the following:",
    "FISH 340 (5; prereq BIOL 200) Genetics & Molecular Ecology",
    "FISH 370 (5; prereq BIOL 220/FISH 270) Marine Evolutionary Biology",
    "Communicating Science",
    "(3 credits)",
    "One of the following:",
    "FISH 290 (3) Scientific Writing & Communication",
    "MARBIO 305 (3) Scientific Writing in Marine Biology",
    "Data Analysis & Modeling",
    "(5 credits)",
    "One of the following:",
    "FISH 454 (5; prereqs Q SCI 292 or MATH 125, Q SCI 381 or STAT 311) Ecological Modeling",
    "Q SCI 483 (5; prereq Q SCI 482) Statistical Inference in Applied Research II",
  ];
  const groups = parser.buildParsedRequirementGroupsForTest(
    owner,
    [
      "BIOL 180",
      "BIOL 200",
      "BIOL 220",
      "FISH 270",
      "CSE 160",
      "QSCI 256",
      "FISH 312",
      "FISH 323",
      "FISH 340",
      "FISH 370",
      "FISH 290",
      "MARBIO 305",
      "FISH 454",
      "QSCI 483",
    ],
    snapshotLines
  );
  const groupCodesByLabel = new Map(
    groups.map((group) => [
      group.label,
      (group.options ?? []).flatMap((option) => option.uwCourses ?? []),
    ])
  );

  assert.deepEqual(groupCodesByLabel.get("Programming & Data Science"), [
    "CSE 160",
    "QSCI 256",
  ]);
  assert.deepEqual(groupCodesByLabel.get("Biology"), [
    "BIOL 180",
    "BIOL 200",
    "BIOL 220",
  ]);
  const biologyGroup = groups.find((group) => group.label === "Biology");
  assert.match(JSON.stringify(biologyGroup?.options ?? []), /FISH 270/);
  assert.equal(biologyGroup?.requirementType, "choose_credits");
  assert.equal(biologyGroup?.minCredits, 15);
  assert.deepEqual(groupCodesByLabel.get("ACE Core required courses"), [
    "FISH 312",
    "FISH 323",
  ]);
  assert.deepEqual(groupCodesByLabel.get("ACE Core choice"), [
    "FISH 340",
    "FISH 370",
  ]);
  const aceCoreRequiredGroup = groups.find((group) => group.label === "ACE Core required courses");
  assert.equal(aceCoreRequiredGroup?.requirementType, "all_required");
  assert.equal(aceCoreRequiredGroup?.requiredCount, 2);
  const aceCoreChoiceGroup = groups.find((group) => group.label === "ACE Core choice");
  assert.equal(aceCoreChoiceGroup?.requirementType, "choose_credits");
  assert.equal(aceCoreChoiceGroup?.minCredits, 5);
  assert.notDeepEqual(groupCodesByLabel.get("ACE Core"), [
    "FISH 312",
    "FISH 323",
    "FISH 340",
    "FISH 370",
  ]);
  assert.deepEqual(groupCodesByLabel.get("Communicating Science"), [
    "FISH 290",
    "MARBIO 305",
  ]);
  assert.deepEqual(groupCodesByLabel.get("Data Analysis & Modeling"), [
    "FISH 454",
    "QSCI 483",
  ]);
  const optionCourseCodes = groups.flatMap((group) =>
    (group.options ?? []).flatMap((option) => [
      ...(option.uwCourses ?? []),
      ...(option.equivalentUwCourseCodes ?? []),
    ])
  );
  for (const prerequisiteOnlyCode of ["QSCI 482"]) {
    assert.equal(
      optionCourseCodes.includes(prerequisiteOnlyCode),
      false,
      `Did not expect prerequisite-only ${prerequisiteOnlyCode} to become a section option.`
    );
  }
});

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

test("Course-code parser expands same-subject plus-separated course numbers", () => {
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("B CHEM 143+144 General Chemistry I/Lab (6)"),
    ["BCHEM 143", "BCHEM 144"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("B CHEM 143+144 General Chemistry I/Lab (6) (or CHEM 142 (5))"),
    ["BCHEM 143", "BCHEM 144", "CHEM 142"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("CHEM 142 + 152 are required for this option."),
    ["CHEM 142", "CHEM 152"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("BIOEN 401 & 402 are the research capstone sequence."),
    ["BIOEN 401", "BIOEN 402"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest(
      "Precalculus (TMATH 115 & 116 or TMATH 120 at UW Tacoma; Precalculus I & II at most community colleges)"
    ),
    ["TMATH 115", "TMATH 116", "TMATH 120"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest(
      "Both BPHYS 114+117 and BPHYS 115+118: General Physics I and II + Labs"
    ),
    ["BPHYS 114", "BPHYS 115", "BPHYS 117", "BPHYS 118"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest(
      "The third course in the series is BPHYS 116+119 (General Physics III + Lab) or BPHYS 123."
    ),
    ["BPHYS 116", "BPHYS 119", "BPHYS 123"]
  );
});

test("Parser keeps prerequisite options scoped by owner acronym", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-information-technology",
    ownerTitle: "Information Technology (BS)",
    planId: "uw-tacoma-information-technology",
    campusId: "uw-tacoma",
    parserType: "html-overview-page",
    url: "https://www.tacoma.uw.edu/set/programs/undergrad/it",
    label: "UW Tacoma Information Technology requirements",
    sourceLabel: "UW Tacoma Information Technology requirements",
  });
  const html = `
    <main>
      <h2>Admission Requirements</h2>
      <p>Prerequisites</p>
      <p>Precalculus (TMATH 115 & 116 or TMATH 120 at UW Tacoma; Precalculus I & II at most community colleges)</p>
      <p>Introduction to Programming (TCSS 142)</p>
      <p>UW Tacoma students can take either TCSS 141 - Programming for All or TCSS 142 - Introduction to Programming to satisfy the programming prerequisite for the IT major. TCSS 141 is offered at the UW Tacoma campus only.</p>
      <h2>Curriculum Details</h2>
      <p>TINFO 200 Programming II for Information Technology and Systems</p>
      <p>TINFO 210 Foundations of Information Management</p>
    </main>
  `;
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(entry, html);

  assert.ok(parsed.courseCodes.includes("TMATH 116"));
  assert.ok(parsed.courseCodes.includes("TMATH 120"));
  assert.ok(parsed.courseCodes.includes("TCSS 141"));
  assert.ok(parsed.courseCodes.includes("TCSS 142"));
});

test("Parser keeps required prefix courses out of embedded one-of option groups", () => {
  const owner = buildRecoveryOwnerFixture({
    ownerId: "uw-seattle-economics",
    ownerTitle: "Economics",
    planId: "uw-seattle-economics",
    campusId: "uw-seattle",
  });
  const snapshotLines = [
    "Minimum 2.50 cumulative GPA for the following four courses: ECON 200, ECON 201; STAT 311; one of the following: MATH 124 or MATH 134, with a minimum 2.0 grade for each of these courses",
  ];
  const groups = parser.buildParsedRequirementGroupsForTest(
    owner,
    ["ECON 200", "ECON 201", "STAT 311", "MATH 124", "MATH 134"],
    snapshotLines
  );
  const mathChoice = groups.find((group) =>
    (group.options ?? []).some((option) => option.uwCourses?.includes("MATH 124")) &&
    (group.options ?? []).some((option) => option.uwCourses?.includes("MATH 134"))
  );

  assert.ok(mathChoice);
  assert.equal(mathChoice.requirementType, "choose_one");
  assert.deepEqual(
    mathChoice.options.flatMap((option) => option.uwCourses),
    ["MATH 124", "MATH 134"]
  );
  assert.equal(
    groups.some((group) =>
      (group.options ?? []).some((option) => option.uwCourses?.includes("ECON 200")) &&
      (group.options ?? []).some((option) => option.uwCourses?.includes("MATH 124"))
    ),
    false
  );

  const strategyGroups = parser.buildParsedRequirementGroupsForTest(
    owner,
    ["ECON 400", "ECON 482", "ECON 404", "ECON 485"],
    ["ECON 400, ECON 482; one of ECON 404 or ECON 485"]
  );
  const strategyChoice = strategyGroups.find((group) =>
    (group.options ?? []).some((option) => option.uwCourses?.includes("ECON 404")) &&
    (group.options ?? []).some((option) => option.uwCourses?.includes("ECON 485"))
  );

  assert.ok(strategyChoice);
  assert.deepEqual(
    strategyChoice.options.flatMap((option) => option.uwCourses),
    ["ECON 404", "ECON 485"]
  );
});

test("Course-code parser recovers compact known course subjects from PDF text", () => {
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("CSS342: Data Structures, Algorithms, & Discrete Math I"),
    ["CSS 342"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("BEE425 (Microprocessor System Design) or CSS422 (Hardware & Computer Organization)"),
    ["BEE 425", "CSS 422"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("B ENGR494, BENGR495, and BENGR496 must be taken in consecutive quarters."),
    ["BENGR 494", "BENGR 495", "BENGR 496"]
  );
});

test("PDF degree-sheet recovery keeps direct course rows outside dense subject clusters", () => {
  const lines = [
    "Mechanical Engineering Curriculum",
    "General education and additional courses: 39 credits",
    "Cross Campus Enrollment - after",
    "CSS 112: Intro to Programming for Scientific",
    "earning 15 credits at your home",
    "Applications",
  ];
  assert.deepEqual(
    parser.extractCourseCodesFromLinesForTest(
      lines,
      [],
      {
        parserType: "pdf-degree-sheet",
        label: "UW Bothell Mechanical Engineering curriculum PDF",
        url: "https://www.uwb.edu/stem/wp-content/uploads/sites/31/example.pdf",
      }
    ),
    ["CSS 112"]
  );
});

test("Legacy catalog scoping keeps the full selected program block", () => {
  const html = `
    <h2>Undergraduate Programs</h2>
    <ul>
      <li>Program of Study: Major: Civil Engineering</li>
      <li>Bachelor of Science in Civil Engineering degree</li>
      <li>Program of Study: Major: Computer Engineering</li>
      <li>Bachelor of Science degree with a major in Computer Engineering</li>
      <li>Program of Study: Major: Electrical Engineering</li>
      <li>Bachelor of Science in Electrical Engineering degree</li>
    </ul>
    <h3>Program of Study: Major: Civil Engineering</h3>
    <p>TCE 304 (3)</p>
    <p>Back to Top</p>
    <p>Catalog overview</p>
    <p>Admissions overview</p>
    <p>School information</p>
    <p>Undergraduate programs</p>
    <p>Advising notes</p>
    <p>Academic standards</p>
    <p>Campus resources</p>
    <p>Program notes</p>
    <p>Transfer notes</p>
    <p>Degree overview</p>
    <h3>Program of Study: Major: Computer Engineering</h3>
    <p>Admission Requirements</p>
    <p>TMATH 124, TMATH 125, and TMATH 126</p>
    <p>TMATH 207</p>
    <h4>Bachelor of Science degree with a major in Computer Engineering</h4>
    <p>Required Core Courses: 101 credits</p>
    <p>TCSS 342 (5)</p>
    <p>TCES 230 (5)</p>
    <p>TEE 451 (5)</p>
    <p>Back to Top</p>
    <h3>Program of Study: Major: Electrical Engineering</h3>
    <p>TEE 225 (5)</p>
  `;
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(
    {
      ownerId: "uw-tacoma-computer-engineering",
      ownerTitle: "Computer Engineering",
      planId: "uw-tacoma-computer-engineering",
      campusId: "uw-tacoma",
      parserType: "catalog-page",
      url: "https://www.washington.edu/students/gencat/program/T/SchoolofEngineeringandTechnology-1023.html",
      label: "UW Tacoma catalog Computer Engineering",
    },
    html
  );

  assert.ok(parsed.courseCodes.includes("TMATH 207"));
  assert.ok(parsed.courseCodes.includes("TCSS 342"));
  assert.ok(parsed.courseCodes.includes("TCES 230"));
  assert.ok(parsed.courseCodes.includes("TEE 451"));
  assert.ok(!parsed.courseCodes.includes("TCE 304"));
  assert.ok(!parsed.courseCodes.includes("TEE 225"));
});

test("Legacy catalog scoping matches parenthetical concentration credentials", () => {
  const html = `
    <div class="expandableGroup" data-expand="program-UG-IAS-MAJOR">
      <h3 class="expanded" id="program-UG-IAS-MAJOR">Program of Study: Major: Interdisciplinary Arts and Sciences</h3>
    </div>
    <div id="program-UG-IAS-MAJOR-block" class="inner-block" style="display:block">
      <p>This program of study leads to the following credentials:</p>
      <p>Bachelor of Arts degree with a major in Interdisciplinary Arts and Sciences</p>
      <p>Bachelor of Arts degree with a major in Interdisciplinary Arts and Sciences (Individually Designed)</p>
      <div class="expandableGroup" data-expand="credential-ias">
        <h4 class="expanded" id="credential-ias">Bachelor of Arts degree with a major in Interdisciplinary Arts and Sciences</h4>
      </div>
      <div id="credential-ias-block" class="inner-block" style="display:block">
        <p>Completion Requirements</p>
        <p>Core Courses: TIAS 201, THIST 150.</p>
        <p>Back to Top</p>
      </div>
      <div class="expandableGroup" data-expand="credential-ias-individual">
        <h4 class="expanded" id="credential-ias-individual">Bachelor of Arts degree with a major in Interdisciplinary Arts and Sciences (Individually Designed)</h4>
      </div>
      <div id="credential-ias-individual-block" class="inner-block" style="display:block">
        <p>Admission Requirements</p>
        <p>To propose an individually-designed concentration, students must consult with an advisor.</p>
        <p>Completion Requirements</p>
        <p>Required thesis: TIAS 497.</p>
        <p>Back to Top</p>
      </div>
    </div>
    <div class="expandableGroup" data-expand="program-UG-PPE-MAJOR">
      <h3 class="expanded" id="program-UG-PPE-MAJOR">Program of Study: Major: Politics, Philosophy, and Economics</h3>
    </div>
    <div id="program-UG-PPE-MAJOR-block" class="inner-block" style="display:block">
      <p>Core Courses: TECON 200, TECON 201.</p>
    </div>
  `;
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(
    {
      ownerId: "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed",
      ownerTitle: "Interdisciplinary Arts and Sciences: Individually-designed (BA)",
      planId: "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed",
      campusId: "uw-tacoma",
      parserType: "catalog-page",
      url: "https://www.washington.edu/students/gencat/program/T/SocialSciences-1132.html",
      label: "UW General Catalog Interdisciplinary Arts and Sciences individually designed major",
      ownerType: "major",
    },
    html
  );
  const scopedText = parsed.snapshotLines.join(" ");

  assert.match(scopedText, /individually-designed concentration/i);
  assert.ok(parsed.courseCodes.includes("TIAS 497"));
  assert.ok(!parsed.courseCodes.includes("TIAS 201"));
  assert.ok(!parsed.courseCodes.includes("TECON 200"));
});

test("Legacy catalog line scoping keeps parenthetical credentials past base Back to Top", () => {
  const html = `
    <h3>Program of Study: Major: Interdisciplinary Arts and Sciences</h3>
    <p>This program of study leads to the following credentials:</p>
    <p>Bachelor of Arts degree with a major in Interdisciplinary Arts and Sciences</p>
    <p>Bachelor of Arts degree with a major in Interdisciplinary Arts and Sciences (Individually Designed)</p>
    <h4>Bachelor of Arts degree with a major in Interdisciplinary Arts and Sciences</h4>
    <p>Completion Requirements</p>
    <p>Foundational/Core Courses: T HIST 150, TESC 102.</p>
    <p>Back to Top</p>
    <h4>Bachelor of Arts degree with a major in Interdisciplinary Arts and Sciences (Individually Designed)</h4>
    <p>Credential Overview</p>
    <p>This concentration is an individually-designed option.</p>
    <p>Admission Requirements</p>
    <p>To propose an individually-designed concentration, students must consult with an advisor.</p>
    <p>Identify the unifying interdisciplinary theme of your concentration.</p>
    <p>Identify the courses taken or planned.</p>
    <p>Draft a proposal with a brief descriptive title.</p>
    <p>Describe the rationale for the proposed concentration.</p>
    <p>Describe the interrelationships among chosen courses.</p>
    <p>Secure faculty sponsor support.</p>
    <p>Choose an IAS academic advisor.</p>
    <p>Submit the proposal by the end of junior year.</p>
    <p>Completion Requirements</p>
    <p>Required Course: TIAS 497.</p>
    <p>Back to Top</p>
    <h3>Program of Study: Major: Politics, Philosophy, and Economics</h3>
    <p>Core Courses: TECON 200, TECON 201.</p>
  `;
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(
    {
      ownerId: "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed",
      ownerTitle: "Interdisciplinary Arts and Sciences: Individually-designed (BA)",
      planId: "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed",
      campusId: "uw-tacoma",
      parserType: "catalog-page",
      url: "https://www.washington.edu/students/gencat/program/T/SocialSciences-1132.html",
      label: "UW General Catalog Interdisciplinary Arts and Sciences individually designed major",
      ownerType: "major",
    },
    html
  );
  const scopedText = parsed.snapshotLines.join(" ");

  assert.match(scopedText, /individually-designed concentration/i);
  assert.ok(parsed.courseCodes.includes("TIAS 497"));
  assert.ok(!parsed.courseCodes.includes("THIST 150"));
  assert.ok(!parsed.courseCodes.includes("TESC 102"));
  assert.ok(!parsed.courseCodes.includes("TECON 200"));
});

test("Legacy UW catalog Social Welfare credential scope keeps major requirements and excludes graduate credentials", () => {
  const html = `
    <div class="expandableGroup" data-expand="undergradPrograms">
      <h2 class="expanded" id="undergradPrograms">Undergraduate Program</h2>
    </div>
    <div id="undergradPrograms-block" class="inner-block" style="display:block">
      <div class="expandableGroup" data-expand="program-UG-SOC WF-MAJOR">
        <h3 class="expanded" id="program-UG-SOC WF-MAJOR">Program of Study: Major: Social Welfare</h3>
      </div>
      <div id="program-UG-SOC WF-MAJOR-block" class="inner-block" style="display:block">
        <div class="programRecommendedPrep">
          Suggested First- and Second-Year College Courses: prerequisite courses in psychology and sociology; SOC WF 200.
        </div>
        <div class="expandableGroup" data-expand="credential-basw">
          <h4 class="expanded" id="credential-basw">Bachelor of Arts degree with a major in Social Welfare</h4>
        </div>
        <div id="credential-basw-block" class="inner-block" style="display:block">
          <div class="programCompletionRequirements">
            <b>Completion Requirements</b>
            <p>General Education Requirements</p>
            <p>English Composition (C): 5 credits (minimum 2.0 grade)</p>
            <p>Areas of Inquiry</p>
            <p>Social Sciences (SSc): 20 credits</p>
            <p>Major Requirements</p>
            <p>67 credits</p>
            <p>Core Courses: SOC WF 200, SOC WF 265, SOC WF 305, SOC WF 310, SOC WF 311, SOC WF 312, SOC WF 313, SOC WF 320, SOC WF 390, SOC WF 402, SOC WF 404, SOC WF 405, SOC WF 415 (12), SOC WF 435, SOC WF 460 or SOC WF 495 (3), SOC WF 465. Minimum 2.0 grade in each course.</p>
          </div>
          <div class="backToTop"><a href="#top">Back to Top</a></div>
        </div>
      </div>
    </div>
    <div class="expandableGroup" data-expand="gradPrograms">
      <h2 class="expanded" id="gradPrograms">Graduate Programs</h2>
    </div>
    <div id="gradPrograms-block" class="inner-block" style="display:block">
      <div class="expandableGroup" data-expand="program-GR-SOC W-27">
        <h3 class="expanded" id="program-GR-SOC W-27">Program of Study: Master Of Social Work</h3>
      </div>
      <div id="program-GR-SOC W-27-block" class="inner-block" style="display:block">
        <div class="expandableGroup" data-expand="credential-msw">
          <h4 class="expanded" id="credential-msw">Master Of Social Work</h4>
        </div>
        <div id="credential-msw-block" class="inner-block" style="display:block">
          <p>Generalist core courses: SOC W 500, 501, 504, 505, 506 or 574, 510, 511, 512, 513.</p>
          <p>Generalist practicum: SOC W 524. Specialized practicum: SOC W 525.</p>
        </div>
      </div>
    </div>
  `;
  const entry = {
    ownerId: "uw-seattle-social-welfare",
    ownerTitle: "Social Welfare",
    planId: "uw-seattle-social-welfare",
    campusId: "uw-seattle",
    parserType: "catalog-page",
    url: "https://www.washington.edu/students/gencat/program/S/SocialWork-779.html",
    label: "UW General Catalog Social Welfare requirements",
    ownerType: "major",
  };
  const expectedBaswCodes = [
    "SOCWF 200",
    "SOCWF 265",
    "SOCWF 305",
    "SOCWF 310",
    "SOCWF 311",
    "SOCWF 312",
    "SOCWF 313",
    "SOCWF 320",
    "SOCWF 390",
    "SOCWF 402",
    "SOCWF 404",
    "SOCWF 405",
    "SOCWF 415",
    "SOCWF 435",
    "SOCWF 460",
    "SOCWF 465",
    "SOCWF 495",
  ];
  const forbiddenGraduateCodes = [
    "SOCW 500",
    "SOCW 501",
    "SOCW 504",
    "SOCW 505",
    "SOCW 506",
    "SOCW 510",
    "SOCW 511",
    "SOCW 512",
    "SOCW 513",
    "SOCW 524",
    "SOCW 525",
    "SOCW 574",
  ];

  for (const url of [entry.url, `${entry.url}#credential-basw`]) {
    const parsed = parser.parseHtmlSourceFromArtifactsForTest({ ...entry, url }, html);
    const scopedText = parsed.snapshotLines.join(" ");

    assert.match(scopedText, /Major Requirements/);
    assert.match(scopedText, /SOC WF 200/);
    for (const courseCode of expectedBaswCodes) {
      assert.ok(parsed.courseCodes.includes(courseCode), `${url} missing ${courseCode}`);
    }
    for (const courseCode of forbiddenGraduateCodes) {
      assert.ok(!parsed.courseCodes.includes(courseCode), `${url} leaked ${courseCode}`);
    }
    assert.doesNotMatch(scopedText, /Generalist core courses/);

    const groups = parser.buildParsedRequirementGroupsForTest(entry, parsed.courseCodes, parsed.snapshotLines);
    const broadCoreChoice = groups.find(
      (group) =>
        group.requirementType === "choose_one" &&
        /Core Courses:/i.test(group.sourceRowText ?? "") &&
        (group.options ?? []).length > 3
    );
    assert.equal(broadCoreChoice, undefined, `${url} treated the full core list as one choose-one group`);

    const coreRequiredGroup = groups.find(
      (group) =>
        group.requirementType === "all_required" &&
        /Core Courses:/i.test(group.sourceRowText ?? "") &&
        (group.options ?? []).some((option) => option.uwCourses?.includes("SOCWF 200"))
    );
    assert.ok(coreRequiredGroup, `${url} missing all-required Social Welfare core group`);
    assert.ok(coreRequiredGroup.options.some((option) => option.uwCourses?.includes("SOCWF 465")));
    assert.equal(
      coreRequiredGroup.options.some(
        (option) => option.uwCourses?.includes("SOCWF 460") || option.uwCourses?.includes("SOCWF 495")
      ),
      false,
      `${url} should keep the SOCWF 460/495 alternative out of the all-required core group`
    );

    const practiceChoiceGroup = groups.find((group) => {
      const optionCodes = (group.options ?? []).flatMap((option) => option.uwCourses ?? []).sort();
      return (
        group.requirementType === "choose_one" &&
        /Core Courses:/i.test(group.sourceRowText ?? "") &&
        optionCodes.join("|") === "SOCWF 460|SOCWF 495"
      );
    });
    assert.ok(practiceChoiceGroup, `${url} missing SOCWF 460/495 choice group`);
  }
});

test("Focused HTML degree pages keep full requirement pages", () => {
  const html = `
    <title>Undergraduate Degree Requirements - UW Bioengineering</title>
    <h1>Undergraduate Degree Requirements</h1>
    <h2>TOTAL CREDITS FOR DEGREE = 180</h2>
    <h4>Engineering Fundamentals (72 credits)</h4>
    <h4>Mathematics (24 credits)</h4>
    <p>MATH 124, 125, 126 Calculus with Analytic Geometry I, II, III</p>
    <p>MATH 207 or AMATH 351 Introduction to Differential Equations</p>
    <p>MATH 208 or AMATH 352 Matrix Algebra with Applications</p>
    <h4>Natural Science (44 credits)</h4>
    <p>CHEM 142, 152, 162 General Chemistry</p>
    <p>PHYS 121 Mechanics, with Lab</p>
    <p>PHYS 122 Electromagnetism and Oscillatory Motion, with Lab</p>
    <p>BIOL 180, 200, 220 Introductory Biology</p>
    <h4>Programming - Choose one option (4 credits)</h4>
    <p>AMATH 301 Beginning Scientific Computing</p>
    <p>CSE 121 or 160 plus BIOEN 217</p>
    <h4>Bioengineering Core (37 credits)</h4>
    <p>BIOEN 215 Bioengineering Problem Solving</p>
    <p>BIOEN 315 Biochemical and Molecular Bioengineering</p>
    <p>BIOEN 316 Biomedical Signals and Sensors</p>
    <p>BIOEN 317 Biomedical Signals and Sensors Lab</p>
    <p>BIOEN 325 Biotransport I</p>
    <p>BIOEN 326 Solid and Gel Mechanics</p>
    <p>BIOEN 327 Fluids and Biomaterials Lab</p>
    <p>BIOEN 335 Biotransport II</p>
    <p>BIOEN 336 Bioengineering Systems and Control</p>
    <p>BIOEN 337 Mass Transport and Systems Lab</p>
    <p>BIOEN 345 Failure Analysis of Human Physiology with Lab</p>
    <p>BIOEN 400 Fundamentals of Bioengineering Design</p>
    <h4>Bioengineering Senior Elective Courses (15 credits)</h4>
    <p>BIOEN 407 Bioengineering Nepal</p>
    <p>BIOEN 415 Bioconjugate Engineering</p>
    <p>BIOEN 420 Medical Imaging</p>
    <p>BIOEN 423 Introduction to Synthetic Biology</p>
    <p>BIOEN 424 Advanced Systems and Synthetic Biology</p>
    <p>BIOEN 425 Laboratory Methods in Synthetic Biology</p>
    <p>BIOEN 436 Quantitative Physiology</p>
    <h4>Bioengineering Senior Capstone (Choose one track) (10 credits)</h4>
    <p>BIOEN 401 and BIOEN 402</p>
    <p>BIOEN 404 and BIOEN 405</p>
  `;
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(
    {
      ownerId: "uw-seattle-bioengineering",
      ownerTitle: "Bioengineering",
      planId: "uw-seattle-bioengineering",
      campusId: "uw-seattle",
      parserType: "html-degree-page",
      url: "https://bioe.uw.edu/academic-programs/undergraduate/undergraduate-degree-requirements/",
      label: "UW Bioengineering undergraduate degree requirements",
    },
    html
  );

  assert.ok(parsed.courseCodes.includes("MATH 124"));
  assert.ok(parsed.courseCodes.includes("MATH 126"));
  assert.ok(parsed.courseCodes.includes("BIOEN 315"));
  assert.ok(parsed.courseCodes.includes("BIOEN 345"));
  assert.ok(parsed.courseCodes.includes("BIOEN 400"));
  assert.ok(parsed.courseCodes.includes("BIOEN 424"));
  assert.ok(parsed.courseCodes.includes("BIOEN 405"));
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

test("Snapshot fallback quality audit classifies missing heading context", () => {
  const owner = buildRecoveryOwnerFixture({
    usedSnapshotFallback: true,
    snapshotPath: "cached-snapshot.txt",
    snapshotHasHeadingMetadata: false,
    snapshotFallbackReason: "fetch failed",
    extractedHeadings: [],
    requirementCueLines: ["Degree Requirements"],
    chooseStatements: ["Choose one course from the following."],
  });
  const signals = parser.buildParseQualitySignalsForTest(owner);
  const signalCodes = signals.map((signal) => signal.code);

  assert.ok(signalCodes.includes("snapshot-fallback-used"));
  assert.ok(signalCodes.includes("snapshot-fallback-heading-context-missing"));
});

test("Snapshot fallback quality audit accepts present-but-empty heading metadata", () => {
  const owner = buildRecoveryOwnerFixture({
    usedSnapshotFallback: true,
    snapshotPath: "cached-snapshot.txt",
    snapshotHasHeadingMetadata: true,
    snapshotFallbackReason: "fetch failed",
    extractedHeadings: [],
    requirementCueLines: ["Degree Requirements"],
    chooseStatements: [],
  });
  const signals = parser.buildParseQualitySignalsForTest(owner);
  const signalCodes = signals.map((signal) => signal.code);

  assert.ok(signalCodes.includes("snapshot-fallback-used"));
  assert.equal(signalCodes.includes("snapshot-fallback-heading-context-missing"), false);
});

test("Snapshot reader preserves optional heading metadata", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gg-snapshot-"));
  const snapshotPath = path.join(tempDir, "snapshot.txt");

  fs.writeFileSync(
    snapshotPath,
    [
      "Owner: fixture",
      "Source: https://example.edu/requirements",
      "Title: Fixture Requirements",
      'Headings: ["Core Requirements","Electives"]',
      "",
      "Core Requirements",
      "Complete CSS 301.",
      "",
    ].join("\n")
  );

  try {
    const snapshot = parser.readSnapshotFileForTest(
      snapshotPath,
      "https://example.edu/requirements"
    );

    assert.deepEqual(snapshot.headings, ["Core Requirements", "Electives"]);
    assert.equal(snapshot.hasHeadingMetadata, true);
    assert.deepEqual(snapshot.snapshotLines, ["Core Requirements", "Complete CSS 301."]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("Snapshot reader marks legacy snapshots without heading metadata", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gg-snapshot-"));
  const snapshotPath = path.join(tempDir, "snapshot.txt");

  fs.writeFileSync(
    snapshotPath,
    [
      "Owner: fixture",
      "Source: https://example.edu/requirements",
      "Title: Fixture Requirements",
      "",
      "Core Requirements",
      "Complete CSS 301.",
      "",
    ].join("\n")
  );

  try {
    const snapshot = parser.readSnapshotFileForTest(
      snapshotPath,
      "https://example.edu/requirements"
    );

    assert.equal(snapshot.hasHeadingMetadata, false);
    assert.deepEqual(snapshot.headings, []);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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

test("Role-less DOCX worksheets are parseable primary requirement sources", () => {
  const entry = buildRecoveryEntryFixture({
    url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/bba-major-planning-worksheet.docx",
    label: "Business Administration major planning worksheet",
    parserType: "pdf-worksheet",
    role: undefined,
    isPrimaryDegreeRequirementsLink: false,
  });

  assert.equal(parser.classifyRequirementSourceRole(entry), "primary-degree-requirements");
  assert.equal(parser.shouldParseRequirementSourceEntry(entry), true);
});

test("Parser recovery rebuilds split snapshot href lines into linked document candidates", () => {
  const entry = buildRecoveryEntryFixture({
    ownerTitle: "Business Administration",
    sourceLabel: "Business Administration overview",
    parserType: "html-degree-page",
  });
  const artifacts = parser.buildParserRecoveryArtifactsFromSnapshotForTest(entry, {
    ...buildRecoveryOwnerFixture(),
    snapshotLines: [
      "Business Administration",
      "<a",
      'href="/business/undergraduate/bachelor-of-business-administration/bba-major-planning-worksheet.docx"',
      'target="_blank"',
      "Business Administration major planning worksheet",
      "</a>",
    ],
  });
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(entry, artifacts.html);
  const worksheet = candidates.find((candidate) => /\.docx$/i.test(candidate.url));

  assert.ok(worksheet);
  assert.equal(worksheet.strategy, "linked-official-document-recovery");
  assert.equal(worksheet.parserType, "pdf-worksheet");
  assert.equal(worksheet.sourceRoleStatus, "primary");
});

test("Parser recovery builds scoped section candidates from cached snapshot lines", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-bothell-nursing-rn-to-bsn:pathway:part-time-track",
    ownerTitle: "Nursing RN-to-BSN - Part-Time Track",
    planId: "uw-bothell-nursing-rn-to-bsn",
    pathwayId: "part-time-track",
    campusId: "uw-bothell",
    url: "https://www.uwb.edu/nhs/undergraduate/bsn",
    label: "RN-to-BSN",
  });
  const artifacts = parser.buildParserRecoveryArtifactsFromSnapshotForTest(entry, {
    ...buildRecoveryOwnerFixture({
      ownerId: entry.ownerId,
      ownerTitle: entry.ownerTitle,
      planId: entry.planId,
      pathwayId: entry.pathwayId,
      sourceUrl: entry.url,
      sourceLabel: entry.label,
      extractedTitle: "RN-to-BSN",
    }),
    snapshotLines: [
      "Program overview",
      "Part-Time Track Degree Requirements",
      "Complete BNURS 360, BNURS 407, and BNURS 420.",
      "Choose BNURS 460 or BNURS 470.",
      "Full-Time Track Degree Requirements",
      "Complete BNURS 350 and BNURS 430.",
    ],
  });
  const candidates = parser.buildParserRecoverySectionCandidatesForTest(entry, artifacts);

  assert.ok(candidates.length > 0);
  assert.ok(candidates[0].sectionLines.some((line) => line.includes("BNURS 360")));
  assert.equal(candidates[0].sectionLines.some((line) => line.includes("BNURS 350")), false);
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

test("Supplemental linked document recovery rejects conflicting degree-route PDFs", () => {
  const entry = buildRecoveryEntryFixture({
    id: "uw-seattle-chemistry:primary",
    ownerId: "uw-seattle-chemistry",
    ownerTitle: "Chemistry",
    planId: "uw-seattle-chemistry",
    campusId: "uw-seattle",
    parserType: "html-degree-page",
    url: "https://chem.washington.edu/ba-chemistry",
    label: "UW BA in Chemistry requirements",
    sourceLabel: "UW BA in Chemistry requirements",
  });
  const html = `
    <main>
      <a href="/sites/chem/files/documents/undergrad/acs2018.pdf">
        BS Chemistry Checklist - ACS Certified (PDF)
      </a>
      <a href="/sites/chem/files/documents/undergrad/ba-chemistry-checklist.pdf">
        BA Chemistry Checklist (PDF)
      </a>
    </main>
  `;
  const candidates = parser.extractSupplementalDocumentLinkCandidatesForTest(entry, html);

  assert.equal(candidates.some((candidate) => /acs2018\.pdf$/i.test(candidate.url)), false);
  assert.ok(candidates.some((candidate) => /ba-chemistry-checklist\.pdf$/i.test(candidate.url)));
});

test("Unscoped ACS-certified supplemental sources cannot create schedulable rows", () => {
  const unscopedAcsSource = buildRecoveryEntryFixture({
    id: "uw-seattle-chemistry:source:acs",
    ownerId: "uw-seattle-chemistry",
    ownerTitle: "Chemistry",
    planId: "uw-seattle-chemistry",
    campusId: "uw-seattle",
    parserType: "pdf-worksheet",
    role: "degree-requirements",
    url: "https://chem.washington.edu/sites/chem/files/documents/undergrad/acs2018.pdf",
    label: "BS Chemistry Checklist - ACS Certified (PDF)",
  });
  const scopedAcsSource = buildRecoveryEntryFixture({
    ...unscopedAcsSource,
    ownerId: "uw-seattle-chemistry:pathway:acs-certified-option",
    pathwayId: "acs-certified-option",
    ownerTitle: "Chemistry: ACS Certified Option",
  });

  assert.equal(parser.classifyRequirementSourceRole(unscopedAcsSource), "non-schedulable-course-list");
  assert.equal(
    parser.buildRequirementSourceScope(parser.classifyRequirementSourceRole(unscopedAcsSource))
      .canCreateScheduleRows,
    false
  );
  assert.equal(parser.classifyRequirementSourceRole(scopedAcsSource), "primary-degree-requirements");
});

test("Supplemental HTML recovery follows same-program approved elective pages", () => {
  const entry = buildRecoveryEntryFixture({
    id: "uw-bothell-health-studies:primary",
    ownerId: "uw-bothell-health-studies",
    ownerTitle: "Health Studies (BA)",
    planId: "uw-bothell-health-studies",
    campusId: "uw-bothell",
    parserType: "html-overview-page",
    url: "https://www.uwb.edu/nhs/undergraduate/health-studies/overview",
    label: "UW Bothell Health Studies overview",
    sourceLabel: "UW Bothell Health Studies overview",
  });
  const html = `
    <main>
      <a href="/nhs/undergraduate/health-studies/overview/hs-electives">
        Health Studies Elective webpage
      </a>
      <a href="/nhs/undergraduate/global-health-minor/gh-electives">
        Global Health electives
      </a>
    </main>
  `;
  const candidates = parser.extractSupplementalHtmlLinkCandidatesForTest(entry, html);
  const healthElectives = candidates.find((candidate) => /hs-electives$/.test(candidate.url));
  const globalHealthMinor = candidates.find((candidate) => /global-health-minor/.test(candidate.url));

  assert.ok(healthElectives);
  assert.equal(healthElectives.type, "general");
  assert.equal(healthElectives.sameProgramRequirementLink, true);
  assert.equal(globalHealthMinor, undefined);
});

test("Approved elective HTML pages keep multi-school course sections", () => {
  const entry = buildRecoveryEntryFixture({
    id: "uw-bothell-health-studies:electives",
    ownerId: "uw-bothell-health-studies",
    ownerTitle: "Health Studies (BA)",
    planId: "uw-bothell-health-studies",
    campusId: "uw-bothell",
    parserType: "html-overview-page",
    url: "https://www.uwb.edu/nhs/undergraduate/health-studies/overview/hs-electives",
    label: "Health Studies Elective webpage",
    sourceLabel: "Health Studies Elective webpage",
  });
  const html = `
    <main>
      <h1>Health Studies Electives</h1>
      <h2>Approved electives</h2>
      <h3>School of Nursing & Health Studies</h3>
      <table>
        <tr><th>Course</th><th>Interest area</th></tr>
        <tr><td>BHLTH 179 Interpersonal Communication</td><td>Health & Society</td></tr>
        <tr><td>BHLTH 196 Prep to Work with Communities</td><td>Community Health</td></tr>
        <tr><td>BHLTH 198 Physical Activity, Nutrition, & Health</td><td>Health & Life Sciences</td></tr>
        <tr><td>BHLTH 201 Intro to Global Health</td><td>Health & Society</td></tr>
      </table>
      <h3>School of Science, Technology, Engineering & Mathematics</h3>
      <table>
        <tr><th>Course</th><th>Interest area</th></tr>
        <tr><td>BBIO 180 Intro Biology I</td><td>Health & Life Sciences</td></tr>
        <tr><td>BCHEM 143/144 Chemistry I with Lab</td><td>Health & Life Sciences</td></tr>
      </table>
    </main>
  `;
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(entry, html);

  assert.ok(parsed.courseCodes.includes("BHLTH 179"));
  assert.ok(parsed.courseCodes.includes("BBIO 180"));
  assert.ok(parsed.courseCodes.includes("BCHEM 143"));
  assert.ok(parsed.courseCodes.includes("BCHEM 144"));
});

test("Parser source-section roles do not let elective prose block core course rows", () => {
  const rows = parser.buildParserPrerequisiteFilterAuditRowsForTest({
    ownerId: "uw-bothell-applied-computing",
    sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/applied-computing/curriculum",
    snapshotLines: [
      "General education courses",
      "In general, these general education courses can overlap with the Second Discipline and Elective courses for your major.",
      "Core courses",
      "CSS 301: Technical Writing",
      "CSS 340: Applied Algorithmics; or",
      "CSS 342: Advanced Data Structures, Algorithms, and Discrete Mathematics I; or",
      "CSS 350: Management for Computing Professionals; or",
      "B BUS 300: Organizational Behavior, Ethics, and Inclusivity",
      "CSS 360: Software Engineering",
      "CSS 421: Hardware and Operating Systems",
    ],
  });
  const rowsByRawLine = new Map(rows.map((row) => [row.rawLine, row]));

  for (const rawLine of [
    "CSS 301: Technical Writing",
    "CSS 340: Applied Algorithmics; or",
    "CSS 350: Management for Computing Professionals; or",
    "B BUS 300: Organizational Behavior, Ethics, and Inclusivity",
    "CSS 360: Software Engineering",
    "CSS 421: Hardware and Operating Systems",
  ]) {
    assert.equal(rowsByRawLine.get(rawLine)?.schedulable, true, rawLine);
  }
});

test("Parser does not turn IPR overlap policy text into a sectioned course list", () => {
  const groups = parser.buildParsedRequirementGroupsForTest(
    {
      ownerId: "uw-bothell-psychology",
      ownerTitle: "Psychology (BA)",
      planId: "uw-bothell-psychology",
      campusId: "uw-bothell",
      sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/psychology",
    },
    ["BISPSY 337", "BISPSY 343", "BISPSY 348", "BISPSY 350"],
    [
      "Interdisciplinary Practice & Reflection (IPR): The IPR requirement can overlap with the 70 credits of major coursework, or it can be completed through elective credits. Please see the IPR webpage for course options.",
      "Upper Division Credit Policy: A maximum of 35 credits earned in 100- and 200-level courses may apply toward the major. Remaining credits must be earned in upper division courses (300-level and above).",
      "A. Psychology core courses",
      "BISPSY 337 Risk and Resilience (not offered regularly)",
      "BISPSY 343 Community Psychology (Autumn Quarter)",
      "BISPSY 348 Cultural Psychology (Winter Quarter)",
      "BISPSY 350 Intergroup Relations (Spring Quarter)",
    ]
  );

  assert.equal(
    groups.some(
      (group) =>
        group.requirementType === "choose_credits" &&
        group.minCredits === 70 &&
        JSON.stringify(group.options).includes("BISPSY 337")
    ),
    false
  );
});

test("Parser handles word-parenthetical credits and skips degree-total elective prose", () => {
  const groups = parser.buildParsedRequirementGroupsForTest(
    {
      ownerId: "uw-tacoma-social-welfare",
      ownerTitle: "Social Welfare (BASW)",
      planId: "uw-tacoma-social-welfare",
      campusId: "uw-tacoma",
      sourceUrl: "https://www.tacoma.uw.edu/swcj/basw-curriculum",
    },
    [],
    [
      "Students complete the required BASW core curriculum in sequence over a two-year period. The BASW curriculum consists of a 58-credit program, offered through a hybrid schedule, comprised of three major areas: foundation courses, social work practice courses and practicum (field experience) combined with practicum seminars. In addition to these three areas, students will be required to complete 10 credits of upper-division Social Welfare electives. General electives may also be required depending upon the number of college level credits applied toward the degree.",
      "Ten (10) credits of Social Welfare Electives (TSOCWF 300- and 400-level non-core courses) are required and may be taken any time during the program or during any quarter enrolled as a matriculated student, including summer. The following courses are approved Social Welfare electives.",
      "TSOCWF 350 Biopsychosocial Human Services (5 cr)",
      "TSOCWF 351 Applied Statistics for Social and Human Services (5 cr)",
      'The courses you take to meet the requirements for your degree will not always total the 180 credits you need to graduate. The additional credits you need to bring your total to 180 are called "general electives." Students may choose from a variety of disciplines outside their major to fulfill general electives.',
      "TSOCWF 301 Social Welfare Practice I",
      "TSOCWF 300 Human Behavior in the Social Environment",
      "Ten (10) credits of approved Social Welfare electives and general electives may be taken at times other than those designated above, schedule permitting. Based upon sample plan, enrollment in 12 credits during summer is suggested.",
      "Please note: Students with admission deficiencies or Social Welfare prerequisite deficiencies must meet with an academic advisor regarding completion of deficiencies. Also, students who have not met the minimum of at least 20 credits of Arts and Humanities (A&H), 20 credits of Natural Sciences (NSc) and 20 credits of Social Sciences (SSc) within their lower-division course work must meet with the program advisor regarding selection of appropriate courses within an elective category to complete these Areas of Inquiry (A of I) requirements",
      "TSOCWF 402 Social Welfare Practice II (W)",
      "TSOCWF 310 Research Methods",
      "TSOCWF 320 Cultural Diversity and Justice",
    ]
  );

  const socialWelfareElectiveGroups = groups.filter((group) =>
    /Social Welfare Electives/i.test(group.sourceRowText ?? group.label)
  );
  assert.equal(socialWelfareElectiveGroups.length, 1);
  const socialWelfareElectives = socialWelfareElectiveGroups[0];
  assert.ok(socialWelfareElectives);
  assert.equal(socialWelfareElectives.requirementType, "choose_credits");
  assert.equal(socialWelfareElectives.minCredits, 10);
  assert.equal(socialWelfareElectives.maxCredits, 10);
  assert.deepEqual(
    (socialWelfareElectives.options ?? []).map((option) => option.uwCourses?.[0]),
    ["TSOCWF 350", "TSOCWF 351"]
  );
  assert.equal(
    groups.some(
      (group) =>
        group.requirementType === "choose_credits" &&
        group.minCredits === 180 &&
        /general electives|58-credit program/i.test(group.sourceRowText ?? group.label)
    ),
    false
  );
  assert.equal(
    groups.some((group) => /schedule permitting|sample plan/i.test(group.sourceRowText ?? group.label)),
    false
  );
  const advisingDistributionBucket = groups.find((group) =>
    /admission deficiencies|Areas of Inquiry/i.test(group.sourceRowText ?? group.label)
  );
  assert.equal(
    advisingDistributionBucket,
    undefined,
    "Expected the advising distribution note not to become a sectioned TSOCWF course bucket."
  );
});

test("Primary sources expose approved source-section courses as support lists", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-seattle-mechanical-engineering",
    ownerTitle: "Mechanical Engineering",
    planId: "uw-seattle-mechanical-engineering",
    campusId: "uw-seattle",
    parserType: "html-degree-page",
    url: "https://www.me.washington.edu/students/ug/requirements",
    label: "UW Seattle Mechanical Engineering requirements",
    sourceLabel: "UW Seattle Mechanical Engineering requirements",
  });
  const html = `
    <main>
      <h1>Mechanical Engineering requirements</h1>
      <h2>Engineering fundamentals</h2>
      <p>AA 210</p>
      <p>CEE 220</p>
      <h2>From the list of approved 400-level ME courses</h2>
      <p>ME 402</p>
      <p>Additive Manufacturing: Materials, Processing and Applications</p>
      <p>ME 406</p>
      <p>Corrosion and Surface Treatment of Materials</p>
    </main>
  `;
  const block = buildParsedBlockFixture(entry, html);
  const supportList = block.supportLists.find((list) =>
    /approved 400-level ME courses/i.test(list.listTitle)
  );

  assert.ok(block.parsedUwCourseCodes.includes("AA 210"));
  assert.ok(supportList);
  assert.equal(supportList.canCreateScheduleRow, false);
  assert.deepEqual(supportList.acceptedUwCourseCodes, ["ME 402", "ME 406"]);

  const generatedFilters = parser.buildGeneratedProgramApprovedCourseFiltersForTest({
    generatedAt: "test",
    owners: [block],
  });
  const mechanicalEngineeringFilter = generatedFilters.find((filter) =>
    /approved-400-level-me-courses/i.test(filter.filterKey)
  );

  assert.ok(mechanicalEngineeringFilter);
  assert.deepEqual(mechanicalEngineeringFilter.approvedUwCourseCodes, ["ME 402", "ME 406"]);
});

test("Parser treats distribution-area course lists as support lists", () => {
  const rows = parser.buildParserPrerequisiteFilterAuditRowsForTest({
    ownerId: "uw-seattle-english-language-literature-and-culture",
    sourceUrl: "https://english.washington.edu/english-language-literature-and-culture-option",
    snapshotLines: [
      "English Majors must also take at least 15 credits in each of the following areas:",
      "Historical Depth Courses:",
      "ENGL 210 Medieval and Early Modern Literature, 400 to 1600",
      "ENGL 211 Literature, 1500-1800",
      "Power and Difference Courses",
      "ENGL 257 Introduction to Asian American Literature",
    ],
  });
  const rowsByRawLine = new Map(rows.map((row) => [row.rawLine, row]));

  assert.equal(rowsByRawLine.get("Historical Depth Courses:")?.detectedSectionRole, "approved-course-list");
  assert.equal(rowsByRawLine.get("ENGL 210 Medieval and Early Modern Literature, 400 to 1600")?.schedulable, false);
  assert.equal(rowsByRawLine.get("ENGL 211 Literature, 1500-1800")?.schedulable, false);
  assert.equal(rowsByRawLine.get("Power and Difference Courses")?.detectedSectionRole, "approved-course-list");
  assert.equal(rowsByRawLine.get("ENGL 257 Introduction to Asian American Literature")?.schedulable, false);
});

test("UW Bothell admissions planning worksheets are admission prerequisite sources", () => {
  const sourceRole = parser.classifyRequirementSourceRole({
    ownerId: "uw-bothell-data-visualization-ba",
    ownerTitle: "Data Visualization (BA)",
    role: "worksheet",
    parserType: "html-degree-page",
    label: "UW Bothell major planning worksheet - Data Visualization (BA)",
    url: "https://admissions.uwb.edu/register/mpw-DataVis-BA",
  });

  assert.equal(sourceRole, "admission-prerequisite-source");
});

test("Focused degree scoping keeps nearby matching prerequisite sections", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-bothell-data-visualization-bs",
    ownerTitle: "Data Visualization (BS)",
    planId: "uw-bothell-data-visualization-bs",
    campusId: "uw-bothell",
    parserType: "html-degree-page",
    url: "https://www.uwb.edu/ias/undergraduate/majors/data-visualization",
    label: "Data Visualization",
    sourceLabel: "Data Visualization",
  });
  const html = `
    <main>
      <h1>Data Visualization</h1>
      <h2>Plan your degree</h2>
      <p>Prerequisites</p>
      <p>Bachelor of Arts Prerequisites</p>
      <p>ENGL 131</p>
      <p>B MATH 123</p>
      <p>Bachelor of Science Prerequisites</p>
      <p>B WRIT 134 or ENGL 131</p>
      <p>BIS 215 or B MATH 215 or B BUS 215 or STAT 220</p>
      <p>STMATH 124 or MATH 124</p>
      <h3>Bachelor of Science Degree Requirements</h3>
      <p>Data Visualization Core Courses</p>
      <p>B DATA 200 Introduction to Data Studies</p>
      <p>B DATA 232 Introduction to Data Visualization</p>
      <p>Either STMATH 125 or MATH 125 Calculus 2</p>
    </main>
  `;
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(entry, html);

  for (const courseCode of ["ENGL 131", "BMATH 215", "STMATH 124", "BDATA 200", "BDATA 232"]) {
    assert.ok(parsed.courseCodes.includes(courseCode), courseCode);
  }
});

test("Focused compact degree pages keep full official course lists", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-mathematics",
    ownerTitle: "Mathematics (BS)",
    planId: "uw-tacoma-mathematics",
    campusId: "uw-tacoma",
    parserType: "html-overview-page",
    url: "https://www.tacoma.uw.edu/sias/sam/mathematics",
    label: "Mathematics",
    sourceLabel: "Mathematics",
  });
  const courseLines = [
    "TMATH 124 Calculus with Analytic Geometry I",
    "TMATH 125 Calculus with Analytic Geometry II",
    "TMATH 126 Calculus with Analytic Geometry III",
    "TMATH 207 Introduction to Differential Equations",
    "TMATH 208 Matrix Algebra with Applications",
    "TMATH 224 Multivariable Calculus",
    "TMATH 300 Foundations of Mathematical Reasoning",
    "TMATH 350 Mathematics Research Seminar",
    "TMATH 402 Introduction to Abstract Algebra I",
    "TMATH 424 Introduction to Real Analysis I",
    "TMATH 403 Introduction to Abstract Algebra II",
    "TMATH 425 Introduction to Real Analysis II",
    "TMATH 210 Intermediate Statistics with Applications",
    "TMATH 390 Probability and Statistics in Engineering and Science",
    "TMATH 412 Cryptography OR TCSS 487 Cryptography",
    "TME 311 Computational Physical Modeling II",
    "TESC 430 Environmental Modeling",
    "TSTAT 280 Applied Data Science",
    "TMATH 302 Mathematics and Social Justice",
    "TMATH 450 Mathematics Capstone",
  ];
  const html = `
    <main>
      <h1>Mathematics</h1>
      <h2>Bachelor of Science</h2>
      <p>Core courses (49 credits)</p>
      ${courseLines.map((line) => `<p>${line}</p>`).join("\n")}
      <h3>ADMISSION REQUIREMENTS</h3>
      <p>A minimum of 45 lower-division credits is required before declaring the major.</p>
      <h3>DEGREE REQUIREMENTS</h3>
      <p>For a BS in Mathematics, students must complete 79 major credits.</p>
    </main>
  `;
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(entry, html);

  for (const courseCode of ["TMATH 124", "TMATH 300", "TMATH 402", "TMATH 425", "TCSS 487", "TMATH 450"]) {
    assert.ok(parsed.courseCodes.includes(courseCode), courseCode);
  }
});

test("Parser recognizes Tacoma Healthcare Leadership THLEAD course subjects", () => {
  assert.deepEqual(parser.extractCourseCodesFromLineForTest("THLEAD 350 Critical Analysis and Writing"), [
    "THLEAD 350",
  ]);
  assert.deepEqual(parser.extractCourseCodesFromLineForTest("TSTAT 280 Applied Data Science"), [
    "TSTAT 280",
  ]);
});

test("Tacoma elective placeholders do not block later sample-plan course rows", () => {
  const rows = parser.buildParserPrerequisiteFilterAuditRowsForTest({
    ownerId: "uw-tacoma-healthcare-leadership",
    sourceUrl: "https://www.tacoma.uw.edu/nursing/healthcare-leadership-sample-program-plan",
    snapshotLines: [
      "Spring",
      "T ELEC 2",
      "UWT Elective Course",
      "Winter",
      "THLEAD 406",
      "Health Informatics II",
      "Spring",
      "THLEAD 480",
      "Healthcare Leadership Fieldwork",
    ],
  });
  const rowsByRawLine = new Map(rows.map((row) => [row.rawLine, row]));

  assert.equal(rowsByRawLine.get("THLEAD 406")?.schedulable, true);
  assert.equal(rowsByRawLine.get("THLEAD 480")?.schedulable, true);
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

test("Parser keeps richer focused Bothell curriculum pages over incomplete linked checklists", () => {
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
    headings: [
      "Major requirements",
      "Core Courses (55 credits)",
      "Electrical Engineering Electives (15 credits)",
      "Foundational Courses (65-66 credits)",
    ],
    courseCodes: [
      "BEE 200",
      "BEE 215",
      "BEE 233",
      "BEE 235",
      "BEE 271",
      "BEE 331",
      "BEE 332",
      "BEE 341",
      "BEE 361",
      "BEE 381",
      "BEE 417",
      "BEE 425",
      "BEE 427",
      "BEE 433",
      "BEE 436",
      "BEE 437",
      "BEE 440",
      "BEE 442",
      "BEE 445",
      "BEE 447",
      "BEE 450",
      "BEE 451",
      "BEE 454",
      "BEE 455",
      "BEE 457",
      "BEE 477",
      "BEE 478",
      "BEE 482",
      "BEE 484",
      "BEE 486",
      "BEE 490",
      "BEE 498",
      "BEE 499",
      "BENGR 494",
      "BENGR 495",
      "BENGR 496",
      "CSS 427",
      "STMATH 124",
      "STMATH 125",
      "STMATH 126",
      "STMATH 207",
      "STMATH 208",
      "STMATH 224",
      "STMATH 390",
    ],
    requirementCueLines: [
      "Major requirements",
      "Core Courses (55 credits)",
      "Electrical Engineering Electives (15 credits)",
      "Choose three additional courses (15 credits) from the following list",
      "Foundational Courses (65-66 credits)",
    ],
    chooseStatements: ["Choose three additional courses (15 credits) from the following list"],
    pathwayLabels: [],
    snapshotLines: [
      "Electrical Engineering Curriculum",
      "Major requirements",
      "Core Courses (55 credits)",
      "Electrical Engineering Electives (15 credits)",
      "Choose three additional courses (15 credits) from the following list",
      "B EE 381",
      "CSS 427",
      "Foundational Courses (65-66 credits)",
    ],
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
    headings: [],
    courseCodes: [
      "BEE 200",
      "BEE 215",
      "BEE 233",
      "BEE 235",
      "BEE 271",
      "BEE 331",
      "BEE 332",
      "BEE 341",
      "BEE 361",
      "BEE 425",
      "BENGR 494",
      "BENGR 495",
      "BENGR 496",
      "STMATH 124",
      "STMATH 125",
      "STMATH 126",
      "STMATH 207",
      "STMATH 208",
      "STMATH 224",
      "STMATH 390",
    ],
    requirementCueLines: [
      "Before Applying",
      "Mathematics & Natural Sciences",
      "Fundamentals",
      "Core and Electives",
    ],
    chooseStatements: [],
    pathwayLabels: [],
    snapshotLines: [
      "Electrical Engineering B.S.E.E. Curriculum",
      "Before Applying",
      "Mathematics & Natural Sciences",
      "Fundamentals",
      "Core and Electives",
      "B EE Electives: 15 credits",
      "STMATH 124",
    ],
  };

  assert.equal(
    parser.shouldPreferSupplementalDocumentSourceForTest(
      entry,
      baseParsed,
      candidate,
      documentParsed
    ),
    false
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

test("Parser scopes Tacoma formal-option tables whose column headers precede their contents", () => {
  const sharedHtml = `
    <main>
      <h1>Sustainable Urban Development (BA)</h1>
      <h2>Shared Curriculum Courses</h2>
      <p>T URB 101 Exploring Cities (5)</p>
      <h2>Formal Options</h2>
      <p>Students declare one of the following formal options:</p>
      <table>
        <tr>
          <td><strong>A. Community Engagement</strong></td>
          <td><strong>B. GIS Certificate</strong></td>
        </tr>
        <tr>
          <td>
            <p>Complete all of the following:</p>
            <p>T URB 235 Community Development (5)</p>
            <p>T URB 220 Introduction to Urban Planning (5)</p>
            <p>T UDE 340 Urban Social Change (5)</p>
            <p>Choose 2 of the following:</p>
            <p>T URB 379 Urban Field Experience (5)</p>
            <p>T URB 470 Creating the Urban Narrative (5)</p>
            <p>T URB 479 Planning & Development in the Puget Sound Region (5)</p>
            <p>T URB 498 Urban Studies Internship (5)</p>
          </td>
          <td>
            <p><strong>GIS Certificate</strong>: Complete all 5 courses listed below:</p>
            <p>T GIS 311 Maps & GIS (6)</p>
            <p>T GIS 312 Intermediate GIS (6)</p>
            <p>T GIS 313 Applied GIS and Project Design (3)</p>
            <p>T GIS 414 Advanced GIS (5)</p>
            <p>T GIS 415 Critical GIS and Project Practicum (5)</p>
          </td>
        </tr>
      </table>
      <h2>General Electives</h2>
      <p>Students complete university requirements and electives.</p>
    </main>
  `;
  const baseEntry = {
    planId: "uw-tacoma-sustainable-urban-development",
    campusId: "uw-tacoma",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/urban-studies/ba-sustainable-urban-development",
    label: "UW Tacoma Sustainable Urban Development degree requirements",
    sourceLabel: "UW Tacoma Sustainable Urban Development degree requirements",
    ownerType: "pathway",
  };
  const baseParsed = parser.parseHtmlSourceFromArtifactsForTest(
    buildRecoveryEntryFixture({
      ...baseEntry,
      ownerId: "uw-tacoma-sustainable-urban-development",
      ownerTitle: "Sustainable Urban Development (BA)",
      pathwayId: null,
      ownerType: "major",
    }),
    sharedHtml
  );
  const communityParsed = parser.parseHtmlSourceFromArtifactsForTest(
    buildRecoveryEntryFixture({
      ...baseEntry,
      ownerId: "uw-tacoma-sustainable-urban-development:pathway:community-engagement-option",
      ownerTitle: "Sustainable Urban Development (BA) - Community Engagement option",
      pathwayId: "community-engagement-option",
    }),
    sharedHtml
  );
  const gisParsed = parser.parseHtmlSourceFromArtifactsForTest(
    buildRecoveryEntryFixture({
      ...baseEntry,
      ownerId: "uw-tacoma-sustainable-urban-development:pathway:gis-option",
      ownerTitle: "Sustainable Urban Development (BA) - GIS option",
      pathwayId: "gis-option",
    }),
    sharedHtml
  );

  assert.ok(baseParsed.courseCodes.includes("TURB 101"));
  assert.equal(baseParsed.courseCodes.includes("TURB 235"), false);
  assert.equal(baseParsed.courseCodes.includes("TGIS 312"), false);
  assert.ok(communityParsed.courseCodes.includes("TURB 235"));
  assert.ok(communityParsed.courseCodes.includes("TUDE 340"));
  assert.equal(communityParsed.courseCodes.includes("TGIS 312"), false);
  assert.ok(gisParsed.courseCodes.includes("TGIS 312"));
  assert.ok(gisParsed.courseCodes.includes("TGIS 415"));
  assert.equal(gisParsed.courseCodes.includes("TURB 235"), false);
});

test("Parser recovery rejects sibling Tacoma major pages with only weak title overlap", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-sustainable-urban-development",
    ownerTitle: "Sustainable Urban Development (BA)",
    planId: "uw-tacoma-sustainable-urban-development",
    campusId: "uw-tacoma",
    ownerType: "major",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/urban-studies/ba-sustainable-urban-development",
    label: "UW Tacoma Sustainable Urban Development degree requirements",
    sourceLabel: "UW Tacoma Sustainable Urban Development degree requirements",
  });
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(
    entry,
    `
      <main>
        <a href="/urban-studies/ba-urban-studies">BA in Urban Studies</a>
        <a href="/urban-studies/ba-sustainable-urban-development">BA in Sustainable Urban Development</a>
      </main>
    `
  );

  assert.equal(
    candidates.some((candidate) => candidate.url.endsWith("/urban-studies/ba-urban-studies")),
    false
  );
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

test("Parser keeps full dedicated Tacoma track degree pages instead of tail-scoping by track prose", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-communications:pathway:research-track",
    ownerTitle: "Communications (BA) - Research Track",
    planId: "uw-tacoma-communications",
    pathwayId: "research-track",
    campusId: "uw-tacoma",
    ownerType: "pathway",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/sias/cac/research-track",
    label: "Research Track degree requirements",
    sourceLabel: "Research Track degree requirements",
  });
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(
    entry,
    `
      <main>
        <h1>Research Track</h1>
        <h2>Degree Requirements</h2>
        <p>You need to complete 55 credits.</p>
        <h3>Foundation (10 credits)</h3>
        <p>TWRT 211 Argument and Research in Writing</p>
        <p>TCOM 444 Gender, Ethnicity, Class and Media</p>
        <p>TCOM 453 Critical Approaches to Mass Communication</p>
        <h3>Core courses (45 credits)</h3>
        <p>TCOM 101 Critical Media Literacy</p>
        <p>TCOM 201 Media and Society</p>
        <p>TCOM 220 Social Media</p>
        <p>TCOM 230 Media Globalization and Citizenship</p>
        <p>TCOM 247 Television Studies</p>
        <p>TCOM 495 Communication Capstone Thesis</p>
        <p>TLAX 441 Mexican Cinema and Society</p>
        <h3>Optional Capstone (5 credits)</h3>
        <p>Research Track students may choose to complete a senior thesis.</p>
      </main>
    `
  );

  for (const courseCode of ["TWRT 211", "TCOM 101", "TCOM 495", "TLAX 441"]) {
    assert.ok(parsed.courseCodes.includes(courseCode), `Expected ${courseCode} from full page scope`);
  }
});

test("Parser scopes dedicated Tacoma pathway pages before sidebar sibling track links", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-communications:pathway:research-track",
    ownerTitle: "Communications (BA) - Research Track",
    planId: "uw-tacoma-communications",
    pathwayId: "research-track",
    campusId: "uw-tacoma",
    ownerType: "pathway",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/sias/cac/research-track",
    label: "Research Track degree requirements",
    sourceLabel: "Research Track degree requirements",
  });
  const html = `
    <html>
      <head><title>Research Track | Culture, Arts & Communication</title></head>
      <body>
        <nav>
          <a>Professional Track</a>
          <a>Research Track</a>
        </nav>
        <main>
          <h1>Research Track</h1>
          <h2>Degree Requirements</h2>
          <p>You need to complete 55 credits.</p>
          <h3>Foundation (10 credits)</h3>
          <p>TWRT 211 Argument and Research in Writing</p>
          <p>TCOM 444 Gender, Ethnicity, Class and Media</p>
          <p>TCOM 453 Critical Approaches to Mass Communication</p>
          <h3>Core courses (including upper-division TCOM credits required) (45 credits)</h3>
          <p>TCOM 101 Critical Media Literacy</p>
          <p>TCOM 201 Media and Society</p>
          <p>TCOM 220 Social Media</p>
          <p>TCOM 230 Media Globalization and Citizenship</p>
          <p>TCOM 247 Television Studies</p>
          <p>TCOM 495 Communication Capstone Thesis</p>
          <p>TLAX 441 Mexican Cinema and Society</p>
        </main>
        <h2>Contact</h2>
      </body>
    </html>
  `;
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(entry, html);

  for (const courseCode of ["TWRT 211", "TCOM 101", "TCOM 495", "TLAX 441"]) {
    assert.ok(parsed.courseCodes.includes(courseCode), `Expected ${courseCode} after full-page scope`);
    assert.ok(
      parsed.snapshotLines.includes(
        courseCode === "TCOM 101"
          ? "TCOM 101 Critical Media Literacy"
          : courseCode === "TCOM 495"
            ? "TCOM 495 Communication Capstone Thesis"
            : courseCode === "TLAX 441"
              ? "TLAX 441 Mexican Cinema and Society"
              : "TWRT 211 Argument and Research in Writing"
      ),
      `Expected ${courseCode} source line to remain in scope`
    );
  }
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

test("Parser does not promote opposite-degree comparison prose into BA requirements", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-computer-science-and-systems-ba",
    ownerTitle: "Computer Science and Systems (BA)",
    planId: "uw-tacoma-computer-science-and-systems-ba",
    campusId: "uw-tacoma",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
    label: "Bachelor of Arts in CSS page.",
  });
  const html = `
    <main>
      <h2>Bachelors of Science or Arts?</h2>
      <h3>Similarities</h3>
      <p>Fundamentals of programming and software development principles (TCSS 305, 360)</p>
      <p>Machine organization (TCSS 372)</p>
      <h3>Differences</h3>
      <p>B.S. majors have 4 additional class requirements.</p>
      <p>Computer architecture and operating systems (TCSS 372, 422)</p>
      <p>Programming language concepts (TCSS 380)</p>
      <p>Learn more about B.S. in CSS</p>
      <h2>B.A. in CSS Requirements</h2>
      <ul>
        <li>TCSS 305 Programming Practicum</li>
        <li>TCSS 321 Discrete Structures I</li>
        <li>TCSS 325 Computers, Ethics, and Society</li>
        <li>TCSS 342 Data Structures</li>
        <li>TCSS 360 Software Development and Quality Assurance Techniques</li>
        <li>TCSS 371 Machine Organization</li>
        <li>TCSS 496 Portfolio Based Learning</li>
      </ul>
    </main>
  `;
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(entry, html);
  const block = buildParsedBlockFixture(entry, html);
  const auditRows = parser.buildParserPrerequisiteFilterAuditRowsForTest({
    ownerId: entry.ownerId,
    sourceUrl: entry.url,
    sourceRole: block.sourceRole,
    snapshotLines: parser.buildHtmlLines(html),
  });

  for (const courseCode of [
    "TCSS 305",
    "TCSS 321",
    "TCSS 325",
    "TCSS 342",
    "TCSS 360",
    "TCSS 371",
    "TCSS 496",
  ]) {
    assert.ok(parsed.courseCodes.includes(courseCode), `Expected ${courseCode} to remain parsed.`);
  }
  for (const courseCode of ["TCSS 372", "TCSS 380", "TCSS 422"]) {
    assert.equal(
      parsed.courseCodes.includes(courseCode),
      false,
      `Expected ${courseCode} to stay out of BA requirements.`
    );
    assert.equal(
      block.parsedUwCourseCodes.includes(courseCode),
      false,
      `Expected ${courseCode} to stay out of parsed source blocks.`
    );
  }
  assert.ok(
    auditRows.some(
      (row) =>
        row.courseCodesExtracted.includes("TCSS 372") &&
        row.detectedSectionRole === "support-metadata" &&
        row.schedulable === false
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

test("Parser keeps parent option requirements while scoping nested concentration accordions", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId:
      "uw-bothell-business-administration-marketing:pathway:finance-option-and-concentration",
    ownerTitle: "Business Administration: Marketing (BA) - Finance Option and Concentration",
    sourceLabel: "Marketing Option and Concentration",
    planId: "uw-bothell-business-administration-marketing",
    pathwayId: "finance-option-and-concentration",
    campusId: "uw-bothell",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/marketing",
    label: "Marketing Option and Concentration",
  });
  const html = `
    <main>
      <h1>Marketing Option and Concentration</h1>
      <p>Marketing option students complete the following required courses.</p>
      <ul>
        <li>BBUS 320 Marketing Management</li>
        <li>BBUS 421 Marketing Research</li>
      </ul>
      <h2>Optional Concentrations</h2>
      <div class="accordion">
        <button>Entrepreneurship Concentration</button>
        <div>
          <ul>
            <li>BBUS 443 Entrepreneurship Seminar</li>
          </ul>
        </div>
        <button>Finance Option and Concentration</button>
        <div>
          <h3>Finance Concentration Courses</h3>
          <ul>
            <li>BBUS 451 Financial Policy and Planning</li>
            <li>BBUS 454 Investments</li>
          </ul>
        </div>
        <button>MIS Concentration</button>
        <div>
          <ul>
            <li>BBUS 466 Information Systems Analysis</li>
          </ul>
        </div>
      </div>
    </main>
  `;
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(entry, html);

  assert.ok(parsed.courseCodes.includes("BBUS 320"));
  assert.ok(parsed.courseCodes.includes("BBUS 421"));
  assert.ok(parsed.courseCodes.includes("BBUS 451"));
  assert.ok(parsed.courseCodes.includes("BBUS 454"));
  assert.equal(parsed.courseCodes.includes("BBUS 443"), false);
  assert.equal(parsed.courseCodes.includes("BBUS 466"), false);
});

test("Parser does not promote standalone prerequisite numbers in course-title parentheticals", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId:
      "uw-bothell-business-administration:pathway:finance-option-and-concentration",
    ownerTitle: "Business Administration (BA) - Finance Option and Concentration",
    sourceLabel: "Finance Option and Concentration",
    planId: "uw-bothell-business-administration",
    pathwayId: "finance-option-and-concentration",
    campusId: "uw-bothell",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/finance-option",
    label: "Finance Option and Concentration",
  });
  const html = `
    <main>
      <h1>Finance Option and Concentration</h1>
      <h2>Option Required Courses</h2>
      <ul>
        <li>B BUS 350 - Business Finance</li>
        <li>B BUS 454 - Investments</li>
      </ul>
      <h2>Finance Concentration Courses</h2>
      <ul>
        <li>B BUS 361 - Intermediate Accounting I</li>
        <li>B BUS 362 - Intermediate Accounting II (361)</li>
        <li>B BUS 468 - Advanced Accounting and Analytics (363)</li>
        <li>ELCBUS 463 - International Finance and Trade (350)</li>
      </ul>
    </main>
  `;
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(entry, html);

  for (const courseCode of ["BBUS 361", "BBUS 362", "BBUS 468", "ELCBUS 463"]) {
    assert.ok(parsed.courseCodes.includes(courseCode), `Expected ${courseCode} to remain parsed.`);
  }
  assert.equal(parsed.courseCodes.includes("BBUS 363"), false);
  assert.equal(parsed.courseCodes.includes("ELCBUS 350"), false);
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
