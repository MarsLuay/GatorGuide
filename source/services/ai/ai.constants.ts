export const AI_LAST_RESPONSE_KEY = 'ai:lastResponse';
export const AI_LAST_RESPONSE_MAP_KEY = 'ai:lastResponseMap';
export const AI_LAST_ASSISTANT_RESPONSE_KEY = 'ai:lastAssistantResponse';
export const AI_LAST_ASSISTANT_RESPONSE_MAP_KEY = 'ai:lastAssistantResponseMap';
export const AI_LAST_ROADMAP_KEY = 'ai:lastRoadmap';
export const AI_FACTOR_CACHE_KEY = 'ai:recommend:factorCache:v1';
export const AI_FACTOR_CACHE_MAX_ENTRIES = 2000;
export const AI_ASSISTANT_MAX_RANKED_COLLEGES = 6;
export const AI_ASSISTANT_MAX_PROGRAMS = 8;

export const DEFAULT_ROADMAP_TASKS = [
  'Research colleges that offer your major',
  'Request transcripts from current institution',
  'Draft personal statement about transfer reasons',
  'Identify 2-3 professors for recommendation letters',
  'Create spreadsheet tracking application deadlines',
  'Review transfer credit policies at target schools',
];

export type AiFactorCacheEntry = {
  aiFactor: number;
  fingerprint: string;
  updatedAt: string;
};
