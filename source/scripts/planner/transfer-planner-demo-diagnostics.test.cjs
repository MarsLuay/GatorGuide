const assert = require("node:assert/strict");
const test = require("node:test");

const demoPayload = require("../../constants/transfer-planner-source/demo/complete-diagnostics.generated.json");
const {
  array,
  createSourceTextFetcher,
  escapeRegExp,
  getExpectedCourseCodesFromProgram,
  getPlanner,
  isExtractableSource,
  loadCompleteDiagnosticPrograms,
  loadCurrentBootstrapPlans,
  uniqueSorted,
} = require("./lib/test-harness.cjs");

const CURRENT_SEATTLE_PLAN_IDS = loadCurrentBootstrapPlans({
  campuses: new Set(["uw-seattle"]),
}).map((plan) => plan.id);
const CURRENT_TACOMA_PLAN_IDS = loadCurrentBootstrapPlans({
  campuses: new Set(["uw-tacoma"]),
}).map((plan) => plan.id);
const CURRENT_BOTHELL_PLAN_IDS = loadCurrentBootstrapPlans({
  campuses: new Set(["uw-bothell"]),
}).map((plan) => plan.id);
const RUN_DEMO_ONLINE_DIAGNOSTICS =
  process.env.TRANSFER_PLANNER_DEMO_DIAGNOSTICS_ONLINE === "1";
const onlineDiagnosticTest = RUN_DEMO_ONLINE_DIAGNOSTICS ? test : test.skip;
const NON_MAJOR_UW_DEMO_SOURCE_PATTERN =
  /admit\.washington\.edu\/apply\/transfer\/equivalency-guide\/green-river/i;
const STALE_BOTHELL_MECHANICAL_ENGINEERING_SOURCE_URL =
  "https://www.uwb.edu/stem/undergraduate/majors/mechanical-engineering";
const AUDITED_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE = [
  {
    planId: "uw-seattle-aeronautics-astronautics",
    sourceUrl: "https://www.aa.washington.edu/students/academics/bsaae",
    evidenceCourseCodes: ["AA 210", "AA 301", "AMATH 301"],
  },
  {
    planId: "uw-seattle-american-ethnic-studies",
    sourceUrl: "https://aes.washington.edu/ba-american-ethnic-studies",
    evidenceCourseCodes: ["AAS 101", "AAS 206", "AAS 220"],
  },
  {
    planId: "uw-seattle-american-indian-studies",
    sourceUrl: "https://ais.washington.edu/ba-american-indian-studies",
    evidenceCourseCodes: ["AIS 102", "AIS 103", "AIS 170"],
  },
  {
    planId: "uw-seattle-anthropology",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/Anthropology-102.html",
    evidenceCourseCodes: ["AIS 102", "AIS 202", "AIS 203"],
  },
  {
    planId: "uw-seattle-applied-and-computational-mathematical-sciences",
    sourceUrl: "https://acms.washington.edu/data-sciences-and-statistics",
    evidenceCourseCodes: ["AMATH 301", "AMATH 481", "AMATH 482"],
  },
  {
    planId: "uw-seattle-applied-mathematics",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/AppliedMathematics-208.html",
    evidenceCourseCodes: ["AMATH 301", "AMATH 342", "AMATH 351"],
  },
  {
    planId: "uw-seattle-aquatic-conservation-and-ecology",
    sourceUrl: "https://fish.uw.edu/students/undergraduate-program/bachelor-of-science/major-requirements/",
    evidenceCourseCodes: ["ANTH 210", "ATMOS 211", "BIOL 180"],
  },
  {
    planId: "uw-seattle-art",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/Art+ArtHistory+Design-105.html",
    evidenceCourseCodes: ["ART 101", "ART 140", "ART 190"],
  },
  {
    planId: "uw-seattle-art-history",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/Art+ArtHistory+Design-105.html",
    evidenceCourseCodes: ["ARTH 200", "ARTH 201", "ARTH 202"],
  },
  {
    planId: "uw-seattle-asian-languages-and-cultures",
    sourceUrl: "https://asian.washington.edu/ba-asian-languages-cultures",
    evidenceCourseCodes: ["ASIAN 204", "ASIAN 205", "ASIAN 207"],
  },
  {
    planId: "uw-seattle-asian-studies",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html",
    evidenceCourseCodes: ["HSTAS 201", "HSTAS 202", "HSTAS 211"],
  },
  {
    planId: "uw-seattle-astronomy",
    sourceUrl: "https://astro.washington.edu/undergraduate-program",
    evidenceCourseCodes: ["ASTR 300", "ASTR 480", "ASTR 481"],
  },
  {
    planId: "uw-seattle-atmospheric-and-climate-science",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/AtmosphericandClimateScience-1067.html",
    evidenceCourseCodes: ["ATMOS 220", "MATH 124", "PHYS 121"],
  },
  {
    planId: "uw-seattle-bioengineering",
    sourceUrl: "https://bioe.uw.edu/academic-programs/undergraduate/undergraduate-degree-requirements/",
    evidenceCourseCodes: ["AMATH 301", "AMATH 351", "AMATH 352"],
  },
  {
    planId: "uw-seattle-biology",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/Biology-112.html",
    evidenceCourseCodes: ["BIOL 180", "BIOL 200", "BIOL 220"],
  },
  {
    planId: "uw-seattle-business-administration",
    sourceUrl: "https://foster.uw.edu/academics/degree-programs/undergraduate-programs/curriculum/",
    evidenceCourseCodes: ["ACCTG 215", "ACCTG 225", "ECON 200"],
  },
  {
    planId: "uw-seattle-chemical-engineering",
    sourceUrl: "https://www.cheme.washington.edu/undergraduate_students/curriculum",
    evidenceCourseCodes: ["AMATH 351", "AMATH 352", "AMATH 353"],
  },
  {
    planId: "uw-seattle-chemistry",
    sourceUrl: "https://chem.washington.edu/ba-chemistry",
    evidenceCourseCodes: ["CHEM 142", "CHEM 143", "CHEM 145"],
  },
  {
    planId: "uw-seattle-chinese",
    sourceUrl: "https://asian.washington.edu/ba-chinese",
    evidenceCourseCodes: ["ASIAN 201", "ASIAN 204", "ASIAN 207"],
  },
  {
    planId: "uw-seattle-cinema-and-media-studies",
    sourceUrl: "https://cinema.washington.edu/ba-cinema-media-studies",
    evidenceCourseCodes: ["CMS 270", "CMS 301", "CMS 302"],
  },
  {
    planId: "uw-seattle-classical-studies",
    sourceUrl: "https://classics.washington.edu/ba-classical-studies",
    evidenceCourseCodes: ["CLAS 495"],
  },
  {
    planId: "uw-seattle-classics",
    sourceUrl: "https://classics.washington.edu/ba-classics",
    evidenceCourseCodes: ["CLAS 495", "GREEK 300", "GREEK 301"],
  },
  {
    planId: "uw-seattle-communication",
    sourceUrl: "https://com.uw.edu/undergraduate/communication-major/affiliated-courses/",
    evidenceCourseCodes: ["AAS 220", "ANTH 203", "ANTH 209"],
  },
  {
    planId: "uw-seattle-community-environment-and-planning",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/UrbanDesignandPlanning-50.html",
    evidenceCourseCodes: ["CEP 300", "CEP 301", "CEP 302"],
  },
  {
    planId: "uw-seattle-comparative-history-of-ideas",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/ComparativeHistoryofIdeas-202.html",
    evidenceCourseCodes: ["CHID 101", "CHID 390", "CHID 491"],
  },
  {
    planId: "uw-seattle-comparative-literature",
    sourceUrl: "https://cinema.washington.edu/ba-comparative-literature",
    evidenceCourseCodes: ["CLIT 250", "CLIT 320", "CLIT 321"],
  },
  {
    planId: "uw-seattle-comparative-religion",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html",
    evidenceCourseCodes: ["JSIS 202", "RELIG 201", "RELIG 202"],
  },
  {
    planId: "uw-seattle-computational-finance-and-risk-management",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/AppliedMathematics-208.html",
    evidenceCourseCodes: ["AMATH 301", "AMATH 351", "AMATH 352"],
  },
  {
    planId: "uw-seattle-computer-engineering",
    sourceUrl: "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/capstones/",
    evidenceCourseCodes: ["CSE 312", "CSE 331", "CSE 332"],
  },
  {
    planId: "uw-seattle-computer-science",
    sourceUrl: "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/",
    evidenceCourseCodes: ["CSE 122", "CSE 123", "CSE 143"],
  },
  {
    planId: "uw-seattle-construction-management",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/ConstructionManagement-52.html",
    evidenceCourseCodes: ["ACCTG 215", "ACCTG 219", "ARCH 320"],
  },
  {
    planId: "uw-seattle-dance",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/Dance-133.html",
    evidenceCourseCodes: ["DANCE 150", "DANCE 166", "DANCE 242"],
  },
  {
    planId: "uw-seattle-danish",
    sourceUrl: "https://scandinavian.washington.edu/ba-danish",
    evidenceCourseCodes: ["DANISH 101", "DANISH 310", "DANISH 311"],
  },
  {
    planId: "uw-seattle-design",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/Art+ArtHistory+Design-105.html",
    evidenceCourseCodes: ["DESIGN 166", "DESIGN 206", "DESIGN 207"],
  },
  {
    planId: "uw-seattle-disability-studies",
    sourceUrl: "https://disabilitystudies.washington.edu/DS_major",
    evidenceCourseCodes: ["ANTH 303", "ANTH 305", "ANTH 322"],
  },
  {
    planId: "uw-seattle-drama",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/Drama-134.html",
    evidenceCourseCodes: ["DRAMA 201", "DRAMA 221", "DRAMA 222"],
  },
  {
    planId: "uw-seattle-early-childhood-and-family-studies",
    sourceUrl: "https://education.washington.edu/academics/program/early-childhood-family-studies",
    evidenceCourseCodes: ["ECFS 200", "ECFS 301", "ECFS 303"],
  },
  {
    planId: "uw-seattle-earth-and-space-sciences",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/EarthandSpaceSciences-1068.html",
    evidenceCourseCodes: ["AMATH 351", "BIOL 180", "BIOL 200"],
  },
  {
    planId: "uw-seattle-economics",
    sourceUrl: "https://econ.washington.edu/bachelor-science",
    evidenceCourseCodes: ["ECON 200", "ECON 201", "ECON 300"],
  },
  {
    planId: "uw-seattle-education-communities-and-organizations",
    sourceUrl: "https://education.washington.edu/academics/program/eco",
    evidenceCourseCodes: ["EDPSY 302", "EDUC 251", "EDUC 280"],
  },
  {
    planId: "uw-seattle-education-studies",
    sourceUrl: "https://education.washington.edu/academics/program/ba-education-studies",
    evidenceCourseCodes: ["ECFS 200", "ECFS 303", "ECFS 320"],
  },
  {
    planId: "uw-seattle-electrical-computer-engineering",
    sourceUrl: "https://www.ece.uw.edu/academics/bachelor-of-science/bsece/degree-requirements/",
    evidenceCourseCodes: ["AMATH 351", "AMATH 352", "BIOL 130"],
  },
  {
    planId: "uw-seattle-english-creative-writing",
    sourceUrl: "https://english.washington.edu/english-major-creative-writing-option",
    evidenceCourseCodes: ["ENGL 202", "ENGL 207", "ENGL 208"],
  },
  {
    planId: "uw-seattle-english-language-literature-and-culture",
    sourceUrl: "https://english.washington.edu/english-language-literature-and-culture-option",
    evidenceCourseCodes: ["ENGL 200", "ENGL 202", "ENGL 204"],
  },
  {
    planId: "uw-seattle-environmental-design-and-sustainability",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/LandscapeArchitecture-53.html",
    evidenceCourseCodes: ["LARCH 210", "LARCH 211", "LARCH 212"],
  },
  {
    planId: "uw-seattle-environmental-public-health",
    sourceUrl: "https://www.deohs.washington.edu/degree-requirements",
    evidenceCourseCodes: ["BIOL 180", "BIOST 310", "CHEM 142"],
  },
  {
    planId: "uw-seattle-environmental-science-and-terrestrial-resource-management",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/SchoolofEnvironmentalandForestScience-1069.html",
    evidenceCourseCodes: ["ANTH 233", "ATMOS 211", "BIOL 161"],
  },
  {
    planId: "uw-seattle-environmental-studies",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/ProgramontheEnvironment-1070.html",
    evidenceCourseCodes: ["AES 211", "AIS 380", "AIS 385"],
  },
  {
    planId: "uw-seattle-finnish",
    sourceUrl: "https://scandinavian.washington.edu/ba-finnish",
    evidenceCourseCodes: ["FINN 101", "FINN 310", "FINN 395"],
  },
  {
    planId: "uw-seattle-food-systems-nutrition-and-health",
    sourceUrl: "https://foodsystems.uw.edu/undergraduate/foodsystems/requirements/",
    evidenceCourseCodes: ["ACCTG 219", "AES 150", "AES 151"],
  },
  {
    planId: "uw-seattle-french",
    sourceUrl: "https://frenchitalian.washington.edu/major-french-studies",
    evidenceCourseCodes: ["FRENCH 203", "FRENCH 211", "FRENCH 212"],
  },
  {
    planId: "uw-seattle-gender-women-and-sexuality-studies",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/Gender%2CWomen%2CandSexualityStudies-298.html",
    evidenceCourseCodes: ["GWSS 200", "GWSS 302", "GWSS 494"],
  },
  {
    planId: "uw-seattle-geography",
    sourceUrl: "https://geography.washington.edu/ba-geography",
    evidenceCourseCodes: ["GEOG 317", "GEOG 496", "GEOG 499"],
  },
  {
    planId: "uw-seattle-german",
    sourceUrl: "https://german.washington.edu/german-studies",
    evidenceCourseCodes: ["GERMAN 203", "GERMAN 301", "GERMAN 311"],
  },
  {
    planId: "uw-seattle-global-literary-studies",
    sourceUrl: "https://slavic.washington.edu/ba-global-literary-studies-glits",
    evidenceCourseCodes: ["GLITS 251", "GLITS 252", "GLITS 253"],
  },
  {
    planId: "uw-seattle-greek",
    sourceUrl: "https://classics.washington.edu/ba-greek",
    evidenceCourseCodes: ["CLAS 495", "GREEK 101", "GREEK 102"],
  },
  {
    planId: "uw-seattle-guitar-b-m",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/Music-217.html",
    evidenceCourseCodes: ["MUSIC 113", "MUSIC 119", "MUSIC 120"],
  },
  {
    planId: "uw-seattle-history",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/History-193.html",
    evidenceCourseCodes: ["HSTRY 388", "HSTRY 494", "HSTRY 498"],
  },
  {
    planId: "uw-seattle-history-and-philosophy-of-science",
    sourceUrl: "https://www.washington.edu/students/gencat/program/S/Philosophy-221.html",
    evidenceCourseCodes: ["ASTR 313", "ESS 404", "ETHICS 495"],
  },
  {
    planId: "uw-seattle-human-centered-design-engineering",
    sourceUrl: "https://www.hcde.washington.edu/bs/requirements/2024",
    evidenceCourseCodes: ["CSE 121", "CSE 122", "CSE 123"],
  },
];
const AUDITED_SEATTLE_30_INDIVIDUAL_ONLINE_SOURCE_SAMPLE =
  AUDITED_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE.slice(0, 30);
