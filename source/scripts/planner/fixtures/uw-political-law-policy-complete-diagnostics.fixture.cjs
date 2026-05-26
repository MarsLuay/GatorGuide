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

const seattlePoliticalScienceIntroCourses = courses(`
  POLS 101, POLS 201, POLS 202, POLS 203, POLS 204
`);

const seattlePoliticalScienceUndergraduateCatalogCourses = courses(`
  POLS 101, POLS 195, POLS 201, POLS 202, POLS 203, POLS 204, POLS 212,
  POLS 213, POLS 217, POLS 220, POLS 246, POLS 249, POLS 270, POLS 273,
  POLS 281, POLS 295, POLS 299, POLS 301, POLS 302, POLS 303, POLS 304,
  POLS 306, POLS 307, POLS 308, POLS 309, POLS 310, POLS 312, POLS 313,
  POLS 315, POLS 316, POLS 317, POLS 318, POLS 319, POLS 320, POLS 321,
  POLS 322, POLS 324, POLS 325, POLS 326, POLS 327, POLS 328, POLS 329,
  POLS 330, POLS 331, POLS 332, POLS 333, POLS 334, POLS 335, POLS 336,
  POLS 337, POLS 338, POLS 340, POLS 341, POLS 342, POLS 343, POLS 346,
  POLS 347, POLS 348, POLS 349, POLS 350, POLS 351, POLS 352, POLS 353,
  POLS 354, POLS 355, POLS 356, POLS 357, POLS 358, POLS 359, POLS 360,
  POLS 361, POLS 362, POLS 363, POLS 364, POLS 365, POLS 367, POLS 368,
  POLS 369, POLS 370, POLS 371, POLS 373, POLS 380, POLS 381, POLS 382,
  POLS 383, POLS 384, POLS 385, POLS 389, POLS 390, POLS 391, POLS 395,
  POLS 401, POLS 402, POLS 403, POLS 405, POLS 406, POLS 407, POLS 409,
  POLS 410, POLS 412, POLS 413, POLS 414, POLS 415, POLS 416, POLS 417,
  POLS 418, POLS 419, POLS 420, POLS 422, POLS 423, POLS 424, POLS 425,
  POLS 426, POLS 427, POLS 428, POLS 429, POLS 430, POLS 431, POLS 432,
  POLS 434, POLS 435, POLS 436, POLS 437, POLS 439, POLS 440, POLS 441,
  POLS 442, POLS 445, POLS 447, POLS 448, POLS 450, POLS 451, POLS 452,
  POLS 454, POLS 456, POLS 457, POLS 458, POLS 460, POLS 461, POLS 462,
  POLS 463, POLS 464, POLS 465, POLS 467, POLS 468, POLS 469, POLS 470,
  POLS 472, POLS 474, POLS 475, POLS 476, POLS 477, POLS 479, POLS 480,
  POLS 486, POLS 487, POLS 488, POLS 489, POLS 495, POLS 496, POLS 497,
  POLS 498, POLS 499
`);

const seattlePoliticalScienceOptionCourses = courses(`
  POLS 210, POLS 489, POLS 496, POLS 497, POLS 498, POLS 499
`);

const seattlePublicServicePolicyCatalogCourses = courses(`
  PUBPOL 101, PUBPOL 201, PUBPOL 299, PUBPOL 301, PUBPOL 302, PUBPOL 303,
  PUBPOL 313, PUBPOL 321, PUBPOL 322, PUBPOL 323, PUBPOL 330, PUBPOL 350,
  PUBPOL 355, PUBPOL 390, PUBPOL 391, PUBPOL 392, PUBPOL 400, PUBPOL 402,
  PUBPOL 403, PUBPOL 407, PUBPOL 480, PUBPOL 481, PUBPOL 491, PUBPOL 496,
  PUBPOL 497, PUBPOL 498, PUBPOL 499
`);

const seattlePublicServicePolicyFoundationCourses = courses(`
  PUBPOL 201, PUBPOL 301, PUBPOL 302, PUBPOL 303, PUBPOL 313, PUBPOL 321,
  PUBPOL 402, PUBPOL 403, PUBPOL 496
`);

