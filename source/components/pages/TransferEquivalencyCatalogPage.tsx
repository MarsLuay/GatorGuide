import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { AnimatedIconPressable } from "@/components/ui/AnimatedPressables";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/SearchableSelect";
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
import {
  TRANSFER_EQUIVALENCY_CATALOG_CAMPUSES,
  TRANSFER_EQUIVALENCY_CATALOG_ENTRIES,
  type TransferEquivalencyCatalogCampus,
  type TransferEquivalencyCatalogEntry,
} from "@/constants/transfer-equivalency-catalog.generated";
import {
  getTransferPlannerStudentRuntimeMajorsForCampus,
  resolveTransferPlannerStudentRuntimeMajorPlan,
} from "@/constants/transfer-planner-source/student-runtime";
import type { TransferPlannerCampusId } from "@/constants/transfer-planner-types";
import { ROUTES } from "@/constants/routes";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppData } from "@/hooks/use-app-data";
import useBack from "@/hooks/use-back";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import {
  TRANSCRIPT_COURSES_FIELD,
  TRANSCRIPT_PARSER_VERSION,
  TRANSCRIPT_PARSER_VERSION_FIELD,
  TRANSCRIPT_SOURCE_FIELD,
} from "@/services/planning/transfer-planner-cache.service";
import {
  buildEligibleTransferCategorySourceCourseCodesForPlan,
  getComputerEngineeringApprovedNaturalScienceTransferEntries,
  buildTransferPlannerGrcTranscriptReadyCourseCodes,
  extractCourseCodes,
  isTransferPlannerGrcCourseSetTranscriptReady,
  parseCompletedTranscriptCourses,
} from "@/services/planning/transfer-planner.service";

const DEFAULT_TRANSFER_EQUIVALENCY_CAMPUS_ID: TransferPlannerCampusId = "uw-seattle";
type TransferEquivalencyCatalogCollegeId = "uw" | "grc";
type TransferEquivalencySpecialFilterId =
  typeof COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID;
type TransferEquivalencyCatalogFilterId =
  | TransferEquivalencyTrackedTag
  | TransferEquivalencySpecialFilterId;
type TransferEquivalencyCatalogDisplayEntry = Omit<
  TransferEquivalencyCatalogEntry,
  "tags"
> & {
  tags: string[];
  ceApprovedReason?: "approved-uw-equivalent" | "compound-path" | null;
};

const DEFAULT_TRANSFER_EQUIVALENCY_COLLEGE_ID: TransferEquivalencyCatalogCollegeId =
  "uw";

function isTransferEquivalencyCollegeId(
  value: string
): value is TransferEquivalencyCatalogCollegeId {
  return value === "uw" || value === "grc";
}

