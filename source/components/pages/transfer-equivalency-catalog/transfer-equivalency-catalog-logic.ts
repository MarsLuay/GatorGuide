import {
  getTransferEquivalencyTagDisplayLabel,
  getTransferEquivalencyTagLabel,
  getTransferEquivalencyTagLongLabel,
  isTransferEquivalencyTrackedTag,
  normalizeTransferEquivalencyTag,
  TRANSFER_EQUIVALENCY_TRACKED_TAGS,
  type TransferEquivalencyTrackedTag,
} from "@/constants/transfer-equivalency-tags";
import {
  COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID,
  COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_LABEL,
  COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_HEADING,
  normalizeComputerEngineeringNaturalScienceFilterId,
} from "@/constants/transfer-planner-source/computer-engineering-natural-science";
import { getTransferPlannerNormalizedCourseMetadataEntries } from "@/constants/transfer-planner-source/course-metadata";
import type {
  TransferEquivalencyCatalogCampus,
  TransferEquivalencyCatalogEntry,
} from "@/constants/transfer-equivalency-catalog.generated";
import type { TransferPlannerCampusId } from "@/constants/transfer-planner-types";
import {
  buildEligibleTransferCategorySourceCourseCodesForPlan,
  buildTransferPlannerGrcTranscriptReadyCourseCodes,
  extractCourseCodes,
  getComputerEngineeringApprovedNaturalScienceTransferEntries,
  isTransferPlannerGrcCourseSetTranscriptReady,
} from "@/services/planning/transfer-planner.service";

export const DEFAULT_TRANSFER_EQUIVALENCY_CAMPUS_ID: TransferPlannerCampusId =
  "uw-seattle";
export const DEFAULT_TRANSFER_EQUIVALENCY_COLLEGE_ID: TransferEquivalencyCatalogCollegeId =
  "uw";

export type TransferEquivalencyCatalogCollegeId = "uw" | "grc";
export type TransferEquivalencySpecialFilterId =
  typeof COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID;
export type TransferEquivalencyCatalogFilterId =
  | TransferEquivalencyTrackedTag
  | TransferEquivalencySpecialFilterId;
export type TransferEquivalencyCatalogDisplayEntry = Omit<
  TransferEquivalencyCatalogEntry,
  "tags"
> & {
  tags: string[];
  ceApprovedReason?: "approved-uw-equivalent" | "compound-path" | null;
};

type MajorPlanForEligibleCodes = Parameters<
  typeof buildEligibleTransferCategorySourceCourseCodesForPlan
>[0];

export function isTransferEquivalencyCollegeId(
  value: string
): value is TransferEquivalencyCatalogCollegeId {
  return value === "uw" || value === "grc";
}

export function normalizeTransferEquivalencyCollegeId(
  value: string | string[] | undefined
): TransferEquivalencyCatalogCollegeId {
  const rawCollege = Array.isArray(value) ? value[0] : value;
  const normalized = String(rawCollege ?? DEFAULT_TRANSFER_EQUIVALENCY_COLLEGE_ID)
    .trim()
    .toLowerCase();

  return isTransferEquivalencyCollegeId(normalized)
    ? normalized
    : DEFAULT_TRANSFER_EQUIVALENCY_COLLEGE_ID;
}

export function getTransferEquivalencyCollegeLabel(
  collegeId: TransferEquivalencyCatalogCollegeId
) {
  return collegeId === "grc" ? "Green River College" : "University of Washington";
}

export function isTransferEquivalencyCampusId(
  value: string,
  campuses: TransferEquivalencyCatalogCampus[]
): value is TransferPlannerCampusId {
  return campuses.some((campus) => campus.id === value);
}

export function normalizeTransferEquivalencyCampusId(
  value: string | string[] | undefined,
  campuses: TransferEquivalencyCatalogCampus[]
): TransferPlannerCampusId {
  const rawCampus = Array.isArray(value) ? value[0] : value;
  const normalized = String(rawCampus ?? DEFAULT_TRANSFER_EQUIVALENCY_CAMPUS_ID)
    .trim()
    .toLowerCase();

  return isTransferEquivalencyCampusId(normalized, campuses)
    ? normalized
    : DEFAULT_TRANSFER_EQUIVALENCY_CAMPUS_ID;
}

