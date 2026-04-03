import type { College } from '@/services/colleges/college.service';
import {
  ROADMAP_DOCUMENT_KEYS,
  ROADMAP_SECTION_ORDER,
  type RoadmapDocumentKey,
  type RoadmapTask,
  type UserRoadmapDocument,
} from '@/services/planning/roadmap.service';

export const AI_CONVERSATION_CONTEXT_SCHEMA_VERSION = '2026-03-19.v1' as const;

const MAX_CONTEXT_STRING_LENGTH = 240;
const MAX_QUESTIONNAIRE_DEPTH = 4;
const MAX_QUESTIONNAIRE_ARRAY_ITEMS = 20;
const MAX_QUESTIONNAIRE_OBJECT_KEYS = 40;
const MAX_SAVED_COLLEGES = 12;
const MAX_TOP_MATCHES = 5;
const MAX_PROGRAMS_PER_COLLEGE = 8;
const MAX_PENDING_TASKS = 10;
const MAX_LIST_ITEMS = 10;

export type AiConversationSource = {
  screen?: string | null;
  route?: string | null;
};

export type AiConversationProfile = {
  isGuest: boolean;
  major: string | null;
  gender: string | null;
  gpa: string | null;
  homeState: string | null;
  residencyType: string | null;
  englishProficiency: string | null;
  englishTestType: string | null;
  englishTestValue: string | null;
  isProfileComplete: boolean;
};

export type AiConversationCollegeSummary = {
  id: string;
  name: string;
  location: {
    city: string | null;
    state: string | null;
  };
  matchScore: number | null;
  tuition: number | null;
  tuitionInState: number | null;
  tuitionOutOfState: number | null;
  avgNetPriceOverall: number | null;
  admissionRate: number | null;
  completionRate: number | null;
  pellGrantRate: number | null;
  medianDebtCompletersOverall: number | null;
  size: string | null;
  studentSize: number | null;
  setting: string | null;
  locale: string | null;
  degreesAwarded: {
    highest: string | null;
    predominant: string | null;
  } | null;
  programs: string[];
};

export type AiConversationRoadmapSummary = {
  status: string;
  updatedAt: string | null;
  generatedAt: string | null;
  progress: {
    completedCount: number;
    totalCount: number;
    percent: number;
  };
  snapshot: {
    major: string | null;
    gpa: string | null;
    currentCourses: string[];
    targetSchools: string[];
    interests: string[];
    requiredCourses: string[];
    recommendedCourses: string[];
    deadline: string | null;
    graduationDate: string | null;
  };
  sections: {
    id: string;
    title: string;
    status: string;
    progress: {
      completedCount: number;
      totalCount: number;
      percent: number;
    };
  }[];
  pendingTasks: {
    sectionId: string;
    id: string;
    type: string;
    title: string;
    status: string;
  }[];
  documents: {
    completedCount: number;
    totalCount: number;
    items: {
      key: RoadmapDocumentKey;
      status: string;
      updatedAt: string | null;
      uploaded: boolean;
    }[];
  } | null;
};

export type AiConversationContext = {
  schemaVersion: typeof AI_CONVERSATION_CONTEXT_SCHEMA_VERSION;
  generatedAt: string;
  source: AiConversationSource | null;
  profile: AiConversationProfile;
  questionnaire: Record<string, unknown>;
  savedColleges: AiConversationCollegeSummary[];
  topMatches: AiConversationCollegeSummary[];
  roadmap: AiConversationRoadmapSummary | null;
};

export type AiConversationContextInput = {
  source?: AiConversationSource | null;
  user?: {
    isGuest?: boolean;
    major?: string | null;
    gender?: string | null;
    gpa?: string | number | null;
    state?: string | null;
    residencyType?: string | null;
    englishProficiency?: string | null;
    englishTestType?: string | null;
    englishTestValue?: string | null;
    isProfileComplete?: boolean | null;
  } | null;
  questionnaireAnswers?: Record<string, unknown> | null;
  savedColleges?: College[] | null;
  topMatches?: College[] | null;
  roadmap?: UserRoadmapDocument | null;
};