const AUDITED_SEATTLE_SECOND_30_INDIVIDUAL_ONLINE_SOURCE_SAMPLE =
  AUDITED_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE.slice(30, 60);

const AUDITED_REMAINING_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE = [
  { planId: "uw-seattle-architectural-design", sourceUrl: "https://arch.be.uw.edu/wp-content/uploads/sites/5/2024/03/BA-Arch-Design_2024_.pdf", evidenceCourseCodes: ["ARCH 150", "ARCH 200", "ARCH 201"] },
  { planId: "uw-seattle-architectural-studies", sourceUrl: "https://arch.be.uw.edu/wp-content/uploads/sites/5/2024/01/BA-Arch-Studies_20240124.pdf", evidenceCourseCodes: ["ARCH 200", "ARCH 231", "ARCH 332"] },
  { planId: "uw-seattle-biochemistry", sourceUrl: "https://chem.washington.edu/sites/chem/files/documents/undergrad/babioccheck2017_001.pdf", evidenceCourseCodes: ["AMATH 351", "ATM S 358", "BIOL 220"] },
  { planId: "uw-seattle-civil-engineering", sourceUrl: "https://www.ce.washington.edu/sites/default/files/pdfs/current/undergrad/uw-cee-bsce-degree-sheet.pdf", evidenceCourseCodes: ["AA 210", "AMATH 301", "AMATH 351"] },
  { planId: "uw-seattle-environmental-engineering", sourceUrl: "https://www.ce.washington.edu/sites/default/files/pdfs/current/undergrad/uw-cee-bsenve-degree-sheet.pdf", evidenceCourseCodes: ["AA 210", "AA 260", "AMATH 301"] },
  { planId: "uw-seattle-european-studies", sourceUrl: "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html", evidenceCourseCodes: ["JSIS 201"] },
  { planId: "uw-seattle-individualized-studies", sourceUrl: "https://www.washington.edu/students/gencat/program/S/GeneralStudies-185.html", evidenceCourseCodes: ["BIS 480", "HSTAA 353", "HSTCMP 249"] },
  { planId: "uw-seattle-industrial-systems-engineering", sourceUrl: "https://ise.washington.edu/files/BSIE%20Graduation%20Requirements.pdf", evidenceCourseCodes: ["AA 210", "AA 260", "CEE 220"] },
  { planId: "uw-seattle-informatics", sourceUrl: "https://ischool.uw.edu/programs/informatics/admissions/prerequisites", evidenceCourseCodes: ["BIOSTAT 310", "BIS 215", "CSE 121"] },
  { planId: "uw-seattle-international-studies", sourceUrl: "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html", evidenceCourseCodes: ["ANTH 318", "ARCTIC 200", "ARCTIC 401"] },
  {
    planId: "uw-seattle-italian",
    sourceUrl: "https://frenchitalian.washington.edu/undergraduate-studies-italian",
    evidenceTextSnippets: [
      "not able to offer the upper level courses for the Italian major",
      "not able to accept students into the Italian major",
    ],
  },
  { planId: "uw-seattle-japanese", sourceUrl: "https://asian.washington.edu/ba-japanese", evidenceCourseCodes: ["JAPAN 201", "JAPAN 203", "JAPAN 301"] },
  { planId: "uw-seattle-jazz-studies-b-m", sourceUrl: "https://www.washington.edu/students/gencat/program/S/Music-217.html", evidenceCourseCodes: ["MUHST 425", "MUSIC 113", "MUSIC 119"] },
  { planId: "uw-seattle-jewish-studies", sourceUrl: "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html", evidenceCourseCodes: ["HSTCMP 250", "JSIS 200", "JSIS 201"] },
  { planId: "uw-seattle-korean", sourceUrl: "https://asian.washington.edu/ba-korean", evidenceCourseCodes: ["ANTH 448", "ASIAN 207", "ASIAN 263"] },
  { planId: "uw-seattle-landscape-architecture", sourceUrl: "https://www.washington.edu/students/gencat/program/S/LandscapeArchitecture-53.html#credential-6078dddbe5ffc09fa25582d4", evidenceCourseCodes: ["BIOL 331", "BIOL 446", "ENVIR 313"] },
  { planId: "uw-seattle-latin", sourceUrl: "https://classics.washington.edu/ba-latin", evidenceCourseCodes: ["CLAS 495", "LATIN 101", "LATIN 102"] },
  { planId: "uw-seattle-latin-american-and-caribbean-studies", sourceUrl: "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html", evidenceCourseCodes: ["JSIS 201", "JSIS 493"] },
  { planId: "uw-seattle-law-societies-and-justice", sourceUrl: "https://lsj.washington.edu/lsj-gold-curriculum-requirements", evidenceCourseCodes: ["AIS 306", "AIS 308", "AIS 330"] },
  { planId: "uw-seattle-linguistics", sourceUrl: "https://linguistics.washington.edu/ba-linguistics", evidenceCourseCodes: ["LING 220", "LING 450", "LING 451"] },
  { planId: "uw-seattle-marine-biology", sourceUrl: "https://marinebiology.uw.edu/students/marine-biology-major/major-requirements/", evidenceCourseCodes: ["BIOL 180", "BIOL 200", "BIOL 220"] },
  { planId: "uw-seattle-materials-science-engineering", sourceUrl: "https://mse.washington.edu/current/undergrad/courses", evidenceCourseCodes: ["AA 210", "AA 260", "AMATH 301"] },
  { planId: "uw-seattle-mathematics", sourceUrl: "https://math.washington.edu/bs-mathematics-major-requirements", evidenceCourseCodes: ["MATH 124", "MATH 125", "MATH 126"] },
  { planId: "uw-seattle-mechanical-engineering", sourceUrl: "https://www.me.washington.edu/bsme/admissions", evidenceCourseCodes: ["AA 210", "CEE 220", "CHEM 142"] },
  { planId: "uw-seattle-medical-laboratory-science", sourceUrl: "https://www.washington.edu/students/gencat/academic/labm.html", evidenceCourseCodes: ["BIOC 405", "BIOL 180", "BIOL 200"] },
  { planId: "uw-seattle-microbiology", sourceUrl: "https://microbiology.washington.edu/sites/default/files/2026-04/Microbiology_Degree_UPDATED%20SPR%202026.pdf", evidenceCourseCodes: ["BIOC 405", "BIOC 440", "BIOEN 454"] },
  { planId: "uw-seattle-middle-eastern-languages-and-cultures", sourceUrl: "https://www.washington.edu/students/gencat/program/S/MiddleEasternLanguagesandCultures-123.html", evidenceCourseCodes: ["MELC 101", "MELC 201", "MELC 202"] },
  { planId: "uw-seattle-music-b-a", sourceUrl: "https://www.washington.edu/students/gencat/program/S/Music-217.html", evidenceCourseCodes: ["MUHST 210", "MUHST 211", "MUHST 212"] },
  { planId: "uw-seattle-music-composition-b-m", sourceUrl: "https://www.washington.edu/students/gencat/program/S/Music-217.html", evidenceCourseCodes: ["MUSAP 389", "MUSEN 389", "MUSIC 113"] },
  { planId: "uw-seattle-music-education-b-m", sourceUrl: "https://www.washington.edu/students/gencat/program/S/Music-217.html", evidenceCourseCodes: ["EDC&I 494", "MUSED 301", "MUSED 304"] },
  { planId: "uw-seattle-neuroscience", sourceUrl: "https://sites.uw.edu/neusci/about/courses/", evidenceCourseCodes: ["AMATH 301", "ANTH 415", "BH 311"] },
  { planId: "uw-seattle-norwegian", sourceUrl: "https://scandinavian.washington.edu/ba-norwegian", evidenceCourseCodes: ["NORW 101", "NORW 310", "NORW 311"] },
  { planId: "uw-seattle-nursing", sourceUrl: "https://nursing.uw.edu/wp-content/uploads/2025/05/BSN-Prerequisites-Worksheet.pdf", evidenceCourseCodes: ["BIOL 118", "BIOL 119", "CHEM 120"] },
  { planId: "uw-seattle-oceanography", sourceUrl: "https://www.ocean.washington.edu/files/checklist8ba-20190829030144.pdf", evidenceCourseCodes: ["BIOL 180", "BIOL 200", "BIOL 220"] },
  { planId: "uw-seattle-orchestral-instruments-b-m", sourceUrl: "https://www.washington.edu/students/gencat/program/S/Music-217.html", evidenceCourseCodes: ["MUSIC 113", "MUSEN 301", "MUSEN 302"] },
  { planId: "uw-seattle-organ-b-m", sourceUrl: "https://www.washington.edu/students/gencat/program/S/Music-217.html", evidenceCourseCodes: ["MUSEN 383", "MUSIC 113", "MUSIC 119"] },
  { planId: "uw-seattle-percussion-performance-b-m", sourceUrl: "https://www.washington.edu/students/gencat/program/S/Music-217.html", evidenceCourseCodes: ["MUHST 210", "MUSEN 300", "MUSEN 301"] },
  { planId: "uw-seattle-philosophy", sourceUrl: "https://www.washington.edu/students/gencat/program/S/Philosophy-221.html", evidenceCourseCodes: ["ASTR 313", "ESS 404", "HSTCMP 311"] },
  { planId: "uw-seattle-physics", sourceUrl: "https://www.washington.edu/students/crscat/phys.html", evidenceCourseCodes: ["AMATH 301", "AMATH 351", "AMATH 352"] },
  { planId: "uw-seattle-piano-b-m", sourceUrl: "https://www.washington.edu/students/gencat/program/S/Music-217.html", evidenceCourseCodes: ["MUSEN 369", "MUSEN 383", "MUSEN 384"] },
  { planId: "uw-seattle-political-science", sourceUrl: "https://www.polisci.washington.edu/political-science-major-declaration-and-requirements", evidenceCourseCodes: ["POLS 101", "POLS 201", "POLS 202"] },
  { planId: "uw-seattle-psychology", sourceUrl: "https://psych.uw.edu/undergraduate/prospective-students/graduation-requirements", evidenceCourseCodes: ["BIOL 118", "BIOL 161", "BIOL 162"] },
  { planId: "uw-seattle-public-health-global-health", sourceUrl: "https://sph.washington.edu/sites/default/files/2024-09/Public-Health-Global-Health-Major-OnePager-Purple-Curriculum-AUT2024.pdf", evidenceCourseCodes: ["BIOL 118", "BIOL 180", "BIOST 310"] },
  { planId: "uw-seattle-public-service-and-policy", sourceUrl: "https://www.washington.edu/students/crscat/pubpol.html", evidenceCourseCodes: ["PUBPOL 101", "PUBPOL 201", "PUBPOL 299"] },
  { planId: "uw-seattle-real-estate", sourceUrl: "https://www.washington.edu/students/gencat/program/S/RealEstate-54.html", evidenceCourseCodes: ["RE 250", "RE 361", "RE 397"] },
  { planId: "uw-seattle-slavic-languages-and-literatures", sourceUrl: "https://www.washington.edu/students/gencat/academic/slavic.html", evidenceCourseCodes: ["BCMS 406", "BCMS 410", "BCMS 420"] },
  { planId: "uw-seattle-social-welfare", sourceUrl: "https://www.washington.edu/students/crscat/socwf.html", evidenceCourseCodes: ["SOCWF 200", "SOCWF 265", "SOCWF 305"] },
  { planId: "uw-seattle-sociology", sourceUrl: "https://www.washington.edu/students/gencat/program/S/Sociology-293.html", evidenceCourseCodes: ["SOC 221", "SOC 300", "SOC 316"] },
  { planId: "uw-seattle-south-asian-languages-and-cultures", sourceUrl: "https://asian.washington.edu/ba-south-asian-languages-and-cultures", evidenceCourseCodes: ["ANTH 352", "ASIAN 210", "BENG 101"] },
  { planId: "uw-seattle-spanish", sourceUrl: "https://spanport.washington.edu/spanish-major-requirements", evidenceCourseCodes: ["SPAN 310", "SPAN 312", "SPAN 316"] },
  { planId: "uw-seattle-speech-and-hearing-sciences", sourceUrl: "https://www.washington.edu/students/gencat/program/S/SpeechandHearingSciences-296.html", evidenceCourseCodes: ["SPHSC 250", "SPHSC 302", "SPHSC 371"] },
  { planId: "uw-seattle-statistics", sourceUrl: "https://www.washington.edu/students/gencat/academic/stat.html", evidenceCourseCodes: ["CSE 122", "CSE 123", "CSE 163"] },
  { planId: "uw-seattle-sustainable-bioresource-systems-engineering", sourceUrl: "https://sefs.uw.edu/students/undergraduate/sbse-major/requirements/", evidenceCourseCodes: ["AMATH 301", "CSE 121", "CSE 160"] },
  { planId: "uw-seattle-swedish", sourceUrl: "https://www.washington.edu/students/gencat/academic/scand.html", evidenceCourseCodes: ["SCAND 344", "SCAND 345", "SCAND 454"] },
  { planId: "uw-seattle-voice-b-m", sourceUrl: "https://www.washington.edu/students/gencat/program/S/Music-217.html", evidenceCourseCodes: ["MUSIC 113", "MUSIC 119", "MUSIC 120"] },
];
const AUDITED_SEATTLE_REMAINING_INDIVIDUAL_ONLINE_SOURCE_SAMPLE =
  AUDITED_REMAINING_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE;
