function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

const seattleCsFundamentals = [
  "CSE 121",
  "CSE 122",
  "CSE 123",
  "CSE 143",
  "CSE 311",
  "CSE 312",
  "CSE 331",
  "CSE 332",
  "CSE 351",
];

const seattleCsMathOptions = [
  ["MATH 124", "MATH 125", "MATH 126"],
  ["MATH 134", "MATH 135", "MATH 136"],
];

const seattleCsNaturalScienceOptions = [
  ["PHYS 121"],
  ["PHYS 141"],
  ["CHEM 142"],
  ["CHEM 143"],
  ["CHEM 145"],
  ["BIOL 180"],
  ["BIOL 162"],
  ["PHYS 116", "PHYS 119"],
];

const seattleCsCoreCourses = [
  "CSE 331",
  "CSE 333",
  "CSE 340",
  "CSE 341",
  "CSE 344",
  "CSE 369",
  "EE 371",
  "STAT 391",
  "CSE 401",
  "CSE 402",
  "CSE 403",
  "CSE 421",
  "CSE 422",
  "CSE 426",
  "CSE 427",
  "CSE 431",
  "CSE 434",
  "CSE 438",
  "CSE 440",
  "CSE 442",
  "CSE 443",
  "CSE 444",
  "CSE 446",
  "CSE 447",
  "CSE 451",
  "CSE 452",
  "CSE 453",
  "CSE 455",
  "CSE 457",
  "CSE 458",
  "CSE 461",
  "CSE 462",
  "EE 469",
  "EE 470",
  "CSE 473",
  "EE 474",
  "CSE 478",
  "CSE 484",
  "CSE 486",
  "CSE 493",
];

const seattleCsSeniorElectives = [
  "BIOEN 485",
  "DXARTS 460",
  "MUSIC 460",
  "DXARTS 461",
  "MUSIC 461",
  "DXARTS 462",
  "MUSIC 462",
  "DXARTS 463",
  "MUSIC 463",
  "EE 331",
  "EE 332",
  "EE 341",
  "ENGR 321",
  "ENTRE 432",
  "GEOG 360",
  "GEOG 460",
  "GEOG 463",
  "GEOG 465",
  "INFO 444",
  "INFO 446",
  "INFO 454",
  "LING 472",
  "MATH 307",
  "MATH 318",
  "MATH 334",
  "MATH 335",
  "MATH 336",
  "MATH 402",
  "MATH 403",
  "MATH 404",
  "MATH 407",
  "MATH 408",
  "MATH 409",
  "MATH 414",
  "MATH 415",
  "MATH 424",
  "MATH 425",
  "MATH 426",
  "MATH 435",
  "MATH 436",
  "MATH 441",
  "MATH 442",
  "MATH 461",
  "MATH 462",
  "MATH 464",
  "MATH 465",
  "MATH 466",
  "MUSIC 400",
  "STAT 341",
  "STAT 342",
  "STAT 421",
  "STAT 395",
  "MATH 395",
  "STAT 396",
  "MATH 396",
  "STAT 491",
  "MATH 491",
];

const seattleCsCapstones = ["CSE 428", "CSE 460", "CSE 475", "CSE 481", "CSE 482"];

const bothellCssePrerequisites = [
  "B WRIT 134",
  "B WRIT 135",
  "STMATH 124",
  "STMATH 125",
  "CSS 142",
  "CSS 143",
  "CSS 132",
  "CSS 133",
  "CSSSKL 142",
  "CSSSKL 143",
];

const bothellCsseStatisticsOptions = [
  ["BBUS 215"],
  ["BHLTH 215"],
  ["BMATH 215"],
  ["BIS 215"],
  ["STMATH 341"],
  ["STMATH 390"],
];

const bothellCsseCoreCourses = [
  "CSS 301",
  "CSS 342",
  "CSS 343",
  "CSS 350",
  "CSS 360",
  "CSS 370",
  "CSS 422",
  "CSS 430",
  "CSS 497",
];

