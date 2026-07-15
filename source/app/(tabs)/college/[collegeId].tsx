import { Redirect, type Href } from "expo-router";

import { ROUTES } from "@/constants/routes";

/** P14-A: College detail removed from product shell — redirect to Resources. */
export default function CollegeDetailRetiredRedirect() {
  return <Redirect href={ROUTES.tabsResources as Href} />;
}
