"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createAdapterRegistry } = require("./registry.cjs");
const { createOfficialDegreeDocumentAdapter } = require("./official-degree-document/index.cjs");
const { createUwGrcEquivalencyAdapter } = require("./uw-grc-equivalency/index.cjs");
const { createGrcCatalogAdapter } = require("./grc-catalog/index.cjs");
const { createGrcAnnualScheduleAdapter } = require("./grc-annual-schedule-pdf/index.cjs");
const { htmlToSourceDocument, pdfTextToSourceDocument } = require("../document/source-document.cjs");

function fixture(...parts) {
  return fs.readFileSync(path.join(__dirname, ...parts), "utf8");
}

test("P06-A degree-document matches multi-page planning grids / PDFs", async () => {
  const adapter = createOfficialDegreeDocumentAdapter();
  const doc = pdfTextToSourceDocument({
    text: "Degree planning worksheet\nRequirements\nCredits",
    sourceUrl: "https://www.washington.edu/example/degree-sheet.pdf",
    pageTexts: ["Degree planning worksheet", "Requirements Credits"],
  });
  assert.equal(await adapter.matches(doc), true);
  const out = await adapter.parse(doc);
  assert.equal(out.adapterId, "official-degree-document");
  assert.ok(out.pageCount >= 1);
});

test("P06-B equivalency domain stays separate from requirement IR", async () => {
  const adapter = createUwGrcEquivalencyAdapter();
  const doc = htmlToSourceDocument({
    html: fixture("uw-grc-equivalency", "fixtures", "uw-grc-business-equivalency.html"),
    sourceUrl: "https://admit.washington.edu/apply/transfer/equivalency",
  });
  assert.equal(await adapter.matches(doc), true);
  const out = await adapter.parse(doc);
  assert.equal(out.domain, "equivalency-ir");
  assert.equal(out.status, "ok");
  assert.equal(out.requirementModel, undefined);
  assert.deepEqual(out.grcCourseCodes, ["ENGL&101", "MATH&141", "ACCT110"]);
  assert.deepEqual(out.uwCourseCodes, ["ENGL131", "MATH120", "ACCTG215"]);
  assert.deepEqual(out.equivalencies[1], {
    grcCourseCode: "MATH&141",
    uwCourseCode: "MATH120",
    rawText: "MATH& 141 => MATH 120",
  });
});

test("P06-C/D GRC catalog vs annual schedule selection", async () => {
  const registry = createAdapterRegistry()
    .register(createGrcCatalogAdapter())
    .register(createGrcAnnualScheduleAdapter());

  const catalog = htmlToSourceDocument({
    html: fixture("grc-catalog", "fixtures", "grc-business-catalog.html"),
    sourceUrl: "https://www.greenriver.edu/catalog/programs",
  });
  const c = await registry.selectPrimary(catalog);
  assert.equal(c.ok, true);
  assert.equal(c.adapter.id, "grc-catalog");
  const catalogIr = await c.adapter.parse(catalog);
  assert.equal(catalogIr.status, "ok");
  assert.equal(catalogIr.domain, "grc-course-ir");
  assert.deepEqual(catalogIr.courseCodes, ["ACCT110", "BUS101", "ENGL&101", "MATH&141", "MATH097"]);
  assert.equal(catalogIr.requirementModel.ok, true);
  assert.equal(catalogIr.requirementModel.version, "1.0.0");
  assert.equal(catalogIr.requirementModel.expression.kind, "allOf");
  assert.equal(catalogIr.requirementModel.expression.children[2].courseCode, "ENGL&101");
  assert.equal(catalogIr.requirementDraft.sections[1].title, "Associate in Business, DTA/MRP");

  const schedule = pdfTextToSourceDocument({
    text: fixture("grc-annual-schedule-pdf", "fixtures", "grc-annual-schedule.txt"),
    sourceUrl: "https://www.greenriver.edu/students/annual-schedule.pdf",
  });
  const s = await registry.selectPrimary(schedule);
  assert.equal(s.ok, true);
  assert.equal(s.adapter.id, "grc-annual-schedule-pdf");
  const scheduleIr = await s.adapter.parse(schedule);
  assert.equal(scheduleIr.status, "ok");
  assert.equal(scheduleIr.domain, "grc-availability");
  assert.deepEqual(scheduleIr.courseCodes, ["ENGL&101", "MATH&141", "BUS101", "ACCT110"]);
  assert.deepEqual(scheduleIr.availability.find((item) => item.courseCode === "MATH&141").terms, [
    "fall",
    "spring",
  ]);
  assert.deepEqual(scheduleIr.availability.find((item) => item.courseCode === "BUS101").terms, [
    "winter",
  ]);
});
