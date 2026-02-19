import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_AUTO_CLEAR_ENABLED_KEY = "settings:cache:autoClear30d";
const CACHE_LAST_CLEARED_AT_KEY = "settings:cache:lastClearedAt";
const CACHE_AUTO_CLEAR_WINDOW_MS = 1000 * 60 * 60 * 24 * 5;

const CACHE_KEY_PREFIXES = [
  "college:",
  "zip:geocode:",
];

const CACHE_KEY_EXACT = new Set([
  "ai:lastResponse",
  "ai:lastResponseMap",
  "ai:lastRoadmap",
  "ai:recommend:factorCache:v1",
  "gatorguide:ai-usage:v1",
]);

class CacheManagerService {
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
    const targetKeys = keys.filter((key) =>
      CACHE_KEY_EXACT.has(key) || CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
    );

    if (targetKeys.length) {
      await AsyncStorage.multiRemove(targetKeys);
    }

    await AsyncStorage.setItem(CACHE_LAST_CLEARED_AT_KEY, String(Date.now()));
    return { clearedCount: targetKeys.length };
  }

  async runAutoClearMaintenance(): Promise<{ ran: boolean; clearedCount: number }> {
    const enabled = await this.getAutoClearEnabled();
    if (!enabled) return { ran: false, clearedCount: 0 };

    const now = Date.now();
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
