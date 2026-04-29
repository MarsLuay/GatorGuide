import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";

export type SavedDevConsoleLog = {
  fileName: string;
  relativePath: string;
  fileUri: string;
  savedAt: string;
  delivery: "filesystem" | "download";
};

const DEV_CONSOLE_LOG_DIR = "source/logs";

function buildLogFileName(savedAt: string) {
  return `dev-console-${savedAt.replace(/[:.]/g, "-")}.json`;
}

function canDownloadInBrowser() {
  return typeof document !== "undefined" && typeof Blob !== "undefined" && typeof URL !== "undefined";
}

async function writeSnapshotToWritableDirectory(
  text: string,
  fileName: string,
  savedAt: string
): Promise<SavedDevConsoleLog> {
  const baseDir = (FileSystem as any).documentDirectory ?? (FileSystem as any).cacheDirectory ?? "";
  if (!baseDir) {
    throw new Error("No writable document directory is available.");
  }

  const dir = `${baseDir}${DEV_CONSOLE_LOG_DIR}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  const fileUri = `${dir}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, text, { encoding: "utf8" });

  return {
    fileName,
    relativePath: `${DEV_CONSOLE_LOG_DIR}/${fileName}`,
    fileUri,
    savedAt,
    delivery: "filesystem",
  };
}

function downloadSnapshotOnWeb(text: string, fileName: string, savedAt: string): SavedDevConsoleLog {
  if (!canDownloadInBrowser()) {
    throw new Error("Browser download APIs are unavailable.");
  }

  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    fileName,
    relativePath: `${DEV_CONSOLE_LOG_DIR}/${fileName}`,
    fileUri: fileName,
    savedAt,
    delivery: "download",
  };
}

async function saveSnapshot(snapshot: unknown): Promise<SavedDevConsoleLog> {
  const savedAt = new Date().toISOString();
  const fileName = buildLogFileName(savedAt);
  const text = JSON.stringify(snapshot, null, 2);

  try {
    return await writeSnapshotToWritableDirectory(text, fileName, savedAt);
  } catch (error) {
    if (Platform.OS !== "web") {
      throw error;
    }

    return downloadSnapshotOnWeb(text, fileName, savedAt);
  }
}

export const devConsoleLogService = {
  logDirectory: DEV_CONSOLE_LOG_DIR,
  saveSnapshot,
};
