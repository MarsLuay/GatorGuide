import { MinimalInfoPage } from "@/components/pages/MinimalInfoPage";

const TERMS_ITEMS = [
  {
    icon: "fact-check" as const,
    title: "Planning only",
    body: "Gator Guide helps organize transfer planning but does not guarantee admissions, scholarships, deadlines, or requirements.",
  },
  {
    icon: "verified-user" as const,
    title: "Respectful use",
    body: "Do not misuse, disrupt, scrape, reverse engineer, or interfere with the app or other users.",
  },
  {
    icon: "lock-outline" as const,
    title: "Your account",
    body: "You are responsible for activity under your account and for keeping your sign-in details secure.",
  },
];

export default function TermsOfServicePage() {
  return (
    <MinimalInfoPage
      title="Terms of Service"
      description="Use Gator Guide responsibly, protect your account, and verify important school decisions with official sources."
      items={TERMS_ITEMS}
      note="Continuing to use Gator Guide means you accept the current Terms."
    />
  );
}
