function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function courses(value) {
  return String(value)
    .split(",")
    .map((courseCode) => courseCode.trim())
    .filter(Boolean);
}

function singleOptions(courseCodes) {
  return courseCodes.map((courseCode) => [courseCode]);
}

const seattleEnvironmentalPublicHealthSupportingScienceCourses = courses(`
  MATH 111, MATH 120, BIOL 180, BIOL 200, BIOL 220, PHYS 114, PHYS 117,
  CHEM 142, CHEM 152, CHEM 162, CHEM 220, CHEM 223, CHEM 224, CHEM 237,
  CHEM 238, CHEM 241, BIOST 310, STAT 220, STAT 311, QSCI 381
`);

const seattleEnvironmentalPublicHealthCoreCourses = courses(`
  ENVH 311, ENVH 312, ENVH 320, ENVH 405, ENVH 432, ENVH 433, ENVH 472,
  ENVH 473, ENVH 480, ENVH 482, EPI 320, MICROM 301, MICROM 302
`);

const seattleEnvironmentalPublicHealthSelectiveCourses = courses(`
  ENVH 306, ENVH 406, ENVH 409, ENVH 417, ENVH 418, GH 418, ENVH 439,
  ENVH 440, ENVH 441, ENVH 442, ENVH 443, ENVH 444, ENVH 445, ENVH 447,
  ENVH 448, ENVH 451, ENVH 452, ENVH 453, ENVH 460, ENVH 462, ENVH 465,
  ENVH 475, ENVH 478, ENVH 479, ENVH 538
`);

const seattleEnvironmentalPublicHealthCurrentElectiveCourses = courses(`
  ENVH 111, ENVH 205, ENVH 400
`);

const seattlePhGhAdmissionCourses = courses(`
  ENGL 131, ENVH 111, EPI 201, EPI 220, GH 101, HSERV 100, NUTR 200,
  PHG 200, BIOL 118, BIOL 180, BIOL 200, BIOL 220, MICROM 301,
  MICROM 302, CHEM 120, CHEM 142, CHEM 145, CHEM 152, CHEM 162
`);

const seattlePhGhCoreCourses = courses(`
  SPH 380, SPH 381, SPH 480, SPH 481, BIOST 310, EPI 320, SPH 389,
  SPH 391, SPH 392, SPH 396, SPH 493
`);

const seattlePhGhGlobalHealthOptionCourses = courses(`
  GH 305, GH 401, GH 402
`);

const seattlePhGhHealthEducationOptionCourses = courses(`
  HSERV 100, HSERV 204, HSERV 343, HSERV 344, HSERV 345, SPH 495
`);

const seattlePhGhNutritionalSciencesOptionCourses = courses(`
  NUTR 302, NUTR 310, NUTR 400, NUTR 405, NUTR 406, NUTR 411,
  NUTR 412, NUTR 420, NUTR 465, NUTR 466
`);

const seattlePhGhCatalogCoverageCourses = courses(`
  SPH 399, SPH 489, SPH 490, SPH 491, SPH 492, SPH 494, SPH 496,
  SPH 497, SPH 499
`);

const bothellHealthStudiesCoreCourses = courses(`
  BHS 201, BHS 210, BHS 300, BHS 302, BHS 305, BHS 403, BHS 496
`);

