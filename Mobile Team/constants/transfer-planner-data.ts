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

export type TransferPlannerDegreeMapSection = {
  id: string;
  title: string;
  items: string[];
  note?: string;
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
  degreeMapSections?: TransferPlannerDegreeMapSection[];
  manualReviewNotes?: string[];
  family?: string;
  grcCourseList?: string[];
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

const degreeMapSection = (
  id: string,
  title: string,
  items: string[],
  note?: string
): TransferPlannerDegreeMapSection => ({
  id,
  title,
  items,
  note,
});

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

const TRANSFER_PLANNER_DETAILED_MAJOR_PLAN_DEFINITIONS: TransferPlannerMajorPlan[] = [
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
        label: "Allen School degree requirements",
        url: "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/",
      },
      {
        label: "Allen School course lists",
        url: "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("compe-general", "Computer Engineering general education and math/science", [
        "The Computer Engineering degree requires 180 total credits, including 12 credits of written and oral communication, a 5-credit diversity course, and 30 credits of A&H/SSc coursework.",
        "The mathematics and natural-sciences block requires MATH 124, 125, 126, MATH 208, PHYS 121, PHYS 122, 10 additional credits from Allen's approved CE natural-science list, and 3 to 6 more approved math/science credits to bring the total math/science block to 41 credits.",
        "Allen's approved CE science list starts with Chemistry 142 or 145 and Biology 180, then allows higher approved Biology, Chemistry, Physics, Earth and Space Sciences, Astronomy, and Atmospheric Science courses from the current course-lists page.",
      ]),
      degreeMapSection("compe-fundamentals", "Computer Engineering fundamentals", [
        "The CE fundamentals block is CSE 123 or CSE 143, CSE 311, CSE 312, CSE 332, CSE 351, EE 205 or EE 215, CSE 369, and CSE/EE 371.",
      ]),
      degreeMapSection("compe-core", "Computer Engineering core, systems, and capstone", [
        "Students then complete at least 40 additional CE credits, including one of CSE 403, CSE/EE 474, CSE 480, or CSE 484.",
        "The degree also requires 3 more courses from the approved CE systems-electives list, which currently includes options such as CSE 401, CSE 444, CSE 451, CSE 452, CSE 453, CSE 461, CSE/EE 469, CSE/EE 470 or CSE 471, CSE 478, EE 476, and EE 477.",
        "Students must also complete 2 additional CSE core courses, 1 course from the CSE capstone list, and enough additional CSE electives to bring total CSE elective credits to 40.",
        "If outside courses are used toward electives, the student may need additional CSE or College of Engineering credits so the total CSE plus Engineering credits still reaches 40 before free electives bring the degree to 180.",
      ]),
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
        label: "Allen School degree requirements",
        url: "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/",
      },
      {
        label: "Allen School course lists",
        url: "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("cs-general", "Computer Science general education and math/science", [
        "The Computer Science degree requires 180 total credits. General education includes English composition, foreign language through the 3rd quarter, a 5-credit diversity course, the UW reasoning requirement, 10 more credits of W-courses or composition, and 75 credits of Areas of Inquiry.",
        "The Areas of Inquiry distribution is 20 credits of A&H, 20 credits of SSc, 20 credits of Natural Sciences, and 15 credits of additional coursework. Allen notes that the math/science courses plus up to 12 credits of CSE 121, 122, and 123 can count into the Natural Sciences and additional-coursework buckets.",
        "The math/science block requires MATH 124, 125, 126, MATH 208 unless waived by MATH 136, and 1 approved natural-science course.",
        "The current approved CS science options are PHYS 121 or 141, CHEM 142, 143, or 145, BIOL 180, BIOL 162 from AP credit, PHYS 116 plus PHYS 119, or petitioned advanced science coursework.",
      ]),
      degreeMapSection("cs-fundamentals", "Computer Science fundamentals", [
        "The CS fundamentals block is CSE 123 or CSE 143, CSE 311, CSE 312, CSE 331, CSE 332, and CSE 351.",
      ]),
      degreeMapSection("cs-core", "Computer Science core, capstone, and electives", [
        "Students then complete 33 additional CSE credits, including at least 4 400-level courses from the CSE core list, 2 additional CSE core courses at the 300- or 400-level, and either 1 more CSE core course or 1 course from the CSE capstone list.",
        "The remaining credits in that 33-credit block come from the CSE core list or the CSE elective list, then free electives bring the overall degree to 180 credits.",
        "Allen's current planning pages separately maintain the approved CSE core list, capstone offerings, senior-elective list, and computing-and-society options because those offerings change over time even though the degree structure stays the same.",
      ]),
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
        label: "UW ECE degree requirements",
        url: "https://www.ece.uw.edu/academics/bachelor-of-science/bsece/degree-requirements/",
      },
      {
        label: "UW ECE admission requirements",
        url: "https://www.ece.washington.edu/academics/bachelor-of-science/bs-admissions-requirements/",
      },
      {
        label: "UW ECE pathways",
        url: "https://www.ece.uw.edu/academics/bachelor-of-science/bsece/pathways/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("ece-overview", "BSECE degree structure", [
        "The BSECE requires at least 180 total credits and at least 45 credits earned in residence at UW.",
        "For students entering the major in autumn 2025 or later, the major requirements and electives block is 73 to 80 credits; earlier cohorts follow a 66 to 69 credit version of the same structure.",
        "UW ECE treats optional pathways as planning guides, not separate majors, so students still complete one BSECE degree while customizing advanced electives.",
      ]),
      degreeMapSection("ece-core", "Major core and capstone", [
        "Major coursework starts with CSE 123 or CSE 143 plus the ECE core: EE 201, EE 215, EE 241 or CSE 163, EE 242, EE 271, and EE 280.",
        "Advanced technical communication is satisfied by EE 393 or a department-approved alternative.",
        "Students then complete an approved capstone such as EE 437, EE 449, EE 461, EE 475, EE 478, or the EE 497 plus EE 498 ENGINE sequence.",
        "For the major core and computer-programming block, UW ECE requires a minimum 2.0 cumulative GPA with no grade below 1.0.",
      ]),
      degreeMapSection("ece-electives", "Advanced ECE electives and general education", [
        "Autumn 2025-and-later cohorts complete 39 advanced ECE elective credits, including 1 to 4 professional-issues credits and at least 20 credits of 400-level EE coursework.",
        "Earlier cohorts complete 36 advanced ECE elective credits under the same 400-level and approved-course rules.",
        "General education still includes 12 writing credits, 24 A&H/SSc credits with diversity overlap allowed, and 45 natural-science credits.",
        "The 45-credit natural-science block includes calculus through MATH 208 or AMATH 352, PHYS 121 and 122, two depth courses from BIOL 130, BIOL 220, CHEM 142, MATH 224, or PHYS 123, plus one statistics course from IND E 315 or STAT 390.",
      ]),
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
        label: "UW Mechanical Engineering degree requirements",
        url: "https://www.me.washington.edu/students/ug/requirements",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("me-foundation", "BSME lower-division foundation", [
        "The BSME requires 180 total credits and at least 45 ME credits completed in residence at UW.",
        "The math block is MATH 124, 125, 126, 207, 208, and 224. The physics and chemistry block is PHYS 121, 122, 123 and CHEM 142, 152.",
        "Written and oral communication includes English composition plus 7 additional communication credits satisfied by ME 354 and either ME 493 or ME 414.",
        "Engineering fundamentals are AA 210, CEE 220, ME 230, AMATH 301, EE 215, ME 123, and MSE 170.",
        "General education still includes 24 credits of Areas of Inquiry, with at least 10 A&H credits, at least 10 SSc credits, 4 additional A&H or SSc credits, and the UW diversity requirement.",
      ]),
      degreeMapSection("me-core", "BSME core courses", [
        "The required ME core is ME 323, ME 331, ME 333, ME 354, ME 355, ME 356, ME 373, ME 374, ME 493 or ME 414, ME 494, and ME 495.",
      ]),
      degreeMapSection("me-options", "BSME option and elective requirements", [
        "Students complete 19 credits from the approved 400-level ME option-course list, then use free electives to reach 180 total credits.",
      ]),
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
      item(
        "chem152",
        "Second chemistry course strongly recommended",
        ["CHEM& 162", "CHEM& 163"],
        "The current BSCE AUT25 degree sheet says Civil can accept any second chemistry course after CHEM 142; the Green River CHEM& 162 + 163 pair is still the cleanest direct substitute."
      ),
      item("phys123", "PHYS 123 strongly recommended", ["PHYS& 223"]),
      item("math207", "MATH 207 if you can finish it before transfer", ["MATH 238"]),
      item(
        "civil-econ",
        "Economics / CEE topic requirement head start",
        ["ECON& 201", "ECON& 202"],
        "The current BSCE degree sheet allows ECON 200 or ECON 201 for the economics / CEE topic slot. Green River ECON& 201 and ECON& 202 are the cleanest direct matches."
      ),
      item(
        "civil-tech-writing",
        "Technical writing head start",
        ["ENGL 128"],
        "ENGL 128 transfers as ENGR 231 plus 2XX credit, which can cover the BSCE technical-writing slot."
      ),
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
        label: "UW Civil Engineering degree sheet",
        url: "https://www.ce.washington.edu/sites/default/files/pdfs/current/undergrad/uw-cee-bsce-degree-sheet.pdf",
      },
      {
        label: "UW Civil Engineering prerequisites",
        url: "https://www.ce.washington.edu/future/undergrad/prereq",
      },
      {
        label: "UW Civil sample 4-year plan",
        url: "https://www.ce.washington.edu/current/undergrad/civil/sample-4-year-plan",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("civil-foundation", "BSCE lower-division foundation", [
        "The BSCE AUT25 degree sheet requires 180 total credits with 24 math credits, 28 or more science credits, 16 engineering-fundamentals credits, 12 writing credits, 4 to 5 economics credits, and 24 A&H/SSc/DIV credits.",
        "Math includes calculus through MATH 126, differential equations, matrix algebra, and a statistics course.",
        "Science includes CHEM 142, a second chemistry course after CHEM 142, PHYS 121, PHYS 122, PHYS 123, and one basic-science elective.",
        "Engineering fundamentals include computer programming, AA 210, CEE 220, and ME 230 before students start the junior-year CEE core.",
      ]),
      degreeMapSection("civil-core", "BSCE core curriculum", [
        "The 300-level BSCE core curriculum is CEE 307, CEE 317, CEE 327, CEE 337, CEE 347, CEE 357, CEE 367, and CEE 377.",
        "Civil students then complete CEE 440 professional practice in junior year and one senior capstone such as CEE 441, 442, 444, or 445.",
      ]),
      degreeMapSection(
        "civil-electives",
        "Technical and science depth",
        [
          "BSCE students complete 15 technical-elective credits and must take at least 3 credits in 3 of Civil's 6 focus areas.",
          "They also complete 12 engineering-and-science elective credits from the approved BSCE E&S list plus enough general electives to reach 180 total credits.",
          "The current sample sophomore year still places PHYS 123, MATH 207, programming, and the economics requirement before transfer into the junior core.",
        ],
        "The AUT25 degree sheet is the strongest current source for how Civil expects the sophomore-to-junior transition to look."
      ),
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
        label: "UW Aeronautics & Astronautics degree requirements",
        url: "https://www.aa.washington.edu/students/academics/bsaae",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("aa-foundation", "BSAAE lower-division foundation", [
        "The BSAAE requires 180 total credits.",
        "The mathematics block is MATH 124, 125, 126, 207, 208, and 224.",
        "The 25-credit science block is CHEM 142, PHYS 121, PHYS 122, PHYS 123, plus CSE 160 or ME 123 or another approved 5-credit natural-science course.",
        "Engineering fundamentals are AA 210, CEE 220, ME 230, and AA 260.",
        "General education includes English composition, 9 additional writing credits built into A&A core courses, and 24 credits of A&H/SSc with diversity overlap allowed.",
      ]),
      degreeMapSection("aa-core", "BSAAE required A&A courses", [
        "The A&A core is AMATH 301, AA 301, AA 302, AA 310, AA 311, AA 312, AA 320, AA 321, AA 322, AA 331, AA 332, AA 395, AA 447, and AA 460.",
      ]),
      degreeMapSection("aa-capstone", "BSAAE capstone, technical electives, and free electives", [
        "Students choose one capstone sequence: AA 410 plus AA 411, or AA 420 plus AA 421.",
        "They also complete 15 credits of approved A&A technical electives from the current department list, which includes courses such as AA 402, 405, 406, 419, 430, 448, 461, 462, 470, 516, and 532, plus approved AA 498, AA 499, or ENGR 321 usage limits.",
        "Free electives then bring the degree to the 180-credit total.",
      ]),
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
      item(
        "ise-tech-writing",
        "Technical writing head start",
        ["ENGL 128"],
        "ENGL 128 transfers as ENGR 231 plus 2XX credit, which aligns with the BSIE technical-writing requirement."
      ),
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
        label: "UW Industrial & Systems Engineering degree requirements",
        url: "https://ise.washington.edu/files/BSIE%20Graduation%20Requirements.pdf",
      },
      {
        label: "UW Industrial & Systems Engineering admissions",
        url: "https://ise.washington.edu/admissions/BSIE/req_procedure",
      },
      {
        label: "UW Industrial & Systems Engineering student resources",
        url: "https://ise.washington.edu/students/BSIE",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("ise-foundation", "BSIE lower-division foundation", [
        "The BSIE degree requires 180 total credits, including 24 math credits, 25 physical-science credits, 12 written/oral communication credits, 30 VLPA/I&S/DIV credits, and 4 free-elective credits.",
        "Math includes calculus through MATH 126, differential equations, linear algebra, and IND E 315 probability and statistics for engineers.",
        "Physical science includes CHEM 142, CHEM 152, PHYS 121, PHYS 122, and PHYS 123.",
        "The BSIE planning sheet also includes a general engineering/computing block with programming, statics, EE 215, CEE 220, ME 230, and engineering economy.",
      ]),
      degreeMapSection("ise-core", "BSIE core sequence", [
        "The required ISE core courses are IND E 316, IND E 337, IND E 410, IND E 411, IND E 494, and IND E 495.",
        "The communication block includes English composition plus ENGR 231 technical writing before the senior design sequence.",
      ]),
      degreeMapSection("ise-electives", "BSIE technical-elective structure", [
        "BSIE students complete at least 37 technical-elective credits.",
        "The technical electives must include at least one course from each of the five categories shown on the degree sheet: Operations Research, Statistics, Production/Operations, Design, and General Engineering.",
        "This is why the planner still treats programming, differential equations, and linear algebra as valuable Green River depth even after the admission minimums are met.",
      ]),
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
      item(
        "mse-math224",
        "MATH 224 degree-map option",
        ["MATH& 254"],
        "MATH 224 is one of the named MSE math-elective options, and Green River MATH& 254 is the cleanest direct substitute."
      ),
      item("aa210", "A A 210 encouraged", ["ENGR& 214"]),
      item("cee220", "CEE 220 encouraged", ["ENGR& 225"]),
      item(
        "mse-aa260",
        "AA 260 engineering-fundamentals elective",
        ["ENGR& 224"],
        "Thermodynamics is one of the explicit engineering-fundamentals elective options on the current MSE degree page."
      ),
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
        label: "UW Materials Science degree requirements",
        url: "https://mse.washington.edu/current/undergrad/courses",
      },
      {
        label: "UW Materials Science & Engineering admissions",
        url: "https://mse.washington.edu/admission/undergraduate",
      },
      {
        label: "UW MSE junior-start plan of study",
        url: "https://mse.washington.edu/files/current/undergrad/docs/MSE-sample-sched.pdf",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("mse-totals", "MSE degree totals", [
        "The current MSE degree requires 24 math credits, 31 natural-science credits, 24 engineering-fundamentals credits, 51 core MSE credits, 15 technical-elective credits, 12 communication credits, and 24 A&H/SSc/DIV credits.",
        "That full structure still totals 180 credits even before optional concentration-area planning is layered in.",
      ]),
      degreeMapSection("mse-foundation", "Math, science, and engineering fundamentals", [
        "Math includes calculus through MATH 126, MATH 207, MATH 208, and one math elective chosen from options such as IND E 315, MATH 209, MATH 224, MATH 318, or STAT 390.",
        "Natural science includes CHEM 142 and 152, PHYS 121, 122, and 123, plus two additional science electives such as BIOL 180, BIOL 200, CHEM 162, CHEM 237, CHEM 238, or PHYS 224.",
        "Engineering fundamentals include MSE 170, programming through AMATH 301 or CSE 142 or CSE 122, AA 210, CEE 220, and 8 more credits from the approved engineering-fundamentals elective list.",
      ]),
      degreeMapSection("mse-core", "Required MSE core and electives", [
        "The current MSE core is a once-a-year sequence built around MSE 310, 311, 312, 313, 321, 331, 399, 322, 342, 351, 333, 352, 362, 442, 431, 493, 494, and 495.",
        "Students then complete 15 technical-elective credits, with at least 6 credits coming from MSE 400-level electives.",
        "Up to 9 technical-elective credits may come from approved non-MSE departments such as AA, BIOEN, CHEM E, CEE, CSE, EE, IND E, or ME.",
      ]),
    ],
  },
  {
    id: "uw-seattle-chemical-engineering",
    campusId: "uw-seattle",
    title: "Chemical Engineering",
    shortTitle: "ChemE",
    coverage: "detailed",
    summary:
      "ChemE is a custom spring-start cohort plan. The goal is not a normal autumn engineering transfer; it is reaching the January 15 department deadline ready to start the ChemE core that same spring.",
    applicationWindow:
      "Apply to UW by December 15, then submit the ChemE department application by January 15.",
    startQuarter: "Spring cohort",
    bestTrackId: "999O",
    bestTrackSummary:
      "Use 999O as the chemistry-heavy base, then customize it around the department's published Green River sample plan, January deadline, and spring cohort timing.",
    whyThisTrack: [
      "Green River chemistry, physics, and math can cover almost all of the pre-spring ChemE foundation.",
      "UW ChemE already publishes a Green River sample transfer plan, which gives this planner a stronger official starting point than most custom majors.",
      "ChemE uses a cohort model, so sequencing matters as much as course selection.",
    ],
    financialAidNote:
      "Stay anchored to 999O, then deliberately place the full chemistry sequence, PHYS& 222, MATH 238, organic chemistry, and the last math step so the spring-start cohort still works without wasting aid on late detours.",
    applicationChecklist: [
      item(
        "chem142-162",
        "ChemE chemistry transfer-equivalency path at Green River",
        FULL_GENERAL_CHEMISTRY_SEQUENCE,
        "UW ChemE lists CHEM 142 and 152 before application and CHEM 162 before the first spring quarter. In the current Green River equivalency guide, the clean CHEM 142 / 152 / 162 outcome only appears when CHEM& 161, 162, and 163 are all completed, so the planner treats the full sequence as an early ChemE priority."
      ),
      itemStemCalcSequence("calc123", "MATH 124, 125, 126"),
      item("phys121", "PHYS 121", ["PHYS& 221"]),
      item("engl101", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [
      item(
        "phys122",
        "PHYS 122 before the first UW spring quarter",
        ["PHYS& 222"]
      ),
      item(
        "math207",
        "MATH 207 before the first UW spring quarter",
        ["MATH 238"]
      ),
    ],
    stayAtGrcChecklist: [
      item(
        "chem237-238",
        "Organic chemistry sequence before the first autumn at UW",
        ["CHEM& 261", "CHEM& 262"]
      ),
      item(
        "phys123",
        "PHYS 123 before the first autumn at UW",
        ["PHYS& 223"]
      ),
      item(
        "math208",
        "MATH 208 or AMATH 352 if you can finish it before transfer",
        ["MATH 240"],
        "Current equivalency guidance treats MATH 240 as the cleanest direct MATH 208 match. The ChemE department's Green River sample plan still shows the older MATH& 254 route in its example."
      ),
      item(
        "engr250-computing",
        "ENGR 250 computing head start",
        ["ENGR 250"],
        "UW ChemE's Green River sample plan includes ENGR 250 before transfer. It transfers as AMATH 301 and is useful prep for CHEM E 375, but it is not a named ChemE admission or continuation requirement by itself."
      ),
    ],
    advisorFlags: [
      "ChemE starts in spring and follows a cohort model, not a normal autumn engineering timeline.",
      "The ChemE admissions page says up to two bold admission requirements may still be in progress during winter quarter when applying, but students should still aim to finish the full Green River chemistry path as early as possible because of the way CHEM 152 and 162 map.",
      "CHEM E 310 and CHEM E 375 are UW continuation requirements taken during the first spring after admission, not Green River transfer-equivalency targets.",
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
        label: "UW Chemical Engineering curriculum",
        url: "https://www.cheme.washington.edu/undergraduate_students/curriculum",
      },
      {
        label: "UW Chemical Engineering admissions",
        url: "https://www.cheme.washington.edu/undergraduate_students/admission",
        note: "Includes the department's Green River sample transfer plan.",
      },
      {
        label: "UW Chemical Engineering continuation policy",
        url: "https://www.cheme.washington.edu/undergraduate_students/policies/continue.html",
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
    degreeMapSections: [
      degreeMapSection("cheme-structure", "ChemE degree structure", [
        "The current BS Chemical Engineering degree requires 180 total credits.",
        "General education includes 12 written/oral communication credits, 24 Arts and Humanities or Social Sciences credits, and 65 Natural World credits.",
        "Major requirements total 74 credits: 57 ChemE core credits, 3 molecular or nano-engineering credits, and 16 approved engineering-elective credits.",
      ]),
      degreeMapSection(
        "cheme-foundation",
        "Spring-start foundation timing",
        [
          "Admissions prerequisites are CHEM 142 and 152, calculus through MATH 126, PHYS 121, and English composition.",
          "Before the first UW spring quarter, students must be ready with CHEM 162, PHYS 122, and MATH 207 or equivalents.",
          "Before the following autumn, students must complete organic chemistry I and II, PHYS 123, and MATH 208 or an approved alternative.",
        ],
        "The current Green River equivalency guide collapses CHEM 152 and CHEM 162 together, so Green River students usually treat the full CHEM& 161 / 162 / 163 sequence as an early ChemE priority even though the department timing lists CHEM 162 separately."
      ),
      degreeMapSection(
        "cheme-core",
        "Cohort core and continuation",
        [
          "The ChemE core sequence is CHEM E 310, 325, 326, 330, 340, 375, 435, 436, 437, 457, 465, 480, 485, and 486.",
          "The curriculum also requires one molecular or nano-engineering course: CHEM E 455 or CHEM E 460.",
          "ChemE follows a cohort model, and the continuation policy expects students to take CHEM E 310 and CHEM E 375 in the first spring quarter after admission and then move through the core in sequence.",
        ],
        "CHEM E 310 and CHEM E 375 belong to the first UW spring after admission, not to the Green River equivalency checklist."
      ),
      degreeMapSection("cheme-electives", "Math-elective and engineering-elective space", [
        "Students also complete one math elective chosen from MATH 209, MATH 224, IND E 315, MATH or STAT 390, or AMATH 353.",
        "The remaining 16 engineering-elective credits can support a standard ChemE path or the Nanoscience and Molecular Engineering option.",
        "Those later elective spaces are usually better left for UW once the student is inside the ChemE cohort.",
      ]),
    ],
  },
  {
    id: "uw-seattle-bioengineering",
    campusId: "uw-seattle",
    title: "Bioengineering",
    shortTitle: "BioE",
    coverage: "detailed",
    summary:
      "BioE needs a custom plan off 999O because the stock chemistry-heavy track is not enough by itself. The two BioE planning decisions that matter most at Green River are the biology sequence and the programming route.",
    applicationWindow:
      "Apply to UW by December 15, then submit the BioE department application by January 15.",
    startQuarter: "Spring cohort",
    bestTrackId: "999O",
    bestTrackSummary:
      "Use 999O as the chemistry-heavy base, then deliberately add the full Green River biology sequence and the cleanest BioE programming substitute instead of assuming the stock MRP covers them automatically.",
    whyThisTrack: [
      "The chemistry / physics backbone still matters.",
      "BioE now expects a combination of biology and computing decisions that need explicit planning.",
      "At Green River, ENGR 250 is the cleanest direct programming match because the other official BioE options depend on BIOEN 217, which is not part of the Green River equivalency guide.",
    ],
    financialAidNote:
      "BioE students should stay anchored to the chemistry-heavy Green River path, then layer in the full biology sequence and ENGR 250 inside advisor-approved slots whenever possible.",
    applicationChecklist: [
      itemStemCalcSequence("calc123", "MATH 124, 125, 126"),
      item("chem-general", "CHEM 142, 152, 162", FULL_GENERAL_CHEMISTRY_SEQUENCE),
      item("phys121-122", "PHYS 121 and PHYS 122", ["PHYS& 221", "PHYS& 222"]),
      item(
        "biol180",
        "BIOL 180 transfer-equivalency path at Green River",
        FULL_BIOLOGY_MAJORS_SEQUENCE,
        "UW BioE transfer admissions list BIOL 180. In the current Green River equivalency guide, the clean BIOL 180 / 200 / 220 outcome only appears when BIOL& 211, 212, and 213 are all completed."
      ),
      item("organic", "CHEM 223 or CHEM 237", ["CHEM& 261"]),
      item(
        "programming",
        "AMATH 301 programming path",
        ["ENGR 250"],
        "For Green River students, ENGR 250 is the cleanest direct BioE programming match because the other official BioE options use BIOEN 217, which is not part of the Green River equivalency guide."
      ),
      item("engl101", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [
      item(
        "math208",
        "MATH 208 or AMATH 352 if you can finish it before transfer",
        ["MATH 240"],
        "Matrix algebra is part of the BioE engineering-fundamentals block and the sample plans place it early in the major."
      ),
      item(
        "cs-sequence",
        "CS sequence for stronger software or data-science depth",
        ["CS 121", "CS 122", "CS 123"],
        "CS courses can still strengthen the student's BioE story, but they do not replace the clean ENGR 250 -> AMATH 301 path for Green River planning."
      ),
      item("chem262", "Organic chemistry continuation", ["CHEM& 262"]),
    ],
    advisorFlags: [
      "BioE is not just '999O and done.'",
      "UW BioE transfer admissions only list BIOL 180, but Green River students usually need BIOL& 211, 212, and 213 to earn the clean BIOL 180 transfer-equivalency outcome.",
      "At Green River, ENGR 250 is the cleanest BioE programming route because the other official options depend on BIOEN 217.",
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
        label: "UW Bioengineering degree requirements",
        url: "https://bioe.uw.edu/academic-programs/undergraduate/undergraduate-degree-requirements/",
      },
      {
        label: "UW Bioengineering admissions",
        url: "https://bioe.uw.edu/academic-programs/undergraduate/undergraduate-admissions/",
      },
      {
        label: "UW Bioengineering core prerequisites",
        url: "https://bioe.uw.edu/academic-programs/undergraduate/core-prereqs/",
      },
      {
        label: "UW Bioengineering sample schedules",
        url: "https://bioe.uw.edu/academic-programs/undergraduate/sample-4-year-schedules/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("bioe-fundamentals", "BioE engineering fundamentals", [
        "The BS Bioengineering degree totals 180 credits.",
        "The engineering-fundamentals block is 72 credits: 24 math credits, 44 natural-science credits, and 4 programming credits.",
        "Math includes calculus through MATH 126, differential equations, matrix algebra, and one statistics course from STAT 311, STAT 390, IND E 315, or Q SCI 381.",
        "Natural science includes CHEM 142, 152, and 162, organic chemistry, PHYS 121 and 122, and the full BIOL 180 / 200 / 220 sequence.",
      ]),
      degreeMapSection(
        "bioe-core",
        "BioE core and early prerequisite logic",
        [
          "The required BioE core is BIOEN 215, 315, 316, 317, 325, 326, 327, 335, 336, 337, 345, and 400.",
          "The core-prereqs page shows that students begin the spring BioE core with BIOEN 315, 316, and 317.",
          "BIOEN 315 depends on organic chemistry plus BIOL 180, with BIOL 200 as a co-requisite.",
          "BIOEN 316 depends on AMATH 301, PHYS 122, and differential equations, while BIOEN 345 later depends on BIOEN 215 and BIOL 220.",
        ],
        "This is why Green River BioE planning is stricter than a simple chemistry-heavy transfer track."
      ),
      degreeMapSection("bioe-electives", "Senior electives, capstone, and option planning", [
        "BioE students complete 15 BioE senior-elective credits plus 9 to 12 approved engineering-elective credits.",
        "The capstone is either BIOEN 401 plus 402 or BIOEN 404 plus 405 plus an extra engineering elective.",
        "The current sample schedules use those elective spaces to support options such as Data Science or Nano & Molecular Engineering.",
      ]),
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
    stayAtGrcChecklist: [
      item(
        "enve-chem-depth",
        "Complete the full Green River chemistry sequence if needed for kinetics / equilibrium coverage",
        ["CHEM& 163"],
        "The AUT25 BSENVE degree sheet warns that transfer students may need the full three-course chemistry sequence to cover stoichiometry, equilibrium, and kinetics."
      ),
      item("enve-math208", "Matrix algebra for the full BSENVE degree map", ["MATH 240"]),
      item(
        "enve-econ",
        "Economics / CEE topic requirement head start",
        ["ECON& 201", "ECON& 202"],
        "The AUT25 BSENVE degree sheet allows ECON 200 or ECON 201 for the economics / CEE topic slot. Green River ECON& 201 and ECON& 202 are the cleanest direct matches."
      ),
      item(
        "enve-phys123",
        "PHYS 123 as an engineering-and-science elective head start",
        ["PHYS& 223"],
        "The current BSENVE degree sheet no longer requires PHYS 123, but it still counts cleanly as an Engineering & Science elective and is strongly encouraged when it fits."
      ),
      item(
        "enve-cee220",
        "CEE 220 as an engineering-and-science elective head start",
        ["ENGR& 225"],
        "The current BSENVE degree sheet no longer requires CEE 220, but it still counts as an Engineering & Science elective and is strongly encouraged when it fits."
      ),
    ],
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
        label: "UW Environmental Engineering degree sheet",
        url: "https://www.ce.washington.edu/sites/default/files/pdfs/current/undergrad/uw-cee-bsenve-degree-sheet.pdf",
      },
      {
        label: "UW Environmental Engineering prerequisites",
        url: "https://www.ce.washington.edu/future/undergrad/environmental/prereq",
      },
      {
        label: "UW Environmental Engineering degree page",
        url: "https://www.ce.washington.edu/current/undergrad/environmental",
      },
      {
        label: "UW Environmental Engineering major coursework",
        url: "https://www.ce.washington.edu/current/undergrad/environmental/major-coursework",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection(
        "enve-foundation",
        "BSENVE lower-division foundation",
        [
          "The AUT25 BSENVE degree sheet requires 180 total credits with 24 to 25 math credits, 35 science credits, 12 engineering-fundamentals credits, 12 writing credits, 4 to 5 economics credits, and 24 A&H/SSc/DIV credits.",
          "Math includes calculus through MATH 126, differential equations, matrix algebra, and a statistics course.",
          "Science includes BIOL 180, CHEM 142, CHEM 152, PHYS 121, PHYS 122, and one earth-science elective.",
          "Engineering fundamentals include computer programming, AA 210, and thermodynamics through AA 260, ME 323, or PHYS 224.",
        ],
        "The current BSENVE degree sheet also notes that transfer students may need the full three-course chemistry sequence to cover stoichiometry, equilibrium, and kinetics."
      ),
      degreeMapSection("enve-core", "BSENVE core curriculum", [
        "The BSENVE core is CEE 347, CEE 348, CEE 349, CEE 350, CEE 352, CEE 354, and CEE 356.",
        "Students complete CEE 440 professional practice in junior year and a senior capstone through CEE 444 or CEE 445.",
      ]),
      degreeMapSection("enve-electives", "Technical and science depth", [
        "BSENVE students complete 15 technical-elective credits from the approved environmental-engineering list and 13 engineering-and-science elective credits.",
        "The current sample plan still places AMATH 351, AMATH 352, AMATH 301, AA 260, BIOL 180, and ECON 200 before the junior-year CEE core.",
        "CHEM 162, PHYS 123, and CEE 220 are no longer required, but the AUT25 degree sheet still strongly encourages them because they count toward Engineering & Science electives.",
      ]),
    ],
  },
  {
    id: "uw-seattle-human-centered-design-engineering",
    campusId: "uw-seattle",
    title: "Human Centered Design & Engineering",
    shortTitle: "HCDE",
    coverage: "detailed",
    summary:
      "HCDE is a structured custom path, not a stock engineering track. It mixes calculus, programming, statistics, science, and later design-focused core work instead of following one narrow pre-major template.",
    applicationWindow: "Department application deadline: April 5 for autumn entry.",
    startQuarter: "Autumn",
    bestTrackId: null,
    bestTrackSummary:
      "There is still no single stock Green River engineering MRP that perfectly covers HCDE. The safest default is to preserve calculus, one programming course, one statistics course, and an application-safe science bundle, then add optional engineering-fundamentals depth where it fits.",
    whyThisTrack: [
      "HCDE wants a mixed prerequisite profile instead of one narrow engineering path.",
      "The Autumn 2024+ HCDE curriculum makes the post-admission structure much clearer than the old catch-all template.",
      "Green River students still benefit from staying as close as possible to a valid STEM pathway, but the final plan needs a custom balance between admissions readiness, portfolio strength, and backup-major flexibility.",
    ],
    financialAidNote:
      "Keep the student inside the closest valid Green River STEM path possible, avoid spending aid on HCDE-removed prerequisites like algebra-based physics, and use advisor review to place statistics, science, and optional engineering-fundamentals courses intentionally.",
    applicationChecklist: [
      itemStemCalcCredits(
        "ten-calc-credits",
        "Ten credits from MATH 124, 125, 126",
        2,
        "HCDE needs at least 10 credits from UW's Calc I-III sequence. At Green River that usually starts with MATH& 151 and 152, and the older MATH& 153 + MATH& 254 route also counts if the student is already on it."
      ),
      itemAny(
        "programming",
        "One approved programming course",
        ["CS 121", "CS 122", "CS 123"],
        "CS 121 is enough for the admissions minimum. CS 122 or 123 can still be the better choice when the student also wants stronger technical depth or computing-heavy backup majors."
      ),
      itemAny(
        "stats",
        "One approved statistics course",
        ["MATH& 146", "MATH 256"],
        "Green River MATH& 146 is the cleanest lighter HCDE stats path, while MATH 256 is also useful when the student wants a stronger quantitative story."
      ),
      itemCountWithAlternatives(
        "science-three",
        "Three approved science courses",
        ["CHEM& 161", "PHYS& 221", "PHYS& 222"],
        [
          ["PHYS& 221", "PHYS& 222", "PHYS& 223"],
          FULL_GENERAL_CHEMISTRY_SEQUENCE,
          FULL_BIOLOGY_MAJORS_SEQUENCE,
        ],
        3,
        "The planner defaults to CHEM& 161 plus PHYS& 221 and 222 as the safest direct HCDE science bundle from Green River. Full calculus-based physics, full general chemistry, or the full biology-majors sequence can also work when they better fit the student's background or backup majors."
      ),
      item("engl101", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [
      itemAny(
        "cs122",
        "Second programming course for stronger technical depth",
        ["CS 122", "CS 123"],
        "Not required for HCDE admission, but often helpful for portfolio strength and for keeping computing-heavy backup options open."
      ),
      item(
        "engr250",
        "AMATH 301 engineering-fundamentals head start",
        ["ENGR 250"],
        "The current HCDE engineering-fundamentals list includes AMATH 301, so Green River ENGR 250 is one of the cleanest optional pre-transfer head starts."
      ),
      item(
        "aa210",
        "A A 210 engineering-fundamentals head start",
        ["ENGR& 214"],
        "The current HCDE engineering-fundamentals list includes A A 210."
      ),
      item(
        "cee220",
        "CEE 220 engineering-fundamentals head start",
        ["ENGR& 225"],
        "The current HCDE engineering-fundamentals list includes CEE 220."
      ),
      itemAny(
        "science-depth",
        "Extra science depth if it strengthens the student's HCDE story",
        ["PHYS& 223", "BIOL& 211", "BIOL& 212", "BIOL& 213"],
        "Only push extra science after the application-safe bundle is already covered and the added course still helps the student's backup-major options."
      ),
    ],
    advisorFlags: [
      "HCDE removed some older prerequisite options for students starting autumn 2026 or later.",
      "Transfer applicants need a 2.5 cumulative GPA in application courses and a grade of 2.0 or higher in each required course.",
      "The planner defaults to CHEM& 161 plus PHYS& 221 and 222 as the safest direct Green River science bundle, but full chemistry, biology, or calculus-based physics sequences can also work when they better support the student's background.",
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
        label: "UW HCDE degree requirements",
        url: "https://www.hcde.washington.edu/bs/requirements/2024",
      },
      {
        label: "UW HCDE admissions",
        url: "https://www.hcde.washington.edu/bs/admissions/",
      },
      {
        label: "UW HCDE engineering fundamentals list",
        url: "https://www.hcde.washington.edu/bs/requirements/2024/engineering-fundamentals",
      },
      {
        label: "UW HCDE natural sciences course lists",
        url: "https://www.hcde.washington.edu/bs/requirements/2024/natural-sciences",
      },
      {
        label: "UW HCDE course schedule",
        url: "https://www.hcde.washington.edu/bs/schedule",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("hcde-structure", "HCDE degree structure", [
        "The current HCDE bachelor's degree requires 180 total credits.",
        "General education requires at least 85 credits, including English composition, 7 additional writing credits, diversity, 30 A&H/SSc credits, and 50 natural-science credits.",
        "The 50-credit natural-science block includes 5 mathematics credits, 5 statistics credits, 5 additional math-or-statistics credits, 15 science credits, and 20 additional credits from math, statistics, or sciences using the HCDE-specific course lists.",
      ]),
      degreeMapSection(
        "hcde-admission-and-fundamentals",
        "Admissions and engineering fundamentals",
        [
          "Transfer admission requires 10 calculus credits, one programming course, one statistics course, three approved science courses, and English composition, all completed by the April 5 department deadline.",
          "Transfer applicants also need a 2.5 cumulative GPA in the application courses and at least a 2.0 in each required course.",
          "After admission, HCDE students still complete 12 engineering-fundamentals credits, including at least one programming course plus additional courses from the HCDE engineering-fundamentals list such as AMATH 301, A A 210, and CEE 220.",
        ],
        "This is why HCDE planning at Green River should separate bare-minimum admissions coverage from optional engineering-fundamentals head starts."
      ),
      degreeMapSection("hcde-core", "HCDE core and sequencing", [
        "The Autumn 2024+ HCDE core is 46 credits: HCDE 302, 303, 308, 310, 313, one of HCDE 315 or 316, HCDE 321, 322, 351, 492, and 493.",
        "The degree-requirements page says the 300-level HCDE core should be finished by the end of the junior or second-to-last year so students can start the HCDE capstone sequence in senior year.",
        "The current HCDE schedule page also notes that students admitted Autumn 2024 or later must take HCDE 351 and at least one of HCDE 315 or 316.",
      ]),
      degreeMapSection("hcde-electives", "Experiential learning and elective space", [
        "HCDE students complete 2 experiential-learning credits from options such as ENGR 321, ENGR 490, HCDE 496, HCDE 497, or HCDE 499.",
        "They also complete 23 HCDE elective credits, with at least 15 from the Engineering Electives list and at least 8 from the Systems and Society Electives list.",
        "That later elective space is usually better left for UW once the student has entered the HCDE major and can align electives with product, research, data, or society-oriented interests.",
      ]),
    ],
  },
  {
    id: "uw-bothell-computer-engineering",
    campusId: "uw-bothell",
    title: "Computer Engineering",
    shortTitle: "CompE",
    coverage: "detailed",
    summary:
      "Bothell CompE is now modeled as a programming, calculus, and calculus-based-physics transfer path built from the current curriculum page, degree map, and admissions notes.",
    applicationWindow: "Use the current UW Bothell major planning worksheet and admissions deadlines.",
    startQuarter: "Advisor review needed",
    bestTrackId: "999P",
    bestTrackSummary:
      "999P is the strongest Bothell CompE launchpad because it preserves the programming, calculus, and engineering depth that the admissions and curriculum pages emphasize.",
    whyThisTrack: [
      "It keeps the Green River programming sequence intact while holding onto the standard engineering math and physics backbone.",
      "It is the cleanest Green River path for students who may compare Bothell CompE with Tacoma EE/CompE or Seattle computing-engineering options.",
    ],
    financialAidNote:
      "Use 999P as the declared Green River base, then place any Bothell-only worksheet nuances on top of that instead of drifting into unrelated electives.",
    applicationChecklist: [
      itemStemCalcSequence("bothell-compe-calc123", "STMATH 124, 125, 126"),
      item("bothell-compe-physics121-122", "B PHYS 121 and 122", ["PHYS& 221", "PHYS& 222"]),
      itemCount(
        "bothell-compe-programming",
        "Programming through CSS 143-equivalent level",
        ["CS 121", "CS 122", "CS 123"],
        2,
        "Bothell's public admissions materials emphasize programming readiness; finishing CS 123 is still the safest Green River finish."
      ),
      item("bothell-compe-engl", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [
      item("bothell-compe-cs123", "Strongest programming finish", ["CS 123"]),
      item("bothell-compe-circuits", "Circuit preparation", ["ENGR& 204"]),
    ],
    stayAtGrcChecklist: [],
    advisorFlags: [
      "Bothell's worksheet year still matters, even though the public curriculum and admissions pages now support a more structured planner row.",
    ],
    involvementIdeas: [
      "Use MESA plus a technical team or build project while confirming the exact worksheet year.",
    ],
    projectIdeas: [
      "Build a hardware-plus-software project that still works as a portfolio piece if the student changes campuses.",
    ],
    officialLinks: [
      { label: "UW Bothell Computer Engineering curriculum", url: "https://www.uwb.edu/stem/undergraduate/majors/bscompe/curriculum" },
      { label: "UW Bothell Computer Engineering degree map", url: "https://www.uwb.edu/wp-content/uploads/2023/04/B-BS-Computer-Engineering-Degree-Map-2024.pdf" },
      { label: "UW Bothell Computer Engineering admissions", url: "https://www.uwb.edu/stem/undergraduate/majors/bscompe/admissions" },
      { label: "UW Bothell Computer Engineering planning worksheet", url: "https://admissions.uwb.edu/register/mpw-compe" },
      { label: "UW Bothell Green River equivalency guide", url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college" },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-compe-admission", "Computer Engineering admission baseline", [
        "Computer Engineering is a capacity-constrained major that admits for autumn quarter entry.",
        "The admissions page requires English composition, the full one-year calculus sequence, a two-course programming sequence equivalent to CSS 142 and 143 or CSS 132 and 133, and calculus-based Physics I and II, all with minimum 2.0 grades.",
        "The planning worksheet currently says prerequisites must be completed by the end of spring quarter for autumn entry, and the worksheet's competitive-applicant snapshot is around a 3.40 prerequisite GPA and 3.40 cumulative GPA.",
      ]),
      degreeMapSection("uwb-compe-core", "Computer Engineering required core", [
        "The curriculum page divides the degree into Math and Chemistry, Computer Science, Electrical Engineering, and capstone blocks.",
        "The required Math and Chemistry block is BCHEM 143+144, STMATH 207, STMATH 208, STMATH 224, and STMATH 390.",
        "The Computer Science block is CSS 301, 342, 343, 360, 427, and 430, while the Electrical Engineering block is BEE 215, 233, 235, 271, 331, plus either BEE 425 or CSS 422.",
        "The current capstone block is BENGR 494, 495, and 496, which replaced the older BCE 495 and 496 listing.",
      ]),
      degreeMapSection("uwb-compe-finish", "Computer Engineering electives and university finish", [
        "Students also complete 10 credits of CSS or BEE electives, with at least 5 credits at the 400-level and the remainder at the 300-level or higher.",
        "The curriculum page limits special topics plus independent-study / undergraduate-research use inside that elective space.",
        "Outside the major, students still complete the remaining UW Bothell general-education requirements, including writing, diversity, Arts and Humanities, and Social Sciences.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm the worksheet version for the student's intended entry year.",
      "Upper-division CSS / B EE sequencing should still be checked against the current curriculum page and degree map.",
    ],
  },
  {
    id: "uw-bothell-mechanical-engineering",
    campusId: "uw-bothell",
    title: "Mechanical Engineering",
    shortTitle: "ME",
    coverage: "detailed",
    summary:
      "Bothell Mechanical is now modeled from the public curriculum PDF, with the Green River plan centered on calculus, full physics, chemistry, and the mechanics backbone.",
    applicationWindow: "Use the current UW Bothell major planning worksheet and admissions deadlines.",
    startQuarter: "Advisor review needed",
    bestTrackId: "999Q",
    bestTrackSummary:
      "999Q is the best Bothell Mechanical base because it preserves the same mechanics-heavy engineering spine that the public curriculum uses.",
    whyThisTrack: [
      "It preserves the standard engineering math, physics, and mechanics sequence at Green River.",
      "It leaves clean space for the Bothell-specific higher math requirements like STMATH 207 and STMATH 224.",
    ],
    financialAidNote:
      "999Q is still the cleanest aid-safe base, but students should deliberately schedule MATH 238 and MATH& 254 instead of assuming the stock track covers all Bothell math automatically.",
    applicationChecklist: [
      itemStemCalcSequence("bothell-me-calc123", "STMATH 124, 125, 126"),
      item("bothell-me-physics123", "B PHYS 121, 122, and 123", ["PHYS& 221", "PHYS& 222", "PHYS& 223"]),
      item("bothell-me-chem", "B CHEM 143/144 preparation", ["CHEM& 161", "CHEM& 162", "CHEM& 163"]),
      item("bothell-me-engl", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [
      item("bothell-me-math207", "STMATH 207", ["MATH 238"]),
      item("bothell-me-math224", "STMATH 224", ["MATH& 254"]),
    ],
    stayAtGrcChecklist: [
      item("bothell-me-mechanics", "Mechanics sequence", ["ENGR& 214", "ENGR& 215", "ENGR& 225"]),
    ],
    advisorFlags: [
      "Bothell worksheet review is still worth doing because curriculum PDFs and worksheet years can drift slightly.",
    ],
    involvementIdeas: ["Push build-heavy clubs, MESA, and a documented design project."],
    projectIdeas: ["Build a CAD, fabrication, or mechanism project with a clean engineering write-up."],
    officialLinks: [
      { label: "UW Bothell Mechanical Engineering curriculum", url: "https://www.uwb.edu/stem/undergraduate/majors/mechanical/curriculum" },
      { label: "UW Bothell Mechanical Engineering curriculum PDF", url: "https://www.uwb.edu/stem/wp-content/uploads/sites/31/2025/01/B-ME-Curriculum-AY24_25.pdf" },
      { label: "UW Bothell Mechanical Engineering planning worksheet", url: "https://admissions.uwb.edu/register/mpw-me" },
      { label: "UW Bothell Green River equivalency guide", url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college" },
    ],
    manualReviewNotes: [
      "Use the worksheet year that matches the student's intended entry term.",
      "The public curriculum PDF is now reflected in planner data, but advisor review is still smart before freezing the final term order.",
    ],
  },
  {
    id: "uw-bothell-csse",
    campusId: "uw-bothell",
    title: "Computer Science & Software Engineering",
    shortTitle: "CSSE",
    coverage: "detailed",
    summary:
      "Bothell CSSE is now modeled from the public degree map and worksheet, with the planner centered on writing, early calculus, and programming through the CSS 143-equivalent level.",
    applicationWindow: "Use the current UW Bothell major planning worksheet and admissions deadlines.",
    startQuarter: "Advisor review needed",
    bestTrackId: "999P",
    bestTrackSummary:
      "999P is still the strongest Bothell CSSE start because it keeps the Green River programming path deeper than the minimum public degree map floor.",
    whyThisTrack: [
      "It keeps Green River programming depth strong while still fitting a clean STEM transfer story.",
      "It preserves room for students who may still compare Bothell CSSE with Seattle Allen or Tacoma computing paths.",
    ],
    financialAidNote:
      "Keep the student on a programming-heavy STEM path, then use advisor review to decide whether the student should stop at the public minimum or finish the stronger CS 123 / Calc III path.",
    applicationChecklist: [
      itemStemCalcCredits(
        "bothell-csse-calc",
        "STMATH 124 and 125 foundation",
        2,
        "The public Bothell CSSE degree map visibly starts with the first two calculus courses. Finishing Calc III is still a strong optional add-on for broader STEM flexibility."
      ),
      itemCount(
        "bothell-csse-cs",
        "Programming through CSS 143-equivalent level",
        ["CS 121", "CS 122", "CS 123"],
        2,
        "The public degree map visibly reaches the CSS 142 / 143 level. CS 123 is still the strongest Green River finish when the student wants more flexibility."
      ),
      item("bothell-csse-engl", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [
      item("bothell-csse-calc3", "Calc III for stronger STEM flexibility", ["MATH& 163"]),
      item("bothell-csse-cs123", "CS 123 for the strongest programming finish", ["CS 123"]),
    ],
    stayAtGrcChecklist: [],
    advisorFlags: [
      "The public degree map is useful enough for a structured planner row, but Bothell worksheet review is still recommended before final schedule lock-in.",
    ],
    involvementIdeas: ["Pair the CS sequence with a real project, not just course completion."],
    projectIdeas: ["Build a deployed tool or polished engineering-style software project tied to a real user problem."],
    officialLinks: [
      { label: "UW Bothell CSSE admissions", url: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/admissions" },
      { label: "UW Bothell CSSE curriculum", url: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/curriculum" },
      { label: "UW Bothell CSSE degree map", url: "https://www.uwb.edu/wp-content/uploads/2023/04/B-CSSE-Degree-Map-2024.pdf" },
      { label: "UW Bothell CSSE planning worksheet", url: "https://admissions.uwb.edu/register/mpw-csse" },
      { label: "UW Bothell major planning worksheets", url: "https://www.uwb.edu/admissions/apply/major-planning-worksheets" },
      { label: "UW Bothell Green River equivalency guide", url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college" },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-csse-admission", "CSSE admission baseline", [
        "CSSE is a capacity-constrained major that admits for autumn, winter, and spring entry through holistic review.",
        "The admissions page requires English Composition I and II, Calculus I and II, and a two-course programming sequence equivalent to CSS 142 and 143 or CSS 132 and 133, all with minimum 2.0 grades.",
        "The current planning worksheet highlights a competitive-applicant profile around a 3.50 prerequisite GPA and 3.50 cumulative GPA, even though those numbers are not hard admission minimums.",
      ]),
      degreeMapSection("uwb-csse-core", "CSSE general-option core", [
        "The curriculum page lists one statistics course, CSS 301, CSS 342, CSS 343, CSS 350, CSS 360, CSS 370, CSS 422, CSS 430, and CSS 497 as the required core.",
        "Those core courses, together with the entry prerequisites, are intended to cover the software-engineering, management, hardware, and operating-systems spine of the degree.",
      ]),
      degreeMapSection("uwb-csse-electives", "CSSE elective and option structure", [
        "The general CSSE option then requires 25 CSS elective credits, with at least 15 at the 400-level and up to 10 at the 200-level, plus 15 more credits of 300- or 400-level electives that may come from CSS or other subject areas.",
        "Those upper-division non-core electives can overlap with general-education areas like Arts and Humanities, Social Sciences, or Diversity, as long as they are 300-level or higher.",
        "Students who want the cybersecurity pathway can switch into the Information Assurance and Cybersecurity option after first being admitted into the general CSSE major.",
      ]),
    ],
    manualReviewNotes: [
      "The public degree map still leaves some upper-division core details better handled through advising.",
    ],
  },
  {
    id: "uw-tacoma-computer-engineering",
    campusId: "uw-tacoma",
    title: "Computer Engineering",
    shortTitle: "CompE",
    coverage: "detailed",
    summary:
      "Tacoma CompE is now modeled from the public SET catalog structure, with prerequisites anchored on calculus, differential equations, physics, programming, and circuit preparation.",
    applicationWindow: "Use current UW Tacoma transfer planning and program guidance.",
    startQuarter: "Advisor review needed",
    bestTrackId: "999P",
    bestTrackSummary:
      "999P is still the safest Tacoma CompE anchor because it keeps the math, physics, and programming depth aligned while adding the circuit prerequisite intentionally.",
    whyThisTrack: [
      "It preserves the Green River programming, math, and physics sequence most likely to stay useful across Tacoma engineering options.",
      "It is flexible enough to keep Tacoma EE open while the student confirms the final campus choice.",
    ],
    financialAidNote:
      "Stay on 999P, then add MATH 238 and ENGR& 204 deliberately so Tacoma CompE prerequisites do not get missed late.",
    applicationChecklist: [
      itemStemCalcSequence("tacoma-compe-calc123", "TMATH 124, 125, 126"),
      item("tacoma-compe-math207", "TMATH 207", ["MATH 238"]),
      item("tacoma-compe-physics121-122", "T PHYS 121 and 122", ["PHYS& 221", "PHYS& 222"]),
      itemCount(
        "tacoma-compe-programming",
        "Programming through TCSS 143-equivalent level",
        ["CS 121", "CS 122", "CS 123"],
        2,
        "Tacoma CompE's public prerequisites point to TCSS 142 / 143-level programming. CS 123 is still the strongest Green River finish."
      ),
      item("tacoma-compe-circuits", "TCES 215 preparation", ["ENGR& 204"]),
      item("tacoma-compe-engl", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [
      item("tacoma-compe-phys123", "T PHYS 123", ["PHYS& 223"]),
      item("tacoma-compe-math208", "TMATH 208", ["MATH 240"]),
      item("tacoma-compe-cs123", "Strongest programming finish", ["CS 123"]),
    ],
    stayAtGrcChecklist: [],
    advisorFlags: [
      "Tacoma's public catalog is detailed enough for a structured planner row, but year-specific advisor review is still recommended.",
    ],
    involvementIdeas: ["Build one strong technical project while confirming Tacoma details."],
    projectIdeas: ["Create a hardware-plus-software portfolio project that can travel across campuses."],
    officialLinks: [
      { label: "UW Tacoma SET catalog page", url: "https://www.washington.edu/students/gencat/program/T/SchoolofEngineeringandTechnology-1023.html" },
      { label: "UW Tacoma transfer planning", url: "https://www.tacoma.uw.edu/admissions/planning-your-transfer" },
      { label: "UW Tacoma course equivalency guide", url: "https://www.tacoma.uw.edu/admissions/course-equivalency-guide" },
    ],
    manualReviewNotes: [
      "Tacoma's equivalency guidance is still less centralized than Seattle, so check the intended entry year before finalizing the schedule.",
    ],
  },
  {
    id: "uw-tacoma-electrical-engineering",
    campusId: "uw-tacoma",
    title: "Electrical Engineering",
    shortTitle: "EE",
    coverage: "detailed",
    summary:
      "Tacoma EE is now modeled from the public SET catalog structure, with the planner centered on calculus, differential equations, physics, programming, and the TCES 215 / EE 215 circuit foundation.",
    applicationWindow: "Use current UW Tacoma transfer planning and program guidance.",
    startQuarter: "Advisor review needed",
    bestTrackId: "999P",
    bestTrackSummary:
      "999P is the strongest Tacoma EE base because it keeps programming, math, and physics intact while making the circuit prerequisite explicit.",
    whyThisTrack: [
      "It keeps programming, math, and physics intact while Tacoma details are confirmed.",
      "It is also the cleanest shared Green River path for students comparing Tacoma EE and Tacoma CompE.",
    ],
    financialAidNote:
      "Stay on 999P and add the circuit course intentionally; otherwise students can look complete on paper while still missing Tacoma's electrical-entry foundation.",
    applicationChecklist: [
      itemStemCalcSequence("tacoma-ee-calc123", "TMATH 124, 125, 126"),
      item("tacoma-ee-math207", "TMATH 207", ["MATH 238"]),
      item("tacoma-ee-physics121-122", "T PHYS 121 and 122", ["PHYS& 221", "PHYS& 222"]),
      itemAny("tacoma-ee-programming1", "One programming course", ["CS 121", "CS 122", "CS 123"]),
      item("tacoma-ee-circuits", "TCES 215 or EE 215 preparation", ["ENGR& 204"]),
      item("tacoma-ee-engl", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [
      itemAny("tacoma-ee-programming2", "Second programming course for stronger preparation", ["CS 122", "CS 123"]),
      item("tacoma-ee-phys123", "T PHYS 123", ["PHYS& 223"]),
      item("tacoma-ee-math208", "TMATH 208", ["MATH 240"]),
    ],
    stayAtGrcChecklist: [],
    advisorFlags: [
      "Tacoma's public catalog is detailed enough for a stronger planner row, but year-specific advisor review is still recommended.",
    ],
    involvementIdeas: ["Pair MESA with a hardware or systems project."],
    projectIdeas: ["Build an embedded or electronics project with a clear engineering explanation."],
    officialLinks: [
      { label: "UW Tacoma SET catalog page", url: "https://www.washington.edu/students/gencat/program/T/SchoolofEngineeringandTechnology-1023.html" },
      { label: "UW Tacoma transfer planning", url: "https://www.tacoma.uw.edu/admissions/planning-your-transfer" },
      { label: "UW Tacoma course equivalency guide", url: "https://www.tacoma.uw.edu/admissions/course-equivalency-guide" },
    ],
    manualReviewNotes: [
      "Confirm the intended entry year because Tacoma planning pages and catalog wording can shift over time.",
    ],
  },
  {
    id: "uw-tacoma-mechanical-engineering",
    campusId: "uw-tacoma",
    title: "Mechanical Engineering",
    shortTitle: "ME",
    coverage: "detailed",
    summary:
      "Tacoma Mechanical is now modeled from the public SET catalog structure, with the planner centered on full calculus, differential equations, linear algebra, physics, and the Green River mechanics sequence.",
    applicationWindow: "Use current UW Tacoma transfer planning and program guidance.",
    startQuarter: "Advisor review needed",
    bestTrackId: "999Q",
    bestTrackSummary:
      "999Q is the clearest Tacoma Mechanical base because it already carries the same mechanics-heavy structure the public catalog expects.",
    whyThisTrack: [
      "It preserves the standard engineering backbone and is easy for advisors to understand.",
      "It is the cleanest Green River path for making TMATH 207, TMATH 224, and the full physics sequence visible early.",
    ],
    financialAidNote:
      "Stay on 999Q, then deliberately place MATH 238 and MATH& 254 instead of assuming the stock Green River track automatically satisfies Tacoma's higher-math expectations.",
    applicationChecklist: [
      itemStemCalcSequence("tacoma-me-calc123", "TMATH 124, 125, 126"),
      item("tacoma-me-math207", "TMATH 207", ["MATH 238"]),
      item("tacoma-me-math224", "TMATH 224", ["MATH& 254"]),
      item("tacoma-me-physics123", "T PHYS 121, 122, and 123", ["PHYS& 221", "PHYS& 222", "PHYS& 223"]),
      item("tacoma-me-engl", "English composition", ["ENGL& 101"]),
    ],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [
      item("tacoma-me-mechanics", "Mechanics sequence", ["ENGR& 214", "ENGR& 215", "ENGR& 225"]),
      item("tacoma-me-chem", "Chemistry depth if the current planning path still uses extra science preparation", ["CHEM& 161", "CHEM& 162", "CHEM& 163"]),
    ],
    advisorFlags: [
      "Tacoma's catalog is detailed enough for a stronger planner row, but the intended program should still review the final sequence.",
    ],
    involvementIdeas: ["Push build-heavy projects, MESA, and documented teamwork."],
    projectIdeas: ["Create a fabrication or design project with calculations and a brief engineering report."],
    officialLinks: [
      { label: "UW Tacoma SET catalog page", url: "https://www.washington.edu/students/gencat/program/T/SchoolofEngineeringandTechnology-1023.html" },
      { label: "UW Tacoma transfer planning", url: "https://www.tacoma.uw.edu/admissions/planning-your-transfer" },
      { label: "UW Tacoma course equivalency guide", url: "https://www.tacoma.uw.edu/admissions/course-equivalency-guide" },
    ],
    manualReviewNotes: [
      "Confirm the intended entry year because Tacoma's public planning pages can change faster than the Green River equivalency guide.",
    ],
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

const GENERATED_PLAN_DOC_OVERRIDES: Record<
  string,
  Partial<Pick<TransferPlannerMajorPlan, "officialLinks" | "degreeMapSections" | "manualReviewNotes">>
> = {
  [buildPlannerLookupKey("uw-seattle", "American Ethnic Studies")]: {
    officialLinks: [
      {
        label: "UW American Ethnic Studies degree requirements",
        url: "https://aes.washington.edu/ba-american-ethnic-studies",
      },
      {
        label: "UW General Catalog American Ethnic Studies page",
        url: "https://www.washington.edu/students/gencat/program/S/AmericanEthnicStudies-100.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("aes-total", "BA in American Ethnic Studies overall structure", [
        "The current department page requires 60 credits total for the major.",
        "That 60-credit structure is organized as 30 credits of core courses, 25 credits in one concentration area, and 5 additional upper-division credits outside the student's concentration area.",
        "The older General Catalog wording describes the concentration portion as 30 credits inside one concentration; the department page is the better current reference for day-to-day planning.",
      ]),
      degreeMapSection("aes-core", "American Ethnic Studies core courses", [
        "The 30-credit core is six exact courses: AAS 101, AFRAM 101, CHSTU 101, AES 150, AES 151, and AES 212.",
        "The department page notes that these six courses together make up the major's full core and are offered in a predictable yearly pattern.",
      ]),
      degreeMapSection("aes-concentrations", "American Ethnic Studies concentration structure", [
        "Students then choose one of four concentrations: African American Studies, Asian American/Pacific Islander Studies, Chicano/a Studies, or Comparative AES.",
        "The department's current degree page organizes the final 30 credits as 25 credits in the student's chosen concentration plus 5 upper-division credits outside that concentration.",
        "The concentration-course menus are published on the department degree-requirements page rather than as one single fixed universal list across all AES students.",
      ]),
    ],
    manualReviewNotes: [
      "Use the department degree page as the current source of truth when the older General Catalog summary and the newer department concentration split are worded differently.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "American Indian Studies")]: {
    officialLinks: [
      {
        label: "UW American Indian Studies undergraduate programs",
        url: "https://ais.washington.edu/undergraduate-programs",
      },
      {
        label: "UW American Indian Studies requirement sheet",
        url: "https://ais.washington.edu/sites/ais/files/documents/ais_major_requirement_sheet_9.29.21.pdf",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("ais-core", "BA in American Indian Studies introductory and content courses", [
        "The major requires 55 credits of AIS coursework.",
        "The introductory foundation is AIS 102 and AIS 103.",
        "Students then complete 10 credits of content courses, chosen as 2 courses from AIS 170, AIS 202, AIS 203, AIS 209, and AIS 210.",
      ]),
      degreeMapSection("ais-concentrations", "American Indian Studies concentration and elective structure", [
        "The requirement sheet then adds 25 concentration credits with at least 1 course in each of the 3 concentration areas: Governance, Environment and Health, and Culture and History.",
        "After those concentration credits, students complete 10 more credits of general electives from additional AIS courses or adviser-approved related courses.",
      ]),
      degreeMapSection("ais-policies", "American Indian Studies graduation policies", [
        "All AIS major credits must be taken for a numerical grade rather than S/NS.",
        "The requirement sheet also calls for at least 30 AIS major credits at the 300 level or above and a minimum 2.0 cumulative UW GPA.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Anthropology")]: {
    officialLinks: [
      {
        label: "UW General Catalog Anthropology page",
        url: "https://www.washington.edu/students/gencat/program/S/Anthropology-102.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("anth-ba-core", "B.A. in Anthropology shared core", [
        "The general B.A. in Anthropology requires 55 credits.",
        "The 20-credit core is BIO A 201, any 200-level ANTH course, any 200-level ARCHY course, and 1 statistics course chosen from CS&SS 221 / SOC 221 / STAT 221, STAT 220, STAT 311, Q SCI 381, or ARCHY 495.",
      ]),
      degreeMapSection("anth-ba-breadth", "B.A. in Anthropology upper-division breadth", [
        "After the core, students complete 35 additional credits from ANTH, ARCHY, and BIO A courses.",
        "At least 20 of those 35 credits must be upper-division 300- or 400-level work.",
        "One 100-level ANTH, ARCHY, or BIO A course, or AIS 102, may count toward the major but is not required.",
      ]),
      degreeMapSection(
        "anth-options",
        "Anthropology option pathways and planning note",
        [
          "The department also publishes multiple option finishes under the Anthropology umbrella, including Anthropology of Globalization, Archaeological Sciences, Indigenous Archaeology, Medical Anthropology and Global Health, and the B.S. Human Evolutionary Biology pathway.",
          "The generic planner row is best treated as the shared Anthropology launchpad; the exact upper-division finish changes once the student chooses a specific option or the B.S. route.",
          "All Anthropology majors require a minimum 2.00 GPA in courses counted toward the major and at least 15 upper-division anthropology credits completed through UW.",
        ],
        "Confirm early whether the student is targeting the general B.A. or one of the published Anthropology options before treating the final upper-division list as fixed."
      ),
    ],
    manualReviewNotes: [
      "Anthropology at UW Seattle is not a single fixed upper-division path; the department maintains several named options plus a B.S. variant.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Aquatic Conservation & Ecology")]: {
    officialLinks: [
      {
        label: "UW Aquatic Conservation and Ecology overview",
        url: "https://fish.uw.edu/students/undergraduate-program/bachelor-of-science/",
      },
      {
        label: "UW Aquatic Conservation and Ecology major requirements",
        url: "https://fish.uw.edu/students/undergraduate-program/bachelor-of-science/major-requirements/",
      },
      {
        label: "UW Aquatic Conservation and Ecology prepare and apply page",
        url: "https://fish.uw.edu/students/undergraduate-program/prepare-apply/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("ace-college-reqs", "College of the Environment degree framework", [
        "The ACE bachelor's sits inside the College of the Environment and uses that college's 88-credit general-education framework.",
        "Those college requirements include English Composition, 10 credits of reasoning, 10 credits of additional writing, 5 credits of diversity, 20 credits each in Natural Sciences and Social Sciences, 10 credits in Arts and Humanities, and 10 credits of additional Areas of Inquiry.",
        "The College of the Environment page explicitly notes that there is no foreign-language requirement for this degree.",
      ]),
      degreeMapSection("ace-basic-science", "ACE basic science and introductory requirements", [
        "The ACE major requires 2 quarters of calculus and 1 statistics course: either Q SCI 291 and 292 or MATH 124 and 125, plus Q SCI 381 or STAT 311.",
        "The chemistry requirement is CHEM 120 or both CHEM 142 and CHEM 152, plus 1 quarter of organic chemistry from CHEM 220, OCEAN 295, CHEM 223, or CHEM 237.",
        "The biology requirement is BIOL 180 and BIOL 200, plus BIOL 220 or FISH 270.",
        "Students also complete 1 introductory life-in-water course from FISH 200 or FISH 250, 1 people-and-environment course from ANTH 210, ENVIR 235, or FISH 230, 1 career-pathways course from FISH 300 or MARBIO 301, and 1 programming/data-science course from CSE 160 or Q SCI 256.",
      ]),
      degreeMapSection("ace-core-upper", "ACE core knowledge, electives, and practicum", [
        "The ACE core includes FISH 312, FISH 323, and 1 ecology genetics/evolution course from FISH 340 or FISH 370.",
        "Students must also complete 1 communicating-science course from FISH 290 or MARBIO 305, and 1 data-analysis/modeling course from FISH 454 or Q SCI 483.",
        "The advanced-topics requirement is at least 20 credits of approved electives, including at least 5 credits in Aquatic Ecology, at least 5 credits in Conservation and Resource Management Issues, and at least 5 credits with the Quant/Data Science designation.",
        "The school also offers an optional practicum or capstone path through FISH 493, FISH 494, and FISH 495, or internship and undergraduate research credits through FISH 498 and FISH 499.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Architectural Design")]: {
    officialLinks: [
      {
        label: "UW BA in Architectural Design overview",
        url: "https://arch.be.uw.edu/programs-and-courses/ba-arch-2/ba-arch-design/",
      },
      {
        label: "UW BA in Architectural Design curriculum PDF",
        url: "https://arch.be.uw.edu/wp-content/uploads/sites/5/2024/03/BA-Arch-Design_2024_.pdf",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("archd-admission", "BA in Architectural Design admission and prerequisite setup", [
        "Architectural Design is a competitive junior-year admission program.",
        "Students must reach at least 90 credits by autumn of admission, including 71 credits of general education and 19 credits of required ARCH prerequisites.",
        "The exact prerequisite ARCH courses are ARCH 200, ARCH 201, ARCH 350, ARCH 351, and ARCH 352.",
        "The 2024 curriculum sheet also says students must complete 1 diversity course for at least 5 credits and 2 writing or additional English-composition courses totaling at least 7 credits before graduation.",
      ]),
      degreeMapSection("archd-year3", "Architectural Design required year-three sequence", [
        "The current curriculum sheet lists the exact year-three design sequence as ARCH 300, ARCH 301, and ARCH 302.",
        "That studio sequence is paired with ARCH 320, ARCH 321, and ARCH 322 for structures, plus ARCH 315, ARCH 380, ARCH 362, ARCH 431, and CM 313.",
        "The curriculum sheet notes that the gray-highlighted courses are quarter-specific and must be taken in sequence.",
      ]),
      degreeMapSection("archd-year4", "Architectural Design required year-four sequence", [
        "The year-four design studio finish is ARCH 400, ARCH 401, and ARCH 402.",
        "Alongside those studios, students complete a History/Theory selective, a Building Science/Materials selective, and upper-division electives across the senior year.",
        "The department describes the degree as a pre-professional architecture path designed to prepare students for advanced-standing entry into many professional architecture graduate programs.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Architectural Studies")]: {
    officialLinks: [
      {
        label: "UW BA in Architectural Studies overview",
        url: "https://arch.be.uw.edu/programs-and-courses/ba-arch-2/ba-arch/",
      },
      {
        label: "UW BA in Architectural Studies curriculum PDF",
        url: "https://arch.be.uw.edu/wp-content/uploads/sites/5/2024/01/BA-Arch-Studies_20240124.pdf",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("archs-admission", "BA in Architectural Studies admission and prerequisite setup", [
        "Architectural Studies is a four-year liberal-studies architecture degree with limited direct freshman admission plus sophomore- and junior-year admission paths.",
        "The 5 required year-two ARCH courses are ARCH 200, ARCH 231, ARCH 350, ARCH 351, and ARCH 352.",
        "Sophomore admission is open to UW freshmen who will have completed at least 45 credits including the year-two required courses, while junior admission requires those year-two courses plus at least 90 total credits.",
        "Before graduation, students must also complete 2 writing courses totaling at least 10 credits and 5 diversity credits.",
      ]),
      degreeMapSection("archs-core", "Architectural Studies required upper-division core", [
        "The current curriculum sheet lists ARCH 332, ARCH 361, ARCH 362, ARCH 431, ARCH 468, and ARCH 469 as the fixed upper-division Architectural Studies core.",
        "ARCH 362 and ARCH 469 can count as writing credits with instructor permission.",
      ]),
      degreeMapSection("archs-concentrations", "Architectural Studies concentration and elective structure", [
        "Students then complete approved Area of Concentration selectives with a minimum 9 credits, plus additional area-of-concentration selectives with at least 1 course from each area and another 9-credit minimum.",
        "The three named concentration areas are History and Theory, Materials and Making, and Sustainable Development.",
        "The rest of the degree includes at least 15 credits of architecture electives, at least 6 credits of College of Built Environment electives, and at least 23 credits of upper-division electives.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Art")]: {
    officialLinks: [
      {
        label: "UW General Catalog Art and Art History page",
        url: "https://www.washington.edu/students/gencat/program/S/Art+ArtHistory+Design-105.html",
      },
      {
        label: "UW Art undergraduate program",
        url: "https://art.washington.edu/art/undergraduate-program",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("art-core", "BA in Art shared core requirements", [
        "The Bachelor of Arts in Art requires 70 credits total.",
        "The shared 40-credit core is 15 credits of introductory ART classes, 10 credits from ART 400, ART 440, ART 453, or ART 494, and 15 credits of art history including at least 1 approved 300-level art-history course.",
      ]),
      degreeMapSection("art-tracks", "BA in Art concentration paths", [
        "The remaining 30 credits are organized through 1 of 4 concentrations: Interdisciplinary Visual Art, Painting and Drawing, Photomedia, or Three-Dimensional Forum.",
        "The General Catalog lists the current concentration-specific courses exactly: Interdisciplinary Visual Art adds 1 more introductory ART course, 20 credits from the approved 300-level menu, and 5 credits from an approved advanced ART menu; Painting and Drawing uses ART 290 or 292, ART 390, ART 392, ART 393, ART 490, and ART 492 or ART 494; Photomedia uses ART 240, ART 300, ART 301, ART 302, ART 303, and ART 440; Three-Dimensional Forum adds 1 more introductory ART course, 20 credits from ART 333, ART 353, and ART 372, plus ART 453.",
      ]),
      degreeMapSection("art-policies", "Art admission and residency rules", [
        "Students need a minimum 2.50 cumulative GPA and at least 5 credits of college-level art with a 2.5 grade or higher to declare the major.",
        "The degree also requires at least 35 credits at the 300/400 level and at least 40 credits of ART-prefixed coursework completed in residence at UW.",
      ]),
    ],
    manualReviewNotes: [
      "The exact upper-division finish depends on which Art concentration the student chooses.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Art History")]: {
    officialLinks: [
      {
        label: "UW General Catalog Art History requirements",
        url: "https://www.washington.edu/students/gencat/program/S/Art+ArtHistory+Design-105.html",
      },
      {
        label: "UW BA in Art History page",
        url: "https://art.washington.edu/art-history/ba-art-history",
      },
      {
        label: "UW Art History admission page",
        url: "https://art.washington.edu/admission-major-art-history",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("arth-core", "BA in Art History course structure", [
        "The Bachelor of Arts in Art History requires 60 credits.",
        "Those 60 credits are organized as 10 credits from the introductory ART H 200-level survey list, 20 credits from the approved ART H 300-level list, 20 credits from the approved ART H 400-level list, and 10 more ART H elective credits.",
        "The General Catalog page publishes the approved course pools for each of those 4 buckets.",
      ]),
      degreeMapSection("arth-sequence", "Art History upper-division progression", [
        "The school's current Art History page describes the degree as a progression from introductory survey work into 300-level courses that build methods and writing, then 400-level capstone-style courses focused on deeper research and argumentation.",
        "The department page also notes that the 400-level courses are intended for the junior and senior years.",
      ]),
      degreeMapSection("arth-policies", "Art History admission and transfer-credit notes", [
        "Art History requires a minimum 2.5 cumulative GPA to declare.",
        "The admission page also notes that a maximum of 15 transfer credits of art-history coursework can be applied toward the major.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Asian Languages & Cultures")]: {
    officialLinks: [
      {
        label: "UW Asian Languages and Cultures degree requirements",
        url: "https://asian.washington.edu/ba-asian-languages-cultures",
      },
      {
        label: "UW Asian Languages and Cultures admissions page",
        url: "https://admit.washington.edu/majors/asian-languages-cultures/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("alc-overview", "BA in Asian Languages and Cultures overall structure", [
        "The degree requires 60 credits total with a minimum 2.0 cumulative GPA in courses applied to the major.",
        "At least 30 credits must be at the 300- or 400-level, at least 30 credits must be completed in residence at UW, and at least 1 class must be taken in a language area outside the student's primary language area.",
      ]),
      degreeMapSection("alc-core", "Asian Languages and Cultures core requirements", [
        "The core starts with 15 credits of primary language study at the second-year level or above in 1 Asian language.",
        "Students then complete 5 credits in literature, culture, or linguistics from the department's approved 300- or 400-level list.",
      ]),
      degreeMapSection("alc-electives", "Asian Languages and Cultures elective structure", [
        "The elective block adds 10 credits in literature, culture, or linguistics from the department's approved elective list.",
        "It also adds 30 more credits of language, literature, culture, and linguistics coursework, which may combine language study and disciplinary AL&L courses as long as the major's other rules are satisfied.",
        "Up to 10 of those 30 credits may come from a unit outside Asian Languages and Literature with adviser approval.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Asian Studies")]: {
    officialLinks: [
      {
        label: "UW Asian Studies major page",
        url: "https://jsis.washington.edu/programs/undergraduate/asia-studies/",
      },
      {
        label: "UW Asian Studies admissions page",
        url: "https://admit.washington.edu/majors/asian-studies/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("asst-general", "Asian Studies general concentration baseline", [
        "The admissions page summarizes the major as 50 credits plus second-year college-level Asian-language proficiency.",
        "The general concentration page lists the exact shared foundation as JSIS 203 or JSIS A 207, JSIS 201, and 2 Asian civilization courses for 10 credits total.",
        "That same page then requires 30 credits of Asia electives, a research paper written with a Jackson School professor, and language proficiency through the second year college level.",
      ]),
      degreeMapSection("asst-distribution", "Asian Studies elective and language rules", [
        "For the general concentration, the Asian Studies page says students choose 30 elective credits with at least 10 credits from 1 region and at least 10 additional credits from other regions.",
        "A maximum of 5 of those 30 elective credits may be at the 200 level, and a maximum of 5 non-UW resident credits may count toward those electives.",
        "Students must also earn at least a 2.0 grade in all courses applied to the major and maintain the language-grade minimum published on the major page for first- and second-year language study.",
      ]),
      degreeMapSection(
        "asst-concentrations",
        "Asian Studies concentration paths",
        [
          "The Jackson School also publishes exact country- or region-based concentration pages for China, Japan, Korea, South Asia, and Southeast Asia.",
          "Those concentration pages all keep the JSIS 201 plus Asian-civilization foundation but then replace the 30-credit general elective block with concentration-specific civilization, upper-division elective, and language expectations.",
        ],
        "Treat the general concentration as the default planner baseline until the student chooses a specific regional concentration."
      ),
    ],
    manualReviewNotes: [
      "Asian Studies has multiple named regional concentrations, so the exact upper-division finish depends on concentration choice.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Applied & Computational Mathematical Sciences (ACMS)")]: {
    officialLinks: [
      {
        label: "UW ACMS admissions",
        url: "https://acms.washington.edu/admissions",
      },
      {
        label: "UW ACMS program requirements",
        url: "https://acms.washington.edu/program-requirements-and-information",
      },
      {
        label: "UW ACMS admissions office page",
        url: "https://admit.washington.edu/majors/applied-computational-mathematical-sciences-acms/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("acms-admission", "ACMS admission and current option structure", [
        "Applied and Computational Mathematical Sciences is a capacity-constrained B.S. major, and students apply directly to one specific ACMS option rather than to one generic major bucket.",
        "The department's admissions page says that, effective Autumn 2025, applicants need CSE 123 or CSE 143, MATH 124, 125, 126, MATH 208, and one option-core course, with a minimum 2.0 in each course and a 3.0 overall GPA across those prerequisite courses.",
        "Transfer applicants also need at least 30 graded college credits by the application deadline and must apply to both UW and ACMS for the same quarter.",
      ]),
      degreeMapSection("acms-core", "ACMS shared program core for students admitted after Spring 2024", [
        "The current program-core page says students admitted after Spring 2024 share a 29-31 credit core before their option-specific finish.",
        "That shared core is calculus through MATH 124, 125, and 126; programming through CSE 123 or CSE 143; differential equations through MATH 207 or AMATH 351; matrix algebra through MATH 208; and applied linear algebra and numerical analysis through AMATH 352.",
        "The honors calculus sequence MATH 134, 135, and 136 can substitute for the standard calculus sequence and for MATH 207 and MATH 208 where the program allows it.",
      ]),
      degreeMapSection(
        "acms-options",
        "ACMS option-specific finish and earlier-cohort note",
        [
          "For students admitted after Spring 2024, the current ACMS option pages are Data Sciences and Statistics, Discrete Math and Algorithms, Mathematical Economics and Quantitative Finance, and Scientific Computing and Numerical Algorithms.",
          "The program-requirements page also keeps older option pages such as Biological and Life Sciences, Engineering and Physical Sciences, and Social and Behavioral Sciences available for students who were admitted before Spring 2024.",
          "That means the exact upper-division course list depends on both the student's declared ACMS option and when they entered the program.",
        ],
        "Use adviser review before treating any one ACMS option as the final four-year finish, because the current option menu differs for students admitted before and after Spring 2024."
      ),
    ],
    manualReviewNotes: [
      "ACMS is now option-specific at admission, so the final UW course map depends on both option choice and admit year.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Astronomy")]: {
    officialLinks: [
      {
        label: "UW Astronomy undergraduate program",
        url: "https://astro.washington.edu/undergraduate-program",
      },
      {
        label: "UW Astronomy advising page",
        url: "https://astro.washington.edu/advising",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("astr-admission", "Astronomy admission requirements", [
        "Astronomy is a capacity-constrained B.S. major with admission by application.",
        "The department currently requires PHYS 121, PHYS 122, and PHYS 123 plus either MATH 124, 125, and 126 or the honors calculus sequence before standard admission review.",
        "The current advising page says application deadlines are the third Friday of Autumn and Spring quarters, with an additional Winter cycle for eligible transfer students who entered UW in Autumn or Winter.",
      ]),
      degreeMapSection("astr-core", "Astronomy required supporting science and core major courses", [
        "The department's current undergraduate page lists a 91-credit Astronomy curriculum on top of College of Arts and Sciences general-education requirements.",
        "The required supporting science block includes PHYS 121, 122, 123, 224, 225, 226, 227, 321, 322, and 334, plus calculus through MATH 124, 125, and 126 or the honors sequence.",
        "Students also complete 6 mathematics-elective credits from options including MATH 207, 208, 209, 224, 326, AMATH 352, or AMATH 353, and a core astronomy block built around ASTR 300 or 302, ASTR 321 or 324, ASTR 322, and ASTR 323.",
      ]),
      degreeMapSection("astr-electives", "Astronomy electives, physics electives, and capstone guidance", [
        "The major adds 9 astronomy elective credits from approved 400-level and research-oriented astronomy courses and 6 more credits from approved upper-division physics electives.",
        "The department requires at least a 2.00 grade in every course used toward the major.",
        "As a recommended capstone sequence, the department highlights ASTR 480 followed by either ASTR 481 or ASTR 499 or an REU project, and ending with ASTR 482.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Atmospheric and Climate Science")]: {
    officialLinks: [
      {
        label: "UW Atmospheric and Climate Science undergraduate program",
        url: "https://atmos.uw.edu/students/undergraduate-program/",
      },
      {
        label: "UW General Catalog Atmospheric and Climate Science page",
        url: "https://www.washington.edu/students/gencat/program/S/AtmosphericandClimateScience-1067.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("atmos-shared", "Atmospheric and Climate Science shared admission and core", [
        "UW Seattle treats this as a B.S. family with 4 current options: Chemistry, Climate, Data Science, and Meteorology.",
        "The shared admission foundation is English composition, calculus through MATH 124, 125, and 126 or the honors equivalent, plus PHYS 121, 122, and 123 or the PHYS 141, 142, 143 sequence.",
        "The General Catalog notes that ATMOS 301 is the first upper-division core course and that it is offered autumn quarter only.",
        "All four options share the same 30-credit foundation and the same 27-28 credit core centered on STAT 390 or Q SCI 381, ATMOS 220, ATMOS 301, ATMOS 321, ATMOS 340, ATMOS 341, ATMOS 370, and ATMOS 431.",
      ]),
      degreeMapSection("atmos-options", "Atmospheric and Climate Science option-specific requirements", [
        "The Chemistry option adds chemistry-focused atmospheric work such as ATMOS 458/CHEM 458, CEE 480/ATMOS 480, ATMOS 310 or CSE 160, a general chemistry sequence, and approved electives.",
        "The Climate option adds ATMOS 350, ATMOS 358, ATMOS 380, ATMOS 487, ATMOS 310 or CSE 160, ESS 431 or ESS 433, OCEAN 423 or OCEAN 450, plus approved electives.",
        "The Data Science option adds a programming course, data-science and database coursework, an atmospheric option course, and either the MATH 207/208/209 sequence or the AMATH 351/353 sequence.",
        "The Meteorology option adds ATMOS 358, 441, 442, 451, 452, ATMOS 310 or CSE 160, and advanced mathematics including MATH 224 plus either AMATH 351 and 353 or MATH 207, 208, and 209.",
      ]),
      degreeMapSection(
        "atmos-notes",
        "Atmospheric planning notes",
        [
          "Each option is listed in the catalog as a minimum 85-98 credit major path beyond the university and college requirements.",
          "The department also recommends ATMOS 301, ATMOS 340, and ATMOS 441 as a useful pre-graduate sequence for students considering atmospheric-science graduate work.",
          "The catalog uses a minimum 2.0 grade rule for courses applied to the major.",
        ],
        "The exact upper-division finish depends on whether the student is targeting Chemistry, Climate, Data Science, or Meteorology."
      ),
    ],
    manualReviewNotes: [
      "Atmospheric and Climate Science has four official option finishes, so the final upper-division UW list depends on option choice.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Biochemistry")]: {
    officialLinks: [
      {
        label: "UW Biochemistry admissions",
        url: "https://chem.washington.edu/undergraduate-prerequisites-and-admissions-biochemistry",
      },
      {
        label: "UW BS in Biochemistry requirements",
        url: "https://chem.washington.edu/bs-biochemistry",
      },
      {
        label: "UW BA in Biochemistry requirements",
        url: "https://chem.washington.edu/ba-biochemistry",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("bioc-admission", "Biochemistry admission pathways", [
        "Biochemistry is capacity constrained and currently uses direct first-year admission, regular admission, and direct transfer admission pathways.",
        "The current admissions page says the regular-admission baseline starts with general chemistry, biology through BIOL 180, and mathematics through MATH 124 and 125 or the honors equivalent.",
        "Students who are not admitted through the regular pathway can reapply after adding more coursework such as organic chemistry and BIOL 200.",
        "The same admissions page notes that successful applicants typically post stronger GPAs than the bare minimums, with recent typical GPAs above 3.20 for the B.S. and above 3.00 for the B.A.",
      ]),
      degreeMapSection("bioc-ba", "B.A. in Biochemistry structure", [
        "The B.A. in Biochemistry is the broader, less lab-heavy chemistry-and-biology route.",
        "The current degree page builds it from mathematics through MATH 124, 125, and 126; general chemistry; organic chemistry with lab; BIOL 180 and BIOL 200; one physics sequence; BIOC 405 and 406; CHEM 452 and 453; and 9 science-elective credits from the department's approved list.",
        "The B.A. degree page states that this degree requires 180 total credits, a minimum 1.7 in required chemistry, biology, and biochemistry courses, and a 2.0 cumulative major and overall GPA.",
      ]),
      degreeMapSection("bioc-bs", "B.S. in Biochemistry structure", [
        "The B.S. in Biochemistry is the more intensive laboratory and upper-division science route.",
        "Its current degree page includes mathematics through MATH 124, 125, and 126; a full physics sequence; general chemistry; organic chemistry with lecture and lab; BIOL 180 and 200; the upper-division biochemistry sequence BIOC 440, 441, and 442; BIOC 426 laboratory; a genome requirement; physical chemistry; and 11 science-elective credits.",
        "The B.S. page also states that the degree requires 193 total credits, a minimum 2.0 in required courses, a 2.50 cumulative major GPA, a 2.50 average in BIOC 440, 441, and 442, and a 2.50 overall GPA.",
      ]),
    ],
    manualReviewNotes: [
      "The exact Biochemistry finish depends on whether the student is targeting the B.A. or the more intensive B.S. route.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Biology")]: {
    officialLinks: [
      {
        label: "UW Biology admissions and major requirements",
        url: "https://www.biology.washington.edu/programs/undergraduate/admissions",
      },
      {
        label: "UW General Catalog Biology page",
        url: "https://www.washington.edu/students/gencat/program/S/Biology-112.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("biol-admission", "Biology admission and shared lower-division baseline", [
        "Biology is a capacity-constrained Seattle major with quarterly applications.",
        "The department currently requires BIOL 180, BIOL 200, and BIOL 220 or BIOL 240, with at least a 2.0 in each course, plus at least a 2.5 cumulative GPA across supporting chemistry, physics, mathematics, biology, and related major-prep coursework completed at the time of application.",
        "The General Catalog and admissions page both show that UW Biology now includes one B.A. path and multiple B.S. option paths rather than one single upper-division finish.",
      ]),
      degreeMapSection("biol-ba", "B.A. in Biology general option", [
        "The B.A. in Biology is the general-biology breadth option and currently runs 87-98 credits in the major.",
        "It includes BIOL 180, 200, and 220 or BIOL 240, one approved chemistry sequence, 9-10 credits of calculus/statistics, a genetics course, one natural history or biodiversity course, and 42 additional upper-division biology credits.",
        "The General Catalog explicitly notes that the B.A. does not require physics or a third quarter of organic chemistry.",
      ]),
      degreeMapSection(
        "biol-bs",
        "B.S. in Biology option family",
        [
          "The B.S. family currently includes Ecology, Evolution, and Conservation; General Biology; Molecular, Cellular, and Developmental Biology; Physiology; and Plant Biology.",
          "Across those B.S. options, students share the same lower-division biology base, one approved chemistry sequence, one approved two-quarter calculus/statistics sequence, two quarters of physics, a genetics course, a natural history or biodiversity course, a breadth course, and then an option-specific 29-34 credit upper-division block.",
          "The catalog also applies common B.S. degree rules such as a minimum 2.0 cumulative GPA in courses used toward the major, at least 15 upper-division BIOL credits completed through UW Seattle, two upper-division laboratory courses, and at least 15 credits of 400-level BIOL coursework.",
        ],
        "The exact final UW course list depends on whether the student is using the B.A. general-biology route or one of the current B.S. option paths."
      ),
    ],
    manualReviewNotes: [
      "Biology is no longer one single finish; the exact upper-division map depends on the B.A. route or the chosen B.S. option.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Chemistry")]: {
    officialLinks: [
      {
        label: "UW Chemistry admissions",
        url: "https://chem.washington.edu/undergraduate-prerequisites-and-admissions-chemistry",
      },
      {
        label: "UW BA in Chemistry requirements",
        url: "https://chem.washington.edu/ba-chemistry",
      },
      {
        label: "UW BS in Chemistry requirements",
        url: "https://chem.washington.edu/bs-chemistry",
      },
      {
        label: "UW BS in Chemistry ACS-certified requirements",
        url: "https://chem.washington.edu/bs-chemistry-acs-certified",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("chem-admission", "Chemistry admission and degree family", [
        "UW Seattle Chemistry currently offers three major outcomes: a B.A. in Chemistry, a B.S. in Chemistry, and a B.S. in Chemistry with ACS Certification.",
        "The department treats Chemistry as a minimum-requirements major rather than a capacity-constrained application major.",
        "The current admissions page requires one approved general-chemistry sequence, one approved physics sequence, and one approved mathematics sequence, with at least a 2.0 in each required course and a 2.50 GPA across the courses used for admission review.",
      ]),
      degreeMapSection("chem-ba", "B.A. in Chemistry structure", [
        "The B.A. in Chemistry uses mathematics through MATH 124, 125, and 126, one full physics sequence, one general chemistry sequence, one organic chemistry sequence with lab, 11 credits of upper-division numerically graded CHEM coursework that include either the CHEM 455-456-457 or CHEM 452-453 sequence, and an advanced chemistry lab through CHEM 317 or CHEM 461.",
        "The B.A. page states that the degree requires 180 total credits, at least a 1.7 in required chemistry courses, and a 2.0 cumulative GPA across chemistry courses used toward the degree.",
      ]),
      degreeMapSection(
        "chem-bs",
        "B.S. Chemistry and ACS-certified routes",
        [
          "The non-ACS B.S. adds a full calculus sequence, one additional math course, one physics sequence, general chemistry, inorganic chemistry, organic chemistry with lab, the physical chemistry sequence, two of the three major chemistry labs, 5 more approved lab credits, and 11 science-elective credits.",
          "The non-ACS B.S. page lists a minimum 180 credits, a 2.0 minimum in each required chemistry course, and both overall and science GPAs of 2.5.",
          "The ACS-certified B.S. is the more extensive route and adds the broader ACS laboratory and advanced-chemistry expectations, including analytical lab, inorganic lecture and lab, physical chemistry with lab, a biochemistry component, and at least 8 credits of advanced chemistry beyond the base lecture/lab core.",
          "The ACS-certified page lists a minimum of 183 credits and keeps the stricter 2.0-per-course B.S. continuation standards.",
        ],
        "The exact upper-division finish depends on whether the student is aiming for the B.A., the standard B.S., or the ACS-certified B.S."
      ),
    ],
    manualReviewNotes: [
      "UW Chemistry has three distinct degree finishes, so the final upper-division course map depends on whether the student is targeting the B.A., B.S., or ACS-certified B.S.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Chinese")]: {
    officialLinks: [
      {
        label: "UW B.A. in Chinese requirements",
        url: "https://asian.washington.edu/ba-chinese",
      },
      {
        label: "UW Asian Languages and Literature admissions",
        url: "https://asian.washington.edu/admissions-incoming-freshmen-current-students",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("chin-admission", "Chinese major admission baseline", [
        "Chinese is one of the department's minimum-requirement majors rather than an open major.",
        "The department's admissions page says students normally need at least 20 college credits in the intended primary language, with the most recent course taken at UW and a grade of at least 2.5 in that most recent language course, plus one English writing course with a 2.0 or higher.",
      ]),
      degreeMapSection("chin-language", "B.A. in Chinese modern language requirement", [
        "The current Chinese major applies to students declaring in Winter 2019 or later and requires at least 50 credits, with the exact total depending on the student's entering Chinese level.",
        "The first block is 15-20 credits of modern Chinese language coursework, and students must complete at least CHIN 213 or CHIN 303 unless that requirement is waived because of advanced prior proficiency.",
        "The department also states that no more than 20 credits of modern Chinese language courses may count toward the major, even if a student needs more language coursework to reach the required level.",
      ]),
      degreeMapSection("chin-culture", "Chinese linguistics, literature, culture, and classical-language requirements", [
        "The second block is 30-35 credits in Chinese linguistics, literature, culture, and/or classical language.",
        "That block must include CHIN 451, CHIN 342 or CHIN 442, and CHIN 461 plus CHIN 463.",
        "Students then add 5-10 more approved credits from department coursework such as Chinese literature, language, or culture classes, and the program allows up to 10 credits from approved China-related coursework outside the department.",
      ]),
    ],
    manualReviewNotes: [
      "The exact number of UW Chinese credits needed depends on the student's entering language level and placement.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Cinema & Media Studies")]: {
    officialLinks: [
      {
        label: "UW General Catalog Cinema and Media Studies page",
        url: "http://www.washington.edu/students/gencat/program/S/CinemaandMediaStudies-132.html",
      },
      {
        label: "UW Cinema and Media Studies undergraduate programs",
        url: "https://cinema.washington.edu/undergraduate-programs",
      },
      {
        label: "UW Cinema and Media Studies admissions page",
        url: "https://admit.washington.edu/majors/cinema-media-studies/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("cms-admission", "Cinema and Media Studies admission setup", [
        "Cinema and Media Studies is currently listed by UW Admissions as a minimum-requirements major.",
        "The General Catalog states that students need one introductory CMS course from CMS 270, 271, 272, 273, 274, or 275, a minimum 2.00 cumulative GPA, and one English composition or W-writing course before declaring.",
      ]),
      degreeMapSection("cms-core", "B.A. in Cinema and Media Studies exact required structure", [
        "The B.A. in Cinema and Media Studies requires 60 credits total.",
        "Its fixed core is CMS 301 and CMS 480, a 10-credit history block made from CMS 310 or CMS 311 plus one of CMS 312, CMS 313, CMS 314, or CMS 315, and a 10-credit critical-concepts block made from one of CMS 302, CMS 303, or CMS 304 plus one of CMS 320, CMS 321, or CMS 322.",
      ]),
      degreeMapSection("cms-electives", "Cinema and Media Studies electives and residency rules", [
        "The rest of the major is 30 credits of approved electives.",
        "Inside that 30-credit elective block, students need at least 20 credits at the 300/400 level and at least 10 credits of CMS-prefixed coursework.",
        "The major also caps CMS 490 independent study at 5 credits and CMS 491 internship at 5 credits, requires at least 35 credits in residence at UW, and uses a 2.00 cumulative GPA rule for courses applied to the major.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Classical Studies")]: {
    officialLinks: [
      {
        label: "UW B.A. in Classical Studies",
        url: "https://classics.washington.edu/ba-classical-studies",
      },
      {
        label: "UW Classics majors overview",
        url: "https://classics.washington.edu/majors",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("classt-overview", "B.A. in Classical Studies overall structure", [
        "Classical Studies is the more translation-focused and flexible major in the Classics department.",
        "The department currently lists it as a 61-67 credit major.",
      ]),
      degreeMapSection("classt-language", "Classical Studies language requirement", [
        "Students complete either Greek or Latin through 307, or the equivalent, for roughly 25-30 credits depending on starting point.",
        "The department notes that students with no previous Greek or Latin can still complete the major in two years.",
      ]),
      degreeMapSection("classt-upper", "Classical Studies upper-division coursework", [
        "After the language requirement, students complete 34 more approved credits drawn from Greek or Latin at the 400 level, classics-in-English courses, classical art and archaeology, ancient history, the history of ancient philosophy, and the history of ancient science.",
        "The major finishes with CLAS 495, the senior essay, for 2-3 credits.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Classics")]: {
    officialLinks: [
      {
        label: "UW B.A. in Classics",
        url: "https://classics.washington.edu/ba-classics",
      },
      {
        label: "UW Classics majors overview",
        url: "https://classics.washington.edu/majors",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("classics-core", "B.A. in Classics language core", [
        "The B.A. in Classics is the department's stronger dual-language route and currently runs 67-68 credits.",
        "Students complete 15 credits of 300-level classical Greek, excluding GREEK 300 and 301, plus 15 credits of 300-level Latin, excluding LATIN 300 and 301.",
      ]),
      degreeMapSection("classics-upper", "Classics advanced language requirements", [
        "The major then requires at least 30 credits of 400-level Greek and Latin coursework, with at least 10 credits in each language.",
      ]),
      degreeMapSection("classics-capstone", "Classics supporting coursework and capstone", [
        "Students also complete 5 credits from approved coursework in classics in English, classical art and archaeology, ancient history, the history of ancient philosophy, or the history of ancient science.",
        "The degree finishes with CLAS 495, the senior essay, for 2-3 credits.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Communication")]: {
    officialLinks: [
      {
        label: "UW Communication admissions page",
        url: "https://admit.washington.edu/majors/communication/",
      },
      {
        label: "UW General Catalog Communication requirements",
        url: "https://www.washington.edu/students/gencat/program/S/Communication-1035.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("comm-admission", "Communication admission and lower-division baseline", [
        "Communication is capacity constrained and admits students in autumn, winter, and spring after an internal application.",
        "The shared admission baseline is 10 credits of 200-level COM coursework that include COM 200 plus 1 additional 200-level COM course, with at least a 2.5 grade in both courses.",
        "The program also requires at least a 2.50 cumulative GPA in COM coursework and at least a 2.50 cumulative GPA across all college coursework, including transfer work.",
      ]),
      degreeMapSection("comm-ba", "B.A. in Communication core and upper-division structure", [
        "The standard B.A. in Communication requires 50 credits.",
        "Those 50 credits are 10 introductory credits from COM 200 plus 1 more 200-level COM course, 5 credits in Methods in Inquiry, 5 credits in Theory in Communication, and 30 elective credits from Communication plus selected outside courses.",
        "Inside that 50-credit structure, at least 25 credits must be 300- or 400-level COM coursework, and at least 10 of those upper-division credits must be 400-level COM coursework excluding COM 498 and COM 499.",
      ]),
      degreeMapSection("comm-jpic", "Journalism and Public Interest Communication option", [
        "The same General Catalog page also publishes the Journalism and Public Interest Communication option within Communication.",
        "That option uses a minimum 55-credit structure with COM 200 plus 1 more 200-level COM course, 1 methods course, a 20-credit skills core of COM 360, COM 361, COM 362, COM 364, and COM 457, a 10-credit law and ethics core of COM 440 and COM 468, and at least 10 credits of advanced skills and competencies.",
      ],
      "The exact upper-division Communication finish depends on whether the student stays in the general B.A. path or is admitted into the Journalism and Public Interest Communication option."),
    ],
    manualReviewNotes: [
      "Use the standard Communication B.A. as the default planner baseline unless the student is specifically targeting the Journalism and Public Interest Communication option.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Community, Environment & Planning")]: {
    officialLinks: [
      {
        label: "UW Community, Environment and Planning admissions page",
        url: "https://admit.washington.edu/majors/community-environment-planning/",
      },
      {
        label: "UW General Catalog Community, Environment and Planning requirements",
        url: "https://www.washington.edu/students/gencat/program/S/UrbanDesignandPlanning-50.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("cep-admission", "CEP admission and college-level baseline", [
        "Community, Environment and Planning is a capacity-constrained autumn-start B.A. inside Urban Design and Planning.",
        "Transfer applicants need at least 90 completed credits by the time the program begins, at least 80 percent of general-education requirements fulfilled, and at least a 2.50 GPA, with the application also weighing the written essay and relevant extracurricular work.",
        "The admissions page specifically calls out English Composition and CEP 200 as required preparation before application.",
      ]),
      degreeMapSection("cep-core", "CEP fixed core sequence", [
        "The major itself runs 77-82 credits and has a fixed CEP seminar spine of CEP 301, CEP 302, CEP 303, CEP 460, CEP 461, and CEP 462.",
        "Students also complete CEP 300 leadership retreats in autumn and spring, CEP 400 governance practicum taken quarterly, CEP 446 internship, and the senior capstone sequence CEP 490 and CEP 491.",
      ]),
      degreeMapSection("cep-self-directed", "CEP self-directed methods, digital-skills, and elective structure", [
        "Beyond the fixed CEP core, students build 25 credits of upper-division methods coursework drawn from across the university, with no more than 15 credits from a single department, all chosen with CEP faculty guidance.",
        "The degree also requires 1 approved diversity course and 1 approved digital-skills course, and the catalog notes that electives vary because students complete the rest of the 180-credit degree through overlapping general-education work plus additional coursework aligned with their individualized plan.",
      ],
      "CEP is intentionally self-directed, so the exact upper-division methods and elective list depends on adviser-approved student planning rather than one single universal course map."),
    ],
    manualReviewNotes: [
      "Use the fixed CEP seminar, practicum, internship, and capstone sequence as the stable core; the methods and digital-skills courses are individualized with adviser approval.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Comparative History of Ideas")]: {
    officialLinks: [
      {
        label: "UW Comparative History of Ideas admissions page",
        url: "https://admit.washington.edu/majors/comparative-history-of-ideas-chid/",
      },
      {
        label: "UW General Catalog Comparative History of Ideas requirements",
        url: "https://www.washington.edu/students/gencat/program/S/ComparativeHistoryofIdeas-202.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("chid-core", "CHID major overall structure", [
        "The B.A. in Comparative History of Ideas requires 60 credits and is an open major.",
        "The fixed starting point is CHID 101 plus 10 credits of Gateways to CHID coursework.",
      ]),
      degreeMapSection("chid-themes", "CHID thematic and methods-based requirements", [
        "After the initial CHID foundation, students complete 5-10 credits of Cultural and Historical Engagements, 5 credits of Ideas in the World, 5 credits of Power and Difference, and CHID 390.",
        "The catalog describes those categories as adviser-guided choices rather than one single rigid universal course list.",
      ]),
      degreeMapSection("chid-capstone", "CHID senior project and upper-division electives", [
        "The senior finish is CHID 491 and CHID 493 for 10 credits, plus another 13-18 credits of approved electives.",
        "At least half of the credits counted toward the major must be upper-division, students must maintain at least a 2.50 GPA in courses applied to the major, and they may optionally expand the senior project with CHID 492.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Comparative Literature")]: {
    officialLinks: [
      {
        label: "UW Comparative Literature admissions page",
        url: "https://admit.washington.edu/majors/comparative-literature/",
      },
      {
        label: "UW Comparative Literature major page",
        url: "https://cinema.washington.edu/ba-comparative-literature",
      },
      {
        label: "UW Comparative Literature major guide PDF",
        url: "https://hasc.washington.edu/sites/default/files/2023-09/Comparative%20Literature%20Major%20Guide.pdf",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("clit-admission", "Comparative Literature admission and prerequisite setup", [
        "Comparative Literature is a minimum-requirements major with a minimum 2.0 overall GPA to declare.",
        "The published prerequisite is 1 English Composition or W course plus 1 of C LIT 250, C LIT 251, or C LIT 252.",
      ]),
      degreeMapSection("clit-core", "Comparative Literature required core", [
        "The current major page and major guide treat the degree as 45 credits inside the major plus the 5-credit prerequisite course, for 50 credits total counting toward the major path.",
        "The exact shared core is C LIT 400, 1 300-level Cinema Studies course, 1 additional Comparative Literature course at the 300 or 400 level, and 3 differently numbered courses chosen from C LIT 320, 321, 322, 323, 360, 361, and 362 with at least 1 course from each series.",
      ]),
      degreeMapSection("clit-electives", "Comparative Literature electives and graduation rules", [
        "Students then complete 15 more credits of 300- or 400-level literature, cinema, or media studies electives chosen from Comparative Literature and the participating humanities departments named on the major page and guide.",
        "At least 1 course in the major must focus primarily on literature written before 1800, no course applied to the major may be taken S/NS or C/NC, and at least 30 credits applied to the major must be completed in residence at UW.",
      ],
      "The admissions page still describes Cinema Studies and Literary Studies as curricular options, but the current Comparative Literature major page is the clearest source for the exact course buckets in this row."),
    ],
    manualReviewNotes: [
      "Use the current Comparative Literature major page and Humanities Academic Services guide as the source of truth for the exact 50-credit structure.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Comparative Religion")]: {
    officialLinks: [
      {
        label: "UW Comparative Religion admissions page",
        url: "https://admit.washington.edu/majors/comparative-religion/",
      },
      {
        label: "UW General Catalog Comparative Religion requirements",
        url: "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("relig-core", "Comparative Religion introductory core", [
        "The B.A. in Comparative Religion requires 50 credits and is an open major.",
        "The fixed introductory foundation is RELIG 201, RELIG 202, and JSIS 202 for 15 credits total.",
      ]),
      degreeMapSection("relig-buckets", "Comparative Religion category requirements", [
        "Students then complete at least 5 credits in Textual Canons and Historical Traditions, at least 5 credits in Religion, Culture, and Power, and at least 25 more credits of religion electives drawn from those approved course lists.",
        "The catalog also allows up to 10 of the elective credits to come from relevant language study such as biblical Hebrew, Coptic, Hindi, Ethiopic, Greek, Latin, or Sanskrit.",
      ]),
      degreeMapSection("relig-tracks", "Comparative Religion track and upper-division rules", [
        "The admissions page describes four tracks inside the degree: History of Religions-Western Emphasis, History of Religions-Eastern Emphasis, Religion and Society, and Religion and Symbolic Expression.",
        "At least 25 credits applied to the major must be taken at the 300- or 400-level, and students must maintain at least a 2.00 GPA in courses applied to the major.",
      ],
      "The exact elective mix depends on which Comparative Religion track the student and adviser use to shape the upper-division plan."),
    ],
    manualReviewNotes: [
      "Comparative Religion has a fixed introductory core but a track-shaped upper-division finish.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Computational Finance & Risk Management")]: {
    officialLinks: [
      {
        label: "UW Computational Finance and Risk Management admissions page",
        url: "https://admit.washington.edu/majors/computational-finance-risk-management/",
      },
      {
        label: "UW General Catalog Computational Finance and Risk Management requirements",
        url: "https://www.washington.edu/students/gencat/program/S/AppliedMathematics-208.html",
      },
      {
        label: "UW CFRM department site",
        url: "https://depts.washington.edu/compfin/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("cfrm-admission", "CFRM admission and shared lower-division foundation", [
        "Computational Finance and Risk Management is a capacity-constrained Seattle major that uses a separate departmental application.",
        "The shared admission baseline is MATH 124, MATH 125, and MATH 126 or the honors equivalents, plus AMATH 301, with minimum 2.0 grades in each course and competitive applicants typically above a 2.50 GPA in that set.",
        "Transfer applicants submit the departmental application during the same quarter they apply to UW, and the current General Catalog states autumn entry with an April 5 spring-quarter deadline for transfer applicants.",
      ]),
      degreeMapSection("cfrm-core", "Standard B.S. in CFRM major core", [
        "The standard B.S. major runs 63-69 credits in the major depending on option details.",
        "The fixed core is AMATH 301 and CFRM 425 for computing, AMATH 351, AMATH 352, and AMATH 353 for introductory applied mathematics, and CFRM 405, CFRM 410, CFRM 415, and CFRM 420 for quantitative finance.",
        "After that core, students complete at least 26 more credits chosen from CFRM 421, CFRM 422, CFRM 426, CFRM 430, CFRM 442, CFRM 450, AMATH 481, AMATH 482, and AMATH 483.",
      ]),
      degreeMapSection("cfrm-ds", "CFRM Data Science option", [
        "The same General Catalog page also publishes a Data Science option inside CFRM.",
        "That option keeps the same calculus, AMATH 301, CFRM 425, AMATH 351-353, and CFRM 405-410-415-420 core, then replaces the advanced block with Data Science option requirements such as AMATH 481 or CSE 163, AMATH 482 or CSE 414 or INFO 430, AMATH 483, 1 of CFRM 421 or CSE/STAT 416 or STAT 435, plus INFO 351 or SOC 225 for Society and Data.",
      ],
      "The exact upper-division CFRM finish depends on whether the student stays in the standard B.S. or is admitted into the Data Science option."),
    ],
    manualReviewNotes: [
      "Treat the standard CFRM B.S. as the default row unless the student is explicitly targeting the Data Science option.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Construction Management")]: {
    officialLinks: [
      {
        label: "UW Construction Management admissions page",
        url: "https://admit.washington.edu/majors/construction-management/",
      },
      {
        label: "UW General Catalog Construction Management requirements",
        url: "https://www.washington.edu/students/gencat/program/S/ConstructionManagement-52.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("cm-admission", "Construction Management transfer admission path", [
        "Construction Management is capacity constrained, and transfer students apply through the upper-division admission pathway.",
        "That transfer pathway requires lower-division preparation in A&H, ECON 200 and MGMT 200, a physics sequence, 1 math course, ESS 101, 1 statistics or quantitative-methods course, English Composition, Reasoning, Writing, Diversity, CM 260, CM 220 or COM 220, and ACCTG 215 or ACCTG 219.",
        "The current catalog gives April 5 as the autumn admission deadline for that transfer pathway.",
      ]),
      degreeMapSection("cm-core", "Construction Management major core", [
        "The degree requires at least 180 total credits and at least 95 credits in the major.",
        "The lower-division CM 260, communications, and business-management prerequisites are required for admission but are not counted toward the minimum 95 major credits.",
        "The upper-division foundation is a long fixed sequence of ARCH 320, ARCH 321, CM 301, CM 310, CM 312, CM 313, CM 314, CM 320, CM 321, CM 322, CM 323, CM 331, CM 333, CM 335, CM 343, CM 410, CM 412, CM 414, CM 418, CM 420, CM 421, CM 423, CM 424, CM 429, and CM 434.",
      ]),
      degreeMapSection("cm-capstone", "Construction Management completion policies, business coursework, and capstone", [
        "Students also complete MGMT 300 or MGMT 305, CM 427 and CM 431 for the capstone experience, and at least 6 credits of approved construction electives.",
        "The catalog also publishes a dual-degree Construction Management with Architectural Design credential, but that route first requires admission into the Architectural Design major and then follows the Architecture page for the dual-degree specifics.",
      ]),
    ],
    manualReviewNotes: [
      "Use the standard B.S. in Construction Management as the default planner row unless the student is intentionally pursuing the Architectural Design dual-degree route.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Dance")]: {
    officialLinks: [
      {
        label: "UW Dance admissions page",
        url: "https://admit.washington.edu/majors/dance/",
      },
      {
        label: "UW General Catalog Dance requirements",
        url: "https://www.washington.edu/students/gencat/program/S/Dance-133.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("dance-admission", "Dance admission baseline", [
        "Dance is currently a minimum-requirements major with rolling declaration during autumn, winter, and spring.",
        "The admission baseline is a minimum 2.00 cumulative GPA, successful completion of 3 credits in any academic course required for the major, and completion of or current registration in at least 1 dance technique course.",
      ]),
      degreeMapSection("dance-core", "Dance major core coursework", [
        "The current catalog lists a single 56-credit B.A. in Dance rather than the older option-based structure.",
        "The fixed core is DANCE 150, DANCE 166, DANCE 242, DANCE 271, and DANCE 493 for 17 credits.",
      ]),
      degreeMapSection("dance-electives", "Dance studies, technique, and upper-division requirements", [
        "Students then complete 6-10 credits of Dance Studies coursework including at least 1 DIV course, 1 career transition course from DANCE 480 or DANCE 494, enough dance electives to reach at least 38 credits across the academic major buckets, and at least 18 technique credits that represent at least 4 different movement idioms.",
        "The major also requires at least 23 credits at the 300- or 400-level and at least a 2.00 GPA in courses applied to the major.",
      ],
      "The current General Catalog says the older Dance option credentials were replaced by a single major as of summer 2022, even though the admissions page still describes Creative Studies and Dance Studies options."),
    ],
    manualReviewNotes: [
      "Use the current single-major General Catalog structure rather than the older option labels that still appear on some admissions pages.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Danish")]: {
    officialLinks: [
      {
        label: "UW Danish admissions page",
        url: "https://admit.washington.edu/majors/danish/",
      },
      {
        label: "UW B.A. in Danish requirements",
        url: "https://scandinavian.washington.edu/ba-danish",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("dan-overview", "B.A. in Danish overall structure", [
        "The Department of Scandinavian Studies currently lists the Danish major as 60 credits, with at least 30 credits at the 300 level or above.",
        "The degree is built as a language-through-culture pathway rather than a loose elective major.",
      ]),
      degreeMapSection("dan-language", "Danish language and literature core", [
        "The fixed language core is 30 credits of first- and second-year Danish.",
        "Students then complete 10 more credits of upper-division Danish chosen from approved courses such as DANISH 310, DANISH 311, DANISH 312, DANISH 395, DANISH 399, and DANISH 490.",
      ]),
      degreeMapSection("dan-scand", "Scandinavian studies breadth and capstone", [
        "After the Danish-language core, students complete 15 credits of upper-division SCAND coursework from the approved departmental list and then finish with SCAND 498 Senior Capstone Project.",
        "The department also notes that DANISH 101 is offered only in autumn and that students with no prior Danish should start as early as possible because the language path spans eight academic quarters.",
      ]),
    ],
    manualReviewNotes: [
      "Danish is especially sequence-sensitive because the department says DANISH 101 is fall-only and the full language buildout typically spans eight quarters.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Design")]: {
    officialLinks: [
      {
        label: "UW Design admissions page",
        url: "https://admit.washington.edu/majors/design/",
      },
      {
        label: "UW Bachelor of Design admissions details",
        url: "https://art.washington.edu/design/bachelor-design-admissions",
      },
      {
        label: "UW General Catalog Design requirements",
        url: "https://www.washington.edu/students/gencat/program/S/Art+ArtHistory+Design-105.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("design-admission", "Bachelor of Design admission and shared setup", [
        "Design is a capacity-constrained School of Art major family with three Bachelor of Design outcomes: Industrial Design, Interaction Design, and Visual Communication Design.",
        "The current admissions setup uses a 3.00 minimum GPA plus DESIGN 166 or an approved equivalent, and transfer students apply for autumn admission only while also participating in the design workshop and selection process.",
      ]),
      degreeMapSection("design-id", "Industrial Design course list", [
        "The Industrial Design BDes currently requires 94-96 credits after admission to the program.",
        "Its exact course list is DESIGN 206, 207, 208, 209, 210, 211, 316, 317, 318, 319, 320, 322, 324, 326, 445, 446, 485, and 486, plus 10 credits of ART H coursework.",
      ]),
      degreeMapSection("design-ixd-vcd", "Interaction Design and Visual Communication Design course lists", [
        "Interaction Design currently requires 91-93 credits and uses DESIGN 206, 207, 208, 209, 210, 215, 325, 371, 372, 383, 384, 481, 483, 485, and 486, plus 10 credits chosen from DESIGN 326, 373, 374, 376, 400, and 467 and another 10 credits of ART H.",
        "Visual Communication Design also runs 91-93 credits and uses DESIGN 206, 207, 208, 209, 210, 214, 368, 369, 370, 371, 372, 376, 466, 467, 478, 485, and 486, plus 10 ART H credits.",
      ],
      "The exact upper-division Design finish depends on whether the student is admitted into Industrial Design, Interaction Design, or Visual Communication Design."),
    ],
    manualReviewNotes: [
      "Design is a family of three separate BDes programs, so the exact course list depends on the option the student wins admission into.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Disability Studies")]: {
    officialLinks: [
      {
        label: "UW Disability Studies admissions page",
        url: "https://admit.washington.edu/?p=46055",
      },
      {
        label: "UW Disability Studies major requirements",
        url: "https://disabilitystudies.washington.edu/DS_major",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("ds-admission", "Disability Studies admission baseline", [
        "Disability Studies is a minimum-requirements major that accepts applications at any time.",
        "The current eligibility baseline is a 2.0 UW GPA, at least 45 earned credits, and DIS ST/LSJ/CHID 230 completed with at least a 2.0 grade.",
      ]),
      degreeMapSection("ds-core", "Disability Studies core and required subfield structure", [
        "The current department major page uses a minimum 55-credit structure with at least 35 upper-division credits.",
        "The fixed core is DIS ST/LSJ/CHID 230 plus a thesis project completed as INDIV 493 or DIS ST 499.",
        "Students then complete 1 approved course from each of the 3 required subfields: Rights, Policy, and Inequality; Global and Historical Perspectives; and Diversity, Representation, and Identity.",
      ]),
      degreeMapSection("ds-electives", "Disability Studies electives and graduation rules", [
        "After the core and required subfield courses, students complete another 20-30 credits of adviser-approved electives, with at least 1 course from at least 2 of the subfields represented in the electives list.",
        "The department states that courses below the 300 level will not be approved as electives and that any course outside the approved lists must be reviewed by the Disability Studies adviser.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Drama")]: {
    officialLinks: [
      {
        label: "UW Drama admissions page",
        url: "https://admit.washington.edu/majors/drama/",
      },
      {
        label: "UW General Catalog Drama requirements",
        url: "https://www.washington.edu/students/gencat/program/S/Drama-134.html",
      },
      {
        label: "UW BA in Drama program requirements",
        url: "https://drama.washington.edu/ba-drama-program-requirements",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("drama-admission", "Drama admission and declaration baseline", [
        "Drama is currently a minimum-requirements major with DRAMA 201 as the entry course and no audition required for the B.A. routes.",
        "The School of Drama advising page says intended majors meet with the adviser after completing DRAMA 201, and students must maintain at least a 2.00 GPA in Drama coursework to remain in the major.",
      ]),
      degreeMapSection("drama-core", "Shared Drama major core", [
        "The General Catalog lists a shared 60-68 credit structure across the Drama, Drama: Design, and Drama: Performance credentials.",
        "All 3 routes require DRAMA 201, DRAMA 251, DRAMA 302, DRAMA 371, DRAMA 372, and DRAMA 373, plus DRAMA 290, DRAMA 291, DRAMA 292, and 1 choice course from DRAMA 365, DRAMA 416, DRAMA 494, or another adviser-approved course.",
      ]),
      degreeMapSection("drama-options", "Drama general, Design, and Performance option finishes", [
        "The general Drama B.A. then adds two courses from DRAMA 215, 221, and 222 plus 9 upper-division drama elective credits.",
        "The Design option adds DRAMA 221 and DRAMA 222 plus option-specific design coursework chosen from the design menus published in the catalog.",
        "The Performance option uses the same shared core but finishes with its own performance-focused option credits from the approved acting and performance menu.",
      ],
      "Drama has three official B.A. outcomes, so the exact upper-division finish depends on whether the student stays in the general route or chooses Design or Performance."),
    ],
    manualReviewNotes: [
      "Use the general Drama B.A. as the default row unless the student is intentionally targeting the Design or Performance option.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Early Childhood & Family Studies")]: {
    officialLinks: [
      {
        label: "UW Early Childhood & Family Studies admissions page",
        url: "https://admit.washington.edu/majors/early-childhood-family-studies/",
      },
      {
        label: "UW Early Childhood & Family Studies program page",
        url: "https://education.washington.edu/academics/program/early-childhood-family-studies",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("ecfs-admission", "ECFS admission and timing", [
        "Early Childhood and Family Studies is a capacity-constrained College of Education major with autumn and winter entry.",
        "The current application baseline is a 2.50 cumulative GPA, a 2.0 or higher in a 5-credit English composition course, and ECFS 200 completed with at least a 2.0 before the program starts.",
        "The program page notes that current students apply March 1 to April 15 for autumn or September 1 to October 15 for winter, and transfer students submit both the UW transfer application and the ECFS program application.",
      ]),
      degreeMapSection("ecfs-core", "ECFS fixed major coursework", [
        "The current on-campus Teaching and Learning pathway requires 79-81 credits in the major.",
        "The fixed major coursework includes ECFS 301, 303, 311, 312, 321, 400, 401, 402, 410, and 411; EDPSY 302 and EDPSY 406; EDUC 251; and IECMH 432.",
      ]),
      degreeMapSection("ecfs-selectives-capstone", "ECFS selectives, special education choice, and capstone", [
        "Students also complete 1 family-focused course chosen from ECFS 315, ECFS 419, or ECFS 320, and 1 inclusion-focused course chosen from EDSPE 304, EDSPE 414, EDSPE 427, or EDSPE 435.",
        "The senior finish is the three-quarter capstone sequence ECFS 454, ECFS 455, and ECFS 456.",
        "The program page also emphasizes required community-based learning placements across the degree and says the major takes at least 7 quarters to complete.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Earth & Space Sciences")]: {
    officialLinks: [
      {
        label: "UW Earth & Space Sciences admissions page",
        url: "https://admit.washington.edu/majors/earth-space-sciences/",
      },
      {
        label: "UW Earth and Space Sciences B.A. requirements",
        url: "https://web.geology.washington.edu/education/undergrad/degrees_ba.php",
      },
      {
        label: "UW Earth and Space Sciences B.S. requirements",
        url: "https://web.geology.washington.edu/education/undergrad/degrees_bs.php",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("ess-overview", "Earth & Space Sciences degree family", [
        "Earth and Space Sciences is an open major family with both a B.A. and multiple B.S. option paths.",
        "The admissions page describes the B.A. as the broader earth-science route and the B.S. as the more technical path, with current B.S. options in Geology, Biology, Physics, and Geoscience.",
      ]),
      degreeMapSection("ess-ba", "B.A. in Earth & Space Sciences", [
        "The published B.A. uses 30 credits of supporting science and 43-45 credits of ESS coursework plus a 15-credit concentration.",
        "The supporting science block requires CHEM 142, two quarters of calculus or quantitative science, one introductory physics course, and 10 more credits from the approved supporting-science list.",
        "The ESS portion requires multiple introductory ESS courses, 1 upper-division ESS methods/content course, and 25 upper-division ESS elective credits including at least 10 credits at the 400 level.",
      ]),
      degreeMapSection("ess-bs", "B.S. in Earth & Space Sciences option structure", [
        "The B.S. starts with a shared core of CHEM 142, MATH 124 and 125, PHYS 114/117 or 121, and three ESS core courses chosen from ESS 205, 211, 212, and 213.",
        "After that shared base, students complete one of the option-area finishes in Geology, Biology, Geoscience, or Physics, each with its own supporting-science package, ESS required courses, and advanced ESS electives.",
      ],
      "The exact upper-division finish for Earth & Space Sciences depends on whether the student is pursuing the broad B.A. or one of the B.S. options."),
    ],
    manualReviewNotes: [
      "Use the B.A. as the broad default path unless the student has clearly chosen a B.S. option in Geology, Biology, Geoscience, or Physics.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Economics")]: {
    officialLinks: [
      {
        label: "UW Economics admissions page",
        url: "https://admit.washington.edu/majors/economics/",
      },
      {
        label: "UW Economics BA requirements",
        url: "https://econ.washington.edu/bachelor-arts",
      },
      {
        label: "UW Economics BS requirements",
        url: "https://econ.washington.edu/bachelor-science",
      },
      {
        label: "UW Choosing Your Economics Degree guide",
        url: "https://econ.washington.edu/choosing-your-economics-degree",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("econ-admission", "Economics admission baseline", [
        "Economics is a minimum-requirements major, but both the B.A. and B.S. require a separate major application after students reach at least 45 college credits.",
        "The B.A. application uses ECON 200 and ECON 201 as prerequisites plus English Composition, while the B.S. adds statistics and the full MATH 124, 125, and 126 calculus sequence.",
        "The economics department currently requires at least a 2.5 cumulative GPA for prior college work and at UW, with additional course-specific minimums for the B.S. path.",
      ]),
      degreeMapSection("econ-ba", "B.A. in Economics structure", [
        "The B.A. uses a 50-credit economics major built around ECON 300, ECON 301, and ECON 382 or an approved higher econometrics substitute, plus five 400-level ECON electives.",
        "The department also states that ECON 300, ECON 301, and the econometrics requirement must be completed at UW Seattle and that at least 15 credits of 400-level ECON coursework must be taken at UW.",
      ]),
      degreeMapSection("econ-bs", "B.S. in Economics structure", [
        "The B.S. is the more quantitative route and uses ECON 300 and ECON 301 plus 15 credits of Theory and Methods courses and 15 more credits of 400-level ECON electives.",
        "Inside the Theory and Methods requirement, at least 5 credits must come from ECON 400 or 401 and at least 5 credits must come from ECON 424, 482, or 483.",
      ],
      "The exact Economics finish depends on whether the student is pursuing the B.A. or the more quantitative B.S."),
    ],
    manualReviewNotes: [
      "Use the B.A. as the default economics row unless the student clearly wants the B.S. and has the full calculus-plus-statistics preparation.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Education Studies")]: {
    officialLinks: [
      {
        label: "UW Education Studies admissions page",
        url: "https://admit.washington.edu/majors/education-studies/",
      },
      {
        label: "UW Education Studies program page",
        url: "https://education.washington.edu/academics/program/ba-education-studies-0",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("edst-admission", "Education Studies admission baseline", [
        "Education Studies is a minimum-requirements major.",
        "The current declaration baseline is 45 earned credits, at least a 2.0 cumulative GPA, at least a 2.0 in English Composition, and at least a 2.0 in one introductory education course chosen from ECFS 200, EDUC 240, or EDUC 280.",
        "The admissions page also notes that transfer students should plan to take one of those intro education courses during their first UW quarter if possible.",
      ]),
      degreeMapSection("edst-foundation", "Education Studies shared foundation", [
        "The current Education Studies program page says all EDST students complete 30 credits of foundational coursework plus 20-22 credits in one chosen option.",
        "The shared 30-credit foundation is EDUC 251, EDUC 310, 12 credits of 300-level-or-above College of Education electives, 1 intro education course from the ECFS 200 / EDUC 240 / EDUC 280 set, and 1 human-development course from EDPSY 302, EDPSY 404, or EDPSY 380.",
      ]),
      degreeMapSection("edst-options", "Education Studies options", [
        "The admissions page and program page describe current options in Early Childhood Studies, Education Research and Policy, Foundations of Teaching, Multilingual/Language in Education, and Sports and Education.",
        "Students then complete 20-22 credits inside the option they choose after the shared foundation.",
      ],
      "Education Studies uses a shared foundation plus option-specific coursework, so the exact upper-division finish depends on the chosen option."),
    ],
    manualReviewNotes: [
      "Use the shared Education Studies foundation as the stable baseline until the student chooses one of the five current options.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Education, Communities & Organizations")]: {
    officialLinks: [
      {
        label: "UW Education, Communities & Organizations admissions page",
        url: "https://admit.washington.edu/majors/education-communities-organizations/",
      },
      {
        label: "UW Education, Communities and Organizations program page",
        url: "https://education.washington.edu/academics/program/eco",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("eco-admission", "ECO admission baseline", [
        "Education, Communities and Organizations is a capacity-constrained College of Education major.",
        "The current program page says students need 45 completed credits, at least a 2.50 cumulative GPA, EDUC 280 with at least a 2.0 grade, and English Composition with at least a 2.5 grade before beginning the major.",
        "The program currently accepts autumn applications from March 1 to April 15 and winter applications from September 1 to October 15.",
      ]),
      degreeMapSection("eco-structure", "ECO major structure and internship spine", [
        "The ECO program page lists the degree as 69 credits.",
        "It describes the degree as a structured blend of human development, equity studies, learning across contexts, and organizational-change coursework paired with a 3-4 quarter internship and a 3-quarter capstone seminar in the final year.",
      ]),
      degreeMapSection("eco-practice", "ECO community-based learning and capstone expectations", [
        "The program emphasizes community-based learning through sustained work with organizations led by and serving systemically oppressed communities.",
        "Students build their final major work through the internship sequence and the three-quarter capstone rather than a single one-course senior finish.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "English - Creative Writing")]: {
    officialLinks: [
      {
        label: "UW English Creative Writing admissions page",
        url: "https://admit.washington.edu/majors/english-creative-writing/",
      },
      {
        label: "UW English major Creative Writing option requirements",
        url: "https://english.washington.edu/english-major-creative-writing-option",
      },
      {
        label: "UW Creative Writing option application details",
        url: "https://english.washington.edu/how-apply-undergraduate-creative-writing-option",
      },
      {
        label: "UW English LLC option requirements",
        url: "https://english.washington.edu/english-language-literature-and-culture-option",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("cw-admission", "Creative Writing admission baseline", [
        "The Creative Writing concentration is the capacity-constrained English option.",
        "Students must already be declared in, or eligible to declare, the English major and must complete ENGL 202, ENGL 283, and ENGL 284 or approved transfer equivalents before applying.",
        "Applications are currently accepted only in autumn, winter, and spring and are due by the third Friday of the quarter.",
      ]),
      degreeMapSection("cw-core", "Creative Writing major core", [
        "The current Creative Writing option requires 65 ENGL credits, with at least 30 completed in residence at UW.",
        "The fixed coursework is ENGL 202, the workshop sequence ENGL 283, ENGL 284, ENGL 383, and ENGL 384, plus two 400-level Creative Writing seminars.",
        "Creative Writing students do not separately take ENGL 302 or the usual English senior capstone because ENGL 383 and 384 stand in for the critical-practice requirement and the two 400-level CW seminars fulfill the capstone role.",
      ]),
      degreeMapSection("cw-distribution", "Creative Writing historical and power/distribution requirements", [
        "Creative Writing students also complete 15 credits in Historical Depth and 15 credits in Power and Difference.",
        "All Creative Writing courses count toward Genre, Method, and Language, so students in this option do not separately complete that third distribution bucket.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "English - Language, Literature & Culture")]: {
    officialLinks: [
      {
        label: "UW English LLC admissions page",
        url: "https://admit.washington.edu/majors/english-language-literature-culture/",
      },
      {
        label: "UW English LLC option requirements",
        url: "https://english.washington.edu/english-language-literature-and-culture-option",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("engllc-admission", "English major admission baseline", [
        "The Language, Literature, and Culture route is the minimum-requirements English major.",
        "Students declare by meeting with a Humanities Academic Services adviser and need at least a 2.00 overall UW GPA plus at least a 2.50 English GPA across prior college-level English coursework.",
      ]),
      degreeMapSection("engllc-core", "Language, Literature, and Culture shared core", [
        "The current LLC option requires 60 ENGL credits, with at least 30 completed in residence at UW and no more than 20 credits at the 200 level counting toward the major.",
        "The core sequence is ENGL 202, ENGL 302, and a senior capstone chosen from the approved capstone list.",
      ]),
      degreeMapSection("engllc-distribution", "Language, Literature, and Culture distribution model", [
        "After the core sequence, students complete 15 credits in Historical Depth, 15 credits in Power and Difference, and 15 credits in Genre, Method, and Language.",
        "The department notes that many courses overlap categories, but each course can satisfy only one requirement in the degree audit.",
        "Except for Creative Writing students, no more than 5 credits of Creative Writing may count toward the LLC major.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Environmental Design & Sustainability")]: {
    officialLinks: [
      {
        label: "UW Environmental Design & Sustainability admissions page",
        url: "https://admit.washington.edu/?p=47802",
      },
      {
        label: "UW General Catalog Environmental Design and Sustainability requirements",
        url: "https://www.washington.edu/students/gencat/program/S/LandscapeArchitecture-53.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("eds-admission", "Environmental Design & Sustainability admission baseline", [
        "Environmental Design and Sustainability is currently an open major in the College of Built Environments.",
        "Students in good academic standing may declare it at any time.",
      ]),
      degreeMapSection("eds-core", "Environmental Design & Sustainability fixed core", [
        "The current General Catalog lists a 50-credit B.A. major.",
        "The fixed 22-credit core is L ARCH 210, L ARCH 211, L ARCH 212, L ARCH 300, and L ARCH 370.",
        "Students also take one historical-context course from L ARCH 352, 353, or 454.",
      ]),
      degreeMapSection("eds-concentrations", "Environmental Design & Sustainability concentrations and interdisciplinary selectives", [
        "Students then complete one 11-credit area of concentration in Environmental Design Technologies, Environmental Design Practice, or Environmental Design Equity.",
        "The major also requires 12 credits of interdisciplinary selectives, with at least 3 credits at the 300 or 400 level, chosen from the approved list on the department site.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Environmental Public Health")]: {
    officialLinks: [
      {
        label: "UW Environmental Public Health admissions page",
        url: "https://admit.washington.edu/majors/environmental-health/",
      },
      {
        label: "UW Environmental Public Health degree requirements",
        url: "https://www.deohs.washington.edu/degree-requirements",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("eph-admission", "Environmental Public Health admission baseline", [
        "Environmental Public Health is a minimum-requirements major in the School of Public Health.",
        "For transfer planning, Admissions lists BIOL 180, BIOL 200, BIOL 220, 5 credits of English composition, and one approved general-plus-organic chemistry pathway as the required preparation.",
        "The admissions page also notes that upper-division applicants should present at least a 2.5 cumulative GPA, at least a 2.0 in each prerequisite course, and 90 or more credits or 6 or more quarters completed at the time of application.",
      ]),
      degreeMapSection("eph-core", "Environmental Public Health science foundation and fixed core", [
        "The degree-requirements page adds supporting science in math, statistics, physics PHYS 114/117, biology BIOL 180/200/220, and one approved chemistry sequence alongside School of Public Health general-education requirements.",
        "The fixed Environmental Public Health core is ENV H 311, ENV H 312, ENV H 320, ENV H 405, ENV H 432, ENV H 433, ENV H 472, ENV H 473, ENV H 480, ENV H 482, EPI 320, MICROM 301, and MICROM 302.",
        "The department states that all courses applied to the degree must be completed with a minimum grade of 2.0.",
      ]),
      degreeMapSection(
        "eph-selectives",
        "Environmental Public Health selectives and approved electives",
        [
          "Students then complete a minimum of 3 Environmental Public Health selectives from the department's approved list; students who entered the major before Winter 2026 follow the older 4-selective rule.",
          "The degree also requires 15 credits from the department's approved elective list.",
          "ENV H 482 is the required internship course and the department describes it as a 400-hour internship inside the major core.",
        ],
        "The Winter 2026 update changed the selective minimum and added ENV H 312 for newer cohorts, so adviser review is still important when a student is following an older catalog year."
      ),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Environmental Science & Terrestrial Resource Management")]: {
    officialLinks: [
      {
        label: "UW ESRM admissions page",
        url: "https://admit.washington.edu/majors/environmental-science-terrestrial-resource-management/",
      },
      {
        label: "UW General Catalog ESRM degree requirements",
        url: "https://www.washington.edu/students/gencat/academic/sefs.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("esrm-admission", "Environmental Science & Terrestrial Resource Management admission baseline", [
        "Environmental Science and Terrestrial Resource Management is a minimum-requirements major in the College of the Environment.",
        "Admissions lists calculus through the second course, introductory chemistry plus a second chemistry or OCEAN 295 course, biology, and English composition as the required transfer preparation.",
        "Students declare after completing the minimum admission courses with at least a 2.00 cumulative GPA in those admission requirements.",
      ]),
      degreeMapSection("esrm-shared", "Shared ESRM lower-division and core structure", [
        "The current general catalog describes shared groundwork in calculus, statistics, biology, chemistry, earth-systems coursework, economics, writing, and broader university requirements before and alongside the major.",
        "Across ESRM degree paths, the shared major core is ESRM 200, ESRM 201, ESRM 250, ESRM 300 or SBSE 300, and ESRM 304.",
      ]),
      degreeMapSection(
        "esrm-options",
        "Current ESRM option structure",
        [
          "Admissions currently lists 4 curricular options: Landscape Ecology and Conservation, Restoration Ecology and Environmental Horticulture, Sustainable Forest Management, and Wildlife Conservation.",
          "Each option then adds its own prescribed upper-division course block, option-specific electives, and capstone path.",
          "The general-catalog examples show that exact upper-division requirements vary substantially by option, even though the admission prep and core transfer launchpad are shared.",
        ],
        "This planner row should be treated as a shared ESRM transfer-prep baseline until the student picks a specific ESRM option."
      ),
    ],
    manualReviewNotes: [
      "Confirm the student's intended ESRM option before treating the upper-division UW course map as final.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Environmental Studies")]: {
    officialLinks: [
      {
        label: "UW Environmental Studies admissions page",
        url: "https://admit.washington.edu/majors/environmental-studies/",
      },
      {
        label: "UW Environmental Studies course-planning guide",
        url: "https://envstudies.uw.edu/students/major-in-environmental-studies/course-planning/",
      },
      {
        label: "UW General Catalog Environmental Studies requirements",
        url: "https://www.washington.edu/students/gencat/program/S/ProgramontheEnvironment-1070.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("envst-admission", "Environmental Studies admission baseline", [
        "Environmental Studies is a minimum-requirements major in the College of the Environment.",
        "Program on the Environment advises students to prioritize ENVIR 100 together with any 200-level or higher course so they can declare the major early.",
      ]),
      degreeMapSection("envst-core", "Environmental Studies fixed core", [
        "The required core is ENVIR 100, ENVIR 101, ENVIR 301, ENVIR 302, and ENVIR 401.",
        "The general catalog requires at least a 2.0 in each core course except ENVIR 101.",
      ]),
      degreeMapSection("envst-integrating", "Integrating Disciplines requirement model", [
        "Students complete one approved course in each of 8 Integrating Disciplines areas: Analytical Methods, Biological Systems, Earth Systems Literacy, Economics and Business, Environmental Justice, Policy and Governance, Sustainability, and Values and Cultures.",
        "That Integrating Disciplines block totals 28 to 40 credits, at least 2 of the 8 courses must be at the 300/400 level, and a course listed in multiple categories can count in only one area.",
      ]),
      degreeMapSection("envst-capstone", "Environmental Studies capstone finish", [
        "The capstone experience is a minimum 15 credits from ENVIR 490, ENVIR 491, and ENVIR 492.",
        "Students need at least a 2.0 in each capstone course, and students pursuing a double major or double degree may overlap only 15 credits with Environmental Studies.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Ethnomusicology, B.A.")]: {
    officialLinks: [
      {
        label: "UW Ethnomusicology admissions page",
        url: "https://admit.washington.edu/majors/ethnomusicology-b-a/",
      },
      {
        label: "UW General Catalog Ethnomusicology requirements",
        url: "https://www.washington.edu/students/gencat/program/S/Music-217.html",
      },
      {
        label: "UW School of Music BA in Ethnomusicology overview",
        url: "https://music.washington.edu/ba-ethnomusicology",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("ethno-admission", "Ethnomusicology admission baseline", [
        "Ethnomusicology, B.A. is a capacity-constrained School of Music program.",
        "Admission requires at least a 3.0 in either MUSIC 251 or MUSIC 252, at least a 2.0 in every MUSIC course taken, at least a 2.50 cumulative GPA, and department application materials describing the student's musical interests and goals.",
      ]),
      degreeMapSection("ethno-core", "Ethnomusicology shared core", [
        "The major totals 51 to 67 credits.",
        "The fixed core is MUSIC 201, MUSIC 202, MUSIC 203, MUSIC 204, MUSIC 205, MUSIC 206, MUSIC 251, MUSIC 252, MUSIC 499, and at least 6 quarters of MUSEN 389 and/or MUSAP 389.",
      ]),
      degreeMapSection("ethno-breadth", "Ethnomusicology upper-division breadth and electives", [
        "Students also complete at least 3 approved 400-level ethnomusicology courses for 9 to 15 credits.",
        "The degree further requires one approved sociocultural anthropology elective and two approved interdisciplinary electives.",
        "The School of Music frames this degree as a liberal-arts music pathway, so the broader 180-credit College of Arts & Sciences bachelor's structure still applies outside the major.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "European Studies")]: {
    officialLinks: [
      {
        label: "UW European Studies admissions page",
        url: "https://admit.washington.edu/majors/european-studies/",
      },
      {
        label: "UW General Catalog European Studies requirements",
        url: "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html",
      },
      {
        label: "UW Jackson School European Studies program page",
        url: "https://jsis.washington.edu/programs/undergraduate/european-studies/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("euro-admission", "European Studies admission baseline", [
        "European Studies is an open major in the Henry M. Jackson School of International Studies.",
        "The major requires the equivalent of second-year proficiency in a modern European language by graduation, either through coursework or placement testing.",
      ]),
      degreeMapSection("euro-core", "European Studies fixed major structure", [
        "The current general-catalog major is 50 credits plus language proficiency.",
        "The fixed core is JSIS A 301 and JSIS 201, followed by 10 credits of European history, 5 credits of global electives, and 20 credits of approved European Studies electives with at least 15 credits at the 300/400 level.",
        "The senior finish is JSIS A 494 or JSIS A 495, and students need at least a 2.0 cumulative GPA in courses applied to the major.",
      ]),
      degreeMapSection("euro-electives", "European Studies interdisciplinary elective model", [
        "The approved-course lists are interdisciplinary and draw from fields such as history, political science, philosophy, religion, literature, and language study focused on Europe.",
        "Jackson School planning pages point students to the current approved-course guide for the exact quarter-by-quarter elective menu.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Finnish")]: {
    officialLinks: [
      {
        label: "UW Finnish admissions page",
        url: "https://admit.washington.edu/majors/finnish/",
      },
      {
        label: "UW Finnish degree requirements",
        url: "https://scandinavian.washington.edu/ba-finnish",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("finn-admission", "Finnish admission baseline", [
        "Finnish is an open major in Scandinavian Studies, and Admissions strongly recommends completing first- and second-year Finnish before transfer when possible.",
        "The department notes that FINN 101 is offered only in autumn, so students should start the language sequence as early as possible unless they place beyond the first year.",
      ]),
      degreeMapSection("finn-core", "Finnish language foundation", [
        "The major requires 60 credits, with 25 at the 300 level or above.",
        "The language foundation is first- and second-year Finnish for 30 credits.",
      ]),
      degreeMapSection("finn-upper", "Finnish upper-division language, culture, and capstone work", [
        "Students then complete 10 credits of approved upper-division FINN courses such as FINN 310, FINN 395, FINN 399, or FINN 490.",
        "The major also requires 15 credits of approved upper-division SCAND courses and ends with SCAND 498 Senior Capstone Project.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Food Systems, Nutrition, & Health")]: {
    officialLinks: [
      {
        label: "UW Food Systems, Nutrition, & Health admissions page",
        url: "https://admit.washington.edu/majors/food-systems-nutrition-health/",
      },
      {
        label: "UW Food Systems declare-the-major page",
        url: "https://foodsystems.uw.edu/undergraduate/foodsystems/declare/",
      },
      {
        label: "UW Food Systems major requirements",
        url: "https://foodsystems.uw.edu/undergraduate/foodsystems/requirements/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("fsnh-admission", "Food Systems, Nutrition, & Health admission baseline", [
        "Food Systems, Nutrition, and Health is a minimum-requirements major in the School of Public Health.",
        "To declare the major, students need 45 college credits, a minimum 2.00 cumulative GPA, NUTR 200 or an approved equivalent, and 5 credits of English composition.",
        "The department notes that juniors may apply while the declaration courses are in progress, but because of course sequencing the degree typically still takes 5 to 6 quarters to finish.",
      ]),
      degreeMapSection("fsnh-foundation", "Food Systems lower-division and methods foundation", [
        "The lower-division structure includes 10 credits of Science Literacy, 15 credits of Interdisciplinary Breadth, and 9 to 10 credits of Research Methods and Technologies.",
        "The methods block specifically requires one approved statistics course plus one approved qualitative-methods course.",
      ]),
      degreeMapSection("fsnh-core", "Food Systems upper-division core and concentration electives", [
        "The fixed Food Systems core is NUTR 200, NUTR 302, NUTR 303, NUTR 402, NUTR 412, and NUTR 493.",
        "Students then complete at least 20 credits of approved 300-/400-level electives, organized by the program's concentration themes in business, environment, nutrition, and social equity.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "French")]: {
    officialLinks: [
      {
        label: "UW French admissions page",
        url: "https://admit.washington.edu/majors/french/",
      },
      {
        label: "UW French undergraduate studies overview",
        url: "https://frenchitalian.washington.edu/undergraduate-studies-french",
      },
      {
        label: "UW French major requirements",
        url: "https://frenchitalian.washington.edu/major-french-studies",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("french-admission", "French admission baseline", [
        "French is an open major, and Admissions strongly encourages transfer students to complete as much lower-division French as possible before arriving at UW.",
        "The department states that the major requires 50 approved credits above FRENCH 203.",
      ]),
      degreeMapSection("french-core", "French required language and literature sequence", [
        "The fixed sequence is FRENCH 203, FRENCH 301, FRENCH 302, and FRENCH 303.",
        "Students also take one course at the FRENCH 370 level or FRENCH 320, plus 2 additional 400-level French courses.",
      ]),
      degreeMapSection("french-electives", "French electives and policy notes", [
        "The remaining 15 credits come from the approved elective list above FRENCH 203.",
        "Up to 15 credits of approved study-abroad work may be petitioned into the major, and courses applied to the major need a minimum 2.00 cumulative GPA.",
        "Prerequisites are specific: FRENCH 203 is required before FRENCH 301 or 302, and either FRENCH 301 or FRENCH 302 is enough to unlock FRENCH 303.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Gender, Women & Sexuality Studies")]: {
    officialLinks: [
      {
        label: "UW Gender, Women & Sexuality Studies admissions page",
        url: "https://admit.washington.edu/majors/gender-women-sexuality-studies/",
      },
      {
        label: "UW General Catalog GWSS requirements",
        url: "https://www.washington.edu/students/gencat/program/S/Gender%2CWomen%2CandSexualityStudies-298.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("gwss-admission", "Gender, Women & Sexuality Studies admission baseline", [
        "Gender, Women and Sexuality Studies is an open major.",
        "Admissions recommends GWSS 200 plus one additional introductory course such as GWSS 206, GWSS 257, GWSS 283, or GWSS 290 before transfer, and the department expects at least a 2.0 cumulative GPA to declare.",
      ]),
      degreeMapSection("gwss-core", "GWSS shared core", [
        "The current general-catalog major is 55 credits.",
        "The fixed core is GWSS 200, GWSS 302, one approved sexuality/queer/trans studies course, and one approved upper-division transnational-perspective course.",
      ]),
      degreeMapSection("gwss-electives", "GWSS electives, capstone, and residency rules", [
        "Students then complete 30 elective credits, including at least 10 credits at the 400 level.",
        "The capstone course is GWSS 494.",
        "The catalog also limits majors to 5 combined credits of GWSS 497 and GWSS 499, allows at most 10 credits taken credit/no-credit with only 5 of those at the 400 level, and requires at least 20 credits toward the major in residence at UW.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Geography")]: {
    officialLinks: [
      {
        label: "UW Geography admissions page",
        url: "https://admit.washington.edu/majors/geography/",
      },
      {
        label: "UW Geography B.A. requirements",
        url: "https://geography.washington.edu/ba-geography",
      },
      {
        label: "UW Geography data science option requirements",
        url: "https://geography.washington.edu/ba-geography-data-science-option",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("geog-admission", "Geography admission baseline", [
        "Geography is a minimum-requirements major.",
        "Students declare after completing any GEOG-prefix course at the 200 level or above with at least a 2.0 and maintaining a minimum cumulative UW GPA of 2.00.",
        "Admissions identifies 2 current curricular options: the standard B.A. in Geography and the B.A. in Geography with Data Science Option.",
      ]),
      degreeMapSection("geog-ba", "Standard B.A. in Geography", [
        "The standard B.A. requires 60 GEOG credits.",
        "Students complete 20 credits of breadth by taking one course from each of the 4 tracks, then 20 credits of depth by taking 4 upper-division courses in one chosen track, at least 2 of them at the 400 level.",
        "The B.A. also requires GEOG 315, one approved methods course, and at least 2 additional GEOG electives at the 200 level or above.",
      ]),
      degreeMapSection("geog-ds", "B.A. in Geography with Data Science Option", [
        "The data science option requires 60 to 65 credits and starts with a foundations block that includes one approved introductory computing or data course, one quantitative-methods course, 5 credits from a designated geography track, GEOG 360, and GEOG 315.",
        "The upper-division data science finish then requires 2 programming courses, 1 machine-learning course, and 25 credits of upper-division GIS, Mapping, and Society coursework.",
        "No single course may count toward more than one requirement, and the department requires at least a 2.00 cumulative GPA in courses applied to the major.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm whether the student is aiming for the standard Geography B.A. or the Data Science Option before treating the exact upper-division map as final.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "German")]: {
    officialLinks: [
      {
        label: "UW German Studies degree requirements",
        url: "https://german.washington.edu/german-studies",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("german-foundation", "German Studies language foundation", [
        "The current B.A. in German Studies requires 51 credits total.",
        "The required language sequence starts with GERMAN 203, then 2 courses from GERMAN 301, 302, and 303, followed by GERMAN 401.",
        "Because German 101, 201, and 301 are offered only in autumn, the department tells students to start as early as possible unless they place beyond the first year.",
      ]),
      degreeMapSection("german-core", "German Studies required literary-study core", [
        "The fixed major core also includes GERMAN 311 Introduction to Literary Studies.",
        "Students then take 2 additional 400-level literature courses such as GERMAN 411, 421, 422, 423, or 497.",
      ]),
      degreeMapSection("german-electives", "German Studies electives and advanced-language notes", [
        "The remaining 20 credits are electives chosen from language, literature, culture, and linguistics offerings.",
        "If a student places out of language requirements like GERMAN 203, 301, 302, 303, or 401, those waived requirements are replaced by elective credits.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Global Literary Studies")]: {
    officialLinks: [
      {
        label: "UW Global Literary Studies degree requirements",
        url: "https://slavic.washington.edu/ba-global-literary-studies-glits",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("glits-admission", "Global Literary Studies admission baseline", [
        "Global Literary Studies is an open major.",
        "Students in good academic standing may declare the major at any time.",
      ]),
      degreeMapSection("glits-core", "Global Literary Studies fixed core", [
        "The current B.A. is a 53 to 55 credit major.",
        "Students begin with one introductory course from GLITS 250, GLITS 251, GLITS 252, or GLITS 253.",
        "They then complete 20 credits of Literature Across Boundaries coursework drawn from at least 2 of 5 categories: Across Times, Across Languages, Across Places, Across Genres/Modes, and Across Disciplines.",
      ]),
      degreeMapSection("glits-finish", "Global Literary Studies integrative experience and electives", [
        "The fixed integrative experience course is GLITS 450.",
        "Students also complete 23 to 25 elective credits from approved GLITS-boundary courses, second-year-or-above language courses up to the department maximum, or other approved electives.",
        "At least 30 credits applied to the major must be at the 300 or 400 level.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Greek")]: {
    officialLinks: [
      {
        label: "UW Greek degree requirements",
        url: "https://classics.washington.edu/ba-greek",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("greek-language", "Greek language sequence", [
        "The B.A. in Greek requires 52 to 58 credits.",
        "Students complete either the beginning language sequence GREEK 101, 102, and 103 or the accelerated path through GREEK 300 and GREEK 301.",
        "After that foundation, the major requires 15 additional credits of 300-level GREEK courses, excluding GREEK 300 and GREEK 301.",
      ]),
      degreeMapSection("greek-upper", "Greek upper-division literature and related-study structure", [
        "The major then requires 15 credits of 400-level GREEK courses.",
        "Students also complete 10 approved credits in classics in English, classical art and archaeology, ancient history, the history of ancient philosophy, or the history of ancient science.",
      ]),
      degreeMapSection("greek-capstone", "Greek capstone", [
        "The capstone requirement is CLAS 495 Senior Essay.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Guitar, B.M.")]: {
    officialLinks: [
      {
        label: "UW Guitar Bachelor of Music requirements",
        url: "https://music.washington.edu/bachelor-music-guitar",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("guitar-admission", "Guitar B.M. admission and graduation baseline", [
        "The Bachelor of Music is the School of Music's professional performance degree and is intended for especially qualified students admitted through audition.",
        "The degree requires 180 total credits, including at least 60 credits outside the School of Music.",
        "Music courses counting toward the degree require at least a 2.0 in each course, and the School requires a 2.5 GPA in music for graduation.",
      ]),
      degreeMapSection("guitar-core", "Guitar B.M. pre-core and theory/history core", [
        "The published pre-core is MUSIC 113, MUSIC 119, and MUSIC 120 or a proficiency exam.",
        "The fixed theory/history core includes MUSIC 201, 202, 203, 204, 205, 206, 210, 211, 212, 301, 302, 303, 304, and 306, plus at least 3 credits from MUSIC 250, 251, 252, or a 400-level ethnomusicology course.",
      ]),
      degreeMapSection("guitar-performance", "Guitar B.M. performance, ensemble, and recital finish", [
        "The performance block includes approved upper-level music-theory or history electives, MUSIC 487 or 438, MUSICP 338 and MUSICP 438, the repertoire sequence MUSIC 326, 327, 328, the pedagogy sequence MUSIC 434, 435, 436, the conducting sequence MUSIC 380, 381, 382, junior and senior recitals, and additional music electives.",
        "Guitar ensemble MUSEN 308 is required during every quarter of lessons, and students also need piano proficiency equivalent to MUSAP 235.",
        "The published major total is 120 music credits.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "History")]: {
    officialLinks: [
      {
        label: "UW History major requirements",
        url: "https://history.washington.edu/major",
      },
      {
        label: "UW History undergraduate programs overview",
        url: "https://history.washington.edu/undergraduate-programs",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("history-admission", "History admission baseline", [
        "History is a minimum-requirements major.",
        "Students declare after completing a 2.00 UW GPA, 10 credits of college history with a 2.50 average, and 10 credits of writing/composition with at least a 2.0 in each course.",
      ]),
      degreeMapSection("history-core", "History shared major structure", [
        "The history major requires 60 credits.",
        "Students complete at least one 5-credit course in 4 of 6 geographic/transregional fields, plus at least 10 credits in pre-modern history and 10 credits in modern history.",
        "At least 30 upper-division history credits must be completed in residence at UW.",
      ]),
      degreeMapSection("history-seminars", "History seminars, electives, and thematic options", [
        "All history majors take HSTRY 388 within two quarters of declaring and then complete one approved undergraduate senior seminar.",
        "The rest of the major is approved elective coursework to reach 60 credits with at least a 2.25 GPA across courses applied to the major.",
        "Students can also pursue thematic history options such as Empire and Colonialism, Race, Gender, and Power, Religion and Society, or War and Society, each built on the same 60-credit shared framework.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "History & Philosophy of Science")]: {
    officialLinks: [
      {
        label: "UW General Catalog History and Philosophy of Science requirements",
        url: "https://www.washington.edu/students/gencat/program/S/Philosophy-221.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("hps-admission", "History & Philosophy of Science admission baseline", [
        "The HPS major requires HSTCMP 311, HSTCMP 312, PHIL 120, and either PHIL 160 or PHIL 460 for admission, each with at least a 2.0 grade.",
        "Admission also requires 10 Natural World credits with at least a 2.0 in each course, 10 writing/composition credits with at least a 2.0 in each course, and a minimum 2.00 UW GPA.",
      ]),
      degreeMapSection("hps-core", "History & Philosophy of Science fixed core", [
        "The major totals 85 credits.",
        "The 25-credit core is HSTCMP 311, HSTCMP 312, HSTCMP 390, PHIL 120, and either PHIL 160 or PHIL 460, with a minimum 2.0 in each course and a 2.50 GPA across the core.",
      ]),
      degreeMapSection("hps-electives", "HPS electives, capstone, and science component", [
        "Students then complete 25 elective credits from the approved HPS list, including at least 10 PHIL credits and at least 5 HIST credits.",
        "The capstone course is HPS 400.",
        "The degree also requires a 30-credit Natural World science component, including at least 15 credits outside mathematics, with a minimum 2.50 GPA across those science courses.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Individualized Studies")]: {
    officialLinks: [
      {
        label: "UW General Studies Individualized Studies requirements",
        url: "https://www.washington.edu/students/gencat/program/S/GeneralStudies-185.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("inds-overview", "Individualized Studies program structure", [
        "Individualized Studies is an interdisciplinary self-designed major for students whose intended field is not available as a standard UW major.",
        "There is no single fixed course list for all students; each student builds an approved curriculum around a central interdisciplinary theme.",
      ]),
      degreeMapSection("inds-proposal", "Individualized Studies proposal requirements", [
        "The proposed major plan normally includes 50 to 70 quarter credits drawn from at least 2 departments, with most courses at the 300/400 level.",
        "At least half of the selected major credits must come from courses taught within the College of Arts and Sciences.",
        "Students need at least 2 faculty sponsors, committee approval, and final approval from an Individualized Studies adviser, and transfer students must already be enrolled at UW before applying.",
      ]),
      degreeMapSection("inds-completion", "Individualized Studies completion requirements", [
        "The published completion range is 55 to 70 credits, including the approved curriculum and a required 5-credit senior study.",
        "The senior study requires a minimum 2.7 grade.",
      ]),
    ],
    manualReviewNotes: [
      "Because Individualized Studies is student-designed, the exact UW course list must be finalized case by case with the approved faculty sponsors and adviser.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "International Studies")]: {
    officialLinks: [
      {
        label: "UW General Catalog International Studies overview",
        url: "https://www.washington.edu/students/gencat/program/S/JacksonSchoolofInternationalStudies-190.html",
      },
      {
        label: "UW Jackson School undergraduate programs overview",
        url: "https://jsis.washington.edu/programs/undergraduate/",
      },
      {
        label: "UW Jackson School capstone courses",
        url: "https://jsis.washington.edu/programs/undergraduate/international-studies/capstonecourses/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("is-admission", "International Studies admission baseline", [
        "International Studies is an open Jackson School major.",
        "The program emphasizes writing, foreign language study, and interdisciplinary regional or thematic coursework rather than one single fixed lower-division prerequisite set.",
      ]),
      degreeMapSection("is-structure", "International Studies concentration-based structure", [
        "The Jackson School states that students in the general International Studies major can pursue a broad course of study, one of multiple regional concentrations, or one of the school's thematic concentrations.",
        "Because the exact course map depends on the chosen concentration, the major does not use one single universal upper-division checklist across all International Studies students.",
      ]),
      degreeMapSection("is-capstone", "International Studies capstone finish", [
        "The current Jackson School capstone menu for International Studies majors includes options such as JSIS 490 Public Writing in International Studies, JSIS 495 Task Force, and JSIS 498 Advanced Readings in International Studies.",
        "Students should expect the final major plan to be built around an approved concentration plus one of those capstone pathways.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm the student's regional or thematic International Studies concentration before treating the exact UW course map as final.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Italian")]: {
    officialLinks: [
      {
        label: "UW Italian Studies major status page",
        url: "https://frenchitalian.washington.edu/major-italian-studies",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("italian-status", "Current Italian major status", [
        "The department states that it is not currently able to offer the upper-division courses for the Italian Studies major.",
        "Because of that, the department says it is not accepting new students into the Italian Studies major and students may not currently declare it.",
      ]),
      degreeMapSection("italian-planning", "Planning note for students interested in Italian", [
        "The current department page directs students to consider the Italian Language and Culture minor instead of the inactive major.",
      ]),
    ],
    manualReviewNotes: [
      "Treat this row as reference-only until the department resumes admitting students to the Italian major.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Japanese")]: {
    officialLinks: [
      {
        label: "UW Japanese degree requirements",
        url: "https://asian.washington.edu/ba-japanese",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("japan-language", "Japanese language foundation", [
        "The Japanese Language and Literature major requires 50 to 75 credits depending on the student's starting language level.",
        "Students complete 5 to 20 credits of Japanese language coursework drawn from second-year, third-year, and approved fourth-/fifth-year Japanese, with at least 5 credits at the level of JAPAN 303 or JAPAN 334 or above.",
        "The department notes that first-year Japanese is offered in fall or summer, and students should begin early unless placement testing puts them above the introductory level.",
      ]),
      degreeMapSection("japan-literature", "Japanese linguistics, literature, and culture block", [
        "The major also requires a minimum of 30 credits in approved Japanese linguistics, literature, and/or culture courses.",
        "At least 5 of those 30 credits must come from the department's advanced-course list, such as JAPAN 434, 435, 460, 461, 441, 442, or 443.",
      ]),
      degreeMapSection("japan-policies", "Japanese major policy notes", [
        "Up to 5 of the 30 literature/culture credits may come from approved courses outside the department.",
        "Courses used to satisfy the language requirement may not also count toward the literature/culture requirement.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Jazz Studies, B.M.")]: {
    officialLinks: [
      {
        label: "UW Jazz Studies Bachelor of Music requirements",
        url: "https://music.washington.edu/bachelor-music-jazz-studies",
      },
      {
        label: "UW Bachelor of Music overview",
        url: "https://music.washington.edu/bachelor-music",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("jazz-admission", "Jazz Studies, B.M. admission and graduation baseline", [
        "The Bachelor of Music is intended for especially qualified students who want professional training in performance and requires admission through the School of Music audition process.",
        "The degree requires a minimum of 180 total credits, including at least 60 credits outside the School of Music.",
        "Music majors must earn at least a 2.0 in every music course counted toward the degree and a 2.5 GPA in music for graduation.",
      ]),
      degreeMapSection("jazz-core", "Jazz Studies, B.M. pre-core and theory/history core", [
        "The published pre-core is MUSIC 113, MUSIC 119, and MUSIC 120 or proficiency by exam.",
        "The fixed theory and history core is MUSIC 201, 202, 203, 204, 205, 206, 210, 211, 212, 301, 302, 303, 304, and 306.",
        "Jazz Studies students also complete at least 3 credits from MUSIC 250, 251, 252, or any 400-level ethnomusicology course as part of the common core.",
      ]),
      degreeMapSection("jazz-performance", "Jazz Studies, B.M. performance, ensemble, and recital finish", [
        "The published Jazz Studies requirements also include MUSIC 131, MUHST 425, MUSIC 336, MUSIC 426, MUSIC 467, MUSIC 468, MUSIC 469, MUSIC 379, MUSIC 479, and 6 credits of MUSIC 464 Jazz Laboratory.",
        "Students complete applied study through MUSICP 320-338 and MUSICP 420-438, plus MUSICP 367, 368, and 369 for jazz improvisation skills.",
        "At least one approved ensemble is required during every quarter of applied music instruction, chosen from MUSEN 340, 345, 346, or 446, and students must meet piano proficiency equivalent to MUSAP 235.",
        "The published music-major total for Jazz Studies is 126 music credits.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Jewish Studies")]: {
    officialLinks: [
      {
        label: "UW Jewish Studies major requirements",
        url: "https://jsis.washington.edu/programs/undergraduate/jewish-studies/",
      },
      {
        label: "UW Jackson School undergraduate programs overview",
        url: "https://jsis.washington.edu/programs/undergraduate/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("jewish-overview", "Jewish Studies major overview", [
        "Jewish Studies is listed by the Jackson School as an open major.",
        "The major requires 50 credits total.",
      ]),
      degreeMapSection("jewish-core", "Jewish language and introductory core", [
        "Students complete either 2 years of college-level coursework in one Jewish language or 1 year each in 2 different Jewish languages, unless proficiency testing places them beyond those requirements.",
        "The 15-credit introductory core is RELIG 145, JEW ST 250 or HSTCMP 250, and one of JSIS 200, JSIS 201, or JSIS 202.",
      ]),
      degreeMapSection("jewish-electives", "Jewish Studies electives and policy limits", [
        "Students then complete a minimum of 35 credits of approved Jewish Studies electives, including at least 25 credits at the 300- or 400-level.",
        "The program allows at most 10 credits from second-year Jewish language courses and at most 15 non-language credits from approved UW study abroad programs to count toward the major.",
        "Courses applied to the major must average at least a 2.00 cumulative GPA.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Korean")]: {
    officialLinks: [
      {
        label: "UW Korean degree requirements",
        url: "https://asian.washington.edu/ba-korean",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("korean-language", "Korean language foundation", [
        "The Korean Language and Literature major requires 50 to 75 credits depending on the student's incoming language level.",
        "Students complete 15 to 45 credits of language coursework drawn from KOREAN 101, 102, 103, 201, 202, 203, 301, 302, 303, and 415, 416, 417, with at least 15 credits taken beyond the second year.",
        "The department notes that introductory Korean is typically offered in autumn or summer and encourages students to begin early unless placement testing places them above the first year.",
      ]),
      degreeMapSection("korean-area", "Korean literature, culture, and area-studies block", [
        "The major also requires 30 to 35 credits of area-related humanities and social science coursework.",
        "The approved list includes KOREAN 304, 360, 365, 435, 440, and 442, additional advanced Korean readings courses, and approved courses from Asian Languages and Literature, Anthropology, History, Jackson School, Political Science, and Linguistics when the Korea-focused topic matches the department list.",
      ]),
      degreeMapSection("korean-policies", "Korean major policy notes", [
        "Students who complete only the minimum 15 credits of language coursework must complete the full 35 credits of area-related humanities and social science coursework to reach the required major total.",
        "Courses used to satisfy the language requirement may not also count toward the area-related humanities and social science requirement.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Landscape Architecture")]: {
    officialLinks: [
      {
        label: "UW General Catalog Landscape Architecture requirements",
        url: "https://www.washington.edu/students/gencat/program/S/LandscapeArchitecture-53.html",
      },
      {
        label: "UW Landscape Architecture undergraduate admissions",
        url: "https://larch.be.uw.edu/admissions/undergraduate/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("larch-admission", "Landscape Architecture admission baseline", [
        "The Bachelor of Landscape Architecture is capacity constrained and uses a spring-quarter application for autumn admission.",
        "The minimum admission requirements are L ARCH 300 plus at least 69 credits in general education coursework.",
        "The department's current admissions page also recommends preparation in L ARCH 322, 341, 352, 353, 361, 363, and ESS 101, even though those courses are not all required for admission.",
      ]),
      degreeMapSection("larch-gened", "Landscape Architecture total-credit and general-education baseline", [
        "The professional BLA requires at least 180 total credits.",
        "The general-education structure includes one English composition course, 10 additional writing credits, 20 credits each of A&H, SSc, and NSc, Reasoning, and Diversity.",
        "The catalog specifically notes that the natural-science block includes one geology course that serves as the prerequisite for ESS 301, ESS 305, or ESS 315/ENVIR 313.",
      ]),
      degreeMapSection("larch-major", "Landscape Architecture major studio and technical sequence", [
        "The BLA major itself requires at least 111 credits: L ARCH 401, 402, and 403; four advanced studios chosen from L ARCH 404, 405, 406, 407, 474, 475, or B E 405; and L ARCH 424.",
        "The fixed lecture and methods requirements are two history courses from L ARCH 352, 353, 454; the theory sequence L ARCH 341, 361, 363; graphics courses L ARCH 411, 440, 441; professional practice L ARCH 473; and construction courses L ARCH 431, 432, 433, and 434.",
        "Students also complete approved plants and plant-identification coursework, one geology course from ESS 301, ESS 305, or ESS 315/ENVIR 313, and at least 12 credits of directed electives spanning ecology and forestry, environmental law and policy, and urban design and planning.",
        "The catalog requires at least a 2.0 in every course applied to the major.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Latin")]: {
    officialLinks: [
      {
        label: "UW Latin degree requirements",
        url: "https://classics.washington.edu/ba-latin",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("latin-language", "Latin language sequence", [
        "The B.A. in Latin requires 52 to 58 credits.",
        "Students complete either LATIN 101, 102, and 103 or the accelerated path through LATIN 300 and LATIN 301.",
        "After that foundation, the major requires 15 credits of 300-level LATIN courses, excluding LATIN 300 and LATIN 301.",
      ]),
      degreeMapSection("latin-upper", "Latin upper-division literature and related-study structure", [
        "The major then requires 15 credits of 400-level LATIN courses.",
        "Students also complete 10 approved credits in classics in English, classical art and archaeology, ancient history, the history of ancient philosophy, or the history of ancient science.",
      ]),
      degreeMapSection("latin-capstone", "Latin capstone", [
        "The capstone requirement is CLAS 495 Senior Essay.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Latin American & Caribbean Studies")]: {
    officialLinks: [
      {
        label: "UW Latin American and Caribbean Studies major requirements",
        url: "https://jsis.washington.edu/programs/undergraduate/latin-america-and-caribbean-studies/",
      },
      {
        label: "UW Jackson School undergraduate programs overview",
        url: "https://jsis.washington.edu/programs/undergraduate/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("lacs-overview", "Latin American and Caribbean Studies major overview", [
        "Latin American and Caribbean Studies is listed by the Jackson School as an open major.",
        "The major requires 52 credits total.",
      ]),
      degreeMapSection("lacs-core", "LACS fixed course structure", [
        "The required structure is JSIS 201, 10 credits of LACS history, 15 credits of contemporary LACS coursework, 15 credits of LACS electives, JSIS A 492 Latin American Studies Seminar, and JSIS 493 Senior Research.",
        "The major uses a built-in regional history and contemporary-studies structure rather than one single unrestricted elective list.",
      ]),
      degreeMapSection("lacs-language", "LACS language and grade requirements", [
        "Students must show proficiency through the second year or third quarter of a second-year primary language such as Spanish, French, or Portuguese.",
        "They must also show proficiency through the first year or third quarter of a first-year second language.",
        "A minimum 2.0 grade is required in all courses applied to the major.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Law, Societies & Justice")]: {
    officialLinks: [
      {
        label: "UW LSJ Gold Curriculum requirements",
        url: "https://lsj.washington.edu/lsj-gold-curriculum-requirements",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("lsj-overview", "LSJ Gold Curriculum overview", [
        "The current LSJ Gold Curriculum, effective for newly admitted majors from Autumn 2024 onward, requires 56 to 60 credits.",
        "The department emphasizes that the degree plan is built from approved requirement buckets and that one course cannot count toward multiple LSJ requirement sections at the same time.",
      ]),
      degreeMapSection("lsj-core", "LSJ core and 300-level requirements", [
        "The 20-credit core is one introductory Law, Societies & Justice course, 10 credits of approved 300-level human-rights or law coursework, and one 400-level LSJ capstone seminar.",
        "Students also complete at least four additional 300-level LSJ courses for a minimum of 20 credits.",
      ]),
      degreeMapSection("lsj-electives", "LSJ upper-division electives and degree policies", [
        "The remaining upper-division requirement is 16 to 20 credits, including at least four upper-division courses of at least 3 credits each and at least one additional 400-level course.",
        "LSJ also expects students to finish the UW and College of Arts and Sciences general-education requirements alongside the major.",
        "The approved-course lists for the core, 300-level, and elective buckets are maintained on the department's Gold Curriculum page and include many cross-listed courses.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Linguistics")]: {
    officialLinks: [
      {
        label: "UW Linguistics B.A. requirements",
        url: "https://linguistics.washington.edu/ba-linguistics",
      },
      {
        label: "UW Linguistics undergraduate language requirement",
        url: "https://linguistics.washington.edu/undergraduate-language-requirement",
      },
      {
        label: "UW Linguistics undergraduate programs and admissions",
        url: "https://linguistics.washington.edu/undergraduate-programs",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("ling-admission", "Linguistics admission baseline", [
        "Prospective majors complete one year of college language study or demonstrate first-year proficiency, one writing course or a second composition course, an introductory linguistics course such as LING 200 or LING 400, and one additional reasoning course.",
        "The department requires at least a 2.0 in each of those admission courses and at least a 2.50 GPA across the writing, introductory linguistics, and reasoning courses used for admission.",
      ]),
      degreeMapSection("ling-core", "Linguistics shared core and language requirements", [
        "The major requires 50 credits in addition to the language requirement.",
        "The fixed 25-credit core is LING 450, LING 451, LING 461, LING 462, and one LING 4XX course other than LING 400, 419, 430, 480, 490, or 499.",
        "Students also complete 30 credits of language study by taking one year of two languages, with at least one language from a different family than the student's native language; they may test out of one language but not both.",
      ]),
      degreeMapSection("ling-electives", "Linguistics electives and GPA rules", [
        "The major includes 20 elective credits in linguistics or approved related fields.",
        "The department says upper-division Linguistics or Romance Linguistics courses normally count, and approved courses in other departments may also count toward the elective requirement.",
        "Students are expected to maintain at least a 2.0 GPA in courses applied to the major and at least a 2.0 cumulative GPA.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Marine Biology")]: {
    officialLinks: [
      {
        label: "UW Marine Biology major requirements",
        url: "https://marinebiology.uw.edu/students/marine-biology-major/major-requirements/",
      },
      {
        label: "UW Marine Biology approved elective list",
        url: "https://marinebiology.uw.edu/students/marine-biology-major/electives/",
      },
      {
        label: "UW Marine Biology integrative field experience",
        url: "https://marinebiology.uw.edu/students/marine-biology-major/integrative-field-experience/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("marbio-foundation", "Marine Biology science and math foundation", [
        "The current Marine Biology worksheet says the minimum general-education and major requirements total 106 to 113 credits, and the degree still sits inside UW's 180-credit bachelor's framework.",
        "The foundation block is 48 to 55 credits in science and mathematics: chemistry through either CHEM 120 plus CHEM 220 or OCEAN 295, or the CHEM 142 and 152 sequence plus CHEM 220, CHEM 223, or OCEAN 295; biology through BIOL 180, BIOL 200, and either BIOL 220 or MARBIO/FISH/OCEAN 270; one statistics course from Q SCI 381 or STAT 311; one math sequence from MATH 124 and 125 or Q SCI 291 and 292; and one physics sequence from PHYS 114 and 115, PHYS 121 and 122, or PHYS 114/121 plus OCEAN 285 and 286.",
      ]),
      degreeMapSection("marbio-core", "Marine Biology required marine-science core", [
        "The introduction-to-the-marine-environment block requires either FISH/OCEAN/BIOL 250 or OCEAN 200 plus 201, followed by OCEAN 210.",
        "The communication requirement is MARBIO 305.",
        "The fixed 15-credit core is FISH 323, MARBIO/FISH/OCEAN 370, and OCEAN 330.",
      ]),
      degreeMapSection("marbio-electives", "Marine Biology electives and field-experience finish", [
        "Students complete 25 elective credits, including at least one course each in Biodiversity, Ecology and Ecosystems, and Organismal Processes, with at least two lab courses and at least three 400-level courses.",
        "The approved elective list currently includes courses such as BIOL 434, FISH 310, MARBIO 433, FISH 470, FISH 340, FISH 460, OCEAN 402, and multiple Friday Harbor Labs offerings, with at most 6 credits of independent research applying to the elective total.",
        "All majors also complete a 6-credit Integrative Field Experience, most often at Friday Harbor Labs, after meeting readiness requirements that include OCEAN 210, physiology coverage through BIOL 220 or MARBIO 270, MARBIO 305 or FHL 333, one statistics course, and three upper-division elective or core courses including at least one core course.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Medical Laboratory Science")]: {
    officialLinks: [
      {
        label: "UW Medical Laboratory Science program requirements",
        url: "https://dlmp.uw.edu/education/mls-requirements",
      },
      {
        label: "UW Medical Laboratory Science program overview",
        url: "https://dlmp.uw.edu/education/mls-undergrad",
      },
      {
        label: "UW Medical Laboratory Science application page",
        url: "https://dlmp.uw.edu/education/mls-apply",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("mls-preprofessional", "Medical Laboratory Science pre-professional phase", [
        "The MLS bachelor's program is a full-time 2+2 structure with a pre-professional phase followed by a professional phase.",
        "Before entry into the professional phase, students complete at least 90 quarter credits including BIOL 180, 200, and 220; CHEM 142, 152, and 162; one quarter or one semester of organic chemistry through CHEM 223 or CHEM 237; and one basic statistics course.",
        "The program does not accept calculus in place of the required statistics prerequisite.",
      ]),
      degreeMapSection("mls-admission", "Medical Laboratory Science admission and graduation baseline", [
        "Applicants need at least a 2.50 cumulative GPA and a 2.50 science GPA to be considered, and completed applications are due February 15 for autumn entry.",
        "The School of Medicine graduation requirements also require English composition, additional writing, reasoning, arts and humanities, social sciences, and diversity credits by graduation, even if they are not all finished before the professional phase begins.",
      ]),
      degreeMapSection("mls-professional", "Medical Laboratory Science professional phase and clinical finish", [
        "The professional phase lasts the final two years, with the first four quarters focused on didactic and campus-based laboratory instruction in subjects including bacteriology, biochemistry, clinical chemistry, clinical hematology, clinical microbiology, coagulation, immunohematology, immunology, molecular diagnostics, mycology, parasitology, phlebotomy, virology, and related laboratory methods.",
        "The final two quarters are full-time clinical placements in UW Medical Center and affiliated clinical laboratories.",
        "Graduates earn the Bachelor of Science in Medical Laboratory Science and become eligible to take the national MLS certification examination.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Microbiology")]: {
    officialLinks: [
      {
        label: "UW Microbiology major overview",
        url: "https://microbiology.washington.edu/undergraduate-program/major-microbiology",
      },
      {
        label: "UW Microbiology admission requirements",
        url: "https://microbiology.washington.edu/undergraduate-program/admission-requirements",
      },
      {
        label: "UW Microbiology major course requirements",
        url: "https://microbiology.washington.edu/undergraduate-program/major-course-requirements",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("micro-admission", "Microbiology admission baseline", [
        "Microbiology is a minimum-admissions major with no separate competitive application once the prerequisites are complete.",
        "Students need at least 75 credits applicable to graduation, a minimum cumulative UW GPA of 2.0, and at least a 2.50 cumulative GPA across the prerequisite biology and chemistry coursework.",
        "The published prerequisites are BIOL 180, BIOL 200, BIOL 220, CHEM 142, CHEM 152, CHEM 162, and one organic chemistry path through CHEM 223, CHEM 237, or CHEM 335.",
      ]),
      degreeMapSection("micro-core", "Microbiology major core and required upper-division work", [
        "The department's current major-course page points students to the Microbiology Degree Requirements and Electives packet as the official graduation checklist.",
        "That current requirements page explicitly lists MICROM 410 Fundamentals of Microbiology, MICROM 402 General Microbiology Lab, and MICROM 496 Library Research Paper as required major coursework.",
        "The same page says students then complete the department's required upper-division distribution areas using approved courses such as IMMUN 441, MICROM 442, MICROM 443, MICROM 445, MICROM 450, MICROM 460, MICROM 411, MICROM 412, MICROM 431, and ENV H 409.",
      ]),
      degreeMapSection("micro-electives", "Microbiology electives and planning notes", [
        "After the required distribution areas are satisfied, students complete approved electives to reach the department's current major-credit total, with the course-requirements page specifically noting electives to reach 28 credits when the distribution areas are satisfied.",
        "The department also flags current course-planning changes on the major-course page, including that MICROM 461 is no longer offered as a lab partner to MICROM 460 and that MICROM 435 is no longer available after autumn 2024.",
        "Students are expected to use the department's updated degree packet and course schedule, not just MyPlan or Degree Audit, when finalizing the exact upper-division sequence.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Middle Eastern Languages & Cultures")]: {
    officialLinks: [
      {
        label: "UW Admissions Middle Eastern Languages & Cultures overview",
        url: "https://admit.washington.edu/majors/middle-eastern-languages-cultures/",
      },
      {
        label: "UW General Catalog Middle Eastern Languages & Cultures requirements",
        url: "https://www.washington.edu/students/gencat/program/S/MiddleEasternLanguagesandCultures-123.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("melc-admission", "Middle Eastern Languages & Cultures admission baseline", [
        "Middle Eastern Languages & Cultures is an open major.",
        "Both the admissions page and the General Catalog say students in good academic standing may declare at any time and should begin Middle Eastern language study as early as possible.",
      ]),
      degreeMapSection("melc-options", "Middle Eastern Languages & Cultures current degree options", [
        "The current Seattle major offers three B.A. options: Biblical and Ancient Near Eastern Studies, Comparative Cultures, and Languages and Literatures.",
        "All three options use a 72-credit major framework anchored by MELC 101, a senior seminar requirement through MELC 491, and substantial language and upper-division regional coursework.",
      ]),
      degreeMapSection("melc-option-details", "Option-specific course structures", [
        "Biblical and Ancient Near Eastern Studies requires MELC 101, MELC 201, MELC 202/RELIG 240, two years of Biblical Hebrew or an approved ancient-language combination, MELC 491, 25 supporting elective credits, and MELC 498 for the senior essay.",
        "Comparative Cultures requires MELC 101, one 200-level Middle East course, 30 credits in a primary Middle Eastern language, MELC 491, MELC 498, and 25 elective credits at the 300 level or above.",
        "Languages and Literatures requires MELC 101, one 200-level Middle East course, 30 credits in a primary language, 10 credits of advanced primary-language coursework, MELC 491, and 20 supporting elective credits.",
        "The catalog also requires at least 22 credits in residence through the department, and some options require at least 25 credits at the 300/400 level.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm whether the student is aiming for Biblical and Ancient Near Eastern Studies, Comparative Cultures, or Languages and Literatures before treating the exact UW course map as final.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Music Composition, B.M.")]: {
    officialLinks: [
      {
        label: "UW Bachelor of Music - Composition",
        url: "https://music.washington.edu/bachelor-music-composition",
      },
      {
        label: "UW Bachelor of Music overview",
        url: "https://music.washington.edu/bachelor-music",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("music-comp-admission", "Music Composition, B.M. admission and degree baseline", [
        "The Bachelor of Music in Composition is a professional degree that requires 180 total credits, including at least 60 credits outside the School of Music.",
        "Music courses applied to the degree require at least a 2.0 in each course and a 2.5 GPA in music for graduation.",
        "The Composition program starts at the second-year level and requires successful completion of MUSIC 202/205, MUSIC 120, and MUSIC 216, 217, 218 before the composition application and portfolio review.",
      ]),
      degreeMapSection("music-comp-core", "Music Composition pre-core and common theory/history core", [
        "The published pre-core is MUSIC 113, MUSIC 119, and MUSIC 120 or a proficiency exam.",
        "The shared theory and history core is MUSIC 201, 202, 203, 204, 205, 206, 210, 211, 212, 301, 302, 304, and 305, plus at least 3 credits from MUSIC 250, 251, 252, or a 400-level ethnomusicology course.",
        "Students also complete MUSIC 216, 217, and 218 in the introductory composition sequence and two years of private instruction or approved applied study.",
      ]),
      degreeMapSection("music-comp-finish", "Music Composition upper-division composition finish", [
        "The upper-division composition block includes MUSIC 303, MUSIC 306, PHYS 207, 18 credits of approved upper-level music theory or history electives, one 400-level ethnomusicology course, and MUSIC 391/491 private instruction in composition.",
        "Students also complete MUSIC 400 or DXARTS 460, one of MUSIC 471 or 472, the conducting sequence MUSIC 380, 381, and 382, and MUSIC 496 Instrumentation.",
        "The page lists 116 to 122 major credits, excluding pre-core and piano, and requires piano proficiency equivalent to MUSAP 235.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Music Education, B.M.")]: {
    officialLinks: [
      {
        label: "UW Bachelor of Music - Music Education, Instrumental Emphasis",
        url: "https://music.washington.edu/bachelor-music-music-education-instrumental-emphasis",
      },
      {
        label: "UW Bachelor of Music - Music Education, Vocal Emphasis",
        url: "https://music.washington.edu/bachelor-music-music-education-vocal-emphasis",
      },
      {
        label: "UW Bachelor of Music overview",
        url: "https://music.washington.edu/bachelor-music",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("music-ed-admission", "Music Education, B.M. admission and certification baseline", [
        "The Bachelor of Music in Music Education is a professional 180-credit degree that includes at least 60 credits outside the School of Music.",
        "Students must first achieve music-major status through a School of Music performance audition and then pass a separate Music Education entrance audition.",
        "The program leads to Washington K-12 music-teaching certification after full-time student teaching, but the certification student-teaching course itself is listed separately from the degree requirements.",
      ]),
      degreeMapSection("music-ed-core", "Music Education shared pre-core and theory/history core", [
        "Both the instrumental and vocal emphasis pages use the same 36-credit theory/history core after the pre-core MUSIC 113, MUSIC 119, and MUSIC 120.",
        "That shared core is MUSIC 201, 202, 203, 204, 205, 206, 210, 211, 212, 301, 302, 303, 304, 305, and 306, plus at least 3 credits from MUSIC 250, 251, 252, or a 400-level ethnomusicology course.",
        "Both emphases also include MUSED 301, MUSED 304, MUSED 305, MUSED 340, MUSED 440, MUSED 452, MUSED 465, MUSED 403, technique study outside the principal area, private instruction, ensemble participation, and small additional education-course requirements.",
      ]),
      degreeMapSection("music-ed-emphases", "Instrumental and vocal emphasis differences", [
        "The instrumental emphasis uses the conducting sequence MUSIC 380, 381, and 382 plus MUSED 442 Instrumental Curriculum and either MUSED 405 or MUSEN 303, and requires piano proficiency equivalent to MUSAP 135.",
        "The vocal emphasis uses MUSIC 350, 351, and 352 for choral conducting plus MUSED 443 Choral Curriculum, and its ensemble requirements emphasize choral participation; vocal students must satisfy piano proficiency equivalent to MUSAP 235, while piano students meet an alternate vocal-training expectation.",
        "The vocal emphasis page lists 119 major credits and both emphasis pages list MUSEC 404 full-time student teaching as required for Washington certification but not as a degree requirement.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm whether the student is aiming for the Instrumental/General or Vocal/General emphasis before treating the exact course map as final.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Music, B.A.")]: {
    officialLinks: [
      {
        label: "UW Bachelor of Arts in Music overview",
        url: "https://music.washington.edu/bachelor-arts",
      },
      {
        label: "UW Bachelor of Arts - Music, Instrumental Option",
        url: "https://music.washington.edu/bachelor-arts-music-instrumental-option",
      },
      {
        label: "UW Bachelor of Arts - Music, Voice Option",
        url: "https://music.washington.edu/bachelor-arts-music-voice-option",
      },
      {
        label: "UW Bachelor of Arts - Music, Music History Option",
        url: "https://music.washington.edu/bachelor-arts-music-music-history-option",
      },
      {
        label: "UW Bachelor of Arts - Music, Music Theory Option",
        url: "https://music.washington.edu/bachelor-arts-music-music-theory-option",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("music-ba-overview", "Music, B.A. general degree framework", [
        "The Seattle Bachelor of Arts in Music is a liberal-arts music degree that requires 180 total credits, with 90 credits taken outside the School of Music.",
        "The School of Music currently lists four options inside this degree: Instrumental, Voice, Music History, and Music Theory.",
        "All options require at least a 2.0 in each music course used for the degree and a 2.5 GPA in music for graduation.",
      ]),
      degreeMapSection("music-ba-shared-core", "Music, B.A. shared pre-core and common core", [
        "The options share the same pre-core MUSIC 113, MUSIC 119, and MUSIC 120 or proficiency, followed by a 36-credit theory/history core of MUSIC 201, 202, 203, 204, 205, 206, 210, 211, 212, 301, 302, 303, 304, and 306 plus at least 3 credits from MUSIC 250, 251, 252, or a 400-level ethnomusicology course.",
        "The instrumental option then adds 6 credits of approved upper-level music theory or history electives, 18 credits of MUSICP instrumental instruction, ensemble participation every quarter of applied instruction, and piano proficiency equivalent to MUSAP 135.",
      ]),
      degreeMapSection("music-ba-options", "Music, B.A. option-specific upper-division finishes", [
        "The Voice option adds 6 credits of upper-level music electives, 18 credits of MUSICP 320 voice lessons, MUSIC 307, 308, and 309 diction for singers, and a first-year language sequence in two languages from French, German, and/or Italian.",
        "The Music Theory option adds MUSIC 470, MUSIC 471, 6 credits of approved upper-level music theory electives, and applied study, while the Music History option adds history-focused upper-division coursework and requires a 3.0 average across MUHST courses.",
        "Because the exact upper-division finish changes by option, the row should be finalized with the student's intended Instrumental, Voice, Music History, or Music Theory path in mind.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm the student's B.A. option before treating the exact UW course list as final.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Neuroscience")]: {
    officialLinks: [
      {
        label: "UW Undergraduate Neuroscience overview",
        url: "https://sites.uw.edu/neusci/",
      },
      {
        label: "UW Undergraduate Neuroscience admissions",
        url: "https://sites.uw.edu/neusci/admissions/",
      },
      {
        label: "UW Undergraduate Neuroscience degree requirements",
        url: "https://sites.uw.edu/neusci/about/degree-requirements/",
      },
      {
        label: "UW Undergraduate Neuroscience course list",
        url: "https://sites.uw.edu/neusci/about/courses/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("neuro-admission", "Neuroscience admission baseline", [
        "Neuroscience is a small space-constrained cohort major that currently admits 72 students annually.",
        "Applicants must complete BIOL 180, BIOL 200, and BIOL 220 with at least a 2.0 in each course and at least a 2.5 GPA across the supporting coursework completed at the time of application.",
        "The admissions page says Biology 180, 200, and 220 are the only courses required to apply, though most students complete additional chemistry and math beforehand.",
      ]),
      degreeMapSection("neuro-science-foundation", "Neuroscience science and math foundation", [
        "The degree requirements page starts with a chemistry block, an 8-credit physics block, a 10-credit mathematics block, and the full biology majors sequence.",
        "Chemistry can follow the nursing-oriented CHEM 120, 220, 221 route, the short organic route through CHEM 142, 152 and CHEM 223, 224, or the full pre-health route through CHEM 142, 152, 162 plus CHEM 237, 238, 239 or CHEM 335, 336, 337.",
        "Physics can be PHYS 114 and 115 or PHYS 121 and 122, and mathematics can be MATH 124 and 125 or Q SCI 291 and 292.",
      ]),
      degreeMapSection("neuro-core", "Neuroscience required core and electives", [
        "The required neuroscience core is NEUSCI 301 and 302 followed by NEUSCI 401, 402, 403, and 404.",
        "Students then complete 16 credits of approved advanced electives from the program's neuroscience elective list.",
        "The current program allows up to 7 credits of undergraduate research, seminars, peer facilitation, and internships to count toward those 16 elective credits.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Norwegian")]: {
    officialLinks: [
      {
        label: "UW Norwegian degree requirements",
        url: "https://scandinavian.washington.edu/ba-norwegian",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("norw-overview", "Norwegian major overview", [
        "The B.A. in Norwegian requires 60 credits, with 25 credits at the 300 level or above.",
        "The department notes that NORW 101 is offered only in autumn and encourages students to begin as early as possible unless they place higher.",
      ]),
      degreeMapSection("norw-language", "Norwegian language and literature structure", [
        "The first block is 30 credits of first- and second-year Norwegian language coursework.",
        "Students then complete 10 upper-division credits in Norwegian from approved courses such as NORW 310, 311, 312, 321, 395, 399, or 490.",
      ]),
      degreeMapSection("norw-scand-capstone", "Scandinavian studies breadth and capstone", [
        "The major also requires 15 upper-division SCAND credits from an approved list that includes literature, folklore, history, culture, cinema, politics, and Baltic studies courses.",
        "The required capstone is SCAND 498 Senior Capstone Project.",
        "Credits earned during study in Norway can be transferred in consultation with the department, and other substitutions can be approved by the undergraduate adviser.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Nursing")]: {
    officialLinks: [
      {
        label: "UW Seattle BSN overview",
        url: "https://nursing.uw.edu/academics/bsn/",
      },
      {
        label: "UW BSN prerequisite worksheet",
        url: "https://nursing.uw.edu/wp-content/uploads/2025/05/BSN-Prerequisites-Worksheet.pdf",
      },
      {
        label: "UW BSN current curriculum grid",
        url: "https://students.nursing.uw.edu/wp-content/uploads/2025/09/BSN-2025-Curriuculum-Grid.pdf",
      },
      {
        label: "UW School of Nursing curriculum index",
        url: "https://students.nursing.uw.edu/academics/program-of-study/curriculum/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("nurs-overview", "Seattle BSN program structure", [
        "The Seattle Bachelor of Science in Nursing is a two-year, six-quarter professional program that students enter as juniors after completing at least 90 quarter credits or a prior bachelor's degree.",
        "The current BSN page describes the program as a full-time prelicensure curriculum with academic coursework, simulation, and more than 600 hours of supervised patient-care experience.",
        "The current curriculum grid covers six quarters beginning in autumn and uses a fixed cohort sequence rather than an individually assembled upper-division elective plan.",
      ]),
      degreeMapSection("nurs-prereqs", "Seattle BSN prerequisite foundation before program entry", [
        "The current BSN prerequisite worksheet requires communications, reasoning, natural sciences, social sciences, and arts and humanities before program start, for a total prerequisite range of 74 to 81 credits plus electives to reach 90 quarter credits.",
        "The prerequisite categories include English composition; an additional writing or composition course; one college-level math or philosophy-logic course; statistics; six natural-science requirements in general chemistry, organic chemistry, human anatomy, human physiology, general microbiology with lab, and nutrition; lifespan growth and development; two additional social-science courses; and 15 arts-and-humanities credits.",
        "To apply, students need either three completed natural-science prerequisites with a 3.0 GPA or four completed natural-science prerequisites with a 2.8 GPA, and before starting the program they must complete all remaining prerequisites and hold a 2.8 GPA across all six natural-science prerequisites.",
      ]),
      degreeMapSection("nurs-curriculum", "Seattle BSN professional-phase curriculum", [
        "The current autumn 2025 curriculum grid begins with NCLIN 302, NCLIN 306, NURS 303, NURS 304, and NURS 420 in the first quarter, then continues through NCLIN 409 and NURS 401 in winter and NCLIN 407, NMETH 403, NURS 405, and NURS 412 in spring.",
        "Year two includes NCLIN 418, NURS 417, NURS 422, and NURS 452 in autumn; NCLIN 403, NCLIN 416, NMETH 450, NURS 415, and NURS 431 in winter; and NCLIN 411, NURS 419, and NURS 457 in spring, with NCLIN 475 interprofessional-practice registration spanning the second year.",
        "The BSN information page and current-students curriculum index present this as the fixed current Seattle professional sequence.",
      ]),
    ],
    manualReviewNotes: [
      "This row reflects the Seattle prelicensure BSN, not the RN-to-BSN completion paths offered on other UW campuses.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Oceanography")]: {
    officialLinks: [
      {
        label: "UW Oceanography undergraduate degrees overview",
        url: "https://www.ocean.washington.edu/story/Undergraduate_Degrees",
      },
      {
        label: "UW Bachelor Degrees in Oceanography",
        url: "https://www.ocean.washington.edu/story/Bachelor_Degrees_in_Oceanography",
      },
      {
        label: "UW Oceanography basic math and science courses",
        url: "https://www.ocean.washington.edu/story/Basic_Math_and_Science_Courses",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("ocean-foundation", "Oceanography shared science and math foundation", [
        "The School of Oceanography offers both a B.A. and a B.S. in Oceanography, and both begin with the same interdisciplinary foundation in biology, chemistry, physics, mathematics, and geology.",
        "The foundational math and science page lists MATH 124 and 125; PHYS 121 plus OCEAN 285/286; CHEM 120 or CHEM 142 and 152 plus OCEAN 295; BIOL 180 and 200; ESS 101; and one additional 5-credit science or math elective from MATH 126, PHYS 122, CHEM 152, BIOL 220, or OCEAN 270.",
        "The same page recommends the full calculus, physics, chemistry, or biology extensions depending on whether the student is leaning toward physical, chemical, or biological oceanography.",
      ]),
      degreeMapSection("ocean-shared-major", "Oceanography shared 200- and 300-level major core", [
        "The major page says both the B.A. and B.S. share the same 200-level core of OCEAN 200/201, OCEAN 210, OCEAN 215 for introductory Python and statistics, and OCEAN 220 for field methods.",
        "Both degrees also share the same 300-level sequence: OCEAN 310, OCEAN 320, OCEAN 330, and OCEAN 351.",
      ]),
      degreeMapSection("ocean-ba-bs", "Oceanography B.A. versus B.S. upper-division finish", [
        "The B.S. diverges at the 400 level by requiring a year-long senior thesis plus upper-division special-topics coursework that provides both breadth and depth.",
        "The B.A. does not require the senior thesis and instead uses a more flexible senior-year structure so students can tailor the upper-division work toward other sciences, humanities, or post-graduate interests.",
        "The School maintains separate B.A. and B.S. checklists and transfer-compressed course plans, so adviser review is still important before locking the final upper-division sequence.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm whether the student is aiming for the B.A. or B.S. in Oceanography before treating the exact 400-level course map as final.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Orchestral Instruments, B.M.")]: {
    officialLinks: [
      {
        label: "UW Bachelor of Music - Orchestral Instruments",
        url: "https://music.washington.edu/bachelor-music-orchestral-instruments",
      },
      {
        label: "UW Bachelor of Music overview",
        url: "https://music.washington.edu/bachelor-music",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("orch-admission", "Orchestral Instruments, B.M. degree baseline", [
        "The Bachelor of Music in Orchestral Instruments is a professional performance degree requiring 180 total credits, including at least 60 credits outside the School of Music.",
        "Music courses counted toward the degree require at least a 2.0 in each course and a 2.5 GPA in music for graduation.",
      ]),
      degreeMapSection("orch-core", "Orchestral Instruments pre-core and shared theory/history core", [
        "The published pre-core is MUSIC 113, MUSIC 119, and MUSIC 120 or a proficiency exam.",
        "The shared theory/history core is MUSIC 201, 202, 203, 204, 205, 206, 210, 211, 212, 301, 302, 303, 304, and 306, plus at least 3 credits from MUSIC 250, 251, 252, or a 400-level ethnomusicology course.",
      ]),
      degreeMapSection("orch-performance", "Orchestral Instruments performance and recital finish", [
        "The upper-division performance block is 12 credits of approved upper-level music theory or history electives, 18 credits of MUSICP 320-339 private instruction, 18 more credits of MUSICP 420-439 private instruction, MUSIC 379 Junior Recital, MUSIC 479 Senior Recital, and 18 music elective credits.",
        "Students must participate in at least one School of Music ensemble during every quarter of applied instruction, with six quarters drawn from MUSEN 300, 301, or 302 and a secondary ensemble for the remaining six quarters.",
        "The page lists 116 major credits and requires piano proficiency equivalent to MUSAP 235.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Organ, B.M.")]: {
    officialLinks: [
      {
        label: "UW Bachelor of Music - Organ",
        url: "https://music.washington.edu/bachelor-music-organ",
      },
      {
        label: "UW Bachelor of Music overview",
        url: "https://music.washington.edu/bachelor-music",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("organ-admission", "Organ, B.M. degree baseline", [
        "The Bachelor of Music in Organ is a professional performance degree requiring 180 total credits, including at least 60 credits outside the School of Music.",
        "Music courses counted toward the degree require at least a 2.0 in each course and a 2.5 GPA in music for graduation.",
        "The current Organ page also says students must pass a piano audition at the MUSICP 321 level or above to be considered for organ performance status.",
      ]),
      degreeMapSection("organ-core", "Organ, B.M. pre-core and shared theory/history core", [
        "The published pre-core is MUSIC 113, MUSIC 119, and MUSIC 120 or a proficiency exam.",
        "The shared theory and history core is MUSIC 201, 202, 203, 204, 205, 206, 210, 211, 212, 301, 302, 303, 304, and 306, plus at least 3 credits from MUSIC 250, 251, 252, or a 400-level ethnomusicology course.",
      ]),
      degreeMapSection("organ-performance", "Organ, B.M. performance and recital finish", [
        "The upper-division organ block includes 9 credits of approved upper-level music theory or history electives, MUSIC 487, one advanced analysis course from MUSIC 430, 438, 475, or 480, 18 credits of MUSICP 322, 18 credits of MUSICP 422, MUSIC 473 and 474, MUSIC 458 and 459, MUSIC 454, MUSIC 350, 351, and 352, junior and senior recitals, and one additional music elective credit.",
        "Organ majors also complete ensemble participation during every quarter of applied instruction through a choral ensemble, MUSEN 325, or MUSEN 383.",
        "The page lists 120 major credits and says students must either pass into MUSICP 321 or complete three quarters of MUSAP 301 to satisfy the piano requirement.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Percussion Performance, B.M.")]: {
    officialLinks: [
      {
        label: "UW Bachelor of Music - Percussion Performance",
        url: "https://music.washington.edu/bachelor-music-percussion-performance",
      },
      {
        label: "UW Bachelor of Music overview",
        url: "https://music.washington.edu/bachelor-music",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("perc-admission", "Percussion Performance, B.M. degree baseline", [
        "The Bachelor of Music in Percussion Performance is a professional performance degree requiring 180 total credits, including at least 60 credits outside the School of Music.",
        "Music courses counted toward the degree require at least a 2.0 in each course and a 2.5 GPA in music for graduation.",
      ]),
      degreeMapSection("perc-core", "Percussion Performance, B.M. pre-core and shared theory/history core", [
        "The published pre-core is MUSIC 113, MUSIC 119, and MUSIC 120 or a proficiency exam.",
        "The shared theory/history core is MUSIC 201, 202, 203, 204, 205, 206, 210, 211, 212, 301, 302, 303, 304, and 306, plus at least 3 credits from MUSIC 250, 251, 252, or a 400-level ethnomusicology course.",
      ]),
      degreeMapSection("perc-performance", "Percussion Performance, B.M. performance and ensemble finish", [
        "The upper-division performance block includes 12 credits of approved upper-level music theory or history electives, 18 credits of MUSICP 337, 18 credits of MUSICP 437, MUSIC 379, MUSIC 479, and the required piano proficiency equivalent to MUSAP 235.",
        "Students must participate in at least one School of Music ensemble during every quarter of applied instruction, with the published page listing orchestral/wind ensemble participation plus percussion ensemble and approved music ensembles such as contemporary or world-music groups.",
        "The page lists 116 major credits.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Philosophy")]: {
    officialLinks: [
      {
        label: "UW General Catalog Philosophy requirements",
        url: "https://www.washington.edu/students/gencat/program/S/Philosophy-221.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("phil-admission", "Philosophy admission baseline", [
        "Philosophy requires a minimum 2.00 cumulative GPA and completion of 10 credits of philosophy coursework for admission.",
        "The major currently has two Seattle degree paths under the same heading: the standard B.A. in Philosophy and the B.A. in Philosophy: Ethics.",
      ]),
      degreeMapSection("phil-standard", "Standard B.A. in Philosophy", [
        "The standard Philosophy B.A. requires 50 credits.",
        "Students complete one course from PHIL 115, PHIL 120, or an upper-division logic course; one course from PHIL 320, 330, 335, or 340; one course from PHIL 322, 332, 342, or a 400-level course in the same area; and at least four UW philosophy courses at the 400 level, excluding PHIL 484.",
        "The standard option also requires at least 25 credits taken through UW and a minimum 2.00 cumulative GPA in philosophy courses.",
      ]),
      degreeMapSection("phil-ethics", "B.A. in Philosophy: Ethics", [
        "The Ethics option also requires a minimum of 50 credits.",
        "Students complete at least 25 credits from the department's approved ethics and justice-related list, plus the same logic and mid-level core structure used in the standard major.",
        "The Ethics option also requires at least four UW 400-level philosophy courses, excluding PHIL 484, with at least two drawn from the approved ethics and justice-related list, plus at least 25 credits through UW and a 2.00 GPA in philosophy courses.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm whether the student is aiming for the standard Philosophy B.A. or the Ethics option before treating the exact upper-division list as final.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Physics")]: {
    officialLinks: [
      {
        label: "UW Bachelor of Science in Physics overview",
        url: "https://phys.washington.edu/bachelor-science-physics",
      },
      {
        label: "UW Physics B.S. degree requirements",
        url: "https://phys.washington.edu/physics-bs-degree-requirements",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("phys-common", "Physics shared B.S. common requirements", [
        "The current Seattle physics degree page organizes the major as a B.S. with track options rather than as one single undifferentiated course list.",
        "All Physics B.S. tracks share a 52-credit common core beginning with PHYS 121, 122, and 123 or the honors PHYS 141, 142, and 143 sequence, calculus through MATH 126 or the honors 134, 135, 136 sequence, and the intermediate physics block PHYS 224, 225, 227, 294, 321, 322, and 334.",
        "The department states that any single course may satisfy at most one physics-specific degree requirement.",
      ]),
      degreeMapSection("phys-tracks", "Current Physics B.S. track structure", [
        "The department currently lists Comprehensive Physics, Applied Physics, and Teaching Physics tracks, and notes that the Biological Physics track stopped accepting new students as of Spring 2024.",
        "The Comprehensive track adds advanced core courses such as PHYS 226, 228, and 324, more upper-division physics, additional math, a capstone, and approved electives.",
        "The Applied Physics track adds PHYS 231, AMATH 301, selected advanced physics courses, advanced lab or project work, electives, and a capstone with more room for cross-disciplinary technical preparation.",
        "The Teaching Physics track uses the shared physics core together with Physics by Inquiry and related teaching-oriented coursework to prepare for communication and education pathways.",
      ]),
      degreeMapSection("phys-policies", "Physics capstone and continuation notes", [
        "The degree-requirements page says every Physics B.S. option includes a capstone requirement involving activities outside a typical classroom.",
        "The department also ties continuation in the major to its separate satisfactory-progress policy.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm whether the student is aiming for the Comprehensive, Applied, or Teaching Physics track before treating the exact upper-division plan as final.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Piano, B.M.")]: {
    officialLinks: [
      {
        label: "UW Bachelor of Music - Piano",
        url: "https://music.washington.edu/bachelor-music-piano",
      },
      {
        label: "UW Bachelor of Music overview",
        url: "https://music.washington.edu/bachelor-music",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("piano-admission", "Piano, B.M. degree baseline", [
        "The Bachelor of Music in Piano is a professional performance degree requiring 180 total credits, including at least 60 credits outside the School of Music.",
        "Music courses counted toward the degree require at least a 2.0 in each course and a 2.5 GPA in music for graduation.",
      ]),
      degreeMapSection("piano-core", "Piano, B.M. pre-core and shared theory/history core", [
        "The published pre-core is MUSIC 113, MUSIC 119, and MUSIC 120 or a proficiency exam.",
        "The shared theory/history core is MUSIC 201, 202, 203, 204, 205, 206, 210, 211, 212, 301, 302, 303, 304, and 306, plus at least 3 credits from MUSIC 250, 251, 252, or a 400-level ethnomusicology course.",
      ]),
      degreeMapSection("piano-performance", "Piano, B.M. performance and ensemble finish", [
        "The upper-division performance block includes 9 credits of approved upper-level music theory or history electives, MUSIC 487, one upper-level course from MUSIC 425, 430, 438, 473, 474, 475, or 480, 18 credits of MUSICP 321, 18 credits of MUSICP 421, MUSIC 326, 327, 328, MUSIC 434, 435, 436, junior and senior recitals, and 7 music elective credits that may not be performance credits.",
        "Piano majors participate in at least one School of Music ensemble during every quarter of applied instruction and must complete at least six quarters of MUSEN 325 Accompanying.",
        "The page lists 120 major credits.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Political Science")]: {
    officialLinks: [
      {
        label: "UW Political Science major declaration and requirements",
        url: "https://www.polisci.washington.edu/political-science-major-declaration-and-requirements",
      },
      {
        label: "UW Political Science undergraduate programs overview",
        url: "https://www.polisci.washington.edu/undergraduate-programs",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("polisci-admission", "Political Science admission baseline", [
        "Political Science is a minimum-requirement major.",
        "Students declare by completing three introductory political science courses chosen from POL S 101, 201, 202, 203, 204, or approved equivalents, with at least a 2.0 in each and a minimum 2.0 cumulative GPA.",
      ]),
      degreeMapSection("polisci-major", "Political Science major requirements", [
        "The major requires at least 50 credits: 15 introductory credits plus 35 upper-division credits.",
        "Students complete one course numbered POL S 210 or above in three of the department's five fields: political theory, comparative politics, international relations, American politics, and methods.",
        "They then complete four additional POL S courses numbered 210 or above to bring the major total to 50 credits.",
      ]),
      degreeMapSection("polisci-options", "Political Science graduation rules and transcript options", [
        "Independent studies and internships do not count toward the major except that 5 credits of POL S 497 may count.",
        "Graduation requires a minimum cumulative 2.25 GPA in the major.",
        "The department also offers optional transcript notations in International Security and Political Economy, but those are optional add-on programs rather than separate majors.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Psychology")]: {
    officialLinks: [
      {
        label: "UW Psychology graduation requirements",
        url: "https://psych.uw.edu/undergraduate/prospective-students/graduation-requirements",
      },
      {
        label: "UW Psychology admissions",
        url: "https://psych.uw.edu/undergraduate/prospective-students/admissions",
      },
      {
        label: "UW Psychology transfer-student guide",
        url: "https://psych.uw.edu/undergraduate/prospective-students/transferring-to-uw",
      },
      {
        label: "UW Psychology BA vs BS guidance",
        url: "https://psych.uw.edu/undergraduate/prospective-students/choosing-a-degree",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("psych-admission", "Psychology admission baseline", [
        "Psychology is a capacity-constrained major with the same admission requirements for both the B.A. and B.S.",
        "Applicants complete PSYCH 101, 202, and 209 plus one math course from MATH 111, 112, 120, 124, or higher, with at least a 2.0 in each course, at least a 2.50 cumulative GPA across PSYCH 101, 202, and 209, and at least a 2.0 UW GPA.",
      ]),
      degreeMapSection("psych-ba", "Psychology B.A. structure", [
        "The B.A. requires a minimum of 53 credits in the major.",
        "Students complete PSYCH 315 or the PSYCH 317 plus 318 sequence, then one course from List A, one course from List B, one additional course from either list, one additional 300/400-level elective, two 400-level electives, one specialized experience worth 3 credits, and related-fields work in math, biology, and anthropology or sociology.",
      ]),
      degreeMapSection("psych-bs", "Psychology B.S. structure", [
        "The B.S. requires a minimum of 66 credits and is the more research-intensive option.",
        "It requires PSYCH 317 and 318, one laboratory course, the same List A/List B core pattern, one additional upper-division elective, two 400-level electives, PSYCH 499 research, a specialized experience, and related-fields work in math, biology, anthropology or sociology, and philosophy.",
        "The department's BA-versus-BS page says the B.S. is intended for students preparing for more research-oriented graduate work.",
      ]),
      degreeMapSection("psych-policies", "Psychology shared continuation and residency rules", [
        "Both the B.A. and B.S. require at least a 2.0 in every psychology and related-fields course used for the major, a 2.5 GPA in psychology courses excluding PSYCH 496 to 499, and a 2.0 UW GPA.",
        "Transfer students must also complete at least 15 graded upper-division psychology credits at UW.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm whether the student is aiming for the B.A. or the research-oriented B.S. before treating the exact upper-division plan as final.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Public Health - Global Health")]: {
    officialLinks: [
      {
        label: "UW Public Health-Global Health major overview",
        url: "https://sph.washington.edu/phgh",
      },
      {
        label: "UW Public Health-Global Health admission prerequisites",
        url: "https://sph.washington.edu/phgh/application/prerequisites",
      },
      {
        label: "UW Public Health-Global Health options",
        url: "https://sph.washington.edu/phgh/requirements/options",
      },
      {
        label: "UW Public Health-Global Health AUT 2024 curriculum sheet",
        url: "https://sph.washington.edu/sites/default/files/2024-09/Public-Health-Global-Health-Major-OnePager-Purple-Curriculum-AUT2024.pdf",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("phgh-admission", "Public Health - Global Health admission baseline", [
        "Public Health - Global Health is a capacity-constrained major with upper-division admission that normally targets students graduating within the next two years.",
        "Upper-division applicants need at least 60 college credits, a 2.5 cumulative GPA, English composition, one introductory public-health course with at least a 2.5, and science preparation matched to the BA or BS path.",
        "The current prerequisites page says BA-path students need one approved introductory natural-science course, while BS-path students need at least two courses from the same year-long biology, chemistry, physics, or math sequence with a 2.5 average.",
      ]),
      degreeMapSection("phgh-shared-core", "Public Health - Global Health shared Purple Curriculum core", [
        "The AUT 2024 Purple Curriculum uses a shared core across the BA and BS pathways.",
        "The shared block includes the integrated core sequence SPH 380, 381, 480, and 481, the public health foundation courses BIOST 310 and EPI 320, SPH 389 on structural racism, public-health service learning through SPH 391 and 392 or SPH 396, 15 credits of social and behavioral sciences breadth, a natural-science requirement, and the SPH 493 public-health portfolio.",
      ]),
      degreeMapSection("phgh-paths", "Public Health - Global Health pathways and options", [
        "The current major page and AUT 2024 curriculum sheet show both a B.A. pathway and a B.S. pathway.",
        "The program also lists four structured options: Global Health for the BA and BS pathways, Health Education and Promotion for the BA pathway, and Nutritional Sciences for the BS pathway.",
        "The options page and curriculum sheet show those options being completed through different 20-credit elective or selective bundles, while the shared core stays the same.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm BA versus BS and the student's intended option before treating the exact PH-GH upper-division elective bundle as final.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Public Service & Policy")]: {
    officialLinks: [
      {
        label: "UW Public Service and Policy major overview",
        url: "https://evans.uw.edu/undergraduate-programs/public-service-and-policy-major/",
      },
      {
        label: "UW Public Service and Policy major requirements",
        url: "https://evans.uw.edu/undergraduate-programs/public-service-and-policy-major/major-requirements/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("psp-admission", "Public Service & Policy declaration baseline", [
        "Public Service and Policy is a minimum-requirement major in the Evans School.",
        "Students declare with 45 college credits, a minimum 2.0 GPA, and at least a 2.0 in PUBPOL 201.",
        "The major page notes that the degree typically takes six quarters because of the way required courses are offered.",
      ]),
      degreeMapSection("psp-core", "Public Service & Policy foundational requirements", [
        "The Evans School says the B.A. major totals 70 credits of the 180-credit bachelor's degree.",
        "The foundational public-policy core is Policy Context (PUBPOL 201 plus PUBPOL 313 or 321), Methods (PUBPOL 303 and 301), Leadership & Management (PUBPOL 302 plus PUBPOL 402 or 403), and the PUBPOL 496 Public Service & Policy Lab.",
      ]),
      degreeMapSection("psp-breadth", "Public Service & Policy statistics and interdisciplinary breadth", [
        "Students also complete one approved statistics course, 15 credits of 100- and 200-level interdisciplinary selectives, and 15 credits of upper-division electives drawn from PUBPOL or other approved departments and schools.",
        "The overview page emphasizes that the degree is intentionally interdisciplinary and is built to connect policy context, methods, leadership, and applied public-service work.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Real Estate")]: {
    officialLinks: [
      {
        label: "UW General Catalog Real Estate requirements",
        url: "https://www.washington.edu/students/gencat/program/S/RealEstate-54.html",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("re-admission", "Real Estate admission baseline", [
        "The Seattle real estate degree is a Bachelor of Science in Real Estate housed in the College of Built Environments.",
        "Students may declare the major at any time after earning at least a 3.0 in R E 250 and remaining in good academic standing.",
        "The catalog explicitly notes that transfer students may take R E 250 in their first quarter at UW and then become eligible for the major in the following quarter.",
      ]),
      degreeMapSection("re-core", "Real Estate major requirements", [
        "The major requires a minimum of 50 credits.",
        "Students complete R E 250, then the fixed core of R E 361, 397, 411, 413, 416, and 480, plus at least 7 more credits in 300- or 400-level real estate courses.",
      ]),
      degreeMapSection("re-support", "Real Estate supporting elective structure", [
        "The major also requires at least 9 credits of approved analytic-skills electives, with at least 4 upper-division credits, 5 credits of approved built-environment electives, and 5 credits of approved business-skills electives.",
        "The catalog also pairs the major with the College of Built Environments general-education structure, including composition, additional writing, reasoning, diversity, and 20 credits each in A&H, SSc, and NSc.",
        "Students need a minimum 2.00 cumulative GPA in courses applied to the major.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Scandinavian Area Studies")]: {
    officialLinks: [
      {
        label: "UW Scandinavian Area Studies requirements",
        url: "https://scandinavian.washington.edu/ba-scandinavian-area-studies",
      },
      {
        label: "UW Scandinavian Studies undergraduate programs overview",
        url: "https://scandinavian.washington.edu/undergraduate-programs",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("scand-area-overview", "Scandinavian Area Studies language and credit baseline", [
        "The B.A. in Scandinavian Area Studies builds broad regional study around intermediate proficiency in one Scandinavian or Baltic language.",
        "The department page lists 60 credits, with at least 25 at the 300 level or above, plus a 5-credit capstone as of Autumn 2022.",
        "Because the language 101 courses are generally offered only in autumn, the department tells students to begin the target language early unless they place above the introductory level.",
      ]),
      degreeMapSection("scand-area-structure", "Scandinavian Area Studies major structure", [
        "Students complete 30 credits of first- and second-year coursework in a target language such as Danish, Estonian, Finnish, Latvian, Lithuanian, Norwegian, or Swedish.",
        "They then complete 25 credits of approved upper-division SCAND coursework, with the published list including courses such as SCAND 312, 315, 316, 327, 330, 331, 344, 360, 370, 380, 381, 402, 427, 450, 454, 455, 470, 480, 481, and 482.",
        "The required capstone is SCAND 498 Senior Capstone Project.",
      ]),
      degreeMapSection("scand-area-notes", "Scandinavian Area Studies planning notes", [
        "Credits earned during studies in Scandinavia can be transferred in consultation with the Foreign Study Office and the department.",
        "The department also notes that other courses may be substituted after discussion with the undergraduate adviser.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Slavic Languages & Literatures")]: {
    officialLinks: [
      {
        label: "UW Slavic Languages & Literatures undergraduate programs overview",
        url: "https://slavic.washington.edu/undergraduate-programs",
      },
      {
        label: "UW Eastern European Languages, Literature, and Culture requirements",
        url: "https://slavic.washington.edu/ba-eastern-european-languages-literature-and-culture",
      },
      {
        label: "UW Russian Language, Literature, and Culture requirements",
        url: "https://slavic.washington.edu/ba-russian-language-literature-and-culture",
      },
      {
        label: "UW Slavic Languages & Literatures undergraduate policies",
        url: "https://slavic.washington.edu/undergraduate-policies",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("slavic-overview", "Current Seattle Slavic degree-path overview", [
        "The department no longer publishes one single literal B.A. named Slavic Languages & Literatures as its only undergraduate degree structure.",
        "The current undergraduate overview instead lists three Seattle majors inside the department: B.A. in Eastern European Languages, Literature, and Culture; B.A. in Russian Language, Literature, and Culture; and Global Literary Studies.",
        "This planner row is best treated as an umbrella Seattle Slavic path that still needs the student pinned to the Russian or Eastern European degree map before the exact upper-division plan is considered final.",
      ]),
      degreeMapSection("slavic-eastern-europe", "Eastern European Languages, Literature, and Culture path", [
        "The Eastern European path requires second-year-or-higher work in one East European language such as BCMS, Bulgarian, Czech, Polish, Romanian, Slovene, or Ukrainian.",
        "It also requires SLAVIC 101, SLAVIC 320, SLAVIC 370, and SLAVIC 425, plus at least 20 additional credits from the approved departmental list.",
        "The department also requires that at least 50 percent of credits applied to the major be at the 300 or 400 level, at least 15 graded credits be completed through UW, and the cumulative GPA in UW and transfer courses applied to the major be at least 2.50.",
      ]),
      degreeMapSection("slavic-russian", "Russian Language, Literature, and Culture path", [
        "The Russian path requires RUSS 110; RUSS 301, 302, and 303 or RUSS 350; RUSS 322 and 323; RUSS 340; and at least 15 additional credits from the department's approved Russian and Slavic list.",
        "That approved list includes further RUSS language, literature, film, and culture courses plus some SLAVIC and history offerings.",
        "The Russian path also requires at least 50 percent of credits applied to the major at the 300 or 400 level, at least 15 graded credits completed through UW, and a minimum 2.0 cumulative GPA in courses presented for the major.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm whether the student is aiming for the Eastern European path or the Russian path before treating this row's exact UW course map as final.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Social Welfare")]: {
    officialLinks: [
      {
        label: "UW General Catalog Social Welfare requirements",
        url: "https://www.washington.edu/students/gencat/program/S/SocialWork-779.html",
      },
      {
        label: "UW BASW overview",
        url: "https://socialwork.uw.edu/academics/basw/",
      },
      {
        label: "UW BASW application instructions",
        url: "https://socialwork.uw.edu/admissions/apply-to-basw/basw-application-instructions/",
      },
      {
        label: "UW BASW coursework and field work",
        url: "https://socialwork.uw.edu/academics/basw/basw-overview/coursework-field-work/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("basw-admission", "Social Welfare admission baseline", [
        "The Seattle Bachelor of Arts in Social Welfare admits once each year for autumn quarter and is capacity constrained.",
        "Admission requires at least 65 transferable college credits, one introductory course in sociology and one in psychology with at least a 2.0 in each, and a minimum 2.00 cumulative GPA.",
        "The School says applications are holistically reviewed for academic preparation, reasoned interest in the field, relevant experience, and diverse contributions.",
      ]),
      degreeMapSection("basw-core", "Social Welfare core curriculum", [
        "The General Catalog lists 67 major credits in the BASW core.",
        "The required core is SOC WF 200, 265, 305, 310, 311, 312, 313, 320, 390, 402, 404, 405, SOC WF 415 for 12 credits, SOC WF 435, SOC WF 460 or SOC WF 495 for 3 credits, and SOC WF 465.",
        "The program requires at least a 2.0 in each required course, a 2.50 cumulative GPA across SOC WF courses applied to the major, and at least a 2.00 overall UW GPA.",
      ]),
      degreeMapSection("basw-practice", "Social Welfare practicum and fieldwork structure", [
        "The School's BASW coursework-and-fieldwork page describes the degree as a structured two-year professional program with service learning and 480 hours of supervised field experience.",
        "In junior year, students complete the social-welfare-practice and social-justice sequence along with community service learning; in senior year they move into research, practicum seminar, practicum placements, evidence-based practice, and capstone seminar work.",
        "The BASW pathway is therefore more cohort-structured than a flexible elective major even though it sits inside the 180-credit bachelor's degree framework.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Sociology")]: {
    officialLinks: [
      {
        label: "UW General Catalog Sociology requirements",
        url: "https://www.washington.edu/students/gencat/program/S/Sociology-293.html",
      },
      {
        label: "UW Sociology declaration requirements",
        url: "https://soc.washington.edu/declare-sociology-major",
      },
      {
        label: "UW Sociology current majors overview",
        url: "https://soc.washington.edu/current-majors",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("soc-admission", "Sociology admission baseline", [
        "Sociology is a minimum-requirements major.",
        "Students declare with SOC 300, which may be in progress at declaration time, one additional 5-credit sociology course, at least a 2.0 in the required course work, and a minimum 2.00 cumulative UW GPA.",
      ]),
      degreeMapSection("soc-structure", "Sociology major requirements", [
        "The major requires 50 credits total.",
        "Students complete SOC 300 and one additional 5-credit sociology course, one statistics course from STAT 220, STAT 221/SOC 221/CS&SS 221, or STAT 290, and SOC 316.",
        "They then complete 20 credits of upper-division sociology electives and 10 additional sociology elective credits, with published restrictions on how much practicum and individual-study credit can count.",
      ]),
      degreeMapSection("soc-policies", "Sociology GPA and residency rules", [
        "The major requires at least a 2.0 in every course applied to major requirements.",
        "The department also requires a minimum cumulative 2.50 GPA in courses applied to the major and 25 of the 50 sociology credits completed in residence through UW.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "South Asian Languages & Cultures")]: {
    officialLinks: [
      {
        label: "UW South Asian Languages and Cultures requirements",
        url: "https://asian.washington.edu/ba-south-asian-languages-and-cultures",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("salc-admission", "South Asian Languages & Cultures admission baseline", [
        "The major requires students to be substantially underway in their primary language before declaration.",
        "Admission requires at least 20 credits of college coursework in the intended primary language of concentration, with the most recent primary-language course taken through UW at a minimum 2.5 grade, plus one writing course taught in English with at least a 2.0 grade.",
        "The department prefers a cumulative 2.50 GPA and requires transfer students to be enrolled at UW before applying.",
      ]),
      degreeMapSection("salc-core", "South Asian Languages & Cultures degree requirements", [
        "The major requires 65 credits.",
        "Students complete 40 credits in one or more South Asian languages chosen from Bengali, Hindi, Sanskrit, or Urdu, with minimum second-year-level expectations inside each language path.",
        "They also complete one approved 5-credit South Asian literature course and 20 credits of area-related humanities and social science courses.",
      ]),
      degreeMapSection("salc-options", "South Asian area-course and upper-division notes", [
        "The approved literature list includes courses such as S ASIA 203, 206, 225, and 316 plus selected ASIAN offerings like ASIAN 210, 223, and 494.",
        "The approved area-related list includes history, religion, anthropology, JSIS, political science, and other South Asia-focused courses, and up to 10 credits of upper-division South Asian language courses may be applied there in addition to the main language block.",
        "The department also requires a minimum of 25 credits at the 300- or 400-level.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Spanish")]: {
    officialLinks: [
      {
        label: "UW admission to the Spanish major",
        url: "https://spanport.washington.edu/admission-spanish-major",
      },
      {
        label: "UW Spanish major requirements",
        url: "https://spanport.washington.edu/spanish-major-requirements",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("span-admission", "Spanish admission baseline", [
        "Spanish is a minimum-prerequisite major.",
        "Students are admitted after completing SPAN 203 with a minimum cumulative 2.70 GPA across Spanish coursework and at least a 2.5 grade in each Spanish course, so long as they can complete the major within UW satisfactory-progress rules.",
      ]),
      degreeMapSection("span-core", "Spanish major core tracks", [
        "The major requires a minimum of 50 credits above SPAN 203.",
        "The non-heritage core is SPAN 310, 311, 312, and 313.",
        "The heritage-language core is SPAN 314, 315, 316, and either SPAN 312 or SPAN 313.",
      ]),
      degreeMapSection("span-upper", "Spanish upper-division finish", [
        "After the four core courses are complete, students complete 30 additional upper-division credits.",
        "That upper-division finish requires at least six upper-division SPAN courses, with at least 25 credits at the 400 level.",
        "The department also notes that, other than the SPAN 400 to SPAN 406 / SPLING 400 to 406 sequence, only one SPAN course taught primarily in English normally counts toward the major.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm whether the student belongs in the heritage-language or non-heritage core before treating the exact Spanish sequence as final.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Speech & Hearing Sciences")]: {
    officialLinks: [
      {
        label: "UW General Catalog Speech and Hearing Sciences requirements",
        url: "https://www.washington.edu/students/gencat/program/S/SpeechandHearingSciences-296.html",
      },
      {
        label: "UW Speech and Hearing Sciences undergraduate major overview",
        url: "https://sphsc.washington.edu/undergraduate-major",
      },
      {
        label: "UW Speech and Hearing Sciences admissions prerequisites",
        url: "https://sphsc.washington.edu/admissions-prerequisites",
      },
      {
        label: "UW Speech and Hearing Sciences transfer FAQ",
        url: "https://sphsc.washington.edu/uw-transfer-students-faq",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("sphsc-admission", "Speech & Hearing Sciences admission baseline", [
        "Speech and Hearing Sciences is a capacity-constrained autumn-start major.",
        "Admission requires at least 75 credits, a minimum 2.50 cumulative GPA, and five prerequisite areas: social or behavioral science, biological science, physical science, statistics, and linguistics, each with at least a 2.0 grade.",
        "The department also evaluates GPA, preparation for the field, the personal statement, and other evidence of commitment to speech and hearing sciences.",
      ]),
      degreeMapSection("sphsc-major", "Speech & Hearing Sciences required course list", [
        "The General Catalog lists 50 major credits.",
        "The required course sequence is SPHSC 250, 261, 302, 303, 304, 305, 306, 320, 371, 405, 425, 461, and 481.",
        "The department describes the major as a six-quarter Seattle sequence beginning in autumn of junior year.",
      ]),
      degreeMapSection("sphsc-notes", "Speech & Hearing Sciences completion notes", [
        "The major requires a minimum 2.00 cumulative GPA in courses applied to the major.",
        "The department presents the B.S. as the flexible undergraduate speech-and-hearing degree that prepares students for paraprofessional work or graduate study in speech-language pathology, audiology, or research.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Sustainable Bioresource Systems Engineering")]: {
    officialLinks: [
      {
        label: "UW SBSE admission requirements",
        url: "https://sefs.uw.edu/admissions/undergraduate-admissions/sbse-admission/",
      },
      {
        label: "UW SBSE schedule and major requirements",
        url: "https://sefs.uw.edu/students/undergraduate/sbse-major/requirements/",
      },
      {
        label: "UW SBSE major overview",
        url: "https://sefs.uw.edu/students/undergraduate/sbse-major/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("sbse-admission", "Sustainable Bioresource Systems Engineering admission baseline", [
        "As of Autumn 2025, Sustainable Bioresource Systems Engineering is a minimum-requirements major rather than a capacity-constrained one.",
        "Students may declare once they complete MATH 124, 125, and 126 or the honors calculus alternative, CHEM 142, 152, and 162 or the approved honors alternatives, PHYS 121 or 141, and five credits of English composition.",
        "The admission page requires at least a 2.5 cumulative GPA across admission courses and at least a 2.0 in each required course.",
      ]),
      degreeMapSection("sbse-structure", "Sustainable Bioresource Systems Engineering degree structure", [
        "The SBSE schedule-and-requirements page says students earn a B.S. in Sustainable Bioresource Systems Engineering by completing at least 180 credits.",
        "The page also says the SBSE-prefixed engineering sequence begins in autumn of junior year and runs for two full academic years, or six required quarters, with quarter-to-quarter prerequisite progression.",
        "Students who declare after autumn of junior year must wait until the following autumn to begin the SBSE-prefixed sequence because of that locked sequence structure.",
      ]),
      degreeMapSection("sbse-electives", "Sustainable Bioresource Systems Engineering elective requirements", [
        "The current requirements page says one course is required from the Computation and Data Science elective list and one from the Business, Policy, and Economics list.",
        "The published computation list includes AMATH 301, CSE introductory programming options, CSE 160, INFO/CSE/STAT 180, and Q SCI 256.",
        "The published business, policy, and economics list includes ECON 200, ECON 201, ESRM 235/ECON 235/ENVIR 235, ESRM 320, ESRM 321, ESRM 400, ESRM 423, and ESRM 465.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Swedish")]: {
    officialLinks: [
      {
        label: "UW Swedish requirements",
        url: "https://scandinavian.washington.edu/ba-swedish",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("swed-overview", "Swedish major overview", [
        "The B.A. in Swedish builds advanced language and literature study around broader Scandinavian and Baltic cultural coursework.",
        "The department lists 60 credits total, with at least 25 at the 300 level or above.",
        "Because Swedish 101 is offered only in autumn, the department tells students to begin early unless they place beyond the first year.",
      ]),
      degreeMapSection("swed-language", "Swedish language and literature structure", [
        "Students complete 30 credits of first- and second-year Swedish coursework.",
        "They then complete 10 upper-division Swedish credits from the approved list, which includes SWED 300, 301, 302, 352, 395, 399, and 490.",
      ]),
      degreeMapSection("swed-scand-capstone", "Swedish breadth and capstone", [
        "The major also requires 15 upper-division SCAND credits from the approved Scandinavian and Baltic studies list.",
        "The required capstone is SCAND 498 Senior Capstone Project.",
        "Credits earned during study in Sweden can be transferred in consultation with the department, and the page notes that other substitutions may also be approved by the undergraduate adviser.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Voice, B.M.")]: {
    officialLinks: [
      {
        label: "UW Bachelor of Music - Voice",
        url: "https://music.washington.edu/bachelor-music-voice",
      },
      {
        label: "UW Bachelor of Music overview",
        url: "https://music.washington.edu/bachelor-music",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("voice-admission", "Voice, B.M. degree baseline", [
        "The Bachelor of Music in Voice is a professional performance degree requiring 180 total credits, including at least 60 credits outside the School of Music.",
        "Music courses counted toward the degree require at least a 2.0 in each course and a 2.5 GPA in music for graduation.",
      ]),
      degreeMapSection("voice-core", "Voice, B.M. pre-core and shared theory/history core", [
        "The published pre-core is MUSIC 113, MUSIC 119, and MUSIC 120 or a proficiency exam.",
        "The shared theory/history core is MUSIC 201, 202, 203, 204, 205, 206, 210, 211, 212, 301, 302, 303, 304, and 306, plus at least 3 credits from MUSIC 250, 251, 252, or a 400-level ethnomusicology course.",
      ]),
      degreeMapSection("voice-performance", "Voice, B.M. performance, language, and ensemble finish", [
        "The upper-division performance block includes 12 credits of approved upper-level music theory or history electives, MUSIC 307, 308, and 309 diction, MUSIC 326, 327, 328 beginning vocal repertoire, MUSIC 434 pedagogy, MUSIC 460, 461, 462 advanced repertoire, 18 credits of MUSICP 320, 18 credits of MUSICP 420, and junior and senior recitals.",
        "Voice students participate in a School of Music ensemble every quarter of applied instruction, including six quarters in a large conducted choral ensemble and at least two quarters of MUSEN 375 Opera Workshop.",
        "Students must satisfy piano proficiency equivalent to MUSAP 235 and complete first-year language study through 103 in two languages chosen from French, German, and/or Italian.",
        "The page lists 119 major credits.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Applied Mathematics")]: {
    officialLinks: [
      {
        label: "UW Applied Mathematics major requirements",
        url: "https://amath.washington.edu/undergraduate-major-applied-mathematics",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("apmath-foundation", "BS in Applied Mathematics required foundation", [
        "The standard Applied Mathematics major requires 54 to 59 credits in the major.",
        "The required mathematics foundation is MATH 124, MATH 125, and MATH 126, or the honors calculus sequence MATH 134, 135, and 136.",
        "The major also requires AMATH 301 for computing plus the introductory AMATH sequence AMATH 351, AMATH 352, and AMATH 353.",
      ]),
      degreeMapSection("apmath-electives", "BS in Applied Mathematics elective structure", [
        "Students must complete at least 27 elective credits inside the department's approved buckets.",
        "That 27-credit minimum includes at least 2 Methods courses from AMATH 401, 402, 403.",
        "It also includes at least 2 Modeling courses from AMATH 342, 383, 422, 423.",
        "It also includes at least 2 Computing and Data Sciences courses from AMATH 481, 482, 483, CFRM 410, CFRM 420, or CFRM 421.",
        "Additional courses from those same lists bring the elective total to the full 27-credit minimum.",
      ]),
      degreeMapSection(
        "apmath-degree-notes",
        "College requirements and continuation notes",
        [
          "The department page points students back to College of Arts and Sciences general-education rules for the rest of the 180-credit bachelor's degree.",
          "The department requires a minimum 2.00 cumulative GPA in courses applied to the major.",
        ],
        "This planner row treats the standard Applied Mathematics BS as the baseline. The department also separately maintains a Data Science option."
      ),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Mathematics")]: {
    officialLinks: [
      {
        label: "UW Mathematics undergraduate major requirements overview",
        url: "https://math.washington.edu/undergraduate-major-requirements",
      },
      {
        label: "UW B.A. Mathematics standard requirements",
        url: "https://math.washington.edu/ba-mathematics-standard-major-requirements-0",
      },
      {
        label: "UW B.S. Mathematics requirements",
        url: "https://math.washington.edu/bs-mathematics-major-requirements-0",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("math-options", "Mathematics major options and planner baseline", [
        "The UW Mathematics department currently offers multiple major options, including the B.A. Standard option, B.A. Teacher Preparation option, B.A. Philosophy option, and the B.S. option.",
        "This planner row treats the general Mathematics path as a shared Seattle launchpad, but the exact upper-division finish depends on which math option the student declares and the year they enter the major.",
      ]),
      degreeMapSection("math-ba-standard", "Current B.A. Mathematics standard option", [
        "For students admitted in Winter 2026 or later, the B.A. Standard option requires 56 to 64 credits in the major.",
        "The current B.A. core is MATH 124, 125, 126, 207, and 208 or the honors calculus sequence MATH 134, 135, 136, plus MATH 200, MATH 224, and MATH 300.",
        "After that core, the B.A. standard option requires 3 MATH courses at the 400-level and 4 additional MATH courses at the 300- or 400-level, subject to the department's exclusion list.",
      ]),
      degreeMapSection("math-bs", "Current B.S. Mathematics option", [
        "For students admitted in Winter 2026 or later, the B.S. option requires 74 to 88 credits in the major.",
        "The B.S. core starts with the same lower-division calculus and differential-equations sequence, then adds MATH 200, 224, 300, 327, and 424, or the accelerated honors sequence MATH 334, 335, and 336.",
        "The advanced B.S. structure then requires 11 courses across department-approved sequences and major electives, including 2 three-quarter or 3 two-quarter sequences, with at least 1 sequence drawn from modern algebra, concepts of analysis, topology and geometry, or complex analysis.",
        "The department's listed B.S. sequences also include optimization, combinatorics, numerical analysis, and probability, followed by 5 or 6 more MATH courses at the 300- or 400-level depending on whether MATH 424 is used in the sequence requirement.",
      ]),
      degreeMapSection(
        "math-policies",
        "Continuation, residency, and outside-course notes",
        [
          "Both the B.A. and B.S. pages require at least a 2.0 numerical grade in all courses used toward the major and at least 18 graded MATH credits at the 300-level or higher taken in residence at UW Seattle.",
          "The B.S. page also allows up to 2 non-MATH electives from one outside department such as AMATH, CSE, ECON, EE, PHYS, or PHIL, subject to adviser approval and department continuation rules.",
        ],
        "This planner row is best used to get students to the shared Seattle math foundation; adviser review is still needed to lock the exact B.A. versus B.S. finish."
      ),
    ],
    manualReviewNotes: [
      "Confirm whether the student is aiming for the B.A. Standard option, another B.A. option, or the B.S. option before treating the upper-division course list as final.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Statistics")]: {
    officialLinks: [
      {
        label: "UW Statistics major overview",
        url: "https://stat.uw.edu/statistics-major",
      },
      {
        label: "UW Statistics B.S. major requirements",
        url: "https://stat.uw.edu/academics/undergraduate/statistics-bs/major",
      },
      {
        label: "UW Statistics B.S. track structure",
        url: "https://stat.uw.edu/academics/undergraduate/statistics-bs/statistics-bs-tracks",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("stat-core", "Statistics B.S. core requirements", [
        "For students enrolling in 2024 and after, the Statistics B.S. is organized around 3 tracks that all share the same admission and core structure.",
        "The shared core is 37 credits: MATH 208 and MATH 224; STAT 302 and either CSE 163 or CSE 123; STAT 341 and STAT 342; STAT 423, STAT 424, and STAT 435; an ethics course from STAT 303, SOC 225, or INFO 351; and the capstone course STAT 496.",
        "The department page also requires a minimum 2.0 GPA in major courses and a 2.5 cumulative GPA across the courses used toward the major.",
      ]),
      degreeMapSection("stat-tracks", "Statistics B.S. track-specific breadth", [
        "The Mathematical Statistics track adds one approved 3-course probability or analysis sequence plus 3 electives from the general or computing elective lists.",
        "The Applied Statistics track adds 3 interdisciplinary courses that form a coherent approved outside sequence plus 3 electives from the general or computing elective lists.",
        "The Data Science track adds 1 approved data-visualization course, 1 approved databases course, 1 computing elective, and 3 more electives from the general or computing elective lists.",
      ]),
      degreeMapSection("stat-electives", "Examples of approved Statistics electives", [
        "The major-requirements page's general electives list includes options such as CSE 373, CSE 332, MATH 300, MATH 318, MATH/STAT 395, MATH/STAT 491, 492, 493, STAT 403, 425, 427, 428, 441, 498, 529, and STAT 534.",
        "The computing electives list includes CSE 373, CSE 332, MATH 318, MATH 407, 408, 409, and STAT 534.",
      ]),
    ],
    manualReviewNotes: [
      "The Statistics department now expects students to choose their Mathematical Statistics, Applied Statistics, or Data Science track before graduation, so the exact final course list depends on that track choice.",
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Business Administration")]: {
    officialLinks: [
      {
        label: "Foster undergraduate curriculum",
        url: "https://foster.uw.edu/academics/degree-programs/undergraduate-programs/curriculum/",
      },
      {
        label: "Foster standard admission requirements",
        url: "https://foster.uw.edu/academics/degree-programs/undergraduate-programs/admissions/standard-admission/",
      },
      {
        label: "Foster business majors and areas of study",
        url: "https://foster.uw.edu/academics/degree-programs/undergraduate-programs/curriculum/options/",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("foster-lower-division", "BABA lower-division prerequisites and admission setup", [
        "All Foster undergraduates work toward the Bachelor of Arts in Business Administration (BABA).",
        "The lower-division business core is ACCTG 215, ACCTG 225, MGMT 200, and QMETH 201.",
        "Students must also complete four non-business prerequisites: one approved calculus course, ECON 200, ECON 201, and English Composition.",
        "For standard admission, Foster requires at least 60 numerically graded college credits, a minimum 2.0 GPA in the listed categories, and the Writing Skills Assessment before the application deadline.",
      ]),
      degreeMapSection("foster-upper-division", "BABA upper-division core and electives", [
        "The upper-division business core is IS 300, OPMGT 301, MKTG 301, FIN 350, MGMT 300, IBUS 300, MGMT 320, B ECON 300, and MGMT 430.",
        "Students also complete at least 16 upper-division business elective credits.",
        "While completing the BABA curriculum, students may either design their own area of study or choose a predetermined Foster major such as Accounting, Finance, Information Systems, Marketing, or Operations & Supply Chain Management.",
      ]),
      degreeMapSection("foster-general-degree", "BABA overall degree and residency rules", [
        "All business students must complete at least 59 credits of general-education requirements, at least 13 credits of college-level composition and approved writing work, and at least 180 total credits for the bachelor's degree.",
        "Foster's residency rules require the 9 upper-division business core courses, with 6 of them including MGMT 430 completed at UW Seattle, plus 53 upper-division business credits total with 40 completed at UW Seattle.",
        "UW also requires 45 of the final 60 credits in residence at UW Seattle.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-seattle", "Informatics")]: {
    officialLinks: [
      {
        label: "UW Informatics curriculum",
        url: "https://ischool.uw.edu/academics/informatics/curriculum",
      },
      {
        label: "UW Informatics prerequisites",
        url: "https://ischool.uw.edu/programs/informatics/admissions/prerequisites",
      },
      {
        label: "UW Informatics capstone details",
        url: "https://ischool.uw.edu/programs/informatics/curriculum/capstone",
      },
      {
        label: "UW Green River equivalency guide",
        url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
      },
    ],
    degreeMapSections: [
      degreeMapSection("info-admission", "Informatics admission requirements", [
        "The Informatics major requires INFO 200, one statistics course, one computer-programming course, and one additional social-sciences course outside INFO 200 for admission planning.",
        "The prerequisites page lists accepted programming options such as CSE 121, 122, 123, 142, 143, 154, 160, 163, 180, plus approved alternatives, and accepted statistics options such as STAT 220, STAT 221, BIOSTAT 310, CSE 312, IND E 315, MATH 390, MATH/STAT 394, QMETH 201, Q SCI 381, STAT 311, and STAT 390.",
        "Beginning with applications for autumn 2026 entry, recent UW Seattle transfer students will no longer have a one-quarter grace period for the INFO 200 requirement.",
      ]),
      degreeMapSection("info-core", "Informatics core curriculum", [
        "The core begins with INFO 201 and INFO 290, then INFO 300.",
        "The development sequence requires one of CSE 123, CSE 143, or CSE 163, plus INFO 330, INFO 340, and one of CSE 373, INFO 442, or INFO 443.",
        "Students also complete INFO 360, INFO 380, any 2 INFO 35x courses, and the 8-credit capstone sequence INFO 490 plus INFO 491.",
      ]),
      degreeMapSection("info-electives", "Informatics electives and degree options", [
        "The major includes 12 to 15 credits of additional Informatics electives, usually upper-division INFO courses.",
        "The department also allows approved outside courses to count as electives with iSchool approval.",
        "Students can complete a Data Science option through electives such as INFO 370, 371, 430, and 474, or a Biomedical and Health Informatics option through electives such as BIME 300, BIME 435, INFO 468, and INFO 478.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "American & Ethnic Studies (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell American & Ethnic Studies requirements",
        url: "https://www.uwb.edu/ias/undergraduate/majors/american-ethnic-studies",
      },
      {
        label: "UW Bothell American & Ethnic Studies major planning worksheet",
        url: "https://admissions.uwb.edu/register/mpw-aes",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-aes-baseline", "American & Ethnic Studies degree baseline", [
        "The current American & Ethnic Studies B.A. page says the Winter 2025 degree structure totals 75 credits in the major.",
        "The fixed lower-division and early-major core is BIS 290, BISAES 305, and either BIS 312 or BIS 340.",
        "Students also complete 10 credits of composition coursework through one 5-credit introductory composition course and one 5-credit advanced composition course.",
      ]),
      degreeMapSection("uwb-aes-areas", "American & Ethnic Studies area-course structure", [
        "The major requires 30 AES credits across the approved area lists: 5 credits in Historical and Social Inquiry, 5 in Textual Analysis and Interpretation, 5 in Critical Theory and Practice, and 15 more AES credits drawn from any of those three areas.",
        "Students also complete 20 additional School of IAS credits to finish the major's broader interdisciplinary structure.",
        "The page notes that BISAES 305 is taught only in autumn, so that core course should be treated as a sequencing anchor.",
      ]),
      degreeMapSection("uwb-aes-policies", "American & Ethnic Studies residency and policy notes", [
        "The AES page requires 30 credits in residence at UW Bothell and a minimum 2.00 cumulative GPA in the major.",
        "The IAS Interdisciplinary Practices and Reflection requirement can overlap with the 75 major credits or be completed through electives, and AES students are encouraged to use BISAES 465 for that requirement.",
        "A maximum of 35 credits from 100- and 200-level coursework may apply to the major, so the rest of the degree must be completed with upper-division work.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Applied Computing (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Applied Computing admissions",
        url: "https://www.uwb.edu/stem/undergraduate/majors/applied-computing/admissions",
      },
      {
        label: "UW Bothell Applied Computing curriculum",
        url: "https://www.uwb.edu/stem/undergraduate/majors/applied-computing/curriculum",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-ac-admission", "Applied Computing admission baseline", [
        "Applied Computing is currently a capacity-constrained major with holistic review rather than guaranteed admission.",
        "The published prerequisites are English Composition I and II, Calculus I, and a two-course programming sequence equivalent to CSS 142 and 143 or CSS 132 and 133, all with minimum 2.0 grades.",
        "The admissions page says prerequisite courses normally must be complete before applying, except that autumn applicants can finish remaining prerequisites in the prior spring and then be reviewed after spring grades are posted.",
      ]),
      degreeMapSection("uwb-ac-core", "Applied Computing core curriculum", [
        "The core degree uses a statistics course, CSS 301 technical writing, one data-structures-and-algorithms path through CSS 340 or CSS 342, one business-management course through CSS 350 or approved BBUS 300 use, CSS 360, CSS 421, and the CSS 496 Applied Computing capstone.",
        "The curriculum page frames the major around computing plus a second discipline, and it says those two areas come together in the capstone.",
      ]),
      degreeMapSection("uwb-ac-second-discipline", "Applied Computing second discipline and electives", [
        "All students complete at least 25 credits in a second discipline, including 15 credits at the 300-level or higher and 10 credits at the 100-level or higher.",
        "The second discipline can be a UW Bothell major or minor, a minor from another UW campus, or an approved custom cluster of interrelated non-computing courses.",
        "The major also requires 25 CSS elective credits, including 10 at the 400-level, 5 more at the 300-level or higher, and 10 at the 200-level or higher, plus 10 credits of upper-level general electives at the 300-level or higher.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm the student's planned second discipline early, because it materially changes the final degree map and the best Green River transfer strategy.",
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Biology (BS)")]: {
    officialLinks: [
      {
        label: "UW Bothell Biology admissions",
        url: "https://www.uwb.edu/stem/undergraduate/majors/biology/admissions",
      },
      {
        label: "UW Bothell Biology curriculum",
        url: "https://www.uwb.edu/stem/undergraduate/majors/biology/curriculum",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-bio-admission", "Biology admission baseline", [
        "The Biology B.S. is currently a minimum-requirements major, so meeting the listed prerequisites guarantees admission.",
        "The admissions page requires a full introductory biology sequence equivalent to BBIO 180, 200, and 220 plus a full general chemistry sequence equivalent to BCHEM 143+144, 153+154, and 163+164.",
        "Applicants need minimum 2.0 grades in each introductory biology course and a 2.0 combined average across the general chemistry series.",
      ]),
      degreeMapSection("uwb-bio-core", "Biology core requirements", [
        "The Biology curriculum then requires one calculus course, one statistics course, and Physics I and II through either the general-physics-with-lab pair or the calculus-based pair.",
        "The core also requires Genetics through BBIO 360, Evolution through BBIO 466, one Ecology course, one Cell Biology course, one Physiology course, and the Investigative Biology research requirement.",
        "The curriculum page notes that Physics III is not required for the Biology degree itself, but it may still matter for some graduate-school plans.",
      ]),
      degreeMapSection("uwb-bio-electives", "Biology elective structure", [
        "Students complete one Biology and Society course from the approved list, then 20 credits of upper-division biology electives.",
        "Those 20 elective credits must come from at least two of the three approved upper-division categories: Biodiversity / Ecology / Evolution, Cellular / Molecular Biology, and Physiology / Neurobiology.",
        "The page also lists miscellaneous electives such as BBIO 485, BBIO 495, and BBIO 498 that can count toward the major but do not usually satisfy the two-category breadth rule.",
      ]),
    ],
    manualReviewNotes: [
      "Community-college microbiology and physiology do not always transfer into the exact Bothell biology core buckets, so confirm those matches before promising a direct slot into Cell Biology or Physiology requirements.",
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Business Administration (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Bachelor of Business Administration overview",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration",
      },
      {
        label: "UW Bothell Business admissions",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions",
      },
      {
        label: "UW Bothell Business prerequisite courses",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
      },
      {
        label: "UW Bothell Business curriculum and areas of study",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-bba-admission", "Business Administration admission and prerequisite baseline", [
        "UW Bothell's B.A. in Business Administration is an upper-division program, so transfer students enter after lower-division prerequisite work.",
        "The admissions and prerequisite pages require statistics, calculus or business calculus, microeconomics, macroeconomics, financial accounting, managerial accounting, law or business law, and 10 credits of English composition.",
        "Applicants must have at least 60 transferable quarter credits, at least a 2.0 cumulative GPA, at least a 2.5 GPA across business prerequisites, and at least a 2.0 in each prerequisite course.",
      ]),
      degreeMapSection("uwb-bba-core", "Business Administration shared upper-division core", [
        "All BBA students then complete the shared Bothell business core: BBUS 300, 307, 310, 320, 340, and 350.",
        "Every BBA path also ends with the common capstone pair BBUS 470 and BBUS 480 after all core courses are complete.",
      ]),
      degreeMapSection("uwb-bba-paths", "Business Administration pathway structure", [
        "The current curriculum page says business students then choose one of the published options or concentrations, or use the self-directed concentration process.",
        "The transcripted options currently listed are Accounting, Finance, Leadership and Strategic Innovation, Marketing, and Supply Chain Management, while concentrations include Entrepreneurship, Finance, Management, MIS, Marketing, Retail Management, TIM, and Self-Directed.",
        "The broader BBA degree also requires university breadth outside business, including foreign language, writing, Arts and Humanities, Social Sciences, Natural Sciences, and enough electives to reach the bachelor's total.",
      ]),
    ],
    manualReviewNotes: [
      "This general BBA row is only a baseline. The final exact course map depends on which business option or concentration the student chooses.",
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Business Administration: Accounting (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Accounting option",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/accounting",
      },
      {
        label: "UW Bothell Business admissions",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions",
      },
      {
        label: "UW Bothell Business prerequisite courses",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-acct-admission", "Accounting option admission baseline", [
        "Accounting students first complete the same Bothell BBA prerequisite set used for admission to the business major.",
        "The accounting option page then adds a stronger internal declaration threshold: all required prerequisite accounting courses must be completed with at least a 2.5 in each course and a 3.0 cumulative average across accounting prerequisites.",
        "The page also says students cannot enroll in accounting-option courses until they meet with an adviser to confirm eligibility.",
      ]),
      degreeMapSection("uwb-acct-core", "Accounting option required course list", [
        "The accounting option uses the shared BBA core of BBUS 300, 307, 310, 320, 340, and 350.",
        "The required accounting sequence is BBUS 361, 362, 363, 373, 411, 435, and 450.",
        "All accounting-option students also complete the shared capstone pair BBUS 470 and BBUS 480.",
      ]),
      degreeMapSection("uwb-acct-electives", "Accounting option electives and completion notes", [
        "Students complete 10 credits of approved accounting electives from courses such as BBUS 412, 449, 458, 463, 465, 466, 467, 468, and approved BBUS 490 topics.",
        "The page also requires 5 credits of additional upper-division general electives to reach the option's 90-credit Bothell program total.",
        "The site notes that CPA preparation usually requires a third year of study to reach 225 quarter credits, while the two-year accounting option itself satisfies CMA exam eligibility.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Business Administration: Finance (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Finance option and concentration",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/finance-option",
      },
      {
        label: "UW Bothell Business admissions",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions",
      },
      {
        label: "UW Bothell Business prerequisite courses",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-finance-baseline", "Finance option and concentration baseline", [
        "Finance students start from the same BBA admission prerequisites and the shared BBA core of BBUS 300, 307, 310, 320, 340, and 350.",
        "The finance page says the Finance Option normally requires BBUS 350 with at least a 3.0, although students can request a waiver if they earn at least a 3.0 across the other required finance-option courses.",
        "The Finance concentration uses the same BBA core but only requires BBUS 350 before declaration.",
      ]),
      degreeMapSection("uwb-finance-required", "Finance required courses", [
        "The Finance Option requires BBUS 451, 452, 453, and 454 after the shared core.",
        "The Finance concentration keeps BBUS 451, 453, and 454 as its required finance block.",
      ]),
      degreeMapSection("uwb-finance-electives", "Finance electives, capstone, and credit structure", [
        "The option then adds 10 credits of finance electives plus 5 more credits from the enrichment-elective list, while the concentration adds 5 elective credits from the shorter approved list.",
        "Both pathways end with the shared BBA capstones BBUS 470 and BBUS 480 and total 90 Bothell credits.",
        "The finance page also warns that accounting-option students who add the finance concentration cannot double count BBUS 361 or 373 toward the concentration.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm whether the student wants the full Finance Option or the lighter Finance concentration before treating the exact upper-division list as final.",
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Business Administration: Leadership & Strategic Innovation (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Leadership and Strategic Innovation option",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/leadership",
      },
      {
        label: "UW Bothell Business admissions",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions",
      },
      {
        label: "UW Bothell Business prerequisite courses",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-lsi-admission", "Leadership and Strategic Innovation declaration baseline", [
        "The LSI option sits inside the shared BBA framework and uses the usual BBA admission prerequisites.",
        "The option page adds one declaration rule on top of that baseline: students must complete BBUS 300 and BBUS 307 with at least a 3.0 in each course.",
      ]),
      degreeMapSection("uwb-lsi-required", "Leadership and Strategic Innovation required courses", [
        "The LSI option uses the shared core of BBUS 300, 307, 310, 320, 340, and 350.",
        "Its required option courses are BBUS 402, 461, 473, and 475, plus one of BBUS 476 or BBUS 477.",
      ]),
      degreeMapSection("uwb-lsi-finish", "Leadership and Strategic Innovation electives and finish", [
        "Students then complete 10 credits from the approved LSI elective list, which includes courses such as BBUS 441, 443, 444, 460, 462, 471, 472, 476, 477, 479, and 491.",
        "The option also carries 15 credits of upper-division general electives and the shared BBA capstone pair BBUS 470 and BBUS 480.",
        "The page lists the full LSI option as a 90-credit Bothell program.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Business Administration: Marketing (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Marketing option and concentration",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/marketing",
      },
      {
        label: "UW Bothell Business admissions",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions",
      },
      {
        label: "UW Bothell Business prerequisite courses",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-marketing-baseline", "Marketing option and concentration baseline", [
        "Marketing students begin with the shared BBA admission prerequisites and the common BBA core of BBUS 300, 307, 310, 320, 340, and 350.",
        "The current marketing page publishes separate option and concentration course lists, so the exact finish depends on which pathway the student chooses.",
      ]),
      degreeMapSection("uwb-marketing-required", "Marketing required courses", [
        "The Marketing Option requires BBUS 421, 423, and 438 after the shared BBA core.",
        "The Marketing concentration keeps BBUS 423 and 438 as its required specialized coursework.",
      ]),
      degreeMapSection("uwb-marketing-electives", "Marketing electives, capstone, and credit structure", [
        "The option adds 15 credits of marketing electives, while the concentration adds 10 credits of marketing electives from the approved list including BBUS 421, 426, 427, 429, 431, 464, approved BBUS 490 topics, and adviser-approved consulting or research work.",
        "The option carries 20 credits of upper-division general electives, while the concentration carries 30 general-elective credits.",
        "Both pathways finish with the shared capstones BBUS 470 and BBUS 480 and total 90 Bothell credits.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm whether the student wants the transcripted Marketing Option or the Marketing concentration before treating the exact upper-division path as final.",
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Business Administration: Supply Chain Management (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Supply Chain Management option",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/supply-chain",
      },
      {
        label: "UW Bothell Business admissions",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions",
      },
      {
        label: "UW Bothell Business prerequisite courses",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-scm-declare", "Supply Chain Management declaration baseline", [
        "Supply Chain Management uses the shared BBA admission prerequisites and upper-division business core.",
        "The option page adds a higher internal declaration threshold: students must complete Calculus, Statistics, and BBUS 340 with at least a 3.0 in each course.",
      ]),
      degreeMapSection("uwb-scm-required", "Supply Chain Management required courses", [
        "After the shared BBA core of BBUS 300, 307, 310, 320, 340, and 350, the required SCM block is BBUS 441, 482, 483, 486, and 487.",
        "Students also complete an applied terminal experience through BBUS 492 or an approved internship, independent research, or business consulting substitute.",
      ]),
      degreeMapSection("uwb-scm-finish", "Supply Chain Management electives and finish", [
        "The option then requires 10 credits of approved SCM electives from courses such as BBUS 373, 402, 447, 460, 462, 463, 464, 473, and 475.",
        "Students also complete 10 credits of upper-division general electives and the shared BBA capstones BBUS 470 and BBUS 480.",
        "The current page lists the full SCM option as a 90-credit Bothell program and notes its STEM-designated classification.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Chemistry (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Chemistry overview",
        url: "https://www.uwb.edu/stem/undergraduate/majors/chemistry",
      },
      {
        label: "UW Bothell Chemistry admissions",
        url: "https://www.uwb.edu/stem/undergraduate/majors/chemistry/admissions",
      },
      {
        label: "UW Bothell Chemistry curriculum",
        url: "https://www.uwb.edu/stem/undergraduate/majors/chemistry/curriculum",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-chem-ba-admission", "Chemistry B.A. admission baseline", [
        "The Chemistry majors admit for autumn, winter, and spring entry.",
        "For admission, students complete the full general chemistry sequence with labs and Calculus I, II, and III, with at least a 2.0 in each prerequisite course.",
        "The admissions page tells students to wait until prerequisites are fully complete before applying.",
      ]),
      degreeMapSection("uwb-chem-ba-core", "Chemistry B.A. required core", [
        "The Bothell Chemistry B.A. then requires the full organic chemistry sequence, one full three-course physics sequence, one advanced mathematics course chosen from differential equations, linear algebra, multivariable calculus, or statistics, and the core chemistry sequence of BCHEM 294, 312, 316, 317, 401, 402, 495, and up to 6 credits of BCHEM 497.",
        "The curriculum page emphasizes the B.A. as the intentionally flexible chemistry option for students pairing chemistry with teacher preparation, another major, a minor, or other interdisciplinary goals.",
      ]),
      degreeMapSection("uwb-chem-ba-electives", "Chemistry B.A. electives and completion notes", [
        "Students complete 7 credits of upper-division chemistry electives, including at least one lab, from the approved list that includes courses such as BCHEM 310, 313, 350, 364, 365, 366, 375, 404, 426, 493, 494, 498, and 499.",
        "The chemistry curriculum page also says all chemistry-major courses need at least a 2.0 and the bachelor's degree requires 180 total credits plus the standard UW Bothell general-education requirements.",
        "The department strongly recommends taking analytical chemistry before physical chemistry and not stacking the analytical and physical sequences at the same time.",
      ]),
    ],
    manualReviewNotes: [
      "This row is specifically the Bothell Chemistry B.A. If the student is aiming for the more intensive B.S. general or biochemistry option, use the matching Bothell chemistry rows instead.",
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Chemistry (BS)")]: {
    officialLinks: [
      {
        label: "UW Bothell Chemistry overview",
        url: "https://www.uwb.edu/stem/undergraduate/majors/chemistry",
      },
      {
        label: "UW Bothell Chemistry admissions",
        url: "https://www.uwb.edu/stem/undergraduate/majors/chemistry/admissions",
      },
      {
        label: "UW Bothell Chemistry curriculum",
        url: "https://www.uwb.edu/stem/undergraduate/majors/chemistry/curriculum",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-chem-bs-admission", "Chemistry B.S. admission baseline", [
        "The Chemistry majors admit for autumn, winter, and spring entry.",
        "For admission, students complete the full general chemistry sequence with labs and Calculus I, II, and III, with at least a 2.0 in each prerequisite course.",
        "The admissions page tells students to wait until prerequisites are fully complete before applying.",
      ]),
      degreeMapSection("uwb-chem-bs-core", "Chemistry B.S. general option required core", [
        "The Bothell Chemistry B.S. general option requires the full organic chemistry series, one full three-course physics sequence, and one advanced mathematics course chosen from differential equations, linear algebra, multivariable calculus, or statistics.",
        "Its chemistry core is BCHEM 294, 312, 313, 316, 317, BBIO/BCHEM 364, BCHEM 401, 402, 404, 426, and BCHEM 495.",
        "Compared with the B.A., the B.S. general option is more chemistry-intensive and adds a larger required upper-division chemistry backbone before electives.",
      ]),
      degreeMapSection("uwb-chem-bs-electives", "Chemistry B.S. general option electives and finish", [
        "The general B.S. option then requires 14 credits of upper-division chemistry electives from approved courses such as BCHEM 310, 350, 365, 366, 375, 493, 494, 497, 498, and 499.",
        "It also requires 5 additional upper-division STEM elective credits from 300- or 400-level STEM coursework.",
        "The curriculum page notes that all courses used in the chemistry major require at least a 2.0 and that the full bachelor's degree still must reach 180 total credits with the normal UW Bothell general-education requirements.",
      ]),
    ],
    manualReviewNotes: [
      "This row is specifically the Bothell Chemistry B.S. general option, not the separate Biochemistry option.",
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Chemistry: Biochemistry (BS)")]: {
    officialLinks: [
      {
        label: "UW Bothell Chemistry overview",
        url: "https://www.uwb.edu/stem/undergraduate/majors/chemistry",
      },
      {
        label: "UW Bothell Chemistry admissions",
        url: "https://www.uwb.edu/stem/undergraduate/majors/chemistry/admissions",
      },
      {
        label: "UW Bothell Chemistry curriculum",
        url: "https://www.uwb.edu/stem/undergraduate/majors/chemistry/curriculum",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-biochem-admission", "Chemistry B.S. Biochemistry option admission baseline", [
        "The Biochemistry option shares the same chemistry-major admissions baseline: the full general chemistry sequence with labs plus Calculus I, II, and III, each completed with at least a 2.0 grade.",
        "Like the other chemistry pathways, students are expected to complete prerequisites before applying for autumn, winter, or spring entry.",
      ]),
      degreeMapSection("uwb-biochem-core", "Biochemistry option required core", [
        "The Biochemistry option requires the full organic chemistry sequence, one full three-course physics sequence, and one advanced mathematics course from differential equations, linear algebra, multivariable calculus, or statistics.",
        "It then adds a biology sequence through BBIO 180 and 200 plus a larger chemistry / biochemistry core: BCHEM 294, 316, 317, BBIO/BCHEM 364, 365, 366, BBIO/BCHEM 375, BCHEM 401, 402, 404, 426, and BCHEM 495.",
        "The department describes this option as having more required core and less elective space than the general chemistry B.S., with substantial lab time.",
      ]),
      degreeMapSection("uwb-biochem-electives", "Biochemistry option electives and finish", [
        "The Biochemistry option finishes with 5 credits of upper-division chemistry electives chosen from approved courses such as BCHEM 310, 312, 313, 350, 493, 494, 497, 498, and 499.",
        "The curriculum page still requires at least a 2.0 in each course applied to the major, plus the broader 180-credit UW Bothell bachelor's requirements outside the major.",
        "Because the option is lab-heavy and leaves less elective room, the department recommends proactive scheduling with an adviser.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Computer Science & Software Engineering: Information Assurance & Cybersecurity (BS)")]: {
    officialLinks: [
      {
        label: "UW Bothell CSSE admissions",
        url: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/admissions",
      },
      {
        label: "UW Bothell CSSE curriculum",
        url: "https://www.uwb.edu/stem/undergraduate/majors/bscsse/curriculum",
      },
      {
        label: "UW Bothell CSSE planning worksheet",
        url: "https://admissions.uwb.edu/register/mpw-csse",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-csse-iac-admission", "CSSE Information Assurance & Cybersecurity admission baseline", [
        "Students enter the Information Assurance and Cybersecurity path by first meeting the same capacity-constrained admissions requirements as the general CSSE major.",
        "Those prerequisites are English Composition I and II, Calculus I and II, and a two-course programming sequence equivalent to CSS 142 and 143 or CSS 132 and 133, each with at least a 2.0 grade.",
        "The current CSSE curriculum says students choose the IAC option after admission into the general major rather than applying separately as transfer students into a completely different lower-division prerequisite set.",
      ]),
      degreeMapSection("uwb-csse-iac-core", "CSSE Information Assurance & Cybersecurity shared core", [
        "The IAC option keeps the same shared CSSE core as the general option: one statistics course, CSS 301, 342, 343, 350, 360, 370, 422, 430, and CSS 497.",
        "That means the Green River transfer strategy should still be built around the standard programming, writing, and calculus foundation used for the general CSSE path.",
      ]),
      degreeMapSection("uwb-csse-iac-option", "CSSE Information Assurance & Cybersecurity option requirements", [
        "The curriculum page says the IAC option replaces part of the broad elective block with cybersecurity-focused coursework.",
        "Students complete CSS 310 plus at least 15 credits from the approved Information Assurance and Cybersecurity course list, which currently includes CSS 337, 411, 415, and 432 at Bothell plus selected tri-campus INFO and T INFO cybersecurity courses.",
        "The option also requires at least 5 additional CSS elective credits at the 200-level or above beyond that IAC list, while still following the CSSE degree's broader upper-division credit structure.",
      ]),
    ],
    manualReviewNotes: [
      "Confirm current Bothell versus Seattle/Tacoma cross-campus availability for the IAC option courses before turning the option into a rigid quarter-by-quarter plan.",
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Conservation & Restoration Science (BS)")]: {
    officialLinks: [
      {
        label: "UW Bothell Conservation and Restoration Science requirements",
        url: "https://www.uwb.edu/ias/undergraduate/majors/conservation-restoration-science",
      },
      {
        label: "UW Bothell major planning worksheet - Conservation and Restoration Science",
        url: "https://admissions.uwb.edu/register/mpw-crs",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-crs-admission", "Conservation and Restoration Science admission baseline", [
        "Conservation and Restoration Science is a minimum-requirements major according to the current planning worksheet.",
        "The planning worksheet expects English composition, introductory biology, introductory chemistry, and one college-level math course such as precalculus or higher before entry review.",
        "The worksheet's competitive-advice snapshot is around a 2.70 prerequisite GPA and 2.70 cumulative GPA with prerequisites finished by the time of application.",
      ]),
      degreeMapSection("uwb-crs-core", "Conservation and Restoration Science required coursework", [
        "The degree requirements page organizes the major into 31 credits of introductory science coursework, 45 credits of major core coursework, and 20 credits of approved electives.",
        "The required core currently includes BES 301 or BST 301, BES 312, BES 316, BES 362, BES 485, BIS 342, BIS 380, and BIS 499 plus other approved conservation / restoration core courses listed on the page.",
        "The major is designed around environmental methods, restoration ecology, GIS, and conservation practice rather than a single narrow disciplinary sequence.",
      ]),
      degreeMapSection("uwb-crs-electives", "Conservation and Restoration Science electives and policies", [
        "Students complete 20 elective credits from the approved elective list, which includes advanced ecology, GIS, environmental-science, and restoration-focused coursework.",
        "The IAS policies on the page require 30 credits in residence at UW Bothell and at least a 2.00 cumulative GPA in the major.",
        "The degree also follows IAS upper-division limits, so students need enough 300-level and above coursework to finish the B.S. structure cleanly.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Culture, Literature & the Arts (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Culture, Literature and the Arts requirements",
        url: "https://www.uwb.edu/ias/undergraduate/majors/culture-literature-arts",
      },
      {
        label: "UW Bothell major planning worksheet - Culture, Literature and the Arts",
        url: "https://admissions.uwb.edu/register/mpw-CLA",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-cla-admission", "Culture, Literature and the Arts admission baseline", [
        "Culture, Literature and the Arts is a minimum-requirements IAS major.",
        "The planning worksheet expects English composition and at least one additional Arts and Humanities course before transfer entry review, with the usual IAS-admissions emphasis on a solid overall and prerequisite GPA.",
      ]),
      degreeMapSection("uwb-cla-core", "Culture, Literature and the Arts required coursework", [
        "The current CLA page lists a 70-credit major built from a small CLA core, 35 credits of CLA coursework, 20 additional IAS credits, and 10 composition credits.",
        "For students entering in Winter 2026 or later, the CLA core is BISCLA 201, while the page keeps a note about the older BISCLA 380 or 384 core pattern for Autumn 2025 and earlier cohorts.",
        "The CLA coursework is intentionally interdisciplinary across literature, arts, media, and cultural-studies traditions rather than one single fixed literary canon.",
      ]),
      degreeMapSection("uwb-cla-policies", "Culture, Literature and the Arts policies and finish", [
        "The page requires 30 credits in residence at UW Bothell and at least a 2.00 GPA in the major.",
        "It also follows the IAS B.A. policy that no more than 35 credits of 100- and 200-level coursework may apply to the major, so upper-division coursework carries much of the final CLA finish.",
        "The IAS Interdisciplinary Practice and Reflection requirement can overlap with CLA major coursework or be met through electives.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Data Visualization (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Data Visualization requirements",
        url: "https://www.uwb.edu/ias/undergraduate/majors/data-visualization",
      },
      {
        label: "UW Bothell major planning worksheet - Data Visualization (BA)",
        url: "https://admissions.uwb.edu/register/mpw-DataVis-BA",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-dv-ba-admission", "Data Visualization B.A. admission baseline", [
        "Data Visualization B.A. is a minimum-requirements IAS major.",
        "The B.A. planning worksheet expects English composition, advanced composition, precalculus, and statistics before entry review.",
        "The IAS planning-worksheet snapshot treats roughly a 2.70 prerequisite GPA and 2.70 cumulative GPA with prerequisites completed at the time of application as the more competitive profile.",
      ]),
      degreeMapSection("uwb-dv-ba-core", "Data Visualization B.A. required structure", [
        "The main Data Visualization page lists the B.A. as a 75-credit major.",
        "Its core is B DATA 200, B DATA 232, either BIS 218 or B GIS 342, and either BES 301 or BST 301.",
        "After that core, students complete 15 credits of Advanced Data Visualization and Analysis Methods, 15 credits of Spatial Data Analysis, and 25 credits of Data Visualization electives.",
      ]),
      degreeMapSection("uwb-dv-ba-policies", "Data Visualization B.A. policies and finish", [
        "The IAS policies on the major page require 30 credits in residence at UW Bothell and at least a 2.00 GPA in the major.",
        "For the B.A., a maximum of 35 lower-division credits can apply to the major, so the rest must be upper-division work.",
        "The IPR requirement can overlap with major credits or be completed through elective coursework.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Data Visualization (BS)")]: {
    officialLinks: [
      {
        label: "UW Bothell Data Visualization requirements",
        url: "https://www.uwb.edu/ias/undergraduate/majors/data-visualization",
      },
      {
        label: "UW Bothell major planning worksheet - Data Visualization (BS)",
        url: "https://admissions.uwb.edu/register/mpw-DataVis-BS",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-dv-bs-admission", "Data Visualization B.S. admission baseline", [
        "Data Visualization B.S. is a minimum-requirements IAS major.",
        "The B.S. planning worksheet expects English composition, Calculus I, statistics, and a two-course programming sequence equivalent to CSS 142 and 143 before entry review.",
        "The worksheet's competitive snapshot is around a 2.70 prerequisite GPA and 2.70 cumulative GPA with all prerequisites complete at the time of application.",
      ]),
      degreeMapSection("uwb-dv-bs-core", "Data Visualization B.S. required structure", [
        "The main major page lists the B.S. as a 90-credit degree built on the B DATA 200 and 232 core, either BIS 218 or B GIS 342, either BES 301 or BST 301, Calculus II, Calculus III, and linear algebra or matrix algebra.",
        "After that extended quantitative core, students complete 15 credits of Advanced Data Visualization and Analysis Methods, 15 credits of Spatial Data Analysis, and 25 credits of Data Visualization electives.",
      ]),
      degreeMapSection("uwb-dv-bs-policies", "Data Visualization B.S. policies and finish", [
        "The same IAS policies apply here: 30 credits in residence at UW Bothell and at least a 2.00 GPA in the major.",
        "For the B.S., up to 45 lower-division credits may apply to the major, and the remaining credits must be upper-division coursework.",
        "The IPR requirement can overlap with major work or be met through electives.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Developmental and Youth Studies (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Developmental and Youth Studies degree requirements",
        url: "https://www.uwb.edu/education/undergraduate/developmental-and-youth-studies/degree-requirements",
      },
      {
        label: "UW Bothell Developmental and Youth Studies admissions",
        url: "https://www.uwb.edu/education/undergraduate/developmental-and-youth-studies/admissions",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-dys-admission", "Developmental and Youth Studies admission baseline", [
        "The admissions page expects students to complete at least 30 transferable quarter credits and one English composition course equivalent to BWRIT 134 before entry review.",
        "The major is not built around a long STEM-style prerequisite ladder, but applicants still need the standard UW Bothell transfer minimums and a solid academic record.",
      ]),
      degreeMapSection("uwb-dys-core", "Developmental and Youth Studies required coursework", [
        "The current degree-requirements page begins with 25 credits of School of Educational Studies core courses: B EDUC 205, 210, 295, 300, and 310.",
        "It then adds 35 credits of Developmental and Youth Studies foundation courses including B EDUC 402, 451, 453, 456, 458, 461, and 481.",
        "Students also complete 15 credits of Developmental and Youth Studies electives from the approved list.",
      ]),
      degreeMapSection("uwb-dys-capstone", "Developmental and Youth Studies capstone and applied experience", [
        "The capstone sequence is 10 credits: B EDUC 495 Applied Experience followed by B EDUC 499 Capstone Project.",
        "The page says B EDUC 495 is the major's applied field experience, while B EDUC 499 builds a reflective portfolio tied to the School of Educational Studies core themes.",
        "Outside the major, students still complete the standard UW Bothell bachelor's requirements, including 180 total credits and the university writing, diversity, reasoning, Arts and Humanities, Natural Sciences, and Social Sciences requirements.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Earth System Science (BS)")]: {
    officialLinks: [
      {
        label: "UW Bothell Earth System Science requirements",
        url: "https://www.uwb.edu/ias/undergraduate/majors/earth-system-science",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-ess-admission", "Earth System Science preparation baseline", [
        "The current Earth System Science page asks students to reach the major with B WRIT 134 or an equivalent composition course, one introductory Earth System Science course, and one introductory math-and-science course from the approved lists.",
        "The approved introductory Earth System Science preparation courses include options such as BEARTH 153, 154, 155, 201, 202, BIS 242, BIS 243, and BPHYS 101, or approved transfer equivalents.",
      ]),
      degreeMapSection("uwb-ess-structure", "Earth System Science degree structure", [
        "The B.S. is currently organized into 25 credits of Earth System Science base coursework, 30 to 33 credits of introductory math and science requirements, 39 to 40 credits of Earth Systems Ascent coursework, and a 5-credit capstone.",
        "The page lists the overall major size as 98 to 103 credits.",
        "The base block includes BIS 342 plus BES 301 or BST 301, and the introductory math-and-science block explicitly requires introductory chemistry, physics, statistics, calculus, and additional foundation science.",
      ]),
      degreeMapSection("uwb-ess-policies", "Earth System Science policies and completion notes", [
        "The IAS policies on the page require 30 credits in residence at UW Bothell and at least a 2.00 cumulative GPA in the major.",
        "The page says the IPR requirement can overlap with ESS major credits and notes that the ESS capstone will generally complete the IPR requirement.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Economics (BS)")]: {
    officialLinks: [
      {
        label: "UW Bothell Bachelor of Economics overview",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics",
      },
      {
        label: "UW Bothell Economics prerequisites",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/prerequisites",
      },
      {
        label: "UW Bothell Economics curriculum",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-economics/curriculum",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-econ-admission", "Economics admission baseline", [
        "The current B.S. in Economics page says all entry pathways use the same five prerequisites: statistics, calculus, microeconomics, macroeconomics, and advanced composition.",
        "The prerequisite page also lists the common transfer matches, including MATH& 146 or BA& 240 for statistics, MATH& 148 or MATH& 151 for calculus, ECON& 201 for microeconomics, ECON& 202 for macroeconomics, and ENG& 102 for advanced composition.",
      ]),
      degreeMapSection("uwb-econ-core", "Economics required core", [
        "The current economics curriculum is a 55-credit major.",
        "The 30-credit core is BBUS 220 or BIS 200, BBUS 221 or BIS 201, BBUS 210, BBECN 302, BBECN 303, and BBECN 382.",
      ]),
      degreeMapSection("uwb-econ-electives", "Economics electives and degree finish", [
        "Students then complete 20 credits of economics electives from the approved list, which currently includes courses such as BBECN 300, BBUS 301, BBECN/BBUS 458, BBECN 460, and BBECN 469.",
        "The major also includes 5 credits of 300- or 400-level BBECN or BBUS general electives, and students still finish the normal UW Bothell general-education requirements outside the major.",
        "The overview page describes the B.S. as a STEM-designated economics degree focused on data-driven economic analysis.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Educational Studies: Elementary Education (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Elementary Education admissions",
        url: "https://www.uwb.edu/education/undergraduate/elementary-education/admissions",
      },
      {
        label: "UW Bothell Elementary Education overview",
        url: "https://www.uwb.edu/education/undergraduate/elementary-education",
      },
      {
        label: "UW Bothell Elementary Education degree requirements",
        url: "https://www.uwb.edu/education/undergraduate/elementary-education/degree-requirements",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-elementary-admission", "Elementary Education declaration baseline", [
        "Effective Autumn 2025, students can join the Elementary Education Option directly.",
        "The admissions page lists a minimum 2.00 cumulative GPA, 30 quarter credits, one English composition course equivalent to B WRIT 134 with at least a 2.0, and state basic-skills test scores through SAT, ACT, or WEST-B as the declaration requirements.",
      ]),
      degreeMapSection("uwb-elementary-core", "Elementary Education current major structure", [
        "For students declaring Autumn 2025 and after, the degree page currently organizes the option into 20 credits of School of Educational Studies core courses, 38 credits of Elementary Education endorsement academic breadth, 18 credits of teaching foundations courses, 28 credits of cohorted teaching-methods courses, 15 credits of dual-endorsement coursework, and 16 credits of student teaching.",
        "The current required teaching-methods and foundations sequence includes courses such as B EDUC 402, 403, 408, 409, 410, 418, 419, 421, 423, 438, and 441.",
      ]),
      degreeMapSection("uwb-elementary-certification", "Elementary Education certification and cohort finish", [
        "The degree includes a dual endorsement in either ESOL or Special Education, using the current B EDUC 442 to 444 or B EDUC 482 to 484 three-course blocks.",
        "The student-teaching block is B EDUC 406, B EDUC 425, and two student-teaching registrations in B EDUC 435.",
        "The certification section also says students must complete student teaching, pass the required NES and WEST-E exams or approved petitions, and submit a Professional Growth Plan for Washington teacher certification.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Electrical Engineering (BS)")]: {
    officialLinks: [
      {
        label: "UW Bothell Electrical Engineering admissions",
        url: "https://www.uwb.edu/stem/undergraduate/majors/electrical/admissions",
      },
      {
        label: "UW Bothell Electrical Engineering planning worksheet",
        url: "https://admissions.uwb.edu/register/mpw-EE",
      },
      {
        label: "UW Bothell Electrical Engineering curriculum",
        url: "https://www.uwb.edu/stem/undergraduate/majors/electrical/curriculum",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-ee-admission", "Electrical Engineering admission baseline", [
        "Electrical Engineering admits for autumn and winter entry.",
        "The current admissions materials require English composition, Calculus I, Calculus II, and Engineering Physics I, with at least a 2.3 in Calculus I, Calculus II, and Mechanics, at least a 2.6 average across those three STEM prerequisites, at least a 2.0 in composition, and at least a 2.70 cumulative GPA.",
        "The current planning worksheet describes around a 3.40 prerequisite GPA and 3.40 cumulative GPA as the more competitive profile.",
      ]),
      degreeMapSection("uwb-ee-core", "Electrical Engineering required core", [
        "The current EE curriculum lists 55 credits of core coursework.",
        "That core is BEE 200, 215, 233, 235, 271, 331, 332, 341, 361, and 425, followed by the engineering design / capstone sequence BENGR 494, 495, and 496.",
      ]),
      degreeMapSection("uwb-ee-electives", "Electrical Engineering electives and finish", [
        "Students then complete 15 credits of EE electives by choosing three approved courses from the published EE elective list.",
        "The current list includes courses such as BEE 381, 417, 427, 433, 436, 437, 440, 442, 445, 447, 450, 451, 454, 455, 457, 477, 478, 482, 484, and 486, with limited use of BEE 490, 498, and 499.",
        "Outside the major, the curriculum page also points students to the remaining university composition, writing, and general-education requirements needed for the full bachelor's degree.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Environmental Studies (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Environmental Studies requirements",
        url: "https://www.uwb.edu/ias/undergraduate/majors/environmental-studies",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-enst-admission", "Environmental Studies admission baseline", [
        "Environmental Studies has no formal prerequisites.",
        "The major page says current UW Bothell students in good academic standing can declare it, and incoming students can apply directly into the major.",
        "The page recommends environmental coursework and fieldwork as useful preparation.",
      ]),
      degreeMapSection("uwb-enst-core", "Environmental Studies required structure", [
        "The current Autumn 2024+ degree requires 10 credits of composition coursework and 30 credits of Environmental Studies core requirements.",
        "That current core is BIS 242 or BIS 243, BIS 245, BIS 307, BGIS 342, one of BIS 356 or BIS 386, and either BES 301 or BST 301.",
        "Students then complete 20 credits of Environmental Studies electives and 10 additional IAS credits.",
      ]),
      degreeMapSection("uwb-enst-policies", "Environmental Studies policies and finish", [
        "The current page lists the major at 70 total credits.",
        "It also requires 30 credits in residence at UW Bothell and at least a 2.00 GPA in the major, with the standard IAS upper-division policy limiting lower-division coursework to 35 credits in the major.",
        "The page notes that ENST courses are offered primarily during daytime hours.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Gender, Women, & Sexuality Studies (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Gender, Women & Sexuality Studies requirements",
        url: "https://www.uwb.edu/ias/undergraduate/majors/gender-women-sexuality",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-gwss-admission", "Gender, Women & Sexuality Studies admission baseline", [
        "GWSS has no official prerequisites.",
        "The major page says current UW Bothell students in good academic standing can declare it, and incoming students can apply directly into the major.",
        "The page suggests prior coursework in feminist studies, history and culture, sociology, or literature as helpful preparation.",
      ]),
      degreeMapSection("uwb-gwss-core", "Gender, Women & Sexuality Studies required structure", [
        "The current GWSS major is 75 credits.",
        "Its required core is BIS 290, BISGWS 301, and either BISGWS 302 or BISGWS 303, plus 30 additional GWSS major-work credits, 20 additional IAS credits, and 10 credits of composition coursework.",
      ]),
      degreeMapSection("uwb-gwss-policies", "Gender, Women & Sexuality Studies policies and finish", [
        "The page says GWSS faculty highly recommend completing both BISGWS 302 and BISGWS 303, even though only one is strictly required in the formal core.",
        "The IAS policies require 30 credits in residence, a minimum 2.00 GPA in the major, and enough upper-division coursework to stay within the 35-credit lower-division cap.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Global Studies (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Global Studies requirements",
        url: "https://www.uwb.edu/ias/undergraduate/majors/global-studies",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-gst-admission", "Global Studies admission baseline", [
        "Global Studies has no official prerequisites.",
        "The major page says students in good academic standing can declare it at any time, and incoming students can apply directly into the major.",
      ]),
      degreeMapSection("uwb-gst-core", "Global Studies required structure", [
        "The current Autumn 2024+ Global Studies major is 70 credits.",
        "The required structure is BISGST 303, one approved methods course, 30 credits of additional GST coursework, 20 additional IAS credits, and 10 credits of composition coursework.",
        "The current GST methods list includes BIS 215, BBUS 215, BMATH 215, BIS 312, BIS 340, BDATA 232, BGIS 342, and BES 301.",
      ]),
      degreeMapSection("uwb-gst-policies", "Global Studies policies and finish", [
        "The IAS policies require 30 credits in residence and at least a 2.00 GPA in the major.",
        "The major also follows the IAS upper-division rule limiting lower-division coursework to 35 credits within the degree.",
      ]),
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Health Studies (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Health Studies admissions",
        url: "https://www.uwb.edu/nhs/undergraduate/health-studies/admissions",
      },
      {
        label: "UW Bothell Health Studies overview and curriculum",
        url: "https://www.uwb.edu/nhs/undergraduate/health-studies/overview",
      },
      {
        label: "UW Bothell Health Studies planning worksheet",
        url: "https://admissions.uwb.edu/register/mpw-hs",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-health-admission", "Health Studies admission baseline", [
        "Before applying, students complete at least 30 quarter credits including two English composition courses, 5 credits of Reasoning with statistics preferred, and 10 credits in each Area of Inquiry: A&H, SSc, and NSc.",
        "The admissions page says students can apply for autumn, winter, or spring entry.",
      ]),
      degreeMapSection("uwb-health-core", "Health Studies required curriculum", [
        "The current overview organizes the Health Studies major around one statistics course plus a 35-credit required core.",
        "That required core is BHS 201, 210, 300, 302, 305, 403, and 496.",
      ]),
      degreeMapSection("uwb-health-electives", "Health Studies electives and finish", [
        "Students also complete 35 credits of approved Health Studies electives, with at least 10 credits in BHLTH course offerings, plus 15 credits of upper-division UW electives.",
        "The Health Studies electives are grouped into four interest areas: Health and Life Sciences, Community Health Intervention and Practice, Health and Society, and Health Policy, Leadership, and Ethics.",
      ]),
    ],
    manualReviewNotes: [
      "The current public materials describe the curriculum cleanly, but the exact elective mix still depends on the student's intended health pathway and the annually approved elective lists.",
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Interactive Media Design (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Interactive Media Design status page",
        url: "https://www.uwb.edu/stem/undergraduate/majors/interactive-media-design",
      },
      {
        label: "UW Bothell archived IMD planning worksheet",
        url: "https://www.uwb.edu/premajor/wp-content/uploads/sites/26/2023/07/fillable-imd.pdf",
      },
      {
        label: "UW Bothell archived 2017-2018 catalog - Interactive Media Design",
        url: "https://www.uwb.edu/catalog/wp-content/uploads/sites/44/2023/07/catalog17-18-in-final.pdf",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-imd-status", "Interactive Media Design current program status", [
        "The current IMD page says the program has been permanently suspended and no longer accepts applications for admission, while students already in the major are not affected.",
        "Because of that suspension, the remaining degree-planning details are necessarily archival rather than current-admissions guidance.",
      ]),
      degreeMapSection("uwb-imd-archived-admission", "Interactive Media Design archived admission baseline", [
        "The archived IMD planning worksheet and catalog describe admission through four prerequisite areas with minimum 2.0 grades: composition, an introductory course in interactive media / design thinking / visual arts, one web-development-and-programming course, and one statistics / quantitative-methods / data-visualization course.",
        "The archived 2021-2022 worksheet also describes IMD as a capacity-constrained, autumn-only cohort with portfolio review, and says around a 3.0 in each prerequisite was the more competitive profile.",
      ]),
      degreeMapSection("uwb-imd-archived-structure", "Interactive Media Design archived degree structure", [
        "The archived 2017-2018 catalog lists the major at 75 credits: 55 credits of core plus at least 20 credits of 300- and 400-level electives.",
        "The catalog's exact core is BIMD 351, 352, 353, 362, 363, 481, 482, 483, 491, 492, and 493, each requiring at least a 2.0.",
        "The archived worksheet also notes the cohort model and the program's integrated portfolio / studio structure, including BIMD 481 as part of the writing requirement inside the degree.",
      ]),
    ],
    manualReviewNotes: [
      "This is an archival row only. Because IMD no longer accepts new applicants, any current student still finishing the degree should use adviser-approved archived materials rather than assume the old public plan still runs unchanged.",
    ],
  },
  [buildPlannerLookupKey("uw-bothell", "Interdisciplinary Arts (BA)")]: {
    officialLinks: [
      {
        label: "UW Bothell Interdisciplinary Arts requirements",
        url: "https://www.uwb.edu/ias/undergraduate/majors/interdisciplinary-arts",
      },
      {
        label: "UW Bothell Green River equivalency guide",
        url: "https://www.uwb.edu/registrar/policies/community-college-course-equivalency-guide/green-river-college",
      },
    ],
    degreeMapSections: [
      degreeMapSection("uwb-ia-admission", "Interdisciplinary Arts admission baseline", [
        "Interdisciplinary Arts has no formal prerequisites.",
        "The major page says current UW Bothell students in good academic standing can declare it at any time, and incoming students can apply directly into the major.",
        "The page recommends prior visual, written, digital, or performing-arts experience plus strong collaborative and creative problem-solving skills.",
      ]),
      degreeMapSection("uwb-ia-core", "Interdisciplinary Arts required structure", [
        "The current Autumn 2024+ Interdisciplinary Arts major is 70 credits.",
        "The major currently requires 10 credits of composition coursework, the core course BISIA 219, 15 credits of Art Studios and Art Workshops courses, 20 credits of additional Interdisciplinary Arts coursework, and 20 additional IAS credits.",
      ]),
      degreeMapSection("uwb-ia-policies", "Interdisciplinary Arts policies and finish", [
        "The IAS policies require 30 credits in residence, a minimum 2.00 GPA in the major, and enough upper-division coursework to stay within the 35-credit lower-division cap.",
        "The page also notes that IA classes are offered primarily during daytime hours.",
      ]),
    ],
  },
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

function normalizeReferenceCourseLabel(value: string) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function uniqueReferenceCourseLabels(items: string[]) {
  const seen = new Set<string>();
  const uniqueItems: string[] = [];

  for (const item of items) {
    const normalized = normalizeReferenceCourseLabel(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    uniqueItems.push(normalized);
  }

  return uniqueItems;
}

function getChecklistReferenceCourses(plan: TransferPlannerMajorPlan) {
  return uniqueReferenceCourseLabels(
    [
      ...plan.applicationChecklist,
      ...plan.beforeEnrollmentChecklist,
      ...plan.stayAtGrcChecklist,
    ].flatMap((item) => [item.grcCourses, ...(item.alternatives ?? [])].flat())
  );
}

function getBankReferenceCourses(bankIds: string[] | undefined) {
  return uniqueReferenceCourseLabels(
    (bankIds ?? []).flatMap((bankId) => MASTER_BANK_BY_ID.get(bankId)?.courses ?? [])
  );
}

function materializePlanReferenceCourses(plan: TransferPlannerMajorPlan): TransferPlannerMajorPlan {
  return {
    ...plan,
    grcCourseList: uniqueReferenceCourseLabels([
      ...(plan.grcCourseList ?? []),
      ...getChecklistReferenceCourses(plan),
      ...getBankReferenceCourses(plan.bankIds),
    ]),
  };
}

function mergeDetailedPlanWithMaster(plan: TransferPlannerMajorPlan): TransferPlannerMajorPlan {
  const masterRow = getMasterRowForPlan(plan);
  if (!masterRow) {
    return materializePlanReferenceCourses({
      ...plan,
      sourceType: "detailed",
    });
  }

  return materializePlanReferenceCourses({
    ...plan,
    family: masterRow.family,
    bankIds: getMergedReferenceIds(plan.bankIds, masterRow.bankIds),
    chainIds: getMergedReferenceIds(plan.chainIds, masterRow.chainIds),
    plannerNote: plan.plannerNote ?? masterRow.note,
    sourceType: "detailed",
  });
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
    return "Use the Green River class list and prerequisite/full-credit notes below to build a custom transfer path for this degree.";
  }

  return `${track.code} is the closest Green River base path for this degree. Use it as the backbone, then apply the major-specific Green River class list and chain notes below.`;
}

function buildGeneratedMajorPlan(row: TransferPlannerMasterMajorRow): TransferPlannerMajorPlan {
  const bestTrackId = inferGeneratedTrackId(row);
  const shortTitle = buildShortPlannerTitle(row.title);
  const campus = TRANSFER_PLANNER_CAMPUSES.find((entry) => entry.id === row.campusId);
  const override = GENERATED_PLAN_DOC_OVERRIDES[buildPlannerLookupKey(row.campusId, row.title)];

  return materializePlanReferenceCourses({
    id: buildPlannerPlanId(row.campusId, row.title),
    campusId: row.campusId,
    title: row.title,
    shortTitle: shortTitle || row.title,
    coverage: "partial",
    summary: `Current Green River -> UW planning reference for ${row.title}. Use the attached Green River class list and prerequisite/full-credit notes below as the baseline before final advisor review.`,
    applicationWindow: "Check the official program transfer page",
    startQuarter: "Varies by major",
    bestTrackId,
    bestTrackSummary: buildGeneratedTrackSummary(bestTrackId),
    whyThisTrack: [
      "This is the closest current Green River transfer-associate backbone for the major's math, science, or programming mix.",
      "Use the class list and chain sections below to decide which Green River classes are the strongest fit for this specific degree.",
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
    ...(override ?? {}),
  });
}

export const TRANSFER_PLANNER_MAJOR_PLANS = TRANSFER_PLANNER_DETAILED_MAJOR_PLAN_DEFINITIONS.map(
  mergeDetailedPlanWithMaster
);

const DETAILED_PLAN_LOOKUP_KEYS = new Set(
  TRANSFER_PLANNER_MAJOR_PLANS.map((plan) => {
    const masterRow = getMasterRowForPlan(plan);
    return buildPlannerLookupKey(plan.campusId, masterRow?.title ?? plan.title);
  })
);

export const TRANSFER_PLANNER_ALL_MAJOR_PLANS: TransferPlannerMajorPlan[] = [
  ...TRANSFER_PLANNER_MAJOR_PLANS,
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

export function getTransferPlannerGrcCourseList(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) return [] as string[];

  return uniqueReferenceCourseLabels(
    plan.grcCourseList ?? [
      ...getChecklistReferenceCourses(plan),
      ...getBankReferenceCourses(plan.bankIds),
    ]
  );
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