const AUDITED_TACOMA_DEMO_LIVE_SOURCE_SAMPLE = [
  {
    planId: "uw-tacoma-arts-media-culture",
    sourceUrl: "https://www.tacoma.uw.edu/sias/cac/american-cultures-track",
    evidenceCourseCodes: ["TAMST 101", "TAMST 120", "TAMST 210"],
  },
  {
    planId: "uw-tacoma-bachelor-of-arts-in-business-administration",
    sourceUrl: "https://www.tacoma.uw.edu/business/design-courses-baba",
    evidenceCourseCodes: ["TACCT 301", "TACCT 302", "TACCT 303"],
  },
  {
    planId: "uw-tacoma-biomedical-sciences",
    sourceUrl: "https://www.tacoma.uw.edu/sias/sam/biomedical-sciences",
    evidenceCourseCodes: ["TBIOL 120", "TBIOL 130", "TBIOL 140"],
  },
  {
    planId: "uw-tacoma-civil-engineering",
    sourceUrl: "https://www.tacoma.uw.edu/set/programs/undergrad/civil",
    evidenceCourseCodes: ["TCE 304", "TCE 305", "TCE 307"],
  },
  {
    planId: "uw-tacoma-communications",
    sourceUrl: "https://www.tacoma.uw.edu/sias/cac/professional-track",
    evidenceCourseCodes: ["TCOM 101", "TCOM 201", "TCOM 220"],
  },
  {
    planId: "uw-tacoma-computer-engineering",
    sourceUrl: "https://www.tacoma.uw.edu/set/programs/undergrad/cengr",
    evidenceCourseCodes: ["TCES 203", "TCES 215", "TCES 230"],
  },
  {
    planId: "uw-tacoma-computer-science-and-systems-ba",
    sourceUrl: "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
    evidenceCourseCodes: ["TCSS 101", "TCSS 141", "TCSS 142"],
  },
  {
    planId: "uw-tacoma-computer-science-and-systems-bs",
    sourceUrl: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
    evidenceCourseCodes: ["TCSS 142", "TCSS 143", "TCSS 305"],
  },
  {
    planId: "uw-tacoma-criminal-justice",
    sourceUrl: "https://www.tacoma.uw.edu/swcj/criminal-justice-campus-curriculum",
    evidenceCourseCodes: ["TCRIM 155", "TCRIM 156", "TCRIM 157"],
  },
  {
    planId: "uw-tacoma-economics-and-policy-analysis",
    sourceUrl: "https://www.washington.edu/students/gencat/program/T/SocialSciences-1132.html",
    evidenceCourseCodes: ["TECON 200", "TECON 201", "TECON 310"],
  },
  {
    planId: "uw-tacoma-education",
    sourceUrl: "https://www.tacoma.uw.edu/soe/bachelor-arts-education",
    evidenceCourseCodes: ["TBIOL 100", "TBIOL 102", "TCORE 101"],
  },
  {
    planId: "uw-tacoma-electrical-engineering",
    sourceUrl: "https://www.tacoma.uw.edu/set/programs/undergrad/ee",
    evidenceCourseCodes: ["TCES 215", "TCES 230", "TCES 310"],
  },
  {
    planId: "uw-tacoma-environmental-science",
    sourceUrl: "https://www.tacoma.uw.edu/sias/sam/environmental-science",
    evidenceCourseCodes: ["TBIOL 120", "TBIOL 130", "TBIOL 140"],
  },
  {
    planId: "uw-tacoma-environmental-sustainability",
    sourceUrl: "https://www.tacoma.uw.edu/sias/sam/environmental-sustainability",
    evidenceCourseCodes: ["TBGEN 212", "TBIOL 110", "TBIOL 232"],
  },
  {
    planId: "uw-tacoma-ethnic-gender-and-labor-studies",
    sourceUrl: "https://www.tacoma.uw.edu/sias/socs/ethnic-studies-option",
    evidenceCourseCodes: ["TAMST 260", "TAMST 430", "TARTS 360"],
  },
  {
    planId: "uw-tacoma-healthcare-leadership",
    sourceUrl: "https://www.washington.edu/students/crscatt/thlth.html",
    evidenceCourseCodes: ["THLTH 215", "THLTH 285", "THLTH 290"],
  },
  {
    planId: "uw-tacoma-history",
    sourceUrl: "https://www.tacoma.uw.edu/sias/socs/general-history-option",
    evidenceCourseCodes: ["THIST 150", "THIST 380", "THIST 498"],
  },
  {
    planId: "uw-tacoma-information-technology",
    sourceUrl: "https://www.washington.edu/students/crscatt/tinfo.html",
    evidenceCourseCodes: ["TINFO 110", "TINFO 200", "TINFO 210"],
  },
  {
    planId: "uw-tacoma-interdisciplinary-arts-and-sciences",
    sourceUrl: "https://www.tacoma.uw.edu/sias/socs/interdisciplinary-arts-and-sciences",
    evidenceCourseCodes: ["TARTS 200", "TARTS 240", "TARTS 280"],
  },
  {
    planId: "uw-tacoma-law-and-policy",
    sourceUrl: "https://www.tacoma.uw.edu/sias/socs/law-and-policy",
    evidenceCourseCodes: ["TCOM 454", "TCRIM 395", "TECON 316"],
  },
  {
    planId: "uw-tacoma-mathematics",
    sourceUrl: "https://www.washington.edu/students/crscatt/tmath.html",
    evidenceCourseCodes: ["TMATH 124", "TMATH 125", "TMATH 126"],
  },
  {
    planId: "uw-tacoma-mechanical-engineering",
    sourceUrl: "https://www.tacoma.uw.edu/set/programs/undergrad/me",
    evidenceCourseCodes: ["TME 221", "TME 310", "TCES 215"],
  },
  {
    planId: "uw-tacoma-nursing",
    sourceUrl: "https://www.tacoma.uw.edu/nursing/rn-bsn-sample-program-plans",
    evidenceCourseCodes: ["TNURS 360", "TNURS 407", "TNURS 410"],
  },
  {
    planId: "uw-tacoma-politics-philosophy-and-economics",
    sourceUrl: "https://www.tacoma.uw.edu/sias/socs/economics-specialization",
    evidenceCourseCodes: ["TECON 200", "TECON 201", "TECON 210"],
  },
  {
    planId: "uw-tacoma-psychology",
    sourceUrl: "https://www.tacoma.uw.edu/sias/socs/psychology",
    evidenceCourseCodes: ["TPSYCH 101", "TPSYCH 202", "TPSYCH 209"],
  },
  {
    planId: "uw-tacoma-social-welfare",
    sourceUrl: "https://www.tacoma.uw.edu/swcj/basw-curriculum",
    evidenceCourseCodes: ["TSOCWF 300", "TSOCWF 301", "TSOCWF 310"],
  },
  {
    planId: "uw-tacoma-spanish-language-and-cultures",
    sourceUrl: "https://www.tacoma.uw.edu/sias/cac/spanish-language-and-cultures",
    evidenceCourseCodes: ["TSPAN 301", "TSPAN 302", "TSPAN 303"],
  },
  {
    planId: "uw-tacoma-sustainable-urban-development",
    sourceUrl: "https://www.tacoma.uw.edu/urban-studies/ba-sustainable-urban-development",
    evidenceCourseCodes: ["TGIS 311", "TGIS 312", "TGIS 313"],
  },
  {
    planId: "uw-tacoma-urban-design",
    sourceUrl: "https://www.tacoma.uw.edu/urban-studies/bs-urban-design",
    evidenceCourseCodes: ["TUDE 101", "TUDE 210", "TUDE 260"],
  },
  {
    planId: "uw-tacoma-writing-studies",
    sourceUrl: "https://www.tacoma.uw.edu/sias/cac/writing-studies",
    evidenceCourseCodes: ["TCORE 101", "TWRT 121", "TWRT 211"],
  },
];
const AUDITED_REMAINING_TACOMA_DEMO_LIVE_SOURCE_SAMPLE = [
  {
    planId: "uw-tacoma-computer-science-and-systems",
    sourceUrl: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
    evidenceCourseCodes: ["TCSS 142", "TCSS 143", "TCSS 305"],
  },
  {
    planId: "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed",
    sourceUrl: "https://www.washington.edu/students/gencat/program/T/SocialSciences-1132.html",
    evidenceCourseCodes: ["TIAS 497"],
  },
  {
    planId: "uw-tacoma-urban-studies",
    sourceUrl: "https://www.tacoma.uw.edu/urban-studies/ba-urban-studies",
    evidenceCourseCodes: ["TURB 101", "TURB 200", "TURB 498"],
  },
];
const TACOMA_PUBLIC_ADMISSIONS_MAJORS_URL = "https://www.tacoma.uw.edu/admissions/majors-degrees";
const BOTHELL_PUBLIC_DEGREES_URL = "https://www.uwb.edu/degrees";
const BOTHELL_CATALOG_DEGREE_PROGRAMS_URL = "https://www.uwb.edu/catalog/degree-programs";
const TACOMA_PUBLIC_ADMISSIONS_UNDERGRAD_MAJOR_LABELS = [
  { label: "Accounting", planId: "uw-tacoma-bachelor-of-arts-in-business-administration" },
  { label: "Arts, Media and Culture", planId: "uw-tacoma-arts-media-culture" },
  { label: "Biomedical Sciences", planId: "uw-tacoma-biomedical-sciences" },
  { label: "Business Administration", planId: "uw-tacoma-bachelor-of-arts-in-business-administration" },
  { label: "Civil Engineering", planId: "uw-tacoma-civil-engineering" },
  { label: "Communication", planId: "uw-tacoma-communications" },
  { label: "Community Development & Planning", planId: "uw-tacoma-urban-studies" },
  { label: "Computer Engineering", planId: "uw-tacoma-computer-engineering" },
  { label: "Computer Science & Systems", planId: "uw-tacoma-computer-science-and-systems" },
  { label: "Criminal Justice", planId: "uw-tacoma-criminal-justice" },
  {
    label: "Criminal Justice - Online",
    planId: "uw-tacoma-criminal-justice",
    demoLabels: ["Criminal Justice Online"],
  },
  { label: "Economics and Policy Analysis", planId: "uw-tacoma-economics-and-policy-analysis" },
  { label: "Education", planId: "uw-tacoma-education" },
  { label: "Electrical Engineering", planId: "uw-tacoma-electrical-engineering" },
  { label: "Environmental Science", planId: "uw-tacoma-environmental-science" },
  { label: "Environmental Sustainability", planId: "uw-tacoma-environmental-sustainability" },
  { label: "Ethnic, Gender and Labor Studies", planId: "uw-tacoma-ethnic-gender-and-labor-studies" },
  { label: "Finance", planId: "uw-tacoma-bachelor-of-arts-in-business-administration" },
  { label: "GIS & Spatial Planning", planId: "uw-tacoma-urban-studies" },
  { label: "Global Studies", planId: "uw-tacoma-interdisciplinary-arts-and-sciences" },
  { label: "Healthcare Leadership", planId: "uw-tacoma-healthcare-leadership" },
  { label: "History", planId: "uw-tacoma-history" },
  { label: "Information Technology", planId: "uw-tacoma-information-technology" },
  {
    label: "Interdisciplinary Arts and Sciences (major)",
    planId: "uw-tacoma-interdisciplinary-arts-and-sciences",
    demoLabels: ["Interdisciplinary Arts and Sciences"],
  },
  { label: "Law and Policy", planId: "uw-tacoma-law-and-policy" },
  { label: "Management", planId: "uw-tacoma-bachelor-of-arts-in-business-administration" },
  { label: "Marketing", planId: "uw-tacoma-bachelor-of-arts-in-business-administration" },
  { label: "Mathematics", planId: "uw-tacoma-mathematics" },
  { label: "Mechanical Engineering", planId: "uw-tacoma-mechanical-engineering" },
  {
    label: "Nursing (RN to BSN)",
    planId: "uw-tacoma-nursing",
    demoLabels: ["Nursing RN BSN", "RN-BSN"],
  },
  { label: "Politics, Philosophy & Economics", planId: "uw-tacoma-politics-philosophy-and-economics" },
  { label: "Psychology", planId: "uw-tacoma-psychology" },
  { label: "Social Welfare", planId: "uw-tacoma-social-welfare" },
  { label: "Spanish Language & Cultures", planId: "uw-tacoma-spanish-language-and-cultures" },
  { label: "Sustainable Urban Development", planId: "uw-tacoma-sustainable-urban-development" },
  { label: "Urban Design", planId: "uw-tacoma-urban-design" },
  { label: "Urban Studies", planId: "uw-tacoma-urban-studies" },
  { label: "Writing Studies", planId: "uw-tacoma-writing-studies" },
];
const AUDITED_BOTHELL_DEMO_LIVE_SOURCE_SAMPLE = [
  {
    planId: "uw-bothell-educational-studies-elementary-education",
    sourceUrl: "https://www.uwb.edu/education/undergraduate/elementary-education/degree-requirements",
    evidenceCourseCodes: ["AAS 101", "AAS 210", "AAS 310"],
  },
  {
    planId: "uw-bothell-health-studies",
    sourceUrl: "https://www.uwb.edu/nhs/undergraduate/health-studies/overview/hs-electives",
    evidenceCourseCodes: ["BBIO 180", "BBIO 200", "BBIO 220"],
  },
  {
    planId: "uw-bothell-science-technology-and-society",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/science-technology-society",
    evidenceCourseCodes: ["BBIO 231", "BBIO 232", "BBIO 233"],
  },
  {
    planId: "uw-bothell-society-ethics-and-human-behavior",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/society-ethics-human-behavior",
    evidenceCourseCodes: ["BEDUC 220", "BEDUC 255", "BEDUC 328"],
  },
  {
    planId: "uw-bothell-earth-system-science",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/earth-system-science",
    evidenceCourseCodes: ["BBIO 180", "BBIO 330", "BBIO 335"],
  },
  {
    planId: "uw-bothell-law-economics-and-public-policy",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/law-economics-public-policy",
    evidenceCourseCodes: ["BBUS 215", "BBUS 220", "BBUS 221"],
  },
  {
    planId: "uw-bothell-psychology",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/psychology",
    evidenceCourseCodes: ["BBIO 310", "BBIO 320", "BBIO 394"],
  },
  {
    planId: "uw-bothell-conservation-and-restoration-science",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/conservation-restoration-science",
    evidenceCourseCodes: ["BBIO 180", "BBIO 330", "BBIO 335"],
  },
  {
    planId: "uw-bothell-environmental-studies",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/environmental-studies",
    evidenceCourseCodes: ["BBIO 330", "BBIO 335", "BBIO 471"],
  },
  {
    planId: "uw-bothell-biology",
    sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/biology/curriculum",
    evidenceCourseCodes: ["BBIO 231", "BBIO 233", "BBIO 285"],
  },
  {
    planId: "uw-bothell-media-and-communications-studies",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/media-communication",
    evidenceCourseCodes: ["BIS 115", "BIS 161", "BIS 162"],
  },
  {
    planId: "uw-bothell-electrical-engineering",
    sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/electrical/curriculum",
    evidenceCourseCodes: ["BCHEM 143", "BEE 200", "BEE 215"],
  },
  {
    planId: "uw-bothell-data-visualization-ba",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/data-visualization",
    evidenceCourseCodes: ["BBUS 215", "BDATA 200", "BDATA 232"],
  },
  {
    planId: "uw-bothell-physics-bs",
    sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/physics/curriculum",
    evidenceCourseCodes: ["BCHEM 143", "BCHEM 144", "BPHYS 121"],
  },
  {
    planId: "uw-bothell-mathematical-thinking-and-visualization",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/mathematical-thinking-visualization",
    evidenceCourseCodes: ["BBUS 215", "BEARTH 201", "BES 440"],
  },
  {
    planId: "uw-bothell-developmental-and-youth-studies",
    sourceUrl:
      "https://www.uwb.edu/education/undergraduate/developmental-and-youth-studies/degree-requirements",
    evidenceCourseCodes: ["BEDUC 205", "BEDUC 210", "BEDUC 220"],
  },
  {
    planId: "uw-bothell-mechanical-engineering",
    sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/mechanical/curriculum",
    evidenceCourseCodes: ["BCHEM 143", "BENGR 310", "BENGR 320"],
  },
  {
    planId: "uw-bothell-chemistry-bs",
    sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/chemistry/curriculum",
    evidenceCourseCodes: ["BBIO 180", "BBIO 200", "BBIO 364"],
  },
  {
    planId: "uw-bothell-chemistry-ba",
    sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/chemistry/curriculum",
    evidenceCourseCodes: ["BBIO 364", "BBIO 365", "BBIO 366"],
  },
  {
    planId: "uw-bothell-business-administration-accounting",
    sourceUrl: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/accounting",
    evidenceCourseCodes: ["BBUS 300", "BBUS 307", "BBUS 310"],
  },
  {
    planId: "uw-bothell-business-administration-finance",
    sourceUrl: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/finance-option",
    evidenceCourseCodes: ["BBUS 300", "BBUS 307", "BBUS 310"],
  },
  {
    planId: "uw-bothell-business-administration-supply-chain-management",
    sourceUrl: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/supply-chain",
    evidenceCourseCodes: ["BBUS 300", "BBUS 307", "BBUS 310"],
  },
  {
    planId: "uw-bothell-business-administration-leadership-and-strategic-innovation",
    sourceUrl: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/leadership",
    evidenceCourseCodes: ["BBUS 300", "BBUS 307", "BBUS 310"],
  },
  {
    planId: "uw-bothell-business-administration-marketing",
    sourceUrl: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/marketing",
    evidenceCourseCodes: ["BBUS 300", "BBUS 307", "BBUS 310"],
  },
  {
    planId: "uw-bothell-gender-women-and-sexuality-studies",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/gender-women-sexuality",
    evidenceCourseCodes: ["BCORE 107", "BCORE 115", "BCORE 117"],
  },
  {
    planId: "uw-bothell-csse",
    sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/curriculum",
    evidenceCourseCodes: ["BBUS 215", "BIS 215", "BMATH 215"],
  },
  {
    planId: "uw-bothell-business-administration",
    sourceUrl:
      "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
    evidenceCourseCodes: ["ACCTG 215", "ACCTG 225", "BBUS 210"],
  },
  {
    planId: "uw-bothell-economics",
    sourceUrl: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/curriculum",
    evidenceCourseCodes: ["BBECN 300", "BBECN 302", "BBECN 303"],
  },
  {
    planId: "uw-bothell-computer-engineering",
    sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/bscompe/curriculum",
    evidenceCourseCodes: ["BCHEM 143", "BEE 215", "BEE 233"],
  },
  {
    planId: "uw-bothell-applied-computing",
    sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/applied-computing/curriculum",
    evidenceCourseCodes: ["BBUS 300", "CSS 290", "CSS 301"],
  },
];
const AUDITED_REMAINING_BOTHELL_DEMO_LIVE_SOURCE_SAMPLE = [
  {
    planId: "uw-bothell-american-and-ethnic-studies",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/american-ethnic-studies",
    evidenceCourseCodes: ["BIS 165", "BIS 167", "BIS 175"],
  },
  {
    planId: "uw-bothell-csse-information-assurance-and-cybersecurity",
    sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/curriculum",
    evidenceCourseCodes: ["CSS 310", "CSS 337", "CSS 342"],
  },
  {
    planId: "uw-bothell-culture-literature-and-the-arts",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/culture-literature-arts",
    evidenceCourseCodes: ["BIS 136", "BIS 162", "BIS 163"],
  },
  {
    planId: "uw-bothell-data-visualization-bs",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/data-visualization",
    evidenceCourseCodes: ["BDATA 200", "BDATA 232", "BIMD 233"],
  },
  {
    planId: "uw-bothell-global-studies",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/global-studies",
    evidenceCourseCodes: ["BIS 163", "BIS 183", "BISGST 303"],
  },
  {
    planId: "uw-bothell-interactive-media-design",
    sourceUrl: "https://www.uwb.edu/premajor/wp-content/uploads/sites/26/2023/07/fillable-imd.pdf",
    evidenceCourseCodes: ["BIMD 233", "BIMD 250", "BBUS 215"],
  },
  {
    planId: "uw-bothell-interdisciplinary-arts",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/interdisciplinary-arts",
    evidenceCourseCodes: ["BIS 121", "BIS 130", "BIS 131"],
  },
  {
    planId: "uw-bothell-interdisciplinary-studies-individualized-study",
    sourceUrl: "https://www.uwb.edu/ias/undergraduate/majors/interdisciplinary-studies",
    evidenceCourseCodes: ["BIS 312", "BIS 340", "BIS 355"],
  },
  {
    planId: "uw-bothell-mathematics",
    sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/mathematics/curriculum",
    evidenceCourseCodes: ["BWRIT 134", "STMATH 124", "STMATH 125"],
  },
  {
    planId: "uw-bothell-nursing-first-year-rn-to-bsn",
    sourceUrl: "https://www.uwb.edu/nhs/undergraduate/rn-bsn/requirements",
    evidenceCourseCodes: ["BNURS 360", "BNURS 420", "BNURS 421"],
  },
  {
    planId: "uw-bothell-nursing-rn-to-bsn",
    sourceUrl: "https://www.uwb.edu/nhs/undergraduate/rn-bsn/requirements",
    evidenceCourseCodes: ["BNURS 360", "BNURS 420", "BNURS 421"],
  },
  {
    planId: "uw-bothell-physics-ba",
    sourceUrl: "https://www.uwb.edu/stem/undergraduate/majors/physics/curriculum",
    evidenceCourseCodes: ["BCHEM 143", "BCHEM 144", "BPHYS 121"],
  },
];

