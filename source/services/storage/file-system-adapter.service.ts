import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { fetchTextWithHandling } from "@/services/network/fetch-with-handling";

type FileSystemEncoding = NonNullable<
  NonNullable<Parameters<typeof FileSystem.readAsStringAsync>[1]>["encoding"]
>;

type ExpoFileSystemCompat = typeof FileSystem & {
  EncodingType?: {
    UTF8?: FileSystemEncoding | string;
    Base64?: FileSystemEncoding | string;
  };
  documentDirectory?: string | null;
  cacheDirectory?: string | null;
  Paths?: {
    document?: unknown;
    cache?: unknown;
  };
  File?: new (...pathParts: unknown[]) => { uri: string };
};

export type UserFileDelivery = "download" | "shared" | "filesystem";

export type UserFileSaveResult = {
  fileName: string;
  fileUri: string;
  delivery: UserFileDelivery;
  shared: boolean;
};

type SaveTextFileForUserOptions = {
  fileName: string;
  content: string;
  mimeType?: string;
  directory?: string;
  preferDownloadOnWeb?: boolean;
  shareOnNative?: boolean;
};

type WriteTextFileOptions = {
  encoding?: "utf8" | "base64";
};

const fileSystem = FileSystem as ExpoFileSystemCompat;

function normalizeDirectoryPath(value: string) {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `${trimmed}/` : "";
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function canUseBrowserDownload() {
  return (
    Platform.OS === "web" &&
    typeof document !== "undefined" &&
    typeof Blob !== "undefined" &&
    typeof URL !== "undefined"
  );
}

export function getUtf8Encoding(): FileSystemEncoding {
  return (fileSystem.EncodingType?.UTF8 ?? "utf8") as FileSystemEncoding;
}

export function getBase64Encoding(): FileSystemEncoding {
  return (fileSystem.EncodingType?.Base64 ?? "base64") as FileSystemEncoding;
}

export function getWritableBaseDirectory(preferred: "document" | "cache" = "document") {
  const primary =
    preferred === "document"
      ? fileSystem.documentDirectory
      : fileSystem.cacheDirectory;
  const fallback =
    preferred === "document"
      ? fileSystem.cacheDirectory
      : fileSystem.documentDirectory;
  const baseDir = String(primary ?? fallback ?? "").trim();
  return baseDir ? withTrailingSlash(baseDir) : null;
}

export function buildWritableFileUri(fileName: string, directory?: string) {
  const normalizedDirectory = normalizeDirectoryPath(directory ?? "");
  const baseDir = getWritableBaseDirectory("document");
  if (baseDir) {
    return `${baseDir}${normalizedDirectory}${fileName}`;
  }

  const FileCtor = fileSystem.File;
  const documentRoot = fileSystem.Paths?.document;
  if (FileCtor && documentRoot) {
    const pathParts = normalizedDirectory
      ? [documentRoot, ...normalizedDirectory.split("/").filter(Boolean), fileName]
      : [documentRoot, fileName];
    return new FileCtor(...pathParts).uri;
  }

  throw new Error("No writable document directory is available.");
}

export function buildWritableDirectoryUri(directory: string) {
  const baseDir = getWritableBaseDirectory("document");
  if (!baseDir) return null;
  return `${baseDir}${normalizeDirectoryPath(directory)}`;
}

export async function ensureDirectory(uri: string) {
  await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
}

export async function readDirectory(uri: string) {
  return FileSystem.readDirectoryAsync(uri);
}

export async function deleteFileSystemPath(uri: string, options?: { idempotent?: boolean }) {
  await FileSystem.deleteAsync(uri, { idempotent: options?.idempotent ?? true });
}

export async function copyFile(sourceUri: string, destinationUri: string) {
  await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
}

export async function readTextFile(uri: string, options?: WriteTextFileOptions) {
  const normalizedUri = String(uri ?? "").trim();
  if (options?.encoding !== "base64" && /^(data:|blob:|https?:)/i.test(normalizedUri)) {
    return fetchTextWithHandling(normalizedUri, {
      operation: "File text read",
      timeoutMs: 15000,
    });
  }

  return FileSystem.readAsStringAsync(uri, {
    encoding: options?.encoding === "base64" ? getBase64Encoding() : getUtf8Encoding(),
  });
}

export async function writeTextFile(uri: string, content: string, options?: WriteTextFileOptions) {
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: options?.encoding === "base64" ? getBase64Encoding() : getUtf8Encoding(),
  });
}

