/**
 * Returns a Tailwind text color class based on match score:
 * - Green (70-100): high match
 * - Yellow (40-69): medium match
 * - Red (0-39): low match
 */
export function getMatchColorClass(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return "text-gray-500";
  const n = Number(score);
  if (n >= 70) return "text-emerald-500";   // green
  if (n >= 40) return "text-amber-500";     // yellow
  return "text-red-500";                     // red
}