const fetchDemoSourceText = createSourceTextFetcher({
  operation: "Fetch demo diagnostic official source",
  timeoutMs: 30000,
});
let pdfjsImportPromise = null;
const pdfSourceTextCache = new Map();
const fetchedDemoEvidenceSourceUrls = new Set();
const demoEvidenceSourceReadyAtByOrigin = new Map();
const DEMO_EVIDENCE_SOURCE_MIN_ORIGIN_GAP_MS = 1200;
const DEMO_EVIDENCE_SOURCE_RETRY_DELAYS_MS = [2500, 5000, 10000, 20000];

function loadPdfjs() {
  pdfjsImportPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsImportPromise;
}

async function fetchDemoPdfSourceText(url) {
  if (pdfSourceTextCache.has(url)) {
    return pdfSourceTextCache.get(url);
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "GatorGuide transfer planner diagnostic/1.0",
    },
  });
  assert.equal(response.ok, true, `Official PDF source did not load: ${url} (${response.status})`);

  const pdfjs = await loadPdfjs();
  const pdfData = new Uint8Array(await response.arrayBuffer());
  const document = await pdfjs.getDocument({
    data: pdfData,
    verbosity: 0,
  }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => item.str ?? "").join(" "));
  }

  const text = pageTexts.join("\n");
  pdfSourceTextCache.set(url, text);
  return text;
}

