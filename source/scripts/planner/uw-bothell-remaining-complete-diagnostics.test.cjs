const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertIncludesAll,
  assertTextIncludesAll,
  createDiagnosticTest,
  createSourceTextFetcher,
  flattenText,
  getExpectedCourseCodesFromProgram,
  getPlanner,
  normalizePathwayId,
  normalizeText,
  uniqueSorted,
} = require("./lib/test-harness.cjs");

const {
  bothellRemainingPlanIds,
  equivalentMajorGroups,
  remainingBothellPrograms,
} = require("./fixtures/uw-bothell-remaining-complete-diagnostics.fixture.cjs");
const {
  extractCourseCodesFromLineForTest,
} = require("./parse-transfer-planner-requirement-sources.cjs");

const diagnosticTest = createDiagnosticTest(
  test,
  "TRANSFER_PLANNER_RUN_UW_BOTHELL_REMAINING_DIAGNOSTICS"
);
const onlineDiagnosticTest =
  process.env.TRANSFER_PLANNER_COMPLETE_DIAGNOSTICS_ONLINE === "1"
    ? diagnosticTest
    : test.skip;
const fetchSourceText = createSourceTextFetcher({
  operation: "Fetch Bothell diagnostic official source",
});
let pdfjsImportPromise = null;
const pdfSourceTextCache = new Map();

function isPdfSource(url) {
  return /\.pdf(?:$|[?#])/i.test(String(url ?? ""));
}

function loadPdfjs() {
  pdfjsImportPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsImportPromise;
}

async function fetchPdfSourceText(url) {
  if (pdfSourceTextCache.has(url)) {
    return pdfSourceTextCache.get(url);
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "GatorGuide transfer planner diagnostic/1.0",
    },
  });
  assert.equal(response.ok, true, `Official PDF source did not load: ${url} (${response.status})`);

  const pdfjs = await loadPdfjs();
  const document = await pdfjs.getDocument({
    data: new Uint8Array(await response.arrayBuffer()),
    verbosity: 0,
  }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => item.str ?? "").join(" "));
  }

  const text = pageTexts.join("\n");
  pdfSourceTextCache.set(url, text);
  return text;
}

async function fetchOfficialSourceText(url) {
  return isPdfSource(url) ? fetchPdfSourceText(url) : fetchSourceText(url);
}

const sourceCoveragePlanByHiddenAlias = {
  "uw-bothell-chemistry-biochemistry": "uw-bothell-chemistry-bs",
};

function getSourceCoveragePlanId(planId) {
  return sourceCoveragePlanByHiddenAlias[planId] ?? planId;
}

function shouldAssertExactPathways(program) {
  return (
    program.planId.startsWith("uw-bothell-") &&
    sourceCoveragePlanByHiddenAlias[program.planId] == null
  );
}

function isBothellProgram(program) {
  return program.planId.startsWith("uw-bothell-");
}

function normalizeCourseCode(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .toUpperCase()
    .replace(/\bA\s+MATH\b/g, "AMATH")
    .replace(/\bB\s+(AES|BIO|BUS|CHEM|CORE|DATA|EARTH|EDUC|HLTH|HS|IMD|IS|MATH|PHYS|ST|WRIT)\b/g, "B$1")
    .replace(/\bQ\s+SCI\b/g, "QSCI")
    .replace(/\bST\s+MATH\b/g, "STMATH")
    .replace(/\bT\s+(ACCT|AMST|ARTS|BANLT|BIOL|BUS|COM|ECON|EGL|ESC|EST|FILM|GEOG|GEOS|GH|GIS|HIST|IAS|INFO|LAW|LAX|LIT|MATH|MKTG|PHIL|PHYS|POLS|PSYCH|RELIG|SOC|SOCWF|SPAN|UDE|URB|WOMN|WRT)\b/g, "T$1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^([A-Z&]+(?:\s+[A-Z&]+)*)\s*(\d{3}[A-Z]?)$/, "$1 $2");
}

function normalizeEvidenceText(value) {
  return normalizeText(value)
    .replace(/\bA MATH\b/g, "AMATH")
    .replace(/\bB (AES|BIO|BUS|CHEM|CORE|DATA|EARTH|EDUC|HLTH|HS|IMD|IS|MATH|PHYS|ST|WRIT)\b/g, "B$1")
    .replace(/\bQ SCI\b/g, "QSCI")
    .replace(/\bST MATH\b/g, "STMATH")
    .replace(/\bT (ACCT|AMST|ARTS|BANLT|BIOL|BUS|COM|ECON|EGL|ESC|EST|FILM|GEOG|GEOS|GH|GIS|HIST|IAS|INFO|LAW|LAX|LIT|MATH|MKTG|PHIL|PHYS|POLS|PSYCH|RELIG|SOC|SOCWF|SPAN|UDE|URB|WOMN|WRT)\b/g, "T$1");
}

function getParsedUwCourseCodes(planId) {
  const planner = getPlanner();
  const blocks = planner.getTransferPlannerParsedRequirementSourceBlocks(planId) ?? [];
  return uniqueSorted(
    blocks.flatMap((block) => block.parsedUwCourseCodes ?? []).map(normalizeCourseCode)
  );
}

function getCurrentPlanText(planId) {
  const planner = getPlanner();
  const sourcePlan = planner.getTransferPlannerMajorPlan(planId);
  const runtimePlan = planner.getTransferPlannerStudentRuntimeMajorPlan(planId);
  const sourcePathways = planner.getTransferPlannerPathwaysForPlan(sourcePlan);
  const runtimePathways = planner.getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan);
  const parsedBlocks = planner.getTransferPlannerParsedRequirementSourceBlocks(planId);
  const resolvedRuntimePlans = [
    runtimePlan ? planner.resolveTransferPlannerMajorPlan(runtimePlan, null) : null,
    ...(runtimePathways ?? []).map((pathway) =>
      planner.resolveTransferPlannerMajorPlan(runtimePlan, pathway.id)
    ),
  ];

  return normalizeText(
    flattenText({
      sourcePlan,
      runtimePlan,
      sourcePathways,
      runtimePathways,
      parsedBlocks,
      resolvedRuntimePlans,
    })
  );
}

