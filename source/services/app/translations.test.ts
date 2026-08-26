import assert from "node:assert/strict";
import test from "node:test";
import {
  isSupportedLanguage,
  getTranslationBundle,
  getEnglishTranslation,
  SUPPORTED_LANGUAGES,
} from "./translations";

test("isSupportedLanguage correctly identifies supported languages dynamically", () => {
  // Test with actual supported languages
  for (const language of SUPPORTED_LANGUAGES) {
    assert.equal(isSupportedLanguage(language), true);
  }

  // Test with mock unsupported languages
  const mockUnsupportedLanguages = ["Klingon", "Elvish", ""];
  for (const language of mockUnsupportedLanguages) {
    assert.equal(isSupportedLanguage(language), false);
  }
});

test("getTranslationBundle returns a valid translation bundle for each supported language", () => {
  for (const language of SUPPORTED_LANGUAGES) {
    const bundle = getTranslationBundle(language);
    assert.ok(bundle, `Missing bundle for ${language}`);
    assert.equal(typeof bundle, "object", `Bundle for ${language} is not an object`);

    const keys = Object.keys(bundle);
    assert.ok(keys.length > 0, `Bundle for ${language} is empty`);
    assert.equal(typeof bundle[keys[0]], "string", `Translation value for ${language} is not a string`);
  }
});

test("buildTranslations logic flattens nested locale trees into dot-separated keys", () => {
  const firstLanguage = SUPPORTED_LANGUAGES[0];
  const bundle = getTranslationBundle(firstLanguage);

  // General check: No nested objects should exist in the final bundle
  for (const value of Object.values(bundle)) {
    assert.notEqual(typeof value, "object", "Nested object found in flattened bundle");
  }
});

test("getEnglishTranslation returns a valid string or falls back to key using dynamic keys", () => {
  const englishLanguageIndex = SUPPORTED_LANGUAGES.indexOf("English");
  // Only test if English is actually in the supported languages
  if (englishLanguageIndex !== -1) {
    const englishBundle = getTranslationBundle(SUPPORTED_LANGUAGES[englishLanguageIndex]);
    const firstKey = Object.keys(englishBundle)[0];

    if (firstKey) {
      assert.equal(typeof getEnglishTranslation(firstKey), "string");
      assert.equal(getEnglishTranslation(firstKey), englishBundle[firstKey]);
    }
  }

  const mockMissingKey = "mock.missing.key.123";
  assert.equal(getEnglishTranslation(mockMissingKey), mockMissingKey);
});

test("SUPPORTED_LANGUAGES is correctly exported and non-empty", () => {
  assert.ok(SUPPORTED_LANGUAGES.length > 0);
});
