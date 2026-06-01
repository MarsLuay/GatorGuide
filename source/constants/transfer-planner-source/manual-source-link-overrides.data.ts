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
          label: "UW Bothell Bachelor of Economics overview",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell Bachelor of Economics prerequisites",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/prerequisites",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell Bachelor of Economics curriculum",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/curriculum",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-bothell-applied-computing",
      mode: "merge",
      preferredPrimaryUrl:
        "https://www.uwb.edu/stem/undergraduate/majors/applied-computing/curriculum",
      links: [
        {
          label: "UW Bothell Applied Computing curriculum",
          url: "https://www.uwb.edu/stem/undergraduate/majors/applied-computing/curriculum",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell Applied Computing admissions requirements",
          url: "https://www.uwb.edu/stem/undergraduate/majors/applied-computing/admissions",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-bothell-business-administration",
      mode: "merge",
      preferredPrimaryUrl:
        "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum",
      links: [
        {
          label: "UW Bothell BBA overview and areas of study",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell BBA prerequisite courses",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell BBA curriculum",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-bothell-business-administration",
      pathwayId: "business-analytics-and-ai-concentration",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/business-analytics-artificial-intelligence",
      links: [
        {
          label: "UW Bothell Business Analytics and AI concentration requirements",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/business-analytics-artificial-intelligence",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell BBA prerequisite courses",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-bothell-business-administration",
      pathwayId: "mis-concentration",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/mis",
      links: [
        {
          label: "UW Bothell MIS concentration requirements",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/mis",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell BBA prerequisite courses",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-bothell-business-administration",
      pathwayId: "self-directed-concentration",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/self-directed",
      links: [
        {
          label: "UW Bothell self-directed concentration requirements",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/self-directed",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell BBA prerequisite courses",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-bothell-business-administration",
      pathwayId: "tim-concentration",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/tim",
      links: [
        {
          label: "UW Bothell TIM concentration requirements",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/tim",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell BBA prerequisite courses",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-bothell-computer-engineering",
      mode: "merge",
      preferredPrimaryUrl:
        "https://www.uwb.edu/stem/undergraduate/majors/bscompe/curriculum",
      links: [
        {
          label: "UW Bothell Computer Engineering curriculum",
          url: "https://www.uwb.edu/stem/undergraduate/majors/bscompe/curriculum",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell Computer Engineering admissions requirements",
          url: "https://www.uwb.edu/stem/undergraduate/majors/bscompe/admissions",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell general education requirements",
          url: "https://www.uwb.edu/advising/general-education-requirements",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-bothell-csse",
      mode: "merge",
      preferredPrimaryUrl:
        "https://www.uwb.edu/stem/undergraduate/majors/bscsse/curriculum",
      links: [
        {
          label: "UW Bothell CSSE curriculum",
          url: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/curriculum",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell CSSE admissions requirements",
          url: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/admissions",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell CSSE capstone requirements",
          url: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/capstone",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-bothell-csse-information-assurance-and-cybersecurity",
      mode: "merge",
      preferredPrimaryUrl:
        "https://www.uwb.edu/stem/undergraduate/majors/bscsse/curriculum",
      links: [
        {
          label: "UW Bothell CSSE IAC curriculum",
          url: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/curriculum",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell CSSE admissions requirements",
          url: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/admissions",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell CSSE capstone requirements",
          url: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/capstone",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-bothell-nursing-first-year-rn-to-bsn",
      mode: "merge",
      preferredPrimaryUrl:
        "https://www.uwb.edu/nhs/undergraduate/rn-bsn/requirements",
      links: [
        {
          label: "UW Bothell RN to BSN student requirements",
          url: "https://www.uwb.edu/nhs/undergraduate/rn-bsn/requirements",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell RN to BSN overview and credit structure",
          url: "https://www.uwb.edu/nhs/undergraduate/rn-bsn/overview",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell first-year admission requirements",
          url: "https://www.uwb.edu/catalog/admissions/first-year-student-admission",
          status: "verified",
          sourceConfidence: "medium",
        },
      ],
    },
    {
      planId: "uw-bothell-nursing-rn-to-bsn",
      mode: "merge",
      preferredPrimaryUrl:
        "https://www.uwb.edu/nhs/undergraduate/rn-bsn/requirements",
      links: [
        {
          label: "UW Bothell RN to BSN student requirements",
          url: "https://www.uwb.edu/nhs/undergraduate/rn-bsn/requirements",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell RN to BSN overview and credit structure",
          url: "https://www.uwb.edu/nhs/undergraduate/rn-bsn/overview",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell RN to BSN admissions requirements",
          url: "https://www.uwb.edu/nhs/undergraduate/rn-bsn/admissions",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Bothell RN to BSN course schedule PDF",
          url: "https://www.uwb.edu/nhs/wp-content/uploads/sites/9/2025/06/2025-Fall-Bothell-In-Person-Schedule-Course-Info.pdf",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-tacoma-bachelor-of-arts-in-business-administration",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/business/design-courses-baba",
      links: [
        {
          label: "UW Tacoma BABA admissions prerequisites",
          url: "https://www.tacoma.uw.edu/business/baba-admissions",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Tacoma BABA design and courses",
          url: "https://www.tacoma.uw.edu/business/design-courses-baba",
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
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/set/programs/undergrad/css",
      removedUrls: [
        "https://www.tacoma.uw.edu/uwt/sites/default/files/2021-07/css_bs_grid.pdf",
      ],
      links: [
        {
          label: "UW Tacoma Computer Science and Systems overview",
          url: "https://www.tacoma.uw.edu/set/programs/undergrad/css",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Tacoma Computer Science and Systems BA degree requirements",
          url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Tacoma Computer Science and Systems BA planning grid",
          url: "https://www.tacoma.uw.edu/sites/default/files/2022-10/CSS_B.A._Grid_2022.pdf",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Tacoma Computer Science and Systems BS degree requirements",
          url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Tacoma Computer Science and Systems BS planning grid",
          url: "https://www.tacoma.uw.edu/sites/default/files/2024-10/css_b.s-grid_2023.pdf",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-tacoma-computer-science-and-systems",
      pathwayId: "bachelor-of-arts",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
      links: [
        {
          label: "UW Tacoma Computer Science and Systems BA degree requirements",
          url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Tacoma Computer Science and Systems BA planning grid",
          url: "https://www.tacoma.uw.edu/sites/default/files/2022-10/CSS_B.A._Grid_2022.pdf",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-tacoma-computer-science-and-systems",
      pathwayId: "bachelor-of-science",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
      removedUrls: [
        "https://www.tacoma.uw.edu/uwt/sites/default/files/2021-07/css_bs_grid.pdf",
      ],
      links: [
        {
          label: "UW Tacoma Computer Science and Systems BS degree requirements",
          url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Tacoma Computer Science and Systems BS planning grid",
          url: "https://www.tacoma.uw.edu/sites/default/files/2024-10/css_b.s-grid_2023.pdf",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-tacoma-computer-science-and-systems-ba",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
      links: [
        {
          label: "UW Tacoma Computer Science and Systems BA degree requirements",
          url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Tacoma Computer Science and Systems BA planning grid",
          url: "https://www.tacoma.uw.edu/sites/default/files/2022-10/CSS_B.A._Grid_2022.pdf",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-tacoma-computer-science-and-systems-bs",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
      removedUrls: [
        "https://www.tacoma.uw.edu/uwt/sites/default/files/2021-07/css_bs_grid.pdf",
      ],
      links: [
        {
          label: "UW Tacoma Computer Science and Systems BS degree requirements",
          url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW Tacoma Computer Science and Systems BS planning grid",
          url: "https://www.tacoma.uw.edu/sites/default/files/2024-10/css_b.s-grid_2023.pdf",
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
    {
      planId: "uw-seattle-marine-biology",
      mode: "replace",
      preferredPrimaryUrl:
        "https://marinebiology.uw.edu/students/marine-biology-major/major-requirements/",
      links: [
        {
          label: "UW Marine Biology major requirements",
          url: "https://marinebiology.uw.edu/students/marine-biology-major/major-requirements/",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-seattle-nursing",
      mode: "replace",
      preferredPrimaryUrl:
        "https://nursing.uw.edu/wp-content/uploads/2025/05/BSN-Prerequisites-Worksheet.pdf",
      links: [
        {
          label: "UW BSN prerequisite courses worksheet",
          url: "https://nursing.uw.edu/wp-content/uploads/2025/05/BSN-Prerequisites-Worksheet.pdf",
          status: "verified",
          sourceConfidence: "high",
        },
        {
          label: "UW BSN current curriculum grid",
          url: "https://students.nursing.uw.edu/wp-content/uploads/2025/09/BSN-2025-Curriuculum-Grid.pdf",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-seattle-philosophy",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.washington.edu/students/gencat/program/S/Philosophy-221.html#credential-bb3d1eb1-5da8-4e82-b76a-f8ad86d7870d",
      links: [
        {
          label: "UW General Catalog Philosophy requirements",
          url: "https://www.washington.edu/students/gencat/program/S/Philosophy-221.html#credential-bb3d1eb1-5da8-4e82-b76a-f8ad86d7870d",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-seattle-philosophy",
      pathwayId: "ba-option-family:ethics",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.washington.edu/students/gencat/program/S/Philosophy-221.html#credential-5dced2c349deed2400cc9c25",
      links: [
        {
          label: "UW General Catalog Philosophy: Ethics requirements",
          url: "https://www.washington.edu/students/gencat/program/S/Philosophy-221.html#credential-5dced2c349deed2400cc9c25",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-seattle-psychology",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.washington.edu/students/gencat/program/S/Psychology-262.html",
      links: [
        {
          label: "UW General Catalog Psychology requirements",
          url: "https://www.washington.edu/students/gencat/program/S/Psychology-262.html",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-seattle-psychology",
      pathwayId: "bachelor-of-arts",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.washington.edu/students/gencat/program/S/Psychology-262.html",
      links: [
        {
          label: "UW General Catalog Psychology BA requirements",
          url: "https://www.washington.edu/students/gencat/program/S/Psychology-262.html",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-seattle-psychology",
      pathwayId: "bachelor-of-science",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.washington.edu/students/gencat/program/S/Psychology-262.html",
      links: [
        {
          label: "UW General Catalog Psychology BS requirements",
          url: "https://www.washington.edu/students/gencat/program/S/Psychology-262.html",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-seattle-slavic-languages-and-literatures",
      mode: "replace",
      preferredPrimaryUrl: "https://slavic.washington.edu/undergraduate-programs",
      links: [
        {
          label: "UW Slavic Languages & Literatures undergraduate programs",
          url: "https://slavic.washington.edu/undergraduate-programs",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-seattle-slavic-languages-and-literatures",
      pathwayId: "eastern-european-languages-literature-and-culture",
      mode: "replace",
      preferredPrimaryUrl:
        "https://slavic.washington.edu/ba-eastern-european-languages-literature-and-culture",
      links: [
        {
          label: "UW BA in Eastern European Languages, Literature, and Culture",
          url: "https://slavic.washington.edu/ba-eastern-european-languages-literature-and-culture",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-seattle-slavic-languages-and-literatures",
      pathwayId: "russian-language-literature-and-culture",
      mode: "replace",
      preferredPrimaryUrl:
        "https://slavic.washington.edu/ba-russian-language-literature-and-culture",
      links: [
        {
          label: "UW BA in Russian Language, Literature, and Culture",
          url: "https://slavic.washington.edu/ba-russian-language-literature-and-culture",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-seattle-south-asian-languages-and-cultures",
      mode: "replace",
      preferredPrimaryUrl:
        "https://asian.washington.edu/ba-south-asian-languages-and-cultures",
      links: [
        {
          label: "UW South Asian Languages and Cultures BA requirements",
          url: "https://asian.washington.edu/ba-south-asian-languages-and-cultures",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
    {
      planId: "uw-seattle-speech-and-hearing-sciences",
      mode: "replace",
      preferredPrimaryUrl:
        "https://www.washington.edu/students/gencat/program/S/SpeechandHearingSciences-296.html",
      links: [
        {
          label: "UW General Catalog Speech and Hearing Sciences requirements",
          url: "https://www.washington.edu/students/gencat/program/S/SpeechandHearingSciences-296.html",
          status: "verified",
          sourceConfidence: "high",
        },
      ],
    },
  ];