const bothellCsseOpenElectiveCourseCodes = [
  "CSS 290",
  "CSS 390",
  "CSS 397",
  "CSS 490",
  "CSS 498",
  "CSS 499",
];

const bothellIacCourses = [
  "CSS 310",
  "INFO 312",
  "INFO 314",
  "INFO 415",
  "CSS 337",
  "CSS 411",
  "CSS 415",
  "CSS 432",
  "TINFO 250",
  "TINFO 441",
  "TINFO 442",
  "TINFO 443",
];

const tacomaCssBaCourses = [
  "TMATH 124",
  "TMATH 110",
  "TCSS 101",
  "TCSS 141",
  "TCSS 142",
  "TCSS 143",
  "TCSS 305",
  "TCSS 321",
  "TCSS 325",
  "TCSS 342",
  "TCSS 360",
  "TCSS 371",
  "TCSS 496",
];

const tacomaCssBsCourses = [
  "TMATH 124",
  "TMATH 125",
  "TMATH 126",
  "TMATH 208",
  "TMATH 390",
  "TCSS 142",
  "TCSS 143",
  "TCSS 305",
  "TCSS 321",
  "TCSS 325",
  "TCSS 342",
  "TCSS 343",
  "TCSS 360",
  "TCSS 371",
  "TCSS 372",
  "TCSS 380",
  "TCSS 422",
];

const tacomaCssLabScienceCourses = [
  "TBIOL 110",
  "TCHEM 105",
  "TCHEM 131",
  "TGEOS 117",
  "TPHYS 121",
  "TPHYS 122",
  "TCHEM 142",
  "TBIOL 120",
];

const tacomaCssDesignElectives = [
  "TCSS 437",
  "TCSS 445",
  "TCSS 450",
  "TCSS 452",
  "TCSS 460",
  "TCSS 461",
  "TCSS 465",
  "TCSS 491",
];

const tacomaCssSpecialElectives = ["TCSS 497", "TCSS 498", "TCSS 499"];

