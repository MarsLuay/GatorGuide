import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getLocalStorageContractForKey,
  type LocalStorageContract,
} from "@/services/storage/local-storage-contracts";

function getContractOrThrow(key: string): LocalStorageContract {
  const contract = getLocalStorageContractForKey(key);
  if (contract) return contract;

  throw new Error(
    `Unregistered local storage key "${key}". Add it to LOCAL_STORAGE_CONTRACTS before reading or writing app storage.`
  );
}

function assertContractedKeys(keys: readonly string[]) {
  for (const key of keys) {
    getContractOrThrow(key);
  }
}

class LocalStorageService {
  getContract(key: string) {
    return getContractOrThrow(key);
  }

  getAllKeys() {
    return AsyncStorage.getAllKeys();
  }

  async getItem(key: string) {
    getContractOrThrow(key);
    return AsyncStorage.getItem(key);
  }

  async setItem(key: string, value: string) {
    getContractOrThrow(key);
    return AsyncStorage.setItem(key, value);
  }

  async removeItem(key: string) {
    getContractOrThrow(key);
    return AsyncStorage.removeItem(key);
  }

  async multiGet(keys: readonly string[]) {
    assertContractedKeys(keys);
    return AsyncStorage.multiGet([...keys]);
  }

  async multiSet(entries: readonly (readonly [string, string])[]) {
    assertContractedKeys(entries.map(([key]) => key));
    return AsyncStorage.multiSet(entries.map(([key, value]) => [key, value]));
  }

  async multiRemove(keys: readonly string[]) {
    assertContractedKeys(keys);
    return AsyncStorage.multiRemove([...keys]);
  }
}

export const localStorageService = new LocalStorageService();
