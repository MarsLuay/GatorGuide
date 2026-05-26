import { localStorageService } from "@/services/storage/local-storage.service";

import { APP_VERSION } from "@/constants/app-version";
import type { AppDataState, User } from "@/hooks/use-app-data";
import type { AppTheme } from "@/hooks/use-app-theme";
import { type Language, translations } from "@/services/app/translations";
import {
  getAvatarStorageKey,
  getImportedLocalDocumentDirectory,
  getLocalStorageOwnerContext,
  getPortableLocalStorageKeysForOwner,
  getResumeStorageKey,
  getTranscriptStorageKey,
  isPortableLocalStorageKeyForOwner,
  parseLocalDocumentStorageKey,
  type LocalDocumentStorageKeyInfo,
} from "@/services/storage/local-storage-contracts";
import {
  ensureDirectory,
  getWritableBaseDirectory,
  readBase64File,
  readJsonFile,
  saveTextFileForUser,
  writeBase64File,
  writeTextFile,
  type UserFileSaveResult,
} from "@/services/storage/file-system-adapter.service";

const EXPORT_SCHEMA_VERSION = 2;
export const DATA_EXPORT_FILE_NAME = "GatorGuide_export.json";

const APP_THEME_VALUES = ["light", "dark", "green", "system"] as const;
const SUPPORTED_LANGUAGE_VALUES = Object.keys(translations) as Language[];

type EmbeddedPortableFile = {
  storageKey: string;
  name: string;
  mimeType: string | null;
  uploadedAt: string | null;
  sizeBytes: number | null;
  base64: string;
};

export type GatorGuideDataExportPayload = {
  schemaVersion: number;
  exportedAt: string;
  app: "GatorGuide";
  version: string;
  data: AppDataState;
  theme?: AppTheme;
  language?: Language;
  preferences: {
    theme?: AppTheme;
    language?: Language;
  };
  localStorage: Record<string, string>;
  embeddedFiles: Record<string, EmbeddedPortableFile>;
};

