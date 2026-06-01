function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

const seattleBsnEnglishCompositionOptions = [
  "ENGL 111",
  "ENGL 121",
  "ENGL 131",
];

const seattleBsnWritingOptions = [
  "ENGL 281",
  "HSTAA 231",
  "PHIL 100",
  "PHIL 240",
];

const seattleBsnMathLogicOptions = [
  "MATH 111",
  "MATH 120",
  "MATH 124",
  "PHIL 115",
  "PHIL 120",
];

const seattleBsnStatisticsOptions = [
  "STAT 220",
  "EDPSY 490",
  "QMETH 201",
];

const seattleBsnGeneralChemistryOptions = [
  ["CHEM 120"],
  ["CHEM 142", "CHEM 152", "CHEM 162"],
];

const seattleBsnOrganicChemistryOptions = [
  ["CHEM 220", "CHEM 221"],
  ["CHEM 237", "CHEM 238", "CHEM 239"],
];

const seattleBsnHumanAnatomyCourses = ["NURS 301"];
const seattleBsnHumanPhysiologyCourses = ["BIOL 118", "BIOL 119"];
const seattleBsnMicrobiologyCourses = ["MICROM 301", "MICROM 302"];
const seattleBsnNutritionCourses = ["NUTR 200"];
const seattleBsnLifespanDevelopmentCourses = ["NURS 201"];
const seattleBsnSocialScienceSampleCourses = ["NMETH 210"];

const seattleBsnPrerequisiteCourses = unique([
  ...seattleBsnEnglishCompositionOptions,
  ...seattleBsnWritingOptions,
  ...seattleBsnMathLogicOptions,
  ...seattleBsnStatisticsOptions,
  ...seattleBsnGeneralChemistryOptions.flat(),
  ...seattleBsnOrganicChemistryOptions.flat(),
  ...seattleBsnHumanAnatomyCourses,
  ...seattleBsnHumanPhysiologyCourses,
  ...seattleBsnMicrobiologyCourses,
  ...seattleBsnNutritionCourses,
  ...seattleBsnLifespanDevelopmentCourses,
  ...seattleBsnSocialScienceSampleCourses,
]);

const seattleBsnYearOneAutumnCourses = [
  "NCLIN 302",
  "NCLIN 306",
  "NURS 303",
  "NURS 304",
  "NURS 420",
];

const seattleBsnYearOneWinterCourses = [
  "NCLIN 306",
  "NCLIN 409",
  "NURS 401",
  "NURS 425",
];

const seattleBsnYearOneSpringCourses = [
  "NCLIN 306",
  "NCLIN 407",
  "NMETH 403",
  "NURS 405",
  "NURS 412",
];

const seattleBsnYearTwoAutumnCourses = [
  "NCLIN 418",
  "NCLIN 475",
  "NURS 417",
  "NURS 422",
  "NURS 452",
];

const seattleBsnYearTwoWinterCourses = [
  "NCLIN 403",
  "NCLIN 416",
  "NCLIN 475",
  "NMETH 450",
  "NURS 415",
  "NURS 431",
];

const seattleBsnYearTwoSpringCourses = [
  "NCLIN 411",
  "NCLIN 475",
  "NURS 419",
  "NURS 457",
];

const seattleBsnCurriculumCourses = unique([
  ...seattleBsnYearOneAutumnCourses,
  ...seattleBsnYearOneWinterCourses,
  ...seattleBsnYearOneSpringCourses,
  ...seattleBsnYearTwoAutumnCourses,
  ...seattleBsnYearTwoWinterCourses,
  ...seattleBsnYearTwoSpringCourses,
]);

const bothellRnBsnCoreCourses = [
  "BNURS 360",
  "BNURS 420",
  "BNURS 460",
  "BNURS 421",
  "BNURS 422",
  "BNURS 423",
  "BNURS 424",
];

const tacomaRnBsnSummerCourses = [
  "TNURS 360",
  "TNURS 407",
  "THLTH 415",
  "TNURS 440",
  "TNURS 460",
  "TNURS 410",
  "TNURS 414",
  "TNURS 420",
  "THLTH 340",
];

const tacomaRnBsnAutumnCourses = [
  "TNURS 360",
  "TNURS 407",
  "TNURS 410",
  "TNURS 420",
  "TNURS 460",
  "THLTH 415",
  "TNURS 414",
  "TNURS 440",
  "THLTH 340",
];

