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

const bothellRnBsnOptionalCourses = [
  "BNURS 297",
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
    expectedPathwayIds: ["direct-entry-route"],
    pathwayGroups: [
      { id: "direct-entry-route", label: "First Year RN to BSN (Direct Entry)", suggestedCourses: unique([...bothellRnBsnCoreCourses, ...bothellRnBsnOptionalCourses]) },
    ],
    requiredCourseCodes: unique([...bothellRnBsnCoreCourses, ...bothellRnBsnOptionalCourses]),
    optionGroups: [
      { id: "bothell-fy-bhlth-coursework", label: "BHLTH 4XX Health Coursework", options: [] },
      { id: "bothell-fy-bhlth-or-other", label: "BHLTH 4XX Health Coursework or Other", options: [] },
    ],
    courseBuckets: [
      { id: "bothell-fy-nursing-core", label: "Nursing Core", minCredits: 35, courseCodes: bothellRnBsnCoreCourses },
      { id: "bothell-fy-health-coursework", label: "BHLTH 4XX", minCredits: 10, courseCodes: [], openEndedRules: ["BHLTH 4XX Health Coursework", "BHLTH 4XX Health Coursework or Other"] },
      { id: "bothell-fy-optional-topic", label: "BNURS Coursework", courseCodes: bothellRnBsnOptionalCourses, openEndedRules: ["BNURS 297 can be taken for up to 2 credits every quarter", "The topic for BNURS 297 changes every quarter"] },
    ],
    genEdRequirements: [
      "Nursing (BS), First Year RN to BSN (Direct Entry)",
      "First-year admission",
      "College Academic Distribution Requirements",
      "Students must earn a 2.0 or higher in all Nursing (BNURS) coursework",
      "Transfer credits 90",
      "NCLEX credits 45",
      "UWB Nursing coursework 45",
      "Total Credits: 180",
      "General Education or any deficiencies must be completed before a student may earn a bachelor's degree",
      "Licensure as a registered nurse in the state of Washington is required",
    ],
    requirementLabels: [
      "Bachelor of Science in Nursing",
      "Requirements",
      "Credit structure",
      "Nursing Core",
      "BHLTH 4XX",
      "Fieldwork Participation Requirements",
    ],
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
    expectedPathwayIds: [
      "four-quarter-track",
      "eight-quarter-track",
      "bothell-location",
      "shoreline-location",
      "everett-location",
    ],
    pathwayGroups: [
      { id: "four-quarter-track", label: "Four Quarter Plan", suggestedCourses: unique([...bothellRnBsnCoreCourses, ...bothellRnBsnOptionalCourses]) },
      { id: "eight-quarter-track", label: "Eight Quarter Plan", suggestedCourses: unique([...bothellRnBsnCoreCourses, ...bothellRnBsnOptionalCourses]) },
      { id: "bothell-location", label: "Bothell", suggestedCourses: bothellRnBsnCoreCourses },
      { id: "shoreline-location", label: "Shoreline", suggestedCourses: bothellRnBsnCoreCourses },
      { id: "everett-location", label: "Everett", suggestedCourses: bothellRnBsnCoreCourses },
    ],
    requiredCourseCodes: unique([...bothellRnBsnCoreCourses, ...bothellRnBsnOptionalCourses]),
    optionGroups: [
      { id: "bothell-rn-bsn-location", label: "Program is offered at Bothell, Shoreline, and Everett", options: [] },
      { id: "bothell-rn-bsn-track", label: "Four (4) or eight (8) quarters", options: [] },
      { id: "bothell-rn-bsn-bhlth-coursework", label: "BHLTH 4XX Health Coursework", options: [] },
      { id: "bothell-rn-bsn-bhlth-or-other", label: "BHLTH 4XX Health Coursework or Other", options: [] },
    ],
    courseBuckets: [
      { id: "bothell-rn-bsn-nursing-core", label: "Nursing Core", minCredits: 35, courseCodes: bothellRnBsnCoreCourses },
      { id: "bothell-rn-bsn-health-coursework", label: "BHLTH 4XX", minCredits: 10, courseCodes: [], openEndedRules: ["BHLTH 4XX Health Coursework", "BHLTH 4XX Health Coursework or Other"] },
      { id: "bothell-rn-bsn-fieldwork", label: "Fieldwork", courseCodes: ["BNURS 424", "BNURS 460"], openEndedRules: ["100 practice hours", "65 practice hours", "35 hours"] },
      { id: "bothell-rn-bsn-optional-topic", label: "BNURS Coursework", courseCodes: bothellRnBsnOptionalCourses, openEndedRules: ["BNURS 297 can be taken for up to 2 credits every quarter", "The topic for BNURS 297 changes every quarter"] },
    ],
    genEdRequirements: [
      "Prerequisite coursework",
      "English Composition, 5 credits",
      "General Chemistry with a lab, 5 credits",
      "Microbiology, 5 credits",
      "Anatomy & Physiology I & II, 10-12 credits",
      "Statistics, 4-5 credits",
      "Arts & Humanities, 10 credits",
      "A minimum of 90 transferable quarter credits",
      "Students must earn a 2.0 or higher in all Nursing (BNURS) coursework",
      "Transfer credits 90",
      "NCLEX credits 45",
      "UWB Nursing coursework 45",
      "Total Credits: 180",
      "General Education or any deficiencies must be completed before a student may earn a bachelor's degree",
      "RN License",
    ],
    requirementLabels: [
      "RN to BSN",
      "Curriculum",
      "Locations",
      "Schedule",
      "Student Requirements",
      "Credit structure",
      "Degree Requirements Checklist",
      "Nursing Core",
      "BHLTH 4XX",
    ],
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
    expectedPathwayIds: ["summer-cohort", "autumn-cohort"],
    pathwayGroups: [
      { id: "summer-cohort", label: "Sample Program Plans for Summer Cohort", suggestedCourses: tacomaRnBsnSummerCourses },
      { id: "autumn-cohort", label: "Sample Program Plans for Autumn Cohort", suggestedCourses: tacomaRnBsnAutumnCourses },
    ],
    requiredCourseCodes: unique([...tacomaRnBsnSummerCourses, ...tacomaRnBsnAutumnCourses]),
    optionGroups: [
      { id: "tacoma-rn-bsn-cohort", label: "Summer Cohort or Autumn Cohort", options: [tacomaRnBsnSummerCourses, tacomaRnBsnAutumnCourses] },
      { id: "tacoma-rn-bsn-upper-division-electives", label: "10 credits of upper-division electives", options: [["THLTH 415"], ["THLTH 340"]] },
    ],
    courseBuckets: [
      { id: "tacoma-rn-bsn-summer", label: "Sample Program Plans for Summer Cohort", minCredits: 45, courseCodes: tacomaRnBsnSummerCourses },
      { id: "tacoma-rn-bsn-autumn", label: "Sample Program Plans for Autumn Cohort", minCredits: 45, courseCodes: tacomaRnBsnAutumnCourses },
      { id: "tacoma-rn-bsn-electives", label: "upper-division electives", minCredits: 10, courseCodes: ["THLTH 415", "THLTH 340"], openEndedRules: ["Elective offerings through SNHCL are available"] },
      { id: "tacoma-rn-bsn-prerequisites", label: "Prerequisite courses for graduation from the BSN program", courseCodes: [], openEndedRules: ["Writing 15 credits", "Arts and Humanities 15 credits", "Social Sciences 15 credits", "General or Inorganic Chemistry 5 credits", "Anatomy and Physiology 10 credits", "Microbiology 3-5 credits", "Statistics 5 credits"] },
    ],
    genEdRequirements: [
      "Minimum 90 college-level credits with a cumulative GPA of at least 2.0",
      "Associate degree or a diploma in nursing from an accredited nursing program",
      "Current licensure as a registered nurse in the state of Washington",
      "One year of clinical practice",
      "Prerequisites completed with a 2.0 grade or higher",
      "45 credits in residence at UW Tacoma",
      "10 credits of upper-division electives",
      "Writing 15 credits",
      "Arts and Humanities 15 credits",
      "Social Sciences 15 credits",
      "General or Inorganic Chemistry 5 credits",
      "Anatomy and Physiology 10 credits",
      "Microbiology 3-5 credits",
      "Statistics 5 credits",
    ],
    requirementLabels: [
      "Bachelor of Science in Nursing (RN-BSN)",
      "RN-BSN Program Overview",
      "Admission Requirement Checklist",
      "Sample Program Plans",
      "Summer Cohort",
      "Autumn Cohort",
      "Prerequisite courses for graduation from the BSN program",
    ],
  },
];

module.exports = {
  nursingPrograms,
};
