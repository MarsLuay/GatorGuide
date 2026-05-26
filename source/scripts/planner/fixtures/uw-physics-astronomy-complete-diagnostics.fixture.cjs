"use strict";

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}

function courses(value) {
  return unique(
    value
      .split(/[\n,]+/)
      .map((course) => course.trim())
      .filter(Boolean)
  );
}

function singleOptions(values) {
  return values.map((value) => [value]);
}

const seattleAstronomyAdmissionsAndCore = courses(`
  ASTR 300, ASTR 480, ASTR 481, ASTR 482, ASTR 499,
  MATH 124, MATH 125, MATH 126, MATH 134, MATH 135,
  PHYS 121, PHYS 122, PHYS 123
`);

const seattleAstronomyCatalogCourses = courses(`
  ASTR 101, ASTR 102, ASTR 105, ASTR 109, ASTR 150, ASTR 160, ASTR 190, ASTR 192,
  ASTR 201, ASTR 210, ASTR 216, ASTR 270, ASTR 300, ASTR 301, ASTR 302, ASTR 313,
  ASTR 321, ASTR 322, ASTR 323, ASTR 324, ASTR 400, ASTR 419, ASTR 421, ASTR 423,
  ASTR 425, ASTR 427, ASTR 480, ASTR 481, ASTR 482, ASTR 497, ASTR 498, ASTR 499
`);

const seattleAstronomyApprovedSupportingCourses = courses(`
  AMATH 352, AMATH 353,
  MATH 124, MATH 125, MATH 126, MATH 134, MATH 135, MATH 136, MATH 207, MATH 208,
  MATH 209, MATH 224, MATH 326,
  PHYS 121, PHYS 122, PHYS 123, PHYS 224, PHYS 225, PHYS 226, PHYS 227,
  PHYS 321, PHYS 322, PHYS 323, PHYS 324, PHYS 325, PHYS 328, PHYS 331,
  PHYS 334, PHYS 335, PHYS 421, PHYS 422, PHYS 423, PHYS 431, PHYS 432,
  PHYS 433, PHYS 434
`);

const seattlePhysicsRequirementCourses = courses(`
  AMATH 301, AMATH 351, AMATH 352, AMATH 353, AMATH 401,
  ASTR 321, ASTR 322, ASTR 323, ASTR 480, ASTR 481, ASTR 499,
  BIOC 405, BIOC 440, BIOC 499,
  BIOL 180, BIOL 200, BIOL 220, BIOL 340, BIOL 350, BIOL 355, BIOL 401,
  BIOL 404, BIOL 427, BIOL 461, BIOL 467, BIOL 499,
  CHEM 142, CHEM 143, CHEM 145, CHEM 152, CHEM 153, CHEM 155, CHEM 162,
  CHEM 165, CHEM 223, CHEM 224, CHEM 237, CHEM 238, CHEM 335, CHEM 336,
  CHEM 428, CHEM 452, CHEM 453, CHEM 454, CHEM 455, CHEM 456, CHEM 457,
  CHEM 499,
  GENOME 499, GRDSCH 200,
  MATH 124, MATH 125, MATH 126, MATH 134, MATH 135, MATH 136, MATH 207,
  MATH 208, MATH 209, MATH 224, MATH 334, MATH 335, MATH 336,
  MICROM 499, NEUSCI 499,
  PHYS 122, PHYS 123, PHYS 142, PHYS 143, PHYS 224, PHYS 225, PHYS 226,
  PHYS 227, PHYS 228, PHYS 231, PHYS 294, PHYS 321, PHYS 322, PHYS 323,
  PHYS 324, PHYS 325, PHYS 328, PHYS 329, PHYS 331, PHYS 334, PHYS 335,
  PHYS 401, PHYS 402, PHYS 403, PHYS 407, PHYS 408, PHYS 409, PHYS 417,
  PHYS 429, PHYS 431, PHYS 432, PHYS 433, PHYS 434, PHYS 485, PHYS 486,
  PHYS 487, PHYS 494, PHYS 495, PHYS 496, PHYS 498, PHYS 499
`);

