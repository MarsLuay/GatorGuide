function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function courses(value) {
  return String(value)
    .split(",")
    .map((courseCode) => courseCode.trim())
    .filter(Boolean);
}

const seattleCivilPrerequisiteCourses = courses(`
  MATH 124, MATH 125, MATH 126, MATH 207, MATH 208, AMATH 301, AMATH 351, AMATH 352,
  INDE 315, QSCI 381, STAT 290, STAT 390, CHEM 142, CHEM 152, PHYS 121, PHYS 122, PHYS 123,
  BIOL 180, ATMS 101, ATMS 211, ATMS 212, ESRM 100, ESRM 101, ESRM 210, ESS 101, ESS 106,
  ESS 201, ESS 211, ESS 212, OCEAN 102, OCEAN 200, CSE 121, CSE 122, CSE 123, CSE 142,
  CSE 160, AA 210, CEE 220, ME 230, ENGL 131, INDE 250, ECON 200, ECON 201, ECON 235,
  ESRM 235, ENVIR 235
`);

const seattleCivilCoreCourses = courses(`
  CEE 307, CEE 317, CEE 327, CEE 337, CEE 347, CEE 357, CEE 367, CEE 377, CEE 378,
  CEE 440, CEE 441, CEE 442, CEE 444, CEE 445
`);

const seattleCivilTechnicalElectiveCourses = courses(`
  CEE 409, CEE 410, CEE 412, CEE 415, CEE 416, CEE 419, CEE 422, CEE 424, CEE 432,
  CEE 433, CEE 434, CEE 435, CEE 436, CEE 437, CEE 450, CEE 451, CEE 452, CEE 453,
  CEE 454, CEE 457, CEE 459, CEE 462, CEE 463, CEE 465, CEE 467, CEE 473, CEE 475,
  CEE 476, CEE 477, CEE 478, CEE 480, CEE 481, CEE 482, CEE 483, CEE 498
`);

const seattleEnvironmentalPrerequisiteCourses = courses(`
  MATH 124, MATH 125, MATH 126, MATH 207, MATH 208, AMATH 301, AMATH 351, AMATH 352,
  INDE 315, QSCI 381, STAT 290, STAT 390, BIOL 180, CHEM 142, CHEM 152, CHEM 162,
  PHYS 121, PHYS 122, PHYS 123, ATMS 101, ATMS 211, ATMS 212, ESRM 100, ESRM 101,
  ESRM 210, ESS 106, ESS 201, ESS 211, ESS 212, NUTR 200, OCEAN 102, OCEAN 200,
  CSE 121, CSE 122, CSE 123, CSE 142, CSE 160, AA 210, AA 260, CEE 220, ME 323,
  PHYS 224, ENGL 131, INDE 250, ECON 200, ECON 201, ECON 235, ESRM 235, ENVIR 235
`);

const seattleEnvironmentalCoreCourses = courses(`
  CEE 347, CEE 348, CEE 349, CEE 350, CEE 352, CEE 354, CEE 356, CEE 440, CEE 444,
  CEE 445
`);

const seattleEnvironmentalTechnicalElectiveCourses = courses(`
  CEE 401, CEE 402, CEE 415, CEE 424, CEE 432, CEE 437, CEE 450, CEE 462, CEE 463,
  CEE 465, CEE 467, CEE 473, CEE 474, CEE 475, CEE 476, CEE 477, CEE 478, CEE 480,
  CEE 481, CEE 482, CEE 483, CEE 490, CEE 497, CEE 498, CEE 499
`);

const tacomaCivilPrerequisiteCourses = courses(`
  TMATH 124, TMATH 125, TMATH 126, TMATH 207, TPHYS 121, TPHYS 122, TPHYS 123,
  TCHEM 142, TME 221, AA 210, TME 222, CEE 220, TME 223, ME 230, AMATH 301
`);

const tacomaCivilRequiredCourses = courses(`
  TCE 304, TCE 305, TCE 307, TCE 309, TCE 327, TCE 337, TCE 347, TCE 357, TCE 367,
  TCE 377, TCE 401, TCE 473, TCE 488, TCE 489, TEE 225, TME 310, TME 351, TME 403
`);

