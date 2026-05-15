import {
  assert,
  auditCategoryOptionDetection,
  auditComputerEngineeringApprovedNaturalScienceEquivalencies,
  auditComputerEngineeringApprovedNaturalScienceTransferCategoryFilter,
  auditComputerEngineeringCreditBuckets,
  auditCountedCourses,
  auditOptionAllocation,
  auditOptionCredits,
  auditOptionGroupSatisfaction,
  auditOptionSelectionSources,
  auditOptionTitleFallback,
  auditRequiredMappedCourseCoverage,
  auditRequirementRolePrecedence,
  auditRuntimeCompoundScheduling,
  auditSourceRowBoundaries,
  auditSourceScope,
  auditTrueOptionDetection,
  AUTO_CUSTOM_PREP_FALLBACK_TITLE,
  bioEPlan,
  bioETrack,
  bothellAccountingPlan,
  bothellAmericanEthnicStudiesPlan,
  bothellAppliedComputingPlan,
  bothellBbaPlan,
  bothellBiochemistryPlan,
  bothellBiologyPlan,
  bothellChemistryBaPlan,
  bothellChemistryBsPlan,
  bothellClaPlan,
  bothellCompEPlan,
  bothellCrsPlan,
  bothellCsseIacPlan,
  bothellCssePlan,
  bothellCsseTrack,
  bothellDataVisBaPlan,
  bothellDataVisBsPlan,
  bothellDysPlan,
  bothellEconomicsPlan,
  bothellEePlan,
  bothellElementaryEdPlan,
  bothellEnvironmentalStudiesPlan,
  bothellEssPlan,
  bothellFinancePlan,
  bothellFirstYearRnBsnPlan,
  bothellGlobalStudiesPlan,
  bothellGwssPlan,
  bothellHealthStudiesPlan,
  bothellImdPlan,
  bothellIndividualizedStudyPlan,
  bothellInterdisciplinaryArtsPlan,
  bothellLeppPlan,
  bothellLsiPlan,
  bothellMarketingPlan,
  bothellMathPlan,
  bothellMcsPlan,
  bothellMtvPlan,
  bothellPhysicsBaPlan,
  bothellPhysicsBsPlan,
  bothellPsychologyPlan,
  bothellRnBsnPlan,
  bothellScmPlan,
  bothellSehbPlan,
  bothellStsPlan,
  buildAtOrAboveCadrThresholdTranscriptCourses,
  buildBelowCadrThresholdTranscriptCourses,
  buildChecklistItem,
  buildCompletedTransferableQuarterCreditSummary,
  buildGeneralEducationRequirementLayerDiagnostics,
  buildHistoricalGrcTrackComparison,
  buildQuarterPlan,
  buildRequirementStatuses,
  buildSeattleMechanicalSuggestedPlanForTest,
  buildSourceBackedGeneralEducationRequirementTargets,
  buildSourceBackedMajorGeneralEducationRequirementSection,
  buildSourceBackedRequiredCourseDescriptors,
  buildStatuses,
  buildSuggestedQuarterPlan,
  buildSuggestedQuarterRemainingCreditRange,
  buildTermTranscriptCourse,
  buildTrackUsageSummary,
  buildTranscriptCourses,
  buildTransferPlannerGrcTranscriptReadyCourseCodes,
  buildTransferPlannerStudentCourseEvaluations,
  buildTransferPlannerStudentEvaluationReport,
  buildUwGeneralTransferRequirementSection,
  buildUwTransferMinimumRequirementSummary,
  chemEPlan,
  chemETrack,
  civilPlan,
  collectProjectTextFiles,
  collectVisibleOptionGroupsForTitleAudit,
  compEPlan,
  compETrack,
  csPlan,
  ecePlan,
  envePlan,
  EXPECTED_UW_TRANSFER_ADMISSION_REQUIREMENT_LINES,
  extractCourseCodes,
  findCalcStatus,
  findStatus,
  generatedPlan,
  getAllChecklistItems,
  getChecklistCoverageForPlan,
  getPreparatoryTrackCourseCodeSet,
  getRequiredPlan,
  getRequirementOptionSelection,
  getResolvedRuntimeQuarterPlanningState,
  getResolvedStudentRuntimePlan,
  getResolvedTrackTermsForRequirementDisplay,
  getTransferPlannerAutoMatchedTrackRecommendation,
  getTransferPlannerEquivalencyRulesForSourceCourse,
  getTransferPlannerGrcCourseList,
  getTransferPlannerGrcCourseListGuidance,
  getTransferPlannerMajorsForCampus,
  getTransferPlannerParsedRequirementSourceBlocks,
  getTransferPlannerPathwaysForPlan,
  getTransferPlannerStudentRuntimeMajorPlan,
  getTransferPlannerStudentRuntimeMajorsForCampus,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  getTransferPlannerTrack,
  getUpcomingCourseLabels,
  getUwTransferGenericMilestoneDecision,
  hasCourseAndDistributionPlaceholderSignal,
  hasStructuredPlannerData,
  hcdePlan,
  hcdeTrack,
  individualizedStudiesPlan,
  isePlan,
  isHiddenSourceOnlyRuntimeChecklistTitle,
  isMergedCourseDistributionRequirementLabel,
  isTransferPlannerGrcCourseSetTranscriptReady,
  msePlan,
  normalizeCourseCode,
  readFileSync,
  resolveTransferPlannerMajorPlan,
  resolveTransferPlannerStudentRuntimeMajorPlan,
  seattleAcePlan,
  seattleAcmsPlan,
  seattleAmericanEthnicStudiesPlan,
  seattleAmericanIndianStudiesPlan,
  seattleAnthropologyPlan,
  seattleAppliedMathPlan,
  seattleArchitecturalDesignPlan,
  seattleArchitecturalStudiesPlan,
  seattleArtHistoryPlan,
  seattleArtPlan,
  seattleAsianLanguagesPlan,
  seattleAsianStudiesPlan,
  seattleAstronomyPlan,
  seattleAtmosphericClimateSciencePlan,
  seattleBiochemistrySeattlePlan,
  seattleBiologySeattlePlan,
  seattleBusinessAdministrationPlan,
  seattleCepPlan,
  seattleCfrmPlan,
  seattleChemistrySeattlePlan,
  seattleChinesePlan,
  seattleChiPlan,
  seattleCinemaMediaStudiesPlan,
  seattleClassicalStudiesPlan,
  seattleClassicsPlan,
  seattleCommunicationPlan,
  seattleComparativeLiteraturePlan,
  seattleComparativeReligionPlan,
  seattleConstructionManagementPlan,
  seattleDancePlan,
  seattleDanishPlan,
  seattleDesignPlan,
  seattleDisabilityStudiesPlan,
  seattleDramaPlan,
  seattleEcfsPlan,
  seattleEconomicsPlan,
  seattleEcoPlan,
  seattleEducationStudiesPlan,
  seattleEnglishCreativeWritingPlan,
  seattleEnglishLlcPlan,
  seattleEssPlan,
  seattleMathPlan,
  seattleStatisticsPlan,
  SEEDED_RUNTIME_QA_SAMPLE_PLAN_IDS,
  SEEDED_RUNTIME_QA_SAMPLE_SEED,
  sourceGeneratedTacomaBabaPlan,
  sourceGeneratedTacomaBiomedPlan,
  sourceGeneratedTacomaCriminalJusticePlan,
  tacomaAmcPlan,
  tacomaCivilPlan,
  tacomaCommunicationDetailedPlan,
  tacomaCompEPlan,
  tacomaCompETrack,
  tacomaCssBaPlan,
  tacomaCssBsPlan,
  tacomaEducationPlan,
  tacomaEePlan,
  tacomaEeTrack,
  tacomaEglsDetailedPlan,
  tacomaEnvSciencePlan,
  tacomaEnvSustainabilityPlan,
  tacomaEpaPlan,
  tacomaHealthcareLeadershipPlan,
  tacomaHistoryPlan,
  tacomaIasIndividuallyDesignedPlan,
  tacomaIasPlan,
  tacomaItPlan,
  tacomaLawPolicyPlan,
  tacomaMathPlan,
  tacomaNursingPlan,
  tacomaPpePlan,
  tacomaPsychologyPlan,
  tacomaSocialWelfarePlan,
  tacomaSpanishPlan,
  tacomaSustainableUrbanDevelopmentPlan,
  tacomaUrbanDesignPlan,
  tacomaUrbanStudiesPlan,
  tacomaWritingPlan,
  test,
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS,
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS,
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY,
  TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS,
} from "./transfer-planner.test-support";
import type {
  TranscriptCourseEntry,
  TransferPlannerChecklistItem,
  TransferPlannerMajorPlan,
} from "./transfer-planner.test-support";

test("Seattle CompE also accepts the older MATH& 153 plus MATH& 254 path", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 254"
  );
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(typeof calcStatus.matched, "boolean");
  assert.ok(calcStatus.explicitCourseCodes.includes("MATH& 151"));
  assert.ok(calcStatus.explicitCourseCodes.includes("MATH& 152"));
  assert.ok(
    calcStatus.explicitCourseCodes.includes("MATH& 153") ||
      calcStatus.explicitCourseCodes.includes("MATH& 163")
  );
  assert.ok(
    calcStatus.explicitCourseCodes.includes("MATH& 254") ||
      calcStatus.explicitCourseCodes.includes("MATH& 264")
  );

  const upcomingCourseLabels = getUpcomingCourseLabels(completedCourses);
  assert.equal(typeof upcomingCourseLabels.includes("MATH& 163"), "boolean");
});

test("Seattle CompE still audits the older MATH& 153 plus MATH& 254 path in calc requirement matching", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152", "MATH& 153");
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(calcStatus.matched, false);
  assert.ok(calcStatus.explicitCourseCodes.includes("MATH& 151"));
  assert.ok(calcStatus.explicitCourseCodes.includes("MATH& 152"));
  assert.ok(calcStatus.explicitCourseCodes.includes("MATH& 153"));
  assert.ok(
    calcStatus.explicitCourseCodes.includes("MATH& 254") ||
      calcStatus.explicitCourseCodes.includes("MATH& 264")
  );
});

test("Seattle CompE defaults to the current MATH& 163 path when only Calc I and II are done", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152");
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(calcStatus.matched, false);
  assert.deepEqual(calcStatus.explicitCourseCodes, ["MATH& 151", "MATH& 152", "MATH& 163"]);

  const upcomingCourseLabels = getUpcomingCourseLabels(completedCourses);
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), true);
  assert.equal(upcomingCourseLabels.includes("MATH& 254"), false);
});

test("HCDE accepts two completed calculus classes without requiring the third one", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152");
  const calcStatus = findStatus(hcdePlan, completedCourses, "ten-calc-credits");

  assert.equal(calcStatus.matched, true);
  assert.deepEqual(calcStatus.explicitCourseCodes, ["MATH& 151", "MATH& 152", "MATH& 163"]);

  const upcomingCourseLabels = buildQuarterPlan(hcdePlan, hcdeTrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), false);
});

test("HCDE accepts the full biology sequence as an alternate science bundle", () => {
  const completedCourses = buildTranscriptCourses("BIOL& 211", "BIOL& 212", "BIOL& 213");
  const scienceStatus = findStatus(hcdePlan, completedCourses, "science-three");

  assert.equal(scienceStatus.matched, true);
  assert.deepEqual(scienceStatus.explicitCourseCodes, [
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
  ]);
});

test("HCDE now exposes structured degree-map sections and engineering-fundamentals head starts", () => {
  assert.ok(hcdePlan.degreeMapSections, "Expected Seattle HCDE to include degree-map sections.");
  assert.equal(hcdePlan.degreeMapSections.length >= 3, true);
  assert.match(hcdePlan.degreeMapSections[0]?.title ?? "", /hcde|admissions|engineering|structure/i);

  const grcCourseList = getTransferPlannerGrcCourseList(hcdePlan);

  assert.equal(grcCourseList.includes("ENGR 250"), true);
  assert.equal(grcCourseList.includes("ENGR& 214"), true);
  assert.equal(grcCourseList.includes("ENGR& 225"), true);
});

test("ChemE asks for CHEM& 163 when the student has only CHEM& 161 and CHEM& 162", () => {
  const completedCourses = buildTranscriptCourses("CHEM& 161", "CHEM& 162");
  const chemStatus = findStatus(chemEPlan, completedCourses, "chem142-162");

  assert.equal(chemStatus.matched, false);
  assert.deepEqual(chemStatus.explicitCourseCodes, [
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
  ]);

  const upcomingCourseLabels = buildQuarterPlan(chemEPlan, chemETrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  assert.equal(upcomingCourseLabels.includes("CHEM& 163"), true);
  assert.equal(upcomingCourseLabels.includes("CHEM& 162"), false);
});

test("ChemE now exposes structured degree-map sections without treating UW-only cohort courses as GRC equivalents", () => {
  assert.ok(chemEPlan.degreeMapSections, "Expected Seattle ChemE to include degree-map sections.");
  assert.equal(chemEPlan.degreeMapSections.length >= 3, true);
  assert.match(
    chemEPlan.degreeMapSections[0]?.title ?? "",
    /chemical|cheme|cohort|core|degree|continuation/i
  );

  const grcCourseList = getTransferPlannerGrcCourseList(chemEPlan);

  assert.equal(grcCourseList.includes("ENGR 250"), true);
  assert.equal(grcCourseList.includes("CHEM E 310"), false);
  assert.equal(grcCourseList.includes("CHEM E 375"), false);
});

test("BioE uses the full BIOL& 211-213 sequence for the BIOL 180 pathway", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "PHYS& 221",
    "PHYS& 222",
    "CHEM& 261",
    "ENGR 250",
    "ENGL& 101",
    "BIOL& 211"
  );
  const biologyStatus = findStatus(bioEPlan, completedCourses, "biol180");

  assert.equal(biologyStatus.matched, false);
  assert.deepEqual(biologyStatus.explicitCourseCodes, [
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
  ]);

  const upcomingCourseLabels = buildQuarterPlan(bioEPlan, bioETrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const biol212Index = upcomingCourseLabels.indexOf("BIOL& 212");
  const biol213Index = upcomingCourseLabels.indexOf("BIOL& 213");

  assert.notEqual(biol212Index, -1);
  assert.notEqual(biol213Index, -1);
  assert.equal(biol212Index < biol213Index, true);
});

test("BioE treats ENGR 250 as the cleanest Green River programming requirement", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "PHYS& 221",
    "PHYS& 222",
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
    "CHEM& 261",
    "CS 121",
    "CS 122",
    "CS 123",
    "ENGL& 101"
  );
  const programmingStatus = findStatus(bioEPlan, completedCourses, "programming");

  assert.equal(programmingStatus.matched, false);
  assert.deepEqual(programmingStatus.explicitCourseCodes, ["ENGR 250"]);

  const upcomingCourseLabels = buildQuarterPlan(bioEPlan, bioETrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(upcomingCourseLabels.includes("ENGR 250"), true);
});

test("BioE now exposes structured degree-map sections", () => {
  assert.ok(bioEPlan.degreeMapSections, "Expected Seattle BioE to include degree-map sections.");
  assert.equal(bioEPlan.degreeMapSections.length >= 3, true);
  assert.match(bioEPlan.degreeMapSections[0]?.title ?? "", /bioe|core|fundamental/i);
});

test("Detailed majors expose an explicit per-major Green River course list", () => {
  const grcCourseList = getTransferPlannerGrcCourseList(compEPlan);

  assert.ok(grcCourseList.length > 0);
  assert.equal(grcCourseList.includes("CS 121"), true);
  assert.equal(grcCourseList.includes("MATH& 151"), true);
  assert.equal(grcCourseList.includes("PHYS& 221"), true);
  assert.equal(new Set(grcCourseList).size, grcCourseList.length);
});

test("Seattle CompE keeps linear algebra in the automatic planner beyond the Allen minimum admission classes", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "CS 121",
    "CS 122",
    "CS 123",
    "PHYS& 221",
    "ENGL& 101"
  );
  const math208Status = findStatus(compEPlan, completedCourses, "math208");

  assert.equal(math208Status.matched, false);
  assert.equal(math208Status.item.title, "MATH 208");
  assert.equal(math208Status.item.grcCourses.includes("MATH 240"), true);
  assert.match(
    math208Status.item.note ?? "",
    /Not part of the minimum transfer-admission classes/i
  );
});

test("Seattle CS uses scoped degree PDF rows without optional physics contamination", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "CS 121",
    "CS 122",
    "CS 123",
    "PHYS& 221",
    "ENGL& 101",
    "MATH 238"
  );
  const programmingStatus = findStatus(csPlan, completedCourses, "cse-123-or-cse-143");
  const csCourseList = getTransferPlannerGrcCourseList(csPlan);

  assert.equal(programmingStatus.matched, true);
  assert.equal(programmingStatus.item.title, "CSE 123 or CSE 143");
  assert.equal(csCourseList.includes("MATH 240"), true);
  assert.equal(csCourseList.includes("PHYS& 222"), false);
  assert.equal(csCourseList.includes("BIOL& 211"), false);
});

test("Choice-bucket majors keep the bucket visible when stay-at-GRC planning is included", () => {
  assert.ok(seattleArtHistoryPlan, "Expected a Seattle Art History planner row.");

  const completedCourses = buildTranscriptCourses("ENGL 128");
  const statuses = buildStatuses(seattleArtHistoryPlan, completedCourses);
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: seattleArtHistoryPlan,
    ...statuses,
    completedCourses,
    track: getTransferPlannerTrack(seattleArtHistoryPlan.bestTrackId),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedCourses = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const bucketCourse = plannedCourses.find((course) =>
    /choose 1 from this list/i.test(course.label)
  );
  const explicitFallbackCourse = plannedCourses.find((course) =>
    ["ART& 100", "ART 105"].includes(course.label)
  );

  assert.ok(Array.isArray(plannedCourses));
  if (bucketCourse) {
    assert.match(bucketCourse.label, /choose|intro|art/i);
    assert.match(bucketCourse?.guidanceSummary ?? "", /ART& 100|ART 105/i);
  }
});

test("Seattle ECE now exposes structured degree-map sections", () => {
  assert.ok(ecePlan.degreeMapSections, "Expected Seattle ECE to include degree-map sections.");
  assert.equal(ecePlan.degreeMapSections.length >= 3, true);
  assert.match(ecePlan.degreeMapSections[0]?.title ?? "", /electrical|ece|degree|core|structure/i);
});

test("Seattle Civil now tracks BSCE degree-map head starts at Green River", () => {
  const grcCourseList = getTransferPlannerGrcCourseList(civilPlan);

  assert.equal(
    grcCourseList.includes("ENGL 128") || grcCourseList.includes("ENGL& 101"),
    true
  );
  assert.equal(grcCourseList.includes("ECON& 201"), true);
  assert.equal(grcCourseList.includes("MATH 238"), true);
});

test("Seattle Environmental Engineering now includes optional AUT25 degree-sheet add-ons", () => {
  const grcCourseList = getTransferPlannerGrcCourseList(envePlan);

  assert.ok(envePlan.degreeMapSections, "Expected Seattle EnvE to include degree-map sections.");
  assert.equal(grcCourseList.includes("ECON& 201"), true);
  assert.equal(grcCourseList.includes("MATH 240"), true);
  assert.equal(grcCourseList.includes("CHEM& 163"), true);
});

test("Seattle Environmental Engineering parses programming and keeps CEE 347 out of Matrix/Linear Algebra", () => {
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
  const plannedLabels = suggestedPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const trueOptionAudit = auditTrueOptionDetection({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  });
  const programmingAudit = trueOptionAudit.find((entry) =>
    /computer programming/i.test(entry.requirement)
  );
  const matrixAudit = trueOptionAudit.find((entry) =>
    /matrix|linear algebra/i.test(entry.requirement)
  );
  const earthScienceAudit = trueOptionAudit.find((entry) =>
    /earth science elective/i.test(entry.requirement)
  );
  const requiredCoverageAudit = auditRequiredMappedCourseCoverage({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
  });
  const cee347Coverage = requiredCoverageAudit.find((entry) => entry.uwCourse === "CEE 347");
  const rowBoundaryAudit = auditSourceRowBoundaries({ plan: runtimePlan });
  const cee347Boundary = rowBoundaryAudit.find((entry) =>
    entry.parsedUwCourses.includes("CEE 347")
  );
  const earthScienceBoundary = rowBoundaryAudit.find((entry) =>
    /earth science elective/i.test(entry.parsedRequirementTitle)
  );
  const sourceScopeAudit = auditSourceScope({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
  });
  const earthScienceAcceptedUwOptions = [
    "ATMS 101",
    "ATMS 211",
    "ATMS 212",
    "ESRM 100",
    "ESRM 101",
    "ESRM 210",
    "ESS 106",
    "ESS 201",
    "ESS 211",
    "ESS 212",
    "NUTR 200",
    "OCEAN 102",
    "OCEAN 200",
  ];
  const earthScienceMappedGrcOptions = [
    "GEOL& 101",
    "NATRS 100",
    "NATRS 210",
    "NUTR& 101",
  ];

  assert.ok(programmingAudit, "Expected Computer Programming true-option audit row.");
  assert.deepEqual(programmingAudit.acceptedUwOptions, [
    "AMATH 301",
    "CSE 121",
    "CSE 122",
    "CSE 123",
    "CSE 142",
    "CSE 160",
  ]);
  assert.deepEqual(programmingAudit.mappedGrcOptions, [
    "CS 121",
    "CS 122",
    "CS 123",
    "CS& 141",
    "ENGR 250",
  ]);
  assert.equal(programmingAudit.visibleOptionGroup, true);
  assert.equal(programmingAudit.satisfiedBy, "none");
  assert.equal(
    ["ENGR 250", "CS 121", "CS 122", "CS 123", "CS& 141"].some((courseCode) =>
      plannedLabels.includes(courseCode)
    ),
    false
  );

  assert.ok(matrixAudit, "Expected Matrix/Linear Algebra true-option audit row.");
  assert.deepEqual(matrixAudit.acceptedUwOptions, ["AMATH 352", "MATH 208"]);
  assert.deepEqual(matrixAudit.mappedGrcOptions, ["MATH 240"]);
  assert.equal(matrixAudit.acceptedUwOptions.includes("CEE 347"), false);

  assert.ok(earthScienceAudit, "Expected Earth science elective true-option audit row.");
  assert.deepEqual(earthScienceAudit.acceptedUwOptions, earthScienceAcceptedUwOptions);
  assert.deepEqual(earthScienceAudit.mappedGrcOptions, earthScienceMappedGrcOptions);
  assert.equal(earthScienceAudit.requiredCount, 1);
  assert.equal(earthScienceAudit.detectedAsTrueOption, true);
  assert.equal(earthScienceAudit.visibleOptionGroup, true);
  assert.equal(earthScienceAudit.satisfiedBy, "none");
  assert.equal(earthScienceAudit.issue, null);
  assert.deepEqual(
    earthScienceMappedGrcOptions.filter((courseCode) => plannedLabels.includes(courseCode)),
    []
  );

  assert.ok(earthScienceBoundary, "Expected Earth science source row-boundary audit row.");
  assert.match(earthScienceBoundary.rawRowText, /Choose from: ATMS 101/i);
  assert.deepEqual(earthScienceBoundary.parsedUwCourses, earthScienceAcceptedUwOptions);
  assert.equal(earthScienceBoundary.expectedRowSplit, false);
  assert.equal(earthScienceBoundary.issue, null);
  for (const uwCourse of ["ESS 212", "ESRM 101", "ESRM 210", "NUTR 200"]) {
    const auditRow = sourceScopeAudit.find((entry) => entry.uwCourse === uwCourse);
    assert.ok(auditRow, `Expected Earth science source-scope audit row for ${uwCourse}.`);
    assert.equal(auditRow.detectedRole, "option-list");
    assert.equal(auditRow.promotedToRequired, false);
    assert.equal(auditRow.allowedToSchedule, false);
    assert.equal(auditRow.issue, null);
    assert.match(auditRow.copyOnlyDebugText, /Allowed to schedule: only if selected\/defaulted\/transcript-satisfied/);
  }

  assert.ok(cee347Coverage, "Expected CEE 347 hidden-unmapped coverage audit row.");
  assert.equal(cee347Coverage.requirementType, "hidden-unmapped");
  assert.equal(cee347Coverage.visibleInPlan, false);
  assert.equal(cee347Coverage.hiddenReason?.includes("UW-only/unmapped"), true);
  assert.equal(cee347Coverage.issue, null);
  assert.ok(cee347Boundary, "Expected CEE 347 source row-boundary audit row.");
  assert.equal(cee347Boundary.issue, null);
  assert.equal(
    rowBoundaryAudit.some(
      (entry) =>
        /Matrix\/Linear Algebra/i.test(entry.rawRowText) &&
        entry.issue === "merged-adjacent-rows"
    ),
    false
  );

  const creditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: suggestedPlan,
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
  });
  assert.equal(creditRange.maxRemainingCredits < 125, true);
});

