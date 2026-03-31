import type { Opportunity } from "@/constants/opportunities";

type RawOpportunityCatalog = Opportunity[] | { default?: Opportunity[] };

function loadStarterOpportunityData() {
  const rawCatalog = require("../data/starter-opportunities.json") as RawOpportunityCatalog;
  if (Array.isArray(rawCatalog)) return rawCatalog;
  if (Array.isArray(rawCatalog?.default)) return rawCatalog.default;
  return [];
}

export const STARTER_OPPORTUNITIES: Opportunity[] = loadStarterOpportunityData();
