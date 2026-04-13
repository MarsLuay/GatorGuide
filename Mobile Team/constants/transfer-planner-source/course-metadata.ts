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

export type TransferPlannerCourseMetadataField =
  | "title"
  | "creditValue"
  | "creditLabel"
  | "catalogDescription"
  | "prerequisiteCourseCodes"
  | "prerequisiteAlternativeCourseCodeSets"
  | "prerequisiteNotes"
  | "corequisiteCourseCodes"
  | "corequisiteAlternativeCourseCodeSets"
  | "corequisiteNotes"
  | "effectiveYearRanges"
  | "sourceLinks"
  | "notes";

export type TransferPlannerCourseMetadataFieldSourceGapState =
  | "generated-present"
  | "generated-missing";

export type TransferPlannerCourseMetadataFieldGapStates = Record<
  TransferPlannerCourseMetadataField,
  TransferPlannerCourseMetadataFieldSourceGapState
>;

export type TransferPlannerCourseMetadataFieldGapEntry = {
  schoolId: TransferPlannerSourceSchoolId;
  code: string;
  fieldStates: TransferPlannerCourseMetadataFieldGapStates;
  missingFields: TransferPlannerCourseMetadataField[];
};

const METADATA_GAP_FIELDS: TransferPlannerCourseMetadataField[] = [
  "title",
  "creditValue",
  "creditLabel",
  "catalogDescription",
  "prerequisiteCourseCodes",
  "prerequisiteAlternativeCourseCodeSets",
  "prerequisiteNotes",
  "corequisiteCourseCodes",
  "corequisiteAlternativeCourseCodeSets",
  "corequisiteNotes",
  "effectiveYearRanges",
  "sourceLinks",
  "notes",
];

function hasMetadataFieldValue(
  entry: TransferPlannerNormalizedCourseMetadataEntry,
  field: TransferPlannerCourseMetadataField
) {
  const value = entry[field];

  if (field === "creditValue") {
    return value !== undefined && value !== null;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.some((item) => {
      if (Array.isArray(item)) {
        return item.length > 0;
      }
      if (typeof item === "string") {
        return item.trim().length > 0;
      }
      return item !== null && item !== undefined;
    });
  }

  return value !== undefined && value !== null;
}

function buildMetadataFieldGapEntry(
  entry: TransferPlannerNormalizedCourseMetadataEntry
): TransferPlannerCourseMetadataFieldGapEntry {
  const fieldStates = Object.fromEntries(
    METADATA_GAP_FIELDS.map((field) => [
      field,
      hasMetadataFieldValue(entry, field) ? "generated-present" : "generated-missing",
    ])
  ) as TransferPlannerCourseMetadataFieldGapStates;

  return {
    schoolId: entry.schoolId,
    code: entry.code,
    fieldStates,
    missingFields: METADATA_GAP_FIELDS.filter(
      (field) => fieldStates[field] === "generated-missing"
    ),
  };
}

export const TRANSFER_PLANNER_COURSE_METADATA_FIELD_GAP_STATES: TransferPlannerCourseMetadataFieldGapEntry[] =
  TRANSFER_PLANNER_GENERATED_COURSE_METADATA.map(buildMetadataFieldGapEntry);

export const TRANSFER_PLANNER_COURSE_METADATA_FIELD_GAPS: TransferPlannerCourseMetadataFieldGapEntry[] =
  TRANSFER_PLANNER_COURSE_METADATA_FIELD_GAP_STATES.filter(
    (entry) => entry.missingFields.length > 0
  );

export const TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA: TransferPlannerNormalizedCourseMetadataEntry[] = [
  ...TRANSFER_PLANNER_GENERATED_COURSE_METADATA,
];
