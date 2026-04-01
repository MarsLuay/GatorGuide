import {
  TRANSFER_PLANNER_MASTER_BANK_LIBRARY,
  TRANSFER_PLANNER_MASTER_CHAIN_LIBRARY,
  TRANSFER_PLANNER_MASTER_MAJOR_ROWS,
  type TransferPlannerMasterBank,
  type TransferPlannerMasterChain,
  type TransferPlannerMasterMajorRow,
} from "./transfer-planner-master-generated";

export type TransferPlannerCampusId = "uw-seattle" | "uw-bothell" | "uw-tacoma";
export type TransferPlannerCoverage = "detailed" | "partial";
export type TransferPlannerSourceType = "detailed" | "master-generated";

export type TransferPlannerLink = {
  label: string;
  url: string;
  note?: string;
};

export type TransferPlannerChecklistItem = {
  id: string;
  title: string;
  grcCourses: string[];
  alternatives?: string[][];
  note?: string;
  minCompletedCount?: number;
};

export type TransferPlannerTrackTerm = {
  label: string;
  courses: string[];
};

export type TransferPlannerTrack = {
  id: string;
  code: string;
  title: string;
  summary: string;
  bestFor: string[];
  terms: TransferPlannerTrackTerm[];
  notes: string[];
};

export type TransferPlannerCampus = {
  id: TransferPlannerCampusId;
  title: string;
  summary: string;
  coverageNote: string;
  officialLinks: TransferPlannerLink[];
};

export type TransferPlannerMajorPlan = {
  id: string;
  campusId: TransferPlannerCampusId;
  title: string;
  shortTitle: string;
  coverage: TransferPlannerCoverage;
  summary: string;
  applicationWindow: string;
  startQuarter: string;
  bestTrackId: string | null;
  bestTrackSummary: string;
  whyThisTrack: string[];
  financialAidNote: string;
  applicationChecklist: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist: TransferPlannerChecklistItem[];
  stayAtGrcChecklist: TransferPlannerChecklistItem[];
  advisorFlags: string[];
  involvementIdeas: string[];
  projectIdeas: string[];
  officialLinks: TransferPlannerLink[];
  manualReviewNotes?: string[];
  family?: string;
  bankIds?: string[];
  chainIds?: string[];
  plannerNote?: string;
  sourceType?: TransferPlannerSourceType;
};

const STEM_CALCULUS_CURRENT_SEQUENCE = ["MATH& 151", "MATH& 152", "MATH& 163"];
const STEM_CALCULUS_OLDER_SEQUENCE = ["MATH& 151", "MATH& 152", "MATH& 153", "MATH& 254"];
const FULL_GENERAL_CHEMISTRY_SEQUENCE = ["CHEM& 161", "CHEM& 162", "CHEM& 163"];
const FULL_BIOLOGY_MAJORS_SEQUENCE = ["BIOL& 211", "BIOL& 212", "BIOL& 213"];
const STEM_CALCULUS_ALTERNATIVE_NOTE =
  "Current UW guidance accepts MATH& 163 for MATH 126. Older UW and Green River materials also use the MATH& 153 + MATH& 254 combination, which UW lists as transferring as MATH 126, 224, and 2XX credit when both courses are completed.";

const item = (
  id: string,
  title: string,
  grcCourses: string[],
  note?: string
): TransferPlannerChecklistItem => ({
  id,
  title,
  grcCourses,
  note,
});

const itemWithAlternatives = (
  id: string,
  title: string,
  grcCourses: string[],
  alternatives: string[][],
  note?: string
): TransferPlannerChecklistItem => ({
  id,
  title,
  grcCourses,
  alternatives,
  note,
});

const itemCount = (
  id: string,
  title: string,
  grcCourses: string[],
  minCompletedCount: number,
  note?: string
): TransferPlannerChecklistItem => ({
  id,
  title,
  grcCourses,
  note,
  minCompletedCount,
});

const itemAny = (
  id: string,
  title: string,
  grcCourses: string[],
  note?: string
): TransferPlannerChecklistItem => itemCount(id, title, grcCourses, 1, note);

const itemCountWithAlternatives = (
  id: string,
  title: string,
  grcCourses: string[],
  alternatives: string[][],
  minCompletedCount: number,
  note?: string
): TransferPlannerChecklistItem => ({
  id,
  title,
  grcCourses,
  alternatives,
  note,
  minCompletedCount,
});

const itemStemCalcSequence = (
  id: string,
  title: string,
  note = STEM_CALCULUS_ALTERNATIVE_NOTE
): TransferPlannerChecklistItem =>
  itemWithAlternatives(
    id,
    title,
    STEM_CALCULUS_CURRENT_SEQUENCE,
    [STEM_CALCULUS_OLDER_SEQUENCE],
    note
  );

const itemStemCalcCredits = (
  id: string,
  title: string,
  minCompletedCount: number,
  note = STEM_CALCULUS_ALTERNATIVE_NOTE
): TransferPlannerChecklistItem =>
  itemCountWithAlternatives(
    id,
    title,
    STEM_CALCULUS_CURRENT_SEQUENCE,
    [STEM_CALCULUS_OLDER_SEQUENCE],
    minCompletedCount,
    note
  );

export const TRANSFER_PLANNER_CAMPUSES: TransferPlannerCampus[] = [
  {
    id: "uw-seattle",
    title: "UW Seattle",
    summary:
      "Most complete v1 dataset. These plans combine Green River sample transfer tracks, the UW Green River equivalency guide, and current department transfer pages.",
    coverageNote:
      "Use this when you want the most detailed Green River -> UW planning guidance inside the app.",
    officialLinks: [
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
      {
        label: "UW engineering prerequisites by major",
        url: "https://www.engr.washington.edu/admission/department/prereqs-by-major",
      },
      {
        label: "Green River sample transfer plans PDF",
        url: "https://www.greenriver.edu/marketing/media/documents/grad-to-gator/Associate%20Transfer%20Sample%20Ed%20Plans%202024.pdf",
      },
    ],
  },
  {
    id: "uw-bothell",
    title: "UW Bothell",
    summary:
      "Planning-start dataset. The app can point students to the strongest Green River base track and official Bothell worksheets, but advisor review is still needed for final degree planning.",
    coverageNote:
      "Bothell support is useful for track selection and source links, but it is not a final audit yet.",
    officialLinks: [
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
      {
        label: "UW Bothell major planning worksheets",
        url: "https://www.uwb.edu/admissions/apply/major-planning-worksheets",
      },
      {
        label: "UW Bothell STEM transfer course guide",
        url: "https://www.uwb.edu/stem/undergraduate/resources/stem-transfer-courses",
      },
    ],
  },
  {
    id: "uw-tacoma",
    title: "UW Tacoma",
    summary:
      "Planning-start dataset. Tacoma is included so students can pick the right Green River base track, but Tacoma-specific major review should still happen with official program materials.",
    coverageNote:
      "Tacoma support is intentionally conservative because Tacoma's equivalency guidance is less centralized right now.",
    officialLinks: [
      {
        label: "UW Tacoma transfer planning",
        url: "https://www.tacoma.uw.edu/admissions/planning-your-transfer",
      },
      {
        label: "UW Tacoma course equivalency guide",
        url: "https://www.tacoma.uw.edu/admissions/course-equivalency-guide",
      },
      {
        label: "UW Tacoma majors and degrees",
        url: "https://www.tacoma.uw.edu/admissions/majors-degrees",
      },
    ],
  },
];

