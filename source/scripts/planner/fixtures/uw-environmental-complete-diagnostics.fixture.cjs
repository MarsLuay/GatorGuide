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

const seattleEsrmCourses = courses(`
  ANTH 233, ATMOS 211, BIOL 161, BIOL 162, BIOL 180, BIOL 200, BIOL 220, BIOL 331,
  CHEM 120, CHEM 142, CHEM 143, CHEM 145, CHEM 152, CHEM 153, CHEM 155, CHEM 220,
  COM 200, COM 202, COM 220, COM 231, COM 233, COM 234, COM 238, COM 270,
  ECON 200, ECON 201, ECON 230, ECON 235, ENGL 131, ENVIR 235,
  ESRM 200, ESRM 201, ESRM 210, ESRM 235, ESRM 250, ESRM 300, ESRM 304,
  ESRM 323, ESRM 331, ESRM 350, ESRM 351, ESRM 368, ESRM 381, ESRM 400,
  ESRM 426, ESRM 428, ESRM 430, ESRM 441, ESRM 447, ESRM 450, ESRM 451,
  ESRM 452, ESRM 453, ESRM 458, ESRM 459, ESRM 461, ESRM 462, ESRM 463,
  ESRM 464, ESRM 470, ESRM 494, ESRM 495, ESRM 496,
  ESS 201, ESS 212, ESS 230, FISH 230, FISH 270, FISH 447, LING 233,
  MARBIO 270, MATH 124, MATH 125, MATH 134, MATH 135, OCEAN 230,
  OCEAN 270, OCEAN 295, QSCI 291, QSCI 292, QSCI 381, QSCI 451, QSCI 482,
  SBSE 300, STAT 311, TBIOL 462, TBIOL 463, TBIOL 464
`);

const seattleEnvironmentalStudiesCourses = courses(`
  ANTH 210, ANTH 211, ANTH 325, ANTH 458, ANTH 487, ARCHY 208, ATMS 211,
  ATMS 350, BIOL 180, BIOL 250, BIOL 315, BIOL 478, CHEM 120, CM 335,
  ECON 200, ECON 230, ECON 235, ENGL 265, ENGL 365, ENVIR 100, ENVIR 101,
  ENVIR 200, ENVIR 201, ENVIR 211, ENVIR 221, ENVIR 235, ENVIR 239,
  ENVIR 240, ENVIR 243, ENVIR 280, ENVIR 301, ENVIR 302, ENVIR 310,
  ENVIR 312, ENVIR 313, ENVIR 315, ENVIR 360, ENVIR 362, ENVIR 379,
  ENVIR 380, ENVIR 384, ENVIR 400, ENVIR 401, ENVIR 420, ENVIR 430,
  ENVIR 431, ENVIR 439, ENVIR 460, ENVIR 478, ENVIR 480, ENVIR 490,
  ENVIR 491, ENVIR 492, ESRM 235, ESRM 250, ESRM 304, ESRM 320,
  ESRM 321, ESRM 350, ESRM 362, ESRM 371, ESRM 400, ESRM 403, ESRM 431,
  ESRM 458, ESRM 460, ESRM 461, ESRM 465, ESRM 470, ESRM 473,
  ESS 201, ESS 212, ESS 315, ESS 420, FISH 200, FISH 230, FISH 250,
  FISH 323, FISH 452, FISH 478, GEOG 205, GEOG 258, GEOG 272,
  GEOG 326, GEOG 360, GEOG 473, HSTAA 221, HSTAS 440, JSISA 440,
  JSISB 350, JSISB 351, JSISB 352, JSISB 391, JSISB 455, OCEAN 200,
  OCEAN 250, OCEAN 450, OCEAN 452, PHIL 243, PUBPOL 201, QSCI 381,
  SCAND 350, SMEA 201, SOC 221, SOC 379, STAT 220, STAT 221
`);

const seattleEnvironmentalDesignCourses = courses(`
  LARCH 210, LARCH 211, LARCH 212, LARCH 300, LARCH 370,
  LARCH 352, LARCH 353, LARCH 454,
  LARCH 342, LARCH 435, LARCH 412,
  LARCH 341, LARCH 301, LARCH 302, LARCH 303,
  LARCH 361, LARCH 465
`);

