/**
 * P16-D bridge: Personalized Timeline entries → Deadline Calendar entries.
 * Living-plan + personal sources only. Opportunities stay on the calendar
 * opportunity path; roadmap tasks are excluded when Living Plan is primary.
 */

import type { TimelineEntry } from "@/services/planning/contracts/timeline-opportunities";
import type { DeadlineCalendarEntry } from "@/services/deadlines/deadline-calendar.service";

function toDateKey(isoOrDateKey: string): string | null {
  const raw = String(isoOrDateKey || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const quarter = raw.toLowerCase().replace(/\bautumn\b/g, "fall").match(
    /^(20\d{2})[-_ ]?(winter|spring|summer|fall)$/
  );
  if (quarter) {
    const year = quarter[1];
    const season = quarter[2];
    const month =
      season === "winter" ? "01" : season === "spring" ? "04" : season === "summer" ? "07" : "10";
    return `${year}-${month}-01`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function timelineEntriesToCalendarEntries(
  entries: TimelineEntry[]
): DeadlineCalendarEntry[] {
  const out: DeadlineCalendarEntry[] = [];
  for (const entry of entries || []) {
    // Opportunities already flow through deadlineCalendarService opportunity path.
    if (entry.sourceType === "opportunity") continue;
    const dateKey = toDateKey(entry.dueAt);
    if (!dateKey) continue;
    const dueAt = entry.dueAt.includes("T") ? entry.dueAt : `${dateKey}T09:00:00.000Z`;
    if (entry.sourceType === "living-plan") {
      out.push({
        id: entry.id,
        dateKey,
        dueAt,
        title: entry.message.params.quarter || entry.id,
        subtitle: "",
        subtitleKey: "deadlineCalendar.kindPlannerMilestone",
        description: "",
        kind: "general_deadline",
        sourceLabel: "Transfer Planner",
        sourceLabelKey: "deadlineCalendar.sourcePlanner",
        isDone: Boolean(entry.done),
        target: { type: "planner", milestoneId: entry.id },
      });
      continue;
    }
    if (entry.sourceType === "personal") {
      out.push({
        id: entry.id,
        dateKey,
        dueAt,
        title: entry.message.params.id || entry.id,
        subtitle: "",
        subtitleKey: "deadlineCalendar.kindPersonalDeadline",
        description: "",
        kind: "general_deadline",
        sourceLabel: "Personal",
        sourceLabelKey: "deadlineCalendar.sourcePersonal",
        isDone: Boolean(entry.done),
        target: { type: "personal", personalId: entry.id },
      });
    }
  }
  return out;
}