export const TRANSFER_PLANNER_TRACKS: TransferPlannerTrack[] = [
  {
    id: "999B",
    code: "999B",
    title: "AST2 Engineering / Computer Science Base",
    summary:
      "The Green River Associate in Science Transfer Track 2 base used for engineering, computer science, physics, and related math-heavy transfer paths.",
    bestFor: ["engineering", "computer science", "physics"],
    terms: [
      { label: "Year 1 Fall", courses: ["ENGL& 101", "MATH& 151", "ENGR 100"] },
      { label: "Year 1 Winter", courses: ["CHEM& 161", "MATH& 152", "ENGR 106"] },
      { label: "Year 1 Spring", courses: ["CHEM& 162", "MATH& 163", "Humanities"] },
      { label: "Year 2 Fall", courses: ["PHYS& 221", "MATH& 254", "ENGR& 214"] },
      { label: "Year 2 Winter", courses: ["PHYS& 222", "MATH 238", "ENGR& 215"] },
      { label: "Year 2 Spring", courses: ["PHYS& 223", "MATH 240", "Social Science"] },
    ],
    notes: [
      "Useful as the shared backbone behind several engineering pathways.",
      "Most Seattle engineering majors still need a more specific MRP or custom add-on set on top of this base.",
      "Older sample plans may still show MATH& 153 before MATH& 254. The current direct UW MATH 126 path uses MATH& 163 instead.",
    ],
  },
  {
    id: "999Q",
    code: "999Q",
    title: "AST2 / MRP Civil and Mechanical Engineering",
    summary:
      "The strongest stock Green River path for UW Seattle aeronautics, civil, industrial, materials, and mechanical planning.",
    bestFor: [
      "aeronautics",
      "civil engineering",
      "industrial engineering",
      "materials science",
      "mechanical engineering",
    ],
    terms: [
      { label: "Year 1 Fall", courses: ["ENGL& 101", "MATH& 151", "ENGR 100"] },
      { label: "Year 1 Winter", courses: ["CHEM& 161", "MATH& 152", "ENGR 106"] },
      { label: "Year 1 Spring", courses: ["CHEM& 162", "MATH& 163", "Humanities"] },
      { label: "Year 2 Fall", courses: ["PHYS& 221", "MATH& 254", "ENGR& 214"] },
      { label: "Year 2 Winter", courses: ["PHYS& 222", "MATH 238", "ENGR& 215"] },
      { label: "Year 2 Spring", courses: ["PHYS& 223", "MATH 240", "Social Science"] },
      { label: "Year 3 Fall", courses: ["ENGR& 225", "Select course from list"] },
      { label: "Year 3 Winter", courses: ["Humanities or Social Science", "Select course from list"] },
    ],
    notes: [
      "Use the elective slots intentionally for add-ons like ENGR& 224, ENGR 250, or programming.",
      "This track is especially good when you want to maximize financial-aid-safe engineering credits at Green River.",
      "Older sample plans may still show MATH& 153 before MATH& 254. The current direct UW MATH 126 path uses MATH& 163 instead.",
    ],
  },
  {
    id: "999P",
    code: "999P",
    title: "AST2 / MRP Computer and Electrical Engineering",
    summary:
      "The cleanest stock Green River path for UW Seattle Computer Engineering and Electrical & Computer Engineering.",
    bestFor: ["computer engineering", "electrical engineering", "ece", "computing"],
    terms: [
      { label: "Year 1 Fall", courses: ["ENGL& 101", "MATH& 151", "ENGR 100"] },
      { label: "Year 1 Winter", courses: ["CHEM& 161", "MATH& 152", "Humanities"] },
      { label: "Year 1 Spring", courses: ["CS 121", "MATH& 163", "Social Science", "ENGR 106"] },
      { label: "Year 2 Fall", courses: ["PHYS& 221", "MATH& 254 if you are finishing the older Calc III path", "CS 122"] },
      { label: "Year 2 Winter", courses: ["PHYS& 222", "MATH 238", "CS 123"] },
      { label: "Year 2 Spring", courses: ["PHYS& 223", "ENGR& 204", "Humanities or Social Science"] },
      { label: "Year 3 Fall", courses: ["Select course from list", "Select course from list"] },
    ],
    notes: [
      "This is the best stock fit when the destination major needs the full CS 121 / 122 / 123 sequence.",
      "It also keeps physics, higher math, and circuit preparation aligned with UW engineering expectations.",
      "Current UW guidance maps MATH& 163 cleanly to UW MATH 126. Older planning materials may still show the alternative MATH& 153 + MATH& 254 route.",
    ],
  },
  {
    id: "999O",
    code: "999O",
    title: "AST2 / MRP Bioengineering and Chemical Engineering",
    summary:
      "Useful as the chemistry-heavy starting point for Bioengineering and Chemical Engineering, but neither Seattle major should rely on this track alone without custom add-ons.",
    bestFor: ["bioengineering", "chemical engineering"],
    terms: [
      {
        label: "Year 1 Fall",
        courses: ["ENGL& 101", "MATH& 151", "CHEM& 161 or CHEM& 140 if required"],
      },
      {
        label: "Year 1 Winter",
        courses: ["ENGR 100", "MATH& 152", "CHEM& 162", "Humanities or Social Science"],
      },
      { label: "Year 1 Spring", courses: ["MATH& 163", "CHEM& 163"] },
      { label: "Year 2 Fall", courses: ["PHYS& 221", "MATH& 254", "CHEM& 261"] },
      { label: "Year 2 Winter", courses: ["PHYS& 222", "MATH 238", "BIOL& 260 or CHEM& 262"] },
      { label: "Year 2 Spring", courses: ["PHYS& 223", "Humanities or Social Science", "Select course from list"] },
      { label: "Year 3 Fall", courses: ["Select course from list", "Select course from list"] },
    ],
    notes: [
      "BioE now needs biology plus programming decisions beyond the stock PDF path.",
      "ChemE has spring-start timing, so term planning should be treated separately from a normal autumn engineering transfer.",
      "Older sample plans may still show MATH& 153 before MATH& 254. The current direct UW MATH 126 path uses MATH& 163 instead.",
    ],
  },
];

export const TRANSFER_PLANNER_INVOLVEMENT_LINKS: TransferPlannerLink[] = [
  {
    label: "Green River MESA",
    url: "https://www.greenriver.edu/students/academics/areas-of-interest/stem-and-health-sciences/mesa.html",
    note: "Best first stop for STEM community, mentoring, tutoring, and transfer-strengthening involvement.",
  },
  {
    label: "Green River clubs and organizations",
    url: "https://www.greenriver.edu/students/get-involved/clubs-and-organizations/",
    note: "Good for leadership roles, club projects, and application-strengthening involvement.",
  },
  {
    label: "Green River student leadership",
    url: "https://www.greenriver.edu/students/get-involved/student-leadership/index.html",
    note: "Use this if the student wants formal leadership experience on top of coursework.",
  },
  {
    label: "Green River engineering program overview",
    url: "https://www.greenriver.edu/students/academics/degrees-programs/engineering.html",
    note: "Helpful for confirming the public-facing Green River engineering track structure.",
  },
];

