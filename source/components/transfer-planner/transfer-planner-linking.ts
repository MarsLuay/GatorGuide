
import { Alert, Linking } from "react-native";
import { translations } from "@/services/app/translations";

export const CTCLINK_UNOFFICIAL_TRANSCRIPT_URL =
  "https://csprd.ctclink.us/psc/csprd/EMPLOYEE/SA/c/PORTAL_ADMIN.PTSF_GBLSRCH_FLUID.GBL?SEARCH_GROUP=PTPORTALREGISTRY&SEARCH_TEXT=unofficial%20transcript&SEARCH_TYPE=BASIC";

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
