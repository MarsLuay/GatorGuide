// services/scorecard.ts
// Helper utilities for calling the College Scorecard API with timeout, error handling
// and a small in-memory cache. This keeps fetch logic centralized.

import { API_CONFIG } from './config';

const DEFAULT_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours - match college.service.ts

type Params = Record<string, string>;

const inMemoryCache = new Map<string, { ts: number; data: any }>();

export const buildScorecardUrl = (params: Params) => {
  const base = API_CONFIG.collegeScorecard.baseUrl.replace(/\/$/, '');
  const p = new URLSearchParams({ ...params, api_key: API_CONFIG.collegeScorecard.apiKey, keys_nested: 'true' });
  return `${base}/schools?${p.toString()}`;
};

export const fetchScorecardUrl = async (url: string, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  // use in-memory cache keyed by full URL
  const cached = inMemoryCache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const attempt = async (ms: number) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`Scorecard API error: ${res.status} ${res.statusText} ${text}`);
        (err as any).status = res.status;
        throw err;
      }
      return await res.json();
    } finally {
      clearTimeout(id);
    }
  };

  try {
    const json = await attempt(timeoutMs);
    inMemoryCache.set(url, { ts: Date.now(), data: json });
    return json;
  } catch (e) {
    if ((e as any)?.name === 'AbortError') {
      // one retry with a slightly longer timeout before failing
      try {
        const json = await attempt(Math.max(timeoutMs + 4000, 12000));
        inMemoryCache.set(url, { ts: Date.now(), data: json });
        return json;
      } catch (e2) {
        if ((e2 as any)?.name === 'AbortError') {
          throw new Error('Scorecard API request timed out');
        }
        throw e2;
      }
    }
    throw e;
  }
};

export const clearScorecardCache = () => {
  inMemoryCache.clear();
};
