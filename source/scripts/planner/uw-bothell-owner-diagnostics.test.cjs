const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ensureTmpLayout, getTmpPath } = require("../lib/tmp-layout.cjs");
const test = require("node:test");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = ensureTmpLayout(REPO_ROOT).root;
const FIXTURE_PATH = path.join(
  __dirname,
  "fixtures",
  "uw-bothell-owner-diagnostics.json"
);

function readJson(relativeOrAbsolutePath) {
  const filePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.join(REPO_ROOT, relativeOrAbsolutePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

const fixture = readJson(FIXTURE_PATH);
const ownerAuditReport = readJson(getTmpPath(REPO_ROOT, "transfer-planner-owner-audit.json"));
const parseReport = readJson(
  getTmpPath(REPO_ROOT, "transfer-planner-requirement-source-parse-report.json")
);
const statusReport = readJson(getTmpPath(REPO_ROOT, "transfer-planner-status.json"));

const campusId = fixture.campusId;
const auditedOwners = (ownerAuditReport.owners ?? []).filter(
  (owner) => owner.campusId === campusId
);
const parseOwners = (parseReport.owners ?? []).filter((owner) => owner.campusId === campusId);
const statusRows = (statusReport.inventory ?? []).filter((row) => row.campusId === campusId);

const auditedOwnerIds = new Set(auditedOwners.map((owner) => owner.ownerId));
const parseOwnerById = new Map(parseOwners.map((owner) => [owner.ownerId, owner]));
const statusRowByOwnerId = new Map(statusRows.map((row) => [row.ownerId, row]));
const auditedOwnerById = new Map(auditedOwners.map((owner) => [owner.ownerId, owner]));

function normalizeCourseCode(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .toUpperCase()
    .replace(/\bB\s+(BUS|BECN|HLTH|MATH|NURS|WRIT)\b/g, "B$1")
    .replace(/\bT\s+INFO\b/g, "TINFO")
    .replace(/\bCSS\s+SKL\b/g, "CSSSKL")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^([A-Z&]+)\s*(\d{3}|4XX)$/i, "$1 $2");
}

function normalizeCourseCodes(values) {
  return Array.from(new Set((values ?? []).map(normalizeCourseCode).filter(Boolean))).sort();
}

function normalizeSourceText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\bB\s+(BUS|BECN|HLTH|MATH|NURS|WRIT)\b/gi, (_, dept) => `B${dept}`)
    .replace(/\bT\s+INFO\b/gi, "TINFO")
    .replace(/\bCSS\s+SKL\b/gi, "CSSSKL")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function hasCourseCode(sourceText, courseCode) {
  const normalizedCode = normalizeCourseCode(courseCode);
  if (!normalizedCode) {
    return false;
  }
  const [prefix, number] = normalizedCode.split(" ");
  const pattern = new RegExp(`\\b${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*${number}\\b`);
  return pattern.test(normalizeSourceText(sourceText));
}

function hasLinkedSource(sourceText, expectedUrl) {
  const source = String(sourceText ?? "").toLowerCase();
  const url = new URL(expectedUrl);
  const pathSlug = path.basename(url.pathname).replace(/\.[a-z0-9]+$/i, "");
  const labelFallbacks = new Map([
    ["accounting", ["accounting"]],
    ["entrepreneurship", ["entrepreneurship"]],
    ["finance-option", ["finance"]],
    ["leadership", ["leadership", "strategic innovation"]],
    ["management", ["management"]],
    ["marketing", ["marketing"]],
    ["mis", ["mis", "management information systems"]],
    ["retail", ["retail"]],
    ["supply-chain", ["supply chain"]],
    ["tim", ["tim", "technology & innovation management", "technology and innovation management"]],
    ["NHS-BNurs-Curriculum-Descriptions", ["course descriptions"]],
    ["Fall-Bothell-Thursday-2026", ["fall bothell", "bothell thursday"]],
    ["Fall-Shoreline-Friday-2026", ["fall shoreline", "shoreline friday"]],
    ["Winter-Everett-Tuesday-2026", ["winter everett", "everett tuesday"]],
  ]);
  const labelEvidence = labelFallbacks.get(pathSlug) ?? [pathSlug.replace(/-/g, " ")];
  return (
    source.includes(expectedUrl.toLowerCase()) ||
    source.includes(url.pathname.toLowerCase()) ||
    source.includes(path.basename(url.pathname).toLowerCase()) ||
    labelEvidence.some((label) => source.includes(label.toLowerCase()))
  );
}

function getSnapshotText(owner) {
  return readText(owner?.snapshotPath ?? "");
}

function getFixtureOwnerIds(caseFixture) {
  const ownerIds = new Set(caseFixture.ownerIds ?? []);
  if (caseFixture.matchOwnersBySourceUrl) {
    for (const owner of parseOwners) {
      if (owner.sourceUrl === caseFixture.sourceUrl) {
        ownerIds.add(owner.ownerId);
      }
    }
  }
  return Array.from(ownerIds).sort();
}

