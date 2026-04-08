import type { Href } from "expo-router";

export const ROUTES = {
  root: "/" as const,
  tabs: "/(tabs)" as const,
  tabsSettings: "/(tabs)/settings" as const,
  tabsResources: "/(tabs)/resources" as const,
  login: "/login" as const,
  onboarding: "/onboarding" as const,
  profile: "/profile" as const,
  profileSetup: "/profile-setup" as const,
  questionnaire: "/questionnaire" as const,
  calendar: "/calendar" as Href,
  opportunityAdmin: "/opportunity-admin" as const,
  transferPlanner: "/transfer-planner" as const,
  compare: "/compare" as const,
  costCalculator: "/cost-calculator" as const,
  savedColleges: "/saved-colleges" as const,
  collegeSearch: "/college-search" as const,
  language: "/language" as const,
  about: "/about" as const,
  privacy: "/privacy" as const,
  terms: "/terms" as const,
  forgotPassword: "/forgot-password" as const,
  collegeDetail(collegeId: string): Href {
    return {
      pathname: "/college/[collegeId]",
      params: { collegeId },
    };
  },
  loginWithQuery(query: string): Href {
    return `${ROUTES.login}?${query}` as Href;
  },
} as const;
