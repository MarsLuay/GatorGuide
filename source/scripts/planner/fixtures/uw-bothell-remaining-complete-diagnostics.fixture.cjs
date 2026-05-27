const bothellRemainingPlanIds = [
  "uw-bothell-american-and-ethnic-studies",
  "uw-bothell-business-administration-accounting",
  "uw-bothell-business-administration-finance",
  "uw-bothell-business-administration-leadership-and-strategic-innovation",
  "uw-bothell-business-administration-marketing",
  "uw-bothell-business-administration-supply-chain-management",
  "uw-bothell-csse-information-assurance-and-cybersecurity",
  "uw-bothell-culture-literature-and-the-arts",
  "uw-bothell-data-visualization-ba",
  "uw-bothell-data-visualization-bs",
  "uw-bothell-gender-women-and-sexuality-studies",
  "uw-bothell-global-studies",
  "uw-bothell-interactive-media-design",
  "uw-bothell-interdisciplinary-arts",
  "uw-bothell-interdisciplinary-studies-individualized-study",
  "uw-bothell-science-technology-and-society",
  "uw-bothell-society-ethics-and-human-behavior",
  "uw-bothell-chemistry-biochemistry",
];

const equivalentMajorGroups = [
  {
    id: "american-ethnic-studies",
    label: "American and Ethnic Studies",
    planIds: [
      "uw-bothell-american-and-ethnic-studies",
      "uw-seattle-american-ethnic-studies",
      "uw-tacoma-ethnic-gender-and-labor-studies",
    ],
  },
  {
    id: "business-administration-options",
    label: "Business Administration and Options",
    planIds: [
      "uw-bothell-business-administration-accounting",
      "uw-bothell-business-administration-finance",
      "uw-bothell-business-administration-leadership-and-strategic-innovation",
      "uw-bothell-business-administration-marketing",
      "uw-bothell-business-administration-supply-chain-management",
      "uw-seattle-business-administration",
      "uw-tacoma-bachelor-of-arts-in-business-administration",
    ],
  },
  {
    id: "csse-information-assurance",
    label: "Computer Science and Software Engineering: Information Assurance and Cybersecurity",
    planIds: ["uw-bothell-csse-information-assurance-and-cybersecurity"],
  },
  {
    id: "culture-literature-arts",
    label: "Culture, Literature, and Arts",
    planIds: [
      "uw-bothell-culture-literature-and-the-arts",
      "uw-tacoma-arts-media-culture",
    ],
  },
  {
    id: "data-visualization-design",
    label: "Data Visualization and Design",
    planIds: [
      "uw-bothell-data-visualization-ba",
      "uw-bothell-data-visualization-bs",
      "uw-seattle-design",
      "uw-tacoma-urban-design",
    ],
  },
  {
    id: "gender-women-sexuality",
    label: "Gender, Women, and Sexuality Studies",
    planIds: [
      "uw-bothell-gender-women-and-sexuality-studies",
      "uw-seattle-gender-women-and-sexuality-studies",
      "uw-tacoma-ethnic-gender-and-labor-studies",
    ],
  },
  {
    id: "global-international-studies",
    label: "Global and International Studies",
    planIds: [
      "uw-bothell-global-studies",
      "uw-seattle-international-studies",
    ],
  },
  {
    id: "interactive-media-design",
    label: "Interactive Media Design",
    planIds: [
      "uw-bothell-interactive-media-design",
      "uw-seattle-design",
      "uw-tacoma-arts-media-culture",
    ],
  },
  {
    id: "interdisciplinary-arts",
    label: "Interdisciplinary Arts, Social Sciences, and Individualized Studies",
    planIds: [
      "uw-bothell-interdisciplinary-arts",
      "uw-bothell-interdisciplinary-studies-individualized-study",
      "uw-tacoma-interdisciplinary-arts-and-sciences",
      "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed",
      "uw-seattle-individualized-studies",
    ],
  },
  {
    id: "science-technology-society",
    label: "Science, Technology, and Society",
    planIds: [
      "uw-bothell-science-technology-and-society",
      "uw-seattle-history-and-philosophy-of-science",
    ],
  },
  {
    id: "society-ethics-human-behavior",
    label: "Society, Ethics, and Human Behavior",
    planIds: ["uw-bothell-society-ethics-and-human-behavior"],
  },
  {
    id: "biochemistry",
    label: "Biochemistry",
    planIds: [
      "uw-bothell-chemistry-biochemistry",
      "uw-seattle-biochemistry",
    ],
  },
];

