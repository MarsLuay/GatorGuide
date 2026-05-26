const auditOwners = [
  {
    planId: "uw-seattle-computer-science",
    owner: "Allen School",
    title: "Computer Science",
    officialSources: [
      "https://s3-us-west-2.amazonaws.com/www-cse-public/ugrad/curriculum/CS__Fall23.pdf",
      "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#natural-science",
    ],
    knownMismatchSummary: [
      "CSE 143/CS 145 is parsed and generated but not student-visible for base CS and the Data Science option.",
      "SOC 225 is parsed for the Data Science option but has no Green River mapping.",
      "The Data Science option still reports source-scope contamination from the broad Allen natural-science page.",
    ],
  },
  {
    planId: "uw-seattle-computer-engineering",
    owner: "Allen School",
    title: "Computer Engineering",
    officialSources: [
      "https://www.cs.washington.edu/wp-content/uploads/2025/02/CompE_degreq_dec24v2.pdf",
      "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#core",
    ],
    knownMismatchSummary: [
      "CSE 143/CS 145 is parsed and generated but not visible in the transfer-only quarter plan.",
      "EE 205 is parsed from the Fundamentals section but has no Green River mapping.",
    ],
  },
  {
    planId: "uw-seattle-materials-science-engineering",
    owner: "MSE",
    title: "Materials Science & Engineering",
    officialSources: [
      "https://mse.washington.edu/current/undergrad/courses",
      "https://mse.washington.edu/current/undergrad/nmeoption",
    ],
    knownMismatchSummary: [
      "The MATH 209/MATH 309 math elective is parsed but unmapped.",
      "The MATH 224/MATH 324 and broader math-elective option group over-schedules alternatives.",
      "The parsed math option group disappears after generated/runtime materialization.",
      "The NME 19-credit core/elective bucket is flattened or missing from generated/runtime materialization.",
      "MSE/NME transfer-only rows and prep-credit separation regressions still fail diagnostic expectations.",
    ],
  },
  {
    planId: "uw-seattle-aeronautics-astronautics",
    owner: "Aeronautics & Astronautics",
    title: "Aeronautics & Astronautics",
    officialSources: ["https://www.aa.washington.edu/students/academics/bsaae"],
    knownMismatchSummary: [
      "The CSE 160 / ME 123 / other NSc science option is missing the non-concrete NSc category option.",
    ],
  },
  {
    planId: "uw-seattle-civil-engineering",
    owner: "Civil & Environmental Engineering",
    title: "Civil Engineering",
    officialSources: [
      "https://www.ce.washington.edu/sites/default/files/pdfs/current/undergrad/uw-cee-bsce-degree-sheet.pdf",
    ],
    knownMismatchSummary: [
      "ESS 101 is parsed with a known equivalent but is not student-visible.",
      "ESS 106 is parsed in the basic science elective list but has no mapped Green River equivalent.",
      "The statistics option bucket is parsed but missing mapping/materialization.",
    ],
  },
  {
    planId: "uw-seattle-environmental-engineering",
    owner: "Civil & Environmental Engineering",
    title: "Environmental Engineering",
    officialSources: [
      "https://www.ce.washington.edu/sites/default/files/pdfs/current/undergrad/uw-cee-bsenve-degree-sheet.pdf",
    ],
    knownMismatchSummary: [
      "ENVIR 235 and INDE 250 are parsed for the CEE topic requirement but remain unmapped.",
      "The Computer Programming true-option group is expected but missing from the diagnostic runtime shape.",
    ],
  },
  {
    planId: "uw-seattle-chemical-engineering",
    owner: "Chemical Engineering",
    title: "Chemical Engineering",
    officialSources: ["https://www.cheme.washington.edu/undergraduate_students/curriculum"],
    knownMismatchSummary: [
      "PHYS 141, PHYS 142, and PHYS 143 honors substitutions are parsed but unmapped in both base and NME option contexts.",
    ],
  },
  {
    planId: "uw-seattle-electrical-computer-engineering",
    owner: "Electrical & Computer Engineering",
    title: "Electrical & Computer Engineering",
    officialSources: [
      "https://www.ece.uw.edu/academics/bachelor-of-science/bsece/degree-requirements/",
    ],
    knownMismatchSummary: [
      "BIOL 161 and CHEM 220 are parsed/generated but not visible across base and ECE pathway materializations.",
      "BIOL 162, CHEM 153, CHEM 155, EE 233, MATH 134, MATH 135, and MATH 136 are parsed across base/pathways but unmapped.",
      "The same lower-division source rows fan out across ECE pathways, amplifying one source mismatch into many runtime rows.",
    ],
  },
  {
    planId: "uw-seattle-mechanical-engineering",
    owner: "Mechanical Engineering",
    title: "Mechanical Engineering",
    officialSources: ["https://www.me.washington.edu/students/ug/requirements"],
    knownMismatchSummary: [],
  },
  {
    planId: "uw-seattle-industrial-systems-engineering",
    owner: "Industrial & Systems Engineering",
    title: "Industrial & Systems Engineering",
    officialSources: ["https://ise.washington.edu/files/BSIE%20Graduation%20Requirements.pdf"],
    knownMismatchSummary: [
      "MATH 136 is emitted from the source audit as unmapped, likely from prerequisite/prose rather than a schedulable requirement.",
    ],
  },
  {
    planId: "uw-seattle-bioengineering",
    owner: "Bioengineering",
    title: "Bioengineering",
    officialSources: [
      "https://bioe.uw.edu/academic-programs/undergraduate/undergraduate-degree-requirements/",
    ],
    knownMismatchSummary: [
      "BIOEN 215 is parsed from the Bioengineering core but has no Green River mapping.",
    ],
  },
  {
    planId: "uw-seattle-human-centered-design-engineering",
    owner: "HCDE",
    title: "Human Centered Design & Engineering",
    officialSources: [
      "https://www.hcde.washington.edu/bs/requirements",
      "https://www.hcde.washington.edu/bs/requirements/pre-2024",
      "https://www.hcde.washington.edu/bs/requirements/2024",
    ],
    knownMismatchSummary: [
      "ASTR 211, ATMS 211, BIOL 130, BIOL 250, ESS 213, INDE 250, MATH 134, and MATH 135 are parsed but unmapped.",
      "BIOL 161 is parsed with a known Green River equivalent but missing from generated runtime rows.",
      "MATH 120 is generated but not visible in the transfer-only quarter plan.",
      "Default choices for MATH 124/Q SCI 291, MATH 125/Q SCI 292, and CHEM 220/223/237 are not scheduled.",
    ],
  },
];

module.exports = {
  auditOwners,
};
