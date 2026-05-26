type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

export const DEFAULT_FETCH_RETRY_STATUSES: readonly number[];

export type FetchContractErrorInit = {
  attempts?: number;
  bodyText?: string;
  cause?: unknown;
  isRetryable?: boolean;
  isTimeout?: boolean;
  method?: string;
  operation?: string;
  status?: number | null;
  statusText?: string;
  url?: string;
};

export interface FetchContractError extends Error {
  attempts: number;
  bodyText: string;
  cause?: unknown;
  isRetryable: boolean;
  isTimeout: boolean;
  method: string;
  operation: string;
  status: number | null;
  statusText: string;
  url: string;
}

export type FetchContractErrorClass<TError extends FetchContractError> = new (
  message: string,
  options?: FetchContractErrorInit
) => TError;

export type FetchContractOptions = FetchInit & {
  fetchImpl?: typeof fetch;
  operation?: string;
  retries?: number;
  retryDelayMs?: number | ((attempt: number, error: FetchContractError) => number);
  retryOnStatuses?: readonly number[] | Set<number>;
  retryTimeoutMs?: number;
  scrubbedUrl?: string;
  throwOnHttpError?: boolean;
  timeoutMs?: number;
  userAgent?: string;
};

export type FetchContractMessageInput = {
  bodyText?: string;
  cause?: unknown;
  isTimeout?: boolean;
  operation: string;
  status?: number;
  statusText?: string;
  url: string;
};

export function createFetchErrorClass<TError extends FetchContractError = FetchContractError>(
  name: string,
  defaultOperation: string
): FetchContractErrorClass<TError>;

export function createFetchHelper<TError extends FetchContractError>(config: {
  ErrorClass: FetchContractErrorClass<TError>;
  defaultFetchImpl?: () => typeof fetch;
  defaultFetchOptions?: FetchInit;
  defaultOperation: string;
  defaultRetries?: number;
  defaultRetryDelayMs?: number;
  defaultRetryStatuses?: readonly number[] | Set<number>;
  defaultThrowOnHttpError?: boolean;
  defaultTimeoutMs: number;
  formatHttpErrorMessage?: (input: FetchContractMessageInput) => string;
  formatMissingFetchMessage?: (input: FetchContractMessageInput) => string;
  formatNetworkErrorMessage?: (input: FetchContractMessageInput) => string;
}): (input: FetchInput, options?: FetchContractOptions) => Promise<Response>;

export function getFetchMethod(options?: FetchInit): string;
export function getInputUrl(input: FetchInput): string;
export function isAbortError(error: unknown): boolean;
export function sanitizeFetchBody(text: unknown): string;