function waitForDemoSourceRetry(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForDemoEvidenceSourceOrigin(url) {
  if (fetchedDemoEvidenceSourceUrls.has(url)) return;

  let origin = "unknown";
  try {
    origin = new URL(url).origin;
  } catch {
    origin = String(url ?? "unknown");
  }

  const now = Date.now();
  const readyAt = demoEvidenceSourceReadyAtByOrigin.get(origin) ?? 0;
  const waitMs = Math.max(readyAt - now, 0);
  demoEvidenceSourceReadyAtByOrigin.set(
    origin,
    Math.max(now, readyAt) + DEMO_EVIDENCE_SOURCE_MIN_ORIGIN_GAP_MS
  );

  if (waitMs > 0) {
    await waitForDemoSourceRetry(waitMs);
  }
}

async function fetchDemoSourceEvidenceText(url) {
  const fetchText = /\.pdf(?:$|[?#])/i.test(String(url ?? ""))
    ? fetchDemoPdfSourceText
    : fetchDemoSourceText;
  let lastError = null;

  for (let attempt = 0; attempt <= DEMO_EVIDENCE_SOURCE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await waitForDemoEvidenceSourceOrigin(url);
      const text = await fetchText(url);
      fetchedDemoEvidenceSourceUrls.add(url);
      return text;
    } catch (error) {
      lastError = error;
      const retryDelayMs = DEMO_EVIDENCE_SOURCE_RETRY_DELAYS_MS[attempt];
      if (!/\((?:429|503)\)/.test(String(error?.message ?? "")) || retryDelayMs == null) {
        break;
      }
      await waitForDemoSourceRetry(retryDelayMs);
    }
  }

  throw lastError;
}

function getDemoSourceDeclaredCourseCodes(planId) {
  return uniqueSorted(
    (demoPayload.programsByPlanId[planId] ?? []).flatMap((program) =>
      array(program.sourceDeclaredCourseCodes)
    )
  );
}

function normalizeOnlineCourseCode(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .toUpperCase()
    .replace(/\bA\s+A\b/g, "AA")
    .replace(/\bA\s+MATH\b/g, "AMATH")
    .replace(/\bART\s+H\b/g, "ARTH")
    .replace(/\bATM\s+S\b/g, "ATMS")
    .replace(
      /\bB\s+(AES|BECN|BIO|BUS|CHEM|CORE|CUSP|CULST|DATA|EARTH|ECON|EDUC|EE|ENGR|HLTH|HS|IMD|IS|MATH|ME|PHYS|ST|WRIT)\b/g,
      "B$1"
    )
    .replace(/\bBIS\s+(AES|CLA|GST|GWS|IA|LEP|MCS|PSY|STS)\b/g, "BIS$1")
    .replace(/\bBIO\s+A\b/g, "BIOA")
    .replace(/\bC\s+LIT\b/g, "CLIT")
    .replace(/\bCHEM\s+E\b/g, "CHEME")
    .replace(/\bENV\s+H\b/g, "ENVH")
    .replace(/\bG\s+H\b/g, "GH")
    .replace(/\bHST\s+(AFM|AM|AS|CMP|EU|LAC)\b/g, "HST$1")
    .replace(/\bLAB\s+M\b/g, "LABM")
    .replace(/\bL\s+ARCH\b/g, "LARCH")
    .replace(/\bPOL\s+S\b/g, "POLS")
    .replace(/\bQ\s+SCI\b/g, "QSCI")
    .replace(/\bR\s+E\b/g, "RE")
    .replace(/\bSOC\s+WF\b/g, "SOCWF")
    .replace(/\bST\s+MATH\b/g, "STMATH")
    .replace(
      /\bT\s+(ACCT|AMST|ANTH|ARTS|BANLT|BGEN|BIOL|BIOMD|BUS|CE|CES|CHEM|COM|CORE|CRIM|CSS|ECON|EDUC|EE|EGL|ESC|EST|FILM|GEOG|GEOS|GH|GIS|HIST|HLTH|IAS|INFO|INST|LAW|LAX|LIT|MATH|ME|MKTG|NPRFT|NURS|PHIL|PHYS|POLS|PSYCH|RELIG|SOC|SOCWF|SPAN|UDE|URB|WOMN|WRT)\b/g,
      "T$1"
    )
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^([A-Z&]+(?:\s+[A-Z&]+)*)\s*(\d{3}[A-Z]?)$/, "$1 $2");
}

function getDemoPrograms(planId) {
  return demoPayload.programsByPlanId[planId] ?? [];
}

function getDemoCourseCodes(planId) {
  return uniqueSorted(
    [
      ...getDemoPrograms(planId).flatMap((program) => array(program.expectedCourseCodes)),
      ...getDemoSourceDeclaredCourseCodes(planId),
    ].map(normalizeOnlineCourseCode)
  );
}

function getDemoOfficialSources(planId) {
  return uniqueSorted(getDemoPrograms(planId).flatMap((program) => array(program.officialSources)));
}

function normalizeTextEvidence(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizePublicMajorLabel(value) {
  return String(value ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&/g, " and ")
    .replace(/[-/]/g, " ")
    .toLowerCase()
    .replace(/\b(?:and|to|major)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getDemoPublicMajorLabelEvidence(planId) {
  return uniqueSorted(
    getDemoPrograms(planId)
      .flatMap((program) => [
        program.title,
        ...array(program.requiredTextSnippets),
        ...array(program.genEdSnippets),
        ...array(program.genEdRequirements),
        ...array(program.requirementLabels),
        ...array(program.publicAdmissionsLabels),
        ...array(program.optionGroups).map((group) => group.label),
        ...array(program.courseBuckets).map((bucket) => bucket.label),
        ...array(program.pathwayGroups).map((group) => group.label),
      ])
      .map(normalizePublicMajorLabel)
      .filter(Boolean)
  );
}

function getDemoTextEvidence(planId) {
  return uniqueSorted(
    getDemoPrograms(planId)
      .flatMap((program) => [
        ...array(program.requiredTextSnippets),
        ...array(program.genEdSnippets),
        ...array(program.genEdRequirements),
        ...array(program.requirementLabels),
      ])
      .map(normalizeTextEvidence)
      .filter(Boolean)
  );
}

function getCurrentSourceDeclaredCourseCodes(planId) {
  const planner = getPlanner();
  return uniqueSorted(
    (planner.getTransferPlannerParsedRequirementSourceBlocks(planId) ?? []).flatMap((block) => [
      ...array(block.parsedUwCourseCodes),
      ...array(block.sourceOnlyUwCourseCodes),
      ...array(block.approvedFilterUwCourseCodes),
      ...array(block.electiveListUwCourseCodes),
    ])
  );
}

function getOnlineSubjectAliases(subject) {
  const compactSubject = String(subject ?? "").replace(/\s+/g, "");
  const aliasesByCompactSubject = {
    AMATH: ["A MATH"],
    ARTH: ["ART H"],
    ATMS: ["ATM S"],
    BBECN: ["B BECN"],
    BBIO: ["B BIO"],
    BBUS: ["B BUS"],
    BCHEM: ["B CHEM"],
    BCORE: ["B CORE"],
    BCUSP: ["B CUSP"],
    BCULST: ["B CULST"],
    BDATA: ["B DATA"],
    BEARTH: ["B EARTH"],
    BEDUC: ["B EDUC"],
    BEE: ["B EE"],
    BENGR: ["B ENGR"],
    BES: ["B ES"],
    BGIS: ["B GIS"],
    BHLTH: ["B HLTH"],
    BHS: ["B HS"],
    BIMD: ["B IMD"],
    BISAES: ["BIS AES"],
    BISCLA: ["BIS CLA"],
    BISGST: ["BIS GST"],
    BISGWS: ["BIS GWS"],
    BISIA: ["BIS IA"],
    BISLEP: ["BIS LEP"],
    BISMCS: ["BIS MCS"],
    BISPSY: ["BIS PSY"],
    BISSTS: ["BIS STS"],
    BMATH: ["B MATH"],
    BME: ["B ME"],
    BNURS: ["B NURS"],
    BPHYS: ["B PHYS"],
    BST: ["B ST"],
    BWRIT: ["B WRIT"],
    BIOA: ["BIO A"],
    CHEME: ["CHEM E"],
    CLIT: ["C LIT"],
    ENVH: ["ENV H"],
    GH: ["G H"],
    HSTAFM: ["HST AFM"],
    HSTAM: ["HST AM"],
    HSTAS: ["HST AS"],
    HSTCMP: ["HST CMP"],
    HSTEU: ["HST EU"],
    HSTLAC: ["HST LAC"],
    LABM: ["LAB M"],
    LARCH: ["L ARCH"],
    POLS: ["POL S"],
    QSCI: ["Q SCI"],
    RE: ["R E"],
    SOCWF: ["SOC WF"],
    STMATH: ["ST MATH"],
    TACCT: ["T ACCT"],
    TAMST: ["T AMST"],
    TANTH: ["T ANTH"],
    TARTS: ["T ARTS"],
    TBANLT: ["T BANLT"],
    TBGEN: ["T BGEN"],
    TBIOL: ["T BIOL"],
    TBIOMD: ["T BIOMD"],
    TBUS: ["T BUS"],
    TCE: ["T CE"],
    TCES: ["T CES"],
    TCHEM: ["T CHEM"],
    TCOM: ["T COM"],
    TCORE: ["T CORE"],
    TCRIM: ["T CRIM"],
    TCSS: ["T CSS"],
    TECON: ["T ECON"],
    TEDUC: ["T EDUC"],
    TEE: ["T EE"],
    TEGL: ["T EGL"],
    TESC: ["T ESC"],
    TEST: ["T EST"],
    TFILM: ["T FILM"],
    TGEOG: ["T GEOG"],
    TGEOS: ["T GEOS"],
    TGH: ["T GH"],
    TGIS: ["T GIS"],
    THIST: ["T HIST"],
    THLTH: ["T HLTH"],
    TIAS: ["T IAS"],
    TINFO: ["T INFO"],
    TINST: ["T INST"],
    TLAW: ["T LAW"],
    TLAX: ["T LAX"],
    TLIT: ["T LIT"],
    TMATH: ["T MATH"],
    TME: ["T ME"],
    TMKTG: ["T MKTG"],
    TNPRFT: ["T NPRFT"],
    TNURS: ["T NURS"],
    TPHIL: ["T PHIL"],
    TPHYS: ["T PHYS"],
    TPOLS: ["T POLS"],
    TPSYCH: ["T PSYCH"],
    TRELIG: ["T RELIG"],
    TSOC: ["T SOC"],
    TSOCWF: ["T SOCWF", "T SOC WF"],
    TSPAN: ["T SPAN"],
    TUDE: ["T UDE"],
    TURB: ["T URB"],
    TWOMN: ["T WOMN"],
    TWRT: ["T WRT"],
  };

  return uniqueSorted([subject, ...(aliasesByCompactSubject[compactSubject] ?? [])]);
}

function getOnlineCourseCodesFromText(text, allowedSubjects) {
  const normalizedText = String(text ?? "");
  const matches = [];

  if (allowedSubjects && allowedSubjects.size > 0) {
    for (const subject of allowedSubjects) {
      for (const subjectAlias of getOnlineSubjectAliases(subject)) {
        const pattern = String(subjectAlias ?? "")
          .trim()
          .split(/\s+/)
          .map(escapeRegExp)
          .join("\\s+");
        if (!pattern) continue;
        matches.push(
          ...(normalizedText.match(
            new RegExp(`\\b${pattern}\\s+\\d{3}[A-Z]?(?=\\b|or\\b|and\\b)`, "gi")
          ) ?? [])
        );
      }
    }
  } else {
    matches.push(
      ...(normalizedText.match(/\b[A-Z]{1,8}(?:\s+[A-Z&]{1,8}){0,2}\s+\d{3}[A-Z]?\b/g) ??
        [])
    );
  }

  return uniqueSorted(
    matches
      .map(normalizeOnlineCourseCode)
      .filter((courseCode) => !/\b[A-Z]+&\s+\d/.test(courseCode))
      .filter(
        (courseCode) =>
          !allowedSubjects?.size ||
          allowedSubjects.has(courseCode.replace(/\s+\d{3}[A-Z]?$/, ""))
      )
  );
}

const INACTIVE_SEATTLE_ITALIAN_TEXT_SNIPPETS = [
  "not able to offer the upper level courses for the Italian major",
  "not able to accept students into the Italian major",
];

function hasInactiveSeattleItalianEvidence(program) {
  const normalizedProgramText = array(program.requiredTextSnippets)
    .map(normalizeTextEvidence)
    .join(" ");
  return INACTIVE_SEATTLE_ITALIAN_TEXT_SNIPPETS.every((snippet) =>
    normalizedProgramText.includes(normalizeTextEvidence(snippet))
  );
}

function isInactiveSeattleItalian(planId) {
  return (
    planId === "uw-seattle-italian" &&
    getDemoPrograms(planId).some(hasInactiveSeattleItalianEvidence)
  );
}

async function getOnlineDemoCourseCodes(planId) {
  const expectedCourseCodes = getDemoCourseCodes(planId);
  const allowedSubjects = new Set(
    expectedCourseCodes.map((courseCode) => courseCode.replace(/\s+\d{3}[A-Z]?$/, ""))
  );
  const sourceUrls = getDemoOfficialSources(planId).filter(isExtractableSource);
  const courseCodes = new Set();
  const sourceErrors = [];
  let loadedSourceCount = 0;

  for (const url of sourceUrls) {
    try {
      const sourceText = await fetchDemoSourceText(url);
      loadedSourceCount += 1;
      for (const courseCode of getOnlineCourseCodesFromText(sourceText, allowedSubjects)) {
        courseCodes.add(courseCode);
      }
    } catch (error) {
      sourceErrors.push(`${url} (${error.message})`);
    }
  }

  return {
    courseCodes: uniqueSorted([...courseCodes]),
    loadedSourceCount,
    sourceErrors,
    sourceUrls,
  };
}

function isHardSourceFailure(message) {
  return /\((?:404|410)\)/.test(String(message ?? ""));
}

async function assertLiveDemoCourseOverlapForCampus({
  campusLabel,
  planIds,
  shouldSkipPlanId = () => false,
}) {
  const noOnlineCourseOverlap = [];
  const noCourseBearingHtmlPlanIds = [];
  const pdfOnlyPlanIds = [];
  const skippedPlanIds = [];
  const hardSourceErrorEntries = [];
  const softSourceErrorPlanIds = [];
  const onlineCheckedPlanIds = [];

  for (const planId of planIds) {
    if (shouldSkipPlanId(planId)) {
      skippedPlanIds.push(planId);
      continue;
    }

    const expectedCourseCodes = getDemoCourseCodes(planId);
    const sourceUrls = getDemoOfficialSources(planId);
    const extractableSourceUrls = sourceUrls.filter(isExtractableSource);
    if (!extractableSourceUrls.length) {
      pdfOnlyPlanIds.push(planId);
      continue;
    }

    const onlineEvidence = await getOnlineDemoCourseCodes(planId);
    const hardSourceErrors = onlineEvidence.sourceErrors.filter(isHardSourceFailure);
    const softSourceErrors = onlineEvidence.sourceErrors.filter(
      (message) => !isHardSourceFailure(message)
    );
    if (hardSourceErrors.length) {
      hardSourceErrorEntries.push(`${planId}: ${hardSourceErrors.join("; ")}`);
    }
    if (softSourceErrors.length) {
      softSourceErrorPlanIds.push(`${planId}: ${softSourceErrors.slice(0, 2).join("; ")}`);
    }
    if (!onlineEvidence.loadedSourceCount || !onlineEvidence.courseCodes.length) {
      if (softSourceErrors.length && !hardSourceErrors.length) {
        continue;
      }
      noCourseBearingHtmlPlanIds.push(
        `${planId}: no course-bearing HTML loaded (${onlineEvidence.sourceErrors
          .slice(0, 2)
          .join("; ")})`
      );
      continue;
    }

    const onlineCourseCodes = new Set(onlineEvidence.courseCodes);
    const matchingCourseCodes = expectedCourseCodes.filter((courseCode) =>
      onlineCourseCodes.has(courseCode)
    );
    if (!matchingCourseCodes.length) {
      noOnlineCourseOverlap.push(
        `${planId}: expected ${expectedCourseCodes
          .slice(0, 12)
          .join(", ")}; online ${onlineEvidence.courseCodes.slice(0, 12).join(", ")}`
      );
      continue;
    }

    onlineCheckedPlanIds.push(planId);
  }

  assert.deepEqual(
    hardSourceErrorEntries,
    [],
    [
      `No extractable ${campusLabel} demo official source should be hard-dead.`,
      `Hard source errors: ${hardSourceErrorEntries.join(" | ")}`,
    ].join("\n")
  );
  assert.deepEqual(
    noCourseBearingHtmlPlanIds,
    [],
    [
      `Every non-PDF ${campusLabel} demo major should expose live HTML with recognizable UW course codes.`,
      `No course-bearing HTML: ${noCourseBearingHtmlPlanIds.join(" | ")}`,
    ].join("\n")
  );
  assert.deepEqual(
    noOnlineCourseOverlap,
    [],
    [
      `Every checked live, course-bearing ${campusLabel} demo source should overlap the source-reviewed course list.`,
      `No overlap: ${noOnlineCourseOverlap.join(" | ")}`,
    ].join("\n")
  );

  assert.ok(
    onlineCheckedPlanIds.length > 0,
    [
      `At least one ${campusLabel} demo major should be checked against loadable live HTML course evidence.`,
      `Checked: ${onlineCheckedPlanIds.length}`,
      `Skipped: ${skippedPlanIds.join(", ")}`,
      `PDF-only: ${pdfOnlyPlanIds.join(", ")}`,
      `Soft source errors: ${softSourceErrorPlanIds.slice(0, 40).join(" | ")}`,
    ].join("\n")
  );
}

async function assertAuditedLiveSourceProbe(probe) {
  const demoSourceUrls = new Set(getDemoOfficialSources(probe.planId));
  const normalizedEvidenceCourseCodes = array(probe.evidenceCourseCodes).map(
    normalizeOnlineCourseCode
  );
  const evidenceTextSnippets = array(probe.evidenceTextSnippets)
    .map(normalizeTextEvidence)
    .filter(Boolean);
  assert.ok(
    normalizedEvidenceCourseCodes.length || evidenceTextSnippets.length,
    `${probe.planId} audited source probe should include course or text evidence.`
  );

  const demoCourseCodes = new Set(getDemoCourseCodes(probe.planId));
  const missingDemoCourseCodes = normalizedEvidenceCourseCodes.filter(
    (courseCode) => !demoCourseCodes.has(courseCode)
  );
  const allowedSubjects = new Set(
    normalizedEvidenceCourseCodes.map((courseCode) => courseCode.replace(/\s+\d{3}[A-Z]?$/, ""))
  );
  const sourceText = await fetchDemoSourceEvidenceText(probe.sourceUrl);
  const onlineCourseCodes = new Set(getOnlineCourseCodesFromText(sourceText, allowedSubjects));
  const missingOnlineCourseCodes = normalizedEvidenceCourseCodes.filter(
    (courseCode) => !onlineCourseCodes.has(courseCode)
  );
  const demoTextEvidence = getDemoTextEvidence(probe.planId);
  const missingDemoTextSnippets = evidenceTextSnippets.filter(
    (snippet) => !demoTextEvidence.some((text) => text.includes(snippet))
  );
  const normalizedSourceText = normalizeTextEvidence(sourceText);
  const missingOnlineTextSnippets = evidenceTextSnippets.filter(
    (snippet) => !normalizedSourceText.includes(snippet)
  );

  assert.equal(
    demoSourceUrls.has(probe.sourceUrl),
    true,
    `${probe.planId} should keep audited official source ${probe.sourceUrl}`
  );
  assert.deepEqual(
    missingDemoCourseCodes,
    [],
    `${probe.planId} demo payload should include audited source course evidence from ${probe.sourceUrl}`
  );
  assert.deepEqual(
    missingOnlineCourseCodes,
    [],
    `${probe.planId} audited source should still expose expected course evidence at ${probe.sourceUrl}`
  );
  assert.deepEqual(
    missingDemoTextSnippets,
    [],
    `${probe.planId} demo payload should include audited text evidence from ${probe.sourceUrl}`
  );
  assert.deepEqual(
    missingOnlineTextSnippets,
    [],
    `${probe.planId} audited source should still expose expected text evidence at ${probe.sourceUrl}`
  );
}

function hasHumanStyleReviewEvidence(program) {
  const hasSource = array(program.officialSources).length > 0;
  const hasCourseEvidence =
    array(program.expectedCourseCodes).length > 0 || array(program.requiredCourseCodes).length > 0;
  const hasShapeEvidence =
    array(program.expectedPathwayIds).length > 0 ||
    array(program.optionGroups).length > 0 ||
    array(program.courseBuckets).length > 0 ||
    array(program.pathwayGroups).length > 0 ||
    array(program.genEdRequirements).length > 0 ||
    array(program.requirementLabels).length > 0 ||
    array(program.requiredTextSnippets).length > 0 ||
    array(program.genEdSnippets).length > 0;

  return hasSource && (hasCourseEvidence || hasShapeEvidence);
}

function collectProgramCourseCodes(programs, fieldName) {
  return new Set(programs.flatMap((program) => array(program[fieldName])));
}

function collectNormalizedProgramCourseCodes(programs, fieldName) {
  return new Set(
    programs.flatMap((program) => array(program[fieldName]).map(normalizeOnlineCourseCode))
  );
}

function getNormalizedCurrentSourceDeclaredCourseCodes(planId) {
  return new Set(getCurrentSourceDeclaredCourseCodes(planId).map(normalizeOnlineCourseCode));
}

function getEmittedProgramEntryCount() {
  return Object.values(demoPayload.programsByPlanId).reduce(
    (sum, programs) => sum + programs.length,
    0
  );
}

const RAW_REVIEW_COURSE_CODES_BY_PLAN_ID = (() => {
  const { programs } = loadCompleteDiagnosticPrograms();
  const courseCodesByPlanId = new Map();

  for (const program of programs) {
    const planId = String(program.planId ?? "").trim();
    if (!planId) continue;
    const courseCodes = courseCodesByPlanId.get(planId) ?? new Set();
    for (const courseCode of getExpectedCourseCodesFromProgram(program)) {
      courseCodes.add(courseCode);
    }
    courseCodesByPlanId.set(planId, courseCodes);
  }

  return courseCodesByPlanId;
})();

function assertDemoPreservesRawReviewCourses(planId, courseCodes) {
  const rawReviewCourses = RAW_REVIEW_COURSE_CODES_BY_PLAN_ID.get(planId) ?? new Set();
  const programs = demoPayload.programsByPlanId[planId] ?? [];
  const demoExpectedCourses = collectProgramCourseCodes(programs, "expectedCourseCodes");

  assert.ok(programs.length, `Expected a demo review entry for ${planId}.`);
  assert.deepEqual(
    courseCodes.filter((courseCode) => !rawReviewCourses.has(courseCode)),
    [],
    `${planId} spot-check courses must come from raw complete-diagnostics review evidence.`
  );
  assert.deepEqual(
    courseCodes.filter((courseCode) => !demoExpectedCourses.has(courseCode)),
    [],
    `${planId} should keep source-reviewed courses in the demo payload.`
  );
}

test("generated demo diagnostics cover every current UW planner major", () => {
  const bootstrapPlanIds = loadCurrentBootstrapPlans().map((plan) => plan.id);
  const reviewedPlanIds = new Set(demoPayload.reviewedPlanIds);
  const missingPlanIds = bootstrapPlanIds.filter((planId) => !reviewedPlanIds.has(planId));

  assert.deepEqual(
    missingPlanIds,
    [],
    `Demo mode diagnostics are missing current planner majors: ${missingPlanIds.join(", ")}`
  );
  assert.equal(demoPayload.summary.reviewedMajorCount, demoPayload.reviewedPlanIds.length);
  assert.equal(demoPayload.summary.reviewedMajorCount, bootstrapPlanIds.length);
});

test("generated demo diagnostics summary matches emitted payload shape", () => {
  assert.equal(demoPayload.summary.reviewedMajorCount, demoPayload.reviewedPlanIds.length);
  assert.equal(demoPayload.summary.fixtureFileCount, demoPayload.source.fixtureFiles.length);
  assert.equal(demoPayload.summary.programEntryCount, getEmittedProgramEntryCount());
});

test("generated demo diagnostics keep complete-diagnostics source and course review evidence", () => {
  const underSpecifiedPlanIds = demoPayload.reviewedPlanIds.filter((planId) => {
    const programs = demoPayload.programsByPlanId[planId] ?? [];
    return !programs.some(hasHumanStyleReviewEvidence);
  });

  assert.deepEqual(
    underSpecifiedPlanIds,
    [],
    [
      "Demo mode should be backed by the complete-diagnostics human review fixtures.",
      `Under-specified: ${underSpecifiedPlanIds.join(", ")}`,
    ].join("\n")
  );
});

test("generated demo diagnostics only label parsed source evidence as source-declared", () => {
  const mislabeledSourceDeclaredCourses = [];

  for (const planId of demoPayload.reviewedPlanIds) {
    const programs = demoPayload.programsByPlanId[planId] ?? [];
    const currentSourceDeclaredCourses = getNormalizedCurrentSourceDeclaredCourseCodes(planId);
    const demoSourceDeclaredCourses = collectNormalizedProgramCourseCodes(
      programs,
      "sourceDeclaredCourseCodes"
    );
    const mislabeledCourses = [...demoSourceDeclaredCourses].filter(
      (courseCode) => !currentSourceDeclaredCourses.has(courseCode)
    );

    if (mislabeledCourses.length) {
      mislabeledSourceDeclaredCourses.push(`${planId}: ${mislabeledCourses.join(", ")}`);
    }
  }

  assert.deepEqual(
    mislabeledSourceDeclaredCourses,
    [],
    [
      "Demo sourceDeclaredCourseCodes must only contain courses that the parser found in official-source blocks.",
      "Structured-only planner courses are still useful expected-course evidence, but labeling them source-declared is misleading.",
      `Mislabeled: ${mislabeledSourceDeclaredCourses.slice(0, 40).join(" | ")}`,
    ].join("\n")
  );
});

test("30 Tacoma demo majors keep hand-reviewed official source evidence", () => {
  const currentTacomaPlanIds = new Set(CURRENT_TACOMA_PLAN_IDS);
  const samplePlanIds = new Set();
  const sampleProblems = [];

  for (const entry of AUDITED_TACOMA_DEMO_LIVE_SOURCE_SAMPLE) {
    if (samplePlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: duplicated in audited sample`);
    }
    samplePlanIds.add(entry.planId);

    if (!currentTacomaPlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: not a current Tacoma planner major`);
    }

    if (!/^https:\/\/(?:www\.tacoma\.uw\.edu|www\.washington\.edu\/students)\//i.test(entry.sourceUrl)) {
      sampleProblems.push(`${entry.planId}: source is not an official Tacoma or UW catalog page (${entry.sourceUrl})`);
    }

    const sourceUrls = getDemoOfficialSources(entry.planId);
    if (!sourceUrls.includes(entry.sourceUrl)) {
      sampleProblems.push(`${entry.planId}: demo officialSources missing ${entry.sourceUrl}`);
    }

    const demoCourseCodes = new Set(getDemoCourseCodes(entry.planId));
    const missingDemoCourseCodes = entry.evidenceCourseCodes
      .map(normalizeOnlineCourseCode)
      .filter((courseCode) => !demoCourseCodes.has(courseCode));
    if (missingDemoCourseCodes.length) {
      sampleProblems.push(`${entry.planId}: demo missing ${missingDemoCourseCodes.join(", ")}`);
    }
  }

  assert.equal(
    AUDITED_TACOMA_DEMO_LIVE_SOURCE_SAMPLE.length,
    30,
    "The Tacoma human-review demo audit sample should cover exactly 30 individually checked majors."
  );
  assert.deepEqual(
    sampleProblems,
    [],
    [
      "The Tacoma 30-major audit sample should be real: each entry must be a current Tacoma major, keep the audited source URL, and preserve the checked course evidence.",
      `Problems: ${sampleProblems.join(" | ")}`,
    ].join("\n")
  );
});

onlineDiagnosticTest(
  "30 audited Tacoma demo majors have live official source course evidence when online diagnostics are enabled",
  async () => {
    for (const entry of AUDITED_TACOMA_DEMO_LIVE_SOURCE_SAMPLE) {
      await assertAuditedLiveSourceProbe(entry);
    }
  }
);

test("remaining Tacoma demo majors keep hand-reviewed official source evidence", () => {
  const auditedThirtyPlanIds = new Set(
    AUDITED_TACOMA_DEMO_LIVE_SOURCE_SAMPLE.map((entry) => entry.planId)
  );
  const remainingPlanIds = CURRENT_TACOMA_PLAN_IDS.filter(
    (planId) => !auditedThirtyPlanIds.has(planId)
  );
  const currentTacomaPlanIds = new Set(CURRENT_TACOMA_PLAN_IDS);
  const samplePlanIds = new Set();
  const sampleProblems = [];

  for (const entry of AUDITED_REMAINING_TACOMA_DEMO_LIVE_SOURCE_SAMPLE) {
    if (samplePlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: duplicated in remaining audited sample`);
    }
    samplePlanIds.add(entry.planId);

    if (!currentTacomaPlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: not a current Tacoma planner major`);
    }

    if (auditedThirtyPlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: already covered by the 30-major Tacoma sample`);
    }

    if (!/^https:\/\/(?:www\.tacoma\.uw\.edu|www\.washington\.edu\/students)\//i.test(entry.sourceUrl)) {
      sampleProblems.push(`${entry.planId}: source is not an official Tacoma or UW catalog page (${entry.sourceUrl})`);
    }

    const sourceUrls = getDemoOfficialSources(entry.planId);
    if (!sourceUrls.includes(entry.sourceUrl)) {
      sampleProblems.push(`${entry.planId}: demo officialSources missing ${entry.sourceUrl}`);
    }

    const demoCourseCodes = new Set(getDemoCourseCodes(entry.planId));
    const missingDemoCourseCodes = entry.evidenceCourseCodes
      .map(normalizeOnlineCourseCode)
      .filter((courseCode) => !demoCourseCodes.has(courseCode));
    if (missingDemoCourseCodes.length) {
      sampleProblems.push(`${entry.planId}: demo missing ${missingDemoCourseCodes.join(", ")}`);
    }
  }

  assert.equal(
    AUDITED_REMAINING_TACOMA_DEMO_LIVE_SOURCE_SAMPLE.length,
    remainingPlanIds.length,
    "The remaining Tacoma audit sample should cover every current Tacoma major not covered by the first 30-major sample."
  );
  assert.deepEqual(
    remainingPlanIds.filter((planId) => !samplePlanIds.has(planId)),
    [],
    "Every remaining Tacoma major should have hand-reviewed official source evidence."
  );
  assert.deepEqual(
    sampleProblems,
    [],
    [
      "The remaining Tacoma audit sample should be real: each entry must be a current uncovered major, keep an audited official source URL, and preserve the checked course evidence.",
      `Problems: ${sampleProblems.join(" | ")}`,
    ].join("\n")
  );
});

test("audited Tacoma demo source samples cover every current Tacoma planner major", () => {
  const auditedPlanIds = new Set([
    ...AUDITED_TACOMA_DEMO_LIVE_SOURCE_SAMPLE.map((entry) => entry.planId),
    ...AUDITED_REMAINING_TACOMA_DEMO_LIVE_SOURCE_SAMPLE.map((entry) => entry.planId),
  ]);

  assert.deepEqual(
    CURRENT_TACOMA_PLAN_IDS.filter((planId) => !auditedPlanIds.has(planId)),
    [],
    "The combined Tacoma source audit samples should cover every current Tacoma planner major."
  );
  assert.equal(
    auditedPlanIds.size,
    CURRENT_TACOMA_PLAN_IDS.length,
    "The combined Tacoma source audit samples should not duplicate or invent Tacoma majors."
  );
});

test("generated demo diagnostics represent every public Tacoma undergraduate major label", () => {
  const currentTacomaPlanIds = new Set(CURRENT_TACOMA_PLAN_IDS);
  const missingPlanIds = [];
  const missingDemoLabels = [];

  assert.equal(
    TACOMA_PUBLIC_ADMISSIONS_UNDERGRAD_MAJOR_LABELS.length,
    38,
    "The Tacoma public undergraduate admissions list should be reviewed as 38 major labels."
  );

  for (const entry of TACOMA_PUBLIC_ADMISSIONS_UNDERGRAD_MAJOR_LABELS) {
    if (!currentTacomaPlanIds.has(entry.planId)) {
      missingPlanIds.push(`${entry.label}: ${entry.planId}`);
      continue;
    }

    const demoEvidence = getDemoPublicMajorLabelEvidence(entry.planId);
    const expectedLabels = array(entry.demoLabels).length ? entry.demoLabels : [entry.label];
    const normalizedExpectedLabels = expectedLabels.map(normalizePublicMajorLabel).filter(Boolean);
    const hasLabelEvidence = normalizedExpectedLabels.some((label) =>
      demoEvidence.some((evidence) => evidence.includes(label))
    );

    if (!hasLabelEvidence) {
      missingDemoLabels.push(`${entry.label}: ${entry.planId}`);
    }
  }

  assert.deepEqual(
    missingPlanIds,
    [],
    `Every public Tacoma undergraduate major label should map to a current planner major: ${missingPlanIds.join(" | ")}`
  );
  assert.deepEqual(
    missingDemoLabels,
    [],
    `Every public Tacoma undergraduate major label should be visible in the demo text evidence: ${missingDemoLabels.join(" | ")}`
  );
});

onlineDiagnosticTest(
  "UW Tacoma public undergraduate major labels stay tied to the live admissions page",
  async () => {
    const sourceText = normalizePublicMajorLabel(
      await fetchDemoSourceEvidenceText(TACOMA_PUBLIC_ADMISSIONS_MAJORS_URL)
    );
    const missingLiveLabels = TACOMA_PUBLIC_ADMISSIONS_UNDERGRAD_MAJOR_LABELS
      .map((entry) => entry.label)
      .filter((label) => !sourceText.includes(normalizePublicMajorLabel(label)));

    assert.deepEqual(
      missingLiveLabels,
      [],
      [
        "The hand-reviewed Tacoma public major label list should match the live UW Tacoma Admissions majors page.",
        `Missing from ${TACOMA_PUBLIC_ADMISSIONS_MAJORS_URL}: ${missingLiveLabels.join(" | ")}`,
      ].join("\n")
    );
  }
);

onlineDiagnosticTest(
  "remaining audited Tacoma demo majors have live official source course evidence when online diagnostics are enabled",
  async () => {
    for (const entry of AUDITED_REMAINING_TACOMA_DEMO_LIVE_SOURCE_SAMPLE) {
      await assertAuditedLiveSourceProbe(entry);
    }
  }
);

test("generated demo diagnostics include UW Tacoma Computer Engineering courses", () => {
  const programs = demoPayload.programsByPlanId["uw-tacoma-computer-engineering"] ?? [];
  const program = programs[0];

  assert.ok(program, "Expected a UW Tacoma Computer Engineering demo review entry.");
  assert.deepEqual(
    ["TCES 203", "TCSS 142", "TMATH 124", "TPHYS 121"].filter(
      (courseCode) => !program.expectedCourseCodes.includes(courseCode)
    ),
    []
  );
  assert.ok(
    program.officialSources.some((url) => /tacoma\.uw\.edu\/set\/programs\/undergrad\/cengr/i.test(url)),
    "Expected the UW Tacoma Computer Engineering source page."
  );
});

test("60 Seattle demo majors keep hand-reviewed official source evidence", () => {
  const currentSeattlePlanIds = new Set(CURRENT_SEATTLE_PLAN_IDS);
  const samplePlanIds = new Set();
  const sampleProblems = [];

  for (const entry of AUDITED_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE) {
    if (samplePlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: duplicated in audited sample`);
    }
    samplePlanIds.add(entry.planId);

    if (!currentSeattlePlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: not a current Seattle planner major`);
    }

    if (!/^https:\/\/(?:[\w.-]+\.)?(?:washington|uw)\.edu\//i.test(entry.sourceUrl)) {
      sampleProblems.push(`${entry.planId}: source is not an official UW page (${entry.sourceUrl})`);
    }

    const sourceUrls = getDemoOfficialSources(entry.planId);
    if (!sourceUrls.includes(entry.sourceUrl)) {
      sampleProblems.push(`${entry.planId}: demo officialSources missing ${entry.sourceUrl}`);
    }

    const demoCourseCodes = new Set(getDemoCourseCodes(entry.planId));
    const missingDemoCourseCodes = entry.evidenceCourseCodes
      .map(normalizeOnlineCourseCode)
      .filter((courseCode) => !demoCourseCodes.has(courseCode));
    if (missingDemoCourseCodes.length) {
      sampleProblems.push(`${entry.planId}: demo missing ${missingDemoCourseCodes.join(", ")}`);
    }
  }

  assert.equal(
    AUDITED_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE.length,
    60,
    "The Seattle human-review demo audit sample should cover exactly 60 individually checked majors."
  );
  assert.deepEqual(
    sampleProblems,
    [],
    [
      "The Seattle 60-major audit sample should be real: each entry must be a current Seattle major, keep an audited official UW source URL, and preserve the checked course evidence.",
      `Problems: ${sampleProblems.join(" | ")}`,
    ].join("\n")
  );
});

test("remaining Seattle demo majors keep hand-reviewed official source evidence", () => {
  const currentSeattlePlanIds = new Set(CURRENT_SEATTLE_PLAN_IDS);
  const audited60PlanIds = new Set(
    AUDITED_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE.map((entry) => entry.planId)
  );
  const expectedRemainingPlanIds = CURRENT_SEATTLE_PLAN_IDS.filter(
    (planId) => !audited60PlanIds.has(planId)
  );
  const samplePlanIds = new Set();
  const sampleProblems = [];

  for (const entry of AUDITED_REMAINING_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE) {
    if (samplePlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: duplicated in remaining audited sample`);
    }
    samplePlanIds.add(entry.planId);

    if (!currentSeattlePlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: not a current Seattle planner major`);
    }
    if (audited60PlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: already covered in the first Seattle 60-major sample`);
    }
    if (!/^https:\/\/(?:[\w.-]+\.)?(?:washington|uw)\.edu\//i.test(entry.sourceUrl)) {
      sampleProblems.push(`${entry.planId}: source is not an official UW page (${entry.sourceUrl})`);
    }

    const sourceUrls = getDemoOfficialSources(entry.planId);
    if (!sourceUrls.includes(entry.sourceUrl)) {
      sampleProblems.push(`${entry.planId}: demo officialSources missing ${entry.sourceUrl}`);
    }

    const normalizedEvidenceCourseCodes = array(entry.evidenceCourseCodes).map(
      normalizeOnlineCourseCode
    );
    const evidenceTextSnippets = array(entry.evidenceTextSnippets)
      .map(normalizeTextEvidence)
      .filter(Boolean);
    if (!normalizedEvidenceCourseCodes.length && !evidenceTextSnippets.length) {
      sampleProblems.push(`${entry.planId}: missing audited course or text evidence`);
    }

    const demoCourseCodes = new Set(getDemoCourseCodes(entry.planId));
    const missingDemoCourseCodes = normalizedEvidenceCourseCodes.filter(
      (courseCode) => !demoCourseCodes.has(courseCode)
    );
    if (missingDemoCourseCodes.length) {
      sampleProblems.push(`${entry.planId}: demo missing ${missingDemoCourseCodes.join(", ")}`);
    }

    const demoTextEvidence = getDemoTextEvidence(entry.planId);
    const missingDemoTextSnippets = evidenceTextSnippets.filter(
      (snippet) => !demoTextEvidence.some((text) => text.includes(snippet))
    );
    if (missingDemoTextSnippets.length) {
      sampleProblems.push(
        `${entry.planId}: demo missing text evidence ${missingDemoTextSnippets.join(" | ")}`
      );
    }
  }

  assert.equal(
    AUDITED_REMAINING_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE.length,
    expectedRemainingPlanIds.length,
    "The remaining Seattle human-review demo audit sample should cover every current Seattle major not included in the first 60-major sample."
  );
  assert.deepEqual(
    uniqueSorted([...samplePlanIds]),
    uniqueSorted(expectedRemainingPlanIds),
    "The remaining Seattle audit sample should exactly equal the current Seattle majors that were not part of the first 60-major sample."
  );
  assert.deepEqual(
    sampleProblems,
    [],
    [
      "The remaining Seattle audit sample should be real: each entry must be a current not-yet-audited Seattle major, keep an audited official UW source URL, and preserve checked course or text evidence.",
      `Problems: ${sampleProblems.join(" | ")}`,
    ].join("\n")
  );
});

