function courses(value) {
  return String(value)
    .split(",")
    .map((courseCode) => courseCode.trim())
    .filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function singleOptions(courseCodes) {
  return courseCodes.map((courseCode) => [courseCode]);
}

const seattleSocialWelfareCoreCourses = courses(`
  SOCWF 200, SOCWF 265, SOCWF 305, SOCWF 310, SOCWF 311, SOCWF 312,
  SOCWF 313, SOCWF 320, SOCWF 390, SOCWF 402, SOCWF 404, SOCWF 405,
  SOCWF 415, SOCWF 435, SOCWF 460, SOCWF 465, SOCWF 495
`);

const tacomaSocialWelfareCoreCourses = courses(`
  TSOCWF 300, TSOCWF 310, TSOCWF 311, TSOCWF 312, TSOCWF 320,
  TSOCWF 390, TSOCWF 402, TSOCWF 404, TSOCWF 405, TSOCWF 406,
  TSOCWF 414, TSOCWF 415
`);

const tacomaSocialWelfareModelProgramCourses = courses(`
  TSOCWF 301, TSOCWF 300, TSOCWF 310, TSOCWF 311, TSOCWF 312,
  TSOCWF 320, TSOCWF 390, TSOCWF 402, TSOCWF 404, TSOCWF 405,
  TSOCWF 406, TSOCWF 414, TSOCWF 415
`);

const tacomaSocialWelfareElectiveCourses = courses(`
  TSOCWF 350, TSOCWF 351, TSOCWF 353, TSOCWF 354, TSOCWF 355,
  TSOCWF 361, TSOCWF 363, TSOCWF 374, TSOCWF 409, TSOCWF 420,
  TSOCWF 421, TSOCWF 422, TSOCWF 425, TSOCWF 427, TSOCWF 428,
  TSOCWF 430, TSOCWF 433, TSOCWF 436, TSOCWF 490
`);

const tacomaCriminalJusticeCoreCourses = courses(`
  TCRIM 225, TCRIM 361, TCRIM 362, TCRIM 390, TCRIM 370, TCRIM 371,
  TCRIM 372, TCRIM 395, TCRIM 441
`);

const tacomaCriminalJusticeCoreElectiveCourses = courses(`
  TBUS 300, TINFO 444, TCRIM 155, TCRIM 156, TCRIM 157, TCRIM 158,
  TCRIM 222, TCRIM 271, TCRIM 272, TCRIM 275, TCRIM 276, TCRIM 277,
  TCRIM 352, TCRIM 360, TCRIM 363, TCRIM 364, TCRIM 365, TCRIM 373,
  TCRIM 374, TCRIM 375, TCRIM 376, TCRIM 377, TCRIM 409, TCRIM 427,
  TCRIM 428, TCRIM 430, TCRIM 433, TCRIM 434, TCRIM 435, TCRIM 436,
  TCRIM 437, TCRIM 440, TCRIM 450, TCRIM 490, TCRIM 498, THLTH 425,
  TLAW 320, TLAW 348, TLAW 363, TLAW 452, TPHIL 200, TPHIL 361,
  TPHIL 453, TPSYCH 210, TPSYCH 250, TPSYCH 401, TPSYCH 406,
  TPSYCH 421, TPSYCH 422, TPSYCH 431, TPSYCH 432, TSOC 265,
  TSOC 335, TSOC 437, TSOCWF 150, TSOCWF 351, TSOCWF 353,
  TSOCWF 354, TSOCWF 420, TSOCWF 421, TURB 312
`);

const tacomaCriminalJusticeOnlineCoreCourses = courses(`
  TCRIM 225, TCRIM 361, TCRIM 362, TCRIM 390, TCRIM 370, TCRIM 371,
  TCRIM 372, TCRIM 395, TCRIM 441
`);

const socialWelfareCriminalJusticePrograms = [
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-social-welfare",
    title: "Social Welfare",
    officialSources: [
      "https://www.washington.edu/students/gencat/program/S/SocialWork-779.html",
      "https://www.washington.edu/students/crscat/socwf.html",
    ],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: unique([
      "ENGL 131",
      ...seattleSocialWelfareCoreCourses,
    ]),
    optionGroups: [
      { id: "seattle-social-welfare-core", label: "Core Courses", options: singleOptions(seattleSocialWelfareCoreCourses) },
      { id: "seattle-social-welfare-socwf-460-495", label: "SOCWF 460 or SOCWF 495", options: singleOptions(["SOCWF 460", "SOCWF 495"]) },
    ],
    courseBuckets: [
      { id: "seattle-social-welfare-core", label: "Core Courses", minCredits: 67, courseCodes: seattleSocialWelfareCoreCourses, openEndedRules: ["Minimum 2.0 grade in each course"] },
    ],
    genEdRequirements: [
      "Bachelor of Arts degree with a major in Social Welfare",
      "English Composition",
      "Additional Writing",
      "Reasoning",
      "Foreign Language",
      "Diversity",
      "Arts and Humanities",
      "Social Sciences",
      "Natural Sciences",
      "Additional Areas of Inquiry",
      "Minimum 65 transferable college-level credits completed",
      "One introductory course in sociology and one introductory course in psychology",
      "Minimum 2.00 cumulative GPA",
      "67 credits",
      "Minimum 2.50 cumulative GPA in all SOCWF courses applied to the major",
      "Minimum overall 2.00 cumulative UW GPA",
    ],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-social-welfare",
    title: "Social Welfare",
    officialSources: [
      "https://www.tacoma.uw.edu/swcj/basw-curriculum",
      "https://www.washington.edu/students/crscatt/tsocwf.html",
    ],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: unique([
      "ENGL 131",
      ...tacomaSocialWelfareCoreCourses,
      ...tacomaSocialWelfareModelProgramCourses,
      ...tacomaSocialWelfareElectiveCourses,
    ]),
    optionGroups: [
      { id: "tacoma-social-welfare-core", label: "Social Welfare Core Courses", options: singleOptions(tacomaSocialWelfareCoreCourses) },
      { id: "tacoma-social-welfare-electives", label: "Social Welfare Electives", options: singleOptions(tacomaSocialWelfareElectiveCourses) },
      { id: "tacoma-social-welfare-statistics", label: "Statistics is a required course for the BASW program", options: singleOptions(["TSOCWF 351"]) },
    ],
    courseBuckets: [
      { id: "tacoma-social-welfare-core", label: "Core courses", minCredits: 58, courseCodes: tacomaSocialWelfareCoreCourses, openEndedRules: ["Foundation courses", "Social work practice courses", "Practicum", "Field experience", "Practicum seminars"] },
      { id: "tacoma-social-welfare-electives", label: "Social Welfare electives", minCredits: 10, courseCodes: tacomaSocialWelfareElectiveCourses, openEndedRules: ["TSOCWF 300- and 400-level non-core courses"] },
      { id: "tacoma-social-welfare-general-electives", label: "General electives", courseCodes: [], openEndedRules: ["Additional credits needed to bring your total to 180"] },
    ],
    genEdRequirements: [
      "Bachelor of Arts in Social Welfare",
      "All Social Welfare majors are required to complete each BASW core course with a 2.0 or higher grade",
      "Maintain a 2.5 GPA in all major coursework",
      "Reasoning",
      "Composition",
      "Writing",
      "Diversity",
      "Arts and Humanities",
      "Social Sciences",
      "Natural Science",
      "Completion of a minimum of 75 college-level credits before start of the program",
      "Completion of 180 college-level quarter credits",
      "480 hours of practicum experience",
    ],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-criminal-justice",
    title: "Criminal Justice",
    officialSources: [
      "https://www.tacoma.uw.edu/swcj/criminal-justice-campus-curriculum",
      "https://www.tacoma.uw.edu/swcj/cj-online-curriculum",
      "https://www.washington.edu/students/crscatt/tcrim.html",
    ],
    expectedPathwayIds: [
      "campus-pathway",
      "online-pathway",
    ],
    pathwayGroups: [
      { id: "campus-pathway", label: "Campus pathway", suggestedCourses: unique([...tacomaCriminalJusticeCoreCourses, ...tacomaCriminalJusticeCoreElectiveCourses]) },
      { id: "online-pathway", label: "Online pathway", suggestedCourses: tacomaCriminalJusticeOnlineCoreCourses },
    ],
    requiredCourseCodes: unique([
      ...tacomaCriminalJusticeCoreCourses,
      ...tacomaCriminalJusticeCoreElectiveCourses,
      ...tacomaCriminalJusticeOnlineCoreCourses,
    ]),
    optionGroups: [
      { id: "tacoma-criminal-justice-core", label: "Criminal Justice Core Courses", options: singleOptions(tacomaCriminalJusticeCoreCourses) },
      { id: "tacoma-criminal-justice-core-electives", label: "Criminal Justice Core Electives", options: singleOptions(tacomaCriminalJusticeCoreElectiveCourses) },
      { id: "tacoma-criminal-justice-online-core", label: "Criminal Justice Online Core Courses", options: singleOptions(tacomaCriminalJusticeOnlineCoreCourses) },
      { id: "tacoma-criminal-justice-independent-study-limit", label: "TCRIM 409 and/or TCRIM 490", options: singleOptions(["TCRIM 409", "TCRIM 490"]) },
      { id: "tacoma-criminal-justice-comparative-limit", label: "TCRIM 450", options: [["TCRIM 450"]] },
      { id: "tacoma-criminal-justice-statistics-prerequisite", label: "Introductory statistics course", options: [["TSOCWF 351"]] },
    ],
    courseBuckets: [
      { id: "tacoma-criminal-justice-campus-core", label: "Core courses", minCredits: 45, courseCodes: tacomaCriminalJusticeCoreCourses, openEndedRules: ["Administration of justice", "Corrections", "Criminological theory", "Law adjudication", "Research and theoretical methods"] },
      { id: "tacoma-criminal-justice-core-electives", label: "Core electives", minCredits: 20, courseCodes: tacomaCriminalJusticeCoreElectiveCourses, openEndedRules: ["Maximum of five credits from TCRIM 409 and/or TCRIM 490", "Maximum of ten credits from TCRIM 450"] },
      { id: "tacoma-criminal-justice-campus-transfer", label: "Transferable college-level credits", minCredits: 45, courseCodes: [] },
      { id: "tacoma-criminal-justice-online-transfer", label: "Transferable college-level credits", minCredits: 90, courseCodes: [] },
      { id: "tacoma-criminal-justice-general-electives", label: "General electives", courseCodes: [], openEndedRules: ["Additional credits needed to complete 180 college-level quarter credits"] },
    ],
    genEdRequirements: [
      "Bachelor of Arts in Criminal Justice",
      "Campus Curriculum",
      "Online Curriculum",
      "All Criminal Justice majors are required to complete each CJ core course and CJ Core Elective with a 2.0 or higher grade",
      "Maintain a 2.0 GPA in all major coursework",
      "65-credit program",
      "Complete a minimum of 180 credits",
      "Arts and Humanities",
      "Natural Sciences",
      "Social Sciences",
      "Maximum of 10 transfer equivalent credits are allowed towards the 65 credit major",
    ],
  },
];

module.exports = {
  socialWelfareCriminalJusticePrograms,
};
