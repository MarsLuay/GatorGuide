const seattleRemainingPlanIds = [
  "uw-seattle-aeronautics-astronautics",
  "uw-seattle-anthropology",
  "uw-seattle-aquatic-conservation-and-ecology",
  "uw-seattle-architectural-design",
  "uw-seattle-architectural-studies",
  "uw-seattle-art",
  "uw-seattle-art-history",
  "uw-seattle-asian-languages-and-cultures",
  "uw-seattle-asian-studies",
  "uw-seattle-atmospheric-and-climate-science",
  "uw-seattle-bioengineering",
  "uw-seattle-chemical-engineering",
  "uw-seattle-chinese",
  "uw-seattle-classical-studies",
  "uw-seattle-classics",
  "uw-seattle-comparative-history-of-ideas",
  "uw-seattle-comparative-religion",
  "uw-seattle-computational-finance-and-risk-management",
  "uw-seattle-construction-management",
  "uw-seattle-dance",
  "uw-seattle-danish",
  "uw-seattle-disability-studies",
  "uw-seattle-drama",
  "uw-seattle-earth-and-space-sciences",
  "uw-seattle-european-studies",
  "uw-seattle-finnish",
  "uw-seattle-food-systems-nutrition-and-health",
  "uw-seattle-french",
  "uw-seattle-geography",
  "uw-seattle-german",
  "uw-seattle-global-literary-studies",
  "uw-seattle-greek",
  "uw-seattle-guitar-b-m",
  "uw-seattle-human-centered-design-engineering",
  "uw-seattle-industrial-systems-engineering",
  "uw-seattle-italian",
  "uw-seattle-japanese",
  "uw-seattle-jazz-studies-b-m",
  "uw-seattle-jewish-studies",
  "uw-seattle-korean",
  "uw-seattle-latin",
  "uw-seattle-latin-american-and-caribbean-studies",
  "uw-seattle-linguistics",
  "uw-seattle-materials-science-engineering",
  "uw-seattle-middle-eastern-languages-and-cultures",
  "uw-seattle-music-b-a",
  "uw-seattle-music-composition-b-m",
  "uw-seattle-music-education-b-m",
  "uw-seattle-norwegian",
  "uw-seattle-oceanography",
  "uw-seattle-orchestral-instruments-b-m",
  "uw-seattle-organ-b-m",
  "uw-seattle-percussion-performance-b-m",
  "uw-seattle-philosophy",
  "uw-seattle-piano-b-m",
  "uw-seattle-real-estate",
  "uw-seattle-slavic-languages-and-literatures",
  "uw-seattle-sociology",
  "uw-seattle-south-asian-languages-and-cultures",
  "uw-seattle-speech-and-hearing-sciences",
  "uw-seattle-statistics",
  "uw-seattle-swedish",
  "uw-seattle-voice-b-m",
];