const sourceByPlanId = {
  "uw-bothell-american-and-ethnic-studies": [
    "https://www.uwb.edu/ias/undergraduate/majors/american-ethnic-studies",
  ],
  "uw-seattle-american-ethnic-studies": [
    "https://aes.washington.edu/ba-american-ethnic-studies",
  ],
  "uw-tacoma-ethnic-gender-and-labor-studies": [
    "https://www.tacoma.uw.edu/sias/socs/ethnic-gender-and-labor-studies",
  ],
  "uw-bothell-business-administration-accounting": [
    "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/accounting",
  ],
  "uw-bothell-business-administration-finance": [
    "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/finance-option",
  ],
  "uw-bothell-business-administration-leadership-and-strategic-innovation": [
    "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/leadership",
  ],
  "uw-bothell-business-administration-marketing": [
    "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/marketing",
  ],
  "uw-bothell-business-administration-supply-chain-management": [
    "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/supply-chain",
  ],
  "uw-seattle-business-administration": [
    "https://foster.uw.edu/academics/degree-programs/undergraduate-programs/curriculum/",
    "https://foster.uw.edu/academics/degree-programs/undergraduate-programs/curriculum/options/",
  ],
  "uw-tacoma-bachelor-of-arts-in-business-administration": [
    "https://www.tacoma.uw.edu/business/baba",
    "https://www.tacoma.uw.edu/business/design-courses-baba",
  ],
  "uw-bothell-csse-information-assurance-and-cybersecurity": [
    "https://www.uwb.edu/stem/undergraduate/majors/bscsse/curriculum",
  ],
  "uw-bothell-culture-literature-and-the-arts": [
    "https://www.uwb.edu/ias/undergraduate/majors/culture-literature-arts",
  ],
  "uw-tacoma-arts-media-culture": [
    "https://www.tacoma.uw.edu/sias/cac/arts-media-culture",
    "https://www.tacoma.uw.edu/sias/cac/film-and-media-track",
  ],
  "uw-bothell-data-visualization-ba": [
    "https://www.uwb.edu/ias/undergraduate/majors/data-visualization",
    "https://admissions.uwb.edu/register/mpw-DataVis-BA",
  ],
  "uw-bothell-data-visualization-bs": [
    "https://www.uwb.edu/ias/undergraduate/majors/data-visualization",
    "https://admissions.uwb.edu/register/mpw-DataVis-BS",
  ],
  "uw-seattle-design": [
    "https://www.washington.edu/students/gencat/program/S/Art+ArtHistory+Design-105.html",
  ],
  "uw-tacoma-urban-design": [
    "https://www.tacoma.uw.edu/urban-studies/bs-urban-design",
  ],
  "uw-bothell-gender-women-and-sexuality-studies": [
    "https://www.uwb.edu/ias/undergraduate/majors/gender-women-sexuality",
  ],
  "uw-seattle-gender-women-and-sexuality-studies": [
    "https://www.washington.edu/students/gencat/program/S/Gender%2CWomen%2CandSexualityStudies-298.html",
  ],
  "uw-bothell-global-studies": [
    "https://www.uwb.edu/ias/undergraduate/majors/global-studies",
  ],
  "uw-seattle-international-studies": [
    "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html",
  ],
  "uw-bothell-interactive-media-design": [
    "https://www.uwb.edu/premajor/wp-content/uploads/sites/26/2023/07/fillable-imd.pdf",
  ],
  "uw-bothell-interdisciplinary-arts": [
    "https://www.uwb.edu/ias/undergraduate/majors/interdisciplinary-arts",
  ],
  "uw-bothell-interdisciplinary-studies-individualized-study": [
    "https://www.uwb.edu/ias/undergraduate/majors/interdisciplinary-studies",
  ],
  "uw-tacoma-interdisciplinary-arts-and-sciences": [
    "https://www.tacoma.uw.edu/sias/socs/interdisciplinary-arts-and-sciences",
  ],
  "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed": [
    "https://www.washington.edu/students/gencat/program/T/SocialSciences-1132.html",
  ],
  "uw-seattle-individualized-studies": [
    "https://www.washington.edu/students/gencat/program/S/GeneralStudies-185.html",
  ],
  "uw-bothell-science-technology-and-society": [
    "https://www.uwb.edu/ias/undergraduate/majors/science-technology-society",
  ],
  "uw-seattle-history-and-philosophy-of-science": [
    "https://www.washington.edu/students/gencat/program/S/Philosophy-221.html",
  ],
  "uw-bothell-society-ethics-and-human-behavior": [
    "https://www.uwb.edu/ias/undergraduate/majors/society-ethics-human-behavior",
  ],
  "uw-bothell-chemistry-biochemistry": [
    "https://www.uwb.edu/stem/undergraduate/majors/chemistry/curriculum",
  ],
  "uw-seattle-biochemistry": [
    "https://chem.washington.edu/sites/chem/files/documents/undergrad/babioccheck2017_001.pdf",
  ],
};

