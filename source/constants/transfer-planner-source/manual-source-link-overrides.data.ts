import type { TransferPlannerSourceLink } from "./schema";

export type TransferPlannerManualSourceLinkOverrideMode = "merge" | "replace";

export type TransferPlannerManualSourceLinkOverride = {
  planId: string;
  pathwayId?: string | null;
  mode?: TransferPlannerManualSourceLinkOverrideMode;
  preferredPrimaryUrl?: string | null;
  removedUrls?: string[];
  links?: TransferPlannerSourceLink[];
};

export const TRANSFER_PLANNER_MANUAL_SOURCE_LINK_OVERRIDES: TransferPlannerManualSourceLinkOverride[] =
  [
    {
      planId: "uw-bothell-economics",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/curriculum",
      links: [
        {
          label: "UW Bothell Bachelor of Economics curriculum",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/curriculum",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-tacoma-sustainable-urban-development",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/urban-studies/ba-sustainable-urban-development",
      links: [
        {
          label: "UW Tacoma Sustainable Urban Development degree requirements",
          url: "https://www.tacoma.uw.edu/urban-studies/ba-sustainable-urban-development",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
  ];