function normalizeTransferEquivalencyCollegeId(
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

function getTransferEquivalencyCollegeLabel(
  collegeId: TransferEquivalencyCatalogCollegeId
) {
  return collegeId === "grc" ? "Green River College" : "University of Washington";
}

function isTransferEquivalencyCampusId(
  value: string,
  campuses: TransferEquivalencyCatalogCampus[]
): value is TransferPlannerCampusId {
  return campuses.some((campus) => campus.id === value);
}

function normalizeTransferEquivalencyCampusId(
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

function normalizeSingleSearchParam(value: string | string[] | undefined) {
  return String(Array.isArray(value) ? value[0] ?? "" : value ?? "").trim();
}

function normalizeTransferEquivalencyCatalogFilterId(
  value: string | null | undefined
): TransferEquivalencyCatalogFilterId | null {
  const ceApprovedFilterId = normalizeComputerEngineeringNaturalScienceFilterId(value);
  if (ceApprovedFilterId) {
    return ceApprovedFilterId;
  }

  const normalizedTag = normalizeTransferEquivalencyTag(value);
  return isTransferEquivalencyTrackedTag(normalizedTag) ? normalizedTag : null;
}

function isTransferEquivalencySpecialFilterId(
  value: string
): value is TransferEquivalencySpecialFilterId {
  return value === COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID;
}

function hasTranscriptCourseRecords(value: unknown) {
  return (
    Array.isArray(value) &&
    value.some(
      (entry) => !!entry && typeof entry === "object" && !Array.isArray(entry)
    )
  );
}

function normalizeStoredTranscriptParserVersion(value: unknown) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getEligibleTransferHeading(tag: string) {
  if (isTransferEquivalencySpecialFilterId(tag)) {
    return COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_HEADING;
  }

  const shortLabel = getTransferEquivalencyTagLabel(tag);
  const longLabel = getTransferEquivalencyTagLongLabel(tag);
  if (!longLabel || longLabel === shortLabel) {
    return `${shortLabel} eligible transfers`;
  }
  return `${shortLabel} eligible transfers (${longLabel})`;
}

function normalizeEquivalencySearchValue(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCatalogEntryCurrentSourceCourseCodes(
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

function doesCatalogEntryMatchEligibleSourceCourseCodes(
  entry: TransferEquivalencyCatalogDisplayEntry,
  eligibleSourceCourseCodes: Set<string> | undefined
) {
  if (!eligibleSourceCourseCodes) {
    return true;
  }

  const currentSourceCourseLabel = entry.sourceCourseLabel.split(
    /\b(?:formerly|see(?:\s+also)?|same as|combined entr(?:y|ies))\b/i
  )[0];
  const currentSourceCourseCodes = extractCourseCodes(currentSourceCourseLabel);
  if (currentSourceCourseCodes.length) {
    return currentSourceCourseCodes.every((courseCode) =>
      eligibleSourceCourseCodes.has(courseCode)
    );
  }

  return extractCourseCodes(entry.sourceCourseLabel).some((courseCode) =>
    eligibleSourceCourseCodes.has(courseCode)
  );
}

export default function TransferEquivalencyCatalogPage() {
  const goBack = useBack(ROUTES.transferPlanner);
  const router = useRouter();
  const params = useLocalSearchParams<{
    tag?: string | string[];
    filter?: string | string[];
    campusId?: string | string[];
    collegeId?: string | string[];
    majorId?: string | string[];
    pathwayId?: string | string[];
    returnTo?: string | string[];
  }>();
  const styles = useThemeStyles();
  const { t } = useAppLanguage();
  const { state } = useAppData();
  const {
    textClass,
    secondaryTextClass,
    cardBgClass,
    borderClass,
    dropdownSurfaceColor,
  } = styles;
  const [tagOpenState, setTagOpenState] = useState<Record<string, boolean>>({});
  const [isCollegeSelectorOpen, setIsCollegeSelectorOpen] = useState(false);
  const [isCampusSelectorOpen, setIsCampusSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const campuses = TRANSFER_EQUIVALENCY_CATALOG_CAMPUSES;
  const equivalencyRules =
    TRANSFER_EQUIVALENCY_CATALOG_ENTRIES as TransferEquivalencyCatalogDisplayEntry[];

  const backLabel = useMemo(() => {
    const translated = t("general.back");
    return translated && translated !== "general.back" ? translated : "Back";
  }, [t]);

  const selectedTags = useMemo(() => {
    const rawTags = [
      ...(Array.isArray(params.tag) ? params.tag : [params.tag]),
      ...(Array.isArray(params.filter) ? params.filter : [params.filter]),
    ];

    return Array.from(
      new Set(
        rawTags
          .flatMap((value) => String(value ?? "").split(","))
          .map((value) => normalizeTransferEquivalencyCatalogFilterId(value))
          .filter((value): value is TransferEquivalencyCatalogFilterId =>
            Boolean(value)
          )
      )
    );
  }, [params.filter, params.tag]);

  const selectedCollegeId = useMemo(() => {
    return normalizeTransferEquivalencyCollegeId(params.collegeId);
  }, [params.collegeId]);
  const returnToParam = useMemo(() => {
    const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
    const normalized = String(rawReturnTo ?? "").trim();
    return normalized.startsWith("/") ? normalized : "";
  }, [params.returnTo]);

  const collegeOptions = useMemo<SearchableSelectOption[]>(
    () => [
      {
        id: "uw",
        label: "University of Washington",
        description: "Browse UW transfer outcomes for Green River courses.",
      },
      {
        id: "grc",
        label: "Green River College",
        description: "Browse Green River courses that satisfy transfer categories.",
      },
    ],
    []
  );

  const selectedCollegeLabel =
    collegeOptions.find((option) => option.id === selectedCollegeId)?.label ??
    getTransferEquivalencyCollegeLabel(selectedCollegeId);

  const selectedCampusId = useMemo(() => {
    return normalizeTransferEquivalencyCampusId(params.campusId, campuses);
  }, [campuses, params.campusId]);

  const campusOptions = useMemo<SearchableSelectOption[]>(
    () =>
      campuses.map((campus) => ({
        id: campus.id,
        label: campus.title,
        description: campus.summary ?? undefined,
      })),
    [campuses]
  );

  const selectedCampus =
    campuses.find((campus) => campus.id === selectedCampusId) ?? null;
  const selectedCampusLabel = selectedCampus?.title ?? "UW Seattle";
  const selectedMajorId = useMemo(
    () => normalizeSingleSearchParam(params.majorId),
    [params.majorId]
  );
  const selectedPathwayId = useMemo(
    () => normalizeSingleSearchParam(params.pathwayId),
    [params.pathwayId]
  );
  const selectedMajorPlan = useMemo(() => {
    if (selectedCollegeId !== "uw") return null;
    if (!selectedMajorId) return null;

    const basePlan =
      getTransferPlannerStudentRuntimeMajorsForCampus(selectedCampusId).find(
        (entry) => entry.id === selectedMajorId
      ) ?? null;
    if (!basePlan) return null;

    return resolveTransferPlannerStudentRuntimeMajorPlan(
      basePlan,
      selectedPathwayId || null
    );
  }, [selectedCampusId, selectedCollegeId, selectedMajorId, selectedPathwayId]);
  const eligibleCourseCodesByTag = useMemo(() => {
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
  }, [selectedMajorPlan]);
  const storedDetailedTranscriptCourses =
    state.questionnaireAnswers?.[TRANSCRIPT_COURSES_FIELD];
  const hasDetailedTranscriptCourses = hasTranscriptCourseRecords(
    storedDetailedTranscriptCourses
  );
  const storedTranscriptParserVersion = normalizeStoredTranscriptParserVersion(
    state.questionnaireAnswers?.[TRANSCRIPT_PARSER_VERSION_FIELD]
  );
  const shouldUseDetailedCompletedCourses =
    hasDetailedTranscriptCourses &&
    storedTranscriptParserVersion === TRANSCRIPT_PARSER_VERSION;
  const hasUnofficialTranscript = useMemo(
    () =>
      Boolean(
        String(state.user?.transcript ?? "").trim() ||
          String(state.questionnaireAnswers?.[TRANSCRIPT_SOURCE_FIELD] ?? "").trim()
      ),
    [state.questionnaireAnswers, state.user?.transcript]
  );
  const transcriptCompletedCourseCodes = useMemo(() => {
    if (!hasUnofficialTranscript) {
      return [] as string[];
    }

    const rawCompletedCourses = shouldUseDetailedCompletedCourses
      ? storedDetailedTranscriptCourses
      : state.questionnaireAnswers?.completedCourses;

    return parseCompletedTranscriptCourses(rawCompletedCourses)
      .map((course) => course.code)
      .filter(Boolean);
  }, [
    hasUnofficialTranscript,
    shouldUseDetailedCompletedCourses,
    state.questionnaireAnswers,
    storedDetailedTranscriptCourses,
  ]);
  const sourceCourseCodesByTag = useMemo(() => {
    const entries: Partial<Record<TransferEquivalencyTrackedTag, Set<string>>> = {};

    for (const rule of equivalencyRules) {
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
  }, [eligibleCourseCodesByTag, equivalencyRules, selectedCampusId]);
  const transcriptReadyCourseCodesByTag = useMemo(() => {
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
          completedCourseCodes: transcriptCompletedCourseCodes,
        })
      );
    }

    return entries;
  }, [
    hasUnofficialTranscript,
    sourceCourseCodesByTag,
    transcriptCompletedCourseCodes,
  ]);
  const ceApprovedNaturalScienceRows = useMemo(() => {
    if (selectedCampusId !== "uw-seattle") {
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
        completedCourseCodes: transcriptCompletedCourseCodes,
      })
    );

    return rows.filter((row) =>
      isTransferPlannerGrcCourseSetTranscriptReady({
        sourceCourseCodes: getCatalogEntryCurrentSourceCourseCodes(row),
        completedCourseCodes: transcriptCompletedCourseCodes,
        readyCourseCodes,
      })
    );
  }, [hasUnofficialTranscript, selectedCampusId, transcriptCompletedCourseCodes]);

  const handleCollegeSelect = (nextCollegeId: string) => {
    setIsCollegeSelectorOpen(false);
    const normalizedCollegeId = isTransferEquivalencyCollegeId(nextCollegeId)
      ? nextCollegeId
      : DEFAULT_TRANSFER_EQUIVALENCY_COLLEGE_ID;
    if (normalizedCollegeId === selectedCollegeId) {
      return;
    }

    setTagOpenState({});
    router.replace({
      pathname: ROUTES.transferEquivalencies,
      params: {
        collegeId: normalizedCollegeId,
        campusId: selectedCampusId,
        ...(selectedTags.length ? { tag: selectedTags.join(",") } : {}),
        ...(normalizedCollegeId === "uw" && selectedMajorId
          ? { majorId: selectedMajorId }
          : {}),
        ...(normalizedCollegeId === "uw" && selectedPathwayId
          ? { pathwayId: selectedPathwayId }
          : {}),
        ...(returnToParam ? { returnTo: returnToParam } : {}),
      },
    });
  };

  const handleCampusSelect = (nextCampusId: string) => {
    setIsCampusSelectorOpen(false);
    if (!isTransferEquivalencyCampusId(nextCampusId, campuses) || nextCampusId === selectedCampusId) {
      return;
    }

    setTagOpenState({});
    router.replace({
      pathname: ROUTES.transferEquivalencies,
      params: {
        collegeId: selectedCollegeId,
        campusId: nextCampusId,
        ...(selectedTags.length ? { tag: selectedTags.join(",") } : {}),
        ...(selectedCollegeId === "uw" && selectedMajorId
          ? { majorId: selectedMajorId }
          : {}),
        ...(selectedCollegeId === "uw" && selectedPathwayId
          ? { pathwayId: selectedPathwayId }
          : {}),
        ...(returnToParam ? { returnTo: returnToParam } : {}),
      },
    });
  };

  const equivalenciesByTag = useMemo(() => {
    const grouped = new Map<string, TransferEquivalencyCatalogDisplayEntry[]>();

    for (const rule of equivalencyRules) {
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
            completedCourseCodes: transcriptCompletedCourseCodes,
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
        [...entries].sort((left, right) => left.sourceCourseLabel.localeCompare(right.sourceCourseLabel))
      );
    }

    return grouped;
  }, [
    ceApprovedNaturalScienceRows,
    eligibleCourseCodesByTag,
    equivalencyRules,
    hasUnofficialTranscript,
    selectedCampusId,
    transcriptCompletedCourseCodes,
    transcriptReadyCourseCodesByTag,
  ]);

  const visibleTags = useMemo(() => {
    if (selectedTags.length) return selectedTags;
    const trackedTags = TRANSFER_EQUIVALENCY_TRACKED_TAGS.filter(
      (tag) => (equivalenciesByTag.get(tag)?.length ?? 0) > 0
    ) as TransferEquivalencyCatalogFilterId[];
    return ceApprovedNaturalScienceRows.length
      ? [...trackedTags, COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID]
      : trackedTags;
  }, [ceApprovedNaturalScienceRows.length, equivalenciesByTag, selectedTags]);
  const normalizedSearchQuery = normalizeEquivalencySearchValue(searchQuery);
  const isSearching = normalizedSearchQuery.length > 0;
  const filteredEquivalenciesByTag = useMemo(() => {
    if (!normalizedSearchQuery) {
      return equivalenciesByTag;
    }

    const filtered = new Map<string, TransferEquivalencyCatalogDisplayEntry[]>();

    for (const tag of visibleTags) {
      const rows = equivalenciesByTag.get(tag) ?? [];
      const tagSearchText = normalizeEquivalencySearchValue(
        [
          tag,
          getEligibleTransferHeading(tag),
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
  }, [equivalenciesByTag, normalizedSearchQuery, visibleTags]);
  const displayedTags = useMemo(
    () =>
      visibleTags.filter(
        (tag) => (filteredEquivalenciesByTag.get(tag)?.length ?? 0) > 0
      ),
    [filteredEquivalenciesByTag, visibleTags]
  );

  const campusLabel = selectedCampusLabel;
  const highlightedCategoryLabels = useMemo(
    () =>
      ["AH", "SSC", "NSC"]
        .map((tag) => getTransferEquivalencyTagDisplayLabel(tag))
        .concat(COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_LABEL)
        .join(", "),
    []
  );
  const pageDescription =
    selectedCollegeId === "grc"
      ? `Green River College courses with source-backed ${campusLabel} transfer category tags for ${highlightedCategoryLabels}, and related requirement categories.`
      : `Eligible Green River to ${campusLabel} transfer options for ${highlightedCategoryLabels}, and related requirement categories.`;
  const campusHelperText =
    selectedCollegeId === "grc"
      ? "Choose the UW transfer destination used to verify these Green River category tags."
      : "Choose which UW campus to browse source-backed transfer category equivalencies for.";
  const searchHelperText =
    selectedCollegeId === "grc"
      ? "Search by Green River course, title, UW transfer outcome, or category."
      : "Search by Green River course, UW outcome, title, or category.";

  return (
    <ScreenBackground includeTopInset includeBottomInset={false}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => {
          setIsCollegeSelectorOpen(false);
          setIsCampusSelectorOpen(false);
        }}
      >
        <AnimatedIconPressable
          onPress={goBack}
          className="flex-row items-center"
          containerStyle={{ alignSelf: "flex-start" }}
        >
          <MaterialIcons name="arrow-back" size={20} color="#1f8a5d" />
          <Text className={`${secondaryTextClass} ml-2`}>{backLabel}</Text>
        </AnimatedIconPressable>

        <View className="mt-4">
          <Text className={`${textClass} text-2xl font-semibold`}>Transfer Category Equivalencies</Text>
          <Text className={`${secondaryTextClass} text-sm mt-2`}>
            {pageDescription}
          </Text>
        </View>

        <View className={`${cardBgClass} border ${borderClass} rounded-2xl px-4 py-4 mt-5 gap-4`}>
          <View>
            <Text className={`${textClass} font-semibold`}>College</Text>
            <Text className={`${secondaryTextClass} text-xs mt-1`}>
              Choose whether to browse UW transfer outcomes or Green River source courses.
            </Text>
            <View className="mt-3">
              <SearchableSelect
                value={selectedCollegeLabel}
                open={isCollegeSelectorOpen}
                onToggle={() => {
                  setIsCampusSelectorOpen(false);
                  setIsCollegeSelectorOpen((current) => !current);
                }}
                onDismiss={() => {
                  setIsCollegeSelectorOpen(false);
                }}
                options={collegeOptions}
                onSelect={handleCollegeSelect}
                selectedOptionId={selectedCollegeId}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                borderClass={borderClass}
                dropdownBackgroundColor={dropdownSurfaceColor}
                overlayStrategy="modal"
              />
            </View>
          </View>

          <View className={`border-t ${borderClass} pt-4`}>
            <Text className={`${textClass} font-semibold`}>Campus</Text>
            <Text className={`${secondaryTextClass} text-xs mt-1`}>
              {campusHelperText}
            </Text>
            <View className="mt-3">
              <SearchableSelect
                value={selectedCampusLabel}
                open={isCampusSelectorOpen}
                onToggle={() => {
                  setIsCollegeSelectorOpen(false);
                  setIsCampusSelectorOpen((current) => !current);
                }}
                onDismiss={() => {
                  setIsCampusSelectorOpen(false);
                }}
                options={campusOptions}
                onSelect={handleCampusSelect}
                selectedOptionId={selectedCampusId}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                borderClass={borderClass}
                dropdownBackgroundColor={dropdownSurfaceColor}
                overlayStrategy="modal"
              />
            </View>
          </View>
        </View>

        <View className={`${cardBgClass} border ${borderClass} rounded-2xl px-4 py-4 mt-5`}>
          <Text className={`${textClass} font-semibold`}>Search equivalencies</Text>
          <Text className={`${secondaryTextClass} text-xs mt-1`}>
            {searchHelperText}
          </Text>
          <View className={`mt-3 border ${borderClass} rounded-2xl px-4 py-3 flex-row items-center`}>
            <MaterialIcons name="search" size={20} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => {
                setIsCollegeSelectorOpen(false);
                setIsCampusSelectorOpen(false);
              }}
              placeholder="Search courses or categories"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              className={`${textClass} text-sm flex-1 min-w-0 ml-3`}
            />
            {searchQuery ? (
              <AnimatedIconPressable
                onPress={() => setSearchQuery("")}
                className="ml-2"
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear equivalency search"
              >
                <MaterialIcons name="close" size={18} color="#9CA3AF" />
              </AnimatedIconPressable>
            ) : null}
          </View>
        </View>

        {!visibleTags.length ? (
          <View className={`${cardBgClass} border ${borderClass} rounded-2xl px-4 py-4 mt-5`}>
            <Text className={`${textClass} font-semibold`}>No tagged equivalencies found</Text>
            <Text className={`${secondaryTextClass} text-sm mt-2`}>
              This campus currently has no source-backed category-tagged transfer rows for the selected filter.
            </Text>
          </View>
        ) : !displayedTags.length ? (
          <View className={`${cardBgClass} border ${borderClass} rounded-2xl px-4 py-4 mt-5`}>
            <Text className={`${textClass} font-semibold`}>No matching equivalencies</Text>
            <Text className={`${secondaryTextClass} text-sm mt-2`}>
              Try a different course code, title, UW outcome, or category.
            </Text>
          </View>
        ) : (
          <View className="mt-5 gap-4">
            {displayedTags.map((tag) => {
              const rows = filteredEquivalenciesByTag.get(tag) ?? [];
              const sourceRowCount = equivalenciesByTag.get(tag)?.length ?? rows.length;
              const isOpen =
                isSearching || (tagOpenState[tag] ?? (selectedTags.length > 0));
              return (
                <View key={tag} className={`${cardBgClass} border ${borderClass} rounded-2xl px-4 py-4`}>
                  <AnimatedIconPressable
                    onPress={() =>
                      setTagOpenState((current) => ({
                        ...current,
                        [tag]: !(current[tag] ?? (selectedTags.length > 0)),
                      }))
                    }
                    className="flex-row items-start justify-between"
                  >
                    <View className="flex-1 min-w-0">
                      <Text className={`${textClass} font-semibold`}>
                        {getEligibleTransferHeading(tag)}
                      </Text>
                      <Text className={`${secondaryTextClass} text-xs mt-1`}>
                        {isSearching && rows.length !== sourceRowCount
                          ? `${rows.length} of ${sourceRowCount} source-backed equivalenc${sourceRowCount === 1 ? "y" : "ies"}`
                          : `${rows.length} source-backed equivalenc${rows.length === 1 ? "y" : "ies"}`}
                      </Text>
                    </View>
                    <MaterialIcons
                      name={isOpen ? "expand-less" : "expand-more"}
                      size={20}
                      color="#9CA3AF"
                    />
                  </AnimatedIconPressable>

                  {isOpen ? (
                    <View className="mt-3 gap-2">
                      {rows.map((row) => (
                        <View key={`${tag}-${row.id}`} className={`border ${borderClass} rounded-xl px-3 py-3`}>
                          <Text className={`${textClass} text-sm font-semibold`}>
                            {row.sourceCourseTitle
                              ? `${row.sourceCourseLabel} - ${row.sourceCourseTitle}`
                              : row.sourceCourseLabel}
                          </Text>
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>
                            {selectedCollegeId === "grc"
                              ? `UW outcome: ${row.targetOutcome}`
                              : row.targetOutcome}
                          </Text>
                          {row.ceApprovedReason ? (
                            <Text className={`${secondaryTextClass} text-xs mt-1`}>
                              Allen School CE-approved Natural Science:{" "}
                              {row.ceApprovedReason === "compound-path"
                                ? "compound path"
                                : "approved UW equivalent"}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}