function getRegisteredPathwayIds(planId) {
  const planner = getPlanner();
  const sourcePlan = planner.getTransferPlannerMajorPlan(planId);
  const runtimePlan = planner.getTransferPlannerStudentRuntimeMajorPlan(planId);
  return uniqueSorted([
    ...planner.getTransferPlannerPathwaysForPlan(sourcePlan),
    ...planner.getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan),
  ].map((pathway) => normalizePathwayId(pathway.id)));
}

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCourseSubject(code) {
  return normalizeCourseCode(code).replace(/\s+\d{3}[A-Z]?$/, "");
}

function extractCourseCodesFromText(text, allowedSubjects = null) {
  const source = String(text ?? "");
  const allowedSubjectPattern =
    allowedSubjects && allowedSubjects.size > 0
      ? [...allowedSubjects]
          .sort((left, right) => right.length - left.length)
          .map((subject) => escapeRegExp(subject).replace(/\s+/g, "\\s+"))
          .join("|")
      : null;
  const directMatches = allowedSubjectPattern
    ? source.match(new RegExp(`\\b(?:${allowedSubjectPattern})\\s+\\d{3}[A-Z]?\\b`, "gi")) ?? []
    : source.match(/\b[A-Z]{1,8}(?:\s+[A-Z]{1,8}){0,2}\s+\d{3}[A-Z]?\b/g) ?? [];
  const sharedSubjectMatches = [...source.matchAll(/\b([A-Z]{1,8})\/([A-Z]{1,8})\s+(\d{3}[A-Z]?)\b/g)]
    .flatMap((match) => [`${match[1]} ${match[3]}`, `${match[2]} ${match[3]}`]);
  const sharedNumberMatches = [...source.matchAll(/\b([A-Z]{1,8})\s+(\d{3}[A-Z]?)\/(\d{3}[A-Z]?)\b/g)]
    .flatMap((match) => [`${match[1]} ${match[2]}`, `${match[1]} ${match[3]}`]);
  return uniqueSorted(
    [
      ...directMatches,
      ...sharedSubjectMatches,
      ...sharedNumberMatches,
      ...source
        .split(/\r?\n/)
        .flatMap(extractCourseCodesFromLineForTest),
    ]
      .map(normalizeCourseCode)
      .filter((code) => !allowedSubjects || allowedSubjects.has(getCourseSubject(code)))
  );
}

function getProgramSourceUrls(program) {
  const planner = getPlanner();
  const parsedBlocks =
    planner.getTransferPlannerParsedRequirementSourceBlocks(getSourceCoveragePlanId(program.planId)) ?? [];
  return uniqueSorted([
    ...(program.officialSources ?? []),
    ...parsedBlocks.map((block) => block.sourceUrl).filter(Boolean),
  ]);
}

async function getOnlineCourseCodes(program) {
  const sourceTexts = await Promise.all(getProgramSourceUrls(program).map(fetchOfficialSourceText));
  const allowedSubjects = new Set(getExpectedCourseCodesFromProgram(program).map(getCourseSubject));
  return uniqueSorted(sourceTexts.flatMap((text) => extractCourseCodesFromText(text, allowedSubjects)));
}

async function getOnlineSourceText(program) {
  const sourceTexts = await Promise.all(getProgramSourceUrls(program).map(fetchOfficialSourceText));
  return sourceTexts.join(" ");
}