function cleanString(value: unknown, maxLength = MAX_CONTEXT_STRING_LENGTH): string | null {
  if (value == null) return null;
  const cleaned = String(value).trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function cleanNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function uniqueStrings(values: unknown, maxItems = MAX_LIST_ITEMS): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = cleanString(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= maxItems) break;
  }

  return result;
}

function sanitizeQuestionnaireValue(value: unknown, depth = 0): unknown {
  if (value == null) return null;
  if (typeof value === 'string') return cleanString(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (depth >= MAX_QUESTIONNAIRE_DEPTH) return null;

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_QUESTIONNAIRE_ARRAY_ITEMS)
      .map((item) => sanitizeQuestionnaireValue(item, depth + 1))
      .filter((item) => item !== null);
  }

  if (typeof value === 'object') {
    const sanitizedEntries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, MAX_QUESTIONNAIRE_OBJECT_KEYS)
      .map(([key, childValue]) => [key, sanitizeQuestionnaireValue(childValue, depth + 1)] as const)
      .filter(([, childValue]) => childValue !== null);

    return Object.fromEntries(sanitizedEntries);
  }

  return null;
}

function summarizeCollege(college: College): AiConversationCollegeSummary {
  return {
    id: String(college.id ?? ''),
    name: cleanString(college.name, 120) ?? 'Unknown College',
    location: {
      city: cleanString(college.location?.city, 80),
      state: cleanString(college.location?.state, 40),
    },
    matchScore: cleanNumber(college.matchScore),
    tuition: cleanNumber(college.tuition),
    tuitionInState: cleanNumber(college.tuitionInState),
    tuitionOutOfState: cleanNumber(college.tuitionOutOfState),
    avgNetPriceOverall: cleanNumber(college.avgNetPriceOverall),
    admissionRate: cleanNumber(college.admissionRate),
    completionRate: cleanNumber(college.completionRate),
    pellGrantRate: cleanNumber(college.pellGrantRate),
    medianDebtCompletersOverall: cleanNumber(college.medianDebtCompletersOverall),
    size: cleanString(college.size, 40),
    studentSize: cleanNumber(college.studentSize),
    setting: cleanString(college.setting, 40),
    locale: cleanString(college.locale, 80),
    degreesAwarded: college.degreesAwarded
      ? {
          highest: cleanString(college.degreesAwarded.highest, 80),
          predominant: cleanString(college.degreesAwarded.predominant, 80),
        }
      : null,
    programs: uniqueStrings(college.programs, MAX_PROGRAMS_PER_COLLEGE),
  };
}

function summarizePendingTask(sectionId: string, task: RoadmapTask) {
  return {
    sectionId,
    id: String(task.id ?? ''),
    type: cleanString(task.type, 40) ?? 'milestone',
    title: cleanString(task.title, 160) ?? 'Untitled task',
    status: cleanString(task.status, 40) ?? 'not_started',
  };
}

