import type {
  TransferPlannerEffectiveYearRange,
  TransferPlannerSourceLink,
  TransferPlannerSourceSchoolId,
} from "./schema";
import { normalizeTransferPlannerCourseCode } from "./course-code-normalization";
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

const GRC_EQUIVALENT_COURSE_CODE_SETS = [
  ["MATH& 254", "MATH& 264"],
  ["PHYS 154", "PHYS& 154"],
  ["PHYS 155", "PHYS& 155"],
] as const;

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

function normalizeCourseMetadataLookupCode(value: string | null | undefined) {
  return normalizeTransferPlannerCourseCode(String(value ?? ""));
}

const GRC_EQUIVALENT_COURSE_CODES_BY_CODE = GRC_EQUIVALENT_COURSE_CODE_SETS.reduce(
  (lookup, courseSet) => {
    const normalizedCourseSet = courseSet
      .map((code) => normalizeCourseMetadataLookupCode(code))
      .filter(Boolean);

    for (const code of normalizedCourseSet) {
      lookup.set(
        code,
        normalizedCourseSet.filter((candidateCode) => candidateCode !== code)
      );
    }

    return lookup;
  },
  new Map<string, string[]>()
);

const TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA_BY_LOOKUP_KEY = new Map<
  string,
  TransferPlannerNormalizedCourseMetadataEntry
>(
  TRANSFER_PLANNER_GENERATED_COURSE_METADATA.map((entry) => [
    `${entry.schoolId}|${normalizeCourseMetadataLookupCode(entry.code)}`,
    entry,
  ])
);

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

function getEquivalentCourseCodes(
  schoolId: TransferPlannerSourceSchoolId,
  code: string | null | undefined
) {
  const normalizedCode = normalizeCourseMetadataLookupCode(code);
  if (!normalizedCode) {
    return [] as string[];
  }

  const equivalentCourseCodes =
    schoolId === "grc" ? GRC_EQUIVALENT_COURSE_CODES_BY_CODE.get(normalizedCode) ?? [] : [];

  return [normalizedCode, ...equivalentCourseCodes].filter(
    (candidateCode, index, allCodes) =>
      Boolean(candidateCode) && allCodes.indexOf(candidateCode) === index
  );
}

function getCourseMetadataEntryScore(
  entry: TransferPlannerNormalizedCourseMetadataEntry,
  requestedCode: string
) {
  let score = 0;

  if (entry.title) score += 32;
  if (entry.creditValue !== undefined && entry.creditValue !== null) score += 16;
  if (entry.creditLabel) score += 8;
  if (entry.catalogDescription) score += 16;
  if ((entry.prerequisiteCourseCodes ?? []).length > 0) score += 8;
  if ((entry.prerequisiteAlternativeCourseCodeSets ?? []).length > 0) score += 6;
  if ((entry.corequisiteCourseCodes ?? []).length > 0) score += 8;
  if ((entry.corequisiteAlternativeCourseCodeSets ?? []).length > 0) score += 6;
  if ((entry.effectiveYearRanges ?? []).length > 0) score += 4;
  if ((entry.sourceLinks ?? []).length > 0) score += 4;
  if ((entry.notes ?? []).length > 0) score += 2;
  if (normalizeCourseMetadataLookupCode(entry.code) === requestedCode) score += 1;

  return score;
}

export function getTransferPlannerEquivalentCourseCodes(
  schoolId: TransferPlannerSourceSchoolId,
  code: string
) {
  return getEquivalentCourseCodes(schoolId, code);
}

export function getTransferPlannerNormalizedCourseMetadataEntry(
  schoolId: TransferPlannerSourceSchoolId,
  code: string
) {
  const candidateCodes = getEquivalentCourseCodes(schoolId, code);
  const requestedCode = normalizeCourseMetadataLookupCode(code);

  const metadataCandidates = candidateCodes
    .map(
      (candidateCode) =>
        TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA_BY_LOOKUP_KEY.get(
          `${schoolId}|${candidateCode}`
        ) ?? null
    )
    .filter(
      (
        entry,
        index,
        allEntries
      ): entry is TransferPlannerNormalizedCourseMetadataEntry =>
        Boolean(entry) &&
        allEntries.findIndex(
          (candidateEntry) =>
            candidateEntry?.schoolId === entry?.schoolId && candidateEntry?.code === entry?.code
        ) === index
    );

  return (
    [...metadataCandidates].sort((left, right) => {
      const scoreDelta =
        getCourseMetadataEntryScore(right, requestedCode) -
        getCourseMetadataEntryScore(left, requestedCode);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return left.code.localeCompare(right.code);
    })[0] ?? null
  );
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
