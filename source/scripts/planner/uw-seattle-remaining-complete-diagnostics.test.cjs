const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { fetchWithHandling } = require("../lib/fetch-with-handling.cjs");

const {
  equivalentMajorGroups,
  seattleRemainingPlanIds,
  seattleRemainingPrograms,
} = require("./fixtures/uw-seattle-remaining-complete-diagnostics.fixture.cjs");

const RUN_DIAGNOSTICS =
  process.env.TRANSFER_PLANNER_RUN_UW_SEATTLE_REMAINING_DIAGNOSTICS === "1";
const diagnosticTest = RUN_DIAGNOSTICS ? test : test.skip;
const onlineDiagnosticTest =
  RUN_DIAGNOSTICS && process.env.TRANSFER_PLANNER_COMPLETE_DIAGNOSTICS_ONLINE === "1"
    ? test
    : test.skip;

let plannerModule;
const sourceTextCache = new Map();
const fetchedSourceUrls = new Set();
const sourceReadyAtByOrigin = new Map();
const SOURCE_MIN_ORIGIN_GAP_MS = 1200;
const SOURCE_RETRY_DELAYS_MS = [2500, 5000, 10000, 20000];
let pdfjsImportPromise = null;

function getPlanner() {
  if (plannerModule) {
    return plannerModule;
  }

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

  plannerModule = require("../../constants/transfer-planner-source");
  return plannerModule;
}

function normalizeCourseCode(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .toUpperCase()
    .replace(/\bA\s+A\b/g, "AA")
    .replace(/\bA\s+MATH\b/g, "AMATH")
    .replace(/\bART\s+H\b/g, "ARTH")
    .replace(/\bB\s+(AES|BIO|BUS|CHEM|CORE|DATA|EARTH|ECON|EDUC|HLTH|HS|IMD|IS|MATH|PHYS|ST|WRIT)\b/g, "B$1")
    .replace(/\bBIO\s+A\b/g, "BIOA")
    .replace(/\bC\s+LIT\b/g, "CLIT")
    .replace(/\bCHEM\s+E\b/g, "CHEME")
    .replace(/\bENV\s+H\b/g, "ENVH")
    .replace(/\bG\s+H\b/g, "GH")
    .replace(/\bHST\s+(AFM|AM|AS|CMP|EU|LAC)\b/g, "HST$1")
    .replace(/\bIND\s+E\b/g, "INDE")
    .replace(/\bJSIS\s+([ABC])\b/g, "JSIS$1")
    .replace(/\bL\s+ARCH\b/g, "LARCH")
    .replace(/\bM\s+E\b/g, "ME")
    .replace(/\bPOL\s+S\b/g, "POLS")
    .replace(/\bQ\s+SCI\b/g, "QSCI")
    .replace(/\bR\s+E\b/g, "RE")
    .replace(/\bSOC\s+WF\b/g, "SOCWF")
    .replace(/\bT\s+(ACCT|AMST|ARTS|BANLT|BIOL|BIOMD|BUS|COM|CORE|CSS|ECON|EGL|ESC|EST|FILM|GEOG|GEOS|GH|GIS|HIST|IAS|INFO|LAW|LAX|LIT|MATH|MKTG|PHIL|PHYS|POLS|PSYCH|RELIG|SOC|SOCWF|SPAN|UDE|URB|WOMN|WRT)\b/g, "T$1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^([A-Z&]+(?:\s+[A-Z&]+)*)\s*(\d{3}[A-Z]?)$/, "$1 $2");
}

function normalizePathwayId(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function flattenText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flattenText).join(" ");
  if (typeof value === "object") return Object.values(value).map(flattenText).join(" ");
  return String(value);
}

function getBlocks(planId) {
  const planner = getPlanner();
  return planner.getTransferPlannerParsedRequirementSourceBlocks(planId) ?? [];
}

function getParsedUwCourseCodes(planId) {
  return uniqueSorted(
    getBlocks(planId).flatMap((block) => block.parsedUwCourseCodes ?? []).map(normalizeCourseCode)
  );
}

