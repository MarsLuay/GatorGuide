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
};

export type DeadlineCalendarGroup = {
  dateKey: string;
  dueAt: string;
  items: DeadlineCalendarEntry[];
};

const ROADMAP_SECTION_LABELS: Record<RoadmapSectionId, string> = {
  documents: "Roadmap documents",
  courses: "Roadmap courses",
  applications: "Roadmap applications",
  interests: "Roadmap interests",
};

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

function compareEntries(left: DeadlineCalendarEntry, right: DeadlineCalendarEntry) {
  if (left.dueAt !== right.dueAt) return left.dueAt.localeCompare(right.dueAt);
  return left.title.localeCompare(right.title);
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
          sourceLabel: "Roadmap",
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
      if (!opportunity.computedDueAt) continue;

      const parsed = toDate(opportunity.computedDueAt);
      if (!parsed) continue;

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

      entries.push({
        id: `opportunity:${opportunity.opportunityId}`,
        dateKey: toDateKey(parsed),
        dueAt: parsed.toISOString(),
        title: opportunity.title,
        subtitle:
          opportunity.type === "college_deadline"
            ? opportunity.college.collegeName || opportunity.organizationName || "College deadline"
            : opportunity.type === "general_deadline"
              ? opportunity.organizationName || "Deadline"
            : opportunity.organizationName || "Opportunity",
        description: opportunity.summary,
        kind: opportunity.type,
        sourceLabel:
          opportunity.type === "college_deadline"
            ? "College deadline"
            : opportunity.type === "general_deadline"
              ? "Deadline"
              : "Opportunity",
        isDone: opportunity.isDone,
        target,
      });
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
}

export const deadlineCalendarService = new DeadlineCalendarService();
