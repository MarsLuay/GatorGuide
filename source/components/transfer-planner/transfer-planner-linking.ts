
import { Alert, Linking } from "react-native";
import { translations } from "@/services/app/translations";

export const CTCLINK_UNOFFICIAL_TRANSCRIPT_URL =
  "https://csprd.ctclink.us/psp/csprd/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSS_TSRQST_UNOFF.GBL?pts_Portal=EMPLOYEE&pts_PortalHostNode=SA&pts_Market=GBL";

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
