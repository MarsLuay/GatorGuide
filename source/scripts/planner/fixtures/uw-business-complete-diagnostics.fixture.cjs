function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

const seattleBusinessGeneralEducationCourses = [
  "B CMU 301",
  "C LIT 240",
  "ENGL 109",
  "ENGL 110",
  "ENGL 111",
  "ENGL 121",
  "ENGL 131",
  "ENGL 182",
  "ENGL 197",
  "ENGL 198",
  "ENGL 199",
  "ENGL 281",
  "ENGL 297",
  "ENGL 298",
  "ENGL 299",
  "ENGL 381",
  "ECON 200",
  "ECON 201",
  "MATH 112",
  "MATH 124",
  "MATH 134",
];

const seattleBusinessCoreCourses = [
  "ACCTG 215",
  "ACCTG 225",
  "QMETH 201",
  "MGMT 200",
  "B ECON 300",
  "MKTG 301",
  "IS 300",
  "IBUS 300",
  "OPMGT 301",
  "FIN 350",
  "MGMT 300",
  "MGMT 320",
  "MGMT 430",
];

const seattleAccountingCourses = [
  "ACCTG 301",
  "ACCTG 311",
  "ACCTG 320",
  "ACCTG 321",
  "ACCTG 402",
  "ACCTG 403",
  "ACCTG 411",
];

const seattleAccountingForBusinessProfessionalsCourses = [
  "ACCTG 301",
  "FIN 450",
  "FIN 453",
  "FIN 454",
  "FIN 457",
  "ENTRE 457",
  "FIN 458",
];

const seattleEntrepreneurshipCourses = [
  "ENTRE 370",
  "FIN 457",
  "ENTRE 457",
  "MKTG 455",
  "ENTRE 455",
  "ENTRE 440",
  "ENTRE 443",
  "ENTRE 445",
  "ENTRE 472",
  "ENTRE 473",
];

const seattleFinanceCourses = [
  "FIN 450",
  "FIN 453",
  "FIN 454",
  "FIN 457",
  "ENTRE 457",
  "FIN 460",
  "FIN 461",
  "B ECON 301",
  "ECON 301",
];

const seattleHumanResourcesCourses = [
  "MGMT 311",
  "MGMT 411",
  "MGMT 412",
  "MGMT 400",
  "MGMT 401",
  "MGMT 402",
  "MGMT 403",
  "MGMT 404",
  "MGMT 407",
];

const seattleInformationSystemsCourses = [
  "IS 300",
  "IS 320",
  "IS 410",
  "IS 445",
  "IS 451",
  "IS 460",
];

const seattleMarketingCourses = [
  "MKTG 450",
  "MKTG 460",
  "MKTG 462",
  "MKTG 466",
];

const seattleOperationsSupplyChainCourses = [
  "OPMGT 301",
  "OPMGT 443",
  "QMETH 450",
  "OPMGT 450",
  "IS 451",
];

const bothellBusinessPrerequisiteOptions = [
  ["BIS 215"],
  ["BBUS 215"],
  ["BMATH 215"],
  ["STAT 220"],
  ["QMETH 201"],
  ["BBUS 220"],
  ["BIS 200"],
  ["ECON 200"],
  ["BWRIT 135"],
  ["ENGL 111"],
  ["ENGL 121"],
  ["ENGL 131"],
  ["ENGL 182"],
  ["ENGL 197"],
  ["ENGL 198"],
  ["ENGL 199"],
  ["ENGL 281"],
  ["ENGL 282"],
  ["ENGL 297"],
  ["ENGL 298"],
  ["ENGL 299"],
  ["ENGL 381"],
  ["ENGL 382"],
  ["BBUS 221"],
  ["BIS 201"],
  ["ECON 201"],
  ["BBUS 210"],
  ["ACCTG 215"],
  ["BBUS 211"],
  ["ACCTG 225"],
  ["BBUS 230"],
  ["MGMT 200"],
  ["STMATH 124"],
  ["MATH 124"],
  ["STMATH 114"],
  ["BMATH 144"],
  ["MATH 112"],
];

const bothellBusinessCoreCourses = [
  "BBUS 300",
  "BBUS 307",
  "BBUS 310",
  "BBUS 320",
  "BBUS 340",
  "BBUS 350",
  "BBUS 470",
  "BBUS 480",
];

const bothellAccountingOptionCourses = [
  "BBUS 361",
  "BBUS 362",
  "BBUS 363",
  "BBUS 373",
  "BBUS 411",
  "BBUS 435",
  "BBUS 450",
];

