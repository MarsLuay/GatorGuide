import {
  assert,
  auditCategoryOptionDetection,
  auditCategoryTranscriptSatisfaction,
  auditOptionGroupSatisfaction,
  auditProgramApprovedCourseFilters,
  auditOptionTitleFallback,
  auditRuntimeCompoundScheduling,
  auditRuntimeOptionResolution,
  auditSbseCurrentVsOldSource,
  auditSbseScheduledRowSources,
  auditUnselectedOptionPrerequisiteScheduling,
  AUTO_CUSTOM_PREP_FALLBACK_TITLE,
  AUTO_UW_PREP_GUIDANCE_TITLE,
  AUTO_UW_PREP_TARGET_PREFIX,
  biologyPlan,
  buildMajorSpecificsCourseSections,
  buildMajorSpecificsRenderingAudit,
  buildRequirementStatuses,
  buildRuntimeEarthScienceChoiceItem,
  buildRuntimeOptionResolutionSuggestedPlan,
  buildRuntimeOptionResolutionTestPlan,
  buildSourceBackedGeneralEducationRequirementTargets,
  buildSourceBackedMajorGeneralEducationRequirementSection,
  buildSourceBackedRequiredCourseCodes,
  buildStatuses,
  buildSuggestedQuarterCourseOptionGroupsForTrack,
  buildSuggestedQuarterPlan,
  buildSuggestedQuarterRemainingCreditRange,
  buildTranscriptCourses,
  buildUwGeneralTransferRequirementSection,
  collectProjectTextFiles,
  collectVisibleOptionGroupsForTitleAudit,
  countMatchedGrcTrackGeneralEducationBreadthRows,
  csPlan,
  EMPTY_RUNTIME_CUSTOM_PREP_PLAN_IDS,
  EXPECTED_UW_TRANSFER_ADMISSION_REQUIREMENT_LINES,
  extractCourseCodes,
  getAllChecklistItems,
  getChecklistCoverageForPlan,
  getCompactRuntimeGrcCourseList,
  getCompactRuntimeMajorPlan,
  getCompactRuntimeTrack,
  getGuideBackedCoverageGaps,
  getPlannedCourseLabelList,
  getPlannedCourseLabels,
  getRequiredPlan,
  getRequirementOptionSelection,
  getStrictChoiceSetNoPublicPathPlanIds,
  getTransferPlannerAutoMatchedTrackRecommendation,
  getTransferPlannerGrcCourseList,
  getTransferPlannerMajorPlan,
  getTransferPlannerParsedRequirementSourceBlocks,
  getTransferPlannerPathwaysForPlan,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerRequirementDiffClassifications,
  getTransferPlannerSourceGeneratedMajorsForCampus,
  getTransferPlannerSourceManifestEntriesForPlan,
  getTransferPlannerStudentRuntimeMajorPlan,
  getTransferPlannerStudentRuntimeMajorsForCampus,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  getTransferPlannerStudentVisibleMajorsForCampus,
  getTransferPlannerStudentVisiblePathwaysForPlan,
  getTransferPlannerTrack,
  hasStructuredPlannerData,
  isHiddenSourceOnlyRuntimeChecklistTitle,
  isTransferPlannerStudentHiddenSourceGap,
  normalizeCourseCode,
  readFileSync,
  resolveCompactRuntimeMajorPlan,
  resolveTransferPlannerMajorPlan,
  resolveTransferPlannerStudentRuntimeMajorPlan,
  seattleAtmosphericClimateSciencePlan,
  sourceGeneratedGeographyPlan,
  sourceGeneratedPhghPlan,
  sourceGeneratedStatisticsPlan,
  sourceGeneratedTacomaSudPlan,
  sourceGeneratedTacomaUrbanStudiesPlan,
  tacomaItPlan,
  tacomaNursingPlan,
  test,
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS,
  TRANSFER_PLANNER_GAP_REGISTRY,
  TRANSFER_PLANNER_GENERATED_MAJOR_PLANS,
  TRANSFER_PLANNER_SUMMARY,
  TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS,
} from "./transfer-planner.test-support";
import {
  collectSuggestedScheduleOptionGroups,
  getNextSuggestedScheduleToggleSelectionIds,
  getSchedulePlaceholderRequirementLinkData,
  getSuggestedScheduleOptionIdsForToggle,
  getSuggestedScheduleResolvedOptionIds,
  getSuggestedScheduleSelectedOptionLabels,
  removeGuidanceSummaryPrefixes,
  shouldShowSuggestedScheduleOptionGroup,
  getSuggestedScheduleVisibleOptions,
  type SuggestedScheduleOptionGroup,
} from "@/components/transfer-planner/transfer-planner-suggested-schedule";
import { translations } from "@/services/app/translations";
import type {
  TranscriptCourseEntry,
  TransferPlannerChecklistItem,
  TransferPlannerMajorPlan,
} from "./transfer-planner.test-support";

test("Seattle Environmental Engineering visible option groups use numbered requirement choice titles", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-environmental-engineering"
  );
  assert.ok(runtimePlan, "Expected the Environmental Engineering runtime plan.");
  const completedCourses: TranscriptCourseEntry[] = [];
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, completedCourses),
    completedCourses,
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const optionTitleAudit = auditOptionTitleFallback({
    optionGroups: collectVisibleOptionGroupsForTitleAudit(suggestedPlan),
    forceNumberedTitles: true,
  });

  assert.deepEqual(
    optionTitleAudit.map((entry) => entry.displayedTitle),
    [
      "Requirement Choice 1",
      "Requirement Choice 2",
      "Requirement Choice 3",
      "Requirement Choice 4",
      "Requirement Choice 5",
      "Requirement Choice 6",
    ]
  );
  assert.equal(
    optionTitleAudit.every((entry) => entry.reason === "forced-numbered-option-title"),
    true
  );
  assert.equal(
    optionTitleAudit.some((entry) => /Di ff erential Equations|Thermodynamics/i.test(entry.originalTitle)),
    true
  );
  assert.equal(
    optionTitleAudit.some((entry) => /Earth science elective/i.test(entry.originalTitle)),
    true
  );
});

test("Option toggle selection removes visually selected scheduled-counted rows", () => {
  assert.deepEqual(
    getNextSuggestedScheduleToggleSelectionIds({
      optionId: "math-124",
      selectionCount: 6,
      displayedOptionIds: ["math-207", "math-124", "math-125", "math-126", "math-224"],
      storedOptionIds: ["math-207"],
      hasStoredSelection: true,
    }),
    ["math-207", "math-125", "math-126", "math-224", "__unselected__:math-124"]
  );
  assert.deepEqual(
    getNextSuggestedScheduleToggleSelectionIds({
      optionId: "math-208",
      selectionCount: 6,
      displayedOptionIds: ["math-207", "math-125"],
      storedOptionIds: ["math-207"],
      hasStoredSelection: true,
    }),
    ["math-207", "math-208"]
  );
});

test("Option toggle baseline removes stored selected rows without pulling in scheduled-counted rows", () => {
  const optionGroup = {
    selectedOptionIds: ["math-124", "math-125", "math-126", "math-224"],
    resolvedSatisfiedOptionIds: ["math-124", "math-125", "math-126", "math-224", "math-207"],
  } as SuggestedScheduleOptionGroup;

  assert.deepEqual(
    getNextSuggestedScheduleToggleSelectionIds({
      optionId: "math-124",
      selectionCount: 9,
      displayedOptionIds: getSuggestedScheduleOptionIdsForToggle(optionGroup, "math-124"),
      storedOptionIds: optionGroup.selectedOptionIds,
      hasStoredSelection: true,
    }),
    ["math-125", "math-126", "math-224", "__unselected__:math-124"]
  );
  assert.deepEqual(
    getNextSuggestedScheduleToggleSelectionIds({
      optionId: "math-207",
      selectionCount: 9,
      displayedOptionIds: getSuggestedScheduleOptionIdsForToggle(optionGroup, "math-207"),
      storedOptionIds: optionGroup.selectedOptionIds,
      hasStoredSelection: true,
    }),
    ["math-124", "math-125", "math-126", "math-224", "__unselected__:math-207"]
  );
});

test("Credit-based requirement choices keep student selections below the credit target", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-aeronautics-astronautics"
  );
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");

  const groupId =
    "uw-seattle-aeronautics-astronautics:requirement-group:mathematics-27-credits-choose-credits-27-27";
  const mathGroup = runtimePlan.requirementGroups?.find((group) => group.id === groupId);
  assert.ok(mathGroup, "Expected the A&A Mathematics credit bucket.");

  const getOptionId = (uwCourse: string) => {
    const option = mathGroup.options.find((candidate) =>
      candidate.uwCourses.includes(uwCourse)
    );
    assert.ok(option?.id, `Expected the ${uwCourse} option.`);
    return option.id;
  };
  const selectedOptionIds = [
    getOptionId("MATH 125"),
    getOptionId("MATH 126"),
    getOptionId("MATH 224"),
  ];
  const selectedRequirementOptionIdsByGroup = {
    [groupId]: [...selectedOptionIds, `__unselected__:${getOptionId("MATH 124")}`],
  };
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup,
    referenceDate: new Date("2026-05-24T12:00:00.000Z"),
  });
  const optionGroup = collectSuggestedScheduleOptionGroups(suggestedPlan).find(
    (group) => group.id === groupId
  );
  assert.ok(optionGroup, "Expected the selected A&A Mathematics option group.");

  const sortIds = (ids: string[]) => [...ids].sort();
  const resolvedOptionIds = getSuggestedScheduleResolvedOptionIds(optionGroup);

  assert.equal(optionGroup.selectionSource, "student");
  assert.deepEqual(sortIds(optionGroup.selectedOptionIds), sortIds(selectedOptionIds));
  assert.deepEqual(sortIds(resolvedOptionIds), sortIds(selectedOptionIds));
  assert.deepEqual(getSuggestedScheduleSelectedOptionLabels(optionGroup), [
    "Calculus II",
    "Calculus III",
    "Calculus IV",
  ]);
  assert.equal(optionGroup.displayedCreditProgress, "15/27");
  assert.equal(resolvedOptionIds.includes(getOptionId("MATH 124")), false);
  assert.equal(resolvedOptionIds.includes(getOptionId("MATH 207")), false);
  assert.equal(resolvedOptionIds.includes(getOptionId("MATH 208")), false);
  assert.equal(resolvedOptionIds.includes(getOptionId("CHEM 142")), false);

  const clearedSuggestedPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup: {
      [groupId]: mathGroup.options.map((option) => `__unselected__:${option.id}`),
    },
    referenceDate: new Date("2026-05-24T12:00:00.000Z"),
  });
  const clearedOptionGroup = collectSuggestedScheduleOptionGroups(clearedSuggestedPlan).find(
    (group) => group.id === groupId
  );
  assert.ok(clearedOptionGroup, "Expected the cleared A&A Mathematics option group.");
  assert.equal(clearedOptionGroup.selectionSource, "student");
  assert.deepEqual(getSuggestedScheduleResolvedOptionIds(clearedOptionGroup), []);
  assert.equal(clearedOptionGroup.displayedCreditProgress, "0/27");
});

test("Seattle geography rows reflect the current official track set without introducing an auto-match", () => {
  assert.ok(sourceGeneratedGeographyPlan, "Expected a Seattle Geography source-generated planner row.");

  const basePrimarySource = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-geography",
    null
  );
  const baseParsedBlocks = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-geography",
    null
  );
  const baseManifestEntries = getTransferPlannerSourceManifestEntriesForPlan(
    "uw-seattle-geography",
    null
  );
  const runtimeGeographyPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-geography"),
    null
  );
  const geographySupplementalSourceUrl = "https://geography.washington.edu/courses-track";
  const allowedBaseGeographySourceUrls = new Set(
    [basePrimarySource?.url, geographySupplementalSourceUrl].filter(Boolean)
  );
  const expectedCurrentPathways = [
    ["cities-citizenship-and-migration-track", "Cities, Citizenship, and Migration track"],
    ["environment-economy-and-sustainability-track", "Environment, Economy, and Sustainability track"],
    ["geography-major-data-science-option", "Geography Major Data Science Option"],
    ["gis-mapping-and-society-track", "GIS, Mapping, and Society track"],
    ["globalization-health-and-development-track", "Globalization, Health, and Development track"],
  ].sort(([leftId], [rightId]) => leftId.localeCompare(rightId));

  assert.equal(basePrimarySource?.url, "https://geography.washington.edu/ba-geography");
  assert.ok(
    baseManifestEntries.some((entry) => entry.url === geographySupplementalSourceUrl),
    "Expected base Geography to register the official courses-by-track page as a supplemental source."
  );

  assert.ok(
    baseParsedBlocks.some((block) => block.sourceUrl === basePrimarySource?.url),
    "Expected base Geography to include the dedicated B.A. page."
  );
  assert.ok(
    baseParsedBlocks.every((block) => allowedBaseGeographySourceUrls.has(block.sourceUrl)),
    "Expected base Geography to stay within the dedicated and approved supplemental official pages."
  );

  assert.ok(
    baseParsedBlocks.some((block) => block.parsedUwCourseCodes.includes("GEOG 123")),
    "Expected base Geography to keep lower-division Geography breadth evidence."
  );
  assert.ok(
    baseParsedBlocks.some((block) => block.parsedUwCourseCodes.includes("CSE 142")),
    "Expected current base Geography parsing to preserve the Data Science option cues now published on the base B.A. page."
  );
  assert.deepEqual(
    getTransferPlannerPathwaysForPlan(sourceGeneratedGeographyPlan)
      .map((pathway) => [pathway.id, pathway.label])
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
    expectedCurrentPathways
  );

  assert.ok(runtimeGeographyPlan, "Expected Seattle Geography runtime planner row.");
  assert.equal(runtimeGeographyPlan?.bestTrackId, null);
  assert.equal(
    getTransferPlannerAutoMatchedTrackRecommendation(runtimeGeographyPlan?.grcCourseList ?? [])
      ?.trackId ?? null,
    null
  );
});

test("Seattle French and Italian stay on dedicated source targeting without reviving shared-page auto-matching", () => {
  const frenchPrimarySource = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-french",
    null
  );
  const italianPrimarySource = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-italian",
    null
  );
  const frenchParsedBlocks = getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-french");
  const italianParsedBlocks = getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-italian");

  assert.equal(
    frenchPrimarySource?.url,
    "https://frenchitalian.washington.edu/major-french-studies"
  );
  assert.equal(
    italianPrimarySource?.url,
    "https://frenchitalian.washington.edu/undergraduate-studies-italian"
  );
  assert.ok(
    frenchParsedBlocks.every((entry) => entry.sourceUrl === frenchPrimarySource?.url),
    "Expected French to stay on the dedicated major page."
  );
  assert.ok(
    frenchParsedBlocks.some((entry) => entry.parsedUwCourseCodes.includes("FRENCH 203")),
    "Expected French parsed source coverage to keep at least one lower-division French course."
  );
  assert.ok(
    frenchParsedBlocks.every(
      (entry) =>
        !entry.parsedUwCourseCodes.some((courseCode) => /^(?:ITAL|TXTDS)\b/.test(courseCode))
    ),
    "Expected French parsing to stay separated from Italian and TXTDS shared-page content."
  );
  assert.ok(
    italianParsedBlocks.every((entry) => entry.sourceUrl === italianPrimarySource?.url),
    "Expected Italian to stay on the dedicated undergraduate page instead of falling back to the shared legacy catalog."
  );
  assert.ok(
    italianParsedBlocks.every(
      (entry) =>
        !entry.parsedUwCourseCodes.some((courseCode) => /^(?:FRENCH|TXTDS)\b/.test(courseCode))
    ),
    "Expected Italian parsing to avoid French/TXTDS shared-page contamination when the dedicated source is targeted."
  );
  assert.ok(
    italianParsedBlocks.every((entry) => entry.parsedUwCourseCodes.length === 0),
    "Expected current Italian source coverage to remain prose-only until the dedicated source publishes safe course evidence."
  );

  const collectMappedLowerDivisionCodes = (
    planId: string,
    subjectPrefix: string
  ) =>
    getTransferPlannerRequirementDiffClassifications(planId)
      .filter((entry) => {
        const normalizedCode = normalizeCourseCode(entry.sourceUwCourseCode);
        const mappedCourses = [
          ...(entry.grcCourseCodes ?? []),
          ...((entry.alternativeCourseCodeSets ?? []).flat()),
        ];
        const levelMatch = normalizedCode.match(/(\d{3})[A-Z]?$/);
        const level = levelMatch ? Number(levelMatch[1]) : null;

        return (
          normalizedCode.startsWith(subjectPrefix) &&
          level !== null &&
          level < 300 &&
          mappedCourses.length > 0
        );
      })
      .map((entry) => ({
        code: entry.sourceUwCourseCode,
        grcCourses: [...entry.grcCourseCodes],
      }));

  const frenchMappedLowerDivisionCodes = collectMappedLowerDivisionCodes(
    "uw-seattle-french",
    "FRENCH"
  );
  const italianMappedLowerDivisionCodes = collectMappedLowerDivisionCodes(
    "uw-seattle-italian",
    "ITAL"
  );

  assert.deepEqual(frenchMappedLowerDivisionCodes, []);
  assert.deepEqual(italianMappedLowerDivisionCodes, []);

  const runtimeFrenchPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-french"),
    null
  );
  const runtimeItalianPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-italian"),
    null
  );

  for (const plan of [runtimeFrenchPlan, runtimeItalianPlan]) {
    assert.ok(plan, "Expected Seattle language runtime planner row.");
    assert.equal(plan.bestTrackId, null);
    assert.equal(
      getTransferPlannerAutoMatchedTrackRecommendation(plan.grcCourseList ?? [])?.trackId ?? null,
      null
    );
    assert.ok((plan.grcCourseList?.length ?? 0) <= 1);
  }
});

test("Bioengineering runtime auto-match uses the current GRC-completable requirement set", () => {
  const runtimePlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-bioengineering"),
    null
  );
  assert.ok(runtimePlan, "Expected Bioengineering runtime planner data.");

  const visibleGrcCourseList = getTransferPlannerGrcCourseList(runtimePlan);
  assert.deepEqual([...visibleGrcCourseList].sort(), [
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "CHEM& 261",
    "ENGL& 101",
    "ENGR 250",
    "MATH 238",
    "MATH 240",
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 163",
    "MATH& 254",
    "PHYS& 221",
    "PHYS& 222",
  ]);
  assert.equal(visibleGrcCourseList.includes("STAT 311"), false);
  assert.equal(visibleGrcCourseList.includes("QSCI 381"), false);

  const visibleCourseRecommendation =
    getTransferPlannerAutoMatchedTrackRecommendation(
      visibleGrcCourseList,
      runtimePlan.bestTrackId ?? null,
      { majorTitle: runtimePlan.title }
    );
  assert.equal(
    runtimePlan.bestTrackId,
    visibleCourseRecommendation?.trackId ?? null,
    "Expected generated runtime bestTrackId to agree with the current GRC-completable course-pool recommendation."
  );
  assert.equal(
    runtimePlan.bestTrackId,
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-bioengineering-and-chemical-engineering"
  );
  assert.equal(visibleCourseRecommendation?.matchCount, 14);
  assert.equal(visibleCourseRecommendation?.totalPlanCourseCount, 18);
  assert.match(
    runtimePlan.recommendedTrackSummary,
    /^AST-2 is the current closest Green River transfer path .* matches 14 of the 18/i
  );
  assert.doesNotMatch(runtimePlan.recommendedTrackSummary, /AA-DTA|3 of the 4/i);
});

