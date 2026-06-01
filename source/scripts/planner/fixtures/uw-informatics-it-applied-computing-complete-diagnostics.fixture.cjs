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

const seattleInformaticsPrerequisiteCourses = courses(`
  INFO 200, INFO 180, INFO 201, CSE 121, CSE 122, CSE 123, CSE 142, CSE 143,
  CSE 154, CSE 160, CSE 163, CSE 180, STAT 180, CSS 142, CSS 143, TCSS 142,
  STAT 220, STAT 221, SOC 221, CSSS 221, STAT 321, CSSS 321, BIOSTAT 310,
  CSE 312, EDPSY 490, INDE 315, MATH 390, MATH 394, STAT 394, PSYCH 315,
  PSYCH 317, QMETH 201, QSCI 381, STAT 290, STAT 311, STAT 390, BIS 215,
  BMATH 215, BBUS 215, STMATH 341, TMATH 110
`);

const seattleInformaticsCoreCourses = courses(`
  INFO 201, INFO 290, INFO 300, CSE 123, CSE 143, CSE 163, INFO 330,
  INFO 340, CSE 373, INFO 442, INFO 443, INFO 360, INFO 380, INFO 490,
  INFO 491
`);

const seattleInformaticsSocietyCourses = courses(`
  INFO 351, INFO 352, INFO 353, INFO 354, INFO 355, INFO 356, INFO 357,
  INFO 358
`);

const seattleInformaticsUndergraduateCatalogCourses = courses(`
  INFO 102, INFO 103, INFO 104, INFO 108, INFO 110, INFO 180, INFO 198,
  INFO 200, INFO 201, INFO 270, INFO 280, INFO 290, INFO 300, INFO 310,
  INFO 312, INFO 314, INFO 330, INFO 331, INFO 340, INFO 351, INFO 352,
  INFO 353, INFO 354, INFO 355, INFO 356, INFO 357, INFO 358, INFO 360,
  INFO 362, INFO 370, INFO 371, INFO 376, INFO 380, INFO 386, INFO 410,
  INFO 415, INFO 430, INFO 433, INFO 441, INFO 442, INFO 443, INFO 449,
  INFO 462, INFO 463, INFO 464, INFO 465, INFO 468, INFO 474, INFO 478,
  INFO 480, INFO 490, INFO 491, INFO 492, INFO 493, INFO 494, INFO 495,
  INFO 496, INFO 497, INFO 498, INFO 499
`);

const seattleInformaticsDataScienceOptionCourses = courses(`
  INFO 370, INFO 371, INFO 430, INFO 474
`);

const seattleInformaticsHealthOptionCourses = courses(`
  BIME 300, BIME 435, INFO 468, INFO 478
`);

const bothellAppliedComputingPrerequisiteCourses = courses(`
  BWRIT 134, BWRIT 135, STMATH 124, CSS 132, CSS 133, CSS 142, CSS 143,
  CSSSKL 142, CSSSKL 143
`);

const bothellAppliedComputingCoreCourses = courses(`
  CSS 301, CSS 340, CSS 342, CSS 350, BBUS 300, CSS 360, CSS 421, CSS 496
`);

const tacomaInformationTechnologyPrerequisiteCourses = courses(`
  TCSS 141, TCSS 142, TMATH 115, TMATH 116, TMATH 120
`);

const tacomaInformationTechnologyCoreCourses = courses(`
  TINFO 200, TINFO 210, TINFO 220, TINFO 230, TINFO 240, TINFO 250,
  TINFO 310, TINFO 320, TINFO 360, TINFO 370, TMATH 110, TWRT 291,
  TCSS 325, TINFO 452, TINFO 457
`);

const tacomaInformationTechnologyElectiveCourses = courses(`
  TINFO 410, TINFO 431, TINFO 441, TINFO 442, TINFO 443, TINFO 444,
  TINFO 445, TINFO 446, TINFO 451, TINFO 453, TINFO 461, TINFO 462,
  TINFO 463, TINFO 480
`);

const tacomaInformationTechnologyUndergraduateCatalogCourses = courses(`
  TINFO 110, TINFO 200, TINFO 210, TINFO 220, TINFO 230, TINFO 240,
  TINFO 250, TINFO 310, TINFO 320, TINFO 360, TINFO 370, TINFO 390,
  TINFO 410, TINFO 411, TINFO 431, TINFO 441, TINFO 442, TINFO 443,
  TINFO 444, TINFO 445, TINFO 446, TINFO 451, TINFO 452, TINFO 453,
  TINFO 457, TINFO 458, TINFO 461, TINFO 462, TINFO 463, TINFO 470,
  TINFO 473, TINFO 475, TINFO 476, TINFO 480, TINFO 481, TINFO 482,
  TINFO 490, TINFO 497, TINFO 498, TINFO 499
`);

const tacomaInformationTechnologyIacOptionCourses = courses(`
  TINFO 441, TINFO 442, TINFO 443
`);

