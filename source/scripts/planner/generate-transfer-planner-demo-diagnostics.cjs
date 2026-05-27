#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const {
  array,
  getExpectedCourseCodesFromProgram,
  getPlanner,
  loadCompleteDiagnosticPrograms,
  loadCurrentBootstrapPlans,
  uniqueSorted,
} = require("./lib/test-harness.cjs");

const SOURCE_ROOT = path.resolve(__dirname, "../..");
const OUTPUT_PATH = path.join(
  SOURCE_ROOT,
  "constants",
  "transfer-planner-source",
  "demo",
  "complete-diagnostics.generated.json"
);
const NON_MAJOR_DEMO_OFFICIAL_SOURCE_URLS = new Set([
  "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
]);
const DEMO_OFFICIAL_SOURCE_FALLBACKS_BY_PLAN_ID = {
  "uw-seattle-asian-studies": [
    "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html",
  ],
  "uw-seattle-greek": [
    "https://www.washington.edu/students/gencat/program/S/Classics-118.html",
  ],
  "uw-seattle-guitar-b-m": [
    "https://www.washington.edu/students/gencat/program/S/Music-217.html",
  ],
  "uw-seattle-history": [
    "https://www.washington.edu/students/gencat/program/S/History-193.html",
  ],
  "uw-seattle-japanese": [
    "https://www.washington.edu/students/gencat/program/S/AsianLanguagesandLiterature-144.html",
  ],
  "uw-seattle-jazz-studies-b-m": [
    "https://www.washington.edu/students/gencat/program/S/Music-217.html",
  ],
  "uw-seattle-jewish-studies": [
    "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html",
  ],
  "uw-seattle-korean": [
    "https://www.washington.edu/students/gencat/program/S/AsianLanguagesandLiterature-144.html",
  ],
  "uw-seattle-latin": [
    "https://www.washington.edu/students/gencat/program/S/Classics-118.html",
  ],
  "uw-seattle-latin-american-and-caribbean-studies": [
    "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html",
  ],
  "uw-seattle-linguistics": ["https://www.washington.edu/students/gencat/academic/ling.html"],
  "uw-seattle-medical-laboratory-science": [
    "https://www.washington.edu/students/gencat/academic/labm.html",
  ],
  "uw-seattle-music-b-a": [
    "https://www.washington.edu/students/gencat/program/S/Music-217.html",
  ],
  "uw-seattle-music-composition-b-m": [
    "https://www.washington.edu/students/gencat/program/S/Music-217.html",
  ],
  "uw-seattle-music-education-b-m": [
    "https://www.washington.edu/students/gencat/program/S/Music-217.html",
  ],
  "uw-seattle-norwegian": ["https://www.washington.edu/students/gencat/academic/scand.html"],
  "uw-seattle-orchestral-instruments-b-m": [
    "https://www.washington.edu/students/gencat/program/S/Music-217.html",
  ],
  "uw-seattle-organ-b-m": [
    "https://www.washington.edu/students/gencat/program/S/Music-217.html",
  ],
  "uw-seattle-percussion-performance-b-m": [
    "https://www.washington.edu/students/gencat/program/S/Music-217.html",
  ],
  "uw-seattle-piano-b-m": [
    "https://www.washington.edu/students/gencat/program/S/Music-217.html",
  ],
  "uw-seattle-psychology": [
    "https://www.washington.edu/students/gencat/program/S/Psychology-262.html",
  ],
  "uw-seattle-slavic-languages-and-literatures": [
    "https://www.washington.edu/students/gencat/academic/slavic.html",
  ],
  "uw-seattle-spanish": ["https://www.washington.edu/students/gencat/academic/spanport.html"],
  "uw-seattle-statistics": ["https://www.washington.edu/students/gencat/academic/stat.html"],
  "uw-seattle-swedish": ["https://www.washington.edu/students/gencat/academic/scand.html"],
  "uw-seattle-voice-b-m": [
    "https://www.washington.edu/students/gencat/program/S/Music-217.html",
  ],
};

function compactString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compactStrings(values) {
  return uniqueSorted(array(values).map(compactString).filter(Boolean));
}

function getSourceDeclaredCourseCodes(planId) {
  const planner = getPlanner();
  return compactStrings(
    (planner.getTransferPlannerParsedRequirementSourceBlocks(planId) ?? []).flatMap((block) => [
      ...(block.parsedUwCourseCodes ?? []),
      ...(block.sourceOnlyUwCourseCodes ?? []),
      ...(block.approvedFilterUwCourseCodes ?? []),
      ...(block.electiveListUwCourseCodes ?? []),
    ])
  );
}

function toTitleWord(word, index) {
  const normalized = compactString(word).toLowerCase();
  if (!normalized) return "";

  const acronyms = new Map([
    ["ba", "BA"],
    ["bs", "BS"],
    ["bsn", "BSN"],
    ["gis", "GIS"],
    ["it", "IT"],
    ["rn", "RN"],
  ]);
  if (acronyms.has(normalized)) {
    return acronyms.get(normalized);
  }

  if (index > 0 && ["and", "for", "in", "of", "to"].includes(normalized)) {
    return normalized;
  }

  return `${normalized.slice(0, 1).toUpperCase()}${normalized.slice(1)}`;
}

function titleFromPlanId(planId) {
  return compactString(planId)
    .replace(/^uw-(?:seattle|bothell|tacoma)-/, "")
    .split("-")
    .map(toTitleWord)
    .filter(Boolean)
    .join(" ");
}