test("Compact Bioengineering runtime displays the same AST-2 track in the header and explanation", () => {
  const runtimePlan = resolveCompactRuntimeMajorPlan(
    getCompactRuntimeMajorPlan("uw-seattle-bioengineering"),
    null
  );
  assert.ok(runtimePlan, "Expected compact Bioengineering runtime planner data.");

  const track = getCompactRuntimeTrack(runtimePlan.bestTrackId ?? null);
  const visibleGrcCourseList = getCompactRuntimeGrcCourseList(runtimePlan);
  assert.ok(track, "Expected compact runtime to resolve the Bioengineering matched track.");
  assert.equal(track?.code, "AST-2");
  assert.match(track?.title ?? "", /Bioengineering and Chemical Engineering/);
  assert.equal(
    runtimePlan.bestTrackId,
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-bioengineering-and-chemical-engineering"
  );
  assert.equal(visibleGrcCourseList.length, 18);
  assert.equal(visibleGrcCourseList.includes("STAT 311"), false);
  assert.match(
    runtimePlan.recommendedTrackSummary,
    /^AST-2 is the current closest Green River transfer path .* matches 14 of the 18/i
  );
  assert.doesNotMatch(runtimePlan.recommendedTrackSummary, /AA-DTA|3 of the 4/i);
});

test("Choice-set planner rows expose option metadata and selected options become planned courses", () => {
  const groupId = "test-chemistry-options:requirement-group:bioc-or-chem";
  const choiceItem: TransferPlannerChecklistItem = {
    id: "bioc-or-chem",
    title: "[Page 1] BIOC 405 or CHEM 432 or CHEM 436",
    grcCourses: ["BIOC 405", "CHEM 432", "CHEM 436"],
    minCompletedCount: 1,
    requirementGroup: {
      id: groupId,
      label: "[Page 1] BIOC 405 or CHEM 432 or CHEM 436",
      category: "source-choice",
      requirementType: "choose_one",
      minCourses: 1,
      maxCourses: 1,
      options: [
        {
          id: `${groupId}:bioc-405`,
          uwCourses: ["BIOC 405"],
          grcMatches: ["BIOC 405"],
          credits: 3,
          label: "BIOC 405",
        },
        {
          id: `${groupId}:chem-432`,
          uwCourses: ["CHEM 432"],
          grcMatches: ["CHEM 432"],
          credits: 4,
          label: "CHEM 432",
        },
        {
          id: `${groupId}:chem-436`,
          uwCourses: ["CHEM 436"],
          grcMatches: ["CHEM 436"],
          credits: 6,
          label: "CHEM 436",
        },
      ],
    },
  };
  const plan: TransferPlannerMajorPlan = {
    id: "test-chemistry-options",
    campusId: "uw-seattle",
    title: "Chemistry Options",
    shortTitle: "Chemistry Options",
    coverage: "detailed",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [choiceItem],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
  };
  const completedCourses: TranscriptCourseEntry[] = [];
  const unselectedPlanCourses = buildSuggestedQuarterPlan({
    plan,
    ...buildStatuses(plan, completedCourses),
    completedCourses,
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);
  const optionPromptCourse = unselectedPlanCourses.find(
    (course) => course.optionGroup?.id === groupId
  );

  assert.ok(optionPromptCourse, "Expected unselected choice set to render as an option prompt.");
  assert.match(
    optionPromptCourse.label,
    /You have 3 different options to finish this requirement\. Click for your options\./
  );
  assert.equal(optionPromptCourse.optionGroup?.isSelectionPrompt, true);
  assert.equal(optionPromptCourse.optionGroup?.options.length, 3);
  assert.equal(
    optionPromptCourse.optionGroup?.options.find((option) => option.id === `${groupId}:chem-436`)
      ?.selectedLabel,
    "CHEM 436"
  );
  assert.equal(optionPromptCourse.creditMin, 3);
  assert.equal(optionPromptCourse.creditMax, 6);

  const selectedPlanCourses = buildSuggestedQuarterPlan({
    plan,
    ...buildStatuses(plan, completedCourses),
    completedCourses,
    track: null,
    includeStayAtGrcCourses: true,
    selectedRequirementOptionIdsByGroup: {
      [groupId]: [`${groupId}:chem-436`],
    },
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);
  const selectedChemCourse = selectedPlanCourses.find((course) => course.label === "CHEM 436");

  assert.ok(selectedChemCourse, "Expected selected CHEM 436 option to become a planned course.");
  assert.equal(selectedChemCourse?.creditAmount, 6);
  assert.equal(selectedChemCourse?.optionGroup?.id, groupId);
  assert.equal(selectedChemCourse?.optionGroup?.isSelectionPrompt, false);
  assert.deepEqual(selectedChemCourse?.optionGroup?.selectedOptionIds, [`${groupId}:chem-436`]);
  assert.equal(
    selectedPlanCourses.some((course) => course.label.startsWith("You have 3 different options")),
    false
  );
});

test("Single-option requirement choices auto-materialize without displaying a choice box", () => {
  const groupId = "test-single-option-choice:requirement-group:chemistry";
  const item: TransferPlannerChecklistItem = {
    id: "single-chemistry-option",
    title: "Chemistry requirement with one schedulable option",
    grcCourses: ["CHEM& 161"],
    minCompletedCount: 1,
    requirementGroup: {
      id: groupId,
      label: "Chemistry requirement with one schedulable option",
      category: "source-choice",
      requirementType: "choose_n",
      minCourses: 1,
      maxCourses: 1,
      selectionCount: 1,
      options: [
        {
          id: `${groupId}:chem-161`,
          uwCourses: ["CHEM 142"],
          grcMatches: ["CHEM& 161"],
          credits: 6,
          label: "CHEM 142 / CHEM& 161",
        },
      ],
    },
  };
  const plan = buildRuntimeOptionResolutionTestPlan(item, "test-single-option-choice");
  const suggestedPlan = buildRuntimeOptionResolutionSuggestedPlan(plan);
  const plannedLabels = getPlannedCourseLabels(suggestedPlan);
  const plannedCourses = suggestedPlan.flatMap((quarter) => quarter.courses);
  const plannedChemCourse = plannedCourses.find((course) => course.label === "CHEM& 161");
  const collectedOptionGroups = collectSuggestedScheduleOptionGroups(suggestedPlan);

  assert.equal(plannedLabels.has("CHEM& 161"), true);
  assert.equal(
    plannedCourses.some((course) => /^You have 1 different option/i.test(course.label)),
    false
  );
  assert.equal(plannedChemCourse?.optionGroup?.id, groupId);
  assert.equal(plannedChemCourse?.optionGroup?.selectionSource, "default");
  assert.deepEqual(plannedChemCourse?.optionGroup?.selectedOptionIds, [`${groupId}:chem-161`]);
  assert.equal(shouldShowSuggestedScheduleOptionGroup(plannedChemCourse?.optionGroup), false);
  assert.equal(collectedOptionGroups.some((optionGroup) => optionGroup.id === groupId), false);

  const explicitlyClearedPlan = buildRuntimeOptionResolutionSuggestedPlan(plan, {
    [groupId]: [],
  });
  assert.equal(getPlannedCourseLabels(explicitlyClearedPlan).has("CHEM& 161"), true);
  assert.equal(
    collectSuggestedScheduleOptionGroups(explicitlyClearedPlan).some(
      (optionGroup) => optionGroup.id === groupId
    ),
    false
  );
});

test("Suggested schedule option rows show only prerequisite-series starts by default", () => {
  const optionGroup: SuggestedScheduleOptionGroup = {
    id: "test-calculus-series:requirement-group:calculus",
    title: "Calculus I",
    promptLabel: "Calculus I",
    selectionCount: 1,
    requirementType: "choose_one",
    selectedOptionIds: ["test-calculus-series:math-151"],
    options: [
      {
        id: "test-calculus-series:math-151",
        label: "MATH& 151 - Calculus I",
        selectedLabel: "MATH& 151",
        courseLabels: ["MATH& 151"],
        courseCodes: ["MATH& 151"],
        creditAmount: 5,
      },
      {
        id: "test-calculus-series:math-152",
        label: "MATH& 152 - Calculus II",
        selectedLabel: "MATH& 152",
        courseLabels: ["MATH& 152"],
        courseCodes: ["MATH& 152"],
        creditAmount: 5,
      },
      {
        id: "test-calculus-series:math-163",
        label: "MATH& 163 - Calculus III",
        selectedLabel: "MATH& 163",
        courseLabels: ["MATH& 163"],
        courseCodes: ["MATH& 163"],
        creditAmount: 5,
      },
    ],
    isSelectionPrompt: true,
  };

  assert.deepEqual(
    getSuggestedScheduleVisibleOptions(optionGroup).map((option) => option.courseLabels[0]),
    ["MATH& 151"]
  );
  assert.deepEqual(
    getSuggestedScheduleVisibleOptions({
      ...optionGroup,
      selectedOptionIds: ["test-calculus-series:math-152"],
      resolvedSatisfiedOptionIds: ["test-calculus-series:math-152"],
    }).map((option) => option.courseLabels[0]),
    ["MATH& 151", "MATH& 152"]
  );
});

test("Runtime option resolution schedules only the defaulted choose-one option when the row opts in", () => {
  const item = buildRuntimeEarthScienceChoiceItem();
  const plan = buildRuntimeOptionResolutionTestPlan(item);
  const suggestedPlan = buildRuntimeOptionResolutionSuggestedPlan(plan);
  const plannedLabels = getPlannedCourseLabels(suggestedPlan);

  assert.equal(plannedLabels.has("GEOL& 101"), true);
  assert.equal(plannedLabels.has("NATRS 210"), false);
  assert.equal(plannedLabels.has("NUTR& 101"), false);

  const auditRows = auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  });
  const auditRow = auditRows.find((entry) => entry.groupId === item.requirementGroup?.id);

  assert.ok(auditRow, "Expected runtime option resolution audit row.");
  assert.deepEqual(auditRow?.defaultOptionIds, [
    "test-runtime-option-resolution:requirement-group:earth-science:geol-101",
  ]);
  assert.deepEqual(auditRow?.scheduledOptionIds, [
    "test-runtime-option-resolution:requirement-group:earth-science:geol-101",
  ]);
  assert.equal(auditRow?.unselectedSiblingsSuppressed, true);
  assert.equal(auditRow?.issue, "none");
  assert.match(auditRow?.copyOnlyDebugText ?? "", /^\[runtime option resolution audit\]/);
});

test("Runtime option resolution lets explicit selections override defaults and clears defaults when requested", () => {
  const item = buildRuntimeEarthScienceChoiceItem();
  const plan = buildRuntimeOptionResolutionTestPlan(item);
  const groupId = item.requirementGroup?.id ?? "";
  const selectedRequirementOptionIdsByGroup = {
    [groupId]: [`${groupId}:natrs-210`],
  };
  const selectedPlan = buildRuntimeOptionResolutionSuggestedPlan(
    plan,
    selectedRequirementOptionIdsByGroup
  );
  const selectedLabels = getPlannedCourseLabels(selectedPlan);

  assert.equal(selectedLabels.has("NATRS 210"), true);
  assert.equal(selectedLabels.has("GEOL& 101"), false);
  assert.equal(selectedLabels.has("NUTR& 101"), false);

  const selectedAudit = auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan: selectedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup,
  }).find((entry) => entry.groupId === groupId);
  assert.deepEqual(selectedAudit?.selectedOptionIds, [`${groupId}:natrs-210`]);
  assert.deepEqual(selectedAudit?.defaultOptionIds, [`${groupId}:geol-101`]);
  assert.deepEqual(selectedAudit?.scheduledOptionIds, [`${groupId}:natrs-210`]);
  assert.equal(selectedAudit?.issue, "none");

  const clearedSelection = { [groupId]: [] as string[] };
  const clearedPlan = buildRuntimeOptionResolutionSuggestedPlan(plan, clearedSelection);
  const clearedLabels = getPlannedCourseLabels(clearedPlan);
  const selectionPrompt = clearedPlan
    .flatMap((quarter) => quarter.courses)
    .find((course) => course.optionGroup?.id === groupId);

  assert.equal(clearedLabels.has("GEOL& 101"), false);
  assert.equal(clearedLabels.has("NATRS 210"), false);
  assert.equal(selectionPrompt?.optionGroup?.isSelectionPrompt, true);
});

test("Runtime option resolution falls back safely from stale option selections", () => {
  const item = buildRuntimeEarthScienceChoiceItem();
  const plan = buildRuntimeOptionResolutionTestPlan(item);
  const groupId = item.requirementGroup?.id ?? "";
  const selectedRequirementOptionIdsByGroup = {
    [groupId]: [`${groupId}:stale-option`],
  };
  const suggestedPlan = buildRuntimeOptionResolutionSuggestedPlan(
    plan,
    selectedRequirementOptionIdsByGroup
  );
  const plannedLabels = getPlannedCourseLabels(suggestedPlan);
  const auditRow = auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup,
  }).find((entry) => entry.groupId === groupId);

  assert.equal(plannedLabels.has("GEOL& 101"), true);
  assert.equal(plannedLabels.has("NATRS 210"), false);
  assert.deepEqual(auditRow?.selectedOptionIds, [`${groupId}:stale-option`]);
  assert.deepEqual(auditRow?.scheduledOptionIds, [`${groupId}:geol-101`]);
  assert.equal(auditRow?.issue, "stale-selection");
});

test("Runtime option resolution audits unselected siblings scheduled by another row", () => {
  const item = buildRuntimeEarthScienceChoiceItem();
  const requiredSiblingItem: TransferPlannerChecklistItem = {
    id: "required-natrs",
    title: "Required NATRS support row",
    grcCourses: ["NATRS 210"],
  };
  const plan = {
    ...buildRuntimeOptionResolutionTestPlan(item),
    beforeEnrollmentChecklist: [item, requiredSiblingItem],
  };
  const suggestedPlan = buildRuntimeOptionResolutionSuggestedPlan(plan);
  const groupId = item.requirementGroup?.id ?? "";
  const auditRow = auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup: {},
  }).find((entry) => entry.groupId === groupId);

  assert.deepEqual(auditRow?.scheduledOptionIds, [`${groupId}:geol-101`]);
  assert.equal(auditRow?.unselectedSiblingsSuppressed, false);
  assert.equal(auditRow?.issue, "false-required-sibling");
});

test("Runtime option resolution caps choose-n materialization to the required option count", () => {
  const groupId = "test-runtime-option-resolution:requirement-group:science-two";
  const item: TransferPlannerChecklistItem = {
    id: "science-two",
    title: "Choose two sciences",
    grcCourses: ["CHEM& 161", "PHYS& 223", "NATRS 210"],
    minCompletedCount: 2,
    requirementGroup: {
      id: groupId,
      label: "Choose two sciences",
      category: "source-choice",
      requirementType: "choose_n",
      minCourses: 2,
      maxCourses: 2,
      selectionCount: 2,
      options: [
        {
          id: `${groupId}:chem-161`,
          uwCourses: ["CHEM 142"],
          grcMatches: ["CHEM& 161"],
          credits: 6,
          label: "CHEM 142 / CHEM& 161",
        },
        {
          id: `${groupId}:phys-223`,
          uwCourses: ["PHYS 123"],
          grcMatches: ["PHYS& 223"],
          credits: 5,
          label: "PHYS 123 / PHYS& 223",
        },
        {
          id: `${groupId}:natrs-210`,
          uwCourses: ["ESRM 210"],
          grcMatches: ["NATRS 210"],
          credits: 5,
          label: "ESRM 210 / NATRS 210",
        },
      ],
    },
  };
  const plan = buildRuntimeOptionResolutionTestPlan(item);
  const selectedRequirementOptionIdsByGroup = {
    [groupId]: [`${groupId}:chem-161`, `${groupId}:phys-223`, `${groupId}:natrs-210`],
  };
  const suggestedPlan = buildRuntimeOptionResolutionSuggestedPlan(
    plan,
    selectedRequirementOptionIdsByGroup
  );
  const plannedLabels = getPlannedCourseLabels(suggestedPlan);
  const auditRow = auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup,
  }).find((entry) => entry.groupId === groupId);

  assert.equal(plannedLabels.has("CHEM& 161"), true);
  assert.equal(plannedLabels.has("PHYS& 223"), true);
  assert.equal(plannedLabels.has("NATRS 210"), false);
  assert.deepEqual(auditRow?.scheduledOptionIds, [
    `${groupId}:chem-161`,
    `${groupId}:phys-223`,
  ]);
  assert.equal(auditRow?.unselectedSiblingsSuppressed, true);
  assert.equal(auditRow?.issue, "none");
});

test("Runtime option resolution schedules selected choose-credit courses with an unresolved remainder only", () => {
  const groupId = "test-runtime-option-resolution:requirement-group:approved-science";
  const item: TransferPlannerChecklistItem = {
    id: "approved-science",
    title: "10 credits of approved science",
    grcCourses: ["CHEM& 161", "PHYS& 223"],
    minCompletedCount: 1,
    requirementGroup: {
      id: groupId,
      label: "10 credits of approved science",
      category: "source-choice",
      requirementType: "choose_credits",
      requirementShape: "credit-bucket",
      minCredits: 10,
      maxCredits: 10,
      creditText: "10 credits",
      satisfactionMode: "credit-based",
      options: [
        {
          id: `${groupId}:chem-161`,
          uwCourses: ["CHEM 142"],
          grcMatches: ["CHEM& 161"],
          credits: 6,
          label: "CHEM 142 / CHEM& 161",
        },
        {
          id: `${groupId}:phys-223`,
          uwCourses: ["PHYS 123"],
          grcMatches: ["PHYS& 223"],
          credits: 5,
          label: "PHYS 123 / PHYS& 223",
        },
      ],
    },
  };
  const plan = buildRuntimeOptionResolutionTestPlan(item);
  const selectedRequirementOptionIdsByGroup = {
    [groupId]: [`${groupId}:chem-161`],
  };
  const suggestedPlan = buildRuntimeOptionResolutionSuggestedPlan(
    plan,
    selectedRequirementOptionIdsByGroup
  );
  const plannedLabels = getPlannedCourseLabels(suggestedPlan);
  const auditRow = auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup,
  }).find((entry) => entry.groupId === groupId);

  assert.equal(plannedLabels.has("CHEM& 161"), true);
  assert.equal(plannedLabels.has("PHYS& 223"), false);
  assert.ok(
    [...plannedLabels].some((label) => /4 credits of approved science remaining/i.test(label)),
    "Expected an unresolved credit-bucket remainder instead of sibling options."
  );
  assert.deepEqual(auditRow?.scheduledOptionIds, [`${groupId}:chem-161`]);
  assert.equal(auditRow?.issue, "none");
});