const tacomaInformationTechnologyDmfOptionCourses = courses(`
  TINFO 444, TINFO 445, TINFO 446
`);

const tacomaInformationTechnologyProjectInternshipCourses = courses(`
  TINFO 481, TINFO 482, TINFO 497
`);

const informationComputingPrograms = [
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-informatics",
    title: "Informatics",
    officialSources: [
      "https://ischool.uw.edu/programs/informatics/curriculum",
      "https://ischool.uw.edu/programs/informatics/admissions/prerequisites",
      "https://www.washington.edu/students/crscat/info.html",
    ],
    expectedPathwayIds: [
      "biomedical-and-health-informatics-option",
      "data-science-option",
    ],
    pathwayGroups: [
      { id: "data-science-option", label: "Data Science Option", suggestedCourses: seattleInformaticsDataScienceOptionCourses },
      { id: "biomedical-and-health-informatics-option", label: "Biomedical and Health Informatics Option", suggestedCourses: seattleInformaticsHealthOptionCourses },
    ],
    requiredCourseCodes: unique([
      ...seattleInformaticsPrerequisiteCourses,
      ...seattleInformaticsCoreCourses,
      ...seattleInformaticsSocietyCourses,
      ...seattleInformaticsUndergraduateCatalogCourses,
      ...seattleInformaticsDataScienceOptionCourses,
      ...seattleInformaticsHealthOptionCourses,
    ]),
    optionGroups: [
      { id: "seattle-info-programming", label: "One course in computer programming", options: singleOptions(["INFO 180", "INFO 201", "CSE 121", "CSE 122", "CSE 123", "CSE 142", "CSE 143", "CSE 154", "CSE 160", "CSE 163", "CSE 180", "STAT 180", "CSS 142", "CSS 143", "TCSS 142"]) },
      { id: "seattle-info-statistics", label: "One course in statistics", options: singleOptions(["STAT 220", "STAT 221", "SOC 221", "CSSS 221", "STAT 321", "CSSS 321", "BIOSTAT 310", "CSE 312", "EDPSY 490", "INDE 315", "MATH 390", "MATH 394", "STAT 394", "PSYCH 315", "PSYCH 317", "QMETH 201", "QSCI 381", "STAT 290", "STAT 311", "STAT 390", "BIS 215", "BMATH 215", "BBUS 215", "STMATH 341", "TMATH 110"]) },
      { id: "seattle-info-developing-it", label: "Developing Information Technology", options: singleOptions(["CSE 123", "CSE 143", "CSE 163", "CSE 373", "INFO 442", "INFO 443"]) },
      { id: "seattle-info-society", label: "Information and Society", options: singleOptions(seattleInformaticsSocietyCourses) },
      { id: "seattle-info-data-science-option", label: "Data Science Option", options: singleOptions(seattleInformaticsDataScienceOptionCourses) },
      { id: "seattle-info-health-option", label: "Biomedical and Health Informatics Option", options: [seattleInformaticsHealthOptionCourses] },
    ],
    courseBuckets: [
      { id: "seattle-info-admission", label: "Courses required for admission", minCredits: 15, maxCredits: 20, courseCodes: seattleInformaticsPrerequisiteCourses, openEndedRules: ["INFO 200", "One course in statistics", "One course in computer programming", "One course in the Social Sciences area of inquiry"] },
      { id: "seattle-info-core", label: "Core courses", minCredits: 54, maxCredits: 58, courseCodes: unique([...seattleInformaticsCoreCourses, ...seattleInformaticsSocietyCourses]) },
      { id: "seattle-info-capstone", label: "Capstone", minCredits: 8, courseCodes: ["INFO 490", "INFO 491"] },
      { id: "seattle-info-electives", label: "Electives", minCredits: 12, maxCredits: 15, courseCodes: seattleInformaticsUndergraduateCatalogCourses, openEndedRules: ["Upper-division INFO courses", "Data Science", "Health and Well-Being"] },
    ],
    genEdRequirements: [
      "Bachelor of Science in Informatics",
      "Effective Autumn 2023",
      "Foundations",
      "Design",
      "Development",
      "Data",
      "Organizations",
      "Society",
      "Social Sciences area of inquiry",
      "Prerequisite courses must be completed with a grade of 2.0 or higher",
    ],
  },
  {
    campusId: "uw-bothell",
    planId: "uw-bothell-applied-computing",
    title: "Applied Computing",
    officialSources: [
      "https://www.uwb.edu/stem/undergraduate/majors/applied-computing",
      "https://www.uwb.edu/stem/undergraduate/majors/applied-computing/admissions",
      "https://www.uwb.edu/stem/undergraduate/majors/applied-computing/curriculum",
    ],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: unique([
      ...bothellAppliedComputingPrerequisiteCourses,
      ...bothellAppliedComputingCoreCourses,
    ]),
    optionGroups: [
      { id: "bothell-ac-composition", label: "", options: [["BWRIT 134"], ["BWRIT 135"]] },
      { id: "bothell-ac-calculus", label: "", options: [["STMATH 124"]] },
      { id: "bothell-ac-programming", label: "", options: [["CSS 142", "CSS 143"], ["CSS 132", "CSS 133"]] },
      { id: "bothell-ac-data-structures", label: "", options: [["CSS 340"], ["CSS 342"], ["CSS 340", "CSS 342"]] },
      { id: "bothell-ac-business-management", label: "", options: [["CSS 350"], ["BBUS 300"]] },
    ],
    courseBuckets: [
      { id: "bothell-ac-prerequisites", label: "", courseCodes: bothellAppliedComputingPrerequisiteCourses },
      { id: "bothell-ac-core", label: "", courseCodes: bothellAppliedComputingCoreCourses },
      { id: "bothell-ac-second-discipline", label: "", courseCodes: [] },
      { id: "bothell-ac-css-electives", label: "", courseCodes: [] },
      { id: "bothell-ac-upper-general-electives", label: "", courseCodes: [] },
    ],
    genEdRequirements: [],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-information-technology",
    title: "Information Technology",
    officialSources: [
      "https://www.tacoma.uw.edu/set/programs/undergrad/it",
      "https://www.washington.edu/students/crscatt/tinfo.html",
    ],
    expectedPathwayIds: [
      "digital-mobile-forensics-option",
      "information-assurance-cybersecurity-option",
    ],
    pathwayGroups: [
      { id: "information-assurance-cybersecurity-option", label: "Information Assurance and Cybersecurity", suggestedCourses: tacomaInformationTechnologyIacOptionCourses },
      { id: "digital-mobile-forensics-option", label: "Digital Mobile Forensics", suggestedCourses: tacomaInformationTechnologyDmfOptionCourses },
    ],
    requiredCourseCodes: unique([
      ...tacomaInformationTechnologyPrerequisiteCourses,
      ...tacomaInformationTechnologyCoreCourses,
      ...tacomaInformationTechnologyElectiveCourses,
      ...tacomaInformationTechnologyUndergraduateCatalogCourses,
      ...tacomaInformationTechnologyIacOptionCourses,
      ...tacomaInformationTechnologyDmfOptionCourses,
      ...tacomaInformationTechnologyProjectInternshipCourses,
    ]),
    optionGroups: [
      { id: "tacoma-it-precalculus", label: "Precalculus", options: [["TMATH 115", "TMATH 116"], ["TMATH 120"]] },
      { id: "tacoma-it-programming-prerequisite", label: "Introduction to Programming", options: singleOptions(["TCSS 141", "TCSS 142"]) },
      { id: "tacoma-it-systems-admin", label: "TINFO 452 Windows System Admin or TINFO 457 Unix System Admin", options: singleOptions(["TINFO 452", "TINFO 457"]) },
      { id: "tacoma-it-senior-project-internship", label: "Senior Project or Internship", options: singleOptions(tacomaInformationTechnologyProjectInternshipCourses) },
      { id: "tacoma-it-information-assurance-cybersecurity", label: "Information Assurance and Cybersecurity", options: [tacomaInformationTechnologyIacOptionCourses] },
      { id: "tacoma-it-digital-mobile-forensics", label: "Digital Mobile Forensics", options: [tacomaInformationTechnologyDmfOptionCourses] },
    ],
    courseBuckets: [
      { id: "tacoma-it-prerequisites", label: "Prerequisites", courseCodes: tacomaInformationTechnologyPrerequisiteCourses, openEndedRules: ["All pre-requisite courses must be completed in the last seven years", "Completion of at least 45 college-level credits"] },
      { id: "tacoma-it-core", label: "Core Courses", courseCodes: tacomaInformationTechnologyCoreCourses },
      { id: "tacoma-it-electives", label: "Electives List", courseCodes: unique([...tacomaInformationTechnologyElectiveCourses, ...tacomaInformationTechnologyUndergraduateCatalogCourses]) },
      { id: "tacoma-it-senior-project", label: "Senior Project or Internship", minCredits: 1, maxCredits: 10, courseCodes: tacomaInformationTechnologyProjectInternshipCourses },
      { id: "tacoma-it-iac-option", label: "Information Assurance and Cybersecurity", minCredits: 15, courseCodes: tacomaInformationTechnologyIacOptionCourses },
      { id: "tacoma-it-dmf-option", label: "Digital Mobile Forensics", minCredits: 15, courseCodes: tacomaInformationTechnologyDmfOptionCourses, openEndedRules: ["Temporarily suspended"] },
    ],
    genEdRequirements: [
      "B.S. in Information Technology",
      "Capacity-constrained major",
      "Required cumulative prerequisite GPA of at least 2.5",
      "Minimum grade of 2.0 in each individual prerequisite",
      "Required minimum cumulative GPA of 2.0 in all college coursework",
      "All courses within the major must be completed with a minimum grade of 2.0 and a cumulative GPA of 2.5",
      "Analyze, design, integrate, and manage information systems using information technology",
      "ABET Accreditation",
    ],
  },
];

module.exports = {
  informationComputingPrograms,
};
