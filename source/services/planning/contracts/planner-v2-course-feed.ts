/**
 * Derive unavailable quarter ids from planner preferences (e.g. no summer).
 */

import { buildPlanningQuarterSequence } from "@/services/planning/contracts/living-plan-engine-runtime";

export function buildUnavailableQuartersFromPrefs(input: {
  intendedTransferQuarter: string | null;
  allowSummerClasses: boolean;
  existing?: string[];
}): string[] {
  const existing = [...(input.existing || [])].map((q) => String(q).trim()).filter(Boolean);
  if (input.allowSummerClasses || !input.intendedTransferQuarter) {
    return existing.filter((q) => !/-summer$/i.test(q));
  }

  const window = buildPlanningQuarterSequence(input.intendedTransferQuarter, 12, []);
  const summers = window.filter((q) => /-summer$/i.test(q));
  const set = new Set([...existing.filter((q) => !/-summer$/i.test(q)), ...summers]);
  return [...set].sort();
}

export function courseCodesFromTranscriptCourses(
  courses: Array<{ code?: string | null; label?: string | null }> | null | undefined
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const course of courses || []) {
    const code = String(course?.code || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}
