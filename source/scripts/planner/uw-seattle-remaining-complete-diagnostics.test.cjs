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
    .replace(/\bL\s+ARCH\b/g, "LARCH")
    .replace(/\bQ\s+SCI\b/g, "QSCI")
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
        ...(block.structuredOnlyUwCourseCodes ?? []),
        ...(block.approvedFilterUwCourseCodes ?? []),
        ...(block.electiveListUwCourseCodes ?? []),
      ])
      .map(normalizeCourseCode)
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

function extractCourseCodesFromText(text, allowedSubjects) {
  const matches =
    String(text ?? "").match(/\b[A-Z]{1,8}(?:\s+[A-Z]{1,8}){0,2}\s+\d{3}[A-Z]?\b/g) ?? [];
  return uniqueSorted(
    matches
      .map(normalizeCourseCode)
      .filter((code) => !/\b[A-Z]+&\s+\d/.test(code))
      .filter((code) => {
        if (!allowedSubjects || allowedSubjects.size === 0) return true;
        return allowedSubjects.has(code.replace(/\s+\d{3}[A-Z]?$/, ""));
      })
  );
}

function isExtractableSource(url) {
  return !/\.pdf(?:$|[?#])/i.test(url);
}

async function fetchSourceText(url) {
  if (sourceTextCache.has(url)) {
    return sourceTextCache.get(url);
  }

  const response = await fetchWithHandling(url, {
    operation: "Fetch Seattle diagnostic official source",
    throwOnHttpError: false,
    timeoutMs: 30000,
    userAgent: "GatorGuide transfer planner diagnostic/1.0",
  });
  assert.equal(response.ok, true, `Official source did not load: ${url} (${response.status})`);
  const html = await response.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
  sourceTextCache.set(url, text);
  return text;
}

async function getOnlineCourseCodes(program) {
  const sourceTexts = await Promise.all(
    program.officialSources.filter(isExtractableSource).map(fetchSourceText)
  );
  const sourceDeclaredSubjects = new Set(
    getSourceDeclaredUwCourseCodes(program.planId).map((code) =>
      code.replace(/\s+\d{3}[A-Z]?$/, "")
    )
  );
  return uniqueSorted(
    sourceTexts.flatMap((text) => extractCourseCodesFromText(text, sourceDeclaredSubjects))
  );
}

function assertIncludesAll(actualValues, expectedValues, label) {
  const actual = new Set(actualValues.map(normalizeCourseCode));
  const missing = expectedValues
    .map(normalizeCourseCode)
    .filter((expected) => !actual.has(expected));

  assert.equal(
    missing.length,
    0,
    [
      `${label} missing ${missing.length} expected UW course code(s).`,
      `Missing: ${missing.slice(0, 180).join(", ")}`,
      `Actual count: ${actual.size}`,
    ].join("\n")
  );
}

function assertTextIncludesAll(text, snippets, label) {
  const missing = snippets
    .map((snippet) => String(snippet ?? "").trim())
    .filter(Boolean)
    .filter((snippet) => !text.includes(normalizeText(snippet)));

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

  diagnosticTest(`${program.planId} exposes every source-declared UW course`, () => {
    const sourceDeclaredCourses = getSourceDeclaredUwCourseCodes(program.planId);
    if (sourceDeclaredCourses.length === 0) {
      assert.fail(`${program.planId} should have at least one source-declared UW course`);
    }
    assertIncludesAll(
      getParsedUwCourseCodes(program.planId),
      sourceDeclaredCourses,
      `${program.planId} parsed requirement-source blocks`
    );
  });

  onlineDiagnosticTest(`${program.planId} exposes every online official UW course`, async () => {
    const onlineCourses = await getOnlineCourseCodes(program);
    if (onlineCourses.length === 0) {
      return;
    }
    assertIncludesAll(
      getParsedUwCourseCodes(program.planId),
      onlineCourses,
      `${program.planId} parsed requirement-source blocks`
    );
  });

  diagnosticTest(`${program.planId} preserves every known pathway`, () => {
    assert.deepEqual(
      getRegisteredPathwayIds(program.planId),
      uniqueSorted((program.expectedPathwayIds ?? []).map(normalizePathwayId)),
      `${program.planId} should preserve the complete pathway set`
    );
  });

  diagnosticTest(`${program.planId} preserves UW Seattle gen-ed context`, () => {
    assertTextIncludesAll(
      getCurrentPlanText(program.planId),
      program.genEdSnippets ?? [],
      `${program.planId} UW Seattle gen-ed context`
    );
  });
}
