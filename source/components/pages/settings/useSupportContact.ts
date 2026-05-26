import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/constants/support";
import type { User } from "@/hooks/use-app-data";
import { fetchWithHandling } from "@/services/network/fetch-with-handling";
import { useCallback, useState } from "react";
import { Alert, Linking, Platform } from "react-native";

const SUPPORT_MESSAGE_WEBHOOK =
  process.env.EXPO_PUBLIC_SUPPORT_MESSAGE_WEBHOOK ||
  "https://us-central1-gatorguide.cloudfunctions.net/sendSupportMessage";

type Translate = (key: string, params?: Record<string, string | number>) => string;

function buildSupportMailtoUrl(message: string, subjectText: string, userEmail?: string | null) {
  const subject = encodeURIComponent(subjectText);
  const userLine = userEmail ? `User: ${userEmail}\n` : "";
  const body = encodeURIComponent(`${userLine}\n${message}`);
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}

function openMailtoUrlOnWeb(mailtoUrl: string) {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;

  try {
    window.location.href = mailtoUrl;
    return true;
  } catch {
    return false;
  }
}

async function openExternalMailtoUrl(mailtoUrl: string) {
  if (openMailtoUrlOnWeb(mailtoUrl)) return true;

  const canOpen = await Linking.canOpenURL(mailtoUrl);
  if (!canOpen) return false;

  await Linking.openURL(mailtoUrl);
  return true;
}

export function useSupportContact({
  t,
  user,
}: {
  t: Translate;
  user: Pick<User, "email" | "name" | "uid"> | null;
}) {
  const [showSupportComposer, setShowSupportComposer] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [supportStatus, setSupportStatus] = useState<"" | "sent" | "error">("");
  const [supportStatusText, setSupportStatusText] = useState("");

  const openSupportEmail = useCallback(
    async (mailtoUrl = SUPPORT_MAILTO) => {
      try {
        const opened = await openExternalMailtoUrl(mailtoUrl);
        if (!opened) {
          Alert.alert(t("settings.support"), t("settings.supportEmailAppUnavailable"));
          return false;
        }

        return true;
      } catch {
        Alert.alert(t("settings.support"), t("settings.supportEmailAppUnavailable"));
        return false;
      }
    },
    [t]
  );

  const openSupportComposer = useCallback(() => {
    setSupportStatus("");
    setSupportStatusText("");
    setShowSupportComposer(true);
  }, []);

  const sendSupportMessage = useCallback(async () => {
    const message = supportMessage.trim();
    if (!message) {
      Alert.alert(t("settings.support"), t("settings.supportEmptyMessage"));
      return;
    }

    const mailtoUrl = buildSupportMailtoUrl(message, t("settings.supportEmailSubject"), user?.email);
    const fallbackToMailto = async () => {
      const opened = await openSupportEmail(mailtoUrl);
      if (opened) {
        setSupportStatus("sent");
        setSupportStatusText(t("settings.supportOpenedEmailApp"));
      }
    };

    setSupportStatus("");
    setSupportStatusText("");

    if (Platform.OS === "web") {
      await fallbackToMailto();
      return;
    }

    setIsSendingSupport(true);
    try {
      if (!SUPPORT_MESSAGE_WEBHOOK) {
        await fallbackToMailto();
        return;
      }

      await fetchWithHandling(SUPPORT_MESSAGE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        operation: "Support message webhook",
        timeoutMs: 12000,
        body: JSON.stringify({
          app: "GatorGuide",
          timestamp: new Date().toISOString(),
          platform: Platform.OS,
          userName: user?.name || "",
          userEmail: user?.email || "",
          userUid: user?.uid || "",
          message,
        }),
      });

      setSupportMessage("");
      setShowSupportComposer(false);
      setSupportStatus("sent");
      setSupportStatusText(t("settings.supportMessageSent"));
      Alert.alert(t("settings.support"), t("settings.supportMessageSent"));
    } catch {
      setSupportStatus("error");
      setSupportStatusText(t("settings.supportFallbackEmail"));
      await fallbackToMailto();
    } finally {
      setIsSendingSupport(false);
    }
  }, [openSupportEmail, supportMessage, t, user]);

  return {
    isSendingSupport,
    openSupportComposer,
    openSupportEmail,
    sendSupportMessage,
    setShowSupportComposer,
    setSupportMessage,
    showSupportComposer,
    supportMessage,
    supportStatus,
    supportStatusText,
  };
}
