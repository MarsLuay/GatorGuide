"use strict";

/**
 * P17 i18n generation contract harness (static validation only).
 * Does not mutate locale JSON — P17-D owns providers.
 */

const REQUIRED_LOCALE_COUNT = 16;

function tokenizePlaceholders(str) {
  const matches = String(str).match(/\{\{[^}]+\}\}|\{[a-zA-Z0-9_.]+\}/g) || [];
  return matches.slice().sort();
}

function validateTranslationPair(source, translated, { glossary = {} } = {}) {
  const errors = [];
  const srcTokens = tokenizePlaceholders(source);
  const dstTokens = tokenizePlaceholders(translated);
  if (JSON.stringify(srcTokens) !== JSON.stringify(dstTokens)) {
    errors.push({
      type: "placeholder-multiset-mismatch",
      expected: srcTokens,
      actual: dstTokens,
    });
  }
  for (const [term, required] of Object.entries(glossary)) {
    if (source.includes(term) && required && !translated.includes(term)) {
      errors.push({ type: "glossary-term-missing", term });
    }
  }
  return { ok: errors.length === 0, errors };
}

function validateLocaleSet(locales) {
  const list = Array.isArray(locales) ? locales : [];
  return {
    ok: list.length === REQUIRED_LOCALE_COUNT,
    count: list.length,
    required: REQUIRED_LOCALE_COUNT,
  };
}

module.exports = {
  REQUIRED_LOCALE_COUNT,
  tokenizePlaceholders,
  validateTranslationPair,
  validateLocaleSet,
};