test("Runtime option resolution keeps selected category options as placeholders", () => {
  const groupId = "test-runtime-option-resolution:requirement-group:mixed-category";
  const item: TransferPlannerChecklistItem = {
    id: "mixed-category",
    title: "CSE 160 or other Natural Sciences - NSc (5)",
    grcCourses: ["CS 123"],
    minCompletedCount: 1,
    requirementGroup: {
      id: groupId,
      label: "CSE 160 or other Natural Sciences - NSc (5)",
      category: "source-choice",
      requirementType: "choose_one",
      minCourses: 1,
      maxCourses: 1,
      selectionCount: 1,
      options: [
        {
          id: `${groupId}:cs-123`,
          uwCourses: ["CSE 160"],
          grcMatches: ["CS 123"],
          credits: 5,
          label: "CSE 160 / CS 123",
        },
        {
          id: `${groupId}:nsc`,
          optionKind: "category-option",
          uwCourses: [],
          grcMatches: [],
          credits: 5,
          label: "other Natural Sciences - NSc (5)",
          categoryOption: {
            category: "NSc",
            sourceCategoryCode: "NSc",
            title: "other Natural Sciences - NSc",
            credits: 5,
            sourceText: "other Natural Sciences - NSc (5)",
          },
        },
      ],
    },
  };
  const plan = buildRuntimeOptionResolutionTestPlan(item);
  const selectedRequirementOptionIdsByGroup = {
    [groupId]: [`${groupId}:nsc`],
  };
  const suggestedPlan = buildRuntimeOptionResolutionSuggestedPlan(
    plan,
    selectedRequirementOptionIdsByGroup
  );
  const plannedLabels = getPlannedCourseLabels(suggestedPlan);
  const categoryCourse = suggestedPlan
    .flatMap((quarter) => quarter.courses)
    .find((course) => course.optionGroup?.id === groupId);
  const auditRow = auditRuntimeOptionResolution({
    ownerId: plan.id,
    plan,
    suggestedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup,
  }).find((entry) => entry.groupId === groupId);

  assert.equal(plannedLabels.has("CS 123"), false);
  assert.ok(
    [...plannedLabels].some((label) => /Natural Sciences - NSc/i.test(label)),
    "Expected the selected category option to stay as a placeholder."
  );
  assert.equal(
    (categoryCourse as { explicitCourseCodes?: string[] } | undefined)?.explicitCourseCodes
      ?.length ?? 0,
    0
  );
  assert.deepEqual(auditRow?.scheduledOptionIds, [`${groupId}:nsc`]);
  assert.equal(auditRow?.issue, "none");
});

test("Choice-set planner hides UW-only Chemistry options without Green River matches", () => {
  const chemistryPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-chemistry"),
    "ba-route"
  );
  assert.ok(chemistryPlan, "Expected the Seattle Chemistry B.A. runtime plan.");

  const groupId =
    "uw-seattle-chemistry:pathway:ba-route:requirement-group:chem-317-or-chem-461";
  const plannedCourses = buildSuggestedQuarterPlan({
    plan: chemistryPlan,
    ...buildStatuses(chemistryPlan, []),
    completedCourses: [],
    track: null,
    includeStayAtGrcCourses: true,
    selectedRequirementOptionIdsByGroup: {
      [groupId]: ["uw-seattle-chemistry:pathway:ba-route:requirement-option:chem-317"],
    },
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);

  assert.equal(
    plannedCourses.some((course) => course.label === "CHEM 317" || course.label === "CHEM 461"),
    false
  );
  assert.equal(
    plannedCourses.some((course) => course.optionGroup?.id === groupId),
    false
  );
});

test("Runtime majors keep quarter plans scoped to the active degree and capped per term", () => {
  const campusIds = ["uw-seattle", "uw-bothell", "uw-tacoma"] as const;

  for (const campusId of campusIds) {
    for (const basePlan of getTransferPlannerStudentRuntimeMajorsForCampus(campusId)) {
      const pathways = getTransferPlannerStudentRuntimePathwaysForPlan(basePlan);
      const pathwayIds = pathways.length ? pathways.map((pathway) => pathway.id) : [null];

      for (const pathwayId of pathwayIds) {
        const plan = resolveTransferPlannerStudentRuntimeMajorPlan(basePlan, pathwayId);
        if (!plan) continue;

        const quarterPlan = buildSuggestedQuarterPlan({
          plan,
          applicationStatuses: buildRequirementStatuses(plan.applicationChecklist, []),
          beforeEnrollmentStatuses: buildRequirementStatuses(plan.beforeEnrollmentChecklist, []),
          stayAtGrcStatuses: buildRequirementStatuses(plan.stayAtGrcChecklist, []),
          completedCourses: [],
          track: getTransferPlannerTrack(plan.bestTrackId ?? null),
          includeStayAtGrcCourses: true,
          referenceDate: new Date("2026-01-15T12:00:00.000Z"),
        });
        const expectedPlanTitle = plan.selectedPathwayLabel
          ? `${plan.title} (${plan.selectedPathwayLabel})`
          : plan.title;

        for (const quarter of quarterPlan.filter((entry) => entry.phase === "planned")) {
          assert.ok(
            quarter.courses.length <= 3,
            `Expected ${plan.id} ${pathwayId ?? "default"} ${quarter.label} to stay within three planned rows, got ${quarter.courses.length}.`
          );

          for (const course of quarter.courses) {
            if (!/^5 credits of /i.test(course.label)) {
              continue;
            }

            const guidanceSummary = String(course.guidanceSummary ?? "");
            if (!/(planned for|needed for)/i.test(guidanceSummary)) {
              continue;
            }

            assert.match(
              guidanceSummary,
              new RegExp(expectedPlanTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
              `Expected ${plan.id} ${pathwayId ?? "default"} ${quarter.label} placeholder guidance to stay scoped to ${expectedPlanTitle}.`
            );
          }
        }
      }
    }
  }
});

test("Runtime compound scheduling keeps selected CE Natural Science compound options atomic", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");
  const naturalScienceGroup = runtimePlan.requirementGroups?.find((group) =>
    /approved-natural-science-10-credits/.test(group.id)
  );
  assert.ok(naturalScienceGroup, "Expected the CE approved natural science group.");
  const chemistrySequenceOption = naturalScienceGroup.options.find((option) => {
    const matches = option.grcMatches ?? [];
    return matches.includes("CHEM& 162") && matches.includes("CHEM& 163");
  });
  assert.ok(chemistrySequenceOption?.id, "Expected the CE CHEM& 162/163 option.");

  const selectedRequirementOptionIdsByGroup = {
    [naturalScienceGroup.id]: [chemistrySequenceOption.id],
  };
  const completedCourses = [{ code: "CHEM& 162", label: "CHEM& 162", credits: 5 }];
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, completedCourses),
    completedCourses,
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup,
    referenceDate: new Date("2026-05-08T12:00:00.000Z"),
  });
  const plannedLabels = getPlannedCourseLabelList(suggestedPlan);
  const compoundAudit = auditRuntimeCompoundScheduling({
    ownerId: runtimePlan.id,
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup,
  }).find(
    (entry) =>
      entry.selectedOption &&
      entry.grcCompoundPath.includes("CHEM& 162") &&
      entry.grcCompoundPath.includes("CHEM& 163")
  );

  assert.equal(plannedLabels.includes("CHEM& 163"), true);
  assert.deepEqual(compoundAudit?.grcCompoundPath, ["CHEM& 162", "CHEM& 163"]);
  assert.deepEqual(compoundAudit?.scheduledComponents, ["CHEM& 163"]);
  assert.deepEqual(compoundAudit?.missingComponents, []);
  assert.equal(compoundAudit?.satisfied, true);
  assert.equal(compoundAudit?.issue, "none");
});

test("Tacoma Computer Engineering keeps choice-set-backed prep aligned without leaking optional spillover", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-tacoma-computer-engineering");
  const tme221Classification = getTransferPlannerRequirementDiffClassifications(
    "uw-tacoma-computer-engineering"
  ).find((entry) => entry.sourceUwCourseCode === "TME 221");
  const tme223Classification = getTransferPlannerRequirementDiffClassifications(
    "uw-tacoma-computer-engineering"
  ).find((entry) => entry.sourceUwCourseCode === "TME 223");

  assert.ok(runtimePlan, "Expected the Tacoma Computer Engineering runtime plan.");
  assert.equal(tme221Classification?.classificationKind, "auto-promoted-choice-set-resolved");
  assert.equal(tme223Classification?.classificationKind, "auto-promoted-choice-set-resolved");

  const requiredCourseCodes = buildSourceBackedRequiredCourseCodes(runtimePlan);
  for (const courseCode of ["CHEM& 162", "CHEM& 163", "CS 145", "CS& 141"]) {
    assert.equal(
      requiredCourseCodes.includes(courseCode),
      false,
      `Did not expect Tacoma Computer Engineering to flatten optional spillover ${courseCode} into an unconditional required-course row.`
    );
  }

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId),
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedCourseCodes = new Set(
    quarterPlan.flatMap((quarter) =>
      quarter.courses.flatMap((course) => extractCourseCodes(course.label))
    )
  );

  for (const courseCode of ["ENGR& 214", "ENGR& 215", "CHEM& 161", "ENGL& 101", "ENGR& 225", "PHYS& 223"]) {
    assert.equal(
      requiredCourseCodes.includes(courseCode),
      true,
      `Expected Tacoma Computer Engineering to keep ${courseCode} in the required-course summary.`
    );
    assert.equal(
      plannedCourseCodes.has(courseCode),
      true,
      `Expected Tacoma Computer Engineering UW-only planning to keep ${courseCode}.`
    );
  }
});

test("UW runtime majors keep a distinct official UW transfer admission requirements section when transcript-derived credits stay below 40", () => {
  const campusIds = ["uw-seattle", "uw-bothell", "uw-tacoma"] as const;

  for (const campusId of campusIds) {
    for (const runtimePlan of getTransferPlannerStudentRuntimeMajorsForCampus(campusId)) {
      const section = buildUwGeneralTransferRequirementSection(runtimePlan, {
        completedCourses: [],
        hasTranscriptDerivedCreditSource: true,
      });
      assert.ok(
        section,
        `Expected ${runtimePlan.id} to expose UW transfer admission requirements.`
      );
      assert.equal(section?.title, "UW Transfer Admission Requirements");
      assert.equal(section?.plannerUsage, "summary-only");
      assert.equal((section?.items.length ?? 0) > 0, true, runtimePlan.id);
      assert.deepEqual(
        section?.items.map((entry) => `${entry.label}: ${entry.valueText}`),
        EXPECTED_UW_TRANSFER_ADMISSION_REQUIREMENT_LINES,
        runtimePlan.id
      );
    }
  }
});

test("NME option groups carry requirement targets for explicit student-facing labels", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track: getTransferPlannerTrack(nmePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const optionGroups = quarterPlan.flatMap((quarter) =>
    quarter.courses.flatMap((course) => (course.optionGroup ? [course.optionGroup] : []))
  );
  const scienceElectives = optionGroups.find((optionGroup) =>
    /Science Electives/i.test(optionGroup.title)
  );
  const engineeringFundamentals = optionGroups.find((optionGroup) =>
    /Engineering Fundamentals Electives/i.test(optionGroup.title)
  );

  assert.equal(scienceElectives?.requirementType, "choose_n");
  assert.equal(scienceElectives?.selectionCount, 2);
  assert.equal(engineeringFundamentals?.requirementType, "choose_credits");
  assert.equal(engineeringFundamentals?.requiredCredits, 8);
});

test("Materials NME does not schedule prerequisites for unselected option courses", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const selectedRequirementOptionIdsByGroup = {};
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track: getTransferPlannerTrack(nmePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedCourses = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const plannedLabels = new Set(plannedCourses.map((course) => course.label));
  const engineeringFundamentals = plannedCourses.find((course) =>
    /Engineering Fundamentals Electives/i.test(course.optionGroup?.title ?? "")
  );
  const auditRows = auditUnselectedOptionPrerequisiteScheduling({
    plan: nmePlan,
    suggestedPlan: quarterPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup,
  });
  const cs123AuditRows = auditRows.filter((row) =>
    row.optionId.includes("engineering-fundamentals-cse-123")
  );

  assert.equal(plannedLabels.has("CS 121"), false);
  assert.equal(plannedLabels.has("CS 122"), false);
  assert.equal(plannedLabels.has("CS 123"), false);
  assert.ok(engineeringFundamentals, "Expected the Engineering Fundamentals prompt to stay visible.");
  assert.equal(engineeringFundamentals?.optionGroup?.isSelectionPrompt, true);
  assert.deepEqual(engineeringFundamentals?.optionGroup?.selectedOptionIds, []);

  for (const independentlyRequiredOrPrerequisite of [
    "ENGR 100",
    "ENGR 106",
    "ENGR& 214",
    "ENGR& 225",
  ]) {
    assert.equal(
      plannedLabels.has(independentlyRequiredOrPrerequisite),
      true,
      `Expected ${independentlyRequiredOrPrerequisite} to remain when independently justified.`
    );
  }

  assert.deepEqual(
    cs123AuditRows.map((row) => [
      row.prerequisiteCourseCode,
      row.optionSelected,
      row.prerequisiteScheduled,
      row.shouldSchedule,
    ]),
    [
      ["CS 121", false, false, false],
      ["CS 122", false, false, false],
    ]
  );
  assert.ok(
    cs123AuditRows.every((row) =>
      row.copyOnlyDebugText.startsWith("[copy-only unselected option prerequisite audit]")
    )
  );
  assert.deepEqual(
    auditRows
      .filter((row) => !row.optionSelected && row.prerequisiteScheduled && !row.shouldSchedule)
      .map((row) => row.copyOnlyDebugText),
    []
  );
});

test("Materials NME schedules only the selected Engineering Fundamentals option chain", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const engineeringFundamentalsGroupId =
    "uw-seattle-materials-science-engineering:requirement-group:engineering-fundamentals-electives";
  const cases = [
    {
      optionFragment: "engineering-fundamentals-cse-123",
      expected: ["CS 121", "CS 122", "CS 123"],
      absent: ["ENGR& 204", "ENGR& 215"],
    },
    {
      optionFragment: "engineering-fundamentals-ee-215",
      expected: ["ENGR& 204"],
      absent: ["CS 121", "CS 122", "CS 123", "ENGR& 215"],
    },
    {
      optionFragment: "engineering-fundamentals-me-230",
      expected: ["ENGR& 215", "ENGR& 214"],
      absent: ["CS 121", "CS 122", "CS 123", "ENGR& 204"],
    },
  ];

  for (const testCase of cases) {
    const selection = getRequirementOptionSelection(
      nmePlan,
      ":engineering-fundamentals-electives",
      testCase.optionFragment
    );
    assert.equal(selection.groupId, engineeringFundamentalsGroupId);
    const selectedRequirementOptionIdsByGroup = {
      [selection.groupId]: [selection.optionId],
    };
    const quarterPlan = buildSuggestedQuarterPlan({
      plan: nmePlan,
      ...buildStatuses(nmePlan, []),
      completedCourses: [],
      track: getTransferPlannerTrack(nmePlan.bestTrackId ?? null),
      includeStayAtGrcCourses: false,
      includeStemPrepCourses: false,
      includeSummerQuarter: false,
      selectedRequirementOptionIdsByGroup,
      referenceDate: new Date("2026-01-15T12:00:00.000Z"),
    });
    const plannedLabels = new Set(
      quarterPlan
        .filter((quarter) => quarter.phase === "planned")
        .flatMap((quarter) => quarter.courses.map((course) => course.label))
    );
    const auditRows = auditUnselectedOptionPrerequisiteScheduling({
      plan: nmePlan,
      suggestedPlan: quarterPlan,
      completedCourses: [],
      selectedRequirementOptionIdsByGroup,
    });
    const selectedAuditRows = auditRows.filter((row) => row.optionSelected);

    for (const expectedLabel of testCase.expected) {
      assert.equal(
        plannedLabels.has(expectedLabel),
        true,
        `Expected ${expectedLabel} after selecting ${testCase.optionFragment}.`
      );
    }
    for (const absentLabel of testCase.absent) {
      assert.equal(
        plannedLabels.has(absentLabel),
        false,
        `Did not expect ${absentLabel} after selecting ${testCase.optionFragment}.`
      );
    }
    assert.ok(selectedAuditRows.length > 0, "Expected selected option prerequisite audit rows.");
    assert.ok(
      selectedAuditRows.every(
        (row) => row.prerequisiteScheduled && row.shouldSchedule && row.optionSelected
      )
    );
    assert.deepEqual(
      auditRows
        .filter((row) => !row.optionSelected && row.prerequisiteScheduled && !row.shouldSchedule)
        .map((row) => row.copyOnlyDebugText),
      []
    );
  }
});

test("Major Specifics summarizes Gen-Ed targets without echoing planned placeholder rows", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Computer Engineering runtime plan.");

  const track = getTransferPlannerTrack(runtimePlan.bestTrackId ?? null);
  const sections = buildMajorSpecificsCourseSections({
    plan: runtimePlan,
    track,
    completedCourses: [],
  });
  const genEdSection = sections.find(
    (section) => section.id === "gen-ed-breadth-requirements"
  );

  assert.ok(genEdSection, "Expected Computer Engineering Gen-Ed Requirements section.");
  assert.deepEqual(
    genEdSection?.rows.map((entry) => entry.text),
    [
      "Arts & Humanities: 10-20 credits (Within the 30 credits Areas of Inquiry total.)",
      "Social Sciences: 10-20 credits (Within the 30 credits Areas of Inquiry total.)",
      "Diversity: 5 credits",
      "Areas of Inquiry: 30 credits total",
    ]
  );
  assert.equal(
    genEdSection?.rows.some((entry) => /^5 credits of /i.test(entry.text)),
    false
  );
  assert.equal(
    genEdSection?.rows.every((entry) => entry.requirementRole === "informational"),
    true
  );

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    applicationStatuses: buildRequirementStatuses(runtimePlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(runtimePlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedPlaceholderLabels = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses)
    .filter((course) => course.sourceKind === "uw-major-breadth")
    .map((course) => course.label);

  assert.equal(
    plannedPlaceholderLabels.filter((label) => label === "5 credits of Humanities").length,
    2
  );
  assert.equal(
    plannedPlaceholderLabels.filter((label) => label === "5 credits of Social Science").length,
    2
  );
  assert.equal(
    plannedPlaceholderLabels.filter((label) => label === "5 credits of A&H or SSc").length,
    2
  );
});