const bothellHealthStudiesElectiveCourses = courses(`
  BBIO 180, BBIO 200, BBIO 220, BBIO 231, BBIO 232, BBIO 233, BBIO 310,
  BBIO 351, BBIO 352, BBIO 355, BBIO 360, BBIO 370, BBIO 372, BBIO 380,
  BBIO 383, BBIO 390, BBIO 470, BBIO 480, BCHEM 143, BCHEM 144,
  BCHEM 153, BCHEM 154, BCHEM 163, BCHEM 164, BCHEM 237, BCHEM 238,
  BCHEM 239, BCHEM 241, BCHEM 242, BCHEM 312, BCHEM 364, BCHEM 365,
  BCHEM 375, BEARTH 320, BEARTH 341, BEDUC 220, BEDUC 230, BEDUC 402,
  BEDUC 456, BEDUC 460, BEDUC 470, BEDUC 481, BHLTH 179, BHLTH 196,
  BHLTH 197, BHLTH 198, BHLTH 199, BHLTH 200, BHLTH 201, BHLTH 216,
  BHLTH 217, BHLTH 218, BHLTH 219, BHLTH 220, BHLTH 221, BHLTH 222,
  BHLTH 223, BHLTH 224, BHLTH 225, BHLTH 226, BHLTH 227, BHLTH 228,
  BHLTH 229, BHLTH 297, BHLTH 298, BHLTH 301, BHLTH 320, BHLTH 397,
  BHLTH 400, BHLTH 401, BHLTH 402, BHLTH 404, BHLTH 405, BHLTH 406,
  BHLTH 407, BHLTH 408, BHLTH 410, BHLTH 411, BHLTH 412, BHLTH 413,
  BHLTH 414, BHLTH 420, BHLTH 421, BHLTH 422, BHLTH 423, BHLTH 424,
  BHLTH 425, BHLTH 426, BHLTH 427, BHLTH 428, BHLTH 429, BHLTH 430,
  BHLTH 431, BHLTH 435, BHLTH 436, BHLTH 437, BHLTH 438, BHLTH 439,
  BHLTH 440, BHLTH 441, BHLTH 442, BHLTH 443, BHLTH 444, BHLTH 460,
  BHLTH 491, BHLTH 492, BHLTH 493, BHLTH 494, BHLTH 497, BHLTH 498,
  BHLTH 499, BHS 201, BHS 210, BHS 300, BHS 302, BHS 305, BHS 403,
  BHS 496, BIS 170, BIS 215, BIS 220, BIS 221, BIS 222, BIS 225,
  BIS 226, BIS 242, BIS 265, BIS 270, BIS 307, BIS 310, BIS 318,
  BIS 349, BIS 352, BIS 353, BIS 355, BIS 364, BIS 369, BIS 380,
  BIS 384, BIS 386, BIS 415, BIS 418, BIS 448, BIS 468, BISAES 305,
  BISGWS 301, BISGWS 302, BISGWS 303, BISLEP 301, BISPSY 337,
  BISPSY 343, BISPSY 350, BISSTS 231, BISSTS 307, BISSTS 420,
  BBUS 215, BHLTH 215, ENGL 131, MATH 215, STAT 220, THLTH 285,
  THLTH 355, THLTH 440, GH 101, HSERV 343, MICROM 301, NUTR 200
`);

const tacomaHealthcareLeadershipPlanCourses = courses(`
  THLTH 310, THLTH 320, THLTH 440, THLEAD 350, THLEAD 360, THLEAD 380,
  THLEAD 403, THLEAD 405, THLEAD 406, THLEAD 420, THLEAD 460, THLEAD 480
`);

const tacomaHealthcareLeadershipCatalogCourses = courses(`
  THLEAD 310, THLEAD 350, THLEAD 360, THLEAD 380, THLEAD 403, THLEAD 405,
  THLEAD 406, THLEAD 407, THLEAD 410, THLEAD 415, THLEAD 420, THLEAD 430,
  THLEAD 460, THLEAD 480, THLEAD 496, THLTH 215, THLTH 285, THLTH 290,
  THLTH 310, THLTH 320, THLTH 325, THLTH 330, THLTH 340, THLTH 355,
  THLTH 372, THLTH 405, THLTH 410, THLTH 412, THLTH 415, THLTH 420,
  THLTH 430, THLTH 440, THLTH 455, THLTH 465, THLTH 470, THLTH 475,
  THLTH 480, THLTH 485, THLTH 490, THLTH 498, THLTH 499
`);