function getSourceDeclaredUwCourseCodes(planId) {
  return uniqueSorted(
    getBlocks(planId)
      .flatMap((block) => [
        ...(block.parsedUwCourseCodes ?? []),
        ...(block.sourceOnlyUwCourseCodes ?? []),
        ...(block.approvedFilterUwCourseCodes ?? []),
        ...(block.electiveListUwCourseCodes ?? []),
      ])
      .map(normalizeCourseCode)
  );
}

function hasNonSchedulableSourceEvidence(planId) {
  return getBlocks(planId).some(
    (block) =>
      block.canCreateSchedulableRows === false ||
      block.nonSchedulable === true ||
      block.sourceRole === "non-schedulable-course-list" ||
      block.sourceRoleStatus === "non-schedulable" ||
      (block.qualitySignals ?? []).some((signal) => signal?.code === "inactive-major-source")
  );
}

function getCurrentPlanText(planId) {
  const planner = getPlanner();
  const sourcePlan = planner.getTransferPlannerMajorPlan(planId);
  const runtimePlan = planner.getTransferPlannerStudentRuntimeMajorPlan(planId);
  const sourcePathways = planner.getTransferPlannerPathwaysForPlan(sourcePlan);
  const runtimePathways = planner.getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan);
  const parsedBlocks = getBlocks(planId);
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

function getAllFixtureCoveredPlanIds() {
  const fixtureRoot = path.join(process.cwd(), "scripts", "planner", "fixtures");
  const ids = new Set(seattleRemainingPlanIds);
  for (const file of fs.readdirSync(fixtureRoot)) {
    if (!/^uw-.*-complete-diagnostics\.fixture\.cjs$/.test(file)) continue;
    const mod = require(path.join(fixtureRoot, file));
    for (const value of Object.values(mod)) {
      if (!Array.isArray(value)) continue;
      for (const item of value) {
        if (item && typeof item.planId === "string") {
          ids.add(item.planId);
        }
      }
    }
  }
  return ids;
}

function getSeattlePlanIds() {
  const planner = getPlanner();
  return uniqueSorted(
    planner.getTransferPlannerMajorsForCampus("uw-seattle").map((plan) => plan.id)
  );
}

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSourceTextForCourseExtraction(text) {
  return String(text ?? "")
    .replace(/\bART\s+H\s*(\d{3}[A-Z]?)\b/g, "ARTH $1")
    .replace(/\bJSIS\s+([ABC])\s+(\d{3}[A-Z]?)\b/g, "JSIS$1 $2")
    .replace(/\bHST\s+(AFM|AM|AS|CMP|EU|LAC)\s+(\d{3}[A-Z]?)\b/g, "HST$1 $2")
    .replace(/\bIND\s+E\s+(\d{3}[A-Z]?)\b/g, "INDE $1")
    .replace(/\bM\s+E\s+(\d{3}[A-Z]?)\b/g, "ME $1")
    .replace(/\bPOL\s+S\s+(\d{3}[A-Z]?)\b/g, "POLS $1")
    .replace(/\bR\s+E\s+(\d{3}[A-Z]?)\b/g, "RE $1")
    .replace(/\bSOC\s+WF\s+(\d{3}[A-Z]?)\b/g, "SOCWF $1");
}

function getCourseSubject(code) {
  return normalizeCourseCode(code).replace(/\s+\d{3}[A-Z]?$/, "");
}

function extractCourseCodesFromText(text, allowedSubjects) {
  const source = normalizeSourceTextForCourseExtraction(text);
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
  const subjectPattern = "[A-Z]{1,8}(?:\\s+[A-Z]{1,8}){0,2}";
  const sharedSubjectMatches = [
    ...source.matchAll(new RegExp(`\\b(${subjectPattern})\\/(${subjectPattern})\\s+(\\d{3}[A-Z]?)\\b`, "g")),
  ].flatMap((match) => [`${match[1]} ${match[3]}`, `${match[2]} ${match[3]}`]);
  const sharedNumberMatches = [
    ...source.matchAll(new RegExp(`\\b(${subjectPattern})\\s+(\\d{3}[A-Z]?)\\/(\\d{3}[A-Z]?)\\b`, "g")),
  ].flatMap((match) => [`${match[1]} ${match[2]}`, `${match[1]} ${match[3]}`]);
  return uniqueSorted(
    [...directMatches, ...sharedSubjectMatches, ...sharedNumberMatches]
      .map(normalizeCourseCode)
      .filter((code) => !/\b[A-Z]+&\s+\d/.test(code))
      .filter((code) => {
        if (!allowedSubjects || allowedSubjects.size === 0) return true;
        return allowedSubjects.has(getCourseSubject(code));
      })
  );
}