test("Seattle Environmental Engineering selected GEOL& 101 satisfies only the Earth science elective", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-environmental-engineering"
  );
  assert.ok(runtimePlan, "Expected the Environmental Engineering runtime plan.");
  const earthScienceGroup = runtimePlan.requirementGroups?.find((group) =>
    /earth science elective/i.test(group.label ?? "")
  );
  assert.ok(earthScienceGroup, "Expected Earth science elective requirement group.");
  const geolOption = earthScienceGroup.options.find((option) =>
    (option.grcMatches ?? []).includes("GEOL& 101")
  );
  assert.ok(geolOption?.id, "Expected GEOL& 101 mapped Earth science option.");

  const completedCourses: TranscriptCourseEntry[] = [];
  const selectedRequirementOptionIdsByGroup = {
    [earthScienceGroup.id]: [geolOption.id],
  };
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
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const plannedLabels = suggestedPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const earthScienceAudit = auditTrueOptionDetection({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup,
  }).find((entry) => /earth science elective/i.test(entry.requirement));

  assert.deepEqual(
    ["GEOL& 101", "NATRS 100", "NATRS 210", "NUTR& 101"].filter((courseCode) =>
      plannedLabels.includes(courseCode)
    ),
    ["GEOL& 101"]
  );
  assert.equal(earthScienceAudit?.satisfiedBy, "user-selected");
});

test("Seattle Environmental Engineering completed NATRS 210 satisfies the Earth science elective", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-environmental-engineering"
  );
  assert.ok(runtimePlan, "Expected the Environmental Engineering runtime plan.");
  const completedCourses: TranscriptCourseEntry[] = [
    { code: "NATRS 210", label: "NATRS 210", credits: 5 },
  ];
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
  const plannedLabels = suggestedPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const earthScienceAudit = auditTrueOptionDetection({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((entry) => /earth science elective/i.test(entry.requirement));

  assert.deepEqual(
    ["GEOL& 101", "NATRS 100", "NATRS 210", "NUTR& 101"].filter((courseCode) =>
      plannedLabels.includes(courseCode)
    ),
    []
  );
  assert.equal(earthScienceAudit?.satisfiedBy, "transcript-completed");
  assert.equal(earthScienceAudit?.issue, null);
});

test("Seattle Environmental Engineering programming option satisfies from completed CS 122", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-environmental-engineering"
  );
  assert.ok(runtimePlan, "Expected the Environmental Engineering runtime plan.");
  const completedCourses: TranscriptCourseEntry[] = [
    { code: "CS 122", label: "CS 122", credits: 5 },
  ];
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
  const plannedLabels = suggestedPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const programmingAudit = auditTrueOptionDetection({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  }).find((entry) => /computer programming/i.test(entry.requirement));

  assert.ok(programmingAudit, "Expected Computer Programming true-option audit row.");
  assert.equal(programmingAudit.satisfiedBy, "transcript-completed");
  assert.equal(
    ["ENGR 250", "CS 121", "CS 123", "CS& 141"].some((courseCode) =>
      plannedLabels.includes(courseCode)
    ),
    false
  );
});

test("Seattle ISE and MSE expose deeper degree-map data from the latest extraction pass", () => {
  assert.ok(isePlan.degreeMapSections, "Expected Seattle ISE to include degree-map sections.");
  assert.ok(msePlan.degreeMapSections, "Expected Seattle MSE to include degree-map sections.");

  const iseCourseList = getTransferPlannerGrcCourseList(isePlan);
  const mseCourseList = getTransferPlannerGrcCourseList(msePlan);

  assert.equal(iseCourseList.includes("ENGL 128"), true);
  assert.equal(iseCourseList.includes("ENGR& 224"), true);
  assert.equal(mseCourseList.includes("MATH& 264"), true);
});

test("Master-generated partial majors also materialize a Green River course list", () => {
  const sourceGeneratedFallbackPlan = TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS[0] ?? null;
  const candidatePlan = generatedPlan ?? sourceGeneratedFallbackPlan;
  assert.ok(candidatePlan, "Expected at least one source-generated planner row.");

  const grcCourseList = getTransferPlannerGrcCourseList(candidatePlan);

  assert.ok(grcCourseList.length >= 0);
  assert.equal(new Set(grcCourseList).size, grcCourseList.length);
});

test("Bothell CSSE accepts the published writing, two-course calculus, and programming minimums", () => {
  assert.ok(bothellCssePlan, "Expected a Bothell CSSE planner row.");
  assert.ok(bothellCsseTrack, "Expected a Bothell CSSE track.");

  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "CS 121",
    "CS 122",
    "ENGL& 101",
    "ENGL 128"
  );

  const calcStatus = findStatus(bothellCssePlan, completedCourses, "bothell-csse-calc");
  const programmingStatus = findStatus(bothellCssePlan, completedCourses, "bothell-csse-programming");

  assert.equal(calcStatus.matched, true);
  assert.equal(programmingStatus.matched, true);

  const upcomingCourseLabels = buildQuarterPlan(bothellCssePlan, bothellCsseTrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(
    bothellCssePlan?.stayAtGrcChecklist.some((entry) => entry.id === "bothell-csse-calc3"),
    true
  );
  assert.equal(upcomingCourseLabels.includes("CS 123"), false);
  assert.equal(
    bothellCssePlan?.stayAtGrcChecklist.some((entry) => entry.id === "bothell-csse-cs123"),
    true
  );
});

test("Tacoma CompE now requires differential equations and circuit prep in the planner", () => {
  assert.ok(tacomaCompEPlan, "Expected a Tacoma CompE planner row.");
  assert.ok(tacomaCompETrack, "Expected a Tacoma CompE track.");

  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "PHYS& 221",
    "PHYS& 222",
    "CS 121",
    "CS 122",
    "ENGL& 101"
  );

  const math207Status = findStatus(tacomaCompEPlan, completedCourses, "tacoma-compe-math207");
  const circuitsStatus = findStatus(tacomaCompEPlan, completedCourses, "tacoma-compe-circuits");

  assert.equal(math207Status.matched, false);
  assert.equal(circuitsStatus.matched, false);

  const upcomingCourseLabels = buildQuarterPlan(tacomaCompEPlan, tacomaCompETrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(upcomingCourseLabels.includes("MATH 238"), true);
  assert.equal(upcomingCourseLabels.includes("ENGR& 204"), true);
});

test("Tacoma EE accepts one programming course but still recommends a second one", () => {
  assert.ok(tacomaEePlan, "Expected a Tacoma EE planner row.");
  assert.ok(tacomaEeTrack, "Expected a Tacoma EE track.");

  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "MATH 238",
    "PHYS& 221",
    "PHYS& 222",
    "CS 121",
    "ENGR& 204",
    "ENGL& 101"
  );

  const firstProgrammingStatus = findStatus(
    tacomaEePlan,
    completedCourses,
    "tacoma-ee-programming1"
  );
  const secondProgrammingStatus = findStatus(
    tacomaEePlan,
    completedCourses,
    "tacoma-ee-programming2"
  );

  assert.equal(firstProgrammingStatus.matched, true);
  assert.equal(secondProgrammingStatus.matched, false);
});

test("Tacoma converted partial-major batches now land as detailed structured planner rows", () => {
  const convertedPlans = [
    sourceGeneratedTacomaBabaPlan,
    sourceGeneratedTacomaBiomedPlan,
    sourceGeneratedTacomaCriminalJusticePlan,
    tacomaCivilPlan,
    tacomaCommunicationDetailedPlan,
    tacomaEpaPlan,
    tacomaEducationPlan,
    tacomaCssBaPlan,
    tacomaCssBsPlan,
    tacomaAmcPlan,
    tacomaEnvSciencePlan,
    tacomaEnvSustainabilityPlan,
    tacomaHistoryPlan,
    tacomaItPlan,
    tacomaLawPolicyPlan,
    tacomaMathPlan,
    tacomaPsychologyPlan,
    tacomaSocialWelfarePlan,
    tacomaUrbanDesignPlan,
    tacomaEglsDetailedPlan,
    tacomaHealthcareLeadershipPlan,
    tacomaIasPlan,
    tacomaIasIndividuallyDesignedPlan,
    tacomaNursingPlan,
    tacomaPpePlan,
    tacomaSpanishPlan,
    tacomaSustainableUrbanDevelopmentPlan,
    tacomaUrbanStudiesPlan,
    tacomaWritingPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Tacoma planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }

  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaBabaPlan).length, 0);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaCommunicationDetailedPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaAmcPlan).length, 5);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaEnvSustainabilityPlan).length, 6);
  assert.ok(
    getTransferPlannerPathwaysForPlan(tacomaEglsDetailedPlan).length > 0,
    "Expected Tacoma EGLS to preserve option pathways."
  );
  assert.ok(
    getTransferPlannerPathwaysForPlan(tacomaSustainableUrbanDevelopmentPlan).length > 0,
    "Expected Tacoma SUD to preserve option pathways."
  );
  assert.ok(
    getTransferPlannerPathwaysForPlan(tacomaUrbanStudiesPlan).length > 0,
    "Expected Tacoma Urban Studies to preserve option pathways."
  );
  assert.ok(
    getTransferPlannerPathwaysForPlan(tacomaWritingPlan).length > 0,
    "Expected Tacoma Writing Studies to preserve option pathways."
  );
  assert.equal(
    tacomaCivilPlan?.applicationChecklist.some((entry) => entry.id === "uwt-ce-programming"),
    true
  );
  assert.equal(
    tacomaEducationPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwt-education-support"),
    true
  );
  assert.equal(
    tacomaCssBaPlan?.applicationChecklist.some((entry) => entry.id === "uwt-cssba-programming"),
    true
  );
  assert.equal(
    tacomaCssBsPlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uwt-cssbs-math208"),
    true
  );
  assert.equal(
    tacomaItPlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uwt-it-math208"),
    true
  );
  assert.equal(
    tacomaMathPlan?.applicationChecklist.some((entry) => entry.id === "uwt-math-calc123"),
    true
  );
  assert.equal(
    tacomaPsychologyPlan?.applicationChecklist.some((entry) => entry.id === "uwt-psych-foundations"),
    true
  );
  for (const plan of [
    tacomaSocialWelfarePlan,
    tacomaUrbanDesignPlan,
    tacomaEglsDetailedPlan,
    tacomaHealthcareLeadershipPlan,
    tacomaIasPlan,
    tacomaIasIndividuallyDesignedPlan,
    tacomaNursingPlan,
    tacomaPpePlan,
    tacomaSpanishPlan,
    tacomaSustainableUrbanDevelopmentPlan,
    tacomaUrbanStudiesPlan,
    tacomaWritingPlan,
  ]) {
    assert.ok(plan, "Expected Tacoma parser-first detailed planner row.");
  }
});

test("Tacoma Mathematics now keeps the math AA-DTA best track when sequence seeds expose the full calculus prep pool", () => {
  assert.ok(tacomaMathPlan, "Expected Tacoma Mathematics source-generated planner row.");

  const runtimeTacomaMathPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-tacoma-mathematics"),
    null
  );
  assert.ok(runtimeTacomaMathPlan, "Expected Tacoma Mathematics runtime planner row.");

  const expectedTrackId =
    "grc-associate-stem-mathematics-math-curriculum-map-aa-dta-math-emphasis";

  assert.equal(tacomaMathPlan.bestTrackId, expectedTrackId);
  assert.equal(runtimeTacomaMathPlan.bestTrackId, expectedTrackId);
  assert.deepEqual(runtimeTacomaMathPlan.grcCourseList, [
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 163",
    "MATH& 254",
  ]);

  const runtimeRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    runtimeTacomaMathPlan.grcCourseList ?? []
  );
  assert.equal(runtimeRecommendation?.trackId, expectedTrackId);
});

test("Seattle art sibling-choice families now recover the art-history track without reviving broader weak-signal matches", () => {
  assert.ok(seattleArtPlan, "Expected a Seattle Art source-generated planner row.");
  assert.ok(seattleArtHistoryPlan, "Expected a Seattle Art History source-generated planner row.");

  const runtimeArtPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-art"),
    null
  );
  const runtimeArtHistoryPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-art-history"),
    null
  );
  assert.ok(runtimeArtPlan, "Expected a Seattle Art runtime planner row.");
  assert.ok(runtimeArtHistoryPlan, "Expected a Seattle Art History runtime planner row.");

  const expectedTrackId =
    "grc-associate-fine-arts-humanities-arts-aa-dta-concentration-art-history";
  const expectedCoursePool = ["ART 212", "ART 213", "ART 214"];

  for (const plan of [seattleArtPlan, seattleArtHistoryPlan, runtimeArtPlan, runtimeArtHistoryPlan]) {
    assert.equal(plan.bestTrackId, expectedTrackId);
    assert.deepEqual(plan.grcCourseList, expectedCoursePool);
  }

  const artHistoryCreditBucket = runtimeArtPlan.beforeEnrollmentChecklist.find(
    (item) => item.requirementShape === "credit-bucket" && /art history/i.test(item.title)
  );
  assert.ok(
    artHistoryCreditBucket,
    "Expected Seattle Art to preserve the source-backed art-history credit bucket instead of flattening it away."
  );
  assert.deepEqual(artHistoryCreditBucket?.grcCourses, []);

  const artHistoryBuckets = runtimeArtHistoryPlan.beforeEnrollmentChecklist.filter(
    (item) => item.requirementShape === "credit-bucket" && /ART H/i.test(item.title)
  );
  assert.equal(
    artHistoryBuckets.length,
    4,
    "Expected Seattle Art History to preserve each source-backed ART H credit bucket."
  );
  assert.ok(
    artHistoryBuckets.every((item) => item.grcCourses.length === 0),
    "Art History ART H credit buckets should not invent concrete Green River courses."
  );

  const runtimeRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    runtimeArtPlan.grcCourseList ?? []
  );
  assert.equal(runtimeRecommendation?.trackId, expectedTrackId);

  const runtimeGeographyPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-geography"),
    null
  );
  assert.ok(runtimeGeographyPlan, "Expected a Seattle Geography runtime planner row.");
  assert.equal(runtimeGeographyPlan.bestTrackId, null);
});

test("Seattle Asian Languages preserves language and approved-list credit buckets from the source page", () => {
  assert.ok(seattleAsianLanguagesPlan, "Expected a Seattle Asian Languages source-generated planner row.");

  const runtimePlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-asian-languages-and-cultures"),
    null
  );
  assert.ok(runtimePlan, "Expected a Seattle Asian Languages runtime planner row.");

  const creditBuckets =
    runtimePlan.requirementGroups?.filter((group) => group.requirementType === "choose_credits") ?? [];
  assert.equal(creditBuckets.length, 4);

  const primaryLanguageBucket = creditBuckets.find((group) =>
    /15 credits Primary Language/i.test(group.label)
  );
  assert.ok(primaryLanguageBucket, "Expected the source-backed 15-credit primary language bucket.");
  assert.equal(primaryLanguageBucket?.options.length, 0);

  const approvedCourseBucket = creditBuckets.find((group) =>
    /5 credits Literature, Culture, Linguistics/i.test(group.label)
  );
  assert.ok(approvedCourseBucket, "Expected the 5-credit approved course list bucket.");
  assert.match(approvedCourseBucket?.label ?? "", /approved courses$/i);
  assert.equal(approvedCourseBucket?.options.length, 22);

  const electiveBucket = creditBuckets.find((group) =>
    /10 credits Literature, Culture, Linguistics/i.test(group.label)
  );
  assert.ok(electiveBucket, "Expected the 10-credit approved electives bucket.");
  assert.equal(electiveBucket?.options.length, 40);

  const flexibleBucket = creditBuckets.find((group) =>
    /30 Credits Language, Literature, Culture, Linguistics/i.test(group.label)
  );
  assert.ok(flexibleBucket, "Expected the 30-credit flexible AL&L bucket.");
  assert.equal(flexibleBucket?.options.length, 0);

  const fiveCreditBuckets = creditBuckets.filter((group) => group.minCredits === 5 && group.maxCredits === 5);
  assert.equal(fiveCreditBuckets.length, 1, "Expected no duplicate 5-credit placeholder bucket.");
});

test("Seattle quantitative partial-major batch now lands as detailed structured planner rows", () => {
  const convertedPlans = [seattleAppliedMathPlan, seattleMathPlan, seattleStatisticsPlan];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Seattle planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }

  assert.ok(getTransferPlannerPathwaysForPlan(seattleStatisticsPlan).length > 0);
});

test("Next Seattle partial-major batch now lands as detailed structured planner rows", () => {
  const convertedPlans = [
    seattleAmericanEthnicStudiesPlan,
    seattleAmericanIndianStudiesPlan,
    seattleAnthropologyPlan,
    seattleAcmsPlan,
    seattleAcePlan,
    seattleArchitecturalDesignPlan,
    seattleArchitecturalStudiesPlan,
    seattleArtPlan,
    seattleArtHistoryPlan,
    seattleAsianLanguagesPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Seattle planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }

  assert.ok(getTransferPlannerPathwaysForPlan(seattleAcmsPlan).length >= 0);
});

test("Next Seattle partial-major batch now lands as detailed structured planner rows (Asian Studies through Classical Studies)", () => {
  const convertedPlans = [
    seattleAsianStudiesPlan,
    seattleAstronomyPlan,
    seattleAtmosphericClimateSciencePlan,
    seattleBiochemistrySeattlePlan,
    seattleBiologySeattlePlan,
    seattleBusinessAdministrationPlan,
    seattleChemistrySeattlePlan,
    seattleChinesePlan,
    seattleCinemaMediaStudiesPlan,
    seattleClassicalStudiesPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Seattle planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }

  assert.ok(getTransferPlannerPathwaysForPlan(seattleAtmosphericClimateSciencePlan).length > 0);
  assert.ok(getTransferPlannerPathwaysForPlan(seattleBiochemistrySeattlePlan).length > 0);
  assert.ok(getTransferPlannerPathwaysForPlan(seattleBiologySeattlePlan).length > 0);
  assert.ok(getTransferPlannerPathwaysForPlan(seattleChemistrySeattlePlan).length > 0);
});

test("Next Seattle partial-major batch now lands as detailed structured planner rows (Classics through Danish)", () => {
  const convertedPlans = [
    seattleClassicsPlan,
    seattleCommunicationPlan,
    seattleCepPlan,
    seattleChiPlan,
    seattleComparativeLiteraturePlan,
    seattleComparativeReligionPlan,
    seattleCfrmPlan,
    seattleConstructionManagementPlan,
    seattleDancePlan,
    seattleDanishPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Seattle planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }
});

test("Next Seattle partial-major batch now lands as detailed structured planner rows (Design through English LLC)", () => {
  const convertedPlans = [
    seattleDesignPlan,
    seattleDisabilityStudiesPlan,
    seattleDramaPlan,
    seattleEcfsPlan,
    seattleEssPlan,
    seattleEconomicsPlan,
    seattleEducationStudiesPlan,
    seattleEcoPlan,
    seattleEnglishCreativeWritingPlan,
    seattleEnglishLlcPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Seattle planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }
});

test("Next Bothell partial-major batch now lands as detailed structured planner rows", () => {
  const convertedPlans = [
    bothellAmericanEthnicStudiesPlan,
    bothellAppliedComputingPlan,
    bothellBiologyPlan,
    bothellBbaPlan,
    bothellAccountingPlan,
    bothellFinancePlan,
    bothellLsiPlan,
    bothellMarketingPlan,
    bothellScmPlan,
    bothellChemistryBaPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Bothell planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }
});

test("Second Bothell partial-major batch now lands as detailed structured planner rows", () => {
  const convertedPlans = [
    bothellChemistryBsPlan,
    bothellBiochemistryPlan,
    bothellCsseIacPlan,
    bothellCrsPlan,
    bothellClaPlan,
    bothellDataVisBaPlan,
    bothellDataVisBsPlan,
    bothellDysPlan,
    bothellEssPlan,
    bothellEconomicsPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Bothell planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }
});

test("Third Bothell partial-major batch now lands as detailed structured planner rows", () => {
  const convertedPlans = [
    bothellElementaryEdPlan,
    bothellEePlan,
    bothellEnvironmentalStudiesPlan,
    bothellGwssPlan,
    bothellGlobalStudiesPlan,
    bothellHealthStudiesPlan,
    bothellImdPlan,
    bothellInterdisciplinaryArtsPlan,
    bothellIndividualizedStudyPlan,
    bothellLeppPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Bothell planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }
});

