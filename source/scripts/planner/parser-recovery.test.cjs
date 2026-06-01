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
    parsedDegreeMapBlockCandidates: [],
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

test("Course extraction expands shared-number slash-prefixed Tacoma course rows", () => {
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("TBIOL/TPSYCH 260 Biopsychology"),
    ["TBIOL 260", "TPSYCH 260"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("TSOCWF/THLTH 355 HIV/AIDS: Global and National Issues"),
    ["THLTH 355", "TSOCWF 355"]
  );
});

test("Course extraction handles Tacoma requirement rows with missing connector spacing", () => {
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("Statics (TME 221or UWS: AA 210)"),
    ["AA 210", "TME 221"]
  );
});

test("Course extraction handles known Tacoma subjects split after the campus prefix", () => {
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest(
      "T NURS 420 Person-Centered Care, Coordination & Management 5"
    ),
    ["TNURS 420"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("T HLTH 415 ELECTIVE: Health Policy and Ethics in Film"),
    ["THLTH 415"]
  );
});

test("Tacoma RN-BSN sample plan table resets graduate navigation context", () => {
  const rows = parser.buildParserPrerequisiteFilterAuditRowsForTest({
    ownerId: "uw-tacoma-nursing",
    sourceUrl: "https://www.tacoma.uw.edu/nursing/rn-bsn-sample-program-plans",
    sourceRole: "primary-degree-requirements",
    headings: ["RN-BSN Sample Program Plans", "Sample Program Plans for Summer Cohort"],
    snapshotLines: [
      "Bachelor of Science in Nursing",
      "Master of Nursing",
      "RN-BSN Sample Program Plans",
      "Sample Program Plans for Summer Cohort",
      "Summer",
      "Course Title",
      "Credits",
      "T NURS 360",
      "Critical Analysis & Nursing Scholarship",
      "5",
    ],
  });
  const courseRow = rows.find((row) => row.rawLine === "T NURS 360");
  assert.ok(courseRow, "Expected the Tacoma RN-BSN course row to be audited.");
  assert.deepEqual(courseRow.courseCodesExtracted, ["TNURS 360"]);
  assert.equal(courseRow.detectedSectionRole, "primary-requirement-section");
  assert.equal(courseRow.schedulable, true);
});

test("Parser keeps primary History requirement rows that mention inline prerequisites", () => {
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(
    buildRecoveryEntryFixture({
      ownerId: "uw-tacoma-history",
      ownerTitle: "History (BA)",
      planId: "uw-tacoma-history",
      campusId: "uw-tacoma",
      parserType: "html-degree-page",
      url: "https://www.tacoma.uw.edu/sias/socs/general-history-option",
      label: "General History Option",
      ownerType: "major",
    }),
    `
      <main>
        <h1>General History Option</h1>
        <h2>Degree Requirements</h2>
        <h3>Core Requirements (30 credits)</h3>
        <p>THIST 150 World History I</p>
        <p>THIST 151 World History II</p>
        <p>THIST 200 American History I, 1607-1877</p>
        <p>THIST 201 American History II, 1877-present</p>
        <p>THIST 380 Humanities Research and Writing (taken in junior year-recommended prerequisite: THIST 101)</p>
        <p>THIST 498 History Capstone (2.0 GPA minimum required; taken in your last 1-2 quarters; prerequisite: THIST 380 with a minimum 2.0 GPA)</p>
      </main>
    `
  );

  assert.ok(parsed.courseCodes.includes("THIST 380"));
  assert.ok(parsed.courseCodes.includes("THIST 498"));
});

test("Scoped Tacoma generic degree sections recover shared-number direct course rows", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-biomedical-sciences",
    ownerTitle: "Biomedical Sciences (BS)",
    planId: "uw-tacoma-biomedical-sciences",
    campusId: "uw-tacoma",
    parserType: "generic-html",
    url: "https://www.tacoma.uw.edu/sias/sam/biomedical-sciences",
    label: "Scoped section: Health and Society",
    sourceLabel: "Scoped section: Health and Society",
    ownerType: "major",
  });
  const owner = buildParsedBlockFixture(
    entry,
    `
      <main>
        <h1>Biomedical Sciences</h1>
        <h2>Degree Requirements</h2>
        <h3>Health and Society</h3>
        <p>TBIOL/TPSYCH 260 Biopsychology</p>
      </main>
    `
  );

  assert.ok(owner.parsedUwCourseCodes.includes("TBIOL 260"));
  assert.ok(owner.parsedUwCourseCodes.includes("TPSYCH 260"));
});

test("Inactive major sources do not trigger parser recovery debt", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-seattle-italian",
    ownerTitle: "Italian",
    planId: "uw-seattle-italian",
    campusId: "uw-seattle",
    url: "https://frenchitalian.washington.edu/undergraduate-studies-italian",
    label: "UW Italian undergraduate studies and major requirements status",
    sourceLabel: "UW Italian undergraduate studies and major requirements status",
  });
  const html = `
    <html>
      <head><title>Undergraduate Studies in Italian</title></head>
      <body>
        <h1>Undergraduate Studies in Italian</h1>
        <p>Please note at this time we are not able to offer the upper level courses for the Italian major. Therefore we are not able to accept students into the Italian major.</p>
        <a href="/major-italian-studies">Major Requirements</a>
      </body>
    </html>
  `;

  const owner = buildParsedBlockFixture(entry, html);
  const qualitySignals = parser.buildParseQualitySignalsForTest(owner);
  const requirementCueText = owner.requirementCueLines.join(" ");

  assert.equal(owner.sourceInactiveMajor, true);
  assert.equal(owner.sourceRole, "non-schedulable-course-list");
  assert.equal(owner.canCreateSchedulableRows, false);
  assert.match(
    requirementCueText,
    /not able to offer the upper level courses for the Italian major/i
  );
  assert.match(
    requirementCueText,
    /not able to accept students into the Italian major/i
  );
  assert.equal(
    qualitySignals.some((signal) => signal.code === "inactive-major-source"),
    true
  );
  assert.equal(
    qualitySignals.some((signal) => signal.code === "no-parsed-uw-course-codes"),
    false
  );
  assert.equal(
    parser.shouldTriggerParserRecoveryForTest({ ...owner, qualitySignals }),
    false
  );
});

test("Retired major pages using no-longer-accepting language are non-schedulable", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-bothell-community-psychology",
    ownerTitle: "Community Psychology",
    planId: "uw-bothell-psychology",
    campusId: "uw-bothell",
    url: "https://www.uwb.edu/ias/undergraduate/majors/community-psychology",
    label: "Community Psychology major requirements",
    sourceLabel: "Community Psychology major requirements",
  });
  const html = `
    <main>
      <h1>Community Psychology</h1>
      <p>The Community Psychology major is no longer accepting new students.</p>
      <h2>Degree Requirements</h2>
      <p>BIS 312 Approaches to Social Research</p>
    </main>
  `;

  const owner = buildParsedBlockFixture(entry, html, ["BIS 312"]);
  const qualitySignals = parser.buildParseQualitySignalsForTest(owner);

  assert.equal(owner.sourceInactiveMajor, true);
  assert.equal(owner.sourceRole, "non-schedulable-course-list");
  assert.equal(owner.canCreateSchedulableRows, false);
  assert.equal(
    qualitySignals.some((signal) => signal.code === "inactive-major-source"),
    true
  );
});

test("Historical requirement primary links are ignored before source scheduling", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-seattle-chinese",
    ownerTitle: "Chinese",
    planId: "uw-seattle-chinese",
    campusId: "uw-seattle",
    parserType: "html-overview-page",
    url: "https://asian.washington.edu/pre-winter-2019-chinese-major-requirements",
    label: "Pre-Winter 2019 Chinese Major Requirements",
    sourceLabel: "Pre-Winter 2019 Chinese Major Requirements",
    role: "degree-requirements",
    isPrimaryDegreeRequirementsLink: true,
  });

  assert.equal(parser.classifyRequirementSourceRole(entry), "old-archival");
  assert.equal(parser.canRequirementSourceRoleCreateSchedulableRows("old-archival"), false);
});

test("Default Bothell BA route pages use the full focused IAS degree source", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-bothell-psychology:pathway:ba-route",
    ownerTitle: "Psychology (BA) - B.A. route",
    planId: "uw-bothell-psychology",
    pathwayId: "ba-route",
    campusId: "uw-bothell",
    parserType: "html-overview-page",
    url: "https://www.uwb.edu/ias/undergraduate/majors/psychology",
    label: "Psychology",
    sourceLabel: "Psychology",
  });
  const html = `
    <main>
      <h1>Psychology</h1>
      <h2>BACHELOR OF ARTS</h2>
      <h2>PURPOSE</h2>
      <p>Psychology students study human well-being.</p>
      <h2>PRACTICE</h2>
      <p>Students learn research methods.</p>
      <h2>Plan your degree</h2>
      <h3>Major requirements</h3>
      <h4>Degree Requirements</h4>
      <p>One Psychology Core Course - min. 2.0 grade (5 credits)</p>
      <p>BIS 312 Approaches to Social Research- min. 2.0 grade (5 credits)</p>
      <h4>Courses</h4>
      <h5>A. Psychology core courses</h5>
      <p>BISPSY 337 Risk and Resilience (not offered regularly)</p>
      <p>BISPSY 343 Community Psychology (Autumn Quarter)</p>
      <p>BISPSY 350 Intergroup Relations (Spring Quarter)</p>
      <h5>C. 200-level Psychology courses (10 credits)</h5>
      <p>BIS 220 Developmental Psychology</p>
      <p>BIS 270 Abnormal Psychology</p>
      <h5>E. Psychology electives (15 credits)</h5>
      <p>B EDUC 451 Early Childhood Development</p>
      <p>B BIO 480 Neurobiology</p>
    </main>
  `;
  const owner = buildParsedBlockFixture(entry, html, [
    "BBIO 480",
    "BEDUC 451",
    "BIS 220",
    "BIS 270",
    "BIS 312",
    "BISPSY 337",
    "BISPSY 343",
    "BISPSY 350",
  ]);

  for (const courseCode of ["BIS 220", "BIS 312", "BISPSY 337", "BISPSY 343"]) {
    assert.ok(owner.parsedUwCourseCodes.includes(courseCode), courseCode);
  }
  assert.equal(owner.structuredOnlyUwCourseCodes.length, 0);
});

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

test("Parser ignores Expand All / Collapse All controls before sectioned credit buckets", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-seattle-aeronautics-astronautics",
    ownerTitle: "Aeronautics & Astronautics",
    planId: "uw-seattle-aeronautics-astronautics",
    campusId: "uw-seattle",
    url: "https://www.aa.washington.edu/students/academics/bsaae",
    label: "Aeronautics & Astronautics degree requirements",
    sourceLabel: "Aeronautics & Astronautics degree requirements",
  });
  const html = `
    <html>
      <body>
        <h1>Undergraduate Degree Requirements</h1>
        <button>Expand All | Collapse All</button>
        <h2>Mathematics (27 credits)</h2>
        <p>MATH 124 Calculus with Analytic Geometry I (5)</p>
        <p>MATH 125 Calculus with Analytic Geometry II (5)</p>
        <p>MATH 126 Calculus with Analytic Geometry III (5)</p>
        <p>MATH 207 Differential Equations (3)</p>
        <p>MATH 208 Matrix Algebra (3)</p>
        <p>MATH 224 Advanced Multivariable Calculus (3)</p>
        <h2>Engineering Fundamentals</h2>
      </body>
    </html>
  `;

  const parsed = parser.parseHtmlSourceFromArtifactsForTest(entry, html);
  assert.equal(parsed.snapshotLines.includes("Expand All | Collapse All"), false);

  const groups = parser.buildParsedRequirementGroupsForTest(
    entry,
    parsed.courseCodes,
    parsed.snapshotLines
  );
  const groupText = JSON.stringify(
    groups.map((group) => ({
      label: group.label,
      sourceHeading: group.sourceHeading,
      sourceRowText: group.sourceRowText,
    }))
  );

  assert.doesNotMatch(groupText, /Expand All \| Collapse All/);
  assert.ok(
    groups.some(
      (group) =>
        /^Mathematics\b/.test(group.label ?? "") &&
        group.requirementType === "choose_credits" &&
        group.minCredits === 27
    ),
    groupText
  );
});

