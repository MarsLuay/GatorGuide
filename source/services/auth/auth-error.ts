export type AuthErrorLike = {
  code?: string;
  message?: string;
};

function readStringProperty(value: unknown, key: keyof AuthErrorLike) {
  if (!value || typeof value !== "object" || !(key in value)) return undefined;
  const raw = (value as Record<keyof AuthErrorLike, unknown>)[key];
  return typeof raw === "string" ? raw : undefined;
}

export function getAuthErrorCode(error: unknown) {
  return readStringProperty(error, "code");
}

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return readStringProperty(error, "message");
}

export function isAuthErrorCode(error: unknown, code: string) {
  return getAuthErrorCode(error) === code;
}