const seattlePhysicsCatalogCourses = courses(`
  PHYS 101, PHYS 104, PHYS 105, PHYS 106, PHYS 107, PHYS 110, PHYS 114,
  PHYS 115, PHYS 116, PHYS 117, PHYS 118, PHYS 119, PHYS 121, PHYS 122,
  PHYS 123, PHYS 141, PHYS 142, PHYS 143, PHYS 207, PHYS 210, PHYS 211,
  PHYS 212, PHYS 214, PHYS 216, PHYS 217, PHYS 224, PHYS 225, PHYS 226,
  PHYS 227, PHYS 228, PHYS 231, PHYS 232, PHYS 248, PHYS 294, PHYS 321,
  PHYS 322, PHYS 323, PHYS 324, PHYS 325, PHYS 328, PHYS 329, PHYS 331,
  PHYS 334, PHYS 335, PHYS 401, PHYS 402, PHYS 403, PHYS 405, PHYS 406,
  PHYS 407, PHYS 408, PHYS 409, PHYS 410, PHYS 411, PHYS 412, PHYS 413,
  PHYS 417, PHYS 419, PHYS 421, PHYS 422, PHYS 423, PHYS 427, PHYS 428,
  PHYS 429, PHYS 431, PHYS 432, PHYS 433, PHYS 434, PHYS 441, PHYS 451,
  PHYS 466, PHYS 485, PHYS 486, PHYS 487, PHYS 488, PHYS 494, PHYS 495,
  PHYS 496, PHYS 498, PHYS 499
`);

const bothellPhysicsCurriculumCourses = courses(`
  BCHEM 143, BCHEM 144,
  BPHYS 121, BPHYS 122, BPHYS 123, BPHYS 221, BPHYS 222, BPHYS 224,
  BPHYS 231, BPHYS 293, BPHYS 311, BPHYS 312, BPHYS 314, BPHYS 317,
  BPHYS 321, BPHYS 322, BPHYS 323, BPHYS 324, BPHYS 325, BPHYS 328,
  BPHYS 431, BPHYS 432, BPHYS 433, BPHYS 441, BPHYS 442, BPHYS 450,
  BPHYS 484, BPHYS 493, BPHYS 494, BPHYS 498, BPHYS 499,
  CSS 112, ENGL 131,
  STMATH 124, STMATH 125, STMATH 126, STMATH 207, STMATH 208, STMATH 224
`);

const bothellPhysicsCatalogCourses = courses(`
  BPHYS 101, BPHYS 114, BPHYS 115, BPHYS 116, BPHYS 117, BPHYS 118, BPHYS 119,
  BPHYS 121, BPHYS 122, BPHYS 123, BPHYS 201, BPHYS 221, BPHYS 222,
  BPHYS 224, BPHYS 231, BPHYS 293, BPHYS 311, BPHYS 312, BPHYS 314,
  BPHYS 317, BPHYS 321, BPHYS 322, BPHYS 323, BPHYS 324, BPHYS 325,
  BPHYS 328, BPHYS 330, BPHYS 431, BPHYS 432, BPHYS 433, BPHYS 441,
  BPHYS 442, BPHYS 450, BPHYS 484, BPHYS 493, BPHYS 494, BPHYS 498,
  BPHYS 499,
  PHYS 114, PHYS 115, PHYS 116, PHYS 117, PHYS 118, PHYS 119, PHYS 121,
  PHYS 122, PHYS 123, PHYS 141, PHYS 142, PHYS 143, PHYS 226, PHYS 227,
  PHYS 231, PHYS 321, PHYS 322, PHYS 323, PHYS 324, PHYS 325, PHYS 328,
  PHYS 423, PHYS 431,
  STMATH 114, STMATH 124, STMATH 125, STMATH 126, STMATH 207, STMATH 208,
  STMATH 224, MATH 207, MATH 208, MATH 224, CSS 112
`);