const nursingPrograms = [
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-nursing",
    title: "Nursing",
    officialSources: [
      "https://students.nursing.uw.edu/wp-content/uploads/2025/09/BSN-2025-Curriuculum-Grid.pdf",
      "https://nursing.uw.edu/wp-content/uploads/2025/05/BSN-Prerequisites-Worksheet.pdf",
    ],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: unique([
      ...seattleBsnPrerequisiteCourses,
      ...seattleBsnCurriculumCourses,
    ]),
    optionGroups: [
      { id: "seattle-bsn-english-composition", label: "ENGL 111, ENGL 121, or ENGL 131", options: seattleBsnEnglishCompositionOptions.map((courseCode) => [courseCode]) },
      { id: "seattle-bsn-writing", label: "Writing W or additional English composition course", options: seattleBsnWritingOptions.map((courseCode) => [courseCode]) },
      { id: "seattle-bsn-math-logic", label: "College-level math or philosophy logic", options: seattleBsnMathLogicOptions.map((courseCode) => [courseCode]) },
      { id: "seattle-bsn-statistics", label: "Statistics", options: seattleBsnStatisticsOptions.map((courseCode) => [courseCode]) },
      { id: "seattle-bsn-general-chemistry", label: "General Chemistry", options: seattleBsnGeneralChemistryOptions },
      { id: "seattle-bsn-organic-chemistry", label: "Organic Chemistry", options: seattleBsnOrganicChemistryOptions },
      { id: "seattle-bsn-human-anatomy", label: "Human Anatomy/Human Anatomy and Physiology Part I", options: seattleBsnHumanAnatomyCourses.map((courseCode) => [courseCode]) },
      { id: "seattle-bsn-human-physiology", label: "Human Physiology/Human Anatomy and Physiology Part II", options: [seattleBsnHumanPhysiologyCourses] },
      { id: "seattle-bsn-microbiology", label: "General Microbiology", options: [seattleBsnMicrobiologyCourses] },
      { id: "seattle-bsn-nutrition", label: "Nutrition", options: seattleBsnNutritionCourses.map((courseCode) => [courseCode]) },
      { id: "seattle-bsn-lifespan", label: "Lifespan Growth and Development", options: seattleBsnLifespanDevelopmentCourses.map((courseCode) => [courseCode]) },
      { id: "seattle-bsn-social-science", label: "SSc Course 2 and Course 3", options: seattleBsnSocialScienceSampleCourses.map((courseCode) => [courseCode]) },
    ],
    courseBuckets: [
      { id: "seattle-bsn-prerequisites", label: "BSN prerequisite courses", minCredits: 74, maxCredits: 81, courseCodes: seattleBsnPrerequisiteCourses, openEndedRules: ["Also required: electives to complete a minimum total of 90 quarter credit hours"] },
      { id: "seattle-bsn-year-one-autumn", label: "Year 1 Autumn", minCredits: 16, courseCodes: seattleBsnYearOneAutumnCourses },
      { id: "seattle-bsn-year-one-winter", label: "Year 1 Winter", minCredits: 16, courseCodes: seattleBsnYearOneWinterCourses },
      { id: "seattle-bsn-year-one-spring", label: "Year 1 Spring", minCredits: 18, courseCodes: seattleBsnYearOneSpringCourses },
      { id: "seattle-bsn-year-two-autumn", label: "Year 2 Autumn", minCredits: 13, courseCodes: seattleBsnYearTwoAutumnCourses },
      { id: "seattle-bsn-year-two-winter", label: "Year 2 Winter", minCredits: 14, courseCodes: seattleBsnYearTwoWinterCourses },
      { id: "seattle-bsn-year-two-spring", label: "Year 2 Spring", minCredits: 14, courseCodes: seattleBsnYearTwoSpringCourses },
    ],
    genEdRequirements: [
      "Minimum 60 semester/90 quarter credits before your start date",
      "A minimum grade of 2.0 is required in each prerequisite course",
      "Communications - Written Communications: 2 courses/8-10 quarter hour credits",
      "Reasoning (RSN) - 2 courses/7-10 quarter hour credits",
      "Natural Sciences (NSc) - Minimum of 6 courses/28 quarter credits",
      "For UW students: 9 courses/33 quarter hour credits",
      "Social Sciences (SSc) - 15 quarter hour credits",
      "Arts and Humanities (A&H) - 15 quarter hour credits",
      "Total required prerequisite credits: 74-81",
      "Effective for students beginning their program of study Autumn 2025",
      "Bachelor of Science in Nursing Program 2-Year Curriculum",
    ],
    requirementLabels: [
      "BACHELOR OF SCIENCE IN NURSING (BSN) PREREQUISITE COURSES",
      "BACHELOR OF SCIENCE IN NURSING PROGRAM",
      "2-YEAR CURRICULUM",
      "YEAR 1 AUTUMN WINTER SPRING",
      "YEAR 2 AUTUMN WINTER SPRING",
      "Foundations of Interprofessional Practice",
    ],
  },
  {
    campusId: "uw-bothell",
    planId: "uw-bothell-nursing-first-year-rn-to-bsn",
    title: "Nursing (BS), First Year RN to BSN",
    officialSources: [
      "https://www.uwb.edu/catalog/degree-programs",
      "https://www.uwb.edu/catalog/admissions/first-year-student-admission",
      "https://www.uwb.edu/nhs/undergraduate/rn-bsn/requirements",
      "https://www.uwb.edu/nhs/undergraduate/rn-bsn/overview",
    ],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: unique(bothellRnBsnCoreCourses),
    optionGroups: [
      { id: "bothell-fy-bhlth-coursework", label: "", options: [] },
      { id: "bothell-fy-bhlth-or-other", label: "", options: [] },
    ],
    courseBuckets: [
      { id: "bothell-fy-nursing-core", label: "", courseCodes: bothellRnBsnCoreCourses },
      { id: "bothell-fy-health-coursework", label: "", courseCodes: [] },
    ],
    genEdRequirements: [],
    requirementLabels: [],
  },
  {
    campusId: "uw-bothell",
    planId: "uw-bothell-nursing-rn-to-bsn",
    title: "Nursing (BS), RN to BSN",
    officialSources: [
      "https://www.uwb.edu/nhs/undergraduate/rn-bsn",
      "https://www.uwb.edu/nhs/undergraduate/rn-bsn/overview",
      "https://www.uwb.edu/nhs/undergraduate/rn-bsn/admissions",
      "https://www.uwb.edu/nhs/undergraduate/rn-bsn/requirements",
      "https://www.uwb.edu/nhs/wp-content/uploads/sites/9/2025/06/2025-Fall-Bothell-In-Person-Schedule-Course-Info.pdf",
    ],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: unique(bothellRnBsnCoreCourses),
    optionGroups: [
      { id: "bothell-rn-bsn-location", label: "", options: [] },
      { id: "bothell-rn-bsn-track", label: "", options: [] },
      { id: "bothell-rn-bsn-bhlth-coursework", label: "", options: [] },
      { id: "bothell-rn-bsn-bhlth-or-other", label: "", options: [] },
    ],
    courseBuckets: [
      { id: "bothell-rn-bsn-nursing-core", label: "", courseCodes: bothellRnBsnCoreCourses },
      { id: "bothell-rn-bsn-health-coursework", label: "", courseCodes: [] },
      { id: "bothell-rn-bsn-fieldwork", label: "", courseCodes: ["BNURS 424", "BNURS 460"] },
    ],
    genEdRequirements: [],
    requirementLabels: [],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-nursing",
    title: "Nursing (RN-BSN)",
    officialSources: [
      "https://www.tacoma.uw.edu/nursing/bachelor-science-nursing-rn-bsn",
      "https://www.tacoma.uw.edu/nursing/rn-bsn-application-overview",
      "https://www.tacoma.uw.edu/nursing/rn-bsn-sample-program-plans",
      "https://www.tacoma.uw.edu/sites/default/files/2023-03/BSN%20PreReq%20Table%2003.17.23.pdf",
    ],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: unique([...tacomaRnBsnSummerCourses, ...tacomaRnBsnAutumnCourses]),
    optionGroups: [
      { id: "tacoma-rn-bsn-upper-division-electives", label: "upper-division Elective Credit", options: [["THLTH 415"], ["THLTH 340"]] },
    ],
    courseBuckets: [
      { id: "tacoma-rn-bsn-upper-division-credit", label: "upper-division Elective Credit (45 credits)", minCredits: 45, maxCredits: 45, courseCodes: [], openEndedRules: ["Please note that the RN-BSN program requires students to complete 45 credits in residence at UW Tacoma, including 10 credits of upper-division electives", "Elective offerings through SNHCL are available"] },
      { id: "tacoma-rn-bsn-degree-map", label: "Nursing (RN-BSN) parsed official source requirements", courseCodes: unique([...tacomaRnBsnSummerCourses, ...tacomaRnBsnAutumnCourses]) },
    ],
    genEdRequirements: [
      "45 credits in residence at UW Tacoma",
      "10 credits of upper-division electives",
      "Individual program plans are issued by the academic advisor after orientation",
    ],
    requirementLabels: [
      "UW Tacoma Nursing RN-BSN degree requirements and sample program plan",
      "upper-division Elective Credit (45 credits)",
      "Nursing (RN-BSN) parsed official source requirements",
    ],
  },
];

module.exports = {
  nursingPrograms,
};
