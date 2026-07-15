import { Redirect, type Href } from "expo-router";

import { ROUTES } from "@/constants/routes";

/** P14-A: Cost Calculator removed from product shell — redirect to Resources. */
export default function CostCalculatorRetiredRedirect() {
  return <Redirect href={ROUTES.tabsResources as Href} />;
}
