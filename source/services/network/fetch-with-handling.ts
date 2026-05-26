import {
  DEFAULT_FETCH_RETRY_STATUSES,
  createFetchHelper,
  getFetchMethod,
  getInputUrl,
  sanitizeFetchBody,
} from "./fetch-contract.cjs";

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

const DEFAULT_TIMEOUT_MS = 12000;

export type AppFetchOptions = FetchInit & {
  fetchImpl?: typeof fetch;
  operation?: string;
  retries?: number;
  retryDelayMs?: number | ((attempt: number, error: AppFetchError) => number);
  retryOnStatuses?: readonly number[];
  retryTimeoutMs?: number;
  scrubbedUrl?: string;
  timeoutMs?: number;
  userAgent?: string;
};

type AppFetchErrorInit = {
  bodyText?: string;
  cause?: unknown;
  isRetryable?: boolean;
  isTimeout?: boolean;
  method?: string;
  operation?: string;
  status?: number | null;
  statusText?: string;
  attempts?: number;
  url?: string;
};

export class AppFetchError extends Error {
  bodyText: string;
  cause?: unknown;
  isRetryable: boolean;
  isTimeout: boolean;
  method: string;
  operation: string;
  status: number | null;
  statusText: string;
  attempts: number;
  url: string;

  constructor(message: string, options: AppFetchErrorInit = {}) {
    super(message);
    this.name = "AppFetchError";
    this.bodyText = options.bodyText ?? "";
    this.cause = options.cause;
    this.isRetryable = !!options.isRetryable;
    this.isTimeout = !!options.isTimeout;
    this.method = options.method ?? "GET";
    this.operation = options.operation ?? "Network request";
    this.status = options.status ?? null;
    this.statusText = options.statusText ?? "";
    this.attempts = options.attempts ?? 1;
    this.url = options.url ?? "";
  }
}

export function sanitizeFetchErrorBody(text: string) {
  return sanitizeFetchBody(text);
}

export function isRetryableFetchError(error: unknown) {
  return error instanceof AppFetchError && error.isRetryable;
}

const runFetchWithHandling = createFetchHelper({
  ErrorClass: AppFetchError,
  defaultFetchImpl: () => fetch,
  defaultOperation: "Network request",
  defaultRetries: 0,
  defaultRetryDelayMs: 0,
  defaultRetryStatuses: DEFAULT_FETCH_RETRY_STATUSES,
  defaultThrowOnHttpError: true,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
}) as (input: FetchInput, options?: AppFetchOptions) => Promise<Response>;

export async function fetchWithHandling(
  input: FetchInput,
  options: AppFetchOptions = {}
): Promise<Response> {
  return runFetchWithHandling(input, options);
}

export async function fetchJsonWithHandling<T = unknown>(
  input: FetchInput,
  options: AppFetchOptions & { invalidJsonMessage?: string } = {}
): Promise<T> {
  const { invalidJsonMessage, ...fetchOptions } = options;
  const response = await fetchWithHandling(input, fetchOptions);
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new AppFetchError(invalidJsonMessage ?? "Network response returned invalid JSON.", {
      cause: error,
      isRetryable: false,
      method: getFetchMethod(fetchOptions),
      operation: fetchOptions.operation,
      status: 502,
      statusText: "Invalid JSON",
      url: fetchOptions.scrubbedUrl ?? getInputUrl(input),
    });
  }
}

export async function fetchTextWithHandling(
  input: FetchInput,
  options: AppFetchOptions = {}
) {
  const response = await fetchWithHandling(input, options);
  return response.text();
}

export async function fetchArrayBufferWithHandling(
  input: FetchInput,
  options: AppFetchOptions = {}
) {
  const response = await fetchWithHandling(input, options);
  return response.arrayBuffer();
}