test("Final Bothell partial-major batch now lands as detailed structured planner rows", () => {
  const convertedPlans = [
    bothellMtvPlan,
    bothellMathPlan,
    bothellMcsPlan,
    bothellFirstYearRnBsnPlan,
    bothellRnBsnPlan,
    bothellPhysicsBaPlan,
    bothellPhysicsBsPlan,
    bothellPsychologyPlan,
    bothellStsPlan,
    bothellSehbPlan,
  ];

  for (const plan of convertedPlans) {
    assert.ok(plan, "Expected converted Bothell planner row.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(plan.officialLinks.length > 0, `Expected ${plan.title} to keep official links.`);
    assert.ok(plan.degreeMapSections?.length, `Expected ${plan.title} to keep degree-map sections.`);
    assert.ok(
      plan.applicationChecklist.length +
        plan.beforeEnrollmentChecklist.length +
        plan.stayAtGrcChecklist.length >
        0,
      `Expected ${plan.title} to keep structured planner checklist content.`
    );
  }
});

test.skip("Generated planner output keeps support-only classes out of before-enrollment and simplifies kept degree notes", () => {
  const seattleAeroPlan = getRequiredPlan("uw-seattle-aeronautics-astronautics");

  assert.ok(seattleAcePlan, "Expected a Seattle ACE planner row.");
  assert.ok(seattleChemistrySeattlePlan, "Expected a Seattle Chemistry planner row.");
  assert.ok(bothellMcsPlan, "Expected a Bothell MCS planner row.");
  assert.ok(tacomaCompEPlan, "Expected a Tacoma CompE planner row.");
  assert.ok(tacomaEePlan, "Expected a Tacoma EE planner row.");

  assert.equal(
    seattleChemistrySeattlePlan.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uws-chem-organic"
    ),
    false
  );
  assert.equal(
    seattleChemistrySeattlePlan.stayAtGrcChecklist.some(
      (entry) => entry.id === "uws-chem-organic"
    ),
    true
  );
  assert.equal(
    bothellMcsPlan.beforeEnrollmentChecklist.some((entry) => entry.id === "uwb-mcs-intro-media"),
    false
  );
  assert.equal(
    bothellMcsPlan.stayAtGrcChecklist.some((entry) => entry.id === "uwb-mcs-intro-media"),
    true
  );

  const aceProgramming = seattleAcePlan.beforeEnrollmentChecklist.find(
    (entry) => entry.id === "uws-ace-programming"
  );
  const compEPhys122 = compEPlan.beforeEnrollmentChecklist.find((entry) => entry.id === "phys122");
  const compEMath208 = compEPlan.beforeEnrollmentChecklist.find((entry) => entry.id === "math208");
  const compEEe215 = compEPlan.beforeEnrollmentChecklist.find(
    (entry) => entry.id === "ee-205-or-ee-215"
  );
  const eceEe215 = ecePlan.beforeEnrollmentChecklist.find((entry) => entry.id === "engr204");
  const bothellCompEEe215 = bothellCompEPlan?.stayAtGrcChecklist.find(
    (entry) => entry.id === "bothell-compe-circuits"
  );
  const bothellEeEe215 = bothellEePlan?.stayAtGrcChecklist.find(
    (entry) => entry.id === "uwb-ee-circuits"
  );
  const aa260 = seattleAeroPlan.beforeEnrollmentChecklist.find((entry) => entry.id === "aa260");
  const tacomaCompEMath208 = tacomaCompEPlan.beforeEnrollmentChecklist.find(
    (entry) => entry.id === "tacoma-compe-math208"
  );
  const tacomaEeMath208 = tacomaEePlan.beforeEnrollmentChecklist.find(
    (entry) => entry.id === "tacoma-ee-math208"
  );

  assert.equal(aceProgramming?.title, "One programming or data-science course");
  assert.equal(compEPhys122?.title, "PHYS 122");
  assert.equal(compEMath208?.title, "MATH 208");
  assert.match(compEMath208?.note ?? "", /needed to complete the degree either way/i);
  assert.doesNotMatch(compEMath208?.title ?? "", /head start/i);
  assert.equal(compEEe215?.title, "EE 205 or EE 215");
  assert.deepEqual(
    compEEe215?.requirementGroup?.options.find((option) =>
      option.uwCourses.includes("EE 205")
    )?.grcMatches,
    []
  );
  assert.deepEqual(
    compEEe215?.requirementGroup?.options.find((option) =>
      option.uwCourses.includes("EE 215")
    )?.grcMatches,
    ["ENGR& 204"]
  );
  assert.match(compEEe215?.note ?? "", /needed to complete the degree either way/i);
  assert.equal(compEPlan.stayAtGrcChecklist.some((entry) => entry.id === "ee-205-or-ee-215"), false);
  assert.equal(eceEe215?.title, "EE 215");
  assert.match(eceEe215?.note ?? "", /needed to complete the degree either way/i);
  assert.equal(ecePlan.stayAtGrcChecklist.some((entry) => entry.id === "engr204"), false);
  assert.equal(bothellCompEEe215?.title, "B EE 215");
  assert.match(bothellCompEEe215?.note ?? "", /needed to complete the degree either way/i);
  assert.equal(
    bothellCompEPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "bothell-compe-circuits"
    ),
    false
  );
  assert.equal(bothellEeEe215?.title, "B EE 215");
  assert.match(bothellEeEe215?.note ?? "", /needed to complete the degree either way/i);
  assert.equal(
    bothellEePlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uwb-ee-circuits"),
    false
  );
  assert.match(aa260?.note ?? "", /needed to complete the degree either way/i);
  assert.match(tacomaCompEMath208?.note ?? "", /needed to complete the degree either way/i);
  assert.match(tacomaEeMath208?.note ?? "", /needed to complete the degree either way/i);
});

test("Fallback before-enrollment guidance stays blank when no automatic note applies", () => {
  const beforeEnrollmentStatuses = buildRequirementStatuses(
    [buildChecklistItem("math208", "MATH 208", ["MATH 240"])],
    []
  );

  const plannedCourses = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses,
    stayAtGrcStatuses: [],
    completedCourses: [],
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);

  const math240Course = plannedCourses.find((course) => course.label === "MATH 240");

  assert.ok(math240Course, "Expected fallback planning to include MATH 240.");
  assert.equal(math240Course?.guidanceSummary ?? "", "");
});

test("Direct UW transfer matches appear as their own automatic guidance sentence", () => {
  const sequencePlan: TransferPlannerMajorPlan = {
    id: "test-physics-transfer-guidance-plan",
    campusId: "uw-seattle",
    title: "Test Physics Transfer Guidance",
    shortTitle: "Test Physics Transfer Guidance",
    coverage: "detailed",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [
      buildChecklistItem(
        "phys122",
        "PHYS 122",
        ["PHYS& 222"],
        "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way."
      ),
    ],
    stayAtGrcChecklist: [buildChecklistItem("phys123", "PHYS 123", ["PHYS& 223"])],
    advisorFlags: [],
    officialLinks: [],
  };

  const completedCourses = buildTranscriptCourses("PHYS& 221");
  const plannedCourses = buildSuggestedQuarterPlan({
    plan: sequencePlan,
    ...buildStatuses(sequencePlan, completedCourses),
    completedCourses,
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);

  const phys222Course = plannedCourses.find((course) => course.label === "PHYS& 222");
  const phys223Course = plannedCourses.find((course) => course.label === "PHYS& 223");

  assert.ok(phys222Course, "Expected PHYS& 222 to be planned.");
  assert.ok(phys223Course, "Expected PHYS& 223 to be planned.");
  assert.match(
    phys222Course?.guidanceSummary ?? "",
    /^Transfers into PHYS 122\./i
  );
  assert.doesNotMatch(
    phys222Course?.guidanceSummary ?? "",
    /Prerequisite for PHYS& 223\./i
  );
  assert.match(
    phys222Course?.guidanceSummary ?? "",
    /Not part of the minimum transfer-admission classes/i
  );
  assert.equal(
    (phys222Course?.guidanceSummary ?? "").indexOf("Transfers into PHYS 122.") <
      (phys222Course?.guidanceSummary ?? "").indexOf(
        "Not part of the minimum transfer-admission classes"
      ),
    true
  );
  assert.match(phys223Course?.guidanceSummary ?? "", /^Transfers into PHYS 123\./i);
});

test("Obsolete guide-only GRC biology rows do not advertise current BIOL 161 transfer guidance", () => {
  const legacyGuideRules = getTransferPlannerEquivalencyRulesForSourceCourse("BIOL 111");
  const sequencePlan: TransferPlannerMajorPlan = {
    id: "test-obsolete-biology-transfer-guidance-plan",
    campusId: "uw-seattle",
    title: "Test Obsolete Biology Transfer Guidance",
    shortTitle: "Test Obsolete Biology Transfer Guidance",
    coverage: "detailed",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [buildChecklistItem("biol161", "BIOL 161", ["BIOL 111"])],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
  };

  const plannedCourses = buildSuggestedQuarterPlan({
    plan: sequencePlan,
    ...buildStatuses(sequencePlan, []),
    completedCourses: [],
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);

  const biol111Course = plannedCourses.find((course) => course.label === "BIOL 111");

  assert.ok(
    legacyGuideRules.some((rule) => rule.isObsoleteSourceCourse),
    "Expected BIOL 111 to remain present in the raw guide as an obsolete source-course rule."
  );
  assert.ok(biol111Course, "Expected the synthetic fixture to still surface BIOL 111.");
  assert.doesNotMatch(biol111Course?.guidanceSummary ?? "", /^Transfers into BIOL 161\./i);
});

test("Sequence-dependent UW transfer matches include a when-taken-with guidance sentence", () => {
  const sequencePlan: TransferPlannerMajorPlan = {
    id: "test-chemistry-transfer-guidance-plan",
    campusId: "uw-seattle",
    title: "Test Chemistry Transfer Guidance",
    shortTitle: "Test Chemistry Transfer Guidance",
    coverage: "detailed",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [
      buildChecklistItem(
        "chem152-sequence",
        "CHEM 152 sequence",
        ["CHEM& 163"],
        "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way."
      ),
    ],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
  };

  const completedCourses = buildTranscriptCourses("CHEM& 161", "CHEM& 162");
  const plannedCourses = buildSuggestedQuarterPlan({
    plan: sequencePlan,
    ...buildStatuses(sequencePlan, completedCourses),
    completedCourses,
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);

  const chem163Course = plannedCourses.find((course) => course.label === "CHEM& 163");

  assert.ok(chem163Course, "Expected CHEM& 163 to be planned.");
  assert.match(chem163Course?.guidanceSummary ?? "", /^Transfers into /i);
  assert.match(chem163Course?.guidanceSummary ?? "", /CHEM 152/i);
  assert.match(chem163Course?.guidanceSummary ?? "", /CHEM 162/i);
  assert.match(
    chem163Course?.guidanceSummary ?? "",
    /when taken with CHEM& 162\./i
  );
  assert.match(
    chem163Course?.guidanceSummary ?? "",
    /Not part of the minimum transfer-admission classes/i
  );
  assert.equal(
    (chem163Course?.guidanceSummary ?? "").indexOf("when taken with CHEM& 162.") <
      (chem163Course?.guidanceSummary ?? "").indexOf(
        "Not part of the minimum transfer-admission classes"
      ),
    true
  );
});

test.skip("General-education filler guidance now shows running credit progress by category", () => {
  const plan = getRequiredPlan("uw-seattle-computer-science");
  const track = {
    id: "test-general-education-placeholders",
    code: "TEST",
    title: "Test placeholder track",
    summary: "Synthetic placeholder-only track for planner tests.",
    bestFor: ["testing"],
    terms: [
      {
        label: "Year 1 Fall",
        courses: ["Humanities", "Humanities", "Social Science"],
      },
      {
        label: "Year 1 Winter",
        courses: ["Humanities or Social Science", "Elective or General Education"],
      },
    ],
    notes: [],
  };

  const plannedCourses = buildSuggestedQuarterPlan({
    plan,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  const guidanceSummaries = plannedCourses.map((course) => course.guidanceSummary ?? "");

  assert.ok(
    guidanceSummaries.some((guidance) =>
      /5\/20 A&H credits needed for Computer Science\./i.test(guidance)
    )
  );
  assert.ok(
    guidanceSummaries.some((guidance) =>
      /10\/20 A&H credits needed for Computer Science\./i.test(guidance)
    )
  );
  assert.ok(
    guidanceSummaries.some((guidance) =>
      /5\/20 SSc credits needed for Computer Science\./i.test(guidance)
    )
  );
  assert.ok(
    guidanceSummaries.some((guidance) =>
      /5\/20 NSc credits needed for Computer Science\./i.test(guidance)
    )
  );
  assert.ok(
    guidanceSummaries.some((guidance) =>
      /5\/15 elective\/general-education credits needed for Computer Science\./i.test(guidance)
    )
  );
  assert.equal(
    guidanceSummaries.some((guidance) => /A&H\/SSc/i.test(guidance)),
    false
  );
});

test("Seattle Computer Engineering models programming alternatives and missing Math/Science credit buckets", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");
  const completedCourses: TranscriptCourseEntry[] = [];
  const track = getTransferPlannerTrack(runtimePlan.bestTrackId ?? null);
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, completedCourses),
    completedCourses,
    track,
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-08T12:00:00.000Z"),
  });
  const plannedLabels = suggestedPlan
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const trueOptionAudit = auditTrueOptionDetection({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup: {},
  });
  const programmingAudit = trueOptionAudit.find(
    (entry) => entry.requirement === "CSE 123 or CSE 143"
  );
  const bucketAudit = auditComputerEngineeringCreditBuckets({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
  });
  const naturalScienceBucket = bucketAudit.find((entry) =>
    /10 additional credits approved natural science/i.test(entry.requirement)
  );
  const mathScienceBucket = bucketAudit.find((entry) =>
    /3-6 additional Math\/Science/i.test(entry.requirement)
  );
  const requiredCoverageAudit = auditRequiredMappedCourseCoverage({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
  });
  const phys121Coverage = requiredCoverageAudit.find(
    (entry) => entry.uwCourse === "PHYS 121"
  );
  const phys122Coverage = requiredCoverageAudit.find(
    (entry) => entry.uwCourse === "PHYS 122"
  );
  const creditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: suggestedPlan,
    track,
  });

  assert.ok(programmingAudit, "Expected CSE 123/CSE 143 true-option audit row.");
  assert.deepEqual(programmingAudit.acceptedUwOptions, ["CSE 123", "CSE 143"]);
  assert.deepEqual(programmingAudit.mappedGrcOptions, ["CS 123", "CS 145"]);
  assert.equal(programmingAudit.requiredCount, 1);
  assert.equal(programmingAudit.detectedAsTrueOption, true);
  assert.equal(programmingAudit.visibleOptionGroup, true);
  assert.equal(programmingAudit.satisfiedBy, "planner-defaulted");
  assert.equal(programmingAudit.issue, null);
  assert.equal(plannedLabels.includes("CS 123"), true);
  assert.equal(plannedLabels.includes("CS 145"), false);
  assert.equal(
    requiredCoverageAudit.some(
      (entry) =>
        entry.uwCourse === "CSE 143" && entry.issue === "missing-required-mapped-course"
    ),
    false
  );

  assert.ok(phys121Coverage, "Expected PHYS 121 required coverage row.");
  assert.deepEqual(phys121Coverage.mappedGrcEquivalentPath, ["PHYS& 221"]);
  assert.equal(phys121Coverage.requirementType, "single");
  assert.equal(phys121Coverage.visibleInPlan, true);
  assert.equal(phys121Coverage.issue, null);
  assert.ok(phys122Coverage, "Expected PHYS 122 required coverage row.");
  assert.deepEqual(phys122Coverage.mappedGrcEquivalentPath, ["PHYS& 222"]);
  assert.equal(phys122Coverage.requirementType, "single");
  assert.equal(phys122Coverage.visibleInPlan, true);
  assert.equal(phys122Coverage.issue, null);

  assert.ok(naturalScienceBucket, "Expected natural science credit bucket audit row.");
  assert.equal(naturalScienceBucket.creditsRequired, "10");
  assert.equal(naturalScienceBucket.categoryListPlaceholderVisible, true);
  assert.equal(naturalScienceBucket.plannedUnresolvedCredits, "10");
  assert.equal(naturalScienceBucket.issue, null);
  assert.ok(naturalScienceBucket.mappedConcreteOptions.includes("CHEM& 161"));
  assert.ok(naturalScienceBucket.mappedConcreteOptions.includes("PHYS& 223"));

  assert.ok(mathScienceBucket, "Expected Math/Science credit bucket audit row.");
  assert.equal(mathScienceBucket.creditsRequired, "3-6");
  assert.equal(mathScienceBucket.categoryListPlaceholderVisible, true);
  assert.equal(mathScienceBucket.plannedUnresolvedCredits, "3-6");
  assert.equal(mathScienceBucket.issue, null);
  assert.ok(mathScienceBucket.mappedConcreteOptions.includes("MATH 238"));

  assert.ok(creditRange.scheduledMinRemainingCredits > 0);
  assert.ok(
    creditRange.scheduledMaxRemainingCredits >= creditRange.scheduledMinRemainingCredits
  );
  assert.equal(creditRange.exactRemainingCredits, null);
  assert.deepEqual(creditRange.unresolvedPlaceholderLabels, [
    "10 credits of approved Computer Engineering Natural Science",
    "3-6 credits of approved Computer Engineering Math/Science",
  ]);
});

test("Seattle Computer Engineering Natural Science bucket is satisfied by credits, not option count", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");
  const track = getTransferPlannerTrack(runtimePlan.bestTrackId ?? null);
  const completedCourses: TranscriptCourseEntry[] = [];
  const naturalScienceGroup = runtimePlan.requirementGroups?.find((group) =>
    /approved-natural-science-10-credits/.test(group.id)
  );
  assert.ok(naturalScienceGroup, "Expected the CE approved natural science group.");

  const findNaturalScienceOptionId = (predicate: (matches: string[]) => boolean) => {
    const option = naturalScienceGroup.options.find((candidate) =>
      predicate(candidate.grcMatches ?? [])
    );
    assert.ok(option?.id, "Expected a matching CE natural science option.");
    return option.id;
  };
  const buildScenario = (selectedOptionIds?: string[]) => {
    const selectedRequirementOptionIdsByGroup = selectedOptionIds
      ? { [naturalScienceGroup.id]: selectedOptionIds }
      : {};
    const suggestedPlan = buildSuggestedQuarterPlan({
      plan: runtimePlan,
      ...buildStatuses(runtimePlan, completedCourses),
      completedCourses,
      track,
      plannerCollegeId: "uw",
      includeStayAtGrcCourses: false,
      includeStemPrepCourses: false,
      includeSummerQuarter: false,
      selectedRequirementOptionIdsByGroup,
      referenceDate: new Date("2026-05-08T12:00:00.000Z"),
    });
    const plannedLabels = suggestedPlan
      .filter((quarter) => quarter.phase !== "completed")
      .flatMap((quarter) => quarter.courses.map((course) => course.label));
    const plannedCourses = suggestedPlan
      .filter((quarter) => quarter.phase !== "completed")
      .flatMap((quarter) => quarter.courses);
    const bucketAudit = auditComputerEngineeringCreditBuckets({
      plan: runtimePlan,
      suggestedPlan,
      completedCourses,
    }).find((entry) => /10 additional credits approved natural science/i.test(entry.requirement));
    const optionAudit = auditOptionGroupSatisfaction({
      plan: runtimePlan,
      suggestedPlan,
      completedCourses,
      selectedRequirementOptionIdsByGroup,
    }).find((entry) => /approved-natural-science-10-credits/.test(entry.groupId));
    const remainderCourses = suggestedPlan
      .filter((quarter) => quarter.phase !== "completed")
      .flatMap((quarter) => quarter.courses)
      .filter((course) => course.courseRole === "unresolved-credit-bucket-remainder");
    assert.ok(bucketAudit, "Expected CE natural science credit bucket audit row.");
    assert.ok(optionAudit, "Expected CE natural science option resolver audit row.");
    return {
      suggestedPlan,
      plannedCourses,
      plannedLabels,
      bucketAudit,
      optionAudit,
      remainderCourses,
      selectedRequirementOptionIdsByGroup,
    };
  };

  const defaultScenario = buildScenario();
  assert.equal(defaultScenario.bucketAudit.selectedPlaceholder, true);
  assert.equal(defaultScenario.bucketAudit.displayedCreditProgress, "10/10");
  assert.equal(defaultScenario.bucketAudit.plannedUnresolvedCredits, "10");
  assert.equal(defaultScenario.bucketAudit.filterSource, "ce-approved-natural-science");
  assert.equal(defaultScenario.bucketAudit.remainingPlaceholderScheduled, false);
  assert.equal(defaultScenario.bucketAudit.issue, null);
  assert.deepEqual(defaultScenario.bucketAudit.selectedConcreteOptions, []);
  const defaultPhys223 = defaultScenario.plannedCourses.find(
    (course) => course.label === "PHYS& 223"
  );
  if (defaultPhys223) {
    assert.equal(defaultPhys223.courseRole, "local_grc_prerequisite");
  }
  assert.equal(defaultScenario.remainderCourses.length, 0);
  const defaultCreditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: defaultScenario.suggestedPlan,
    track,
  });
  assert.ok(defaultCreditRange.scheduledMinRemainingCredits > 0);
  assert.ok(
    defaultCreditRange.scheduledMaxRemainingCredits >=
      defaultCreditRange.scheduledMinRemainingCredits
  );

  const physScenario = buildScenario([
    findNaturalScienceOptionId((matches) => matches.includes("PHYS& 223")),
  ]);
  assert.equal(physScenario.plannedLabels.includes("PHYS& 223"), true);
  assert.equal(physScenario.bucketAudit.displayedCreditProgress, "5/10");
  assert.equal(physScenario.bucketAudit.totalSatisfyingCredits, "5");
  assert.equal(physScenario.bucketAudit.fullySatisfied, false);
  assert.equal(physScenario.bucketAudit.plannedUnresolvedCredits, "5");
  assert.equal(physScenario.bucketAudit.remainingUnresolvedCredits, "5");
  assert.equal(physScenario.bucketAudit.remainingPlaceholderScheduled, true);
  assert.equal(physScenario.bucketAudit.issue, null);
  assert.equal(
    physScenario.plannedLabels.includes(
      "5 credits of approved Computer Engineering Natural Science remaining"
    ),
    true
  );
  assert.equal(physScenario.optionAudit.satisfactionMode, "credit-based");
  assert.equal(physScenario.optionAudit.displayedProgress, "5/10");
  assert.equal(physScenario.optionAudit.fullySatisfied, false);
  assert.match(
    physScenario.optionAudit.copyOnlyDebugText,
    /Required count: ignored for credit-based groups/
  );

  const chem161Scenario = buildScenario([
    findNaturalScienceOptionId((matches) => matches.includes("CHEM& 161")),
  ]);
  assert.equal(chem161Scenario.plannedLabels.includes("CHEM& 161"), true);
  const chem161CountsScheduledPhys223 =
    chem161Scenario.bucketAudit.scheduledSatisfyingCourses.includes("PHYS& 223");
  assert.equal(
    chem161Scenario.bucketAudit.displayedCreditProgress,
    chem161CountsScheduledPhys223 ? "11/10" : "6/10"
  );
  assert.equal(
    chem161Scenario.bucketAudit.totalSatisfyingCredits,
    chem161CountsScheduledPhys223 ? "11" : "6"
  );
  assert.equal(chem161Scenario.bucketAudit.fullySatisfied, chem161CountsScheduledPhys223);
  assert.equal(
    chem161Scenario.bucketAudit.plannedUnresolvedCredits,
    chem161CountsScheduledPhys223 ? "0" : "4"
  );
  assert.equal(chem161Scenario.bucketAudit.remainingUnresolvedCredits, "4");
  assert.equal(chem161Scenario.bucketAudit.remainingPlaceholderScheduled, true);
  assert.equal(chem161Scenario.bucketAudit.issue, null);
  assert.equal(
    chem161Scenario.plannedLabels.includes(
      "4 credits of approved Computer Engineering Natural Science remaining"
    ),
    true
  );
  assert.equal(chem161Scenario.remainderCourses.length, 1);
  assert.equal(chem161Scenario.remainderCourses[0]?.creditAmount, 4);
  assert.equal(
    chem161Scenario.remainderCourses[0]?.guidanceSummary,
    "Use the CE-approved Natural Science filter in Transfer Category Equivalencies to find Green River courses whose UW equivalents are approved by the Allen School for this requirement. Official source: https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#core"
  );
  const chem161CreditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: chem161Scenario.suggestedPlan,
    track,
  });
  assert.ok(chem161CreditRange.scheduledMinRemainingCredits > 0);
  assert.ok(
    chem161CreditRange.scheduledMaxRemainingCredits >=
      chem161CreditRange.scheduledMinRemainingCredits
  );
  const countedRemainder = auditCountedCourses({
    suggestedPlan: chem161Scenario.suggestedPlan,
  }).find(
    (entry) =>
      entry.course === "4 credits of approved Computer Engineering Natural Science remaining"
  );
  assert.ok(countedRemainder, "Expected counted-course audit for the CE remainder placeholder.");
  assert.equal(countedRemainder.credits, 4);
  assert.deepEqual(countedRemainder.requirementRoles, [
    "unresolved-credit-bucket-remainder",
  ]);
  assert.equal(countedRemainder.countedOnce, true);
  assert.equal(countedRemainder.duplicateCountReason, null);

  const chemSequenceScenario = buildScenario([
    findNaturalScienceOptionId(
      (matches) => matches.includes("CHEM& 162") && matches.includes("CHEM& 163")
    ),
  ]);
  assert.equal(chemSequenceScenario.plannedLabels.includes("CHEM& 162"), true);
  assert.equal(chemSequenceScenario.plannedLabels.includes("CHEM& 163"), true);
  assert.equal(chemSequenceScenario.bucketAudit.displayedCreditProgress, "12/10");
  assert.equal(chemSequenceScenario.bucketAudit.fullySatisfied, true);
  assert.equal(chemSequenceScenario.bucketAudit.remainingPlaceholderScheduled, false);
  assert.equal(chemSequenceScenario.bucketAudit.issue, null);
  assert.equal(chemSequenceScenario.remainderCourses.length, 0);
  const chemSequenceCompoundAudit = auditRuntimeCompoundScheduling({
    ownerId: runtimePlan.id,
    plan: runtimePlan,
    suggestedPlan: chemSequenceScenario.suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup:
      chemSequenceScenario.selectedRequirementOptionIdsByGroup,
  }).find(
    (entry) =>
      /Natural Science/i.test(entry.requirement) &&
      entry.grcCompoundPath.includes("CHEM& 162") &&
      entry.grcCompoundPath.includes("CHEM& 163")
  );
  assert.equal(chemSequenceCompoundAudit?.selectedOption, true);
  assert.deepEqual(chemSequenceCompoundAudit?.scheduledComponents, [
    "CHEM& 162",
    "CHEM& 163",
  ]);
  assert.deepEqual(chemSequenceCompoundAudit?.missingComponents, []);
  assert.equal(chemSequenceCompoundAudit?.satisfied, true);
  assert.equal(chemSequenceCompoundAudit?.issue, "none");

  const chemAndPhysScenario = buildScenario([
    findNaturalScienceOptionId((matches) => matches.includes("CHEM& 161")),
    findNaturalScienceOptionId((matches) => matches.includes("PHYS& 223")),
  ]);
  assert.equal(chemAndPhysScenario.plannedLabels.includes("CHEM& 161"), true);
  assert.equal(chemAndPhysScenario.plannedLabels.includes("PHYS& 223"), true);
  assert.equal(chemAndPhysScenario.bucketAudit.displayedCreditProgress, "11/10");
  assert.equal(chemAndPhysScenario.bucketAudit.fullySatisfied, true);
  assert.equal(chemAndPhysScenario.bucketAudit.remainingPlaceholderScheduled, false);
  assert.equal(chemAndPhysScenario.bucketAudit.issue, null);
  assert.equal(chemAndPhysScenario.remainderCourses.length, 0);
});

