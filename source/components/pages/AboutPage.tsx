import { APP_VERSION } from "@/constants/app-version";
import { MinimalInfoPage } from "@/components/pages/MinimalInfoPage";
import { useAppLanguage } from "@/hooks/use-app-language";

export default function AboutPage() {
  const { t } = useAppLanguage();
  const aboutItems = [
    {
      icon: "school" as const,
      title: t("about.builtForTransferPlanningTitle"),
      body: t("about.builtForTransferPlanningBody"),
    },
    {
      icon: "auto-awesome" as const,
      title: t("about.aiHelperTitle"),
      body: t("about.aiHelperBody"),
    },
    {
      icon: "info-outline" as const,
      title: t("about.versionWithNumber", { version: APP_VERSION }),
      body: t("about.activeMaintenanceBody"),
    },
  ];

  return (
    <MinimalInfoPage
      title={t("about.title")}
      description={t("about.currentDescription")}
      items={aboutItems}
      note={t("about.planningToolNote")}
    />
  );
}