const bothellFinanceCourses = [
  "BBUS 451",
  "BBUS 452",
  "BBUS 453",
  "BBUS 454",
  "BBUS 455",
  "BBUS 456",
  "BBUS 457",
  "BBUS 459",
  "BBUS 465",
  "BBUS 468",
  "BBUS 490",
  "ELCBUS 463",
];

const bothellLeadershipStrategicInnovationCourses = [
  "BBUS 402",
  "BBUS 461",
  "BBUS 473",
  "BBUS 475",
  "BBUS 476",
  "BBUS 477",
];

const bothellMarketingCourses = [
  "BBUS 421",
  "BBUS 423",
  "BBUS 438",
  "BBUS 426",
  "BBUS 427",
  "BBUS 429",
  "BBUS 431",
  "BBUS 445",
  "BBUS 446",
  "BBUS 464",
];

const bothellMisCourses = [
  "BBUS 330",
  "CSS 173",
  "CSS 143",
  "CSSSKL 143",
  "CSS 360",
  "BBUS 489",
  "BBUS 431",
  "BBUS 443",
  "BBUS 444",
  "BBUS 479",
  "BBUS 491",
  "CSS 371",
  "CSS 475",
  "CSS 478",
  "CSS 480",
];

const bothellBusinessAnalyticsAiCourses = [
  "BBUS 309",
  "BBUS 479",
  "BBUS 301",
  "BBUS 330",
  "BBUS 423",
  "BBUS 429",
  "BBUS 452",
  "BBUS 489",
  "BBUS 468",
  "BBUS 472",
];

const bothellTimCourses = [
  "BBUS 475",
  "BBUS 476",
  "BBUS 330",
  "BBUS 429",
  "BBUS 431",
  "BBUS 441",
  "BBUS 443",
  "BBUS 444",
  "BBUS 460",
  "BBUS 471",
  "BBUS 479",
  "BBUS 490",
  "BBUS 491",
];

const bothellSupplyChainCourses = [
  "BBUS 482",
  "BBUS 483",
  "BBUS 441",
  "BBUS 487",
  "BBUS 497",
  "BBUS 499",
  "BBUS 486",
  "BBUS 373",
  "BBUS 402",
  "BBUS 447",
  "BBUS 460",
  "BBUS 462",
  "BBUS 463",
  "BBUS 464",
  "BBUS 473",
  "BBUS 475",
  "BBUS 491",
  "BBUS 492",
];

const tacomaBusinessPrerequisiteCourses = [
  "TACCT 210",
  "TACCT 220",
  "TACCT 230",
  "TMATH 110",
  "TECON 200",
  "TBECON 220",
  "TECON 201",
  "TBECON 221",
  "TBGEN 218",
];

const tacomaBusinessCoreCourses = [
  "TBUS 300",
  "TBUS 301",
  "TBUS 310",
  "TBUS 320",
  "TBUS 330",
  "TACCT 330",
  "TBUS 350",
  "TBUS 400",
];

const tacomaAccountingCourses = [
  "TACCT 301",
  "TACCT 302",
  "TACCT 303",
  "TACCT 311",
  "TACCT 330",
  "TACCT 411",
  "TACCT 451",
];

const tacomaFinanceCourses = [
  "TBANLT 433",
];

const tacomaManagementCourses = [
  "TBANLT 485",
];

const tacomaMarketingCourses = [
  "TMKTG 450",
  "TMKTG 460",
  "TMKTG 475",
  "TBANLT 480",
];

