
"use strict";
/** P03-B boolean/quantity requirement expressions. */

const EXPRESSION_KINDS = Object.freeze([
  "allOf",
  "anyOf",
  "chooseN",
  "creditThreshold",
  "courseSequence",
  "approvedList",
  "compoundEquivalency",
  "atom",
]);

function assertKind(kind) {
  if (!EXPRESSION_KINDS.includes(kind)) {
    throw new Error(`invalid expression kind: ${kind}`);
  }
}

function atom(courseCode, extras = {}) {
  assertKind("atom");
  if (!courseCode) throw new Error("atom requires courseCode");
  return { kind: "atom", courseCode, ...extras };
}

function allOf(children) {
  return { kind: "allOf", children: [...(children || [])] };
}
function anyOf(children) {
  return { kind: "anyOf", children: [...(children || [])] };
}
function chooseN(n, children) {
  if (!Number.isInteger(n) || n < 1) throw new Error("chooseN requires positive integer");
  return { kind: "chooseN", n, children: [...(children || [])] };
}
function creditThreshold(credits, children = []) {
  if (!(credits > 0)) throw new Error("creditThreshold requires credits > 0");
  return { kind: "creditThreshold", credits, children: [...children] };
}
function courseSequence(children) {
  return { kind: "courseSequence", children: [...(children || [])] };
}
function approvedList(filter, children = []) {
  return { kind: "approvedList", filter: filter || null, children: [...children] };
}
function compoundEquivalency(components) {
  return { kind: "compoundEquivalency", components: [...(components || [])] };
}

/** Evaluate structural validity only (not student satisfaction). */
function validateExpression(expr, path = "$") {
  if (!expr || typeof expr !== "object") {
    return [`${path}: expression must be object`];
  }
  const errors = [];
  try {
    assertKind(expr.kind);
  } catch (e) {
    return [`${path}: ${e.message}`];
  }
  if (expr.kind === "atom") {
    if (!expr.courseCode) errors.push(`${path}: atom.courseCode required`);
    return errors;
  }
  if (expr.kind === "chooseN" && (!Number.isInteger(expr.n) || expr.n < 1)) {
    errors.push(`${path}: chooseN.n invalid`);
  }
  if (expr.kind === "creditThreshold" && !(expr.credits > 0)) {
    errors.push(`${path}: creditThreshold.credits invalid`);
  }
  const kids = expr.children || expr.components || [];
  kids.forEach((child, i) => {
    errors.push(...validateExpression(child, `${path}.${expr.kind}[${i}]`));
  });
  return errors;
}

function evaluateChooseNShape(expr) {
  if (expr.kind !== "chooseN") return null;
  return { n: expr.n, optionCount: (expr.children || []).length };
}

module.exports = {
  EXPRESSION_KINDS,
  atom,
  allOf,
  anyOf,
  chooseN,
  creditThreshold,
  courseSequence,
  approvedList,
  compoundEquivalency,
  validateExpression,
  evaluateChooseNShape,
};