const seattleSbseCourses = courses(`
  AA 210, AA 260, AMATH 301, AMATH 351, AMATH 352,
  BSE 210, BSE 248, BSE 391, BSE 392, BSE 406, BSE 410, BSE 420,
  BSE 421, BSE 422, BSE 426, BSE 430, BSE 436, BSE 475, BSE 480,
  BSE 481, BSE 497,
  CEE 220, CEE 291, CEE 350, CEE 354, CEE 357, CEE 480, CEE 482,
  CEE 490, CEE 497,
  CHEM 120, CHEM 142, CHEM 143, CHEM 145, CHEM 152, CHEM 153,
  CHEM 155, CHEM 162, CHEM 165, CHEM 223, CHEM 237, CHEM 238, CHEM 257,
  CHEME 325, CHEME 326, CHEME 340, CHEME 341, CHEME 355, CHEME 375,
  CHEME 435, CHEME 436, CHEME 455, CHEME 465, CHEME 480, CHEME 481,
  CSE 121, CSE 122, CSE 123, CSE 142, CSE 143, CSE 160, CSE 180,
  ECON 200, ECON 201, ECON 235, EE 215, ENGL 131, ENGR 101, ENGR 231,
  ENGR 401, ENVIR 235, ESRM 235, ESRM 300, ESRM 320, ESRM 321,
  ESRM 400, ESRM 423, ESRM 461, ESRM 465, INDE 315, INDE 337,
  INFO 180, MATH 112, MATH 124, MATH 125, MATH 126, MATH 134,
  MATH 135, MATH 136, MATH 207, MATH 208, MATH 307, ME 123, ME 124,
  ME 230, MSE 170, MSE 298, MSE 362, MSE 463, MSE 471, MSE 475,
  MSE 477, MSE 490, PHYS 114, PHYS 121, PHYS 122, PHYS 123, PHYS 141,
  PHYS 142, PHYS 143, QSCI 256, QSCI 291, QSCI 381,
  SBSE 300, SBSE 391, SBSE 392, SBSE 406, SBSE 410, SBSE 420,
  SBSE 422, SBSE 426, SBSE 430, SBSE 436, SBSE 461, SBSE 475,
  SBSE 480, SBSE 481, STAT 180, STAT 390
`);

const bothellConservationRestorationCourses = courses(`
  BBIO 180, BBIO 330, BBIO 335, BBIO 471, BBUS 215, BCHEM 143,
  BCHEM 144, BCHEM 315, BCHEM 350, BEARTH 153, BEARTH 154, BEARTH 155,
  BEARTH 201, BEARTH 202, BEARTH 310, BEARTH 317, BEARTH 318, BEARTH 320,
  BEARTH 321, BEARTH 341, BES 301, BES 303, BES 311, BES 312, BES 316,
  BES 330, BES 362, BES 385, BES 397, BES 415, BES 440, BES 460,
  BES 486, BES 488, BES 489, BES 491, BES 492, BES 493, BES 497,
  BHLTH 407, BIS 141, BIS 185, BIS 215, BIS 242, BIS 243, BIS 245,
  BIS 246, BIS 252, BIS 304, BIS 307, BIS 319, BIS 342, BIS 343,
  BIS 344, BIS 346, BIS 356, BIS 359, BIS 360, BIS 372, BIS 386,
  BIS 392, BIS 405, BIS 406, BIS 408, BIS 442, BIS 456, BIS 458,
  BIS 459, BISSTS 355, BMATH 123, BMATH 215, BST 301, BST 445,
  BST 446, CHEM 120, CHEM 142, CHEM 143, CHEM 145, MATH 120, STAT 220
`);

const bothellEarthSystemCourses = courses(`
  BBIO 180, BBIO 330, BBIO 335, BBIO 471, BBIO 495, BCHEM 143,
  BCHEM 144, BCHEM 153, BCHEM 154, BCHEM 163, BCHEM 164, BCHEM 315,
  BCHEM 350, BCHEM 495, BCHEM 496, BEARTH 153, BEARTH 154, BEARTH 155,
  BEARTH 201, BEARTH 202, BEARTH 310, BEARTH 317, BEARTH 318, BEARTH 320,
  BEARTH 321, BEARTH 341, BENGR 310, BES 301, BES 303, BES 312,
  BES 316, BES 330, BES 362, BES 440, BES 460, BES 486, BES 488,
  BES 491, BES 492, BES 493, BES 498, BGIS 342, BGIS 343, BGIS 344,
  BGIS 442, BHLTH 407, BIS 141, BIS 215, BIS 218, BIS 231, BIS 242,
  BIS 243, BIS 245, BIS 246, BIS 252, BIS 282, BIS 304, BIS 306,
  BIS 307, BIS 314, BIS 319, BIS 320, BIS 338, BIS 342, BIS 345,
  BIS 346, BIS 353, BIS 356, BIS 359, BIS 372, BIS 385, BIS 386,
  BIS 391, BIS 392, BIS 394, BIS 405, BIS 406, BIS 408, BIS 411,
  BIS 412, BIS 415, BIS 447, BIS 458, BIS 459, BIS 468, BIS 483,
  BIS 495, BISGST 303, BISGST 324, BISSTS 355, BMATH 144, BMATH 215,
  BPHYS 101, BPHYS 114, BPHYS 115, BPHYS 116, BPHYS 117, BPHYS 118,
  BPHYS 119, BPHYS 121, BPHYS 122, BPHYS 123, BST 301, BST 445,
  BST 499, BWRIT 134, CSS 112, CSS 142, CSS 455, ENVIR 100,
  ESRM 100, ESS 101, ESS 201, OCEAN 101, STMATH 124, STMATH 125,
  STMATH 126, STMATH 207, STMATH 208, STMATH 224, STMATH 341
`);

