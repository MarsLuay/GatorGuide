import { RouteAccessBoundary, hasCompletedProfileSetup } from "@/components/navigation/RouteAccessBoundary";
import ProfileSetupPage from "../components/pages/ProfileSetupPage";

export default function ProfileSetup() {
  return (
    <RouteAccessBoundary
      allowGuest={false}
      loadingMessage="Preparing your data"
      resolveRedirect={(user) => (hasCompletedProfileSetup(user) ? "/(tabs)" : null)}
    >
      <ProfileSetupPage />
    </RouteAccessBoundary>
  );
}
