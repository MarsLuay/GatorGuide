"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const controllerFile = path.join(
  __dirname,
  "../../../components/pages/deadline-calendar/useDeadlineCalendarController.ts"
);
const calendarServiceFile = path.join(
  __dirname,
  "../../../services/deadlines/deadline-calendar.service.ts"
);
const timelineBridgeFile = path.join(
  __dirname,
  "../../../services/deadlines/personalized-timeline-calendar.ts"
);

test("P16 Calendar prefers Living Plan timeline and skips roadmap when ready", () => {
  const text = fs.readFileSync(controllerFile, "utf8");
  assert.match(text, /preferLivingPlanTimeline/);
  assert.match(text, /skip roadmap fetch when Living Plan inputs are present/);
  // Living Plan path builds entries without a roadmap document.
  assert.match(
    text,
    /preferLivingPlanTimeline:\s*true/
  );
  assert.match(
    text,
    /Living Plan primary: opportunities \+ personalized timeline only/
  );
  // Seed/fetch only when Living Plan is absent.
  assert.match(text, /if \(preferLivingPlanTimeline\) return null;/);
  assert.doesNotMatch(
    text,
    /roadmap:\s*preferLivingPlanTimeline\s*\?\s*null\s*:\s*roadmap/
  );
});

test("P16 deadline calendar service: Living Plan skips roadmap; opportunities independent", () => {
  const text = fs.readFileSync(calendarServiceFile, "utf8");
  assert.match(text, /preferLivingPlanTimeline\?:\s*boolean/);
  assert.match(
    text,
    /const roadmapEntries = input\.preferLivingPlanTimeline\s*\?\s*\[\]\s*:\s*this\.buildRoadmapEntries\(input\.roadmap\)/
  );
  // Opportunity builder does not take a roadmap document.
  assert.match(text, /buildOpportunityEntries\(opportunities:/);
  assert.doesNotMatch(
    text,
    /buildOpportunityEntries\([^)]*roadmap/
  );
});

test("P16-D bridge keeps opportunities off timeline merge (calendar opportunity path)", () => {
  const text = fs.readFileSync(timelineBridgeFile, "utf8");
  assert.match(text, /if \(entry\.sourceType === \"opportunity\"\) continue/);
  assert.match(text, /sourceType === \"living-plan\"/);
});