const businessPrograms = [
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-business-administration",
    title: "Business Administration",
    officialSources: [
      "https://www.washington.edu/students/gencat/program/S/Business-300.html",
      "https://foster.uw.edu/academics/degree-programs/undergraduate-programs/curriculum/",
      "https://foster.uw.edu/academics/degree-programs/undergraduate-programs/curriculum/options/",
      "https://foster.uw.edu/faculty-research/academic-departments/information-systems-and-operations-management/curriculum/undergraduate/",
      "https://foster.uw.edu/centers/buerk-ctr-entrepreneurship/undergraduate-entrepreneurship/",
    ],
    expectedPathwayIds: [
      "general-business-major",
      "accounting-major",
      "accounting-for-business-professionals-major",
      "entrepreneurship-major",
      "finance-major",
      "human-resources-management-major",
      "information-systems-major",
      "marketing-major",
      "operations-and-supply-chain-management-major",
    ],
    pathwayGroups: [
      { id: "general-business-major", label: "Bachelor of Arts in Business Administration degree" },
      { id: "accounting-major", label: "major in Accounting", suggestedCourses: seattleAccountingCourses },
      {
        id: "accounting-for-business-professionals-major",
        label: "major in Accounting for Business Professionals",
        suggestedCourses: seattleAccountingForBusinessProfessionalsCourses,
      },
      {
        id: "entrepreneurship-major",
        label: "major in Entrepreneurship",
        suggestedCourses: seattleEntrepreneurshipCourses,
      },
      { id: "finance-major", label: "major in Finance", suggestedCourses: seattleFinanceCourses },
      {
        id: "human-resources-management-major",
        label: "major in Human Resources Management",
        suggestedCourses: seattleHumanResourcesCourses,
      },
      {
        id: "information-systems-major",
        label: "major in Information Systems",
        suggestedCourses: seattleInformationSystemsCourses,
      },
      { id: "marketing-major", label: "major in Marketing", suggestedCourses: seattleMarketingCourses },
      {
        id: "operations-and-supply-chain-management-major",
        label: "major in Operations and Supply Chain Management",
        suggestedCourses: seattleOperationsSupplyChainCourses,
      },
    ],
    requiredCourseCodes: unique([
      ...seattleBusinessGeneralEducationCourses,
      ...seattleBusinessCoreCourses,
      ...seattleAccountingCourses,
      ...seattleAccountingForBusinessProfessionalsCourses,
      ...seattleEntrepreneurshipCourses,
      ...seattleFinanceCourses,
      ...seattleHumanResourcesCourses,
      ...seattleInformationSystemsCourses,
      ...seattleMarketingCourses,
      ...seattleOperationsSupplyChainCourses,
    ]),
    optionGroups: [
      {
        id: "seattle-business-composition",
        label: "English Composition and Additional Writing",
        options: [
          ["ENGL 109"],
          ["ENGL 110"],
          ["ENGL 111"],
          ["ENGL 121"],
          ["ENGL 131"],
          ["ENGL 182"],
          ["ENGL 197"],
          ["ENGL 198"],
          ["ENGL 199"],
          ["ENGL 281"],
          ["ENGL 297"],
          ["ENGL 298"],
          ["ENGL 299"],
          ["B CMU 301"],
          ["ENGL 381"],
          ["C LIT 240"],
        ],
      },
      {
        id: "seattle-business-calculus",
        label: "MATH 112, MATH 124, or MATH 134",
        options: [["MATH 112"], ["MATH 124"], ["MATH 134"]],
      },
      {
        id: "seattle-business-is-major",
        label: "Required Information Systems major courses",
        options: seattleInformationSystemsCourses.map((courseCode) => [courseCode]),
      },
      {
        id: "seattle-business-oscm-major",
        label: "Required Operations and Supply Chain Management major courses",
        options: seattleOperationsSupplyChainCourses.map((courseCode) => [courseCode]),
      },
    ],
    courseBuckets: [
      {
        id: "seattle-business-core",
        label: "Core courses",
        minCredits: 55,
        maxCredits: 57,
        courseCodes: seattleBusinessCoreCourses,
      },
      {
        id: "seattle-business-major-courses",
        label: "Major requirements",
        minCredits: 16,
        maxCredits: 20,
        courseCodes: unique([
          ...seattleAccountingCourses,
          ...seattleAccountingForBusinessProfessionalsCourses,
          ...seattleEntrepreneurshipCourses,
          ...seattleFinanceCourses,
          ...seattleHumanResourcesCourses,
          ...seattleInformationSystemsCourses,
          ...seattleMarketingCourses,
          ...seattleOperationsSupplyChainCourses,
        ]),
        openEndedRules: [
          "Students can take a variety of upper division electives or choose to specialize in an area of business by declaring a major",
          "No more than 6 lower-division business elective credits in addition to lower division core requirements",
          "No more than 15 credits of economics coursework may be applied to the degree",
          "The following courses cannot be applied to major requirements: MGMT 305; MKTG 305; I S 305",
          "Students must complete six of the nine upper-division core courses, including MGMT 430",
          "Minimum 2.00 cumulative GPA for all courses applied to major requirements",
        ],
      },
    ],
    genEdRequirements: [
      "180 credits",
      "English Composition (5 credits)",
      "Additional Writing (8-10 credits)",
      "Reasoning (RSN) (5 credits): met by program requirements",
      "Diversity (DIV) (5 credits)",
      "Arts and Humanities (A&H) (20 credits)",
      "Social Sciences (SSc) (20 credits)",
      "Natural Sciences (NSc) (19-20 credits)",
    ],
    requirementLabels: [
      "Michael G. Foster School of Business",
      "Bachelor of Arts in Business Administration",
      "Eight majors are available",
      "Accounting",
      "Accounting for Business Professionals",
      "Entrepreneurship",
      "Finance",
      "Human Resources Management",
      "Information Systems",
      "Marketing",
      "Operations and Supply Chain Management",
    ],
  },
  {
    campusId: "uw-bothell",
    planId: "uw-bothell-business-administration",
    title: "Business Administration",
    officialSources: [
      "https://www.washington.edu/students/gencat/program/B/BusinessAdministration-881.html",
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration",
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum",
    ],
    expectedPathwayIds: [
      "accounting-option",
      "business-analytics-and-ai-concentration",
      "leadership-and-strategic-innovation-option",
      "marketing-option-and-concentration",
      "supply-chain-management-option",
      "entrepreneurship-concentration",
      "finance-option-and-concentration",
      "management-concentration",
      "mis-concentration",
      "retail-management-concentration",
      "tim-concentration",
      "self-directed-concentration",
    ],
    pathwayGroups: [
      { id: "accounting-option", label: "Accounting Option", suggestedCourses: bothellAccountingOptionCourses },
      {
        id: "business-analytics-and-ai-concentration",
        label: "Business Analytics & AI Concentration",
        suggestedCourses: bothellBusinessAnalyticsAiCourses,
      },
      {
        id: "leadership-and-strategic-innovation-option",
        label: "Leadership & Strategic Innovation Option",
        suggestedCourses: bothellLeadershipStrategicInnovationCourses,
      },
      {
        id: "marketing-option-and-concentration",
        label: "Marketing Option and Concentration",
        suggestedCourses: bothellMarketingCourses,
      },
      {
        id: "supply-chain-management-option",
        label: "Supply Chain Management Option",
        suggestedCourses: bothellSupplyChainCourses,
      },
      { id: "entrepreneurship-concentration", label: "Entrepreneurship Concentration" },
      { id: "finance-option-and-concentration", label: "Finance Option and Concentration", suggestedCourses: bothellFinanceCourses },
      { id: "management-concentration", label: "Management Concentration" },
      { id: "mis-concentration", label: "Management Information Systems (MIS) Concentration", suggestedCourses: bothellMisCourses },
      { id: "retail-management-concentration", label: "Retail Management Concentration" },
      { id: "tim-concentration", label: "Technology & Innovation Management (TIM) Concentration", suggestedCourses: bothellTimCourses },
      { id: "self-directed-concentration", label: "Self-Directed Concentration" },
    ],
    requiredCourseCodes: unique([
      ...bothellBusinessPrerequisiteOptions.flat(),
      ...bothellBusinessCoreCourses,
      ...bothellAccountingOptionCourses,
      ...bothellBusinessAnalyticsAiCourses,
      ...bothellFinanceCourses,
      ...bothellLeadershipStrategicInnovationCourses,
      ...bothellMarketingCourses,
      ...bothellMisCourses,
      ...bothellSupplyChainCourses,
      ...bothellTimCourses,
    ]),
    optionGroups: [
      {
        id: "bothell-business-prerequisites",
        label: "",
        options: bothellBusinessPrerequisiteOptions,
      },
      {
        id: "bothell-supply-chain-internship-or-research",
        label: "",
        options: [["BBUS 492"], ["BBUS 497"], ["BBUS 499"], ["BBUS 491"]],
      },
      {
        id: "bothell-supply-chain-distribution-or-resource-planning",
        label: "",
        options: [["BBUS 486"]],
      },
    ],
    courseBuckets: [
      {
        id: "bothell-business-core",
        label: "",
        courseCodes: unique([...bothellBusinessPrerequisiteOptions.flat(), ...bothellBusinessCoreCourses]),
      },
      {
        id: "bothell-business-capstone",
        label: "",
        courseCodes: ["BBUS 470", "BBUS 480"],
      },
      {
        id: "bothell-business-options",
        label: "",
        courseCodes: unique([
          ...bothellAccountingOptionCourses,
          ...bothellBusinessAnalyticsAiCourses,
          ...bothellFinanceCourses,
          ...bothellLeadershipStrategicInnovationCourses,
          ...bothellMarketingCourses,
          ...bothellMisCourses,
          ...bothellSupplyChainCourses,
          ...bothellTimCourses,
        ]),
      },
    ],
    genEdRequirements: [],
    requirementLabels: [
      "Bachelor of Arts in Business Administration degree",
      "Accounting Option",
      "Business Analytics & AI Concentration",
      "Leadership & Strategic Innovation Option",
      "Marketing Option and Concentration",
      "Supply Chain Management Option",
      "Entrepreneurship Concentration",
      "Finance Option and Concentration",
      "Management Concentration",
      "Management Information Systems (MIS) Concentration",
      "Retail Management Concentration",
      "Technology & Innovation Management (TIM) Concentration",
      "Self-Directed Concentration",
    ],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-bachelor-of-arts-in-business-administration",
    title: "Business Administration",
    officialSources: [
      "https://www.tacoma.uw.edu/business/baba-admissions",
      "https://www.tacoma.uw.edu/business/design-courses-baba",
    ],
    expectedPathwayIds: [
      "accounting-option",
      "finance-option",
      "general-business-option",
      "management-option",
      "marketing-option",
    ],
    pathwayGroups: [
      { id: "accounting-option", label: "Accounting", suggestedCourses: tacomaAccountingCourses },
      { id: "finance-option", label: "Finance", suggestedCourses: tacomaFinanceCourses },
      { id: "general-business-option", label: "General Business" },
      { id: "management-option", label: "Management", suggestedCourses: tacomaManagementCourses },
      { id: "marketing-option", label: "Marketing", suggestedCourses: tacomaMarketingCourses },
    ],
    requiredCourseCodes: unique([
      ...tacomaBusinessPrerequisiteCourses,
      ...tacomaBusinessCoreCourses,
      ...tacomaAccountingCourses,
      ...tacomaFinanceCourses,
      ...tacomaManagementCourses,
      ...tacomaMarketingCourses,
    ]),
    optionGroups: [
      {
        id: "tacoma-business-statistics",
        label: "Intro to Statistics (TMATH 110)",
        options: [["TMATH 110"], ["TURB 225"], ["TSOCWF 351"]],
      },
      {
        id: "tacoma-business-microeconomics",
        label: "Microeconomics (TBECON 220 or TECON 200)",
        options: [["TBECON 220"], ["TECON 200"]],
      },
      {
        id: "tacoma-business-macroeconomics",
        label: "Macroeconomics (TBECON 221 or TECON 201)",
        options: [["TBECON 221"], ["TECON 201"]],
      },
    ],
    courseBuckets: [
      {
        id: "tacoma-business-core",
        label: "30 credits of core courses:",
        minCredits: 30,
        courseCodes: tacomaBusinessCoreCourses,
      },
      {
        id: "tacoma-business-capstone",
        label: "5 credits TBUS 400 Business Policy and Strategic Management",
        minCredits: 5,
        courseCodes: ["TBUS 400"],
      },
      {
        id: "tacoma-business-option-courses",
        label: "Once accepted into the Business School",
        minCredits: 30,
        maxCredits: 35,
        courseCodes: unique([
          ...tacomaAccountingCourses,
          ...tacomaFinanceCourses,
          ...tacomaManagementCourses,
          ...tacomaMarketingCourses,
        ]),
        openEndedRules: [
          "35 credits from Accounting:",
          "30 credits from 300- and 400-level TFIN or TBECON courses. TBANLT 433 counts for the this option.",
          "30 credits of upper-division Business courses. Check with program advisors for list of approved courses.",
          "30 credits of TMGMT courses. TBANLT 485 counts for this option.",
          "15 credits from Marketing that include:",
          "and an additional 15 credits chosen from TMKTG classes. TBANLT 480 counts for this option.",
          "Elective credits to bring total to 180",
        ],
      },
    ],
    genEdRequirements: [
      "Completion of at least 60 college level credits on the quarter system with a minimum 2.75 cumulative GPA",
      "A minimum 2.75 cumulative GPA* in the business prerequisite courses",
      "All business prerequisites must be completed prior to the start of the quarter of admission",
      "Business prerequisites may not be taken P/F or S/NS",
    ],
    requirementLabels: [
      "Bachelor of Arts Business Administration",
      "Milgard School of Business",
      "Accounting",
      "Finance",
      "General Business",
      "Management",
      "Marketing",
      "Business students may only have one transcripted option",
    ],
  },
];

module.exports = {
  businessPrograms,
};
