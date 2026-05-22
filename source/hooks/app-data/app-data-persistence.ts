import { APP_DATA_SCHEMA_VERSION } from "@/constants/schema";
import type { College } from "@/services/colleges/college.service";
import {
  initialState,
  normalizeAppDataState,
  type AppDataState,
} from "./app-data-state";

type LegacyAppDataPayload = Partial<AppDataState> & { savedColleges?: College[] };

export type PersistedAppDataEnvelope = {
  schemaVersion: typeof APP_DATA_SCHEMA_VERSION;
  data: AppDataState;
};

export type ParsedPersistedAppData = {
  state: AppDataState;
  schemaVersion: number;
  migratedFromLegacy: boolean;
  shouldRewrite: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function looksLikeLegacyAppDataPayload(value: unknown): value is LegacyAppDataPayload {
  if (!isRecord(value)) return false;
  return (
    Object.prototype.hasOwnProperty.call(value, "user") ||
    Object.prototype.hasOwnProperty.call(value, "questionnaireAnswers") ||
    Object.prototype.hasOwnProperty.call(value, "notificationsEnabled") ||
    Object.prototype.hasOwnProperty.call(value, "notificationPreferences") ||
    Object.prototype.hasOwnProperty.call(value, "savedColleges")
  );
}

function normalizeEnvelopeData(value: unknown): AppDataState {
  return normalizeAppDataState(
    isRecord(value) ? (value as LegacyAppDataPayload) : initialState
  );
}

export function buildPersistedAppDataEnvelope(
  state: AppDataState
): PersistedAppDataEnvelope {
  return {
    schemaVersion: APP_DATA_SCHEMA_VERSION,
    data: normalizeAppDataState(state),
  };
}

export function serializeAppDataState(state: AppDataState) {
  return JSON.stringify(buildPersistedAppDataEnvelope(state));
}

export function parsePersistedAppDataPayload(value: unknown): ParsedPersistedAppData {
  if (isRecord(value) && Object.prototype.hasOwnProperty.call(value, "schemaVersion")) {
    const parsedVersion = Number(value.schemaVersion);
    if (
      Number.isFinite(parsedVersion) &&
      parsedVersion === APP_DATA_SCHEMA_VERSION &&
      isRecord(value.data)
    ) {
      return {
        state: normalizeEnvelopeData(value.data),
        schemaVersion: parsedVersion,
        migratedFromLegacy: false,
        shouldRewrite: false,
      };
    }

    if (isRecord(value.data)) {
      return {
        state: normalizeEnvelopeData(value.data),
        schemaVersion: Number.isFinite(parsedVersion) ? parsedVersion : 0,
        migratedFromLegacy: false,
        shouldRewrite: true,
      };
    }
  }

  if (looksLikeLegacyAppDataPayload(value)) {
    return {
      state: normalizeAppDataState(value),
      schemaVersion: 0,
      migratedFromLegacy: true,
      shouldRewrite: true,
    };
  }

  return {
    state: initialState,
    schemaVersion: APP_DATA_SCHEMA_VERSION,
    migratedFromLegacy: false,
    shouldRewrite: true,
  };
}

export function parsePersistedAppDataState(raw: string): ParsedPersistedAppData {
  return parsePersistedAppDataPayload(JSON.parse(raw));
}
