/**
 * Coerce free-text / questionnaire deadline answers into plannerV2 quarter ids.
 */

const SEASON_ALIASES: Record<string, string> = {
  fall: "fall",
  autumn: "fall",
  winter: "winter",
  spring: "spring",
  summer: "summer",
};

export type IntendedTransferSeason = "winter" | "spring" | "summer" | "fall";

/** Courses-per-quarter options shown in Transfer Planner constraints. */
export const PREFERRED_LOAD_OPTIONS = [1, 2, 3, 4] as const;
export const DEFAULT_PREFERRED_LOAD = 3;
export const MIN_PREFERRED_LOAD = PREFERRED_LOAD_OPTIONS[0];
export const MAX_PREFERRED_LOAD = PREFERRED_LOAD_OPTIONS[PREFERRED_LOAD_OPTIONS.length - 1];
export const INTENDED_TRANSFER_SEASONS: IntendedTransferSeason[] = [
  "winter",
  "spring",
  "summer",
  "fall",
];

export function clampPreferredLoad(value: number | null | undefined): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_PREFERRED_LOAD;
  return Math.max(MIN_PREFERRED_LOAD, Math.min(MAX_PREFERRED_LOAD, Math.round(n)));
}

function seasonFromMonthIndex(monthIndex: number): IntendedTransferSeason {
  if (monthIndex <= 2) return "winter";
  if (monthIndex <= 5) return "spring";
  if (monthIndex <= 7) return "summer";
  return "fall";
}

export function buildIntendedTransferQuarterId(
  year: number,
  season: IntendedTransferSeason
): string {
  return `${year}-${season}`;
}

export function parseIntendedTransferQuarter(
  raw: unknown
): { year: number; season: IntendedTransferSeason } | null {
  const coerced = coerceIntendedTransferQuarter(raw);
  if (!coerced) return null;
  const match = coerced.match(/^(20\d{2})-(winter|spring|summer|fall)$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    season: match[2] as IntendedTransferSeason,
  };
}

export function formatIntendedTransferQuarterLabel(raw: unknown): string | null {
  const parsed = parseIntendedTransferQuarter(raw);
  if (!parsed) return null;
  const season = parsed.season.charAt(0).toUpperCase() + parsed.season.slice(1);
  return `${season} ${parsed.year}`;
}

export function coerceIntendedTransferQuarter(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const normalized = text.toLowerCase().replace(/\bautumn\b/g, "fall");

  const iso = normalized.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return null;
    }
    return buildIntendedTransferQuarterId(year, seasonFromMonthIndex(month - 1));
  }

  const compact = normalized.match(/\b(20\d{2})[-_ ]?(winter|spring|summer|fall)\b/);
  if (compact) return `${compact[1]}-${compact[2]}`;

  const flipped = normalized.match(/\b(winter|spring|summer|fall)[-_ ]?(20\d{2})\b/);
  if (flipped) return `${flipped[2]}-${flipped[1]}`;

  const prose = normalized.match(
    /\b(winter|spring|summer|fall)\b(?:\s+\w+){0,3}\s+(20\d{2})\b/
  );
  if (prose) {
    const season = SEASON_ALIASES[prose[1]] || prose[1];
    return `${prose[2]}-${season}`;
  }

  return null;
}

export function coercePreferredLoad(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < MIN_PREFERRED_LOAD || rounded > MAX_PREFERRED_LOAD) return null;
  return rounded;
}