test("Seattle Computer Engineering Natural Science filter uses Allen School approved UW equivalents", () => {
  const {
    extractComputerEngineeringApprovedNaturalScienceUwCourseCodesFromText,
  } = require("./computer-engineering-natural-science-source.cjs");
  const extractedSampleCodes =
    extractComputerEngineeringApprovedNaturalScienceUwCourseCodesFromText(`
      Computer Engineering Natural Science
      Biology: 180, 200, 220
      Chemistry: 142/145, 152/155, 162/165
      Physics: 116/119 (but no credit for both 116 and 123), 123, 143, 224
      Earth and Space Sciences: 311, 313
      Astronomy: 301
      Atmospheric Sciences: 301
      Courses not included in the above list may require PHYS 121 and advisor review.
      Computer Engineering Mathematics & Science
    `);

  assert.ok(extractedSampleCodes.includes("CHEM 142"));
  assert.ok(extractedSampleCodes.includes("PHYS 123"));
  assert.ok(extractedSampleCodes.includes("ESS 311"));
  assert.equal(extractedSampleCodes.includes("PHYS 121"), false);

  const filterAudit = auditComputerEngineeringApprovedNaturalScienceTransferCategoryFilter({
    courseCodes: [
      "CHEM& 161",
      "CHEM& 162",
      "CHEM& 163",
      "PHYS& 223",
      "BIOL& 211",
      "BIOL& 212",
      "BIOL& 213",
      "ANTH& 205",
    ],
  });
  const hasIncluded = (coursePattern: RegExp, uwPattern: RegExp) =>
    filterAudit.some(
      (entry) =>
        entry.included === true &&
        coursePattern.test(entry.course) &&
        uwPattern.test(entry.uwEquivalent)
    );

  assert.ok(hasIncluded(/CHEM& 161/, /CHEM 142/));
  assert.ok(hasIncluded(/CHEM& 162.*CHEM& 163/, /CHEM 152.*CHEM 162/));
  assert.ok(hasIncluded(/PHYS& 223/, /PHYS 123/));
  assert.ok(hasIncluded(/BIOL& 211.*BIOL& 212.*BIOL& 213/, /BIOL 180.*BIOL 200.*BIOL 220/));
  assert.ok(
    filterAudit.some(
      (entry) =>
        entry.included === false &&
        entry.reason === "generic-category-only" &&
        /ANTH& 205/.test(entry.course)
    ),
    "Expected generic NSc ANTH& 205 to be excluded from the CE-approved filter."
  );

  const sourceAudit = auditComputerEngineeringApprovedNaturalScienceEquivalencies();
  assert.ok(
    sourceAudit.some(
      (entry) =>
        entry.uwApprovedCourse === "CHEM 142" &&
        entry.grcEquivalentPath.includes("CHEM& 161") &&
        entry.includedInFilter
    )
  );
  assert.ok(sourceAudit.some((entry) => entry.reason === "petition-only"));

  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");
  const track = getTransferPlannerTrack(runtimePlan.bestTrackId ?? null);
  const completedCourses = [{ code: "ANTH& 205", label: "ANTH& 205", credits: 5 }];
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, completedCourses),
    completedCourses,
    track,
    plannerCollegeId: "uw",
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-08T12:00:00.000Z"),
  });
  const bucketAudit = auditComputerEngineeringCreditBuckets({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
  }).find((entry) => /10 additional credits approved natural science/i.test(entry.requirement));

  assert.ok(bucketAudit, "Expected CE Natural Science bucket audit.");
  assert.equal(bucketAudit.filterSource, "ce-approved-natural-science");
  assert.equal(bucketAudit.satisfiedByTranscriptCourses.includes("ANTH& 205"), false);
  assert.equal(bucketAudit.completedSatisfyingCourses.includes("ANTH& 205"), false);
});

test("Seattle Computer Engineering Math/Science bucket uses credit progress for MATH 238", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");
  const completedCourses: TranscriptCourseEntry[] = [];
  const mathScienceGroup = runtimePlan.requirementGroups?.find((group) =>
    /additional-math-science-3-6-credits/.test(group.id)
  );
  assert.ok(mathScienceGroup, "Expected the CE additional Math/Science group.");
  const math238Option = mathScienceGroup.options.find((option) =>
    (option.grcMatches ?? []).includes("MATH 238")
  );
  assert.ok(math238Option?.id, "Expected the MATH 238 option.");
  const selectedRequirementOptionIdsByGroup = {
    [mathScienceGroup.id]: [math238Option.id],
  };
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
  const plannedLabels = suggestedPlan
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const remainderCourses = suggestedPlan
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses)
    .filter((course) => course.courseRole === "unresolved-credit-bucket-remainder");
  const bucketAudit = auditComputerEngineeringCreditBuckets({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
  }).find((entry) => /3-6 additional Math\/Science/i.test(entry.requirement));
  const optionAudit = auditOptionGroupSatisfaction({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
    selectedRequirementOptionIdsByGroup,
  }).find((entry) => /additional-math-science-3-6-credits/.test(entry.groupId));

  assert.ok(bucketAudit, "Expected CE Math/Science credit bucket audit row.");
  assert.ok(optionAudit, "Expected CE Math/Science option resolver audit row.");
  assert.equal(plannedLabels.includes("MATH 238"), true);
  assert.equal(bucketAudit.displayedCreditProgress, "5/3-6");
  assert.equal(bucketAudit.totalSatisfyingCredits, "5");
  assert.equal(bucketAudit.fullySatisfied, true);
  assert.equal(bucketAudit.remainingPlaceholderScheduled, false);
  assert.equal(bucketAudit.issue, null);
  assert.equal(remainderCourses.length, 0);
  assert.equal(optionAudit.satisfactionMode, "credit-based");
  assert.equal(optionAudit.displayedProgress, "5/3-6");
  assert.equal(optionAudit.fullySatisfied, true);
});

test("Seattle Computer Engineering CS 121-123 completion blocks the legacy CS 145 fallback", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");
  const buildUpcomingLabels = (completedCourses: TranscriptCourseEntry[]) =>
    buildSuggestedQuarterPlan({
      plan: runtimePlan,
      ...buildStatuses(runtimePlan, completedCourses),
      completedCourses,
      track: getTransferPlannerTrack(runtimePlan.bestTrackId),
      includeStayAtGrcCourses: true,
      referenceDate: new Date("2026-01-15T12:00:00.000Z"),
    })
      .filter((quarter) => quarter.phase !== "completed")
      .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const completedCourses = buildTranscriptCourses("CS 121", "CS 122", "CS 123");
  const upcomingLabels = buildUpcomingLabels(completedCourses);
  const partialUpcomingLabels = buildUpcomingLabels(
    buildTranscriptCourses("CS 121", "CS 122")
  );
  const sourceBackedDescriptors = buildSourceBackedRequiredCourseDescriptors(
    runtimePlan,
    completedCourses
  );

  assert.equal(
    sourceBackedDescriptors.some((descriptor) =>
      descriptor.explicitCourseCodes.includes("CS 145")
    ),
    false,
    "Expected completed CS 123 -> CSE 123 to satisfy the CSE 123/CSE 143 target set."
  );
  assert.equal(upcomingLabels.includes("CS 145"), false);
  assert.equal(upcomingLabels.includes("CS 123"), false);
  assert.equal(partialUpcomingLabels.includes("CS 123"), true);
  assert.equal(partialUpcomingLabels.includes("CS 145"), false);
});

test("Seattle Computer Engineering CSE 123/CSE 143 alternatives satisfy from either completed path", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");
  const buildPlanForCompletedCourses = (completedCourses: TranscriptCourseEntry[]) =>
    buildSuggestedQuarterPlan({
      plan: runtimePlan,
      ...buildStatuses(runtimePlan, completedCourses),
      completedCourses,
      track: getTransferPlannerTrack(runtimePlan.bestTrackId),
      plannerCollegeId: "uw",
      includeStayAtGrcCourses: false,
      includeStemPrepCourses: false,
      includeSummerQuarter: false,
      referenceDate: new Date("2026-05-08T12:00:00.000Z"),
    });
  const assertCompletedProgrammingPath = (courseCode: "CS 123" | "CS 145") => {
    const completedCourses = buildTranscriptCourses(courseCode);
    const suggestedPlan = buildPlanForCompletedCourses(completedCourses);
    const plannedLabels = suggestedPlan
      .filter((quarter) => quarter.phase !== "completed")
      .flatMap((quarter) => quarter.courses.map((course) => course.label));
    const programmingAudit = auditTrueOptionDetection({
      plan: runtimePlan,
      suggestedPlan,
      completedCourses,
      selectedRequirementOptionIdsByGroup: {},
    }).find((entry) => entry.requirement === "CSE 123 or CSE 143");

    assert.ok(programmingAudit, "Expected CSE 123/CSE 143 true-option audit row.");
    assert.equal(programmingAudit.satisfiedBy, "transcript-completed");
    assert.equal(programmingAudit.issue, null);
    assert.equal(plannedLabels.includes("CS 123"), false);
    assert.equal(plannedLabels.includes("CS 145"), false);
  };

  assertCompletedProgrammingPath("CS 123");
  assertCompletedProgrammingPath("CS 145");
});

test("Seattle Aeronautics runtime now materializes its mapped prep signal into structured planner rows", () => {
  const planningState = getResolvedRuntimeQuarterPlanningState(
    "uw-seattle-aeronautics-astronautics",
    null
  );
  const runtimeCourseList = getTransferPlannerGrcCourseList(planningState.resolvedPlan);
  const runtimeRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(runtimeCourseList);
  const beforeEnrollmentTitles = planningState.resolvedPlan.beforeEnrollmentChecklist.map(
    (item) => item.title
  );

  assert.equal(
    planningState.runtimePlan?.bestTrackId,
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-civil-and-mechanical-engineering"
  );
  assert.equal(runtimeRecommendation?.trackId, planningState.runtimePlan?.bestTrackId ?? null);
  assert.equal(
    planningState.diagnostics.hasStructuredPlannerData,
    true,
    JSON.stringify(planningState.diagnostics)
  );
  assert.equal(
    planningState.diagnostics.hasPlannedQuarterRows,
    true,
    JSON.stringify(planningState.diagnostics)
  );
  assert.ok(beforeEnrollmentTitles.includes("ENGR& 214"));
  assert.ok(beforeEnrollmentTitles.includes("ENGR& 215"));
  assert.ok(beforeEnrollmentTitles.includes("MATH 238"));
  assert.ok(beforeEnrollmentTitles.includes("PHYS& 223"));
  assert.ok(runtimeCourseList.includes("CHEM& 161"));
  assert.ok(runtimeCourseList.includes("ENGL& 101"));
  assert.equal(runtimeCourseList.includes("BIOL& 211"), false);
  assert.equal(runtimeCourseList.includes("CHEM& 261"), false);
});

test("CADR guidance stays hidden without transcript-derived planner credits so it is not a generic always-on UW requirement", () => {
  assert.equal(
    buildUwGeneralTransferRequirementSection(csPlan, {
      completedCourses: [],
      hasTranscriptDerivedCreditSource: false,
    }),
    null
  );
});

test("Transcript-derived completed transferable credits below 40 keep the CADR section visible", () => {
  const completedCourses = buildBelowCadrThresholdTranscriptCourses();
  const creditSummary = buildCompletedTransferableQuarterCreditSummary({
    completedCourses,
    campusId: csPlan.campusId,
  });
  const section = buildUwGeneralTransferRequirementSection(csPlan, {
    completedCourses,
    hasTranscriptDerivedCreditSource: true,
  });

  assert.equal(creditSummary.completedTransferableQuarterCredits, 38);
  assert.deepEqual(creditSummary.countedCourseCodes, [
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "ENGL& 101",
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
  ]);
  assert.deepEqual(creditSummary.excludedIncompleteSequenceCourseCodes, []);
  assert.deepEqual(creditSummary.excludedNonTransferableCourseCodes, []);
  assert.ok(section);
  assert.equal(section?.title, "UW Transfer Admission Requirements");
});

test("Transcript-derived completed transferable credits at or above 40 hide the CADR section", () => {
  const completedCourses = buildAtOrAboveCadrThresholdTranscriptCourses();
  const creditSummary = buildCompletedTransferableQuarterCreditSummary({
    completedCourses,
    campusId: csPlan.campusId,
  });
  const section = buildUwGeneralTransferRequirementSection(csPlan, {
    completedCourses,
    hasTranscriptDerivedCreditSource: true,
  });

  assert.equal(creditSummary.completedTransferableQuarterCredits, 43);
  assert.ok(creditSummary.countedCourseCodes.includes("PHYS& 221"));
  assert.equal(section, null);
});

test("Non-transferable credits do not change the CADR visibility threshold", () => {
  const completedCourses = [
    ...buildBelowCadrThresholdTranscriptCourses(),
    ...buildTranscriptCourses("MATH 097"),
  ];
  const creditSummary = buildCompletedTransferableQuarterCreditSummary({
    completedCourses,
    campusId: csPlan.campusId,
  });
  const section = buildUwGeneralTransferRequirementSection(csPlan, {
    completedCourses,
    hasTranscriptDerivedCreditSource: true,
  });

  assert.equal(creditSummary.completedTransferableQuarterCredits, 38);
  assert.ok(creditSummary.excludedNonTransferableCourseCodes.includes("MATH 097"));
  assert.ok(section);
});

test("Major-specific breadth targets stay intact after the CADR section hides at 40 transferable credits", () => {
  const plan = getRequiredPlan("uw-tacoma-social-welfare");
  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(plan);
  const generalRequirementSection = buildUwGeneralTransferRequirementSection(plan, {
    completedCourses: buildAtOrAboveCadrThresholdTranscriptCourses(),
    hasTranscriptDerivedCreditSource: true,
  });

  assert.equal(generalRequirementSection, null);
  assert.deepEqual(diagnostics.sourceBackedTargets, {
    ahCredits: 20,
    sscCredits: 20,
    nscCredits: 20,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(diagnostics.hasSourceBackedTargets, true);
});

test("Tacoma campus gen-ed source fills AOI minimums for major pages that do not repeat them", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-tacoma-electrical-engineering");
  assert.ok(runtimePlan, "Expected the Tacoma Electrical Engineering runtime plan.");

  const section = buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(runtimePlan), {
    ahCredits: 10,
    sscCredits: 10,
    nscCredits: 10,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.ok(section, "Expected Tacoma campus-backed gen-ed summary items.");
  assert.deepEqual(
    section?.items.map((entry) => `${entry.label}: ${entry.valueText}${entry.note ? ` (${entry.note})` : ""}`),
    [
      "Areas of Inquiry: 40 credits total (Includes no fewer than 10 credits in each area of study.)",
      "Arts & Humanities: 10 credits",
      "Social Sciences: 10 credits",
      "Natural Sciences: 10 credits",
      "Diversity: 5 credits",
    ]
  );
});

test("Materials NME breadth renders the shared A&H/SSc/DIV bucket without inventing A&H 24", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const section = buildSourceBackedMajorGeneralEducationRequirementSection(nmePlan);
  assert.ok(section, "Expected Materials NME source-backed gen-ed summary items.");

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(nmePlan), {
    ahCredits: 10,
    sscCredits: 10,
    nscCredits: 31,
    breadthCredits: 4,
    electiveCredits: null,
  });
  assert.equal(
    section?.items.some(
      (entry) => entry.label === "Arts & Humanities" && entry.valueText === "24 credits"
    ),
    false
  );
  assert.ok(
    section?.items.some(
      (entry) =>
        entry.label === "Areas of Inquiry" &&
        entry.valueText === "24 credits total" &&
        /Shared across Arts & Humanities and Social Sciences/i.test(entry.note ?? "") &&
        /5 credits must also satisfy Diversity/i.test(entry.note ?? "")
    )
  );
  assert.ok(
    section?.items.some(
      (entry) => entry.label === "Arts & Humanities" && entry.valueText === "10 credits"
    )
  );
  assert.ok(
    section?.items.some(
      (entry) => entry.label === "Social Sciences" && entry.valueText === "10 credits"
    )
  );
  assert.ok(
    section?.items.some(
      (entry) =>
        entry.label === "Additional Arts & Humanities / Social Sciences" &&
        entry.valueText === "4 credits"
    )
  );
  assert.ok(
    section?.items.some(
      (entry) =>
        entry.label === "Diversity" &&
        entry.valueText === "5 credits" &&
        /Overlaps with Arts & Humanities \/ Social Sciences/i.test(entry.note ?? "")
    )
  );
});

test("Materials NME planning does not duplicate official breadth with matched-track A&H/SSc placeholders", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const track = getTransferPlannerTrack(nmePlan.bestTrackId ?? null);
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const transferOnlyQuarterPlan = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedCourses = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const transferOnlyPlannedCourses = transferOnlyQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const ahSscPlaceholderCourses = plannedCourses.filter((course) =>
    ["5 credits of Humanities", "5 credits of Social Science", "5 credits of A&H or SSc"].includes(
      course.label
    )
  );

  assert.deepEqual(ahSscPlaceholderCourses.map((course) => course.label), []);
  assert.ok(
    plannedCourses.some((course) =>
      /Engineering Fundamentals Electives|Scientific computing/i.test(
        course.optionGroup?.title ?? ""
      )
    ),
    "Expected unresolved source-backed option prompts instead of auto-filled breadth rows."
  );
  assert.equal(
    ahSscPlaceholderCourses.some((course) =>
      /matched Green River associate pathway/i.test(course.guidanceSummary ?? "")
    ),
    false
  );
  assert.ok(
    ahSscPlaceholderCourses.every((course) =>
      /needed for Materials Science & Engineering \(NME Option\)/i.test(
        course.guidanceSummary ?? ""
      )
    )
  );
  assert.equal(
    plannedCourses.some((course) => /24\/24 A&H credits/i.test(course.guidanceSummary ?? "")),
    false
  );
  assert.equal(
    plannedCourses.some((course) => /15\/15.*matched Green River associate pathway/i.test(course.guidanceSummary ?? "")),
    false
  );
  assert.equal(
    transferOnlyPlannedCourses.some((course) =>
      /matched Green River associate pathway/i.test(course.guidanceSummary ?? "")
    ),
    false
  );
  assert.equal(
    transferOnlyPlannedCourses.some((course) =>
      /Engineering Fundamentals Electives|Scientific computing/i.test(
        course.optionGroup?.title ?? ""
      )
    ),
    true
  );
});

test("Materials NME planning separates UW-major rows from official AST-2 track rows", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const track = getTransferPlannerTrack(nmePlan.bestTrackId ?? null);
  const scientificComputingSelection = getRequirementOptionSelection(
    nmePlan,
    ":scientific-computing",
    "cse-122"
  );
  const plannedCourses = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
    selectedRequirementOptionIdsByGroup: {
      [scientificComputingSelection.groupId]: [scientificComputingSelection.optionId],
    },
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  const cs122 = plannedCourses.find((course) => course.label === "CS 122");
  const engr140 = plannedCourses.find((course) => course.label === "ENGR 140");
  const math141 = plannedCourses.find((course) => course.label === "MATH& 141");
  const chem163 = plannedCourses.find((course) => course.label === "CHEM& 163");

  assert.equal(cs122?.sourceKind, "uw-major-requirement");
  assert.doesNotMatch(
    cs122?.guidanceSummary ?? "",
    /Source-backed UW Materials Science & Engineering/i
  );
  assert.doesNotMatch(cs122?.guidanceSummary ?? "", /Official Green River AST-2/i);
  assert.equal(engr140?.sourceKind, "uw-major-requirement");
  assert.doesNotMatch(
    engr140?.guidanceSummary ?? "",
    /Source-backed UW Materials Science & Engineering/i
  );

  assert.equal(math141?.sourceKind, "official-grc-track");
  assert.doesNotMatch(math141?.guidanceSummary ?? "", /Official Green River AST-2/i);
  assert.equal(chem163?.sourceKind, "uw-major-requirement");
  assert.doesNotMatch(
    chem163?.guidanceSummary ?? "",
    /Official Green River AST-2/i
  );
});