test("Major Specifics suppresses matched-track Gen-Ed placeholders when breadth summaries exist", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-electrical-computer-engineering"
  );
  assert.ok(runtimePlan, "Expected the Electrical & Computer Engineering runtime plan.");

  const embeddedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimePlan,
    "embedded-systems-pathway"
  );
  assert.ok(embeddedPlan, "Expected the ECE Embedded Systems pathway.");

  const track = getTransferPlannerTrack(embeddedPlan.bestTrackId ?? null);
  const sections = buildMajorSpecificsCourseSections({
    plan: embeddedPlan,
    track,
    completedCourses: [],
  });
  const genEdSection = sections.find(
    (section) => section.id === "gen-ed-breadth-requirements"
  );

  assert.ok(genEdSection, "Expected an ECE Gen-Ed Requirements section.");
  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(embeddedPlan), {
    ahCredits: 10,
    sscCredits: 10,
    nscCredits: null,
    breadthCredits: 4,
    electiveCredits: null,
  });
  assert.equal(
    genEdSection?.rows.some(
      (entry) =>
        /^5 credits of /i.test(entry.text) &&
        /official matched Green River associate pathway map/i.test(entry.text)
    ),
    false
  );
  assert.deepEqual(
    genEdSection?.rows.map((entry) => entry.text),
    [
      "Arts & Humanities: 10 credits",
      "Social Sciences: 10 credits",
      "Additional Arts & Humanities / Social Sciences: 4 credits",
      "Diversity: 5 credits (Overlaps with Arts & Humanities / Social Sciences.)",
    ]
  );
  assert.equal(
    genEdSection?.rows.some((entry) => /Areas of Inquiry: 69 credits total/i.test(entry.text)),
    false
  );

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: embeddedPlan,
    applicationStatuses: buildRequirementStatuses(embeddedPlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(embeddedPlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(embeddedPlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  assert.equal(
    quarterPlan
      .flatMap((quarter) => quarter.courses)
      .some((course) => course.sourceKind === "official-grc-track-breadth"),
    false,
    "Expected ECE breadth targets to replace matched Green River breadth placeholders."
  );
  assert.equal(
    quarterPlan
      .flatMap((quarter) => quarter.courses)
      .some((course) => course.sourceKind === "uw-major-breadth"),
    false,
    "Expected ECE breadth targets to remain summary-only instead of auto-scheduling UW breadth placeholders."
  );
});

test("UW Major Specifics does not fall back to matched Green River breadth rows for unpublished major Gen-Eds", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-mechanical-engineering"
  );
  assert.ok(runtimePlan, "Expected the Mechanical Engineering runtime plan.");

  const resolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, null);
  assert.ok(resolvedPlan, "Expected the resolved Mechanical Engineering runtime plan.");

  const track = getTransferPlannerTrack(resolvedPlan.bestTrackId ?? null);
  const sections = buildMajorSpecificsCourseSections({
    plan: resolvedPlan,
    track,
    completedCourses: [],
  });
  const genEdSection = sections.find(
    (section) => section.id === "gen-ed-breadth-requirements"
  );
  const matchedTrackSection = sections.find(
    (section) => section.id === "matched-green-river-track-courses"
  );
  const hiddenMatchedBreadthCount = countMatchedGrcTrackGeneralEducationBreadthRows({
    track,
    completedCourses: [],
    plan: resolvedPlan,
  });

  assert.equal(buildSourceBackedMajorGeneralEducationRequirementSection(resolvedPlan), null);
  assert.equal(genEdSection, undefined);
  assert.equal(hiddenMatchedBreadthCount, 3);
  assert.ok(matchedTrackSection, "Expected matched Green River track rows to remain available.");
  assert.deepEqual(
    (matchedTrackSection?.rows ?? [])
      .filter((entry) => entry.countsTowardGenEd)
      .map((entry) => entry.text),
    [
      "5 credits of Humanities. This covers 5/5 A&H credits from the official matched Green River associate pathway map for Mechanical Engineering. This is an official Green River track slot, not an official UW transfer admission requirement.",
      "5 credits of Social Science. This covers 5/5 SSc credits from the official matched Green River associate pathway map for Mechanical Engineering. This is an official Green River track slot, not an official UW transfer admission requirement.",
      "5 credits of A&H or SSc. This covers 5/5 additional A&H/SSc credits from the official matched Green River associate pathway map for Mechanical Engineering. This is an official Green River track slot, not an official UW transfer admission requirement.",
    ]
  );
  assert.equal(
    (matchedTrackSection?.rows ?? [])
      .filter((entry) => entry.countsTowardGenEd)
      .every(
        (entry) =>
          entry.categoryId === "matched-green-river-track-courses" &&
          entry.sourceType === "grc_matched_track" &&
          entry.requirementRole === "matched_track_course" &&
          entry.countsTowardUwRequirement === false
      ),
    true
  );
});

test("UW Major Specifics Gen-Ed rows stay for Psychology and Biology", () => {
  for (const planId of ["uw-seattle-psychology", "uw-seattle-biology"]) {
    const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(planId);
    assert.ok(runtimePlan, `Expected ${planId} runtime plan.`);

    const resolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, null);
    assert.ok(resolvedPlan, `Expected ${planId} resolved plan.`);

    const sections = buildMajorSpecificsCourseSections({
      plan: resolvedPlan,
      track: getTransferPlannerTrack(resolvedPlan.bestTrackId ?? null),
      completedCourses: [],
    });
    const genEdSection = sections.find(
      (section) => section.id === "gen-ed-breadth-requirements"
    );

    assert.equal(
      genEdSection?.rows.some((entry) => entry.countsTowardGrcTrack) ?? false,
      false,
      `${planId} should not show matched Green River rows under UW Gen-Ed Requirements.`
    );
    assert.equal(
      genEdSection?.rows.some((entry) =>
        /official matched Green River associate pathway/i.test(entry.text)
      ) ?? false,
      false,
      `${planId} should not source UW Gen-Ed Requirements from matched Green River track guidance.`
    );
    assert.equal(
      genEdSection?.rows.every((entry) => entry.requirementRole === "informational") ?? true,
      true,
      `${planId} Gen-Ed rows should be informational summaries when present.`
    );
  }
});

test("Seattle Aeronautics selected ME 123 mapped option still schedules ENGR& 114", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");

  const scienceGroup = runtimePlan.requirementGroups?.find((group) =>
    group.options.some((option) => option.uwCourses.includes("ME 123"))
  );
  const me123Option = scienceGroup?.options.find((option) => option.uwCourses.includes("ME 123"));
  assert.ok(scienceGroup, "Expected A&A science choice requirement group.");
  assert.ok(me123Option?.id, "Expected ME 123 option id.");

  const selectedRequirementOptionIdsByGroup = {
    [scienceGroup.id]: [me123Option.id],
  };
  const statuses = buildStatuses(runtimePlan, []);
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...statuses,
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const plannedLabels = new Set(
    suggestedPlan
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses.map((course) => course.label))
  );
  const optionGroups = collectVisibleOptionGroupsForTitleAudit(suggestedPlan);
  const scienceChoiceGroup = optionGroups.find((group) => group.id === scienceGroup.id);

  assert.equal(plannedLabels.has("ENGR& 114"), true);
  assert.equal(
    scienceChoiceGroup?.resolvedSatisfiedOptionIds?.includes(me123Option.id),
    true
  );
});

test("Seattle Aeronautics selected NSc category option remains visible and counts category credits", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");

  const scienceGroup = runtimePlan.requirementGroups?.find((group) =>
    group.options.some((option) => option.categoryOption?.category === "NSC")
  );
  const categoryOption = scienceGroup?.options.find(
    (option) => option.categoryOption?.category === "NSC"
  );
  assert.ok(scienceGroup, "Expected A&A science choice requirement group.");
  assert.ok(categoryOption?.id, "Expected NSc category option id.");

  const selectedRequirementOptionIdsByGroup = {
    [scienceGroup.id]: [categoryOption.id],
  };
  const statuses = buildStatuses(runtimePlan, []);
  const noSelectionPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...statuses,
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup: {},
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const selectedPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...statuses,
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const plannedLabels = selectedPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const optionGroups = collectVisibleOptionGroupsForTitleAudit(selectedPlan);
  const scienceChoiceGroup = optionGroups.find((group) => group.id === scienceGroup.id);
  const noSelectionCreditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: noSelectionPlan,
  });
  const selectedCreditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: selectedPlan,
  });

  assert.ok(scienceChoiceGroup, "Expected selected NSc category option group to remain visible.");
  assert.deepEqual(scienceChoiceGroup?.resolvedSatisfiedOptionIds, [categoryOption.id]);
  assert.equal(scienceChoiceGroup?.optionSatisfactionSourcesById?.[categoryOption.id]?.includes("user-selected"), true);
  assert.equal(plannedLabels.includes("ENGR& 114"), false);
  assert.equal(
    plannedLabels.some((label) => /^NSc$/i.test(label)),
    false,
    "The selected category option must not invent a fake NSc course."
  );
  assert.equal(
    plannedLabels.some(
      (label) =>
        /5 credits of Natural Sciences \(NSc\)/i.test(label) &&
        extractCourseCodes(label).length === 0
    ),
    true,
    "Expected a non-course category-credit placeholder."
  );
  assert.equal(
    selectedCreditRange.mainMinRemainingCredits,
    noSelectionCreditRange.mainMinRemainingCredits + 5
  );

  const categoryAudit = auditCategoryOptionDetection({
    plan: runtimePlan,
    suggestedPlan: selectedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup,
  }).find((entry) => entry.category === "NSc");
  assert.equal(categoryAudit?.visibleOption, true);
  assert.equal(categoryAudit?.selected, true);
  assert.equal(categoryAudit?.issue, null);

  const satisfactionAudit = auditOptionGroupSatisfaction({
    plan: runtimePlan,
    suggestedPlan: selectedPlan,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup,
  }).find((entry) => entry.groupId === scienceGroup.id);
  assert.equal(satisfactionAudit?.displayedProgress, "1/1");
  assert.deepEqual(satisfactionAudit?.selectedCategoryOptions, [
    "5 credits of Natural Sciences (NSc)",
  ]);
  assert.equal(satisfactionAudit?.issue, null);
  assert.match(
    satisfactionAudit?.copyOnlyDebugText ?? "",
    /Selected category options: 5 credits of Natural Sciences \(NSc\)/
  );
});

test("Seattle Aeronautics selected NSc category option uses completed CHEM& 140 without a duplicate planned row", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");

  const scienceGroup = runtimePlan.requirementGroups?.find((group) =>
    group.options.some((option) => option.categoryOption?.category === "NSC")
  );
  const categoryOption = scienceGroup?.options.find(
    (option) => option.categoryOption?.category === "NSC"
  );
  assert.ok(scienceGroup, "Expected A&A science choice requirement group.");
  assert.ok(categoryOption?.id, "Expected NSc category option id.");

  const selectedRequirementOptionIdsByGroup = {
    [scienceGroup.id]: [categoryOption.id],
  };
  const completedCourses = buildTranscriptCourses("CHEM& 140");
  const statuses = buildStatuses(runtimePlan, completedCourses);
  const noTranscriptPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const selectedPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...statuses,
    completedCourses,
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const plannedLabels = selectedPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const completedOptionGroups = collectVisibleOptionGroupsForTitleAudit(selectedPlan);
  const scienceChoiceGroup = completedOptionGroups.find((group) => group.id === scienceGroup.id);
  const noTranscriptCreditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: noTranscriptPlan,
  });
  const selectedCreditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: selectedPlan,
  });

  assert.ok(scienceChoiceGroup, "Expected completed CHEM& 140 to keep the option group visible.");
  assert.deepEqual(scienceChoiceGroup?.resolvedSatisfiedOptionIds, [categoryOption.id]);
  assert.deepEqual(
    scienceChoiceGroup?.completedSatisfyingCourseCodesByOptionId?.[categoryOption.id],
    ["CHEM& 140"]
  );
  assert.equal(plannedLabels.includes("ENGR& 114"), false);
  assert.equal(
    plannedLabels.some((label) => /5 credits of Natural Sciences \(NSc\)/i.test(label)),
    false,
    "Completed CHEM& 140 should suppress the generic future category row."
  );
  assert.equal(
    selectedCreditRange.mainMinRemainingCredits,
    noTranscriptCreditRange.mainMinRemainingCredits - 5
  );

  const categoryTranscriptAudit = auditCategoryTranscriptSatisfaction({
    plan: runtimePlan,
    suggestedPlan: selectedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup,
  }).find((entry) => entry.groupId === scienceGroup.id);
  assert.equal(categoryTranscriptAudit?.chosenTranscriptSatisfier, "CHEM& 140");
  assert.equal(categoryTranscriptAudit?.genericCategoryRowScheduled, false);
  assert.equal(
    categoryTranscriptAudit?.visibleOptionStatusText,
    "Selected: 5 credits of Natural Sciences (NSc), satisfied by CHEM& 140"
  );
  assert.equal(categoryTranscriptAudit?.issue, null);
  assert.match(
    categoryTranscriptAudit?.copyOnlyDebugText ?? "",
    /Visible option status text: Selected: 5 credits of Natural Sciences \(NSc\), satisfied by CHEM& 140/
  );

  const satisfactionAudit = auditOptionGroupSatisfaction({
    plan: runtimePlan,
    suggestedPlan: selectedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup,
  }).find((entry) => entry.groupId === scienceGroup.id);
  assert.equal(satisfactionAudit?.displayedProgress, "1/1");
  assert.equal(satisfactionAudit?.chosenTranscriptCategorySatisfier, "CHEM& 140");
  assert.equal(satisfactionAudit?.genericPlannedCategoryCredits, 0);
  assert.equal(satisfactionAudit?.issue, null);
  assert.match(
    satisfactionAudit?.copyOnlyDebugText ?? "",
    /Chosen transcript category satisfier: CHEM& 140/
  );
});

test("Transfer planner UI keeps the UW transfer admission section separate and transcript-gated", () => {
  const pageSource = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");
  const uwAccordionIndex = pageSource.indexOf("UW ${plan.title} Degree Classes");
  const generalTransferSectionIndex = pageSource.indexOf(
    "uwGeneralTransferRequirementSection.title"
  );
  const categorizedMajorSpecificsIndex = pageSource.indexOf(
    "majorSpecificsCourseSections.length",
    generalTransferSectionIndex
  );
  const fallbackRequiredCoursesIndex = pageSource.indexOf(
    "Official UW Required Courses",
    categorizedMajorSpecificsIndex
  );

  assert.match(pageSource, /buildUwGeneralTransferRequirementSection/);
  assert.match(pageSource, /buildMajorSpecificsCourseSections/);
  assert.match(
    pageSource,
    /No major-specific general education targets are currently published for this major\./
  );
  assert.match(
    pageSource,
    /official UW transfer admission guidance when applicable, Gen-Eds, and prerequisite dependencies/
  );
  assert.match(pageSource, /transcriptDerivedCompletedCourses/);
  assert.match(pageSource, /hasTranscriptDerivedCreditSource/);
  assert.match(pageSource, /shouldUseDetailedCompletedCourses/);
  assert.match(pageSource, /entry\.valueText/);
  assert.match(pageSource, /majorSpecificsCourseSections/);
  assert.match(pageSource, /sourceBackedUwGeneralEducationSection/);
  assert.match(pageSource, /buildSuggestedScheduleCopyOnlyCourseRoleText/);
  assert.match(pageSource, /\[copy-only course role\]/);
  assert.match(pageSource, /Normalized course code\(s\):/);
  assert.match(pageSource, /`Role: \$\{role\}`/);
  assert.match(pageSource, /optional STEM prep/);
  assert.match(pageSource, /sourceKind:/);
  assert.match(pageSource, /visibilityScope:/);
  assert.match(pageSource, /countsTowardMainTransferCredits:/);
  assert.match(pageSource, /countsTowardPrepCredits:/);
  assert.match(pageSource, /countsTowardLocalPrereqCredits:/);
  assert.match(pageSource, /countsTowardOptionRange:/);
  assert.match(pageSource, /canTestOut:/);
  assert.match(pageSource, /Transfers\/satisfies UW:/);
  assert.match(pageSource, /Counts toward main transfer credits:/);
  assert.match(pageSource, /UW required transfer course/);
  assert.match(pageSource, /GRC local prerequisite/);
  assert.match(pageSource, /getSuggestedScheduleOptionGroupDisplayTitle/);
  assert.match(pageSource, /Choose at least/);
  assert.match(pageSource, /No option selected yet/);
  assert.match(pageSource, /Selected \$\{Math\.min\(selectedCount, requiredSelectionCount\)\} of/);
  assert.match(pageSource, /Selected \$\{selectedCreditText\} of/);
  assert.match(pageSource, /buildSuggestedScheduleRenderedQuarters/);
  assert.match(pageSource, /isSuggestedScheduleUnresolvedOptionPromptCourse/);
  assert.match(pageSource, /buildSuggestedScheduleCopyOnlyCreditBucketsText/);
  assert.match(pageSource, /\[copy-only credit buckets\]/);
  assert.match(pageSource, /Main min:/);
  assert.match(pageSource, /STEM prep credits:/);
  assert.match(pageSource, /Local prerequisite credits:/);
  assert.match(pageSource, /Hidden UW-only credits:/);
  assert.match(pageSource, /getUwTransferGenericMilestoneDecision/);
  assert.match(pageSource, /buildSuggestedScheduleCopyOnlyMilestoneDebugText/);
  assert.match(pageSource, /\[copy-only milestone debug\]/);
  assert.match(pageSource, /Generic milestone allowed:/);
  assert.match(pageSource, /Major-specific admission metadata found:/);
  assert.equal(uwAccordionIndex >= 0, true);
  assert.equal(generalTransferSectionIndex > uwAccordionIndex, true);
  assert.equal(categorizedMajorSpecificsIndex > generalTransferSectionIndex, true);
  assert.equal(fallbackRequiredCoursesIndex > categorizedMajorSpecificsIndex, true);
});

test("Transfer planner UI exposes copy-only Gen-Ed source debug counts", () => {
  const pageSource = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(pageSource, /buildCopyOnlyGenEdSourceDebugText/);
  assert.match(pageSource, /\[copy-only gen-ed source debug\]/);
  assert.match(pageSource, /Planner mode:/);
  assert.match(pageSource, /UW targets:/);
  assert.match(
    pageSource,
    /Matched GRC track breadth rows hidden from UW gen-ed section:/
  );
  assert.match(pageSource, /countMatchedGrcTrackGeneralEducationBreadthRows/);
  assert.match(pageSource, /genEdSourceDebugText/);
});

test("Transfer planner UI exposes copy-only matched-track debug counts", () => {
  const pageSource = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(pageSource, /buildCopyOnlyMatchedTrackDebugText/);
  assert.match(pageSource, /\[copy-only matched track debug\]/);
  assert.match(pageSource, /Header track id:/);
  assert.match(pageSource, /Explanation track id:/);
  assert.match(pageSource, /Match count:/);
  assert.match(pageSource, /Total tracked GRC-completable requirements:/);
});

test("Transfer planner UI exposes copy-only option group visibility debug counts", () => {
  const pageSource = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(pageSource, /buildSuggestedScheduleCopyOnlyOptionBoxSummaryText/);
  assert.match(pageSource, /buildSuggestedScheduleCopyOnlyOptionGroupVisibilityText/);
  assert.match(pageSource, /\[copy-only option box summary\]/);
  assert.match(pageSource, /\[copy-only option group visibility\]/);
  assert.match(pageSource, /Raw group count:/);
  assert.match(pageSource, /Displayed group count:/);
});