const bothellPhysicsSharedProgram = {
  officialSources: [
    "https://www.uwb.edu/stem/undergraduate/majors/physics/curriculum",
    "https://www.washington.edu/students/crscatb/bphys.html",
  ],
  requiredCourseCodes: unique([
    ...bothellPhysicsCurriculumCourses,
    ...bothellPhysicsCatalogCourses,
  ]),
  courseBuckets: {
    admissionsAndPreparation: courses(`
      ENGL 131, STMATH 124, STMATH 125, STMATH 126, STMATH 207, STMATH 208,
      STMATH 224, BCHEM 143, BCHEM 144, CSS 112
    `),
    introductoryPhysics: courses(`
      BPHYS 121, BPHYS 122, BPHYS 123, BPHYS 221, BPHYS 222, BPHYS 224,
      BPHYS 231, BPHYS 293
    `),
    upperDivisionPhysics: courses(`
      BPHYS 311, BPHYS 312, BPHYS 314, BPHYS 317, BPHYS 321, BPHYS 322,
      BPHYS 323, BPHYS 324, BPHYS 325, BPHYS 328, BPHYS 431, BPHYS 432,
      BPHYS 433, BPHYS 441, BPHYS 442, BPHYS 450
    `),
    electivesAndCapstone: courses(`
      BPHYS 484, BPHYS 493, BPHYS 494, BPHYS 498, BPHYS 499
    `),
    catalogCoverage: bothellPhysicsCatalogCourses,
  },
  optionGroups: [
    {
      label: "General education requirements",
      options: [],
    },
    {
      label: "Entry prerequisites",
      options: [
        ["STMATH 124", "STMATH 125", "STMATH 126"],
        ["BPHYS 121", "BPHYS 122", "BPHYS 123"],
      ],
    },
    {
      label: "B.A. in Physics",
      options: [["BPHYS 484"], ["BPHYS 493"], ["BPHYS 494"], ["BPHYS 498"], ["BPHYS 499"]],
    },
    {
      label: "B.S. in Physics",
      options: singleOptions(courses("BPHYS 484, BPHYS 493, BPHYS 494, BPHYS 498, BPHYS 499")),
    },
  ],
  genEdExpectations: [
    "English Composition",
    "Additional Writing",
    "Reasoning",
    "Natural Sciences",
    "Arts and Humanities",
    "Social Sciences",
    "Diversity",
    "180 credits",
    "Minimum 2.0 grade",
  ],
};

