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

const tacomaRemainingPrograms = [
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-biomedical-sciences",
    title: "Biomedical Sciences (BS)",
    family: "biomedical-life-sciences",
    officialSources: ["https://www.tacoma.uw.edu/sias/sam/biomedical-sciences"],
    expectedPathwayIds: [],
    requiredCourseCodes: courses(`
      PHYS 114, PHYS 117, TBIOL 120, TBIOL 130, TBIOL 140, TBIOL 203, TBIOL 252, TBIOL 270,
      TBIOL 306, TBIOL 312, TBIOL 313, TBIOL 314, TBIOL 318, TBIOL 320, TBIOL 323, TBIOL 325,
      TBIOL 331, TBIOL 340, TBIOL 350, TBIOL 361, TBIOL 401, TBIOL 412, TBIOL 414, TBIOL 422,
      TBIOL 434, TBIOL 438, TBIOL 455, TBIOMD 199, TBIOMD 201, TBIOMD 310, TBIOMD 410, TBIOMD 490,
      TBIOMD 491, TBIOMD 492, TBIOMD 494, TBIOMD 495, TBIOMD 496, TBIOMD 499, TCHEM 142, TCHEM 152,
      TCHEM 162, TCHEM 245, TCHEM 251, TCHEM 261, TCHEM 271, TCHEM 333, TCHEM 405, TCHEM 406,
      TCHEM 433, TCHEM 439, TEGL 202, TEGL 210, TEGL 401, TEGL 464, TESC 210, TESC 345,
      TESC 433, TESC 435, TGH 494, TGH 496, THLEAD 407, THLEAD 410, THLTH 310, THLTH 325,
      THLTH 355, THLTH 372, THLTH 470, THLTH 485, TMATH 110, TMATH 124, TMATH 125, TMATH 126,
      TMATH 207, TMATH 208, TMATH 210, TPHIL 361, TPHIL 455, TPHYS 121, TPHYS 122, TPHYS 123,
      TPSYCH 220, TPSYCH 260, TPSYCH 360, TPSYCH 361, TPSYCH 362, TPSYCH 441, TSOCWF 350, TSOCWF 353,
      TSOCWF 355
    `),
    optionGroups: [
      { id: "biomedical-electives-list-a", label: "List A: Biomedical Electives", options: singleOptions(courses("TBIOL 312, TBIOL 320, TBIOL 350, TBIOL 401, TBIOL 412, TBIOL 414, TBIOL 455, TCHEM 271, TCHEM 433, TBIOL 361, TPSYCH 361")) },
      { id: "biomedical-electives-list-b", label: "List B: Environmental Context Electives", options: singleOptions(courses("TBIOL 203, TBIOL 306, TBIOL 318, TBIOL 340, TBIOL 422, TBIOL 434, TBIOL 438, TCHEM 245, TCHEM 333, TCHEM 439, TESC 210, TESC 433, TESC 435, TMATH 207, TMATH 208, TMATH 210")) },
      { id: "biomedical-capstone", label: "Capstone", options: singleOptions(courses("TBIOMD 490, TBIOMD 491, TBIOMD 492, TBIOMD 494, TBIOMD 495, TBIOMD 496, TBIOMD 499, TGH 494, TGH 496")) },
    ],
    courseBuckets: [
      { id: "biomedical-intro", label: "Introductory courses", minCredits: 64, courseCodes: courses("TCHEM 142, TCHEM 152, TCHEM 162, TBIOL 120, TBIOL 130, TBIOL 140, TMATH 124, TMATH 125, TCHEM 251, TCHEM 261, TPHYS 121, PHYS 114, PHYS 117") },
      { id: "biomedical-core", label: "Core courses", minCredits: 39, courseCodes: courses("TBIOL 331, TBIOL 313, TBIOL 323, TBIOL 314, TBIOL 325, TCHEM 405, TCHEM 406") },
      { id: "biomedical-electives", label: "Biomedical Electives", minCredits: 15, courseCodes: courses("TBIOL 312, TBIOL 320, TBIOL 350, TBIOL 401, TBIOL 412, TBIOL 414, TBIOL 455, TCHEM 271, TCHEM 433, TBIOL 361, TPSYCH 361") },
      { id: "biomedical-bookend", label: "Bookend courses", minCredits: 8, courseCodes: courses("TBIOMD 310, TBIOMD 410") },
      { id: "biomedical-context", label: "Health and Society", minCredits: 5, courseCodes: courses("TBIOL 252, TBIOL 270, TBIOMD 201, TEGL 202, TEGL 401, TEGL 464, TESC 345, THLEAD 407, THLTH 310, THLTH 372, THLTH 470, THLTH 485, TPSYCH 220, TBIOL 260, TPSYCH 260, TPSYCH 360, TPSYCH 362, TPSYCH 441, TSOCWF 350, TSOCWF 353, TSOCWF 355") },
    ],
    genEdRequirements: ["The BS in Biomedical Sciences", "Pre-Autumn 2026 Requirements", "minimum grade of 2.0", "Capstone", "Statistics", "Ethics", "Health and Society"],
    requirementLabels: ["Biomedical Sciences", "Introductory courses", "Biomedical Electives", "Bookend courses"],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-ethnic-gender-and-labor-studies",
    title: "Ethnic, Gender and Labor Studies (BA)",
    family: "ethnic-gender-labor-studies",
    officialSources: [
      "https://www.tacoma.uw.edu/sias/socs/ethnic-gender-and-labor-studies",
      "https://www.tacoma.uw.edu/sias/socs/ethnic-studies-option",
      "https://www.tacoma.uw.edu/sias/socs/gender-studies-option",
      "https://www.tacoma.uw.edu/sias/socs/labor-studies-option",
    ],
    expectedPathwayIds: ["ethnic-studies-option", "gender-studies-option", "labor-studies-option"],
    requiredCourseCodes: courses(`
      TAMST 260, TAMST 430, TARTS 360, TARTS 406, TCOM 444, TECON 320, TECON 370, TECON 450,
      TEGL 101, TEGL 112, TEGL 201, TEGL 202, TEGL 210, TEGL 266, TEGL 271, TEGL 301,
      TEGL 302, TEGL 303, TEGL 304, TEGL 305, TEGL 310, TEGL 340, TEGL 365, TEGL 380,
      TEGL 401, TEGL 419, TEGL 435, TEGL 464, TEGL 498, TFILM 436, TFILM 438, TGEOG 349,
      TGEOG 352, TGEOG 420, THIST 220, THIST 221, THIST 222, THIST 322, THIST 341, THIST 349,
      THIST 413, THIST 416, THIST 420, THIST 437, THIST 440, THIST 441, THIST 457, THIST 495,
      TLAW 348, TLAW 452, TLAX 238, TLAX 250, TLAX 267, TLAX 290, TLAX 333, TLAX 340,
      TLAX 355, TLAX 356, TLAX 360, TLAX 380, TLAX 400, TLAX 462, TLAX 476, TLIT 230,
      TLIT 320, TLIT 324, TLIT 332, TLIT 335, TLIT 388, TLIT 425, TLIT 431, TLIT 432,
      TLIT 433, TLIT 476, TPOLS 270, TPOLS 317, TPOLS 329, TPOLS 343, TPOLS 410, TPSYCH 202,
      TPSYCH 320, TPSYCH 349, TPSYCH 400, TPSYCH 403, TPSYCH 431, TPSYCH 432, TPSYCH 461, TSOC 265,
      TSOC 270, TSOC 335, TSOC 365, TSOC 434, TSOC 437, TSOC 439, TSOC 455, TSOC 460,
      TSOC 465, TSOC 470, TSOCWF 354, TURB 312, TURB 314, TWOMN 101, TWOMN 205, TWOMN 211,
      TWOMN 250, TWOMN 251, TWOMN 302, TWOMN 345, TWOMN 347, TWOMN 420, TWOMN 434, TWOMN 455,
      TWRT 340
    `),
    optionGroups: [
      { id: "egls-options", label: "Ethnic Studies Option, Gender Studies Option, or Labor Studies Option", options: [] },
    ],
    courseBuckets: [
      { id: "egls-complete-course-set", label: "Ethnic Studies Electives", courseCodes: courses("TEGL 101, TEGL 201, TEGL 202, TEGL 210, TEGL 401, TEGL 464, TWOMN 101, TWOMN 205, TSOC 265, TSOC 270, TSOC 335, TSOC 365") },
    ],
    genEdRequirements: ["Ethnic, Gender and Labor Studies (BA)", "Ethnic Studies Option", "Gender Studies Option", "Labor Studies Option"],
    requirementLabels: ["Ethnic, Gender and Labor Studies", "Ethnic Studies", "Gender Studies", "Labor Studies"],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-history",
    title: "History (BA)",
    family: "history",
    officialSources: [
      "https://www.tacoma.uw.edu/sias/socs/general-history-option",
      "https://www.tacoma.uw.edu/sias/socs/arts-culture-and-society-option",
      "https://www.tacoma.uw.edu/sias/socs/global-history-option",
      "https://www.tacoma.uw.edu/sias/socs/labor-and-social-movements-option",
      "https://www.tacoma.uw.edu/sias/socs/power-gender-and-identity-option",
    ],
    expectedPathwayIds: ["arts-culture-and-society-option", "general-history-option", "global-history-option", "labor-and-social-movements-option", "power-gender-and-identity-option"],
    requiredCourseCodes: unique(courses(`
      TARTS 335, TARTS 360, TARTS 480, TEGL 271, TEGL 303, TEGL 305, TEGL 340, TEGL 380,
      TEGL 419, THIST 101, THIST 111, THIST 112, THIST 150, THIST 151, THIST 200, THIST 201,
      THIST 220, THIST 221, THIST 222, THIST 251, THIST 260, THIST 270, THIST 271, THIST 290,
      THIST 322, THIST 336, THIST 341, THIST 350, THIST 365, THIST 375, THIST 376, THIST 377,
      THIST 380, THIST 416, THIST 417, THIST 420, THIST 440, THIST 441, THIST 442, THIST 444,
      THIST 457, THIST 464, THIST 465, THIST 466, THIST 475, THIST 479, THIST 484, THIST 487,
      THIST 491, THIST 495, THIST 498, TLAX 238, TLAX 400, TLIT 230, TLIT 433,
      TPOLS 317, TPOLS 329, TPOLS 343, TPOLS 360, TSOC 265, TSOC 270, TWOMN 347
    `)),
    optionGroups: [
      { id: "history-options", label: "General History option, Arts, Culture and Society option, Global History option, Labor and Social Movements option, or Power, Gender and Identity option", options: [] },
    ],
    courseBuckets: [
      { id: "history-core", label: "Core Requirements", minCredits: 30, courseCodes: courses("THIST 150, THIST 151, THIST 200, THIST 201, THIST 380, THIST 498") },
      { id: "history-electives", label: "Electives with a THIST prefix", minCredits: 30, courseCodes: courses("THIST 101, THIST 111, THIST 112, THIST 220, THIST 221, THIST 222, THIST 251, THIST 260, THIST 270, THIST 271, THIST 290, THIST 322, THIST 336, THIST 341, THIST 350, THIST 365, THIST 375, THIST 376, THIST 377, THIST 416, THIST 417, THIST 420, THIST 440, THIST 441, THIST 442, THIST 444, THIST 457, THIST 464, THIST 465, THIST 466, THIST 475, THIST 479, THIST 484, THIST 487, THIST 491, THIST 495") },
    ],
    genEdRequirements: ["History (BA)", "30 credits of Core courses", "30 credits of Electives", "25 credits must be upper-division"],
    requirementLabels: ["History", "Core Requirements", "General History option", "Global History option"],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-interdisciplinary-arts-and-sciences",
    title: "Interdisciplinary Arts and Sciences (BA)",
    family: "interdisciplinary-individualized-studies",
    officialSources: ["https://www.tacoma.uw.edu/sias/socs/interdisciplinary-arts-and-sciences"],
    expectedPathwayIds: ["ba-route"],
    publicAdmissionsLabels: ["Global Studies"],
    requiredCourseCodes: courses(`
      TARTS 200, TARTS 240, TARTS 280, TARTS 311, TARTS 315, TARTS 367, TARTS 386, TARTS 404,
      TARTS 405, TARTS 406, TARTS 407, TARTS 469, TARTS 471, TBIOL 203, TBIOL 232, TBIOL 234,
      TBIOL 240, TBIOL 270, TBIOL 422, TCOM 221, TCOM 254, TECON 101, TECON 350, TEGL 112,
      TEGL 202, TEGL 266, TEGL 301, TEGL 302, TEGL 303, TEGL 401, TESC 102, TESC 201,
      TESC 239, TESC 345, TEST 332, TFILM 201, TFILM 377, TFILM 483, TGEOS 227, TGEOS 243,
      TGEOS 341, THIST 150, THIST 151, THIST 200, THIST 201, THIST 220, THIST 221, THIST 222,
      THIST 251, THIST 336, THIST 350, THIST 366, THIST 375, THIST 377, THIST 413, THIST 416,
      THIST 475, THIST 487, TIAS 305, TLAW 339, TLAW 438, TLAX 277, TLAX 355, TLAX 376,
      TLAX 441, TLAX 465, TLAX 476, TLIT 101, TLIT 220, TLIT 230, TLIT 240, TLIT 251,
      TLIT 252, TLIT 253, TLIT 311, TLIT 313, TLIT 320, TLIT 324, TLIT 325, TLIT 332,
      TLIT 343, TLIT 351, TLIT 352, TLIT 371, TLIT 388, TLIT 390, TLIT 406, TLIT 425,
      TLIT 431, TLIT 432, TLIT 433, TLIT 437, TLIT 476, TMATH 105, TMATH 110, TMATH 116,
      TMATH 120, TMATH 124, TMATH 210, TPHIL 250, TPHIL 355, TPHIL 358, TPHIL 360, TPHIL 361,
      TPHIL 367, TPHIL 451, TPHIL 456, TPHYS 315, TPOLS 202, TPOLS 230, TPSYCH 101, TPSYCH 240,
      TPSYCH 345, TPSYCH 360, TPSYCH 403, TPSYCH 404, TPSYCH 418, TPSYCH 422, TPSYCH 450, TPSYCH 455,
      TPSYCH 460, TRELIG 350, TRELIG 365, TRELIG 366, TSOC 434, TSOC 455, TURB 340, TWOMN 211,
      TWOMN 347, TWRT 270, TWRT 280, TWRT 470, TWRT 480
    `),
    optionGroups: [
      { id: "ias-core-lists", label: "List A, List B, List C, and List D", options: [] },
      { id: "ias-elective-lists", label: "Scientific Thinking, Humans and Their Environment, History or The Human Past, and Society and Culture", options: [] },
    ],
    courseBuckets: [
      { id: "ias-core", label: "Core courses", minCredits: 22, courseCodes: courses("THIST 150, THIST 151, THIST 200, THIST 201, TESC 102, TESC 201, TARTS 200, TFILM 201, TLIT 101, TECON 101, TPOLS 202, TPSYCH 101, TIAS 305") },
      { id: "ias-electives", label: "45 credits Elective courses", minCredits: 45, courseCodes: [] },
    ],
    genEdRequirements: ["Interdisciplinary Arts and Sciences (BA)", "Core courses", "45 credits Elective courses", "minimum of 20 credits at the 400-level"],
    requirementLabels: ["Interdisciplinary Arts and Sciences", "Scientific Thinking", "Humans and Their Environment", "History or The Human Past", "Society and Culture"],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed",
    title: "Interdisciplinary Arts and Sciences: Individually-designed (BA)",
    family: "interdisciplinary-individualized-studies",
    officialSources: ["https://www.washington.edu/students/gencat/program/T/SocialSciences-1132.html"],
    expectedPathwayIds: [],
    requiredCourseCodes: courses("ENGL 131, TIAS 497"),
    optionGroups: [],
    courseBuckets: [
      { id: "ias-individually-designed-english-composition", label: "English composition", courseCodes: courses("ENGL 131") },
      { id: "ias-individually-designed-required-course", label: "Required Course", courseCodes: courses("TIAS 497") },
    ],
    genEdRequirements: ["Individually Designed", "Bachelor of Arts", "55 credits"],
    requirementLabels: ["Individually-designed concentration", "Individually-Designed Core", "Required Course"],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-spanish-language-and-cultures",
    title: "Spanish Language and Cultures (BA)",
    family: "spanish-language-cultures",
    officialSources: ["https://www.tacoma.uw.edu/sias/cac/spanish-language-and-cultures"],
    expectedPathwayIds: [],
    requiredCourseCodes: courses(`
      TSPAN 299, TSPAN 301, TSPAN 302, TSPAN 303, TSPAN 335, TSPAN 345, TSPAN 348, TSPAN 351,
      TSPAN 352, TSPAN 361, TSPAN 371, TSPAN 374, TSPAN 376, TSPAN 388, TSPAN 393, TSPAN 420,
      TSPAN 425, TSPAN 430, TSPAN 451, TSPAN 464, TSPAN 480, TSPAN 496
    `),
    optionGroups: [
      { id: "spanish-upper-division", label: "Electives", options: singleOptions(courses("TSPAN 335, TSPAN 345, TSPAN 348, TSPAN 351, TSPAN 352, TSPAN 361, TSPAN 371, TSPAN 374, TSPAN 376, TSPAN 388, TSPAN 393, TSPAN 420, TSPAN 425, TSPAN 430, TSPAN 451, TSPAN 464, TSPAN 480, TSPAN 496")) },
    ],
    courseBuckets: [
      { id: "spanish-core", label: "Core courses", courseCodes: courses("TSPAN 301, TSPAN 302, TSPAN 303") },
      { id: "spanish-electives", label: "Electives", courseCodes: courses("TSPAN 335, TSPAN 345, TSPAN 348, TSPAN 351, TSPAN 352, TSPAN 361, TSPAN 371, TSPAN 374, TSPAN 376, TSPAN 388, TSPAN 393, TSPAN 420, TSPAN 425, TSPAN 430, TSPAN 451, TSPAN 464, TSPAN 480, TSPAN 496") },
    ],
    genEdRequirements: ["Spanish Language and Cultures (BA)", "Spanish Language and Cultures"],
    requirementLabels: ["Spanish Language and Cultures", "Core courses", "electives"],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-urban-design",
    title: "Urban Design (BS)",
    family: "urban-planning-design",
    officialSources: ["https://www.tacoma.uw.edu/urban-studies/bs-urban-design"],
    expectedPathwayIds: [],
    requiredCourseCodes: courses(`
      ENGL 131, TGIS 311, TUDE 101, TUDE 210, TUDE 260, TUDE 310, TUDE 340, TUDE 350,
      TUDE 360, TUDE 440, TUDE 450, TUDE 460, TURB 101, TURB 102, TURB 103, TURB 110,
      TURB 200, TURB 220, TURB 250, TURB 312, TURB 322, TURB 403, TURB 480
    `),
    optionGroups: [
      { id: "urban-design-equity-choice", label: "One of the following classes", options: singleOptions(courses("TURB 250, TURB 312, TURB 322, TURB 480")) },
    ],
    courseBuckets: [
      { id: "urban-design-shared", label: "Shared Curriculum Courses", minCredits: 20, courseCodes: courses("TURB 101, TURB 103, TURB 110, TURB 200, TURB 403") },
      { id: "urban-design-core", label: "Urban Design core courses", minCredits: 61, courseCodes: courses("TGIS 311, TUDE 210, TURB 220, TUDE 260, TUDE 310, TUDE 340, TUDE 350, TUDE 360, TUDE 440, TUDE 450, TUDE 460") },
    ],
    genEdRequirements: ["Bachelor of Science", "Urban Design", "Major Requirements", "Shared Curriculum", "General electives"],
    requirementLabels: ["BS in Urban Design", "Urban Design core courses", "Urban Design Studio"],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-urban-studies",
    title: "Urban Studies (BA)",
    family: "urban-planning-design",
    officialSources: ["https://www.tacoma.uw.edu/urban-studies/ba-urban-studies"],
    expectedPathwayIds: ["community-engagement-option", "gis-option"],
    publicAdmissionsLabels: ["Community Development & Planning", "GIS & Spatial Planning"],
    requiredCourseCodes: unique(courses(`
      ENGL 131, TGIS 311, TGIS 312, TGIS 313, TGIS 350, TGIS 414, TGIS 415, TGIS 450,
      TGIS 460, TGIS 470, TUDE 310, TUDE 340, TURB 101, TURB 102, TURB 103, TURB 110,
      TURB 200, TURB 210, TURB 220, TURB 225, TURB 235, TURB 250, TURB 312, TURB 316,
      TURB 345, TURB 379, TURB 403, TURB 432, TURB 470, TURB 479, TURB 480, TURB 498
    `)),
    optionGroups: [
      { id: "urban-studies-options", label: "Community Engagement option or GIS option", options: [] },
      { id: "urban-studies-gis-option", label: "GIS option", options: singleOptions(courses("TGIS 311, TGIS 312, TGIS 313, TGIS 350, TGIS 414, TGIS 415, TGIS 450, TGIS 460, TGIS 470")) },
    ],
    courseBuckets: [
      { id: "urban-studies-shared", label: "Shared Curriculum Courses", courseCodes: courses("TURB 101, TURB 103, TURB 110, TURB 200, TURB 403") },
      { id: "urban-studies-core", label: "Shared Curriculum", courseCodes: courses("TURB 210, TURB 220, TURB 225, TURB 235, TURB 250, TURB 312, TURB 316, TURB 345, TURB 379, TURB 432, TURB 470, TURB 479, TURB 480, TURB 498") },
    ],
    genEdRequirements: ["Bachelor of Arts", "Urban Studies", "Community Engagement option", "GIS option", "General electives"],
    requirementLabels: ["BA in Urban Studies", "Shared Curriculum", "Community Engagement", "GIS"],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-writing-studies",
    title: "Writing Studies (BA)",
    family: "writing-english-literature",
    officialSources: ["https://www.tacoma.uw.edu/sias/cac/writing-studies"],
    expectedPathwayIds: ["creative-writing-track", "technical-communication-track", "writing-and-social-change-track"],
    requiredCourseCodes: courses(`
      TARTS 395, TARTS 405, TARTS 410, TCOM 220, TCOM 221, TCOM 250, TCOM 275, TCOM 310,
      TCOM 320, TCOM 348, TCOM 349, TCOM 387, TCOM 482, TCOM 484, TCOM 486, TCORE 101,
      TCSS 142, TEDUC 301, TEDUC 310, TEDUC 471, TEDUC 474, TEGL 306, TEGL 380, TEGL 401,
      TEGL 419, TEGL 435, TESC 201, TEST 332, TEST 335, TFILM 434, TGEOS 241, TGEOS 243,
      TGEOS 341, TIAS 491, TINFO 210, TINFO 220, TINFO 230, TINFO 310, TINFO 370, TINST 207,
      TINST 312, TINST 401, TINST 475, TLAX 333, TLAX 356, TLAX 380, TLAX 476, TLIT 101,
      TLIT 335, TLIT 343, TLIT 351, TLIT 352, TLIT 390, TLIT 406, TNPRFT 451, TSOC 254,
      TSOC 335, TSOC 365, TSOC 434, TSOC 437, TSOC 455, TSOC 465, TWOMN 211, TWOMN 434,
      TWOMN 455, TWRT 121, TWRT 200, TWRT 201, TWRT 211, TWRT 270, TWRT 274, TWRT 280,
      TWRT 287, TWRT 291, TWRT 292, TWRT 320, TWRT 330, TWRT 331, TWRT 333, TWRT 340,
      TWRT 350, TWRT 353, TWRT 355, TWRT 360, TWRT 364, TWRT 365, TWRT 372, TWRT 382,
      TWRT 384, TWRT 388, TWRT 389, TWRT 391, TWRT 420, TWRT 440, TWRT 450, TWRT 470,
      TWRT 480, TWRT 487, TWRT 492, TWRT 499
    `),
    optionGroups: [
      { id: "writing-studies-tracks", label: "Creative Writing Track, Technical Communication Track, or Writing and Social Change Track", options: [] },
      { id: "writing-studies-core", label: "Writing Studies core", options: [["TWRT 121"], ["TWRT 211"]] },
    ],
    courseBuckets: [
      { id: "writing-creative", label: "Creative Writing Track", courseCodes: courses("TWRT 201, TWRT 287, TWRT 291, TWRT 292, TWRT 320, TWRT 330, TWRT 331, TWRT 333, TWRT 350, TWRT 353, TWRT 355, TWRT 364, TWRT 365, TWRT 388, TWRT 389, TWRT 420, TWRT 440, TWRT 450, TWRT 487, TWRT 492, TWRT 499") },
      { id: "writing-technical", label: "Technical Communication Track", courseCodes: courses("TWRT 200, TWRT 270, TWRT 280, TWRT 287, TWRT 291, TWRT 320, TWRT 340, TWRT 360, TWRT 372, TWRT 382, TWRT 384, TWRT 391, TWRT 470, TWRT 480") },
      { id: "writing-social-change", label: "Writing and Social Change Track", courseCodes: courses("TWRT 211, TWRT 274, TWRT 287, TWRT 291, TWRT 340, TWRT 388, TWRT 389, TWRT 391, TWRT 470, TWRT 480") },
    ],
    genEdRequirements: ["The BA in Writing Studies", "Writing Studies", "Creative Writing Track", "Technical Communication Track", "Writing and Social Change Track"],
    requirementLabels: ["Writing Studies", "Creative Writing", "Technical Communication", "Writing and Social Change"],
  },
];

