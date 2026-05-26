// Locale JSON is the source of truth for app copy.
// Keep this file small so translation edits land in per-locale JSON files.

import ar from "../../constants/locales/ar.json";
import de from "../../constants/locales/de.json";
import en from "../../constants/locales/en.json";
import es from "../../constants/locales/es.json";
import fa from "../../constants/locales/fa.json";
import fr from "../../constants/locales/fr.json";
import hi from "../../constants/locales/hi.json";
import it from "../../constants/locales/it.json";
import ja from "../../constants/locales/ja.json";
import ko from "../../constants/locales/ko.json";
import pt from "../../constants/locales/pt.json";
import ru from "../../constants/locales/ru.json";
import tl from "../../constants/locales/tl.json";
import vi from "../../constants/locales/vi.json";
import zhHant from "../../constants/locales/zh-Hant.json";
import zh from "../../constants/locales/zh.json";

export const SUPPORTED_LANGUAGES = [
  "English",
  "Spanish",
  "Chinese (Simplified)",
  "Chinese (Traditional)",
  "French",
  "German",
  "Italian",
  "Japanese",
  "Korean",
  "Portuguese",
  "Russian",
  "Arabic",
  "Hindi",
  "Vietnamese",
  "Tagalog",
  "Persian",
] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export type TranslationDictionary = Record<string, string>;

type LocaleTree = Record<string, unknown>;

const localeTreesByLanguage = {
  English: en as LocaleTree,
  Spanish: es as LocaleTree,
  "Chinese (Simplified)": zh as LocaleTree,
  "Chinese (Traditional)": zhHant as LocaleTree,
  French: fr as LocaleTree,
  German: de as LocaleTree,
  Italian: it as LocaleTree,
  Japanese: ja as LocaleTree,
  Korean: ko as LocaleTree,
  Portuguese: pt as LocaleTree,
  Russian: ru as LocaleTree,
  Arabic: ar as LocaleTree,
  Hindi: hi as LocaleTree,
  Vietnamese: vi as LocaleTree,
  Tagalog: tl as LocaleTree,
  Persian: fa as LocaleTree,
} satisfies Record<Language, LocaleTree>;

export const LOCALE_FILE_BY_LANGUAGE = {
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
} as const satisfies Record<Language, string>;

function flattenLocaleTree(value: LocaleTree, prefix = "", output: TranslationDictionary = {}) {
  for (const [key, item] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      flattenLocaleTree(item as LocaleTree, nextKey, output);
    } else if (typeof item === "string") {
      output[nextKey] = item;
    }
  }
  return output;
}

function buildTranslations() {
  const entries = SUPPORTED_LANGUAGES.map((language) => [
    language,
    Object.freeze(flattenLocaleTree(localeTreesByLanguage[language])),
  ]);
  return Object.freeze(Object.fromEntries(entries)) as Readonly<Record<Language, TranslationDictionary>>;
}

export const translations = buildTranslations();

export function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function getTranslationBundle(language: Language) {
  return translations[language];
}

export function getEnglishTranslation(key: string) {
  return translations.English[key] ?? key;
}
