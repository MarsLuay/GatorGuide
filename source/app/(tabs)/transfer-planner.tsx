import { Redirect, type Href, useLocalSearchParams } from "expo-router";

import { ROUTES } from "@/constants/routes";

export default function LegacyTransferPlannerRedirect() {
  const params = useLocalSearchParams();
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null) {
          searchParams.append(key, item);
        }
      }
      continue;
    }

    if (value != null) {
      searchParams.set(key, value);
    }
  }

  const href = searchParams.size
    ? `${ROUTES.transferPlanner}?${searchParams.toString()}`
    : ROUTES.transferPlanner;

  return <Redirect href={href as Href} />;
}
