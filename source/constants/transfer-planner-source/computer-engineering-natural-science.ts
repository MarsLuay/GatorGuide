import { normalizeTransferPlannerCourseCode } from "./course-code-normalization";
import {
  TRANSFER_PLANNER_GENERATED_PROGRAM_APPROVED_COURSE_FILTERS,
} from "./generated-program-approved-course-filters";
import type {
  TransferPlannerProgramApprovedCourseFilterDefinition,
} from "./program-approved-course-filters";

export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID =
  "CE_APPROVED_NATURAL_SCIENCE";
export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_PARAM =
  "ce-approved-natural-science";
export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_LABEL =
  "CE-approved Natural Science";
export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_HEADING =
  "Computer Engineering Natural Science";
export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_CATEGORY =
  "COMPE_APPROVED_NATURAL_SCIENCE";
export const COMPUTER_ENGINEERING_APPROVED_MATH_SCIENCE_CATEGORY =
  "COMPE_APPROVED_MATH_SCIENCE";

// Compatibility exports for existing CE-specific call sites. Do not add course
// arrays here; the generated program-approved filter registry owns the list.
const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_GENERATED_FILTER =
  (TRANSFER_PLANNER_GENERATED_PROGRAM_APPROVED_COURSE_FILTERS as readonly TransferPlannerProgramApprovedCourseFilterDefinition[]).find(
    (definition) =>
      definition.filterKey === "computer-engineering-natural-science" ||
      definition.filterId === COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID
  );

export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_SOURCE_URL =
  COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_GENERATED_FILTER?.officialSourceUrl ??
  "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#core";

export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_UW_COURSE_CODES =
  COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_GENERATED_FILTER?.approvedUwCourseCodes ?? [];

export const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_PETITION_ONLY_NOTES =
  COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_GENERATED_FILTER?.petitionOnlyNotes ?? [];

const COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_UW_COURSE_CODE_SET =
  new Set(
    COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_UW_COURSE_CODES.map((courseCode) =>
      normalizeTransferPlannerCourseCode(courseCode)
    )
  );

export function isComputerEngineeringApprovedNaturalScienceUwCourseCode(
  courseCode: string | null | undefined
) {
  return COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_UW_COURSE_CODE_SET.has(
    normalizeTransferPlannerCourseCode(String(courseCode ?? ""))
  );
}

export function isComputerEngineeringApprovedNaturalScienceCategory(
  value: string | null | undefined
) {
  return (
    String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") === COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_CATEGORY
  );
}

export function normalizeComputerEngineeringNaturalScienceFilterId(
  value: string | null | undefined
) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (
    normalized === COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_PARAM ||
    normalized === "computer-engineering-natural-science" ||
    normalized === "ce-natural-science" ||
    normalized === "ce-approved-nsc" ||
    normalized === "ce-approved-natural-sciences"
  ) {
    return COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID;
  }

  return null;
}
