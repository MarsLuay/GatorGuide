import assert from "node:assert/strict";
import test from "node:test";
import { getQuestionnaireAnswerText } from "@/services/app/questionnaire.enums";

test("getQuestionnaireAnswerText handles null/undefined answers object gracefully", () => {
  assert.equal(getQuestionnaireAnswerText(null, "fieldId"), "");
  assert.equal(getQuestionnaireAnswerText(undefined, "fieldId"), "");
});

test("getQuestionnaireAnswerText returns empty string for missing fields", () => {
  const answers = { otherField: "test" };
  assert.equal(getQuestionnaireAnswerText(answers, "fieldId"), "");
});

test("getQuestionnaireAnswerText returns string values as is", () => {
  const answers = { fieldId: "test string" };
  assert.equal(getQuestionnaireAnswerText(answers, "fieldId"), "test string");
});

test("getQuestionnaireAnswerText converts number values to strings", () => {
  assert.equal(getQuestionnaireAnswerText({ fieldId: 42 }, "fieldId"), "42");
  assert.equal(getQuestionnaireAnswerText({ fieldId: 0 }, "fieldId"), "0");
  assert.equal(getQuestionnaireAnswerText({ fieldId: -1.5 }, "fieldId"), "-1.5");
  assert.equal(getQuestionnaireAnswerText({ fieldId: NaN }, "fieldId"), "NaN");
});

test("getQuestionnaireAnswerText converts boolean values to strings", () => {
  assert.equal(getQuestionnaireAnswerText({ fieldId: true }, "fieldId"), "true");
  assert.equal(getQuestionnaireAnswerText({ fieldId: false }, "fieldId"), "false");
});

test("getQuestionnaireAnswerText returns empty string for unsupported types (objects, arrays, null)", () => {
  assert.equal(getQuestionnaireAnswerText({ fieldId: { key: "value" } }, "fieldId"), "");
  assert.equal(getQuestionnaireAnswerText({ fieldId: ["a", "b"] }, "fieldId"), "");
  assert.equal(getQuestionnaireAnswerText({ fieldId: null }, "fieldId"), "");
  // Undefined in field
  assert.equal(getQuestionnaireAnswerText({ fieldId: undefined }, "fieldId"), "");
});
