import type { MatchedOpportunity } from "@/services/opportunities/opportunity-matching.service";
import type {
  RoadmapSectionId,
  RoadmapTask,
  UserRoadmapDocument,
} from "@/services/planning/roadmap.service";

export type DeadlineCalendarEntryKind =
  | "scholarship"
  | "internship"
  | "general_deadline"
  | "college_deadline"
  | "roadmap_task";

export type DeadlineCalendarEntryTarget =
  | {
      type: "college";
      collegeId: string;
      externalUrl?: string | null;
    }
  | {
      type: "external";
      url: string;
    }
  | {
      type: "roadmap";
      sectionId: RoadmapSectionId;
      taskId: string;
    }
  | {
      type: "resources";
      opportunityId: string;
    };

export type DeadlineCalendarEntry = {
  id: string;
  dateKey: string;
  dueAt: string;
  title: string;
  subtitle: string;
  description: string;
  kind: DeadlineCalendarEntryKind;
  sourceLabel: string;
  isDone: boolean;
  target: DeadlineCalendarEntryTarget;
  hideFromHomeUpcoming?: boolean;
  revealInCalendarOnlyWhenSelected?: boolean;
};

export type DeadlineCalendarGroup = {
  dateKey: string;
  dueAt: string;
  items: DeadlineCalendarEntry[];
};

export const UPCOMING_DEADLINE_WINDOW_DAYS = 180;