test("audited Seattle demo source samples cover every current Seattle planner major", () => {
  const allAuditedPlanIds = [
    ...AUDITED_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE,
    ...AUDITED_REMAINING_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE,
  ].map((entry) => entry.planId);
  const duplicatePlanIds = allAuditedPlanIds.filter(
    (planId, index) => allAuditedPlanIds.indexOf(planId) !== index
  );

  assert.deepEqual(duplicatePlanIds, [], "Seattle audited source samples should not duplicate majors.");
  assert.deepEqual(
    uniqueSorted(allAuditedPlanIds),
    uniqueSorted(CURRENT_SEATTLE_PLAN_IDS),
    "Seattle audited source samples should cover every current Seattle planner major."
  );
});

test("30 Seattle demo majors selected for individual online audit stay tied to the audited sample", () => {
  assert.equal(
    AUDITED_SEATTLE_30_INDIVIDUAL_ONLINE_SOURCE_SAMPLE.length,
    30,
    "The individual Seattle online audit should cover exactly 30 majors."
  );
  assert.deepEqual(
    AUDITED_SEATTLE_30_INDIVIDUAL_ONLINE_SOURCE_SAMPLE,
    AUDITED_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE.slice(0, 30),
    "The individual Seattle online audit should be the first 30 hand-reviewed Seattle demo entries."
  );
});

