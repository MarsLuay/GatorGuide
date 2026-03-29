import {
  OPPORTUNITY_FINANCIAL_AID_TAGS,
  OPPORTUNITY_SCHEMA_VERSION,
  OPPORTUNITY_SOURCE_KINDS,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  type Opportunity,
} from "@/constants/opportunities";

export const STARTER_OPPORTUNITIES: Opportunity[] = [
  {
    schemaVersion: OPPORTUNITY_SCHEMA_VERSION,
    opportunityId: "green-river-foundation-scholarship",
    type: OPPORTUNITY_TYPES.scholarship,
    status: OPPORTUNITY_STATUSES.active,
    title: "Green River College Foundation Scholarship",
    organizationName: "Green River College Foundation",
    summary:
      "Annual scholarship application for Green River students with a short essay-style application and broad eligibility.",
    externalUrl: "https://grcfoundation.awardspring.com/",
    dueAt: "2026-04-30T16:00:00.000Z",
    recurrence: {
      isYearly: true,
      month: 4,
      day: 30,
      timezone: "America/Los_Angeles",
    },
    matching: {
      financialAidTags: [
        OPPORTUNITY_FINANCIAL_AID_TAGS.needBased,
        OPPORTUNITY_FINANCIAL_AID_TAGS.merit,
      ],
      suggestedMajors: [],
      hasToBeMajor: false,
    },
    requirements: {
      needsRecommendations: true,
      essayCount: 3,
    },
    college: {
      collegeId: null,
      collegeName: "Green River College",
      city: "Auburn",
      state: "WA",
      website: "https://www.greenriver.edu/",
    },
    source: {
      kind: OPPORTUNITY_SOURCE_KINDS.seed,
      sourceUrl:
        "https://www.greenriver.edu/marketing/media/documents/grad-to-gator/Green-River-College_Free-money-for-College.pdf",
      sourceLabel: "Green River Foundation scholarship flyer",
      model: null,
      fetchedAt: "2026-03-29T00:00:00.000Z",
      verifiedAt: "2026-03-29T00:00:00.000Z",
    },
    createdAt: "2026-03-29T00:00:00.000Z",
    updatedAt: "2026-03-29T00:00:00.000Z",
  },
  {
    schemaVersion: OPPORTUNITY_SCHEMA_VERSION,
    opportunityId: "wsos-career-technical-scholarship",
    type: OPPORTUNITY_TYPES.scholarship,
    status: OPPORTUNITY_STATUSES.active,
    title: "WSOS Career & Technical Scholarship",
    organizationName: "Washington State Opportunity Scholarship",
    summary:
      "Washington scholarship for eligible community and technical college students in high-demand career programs, including associate and certificate pathways.",
    externalUrl: "https://waopportunityscholarship.org/applicants/career-technical/",
    dueAt: "2026-04-15T16:00:00.000Z",
    recurrence: {
      isYearly: true,
      month: 4,
      day: 15,
      timezone: "America/Los_Angeles",
    },
    matching: {
      financialAidTags: [
        OPPORTUNITY_FINANCIAL_AID_TAGS.needBased,
        OPPORTUNITY_FINANCIAL_AID_TAGS.fafsaRequired,
      ],
      suggestedMajors: [
        "computer science",
        "engineering",
        "nursing",
        "information technology",
        "healthcare",
        "stem",
      ],
      hasToBeMajor: false,
    },
    requirements: {
      needsRecommendations: false,
      essayCount: 1,
    },
    college: {
      collegeId: null,
      collegeName: "Green River College",
      city: "Auburn",
      state: "WA",
      website: "https://www.greenriver.edu/",
    },
    source: {
      kind: OPPORTUNITY_SOURCE_KINDS.seed,
      sourceUrl: "https://waopportunityscholarship.org/applicants/career-technical/",
      sourceLabel: "WSOS CTS applicant page",
      model: null,
      fetchedAt: "2026-03-29T00:00:00.000Z",
      verifiedAt: "2026-03-29T00:00:00.000Z",
    },
    createdAt: "2026-03-29T00:00:00.000Z",
    updatedAt: "2026-03-29T00:00:00.000Z",
  },
  {
    schemaVersion: OPPORTUNITY_SCHEMA_VERSION,
    opportunityId: "green-river-student-employment",
    type: OPPORTUNITY_TYPES.internship,
    status: OPPORTUNITY_STATUSES.active,
    title: "Green River Student Employment & Work Study",
    organizationName: "Green River College",
    summary:
      "On-campus student employment and work study openings for eligible Green River students. Good first step for building experience while enrolled.",
    externalUrl:
      "https://www.greenriver.edu/students/pay-for-college/financial-aid/student-employment/index.html",
    dueAt: null,
    recurrence: {
      isYearly: false,
      month: null,
      day: null,
      timezone: "America/Los_Angeles",
    },
    matching: {
      financialAidTags: [
        OPPORTUNITY_FINANCIAL_AID_TAGS.workStudy,
        OPPORTUNITY_FINANCIAL_AID_TAGS.needBased,
      ],
      suggestedMajors: [],
      hasToBeMajor: false,
    },
    requirements: {
      needsRecommendations: false,
      essayCount: 0,
    },
    college: {
      collegeId: null,
      collegeName: "Green River College",
      city: "Auburn",
      state: "WA",
      website: "https://www.greenriver.edu/",
    },
    source: {
      kind: OPPORTUNITY_SOURCE_KINDS.seed,
      sourceUrl:
        "https://www.greenriver.edu/students/pay-for-college/financial-aid/student-employment/index.html",
      sourceLabel: "Green River student employment page",
      model: null,
      fetchedAt: "2026-03-29T00:00:00.000Z",
      verifiedAt: "2026-03-29T00:00:00.000Z",
    },
    createdAt: "2026-03-29T00:00:00.000Z",
    updatedAt: "2026-03-29T00:00:00.000Z",
  },
];