function isPdfSource(url) {
  return /\.pdf(?:$|[?#])/i.test(String(url ?? ""));
}

function loadPdfjs() {
  pdfjsImportPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsImportPromise;
}

async function responseToPdfText(response) {
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

  return pageTexts.join("\n");
}

function waitForSourceRetry(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForSourceOrigin(url) {
  if (fetchedSourceUrls.has(url)) return;

  let origin = "unknown";
  try {
    origin = new URL(url).origin;
  } catch {
    origin = String(url ?? "unknown");
  }

  const now = Date.now();
  const readyAt = sourceReadyAtByOrigin.get(origin) ?? 0;
  const waitMs = Math.max(readyAt - now, 0);
  sourceReadyAtByOrigin.set(origin, Math.max(now, readyAt) + SOURCE_MIN_ORIGIN_GAP_MS);

  if (waitMs > 0) {
    await waitForSourceRetry(waitMs);
  }
}

async function fetchSourceText(url) {
  if (sourceTextCache.has(url)) {
    return sourceTextCache.get(url);
  }

  let lastError = null;

  for (let attempt = 0; attempt <= SOURCE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await waitForSourceOrigin(url);
      const response = await fetchWithHandling(url, {
        operation: "Fetch Seattle diagnostic official source",
        throwOnHttpError: false,
        timeoutMs: 30000,
        userAgent: "GatorGuide transfer planner diagnostic/1.0",
      });
      assert.equal(response.ok, true, `Official source did not load: ${url} (${response.status})`);
      const text = isPdfSource(url)
        ? await responseToPdfText(response)
        : (await response.text())
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/\s+/g, " ");
      sourceTextCache.set(url, text);
      fetchedSourceUrls.add(url);
      return text;
    } catch (error) {
      lastError = error;
      const retryDelayMs = SOURCE_RETRY_DELAYS_MS[attempt];
      if (!/\((?:429|503)\)/.test(String(error?.message ?? "")) || retryDelayMs == null) {
        break;
      }
      await waitForSourceRetry(retryDelayMs);
    }
  }

  throw lastError;
}

async function getOnlineCourseCodes(program) {
  const sourceUrls = uniqueSorted([
    ...(program.officialSources ?? []),
    ...getBlocks(program.planId).map((block) => block.sourceUrl).filter(Boolean),
  ]);
  const sourceTexts = await Promise.all(sourceUrls.map(fetchSourceText));
  const sourceDeclaredSubjects = new Set(
    getSourceDeclaredUwCourseCodes(program.planId).map(getCourseSubject)
  );
  return uniqueSorted(
    sourceTexts.flatMap((text) => extractCourseCodesFromText(text, sourceDeclaredSubjects))
  );
}

async function getOnlineSourceText(program) {
  const sourceUrls = uniqueSorted([
    ...(program.officialSources ?? []),
    ...getBlocks(program.planId).map((block) => block.sourceUrl).filter(Boolean),
  ]);
  const sourceTexts = await Promise.all(sourceUrls.map(fetchSourceText));
  return sourceTexts.join(" ");
}

function assertHasCourseOverlap(actualValues, expectedValues, label) {
  const actual = new Set(actualValues.map(normalizeCourseCode));
  const expected = expectedValues.map(normalizeCourseCode);
  const overlap = expected.filter((expectedValue) => actual.has(expectedValue));

  assert.equal(
    overlap.length > 0,
    true,
    [
      `${label} should have at least one reviewed/parser UW course visible in live official source text.`,
      `Expected sample: ${expected.slice(0, 80).join(", ")}`,
      `Actual sample: ${[...actual].slice(0, 80).join(", ")}`,
    ].join("\n")
  );
}

function assertTextIncludesAll(text, snippets, label) {
  const normalizedText = normalizeText(text);
  const missing = snippets
    .map((snippet) => String(snippet ?? "").trim())
    .filter(Boolean)
    .filter((snippet) => !normalizedText.includes(normalizeText(snippet)));

  assert.equal(
    missing.length,
    0,
    [
      `${label} missing ${missing.length} expected text snippet(s).`,
      `Missing: ${missing.slice(0, 140).join(" | ")}`,
    ].join("\n")
  );
}

test("UW Seattle remaining diagnostic fixture is source scoped and UW-course only", () => {
  assert.deepEqual(seattleRemainingPlanIds, [
    "uw-seattle-aeronautics-astronautics",
    "uw-seattle-anthropology",
    "uw-seattle-aquatic-conservation-and-ecology",
    "uw-seattle-architectural-design",
    "uw-seattle-architectural-studies",
    "uw-seattle-art",
    "uw-seattle-art-history",
    "uw-seattle-asian-languages-and-cultures",
    "uw-seattle-asian-studies",
    "uw-seattle-atmospheric-and-climate-science",
    "uw-seattle-bioengineering",
    "uw-seattle-chemical-engineering",
    "uw-seattle-chinese",
    "uw-seattle-classical-studies",
    "uw-seattle-classics",
    "uw-seattle-comparative-history-of-ideas",
    "uw-seattle-comparative-religion",
    "uw-seattle-computational-finance-and-risk-management",
    "uw-seattle-construction-management",
    "uw-seattle-dance",
    "uw-seattle-danish",
    "uw-seattle-disability-studies",
    "uw-seattle-drama",
    "uw-seattle-earth-and-space-sciences",
    "uw-seattle-european-studies",
    "uw-seattle-finnish",
    "uw-seattle-food-systems-nutrition-and-health",
    "uw-seattle-french",
    "uw-seattle-geography",
    "uw-seattle-german",
    "uw-seattle-global-literary-studies",
    "uw-seattle-greek",
    "uw-seattle-guitar-b-m",
    "uw-seattle-human-centered-design-engineering",
    "uw-seattle-industrial-systems-engineering",
    "uw-seattle-italian",
    "uw-seattle-japanese",
    "uw-seattle-jazz-studies-b-m",
    "uw-seattle-jewish-studies",
    "uw-seattle-korean",
    "uw-seattle-latin",
    "uw-seattle-latin-american-and-caribbean-studies",
    "uw-seattle-linguistics",
    "uw-seattle-materials-science-engineering",
    "uw-seattle-middle-eastern-languages-and-cultures",
    "uw-seattle-music-b-a",
    "uw-seattle-music-composition-b-m",
    "uw-seattle-music-education-b-m",
    "uw-seattle-norwegian",
    "uw-seattle-oceanography",
    "uw-seattle-orchestral-instruments-b-m",
    "uw-seattle-organ-b-m",
    "uw-seattle-percussion-performance-b-m",
    "uw-seattle-philosophy",
    "uw-seattle-piano-b-m",
    "uw-seattle-real-estate",
    "uw-seattle-slavic-languages-and-literatures",
    "uw-seattle-sociology",
    "uw-seattle-south-asian-languages-and-cultures",
    "uw-seattle-speech-and-hearing-sciences",
    "uw-seattle-statistics",
    "uw-seattle-swedish",
    "uw-seattle-voice-b-m",
  ]);

  for (const program of seattleRemainingPrograms) {
    assert.equal(program.officialSources.length > 0, true, `${program.planId} needs sources`);
    const fixtureCodes = extractCourseCodesFromText(program.officialSources.join(" "));
    const communityCollegeCodes = fixtureCodes.filter((code) => /\b[A-Z]+&\s+\d/.test(code));
    assert.deepEqual(
      communityCollegeCodes,
      [],
      `${program.planId} fixture should contain UW course codes only`
    );
  }
});

diagnosticTest("complete diagnostics now cover every UW Seattle planner major", () => {
  const coveredPlanIds = getAllFixtureCoveredPlanIds();
  const missingSeattlePlanIds = getSeattlePlanIds().filter((planId) => !coveredPlanIds.has(planId));

  assert.deepEqual(
    missingSeattlePlanIds,
    [],
    [
      "Every Seattle planner major should now be represented by an opt-in complete diagnostic fixture.",
      `Missing: ${missingSeattlePlanIds.join(", ")}`,
    ].join("\n")
  );
});

diagnosticTest("cross-campus equivalents for remaining Seattle families are represented", () => {
  const planner = getPlanner();
  const coveredPlanIds = getAllFixtureCoveredPlanIds();
  const missingEquivalentPlans = [];
  const equivalentPlansWithoutCompleteFixture = [];

  for (const group of equivalentMajorGroups) {
    for (const planId of group.planIds) {
      if (!planner.getTransferPlannerMajorPlan(planId)) {
        missingEquivalentPlans.push(`${group.id}:${planId}`);
        continue;
      }
      if (!coveredPlanIds.has(planId)) {
        equivalentPlansWithoutCompleteFixture.push(`${group.id}:${planId}`);
      }
    }
  }

  assert.deepEqual(missingEquivalentPlans, []);
  assert.deepEqual(
    equivalentPlansWithoutCompleteFixture,
    [],
    [
      "Cross-campus equivalent plans should be represented by an opt-in complete diagnostic fixture.",
      `Missing complete fixture coverage: ${equivalentPlansWithoutCompleteFixture.join(", ")}`,
    ].join("\n")
  );
});

for (const program of seattleRemainingPrograms) {
  diagnosticTest(`${program.planId} keeps every official source link`, () => {
    assertTextIncludesAll(
      getCurrentPlanText(program.planId),
      program.officialSources,
      `${program.planId} official source links`
    );
  });

  diagnosticTest(`${program.planId} exposes reviewed source-declared UW course evidence`, () => {
    const sourceDeclaredCourses = getSourceDeclaredUwCourseCodes(program.planId);
    const requiredTextSnippets = program.requiredTextSnippets ?? [];
    assert.equal(
      sourceDeclaredCourses.length > 0 || requiredTextSnippets.length > 0,
      true,
      `${program.planId} should have source-declared UW courses or reviewed text evidence`
    );
  });

  onlineDiagnosticTest(`${program.planId} loads live official sources with reviewed source evidence overlap`, async () => {
    const sourceDeclaredCourses = getSourceDeclaredUwCourseCodes(program.planId);
    const requiredTextSnippets = program.requiredTextSnippets ?? [];
    const onlineText = await getOnlineSourceText(program);

    assert.equal(
      onlineText.length > 0,
      true,
      `${program.planId} should have live official source text to compare against reviewed evidence.`
    );

    if (sourceDeclaredCourses.length === 0) {
      assertTextIncludesAll(
        onlineText,
        requiredTextSnippets,
        `${program.planId} live official source text evidence`
      );
      return;
    }

    assertHasCourseOverlap(
      await getOnlineCourseCodes(program),
      sourceDeclaredCourses,
      `${program.planId} live official source course evidence overlap`
    );
  });

  diagnosticTest(`${program.planId} preserves every known pathway`, () => {
    assert.deepEqual(
      getRegisteredPathwayIds(program.planId),
      uniqueSorted((program.expectedPathwayIds ?? []).map(normalizePathwayId)),
      `${program.planId} should preserve the complete pathway set`
    );
  });

  diagnosticTest(`${program.planId} preserves reviewed text evidence`, () => {
    const requiredTextSnippets = program.requiredTextSnippets ?? [];
    const sourceDeclaredCourses = getSourceDeclaredUwCourseCodes(program.planId);

    if (requiredTextSnippets.length > 0 && sourceDeclaredCourses.length === 0) {
      assert.equal(
        hasNonSchedulableSourceEvidence(program.planId),
        true,
        [
          `${program.planId} text-only reviewed evidence should preserve a non-schedulable source status.`,
          "Exact reviewed wording is verified against the live official source by the online diagnostic.",
        ].join("\n")
      );
      return;
    }

    assertTextIncludesAll(
      getCurrentPlanText(program.planId),
      requiredTextSnippets,
      `${program.planId} reviewed text evidence`
    );
  });
}