test("Optional STEM prep rows carry test-out guidance while required transfer courses stay untagged", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const track = getTransferPlannerTrack(nmePlan.bestTrackId ?? null);
  const defaultPlannedCourses = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const noPrepPlannedCourses = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    includeStemPrepCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const noPrepLabels = new Set(noPrepPlannedCourses.map((course) => course.label));

  for (const prepCourseCode of ["MATH& 141", "MATH& 142", "CHEM& 140", "PHYS& 114"]) {
    const prepCourse = defaultPlannedCourses.find((course) => course.label === prepCourseCode);
    assert.ok(prepCourse, `Expected ${prepCourseCode} to be planned as optional STEM prep.`);
    assert.equal(prepCourse?.courseRole, "optional_stem_prep");
    assert.equal(prepCourse?.canTestOut, true);
    assert.equal(prepCourse?.visibilityScope, "visible-grc-optional-prep");
    assert.equal(noPrepLabels.has(prepCourseCode), false);
    assert.match(
      prepCourse?.guidanceSummary ?? "",
      /Can be tested out of if not needed\. Check with advisor for details\./
    );
  }

  const prerequisitePrepCourse = defaultPlannedCourses.find(
    (course) =>
      /Prerequisite for/i.test(course.guidanceSummary ?? "") &&
      /Can be tested out of if not needed/i.test(course.guidanceSummary ?? "")
  );
  assert.ok(
    prerequisitePrepCourse,
    "Expected at least one optional STEM prep course to retain prerequisite guidance."
  );
  assert.equal(
    (prerequisitePrepCourse?.guidanceSummary ?? "").indexOf("Prerequisite for") <
      (prerequisitePrepCourse?.guidanceSummary ?? "").indexOf(
        "Can be tested out of if not needed"
      ),
    true
  );

  for (const requiredCourseCode of ["MATH& 151", "CHEM& 161", "PHYS& 221", "ENGL& 101"]) {
    const requiredCourse = defaultPlannedCourses.find(
      (course) => course.label === requiredCourseCode
    );
    assert.ok(requiredCourse, `Expected ${requiredCourseCode} to remain planned.`);
    assert.notEqual(requiredCourse?.courseRole, "optional_stem_prep");
    assert.notEqual(requiredCourse?.canTestOut, true);
    assert.doesNotMatch(
      requiredCourse?.guidanceSummary ?? "",
      /Can be tested out of if not needed\. Check with advisor for details\./
    );
  }
});

test("Materials NME transfer-only coverage resolves mapped requirements, options, and counted identities generically", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-materials-science-engineering"
  );
  assert.ok(runtimePlan, "Expected the Materials runtime plan.");
  const nmePlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME runtime plan.");

  const completedCourses: TranscriptCourseEntry[] = [];
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, completedCourses),
    completedCourses,
    track: getTransferPlannerTrack(nmePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const plannedLabels = new Set(
    suggestedPlan
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses.map((course) => course.label))
  );

  assert.equal(plannedLabels.has("CHEM& 162"), true);
  assert.equal(plannedLabels.has("CHEM& 163"), true);
  assert.equal(plannedLabels.has("MATH& 264"), true);

  const chem152Coverage = auditRequiredMappedCourseCoverage({
    plan: nmePlan,
    suggestedPlan,
    completedCourses,
  }).find((entry) => entry.uwCourse === "CHEM 152");
  assert.deepEqual(chem152Coverage?.mappedGrcEquivalentPath, ["CHEM& 162", "CHEM& 163"]);
  assert.equal(chem152Coverage?.visibleInPlan, true);
  assert.equal(chem152Coverage?.issue, null);
  assert.match(
    chem152Coverage?.copyOnlyDebugText ?? "",
    /^\[copy-only required coverage audit\]/
  );

  const chem152Role = auditRequirementRolePrecedence({
    plan: nmePlan,
    suggestedPlan,
    completedCourses,
  }).find((entry) => entry.uwCourse === "CHEM 152");
  assert.equal(chem152Role?.winningRole, "required");
  assert.match(chem152Role?.scheduledAs ?? "", /CHEM& 162/);
  assert.match(
    chem152Role?.copyOnlyDebugText ?? "",
    /^\[copy-only requirement role precedence audit\]/
  );

  const mathElectiveAudit = auditOptionGroupSatisfaction({
    plan: nmePlan,
    suggestedPlan,
    completedCourses,
  }).find((entry) => /Math Elective/i.test(entry.requirement));
  assert.equal(mathElectiveAudit?.displayedProgress, "1/1");
  assert.equal(mathElectiveAudit?.resolvedSatisfiedCount, 1);
  assert.equal(mathElectiveAudit?.scheduledSatisfyingCourses.includes("MATH& 264"), true);
  assert.equal(mathElectiveAudit?.countedSatisfyingCourses.includes("MATH& 264"), true);
  assert.equal(mathElectiveAudit?.issue, null);
  assert.match(
    mathElectiveAudit?.copyOnlyDebugText ?? "",
    /^\[copy-only option satisfaction resolver audit\]/
  );

  const scienceElectiveAudit = auditOptionGroupSatisfaction({
    plan: nmePlan,
    suggestedPlan,
    completedCourses,
  }).find((entry) => /Science Electives/i.test(entry.requirement));
  assert.equal(scienceElectiveAudit?.displayedProgress, "1/2");
  assert.deepEqual(scienceElectiveAudit?.selectedOptionIds, []);
  assert.equal(scienceElectiveAudit?.scheduledSatisfyingCourses.includes("CHEM& 162"), true);
  assert.equal(scienceElectiveAudit?.scheduledSatisfyingCourses.includes("CHEM& 163"), true);
  assert.equal(scienceElectiveAudit?.issue, null);

  const engineeringFundamentalsAudit = auditOptionGroupSatisfaction({
    plan: nmePlan,
    suggestedPlan,
    completedCourses,
  }).find((entry) => /Engineering Fundamentals/i.test(entry.requirement));
  const engineeringFundamentalsGroup = suggestedPlan
    .flatMap((quarter) => quarter.courses)
    .map((course) => course.optionGroup)
    .find((optionGroup) => /Engineering Fundamentals/i.test(optionGroup?.title ?? ""));
  const engineeringDisplayedProgress = `${
    Math.min(
      [
        ...(engineeringFundamentalsGroup?.selectedOptionIds ?? []),
        ...(engineeringFundamentalsGroup?.resolvedSatisfiedOptionIds ?? []),
      ].length,
      engineeringFundamentalsGroup?.selectionCount ?? 1
    )
  }/${engineeringFundamentalsGroup?.selectionCount ?? 1}`;
  assert.equal(engineeringFundamentalsAudit?.displayedProgress, engineeringDisplayedProgress);
  assert.equal(engineeringFundamentalsAudit?.displayedProgress, "0/2");
  assert.deepEqual(engineeringFundamentalsAudit?.selectedOptionIds, []);

  const optionCreditAudit = auditOptionCredits({ suggestedPlan });
  const biolCreditAudit = optionCreditAudit.find(
    (entry) =>
      /BIOL& 211/i.test(entry.option) &&
      entry.componentCourses.includes("BIOL& 212") &&
      entry.componentCourses.includes("BIOL& 213")
  );
  const chemCreditAudit = optionCreditAudit.find(
    (entry) =>
      /CHEM& 162/i.test(entry.option) &&
      entry.componentCourses.includes("CHEM& 163")
  );
  const mathOptionCreditAudit = optionCreditAudit.find(
    (entry) => /MATH& 264/i.test(entry.option)
  );
  assert.equal(biolCreditAudit?.displayedCredits, "18 credits");
  assert.equal(biolCreditAudit?.countedGrcCredits, "18 credits");
  assert.equal(biolCreditAudit?.issue, null);
  assert.match(biolCreditAudit?.copyOnlyDebugText ?? "", /^\[copy-only option credit audit\]/);
  assert.equal(chemCreditAudit?.displayedCredits, "12 credits");
  assert.equal(chemCreditAudit?.countedGrcCredits, "12 credits");
  assert.equal(chemCreditAudit?.issue, null);
  assert.equal(mathOptionCreditAudit?.displayedCredits, "5 credits");
  assert.equal(mathOptionCreditAudit?.countedGrcCredits, "5 credits");
  assert.equal(mathOptionCreditAudit?.issue, null);

  const optionSelectionSourceAudit = auditOptionSelectionSources({
    suggestedPlan,
    completedCourses,
  });
  const mathOptionSourceAudit = optionSelectionSourceAudit.find((entry) =>
    entry.optionId.includes("math-elective-3")
  );
  const scienceChemOptionSourceAudit = optionSelectionSourceAudit.find((entry) =>
    entry.optionId.includes("science-elective-chem-162")
  );
  const scienceBiolOptionSourceAudit = optionSelectionSourceAudit.find((entry) =>
    entry.optionId.includes("science-elective-biol-180")
  );
  assert.equal(mathOptionSourceAudit?.satisfiedBy, "scheduled-counted");
  assert.equal(mathOptionSourceAudit?.displayedAsSelected, true);
  assert.equal(mathOptionSourceAudit?.issue, null);
  assert.match(
    mathOptionSourceAudit?.copyOnlyDebugText ?? "",
    /^\[copy-only option selection source audit\]/
  );
  assert.equal(scienceChemOptionSourceAudit?.satisfiedBy, "scheduled-counted");
  assert.equal(scienceChemOptionSourceAudit?.displayedAsSelected, true);
  assert.equal(scienceChemOptionSourceAudit?.issue, null);
  assert.equal(scienceBiolOptionSourceAudit?.satisfiedBy, "none");
  assert.equal(scienceBiolOptionSourceAudit?.displayedAsSelected, false);

  const nmeOptionAllocationAudit = auditOptionAllocation({
    suggestedPlan,
    completedCourses,
  });
  const nmeOptionTitleAudit = auditOptionTitleFallback({
    optionGroups: collectVisibleOptionGroupsForTitleAudit(suggestedPlan),
    forceNumberedTitles: true,
  });
  const nmeMathTitleAudit = nmeOptionTitleAudit.find((entry) =>
    /math-elective/.test(entry.groupId)
  );
  const nmeScienceTitleAudit = nmeOptionTitleAudit.find((entry) =>
    /science-electives/.test(entry.groupId)
  );
  assert.equal(nmeMathTitleAudit?.displayedTitle, "Requirement Choice 1");
  assert.equal(nmeMathTitleAudit?.originalTitle, "One (1) Math Elective");
  assert.equal(nmeMathTitleAudit?.reason, "forced-numbered-option-title");
  assert.equal(nmeScienceTitleAudit?.displayedTitle, "Requirement Choice 3");
  assert.equal(nmeScienceTitleAudit?.originalTitle, "Two Science Electives");
  assert.equal(nmeScienceTitleAudit?.reason, "forced-numbered-option-title");
  const nmeScienceAllocation = nmeOptionAllocationAudit.find((entry) =>
    /Science Electives/i.test(entry.groupTitle)
  );
  const nmeEngineeringFundamentalsAllocation = nmeOptionAllocationAudit.find((entry) =>
    /Engineering Fundamentals/i.test(entry.groupTitle)
  );
  assert.equal(
    (nmeScienceAllocation?.resolvedDisplayedOptionIdsAfterCap.length ?? 0) <=
      (nmeScienceAllocation?.requiredCount ?? 0),
    true
  );
  assert.deepEqual(nmeEngineeringFundamentalsAllocation?.resolvedDisplayedOptionIdsAfterCap, []);

  const countedMath = auditCountedCourses({ suggestedPlan }).find(
    (entry) => entry.course === "MATH& 264"
  );
  const countedChem162 = auditCountedCourses({ suggestedPlan }).find(
    (entry) => entry.course === "CHEM& 162"
  );
  assert.equal(countedMath?.countedOnce, true);
  assert.equal(countedMath?.credits, 5);
  assert.equal(countedMath?.requirementRoles.includes("prerequisite"), true);
  assert.equal(countedMath?.requirementRoles.includes("option-satisfaction"), true);
  assert.match(countedMath?.duplicateCountReason ?? "", /credit is counted once/i);
  assert.match(countedMath?.copyOnlyDebugText ?? "", /^\[copy-only counted course audit\]/);
  assert.equal(countedChem162?.credits, 6);
});

test("Materials NME filler placeholders are not labeled as official AST-2 track content", () => {
  const sourcePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const nmePlan = resolveTransferPlannerMajorPlan(sourcePlan, "nme-option");
  assert.ok(nmePlan, "Expected the Materials NME source plan.");

  const track = getTransferPlannerTrack(nmePlan.bestTrackId ?? null);
  const plannedCourses = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...buildStatuses(nmePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const naturalSciencePlaceholders = plannedCourses.filter(
    (course) => course.label === "5 credits of Natural Sciences"
  );

  assert.ok(
    naturalSciencePlaceholders.every((course) => course.sourceKind === "uw-major-breadth")
  );
  assert.ok(
    naturalSciencePlaceholders.every((course) =>
      /needed for Materials Science & Engineering/i.test(
        course.guidanceSummary ?? ""
      )
    )
  );
  assert.equal(
    naturalSciencePlaceholders.some((course) =>
      /official matched Green River associate pathway map|Official Green River AST-2/i.test(
        course.guidanceSummary ?? ""
      )
    ),
    false
  );
  assert.ok(
    plannedCourses.some((course) => /Science Electives/i.test(course.optionGroup?.title ?? "")),
    "Expected the unresolved source-backed Science Electives option group to remain visible."
  );
});

test("Computer Engineering planning gets the same UW-major versus official GRC track attribution", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Computer Engineering runtime plan.");
  const track = getTransferPlannerTrack(runtimePlan.bestTrackId ?? null);
  assert.ok(track, "Expected the Computer Engineering matched GRC track.");

  const plannedCourses = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const cs121 = plannedCourses.find((course) => course.label === "CS 121");
  const cs123 = plannedCourses.find((course) => course.label === "CS 123");
  const phys221 = plannedCourses.find((course) => course.label === "PHYS& 221");
  const math141 = plannedCourses.find((course) => course.label === "MATH& 141");

  assert.equal(cs121?.sourceKind, "official-grc-track");
  assert.equal(cs121?.courseRole, "local_grc_prerequisite");
  assert.doesNotMatch(cs121?.guidanceSummary ?? "", /Source-backed UW Computer Engineering/i);
  assert.equal(cs123?.sourceKind, "uw-major-requirement");
  assert.match(cs123?.guidanceSummary ?? "", /Source-backed UW Computer Engineering/i);
  assert.equal(phys221?.sourceKind, "uw-major-requirement");
  assert.match(phys221?.guidanceSummary ?? "", /Source-backed UW Computer Engineering/i);
  assert.equal(math141?.sourceKind, "official-grc-track");
  assert.doesNotMatch(math141?.guidanceSummary ?? "", /Official Green River AST-2\/MRP/i);
});

test("Matched-track gen-ed guidance yields to official UW breadth targets for another shared-bucket major", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-human-centered-design-engineering"
  );
  assert.ok(runtimePlan, "Expected the HCDE runtime plan.");
  const track = {
    id: "test-hcde-duplicate-general-education-placeholders",
    code: "TEST-HCDE",
    title: "HCDE duplicate placeholder track",
    summary: "Synthetic HCDE placeholder-only track for planner tests.",
    bestFor: ["testing"],
    terms: [
      {
        label: "Year 1 Fall",
        courses: ["Humanities", "Social Science", "Humanities or Social Science"],
      },
    ],
    notes: [],
  };

  const plannedCourses = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...buildStatuses(runtimePlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const matchedTrackGenEds = plannedCourses.filter((course) =>
    /matched Green River associate pathway/i.test(course.guidanceSummary ?? "")
  );

  assert.equal(
    matchedTrackGenEds.some((course) =>
      ["5 credits of Humanities", "5 credits of Social Science", "5 credits of A&H or SSc"].includes(
        course.label
      )
    ),
    false
  );
  assert.ok(
    plannedCourses.some(
      (course) =>
        ["5 credits of Humanities", "5 credits of Social Science", "5 credits of A&H or SSc"].includes(
          course.label
        ) &&
        /needed for Human Centered Design & Engineering/i.test(
          course.guidanceSummary ?? ""
        )
    )
  );
});

test("Bothell Applied Computing category-first breadth lines recover separate A&H and SSc targets", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-bothell-applied-computing");
  assert.ok(runtimePlan, "Expected the Applied Computing runtime plan.");

  const section = buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(runtimePlan), {
    ahCredits: 15,
    sscCredits: 15,
    nscCredits: 15,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.ok(section, "Expected Applied Computing source-backed gen-ed summary items.");
  assert.deepEqual(
    section?.items.map((entry) => `${entry.label}: ${entry.valueText}`),
    [
      "Arts & Humanities: 15 credits",
      "Social Sciences: 15 credits",
      "Diversity: 5 credits",
      "Natural Sciences: 15 credits",
    ]
  );
  assert.equal(
    section?.items.some((entry) => /Arts & Humanities \/ Social Sciences/i.test(entry.label)),
    false
  );
});

test("Bothell campus gen-ed source fills AOI targets for major pages that do not repeat them", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-bothell-electrical-engineering");
  assert.ok(runtimePlan, "Expected the Electrical Engineering runtime plan.");

  const section = buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(runtimePlan), {
    ahCredits: 15,
    sscCredits: 15,
    nscCredits: 15,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.ok(section, "Expected Bothell campus-backed gen-ed summary items.");
  assert.deepEqual(
    section?.items.map((entry) => `${entry.label}: ${entry.valueText}${entry.note ? ` (${entry.note})` : ""}`),
    [
      "Arts & Humanities: 15 credits",
      "Social Sciences: 15 credits",
      "Natural Sciences: 15 credits",
      "Diversity: 5 credits (May also apply to an Area of Inquiry requirement.)",
    ]
  );
});

test("Computer Engineering Areas-of-Inquiry range targets surface as summary items and plannable minimums", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimePlan, "Expected the Computer Engineering runtime plan.");

  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(runtimePlan);
  const section = buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(runtimePlan), {
    ahCredits: 10,
    sscCredits: 10,
    nscCredits: 40,
    breadthCredits: 4,
    electiveCredits: null,
  });
  assert.ok(section, "Expected Computer Engineering to expose structured ranged summary items.");
  assert.deepEqual(
    section?.items.map((entry) => `${entry.label}: ${entry.valueText}${entry.note ? ` (${entry.note})` : ""}`),
    [
      "Diversity: 5 credits",
      "Areas of Inquiry: 30 credits total",
      "Arts & Humanities: 10 credits",
      "Social Sciences: 10 credits",
      "Natural Sciences: 40 credits",
      "Additional Arts & Humanities / Social Sciences: 4 credits",
    ]
  );
  assert.equal(diagnostics.hasSourceBackedTargets, true);
  assert.ok(diagnostics.sourceBackedSummarySection);
});

test("Seattle Mechanical Engineering expands A&H/SSc reach-total gen-ed text into the additional remainder", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-mechanical-engineering");
  assert.ok(runtimePlan, "Expected the Mechanical Engineering runtime plan.");

  const section = buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(runtimePlan), {
    ahCredits: 10,
    sscCredits: 10,
    nscCredits: 40,
    breadthCredits: 4,
    electiveCredits: null,
  });
  assert.ok(section, "Expected Mechanical Engineering to expose Engineering gen-ed targets.");
  assert.deepEqual(
    section?.items.map((entry) => `${entry.label}: ${entry.valueText}${entry.note ? ` (${entry.note})` : ""}`),
    [
      "Arts & Humanities: 10 credits",
      "Social Sciences: 10 credits",
      "Additional Arts & Humanities / Social Sciences: 4 credits",
      "Natural Sciences: 40 credits",
      "Diversity: 5 credits (May also apply to an Area of Inquiry requirement.)",
    ]
  );
});

test("Seattle Jewish Studies uses college-level gen-ed targets without using 300-400-level elective prose", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-jewish-studies");
  assert.ok(runtimePlan, "Expected the Jewish Studies runtime plan.");

  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(runtimePlan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(runtimePlan), {
    ahCredits: 20,
    sscCredits: 20,
    nscCredits: 20,
    breadthCredits: null,
    electiveCredits: 15,
  });
  assert.ok(buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan));
  assert.equal(diagnostics.hasSourceBackedTargets, true);
});

test("Seattle Aeronautics does not misread the science-core NSc option as a 5-credit general-education target", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");

  const completedCourses = buildTranscriptCourses("CS 123", "MATH 238", "MATH& 254");
  const statuses = buildStatuses(runtimePlan, completedCourses);
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...statuses,
    completedCourses,
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const completedGuidanceSummaries = quarterPlan
    .filter((quarter) => quarter.phase === "completed")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => ["CS 123", "MATH 238", "MATH& 254"].includes(course.label))
        .map((course) => course.guidanceSummary ?? "")
    );

  assert.equal(completedGuidanceSummaries.length, 3);
  for (const guidanceSummary of completedGuidanceSummaries) {
    assert.doesNotMatch(
      guidanceSummary,
      /NSc credits needed for Aeronautics & Astronautics\./i
    );
  }
});

test("Seattle Aeronautics preserves mixed course/category science option choices", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");

  const statuses = buildStatuses(runtimePlan, []);
  const suggestedPlan = buildSuggestedQuarterPlan({
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
  const optionGroups = collectVisibleOptionGroupsForTitleAudit(suggestedPlan);
  const scienceChoiceGroup = optionGroups.find(
    (group) =>
      group.options.some((option) => option.courseCodes.includes("ENGR& 114")) &&
      group.options.some((option) => option.categoryOption?.category === "NSC")
  );

  assert.ok(scienceChoiceGroup, "Expected A&A science choice group to include ME 123 and NSc options.");
  assert.equal(scienceChoiceGroup?.selectionCount, 1);
  assert.deepEqual(scienceChoiceGroup?.resolvedSatisfiedOptionIds ?? [], []);
  assert.equal(
    scienceChoiceGroup?.options.some((option) => /5 credits of Natural Sciences \(NSc\)/i.test(option.label)),
    true
  );
  assert.equal(
    scienceChoiceGroup?.options.some((option) => option.courseCodes.includes("CSE 160")),
    false,
    "CSE 160 should remain accepted in source data but hidden from GRC scheduling without a mapping."
  );

  const categoryAudit = auditCategoryOptionDetection({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses: [],
  }).find((entry) => /Natural Sciences|NSc/i.test(entry.category) || /Natural Sciences/i.test(entry.sourceText));
  assert.ok(categoryAudit, "Expected category option detection audit row.");
  assert.equal(categoryAudit?.visibleOption, true);
  assert.equal(categoryAudit?.issue, null);

  const satisfactionAudit = auditOptionGroupSatisfaction({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses: [],
  }).find((entry) => entry.groupId === scienceChoiceGroup?.id);
  assert.ok(satisfactionAudit, "Expected option satisfaction audit row for A&A science choice.");
  assert.equal(satisfactionAudit?.displayedProgress, "0/1");
  assert.match(satisfactionAudit?.copyOnlyDebugText ?? "", /Category options: .*Natural Sciences/);
});

test("Seattle Aeronautics does not promote elective credit-cap notes into checklist choices", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");

  const visibleChecklistText = [
    ...(runtimePlan.beforeEnrollmentChecklist ?? []),
    ...(runtimePlan.stayAtGrcChecklist ?? []),
  ]
    .map((item) => `${item.title} ${item.sourceSection ?? ""}`)
    .join("\n");

  assert.doesNotMatch(
    visibleChecklistText,
    /\bAA 499\b.*\bENGR 321\b|\bENGR 321\b.*\bAA 499\b/i,
    "A&A research/internship credit-cap note should remain source evidence, not a standalone choice row."
  );
});

test("Seattle Aeronautics maps the single CHEM 142 source row without promoting the full chemistry sequence", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");

  const visibleCourseLabels = new Set(
    [
      ...(runtimePlan.beforeEnrollmentChecklist ?? []),
      ...(runtimePlan.stayAtGrcChecklist ?? []),
      ...(runtimePlan.grcCourseList ?? []).map((title) => ({ title })),
    ].map((item) => item.title)
  );

  assert.ok(
    visibleCourseLabels.has("CHEM& 161"),
    "A&A should keep the Green River equivalent for the UW CHEM 142 requirement."
  );
  assert.ok(
    !visibleCourseLabels.has("CHEM& 162") && !visibleCourseLabels.has("CHEM& 163"),
    "A&A should not use the full Green River chemistry sequence unless the source requires CHEM 152/162 too."
  );
});

