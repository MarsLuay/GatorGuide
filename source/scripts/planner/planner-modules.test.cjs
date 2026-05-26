const assert = require("assert");
const test = require("node:test");

const {
  createParserShapeDetection,
  detectOptionCue,
  parseChoiceRequiredCount,
} = require("./lib/parser-shape-detection.cjs");
const {
  buildCurlErrorMessage,
  createSourceDownloader,
  isRetryableHttpStatus,
  parseRetryAfterToMs,
} = require("./lib/source-fetching.cjs");
const {
  serializeJsonReport,
  serializeMarkdownLines,
} = require("./lib/planner-reporting.cjs");
const {
  classifyCoverageIssue,
  isLowerDivisionCourseCode,
  isNonSchedulableContextualSourceRow,
} = require("./lib/source-backed-audit-classification.cjs");
const {
  buildRequirementSourceScope,
  canParsedBlockCreateSchedulableRows,
  canRequirementSourceRoleCreateSchedulableRows,
  flattenRequirementSourceScope,
  getBlockScopeBoolean,
  getRequirementSourceRoleStatus,
  isBlockNonSchedulable,
  isBlockSupportOnly,
} = require("./lib/source-scope.cjs");

test("parser shape helpers identify standalone requirement labels without course rows", () => {
  const shape = createParserShapeDetection({
    extractCourseCodesFromLine: (line) => (/\b[A-Z&]{2,}\s+\d{3}[A-Z]?\b/.test(line) ? ["MATH 124"] : []),
  });

  assert.equal(shape.looksLikeStandaloneRequirementLabelLine("[Page 2] Programming 5 credits"), true);
  assert.equal(shape.looksLikeStandaloneRequirementLabelLine("\u2022 Programming 5 credits"), true);
  assert.equal(shape.looksLikeStandaloneRequirementTitleLine("Engineering Fundamentals"), true);
  assert.equal(shape.looksLikeStandaloneRequirementTitleLine("MATH 124 Calculus I"), false);
  assert.equal(detectOptionCue("Choose one sequence from the following"), "choose one sequence");
  assert.equal(parseChoiceRequiredCount("Select three courses from the approved list"), 3);
});

test("source fetching helpers parse retry metadata and cache successful downloads", async () => {
  assert.equal(parseRetryAfterToMs("2", 1_000), 2_000);
  assert.equal(parseRetryAfterToMs("not a date", 1_000), null);
  assert.equal(isRetryableHttpStatus(429), true);
  assert.equal(isRetryableHttpStatus(404), false);
  assert.equal(
    buildCurlErrorMessage({ stderr: "curl: blocked" }, "https://example.test"),
    "curl: blocked"
  );

  let fetchCount = 0;
  const { downloadSource } = createSourceDownloader({
    fetch: async () => {
      fetchCount += 1;
      return {
        ok: true,
        headers: { get: () => null },
        text: async () => "source body",
        arrayBuffer: async () => Buffer.from("source body"),
      };
    },
    hostCooldownMs: 0,
  });

  assert.deepEqual(await downloadSource("https://example.test/page", 100), {
    body: "source body",
    fetchMode: "fetch",
  });
  assert.deepEqual(await downloadSource("https://example.test/page", 100), {
    body: "source body",
    fetchMode: "fetch",
  });
  assert.equal(fetchCount, 1);
});

test("reporting helpers keep stable trailing newlines", () => {
  assert.equal(serializeJsonReport({ ok: true }), "{\n  \"ok\": true\n}\n");
  assert.equal(serializeMarkdownLines(["# Title", "", "- Item"]), "# Title\n\n- Item\n");
});