const publicHealthPrograms = [
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-environmental-public-health",
    title: "Environmental Public Health",
    officialSources: [
      "https://www.deohs.washington.edu/degree-requirements",
      "https://www.washington.edu/students/crscat/envh.html",
    ],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: unique([
      ...seattleEnvironmentalPublicHealthSupportingScienceCourses,
      ...seattleEnvironmentalPublicHealthCoreCourses,
      ...seattleEnvironmentalPublicHealthSelectiveCourses,
      ...seattleEnvironmentalPublicHealthCurrentElectiveCourses,
    ]),
    optionGroups: [
      { id: "seattle-eph-math", label: "MATH 111, MATH 120, or department approved math course", options: [["MATH 111"], ["MATH 120"]] },
      { id: "seattle-eph-chemistry", label: "general and organic chemistry sequences", options: [["CHEM 142", "CHEM 152", "CHEM 220"], ["CHEM 142", "CHEM 152", "CHEM 223", "CHEM 224", "CHEM 241"], ["CHEM 142", "CHEM 152", "CHEM 162", "CHEM 237", "CHEM 238", "CHEM 241"]] },
      { id: "seattle-eph-statistics", label: "BIOST 310, STAT 220, STAT 311, or Q SCI 381", options: [["BIOST 310"], ["STAT 220"], ["STAT 311"], ["QSCI 381"]] },
      { id: "seattle-eph-selectives", label: "Environmental Public Health Selectives", options: singleOptions(seattleEnvironmentalPublicHealthSelectiveCourses) },
    ],
    courseBuckets: [
      { id: "seattle-eph-supporting-science", label: "Supporting Science", courseCodes: seattleEnvironmentalPublicHealthSupportingScienceCourses },
      { id: "seattle-eph-core", label: "Environmental Public Health Core", courseCodes: seattleEnvironmentalPublicHealthCoreCourses },
      { id: "seattle-eph-selectives", label: "Environmental Public Health Selectives", minCredits: 9, courseCodes: seattleEnvironmentalPublicHealthSelectiveCourses, openEndedRules: ["choose a minimum of 3 of the following courses", "students who entered before Winter 2026 choose a minimum of 4"] },
      { id: "seattle-eph-electives", label: "Environmental Public Health Electives", minCredits: 15, courseCodes: seattleEnvironmentalPublicHealthCurrentElectiveCourses, openEndedRules: ["15 Credits from approved elective list"] },
      { id: "seattle-eph-internship", label: "Environmental Health Internship", courseCodes: ["ENVH 482"], openEndedRules: ["400 hour required internship"] },
    ],
    genEdRequirements: [
      "Bachelor of Science in Environmental Public Health",
      "All courses must be completed with a minimum grade of 2.0",
      "School of Public Health general education requirements",
      "15 Credits from approved elective list",
      "400 hour required internship",
    ],
    requirementLabels: [
      "Supporting Science",
      "Environmental Public Health Core",
      "Environmental Public Health Selectives",
      "Environmental Public Health Electives",
    ],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-public-health-global-health",
    title: "Public Health - Global Health",
    officialSources: [
      "https://sph.washington.edu/sites/default/files/2024-09/Public-Health-Global-Health-Major-OnePager-Purple-Curriculum-AUT2024.pdf",
      "https://www.washington.edu/students/crscat/sph.html",
    ],
    expectedPathwayIds: [
      "ba-option:global-health",
      "health-education-and-promotion-ba-option",
      "bs-option:global-health",
      "nutritional-sciences-bs-option",
    ],
    pathwayGroups: [
      { id: "ba-option:global-health", label: "Global Health (BA Option)", suggestedCourses: seattlePhGhGlobalHealthOptionCourses },
      { id: "health-education-and-promotion-ba-option", label: "Health Education & Promotion (BA Option)", suggestedCourses: seattlePhGhHealthEducationOptionCourses },
      { id: "bs-option:global-health", label: "Global Health (BS Option)", suggestedCourses: seattlePhGhGlobalHealthOptionCourses },
      { id: "nutritional-sciences-bs-option", label: "Nutritional Sciences (BS Option)", suggestedCourses: seattlePhGhNutritionalSciencesOptionCourses },
    ],
    requiredCourseCodes: unique([
      ...seattlePhGhAdmissionCourses,
      ...seattlePhGhCoreCourses,
      ...seattlePhGhGlobalHealthOptionCourses,
      ...seattlePhGhHealthEducationOptionCourses,
      ...seattlePhGhNutritionalSciencesOptionCourses,
      ...seattlePhGhCatalogCoverageCourses,
    ]),
    optionGroups: [
      { id: "seattle-phgh-degree-path", label: "Bachelor of Arts (BA) or Bachelor of Science (BS)", options: [] },
      { id: "seattle-phgh-intro-public-health", label: "one intro public health course", options: singleOptions(courses("ENVH 111, EPI 201, EPI 220, GH 101, HSERV 100, NUTR 200, PHG 200")) },
      { id: "seattle-phgh-integrated-core", label: "Integrated Core: Sequence", options: [["SPH 380", "SPH 381", "SPH 480", "SPH 481"]] },
      { id: "seattle-phgh-service-learning", label: "Public Health Service Learning", options: [["SPH 391", "SPH 392"], ["SPH 396"]] },
      { id: "seattle-phgh-options", label: "Pathway Options", options: [seattlePhGhGlobalHealthOptionCourses, seattlePhGhHealthEducationOptionCourses, seattlePhGhNutritionalSciencesOptionCourses] },
    ],
    courseBuckets: [
      { id: "seattle-phgh-admission", label: "Upper Division Admission", courseCodes: seattlePhGhAdmissionCourses },
      { id: "seattle-phgh-foundations-core-portfolio", label: "PH-GH Foundations, Core, and Portfolio", minCredits: 42, courseCodes: seattlePhGhCoreCourses },
      { id: "seattle-phgh-global-health", label: "Global Health Option", minCredits: 20, courseCodes: seattlePhGhGlobalHealthOptionCourses, openEndedRules: ["300 & 400 level G H Prefix courses", "300 & 400 level courses"] },
      { id: "seattle-phgh-health-education", label: "Health Education & Promotion Option", minCredits: 20, courseCodes: seattlePhGhHealthEducationOptionCourses },
      { id: "seattle-phgh-nutritional-sciences", label: "Nutritional Sciences Option", minCredits: 20, courseCodes: seattlePhGhNutritionalSciencesOptionCourses },
      { id: "seattle-phgh-catalog", label: "School of Public Health Catalog Coverage", courseCodes: seattlePhGhCatalogCoverageCourses },
    ],
    genEdRequirements: [
      "Bachelor of Arts",
      "Bachelor of Science",
      "116 cr",
      "138 cr",
      "School of Public Health",
      "Minimum 60 college credits",
      "Min. 2.5 Cumulative GPA",
      "Min. grade of 2.0 in 5 credits of English composition",
      "Min. grade of 2.5 in one intro public health course",
      "Degree Requirements Effective AUT 2024",
    ],
    requirementLabels: [
      "PH-GH Pathways",
      "Pathway Options",
      "Global Health",
      "Health Education & Promotion",
      "Nutritional Sciences",
      "Integrated Core",
      "Public Health Foundation",
      "Structural Racism",
      "Public Health Service Learning",
      "Public Health Portfolio",
    ],
  },
  {
    campusId: "uw-bothell",
    planId: "uw-bothell-health-studies",
    title: "Health Studies (BA)",
    officialSources: [
      "https://www.uwb.edu/nhs/undergraduate/health-studies/overview",
      "https://www.uwb.edu/nhs/undergraduate/health-studies/overview/hs-electives",
      "https://www.washington.edu/students/crscatb/bhlth.html",
      "https://www.washington.edu/students/crscatb/bhs.html",
    ],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: unique([
      ...bothellHealthStudiesCoreCourses,
      ...bothellHealthStudiesElectiveCourses,
    ]),
    optionGroups: [
      { id: "bothell-health-life-sciences", label: "Health & Life Sciences", options: singleOptions(courses("BBIO 180, BBIO 200, BBIO 220, BBIO 231, BBIO 232, BBIO 233, BHLTH 428, BISPSY 337, BISSTS 231")) },
      { id: "bothell-community-health", label: "Community Health Intervention & Practice", options: singleOptions(courses("BHLTH 430, BHLTH 431, BHLTH 435, BHLTH 436, BHLTH 437, BHLTH 438, BHLTH 439, BHLTH 440, BHLTH 441, BHLTH 442, BHLTH 443, BHLTH 444")) },
      { id: "bothell-health-society", label: "Health & Society", options: singleOptions(courses("BIS 170, BIS 220, BIS 221, BIS 222, BIS 225, BIS 226, BISGWS 301, BISGWS 302, BISGWS 303, BISPSY 343, BISPSY 350, BISSTS 420")) },
      { id: "bothell-health-policy-leadership-ethics", label: "Health Policy, Leadership, & Ethics", options: singleOptions(courses("BISLEP 301, BISSTS 307, BEDUC 220, BEDUC 460, BHLTH 460")) },
    ],
    courseBuckets: [
      { id: "bothell-health-statistics", label: "Statistics", minCredits: 5, courseCodes: ["BBUS 215", "BIS 215", "MATH 215", "STAT 220"] },
      { id: "bothell-health-core", label: "Required Core Courses", minCredits: 35, courseCodes: bothellHealthStudiesCoreCourses },
      { id: "bothell-health-electives", label: "Approved Health Studies Electives", minCredits: 35, courseCodes: bothellHealthStudiesElectiveCourses, openEndedRules: ["at least 10 credits in B HLTH course offerings"] },
      { id: "bothell-health-upper-division", label: "Upper Division UW Electives", minCredits: 15, courseCodes: [], openEndedRules: ["300-400 level"] },
    ],
    genEdRequirements: [
      "Health Studies (BA) Major Checklist",
      "90 credits",
      "Approved Health Studies Electives",
      "at least 10 credits in B HLTH course offerings",
      "Upper Division UW Electives",
      "Health & Life Sciences",
      "Community Health Intervention & Practice",
      "Health & Society",
      "Health Policy, Leadership, & Ethics",
    ],
    requirementLabels: [
      "Introduction to Public Health",
      "Community Health Promotion & Communication",
      "Principles of Health Research",
      "Social Dimensions of Health",
      "Introduction to Healthcare Policy & Systems",
      "Introduction to Epidemiology",
      "Fieldwork in Health",
    ],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-healthcare-leadership",
    title: "Healthcare Leadership (BA)",
    officialSources: [
      "https://www.tacoma.uw.edu/nursing/healthcare-leadership-sample-program-plan",
      "https://www.washington.edu/students/crscatt/thlead.html",
      "https://www.washington.edu/students/crscatt/thlth.html",
    ],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: unique([
      ...tacomaHealthcareLeadershipPlanCourses,
      ...tacomaHealthcareLeadershipCatalogCourses,
    ]),
    optionGroups: [
      { id: "tacoma-hcl-autumn-one", label: "Autumn", options: [["THLTH 440", "THLEAD 350", "THLEAD 360"]] },
      { id: "tacoma-hcl-winter-one", label: "Winter", options: [["THLTH 310", "THLEAD 403", "THLEAD 460"]] },
      { id: "tacoma-hcl-spring-one", label: "Spring", options: [["THLTH 320", "THLEAD 380"]] },
      { id: "tacoma-hcl-catalog", label: "THLEAD and T HLTH course descriptions", options: [tacomaHealthcareLeadershipCatalogCourses] },
    ],
    courseBuckets: [
      { id: "tacoma-hcl-sample-plan", label: "standard curriculum plan", minCredits: 90, courseCodes: tacomaHealthcareLeadershipPlanCourses },
      { id: "tacoma-hcl-healthcare-leadership-catalog", label: "THLEAD course descriptions", courseCodes: tacomaHealthcareLeadershipCatalogCourses.filter((code) => code.startsWith("THLEAD ")) },
      { id: "tacoma-hcl-health-catalog", label: "T HLTH course descriptions", courseCodes: tacomaHealthcareLeadershipCatalogCourses.filter((code) => code.startsWith("THLTH ")) },
      { id: "tacoma-hcl-electives", label: "UWT Elective Course", minCredits: 30, courseCodes: [], openEndedRules: ["T ELEC 1", "T ELEC 2", "T ELEC 3", "T ELEC 4", "T ELEC 5", "T ELEC 6"] },
    ],
    genEdRequirements: [
      "Bachelor of Arts in Healthcare Leadership",
      "standard curriculum plan",
      "timely graduation",
      "Total Credits 90",
      "UWT Elective Course",
    ],
    requirementLabels: [
      "Healthcare Leadership Sample Program Plan",
      "Business of Healthcare",
      "Critical Analysis and Writing",
      "Healthcare Leadership Strategies",
      "Healthcare Leadership Fieldwork",
    ],
  },
];

module.exports = {
  publicHealthPrograms,
};
