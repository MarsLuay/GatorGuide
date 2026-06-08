export type TransferPlannerDerivedSharedSourcePlanAlias = {
  sourcePlanId: string;
  sourcePathwayId?: string;
  derivedPlanId: string;
  derivedTitle: string;
  derivedShortTitle?: string;
};

export const TRANSFER_PLANNER_DERIVED_SHARED_PLAN_ALIASES: TransferPlannerDerivedSharedSourcePlanAlias[] =
  [
    {
      sourcePlanId: "uw-tacoma-bachelor-of-arts-in-business-administration",
      sourcePathwayId: "accounting-option",
      derivedPlanId: "uw-tacoma-accounting",
      derivedTitle: "Accounting",
      derivedShortTitle: "Accounting",
    },
    {
      sourcePlanId: "uw-tacoma-bachelor-of-arts-in-business-administration",
      sourcePathwayId: "finance-option",
      derivedPlanId: "uw-tacoma-finance",
      derivedTitle: "Finance",
      derivedShortTitle: "Finance",
    },
    {
      sourcePlanId: "uw-tacoma-bachelor-of-arts-in-business-administration",
      sourcePathwayId: "management-option",
      derivedPlanId: "uw-tacoma-management",
      derivedTitle: "Management",
      derivedShortTitle: "Management",
    },
    {
      sourcePlanId: "uw-tacoma-bachelor-of-arts-in-business-administration",
      sourcePathwayId: "marketing-option",
      derivedPlanId: "uw-tacoma-marketing",
      derivedTitle: "Marketing",
      derivedShortTitle: "Marketing",
    },
    {
      sourcePlanId: "uw-tacoma-criminal-justice",
      sourcePathwayId: "online-pathway",
      derivedPlanId: "uw-tacoma-criminal-justice-online",
      derivedTitle: "Criminal Justice - Online",
      derivedShortTitle: "Criminal Justice - Online",
    },
    {
      sourcePlanId: "uw-tacoma-urban-studies",
      sourcePathwayId: "pre-spring-2026-community-development-planning-option",
      derivedPlanId: "uw-tacoma-community-development-and-planning",
      derivedTitle: "Community Development & Planning",
      derivedShortTitle: "Community Development & Planning",
    },
    {
      sourcePlanId: "uw-tacoma-urban-studies",
      sourcePathwayId: "pre-spring-2026-gis-spatial-planning-option",
      derivedPlanId: "uw-tacoma-gis-and-spatial-planning",
      derivedTitle: "GIS & Spatial Planning",
      derivedShortTitle: "GIS & Spatial Planning",
    },
  ];