function compactOptions(options) {
  return array(options)
    .map((option) => compactStrings(option))
    .filter((option) => option.length > 0);
}

function compactOptionGroups(groups) {
  return array(groups)
    .map((group) => ({
      id: compactString(group.id),
      label: compactString(group.label),
      options: compactOptions(group.options),
    }))
    .filter((group) => group.id || group.label || group.options.length);
}

function compactCourseBuckets(buckets) {
  return array(buckets)
    .map((bucket) => ({
      id: compactString(bucket.id),
      label: compactString(bucket.label),
      ...(Number.isFinite(bucket.minCredits) ? { minCredits: bucket.minCredits } : {}),
      courseCodes: compactStrings(bucket.courseCodes),
    }))
    .filter((bucket) => bucket.id || bucket.label || bucket.courseCodes.length);
}

function compactPathwayGroups(groups) {
  return array(groups)
    .map((group) => ({
      id: compactString(group.id),
      label: compactString(group.label),
      suggestedCourses: compactStrings(group.suggestedCourses),
      capstoneCourses: compactStrings(group.capstoneCourses),
      enrichingCourses: compactStrings(group.enrichingCourses),
    }))
    .filter(
      (group) =>
        group.id ||
        group.label ||
        group.suggestedCourses.length ||
        group.capstoneCourses.length ||
        group.enrichingCourses.length
    );
}

function compactProgram(program, bootstrapPlan) {
  const planId = compactString(program.planId);
  const sourceDeclaredCourseCodes = getSourceDeclaredCourseCodes(program.planId);
  const fixtureExpectedCourseCodes = getExpectedCourseCodesFromProgram(program);
  const officialSources = compactStrings([
    ...array(program.officialSources).filter(
      (url) => !NON_MAJOR_DEMO_OFFICIAL_SOURCE_URLS.has(compactString(url))
    ),
    ...(DEMO_OFFICIAL_SOURCE_FALLBACKS_BY_PLAN_ID[planId] ?? []),
  ]);

  return {
    campusId: compactString(program.campusId) || compactString(bootstrapPlan?.campusId),
    planId,
    title:
      compactString(program.title) ||
      compactString(bootstrapPlan?.title) ||
      titleFromPlanId(program.planId),
    family: compactString(program.family),
    fixtureFile: compactString(program.fixtureFile),
    fixtureExport: compactString(program.fixtureExport),
    officialSources,
    expectedPathwayIds: compactStrings(program.expectedPathwayIds),
    expectedCourseCodes: compactStrings([...fixtureExpectedCourseCodes, ...sourceDeclaredCourseCodes]),
    sourceDeclaredCourseCodes,
    requiredCourseCodes: compactStrings(program.requiredCourseCodes),
    optionGroups: compactOptionGroups(program.optionGroups),
    courseBuckets: compactCourseBuckets(program.courseBuckets),
    pathwayGroups: compactPathwayGroups(program.pathwayGroups),
    genEdRequirements: compactStrings(program.genEdRequirements),
    requirementLabels: compactStrings([
      ...array(program.requirementLabels),
      ...array(program.publicAdmissionsLabels),
    ]),
    publicAdmissionsLabels: compactStrings(program.publicAdmissionsLabels),
    requiredTextSnippets: compactStrings(program.requiredTextSnippets),
    genEdSnippets: compactStrings(program.genEdSnippets),
  };
}

function main() {
  const bootstrapPlans = loadCurrentBootstrapPlans();
  const bootstrapPlanById = new Map(bootstrapPlans.map((plan) => [plan.id, plan]));
  const bootstrapPlanIds = new Set(bootstrapPlans.map((plan) => plan.id));
  const { fixtureFiles, programs } = loadCompleteDiagnosticPrograms();
  const programsByPlanId = {};

  for (const rawProgram of programs) {
    const bootstrapPlan = bootstrapPlanById.get(compactString(rawProgram.planId));
    const program = compactProgram(rawProgram, bootstrapPlan);
    if (!program.planId || !bootstrapPlanIds.has(program.planId)) {
      continue;
    }
    programsByPlanId[program.planId] = programsByPlanId[program.planId] ?? [];
    programsByPlanId[program.planId].push(program);
  }

  const reviewedPlanIds = Object.keys(programsByPlanId).sort((left, right) =>
    left.localeCompare(right)
  );
  const missingPlanIds = [...bootstrapPlanIds]
    .filter((planId) => !programsByPlanId[planId]?.length)
    .sort((left, right) => left.localeCompare(right));
  const emittedProgramEntryCount = Object.values(programsByPlanId).reduce(
    (sum, planPrograms) => sum + planPrograms.length,
    0
  );

  if (missingPlanIds.length) {
    throw new Error(
      `Complete diagnostic demo data is missing ${missingPlanIds.length} plan(s): ${missingPlanIds.join(
        ", "
      )}`
    );
  }

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      fixtureFiles,
      reviewKind: "complete-diagnostics",
    },
    summary: {
      reviewedMajorCount: reviewedPlanIds.length,
      fixtureFileCount: fixtureFiles.length,
      programEntryCount: emittedProgramEntryCount,
    },
    reviewedPlanIds,
    programsByPlanId,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload)}\n`, "utf8");
  console.log(`Wrote ${path.relative(SOURCE_ROOT, OUTPUT_PATH)}`);
  console.log(`Reviewed majors: ${reviewedPlanIds.length}`);
}

main();