export function normalizeSingleSearchParam(value: string | string[] | undefined) {
  return String(Array.isArray(value) ? value[0] ?? "" : value ?? "").trim();
}

export function normalizeTransferEquivalencyCatalogFilterId(
  value: string | null | undefined
): TransferEquivalencyCatalogFilterId | null {
  const ceApprovedFilterId = normalizeComputerEngineeringNaturalScienceFilterId(value);
  if (ceApprovedFilterId) {
    return ceApprovedFilterId;
  }

  const normalizedTag = normalizeTransferEquivalencyTag(value);
  return isTransferEquivalencyTrackedTag(normalizedTag) ? normalizedTag : null;
}

export function isTransferEquivalencySpecialFilterId(
  value: string
): value is TransferEquivalencySpecialFilterId {
  return value === COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID;
}

export function hasTranscriptCourseRecords(value: unknown) {
  return (
    Array.isArray(value) &&
    value.some(
      (entry) => !!entry && typeof entry === "object" && !Array.isArray(entry)
    )
  );
}

export function normalizeStoredTranscriptParserVersion(value: unknown) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getEligibleTransferHeading(tag: string, isGreenRiverCollegeMode = false) {
  if (isTransferEquivalencySpecialFilterId(tag)) {
    return COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_HEADING;
  }

  const shortLabel = getTransferEquivalencyTagLabel(tag);
  const longLabel = getTransferEquivalencyTagLongLabel(tag);
  if (isGreenRiverCollegeMode) {
    return !longLabel || longLabel === shortLabel
      ? `${shortLabel} Green River courses`
      : `${shortLabel} Green River courses (${longLabel})`;
  }
  if (!longLabel || longLabel === shortLabel) {
    return `${shortLabel} eligible transfers`;
  }
  return `${shortLabel} eligible transfers (${longLabel})`;
}

