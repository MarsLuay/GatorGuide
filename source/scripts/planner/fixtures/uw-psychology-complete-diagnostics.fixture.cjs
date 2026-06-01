function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

const seattlePsychAdmissionCourses = [
  "PSYCH 101",
  "PSYCH 202",
  "PSYCH 209",
  "MATH 111",
  "MATH 112",
  "MATH 120",
  "MATH 124",
];

const seattlePsychStatisticsCourses = [
  "PSYCH 315",
  "PSYCH 317",
  "PSYCH 318",
];

const seattlePsychListACourses = [
  "PSYCH 300",
  "PSYCH 302",
  "PSYCH 322",
  "PSYCH 333",
  "PSYCH 355",
];

const seattlePsychListBCourses = [
  "PSYCH 303",
  "PSYCH 305",
  "PSYCH 306",
  "PSYCH 345",
  "PSYCH 357",
];

const seattlePsychLabCourses = [
  "PSYCH 330",
  "PSYCH 331",
  "PSYCH 332",
  "PSYCH 334",
  "PSYCH 335",
  "PSYCH 419",
];

const seattlePsychExperienceCourses = [
  "PSYCH 496",
  "PSYCH 497",
  "PSYCH 498",
  "PSYCH 499",
];

const seattlePsychRelatedFieldsCourses = [
  "BIOL 118",
  "BIOL 161",
  "BIOL 162",
  "BIOL 180",
  "BIOL 200",
  "BIOL 220",
  "PHIL 120",
  "PHIL 160",
];

const bothellPsychPrerequisiteCourses = [
  "BIS 170",
  "PSYCH 101",
  "BIS 215",
  "BMATH 215",
  "BBUS 215",
  "STAT 220",
  "STAT 290",
  "BWRIT 133",
  "BWRIT 134",
  "ENGL 131",
  "BWRIT 135",
  "ENGL 141",
];

const bothellPsychCoreCourses = [
  "BISPSY 337",
  "BISPSY 343",
  "BISPSY 348",
  "BISPSY 350",
];

const bothellPsychResearchCourses = [
  "BIS 312",
];

const bothellPsychTwoHundredLevelCourses = [
  "BIS 220",
  "BIS 222",
  "PSYCH 210",
  "BIS 225",
  "PSYCH 245",
  "BIS 270",
];

const bothellPsychUpperDivisionCourses = [
  "BIS 316",
  "BIS 348",
  "BIS 349",
  "BIS 364",
  "BIS 368",
  "BIS 369",
  "BIS 422",
  "BIS 438",
  "BIS 449",
  "BIS 450",
  "BISPSY 489",
  "BISPSY 337",
  "BISPSY 343",
  "BISPSY 348",
  "BISPSY 350",
];

const bothellPsychElectiveCourses = [
  "BIS 115",
  "BIS 140",
  "BIS 162",
  "BIS 165",
  "BIS 180",
  "BIS 181",
  "BIS 193",
  "BIS 216",
  "BIS 219",
  "BIS 226",
  "BIS 235",
  "BIS 238",
  "BIS 249",
  "BIS 252",
  "BIS 255",
  "BIS 256",
  "BIS 257",
  "BIS 258",
  "BIS 279",
  "BIS 282",
  "BIS 307",
  "BIS 317",
  "BIS 336",
  "BIS 352",
  "BIS 353",
  "BIS 365",
  "BIS 367",
  "BIS 380",
  "BIS 384",
  "BIS 445",
  "BIS 448",
  "BIS 456",
  "BIS 483",
  "BISAES 305",
  "BISAES 367",
  "BISGST 303",
  "BISGWS 301",
  "BISLEP 302",
  "BISSTS 231",
  "BBIO 310",
  "BBIO 320",
  "BBIO 394",
  "BEDUC 451",
  "BEDUC 458",
  "BEDUC 481",
  "BBIO 480",
];

const bothellMentalHealthPathCourses = [
  "BIS 220",
  "BIS 270",
  "BIS 349",
  "BIS 367",
  "BIS 422",
  "BIS 449",
];

const bothellPreventionPathCourses = [
  "BIS 220",
  "BIS 225",
  "BIS 270",
  "BIS 352",
  "BISPSY 337",
  "BISPSY 348",
  "BIS 438",
  "BIS 445",
  "BISPSY 489",
];

