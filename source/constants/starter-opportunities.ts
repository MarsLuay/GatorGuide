import type { Opportunity } from "@/constants/opportunities";
import { unwrapJsonArrayModule } from "@/constants/json-array-module";

function loadStarterOpportunityData() {
  return unwrapJsonArrayModule(
    require("../data/starter-opportunities.json") as Opportunity[]
  );
}

export const STARTER_OPPORTUNITIES: Opportunity[] = loadStarterOpportunityData();
