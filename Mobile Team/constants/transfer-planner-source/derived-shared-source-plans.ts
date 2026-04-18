export type TransferPlannerDerivedSharedSourcePlanAlias = {
  sourcePlanId: string;
  derivedPlanId: string;
  derivedTitle: string;
  derivedShortTitle?: string;
};

export const TRANSFER_PLANNER_DERIVED_SHARED_SOURCE_PLAN_ALIASES: TransferPlannerDerivedSharedSourcePlanAlias[] =
  [
    {
      sourcePlanId: "uw-seattle-classics",
      derivedPlanId: "uw-seattle-classical-studies",
      derivedTitle: "Classical Studies",
    },
  ];
