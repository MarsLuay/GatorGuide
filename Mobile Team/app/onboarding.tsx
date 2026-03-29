import { RouteAccessBoundary, hasCompletedProfileSetup } from "@/components/navigation/RouteAccessBoundary";
import OnboardingPage from "@/components/pages/OnboardingPage";
import { ROUTES } from "@/constants/routes";

export default function Onboarding() {
  return (
    <RouteAccessBoundary
      allowGuest={false}
      loadingMessage="Preparing your data"
      resolveRedirect={(user) => {
        if (user?.hasSeenOnboarding === true) {
          return hasCompletedProfileSetup(user) ? ROUTES.tabs : ROUTES.profileSetup;
        }
        return null;
      }}
    >
      <OnboardingPage />
    </RouteAccessBoundary>
  );
}