export function normalizeEquivalencySearchValue(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getCatalogEntryCurrentSourceCourseCodes(
  entry: TransferEquivalencyCatalogDisplayEntry
) {
  const currentSourceCourseLabel = entry.sourceCourseLabel.split(
    /\b(?:formerly|see(?:\s+also)?|same as|combined entr(?:y|ies))\b/i
  )[0];
  const currentSourceCourseCodes = extractCourseCodes(currentSourceCourseLabel);
  return currentSourceCourseCodes.length
    ? currentSourceCourseCodes
    : extractCourseCodes(entry.sourceCourseLabel);
}

export function doesCatalogEntryMatchEligibleSourceCourseCodes(
  entry: TransferEquivalencyCatalogDisplayEntry,
  eligibleSourceCourseCodes: Set<string> | undefined
) {
  if (!eligibleSourceCourseCodes) {
    return true;
  }

  const currentSourceCourseCodes = getCatalogEntryCurrentSourceCourseCodes(entry);
  if (currentSourceCourseCodes.length) {
    return currentSourceCourseCodes.every((courseCode) =>
      eligibleSourceCourseCodes.has(courseCode)
    );
  }

  return extractCourseCodes(entry.sourceCourseLabel).some((courseCode) =>
    eligibleSourceCourseCodes.has(courseCode)
  );
}

function getAcademicYearStart(value: string | null | undefined) {
  const match = String(value ?? "").match(/^(20\d{2})-/);
  return match ? Number.parseInt(match[1], 10) : Number.NaN;
}

export function getLatestGrcGeneralEducationCatalogYearLabel() {
  const catalogYearLabels = new Set<string>();
  for (const entry of getTransferPlannerNormalizedCourseMetadataEntries()) {
    if (entry.schoolId !== "grc") continue;
    for (const category of entry.grcGeneralEducationCategories ?? []) {
      if (category.catalogYearLabel) {
        catalogYearLabels.add(category.catalogYearLabel);
      }
    }
  }

  return (
    [...catalogYearLabels].sort((left, right) => {
      const yearDelta = getAcademicYearStart(right) - getAcademicYearStart(left);
      return Number.isFinite(yearDelta) && yearDelta !== 0
        ? yearDelta
        : right.localeCompare(left);
    })[0] ?? null
  );
}

export function slugifyTransferEquivalencyCatalogIdPart(value: string) {
  return normalizeEquivalencySearchValue(value).replace(/\s+/g, "-") || "entry";
}

export function buildEligibleCourseCodesByTag(selectedMajorPlan: MajorPlanForEligibleCodes | null) {
  const entries: Partial<Record<TransferEquivalencyTrackedTag, Set<string>>> = {};
  if (!selectedMajorPlan) return entries;

  for (const tag of TRANSFER_EQUIVALENCY_TRACKED_TAGS) {
    const eligibleCourseCodes = buildEligibleTransferCategorySourceCourseCodesForPlan(
      selectedMajorPlan,
      tag
    );
    if (eligibleCourseCodes?.length) {
      entries[tag] = new Set(eligibleCourseCodes);
    }
  }

  return entries;
}

export function buildGrcGeneralEducationCatalogRules(
  latestCatalogYearLabel: string | null
) {
  if (!latestCatalogYearLabel) {
    return [] as TransferEquivalencyCatalogDisplayEntry[];
  }

  return getTransferPlannerNormalizedCourseMetadataEntries()
    .filter((entry) => entry.schoolId === "grc")
    .flatMap((entry) => {
      const currentCategories = (entry.grcGeneralEducationCategories ?? []).filter(
        (category) =>
          category.catalogYearLabel === latestCatalogYearLabel &&
          category.tags.some((tag) => isTransferEquivalencyTrackedTag(tag))
      );

      return currentCategories.map(
        (category) =>
          ({
            id: `grc-gen-ed:${slugifyTransferEquivalencyCatalogIdPart(
              entry.code
            )}:${slugifyTransferEquivalencyCatalogIdPart(category.label)}`,
            targetSchoolIds: [DEFAULT_TRANSFER_EQUIVALENCY_CAMPUS_ID],
            sourceCourseLabel: entry.creditLabel
              ? `${entry.code} (${entry.creditLabel})`
              : entry.code,
            sourceCourseTitle: entry.title ?? null,
            targetOutcome: category.label,
            tags: category.tags.filter((tag) =>
              isTransferEquivalencyTrackedTag(tag)
            ),
          }) satisfies TransferEquivalencyCatalogDisplayEntry
      );
    })
    .sort((left, right) =>
      left.sourceCourseLabel.localeCompare(right.sourceCourseLabel)
    );
}

export function buildSourceCourseCodesByTag({
  catalogRules,
  eligibleCourseCodesByTag,
  selectedCampusId,
}: {
  catalogRules: TransferEquivalencyCatalogDisplayEntry[];
  eligibleCourseCodesByTag: Partial<Record<TransferEquivalencyTrackedTag, Set<string>>>;
  selectedCampusId: TransferPlannerCampusId;
}) {
  const entries: Partial<Record<TransferEquivalencyTrackedTag, Set<string>>> = {};

  for (const rule of catalogRules) {
    if (!rule.targetSchoolIds.includes(selectedCampusId)) continue;

    for (const rawTag of rule.tags) {
      const tag = normalizeTransferEquivalencyTag(rawTag);
      if (!isTransferEquivalencyTrackedTag(tag)) {
        continue;
      }
      if (
        !doesCatalogEntryMatchEligibleSourceCourseCodes(
          rule,
          eligibleCourseCodesByTag[tag]
        )
      ) {
        continue;
      }

      const currentSourceCourseCodes = getCatalogEntryCurrentSourceCourseCodes(rule);
      if (!currentSourceCourseCodes.length) {
        continue;
      }

      const existing = entries[tag] ?? new Set<string>();
      for (const courseCode of currentSourceCourseCodes) {
        existing.add(courseCode);
      }
      entries[tag] = existing;
    }
  }

  return entries;
}

export function buildTranscriptReadyCourseCodesByTag({
  completedCourseCodes,
  hasUnofficialTranscript,
  sourceCourseCodesByTag,
}: {
  completedCourseCodes: string[];
  hasUnofficialTranscript: boolean;
  sourceCourseCodesByTag: Partial<Record<TransferEquivalencyTrackedTag, Set<string>>>;
}) {
  const entries: Partial<Record<TransferEquivalencyTrackedTag, Set<string>>> = {};
  if (!hasUnofficialTranscript) {
    return entries;
  }

  for (const tag of TRANSFER_EQUIVALENCY_TRACKED_TAGS) {
    const candidateCourseCodes = sourceCourseCodesByTag[tag];
    if (!candidateCourseCodes?.size) {
      continue;
    }

    entries[tag] = new Set(
      buildTransferPlannerGrcTranscriptReadyCourseCodes({
        candidateCourseCodes,
        completedCourseCodes,
      })
    );
  }

  return entries;
}

export function buildCeApprovedNaturalScienceRows({
  completedCourseCodes,
  hasUnofficialTranscript,
  isGreenRiverCollegeMode,
  selectedCampusId,
}: {
  completedCourseCodes: string[];
  hasUnofficialTranscript: boolean;
  isGreenRiverCollegeMode: boolean;
  selectedCampusId: TransferPlannerCampusId;
}) {
  if (isGreenRiverCollegeMode || selectedCampusId !== "uw-seattle") {
    return [] as TransferEquivalencyCatalogDisplayEntry[];
  }

  const rows = getComputerEngineeringApprovedNaturalScienceTransferEntries().map(
    (entry) =>
      ({
        id: entry.id,
        targetSchoolIds: ["uw-seattle"],
        sourceCourseLabel: entry.sourceCourseCodes.join(" + "),
        sourceCourseTitle: entry.sourceCourseTitle,
        targetOutcome: entry.targetOutcome || entry.uwEquivalentCourseCodes.join(", "),
        tags: ["NSC", COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID],
        ceApprovedReason: entry.inclusionReason,
      }) satisfies TransferEquivalencyCatalogDisplayEntry
  );

  if (!hasUnofficialTranscript) {
    return rows;
  }

  const candidateCourseCodes = new Set(
    rows.flatMap((row) => getCatalogEntryCurrentSourceCourseCodes(row))
  );
  const readyCourseCodes = new Set(
    buildTransferPlannerGrcTranscriptReadyCourseCodes({
      candidateCourseCodes,
      completedCourseCodes,
    })
  );

  return rows.filter((row) =>
    isTransferPlannerGrcCourseSetTranscriptReady({
      sourceCourseCodes: getCatalogEntryCurrentSourceCourseCodes(row),
      completedCourseCodes,
      readyCourseCodes,
    })
  );
}

export function buildEquivalenciesByTag({
  catalogRules,
  ceApprovedNaturalScienceRows,
  completedCourseCodes,
  eligibleCourseCodesByTag,
  hasUnofficialTranscript,
  selectedCampusId,
  transcriptReadyCourseCodesByTag,
}: {
  catalogRules: TransferEquivalencyCatalogDisplayEntry[];
  ceApprovedNaturalScienceRows: TransferEquivalencyCatalogDisplayEntry[];
  completedCourseCodes: string[];
  eligibleCourseCodesByTag: Partial<Record<TransferEquivalencyTrackedTag, Set<string>>>;
  hasUnofficialTranscript: boolean;
  selectedCampusId: TransferPlannerCampusId;
  transcriptReadyCourseCodesByTag: Partial<Record<TransferEquivalencyTrackedTag, Set<string>>>;
}) {
  const grouped = new Map<string, TransferEquivalencyCatalogDisplayEntry[]>();

  for (const rule of catalogRules) {
    if (!rule.targetSchoolIds.includes(selectedCampusId)) continue;

    for (const rawTag of rule.tags) {
      const tag = normalizeTransferEquivalencyTag(rawTag);
      if (!isTransferEquivalencyTrackedTag(tag)) {
        continue;
      }
      if (
        !doesCatalogEntryMatchEligibleSourceCourseCodes(
          rule,
          eligibleCourseCodesByTag[tag]
        )
      ) {
        continue;
      }

      if (
        hasUnofficialTranscript &&
        !isTransferPlannerGrcCourseSetTranscriptReady({
          sourceCourseCodes: getCatalogEntryCurrentSourceCourseCodes(rule),
          completedCourseCodes,
          readyCourseCodes: transcriptReadyCourseCodesByTag[tag],
        })
      ) {
        continue;
      }

      const existing = grouped.get(tag) ?? [];
      existing.push(rule);
      grouped.set(tag, existing);
    }
  }

  if (ceApprovedNaturalScienceRows.length) {
    grouped.set(
      COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID,
      ceApprovedNaturalScienceRows
    );
  }

  for (const [tag, entries] of grouped.entries()) {
    grouped.set(
      tag,
      [...entries].sort((left, right) =>
        left.sourceCourseLabel.localeCompare(right.sourceCourseLabel)
      )
    );
  }

  return grouped;
}

export function resolveVisibleTransferEquivalencyTags({
  ceApprovedNaturalScienceRowCount,
  equivalenciesByTag,
  selectedTags,
}: {
  ceApprovedNaturalScienceRowCount: number;
  equivalenciesByTag: Map<string, TransferEquivalencyCatalogDisplayEntry[]>;
  selectedTags: TransferEquivalencyCatalogFilterId[];
}): TransferEquivalencyCatalogFilterId[] {
  if (selectedTags.length) return selectedTags;
  const trackedTags = TRANSFER_EQUIVALENCY_TRACKED_TAGS.filter(
    (tag) => (equivalenciesByTag.get(tag)?.length ?? 0) > 0
  ) as TransferEquivalencyCatalogFilterId[];
  return ceApprovedNaturalScienceRowCount
    ? [...trackedTags, COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID]
    : trackedTags;
}

export function filterEquivalenciesBySearch({
  equivalenciesByTag,
  isGreenRiverCollegeMode,
  normalizedSearchQuery,
  visibleTags,
}: {
  equivalenciesByTag: Map<string, TransferEquivalencyCatalogDisplayEntry[]>;
  isGreenRiverCollegeMode: boolean;
  normalizedSearchQuery: string;
  visibleTags: TransferEquivalencyCatalogFilterId[];
}) {
  if (!normalizedSearchQuery) {
    return equivalenciesByTag;
  }

  const filtered = new Map<string, TransferEquivalencyCatalogDisplayEntry[]>();

  for (const tag of visibleTags) {
    const rows = equivalenciesByTag.get(tag) ?? [];
    const tagSearchText = normalizeEquivalencySearchValue(
      [
        tag,
        getEligibleTransferHeading(tag, isGreenRiverCollegeMode),
        isTransferEquivalencySpecialFilterId(tag)
          ? COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_LABEL
          : "",
        getTransferEquivalencyTagLabel(tag),
        getTransferEquivalencyTagLongLabel(tag),
      ]
        .filter(Boolean)
        .join(" ")
    );

    if (tagSearchText.includes(normalizedSearchQuery)) {
      filtered.set(tag, rows);
      continue;
    }

    const matchingRows = rows.filter((row) =>
      normalizeEquivalencySearchValue(
        [
          row.sourceCourseLabel,
          row.sourceCourseTitle ?? "",
          row.targetOutcome,
          ...row.tags,
          row.ceApprovedReason ?? "",
        ].join(" ")
      ).includes(normalizedSearchQuery)
    );

    if (matchingRows.length) {
      filtered.set(tag, matchingRows);
    }
  }

  return filtered;
}

export function buildHighlightedCategoryLabels(isGreenRiverCollegeMode: boolean) {
  return (isGreenRiverCollegeMode
    ? ["COMM", "QSR", "AH", "SSC", "NSC", "DIV"]
    : ["AH", "SSC", "NSC"])
    .map((tag) => getTransferEquivalencyTagDisplayLabel(tag))
    .concat(
      isGreenRiverCollegeMode
        ? []
        : [COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_LABEL]
    )
    .join(", ");
}