const seattlePublicServicePolicyStatisticsCourses = courses(`
  QMETH 201, QSCI 381, SOC 221, STAT 220, STAT 221, STAT 290, STAT 311
`);

const seattleLsjCatalogCourses = courses(`
  LSJ 200, LSJ 230, LSJ 300, LSJ 301, LSJ 310, LSJ 320, LSJ 321, LSJ 322,
  LSJ 326, LSJ 327, LSJ 329, LSJ 331, LSJ 332, LSJ 345, LSJ 346, LSJ 347,
  LSJ 348, LSJ 360, LSJ 361, LSJ 363, LSJ 366, LSJ 367, LSJ 369, LSJ 370,
  LSJ 375, LSJ 376, LSJ 377, LSJ 378, LSJ 380, LSJ 381, LSJ 395, LSJ 401,
  LSJ 410, LSJ 412, LSJ 413, LSJ 415, LSJ 416, LSJ 420, LSJ 421, LSJ 422,
  LSJ 425, LSJ 426, LSJ 427, LSJ 428, LSJ 429, LSJ 430, LSJ 431, LSJ 433,
  LSJ 434, LSJ 437, LSJ 438, LSJ 444, LSJ 456, LSJ 460, LSJ 467, LSJ 468,
  LSJ 469, LSJ 474, LSJ 476, LSJ 478, LSJ 480, LSJ 488, LSJ 489, LSJ 490,
  LSJ 491, LSJ 495, LSJ 499
`);

const seattleLsjGoldApprovedCourses = courses(`
  AIS 306, AIS 308, AIS 330, AIS 335, AIS 380, AIS 385, ANTH 323, ANTH 497,
  ANTH 498, CHID 332, CHID 430, CHID 433, CHID 434, CHID 437, DISST 346,
  GWSS 310, GWSS 313, JSISA 324, JSISA 480, JSISB 310, JSISB 326, JSISB 366,
  JSISB 369, JSISB 370, JSISB 424, JSISB 441, LSJ 300, LSJ 320, LSJ 321,
  LSJ 322, LSJ 326, LSJ 329, LSJ 331, LSJ 345, LSJ 375, LSJ 377, LSJ 380,
  LSJ 381, LSJ 401, LSJ 410, LSJ 412, LSJ 413, LSJ 415, LSJ 416, LSJ 421,
  LSJ 422, LSJ 425, LSJ 426, LSJ 427, LSJ 428, LSJ 429, LSJ 431, LSJ 438,
  LSJ 460, LSJ 490, LSJ 491, LSJ 499, PHIL 314, PHIL 414, POLS 317,
  POLS 320, POLS 327, POLS 347, POLS 360, POLS 361, POLS 363, POLS 364,
  POLS 367, POLS 368, POLS 370, POLS 373, POLS 415, POLS 430, POLS 461,
  POLS 462, SOC 371, SOC 372, SOC 374, SOC 376, SOC 472, SOC 476
`);

const bothellLeppCourses = courses(`
  BBUS 215, BBUS 220, BBUS 221, BEARTH 155, BEDUC 328, BIS 175, BIS 180,
  BIS 183, BIS 200, BIS 201, BIS 203, BIS 215, BIS 219, BIS 226, BIS 227,
  BIS 234, BIS 249, BIS 252, BIS 255, BIS 279, BIS 280, BIS 282, BIS 284,
  BIS 293, BIS 304, BIS 307, BIS 310, BIS 312, BIS 314, BIS 316, BIS 326,
  BIS 327, BIS 335, BIS 336, BIS 338, BIS 339, BIS 340, BIS 341, BIS 342,
  BIS 343, BIS 349, BIS 352, BIS 353, BIS 359, BIS 365, BIS 367, BIS 374,
  BIS 380, BIS 384, BIS 386, BIS 392, BIS 393, BIS 394, BIS 396, BIS 403,
  BIS 406, BIS 408, BIS 410, BIS 414, BIS 415, BIS 416, BIS 421, BIS 441,
  BIS 442, BIS 443, BIS 447, BIS 448, BIS 456, BIS 458, BIS 459, BIS 466,
  BIS 468, BIS 483, BIS 490, BIS 491, BIS 493, BIS 495, BIS 497, BISAES 305,
  BISGST 303, BISGST 324, BISGST 397, BISGST 497, BISGWS 302, BISLEP 301,
  BISLEP 302, BISLEP 397, BISLEP 497, BMATH 215, BWRIT 133, BWRIT 134,
  BWRIT 135, ECON 200, ENGL 131, ENGL 141, POLS 202, STAT 220
`);

