import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

export const ROADMAP_SCHEMA_VERSION = 2 as const;
export const ROADMAP_SECTION_ORDER = ["documents", "courses", "applications", "interests"] as const;
export const ROADMAP_DOCUMENT_KEYS = [
  "resume",
  "transcripts",
  "personalStatement",
  "recommendation1",
  "recommendation2",
] as const;

export type RoadmapSectionId = (typeof ROADMAP_SECTION_ORDER)[number];
export type RoadmapDocumentKey = (typeof ROADMAP_DOCUMENT_KEYS)[number];
export type RoadmapStatus = "not_started" | "in_progress" | "completed";
export type RoadmapTaskType = "document_checklist" | "course" | "application" | "interest" | "milestone";

export interface RoadmapProgress {
  completedCount: number;
  totalCount: number;
  percent: number;
  updatedAt: string;
}

export interface RoadmapDocumentItem {
  key: RoadmapDocumentKey;
  status: RoadmapStatus;
  fileName: string | null;
  fileUrl: string | null;
  updatedAt: string | null;
}

export interface RoadmapTask {
  id: string;
  type: RoadmapTaskType;
  title: string;
  description: string;
  status: RoadmapStatus;
  notes: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  progress: RoadmapProgress;
  metadata?: Record<string, string>;
  documents?: Record<RoadmapDocumentKey, RoadmapDocumentItem>;
}

export interface RoadmapSection {
  id: RoadmapSectionId;
  title: string;
  status: RoadmapStatus;
  order: number;
  progress: RoadmapProgress;
  tasks: RoadmapTask[];
}

export interface RoadmapProfileSnapshot {
  major: string;
  gpa: string;
  currentCourses: string[];
  targetSchools: string[];
  interests: string[];
  requiredCourses: string[];
  recommendedCourses: string[];
  deadline: string;
  graduationDate: string;
}

export interface UserRoadmapDocument {
  userId: string;
  version: typeof ROADMAP_SCHEMA_VERSION;
  status: RoadmapStatus;
  progress: RoadmapProgress;
  profileSnapshot: RoadmapProfileSnapshot;
  sections: Record<RoadmapSectionId, RoadmapSection>;
  createdAt: string;
  updatedAt: string;
  generatedAt: string;
}

export interface RoadmapSeedInput {
  major?: string | null;
  gpa?: string | null;
  questionnaireAnswers?: Record<string, unknown> | null;
  targetSchools?: string[];
  currentCourses?: string[];
  interests?: string[];
  documents?: Partial<Record<RoadmapDocumentKey, { fileName?: string | null; fileUrl?: string | null }>>;
}

type TaskMutation = (task: RoadmapTask) => RoadmapTask;

const FALLBACK_SECTION_TITLES: Record<RoadmapSectionId, string> = {
  documents: "Documents",
  courses: "Current Courses",
  applications: "Applications",
  interests: "Interests",
};

const VALID_STATUSES: RoadmapStatus[] = ["not_started", "in_progress", "completed"];
const VALID_TASK_TYPES: RoadmapTaskType[] = ["document_checklist", "course", "application", "interest", "milestone"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

function splitList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(
      value.map((item) => (typeof item === "string" ? item : String(item ?? "").trim()))
    );
  }

  const raw = String(value ?? "").trim();
  if (!raw) return [];

  return uniqueStrings(
    raw
      .split(/\r?\n|,|;/)
      .map((item) => item.replace(/^[\s\-*•]+/, "").trim())
  );
}

