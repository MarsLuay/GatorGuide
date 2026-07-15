
"use strict";
/** P03-E Requirement Model v1 header + compatibility shim. */

const { createRequirementSetIdentity, serializeIdentity } = require("./identities.cjs");
const {
  validateExpression,
  atom,
  allOf,
  chooseN,
  EXPRESSION_KINDS,
} = require("./expressions.cjs");
const { createCourseConstraint } = require("./academic-rules.cjs");
const { createEvidence, attachEvidence } = require("./evidence.cjs");

const REQUIREMENT_MODEL_VERSION = "1.0.0";

function createRequirementModelDocument(input = {}) {
  const identity = createRequirementSetIdentity(input.identity || input);
  const expression = input.expression || allOf([]);
  const expressionErrors = validateExpression(expression);
  if (expressionErrors.length) {
    return {
      ok: false,
      version: REQUIREMENT_MODEL_VERSION,
      identity,
      diagnostics: expressionErrors.map((message) => ({
        kind: "invalid-expression",
        message,
      })),
    };
  }
  return {
    ok: true,
    version: REQUIREMENT_MODEL_VERSION,
    identity,
    expression,
    constraints: [...(input.constraints || [])],
    evidence: input.evidence || null,
  };
}

/** Temporary adapter: wrap a legacy course-code list as allOf atoms. */
function legacyCourseListToExpression(courseCodes = []) {
  return allOf(courseCodes.map((code) => atom(code)));
}

module.exports = {
  REQUIREMENT_MODEL_VERSION,
  createRequirementModelDocument,
  legacyCourseListToExpression,
  createRequirementSetIdentity,
  serializeIdentity,
  validateExpression,
  atom,
  allOf,
  chooseN,
  EXPRESSION_KINDS,
  createCourseConstraint,
  createEvidence,
  attachEvidence,
};
