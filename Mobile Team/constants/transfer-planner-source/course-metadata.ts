import type {
  TransferPlannerEffectiveYearRange,
  TransferPlannerSourceLink,
  TransferPlannerSourceSchoolId,
} from "./schema";
import { TRANSFER_PLANNER_GENERATED_COURSE_METADATA } from "./course-metadata.generated";

export type TransferPlannerNormalizedCourseMetadataEntry = {
  schoolId: TransferPlannerSourceSchoolId;
  code: string;
  title?: string;
  creditValue?: number | null;
  creditLabel?: string | null;
  catalogDescription?: string | null;
  prerequisiteCourseCodes?: string[];
  prerequisiteAlternativeCourseCodeSets?: string[][];
  prerequisiteNotes?: string[];
  corequisiteCourseCodes?: string[];
  corequisiteAlternativeCourseCodeSets?: string[][];
  corequisiteNotes?: string[];
  effectiveYearRanges?: TransferPlannerEffectiveYearRange[];
  sourceLinks?: TransferPlannerSourceLink[];
  notes?: string[];
};

const GRC_CURRENT_SOURCE_LINKS: TransferPlannerSourceLink[] = [
  {
    label: "Green River transfer planning sheet 2024",
    url: "https://www.greenriver.edu/marketing/media/documents/grad-to-gator/Associate%20Transfer%20Sample%20Ed%20Plans%202024.pdf",
  },
  {
    label: "Green River annual schedule 2024-2025",
    url: "https://www.greenriver.edu/students/media/documents/schedules-and-catalog/2024-2025-Annual-Schedule.pdf",
  },
  {
    label: "Green River annual schedule 2025-2026",
    url: "https://www.greenriver.edu/students/media/documents/schedules-and-catalog/2025-2026%20Annual%20Schedule%20w%20Cover.pdf",
  },
];

const UW_SEATTLE_COMPUTING_SOURCE_LINKS: TransferPlannerSourceLink[] = [
  {
    label: "UW CSE undergraduate degree requirements courses",
    url: "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/",
  },
];

