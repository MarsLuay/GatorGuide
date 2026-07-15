"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../../..");

test("P13-B TranscriptIngestor TS strangler exists with dispose+privacy exports", () => {
  const file = path.join(ROOT, "services/documents/transcript-ingestor.ts");
  assert.ok(fs.existsSync(file));
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /export async function ingestTranscript/);
  assert.match(text, /finally/);
  assert.match(text, /assertNoTranscriptSourceLeak/);
  assert.doesNotMatch(text, /aiGatewayService/);
});

test("P13-A / P16 TS contract ports exist beside CJS harness", () => {
  const appData = path.join(ROOT, "services/planning/contracts/app-data-v2.ts");
  const timeline = path.join(
    ROOT,
    "services/planning/contracts/timeline-opportunities.ts"
  );
  assert.ok(fs.existsSync(appData));
  assert.ok(fs.existsSync(timeline));
  const appText = fs.readFileSync(appData, "utf8");
  const tlText = fs.readFileSync(timeline, "utf8");
  assert.match(appText, /migrateAppDataToV2/);
  assert.match(appText, /__legacy/);
  assert.match(tlText, /matchOpportunities/);
  assert.match(tlText, /projectTransferTimeline/);
});