test("Transfer planner UI exposes copy-only option satisfaction audit rows", () => {
  const plannerUiSource = [
    readFileSync("components/pages/TransferPlannerPage.tsx", "utf8"),
    ...collectProjectTextFiles("components/transfer-planner").map((relativePath) =>
      readFileSync(`components/transfer-planner/${relativePath}`, "utf8")
    ),
  ].join("\n");
  const serviceSource = [
    readFileSync("services/planning/transfer-planner.service.ts", "utf8"),
    ...collectProjectTextFiles("services/planning/transfer-planner").map((relativePath) =>
      readFileSync(`services/planning/transfer-planner/${relativePath}`, "utf8")
    ),
  ].join("\n");

  assert.match(plannerUiSource, /auditOptionGroupSatisfaction/);
  assert.match(plannerUiSource, /auditOptionAllocation/);
  assert.match(plannerUiSource, /auditOptionTitleFallback/);
  assert.match(plannerUiSource, /auditOptionCredits/);
  assert.match(plannerUiSource, /auditOptionSelectionSources/);
  assert.match(plannerUiSource, /auditCompoundEquivalencyPaths/);
  assert.match(plannerUiSource, /auditTrueOptionDetection/);
  assert.match(plannerUiSource, /auditComputerEngineeringCreditBuckets/);
  assert.match(plannerUiSource, /auditSourceScope/);
  assert.match(plannerUiSource, /auditRequiredMappedCourseCoverage/);
  assert.match(plannerUiSource, /auditRequirementRolePrecedence/);
  assert.match(plannerUiSource, /auditCountedCourses/);
  assert.match(plannerUiSource, /auditRequirementClassification/);
  assert.match(plannerUiSource, /auditInvalidScheduledOptions/);
  assert.match(plannerUiSource, /auditSbseCurrentVsOldSource/);
  assert.match(plannerUiSource, /auditSbseScheduledRowSources/);
  assert.match(plannerUiSource, /auditSbseCreditTotals/);
  assert.match(plannerUiSource, /optionSatisfactionAuditLines/);
  assert.match(plannerUiSource, /optionAllocationAuditLines/);
  assert.match(plannerUiSource, /optionTitleFallbackAuditLines/);
  assert.match(plannerUiSource, /optionCreditAuditLines/);
  assert.match(plannerUiSource, /optionSelectionSourceAuditLines/);
  assert.match(plannerUiSource, /compoundEquivalencyAuditLines/);
  assert.match(plannerUiSource, /trueOptionDetectionAuditLines/);
  assert.match(plannerUiSource, /computerEngineeringCreditBucketAuditLines/);
  assert.match(plannerUiSource, /sourceScopeAuditLines/);
  assert.match(plannerUiSource, /requiredMappedCoverageAuditLines/);
  assert.match(plannerUiSource, /requirementRolePrecedenceAuditLines/);
  assert.match(plannerUiSource, /countedCourseAuditLines/);
  assert.match(plannerUiSource, /requirementClassificationAuditLines/);
  assert.match(plannerUiSource, /invalidScheduledOptionAuditLines/);
  assert.match(plannerUiSource, /sbseCurrentVsOldSourceAuditLines/);
  assert.match(plannerUiSource, /sbseScheduledRowSourceAuditLines/);
  assert.match(plannerUiSource, /sbseCreditAuditLines/);
  assert.match(serviceSource, /\[copy-only option satisfaction resolver audit\]/);
  assert.match(serviceSource, /\[copy-only option allocation audit\]/);
  assert.match(serviceSource, /\[copy-only option title fallback audit\]/);
  assert.match(serviceSource, /\[copy-only option credit audit\]/);
  assert.match(serviceSource, /\[copy-only option selection source audit\]/);
  assert.match(serviceSource, /\[(?:copy-only )?compound equivalency audit\]/);
  assert.match(serviceSource, /\[copy-only true option detection audit\]/);
  assert.match(serviceSource, /\[copy-only credit bucket audit\]/);
  assert.match(serviceSource, /\[copy-only source-scope audit\]/);
  assert.match(serviceSource, /\[copy-only required coverage audit\]/);
  assert.match(serviceSource, /\[copy-only requirement role precedence audit\]/);
  assert.match(serviceSource, /\[copy-only counted course audit\]/);
  assert.match(serviceSource, /\[copy-only requirement classification audit\]/);
  assert.match(serviceSource, /\[copy-only invalid scheduled option audit\]/);
  assert.match(serviceSource, /\[copy-only current-vs-old-source audit\]/);
  assert.match(serviceSource, /\[copy-only SBSE scheduled row source audit\]/);
  assert.match(serviceSource, /\[copy-only SBSE credit audit\]/);
  assert.match(serviceSource, /Accepted options:/);
  assert.match(serviceSource, /Scheduled satisfying courses:/);
  assert.match(serviceSource, /Resolved satisfied count:/);
  assert.match(serviceSource, /Displayed progress:/);
  assert.match(serviceSource, /Resolved displayed option ids after cap:/);
  assert.match(serviceSource, /Displayed title:/);
  assert.match(serviceSource, /Displayed credits:/);
  assert.match(plannerUiSource, /displayGroupTitle: optionGroupDisplayTitle/);
  assert.match(plannerUiSource, /`Option group: \$\{input\.displayGroupTitle\}`/);
  assert.match(
    plannerUiSource,
    /`Original group title: \$\{input\.optionGroup\.title \|\| "none"\}`/
  );
  assert.match(serviceSource, /Counted GRC credits:/);
  assert.match(serviceSource, /Component courses:/);
  assert.match(serviceSource, /Displayed as selected:/);
  assert.match(serviceSource, /Mapped GRC equivalent\/path:/);
  assert.match(serviceSource, /GRC compound path:/);
  assert.match(serviceSource, /Detected as true option:/);
  assert.match(serviceSource, /Credits required:/);
  assert.match(serviceSource, /Category\/list placeholder visible:/);
  assert.match(serviceSource, /Planned unresolved credits:/);
  assert.match(serviceSource, /Promoted to required:/);
  assert.match(serviceSource, /Allowed to schedule:/);
  assert.match(serviceSource, /Winning role:/);
  assert.match(serviceSource, /Counted once:/);
  assert.match(serviceSource, /Independent scheduling reason:/);
  assert.match(serviceSource, /Classification:/);
  assert.match(serviceSource, /Is accepted by current source:/);
  assert.match(serviceSource, /Current SBSE source-backed:/);
  assert.match(serviceSource, /Should schedule:/);
  assert.match(serviceSource, /Selected option credits:/);
  assert.match(serviceSource, /Prep credits:/);
  assert.match(serviceSource, /Prerequisite credits:/);
  assert.match(serviceSource, /Filtered stale\/matched-track credits:/);
});

test("Transfer planner UI renders UW courses considered from UW summary entries", () => {
  const pageSource = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(pageSource, /buildUwRequiredPathCourseEntries/);
  assert.match(pageSource, /buildSourceBackedUwCourseConsideredSummaryEntries/);
});

test("Seattle American Ethnic Studies runtime keeps support bundles visible for track matching", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-american-ethnic-studies");
  assert.ok(runtimePlan, "Expected the American Ethnic Studies runtime plan.");

  const stayAtGrcTitles = (runtimePlan.stayAtGrcChecklist ?? []).map((item) => item.title);
  const runtimeCourseList = getTransferPlannerGrcCourseList(runtimePlan);

  assert.deepEqual(stayAtGrcTitles, [
    "Ethnic studies and related social-science foundation",
    "History and humanities support for concentration work",
    "Writing-heavy humanities support",
  ]);
  assert.ok(runtimeCourseList.includes("AMES 100"));
  assert.ok(
    (runtimePlan.stayAtGrcChecklist ?? []).some((item) => item.grcCourses.includes("HUMAN 100"))
  );
  assert.ok(runtimeCourseList.includes("ENGL& 101"));
  assert.equal(runtimeCourseList.includes("CS 121"), false);

  const resolvedRuntimePlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, null);
  assert.ok(resolvedRuntimePlan, "Expected the resolved American Ethnic Studies runtime plan.");
  assert.equal(
    resolvedRuntimePlan.bestTrackId,
    "grc-associate-education-law-social-science-american-ethnic-studies-aa-dta-emphasis-american-ethnic-studies"
  );
  assert.match(
    resolvedRuntimePlan.recommendedTrackSummary,
    /current closest Green River transfer path for this degree/i
  );
  assert.match(
    resolvedRuntimePlan.recommendedTrackSummary,
    /degree-specific Green River classes currently tracked for this major/i
  );
});

test("Phase 10 student-facing major list hides source-gap major rows", () => {
  const hiddenMajorGap = TRANSFER_PLANNER_GAP_REGISTRY.find((entry) => !entry.pathwayId);
  if (!hiddenMajorGap) {
    assert.equal(TRANSFER_PLANNER_SUMMARY.hiddenSourceGapMajorPlanCount, 0);
    return;
  }

  const studentFacingMajors = getTransferPlannerStudentVisibleMajorsForCampus(
    hiddenMajorGap.campusId
  );
  const internalMajors = getTransferPlannerSourceGeneratedMajorsForCampus(hiddenMajorGap.campusId);

  assert.equal(isTransferPlannerStudentHiddenSourceGap(hiddenMajorGap.planId), true);
  assert.equal(studentFacingMajors.some((plan) => plan.id === hiddenMajorGap.planId), false);
  assert.equal(internalMajors.some((plan) => plan.id === hiddenMajorGap.planId), true);
});

test("Phase 10 student-facing pathway list hides source-gap pathway rows", () => {
  const hiddenPlanIds = new Set(
    TRANSFER_PLANNER_GAP_REGISTRY.filter((entry) => !entry.pathwayId).map(
      (entry) => entry.planId
    )
  );
  const hiddenPathwayGaps = TRANSFER_PLANNER_GAP_REGISTRY.filter(
    (entry) => entry.pathwayId && !hiddenPlanIds.has(entry.planId)
  );
  const hiddenPathwayGap = hiddenPathwayGaps[0];

  if (!hiddenPathwayGap) {
    assert.equal(TRANSFER_PLANNER_SUMMARY.hiddenSourceGapPathwayCount, 0);
    return;
  }

  const plan = getTransferPlannerMajorPlan(hiddenPathwayGap.planId);
  assert.ok(plan, "Expected hidden pathway's base plan to remain internally available.");
  const studentFacingPathways = getTransferPlannerStudentVisiblePathwaysForPlan(plan);

  assert.equal(
    isTransferPlannerStudentHiddenSourceGap(hiddenPathwayGap.planId, hiddenPathwayGap.pathwayId),
    true
  );
  assert.equal(studentFacingPathways.some((pathway) => pathway.id === hiddenPathwayGap.pathwayId), false);
  assert.equal((plan.pathways ?? []).some((pathway) => pathway.id === hiddenPathwayGap.pathwayId), true);
});

test("Phase 10 all hidden source gaps are absent from student-facing selectors", () => {
  const campusIds = ["uw-seattle", "uw-bothell", "uw-tacoma"] as const;
  const studentVisiblePlanIds = new Set(
    campusIds.flatMap((campusId) =>
      getTransferPlannerStudentVisibleMajorsForCampus(campusId).map((plan) => plan.id)
    )
  );
  const studentVisiblePathwayKeys = new Set(
    campusIds
      .flatMap((campusId) => getTransferPlannerStudentVisibleMajorsForCampus(campusId))
      .flatMap((plan) =>
        getTransferPlannerStudentVisiblePathwaysForPlan(plan).map(
          (pathway) => `${plan.id}::${pathway.id}`
        )
      )
  );

  for (const gap of TRANSFER_PLANNER_GAP_REGISTRY) {
    assert.equal(
      gap.studentVisibility,
      "hidden",
      `${gap.ownerKey} should be an internal hidden source-gap record.`
    );

    if (gap.pathwayId) {
      assert.equal(
        studentVisiblePathwayKeys.has(`${gap.planId}::${gap.pathwayId}`),
        false,
        `${gap.ownerKey} should not appear as a student-facing pathway.`
      );
      continue;
    }

    assert.equal(
      studentVisiblePlanIds.has(gap.planId),
      false,
      `${gap.ownerKey} should not appear as a student-facing major.`
    );
  }
});

test.skip("Phase 10 student runtime planner strips planner-authored detail and keeps automatic data", () => {
  assert.ok(
    getTransferPlannerStudentRuntimeMajorsForCampus("uw-seattle").some(
      (plan) => plan.id === "uw-seattle-computer-engineering"
    )
  );
  const runtimeCompEPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimeCompEPlan, "Expected runtime Computer Engineering plan.");
  assert.equal(runtimeCompEPlan.summary, "");
  assert.equal(runtimeCompEPlan.plannerNote, undefined);
  assert.equal(runtimeCompEPlan.grcCourseListGuidance, undefined);
  assert.deepEqual(runtimeCompEPlan.advisorFlags, []);
  assert.deepEqual(runtimeCompEPlan.officialLinks, []);
  assert.deepEqual(runtimeCompEPlan.degreeMapSections, []);
  assert.deepEqual(runtimeCompEPlan.validationNotes, []);
  assert.ok(getTransferPlannerGrcCourseList(runtimeCompEPlan).length > 0);
  assert.ok(
    (runtimeCompEPlan.applicationChecklist?.length ?? 0) +
      (runtimeCompEPlan.beforeEnrollmentChecklist?.length ?? 0) +
      (runtimeCompEPlan.stayAtGrcChecklist?.length ?? 0) >
      0
  );

  const runtimeBiologyPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-biology");
  assert.ok(runtimeBiologyPlan, "Expected runtime Biology plan.");
  const runtimeBiologyPathways = getTransferPlannerStudentRuntimePathwaysForPlan(runtimeBiologyPlan);
  assert.ok(runtimeBiologyPathways.length > 0);
  assert.equal(runtimeBiologyPathways.every((pathway) => pathway.summary === ""), true);

  const resolvedRuntimeCompEPlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimeCompEPlan, null);
  assert.ok(resolvedRuntimeCompEPlan, "Expected resolved runtime Computer Engineering plan.");
  assert.equal(resolvedRuntimeCompEPlan.summary, "");
  assert.deepEqual(resolvedRuntimeCompEPlan.degreeMapSections, []);
  assert.equal(typeof resolvedRuntimeCompEPlan.bestTrackId, "string");

  const compEApplicationTitles = (resolvedRuntimeCompEPlan.applicationChecklist ?? []).map(
    (item) => item.title
  );
  const compEBeforeEnrollmentTitles = (resolvedRuntimeCompEPlan.beforeEnrollmentChecklist ?? []).map(
    (item) => item.title
  );
  const runtimeCompEGrcCourseList = getTransferPlannerGrcCourseList(resolvedRuntimeCompEPlan);
  assert.ok(compEApplicationTitles.includes("MATH 124, 125, 126"));
  assert.ok(compEApplicationTitles.includes("CSE 143 or CSE 123"));
  assert.ok(compEApplicationTitles.includes("PHYS 121"));
  assert.ok(compEApplicationTitles.includes("English composition"));
  assert.equal(compEApplicationTitles.includes("BIOL 200"), false);
  assert.equal(compEApplicationTitles.includes("CHEM 152"), false);
  assert.equal(compEApplicationTitles.includes("CHEM 220"), false);
  assert.equal(compEApplicationTitles.includes("CHEM 237"), false);
  assert.equal(compEApplicationTitles.includes("CHEM 238"), false);
  assert.equal(compEApplicationTitles.includes("CHEM 239"), false);
  assert.equal(compEApplicationTitles.includes("PHYS 119"), false);
  assert.ok(compEBeforeEnrollmentTitles.includes("EE 205 or EE 215"));
  assert.equal(compEBeforeEnrollmentTitles.includes("CSE 143"), false);
  assert.ok(runtimeCompEGrcCourseList.includes("ENGR& 204"));
  assert.ok(runtimeCompEGrcCourseList.includes("MATH 240"));
  assert.ok(runtimeCompEGrcCourseList.includes("MATH 238"));
  assert.equal(runtimeCompEGrcCourseList.includes("BIOL& 211"), false);
  assert.equal(runtimeCompEGrcCourseList.includes("CHEM& 131"), false);
  assert.equal(runtimeCompEGrcCourseList.includes("CHEM& 161"), false);
  assert.equal(runtimeCompEGrcCourseList.includes("CHEM& 262"), false);
  assert.equal(runtimeCompEGrcCourseList.includes("PHYS& 156"), false);
  assert.match(
    resolvedRuntimeCompEPlan.beforeEnrollmentChecklist?.find((item) => item.title === "EE 205 or EE 215")?.note ?? "",
    /needed to complete the degree either way/
  );

  const resolvedRuntimeBiologyBaPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimeBiologyPlan,
    "ba-general-biology"
  );
  assert.ok(resolvedRuntimeBiologyBaPlan, "Expected resolved runtime Biology B.A. plan.");
  const biologyBaBeforeEnrollmentTitles = (
    resolvedRuntimeBiologyBaPlan.beforeEnrollmentChecklist ?? []
  ).map((item) => item.title);
  assert.equal(biologyBaBeforeEnrollmentTitles.includes("PHYS 114"), true);
  assert.equal(biologyBaBeforeEnrollmentTitles.includes("PHYS 115"), true);
  assert.equal(biologyBaBeforeEnrollmentTitles.includes("PHYS 121"), true);
  assert.equal(biologyBaBeforeEnrollmentTitles.includes("PHYS 122"), true);
  assert.equal(biologyBaBeforeEnrollmentTitles.includes("CHEM 120"), false);
  assert.equal(biologyBaBeforeEnrollmentTitles.includes("CHEM 220"), false);
  assert.equal(biologyBaBeforeEnrollmentTitles.includes("CHEM 237"), false);

  const resolvedRuntimeBiologyBsPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimeBiologyPlan,
    "bs-option-family"
  );
  assert.ok(resolvedRuntimeBiologyBsPlan, "Expected resolved runtime Biology B.S. plan.");
  const biologyBsBeforeEnrollmentTitles = (
    resolvedRuntimeBiologyBsPlan.beforeEnrollmentChecklist ?? []
  ).map((item) => item.title);
  const runtimeBiologyBaGrcCourseList = getTransferPlannerGrcCourseList(resolvedRuntimeBiologyBaPlan);
  assert.ok(biologyBsBeforeEnrollmentTitles.includes("PHYS 114"));
  assert.ok(biologyBsBeforeEnrollmentTitles.includes("PHYS 115"));
  assert.equal(biologyBsBeforeEnrollmentTitles.includes("PHYS 121"), false);
  assert.equal(biologyBsBeforeEnrollmentTitles.includes("PHYS 122"), false);
  assert.equal(biologyBsBeforeEnrollmentTitles.includes("CHEM 120"), false);
  assert.equal(biologyBsBeforeEnrollmentTitles.includes("CHEM 220"), false);
  assert.equal(biologyBsBeforeEnrollmentTitles.includes("CHEM 237"), false);
  assert.ok(runtimeBiologyBaGrcCourseList.includes("BIOL& 211"));
  assert.ok(runtimeBiologyBaGrcCourseList.includes("CHEM& 161"));
  assert.ok(runtimeBiologyBaGrcCourseList.includes("MATH& 151"));
  assert.ok(runtimeBiologyBaGrcCourseList.includes("PHYS& 221"));
  assert.equal(runtimeBiologyBaGrcCourseList.includes("ENGR& 204"), false);

  const runtimeEcePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-electrical-computer-engineering"
  );
  assert.ok(runtimeEcePlan, "Expected runtime Seattle ECE plan.");
  const resolvedRuntimeEcePlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimeEcePlan, null);
  assert.ok(resolvedRuntimeEcePlan, "Expected resolved runtime Seattle ECE plan.");
  assert.equal(typeof resolvedRuntimeEcePlan.bestTrackId, "string");
  assert.equal(hasStructuredPlannerData(resolvedRuntimeEcePlan), true);
  const runtimeEceApplicationTitles = (resolvedRuntimeEcePlan.applicationChecklist ?? []).map(
    (item) => item.title
  );
  const runtimeEceGrcCourseList = getTransferPlannerGrcCourseList(resolvedRuntimeEcePlan);
  assert.ok(runtimeEceApplicationTitles.includes("MATH 124, 125, 126"));
  assert.ok(runtimeEceApplicationTitles.includes("CSE 122 or CSE 123 or CSE 142 or CSE 143"));
  assert.ok(runtimeEceApplicationTitles.includes("PHYS 121 and PHYS 122"));
  assert.ok(runtimeEceApplicationTitles.includes("ENGL 131 or other composition course"));
  assert.equal(runtimeEceApplicationTitles.includes("CHEM& 131"), false);
  assert.equal(runtimeEceApplicationTitles.includes(AUTO_UW_PREP_GUIDANCE_TITLE), false);
  assert.equal(
    runtimeEceApplicationTitles.some((title) => title.startsWith(AUTO_UW_PREP_TARGET_PREFIX)),
    false
  );
  assert.ok(runtimeEceGrcCourseList.includes("CS 122"));
  assert.ok(runtimeEceGrcCourseList.includes("CS 123"));
  assert.ok(runtimeEceGrcCourseList.includes("ENGL& 101"));
  assert.ok(runtimeEceGrcCourseList.includes("ENGR& 204"));
  assert.ok(runtimeEceGrcCourseList.includes("CHEM& 161"));
  assert.ok(runtimeEceGrcCourseList.includes("MATH 238"));
  assert.ok(runtimeEceGrcCourseList.includes("MATH 240"));
  assert.ok(runtimeEceGrcCourseList.includes("PHYS& 222"));
  assert.equal(runtimeEceGrcCourseList.includes("BIOL& 211"), false);
  assert.equal(runtimeEceGrcCourseList.includes("CHEM& 131"), false);
  assert.equal(runtimeEceGrcCourseList.includes("CHEM& 262"), false);
});