test("Sectioned table credit lists do not end technical elective option groups", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-seattle-materials-science-engineering",
    ownerTitle: "Materials Science & Engineering",
    planId: "uw-seattle-materials-science-engineering",
    campusId: "uw-seattle",
    url: "https://mse.washington.edu/current/undergrad/courses",
    label: "MSE undergraduate courses",
    sourceLabel: "MSE undergraduate courses",
  });
  const snapshotLines = [
    "Other technical electives",
    "The courses listed below have been approved to satisfy the maximum of 9 credits of technical electives outside of MSE. If you would like to have any other course satisfy this requirement, you must fill out a Course Substitution Petition Form for review by the MSE Undergraduate Committee.",
    "Course #",
    "Course Name",
    "Credits",
    "A MATH 352",
    "Applied Linear Algebra & Numerical Analysis",
    "3",
    "A MATH 353",
    "Partial Differential Equations and Waves",
    "3",
    "BIOC 405, 406",
    "Introduction to Biochemistry",
    "3, 3",
    "CHEM 312",
    "Inorganic Chemistry",
    "3",
    "CHEM 455, 456, or 457",
    "Physical Chemistry",
    "3, 3, 3",
    "CHEM E 341",
    "Energy and Environment",
    "3",
    "ENGR 321",
    "Engineering Internship (can count a maximum of 4 cr. towards degree)",
    "1-2",
    "ENVIR 480",
    "Sustainability Studio",
    "5",
    "PHYS 321",
    "Electromagnetism",
    "4",
    "PHYS 324, 325",
    "Quantum Mechanics",
    "4, 4",
    "* ENTRE 370",
    "Introduction to Entrepreneurship",
    "4",
  ];

  const groups = parser.buildParsedRequirementGroupsForTest(entry, [], snapshotLines);
  const outsideMseGroup = groups.find((group) =>
    /technical electives outside of MSE/i.test(group.label ?? "")
  );
  const codes = new Set(
    (outsideMseGroup?.options ?? []).flatMap((option) => [
      ...(option.uwCourses ?? []),
      ...(option.equivalentUwCourseCodes ?? []),
    ])
  );
  const missing = [
    "AMATH 352",
    "AMATH 353",
    "BIOC 405",
    "BIOC 406",
    "CHEM 312",
    "CHEM 455",
    "CHEM 456",
    "CHEM 457",
    "CHEME 341",
    "ENGR 321",
    "ENVIR 480",
    "PHYS 321",
    "PHYS 324",
    "PHYS 325",
    "ENTRE 370",
  ].filter((courseCode) => !codes.has(courseCode));

  assert.ok(outsideMseGroup, "Expected outside-MSE technical elective group.");
  assert.deepEqual(missing, []);
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

test("Parser resets support notes before numbered course requirement headings", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-seattle-chinese",
    ownerTitle: "Chinese",
    planId: "uw-seattle-chinese",
    campusId: "uw-seattle",
    parserType: "html-overview-page",
    url: "https://asian.washington.edu/ba-chinese",
    label: "B.A. in Chinese",
    sourceLabel: "B.A. in Chinese",
    isPrimaryDegreeRequirementsLink: true,
  });
  const expectedCourseCodes = [
    "CHIN 342",
    "CHIN 442",
    "CHIN 451",
    "CHIN 461",
    "CHIN 463",
    "ASIAN 201",
    "ASIAN 204",
  ];
  const html = `
    <main>
      <h1>B.A. in Chinese</h1>
      <h2>Degree Requirements</h2>
      <h3>I. Modern Language Courses:</h3>
      <p>Students with advanced skills may alternatively take additional courses in linguistics, literature, culture, and/or classical language beyond the minimum 30 credits required, with approval of program coordinator. Note that no more than 20 credits of modern Chinese language courses may apply toward the major.</p>
      <h3>II. Linguistics, Literature, Culture and/or Classical Language Courses:</h3>
      <p>30-35 credits in linguistics, literature, culture and/or classical language. Must include:</p>
      <p>CHIN 451 Introduction to Classical Chinese (5 credits)</p>
      <p>CHIN 342 or CHIN 442 The Chinese Language (5 credits)</p>
      <p>CHIN 461 and CHIN 463 History of Chinese Literature (10 credits)</p>
      <p>Plus an additional 5-10 credits from among the following courses:</p>
      <p>ASIAN 201 Literature and Culture of Ancient and Classical China</p>
      <p>ASIAN 204 Literature and Culture of China from Tradition to Modernity</p>
    </main>
  `;

  const owner = buildParsedBlockFixture(entry, html, expectedCourseCodes);
  const rowsByRawLine = new Map(
    owner.sourceSectionFilterAuditRows.map((row) => [row.rawLine, row])
  );

  assert.equal(
    rowsByRawLine.get(
      "Students with advanced skills may alternatively take additional courses in linguistics, literature, culture, and/or classical language beyond the minimum 30 credits required, with approval of program coordinator. Note that no more than 20 credits of modern Chinese language courses may apply toward the major."
    )?.schedulable,
    false
  );
  assert.equal(
    rowsByRawLine.get("II. Linguistics, Literature, Culture and/or Classical Language Courses:")
      ?.detectedSectionRole,
    "primary-requirement-section"
  );
  assert.equal(rowsByRawLine.get("CHIN 451 Introduction to Classical Chinese (5 credits)")?.schedulable, true);
  for (const courseCode of expectedCourseCodes) {
    assert.ok(owner.parsedUwCourseCodes.includes(courseCode), courseCode);
  }
  assert.deepEqual(owner.structuredOnlyUwCourseCodes, []);
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

test("Focused ACE requirement pages stop before the retired AFS section", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "test-aquatic-conservation-and-ecology",
    ownerTitle: "Aquatic Conservation & Ecology",
    planId: "test-aquatic-conservation-and-ecology",
    campusId: "uw-seattle",
    parserType: "html-degree-page",
    url: "https://example.edu/test-ace-major-requirements",
    label: "Test Aquatic Conservation and Ecology major requirements",
    sourceLabel: "Test Aquatic Conservation and Ecology major requirements",
  });
  const owner = buildParsedBlockFixture(
    entry,
    `
      <main>
        <h1>Major Requirements</h1>
        <h2>Aquatic Conservation and Ecology (ACE) Degree Overview</h2>
        <h3>ACE Departmental Degree Requirements</h3>
        <h4>Basic Science Courses</h4>
        <p>Q SCI 291, 292 or MATH 124, 125 (calculus)</p>
        <p>Q SCI 381 or STAT 311 (statistics)</p>
        <p>CHEM 120 or both CHEM 142, 152 (general chemistry)</p>
        <p>CHEM 220, OCEAN 295, CHEM 223, or CHEM 237 (organic chemistry)</p>
        <p>BIOL 180, 200</p>
        <p>BIOL 220 or FISH 270</p>
        <h4>Introductory Courses</h4>
        <h5>People and the Environment</h5>
        <p>ANTH 210 (5) Intro to Environmental Anthropology</p>
        <p>ENVIR 235 (5) Intro to Environmental Economics</p>
        <p>FISH 230 (5) Economics of Fisheries & Oceans</p>
        <h4>Core Knowledge & Skills Courses</h4>
        <p>FISH 312 (5; prereq BIOL 220/FISH 270) Fisheries Ecology</p>
        <p>FISH 323 (5) Conservation & Management of Aquatic Resources</p>
        <p>FISH 340 (5; prereq BIOL 200) Genetics & Molecular Ecology</p>
        <p>FISH 370 (5; prereq BIOL 220/FISH 270) Marine Evolutionary Biology</p>
        <h3>AFS Departmental Degree requirements</h3>
        <h4>Physics</h4>
        <p>PHYS 114 (4) or PHYS 121 (5)</p>
        <h4>Natural History</h4>
        <p>FISH 310 (5) Biology of Shellfish</p>
        <p>FISH 311 (5) Biology of Fishes</p>
        <h4>Physical World</h4>
        <p>ATMOS 211 (5) Climate and Climate Change</p>
        <h4>Capstone Research</h4>
        <p>FISH 493 (1; prereq FISH 290) Capstone 1: Proposal</p>
      </main>
    `,
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
      "OCEAN 295",
      "CHEM 223",
      "CHEM 237",
      "BIOL 180",
      "BIOL 200",
      "BIOL 220",
      "ANTH 210",
      "ENVIR 235",
      "FISH 230",
      "FISH 270",
      "FISH 312",
      "FISH 323",
      "FISH 340",
      "FISH 370",
    ]
  );

  assert.ok(owner.parsedUwCourseCodes.includes("ANTH 210"));
  assert.ok(owner.parsedUwCourseCodes.includes("FISH 312"));
  assert.equal(owner.parsedUwCourseCodes.includes("PHYS 114"), false);
  assert.equal(owner.parsedUwCourseCodes.includes("FISH 310"), false);
  assert.equal(owner.parsedUwCourseCodes.includes("ATMOS 211"), false);
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

test("Course-code parser drops explicit exclusions near generic level prose", () => {
  assert.deepEqual(
    parser.extractCourseCodesFromRequirementLineForTest(
      "Complete 15 credits of 300-level GREEK courses; GREEK 300 and GREEK 301 are excluded."
    ),
    []
  );
  assert.deepEqual(
    parser.extractCourseCodesFromRequirementLineForTest(
      "An additional lab-based science course or an additional 300 or 400-level math course, except TMATH 310"
    ),
    []
  );
  assert.deepEqual(
    parser.extractCourseCodesFromRequirementLineForTest(
      "Students must complete 25 additional graded credits of 300-level or 400-level courses chosen from the Computer Science & Systems program (excluding TCSS 390)."
    ),
    []
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("MATH 307, 308, 309, and 324 are accepted."),
    ["MATH 307", "MATH 308", "MATH 309", "MATH 324"]
  );
});

test("Course-code parser recovers courses after choice prose", () => {
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest(
      "One course from DRAMA 213, DRAMA 319, DRAMA 414, DRAMA 415, DRAMA 419 (3-4 credits)"
    ),
    ["DRAMA 213", "DRAMA 319", "DRAMA 414", "DRAMA 415", "DRAMA 419"]
  );
});

test("Admission prerequisite HTML pages keep official prerequisite tables in scope", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-bachelor-of-arts-in-business-administration",
    ownerTitle: "Business Administration (BA)",
    planId: "uw-tacoma-bachelor-of-arts-in-business-administration",
    campusId: "uw-tacoma",
    role: "admissions-prerequisites",
    parserType: "html-admissions-page",
    url: "https://www.tacoma.uw.edu/business/baba-admissions",
    label: "UW Tacoma BABA admissions prerequisites",
  });
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(
    entry,
    `
      <main>
        <h1>BABA Admissions</h1>
        <p>Direct Admission (First-year students)</p>
        <h2>ADMISSION REQUIREMENTS</h2>
        <p>Applicants must complete business prerequisite courses.</p>
        <h2>APPLICATION ELIGIBILITY</h2>
        <table>
          <tr><th>Course</th><th>Application eligibility</th></tr>
          <tr><td>Financial Accounting I (TACCT 210)</td><td>Yes</td></tr>
          <tr><td>Financial Accounting II (TACCT 220)</td><td>May be in progress</td></tr>
          <tr><td>Managerial Accounting (TACCT 230)</td><td>May be in progress</td></tr>
          <tr><td>Intro to Statistics (TMATH 110)</td><td>Yes</td></tr>
          <tr><td>Business Law (TBGEN 218)</td><td>May be in progress</td></tr>
          <tr><td>Microeconomics (TBECON 220 or TECON 200)</td><td>Yes</td></tr>
          <tr><td>Macroeconomics (TBECON 221 or TECON 201)</td><td>Yes</td></tr>
        </table>
      </main>
    `
  );

  for (const courseCode of [
    "TACCT 210",
    "TACCT 220",
    "TACCT 230",
    "TMATH 110",
    "TBGEN 218",
    "TBECON 220",
    "TECON 200",
    "TBECON 221",
    "TECON 201",
  ]) {
    assert.ok(parsed.courseCodes.includes(courseCode), `Expected ${courseCode} to be parsed.`);
  }
});

