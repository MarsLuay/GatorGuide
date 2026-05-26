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

const seattleCommunicationUndergraduateCatalogCourses = courses(`
  COM 200, COM 202, COM 210, COM 220, COM 231, COM 233, COM 234, COM 238,
  COM 270, COM 289, COM 292, COM 294, COM 300, COM 301, COM 302, COM 303,
  COM 304, COM 306, COM 310, COM 320, COM 321, COM 322, COM 333, COM 336,
  COM 339, COM 340, COM 343, COM 351, COM 359, COM 360, COM 361, COM 362,
  COM 364, COM 370, COM 373, COM 375, COM 376, COM 377, COM 378, COM 381,
  COM 382, COM 383, COM 389, COM 392, COM 407, COM 411, COM 414, COM 418,
  COM 420, COM 422, COM 423, COM 431, COM 435, COM 436, COM 437, COM 440,
  COM 442, COM 443, COM 444, COM 445, COM 452, COM 456, COM 457, COM 458,
  COM 459, COM 460, COM 461, COM 464, COM 465, COM 467, COM 468, COM 470,
  COM 472, COM 474, COM 477, COM 478, COM 479, COM 481, COM 482, COM 483,
  COM 484, COM 485, COM 486, COM 487, COM 488, COM 489, COM 490, COM 492,
  COM 494, COM 495, COM 496, COM 497, COM 498, COM 499
`);

const seattleCommunicationIntroCourses = courses(`
  COM 200, COM 202, COM 210, COM 220, COM 231, COM 233, COM 234, COM 238,
  COM 270, COM 289, COM 292, COM 294
`);

const seattleCommunicationMethodsCourses = courses(`
  COM 238, COM 301, COM 325, COM 373, COM 377, COM 381, COM 382, COM 383,
  COM 389, COM 420, COM 426, COM 431, COM 435, COM 436, COM 437, COM 442,
  COM 472, COM 486, COM 495, COM 496
`);

const seattleCommunicationTheoryCourses = courses(`
  COM 302, COM 303, COM 325, COM 332, COM 333, COM 373, COM 375, COM 376,
  COM 377, COM 378, COM 389, COM 414, COM 418, COM 434, COM 444, COM 452,
  COM 468, COM 472, COM 481, COM 482, COM 483, COM 484, COM 486, COM 488,
  COM 489, COM 490, COM 495
`);

const seattleCommunicationAffiliatedCourses = courses(`
  AAS 220, ANTH 203, ANTH 209, ANTH 403, ANTH 432, ANTH 433, CSSS 221,
  CSSS 320, CSSS 321, CSSS 322, CMS 302, CMS 315, ENGL 204, ENGL 206,
  ENGL 266, ENGL 382, FRENCH 224, HSTEU 290, ITAL 355, JSISA 224,
  JSISB 307, JSISB 361, LING 203, LING 432, LING 433, SOC 221, SOC 250,
  SOC 320, SOC 321, SOC 322, STAT 220, STAT 221, STAT 311, STAT 320,
  STAT 321, STAT 322, TXTDS 224, MKTG 450, HCDE 301, HCDE 322, INFO 102,
  INFO 350, INFO 386, INFO 402, INFO 498, PUBPOL 403, ENVH 205, HSERV 204,
  SOCWF 215
`);

const seattleJpicCoreCourses = courses(`
  COM 360, COM 361, COM 362, COM 364, COM 457, COM 440, COM 468
`);

const seattleJpicAdvancedJournalismCourses = courses(`
  COM 351, COM 445, COM 456, COM 458, COM 459, COM 460, COM 461, COM 463,
  COM 464, COM 465
`);

const seattleJpicAdvancedPublicInterestCourses = courses(`
  COM 418, COM 423, COM 444, COM 452, COM 474, COM 478, COM 482, COM 487,
  COM 488, COM 489
`);