export const TRANSFER_PLANNER_MAJOR_PLANS: TransferPlannerMajorPlan[] = [
  {
    id: "uw-seattle-computer-engineering",
    campusId: "uw-seattle",
    title: "Computer Engineering",
    shortTitle: "CompE",
    coverage: "detailed",
    summary:
      "Best current stock fit: Green River's 999P pathway plus the full CS sequence. This is one of the cleaner Green River -> UW mappings in the whole tool.",
    applicationWindow:
      "Apply to UW by the standard transfer cycle, then Allen by January 15 for spring or April 5 for autumn.",
    startQuarter: "Spring or autumn",
    bestTrackId: "999P",
    bestTrackSummary:
      "999P is the Green River path that best lines up with UW Computer Engineering.",
    whyThisTrack: [
      "It preserves the CS 121 / 122 / 123 sequence at Green River.",
      "It keeps calculus and physics moving without forcing the student off a valid engineering pathway.",
      "It minimizes random off-track classes that can create financial-aid headaches.",
    ],
    financialAidNote:
      "If you are still choosing between Computer Engineering and ECE, 999P is the best path to keep both options open.",
    applicationChecklist: [
      itemStemCalcSequence("calc123", "MATH 124, 125, 126"),
      item("cs123", "CSE 143 or CSE 123", ["CS 121", "CS 122", "CS 123"], "Allen strongly prefers the full modern CS intro sequence."),
      item("phys121", "PHYS 121", ["PHYS& 221"]),
      item("engl101", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [
      item("phys122", "PHYS 122 if you want a stronger launch", ["PHYS& 222"], "Not the minimum Allen floor, but it strengthens the engineering start."),
      item("math207", "MATH 207 for engineering flexibility", ["MATH 238"], "Useful if the student is still comparing Allen CompE and ECE."),
    ],
    stayAtGrcChecklist: [
      item("phys123", "PHYS 123 if time and aid allow", ["PHYS& 223"]),
      item("engr204", "Circuit analysis head start", ["ENGR& 204"], "Helpful if the student may pivot toward ECE."),
    ],
    advisorFlags: [
      "Allen is extremely competitive even when prerequisites are finished.",
      "Use advisor review if a student plans to submit with one in-progress prerequisite exception.",
    ],
    involvementIdeas: [
      "Push MESA first, then a project-heavy club where the student can show real technical work.",
      "Encourage one role that demonstrates teamwork or mentoring, not just coursework.",
    ],
    projectIdeas: [
      "Build a microcontroller project with sensors, logging, and a simple PCB or breadboard demo.",
      "Create a Java or C++ data-structures style project that looks stronger than a one-class assignment.",
      "Pair a hardware project with documentation, testing notes, and a short demo video for transfer applications or internships.",
    ],
    officialLinks: [
      {
        label: "Allen School transfer admissions",
        url: "https://www.cs.washington.edu/academics/undergraduate/admissions/transfers/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
  },
  {
    id: "uw-seattle-computer-science",
    campusId: "uw-seattle",
    title: "Computer Science",
    shortTitle: "CS",
    coverage: "detailed",
    summary:
      "Allen School CS uses the same transfer source page as CompE, so the Green River planning logic is very similar: strong programming sequence, calculus, composition, and at least the first physics course.",
    applicationWindow:
      "Apply to UW by the standard transfer cycle, then Allen by January 15 for spring or April 5 for autumn.",
    startQuarter: "Spring or autumn",
    bestTrackId: "999P",
    bestTrackSummary:
      "999P is still the safest Green River path when you want full programming depth while keeping strong STEM momentum.",
    whyThisTrack: [
      "It gives the student the cleanest CS 121 / 122 / 123 preparation.",
      "It keeps math intensity high enough for Allen and other engineering options.",
      "It is easier to explain to advisors than a patchwork of unrelated electives.",
    ],
    financialAidNote:
      "If the student is mostly CS-focused but still wants engineering backup options, 999P is a better Green River anchor than a looser custom schedule.",
    applicationChecklist: [
      itemStemCalcSequence("calc123", "MATH 124, 125, 126"),
      item("cs123", "CSE 143 or CSE 123", ["CS 121", "CS 122", "CS 123"]),
      item("engl101", "English composition", ["ENGL& 101"]),
      item("phys121", "PHYS 121", ["PHYS& 221"], "Allen lists PHYS 121 on the transfer preparation path."),
    ],
    beforeEnrollmentChecklist: [
      item("phys122", "PHYS 122 if you want stronger technical depth", ["PHYS& 222"]),
      item("math207", "Differential equations for flexibility", ["MATH 238"]),
    ],
    stayAtGrcChecklist: [
      item("phys123", "PHYS 123 if the student is also keeping engineering options open", ["PHYS& 223"]),
    ],
    advisorFlags: [
      "This is still a very selective transfer path.",
      "Use current Allen advising guidance before telling a student a single path guarantees admission readiness.",
    ],
    involvementIdeas: [
      "Pair coursework with a visible programming project or club contribution.",
      "MESA plus one leadership or tutoring role usually looks stronger than coursework alone.",
    ],
    projectIdeas: [
      "Build a polished Java or TypeScript project with tests, documentation, and a deployed demo.",
      "Create a student-life tool for Green River, such as a planner, tutoring board, or campus info dashboard.",
      "Contribute to a club or advisor-requested technical project instead of only doing solo class work.",
    ],
    officialLinks: [
      {
        label: "Allen School transfer admissions",
        url: "https://www.cs.washington.edu/academics/undergraduate/admissions/transfers/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
  },
  {
    id: "uw-seattle-electrical-computer-engineering",
    campusId: "uw-seattle",
    title: "Electrical & Computer Engineering",
    shortTitle: "ECE",
    coverage: "detailed",
    summary:
      "ECE is another strong 999P match. The path works especially well when the student wants Green River programming, physics, higher math, and circuit prep before transferring.",
    applicationWindow: "Department application deadline: April 5 for autumn entry.",
    startQuarter: "Autumn",
    bestTrackId: "999P",
    bestTrackSummary:
      "999P lines up well with CSE preparation, higher math, physics, and circuit work without forcing a custom off-track schedule too early.",
    whyThisTrack: [
      "It supports either CSE 122 or CSE 123-level preparation at Green River.",
      "It already keeps PHYS and differential equations moving in the right direction.",
      "It is the cleanest shared Green River launchpad for ECE and CompE.",
    ],
    financialAidNote:
      "999P is the easiest Green River degree story to defend if the student is using aid and still deciding between ECE and Computer Engineering.",
    applicationChecklist: [
      itemStemCalcSequence("calc123", "MATH 124, 125, 126"),
      itemCount("cse122or123", "CSE 122 or CSE 123", ["CS 121", "CS 122", "CS 123"], 2, "Completing the full three-course sequence is the safest Green River option."),
      item("phys121-122", "PHYS 121 and PHYS 122", ["PHYS& 221", "PHYS& 222"]),
      item("engl101", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [
      item("math207", "MATH 207 or AMATH 351", ["MATH 238"]),
      item("cse123", "CSE 123 or equivalent strongest programming finish", ["CS 123"]),
      itemCount("science-two", "Two additional science / math depth options", ["CHEM& 161", "PHYS& 223", "MATH 240", "MATH& 254"], 2, "ECE accepts several second-tier science and math options; these Green River classes are the cleanest substitutes."),
    ],
    stayAtGrcChecklist: [
      item("engr204", "Circuit analysis head start", ["ENGR& 204"]),
      item("phys123", "PHYS 123 if possible before transfer", ["PHYS& 223"]),
    ],
    advisorFlags: [
      "ECE allows multiple science / math combinations after the core prerequisite set.",
      "Use advisor review if the student wants the lightest possible science mix versus the strongest long-term engineering prep.",
    ],
    involvementIdeas: [
      "Push one hardware, robotics, or systems project plus MESA or leadership.",
      "If possible, give the student something with hardware, electronics, or systems thinking instead of only programming.",
    ],
    projectIdeas: [
      "Build a sensor or robotics project with basic circuit design and data logging.",
      "Create an embedded-systems portfolio piece that mixes code, hardware, and documentation.",
      "Use ENGR& 204 work as a stepping stone to a cleaner electronics demo or systems project.",
    ],
    officialLinks: [
      {
        label: "UW ECE admission requirements",
        url: "https://www.ece.washington.edu/academics/bachelor-of-science/bs-admissions-requirements/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
  },
  {
    id: "uw-seattle-mechanical-engineering",
    campusId: "uw-seattle",
    title: "Mechanical Engineering",
    shortTitle: "ME",
    coverage: "detailed",
    summary:
      "Mechanical Engineering is a strong 999Q fit. The main planning move is making sure the student intentionally adds second-quarter chemistry and linear algebra instead of assuming the stock track solves everything.",
    applicationWindow: "Department application deadline: April 5 for autumn entry.",
    startQuarter: "Autumn",
    bestTrackId: "999Q",
    bestTrackSummary:
      "999Q keeps the statics / dynamics / mechanics backbone aligned with UW while staying inside a clean Green River engineering MRP.",
    whyThisTrack: [
      "It already carries A A 210, M E 230, and CEE 220 equivalents at Green River.",
      "It keeps physics and calculus sequencing strong.",
      "It is the best financial-aid-safe foundation for most traditional engineering majors at UW Seattle.",
    ],
    financialAidNote:
      "Use 999Q as the base, then deliberately place chemistry depth and linear algebra into approved slots so the student does not drift into random extra credits.",
    applicationChecklist: [
      item("engl101", "English composition", ["ENGL& 101"]),
      itemStemCalcSequence("calc123", "MATH 124, 125, 126"),
      item("phys121-122", "PHYS 121 and PHYS 122", ["PHYS& 221", "PHYS& 222"]),
      item("chem142", "CHEM 142", ["CHEM& 161"]),
      item("aa210", "A A 210", ["ENGR& 214"]),
    ],
    beforeEnrollmentChecklist: [
      item("chem152", "CHEM 152", ["CHEM& 162", "CHEM& 163"], "The current equivalency guide treats the GRC CHEM& 162 + 163 pair as UW's later chemistry sequence."),
      item("cee220", "CEE 220", ["ENGR& 225"]),
      item("me230", "M E 230", ["ENGR& 215"]),
      item("phys123", "PHYS 123", ["PHYS& 223"]),
    ],
    stayAtGrcChecklist: [
      item("math207", "MATH 207 strongly encouraged", ["MATH 238"]),
      item("math208", "MATH 208 strongly encouraged", ["MATH 240"]),
    ],
    advisorFlags: [
      "Older Green River sample plans may still show MATH& 153 where the current equivalency guide now points students toward MATH& 163 for a clean MATH 126 match.",
      "Students who stop after CHEM& 162 may be underprepared for the stronger ME launch.",
    ],
    involvementIdeas: [
      "Encourage one build-focused club or maker-style activity along with MESA.",
      "Leadership experience matters, but ME students also benefit from something tangible they designed or built.",
    ],
    projectIdeas: [
      "Build a CAD plus fabrication portfolio piece, such as a small mechanism, bracket system, or competition-style device.",
      "Document a statics / dynamics inspired design project with calculations, sketches, and iteration notes.",
      "Pair a design project with a club or leadership role so the student has both technical and collaborative evidence.",
    ],
    officialLinks: [
      {
        label: "UW Mechanical Engineering admissions",
        url: "https://www.me.washington.edu/bsme/admissions",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
  },
  {
    id: "uw-seattle-civil-engineering",
    campusId: "uw-seattle",
    title: "Civil Engineering",
    shortTitle: "Civil",
    coverage: "detailed",
    summary:
      "Civil uses the same 999Q backbone as Mechanical and A&A, but students need to deliberately include computing so the path is not just a mechanics-heavy PDF copy.",
    applicationWindow: "Department application deadline: April 5 for autumn entry.",
    startQuarter: "Autumn",
    bestTrackId: "999Q",
    bestTrackSummary:
      "999Q handles the civil mechanics foundation well, then the planner layers in programming and extra math intentionally.",
    whyThisTrack: [
      "Statics, dynamics, and mechanics of materials all map cleanly through Green River engineering.",
      "The track keeps students inside a credible engineering MRP.",
      "It gives enough room to add programming without abandoning the Green River base.",
    ],
    financialAidNote:
      "The main risk is forgetting to place a computing course into the plan early enough; keep that add-on visible from the start.",
    applicationChecklist: [
      itemStemCalcSequence("calc123", "MATH 124, 125, 126"),
      item("chem142", "CHEM 142", ["CHEM& 161"]),
      item("phys121-122", "PHYS 121 and PHYS 122", ["PHYS& 221", "PHYS& 222"]),
      item("aa210", "A A 210", ["ENGR& 214"]),
      item("engl101", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [
      itemAny("computing", "One approved computing course", ["ENGR 250", "CS 121", "CS 122", "CS 123"], "UW Civil accepts several computing paths; these are the cleanest Green River choices."),
      item("cee220", "CEE 220", ["ENGR& 225"]),
      item("me230", "M E 230", ["ENGR& 215"]),
      item("math208", "MATH 208 or AMATH 352", ["MATH 240"]),
    ],
    stayAtGrcChecklist: [
      item("chem152", "CHEM 152 strongly recommended", ["CHEM& 162", "CHEM& 163"]),
      item("phys123", "PHYS 123 strongly recommended", ["PHYS& 223"]),
    ],
    advisorFlags: [
      "Civil looks simple on paper, but students can still miss the computing requirement if the plan is copied too literally from an older MRP sheet.",
    ],
    involvementIdeas: [
      "Leadership plus community-facing projects can fit Civil well.",
      "Push students toward work that shows teamwork, documentation, and practical design thinking.",
    ],
    projectIdeas: [
      "Create a transportation, water, or site-planning mini project with calculations and a short written report.",
      "Use Excel, Python, or another simple tool to model loads, traffic flow, or environmental constraints.",
      "Document a community-impact idea instead of only a theoretical class project.",
    ],
    officialLinks: [
      {
        label: "UW Civil Engineering prerequisites",
        url: "https://www.ce.washington.edu/future/undergrad/prereq",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
  },
  {
    id: "uw-seattle-aeronautics-astronautics",
    campusId: "uw-seattle",
    title: "Aeronautics & Astronautics",
    shortTitle: "A&A",
    coverage: "detailed",
    summary:
      "A&A is another strong 999Q path, but students should use the upper slots aggressively for thermodynamics and scientific computing so more lower-division engineering stays at Green River.",
    applicationWindow: "Department application deadline: April 5 for autumn entry.",
    startQuarter: "Autumn",
    bestTrackId: "999Q",
    bestTrackSummary:
      "999Q gives the right mechanics foundation, then the student should use elective space for ENGR& 224 and ENGR 250 whenever possible.",
    whyThisTrack: [
      "The A&A statics / dynamics / mechanics core maps well from Green River engineering.",
      "It keeps the student on a clean engineering MRP instead of a scattered custom path.",
      "It leaves room for major-specific add-ons in the extra slots.",
    ],
    financialAidNote:
      "A&A works best when the student treats the list-based slots as intentional placeholders for ENGR& 224 and ENGR 250 rather than letting them fill with low-value random electives.",
    applicationChecklist: [
      itemStemCalcSequence("calc123", "MATH 124, 125, 126"),
      item("chem142", "CHEM 142", ["CHEM& 161"]),
      item("phys121-122", "PHYS 121 and PHYS 122", ["PHYS& 221", "PHYS& 222"]),
      item("aa210", "A A 210", ["ENGR& 214"]),
      item("engl101", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [
      item("math207", "MATH 207", ["MATH 238"]),
      item("math208", "MATH 208", ["MATH 240"]),
      item("math224", "MATH 224", ["MATH& 254"]),
      item("phys123", "PHYS 123", ["PHYS& 223"]),
      item("cee220", "CEE 220", ["ENGR& 225"]),
      item("me230", "M E 230", ["ENGR& 215"]),
      item("aa260", "A A 260", ["ENGR& 224"]),
      item("amath301", "AMATH 301", ["ENGR 250"]),
    ],
    stayAtGrcChecklist: [
      item("engr224", "Thermodynamics before transfer if possible", ["ENGR& 224"]),
      item("engr250", "Scientific computing before transfer if possible", ["ENGR 250"]),
    ],
    advisorFlags: [
      "UW notes that one of MATH 224 or AMATH 301 may still be taken in the first autumn if needed, but the planner should still push students to finish both at Green River when possible.",
    ],
    involvementIdeas: [
      "Push build-heavy teamwork, MESA, and anything that shows sustained engineering curiosity.",
      "A&A applicants benefit from projects that look applied rather than purely theoretical.",
    ],
    projectIdeas: [
      "Build a lightweight design or flight-stability project and document the design tradeoffs.",
      "Create a Python or spreadsheet simulation for motion, drag, or simple orbital / trajectory concepts.",
      "Use CAD plus a short test-and-iteration log to show engineering process, not just a final artifact.",
    ],
    officialLinks: [
      {
        label: "UW Aeronautics & Astronautics admissions",
        url: "https://www.aa.washington.edu/admissions/undergrad/overview",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
  },
  {
    id: "uw-seattle-industrial-systems-engineering",
    campusId: "uw-seattle",
    title: "Industrial & Systems Engineering",
    shortTitle: "ISE",
    coverage: "detailed",
    summary:
      "ISE is a 999Q fit, but the cleanest plan explicitly adds programming and linear algebra so the student is not underprepared for the more systems-oriented side of the major.",
    applicationWindow: "Department application deadline: April 5 for autumn entry.",
    startQuarter: "Autumn",
    bestTrackId: "999Q",
    bestTrackSummary:
      "999Q handles the standard engineering backbone, then the planner adds programming and extra math for competitiveness.",
    whyThisTrack: [
      "It covers the same base engineering progression as other mechanics-heavy Seattle majors.",
      "It still leaves room for the programming and math add-ons ISE likes.",
    ],
    financialAidNote:
      "ISE planning usually stays aid-safe if programming is added intentionally rather than as a last-minute unrelated extra.",
    applicationChecklist: [
      itemStemCalcSequence("calc123", "MATH 124, 125, 126"),
      item("chem142", "CHEM 142", ["CHEM& 161"]),
      item("phys121-122", "PHYS 121 and PHYS 122", ["PHYS& 221", "PHYS& 222"]),
      item("aa210", "A A 210", ["ENGR& 214"]),
      item("engl101", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [
      item("chem152", "CHEM 152", ["CHEM& 162", "CHEM& 163"]),
      item("phys123", "PHYS 123", ["PHYS& 223"]),
      itemAny("cee220orme230", "CEE 220 or M E 230", ["ENGR& 225", "ENGR& 215"]),
    ],
    stayAtGrcChecklist: [
      item("cse122", "Programming strongly recommended", ["CS 121", "CS 122"]),
      item("math207", "MATH 207 strongly recommended", ["MATH 238"]),
      item("math208", "MATH 208 strongly recommended", ["MATH 240"]),
    ],
    advisorFlags: [
      "ISE can look deceptively simple if a student only copies a stock 999Q sheet and skips the competitiveness add-ons.",
    ],
    involvementIdeas: [
      "Leadership, logistics, tutoring, and operations-oriented projects fit ISE well.",
      "Students should show systems thinking, not only raw math completion.",
    ],
    projectIdeas: [
      "Create an operations-improvement or scheduling project tied to a real student workflow.",
      "Use data to improve a process, queue, or resource-allocation problem and document the before/after logic.",
      "Build something that mixes analytics, process mapping, and stakeholder communication.",
    ],
    officialLinks: [
      {
        label: "UW Industrial & Systems Engineering admissions",
        url: "https://ise.washington.edu/admissions/BSIE/req_procedure",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
  },
  {
    id: "uw-seattle-materials-science-engineering",
    campusId: "uw-seattle",
    title: "Materials Science & Engineering",
    shortTitle: "MSE",
    coverage: "detailed",
    summary:
      "MSE starts from 999Q, but ENGR 140 plus programming and chemistry depth are what make the plan truly major-ready instead of just generally engineering-ready.",
    applicationWindow: "Department application deadline: April 5 for autumn entry.",
    startQuarter: "Autumn",
    bestTrackId: "999Q",
    bestTrackSummary:
      "999Q is still the best Green River base, but students should treat ENGR 140 and chemistry depth as essential add-ons, not optional extras.",
    whyThisTrack: [
      "The math / physics / mechanics backbone still fits well.",
      "Green River has useful lower-division substitutes for several MSE-adjacent prep courses.",
    ],
    financialAidNote:
      "MSE works best when the student keeps 999Q as the declared path and uses add-on slots for materials-specific prep rather than layering random extra science classes.",
    applicationChecklist: [
      itemStemCalcSequence("calc123", "MATH 124, 125, 126"),
      item("chem142-152", "CHEM 142 and CHEM 152", ["CHEM& 161", "CHEM& 162", "CHEM& 163"]),
      item("phys121-122", "PHYS 121 and PHYS 122", ["PHYS& 221", "PHYS& 222"]),
      item("engl101", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [
      item("math207", "MATH 207", ["MATH 238"]),
      item("mse170", "MSE 170", ["ENGR 140"]),
      itemAny("programming", "One programming course", ["ENGR 250", "CS 122"]),
    ],
    stayAtGrcChecklist: [
      item("chem162depth", "CHEM 162 depth", ["CHEM& 163"]),
      item("math208", "MATH 208", ["MATH 240"]),
      item("aa210", "A A 210 encouraged", ["ENGR& 214"]),
      item("cee220", "CEE 220 encouraged", ["ENGR& 225"]),
      item("phys123", "PHYS 123 encouraged", ["PHYS& 223"]),
    ],
    advisorFlags: [
      "Do not let students assume the standard mechanics-heavy engineering plan automatically covers the materials-specific prep.",
    ],
    involvementIdeas: [
      "Encourage projects that show curiosity about materials, fabrication, testing, or product behavior.",
    ],
    projectIdeas: [
      "Build a simple materials comparison project that documents fabrication limits, cost, and performance tradeoffs.",
      "Create a small product or component and compare materials choices with written reasoning.",
      "Pair CAD or prototyping work with a reflection on why one material system was selected over another.",
    ],
    officialLinks: [
      {
        label: "UW Materials Science & Engineering admissions",
        url: "https://mse.washington.edu/admission/undergraduate",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
  },
  {
    id: "uw-seattle-chemical-engineering",
    campusId: "uw-seattle",
    title: "Chemical Engineering",
    shortTitle: "ChemE",
    coverage: "detailed",
    summary:
      "ChemE is the clearest custom path in the whole planner. It is spring-start, applies in January, and should not be treated like a normal autumn engineering roadmap.",
    applicationWindow:
      "Apply to UW by December 15, then submit the ChemE department application by January 15.",
    startQuarter: "Spring cohort",
    bestTrackId: "999O",
    bestTrackSummary:
      "Use 999O only as the chemistry-heavy base. The actual ChemE plan must still be customized around the spring start and January deadline.",
    whyThisTrack: [
      "Green River chemistry, physics, and math can cover a large share of early ChemE preparation.",
      "The department already publishes a Green River sample plan, which makes this a good candidate for a curated advisor-reviewed roadmap.",
    ],
    financialAidNote:
      "ChemE planning should keep students inside the 999O chemistry-heavy path while deliberately timing MATH 238, organic chemistry, and ENGR 250 so the spring-start window still works.",
    applicationChecklist: [
      item(
        "chem142-162",
        "CHEM 142, 152, 162",
        FULL_GENERAL_CHEMISTRY_SEQUENCE,
        "Current UW Green River equivalencies only produce the full CHEM 142 / 152 / 162 set when CHEM& 161, 162, and 163 are all completed."
      ),
      itemStemCalcSequence("calc123", "MATH 124, 125, 126"),
      item("phys121", "PHYS 121", ["PHYS& 221"]),
      item("engl101", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [
      item("phys122", "PHYS 122", ["PHYS& 222"]),
      item("math207", "MATH 207", ["MATH 238"]),
    ],
    stayAtGrcChecklist: [
      item("chem237-238", "Organic chemistry sequence", ["CHEM& 261", "CHEM& 262"]),
      item("phys123", "PHYS 123", ["PHYS& 223"]),
      item("math208", "MATH 208", ["MATH 240"]),
      item("amath301", "AMATH 301", ["ENGR 250"]),
    ],
    advisorFlags: [
      "ChemE starts in spring, not autumn.",
      "Do not promise students that a generic engineering timeline works here just because the course list looks similar.",
    ],
    involvementIdeas: [
      "Encourage process, chemistry, or lab-flavored projects plus MESA involvement.",
    ],
    projectIdeas: [
      "Create a process-flow or reaction / separation concept project with calculations and optimization notes.",
      "Document a chemistry or materials experiment with a stronger engineering lens: inputs, outputs, constraints, and iteration.",
      "Build a small computing helper for engineering calculations instead of only doing handwritten coursework.",
    ],
    officialLinks: [
      {
        label: "UW Chemical Engineering admissions",
        url: "https://www.cheme.washington.edu/undergraduate_students/admission",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
      {
        label: "Green River sample transfer plans PDF",
        url: "https://www.greenriver.edu/marketing/media/documents/grad-to-gator/Associate%20Transfer%20Sample%20Ed%20Plans%202024.pdf",
      },
    ],
  },
  {
    id: "uw-seattle-bioengineering",
    campusId: "uw-seattle",
    title: "Bioengineering",
    shortTitle: "BioE",
    coverage: "detailed",
    summary:
      "BioE needs a custom plan off 999O because the stock chemistry-heavy track is not enough by itself. Biology plus programming choices matter here.",
    applicationWindow:
      "Apply to UW by December 15, then submit the BioE department application by January 15.",
    startQuarter: "Spring cohort",
    bestTrackId: "999O",
    bestTrackSummary:
      "Use 999O as the chemistry-heavy base, then deliberately add biology and programming instead of assuming the stock MRP covers them automatically.",
    whyThisTrack: [
      "The chemistry / physics backbone still matters.",
      "BioE now expects a combination of biology and computing decisions that need explicit planning.",
    ],
    financialAidNote:
      "BioE students should stay anchored to the chemistry-heavy Green River path, then layer in biology and programming inside advisor-approved slots whenever possible.",
    applicationChecklist: [
      itemStemCalcSequence("calc123", "MATH 124, 125, 126"),
      item("chem-general", "CHEM 142, 152, 162", FULL_GENERAL_CHEMISTRY_SEQUENCE),
      item("phys121-122", "PHYS 121 and PHYS 122", ["PHYS& 221", "PHYS& 222"]),
      item(
        "biol180",
        "BIOL 180 pathway",
        FULL_BIOLOGY_MAJORS_SEQUENCE,
        "Current UW Green River equivalencies award the clean BIOL 180 / 200 / 220 sequence only when BIOL& 211, 212, and 213 are all completed."
      ),
      item("organic", "CHEM 223 or CHEM 237", ["CHEM& 261"]),
      itemAny("programming", "AMATH 301 or approved programming path", ["ENGR 250", "CS 121", "CS 122", "CS 123"]),
      item("engl101", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [
      item("cs-sequence", "Programming depth beyond the minimum", ["CS 121", "CS 122", "CS 123"]),
      item("chem262", "Organic chemistry continuation", ["CHEM& 262"]),
    ],
    advisorFlags: [
      "BioE is not just '999O and done.'",
      "Use advisor review whenever the student is deciding between the ENGR 250 route and a full CS sequence route.",
    ],
    involvementIdeas: [
      "Encourage one STEM support community like MESA plus something hands-on in biology, health, or design.",
    ],
    projectIdeas: [
      "Build a health-tech or bioinstrumentation concept project with sensors, data, and a clear user problem.",
      "Create a biology-meets-computing mini project, such as a simple analysis tool or lab workflow helper.",
      "Show evidence of cross-disciplinary work instead of only pure chemistry coursework.",
    ],
    officialLinks: [
      {
        label: "UW Bioengineering admissions",
        url: "https://bioe.uw.edu/academic-programs/undergraduate/undergraduate-admissions/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
  },
  {
    id: "uw-seattle-environmental-engineering",
    campusId: "uw-seattle",
    title: "Environmental Engineering",
    shortTitle: "EnvE",
    coverage: "detailed",
    summary:
      "Environmental Engineering is a custom hybrid because it wants biology and thermodynamics together, which no stock Green River MRP covers cleanly by itself.",
    applicationWindow: "Department application deadline: April 5 for autumn entry.",
    startQuarter: "Autumn",
    bestTrackId: "999Q",
    bestTrackSummary:
      "Start from 999Q or 999O depending the student's chemistry and biology balance, then add biology, thermodynamics, and computing intentionally.",
    whyThisTrack: [
      "It still needs the core engineering backbone.",
      "But it also wants biology and thermodynamics in the same plan, which forces a custom hybrid.",
    ],
    financialAidNote:
      "Advisor review matters here because the best Green River base depends on whether the student needs chemistry-heavy or mechanics-heavy momentum first.",
    applicationChecklist: [
      itemStemCalcSequence("calc123", "MATH 124, 125, 126"),
      item("chem142-152", "CHEM 142 and CHEM 152", FULL_GENERAL_CHEMISTRY_SEQUENCE),
      item("phys121-122", "PHYS 121 and PHYS 122", ["PHYS& 221", "PHYS& 222"]),
      item("aa210", "A A 210", ["ENGR& 214"]),
      item("engl101", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [
      item("math207", "MATH 207 or AMATH 351", ["MATH 238"]),
      item(
        "biol180",
        "BIOL 180 pathway",
        FULL_BIOLOGY_MAJORS_SEQUENCE,
        "Current UW Green River equivalencies award the clean BIOL 180 / 200 / 220 sequence only when BIOL& 211, 212, and 213 are all completed."
      ),
      itemAny("computing", "One approved computing course", ["ENGR 250", "CS 121", "CS 122"]),
      item("aa260", "A A 260", ["ENGR& 224"]),
    ],
    stayAtGrcChecklist: [],
    advisorFlags: [
      "Treat this as a hybrid plan, not a one-click stock MRP.",
      "Use advisor review whenever the student is choosing between 999O and 999Q as the starting base.",
    ],
    involvementIdeas: [
      "Push projects that connect engineering with environmental, community, or sustainability outcomes.",
    ],
    projectIdeas: [
      "Create a water, stormwater, air-quality, or sustainability project with clear engineering tradeoffs.",
      "Combine data collection with a design proposal instead of only writing a research summary.",
      "Use a community-impact framing to make the project easier to explain in applications.",
    ],
    officialLinks: [
      {
        label: "UW Environmental Engineering prerequisites",
        url: "https://www.ce.washington.edu/future/undergrad/environmental/prereq",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
  },
  {
    id: "uw-seattle-human-centered-design-engineering",
    campusId: "uw-seattle",
    title: "Human Centered Design & Engineering",
    shortTitle: "HCDE",
    coverage: "detailed",
    summary:
      "HCDE is a custom template because it mixes calculus, programming, statistics, and science rather than following a classic single-track engineering sheet.",
    applicationWindow: "Department application deadline: April 5 for autumn entry.",
    startQuarter: "Autumn",
    bestTrackId: null,
    bestTrackSummary:
      "There is no single stock Green River engineering MRP that perfectly covers HCDE. This should be treated as a custom advisor-reviewed plan.",
    whyThisTrack: [
      "HCDE wants a mixed prerequisite profile instead of one narrow engineering path.",
      "Green River students still benefit from staying as close as possible to a valid STEM pathway, but the final plan needs a custom balance.",
    ],
    financialAidNote:
      "Keep the student inside the closest valid Green River STEM path possible, then use advisor review to place statistics and science choices strategically.",
    applicationChecklist: [
      itemStemCalcCredits(
        "ten-calc-credits",
        "Ten credits from MATH 124, 125, 126",
        2,
        "HCDE needs at least 10 credits from UW's Calc I-III sequence. At Green River that usually starts with MATH& 151 and 152, and the older MATH& 153 + MATH& 254 route also counts if the student is already on it."
      ),
      itemAny("programming", "One approved programming course", ["CS 121", "CS 122", "CS 123"]),
      itemAny("stats", "One approved statistics course", ["MATH& 146", "MATH 256"]),
      itemCount("science-three", "Three approved science courses", ["CHEM& 161", "PHYS& 221", "PHYS& 222", "BIOL& 211"], 3, "Pick the best set for the student's strongest HCDE story and backup majors."),
      item("engl101", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [
      itemAny("cs122", "Programming depth if the student wants a stronger technical portfolio", ["CS 122", "CS 123"]),
      itemAny("science-depth", "Extra science depth that still supports the chosen Green River path", ["PHYS& 223", "BIOL& 212"]),
    ],
    advisorFlags: [
      "HCDE removed some older prerequisite options for students starting autumn 2026 or later.",
      "This is a custom plan, not a one-track engineering template.",
    ],
    involvementIdeas: [
      "HCDE students should combine technical work with leadership, user-centered work, or design communication.",
      "Push projects that show empathy, usability thinking, and technical follow-through.",
    ],
    projectIdeas: [
      "Design and prototype a student-facing tool for Green River, then document the user problem and iteration process.",
      "Pair a coded or clickable prototype with user feedback, accessibility thinking, and a short case study.",
      "Use MESA or another org as a real stakeholder instead of inventing a fake project brief.",
    ],
    officialLinks: [
      {
        label: "UW HCDE admissions",
        url: "https://www.hcde.washington.edu/bs/admissions/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
  },
  {
    id: "uw-bothell-computer-engineering",
    campusId: "uw-bothell",
    title: "Computer Engineering",
    shortTitle: "CompE",
    coverage: "partial",
    summary:
      "Use 999P as the safest Green River base. Bothell's worksheet and equivalency pages should be the next step before freezing a term-by-term plan.",
    applicationWindow: "Use the current UW Bothell major planning worksheet and admissions deadlines.",
    startQuarter: "Advisor review needed",
    bestTrackId: "999P",
    bestTrackSummary:
      "999P is the strongest likely match because Bothell Computer Engineering still leans on math, physics, and programming preparation.",
    whyThisTrack: [
      "It keeps programming and engineering math aligned.",
      "It is the cleanest Green River track to hold CompE and EE together while the student confirms Bothell-specific details.",
    ],
    financialAidNote:
      "Use 999P as the declared base while advisor review confirms any Bothell-only nuances.",
    applicationChecklist: [
      itemStemCalcSequence("bothell-calc123", "Calculus sequence"),
      item("bothell-physics", "Physics sequence", ["PHYS& 221", "PHYS& 222"]),
      item("bothell-programming", "Programming sequence", ["CS 121", "CS 122", "CS 123"]),
      item("bothell-engl", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [
      item("bothell-circuits", "Circuit prep if the worksheet supports it", ["ENGR& 204"]),
    ],
    advisorFlags: ["Bothell planning worksheet review is still required."],
    involvementIdeas: ["Use MESA plus a technical team or build project while confirming Bothell details."],
    projectIdeas: [
      "Build a hardware-plus-software project that still works as a portfolio piece if the student changes campuses.",
    ],
    officialLinks: [
      { label: "UW Bothell Computer Engineering planning worksheet", url: "https://admissions.uwb.edu/register/mpw-compe" },
      { label: "UW Bothell Green River equivalency guide", url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college" },
    ],
    manualReviewNotes: [
      "This Bothell entry is a planning start, not a final degree audit.",
      "Confirm the worksheet version for the student's intended entry year.",
    ],
  },
  {
    id: "uw-bothell-mechanical-engineering",
    campusId: "uw-bothell",
    title: "Mechanical Engineering",
    shortTitle: "ME",
    coverage: "partial",
    summary:
      "Use 999Q as the likely best fit, then verify the current Bothell worksheet before locking in the final term sequence.",
    applicationWindow: "Use the current UW Bothell major planning worksheet and admissions deadlines.",
    startQuarter: "Advisor review needed",
    bestTrackId: "999Q",
    bestTrackSummary:
      "999Q is the most natural Green River base for Bothell Mechanical engineering planning.",
    whyThisTrack: [
      "It preserves the standard engineering math / physics / mechanics sequence at Green River.",
    ],
    financialAidNote: "999Q is the cleanest aid-safe starting point while Bothell details are confirmed.",
    applicationChecklist: [
      itemStemCalcSequence("bothell-me-calc", "Calculus sequence"),
      item("bothell-me-physics", "Physics sequence", ["PHYS& 221", "PHYS& 222", "PHYS& 223"]),
      item("bothell-me-chem", "Chemistry preparation", ["CHEM& 161", "CHEM& 162", "CHEM& 163"]),
      item("bothell-me-engl", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [
      item("bothell-mechanics", "Mechanics and higher math", ["ENGR& 214", "ENGR& 215", "ENGR& 225", "MATH 238", "MATH 240"]),
    ],
    advisorFlags: ["Bothell planning worksheet review is still required."],
    involvementIdeas: ["Push build-heavy clubs, MESA, and a documented design project."],
    projectIdeas: ["Build a CAD, fabrication, or mechanism project with a clean engineering write-up."],
    officialLinks: [
      { label: "UW Bothell Mechanical Engineering planning worksheet", url: "https://admissions.uwb.edu/register/mpw-me" },
      { label: "UW Bothell Green River equivalency guide", url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college" },
    ],
    manualReviewNotes: ["This Bothell entry is a planning start, not a final degree audit."],
  },
  {
    id: "uw-bothell-csse",
    campusId: "uw-bothell",
    title: "Computer Science & Software Engineering",
    shortTitle: "CSSE",
    coverage: "partial",
    summary:
      "Use a programming-heavy Green River path, then confirm the current Bothell CSSE worksheet. Students deciding between CSSE and Seattle Allen should still keep the CS sequence strong.",
    applicationWindow: "Use the current UW Bothell major planning worksheet and admissions deadlines.",
    startQuarter: "Advisor review needed",
    bestTrackId: "999P",
    bestTrackSummary:
      "999P is usually the strongest starting point when the student wants math plus the full CS 121 / 122 / 123 sequence.",
    whyThisTrack: [
      "It keeps Green River programming depth strong while still fitting a STEM transfer story.",
    ],
    financialAidNote: "Keep the student on a programming-heavy STEM path and confirm the final worksheet fit with advising.",
    applicationChecklist: [
      itemStemCalcSequence("bothell-csse-calc", "Calculus sequence"),
      item("bothell-csse-cs", "Programming sequence", ["CS 121", "CS 122", "CS 123"]),
      item("bothell-csse-engl", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: ["Bothell worksheet review is still required."],
    involvementIdeas: ["Pair the CS sequence with a real project, not just course completion."],
    projectIdeas: ["Build a deployed tool or polished engineering-style software project tied to a real user problem."],
    officialLinks: [
      { label: "UW Bothell CSSE planning worksheet", url: "https://admissions.uwb.edu/register/mpw-csse" },
      { label: "UW Bothell major planning worksheets", url: "https://www.uwb.edu/admissions/apply/major-planning-worksheets" },
    ],
    manualReviewNotes: ["This Bothell entry is a planning start, not a final degree audit."],
  },
  {
    id: "uw-tacoma-computer-engineering",
    campusId: "uw-tacoma",
    title: "Computer Engineering",
    shortTitle: "CompE",
    coverage: "partial",
    summary:
      "Use 999P as the Green River base, then confirm Tacoma program expectations through current Tacoma transfer planning materials.",
    applicationWindow: "Use current UW Tacoma transfer planning and program guidance.",
    startQuarter: "Advisor review needed",
    bestTrackId: "999P",
    bestTrackSummary:
      "999P is the safest Green River anchor when the student wants Tacoma CompE or Tacoma EE.",
    whyThisTrack: [
      "It preserves the Green River programming, math, and physics sequence most likely to stay useful across Tacoma engineering options.",
    ],
    financialAidNote: "Stay on 999P while Tacoma-specific program review happens.",
    applicationChecklist: [
      itemStemCalcSequence("tacoma-calc", "Calculus sequence"),
      item("tacoma-physics", "Physics sequence", ["PHYS& 221", "PHYS& 222"]),
      item("tacoma-cs", "Programming sequence", ["CS 121", "CS 122", "CS 123"]),
      item("tacoma-engl", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: ["Tacoma's program-level review is still required."],
    involvementIdeas: ["Build one strong technical project while confirming Tacoma details."],
    projectIdeas: ["Create a hardware-plus-software portfolio project that can travel across campuses."],
    officialLinks: [
      { label: "UW Tacoma transfer planning", url: "https://www.tacoma.uw.edu/admissions/planning-your-transfer" },
      { label: "UW Tacoma course equivalency guide", url: "https://www.tacoma.uw.edu/admissions/course-equivalency-guide" },
    ],
    manualReviewNotes: [
      "Tacoma's equivalency guidance is less centralized and should be treated as advisor review territory.",
    ],
  },
  {
    id: "uw-tacoma-electrical-engineering",
    campusId: "uw-tacoma",
    title: "Electrical Engineering",
    shortTitle: "EE",
    coverage: "partial",
    summary:
      "Use 999P as the starting point, then confirm the exact Tacoma worksheet or program planning notes for the student's year.",
    applicationWindow: "Use current UW Tacoma transfer planning and program guidance.",
    startQuarter: "Advisor review needed",
    bestTrackId: "999P",
    bestTrackSummary:
      "999P is the strongest shared Green River path for Tacoma EE-style preparation.",
    whyThisTrack: [
      "It keeps programming, math, and physics intact while Tacoma details are confirmed.",
    ],
    financialAidNote: "Stay on 999P while Tacoma-specific program review happens.",
    applicationChecklist: [
      itemStemCalcSequence("tacoma-calc", "Calculus sequence"),
      item("tacoma-physics", "Physics sequence", ["PHYS& 221", "PHYS& 222"]),
      item("tacoma-cs", "Programming sequence", ["CS 121", "CS 122", "CS 123"]),
      item("tacoma-engl", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [item("tacoma-circuit", "Circuit preparation if the program guidance supports it", ["ENGR& 204"])],
    advisorFlags: ["Tacoma's program-level review is still required."],
    involvementIdeas: ["Pair MESA with a hardware or systems project."],
    projectIdeas: ["Build an embedded or electronics project with a clear engineering explanation."],
    officialLinks: [
      { label: "UW Tacoma transfer planning", url: "https://www.tacoma.uw.edu/admissions/planning-your-transfer" },
      { label: "UW Tacoma course equivalency guide", url: "https://www.tacoma.uw.edu/admissions/course-equivalency-guide" },
    ],
    manualReviewNotes: ["Tacoma planning should still be confirmed with the intended program."],
  },
  {
    id: "uw-tacoma-mechanical-engineering",
    campusId: "uw-tacoma",
    title: "Mechanical Engineering",
    shortTitle: "ME",
    coverage: "partial",
    summary:
      "Use 999Q as the Green River base, then confirm Tacoma's current planning guidance before final scheduling.",
    applicationWindow: "Use current UW Tacoma transfer planning and program guidance.",
    startQuarter: "Advisor review needed",
    bestTrackId: "999Q",
    bestTrackSummary:
      "999Q is the clearest Green River track for Tacoma Mechanical preparation.",
    whyThisTrack: [
      "It preserves the standard engineering backbone and is easy for advisors to understand.",
    ],
    financialAidNote: "Stay on 999Q while Tacoma-specific program review happens.",
    applicationChecklist: [
      itemStemCalcSequence("tacoma-me-calc", "Calculus sequence"),
      item("tacoma-me-physics", "Physics sequence", ["PHYS& 221", "PHYS& 222", "PHYS& 223"]),
      item("tacoma-me-chem", "Chemistry sequence", ["CHEM& 161", "CHEM& 162", "CHEM& 163"]),
      item("tacoma-me-engl", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [item("tacoma-mechanics", "Mechanics and higher math", ["ENGR& 214", "ENGR& 215", "ENGR& 225", "MATH 238", "MATH 240"])],
    advisorFlags: ["Tacoma planning should still be confirmed with the intended program."],
    involvementIdeas: ["Push build-heavy projects, MESA, and documented teamwork."],
    projectIdeas: ["Create a fabrication or design project with calculations and a brief engineering report."],
    officialLinks: [
      { label: "UW Tacoma transfer planning", url: "https://www.tacoma.uw.edu/admissions/planning-your-transfer" },
      { label: "UW Tacoma course equivalency guide", url: "https://www.tacoma.uw.edu/admissions/course-equivalency-guide" },
    ],
    manualReviewNotes: ["Tacoma planning should still be confirmed with the intended program."],
  },
];

export type TransferPlannerReferenceBank = TransferPlannerMasterBank;
export type TransferPlannerReferenceChain = TransferPlannerMasterChain;

const TRANSFER_PLANNER_BANK_LABELS: Record<string, string> = {
  WRIT: "Writing and composition",
  MATH: "Mathematics",
  CS: "Computer science and programming",
  ENGR: "Engineering",
  PHYS: "Physics",
  CHEM: "Chemistry",
  BIO: "Biology and anatomy",
  EARTH: "Earth, environment, and geoscience",
  BUS: "Business and economics",
  AAMES: "American ethnic studies, anthropology, and social science",
  COMM: "Communication, journalism, and film",
  ENGL: "English and literature",
  HIST: "History and humanities",
  PHIL: "Philosophy",
  PSYED: "Psychology, education, and ECED",
  ART: "Art and photography",
  PERF: "Dance and drama",
  MUSIC: "Music",
  "LANG-CHIN": "Chinese",
  "LANG-FR": "French",
  "LANG-GER": "German",
  "LANG-JP": "Japanese",
  "LANG-SP": "Spanish",
  HEALTH: "Health and rehabilitation",
  POLSOC: "Political science, criminal justice, and sociology",
};

const TRANSFER_PLANNER_CHAIN_LABELS: Record<string, string> = {
  "WRIT-SEQ": "Writing sequence",
  "MATH-STEM": "STEM calculus sequence",
  "MATH-BUS": "Business and applied math options",
  "CS-NEW": "Modern CS sequence",
  "CS-LEGACY": "Legacy CS sequence",
  "PHYS-CALC": "Calculus-based physics sequence",
  "PHYS-ALG": "Algebra-based physics sequence",
  "CHEM-GEN": "General chemistry sequence",
  "CHEM-ORG": "Organic chemistry sequence",
  "BIO-MAJORS": "Biology majors sequence",
  "BIO-ANAT": "Anatomy and physiology sequence",
  "ACCT-COMBO": "Accounting full-credit combo",
  "ASTR-COMBO": "Astronomy full-credit combo",
  "HIST-US": "US history full-credit combo",
  "ENGL-250": "English 250 full-credit combo",
  "COMM-266": "CMST 266 credit rule",
  "LANG-CHIN": "Chinese language sequence",
  "LANG-FR": "French language sequence",
  "LANG-GER": "German language sequence",
  "LANG-JP": "Japanese language sequence",
  "LANG-SP": "Spanish language sequence",
  "NATRS-COMBO": "Natural resources ESRM combo",
};

const TRANSFER_PLANNER_MASTER_TITLE_ALIASES: Record<string, string> = {
  "uw-seattle-industrial-systems-engineering": "Industrial Engineering",
};

const TRANSFER_PLANNER_CAMPUS_SORT_ORDER: Record<TransferPlannerCampusId, number> = {
  "uw-seattle": 0,
  "uw-bothell": 1,
  "uw-tacoma": 2,
};

const MASTER_BANK_BY_ID = new Map(
  TRANSFER_PLANNER_MASTER_BANK_LIBRARY.map((bank) => [bank.id, bank] as const)
);

const MASTER_CHAIN_BY_ID = new Map(
  TRANSFER_PLANNER_MASTER_CHAIN_LIBRARY.map((chain) => [chain.id, chain] as const)
);

function normalizePlannerLookupValue(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPlannerLookupKey(campusId: TransferPlannerCampusId, title: string) {
  return `${campusId}:${normalizePlannerLookupValue(title)}`;
}

function buildPlannerPlanId(campusId: TransferPlannerCampusId, title: string) {
  return `${campusId}-${normalizePlannerLookupValue(title).replace(/\s+/g, "-")}`;
}

function buildShortPlannerTitle(title: string) {
  return String(title ?? "")
    .replace(/\s+\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const MASTER_MAJOR_ROW_BY_KEY = new Map(
  TRANSFER_PLANNER_MASTER_MAJOR_ROWS.map((row) => [
    buildPlannerLookupKey(row.campusId, row.title),
    row,
  ] as const)
);

function getMasterRowForPlan(plan: TransferPlannerMajorPlan) {
  const aliasedTitle = TRANSFER_PLANNER_MASTER_TITLE_ALIASES[plan.id] ?? plan.title;
  return (
    MASTER_MAJOR_ROW_BY_KEY.get(buildPlannerLookupKey(plan.campusId, aliasedTitle)) ??
    MASTER_MAJOR_ROW_BY_KEY.get(buildPlannerLookupKey(plan.campusId, plan.shortTitle)) ??
    null
  );
}

function getMergedReferenceIds(existingIds: string[] | undefined, masterIds: string[]) {
  return Array.from(new Set([...(existingIds ?? []), ...masterIds]));
}

function mergeDetailedPlanWithMaster(plan: TransferPlannerMajorPlan): TransferPlannerMajorPlan {
  const masterRow = getMasterRowForPlan(plan);
  if (!masterRow) {
    return {
      ...plan,
      sourceType: "detailed",
    };
  }

  return {
    ...plan,
    family: masterRow.family,
    bankIds: getMergedReferenceIds(plan.bankIds, masterRow.bankIds),
    chainIds: getMergedReferenceIds(plan.chainIds, masterRow.chainIds),
    plannerNote: plan.plannerNote ?? masterRow.note,
    sourceType: "detailed",
  };
}

function inferGeneratedTrackId(row: TransferPlannerMasterMajorRow) {
  const searchableText = `${row.title} ${row.family} ${row.note}`.toLowerCase();
  const bankIds = new Set(row.bankIds);

  if (
    /bioengineering|chemical engineering|chemistry|biochemistry|biology|neuroscience/.test(
      searchableText
    ) ||
    (bankIds.has("BIO") && bankIds.has("CHEM"))
  ) {
    return "999O";
  }

  if (
    /computer|electrical|software|informatics|cyber|data science|quantitative|mathematical/.test(
      searchableText
    ) ||
    (bankIds.has("CS") && bankIds.has("ENGR"))
  ) {
    return "999P";
  }

  if (
    /mechanical|civil|aeronaut|industrial|materials|environmental engineering|construction/.test(
      searchableText
    ) ||
    (bankIds.has("ENGR") && bankIds.has("PHYS") && bankIds.has("CHEM"))
  ) {
    return "999Q";
  }

  if (bankIds.has("MATH") || bankIds.has("CS") || bankIds.has("PHYS")) {
    return "999B";
  }

  return null;
}

function buildGeneratedTrackSummary(trackId: string | null) {
  const track = trackId
    ? TRANSFER_PLANNER_TRACKS.find((entry) => entry.id === trackId) ?? null
    : null;

  if (!track) {
    return "Use the GRC class banks and prerequisite/full-credit chains below to build a custom transfer path for this degree.";
  }

  return `${track.code} is the closest Green River base path for this degree. Use it as the backbone, then apply the major-specific class banks and chain rules below.`;
}

function buildGeneratedMajorPlan(row: TransferPlannerMasterMajorRow): TransferPlannerMajorPlan {
  const bestTrackId = inferGeneratedTrackId(row);
  const shortTitle = buildShortPlannerTitle(row.title);
  const campus = TRANSFER_PLANNER_CAMPUSES.find((entry) => entry.id === row.campusId);

  return {
    id: buildPlannerPlanId(row.campusId, row.title),
    campusId: row.campusId,
    title: row.title,
    shortTitle: shortTitle || row.title,
    coverage: "partial",
    summary: `Current Green River -> UW planning reference for ${row.title}. Use the applicable GRC class banks and prerequisite/full-credit chains below as the baseline before final advisor review.`,
    applicationWindow: "Check the official program transfer page",
    startQuarter: "Varies by major",
    bestTrackId,
    bestTrackSummary: buildGeneratedTrackSummary(bestTrackId),
    whyThisTrack: [
      "This is the closest current Green River transfer-associate backbone for the major's math, science, or programming mix.",
      "Use the bank and chain sections below to decide which GRC classes are the strongest fit for this specific degree.",
    ],
    financialAidNote:
      "Keep your Green River associate track, aid load, and extra prerequisite classes aligned with advisor and financial-aid rules before adding elective bank courses.",
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [
      "This planner row comes from the current master equivalency coverage and still needs program-by-program advisor confirmation for final admission strategy.",
    ],
    involvementIdeas: [],
    projectIdeas: [],
    officialLinks: campus?.officialLinks ?? [],
    manualReviewNotes: row.note ? [row.note] : undefined,
    family: row.family,
    bankIds: row.bankIds,
    chainIds: row.chainIds,
    plannerNote: row.note,
    sourceType: "master-generated",
  };
}

const TRANSFER_PLANNER_DETAILED_MAJOR_PLANS = TRANSFER_PLANNER_MAJOR_PLANS.map(
  mergeDetailedPlanWithMaster
);

const DETAILED_PLAN_LOOKUP_KEYS = new Set(
  TRANSFER_PLANNER_DETAILED_MAJOR_PLANS.map((plan) => {
    const masterRow = getMasterRowForPlan(plan);
    return buildPlannerLookupKey(plan.campusId, masterRow?.title ?? plan.title);
  })
);

export const TRANSFER_PLANNER_ALL_MAJOR_PLANS: TransferPlannerMajorPlan[] = [
  ...TRANSFER_PLANNER_DETAILED_MAJOR_PLANS,
  ...TRANSFER_PLANNER_MASTER_MAJOR_ROWS
    .filter(
      (row) => !DETAILED_PLAN_LOOKUP_KEYS.has(buildPlannerLookupKey(row.campusId, row.title))
    )
    .map(buildGeneratedMajorPlan),
].sort((left, right) => {
  const campusDelta =
    TRANSFER_PLANNER_CAMPUS_SORT_ORDER[left.campusId] -
    TRANSFER_PLANNER_CAMPUS_SORT_ORDER[right.campusId];

  if (campusDelta !== 0) return campusDelta;
  return left.title.localeCompare(right.title);
});

export function getTransferPlannerTrack(trackId: string | null) {
  if (!trackId) return null;
  return TRANSFER_PLANNER_TRACKS.find((track) => track.id === trackId) ?? null;
}

export function getTransferPlannerMajorsForCampus(campusId: TransferPlannerCampusId) {
  return TRANSFER_PLANNER_ALL_MAJOR_PLANS.filter((plan) => plan.campusId === campusId);
}

export function getTransferPlannerBankLabel(bankId: string) {
  return TRANSFER_PLANNER_BANK_LABELS[bankId] ?? bankId;
}

export function getTransferPlannerChainLabel(chainId: string) {
  return TRANSFER_PLANNER_CHAIN_LABELS[chainId] ?? chainId;
}

export function getTransferPlannerBanksForPlan(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan?.bankIds?.length) return [] as TransferPlannerReferenceBank[];

  return plan.bankIds
    .map((bankId) => MASTER_BANK_BY_ID.get(bankId) ?? null)
    .filter((bank): bank is TransferPlannerReferenceBank => !!bank);
}

export function getTransferPlannerChainsForPlan(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan?.chainIds?.length) return [] as TransferPlannerReferenceChain[];

  return plan.chainIds
    .map((chainId) => MASTER_CHAIN_BY_ID.get(chainId) ?? null)
    .filter((chain): chain is TransferPlannerReferenceChain => !!chain);
}
