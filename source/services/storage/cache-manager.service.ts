import AsyncStorage from "@react-native-async-storage/async-storage";

import { LOCAL_DOCUMENTS_DIR_NAME } from "@/constants/schema";
import {
  deleteFileSystemPath,
  getWritableBaseDirectory,
  readDirectory,
} from "@/services/storage/file-system-adapter.service";

const CACHE_AUTO_CLEAR_ENABLED_KEY = "settings:cache:autoClear30d";
const CACHE_LAST_CLEARED_AT_KEY = "settings:cache:lastClearedAt";
const CACHE_AUTO_CLEAR_WINDOW_MS = 1000 * 60 * 60 * 24 * 5;

const CACHE_KEY_PREFIXES = [
  "college:",
  "zip:geocode:",
  "gatorguide:opportunities:",
];

const CACHE_KEY_EXACT = new Set([
  "ai:lastResponse",
  "ai:lastResponseMap",
  "ai:lastRoadmap",
  "ai:recommend:factorCache:v1",
]);

class CacheManagerService {
  private isGuestDocumentStorageKey(key: string) {
    return (
      key.startsWith("transcript:guest-") ||
      key.startsWith("resume:guest-") ||
      key.startsWith("avatar:guest-") ||
      key.startsWith("roadmap:guest-")
    );
  }

  private async clearGuestLocalDocumentDirectories(): Promise<number> {
    const baseDir = getWritableBaseDirectory("document") ?? "";
    if (!baseDir) {
      return 0;
    }

    const docsRoot = `${baseDir}${LOCAL_DOCUMENTS_DIR_NAME}/`;

    let childEntries: string[] = [];
    try {
      childEntries = await readDirectory(docsRoot);
    } catch {
      return 0;
    }

    const guestDirectories = childEntries.filter((entry) => /_guest-/i.test(String(entry)));
    let removedCount = 0;

    for (const directory of guestDirectories) {
      const targetPath = `${docsRoot}${directory}`;
      try {
        await deleteFileSystemPath(targetPath, { idempotent: true });
        removedCount += 1;
      } catch {
        // Ignore individual cleanup failures so cache clear can continue.
      }
    }

    return removedCount;
  }

  async clearGuestDocumentCaches(): Promise<{ clearedCount: number }> {
    const keys = await AsyncStorage.getAllKeys();
    const guestDocumentKeys = keys.filter((key) => this.isGuestDocumentStorageKey(key));

    if (guestDocumentKeys.length) {
      await AsyncStorage.multiRemove(guestDocumentKeys);
    }

    const removedGuestDirs = await this.clearGuestLocalDocumentDirectories();

    return {
      clearedCount: guestDocumentKeys.length + removedGuestDirs,
    };
  }

  async getAutoClearEnabled(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_AUTO_CLEAR_ENABLED_KEY);
      if (raw == null) return true;
      return raw === "true";
    } catch {
      return true;
    }
  }

  async setAutoClearEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(CACHE_AUTO_CLEAR_ENABLED_KEY, enabled ? "true" : "false");
  }

  async clearRelevantCaches(): Promise<{ clearedCount: number }> {
    const keys = await AsyncStorage.getAllKeys();
    // Only remove derived/cache keys; keep user profile and core app state keys.
    const targetKeys = keys.filter((key) =>
      CACHE_KEY_EXACT.has(key) || CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
    );

    if (targetKeys.length) {
      await AsyncStorage.multiRemove(targetKeys);
    }

    const { clearedCount: guestDocumentClearedCount } = await this.clearGuestDocumentCaches();

    await AsyncStorage.setItem(CACHE_LAST_CLEARED_AT_KEY, String(Date.now()));
    return { clearedCount: targetKeys.length + guestDocumentClearedCount };
  }

  async runAutoClearMaintenance(): Promise<{ ran: boolean; clearedCount: number }> {
    const enabled = await this.getAutoClearEnabled();
    if (!enabled) return { ran: false, clearedCount: 0 };

    const now = Date.now();
    // Throttle maintenance runs to avoid frequent full key scans.
    const rawLast = await AsyncStorage.getItem(CACHE_LAST_CLEARED_AT_KEY);
    const lastClearedAt = Number(rawLast ?? 0);
    if (Number.isFinite(lastClearedAt) && lastClearedAt > 0 && now - lastClearedAt < CACHE_AUTO_CLEAR_WINDOW_MS) {
      return { ran: false, clearedCount: 0 };
    }

    const { clearedCount } = await this.clearRelevantCaches();
    return { ran: true, clearedCount };
  }
}

export const cacheManagerService = new CacheManagerService();