const ROADMAP_SECTION_LABELS: Record<RoadmapSectionId, string> = {
  documents: "Planning documents",
  courses: "Planning courses",
  applications: "Planning applications",
  interests: "Planning interests",
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const UW_SEATTLE_TRANSFER_APPLICATION_DEADLINE_PATTERN =
  /^uw-seattle-transfer-application-deadline-/;

function toDate(value: unknown): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return null;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalDateStartTime(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
}

function compareEntries(left: DeadlineCalendarEntry, right: DeadlineCalendarEntry) {
  if (left.dueAt !== right.dueAt) return left.dueAt.localeCompare(right.dueAt);
  return left.title.localeCompare(right.title);
}

function isUpcomingDueWithinDays(
  value: string,
  days: number,
  now = Date.now()
) {
  const parsed = toDate(value);
  if (!parsed) return false;

  const today = getLocalDateStartTime(new Date(now));
  const dueAt = getLocalDateStartTime(parsed);
  const windowEnd = today + Math.max(0, days) * MILLISECONDS_PER_DAY;
  return dueAt >= today && dueAt <= windowEnd;
}

function buildRoadmapTarget(
  sectionId: RoadmapSectionId,
  taskId: string
): DeadlineCalendarEntryTarget {
  return {
    type: "roadmap",
    sectionId,
    taskId,
  };
}

function getOpportunityDeadlineVisibility(opportunity: MatchedOpportunity) {
  const isUwTransferApplicationDeadline =
    UW_SEATTLE_TRANSFER_APPLICATION_DEADLINE_PATTERN.test(opportunity.opportunityId);

  return {
    hideFromHomeUpcoming: isUwTransferApplicationDeadline,
    revealInCalendarOnlyWhenSelected: isUwTransferApplicationDeadline,
  };
}

function buildOpportunityEntry(
  opportunity: MatchedOpportunity,
  dueDate: Date,
  idSuffix = ""
): DeadlineCalendarEntry {
  let target: DeadlineCalendarEntryTarget = {
    type: "resources",
    opportunityId: opportunity.opportunityId,
  };

  if (
    opportunity.type === "college_deadline" &&
    opportunity.college.collegeId
  ) {
    target = {
      type: "college",
      collegeId: opportunity.college.collegeId,
      externalUrl: opportunity.externalUrl,
    };
  } else if (opportunity.externalUrl) {
    target = {
      type: "external",
      url: opportunity.externalUrl,
    };
  }

  return {
    id: `opportunity:${opportunity.opportunityId}${idSuffix}`,
    dateKey: toDateKey(dueDate),
    dueAt: dueDate.toISOString(),
    title: opportunity.title,
    subtitle:
      opportunity.type === "college_deadline"
        ? opportunity.college.collegeName || opportunity.organizationName || "College deadline"
        : opportunity.type === "general_deadline"
          ? opportunity.organizationName || "General deadline"
          : opportunity.organizationName || "Opportunity",
    description: opportunity.summary,
    kind: opportunity.type,
    sourceLabel:
      opportunity.type === "college_deadline"
        ? "College deadline"
        : opportunity.type === "general_deadline"
          ? "General deadline"
          : "Opportunity",
    isDone: opportunity.isDone,
    target,
    ...getOpportunityDeadlineVisibility(opportunity),
  };
}

function getRoadmapTaskDueDate(task: RoadmapTask): Date | null {
  const candidates = [
    task.metadata?.dueAt,
    task.metadata?.deadline,
    task.metadata?.date,
    task.metadata?.graduationDate,
  ];

  for (const candidate of candidates) {
    const parsed = toDate(candidate);
    if (parsed) return parsed;
  }

  return null;
}

class DeadlineCalendarService {
  buildRoadmapEntries(roadmap: UserRoadmapDocument | null | undefined) {
    if (!roadmap) return [] as DeadlineCalendarEntry[];

    const entries: DeadlineCalendarEntry[] = [];
    const sections = Object.values(roadmap.sections ?? {});

    for (const section of sections) {
      for (const task of section.tasks ?? []) {
        const dueDate = getRoadmapTaskDueDate(task);
        if (!dueDate) continue;

        entries.push({
          id: `roadmap:${section.id}:${task.id}`,
          dateKey: toDateKey(dueDate),
          dueAt: dueDate.toISOString(),
          title: task.title,
          subtitle: ROADMAP_SECTION_LABELS[section.id],
          description: task.description,
          kind: "roadmap_task",
          sourceLabel: "Planner",
          isDone: task.status === "completed",
          target: buildRoadmapTarget(section.id, task.id),
        });
      }
    }

    return entries.sort(compareEntries);
  }

  buildOpportunityEntries(opportunities: MatchedOpportunity[]) {
    const entries: DeadlineCalendarEntry[] = [];

    for (const opportunity of opportunities ?? []) {
      const computedDueDate = toDate(opportunity.computedDueAt);
      const originalDueDate = toDate(opportunity.dueAt);

      if (originalDueDate) {
        entries.push(
          buildOpportunityEntry(
            opportunity,
            originalDueDate,
            computedDueDate &&
              toDateKey(computedDueDate) !== toDateKey(originalDueDate)
              ? `:${toDateKey(originalDueDate)}`
              : ""
          )
        );
      }

      if (
        computedDueDate &&
        (!originalDueDate || toDateKey(computedDueDate) !== toDateKey(originalDueDate))
      ) {
        entries.push(buildOpportunityEntry(opportunity, computedDueDate));
      }
    }

    return entries.sort(compareEntries);
  }

  buildEntries(input: {
    roadmap: UserRoadmapDocument | null | undefined;
    opportunities: MatchedOpportunity[];
  }) {
    return [...this.buildRoadmapEntries(input.roadmap), ...this.buildOpportunityEntries(input.opportunities)].sort(
      compareEntries
    );
  }

  filterUpcomingEntries(entries: DeadlineCalendarEntry[], days = UPCOMING_DEADLINE_WINDOW_DAYS) {
    const now = Date.now();

    return [...(entries ?? [])]
      .filter((entry) => !entry.isDone && isUpcomingDueWithinDays(entry.dueAt, days, now))
      .sort(compareEntries);
  }

  groupEntries(entries: DeadlineCalendarEntry[]) {
    const groups = new Map<string, DeadlineCalendarEntry[]>();

    for (const entry of [...(entries ?? [])].sort(compareEntries)) {
      const existing = groups.get(entry.dateKey) ?? [];
      existing.push(entry);
      groups.set(entry.dateKey, existing);
    }

    return Array.from(groups.entries())
      .map(([dateKey, items]) => ({
        dateKey,
        dueAt: items[0]?.dueAt ?? `${dateKey}T09:00:00.000Z`,
        items: items.sort(compareEntries),
      }))
      .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  }

  filterUpcomingGroups(groups: DeadlineCalendarGroup[], days = UPCOMING_DEADLINE_WINDOW_DAYS) {
    const now = Date.now();

    return [...(groups ?? [])].filter((group) =>
      isUpcomingDueWithinDays(group.dueAt, days, now)
    );
  }
}

export const deadlineCalendarService = new DeadlineCalendarService();
