import { APP_VERSION } from "@/constants/app-version";
import { MinimalInfoPage } from "@/components/pages/MinimalInfoPage";

const ABOUT_ITEMS = [
  {
    icon: "school" as const,
    title: "Built for transfer planning",
    body: "Track the details that matter while you compare colleges and prepare for transfer.",
  },
  {
    icon: "auto-awesome" as const,
    title: "AI is a helper",
    body: "Use recommendations and planning help as a starting point, then confirm important decisions with official sources.",
  },
  {
    icon: "info-outline" as const,
    title: `Version ${APP_VERSION}`,
    body: "This app is actively maintained for student planning, support, and transfer tools.",
  },
];

export default function AboutPage() {
  return (
    <MinimalInfoPage
      title="About Gator Guide"
      description="Gator Guide helps Green River students keep transfer planning, college search, deadlines, and next steps in one place."
      items={ABOUT_ITEMS}
      note="Gator Guide is a planning tool and does not guarantee admission, scholarship awards, or transfer outcomes."
    />
  );
}
