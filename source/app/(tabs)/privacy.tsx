import { MinimalInfoPage } from "@/components/pages/MinimalInfoPage";

const PRIVACY_ITEMS = [
  {
    icon: "person-outline" as const,
    title: "What you provide",
    body: "Profile details, questionnaire answers, saved colleges, deadlines, optional uploads, and support messages.",
  },
  {
    icon: "cloud-queue" as const,
    title: "Where it lives",
    body: "Guest data is mainly local. Signed-in data may sync through Firebase. Transcript files are treated local-first where supported.",
  },
  {
    icon: "tune" as const,
    title: "Your choices",
    body: "Use guest mode, skip optional AI or uploads, edit saved details, disable notifications, or delete your account.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <MinimalInfoPage
      title="Privacy Policy"
      description="Gator Guide uses the information you choose to provide to run planning, saving, account, and AI features."
      items={PRIVACY_ITEMS}
      note="Gator Guide does not sell personal information."
    />
  );
}