const seattleCinemaAdmissionCourses = courses(`
  CMS 270, CMS 271, CMS 272, CMS 273, CMS 274, CMS 275
`);

const seattleCinemaCatalogCourses = courses(`
  CMS 240, CMS 270, CMS 271, CMS 272, CMS 273, CMS 274, CMS 275, CMS 295,
  CMS 297, CMS 301, CMS 302, CMS 303, CMS 304, CMS 310, CMS 311, CMS 312,
  CMS 313, CMS 314, CMS 315, CMS 320, CMS 321, CMS 322, CMS 370, CMS 395,
  CMS 397, CMS 423, CMS 470, CMS 480, CMS 490, CMS 491, CMS 497
`);

const seattleCinemaHistoryCourses = courses(`
  CMS 310, CMS 311, CMS 312, CMS 313, CMS 314, CMS 315
`);

const seattleCinemaCriticalConceptsCourses = courses(`
  CMS 302, CMS 303, CMS 304, CMS 320, CMS 321, CMS 322
`);

const bothellMcsPreparationCourses = courses(`
  BIS 161, BIS 162, BIS 176, BIS 177, BIS 178, BIS 179
`);

const bothellMcsPracticeProductionCourses = courses(`
  BIS 177, BIS 217, BIS 237, BISIA 244, BISIA 344, BISIA 350, BISIA 399,
  BISIA 401, BISIA 444, BISIA 450, BISMCS 234, BISMCS 240, BISMCS 260,
  BISMCS 279, BISMCS 343, BISMCS 402, BISMCS 472, BISMCS 475
`);

const bothellMcsAdditionalCourses = courses(`
  BIS 115, BIS 161, BIS 162, BIS 176, BIS 178, BIS 179, BIS 205, BIS 207,
  BIS 216, BIS 223, BIS 233, BIS 234, BIS 235, BIS 236, BIS 238, BIS 261,
  BIS 313, BIS 317, BIS 324, BIS 325, BIS 331, BIS 332, BIS 333, BIS 347,
  BIS 363, BIS 373, BIS 375, BIS 464, BISAES 369, BISMCS 471, BISMCS 473,
  BISSTS 307
`);

const bothellMcsTopicsCourses = courses(`
  BIS 293, BIS 322, BIS 339, BIS 341, BISIA 340, BISIA 483
`);

const bothellMcsCompositionCourses = courses(`
  BWRIT 133, BWRIT 134, BWRIT 135, ENGL 131, ENGL 141
`);

const bothellMcsCourses = unique([
  ...bothellMcsPreparationCourses,
  "BIS 290",
  "BISMCS 333",
  "COM 200",
  ...bothellMcsPracticeProductionCourses,
  ...bothellMcsAdditionalCourses,
  ...bothellMcsTopicsCourses,
  ...bothellMcsCompositionCourses,
]);

const tacomaCommunicationResearchCoreCourses = courses(`
  TCOM 101, TCOM 201, TCOM 220, TCOM 230, TCOM 247, TCOM 250, TCOM 254,
  TCOM 257, TCOM 258, TCOM 310, TCOM 312, TCOM 340, TCOM 343, TCOM 380,
  TCOM 440, TCOM 444, TCOM 453, TCOM 454, TCOM 460, TCOM 461, TCOM 465,
  TCOM 470, TCOM 480, TCOM 495, TCOM 499, TFILM 201, TFILM 220,
  TFILM 377, TFILM 380, TFILM 381, TFILM 386, TFILM 387, TFILM 388,
  TFILM 434, TFILM 436, TFILM 438, TFILM 444, TFILM 481, TFILM 483,
  TFILM 485, TFILM 499, TGH 302, TLAX 250, TLAX 355, TLAX 376, TLAX 441
`);

