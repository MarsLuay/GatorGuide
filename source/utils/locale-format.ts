import type { Language } from "@/services/app/translations";

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

export function normalizeRateValue(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;

  let normalized = value;
  if (normalized > 1 && normalized <= 100) {
    normalized = normalized / 100;
  } else if (normalized > 0 && normalized < 0.01) {
    // Heal older or double-normalized cache values like 0.003915 -> 0.3915.
    normalized = normalized * 100;
  }

  return Math.min(1, Math.max(0, normalized));
}

export function formatLocalizedRate(
  value: number | null | undefined,
  language?: Language,
  options?: Omit<Intl.NumberFormatOptions, "style">
) {
  const normalized = normalizeRateValue(value);
  if (normalized === null) return null;
  return formatLocalizedPercent(normalized, language, options);
}
