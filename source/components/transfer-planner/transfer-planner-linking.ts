
import { Alert, Linking } from "react-native";
import { translations } from "@/services/app/translations";

export const CTCLINK_UNOFFICIAL_TRANSCRIPT_URL =
  "https://csprd.ctclink.us/psp/csprd/EMPLOYEE/SA/s/WEBLIB_HCX_RE.H_VW_UNOFF_TRANSCR.FieldFormula.IScript_Main?";

export async function openExternalLink(url: string) {
  const safeUrl =
    url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
  try {
    const canOpen = await Linking.canOpenURL(safeUrl);
    if (!canOpen) {
      Alert.alert(translations.English["resources.linkUnavailable"], translations.English["resources.linkUnavailableMessage"]);
      return;
    }
    await Linking.openURL(safeUrl);
  } catch {
    Alert.alert(translations.English["resources.linkUnavailable"], translations.English["resources.linkUnavailableMessage"]);
  }
}