const tacomaCivilSeniorElectiveCourses = courses(`
  TCE 411, TCE 416, TCE 417, TCE 426, TCE 429, TCE 451, TCE 452, TCE 480, TCE 482,
  TCE 484
`);

const civilEnvironmentalEngineeringPrograms = [
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-civil-engineering",
    title: "Civil Engineering",
    officialSources: [
      "https://www.ce.washington.edu/sites/default/files/pdfs/current/undergrad/uw-cee-bsce-degree-sheet.pdf",
    ],
    expectedPathwayIds: [
      "construction-energy-sustainable-infrastructure-area",
      "environmental-engineering-area",
      "geotechnical-engineering-area",
      "hydrology-hydrodynamics-water-area",
      "structural-engineering-area",
      "transportation-engineering-area",
    ],
    pathwayGroups: [
      { id: "construction-energy-sustainable-infrastructure-area", label: "Construction, Energy & Sustainable Infrastructure", suggestedCourses: courses("CEE 422, CEE 424, CEE 433, CEE 434, CEE 435, CEE 450, CEE 454, CEE 498") },
      { id: "environmental-engineering-area", label: "Environmental Engineering", suggestedCourses: courses("CEE 437, CEE 459, CEE 462, CEE 465, CEE 467, CEE 480, CEE 481, CEE 482, CEE 483, CEE 498") },
      { id: "geotechnical-engineering-area", label: "Geotechnical Engineering", suggestedCourses: courses("CEE 436") },
      { id: "hydrology-hydrodynamics-water-area", label: "Hydrology/Hydrodynamics (Water)", suggestedCourses: courses("CEE 432, CEE 437, CEE 459, CEE 465, CEE 467, CEE 473, CEE 475, CEE 476, CEE 477, CEE 478, CEE 480, CEE 481, CEE 498") },
      { id: "structural-engineering-area", label: "Structural Engineering", suggestedCourses: courses("CEE 378, CEE 433, CEE 451, CEE 452, CEE 453, CEE 454, CEE 457") },
      { id: "transportation-engineering-area", label: "Transportation Engineering", suggestedCourses: courses("CEE 410, CEE 412, CEE 415, CEE 416, CEE 419, CEE 422") },
    ],
    requiredCourseCodes: unique([
      ...seattleCivilPrerequisiteCourses,
      ...seattleCivilCoreCourses,
      ...seattleCivilTechnicalElectiveCourses,
    ]),
    optionGroups: [
      { id: "seattle-civil-differential-equations", label: "MATH 207 or AMATH 351", options: [["MATH 207"], ["AMATH 351"]] },
      { id: "seattle-civil-matrix-linear-algebra", label: "MATH 208 or AMATH 352", options: [["MATH 208"], ["AMATH 352"]] },
      { id: "seattle-civil-statistics", label: "INDE 315, QSCI 381, STAT 390 or STAT 290", options: [["INDE 315"], ["QSCI 381"], ["STAT 390"], ["STAT 290"]] },
      { id: "seattle-civil-basic-science-elective", label: "Basic Science Elective", options: courses("BIOL 180, ATMS 101, ATMS 211, ATMS 212, ESRM 100, ESRM 101, ESRM 210, ESS 101, ESS 106, ESS 201, ESS 211, ESS 212, OCEAN 102, OCEAN 200").map((courseCode) => [courseCode]) },
      { id: "seattle-civil-computer-programming", label: "Computer Programming", options: courses("AMATH 301, CSE 121, CSE 122, CSE 123, CSE 142, CSE 160").map((courseCode) => [courseCode]) },
      { id: "seattle-civil-cee-topic-requirement", label: "CEE Topic Requirement", options: courses("INDE 250, ECON 200, ECON 201, ESRM 235, ECON 235, ENVIR 235").map((courseCode) => [courseCode]) },
      { id: "seattle-civil-capstone", label: "Capstone Design Course", options: courses("CEE 441, CEE 442, CEE 444, CEE 445").map((courseCode) => [courseCode]) },
    ],
    courseBuckets: [
      { id: "seattle-civil-mathematics", label: "Mathematics", minCredits: 24, courseCodes: courses("MATH 124, MATH 125, MATH 126, MATH 207, AMATH 351, MATH 208, AMATH 352, INDE 315, QSCI 381, STAT 390, STAT 290") },
      { id: "seattle-civil-sciences", label: "Sciences", minCredits: 28, courseCodes: courses("CHEM 142, CHEM 152, PHYS 121, PHYS 122, PHYS 123, BIOL 180, ATMS 101, ATMS 211, ATMS 212, ESRM 100, ESRM 101, ESRM 210, ESS 101, ESS 106, ESS 201, ESS 211, ESS 212, OCEAN 102, OCEAN 200") },
      { id: "seattle-civil-engineering-fundamentals", label: "Engineering Fundamentals", minCredits: 16, courseCodes: courses("AMATH 301, CSE 121, CSE 122, CSE 123, CSE 142, CSE 160, AA 210, CEE 220, ME 230") },
      { id: "seattle-civil-core", label: "Core Curriculum", minCredits: 40, courseCodes: seattleCivilCoreCourses },
      { id: "seattle-civil-capstone-professional-practice", label: "Capstone & Professional Practice", minCredits: 7, courseCodes: courses("CEE 440, CEE 441, CEE 442, CEE 444, CEE 445") },
      { id: "seattle-civil-technical-electives", label: "Technical Electives", minCredits: 15, courseCodes: seattleCivilTechnicalElectiveCourses, openEndedRules: ["Students must take 3cr from 3 of 6 areas"] },
      { id: "seattle-civil-engineering-science-electives", label: "Engineering & Science Electives", minCredits: 12, courseCodes: seattleCivilTechnicalElectiveCourses },
    ],
    genEdRequirements: [
      "Written Communication (12 credits)",
      "Economics (4-5 credits)",
      "Areas of Inquiry (24 credits)",
      "Arts and Humanities (A&H) 10cr",
      "Social Sciences (SSc) 10cr",
      "Additional A&H and/or SSc 4cr",
      "Diversity (5 credit minimum)",
      "Additional credits to meet the 180 total required for the BSCE degree",
      "Jr. Track 1 - Academic Year 2025-2026 only",
      "Jr. Track 2 - Academic Year 2025-2026 only",
    ],
    requirementLabels: [
      "Bachelor of Science in Civil Engineering",
      "BSCE Major Coursework",
      "Core Curriculum",
      "Capstone & Professional Practice",
      "Technical Electives",
      "Engineering & Science Electives",
      "Construction, Energy & Sustainable Infrastructure",
      "Environmental Engineering",
      "Geotechnical Engineering",
      "Hydrology/Hydrodynamics (Water)",
      "Structural Engineering",
      "Transportation Engineering",
    ],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-environmental-engineering",
    title: "Environmental Engineering",
    officialSources: [
      "https://www.ce.washington.edu/sites/default/files/pdfs/current/undergrad/uw-cee-bsenve-degree-sheet.pdf",
    ],
    expectedPathwayIds: [
      "engineered-systems-and-processes-area",
      "natural-systems-and-processes-area",
      "hydrology-hydrodynamics-area",
      "general-topics-area",
      "study-abroad-area",
    ],
    pathwayGroups: [
      { id: "engineered-systems-and-processes-area", label: "Engineered Systems and Processes", suggestedCourses: courses("CEE 482, CEE 483, CEE 490, CEE 498") },
      { id: "natural-systems-and-processes-area", label: "Natural Systems and Processes", suggestedCourses: courses("CEE 432, CEE 437, CEE 462, CEE 463, CEE 465, CEE 467, CEE 480, CEE 498") },
      { id: "hydrology-hydrodynamics-area", label: "Hydrology & Hydrodynamics", suggestedCourses: courses("CEE 473, CEE 474, CEE 475, CEE 476, CEE 477, CEE 478, CEE 481, CEE 498") },
      { id: "general-topics-area", label: "General Topics", suggestedCourses: courses("CEE 401, CEE 402, CEE 415, CEE 424, CEE 450, CEE 498") },
      { id: "study-abroad-area", label: "Study Abroad", suggestedCourses: courses("CEE 497, CEE 498, CEE 499") },
    ],
    requiredCourseCodes: unique([
      ...seattleEnvironmentalPrerequisiteCourses,
      ...seattleEnvironmentalCoreCourses,
      ...seattleEnvironmentalTechnicalElectiveCourses,
    ]),
    optionGroups: [
      { id: "seattle-enve-differential-equations", label: "AMATH 351 or MATH 207", options: [["AMATH 351"], ["MATH 207"]] },
      { id: "seattle-enve-matrix-linear-algebra", label: "AMATH 352 or MATH 208", options: [["AMATH 352"], ["MATH 208"]] },
      { id: "seattle-enve-statistics", label: "INDE 315, Q SCI 381, STAT 390 or STAT 290", options: [["INDE 315"], ["QSCI 381"], ["STAT 390"], ["STAT 290"]] },
      { id: "seattle-enve-earth-science-elective", label: "Earth science elective", options: courses("ATMS 101, ATMS 211, ATMS 212, ESRM 100, ESRM 101, ESRM 210, ESS 106, ESS 201, ESS 211, ESS 212, NUTR 200, OCEAN 102, OCEAN 200").map((courseCode) => [courseCode]) },
      { id: "seattle-enve-computer-programming", label: "Computer Programming", options: courses("AMATH 301, CSE 121, CSE 122, CSE 123, CSE 142, CSE 160").map((courseCode) => [courseCode]) },
      { id: "seattle-enve-thermodynamics", label: "Thermodynamics", options: [["AA 260"], ["ME 323"], ["PHYS 224"]] },
      { id: "seattle-enve-cee-topic-requirement", label: "CEE Topic Requirement", options: courses("INDE 250, ECON 200, ECON 201, ESRM 235, ECON 235, ENVIR 235").map((courseCode) => [courseCode]) },
      { id: "seattle-enve-capstone", label: "Capstone Design Course", options: [["CEE 444"], ["CEE 445"]] },
    ],
    courseBuckets: [
      { id: "seattle-enve-mathematics", label: "Mathematics", minCredits: 24, maxCredits: 25, courseCodes: courses("MATH 124, MATH 125, MATH 126, AMATH 351, MATH 207, AMATH 352, MATH 208, INDE 315, QSCI 381, STAT 390, STAT 290") },
      { id: "seattle-enve-sciences", label: "Sciences", minCredits: 35, courseCodes: courses("BIOL 180, CHEM 142, CHEM 152, PHYS 121, PHYS 122, ATMS 101, ATMS 211, ATMS 212, ESRM 100, ESRM 101, ESRM 210, ESS 106, ESS 201, ESS 211, ESS 212, NUTR 200, OCEAN 102, OCEAN 200") },
      { id: "seattle-enve-engineering-fundamentals", label: "Engineering Fundamentals", minCredits: 12, courseCodes: courses("AMATH 301, CSE 121, CSE 122, CSE 123, CSE 142, CSE 160, AA 210, AA 260, ME 323, PHYS 224") },
      { id: "seattle-enve-core", label: "Core Curriculum", minCredits: 30, courseCodes: seattleEnvironmentalCoreCourses },
      { id: "seattle-enve-capstone-professional-practice", label: "Capstone and Professional Practice", minCredits: 7, courseCodes: courses("CEE 440, CEE 444, CEE 445") },
      { id: "seattle-enve-technical-electives", label: "Technical Electives", minCredits: 15, courseCodes: seattleEnvironmentalTechnicalElectiveCourses },
      { id: "seattle-enve-engineering-science-electives", label: "Engineering and Science Elective", minCredits: 13, courseCodes: courses("CHEM 162, PHYS 123, CEE 220") },
    ],
    genEdRequirements: [
      "Written Communication (12 credits)",
      "Economics (4-5 credits)",
      "Areas of Inquiry (24 credits)",
      "Arts & Humanities (A&H) 10cr",
      "Social Sciences (SSc) 10cr",
      "Additional A&H and/or SSc 4cr",
      "Diversity (5 credit minimum)",
      "Additional credits to meet the 180 total required for the BSENVE degree",
      "CHEM 162, PHYS 123, and CEE 220 will all count as E&S electives",
    ],
    requirementLabels: [
      "Bachelor of Science in Environmental Engineering",
      "BSENVE Major Coursework",
      "Core Curriculum",
      "Capstone and Professional Practice",
      "Technical Electives",
      "Engineering & Science Electives",
      "Engineered Systems and Processes",
      "Natural Systems and Processes",
      "Hydrology & Hydrodynamics",
      "General Topics",
      "Study Abroad",
    ],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-civil-engineering",
    title: "Civil Engineering",
    officialSources: [
      "https://www.tacoma.uw.edu/set/programs/undergrad/civil",
    ],
    expectedPathwayIds: [
      "four-year-schedule-planning",
      "five-year-schedule-planning",
      "geotechnical-specialization",
      "structures-specialization",
      "transportation-specialization",
      "environmental-specialization",
    ],
    pathwayGroups: [
      { id: "four-year-schedule-planning", label: "4-Year Schedule Planning", suggestedCourses: unique([...tacomaCivilPrerequisiteCourses, ...tacomaCivilRequiredCourses, ...tacomaCivilSeniorElectiveCourses]) },
      { id: "five-year-schedule-planning", label: "5-Year Schedule Planning", suggestedCourses: unique([...tacomaCivilPrerequisiteCourses, ...tacomaCivilRequiredCourses, ...tacomaCivilSeniorElectiveCourses]) },
      { id: "geotechnical-specialization", label: "Geotechnical", suggestedCourses: courses("TCE 426") },
      { id: "structures-specialization", label: "Structures", suggestedCourses: courses("TCE 429, TCE 451, TCE 452") },
      { id: "transportation-specialization", label: "Transportation", suggestedCourses: courses("TCE 411, TCE 416, TCE 417") },
      { id: "environmental-specialization", label: "Environmental", suggestedCourses: courses("TCE 480, TCE 482, TCE 484") },
    ],
    requiredCourseCodes: unique([
      ...tacomaCivilPrerequisiteCourses,
      ...tacomaCivilRequiredCourses,
      ...tacomaCivilSeniorElectiveCourses,
    ]),
    optionGroups: [
      { id: "tacoma-civil-statics", label: "Statics", options: [["TME 221"], ["AA 210"]] },
      { id: "tacoma-civil-mechanics-materials", label: "Mechanics of Materials", options: [["TME 222"], ["CEE 220"]] },
      { id: "tacoma-civil-dynamics", label: "Dynamics", options: [["TME 223"], ["ME 230"]] },
      { id: "tacoma-civil-programming", label: "5 credits of computer programming", options: [["AMATH 301"]] },
      { id: "tacoma-civil-senior-electives", label: "Senior Electives", options: tacomaCivilSeniorElectiveCourses.map((courseCode) => [courseCode]) },
    ],
    courseBuckets: [
      { id: "tacoma-civil-prerequisites", label: "Prerequisites", courseCodes: tacomaCivilPrerequisiteCourses, openEndedRules: ["All prerequisite courses must be completed in the last seven years"] },
      { id: "tacoma-civil-required-courses", label: "Civil Engineering Required Courses", minCredits: 84, courseCodes: tacomaCivilRequiredCourses },
      { id: "tacoma-civil-senior-electives", label: "Senior Electives", minCredits: 16, courseCodes: tacomaCivilSeniorElectiveCourses, openEndedRules: ["Electives must be taken from at least two of the specializations"] },
    ],
    genEdRequirements: [
      "A total of 180 quarter credits are required",
      "At least 45 of the final 60 credits must be taken in residence at UW Tacoma",
      "A minimum of 30 credits of required courses for the B.S. CE major must also be taken in residence at UW Tacoma",
      "At least 84 credits must be taken from the CE required courses below and CE Senior Electives list",
      "Cumulative prerequisite GPA of at least 2.5",
      "minimum grade of 2.0 in each individual prerequisite course",
      "Minimum cumulative GPA of 2.0 in all college coursework",
      "Completion of at least 45 college-level credits",
    ],
    requirementLabels: [
      "B.S. in Civil Engineering",
      "Practice-Based Engineering, Innovation and Professional Development",
      "Civil Engineering Required Courses",
      "4-Year Schedule Planning",
      "5-Year Schedule Planning",
      "Senior Electives",
      "Geotechnical",
      "Structures",
      "Transportation",
      "Environmental",
      "ABET accreditation",
    ],
  },
];

module.exports = {
  civilEnvironmentalEngineeringPrograms,
};