const equivalentMajorGroups = [
  {
    id: "visual-arts-design-and-built-environment",
    label: "Visual arts, design, architecture, and built environment",
    planIds: [
      "uw-seattle-architectural-design",
      "uw-seattle-architectural-studies",
      "uw-seattle-art",
      "uw-seattle-art-history",
      "uw-seattle-construction-management",
      "uw-seattle-real-estate",
      "uw-bothell-culture-literature-and-the-arts",
      "uw-bothell-data-visualization-ba",
      "uw-bothell-data-visualization-bs",
      "uw-bothell-interactive-media-design",
      "uw-bothell-interdisciplinary-arts",
      "uw-tacoma-arts-media-culture",
      "uw-tacoma-urban-design",
      "uw-tacoma-urban-studies",
    ],
  },
  {
    id: "earth-ocean-atmosphere-and-environment",
    label: "Earth, ocean, atmosphere, conservation, and environmental science",
    planIds: [
      "uw-seattle-aquatic-conservation-and-ecology",
      "uw-seattle-atmospheric-and-climate-science",
      "uw-seattle-earth-and-space-sciences",
      "uw-seattle-oceanography",
      "uw-bothell-conservation-and-restoration-science",
      "uw-bothell-earth-system-science",
      "uw-bothell-environmental-studies",
      "uw-tacoma-environmental-science",
      "uw-tacoma-environmental-sustainability",
    ],
  },
  {
    id: "engineering-remaining",
    label: "Remaining Seattle engineering disciplines",
    planIds: [
      "uw-seattle-aeronautics-astronautics",
      "uw-seattle-bioengineering",
      "uw-seattle-chemical-engineering",
      "uw-seattle-human-centered-design-engineering",
      "uw-seattle-industrial-systems-engineering",
      "uw-seattle-materials-science-engineering",
      "uw-bothell-computer-engineering",
      "uw-bothell-electrical-engineering",
      "uw-bothell-mechanical-engineering",
      "uw-tacoma-civil-engineering",
      "uw-tacoma-computer-engineering",
      "uw-tacoma-electrical-engineering",
      "uw-tacoma-mechanical-engineering",
    ],
  },
  {
    id: "languages-literatures-and-area-studies",
    label: "Languages, literatures, and area studies",
    planIds: [
      "uw-seattle-asian-languages-and-cultures",
      "uw-seattle-asian-studies",
      "uw-seattle-chinese",
      "uw-seattle-classical-studies",
      "uw-seattle-classics",
      "uw-seattle-comparative-religion",
      "uw-seattle-danish",
      "uw-seattle-european-studies",
      "uw-seattle-finnish",
      "uw-seattle-french",
      "uw-seattle-german",
      "uw-seattle-global-literary-studies",
      "uw-seattle-greek",
      "uw-seattle-italian",
      "uw-seattle-japanese",
      "uw-seattle-jewish-studies",
      "uw-seattle-korean",
      "uw-seattle-latin",
      "uw-seattle-latin-american-and-caribbean-studies",
      "uw-seattle-middle-eastern-languages-and-cultures",
      "uw-seattle-norwegian",
      "uw-seattle-slavic-languages-and-literatures",
      "uw-seattle-south-asian-languages-and-cultures",
      "uw-seattle-swedish",
      "uw-bothell-global-studies",
      "uw-tacoma-spanish-language-and-cultures",
      "uw-tacoma-writing-studies",
    ],
  },
  {
    id: "performing-arts-and-music",
    label: "Performing arts and music",
    planIds: [
      "uw-seattle-dance",
      "uw-seattle-drama",
      "uw-seattle-guitar-b-m",
      "uw-seattle-jazz-studies-b-m",
      "uw-seattle-music-b-a",
      "uw-seattle-music-composition-b-m",
      "uw-seattle-music-education-b-m",
      "uw-seattle-orchestral-instruments-b-m",
      "uw-seattle-organ-b-m",
      "uw-seattle-percussion-performance-b-m",
      "uw-seattle-piano-b-m",
      "uw-seattle-voice-b-m",
      "uw-tacoma-arts-media-culture",
    ],
  },
  {
    id: "social-science-humanities-and-health",
    label: "Remaining social science, humanities, and health-adjacent fields",
    planIds: [
      "uw-seattle-anthropology",
      "uw-seattle-comparative-history-of-ideas",
      "uw-seattle-computational-finance-and-risk-management",
      "uw-seattle-disability-studies",
      "uw-seattle-food-systems-nutrition-and-health",
      "uw-seattle-geography",
      "uw-seattle-linguistics",
      "uw-seattle-philosophy",
      "uw-seattle-sociology",
      "uw-seattle-speech-and-hearing-sciences",
      "uw-seattle-statistics",
      "uw-bothell-health-studies",
      "uw-bothell-law-economics-and-public-policy",
      "uw-bothell-society-ethics-and-human-behavior",
      "uw-tacoma-healthcare-leadership",
      "uw-tacoma-politics-philosophy-and-economics",
      "uw-tacoma-social-welfare",
    ],
  },
];