const bothellEnvironmentalStudiesCourses = courses(`
  BBIO 330, BBIO 335, BBIO 471, BCHEM 315, BCHEM 350, BEARTH 153,
  BEARTH 154, BEARTH 155, BEARTH 201, BEARTH 202, BEARTH 310,
  BEARTH 317, BEARTH 318, BEARTH 320, BEARTH 321, BEARTH 341,
  BES 301, BES 303, BES 311, BES 312, BES 316, BES 330, BES 397,
  BES 415, BES 440, BES 460, BES 486, BES 488, BES 489, BES 491,
  BES 492, BES 493, BES 497, BGIS 342, BHLTH 407, BIS 141, BIS 180,
  BIS 185, BIS 242, BIS 243, BIS 245, BIS 246, BIS 252, BIS 304,
  BIS 306, BIS 307, BIS 312, BIS 319, BIS 338, BIS 340, BIS 343,
  BIS 344, BIS 346, BIS 356, BIS 359, BIS 360, BIS 372, BIS 386,
  BIS 390, BIS 392, BIS 405, BIS 406, BIS 408, BIS 415, BIS 442,
  BIS 456, BIS 458, BIS 459, BISGST 303, BISSTS 307, BISSTS 355,
  BST 301, BST 445, BST 446, BWRIT 133, BWRIT 134, BWRIT 135,
  ENGL 131, ENGL 141
`);

const tacomaEnvironmentalScienceCourses = courses(`
  TARTS 402, TBIOL 120, TBIOL 130, TBIOL 140, TBIOL 202, TBIOL 203,
  TBIOL 232, TBIOL 234, TBIOL 240, TBIOL 270, TBIOL 301, TBIOL 302,
  TBIOL 303, TBIOL 304, TBIOL 305, TBIOL 306, TBIOL 313, TBIOL 314,
  TBIOL 318, TBIOL 320, TBIOL 323, TBIOL 325, TBIOL 331, TBIOL 340,
  TBIOL 350, TBIOL 362, TBIOL 404, TBIOL 422, TBIOL 432, TBIOL 434,
  TBIOL 438, TBIOL 442, TBIOL 455, TBIOL 464, TBIOMD 490, TBIOMD 491,
  TBIOMD 495, TCHEM 142, TCHEM 152, TCHEM 162, TCHEM 251, TCHEM 333,
  TCHEM 405, TCHEM 406, TCHEM 439, TCOM 310, TCOM 351, TCOM 470,
  TECON 421, TEGL 202, TEGL 210, TEGL 304, TEGL 365, TEGL 464,
  TESC 200, TESC 201, TESC 210, TESC 239, TESC 301, TESC 310,
  TESC 345, TESC 410, TESC 430, TESC 433, TESC 435, TESC 495,
  TESC 496, TESC 497, TESC 499, TEST 332, TEST 337, TGEOG 403,
  TGEOG 435, TGEOG 440, TGEOS 117, TGEOS 215, TGEOS 216, TGEOS 226,
  TGEOS 227, TGEOS 241, TGEOS 243, TGEOS 319, TGEOS 337, TGEOS 341,
  TGEOS 415, TGEOS 417, TGEOS 419, TGEOS 445, TGH 303, TGH 494,
  TGH 496, TGIS 311, TGIS 415, THIST 445, THIST 456, THIST 487,
  THIST 495, THLTH 372, THLTH 410, TIAS 443, TINST 401, TLAW 339,
  TLAW 438, TLIT 237, TLIT 431, TLIT 433, TLIT 437, TMATH 110,
  TMATH 124, TMATH 125, TMATH 210, TMATH 390, TMATH 495, TNPRFT 231,
  TNPRFT 451, TPHIL 353, TPHIL 361, TPHIL 362, TPHIL 364, TPHIL 367,
  TPHIL 451, TPHIL 455, TPHIL 456, TPHYS 121, TPHYS 315, TRELIG 210,
  TRELIG 350, TSOC 456, TSUD 222, TSUD 240, TSUD 445, TURB 205,
  TURB 210, TURB 220, TURB 301, TURB 312, TURB 322, TURB 345,
  TURB 410, TWOMN 211, TWRT 211, TWRT 287, TWRT 291, TWRT 331,
  TWRT 372, TWRT 388
`);

const tacomaEnvironmentalSustainabilityCourses = courses(`
  TBGEN 212, TBIOL 110, TBIOL 232, TBIOMD 490, TBIOMD 491, TBUS 300,
  TCHEM 131, TCOM 275, TCOM 310, TCOM 312, TCOM 482, TECON 200,
  TECON 210, TECON 410, TECON 421, TEDUC 290, TEDUC 471, TEDUC 482,
  TEGL 304, TESC 201, TESC 301, TESC 345, TESC 404, TESC 495,
  TESC 496, TESC 497, TESC 499, TEST 200, TEST 337, TEST 495,
  TGEOS 243, TGEOS 341, TLAW 339, TLAW 438, TLAW 465, TLIT 237,
  TMATH 110, TMGMT 420, TMGMT 452, TMGMT 457, TMGMT 465, TMGMT 466,
  TPHIL 251, TPHIL 456, TPOLS 203, TPOLS 270, TPSYCH 220, TPSYCH 320,
  TPSYCH 321, TRELIG 350, TWRT 211, TWRT 291, TWRT 331, TWRT 372,
  TWRT 388, TWRT 389, TWRT 391
`);

