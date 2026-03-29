import type { Language } from "@/services/translations";

export const LANGUAGE_TO_LOCALE: Record<Language, string> = {
  English: "en-US",
  Spanish: "es-ES",
  "Chinese (Simplified)": "zh-CN",
  "Chinese (Traditional)": "zh-TW",
  French: "fr-FR",
  German: "de-DE",
  Italian: "it-IT",
  Japanese: "ja-JP",
  Korean: "ko-KR",
  Portuguese: "pt-BR",
  Russian: "ru-RU",
  Arabic: "ar",
  Hindi: "hi-IN",
  Vietnamese: "vi-VN",
  Tagalog: "fil-PH",
  Persian: "fa-IR",
};

export function getLocaleForLanguage(language?: Language) {
  return language ? LANGUAGE_TO_LOCALE[language] ?? "en-US" : "en-US";
}

export function formatLocalizedNumber(
  value: number,
  language?: Language,
  options?: Intl.NumberFormatOptions
) {
  return new Intl.NumberFormat(getLocaleForLanguage(language), options).format(value);
}

export function formatLocalizedCurrency(
  value: number,
  language?: Language,
  options?: Omit<Intl.NumberFormatOptions, "style" | "currency">
) {
  return new Intl.NumberFormat(getLocaleForLanguage(language), {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    ...options,
  }).format(value);
}

export function formatLocalizedPercent(
  value: number,
  language?: Language,
  options?: Omit<Intl.NumberFormatOptions, "style">
) {
  return new Intl.NumberFormat(getLocaleForLanguage(language), {
    style: "percent",
    maximumFractionDigits: 0,
    ...options,
  }).format(value);
}
