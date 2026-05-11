import { normalizeTransferPlannerCourseCode } from "./course-code-normalization";
import {
  TRANSFER_PLANNER_GENERATED_PROGRAM_APPROVED_COURSE_FILTERS,
} from "./generated-program-approved-course-filters";

export const COMPUTER_SCIENCE_APPROVED_SCIENCE_FILTER_ID =
  "CS_APPROVED_SCIENCE";
export const COMPUTER_SCIENCE_APPROVED_SCIENCE_FILTER_PARAM =
  "computer-science-approved-science";
export const COMPUTER_SCIENCE_APPROVED_SCIENCE_FILTER_LABEL =
  "CS-approved Science";

export type TransferPlannerProgramApprovedCourseFilterDefinition = {
  filterId: string;
  filterKey: string;
  label: string;
  ownerIds: readonly string[];
  campusId: "uw-seattle" | "uw-bothell" | "uw-tacoma";
  officialSourceUrl: string;
  sourceUrl?: string | null;
  sourceRole?: string | null;
  approvedUwCourseCodes: readonly string[];
  approvedUwCourseGroups?: readonly (readonly string[])[];
  petitionOnlyNotes?: readonly string[];
  genericCategoryTags?: readonly string[];
  aliases?: readonly string[];
  allowEquivalencyRulesWithAdditionalTargets?: boolean;
  generatedFromOfficialSupportSource?: boolean;
  sourceEvidenceLines?: readonly string[];
  sourceEvidenceHeadings?: readonly string[];
  sourceFingerprint?: string;
  generatedAt?: string;
};

const GENERATED_PROGRAM_APPROVED_COURSE_FILTERS =
  TRANSFER_PLANNER_GENERATED_PROGRAM_APPROVED_COURSE_FILTERS as readonly TransferPlannerProgramApprovedCourseFilterDefinition[];

// Compatibility exports for existing runtime/UI call sites. Do not add course
// arrays here; update the parser/generator so the generated registry changes.
const COMPUTER_SCIENCE_APPROVED_SCIENCE_GENERATED_FILTER =
  GENERATED_PROGRAM_APPROVED_COURSE_FILTERS.find(
    (definition) =>
      definition.filterKey === COMPUTER_SCIENCE_APPROVED_SCIENCE_FILTER_PARAM ||
      definition.filterId === COMPUTER_SCIENCE_APPROVED_SCIENCE_FILTER_ID
  );

export const COMPUTER_SCIENCE_APPROVED_SCIENCE_SOURCE_URL =
  COMPUTER_SCIENCE_APPROVED_SCIENCE_GENERATED_FILTER?.officialSourceUrl ??
  "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#natural-science";

export const COMPUTER_SCIENCE_APPROVED_SCIENCE_UW_COURSE_CODES =
  COMPUTER_SCIENCE_APPROVED_SCIENCE_GENERATED_FILTER?.approvedUwCourseCodes ?? [];

export const COMPUTER_SCIENCE_APPROVED_SCIENCE_UW_COURSE_GROUPS =
  COMPUTER_SCIENCE_APPROVED_SCIENCE_GENERATED_FILTER?.approvedUwCourseGroups ?? [];

export const COMPUTER_SCIENCE_APPROVED_SCIENCE_PETITION_ONLY_NOTES =
  COMPUTER_SCIENCE_APPROVED_SCIENCE_GENERATED_FILTER?.petitionOnlyNotes ?? [];

export const TRANSFER_PLANNER_PROGRAM_APPROVED_COURSE_FILTERS =
  GENERATED_PROGRAM_APPROVED_COURSE_FILTERS;

function normalizeFilterKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getTransferPlannerProgramApprovedCourseFilterDefinition(
  filterKey: string | null | undefined
) {
  const normalizedKey = normalizeFilterKey(filterKey);
  if (!normalizedKey) {
    return null;
  }

  return (
    TRANSFER_PLANNER_PROGRAM_APPROVED_COURSE_FILTERS.find((definition) => {
      const acceptedKeys = [
        definition.filterKey,
        definition.filterId,
        definition.label,
        ...(definition.aliases ?? []),
      ].map(normalizeFilterKey);
      return acceptedKeys.includes(normalizedKey);
    }) ?? null
  );
}

export function getTransferPlannerProgramApprovedCourseFilterDefinitionsForOwner(
  ownerId: string | null | undefined
) {
  const normalizedOwnerId = String(ownerId ?? "").trim();
  if (!normalizedOwnerId) {
    return [];
  }
  return TRANSFER_PLANNER_PROGRAM_APPROVED_COURSE_FILTERS.filter((definition) =>
    definition.ownerIds.some((ownerId) => ownerId === normalizedOwnerId)
  );
}

export function getTransferPlannerProgramApprovedUwCourseCodeSet(
  filterKey: string | null | undefined
) {
  const definition = getTransferPlannerProgramApprovedCourseFilterDefinition(filterKey);
  if (!definition) {
    return new Set<string>();
  }

  return new Set(
    definition.approvedUwCourseCodes
      .map((courseCode) => normalizeTransferPlannerCourseCode(courseCode))
      .filter(Boolean)
  );
}

export function isTransferPlannerProgramApprovedUwCourseCode(
  filterKey: string | null | undefined,
  courseCode: string | null | undefined
) {
  return getTransferPlannerProgramApprovedUwCourseCodeSet(filterKey).has(
    normalizeTransferPlannerCourseCode(String(courseCode ?? ""))
  );
}