const tacomaCommunicationProfessionalCourses = courses(`
  TCOM 275, TCOM 320, TCOM 330, TCOM 347, TCOM 348, TCOM 349, TCOM 350,
  TCOM 351, TCOM 387, TCOM 420, TCOM 470, TCOM 471, TCOM 482, TCOM 484,
  TCOM 486, TCOM 490, TFILM 350, TFILM 450, TWRT 287, TWRT 350, TWRT 353,
  TWRT 365, TWRT 440, TWRT 487
`);

const tacomaCommunicationCourses = unique([
  "TWRT 211",
  ...tacomaCommunicationResearchCoreCourses,
  ...tacomaCommunicationProfessionalCourses,
]);

const tacomaAmcFoundationCourses = courses(`
  TLIT 220, TFILM 220
`);

const tacomaAmcHistoryCourses = courses(`
  THIST 150, THIST 151, THIST 200, THIST 201, THIST 220, THIST 221,
  THIST 222, THIST 260, THIST 341, THIST 365, THIST 375, THIST 464,
  THIST 465, THIST 466, THIST 475, THIST 479, THIST 487, THIST 495,
  TLAX 333, TWOMN 345
`);

const tacomaAmcCultureCourses = courses(`
  TAMST 101, TAMST 120, TAMST 210, TAMST 220, TAMST 250, TAMST 260,
  TAMST 350, TAMST 410, TAMST 430, TAMST 450, TEGL 112, TEGL 201,
  TEGL 310, TEGL 340, TEGL 380, TEGL 419, THIST 365, THIST 470,
  THIST 479, TLAX 225, TLAX 238, TLAX 380, TLAX 400, TLAX 462,
  TPHIL 350, TPHIL 355, TPHIL 358, TPHIL 360, TPHIL 361, TPHIL 362,
  TPHIL 367, TPHIL 451, TPHIL 466, TPOLS 251, TRELIG 210, TRELIG 350,
  TRELIG 365, TRELIG 366, TWOMN 251, TWOMN 345, TWRT 340
`);

const tacomaAmcInterpretationCourses = courses(`
  TCOM 347, TFILM 201
`);

const tacomaAmcPracticeCourses = courses(`
  TARTS 151, TARTS 200, TARTS 203, TARTS 240, TARTS 252, TARTS 266,
  TARTS 280, TARTS 320, TARTS 336, TARTS 367, TARTS 386, TARTS 390,
  TARTS 391, TARTS 393, TARTS 395, TARTS 402, TARTS 404, TARTS 405,
  TARTS 406, TARTS 407, TARTS 410, TCOM 348, TCOM 349, TCOM 351,
  TCOM 470, TCOM 471, TCOM 486, TFILM 350, TFILM 450, TWRT 200,
  TWRT 270, TWRT 280, TWRT 287, TWRT 330, TWRT 333, TWRT 360,
  TWRT 372, TWRT 382, TWRT 384, TWRT 388, TWRT 470, TWRT 480
`);

const tacomaAmcFilmAndMediaCourses = courses(`
  TCOM 201, TCOM 221, TCOM 230, TCOM 247, TCOM 250, TCOM 254, TCOM 257,
  TCOM 258, TCOM 310, TCOM 340, TCOM 343, TCOM 347, TCOM 380, TCOM 440,
  TCOM 444, TCOM 454, TCOM 461, TCOM 470, TCOM 480, TFILM 201, TFILM 220,
  TFILM 350, TFILM 377, TFILM 380, TFILM 381, TFILM 386, TFILM 387,
  TFILM 388, TFILM 434, TFILM 436, TFILM 438, TFILM 444, TFILM 450,
  TFILM 483, TFILM 485, TFILM 487, TFILM 489, TFILM 499, TLAX 250,
  TLAX 376, TLAX 441, TPOLS 350
`);

const tacomaAmcLiteratureCourses = courses(`
  TLAX 267, TLAX 277, TLAX 355, TLAX 476, TLIT 101, TLIT 210, TLIT 220,
  TLIT 230, TLIT 237, TLIT 240, TLIT 251, TLIT 252, TLIT 253, TLIT 311,
  TLIT 313, TLIT 320, TLIT 324, TLIT 332, TLIT 335, TLIT 343, TLIT 351,
  TLIT 352, TLIT 388, TLIT 390, TLIT 391, TLIT 406, TLIT 425, TLIT 431,
  TLIT 432, TLIT 433, TLIT 458, TLIT 476, TSPAN 351
`);

