/**
 * P18 calendar helper: offline Living Plan → Deadline Calendar entries.
 * Keeps controller thin; Firestore/roadmap not required when plannerV2 is present.
 */

import type { DeadlineCalendarEntry } from "@/services/deadlines/deadline-calendar.service";
import { timelineEntriesToCalendarEntries } from "@/services/deadlines/personalized-timeline-calendar";
import type { PlannerV2State } from "@/hooks/app-data/planner-state-v2";
import { projectOfflineTimelineFromPlannerV2 } from "@/hooks/app-data/planner-offline";
import type { TimelineEntry } from "@/services/planning/contracts/timeline-opportunities";

export function projectPlannerV2OfflineCalendarEntries(
  plannerV2: PlannerV2State | null | undefined
): DeadlineCalendarEntry[] {
  const offline = projectOfflineTimelineFromPlannerV2(plannerV2, []);
  const timeline: TimelineEntry[] = offline
    .filter((entry) => entry.sourceType === "living-plan")
    .map((entry) => ({
      id: entry.id,
      sourceType: "living-plan" as const,
      dueAt: entry.dueAt,
      destination: "transferPlanner" as const,
      message: {
        code: "quarter_milestone",
        params: { quarter: entry.dueAt },
      },
    }));
  return timelineEntriesToCalendarEntries(timeline);
}
