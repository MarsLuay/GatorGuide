"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  classifySemanticChange,
  attachCatalogYear,
} = require("./versioning/catalog-year.cjs");
const { createPublicationStaging } = require("./publication/lkg-staging.cjs");

test("P08 catalog year identity ignores fetch-date-only stamps", () => {
  const model = attachCatalogYear(
    { programId: "uw-seattle-cs", requirements: { a: 1 } },
    "2025"
  );
  assert.equal(model.identityKey, "uw-seattle-cs@2025");
  assert.throws(() => attachCatalogYear({ programId: "x" }, "fetched-today"));
});

test("P08 semantic change classification", () => {
  const prev = { requirements: { chem: "CHEM&161" } };
  const next = { requirements: { chem: "CHEM&161", math: "MATH&151" } };
  const change = classifySemanticChange(prev, next);
  assert.equal(change.kind, "semantic");
  assert.deepEqual(change.added, ["math"]);
  assert.equal(classifySemanticChange(prev, prev).kind, "unchanged");
});

test("P09 LKG staging is atomic and rejects failed validation", async () => {
  const pub = createPublicationStaging({
    initialLkg: { artifacts: { a: Buffer.from("old") } },
  });
  pub.stageArtifact("a", "new");
  const failed = await pub.validate(async () => ({ ok: false }));
  assert.equal(failed.ok, false);
  assert.equal(pub.promote({ ok: false }).promoted, false);
  assert.equal(pub.getLkg().artifacts.a.toString(), "old");

  const ok = await pub.validate(async () => ({ ok: true }));
  assert.equal(ok.ok, true);
  const promoted = pub.promote({ ok: true });
  assert.equal(promoted.promoted, true);
  assert.equal(pub.getLkg().artifacts.a.toString(), "new");
  assert.deepEqual(pub.listStaged(), []);
});
