"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeCourseCode,
  dedupeCourseObligations,
} = require("./normalization/course-identity.cjs");
const { reconcileFacts } = require("./reconciliation/authority.cjs");

test("P07-A course codes normalize spaced/compact without double-count", () => {
  assert.equal(normalizeCourseCode("math& 163").compact, "MATH&163");
  assert.equal(normalizeCourseCode("MATH&163").display.includes("MATH&"), true);
  const deduped = dedupeCourseObligations(["MATH& 163", "MATH&163", "CHEM& 161"]);
  assert.equal(deduped.length, 2);
});

test("P07-E material conflicts block publication", () => {
  const result = reconcileFacts([
    {
      key: "req:chem",
      value: "CHEM&161",
      authority: "program-owned-current",
      evidence: ["a"],
    },
    {
      key: "req:chem",
      value: "CHEM&121",
      authority: "campus-catalog",
      evidence: ["b"],
    },
    {
      key: "req:math",
      value: "MATH&151",
      authority: "campus-catalog",
      evidence: ["c"],
    },
    {
      key: "req:math",
      value: "MATH&151",
      authority: "grc-catalog-schedule",
      evidence: ["d"],
    },
  ]);
  assert.equal(result.publishBlocked, false);
  assert.equal(result.facts.find((f) => f.key === "req:chem").value, "CHEM&161");

  const material = reconcileFacts([
    {
      key: "req:phys",
      value: "PHYS&221",
      authority: "program-owned-current",
      evidence: ["a"],
    },
    {
      key: "req:phys",
      value: "PHYS&114",
      authority: "program-owned-current",
      evidence: ["b"],
    },
  ]);
  assert.equal(material.publishBlocked, true);
});