const sourceByPlanId = {
  "uw-seattle-aeronautics-astronautics": [
    "https://www.aa.washington.edu/students/academics/bsaae",
  ],
  "uw-seattle-anthropology": [
    "https://www.washington.edu/students/gencat/program/S/Anthropology-102.html",
  ],
  "uw-seattle-aquatic-conservation-and-ecology": [
    "https://fish.uw.edu/students/undergraduate-program/bachelor-of-science/major-requirements/",
  ],
  "uw-seattle-architectural-design": [
    "https://arch.be.uw.edu/wp-content/uploads/sites/5/2024/03/BA-Arch-Design_2024_.pdf",
  ],
  "uw-seattle-architectural-studies": [
    "https://arch.be.uw.edu/wp-content/uploads/sites/5/2024/01/BA-Arch-Studies_20240124.pdf",
  ],
  "uw-seattle-art": [
    "https://www.washington.edu/students/gencat/program/S/Art+ArtHistory+Design-105.html",
  ],
  "uw-seattle-art-history": [
    "https://www.washington.edu/students/gencat/program/S/Art+ArtHistory+Design-105.html",
  ],
  "uw-seattle-asian-languages-and-cultures": [
    "https://asian.washington.edu/ba-asian-languages-cultures",
  ],
  "uw-seattle-asian-studies": [
    "https://jsis.washington.edu/programs/undergraduate/asia-studies/",
    "https://jsis.washington.edu/programs/undergraduate/asia-studies/south-asia-studies",
    "https://jsis.washington.edu/wordpress/wp-content/uploads/2019/06/Asian-Studies-Courses-Autumn-2019rev.pdf",
  ],
  "uw-seattle-atmospheric-and-climate-science": [
    "https://www.washington.edu/students/gencat/program/S/AtmosphericandClimateScience-1067.html",
    "https://www.washington.edu/students/gencat/program/S/AtmosphericandClimateScience-1067.html#credential-66eb4e06c6df17f51df9a3ee",
    "https://www.washington.edu/students/gencat/program/S/AtmosphericandClimateScience-1067.html#credential-66eb50075e15782e7ae20feb",
    "https://www.washington.edu/students/gencat/program/S/AtmosphericandClimateScience-1067.html#program-UG-ATMOS-MAJOR",
  ],
  "uw-seattle-bioengineering": [
    "https://bioe.uw.edu/academic-programs/undergraduate/undergraduate-degree-requirements/",
  ],
  "uw-seattle-chemical-engineering": [
    "https://www.cheme.washington.edu/undergraduate_students/curriculum",
    "https://www.cheme.washington.edu/undergraduate_students/curriculum/NME.html",
  ],
  "uw-seattle-chinese": [
    "https://asian.washington.edu/ba-chinese",
  ],
  "uw-seattle-classical-studies": [
    "https://classics.washington.edu/ba-classical-studies",
  ],
  "uw-seattle-classics": [
    "https://classics.washington.edu/ba-classics",
  ],
  "uw-seattle-comparative-history-of-ideas": [
    "https://www.washington.edu/students/gencat/program/S/ComparativeHistoryofIdeas-202.html",
  ],
  "uw-seattle-comparative-religion": [
    "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html",
  ],
  "uw-seattle-computational-finance-and-risk-management": [
    "https://www.washington.edu/students/gencat/program/S/AppliedMathematics-208.html",
  ],
  "uw-seattle-construction-management": [
    "https://www.washington.edu/students/gencat/program/S/ConstructionManagement-52.html",
    "https://www.washington.edu/students/gencat/program/S/ConstructionManagement-52.html#credential-67a54f6ddb9f54dbcb074751",
  ],
  "uw-seattle-dance": [
    "https://www.washington.edu/students/gencat/program/S/Dance-133.html",
    "https://www.washington.edu/students/gencat/program/S/Dance-133.html#credential-60b927e9bcc770338fb5ecab",
  ],
  "uw-seattle-danish": [
    "https://scandinavian.washington.edu/ba-danish",
  ],
  "uw-seattle-disability-studies": [
    "https://disabilitystudies.washington.edu/DS_major",
  ],
  "uw-seattle-drama": [
    "https://www.washington.edu/students/gencat/program/S/Drama-134.html",
  ],
  "uw-seattle-earth-and-space-sciences": [
    "https://www.washington.edu/students/gencat/program/S/EarthandSpaceSciences-1068.html",
  ],
  "uw-seattle-european-studies": [
    "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html",
  ],
  "uw-seattle-finnish": [
    "https://scandinavian.washington.edu/ba-finnish",
  ],
  "uw-seattle-food-systems-nutrition-and-health": [
    "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
    "https://foodsystems.uw.edu/undergraduate/foodsystems/requirements/",
  ],
  "uw-seattle-french": [
    "https://frenchitalian.washington.edu/major-french-studies",
  ],
  "uw-seattle-geography": [
    "https://geography.washington.edu/ba-geography",
    "https://geography.washington.edu/ba-geography-data-science-option",
    "https://geography.washington.edu/courses-track",
  ],
  "uw-seattle-german": [
    "https://german.washington.edu/german-studies",
  ],
  "uw-seattle-global-literary-studies": [
    "https://slavic.washington.edu/ba-global-literary-studies-glits",
  ],
  "uw-seattle-greek": [
    "https://classics.washington.edu/ba-greek",
  ],
  "uw-seattle-guitar-b-m": [
    "https://music.washington.edu/bachelor-music-guitar",
  ],
  "uw-seattle-human-centered-design-engineering": [
    "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
    "https://www.hcde.washington.edu/bs/requirements",
    "https://www.hcde.washington.edu/bs/requirements/2024",
  ],
  "uw-seattle-industrial-systems-engineering": [
    "https://ise.washington.edu/files/BSIE%20Graduation%20Requirements.pdf",
  ],
  "uw-seattle-italian": [
    "https://frenchitalian.washington.edu/undergraduate-studies-italian",
  ],
  "uw-seattle-japanese": [
    "https://asian.washington.edu/ba-japanese",
  ],
  "uw-seattle-jazz-studies-b-m": [
    "https://music.washington.edu/bachelor-music-jazz-studies",
  ],
  "uw-seattle-jewish-studies": [
    "https://jsis.washington.edu/programs/undergraduate/jewish-studies/",
  ],
  "uw-seattle-korean": [
    "https://asian.washington.edu/ba-korean",
  ],
  "uw-seattle-latin": [
    "https://classics.washington.edu/ba-latin",
  ],
  "uw-seattle-latin-american-and-caribbean-studies": [
    "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
    "https://jsis.washington.edu/programs/undergraduate/latin-america-and-caribbean-studies/",
  ],
  "uw-seattle-linguistics": [
    "https://linguistics.washington.edu/ba-linguistics",
  ],
  "uw-seattle-materials-science-engineering": [
    "https://mse.washington.edu/current/undergrad/courses",
  ],
  "uw-seattle-middle-eastern-languages-and-cultures": [
    "https://www.washington.edu/students/gencat/program/S/MiddleEasternLanguagesandCultures-123.html",
  ],
  "uw-seattle-music-b-a": [
    "https://music.washington.edu/bachelor-arts-music-instrumental-option",
    "https://music.washington.edu/bachelor-arts-music-music-theory-option",
    "https://music.washington.edu/bachelor-arts-music-voice-option",
    "https://music.washington.edu/sites/music/files/documents/sample_ba_inst.pdf",
  ],
  "uw-seattle-music-composition-b-m": [
    "https://music.washington.edu/bachelor-music-composition",
  ],
  "uw-seattle-music-education-b-m": [
    "https://music.washington.edu/bachelor-music-music-education-instrumental-emphasis",
  ],
  "uw-seattle-norwegian": [
    "https://scandinavian.washington.edu/ba-norwegian",
  ],
  "uw-seattle-oceanography": [
    "https://www.ocean.washington.edu/files/checklist8ba-20190829030144.pdf",
  ],
  "uw-seattle-orchestral-instruments-b-m": [
    "https://music.washington.edu/bachelor-music-orchestral-instruments",
  ],
  "uw-seattle-organ-b-m": [
    "https://music.washington.edu/bachelor-music-organ",
  ],
  "uw-seattle-percussion-performance-b-m": [
    "https://music.washington.edu/bachelor-music-percussion-performance",
  ],
  "uw-seattle-philosophy": [
    "https://www.washington.edu/students/gencat/program/S/Philosophy-221.html",
  ],
  "uw-seattle-piano-b-m": [
    "https://music.washington.edu/bachelor-music-piano",
  ],
  "uw-seattle-real-estate": [
    "https://www.washington.edu/students/gencat/program/S/RealEstate-54.html",
  ],
  "uw-seattle-slavic-languages-and-literatures": [
    "https://slavic.washington.edu/undergraduate-programs",
  ],
  "uw-seattle-sociology": [
    "https://www.washington.edu/students/gencat/program/S/Sociology-293.html",
  ],
  "uw-seattle-south-asian-languages-and-cultures": [
    "https://asian.washington.edu/ba-south-asian-languages-and-cultures",
  ],
  "uw-seattle-speech-and-hearing-sciences": [
    "https://www.washington.edu/students/gencat/program/S/SpeechandHearingSciences-296.html",
  ],
  "uw-seattle-statistics": [
    "https://stat.uw.edu/academics/undergraduate/statistics-bs/double-major-and-double-degree",
    "https://stat.uw.edu/academics/undergraduate/statistics-bs/major",
  ],
  "uw-seattle-swedish": [
    "https://scandinavian.washington.edu/ba-swedish",
  ],
  "uw-seattle-voice-b-m": [
    "https://music.washington.edu/bachelor-music-voice",
  ],
};

