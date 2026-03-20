export const MATCH_SCORE_THRESHOLDS = Object.freeze({
  high: 70,
  medium: 40,
});

export type MatchScoreTier = "high" | "medium" | "low" | "unknown";

export function normalizeMatchScore(score: number | null | undefined): number | null {
  if (score == null || !Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Number(score)));
}

export function formatMatchScore(score: number | null | undefined): string | null {
  const normalized = normalizeMatchScore(score);
  if (normalized === null) return null;
  return `${Math.round(normalized)}%`;
}

export function getMatchScoreTier(score: number | null | undefined): MatchScoreTier {
  const normalized = normalizeMatchScore(score);
  if (normalized === null) return "unknown";
  if (normalized >= MATCH_SCORE_THRESHOLDS.high) return "high";
  if (normalized >= MATCH_SCORE_THRESHOLDS.medium) return "medium";
  return "low";
}

/**
 * Shared text color for match scores:
 * - Green (70-100): high match
 * - Yellow (40-69): medium match
 * - Red (0-39): low match
 */
export function getMatchColorClass(score: number | null | undefined): string {
  switch (getMatchScoreTier(score)) {
    case "high":
      return "text-emerald-600";
    case "medium":
      return "text-amber-600";
    case "low":
      return "text-red-600";
    default:
      return "text-gray-500";
  }
}

export function getMatchBadgeClass(score: number | null | undefined): string {
  switch (getMatchScoreTier(score)) {
    case "high":
      return "border-emerald-400/40 bg-emerald-500/10";
    case "medium":
      return "border-amber-400/40 bg-amber-500/10";
    case "low":
      return "border-red-400/40 bg-red-500/10";
    default:
      return "border-gray-400/30 bg-gray-500/10";
  }
}