const seattleEnglishHistoricalDepthCourses = courses(`
  ENGL 210, ENGL 211, ENGL 212, ENGL 225, ENGL 300, ENGL 303, ENGL 310, ENGL 312,
  ENGL 314, ENGL 315, ENGL 320, ENGL 321, ENGL 322, ENGL 323, ENGL 324, ENGL 325,
  ENGL 326, ENGL 327, ENGL 328, ENGL 329, ENGL 330, ENGL 331, ENGL 332, ENGL 333,
  ENGL 335, ENGL 336, ENGL 337, ENGL 338, ENGL 351, ENGL 352, ENGL 353, ENGL 354,
  ENGL 361, ENGL 373, ENGL 376, ENGL 380, ENGL 385, ENGL 421, ENGL 422
`);

const seattleEnglishPowerDifferenceCourses = courses(`
  ENGL 207, ENGL 208, ENGL 251, ENGL 256, ENGL 257, ENGL 258, ENGL 259, ENGL 265,
  ENGL 307, ENGL 308, ENGL 311, ENGL 312, ENGL 314, ENGL 316, ENGL 317, ENGL 318,
  ENGL 319, ENGL 322, ENGL 327, ENGL 331, ENGL 339, ENGL 340, ENGL 349, ENGL 351,
  ENGL 352, ENGL 355, ENGL 357, ENGL 358, ENGL 359, ENGL 360, ENGL 361, ENGL 362,
  ENGL 364, ENGL 365, ENGL 366, ENGL 367, ENGL 368, ENGL 372, ENGL 379, ENGL 385,
  ENGL 386, ENGL 466, ENGL 478, ENGL 479
`);