export function readBase64File(uri: string) {
  return readTextFile(uri, { encoding: "base64" });
}

export function writeBase64File(uri: string, content: string) {
  return writeTextFile(uri, content, { encoding: "base64" });
}

export async function readJsonFile<T>(uri: string): Promise<T> {
  return JSON.parse(await readTextFile(uri)) as T;
}

export async function writeJsonFile(uri: string, value: unknown) {
  await writeTextFile(uri, JSON.stringify(value, null, 2));
}

export async function readUriAsBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new TypeError("Failed to read file"));
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new TypeError("Failed to encode file"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new TypeError("Failed to encode file"));
    reader.readAsDataURL(blob);
  });
}

export async function readUriAsDataUrl(uri: string) {
  if (/^data:/i.test(uri) && /;base64,/i.test(uri)) return uri;
  return blobToDataUrl(await readUriAsBlob(uri));
}

export async function readUriAsBase64(uri: string) {
  if (/^data:/i.test(uri) && /;base64,/i.test(uri)) {
    const [, base64 = ""] = uri.split(",", 2);
    return base64;
  }

  if (Platform.OS === "web" || /^(data:|blob:|https?:)/i.test(uri)) {
    const dataUrl = await readUriAsDataUrl(uri);
    const [, base64 = ""] = dataUrl.split(",", 2);
    return base64;
  }

  return readBase64File(uri);
}

export function downloadTextFileOnWeb(options: {
  fileName: string;
  content: string;
  mimeType?: string;
}): UserFileSaveResult {
  if (!canUseBrowserDownload()) {
    throw new Error("Browser download APIs are unavailable.");
  }

  const blob = new Blob([options.content], {
    type: options.mimeType ?? "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    fileName: options.fileName,
    fileUri: options.fileName,
    delivery: "download",
    shared: false,
  };
}

export async function writeTextToAppDirectory(options: {
  fileName: string;
  content: string;
  directory?: string;
}): Promise<UserFileSaveResult> {
  const fileUri = buildWritableFileUri(options.fileName, options.directory);
  const directoryUri = options.directory ? buildWritableDirectoryUri(options.directory) : null;
  if (directoryUri) {
    await ensureDirectory(directoryUri);
  }

  await writeTextFile(fileUri, options.content);

  return {
    fileName: options.fileName,
    fileUri,
    delivery: "filesystem",
    shared: false,
  };
}

export async function saveTextFileForUser(
  options: SaveTextFileForUserOptions
): Promise<UserFileSaveResult> {
  if (options.preferDownloadOnWeb !== false && canUseBrowserDownload()) {
    return downloadTextFileOnWeb(options);
  }

  const saved = await writeTextToAppDirectory(options);

  if (Platform.OS !== "web" && options.shareOnNative !== false) {
    const canShare = await Sharing.isAvailableAsync().catch(() => false);
    if (canShare) {
      await Sharing.shareAsync(saved.fileUri, {
        mimeType: options.mimeType,
      });
      return {
        ...saved,
        delivery: "shared",
        shared: true,
      };
    }
  }

  return saved;
}

export const fileSystemAdapter = {
  getUtf8Encoding,
  getBase64Encoding,
  getWritableBaseDirectory,
  buildWritableFileUri,
  buildWritableDirectoryUri,
  ensureDirectory,
  readDirectory,
  deleteFileSystemPath,
  copyFile,
  readTextFile,
  writeTextFile,
  readBase64File,
  writeBase64File,
  readJsonFile,
  writeJsonFile,
  readUriAsBlob,
  blobToDataUrl,
  readUriAsDataUrl,
  readUriAsBase64,
  downloadTextFileOnWeb,
  writeTextToAppDirectory,
  saveTextFileForUser,
};