function formatRows(rows) {
  const visibleRows = rows.slice(0, 140);
  const suffix =
    rows.length > visibleRows.length ? `\n... ${rows.length - visibleRows.length} more rows` : "";
  return (
    visibleRows
    .map((row) =>
      [
        row.ownerId,
        row.layer,
        row.issue,
        row.parsed ?? "",
        row.structured ?? "",
        row.runtime ?? "",
        row.detail ?? "",
      ].join(" | ")
    )
      .join("\n") + suffix
  );
}

function summarizeList(values, limit = 10) {
  const normalizedValues = values.filter(Boolean);
  if (normalizedValues.length <= limit) {
    return normalizedValues.join(", ");
  }
  return `${normalizedValues.slice(0, limit).join(", ")} (+${
    normalizedValues.length - limit
  } more)`;
}

test("UW Bothell diagnostic fixture is scoped to current owner inventory", () => {
  assert.ok(auditedOwners.length > 0, "Expected current UW Bothell owner audit rows.");
  assert.ok(parseOwners.length > 0, "Expected current UW Bothell parse rows.");
  assert.ok(statusRows.length > 0, "Expected current UW Bothell runtime inventory rows.");

  for (const caseFixture of [
    ...(fixture.overviewLinkFixtures ?? []),
    ...(fixture.officialCourseFixtures ?? []),
  ]) {
    const ownerIds = getFixtureOwnerIds(caseFixture);
    assert.ok(ownerIds.length > 0, `Fixture ${caseFixture.id} did not resolve any owners.`);
    for (const ownerId of ownerIds) {
      assert.ok(
        auditedOwnerIds.has(ownerId) || parseOwnerById.has(ownerId),
        `Fixture ${caseFixture.id} references unknown UW Bothell owner ${ownerId}.`
      );
    }
  }
});

test("UW Bothell owners should have no source/parser/generated/runtime mismatch signals", () => {
  const mismatchRows = [];
  const seenMismatchRows = new Set();
  const addMismatchRow = (row) => {
    const key = JSON.stringify(row);
    if (seenMismatchRows.has(key)) {
      return;
    }
    seenMismatchRows.add(key);
    mismatchRows.push(row);
  };

  for (const owner of auditedOwners) {
    const issues = [...(owner.rootIssues ?? []), ...(owner.symptomIssues ?? [])];
    for (const issue of issues) {
      addMismatchRow({
        ownerId: owner.ownerId,
        layer: "owner-audit",
        issue: issue.code,
        detail: issue.message,
      });
    }
  }

  for (const owner of parseOwners) {
    const signalCodes = (owner.qualitySignals ?? []).map((signal) => signal.code);
    const parsedCount = owner.parsedUwCourseCodes?.length ?? 0;
    const structuredCount = owner.structuredUwCourseCodes?.length ?? 0;
    const sourceOnlyCount = owner.sourceOnlyUwCourseCodes?.length ?? 0;
    const structuredOnlyCount = owner.structuredOnlyUwCourseCodes?.length ?? 0;
    if (
      !owner.ok ||
      parsedCount === 0 ||
      sourceOnlyCount > 0 ||
      structuredOnlyCount > 0 ||
      signalCodes.length > 0
    ) {
      addMismatchRow({
        ownerId: owner.ownerId,
        layer: "parsed-block",
        issue: [
          !owner.ok ? "parse-failed" : null,
          parsedCount === 0 ? "zero-parsed-uw-course-codes" : null,
          sourceOnlyCount > 0 ? `source-only:${sourceOnlyCount}` : null,
          structuredOnlyCount > 0 ? `structured-only:${structuredOnlyCount}` : null,
          ...signalCodes,
        ]
          .filter(Boolean)
          .join(","),
        parsed: parsedCount,
        structured: structuredCount,
        detail: owner.sourceUrl,
      });
    }
  }

  for (const row of statusRows) {
    const ownerWarnings = row.ownerWarningCodes ?? [];
    const runtimeCourseCount = row.runtimeGrcCourseCount ?? 0;
    if (
      ownerWarnings.length > 0 ||
      (row.sourceBacked &&
        row.parsedSourceBlock &&
        row.emittedGeneratedRow &&
        row.emittedStudentRuntimeRow &&
        row.finalState === "intentionally-unmatched" &&
        runtimeCourseCount === 0)
    ) {
      addMismatchRow({
        ownerId: row.ownerId,
        layer: "generated-runtime",
        issue: [
          ...ownerWarnings,
          row.finalState === "intentionally-unmatched" ? row.reasonCode : null,
        ]
          .filter(Boolean)
          .join(","),
        runtime: runtimeCourseCount,
        detail: (row.notes ?? []).join(" "),
      });
    }
  }

  assert.equal(
    mismatchRows.length,
    0,
    `Expected clean UW Bothell transfer-planner owners. Current mismatch table:\n${formatRows(
      mismatchRows
    )}`
  );
});