test("Graduate prose inside Tacoma BABA option intro does not suppress undergraduate curriculum rows", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-bachelor-of-arts-in-business-administration",
    ownerTitle: "Business Administration (BA)",
    planId: "uw-tacoma-bachelor-of-arts-in-business-administration",
    campusId: "uw-tacoma",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/business/design-courses-baba",
    label: "UW Tacoma BABA design your courses",
  });
  const graduateNote =
    "Milgard also offers a specialized Master of Science in Accounting degree for students looking to continue their accounting education.";
  const block = buildParsedBlockFixture(
    entry,
    `
      <main>
        <h1>Design Your Courses</h1>
        <h2>Accounting</h2>
        <p>Accounting focuses on recording and reporting financial transactions.</p>
        <p>${graduateNote}</p>
        <h3>Accounting curriculum</h3>
        <p>Once accepted into the Business School, accounting students must complete the following courses for graduation.</p>
        <p>30 credits of core courses:</p>
        <p>TBUS 300 Managing Organizations</p>
        <p>35 credits from Accounting:</p>
        <p>TACCT 301 Intermediate Accounting I</p>
        <p>TACCT 302 Intermediate Accounting II</p>
      </main>
    `
  );
  const rowsByLine = new Map(block.sourceSectionFilterAuditRows.map((row) => [row.rawLine, row]));

  assert.equal(block.parsedUwCourseCodes.includes("TBUS 300"), true);
  assert.equal(block.parsedUwCourseCodes.includes("TACCT 301"), true);
  assert.equal(block.parsedUwCourseCodes.includes("TACCT 302"), true);
  assert.equal(rowsByLine.get(graduateNote)?.schedulable, false);
  assert.equal(
    rowsByLine.get("TACCT 301 Intermediate Accounting I")?.detectedSectionRole,
    "primary-requirement-section"
  );
});

test("Tacoma BABA pathway sources scope to the selected option section", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-bachelor-of-arts-in-business-administration:pathway:finance-option",
    ownerTitle: "Business Administration (BA) - Finance option",
    planId: "uw-tacoma-bachelor-of-arts-in-business-administration",
    pathwayId: "finance-option",
    campusId: "uw-tacoma",
    role: "degree-requirements",
    parserType: "html-curriculum-page",
    url: "https://www.tacoma.uw.edu/business/design-courses-baba",
    label: "UW Tacoma BABA Finance curriculum",
    sourceLabel: "UW Tacoma BABA Finance curriculum",
  });
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(
    entry,
    `
      <main>
        <h1>Design Your Courses</h1>
        <h2>Accounting</h2>
        <h3>Accounting curriculum</h3>
        <p>TBUS 300 Managing Organizations</p>
        <p>TACCT 301 Intermediate Accounting I</p>
        <h2>Finance</h2>
        <h3>Finance curriculum</h3>
        <p>TBUS 300 Managing Organizations</p>
        <p>TBUS 330 Introduction to Information Technology</p>
        <p>30 credits from 300- and 400-level TFIN or TBECON courses. TBANLT 433 counts for this option.</p>
        <p>5 credits TBUS 400 Business Policy and Strategic Management</p>
        <h2>Marketing</h2>
        <h3>Marketing curriculum</h3>
        <p>TMKTG 450 Consumer Behavior</p>
      </main>
    `
  );

  assert.deepEqual(parsed.courseCodes, ["TBANLT 433", "TBUS 300", "TBUS 330", "TBUS 400"]);
  assert.equal(parsed.snapshotLines.includes("Finance curriculum"), true);
  assert.equal(parsed.snapshotLines.includes("Accounting curriculum"), false);
  assert.equal(parsed.snapshotLines.includes("Marketing curriculum"), false);
});

test("Requirement parser treats inline Select labels as choose-one groups", () => {
  const owner = buildRecoveryOwnerFixture({
    ownerId: "uw-seattle-public-health-global-health",
    ownerTitle: "Public Health - Global Health",
    planId: "uw-seattle-public-health-global-health",
    campusId: "uw-seattle",
  });
  const groups = parser.buildParsedRequirementGroupsForTest(
    owner,
    ["CHEM 120", "CHEM 142", "CHEM 145"],
    [
      "NATURAL SCIENCE [ 10 cr ]",
      "Select CHEM: CHEM 120, 142, 145",
    ]
  );
  const chemGroup = groups.find((group) => group.label === "Select CHEM");

  assert.ok(chemGroup, "Expected Select CHEM to materialize as a requirement group.");
  assert.equal(chemGroup.requirementType, "choose_one");
  assert.equal(chemGroup.minCourses, 1);
  assert.equal(chemGroup.selectionCount, 1);
  assert.deepEqual(
    (chemGroup.options ?? []).flatMap((option) => option.uwCourses ?? []),
    ["CHEM 120", "CHEM 142", "CHEM 145"]
  );
});