const bothellLeppCompositionCourses = courses(`
  BWRIT 133, BWRIT 134, BWRIT 135, ENGL 131, ENGL 141
`);

const bothellLeppStatisticsCourses = courses(`
  BIS 215, BBUS 215, BMATH 215, STAT 220
`);

const tacomaLawPolicyCourses = courses(`
  TCOM 454, TCOM 465, TCRIM 395, TCRIM 437, TECON 316, TECON 321, TECON 350,
  TECON 410, TECON 418, TECON 421, TECON 450, TECON 470, TESC 345, TLAW 150,
  TLAW 215, TLAW 320, TLAW 339, TLAW 345, TLAW 348, TLAW 361, TLAW 363,
  TLAW 367, TLAW 422, TLAW 423, TLAW 424, TLAW 438, TLAW 452, TLAW 465,
  TLAW 486, TLAW 496, TLIT 433, TPHIL 250, TPHIL 251, TPHIL 314, TPHIL 361,
  TPHIL 414, TPOLS 202, TPOLS 203, TPOLS 204, TPOLS 230, TPOLS 260,
  TPOLS 317, TPOLS 322, TPOLS 323, TPOLS 324, TPOLS 340, TPOLS 341,
  TPOLS 343, TPOLS 350, TPOLS 353, TPOLS 355, TPOLS 360, TPOLS 371,
  TPOLS 382, TPOLS 400, TPOLS 451, TPOLS 480, TPOLS 496, TPOLS 497,
  TSOC 465, TWRT 211
`);

const tacomaLawPolicyLawICourses = courses(`
  TLAW 150, TLAW 215
`);

const tacomaLawPolicyMethodsCourses = courses(`
  TPHIL 250, TPHIL 251, TWRT 211
`);

const tacomaPpeCoreCourses = courses(`
  TBECON 220, TBECON 221, TECON 200, TECON 201, TPHIL 101, TPHIL 240,
  TPHIL 250, TPHIL 251, TPOLS 201, TPOLS 202, TPOLS 203, TPOLS 204,
  TPOLS 260, TRELIG 321
`);

const tacomaPpePoliticsPhilosophyCourses = courses(`
  TGH 301, TGH 303, THIST 322, THIST 350, TLAW 320, TLAW 361, TLAW 424,
  TLAW 465, TPHIL 200, TPHIL 315, TPHIL 355, TPHIL 358, TPHIL 360, TPHIL 361,
  TPHIL 367, TPHIL 414, TPHIL 451, TPHIL 453, TPHIL 456, TPHIL 466,
  TPOLS 230, TPOLS 310, TPOLS 319, TPOLS 321, TPOLS 322, TPOLS 323,
  TPOLS 324, TPOLS 329, TPOLS 340, TPOLS 343, TPOLS 355, TPOLS 360,
  TPOLS 371, TPOLS 382, TPOLS 400, TRELIG 345, TRELIG 350, TRELIG 467
`);

const tacomaPpeEconomicsCourses = courses(`
  TBECON 420, TECON 210, TECON 316, TECON 320, TECON 325, TECON 350,
  TECON 360, TECON 362, TECON 370, TECON 410, TECON 418, TECON 421,
  TECON 430, TECON 441, TECON 450, TECON 470, TECON 480, TGEOG 349
`);

const tacomaPpeInternationalStudiesCourses = courses(`
  TECON 325, TECON 360, TECON 362, TECON 441, TEGL 435, TGEOG 349, TGH 301,
  TGH 303, THIST 271, THIST 350, THIST 365, THIST 457, THIST 464, THIST 465,
  THIST 466, THIST 475, THIST 484, TLAW 422, TLAW 423, TLAW 424, TPHIL 200,
  TPHIL 315, TPHIL 361, TPOLS 230, TPOLS 310, TPOLS 319, TPOLS 321,
  TPOLS 329, TPOLS 340, TPOLS 341, TPOLS 350, TPOLS 371, TPOLS 451,
  TRELIG 321, TRELIG 333, TRELIG 366, TSUD 444, TWOMN 420
`);

