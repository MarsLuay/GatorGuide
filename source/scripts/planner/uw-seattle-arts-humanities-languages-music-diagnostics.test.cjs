const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.join(REPO_ROOT, ".tmp");
const FIXTURE_PATH = path.join(
  __dirname,
  "fixtures",
  "uw-seattle-arts-humanities-languages-music-diagnostics.json"
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
const ownerAuditReport = readJson(path.join(TMP_DIR, "transfer-planner-owner-audit.json"));
const parseReport = readJson(
  path.join(TMP_DIR, "transfer-planner-requirement-source-parse-report.json")
);

const campusId = fixture.campusId;
const auditedOwners = (ownerAuditReport.owners ?? []).filter(
  (owner) => owner.campusId === campusId
);
const parseOwners = (parseReport.owners ?? []).filter((owner) => owner.campusId === campusId);

const auditedOwnerById = new Map(auditedOwners.map((owner) => [owner.ownerId, owner]));
const parseOwnerById = new Map(parseOwners.map((owner) => [owner.ownerId, owner]));

function normalizeCourseCode(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .toUpperCase()
    .replace(/\bS\s+ASIA\b/g, "SASIA")
    .replace(/\bJEW\s+ST\b/g, "JEWST")
    .replace(/\bJSIS\s+([A-Z])\b/g, "JSIS$1")
    .replace(/\bART\s+H\b/g, "ARTH")
    .replace(/\bDX\s+ARTS\b/g, "DXARTS")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^([A-Z&]+)\s*(\d{3}[A-Z]?|[1-4]XX)$/i, "$1 $2");
}

function normalizeCourseCodes(values) {
  return Array.from(new Set((values ?? []).map(normalizeCourseCode).filter(Boolean))).sort();
}

function normalizeSourceText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\bS\s+ASIA\b/gi, "SASIA")
    .replace(/\bJEW\s+ST\b/gi, "JEWST")
    .replace(/\bJSIS\s+([A-Z])\b/gi, (_, suffix) => `JSIS${suffix.toUpperCase()}`)
    .replace(/\bART\s+H\b/gi, "ARTH")
    .replace(/\bDX\s+ARTS\b/gi, "DXARTS")
    .replace(/\b([A-Z][A-Z&]{2,})\s*,\s*(\d{3}[A-Z]?)\b/g, "$1 $2")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasCourseCode(sourceText, courseCode) {
  const normalizedCode = normalizeCourseCode(courseCode);
  if (!normalizedCode) {
    return false;
  }

  const [prefix, number] = normalizedCode.split(" ");
  if (!prefix || !number) {
    return false;
  }

  const normalizedSourceText = normalizeSourceText(sourceText);
  const escapedPrefix = escapeRegExp(prefix);
  const escapedNumber = escapeRegExp(number);
  const explicitPattern = new RegExp(`\\b${escapedPrefix}\\s*${escapedNumber}\\b`);
  if (explicitPattern.test(normalizedSourceText)) {
    return true;
  }

  const continuationPattern = new RegExp(
    `\\b${escapedPrefix}\\s+\\d{3}[A-Z]?[^.]{0,180}\\b${escapedNumber}\\b`
  );
  return continuationPattern.test(normalizedSourceText);
}

function getSnapshotText(owner) {
  return readText(owner?.snapshotPath ?? "");
}

function formatFailures(failures) {
  return failures.join("\n");
}

test("UW Seattle arts/humanities/languages/music diagnostic fixture is scoped to current owner inventory", () => {
  assert.ok(auditedOwners.length > 0, "Expected current UW Seattle owner audit rows.");
  assert.ok(parseOwners.length > 0, "Expected current UW Seattle parse rows.");

  for (const ownerId of fixture.scopeOwnerIds ?? []) {
    assert.ok(
      auditedOwnerById.has(ownerId) || parseOwnerById.has(ownerId),
      `Fixture references unknown UW Seattle owner ${ownerId}.`
    );
  }

  for (const ownerFixture of fixture.inactiveOrPolicyOnlyOwners ?? []) {
    assert.ok(
      auditedOwnerById.has(ownerFixture.ownerId) || parseOwnerById.has(ownerFixture.ownerId),
      `Inactive/policy fixture references unknown UW Seattle owner ${ownerFixture.ownerId}.`
    );
  }
});