export type NormalizedDataImportSnapshot = {
  data: AppDataState;
  theme?: AppTheme;
  language?: Language;
  localStorage: Record<string, string>;
  embeddedFiles: Record<string, EmbeddedPortableFile>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeTheme(value: unknown): AppTheme | undefined {
  return APP_THEME_VALUES.includes(value as AppTheme)
    ? (value as AppTheme)
    : undefined;
}

function normalizeLanguage(value: unknown): Language | undefined {
  return SUPPORTED_LANGUAGE_VALUES.includes(value as Language)
    ? (value as Language)
    : undefined;
}

function shouldEmbedDocumentUrl(url: unknown) {
  const raw = String(url ?? "").trim();
  if (!raw) return false;
  if (/^(https?:|gs:|data:|blob:)/i.test(raw)) return false;
  return true;
}

function normalizeFileName(value: unknown, fallback: string) {
  const raw = String(value ?? "").trim();
  const normalized = raw
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return normalized && normalized.length <= 180 ? normalized : fallback;
}

function getLocalDocumentsBaseDir() {
  return getWritableBaseDirectory("document") ?? "";
}

function getImportedDocumentDirectory(info: LocalDocumentStorageKeyInfo) {
  const baseDir = getLocalDocumentsBaseDir();
  if (!baseDir) return null;
  return `${baseDir}${getImportedLocalDocumentDirectory(info)}`;
}

async function maybeEmbedLocalDocumentFile(
  storageKey: string,
  storageValue: string
): Promise<EmbeddedPortableFile | null> {
  const info = parseLocalDocumentStorageKey(storageKey);
  if (!info) return null;

  try {
    const parsed = JSON.parse(storageValue) as Record<string, unknown>;
    const url = String(parsed.url ?? "").trim();
    if (!shouldEmbedDocumentUrl(url)) return null;

    const base64 = await readBase64File(url);

    return {
      storageKey,
      name: normalizeFileName(parsed.name, `${info.kind}-document`),
      mimeType: String(parsed.mimeType ?? "").trim() || null,
      uploadedAt: String(parsed.uploadedAt ?? "").trim() || null,
      sizeBytes:
        typeof parsed.sizeBytes === "number" && Number.isFinite(parsed.sizeBytes)
          ? parsed.sizeBytes
          : null,
      base64,
    };
  } catch {
    return null;
  }
}

async function getPortableStorageSnapshot(state: AppDataState) {
  const keys = await localStorageService.getAllKeys();
  const portableKeys = getPortableLocalStorageKeysForOwner(
    keys,
    getLocalStorageOwnerContext(state.user)
  );
  if (!portableKeys.length) {
    return {
      localStorage: {} as Record<string, string>,
      embeddedFiles: {} as Record<string, EmbeddedPortableFile>,
    };
  }

  const pairs = await localStorageService.multiGet(portableKeys);
  const localStorage: Record<string, string> = {};
  const embeddedFiles: Record<string, EmbeddedPortableFile> = {};

  for (const [key, value] of pairs) {
    if (value == null) continue;
    localStorage[key] = value;

    const embeddedFile = await maybeEmbedLocalDocumentFile(key, value);
    if (embeddedFile) {
      embeddedFiles[key] = embeddedFile;
    }
  }

  return { localStorage, embeddedFiles };
}

function normalizeLegacyDataPayload(value: unknown): AppDataState | null {
  if (!isRecord(value)) return null;

  if (
    Object.prototype.hasOwnProperty.call(value, "user") ||
    Object.prototype.hasOwnProperty.call(value, "questionnaireAnswers") ||
    Object.prototype.hasOwnProperty.call(value, "notificationsEnabled") ||
    Object.prototype.hasOwnProperty.call(value, "savedColleges")
  ) {
    return value as AppDataState;
  }

  return null;
}

function normalizeEmbeddedFiles(value: unknown) {
  if (!isRecord(value)) return {};

  const embeddedFiles: Record<string, EmbeddedPortableFile> = {};
  for (const [storageKey, file] of Object.entries(value)) {
    if (!isRecord(file)) continue;

    const base64 = String(file.base64 ?? "").trim();
    if (!base64) continue;

    embeddedFiles[storageKey] = {
      storageKey: String(file.storageKey ?? storageKey),
      name: normalizeFileName(file.name, "imported-document"),
      mimeType: String(file.mimeType ?? "").trim() || null,
      uploadedAt: String(file.uploadedAt ?? "").trim() || null,
      sizeBytes:
        typeof file.sizeBytes === "number" && Number.isFinite(file.sizeBytes)
          ? file.sizeBytes
          : null,
      base64,
    };
  }

  return embeddedFiles;
}

function normalizeLocalStorage(value: unknown, state: AppDataState) {
  if (!isRecord(value)) return {};
  const owner = getLocalStorageOwnerContext(state.user);

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, storageValue]) =>
        typeof storageValue === "string" && isPortableLocalStorageKeyForOwner(key, owner)
      )
  ) as Record<string, string>;
}

async function clearPortableStorageForState(state: AppDataState) {
  const keys = await localStorageService.getAllKeys();
  const portableKeys = getPortableLocalStorageKeysForOwner(
    keys,
    getLocalStorageOwnerContext(state.user)
  );
  if (portableKeys.length) {
    await localStorageService.multiRemove(portableKeys);
  }
}

async function restoreEmbeddedDocumentFile(
  info: LocalDocumentStorageKeyInfo,
  file: EmbeddedPortableFile
) {
  const directoryUri = getImportedDocumentDirectory(info);
  if (!directoryUri) return null;

  await ensureDirectory(directoryUri);

  const fallbackName =
    info.kind === "roadmap"
      ? `${info.docType ?? "roadmap"}-document`
      : `${info.kind}-document`;
  const fileName = normalizeFileName(file.name, fallbackName);
  const fileUri = `${directoryUri}${Date.now()}_${fileName}`;

  await writeBase64File(fileUri, file.base64);

  return fileUri;
}

async function restorePortableStorageEntry(
  key: string,
  value: string,
  embeddedFile: EmbeddedPortableFile | undefined
) {
  const info = parseLocalDocumentStorageKey(key);
  if (!info || !embeddedFile) return value;

  try {
    const restoredUri = await restoreEmbeddedDocumentFile(info, embeddedFile);
    if (!restoredUri) return value;

    const parsed = JSON.parse(value) as Record<string, unknown>;
    return JSON.stringify({
      ...parsed,
      name: normalizeFileName(parsed.name ?? embeddedFile.name, embeddedFile.name),
      url: restoredUri,
      uploadedAt:
        String(parsed.uploadedAt ?? "").trim() ||
        embeddedFile.uploadedAt ||
        new Date().toISOString(),
      mimeType: String(parsed.mimeType ?? embeddedFile.mimeType ?? "").trim() || null,
      sizeBytes:
        typeof parsed.sizeBytes === "number" && Number.isFinite(parsed.sizeBytes)
          ? parsed.sizeBytes
          : embeddedFile.sizeBytes,
    });
  } catch {
    return value;
  }
}