const expectedPathwaysByPlanId = {
  "uw-seattle-american-ethnic-studies": [
    "african-american-studies-concentration",
    "asian-american-pia-studies-concentration",
    "chicano-a-studies-concentration",
    "comparative-american-ethnic-studies-concentration",
  ],
  "uw-tacoma-ethnic-gender-and-labor-studies": [
    "ethnic-studies-option",
    "gender-studies-option",
    "labor-studies-option",
  ],
  "uw-bothell-business-administration-accounting": ["accounting-option"],
  "uw-bothell-business-administration-finance": ["finance-option-and-concentration"],
  "uw-bothell-business-administration-leadership-and-strategic-innovation": [
    "leadership-and-strategic-innovation-option",
  ],
  "uw-bothell-business-administration-marketing": ["marketing-option-and-concentration"],
  "uw-bothell-business-administration-supply-chain-management": [
    "supply-chain-management-option",
  ],
  "uw-seattle-business-administration": ["ba-route"],
  "uw-tacoma-bachelor-of-arts-in-business-administration": [
    "accounting-option",
    "finance-option",
    "general-business-option",
    "management-option",
    "marketing-option",
  ],
  "uw-bothell-csse-information-assurance-and-cybersecurity": ["iac-option"],
  "uw-tacoma-arts-media-culture": [
    "american-cultures-track",
    "film-and-media-track",
    "visual-and-performing-arts-track",
  ],
  "uw-seattle-international-studies": [
    "ba-option-family:asia",
    "ba-option-family:canada",
    "ba-option-family:europe",
    "ba-option-family:latin-america-and-caribbean",
  ],
  "uw-tacoma-interdisciplinary-arts-and-sciences": ["ba-route"],
  "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed": [
    "the-concentration-coordinator",
  ],
  "uw-seattle-history-and-philosophy-of-science": ["ba-option-family:ethics"],
  "uw-bothell-chemistry-biochemistry": ["biochemistry-option"],
};

const requiredTextByPlanId = {
  "uw-bothell-american-and-ethnic-studies": [
    "American & Ethnic Studies",
    "Degree Requirements",
    "BISAES 305",
  ],
  "uw-bothell-culture-literature-and-the-arts": [
    "Culture, Literature & the Arts",
    "Interdisciplinary Practice & Reflection",
    "Upper Division Credit Policy",
  ],
  "uw-bothell-data-visualization-ba": [
    "Data Visualization",
    "Degree Requirements",
  ],
  "uw-bothell-data-visualization-bs": [
    "Data Visualization",
    "Degree Requirements",
  ],
  "uw-seattle-design": [
    "Art, Art History, and Design",
    "Design",
    "Bachelor of Design",
  ],
  "uw-bothell-gender-women-and-sexuality-studies": [
    "Gender, Women, & Sexuality Studies",
    "Interdisciplinary Practices & Reflection",
  ],
  "uw-seattle-gender-women-and-sexuality-studies": [
    "Gender, Women, and Sexuality Studies",
    "Bachelor of Arts",
    "50 credits",
  ],
  "uw-bothell-global-studies": [
    "Global Studies",
    "Interdisciplinary Practice & Reflection",
  ],
  "uw-bothell-interactive-media-design": [
    "Interactive Media Design",
    "BIMD 233",
    "BIMD 250",
    "Writing Requirement",
  ],
  "uw-bothell-interdisciplinary-arts": [
    "Interdisciplinary Arts",
    "Interdisciplinary Practice & Reflection",
  ],
  "uw-bothell-interdisciplinary-studies-individualized-study": [
    "Interdisciplinary Social Sciences",
    "Degree Requirements",
    "ISS Research Courses",
    "BIS 312",
  ],
  "uw-seattle-individualized-studies": [
    "Individualized Studies",
    "General Studies",
    "Bachelor of Arts",
  ],
  "uw-bothell-science-technology-and-society": [
    "Science, Technology & Society",
    "Interdisciplinary Practice & Reflection",
  ],
  "uw-bothell-society-ethics-and-human-behavior": [
    "Society, Ethics & Human Behavior",
    "Degree requirements",
  ],
  "uw-bothell-chemistry-biochemistry": [
    "B.S. in Chemistry (biochemistry option)",
    "General education requirements",
    "This option also requires a lot of time-consuming lab work",
  ],
  "uw-seattle-biochemistry": [
    "Biochemistry",
    "Science Electives",
    "Physics lab",
  ],
};

const titleByPlanId = {
  "uw-bothell-interdisciplinary-studies-individualized-study":
    "Interdisciplinary Social Sciences (BA)",
};

const publicAdmissionsLabelsByPlanId = {
  "uw-bothell-interdisciplinary-studies-individualized-study": [
    "Interdisciplinary Social Sciences",
    "Interdisciplinary Studies: Individualized Study",
  ],
};

const targetPlanIds = Array.from(
  new Set(equivalentMajorGroups.flatMap((group) => group.planIds))
);

const remainingBothellPrograms = targetPlanIds.map((planId) => ({
  planId,
  title: titleByPlanId[planId],
  officialSources: sourceByPlanId[planId] || [],
  expectedPathwayIds: expectedPathwaysByPlanId[planId] || [],
  publicAdmissionsLabels: publicAdmissionsLabelsByPlanId[planId] || [],
  requiredTextSnippets: requiredTextByPlanId[planId] || [],
}));

module.exports = {
  bothellRemainingPlanIds,
  equivalentMajorGroups,
  remainingBothellPrograms,
};