const seattleEnglishGenreMethodLanguageCourses = courses(`
  ENGL 200, ENGL 204, ENGL 205, ENGL 206, ENGL 207, ENGL 208, ENGL 213, ENGL 242,
  ENGL 243, ENGL 244, ENGL 250, ENGL 256, ENGL 259, ENGL 265, ENGL 266, ENGL 270,
  ENGL 277, ENGL 281, ENGL 282, ENGL 283, ENGL 284, ENGL 285, ENGL 288, ENGL 296,
  ENGL 297, ENGL 298, ENGL 299, ENGL 303, ENGL 304, ENGL 306, ENGL 307, ENGL 308,
  ENGL 309, ENGL 313, ENGL 315, ENGL 318, ENGL 326, ENGL 329, ENGL 332, ENGL 333,
  ENGL 337, ENGL 338, ENGL 339, ENGL 341, ENGL 342, ENGL 343, ENGL 344, ENGL 345,
  ENGL 346, ENGL 347, ENGL 348, ENGL 349, ENGL 350, ENGL 356, ENGL 362, ENGL 363,
  ENGL 364, ENGL 365, ENGL 366, ENGL 369, ENGL 370, ENGL 371, ENGL 373, ENGL 374,
  ENGL 375, ENGL 376, ENGL 378, ENGL 381, ENGL 382, ENGL 383, ENGL 384, ENGL 387,
  ENGL 388, ENGL 390, ENGL 391, ENGL 392, ENGL 394, ENGL 396, ENGL 411, ENGL 413,
  ENGL 421, ENGL 422, ENGL 453, ENGL 457, ENGL 470, ENGL 471, ENGL 472, ENGL 474,
  ENGL 477, ENGL 478, ENGL 479, ENGL 480, ENGL 481, ENGL 482, ENGL 483, ENGL 484,
  ENGL 485, ENGL 486, ENGL 487, ENGL 488
`);