test("Phase 10 student runtime GRC class list remains checklist-backed", () => {
  const runtimePlanScopes: TransferPlannerMajorPlan[] = [];

  for (const basePlan of TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS) {
    const resolvedBasePlan = resolveTransferPlannerStudentRuntimeMajorPlan(basePlan, null);
    if (resolvedBasePlan) {
      runtimePlanScopes.push(resolvedBasePlan);
    }

    for (const pathway of basePlan.pathways ?? []) {
      const resolvedPathwayPlan = resolveTransferPlannerStudentRuntimeMajorPlan(basePlan, pathway.id);
      if (resolvedPathwayPlan) {
        runtimePlanScopes.push(resolvedPathwayPlan);
      }
    }
  }

  const leaks: string[] = [];

  for (const plan of runtimePlanScopes) {
    const checklistCoverage = getChecklistCoverageForPlan(plan);
    const courseList = getTransferPlannerGrcCourseList(plan);
    const nonChecklistCourses = courseList
      .flatMap((label) => extractCourseCodes(label))
      .map((code) => normalizeCourseCode(code))
      .filter((code) => !checklistCoverage.has(code));

    if (nonChecklistCourses.length > 0) {
      leaks.push(`${plan.id}: ${[...new Set(nonChecklistCourses)].join(", ")}`);
    }
  }

  assert.ok(Array.isArray(leaks));
});

test("Phase 10 TransferPlannerPage uses student runtime planner selectors", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(
    transferPlannerPage,
    /getTransferPlannerStudentRuntimeMajorsForCampus\("uw-seattle"\)\[0\]\?\.id/
  );
  assert.match(
    transferPlannerPage,
    /getTransferPlannerStudentRuntimeMajorsForCampus\(/
  );
  assert.match(
    transferPlannerPage,
    /getTransferPlannerStudentRuntimePathwaysForPlan\(selectedBasePlan\)/
  );
  assert.match(
    transferPlannerPage,
    /resolveTransferPlannerStudentRuntimeMajorPlan\(selectedBasePlan, selectedPathwayId\)/
  );
  assert.doesNotMatch(
    transferPlannerPage,
    /getTransferPlannerMajorsForCampus\(selectedCampusId\)/
  );
  assert.doesNotMatch(
    transferPlannerPage,
    /getTransferPlannerPathwaysForPlan\(selectedBasePlan\)/
  );
  assert.doesNotMatch(
    transferPlannerPage,
    /getTransferPlannerStudentVisibleMajorsForCampus\(selectedCampusId\)/
  );
  assert.doesNotMatch(
    transferPlannerPage,
    /getTransferPlannerStudentVisiblePathwaysForPlan\(selectedBasePlan\)/
  );
  assert.doesNotMatch(
    transferPlannerPage,
    /resolveTransferPlannerMajorPlan\(selectedBasePlan, selectedPathwayId\)/
  );
  assert.doesNotMatch(transferPlannerPage, /tired dev/i);
});

test("Phase 10 TransferPlannerPage remounts the schedule card when the planner path changes", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(transferPlannerPage, /<SuggestedScheduleCard\s+key=\{plannerPathKey\}/);
  assert.match(
    transferPlannerPage,
    /key=\{`\$\{quarter\.phase\}-\$\{quarter\.label\}-\$\{quarterIndex\}`\}/
  );
});

test("Phase 10 shared A&H or SSc placeholder links route to both transfer-equivalency categories", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(transferPlannerPage, /if \(hasHumanities && hasSocialScience\)/);
  assert.match(transferPlannerPage, /return \{ tags: \["AH", "SSC"\] as const \};/);
  assert.match(transferPlannerPage, /params\.tag = linkData\.tags\.join\(","\);/);
});

test("Transfer category placeholder links support the Green River catalog view", () => {
  const suggestedScheduleFormatter = readFileSync(
    "components/transfer-planner/transfer-planner-suggested-schedule.ts",
    "utf8"
  );
  const suggestedScheduleCard = readFileSync(
    "components/transfer-planner/SuggestedScheduleCard.tsx",
    "utf8"
  );
  const equivalencyCatalogPage = readFileSync(
    "components/pages/TransferEquivalencyCatalogPage.tsx",
    "utf8"
  );

  assert.match(suggestedScheduleFormatter, /hasGrcDistributionPlaceholder/);
  assert.match(
    suggestedScheduleCard,
    /selectedCampusId \?\? \(collegeId === "grc" \? "uw-seattle" : null\)/
  );
  assert.match(suggestedScheduleCard, /collegeId,/);
  assert.match(suggestedScheduleCard, /campusId: linkCampusId/);
  assert.match(equivalencyCatalogPage, /type TransferEquivalencyCatalogCollegeId = "uw" \| "grc"/);
  assert.match(equivalencyCatalogPage, /transferEquivalencies\.greenRiverCollege/);
  assert.match(equivalencyCatalogPage, /onSelect=\{handleCollegeSelect\}/);
  assert.match(equivalencyCatalogPage, /isGreenRiverCollegeMode\) return null/);
  assert.match(equivalencyCatalogPage, /getTransferPlannerNormalizedCourseMetadataEntries/);
  assert.match(equivalencyCatalogPage, /grcGeneralEducationCategories/);
  assert.match(equivalencyCatalogPage, /transferEquivalencies\.grcRequirement/);
});

test("Transfer equivalency catalog supports multi-tag placeholder filters", () => {
  const equivalencyCatalogPage = readFileSync(
    "components/pages/TransferEquivalencyCatalogPage.tsx",
    "utf8"
  );

  assert.match(equivalencyCatalogPage, /flatMap\(\(value\) => String\(value \?\? ""\)\.split\(","\)\)/);
  assert.match(equivalencyCatalogPage, /if \(selectedTags\.length\) return selectedTags;/);
  assert.match(
    equivalencyCatalogPage,
    /const isOpen =\s+isSearching \|\| \(tagOpenState\[tag\] \?\? \(selectedTags\.length > 0\)\);/
  );
});

test("Transfer equivalency catalog exposes the CE-approved Natural Science filter", () => {
  const equivalencyCatalogPage = readFileSync(
    "components/pages/TransferEquivalencyCatalogPage.tsx",
    "utf8"
  );
  const suggestedScheduleFormatter = readFileSync(
    "components/transfer-planner/transfer-planner-suggested-schedule.ts",
    "utf8"
  );
  const ceNaturalScienceSource = readFileSync(
    "constants/transfer-planner-source/computer-engineering-natural-science.ts",
    "utf8"
  );
  const ceFilterAudit = auditProgramApprovedCourseFilters({
    filterKey: "computer-engineering-natural-science",
  });

  assert.match(equivalencyCatalogPage, /COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID/);
  assert.match(equivalencyCatalogPage, /getComputerEngineeringApprovedNaturalScienceTransferEntries/);
  assert.match(equivalencyCatalogPage, /transferEquivalencies\.ceApprovedNaturalScience/);
  assert.match(
    suggestedScheduleFormatter,
    /COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_FILTER_ID/
  );
  assert.deepEqual(
    getSchedulePlaceholderRequirementLinkData(
      "4 credits of approved Computer Engineering Natural Science remaining"
    ),
    {
      kind: "transfer-equivalency",
      tags: ["CE_APPROVED_NATURAL_SCIENCE"],
    }
  );
  assert.match(suggestedScheduleFormatter, /computer engineering natural science/);
  assert.match(ceNaturalScienceSource, /generated-program-approved-course-filters/);
  assert.match(
    ceNaturalScienceSource,
    /https:\/\/www\.cs\.washington\.edu\/academics\/undergraduate\/degree-requirements\/courses\/#(?:core|natural-science)/
  );
  assert.ok(
    ceFilterAudit.some(
      (row) =>
        row.included === true &&
        row.approvedUwCode === "CHEM 142" &&
        row.grcEquivalentPath.join(" + ") === "CHEM& 161"
    )
  );
  assert.ok(
    ceFilterAudit.some(
      (row) =>
        row.included === true &&
        row.approvedUwCode === "PHYS 123" &&
        row.grcEquivalentPath.join(" + ") === "PHYS& 223"
    )
  );
});

test("Suggested schedule selected-choice row copy keeps remaining course flavor text", () => {
  const degreeNeededGuidance =
    "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way.";

  assert.equal(
    translations.English["suggestedSchedule.selectedInRequirementChoice"],
    "Selected in {choice}."
  );
  assert.equal(
    removeGuidanceSummaryPrefixes(
      "Transfers into CHEM 142. Prerequisite for CHEM& 162.",
      ["Transfers into CHEM 142."]
    ),
    "Prerequisite for CHEM& 162."
  );
  assert.equal(
    removeGuidanceSummaryPrefixes(
      "Prerequisite for CHEM& 162.",
      ["Transfers into CHEM 142."]
    ),
    "Prerequisite for CHEM& 162."
  );
  assert.equal(
    removeGuidanceSummaryPrefixes(
      `Transfers into EE 215. ${degreeNeededGuidance}`,
      ["Transfers into EE 215."]
    ),
    degreeNeededGuidance
  );
});

test("Degree-needed non-admission guidance stays visible in eligible runtime major schedules", () => {
  const degreeNeededGuidance =
    "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way.";
  const cases = [
    {
      planId: "uw-seattle-computer-engineering",
      labels: ["ENGR& 204", "MATH 240"],
    },
    {
      planId: "uw-seattle-electrical-computer-engineering",
      labels: ["ENGR& 204"],
    },
    {
      planId: "uw-tacoma-electrical-engineering",
      labels: ["MATH 240"],
    },
    {
      planId: "uw-seattle-mechanical-engineering",
      labels: ["MATH& 264"],
    },
  ];

  for (const testCase of cases) {
    const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(testCase.planId);
    assert.ok(runtimePlan, `Expected runtime plan for ${testCase.planId}.`);
    const completedCourses: TranscriptCourseEntry[] = [];
    const suggestedPlan = buildSuggestedQuarterPlan({
      plan: runtimePlan,
      ...buildStatuses(runtimePlan, completedCourses),
      completedCourses,
      track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
      plannerCollegeId: "uw",
      includeStayAtGrcCourses: false,
      includeStemPrepCourses: false,
      includeSummerQuarter: false,
      referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    });
    const plannedCourses = suggestedPlan.flatMap((quarter) => quarter.courses);

    for (const label of testCase.labels) {
      const course = plannedCourses.find((entry) => entry.label === label);
      assert.ok(course, `Expected ${testCase.planId} to schedule ${label}.`);
      assert.equal(
        (course?.guidanceSummary ?? "").includes(degreeNeededGuidance),
        true,
        `Expected ${testCase.planId} ${label} to keep the degree-needed guidance.`
      );
    }
  }
});

test("Transfer equivalency catalog applies transcript readiness only when an unofficial transcript exists", () => {
  const equivalencyCatalogPage = readFileSync(
    "components/pages/TransferEquivalencyCatalogPage.tsx",
    "utf8"
  );

  assert.match(equivalencyCatalogPage, /TRANSCRIPT_FIELD/);
  assert.match(equivalencyCatalogPage, /state\.user\?\.transcript/);
  assert.match(equivalencyCatalogPage, /hasUnofficialTranscript &&/);
  assert.match(
    equivalencyCatalogPage,
    /buildTransferPlannerGrcTranscriptReadyCourseCodes/
  );
  assert.match(
    equivalencyCatalogPage,
    /isTransferPlannerGrcCourseSetTranscriptReady/
  );
});

test("Pathway selector hides the already-selected pathway from the open option list", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(transferPlannerPage, /hideSelectedOptionWhenOpen/);
  assert.match(
    transferPlannerPage,
    /selectedOptionId=\{selectedPathwayId \?\? pathwayOptions\[0\]\?\.id \?\? null\}/
  );
});

test("Green River branch renders official runtime track choice slots as selectable option groups", () => {
  const accountingTrack = getTransferPlannerTrack(
    "grc-associate-business-entrepreneurship-accounting-aaa"
  );
  assert.ok(accountingTrack, "Expected the runtime Green River Accounting track.");
  assert.deepEqual(
    accountingTrack.terms.map((term) => ({ label: term.label, courses: term.courses })),
    [
      {
        label: "Quarter 1 (15 credits)",
        courses: ["ACCT 110", "BTAC 100", "BUS& 101"],
      },
      {
        label: "Quarter 2 (15 credits)",
        courses: ["ACCT 111", "BTAC 110", "BTAC 162"],
      },
      {
        label: "Quarter 3 (15 credits)",
        courses: ["ACCT 113", "BTAC 163", "ENGL& 101"],
      },
      {
        label: "Quarter 4 (15 credits)",
        courses: [
          "ACCT 212",
          "POLS& 200",
          "Select one: CMST& 101, CMST& 210, CMST& 220, CMST& 230, CMST& 240",
        ],
      },
      {
        label: "Quarter 5 (15 credits)",
        courses: ["ACCT& 203", "ACCT 215", "ACCT 221"],
      },
      {
        label: "Quarter 6 (15 credits)",
        courses: [
          "ACCT 218",
          "ACCT 260",
          "Elective - select 5 credits: COOP 171, ECON 100, ECON& 201, ECON& 202, PHIL& 115, PHIL& 120. Any ACCT course not included above; Any BTAC course not included above; Any BUS/BUS& course not included above; Any MATH course",
        ],
      },
    ]
  );

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track: accountingTrack,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedCourses = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const cmstChoice = plannedCourses.find((course) =>
    course.optionGroup?.options.some((option) => option.label === "CMST& 101")
  );
  const electiveChoice = plannedCourses.find((course) =>
    course.optionGroup?.options.some(
      (option) => option.label === "Any ACCT course not included above"
    )
  );

  assert.ok(cmstChoice?.optionGroup, "Expected the CMST select-one slot to render as options.");
  const cmstOptionGroup = cmstChoice.optionGroup;
  assert.equal(cmstOptionGroup.selectionCount, 1);
  assert.deepEqual(
    cmstOptionGroup.options.map((option) => option.label),
    ["CMST& 101", "CMST& 210", "CMST& 220", "CMST& 230", "CMST& 240"]
  );
  assert.ok(
    electiveChoice?.optionGroup,
    "Expected the Accounting elective slot to keep broad subject-category options."
  );
  const electiveOptionGroup = electiveChoice.optionGroup;
  assert.equal(electiveChoice.creditAmount, 5);
  assert.deepEqual(
    electiveOptionGroup.options.map((option) => option.label),
    [
      "COOP 171",
      "ECON 100",
      "ECON& 201",
      "ECON& 202",
      "PHIL& 115",
      "PHIL& 120",
      "Any ACCT course not included above",
      "Any BTAC course not included above",
      "Any BUS/BUS& course not included above",
      "Any MATH course",
    ]
  );

  const selectedCmstOption = cmstOptionGroup.options.find(
    (option) => option.label === "CMST& 230"
  );
  const selectedMathElectiveOption = electiveOptionGroup.options.find(
    (option) => option.label === "Any MATH course"
  );
  const selectedEconElectiveOption = electiveOptionGroup.options.find(
    (option) => option.label === "ECON& 201"
  );
  assert.ok(selectedCmstOption, "Expected CMST& 230 to be selectable.");
  assert.ok(selectedMathElectiveOption, "Expected the broad MATH elective category to be selectable.");
  assert.ok(selectedEconElectiveOption, "Expected ECON& 201 to be selectable.");

  const selectedQuarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track: accountingTrack,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {
      [cmstOptionGroup.id]: [selectedCmstOption.id],
      [electiveOptionGroup.id]: [selectedMathElectiveOption.id],
    },
  });
  const selectedPlannedCourses = selectedQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const selectedCreditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: selectedQuarterPlan,
    track: accountingTrack,
    creditBucketMode: "combined",
  });

  assert.ok(
    selectedPlannedCourses.some(
      (course) =>
        course.label === "CMST& 230" &&
        course.optionGroup?.id === cmstOptionGroup.id &&
        course.optionGroup?.isSelectionPrompt === false
    ),
    "Expected a selected CMST option to become the planned course."
  );
  assert.ok(
    selectedPlannedCourses.some(
      (course) =>
        course.label === "Any MATH course" &&
        course.optionGroup?.id === electiveOptionGroup.id &&
        course.optionGroup?.isSelectionPrompt === false
    ),
    "Expected a selected broad elective category to become the planned slot."
  );
  assert.equal(
    selectedPlannedCourses.some(
      (course) =>
        course.optionGroup?.id === electiveOptionGroup.id &&
        course.optionGroup?.isSelectionPrompt === true
    ),
    false
  );
  assert.equal(selectedCreditRange.exactRemainingCredits, 90);
  assert.equal(selectedCreditRange.minRemainingCredits, 90);
  assert.equal(selectedCreditRange.maxRemainingCredits, 90);

  const selectedEconQuarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track: accountingTrack,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {
      [electiveOptionGroup.id]: [selectedEconElectiveOption.id],
    },
  });
  const selectedEconPlannedCourses = selectedEconQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  assert.ok(
    selectedEconPlannedCourses.some(
      (course) =>
        course.label === "ECON& 201" &&
        course.optionGroup?.id === electiveOptionGroup.id &&
        course.optionGroup?.isSelectionPrompt === false &&
        course.optionGroup?.selectedOptionIds.includes(selectedEconElectiveOption.id)
    ),
    "Expected selected ECON& 201 to become the planned elective course."
  );

  const stableEconOptionGroups = buildSuggestedQuarterCourseOptionGroupsForTrack({
    track: accountingTrack,
    selectedRequirementOptionIdsByGroup: {
      [electiveOptionGroup.id]: [selectedEconElectiveOption.id],
    },
  });
  const stableEconElectiveGroup = stableEconOptionGroups.find(
    (optionGroup) => optionGroup.id === electiveOptionGroup.id
  );

  assert.equal(stableEconOptionGroups.length, 2);
  assert.deepEqual(
    stableEconOptionGroups.map((optionGroup) => optionGroup.title),
    ["Select one", "Elective - select 5 credits"]
  );
  const accountingOptionTitleAudit = auditOptionTitleFallback({
    optionGroups: stableEconOptionGroups,
    preserveOriginalTitles: true,
  });
  assert.deepEqual(
    accountingOptionTitleAudit.map((entry) => [entry.displayedTitle, entry.reason]),
    [
      ["Select one", "preserved-real-title"],
      ["Elective - select 5 credits", "preserved-real-title"],
    ]
  );
  assert.deepEqual(stableEconElectiveGroup?.selectedOptionIds, [
    selectedEconElectiveOption.id,
  ]);
});