function normalizeCourseCode(code: string) {
  return String(code ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function grcCourseMetadata(
  code: string,
  title: string,
  creditValue: number,
  config: Omit<
    TransferPlannerNormalizedCourseMetadataEntry,
    "schoolId" | "code" | "title" | "creditValue" | "sourceLinks"
  > = {}
): TransferPlannerNormalizedCourseMetadataEntry {
  return {
    schoolId: "grc",
    code: normalizeCourseCode(code),
    title,
    creditValue,
    creditLabel: String(creditValue),
    sourceLinks: GRC_CURRENT_SOURCE_LINKS,
    notes: [
      "Planner-normalized course metadata from the current Green River schedule and transfer-planning sources.",
      ...(config.notes ?? []),
    ],
    ...config,
  };
}

function uwCourseMetadata(
  schoolId: Exclude<TransferPlannerSourceSchoolId, "grc">,
  code: string,
  title: string,
  creditValue: number,
  config: Omit<
    TransferPlannerNormalizedCourseMetadataEntry,
    "schoolId" | "code" | "title" | "creditValue"
  > = {}
): TransferPlannerNormalizedCourseMetadataEntry {
  return {
    schoolId,
    code: normalizeCourseCode(code),
    title,
    creditValue,
    creditLabel: String(creditValue),
    ...config,
  };
}

const TRANSFER_PLANNER_MANUAL_COURSE_METADATA_RAW: TransferPlannerNormalizedCourseMetadataEntry[] = [
  grcCourseMetadata("ENGL& 101", "English Composition I", 5),

  grcCourseMetadata("MATH& 151", "Calculus I", 5),
  grcCourseMetadata("MATH& 152", "Calculus II", 5, {
    prerequisiteCourseCodes: ["MATH& 151"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the current Green River STEM calculus path."],
  }),
  grcCourseMetadata("MATH& 163", "Calculus III", 5, {
    prerequisiteCourseCodes: ["MATH& 152"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the current Green River STEM calculus path."],
  }),
  grcCourseMetadata("MATH& 153", "Calculus III", 5, {
    prerequisiteCourseCodes: ["MATH& 152"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the older Green River STEM calculus alternative still preserved by the planner."],
  }),
  grcCourseMetadata("MATH& 254", "Calculus IV", 5, {
    prerequisiteCourseCodes: ["MATH& 153"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the older Green River STEM calculus alternative still preserved by the planner."],
    effectiveYearRanges: [
      {
        startLabel: "legacy-planner-support",
        endLabel: null,
        note: "Retained because current UW and planner materials still preserve the older calculus path as a valid alternate route.",
      },
    ],
  }),
  grcCourseMetadata("MATH 238", "Differential Equations", 5, {
    prerequisiteAlternativeCourseCodeSets: [["MATH& 163"], ["MATH& 153", "MATH& 254"]],
    prerequisiteNotes: ["Planner-normalized prerequisite supports either the current Calc III path or the older Calc III plus Calc IV path."],
  }),
  grcCourseMetadata("MATH 240", "Linear Algebra", 5, {
    prerequisiteAlternativeCourseCodeSets: [["MATH& 163"], ["MATH& 153", "MATH& 254"]],
    prerequisiteNotes: ["Planner-normalized prerequisite supports the Calc III path used by the current Green River math flowchart, while preserving the older planner-supported calculus route."],
  }),
  grcCourseMetadata("MATH& 146", "Introduction to Statistics", 5),
  grcCourseMetadata("MATH 256", "Statistics", 5),

  grcCourseMetadata("CHEM& 121", "Introduction to Chemistry", 5),
  grcCourseMetadata("CHEM& 131", "Introductory Chemistry", 5),
  grcCourseMetadata("CHEM& 140", "General Chemistry Preparation", 5),
  grcCourseMetadata("CHEM& 161", "General Chemistry with Lab I", 5),
  grcCourseMetadata("CHEM& 162", "General Chemistry with Lab II", 5, {
    prerequisiteCourseCodes: ["CHEM& 161"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the current Green River general chemistry sequence."],
  }),
  grcCourseMetadata("CHEM& 163", "General Chemistry with Lab III", 5, {
    prerequisiteCourseCodes: ["CHEM& 162"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the current Green River general chemistry sequence."],
  }),
  grcCourseMetadata("CHEM& 261", "Organic Chemistry with Lab I", 5),
  grcCourseMetadata("CHEM& 262", "Organic Chemistry with Lab II", 5, {
    prerequisiteCourseCodes: ["CHEM& 261"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the Green River organic chemistry sequence."],
  }),
  grcCourseMetadata("CHEM& 263", "Organic Chemistry with Lab III", 5, {
    prerequisiteCourseCodes: ["CHEM& 262"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the Green River organic chemistry sequence."],
  }),

  grcCourseMetadata("BIOL& 100", "Survey of Biology", 5),
  grcCourseMetadata("BIOL& 160", "General Biology with Lab", 5),
  grcCourseMetadata("BIOL& 211", "Biology Majors I", 5),
  grcCourseMetadata("BIOL& 212", "Biology Majors II", 5, {
    prerequisiteCourseCodes: ["BIOL& 211"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the biology-majors series used by multiple Seattle science pathways."],
  }),
  grcCourseMetadata("BIOL& 213", "Biology Majors III", 5, {
    prerequisiteCourseCodes: ["BIOL& 212"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the biology-majors series used by multiple Seattle science pathways."],
  }),
  grcCourseMetadata("BIOL& 241", "Human Anatomy and Physiology I", 5),
  grcCourseMetadata("BIOL& 242", "Human Anatomy and Physiology II", 5, {
    prerequisiteCourseCodes: ["BIOL& 241"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the anatomy and physiology sequence."],
  }),
  grcCourseMetadata("BIOL& 260", "Microbiology", 5),

  grcCourseMetadata("PHYS& 114", "General Physics with Lab I", 5),
  grcCourseMetadata("PHYS& 115", "General Physics with Lab II", 5, {
    prerequisiteCourseCodes: ["PHYS& 114"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the algebra-based physics sequence."],
  }),
  grcCourseMetadata("PHYS& 116", "General Physics with Lab III", 5, {
    prerequisiteCourseCodes: ["PHYS& 115"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the algebra-based physics sequence."],
  }),
  grcCourseMetadata("PHYS& 221", "Engineering Physics I", 5),
  grcCourseMetadata("PHYS& 222", "Engineering Physics II", 5, {
    prerequisiteCourseCodes: ["PHYS& 221"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the calculus-based physics sequence."],
  }),
  grcCourseMetadata("PHYS& 223", "Engineering Physics III", 5, {
    prerequisiteCourseCodes: ["PHYS& 222"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the calculus-based physics sequence."],
  }),

  grcCourseMetadata("CS 121", "Computer Science I", 5),
  grcCourseMetadata("CS 122", "Computer Science II", 5, {
    prerequisiteCourseCodes: ["CS 121"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the current Green River CS 121/122/123 path."],
  }),
  grcCourseMetadata("CS 123", "Computer Science III", 5, {
    prerequisiteCourseCodes: ["CS 122"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the current Green River CS 121/122/123 path."],
  }),

  grcCourseMetadata("ENGR 140", "Materials Science", 5),
  grcCourseMetadata("ENGR 250", "Scientific Computing", 5),
  grcCourseMetadata("ENGR& 204", "Electrical Circuits", 5),
  grcCourseMetadata("ENGR& 214", "Statics", 5),
  grcCourseMetadata("ENGR& 215", "Mechanics of Materials", 5, {
    prerequisiteCourseCodes: ["ENGR& 214"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the shared engineering mechanics sequence."],
  }),
  grcCourseMetadata("ENGR& 224", "Thermodynamics", 5),
  grcCourseMetadata("ENGR& 225", "Dynamics", 5, {
    prerequisiteCourseCodes: ["ENGR& 215"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the shared engineering mechanics sequence used in the planner."],
  }),

  grcCourseMetadata("GEOG& 100", "Physical Geography", 5),
  grcCourseMetadata("GEOG& 200", "Human Geography", 5),
  grcCourseMetadata("GIS 202", "Geographic Information Systems I", 5),
  grcCourseMetadata("GIS 260", "Geographic Information Systems II", 5, {
    prerequisiteCourseCodes: ["GIS 202"],
    prerequisiteNotes: ["Planner-normalized sequential prerequisite from the Green River GIS preparation path used by Tacoma and Seattle geography routes."],
  }),

  grcCourseMetadata("HL ED 190", "Introduction to Public Health", 5),
  grcCourseMetadata("NUTR& 101", "Nutrition", 5),
  grcCourseMetadata("PHIL& 120", "Symbolic Logic", 5),

  uwCourseMetadata("uw-seattle", "CSE 121", "Computer Programming I", 4, {
    sourceLinks: UW_SEATTLE_COMPUTING_SOURCE_LINKS,
  }),
  uwCourseMetadata("uw-seattle", "CSE 122", "Computer Programming II", 4, {
    prerequisiteCourseCodes: ["CSE 121"],
    prerequisiteNotes: ["Current UW Seattle computing sequence uses CSE 121 before CSE 122."],
    sourceLinks: UW_SEATTLE_COMPUTING_SOURCE_LINKS,
  }),
  uwCourseMetadata("uw-seattle", "CSE 123", "Computer Programming III", 4, {
    prerequisiteCourseCodes: ["CSE 122"],
    prerequisiteNotes: ["Current UW Seattle computing sequence uses CSE 122 before CSE 123."],
    sourceLinks: UW_SEATTLE_COMPUTING_SOURCE_LINKS,
  }),
];

const GENERATED_GRC_STRUCTURED_REQUIREMENT_COVERAGE = new Map<
  string,
  {
    prerequisite: boolean;
    corequisite: boolean;
  }
>();

for (const entry of TRANSFER_PLANNER_GENERATED_COURSE_METADATA) {
  if (entry.schoolId !== "grc") {
    continue;
  }

  GENERATED_GRC_STRUCTURED_REQUIREMENT_COVERAGE.set(`${entry.schoolId}|${entry.code}`, {
    prerequisite:
      (entry.prerequisiteCourseCodes ?? []).length > 0 ||
      (entry.prerequisiteAlternativeCourseCodeSets ?? []).length > 0,
    corequisite:
      (entry.corequisiteCourseCodes ?? []).length > 0 ||
      (entry.corequisiteAlternativeCourseCodeSets ?? []).length > 0,
  });
}

function dropManualStructuredRequirementFieldsWhenGeneratedCovered(
  entry: TransferPlannerNormalizedCourseMetadataEntry
): TransferPlannerNormalizedCourseMetadataEntry {
  const coverage = GENERATED_GRC_STRUCTURED_REQUIREMENT_COVERAGE.get(
    `${entry.schoolId}|${entry.code}`
  );
  if (!coverage) {
    return entry;
  }

  const nextEntry: TransferPlannerNormalizedCourseMetadataEntry = { ...entry };
  if (coverage.prerequisite) {
    delete nextEntry.prerequisiteCourseCodes;
    delete nextEntry.prerequisiteAlternativeCourseCodeSets;
    delete nextEntry.prerequisiteNotes;
  }
  if (coverage.corequisite) {
    delete nextEntry.corequisiteCourseCodes;
    delete nextEntry.corequisiteAlternativeCourseCodeSets;
    delete nextEntry.corequisiteNotes;
  }

  return nextEntry;
}

const TRANSFER_PLANNER_MANUAL_COURSE_METADATA: TransferPlannerNormalizedCourseMetadataEntry[] =
  TRANSFER_PLANNER_MANUAL_COURSE_METADATA_RAW.map(
    dropManualStructuredRequirementFieldsWhenGeneratedCovered
  );

export const TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA: TransferPlannerNormalizedCourseMetadataEntry[] = [
  ...TRANSFER_PLANNER_GENERATED_COURSE_METADATA,
  ...TRANSFER_PLANNER_MANUAL_COURSE_METADATA,
];