const seattleEnglishCreativeWritingCourses = courses(`
  ENGL 283, ENGL 284, ENGL 383, ENGL 384, ENGL 387, ENGL 483, ENGL 484, ENGL 485,
  ENGL 486
`);

const crossCampusEquivalentPrograms = [
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-marine-biology",
    title: "Marine Biology (BS)",
    family: "biomedical-life-sciences",
    officialSources: [
      "https://marinebiology.uw.edu/students/marine-biology-major/major-requirements/",
      "https://marinebiology.uw.edu/wp-content/uploads/sites/31/2026/05/2026.5.7-Marbiol-Major-Sheet.pdf",
    ],
    expectedPathwayIds: [],
    requiredCourseCodes: courses(`
      BIOL 180, BIOL 200, BIOL 220, BIOL 311, BIOL 340, BIOL 423, BIOL 430, BIOL 432,
      BIOL 434, BIOL 445, CHEM 120, CHEM 142, CHEM 143, CHEM 145, CHEM 152, CHEM 153,
      CHEM 155, CHEM 220, CHEM 223, CHEM 237, FHL 333, FHL 375, FHL 403, FHL 420,
      FHL 430, FHL 440, FHL 446, FHL 467, FHL 468, FHL 470, FHL 471, FHL 472,
      FHL 480, FHL 490, FHL 492, FHL 495, FISH 270, FISH 310, FISH 312, FISH 323,
      FISH 406, FISH 423, FISH 427, FISH 437, FISH 444, FISH 450, FISH 454, FISH 458,
      FISH 460, FISH 464, FISH 470, FISH 478, FISH 497, MARBIO 270, MARBIO 301,
      MARBIO 302, MARBIO 305, MARBIO 433, MARBIO 479, MARBIO 488, MATH 124, MATH 125,
      OCEAN 210, OCEAN 270, OCEAN 295, OCEAN 330, OCEAN 370, OCEAN 402, OCEAN 403,
      OCEAN 409, OCEAN 411, OCEAN 431, OCEAN 432, OCEAN 450, OCEAN 480, OCEAN 497,
      PHYS 114, PHYS 115, PHYS 121, PHYS 122, QSCI 291, QSCI 292, QSCI 381, STAT 311
    `),
    optionGroups: [
      { id: "marine-biology-chemistry", label: "Chemistry choose one sequence", options: [["CHEM 120", "OCEAN 295"], ["CHEM 120", "CHEM 220"], ["CHEM 142", "CHEM 152", "OCEAN 295"], ["CHEM 142", "CHEM 152", "CHEM 223"], ["CHEM 143", "CHEM 153"], ["CHEM 145", "CHEM 155"], ["CHEM 237"]] },
      { id: "marine-biology-biology", label: "FISH/OCEAN/MARBIO 270 or BIOL 220", options: [["FISH 270"], ["OCEAN 270"], ["MARBIO 270"], ["BIOL 220"]] },
      { id: "marine-biology-statistics", label: "Statistics choose one", options: [["QSCI 381"], ["STAT 311"]] },
      { id: "marine-biology-math", label: "Math choose one sequence", options: [["QSCI 291", "QSCI 292"], ["MATH 124", "MATH 125"]] },
      { id: "marine-biology-physics", label: "Physics choose one sequence", options: [["PHYS 114", "PHYS 115"], ["PHYS 121", "PHYS 122"]] },
    ],
    courseBuckets: [
      { id: "marine-biology-foundation", label: "Foundation Courses in Science and Mathematics", courseCodes: courses("CHEM 120, CHEM 142, CHEM 143, CHEM 145, CHEM 152, CHEM 153, CHEM 155, CHEM 220, CHEM 223, CHEM 237, OCEAN 295, BIOL 180, BIOL 200, BIOL 220, FISH 270, OCEAN 270, MARBIO 270, QSCI 381, STAT 311, QSCI 291, QSCI 292, MATH 124, MATH 125, PHYS 114, PHYS 115, PHYS 121, PHYS 122") },
      { id: "marine-biology-core", label: "Marine Biology core", courseCodes: courses("MARBIO 301, MARBIO 302, MARBIO 305") },
      { id: "marine-biology-electives", label: "Major Electives", minCredits: 20, courseCodes: courses("BIOL 311, BIOL 340, BIOL 423, BIOL 430, BIOL 432, BIOL 434, BIOL 445, FHL 333, FHL 375, FHL 403, FHL 420, FHL 430, FHL 440, FHL 446, FHL 467, FHL 468, FHL 470, FHL 471, FHL 472, FHL 480, FHL 490, FHL 492, FHL 495, FISH 310, FISH 312, FISH 323, FISH 406, FISH 423, FISH 427, FISH 437, FISH 444, FISH 450, FISH 454, FISH 458, FISH 460, FISH 464, FISH 470, FISH 478, FISH 497, MARBIO 433, MARBIO 479, MARBIO 488, OCEAN 210, OCEAN 330, OCEAN 370, OCEAN 402, OCEAN 403, OCEAN 409, OCEAN 411, OCEAN 431, OCEAN 432, OCEAN 450, OCEAN 480, OCEAN 497") },
    ],
    genEdRequirements: ["Bachelor of Science", "College of the Environment General Education Requirements", "180 quarter credits", "minimum cumulative GPA of 2.0"],
    requirementLabels: ["Foundation Courses in Science and Mathematics", "Chemistry", "Biology", "Statistics", "Math", "Physics", "Major Electives"],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-medical-laboratory-science",
    title: "Medical Laboratory Science (BS)",
    family: "biomedical-life-sciences",
    officialSources: [
      "https://dlmp.uw.edu/education/mls-requirements",
      "https://dlmp.uw.edu/education/mls-courses",
    ],
    expectedPathwayIds: [],
    requiredCourseCodes: courses(`
      BIOC 405, BIOL 180, BIOL 200, BIOL 220, CHEM 142, CHEM 152, CHEM 162, CHEM 223,
      CHEM 237, IMMUN 441, LABM 301, LABM 302, LABM 400, LABM 403, LABM 404, LABM 405,
      LABM 418, LABM 419, LABM 420, LABM 421, LABM 423, LABM 424, LABM 425, LABM 426,
      LABM 427, LABM 430, LABM 431, LABM 435, LABM 436, MICROM 442, MICROM 443,
      MICROM 460, QSCI 381, STAT 220, STAT 311
    `),
    optionGroups: [
      { id: "mls-organic-chemistry", label: "Organic Chemistry 223 or 237", options: [["CHEM 223"], ["CHEM 237"]] },
      { id: "mls-statistics", label: "Any Basic 5-credit Statistics course", options: [["QSCI 381"], ["STAT 220"], ["STAT 311"]] },
    ],
    courseBuckets: [
      { id: "mls-pre-professional", label: "Pre-Professional Phase prerequisite course requirements", courseCodes: courses("BIOL 180, BIOL 200, BIOL 220, CHEM 142, CHEM 152, CHEM 162, CHEM 223, CHEM 237, QSCI 381, STAT 220, STAT 311") },
      { id: "mls-professional-phase", label: "Professional Phase course schedule", courseCodes: courses("IMMUN 441, BIOC 405, LABM 301, LABM 302, LABM 405, LABM 430, LABM 435, MICROM 442, MICROM 443, MICROM 460, LABM 419, LABM 420, LABM 421, LABM 403, LABM 418, LABM 400, LABM 426, LABM 404, LABM 427, LABM 423, LABM 424, LABM 425, LABM 431, LABM 436") },
    ],
    genEdRequirements: ["English Composition", "additional Writing-intensive", "Reasoning", "Arts and Humanities", "Social Sciences", "Diversity Course"],
    requirementLabels: ["Pre-Professional Phase", "Professional Phase", "Graduation Requirements", "Clinical Chemistry Rotation", "Clinical Microbiology Rotation", "Clinical Hematology Rotation"],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-microbiology",
    title: "Microbiology (BS)",
    family: "biomedical-life-sciences",
    officialSources: ["https://microbiology.washington.edu/sites/default/files/2026-04/Microbiology_Degree_UPDATED%20SPR%202026.pdf"],
    expectedPathwayIds: [],
    requiredCourseCodes: courses(`
      BIOC 405, BIOC 406, BIOC 440, BIOC 441, BIOC 442, BIOEN 454, BIOEN 467, BIOEN 498,
      BIOL 180, BIOL 200, BIOL 220, BIOL 401, BIOL 419, BIOL 455, BIOL 466, BIOL 481,
      BIOST 310, CEE 462, CEE 482, CHEM 142, CHEM 143, CHEM 145, CHEM 152, CHEM 153,
      CHEM 155, CHEM 162, CHEM 165, CHEM 223, CHEM 224, CHEM 237, CHEM 238, CHEM 239,
      CHEM 335, CHEME 467, ENVH 409, ENVH 440, ENVH 441, ENVH 442, ENVH 444, ENVH 447,
      ENVH 451, ENVH 452, EPI 320, EPI 527, ESRM 404, ESRM 422, FISH 404, FISH 406,
      GENOME 361, GENOME 371, GENOME 372, GENOME 373, GENOME 414, GH 401, GH 402,
      GH 410, GH 454, IMMUN 441, MATH 124, MATH 125, MATH 126, MATH 134, MICROM 402,
      MICROM 410, MICROM 411, MICROM 412, MICROM 431, MICROM 442, MICROM 443, MICROM 445,
      MICROM 450, MICROM 460, MICROM 482, MICROM 495, MICROM 496, MICROM 499, MICROM 555,
      NUTR 446, OCEAN 330, OCEAN 431, OCEAN 530, OCEAN 572, PABIO 551, PABIO 552,
      PHYS 114, PHYS 115, PHYS 121, PHYS 122, PHYS 141, PHYS 142, QSCI 291, QSCI 292,
      QSCI 381, STAT 220, STAT 311
    `),
    optionGroups: [
      { id: "microbiology-chemistry", label: "Completion of one chemistry series", options: [["CHEM 142", "CHEM 152", "CHEM 162"], ["CHEM 143", "CHEM 153"], ["CHEM 145", "CHEM 155", "CHEM 165"]] },
      { id: "microbiology-organic", label: "Completion of either CHEM 223, CHEM 237, or CHEM 335", options: [["CHEM 223"], ["CHEM 237"], ["CHEM 335"]] },
      { id: "microbiology-math", label: "Mathematics choose one option", options: [["MATH 124"], ["MATH 134"], ["QSCI 291"]] },
      { id: "microbiology-statistics", label: "Statistics choose one option", options: [["BIOST 310"], ["QSCI 381"], ["STAT 220"], ["STAT 311"]] },
      { id: "microbiology-physics", label: "Physics choose one option", options: [["PHYS 114", "PHYS 115"], ["PHYS 121", "PHYS 122"], ["PHYS 141", "PHYS 142"]] },
      { id: "microbiology-biochemistry", label: "Biochemistry choose one option", options: [["BIOC 405", "BIOC 406"], ["BIOC 440", "BIOC 441", "BIOC 442"]] },
    ],
    courseBuckets: [
      { id: "microbiology-core", label: "Microbiology core courses", courseCodes: courses("MICROM 410, MICROM 402, MICROM 450") },
      { id: "microbiology-distribution", label: "Microbiology distribution", minCredits: 28, courseCodes: courses("IMMUN 441, MICROM 442, MICROM 443, MICROM 445, MICROM 460, MICROM 412, ENVH 409, FISH 406, MICROM 411, MICROM 431, GENOME 361, GENOME 371") },
      { id: "microbiology-electives", label: "Microbiology electives", courseCodes: courses("BIOEN 454, GH 454, BIOEN 498, BIOL 401, BIOL 419, BIOL 455, BIOL 466, BIOL 481, CEE 462, CEE 482, CHEME 467, BIOEN 467, ENVH 440, ENVH 441, ENVH 442, ENVH 444, ENVH 447, ENVH 451, ENVH 452, EPI 320, EPI 527, ESRM 404, ESRM 422, FISH 404, GENOME 372, GENOME 373, GENOME 414, GH 401, GH 402, GH 410, MICROM 482, MICROM 495, MICROM 499, MICROM 496, MICROM 555, NUTR 446, OCEAN 330, OCEAN 431, OCEAN 530, OCEAN 572, PABIO 551, PABIO 552") },
    ],
    genEdRequirements: ["Bachelor of Science", "English Composition", "Writing", "Foreign Language", "Quantitative and Symbolic Reasoning", "Arts and Humanities", "Social Science", "Natural Science"],
    requirementLabels: ["Microbiology Distribution", "Medical Microbiology", "Diversity and Ecology", "Genetics and Molecular Biology", "Electives"],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-neuroscience",
    title: "Neuroscience (BS)",
    family: "biomedical-life-sciences",
    officialSources: [
      "https://sites.uw.edu/neusci/about/degree-requirements/",
      "https://sites.uw.edu/neusci/about/courses/",
    ],
    expectedPathwayIds: [],
    requiredCourseCodes: courses(`
      AMATH 301, AMATH 342, AMATH 351, AMATH 352, AMATH 353, AMATH 383, AMATH 422,
      ANTH 415, BCHEM 142, BCHEM 152, BH 311, BH 402, BH 420, BH 440, BH 474, BH 481,
      BIOA 482, BIOC 405, BIOC 406, BIOC 426, BIOC 440, BIOC 441, BIOC 442, BIOC 450,
      BIOC 451, BIOEN 460, BIOEN 461, BIOL 180, BIOL 200, BIOL 220, BIOL 310, BIOL 401,
      BIOL 408, BIOL 414, BIOL 418, BIOL 427, BIOL 433, BIOL 434, BIOL 440, BIOL 441,
      BIOL 444, BIOL 451, BIOL 452, BIOL 453, BIOL 457, BIOL 460, BIOL 462, BIOL 465,
      BIOL 467, BIOL 468, BIOST 310, CHEM 120, CHEM 142, CHEM 143, CHEM 145, CHEM 152,
      CHEM 153, CHEM 155, CHEM 162, CHEM 165, CHEM 220, CHEM 221, CHEM 223, CHEM 224,
      CHEM 237, CHEM 238, CHEM 239, CHEM 321, CHEM 335, CHEM 336, CHEM 337, CHEM 452,
      CHEM 453, CHEM 455, CHEM 456, CHEM 457, CHEM 460, CHID 444, CSE 332, CSE 416,
      CSE 446, DANCE 493, ECON 437, ENVH 405, ENVH 444, ENVH 451, ENVIR 439, EPI 320,
      ESRM 410, ESRM 452, GEOG 381, GENOME 361, GENOME 371, GENOME 372, GENOME 373,
      GENOME 453, GENOME 465, GENOME 466, GENOME 475, GH 410, GH 456, GH 459, HCDE 411,
      HSERV 482, IMMUN 441, LING 441, MATH 124, MATH 125, MEDCH 327, MICROM 301,
      MICROM 302, MICROM 402, MICROM 410, MICROM 412, MICROM 442, MUSIC 344, NEUSCI 301,
      NEUSCI 302, NEUSCI 401, NEUSCI 402, NEUSCI 403, NEUSCI 404, NEUSCI 450, NEUSCI 496,
      NEUSCI 499, NURS 301, NUTR 405, NUTR 406, PCEUT 327, PHARM 451, PHCOL 401,
      PHCOL 402, PHIL 442, PHIL 460, PHIL 464, PHIL 481, PHIL 482, PHYS 114, PHYS 115,
      PHYS 121, PHYS 122, PHYS 417, PHYS 429, POLS 302, PSYCH 302, PSYCH 322, PSYCH 333,
      PSYCH 345, PSYCH 355, PSYCH 400, PSYCH 403, PSYCH 414, PSYCH 416, PSYCH 417,
      PSYCH 420, PSYCH 421, PSYCH 426, PSYCH 430, PSYCH 432, PSYCH 435, PSYCH 437,
      PSYCH 440, PSYCH 441, PSYCH 451, PSYCH 456, PSYCH 459, PSYCH 460, PSYCH 462,
      PSYCH 470, PSYCH 471, PSYCH 488, QSCI 291, QSCI 292, QSCI 381, SPHSC 305,
      SPHSC 371, SPHSC 425, STAT 311, STAT 390, STAT 416, UCONJ 440
    `),
    optionGroups: [
      { id: "neuroscience-chemistry", label: "Chemistry choose one option", options: [["CHEM 120", "CHEM 220", "CHEM 221"], ["CHEM 142", "CHEM 152", "CHEM 223", "CHEM 224"], ["CHEM 143", "CHEM 153", "CHEM 223", "CHEM 224"], ["CHEM 142", "CHEM 152", "CHEM 162", "CHEM 237", "CHEM 238", "CHEM 239"], ["CHEM 145", "CHEM 155", "CHEM 165", "CHEM 335", "CHEM 336", "CHEM 337"]] },
      { id: "neuroscience-physics", label: "Physics choose one option", options: [["PHYS 114", "PHYS 115"], ["PHYS 121", "PHYS 122"]] },
      { id: "neuroscience-math", label: "Mathematics choose one option", options: [["MATH 124", "MATH 125"], ["QSCI 291", "QSCI 292"]] },
    ],
    courseBuckets: [
      { id: "neuroscience-core", label: "Neuroscience core courses", courseCodes: courses("NEUSCI 301, NEUSCI 302, NEUSCI 401, NEUSCI 402, NEUSCI 403, NEUSCI 404") },
      { id: "neuroscience-advanced-electives", label: "Neuroscience Advanced Electives", minCredits: 16, courseCodes: courses("ANTH 415, AMATH 301, AMATH 342, AMATH 351, AMATH 352, AMATH 353, AMATH 383, AMATH 422, BH 311, BH 402, BH 420, BH 440, BH 474, BH 481, BIOA 482, BIOL 310, BIOL 401, BIOL 408, BIOL 414, BIOL 418, BIOL 427, BIOL 433, BIOL 434, BIOL 440, BIOL 441, BIOL 444, BIOL 451, BIOL 452, BIOL 453, BIOL 457, BIOL 460, BIOL 462, BIOL 465, BIOL 467, BIOL 468, BIOC 405, BIOC 406, BIOC 426, BIOC 440, BIOC 441, BIOC 442, BIOC 450, BIOC 451, BIOEN 460, BIOEN 461, BIOST 310, CHEM 321, CHEM 452, CHEM 453, CHEM 455, CHEM 456, CHEM 457, CHEM 460, CHID 444, CSE 332, CSE 416, CSE 446, DANCE 493, ECON 437, ENVH 405, ENVH 444, ENVH 451, ENVIR 439, EPI 320, ESRM 410, ESRM 452, GEOG 381, GENOME 361, GENOME 371, GENOME 372, GENOME 373, GENOME 453, GENOME 465, GENOME 466, GENOME 475, GH 410, GH 456, GH 459, HCDE 411, HSERV 482, IMMUN 441, LING 441, MEDCH 327, PCEUT 327, MICROM 301, MICROM 302, MICROM 402, MICROM 410, MICROM 412, MICROM 442, MUSIC 344, NURS 301, NUTR 405, NUTR 406, PHARM 451, PHCOL 401, PHCOL 402, PHIL 442, PHIL 460, PHIL 464, PHIL 481, PHIL 482, PHYS 417, PHYS 429, POLS 302, PSYCH 302, PSYCH 322, PSYCH 333, PSYCH 345, PSYCH 355, PSYCH 400, PSYCH 403, PSYCH 414, PSYCH 416, PSYCH 417, PSYCH 420, PSYCH 421, PSYCH 426, PSYCH 430, PSYCH 432, PSYCH 435, PSYCH 437, PSYCH 440, PSYCH 441, PSYCH 451, PSYCH 456, PSYCH 459, PSYCH 460, PSYCH 462, PSYCH 470, PSYCH 471, PSYCH 488, QSCI 381, SPHSC 305, SPHSC 371, SPHSC 425, STAT 311, STAT 390, STAT 416, UCONJ 440, NEUSCI 450, NEUSCI 496, NEUSCI 499") },
    ],
    genEdRequirements: ["Bachelor of Science", "Chemistry", "Physics", "Mathematics", "Biology", "Introduction to Neuroscience", "Advanced courses in Neuroscience", "Advanced Electives"],
    requirementLabels: ["Neuroscience Core Courses", "Neuroscience Advanced Electives", "Primary criteria are 400 level natural science"],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-american-indian-studies",
    title: "American Indian Studies (BA)",
    family: "ethnic-gender-labor-studies",
    officialSources: ["https://ais.washington.edu/ba-american-indian-studies"],
    expectedPathwayIds: ["ba-route"],
    requiredCourseCodes: courses(`
      AIS 102, AIS 103, AIS 170, AIS 202, AIS 203, AIS 209, AIS 210, AIS 212, AIS 215,
      AIS 230, AIS 270, AIS 306, AIS 307, AIS 308, AIS 309, AIS 310, AIS 311, AIS 313,
      AIS 314, AIS 315, AIS 330, AIS 335, AIS 340, AIS 360, AIS 365, AIS 376, AIS 377,
      AIS 378, AIS 379, AIS 380, AIS 385, AIS 425, AIS 431, AIS 440, AIS 441, AIS 443,
      AIS 444, AIS 446, AIS 451, AIS 461, AIS 480, AIS 492
    `),
    optionGroups: [
      { id: "ais-content", label: "Content courses", options: singleOptions(courses("AIS 170, AIS 202, AIS 203, AIS 209, AIS 210")) },
      { id: "ais-concentrations", label: "Governance, Environment and Health, and Culture and History concentration courses", options: [] },
    ],
    courseBuckets: [
      { id: "ais-introductory", label: "Introductory courses", minCredits: 10, courseCodes: courses("AIS 102, AIS 103") },
      { id: "ais-governance", label: "Governance Concentration Courses", courseCodes: courses("AIS 212, AIS 230, AIS 270, AIS 330, AIS 335, AIS 365, AIS 444, AIS 446, AIS 461, AIS 480, AIS 492") },
      { id: "ais-environment-health", label: "Environment and Health Concentration Courses", courseCodes: courses("AIS 306, AIS 307, AIS 308, AIS 311, AIS 340, AIS 380, AIS 385, AIS 451") },
      { id: "ais-culture-history", label: "Culture and History Concentration Courses", courseCodes: courses("AIS 215, AIS 309, AIS 310, AIS 313, AIS 314, AIS 315, AIS 360, AIS 376, AIS 377, AIS 378, AIS 379, AIS 425, AIS 431, AIS 440, AIS 441, AIS 443") },
    ],
    genEdRequirements: ["Bachelor of Arts", "55 credits", "10 credits/both courses", "25 credits total", "10 credits: additional courses in AIS", "minimum of 30 credits"],
    requirementLabels: ["Introductory courses", "Content courses", "Concentrations", "Electives", "300 level or above credit minimum"],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-history",
    title: "History (BA)",
    family: "history",
    officialSources: ["https://history.washington.edu/major"],
    expectedPathwayIds: [],
    requiredCourseCodes: courses("HSTAM 325, HSTRY 388, HSTRY 494, HSTRY 498"),
    optionGroups: [
      { id: "history-area-requirements", label: "5 credits each in four of the six areas of study", options: [] },
      { id: "history-senior-seminar", label: "HSTRY 494: Historiography OR HSTRY 498: Colloquium in History", options: [["HSTRY 494"], ["HSTRY 498"]] },
    ],
    courseBuckets: [
      {
        id: "history-area-prefixes",
        label: "Asian, European, Latin American and Caribbean, Middle Eastern and African, United States and Canadian, and Comparative and Transregional Global History",
        minCredits: 20,
        courseCodes: ["HSTAM 325"],
        openEndedRules: [
          "Asian History (all HSTAS courses)",
          "European History (all HSTAM and HSTEU courses)",
          "Latin American and Caribbean History (all HSTLAC courses)",
          "Middle Eastern and African History (all HSTAFM courses and HSTAM 325)",
          "United States and Canadian History (all HSTAA courses)",
          "Comparative and Transregional Global History (all HSTCMP courses)",
        ],
      },
      { id: "history-seminars", label: "Junior Seminar and Senior Seminar", courseCodes: courses("HSTRY 388, HSTRY 494, HSTRY 498") },
    ],
    genEdRequirements: ["Bachelor of Arts", "60 credits of history", "average history GPA of 2.25", "10 credits of approved courses in the Pre-Modern period", "10 credits of approved courses in the Modern period", "30 credits of upper division history coursework"],
    requirementLabels: ["Prerequisites for the History Major", "Major Requirements", "History Thematic Majors", "Approved Course lists"],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-spanish",
    title: "Spanish (BA)",
    family: "spanish-language-cultures",
    officialSources: ["https://spanport.washington.edu/spanish-major-requirements"],
    expectedPathwayIds: [],
    requiredCourseCodes: courses(`
      SPAN 310, SPAN 311, SPAN 312, SPAN 313, SPAN 314, SPAN 315, SPAN 316, SPAN 400,
      SPAN 401, SPAN 402, SPAN 403, SPAN 404, SPAN 405, SPAN 406, SPLING 400, SPLING 401,
      SPLING 402, SPLING 403, SPLING 404, SPLING 405, SPLING 406
    `),
    optionGroups: [
      { id: "spanish-core-track", label: "Non-Heritage Language Track Core Courses or Heritage Language Track Core Courses", options: [["SPAN 310", "SPAN 311", "SPAN 312", "SPAN 313"], ["SPAN 314", "SPAN 315", "SPAN 316", "SPAN 312"], ["SPAN 314", "SPAN 315", "SPAN 316", "SPAN 313"]] },
    ],
    courseBuckets: [
      { id: "spanish-core", label: "Core courses", minCredits: 20, courseCodes: courses("SPAN 310, SPAN 311, SPAN 312, SPAN 313, SPAN 314, SPAN 315, SPAN 316") },
      { id: "spanish-upper-division", label: "Upper-division courses", minCredits: 30, courseCodes: courses("SPAN 400, SPAN 401, SPAN 402, SPAN 403, SPAN 404, SPAN 405, SPAN 406, SPLING 400, SPLING 401, SPLING 402, SPLING 403, SPLING 404, SPLING 405, SPLING 406"), openEndedRules: ["At least six upper-division SPAN courses, with a minimum of 25 credits at the 400-level", "Other than SPAN 400 / SPLING 400 through SPAN 406 / SPLING 406, only one SPAN course with instructional materials primarily in English may typically be applied to the major"] },
    ],
    genEdRequirements: ["Bachelor of Arts", "Core courses (20 credits)", "Upper-division courses (30 credits)", "minimum of 25 credits at the 400-level"],
    requirementLabels: ["Non-Heritage Language Track Core Courses", "Heritage Language Track Core Courses", "Upper-division courses"],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-community-environment-and-planning",
    title: "Community, Environment, and Planning (BA)",
    family: "urban-planning-design",
    officialSources: ["https://www.washington.edu/students/gencat/program/S/UrbanDesignandPlanning-50.html"],
    expectedPathwayIds: [],
    requiredCourseCodes: courses("CEP 300, CEP 301, CEP 302, CEP 303, CEP 400, CEP 446, CEP 460, CEP 461, CEP 462, CEP 490, CEP 491"),
    optionGroups: [],
    courseBuckets: [
      { id: "cep-core", label: "Core Seminars", minCredits: 30, courseCodes: courses("CEP 301, CEP 302, CEP 303, CEP 460, CEP 461, CEP 462") },
      { id: "cep-leadership", label: "Leadership Retreats", minCredits: 4, courseCodes: ["CEP 300"] },
      { id: "cep-governance", label: "Governance Practicum", minCredits: 6, courseCodes: ["CEP 400"] },
      { id: "cep-internship-capstone", label: "Internship and Senior Project Capstone", minCredits: 7, courseCodes: courses("CEP 446, CEP 490, CEP 491") },
      { id: "cep-open-methods", label: "Methods Courses, Diversity Course, and Digital Skills Proficiency Course", minCredits: 33, courseCodes: [], openEndedRules: ["Upper-division courses within the University, with no more than 15 credits from one department", "One course that critically analyzes and addresses social constructs and/or issues from a different perspective", "One course that enhances student's understanding of the creation, utilization, and implications of digital material"] },
    ],
    genEdRequirements: ["Bachelor of Arts", "Written Communication", "Reasoning", "Areas of Inquiry", "20 credits Arts and Humanities", "20 credits Social Sciences", "20 credits Natural Sciences", "Electives to complete minimum 180 credits"],
    requirementLabels: ["Community, Environment, and Planning", "77-82 credits", "Core Seminars", "Methods Courses", "Diversity Course", "Digital Skills Proficiency Course", "Leadership Retreats", "Governance Practicum", "Internship", "Senior Project Capstone"],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-landscape-architecture",
    title: "Landscape Architecture (BLA)",
    family: "urban-planning-design",
    officialSources: ["https://www.washington.edu/students/gencat/program/S/LandscapeArchitecture-53.html#credential-6078dddbe5ffc09fa25582d4"],
    expectedPathwayIds: [],
    requiredCourseCodes: courses(`
      BE 405, BIOL 331, BIOL 446, ENGL 131, ENVIR 313, ESRM 331, ESS 301, ESS 305,
      ESS 315, LARCH 300, LARCH 341, LARCH 352, LARCH 353, LARCH 361, LARCH 363,
      LARCH 401, LARCH 402, LARCH 403, LARCH 404, LARCH 405, LARCH 406, LARCH 407,
      LARCH 411, LARCH 423, LARCH 424, LARCH 431, LARCH 432, LARCH 433, LARCH 434,
      LARCH 440, LARCH 441, LARCH 454, LARCH 473, LARCH 474, LARCH 475
    `),
    optionGroups: [
      { id: "larch-advanced-studios", label: "Advanced Studio Courses", options: [["LARCH 404"], ["LARCH 405"], ["LARCH 406"], ["LARCH 407"], ["LARCH 474"], ["LARCH 475"], ["BE 405"]] },
      { id: "larch-history", label: "History two courses", options: [["LARCH 352"], ["LARCH 353"], ["LARCH 454"]] },
      { id: "larch-plant-id", label: "Plant Identification", options: [["LARCH 423"], ["ESRM 331"], ["BIOL 331"], ["BIOL 446"]] },
      { id: "larch-geology", label: "Geology", options: [["ESS 301"], ["ESS 305"], ["ESS 315"], ["ENVIR 313"]] },
    ],
    courseBuckets: [
      { id: "larch-foundation", label: "Foundation Studio Courses", minCredits: 18, courseCodes: courses("LARCH 401, LARCH 402, LARCH 403") },
      { id: "larch-studio", label: "Advanced Studio Courses", minCredits: 24, courseCodes: courses("LARCH 404, LARCH 405, LARCH 406, LARCH 407, LARCH 474, LARCH 475, BE 405") },
      { id: "larch-required", label: "Planting Design, Theory, Graphics, Professional Practice, and Construction", courseCodes: courses("LARCH 424, LARCH 341, LARCH 361, LARCH 363, LARCH 411, LARCH 440, LARCH 441, LARCH 473, LARCH 431, LARCH 432, LARCH 433, LARCH 434") },
    ],
    genEdRequirements: ["Bachelor of Landscape Architecture", "Minimum 180 credits", "Written and Oral Communication", "Arts and Humanities", "Social Sciences", "Natural Sciences", "Reasoning", "Diversity"],
    requirementLabels: ["Foundation Studio Courses", "Advanced Studio Courses", "Planting Design", "History", "Theory", "Graphics", "Professional Practice", "Construction", "Plant Identification", "Plants", "Geology", "Directed Electives"],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-comparative-literature",
    title: "Comparative Literature (BA)",
    family: "writing-english-literature",
    officialSources: ["https://cinema.washington.edu/ba-comparative-literature"],
    expectedPathwayIds: [],
    requiredCourseCodes: courses("CLIT 250, CLIT 251, CLIT 252, CLIT 300, CLIT 320, CLIT 321, CLIT 322, CLIT 323, CLIT 360, CLIT 361, CLIT 362, CLIT 400, ENGL 131"),
    optionGroups: [
      { id: "comparative-literature-prerequisite", label: "Completion of one of C Lit 250, 251 or 252", options: [["CLIT 250"], ["CLIT 251"], ["CLIT 252"]] },
      { id: "comparative-literature-series", label: "Three differently numbered courses from among C LIT 320, C LIT 321, C LIT 322, C LIT 323, C LIT 360, C LIT 361, C LIT 362", options: singleOptions(courses("CLIT 320, CLIT 321, CLIT 322, CLIT 323, CLIT 360, CLIT 361, CLIT 362")) },
    ],
    courseBuckets: [
      { id: "comparative-literature-core", label: "Major requirements", minCredits: 45, courseCodes: courses("CLIT 250, CLIT 251, CLIT 252, CLIT 320, CLIT 321, CLIT 322, CLIT 323, CLIT 360, CLIT 361, CLIT 362, CLIT 400") },
      { id: "comparative-literature-open-electives", label: "Literature, cinema or media studies courses", minCredits: 15, courseCodes: ["CLIT 300"], openEndedRules: ["One 300-level cinema studies course", "One additional course in Comparative Literature at the 300 or 400 level", "300 and 400 level literature, cinema or media studies courses from participating departments", "One course taken in the program must focus primarily on literature written before 1800"] },
    ],
    genEdRequirements: ["Bachelor of Arts", "50-credit major requirements", "minimum GPA of 2.0", "English Composition requirement or a W-course"],
    requirementLabels: ["Degree Requirements", "Major requirements", "pre-1800", "Comparative Literature"],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-english-creative-writing",
    title: "English: Creative Writing (BA)",
    family: "writing-english-literature",
    officialSources: [
      "https://www.washington.edu/students/gencat/program/S/English-136.html",
      "https://english.washington.edu/english-major-creative-writing-option",
    ],
    expectedPathwayIds: ["ba-option-family:creative-writing"],
    requiredCourseCodes: unique([
      "ENGL 202",
      ...seattleEnglishCreativeWritingCourses,
      ...seattleEnglishHistoricalDepthCourses,
      ...seattleEnglishPowerDifferenceCourses,
    ]),
    optionGroups: [
      { id: "english-creative-writing-workshops", label: "A sequence of creative writing workshops", options: [["ENGL 283", "ENGL 284", "ENGL 383", "ENGL 384"]] },
      { id: "english-creative-writing-seminars", label: "Two 400-level Creative Writing seminars", options: singleOptions(courses("ENGL 483, ENGL 484, ENGL 485, ENGL 486")) },
    ],
    courseBuckets: [
      { id: "english-cw-core", label: "Creative Writing Concentration core", minCredits: 25, courseCodes: courses("ENGL 202, ENGL 283, ENGL 284, ENGL 383, ENGL 384") },
      { id: "english-cw-historical-depth", label: "Historical Depth", minCredits: 15, courseCodes: seattleEnglishHistoricalDepthCourses },
      { id: "english-cw-power-difference", label: "Power and Difference", minCredits: 15, courseCodes: seattleEnglishPowerDifferenceCourses },
      { id: "english-cw-creative-writing", label: "Creative Writing courses", minCredits: 10, courseCodes: seattleEnglishCreativeWritingCourses },
    ],
    genEdRequirements: ["Bachelor of Arts", "Minimum 65 credits", "maximum of 20 credits in 200-level courses", "minimum 30 credits of English at the 200-level or above must be completed in residence"],
    requirementLabels: ["Creative Writing Option", "Historical Depth", "Power and Difference", "Two 400-level Creative Writing seminars"],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-english-language-literature-and-culture",
    title: "English: Language, Literature and Culture (BA)",
    family: "writing-english-literature",
    officialSources: [
      "https://english.washington.edu/english-language-literature-and-culture-option",
      "https://www.washington.edu/students/gencat/program/S/English-136.html",
    ],
    expectedPathwayIds: ["creative-writing-option", "language-and-literature-option"],
    requiredCourseCodes: unique([
      "ENGL 202",
      "ENGL 302",
      ...seattleEnglishHistoricalDepthCourses,
      ...seattleEnglishPowerDifferenceCourses,
      ...seattleEnglishGenreMethodLanguageCourses,
      "ENGL 490",
      "ENGL 496",
      "ENGL 498",
    ]),
    optionGroups: [
      { id: "english-llc-capstone", label: "Capstone", options: [["ENGL 490"], ["ENGL 496"], ["ENGL 498"]] },
    ],
    courseBuckets: [
      { id: "english-llc-core", label: "English Language, Literature, and Culture core", courseCodes: courses("ENGL 202, ENGL 302") },
      { id: "english-llc-historical-depth", label: "Historical Depth", minCredits: 15, courseCodes: seattleEnglishHistoricalDepthCourses },
      { id: "english-llc-power-difference", label: "Power and Difference", minCredits: 15, courseCodes: seattleEnglishPowerDifferenceCourses },
      { id: "english-llc-genre-method-language", label: "Genre, Method, and Language", minCredits: 15, courseCodes: seattleEnglishGenreMethodLanguageCourses },
      { id: "english-llc-capstone", label: "approved 400-level senior capstone English course", minCredits: 5, courseCodes: courses("ENGL 490, ENGL 496, ENGL 498") },
    ],
    genEdRequirements: ["Bachelor of Arts", "Minimum 60 credits", "Historical Depth Courses", "Power and Difference Courses", "Genre, Method, and Language Courses", "Minimum 30 credits of English at the 200-level or above must be completed in residence"],
    requirementLabels: ["Language, Literature, and Culture Option", "Historical Depth", "Power and Difference", "Genre, Method, and Language", "Capstone"],
  },
];