function patchUserDocumentFieldsFromStorage(
  data: AppDataState,
  localStorage: Record<string, string>
) {
  const userId = getLocalStorageOwnerContext(data.user).userId ?? "";
  if (!data.user || !userId) return data;

  const fieldByKey: Array<[string, keyof Pick<User, "resume" | "transcript" | "avatar">]> = [
    [getResumeStorageKey(userId), "resume"],
    [getTranscriptStorageKey(userId), "transcript"],
    [getAvatarStorageKey(userId), "avatar"],
  ];

  const userPatch: Partial<User> = {};
  for (const [key, field] of fieldByKey) {
    const raw = localStorage[key];
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const url = String(parsed.url ?? "").trim();
      if (url) userPatch[field] = url;
    } catch {
      // Keep the imported app-data field if document metadata is malformed.
    }
  }

  if (!Object.keys(userPatch).length) return data;

  return {
    ...data,
    user: {
      ...data.user,
      ...userPatch,
    },
  };
}

export async function buildDataExportPayload(input: {
  state: AppDataState;
  theme?: AppTheme;
  language?: Language;
}): Promise<GatorGuideDataExportPayload> {
  const { localStorage, embeddedFiles } = await getPortableStorageSnapshot(input.state);

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: "GatorGuide",
    version: APP_VERSION,
    data: input.state,
    theme: input.theme,
    language: input.language,
    preferences: {
      theme: input.theme,
      language: input.language,
    },
    localStorage,
    embeddedFiles,
  };
}

export function normalizeDataImportPayload(
  rawPayload: unknown
): NormalizedDataImportSnapshot | null {
  if (!isRecord(rawPayload)) return null;

  const data = normalizeLegacyDataPayload(rawPayload.data) ?? normalizeLegacyDataPayload(rawPayload);
  if (!data) return null;

  const preferences = isRecord(rawPayload.preferences) ? rawPayload.preferences : {};
  const theme = normalizeTheme(rawPayload.theme ?? preferences.theme);
  const language = normalizeLanguage(rawPayload.language ?? preferences.language);
  const localStorage = normalizeLocalStorage(rawPayload.localStorage, data);
  const embeddedFiles = normalizeEmbeddedFiles(rawPayload.embeddedFiles);

  return {
    data,
    theme,
    language,
    localStorage,
    embeddedFiles,
  };
}

export async function restoreDataImportSnapshot(
  snapshot: NormalizedDataImportSnapshot
): Promise<AppDataState> {
  await clearPortableStorageForState(snapshot.data);

  const restoredStorageEntries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(snapshot.localStorage)) {
    restoredStorageEntries.push([
      key,
      await restorePortableStorageEntry(key, value, snapshot.embeddedFiles[key]),
    ]);
  }

  if (restoredStorageEntries.length) {
    await localStorageService.multiSet(restoredStorageEntries);
  }

  const restoredStorage = Object.fromEntries(restoredStorageEntries);
  return patchUserDocumentFieldsFromStorage(snapshot.data, restoredStorage);
}

export function stringifyDataExportPayload(payload: GatorGuideDataExportPayload) {
  return JSON.stringify(payload, null, 2);
}

export async function writeDataExportFile(fileUri: string, payload: GatorGuideDataExportPayload) {
  await writeTextFile(fileUri, stringifyDataExportPayload(payload));
}

export async function saveDataExportPayloadForUser(
  payload: GatorGuideDataExportPayload
): Promise<UserFileSaveResult> {
  return saveTextFileForUser({
    fileName: DATA_EXPORT_FILE_NAME,
    content: stringifyDataExportPayload(payload),
    mimeType: "application/json",
  });
}

export async function readDataImportSnapshotFromFileUri(fileUri: string) {
  return normalizeDataImportPayload(await readJsonFile<unknown>(fileUri));
}
