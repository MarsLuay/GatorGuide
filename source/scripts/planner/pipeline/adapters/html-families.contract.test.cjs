"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createAdapterRegistry } = require("./registry.cjs");
const { createUwProgramHtmlAdapter } = require("./uw-program-html/index.cjs");
const { createUwGeneralCatalogHtmlAdapter } = require("./uw-general-catalog-html/index.cjs");
const { createOfficialSupportPageAdapter } = require("./official-support-html/index.cjs");
const { createLegacyParserAdapter } = require("../orchestration/legacy-bridge.cjs");
const { htmlToSourceDocument } = require("../document/source-document.cjs");

function registerHtmlFamilies(registry) {
  return registry
    .register(createUwProgramHtmlAdapter())
    .register(createUwGeneralCatalogHtmlAdapter())
    .register(createOfficialSupportPageAdapter())
    .register(createLegacyParserAdapter());
}

test("P05-E HTML families select by structure before legacy", async () => {
  const registry = registerHtmlFamilies(createAdapterRegistry());

  const programDoc = htmlToSourceDocument({
    html: "<html><body class='program'><h1>Bachelor of Science</h1><p>Admission Requirements</p></body></html>",
    sourceUrl: "https://www.cs.washington.edu/academics/ugrad/program",
  });
  // Exclude legacy for primary selection test of HTML families alone
  const htmlOnly = createAdapterRegistry()
    .register(createUwProgramHtmlAdapter())
    .register(createUwGeneralCatalogHtmlAdapter())
    .register(createOfficialSupportPageAdapter());
  const selected = await htmlOnly.selectPrimary(programDoc);
  assert.equal(selected.ok, true);
  assert.equal(selected.adapter.id, "uw-program-html");

  const catalogDoc = htmlToSourceDocument({
    html: "<html><body>University of Washington General Catalog</body></html>",
    sourceUrl: "https://www.washington.edu/students/gencat/academic/cs.html",
  });
  const catalog = await htmlOnly.selectPrimary(catalogDoc);
  assert.equal(catalog.ok, true);
  assert.equal(catalog.adapter.id, "uw-general-catalog-html");

  const supportDoc = htmlToSourceDocument({
    html: "<html><body><h2>Approved Course List</h2><p>Electives</p></body></html>",
    sourceUrl: "https://www.washington.edu/example/support",
  });
  const support = await htmlOnly.selectPrimary(supportDoc);
  assert.equal(support.ok, true);
  assert.equal(support.adapter.id, "official-support-html");
  const parsed = await support.adapter.parse(supportDoc);
  assert.equal(parsed.schedulable, false);

  assert.equal(registry.list().length, 4);
});

test("P05-B UW program HTML fixture extracts course IR + requirement model", async () => {
  const html = fs.readFileSync(
    path.join(__dirname, "uw-program-html/fixtures/seattle-cs-admission.html"),
    "utf8"
  );
  const doc = htmlToSourceDocument({
    html,
    sourceUrl: "https://www.cs.washington.edu/academics/ugrad/admissions",
    snapshotId: "fixture:seattle-cs-admission",
  });
  const adapter = createUwProgramHtmlAdapter();
  assert.equal(await adapter.matches(doc), true);
  const parsed = await adapter.parse(doc);
  assert.equal(parsed.status, "ok");
  assert.ok(parsed.courseCodes.includes("CSE142"));
  assert.ok(parsed.courseCodes.includes("MATH124"));
  assert.ok(parsed.courseCodes.includes("ENGL&101"));
  assert.equal(parsed.requirementModel.ok, true);
  assert.equal(parsed.requirementModel.version, "1.0.0");
  assert.match(parsed.requirementModel.identity.programId, /uw:/);
  assert.equal(parsed.requirementModel.evidence.parserFamily, "uw-program-html");
  assert.ok(parsed.requirementDraft.sections.some((s) => /Admission/i.test(s.title)));
});

test("P05-B UW Bothell business fixture extracts course IR + requirement model", async () => {
  const html = fs.readFileSync(
    path.join(__dirname, "uw-program-html/fixtures/bothell-business-admission.html"),
    "utf8"
  );
  const doc = htmlToSourceDocument({
    html,
    sourceUrl: "https://www.uwb.edu/business/undergraduate/admission",
    snapshotId: "fixture:bothell-business-admission",
  });
  const adapter = createUwProgramHtmlAdapter();
  assert.equal(await adapter.matches(doc), true);
  const parsed = await adapter.parse(doc);
  assert.equal(parsed.status, "ok");
  assert.ok(parsed.courseCodes.includes("BBUS300"));
  assert.ok(parsed.courseCodes.includes("BBUS301"));
  assert.ok(parsed.courseCodes.includes("ACCT&201"));
  assert.ok(parsed.courseCodes.includes("ENGL&101"));
  assert.equal(parsed.requirementModel.ok, true);
  assert.equal(parsed.requirementModel.version, "1.0.0");
  assert.match(parsed.requirementModel.identity.programId, /uw:/);
  assert.equal(parsed.requirementModel.evidence.parserFamily, "uw-program-html");
  assert.ok(parsed.requirementDraft.sections.some((s) => /Admission/i.test(s.title)));
});

test("P05-B UW Tacoma IAS fixture extracts course IR + requirement model", async () => {
  const html = fs.readFileSync(
    path.join(__dirname, "uw-program-html/fixtures/tacoma-ias-admission.html"),
    "utf8"
  );
  const doc = htmlToSourceDocument({
    html,
    sourceUrl: "https://www.tacoma.uw.edu/ias/interdisciplinary-arts-sciences/admission",
    snapshotId: "fixture:tacoma-ias-admission",
  });
  const adapter = createUwProgramHtmlAdapter();
  assert.equal(await adapter.matches(doc), true);
  const parsed = await adapter.parse(doc);
  assert.equal(parsed.status, "ok");
  assert.ok(parsed.courseCodes.includes("TIAS305"));
  assert.ok(parsed.courseCodes.includes("TIAS340"));
  assert.ok(parsed.courseCodes.includes("TWRT211"));
  assert.ok(parsed.courseCodes.includes("MATH&146"));
  assert.equal(parsed.requirementModel.ok, true);
  assert.equal(parsed.requirementModel.version, "1.0.0");
  assert.match(parsed.requirementModel.identity.programId, /uw:/);
  assert.equal(parsed.requirementModel.evidence.parserFamily, "uw-program-html");
  assert.ok(parsed.requirementDraft.sections.some((s) => /Admission/i.test(s.title)));
});

test("P05-C UW general catalog fixture extracts course IR", async () => {
  const html = fs.readFileSync(
    path.join(__dirname, "uw-general-catalog-html/fixtures/seattle-cs-gencat.html"),
    "utf8"
  );
  const doc = htmlToSourceDocument({
    html,
    sourceUrl: "https://www.washington.edu/students/gencat/academic/cs.html",
  });
  const adapter = createUwGeneralCatalogHtmlAdapter();
  assert.equal(await adapter.matches(doc), true);
  const parsed = await adapter.parse(doc);
  assert.equal(parsed.status, "ok");
  assert.ok(parsed.courseCodes.includes("CSE142"));
  assert.ok(parsed.courseCodes.includes("CSE311"));
  assert.equal(parsed.requirementModel.ok, true);
  assert.equal(parsed.requirementModel.evidence.parserFamily, "uw-general-catalog-html");
});