test("UW Seattle arts/humanities/languages/music official requirements should reach parsed source blocks", () => {
  const failures = [];

  for (const courseFixture of fixture.officialCourseFixtures ?? []) {
    const expectedCodes = normalizeCourseCodes(courseFixture.expectedOfficialCourseCodes);
    const expectedParsedCodes = normalizeCourseCodes(
      courseFixture.expectedParsedCourseCodes ?? courseFixture.expectedOfficialCourseCodes
    );
    const unexpectedParsedCodes = normalizeCourseCodes(courseFixture.unexpectedParsedCourseCodes);

    for (const ownerId of courseFixture.ownerIds ?? []) {
      const owner = parseOwnerById.get(ownerId);
      const auditedOwner = auditedOwnerById.get(ownerId);

      if (!owner) {
        failures.push(`${courseFixture.id} | ${ownerId} | missing parsed owner row`);
        continue;
      }

      if (owner.sourceUrl !== courseFixture.sourceUrl) {
        failures.push(
          `${courseFixture.id} | ${ownerId} | parsed source ${owner.sourceUrl} should be ${courseFixture.sourceUrl}`
        );
      }

      if (
        courseFixture.expectedSourceRoleStatus &&
        owner.sourceRoleStatus !== courseFixture.expectedSourceRoleStatus
      ) {
        failures.push(
          `${courseFixture.id} | ${ownerId} | source role status ${owner.sourceRoleStatus} should be ${courseFixture.expectedSourceRoleStatus} (${owner.sourceRole})`
        );
      }

      if (
        typeof courseFixture.expectedSchedulable === "boolean" &&
        owner.canCreateSchedulableRows !== courseFixture.expectedSchedulable
      ) {
        failures.push(
          `${courseFixture.id} | ${ownerId} | schedulable=${owner.canCreateSchedulableRows} should be ${courseFixture.expectedSchedulable}`
        );
      }

      if (courseFixture.expectedNoSourceOnlyCourseCodes) {
        const sourceOnlyCodes = normalizeCourseCodes(owner.sourceOnlyUwCourseCodes);
        if (sourceOnlyCodes.length > 0) {
          failures.push(
            `${courseFixture.id} | ${ownerId} | source-only codes should be schedulable or support-scoped instead: ${sourceOnlyCodes.join(", ")}`
          );
        }
      }

      if (courseFixture.expectedNoQualityWarnings) {
        const warningCodes = (owner.qualitySignals ?? [])
          .filter((signal) => signal.severity === "warning")
          .map((signal) => signal.code);
        if (warningCodes.length > 0) {
          failures.push(
            `${courseFixture.id} | ${ownerId} | unexpected parser quality warnings: ${warningCodes.join(", ")}`
          );
        }
      }

      const ownerIssueCodes = Array.from(
        new Set(
          [
            ...(auditedOwner?.rootIssues ?? []),
            ...(auditedOwner?.symptomIssues ?? []),
          ].map((issue) => issue.code)
        )
      );
      if (ownerIssueCodes.length > 0) {
        failures.push(
          `${courseFixture.id} | ${ownerId} | owner-audit issues: ${ownerIssueCodes.join(", ")}`
        );
      }

      const snapshotText = getSnapshotText(owner);
      const missingFromSnapshot = expectedCodes.filter(
        (courseCode) => !hasCourseCode(snapshotText, courseCode)
      );
      if (missingFromSnapshot.length > 0) {
        failures.push(
          `${courseFixture.id} | ${ownerId} | expected official snapshot codes missing: ${missingFromSnapshot.join(", ")}`
        );
      }

      const parsedCodes = new Set(normalizeCourseCodes(owner.parsedUwCourseCodes));
      const missingFromParsed = expectedParsedCodes.filter(
        (courseCode) => !parsedCodes.has(courseCode)
      );
      if (missingFromParsed.length > 0) {
        failures.push(
          `${courseFixture.id} | ${ownerId} | parsed block missing official codes: ${missingFromParsed.join(", ")}`
        );
      }

      const unexpectedPresent = unexpectedParsedCodes.filter((courseCode) =>
        parsedCodes.has(courseCode)
      );
      if (unexpectedPresent.length > 0) {
        failures.push(
          `${courseFixture.id} | ${ownerId} | parsed block includes non-counting/excluded codes: ${unexpectedPresent.join(", ")}`
        );
      }
    }
  }

  assert.deepEqual(failures, [], formatFailures(failures));
});