const expectedPathwaysByPlanId = {
  "uw-seattle-anthropology": [
    "ba-option-family:anthropology-of-globalization",
    "ba-option-family:archaeological-sciences",
    "ba-option-family:human-evolutionary-biology",
    "ba-option-family:indigenous-archaeology",
    "ba-option-family:medical-anthropology-and-global-health",
  ],
  "uw-seattle-aquatic-conservation-and-ecology": ["practicum-option"],
  "uw-seattle-architectural-studies": ["ba-route"],
  "uw-seattle-asian-studies": [
    "china-concentration",
    "general-concentration",
    "japan-concentration",
    "korea-concentration",
    "south-asia-concentration",
    "southeast-asia-concentration",
  ],
  "uw-seattle-atmospheric-and-climate-science": [
    "bs-option-family:chemistry",
    "bs-option-family:climate",
    "bs-option-family:data-science",
    "bs-option-family:meteorology",
  ],
  "uw-seattle-bioengineering": ["data-science-option", "nme-option"],
  "uw-seattle-chemical-engineering": ["nme-option"],
  "uw-seattle-comparative-history-of-ideas": [
    "chid-study-abroad-program-option",
    "encounters-across-cultures-option",
    "local-global-engagements-option",
  ],
  "uw-seattle-comparative-religion": [
    "history-of-religions-eastern-emphasis-track",
    "history-of-religions-western-emphasis-track",
    "religion-and-society-track",
    "religion-and-symbolic-expression-track",
  ],
  "uw-seattle-construction-management": [
    "early-admission-pathway",
    "freshmen-direct-pathway",
    "upper-division-admission-pathway",
  ],
  "uw-seattle-earth-and-space-sciences": ["bs-option-family:geoscience"],
  "uw-seattle-french": ["ba-route"],
  "uw-seattle-geography": [
    "ba-option-family:data-science",
    "ba-option-family:data-science-option-sample-course-plan",
    "ba-option-family:in-geography-with-data-science",
    "ccm-track",
    "citizenship-and-migration-track",
    "economy-and-sustainability-track",
    "geography-major-data-science-option",
    "mapping-and-society-track",
  ],
  "uw-seattle-german": ["ba-option-family:cultural-studies", "ba-route"],
  "uw-seattle-materials-science-engineering": ["nme-option"],
  "uw-seattle-middle-eastern-languages-and-cultures": [
    "ba-option-family:biblical-and-ancient-near-eastern-studies",
    "ba-option-family:comparative-cultures",
    "ba-option-family:languages-and-literatures",
  ],
  "uw-seattle-music-b-a": ["music-theory-option", "voice-option"],
  "uw-seattle-slavic-languages-and-literatures": [
    "eastern-european-languages-literature-and-culture",
  ],
  "uw-seattle-statistics": ["applied-statistics-track", "mathematical-statistics-track"],
};

const seattleGenEdSnippets = [
  "General Education",
  "English Composition",
  "Additional Writing",
  "Reasoning",
  "Areas of Inquiry",
  "Arts and Humanities",
  "Social Sciences",
  "Natural Sciences",
  "Diversity",
];

const seattleRemainingPrograms = seattleRemainingPlanIds.map((planId) => ({
  planId,
  officialSources: sourceByPlanId[planId] || [],
  expectedPathwayIds: expectedPathwaysByPlanId[planId] || [],
  genEdSnippets: seattleGenEdSnippets,
}));

module.exports = {
  equivalentMajorGroups,
  seattleGenEdSnippets,
  seattleRemainingPlanIds,
  seattleRemainingPrograms,
};