test("Seattle Aeronautics category science option can satisfy from an unused NSc transcript course", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");

  const completedCourses = buildTranscriptCourses("GEOL& 101");
  const statuses = buildStatuses(runtimePlan, completedCourses);
  const suggestedPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    ...statuses,
    completedCourses,
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup: {},
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const plannedLabels = new Set(
    suggestedPlan
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses.map((course) => course.label))
  );
  const optionGroups = collectVisibleOptionGroupsForTitleAudit(suggestedPlan);
  const scienceChoiceGroup = optionGroups.find((group) =>
    group.options.some((option) => option.categoryOption?.category === "NSC")
  );
  const resolvedCategoryOptionIds = new Set(scienceChoiceGroup?.resolvedSatisfiedOptionIds ?? []);
  const categoryOption = scienceChoiceGroup?.options.find(
    (option) => option.categoryOption?.category === "NSC"
  );

  assert.ok(scienceChoiceGroup, "Expected A&A science category option group.");
  assert.ok(categoryOption, "Expected NSc category option.");
  assert.equal(resolvedCategoryOptionIds.has(categoryOption?.id ?? ""), true);
  assert.equal(plannedLabels.has("ENGR& 114"), false);

  const categoryAudit = auditCategoryOptionDetection({
    plan: runtimePlan,
    suggestedPlan,
    completedCourses,
  }).find((entry) => entry.category === "NSc");
  assert.equal(categoryAudit?.satisfiedByTranscriptCourse, "GEOL& 101");
  assert.equal(categoryAudit?.issue, null);
});

test("Applied Mathematics track guidance keeps breadth placeholders clearly labeled as matched-pathway planner guidance", () => {
  const plan = getRequiredPlan("uw-seattle-applied-mathematics");
  const track = {
    id: "test-apmath-general-education-placeholders",
    code: "TEST-APMATH",
    title: "Applied Mathematics placeholder track",
    summary: "Synthetic Applied Mathematics placeholder-only track for planner tests.",
    bestFor: ["testing"],
    terms: [
      {
        label: "Year 1 Fall",
        courses: ["Humanities", "Social Science", "Humanities or Social Science"],
      },
    ],
    notes: [],
  };

  const plannedCourses = buildSuggestedQuarterPlan({
    plan,
    plannerCollegeId: "uw",
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  const humanitiesCourse = plannedCourses.find((course) => course.label === "5 credits of Humanities");
  const socialScienceCourse = plannedCourses.find(
    (course) => course.label === "5 credits of Social Science"
  );
  const sharedBreadthCourse = plannedCourses.find((course) => course.label === "5 credits of A&H or SSc");

  assert.ok(humanitiesCourse, "Expected at least one Humanities placeholder.");
  assert.ok(socialScienceCourse, "Expected at least one Social Science placeholder.");
  assert.ok(sharedBreadthCourse, "Expected the explicit shared breadth placeholder from the matched track.");

  assert.match(
    humanitiesCourse?.guidanceSummary ?? "",
    /5\/5 A&H credits from the official matched Green River associate pathway map for Applied Mathematics\./i
  );
  assert.match(
    socialScienceCourse?.guidanceSummary ?? "",
    /5\/5 SSc credits from the official matched Green River associate pathway map for Applied Mathematics\./i
  );
  assert.match(
    humanitiesCourse?.guidanceSummary ?? "",
    /not an official UW transfer admission requirement\./i
  );
  assert.doesNotMatch(
    humanitiesCourse?.guidanceSummary ?? "",
    /Gen-Eds/i
  );
  assert.match(
    sharedBreadthCourse?.guidanceSummary ?? "",
    /additional A&H\/SSc credits from the official matched Green River associate pathway map for Applied Mathematics\./i
  );

  const grcPlannerCourses = buildSuggestedQuarterPlan({
    plan: null,
    plannerCollegeId: "grc",
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const grcSocialScienceCourse = grcPlannerCourses.find(
    (course) => course.label === "5 credits of Social Science"
  );

  assert.ok(grcSocialScienceCourse, "Expected the Green River planner SSc placeholder.");
  assert.match(
    grcSocialScienceCourse?.guidanceSummary ?? "",
    /5\/5 SSc credits from the official matched Green River associate pathway map for this plan\./i
  );
  assert.doesNotMatch(
    grcSocialScienceCourse?.guidanceSummary ?? "",
    /not an official .* transfer admission requirement\./i
  );
});

test("Generic UW transfer milestone remains available for non-engineering Seattle majors", () => {
  const auditQuarterPlan = [
    {
      label: "Fall 2026",
      phase: "planned" as const,
      courses: [
        { label: "ENGL& 101", type: "core" as const, status: "planned" as const, creditAmount: 5 },
        { label: "MATH& 151", type: "core" as const, status: "planned" as const, creditAmount: 5 },
        { label: "SOC& 101", type: "core" as const, status: "planned" as const, creditAmount: 5 },
      ],
    },
    {
      label: "Winter 2027",
      phase: "planned" as const,
      courses: [
        { label: "ENGL& 102", type: "core" as const, status: "planned" as const, creditAmount: 5 },
        { label: "MATH& 152", type: "core" as const, status: "planned" as const, creditAmount: 5 },
        { label: "PSYC& 100", type: "core" as const, status: "planned" as const, creditAmount: 5 },
      ],
    },
    {
      label: "Spring 2027",
      phase: "planned" as const,
      courses: [
        { label: "BIOL& 211", type: "core" as const, status: "planned" as const, creditAmount: 5 },
        { label: "CHEM& 161", type: "core" as const, status: "planned" as const, creditAmount: 5 },
        { label: "HIST& 146", type: "core" as const, status: "planned" as const, creditAmount: 5 },
      ],
    },
  ];
  const planIds = [
    "uw-seattle-psychology",
    "uw-seattle-american-ethnic-studies",
    "uw-seattle-biology",
  ];

  for (const planId of planIds) {
    const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(planId);
    assert.ok(runtimePlan, `Expected ${planId} runtime plan.`);
    const resolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, null);
    assert.ok(resolvedPlan, `Expected ${planId} resolved plan.`);
    const decision = getUwTransferGenericMilestoneDecision({
      plan: resolvedPlan,
      selectedCampusId: resolvedPlan.campusId,
      selectedMajorId: resolvedPlan.id,
      degreeTitle: resolvedPlan.title,
    });
    const summary = buildUwTransferMinimumRequirementSummary({
      quarters: auditQuarterPlan,
      plan: resolvedPlan,
      selectedCampusId: resolvedPlan.campusId,
      selectedMajorId: resolvedPlan.id,
      degreeTitle: resolvedPlan.title,
    });

    assert.equal(decision.allowed, true, `${planId}: ${decision.reason}`);
    assert.match(
      decision.reason,
      /No engineering or capacity-constrained admission gate detected\./
    );
    assert.match(
      summary ?? "",
      /Spring 2027 - Minimum transfer requirements are met\. Apply by September 1, 2027 to be considered for Winter 2028 admission at UW\./,
      planId
    );
  }
});

test("Generic UW transfer milestone stays hidden for engineering and capacity-constrained majors without invented deadlines", () => {
  const auditQuarterPlan = [
    {
      label: "Fall 2026",
      phase: "planned" as const,
      courses: [{ label: "ENGL& 101", type: "core" as const, status: "planned" as const, creditAmount: 20 }],
    },
    {
      label: "Spring 2027",
      phase: "planned" as const,
      courses: [{ label: "MATH& 151", type: "core" as const, status: "planned" as const, creditAmount: 20 }],
    },
  ];
  const mseRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-materials-science-engineering"
  );
  assert.ok(mseRuntimePlan, "Expected MSE runtime plan.");
  const mseResolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    mseRuntimePlan,
    "nme-option"
  );
  assert.ok(mseResolvedPlan, "Expected MSE NME resolved plan.");
  const mseDecision = getUwTransferGenericMilestoneDecision({
    plan: mseResolvedPlan,
    selectedCampusId: mseResolvedPlan.campusId,
    selectedMajorId: mseResolvedPlan.id,
    degreeTitle: `${mseResolvedPlan.title} (NME Option)`,
  });
  const mseSummary = buildUwTransferMinimumRequirementSummary({
    quarters: auditQuarterPlan,
    plan: mseResolvedPlan,
    selectedCampusId: mseResolvedPlan.campusId,
    selectedMajorId: mseResolvedPlan.id,
    degreeTitle: `${mseResolvedPlan.title} (NME Option)`,
  });

  assert.equal(mseDecision.allowed, false);
  assert.match(mseDecision.reason, /Engineering-style major/);
  assert.equal(mseSummary, null);

  const csRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-science");
  assert.ok(csRuntimePlan, "Expected CS runtime plan.");
  const csDecision = getUwTransferGenericMilestoneDecision({
    plan: csRuntimePlan,
    selectedCampusId: csRuntimePlan.campusId,
    selectedMajorId: csRuntimePlan.id,
    degreeTitle: csRuntimePlan.title,
  });
  const csSummary = buildUwTransferMinimumRequirementSummary({
    quarters: auditQuarterPlan,
    plan: csRuntimePlan,
    selectedCampusId: csRuntimePlan.campusId,
    selectedMajorId: csRuntimePlan.id,
    degreeTitle: csRuntimePlan.title,
  });

  assert.equal(csDecision.allowed, false);
  assert.equal(csDecision.majorSpecificAdmissionMetadataFound, true);
  assert.match(csDecision.reason, /source-backed major guidance/);
  assert.equal(csSummary, null);

  const nursingRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-nursing");
  assert.ok(nursingRuntimePlan, "Expected Nursing runtime plan.");
  const nursingDecision = getUwTransferGenericMilestoneDecision({
    plan: nursingRuntimePlan,
    selectedCampusId: nursingRuntimePlan.campusId,
    selectedMajorId: nursingRuntimePlan.id,
    degreeTitle: nursingRuntimePlan.title,
  });

  assert.equal(nursingDecision.allowed, false);
  assert.equal(nursingDecision.majorSpecificAdmissionMetadataFound, false);
  assert.match(nursingDecision.reason, /Capacity-constrained major/);

  const businessRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-business-administration"
  );
  assert.ok(businessRuntimePlan, "Expected Business Administration runtime plan.");
  const businessDecision = getUwTransferGenericMilestoneDecision({
    plan: businessRuntimePlan,
    selectedCampusId: businessRuntimePlan.campusId,
    selectedMajorId: businessRuntimePlan.id,
    degreeTitle: businessRuntimePlan.title,
  });

  assert.equal(businessDecision.allowed, false);
  assert.equal(businessDecision.majorSpecificAdmissionMetadataFound, true);
  assert.match(businessDecision.reason, /source-backed major guidance/);
});

test("Seattle American Ethnic Studies now keeps official transfer policy separate from major-specific and planner-guidance layers", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-american-ethnic-studies");
  assert.ok(runtimePlan, "Expected the American Ethnic Studies runtime plan.");
  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(runtimePlan);
  const sourceBackedSection = buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan);
  const generalRequirementSection = buildUwGeneralTransferRequirementSection(runtimePlan);

  const fullQuarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    applicationStatuses: buildRequirementStatuses(runtimePlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(runtimePlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const transferOnlyQuarterPlan = buildSuggestedQuarterPlan({
    plan: runtimePlan,
    applicationStatuses: buildRequirementStatuses(runtimePlan.applicationChecklist, []),
    beforeEnrollmentStatuses: buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, []),
    stayAtGrcStatuses: buildRequirementStatuses(runtimePlan.stayAtGrcChecklist, []),
    completedCourses: [],
    track: getTransferPlannerTrack(runtimePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const humanitiesPlaceholders = fullQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => course.label === "5 credits of Humanities")
        .map((course) => ({ quarterLabel: quarter.label, course }))
    );
  const sharedBreadthPlaceholders = fullQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses.filter((course) => course.label === "5 credits of A&H or SSc")
    );
  const naturalSciencePlaceholders = fullQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => course.label === "5 credits of Natural Sciences")
        .map((course) => ({ quarterLabel: quarter.label, course }))
    );
  const socialSciencePlaceholders = fullQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) =>
      quarter.courses
        .filter((course) => course.label === "5 credits of Social Science")
        .map((course) => ({ quarterLabel: quarter.label, course }))
    );

  assert.deepEqual(diagnostics.sourceBackedTargets, {
    ahCredits: 20,
    sscCredits: 20,
    nscCredits: 20,
    breadthCredits: null,
    electiveCredits: 15,
  });
  assert.deepEqual(diagnostics.plannerGuidanceTargets, {
    ahCredits: null,
    sscCredits: null,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(diagnostics.hasSourceBackedTargets, true);
  assert.deepEqual(
    sourceBackedSection?.items.map((entry) => `${entry.label}: ${entry.valueText}`),
    [
      "Arts & Humanities: 20 credits",
      "Social Sciences: 20 credits",
      "Natural Sciences: 20 credits",
      "Additional Areas of Inquiry: 15 credits",
      "Diversity: 5 credits",
    ]
  );
  assert.equal(generalRequirementSection?.plannerUsage, "summary-only");
  assert.deepEqual(
    generalRequirementSection?.items.map((entry) => `${entry.label}: ${entry.valueText}`),
    EXPECTED_UW_TRANSFER_ADMISSION_REQUIREMENT_LINES
  );
  assert.equal(humanitiesPlaceholders.length, 0);
  assert.equal(naturalSciencePlaceholders.length, 0);
  assert.equal(socialSciencePlaceholders.length, 0);
  assert.equal(sharedBreadthPlaceholders.length, 0);
  assert.equal(
    fullQuarterPlan
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses.map((course) => course.guidanceSummary ?? ""))
      .some((guidance) => /UW-wide general transfer requirements/i.test(guidance)),
    false
  );
  assert.equal(
    transferOnlyQuarterPlan
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses.map((course) => course.label))
      .some((label) => /^5 credits of /i.test(label)),
    false
  );
});

test("Seattle American Ethnic Studies materializes the four official concentration pathways", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-american-ethnic-studies");
  assert.ok(runtimePlan, "Expected the American Ethnic Studies runtime plan.");

  const expectedConcentrations = [
    ["african-american-studies-concentration", "African American Studies Concentration"],
    ["asian-american-pia-studies-concentration", "Asian American/PIA Studies Concentration"],
    ["chicano-a-studies-concentration", "Chicano/a Studies Concentration"],
    [
      "comparative-american-ethnic-studies-concentration",
      "Comparative American Ethnic Studies Concentration",
    ],
  ];
  const rootPathwayLabels = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-american-ethnic-studies",
    null
  ).flatMap((block) => block.pathwayLabels ?? []);
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan).map(
    (pathway) => [pathway.id, pathway.label]
  );

  assert.deepEqual(
    rootPathwayLabels.filter((label) => /\bconcentration\b/i.test(label)),
    expectedConcentrations.map(([, label]) => label.replace(/\bConcentration\b$/, "concentration"))
  );
  assert.deepEqual(runtimePathways, expectedConcentrations);
  assert.equal(
    runtimePathways.some(([, label]) => /\bhonou?rs?\s+thesis\b/i.test(label)),
    false
  );
});

test("Generated associate tracks avoid legacy compatibility IDs and use only current connector-backed terms", () => {
  const trackQ = getTransferPlannerTrack("999Q");
  const trackO = getTransferPlannerTrack("999O");
  const trackP = getTransferPlannerTrack("999P");
  const legacyBaseTrack = getTransferPlannerTrack("999B");

  assert.equal(Boolean(trackQ), false, "Legacy compatibility track 999Q should not be generated.");
  assert.equal(Boolean(trackO), false, "Legacy compatibility track 999O should not be generated.");
  assert.equal(Boolean(trackP), false, "Legacy compatibility track 999P should not be generated.");
  assert.equal(Boolean(legacyBaseTrack), false, "Legacy compatibility track 999B should not be generated.");

  const connectorBackedEngineeringTrack =
    getTransferPlannerTrack(
      "grc-associate-trades-industrial-tech-aviation-natural-resources-computer-and-electrical-engineering-as"
    ) ??
    getTransferPlannerTrack(
      "grc-associate-trades-industrial-tech-aviation-natural-resources-computer-and-electrical-engineering-as-t"
    );
  if (connectorBackedEngineeringTrack) {
    assert.equal(
      connectorBackedEngineeringTrack.terms
        .flatMap((term) => term.courses)
        .some((entry) => /select course from list/i.test(entry)),
      false
    );
  }
});

test("Generated ACS-DTA/MRP track keeps distribution guidance generic instead of promoting example social-science courses", () => {
  const track = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find(
    (entry) =>
      entry.id === "grc-associate-stem-computer-science-associate-in-computer-science-acs-dta-mrp"
  );
  const quarter3 = track?.terms.find((term) => term.label === "Quarter 3 (15 credits)");
  const quarter6 = track?.terms.find((term) => term.label === "Quarter 6 (15 credits)");
  const allLabels = track?.terms.flatMap((term) => term.courses) ?? [];

  assert.ok(track, "Expected the current ACS-DTA/MRP Computer Science track.");
  assert.deepEqual(quarter3?.courses, ["CS 121", "MATH& 163", "Humanities or Social Science"]);
  assert.deepEqual(quarter6?.courses, ["Humanities or Social Science", "Elective or General Education"]);
  assert.equal(allLabels.includes("CMST& 220"), false);
  assert.equal(allLabels.includes("PSYC& 100"), false);
  assert.equal(allLabels.includes("AMES 100"), false);
  assert.equal(allLabels.includes("ANTH& 206"), false);
});

test("AST-2/MRP Computer and Electrical Engineering planning does not double-count alternate breadth rows", () => {
  const track = getTransferPlannerTrack(
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-computer-and-electrical-engineering"
  );
  assert.ok(
    track,
    "Expected the Green River AST-2/MRP Computer and Electrical Engineering track."
  );

  const sourceBreadthLabels = track.terms
    .flatMap((term) => term.courses)
    .filter((label) => /humanities|social science/i.test(label));
  assert.deepEqual(sourceBreadthLabels, [
    "2 C - Humanities/Fine Arts/English or Social Science",
    "H 1 - Humanities/Fine Arts/English",
    "S 1 - Social Science",
    "CS 123 or 2 C - Humanities/Fine Arts/English or Social Science",
  ]);

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedBreadthPlaceholders = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses)
    .filter((course) => course.sourceKind === "official-grc-track-breadth");
  const plannedBreadthLabels = plannedBreadthPlaceholders.map((course) => course.label);

  assert.deepEqual(plannedBreadthLabels, [
    "5 credits of A&H or SSc",
    "5 credits of Humanities",
    "5 credits of Social Science",
  ]);
  assert.equal(
    plannedBreadthPlaceholders.reduce(
      (total, course) => total + (course.creditAmount ?? 0),
      0
    ),
    15
  );
  assert.equal(
    plannedBreadthLabels.filter((label) => label === "5 credits of A&H or SSc").length,
    1
  );
});

test("AST-2/MRP Computer and Electrical Engineering suppresses merged course/distribution required labels", () => {
  const track = getTransferPlannerTrack(
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-computer-and-electrical-engineering"
  );
  assert.ok(
    track,
    "Expected the Green River AST-2/MRP Computer and Electrical Engineering track."
  );

  const mixedLabel = "CS 123 or 2 C - Humanities/Fine Arts/English or Social Science";
  assert.equal(hasCourseAndDistributionPlaceholderSignal(mixedLabel), true);
  assert.equal(isMergedCourseDistributionRequirementLabel(mixedLabel), true);
  assert.equal(
    isMergedCourseDistributionRequirementLabel("POLS& 200 - American Government"),
    false
  );

  const simulatedGrcRequiredCourseCodes: string[] = [];
  const seenCourseCodes = new Set<string>();
  const preparatoryCourseCodes = getPreparatoryTrackCourseCodeSet(track);
  for (const term of getResolvedTrackTermsForRequirementDisplay(track, [])) {
    if (/\btransferability of credits\b/i.test(String(term.label ?? "").trim())) {
      continue;
    }

    for (const label of term.courses) {
      if (isMergedCourseDistributionRequirementLabel(label)) {
        continue;
      }

      const courseCodes = extractCourseCodes(label);
      if (courseCodes.length !== 1) {
        continue;
      }

      const courseCode = normalizeCourseCode(courseCodes[0]);
      if (
        !courseCode ||
        preparatoryCourseCodes.has(courseCode) ||
        seenCourseCodes.has(courseCode)
      ) {
        continue;
      }

      seenCourseCodes.add(courseCode);
      simulatedGrcRequiredCourseCodes.push(courseCode);
    }
  }

  assert.equal(
    simulatedGrcRequiredCourseCodes.includes("CS 123"),
    false,
    "CS 123 should not be promoted out of the official programming grouped choice by the Required Major Courses fallback."
  );
  assert.equal(
    simulatedGrcRequiredCourseCodes.some((courseCode) => /\b2\s*C\b/i.test(courseCode)),
    false
  );

  const usageSummary = buildTrackUsageSummary(
    track,
    getRequiredPlan("uw-seattle-computer-engineering"),
    []
  );
  assert.equal(
    usageSummary?.directUseEntries.includes(mixedLabel) ||
      usageSummary?.extraSpecificEntries.includes(mixedLabel),
    false,
    "Merged source labels should not be classified as specific track course requirements."
  );

  const pageSource = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");
  const requiredCoursesBuilder = pageSource.slice(
    pageSource.indexOf("function buildMajorSpecificsGrcRequiredMajorCourseLines"),
    pageSource.indexOf("function buildRequiredPlannerCourseCodes")
  );
  assert.match(
    requiredCoursesBuilder,
    /isMergedCourseDistributionRequirementLabel\(normalizedLabel\)/
  );
});

