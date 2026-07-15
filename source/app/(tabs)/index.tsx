import { Redirect, type Href } from "expo-router";

import { ROUTES } from "@/constants/routes";

/** P15-B: Home tab removed — land on Transfer Planner. */
export default function TabHomeRedirect() {
  return <Redirect href={ROUTES.transferPlanner as Href} />;
}
