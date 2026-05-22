import type {
  AiConversationCollegeSummary,
  AiConversationContext,
} from '@/services/ai/ai-context.service';
import type { College } from '@/services/colleges/college.service';

export type UserProfile = {
  isGuest?: boolean;
  name?: string | null;
  email?: string | null;
  uid?: string | null;
  major?: string | null;
  gpa?: number | string | null;
  state?: string | null;
  [key: string]: unknown;
};

export type Questionnaire = {
  budget?: string;
  costOfAttendance?: string;
  classSize?: string;
  collegeSize?: string;
  transportation?: string;
  companiesNearby?: string;
  inStateOutOfState?: string;
  geography?: string;
  location?: string;
  locationPreferences?: string;
  housing?: string;
  housingPreference?: string;
  ranking?: string;
  continueEducation?: string;
  extracurriculars?: string;
  careerGoals?: string;
  programs?: string;
  volunteerActivities?: string;
  useWeightedSearch?: boolean;
  [key: string]: unknown;
};

export type MajorEvidenceLevel = 'A' | 'B' | 'C' | 'D' | 'E';
export type DisabledInfluenceKey = 'gpa' | 'prestige' | 'major' | 'preference' | 'query' | 'ai';
export type DisabledInfluences = Partial<Record<DisabledInfluenceKey, boolean>>;

export type PreferenceBreakdown = Record<string, number> & { final: number };
export type RecommendationBreakdown = Record<string, number | string | boolean | null | undefined> & {
  final?: number;
  finalScore?: number;
  finalBaseScore?: number;
  aiFactor?: number;
  queryMatch?: number;
  majorEvidenceCount?: number;
  majorEvidenceLevel?: MajorEvidenceLevel;
  waMrpParticipant?: number;
};

export type RecommendResult = {
  college: College;
  reason?: string;
  breakdown?: RecommendationBreakdown;
  score?: number;
  breakdownHuman?: Record<string, string>;
  scoreText?: string;
};

export type EmptyStateCode =
  | 'IN_STATE_STATE_MISSING'
  | 'IN_STATE_NO_MATCHES'
  | 'NO_RESULTS'
  | 'QUERY_NO_RESULTS'
  | 'LLM_NO_RESOLVABLE'
  | 'NETWORK_TIMEOUT'
  | 'UPSTREAM_ERROR';

export type EmptyState = {
  code: EmptyStateCode;
  title: string;
  message: string;
};

export type RecommendResponse = {
  results: RecommendResult[];
  emptyState?: EmptyState;
};

export type RecommendDebug = {
  timestamp: string;
  mode: 'weighted' | 'search';
  query: string;
  useWeightedSearch: boolean;
  aiComponentUsed?: boolean;
  disabledInfluences?: DisabledInfluences;
  userProfile?: {
    isGuest?: boolean;
    major?: string | null;
    gpa?: string | number | null;
    state?: string | null;
  };
  normalizedQuestionnaire?: Record<string, unknown>;
  wantsInState?: boolean;
  rawUserState?: string;
  effectiveState?: string;
  usedWashingtonFallback?: boolean;
  collegeSource?: 'live' | 'cached' | 'stub' | null;
  counts?: {
    fetched: number;
    filtered: number;
    deterministic: number;
    aiCandidates: number;
    returned: number;
  };
  emptyState?: EmptyState | null;
  topResults?: {
    rank: number;
    id: string;
    name: string;
    state: string;
    score: number;
    finalBaseScore: number;
    aiFactor: number;
    queryMatch: number | null;
    majorEvidenceCount?: number;
    majorEvidenceLevel?: MajorEvidenceLevel;
    waMrpParticipant?: boolean;
    queryBoost?: number;
    reason?: string;
  }[];
  notes?: string[];
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: 'live' | 'cached' | 'cached-stale' | 'stub';
};

export type ChatAssistantOutputFormat = 'text' | 'recommendation_explanations_json';

export type ChatAssistantRankedCollege = {
  id: string;
  name: string;
  location: {
    city: string | null;
    state: string | null;
  };
  matchScore: number | null;
  score: number | null;
  scoreText: string | null;
  reason: string | null;
  tuition: number | null;
  tuitionInState: number | null;
  tuitionOutOfState: number | null;
  avgNetPriceOverall: number | null;
  admissionRate: number | null;
  completionRate: number | null;
  pellGrantRate: number | null;
  medianDebtCompletersOverall: number | null;
  size: string | null;
  setting: string | null;
  locale: string | null;
  programs: string[];
};

export type ChatAssistantExplanation = {
  summary: string;
  collegeExplanations: {
    id?: string | null;
    name?: string | null;
    explanation: string;
  }[];
};

export type ChatAssistantInput = {
  query: string;
  context?: AiConversationContext | string | null;
  topRankedColleges?: (RecommendResult | College | AiConversationCollegeSummary | ChatAssistantRankedCollege)[];
  outputFormat?: ChatAssistantOutputFormat;
};

export type ChatAssistantResponse = {
  message: ChatMessage;
  outputFormat: ChatAssistantOutputFormat;
  explanation: ChatAssistantExplanation | null;
};

export type RecommendCollegesOptions = {
  query?: string;
  userProfile?: UserProfile | null;
  questionnaire?: Questionnaire | null;
  maxResults?: number;
  useWeightedSearch?: boolean;
  disableAiComponent?: boolean;
  disabledInfluences?: DisabledInfluences;
};