test("second 30 Seattle demo majors selected for individual online audit stay tied to the audited sample", () => {
  assert.equal(
    AUDITED_SEATTLE_SECOND_30_INDIVIDUAL_ONLINE_SOURCE_SAMPLE.length,
    30,
    "The second individual Seattle online audit should cover exactly 30 majors."
  );
  assert.deepEqual(
    AUDITED_SEATTLE_SECOND_30_INDIVIDUAL_ONLINE_SOURCE_SAMPLE,
    AUDITED_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE.slice(30, 60),
    "The second individual Seattle online audit should be entries 31-60 from the hand-reviewed Seattle demo sample."
  );
});

test("55 remaining Seattle demo majors selected for individual online audit stay tied to current majors", () => {
  const audited60PlanIds = new Set(
    AUDITED_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE.map((entry) => entry.planId)
  );
  const expectedRemainingPlanIds = CURRENT_SEATTLE_PLAN_IDS.filter(
    (planId) => !audited60PlanIds.has(planId)
  );

  assert.equal(
    AUDITED_SEATTLE_REMAINING_INDIVIDUAL_ONLINE_SOURCE_SAMPLE.length,
    55,
    "The remaining individual Seattle online audit should cover exactly 55 majors."
  );
  assert.deepEqual(
    AUDITED_SEATTLE_REMAINING_INDIVIDUAL_ONLINE_SOURCE_SAMPLE.map((entry) => entry.planId),
    expectedRemainingPlanIds,
    "The remaining individual Seattle online audit should cover every current Seattle major not in the first 60."
  );
});

onlineDiagnosticTest(
  "30 Seattle demo majors individually match demo evidence and live official sources",
  async (t) => {
    for (const entry of AUDITED_SEATTLE_30_INDIVIDUAL_ONLINE_SOURCE_SAMPLE) {
      await t.test(entry.planId, async () => {
        await assertAuditedLiveSourceProbe(entry);
      });
    }
  }
);

onlineDiagnosticTest(
  "second 30 Seattle demo majors individually match demo evidence and live official sources",
  async (t) => {
    for (const entry of AUDITED_SEATTLE_SECOND_30_INDIVIDUAL_ONLINE_SOURCE_SAMPLE) {
      await t.test(entry.planId, async () => {
        await assertAuditedLiveSourceProbe(entry);
      });
    }
  }
);

onlineDiagnosticTest(
  "60 audited Seattle demo majors have live official source course evidence when online diagnostics are enabled",
  async () => {
    for (const entry of AUDITED_SEATTLE_DEMO_LIVE_SOURCE_SAMPLE) {
      await assertAuditedLiveSourceProbe(entry);
    }
  }
);

onlineDiagnosticTest(
  "55 remaining Seattle demo majors individually match demo evidence and live official sources",
  async (t) => {
    for (const entry of AUDITED_SEATTLE_REMAINING_INDIVIDUAL_ONLINE_SOURCE_SAMPLE) {
      await t.test(entry.planId, async () => {
        await assertAuditedLiveSourceProbe(entry);
      });
    }
  }
);

test("generated demo diagnostics avoid non-major transfer-guide sources for Seattle demos", () => {
  const nonMajorSourceEntries = [];

  for (const planId of CURRENT_SEATTLE_PLAN_IDS) {
    for (const url of getDemoOfficialSources(planId)) {
      if (NON_MAJOR_UW_DEMO_SOURCE_PATTERN.test(url)) {
        nonMajorSourceEntries.push(`${planId}: ${url}`);
      }
    }
  }

  assert.deepEqual(
    nonMajorSourceEntries,
    [],
    [
      "Seattle demo officialSources should point at major, department, catalog, or degree pages.",
      `Non-major source entries: ${nonMajorSourceEntries.join(" | ")}`,
    ].join("\n")
  );
});

test("generated demo diagnostics include source-declared courses for every active Seattle major", () => {
  const missingCourseEvidence = [];
  const missingSourceDeclaredCourses = [];

  for (const planId of CURRENT_SEATTLE_PLAN_IDS) {
    const programs = demoPayload.programsByPlanId[planId] ?? [];
    const program = programs[0];
    assert.ok(program, `Expected a Seattle demo review entry for ${planId}.`);

    const sourceDeclaredCourseCodes = [...getNormalizedCurrentSourceDeclaredCourseCodes(planId)];
    const isInactiveWithoutMajorCourses =
      planId === "uw-seattle-italian" &&
      hasInactiveSeattleItalianEvidence(program);

    if (!program.expectedCourseCodes.length && !isInactiveWithoutMajorCourses) {
      missingCourseEvidence.push(planId);
    }

    const demoExpectedCourses = collectNormalizedProgramCourseCodes(programs, "expectedCourseCodes");
    const demoSourceDeclaredCourses = collectNormalizedProgramCourseCodes(programs, "sourceDeclaredCourseCodes");
    const missingForProgram = sourceDeclaredCourseCodes.filter(
      (courseCode) => !demoExpectedCourses.has(courseCode) || !demoSourceDeclaredCourses.has(courseCode)
    );
    if (missingForProgram.length) {
      missingSourceDeclaredCourses.push(`${planId}: ${missingForProgram.join(", ")}`);
    }
  }

  assert.deepEqual(
    missingCourseEvidence,
    [],
    `Every active Seattle demo major should expose reviewed course evidence: ${missingCourseEvidence.join(", ")}`
  );
  assert.deepEqual(
    missingSourceDeclaredCourses,
    [],
    [
      "Seattle demo majors should include every current source-declared UW course in both the expected and source-declared course lists.",
      `Missing: ${missingSourceDeclaredCourses.slice(0, 40).join(" | ")}`,
    ].join("\n")
  );
});

onlineDiagnosticTest(
  "generated demo diagnostics reject hard-dead Seattle sources and verify loadable live course overlap",
  async () => {
    await assertLiveDemoCourseOverlapForCampus({
      campusLabel: "Seattle",
      planIds: CURRENT_SEATTLE_PLAN_IDS,
      shouldSkipPlanId: isInactiveSeattleItalian,
    });
  }
);

test("generated demo diagnostics preserve Seattle source-reviewed course examples", () => {
  const expectedCoursesByPlanId = {
    "uw-seattle-biology": ["BIOC 405", "BIOC 406"],
    "uw-seattle-business-administration": ["ACCTG 215", "ACCTG 225"],
    "uw-seattle-computer-science": ["CSE 121", "CSE 123"],
    "uw-seattle-history": ["HSTRY 388", "HSTRY 498"],
    "uw-seattle-medical-laboratory-science": ["LABM 301", "MICROM 442"],
    "uw-seattle-psychology": ["PSYCH 101", "PSYCH 202"],
    "uw-seattle-spanish": ["SPAN 310", "SPAN 316"],
  };

  for (const [planId, courseCodes] of Object.entries(expectedCoursesByPlanId)) {
    assertDemoPreservesRawReviewCourses(planId, courseCodes);
  }
});

test("generated demo diagnostics include source-declared courses for every Tacoma major", () => {
  const missingCourseEvidence = [];
  const missingSourceDeclaredCourses = [];

  for (const planId of CURRENT_TACOMA_PLAN_IDS) {
    const programs = demoPayload.programsByPlanId[planId] ?? [];
    assert.ok(programs.length, `Expected a Tacoma demo review entry for ${planId}.`);

    const sourceDeclaredCourseCodes = [...getNormalizedCurrentSourceDeclaredCourseCodes(planId)];
    const demoExpectedCourses = collectNormalizedProgramCourseCodes(programs, "expectedCourseCodes");
    const demoSourceDeclaredCourses = collectNormalizedProgramCourseCodes(programs, "sourceDeclaredCourseCodes");

    if (!demoExpectedCourses.size) {
      missingCourseEvidence.push(planId);
    }

    const missingForProgram = sourceDeclaredCourseCodes.filter(
      (courseCode) => !demoExpectedCourses.has(courseCode) || !demoSourceDeclaredCourses.has(courseCode)
    );
    if (missingForProgram.length) {
      missingSourceDeclaredCourses.push(`${planId}: ${missingForProgram.join(", ")}`);
    }
  }

  assert.deepEqual(
    missingCourseEvidence,
    [],
    `Every Tacoma demo major should expose reviewed course evidence: ${missingCourseEvidence.join(", ")}`
  );
  assert.deepEqual(
    missingSourceDeclaredCourses,
    [],
    [
      "Tacoma demo majors should include every current source-declared UW course in both the expected and source-declared course lists.",
      `Missing: ${missingSourceDeclaredCourses.slice(0, 40).join(" | ")}`,
    ].join("\n")
  );
});

test("generated demo diagnostics preserve Tacoma source-reviewed course examples", () => {
  const expectedCoursesByPlanId = {
    "uw-tacoma-biomedical-sciences": ["TBIOL 260", "TBIOMD 410"],
    "uw-tacoma-computer-engineering": ["TCES 203", "TCSS 142", "TMATH 124", "TPHYS 121"],
    "uw-tacoma-history": ["THIST 380", "THIST 498"],
    "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed": ["TIAS 497"],
    "uw-tacoma-urban-studies": ["TGIS 311", "TURB 498"],
    "uw-tacoma-writing-studies": ["TWRT 121", "TWRT 492"],
  };

  for (const [planId, courseCodes] of Object.entries(expectedCoursesByPlanId)) {
    assertDemoPreservesRawReviewCourses(planId, courseCodes);
  }
});

onlineDiagnosticTest(
  "generated demo diagnostics reject hard-dead Tacoma sources and verify loadable live course overlap",
  async () => {
    await assertLiveDemoCourseOverlapForCampus({
      campusLabel: "Tacoma",
      planIds: CURRENT_TACOMA_PLAN_IDS,
    });
  }
);

