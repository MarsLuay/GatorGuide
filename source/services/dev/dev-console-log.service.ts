import { Platform } from "react-native";
import {
  downloadTextFileOnWeb,
  writeTextToAppDirectory,
} from "@/services/storage/file-system-adapter.service";

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

async function writeSnapshotToWritableDirectory(
  text: string,
  fileName: string,
  savedAt: string
): Promise<SavedDevConsoleLog> {
  const savedFile = await writeTextToAppDirectory({
    fileName,
    content: text,
    directory: DEV_CONSOLE_LOG_DIR,
  });

  return {
    fileName,
    relativePath: `${DEV_CONSOLE_LOG_DIR}/${fileName}`,
    fileUri: savedFile.fileUri,
    savedAt,
    delivery: "filesystem",
  };
}

function downloadSnapshotOnWeb(text: string, fileName: string, savedAt: string): SavedDevConsoleLog {
  const savedFile = downloadTextFileOnWeb({
    fileName,
    content: text,
    mimeType: "application/json",
  });

  return {
    fileName,
    relativePath: `${DEV_CONSOLE_LOG_DIR}/${fileName}`,
    fileUri: savedFile.fileUri,
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
