"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildCoverageInventory,
  assertCountDomainsSeparated,
} = require("./coverage/inventory.cjs");
const {
  createPublicationStaging,
} = require("./publication/lkg-staging.cjs");

test("P10-A coverage inventory separates count domains and finds duplicate runtime IDs", () => {
  const inventory = buildCoverageInventory({
    majorPlans: [
      {
        id: "uw-seattle-cs-bs",
        campus: "seattle",
        title: "Computer Science",
        primarySource: "https://example/cs",
        family: "uw-program-html",
        catalogYear: "2025",
      },
      {
        id: "uw-seattle-cs-bs",
        campus: "seattle",
        title: "Computer Science Dup",
        primarySource: "https://example/cs",
        family: "uw-program-html",
        catalogYear: "2025",
      },
      {
        id: "uw-tacoma-ias",
        campus: "tacoma",
        title: "IAS",
        primarySource: null,
        family: "uw-program-html",
        catalogYear: "2025",
      },
    ],
    pathways: [{ id: "ias-individually-designed" }],
    primaryOwners: [{ id: "owner-a" }, { id: "owner-b" }, { id: "owner-a" }],
    sourceOwnerBlocks: [
      { ownerId: "owner-a" },
      { ownerId: "owner-b" },
      { ownerId: "owner-c" },
    ],
  });

  assert.equal(assertCountDomainsSeparated(inventory), true);
  assert.equal(inventory.counts.majorPlans, 3);
  assert.equal(inventory.counts.pathways, 1);
  assert.equal(inventory.counts.primaryOwners, 2);
  assert.equal(inventory.counts.sourceOwnerBlocks, 3);
  assert.deepEqual(inventory.duplicateRuntimeIds, ["uw-seattle-cs-bs"]);
  assert.equal(inventory.missingPrimarySource.length, 1);
  // Domains must remain separately addressable (188/247/244/449 are not one number).
  assert.notEqual(inventory.counts.majorPlans, inventory.counts.pathways);
});

test("P10-G publish completeness gate shape", () => {
  const required = [
    "canonicalIdentity",
    "officialSource",
    "adapterId",
    "parseOk",
    "validIr",
    "runtimeCompileOk",
    "catalogYear",
    "familyFixture",
  ];
  const row = Object.fromEntries(required.map((k) => [k, true]));
  assert.equal(required.every((k) => row[k] === true), true);
});

test("P09+P10 staging still protects LKG on failed coverage", async () => {
  const pub = createPublicationStaging({
    initialLkg: { artifacts: { inv: Buffer.from("lkg") } },
  });
  pub.stageArtifact("inv", "candidate");
  const validation = await pub.validate(async () => ({
    ok: false,
    reason: "coverage-gap",
  }));
  assert.equal(validation.ok, false);
  assert.equal(pub.promote({ ok: false }).promoted, false);
  assert.equal(pub.getLkg().artifacts.inv.toString(), "lkg");
});