const tacomaPpeCapstoneCourses = courses(`
  TPOLS 480, TPOLS 496, TPOLS 497, TLAW 496
`);

const tacomaPpeCourses = unique([
  ...tacomaPpeCoreCourses,
  ...tacomaPpePoliticsPhilosophyCourses,
  ...tacomaPpeEconomicsCourses,
  ...tacomaPpeInternationalStudiesCourses,
  ...tacomaPpeCapstoneCourses,
]);

const politicalLawPolicyPrograms = [
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-political-science",
    title: "Political Science",
    officialSources: [
      "https://www.polisci.washington.edu/political-science-major-declaration-and-requirements",
      "https://www.washington.edu/students/crscat/pols.html",
    ],
    expectedPathwayIds: [
      "international-security-option",
      "political-economy-option",
    ],
    pathwayGroups: [
      { id: "international-security-option", label: "International Security Option", suggestedCourses: seattlePoliticalScienceOptionCourses },
      { id: "political-economy-option", label: "Political Economy Option", suggestedCourses: seattlePoliticalScienceOptionCourses },
    ],
    requiredCourseCodes: unique([
      ...seattlePoliticalScienceIntroCourses,
      ...seattlePoliticalScienceUndergraduateCatalogCourses,
    ]),
    optionGroups: [
      { id: "seattle-pols-introductory", label: "Three political science introductory courses chosen from POLS 101, POLS 201, POLS 202, POLS 203, or POLS 204", options: singleOptions(seattlePoliticalScienceIntroCourses) },
      { id: "seattle-pols-international-security-option", label: "International Security Option", options: [seattlePoliticalScienceOptionCourses] },
      { id: "seattle-pols-political-economy-option", label: "Political Economy Option", options: [seattlePoliticalScienceOptionCourses] },
    ],
    courseBuckets: [
      { id: "seattle-pols-intro", label: "Introductory Requirement", minCredits: 15, courseCodes: seattlePoliticalScienceIntroCourses },
      { id: "seattle-pols-distribution", label: "Major Distribution Requirement", minCredits: 15, courseCodes: seattlePoliticalScienceUndergraduateCatalogCourses, openEndedRules: ["One course numbered POLS 210 and above chosen from three of five fields", "Political Theory", "Comparative Government and Politics", "International Relations", "American Government and Politics", "Methods"] },
      { id: "seattle-pols-electives", label: "Major Elective Requirement", minCredits: 20, courseCodes: seattlePoliticalScienceUndergraduateCatalogCourses, openEndedRules: ["Four additional courses numbered POLS 210 and above", "POLS 497 may count toward the major", "Independent studies and internships do not count toward the major"] },
    ],
    genEdRequirements: [
      "Minimum requirement major",
      "Minimum grades of 2.0 in each political science introductory course",
      "Minimum 2.0 cumulative GPA",
      "Minimum cumulative major GPA of at least 2.25",
      "50 credits",
      "15 introductory credits",
      "35 upper-level credits",
      "General Major",
      "International Security Option",
      "Political Economy Option",
    ],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-public-service-and-policy",
    title: "Public Service & Policy",
    officialSources: [
      "https://www.washington.edu/students/gencat/program/S/PublicPolicyandGovernance-770.html",
      "https://www.washington.edu/students/crscat/pubpol.html",
    ],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: unique([
      "ENGL 131",
      ...seattlePublicServicePolicyFoundationCourses,
      ...seattlePublicServicePolicyStatisticsCourses,
      ...seattlePublicServicePolicyCatalogCourses,
    ]),
    optionGroups: [
      { id: "seattle-pubpol-context", label: "Public Service and Policy Context", options: [["PUBPOL 201"], ["PUBPOL 313"], ["PUBPOL 321"]] },
      { id: "seattle-pubpol-methods", label: "Methods", options: [["PUBPOL 301"], ["PUBPOL 303"]] },
      { id: "seattle-pubpol-leadership-management", label: "Leadership and Management", options: [["PUBPOL 302"], ["PUBPOL 402"], ["PUBPOL 403"]] },
      { id: "seattle-pubpol-statistics", label: "Statistics", options: singleOptions(seattlePublicServicePolicyStatisticsCourses) },
      { id: "seattle-pubpol-experiential", label: "Internship, study abroad, and research coursework", options: singleOptions(["PUBPOL 497", "PUBPOL 498"]) },
    ],
    courseBuckets: [
      { id: "seattle-pubpol-foundation", label: "Public Service and Policy Foundation", minCredits: 35, courseCodes: seattlePublicServicePolicyFoundationCourses },
      { id: "seattle-pubpol-statistics", label: "Statistics", minCredits: 4, maxCredits: 5, courseCodes: seattlePublicServicePolicyStatisticsCourses },
      { id: "seattle-pubpol-selectives", label: "Interdisciplinary Selectives", minCredits: 15, courseCodes: seattlePublicServicePolicyCatalogCourses, openEndedRules: ["100- and 200-level courses representing areas that inform public service and policy"] },
      { id: "seattle-pubpol-upper-division", label: "Upper-Division Electives", minCredits: 15, courseCodes: seattlePublicServicePolicyCatalogCourses, openEndedRules: ["300- and 400-level PUBPOL courses", "Maximum 5 credits combined of PUBPOL 497, study abroad, and PUBPOL 498 coursework"] },
    ],
    genEdRequirements: [
      "English Composition",
      "Additional Writing",
      "Reasoning",
      "Diversity",
      "Foreign Language",
      "Arts and Humanities",
      "Social Sciences",
      "Natural Sciences",
      "Areas of Inquiry",
      "Minimum 20 credits of Areas of Inquiry requirements must be outside of major requirements",
      "69-70 credits",
      "45 college credits",
      "Minimum 2.00 cumulative GPA",
      "Minimum 2.0 grade in PUBPOL 201",
    ],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-law-societies-and-justice",
    title: "Law, Societies & Justice",
    officialSources: [
      "https://lsj.washington.edu/lsj-gold-curriculum-requirements",
      "https://www.washington.edu/students/crscat/lsj.html",
    ],
    expectedPathwayIds: ["honors-option"],
    pathwayGroups: [
      { id: "honors-option", label: "Honors Option", suggestedCourses: seattleLsjCatalogCourses },
    ],
    requiredCourseCodes: unique([
      ...seattleLsjCatalogCourses,
      ...seattleLsjGoldApprovedCourses,
    ]),
    optionGroups: [
      { id: "seattle-lsj-human-rights-law", label: "Human Rights OR Law Courses", options: singleOptions(seattleLsjGoldApprovedCourses) },
      { id: "seattle-lsj-capstone", label: "Capstone Seminar", options: singleOptions(["LSJ 401", "LSJ 410", "LSJ 412", "LSJ 413", "LSJ 415", "LSJ 416", "LSJ 421", "LSJ 422", "LSJ 425", "LSJ 426", "LSJ 427", "LSJ 428", "LSJ 429", "LSJ 431", "LSJ 438", "LSJ 460", "LSJ 490", "LSJ 491"]) },
      { id: "seattle-lsj-honors", label: "Honors Option", options: singleOptions(["LSJ 490", "LSJ 491", "LSJ 499"]) },
    ],
    courseBuckets: [
      { id: "seattle-lsj-core", label: "Core Courses", minCredits: 20, courseCodes: seattleLsjGoldApprovedCourses, openEndedRules: ["Introduction to Law, Societies and Justice", "Two Human Rights or Law courses at the 300-level", "One LSJ 400-level capstone seminar"] },
      { id: "seattle-lsj-300-level", label: "300-Level LSJ Courses", minCredits: 20, courseCodes: seattleLsjCatalogCourses, openEndedRules: ["At least four LSJ courses completed at the 300-level"] },
      { id: "seattle-lsj-upper-division", label: "Upper-Division Electives", minCredits: 16, maxCredits: 20, courseCodes: unique([...seattleLsjCatalogCourses, ...seattleLsjGoldApprovedCourses]), openEndedRules: ["At least four upper-division courses", "Minimum one course must be completed at the 400-level"] },
    ],
    genEdRequirements: [
      "LSJ Gold Curriculum Major Requirements",
      "Minimum 56-60 credits",
      "English Composition",
      "Additional Writing",
      "Quantitative Symbolic Reasoning",
      "Diversity",
      "Foreign Language Requirement",
      "Arts and Humanities",
      "Social Sciences",
      "Natural Sciences",
      "Additional Areas of Inquiry",
    ],
  },
  {
    campusId: "uw-bothell",
    planId: "uw-bothell-law-economics-and-public-policy",
    title: "Law, Economics & Public Policy",
    officialSources: [
      "https://www.uwb.edu/ias/undergraduate/majors/law-economics-public-policy",
    ],
    expectedPathwayIds: ["ba-route"],
    pathwayGroups: [
      { id: "ba-route", label: "B.A. route", suggestedCourses: bothellLeppCourses },
    ],
    requiredCourseCodes: bothellLeppCourses,
    optionGroups: [
      { id: "bothell-lepp-composition", label: "English Composition Coursework", options: singleOptions(bothellLeppCompositionCourses) },
      { id: "bothell-lepp-microeconomics", label: "Introduction Microeconomics Course", options: singleOptions(["BIS 200", "BBUS 220", "ECON 200"]) },
      { id: "bothell-lepp-american-government", label: "Introduction to American Government or American Politics", options: singleOptions(["BIS 175", "BIS 280", "POLS 202"]) },
      { id: "bothell-lepp-statistics", label: "Statistics Requirement", options: singleOptions(bothellLeppStatisticsCourses) },
    ],
    courseBuckets: [
      { id: "bothell-lepp-core", label: "LEPP Core Courses", minCredits: 10, courseCodes: ["BISLEP 301", "BISLEP 302"] },
      { id: "bothell-lepp-statistics", label: "Statistics Requirement", minCredits: 5, courseCodes: bothellLeppStatisticsCourses },
      { id: "bothell-lepp-skills-methods", label: "Additional Skills and Methods coursework", minCredits: 5, courseCodes: bothellLeppCourses },
      { id: "bothell-lepp-policy-foundation", label: "Policy Foundation courses", minCredits: 10, courseCodes: bothellLeppCourses },
      { id: "bothell-lepp-policy-problem", label: "Policy Foundation or Policy Problem courses", minCredits: 20, courseCodes: bothellLeppCourses },
      { id: "bothell-lepp-ias", label: "Additional IAS Coursework", minCredits: 20, courseCodes: bothellLeppCourses },
    ],
    genEdRequirements: [
      "Autumn 2024",
      "TOTAL = 70 Credits",
      "Residency Requirement",
      "30 credits must be completed in residency at UW Bothell",
      "Cumulative GPA Requirement",
      "Major GPA must be at a cumulative of 2.00 or higher",
      "Interdisciplinary Practice and Reflection",
      "Upper Division Credit Policy",
    ],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-law-and-policy",
    title: "Law and Policy",
    officialSources: [
      "https://www.tacoma.uw.edu/sias/socs/law-and-policy",
      "https://www.washington.edu/students/crscatt/tlaw.html",
    ],
    expectedPathwayIds: ["ba-route"],
    pathwayGroups: [
      { id: "ba-route", label: "B.A. route", suggestedCourses: tacomaLawPolicyCourses },
    ],
    requiredCourseCodes: tacomaLawPolicyCourses,
    optionGroups: [
      { id: "tacoma-law-policy-law-i", label: "LAW I", options: singleOptions(tacomaLawPolicyLawICourses) },
      { id: "tacoma-law-policy-methods", label: "METHODS", options: singleOptions(tacomaLawPolicyMethodsCourses) },
      { id: "tacoma-law-policy-capstone", label: "Law and Policy internship and capstone coursework", options: singleOptions(["TLAW 496", "TPOLS 496", "TPOLS 497"]) },
    ],
    courseBuckets: [
      { id: "tacoma-law-policy-major", label: "BA in Law and Policy", minCredits: 65, courseCodes: tacomaLawPolicyCourses },
      { id: "tacoma-law-policy-upper-division", label: "Upper-division courses", minCredits: 45, courseCodes: tacomaLawPolicyCourses, openEndedRules: ["300-400 level courses"] },
    ],
    genEdRequirements: [
      "45 lower-division credits",
      "65 major credits",
      "45 credits of upper-division",
      "Minimum 2.0 GPA in courses applied to the major",
      "UWT general education",
      "Graduation requirements",
      "Minimum of 180 credits",
    ],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-politics-philosophy-and-economics",
    title: "Politics, Philosophy and Economics",
    officialSources: [
      "https://www.tacoma.uw.edu/sias/socs/politics-philosophy-and-economics-ppe",
      "https://www.tacoma.uw.edu/sias/socs/politics-and-philosophy-specialization",
      "https://www.tacoma.uw.edu/sias/socs/economics-specialization",
      "https://www.tacoma.uw.edu/sias/socs/international-studies-specialization",
    ],
    expectedPathwayIds: [
      "economics-specialization",
      "international-studies-specialization",
      "politics-and-philosophy-specialization",
    ],
    pathwayGroups: [
      { id: "politics-and-philosophy-specialization", label: "Politics and Philosophy Specialization", suggestedCourses: tacomaPpePoliticsPhilosophyCourses, capstoneCourses: tacomaPpeCapstoneCourses },
      { id: "economics-specialization", label: "Economics Specialization", suggestedCourses: tacomaPpeEconomicsCourses, capstoneCourses: tacomaPpeCapstoneCourses },
      { id: "international-studies-specialization", label: "International Studies Specialization", suggestedCourses: tacomaPpeInternationalStudiesCourses, capstoneCourses: tacomaPpeCapstoneCourses },
    ],
    requiredCourseCodes: tacomaPpeCourses,
    optionGroups: [
      { id: "tacoma-ppe-economics-core", label: "List A: Economics Core", options: singleOptions(["TECON 200", "TBECON 220", "TECON 201", "TBECON 221"]) },
      { id: "tacoma-ppe-philosophy-core", label: "List B: Philosophy Core", options: singleOptions(["TPOLS 201", "TPHIL 101", "TPHIL 240", "TRELIG 321"]) },
      { id: "tacoma-ppe-politics-core", label: "List C: Politics Core", options: singleOptions(["TPOLS 202", "TPOLS 203", "TPOLS 204", "TPOLS 260"]) },
      { id: "tacoma-ppe-methods", label: "Methods courses", options: singleOptions(["TPHIL 250", "TPHIL 251"]) },
      { id: "tacoma-ppe-capstone", label: "Capstone", options: singleOptions(tacomaPpeCapstoneCourses) },
    ],
    courseBuckets: [
      { id: "tacoma-ppe-core", label: "Core courses", minCredits: 20, courseCodes: tacomaPpeCoreCourses, openEndedRules: ["At least one class from each of the following three lists"] },
      { id: "tacoma-ppe-methods", label: "Methods courses", minCredits: 10, courseCodes: ["TPHIL 250", "TPHIL 251"] },
      { id: "tacoma-ppe-politics-philosophy", label: "Politics and Philosophy", minCredits: 20, courseCodes: tacomaPpePoliticsPhilosophyCourses },
      { id: "tacoma-ppe-economics", label: "Economics", minCredits: 20, courseCodes: tacomaPpeEconomicsCourses },
      { id: "tacoma-ppe-international-studies", label: "International Studies", minCredits: 20, courseCodes: tacomaPpeInternationalStudiesCourses },
      { id: "tacoma-ppe-capstone", label: "Capstone", minCredits: 5, courseCodes: tacomaPpeCapstoneCourses },
    ],
    genEdRequirements: [
      "Bachelor of Arts",
      "Core courses",
      "Three specializations",
      "Politics and Philosophy Specialization",
      "Economics Specialization",
      "International Studies Specialization",
      "Internship opportunities",
      "Admission Requirements",
      "Transfer Equivalencies",
    ],
  },
];

module.exports = {
  politicalLawPolicyPrograms,
};