const computerSciencePrograms = [
  {
    campusId: "uw-seattle",
    planId: "uw-seattle-computer-science",
    title: "Computer Science",
    officialSources: [
      "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/",
      "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/",
      "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/capstones/",
      "https://www.cs.washington.edu/wp-content/uploads/2024/12/CS_TransferPlanningWorksheet.pdf",
      "https://s3-us-west-2.amazonaws.com/www-cse-public/ugrad/curriculum/CS__Fall23.pdf",
      "https://s3-us-west-2.amazonaws.com/www-cse-public/ugrad/curriculum/CS_DS_degreq_fall23.pdf",
    ],
    expectedPathwayIds: ["data-science-option"],
    pathwayGroups: [
      {
        id: "data-science-option",
        label: "Computer Science - Data Science Option",
        sourceUrl: "https://s3-us-west-2.amazonaws.com/www-cse-public/ugrad/curriculum/CS_DS_degreq_fall23.pdf",
        suggestedCourses: ["SOC 225", "CSE 421", "CSE 444", "CSE 446", "CSE 442"],
        enrichingCourses: ["CSE 427", "CSE 455", "CSE 484", "CSE 447"],
      },
    ],
    requiredCourseCodes: unique([
      ...seattleCsFundamentals,
      ...seattleCsMathOptions.flat(),
      "MATH 208",
      ...seattleCsNaturalScienceOptions.flat(),
      ...seattleCsCoreCourses,
    ]),
    optionGroups: [
      {
        id: "seattle-cs-programming",
        label: "CSE 123 Intro to Computer Programming III or CSE 143 Computer Programming II",
        options: [["CSE 121", "CSE 122", "CSE 123"], ["CSE 143"]],
      },
      {
        id: "seattle-cs-calculus",
        label: "MATH 124, 125, 126 or MATH 134, 135, 136 honors",
        options: seattleCsMathOptions,
      },
      {
        id: "seattle-cs-natural-science",
        label: "One course from the list of approved Natural Science courses",
        options: seattleCsNaturalScienceOptions,
      },
      {
        id: "seattle-cs-data-science-elective",
        label: "One additional course chosen from the Data Science electives",
        options: [["CSE 427"], ["CSE 455"], ["CSE 484"], ["CSE 447"]],
      },
    ],
    courseBuckets: [
      {
        id: "seattle-cs-fundamentals",
        label: "Fundamentals",
        minCredits: 24,
        maxCredits: 25,
        courseCodes: seattleCsFundamentals,
      },
      {
        id: "seattle-cs-core-courses",
        label: "CSE Core Courses",
        minCredits: 33,
        courseCodes: seattleCsCoreCourses,
        openEndedRules: [
          "Four 400-level courses from the CSE Core Courses list",
          "Two additional CSE Core Courses, 300 or 400 level",
          "Either one additional CSE Core Course or one course from the CSE Capstone list",
        ],
      },
      {
        id: "seattle-cs-capstones",
        label: "CSE Capstone list",
        minCredits: 3,
        courseCodes: seattleCsCapstones,
      },
      {
        id: "seattle-cs-senior-electives",
        label: "CSE Elective list",
        minCredits: 0,
        courseCodes: unique([...seattleCsCoreCourses, ...seattleCsSeniorElectives]),
        openEndedRules: [
          "A CSE Senior Elective is a course that has a significant overlap with computer science and engineering",
          "Any graded 400-level EE majors course with the exception of EE 406, EE 452-457, EE 471, EE 472, EE 478, and EE 491",
        ],
      },
    ],
    genEdRequirements: [
      "180 total credits",
      "English Composition (5)",
      "Foreign Language through 3rd quarter",
      "UW Diversity Requirement (5)",
      "Reasoning and Writing in Context (15 credits)",
      "UW approved writing courses (W courses) or additional composition courses (10)",
      "Arts and Humanities (20)",
      "Social Sciences (20)",
      "Natural Sciences (20)",
      "Additional coursework (15)",
      "Free Electives to bring total credits up to the 180 required for graduation",
    ],
    requirementLabels: [
      "Computer Science Graduation Requirements",
      "Computer Science (Data Science Option) Graduation Requirements",
      "Mathematics and Science Component",
      "Computer Science Component",
      "Core and Electives (33 credits)",
      "Data and Society",
      "A student's cumulative GPA must not fall below a 2.0",
      "Starting 2022-2023, UW is replacing CSE 142 and CSE 143 with CSE 121, 122, and 123",
    ],
  },
  {
    campusId: "uw-bothell",
    planId: "uw-bothell-csse",
    title: "Computer Science & Software Engineering",
    officialSources: [
      "https://www.uwb.edu/stem/undergraduate/majors/bscsse",
      "https://www.uwb.edu/stem/undergraduate/majors/bscsse/admissions",
      "https://www.uwb.edu/stem/undergraduate/majors/bscsse/curriculum",
      "https://www.uwb.edu/stem/undergraduate/majors/bscsse/capstone",
    ],
    expectedPathwayIds: ["iac-option"],
    pathwayGroups: [
      {
        id: "iac-option",
        label: "Information Assurance and Cybersecurity (IAC) option",
        sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/curriculum",
        suggestedCourses: bothellIacCourses,
      },
    ],
    requiredCourseCodes: unique([
      ...bothellCssePrerequisites,
      ...bothellCsseStatisticsOptions.flat(),
      ...bothellCsseCoreCourses,
      ...bothellIacCourses,
    ]),
    optionGroups: [
      {
        id: "bothell-csse-writing",
        label: "",
        options: [["B WRIT 134", "B WRIT 135"]],
      },
      {
        id: "bothell-csse-calculus",
        label: "",
        options: [["STMATH 124", "STMATH 125"]],
      },
      {
        id: "bothell-csse-programming",
        label: "",
        options: [["CSS 142", "CSS 143"], ["CSS 132", "CSS 133"]],
      },
      {
        id: "bothell-csse-statistics",
        label: "",
        options: bothellCsseStatisticsOptions,
      },
      {
        id: "bothell-csse-iac-electives",
        label: "",
        options: bothellIacCourses.map((courseCode) => [courseCode]),
      },
    ],
    courseBuckets: [
      {
        id: "bothell-csse-core-requirements",
        label: "",
        courseCodes: bothellCsseCoreCourses,
      },
      {
        id: "bothell-csse-css-electives",
        label: "",
        courseCodes: bothellCsseOpenElectiveCourseCodes,
      },
      {
        id: "bothell-csse-advanced-electives",
        label: "",
        courseCodes: [],
      },
      {
        id: "bothell-csse-capstone",
        label: "",
        courseCodes: ["CSS 497"],
      },
    ],
    genEdRequirements: [],
    requirementLabels: [],
  },
  {
    campusId: "uw-bothell",
    planId: "uw-bothell-csse-information-assurance-and-cybersecurity",
    title: "Computer Science & Software Engineering: Information Assurance & Cybersecurity",
    officialSources: [
      "https://www.uwb.edu/stem/undergraduate/majors/bscsse/curriculum",
    ],
    expectedPathwayIds: ["iac-option"],
    pathwayGroups: [
      {
        id: "iac-option",
        label: "Information Assurance and Cybersecurity (IAC) option",
        sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/curriculum",
        suggestedCourses: bothellIacCourses,
      },
    ],
    requiredCourseCodes: unique([
      ...bothellCssePrerequisites,
      ...bothellCsseStatisticsOptions.flat(),
      ...bothellCsseCoreCourses,
      ...bothellIacCourses,
      ...bothellCsseOpenElectiveCourseCodes,
    ]),
    optionGroups: [
      {
        id: "bothell-iac-writing",
        label: "",
        options: [["B WRIT 134", "B WRIT 135"]],
      },
      {
        id: "bothell-iac-calculus",
        label: "",
        options: [["STMATH 124", "STMATH 125"]],
      },
      {
        id: "bothell-iac-programming",
        label: "",
        options: [["CSS 142", "CSS 143"], ["CSS 132", "CSS 133"]],
      },
      {
        id: "bothell-iac-statistics",
        label: "",
        options: bothellCsseStatisticsOptions,
      },
      {
        id: "bothell-iac-electives",
        label: "",
        options: bothellIacCourses.map((courseCode) => [courseCode]),
      },
      {
        id: "bothell-iac-additional-css-elective",
        label: "",
        options: bothellCsseOpenElectiveCourseCodes.map((courseCode) => [courseCode]),
      },
    ],
    courseBuckets: [
      {
        id: "bothell-iac-core-requirements",
        label: "",
        courseCodes: bothellCsseCoreCourses,
      },
      {
        id: "bothell-iac-option-requirements",
        label: "",
        courseCodes: unique([...bothellIacCourses, ...bothellCsseOpenElectiveCourseCodes]),
      },
      {
        id: "bothell-iac-capstone",
        label: "",
        courseCodes: ["CSS 497"],
      },
    ],
    genEdRequirements: [],
    requirementLabels: [],
  },
  {
    campusId: "uw-tacoma",
    planId: "uw-tacoma-computer-science-and-systems",
    title: "Computer Science and Systems",
    officialSources: [
      "https://www.tacoma.uw.edu/set/programs/undergrad/css",
      "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
      "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
      "https://www.tacoma.uw.edu/sites/default/files/2022-10/CSS_B.A._Grid_2022.pdf",
      "https://www.tacoma.uw.edu/sites/default/files/2024-10/css_b.s-grid_2023.pdf",
    ],
    expectedPathwayIds: ["bachelor-of-arts", "bachelor-of-science"],
    pathwayGroups: [
      {
        id: "bachelor-of-arts",
        label: "Bachelor of Arts",
        sourceUrl: "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
        suggestedCourses: tacomaCssBaCourses,
      },
      {
        id: "bachelor-of-science",
        label: "Bachelor of Science",
        sourceUrl: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
        suggestedCourses: unique([
          ...tacomaCssBsCourses,
          ...tacomaCssLabScienceCourses,
          ...tacomaCssDesignElectives,
          ...tacomaCssSpecialElectives,
        ]),
      },
    ],
    requiredCourseCodes: unique([
      ...tacomaCssBaCourses,
      ...tacomaCssBsCourses,
      ...tacomaCssLabScienceCourses,
      ...tacomaCssDesignElectives,
      ...tacomaCssSpecialElectives,
    ]),
    optionGroups: [
      {
        id: "tacoma-css-ba-intro-programming",
        label: "TCSS 101 or TCSS 141",
        options: [["TCSS 101"], ["TCSS 141"]],
      },
      {
        id: "tacoma-css-bs-lab-science",
        label: "Any lab-based science except Astronomy",
        options: tacomaCssLabScienceCourses.map((courseCode) => [courseCode]),
      },
      {
        id: "tacoma-css-bs-additional-science-or-math",
        label: "An additional lab-based science course or an additional 300 or 400-level math course, except TMATH 310",
        options: tacomaCssLabScienceCourses.map((courseCode) => [courseCode]),
      },
    ],
    courseBuckets: [
      {
        id: "tacoma-css-ba-core",
        label: "Core Courses",
        minCredits: 0,
        courseCodes: tacomaCssBaCourses,
      },
      {
        id: "tacoma-css-bs-core",
        label: "Computer Science Core Courses",
        minCredits: 0,
        courseCodes: tacomaCssBsCourses,
      },
      {
        id: "tacoma-css-ba-senior-electives",
        label: "CSS Electives: complete 20 additional credits",
        minCredits: 20,
        courseCodes: tacomaCssSpecialElectives,
        openEndedRules: [
          "300-level or 400-level courses chosen from the Computer Science & Systems program",
          "excluding TCSS 390",
          "Required Minor: Meet the requirements of your selected minor",
          "Complete 15 credits of general electives",
        ],
      },
      {
        id: "tacoma-css-bs-senior-electives",
        label:
          "Students must complete 25 additional graded credits of 300-level or 400-level courses chosen from the Computer Science & Systems program",
        minCredits: 25,
        courseCodes: unique([...tacomaCssDesignElectives, ...tacomaCssSpecialElectives]),
        openEndedRules: [
          "5 credits from the following approved design electives",
          "An additional 10 credits of 300- or 400-level TCSS electives",
          "An additional 10 credits of 400-level TCSS electives",
          "No more than 10 credits of TCSS 497, TCSS 498, and TCSS 499 may be used to satisfy the elective requirement",
          "You may also take up to 5 credits of a 400-level SET course",
        ],
      },
    ],
    genEdRequirements: [
      "minimum grade of 2.0 in each individual prerequisite course",
      "Required cumulative prerequisite GPA of at least 2.5",
      "Required minimum cumulative GPA of 2.0 in all college coursework",
      "completed at least 45 college-level credits",
      "You may need one additional approved lab-based science course",
      "18 minimum",
    ],
    requirementLabels: [
      "B.S. in Computer Science & Systems",
      "Bachelor of Arts Option",
      "B.A. majors must minor in a field that is not computer science",
      "B.S. majors have 4 additional class requirements",
      "All courses within the major must be completed with a minimum grade of 2.0",
      "The B.S. in Computer Science & Systems is accredited by the Computing Accreditation Commission",
      "with Honors in Computer Science and Systems",
    ],
  },
];

module.exports = {
  computerSciencePrograms,
};
