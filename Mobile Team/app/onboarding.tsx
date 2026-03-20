import { RouteAccessBoundary, hasCompletedProfileSetup } from "@/components/navigation/RouteAccessBoundary";
import OnboardingPage from "@/components/pages/OnboardingPage";

export default function Onboarding() {
  return (
    <RouteAccessBoundary
      allowGuest={false}
      loadingMessage="Preparing your data"
      resolveRedirect={(user) => {
        if (user?.hasSeenOnboarding === true) {
          return hasCompletedProfileSetup(user) ? "/(tabs)" : "/profile-setup";
        }
        return null;
      }}
    >
      <OnboardingPage />
    </RouteAccessBoundary>
  );
}
