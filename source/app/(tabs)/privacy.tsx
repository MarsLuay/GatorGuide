import { MinimalInfoPage } from "@/components/pages/MinimalInfoPage";
import { useAppLanguage } from "@/hooks/use-app-language";

export default function PrivacyPolicyPage() {
  const { t } = useAppLanguage();
  const privacyItems = [
    {
      icon: "person-outline" as const,
      title: t("privacy.whatYouProvideTitle"),
      body: t("privacy.whatYouProvideBody"),
    },
    {
      icon: "cloud-queue" as const,
      title: t("privacy.whereItLivesTitle"),
      body: t("privacy.whereItLivesBody"),
    },
    {
      icon: "tune" as const,
      title: t("privacy.yourChoicesTitle"),
      body: t("privacy.yourChoicesBody"),
    },
  ];

  return (
    <MinimalInfoPage
      title={t("settings.privacyPolicy")}
      description={t("privacy.description")}
      items={privacyItems}
      note={t("privacy.note")}
    />
  );
}