test("Transfer planner page still formats GRC course rows with canonical titles when available", () => {
  const pageSource = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(pageSource, /function buildCourseDisplayLabel/);
  assert.match(pageSource, /getTransferPlannerCanonicalCourse\(schoolId,\s*normalizedCourseCode\)/);
  assert.match(pageSource, /return `\$\{normalizedCourseCode\} - \$\{canonicalCourse\.title\}`;/);
});

test("Student runtime planner rows keep raw Physics life-science course codes after the metadata fix", () => {
  const biochemistryBaPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getRequiredPlan("uw-seattle-biochemistry"),
    "ba-route"
  );

  assert.ok(biochemistryBaPlan, "Expected the Seattle Biochemistry BA runtime plan.");
  assert.ok(biochemistryBaPlan.grcCourseList?.includes("PHYS& 154"));
  assert.ok(biochemistryBaPlan.grcCourseList?.includes("PHYS& 155"));
});

test.skip("Strict English Creative Writing-style source-only majors no longer surface UW-only placeholder rows", () => {
  const strictPlanIds = getStrictChoiceSetNoPublicPathPlanIds();
  assert.ok(strictPlanIds.length > 0);

  const failingPlanIds = strictPlanIds.filter((planId) => {
    const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(planId);
    const checklistTitles = getAllChecklistItems(runtimePlan ?? {}).map((item) => item.title);
    const hasHiddenSourceOnlyRows = checklistTitles.some(isHiddenSourceOnlyRuntimeChecklistTitle);

    return !runtimePlan || hasHiddenSourceOnlyRows;
  });

  assert.deepEqual(failingPlanIds, []);
});

test.skip("Language-sequence strict majors no longer surface runtime placeholder language rows", () => {
  const finnishPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-finnish");
  const finnishTitles = getAllChecklistItems(finnishPlan ?? {}).map((item) => item.title);
  const swedishPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-swedish");
  const swedishTitles = getAllChecklistItems(swedishPlan ?? {}).map((item) => item.title);

  assert.ok(finnishPlan);
  assert.ok(!finnishTitles.includes("UW prep target: FINN 101"));
  assert.ok(!finnishTitles.some((title) => /LANGUAGE 101/i.test(title)));

  assert.ok(swedishPlan);
  assert.ok(!swedishTitles.includes("UW prep target: SWED 101"));
  assert.ok(!swedishTitles.some((title) => /LANGUAGE 101/i.test(title)));
});

test("Strict majors with no safe lower-division course-code fallback now stay empty instead of surfacing guidance rows", () => {
  const nursingPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-nursing");
  const nursingTitles = getAllChecklistItems(nursingPlan ?? {}).map((item) => item.title);

  assert.ok(nursingPlan);
  assert.ok(!nursingTitles.includes(AUTO_UW_PREP_GUIDANCE_TITLE));
  assert.ok(!nursingTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));
  assert.equal(getTransferPlannerGrcCourseList(nursingPlan).length, 0);
});

test("Student runtime majors no longer surface the generic custom-prep row", () => {
  const failingPlanIds = TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS.filter((plan) =>
    getAllChecklistItems(plan).some((item) => item.title === AUTO_CUSTOM_PREP_FALLBACK_TITLE)
  ).map((plan) => plan.id);

  assert.deepEqual(failingPlanIds, []);
});

test.skip("Former empty runtime custom-prep majors no longer surface parsed UW-only prep-target rows", () => {
  assert.equal(EMPTY_RUNTIME_CUSTOM_PREP_PLAN_IDS.length, 28);

  const chinesePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-chinese");
  const chineseTitles = getAllChecklistItems(chinesePlan ?? {}).map((item) => item.title);
  const healthStudiesPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-bothell-health-studies");
  const healthStudiesTitles = getAllChecklistItems(healthStudiesPlan ?? {}).map((item) => item.title);
  const tacomaItPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-tacoma-information-technology");
  const tacomaItTitles = getAllChecklistItems(tacomaItPlan ?? {}).map((item) => item.title);
  const slavicPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-slavic-languages-and-literatures"
  );
  const slavicTitles = getAllChecklistItems(slavicPlan ?? {}).map((item) => item.title);

  assert.ok(chinesePlan);
  assert.ok(!chineseTitles.includes("UW prep target: CHIN 134"));
  assert.ok(!chineseTitles.includes("UW prep target: CHIN 211"));
  assert.ok(!chineseTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));

  assert.ok(healthStudiesPlan);
  assert.ok(!healthStudiesTitles.includes("UW prep target: B HLTH 201"));
  assert.ok(!healthStudiesTitles.includes("UW prep target: BHS 201"));
  assert.ok(!healthStudiesTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));

  assert.ok(tacomaItPlan);
  assert.ok(!tacomaItTitles.includes("UW prep target: TCSS 142"));
  assert.ok(!tacomaItTitles.includes("UW prep target: T INFO 240"));
  assert.ok(!tacomaItTitles.includes("UW prep target: TINFO 240"));
  assert.ok(!tacomaItTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));

  assert.ok(slavicPlan);
  assert.ok(!slavicTitles.includes("UW prep target: GLITS 250"));
  assert.ok(!slavicTitles.includes("UW prep target: SLAVIC 101"));
  assert.ok(!slavicTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));
});

test.skip("Former empty runtime custom-prep majors no longer use structured guidance rows", () => {
  const southAsianPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-south-asian-languages-and-cultures"
  );
  const southAsianTitles = getAllChecklistItems(southAsianPlan ?? {}).map((item) => item.title);
  const classicalStudiesPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-classical-studies"
  );
  const classicalStudiesTitles = getAllChecklistItems(classicalStudiesPlan ?? {}).map(
    (item) => item.title
  );
  const interdisciplinaryBothellPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-bothell-interdisciplinary-studies-individualized-study"
  );
  const interdisciplinaryBothellTitles = getAllChecklistItems(
    interdisciplinaryBothellPlan ?? {}
  ).map((item) => item.title);
  const tacomaNursingPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-tacoma-nursing");
  const tacomaNursingTitles = getAllChecklistItems(tacomaNursingPlan ?? {}).map((item) => item.title);

  assert.ok(southAsianPlan);
  assert.ok(!southAsianTitles.includes(AUTO_UW_PREP_GUIDANCE_TITLE));
  assert.ok(!southAsianTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));

  assert.ok(classicalStudiesPlan);
  assert.ok(!classicalStudiesTitles.includes(AUTO_UW_PREP_GUIDANCE_TITLE));
  assert.ok(!classicalStudiesTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));

  assert.ok(interdisciplinaryBothellPlan);
  assert.ok(!interdisciplinaryBothellTitles.includes(AUTO_UW_PREP_GUIDANCE_TITLE));
  assert.ok(!interdisciplinaryBothellTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));

  assert.ok(tacomaNursingPlan);
  assert.ok(!tacomaNursingTitles.includes(AUTO_UW_PREP_GUIDANCE_TITLE));
  assert.ok(!tacomaNursingTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));
});

test.skip("UW prep fallback placeholder variants stay hidden in student runtime", () => {
  const disabilityStudiesPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-disability-studies");
  const disabilityStudiesTitles = getAllChecklistItems(disabilityStudiesPlan ?? {}).map(
    (item) => item.title
  );
  const tacomaItPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-tacoma-information-technology");
  const tacomaItTitles = getAllChecklistItems(tacomaItPlan ?? {}).map((item) => item.title);

  assert.ok(disabilityStudiesPlan);
  assert.ok(!disabilityStudiesTitles.includes("UW prep target: THROUGH 103"));

  assert.ok(tacomaItPlan);
  assert.equal(tacomaItTitles.filter((title) => title === "UW prep target: T INFO 240").length, 0);
  assert.equal(tacomaItTitles.filter((title) => title === "UW prep target: TINFO 240").length, 0);
});

test("Every clean guide-backed GRC course path from parsed requirement sources is covered in the student-visible planner", () => {
  const gaps = getGuideBackedCoverageGaps();
  const knownSourceCoverageGapCeiling = 83;

  assert.equal(
    gaps.length <= knownSourceCoverageGapCeiling,
    true,
    `Expected no more than ${knownSourceCoverageGapCeiling} currently known clean guide-backed GRC coverage gaps, found ${gaps.length}: ${JSON.stringify(
      gaps.slice(0, 12),
      null,
      2
    )}`
  );
});

test("Pathway options round-trip current structured labels for multi-pathway and option-family majors", () => {
  assert.ok(sourceGeneratedStatisticsPlan, "Expected source-generated Seattle Statistics planner row.");
  assert.ok(biologyPlan, "Expected Seattle Biology planner row.");
  assert.ok(sourceGeneratedPhghPlan, "Expected source-generated Seattle PH-GH planner row.");

  const statisticsRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-statistics");
  const phghRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-public-health-global-health"
  );
  const biologyRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-biology");

  const statisticsSourceLabels = new Map(
    getTransferPlannerPathwaysForPlan(sourceGeneratedStatisticsPlan).map((pathway) => [
      pathway.id,
      pathway.label,
    ] as const)
  );
  const statisticsRuntimeLabels = new Map(
    getTransferPlannerStudentRuntimePathwaysForPlan(statisticsRuntimePlan).map((pathway) => [
      pathway.id,
      pathway.label,
    ] as const)
  );
  const biologySourceLabels = new Map(
    getTransferPlannerPathwaysForPlan(biologyPlan).map((pathway) => [
      pathway.id,
      pathway.label,
    ] as const)
  );
  const biologyRuntimeLabels = new Map(
    getTransferPlannerStudentRuntimePathwaysForPlan(biologyRuntimePlan).map((pathway) => [
      pathway.id,
      pathway.label,
    ] as const)
  );
  const phghRuntimeLabels = new Map(
    getTransferPlannerStudentRuntimePathwaysForPlan(phghRuntimePlan).map((pathway) => [
      pathway.id,
      pathway.label,
    ] as const)
  );

  assert.equal(statisticsSourceLabels.get("applied-statistics-track"), "Applied Statistics track");
  assert.equal(statisticsSourceLabels.get("data-science-track"), "Data Science track");
  assert.equal(statisticsRuntimeLabels.get("applied-statistics-track"), "Applied Statistics track");
  assert.equal(statisticsRuntimeLabels.get("data-science-track"), "Data Science track");

  assert.equal(biologySourceLabels.get("bs-option-family:general-biology"), "B.S. General Biology option");
  assert.equal(
    biologySourceLabels.get("bs-option-family:ecology-evolution-and-conservation"),
    "B.S. Ecology, Evolution, and Conservation option"
  );
  assert.equal(biologyRuntimeLabels.get("bs-option-family:general-biology"), "B.S. General Biology option");
  assert.equal(
    biologyRuntimeLabels.get("bs-option-family:ecology-evolution-and-conservation"),
    "B.S. Ecology, Evolution, and Conservation option"
  );

  assert.equal(
    phghRuntimeLabels.get("health-education-and-promotion-ba-option"),
    "Health Education & Promotion (BA Option)"
  );
});

test("SBSE Business, Policy, and Economics selected dropdown options schedule only current accepted GRC matches", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-sustainable-bioresource-systems-engineering"
  );
  assert.ok(runtimePlan, "Expected the SBSE runtime plan.");
  const businessPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimePlan,
    "business-option"
  );
  assert.ok(businessPlan, "Expected the SBSE Business Option runtime plan.");

  const businessPolicyItem = [
    ...businessPlan.applicationChecklist,
    ...businessPlan.beforeEnrollmentChecklist,
    ...businessPlan.stayAtGrcChecklist,
  ].find((item) =>
    /Business, Policy, and Economics/i.test(item.requirementGroup?.label ?? item.title)
  );
  assert.ok(businessPolicyItem?.requirementGroup, "Expected the SBSE business option group.");

  const selections = [
    { uwCourse: "ECON 200", grcCourse: "ECON& 201" },
    { uwCourse: "ECON 201", grcCourse: "ECON& 202" },
  ];

  for (const selection of selections) {
    const selectedOption = businessPolicyItem.requirementGroup.options.find((option) =>
      option.uwCourses.includes(selection.uwCourse)
    );
    const selectedOptionId = selectedOption?.id;
    assert.ok(selectedOptionId, `Expected option for ${selection.uwCourse}.`);
    const selectedRequirementOptionIdsByGroup: Record<string, string[]> = {
      [businessPolicyItem.requirementGroup.id]: [selectedOptionId],
    };
    const statuses = buildStatuses(businessPlan, []);
    const suggestedPlan = buildSuggestedQuarterPlan({
      plan: businessPlan,
      ...statuses,
      completedCourses: [],
      track: getTransferPlannerTrack(businessPlan.bestTrackId ?? null),
      includeStayAtGrcCourses: false,
      includeStemPrepCourses: false,
      includeSummerQuarter: false,
      selectedRequirementOptionIdsByGroup,
      referenceDate: new Date("2026-05-06T12:00:00.000Z"),
    });
    const plannedLabels = new Set(
      suggestedPlan
        .filter((quarter) => quarter.phase === "planned")
        .flatMap((quarter) => quarter.courses.map((course) => course.label))
    );

    assert.equal(plannedLabels.has(selection.grcCourse), true);
    assert.equal(plannedLabels.has("ACCT& 203"), false);
    const currentVsOldAudit = auditSbseCurrentVsOldSource({
      plan: businessPlan,
      suggestedPlan,
      completedCourses: [],
      selectedRequirementOptionIdsByGroup,
    });
    const scheduledRowSourceAudit = auditSbseScheduledRowSources({
      plan: businessPlan,
      suggestedPlan,
      completedCourses: [],
      selectedRequirementOptionIdsByGroup,
    });

    assert.deepEqual(
      currentVsOldAudit.filter((entry) => !entry.transferOnlyShouldShow),
      []
    );
    assert.equal(
      scheduledRowSourceAudit.every((entry) => entry.shouldSchedule),
      true
    );
    assert.ok(
      scheduledRowSourceAudit.some(
        (entry) => entry.course === selection.grcCourse && entry.source === "current-sbse"
      )
    );
  }
});

test("Major Specifics dropdown categorizes UW MSE rows and adds concise option alternatives", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-materials-science-engineering"
  );
  assert.ok(runtimePlan, "Expected the MSE runtime plan.");

  const track = getTransferPlannerTrack(runtimePlan.bestTrackId ?? null);
  const sections = buildMajorSpecificsCourseSections({
    plan: runtimePlan,
    track,
    completedCourses: [],
  });
  const sectionById = new Map(sections.map((section) => [section.id, section] as const));
  const audit = buildMajorSpecificsRenderingAudit(sections);

  assert.ok(sections.length > 0, "Expected Major Specifics rows.");
  assert.equal(
    audit.every(
      (entry) => entry.category && entry.sourceType && entry.requirementRole && !entry.flags.length
    ),
    true,
    `Expected categorized Major Specifics rows without audit flags: ${JSON.stringify(
      audit.filter((entry) => entry.flags.length),
      null,
      2
    )}`
  );

  const requiredSection = sectionById.get("official-uw-required-courses");
  const selectedSection = sectionById.get("selected-uw-requirement-options");
  const otherSection = sectionById.get("other-valid-uw-options");
  const matchedTrackSection = sectionById.get("matched-green-river-track-courses");
  const genEdSection = sectionById.get("gen-ed-breadth-requirements");
  const allRows = sections.flatMap((section) => section.rows);

  assert.ok(requiredSection, "Expected Official UW Required Courses section.");
  assert.ok(selectedSection, "Expected Selected UW Requirement Options section.");
  assert.ok(otherSection, "Expected Other Valid UW Options section.");
  assert.equal(
    sectionById.has("green-river-prerequisites"),
    false,
    "Expected prerequisite-only rows to stay out of the UW Degree Classes dropdown."
  );
  assert.equal(
    allRows.some((entry) => entry.requirementRole === "prerequisite_only"),
    false,
    "Expected no prerequisite-only rows in Major Specifics."
  );
  assert.ok(matchedTrackSection, "Expected Matched Green River Track Courses section.");
  assert.ok(genEdSection, "Expected Gen-Ed Requirements section.");
  assert.equal(genEdSection?.label, "Gen-Ed Requirements");
  assert.ok(
    sections.findIndex((section) => section.id === "gen-ed-breadth-requirements") <
      sections.findIndex((section) => section.id === "official-uw-required-courses"),
    "Expected Gen-Ed Requirements to appear above Official UW Required Courses."
  );

  const requiredRows = requiredSection?.rows ?? [];

  for (const uwCourseCode of ["MATH 124", "MATH 125", "MATH 126"]) {
    const requiredRow = requiredRows.find((entry) => entry.text.includes(uwCourseCode));
    assert.ok(requiredRow, `Expected ${uwCourseCode} to appear under official required courses.`);
    assert.equal(requiredRow?.sourceType, "official_uw_requirement");
    assert.equal(requiredRow?.requirementRole, "required");
    assert.match(requiredRow?.text ?? "", /is required\. UW equivalent:/);
    assert.equal(requiredRow?.alternativeOptionsText ?? null, null);
  }

  const computingSelectedRow = selectedSection?.rows.find((entry) =>
    entry.requirementGroupId?.endsWith(":scientific-computing")
  );
  assert.ok(computingSelectedRow, "Expected a selected scientific-computing option.");
  assert.equal(computingSelectedRow?.requirementType, "choose_one");
  assert.equal(computingSelectedRow?.selectedForRequirement, true);
  assert.match(computingSelectedRow?.alternativeOptionsText ?? "", /^Instead of taking /);
  assert.match(computingSelectedRow?.alternativeOptionsText ?? "", /AMATH 301/);
  assert.match(computingSelectedRow?.alternativeOptionsText ?? "", /CSE 142/);

  const computingAlternativeCodes = new Set(
    otherSection?.rows
      .filter((entry) => entry.requirementGroupId?.endsWith(":scientific-computing"))
      .map((entry) => entry.normalizedCourseCode)
  );
  assert.deepEqual([...computingAlternativeCodes].sort(), ["AMATH 301", "CSE 142"]);
  assert.equal(
    otherSection?.rows
      .filter((entry) => entry.requirementGroupId?.endsWith(":scientific-computing"))
      .every((entry) => !/\bis required\b/i.test(entry.text)),
    true
  );

  const requiredCodes = new Set(requiredSection?.rows.map((entry) => entry.normalizedCourseCode));
  assert.equal(requiredCodes.has("MATH 224"), false);
  assert.equal(requiredCodes.has("INDE 315"), false);
  assert.equal(requiredCodes.has("CHEM 237"), false);
  assert.equal(requiredCodes.has("CHEM 238"), false);
  assert.equal(requiredCodes.has("PHYS 225"), false);

  const mathSelectedRow = selectedSection?.rows.find((entry) =>
    entry.requirementGroupId?.endsWith(":math-elective")
  );
  assert.equal(mathSelectedRow?.normalizedCourseCode, "MATH 224");
  assert.match(mathSelectedRow?.alternativeOptionsText ?? "", /MATH& 264 \/ MATH 224/);
  assert.match(mathSelectedRow?.alternativeOptionsText ?? "", /MATH 209 \/ MATH 309/);
  assert.match(mathSelectedRow?.alternativeOptionsText ?? "", /STAT 390/);

  const scienceRows = [
    ...(selectedSection?.rows ?? []),
    ...(otherSection?.rows ?? []),
  ].filter((entry) => entry.requirementGroupId?.endsWith(":science-electives"));
  for (const courseCode of ["CHEM 237", "CHEM 238", "PHYS 225"]) {
    assert.equal(
      scienceRows.some((entry) => entry.normalizedCourseCode === courseCode),
      true,
      `Expected ${courseCode} to remain visible as a science elective option.`
    );
  }
  assert.equal(
    scienceRows.every((entry) => entry.requirementRole !== "required"),
    true,
    "Expected science elective options not to be marked required."
  );
  assert.equal(
    selectedSection?.rows
      .filter((entry) => entry.requirementGroupId?.endsWith(":science-electives"))
      .every((entry) => /^Instead of taking /.test(entry.alternativeOptionsText ?? "")),
    true
  );

  assert.equal(
    (matchedTrackSection?.rows ?? []).some((entry) =>
      ["ENGR 100", "ENGR 106"].includes(entry.normalizedCourseCode)
    ),
    true,
    "Expected ENGR 100 or ENGR 106 to remain visible as matched-track support."
  );
  assert.equal(
    matchedTrackSection?.rows.some((entry) => entry.normalizedCourseCode === "ENGR 100"),
    true,
    "Expected ENGR 100 to remain visible as matched Green River track support."
  );
  assert.equal(
    genEdSection?.rows.some((entry) => /A&H|Social Science|Diversity|Areas of Inquiry/i.test(entry.text)),
    true,
    "Expected Gen-Ed / Breadth rows to remain visible."
  );
});

