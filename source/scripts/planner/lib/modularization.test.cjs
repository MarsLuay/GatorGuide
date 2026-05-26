const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createParserShapeDetection,
  detectOptionCue,
  detectOptionCueOrNone,
  parseChoiceRequiredCount,
  stripLeadingRequirementGlyphs,
} = require("./parser-shape-detection.cjs");
const {
  classifyGeneratedSeedIssue,
  classifyCoverageIssue,
  isNonSchedulableContextualSourceRow,
  isSupportOrNonSchedulableGeneratedSourceRole,
} = require("./source-backed-audit-classification.cjs");
const {
  serializeJsonReport,
  serializeMarkdownLines,
  writeJsonReport,
  writeMarkdownReport,
} = require("./planner-reporting.cjs");
const {
  createSourceDownloader,
  parseRetryAfterToMs,
} = require("./source-fetching.cjs");
const {
  buildRequirementSourceScope,
  canParsedBlockCreateSchedulableRows,
  canRequirementSourceRoleCreateSchedulableRows,
  getRequirementSourceRoleStatus,
} = require("./source-scope.cjs");
const {
  buildParserRecoveryMarkdownReport,
  buildRequirementSourceParseMarkdownReport,
} = require("./parser-reporting.cjs");
const {
  writeMappingAuditReports,
} = require("./source-backed-audit-reporting.cjs");

function buildResponse(input) {
  return {
    ok: input.ok,
    status: input.status ?? (input.ok ? 200 : 503),
    statusText: input.statusText ?? (input.ok ? "OK" : "Unavailable"),
    headers: {
      get(name) {
        return input.headers?.[String(name).toLowerCase()] ?? null;
      },
    },
    text: async () => input.text ?? "",
    arrayBuffer: async () => Buffer.from(input.text ?? ""),
  };
}

test("parser shape detection is reusable without importing the full parser", () => {
  const detector = createParserShapeDetection({
    extractCourseCodesFromLine(line) {
      return /\bMATH\s+1\d{2}\b/i.test(line) ? ["MATH 124"] : [];
    },
  });

  assert.equal(
    detector.looksLikeStandaloneRequirementLabelLine("• Programming 5 credits"),
    true
  );
  assert.equal(
    detector.looksLikeStandaloneRequirementLabelLine("MATH 124 Calculus 5 credits"),
    false
  );
  assert.equal(
    detector.looksLikeStandaloneRequirementTitleLine("[Page 2] Linear Algebra"),
    true
  );
  assert.equal(stripLeadingRequirementGlyphs("• Statistics"), "Statistics");
  assert.equal(detectOptionCue("Choose two from the following list"), "choose count");
  assert.equal(detectOptionCueOrNone("No option language here"), "none");
  assert.equal(parseChoiceRequiredCount("Select three courses from the list"), 3);
});

test("source-backed audit row classification is isolated from report construction", () => {
  assert.equal(
    isNonSchedulableContextualSourceRow({
      sourceHeading: "Relevant engineering electives",
      sourceRowText: "These do not count toward required coursework.",
    }),
    true
  );
  assert.equal(
    classifyCoverageIssue({
      visibleCourseCodes: [],
      grcEquivalents: ["MATH& 151"],
      parsedUwCourseCodes: ["MATH 124"],
      generatedRuntimeRow: false,
      visibleInTransferOnlyPlan: false,
    }),
    "missing-detected-course"
  );
  assert.equal(
    classifyCoverageIssue({
      visibleCourseCodes: [],
      grcEquivalents: [],
      parsedUwCourseCodes: ["MATH 124"],
      generatedRuntimeRow: false,
      visibleInTransferOnlyPlan: false,
    }),
    null
  );
  assert.equal(
    isSupportOrNonSchedulableGeneratedSourceRole("approved-course-list"),
    true
  );
  assert.equal(
    classifyGeneratedSeedIssue({
      canCreateScheduleRow: true,
      generatedGrcCourseCodes: ["MATH& 151"],
      sourceRole: "approved-course-list",
      sourceScope: "support-only",
      sourceUrl: "https://example.edu/list",
    }),
    "approved-list-generated-required-row"
  );
});