const crossCampusEquivalentPlanIdsByFamily = {
  "biomedical-life-sciences": [
    "uw-seattle-biochemistry",
    "uw-seattle-biology",
    "uw-seattle-marine-biology",
    "uw-seattle-medical-laboratory-science",
    "uw-seattle-microbiology",
    "uw-seattle-neuroscience",
    "uw-bothell-biology",
    "uw-bothell-chemistry-biochemistry",
  ],
  "ethnic-gender-labor-studies": [
    "uw-seattle-american-ethnic-studies",
    "uw-seattle-american-indian-studies",
    "uw-seattle-gender-women-and-sexuality-studies",
    "uw-bothell-american-and-ethnic-studies",
    "uw-bothell-gender-women-and-sexuality-studies",
  ],
  history: ["uw-seattle-history"],
  "interdisciplinary-individualized-studies": [
    "uw-seattle-individualized-studies",
    "uw-bothell-interdisciplinary-arts",
  ],
  "spanish-language-cultures": ["uw-seattle-spanish"],
  "urban-planning-design": [
    "uw-seattle-community-environment-and-planning",
    "uw-seattle-landscape-architecture",
  ],
  "writing-english-literature": [
    "uw-seattle-comparative-literature",
    "uw-seattle-english-creative-writing",
    "uw-seattle-english-language-literature-and-culture",
    "uw-bothell-culture-literature-and-the-arts",
  ],
};

module.exports = {
  crossCampusEquivalentPlanIdsByFamily,
  crossCampusEquivalentPrograms,
  tacomaRemainingPrograms,
};