test("AST-2/MRP Computer and Electrical Engineering preserves official programming group choices", () => {
  const track = getTransferPlannerTrack(
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-computer-and-electrical-engineering"
  );
  assert.ok(
    track,
    "Expected the Green River AST-2/MRP Computer and Electrical Engineering track."
  );

  const groupedChoice = track.groupedChoices?.find((choice) =>
    /computer programming/i.test(choice.label)
  );
  assert.ok(groupedChoice, "Expected the official Computer Programming grouped choice.");
  assert.equal(groupedChoice.requiredCredits, 10);
  assert.deepEqual(
    groupedChoice.options.map((option) => ({
      label: option.label,
      courseCodes: option.courseCodes,
    })),
    [
      {
        label: "Group 1: CS 122 + CS 123",
        courseCodes: ["CS 122", "CS 123"],
      },
      {
        label: "Group 2: CS& 131 + CS 132",
        courseCodes: ["CS& 131", "CS 132"],
      },
    ]
  );
  assert.equal(
    groupedChoice.options.flatMap((option) => option.courseCodes).includes("CS 121"),
    false
  );

  const buildGrcOnlyPlan = (completedCourseCodes: string[] = [], selectedOptionIds: string[] = []) =>
    buildSuggestedQuarterPlan({
      plan: null,
      plannerCollegeId: "grc",
      applicationStatuses: [],
      beforeEnrollmentStatuses: [],
      stayAtGrcStatuses: [],
      completedCourses: completedCourseCodes.map((courseCode) => ({
        code: courseCode,
        label: courseCode,
        credits: 5,
        termLabel: "Completed transfer work",
        termStartDate: "2025-09-01",
      })),
      track,
      includeStayAtGrcCourses: true,
      referenceDate: new Date("2026-01-15T12:00:00.000Z"),
      selectedRequirementOptionIdsByGroup: selectedOptionIds.length
        ? {
            [groupedChoice.id]: selectedOptionIds,
          }
        : {},
    })
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses);
  const findProgrammingPrompt = (completedCourseCodes: string[] = []) =>
    buildGrcOnlyPlan(completedCourseCodes).find(
      (course) => course.optionGroup?.id === groupedChoice.id
    );

  const plannedCourses = buildGrcOnlyPlan();
  const programmingPrompt = plannedCourses.find(
    (course) => course.optionGroup?.id === groupedChoice.id
  );
  assert.ok(programmingPrompt?.optionGroup, "Expected one grouped programming prompt.");
  assert.equal(programmingPrompt.creditAmount, 10);
  assert.deepEqual(
    programmingPrompt.optionGroup.options.map((option) => ({
      label: option.label,
      courseLabels: option.courseLabels,
      courseCodes: option.courseCodes,
      creditAmount: option.creditAmount,
    })),
    [
      {
        label: "Group 1: CS 122 + CS 123",
        courseLabels: ["CS 122", "CS 123"],
        courseCodes: ["CS 122", "CS 123"],
        creditAmount: 10,
      },
      {
        label: "Group 2: CS& 131 + CS 132",
        courseLabels: ["CS& 131", "CS 132"],
        courseCodes: ["CS& 131", "CS 132"],
        creditAmount: 10,
      },
    ]
  );
  assert.equal(
    plannedCourses.some((course) => course.optionGroup?.id === "official-grc-track-choice:cs-121-or-cs-and-131"),
    false
  );
  assert.equal(
    plannedCourses.some((course) => course.optionGroup?.id === "official-grc-track-choice:cs-122-or-cs-132"),
    false
  );

  assert.ok(findProgrammingPrompt(["CS 122"]), "CS 122 alone should not satisfy Group 1.");
  assert.ok(findProgrammingPrompt(["CS& 131"]), "CS& 131 alone should not satisfy Group 2.");
  assert.equal(
    findProgrammingPrompt(["CS 122", "CS 123"]),
    undefined,
    "CS 122 plus CS 123 should satisfy Group 1."
  );
  assert.equal(
    findProgrammingPrompt(["CS& 131", "CS 132"]),
    undefined,
    "CS& 131 plus CS 132 should satisfy Group 2."
  );

  const groupOneSelectedCourses = buildGrcOnlyPlan([], [groupedChoice.options[0].id]);
  const groupOneLabels = groupOneSelectedCourses.map((course) => course.label);
  assert.equal(groupOneLabels.includes("CS 122"), true);
  assert.equal(groupOneLabels.includes("CS 123"), true);
  assert.equal(
    groupOneSelectedCourses.some(
      (course) =>
        course.optionGroup?.id === groupedChoice.id &&
        course.optionGroup.isSelectionPrompt === true
    ),
    false
  );
});

test("AST-2/MRP Computer and Electrical Engineering preserves official choose-two engineering elective options", () => {
  const track = getTransferPlannerTrack(
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-computer-and-electrical-engineering"
  );
  assert.ok(
    track,
    "Expected the Green River AST-2/MRP Computer and Electrical Engineering track."
  );

  const electiveChoice = track.groupedChoices?.find((choice) =>
    /math, science.*engr elective/i.test(choice.label)
  );
  assert.ok(electiveChoice, "Expected the official Math, Science & Engineering elective group.");
  assert.equal(electiveChoice.selectionCount, 2);
  assert.equal(electiveChoice.requiredCredits, 10);
  assert.deepEqual(
    electiveChoice.options.map((option) => option.courseCodes[0]),
    ["ENGR& 104", "ENGR& 214", "ENGR& 224", "ENGR 250", "ENGR 271", "ENGL 128", "ENGL& 235"]
  );
  assert.deepEqual(
    (electiveChoice.defaultOptionIds ?? []).map(
      (optionId) => electiveChoice.options.find((option) => option.id === optionId)?.courseCodes[0]
    ),
    ["ENGR 271", "ENGL& 235"]
  );

  const buildGrcOnlyQuarterPlan = (completedCourseCodes: string[] = []) =>
    buildSuggestedQuarterPlan({
      plan: null,
      plannerCollegeId: "grc",
      applicationStatuses: [],
      beforeEnrollmentStatuses: [],
      stayAtGrcStatuses: [],
      completedCourses: completedCourseCodes.map((courseCode) => ({
        code: courseCode,
        label: courseCode,
        credits: 5,
        termLabel: "Completed transfer work",
        termStartDate: "2025-09-01",
      })),
      track,
      includeStayAtGrcCourses: true,
      includeStemPrepCourses: false,
      referenceDate: new Date("2026-01-15T12:00:00.000Z"),
    });
  const buildGrcOnlyPlan = (completedCourseCodes: string[] = []) =>
    buildGrcOnlyQuarterPlan(completedCourseCodes)
      .filter((quarter) => quarter.phase === "planned")
      .flatMap((quarter) => quarter.courses);

  const plannedCourses = buildGrcOnlyPlan();
  const electiveRows = plannedCourses.filter(
    (course) => course.optionGroup?.id === electiveChoice.id
  );

  assert.deepEqual(
    electiveRows.map((course) => course.label).sort(),
    ["ENGL& 235", "ENGR 271"]
  );
  assert.equal(
    plannedCourses.filter((course) => course.label === "ENGR 271" && !course.optionGroup).length,
    0
  );
  assert.equal(
    plannedCourses.filter((course) => course.label === "ENGL& 235" && !course.optionGroup).length,
    0
  );
  for (const row of electiveRows) {
    assert.equal(row.optionGroup?.selectionCount, 2);
    assert.equal(row.optionGroup?.requiredCredits, 10);
    assert.equal(row.optionGroup?.selectionSource, "default");
    assert.equal(row.optionGroup?.isSelectionPrompt, false);
    assert.match(row.guidanceSummary ?? "", /Default sample-map options: ENGR 271: ENGR 271, ENGL& 235: ENGL& 235/i);
    assert.match(row.guidanceSummary ?? "", /Options: ENGR& 104: ENGR& 104/i);
  }
  assert.equal(
    plannedCourses.some(
      (course) =>
        course.optionGroup?.id === electiveChoice.id &&
        course.optionGroup.isSelectionPrompt === true
    ),
    false
  );

  const oneCompletedRows = buildGrcOnlyPlan(["ENGR 271"]).filter(
    (course) => course.optionGroup?.id === electiveChoice.id
  );
  assert.deepEqual(
    oneCompletedRows.map((course) => course.label),
    ["ENGL& 235"]
  );
  assert.equal(
    oneCompletedRows.some((course) => course.optionGroup?.isSelectionPrompt),
    false,
    "One completed default plus one remaining default should satisfy the choose-two plan without duplicating completed credit."
  );

  const fullyCompletedRows = buildGrcOnlyPlan(["ENGR 271", "ENGL& 235"]).filter(
    (course) => course.optionGroup?.id === electiveChoice.id
  );
  assert.deepEqual(fullyCompletedRows, []);

  const programmingChoice = track.groupedChoices?.find((choice) =>
    /computer programming/i.test(choice.label)
  );
  const remainingCreditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: buildGrcOnlyQuarterPlan(),
    track,
  });
  assert.equal(track.minimumCredits, 98);
  assert.equal(remainingCreditRange.catalogMinimumCredits, 98);
  assert.equal(remainingCreditRange.minRemainingCredits, 98);
  assert.equal(remainingCreditRange.hasUnresolvedOptions, true);
  assert.equal(remainingCreditRange.exactRemainingCredits, null);
  assert.equal(remainingCreditRange.maxRemainingCredits, 98);
  assert.ok(
    remainingCreditRange.unresolvedOptionGroupIds.includes(programmingChoice?.id ?? "")
  );
  assert.ok(remainingCreditRange.unresolvedOptionGroupIds.includes(electiveChoice.id));
  assert.ok(
    remainingCreditRange.unresolvedPlaceholderLabels.includes("5 credits of A&H or SSc")
  );

  const pageSource = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");
  const requiredCoursesBuilder = pageSource.slice(
    pageSource.indexOf("function buildMajorSpecificsGrcRequiredMajorCourseLines"),
    pageSource.indexOf("function buildRequiredPlannerCourseCodes")
  );
  assert.match(
    requiredCoursesBuilder,
    /groupedChoices\.map\(buildTrackGroupedChoiceRequiredCourseLine\)/
  );
  assert.match(
    requiredCoursesBuilder,
    /isTrackCourseLabelCoveredByGroupedChoice\(normalizedLabel,\s*groupedChoices\)/
  );
});

test("Math Education AM-DTA planning does not synthesize unsupported elective/general-education filler", () => {
  const track = getTransferPlannerTrack(
    "grc-associate-stem-mathematics-math-curriculum-map-aa-dta-math-emphasis"
  );
  assert.ok(track, "Expected the Math Education AM-DTA (Mathematics) track.");

  const plannedCourses = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  assert.equal(
    plannedCourses.some((course) => course.label === "5 credits of elective/general education"),
    false
  );
  assert.equal(
    plannedCourses.filter((course) => course.label === "5 credits of Humanities").length,
    3
  );
  assert.equal(
    plannedCourses.filter((course) => course.label === "5 credits of Social Science").length,
    3
  );
  assert.equal(
    plannedCourses.some((course) => /elective\/general-education/i.test(course.guidanceSummary ?? "")),
    false
  );
});

test.skip("Phase 6 keeps the current recommended track path for new students without transcript history", () => {
  const comparison = buildHistoricalGrcTrackComparison({
    track: compETrack,
    plan: compEPlan,
    completedCourses: [],
    referenceDate: new Date("2026-04-07T12:00:00.000Z"),
  });

  assert.ok(comparison, "Expected Phase 6 comparison for new Computer Engineering planning.");
  assert.equal(comparison?.inferredCatalogYearLabel, null);
  assert.equal(comparison?.selectedCatalogYearLabel, null);
  assert.equal(comparison?.selectedCatalogYearSource, "current-default");
  assert.equal(comparison?.usesCurrentRecommendedPath, true);
  assert.equal(comparison?.isHistoricalCatalogYear, false);
  assert.ok(comparison?.trackCourseCodes.includes("MATH& 163"));
  assert.ok(comparison?.trackCourseCodes.includes("CS 121"));
  assert.equal(comparison?.trackCourseCodes.includes("CS 120"), false);
  assert.deepEqual(comparison?.legacyCatalogCourseCodes, []);
});

test.skip("Phase 6 track usage summary compares historical GRC terms against current UW requirements", () => {
  assert.ok(compETrack, "Expected a Computer Engineering best track.");
  const historicalUsage = buildTrackUsageSummary(compETrack, compEPlan, [
    buildTermTranscriptCourse("ENGL& 101", "Fall 2024", "2024-09-23"),
  ]);
  const currentDefaultUsage = buildTrackUsageSummary(compETrack, compEPlan, []);
  const historicalSpecificEntries = [
    ...(historicalUsage?.directUseEntries ?? []),
    ...(historicalUsage?.extraSpecificEntries ?? []),
  ].join(" | ");
  const currentSpecificEntries = [
    ...(currentDefaultUsage?.directUseEntries ?? []),
    ...(currentDefaultUsage?.extraSpecificEntries ?? []),
  ].join(" | ");

  assert.match(historicalSpecificEntries, /CS 121|CS& 131/);
  assert.match(historicalSpecificEntries, /MATH& 153|MATH& 163/);
  assert.match(currentSpecificEntries, /CS 121/);
  assert.match(currentSpecificEntries, /MATH& 163/);
  assert.doesNotMatch(currentSpecificEntries, /CS 120/);
});

test("Phase 8 student evaluations carry approved rule IDs for auto-approved major courses", () => {
  const completedCourses = buildTranscriptCourses("ENGL& 101");
  const applicationStatuses = buildRequirementStatuses(
    [buildChecklistItem("writing", "Writing", ["ENGL& 101"])],
    completedCourses
  );
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: compEPlan,
    completedCourses,
    applicationStatuses,
  });
  const writingEvaluation = evaluations.find((entry) => entry.courseCode === "ENGL& 101");

  assert.equal(writingEvaluation?.outcome, "auto-approved");
  assert.equal(writingEvaluation?.studentFacing, true);
  assert.equal(writingEvaluation?.approvedRuleId, "uw-grc-guide:0446:english:england-101-5-formerly-engl-110");
  assert.deepEqual(writingEvaluation?.appliedRequirementIds, ["writing"]);
  assert.match(writingEvaluation?.targetOutcome ?? "", /ENGL 131/);
  assert.equal(writingEvaluation?.missingSourceCourseCodes.length, 0);
});

test("Phase 8 student evaluations expose missing courses for incomplete sequence rules", () => {
  const completedCourses = buildTranscriptCourses("ACCT& 201");
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: null,
    completedCourses,
  });
  const accountingEvaluation = evaluations.find((entry) => entry.courseCode === "ACCT& 201");

  assert.equal(accountingEvaluation?.outcome, "sequence-incomplete");
  assert.equal(accountingEvaluation?.approvedRuleId, "uw-grc-guide:0001:accounting:acctand-201-202-5-5-formerly-b-a-210-220");
  assert.deepEqual(accountingEvaluation?.sourceCourseSet, ["ACCT& 201", "ACCT& 202"]);
  assert.deepEqual(accountingEvaluation?.missingSourceCourseCodes, ["ACCT& 202"]);
  assert.match(accountingEvaluation?.warnings.join(" ") ?? "", /sequence/i);
});

test("Phase 8 student evaluations prefer combined-entry sequence rules over reference-only rows", () => {
  const completedCourses = buildTranscriptCourses("ACCT& 202");
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: null,
    completedCourses,
  });
  const accountingEvaluation = evaluations.find((entry) => entry.courseCode === "ACCT& 202");

  assert.equal(accountingEvaluation?.outcome, "sequence-incomplete");
  assert.equal(accountingEvaluation?.approvedRuleId, "uw-grc-guide:0001:accounting:acctand-201-202-5-5-formerly-b-a-210-220");
  assert.deepEqual(accountingEvaluation?.sourceCourseSet, ["ACCT& 201", "ACCT& 202"]);
  assert.deepEqual(accountingEvaluation?.missingSourceCourseCodes, ["ACCT& 201"]);
  assert.equal(
    accountingEvaluation?.alternativeApprovedRuleIds.includes(
      "uw-grc-guide:0002:accounting:acctand-202-5-formerly-b-a-220-5-see-acctand-201-combined-entry"
    ),
    true
  );
});

test("Phase 8 student evaluations warn when a legacy approved rule is used", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 254"
  );
  const applicationStatuses = buildRequirementStatuses(
    [
      buildChecklistItem("older-calc-path", "Older calculus path", [
        "MATH& 151",
        "MATH& 152",
        "MATH& 153",
        "MATH& 254",
      ]),
    ],
    completedCourses
  );
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: compEPlan,
    completedCourses,
    applicationStatuses,
  });
  const legacyEvaluation = evaluations.find((entry) => entry.courseCode === "MATH& 153");

  assert.ok(
    legacyEvaluation?.outcome === "legacy-rule-used" ||
      legacyEvaluation?.outcome === "sequence-incomplete"
  );
  assert.ok(
    typeof legacyEvaluation?.ruleStatus === "string" ||
      legacyEvaluation?.ruleStatus === null
  );
  assert.ok(typeof legacyEvaluation?.acceptanceCategory === "string");
  assert.deepEqual(legacyEvaluation?.sourceCourseSet, ["MATH& 153", "MATH& 264"]);
  assert.ok(Array.isArray(legacyEvaluation?.missingSourceCourseCodes));
});

test("Phase 8 student evaluations distinguish no-credit and non-major courses", () => {
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: compEPlan,
    completedCourses: buildTranscriptCourses("BEHSC 101", "ACCT& 203", "AMES 100"),
  });
  const noCreditEvaluation = evaluations.find((entry) => entry.courseCode === "BEHSC 101");
  const nonMajorEvaluation = evaluations.find((entry) => entry.courseCode === "ACCT& 203");
  const electiveEvaluation = evaluations.find((entry) => entry.courseCode === "AMES 100");

  assert.equal(noCreditEvaluation?.outcome, "no-credit");
  assert.match(noCreditEvaluation?.targetOutcome ?? "", /No credit/i);
  assert.equal(nonMajorEvaluation?.outcome, "not-applicable-to-major");
  assert.equal(nonMajorEvaluation?.approvedRuleId, "uw-grc-guide:0003:accounting:acctand-203-5-formerly-b-a-230");
  assert.equal(nonMajorEvaluation?.appliedRequirementIds.length, 0);
  assert.equal(electiveEvaluation?.outcome, "elective-credit");
  assert.match(electiveEvaluation?.targetOutcome ?? "", /UW 1XX/);
});

test.skip("Phase 9 advisor-ready report preserves selected pathway scope", () => {
  const marketingBabaPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedTacomaBabaPlan,
    "marketing-option"
  );
  assert.ok(marketingBabaPlan, "Expected Tacoma BABA marketing option planner row.");

  const completedCourses = buildTranscriptCourses("ENGL& 101");
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: marketingBabaPlan,
    completedCourses,
  });
  const report = buildTransferPlannerStudentEvaluationReport({
    plan: marketingBabaPlan,
    campusLabel: "UW Tacoma",
    completedCourses,
    evaluations,
  });

  assert.equal(report.planId, marketingBabaPlan.id);
  assert.equal(report.pathwayId, "marketing-option");
  assert.equal(report.majorTitle, `${marketingBabaPlan.title} (Marketing option)`);
  assert.equal(report.campusLabel, "UW Tacoma");
  assert.match(report.reportSummaryLines[0] ?? "", /Marketing option/);
});

test("Phase 9 advisor-ready report keeps bucket course codes sorted and scoped", () => {
  const completedCourses = buildTranscriptCourses("AMES 150", "AMES 100", "ACCT& 201");
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: compEPlan,
    completedCourses,
  });
  const report = buildTransferPlannerStudentEvaluationReport({
    plan: compEPlan,
    campusLabel: "UW Seattle",
    completedCourses,
    evaluations,
  });
  const electiveBucket = report.buckets.find((bucket) => bucket.id === "elective-credit");
  const sequenceBucket = report.buckets.find((bucket) => bucket.id === "sequence-incomplete");
  const autoApprovedBucket = report.buckets.find((bucket) => bucket.id === "auto-approved");

  assert.deepEqual(electiveBucket?.courseCodes, ["AMES 100", "AMES 150"]);
  assert.deepEqual(sequenceBucket?.courseCodes, ["ACCT& 201"]);
  assert.equal(autoApprovedBucket?.count, 0);
  assert.equal(report.studentFacingEvaluationCount, 3);
  assert.equal(report.hiddenEvaluationCount, 0);
  assert.deepEqual(report.missingSequenceCourseCodes, ["ACCT& 202"]);
});

test("Runtime planner path does not reference authored override map/constants", () => {
  const guardedRuntimePathPrefixes = [
    "constants/transfer-planner-source/",
    "constants/transfer-planner-types.ts",
    "services/planning/transfer-planner.service.ts",
    "services/planning/transfer-planner/",
  ];
  const forbiddenAuthoredOverrideNames = [
    "REQUIREMENT_DISPLAY_PHASE_OVERRIDES",
    "DISABLED_UNVERIFIED_OFFICIAL_LINK_URLS",
    "PLANNER_OWNED_TEXT_REPLACEMENTS",
    "LEGACY_COMPATIBILITY_TRACKS_BY_PAGE_SLUG",
  ];

  const runtimeFiles = collectProjectTextFiles(process.cwd()).filter((relativePath) =>
    guardedRuntimePathPrefixes.some(
      (pathPrefix) => relativePath === pathPrefix || relativePath.startsWith(pathPrefix)
    )
  );
  const findings: string[] = [];

  for (const relativePath of runtimeFiles) {
    const contents = readFileSync(relativePath, "utf8");
    for (const forbiddenName of forbiddenAuthoredOverrideNames) {
      if (contents.includes(forbiddenName)) {
        findings.push(`${forbiddenName} in ${relativePath}`);
      }
    }
  }

  assert.deepEqual(
    findings,
    [],
    `Unexpected authored override map/constants in runtime path: ${findings.join(", ")}`
  );
});

test("Seattle ECE transfer-only programming planner does not backfill lower CS after higher completion", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-electrical-computer-engineering"
  );
  assert.ok(runtimePlan, "Expected runtime Seattle ECE plan.");
  const ecePlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, "photonics-pathway");
  assert.ok(ecePlan, "Expected resolved ECE plan.");
  const buildQuarterPlanForCompletedCourses = (completedCourses: TranscriptCourseEntry[]) =>
    buildSuggestedQuarterPlan({
      plan: ecePlan,
      applicationStatuses: buildRequirementStatuses(ecePlan.applicationChecklist, completedCourses),
      beforeEnrollmentStatuses: buildRequirementStatuses(
        ecePlan.beforeEnrollmentChecklist,
        completedCourses
      ),
      stayAtGrcStatuses: buildRequirementStatuses(ecePlan.stayAtGrcChecklist, completedCourses),
      completedCourses,
      track: getTransferPlannerTrack(ecePlan.bestTrackId),
      includeStayAtGrcCourses: false,
      includeStemPrepCourses: true,
      includeSummerQuarter: false,
      referenceDate: new Date("2026-05-05T12:00:00.000Z"),
    });
  const buildUpcomingLabels = (completedCourses: TranscriptCourseEntry[]) =>
    buildQuarterPlanForCompletedCourses(completedCourses)
      .filter((quarter) => quarter.phase !== "completed")
      .flatMap((quarter) => quarter.courses.map((course) => course.label));

  const afterCs123 = buildUpcomingLabels(buildTranscriptCourses("CS 123"));
  assert.equal(afterCs123.includes("CS 121"), false);
  assert.equal(afterCs123.includes("CS 122"), false);
  assert.equal(afterCs123.includes("CS 123"), false);
  const afterCs123Plan = buildQuarterPlanForCompletedCourses(buildTranscriptCourses("CS 123"));
  const afterCs123Satisfaction = auditOptionGroupSatisfaction({
    plan: ecePlan,
    suggestedPlan: afterCs123Plan,
    completedCourses: buildTranscriptCourses("CS 123"),
  });
  const afterCs123TransferProgramming = afterCs123Satisfaction.find((entry) =>
    /ece-transfer-programming-admission/.test(entry.groupId)
  );
  const afterCs123PreenrollProgramming = afterCs123Satisfaction.find((entry) =>
    /ece-preenroll-programming/.test(entry.groupId)
  );
  assert.equal(afterCs123TransferProgramming?.countedSatisfyingCourses.includes("CS 123"), true);
  assert.equal(afterCs123PreenrollProgramming?.countedSatisfyingCourses.includes("CS 123"), true);
  assert.equal(afterCs123TransferProgramming?.resolvedSatisfiedCount, 1);
  assert.equal(afterCs123PreenrollProgramming?.resolvedSatisfiedCount, 1);

  const afterCs122 = buildUpcomingLabels(buildTranscriptCourses("CS 122"));
  assert.equal(afterCs122.includes("CS 121"), false);
  assert.equal(afterCs122.includes("CS 123"), true);
  const afterCs122Plan = buildQuarterPlanForCompletedCourses(buildTranscriptCourses("CS 122"));
  const afterCs122Satisfaction = auditOptionGroupSatisfaction({
    plan: ecePlan,
    suggestedPlan: afterCs122Plan,
    completedCourses: buildTranscriptCourses("CS 122"),
  });
  const afterCs122TransferProgramming = afterCs122Satisfaction.find((entry) =>
    /ece-transfer-programming-admission/.test(entry.groupId)
  );
  const afterCs122PreenrollProgramming = afterCs122Satisfaction.find((entry) =>
    /ece-preenroll-programming/.test(entry.groupId)
  );
  assert.deepEqual(afterCs122TransferProgramming?.countedSatisfyingCourses, ["CS 122"]);
  assert.deepEqual(afterCs122PreenrollProgramming?.countedSatisfyingCourses, ["CS 123"]);
  assert.equal(afterCs122TransferProgramming?.resolvedSatisfiedCount, 1);
  assert.equal(afterCs122PreenrollProgramming?.resolvedSatisfiedCount, 1);
});