const bothellCommunityPathCourses = [
  "BIS 365",
  "BIS 352",
  "BISPSY 337",
  "BISPSY 348",
  "BIS 438",
  "BIS 445",
  "BISPSY 489",
];

const tacomaPsychPrerequisiteCourses = [
  "TPSYCH 101",
  "TPSYCH 220",
  "TPSYCH 210",
  "TPSYCH 240",
  "TPSYCH 250",
  "TPSYCH 260",
  "TMATH 110",
  "TSOCWF 351",
  "TURB 225",
  "TPSYCH 209",
];

const tacomaPsychClinicalCoreCourses = [
  "TPSYCH 310",
  "TPSYCH 311",
  "TPSYCH 312",
  "TPSYCH 313",
  "TPSYCH 314",
];

const tacomaPsychDevelopmentalCoreCourses = [
  "TPSYCH 308",
  "TPSYCH 319",
  "TPSYCH 320",
  "TPSYCH 321",
  "TPSYCH 322",
];

const tacomaPsychCognitiveCoreCourses = [
  "TPSYCH 350",
  "TPSYCH 351",
  "TPSYCH 352",
];

const tacomaPsychSocialAppliedCoreCourses = [
  "TPSYCH 344",
  "TPSYCH 345",
  "TPSYCH 346",
  "TPSYCH 347",
  "TPSYCH 349",
  "TPSYCH 360",
  "TPSYCH 361",
  "TPSYCH 362",
];

const tacomaPsychGeneralCoreCourses = [
  "TPSYCH 300",
  "TPSYCH 306",
];

const tacomaPsychResearchCourses = [
  "TPSYCH 309",
];

const tacomaPsychAdvancedTopicCourses = [
  "TPSYCH 400",
  "TPSYCH 401",
  "TPSYCH 402",
  "TPSYCH 403",
  "TPSYCH 404",
  "TPSYCH 405",
  "TPSYCH 406",
  "TPSYCH 407",
  "TPSYCH 409",
  "TPSYCH 410",
  "TPSYCH 418",
  "TPSYCH 421",
  "TPSYCH 422",
  "TPSYCH 431",
  "TPSYCH 432",
  "TPSYCH 441",
  "TPSYCH 450",
  "TPSYCH 455",
  "TPSYCH 460",
  "TPSYCH 461",
  "TPSYCH 471",
  "TPSYCH 472",
];

const tacomaPsychIndependentStudyCourses = [
  "TPSYCH 496",
  "TPSYCH 498",
  "TPSYCH 499",
];

const tacomaPsychElectiveCourses = [
  "TPSYCH 202",
];