const tacomaAmcVisualPerformingCourses = courses(`
  TARTS 150, TARTS 160, TARTS 225, TARTS 251, TARTS 311, TARTS 315,
  TARTS 335, TARTS 360, TARTS 364, TARTS 371, TARTS 372, TARTS 373,
  TARTS 386, TARTS 480, TFILM 489, THIST 377, THIST 379, THIST 430,
  THIST 470, THIST 479, TLAX 465
`);

const tacomaAmcCourses = unique([
  ...tacomaAmcFoundationCourses,
  ...tacomaAmcHistoryCourses,
  ...tacomaAmcCultureCourses,
  ...tacomaAmcInterpretationCourses,
  ...tacomaAmcPracticeCourses,
  ...tacomaAmcFilmAndMediaCourses,
  ...tacomaAmcLiteratureCourses,
  ...tacomaAmcVisualPerformingCourses,
]);

const communicationPrograms = [
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-cinema-and-media-studies",
    title: "Cinema & Media Studies",
    officialSources: [
      "https://www.washington.edu/students/gencat/program/S/CinemaandMediaStudies-132.html",
      "https://www.washington.edu/students/crscat/cms.html",
      "https://cinema.washington.edu/ba-cinema-media-studies",
    ],
    expectedPathwayIds: ["ba-route"],
    pathwayGroups: [
      { id: "ba-route", label: "B.A. route", suggestedCourses: seattleCinemaCatalogCourses },
    ],
    requiredCourseCodes: unique([
      ...seattleCinemaAdmissionCourses,
      ...seattleCinemaCatalogCourses,
    ]),
    optionGroups: [
      { id: "seattle-cms-admission", label: "One from CMS 270, CMS 271, CMS 272, CMS 273, CMS 274, or CMS 275", options: singleOptions(seattleCinemaAdmissionCourses) },
      { id: "seattle-cms-history-a", label: "CMS 310 or CMS 311", options: singleOptions(["CMS 310", "CMS 311"]) },
      { id: "seattle-cms-history-b", label: "One of CMS 312, CMS 313, CMS 314, or CMS 315", options: singleOptions(["CMS 312", "CMS 313", "CMS 314", "CMS 315"]) },
      { id: "seattle-cms-critical-a", label: "One of CMS 302, CMS 303, or CMS 304", options: singleOptions(["CMS 302", "CMS 303", "CMS 304"]) },
      { id: "seattle-cms-critical-b", label: "One of CMS 320, CMS 321, or CMS 322", options: singleOptions(["CMS 320", "CMS 321", "CMS 322"]) },
    ],
    courseBuckets: [
      { id: "seattle-cms-core", label: "Core courses", minCredits: 10, courseCodes: ["CMS 301", "CMS 480"] },
      { id: "seattle-cms-history", label: "History courses", minCredits: 10, courseCodes: seattleCinemaHistoryCourses },
      { id: "seattle-cms-critical", label: "Critical concepts courses", minCredits: 10, courseCodes: seattleCinemaCriticalConceptsCourses },
      { id: "seattle-cms-electives", label: "Approved electives", minCredits: 30, courseCodes: seattleCinemaCatalogCourses, openEndedRules: ["Minimum 20 credits from 300- and 400-level courses", "Minimum 10 credits from CMS courses", "Maximum 5 credits of independent study (CMS 490) and maximum 5 credits of internship (CMS 491)"] },
    ],
    genEdRequirements: [
      "English composition requirement or W (writing) requirement",
      "60 credits",
      "At least 35 credits applied toward the major completed in residence through the UW",
      "Minimum 2.00 cumulative GPA for courses applied to the major",
    ],
    requirementLabels: [
      "Cinema and Media Studies",
      "Core courses",
      "History courses",
      "Critical concepts courses",
      "Approved electives",
    ],
  },
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-communication",
    title: "Communication",
    officialSources: [
      "https://www.washington.edu/students/gencat/program/S/Communication-1035.html",
      "https://com.uw.edu/undergraduate/communication-major/com-curriculum/",
      "https://com.uw.edu/undergraduate/methods-requirement/",
      "https://com.uw.edu/undergraduate/communication-major/theory-requirement/",
      "https://com.uw.edu/undergraduate/communication-major/affiliated-courses/",
      "https://com.uw.edu/undergraduate/journalism-public-interest-communication-major/jpic-curriculum/",
      "https://www.washington.edu/students/crscat/com.html",
    ],
    expectedPathwayIds: ["ba-option-family:journalism-and-public-interest-communication"],
    pathwayGroups: [
      {
        id: "ba-option-family:journalism-and-public-interest-communication",
        label: "B.A. Journalism and Public Interest Communication option",
        suggestedCourses: unique([
          ...seattleCommunicationIntroCourses,
          ...seattleCommunicationMethodsCourses,
          ...seattleJpicCoreCourses,
          ...seattleJpicAdvancedJournalismCourses,
          ...seattleJpicAdvancedPublicInterestCourses,
        ]),
      },
    ],
    requiredCourseCodes: unique([
      ...seattleCommunicationUndergraduateCatalogCourses,
      ...seattleCommunicationMethodsCourses,
      ...seattleCommunicationTheoryCourses,
      ...seattleCommunicationAffiliatedCourses,
      ...seattleJpicCoreCourses,
      ...seattleJpicAdvancedJournalismCourses,
      ...seattleJpicAdvancedPublicInterestCourses,
    ]),
    optionGroups: [
      { id: "seattle-com-intro", label: "COM 200 and one additional 200-level COM course", options: [["COM 200"], ...singleOptions(seattleCommunicationIntroCourses.filter((code) => code !== "COM 200"))] },
      { id: "seattle-com-methods", label: "Methods course", options: singleOptions(seattleCommunicationMethodsCourses) },
      { id: "seattle-com-theory", label: "Theory course", options: singleOptions(seattleCommunicationTheoryCourses) },
      { id: "seattle-com-affiliated", label: "Affiliated Communication courses", options: singleOptions(seattleCommunicationAffiliatedCourses) },
      { id: "seattle-jpic-advanced-journalism", label: "Advanced Skills/Competencies: Journalism", options: singleOptions(seattleJpicAdvancedJournalismCourses) },
      { id: "seattle-jpic-advanced-public-interest", label: "Advanced Skills/Competencies: Public Interest Communication", options: singleOptions(seattleJpicAdvancedPublicInterestCourses) },
    ],
    courseBuckets: [
      { id: "seattle-com-intro", label: "Introductory Courses", minCredits: 10, courseCodes: seattleCommunicationIntroCourses },
      { id: "seattle-com-methods", label: "Methods in Inquiry", minCredits: 5, courseCodes: seattleCommunicationMethodsCourses },
      { id: "seattle-com-theory", label: "Theory in Communication", minCredits: 5, courseCodes: seattleCommunicationTheoryCourses },
      { id: "seattle-com-electives", label: "Communication electives", minCredits: 30, courseCodes: unique([...seattleCommunicationUndergraduateCatalogCourses, ...seattleCommunicationAffiliatedCourses]), openEndedRules: ["Any COM course that is not already counting towards INTRO, METHODS, or THEORY", "Only 10 credits may be from courses offered outside the Department of Communication unless approved"] },
      { id: "seattle-jpic-skills", label: "Skills/Competencies Core", minCredits: 20, courseCodes: ["COM 360", "COM 361", "COM 362", "COM 364", "COM 457"] },
      { id: "seattle-jpic-law-ethics", label: "Law and Ethics Core", minCredits: 10, courseCodes: ["COM 440", "COM 468"] },
      { id: "seattle-jpic-advanced", label: "Advanced Skills/Competencies", minCredits: 10, courseCodes: unique([...seattleJpicAdvancedJournalismCourses, ...seattleJpicAdvancedPublicInterestCourses]) },
    ],
    genEdRequirements: [
      "50 credits",
      "Minimum 55 credits",
      "25 credits must be Communication courses at the 300 level or above",
      "At least 10 must be Communication courses at the 400 level",
      "Written Communication",
      "Reasoning",
      "Diversity",
      "Arts and Humanities",
      "Social Sciences",
      "Natural Sciences",
      "Minimum 2.50 cumulative GPA in all COM coursework",
      "Minimum 2.50 cumulative GPA for all college coursework",
    ],
    requirementLabels: [
      "Communication",
      "Journalism and Public Interest Communication",
      "Introductory Courses",
      "Methods in Inquiry",
      "Theory in Communication",
      "Communication electives",
      "Skills/Competencies Core",
      "Law and Ethics Core",
      "Advanced Skills/Competencies",
    ],
  },
  {
    campusId: "uw-bothell",
    planId: "uw-bothell-media-and-communications-studies",
    title: "Media & Communication Studies",
    officialSources: ["https://www.uwb.edu/ias/undergraduate/majors/media-communication"],
    expectedPathwayIds: [],
    pathwayGroups: [],
    requiredCourseCodes: bothellMcsCourses,
    optionGroups: [
      { id: "bothell-mcs-core-prereq", label: "Prerequisite of BIS 176, BIS 177, BIS 178, BIS 179, or COM 200", options: singleOptions(["BIS 176", "BIS 177", "BIS 178", "BIS 179", "COM 200"]) },
      { id: "bothell-mcs-composition-1", label: "B WRIT 133 or B WRIT 134 or ENGL 131 or equivalent", options: singleOptions(["BWRIT 133", "BWRIT 134", "ENGL 131"]) },
      { id: "bothell-mcs-composition-2", label: "B WRIT 135 or ENGL 141 or equivalent", options: singleOptions(["BWRIT 135", "ENGL 141"]) },
    ],
    courseBuckets: [
      { id: "bothell-mcs-writing-seminar", label: "Interdisciplinary Writing Seminar", minCredits: 5, courseCodes: ["BIS 290"] },
      { id: "bothell-mcs-core", label: "MCS Core Course", minCredits: 5, courseCodes: ["BISMCS 333"] },
      { id: "bothell-mcs-practice", label: "MCS Communication Practice & Media Production", minCredits: 10, courseCodes: bothellMcsPracticeProductionCourses },
      { id: "bothell-mcs-additional", label: "Additional MCS Major Coursework", minCredits: 25, courseCodes: unique([...bothellMcsAdditionalCourses, ...bothellMcsTopicsCourses]) },
      { id: "bothell-mcs-ias", label: "Additional School of IAS Coursework", minCredits: 20, courseCodes: [] },
      { id: "bothell-mcs-composition", label: "Composition Coursework", minCredits: 10, courseCodes: bothellMcsCompositionCourses },
    ],
    genEdRequirements: [
      "TOTAL = 75 Credits",
      "Interdisciplinary Writing Seminar: BIS 290",
      "Core Course: BISMCS 333",
      "MCS Communication Practice & Media Production (MCS:P&P) Courses",
      "Additional MCS Major Coursework (MCS)",
      "Additional School of IAS Coursework",
      "10 credits of Composition Coursework",
      "Residency Requirement: 30 credits must be completed in residency at UW Bothell",
      "Cumulative GPA Requirement: Major GPA must be at a cumulative of 2.00 or higher",
      "Interdisciplinary Practice & Reflection (IPR)",
      "Upper Division Credit Policy: A maximum of 35 credits earned in 100- and 200-level courses may apply toward the major",
    ],
    requirementLabels: [
      "Media & Communication Studies",
      "MCS Core Course",
      "Communication Practice and Media Production Courses",
      "Additional MCS Courses",
      "Topics courses",
    ],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-arts-media-culture",
    title: "Arts, Media and Culture",
    officialSources: [
      "https://www.tacoma.uw.edu/sias/cac/arts-media-culture",
      "https://www.tacoma.uw.edu/sias/cac/film-and-media-track",
      "https://www.tacoma.uw.edu/sias/cac/american-cultures-track",
      "https://www.tacoma.uw.edu/sias/cac/visual-and-performing-arts-track",
      "https://www.tacoma.uw.edu/sias/cac/literature-track",
      "https://www.tacoma.uw.edu/sias/cac/comparative-arts-track",
    ],
    expectedPathwayIds: [
      "american-cultures-track",
      "comparative-arts-track",
      "film-and-media-track",
      "literature-track",
      "visual-and-performing-arts-track",
    ],
    pathwayGroups: [
      { id: "american-cultures-track", label: "American Cultures Track", suggestedCourses: tacomaAmcCourses },
      { id: "comparative-arts-track", label: "Comparative Arts Track", suggestedCourses: tacomaAmcCourses },
      { id: "film-and-media-track", label: "Film and Media Track", suggestedCourses: tacomaAmcCourses },
      { id: "literature-track", label: "Literature Track", suggestedCourses: tacomaAmcCourses },
      { id: "visual-and-performing-arts-track", label: "Visual and Performing Arts Track", suggestedCourses: tacomaAmcCourses },
    ],
    requiredCourseCodes: tacomaAmcCourses,
    optionGroups: [
      { id: "tacoma-amc-foundation", label: "TLIT 220 Literature and the Arts OR TFILM 220 Film and the Arts", options: singleOptions(tacomaAmcFoundationCourses) },
      { id: "tacoma-amc-history", label: "History (List A)", options: singleOptions(tacomaAmcHistoryCourses) },
      { id: "tacoma-amc-culture", label: "Culture (List B)", options: singleOptions(tacomaAmcCultureCourses) },
      { id: "tacoma-amc-interpretation", label: "Interpretation (List C)", options: singleOptions(tacomaAmcInterpretationCourses) },
      { id: "tacoma-amc-practice", label: "Practice/Studio (List D)", options: singleOptions(tacomaAmcPracticeCourses) },
      { id: "tacoma-amc-film-media", label: "Film and Media (List F)", options: singleOptions(tacomaAmcFilmAndMediaCourses) },
      { id: "tacoma-amc-literature", label: "Literature (List E)", options: singleOptions(tacomaAmcLiteratureCourses) },
      { id: "tacoma-amc-visual-performing", label: "Visual and Performing Arts (List G)", options: singleOptions(tacomaAmcVisualPerformingCourses) },
    ],
    courseBuckets: [
      { id: "tacoma-amc-foundation", label: "Foundation", minCredits: 5, courseCodes: tacomaAmcFoundationCourses },
      { id: "tacoma-amc-history", label: "History", minCredits: 10, courseCodes: tacomaAmcHistoryCourses },
      { id: "tacoma-amc-culture", label: "Culture", minCredits: 5, courseCodes: tacomaAmcCultureCourses },
      { id: "tacoma-amc-interpretation", label: "Interpretation", minCredits: 5, courseCodes: tacomaAmcInterpretationCourses },
      { id: "tacoma-amc-practice", label: "Practice/Studio", minCredits: 5, courseCodes: tacomaAmcPracticeCourses },
      { id: "tacoma-amc-track", label: "Track coursework", minCredits: 35, courseCodes: tacomaAmcCourses },
    ],
    genEdRequirements: [
      "60 credits",
      "minimum of 30 credits of upper-division (300-400 level) courses",
      "UWT general education",
      "graduation requirements totaling a minimum of 180 credits",
      "At least 45 lower-division credits",
    ],
    requirementLabels: [
      "Arts, Media & Culture",
      "American Cultures Track",
      "Comparative Arts Track",
      "Film and Media Track",
      "Literature Track",
      "Visual and Performing Arts Track",
      "List A History",
      "List B: Culture",
      "List C: Interpretation",
      "List D: Practice / Studio Courses",
      "List E: Literature",
      "List G: Visual and Performing Arts",
    ],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-communications",
    title: "Communication",
    officialSources: [
      "https://www.tacoma.uw.edu/sias/cac/communication",
      "https://www.tacoma.uw.edu/sias/cac/professional-track",
      "https://www.tacoma.uw.edu/sias/cac/research-track",
    ],
    expectedPathwayIds: ["professional-track", "research-track"],
    pathwayGroups: [
      { id: "professional-track", label: "Professional Track", suggestedCourses: unique([...tacomaCommunicationResearchCoreCourses, ...tacomaCommunicationProfessionalCourses]) },
      { id: "research-track", label: "Research Track", suggestedCourses: tacomaCommunicationResearchCoreCourses },
    ],
    requiredCourseCodes: tacomaCommunicationCourses,
    optionGroups: [
      { id: "tacoma-com-admission", label: "TCOM 201 Media and Society OR TCOM 230 Media Globalization and Citizenship", options: singleOptions(["TCOM 201", "TCOM 230"]) },
      { id: "tacoma-com-foundation", label: "TCOM 444 Gender, Ethnicity, Class and Media or TCOM 453 Critical Approaches to Mass Communication", options: singleOptions(["TCOM 444", "TCOM 453"]) },
      { id: "tacoma-com-professional", label: "Professional Track", options: singleOptions(tacomaCommunicationProfessionalCourses) },
      { id: "tacoma-com-research-core", label: "Communication Core - List A", options: singleOptions(tacomaCommunicationResearchCoreCourses) },
    ],
    courseBuckets: [
      { id: "tacoma-com-admission", label: "Admission Requirements", minCredits: 5, courseCodes: ["TCOM 201", "TCOM 230"] },
      { id: "tacoma-com-prof-foundation", label: "Professional Track Foundation", minCredits: 5, courseCodes: ["TCOM 444", "TCOM 453"] },
      { id: "tacoma-com-prof-core", label: "Professional Track Core courses", minCredits: 25, courseCodes: tacomaCommunicationResearchCoreCourses },
      { id: "tacoma-com-professional", label: "Professional Track Courses", minCredits: 30, courseCodes: tacomaCommunicationProfessionalCourses, openEndedRules: ["A maximum of two non TCOM classes may be used for this requirement"] },
      { id: "tacoma-com-research-foundation", label: "Research Track Foundation", minCredits: 10, courseCodes: ["TWRT 211", "TCOM 444", "TCOM 453"] },
      { id: "tacoma-com-research-core", label: "Research Track Core courses", minCredits: 45, courseCodes: tacomaCommunicationResearchCoreCourses },
      { id: "tacoma-com-capstone", label: "Optional Capstone", minCredits: 5, courseCodes: ["TCOM 490", "TCOM 495"] },
    ],
    genEdRequirements: [
      "Professional Track: You need to complete 60 credits",
      "Research Track: You need to complete 55 credits",
      "minimum of 20 credits of upper-division (300-400 level) courses",
      "UWT general education",
      "graduation requirements totaling a minimum of 180 credits",
      "Transfer Credits: A maximum of 15 credits are allowed to be transferred toward the Communication degree",
      "The remaining 100 credits should be in General Requirements",
    ],
    requirementLabels: [
      "Communication",
      "Professional Track",
      "Research Track",
      "Foundation",
      "Core courses",
      "Professional Track Courses",
      "Optional Capstone",
    ],
  },
];

module.exports = {
  communicationPrograms,
};
