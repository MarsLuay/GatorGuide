// services/scorecard.ts
// Helper utilities for calling the College Scorecard API with timeout, error handling
// and a small in-memory cache. This keeps fetch logic centralized.

import { API_CONFIG } from './config';

const DEFAULT_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours - match college.service.ts

type Params = Record<string, string>;

const inMemoryCache = new Map<string, { ts: number; data: any }>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeUpstreamBody = (text: string) => {
  const raw = (text || '').trim();
  if (!raw) return '';
  // Avoid surfacing full HTML error pages to UI/logs.
  if (/<!doctype html/i.test(raw) || /<html[\s>]/i.test(raw)) return '[html-error-body]';
  return raw.slice(0, 240);
};

const isTransientStatus = (status?: number) =>
  status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

const isRetryableError = (err: any) =>
  err?.name === 'AbortError' || isTransientStatus(err?.status);

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
        const details = sanitizeUpstreamBody(text);
        const msg = isTransientStatus(res.status)
          ? `Scorecard API temporary error (${res.status}). Please try again shortly.`
          : `Scorecard API error: ${res.status} ${res.statusText}${details ? ` ${details}` : ''}`;
        const err = new Error(msg);
        (err as any).status = res.status;
        throw err;
      }
      try {
        return await res.json();
      } catch {
        const err = new Error('Scorecard API returned invalid JSON');
        (err as any).status = 502;
        throw err;
      }
    } finally {
      clearTimeout(id);
    }
  };

  try {
    const json = await attempt(timeoutMs);
    inMemoryCache.set(url, { ts: Date.now(), data: json });
    return json;
  } catch (e) {
    if (isRetryableError(e)) {
      // one retry for transient upstream issues with a slightly longer timeout
      try {
        await sleep(250);
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
