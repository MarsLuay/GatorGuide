import { useCallback } from "react";
import { Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";

import type { AppDataState } from "@/hooks/use-app-data";
import type { AppTheme } from "@/hooks/use-app-theme";
import {
  buildDataExportPayload,
  readDataImportSnapshotFromFileUri,
  restoreDataImportSnapshot,
  saveDataExportPayloadForUser,
} from "@/services/app/data-portability.service";
import type { Language } from "@/services/app/translations";

type Translate = (key: string, params?: Record<string, string | number>) => string;

type UseDataPortabilityActionsInput = {
  isHydrated: boolean;
  state: AppDataState;
  theme: AppTheme;
  language: Language;
  restoreData: (data: AppDataState) => Promise<void>;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (language: Language) => void;
  t: Translate;
};

export function useDataPortabilityActions({
  isHydrated,
  state,
  theme,
  language,
  restoreData,
  setTheme,
  setLanguage,
  t,
}: UseDataPortabilityActionsInput) {
  const handleExportData = useCallback(async () => {
    if (!isHydrated) return;

    try {
      const payload = await buildDataExportPayload({ state, theme, language });
      const result = await saveDataExportPayloadForUser(payload);
      if (result.delivery === "filesystem") {
        Alert.alert(t("settings.exportReady"), t("settings.exportNotAvailable"));
      }
    } catch {
      Alert.alert(t("settings.exportFailed"), t("settings.exportError"));
    }
  }, [isHydrated, language, state, t, theme]);

  const handleImportData = useCallback(async () => {
    if (!isHydrated) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const snapshot = await readDataImportSnapshotFromFileUri(result.assets[0].uri);

      if (!snapshot) {
        Alert.alert(t("settings.invalidFile"), t("settings.invalidFileMessage"));
        return;
      }

      Alert.alert(
        t("settings.importConfirm"),
        t("settings.importOverwriteMessage"),
        [
          { text: t("general.cancel"), style: "cancel" },
          {
            text: t("settings.import"),
            style: "destructive",
            onPress: async () => {
              try {
                const restoredData = await restoreDataImportSnapshot(snapshot);
                await restoreData(restoredData);
                if (snapshot.theme) {
                  setTheme(snapshot.theme);
                }
                if (snapshot.language) {
                  setLanguage(snapshot.language);
                }
              } catch {
                Alert.alert(t("settings.importFailed"), t("settings.importError"));
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert(t("settings.importFailed"), t("settings.importError"));
    }
  }, [isHydrated, restoreData, setLanguage, setTheme, t]);

  return { handleExportData, handleImportData };
}