const tacomaSustainableUrbanDevelopmentCourses = courses(`
  TESC 201, TEST 332, TGEOG 101, TGEOG 210, TGEOG 321, TGEOG 349,
  TGIS 311, TGIS 312, TGIS 313, TGIS 414, TGIS 415, TSUD 222,
  TSUD 240, TSUD 444, TSUD 445, TSUD 475, TUDE 210, TUDE 260,
  TUDE 340, TURB 101, TURB 102, TURB 103, TURB 110, TURB 200,
  TURB 220, TURB 225, TURB 235, TURB 314, TURB 322, TURB 379,
  TURB 403, TURB 410, TURB 470, TURB 479, TURB 498
`);

const environmentalPrograms = [
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-environmental-science-and-terrestrial-resource-management",
    title: "Environmental Science & Terrestrial Resource Management",
    officialSources: ["https://www.washington.edu/students/gencat/program/S/SchoolofEnvironmentalandForestScience-1069.html"],
    expectedPathwayIds: [
      "bs-option-family:natural-resource-and-environmental-management",
      "bs-option-family:restoration-ecology-and-environmental-horticulture",
      "bs-option-family:sustainable-forest-management",
      "bs-option-family:wildlife-conservation",
    ],
    pathwayGroups: [
      { id: "bs-option-family:natural-resource-and-environmental-management", label: "Natural Resource and Environmental Management", suggestedCourses: seattleEsrmCourses },
      { id: "bs-option-family:restoration-ecology-and-environmental-horticulture", label: "Restoration Ecology and Environmental Horticulture", suggestedCourses: seattleEsrmCourses },
      { id: "bs-option-family:sustainable-forest-management", label: "Sustainable Forest Management", suggestedCourses: seattleEsrmCourses },
      { id: "bs-option-family:wildlife-conservation", label: "Wildlife Conservation", suggestedCourses: seattleEsrmCourses },
    ],
    requiredCourseCodes: seattleEsrmCourses,
    optionGroups: [
      { id: "seattle-esrm-calculus", label: "Q SCI 291, MATH 124, or MATH 134", options: [["QSCI 291"], ["MATH 124"], ["MATH 134"]] },
      { id: "seattle-esrm-second-calculus", label: "Q SCI 292, MATH 125, or MATH 135", options: [["QSCI 292"], ["MATH 125"], ["MATH 135"]] },
      { id: "seattle-esrm-statistics", label: "Q SCI 381 or STAT 311", options: [["QSCI 381"], ["STAT 311"]] },
      { id: "seattle-esrm-economics", label: "Economics", options: [["ECON 200"], ["ECON 201"], ["ESRM 235"], ["ENVIR 235"], ["ECON 235"], ["FISH 230"], ["ECON 230"]] },
    ],
    courseBuckets: [
      { id: "seattle-esrm-core", label: "Core Courses", minCredits: 22, courseCodes: ["ESRM 200", "ESRM 201", "ESRM 250", "ESRM 300", "SBSE 300", "ESRM 304"] },
      { id: "seattle-esrm-options", label: "Major Requirements", courseCodes: seattleEsrmCourses },
      { id: "seattle-esrm-capstone", label: "Capstone", minCredits: 10, courseCodes: ["ESRM 462", "TBIOL 462", "ESRM 463", "TBIOL 463", "ESRM 464", "TBIOL 464", "ESRM 494", "ESRM 495", "ESRM 496"] },
    ],
    genEdRequirements: ["Written Communication (15 credits)", "Reasoning (RSN) (15 credits)", "Diversity (DIV) (5 credits)", "Arts and Humanities (A&H) (10 credits)", "Natural Sciences (NSc) (33-42 credits)", "Social Sciences (SSc) (20 credits)", "Additional electives as needed to reach 180 credits"],
    requirementLabels: ["Environmental Science and Terrestrial Resource Management", "Natural Resource and Environmental Management", "Restoration Ecology and Environmental Horticulture", "Sustainable Forest Management", "Wildlife Conservation"],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-environmental-studies",
    title: "Environmental Studies",
    officialSources: ["https://www.washington.edu/students/gencat/program/S/ProgramontheEnvironment-1070.html"],
    expectedPathwayIds: [
      "concentration:environmental-justice",
      "concentration:sustainability",
      "concentration:climate-change",
      "concentration:conservation-of-living-systems",
      "concentration:policy-and-planning",
      "concentration:education",
      "concentration:communication",
      "concentration:food-studies",
    ],
    pathwayGroups: [
      { id: "concentration:environmental-justice", label: "Environmental Justice", suggestedCourses: seattleEnvironmentalStudiesCourses },
      { id: "concentration:sustainability", label: "Sustainability", suggestedCourses: seattleEnvironmentalStudiesCourses },
      { id: "concentration:climate-change", label: "Climate Change", suggestedCourses: seattleEnvironmentalStudiesCourses },
      { id: "concentration:conservation-of-living-systems", label: "Conservation of Living Systems", suggestedCourses: seattleEnvironmentalStudiesCourses },
      { id: "concentration:policy-and-planning", label: "Policy and Planning", suggestedCourses: seattleEnvironmentalStudiesCourses },
      { id: "concentration:education", label: "Education", suggestedCourses: seattleEnvironmentalStudiesCourses },
      { id: "concentration:communication", label: "Communication", suggestedCourses: seattleEnvironmentalStudiesCourses },
      { id: "concentration:food-studies", label: "Food Studies", suggestedCourses: seattleEnvironmentalStudiesCourses },
    ],
    requiredCourseCodes: seattleEnvironmentalStudiesCourses,
    optionGroups: [
      { id: "seattle-envir-analytical-methods", label: "Analytical Methods", options: singleOptions(["ARCHY 208", "ENVIR 310", "ESRM 250", "ESRM 304", "ESS 420", "GEOG 258", "GEOG 326", "GEOG 360", "FISH 452", "OCEAN 452", "QSCI 381", "STAT 220", "STAT 221", "SOC 221"]) },
      { id: "seattle-envir-capstone", label: "Capstone Experience", options: [["ENVIR 490", "ENVIR 491", "ENVIR 492"]] },
    ],
    courseBuckets: [
      { id: "seattle-envir-core", label: "Core Courses", minCredits: 21, courseCodes: ["ENVIR 100", "ENVIR 101", "ENVIR 301", "ENVIR 302", "ENVIR 401"] },
      { id: "seattle-envir-integrating-disciplines", label: "Integrating Disciplines", minCredits: 28, maxCredits: 40, courseCodes: seattleEnvironmentalStudiesCourses },
      { id: "seattle-envir-capstone", label: "Capstone Experience", minCredits: 15, courseCodes: ["ENVIR 490", "ENVIR 491", "ENVIR 492"] },
    ],
    genEdRequirements: ["64-76 credits", "Minimum 2.00 cumulative GPA", "Minimum 15 credits taken in residence at UW Seattle", "Minimum 15 credits must be taken outside of the student's major requirements"],
    requirementLabels: ["Environmental Studies", "Environmental Justice", "Sustainability", "Climate Change", "Conservation of Living Systems", "Policy and Planning", "Education", "Communication", "Food Studies"],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-environmental-design-and-sustainability",
    title: "Environmental Design & Sustainability",
    officialSources: ["https://www.washington.edu/students/gencat/program/S/LandscapeArchitecture-53.html"],
    expectedPathwayIds: [
      "area-of-concentration:environmental-design-technologies",
      "area-of-concentration:environmental-design-practice",
      "area-of-concentration:environmental-design-equity",
    ],
    pathwayGroups: [
      { id: "area-of-concentration:environmental-design-technologies", label: "Environmental Design Technologies", suggestedCourses: ["LARCH 342", "LARCH 435", "LARCH 412"] },
      { id: "area-of-concentration:environmental-design-practice", label: "Environmental Design Practice", suggestedCourses: ["LARCH 341", "LARCH 435", "LARCH 301", "LARCH 302", "LARCH 303"] },
      { id: "area-of-concentration:environmental-design-equity", label: "Environmental Design Equity", suggestedCourses: ["LARCH 361", "LARCH 465", "LARCH 303"] },
    ],
    requiredCourseCodes: seattleEnvironmentalDesignCourses,
    optionGroups: [
      { id: "seattle-eds-historical-context", label: "Historical Context Course", options: [["LARCH 352"], ["LARCH 353"], ["LARCH 454"]] },
      { id: "seattle-eds-concentration", label: "select one area of concentration", options: [["LARCH 342", "LARCH 435", "LARCH 412"], ["LARCH 341", "LARCH 435", "LARCH 301", "LARCH 302", "LARCH 303"], ["LARCH 361", "LARCH 465", "LARCH 303"]] },
    ],
    courseBuckets: [
      { id: "seattle-eds-core", label: "Core courses", minCredits: 22, courseCodes: ["LARCH 210", "LARCH 211", "LARCH 212", "LARCH 300", "LARCH 370"] },
      { id: "seattle-eds-concentration", label: "Area of Concentration Courses", minCredits: 11, courseCodes: seattleEnvironmentalDesignCourses },
      { id: "seattle-eds-selective", label: "Interdisciplinary Selective courses", minCredits: 12, courseCodes: [], openEndedRules: ["minimum 3 credits at the 300-or 400-level"] },
    ],
    genEdRequirements: ["English Composition (C) (5 credits)", "Additional Writing (W) (10 credits)", "Arts and Humanities (A&H) (20 credits)", "Social Sciences (SSc) (20 credits)", "Natural Sciences (NSc) (20 credits)", "Reasoning (RSN) (4 credits)", "Diversity (DIV) (5 credits)", "50 credits"],
    requirementLabels: ["Environmental Design and Sustainability", "Environmental Design Technologies", "Environmental Design Practice", "Environmental Design Equity"],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-sustainable-bioresource-systems-engineering",
    title: "Sustainable Bioresource Systems Engineering",
    officialSources: [
      "https://www.washington.edu/students/gencat/program/S/SchoolofEnvironmentalandForestScience-1069.html",
      "https://sefs.uw.edu/students/undergraduate/sbse-major/requirements/",
    ],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: seattleSbseCourses,
    optionGroups: [
      { id: "seattle-sbse-computation", label: "Computation and Data Science", options: singleOptions(["AMATH 301", "CSE 121", "CSE 122", "CSE 123", "CSE 142", "CSE 143", "CSE 160", "INFO 180", "CSE 180", "STAT 180", "QSCI 256"]) },
      { id: "seattle-sbse-business-policy-econ", label: "Business, Policy, and Economics", options: singleOptions(["ECON 200", "ECON 201", "ESRM 235", "ECON 235", "ENVIR 235", "ESRM 320", "ESRM 321", "ESRM 400", "ESRM 423", "ESRM 465"]) },
    ],
    courseBuckets: [
      { id: "seattle-sbse-core", label: "Sustainable Bioresource Systems Engineering", minCredits: 67, courseCodes: ["ESRM 300", "SBSE 300", "SBSE 391", "SBSE 392", "SBSE 406", "SBSE 410", "SBSE 420", "SBSE 422", "SBSE 426", "SBSE 430", "SBSE 436", "ESRM 461", "SBSE 461", "SBSE 475", "SBSE 480", "SBSE 481"] },
      { id: "seattle-sbse-electives", label: "Sustainable Bioresource Systems Engineering Electives", minCredits: 7, maxCredits: 10, courseCodes: seattleSbseCourses },
    ],
    genEdRequirements: ["minimum of 180 credits", "Written and Oral Communication (15 cr)", "Reasoning (RSN) (10 credits)", "Diversity (DIV) (5 credits)", "Natural Sciences (NSc) (68-81 credits)", "74-77 credits"],
    requirementLabels: ["Sustainable Bioresource Systems Engineering", "Computation and Data Science", "Business, Policy, and Economics"],
  },
  {
    campusId: "uw-bothell",
    planId: "uw-bothell-conservation-and-restoration-science",
    title: "Conservation & Restoration Science",
    officialSources: ["https://www.uwb.edu/ias/undergraduate/majors/conservation-restoration-science"],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: bothellConservationRestorationCourses,
    optionGroups: [
      { id: "bothell-crs-composition", label: "B WRIT 134 Composition or equivalent", options: [["BWRIT 134"], ["ENGL 131"]] },
      { id: "bothell-crs-ethics-climate", label: "BIS 356 Ethics and the Environment OR BIS 456 Climate Anxiety, Grief, and Resilience", options: [["BIS 356"], ["BIS 456"], ["BIS 386"], ["BEARTH 320"]] },
    ],
    courseBuckets: [
      { id: "bothell-crs-base", label: "Conservation & Restoration Science Base Coursework", courseCodes: bothellConservationRestorationCourses },
      { id: "bothell-crs-elective", label: "Conservation & Restoration Science Elective Coursework", minCredits: 20, courseCodes: bothellConservationRestorationCourses },
    ],
    genEdRequirements: ["Total= 96 credits", "Residency Requirement: 30 credits must be completed in residency at UW Bothell", "Cumulative GPA Requirement", "Upper Division Credit Policy", "Interdisciplinary Practice & Reflection"],
    requirementLabels: ["Conservation & Restoration Science", "full approved course list", "Approved Elective List"],
  },
  {
    campusId: "uw-bothell",
    planId: "uw-bothell-earth-system-science",
    title: "Earth System Science",
    officialSources: ["https://www.uwb.edu/ias/undergraduate/majors/earth-system-science"],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: bothellEarthSystemCourses,
    optionGroups: [
      { id: "bothell-ess-intro-earth", label: "One Introductory Earth System Science Courses", options: singleOptions(["BEARTH 153", "BEARTH 154", "BEARTH 155", "BEARTH 201", "BEARTH 202", "BIS 242", "BIS 243", "BPHYS 101", "ENVIR 100", "ESRM 100", "ESS 101", "ESS 201", "OCEAN 101"]) },
      { id: "bothell-ess-capstone", label: "Capstone", options: singleOptions(["BES 491", "BES 492", "BES 493", "BES 498", "BBIO 495", "BST 499", "BCHEM 495", "BCHEM 496", "BIS 495"]) },
    ],
    courseBuckets: [
      { id: "bothell-ess-base", label: "Earth Systems Science Base Coursework", minCredits: 25, courseCodes: bothellEarthSystemCourses },
      { id: "bothell-ess-math-science", label: "Introductory Math and Science Requirements", minCredits: 30, maxCredits: 33, courseCodes: bothellEarthSystemCourses },
      { id: "bothell-ess-ascent", label: "Earth Systems Ascent Coursework", minCredits: 39, maxCredits: 40, courseCodes: bothellEarthSystemCourses },
    ],
    genEdRequirements: ["Total= 98-103 credits", "Residency Requirement: 30 credits must be completed in residency at UW Bothell", "Cumulative GPA Requirement", "Interdisciplinary Practice & Reflection"],
    requirementLabels: ["Earth System Science", "Earth Systems Science Base", "Computer Methods and Quantitative Analysis", "Human Dimensions of the Earth System"],
  },
  {
    campusId: "uw-bothell",
    planId: "uw-bothell-environmental-studies",
    title: "Environmental Studies",
    officialSources: ["https://www.uwb.edu/ias/undergraduate/majors/environmental-studies"],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: bothellEnvironmentalStudiesCourses,
    optionGroups: [
      { id: "bothell-enst-composition-one", label: "B WRIT 133 or B WRIT 134 or ENGL 131", options: [["BWRIT 133"], ["BWRIT 134"], ["ENGL 131"]] },
      { id: "bothell-enst-composition-two", label: "B WRIT 135 or ENGL 141", options: [["BWRIT 135"], ["ENGL 141"]] },
      { id: "bothell-enst-core-choice", label: "BIS 242 Environmental Geography or BIS 243 Intro to Environmental Issues", options: [["BIS 242"], ["BIS 243"]] },
      { id: "bothell-enst-ethics-climate", label: "BIS 356 Ethics and the Environment or BIS 386 Climate Change Adaptation", options: [["BIS 356"], ["BIS 386"]] },
      { id: "bothell-enst-methods", label: "BES 301 Science Methods & Practice or BST 301 Scientific Writing", options: [["BES 301"], ["BST 301"]] },
    ],
    courseBuckets: [
      { id: "bothell-enst-composition", label: "Composition Coursework", minCredits: 10, courseCodes: ["BWRIT 133", "BWRIT 134", "BWRIT 135", "ENGL 131", "ENGL 141"] },
      { id: "bothell-enst-core", label: "Environmental Studies Core Requirements", minCredits: 30, courseCodes: ["BIS 242", "BIS 243", "BIS 245", "BIS 307", "BGIS 342", "BIS 356", "BIS 386", "BES 301", "BST 301"] },
      { id: "bothell-enst-electives", label: "Environmental Studies Electives", minCredits: 20, courseCodes: bothellEnvironmentalStudiesCourses },
      { id: "bothell-enst-ias", label: "Additional IAS Coursework", minCredits: 10, courseCodes: [] },
    ],
    genEdRequirements: ["required as of Autumn 2024 quarter", "TOTAL = 70 Credits", "Residency Requirement: 30 credits must be completed in residency at UW Bothell", "Cumulative GPA Requirement", "Interdisciplinary Practices & Reflection"],
    requirementLabels: ["Environmental Studies", "Environmental Studies Core Requirements", "Environmental Studies Electives", "Additional IAS Coursework"],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-environmental-science",
    title: "Environmental Science",
    officialSources: [
      "https://www.tacoma.uw.edu/sias/sam/environmental-science",
      "https://www.tacoma.uw.edu/sias/sam/environmental-science-major-requirements",
    ],
    expectedPathwayIds: [
      "conservation-biology-and-ecology-option",
      "general-environmental-science-option",
      "geoscience-option",
    ],
    pathwayGroups: [
      { id: "general-environmental-science-option", label: "General Environmental Science Option", suggestedCourses: tacomaEnvironmentalScienceCourses },
      { id: "conservation-biology-and-ecology-option", label: "Conservation Biology and Ecology Option", suggestedCourses: tacomaEnvironmentalScienceCourses },
      { id: "geoscience-option", label: "Geoscience Option", suggestedCourses: tacomaEnvironmentalScienceCourses },
    ],
    requiredCourseCodes: tacomaEnvironmentalScienceCourses,
    optionGroups: [
      { id: "tacoma-envs-law-policy", label: "Environmental Law/Policy courses", options: singleOptions(["TECON 421", "TESC 345", "TEST 337", "TLAW 339", "TLAW 438"]) },
      { id: "tacoma-envs-ethics", label: "Environmental Ethics", options: singleOptions(["TEGL 210", "TPHIL 364", "TPHIL 456", "TRELIG 350"]) },
      { id: "tacoma-envs-options", label: "standard Environmental Science BS degree, Conservation Biology and Ecology option, or Geoscience option", options: [tacomaEnvironmentalScienceCourses] },
    ],
    courseBuckets: [
      { id: "tacoma-envs-prep", label: "Preparatory courses", minCredits: 63, courseCodes: ["TBIOL 120", "TBIOL 130", "TBIOL 140", "TCHEM 142", "TCHEM 152", "TCHEM 162", "TMATH 110", "TMATH 124", "TMATH 125", "TPHYS 121"] },
      { id: "tacoma-envs-core", label: "Core courses", minCredits: 20, courseCodes: ["TESC 310", "TESC 200", "TESC 410", "TBIOL 340", "TCHEM 333"] },
      { id: "tacoma-envs-electives", label: "Elective courses for Environmental Science major", minCredits: 29, courseCodes: tacomaEnvironmentalScienceCourses },
      { id: "tacoma-envs-capstone", label: "Capstone", courseCodes: ["TBIOL 464", "TBIOMD 490", "TBIOMD 491", "TBIOMD 495", "TESC 301", "TESC 495", "TESC 496", "TESC 497", "TESC 499", "TGIS 415", "TGH 494", "TGH 496", "TMATH 495"] },
    ],
    genEdRequirements: ["minimum 135 credits", "Preparatory courses must have been completed within the last 5 years", "Online lab courses will not be accepted", "minimum of one course from List A and minimum of one course from List B", "at least two must be laboratory", "one must be a field"],
    requirementLabels: ["Environmental Science Degree Requirements", "General Environmental Science Option", "Conservation Biology and Ecology Option", "Geoscience Option", "Portfolio Requirements"],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-environmental-sustainability",
    title: "Environmental Sustainability",
    officialSources: ["https://www.tacoma.uw.edu/sias/sam/environmental-sustainability"],
    expectedPathwayIds: [
      "business-nonprofit-leadership-option",
      "environmental-communication-option",
      "policy-law-option",
      "education-option",
    ],
    pathwayGroups: [
      { id: "business-nonprofit-leadership-option", label: "Business/Nonprofit Environmental Sustainability Option", suggestedCourses: tacomaEnvironmentalSustainabilityCourses },
      { id: "environmental-communication-option", label: "Environmental Communication Option", suggestedCourses: tacomaEnvironmentalSustainabilityCourses },
      { id: "policy-law-option", label: "Environmental Policy and Law Option", suggestedCourses: tacomaEnvironmentalSustainabilityCourses },
      { id: "education-option", label: "Environmental Education Option", suggestedCourses: tacomaEnvironmentalSustainabilityCourses },
    ],
    requiredCourseCodes: tacomaEnvironmentalSustainabilityCourses,
    optionGroups: [
      { id: "tacoma-envsus-options", label: "Students also choose one of four options for in-depth study", options: [tacomaEnvironmentalSustainabilityCourses] },
      { id: "tacoma-envsus-education", label: "Environmental Education Option", options: [["TEDUC 290", "TEDUC 471", "TEDUC 482"]] },
    ],
    courseBuckets: [
      { id: "tacoma-envsus-core", label: "Core courses", minCredits: 40, courseCodes: tacomaEnvironmentalSustainabilityCourses },
      { id: "tacoma-envsus-option", label: "Option", minCredits: 20, courseCodes: tacomaEnvironmentalSustainabilityCourses },
      { id: "tacoma-envsus-degree", label: "Environmental Sustainability", minCredits: 100, courseCodes: tacomaEnvironmentalSustainabilityCourses },
    ],
    genEdRequirements: ["minimum of 45 lower-division credits", "100 major credits", "minimum of 180 credits", "UWT general education", "graduation requirements"],
    requirementLabels: ["Environmental Sustainability", "Environmental Communication", "Environmental Policy and Law", "Business/Nonprofit Environmental Sustainability", "Environmental Education"],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-sustainable-urban-development",
    title: "Sustainable Urban Development",
    officialSources: ["https://www.tacoma.uw.edu/urban-studies/ba-sustainable-urban-development"],
    expectedPathwayIds: ["community-engagement-option", "gis-option"],
    pathwayGroups: [
      { id: "community-engagement-option", label: "Community Engagement", suggestedCourses: tacomaSustainableUrbanDevelopmentCourses },
      { id: "gis-option", label: "Geographic Information Systems (GIS)", suggestedCourses: tacomaSustainableUrbanDevelopmentCourses },
    ],
    requiredCourseCodes: tacomaSustainableUrbanDevelopmentCourses,
    optionGroups: [
      { id: "tacoma-sud-options", label: "Community Engagement or Geographic Information Systems (GIS)", options: [tacomaSustainableUrbanDevelopmentCourses] },
      { id: "tacoma-sud-foundation", label: "Foundation Courses", options: singleOptions(["TURB 220", "TSUD 222", "TSUD 240", "TGIS 311", "TURB 314", "TURB 322", "TURB 410", "TSUD 444", "TSUD 445"]) },
    ],
    courseBuckets: [
      { id: "tacoma-sud-shared", label: "Shared Curriculum courses", minCredits: 20, courseCodes: ["TURB 101", "TURB 103", "TURB 110", "TURB 200", "TURB 403"] },
      { id: "tacoma-sud-foundation", label: "Foundation courses", minCredits: 25, maxCredits: 26, courseCodes: ["TURB 220", "TSUD 222", "TSUD 240", "TGIS 311", "TURB 314", "TURB 322", "TURB 410", "TSUD 444", "TSUD 445"] },
      { id: "tacoma-sud-options", label: "Formal options", minCredits: 25, courseCodes: tacomaSustainableUrbanDevelopmentCourses },
    ],
    genEdRequirements: ["70-71 credits", "general university requirements", "total number of credits to 180", "minimum 2.0 cumulative", "Major GPA: minimum 2.0 in each course required for the major"],
    requirementLabels: ["Sustainable Urban Development", "Community Engagement", "Geographic Information Systems", "Shared Curriculum", "Foundation Courses", "Formal Options"],
  },
];

module.exports = {
  environmentalPrograms,
};