test("source-backed audit classification keeps coverage decisions isolated", () => {
  assert.equal(isLowerDivisionCourseCode("MATH 124"), true);
  assert.equal(isLowerDivisionCourseCode("BIOL 355"), false);
  assert.equal(
    isNonSchedulableContextualSourceRow({
      sourceRowText: "Relevant engineering electives do not count toward required credits.",
    }),
    true
  );
  assert.equal(
    classifyCoverageIssue({
      nonSchedulableContextualSourceRow: true,
      representedUnselectedRuntimeOption: false,
      representedRuntimeUwOnlyOption: false,
      scheduledVisibleCourseCodes: [],
      visibleCourseCodes: [],
      groupedChoiceMax: null,
      grcEquivalents: ["MATH& 151"],
      parsedUwCourseCodes: ["MATH 124"],
      generatedRuntimeRow: null,
      visibleInTransferOnlyPlan: false,
    }),
    null
  );
  assert.equal(
    classifyCoverageIssue({
      nonSchedulableContextualSourceRow: false,
      representedUnselectedRuntimeOption: false,
      representedRuntimeUwOnlyOption: false,
      scheduledVisibleCourseCodes: ["MATH& 151", "MATH& 152"],
      visibleCourseCodes: ["MATH& 151", "MATH& 152"],
      groupedChoiceMax: 1,
      grcEquivalents: ["MATH& 151", "MATH& 152"],
      parsedUwCourseCodes: ["MATH 124", "MATH 125"],
      generatedRuntimeRow: true,
      visibleInTransferOnlyPlan: true,
    }),
    "over-scheduled-alternatives"
  );
  assert.equal(
    classifyCoverageIssue({
      nonSchedulableContextualSourceRow: false,
      representedUnselectedRuntimeOption: false,
      representedRuntimeUwOnlyOption: false,
      scheduledVisibleCourseCodes: [],
      visibleCourseCodes: [],
      groupedChoiceMax: null,
      grcEquivalents: ["MATH& 151"],
      parsedUwCourseCodes: ["MATH 124"],
      generatedRuntimeRow: null,
      visibleInTransferOnlyPlan: false,
    }),
    "missing-detected-course"
  );
  assert.equal(
    classifyCoverageIssue({
      nonSchedulableContextualSourceRow: false,
      representedUnselectedRuntimeOption: false,
      representedRuntimeUwOnlyOption: false,
      scheduledVisibleCourseCodes: [],
      visibleCourseCodes: [],
      groupedChoiceMax: null,
      grcEquivalents: [],
      parsedUwCourseCodes: ["MATH 124"],
      generatedRuntimeRow: null,
      visibleInTransferOnlyPlan: false,
    }),
    null
  );
});

test("source scope helpers keep parser and audit role contracts shared", () => {
  assert.equal(getRequirementSourceRoleStatus("primary-degree-requirements"), "primary");
  assert.equal(getRequirementSourceRoleStatus("approved-course-list"), "support");
  assert.equal(getRequirementSourceRoleStatus("upper-division-prerequisite-table"), "non-schedulable");
  assert.equal(canRequirementSourceRoleCreateSchedulableRows("pathway-degree-sheet"), true);
  assert.equal(canRequirementSourceRoleCreateSchedulableRows("elective-list"), false);

  const approvedScope = buildRequirementSourceScope("approved-course-list");
  assert.equal(approvedScope.supportOnly, true);
  assert.equal(approvedScope.canCreateApprovedFilters, true);
  assert.equal(approvedScope.canCreateRequiredRows, false);
  assert.deepEqual(flattenRequirementSourceScope(approvedScope), {
    sourceScope: approvedScope,
    canCreateRequiredRows: false,
    canCreateOptionGroups: false,
    canCreateCreditBuckets: false,
    canCreateCategoryOptions: false,
    canCreateApprovedFilters: true,
    canCreateElectiveLists: false,
    canCreateSequencingHints: false,
    canCreateAdmissionPrepRows: false,
    canCreateScheduleRows: false,
    supportOnly: true,
    nonSchedulable: false,
  });

  assert.equal(isBlockSupportOnly({ sourceRole: "elective-list" }), true);
  assert.equal(isBlockNonSchedulable({ sourceRole: "old-archival" }), true);
  assert.equal(
    getBlockScopeBoolean(
      { sourceScope: { canCreateApprovedFilters: true } },
      "canCreateApprovedFilters",
      false
    ),
    true
  );
  assert.equal(
    canParsedBlockCreateSchedulableRows({ sourceRole: "primary-degree-requirements" }),
    true
  );
  assert.equal(canParsedBlockCreateSchedulableRows({ sourceRole: "approved-course-list" }), false);
});
