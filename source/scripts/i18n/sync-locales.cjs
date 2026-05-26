#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");
const localesDir = path.join(rootDir, "constants", "locales");
const localeSourceDescription = "constants/locales/*.json";
const isCheckMode = process.argv.includes("--check");

const localeFilesByLanguage = {
  English: "en.json",
  Spanish: "es.json",
  "Chinese (Simplified)": "zh.json",
  "Chinese (Traditional)": "zh-Hant.json",
  French: "fr.json",
  German: "de.json",
  Italian: "it.json",
  Japanese: "ja.json",
  Korean: "ko.json",
  Portuguese: "pt.json",
  Russian: "ru.json",
  Arabic: "ar.json",
  Hindi: "hi.json",
  Vietnamese: "vi.json",
  Tagalog: "tl.json",
  Persian: "fa.json",
};

const mojibakePatterns = [
  { name: "replacement character", pattern: /\uFFFD/ },
  { name: "C1 control character", pattern: /[\u0080-\u009F]/ },
  { name: "UTF-8 arrow/quote/dash mojibake", pattern: /\u00E2(?:\u20AC|\u2020|\u2018|\u2019|\u201C|\u201D|\u2026|\u0098|\u0099|\u009C|\u009D)/ },
  { name: "Vietnamese UTF-8 mojibake", pattern: /\u00E1[\u00BA\u00BB]/ },
  { name: "Arabic/Persian UTF-8 mojibake", pattern: /[\u00D8\u00D9\u00DA\u00DB][\u0080-\u00BF\u0100-\u017F]/ },
  { name: "Cyrillic UTF-8 mojibake", pattern: /[\u00D0\u00D1][\u0080-\u00BF]/ },
  { name: "Latin-1 UTF-8 mojibake", pattern: /\u00C3[\u0080-\u00BF]/ },
];

function fail(message, details = []) {
  console.error(message);
  for (const detail of details.slice(0, 30)) {
    console.error(`  - ${detail}`);
  }
  if (details.length > 30) {
    console.error(`  ...and ${details.length - 30} more`);
  }
  process.exitCode = 1;
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function setNested(target, key, value) {
  const parts = key.split(".");
  let current = target;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (index === parts.length - 1) {
      current[part] = value;
      return;
    }
    current[part] = current[part] ?? {};
    if (typeof current[part] !== "object" || Array.isArray(current[part])) {
      throw new Error(`Cannot nest locale key "${key}" because "${parts.slice(0, index + 1).join(".")}" already has a value.`);
    }
    current = current[part];
  }
}

function flatten(value, prefix = "", output = {}) {
  for (const [key, item] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      flatten(item, nextKey, output);
    } else {
      output[nextKey] = item;
    }
  }
  return output;
}

function toNestedDictionary(bundle) {
  const nested = {};
  for (const key of Object.keys(bundle).sort()) {
    setNested(nested, key, bundle[key]);
  }
  return nested;
}

function findMojibake(value) {
  const matches = [];
  for (const { name, pattern } of mojibakePatterns) {
    if (pattern.test(value)) {
      matches.push(name);
    }
  }
  return matches;
}

function validateBundles(translations) {
  const errors = [];
  const languages = Object.keys(translations);
  const expectedLanguages = Object.keys(localeFilesByLanguage);
  const languageSet = new Set(languages);
  const englishKeys = Object.keys(translations.English ?? {}).sort();
  const englishKeySet = new Set(englishKeys);

  for (const language of expectedLanguages) {
    if (!languageSet.has(language)) {
      errors.push(`Missing canonical language bundle: ${language}`);
    }
  }

  for (const language of languages) {
    if (!localeFilesByLanguage[language]) {
      errors.push(`No generated locale filename is mapped for language: ${language}`);
    }
  }

  for (const language of languages) {
    const bundle = translations[language];
    if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
      errors.push(`Invalid translation bundle for ${language}`);
      continue;
    }

    const keys = Object.keys(bundle).sort();
    const keySet = new Set(keys);
    for (const key of englishKeys) {
      if (!keySet.has(key)) {
        errors.push(`${language} is missing key ${key}`);
      }
    }
    for (const key of keys) {
      if (!englishKeySet.has(key)) {
        errors.push(`${language} has extra key ${key}`);
      }
      if (typeof bundle[key] !== "string") {
        errors.push(`${language}.${key} must be a string`);
        continue;
      }
      const mojibakeReasons = findMojibake(bundle[key]);
      if (mojibakeReasons.length > 0) {
        errors.push(`${language}.${key} looks mojibaked (${mojibakeReasons.join(", ")}): ${JSON.stringify(bundle[key])}`);
      }
    }
  }

  return errors;
}

function loadTranslations() {
  const translations = {};

  for (const [language, fileName] of Object.entries(localeFilesByLanguage)) {
    const filePath = path.join(localesDir, fileName);
    if (!fs.existsSync(filePath)) {
      translations[language] = undefined;
      continue;
    }

    try {
      translations[language] = flatten(JSON.parse(fs.readFileSync(filePath, "utf8")));
    } catch (error) {
      throw new Error(`Failed to read ${fileName}: ${error.message}`);
    }
  }

  return translations;
}

function main() {
  const translations = loadTranslations();
  const bundleErrors = validateBundles(translations);
  if (bundleErrors.length > 0) {
    fail("Translation validation failed.", bundleErrors);
    return;
  }

  fs.mkdirSync(localesDir, { recursive: true });

  const expectedFiles = new Set();
  const staleFiles = [];
  const changedFiles = [];

  for (const [language, fileName] of Object.entries(localeFilesByLanguage)) {
    expectedFiles.add(fileName);
    const expected = stableStringify(toNestedDictionary(translations[language]));
    const filePath = path.join(localesDir, fileName);

    if (isCheckMode) {
      if (!fs.existsSync(filePath)) {
        changedFiles.push(`${fileName} is missing`);
        continue;
      }
      const actualJson = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const actualFlat = flatten(actualJson);
      const actualMojibake = [];
      for (const [key, value] of Object.entries(actualFlat)) {
        if (typeof value !== "string") continue;
        const reasons = findMojibake(value);
        if (reasons.length > 0) {
          actualMojibake.push(`${fileName}.${key} looks mojibaked (${reasons.join(", ")}): ${JSON.stringify(value)}`);
        }
      }
      if (actualMojibake.length > 0) {
        fail("Locale JSON mojibake check failed.", actualMojibake);
        return;
      }
      const actual = stableStringify(actualJson);
      if (actual !== expected) {
        changedFiles.push(`${fileName} is stale`);
      }
    } else {
      fs.writeFileSync(filePath, expected);
    }
  }

  for (const fileName of fs.readdirSync(localesDir).filter((name) => name.endsWith(".json")).sort()) {
    if (!expectedFiles.has(fileName)) {
      staleFiles.push(fileName);
    }
  }

  if (isCheckMode) {
    if (staleFiles.length > 0) {
      fail("Unexpected generated locale files found.", staleFiles);
      return;
    }
    if (changedFiles.length > 0) {
      fail("Locale JSON files need normalization. Run npm run i18n:generate.", changedFiles);
      return;
    }
    console.log(`i18n check passed: ${Object.keys(localeFilesByLanguage).length} locales, ${Object.keys(translations.English).length} keys each.`);
    return;
  }

  for (const fileName of staleFiles) {
    fs.unlinkSync(path.join(localesDir, fileName));
  }

  console.log(`Normalized ${Object.keys(localeFilesByLanguage).length} locale files from ${localeSourceDescription} (${Object.keys(translations.English).length} keys each).`);
}

main();