function summarizeRoadmap(roadmap?: UserRoadmapDocument | null): AiConversationRoadmapSummary | null {
  if (!roadmap) return null;

  const sections = ROADMAP_SECTION_ORDER.map((sectionId) => {
    const section = roadmap.sections[sectionId];
    return {
      id: section.id,
      title: cleanString(section.title, 80) ?? section.id,
      status: cleanString(section.status, 40) ?? 'not_started',
      progress: {
        completedCount: cleanNumber(section.progress.completedCount) ?? 0,
        totalCount: cleanNumber(section.progress.totalCount) ?? 0,
        percent: cleanNumber(section.progress.percent) ?? 0,
      },
    };
  });

  const pendingTasks = ROADMAP_SECTION_ORDER.flatMap((sectionId) =>
    roadmap.sections[sectionId].tasks
      .filter((task) => task.status !== 'completed')
      .map((task) => summarizePendingTask(sectionId, task))
  ).slice(0, MAX_PENDING_TASKS);

  const documentsTask = roadmap.sections.documents.tasks.find((task) => task.id === 'documents-checklist');
  const documentItems = documentsTask?.documents
    ? ROADMAP_DOCUMENT_KEYS.map((key) => {
        const item = documentsTask.documents?.[key];
        return {
          key,
          status: cleanString(item?.status, 40) ?? 'not_started',
          updatedAt: cleanString(item?.updatedAt, 80),
          uploaded: item?.status === 'completed',
        };
      })
    : null;

  return {
    status: cleanString(roadmap.status, 40) ?? 'not_started',
    updatedAt: cleanString(roadmap.updatedAt, 80),
    generatedAt: cleanString(roadmap.generatedAt, 80),
    progress: {
      completedCount: cleanNumber(roadmap.progress.completedCount) ?? 0,
      totalCount: cleanNumber(roadmap.progress.totalCount) ?? 0,
      percent: cleanNumber(roadmap.progress.percent) ?? 0,
    },
    snapshot: {
      major: cleanString(roadmap.profileSnapshot.major, 120),
      gpa: cleanString(roadmap.profileSnapshot.gpa, 40),
      currentCourses: uniqueStrings(roadmap.profileSnapshot.currentCourses),
      targetSchools: uniqueStrings(roadmap.profileSnapshot.targetSchools),
      interests: uniqueStrings(roadmap.profileSnapshot.interests),
      requiredCourses: uniqueStrings(roadmap.profileSnapshot.requiredCourses),
      recommendedCourses: uniqueStrings(roadmap.profileSnapshot.recommendedCourses),
      deadline: cleanString(roadmap.profileSnapshot.deadline, 80),
      graduationDate: cleanString(roadmap.profileSnapshot.graduationDate, 80),
    },
    sections,
    pendingTasks,
    documents: documentItems
      ? {
          completedCount: documentItems.filter((item) => item.uploaded).length,
          totalCount: documentItems.length,
          items: documentItems,
        }
      : null,
  };
}

function deriveTopMatches(savedColleges: College[], explicitTopMatches?: College[] | null) {
  if (explicitTopMatches?.length) {
    return explicitTopMatches.slice(0, MAX_TOP_MATCHES).map(summarizeCollege);
  }

  return [...savedColleges]
    .filter((college) => typeof college.matchScore === 'number' && Number.isFinite(college.matchScore))
    .sort((left, right) => (right.matchScore ?? 0) - (left.matchScore ?? 0))
    .slice(0, MAX_TOP_MATCHES)
    .map(summarizeCollege);
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== 'object') return JSON.stringify(input);
  if (Array.isArray(input)) return `[${input.map((value) => stableStringify(value)).join(',')}]`;
  const keys = Object.keys(input as Record<string, unknown>).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify((input as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

export function buildAiConversationContext(input: AiConversationContextInput): AiConversationContext {
  const savedColleges = Array.isArray(input.savedColleges) ? input.savedColleges.slice(0, MAX_SAVED_COLLEGES) : [];
  const questionnaire = sanitizeQuestionnaireValue(input.questionnaireAnswers ?? {}, 0);

  return {
    schemaVersion: AI_CONVERSATION_CONTEXT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: input.source
      ? {
          screen: cleanString(input.source.screen, 80),
          route: cleanString(input.source.route, 120),
        }
      : null,
    profile: {
      isGuest: !!input.user?.isGuest,
      major: cleanString(input.user?.major, 120),
      gender: cleanString(input.user?.gender, 80),
      gpa: cleanString(input.user?.gpa, 40),
      homeState: cleanString(input.user?.state, 40),
      residencyType: cleanString(input.user?.residencyType, 80),
      englishProficiency: cleanString(input.user?.englishProficiency, 80),
      englishTestType: cleanString(input.user?.englishTestType, 80),
      englishTestValue: cleanString(input.user?.englishTestValue, 80),
      isProfileComplete: !!input.user?.isProfileComplete,
    },
    questionnaire: (questionnaire && typeof questionnaire === 'object' ? questionnaire : {}) as Record<string, unknown>,
    savedColleges: savedColleges.map(summarizeCollege),
    topMatches: deriveTopMatches(savedColleges, input.topMatches),
    roadmap: summarizeRoadmap(input.roadmap),
  };
}

export function serializeAiConversationContext(context: AiConversationContext): string {
  return stableStringify(context);
}
