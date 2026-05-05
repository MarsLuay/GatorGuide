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
    // UW Tacoma Arts, Media and Culture (BA)
    // Keep overview page; add track pages as supplemental sources
    {
      planId: "uw-tacoma-arts-media-culture",
      pathwayId: null,
      mode: "merge",
      links: [
        {
          label: "UW Tacoma Arts, Media and Culture - Literature Track",
          url: "https://www.tacoma.uw.edu/sias/cac/literature-track",
        },
        {
          label: "UW Tacoma Arts, Media and Culture - Film and Media Track",
          url: "https://www.tacoma.uw.edu/sias/cac/film-and-media-track",
        },
        {
          label: "UW Tacoma Arts, Media and Culture - Visual and Performing Arts Track",
          url: "https://www.tacoma.uw.edu/sias/cac/visual-and-performing-arts-track",
        },
        {
          label: "UW Tacoma Arts, Media and Culture - Comparative Arts Track",
          url: "https://www.tacoma.uw.edu/sias/cac/comparative-arts-track",
        },
        {
          label: "UW Tacoma Arts, Media and Culture - American Cultures Track",
          url: "https://www.tacoma.uw.edu/sias/cac/american-cultures-track",
        },
      ],
    },
    // UW Tacoma Communications (BA) - Professional Track
    // Replace weak parent page with direct professional track requirement page
    {
      planId: "uw-tacoma-communications",
      pathwayId: "professional-track",
      mode: "replace",
      preferredPrimaryUrl: "https://www.tacoma.uw.edu/sias/cac/professional-track",
    },
  ];