function timestampToIso(value: unknown, fallback: string): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (isRecord(value) && typeof value.toDate === "function") {
    try {
      const converted = value.toDate();
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        return converted.toISOString();
      }
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function nullableTimestampToIso(value: unknown): string | null {
  if (value == null) return null;
  const now = new Date().toISOString();
  const iso = timestampToIso(value, now);
  return iso || null;
}

function createProgress(completedCount: number, totalCount: number, updatedAt: string): RoadmapProgress {
  const safeTotal = Math.max(0, totalCount);
  const safeCompleted = Math.min(Math.max(0, completedCount), safeTotal);
  return {
    completedCount: safeCompleted,
    totalCount: safeTotal,
    percent: safeTotal === 0 ? 0 : Math.round((safeCompleted / safeTotal) * 100),
    updatedAt,
  };
}

function statusFromCounts(completedCount: number, totalCount: number): RoadmapStatus {
  if (totalCount <= 0 || completedCount <= 0) return "not_started";
  if (completedCount >= totalCount) return "completed";
  return "in_progress";
}

function aggregateStatus(statuses: RoadmapStatus[], completedCount: number, totalCount: number): RoadmapStatus {
  if (totalCount > 0 && completedCount >= totalCount) return "completed";
  if (completedCount > 0 || statuses.some((status) => status === "in_progress")) return "in_progress";
  return "not_started";
}

function normalizeStatus(value: unknown, fallback: RoadmapStatus): RoadmapStatus {
  return VALID_STATUSES.includes(value as RoadmapStatus) ? (value as RoadmapStatus) : fallback;
}

function normalizeTaskType(value: unknown, fallback: RoadmapTaskType): RoadmapTaskType {
  return VALID_TASK_TYPES.includes(value as RoadmapTaskType) ? (value as RoadmapTaskType) : fallback;
}

function defaultDocuments(now: string): Record<RoadmapDocumentKey, RoadmapDocumentItem> {
  return ROADMAP_DOCUMENT_KEYS.reduce((acc, key) => {
    acc[key] = {
      key,
      status: "not_started",
      fileName: null,
      fileUrl: null,
      updatedAt: null,
    };
    return acc;
  }, {} as Record<RoadmapDocumentKey, RoadmapDocumentItem>);
}

function normalizeDocuments(
  rawDocuments: unknown,
  seedDocuments: RoadmapSeedInput["documents"] | undefined,
  fallbackUpdatedAt: string
): Record<RoadmapDocumentKey, RoadmapDocumentItem> {
  const defaults = defaultDocuments(fallbackUpdatedAt);
  const rawRecord = isRecord(rawDocuments) ? rawDocuments : {};

  for (const key of ROADMAP_DOCUMENT_KEYS) {
    const rawItem = isRecord(rawRecord[key]) ? rawRecord[key] : {};
    const seeded = seedDocuments?.[key];
    const rawFileName = String(rawItem.fileName ?? seeded?.fileName ?? "").trim() || null;
    const rawFileUrl = String(rawItem.fileUrl ?? seeded?.fileUrl ?? "").trim() || null;
    const rawUpdatedAt = nullableTimestampToIso(rawItem.updatedAt) ?? (rawFileName || rawFileUrl ? fallbackUpdatedAt : null);

    const completed = normalizeStatus(rawItem.status, rawFileName || rawFileUrl ? "completed" : "not_started");

    defaults[key] = {
      key,
      status: rawFileName || rawFileUrl ? "completed" : completed,
      fileName: rawFileName,
      fileUrl: rawFileUrl,
      updatedAt: rawUpdatedAt,
    };
  }

  return defaults;
}

function deriveTaskProgress(task: RoadmapTask, updatedAt: string): RoadmapProgress {
  if (task.documents) {
    const items = Object.values(task.documents);
    const completedCount = items.filter((item) => item.status === "completed").length;
    return createProgress(completedCount, items.length, updatedAt);
  }

  return createProgress(task.status === "completed" ? 1 : 0, 1, updatedAt);
}

function finalizeTask(task: RoadmapTask): RoadmapTask {
  const updatedAt = task.updatedAt || new Date().toISOString();
  const progress = deriveTaskProgress(task, updatedAt);
  const status = task.documents
    ? statusFromCounts(progress.completedCount, progress.totalCount)
    : normalizeStatus(task.status, task.completedAt ? "completed" : "not_started");

  return {
    ...task,
    status,
    progress,
    completedAt:
      status === "completed"
        ? task.completedAt || updatedAt
        : null,
  };
}

function finalizeSection(section: RoadmapSection, fallbackUpdatedAt: string): RoadmapSection {
  const tasks = [...section.tasks]
    .map((task) => finalizeTask(task))
    .sort((a, b) => a.order - b.order);

  const totalCount = tasks.reduce((sum, task) => sum + task.progress.totalCount, 0);
  const completedCount = tasks.reduce((sum, task) => sum + task.progress.completedCount, 0);
  const updatedAt = tasks.reduce((latest, task) => (task.updatedAt > latest ? task.updatedAt : latest), fallbackUpdatedAt);

  return {
    ...section,
    title: section.title || FALLBACK_SECTION_TITLES[section.id],
    tasks,
    progress: createProgress(completedCount, totalCount, updatedAt),
    status: aggregateStatus(
      tasks.map((task) => task.status),
      completedCount,
      totalCount
    ),
  };
}

function finalizeRoadmap(roadmap: UserRoadmapDocument): UserRoadmapDocument {
  const sections = ROADMAP_SECTION_ORDER.reduce((acc, sectionId) => {
    const existing = roadmap.sections[sectionId];
    acc[sectionId] = finalizeSection(
      existing ?? {
        id: sectionId,
        title: FALLBACK_SECTION_TITLES[sectionId],
        order: ROADMAP_SECTION_ORDER.indexOf(sectionId),
        status: "not_started",
        progress: createProgress(0, 0, roadmap.updatedAt),
        tasks: [],
      },
      roadmap.updatedAt
    );
    return acc;
  }, {} as Record<RoadmapSectionId, RoadmapSection>);

  const totalCount = ROADMAP_SECTION_ORDER.reduce((sum, sectionId) => sum + sections[sectionId].progress.totalCount, 0);
  const completedCount = ROADMAP_SECTION_ORDER.reduce((sum, sectionId) => sum + sections[sectionId].progress.completedCount, 0);
  const updatedAt = ROADMAP_SECTION_ORDER.reduce((latest, sectionId) => {
    const next = sections[sectionId].progress.updatedAt;
    return next > latest ? next : latest;
  }, roadmap.updatedAt);

  return {
    ...roadmap,
    version: ROADMAP_SCHEMA_VERSION,
    sections,
    progress: createProgress(completedCount, totalCount, updatedAt),
    status: aggregateStatus(
      ROADMAP_SECTION_ORDER.map((sectionId) => sections[sectionId].status),
      completedCount,
      totalCount
    ),
    updatedAt,
  };
}

function createTask(input: {
  id: string;
  type: RoadmapTaskType;
  title: string;
  description: string;
  order: number;
  createdAt: string;
  metadata?: Record<string, string>;
  documents?: Record<RoadmapDocumentKey, RoadmapDocumentItem>;
  notes?: string[];
  status?: RoadmapStatus;
}): RoadmapTask {
  return finalizeTask({
    id: input.id,
    type: input.type,
    title: input.title,
    description: input.description,
    status: input.status ?? "not_started",
    notes: uniqueStrings(input.notes ?? []),
    order: input.order,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    completedAt: null,
    progress: createProgress(0, 0, input.createdAt),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...(input.documents ? { documents: input.documents } : {}),
  });
}

function createDocumentChecklistTask(
  createdAt: string,
  seedDocuments?: RoadmapSeedInput["documents"]
): RoadmapTask {
  const documents = normalizeDocuments(undefined, seedDocuments, createdAt);
  return createTask({
    id: "documents-checklist",
    type: "document_checklist",
    title: "Application document checklist",
    description: "Keep your transfer documents organized and ready to submit.",
    order: 0,
    createdAt,
    documents,
  });
}

function createEmptySections(createdAt: string, seedDocuments?: RoadmapSeedInput["documents"]) {
  return ROADMAP_SECTION_ORDER.reduce((acc, sectionId, index) => {
    acc[sectionId] = finalizeSection(
      {
        id: sectionId,
        title: FALLBACK_SECTION_TITLES[sectionId],
        order: index,
        status: "not_started",
        progress: createProgress(0, 0, createdAt),
        tasks: sectionId === "documents" ? [createDocumentChecklistTask(createdAt, seedDocuments)] : [],
      },
      createdAt
    );
    return acc;
  }, {} as Record<RoadmapSectionId, RoadmapSection>);
}

function inferSectionFromLegacyCategory(category: unknown): RoadmapSectionId {
  switch (String(category ?? "").toLowerCase()) {
    case "documents":
      return "documents";
    case "academics":
    case "courses":
      return "courses";
    case "applications":
      return "applications";
    case "interests":
      return "interests";
    default:
      return "applications";
  }
}

function normalizeTaskFromUnknown(
  rawTask: unknown,
  sectionId: RoadmapSectionId,
  index: number,
  fallbackCreatedAt: string,
  seedDocuments?: RoadmapSeedInput["documents"]
): RoadmapTask {
  const taskRecord = isRecord(rawTask) ? rawTask : {};
  const createdAt = timestampToIso(taskRecord.createdAt, fallbackCreatedAt);
  const updatedAt = timestampToIso(taskRecord.updatedAt, createdAt);
  const fallbackType: RoadmapTaskType =
    sectionId === "documents"
      ? "document_checklist"
      : sectionId === "courses"
        ? "course"
        : sectionId === "applications"
          ? "application"
          : "interest";

  const type = normalizeTaskType(taskRecord.type, fallbackType);
  const documents =
    type === "document_checklist" || isRecord(taskRecord.documents)
      ? normalizeDocuments(taskRecord.documents, seedDocuments, updatedAt)
      : undefined;

  const rawCompleted = typeof taskRecord.completed === "boolean" ? taskRecord.completed : undefined;
  const seededStatus = rawCompleted ? "completed" : documents ? "not_started" : "not_started";

  return finalizeTask({
    id: String(taskRecord.id ?? `${sectionId}-${index + 1}`),
    type,
    title: String(taskRecord.title ?? "Untitled task").trim() || "Untitled task",
    description: String(taskRecord.description ?? "").trim(),
    status: normalizeStatus(taskRecord.status, seededStatus),
    notes: Array.isArray(taskRecord.notes) ? taskRecord.notes.map((note) => String(note ?? "").trim()) : [],
    order: Number.isFinite(Number(taskRecord.order)) ? Number(taskRecord.order) : index,
    createdAt,
    updatedAt,
    completedAt: nullableTimestampToIso(taskRecord.completedAt),
    progress: createProgress(0, 0, updatedAt),
    ...(isRecord(taskRecord.metadata) ? { metadata: Object.fromEntries(Object.entries(taskRecord.metadata).map(([key, value]) => [key, String(value ?? "")])) } : {}),
    ...(documents ? { documents } : {}),
  });
}

function buildTaskListsFromSeed(seed: RoadmapSeedInput, createdAt: string) {
  const questionnaire = isRecord(seed.questionnaireAnswers) ? seed.questionnaireAnswers : {};
  const currentCourses = uniqueStrings([
    ...splitList(seed.currentCourses),
    ...splitList(questionnaire.requiredCourses),
    ...splitList(questionnaire.recommendedCourses),
  ]);
  const targetSchools = uniqueStrings([
    ...splitList(seed.targetSchools),
  ]);
  const interests = uniqueStrings([
    ...splitList(seed.interests),
    ...splitList(questionnaire.extracurriculars),
    ...splitList(questionnaire.internships),
    ...splitList(questionnaire.platforms),
  ]);

  const major = String(seed.major ?? questionnaire.major ?? "").trim();
  const gpa = String(seed.gpa ?? questionnaire.gpa ?? "").trim();
  const deadline = String(questionnaire.deadline ?? "").trim();
  const graduationDate = String(questionnaire.graduationDate ?? "").trim();

  const documentTasks: RoadmapTask[] = [];
  const courseTasks: RoadmapTask[] = [];
  const applicationTasks: RoadmapTask[] = [];
  const interestTasks: RoadmapTask[] = [];

  if (major) {
    documentTasks.push(
      createTask({
        id: "resume-tailor",
        type: "milestone",
        title: "Refine your resume",
        description: `Tailor your resume for ${major} transfer applications and internships.`,
        order: 1,
        createdAt,
        metadata: { major },
      })
    );
  }

  if (gpa) {
    courseTasks.push(
      createTask({
        id: "gpa-maintenance",
        type: "milestone",
        title: "Maintain your GPA",
        description: `You are currently at ${gpa}. Keep your coursework strong for transfer applications.`,
        order: 0,
        createdAt,
        metadata: { gpa },
      })
    );
  }

  currentCourses.forEach((courseName, index) => {
    courseTasks.push(
      createTask({
        id: `course-${courseName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        type: "course",
        title: `Stay on track in ${courseName}`,
        description: "Check this course against your transfer requirements and keep your materials organized.",
        order: courseTasks.length,
        createdAt,
        metadata: { courseName },
      })
    );
  });

  applicationTasks.push(
    createTask({
      id: "transfer-credit-research",
      type: "milestone",
      title: "Research transfer credit policies",
      description: major
        ? `Check how your completed coursework transfers into ${major} programs.`
        : "Check how your completed coursework transfers into your target programs.",
      order: 0,
      createdAt,
      ...(major ? { metadata: { major } } : {}),
    })
  );

  if (deadline) {
    applicationTasks.push(
      createTask({
        id: "application-deadline",
        type: "milestone",
        title: "Track your transfer deadline",
        description: `Keep your timeline aligned with your target deadline: ${deadline}.`,
        order: 1,
        createdAt,
        metadata: { deadline },
      })
    );
  }

  if (graduationDate) {
    applicationTasks.push(
      createTask({
        id: "graduation-plan",
        type: "milestone",
        title: "Align your graduation timeline",
        description: `Make sure your transfer plan fits your expected graduation date: ${graduationDate}.`,
        order: applicationTasks.length,
        createdAt,
        metadata: { graduationDate },
      })
    );
  }

  targetSchools.forEach((schoolName) => {
    applicationTasks.push(
      createTask({
        id: `submit-${schoolName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        type: "application",
        title: `Prepare your ${schoolName} application`,
        description: "Track requirements, essay work, and document readiness for this school.",
        order: applicationTasks.length,
        createdAt,
        metadata: { schoolName },
      })
    );
  });

  interests.forEach((interestName) => {
    interestTasks.push(
      createTask({
        id: `interest-${interestName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        type: "interest",
        title: `Build momentum around ${interestName}`,
        description: "Use this as a place to capture ideas, next steps, and related opportunities.",
        order: interestTasks.length,
        createdAt,
        metadata: { interestName },
      })
    );
  });

  return {
    currentCourses,
    targetSchools,
    interests,
    requiredCourses: splitList(questionnaire.requiredCourses),
    recommendedCourses: splitList(questionnaire.recommendedCourses),
    deadline,
    graduationDate,
    documentTasks,
    courseTasks,
    applicationTasks,
    interestTasks,
  };
}

export function buildRoadmapSeedInput(seed: RoadmapSeedInput): RoadmapSeedInput {
  const questionnaire = isRecord(seed.questionnaireAnswers) ? seed.questionnaireAnswers : {};

  return {
    major: String(seed.major ?? questionnaire.major ?? "").trim(),
    gpa: String(seed.gpa ?? questionnaire.gpa ?? "").trim(),
    questionnaireAnswers: questionnaire,
    targetSchools: uniqueStrings(splitList(seed.targetSchools)),
    currentCourses: uniqueStrings([
      ...splitList(seed.currentCourses),
      ...splitList(questionnaire.requiredCourses),
      ...splitList(questionnaire.recommendedCourses),
    ]),
    interests: uniqueStrings([
      ...splitList(seed.interests),
      ...splitList(questionnaire.extracurriculars),
      ...splitList(questionnaire.internships),
      ...splitList(questionnaire.platforms),
    ]),
    documents: seed.documents,
  };
}

export function createInitialRoadmap(userId: string, seedInput: RoadmapSeedInput): UserRoadmapDocument {
  const createdAt = new Date().toISOString();
  const seed = buildRoadmapSeedInput(seedInput);
  const sections = createEmptySections(createdAt, seed.documents);
  const lists = buildTaskListsFromSeed(seed, createdAt);

  sections.documents.tasks = [sections.documents.tasks[0], ...lists.documentTasks];
  sections.courses.tasks = lists.courseTasks;
  sections.applications.tasks = lists.applicationTasks;
  sections.interests.tasks = lists.interestTasks;

  return finalizeRoadmap({
    userId,
    version: ROADMAP_SCHEMA_VERSION,
    status: "not_started",
    progress: createProgress(0, 0, createdAt),
    profileSnapshot: {
      major: String(seed.major ?? "").trim(),
      gpa: String(seed.gpa ?? "").trim(),
      currentCourses: lists.currentCourses,
      targetSchools: lists.targetSchools,
      interests: lists.interests,
      requiredCourses: lists.requiredCourses,
      recommendedCourses: lists.recommendedCourses,
      deadline: lists.deadline,
      graduationDate: lists.graduationDate,
    },
    sections,
    createdAt,
    updatedAt: createdAt,
    generatedAt: createdAt,
  });
}

function normalizeRoadmapDocument(
  userId: string,
  rawData: unknown,
  seedInput?: RoadmapSeedInput
): UserRoadmapDocument {
  const now = new Date().toISOString();
  const raw = isRecord(rawData) ? rawData : {};
  const seed = seedInput ? buildRoadmapSeedInput(seedInput) : undefined;
  const createdAt = timestampToIso(raw.createdAt ?? raw.lastUpdated ?? raw.generatedAt, now);
  const updatedAt = timestampToIso(raw.updatedAt ?? raw.lastUpdated ?? raw.generatedAt, createdAt);
  const generatedAt = timestampToIso(raw.generatedAt ?? raw.createdAt ?? raw.lastUpdated, createdAt);
  const seedRoadmap = createInitialRoadmap(userId, seed ?? {});
  const sections = createEmptySections(createdAt, seed?.documents);

  if (isRecord(raw.sections)) {
    for (const sectionId of ROADMAP_SECTION_ORDER) {
      const rawSection = isRecord(raw.sections[sectionId]) ? raw.sections[sectionId] : {};
      const rawTasks = Array.isArray(rawSection.tasks) ? rawSection.tasks : [];
      sections[sectionId] = {
        id: sectionId,
        title: String(rawSection.title ?? FALLBACK_SECTION_TITLES[sectionId]).trim() || FALLBACK_SECTION_TITLES[sectionId],
        order: Number.isFinite(Number(rawSection.order)) ? Number(rawSection.order) : ROADMAP_SECTION_ORDER.indexOf(sectionId),
        status: normalizeStatus(rawSection.status, "not_started"),
        progress: createProgress(0, 0, updatedAt),
        tasks:
          rawTasks.length > 0
            ? rawTasks.map((task, index) => normalizeTaskFromUnknown(task, sectionId, index, createdAt, seed?.documents))
            : sectionId === "documents"
              ? [createDocumentChecklistTask(createdAt, seed?.documents)]
              : [],
      };
    }
  } else if (Array.isArray(raw.tasks)) {
    sections.documents.tasks = [createDocumentChecklistTask(createdAt, seed?.documents)];
    raw.tasks.forEach((task, index) => {
      const sectionId = inferSectionFromLegacyCategory(isRecord(task) ? task.category : undefined);
      sections[sectionId].tasks.push(normalizeTaskFromUnknown(task, sectionId, sections[sectionId].tasks.length + index, createdAt, seed?.documents));
    });
  } else {
    return seedRoadmap;
  }

  if (!sections.documents.tasks.some((task) => task.id === "documents-checklist")) {
    sections.documents.tasks.unshift(createDocumentChecklistTask(createdAt, seed?.documents));
  }

  return finalizeRoadmap({
    userId,
    version: ROADMAP_SCHEMA_VERSION,
    status: normalizeStatus(raw.status, "not_started"),
    progress: createProgress(0, 0, updatedAt),
    profileSnapshot: {
      major: String(raw.profileSnapshot && isRecord(raw.profileSnapshot) ? raw.profileSnapshot.major ?? seedRoadmap.profileSnapshot.major : seedRoadmap.profileSnapshot.major).trim(),
      gpa: String(raw.profileSnapshot && isRecord(raw.profileSnapshot) ? raw.profileSnapshot.gpa ?? seedRoadmap.profileSnapshot.gpa : seedRoadmap.profileSnapshot.gpa).trim(),
      currentCourses:
        raw.profileSnapshot && isRecord(raw.profileSnapshot)
          ? uniqueStrings(splitList(raw.profileSnapshot.currentCourses))
          : seedRoadmap.profileSnapshot.currentCourses,
      targetSchools:
        raw.profileSnapshot && isRecord(raw.profileSnapshot)
          ? uniqueStrings(splitList(raw.profileSnapshot.targetSchools))
          : seedRoadmap.profileSnapshot.targetSchools,
      interests:
        raw.profileSnapshot && isRecord(raw.profileSnapshot)
          ? uniqueStrings(splitList(raw.profileSnapshot.interests))
          : seedRoadmap.profileSnapshot.interests,
      requiredCourses:
        raw.profileSnapshot && isRecord(raw.profileSnapshot)
          ? uniqueStrings(splitList(raw.profileSnapshot.requiredCourses))
          : seedRoadmap.profileSnapshot.requiredCourses,
      recommendedCourses:
        raw.profileSnapshot && isRecord(raw.profileSnapshot)
          ? uniqueStrings(splitList(raw.profileSnapshot.recommendedCourses))
          : seedRoadmap.profileSnapshot.recommendedCourses,
      deadline: String(raw.profileSnapshot && isRecord(raw.profileSnapshot) ? raw.profileSnapshot.deadline ?? seedRoadmap.profileSnapshot.deadline : seedRoadmap.profileSnapshot.deadline).trim(),
      graduationDate: String(raw.profileSnapshot && isRecord(raw.profileSnapshot) ? raw.profileSnapshot.graduationDate ?? seedRoadmap.profileSnapshot.graduationDate : seedRoadmap.profileSnapshot.graduationDate).trim(),
    },
    sections,
    createdAt,
    updatedAt,
    generatedAt,
  });
}

function updateSectionTask(
  roadmap: UserRoadmapDocument,
  sectionId: RoadmapSectionId,
  taskId: string,
  mutateTask: TaskMutation
): UserRoadmapDocument {
  const now = new Date().toISOString();
  const section = roadmap.sections[sectionId];
  if (!section) return roadmap;

  return finalizeRoadmap({
    ...roadmap,
    updatedAt: now,
    sections: {
      ...roadmap.sections,
      [sectionId]: {
        ...section,
        tasks: section.tasks.map((task) => {
          if (task.id !== taskId) return task;
          return mutateTask({
            ...task,
            updatedAt: now,
          });
        }),
      },
    },
  });
}

function saveAllowed(userId: string) {
  return !!db && !!String(userId).trim();
}

export const roadmapService = {
  buildRoadmapSeedInput,

  createInitialRoadmap,

  async getUserRoadmap(userId: string, seedInput?: RoadmapSeedInput): Promise<UserRoadmapDocument | null> {
    if (!saveAllowed(userId)) {
      return seedInput ? createInitialRoadmap(userId, seedInput) : null;
    }

    const docSnap = await getDoc(doc(db!, "roadmaps", userId));
    if (!docSnap.exists()) {
      return seedInput ? createInitialRoadmap(userId, seedInput) : null;
    }

    return normalizeRoadmapDocument(userId, docSnap.data(), seedInput);
  },

  async ensureUserRoadmap(userId: string, seedInput: RoadmapSeedInput): Promise<UserRoadmapDocument> {
    const seed = buildRoadmapSeedInput(seedInput);
    const existing = await this.getUserRoadmap(userId, seed);
    if (!existing) {
      const created = createInitialRoadmap(userId, seed);
      if (saveAllowed(userId)) {
        await setDoc(doc(db!, "roadmaps", userId), created);
      }
      return created;
    }

    if (saveAllowed(userId)) {
      await setDoc(doc(db!, "roadmaps", userId), existing, { merge: true });
    }
    return existing;
  },

  async saveUserRoadmap(userId: string, roadmap: UserRoadmapDocument): Promise<UserRoadmapDocument> {
    const normalized = finalizeRoadmap({
      ...roadmap,
      userId,
      updatedAt: new Date().toISOString(),
    });

    if (saveAllowed(userId)) {
      await setDoc(doc(db!, "roadmaps", userId), normalized);
    }

    return normalized;
  },

  setTaskCompletion(
    roadmap: UserRoadmapDocument,
    sectionId: RoadmapSectionId,
    taskId: string,
    completed: boolean
  ): UserRoadmapDocument {
    return updateSectionTask(roadmap, sectionId, taskId, (task) => ({
      ...task,
      status: completed ? "completed" : "not_started",
      completedAt: completed ? task.updatedAt : null,
    }));
  },

  addTaskNote(
    roadmap: UserRoadmapDocument,
    sectionId: RoadmapSectionId,
    taskId: string,
    note: string
  ): UserRoadmapDocument {
    const cleaned = note.trim();
    if (!cleaned) return roadmap;

    return updateSectionTask(roadmap, sectionId, taskId, (task) => ({
      ...task,
      notes: uniqueStrings([...task.notes, cleaned]),
      status: task.status === "completed" ? task.status : "in_progress",
    }));
  },

  addSectionTask(
    roadmap: UserRoadmapDocument,
    sectionId: RoadmapSectionId,
    taskInput: {
      id: string;
      type: RoadmapTaskType;
      title: string;
      description: string;
      metadata?: Record<string, string>;
    }
  ): UserRoadmapDocument {
    const now = new Date().toISOString();
    const section = roadmap.sections[sectionId];
    const existing = section?.tasks ?? [];
    if (!section) return roadmap;
    if (existing.some((task) => task.id === taskInput.id)) return roadmap;

    const nextTask = createTask({
      ...taskInput,
      order: existing.length,
      createdAt: now,
    });

    return finalizeRoadmap({
      ...roadmap,
      updatedAt: now,
      sections: {
        ...roadmap.sections,
        [sectionId]: {
          ...section,
          tasks: [...existing, nextTask],
        },
      },
    });
  },

  removeSectionTask(
    roadmap: UserRoadmapDocument,
    sectionId: RoadmapSectionId,
    taskId: string
  ): UserRoadmapDocument {
    const section = roadmap.sections[sectionId];
    if (!section) return roadmap;
    if (taskId === "documents-checklist") return roadmap;

    const remainingTasks = section.tasks
      .filter((task) => task.id !== taskId)
      .map((task, index) => ({ ...task, order: index }));

    return finalizeRoadmap({
      ...roadmap,
      updatedAt: new Date().toISOString(),
      sections: {
        ...roadmap.sections,
        [sectionId]: {
          ...section,
          tasks: remainingTasks,
        },
      },
    });
  },

  updateRoadmapDocument(
    roadmap: UserRoadmapDocument,
    documentKey: RoadmapDocumentKey,
    file?: { fileName?: string | null; fileUrl?: string | null } | null
  ): UserRoadmapDocument {
    const now = new Date().toISOString();
    const documentsTask = roadmap.sections.documents.tasks.find((task) => task.id === "documents-checklist");
    if (!documentsTask?.documents) return roadmap;

    return updateSectionTask(roadmap, "documents", "documents-checklist", (task) => {
      if (!task.documents) return task;

      return {
        ...task,
        documents: {
          ...task.documents,
          [documentKey]: {
            key: documentKey,
            status: file?.fileName || file?.fileUrl ? "completed" : "not_started",
            fileName: file?.fileName?.trim() || null,
            fileUrl: file?.fileUrl?.trim() || null,
            updatedAt: file?.fileName || file?.fileUrl ? now : null,
          },
        },
      };
    });
  },

  generateInitialRoadmap(userId: string, seedInput: RoadmapSeedInput): Promise<UserRoadmapDocument> {
    return this.ensureUserRoadmap(userId, seedInput);
  },
};