const psychologyPrograms = [
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-psychology",
    title: "Psychology",
    officialSources: [
      "https://psych.uw.edu/undergraduate/prospective-students/graduation-requirements",
    ],
    expectedPathwayIds: ["bachelor-of-arts", "bachelor-of-science"],
    pathwayGroups: [
      { id: "bachelor-of-arts", label: "Bachelor of Arts", suggestedCourses: unique([...seattlePsychAdmissionCourses, ...seattlePsychStatisticsCourses, ...seattlePsychListACourses, ...seattlePsychListBCourses, ...seattlePsychExperienceCourses, ...seattlePsychRelatedFieldsCourses]) },
      { id: "bachelor-of-science", label: "Bachelor of Science", suggestedCourses: unique([...seattlePsychAdmissionCourses, "PSYCH 317", "PSYCH 318", ...seattlePsychLabCourses, ...seattlePsychListACourses, ...seattlePsychListBCourses, "PSYCH 499", ...seattlePsychExperienceCourses, ...seattlePsychRelatedFieldsCourses]) },
    ],
    requiredCourseCodes: unique([
      ...seattlePsychAdmissionCourses,
      ...seattlePsychStatisticsCourses,
      ...seattlePsychListACourses,
      ...seattlePsychListBCourses,
      ...seattlePsychLabCourses,
      ...seattlePsychExperienceCourses,
      ...seattlePsychRelatedFieldsCourses,
    ]),
    optionGroups: [
      { id: "seattle-psych-math", label: "One math course", options: [["MATH 111"], ["MATH 112"], ["MATH 120"], ["MATH 124"]] },
      { id: "seattle-psych-ba-statistics", label: "PSYCH 315 or PSYCH 317 and PSYCH 318", options: [["PSYCH 315"], ["PSYCH 317", "PSYCH 318"]] },
      { id: "seattle-psych-bs-statistics", label: "PSYCH 317 and PSYCH 318", options: [["PSYCH 317", "PSYCH 318"]] },
      { id: "seattle-psych-list-a", label: "One course from List A", options: seattlePsychListACourses.map((courseCode) => [courseCode]) },
      { id: "seattle-psych-list-b", label: "One course from List B", options: seattlePsychListBCourses.map((courseCode) => [courseCode]) },
      { id: "seattle-psych-bs-lab", label: "Laboratory Course", options: seattlePsychLabCourses.map((courseCode) => [courseCode]) },
      { id: "seattle-psych-biology", label: "One biology course", options: seattlePsychRelatedFieldsCourses.filter((courseCode) => courseCode.startsWith("BIOL ")).map((courseCode) => [courseCode]) },
      { id: "seattle-psych-bs-philosophy", label: "One philosophy course", options: [["PHIL 120"], ["PHIL 160"]] },
    ],
    courseBuckets: [
      { id: "seattle-psych-ba-admission", label: "Admission Courses", minCredits: 20, courseCodes: seattlePsychAdmissionCourses },
      { id: "seattle-psych-ba-minimum", label: "Bachelor of Arts minimum", minCredits: 53, courseCodes: unique([...seattlePsychAdmissionCourses, ...seattlePsychStatisticsCourses, ...seattlePsychListACourses, ...seattlePsychListBCourses, ...seattlePsychExperienceCourses, ...seattlePsychRelatedFieldsCourses]) },
      { id: "seattle-psych-bs-minimum", label: "Bachelor of Science minimum", minCredits: 66, courseCodes: unique([...seattlePsychAdmissionCourses, "PSYCH 317", "PSYCH 318", ...seattlePsychLabCourses, ...seattlePsychListACourses, ...seattlePsychListBCourses, "PSYCH 499", ...seattlePsychExperienceCourses, ...seattlePsychRelatedFieldsCourses]) },
      { id: "seattle-psych-upper-division-electives", label: "Upper Division Elective Courses", minCredits: 9, maxCredits: 15, courseCodes: [], openEndedRules: ["One course at a 300 or 400-level", "Two courses at a 400-level", "excludes PSYCH 350, 450, 491-499"] },
      { id: "seattle-psych-specialized-experience", label: "Specialized Experience", minCredits: 3, courseCodes: seattlePsychExperienceCourses, openEndedRules: ["a UW study abroad experience approved by the Psychology Advising Office"] },
      { id: "seattle-psych-related-fields", label: "Related Fields Courses", minCredits: 13, maxCredits: 15, courseCodes: seattlePsychRelatedFieldsCourses, openEndedRules: ["One social science course-Anthropology or Sociology"] },
    ],
    genEdRequirements: [
      "English Composition (C) - 5 credits",
      "Additional Writing (W) - 10 credits",
      "Diversity (DIV) - 5 credits",
      "Arts & Humanities (A&H) - 20 credits",
      "Foreign Language",
      "A 2.5 GPA in all psychology courses taken",
      "at least 15 graded credits at the 300 and 400 level in psychology at the University of Washington",
      "A student may earn either a Bachelor of Arts or a Bachelor of Science in psychology, but not both",
    ],
    requirementLabels: [
      "Admission Courses",
      "Statistics Courses",
      "Core Courses",
      "Laboratory Course",
      "Research Experience",
      "Specialized Experience",
      "Related Fields Courses",
    ],
  },
  {
    campusId: "uw-bothell",
    planId: "uw-bothell-psychology",
    title: "Psychology",
    officialSources: [
      "https://www.uwb.edu/ias/undergraduate/majors/psychology",
    ],
    expectedPathwayIds: ["ba-route"],
    pathwayGroups: [
      { id: "ba-route", label: "Bachelor of Arts", suggestedCourses: unique([...bothellPsychPrerequisiteCourses, ...bothellPsychCoreCourses, ...bothellPsychResearchCourses, ...bothellPsychTwoHundredLevelCourses, ...bothellPsychUpperDivisionCourses, ...bothellPsychElectiveCourses]) },
      { id: "mental-health-human-services", label: "Mental Health/Human Services Path", suggestedCourses: bothellMentalHealthPathCourses },
      { id: "prevention-and-health-promotion", label: "Prevention and Health Promotion Path", suggestedCourses: bothellPreventionPathCourses },
      { id: "community-organizing-community-development", label: "Community Organizing/Community Development Path", suggestedCourses: bothellCommunityPathCourses },
    ],
    requiredCourseCodes: unique([
      ...bothellPsychPrerequisiteCourses,
      ...bothellPsychCoreCourses,
      ...bothellPsychResearchCourses,
      ...bothellPsychTwoHundredLevelCourses,
      ...bothellPsychUpperDivisionCourses,
      ...bothellPsychElectiveCourses,
      ...bothellMentalHealthPathCourses,
      ...bothellPreventionPathCourses,
      ...bothellCommunityPathCourses,
    ]),
    optionGroups: [
      { id: "bothell-psych-intro", label: "BIS 170 or PSYCH 101", options: [["BIS 170"], ["PSYCH 101"]] },
      { id: "bothell-psych-statistics", label: "BIS 215, BMATH 215, BBUS 215, STAT 220, or STAT 290", options: [["BIS 215"], ["BMATH 215"], ["BBUS 215"], ["STAT 220"], ["STAT 290"]] },
      { id: "bothell-psych-composition", label: "BWRIT 133, BWRIT 134, ENGL 131, or equivalent composition course", options: [["BWRIT 133"], ["BWRIT 134"], ["ENGL 131"]] },
      { id: "bothell-psych-advanced-composition", label: "BWRIT 135, ENGL 141, or equivalent advanced composition course", options: [["BWRIT 135"], ["ENGL 141"]] },
      { id: "bothell-psych-core-choice", label: "One Psychology Core Course", options: bothellPsychCoreCourses.map((courseCode) => [courseCode]) },
      { id: "bothell-psych-200-level", label: "200 Level Psychology Courses", options: bothellPsychTwoHundredLevelCourses.map((courseCode) => [courseCode]) },
    ],
    courseBuckets: [
      { id: "bothell-psych-prerequisites", label: "Prerequisites", minCredits: 20, courseCodes: bothellPsychPrerequisiteCourses },
      { id: "bothell-psych-core", label: "Psychology core courses", minCredits: 5, courseCodes: bothellPsychCoreCourses },
      { id: "bothell-psych-research-methods", label: "Research Methods courses", minCredits: 5, courseCodes: bothellPsychResearchCourses },
      { id: "bothell-psych-200-level", label: "200-level Psychology courses", minCredits: 10, courseCodes: bothellPsychTwoHundredLevelCourses },
      { id: "bothell-psych-upper-division", label: "Upper Division Psychology courses", minCredits: 15, courseCodes: bothellPsychUpperDivisionCourses },
      { id: "bothell-psych-electives", label: "Psychology electives", minCredits: 15, courseCodes: bothellPsychElectiveCourses },
      { id: "bothell-psych-additional-ias", label: "Additional IAS Coursework", minCredits: 20, courseCodes: [], openEndedRules: ["IAS will maintain the list of courses"] },
    ],
    genEdRequirements: [
      "Total = 70 Credits",
      "Residency Requirement: 30 credits must be completed in residency at UW Bothell",
      "Major GPA must be at a cumulative of 2.00 or higher",
      "Interdisciplinary Practice & Reflection (IPR)",
      "A maximum of 35 credits earned in 100- and 200-level courses may apply toward the major",
    ],
    requirementLabels: [
      "Degree Requirements",
      "Psychology core courses",
      "Research Methods courses",
      "200-level Psychology courses",
      "Upper Division Psychology courses",
      "Psychology electives",
      "Foundational courses in psychology",
    ],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-psychology",
    title: "Psychology",
    officialSources: [
      "https://www.tacoma.uw.edu/sias/socs/psychology",
      "https://www.tacoma.uw.edu/sias/general-education-requirements",
    ],
    expectedPathwayIds: ["ba-route"],
    pathwayGroups: [
      { id: "ba-route", label: "B.A. route", suggestedCourses: unique([...tacomaPsychPrerequisiteCourses, ...tacomaPsychClinicalCoreCourses, ...tacomaPsychDevelopmentalCoreCourses, ...tacomaPsychCognitiveCoreCourses, ...tacomaPsychSocialAppliedCoreCourses, ...tacomaPsychGeneralCoreCourses, ...tacomaPsychResearchCourses, ...tacomaPsychAdvancedTopicCourses, ...tacomaPsychIndependentStudyCourses, ...tacomaPsychElectiveCourses]) },
    ],
    requiredCourseCodes: unique([
      ...tacomaPsychPrerequisiteCourses,
      ...tacomaPsychClinicalCoreCourses,
      ...tacomaPsychDevelopmentalCoreCourses,
      ...tacomaPsychCognitiveCoreCourses,
      ...tacomaPsychSocialAppliedCoreCourses,
      ...tacomaPsychGeneralCoreCourses,
      ...tacomaPsychResearchCourses,
      ...tacomaPsychAdvancedTopicCourses,
      ...tacomaPsychIndependentStudyCourses,
      ...tacomaPsychElectiveCourses,
    ]),
    optionGroups: [
      { id: "tacoma-psych-foundation", label: "Two psychology foundation courses chosen from more than one of the following areas", options: [["TPSYCH 220"], ["TPSYCH 210"], ["TPSYCH 240"], ["TPSYCH 250"], ["TPSYCH 260"]] },
      { id: "tacoma-psych-statistics", label: "One introductory statistics course", options: [["TMATH 110"], ["TSOCWF 351"], ["TURB 225"]] },
      { id: "tacoma-psych-clinical-core", label: "Controversies in Clinical Psychology", options: tacomaPsychClinicalCoreCourses.map((courseCode) => [courseCode]) },
      { id: "tacoma-psych-developmental-core", label: "Developmental Core Courses", options: tacomaPsychDevelopmentalCoreCourses.map((courseCode) => [courseCode]) },
      { id: "tacoma-psych-cognitive-core", label: "Cognitive/Experimental Core Courses", options: tacomaPsychCognitiveCoreCourses.map((courseCode) => [courseCode]) },
      { id: "tacoma-psych-social-applied-core", label: "Social/Applied Core Courses", options: tacomaPsychSocialAppliedCoreCourses.map((courseCode) => [courseCode]) },
      { id: "tacoma-psych-general-core", label: "General Psychology Core Course", options: tacomaPsychGeneralCoreCourses.map((courseCode) => [courseCode]) },
    ],
    courseBuckets: [
      { id: "tacoma-psych-prerequisites", label: "Prerequisites", minCredits: 25, courseCodes: tacomaPsychPrerequisiteCourses },
      { id: "tacoma-psych-core", label: "Core courses", minCredits: 15, courseCodes: unique([...tacomaPsychClinicalCoreCourses, ...tacomaPsychDevelopmentalCoreCourses, ...tacomaPsychCognitiveCoreCourses, ...tacomaPsychSocialAppliedCoreCourses, ...tacomaPsychGeneralCoreCourses]), openEndedRules: ["Students must take courses across at least 2 core areas"] },
      { id: "tacoma-psych-research-methods", label: "Research Methods", minCredits: 5, courseCodes: tacomaPsychResearchCourses },
      { id: "tacoma-psych-advanced-topics", label: "Advanced Topics", minCredits: 10, courseCodes: tacomaPsychAdvancedTopicCourses },
      { id: "tacoma-psych-independent-study", label: "Any 300- or 400-level TPSYCH course OR an independent studies course", minCredits: 5, courseCodes: tacomaPsychIndependentStudyCourses, openEndedRules: ["Any 300- or 400-level TPSYCH course OR an independent studies course", "Independent Study Contracts"] },
      { id: "tacoma-psych-upper-division-outside", label: "Upper-division coursework (300- or 400-level outside of the subject of Psychology)", minCredits: 15, courseCodes: [], openEndedRules: ["5 credits: Arts and Humanities (A&H)", "5 credits: Social Sciences (SSc)", "5 additional credits from Arts and Humanities (A&H) OR Social Sciences (SSc) OR Natural Sciences (NSc)"] },
      { id: "tacoma-psych-electives", label: "TPSYCH 202 Human Sexuality", courseCodes: tacomaPsychElectiveCourses },
    ],
    genEdRequirements: [
      "Completing the prerequisites, with a minimum grade of 2.0",
      "minimum of 45 lower-division credits",
      "For a BA in Psychology, students must complete 75 major credits",
      "UWT general education and graduation requirements totaling a minimum of 180 credits",
      "Prerequisites (25 credits)",
    ],
    requirementLabels: [
      "Controversies in Clinical Psychology",
      "Developmental Core Courses",
      "Cognitive/Experimental Core Courses",
      "Social/Applied Core Courses",
      "General Psychology Core Course",
      "Research Methods",
      "Advanced Topics",
      "ADMISSION REQUIREMENTS",
      "DEGREE REQUIREMENTS",
    ],
  },
];

module.exports = {
  psychologyPrograms,
};