test("UW Bothell overview pages should expose linked official source fixtures", () => {
  const failures = [];

  for (const overviewFixture of fixture.overviewLinkFixtures ?? []) {
    for (const ownerId of getFixtureOwnerIds(overviewFixture)) {
      const owner = parseOwnerById.get(ownerId);
      if (!owner) {
        failures.push(`${overviewFixture.id} | ${ownerId} | missing parsed owner row`);
        continue;
      }
      const snapshotText = getSnapshotText(owner);
      for (const expectedUrl of overviewFixture.expectedLinkedSourceUrls ?? []) {
        if (!hasLinkedSource(snapshotText, expectedUrl)) {
          failures.push(`${overviewFixture.id} | ${ownerId} | missing linked source ${expectedUrl}`);
        }
      }
    }
  }

  assert.deepEqual(failures, []);
});

test("UW Bothell official course fixtures should reach parsed blocks, generated rows, and runtime rows", () => {
  const failures = [];

  for (const courseFixture of fixture.officialCourseFixtures ?? []) {
    const ownerIds = getFixtureOwnerIds(courseFixture);
    const expectedCodes = normalizeCourseCodes(courseFixture.expectedOfficialCourseCodes);
    const unexpectedGeneratedCodes = normalizeCourseCodes(courseFixture.unexpectedGeneratedCourseCodes);

    for (const ownerId of ownerIds) {
      const owner = parseOwnerById.get(ownerId);
      const statusRow = statusRowByOwnerId.get(ownerId);
      const auditedOwner = auditedOwnerById.get(ownerId);

      if (!owner) {
        failures.push(`${courseFixture.id} | ${ownerId} | missing parsed owner row`);
        continue;
      }

      if (courseFixture.currentSourceUrl && owner.sourceUrl === courseFixture.currentSourceUrl) {
        failures.push(
          `${courseFixture.id} | ${ownerId} | current source ${owner.sourceUrl} should be ${courseFixture.sourceUrl}`
        );
      } else if (!courseFixture.currentSourceUrl && owner.sourceUrl !== courseFixture.sourceUrl) {
        failures.push(
          `${courseFixture.id} | ${ownerId} | parsed source ${owner.sourceUrl} should be ${courseFixture.sourceUrl}`
        );
      }

      const snapshotText = getSnapshotText(owner);
      if (owner.sourceUrl === courseFixture.sourceUrl) {
        assert.ok(
          snapshotText.length > 0,
          `${courseFixture.id} | ${ownerId} should retain a source snapshot.`
        );
      }

      const parsedCodes = new Set(normalizeCourseCodes(owner.parsedUwCourseCodes));
      const missingFromParsed = expectedCodes.filter((courseCode) => !parsedCodes.has(courseCode));
      if (missingFromParsed.length > 0) {
        failures.push(
          `${courseFixture.id} | ${ownerId} | parsed block missing ${missingFromParsed.length} official codes: ${summarizeList(missingFromParsed)}`
        );
      }

      const structuredCodes = new Set(normalizeCourseCodes(owner.structuredUwCourseCodes));
      const missingFromGeneratedShape = expectedCodes.filter(
        (courseCode) => !structuredCodes.has(courseCode)
      );
      if (missingFromGeneratedShape.length > 0) {
        failures.push(
          `${courseFixture.id} | ${ownerId} | generated/structured row missing ${missingFromGeneratedShape.length} official codes: ${summarizeList(missingFromGeneratedShape)}`
        );
      }

      const unexpectedStructuredCodes = unexpectedGeneratedCodes.filter((courseCode) =>
        structuredCodes.has(courseCode)
      );
      if (unexpectedStructuredCodes.length > 0) {
        failures.push(
          `${courseFixture.id} | ${ownerId} | generated/structured row contains unexpected code: ${summarizeList(unexpectedStructuredCodes)}`
        );
      }

      for (const expectedLabel of courseFixture.expectedOfficialRequirementLabels ?? []) {
        if (!normalizeSourceText(snapshotText).includes(expectedLabel.toUpperCase())) {
          failures.push(
            `${courseFixture.id} | ${ownerId} | source snapshot missing expected requirement label ${expectedLabel}`
          );
        }
      }

      if (courseFixture.expectedRuntimePlannerRows) {
        if (!statusRow) {
          failures.push(`${courseFixture.id} | ${ownerId} | missing planner status runtime row`);
        } else {
          if (!statusRow.emittedGeneratedRow) {
            failures.push(`${courseFixture.id} | ${ownerId} | generated plan row not emitted`);
          }
          if (!statusRow.emittedStudentRuntimeRow) {
            failures.push(`${courseFixture.id} | ${ownerId} | student runtime row not emitted`);
          }
          if ((statusRow.runtimeGrcCourseCount ?? 0) === 0) {
            failures.push(
              `${courseFixture.id} | ${ownerId} | runtime row has no visible course rows; owner warnings: ${(
                auditedOwner?.rootIssues ?? []
              )
                .map((issue) => issue.code)
                .join(",")}`
            );
          }
        }
      }
    }
  }

  assert.equal(
    failures.length,
    0,
    `Expected official UW Bothell course fixtures to flow through all planner layers. Current fixture failures:\n${summarizeList(
      failures,
      140
    )}`
  );
});
