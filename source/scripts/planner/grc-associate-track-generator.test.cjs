const assert = require("node:assert/strict");
const test = require("node:test");

process.env.TS_NODE_TRANSPILE_ONLY = "true";
process.env.TS_NODE_BASEURL = process.env.TS_NODE_BASEURL || ".";
process.env.TS_NODE_COMPILER_OPTIONS =
  process.env.TS_NODE_COMPILER_OPTIONS ||
  JSON.stringify({
    module: "Node16",
    moduleResolution: "node16",
    jsx: "react-jsx",
    baseUrl: ".",
    paths: {
      "@/*": ["./*"],
    },
  });

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const {
  buildTrackFromProgramPage,
  materializeRemainingCatalogRequirementPlaceholderTerm,
  parseCreditRangeFromText,
} = require("./generate-transfer-planner-grc-associate-tracks.cjs");
const {
  TRANSFER_PLANNER_TRACKS,
} = require("../../constants/transfer-planner-source");
const {
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS,
} = require("../../constants/transfer-planner-source/grc-associate-tracks.generated");
const {
  buildSuggestedQuarterPlan,
  buildSuggestedQuarterRemainingCreditRange,
  extractCourseCodes,
} = require("../../services/planning/transfer-planner.service");

function buildGrcQuarterPlan(track) {
  return buildSuggestedQuarterPlan({
    plan: null,
    plannerCollegeId: "grc",
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
}

test("GRC catalog credit parsing keeps degree-level ranges without letting later subrequirements win", () => {
  assert.deepEqual(
    parseCreditRangeFromText(
      "Minimum of 102 Credits. To earn this degree, students must complete 102-103 quarter credits in courses numbered 100 or above."
    ),
    {
      minimumCredits: 102,
      maximumCredits: 103,
    }
  );

  assert.deepEqual(
    parseCreditRangeFromText(
      "180 Credits. General Education Requirements include a communication option where students select 3-5 credits."
    ),
    {
      minimumCredits: 180,
      maximumCredits: 180,
    }
  );
});

test("GRC generator materializes unresolved remaining catalog requirements as credit ranges", () => {
  const terms = materializeRemainingCatalogRequirementPlaceholderTerm(
    [
      {
        label: "Quarter 1 (15 credits)",
        courses: ["ACCT& 201", "BUS& 101", "ENGL& 101"],
      },
    ],
    {
      minimumCredits: 35,
      maximumCredits: 40,
    }
  );

  assert.equal(terms.length, 2);
  assert.deepEqual(terms[1], {
    label: "Remaining catalog requirements (20-25 credits)",
    courses: ["20-25 credits of remaining catalog requirements"],
    requirementRole: "remaining-credits",
    notes: [
      "Generated from the catalog credit range because the structured curriculum map leaves part of the required range unresolved.",
    ],
  });
});

test("GRC generator marks preparatory Quarter 0 rows as sample-only instead of required catalog rows", () => {
  const track = buildTrackFromProgramPage(
    {
      h1: "Associate in Science Transfer Track 1 - Chemistry",
      pagePathSlug: "stem-chemistry-associate-in-science-transfer-track-1-chemistry",
      duration: "90 Credits",
      url: "https://example.test/chemistry",
      degree: "Associate in Science Transfer Track 1",
      programType: "Associate",
    },
    {
      description: "",
      cores: [
        {
          name: "Quarter 0",
          sort_order: 0,
          courses: [
            { id: 1, sort_order: 1, title: "CHEM& 140" },
            { id: 2, sort_order: 2, title: "MATH& 141" },
          ],
        },
        {
          name: "Quarter 1 (15 credits)",
          sort_order: 1,
          courses: [
            { id: 3, sort_order: 1, title: "CHEM& 161" },
            { id: 4, sort_order: 2, title: "MATH& 151" },
            { id: 5, sort_order: 3, title: "ENGL& 101" },
          ],
        },
      ],
    }
  );

  const quarterZero = track.terms.find((term) => term.label === "Quarter 0");
  const remainingCatalogTerm = track.terms.find(
    (term) => term.requirementRole === "remaining-credits"
  );
  assert.equal(quarterZero?.requirementRole, "sample-only");
  assert.equal(quarterZero?.sampleOnly, true);
  assert.equal(quarterZero?.canCreateScheduleRows, false);
  assert.equal(remainingCatalogTerm?.label, "Remaining catalog requirements (75 credits)");
  assert.equal(track.sampleSchedule.scheduledMaxCredits, 90);
});

test("GRC runtime preserves open-minimum uncertainty when unresolved options remain", () => {
  const track = TRANSFER_PLANNER_TRACKS.find(
    (entry) => entry.id === "grc-associate-fine-arts-humanities-arts-afa-concentration-ceramics"
  );
  assert.ok(track, "Expected generated AFA ceramics track.");

  const range = buildSuggestedQuarterRemainingCreditRange({
    quarters: buildGrcQuarterPlan(track),
    track,
  });

  assert.equal(range.catalogMinimumCredits, 103);
  assert.equal(range.catalogMaximumCredits, null);
  assert.equal(range.hasUnresolvedOptions, true);
  assert.ok(
    range.maxRemainingCredits > range.minRemainingCredits,
    "Open-minimum catalogs with unresolved placeholders should not collapse to a single display."
  );
});

test("GRC generated sample defaults stay explicit and do not push required rows over catalog maximum", () => {
  const track = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find(
    (entry) =>
      entry.id ===
      "grc-associate-stem-engineering-associate-in-science-transfer-track-2-bioengineering-and-chemical-engineering"
  );
  assert.ok(track, "Expected generated AST-2 Bio/Chem track.");
  assert.deepEqual(track.catalogCreditRange?.minimumCredits, 102);
  assert.deepEqual(track.catalogCreditRange?.maximumCredits, 103);
  assert.ok(
    (track.groupedChoices ?? []).some((choice) => (choice.defaultOptionIds ?? []).length > 0),
    "Expected grouped choices to retain sample-default metadata."
  );

  const quarterZero = track.terms.find((term) => term.label === "Quarter 0");
  assert.equal(quarterZero?.sampleOnly, true);
  assert.equal(quarterZero?.canCreateScheduleRows, false);

  const quarters = buildGrcQuarterPlan(track);
  const plannedCodes = new Set(
    quarters.flatMap((quarter) =>
      quarter.courses.flatMap((course) => extractCourseCodes(course.label))
    )
  );
  assert.equal(plannedCodes.has("CHEM& 140"), false);

  const range = buildSuggestedQuarterRemainingCreditRange({ quarters, track });
  assert.equal(range.catalogMinimumCredits, 102);
  assert.equal(range.catalogMaximumCredits, 103);
  assert.equal(range.minRemainingCredits, 102);
  assert.equal(range.maxRemainingCredits, 103);
  assert.ok(range.scheduledMaxRemainingCredits <= 103);
});