test("Requirement parser does not promote competency table fragments as standalone requirements", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-seattle-public-health-global-health",
    ownerTitle: "Public Health - Global Health",
    planId: "uw-seattle-public-health-global-health",
    campusId: "uw-seattle",
    parserType: "pdf-degree-sheet",
    url:
      "https://sph.washington.edu/sites/default/files/2024-09/Public-Health-Global-Health-Major-OnePager-Purple-Curriculum-AUT2024.pdf",
    label: "UW Public Health-Global Health AUT 2024 curriculum sheet",
  });
  const baseResult = buildRecoveryOwnerFixture({
    ownerId: entry.ownerId,
    ownerTitle: entry.ownerTitle,
    planId: entry.planId,
    campusId: entry.campusId,
    primaryParserType: entry.parserType,
    primarySourceUrl: entry.url,
    primarySourceLabel: entry.label,
    structuredUwCourseCodes: [],
    supportLists: [],
  });
  const parsed = {
    courseCodes: ["CHEM 120", "CHEM 142", "CHEM 145", "CHEM 152"],
    snapshotLines: [
      "[Page 2] NATURAL SCIENCE [ 10 cr ]",
      "[Page 2] Select CHEM: CHEM 120, 142, 145",
      "[Page 2] health systems competency CHEM 142, 152, CHEM 142, 152, CHEM 142,",
    ],
    headings: [],
    requirementCueLines: [
      "[Page 2] NATURAL SCIENCE [ 10 cr ]",
      "[Page 2] Select CHEM: CHEM 120, 142, 145",
      "[Page 2] health systems competency CHEM 142, 152, CHEM 142, 152, CHEM 142,",
    ],
    chooseStatements: [],
    pathwayLabels: [],
    title: "Public Health - Global Health",
  };

  const owner = parser.buildManifestParseSuccessForTest(
    baseResult,
    [],
    entry,
    parsed,
    "primary-source"
  );

  assert.ok(owner.parsedUwCourseCodes.includes("CHEM 142"));
  assert.equal(owner.parsedUwCourseCodes.includes("CHEM 152"), false);
  assert.equal(
    owner.parsedRequirementAtomCandidates.some(
      (candidate) => candidate.uwCourseCode === "CHEM 152"
    ),
    false
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

test("Requirement parser treats same-subject bare-number alternatives as sequence choices", () => {
  const owner = buildRecoveryOwnerFixture({
    ownerId: "uw-seattle-computer-engineering",
    ownerTitle: "Computer Engineering",
    planId: "uw-seattle-computer-engineering",
    campusId: "uw-seattle",
  });
  const snapshotLines = [
    "Core and Electives (40 credits)",
    "Computer Engineering Systems Electives list",
    "on the CSE website",
    "Mathematics & Natural Sciences (41 credits)",
    "MATH 124, 125, 126 or 134, 135, 136 (15) 1 course from the CSE Capstone list (5)",
  ];
  const groups = parser.buildParsedRequirementGroupsForTest(
    owner,
    ["MATH 124", "MATH 125", "MATH 126", "MATH 134", "MATH 135", "MATH 136"],
    snapshotLines
  );
  const sequenceGroup = groups.find((group) => group.requirementType === "sequence_choice");

  assert.ok(
    sequenceGroup,
    "Expected same-subject bare-number alternatives to parse as a sequence choice."
  );
  assert.deepEqual(
    (sequenceGroup.sequencePaths ?? []).map((path) => path.uwCourses),
    [
      ["MATH 124", "MATH 125", "MATH 126"],
      ["MATH 134", "MATH 135", "MATH 136"],
    ]
  );
});

test("Requirement parser keeps trailing if-taken prerequisites out of option groups", () => {
  const owner = buildRecoveryOwnerFixture({
    ownerId: "uw-seattle-computer-engineering",
    ownerTitle: "Computer Engineering",
    planId: "uw-seattle-computer-engineering",
    campusId: "uw-seattle",
  });
  const snapshotLines = [
    "Mathematics & Natural Sciences (41 credits)",
    "PHYS 122 Electromagnetism (or PHYS 142) (5) 121 or CSE 122 if taken).",
  ];
  const groups = parser.buildParsedRequirementGroupsForTest(
    owner,
    ["PHYS 122", "PHYS 142", "CSE 122"],
    snapshotLines
  );
  const physicsAliasGroup = groups.find((group) =>
    (group.options ?? []).some((option) => (option.uwCourses ?? []).includes("PHYS 122"))
  );
  const leakedCseOption = groups.some((group) =>
    (group.options ?? []).some((option) => (option.uwCourses ?? []).includes("CSE 122"))
  );

  assert.ok(physicsAliasGroup, "Expected the PHYS 122 / PHYS 142 alias group.");
  assert.equal(physicsAliasGroup.requirementType, "all_required");
  assert.equal(physicsAliasGroup.category, "course-alias");
  assert.equal(leakedCseOption, false);
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
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("CSS 142 + CSSKL 142: Computer Programming I + Skills Lab"),
    ["CSS 142", "CSSSKL 142"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("BWRIT 134 and 135"),
    ["BWRIT 134", "BWRIT 135"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest(
      "Must cover content equivalent to UW Bothell's BWRIT 134 and 135 (or similar)."
    ),
    ["BWRIT 134", "BWRIT 135"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("STMATH 124 and STMATH 125"),
    ["STMATH 124", "STMATH 125"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest(
      "CSS 123 + CSSKL 123, CSS 132 + CSSKL 132, or CSS 142 + CSSKL 142"
    ),
    ["CSS 123", "CSS 132", "CSS 142", "CSSSKL 123", "CSSSKL 132", "CSSSKL 142"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest(
      "CSS 123 + CSSKL 123: Programming for Data Science + Skills Lab (Note: CSS 112 can be used as the prerequisite for CSS 123)"
    ),
    ["CSS 112", "CSS 123", "CSSSKL 123"]
  );
  assert.deepEqual(
    parser.extractCourseCodesFromLineForTest("BBUS 451, 452, 453, 454"),
    ["BBUS 451", "BBUS 452", "BBUS 453", "BBUS 454"]
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

test("Generic primary degree HTML keeps direct concentration course rows", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-seattle-american-indian-studies",
    ownerTitle: "American Indian Studies",
    planId: "uw-seattle-american-indian-studies",
    campusId: "uw-seattle",
    parserType: "generic-html",
    label: "UW B.A. in American Indian Studies",
    sourceLabel: "UW B.A. in American Indian Studies",
    url: "https://ais.washington.edu/ba-american-indian-studies",
  });
  const html = `
    <h1>B.A. in American Indian Studies</h1>
    <h2>Degree Requirements</h2>
    <p>In order to graduate with the Bachelor of Arts in American Indian Studies, students must complete 55 credits as follows:</p>
    <h3>1. Introductory courses</h3>
    <p>10 credits/both courses:</p>
    <p>AIS 102 Introduction to American Indian Studies</p>
    <p>AIS 103 The Indigenous Pacific Northwest</p>
    <h3>2. Content courses</h3>
    <p>10 credits, two courses selected from:</p>
    <p>AIS 170 American Indian Art and Aesthetics</p>
    <p>AIS 202 Introduction to American Indian Contemporary and Social Issues</p>
    <h3>3. Concentrations</h3>
    <p>25 credits total, 5 credits minimum chosen from each concentration, additional courses available as listed in time schedule and with special approval by academic advisor:</p>
    <h4>Governance Concentration Courses:</h4>
    <p>AIS 212 Indigenous Leaders and Activists</p>
    <p>AIS 230 Contemporary Indian Gaming and Casinos</p>
    <p>AIS 492 Indigenous Sovereignties</p>
    <h4>Environment and Health Concentration Courses:</h4>
    <p>AIS 306 Contemporary Indigenous Environmental Issues</p>
    <p>AIS 307 Indigenous Literature and the Environment</p>
    <p>AIS 451 Critical Conversations in AIS</p>
  `;
  const owner = buildParsedBlockFixture(entry, html, [
    "AIS 102",
    "AIS 103",
    "AIS 170",
    "AIS 202",
    "AIS 212",
    "AIS 230",
    "AIS 306",
    "AIS 307",
    "AIS 451",
    "AIS 492",
  ]);
  const governance = owner.parsedRequirementGroups.find(
    (group) => group.label === "Governance Concentration Courses"
  );
  const environment = owner.parsedRequirementGroups.find(
    (group) => group.label === "Environment and Health Concentration Courses"
  );

  assert.ok(owner.parsedUwCourseCodes.includes("AIS 212"));
  assert.ok(owner.parsedUwCourseCodes.includes("AIS 451"));
  assert.deepEqual(governance?.options.flatMap((option) => option.uwCourses), [
    "AIS 212",
    "AIS 230",
    "AIS 492",
  ]);
  assert.deepEqual(environment?.options.flatMap((option) => option.uwCourses), [
    "AIS 306",
    "AIS 307",
    "AIS 451",
  ]);
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
    <div class="expandableGroup" data-expand="program-UG-TCIV-MAJOR">
      <h3 id="program-UG-TCIV-MAJOR">Program of Study: Major: Civil Engineering</h3>
    </div>
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
    <div class="expandableGroup" data-expand="program-UG-TCENGR-MAJOR">
      <h3 id="program-UG-TCENGR-MAJOR">Program of Study: Major: Computer Engineering</h3>
    </div>
    <p>Admission Requirements</p>
    <p>TMATH 124, TMATH 125, and TMATH 126</p>
    <p>TMATH 207</p>
    <h4 id="credential-TCENGR-BS">Bachelor of Science degree with a major in Computer Engineering</h4>
    <p>Completion Requirements</p>
    <p>Required Core Courses: 101 credits</p>
    <p>TCSS 342 (5)</p>
    <p>TCES 230 (5)</p>
    <p>TEE 451 (5)</p>
    <p>Back to Top</p>
    <div class="expandableGroup" data-expand="program-UG-TEE-MAJOR">
      <h3 id="program-UG-TEE-MAJOR">Program of Study: Major: Electrical Engineering</h3>
    </div>
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

  const snapshotText = parsed.snapshotLines.join(" \n");
  const programIndex = snapshotText.indexOf("Program of Study: Major: Computer Engineering");
  const completionIndex = snapshotText.indexOf("Completion Requirements");

  assert.ok(programIndex >= 0);
  assert.ok(completionIndex > programIndex);
  assert.match(snapshotText, /Admission Requirements/);
  assert.match(snapshotText, /TMATH 124/);
  assert.ok(parsed.courseCodes.includes("TMATH 207"));
  assert.ok(parsed.courseCodes.includes("TCSS 342"));
  assert.ok(parsed.courseCodes.includes("TCES 230"));
  assert.ok(parsed.courseCodes.includes("TEE 451"));
  assert.ok(!parsed.courseCodes.includes("TCE 304"));
  assert.ok(!parsed.courseCodes.includes("TEE 225"));
  assert.equal(
    parsed.sourceSectionAudit?.sectionHeading,
    "Program of Study: Major: Computer Engineering"
  );
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
    <nav>
      <a href="/academic-programs/undergraduate/bs-bioe-nme-nano-molecular-engineering/">BS Bioengineering with Option in Nano & Molecular Engineering (NME)</a>
      <a href="/academic-programs/undergraduate/bs-bioengineering-with-option-in-data-science/">BS Bioengineering with Option in Data Science</a>
    </nav>
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
  assert.ok(parsed.courseCodes.includes("CHEM 142"));
  assert.ok(parsed.requirementCueLines.includes("Natural Science (44 credits)"));
  assert.ok(parsed.courseCodes.includes("BIOEN 315"));
  assert.ok(parsed.courseCodes.includes("BIOEN 345"));
  assert.ok(parsed.courseCodes.includes("BIOEN 400"));
  assert.ok(parsed.courseCodes.includes("BIOEN 424"));
  assert.ok(parsed.courseCodes.includes("BIOEN 405"));
});

test("Parser skips category total placeholders when nearby rows already declare specific courses", () => {
  const owner = buildParsedBlockFixture(
    buildRecoveryEntryFixture({
      ownerId: "uw-seattle-bioengineering",
      ownerTitle: "Bioengineering",
      planId: "uw-seattle-bioengineering",
      campusId: "uw-seattle",
      parserType: "html-degree-page",
      url: "https://bioe.uw.edu/academic-programs/undergraduate/undergraduate-degree-requirements/",
      label: "UW Bioengineering undergraduate degree requirements",
    }),
    `
      <main>
        <h1>Undergraduate Degree Requirements</h1>
        <h4>Natural Science (44 credits)</h4>
        <p>Course</p>
        <p>Topic</p>
        <p>Credits</p>
        <p>CHEM 142, 152, 162</p>
        <p>General Chemistry</p>
        <p>15</p>
        <p>CHEM 223 or 237</p>
        <p>Organic Chemistry</p>
        <p>4</p>
        <p>PHYS 121</p>
        <p>Mechanics, with Lab</p>
        <p>5</p>
        <p>PHYS 122</p>
        <p>Electromagnetism and Oscillatory Motion, with Lab</p>
        <p>5</p>
        <p>BIOL 180, 200, 220</p>
        <p>Introductory Biology</p>
        <p>15</p>
      </main>
    `
  );

  assert.ok(owner.parsedUwCourseCodes.includes("CHEM 142"));
  assert.ok(owner.parsedUwCourseCodes.includes("BIOL 220"));
  assert.equal(
    owner.parsedRequirementGroups.some(
      (group) =>
        group.detectedOptionCue === "credit bucket" &&
        /Natural Science \(44 credits\)/i.test(group.sourceRowText ?? "")
    ),
    false
  );
});

test("Parser skips aggregate gen-ed summaries when specific category minimums follow", () => {
  const owner = buildParsedBlockFixture(
    buildRecoveryEntryFixture({
      ownerId: "uw-seattle-chemical-engineering",
      ownerTitle: "Chemical Engineering",
      planId: "uw-seattle-chemical-engineering",
      campusId: "uw-seattle",
      parserType: "html-degree-page",
      url: "https://www.cheme.washington.edu/undergraduate_students/curriculum",
      label: "UW Chemical Engineering curriculum",
    }),
    `
      <main>
        <h2>General education requirements</h2>
        <p>ChemE undergraduate students complete 94 credits of general education requirements, which includes 5 credits of written and oral communication, 24 credits in Arts and Humanities and Social Sciences, and 65 credits of natural world courses.</p>
        <h3>Arts and Humanities and Social Sciences (24 credits)</h3>
        <p>Of the 24 credits, minimum 10 credits in Arts and Humanities (A&H)</p>
        <p>Of the 24 credits, minimum 10 credits in Social Sciences (Ssc)</p>
        <p>At least 5 credits must be in Diversity (DIV).</p>
        <h3>Natural World (65 credits)</h3>
        <p>Mathematics (24 credits):</p>
        <p>MATH 124 (5): Calculus with Analytic Geometry I</p>
        <p>MATH 125 (5): Calculus with Analytic Geometry II</p>
        <p>Chemistry (26 credits):</p>
        <p>CHEM 142 (5): General Chemistry, with lab</p>
      </main>
    `
  );
  const labels = owner.parsedRequirementGroups.map((group) => group.label);

  assert.ok(owner.parsedUwCourseCodes.includes("MATH 124"));
  assert.ok(owner.parsedUwCourseCodes.includes("CHEM 142"));
  assert.equal(labels.some((label) => /94 credits/i.test(label)), false);
  assert.equal(labels.some((label) => /24 credits of Arts and Humanities/i.test(label)), false);
  assert.equal(labels.some((label) => /24 credits of Social Sciences/i.test(label)), false);
  assert.equal(labels.some((label) => /10 credits of Arts and Humanities/i.test(label)), true);
  assert.equal(labels.some((label) => /10 credits of Social Sciences/i.test(label)), true);
});

test("Parser does not turn Disability Studies subfield names into generic DIV placeholders", () => {
  const owner = buildParsedBlockFixture(
    buildRecoveryEntryFixture({
      ownerId: "uw-seattle-disability-studies",
      ownerTitle: "Disability Studies",
      planId: "uw-seattle-disability-studies",
      campusId: "uw-seattle",
      parserType: "html-degree-page",
      url: "https://disabilitystudies.washington.edu/DS_major",
      label: "Disability Studies Major",
    }),
    `
      <main>
        <h2>Degree Requirements</h2>
        <p>Completed DIS ST/LSJ/CHID 230: Introduction to Disability Studies with a minimum grade of 2.0</p>
        <h3>Diversity, Representation, & Identity (5 credits)</h3>
        <p>DIS ST 335 / GWSS 335 / CHID 335 Sex, Gender, and Disability</p>
        <p>DIS ST 337 / SOC 337 Social Construction of Madness and Mental Health in the US</p>
        <h3>Thesis Project</h3>
        <p>Thesis Project undertaken as either INDIV 493: Senior Study (5 credits) or DIS ST 499: Independent Study (5-15 credits)</p>
      </main>
    `
  );
  const labels = owner.parsedRequirementGroups.map((group) => group.label);
  const categoryOptions = owner.parsedRequirementGroups.flatMap((group) => group.options ?? []);

  assert.ok(owner.parsedUwCourseCodes.includes("DISST 335"));
  assert.equal(labels.some((label) => /5 credits of Diversity/i.test(label)), false);
  assert.equal(
    categoryOptions.some((option) => option.optionKind === "category-option" && option.categoryOption?.category === "DIV"),
    false
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

test("Inactive major pages are non-schedulable instead of zero-course parser failures", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-seattle-italian",
    ownerTitle: "Italian",
    planId: "uw-seattle-italian",
    campusId: "uw-seattle",
    role: "degree-requirements",
    url: "https://frenchitalian.washington.edu/undergraduate-studies-italian",
    label: "UW Italian undergraduate studies and major requirements status",
  });
  const block = buildParsedBlockFixture(
    entry,
    `
      <h1>Major in Italian Studies</h1>
      <p>Please note at this time we are not able to offer the upper level courses for the Italian Studies major.</p>
      <p>Therefore we are not able to accept new students into the Italian Studies major and students may not declare the Italian Studies major.</p>
    `
  );
  const signals = parser.buildParseQualitySignalsForTest(block);

  assert.equal(block.sourceRole, "non-schedulable-course-list");
  assert.equal(block.sourceRoleStatus, "non-schedulable");
  assert.equal(block.canCreateSchedulableRows, false);
  assert.equal(signals.some((signal) => signal.code === "no-parsed-uw-course-codes"), false);
});

test("Plan overview rows covered by child option sources are not actionable no-course parses", () => {
  const planOwner = buildRecoveryOwnerFixture({
    ownerId: "uw-tacoma-example",
    ownerTitle: "Example Studies",
    planId: "uw-tacoma-example",
    campusId: "uw-tacoma",
    parserType: "html-overview-page",
    primaryParserType: "html-overview-page",
    sourceLabel: "Example Studies overview",
    sourceRole: "primary-degree-requirements",
    sourceRoleStatus: "primary",
    pathwayLabels: ["Focused Option"],
    qualitySignals: [
      {
        severity: "warning",
        code: "no-parsed-uw-course-codes",
        message: "The official source parsed successfully but did not yield usable UW course codes.",
      },
    ],
  });
  const childOwner = buildRecoveryOwnerFixture({
    ownerId: "uw-tacoma-example:pathway:focused-option",
    ownerTitle: "Example Studies - Focused Option",
    planId: "uw-tacoma-example",
    pathwayId: "focused-option",
    campusId: "uw-tacoma",
    parsedUwCourseCodes: ["TEXAM 301"],
    parseConfidence: "high",
    qualitySignals: [],
  });

  const report = parser.buildParseReport([planOwner, childOwner]);
  const reportedPlanOwner = report.owners.find((owner) => owner.ownerId === planOwner.ownerId);

  assert.equal(report.withNoParsedCourseCodesCount, 0);
  assert.equal(
    reportedPlanOwner.qualitySignals.some((signal) => signal.code === "no-parsed-uw-course-codes"),
    false
  );
});

test("Plan family coverage suppresses cross-owner structured-only parser warnings", () => {
  const planOwner = buildRecoveryOwnerFixture({
    ownerId: "uw-bothell-example",
    ownerTitle: "Example Studies",
    planId: "uw-bothell-example",
    campusId: "uw-bothell",
    parsedUwCourseCodes: ["BEXAM 101"],
    structuredOnlyUwCourseCodes: ["BEXAM 301"],
    qualitySignals: [
      {
        severity: "warning",
        code: "large-structured-only-course-gap",
        message: "Structured degree-map coverage includes many UW course codes that were not recovered from the parsed source.",
      },
      {
        severity: "warning",
        code: "material-source-structured-drift",
        message: "Parsed source course coverage diverges materially from the structured degree-map coverage.",
      },
    ],
  });
  const childOwner = buildRecoveryOwnerFixture({
    ownerId: "uw-bothell-example:pathway:focused-option",
    ownerTitle: "Example Studies - Focused Option",
    planId: "uw-bothell-example",
    pathwayId: "focused-option",
    campusId: "uw-bothell",
    parsedUwCourseCodes: ["BEXAM 301"],
    qualitySignals: [],
  });

  const report = parser.buildParseReport([planOwner, childOwner]);
  const reportedPlanOwner = report.owners.find((owner) => owner.ownerId === planOwner.ownerId);

  assert.deepEqual(
    reportedPlanOwner.qualitySignals.map((signal) => signal.code),
    []
  );
  assert.equal(report.ownersWithQualityWarningsCount, 0);
});

test("Structured-only warnings ignore explicitly excluded or advising-only course mentions", () => {
  const owner = buildRecoveryOwnerFixture({
    ownerId: "uw-seattle-mathematics",
    ownerTitle: "Mathematics",
    planId: "uw-seattle-mathematics",
    campusId: "uw-seattle",
    parsedUwCourseCodes: ["MATH 124", "MATH 300", "MATH 402", "MATH 403"],
    sourceOnlyUwCourseCodes: [],
    structuredOnlyUwCourseCodes: [
      "MATH 334",
      "MATH 335",
      "MATH 382",
      "MATH 397",
      "MATH 398",
      "MATH 399",
      "MATH 497",
      "MATH 498",
      "MATH 499",
    ],
    requirementCueLines: [
      "This information is for major planning only. Meet with a Math adviser if completing MATH 334/335/336.",
      "Major Option Electives exclude MATH 300, 382, 397, 398, 399, 497, 498, 499, CR/NC, independent study, research, seminars, internships; can apply credits from one of the following Algebra sequences: MATH 411/412 OR MATH 402/403.",
    ],
    parseConfidence: "high",
  });

  const signals = parser.buildParseQualitySignalsForTest(owner);
  const signalCodes = signals.map((signal) => signal.code);

  assert.equal(signalCodes.includes("material-source-structured-drift"), false);
  assert.equal(signalCodes.includes("large-structured-only-course-gap"), false);
  assert.equal(signalCodes.includes("high-confidence-low-course-coverage"), false);
});

test("Structured-only warnings ignore suggested preparation course mentions", () => {
  const owner = buildRecoveryOwnerFixture({
    ownerId: "uw-seattle-speech-and-hearing-sciences",
    ownerTitle: "Speech and Hearing Sciences",
    planId: "uw-seattle-speech-and-hearing-sciences",
    campusId: "uw-seattle",
    parsedUwCourseCodes: ["SPHSC 250", "SPHSC 261", "SPHSC 302"],
    sourceOnlyUwCourseCodes: [],
    structuredOnlyUwCourseCodes: [
      "BIOL 118",
      "BIOL 180",
      "CHEM 110",
      "CHEM 220",
      "EDPSY 490",
      "LING 200",
      "LING 400",
      "PHYS 107",
      "PHYS 110",
      "STAT 220",
    ],
    requirementCueLines: [
      "Suggested First and Second-Year College Courses: Biological science: BIOL 118 or BIOL 180. Physics or chemistry: PHYS 107, PHYS 110, or CHEM 110, CHEM 220. Statistics: STAT 220 or EDPSY 490. Linguistics: LING 200 or LING 400.",
    ],
    parseConfidence: "high",
  });

  const signals = parser.buildParseQualitySignalsForTest(owner);
  const signalCodes = signals.map((signal) => signal.code);

  assert.equal(signalCodes.includes("material-source-structured-drift"), false);
  assert.equal(signalCodes.includes("large-structured-only-course-gap"), false);
  assert.equal(signalCodes.includes("high-confidence-low-course-coverage"), false);
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

test("Parser stops Chemistry sequence groups at adjacent chemistry section headings", () => {
  const owner = buildParsedBlockFixture(
    buildRecoveryEntryFixture({
      id: "uw-seattle-chemistry:primary",
      ownerId: "uw-seattle-chemistry",
      ownerTitle: "Chemistry",
      planId: "uw-seattle-chemistry",
      campusId: "uw-seattle",
      parserType: "html-degree-page",
      url: "https://chem.washington.edu/ba-chemistry",
      label: "UW BA in Chemistry requirements",
      sourceLabel: "UW BA in Chemistry requirements",
    }),
    `
      <main>
        <h2>Degree Requirements</h2>
        <h3>Physics (choose one sequence)</h3>
        <p>Calculus-based: PHYS 121 (5), 122 (5), 123 (5)</p>
        <p>Algebra-based: PHYS 114 (4), 115 (4), 116 (4)</p>
        <p>The calculus-based series is recommended. NOTE: One credit lab is included with each course in the calculus-based physics series. If algebra-based physics is taken, students must take one lab from below:</p>
        <p>One quarter of physics laboratory: PHYS 117, 118, 119 (1)</p>
        <h3>Organic Chemistry (choose one sequence)</h3>
        <p>Regular: CHEM 237 (4), 238 (4), 239 (4)</p>
        <p>Laboratory: CHEM 241 (3), 242 (3)</p>
        <p>Honors: CHEM 335 (4), 336 (4), 337 (4)</p>
        <p>Laboratory: CHEM 346 (3), 347 (3)</p>
        <h3>Inorganic Chemistry (choose one)</h3>
        <p>CHEM 312 Lecture (3)</p>
        <p>CHEM 416 Transition Metals Lecture (3)</p>
        <h3>Analytical Lab</h3>
        <p>CHEM 321 (5) Quantitative Analysis</p>
      </main>
    `
  );
  const labelsAndHeadings = owner.parsedRequirementGroups.map((group) =>
    `${group.label} ${group.sourceHeading ?? ""}`
  );
  const organic = owner.parsedRequirementGroups.find(
    (group) => group.label === "Organic Chemistry" && group.requirementType === "sequence_choice"
  );
  const organicCodes = (organic?.options ?? []).flatMap((option) => option.uwCourses ?? []);

  assert.ok(organic, "Expected Organic Chemistry sequence choice to parse.");
  assert.equal(organicCodes.includes("CHEM 312"), false);
  assert.equal(organicCodes.includes("CHEM 416"), false);
  assert.equal(
    labelsAndHeadings.some((text) => /calculus-based series is recommended/i.test(text)),
    false
  );
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

test("Parser recovery does not use specific option pages for an unscoped base major", () => {
  const entry = buildRecoveryEntryFixture({
    url:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum",
    label: "UW Bothell BBA curriculum hub",
    sourceLabel: "UW Bothell BBA curriculum hub",
    parserType: "html-curriculum-page",
  });
  const html = `
    <main>
      <a href="/business/undergraduate/bachelor-of-business-administration/degree-requirements">
        Business Administration degree requirements
      </a>
      <a href="/business/undergraduate/bachelor-of-business-administration/supply-chain">
        Supply Chain Management Option
      </a>
      <a href="/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses">
        BBA prerequisite courses
      </a>
    </main>
  `;
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(entry, html);

  assert.equal(
    parser.parserRecoveryCandidateConflictsWithPathwayForTest(
      entry,
      "Cached source: Supply Chain Management Option - School of Business",
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/supply-chain"
    ),
    true
  );
  assert.equal(
    parser.parserRecoveryCandidateConflictsWithPathwayForTest(
      entry,
      "Cached source: Curriculum - School of Business",
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum#marketing"
    ),
    true
  );
  assert.equal(candidates.some((candidate) => /\/supply-chain$/.test(candidate.url)), false);
  assert.ok(candidates.some((candidate) => /\/degree-requirements$/.test(candidate.url)));
  assert.ok(candidates.some((candidate) => /\/admissions\/prerequisite-courses$/.test(candidate.url)));
});

test("Parser recovery rejects merged cached pathway snapshots for an unscoped base major", () => {
  const entry = buildRecoveryEntryFixture({
    url:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum",
    label: "UW Bothell BBA curriculum hub",
    sourceLabel: "UW Bothell BBA curriculum hub",
    parserType: "html-curriculum-page",
  });

  assert.equal(
    parser.parserRecoverySnapshotConflictsWithBaseOwnerScopeForTest(entry, [
      "[Supplemental official source] Finance Option and Concentration",
      "BBUS 455 - Financial Risk Management",
      "[Supplemental official source] Marketing Option and Concentration",
      "BBUS 421 - Consumer Marketing",
    ]),
    true
  );
  assert.equal(
    parser.parserRecoverySnapshotConflictsWithBaseOwnerScopeForTest(
      { ...entry, pathwayId: "marketing-option-and-concentration" },
      [
        "[Supplemental official source] Marketing Option and Concentration",
        "BBUS 421 - Consumer Marketing",
      ]
    ),
    false
  );
});

test("Parser recovery reclassifies alternate section-scoped support URLs by their own source role", () => {
  const entry = buildRecoveryEntryFixture({
    role: "curriculum",
    url:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum",
    label: "UW Bothell BBA curriculum hub",
    sourceLabel: "UW Bothell BBA curriculum hub",
    parserType: "html-curriculum-page",
  });
  const supportCandidateEntry = parser.buildParserRecoveryCandidateEntryForTest(entry, {
    strategy: "section-scoping-recovery",
    url:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
    label: "Scoped section: BBA prerequisite courses",
    parserType: "html-admissions-page",
  });
  const sameUrlCandidateEntry = parser.buildParserRecoveryCandidateEntryForTest(entry, {
    strategy: "section-scoping-recovery",
    url: entry.url,
    label: "Scoped current requirements: Curriculum",
    parserType: "html-curriculum-page",
  });

  assert.equal(supportCandidateEntry.role, undefined);
  assert.equal(
    parser.classifyRequirementSourceRole(supportCandidateEntry),
    "admission-prerequisite-source"
  );
  assert.equal(sameUrlCandidateEntry.role, "curriculum");
  assert.equal(parser.classifyRequirementSourceRole(sameUrlCandidateEntry), "primary-degree-requirements");
});

test("Parser recovery rejects cached support snapshots from sibling degree routes", () => {
  const entry = buildRecoveryEntryFixture({
    url:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum",
    label: "UW Bothell BBA curriculum hub",
    sourceLabel: "UW Bothell BBA curriculum hub",
    parserType: "html-curriculum-page",
  });

  assert.equal(
    parser.parserRecoveryCandidateConflictsWithProgramSiblingForTest(
      entry,
      "Prerequisites - School of Business",
      "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/prerequisites"
    ),
    true
  );
  assert.equal(
    parser.parserRecoveryCandidateConflictsWithProgramSiblingForTest(
      entry,
      "BBA prerequisite courses",
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses"
    ),
    false
  );
});

test("Requirement parser includes admissions support pages in parseable sources", () => {
  const entries = parser.getParseablePrimaryEntries(["uw-bothell-business-administration"]);

  assert.ok(
    entries.some(
      (entry) =>
        /\/admissions\/prerequisite-courses$/.test(entry.url) &&
        parser.getRequirementSourceRoleStatus(parser.classifyRequirementSourceRole(entry)) === "support"
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

test("Parser recovery rejects sibling pathway pages without option cue words", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-bothell-business-administration-accounting:pathway:accounting-option",
    ownerTitle: "Business Administration: Accounting (BA) - Accounting Option",
    sourceLabel: "Accounting Option major requirements",
    planId: "uw-bothell-business-administration-accounting",
    pathwayId: "accounting-option",
    url:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/accounting",
    label: "Accounting Option major requirements",
  });
  const html = `
    <main>
      <a href="/business/undergraduate/bachelor-of-business-administration/supply-chain">
        Supply Chain Management curriculum
      </a>
      <a href="/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses">
        BBA prerequisite courses
      </a>
    </main>
  `;
  const candidates = parser.extractParserRecoveryLinkCandidatesForTest(entry, html);

  assert.equal(
    parser.parserRecoveryCandidateConflictsWithPathwayForTest(
      entry,
      "Cached source: Supply Chain Management Option - School of Business",
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/supply-chain"
    ),
    true
  );
  assert.equal(candidates.some((candidate) => /\/supply-chain$/.test(candidate.url)), false);
  assert.ok(candidates.some((candidate) => /\/admissions\/prerequisite-courses$/.test(candidate.url)));
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

test("Parser manifest selection rejects mismatched Tacoma CSS route sources", () => {
  const entries = parser.getParseablePrimaryEntries([
    "uw-tacoma-computer-science-and-systems",
  ]);
  const entrySummaries = entries.map((entry) => ({
    ownerId: entry.ownerId,
    url: entry.url,
    label: entry.label,
  }));

  assert.equal(
    entries.some((entry) => String(entry.url ?? "").includes("/undergrad/cengr")),
    false,
    JSON.stringify(entrySummaries, null, 2)
  );
  assert.equal(
    entries.some(
      (entry) =>
        entry.ownerId ===
          "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-science" &&
        String(entry.url ?? "").includes("/undergrad/css/ba")
    ),
    false,
    JSON.stringify(entrySummaries, null, 2)
  );
  assert.ok(
    entries.some(
      (entry) =>
        entry.ownerId ===
          "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-science" &&
        String(entry.url ?? "").includes("/undergrad/css/bs")
    ),
    JSON.stringify(entrySummaries, null, 2)
  );
  assert.ok(
    entries.some(
      (entry) =>
        entry.ownerId ===
          "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-arts" &&
        (String(entry.url ?? "").includes("/undergrad/css/ba") ||
          /CSS_B\.A\._Grid/i.test(String(entry.url ?? "")))
    ),
    JSON.stringify(entrySummaries, null, 2)
  );
});

test("Parser alternate fallback rejects mismatched Tacoma CSS route sources", () => {
  const entries = parser.getParseablePrimaryEntries([
    "uw-tacoma-computer-science-and-systems",
  ]);
  const bsPathwayEntry = entries.find(
    (entry) =>
      entry.ownerId ===
        "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-science" &&
      String(entry.url ?? "").includes("/undergrad/css")
  );

  assert.ok(bsPathwayEntry, JSON.stringify(entries, null, 2));

  const alternates = parser.getAlternateParseableManifestEntriesForTest(bsPathwayEntry);
  const alternateSummaries = alternates.map((entry) => ({
    ownerId: entry.ownerId,
    url: entry.url,
    label: entry.label,
  }));

  assert.equal(
    alternates.some((entry) => String(entry.url ?? "").includes("/undergrad/css/ba")),
    false,
    JSON.stringify(alternateSummaries, null, 2)
  );
});

test("Parser recovery rejects cached Tacoma CSS snapshots from other majors or routes", () => {
  assert.equal(
    parser.parserRecoveryCandidateConflictsWithPathwayForTest(
      {
        ownerId: "uw-tacoma-computer-science-and-systems",
        ownerTitle: "Computer Science and Systems",
        planId: "uw-tacoma-computer-science-and-systems",
        pathwayId: null,
      },
      "B.S. in Computer Engineering",
      "https://www.tacoma.uw.edu/set/programs/undergrad/cengr"
    ),
    true
  );
  assert.equal(
    parser.parserRecoveryCandidateConflictsWithPathwayForTest(
      {
        ownerId: "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-science",
        ownerTitle: "Computer Science and Systems - Bachelor of Science",
        planId: "uw-tacoma-computer-science-and-systems",
        pathwayId: "bachelor-of-science",
      },
      "UW Tacoma Computer Science and Systems BA degree requirements",
      "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba"
    ),
    true
  );
  assert.equal(
    parser.parserRecoveryCandidateConflictsWithPathwayForTest(
      {
        ownerId: "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-arts",
        ownerTitle: "Computer Science and Systems - Bachelor of Arts",
        planId: "uw-tacoma-computer-science-and-systems",
        pathwayId: "bachelor-of-arts",
      },
      "UW Tacoma Computer Science and Systems BA degree requirements",
      "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba"
    ),
    false
  );
});

test("Parser recovery ignores stale cached Tacoma CSS snapshots removed from the manifest", () => {
  const bsPathwayEntry = {
    ownerId: "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-science",
    ownerTitle: "Computer Science and Systems - Bachelor of Science",
    planId: "uw-tacoma-computer-science-and-systems",
    pathwayId: "bachelor-of-science",
    campusId: "uw-tacoma",
    parserType: "html-degree-requirements",
    url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
    label: "UW Tacoma Computer Science and Systems BS degree requirements",
  };

  assert.equal(
    parser.parserRecoverySnapshotIsActiveForOwnerForTest(bsPathwayEntry, {
      sourceUrl: "https://www.tacoma.uw.edu/uwt/sites/default/files/2021-07/css_bs_grid.pdf",
    }),
    false
  );
  assert.equal(
    parser.parserRecoverySnapshotIsActiveForOwnerForTest(bsPathwayEntry, {
      sourceUrl: "https://www.tacoma.uw.edu/sites/default/files/2024-10/css_b.s-grid_2023.pdf",
    }),
    true
  );
});

test("Linked document recovery ignores stale Tacoma CSS grids when a current manifest grid exists", () => {
  const bsPathwayEntry = {
    ownerId: "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-science",
    ownerTitle: "Computer Science and Systems - Bachelor of Science",
    planId: "uw-tacoma-computer-science-and-systems",
    pathwayId: "bachelor-of-science",
    campusId: "uw-tacoma",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
    label: "UW Tacoma Computer Science and Systems BS degree requirements",
  };
  const html = `
    <a href="/uwt/sites/default/files/2021-07/css_bs_grid.pdf">B.S. CSS Schedule Planning Grid</a>
    <a href="/sites/default/files/2024-10/css_b.s-grid_2023.pdf">UW Tacoma Computer Science and Systems BS planning grid</a>
  `;

  const candidates = parser.extractSupplementalDocumentLinkCandidatesForTest(
    bsPathwayEntry,
    html
  );
  const candidateUrls = candidates.map((candidate) => candidate.url);

  assert.equal(
    candidateUrls.includes(
      "https://www.tacoma.uw.edu/uwt/sites/default/files/2021-07/css_bs_grid.pdf"
    ),
    false,
    JSON.stringify(candidateUrls, null, 2)
  );
  assert.equal(
    candidateUrls.includes(
      "https://www.tacoma.uw.edu/sites/default/files/2024-10/css_b.s-grid_2023.pdf"
    ),
    true,
    JSON.stringify(candidateUrls, null, 2)
  );
});

test("Linked document recovery backfills title-only calculus prerequisites without optional prep rows", () => {
  const recoveredSources = parser.buildTitleOnlyCourseBackfillSupplementalSourcesForTest(
    {
      courseCodes: ["TCSS 142", "TCSS 143"],
      requirementCueLines: [],
      snapshotLines: [
        "Prerequisites",
        "Calculus 1",
        "Calculus 2",
        "Introduction to Programming (TCSS 142 or equivalent)",
      ],
    },
    [
      {
        candidate: {
          url: "https://www.tacoma.uw.edu/sites/default/files/2024-10/css_b.s-grid_2023.pdf",
          label: "Download the bscss planning grid",
          parserType: "pdf-degree-sheet",
          titleAcronymMatch: true,
          historical: false,
        },
        parsed: {
          courseCodes: ["TMATH 115", "TMATH 124", "TMATH 125", "TMATH 126", "TCSS 390"],
          requirementCueLines: [],
          snapshotLines: [
            "[Page 1] Calculus I Lab Science Intro to Programming+LAB Calculus II Lab Science Calculus III",
            "[Page 1] TMATH 124 TCSS 142 TMATH 125 TCSS 143 TMATH 126",
            "[Page 1] TMATH 115 Pre-Calculus I (if not taking 120) Winter 5",
            "[Page 1] TCSS 390 TCSS 321 Seminar (Optional) Fall 2",
          ],
          resolvedParserType: "pdf-degree-sheet",
        },
      },
    ]
  );

  const recoveredCourseCodes = recoveredSources.flatMap(
    (source) => source.parsed.courseCodes
  );
  assert.deepEqual(recoveredCourseCodes, ["TMATH 124", "TMATH 125"]);
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

test("Parser keeps Tacoma list sections inside dedicated track pages", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-arts-media-culture:pathway:film-and-media-track",
    ownerTitle: "Arts, Media and Culture (BA) - Film and Media Track",
    planId: "uw-tacoma-arts-media-culture",
    pathwayId: "film-and-media-track",
    campusId: "uw-tacoma",
    ownerType: "pathway",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/sias/cac/film-and-media-track",
    label: "Film and Media Track",
    sourceLabel: "Film and Media Track",
  });
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(
    entry,
    `
      <main>
        <h1>Film and Media Track</h1>
        <p>Foundation (5 credits)</p>
        <p>TLIT 220 Literature and the Arts OR</p>
        <p>TFILM 220 Film and the Arts</p>
        <h2>List A History</h2>
        <p>THIST 150 World History I</p>
        <h2>LIST B: CULTURE</h2>
        <p>TAMST 101 American Art, Place and Space</p>
        <h2>LIST F: FILM AND MEDIA</h2>
        <p>TCOM 201 Media and Society</p>
        <p>TFILM 350 Screenwriting</p>
        <h2>Contact</h2>
      </main>
    `
  );

  for (const courseCode of ["TLIT 220", "TFILM 220", "THIST 150", "TAMST 101", "TCOM 201", "TFILM 350"]) {
    assert.ok(parsed.courseCodes.includes(courseCode), `Expected ${courseCode} from Tacoma list sections`);
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

test("Pathway supplemental HTML recovery rejects sibling major pages", () => {
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
  const baseParsed = {
    courseCodes: ["SLAVIC 101"],
    requirementCueLines: ["Major Requirements"],
    snapshotLines: [
      "B.A. in Eastern European Languages, Literature, and Culture",
      "Major Requirements",
      "SLAVIC 101, SLAVIC 320, SLAVIC 370, and SLAVIC 425",
    ],
  };
  const globalLiteraryStudiesSupplement = {
    candidate: {
      sameProgramRequirementLink: true,
      label: "Global Literary Studies (GLITS)",
      url: "https://slavic.washington.edu/ba-global-literary-studies-glits",
    },
    entry: {
      label: "Global Literary Studies (GLITS)",
      url: "https://slavic.washington.edu/ba-global-literary-studies-glits",
    },
    parsed: {
      title: "BA in Global Literary Studies",
      headings: ["BA in Global Literary Studies"],
      pathwayLabels: [],
      snapshotLines: [
        "Introduction to Literature (5 credits): one course from GLITS 250, GLITS 251, GLITS 252, or GLITS 253",
      ],
    },
  };

  assert.equal(
    parser.shouldKeepLinkedSupplementalHtmlSourceForTest(
      entry,
      baseParsed,
      globalLiteraryStudiesSupplement
    ),
    false
  );
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

test("Parser keeps Tacoma CSS exclusions and honors-only notes out of source blocks", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-computer-science-and-systems-bs",
    ownerTitle: "Computer Science and Systems (BS)",
    planId: "uw-tacoma-computer-science-and-systems-bs",
    campusId: "uw-tacoma",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
    label: "Bachelor of Science in CSS page.",
  });
  const html = `
    <main>
      <h2>B.S. in CSS Requirements</h2>
      <h3>Computer Science Core Courses</h3>
      <p>TCSS 305 Programming Practicum</p>
      <p>TCSS 321 Discrete Structures I</p>
      <h3>Additional Required Courses</h3>
      <p>An additional lab-based science course OR an additional 300 or 400-level math course, except TMATH 310</p>
      <h3>Senior Electives</h3>
      <p>Students must complete 25 additional graded credits of 300-level or 400-level courses chosen from the Computer Science & Systems program (excluding TCSS 390).</p>
      <p>TCSS 390 Undergraduate Seminar in Computer Science & Systems is a workshop style course to help you solve problems.</p>
      <p>To qualify for CSS honors, you must meet all of the following requirements in addition to completing all degree requirements for the B.S. in CSS:</p>
      <p>Complete the following as part of your CSS senior elective requirements:</p>
      <p>TCSS 440 (Formal Models in Computer Science) or another 5 credit senior elective in the research area of your Honors Thesis.</p>
    </main>
  `;
  const block = buildParsedBlockFixture(entry, html);

  assert.ok(block.parsedUwCourseCodes.includes("TCSS 305"));
  assert.ok(block.parsedUwCourseCodes.includes("TCSS 321"));
  for (const falseRequiredCode of ["TMATH 310", "TCSS 390", "TCSS 440"]) {
    assert.equal(
      block.parsedUwCourseCodes.includes(falseRequiredCode),
      false,
      `Expected ${falseRequiredCode} to stay out of parsed CSS requirements.`
    );
  }
  assert.ok(
    block.sourceSectionFilterAuditRows.some(
      (row) =>
        row.courseCodesExtracted.includes("TCSS 440") &&
        row.detectedSectionRole === "support-metadata" &&
        row.schedulable === false
    )
  );
});

test("Dedicated Tacoma CSS BS route keeps admission and elective requirement evidence", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-tacoma-computer-science-and-systems:pathway:bachelor-of-science",
    ownerTitle: "Computer Science and Systems - Bachelor of Science",
    planId: "uw-tacoma-computer-science-and-systems",
    pathwayId: "bachelor-of-science",
    campusId: "uw-tacoma",
    role: "degree-requirements",
    parserType: "html-degree-page",
    url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
    label: "B.S. in Computer Science & Systems",
  });
  const html = `
    <main>
      <h2>Bachelor of Arts Option</h2>
      <p>The Bachelor of Arts in CSS blends a solid foundation with a minor.</p>
      <h2>How to Apply</h2>
      <h3>Admission Requirements</h3>
      <p>Any lab-based science except Astronomy.</p>
      <p>UW Tacoma students are encouraged to complete lab sciences from the following: TBIOL 110, TCHEM 105, TCHEM 131, TGEOS 117, TPHYS 121, and TPHYS 122.</p>
      <p>You may need one additional approved lab-based science course, TCHEM 142 or TBIOL 120, to meet the total number of lab science credits required.</p>
      <h2>Curriculum Details</h2>
      <h3>Computer Science Core Courses</h3>
      <p>TCSS 305 Programming Practicum</p>
      <p>TCSS 321 Discrete Structures I</p>
      <h3>Senior Electives</h3>
      <p>No more than 10 credits of TCSS 497, TCSS 498, and TCSS 499 may be used to satisfy the elective requirement.</p>
      <h3>CSS Honors</h3>
      <p>TCSS 440 or another 5 credit senior elective in the research area of your Honors Thesis.</p>
    </main>
  `;
  const block = buildParsedBlockFixture(entry, html);

  for (const expectedCode of [
    "TBIOL 110",
    "TCHEM 105",
    "TCHEM 131",
    "TGEOS 117",
    "TPHYS 121",
    "TPHYS 122",
    "TCHEM 142",
    "TBIOL 120",
    "TCSS 305",
    "TCSS 321",
  ]) {
    assert.ok(
      block.parsedUwCourseCodes.includes(expectedCode),
      `Expected ${expectedCode} to be preserved from the dedicated BS source.`
    );
  }
  assert.equal(block.parsedUwCourseCodes.includes("TCSS 440"), false);
  assert.ok(
    block.sourceSectionFilterAuditRows.some(
      (row) =>
        row.courseCodesExtracted.includes("TCSS 497") &&
        row.courseCodesExtracted.includes("TCSS 498") &&
        row.courseCodesExtracted.includes("TCSS 499") &&
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

test("Catalog parser blocks graduate degree sections on shared undergraduate catalog pages", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-seattle-speech-and-hearing-sciences",
    ownerTitle: "Speech and Hearing Sciences",
    planId: "uw-seattle-speech-and-hearing-sciences",
    campusId: "uw-seattle",
    parserType: "catalog-page",
    url: "https://www.washington.edu/students/gencat/program/S/SpeechandHearingSciences-296.html",
    label: "Scoped current requirements: Home",
    sourceLabel: "Scoped current requirements: Home",
  });
  const baseResult = buildRecoveryOwnerFixture({
    ownerId: entry.ownerId,
    ownerTitle: entry.ownerTitle,
    planId: entry.planId,
    campusId: entry.campusId,
    primaryParserType: entry.parserType,
    primarySourceUrl: entry.url,
    primarySourceLabel: entry.label,
    sourceUrl: entry.url,
    sourceLabel: entry.label,
    sourceRole: "official-catalog",
    structuredUwCourseCodes: ["SPHSC 250"],
    supportLists: [],
  });
  const parsed = {
    courseCodes: ["SPHSC 250", "SPHSC 503", "SPHSC 506", "SPHSC 601", "SPHSC 801"],
    snapshotLines: [
      "Undergraduate Program",
      "Bachelor of Science degree with a major in Speech and Hearing Sciences",
      "Completion Requirements",
      "SPHSC 250",
      "Back to Top",
      "Graduate Programs",
      "Program of Study: Doctor Of Audiology (not admitting)",
      "Doctor Of Audiology (fee-based) (not admitting)",
      "Completion Requirements",
      "Didactic (minimum 82 credits): SPHSC 503",
      "40 credits of SPHSC 601",
      "Minimum 12 credits of SPHSC 801",
      "Academic Coursework : For students with a prior undergraduate or graduate degree in speech and hearing sciences (minimum 41 credits as follows):",
      "SPHSC 506 or approved alternative (minimum 3 credits)",
    ],
    headings: [],
    requirementCueLines: [],
    chooseStatements: [],
    pathwayLabels: [],
    title: "Speech and Hearing Sciences",
  };

  const owner = parser.buildManifestParseSuccessForTest(
    baseResult,
    ["SPHSC 250"],
    entry,
    parsed,
    "primary-source"
  );
  const auditRowsByCourse = new Map(
    owner.sourceSectionFilterAuditRows
      .flatMap((row) => (row.courseCodesExtracted ?? []).map((courseCode) => [courseCode, row]))
  );

  assert.ok(owner.parsedUwCourseCodes.includes("SPHSC 250"));
  for (const graduateCourseCode of ["SPHSC 503", "SPHSC 506", "SPHSC 601", "SPHSC 801"]) {
    assert.equal(owner.parsedUwCourseCodes.includes(graduateCourseCode), false);
    assert.equal(auditRowsByCourse.get(graduateCourseCode)?.schedulable, false);
  }
});

test("Catalog snapshot heading metadata does not suppress undergraduate requirement rows", () => {
  const rows = parser.buildParserPrerequisiteFilterAuditRowsForTest({
    ownerId: "uw-seattle-cinema-and-media-studies",
    sourceUrl:
      "https://www.washington.edu/students/gencat/program/S/CinemaandMediaStudies-132.html",
    sourceRole: "official-catalog",
    snapshotLines: [
      "Owner: uw-seattle-cinema-and-media-studies",
      "Source: https://www.washington.edu/students/gencat/program/S/CinemaandMediaStudies-132.html",
      "Title:",
      'Headings: ["Bachelor of Arts degree with a major in Cinema and Media Studies","Graduate Programs","Program of Study: Doctor Of Philosophy (Cinema and Media Studies)"]',
      "",
      "Graduate Programs",
      "Program of Study: Doctor Of Philosophy (Cinema and Media Studies)",
      "Undergraduate Programs",
      "Program of Study: Major: Cinema and Media Studies",
      "Program Overview",
      "Cinema and media studies majors may pursue work at the MA and PhD levels in allied curricula in the humanities and the arts. Students may aim for a broad range of careers including advertising, education, entertainment law, information technology, media archiving, museum work or public relations.",
      "Bachelor of Arts degree with a major in Cinema and Media Studies",
      "Completion Requirements",
      "60 credits",
      "Core courses (10 credits): CMS 301, CMS 480",
      "one of CMS 302, CMS 303, or CMS 304",
    ],
  });
  const rowsByRawLine = new Map(rows.map((row) => [row.rawLine, row]));

  assert.equal(rowsByRawLine.get("Core courses (10 credits): CMS 301, CMS 480")?.schedulable, true);
  assert.equal(
    rowsByRawLine.get("one of CMS 302, CMS 303, or CMS 304")?.detectedSectionRole,
    "primary-requirement-section"
  );
});

test("Approved academic breadth course lists stay non-schedulable under subject subheadings", () => {
  const rows = parser.buildParserPrerequisiteFilterAuditRowsForTest({
    ownerId: "uw-bothell-educational-studies-elementary-education",
    sourceUrl:
      "https://www.uwb.edu/education/undergraduate/elementary-education/degree-requirements",
    sourceRole: "primary-degree-requirements",
    snapshotLines: [
      "Elementary Education Endorsement Academic Breadth Courses",
      "Physical Science",
      "CHEM 120 Principles of Chemistry I NSc, RSN LAB",
      "PHYS 114 Mechanics NSc, RSN",
    ],
  });
  const rowsByRawLine = new Map(rows.map((row) => [row.rawLine, row]));

  assert.equal(
    rowsByRawLine.get("Physical Science")?.detectedSectionRole,
    "approved-course-list"
  );
  assert.equal(
    rowsByRawLine.get("CHEM 120 Principles of Chemistry I NSc, RSN LAB")?.schedulable,
    false
  );
  assert.equal(
    rowsByRawLine.get("PHYS 114 Mechanics NSc, RSN")?.schedulable,
    false
  );
});

test("Parser ignores table-adjacent text fragments as sectioned course titles", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-bothell-mechanical-engineering",
    ownerTitle: "Mechanical Engineering",
    planId: "uw-bothell-mechanical-engineering",
    campusId: "uw-bothell",
    url: "https://www.uwb.edu/stem/undergraduate/majors/mechanical-engineering/requirements",
    label: "Mechanical Engineering degree requirements",
  });
  const snapshotLines = [
    "Mathematics: 30 credits",
    "STMATH 124: Calculus I",
    "other disciplines require the",
    "STMATH 125: Calculus II",
    "department's approval.",
    "STMATH 207: Intro to Differential Equations 5",
    "Diversity, Natural World, and QSR",
  ];

  const groups = parser.buildParsedRequirementGroupsForTest(
    entry,
    parser.extractCourseCodesFromLinesForTest(snapshotLines, []),
    snapshotLines
  );
  const optionTitles = groups.flatMap((group) =>
    (group.options ?? []).map((option) => option.title).filter(Boolean)
  );

  assert.doesNotMatch(
    optionTitles.join("\n"),
    /other disciplines require the|department's approval|Diversity, Natural World, and QSR/
  );
});

test("Credit bucket category labels ignore cannot-overlap category references", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-bothell-physics-bs",
    ownerTitle: "Physics",
    planId: "uw-bothell-physics-bs",
    campusId: "uw-bothell",
    url: "https://www.uwb.edu/stem/undergraduate/majors/physics/requirements",
    label: "Physics degree requirements",
  });
  const snapshotLines = [
    "Degree Requirements",
    "Social Sciences (SSc) - 10 more credits (cannot overlap with A&H)",
  ];

  const groups = parser.buildParsedRequirementGroupsForTest(entry, [], snapshotLines);
  const socialScienceGroup = groups.find((group) =>
    /Social Sciences/.test(group.sourceHeading ?? "")
  );

  assert.equal(socialScienceGroup?.label, "10 credits of Social Sciences");
  assert.equal(socialScienceGroup?.category, "ssc");
});

test("Graduate career-planning prose does not suppress undergraduate catalog requirements", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId: "uw-seattle-education-studies:pathway:ba-option-family:education-research-and-policy",
    ownerTitle: "Education Studies - B.A. Education Research and Policy option",
    planId: "uw-seattle-education-studies",
    pathwayId: "ba-option-family:education-research-and-policy",
    campusId: "uw-seattle",
    parserType: "catalog-page",
    url: "https://www.washington.edu/students/gencat/program/S/CollegeofEducation-351.html#credential-64d254efdd5ce4dd309ca01f",
    label: "Education Studies catalog credential",
    sourceLabel: "Education Studies catalog credential",
  });
  const structuredCourseCodes = [
    "EDLPS 302",
    "EDPSY 380",
    "EDPSY 404",
    "EDPSY 490",
    "EDUC 240",
    "EDUC 251",
    "EDUC 280",
    "EDUC 310",
    "EDUC 400",
    "EDUC 472",
    "EDUC 473",
  ];
  const baseResult = buildRecoveryOwnerFixture({
    ownerId: entry.ownerId,
    ownerTitle: entry.ownerTitle,
    planId: entry.planId,
    pathwayId: entry.pathwayId,
    campusId: entry.campusId,
    primaryParserType: entry.parserType,
    primarySourceUrl: entry.url,
    primarySourceLabel: entry.label,
    sourceUrl: entry.url,
    sourceLabel: entry.label,
    sourceRole: "official-catalog",
    structuredUwCourseCodes: structuredCourseCodes,
    supportLists: [],
  });
  const parsed = {
    courseCodes: structuredCourseCodes,
    snapshotLines: [
      "Bachelor of Arts degree with a major in Education Studies: Education Research and Policy",
      "Credential Overview",
      "The Education Research and Policy option is designed for students interested in pursuing careers in organizations that conduct research about education, and is a good choice for students who plan to pursue a graduate degree in education policy.",
      "Completion Requirements",
      "Major Requirements",
      "Foundation Courses (18 credits):",
      "One introductory course from ECFS 200, EDUC 240, or EDUC 280",
      "One development course from EDPSY 302, EDPSY 380, or EDPSY 404",
      "EDUC 251, EDUC 310",
      "Additional Completion Requirements",
      "Option specific credits (20 credits): EDLPS 302; EDUC 400 (2 credits), EDUC 472, EDUC 473; EDPSY 490",
    ],
    headings: [
      "Bachelor of Arts degree with a major in Education Studies: Education Research and Policy",
    ],
    requirementCueLines: [],
    chooseStatements: [],
    pathwayLabels: [],
    title: "Education Studies",
  };

  const owner = parser.buildManifestParseSuccessForTest(
    baseResult,
    structuredCourseCodes,
    entry,
    parsed,
    "primary-source"
  );
  const rowsByRawLine = new Map(
    owner.sourceSectionFilterAuditRows.map((row) => [row.rawLine, row])
  );

  assert.ok(owner.parsedUwCourseCodes.includes("EDUC 251"));
  assert.ok(owner.parsedUwCourseCodes.includes("EDUC 472"));
  assert.equal(
    rowsByRawLine.get("EDUC 251, EDUC 310")?.detectedSectionRole,
    "primary-requirement-section"
  );
  assert.equal(
    rowsByRawLine.get(
      "Option specific credits (20 credits): EDLPS 302; EDUC 400 (2 credits), EDUC 472, EDUC 473; EDPSY 490"
    )?.detectedSectionRole,
    "primary-requirement-section"
  );
});

test("Pre-graduate catalog notes do not suppress later undergraduate option requirements", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId:
      "uw-seattle-atmospheric-and-climate-science:pathway:bs-option-family:chemistry",
    ownerTitle: "Atmospheric and Climate Science - B.S. Chemistry option",
    planId: "uw-seattle-atmospheric-and-climate-science",
    pathwayId: "bs-option-family:chemistry",
    campusId: "uw-seattle",
    parserType: "catalog-page",
    url: "https://www.washington.edu/students/gencat/program/S/AtmosphericandClimateScience-1067.html",
    label: "Atmospheric and Climate Science catalog",
  });
  const structuredCourseCodes = [
    "ATMOS 310",
    "ATMOS 458",
    "CEE 480",
    "CHEM 142",
    "CHEM 152",
    "CHEM 162",
  ];
  const baseResult = buildRecoveryOwnerFixture({
    ownerId: entry.ownerId,
    ownerTitle: entry.ownerTitle,
    planId: entry.planId,
    pathwayId: entry.pathwayId,
    campusId: entry.campusId,
    primaryParserType: entry.parserType,
    primarySourceUrl: entry.url,
    primarySourceLabel: entry.label,
    sourceUrl: entry.url,
    sourceLabel: entry.label,
    sourceRole: "official-catalog",
    structuredUwCourseCodes: structuredCourseCodes,
    supportLists: [],
  });
  const optionRequirementLine =
    "Requirements (23-27 credits): ATMOS 458/CHEM 458; CEE 480/ATMOS 480; ATMOS 310 or CSE 160; one of the following: (1) CHEM 142, CHEM 152, CHEM 162";
  const parsed = {
    courseCodes: structuredCourseCodes,
    snapshotLines: [
      "Bachelor of Science degree with a major in Atmospheric and Climate Science: Chemistry",
      "Completion Requirements",
      "Core requirements (27-28 credits): STAT 390 (or Q SCI 381 for options in meteorology, climate, chemistry); ATMOS 220, ATMOS 301",
      "Pre-graduate Program for Physical Science, Mathematics, and Engineering Majors",
      "The following elective course sequence is suitable preparation for students interested in pursuing graduate study in atmospheric sciences: ATMOS 301, ATMOS 340, ATMOS 441.",
      "Additional Completion Requirements",
      "Option specific credits (29-37 credits)",
      optionRequirementLine,
    ],
    headings: [
      "Bachelor of Science degree with a major in Atmospheric and Climate Science: Chemistry",
    ],
    requirementCueLines: [],
    chooseStatements: [],
    pathwayLabels: [],
    title: "Atmospheric and Climate Science",
  };

  const owner = parser.buildManifestParseSuccessForTest(
    baseResult,
    structuredCourseCodes,
    entry,
    parsed,
    "primary-source"
  );
  const optionRow = owner.sourceSectionFilterAuditRows.find(
    (row) => row.rawLine === optionRequirementLine
  );

  assert.ok(owner.parsedUwCourseCodes.includes("CHEM 142"));
  assert.equal(optionRow?.detectedSectionRole, "primary-requirement-section");
  assert.equal(optionRow?.schedulable, true);
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

test("Parser recovery does not start pathway catalog sections from shared course rows", () => {
  const entry = buildRecoveryEntryFixture({
    ownerId:
      "uw-seattle-atmospheric-and-climate-science:pathway:bs-option-family:chemistry",
    ownerTitle: "Atmospheric and Climate Science - B.S. Chemistry option",
    sourceLabel: "Atmospheric and Climate Science catalog",
    planId: "uw-seattle-atmospheric-and-climate-science",
    pathwayId: "bs-option-family:chemistry",
    campusId: "uw-seattle",
    parserType: "catalog-page",
    url: "https://www.washington.edu/students/gencat/program/S/AtmosphericandClimateScience-1067.html",
    label: "Atmospheric and Climate Science catalog",
  });
  const candidates = parser.buildParserRecoverySectionCandidatesForTest(entry, {
    title: "Atmospheric and Climate Science",
    headings: [
      "Bachelor of Science degree with a major in Atmospheric and Climate Science: Chemistry",
      "Bachelor of Science degree with a major in Atmospheric and Climate Science: Climate",
    ],
    lines: [
      "Bachelor of Science degree with a major in Atmospheric and Climate Science: Chemistry",
      "Foundation requirements: MATH 124, MATH 125, MATH 126",
      "Core requirements: STAT 390 (or Q SCI 381 for options in meteorology, climate, chemistry); ATMOS 220, ATMOS 301",
      "Option specific credits (29-37 credits)",
      "Requirements (23-27 credits): ATMOS 458/CHEM 458; CEE 480/ATMOS 480; ATMOS 310 or CSE 160; CHEM 142, CHEM 152, CHEM 162",
      "Back to Top",
      "Bachelor of Science degree with a major in Atmospheric and Climate Science: Climate",
      "Option specific credits (31-40 credits)",
      "Requirements (22-25 credits): ATMOS 350; ATMOS 358, ATMOS 380, ATMOS 487; ESS 431 or ESS 433",
    ],
  });

  assert.ok(candidates.length > 0);
  assert.match(candidates[0].sectionLines[0], /Chemistry/);
  assert.ok(candidates[0].sectionLines.some((line) => /CHEM 142/.test(line)));
  assert.equal(candidates[0].sectionLines.some((line) => /ATMOS 350/.test(line)), false);
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