const physicsAstronomyPrograms = [
  {
    planId: "uw-seattle-astronomy",
    campusId: "uw-seattle",
    title: "Astronomy",
    officialSources: [
      "https://astro.washington.edu/undergraduate-program",
      "https://www.washington.edu/students/crscat/astr.html",
    ],
    expectedPathwayIds: [],
    requiredCourseCodes: unique([
      ...seattleAstronomyAdmissionsAndCore,
      ...seattleAstronomyCatalogCourses,
      ...seattleAstronomyApprovedSupportingCourses,
    ]),
    courseBuckets: {
      admissionPreparation: courses(`
        MATH 124, MATH 125, MATH 126, MATH 134, MATH 135,
        PHYS 121, PHYS 122, PHYS 123
      `),
      astronomyCore: courses("ASTR 300, ASTR 480, ASTR 481, ASTR 482, ASTR 499"),
      astronomyElectivesAndSeminars: courses(`
        ASTR 101, ASTR 102, ASTR 105, ASTR 109, ASTR 150, ASTR 160, ASTR 190,
        ASTR 192, ASTR 201, ASTR 210, ASTR 216, ASTR 270, ASTR 301, ASTR 302,
        ASTR 313, ASTR 321, ASTR 322, ASTR 323, ASTR 324, ASTR 400, ASTR 419,
        ASTR 421, ASTR 423, ASTR 425, ASTR 427, ASTR 497, ASTR 498
      `),
      supportingMathAndPhysics: seattleAstronomyApprovedSupportingCourses,
    },
    optionGroups: [
      {
        label: "Major Admissions Requirements",
        options: [
          ["MATH 124", "MATH 125", "MATH 126"],
          ["MATH 134", "MATH 135", "MATH 136"],
          ["PHYS 121", "PHYS 122", "PHYS 123"],
        ],
      },
      {
        label: "Degree Requirements",
        options: [
          ["ASTR 300", "ASTR 302"],
          ["ASTR 321", "ASTR 324"],
          ["ASTR 322"],
          ["ASTR 323"],
        ],
      },
      {
        label: "Capstone Option",
        options: [["ASTR 480", "ASTR 481", "ASTR 482"], ["ASTR 499"]],
      },
      {
        label: "Departmental Honors Requirements",
        options: [],
      },
    ],
    genEdExpectations: [
      "Bachelor of Science",
      "Astronomy major",
      "Arts and Humanities",
      "Social Sciences",
      "Natural Sciences",
      "Writing",
      "Diversity",
      "Minimum 2.0 grade",
    ],
  },
  {
    planId: "uw-seattle-physics",
    campusId: "uw-seattle",
    title: "Physics",
    officialSources: [
      "https://phys.washington.edu/physics-bs-degree-requirements",
      "https://www.washington.edu/students/crscat/phys.html",
    ],
    expectedPathwayIds: [
      "applied-physics-track",
      "biological-physics-track",
      "comprehensive-track",
      "teaching-physics-track",
    ],
    requiredCourseCodes: unique([
      ...seattlePhysicsRequirementCourses,
      ...seattlePhysicsCatalogCourses,
    ]),
    courseBuckets: {
      admissionPreparation: courses(`
        CHEM 142, CHEM 143, CHEM 145, CHEM 152, CHEM 153, CHEM 155, CHEM 162,
        CHEM 165, MATH 124, MATH 125, MATH 126, MATH 134, MATH 135, MATH 136,
        MATH 207, MATH 208, MATH 224, PHYS 122, PHYS 123, PHYS 142, PHYS 143
      `),
      physicsCore: courses(`
        PHYS 224, PHYS 225, PHYS 226, PHYS 227, PHYS 228, PHYS 321, PHYS 322,
        PHYS 323, PHYS 324, PHYS 325, PHYS 328, PHYS 331, PHYS 334, PHYS 335
      `),
      appliedPhysicsTrack: courses(`
        AMATH 301, AMATH 351, AMATH 352, AMATH 353, AMATH 401, MATH 334,
        MATH 335, MATH 336, PHYS 401, PHYS 402, PHYS 403, PHYS 407, PHYS 408,
        PHYS 409, PHYS 417, PHYS 429, PHYS 431, PHYS 432, PHYS 433, PHYS 434,
        PHYS 485, PHYS 486, PHYS 487, PHYS 498, PHYS 499
      `),
      comprehensiveTrack: courses(`
        ASTR 321, ASTR 322, ASTR 323, ASTR 480, ASTR 481, ASTR 499,
        PHYS 401, PHYS 402, PHYS 403, PHYS 407, PHYS 408, PHYS 409, PHYS 417,
        PHYS 421, PHYS 422, PHYS 423, PHYS 427, PHYS 428, PHYS 429, PHYS 431,
        PHYS 432, PHYS 433, PHYS 434, PHYS 485, PHYS 486, PHYS 487, PHYS 488,
        PHYS 494, PHYS 495, PHYS 496, PHYS 498, PHYS 499
      `),
      teachingPhysicsTrack: courses(`
        PHYS 401, PHYS 402, PHYS 403, PHYS 407, PHYS 408, PHYS 409, PHYS 417,
        PHYS 494, PHYS 495, PHYS 496
      `),
      biologicalPhysicsAndScienceOptions: courses(`
        BIOC 405, BIOC 440, BIOC 499, BIOL 180, BIOL 200, BIOL 220, BIOL 340,
        BIOL 350, BIOL 355, BIOL 401, BIOL 404, BIOL 427, BIOL 461, BIOL 467,
        BIOL 499, CHEM 223, CHEM 224, CHEM 237, CHEM 238, CHEM 335, CHEM 336,
        CHEM 428, CHEM 452, CHEM 453, CHEM 454, CHEM 455, CHEM 456, CHEM 457,
        CHEM 499, GENOME 499, MICROM 499, NEUSCI 499
      `),
      catalogCoverage: seattlePhysicsCatalogCourses,
    },
    optionGroups: [
      {
        label: "Common Requirements, All Tracks (52 credits)",
        options: [
          ["MATH 124", "MATH 125", "MATH 126"],
          ["MATH 134", "MATH 135", "MATH 136"],
          ["PHYS 122", "PHYS 123"],
          ["PHYS 142", "PHYS 143"],
        ],
      },
      {
        label: "Comprehensive Track (addl. 38-46 credits)",
        options: singleOptions(courses("PHYS 401, PHYS 402, PHYS 403, PHYS 407, PHYS 408, PHYS 409, PHYS 417")),
      },
      {
        label: "Applied Physics Track (addl. 34-43 credits)",
        options: singleOptions(courses("AMATH 301, AMATH 351, AMATH 352, AMATH 353, AMATH 401, PHYS 429")),
      },
      {
        label: "Biological Physics Track (addl. 48-56 credits)",
        options: singleOptions(courses("BIOL 180, BIOL 200, BIOL 220, BIOC 405, BIOC 440")),
      },
      {
        label: "Teaching Physics Track (addl. 41-43 credits)",
        options: singleOptions(courses("PHYS 401, PHYS 402, PHYS 403, PHYS 407, PHYS 408, PHYS 409, PHYS 417")),
      },
    ],
    pathwayCourseExpectations: {
      "applied-physics-track": courses(`
        AMATH 301, AMATH 351, AMATH 352, AMATH 353, AMATH 401, MATH 334,
        MATH 335, MATH 336, PHYS 401, PHYS 402, PHYS 403, PHYS 407, PHYS 408,
        PHYS 409, PHYS 417, PHYS 429, PHYS 431, PHYS 432, PHYS 433, PHYS 434,
        PHYS 485, PHYS 486, PHYS 487, PHYS 498, PHYS 499
      `),
      "biological-physics-track": courses(`
        BIOC 405, BIOC 440, BIOC 499, BIOL 180, BIOL 200, BIOL 220, BIOL 340,
        BIOL 350, BIOL 355, BIOL 401, BIOL 404, BIOL 427, BIOL 461, BIOL 467,
        BIOL 499, CHEM 223, CHEM 224, CHEM 237, CHEM 238, CHEM 335, CHEM 336,
        CHEM 428, CHEM 452, CHEM 453, CHEM 454, CHEM 455, CHEM 456, CHEM 457,
        CHEM 499, GENOME 499, MICROM 499, NEUSCI 499
      `),
      "comprehensive-track": courses(`
        ASTR 321, ASTR 322, ASTR 323, ASTR 480, ASTR 481, ASTR 499,
        PHYS 401, PHYS 402, PHYS 403, PHYS 407, PHYS 408, PHYS 409, PHYS 417,
        PHYS 421, PHYS 422, PHYS 423, PHYS 427, PHYS 428, PHYS 429, PHYS 431,
        PHYS 432, PHYS 433, PHYS 434, PHYS 485, PHYS 486, PHYS 487, PHYS 488,
        PHYS 494, PHYS 495, PHYS 496, PHYS 498, PHYS 499
      `),
      "teaching-physics-track": courses(`
        PHYS 401, PHYS 402, PHYS 403, PHYS 407, PHYS 408, PHYS 409, PHYS 417,
        PHYS 494, PHYS 495, PHYS 496
      `),
    },
    genEdExpectations: [
      "Bachelor of Science",
      "Physics major",
      "Applied Physics track",
      "Comprehensive track",
      "Teaching Physics track",
      "Arts and Humanities",
      "Social Sciences",
      "Natural Sciences",
      "Writing",
      "Diversity",
      "Minimum 2.0 grade",
    ],
  },
  {
    ...bothellPhysicsSharedProgram,
    planId: "uw-bothell-physics-ba",
    campusId: "uw-bothell",
    title: "Physics (BA)",
    expectedPathwayIds: ["ba-route"],
    pathwayCourseExpectations: {
      "ba-route": unique([
        ...bothellPhysicsCurriculumCourses,
        ...courses("BPHYS 484, BPHYS 493, BPHYS 494, BPHYS 498, BPHYS 499"),
      ]),
    },
  },
  {
    ...bothellPhysicsSharedProgram,
    planId: "uw-bothell-physics-bs",
    campusId: "uw-bothell",
    title: "Physics (BS)",
    expectedPathwayIds: [],
  },
];

module.exports = {
  physicsAstronomyPrograms,
};
