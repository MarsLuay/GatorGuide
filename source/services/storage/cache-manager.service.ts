import { localStorageService } from "@/services/storage/local-storage.service";

import { LOCAL_DOCUMENTS_DIR_NAME } from "@/constants/schema";
import {
  deleteFileSystemPath,
  getWritableBaseDirectory,
  readDirectory,
} from "@/services/storage/file-system-adapter.service";
import {
  LOCAL_STORAGE_CACHE_POLICY,
  LOCAL_STORAGE_KEYS,
  getCacheClearableLocalStorageKeys,
  getGuestLocalDocumentStorageKeys,
} from "@/services/storage/local-storage-contracts";

class CacheManagerService {
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
    const keys = await localStorageService.getAllKeys();
    const guestDocumentKeys = getGuestLocalDocumentStorageKeys(keys);

    if (guestDocumentKeys.length) {
      await localStorageService.multiRemove(guestDocumentKeys);
    }

    const removedGuestDirs = await this.clearGuestLocalDocumentDirectories();

    return {
      clearedCount: guestDocumentKeys.length + removedGuestDirs,
    };
  }

  async getAutoClearEnabled(): Promise<boolean> {
    try {
      const raw = await localStorageService.getItem(LOCAL_STORAGE_KEYS.cacheAutoClearEnabled);
      if (raw == null) return true;
      return raw === "true";
    } catch {
      return true;
    }
  }

  async setAutoClearEnabled(enabled: boolean): Promise<void> {
    await localStorageService.setItem(
      LOCAL_STORAGE_KEYS.cacheAutoClearEnabled,
      enabled ? "true" : "false"
    );
  }

  async clearRelevantCaches(): Promise<{ clearedCount: number }> {
    const keys = await localStorageService.getAllKeys();
    // Only remove derived/cache keys; keep user profile and core app state keys.
    const targetKeys = getCacheClearableLocalStorageKeys(keys);

    if (targetKeys.length) {
      await localStorageService.multiRemove(targetKeys);
    }

    const { clearedCount: guestDocumentClearedCount } = await this.clearGuestDocumentCaches();

    await localStorageService.setItem(
      LOCAL_STORAGE_KEYS.cacheLastClearedAt,
      String(Date.now())
    );
    return { clearedCount: targetKeys.length + guestDocumentClearedCount };
  }

  async runAutoClearMaintenance(): Promise<{ ran: boolean; clearedCount: number }> {
    const enabled = await this.getAutoClearEnabled();
    if (!enabled) return { ran: false, clearedCount: 0 };

    const now = Date.now();
    // Throttle maintenance runs to avoid frequent full key scans.
    const rawLast = await localStorageService.getItem(LOCAL_STORAGE_KEYS.cacheLastClearedAt);
    const lastClearedAt = Number(rawLast ?? 0);
    if (
      Number.isFinite(lastClearedAt) &&
      lastClearedAt > 0 &&
      now - lastClearedAt < LOCAL_STORAGE_CACHE_POLICY.autoClearWindowMs
    ) {
      return { ran: false, clearedCount: 0 };
    }

    const { clearedCount } = await this.clearRelevantCaches();
    return { ran: true, clearedCount };
  }
}

export const cacheManagerService = new CacheManagerService();