test("parser report writers are reusable without importing the full parser", () => {
  const recoveryMarkdown = buildParserRecoveryMarkdownReport({
    generatedAt: "2026-01-01T00:00:00.000Z",
    triggeredOwnerCount: 1,
    successfulOwnerCount: 0,
    unrecoveredOwnerCount: 1,
    recoveredScheduledSourceOwnerCount: 0,
    recoveredSupportSourceOwnerCount: 0,
    countsByTriggerCode: { "no-parsed-uw-course-codes": 1 },
    countsByAttemptedStrategy: { "catalog-anchor": 1 },
    countsByBlockerType: { "no-candidate-source": 1 },
    owners: [],
  });

  assert.match(recoveryMarkdown, /Parser Recovery Report/);
  assert.match(recoveryMarkdown, /no-parsed-uw-course-codes: 1/);

  const parseMarkdown = buildRequirementSourceParseMarkdownReport(
    {
      generatedAt: "2026-01-01T00:00:00.000Z",
      totalOwners: 1,
      okCount: 1,
      failedCount: 0,
      parsedRequirementSourceBlockCount: 1,
      parsedRequirementAtomCandidateCount: 0,
      parsedDegreeMapBlockCandidateCount: 0,
      parsedRequirementCourseCount: 0,
      snapshotFallbackCount: 0,
      countsByAdapterId: { html: 1 },
      countsByResolutionStrategy: { primary: 1 },
      countsBySourceRole: { "primary-degree-requirements": 1 },
      countsBySourceRoleStatus: { primary: 1 },
      countsByQualitySignalCode: {},
      withParsedCourseCodesCount: 1,
      withSourceOnlyCourseCodesCount: 0,
      withNoParsedCourseCodesCount: 0,
      ownersWithQualityWarningsCount: 0,
      ownersWithQualityNotesCount: 0,
      parserRecoveryReport: {
        triggeredOwnerCount: 0,
        successfulOwnerCount: 0,
        unrecoveredOwnerCount: 0,
        recoveredScheduledSourceOwnerCount: 0,
        recoveredSupportSourceOwnerCount: 0,
      },
      owners: [
        {
          campusId: "uw-seattle",
          ownerTitle: "Example",
          sourceUrl: "https://example.edu/source",
          primarySourceUrl: "https://example.edu/source",
          parserType: "html",
          sourceRole: "primary-degree-requirements",
          sourceRoleStatus: "primary",
          canCreateSchedulableRows: true,
          adapterId: "html",
          resolutionStrategy: "primary",
          parseConfidence: "high",
          usedSnapshotFallback: false,
          sourceOnlyUwCourseCodes: [],
          structuredOnlyUwCourseCodes: [],
          requirementCueLines: [],
          qualitySignals: [],
          ok: true,
          parsedUwCourseCodes: ["MATH 124"],
        },
      ],
    },
    {
      campusOrder: ["uw-seattle"],
      recoveryMarkdownPath: ".tmp/recovery.md",
    }
  );

  assert.match(parseMarkdown, /Requirement Source Parse Report/);
  assert.match(parseMarkdown, /Detailed report: \.tmp\/recovery\.md/);
});

test("source scope role rules are shared by parser and audit modules", () => {
  assert.equal(getRequirementSourceRoleStatus("primary-degree-requirements"), "primary");
  assert.equal(getRequirementSourceRoleStatus("approved-course-list"), "support");
  assert.equal(
    getRequirementSourceRoleStatus("upper-division-prerequisite-table"),
    "non-schedulable"
  );
  assert.equal(canRequirementSourceRoleCreateSchedulableRows("department-requirements"), true);
  assert.equal(canRequirementSourceRoleCreateSchedulableRows("elective-list"), false);

  const supportScope = buildRequirementSourceScope("approved-course-list");
  assert.equal(supportScope.supportOnly, true);
  assert.equal(supportScope.canCreateApprovedFilters, true);
  assert.equal(supportScope.canCreateRequiredRows, false);
  assert.equal(
    canParsedBlockCreateSchedulableRows({ sourceRole: "primary-degree-requirements" }),
    true
  );
  assert.equal(canParsedBlockCreateSchedulableRows({ sourceRole: "elective-list" }), false);
});

test("planner report helpers serialize JSON and markdown consistently", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gatorguide-report-"));
  const jsonPath = path.join(tempDir, "nested", "report.json");
  const markdownPath = path.join(tempDir, "nested", "report.md");

  try {
    assert.equal(serializeJsonReport({ ok: true }), '{\n  "ok": true\n}\n');
    assert.equal(serializeMarkdownLines(["# Title", "", "Body"]), "# Title\n\nBody\n");

    writeJsonReport(jsonPath, { ok: true });
    writeMarkdownReport(markdownPath, ["# Title", "Body"]);
    writeMappingAuditReports(
      {
        generatedAt: "2026-01-01T00:00:00.000Z",
        outcome: "passed",
        summary: {
          mappingRegressionRowCount: 1,
          mappingRegressionIssueCount: 0,
          issueCountsByType: {},
        },
        mappingRegressionRows: [
          {
            issue: "none",
            copyOnlyDebugText: "[mapping] ok",
          },
        ],
      },
      {
        jsonPath: path.join(tempDir, "mapping.json"),
        markdownPath: path.join(tempDir, "mapping.md"),
      }
    );

    assert.equal(fs.readFileSync(jsonPath, "utf8"), '{\n  "ok": true\n}\n');
    assert.equal(fs.readFileSync(markdownPath, "utf8"), "# Title\nBody\n");
    assert.match(
      fs.readFileSync(path.join(tempDir, "mapping.md"), "utf8"),
      /UW-GRC Mapping Regression Audit/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("source downloader retries fetches, caches successes, and falls back to curl", async () => {
  assert.equal(parseRetryAfterToMs("2", 1000), 2000);
  assert.equal(parseRetryAfterToMs("bad-date", 1000), null);

  let fetchCalls = 0;
  const downloader = createSourceDownloader({
    hostCooldownMs: 0,
    retryAttempts: 2,
    fetch: async () => {
      fetchCalls += 1;
      return fetchCalls === 1
        ? buildResponse({ ok: false, status: 503 })
        : buildResponse({ ok: true, text: "downloaded" });
    },
    execFileAsync: async () => {
      throw new Error("curl should not run after fetch succeeds");
    },
  });

  assert.deepEqual(await downloader.downloadSource("https://example.edu/page", 1000), {
    body: "downloaded",
    fetchMode: "fetch",
  });
  assert.deepEqual(await downloader.downloadSource("https://example.edu/page", 1000), {
    body: "downloaded",
    fetchMode: "fetch",
  });
  assert.equal(fetchCalls, 2);

  const fallbackDownloader = createSourceDownloader({
    hostCooldownMs: 0,
    retryAttempts: 1,
    fetch: async () => buildResponse({ ok: false, status: 403, statusText: "Forbidden" }),
    execFileAsync: async () => ({ stdout: "curl body" }),
  });

  assert.deepEqual(await fallbackDownloader.downloadSource("https://example.edu/blocked", 1000), {
    body: "curl body",
    fetchMode: "curl",
  });
});