test("UW Bothell remaining diagnostic fixture is source scoped and UW-course only", () => {
  assert.deepEqual(bothellRemainingPlanIds, [
    "uw-bothell-american-and-ethnic-studies",
    "uw-bothell-business-administration-accounting",
    "uw-bothell-business-administration-finance",
    "uw-bothell-business-administration-leadership-and-strategic-innovation",
    "uw-bothell-business-administration-marketing",
    "uw-bothell-business-administration-supply-chain-management",
    "uw-bothell-csse-information-assurance-and-cybersecurity",
    "uw-bothell-culture-literature-and-the-arts",
    "uw-bothell-data-visualization-ba",
    "uw-bothell-data-visualization-bs",
    "uw-bothell-gender-women-and-sexuality-studies",
    "uw-bothell-global-studies",
    "uw-bothell-interactive-media-design",
    "uw-bothell-interdisciplinary-arts",
    "uw-bothell-interdisciplinary-studies-individualized-study",
    "uw-bothell-science-technology-and-society",
    "uw-bothell-society-ethics-and-human-behavior",
    "uw-bothell-chemistry-biochemistry",
  ]);

  const fixturePlanIds = uniqueSorted(remainingBothellPrograms.map((program) => program.planId));
  const groupPlanIds = uniqueSorted(equivalentMajorGroups.flatMap((group) => group.planIds));
  assert.deepEqual(fixturePlanIds, groupPlanIds);

  for (const program of remainingBothellPrograms) {
    assert.equal(program.officialSources.length > 0, true, `${program.planId} needs sources`);
    const communityCollegeCodes = extractCourseCodesFromText(
      [...(program.requiredTextSnippets ?? []), ...(program.officialSources ?? [])].join(" ")
    ).filter((code) => /\b[A-Z]+&\s+\d/.test(code));
    assert.deepEqual(
      communityCollegeCodes,
      [],
      `${program.planId} fixture should contain UW course codes only`
    );
  }
});

diagnosticTest("UW Bothell remaining target roster exists in the current planner", () => {
  const planner = getPlanner();
  const actualBothellPlanIds = uniqueSorted(
    planner.getTransferPlannerMajorsForCampus("uw-bothell").map((plan) => plan.id)
  );
  assertIncludesAll(
    actualBothellPlanIds,
    bothellRemainingPlanIds,
    "UW Bothell remaining major roster"
  );
});

diagnosticTest("UW Bothell remaining equivalent groups reference real planner majors", () => {
  const planner = getPlanner();
  for (const group of equivalentMajorGroups) {
    for (const planId of group.planIds) {
      assert.ok(
        planner.getTransferPlannerMajorPlan(planId),
        `${group.id} references missing planner major ${planId}`
      );
    }
  }
});

for (const program of remainingBothellPrograms.filter(isBothellProgram)) {
  diagnosticTest(`${program.planId} keeps every official source link`, () => {
    assertTextIncludesAll(
      getCurrentPlanText(getSourceCoveragePlanId(program.planId)),
      program.officialSources,
      `${program.planId} official source links`
    );
  });

  onlineDiagnosticTest(`${program.planId} verifies reviewed evidence against live official UW sources`, async () => {
    const reviewedCourses = getExpectedCourseCodesFromProgram(program);
    const reviewedTextSnippets = program.requiredTextSnippets ?? [];
    const onlineText = await getOnlineSourceText(program);

    assert.ok(
      onlineText.length > 0,
      `${program.planId} should have at least one loadable live official source.`
    );

    if (reviewedCourses.length) {
      assertIncludesAll(
        await getOnlineCourseCodes(program),
        reviewedCourses,
        `${program.planId} live official source course evidence`,
        { normalize: normalizeCourseCode }
      );
    }

    assertTextIncludesAll(
      onlineText,
      reviewedTextSnippets,
      `${program.planId} live official source text evidence`,
      { normalize: normalizeEvidenceText }
    );
  });

  diagnosticTest(`${program.planId} preserves every known pathway`, () => {
    const actualPathwayIds = getRegisteredPathwayIds(getSourceCoveragePlanId(program.planId));
    const expectedPathwayIds = uniqueSorted(
      (program.expectedPathwayIds ?? []).map(normalizePathwayId)
    );
    if (shouldAssertExactPathways(program)) {
      assert.deepEqual(
        actualPathwayIds,
        expectedPathwayIds,
        `${program.planId} should preserve the complete pathway set`
      );
      return;
    }
    assertIncludesAll(actualPathwayIds, expectedPathwayIds, `${program.planId} known pathways`);
  });

  diagnosticTest(`${program.planId} preserves degree/gen-ed context snippets`, () => {
    assertTextIncludesAll(
      getCurrentPlanText(getSourceCoveragePlanId(program.planId)),
      program.requiredTextSnippets ?? [],
      `${program.planId} degree/gen-ed context`
    );
  });
}