test("generated demo diagnostics include source-declared courses for every Bothell major", () => {
  const missingCourseEvidence = [];
  const missingSourceDeclaredCourses = [];

  for (const planId of CURRENT_BOTHELL_PLAN_IDS) {
    const programs = demoPayload.programsByPlanId[planId] ?? [];
    assert.ok(programs.length, `Expected a Bothell demo review entry for ${planId}.`);

    const sourceDeclaredCourseCodes = [...getNormalizedCurrentSourceDeclaredCourseCodes(planId)];
    const demoExpectedCourses = collectNormalizedProgramCourseCodes(programs, "expectedCourseCodes");
    const demoSourceDeclaredCourses = collectNormalizedProgramCourseCodes(programs, "sourceDeclaredCourseCodes");

    if (!demoExpectedCourses.size) {
      missingCourseEvidence.push(planId);
    }

    const missingForProgram = sourceDeclaredCourseCodes.filter(
      (courseCode) => !demoExpectedCourses.has(courseCode) || !demoSourceDeclaredCourses.has(courseCode)
    );
    if (missingForProgram.length) {
      missingSourceDeclaredCourses.push(`${planId}: ${missingForProgram.join(", ")}`);
    }
  }

  assert.deepEqual(
    missingCourseEvidence,
    [],
    `Every Bothell demo major should expose reviewed course evidence: ${missingCourseEvidence.join(", ")}`
  );
  assert.deepEqual(
    missingSourceDeclaredCourses,
    [],
    [
      "Bothell demo majors should include every current source-declared UW course in both the expected and source-declared course lists.",
      `Missing: ${missingSourceDeclaredCourses.slice(0, 40).join(" | ")}`,
    ].join("\n")
  );
});

test("30 Bothell demo majors keep hand-reviewed official source evidence", () => {
  const currentBothellPlanIds = new Set(CURRENT_BOTHELL_PLAN_IDS);
  const samplePlanIds = new Set();
  const sampleProblems = [];

  for (const entry of AUDITED_BOTHELL_DEMO_LIVE_SOURCE_SAMPLE) {
    if (samplePlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: duplicated in audited sample`);
    }
    samplePlanIds.add(entry.planId);

    if (!currentBothellPlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: not a current Bothell planner major`);
    }

    if (!/^https:\/\/www\.uwb\.edu\//i.test(entry.sourceUrl)) {
      sampleProblems.push(`${entry.planId}: source is not a UW Bothell page (${entry.sourceUrl})`);
    }

    const sourceUrls = getDemoOfficialSources(entry.planId);
    if (!sourceUrls.includes(entry.sourceUrl)) {
      sampleProblems.push(`${entry.planId}: demo officialSources missing ${entry.sourceUrl}`);
    }

    const demoCourseCodes = new Set(getDemoCourseCodes(entry.planId));
    const missingDemoCourseCodes = entry.evidenceCourseCodes
      .map(normalizeOnlineCourseCode)
      .filter((courseCode) => !demoCourseCodes.has(courseCode));
    if (missingDemoCourseCodes.length) {
      sampleProblems.push(`${entry.planId}: demo missing ${missingDemoCourseCodes.join(", ")}`);
    }
  }

  assert.equal(
    AUDITED_BOTHELL_DEMO_LIVE_SOURCE_SAMPLE.length,
    30,
    "The Bothell human-review demo audit sample should cover exactly 30 individually checked majors."
  );
  assert.deepEqual(
    sampleProblems,
    [],
    [
      "The Bothell 30-major audit sample should be real: each entry must be a current major, keep an audited UW Bothell source URL, and preserve the checked course evidence.",
      `Problems: ${sampleProblems.join(" | ")}`,
    ].join("\n")
  );
});

onlineDiagnosticTest(
  "30 audited Bothell demo majors have live UW Bothell source course evidence when online diagnostics are enabled",
  async () => {
    const sourceProblems = [];

    for (const entry of AUDITED_BOTHELL_DEMO_LIVE_SOURCE_SAMPLE) {
      const expectedEvidenceCourseCodes = entry.evidenceCourseCodes.map(normalizeOnlineCourseCode);
      const allowedSubjects = new Set(
        expectedEvidenceCourseCodes.map((courseCode) =>
          courseCode.replace(/\s+\d{3}[A-Z]?$/, "")
        )
      );
      let sourceText = "";

      try {
        sourceText = await fetchDemoSourceEvidenceText(entry.sourceUrl);
      } catch (error) {
        sourceProblems.push(`${entry.planId}: failed to load ${entry.sourceUrl} (${error.message})`);
        continue;
      }

      const onlineCourseCodes = new Set(getOnlineCourseCodesFromText(sourceText, allowedSubjects));
      const missingOnlineCourseCodes = expectedEvidenceCourseCodes.filter(
        (courseCode) => !onlineCourseCodes.has(courseCode)
      );
      if (missingOnlineCourseCodes.length) {
        sourceProblems.push(
          `${entry.planId}: ${entry.sourceUrl} missing ${missingOnlineCourseCodes.join(", ")}`
        );
      }
    }

    assert.deepEqual(
      sourceProblems,
      [],
      [
        "The 30-major Bothell human-review demo sample should continue to match live official UW Bothell source pages.",
        `Problems: ${sourceProblems.join(" | ")}`,
      ].join("\n")
    );
  }
);

test("remaining Bothell demo majors keep hand-reviewed official source evidence", () => {
  const auditedThirtyPlanIds = new Set(
    AUDITED_BOTHELL_DEMO_LIVE_SOURCE_SAMPLE.map((entry) => entry.planId)
  );
  const remainingPlanIds = CURRENT_BOTHELL_PLAN_IDS.filter(
    (planId) => !auditedThirtyPlanIds.has(planId)
  );
  const currentBothellPlanIds = new Set(CURRENT_BOTHELL_PLAN_IDS);
  const samplePlanIds = new Set();
  const sampleProblems = [];

  for (const entry of AUDITED_REMAINING_BOTHELL_DEMO_LIVE_SOURCE_SAMPLE) {
    if (samplePlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: duplicated in remaining audited sample`);
    }
    samplePlanIds.add(entry.planId);

    if (!currentBothellPlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: not a current Bothell planner major`);
    }

    if (auditedThirtyPlanIds.has(entry.planId)) {
      sampleProblems.push(`${entry.planId}: already covered by the 30-major Bothell sample`);
    }

    if (!/^https:\/\/www\.uwb\.edu\//i.test(entry.sourceUrl)) {
      sampleProblems.push(`${entry.planId}: source is not a UW Bothell page (${entry.sourceUrl})`);
    }

    const sourceUrls = getDemoOfficialSources(entry.planId);
    if (!sourceUrls.includes(entry.sourceUrl)) {
      sampleProblems.push(`${entry.planId}: demo officialSources missing ${entry.sourceUrl}`);
    }

    const demoCourseCodes = new Set(getDemoCourseCodes(entry.planId));
    const missingDemoCourseCodes = entry.evidenceCourseCodes
      .map(normalizeOnlineCourseCode)
      .filter((courseCode) => !demoCourseCodes.has(courseCode));
    if (missingDemoCourseCodes.length) {
      sampleProblems.push(`${entry.planId}: demo missing ${missingDemoCourseCodes.join(", ")}`);
    }
  }

  assert.equal(
    AUDITED_REMAINING_BOTHELL_DEMO_LIVE_SOURCE_SAMPLE.length,
    remainingPlanIds.length,
    "The remaining Bothell audit sample should cover every current Bothell major not covered by the first 30-major sample."
  );
  assert.deepEqual(
    remainingPlanIds.filter((planId) => !samplePlanIds.has(planId)),
    [],
    "Every remaining Bothell major should have hand-reviewed official source evidence."
  );
  assert.deepEqual(
    sampleProblems,
    [],
    [
      "The remaining Bothell audit sample should be real: each entry must be a current uncovered major, keep an audited UW Bothell source URL, and preserve the checked course evidence.",
      `Problems: ${sampleProblems.join(" | ")}`,
    ].join("\n")
  );
});

test("audited Bothell demo source samples cover every current Bothell planner major", () => {
  const auditedPlanIds = new Set([
    ...AUDITED_BOTHELL_DEMO_LIVE_SOURCE_SAMPLE.map((entry) => entry.planId),
    ...AUDITED_REMAINING_BOTHELL_DEMO_LIVE_SOURCE_SAMPLE.map((entry) => entry.planId),
  ]);

  assert.deepEqual(
    CURRENT_BOTHELL_PLAN_IDS.filter((planId) => !auditedPlanIds.has(planId)),
    [],
    "The combined Bothell source audit samples should cover every current Bothell planner major."
  );
  assert.equal(
    auditedPlanIds.size,
    CURRENT_BOTHELL_PLAN_IDS.length,
    "The combined Bothell source audit samples should not duplicate or invent Bothell majors."
  );
});

test("Bothell official public variants stay mapped into the current demo audit count", () => {
  assert.equal(
    CURRENT_BOTHELL_PLAN_IDS.length,
    42,
    "The Bothell human-review demo audit should cover the 42 current planner majors after modeling the official ISS degree page."
  );
  assert.ok(
    CURRENT_BOTHELL_PLAN_IDS.includes("uw-bothell-interdisciplinary-studies-individualized-study"),
    "Expected UW Bothell Interdisciplinary Social Sciences / Individualized Study to be a current audited planner major."
  );
  assert.equal(
    CURRENT_BOTHELL_PLAN_IDS.includes("uw-bothell-chemistry-biochemistry"),
    false,
    "Chemistry: Biochemistry is an official catalog variant modeled as a Chemistry BS pathway, not a duplicate top-level major."
  );

  assert.ok(
    getDemoPublicMajorLabelEvidence("uw-bothell-interdisciplinary-studies-individualized-study").includes(
      normalizePublicMajorLabel("Interdisciplinary Social Sciences")
    ),
    "Expected the demo to preserve UW Bothell's current public ISS label."
  );
  assert.ok(
    getDemoPublicMajorLabelEvidence("uw-bothell-interdisciplinary-studies-individualized-study").includes(
      normalizePublicMajorLabel("Interdisciplinary Studies: Individualized Study")
    ),
    "Expected the demo to preserve the UW catalog ISS/Individualized Study label."
  );
  assert.ok(
    getDemoPublicMajorLabelEvidence("uw-bothell-chemistry-bs").includes(
      normalizePublicMajorLabel("Chemistry: Biochemistry")
    ),
    "Expected the demo to preserve the official Chemistry: Biochemistry public label under Chemistry BS."
  );
});

onlineDiagnosticTest(
  "UW Bothell public degree pages still list the modeled ISS and Chemistry Biochemistry variants",
  async () => {
    const [degreesText, catalogText] = await Promise.all([
      fetchDemoSourceEvidenceText(BOTHELL_PUBLIC_DEGREES_URL),
      fetchDemoSourceEvidenceText(BOTHELL_CATALOG_DEGREE_PROGRAMS_URL),
    ]);
    const degreesEvidence = normalizeTextEvidence(degreesText);
    const catalogEvidence = normalizeTextEvidence(catalogText);

    assert.ok(
      degreesEvidence.includes(normalizeTextEvidence("Interdisciplinary Social Sciences")),
      `Expected ${BOTHELL_PUBLIC_DEGREES_URL} to list Interdisciplinary Social Sciences.`
    );
    assert.ok(
      catalogEvidence.includes(normalizeTextEvidence("Interdisciplinary Studies: Individualized Study")),
      `Expected ${BOTHELL_CATALOG_DEGREE_PROGRAMS_URL} to list Interdisciplinary Studies: Individualized Study.`
    );
    assert.ok(
      catalogEvidence.includes(normalizeTextEvidence("Chemistry: Biochemistry")),
      `Expected ${BOTHELL_CATALOG_DEGREE_PROGRAMS_URL} to list Chemistry: Biochemistry.`
    );
  }
);

onlineDiagnosticTest(
  "remaining audited Bothell demo majors have live UW Bothell source course evidence when online diagnostics are enabled",
  async () => {
    const sourceProblems = [];

    for (const entry of AUDITED_REMAINING_BOTHELL_DEMO_LIVE_SOURCE_SAMPLE) {
      const expectedEvidenceCourseCodes = entry.evidenceCourseCodes.map(normalizeOnlineCourseCode);
      const allowedSubjects = new Set(
        expectedEvidenceCourseCodes.map((courseCode) =>
          courseCode.replace(/\s+\d{3}[A-Z]?$/, "")
        )
      );
      let sourceText = "";

      try {
        sourceText = await fetchDemoSourceEvidenceText(entry.sourceUrl);
      } catch (error) {
        sourceProblems.push(`${entry.planId}: failed to load ${entry.sourceUrl} (${error.message})`);
        continue;
      }

      const onlineCourseCodes = new Set(getOnlineCourseCodesFromText(sourceText, allowedSubjects));
      const missingOnlineCourseCodes = expectedEvidenceCourseCodes.filter(
        (courseCode) => !onlineCourseCodes.has(courseCode)
      );
      if (missingOnlineCourseCodes.length) {
        sourceProblems.push(
          `${entry.planId}: ${entry.sourceUrl} missing ${missingOnlineCourseCodes.join(", ")}`
        );
      }
    }

    assert.deepEqual(
      sourceProblems,
      [],
      [
        "The remaining Bothell human-review demo sample should continue to match live official UW Bothell HTML and PDF source pages.",
        `Problems: ${sourceProblems.join(" | ")}`,
      ].join("\n")
    );
  }
);

test("generated demo diagnostics avoid non-major and stale Bothell source URLs", () => {
  const invalidSourceEntries = [];

  for (const planId of CURRENT_BOTHELL_PLAN_IDS) {
    for (const url of getDemoOfficialSources(planId)) {
      if (NON_MAJOR_UW_DEMO_SOURCE_PATTERN.test(url)) {
        invalidSourceEntries.push(`${planId}: non-major source ${url}`);
      }
      if (url === STALE_BOTHELL_MECHANICAL_ENGINEERING_SOURCE_URL) {
        invalidSourceEntries.push(`${planId}: stale source ${url}`);
      }
    }
  }

  assert.deepEqual(
    invalidSourceEntries,
    [],
    [
      "Bothell demo officialSources should point at current major, department, catalog, or degree pages.",
      `Invalid source entries: ${invalidSourceEntries.join(" | ")}`,
    ].join("\n")
  );
});

onlineDiagnosticTest(
  "generated demo diagnostics reject hard-dead Bothell sources and verify loadable live course overlap",
  async () => {
    await assertLiveDemoCourseOverlapForCampus({
      campusLabel: "Bothell",
      planIds: CURRENT_BOTHELL_PLAN_IDS,
    });
  }
);

test("generated demo diagnostics preserve Bothell source-reviewed course examples", () => {
  const expectedCoursesByPlanId = {
    "uw-bothell-biology": ["B BIO 180", "B BIO 310"],
    "uw-bothell-business-administration": ["BBUS 210", "BBUS 402"],
    "uw-bothell-computer-engineering": ["BEE 215", "CSS 132"],
    "uw-bothell-csse": ["CSS 142", "CSS 342"],
    "uw-bothell-health-studies": ["BHLTH 301", "BHLTH 435"],
  };

  for (const [planId, courseCodes] of Object.entries(expectedCoursesByPlanId)) {
    assertDemoPreservesRawReviewCourses(planId, courseCodes);
  }
});