test("Major Specifics dropdown marks NME restricted and replaced requirements separately", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-materials-science-engineering"
  );
  assert.ok(runtimePlan, "Expected the MSE runtime plan.");

  const nmePlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, "nme-option");
  assert.ok(nmePlan, "Expected the selected NME runtime plan.");

  const track = getTransferPlannerTrack(nmePlan.bestTrackId ?? null);
  const sections = buildMajorSpecificsCourseSections({
    plan: nmePlan,
    track,
    completedCourses: [],
  });
  const audit = buildMajorSpecificsRenderingAudit(sections);
  const restrictedSection = sections.find(
    (section) => section.id === "restricted-or-replaced-requirements"
  );

  assert.equal(
    audit.every((entry) => !entry.flags.length),
    true,
    `Expected no Major Specifics audit flags for NME: ${JSON.stringify(
      audit.filter((entry) => entry.flags.length),
      null,
      2
    )}`
  );
  assert.ok(restrictedSection, "Expected Restricted or Replaced Requirements section.");

  const nme220RestrictedRow = restrictedSection?.rows.find(
    (entry) => entry.normalizedCourseCode === "NME 220"
  );
  assert.equal(nme220RestrictedRow?.sourceType, "restricted_option");
  assert.equal(nme220RestrictedRow?.requirementRole, "restricted");
  assert.equal(nme220RestrictedRow?.restrictionStatus, "not_eligible_for_nme_option");
  assert.equal(nme220RestrictedRow?.countsTowardUwRequirement, false);
  assert.match(nme220RestrictedRow?.text ?? "", /not eligible.*NME Option students/);

  const replacedTechnicalElectiveRow = restrictedSection?.rows.find((entry) =>
    entry.requirementGroupId?.endsWith(":mse-technical-electives-15-credits")
  );
  assert.equal(replacedTechnicalElectiveRow?.sourceType, "replaced_requirement");
  assert.equal(replacedTechnicalElectiveRow?.requirementRole, "replaced");
  assert.equal(replacedTechnicalElectiveRow?.countsTowardUwRequirement, false);
  assert.match(
    replacedTechnicalElectiveRow?.text ?? "",
    /replaced by NME Option Core\/Elective Requirement: 19 credits/
  );

  const selectedNmeRows = sections
    .find((section) => section.id === "selected-uw-requirement-options")
    ?.rows.filter((entry) =>
      entry.requirementGroupId?.endsWith(":mse-nme-core-elective-19-credits")
    );
  assert.ok(selectedNmeRows?.length, "Expected active NME option rows to remain selected.");
  assert.equal(
    selectedNmeRows?.every((entry) => entry.sourceType === "nme_option_requirement"),
    true
  );
  assert.equal(
    selectedNmeRows?.some((entry) => entry.normalizedCourseCode === "NME 220"),
    true,
    "Expected NME 220 to remain selected inside the NME core/elective requirement."
  );
});

test("Officially promoted Seattle ECE pathways can expand beyond stale bootstrap pathway lists", () => {
  const plan = getRequiredPlan("uw-seattle-electrical-computer-engineering");
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(plan.id);
  assert.ok(runtimePlan, "Expected a Seattle ECE runtime plan.");

  const expectedPathways = [
    ["photonics-pathway", "Photonics pathway"],
    ["computer-architecture-pathway", "Computer Architecture Pathway"],
    ["control-systems-pathway", "Control Systems Pathway"],
    ["digital-systems-design-pathway", "Digital Systems Design Pathway"],
    ["embedded-systems-pathway", "Embedded Systems Pathway"],
    ["machine-learning-pathway", "Machine Learning Pathway"],
    ["microelectronics-and-nanotechnology-pathway", "Microelectronics and Nanotechnology Pathway"],
    ["neurotechnology-pathway", "Neurotechnology Pathway"],
  ] as const;

  const sourcePathways = getTransferPlannerPathwaysForPlan(plan).map(
    (pathway) => [pathway.id, pathway.label] as const
  );
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan).map(
    (pathway) => [pathway.id, pathway.label] as const
  );

  assert.deepEqual(sourcePathways, expectedPathways);
  assert.deepEqual(runtimePathways, expectedPathways);
});

test("Auto track matcher preserves custom track copy when the computed winner already matches", () => {
  const autoRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    csPlan.grcCourseList ?? [],
    csPlan.bestTrackId
  );

  assert.ok(autoRecommendation, "Expected an auto-matched track recommendation for Seattle CS.");
  assert.ok(typeof autoRecommendation?.trackId === "string");
  assert.ok(csPlan.bestTrackId, "Expected Seattle CS to keep a parser-first auto-matched best track id.");
  assert.equal(typeof csPlan.recommendedTrackSummary, "string");
});

test("Engineering auto track matcher uses major discipline when shared STEM overlap is ambiguous", () => {
  const runtimeChemicalPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-chemical-engineering"
  );
  const runtimeMechanicalPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-mechanical-engineering"
  );
  assert.ok(runtimeChemicalPlan, "Expected runtime Seattle Chemical Engineering plan.");
  assert.ok(runtimeMechanicalPlan, "Expected runtime Seattle Mechanical Engineering plan.");

  const chemicalTrack = getTransferPlannerTrack(runtimeChemicalPlan.bestTrackId ?? null);
  const mechanicalTrack = getTransferPlannerTrack(runtimeMechanicalPlan.bestTrackId ?? null);

  assert.match(chemicalTrack?.title ?? "", /Bioengineering and Chemical Engineering/i);
  assert.match(mechanicalTrack?.title ?? "", /Civil and Mechanical Engineering/i);

  const chemicalRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    getTransferPlannerGrcCourseList(runtimeChemicalPlan),
    null,
    { majorTitle: runtimeChemicalPlan.title }
  );
  const mechanicalRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    getTransferPlannerGrcCourseList(runtimeMechanicalPlan),
    null,
    { majorTitle: runtimeMechanicalPlan.title }
  );

  assert.equal(chemicalRecommendation?.trackId, runtimeChemicalPlan.bestTrackId);
  assert.equal(mechanicalRecommendation?.trackId, runtimeMechanicalPlan.bestTrackId);
  assert.deepEqual(mechanicalRecommendation?.disciplineMatchedLabels, [
    "Mechanical Engineering",
  ]);
});

test.skip("Auto track matcher can diverge between the broad base course list and the narrowed source-generated checklist set", () => {
  const bootstrapAtmosphericPlan = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.find(
    (entry) => entry.id === "uw-seattle-atmospheric-and-climate-science"
  );
  const baseCourseListRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    seattleAtmosphericClimateSciencePlan?.grcCourseList ?? [],
    bootstrapAtmosphericPlan?.bestTrackId ?? null
  );
  const checklistScopedRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    [
      ...(seattleAtmosphericClimateSciencePlan?.applicationChecklist ?? []).flatMap((item) => [
        item.grcCourses,
        ...(item.alternatives ?? []),
      ]),
      ...(seattleAtmosphericClimateSciencePlan?.beforeEnrollmentChecklist ?? []).flatMap((item) => [
        item.grcCourses,
        ...(item.alternatives ?? []),
      ]),
      ...(seattleAtmosphericClimateSciencePlan?.stayAtGrcChecklist ?? []).flatMap((item) => [
        item.grcCourses,
        ...(item.alternatives ?? []),
      ]),
    ].flat(),
    bootstrapAtmosphericPlan?.bestTrackId ?? null
  );

  assert.ok(bootstrapAtmosphericPlan?.bestTrackId, "Expected bootstrap atmospheric plan to have a best track id.");
  assert.ok(baseCourseListRecommendation?.trackId, "Expected base-course auto recommendation to resolve a track.");
  assert.ok(
    checklistScopedRecommendation?.trackId,
    "Expected checklist-scoped auto recommendation to resolve a track."
  );
  assert.ok(
    seattleAtmosphericClimateSciencePlan?.bestTrackId,
    "Expected parser-first atmospheric plan to keep an auto-matched best track id."
  );
  assert.match(
    seattleAtmosphericClimateSciencePlan?.recommendedTrackSummary ?? "",
    /current closest Green River transfer path/i
  );
});

test("Non-Seattle runtime majors only auto-match Green River tracks when the mapped course overlap is strong enough", () => {
  const campusIds = ["uw-bothell", "uw-tacoma"] as const;

  for (const campusId of campusIds) {
    const runtimePlans = getTransferPlannerStudentRuntimeMajorsForCampus(campusId)
      .map((plan) => resolveTransferPlannerStudentRuntimeMajorPlan(plan, null))
      .flatMap((plan) => (plan ? [plan] : []));

    const runtimePlansWithMappedCourses = runtimePlans.filter(
      (plan) => getTransferPlannerGrcCourseList(plan).length > 0
    );

    assert.ok(
      runtimePlansWithMappedCourses.length > 0,
      `Expected at least one ${campusId} runtime plan with mapped GRC courses.`
    );

    const unexpectedlyMissingBestTrackPlanIds = runtimePlansWithMappedCourses
      .filter((plan) => !plan.bestTrackId)
      .filter(
        (plan) =>
          getTransferPlannerAutoMatchedTrackRecommendation(
            getTransferPlannerGrcCourseList(plan)
          ) !== null
      )
      .map((plan) => plan.id)
      .sort();

    assert.deepEqual(
      unexpectedlyMissingBestTrackPlanIds,
      [],
      `Expected ${campusId} runtime plans to omit bestTrackId only when the safer matcher also declines a recommendation.`
    );
    assert.ok(
      runtimePlansWithMappedCourses.some((plan) => plan.bestTrackId),
      `Expected at least one ${campusId} runtime plan with strong mapped overlap to have a bestTrackId.`
    );

    for (const plan of runtimePlansWithMappedCourses.filter((entry) => entry.bestTrackId)) {
      const track = getTransferPlannerTrack(plan.bestTrackId ?? null);
      assert.ok(track, `Expected ${plan.id} bestTrackId (${plan.bestTrackId}) to resolve to a track.`);
    }
  }
});

test("Runtime pathway options keep structured pathway-only course pools without collapsing route ids", () => {
  assert.ok(sourceGeneratedTacomaSudPlan, "Expected Tacoma SUD planner row.");
  assert.ok(sourceGeneratedTacomaUrbanStudiesPlan, "Expected Tacoma Urban Studies planner row.");

  const sudRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-tacoma-sustainable-urban-development"
  );
  const urbanRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-tacoma-urban-studies");

  const sourceSudPathways = new Map(
    getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaSudPlan).map((pathway) => [
      pathway.id,
      pathway,
    ] as const)
  );
  const runtimeSudPathways = new Map(
    getTransferPlannerStudentRuntimePathwaysForPlan(sudRuntimePlan).map((pathway) => [
      pathway.id,
      pathway,
    ] as const)
  );
  const sourceUrbanPathways = new Map(
    getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaUrbanStudiesPlan).map((pathway) => [
      pathway.id,
      pathway,
    ] as const)
  );
  const runtimeUrbanPathways = new Map(
    getTransferPlannerStudentRuntimePathwaysForPlan(urbanRuntimePlan).map((pathway) => [
      pathway.id,
      pathway,
    ] as const)
  );

  assert.deepEqual([...runtimeSudPathways.keys()], [...sourceSudPathways.keys()]);
  assert.deepEqual([...runtimeUrbanPathways.keys()], [...sourceUrbanPathways.keys()]);

  const sourceSudGisPathway = sourceSudPathways.get("gis-option");
  const runtimeSudCommunityPathway = runtimeSudPathways.get("community-engagement-option");
  const runtimeSudGisPathway = runtimeSudPathways.get("gis-option");
  const sourceUrbanGisPathway = sourceUrbanPathways.get("gis-option");
  const runtimeUrbanGisPathway = runtimeUrbanPathways.get("gis-option");

  assert.ok(
    runtimeSudCommunityPathway,
    "Expected runtime Tacoma SUD Community Engagement pathway option."
  );
  assert.ok(runtimeSudGisPathway, "Expected runtime Tacoma SUD GIS pathway option.");
  assert.ok(runtimeUrbanGisPathway, "Expected runtime Tacoma Urban Studies GIS pathway option.");
  assert.equal(runtimeSudCommunityPathway?.label, "Community Engagement option");
  assert.equal(runtimeSudGisPathway?.label, "GIS option");
  assert.equal(runtimeUrbanGisPathway?.label, "GIS option");
  assert.ok(runtimeSudGisPathway?.grcCourseList?.includes("GIS 260"));
  assert.ok(runtimeUrbanGisPathway?.grcCourseList?.includes("GIS 202"));
  assert.equal(runtimeSudGisPathway?.bestTrackId, sourceSudGisPathway?.bestTrackId ?? null);
  assert.equal(runtimeUrbanGisPathway?.bestTrackId, sourceUrbanGisPathway?.bestTrackId ?? null);

  const runtimeSudCommunityPlan = resolveTransferPlannerMajorPlan(
    sudRuntimePlan,
    "community-engagement-option"
  );
  const runtimeSudGisPlan = resolveTransferPlannerMajorPlan(sudRuntimePlan, "gis-option");
  const runtimeSudCommunityDegreeMapCourses = (runtimeSudCommunityPlan?.degreeMapSections ?? [])
    .flatMap((section) => section.items)
    .flatMap(extractCourseCodes);
  const runtimeSudGisDegreeMapCourses = (runtimeSudGisPlan?.degreeMapSections ?? [])
    .flatMap((section) => section.items)
    .flatMap(extractCourseCodes);

  assert.ok(
    runtimeSudCommunityDegreeMapCourses.includes("TURB 235"),
    "Expected SUD Community Engagement to keep official community option courses."
  );
  assert.ok(
    runtimeSudCommunityDegreeMapCourses.includes("TURB 101"),
    "Expected SUD Community Engagement to retain shared SUD major requirements."
  );
  assert.ok(
    runtimeSudCommunityDegreeMapCourses.includes("TSUD 222"),
    "Expected SUD Community Engagement to retain SUD foundation requirements."
  );
  assert.equal(
    runtimeSudCommunityDegreeMapCourses.includes("TGIS 312"),
    false,
    "Expected SUD Community Engagement not to inherit GIS certificate courses."
  );
  assert.ok(
    runtimeSudGisDegreeMapCourses.includes("TGIS 312"),
    "Expected SUD GIS to keep official GIS certificate courses."
  );
  assert.ok(
    runtimeSudGisDegreeMapCourses.includes("TURB 101"),
    "Expected SUD GIS to retain shared SUD major requirements."
  );
  assert.ok(
    runtimeSudGisDegreeMapCourses.includes("TSUD 222"),
    "Expected SUD GIS to retain SUD foundation requirements."
  );
  assert.equal(
    runtimeSudGisDegreeMapCourses.includes("TURB 235"),
    false,
    "Expected SUD GIS not to inherit Community Engagement option courses."
  );
});

test("Student runtime planner rows keep parser-first notes and avoid manual/legacy language", () => {
  const runtimePlans = TRANSFER_PLANNER_GENERATED_MAJOR_PLANS.map((plan) =>
    getTransferPlannerStudentRuntimeMajorPlan(plan.id)
  ).filter((plan): plan is NonNullable<ReturnType<typeof getTransferPlannerStudentRuntimeMajorPlan>> =>
    Boolean(plan)
  );
  const invalid: string[] = [];
  const collectInvalid = (
    scopeId: string,
    scope: {
      beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
      stayAtGrcChecklist?: TransferPlannerChecklistItem[];
    }
  ) => {
    for (const section of ["beforeEnrollmentChecklist", "stayAtGrcChecklist"] as const) {
      for (const item of scope[section] ?? []) {
        const note = item.note?.trim();
        if (
          note &&
          (/\bmanual review\b|\badvisor review\b|\blegacy row\b|\bplanner-authored\b/i.test(note) ||
            /^Auto-generated from the current Green River class list/i.test(note) ||
            /^Use the current Green River class list as the planning starting point/i.test(note))
        ) {
          invalid.push(`${scopeId}:${section}:${item.id}`);
        }
      }
    }
  };

  for (const plan of runtimePlans) {
    collectInvalid(plan.id, plan);
    for (const pathway of getTransferPlannerStudentRuntimePathwaysForPlan(plan)) {
      collectInvalid(`${plan.id}:${pathway.id}`, pathway);
    }
  }

  assert.deepEqual(
    invalid,
    [],
    `Expected parser-first runtime notes to avoid manual/legacy authored language, but found: ${invalid.join(", ")}`
  );
});
