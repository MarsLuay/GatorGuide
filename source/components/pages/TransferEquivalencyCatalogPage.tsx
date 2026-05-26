import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";

import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { AnimatedIconPressable } from "@/components/ui/AnimatedPressables";
import { PageBackButton } from "@/components/ui/PageBackButton";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/SearchableSelect";
import {
  TRANSFER_EQUIVALENCY_CATALOG_CAMPUSES,
  TRANSFER_EQUIVALENCY_CATALOG_ENTRIES,
} from "@/constants/transfer-equivalency-catalog.generated";
import {
  getTransferPlannerStudentRuntimeMajorsForCampus,
  resolveTransferPlannerStudentRuntimeMajorPlan,
} from "@/constants/transfer-planner-source/student-runtime";
import { ROUTES } from "@/constants/routes";
import { TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD } from "@/constants/planner-storage";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppData } from "@/hooks/use-app-data";
import useBack from "@/hooks/use-back";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import {
  TRANSCRIPT_COURSES_FIELD,
  TRANSCRIPT_PARSER_VERSION,
  TRANSCRIPT_PARSER_VERSION_FIELD,
  TRANSCRIPT_FIELD,
} from "@/services/planning/transfer-planner-cache.service";
import { parseCompletedTranscriptCourses } from "@/services/planning/transfer-planner.service";
import {
  DEFAULT_TRANSFER_EQUIVALENCY_CAMPUS_ID,
  DEFAULT_TRANSFER_EQUIVALENCY_COLLEGE_ID,
  buildCeApprovedNaturalScienceRows,
  buildEligibleCourseCodesByTag,
  buildEquivalenciesByTag,
  buildGrcGeneralEducationCatalogRules,
  buildHighlightedCategoryLabels,
  buildSourceCourseCodesByTag,
  buildTranscriptReadyCourseCodesByTag,
  filterEquivalenciesBySearch,
  getEligibleTransferHeading,
  getLatestGrcGeneralEducationCatalogYearLabel,
  getTransferEquivalencyCollegeLabel,
  hasTranscriptCourseRecords,
  isTransferEquivalencyCampusId,
  isTransferEquivalencyCollegeId,
  normalizeEquivalencySearchValue,
  normalizeSingleSearchParam,
  normalizeStoredTranscriptParserVersion,
  normalizeTransferEquivalencyCampusId,
  normalizeTransferEquivalencyCatalogFilterId,
  normalizeTransferEquivalencyCollegeId,
  resolveVisibleTransferEquivalencyTags,
  type TransferEquivalencyCatalogDisplayEntry,
  type TransferEquivalencyCatalogFilterId,
} from "@/components/pages/transfer-equivalency-catalog/transfer-equivalency-catalog-logic";

