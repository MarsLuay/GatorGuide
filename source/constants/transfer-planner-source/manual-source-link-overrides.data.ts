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

export const TRANSFER_PLANNER_MANUAL_LINK_OVERRIDES: TransferPlannerManualSourceLinkOverride[] =
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
    {
      planId: "uw-tacoma-environmental-sustainability",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/sias/sam/environmental-sustainability",
      links: [
        {
          label: "UW Tacoma Environmental Sustainability BA degree requirements",
          url: "https://www.tacoma.uw.edu/sias/sam/environmental-sustainability",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-tacoma-computer-science-and-systems",
      pathwayId: "bachelor-of-science",
      mode: "merge",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
      links: [
        {
          label: "UW Tacoma Computer Science and Systems BS degree requirements",
          url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-tacoma-environmental-sustainability",
      pathwayId: "business-nonprofit-leadership-option",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/sias/sam/environmental-sustainability",
      links: [
        {
          label:
            "Scoped section: Business/Nonprofit Environmental Sustainability Option (20 credits) degree requirements",
          url: "https://www.tacoma.uw.edu/sias/sam/environmental-sustainability",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-tacoma-environmental-sustainability",
      pathwayId: "education-option",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/sias/sam/pre-environmental-education-option",
      links: [
        {
          label: "UW Tacoma Environmental Sustainability Education option degree requirements",
          url: "https://www.tacoma.uw.edu/sias/sam/pre-environmental-education-option",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-tacoma-environmental-sustainability",
      pathwayId: "environmental-communication-option",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/sias/sam/environmental-communication-option",
      links: [
        {
          label: "UW Tacoma Environmental Communication option degree requirements",
          url: "https://www.tacoma.uw.edu/sias/sam/environmental-communication-option",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-tacoma-environmental-sustainability",
      pathwayId: "policy-law-option",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/sias/sam/environmental-policy-and-law-option",
      links: [
        {
          label: "UW Tacoma Environmental Policy and Law option degree requirements",
          url: "https://www.tacoma.uw.edu/sias/sam/environmental-policy-and-law-option",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    ...[
      ["accounting-option", "UW Tacoma BABA Accounting curriculum"],
      ["finance-option", "UW Tacoma BABA Finance curriculum"],
      ["general-business-option", "UW Tacoma BABA General Business curriculum"],
      ["management-option", "UW Tacoma BABA Management curriculum"],
      ["marketing-option", "UW Tacoma BABA Marketing curriculum"],
    ].map(
      ([pathwayId, label]) =>
        ({
          planId: "uw-tacoma-bachelor-of-arts-in-business-administration",
          pathwayId,
          mode: "replace",
          preferredPrimaryUrl: "https://www.tacoma.uw.edu/business/design-courses-baba",
          links: [
            {
              label,
              url: "https://www.tacoma.uw.edu/business/design-courses-baba",
              status: "verified",
              sourceConfidence: "high",
            },
          ],
        }) satisfies TransferPlannerManualSourceLinkOverride
    ),
    {
      planId: "uw-tacoma-criminal-justice",
      pathwayId: "campus-pathway",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/swcj/criminal-justice-campus-curriculum",
      links: [
        {
          label: "UW Tacoma Criminal Justice campus curriculum",
          url: "https://www.tacoma.uw.edu/swcj/criminal-justice-campus-curriculum",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-tacoma-criminal-justice",
      pathwayId: "online-pathway",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/swcj/cj-online-curriculum",
      links: [
        {
          label: "UW Tacoma Criminal Justice online curriculum",
          url: "https://www.tacoma.uw.edu/swcj/cj-online-curriculum",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Tacoma Criminal Justice online admission requirements",
          url: "https://www.tacoma.uw.edu/swcj/criminal-justice-online-admission-requirements-and-how-apply",
          status: "verified",
          sourceConfidence: "medium",
        },
      ],
    },
    {
      planId: "uw-seattle-materials-science-engineering",
      mode: "merge",
      preferredPrimaryUrl: "https://mse.washington.edu/current/undergrad/courses",
      removedUrls: ["https://mse.washington.edu/about/abet"],
      links: [
        {
          label: "UW Materials Science & Engineering degree requirements",
          url: "https://mse.washington.edu/current/undergrad/courses",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-seattle-materials-science-engineering",
      pathwayId: "nme-option",
      mode: "merge",
      preferredPrimaryUrl: "https://mse.washington.edu/current/undergrad/courses",
      removedUrls: ["https://mse.washington.edu/about/abet"],
      links: [
        {
          label: "UW Materials Science & Engineering degree requirements",
          url: "https://mse.washington.edu/current/undergrad/courses",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
  ];
