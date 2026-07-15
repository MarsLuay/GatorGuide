
const assert = require("node:assert/strict");
const test = require("node:test");
const {
  REQUIREMENT_MODEL_VERSION,
  createRequirementModelDocument,
  legacyCourseListToExpression,
  validateExpression,
  atom,
  allOf,
  chooseN,
  createCourseConstraint,
  createEvidence,
  attachEvidence,
  serializeIdentity,
} = require("./schema.cjs");

test("P03-E requirement model version is 1.0.0", () => {
  assert.equal(REQUIREMENT_MODEL_VERSION, "1.0.0");
});

test("P03-A identity serializes stably", () => {
  const doc = createRequirementModelDocument({
    identity: {
      requirementSetId: "uw-seattle-cs",
      programId: "cs",
      catalogYear: "2025-2026",
      sourceOwnerId: "uw-seattle-cs-owner",
      label: "Computer Science",
    },
    expression: allOf([atom("MATH 124"), atom("MATH 125")]),
  });
  assert.equal(doc.ok, true);
  assert.equal(serializeIdentity(doc.identity), serializeIdentity(doc.identity));
});

test("P03-B chooseN and invalid shapes", () => {
  const ok = chooseN(2, [atom("A"), atom("B"), atom("C")]);
  assert.deepEqual(validateExpression(ok), []);
  assert.ok(validateExpression({ kind: "chooseN", n: 0, children: [] }).length > 0);
  assert.ok(validateExpression({ kind: "nope" }).length > 0);
});

test("P03-C schedulable constraints", () => {
  const c = createCourseConstraint({
    courseCode: "CHEM 161",
    minGrade: "2.0",
    prerequisites: ["MATH 124"],
  });
  assert.equal(c.schedulable, true);
  assert.equal(c.courseCode, "CHEM 161");
});

test("P03-D evidence required for schedulable atoms", () => {
  const evidence = createEvidence({
    sourceUrl: "https://example.edu/cs",
    catalogYear: "2025-2026",
    sourceRole: "program-page",
    parserFamily: "uw-program-html",
    evidenceText: "MATH 124 required",
  });
  const fact = attachEvidence(atom("MATH 124"), evidence);
  assert.equal(fact.evidence.evidenceHash.length, 64);
  assert.throws(() => attachEvidence(atom("MATH 124"), {}));
});

test("P03-E legacy adapter wraps course lists", () => {
  const expr = legacyCourseListToExpression(["ENGL 101", "ENGL 102"]);
  assert.equal(expr.kind, "allOf");
  assert.equal(expr.children.length, 2);
});
