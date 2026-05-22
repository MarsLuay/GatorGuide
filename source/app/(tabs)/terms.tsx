import { MinimalInfoPage } from "@/components/pages/MinimalInfoPage";
import { useAppLanguage } from "@/hooks/use-app-language";

export default function TermsOfServicePage() {
  const { t } = useAppLanguage();
  const termsItems = [
    {
      icon: "fact-check" as const,
      title: t("terms.planningOnlyTitle"),
      body: t("terms.planningOnlyBody"),
    },
    {
      icon: "verified-user" as const,
      title: t("terms.respectfulUseTitle"),
      body: t("terms.respectfulUseBody"),
    },
    {
      icon: "lock-outline" as const,
      title: t("terms.yourAccountTitle"),
      body: t("terms.yourAccountBody"),
    },
  ];

  return (
    <MinimalInfoPage
      title={t("settings.termsOfService")}
      description={t("terms.description")}
      items={termsItems}
      note={t("terms.note")}
    />
  );
}
