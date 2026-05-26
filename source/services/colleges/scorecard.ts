// services/scorecard.ts
// Helper utilities for calling the College Scorecard API with timeout, error handling
// and a small in-memory cache. This keeps fetch logic centralized.

import { API_CONFIG, hasCollegeScorecardApiKey } from '@/services/app/config';
import { errorLoggingService } from '@/services/logging/error-logging.service';
import {
  AppFetchError,
  fetchJsonWithHandling,
} from '@/services/network/fetch-with-handling';

const DEFAULT_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours - match college.service.ts

type Params = Record<string, string>;

export type ScorecardProgramEntry = {
  code?: string | number | null;
  title?: string | null;
};

export type ScorecardProgramCollection = Partial<
  Record<'cip_4_digit' | 'cip_6_digit', ScorecardProgramEntry | ScorecardProgramEntry[] | null>
>;

export type ScorecardSchoolResult = {
  id?: string | number | null;
  school?: {
    name?: string | null;
    city?: string | null;
    state?: string | null;
    school_url?: string | null;
    price_calculator_url?: string | null;
    locale?: string | number | null;
    degrees_awarded?: {
      highest?: string | number | null;
      predominant?: string | number | null;
    } | null;
  } | null;
  latest?: {
    admissions?: {
      admission_rate?: {
        overall?: string | number | null;
      } | null;
    } | null;
    aid?: {
      pell_grant_rate?: string | number | null;
      median_debt?: {
        completers?: {
          overall?: string | number | null;
        } | null;
      } | null;
    } | null;
    completion?: {
      rate?: string | number | null;
    } | null;
    completion_rate?: string | number | null;
    cost?: {
      attendance?: {
        academic_year?: string | number | null;
      } | null;
      avg_net_price?: {
        overall?: string | number | null;
      } | null;
      tuition?: {
        in_state?: string | number | null;
        out_of_state?: string | number | null;
      } | null;
    } | null;
    programs?: ScorecardProgramCollection | null;
    student?: {
      size?: string | number | null;
    } | null;
  } | null;
  programs?: ScorecardProgramCollection | null;
  [key: string]: unknown;
};

export type ScorecardSchoolsResponse = {
  metadata?: {
    total?: string | number | null;
  } | null;
  results?: ScorecardSchoolResult[] | null;
  [key: string]: unknown;
};

type ErrorWithStatus = Error & { status?: number | null };

const inMemoryCache = new Map<string, { ts: number; data: unknown }>();

const getScorecardConfigMessage = () =>
  "College Scorecard API key is missing or invalid. Update EXPO_PUBLIC_COLLEGE_SCORECARD_KEY in source/.env with a valid api.data.gov key, then restart Expo.";

const getApiKeyErrorMessage = (text: string) => {
  const raw = (text || "").trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.code === "API_KEY_INVALID") {
      return getScorecardConfigMessage();
    }
  } catch {
    // ignore non-JSON bodies
  }

  if (/API_KEY_INVALID/i.test(raw) || /invalid api[_ ]?key/i.test(raw)) {
    return getScorecardConfigMessage();
  }

  return null;
};

const isTransientStatus = (status?: number) =>
  status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

const getErrorStatus = (error: unknown) =>
  error instanceof AppFetchError
    ? error.status
    : typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : null;

const withErrorStatus = <T extends Error>(error: T, status: number | null): T & ErrorWithStatus => {
  const statusError = error as T & ErrorWithStatus;
  statusError.status = status;
  return statusError;
};

export const buildScorecardUrl = (params: Params) => {
  const base = API_CONFIG.collegeScorecard.baseUrl.replace(/\/$/, '');
  const p = new URLSearchParams({ ...params, keys_nested: 'true' });
  if (hasCollegeScorecardApiKey()) {
    p.set("api_key", API_CONFIG.collegeScorecard.apiKey);
  }
  return `${base}/schools?${p.toString()}`;
};

export const fetchScorecardUrl = async <T = unknown>(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> => {
  const scrubbedUrl = url.replace(/([?&]api_key=)[^&]+/i, '$1[redacted]');
  // use in-memory cache keyed by full URL
  const cached = inMemoryCache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data as T;
  }

  try {
    const json = await fetchJsonWithHandling<T>(url, {
      operation: "College Scorecard fetch",
      retries: 1,
      retryDelayMs: 250,
      retryTimeoutMs: Math.max(timeoutMs + 4000, 12000),
      scrubbedUrl,
      timeoutMs,
      invalidJsonMessage: "Scorecard API returned invalid JSON",
    });
    inMemoryCache.set(url, { ts: Date.now(), data: json });
    return json;
  } catch (e) {
    const apiKeyMessage = e instanceof AppFetchError
      ? getApiKeyErrorMessage(e.bodyText)
      : null;
    const errorToThrow = apiKeyMessage
      ? withErrorStatus(new Error(apiKeyMessage), getErrorStatus(e))
      : e instanceof AppFetchError && e.isTimeout
        ? new Error("Scorecard API request timed out")
        : e instanceof AppFetchError && e.status
          ? new Error(
              isTransientStatus(e.status)
                ? `Scorecard API temporary error (${e.status}). Please try again shortly.`
                : `Scorecard API error: ${e.status} ${e.statusText}${e.bodyText ? ` ${e.bodyText.slice(0, 240)}` : ""}`
            )
          : e;

    if (errorToThrow instanceof Error && e instanceof AppFetchError) {
      withErrorStatus(errorToThrow, e.status);
    }

    void errorLoggingService.captureException(errorToThrow, {
      category: 'api',
      operation: 'college-scorecard-fetch',
      severity: 'error',
      handled: false,
      source: 'scorecard.service',
      metadata: {
        url: scrubbedUrl,
        timeoutMs,
        retried: e instanceof AppFetchError ? e.attempts > 1 : false,
        status: getErrorStatus(e),
      },
    });
    throw errorToThrow;
  }
};

export const clearScorecardCache = () => {
  inMemoryCache.clear();
};
