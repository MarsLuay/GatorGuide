const assert = require("node:assert/strict");
const test = require("node:test");

const diagnostics = require("./grc-track-mismatch-diagnostics.cjs");
const fixture = require("./fixtures/grc-track-mismatch-diagnostics.fixture.cjs");

test("Green River track diagnostics reproduce known official-source mismatches", () => {
  const report = diagnostics.buildReport({
    officialRecords: fixture.officialRecords,
  });

  for (const [trackId, expectedIssueCodes] of Object.entries(
    fixture.expectedIssueCodesByTrackId
  )) {
    const track = report.tracks.find((entry) => entry.trackId === trackId);
    assert.ok(track, `Missing diagnostic track ${trackId}`);

    const actualIssueCodes = new Set(track.issues.map((entry) => entry.code));
    for (const expectedIssueCode of expectedIssueCodes) {
      assert.ok(
        actualIssueCodes.has(expectedIssueCode),
        `${trackId} should expose ${expectedIssueCode}; actual: ${[...actualIssueCodes].join(", ")}`
      );
    }
  }
});

test("Green River track diagnostics cover the requested issue categories", () => {
  const report = diagnostics.buildReport({
    officialRecords: fixture.officialRecords,
  });

  assert.ok(report.summary.greenRiverTrackCount >= 100);
  assert.equal(report.summary.officialRecordCount, fixture.officialRecords.length);
  assert.ok(report.summary.issueCountsByCategory["credit-ranges"] > 0);
  assert.ok(report.summary.issueCountsByCategory["choose-n-groups"] > 0);
  assert.ok(report.summary.issueCountsByCategory["scheduled-defaults"] > 0);
  assert.ok(report.summary.issueCountsByCategory["unresolved-options"] > 0);
});

test("Green River diagnostic markdown includes recurring generator patterns", () => {
  const report = diagnostics.buildReport({
    officialRecords: fixture.officialRecords,
  });
  const markdown = diagnostics.renderMarkdown(report);

  assert.match(markdown, /Recurring Generator Patterns/);
  assert.match(markdown, /credit-range-parser-uses-later-subrequirement-credit-span/);
  assert.match(markdown, /choose-n-defaults-do-not-fill-required-credit-bucket/);
  assert.match(markdown, /sample-defaults-above-published-maximum/);
});
