import { Redirect, type Href } from "expo-router";

import { ROUTES } from "@/constants/routes";

/** P14-A: Saved Colleges removed from product shell — redirect to Resources. */
export default function SavedCollegesRetiredRedirect() {
  return <Redirect href={ROUTES.tabsResources as Href} />;
}