export default function TransferEquivalencyCatalogPage() {
  const goBack = useBack(ROUTES.transferPlanner);
  const router = useRouter();
  const { width } = useWindowDimensions();
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
  const latestGrcGeneralEducationCatalogYearLabel = useMemo(
    () => getLatestGrcGeneralEducationCatalogYearLabel(),
    []
  );

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
        label: t("transferEquivalencies.universityOfWashington"),
        description: t("transferEquivalencies.uwDescription"),
      },
      {
        id: "grc",
        label: t("transferEquivalencies.greenRiverCollege"),
        description: t("transferEquivalencies.grcDescription"),
      },
    ],
    [t]
  );

  const selectedCollegeLabel =
    collegeOptions.find((option) => option.id === selectedCollegeId)?.label ??
    getTransferEquivalencyCollegeLabel(selectedCollegeId);
  const isGreenRiverCollegeMode = selectedCollegeId === "grc";

  const selectedCampusId = useMemo(() => {
    if (isGreenRiverCollegeMode) {
      return DEFAULT_TRANSFER_EQUIVALENCY_CAMPUS_ID;
    }

    return normalizeTransferEquivalencyCampusId(params.campusId, campuses);
  }, [campuses, isGreenRiverCollegeMode, params.campusId]);

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
  const visibleCampusLabel = isGreenRiverCollegeMode
    ? selectedCollegeLabel
    : selectedCampusLabel;
  const selectedMajorId = useMemo(
    () => normalizeSingleSearchParam(params.majorId),
    [params.majorId]
  );
  const selectedPathwayId = useMemo(
    () => normalizeSingleSearchParam(params.pathwayId),
    [params.pathwayId]
  );
  const selectedMajorPlan = useMemo(() => {
    if (isGreenRiverCollegeMode) return null;
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
  }, [isGreenRiverCollegeMode, selectedCampusId, selectedMajorId, selectedPathwayId]);
  const eligibleCourseCodesByTag = useMemo(
    () => buildEligibleCourseCodesByTag(selectedMajorPlan),
    [selectedMajorPlan]
  );
  const grcGeneralEducationRules = useMemo(() => {
    if (!isGreenRiverCollegeMode || !latestGrcGeneralEducationCatalogYearLabel) {
      return [] as TransferEquivalencyCatalogDisplayEntry[];
    }

    return buildGrcGeneralEducationCatalogRules(
      latestGrcGeneralEducationCatalogYearLabel
    );
  }, [isGreenRiverCollegeMode, latestGrcGeneralEducationCatalogYearLabel]);
  const catalogRules = isGreenRiverCollegeMode
    ? grcGeneralEducationRules
    : equivalencyRules;
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
          String(state.questionnaireAnswers?.[TRANSCRIPT_FIELD] ?? "").trim()
      ),
    [state.questionnaireAnswers, state.user?.transcript]
  );
  const transcriptCompletedCourseCodes = useMemo(() => {
    if (!hasUnofficialTranscript) {
      return [] as string[];
    }

    const rawCompletedCourses = shouldUseDetailedCompletedCourses
      ? storedDetailedTranscriptCourses
      : state.questionnaireAnswers?.[TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD];

    return parseCompletedTranscriptCourses(rawCompletedCourses)
      .map((course) => course.code)
      .filter(Boolean);
  }, [
    hasUnofficialTranscript,
    shouldUseDetailedCompletedCourses,
    state.questionnaireAnswers,
    storedDetailedTranscriptCourses,
  ]);
  const sourceCourseCodesByTag = useMemo(
    () =>
      buildSourceCourseCodesByTag({
        catalogRules,
        eligibleCourseCodesByTag,
        selectedCampusId,
      }),
    [catalogRules, eligibleCourseCodesByTag, selectedCampusId]
  );
  const transcriptReadyCourseCodesByTag = useMemo(
    () =>
      buildTranscriptReadyCourseCodesByTag({
        completedCourseCodes: transcriptCompletedCourseCodes,
        hasUnofficialTranscript,
        sourceCourseCodesByTag,
      }),
    [hasUnofficialTranscript, sourceCourseCodesByTag, transcriptCompletedCourseCodes]
  );
  const ceApprovedNaturalScienceRows = useMemo(
    () =>
      buildCeApprovedNaturalScienceRows({
        completedCourseCodes: transcriptCompletedCourseCodes,
        hasUnofficialTranscript,
        isGreenRiverCollegeMode,
        selectedCampusId,
      }),
    [
      hasUnofficialTranscript,
      isGreenRiverCollegeMode,
      selectedCampusId,
      transcriptCompletedCourseCodes,
    ]
  );

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
        campusId:
          normalizedCollegeId === "grc"
            ? DEFAULT_TRANSFER_EQUIVALENCY_CAMPUS_ID
            : selectedCampusId,
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

  const equivalenciesByTag = useMemo(
    () =>
      buildEquivalenciesByTag({
        catalogRules,
        ceApprovedNaturalScienceRows,
        completedCourseCodes: transcriptCompletedCourseCodes,
        eligibleCourseCodesByTag,
        hasUnofficialTranscript,
        selectedCampusId,
        transcriptReadyCourseCodesByTag,
      }),
    [
      ceApprovedNaturalScienceRows,
      catalogRules,
      eligibleCourseCodesByTag,
      hasUnofficialTranscript,
      selectedCampusId,
      transcriptCompletedCourseCodes,
      transcriptReadyCourseCodesByTag,
    ]
  );

  const visibleTags = useMemo(
    () =>
      resolveVisibleTransferEquivalencyTags({
        ceApprovedNaturalScienceRowCount: ceApprovedNaturalScienceRows.length,
        equivalenciesByTag,
        selectedTags,
      }),
    [ceApprovedNaturalScienceRows.length, equivalenciesByTag, selectedTags]
  );
  const normalizedSearchQuery = normalizeEquivalencySearchValue(searchQuery);
  const isSearching = normalizedSearchQuery.length > 0;
  const filteredEquivalenciesByTag = useMemo(
    () =>
      filterEquivalenciesBySearch({
        equivalenciesByTag,
        isGreenRiverCollegeMode,
        normalizedSearchQuery,
        visibleTags,
      }),
    [equivalenciesByTag, isGreenRiverCollegeMode, normalizedSearchQuery, visibleTags]
  );
  const displayedTags = useMemo(
    () =>
      visibleTags.filter(
        (tag) => (filteredEquivalenciesByTag.get(tag)?.length ?? 0) > 0
      ),
    [filteredEquivalenciesByTag, visibleTags]
  );

  const campusLabel = selectedCampusLabel;
  const highlightedCategoryLabels = useMemo(
    () => buildHighlightedCategoryLabels(isGreenRiverCollegeMode),
    [isGreenRiverCollegeMode]
  );
  const pageDescription =
    isGreenRiverCollegeMode
      ? t("transferEquivalencies.pageDescriptionGrc", {
          campus: campusLabel,
          categories: highlightedCategoryLabels,
        })
      : t("transferEquivalencies.pageDescriptionUw", {
          campus: campusLabel,
          categories: highlightedCategoryLabels,
        });
  const campusHelperText =
    isGreenRiverCollegeMode
      ? t("transferEquivalencies.campusHelperGrc")
      : t("transferEquivalencies.campusHelperUw");
  const searchHelperText =
    isGreenRiverCollegeMode
      ? t("transferEquivalencies.searchHelperGrc")
      : t("transferEquivalencies.searchHelperUw");
  const isDesktop = width >= 1024;
  const shellMaxWidth = isDesktop ? 1180 : 760;
  const shellPadding = isDesktop ? 32 : 20;
  const panelClassName = `${cardBgClass} border ${borderClass} rounded-3xl`;

  return (
    <ScreenBackground includeTopInset includeBottomInset={false}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: shellPadding,
          paddingTop: shellPadding,
          paddingBottom: 36,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => {
          setIsCollegeSelectorOpen(false);
          setIsCampusSelectorOpen(false);
        }}
      >
        <View style={{ width: "100%", maxWidth: shellMaxWidth, alignSelf: "center" }}>
          <PageBackButton onPress={goBack} label={backLabel} textClassName={secondaryTextClass} />

          <View className={`${panelClassName} mt-4 px-5 py-5 ${isDesktop ? "flex-row items-center justify-between gap-6" : "gap-4"}`}>
            <View className={`${isDesktop ? "flex-row items-center flex-1" : ""} gap-4`}>
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
                <MaterialIcons name="compare-arrows" size={25} color="#10B981" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className={`${textClass} text-2xl font-semibold`}>
                  {t("transferEquivalencies.title")}
                </Text>
                <Text className={`${secondaryTextClass} text-sm mt-2`}>
                  {pageDescription}
                </Text>
              </View>
            </View>
            <View className={`rounded-2xl border ${borderClass} px-4 py-3 ${isDesktop ? "min-w-[190px]" : ""}`}>
              <Text className={`${secondaryTextClass} text-xs`}>{t("transferEquivalencies.showing")}</Text>
              <Text className={`${textClass} text-sm font-semibold mt-1`}>
                {visibleCampusLabel}
              </Text>
            </View>
          </View>

          <View className={`${panelClassName} px-5 py-5 mt-5 gap-5`}>
            <View className={`${isDesktop ? "flex-row gap-4" : "gap-4"}`}>
              <View className={`${isDesktop ? "flex-1" : ""}`}>
                <Text className={`${textClass} font-semibold`}>{t("transferEquivalencies.college")}</Text>
                <Text className={`${secondaryTextClass} text-xs mt-1`}>
                  {t("transferEquivalencies.collegeHelper")}
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

              <View className={`${isDesktop ? `flex-1 border-l ${borderClass} pl-4` : `border-t ${borderClass} pt-4`}`}>
                <Text className={`${textClass} font-semibold`}>{t("transferEquivalencies.campus")}</Text>
                <Text className={`${secondaryTextClass} text-xs mt-1`}>
                  {campusHelperText}
                </Text>
                <View className="mt-3">
                  {isGreenRiverCollegeMode ? (
                    <View className={`border ${borderClass} rounded-2xl px-4 py-4 flex-row items-center justify-between`}>
                      <View className="flex-1 min-w-0 pr-3">
                        <Text className={`${textClass} font-semibold`} numberOfLines={1}>
                          {visibleCampusLabel}
                        </Text>
                      </View>
                      <MaterialIcons name="school" size={21} color="#10B981" />
                    </View>
                  ) : (
                    <SearchableSelect
                      value={visibleCampusLabel}
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
                  )}
                </View>
              </View>
            </View>

            <View className={`border-t ${borderClass} pt-5`}>
              <Text className={`${textClass} font-semibold`}>{t("transferEquivalencies.searchTitle")}</Text>
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
                  placeholder={t("transferEquivalencies.searchPlaceholder")}
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
                    accessibilityLabel={t("transferEquivalencies.clearSearch")}
                  >
                    <MaterialIcons name="close" size={18} color="#9CA3AF" />
                  </AnimatedIconPressable>
                ) : null}
              </View>
            </View>
          </View>

          {!visibleTags.length ? (
            <View className={`${panelClassName} px-5 py-5 mt-5`}>
              <Text className={`${textClass} font-semibold`}>{t("transferEquivalencies.noTaggedTitle")}</Text>
              <Text className={`${secondaryTextClass} text-sm mt-2`}>
                {t("transferEquivalencies.noTaggedBody")}
              </Text>
            </View>
          ) : !displayedTags.length ? (
            <View className={`${panelClassName} px-5 py-5 mt-5`}>
              <Text className={`${textClass} font-semibold`}>{t("transferEquivalencies.noMatchesTitle")}</Text>
              <Text className={`${secondaryTextClass} text-sm mt-2`}>
                {t("transferEquivalencies.noMatchesBody")}
              </Text>
            </View>
          ) : (
            <View className="mt-5 gap-4">
              <View className={`${isDesktop ? "flex-row items-end justify-between" : ""} gap-2`}>
                <View>
                  <Text className={`${textClass} text-lg font-semibold`}>{t("transferEquivalencies.categoryResults")}</Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>
                    {t("transferEquivalencies.categoryResultsCount", {
                      count: displayedTags.length,
                      noun: displayedTags.length === 1 ? t("transferEquivalencies.categorySingular") : t("transferEquivalencies.categoryPlural"),
                    })}
                  </Text>
                </View>
              </View>
              {displayedTags.map((tag) => {
                const rows = filteredEquivalenciesByTag.get(tag) ?? [];
                const sourceRowCount = equivalenciesByTag.get(tag)?.length ?? rows.length;
                const isOpen =
                  isSearching || (tagOpenState[tag] ?? (selectedTags.length > 0));
                return (
                  <View key={tag} className={`${panelClassName} px-5 py-5`}>
                    <AnimatedIconPressable
                      onPress={() =>
                        setTagOpenState((current) => ({
                          ...current,
                          [tag]: !(current[tag] ?? (selectedTags.length > 0)),
                        }))
                      }
                      className="flex-row items-center justify-between gap-4"
                    >
                      <View className="flex-row items-center flex-1 min-w-0 gap-3">
                        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10">
                          <MaterialIcons name="label-outline" size={20} color="#10B981" />
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text className={`${textClass} font-semibold`}>
                            {getEligibleTransferHeading(tag, isGreenRiverCollegeMode)}
                          </Text>
                          <Text className={`${secondaryTextClass} text-xs mt-1`}>
                            {isSearching && rows.length !== sourceRowCount
                              ? t("transferEquivalencies.filteredRowCount", {
                                  count: rows.length,
                                  total: sourceRowCount,
                                  noun: sourceRowCount === 1 ? t("transferEquivalencies.equivalencySingular") : t("transferEquivalencies.equivalencyPlural"),
                                })
                              : t("transferEquivalencies.rowCount", {
                                  count: rows.length,
                                  noun: rows.length === 1 ? t("transferEquivalencies.equivalencySingular") : t("transferEquivalencies.equivalencyPlural"),
                                })}
                          </Text>
                        </View>
                      </View>
                      <MaterialIcons
                        name={isOpen ? "expand-less" : "expand-more"}
                        size={22}
                        color="#9CA3AF"
                      />
                    </AnimatedIconPressable>

                    {isOpen ? (
                      <View className={`mt-4 ${isDesktop ? "gap-3" : "gap-2"}`}>
                        {rows.map((row) => (
                          <View
                            key={`${tag}-${row.id}`}
                            className={`border ${borderClass} rounded-2xl px-4 py-3 ${isDesktop ? "flex-row items-center justify-between gap-5" : ""}`}
                          >
                            <View className="flex-1 min-w-0">
                              <Text className={`${textClass} text-sm font-semibold`}>
                                {row.sourceCourseTitle
                                  ? `${row.sourceCourseLabel} - ${row.sourceCourseTitle}`
                                  : row.sourceCourseLabel}
                              </Text>
                              {row.ceApprovedReason ? (
                                <Text className={`${secondaryTextClass} text-xs mt-1`}>
                                  {t("transferEquivalencies.ceApprovedNaturalScience")}{" "}
                                  {row.ceApprovedReason === "compound-path"
                                    ? t("transferEquivalencies.compoundPath")
                                    : t("transferEquivalencies.approvedUwEquivalent")}
                                </Text>
                              ) : null}
                            </View>
                            <View className={`${isDesktop ? "max-w-[420px] items-end" : "mt-2"}`}>
                              <Text className={`${secondaryTextClass} text-xs ${isDesktop ? "text-right" : ""}`}>
                                {isGreenRiverCollegeMode
                                  ? t("transferEquivalencies.grcRequirement", {
                                      requirement: row.targetOutcome,
                                    })
                                  : row.targetOutcome}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