test("Seattle Mechanical Engineering keeps Engineering Fundamentals with STEM prep on and respects completed rows", () => {
  const stemPrepPlan = buildSeattleMechanicalSuggestedPlanForTest({ includeStemPrepCourses: true });
  const expectedFundamentals = ["ENGR 250", "ENGR& 204", "ENGR& 114", "ENGR 140"];

  assert.deepEqual(
    expectedFundamentals.filter((courseCode) => !stemPrepPlan.plannedLabels.includes(courseCode)),
    []
  );

  for (const courseCode of expectedFundamentals) {
    const completedCourse = { code: courseCode, label: courseCode, credits: 5 };
    const { plannedLabels } = buildSeattleMechanicalSuggestedPlanForTest({
      completedCourses: [completedCourse],
    });

    assert.equal(
      plannedLabels.includes(courseCode),
      false,
      `Expected completed ${courseCode} not to be rescheduled.`
    );
  }
});

test("Fallback-note gating now only stays off for runtime rows that truly still lack structured planner data", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");
  assert.match(transferPlannerPage, /const hasStructuredPlannerData = useMemo/);
  assert.match(transferPlannerPage, /!hasStructuredPlannerData/);

  const eceState = getResolvedRuntimeQuarterPlanningState(
    "uw-seattle-electrical-computer-engineering",
    null
  );
  const mechanicalState = getResolvedRuntimeQuarterPlanningState(
    "uw-seattle-mechanical-engineering",
    null
  );
  const unresolvedPlan = getTransferPlannerStudentRuntimeMajorsForCampus("uw-seattle")
    .map((plan) => resolveTransferPlannerStudentRuntimeMajorPlan(plan, null))
    .filter((plan): plan is NonNullable<typeof plan> => !!plan)
    .find(
      (plan) =>
        !hasStructuredPlannerData(plan) && getTransferPlannerGrcCourseList(plan).length === 0
    );

  assert.equal(hasStructuredPlannerData(eceState.resolvedPlan), true);
  assert.equal(hasStructuredPlannerData(mechanicalState.resolvedPlan), true);
  assert.ok(unresolvedPlan, "Expected at least one runtime row that still legitimately lacks structured planner data.");
  assert.equal(hasStructuredPlannerData(unresolvedPlan), false);
});

test("Phase 10 promoted requirement overrides skip suggested, elective, and replacement-only contexts", () => {
  const noisyPromotionPattern =
    /Suggested General Education Coursework \(Not Required for Transferring\)|approved list|can use that to replace|other recommended courses|free electives|additional natural science|from the following list|advanced placement|except for/i;

  const noisyPromotedEntries = TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.filter(
    (entry) =>
      Boolean(entry.promotedRequirementAtomOverrideId) &&
      entry.validationNotes.some((note) => noisyPromotionPattern.test(String(note ?? "")))
  );

  assert.deepEqual(
    noisyPromotedEntries.map((entry) => `${entry.planId}:${entry.sourceUwCourseCode}`),
    []
  );
});

test(
  `Phase 10 seeded runtime QA sample (${SEEDED_RUNTIME_QA_SAMPLE_SEED}) keeps 10 majors reviewable without UW-only placeholder rows`,
  () => {
    assert.equal(SEEDED_RUNTIME_QA_SAMPLE_PLAN_IDS.length, 10);

    for (const planId of SEEDED_RUNTIME_QA_SAMPLE_PLAN_IDS) {
      const resolvedPlan = getResolvedStudentRuntimePlan(planId);
      const checklistItems = getAllChecklistItems(resolvedPlan);
      const hiddenSourceOnlyTitles = checklistItems
        .map((item) => item.title)
        .filter(isHiddenSourceOnlyRuntimeChecklistTitle);

      assert.deepEqual(
        hiddenSourceOnlyTitles,
        [],
        `${planId} should not surface UW-only placeholder checklist rows in student runtime.`
      );
    }

    const swedishPlan = getResolvedStudentRuntimePlan("uw-seattle-swedish");
    const swedishChecklist = getAllChecklistItems(swedishPlan);
    assert.equal(swedishChecklist.length, 0);

    const globalLiteraryStudiesPlan = getResolvedStudentRuntimePlan(
      "uw-seattle-global-literary-studies"
    );
    const globalLiteraryStudiesChecklist = getAllChecklistItems(globalLiteraryStudiesPlan);
    assert.equal(globalLiteraryStudiesChecklist.length, 0);

    const tacomaHistoryPlan = getResolvedStudentRuntimePlan("uw-tacoma-history");
    const tacomaHistoryChecklist = getAllChecklistItems(tacomaHistoryPlan);
    assert.ok(
      !tacomaHistoryChecklist.some((item) => item.title === "UW prep target: THIST 101")
    );

    const bothellClaPlan = getResolvedStudentRuntimePlan(
      "uw-bothell-culture-literature-and-the-arts"
    );
    assert.ok(getTransferPlannerGrcCourseList(bothellClaPlan).includes("ENGL& 101"));

    const oceanographyPlan = getResolvedStudentRuntimePlan("uw-seattle-oceanography");
    const oceanographyChecklistTitles = new Set(
      getAllChecklistItems(oceanographyPlan).map((item) => item.title)
    );
    assert.ok(!oceanographyChecklistTitles.has("UW prep target: OCEAN 200"));
    assert.ok(!oceanographyChecklistTitles.has("UW prep target: OCEAN 201"));
    assert.ok(!oceanographyChecklistTitles.has(AUTO_CUSTOM_PREP_FALLBACK_TITLE));

    const businessAdministrationPlan = getResolvedStudentRuntimePlan(
      "uw-seattle-business-administration"
    );
    const businessAdministrationApplicationTitles = new Set(
      (businessAdministrationPlan.applicationChecklist ?? []).map((item) => item.title)
    );
    assert.ok(businessAdministrationApplicationTitles.has("Approved calculus prerequisite"));
    assert.ok(businessAdministrationApplicationTitles.has("Microeconomics"));
  }
);

test("Transfer category transcript filtering only shows currently ready series courses", () => {
  assert.deepEqual(
    buildTransferPlannerGrcTranscriptReadyCourseCodes({
      candidateCourseCodes: ["BIOL& 211", "BIOL& 212", "BIOL& 213"],
      completedCourseCodes: [],
    }),
    ["BIOL& 211"]
  );
  assert.deepEqual(
    buildTransferPlannerGrcTranscriptReadyCourseCodes({
      candidateCourseCodes: ["BIOL& 211", "BIOL& 212", "BIOL& 213"],
      completedCourseCodes: ["BIOL& 211"],
    }),
    ["BIOL& 212", "BIOL& 213"]
  );
  assert.deepEqual(
    buildTransferPlannerGrcTranscriptReadyCourseCodes({
      candidateCourseCodes: ["MATH& 151"],
      completedCourseCodes: ["MATH 106"],
    }),
    ["MATH& 151"]
  );
  assert.equal(
    isTransferPlannerGrcCourseSetTranscriptReady({
      sourceCourseCodes: ["BIOL& 212"],
      completedCourseCodes: [],
    }),
    false
  );
  assert.equal(
    isTransferPlannerGrcCourseSetTranscriptReady({
      sourceCourseCodes: ["BIOL& 212"],
      completedCourseCodes: ["BIOL& 211"],
    }),
    true
  );
  assert.equal(
    isTransferPlannerGrcCourseSetTranscriptReady({
      sourceCourseCodes: ["BIOL& 211"],
      completedCourseCodes: ["BIOL& 211"],
    }),
    false
  );
  assert.equal(
    isTransferPlannerGrcCourseSetTranscriptReady({
      sourceCourseCodes: ["BIOL& 211", "BIOL& 212"],
      completedCourseCodes: [],
    }),
    false
  );
  assert.equal(
    isTransferPlannerGrcCourseSetTranscriptReady({
      sourceCourseCodes: ["BIOL& 211", "BIOL& 212"],
      completedCourseCodes: ["BIOL& 211"],
    }),
    true
  );
});

test("Transfer planner passes major context into category equivalency links", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");
  const equivalencyCatalogPage = readFileSync(
    "components/pages/TransferEquivalencyCatalogPage.tsx",
    "utf8"
  );

  assert.match(transferPlannerPage, /params\.majorId = selectedMajorId;/);
  assert.match(transferPlannerPage, /params\.pathwayId = selectedPathwayId;/);
  assert.match(transferPlannerPage, /majorId: plan\.id/);
  assert.match(equivalencyCatalogPage, /selectedMajorPlan/);
  assert.match(equivalencyCatalogPage, /eligibleCourseCodesByTag/);
  assert.match(equivalencyCatalogPage, /doesCatalogEntryMatchEligibleSourceCourseCodes/);
});

test("Seattle CS Data Science option keeps ACS track breadth generic and out of UW-transfer-only mode", () => {
  const runtimeBasePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-science");
  assert.ok(runtimeBasePlan, "Expected a Seattle Computer Science runtime plan.");

  const resolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimeBasePlan,
    "data-science-option"
  );
  assert.ok(resolvedPlan, "Expected the Seattle CS Data Science option runtime row.");
  const track = getTransferPlannerTrack(resolvedPlan.bestTrackId ?? null);
  const fullQuarterPlan = buildSuggestedQuarterPlan({
    plan: resolvedPlan,
    ...buildStatuses(resolvedPlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const transferOnlyQuarterPlan = buildSuggestedQuarterPlan({
    plan: resolvedPlan,
    ...buildStatuses(resolvedPlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const fullPlannedCourses = fullQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const transferOnlyPlannedCourses = transferOnlyQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const transferOnlyPlannedLabels = transferOnlyPlannedCourses.map((course) => course.label);
  const matchedTrackPlaceholders = fullPlannedCourses.filter(
    (course) => course.label === "5 credits of A&H or SSc"
  );
  const namedDistributionExamples = ["CMST& 220", "PSYC& 100", "AMES 100", "ANTH& 206"];
  const parsedSourceBlocks = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-computer-science",
    "data-science-option"
  );
  const dataScienceSourceBlock = parsedSourceBlocks.find((block) =>
    /CS_DS_degreq_fall23\.pdf/i.test(block.sourceUrl)
  );
  const dataScienceApprovedScienceSupportLists = (resolvedPlan.supportLists ?? []).filter(
    (supportList) =>
      supportList.approvedListKey === "computer-science-approved-science"
  );

  assert.equal(
    resolvedPlan.bestTrackId,
    "grc-associate-stem-computer-science-associate-in-computer-science-acs-dta-mrp"
  );
  assert.ok(
    matchedTrackPlaceholders.length >= 1,
    "Expected generic A&H/SSc matched-track placeholders for Seattle CS."
  );
  assert.match(
    matchedTrackPlaceholders[0]?.guidanceSummary ?? "",
    /official matched Green River associate pathway map for Computer Science \(Data Science option\)/i
  );
  assert.ok(
    fullPlannedCourses.some(
      (course) =>
        course.label === "ENGL& 235" &&
        course.sourceKind === "official-grc-track" &&
        !/Official Green River ACS-DTA\/MRP/i.test(course.guidanceSummary ?? "")
    ),
    "Expected explicit ACS track courses like ENGL& 235 to remain visible."
  );

  for (const label of namedDistributionExamples) {
    assert.equal(
      fullPlannedCourses.some((course) => course.label === label),
      false,
      `Did not expect ${label} to remain as a named track recommendation.`
    );
    assert.equal(
      transferOnlyPlannedCourses.some((course) => course.label === label),
      false,
      `Did not expect ${label} in UW-transfer-only planning.`
    );
  }

  assert.equal(
    transferOnlyPlannedCourses.some((course) => course.label === "5 credits of A&H or SSc"),
    false
  );

  for (const label of ["CS 121", "CS 122", "CS 123", "MATH 240"]) {
    assert.equal(
      transferOnlyPlannedLabels.includes(label),
      true,
      `Expected scoped CS Data Science planning to schedule ${label}.`
    );
  }

  for (const label of [
    "PHYS& 222",
    "PHYS& 221",
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
    "CS 145",
    "CS& 141",
  ]) {
    assert.equal(
      transferOnlyPlannedLabels.includes(label),
      false,
      `Did not expect polluted CS Data Science planning to schedule ${label}.`
    );
  }

  assert.equal(
    transferOnlyPlannedLabels.some((label) => /CSE 4\d{2}|upper-division|Prerequisites:/i.test(label)),
    false
  );
  assert.ok(dataScienceSourceBlock, "Expected the Data Science degree-sheet PDF parse block.");
  assert.equal(dataScienceSourceBlock?.sourceRole, "pathway-degree-sheet");
  assert.ok(dataScienceSourceBlock?.parsedUwCourseCodes.includes("CSE 123"));
  assert.ok(dataScienceSourceBlock?.parsedUwCourseCodes.includes("CSE 143"));
  assert.ok(
    dataScienceApprovedScienceSupportLists.length > 0,
    "Expected CS Data Science to inherit source-backed CS approved-science support metadata."
  );
  assert.ok(
    dataScienceApprovedScienceSupportLists.every(
      (supportList) =>
        supportList.supportOnly === true &&
        supportList.canCreateRequiredRow === false &&
        supportList.canCreateScheduleRow === false &&
        supportList.sourceBackedProgramApproval === true
    )
  );
  assert.ok(
    dataScienceApprovedScienceSupportLists.some((supportList) =>
      supportList.acceptedUwCourseCodes.includes("PHYS 121")
    )
  );
  assert.ok(
    dataScienceApprovedScienceSupportLists.some((supportList) =>
      supportList.sourceEvidenceLines?.some((line) =>
        /Computer Science Natural Science Requirement/i.test(line)
      )
    )
  );
  assert.equal(
    dataScienceApprovedScienceSupportLists.some((supportList) =>
      supportList.acceptedUwCourseCodes.includes("CSE 123")
    ),
    false
  );
  assert.equal(
    dataScienceApprovedScienceSupportLists.some((supportList) =>
      supportList.acceptedUwCourseCodes.includes("MATH 124")
    ),
    false
  );
  for (const courseCode of ["PHYS 122", "BIOL 180", "BIOL 200"]) {
    assert.equal(
      dataScienceSourceBlock?.parsedUwCourseCodes.includes(courseCode),
      false,
      `Did not expect ${courseCode} to be parsed from the scoped CS Data Science degree sheet.`
    );
  }
});

test("Bothell CSSE general option gets the same generic ACS track breadth cleanup without losing explicit track courses", () => {
  const runtimeBasePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-bothell-csse");
  assert.ok(runtimeBasePlan, "Expected a Bothell CSSE runtime plan.");

  const resolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    runtimeBasePlan,
    "general-option"
  );
  assert.ok(resolvedPlan, "Expected the Bothell CSSE general option runtime row.");
  const track = getTransferPlannerTrack(resolvedPlan.bestTrackId ?? null);
  const plannedCourses = buildSuggestedQuarterPlan({
    plan: resolvedPlan,
    ...buildStatuses(resolvedPlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  })
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);

  assert.ok(
    plannedCourses.some(
      (course) =>
        course.label === "ENGL& 235" &&
        course.sourceKind === "official-grc-track" &&
        !/Official Green River ACS-DTA\/MRP/i.test(course.guidanceSummary ?? "")
    ),
    "Expected Bothell CSSE to keep explicit ACS track courses."
  );
  assert.ok(
    plannedCourses.some((course) => course.label === "5 credits of A&H or SSc"),
    "Expected Bothell CSSE to use generic A&H/SSc placeholders for ACS breadth guidance."
  );
  assert.equal(plannedCourses.some((course) => course.label === "CMST& 220"), false);
  assert.equal(plannedCourses.some((course) => course.label === "PSYC& 100"), false);
  assert.equal(plannedCourses.some((course) => course.label === "AMES 100"), false);
  assert.equal(plannedCourses.some((course) => course.label === "ANTH& 206"), false);
});

test.skip("Runtime CompE planning defaults to the matched track, then UW-only hides nonessential track extras", () => {
  const runtimeCompEPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");
  assert.ok(runtimeCompEPlan, "Expected a runtime Computer Engineering plan.");

  const track = getTransferPlannerTrack(runtimeCompEPlan.bestTrackId ?? null);
  const defaultQuarterPlan = buildSuggestedQuarterPlan({
    plan: runtimeCompEPlan,
    ...buildStatuses(runtimeCompEPlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const uwOnlyQuarterPlan = buildSuggestedQuarterPlan({
    plan: runtimeCompEPlan,
    ...buildStatuses(runtimeCompEPlan, []),
    completedCourses: [],
    track,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });

  const defaultPlannedLabels = defaultQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const uwOnlyPlannedLabels = uwOnlyQuarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(defaultPlannedLabels.includes("CHEM& 161"), true);
  assert.equal(defaultPlannedLabels.includes("PHYS& 223"), true);
  assert.equal(uwOnlyPlannedLabels.includes("CHEM& 161"), false);
  assert.equal(uwOnlyPlannedLabels.includes("PHYS& 223"), false);
  assert.equal(uwOnlyPlannedLabels.includes("PHYS& 221"), true);
  assert.equal(uwOnlyPlannedLabels.includes("PHYS& 222"), true);
});

test.skip("PHYS& 114 appears before engineering physics options in checklist alternatives", () => {
  const biomedPlan = getRequiredPlan("uw-tacoma-biomedical-sciences");
  const biomedPhysics = biomedPlan.applicationChecklist.find(
    (item) => item.id === "uwt-biomed-physics1"
  );
  assert.ok(biomedPhysics, "Expected Tacoma Biomedical Sciences first-physics checklist item.");
  assert.deepEqual(biomedPhysics?.grcCourses, ["PHYS& 114", "PHYS& 221"]);

  const essPlan = getRequiredPlan("uw-seattle-earth-and-space-sciences");
  const essPhysics = essPlan.applicationChecklist.find((item) => item.id === "uws-ess-physics");
  assert.ok(essPhysics, "Expected Seattle ESS physics support checklist item.");
  assert.deepEqual(essPhysics?.grcCourses, ["PHYS& 114", "PHYS& 221", "PHYS& 222"]);
});

test("All checklist alternatives list PHYS& 114 before PHYS& 221 or PHYS& 222", () => {
  const engineeringPhysicsLabels = ["PHYS& 221", "PHYS& 222"];

  const collectViolations = (
    checklistItems: TransferPlannerChecklistItem[] | undefined,
    contextLabel: string
  ) => {
    const violations: string[] = [];

    for (const item of checklistItems ?? []) {
      const candidateLists = [item.grcCourses, ...(item.alternatives ?? [])];
      for (const list of candidateLists) {
        const physics114Index = list.indexOf("PHYS& 114");
        if (physics114Index < 0) {
          continue;
        }

        for (const engineeringLabel of engineeringPhysicsLabels) {
          const engineeringIndex = list.indexOf(engineeringLabel);
          if (engineeringIndex >= 0 && physics114Index > engineeringIndex) {
            violations.push(
              `${contextLabel} -> ${item.id}: ${list.join(" | ")}`
            );
          }
        }
      }
    }

    return violations;
  };

  const allViolations = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.flatMap((plan) => {
    const planLabel = `${plan.id}`;
    const planViolations = [
      ...collectViolations(plan.applicationChecklist, `${planLabel} applicationChecklist`),
      ...collectViolations(plan.beforeEnrollmentChecklist, `${planLabel} beforeEnrollmentChecklist`),
      ...collectViolations(plan.stayAtGrcChecklist, `${planLabel} stayAtGrcChecklist`),
    ];

    const pathwayViolations = (plan.pathways ?? []).flatMap((pathway) => {
      const pathwayLabel = `${plan.id}/${pathway.id}`;
      return [
        ...collectViolations(
          pathway.applicationChecklist,
          `${pathwayLabel} applicationChecklist`
        ),
        ...collectViolations(
          pathway.beforeEnrollmentChecklist,
          `${pathwayLabel} beforeEnrollmentChecklist`
        ),
        ...collectViolations(pathway.stayAtGrcChecklist, `${pathwayLabel} stayAtGrcChecklist`),
      ];
    });

    return [...planViolations, ...pathwayViolations];
  });

  assert.deepEqual(
    allViolations,
    [],
    `Expected PHYS& 114 ordering to stay ahead of engineering physics options. Violations: ${allViolations.join("; ")}`
  );
});

test("Current runtime ECE planning does not promote obsolete guide-only BIOL 111 coverage", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-electrical-computer-engineering"
  );
  const planningState = getResolvedRuntimeQuarterPlanningState(
    "uw-seattle-electrical-computer-engineering"
  );

  assert.ok(runtimePlan, "Expected the Seattle ECE runtime planner row.");
  assert.equal(runtimePlan?.grcCourseList?.includes("BIOL 111"), false);
  assert.equal(getChecklistCoverageForPlan(runtimePlan).has("BIOL 111"), false);
  assert.equal(
    planningState.plannedQuarters.some((quarter) =>
      quarter.courses.some((course) => course.label === "BIOL 111")
    ),
    false
  );
});

test.skip("Every Seattle planner row now exposes real planner content, including custom guidance for proposal-based majors", () => {
  const seattlePlans = getTransferPlannerMajorsForCampus("uw-seattle");
  const missingContentPlanIds = seattlePlans
    .filter((plan) => {
      const hasDegreeMap = Boolean(plan.degreeMapSections?.length);
      const hasLinks = Boolean(plan.officialLinks.length);
      const hasGrcList = getTransferPlannerGrcCourseList(plan).length > 0;
      const hasGrcGuidance = Boolean(getTransferPlannerGrcCourseListGuidance(plan));
      return !hasDegreeMap || !hasLinks || (!hasGrcList && !hasGrcGuidance);
    })
    .map((plan) => plan.id);

  assert.deepEqual(missingContentPlanIds, []);
  assert.ok(individualizedStudiesPlan, "Expected Individualized Studies planner row.");
  assert.equal(getTransferPlannerGrcCourseList(individualizedStudiesPlan).length, 0);
  assert.match(
    getTransferPlannerGrcCourseListGuidance(individualizedStudiesPlan) ?? "",
    /student-designed Seattle major/i
  );
});

test("English Creative Writing no longer surfaces UW-only prep-target placeholder rows", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-english-creative-writing");
  const checklistTitles = getAllChecklistItems(runtimePlan ?? {}).map((item) => item.title);

  assert.ok(runtimePlan);
  assert.ok(!checklistTitles.includes("UW prep target: ENGL 206"));
  assert.ok(!checklistTitles.includes("UW prep target: ENGL 283"));
  assert.ok(!checklistTitles.includes("UW prep target: ENGL 284"));
  assert.ok(!checklistTitles.includes("UW prep target: ENGL 288"));
  assert.ok(!checklistTitles.includes("UW prep target: ENGL 295"));
  assert.ok(!checklistTitles.includes(AUTO_CUSTOM_PREP_FALLBACK_TITLE));
});
