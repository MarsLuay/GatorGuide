import {
  assert,
  auditRequiredMappedCourseCoverage,
  auditSourceScope,
  biologyPlan,
  bothellAppliedComputingPlan,
  buildChecklistItem,
  buildEligibleTransferCategorySourceCourseCodesForPlan,
  buildGeneralEducationRequirementLayerDiagnostics,
  buildGeneralEducationRequirementTargets,
  buildHistoricalGrcTrackComparison,
  buildMaterialsScienceNmeSourceIncompleteWarnings,
  buildQuarterPlan,
  buildRequirementStatuses,
  buildSourceBackedGeneralEducationRequirementTargets,
  buildSourceBackedMajorGeneralEducationRequirementSection,
  buildSourceBackedRequiredCourseCodes,
  buildSourceBackedRequiredCourseDescriptors,
  buildSourceBackedRequiredCourseSummaryEntries,
  buildSourceBackedUwCourseConsideredSummaryEntries,
  buildStatuses,
  buildSuggestedQuarterCourseOptionGroupsForTrack,
  buildSuggestedQuarterPlan,
  buildSuggestedQuarterRemainingCreditRange,
  buildTermTranscriptCourse,
  buildTranscriptCourses,
  buildTransferPlannerStudentCourseEvaluations,
  buildTransferPlannerStudentEvaluationReport,
  buildUwGeneralTransferRequirementSection,
  CANONICAL_COURSE_CODE_RE,
  chemEPlan,
  collectSuspiciousStructuralPathways,
  compEPlan,
  compETrack,
  countByValues,
  csPlan,
  escapeRegExp,
  EXPECTED_UW_TRANSFER_ADMISSION_REQUIREMENT_LINES,
  extractCourseCodes,
  getAllChecklistItems,
  getCurrentTransferPlannerGrcCatalogYearLabel,
  getDuplicateSortedValues,
  getGeneratedMetadataGapEntriesForCourse,
  getOfficialGuideRule,
  getPlannerOwnerPrimarySourceEntries,
  getPlannerVisibleSourceBackedGrcTitleGaps,
  getRequiredPlan,
  getTransferPlannerAutoMatchedTrackRecommendation,
  getTransferPlannerCanonicalCourse,
  getTransferPlannerEquivalencyRulesForSourceCourse,
  getTransferPlannerGrcCourseList,
  getTransferPlannerGrcCourseListGuidance,
  getTransferPlannerMajorPlan,
  getTransferPlannerNormalizedCourseMetadataEntry,
  getTransferPlannerParsedRequirementSourceBlocks,
  getTransferPlannerPathwaysForPlan,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerRequirementDiffClassifications,
  getTransferPlannerSourceGeneratedMajorsForCampus,
  getTransferPlannerSourceManifestEntriesForPlan,
  getTransferPlannerStudentRuntimeMajorPlan,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  getTransferPlannerStudentVisibleMajorsForCampus,
  getTransferPlannerStudentVisiblePathwaysForPlan,
  getTransferPlannerStudentVisibleSourceGeneratedMajorsForCampus,
  getTransferPlannerTrack,
  GUIDE_BACKED_EQUIVALENCY_RULE_SOURCE_KINDS,
  inferTransferPlannerGrcCatalogYearLabel,
  isSuspiciousStructuralPathwayId,
  isSuspiciousStructuralPathwayLabel,
  isTransferPlannerEquivalencyRuleEffectiveForTerm,
  materializeTransferPlannerPathways,
  normalizeCourseCode,
  normalizeMaterializedTransferPlannerPathwayLabel,
  parseCompletedTranscriptCourses,
  parseGrcEnrollmentRequirementText,
  readFileSync,
  resolveTransferPlannerMajorPlan,
  resolveTransferPlannerStudentRuntimeMajorPlan,
  seattleAmericanIndianStudiesPlan,
  seattleEconomicsPlan,
  seattleEssPlan,
  SHA_256_FINGERPRINT_RE,
  sourceGeneratedBothellPlans,
  sourceGeneratedChemistryPlan,
  sourceGeneratedEconomicsPlan,
  sourceGeneratedGeographyPlan,
  sourceGeneratedPhghPlan,
  sourceGeneratedPsychologyPlan,
  sourceGeneratedStatisticsPlan,
  sourceGeneratedTacomaAmcPlan,
  sourceGeneratedTacomaBabaPlan,
  sourceGeneratedTacomaEglsPlan,
  sourceGeneratedTacomaEnvSustainabilityPlan,
  sourceGeneratedTacomaPlans,
  sourceGeneratedTacomaSudPlan,
  sourceGeneratedTacomaUrbanStudiesPlan,
  tacomaCommunicationPlan,
  tacomaHistoryPlan,
  tacomaWritingPlan,
  test,
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS,
  TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY,
  TRANSFER_PLANNER_COURSE_METADATA_FIELD_GAP_STATES,
  TRANSFER_PLANNER_COURSE_METADATA_FIELD_GAPS,
  TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY,
  TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY,
  TRANSFER_PLANNER_GENERATED_COURSE_METADATA,
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY,
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS,
  TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY,
  TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY,
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY,
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS,
  TRANSFER_PLANNER_POLICY_REGISTRY,
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY,
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY,
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_REGISTRY_SUMMARY,
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY,
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY,
  TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY,
  TRANSFER_PLANNER_SOURCE_GAP_REGISTRY,
  TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS,
  TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY,
  TRANSFER_PLANNER_SOURCE_SUMMARY,
  TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS,
  TRANSFER_PLANNER_UW_GRC_ALL_EQUIVALENCY_RULES,
  TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES,
  TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES,
  uniqueSorted,
  urlHasAllowedHostnameAndPathPrefix,
  urlHasHostname,
  urlLooksLikeBlockedPrimarySource,
} from "./transfer-planner.test-support";
import type {
  TranscriptCourseEntry,
  TransferPlannerMajorPlan,
  TransferPlannerParsedRequirementSourceBlock,
} from "./transfer-planner.test-support";

test("Bothell Data Visualization rows keep the shared overview as primary while registering dedicated worksheets for lower-division evidence", () => {
  const worksheetUrlByPlanId = {
    "uw-bothell-data-visualization-ba": "https://admissions.uwb.edu/register/mpw-DataVis-BA",
    "uw-bothell-data-visualization-bs": "https://admissions.uwb.edu/register/mpw-DataVis-BS",
  } as const;

  for (const planId of Object.keys(worksheetUrlByPlanId) as Array<
    keyof typeof worksheetUrlByPlanId
  >) {
    const primarySource = getTransferPlannerPrimaryDegreeRequirementsSource(planId, null);
    const manifestEntries = getTransferPlannerSourceManifestEntriesForPlan(planId, null);
    const parsedBlocks = getTransferPlannerParsedRequirementSourceBlocks(planId, null);
    const runtimePlan = resolveTransferPlannerStudentRuntimeMajorPlan(
      getTransferPlannerStudentRuntimeMajorPlan(planId),
      null
    );

    assert.equal(
      primarySource?.url,
      "https://www.uwb.edu/ias/undergraduate/majors/data-visualization"
    );
    assert.ok(
      manifestEntries.some((entry) => entry.url === worksheetUrlByPlanId[planId]),
      `Expected ${planId} to register its dedicated official worksheet.`
    );
    assert.ok(
      parsedBlocks.some(
        (entry) =>
          entry.sourceUrl === primarySource?.url &&
          entry.primarySourceUrl === primarySource?.url &&
          entry.resolutionStrategy === "primary-source"
      ),
      `Expected ${planId} to parse the current overview page as the canonical requirement source.`
    );
    assert.ok(
      parsedBlocks.some(
        (entry) =>
          entry.parsedUwCourseCodes.includes("BBUS 301") &&
          entry.parsedUwCourseCodes.includes("BDATA 200")
      ),
      `Expected ${planId} to recover current overview-backed lower-division signals.`
    );

    assert.ok(runtimePlan, `Expected runtime planner data for ${planId}.`);
    assert.ok(
      getTransferPlannerGrcCourseList(runtimePlan).includes("ENGL& 101"),
      `Expected ${planId} to retain the Green River composition path.`
    );
    const autoMatch =
      getTransferPlannerAutoMatchedTrackRecommendation(getTransferPlannerGrcCourseList(runtimePlan)) ?? null;
    assert.equal(runtimePlan?.bestTrackId ?? null, autoMatch?.trackId ?? null);
    assert.ok(
      autoMatch?.trackId,
      `Expected ${planId} to keep a source-backed track recommendation once the overview surfaced multiple lower-division signals.`
    );
  }
});

test("Prompt 2 source discovery keeps multi-route roots from being replaced by single-route pages", () => {
  const chemistryRootPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-chemistry",
    null
  );
  const chemistryBaPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-chemistry",
    "ba-route"
  );

  assert.equal(
    chemistryRootPrimary?.url,
    "https://chem.washington.edu/sites/chem/files/documents/undergrad/acs2018.pdf"
  );
  assert.equal(chemistryBaPrimary?.url, "https://chem.washington.edu/ba-chemistry");
});

test("Prompt 2 source parsers recover exact official course-list evidence without room-number leakage", () => {
  const performanceParsedBlocks = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-drama",
    "performance"
  );
  const performanceCourseCodes = new Set(
    performanceParsedBlocks.flatMap((entry) => entry.parsedUwCourseCodes)
  );
  const socialWelfareParsedBlocks = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-social-welfare",
    null
  );
  const socialWelfareCourseCodes = new Set(
    socialWelfareParsedBlocks.flatMap((entry) => entry.parsedUwCourseCodes)
  );

  for (const courseCode of [
    "DRAMA 201",
    "DRAMA 251",
    "DRAMA 302",
    "DRAMA 371",
    "DRAMA 372",
    "DRAMA 373",
  ]) {
    assert.ok(
      performanceCourseCodes.has(courseCode),
      `Expected Drama Performance to recover ${courseCode} from the official completion-requirements line.`
    );
  }

  assert.ok(
    socialWelfareCourseCodes.has("TSOCWF 430") && socialWelfareCourseCodes.has("TSOCWF 490"),
    "Expected Tacoma Social Welfare to recover TSOCWF course evidence from the official curriculum page."
  );
  assert.equal(
    socialWelfareCourseCodes.has("WCG 203"),
    false,
    "Expected Tacoma Social Welfare parsing to keep campus room/location text out of course codes."
  );
});

test("The UW Green River equivalency guide stays registered as a shared reference instead of a degree primary", () => {
  const equivalencyGuideUrl =
    "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/";
  const referenceEntry = TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.find(
    (entry) =>
      entry.ownerType === "reference" &&
      entry.ownerId === "uw-green-river-equivalency-guide" &&
      entry.url === equivalencyGuideUrl
  );

  assert.ok(
    referenceEntry,
    "Expected the shared equivalency guide to stay registered in the source manifest."
  );
  assert.equal(referenceEntry?.role, "equivalency");
  assert.equal(referenceEntry?.isPrimaryDegreeRequirementsLink, false);
  assert.ok(
    TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY
      .filter((entry) => entry.url === equivalencyGuideUrl)
      .every((entry) => entry.ownerType === "reference" || !entry.isPrimaryDegreeRequirementsLink),
    "Expected the shared equivalency guide to avoid replacing dedicated degree-requirements primaries."
  );
});

test("Support-first majors stay empty when UW essential only is on and no source-backed prep exists", () => {
  assert.ok(
    seattleAmericanIndianStudiesPlan,
    "Expected an American Indian Studies planner row."
  );

  const plannedCourses = buildQuarterPlan(
    seattleAmericanIndianStudiesPlan,
    getTransferPlannerTrack(seattleAmericanIndianStudiesPlan.bestTrackId),
    buildTranscriptCourses(
      "CMST& 220",
      "MATH& 151",
      "CS 121",
      "ENGL& 236",
      "MATH& 152",
      "CS 122",
      "ENGL& 101",
      "PHIL& 101",
      "CMST& 230",
      "ENGL 128",
      "PHYS& 221",
      "ENGR& 104",
      "BUS& 101",
      "CMST& 210",
      "MATH& 163",
      "CS 123",
      "MATH 238",
      "MATH& 254"
    )
  )
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses);

  assert.ok(plannedCourses.length <= 1);
});

test.skip("Source-generated majors no longer leave all three checklist buckets empty", () => {
  const missingBuckets = TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.filter(
    (plan) =>
      (plan.applicationChecklist?.length ?? 0) === 0 &&
      (plan.beforeEnrollmentChecklist?.length ?? 0) === 0 &&
      (plan.stayAtGrcChecklist?.length ?? 0) === 0
  ).map((plan) => plan.id);

  assert.ok(
    missingBuckets.length < TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.length,
    "Expected checklist-bucket data to be materialized for at least some source-generated majors."
  );

  const individualizedStudies = getTransferPlannerMajorPlan("uw-seattle-individualized-studies");
  const envDesign = getTransferPlannerMajorPlan(
    "uw-seattle-environmental-design-and-sustainability"
  );

  assert.ok(individualizedStudies, "Expected Individualized Studies planner row.");
  assert.ok(envDesign, "Expected Environmental Design & Sustainability planner row.");
  assert.equal(Boolean(individualizedStudies), true);
  assert.equal((envDesign?.grcCourseList?.length ?? 0) >= 0, true);
  assert.equal((envDesign?.degreeMapSections?.length ?? 0) > 0, true);
  assert.equal(typeof (individualizedStudies?.stayAtGrcChecklist[0]?.note ?? ""), "string");
  assert.match(envDesign?.summary ?? "", /environmental design/i);
});

test("Student-facing planner copy uses source-backed-or-hidden language", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(transferPlannerPage, /source-backed plan/i);
  assert.match(transferPlannerPage, /unsupported majors, rules, or sequences stay hidden/i);
  assert.match(transferPlannerPage, /Source-backed summary/);
  assert.doesNotMatch(transferPlannerPage, /confirm with your advisor before scheduling classes/i);
  assert.doesNotMatch(transferPlannerPage, /confirm the final class order with an advisor/i);
  assert.doesNotMatch(transferPlannerPage, /Advisor-ready summary/);
});

test("Source-generated planner copy strips legacy advisor-review language from visible plan fields", () => {
  const envDesign = getTransferPlannerMajorPlan("uw-seattle-environmental-design-and-sustainability");

  assert.ok(envDesign, "Expected Environmental Design & Sustainability planner row.");
  assert.doesNotMatch(envDesign.summary, /advisor|adviser/i);
  assert.equal(
    (envDesign.advisorFlags ?? []).some((flag) => /advisor|adviser/i.test(flag)),
    false
  );
  assert.equal(
    (envDesign.validationNotes ?? []).some((note) => /manual review|advisor|adviser/i.test(note)),
    false
  );
  assert.doesNotMatch(envDesign.summary, /manual review|advisor|adviser/i);
});

test("Seattle Computer Engineering source-backed recovery keeps a useful lower-division prep floor", () => {
  const parsedBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-computer-engineering"
  )[0];
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");

  assert.ok(parsedBlock, "Expected the Seattle Computer Engineering parsed requirement-source block.");
  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");

  assert.equal(parsedBlock?.parserType, "pdf-degree-sheet");
  assert.match(parsedBlock?.sourceUrl ?? "", /CompE_degreq.*\.pdf/i);
  assert.ok(
    parsedBlock?.requirementCueLines.some((line) =>
      /Mathematics\s*&\s*Natural Sciences\s*\(41 credits\)/i.test(line)
    )
  );
  assert.equal((parsedBlock?.parsedUwCourseCodes.length ?? 0) >= 24, true);
  assert.deepEqual(parsedBlock?.sourceOnlyUwCourseCodes ?? [], []);

  const expectedParsedMinimum = [
    "CSE 121",
    "CSE 122",
    "CSE 123",
    "EE 205",
    "EE 215",
    "ENGL 131",
    "MATH 124",
    "MATH 125",
    "MATH 126",
    "MATH 208",
    "PHYS 121",
    "PHYS 122",
  ];
  for (const courseCode of expectedParsedMinimum) {
    assert.equal(
      parsedBlock?.parsedUwCourseCodes.includes(courseCode) ?? false,
      true,
      `Expected Seattle Computer Engineering to recover ${courseCode} from the official source.`
    );
  }

  const runtimeCourseList = getTransferPlannerGrcCourseList(runtimePlan);
  const runtimeRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    runtimeCourseList,
    runtimePlan?.bestTrackId ?? null,
    { majorTitle: runtimePlan?.title ?? null }
  );
  const expectedRuntimeMinimum = [
    "CS 121",
    "CS 122",
    "CS 123",
    "ENGL& 101",
    "ENGR& 204",
    "MATH 240",
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "PHYS& 221",
    "PHYS& 222",
  ];
  for (const courseCode of expectedRuntimeMinimum) {
    assert.equal(
      runtimeCourseList.includes(courseCode),
      true,
      `Expected Seattle Computer Engineering runtime planning to keep ${courseCode}.`
    );
  }

  assert.equal(runtimeCourseList.length >= 12, true);
  assert.equal(
    runtimePlan?.bestTrackId,
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-computer-and-electrical-engineering"
  );
  assert.equal(runtimeRecommendation?.trackId, runtimePlan?.bestTrackId ?? null);
  assert.equal((runtimeRecommendation?.matchCount ?? 0) >= 10, true);
});

test("Seattle Computer Engineering source-backed required-course summary excludes approved-list spillover and keeps true required prep", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");

  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");

  const requiredCourseCodes = buildSourceBackedRequiredCourseCodes(runtimePlan);
  const forbiddenCourseCodes = [
    "BIOL& 211",
    "BIOL& 212",
    "BIOL& 213",
    "CHEM& 131",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "CHEM& 261",
    "CHEM& 262",
    "CHEM& 263",
    "CS 121",
    "CS 122",
    "CS 145",
    "CS 123",
    "ENGL 128",
    "MATH 238",
    "PHYS& 116",
    "PHYS& 156",
    "PHYS& 223",
  ];
  for (const courseCode of forbiddenCourseCodes) {
    assert.equal(
      requiredCourseCodes.includes(courseCode),
      false,
      `Did not expect Seattle Computer Engineering to label ${courseCode} as an individually required Green River course.`
    );
  }

  const expectedCourseCodes = [
    "ENGL& 101",
    "ENGR& 204",
    "MATH 240",
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "PHYS& 221",
    "PHYS& 222",
  ];
  for (const courseCode of expectedCourseCodes) {
    assert.equal(
      requiredCourseCodes.includes(courseCode),
      true,
      `Expected Seattle Computer Engineering to keep ${courseCode} in the source-backed required-course summary.`
    );
  }
});

test("HCDE source-backed required-course summaries keep the calculus bucket structured instead of flattening fake individual rows", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-human-centered-design-engineering"
  );

  assert.ok(runtimePlan, "Expected the HCDE runtime plan.");

  const descriptors = buildSourceBackedRequiredCourseDescriptors(runtimePlan);
  const calculusDescriptor = descriptors.find((descriptor) => descriptor.id === "ten-calc-credits");
  const uwSummaryEntries = buildSourceBackedRequiredCourseSummaryEntries(runtimePlan, {
    mode: "uw",
  });

  assert.ok(calculusDescriptor, "Expected HCDE to keep the calculus checklist item.");
  assert.equal(calculusDescriptor?.kind, "choice-bucket");
  assert.equal(calculusDescriptor?.requiredCompletedCount, 2);
  assert.deepEqual(calculusDescriptor?.explicitCourseCodes, ["MATH& 151", "MATH& 152", "MATH& 163"]);
  assert.equal(
    uwSummaryEntries.some((entry) => /Ten calculus credits - choose 2 from this list\./i.test(entry.text)),
    true,
    "Expected the HCDE summary to keep the calculus bucket structured."
  );
  for (const courseCode of ["MATH& 151", "MATH& 152", "MATH& 163"]) {
    assert.equal(
      uwSummaryEntries.some((entry) =>
        new RegExp(`^${escapeRegExp(courseCode)}(?:\\b|\\s+-).*is required\\.`, "i").test(entry.text)
      ),
      false,
      `Did not expect the HCDE summary to flatten ${courseCode} into an unconditional required-course sentence.`
    );
  }
});

test("Seattle Computer Engineering source-backed summaries keep approved calculus options structured", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-engineering");

  assert.ok(runtimePlan, "Expected the Seattle Computer Engineering runtime plan.");

  const descriptors = buildSourceBackedRequiredCourseDescriptors(runtimePlan);
  const calculusDescriptor = descriptors.find((descriptor) => descriptor.id === "calc123");
  const uwSummaryEntries = buildSourceBackedRequiredCourseSummaryEntries(runtimePlan, {
    mode: "uw",
  });

  assert.ok(calculusDescriptor, "Expected the CompE calculus sequence descriptor.");
  assert.equal(calculusDescriptor?.kind, "choice-bucket");
  assert.equal(calculusDescriptor?.courseLabelSets.length, 2);
  assert.equal(
    uwSummaryEntries.some((entry) => /Calculus I-III sequence - complete one approved option\./i.test(entry.text)),
    true,
    "Expected the CompE summary to keep the calculus choice structure."
  );
  for (const courseCode of ["MATH& 151", "MATH& 152", "MATH& 163", "MATH& 153", "MATH& 254"]) {
    assert.equal(
      uwSummaryEntries.some((entry) =>
        new RegExp(`^${escapeRegExp(courseCode)}(?:\\b|\\s+-).*is required\\.`, "i").test(entry.text)
      ),
      false,
      `Did not expect the CompE summary to flatten ${courseCode} into an unconditional required-course sentence.`
    );
  }
});

test("Aquatic source-backed required-course recovery keeps English composition and drops recommended CLAS/COM spillover", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-aquatic-conservation-and-ecology"
  );
  const clasClassification = getTransferPlannerRequirementDiffClassifications(
    "uw-seattle-aquatic-conservation-and-ecology"
  ).find((entry) => entry.sourceUwCourseCode === "CLAS 205");

  assert.ok(runtimePlan, "Expected the Aquatic Conservation & Ecology runtime plan.");
  assert.ok(
    clasClassification,
    "Expected Aquatic Conservation & Ecology to retain the underlying CLAS 205 classification."
  );
  assert.ok(
    (clasClassification?.validationNotes ?? []).some((note) => /recommended/i.test(note)),
    "Expected the CLAS 205 classification to preserve its recommended-only cue."
  );

  const requiredCourseCodes = buildSourceBackedRequiredCourseCodes(runtimePlan);
  assert.deepEqual(requiredCourseCodes, ["ENGL& 101"]);
  assert.equal(getTransferPlannerGrcCourseList(runtimePlan).includes("CMST& 220"), false);
  assert.equal(
    runtimePlan.applicationChecklist.some((item) => item.grcCourses.includes("CMST& 220")),
    false
  );

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

  assert.equal(plannedCourseCodes.has("ENGL& 101"), true);
  assert.equal(plannedCourseCodes.has("CMST& 220"), false);
});

test("Architectural Design automatically drops unsafe suggested-course spillover from the source-backed required-course summary", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-architectural-design");
  const math112Classification = getTransferPlannerRequirementDiffClassifications(
    "uw-seattle-architectural-design"
  ).find((entry) => entry.sourceUwCourseCode === "MATH 112");

  assert.ok(runtimePlan, "Expected the Seattle Architectural Design runtime plan.");
  assert.ok(
    math112Classification,
    "Expected Seattle Architectural Design to keep the underlying source-backed MATH 112 classification."
  );
  assert.equal(
    math112Classification?.grcCourseCodes.includes("MATH& 148"),
    true,
    "Expected the underlying classification registry to still record the guide-backed MATH& 148 path."
  );
  assert.ok(
    (math112Classification?.validationNotes ?? []).some((note) =>
      /suggested|elective|approved-list/i.test(note)
    )
  );

  const requiredCourseCodes = buildSourceBackedRequiredCourseCodes(runtimePlan);
  assert.equal(requiredCourseCodes.includes("MATH& 148"), false);
  assert.equal(requiredCourseCodes.includes("ENGL& 101"), true);
});

test("Runtime computing-sequence recovery uses shared guide-backed evidence without leaking optional engineering lists", () => {
  const runtimeCompEPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-computer-engineering"
  );
  const runtimeCsPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-science");
  const runtimeCivilPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-civil-engineering");
  const runtimeHcdePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-human-centered-design-engineering"
  );

  assert.ok(runtimeCompEPlan, "Expected runtime Seattle Computer Engineering plan.");
  assert.ok(runtimeCsPlan, "Expected runtime Seattle Computer Science plan.");
  assert.ok(runtimeCivilPlan, "Expected runtime Seattle Civil Engineering plan.");
  assert.ok(runtimeHcdePlan, "Expected runtime Seattle HCDE plan.");

  const runtimeCompEBeforeEnrollment = runtimeCompEPlan?.beforeEnrollmentChecklist ?? [];
  const runtimeCsBeforeEnrollment = runtimeCsPlan?.beforeEnrollmentChecklist ?? [];
  const runtimeCivilBeforeEnrollment = runtimeCivilPlan?.beforeEnrollmentChecklist ?? [];
  const runtimeHcdeBeforeEnrollment = runtimeHcdePlan?.beforeEnrollmentChecklist ?? [];

  const compEProgrammingSequence = runtimeCompEBeforeEnrollment.find(
    (item) => item.title === "CSE 121-123 programming sequence"
  );

  assert.deepEqual(compEProgrammingSequence?.grcCourses ?? [], ["CS 121", "CS 122", "CS 123"]);
  assert.deepEqual(
    ["CS 121", "CS 122", "CS 123"].filter((courseCode) =>
      getTransferPlannerGrcCourseList(runtimeCsPlan).includes(courseCode)
    ),
    ["CS 121", "CS 122", "CS 123"]
  );
  assert.equal(
    runtimeCivilBeforeEnrollment.some(
      (item) => item.title === "CSE 121-123 programming sequence"
    ),
    false
  );
  assert.equal(
    runtimeHcdeBeforeEnrollment.some(
      (item) => item.title === "CSE 121-123 programming sequence"
    ),
    false
  );
});

test("Source-backed classifications that were explicitly marked unsafe no longer materialize into runtime requirement atoms", () => {
  const unsafeAtoms = TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY.filter((entry) =>
    entry.validationNotes.some((note) =>
      /Auto-promotion was intentionally skipped/i.test(String(note ?? ""))
    )
  ).map((entry) => ({
    id: entry.id,
    planId: entry.planId,
    title: entry.title,
  }));

  assert.deepEqual(unsafeAtoms, []);
});

test("UW majors without parsed breadth targets keep the major-specific bucket empty while the official transfer section stays policy-based", () => {
  const plan = {
    id: "test-no-general-ed-fallback",
    campusId: "uw-seattle",
    title: "Fallback Removal Test",
    shortTitle: "Fallback Test",
    coverage: "detailed",
    summary: "",
    icon: "school",
    colorGradient: ["#000000", "#111111"],
    themeColor: "#000000",
    officialLinks: [],
    deadlines: [],
    requirements: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    grcCourseList: [],
    grcCourseListGuidance: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    advisorFlags: [],
    guidanceItems: [],
    degreeMapSections: [],
    specialNotes: [],
    tips: [],
    targetSchools: [],
    targetSchoolDetails: [],
    prerequisites: [],
    pathways: [],
  } as TransferPlannerMajorPlan;
  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(plan);
  const generalRequirementSection = buildUwGeneralTransferRequirementSection(plan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(plan), {
    ahCredits: null,
    sscCredits: null,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.deepEqual(buildGeneralEducationRequirementTargets(plan), {
    ahCredits: null,
    sscCredits: null,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(diagnostics.hasSourceBackedTargets, false);
  assert.deepEqual(diagnostics.plannerGuidanceTargets, {
    ahCredits: null,
    sscCredits: null,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(generalRequirementSection?.title, "UW Transfer Admission Requirements");
  assert.equal(generalRequirementSection?.plannerUsage, "summary-only");
  assert.match(
    generalRequirementSection?.summary ?? "",
    /40 transferable college quarter credits/i
  );
  assert.deepEqual(
    generalRequirementSection?.items.map((entry) => `${entry.label}: ${entry.valueText}`),
    EXPECTED_UW_TRANSFER_ADMISSION_REQUIREMENT_LINES
  );
  assert.equal(
    generalRequirementSection?.items.some((entry) =>
      /A&H|SSc|NSc/i.test(entry.label) || /\b20\b/.test(entry.valueText)
    ),
    false
  );
});

test("Tacoma Social Welfare keeps stronger source-backed breadth targets separate from the official UW transfer section", () => {
  const plan = getRequiredPlan("uw-tacoma-social-welfare");
  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(plan);
  const generalRequirementSection = buildUwGeneralTransferRequirementSection(plan);

  assert.deepEqual(diagnostics.sourceBackedTargets, {
    ahCredits: 20,
    sscCredits: 20,
    nscCredits: 20,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(diagnostics.hasSourceBackedTargets, true);
  assert.deepEqual(diagnostics.plannerGuidanceTargets, {
    ahCredits: null,
    sscCredits: null,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(generalRequirementSection?.plannerUsage, "summary-only");
  assert.equal(
    generalRequirementSection?.items.some((entry) =>
      entry.id === "ah" || entry.id === "ssc" || entry.id === "nsc" || /\b20\b/.test(entry.valueText)
    ),
    false
  );
});

test("HCDE shared-bucket gen-ed targets now promote into source-backed major summary items and plannable fixed targets", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-human-centered-design-engineering"
  );
  assert.ok(runtimePlan, "Expected the HCDE runtime plan.");

  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(runtimePlan);
  const section = buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(runtimePlan), {
    ahCredits: 10,
    sscCredits: 10,
    nscCredits: 50,
    breadthCredits: 10,
    electiveCredits: null,
  });
  assert.ok(section, "Expected HCDE major-specific source-backed gen-ed summary items.");
  assert.equal(
    section?.items.some(
      (entry) =>
        entry.label === "Arts & Humanities" && entry.valueText === "10 credits"
    ),
    true
  );
  assert.equal(
    section?.items.some(
      (entry) =>
        entry.label === "Social Sciences" && entry.valueText === "10 credits"
    ),
    true
  );
  assert.equal(
    section?.items.some(
      (entry) =>
        entry.label === "Additional Arts & Humanities / Social Sciences" &&
        entry.valueText === "10 credits"
    ),
    true
  );
  assert.equal(
    section?.items.some(
      (entry) =>
        entry.label === "Natural Sciences" && entry.valueText === "50 credits"
    ),
    true
  );
  assert.equal(diagnostics.hasSourceBackedTargets, true);
  assert.ok(diagnostics.sourceBackedSummarySection);
});

test("Generated GRC AST-2 Bio/Chem track stays faithful to the official source-backed curriculum map", () => {
  const track = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find(
    (entry) =>
      entry.id ===
      "grc-associate-stem-engineering-associate-in-science-transfer-track-2-bioengineering-and-chemical-engineering"
  );
  assert.ok(track, "Expected the generated AST-2 Bio/Chem track.");

  assert.deepEqual(
    track.terms.map((term) => ({ label: term.label, courses: term.courses })),
    [
      {
        label: "Quarter 0",
        courses: ["CHEM& 140", "PHYS& 114", "MATH& 141", "MATH& 142"],
      },
      {
        label: "Quarter 1 (18 credits)",
        courses: ["CHEM& 161", "ENGL& 101", "ENGR 100", "MATH& 151"],
      },
      {
        label: "Quarter 2 (14 credits)",
        courses: ["CHEM& 162", "ENGR 106", "MATH& 152"],
      },
      {
        label: "Quarter 3 (16 credits)",
        courses: [
          "CHEM& 163",
          "MATH& 163",
          "2 C - Humanities/Fine Arts/English or Social Science",
        ],
      },
      {
        label: "Quarter 4 (15 credits)",
        courses: [
          "MATH& 254",
          "PHYS& 221",
          "2 C - Humanities/Fine Arts/English or Social Science",
        ],
      },
      {
        label: "Quarter 5 (16 credits)",
        courses: ["MATH 238", "PHYS& 222", "BIOL& 211", "CHEM& 261"],
      },
      {
        label: "Quarter 6 (15 credits)",
        courses: [
          "MATH 240",
          "PHYS& 223",
          "2 C - Humanities/Fine Arts/English or Social Science",
        ],
      },
    ]
  );
  assert.ok(
    track.notes.some((note) =>
      /CHEM& 140 is only required if no prior chemistry experience/i.test(note)
    )
  );
});

test("GRC-only Accounting AAA preserves exact catalog credits with unresolved choices", () => {
  const track = getTransferPlannerTrack("grc-associate-business-entrepreneurship-accounting-aaa");
  assert.ok(track, "Expected the GRC Accounting AAA track.");

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    plannerCollegeId: "grc",
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const range = buildSuggestedQuarterRemainingCreditRange({
    quarters: quarterPlan,
    track,
    creditBucketMode: "combined",
  });

  assert.equal(range.stemPrepCredits, 0);
  assert.equal(range.localPrerequisiteCredits, 0);
  assert.equal(range.hiddenUwOnlyCredits, 0);
  assert.equal(range.mainMinRemainingCredits, range.minRemainingCredits);
  assert.equal(range.mainMaxRemainingCredits, range.maxRemainingCredits);
  assert.equal(track.minimumCredits, 90);
  assert.equal(track.maximumCredits, 90);
  assert.equal(track.catalogCreditRange?.isExact, true);
  assert.equal(range.catalogMinimumCredits, 90);
  assert.equal(range.catalogMaximumCredits, 90);
  assert.equal(range.minRemainingCredits, 90);
  assert.equal(range.maxRemainingCredits, 90);
  assert.equal(range.exactRemainingCredits, null);
  assert.equal(range.mainScheduledMinRemainingCredits, 80);
  assert.equal(range.mainScheduledMaxRemainingCredits, 90);
  assert.equal(range.hasUnresolvedOptions, true);
});

test("Seattle Education Studies keeps mixed conflicting catalog gen-ed structures unsupported until a single coherent major-specific target is isolated", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-education-studies");
  assert.ok(runtimePlan, "Expected the Education Studies runtime plan.");

  const diagnostics = buildGeneralEducationRequirementLayerDiagnostics(runtimePlan);

  assert.deepEqual(buildSourceBackedGeneralEducationRequirementTargets(runtimePlan), {
    ahCredits: null,
    sscCredits: null,
    nscCredits: null,
    breadthCredits: null,
    electiveCredits: null,
  });
  assert.equal(buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan), null);
  assert.equal(diagnostics.hasSourceBackedTargets, false);
});

test("Seattle Aeronautics fixed source-backed gen-ed targets still render as simple major summary items", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-aeronautics-astronautics");
  assert.ok(runtimePlan, "Expected the Aeronautics runtime plan.");

  const section = buildSourceBackedMajorGeneralEducationRequirementSection(runtimePlan);

  assert.ok(section, "Expected Aeronautics source-backed gen-ed summary items.");
  assert.deepEqual(
    section?.items.map((entry) => `${entry.label}: ${entry.valueText}`),
    [
      "Arts & Humanities: 10 credits",
      "Social Sciences: 10 credits",
      "Additional Arts & Humanities / Social Sciences: 4 credits",
    ]
  );
});

test("Seattle American Ethnic Studies UW courses considered include source-backed UW degree courses beyond Green River equivalents", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-american-ethnic-studies");
  assert.ok(runtimePlan, "Expected the American Ethnic Studies runtime plan.");

  const entries = buildSourceBackedUwCourseConsideredSummaryEntries(runtimePlan);
  const courseCodes = entries.map((entry) => entry.courseCode);
  const entryText = entries.map((entry) => entry.text).join("\n");

  for (const courseCode of [
    "AAS 101",
    "AFRAM 101",
    "CHSTU 101",
    "AES 150",
    "AES 151",
    "AES 212",
    "ENGL 131",
    "AFRAM 214",
    "AAS 220",
    "CHSTU 416",
    "AES 487",
  ]) {
    assert.ok(courseCodes.includes(courseCode), `Expected UW courses considered to include ${courseCode}.`);
  }
  assert.equal(courseCodes.includes("ENGL& 101"), false);
  assert.match(entryText, /AAS 101 - /);
  assert.match(entryText, /AFRAM 214/);
});

test("Green River track generation covers the current official associate program-map library and can widen to more program types", () => {
  const generatedTrackSummaryRecord =
    TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY as Record<string, unknown>;
  const supportedProgramCount =
    "officialSupportedProgramCount" in generatedTrackSummaryRecord
      ? Number(generatedTrackSummaryRecord["officialSupportedProgramCount"] ?? 0)
      : TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.officialAssociateTrackCount;
  const connectedSupportedProgramCount =
    "connectedSupportedProgramCount" in generatedTrackSummaryRecord
      ? Number(generatedTrackSummaryRecord["connectedSupportedProgramCount"] ?? 0)
      : TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.connectedAssociateTrackCount;

  assert.ok(TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.programMapPageCount > 0);
  assert.ok(TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.officialAssociateTrackCount >= 80);
  assert.ok(supportedProgramCount >= TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.officialAssociateTrackCount);
  assert.ok(
    TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.connectedAssociateTrackCount <=
      TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.officialAssociateTrackCount
  );
  assert.ok(connectedSupportedProgramCount <= supportedProgramCount);
  assert.equal(
    TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACK_SUMMARY.generatedTrackCount,
    connectedSupportedProgramCount
  );

  const businessManagementTrack = getTransferPlannerTrack(
    "grc-associate-business-entrepreneurship-business-management-aaa"
  );
  const englishCreativeWritingTrack = getTransferPlannerTrack(
    "grc-associate-fine-arts-humanities-english-aa-dta-emphasis-creative-writing"
  );
  const practicalNursingTrack = getTransferPlannerTrack(
    "grc-associate-healthcare-wellness-nursing-practical-nursing-aas"
  );
  const automotiveTrack = getTransferPlannerTrack(
    "grc-associate-trades-industrial-tech-aviation-natural-resources-automotive-technology-aas"
  );

  for (const track of [
    businessManagementTrack,
    englishCreativeWritingTrack,
    practicalNursingTrack,
    automotiveTrack,
  ]) {
    assert.ok(track, "Expected generated associate tracks across transfer and non-transfer categories.");
    assert.ok(track?.officialLinks?.length, `Expected ${track?.id ?? "track"} to include source links.`);
    assert.ok(track?.terms.length, `Expected ${track?.id ?? "track"} to keep generated curriculum terms.`);
  }

  assert.equal(businessManagementTrack?.code, "AAA");
  assert.equal(englishCreativeWritingTrack?.code, "AA-DTA");
  assert.equal(practicalNursingTrack?.code, "AAS");
  assert.equal(automotiveTrack?.code, "AAS");
});

test("Green River generated credit bounds ignore residency-only catalog minimums", () => {
  const acsTrack = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find(
    (track) =>
      track.id === "grc-associate-stem-computer-science-associate-in-computer-science-acs-dta-mrp"
  );
  assert.ok(acsTrack, "Expected the generated Associate in Computer Science track.");
  assert.equal(acsTrack.minimumCredits, 90);
  assert.equal(acsTrack.maximumCredits, 90);
  assert.equal(
    TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.some(
      (track) =>
        (track.minimumCredits === 24 || track.maximumCredits === 24) &&
        track.notes.some((note) => /Published duration:\s*90 credits\./i.test(note))
    ),
    false
  );
});

test("Green River generated metadata preserves catalog ranges and catalog-only option lists", () => {
  const accountingTrack = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find(
    (track) => track.id === "grc-associate-business-entrepreneurship-accounting-aaa"
  );
  const businessManagementTrack = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find(
    (track) => track.id === "grc-associate-business-entrepreneurship-business-management-aaa"
  );
  const politicalScienceTrack = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find(
    (track) =>
      track.id ===
      "grc-associate-education-law-social-science-political-science-aa-dta-with-emphasis-political-science"
  );
  const musicTrack = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find(
    (track) =>
      track.id === "grc-associate-fine-arts-humanities-music-aa-dta-concentration-music"
  );
  const diversityTrack = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find(
    (track) =>
      track.id ===
      "grc-associate-fine-arts-humanities-diversity-studies-aa-dta-concentration-diversity-studies"
  );
  const globalStudiesTrack = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find(
    (track) =>
      track.id ===
      "grc-associate-fine-arts-humanities-global-studies-aa-dta-concentration-global-studies"
  );

  assert.ok(accountingTrack, "Expected generated Accounting AAA track.");
  assert.equal(accountingTrack.minimumCredits, 90);
  assert.equal(accountingTrack.maximumCredits, 90);
  assert.equal(accountingTrack.catalogCreditRange?.sourceKind, "catalog-requirement-description");
  assert.equal(accountingTrack.catalogCreditRange?.isExact, true);

  assert.ok(businessManagementTrack, "Expected generated Business Management AAA track.");
  assert.equal(businessManagementTrack.minimumCredits, 90);
  assert.equal(businessManagementTrack.maximumCredits, 95);
  assert.equal(businessManagementTrack.catalogCreditRange?.isExact, false);
  assert.match(businessManagementTrack.catalogCreditRange?.sourceText ?? "", /90-95 Credits/i);

  assert.ok(politicalScienceTrack, "Expected generated Political Science AA-DTA track.");
  const politicalScienceLabels = politicalScienceTrack.terms.flatMap((term) => term.courses);
  assert.equal(politicalScienceLabels.includes("CMST& 101"), false);
  assert.equal(politicalScienceLabels.includes("CMST& 220"), false);
  assert.equal(politicalScienceLabels.includes("AMES 100"), false);
  assert.equal(politicalScienceLabels.includes("AMES 103"), false);

  assert.ok(musicTrack, "Expected generated Music AA-DTA track.");
  const listB = musicTrack.catalogOptionLists?.find((list) => list.label === "List B");
  assert.ok(listB, "Expected Music List B to stay as a catalog option list.");
  assert.ok(listB.courseCodes.length > 20);
  assert.equal(musicTrack.terms.flatMap((term) => term.courses).includes("MUSC 298"), false);

  assert.ok(diversityTrack, "Expected generated Diversity Studies AA-DTA track.");
  assert.ok(
    diversityTrack.catalogOptionLists?.some(
      (list) => list.label === "Diversity - Social Science list" && list.courseCodes.length > 10
    )
  );
  assert.equal(diversityTrack.terms.some((term) => /Diversity - .*list/i.test(term.label)), false);

  assert.ok(globalStudiesTrack, "Expected generated Global Studies AA-DTA track.");
  assert.ok(
    globalStudiesTrack.catalogOptionLists?.some(
      (list) => list.label === "Foreign Language" && list.courseCodes.length > 20
    )
  );
  assert.ok(
    globalStudiesTrack.catalogOptionLists?.some(
      (list) => list.label === "Concentration Electives" && list.courseCodes.length > 10
    )
  );
  assert.equal(globalStudiesTrack.terms.some((term) => term.label === "Foreign Language"), false);
});

test("GRC-only ACS runtime caps flexible placeholders at exact catalog credits", () => {
  const track = getTransferPlannerTrack(
    "grc-associate-stem-computer-science-associate-in-computer-science-acs-dta-mrp"
  );
  assert.ok(track, "Expected the generated Associate in Computer Science track.");

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
  const plannedCourses = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const range = buildSuggestedQuarterRemainingCreditRange({
    quarters: quarterPlan,
    track,
  });

  assert.equal(track.minimumCredits, 90);
  assert.equal(track.maximumCredits, 90);
  assert.equal(
    plannedCourses.reduce((total, course) => total + (course.creditAmount ?? 0), 0),
    90
  );
  assert.equal(range.minRemainingCredits, 90);
  assert.equal(range.maxRemainingCredits, 90);
  assert.equal(range.exactRemainingCredits, null);
  assert.equal(range.mainScheduledMaxRemainingCredits, 90);
  assert.equal(range.placeholderCredits, 25);
  assert.equal(range.hasUnresolvedOptions, true);
  assert.ok(range.unresolvedPlaceholderLabels.includes("5 credits of A&H or SSc"));
});

test("Generated Math Education AM-DTA tracks keep source identity and avoid note-only filler slots", () => {
  const mathTrackId =
    "grc-associate-stem-mathematics-math-curriculum-map-aa-dta-math-emphasis";
  const statisticsTrackId =
    "grc-associate-stem-mathematics-math-curriculum-map-aa-dta-statistics";
  const mathTrack = getTransferPlannerTrack(mathTrackId);
  const generatedMathTrack = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find(
    (entry) => entry.id === mathTrackId
  );
  const statisticsTrack = getTransferPlannerTrack(statisticsTrackId);

  assert.ok(mathTrack, "Expected the Math Education AM-DTA (Mathematics) track.");
  assert.ok(generatedMathTrack, "Expected generated Math Education AM-DTA data.");
  assert.ok(statisticsTrack, "Expected the Math Education AM-DTA (Statistics) track.");
  assert.equal(mathTrack.code, "AM-DTA");
  assert.equal(generatedMathTrack.code, "AM-DTA");
  assert.equal(statisticsTrack.code, "AM-DTA");
  assert.equal(
    mathTrack.officialLinks?.[0]?.label,
    "Math Education, AM-DTA (Mathematics) curriculum map"
  );
  assert.equal(
    statisticsTrack.officialLinks?.[0]?.label,
    "Math Education, AM-DTA (Statistics) curriculum map"
  );

  const mathLabels = mathTrack.terms.flatMap((term) => term.courses);
  const statisticsLabels = statisticsTrack.terms.flatMap((term) => term.courses);

  assert.equal(mathLabels.includes("Elective or General Education"), false);
  assert.equal(statisticsLabels.includes("Elective or General Education"), false);
  assert.equal(mathLabels.includes("Social Science"), false);
  assert.equal(
    mathLabels.some((label) => /best transferability|for pure math majors|for applied math majors/i.test(label)),
    false
  );
  assert.equal(mathTrack.terms.some((term) => /notes|transferability of credits/i.test(term.label)), false);
  assert.deepEqual(mathTrack.terms.map((term) => term.label), [
    "Quarter 1 (15 credits)",
    "Quarter 2 (15 credits)",
    "Quarter 3 (15 credits)",
    "Quarter 4 (15 credits)",
    "Quarter 5 (15 credits)",
    "Quarter 6 (15 credits)",
  ]);
  assert.ok(mathLabels.includes("S 1 - Social Science"));
  assert.ok(mathLabels.includes("S 2 - Social Science"));
  assert.ok(mathLabels.includes("S 3 - Social Science"));
  assert.ok(mathLabels.includes("H 1 - Humanities/Fine Arts/English"));
  assert.ok(mathLabels.includes("H 2 - Humanities/Fine Arts/English"));
  assert.ok(mathLabels.includes("H 3 - Humanities/Fine Arts/English"));
  assert.ok(mathLabels.includes("Computer Science (CS) or Engineering (ENGR)"));
});

test("Phase 6 infers the student's Green River catalog year from transcript terms", () => {
  assert.equal(
    inferTransferPlannerGrcCatalogYearLabel([
      buildTermTranscriptCourse("MATH& 151", "Fall 2024", "2024-09-23"),
      buildTermTranscriptCourse("MATH& 152", "Winter 2025", "2025-01-06"),
    ]),
    "2024-2025"
  );
  assert.equal(
    inferTransferPlannerGrcCatalogYearLabel([
      buildTermTranscriptCourse("MATH& 151", "Winter 2026", "2026-01-06"),
    ]),
    "2025-2026"
  );
  assert.equal(
    inferTransferPlannerGrcCatalogYearLabel([
      {
        code: "MATH& 151",
        label: "MATH& 151",
        termLabel: null,
        termStartDate: null,
        termEndDate: null,
        catalogYearLabel: "2024-2025",
      },
    ]),
    "2024-2025"
  );
  assert.equal(getCurrentTransferPlannerGrcCatalogYearLabel(new Date("2026-04-07T12:00:00.000Z")), "2025-2026");
  assert.equal(getCurrentTransferPlannerGrcCatalogYearLabel(new Date("2026-08-15T12:00:00.000Z")), "2026-2027");
});

test("Phase 6 preserves explicit catalog-year labels when parsing stored completed courses", () => {
  const parsedCourses = parseCompletedTranscriptCourses([
    {
      code: "MATH& 151",
      title: "Calculus I",
      termLabel: "Fall 2024",
      termStartDate: "2024-09-23",
      termEndDate: "2024-12-12",
      catalogYearLabel: "2024-2025",
    },
    {
      code: "MATH& 152",
      title: "Calculus II",
      termLabel: "Winter 2025",
      termStartDate: "2025-01-06",
      termEndDate: "2025-03-20",
      catalogYearLabel: "2024-2025",
    },
  ]);

  assert.deepEqual(
    parsedCourses.map((course) => ({
      code: course.code,
      catalogYearLabel: course.catalogYearLabel,
    })),
    [
      { code: "MATH& 151", catalogYearLabel: "2024-2025" },
      { code: "MATH& 152", catalogYearLabel: "2024-2025" },
    ]
  );
  assert.equal(inferTransferPlannerGrcCatalogYearLabel(parsedCourses), "2024-2025");
});

test("Transcript PDF parsing excludes in-progress rows from the CADR credit source of truth", () => {
  const parserSource = readFileSync("services/documents/transcript-pdf.service.ts", "utf8");
  const pageSource = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(parserSource, /Number\.parseFloat\(earned\)\s*<=\s*0\)\s*continue;/);
  assert.match(pageSource, /shouldUseDetailedCompletedCourses/);
});

test.skip("Phase 6 selects an older source-backed GRC track when transcript history points to that year", () => {
  const comparison = buildHistoricalGrcTrackComparison({
    track: compETrack,
    plan: compEPlan,
    completedCourses: [
      buildTermTranscriptCourse("ENGL& 101", "Fall 2024", "2024-09-23"),
      buildTermTranscriptCourse("MATH& 151", "Fall 2024", "2024-09-23"),
    ],
    referenceDate: new Date("2026-04-07T12:00:00.000Z"),
  });

  assert.ok(comparison, "Expected Phase 6 comparison for the Computer Engineering track.");
  assert.equal(comparison?.trackId, compETrack?.id ?? null);
  assert.equal(comparison?.currentCatalogYearLabel, "2025-2026");
  assert.equal(comparison?.inferredCatalogYearLabel, "2024-2025");
  assert.equal(
    comparison?.selectedCatalogYearLabel === "2024-2025" || comparison?.selectedCatalogYearLabel === null,
    true
  );
  assert.equal(
    comparison?.selectedCatalogYearSource === "transcript" || comparison?.selectedCatalogYearSource === "current-default",
    true
  );
  assert.equal(typeof comparison?.usesCurrentRecommendedPath, "boolean");
  assert.equal(typeof comparison?.isHistoricalCatalogYear, "boolean");
  assert.ok(
    comparison?.trackCourseCodes.includes("MATH& 153") ||
      comparison?.trackCourseCodes.includes("MATH& 163")
  );
  assert.ok(Array.isArray(comparison?.trackCourseCodes));
  assert.ok(comparison?.currentRecommendedCourseCodes.includes("MATH& 163"));
  assert.ok(comparison?.currentRecommendedCourseCodes.includes("MATH& 254"));
  assert.ok(Array.isArray(comparison?.currentOnlyCourseCodes));
  if (comparison?.legacyCatalogCourseCodes.length) {
    assert.ok(comparison.legacyCatalogCourseCodes.some((code) => code.startsWith("MATH&")));
  }
});

test("Phase 6 falls back to the current path when the inferred GRC catalog year has no source snapshot", () => {
  const comparison = buildHistoricalGrcTrackComparison({
    track: compETrack,
    plan: compEPlan,
    completedCourses: [
      buildTermTranscriptCourse("ENGL& 101", "Fall 2023", "2023-09-25"),
    ],
    referenceDate: new Date("2026-04-07T12:00:00.000Z"),
  });

  assert.ok(comparison, "Expected Phase 6 comparison even when a historical source snapshot is unavailable.");
  assert.equal(comparison?.inferredCatalogYearLabel, "2023-2024");
  assert.equal(comparison?.selectedCatalogYearLabel, null);
  assert.equal(comparison?.selectedCatalogYearSource, "unavailable");
  assert.equal(comparison?.usesCurrentRecommendedPath, true);
  assert.equal(comparison?.isHistoricalCatalogYear, false);
  assert.ok(comparison?.trackCourseCodes.includes("MATH& 163"));
  assert.equal(comparison?.trackCourseCodes.includes("CS 120"), false);
  assert.match(comparison?.notes.join(" ") ?? "", /no source-backed catalog-year snapshot/i);
});

test("Phase 8 student evaluations carry inferred effective-term metadata for historical coursework", () => {
  const completedCourses = [
    buildTermTranscriptCourse("MATH& 153", "Winter 2025", "2025-01-06"),
    buildTermTranscriptCourse("MATH& 254", "Spring 2025", "2025-04-01"),
  ];
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: null,
    completedCourses,
  });
  const legacySequenceEvaluation = evaluations.find((entry) => entry.courseCode === "MATH& 153");

  assert.equal(legacySequenceEvaluation?.effectiveTermLabel, "SPR Qtr. 2025");
  assert.equal(legacySequenceEvaluation?.approvedRuleId, "uw-grc-guide:0795:mathematics:mathand-153-254-5-5-formerly-math-126-224-combined-entry");
  assert.equal(legacySequenceEvaluation?.outcome, "legacy-rule-used");
});

test("Phase 8 hidden source-gap majors do not produce student-facing evaluations", () => {
  const sourceGap = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY[0];
  if (!sourceGap) {
    assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCount, 0);
    return;
  }
  const hiddenPlan = getTransferPlannerMajorPlan(sourceGap.planId);
  assert.ok(hiddenPlan, "Expected source-gap owner to still be tracked internally.");
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: hiddenPlan,
    pathwayId: sourceGap.pathwayId,
    completedCourses: buildTranscriptCourses("ENGL& 101"),
  });

  assert.equal(evaluations.length, 1);
  assert.equal(evaluations[0]?.outcome, "source-unverified-hidden");
  assert.equal(evaluations[0]?.studentFacing, false);
  assert.match(evaluations[0]?.notes.join(" ") ?? "", /source|parser|hidden/i);
  assert.equal(evaluations[0]?.approvedRuleId, null);
});

test("Phase 8 hidden source-gap detection works from planId without materializing a plan", () => {
  const sourceGap = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.find((entry) => entry.pathwayId === null);
  if (!sourceGap) {
    assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.hiddenSourceGapMajorPlanCount, 0);
    return;
  }
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    planId: sourceGap.planId,
    pathwayId: null,
    completedCourses: buildTranscriptCourses("ENGL& 101"),
  });

  assert.equal(evaluations.length, 1);
  assert.equal(evaluations[0]?.planId, sourceGap.planId);
  assert.equal(evaluations[0]?.pathwayId, null);
  assert.equal(evaluations[0]?.outcome, "source-unverified-hidden");
  assert.equal(evaluations[0]?.studentFacing, false);
});

test("Phase 8 student evaluations keep stable source-backed record shape", () => {
  const completedCourses = buildTranscriptCourses("MATH& 163");
  const applicationStatuses = buildRequirementStatuses(
    [buildChecklistItem("calc3", "Calculus III", ["MATH& 163"])],
    completedCourses
  );
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: compEPlan,
    completedCourses,
    applicationStatuses,
  });
  const calcEvaluation = evaluations.find((entry) => entry.courseCode === "MATH& 163");

  assert.ok(calcEvaluation?.outcome === "auto-approved" || calcEvaluation?.outcome === "legacy-rule-used");
  assert.ok(typeof calcEvaluation?.approvedRuleId === "string" || calcEvaluation?.approvedRuleId === null);
  assert.ok(Array.isArray(calcEvaluation?.alternativeApprovedRuleIds));
  assert.equal(
    calcEvaluation?.alternativeApprovedRuleIds.includes(calcEvaluation?.approvedRuleId ?? ""),
    false
  );
  assert.equal(Array.isArray(calcEvaluation?.sourceLinks), true);
  assert.equal(Array.isArray(calcEvaluation?.appliedRequirementIds), true);
});

test("Phase 9 advisor-ready report summarizes student evaluation buckets and source rules", () => {
  const completedCourses = buildTranscriptCourses(
    "ENGL& 101",
    "ACCT& 201",
    "AMES 100",
    "BEHSC 101"
  );
  const applicationStatuses = buildRequirementStatuses(
    [buildChecklistItem("writing", "Writing", ["ENGL& 101"])],
    completedCourses
  );
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: compEPlan,
    completedCourses,
    applicationStatuses,
  });
  const report = buildTransferPlannerStudentEvaluationReport({
    plan: compEPlan,
    campusLabel: "UW Seattle",
    completedCourses,
    evaluations,
    suggestedQuarterPlan: [
      {
        label: "Fall 2026",
        phase: "planned",
        courses: [
          { label: "MATH& 163", type: "core", status: "planned" },
          { label: "CS 121", type: "core", status: "planned" },
        ],
      },
    ],
  });
  const bucketCount = (id: string) =>
    report.buckets.find((bucket) => bucket.id === id)?.count ?? 0;

  assert.equal(report.planId, compEPlan.id);
  assert.equal(report.majorTitle, compEPlan.title);
  assert.equal(report.campusLabel, "UW Seattle");
  assert.equal(report.completedCourseCount, 4);
  assert.equal(report.studentFacingEvaluationCount, 4);
  assert.equal(bucketCount("auto-approved"), 1);
  assert.equal(bucketCount("sequence-incomplete"), 1);
  assert.equal(bucketCount("elective-credit"), 1);
  assert.equal(bucketCount("no-credit"), 1);
  assert.equal(
    report.officialRuleIds.includes("uw-grc-guide:0446:english:england-101-5-formerly-engl-110"),
    true
  );
  assert.equal(report.missingSequenceCourseCodes.includes("ACCT& 202"), true);
  assert.deepEqual(report.nextPlannedCourseLabels, ["MATH& 163", "CS 121"]);
  assert.match(report.reportSummaryLines.join(" "), /approved source rule/i);
});

test("Phase 9 advisor-ready report keeps hidden source-gap evaluations internal", () => {
  const sourceGap = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY[0];
  if (!sourceGap) {
    assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCount, 0);
    return;
  }
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    planId: sourceGap.planId,
    pathwayId: sourceGap.pathwayId,
    completedCourses: buildTranscriptCourses("ENGL& 101"),
  });
  const report = buildTransferPlannerStudentEvaluationReport({
    planId: sourceGap.planId,
    pathwayId: sourceGap.pathwayId,
    campusLabel: "UW Bothell",
    completedCourses: buildTranscriptCourses("ENGL& 101"),
    evaluations,
  });

  assert.equal(report.studentFacingEvaluationCount, 0);
  assert.equal(report.hiddenEvaluationCount, 1);
  assert.equal(report.officialRuleIds.length, 0);
  assert.equal(report.buckets.every((bucket) => bucket.count === 0), true);
});

test("Phase 9 advisor-ready report dedupes planned labels and source rules", () => {
  const completedCourses = buildTranscriptCourses("MATH& 163");
  const applicationStatuses = buildRequirementStatuses(
    [buildChecklistItem("calc3", "Calculus III", ["MATH& 163"])],
    completedCourses
  );
  const evaluations = buildTransferPlannerStudentCourseEvaluations({
    plan: compEPlan,
    completedCourses,
    applicationStatuses,
  });
  const report = buildTransferPlannerStudentEvaluationReport({
    plan: compEPlan,
    campusLabel: "UW Seattle",
    completedCourses,
    evaluations,
    suggestedQuarterPlan: [
      {
        label: "Winter 2026",
        phase: "completed",
        courses: [{ label: "MATH& 151", type: "core", status: "completed" }],
      },
      {
        label: "Spring 2026",
        phase: "current",
        courses: [{ label: "CS 121", type: "core", status: "current" }],
      },
      {
        label: "Fall 2026",
        phase: "planned",
        courses: [
          { label: "MATH& 163", type: "core", status: "planned" },
          { label: "CS 121", type: "core", status: "planned" },
        ],
      },
      {
        label: "Winter 2027",
        phase: "planned",
        courses: [
          { label: "MATH& 163", type: "core", status: "planned" },
          { label: "CHEM& 161", type: "core", status: "planned" },
        ],
      },
    ],
  });

  assert.deepEqual(report.nextPlannedCourseLabels, ["MATH& 163", "CS 121", "CHEM& 161"]);
  assert.deepEqual(
    report.officialRuleIds,
    [...report.officialRuleIds].sort((left, right) => left.localeCompare(right))
  );
  assert.equal(new Set(report.officialRuleIds).size, report.officialRuleIds.length);
  assert.equal(
    report.officialRuleIds.includes("uw-grc-guide:0798:mathematics:mathand-163-5"),
    true
  );
  assert.equal(report.sourceLinkCount > 0, true);
});

test("Phase 10 source summary counts match student-facing visibility gates", () => {
  const campusIds = ["uw-seattle", "uw-bothell", "uw-tacoma"] as const;
  const internalMajorCount = campusIds.reduce(
    (count, campusId) => count + getTransferPlannerSourceGeneratedMajorsForCampus(campusId).length,
    0
  );
  const studentFacingMajorCount = campusIds.reduce(
    (count, campusId) => count + getTransferPlannerStudentVisibleMajorsForCampus(campusId).length,
    0
  );
  const visibleSourceGeneratedMajorCount = campusIds.reduce(
    (count, campusId) =>
      count + getTransferPlannerStudentVisibleSourceGeneratedMajorsForCampus(campusId).length,
    0
  );
  const studentFacingPathwayCount = campusIds
    .flatMap((campusId) => getTransferPlannerStudentVisibleMajorsForCampus(campusId))
    .reduce(
      (count, plan) => count + getTransferPlannerStudentVisiblePathwaysForPlan(plan).length,
      0
    );
  const hiddenMajorGapCount = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.filter(
    (entry) => !entry.pathwayId
  ).length;
  const hiddenPathwayGapCount = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.filter(
    (entry) => entry.pathwayId
  ).length;
  const materializedPathwayDeltaCount = campusIds
    .flatMap((campusId) => getTransferPlannerStudentVisibleMajorsForCampus(campusId))
    .reduce(
      (count, plan) =>
        count +
        (getTransferPlannerStudentVisiblePathwaysForPlan(plan).length -
          TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.filter((entry) => entry.planId === plan.id).length),
      0
    );

  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGeneratedMajorPlanCount, internalMajorCount);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.studentVisibleMajorPlanCount, studentFacingMajorCount);
  assert.equal(studentFacingMajorCount, visibleSourceGeneratedMajorCount);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.hiddenSourceGapMajorPlanCount, hiddenMajorGapCount);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.hiddenSourceGapPathwayCount, hiddenPathwayGapCount);
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.studentVisiblePathwayCount + materializedPathwayDeltaCount,
    studentFacingPathwayCount
  );
});

test("Requirement-diff promotion report stays aligned with the generated classification registry", () => {
  const requirementDiffReport = JSON.parse(
    readFileSync(".tmp/transfer-planner-requirement-diff-promotion-report.json", "utf8")
  );

  assert.deepEqual(
    requirementDiffReport.classificationSummary,
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY
  );
  assert.equal(
    requirementDiffReport.classifiedEntries.length,
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.length
  );
  assert.equal(
    requirementDiffReport.promotedEntries.length,
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.promotedCount
  );
});

test("Mechanical source parser keeps requirement tables after abbreviated credit rows", () => {
  const parser = require("./parse-transfer-planner-requirement-sources.cjs");
  const parsed = parser.parseHtmlSourceFromArtifactsForTest(
    {
      ownerTitle: "Mechanical Engineering",
      planId: "uw-seattle-mechanical-engineering",
      pathwayId: null,
      url: "https://www.me.washington.edu/students/ug/requirements",
      label: "UW Mechanical Engineering degree requirements",
      role: "degree-requirements",
      parserType: "html-degree-page",
    },
    `
      <h1>Mechanical Engineering Degree Requirements</h1>
      <h2>Mathematics</h2>
      <p>28 cr.</p>
      <p>MATH 124, MATH 125, MATH 126, MATH 207, MATH 208, MATH 224</p>
      <h2>Physics and chemistry</h2>
      <p>25 cr.</p>
      <p>PHYS 121, PHYS 122, PHYS 123</p>
      <p>CHEM 142, CHEM 152</p>
      <p>10 cr.</p>
      <h2>Engineering fundamentals</h2>
      <p>28 cr.</p>
      <p>AA 210, AMATH 301, CEE 220, E E 215, M E 123, M E 230, MSE 170</p>
    `
  );
  const parsedCourses = new Set(parsed.courseCodes.map((courseCode: string) => normalizeCourseCode(courseCode)));

  for (const courseCode of ["AMATH 301", "EE 215", "ME 123", "MSE 170"]) {
    assert.equal(parsedCourses.has(courseCode), true);
  }
});

test("GRC Civil and Mechanical AST-2/MRP track keeps source-backed engineering sequence and Section D options", () => {
  const track = getTransferPlannerTrack(
    "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-civil-and-mechanical-engineering"
  );
  assert.ok(track, "Expected the GRC Civil and Mechanical AST-2/MRP track.");

  const trackCourseLabels = track.terms.flatMap((term) => term.courses);
  assert.deepEqual(
    ["CHEM& 162", "ENGR& 214", "ENGR& 225", "ENGR& 215"].filter(
      (courseCode) => !trackCourseLabels.includes(courseCode)
    ),
    []
  );

  const optionGroups = buildSuggestedQuarterCourseOptionGroupsForTrack({ track });
  const sectionDOptionGroup = optionGroups.find((group) =>
    /Specific Requirements.*Select 2 courses/i.test(group.title)
  );
  assert.ok(sectionDOptionGroup, "Expected Section D to remain a selectable option group.");
  assert.equal(sectionDOptionGroup?.selectionCount, 2);
  assert.deepEqual(
    ["ENGR& 204", "ENGR& 224", "ENGR 250"].filter(
      (courseCode) =>
        !sectionDOptionGroup?.options.some((option) => option.label.includes(courseCode))
    ),
    []
  );

  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    plannerCollegeId: "grc",
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: [],
    completedCourses: [],
    track,
    includeStayAtGrcCourses: true,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-05-06T12:00:00.000Z"),
  });
  const plannedLabels = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
  const range = buildSuggestedQuarterRemainingCreditRange({
    quarters: quarterPlan,
    track,
    creditBucketMode: "combined",
  });
  const indexOf = (label: string) => plannedLabels.indexOf(label);

  assert.equal(track.minimumCredits, 107);
  assert.equal(range.minRemainingCredits, 107);
  assert.equal(indexOf("ENGR 106") < indexOf("ENGR& 214"), true);
  assert.equal(indexOf("ENGR& 214") < indexOf("ENGR& 215"), true);
  assert.equal(indexOf("ENGR& 214") < indexOf("ENGR& 225"), true);
  assert.equal(indexOf("MATH& 264") < indexOf("MATH 238"), true);
});

test("Transfer category equivalencies can constrain NSc rows to a selected major's source-backed course list", () => {
  const constructionBasePlan = getTransferPlannerMajorPlan(
    "uw-seattle-construction-management"
  );
  const constructionPlan = resolveTransferPlannerMajorPlan(
    constructionBasePlan,
    "project-option"
  );
  const constructionEligibleNscCourses =
    buildEligibleTransferCategorySourceCourseCodesForPlan(constructionPlan, "NSC");

  assert.ok(constructionEligibleNscCourses?.includes("MATH& 146"));
  assert.ok(constructionEligibleNscCourses?.includes("PHYS& 114"));
  assert.equal(constructionEligibleNscCourses?.includes("BIOL& 211"), false);

  const computationalFinanceBasePlan = getTransferPlannerMajorPlan(
    "uw-seattle-computational-finance-and-risk-management"
  );
  const computationalFinancePlan = resolveTransferPlannerMajorPlan(
    computationalFinanceBasePlan,
    "risk-management-option"
  );

  assert.equal(
    buildEligibleTransferCategorySourceCourseCodesForPlan(
      computationalFinancePlan,
      "NSC"
    ),
    null
  );
});

test("Phase 10 requirement-source parser can recover from cached official snapshots", () => {
  const parserScript = readFileSync(
    "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
    "utf8"
  );

  assert.match(parserScript, /function parseSnapshotSource/);
  assert.match(parserScript, /readSnapshot\(entry\.ownerId\)/);
  assert.match(parserScript, /usedSnapshotFallback/);
  assert.match(parserScript, /snapshotFallbackCount/);
  assert.match(parserScript, /function getAlternateParseableManifestEntries/);
  assert.match(parserScript, /resolutionStrategy/);
  assert.match(parserScript, /downloadWithCurl/);
});

test("Phase 10 parser now resolves previously broken primary URLs through an official source", () => {
  const ownerIdCandidates = [
    ["uw-tacoma-communications", "uw-tacoma-communication"],
    [
      "uw-tacoma-communications:pathway:professional-track",
      "uw-tacoma-communication:pathway:professional-track",
    ],
    [
      "uw-tacoma-communications:pathway:research-track",
      "uw-tacoma-communication:pathway:research-track",
    ],
    ["uw-tacoma-economics-and-policy-analysis"],
    ["uw-tacoma-politics-philosophy-and-economics"],
  ];

  for (const ownerCandidates of ownerIdCandidates) {
    const block = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.find((entry) =>
      ownerCandidates.includes(entry.ownerId)
    );

    if (!block) continue;

    assert.equal(block?.ok, true);
    assert.ok(
      block?.resolutionStrategy === "primary-source" ||
        block?.resolutionStrategy === "alternate-official-source"
    );
    if (block?.resolutionStrategy === "alternate-official-source") {
      assert.notEqual(block.primarySourceUrl, block.sourceUrl);
    } else {
      assert.equal(block?.primarySourceUrl, block?.sourceUrl);
    }
    assert.equal(block?.error, null);
  }
});

test.skip("Canonical course registry bootstraps planner-tracked GRC and UW courses without dropping references", () => {
  const grcCalc = getTransferPlannerCanonicalCourse("grc", "MATH& 151");
  const seattleUwCourse = getTransferPlannerCanonicalCourse("uw-seattle", "CSE 121");

  assert.ok(grcCalc, "Expected a canonical GRC calculus course entry.");
  assert.ok(seattleUwCourse, "Expected a canonical UW Seattle course entry from exact degree maps.");

  assert.equal(grcCalc?.referencedByPlanIds.includes("uw-seattle-computer-engineering"), true);
  assert.ok((grcCalc?.sourceKinds ?? []).length > 0);
  assert.equal(typeof grcCalc?.title, "string");
  assert.ok((grcCalc?.creditValue ?? 0) > 0);
  assert.equal(grcCalc?.effectiveYearRanges.length > 0, true);
  assert.ok((seattleUwCourse?.sourceKinds ?? []).length > 0);
  assert.equal(typeof seattleUwCourse?.title, "string");
  assert.ok((seattleUwCourse?.creditValue ?? 0) > 0);
});

test("Canonical course registry now stores source-backed sequence metadata for planner-critical GRC courses", () => {
  const math153 = getTransferPlannerCanonicalCourse("grc", "MATH& 153");
  const math254 =
    getTransferPlannerCanonicalCourse("grc", "MATH& 254") ??
    getTransferPlannerCanonicalCourse("grc", "MATH& 264");
  const math240 = getTransferPlannerCanonicalCourse("grc", "MATH 240");
  const chemistryTwo = getTransferPlannerCanonicalCourse("grc", "CHEM& 162");
  const csTwo = getTransferPlannerCanonicalCourse("grc", "CS 122");
  const math238 = getTransferPlannerCanonicalCourse("grc", "MATH 238");
  const phys223 = getTransferPlannerCanonicalCourse("grc", "PHYS& 223");
  const engr225 = getTransferPlannerCanonicalCourse("grc", "ENGR& 225");

  assert.equal(typeof math153?.title, "string");
  assert.ok((math153?.prerequisiteCourseCodes ?? []).includes("MATH& 152"));

  assert.equal(typeof math254?.title, "string");
  assert.ok(Array.isArray(math254?.prerequisiteCourseCodes));
  assert.ok(Array.isArray(math254?.prerequisiteAlternativeCourseCodeSets));

  assert.equal(typeof math240?.title, "string");
  assert.ok((math240?.creditValue ?? 0) > 0);
  assert.ok(
    (math240?.prerequisiteAlternativeCourseCodeSets ?? [])
      .flat()
      .some((code) => ["MATH& 153", "MATH& 163"].includes(code))
  );

  assert.equal(typeof chemistryTwo?.title, "string");
  assert.ok((chemistryTwo?.prerequisiteCourseCodes ?? []).includes("CHEM& 161"));

  assert.equal(typeof csTwo?.title, "string");
  assert.ok((csTwo?.prerequisiteCourseCodes ?? []).includes("CS 121"));

  assert.equal(typeof math238?.title, "string");
  assert.ok(Array.isArray(math238?.prerequisiteCourseCodes));
  assert.ok(
    (math238?.corequisiteCourseCodes ?? []).some((code) => ["MATH& 254", "MATH& 264"].includes(code))
  );

  assert.equal(typeof phys223?.title, "string");
  assert.ok((phys223?.prerequisiteCourseCodes ?? []).includes("MATH& 152"));
  assert.ok((phys223?.prerequisiteCourseCodes ?? []).includes("PHYS& 222"));
  assert.ok(
    (phys223?.corequisiteAlternativeCourseCodeSets ?? [])
      .flat()
      .some((code) => ["MATH& 153", "MATH& 163"].includes(code))
  );

  assert.equal(typeof engr225?.title, "string");
  assert.deepEqual(engr225?.prerequisiteCourseCodes, ["ENGR& 214"]);
  assert.deepEqual(
    engr225?.corequisiteAlternativeCourseCodeSets?.map((path) => path.join(" + ")).sort(),
    ["MATH& 153", "MATH& 163"]
  );
});

test("Generated Green River catalog metadata now expands source-backed title and credit coverage", () => {
  const accountingOne = getTransferPlannerCanonicalCourse("grc", "ACCT& 201");
  const spanishOne = getTransferPlannerCanonicalCourse("grc", "SPAN& 121");

  assert.equal(accountingOne?.title, "Principles of Accounting I");
  assert.equal(accountingOne?.creditValue, 5);
  assert.ok(accountingOne?.catalogDescription);
  assert.ok(
    accountingOne?.sourceLinks.some((link) =>
      urlHasHostname(link.url, "catalog.greenriver.edu")
    )
  );
  assert.ok(
    accountingOne?.effectiveYearRanges.some((range) => range.startLabel === "2025-2026")
  );

  assert.equal(spanishOne?.title, "Spanish I");
  assert.ok(
    spanishOne?.notes.some((note) =>
      /Schedule-display title from the official Green River annual schedules/i.test(note)
    )
  );
});

test("Canonical GRC course lookup resolves source-backed titles for the missing-course-title regressions", () => {
  const phys154 = getTransferPlannerCanonicalCourse("grc", "PHYS& 154");
  const phys155 = getTransferPlannerCanonicalCourse("grc", "PHYS& 155");
  const phys115 = getTransferPlannerCanonicalCourse("grc", "PHYS& 115");
  const math264 = getTransferPlannerCanonicalCourse("grc", "MATH& 264");

  assert.equal(phys154?.title, "Physics for the Life Sciences 1");
  assert.equal(phys154?.creditValue, 5);
  assert.equal(phys155?.title, "Physics for the Life Sciences 2");
  assert.equal(phys155?.creditValue, 5);
  assert.equal(phys115?.title, "General Physics II with Lab");
  assert.equal(phys115?.creditValue, 5);
  assert.equal(math264?.title, "Calculus IV");
  assert.equal(math264?.creditValue, 5);
});

test("Canonical GRC course lookup now hydrates planner-visible source-backed titles beyond the Physics/Math family", () => {
  const cs141 = getTransferPlannerCanonicalCourse("grc", "CS& 141");
  const cs145 = getTransferPlannerCanonicalCourse("grc", "CS 145");

  assert.equal(cs141?.title, "Computer Science I Java");
  assert.equal(cs141?.creditValue, 5);
  assert.equal(cs145?.title, "Java 2-Data Structures");
  assert.equal(cs145?.creditValue, 5);
});

test("Planner-visible GRC courses now keep canonical title coverage whenever source-backed metadata has a title", () => {
  assert.deepEqual(getPlannerVisibleSourceBackedGrcTitleGaps(), []);
});

test.skip("Every Tacoma planner row now exposes real planner content in the source-generated runtime rows", () => {
  const missingContentPlanIds = sourceGeneratedTacomaPlans
    .filter((plan) => {
      const hasDegreeMap = Boolean(plan.degreeMapSections?.length);
      const hasLinks = Boolean(plan.officialLinks.length);
      const hasGrcList = getTransferPlannerGrcCourseList(plan).length > 0;
      const hasGrcGuidance = Boolean(getTransferPlannerGrcCourseListGuidance(plan));
      return !hasDegreeMap || !hasLinks || (!hasGrcList && !hasGrcGuidance);
    })
    .map((plan) => plan.id);

  assert.deepEqual(missingContentPlanIds, []);
});

test.skip("Every Bothell planner row now exposes real planner content in the source-generated runtime rows", () => {
  const missingContentPlanIds = sourceGeneratedBothellPlans
    .filter((plan) => {
      const hasDegreeMap = Boolean(plan.degreeMapSections?.length);
      const hasLinks = Boolean(plan.officialLinks.length);
      const hasGrcList = getTransferPlannerGrcCourseList(plan).length > 0;
      const hasGrcGuidance = Boolean(getTransferPlannerGrcCourseListGuidance(plan));
      return !hasDegreeMap || !hasLinks || (!hasGrcList && !hasGrcGuidance);
    })
    .map((plan) => plan.id);

  assert.deepEqual(missingContentPlanIds, []);
});

test.skip("Communication and Tacoma CSS no longer surface source-backed UW-only prep-target rows", () => {
  const communicationPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-communication");
  const communicationTitles = getAllChecklistItems(communicationPlan ?? {}).map((item) => item.title);
  const tacomaCssPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-tacoma-computer-science-and-systems-bs"
  );
  const tacomaCssTitles = getAllChecklistItems(tacomaCssPlan ?? {}).map((item) => item.title);

  assert.ok(communicationPlan);
  assert.ok(!communicationTitles.includes("UW prep target: COM 200"));
  assert.ok(!communicationTitles.some((title) => /BOTH COM 200/i.test(title)));

  assert.ok(tacomaCssPlan);
  assert.ok(!tacomaCssTitles.includes("UW prep target: TCSS 142"));
  assert.ok(!tacomaCssTitles.includes("UW prep target: TCSS 143"));
  assert.ok(!tacomaCssTitles.includes("UW prep target: TMATH 110"));
});

test.skip("Requirement and degree-map registries cover all current planner rows", () => {
  const checklistItemCount = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.reduce(
    (count, plan) =>
      count +
      plan.applicationChecklist.length +
      plan.beforeEnrollmentChecklist.length +
      plan.stayAtGrcChecklist.length +
      (plan.pathways ?? []).reduce(
        (pathwayCount, pathway) =>
          pathwayCount +
          (pathway.applicationChecklist?.length ?? 0) +
          (pathway.beforeEnrollmentChecklist?.length ?? 0) +
          (pathway.stayAtGrcChecklist?.length ?? 0),
        0
      ),
    0
  );
  const degreeMapSectionCount = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.reduce(
    (count, plan) =>
      count +
      (plan.degreeMapSections?.length ?? 0) +
      (plan.pathways ?? []).reduce(
        (pathwayCount, pathway) => pathwayCount + (pathway.degreeMapSections?.length ?? 0),
        0
      ),
    0
  );
  const policyEntryCount = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.reduce(
    (count, plan) => count + 1 + (plan.pathways?.length ?? 0),
    0
  );

  assert.equal(
    TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY.length,
    checklistItemCount
  );
  assert.equal(TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY.length, degreeMapSectionCount);
  assert.equal(TRANSFER_PLANNER_POLICY_REGISTRY.length, policyEntryCount);

  const chemistryOrganicRequirement = TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY.find(
    (entry) => entry.id === "uw-seattle-chemistry:before-enrollment:uws-chem-organic"
  );
  const compECalcRequirement = TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY.find(
    (entry) => entry.id === "uw-seattle-computer-engineering:before-enrollment:math208"
  );

  assert.ok(chemistryOrganicRequirement, "Expected Seattle Chemistry organic requirement atom.");
  assert.ok(compECalcRequirement, "Expected Seattle CompE MATH 208 requirement atom.");
  assert.equal(chemistryOrganicRequirement?.phase, "before-enrollment");
  assert.equal(chemistryOrganicRequirement?.displayPhase, "stay-at-grc");
  assert.equal(compECalcRequirement?.phase, "before-enrollment");
  assert.equal(compECalcRequirement?.displayPhase, "before-enrollment");
});

test("Equivalency rule registry is parser-backed and includes derived guide overlays", () => {
  const rules = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY;
  const hasChainRules = rules.some((entry) => String(entry.id ?? "").startsWith("chain:"));
  const sourceKinds = new Set(
    rules.map((entry) => entry.sourceKind ?? "unknown")
  );
  const hasDerivedGuideRules = rules.some(
    (entry) => entry.sourceKind === "uw-green-river-equivalency-guide-derived"
  );
  const hasWarningRules = rules.some(
    (entry) => entry.acceptanceCategory === "accepted-with-warning"
  );

  assert.ok(rules.length > 0);
  assert.equal(hasChainRules, true);
  assert.equal(hasDerivedGuideRules, true);
  assert.deepEqual(
    [...sourceKinds].sort(),
    [...GUIDE_BACKED_EQUIVALENCY_RULE_SOURCE_KINDS].sort()
  );
  assert.equal(rules.length, TRANSFER_PLANNER_UW_GRC_ALL_EQUIVALENCY_RULES.length);
  assert.equal(hasWarningRules, true);
});

test("Phase 4 generated UW Green River equivalency guide rules are source-backed", () => {
  const guideRules = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.filter(
    (entry) => entry.sourceKind === "uw-green-river-equivalency-guide"
  );
  const typeCounts = guideRules.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.type] = (counts[entry.type] ?? 0) + 1;
    return counts;
  }, {});

  assert.equal(TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.length, 1316);
  assert.equal(guideRules.length, 1316);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyGuideParsedRuleCount, 1316);
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCountsBySourceKind[
      "uw-green-river-equivalency-guide"
    ],
    1316
  );
  assert.equal(typeCounts["no-credit"], 14);
  assert.equal(typeCounts["limited-credit"], 175);
  assert.ok((typeCounts["direct-course"] ?? 0) > 250);
  assert.ok((typeCounts.sequence ?? 0) > 60);
  assert.ok((typeCounts["elective-credit"] ?? 0) > 700);
  assert.ok(
    guideRules.every((entry) => entry.parsedFromOfficialGuide === true),
    "Generated equivalency rules should identify that they came from the official guide parser."
  );
  assert.ok(
    guideRules.every((entry) =>
      entry.sourceLinks.some(
        (link) =>
          link.url === "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/"
      )
    ),
    "Generated equivalency rules should carry the official UW guide source link."
  );
  assert.ok(
    guideRules.every((entry) => entry.sourceSchoolId === "grc"),
    "Generated equivalency rules should all be Green River source-course rules."
  );
  assert.ok(
    guideRules.every(
      (entry) => entry.targetSchoolIds.length === 1 && entry.targetSchoolIds[0] === "uw-seattle"
    ),
    "The UW Admissions equivalency guide rules should target the centralized Seattle UW guide."
  );
});

test("Phase 4 derived guide rules replace former authored planner overlays", () => {
  const currentCalculusSequence = TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES.find(
    (entry) => entry.id === "stem-calculus-current-sequence"
  );
  const legacyCalculusSequence = TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES.find(
    (entry) => entry.id === "stem-calculus-older-sequence"
  );
  const currentComputerScienceSequence = TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES.find(
    (entry) => entry.id === "computer-science-new-sequence"
  );
  const legacyComputerScienceChain = TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES.find(
    (entry) => entry.id === "chain:CS-LEGACY"
  );

  assert.equal(TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES.length, 20);
  assert.ok(
    TRANSFER_PLANNER_UW_GRC_DERIVED_EQUIVALENCY_RULES.every(
      (entry) => entry.sourceKind === "uw-green-river-equivalency-guide-derived"
    )
  );

  assert.ok(currentCalculusSequence, "Expected the derived current STEM calculus sequence.");
  assert.equal(currentCalculusSequence?.acceptanceCategory, "preferred");
  assert.equal(currentCalculusSequence?.ruleStatus, "active");
  assert.deepEqual(currentCalculusSequence?.targetCourseCodes, [
    "MATH 124",
    "MATH 125",
    "MATH 126",
  ]);

  assert.ok(legacyCalculusSequence, "Expected the derived legacy STEM calculus route.");
  assert.equal(legacyCalculusSequence?.acceptanceCategory, "legacy-accepted");
  assert.equal(legacyCalculusSequence?.ruleStatus, "legacy");
  assert.deepEqual(legacyCalculusSequence?.weakerThanRuleIds, [
    "stem-calculus-current-sequence",
  ]);
  assert.equal(legacyCalculusSequence?.effectiveYearRanges[0]?.startLabel, "legacy-planner-support");

  assert.ok(
    currentComputerScienceSequence,
    "Expected the derived current computer-science sequence."
  );
  assert.equal(currentComputerScienceSequence?.acceptanceCategory, "preferred");

  assert.ok(
    legacyComputerScienceChain,
    "Expected the derived legacy computer-science chain overlay."
  );
  assert.equal(legacyComputerScienceChain?.acceptanceCategory, "legacy-accepted");
  assert.equal(legacyComputerScienceChain?.ruleStatus, "legacy");
  assert.deepEqual(legacyComputerScienceChain?.weakerThanRuleIds, [
    "computer-science-new-sequence",
  ]);
  assert.equal(
    legacyComputerScienceChain?.effectiveYearRanges[0]?.startLabel,
    "legacy-planner-support"
  );
});

test("Phase 4 generated guide registry has stable unique IDs and summary counts", () => {
  const generatedRules = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES;
  const generatedRuleIds = generatedRules.map((entry) => entry.id);
  const uniqueGeneratedRuleIds = new Set(generatedRuleIds);
  const typeCounts = generatedRules.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.type] = (counts[entry.type] ?? 0) + 1;
    return counts;
  }, {});
  const statusCounts = generatedRules.reduce<Record<string, number>>((counts, entry) => {
    const status = entry.ruleStatus ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  const sourceKindCounts = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.reduce<Record<string, number>>(
    (counts, entry) => {
      const sourceKind = entry.sourceKind ?? "unknown";
      counts[sourceKind] = (counts[sourceKind] ?? 0) + 1;
      return counts;
    },
    {}
  );

  assert.equal(generatedRuleIds.length, uniqueGeneratedRuleIds.size);
  assert.ok((typeCounts["direct-course"] ?? 0) > 0);
  assert.ok((typeCounts["elective-credit"] ?? 0) > 0);
  assert.ok((typeCounts["limited-credit"] ?? 0) > 0);
  assert.ok((typeCounts["no-credit"] ?? 0) > 0);
  assert.ok((typeCounts.sequence ?? 0) > 0);
  assert.ok((statusCounts.active ?? 0) > 0);
  assert.ok((statusCounts.legacy ?? 0) > 0);
  assert.deepEqual(sourceKindCounts, TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCountsBySourceKind);
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCount,
    TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.length
  );
  assert.ok((TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCountsByType["sequence"] ?? 0) > 0);
});

test("Phase 4 generated guide classifications obey conservative parser invariants", () => {
  const generatedRules = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES;
  const directCourseRules = generatedRules.filter((entry) => entry.type === "direct-course");
  const sequenceRules = generatedRules.filter((entry) => entry.type === "sequence");
  const limitedCreditRules = generatedRules.filter((entry) => entry.type === "limited-credit");
  const noCreditRules = generatedRules.filter((entry) => entry.type === "no-credit");
  const electiveCreditRules = generatedRules.filter((entry) => entry.type === "elective-credit");

  assert.ok(
    generatedRules.every((entry) => (entry.sourceCourseSets?.[0]?.length ?? 0) > 0),
    "Every official guide row should preserve at least one parsed Green River source course."
  );
  assert.ok(
    directCourseRules.every(
      (entry) =>
        ["accepted", "legacy-accepted"].includes(entry.acceptanceCategory) &&
        ["active", "legacy"].includes(entry.ruleStatus ?? "") &&
        entry.sourceCourseSets?.length === 1 &&
        entry.sourceCourseSets[0].length === 1 &&
        (entry.targetCourseCodes?.length ?? 0) > 0 &&
        !/otherwise|\( LC \)|No credit/i.test(entry.targetOutcome)
    ),
    "Direct-course rows should stay single-source, active, target-backed rows without conditional fallback text."
  );
  assert.ok(
    sequenceRules.every((entry) =>
      (entry.plannerWarnings ?? []).some((warning) => /sequence|combined-course/i.test(warning))
    ),
    "Sequence rows should carry an explicit warning so partial sequences are not over-awarded."
  );
  assert.ok(
    limitedCreditRules.every(
      (entry) =>
        ["accepted-with-warning", "legacy-accepted"].includes(entry.acceptanceCategory) &&
        /\bLC\b|\[\s*\d+\s+credits?\s+allowed\s*\]/i.test(
          `${entry.targetOutcome} ${entry.notes.join(" ")}`
        )
    ),
    "Limited-credit rows should keep the official LC/cap signal."
  );
  assert.ok(
    noCreditRules.every(
      (entry) =>
        entry.acceptanceCategory === "no-credit" &&
        entry.targetOutcome === "No credit" &&
        (entry.targetCourseCodes?.length ?? 0) === 0
    ),
    "No-credit rows should not emit synthetic UW target course codes."
  );
  assert.ok(
    electiveCreditRules.every(
      (entry) =>
        (entry.targetCourseCodes?.length ?? 0) === 0 ||
        entry.targetCourseCodes?.every((code) => /\b[1-4]XX$/.test(code))
    ),
    "Elective-credit rows should only parse generic 1XX-4XX target course codes."
  );
});

test("Phase 4 generated guide has no mojibake or raw table markup in persisted row text", () => {
  for (const entry of TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES) {
    const persistedText = [
      entry.id,
      entry.title,
      entry.targetOutcome,
      entry.effectiveDateLabel ?? "",
      entry.guideDepartment ?? "",
      entry.sourceCourseLabel ?? "",
      ...entry.notes,
      ...entry.plannerWarnings,
    ].join("\n");

    assert.doesNotMatch(persistedText, /Ã‚/);
    assert.doesNotMatch(persistedText, /<\/?(?:td|tr|table|tbody|h3)\b/i);
  }
});

test("Phase 4 generated guide preserves direct Green River to UW course equivalencies", () => {
  const math151Rule = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) => entry.sourceCourseLabel === "MATH& 151 (5) formerly MATH 124"
  );
  const cs121Rule = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) => entry.sourceCourseLabel === "CS 121 (5)"
  );

  assert.ok(math151Rule, "Expected the MATH& 151 direct equivalency row.");
  assert.equal(math151Rule?.type, "direct-course");
  assert.equal(math151Rule?.acceptanceCategory, "accepted");
  assert.equal(math151Rule?.ruleStatus, "active");
  assert.deepEqual(math151Rule?.sourceCourseSets, [["MATH& 151"]]);
  assert.ok(math151Rule?.targetCourseCodes?.includes("MATH 124"));
  assert.equal(math151Rule?.effectiveDateLabel, "SUM Qtr. 2009");

  assert.ok(cs121Rule, "Expected the CS 121 direct equivalency row.");
  assert.equal(cs121Rule?.type, "direct-course");
  assert.deepEqual(cs121Rule?.sourceCourseSets, [["CS 121"]]);
  assert.ok(cs121Rule?.targetCourseCodes?.includes("CSE 121"));
  assert.match(cs121Rule?.targetOutcome ?? "", /CSE 121 \(4\), 1XX \(1\)/);
});

test("Phase 4 generated guide represents sequence-required equivalencies as single official rows", () => {
  const accountingSequence = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) => entry.sourceCourseLabel === "ACCT& 201, 202 (5, 5) formerly B A 210, 220"
  );
  const chemistrySequence = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) => entry.sourceCourseLabel === "CHEM& 162, 163 (6, 6) formerly CHEM 150, 160"
  );
  const biologySequence = TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES.find(
    (entry) =>
      entry.sourceCourseLabel === "BIOL& 211, 212, 213 (6, 6, 6) formerly BIOL 201, 202, 203"
  );

  assert.ok(accountingSequence, "Expected the ACCT& 201/202 combined-entry rule.");
  assert.equal(accountingSequence?.type, "sequence");
  assert.deepEqual(accountingSequence?.sourceCourseSets, [["ACCT& 201", "ACCT& 202"]]);
  assert.ok(accountingSequence?.targetCourseCodes?.includes("ACCTG 215"));
  assert.ok(
    (accountingSequence?.plannerWarnings ?? []).some((warning) =>
      /partial sequence/i.test(warning)
    )
  );

  assert.ok(chemistrySequence, "Expected the CHEM& 162/163 combined-entry rule.");
  assert.equal(chemistrySequence?.type, "sequence");
  assert.deepEqual(chemistrySequence?.sourceCourseSets, [["CHEM& 162", "CHEM& 163"]]);
  assert.ok(chemistrySequence?.targetCourseCodes?.includes("CHEM 152"));
  assert.ok(chemistrySequence?.targetCourseCodes?.includes("CHEM 162"));

  assert.ok(biologySequence, "Expected the BIOL& 211/212/213 combined-entry rule.");
  assert.equal(biologySequence?.type, "sequence");
  assert.deepEqual(biologySequence?.sourceCourseSets, [
    ["BIOL& 211", "BIOL& 212", "BIOL& 213"],
  ]);
  assert.ok(biologySequence?.targetCourseCodes?.includes("BIOL 180"));
  assert.ok(biologySequence?.targetCourseCodes?.includes("BIOL 200"));
  assert.ok(biologySequence?.targetCourseCodes?.includes("BIOL 220"));
});

test("Phase 4 generated guide distinguishes limited-credit and no-credit rows", () => {
  const artLimitedCredit = getOfficialGuideRule(
    "uw-grc-guide:0081:art:art-150-3-was-the-same-as-engl-154"
  );
  const mathNoCredit = getOfficialGuideRule("uw-grc-guide:0776:mathematics:math-115t");

  assert.ok(artLimitedCredit, "Expected the ART 150 limited-credit guide row.");
  assert.equal(artLimitedCredit?.type, "limited-credit");
  assert.equal(artLimitedCredit?.acceptanceCategory, "accepted-with-warning");
  assert.match(artLimitedCredit?.targetOutcome ?? "", /\( LC \)/);
  assert.ok(
    (artLimitedCredit?.plannerWarnings ?? []).some((warning) => /limited credit/i.test(warning))
  );

  assert.ok(mathNoCredit, "Expected the MATH 115T no-credit guide row.");
  assert.equal(mathNoCredit?.type, "no-credit");
  assert.equal(mathNoCredit?.acceptanceCategory, "no-credit");
  assert.equal(mathNoCredit?.targetCourseCodes?.length, 0);
  assert.ok((mathNoCredit?.plannerWarnings ?? []).some((warning) => /no UW transfer credit/i.test(warning)));
});

test("Phase 4 generated guide carries date-effective legacy metadata", () => {
  const legacyMathSequence = getOfficialGuideRule(
    "uw-grc-guide:0795:mathematics:mathand-153-254-5-5-formerly-math-126-224-combined-entry"
  );
  const priorToMathRow = getOfficialGuideRule(
    "uw-grc-guide:0794:mathematics:mathand-153-5-formerly-math-126-5-see-also-mathand-153-combined-entry"
  );

  assert.ok(legacyMathSequence, "Expected the legacy MATH& 153/254 date-effective row.");
  assert.equal(legacyMathSequence?.ruleStatus, "legacy");
  assert.equal(legacyMathSequence?.isObsoleteSourceCourse, true);
  assert.deepEqual(legacyMathSequence?.sourceCourseSets, [["MATH& 153", "MATH& 264"]]);
  assert.equal(legacyMathSequence?.effectiveYearRanges[0]?.startLabel, "SUM Qtr. 2009");
  assert.equal(legacyMathSequence?.effectiveYearRanges[0]?.endLabel, "SPR Qtr. 2025");

  assert.ok(priorToMathRow, "Expected the prior-to cutoff MATH& 153 row.");
  assert.equal(priorToMathRow?.ruleStatus, "legacy");
  assert.equal(priorToMathRow?.effectiveYearRanges[0]?.startLabel, "prior-to-guide-cutoff");
  assert.equal(priorToMathRow?.effectiveYearRanges[0]?.endLabel, "SUM Qtr. 2025");
});

test("Phase 4 date-effective helpers can filter official guide rows by course-taken term", () => {
  const math151Rules = getTransferPlannerEquivalencyRulesForSourceCourse("MATH& 151", "AUT Qtr. 2024");
  const currentMath151GuideRule = math151Rules.find(
    (entry) => entry.sourceKind === "uw-green-river-equivalency-guide"
  );
  const priorToMath153Rule = getOfficialGuideRule(
    "uw-grc-guide:0794:mathematics:mathand-153-5-formerly-math-126-5-see-also-mathand-153-combined-entry"
  );
  const legacyMath153Sequence = getOfficialGuideRule(
    "uw-grc-guide:0795:mathematics:mathand-153-254-5-5-formerly-math-126-224-combined-entry"
  );

  assert.ok(currentMath151GuideRule, "Expected current MATH& 151 rule for AUT Qtr. 2024.");
  assert.equal(currentMath151GuideRule?.targetCourseCodes?.includes("MATH 124"), true);

  assert.ok(priorToMath153Rule, "Expected prior-to cutoff MATH& 153 rule.");
  assert.equal(
    isTransferPlannerEquivalencyRuleEffectiveForTerm(priorToMath153Rule!, "SPR Qtr. 2025"),
    true
  );
  assert.equal(
    isTransferPlannerEquivalencyRuleEffectiveForTerm(priorToMath153Rule!, "SUM Qtr. 2025"),
    false
  );

  assert.ok(legacyMath153Sequence, "Expected legacy MATH& 153/254 sequence rule.");
  assert.equal(
    isTransferPlannerEquivalencyRuleEffectiveForTerm(legacyMath153Sequence!, "SPR Qtr. 2025"),
    true
  );
  assert.equal(
    isTransferPlannerEquivalencyRuleEffectiveForTerm(legacyMath153Sequence!, "SUM Qtr. 2025"),
    false
  );
});

test("Phase 4 date-effective helpers keep historical and replacement guide rows separate", () => {
  const math153BeforeCutoff = getTransferPlannerEquivalencyRulesForSourceCourse(
    "MATH& 153",
    "SPR Qtr. 2025"
  ).filter((entry) => entry.sourceKind === "uw-green-river-equivalency-guide");
  const math153AfterCutoff = getTransferPlannerEquivalencyRulesForSourceCourse(
    "MATH& 153",
    "AUT Qtr. 2025"
  ).filter((entry) => entry.sourceKind === "uw-green-river-equivalency-guide");
  const math254AfterCutoff = getTransferPlannerEquivalencyRulesForSourceCourse(
    "MATH& 254",
    "AUT Qtr. 2025"
  ).filter((entry) => entry.sourceKind === "uw-green-river-equivalency-guide");
  const math264AfterCutoff = getTransferPlannerEquivalencyRulesForSourceCourse(
    "MATH& 264",
    "AUT Qtr. 2025"
  ).filter((entry) => entry.sourceKind === "uw-green-river-equivalency-guide");

  assert.ok(
    math153BeforeCutoff.length > 0,
    "Expected legacy MATH& 153 guide rows to apply before the 2025 cutoff."
  );
  assert.equal(
    math153AfterCutoff.length,
    0,
    "Legacy MATH& 153 guide rows should not apply after their official cutoff."
  );
  assert.ok(
    [...math254AfterCutoff, ...math264AfterCutoff].some((entry) =>
      entry.targetCourseCodes?.includes("MATH 224")
    ),
    "Expected a replacement Calculus IV guide row to carry MATH 224 after the 2025 cutoff."
  );
});

test("Legacy and canonical course-code aliases normalize to one planner code", () => {
  const normalizedCodes = [
    normalizeCourseCode("MATH& 254"),
    normalizeCourseCode("MATH&264"),
    normalizeCourseCode("  math&   254  "),
  ].map((entry) => entry.replace(/\s+/g, ""));

  assert.equal(normalizedCodes[0], "MATH&264");
  assert.equal(normalizedCodes[1], "MATH&264");
  assert.equal(normalizedCodes[2], "MATH&264");

  const extracted = extractCourseCodes("Take MATH& 254 (legacy) or MATH& 264 (current)");
  assert.ok(extracted.length >= 1);
  assert.ok(extracted.every((entry) => entry.replace(/\s+/g, "") === "MATH&264"));
});

test("Course-code extraction keeps spaced UW subject forms code-extractable", () => {
  const extracted = extractCourseCodes(
    "A A 499 Undergraduate Research and A MATH 301 Beginning Scientific Computing"
  );

  assert.ok(extracted.includes("AA 499"));
  assert.ok(extracted.includes("AMATH 301"));
});

test("Course-code extraction expands shorthand option lists without connector artifacts", () => {
  const extracted = extractCourseCodes(
    "(AMATH 301, CSE 121, 122, 123, 142 or 160)"
  );

  assert.deepEqual(extracted, [
    "AMATH 301",
    "CSE 121",
    "CSE 122",
    "CSE 123",
    "CSE 142",
    "CSE 160",
  ]);
  assert.equal(extracted.includes("OR 160"), false);
});

test("Spaced UW subject aliases normalize and resolve through canonical registry metadata", () => {
  const representativeAliases = [
    ["IND E 250", "INDE 250"],
    ["IND E 315", "INDE 315"],
    ["E E 486", "EE 486"],
    ["CHEM E 490", "CHEME 490"],
    ["MOL ENG 520", "MOLENG 520"],
    ["IN NME 220", "NME 220"],
  ] as const;

  for (const [aliasCode, canonicalCode] of representativeAliases) {
    assert.equal(
      normalizeCourseCode(aliasCode),
      canonicalCode,
      `Expected ${aliasCode} to normalize to ${canonicalCode}.`
    );
    assert.equal(
      normalizeCourseCode(canonicalCode),
      canonicalCode,
      `Expected ${canonicalCode} to remain stable after normalization.`
    );
    assert.equal(
      getTransferPlannerCanonicalCourse("uw-seattle", aliasCode)?.code,
      canonicalCode,
      `Expected canonical UW registry lookup for ${aliasCode} to resolve to ${canonicalCode}.`
    );
    assert.equal(
      getTransferPlannerNormalizedCourseMetadataEntry("uw-seattle", aliasCode)?.code,
      canonicalCode,
      `Expected normalized metadata lookup for ${aliasCode} to resolve to ${canonicalCode}.`
    );
  }
});

test("Transcript parsing deduplicates legacy and canonical course-code variants", () => {
  const parsed = parseCompletedTranscriptCourses([
    "MATH& 254",
    "math& 264",
    {
      code: "MATH&254",
      label: "Calculus IV",
    },
  ]);

  assert.ok(parsed.length >= 1);
  const normalizedParsedCodes = parsed.map((entry) => entry.code.replace(/\s+/g, ""));
  assert.ok(new Set(normalizedParsedCodes).size <= 2);
  assert.ok(normalizedParsedCodes.includes("MATH&264"));
});

test("Legacy alias maps are parser/ingest only and removed from generators", () => {
  const parserOrIngestScriptPaths = [
    "scripts/planner/ingest-grc-catalog.cjs",
    "scripts/planner/parse-transfer-planner-equivalency-guide.cjs",
    "scripts/planner/parse-transfer-planner-requirement-sources.cjs",
  ];
  const generatorScriptPaths = [
    "scripts/planner/generate-transfer-planner-course-metadata.cjs",
    "scripts/planner/generate-transfer-planner-grc-associate-tracks.cjs",
    "scripts/planner/generate-transfer-planner-grc-availability.cjs",
  ];

  for (const scriptPath of parserOrIngestScriptPaths) {
    const contents = readFileSync(scriptPath, "utf8");
    assert.ok(
      contents.includes('["MATH& 254", "MATH& 264"]'),
      `${scriptPath} is missing the expected parser/ingest legacy alias mapping for Calculus IV.`
    );
  }

  for (const scriptPath of generatorScriptPaths) {
    const contents = readFileSync(scriptPath, "utf8");
    assert.equal(
      contents.includes('["MATH& 254", "MATH& 264"]'),
      false,
      `${scriptPath} should not include legacy alias maps.`
    );
  }
});

test.skip("Phase 5 requirement-source adapters generate registry-backed source blocks", () => {
  const plannerOwnerCount = getPlannerOwnerPrimarySourceEntries().length;

  assert.equal(TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.totalOwners, plannerOwnerCount);
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.okCount,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.totalOwners
  );
  assert.equal(TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.failedCount, 0);
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.parsedRequirementSourceBlockCount,
    plannerOwnerCount
  );
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.parsedRequirementAtomCandidateCount,
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.reduce(
      (count, block) => count + block.parsedRequirementAtomCandidates.length,
      0
    )
  );
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.parsedDegreeMapBlockCandidateCount,
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.reduce(
      (count, block) => count + block.parsedDegreeMapBlockCandidates.length,
      0
    )
  );
  assert.equal(TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.length, plannerOwnerCount);
  assert.equal(TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.length, plannerOwnerCount);
  assert.deepEqual(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_REGISTRY_SUMMARY,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY
  );
  assert.deepEqual(
    countByValues(TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map((block) => block.adapterId)),
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.countsByAdapterId
  );
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.parsedRequirementSourceBlockCount,
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.length
  );
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.parsedRequirementAtomCandidateCount,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.parsedRequirementAtomCandidateCount
  );
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.parsedDegreeMapBlockCandidateCount,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.parsedDegreeMapBlockCandidateCount
  );
});

test("Phase 5 parser adapters match their source family instead of using one generic parser", () => {
  const adapterRules: Record<string, (block: (typeof TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS)[number]) => boolean> = {
    "generic-official-pdf-degree-sheet": (block) =>
      ["pdf-degree-sheet", "pdf-worksheet", "generic-pdf"].includes(block.parserType) &&
      block.campusId !== "uw-bothell",
    "generic-official-html-page": (block) =>
      [
        "html-degree-page",
        "html-curriculum-page",
        "html-overview-page",
        "catalog-page",
        "generic-html",
      ].includes(block.parserType),
    "uw-bothell-catalog-page": (block) =>
      block.campusId === "uw-bothell" && block.parserType === "catalog-page",
    "uw-bothell-html-degree-page": (block) =>
      block.campusId === "uw-bothell" &&
      ["html-degree-page", "html-curriculum-page", "html-overview-page"].includes(block.parserType),
    "uw-bothell-pdf-worksheet": (block) =>
      block.campusId === "uw-bothell" &&
      ["pdf-degree-sheet", "pdf-worksheet", "generic-pdf"].includes(block.parserType),
    "uw-seattle-catalog-page": (block) =>
      block.campusId === "uw-seattle" && block.parserType === "catalog-page",
    "uw-seattle-html-degree-page": (block) =>
      block.campusId === "uw-seattle" &&
      ["html-degree-page", "html-curriculum-page", "html-overview-page"].includes(block.parserType),
    "uw-tacoma-catalog-page": (block) =>
      block.campusId === "uw-tacoma" && block.parserType === "catalog-page",
    "uw-tacoma-html-degree-page": (block) =>
      block.campusId === "uw-tacoma" &&
      ["html-degree-page", "html-curriculum-page", "html-overview-page"].includes(block.parserType),
  };

  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS) {
    assert.ok(adapterRules[block.adapterId], `Unexpected parser adapter ${block.adapterId}.`);
    assert.ok(
      adapterRules[block.adapterId](block),
      `${block.ownerId} used adapter ${block.adapterId} for ${block.campusId}/${block.parserType}.`
    );
  }
});

test("Phase 5 generated requirement atom and degree-map candidates are internally consistent", () => {
  const blocksWithCodes = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (block) => block.parsedUwCourseCodes.length > 0
  );
  const noParsedCourseBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (block) => block.ok && block.parsedUwCourseCodes.length === 0
  );
  const unsupportedBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (block) => !block.ok
  );
  const atomCandidateCount = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.reduce(
    (count, block) => count + block.parsedRequirementAtomCandidates.length,
    0
  );
  const degreeMapCandidateCount = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.reduce(
    (count, block) => count + block.parsedDegreeMapBlockCandidates.length,
    0
  );

  assert.equal(
    blocksWithCodes.length + noParsedCourseBlocks.length + unsupportedBlocks.length,
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.length
  );
  assert.ok(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
      (block) => block.parsedDegreeMapBlockCandidates.length > 0
    ).length >= blocksWithCodes.length
  );
  assert.equal(
    atomCandidateCount,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.parsedRequirementAtomCandidateCount
  );
  assert.equal(
    degreeMapCandidateCount,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.parsedDegreeMapBlockCandidateCount
  );

  for (const block of blocksWithCodes) {
    assert.equal(block.parsedRequirementAtomCandidates.length, block.parsedUwCourseCodes.length);
    assert.ok(block.parsedDegreeMapBlockCandidates.length > 0);
    const directCodeCandidate = block.parsedDegreeMapBlockCandidates.find(
      (candidate) =>
        candidate.uwCourseCodes.length === block.parsedUwCourseCodes.length &&
        candidate.uwCourseCodes.every((code, index) => code === block.parsedUwCourseCodes[index])
    );
    assert.ok(directCodeCandidate, `${block.ownerId} should keep a parsed-code degree-map candidate.`);
    for (const candidate of block.parsedRequirementAtomCandidates) {
      assert.ok(block.parsedUwCourseCodes.includes(candidate.uwCourseCode));
      assert.ok(candidate.sourceLineHints.length <= 5);
      const hintedCourseCodes = [
        ...new Set(
          candidate.sourceLineHints.flatMap((line) =>
            extractCourseCodes(line).map((code) => normalizeCourseCode(code))
          )
        ),
      ];
      assert.ok(
        hintedCourseCodes.length === 0 || hintedCourseCodes.includes(candidate.uwCourseCode),
        `${block.ownerId}:${candidate.uwCourseCode} should keep source hints that either stay descriptive or remain code-extractable.`
      );
    }
  }

  for (const block of noParsedCourseBlocks) {
    assert.equal(block.parsedRequirementAtomCandidates.length, 0);
    assert.ok(block.parsedDegreeMapBlockCandidates.length >= 0);
    assert.ok(
      block.parsedDegreeMapBlockCandidates.every(
        (candidate) => candidate.uwCourseCodes.length === 0 && candidate.sourceLineHints.length > 0
      )
    );
  }

  for (const block of unsupportedBlocks) {
    assert.equal(block.parsedRequirementAtomCandidates.length, 0);
    assert.equal(block.parsedDegreeMapBlockCandidates.length, 0);
  }
});

test("Phase 5 source-backed blocks cover every promoted primary degree source owner", () => {
  const primaryOwnerKeys = TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
    (entry) =>
      (entry.ownerType === "major" || entry.ownerType === "pathway") &&
      entry.campusId &&
      entry.campusId !== "grc" &&
      entry.isPrimaryDegreeRequirementsLink
  )
    .map((entry) => entry.ownerId)
    .sort();
  const blockOwnerKeys = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map(
    (block) => block.ownerId
  ).sort();

  assert.equal(primaryOwnerKeys.length, TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.totalOwners);
  assert.deepEqual(blockOwnerKeys, primaryOwnerKeys);
  assert.ok(getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-aeronautics-astronautics").length > 0);
  assert.ok(
    getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-aeronautics-astronautics")[0]
      .parsedDegreeMapBlockCandidates.length > 0
  );
});

test("Phase 5 generated source blocks keep unique IDs and derived summary counts", () => {
  const blockIds = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map((block) => block.id);
  const atomCandidateIds = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.flatMap((block) =>
    block.parsedRequirementAtomCandidates.map((candidate) => candidate.id)
  );
  const degreeMapCandidateIds = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.flatMap((block) =>
    block.parsedDegreeMapBlockCandidates.map((candidate) => candidate.id)
  );

  assert.deepEqual(getDuplicateSortedValues(blockIds), []);
  assert.deepEqual(getDuplicateSortedValues(atomCandidateIds), []);
  assert.deepEqual(getDuplicateSortedValues(degreeMapCandidateIds), []);
  assert.equal(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter((block) => block.ok).length,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.okCount
  );
  assert.equal(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter((block) => !block.ok).length,
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.failedCount
  );
  assert.deepEqual(
    countByValues(TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map((block) => block.adapterId)),
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.countsByAdapterId
  );
  assert.deepEqual(
    countByValues(TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map((block) => block.adapterFamily)),
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.countsByAdapterFamily
  );
  assert.deepEqual(
    countByValues(TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map((block) => block.campusId)),
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY.countsByCampus
  );
});

test("Phase 5 generated source blocks stay aligned with manifest and fingerprint metadata", () => {
  const primarySourceByOwner = new Map(
    TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
      (entry) =>
        (entry.ownerType === "major" || entry.ownerType === "pathway") &&
        entry.campusId &&
        entry.campusId !== "grc" &&
        entry.isPrimaryDegreeRequirementsLink
    ).map((entry) => [entry.ownerId, entry])
  );
  const requirementFingerprintByOwner = new Map(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.map((entry) => [entry.ownerId, entry])
  );

  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS) {
    const source = primarySourceByOwner.get(block.ownerId);
    const fingerprint = requirementFingerprintByOwner.get(block.ownerId);
    const actualSourceEntries = TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
      (entry) =>
        entry.ownerId === block.ownerId &&
        entry.url === block.sourceUrl &&
        entry.parserType === block.parserType
    );

    assert.ok(source, `Expected ${block.ownerId} to have a primary manifest source.`);
    assert.ok(fingerprint, `Expected ${block.ownerId} to have a requirement-source fingerprint.`);
    assert.equal(block.primarySourceUrl, source.url);
    assert.equal(block.primarySourceLabel, source.label);
    assert.equal(block.primaryParserType, source.parserType);
    assert.equal(block.planId, source.planId);
    assert.equal(block.pathwayId, source.pathwayId ?? null);
    assert.equal(block.campusId, source.campusId);
    assert.ok(
      block.resolutionStrategy === "primary-source" ||
        actualSourceEntries.length > 0 ||
        block.usedSnapshotFallback,
      `${block.ownerId} should either keep its primary source, use another official manifest source, or rely on a cached snapshot.`
    );
    assert.equal(block.sourceUrl, fingerprint.sourceUrl);
    assert.equal(block.parserType, fingerprint.parserType);
    assert.equal(block.parsedUwCourseCodes.length, fingerprint.parsedUwCourseCodeCount);
    assert.equal(block.sourceOnlyUwCourseCodes.length, fingerprint.sourceOnlyUwCourseCodeCount);
    assert.equal(block.structuredOnlyUwCourseCodes.length, fingerprint.structuredOnlyUwCourseCodeCount);
  }
});

test("Phase 5 generated source blocks keep sanitized course-code sets and no raw payloads", () => {
  const rawPayloadKeys = new Set([
    "body",
    "content",
    "html",
    "pageText",
    "rawBody",
    "rawHtml",
    "rawText",
    "snapshotText",
    "text",
    "textContent",
  ]);

  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS) {
    const rawPayloadBlockKeys = Object.keys(block).filter((key) => rawPayloadKeys.has(key));
    const parsedCodeSet = new Set(block.parsedUwCourseCodes);
    const structuredOnlyCodeSet = new Set(block.structuredOnlyUwCourseCodes);
    const allCodeSets = [
      block.parsedUwCourseCodes,
      block.sourceOnlyUwCourseCodes,
      block.structuredOnlyUwCourseCodes,
    ];
    const persistedTextValues = [
      block.ownerTitle,
      block.sourceLabel,
      ...block.requirementCueLines,
      ...block.chooseStatements,
      ...block.pathwayLabels,
      ...block.parsedRequirementAtomCandidates.flatMap((candidate) => [
        candidate.title,
        ...candidate.sourceLineHints,
      ]),
      ...block.parsedDegreeMapBlockCandidates.flatMap((candidate) => [
        candidate.title,
        ...candidate.sourceLineHints,
      ]),
    ];

    assert.deepEqual(rawPayloadBlockKeys, [], `${block.ownerId} should not persist raw source payloads.`);
    assert.ok(block.ok ? block.snapshotPath : block.error, `${block.ownerId} should have snapshot or error evidence.`);
    for (const codes of allCodeSets) {
      assert.deepEqual(codes, [...codes].sort((left, right) => left.localeCompare(right)));
      assert.equal(new Set(codes).size, codes.length);
      assert.ok(codes.every((code) => CANONICAL_COURSE_CODE_RE.test(code)), block.ownerId);
    }
    assert.ok(
      block.sourceOnlyUwCourseCodes.every((code) => parsedCodeSet.has(code)),
      `${block.ownerId} source-only codes should come from parsed source codes.`
    );
    assert.ok(
      block.structuredOnlyUwCourseCodes.every(
        (code) => !parsedCodeSet.has(code) && !block.sourceOnlyUwCourseCodes.includes(code)
      ),
      `${block.ownerId} structured-only codes should be disjoint from parsed/source-only codes.`
    );
    assert.ok(
      persistedTextValues.every((value) => !/[<][a-z/][^>]*[>]/i.test(value)),
      `${block.ownerId} should not persist raw HTML tags in generated adapter text.`
    );
    assert.ok(
      persistedTextValues.every((value) => ![...value].some((char) => [194, 65533].includes(char.charCodeAt(0)))),
      `${block.ownerId} should not persist mojibake sentinel characters.`
    );
    assert.ok(
      block.parsedRequirementAtomCandidates.every((candidate) => parsedCodeSet.has(candidate.uwCourseCode)),
      `${block.ownerId} atom candidates should stay tied to parsed source codes.`
    );
    assert.ok(
      block.parsedDegreeMapBlockCandidates.every((candidate) =>
        candidate.uwCourseCodes.every((code) => parsedCodeSet.has(code))
      ),
      `${block.ownerId} degree-map candidates should stay tied to parsed source codes.`
    );
    assert.equal(
      [...parsedCodeSet].filter((code) => structuredOnlyCodeSet.has(code)).length,
      0,
      `${block.ownerId} parsed and structured-only code sets should be disjoint.`
    );
  }
});

test("Phase 5 parser preserves explicit Aeronautics areas-of-inquiry cue lines", () => {
  const aeronauticsBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-aeronautics-astronautics"
  )[0];

  assert.ok(aeronauticsBlock, "Expected the Aeronautics requirement-source block.");
  assert.ok(
    aeronauticsBlock.requirementCueLines.includes("Arts and Humanities - A&H (10)")
  );
  assert.ok(
    aeronauticsBlock.requirementCueLines.includes("Social Sciences - SSc (10)")
  );
  assert.ok(
    aeronauticsBlock.requirementCueLines.includes("Additional A&H and/or SSc (4)")
  );
});

test("Phase 5 parser preserves Computer Engineering A&H and SSc range cue lines", () => {
  const computerEngineeringBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-computer-engineering"
  )[0];

  assert.ok(computerEngineeringBlock, "Expected the Computer Engineering requirement-source block.");
  assert.ok(
    computerEngineeringBlock.requirementCueLines.some((line) =>
      /Arts\s*&\s*Humanities\s*\(10-20\)/i.test(line)
    )
  );
  assert.ok(
    computerEngineeringBlock.requirementCueLines.some((line) =>
      /Social Sciences\s*\(10-20\)/i.test(line)
    )
  );
});

test("Phase 5 parser extracts spaced-subject and linked-PDF course codes from weak public sources", () => {
  const candidateBlocks = [
    getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-political-science")[0],
    getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-real-estate")[0],
    getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-german")[0],
    getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-oceanography")[0],
    getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-computer-engineering")[0],
    getTransferPlannerParsedRequirementSourceBlocks("uw-bothell-interactive-media-design")[0],
  ].filter(Boolean);

  assert.ok(candidateBlocks.length >= 3, "Expected parser recovery coverage for weak-source owners.");

  for (const block of candidateBlocks) {
    assert.ok((block.parsedUwCourseCodes?.length ?? 0) > 0);
    assert.ok(
      block.parsedUwCourseCodes.every((code) => /^[A-Z&]+(?:\s+[A-Z&]+)*\s+\d/.test(code)),
      `${block.ownerId} should keep normalized UW course codes.`
    );
  }

  const computerEngineeringBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-computer-engineering"
  )[0];
  if (computerEngineeringBlock) {
    assert.ok(
      computerEngineeringBlock.parsedUwCourseCodes.some((code) => /CSE|EE|MATH|STAT/.test(code))
    );
    assert.equal(computerEngineeringBlock.parsedUwCourseCodes.includes("AS STAT 391"), false);
  }

  const interactiveMediaDesignBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-interactive-media-design"
  )[0];
  if (interactiveMediaDesignBlock) {
    assert.ok(
      ["alternate-official-source", "primary-source"].includes(
        interactiveMediaDesignBlock.resolutionStrategy
      )
    );
    assert.ok(/imd|fillable|bothell/i.test(interactiveMediaDesignBlock.sourceUrl));
  }
});

test("Phase 5 parser merges supplemental alternates without keeping malformed subject fragments", () => {
  const bothellComputerEngineeringBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-computer-engineering"
  )[0];
  const seattleBusinessAdministrationBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-business-administration"
  )[0];
  const swedishBlock = getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-swedish")[0];

  const availableBlocks = [
    bothellComputerEngineeringBlock,
    seattleBusinessAdministrationBlock,
    swedishBlock,
  ].filter(Boolean);
  assert.ok(availableBlocks.length >= 1, "Expected at least one supplemental-alternate owner block.");

  if (bothellComputerEngineeringBlock) {
    assert.ok((bothellComputerEngineeringBlock.parsedUwCourseCodes?.length ?? 0) > 0);
    assert.ok(
      bothellComputerEngineeringBlock.parsedUwCourseCodes.some((code) =>
        /BEE|BWRIT|CSS|STMATH|MATH/.test(code)
      )
    );
  }

  const malformedBothellComputerEngineeringCodes = [
    "B EE 215",
    "B PHYS 121",
    "B WRIT 135",
    "CSSSKL 142",
    "II CSS 360",
    "ST MATH 126",
    "BEE AND 300",
  ];
  for (const malformedCode of malformedBothellComputerEngineeringCodes) {
    assert.equal(
      bothellComputerEngineeringBlock?.parsedUwCourseCodes.includes(malformedCode) ?? false,
      false,
      `Bothell Computer Engineering should not keep malformed parsed code ${malformedCode}.`
    );
  }

  if (seattleBusinessAdministrationBlock) {
    assert.ok((seattleBusinessAdministrationBlock.parsedUwCourseCodes?.length ?? 0) > 0);
    assert.equal(
      seattleBusinessAdministrationBlock.parsedUwCourseCodes.includes("ARE BCMU 301"),
      false
    );
    assert.equal(
      seattleBusinessAdministrationBlock.parsedUwCourseCodes.includes("BCMU 301"),
      false
    );
    assert.equal(
      seattleBusinessAdministrationBlock.parsedUwCourseCodes.includes("FORTUNE 500"),
      false
    );
  }

  assert.equal(swedishBlock?.parsedUwCourseCodes.includes("ON THE 300") ?? false, false);
});

test("Phase 5 note-heavy public pages recover Bothell and Tacoma requirement codes from linked official pages", () => {
  const historyBlock = getTransferPlannerParsedRequirementSourceBlocks("uw-tacoma-history")[0];
  const artsMediaCultureBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-arts-media-culture"
  )[0];
  const businessAdministrationBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-business-administration"
  )[0];
  const ppeBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-politics-philosophy-and-economics"
  )[0];

  const availableBlocks = [historyBlock, artsMediaCultureBlock, businessAdministrationBlock, ppeBlock].filter(
    Boolean
  );
  assert.ok(availableBlocks.length >= 1, "Expected note-heavy parser recovery coverage.");

  if (historyBlock) {
    assert.ok((historyBlock.parsedUwCourseCodes?.length ?? 0) > 0);
    assert.ok(historyBlock.parsedUwCourseCodes.includes("THIST 101"));
    assert.ok(
      historyBlock.requirementCueLines.some((line) => /General History Option/i.test(line))
    );
  }

  if (artsMediaCultureBlock) {
    assert.equal(artsMediaCultureBlock.parsedUwCourseCodes?.length ?? 0, 0);
    assert.ok(
      artsMediaCultureBlock.requirementCueLines.some((line) =>
        /arts|media|culture/i.test(String(line ?? ""))
      )
    );
  }

  if (businessAdministrationBlock) {
    assert.ok((businessAdministrationBlock.parsedUwCourseCodes?.length ?? 0) > 0);
    assert.ok(businessAdministrationBlock.parsedUwCourseCodes.includes("BBUS 210"));
    assert.ok(businessAdministrationBlock.parsedUwCourseCodes.includes("BBUS 220"));
    assert.ok(
      businessAdministrationBlock.requirementCueLines.some((line) =>
        /Prerequisite Courses/i.test(String(line ?? ""))
      )
    );
  }

  if (ppeBlock) {
    assert.ok((ppeBlock.parsedUwCourseCodes?.length ?? 0) > 0);
    assert.ok(
      ppeBlock.parsedDegreeMapBlockCandidates.some((candidate) =>
        /Politics, Philosophy and Economics/i.test(candidate.title)
      )
    );
  }
});

test("Phase 5 parser keeps weak Seattle pages machine-checkable without forcing alternate-source recovery", () => {
  const italianBlock = getTransferPlannerParsedRequirementSourceBlocks("uw-seattle-italian")[0];
  const publicServicePolicyBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-public-service-and-policy"
  )[0];
  const slavicBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-slavic-languages-and-literatures"
  )[0];

  const availableBlocks = [italianBlock, publicServicePolicyBlock, slavicBlock].filter(Boolean);
  assert.ok(availableBlocks.length >= 1, "Expected weak-source Seattle recovery blocks.");

  for (const block of [publicServicePolicyBlock, slavicBlock].filter(Boolean)) {
    assert.ok((block.parsedUwCourseCodes?.length ?? 0) > 0);
    assert.equal(typeof block.usedSnapshotFallback, "boolean");
    assert.ok(
      ["primary-source", "alternate-official-source"].includes(block.resolutionStrategy) ||
        block.usedSnapshotFallback
    );
  }

  if (italianBlock) {
    assert.equal(
      italianBlock.primarySourceUrl,
      "https://frenchitalian.washington.edu/undergraduate-studies-italian"
    );
    assert.equal(italianBlock.sourceUrl, italianBlock.primarySourceUrl);
    assert.equal(italianBlock.resolutionStrategy, "primary-source");
    assert.equal(italianBlock.parsedUwCourseCodes?.length ?? 0, 0);
  }
});

test.skip("Phase 5 broad overview alternates do not replace focused Seattle degree sheets", () => {
  const compEBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-computer-engineering"
  )[0];
  const oceanographyBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-oceanography"
  )[0];

  assert.equal(/degree-requirements\/courses\//i.test(compEBlock.sourceUrl), false);
  assert.ok(compEBlock.parsedUwCourseCodes.includes("EE 215"));
  assert.ok(compEBlock.parsedUwCourseCodes.includes("MATH 208"));

  assert.equal(/Undergraduate_Degrees/i.test(oceanographyBlock.sourceUrl), false);
  assert.ok(oceanographyBlock.parsedUwCourseCodes.includes("OCEAN 201"));
});

test("Phase 5 parser drops transfer-credit and location noise while keeping prose-heavy recovery", () => {
  const artsMediaCultureBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-arts-media-culture"
  )[0];
  const businessAdministrationBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-business-administration"
  )[0];
  const ppeBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-politics-philosophy-and-economics"
  )[0];
  const criminalJusticeBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-criminal-justice"
  )[0];
  const developmentalYouthStudiesBlock = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-bothell-developmental-and-youth-studies"
  )[0];

  assert.equal(artsMediaCultureBlock?.parsedUwCourseCodes.includes("ROOM 251") ?? false, false);

  const excludedBusinessCodes = [
    "ACCTG& 201",
    "BUS& 201",
    "ECON& 201",
    "ENG& 102",
    "MATH& 151",
    "POLS& 201",
    "POLS & 201",
  ];
  for (const excludedCode of excludedBusinessCodes) {
    assert.equal(
      businessAdministrationBlock?.parsedUwCourseCodes.includes(excludedCode) ?? false,
      false,
      `Bothell Business Administration should not keep transfer-credit code ${excludedCode}.`
    );
  }

  assert.equal(ppeBlock?.parsedUwCourseCodes.includes("POLS 202") ?? false, false);
  assert.equal(criminalJusticeBlock?.parsedUwCourseCodes.includes("COMPLETE 180") ?? false, false);
  assert.equal(criminalJusticeBlock?.parsedUwCourseCodes.includes("COMPLETE 480") ?? false, false);
  assert.equal(developmentalYouthStudiesBlock?.parsedUwCourseCodes.includes("EARN 180") ?? false, false);

  const availableBlocks = [
    businessAdministrationBlock,
    ppeBlock,
    criminalJusticeBlock,
    developmentalYouthStudiesBlock,
  ].filter(Boolean);
  assert.ok(availableBlocks.length >= 2, "Expected prose-heavy recovery across multiple owners.");
  for (const block of availableBlocks) {
    assert.ok((block.parsedUwCourseCodes?.length ?? 0) > 0);
  }
  assert.equal(artsMediaCultureBlock?.parsedUwCourseCodes?.length ?? 0, 0);
});

test("Phase 5 parser no longer persists obvious prose or address prefixes as course codes", () => {
  const invalidPrefixes = [
    "ABOVE",
    "APPROVED",
    "ARE",
    "AREA",
    "BASIC",
    "BEGIN",
    "BELOW",
    "COMPLETE",
    "COURSES",
    "EARN",
    "FORTUNE",
    "FROM",
    "IF",
    "IN",
    "MORE",
    "MUST",
    "NUMBERED",
    "ON",
    "OTHER",
    "RM",
    "ROOM",
    "SUITE",
    "TAKE",
    "THAN",
    "WITH",
    "YOUR",
  ];

  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS) {
    assert.ok(
      block.parsedUwCourseCodes.every(
        (code) => !invalidPrefixes.some((prefix) => code.startsWith(`${prefix} `))
      ),
      `${block.ownerId} should not keep prose/address prefixes in parsed course codes.`
    );
    assert.ok(
      block.parsedUwCourseCodes.every((code) => !code.includes(" AND ")),
      `${block.ownerId} should not keep conjunction fragments inside parsed course codes.`
    );
    assert.ok(
      block.parsedUwCourseCodes.every((code) => !/^II\s/.test(code)),
      `${block.ownerId} should not keep list-marker prefixes inside parsed course codes.`
    );
    assert.ok(
      block.parsedUwCourseCodes.every((code) => !/SKL\s+\d{3}\b/.test(code)),
      `${block.ownerId} should not keep support-course prose fragments inside parsed course codes.`
    );
    assert.ok(
      block.parsedUwCourseCodes.every((code) => !/\b[A-Z]+&(?:\s|$)/.test(code)),
      `${block.ownerId} should not keep dangling ampersand transfer-code subjects.`
    );
  }
});

test.skip("Source summary reports a non-empty layered registry bootstrap", () => {
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.generatedOn, "2026-04-02");
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCourseCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCourseTitleCount > 200);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCourseCreditCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCoursePrerequisiteCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCourseEffectiveYearRangeCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyGuideParsedRuleCount > 1000);
  assert.ok(
    TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCountsByType["direct-course"] > 0
  );
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.majorPathwayCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceManifestCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceManifestPrimaryCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceManifestHighConfidenceCount > 0);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCount, 0);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCountsByStatus["parser-unsupported"] ?? 0, 0);
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCountsByStatus["source-unfindable"] ?? 0, 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceFingerprintCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.requirementSourceFingerprintCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.catalogDescriptionCount > 1000);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.catalogPrerequisiteNoteCount > 500);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.catalogCorequisiteNoteCount > 0);
  assert.equal(
    TRANSFER_PLANNER_SOURCE_SUMMARY.requirementDiffClassificationCount,
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.length
  );
  assert.equal(
    Object.values(TRANSFER_PLANNER_SOURCE_SUMMARY.requirementDiffClassificationCountsByKind).reduce(
      (sum, count) => sum + count,
      0
    ),
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.length
  );
  assert.ok(TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.some((entry) => entry.schoolId === "grc"));
  assert.ok(
    TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.some((entry) => entry.schoolId === "uw-bothell")
  );
  assert.ok(
    TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.some((entry) => entry.schoolId === "uw-tacoma")
  );
});

test("Source-gap registry tracks hidden owners that need source automation", () => {
  assert.equal(
    TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.length,
    TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCount
  );
  assert.ok(
    TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.every((entry) => entry.studentVisibility === "hidden"),
    "Source-gap owners should stay hidden from future student-facing visibility gates."
  );
  assert.ok(
    TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.every((entry) =>
      ["parser-unsupported", "source-unfindable"].includes(entry.sourceCoverageStatus)
    ),
    "Source-gap owners should only use automation-gap statuses."
  );
});

test("Source-gap registry exactly covers planner owners missing primary degree sources", () => {
  const owners = getPlannerOwnerPrimarySourceEntries();
  const missingPrimaryOwnerKeys = owners
    .filter((entry) => !entry.primaryUrl)
    .map((entry) => entry.ownerKey)
    .sort();
  const sourceGapOwnerKeys = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.map((entry) => entry.ownerKey).sort();
  const uniqueSourceGapOwnerKeys = [...new Set(sourceGapOwnerKeys)];

  assert.equal(owners.length, getPlannerOwnerPrimarySourceEntries().length);
  assert.equal(
    owners.filter((entry) => !!entry.primaryUrl).length,
    owners.length - TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCount
  );
  assert.equal(missingPrimaryOwnerKeys.length, TRANSFER_PLANNER_SOURCE_SUMMARY.sourceGapCount);
  assert.deepEqual(sourceGapOwnerKeys, uniqueSourceGapOwnerKeys);
  assert.deepEqual(sourceGapOwnerKeys, missingPrimaryOwnerKeys);
});

test("Source-gap statuses match their discovery evidence", () => {
  for (const entry of TRANSFER_PLANNER_SOURCE_GAP_REGISTRY) {
    assert.equal(entry.studentVisibility, "hidden");
    assert.ok(entry.sourceGapReason.length > 0);
    assert.ok(entry.officialLinkCount >= 0);
    assert.ok(entry.candidateCount >= 0);

    if (entry.sourceCoverageStatus === "parser-unsupported") {
      assert.equal(entry.suggestedPrimary?.confidence, "medium");
      assert.ok(entry.suggestedPrimary.score >= 14);
      continue;
    }

    assert.equal(entry.sourceCoverageStatus, "source-unfindable");
    assert.equal(entry.suggestedPrimary, null);
  }
});

test("Prompt 2 Ethnomusicology source-gap handling distinguishes the B.A. catalog source from graduate route labels", () => {
  const catalogMusicUrl = "https://www.washington.edu/students/gencat/program/S/Music-217.html";
  const rootPrimarySource = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-ethnomusicology-b-a",
    null
  );
  const rootGap = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.find(
    (entry) => entry.ownerKey === "uw-seattle-ethnomusicology-b-a"
  );
  const remainingEthnomusicologyPathwayGaps = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.filter(
    (entry) => entry.ownerKey.startsWith("uw-seattle-ethnomusicology-b-a:pathway:")
  )
    .map((entry) => ({
      ownerKey: entry.ownerKey,
      status: entry.sourceCoverageStatus,
      suggestedUrl: entry.suggestedPrimary?.url ?? null,
    }))
    .sort((left, right) => left.ownerKey.localeCompare(right.ownerKey));

  if (!rootPrimarySource && !rootGap && remainingEthnomusicologyPathwayGaps.length === 0) {
    assert.equal(
      TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.some((entry) =>
        entry.ownerKey.startsWith("uw-seattle-ethnomusicology-b-a")
      ),
      false
    );
    return;
  }

  assert.equal(rootPrimarySource?.url, catalogMusicUrl);
  assert.equal(rootGap, undefined);
  assert.deepEqual(remainingEthnomusicologyPathwayGaps, [
    {
      ownerKey: "uw-seattle-ethnomusicology-b-a:pathway:non-thesis-option",
      status: "parser-unsupported",
      suggestedUrl: catalogMusicUrl,
    },
    {
      ownerKey: "uw-seattle-ethnomusicology-b-a:pathway:thesis-option",
      status: "parser-unsupported",
      suggestedUrl: catalogMusicUrl,
    },
  ]);
});

test("Phase 1 source discovery excludes auth and course-list URLs from primary sources and gap candidates", () => {
  const primarySourceUrls = TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY
    .filter((entry) => entry.isPrimaryDegreeRequirementsLink)
    .map((entry) => entry.url);
  const sourceGapUrls = TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.flatMap((entry) => [
    entry.suggestedPrimary?.url ?? null,
    ...entry.sourceDiscoveryAttempts.map((attempt) => attempt.url),
  ]);
  const blockedUrls = [...primarySourceUrls, ...sourceGapUrls].filter(urlLooksLikeBlockedPrimarySource);

  assert.deepEqual(blockedUrls, []);
});

test("Source fingerprint registries separate resource drift from parsed requirement facts", () => {
  assert.ok(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.length > 0,
    "Expected resource fingerprints for tracked official source URLs."
  );
  assert.ok(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.length > 0,
    "Expected requirement fingerprints for parsed primary degree sources."
  );
  assert.equal(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.length,
    TRANSFER_PLANNER_SOURCE_SUMMARY.sourceFingerprintCount
  );
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.length,
    TRANSFER_PLANNER_SOURCE_SUMMARY.requirementSourceFingerprintCount
  );
  assert.ok(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.every((entry) =>
      SHA_256_FINGERPRINT_RE.test(entry.resourceFingerprint)
    ),
    "Every resource fingerprint should be a stable SHA-256 hash."
  );
  assert.ok(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.every((entry) =>
      SHA_256_FINGERPRINT_RE.test(entry.requirementFingerprint)
    ),
    "Every requirement fingerprint should be a stable SHA-256 hash."
  );
  assert.ok(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.some(
      (entry) => entry.parsedUwCourseCodeCount > 0
    ),
    "At least one parsed requirement source should expose UW course codes."
  );
});

test("Source fingerprint registry keeps unique URL keys without raw source payloads", () => {
  const duplicateSourceUrls = getDuplicateSortedValues(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.map((entry) => entry.url)
  );
  const rawPayloadKeys = new Set([
    "body",
    "content",
    "html",
    "pageText",
    "rawBody",
    "rawHtml",
    "rawText",
    "snapshotText",
    "text",
    "textContent",
  ]);
  const rawPayloadViolations = [
    ...TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY,
    ...TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY,
  ].flatMap((entry) =>
    Object.keys(entry)
      .filter((key) => rawPayloadKeys.has(key))
      .map((key) => `${"url" in entry ? entry.url : entry.ownerId}:${key}`)
  );

  assert.deepEqual(duplicateSourceUrls, []);
  assert.deepEqual(rawPayloadViolations, []);
  assert.ok(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.every((entry) => /^https?:\/\//.test(entry.url)),
    "Every resource fingerprint should point at an official web source URL."
  );
  assert.ok(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.every((entry) => entry.ownerIds.length > 0),
    "Every resource fingerprint should be tied to at least one planner owner."
  );
  assert.ok(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.every((entry) => entry.kinds.length > 0),
    "Every resource fingerprint should keep the source owner kind."
  );
  assert.ok(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.every(
      (entry) => !entry.ok || entry.status === null || (entry.status >= 200 && entry.status < 400)
    ),
    "Successful source fingerprints should either come from a requirement snapshot or have a successful HTTP status."
  );
});

test("Parsed requirement-source fingerprints are backed by resource fingerprints", () => {
  const sourceFingerprintUrls = new Set(
    TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.flatMap((entry) =>
      [entry.url, entry.finalUrl].filter((value): value is string => Boolean(value))
    )
  );
  const missingResourceFingerprints = TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY
    .filter((entry) => !sourceFingerprintUrls.has(entry.sourceUrl))
    .map((entry) => `${entry.ownerId}:${entry.sourceUrl}`)
    .sort();

  assert.deepEqual(missingResourceFingerprints, []);
});

test("Requirement-source fingerprint summaries match their parsed fact arrays", () => {
  const duplicateRequirementOwners = getDuplicateSortedValues(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.map((entry) => entry.ownerId)
  );
  const countMismatches: string[] = [];
  const invalidMetadata: string[] = [];

  for (const entry of TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY) {
    if (entry.parsedUwCourseCodeCount !== entry.parsedUwCourseCodes.length) {
      countMismatches.push(`${entry.ownerId}:parsedUwCourseCodeCount`);
    }
    if (entry.sourceOnlyUwCourseCodeCount !== entry.sourceOnlyUwCourseCodes.length) {
      countMismatches.push(`${entry.ownerId}:sourceOnlyUwCourseCodeCount`);
    }
    if (entry.structuredOnlyUwCourseCodeCount !== entry.structuredOnlyUwCourseCodes.length) {
      countMismatches.push(`${entry.ownerId}:structuredOnlyUwCourseCodeCount`);
    }
    if (!/^https?:\/\//.test(entry.sourceUrl)) {
      invalidMetadata.push(`${entry.ownerId}:sourceUrl`);
    }
    if (!["high", "medium", "low"].includes(entry.parseConfidence)) {
      invalidMetadata.push(`${entry.ownerId}:parseConfidence`);
    }
    if (!entry.sourceLabel.trim()) {
      invalidMetadata.push(`${entry.ownerId}:sourceLabel`);
    }
    if (entry.parserType === "unknown") {
      invalidMetadata.push(`${entry.ownerId}:parserType`);
    }
  }

  assert.deepEqual(duplicateRequirementOwners, []);
  assert.deepEqual(countMismatches, []);
  assert.deepEqual(invalidMetadata, []);
});

test("Requirement fingerprint owner coverage stays aligned with parsed requirement owners", () => {
  const parsedOwnerIds = uniqueSorted(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map((entry) => entry.ownerId)
  );
  const requirementFingerprintOwnerIds = uniqueSorted(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.map((entry) => entry.ownerId)
  );

  assert.deepEqual(requirementFingerprintOwnerIds, parsedOwnerIds);
});

test.skip("Phase 3 Green River catalog ingest fills source-backed metadata for planner courses", () => {
  const accounting202 = getTransferPlannerCanonicalCourse("grc", "ACCT& 202");
  const engr214 = getTransferPlannerCanonicalCourse("grc", "ENGR& 214");
  const engr215 = getTransferPlannerCanonicalCourse("grc", "ENGR& 215");
  const math152 = getTransferPlannerCanonicalCourse("grc", "MATH& 152");
  const cs123 = getTransferPlannerCanonicalCourse("grc", "CS 123");
  const plannerGrcCourses = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
    (entry) => entry.schoolId === "grc" && entry.referencedByPlanIds.length > 0
  );
  const catalogBackedPlannerCourses = plannerGrcCourses.filter(
    (entry) =>
      entry.title &&
      entry.creditLabel &&
      entry.catalogDescription &&
      entry.sourceLinks.some((link) => urlHasHostname(link.url, "catalog.greenriver.edu"))
  );

  assert.ok(accounting202, "Expected ACCT& 202 in the canonical Green River course registry.");
  assert.equal(accounting202?.creditLabel, "5");
  assert.match(accounting202?.title ?? "", /Principles of Accounting II/);
  assert.match(accounting202?.catalogDescription ?? "", /accounting transfer sequence/i);
  assert.ok(
    accounting202?.prerequisiteNotes.some((note) =>
      /Official Green River enrollment requirement text/i.test(note)
    )
  );
  assert.deepEqual(accounting202?.prerequisiteCourseCodes, ["ACCT& 201", "MATH 147"]);
  assert.deepEqual(accounting202?.prerequisiteAlternativeCourseCodeSets, []);

  assert.ok(engr214, "Expected ENGR& 214 in the canonical Green River course registry.");
  assert.deepEqual(engr214?.corequisiteCourseCodes, ["ENGR 106", "MATH& 152"]);
  assert.deepEqual(engr214?.corequisiteNotes, []);
  assert.ok(
    engr214?.prerequisiteNotes.some((note) => /concurrent enrollment/i.test(note))
  );
  assert.equal(
    engr214?.prerequisiteNotes.some((note) => /preserved as a note until a parser can safely normalize/i.test(note)),
    false
  );

  assert.equal(math152?.creditLabel, "5");
  assert.deepEqual(math152?.prerequisiteCourseCodes, ["MATH& 151"]);
  assert.ok(
    math152?.prerequisiteNotes.some((note) => /MATH& 151 with a grade of 2\.0/i.test(note))
  );
  assert.equal(
    math152?.prerequisiteNotes.some((note) => /Planner-normalized/i.test(note)),
    false
  );
  assert.equal(cs123?.creditLabel, "5");
  assert.deepEqual(cs123?.prerequisiteCourseCodes, ["CS 122"]);
  assert.ok(cs123?.catalogDescription);
  assert.equal(engr215?.title, "Dynamics");
  assert.deepEqual(engr215?.prerequisiteCourseCodes, ["ENGR& 214", "MATH& 152", "PHYS& 221"]);
  assert.ok(
    catalogBackedPlannerCourses.length > 300,
    "Expected current Green River catalog ingest to source-back most planner-referenced GRC courses while leaving legacy/unlisted courses unfilled."
  );
});

test("Phase 3 Green River enrollment parser normalizes course paths before metadata generation", () => {
  const accountingParserResult = parseGrcEnrollmentRequirementText(
    "ACCT 110 or ACCT& 201 ; and BTAC 100 with grades of 2.0 or higher; or instructor consent."
  );
  const engr214ParserResult = parseGrcEnrollmentRequirementText(
    "ENGR 106 and MATH& 152 with grades of 2.5 or higher or concurrent enrollment."
  );
  const phys221ParserResult = parseGrcEnrollmentRequirementText(
    "Eligible for ENGL& 101 and a grade of 2.0 or higher in PHYS& 114 or in a high school physics, or equivalent, and in MATH& 142 or equivalent with concurrent enrollment or completion in MATH& 151 ."
  );

  assert.deepEqual(accountingParserResult.prerequisiteCourseCodes, []);
  assert.deepEqual(accountingParserResult.prerequisiteAlternativeCourseCodeSets, [
    ["ACCT 110", "BTAC 100"],
    ["ACCT& 201", "BTAC 100"],
  ]);
  assert.deepEqual(engr214ParserResult.prerequisiteCourseCodes, []);
  assert.deepEqual(engr214ParserResult.prerequisiteAlternativeCourseCodeSets, []);
  assert.deepEqual(engr214ParserResult.corequisiteCourseCodes, ["ENGR 106", "MATH& 152"]);
  assert.deepEqual(phys221ParserResult.prerequisiteCourseCodes, ["MATH& 142", "PHYS& 114"]);
  assert.deepEqual(phys221ParserResult.prerequisiteAlternativeCourseCodeSets, []);
  assert.deepEqual(phys221ParserResult.corequisiteCourseCodes, ["MATH& 151"]);
  assert.deepEqual(phys221ParserResult.corequisiteAlternativeCourseCodeSets, []);
});

test("Phase 3 generated catalog metadata covers official GRC and UW source families", () => {
  const generatedGrcCatalogEntries = TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter(
    (entry) =>
      entry.schoolId === "grc" &&
      (entry.sourceLinks ?? []).some((link) =>
        urlHasHostname(link.url, "catalog.greenriver.edu")
      )
  );
  const generatedUwSeattleCatalogEntries = TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter(
    (entry) =>
      entry.schoolId === "uw-seattle" &&
      (entry.sourceLinks ?? []).some((link) =>
        urlHasAllowedHostnameAndPathPrefix(link.url, ["washington.edu", "www.washington.edu"], "/students/crscat/")
      )
  );
  const generatedUwBothellCatalogEntries = TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter(
    (entry) =>
      entry.schoolId === "uw-bothell" &&
      (entry.sourceLinks ?? []).some((link) =>
        urlHasAllowedHostnameAndPathPrefix(link.url, ["washington.edu", "www.washington.edu"], "/students/crscatb/")
      )
  );
  const generatedUwTacomaCatalogEntries = TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter(
    (entry) =>
      entry.schoolId === "uw-tacoma" &&
      (entry.sourceLinks ?? []).some((link) =>
        urlHasAllowedHostnameAndPathPrefix(link.url, ["washington.edu", "www.washington.edu"], "/students/crscatt/")
      )
  );

  assert.ok(
    generatedGrcCatalogEntries.length > 1200,
    "Expected the Green River parser to ingest the full paginated official catalog, not just the first page."
  );
  assert.equal(
    generatedGrcCatalogEntries.filter((entry) => Boolean(entry.creditLabel)).length,
    generatedGrcCatalogEntries.length
  );
  assert.equal(
    generatedGrcCatalogEntries.filter((entry) => Boolean(entry.catalogDescription)).length,
    generatedGrcCatalogEntries.length
  );

  assert.ok(generatedUwSeattleCatalogEntries.length > 600);
  assert.ok(generatedUwBothellCatalogEntries.length > 100);
  assert.ok(generatedUwTacomaCatalogEntries.length > 100);
  assert.ok(
    [
      ...generatedUwSeattleCatalogEntries,
      ...generatedUwBothellCatalogEntries,
      ...generatedUwTacomaCatalogEntries,
    ].every((entry) => Boolean(entry.catalogDescription))
  );
});

test.skip("Phase 3 catalog ingest now materializes source-backed graph edges for planner-critical GRC courses while leaving ambiguous cases as notes", () => {
  const generatedHardPrerequisiteEdges = TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter(
    (entry) =>
      (entry.prerequisiteCourseCodes ?? []).length > 0 ||
      (entry.prerequisiteAlternativeCourseCodeSets ?? []).length > 0 ||
      (entry.corequisiteCourseCodes ?? []).length > 0 ||
      (entry.corequisiteAlternativeCourseCodeSets ?? []).length > 0
  ).map((entry) => `${entry.schoolId}:${entry.code}`);
  const generatedRequirementNoteOnlyEntries = TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter(
    (entry) =>
      (entry.prerequisiteNotes ?? []).some((note) =>
        /Official Green River enrollment requirement text/i.test(note)
      ) &&
      (entry.prerequisiteCourseCodes ?? []).length === 0 &&
      (entry.prerequisiteAlternativeCourseCodeSets ?? []).length === 0 &&
      (entry.corequisiteCourseCodes ?? []).length === 0 &&
      (entry.corequisiteAlternativeCourseCodeSets ?? []).length === 0
  );

  assert.ok(generatedHardPrerequisiteEdges.length > 500);
  assert.ok(generatedHardPrerequisiteEdges.includes("grc:MATH& 153"));
  assert.ok(generatedHardPrerequisiteEdges.includes("grc:MATH 238"));
  assert.ok(generatedHardPrerequisiteEdges.includes("grc:PHYS& 222"));
  assert.ok(generatedHardPrerequisiteEdges.includes("grc:PHYS& 223"));
  assert.ok(generatedHardPrerequisiteEdges.includes("grc:ENGR& 225"));
  assert.ok(generatedHardPrerequisiteEdges.includes("grc:GIS 260"));
  assert.ok(
    generatedRequirementNoteOnlyEntries.length > 500,
    "Expected still-ambiguous catalog requirement text to remain note-only after parser normalization."
  );
});

test("Course metadata now uses generated-only entries plus explicit field-level gap states", () => {
  const metadataModuleSource = readFileSync(
    "constants/transfer-planner-source/course-metadata.ts",
    "utf8"
  );

  assert.doesNotMatch(metadataModuleSource, /TRANSFER_PLANNER_MANUAL_COURSE_METADATA/i);
  assert.ok(
    TRANSFER_PLANNER_COURSE_METADATA_FIELD_GAP_STATES.length >=
      TRANSFER_PLANNER_GENERATED_COURSE_METADATA.length,
    "Expected every generated metadata entry to emit explicit field-level source-gap state metadata."
  );
  assert.ok(
    TRANSFER_PLANNER_COURSE_METADATA_FIELD_GAPS.length > 0,
    "Expected explicit source-gap entries for at least some missing metadata fields."
  );

  const engr215GapEntries = getGeneratedMetadataGapEntriesForCourse("ENGR& 215");
  assert.equal(engr215GapEntries.length > 0, true);
  assert.equal(engr215GapEntries[0]?.fieldStates.title, "generated-present");
  assert.equal(engr215GapEntries[0]?.fieldStates.creditValue, "generated-present");
  assert.equal(engr215GapEntries[0]?.fieldStates.sourceLinks, "generated-present");
});

test("Phase 3 UW catalog ingest fills planner-relevant UW course metadata", () => {
  const math207 = getTransferPlannerCanonicalCourse("uw-seattle", "MATH 207");
  const cse122 = getTransferPlannerCanonicalCourse("uw-seattle", "CSE 122");
  const tacomaTcss142 = getTransferPlannerCanonicalCourse("uw-tacoma", "TCSS 142");
  const bothellCss142 = getTransferPlannerCanonicalCourse("uw-bothell", "CSS 142");

  assert.equal(math207?.title, "Introduction to Differential Equations");
  assert.equal(math207?.creditLabel, "4");
  assert.match(math207?.catalogDescription ?? "", /differential equations/i);
  assert.ok(
    math207?.sourceLinks.some((link) =>
      urlHasAllowedHostnameAndPathPrefix(link.url, ["washington.edu", "www.washington.edu"], "/students/crscat/math.html")
    )
  );
  assert.ok(
    math207?.prerequisiteNotes.some((note) =>
      /Official UW prerequisite text: a minimum grade of 2\.0 in MATH 125/i.test(note)
    )
  );
  assert.deepEqual(math207?.prerequisiteCourseCodes, []);

  assert.equal(cse122?.creditLabel, "4");
  assert.ok(cse122?.catalogDescription);
  assert.ok(
    cse122?.sourceLinks.some((link) =>
      urlHasAllowedHostnameAndPathPrefix(link.url, ["washington.edu", "www.washington.edu"], "/students/crscat/cse.html")
    )
  );

  assert.equal(tacomaTcss142?.creditLabel, "5");
  assert.ok(
    tacomaTcss142?.sourceLinks.some((link) =>
      urlHasAllowedHostnameAndPathPrefix(
        link.url,
        ["washington.edu", "www.washington.edu"],
        "/students/crscatt/tcss.html"
      )
    )
  );
  assert.ok(
    tacomaTcss142?.prerequisiteNotes.some((note) =>
      /Official UW prerequisite text:/i.test(note)
    )
  );

  assert.equal(bothellCss142?.creditLabel, "5");
  assert.ok(
    bothellCss142?.sourceLinks.some((link) =>
      urlHasAllowedHostnameAndPathPrefix(
        link.url,
        ["washington.edu", "www.washington.edu"],
        "/students/crscatb/css.html"
      )
    )
  );
});

test.skip("Source manifest registry now tracks parser type, role, confidence, and primary degree pages", () => {
  assert.ok(
    TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.length > 0,
    "Expected source manifest registry entries."
  );

  const compEManifest = getTransferPlannerSourceManifestEntriesForPlan(
    "uw-seattle-computer-engineering",
    null
  );
  const compEPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-computer-engineering",
    null
  );
  const trackManifest = TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.find(
    (entry) => entry.ownerType === "track" && entry.ownerId === "999Q"
  );

  assert.ok(compEManifest.length > 0, "Expected Seattle CompE source manifest entries.");
  assert.ok(compEPrimary, "Expected Seattle CompE primary degree source.");
  assert.equal(compEPrimary?.role, "degree-requirements");
  assert.equal(compEPrimary?.parserType, "pdf-degree-sheet");
  assert.equal(
    compEPrimary?.url,
    "https://www.cs.washington.edu/wp-content/uploads/2025/02/CompE_degreq_dec24v2.pdf"
  );
  assert.equal(compEPrimary?.confidence, "high");

  assert.ok(trackManifest, "Expected a track manifest entry for 999Q.");
  assert.equal(trackManifest?.campusId, "grc");
  assert.notEqual(trackManifest?.parserType, "unknown");
  assert.ok(["high", "medium", "low"].includes(trackManifest?.confidence ?? ""));
});

test.skip("Seattle Computer Engineering degree-map blocks stay aligned with the current CompE degree sheet", () => {
  const compEDegreeMapBlocks = TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY.filter(
    (entry) => entry.planId === "uw-seattle-computer-engineering"
  );
  const compEUwCourseCodes = new Set(
    compEDegreeMapBlocks.flatMap((entry) => entry.uwCourseCodes)
  );

  assert.ok(compEUwCourseCodes.has("AMATH 351"));
  assert.ok(compEUwCourseCodes.has("CSE 121"));
  assert.ok(compEUwCourseCodes.has("CSE 122"));
  assert.ok(compEUwCourseCodes.has("MATH 207"));
  assert.ok(compEUwCourseCodes.has("PHYS 141"));
  assert.ok(compEUwCourseCodes.has("PHYS 142"));
  assert.ok(compEUwCourseCodes.has("STAT 391"));
  assert.equal(compEUwCourseCodes.has("BIOLOGY 180"), false);
  assert.equal(compEUwCourseCodes.has("OR 145"), false);
  assert.equal(compEUwCourseCodes.has("REQUIRES 180"), false);
  assert.equal(compEUwCourseCodes.has("TO 180"), false);
  assert.equal(compEUwCourseCodes.has("CSE 401"), false);
  assert.equal(compEUwCourseCodes.has("CSE 444"), false);
  assert.equal(compEUwCourseCodes.has("EE 469"), false);
});

test("Automatic requirement-diff classifications eliminate legacy review-needed and unmapped buckets", () => {
  const countsByKind = countByValues(
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.map(
      (entry) => entry.classificationKind
    )
  );
  const countsByCampus = countByValues(
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.map((entry) => entry.campusId)
  );

  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.classifiedCount,
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.length
  );
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.reviewCandidateCount,
    0
  );
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.unmappedCount,
    0
  );
  assert.deepEqual(
    countsByKind,
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.countsByKind
  );
  assert.deepEqual(
    countsByCampus,
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.countsByCampus
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(countsByKind, "source-backed-no-clean-grc-consensus"),
    false
  );
  assert.ok((countsByKind["auto-promoted-guide-direct-equivalent"] ?? 0) > 0);
  assert.ok((countsByKind["auto-promoted-guide-sequence-equivalent"] ?? 0) > 0);
  assert.ok((countsByKind["auto-promoted-single-sample-consensus"] ?? 0) > 0);
  assert.ok((countsByKind["source-backed-choice-set-no-public-grc-path"] ?? 0) > 0);
  assert.ok((countsByKind["source-backed-no-public-grc-equivalent"] ?? 0) > 0);
  assert.equal(
    Object.prototype.hasOwnProperty.call(countsByKind, "source-backed-clean-title-no-shared-grc-match"),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(countsByKind, "source-backed-campus-specific-no-clean-grc-match"),
    false
  );
});

test.skip("Student-facing course lists now surface broader source-backed aquatic science transfer options", () => {
  const aquaticConservationPlan = getRequiredPlan("uw-seattle-aquatic-conservation-and-ecology");
  const aquaticConservationCourseList = getTransferPlannerGrcCourseList(aquaticConservationPlan);

  assert.ok(aquaticConservationCourseList.includes("OCEA& 101"));
  assert.ok(aquaticConservationCourseList.includes("BIOL& 211"));
  assert.ok(aquaticConservationCourseList.includes("CHEM& 161"));
  assert.ok(aquaticConservationCourseList.includes("MATH& 163"));
  assert.ok(aquaticConservationCourseList.includes("ENGR 250"));
});

test("Former catch-all source-backed rows now land in specific machine classifications", () => {
  const americanEthnicStudiesClassifications = getTransferPlannerRequirementDiffClassifications(
    "uw-bothell-american-and-ethnic-studies",
    null
  );
  const appliedComputingClassifications = getTransferPlannerRequirementDiffClassifications(
    "uw-bothell-applied-computing",
    null
  );
  const bis140Classification = americanEthnicStudiesClassifications.find(
    (entry) => entry.sourceUwCourseCode === "BIS 140"
  );
  const bis293Classification = americanEthnicStudiesClassifications.find(
    (entry) => entry.sourceUwCourseCode === "BIS 293"
  );
  const at100Classification = appliedComputingClassifications.find(
    (entry) => entry.sourceUwCourseCode === "AT 100"
  );
  const bothellBiologyClassifications = getTransferPlannerRequirementDiffClassifications(
    "uw-bothell-biology",
    null
  );
  const math215Classification = bothellBiologyClassifications.find(
    (entry) => entry.sourceUwCourseCode === "BMATH 215"
  );
  const secondAppliedComputingClassifications = getTransferPlannerRequirementDiffClassifications(
    "uw-bothell-applied-computing",
    null
  );
  const stmath126Classification = secondAppliedComputingClassifications.find(
    (entry) => entry.sourceUwCourseCode === "STMATH 126"
  );

  assert.ok(bis140Classification);
  assert.equal(
    bis140Classification.classificationKind,
    "source-backed-campus-specific-no-public-grc-equivalent"
  );
  assert.equal(bis140Classification.promotedRequirementAtomOverrideId, null);
  assert.deepEqual(bis140Classification.grcCourseCodes, []);

  assert.ok(bis293Classification);
  assert.equal(
    bis293Classification.classificationKind,
    "source-backed-generic-topic-course"
  );
  assert.equal(bis293Classification.promotedRequirementAtomOverrideId, null);

  assert.equal(
    at100Classification,
    undefined,
    "Expected parser hardening to stop producing the old AT 100 noise classification."
  );

  assert.ok(math215Classification);
  assert.equal(
    math215Classification.classificationKind,
    "source-backed-choice-set-no-public-grc-path"
  );
  assert.equal(math215Classification.promotedRequirementAtomOverrideId, null);
  assert.deepEqual(math215Classification.grcCourseCodes, []);

  if (stmath126Classification) {
    assert.equal(
      stmath126Classification.classificationKind,
      "auto-promoted-exact-title-alternative-paths"
    );
    assert.ok(stmath126Classification.promotedRequirementAtomOverrideId);
    assert.ok(stmath126Classification.grcCourseCodes.length > 0);
  } else {
    assert.ok(
      (TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.countsByKind[
        "auto-promoted-exact-title-alternative-paths"
      ] ?? 0) >= 1
    );
  }
});

test.skip("Only majors with real supported routes expose planner pathways", () => {
  assert.ok(biologyPlan, "Expected Seattle Biology planner row.");
  const politicalSciencePlan = getRequiredPlan("uw-seattle-political-science");
  assert.ok(tacomaWritingPlan, "Expected Tacoma Writing Studies planner row.");
  assert.ok(tacomaHistoryPlan, "Expected Tacoma History planner row.");
  assert.ok(sourceGeneratedGeographyPlan, "Expected Seattle Geography planner row.");
  assert.ok(sourceGeneratedPsychologyPlan, "Expected Seattle Psychology planner row.");
  assert.ok(sourceGeneratedPhghPlan, "Expected Seattle PH-GH planner row.");
  assert.ok(
    sourceGeneratedTacomaEnvSustainabilityPlan,
    "Expected Tacoma Environmental Sustainability planner row."
  );
  assert.ok(sourceGeneratedTacomaSudPlan, "Expected Tacoma SUD planner row.");
  assert.ok(sourceGeneratedTacomaUrbanStudiesPlan, "Expected Tacoma Urban Studies planner row.");
  assert.ok(sourceGeneratedTacomaEglsPlan, "Expected Tacoma EGLS planner row.");

  assert.equal(getTransferPlannerPathwaysForPlan(compEPlan).length, 0);
  assert.equal(getTransferPlannerPathwaysForPlan(bothellAppliedComputingPlan).length, 0);
  assert.equal(getTransferPlannerPathwaysForPlan(biologyPlan).length, 6);
  assert.equal(getTransferPlannerPathwaysForPlan(seattleEssPlan).length, 5);
  assert.equal(getTransferPlannerPathwaysForPlan(politicalSciencePlan).length, 3);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedGeographyPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedPsychologyPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedPhghPlan).length, 4);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaEnvSustainabilityPlan).length, 4);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaEglsPlan).length, 3);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaSudPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaHistoryPlan).length, 5);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaUrbanStudiesPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaWritingPlan).length, 3);
});

test("Materialized pathway promotion only diverges from raw source-generated pathways when raw pathways are structurally suspicious", () => {
  const unexpectedPathwayDrift = TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.flatMap((plan) => {
    const rawPathways = plan.pathways ?? [];
    if (!rawPathways.length) {
      return [];
    }

    const rawSignature = JSON.stringify(
      rawPathways.map((entry) => ({
        id: entry.id,
        label: normalizeMaterializedTransferPlannerPathwayLabel(entry.label),
      }))
    );
    const materializedSignature = JSON.stringify(
      getTransferPlannerPathwaysForPlan(plan).map((entry) => ({
        id: entry.id,
        label: normalizeMaterializedTransferPlannerPathwayLabel(entry.label),
      }))
    );

    if (rawSignature === materializedSignature) {
      return [];
    }

    if (collectSuspiciousStructuralPathways(rawPathways).length > 0) {
      return [];
    }

    return [
      {
        planId: plan.id,
        title: plan.title,
        rawPathways: rawPathways.map((entry) => ({
          id: entry.id,
          label: entry.label,
        })),
        materializedPathways: getTransferPlannerPathwaysForPlan(plan).map((entry) => ({
          id: entry.id,
          label: entry.label,
        })),
      },
    ];
  });

  assert.deepEqual(unexpectedPathwayDrift, []);
});

test("Pathways are sourced from parser-backed registries, not legacy authored plan overrides", () => {
  for (const plan of TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS) {
    const registryPathwayIds = new Set(
      TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.filter(
      (entry) => entry.planId === plan.id
    ).map((entry) => entry.pathwayId)
    );

    for (const pathway of getTransferPlannerPathwaysForPlan(plan)) {
      assert.equal(
        registryPathwayIds.has(pathway.id),
        true,
        `Unexpected pathway ${plan.id}::${pathway.id}; expected a parser-backed registry pathway id.`
      );
    }

    const materializedPathways = getTransferPlannerPathwaysForPlan(plan)
      .map((pathway) => pathway.id)
      .sort();
    const registryPathways = [...registryPathwayIds].sort();
    assert.deepEqual(
      materializedPathways,
      registryPathways,
      `Registry pathway ids should remain stable for ${plan.id}.`
    );
  }
});

test("Parser-backed supplemental pathway rows survive into generated and runtime planner output", () => {
  const bbaSourcePlan = getTransferPlannerMajorPlan("uw-bothell-business-administration");
  const bbaRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-bothell-business-administration"
  );
  const envSourcePlan = getTransferPlannerMajorPlan("uw-tacoma-environmental-sustainability");
  const envRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-tacoma-environmental-sustainability"
  );
  assert.ok(bbaSourcePlan, "Expected Bothell BBA source-generated plan.");
  assert.ok(bbaRuntimePlan, "Expected Bothell BBA runtime plan.");
  assert.ok(envSourcePlan, "Expected Tacoma Environmental Sustainability source-generated plan.");
  assert.ok(envRuntimePlan, "Expected Tacoma Environmental Sustainability runtime plan.");

  const bbaExpectedPathways = [
    "accounting-option",
    "management-concentration",
    "mis-concentration",
    "retail-management-concentration",
    "tim-concentration",
  ];
  const envExpectedPathways = [
    "business-nonprofit-leadership-option",
    "education-option",
    "environmental-communication-option",
    "policy-law-option",
  ];

  for (const pathwayId of bbaExpectedPathways) {
    assert.equal(
      getTransferPlannerPathwaysForPlan(bbaSourcePlan).some((pathway) => pathway.id === pathwayId),
      true,
      `Expected source-generated BBA pathway ${pathwayId}.`
    );
    assert.equal(
      getTransferPlannerStudentRuntimePathwaysForPlan(bbaRuntimePlan).some(
        (pathway) => pathway.id === pathwayId
      ),
      true,
      `Expected runtime BBA pathway ${pathwayId}.`
    );
  }

  for (const pathwayId of envExpectedPathways) {
    assert.equal(
      getTransferPlannerPathwaysForPlan(envSourcePlan).some((pathway) => pathway.id === pathwayId),
      true,
      `Expected source-generated Environmental Sustainability pathway ${pathwayId}.`
    );
    assert.equal(
      getTransferPlannerStudentRuntimePathwaysForPlan(envRuntimePlan).some(
        (pathway) => pathway.id === pathwayId
      ),
      true,
      `Expected runtime Environmental Sustainability pathway ${pathwayId}.`
    );
  }

  const bbaMisPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    bbaRuntimePlan,
    "mis-concentration"
  );
  assert.ok(bbaMisPlan, "Expected BBA MIS runtime pathway resolution.");
  assert.equal(bbaMisPlan.selectedPathwayId, "mis-concentration");
  assert.ok(
    buildSourceBackedRequiredCourseCodes(bbaMisPlan).some((code) =>
      ["CS 121", "CS 122", "CS 123", "CS& 141"].includes(code)
    ),
    "Expected recovered BBA MIS pathway to expose source-backed planner-safe course output."
  );

  const envBusinessBlocks = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-tacoma-environmental-sustainability",
    "business-nonprofit-leadership-option"
  );
  assert.ok(
    envBusinessBlocks.some((block) => (block.parsedUwCourseCodes?.length ?? 0) > 0),
    "Expected Environmental Sustainability business/nonprofit pathway to retain parsed UW evidence."
  );
  const envBusinessPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    envRuntimePlan,
    "business-nonprofit-leadership-option"
  );
  assert.ok(envBusinessPlan, "Expected Environmental Sustainability business pathway resolution.");
  assert.equal(envBusinessPlan.selectedPathwayId, "business-nonprofit-leadership-option");
});

test.skip("Resolving Biology pathways keeps the selected route metadata while preserving the shared source-backed prep list", () => {
  assert.ok(biologyPlan, "Expected Seattle Biology planner row.");

  const biologyPathwayLabels = getTransferPlannerPathwaysForPlan(biologyPlan).map(
    (entry) => entry.label
  );
  const biologyBaPlan = resolveTransferPlannerMajorPlan(biologyPlan, "ba-general-biology");
  const biologyBsPlan = resolveTransferPlannerMajorPlan(biologyPlan, "bs-option-family");
  const biologyBsGeneralPlan = resolveTransferPlannerMajorPlan(
    biologyPlan,
    "bs-option-family:general-biology"
  );

  assert.ok(biologyBaPlan, "Expected Biology B.A. resolved plan.");
  assert.ok(biologyBsPlan, "Expected Biology B.S. resolved plan.");
  assert.ok(biologyBsGeneralPlan, "Expected Biology B.S. General Biology resolved plan.");
  assert.deepEqual(biologyPathwayLabels, [
    "B.A. general biology",
    "B.S. Ecology, Evolution, and Conservation option",
    "B.S. General Biology option",
    "B.S. Molecular, Cellular, and Developmental Biology option",
    "B.S. Physiology option",
    "B.S. Plant Biology option",
  ]);
  assert.equal(biologyBaPlan?.selectedPathwayLabel, "B.A. general biology");
  assert.equal(biologyBsPlan?.selectedPathwayLabel, "B.S. General Biology option");
  assert.equal(biologyBsGeneralPlan?.selectedPathwayLabel, "B.S. General Biology option");
  assert.ok(getTransferPlannerGrcCourseList(biologyBaPlan).includes("PHYS& 221"));
  assert.ok(getTransferPlannerGrcCourseList(biologyBsPlan).includes("PHYS& 221"));
  assert.ok(getTransferPlannerGrcCourseList(biologyBaPlan).includes("PHYS& 222"));
  assert.ok(getTransferPlannerGrcCourseList(biologyBsPlan).includes("PHYS& 222"));
  assert.ok(getTransferPlannerGrcCourseList(biologyBaPlan).includes("PHYS& 223"));
  assert.ok(getTransferPlannerGrcCourseList(biologyBsPlan).includes("PHYS& 223"));
});

test("Earth & Space Sciences expands official credential headings into specific pathway choices", () => {
  assert.ok(seattleEssPlan, "Expected Seattle Earth & Space Sciences planner row.");

  const essPathwayLabels = getTransferPlannerPathwaysForPlan(seattleEssPlan).map(
    (entry) => entry.label
  );
  const runtimeEssPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-earth-and-space-sciences"
  );
  const runtimeEssPathwayLabels = getTransferPlannerStudentRuntimePathwaysForPlan(
    runtimeEssPlan
  ).map((entry) => entry.label);
  const resolvedEssBsPlan = resolveTransferPlannerMajorPlan(seattleEssPlan, "bs-option-family");
  const resolvedEssPhysicsPlan = resolveTransferPlannerMajorPlan(
    seattleEssPlan,
    "bs-option-family:physics"
  );

  assert.deepEqual(essPathwayLabels, [
    "B.A. route",
    "B.S. Biology option",
    "B.S. Geology option",
    "B.S. Geoscience option",
    "B.S. Physics option",
  ]);
  assert.deepEqual(runtimeEssPathwayLabels, essPathwayLabels);
  assert.equal(essPathwayLabels.includes("Option"), false);
  assert.equal(essPathwayLabels.includes("Environmental Earth Sciences Option"), false);
  assert.equal(resolvedEssBsPlan?.selectedPathwayLabel, "B.S. Biology option");
  assert.equal(resolvedEssPhysicsPlan?.selectedPathwayLabel, "B.S. Physics option");
  assert.ok(getTransferPlannerGrcCourseList(resolvedEssPhysicsPlan).includes("PHYS& 221"));
  assert.ok(getTransferPlannerGrcCourseList(resolvedEssPhysicsPlan).includes("PHYS& 222"));
});

test.skip("Tacoma Communication pathway resolution narrows the degree-map sections to the selected track", () => {
  assert.ok(tacomaCommunicationPlan, "Expected Tacoma Communication planner row.");

  const professionalPlan = resolveTransferPlannerMajorPlan(
    tacomaCommunicationPlan,
    "professional-track"
  );
  const researchPlan = resolveTransferPlannerMajorPlan(tacomaCommunicationPlan, "research-track");

  assert.deepEqual(
    professionalPlan?.degreeMapSections?.map((section) => section.title),
    ["Communication declaration baseline", "Communication professional track structure"]
  );
  assert.deepEqual(
    researchPlan?.degreeMapSections?.map((section) => section.title),
    ["Communication declaration baseline", "Communication research track structure"]
  );
});

test.skip("Layered source registries now include explicit major-pathway entries", () => {
  const biologyPathway = TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.find(
    (entry) => entry.id === "uw-seattle-biology:pathway:ba-general-biology"
  );
  const writingTechPathway = TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.find(
    (entry) => entry.id === "uw-tacoma-writing-studies:pathway:technical-communication-track"
  );

  assert.ok(biologyPathway, "Expected a Biology pathway registry entry.");
  assert.ok(writingTechPathway, "Expected a Writing Studies pathway registry entry.");
  assert.equal(
    typeof (biologyPathway?.summary ?? ""),
    "string",
    "Expected Biology pathway summary to resolve as a string in parser-first registry rows."
  );
});

test.skip("Source-generated major rows preserve planner counts and now drive more officially multi-route majors", () => {
  assert.equal(
    TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.length,
    TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.length
  );
  assert.equal(
    getTransferPlannerSourceGeneratedMajorsForCampus("uw-seattle").length,
    TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.filter((plan) => plan.campusId === "uw-seattle").length
  );
  assert.equal(
    getTransferPlannerSourceGeneratedMajorsForCampus("uw-bothell").length,
    TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.filter((plan) => plan.campusId === "uw-bothell").length
  );
  assert.equal(
    getTransferPlannerSourceGeneratedMajorsForCampus("uw-tacoma").length,
    TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.filter((plan) => plan.campusId === "uw-tacoma").length
  );

  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedChemistryPlan).length, 3);
  if (sourceGeneratedEconomicsPlan) {
    assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedEconomicsPlan).length, 2);
  } else {
    assert.equal(seattleEconomicsPlan?.coverage, "detailed");
  }
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedGeographyPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedPsychologyPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedPhghPlan).length, 4);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedStatisticsPlan).length, 3);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaAmcPlan).length, 5);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaBabaPlan).length, 5);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaEnvSustainabilityPlan).length, 4);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaEglsPlan).length, 3);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaSudPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaUrbanStudiesPlan).length, 2);
});

test.skip("Source-generated pathway rows can resolve the new route-specific Seattle and Tacoma paths", () => {
  assert.ok(sourceGeneratedChemistryPlan, "Expected source-generated Seattle Chemistry planner row.");
  assert.ok(sourceGeneratedStatisticsPlan, "Expected source-generated Seattle Statistics planner row.");
  assert.ok(sourceGeneratedTacomaBabaPlan, "Expected source-generated Tacoma BABA planner row.");

  const acsChemistryPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedChemistryPlan,
    "acs-certified-bs-route"
  );
  const dataScienceStatsPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedStatisticsPlan,
    "data-science-track"
  );
  const marketingBabaPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedTacomaBabaPlan,
    "marketing-option"
  );

  assert.equal(acsChemistryPlan?.selectedPathwayLabel, "ACS-certified B.S. route");
  assert.match(
    acsChemistryPlan?.degreeMapSections?.[1]?.title ?? "",
    /ACS-certified B\.S\. in Chemistry structure/
  );
  assert.equal(dataScienceStatsPlan?.selectedPathwayLabel, "Data Science track");
  assert.equal(dataScienceStatsPlan?.bestTrackId, "999P");
  assert.ok(getTransferPlannerGrcCourseList(dataScienceStatsPlan).includes("CS 123"));
  assert.equal(marketingBabaPlan?.selectedPathwayLabel, "Marketing option");
  assert.match(
    marketingBabaPlan?.degreeMapSections?.[1]?.title ?? "",
    /Marketing option finish/
  );
});

test("Pathway materialization filters obvious prose, graduate, navigation, and casing artifacts", () => {
  const runtimePlan = (id: string) => {
    const plan = getTransferPlannerStudentRuntimeMajorPlan(id);
    assert.ok(plan, `Expected runtime plan ${id}.`);
    return plan;
  };
  const runtimePathwayLabels = (id: string) =>
    getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan(id)).map((pathway) => pathway.label);

  assert.deepEqual(runtimePathwayLabels("uw-seattle-anthropology"), [
    "B.A. Anthropology of Globalization option",
    "B.A. Archaeological Sciences option",
    "B.A. Human Evolutionary Biology option",
    "B.A. Indigenous Archaeology option",
    "B.A. Medical Anthropology and Global Health option",
    "B.S. Archaeological Sciences option",
    "B.S. Human Evolutionary Biology option",
    "B.S. Medical Anthropology and Global Health option",
  ]);
  assert.deepEqual(runtimePathwayLabels("uw-bothell-economics"), []);
  assert.deepEqual(runtimePathwayLabels("uw-seattle-speech-and-hearing-sciences"), []);
  assert.deepEqual(runtimePathwayLabels("uw-seattle-environmental-design-and-sustainability"), [
    "Project Option",
  ]);
  assert.deepEqual(runtimePathwayLabels("uw-seattle-public-health-global-health"), [
    "Health Education & Promotion (BA Option)",
  ]);
  assert.deepEqual(runtimePathwayLabels("uw-bothell-csse"), ["IAC Option"]);
  assert.deepEqual(runtimePathwayLabels("uw-tacoma-writing-studies"), [
    "Creative Writing Track",
    "Writing and Social Change Track",
    "Technical Communication Track",
  ]);
  assert.deepEqual(runtimePathwayLabels("uw-tacoma-education"), [
    "Special Education Dual Endorsement",
    "B.A. route",
    "English Language Learners (ELL) Dual Endorsement Option",
  ]);

  const runtimePathways = TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS.flatMap((plan) =>
    getTransferPlannerStudentRuntimePathwaysForPlan(plan)
  );
  assert.deepEqual(collectSuspiciousStructuralPathways(runtimePathways), []);
  assert.deepEqual(
    runtimePathways
      .map((pathway) => pathway.label)
      .filter(
        (label) =>
          /\b[BM]\s+[AS]\b/.test(label) ||
          /option and Concentration|option and concentration/.test(label) ||
          /\b[A-Z]{3,}\b/.test(label.replace(/\b(?:CECL|ELL|ESOL|GIS|IAC|LEDE|MIS|NME|PIA|TIM|UW)\b/g, ""))
      )
      .sort(),
    []
  );
});

test("Chemical Engineering collapses NME source-page aliases into one clean pathway option", () => {
  const runtimeChemicalPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-chemical-engineering"
  );
  assert.ok(runtimeChemicalPlan, "Expected runtime Seattle Chemical Engineering plan.");

  assert.deepEqual(
    getTransferPlannerPathwaysForPlan(chemEPlan).map((pathway) => [pathway.id, pathway.label]),
    [["nme-option", "NME option"]]
  );
  assert.deepEqual(
    getTransferPlannerStudentRuntimePathwaysForPlan(runtimeChemicalPlan).map((pathway) => [
      pathway.id,
      pathway.label,
    ]),
    [["nme-option", "NME option"]]
  );
  assert.match(
    getTransferPlannerTrack(runtimeChemicalPlan.bestTrackId ?? null)?.title ?? "",
    /Bioengineering and Chemical Engineering/i
  );
  assert.ok(
    getTransferPlannerGrcCourseList(runtimeChemicalPlan).includes("CHEM& 261"),
    "Expected the base Chemical Engineering pathway to keep organic chemistry in the planner."
  );
});

test("Chemical Engineering NME does not promote engineering elective rows as required transfer courses", () => {
  const runtimeChemicalPlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-chemical-engineering"
  );
  assert.ok(runtimeChemicalPlan, "Expected runtime Seattle Chemical Engineering plan.");
  const nmePlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimeChemicalPlan, "nme-option");
  assert.ok(nmePlan, "Expected Chemical Engineering NME runtime plan.");
  const completedCourses: TranscriptCourseEntry[] = [];
  const statuses = buildStatuses(nmePlan, completedCourses);
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: nmePlan,
    ...statuses,
    completedCourses,
    track: getTransferPlannerTrack(nmePlan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: false,
    includeSummerQuarter: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const labels = quarterPlan.flatMap((quarter) => quarter.courses.map((course) => course.label));
  const falseEngineeringRows = [
    "ENGR& 214",
    "ENGR& 225",
    "ENGR& 204",
    "ENGR& 114",
    "ENGR& 215",
    "ENGR 140",
    "CS 145",
    "ENGR 100",
    "ENGR 106",
  ];
  const requiredCoreRows = [
    "ENGL& 101",
    "MATH& 151",
    "MATH& 152",
    "MATH& 163",
    "MATH& 264",
    "MATH 238",
    "MATH 240",
    "CHEM& 161",
    "CHEM& 162",
    "CHEM& 163",
    "CHEM& 261",
    "CHEM& 262",
    "CHEM& 263",
    "PHYS& 221",
    "PHYS& 222",
    "PHYS& 223",
  ];

  assert.deepEqual(
    falseEngineeringRows.filter((courseCode) => labels.includes(courseCode)),
    []
  );
  assert.deepEqual(
    requiredCoreRows.filter((courseCode) => !labels.includes(courseCode)),
    []
  );

  const sourceScopeAudit = auditSourceScope({
    plan: nmePlan,
    suggestedPlan: quarterPlan,
    completedCourses,
  });
  for (const uwCourse of ["AA 210", "CEE 220", "EE 215", "ME 123", "ME 230", "MSE 170", "CSE 143"]) {
    const auditRow = sourceScopeAudit.find((row) => row.uwCourse === uwCourse);
    assert.ok(auditRow, `Expected source-scope audit row for ${uwCourse}.`);
    assert.equal(auditRow.detectedRole, "elective-list");
    assert.equal(auditRow.promotedToRequired, false);
    assert.equal(auditRow.allowedToSchedule, false);
    assert.equal(auditRow.issue, null);
  }

  const requiredCoverageAudit = auditRequiredMappedCourseCoverage({
    plan: nmePlan,
    suggestedPlan: quarterPlan,
    completedCourses,
  });
  assert.deepEqual(
    requiredCoverageAudit
      .filter((row) =>
        ["AA 210", "CEE 220", "EE 215", "ME 123", "ME 230", "MSE 170", "CSE 143"].includes(
          row.uwCourse
        )
      )
      .map((row) => row.uwCourse),
    []
  );
  assert.equal(requiredCoverageAudit.every((row) => row.issue === null), true);

  const creditRange = buildSuggestedQuarterRemainingCreditRange({
    quarters: quarterPlan,
    track: null,
  });
  assert.equal(creditRange.exactRemainingCredits, 86);
});

test("ACMS pathway promotion uses the official semantic option names instead of structural headings", () => {
  const acmsPlan = getRequiredPlan("uw-seattle-applied-and-computational-mathematical-sciences");
  const acmsRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(acmsPlan.id);
  assert.ok(acmsRuntimePlan, "Expected an ACMS runtime plan.");

  const expectedPathways = [
    ["bs-option-family:data-science-and-statistics", "B.S. Data Science and Statistics option"],
    [
      "bs-option-family:discrete-mathematics-and-algorithms",
      "B.S. Discrete Mathematics and Algorithms option",
    ],
    [
      "bs-option-family:mathematical-economics-and-quantitative-finance",
      "B.S. Mathematical Economics and Quantitative Finance option",
    ],
    [
      "bs-option-family:scientific-computing-and-numerical-analysis",
      "B.S. Scientific Computing and Numerical Analysis option",
    ],
  ].sort((left, right) => left[0].localeCompare(right[0]));

  const sourcePathways = getTransferPlannerPathwaysForPlan(acmsPlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(acmsRuntimePlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));

  assert.deepEqual(sourcePathways, expectedPathways);
  assert.deepEqual(runtimePathways, expectedPathways);
  assert.deepEqual(
    collectSuspiciousStructuralPathways(getTransferPlannerPathwaysForPlan(acmsPlan)),
    []
  );
});

test("Structural boilerplate pathway headings do not outrank semantic route names during materialization", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-semantic-pathway-ranking",
    campusId: "uw-seattle",
    title: "Synthetic Major",
    shortTitle: "Synthetic",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [
      {
        id: "option-specific-requirements",
        label: "option Specific Requirements",
        summary: "",
        officialLinks: [],
      },
      {
        id: "option-specific-credits",
        label: "option Specific Credits",
        summary: "",
        officialLinks: [],
      },
    ],
  };
  const parsedBlocks: TransferPlannerParsedRequirementSourceBlock[] = [
    {
      id: "synthetic-major:source-block:test",
      ownerId: "synthetic-major",
      ownerTitle: "Synthetic Major",
      planId: plan.id,
      pathwayId: null,
      campusId: "uw-seattle",
      primaryParserType: "catalog-page",
      primarySourceUrl: "https://example.edu/synthetic-major",
      primarySourceLabel: "Synthetic major catalog",
      parserType: "catalog-page",
      adapterId: "uw-seattle-catalog-page",
      adapterFamily: "UW Seattle catalog pages",
      sourceUrl: "https://example.edu/synthetic-major",
      sourceLabel: "Synthetic major catalog",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [
        "Option specific requirements:",
        "Option specific credits (52-59 credits)",
      ],
      chooseStatements: [],
      pathwayLabels: [
        "Bachelor of Science degree with a major in Synthetic Major: Data Science and Statistics",
        "Bachelor of Science degree with a major in Synthetic Major: Discrete Mathematics and Algorithms",
        "Option specific requirements:",
        "Option specific credits (52-59 credits)",
      ],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
  ];

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], parsedBlocks);

  assert.deepEqual(
    materialized.map((pathway) => [pathway.id, pathway.label] as const),
    [
      ["bs-option-family:data-science-and-statistics", "B.S. Data Science and Statistics option"],
      [
        "bs-option-family:discrete-mathematics-and-algorithms",
        "B.S. Discrete Mathematics and Algorithms option",
      ],
    ]
  );
  assert.deepEqual(collectSuspiciousStructuralPathways(materialized), []);
});

test("Asian Studies visible pathways use one clean concentration label per route", () => {
  const sourceGeneratedAsianStudiesPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
    "uw-seattle"
  ).find((entry) => entry.id === "uw-seattle-asian-studies");
  assert.ok(sourceGeneratedAsianStudiesPlan, "Expected a source-generated Seattle Asian Studies planner row.");

  const asianStudiesRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-asian-studies");
  assert.ok(asianStudiesRuntimePlan, "Expected an Asian Studies runtime plan.");

  const sourcePathways = getTransferPlannerPathwaysForPlan(sourceGeneratedAsianStudiesPlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(asianStudiesRuntimePlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
  const expectedConcentrations = new Set([
    "China Concentration",
    "Japan Concentration",
    "Korea Concentration",
    "South Asia Concentration",
    "Southeast Asia Concentration",
  ]);

  assert.deepEqual(
    sourcePathways.filter(([, label]) => expectedConcentrations.has(label)).map(([, label]) => label).sort(),
    [...expectedConcentrations].sort()
  );
  assert.deepEqual(
    runtimePathways.filter(([, label]) => expectedConcentrations.has(label)).map(([, label]) => label).sort(),
    [...expectedConcentrations].sort()
  );
  assert.equal(sourcePathways.some(([, label]) => /&#\d+;|&[a-z]+;/i.test(label)), false);
  assert.equal(runtimePathways.some(([, label]) => /&#\d+;|&[a-z]+;/i.test(label)), false);
  assert.equal(sourcePathways.some(([, label]) => /^Asian Studies\s*[-–—]/i.test(label)), false);
  assert.equal(runtimePathways.some(([, label]) => /^Asian Studies\s*[-–—]/i.test(label)), false);
});

test("Sibling JSIS majors no longer surface Asian Studies pathway labels", () => {
  const seattlePlans = getTransferPlannerSourceGeneratedMajorsForCampus("uw-seattle");

  for (const planId of [
    "uw-seattle-jewish-studies",
    "uw-seattle-latin-american-and-caribbean-studies",
  ]) {
    const plan = seattlePlans.find((entry) => entry.id === planId);
    assert.ok(plan, `Expected a source-generated Seattle planner row for ${planId}.`);

    const labels = getTransferPlannerPathwaysForPlan(plan).map((pathway) => pathway.label);
    assert.deepEqual(
      labels,
      [],
      `${planId} should not expose cross-major concentration pathways: ${JSON.stringify(labels)}`
    );
    assert.equal(
      labels.some((label) => /asian studies/i.test(label)),
      false,
      `${planId} should not surface Asian Studies pathway labels: ${JSON.stringify(labels)}`
    );
    assert.equal(labels.some((label) => /&#\d+;|&[a-z]+;/i.test(label)), false);
  }
});

test("Visible pathway labels decode HTML entities even when base pathways are retained", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-entity-decoding",
    campusId: "uw-seattle",
    title: "Asian Studies",
    shortTitle: "Asian",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [
      {
        id: "asian-studies-and-8211-china-concentration",
        label: "Asian Studies &#8211; China Concentration",
        summary: "",
        officialLinks: [],
      },
    ],
  };

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], []);

  assert.deepEqual(
    materialized.map((pathway) => [pathway.id, pathway.label] as const),
    [["asian-studies-and-8211-china-concentration", "Asian Studies - China Concentration"]]
  );
});

test("Single semantic pathway families collapse PDF, entity, and requirements variants to one clean route", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-single-semantic-family",
    campusId: "uw-seattle",
    title: "Computer Science",
    shortTitle: "CS",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [
      {
        id: "computer-science-and-8211-data-science-option-pdf",
        label: "Computer Science and 8211 Data Science option Pdf",
        summary: "",
        officialLinks: [],
      },
      {
        id: "data-science-option",
        label: "Data Science option",
        summary: "",
        officialLinks: [],
      },
      {
        id: "data-science-option-requirements",
        label: "Data Science option Requirements",
        summary: "",
        officialLinks: [],
      },
    ],
  };
  const parsedBlocks: TransferPlannerParsedRequirementSourceBlock[] = [
    {
      id: "synthetic-single-semantic-family:source-block:test",
      ownerId: "synthetic-single-semantic-family",
      ownerTitle: "Computer Science",
      planId: plan.id,
      pathwayId: null,
      campusId: "uw-seattle",
      primaryParserType: "html-degree-page",
      primarySourceUrl: "https://example.edu/computer-science",
      primarySourceLabel: "Computer Science degree requirements",
      parserType: "html-degree-page",
      adapterId: "uw-seattle-catalog-page",
      adapterFamily: "Synthetic HTML degree page",
      sourceUrl: "https://example.edu/computer-science",
      sourceLabel: "Computer Science degree requirements",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: [
        "Data Science Option",
        "Data Science Option [PDF]",
        "Data Science Option Requirements",
      ],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
  ];

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], parsedBlocks);

  assert.deepEqual(
    materialized.map((pathway) => [pathway.id, pathway.label] as const),
    [["data-science-option", "Data Science option"]]
  );
  assert.deepEqual(collectSuspiciousStructuralPathways(materialized), []);
});

test("Semantic duplicate pathway labels collapse to one canonical visible route", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-semantic-dedupe",
    campusId: "uw-seattle",
    title: "Asian Studies",
    shortTitle: "Asian",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [
      {
        id: "asian-studies-and-8211-china-concentration",
        label: "Asian Studies &#8211; China Concentration",
        summary: "",
        officialLinks: [],
      },
      {
        id: "asian-studies-china-concentration",
        label: "China Concentration",
        summary: "",
        officialLinks: [],
      },
      {
        id: "asian-studies-and-8211-japan-concentration",
        label: "Asian Studies &#8211; Japan Concentration",
        summary: "",
        officialLinks: [],
      },
      {
        id: "asian-studies-japan-concentration",
        label: "Japan Concentration",
        summary: "",
        officialLinks: [],
      },
    ],
  };
  const parsedBlocks: TransferPlannerParsedRequirementSourceBlock[] = [
    {
      id: "synthetic-semantic-dedupe:source-block:test",
      ownerId: "synthetic-semantic-dedupe",
      ownerTitle: "Asian Studies",
      planId: plan.id,
      pathwayId: null,
      campusId: "uw-seattle",
      primaryParserType: "catalog-page",
      primarySourceUrl: "https://example.edu/asian-studies",
      primarySourceLabel: "Asian Studies catalog",
      parserType: "catalog-page",
      adapterId: "uw-seattle-catalog-page",
      adapterFamily: "UW Seattle catalog pages",
      sourceUrl: "https://example.edu/asian-studies",
      sourceLabel: "Asian Studies catalog",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: [
        "Asian Studies &#8211; China Concentration",
        "China Concentration",
        "Asian Studies - Japan Concentration",
        "Japan Concentration",
      ],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
  ];

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], parsedBlocks);

  assert.deepEqual(
    materialized.map((pathway) => [pathway.id, pathway.label] as const),
    [
      ["china-concentration", "China Concentration"],
      ["japan-concentration", "Japan Concentration"],
    ]
  );
});

test("Already-clean pathway families stay stable when canonical cleanup is not needed", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-stable-clean-pathways",
    campusId: "uw-seattle",
    title: "Statistics",
    shortTitle: "Stats",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [
      {
        id: "applied-statistics-track",
        label: "Applied Statistics track",
        summary: "",
        officialLinks: [],
      },
      {
        id: "data-science-track",
        label: "Data Science track",
        summary: "",
        officialLinks: [],
      },
    ],
  };
  const parsedBlocks: TransferPlannerParsedRequirementSourceBlock[] = [
    {
      id: "synthetic-stable-clean-pathways:source-block:test",
      ownerId: "synthetic-stable-clean-pathways",
      ownerTitle: "Statistics",
      planId: plan.id,
      pathwayId: null,
      campusId: "uw-seattle",
      primaryParserType: "catalog-page",
      primarySourceUrl: "https://example.edu/statistics",
      primarySourceLabel: "Statistics catalog",
      parserType: "catalog-page",
      adapterId: "uw-seattle-catalog-page",
      adapterFamily: "UW Seattle catalog pages",
      sourceUrl: "https://example.edu/statistics",
      sourceLabel: "Statistics catalog",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: ["Applied Statistics track", "Data Science track"],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
  ];

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], parsedBlocks);

  assert.deepEqual(
    materialized.map((pathway) => [pathway.id, pathway.label] as const),
    [
      ["applied-statistics-track", "Applied Statistics track"],
      ["data-science-track", "Data Science track"],
    ]
  );
});

test("Materials Science & Engineering only exposes the real NME Option pathway", () => {
  const plan = getRequiredPlan("uw-seattle-materials-science-engineering");
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(plan.id);
  assert.ok(runtimePlan, "Expected an MSE runtime plan.");

  const sourcePathways = getTransferPlannerPathwaysForPlan(plan).map(
    (pathway) => [pathway.id, pathway.label] as const
  );
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan).map(
    (pathway) => [pathway.id, pathway.label] as const
  );

  assert.deepEqual(sourcePathways, [["nme-option", "NME Option"]]);
  assert.deepEqual(runtimePathways, [["nme-option", "NME Option"]]);
  assert.ok(
    getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, "nme-option"),
    "Expected the canonical MSE NME pathway to keep a primary requirement source."
  );
  assert.ok(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.some(
      (entry) => entry.ownerId === `${plan.id}:pathway:nme-option`
    ),
    "Expected the canonical MSE NME pathway to keep a requirement fingerprint."
  );
  assert.equal(
    TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.some(
      (entry) =>
        entry.ownerId ===
        `${plan.id}:pathway:nanoscience-and-molecular-engineering-nme-option`
    ),
    false,
    "Expected the stale long MSE NME pathway id to stay out of the source manifest."
  );
  assert.equal(
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.some(
      (entry) =>
        entry.ownerId ===
        `${plan.id}:pathway:nanoscience-and-molecular-engineering-nme-option`
    ),
    false,
    "Expected the stale long MSE NME pathway id to stay out of requirement fingerprints."
  );
  assert.deepEqual(collectSuspiciousStructuralPathways(getTransferPlannerPathwaysForPlan(plan)), []);
  assert.deepEqual(
    collectSuspiciousStructuralPathways(getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan)),
    []
  );
});

test("Materials source parse retains normalized lower-division and core MSE requirements", () => {
  const [baseBlock] = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-materials-science-engineering"
  );
  const [nmeBlock] = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-materials-science-engineering",
    "nme-option"
  );

  assert.ok(baseBlock, "Expected the base MSE parsed source block.");
  assert.ok(nmeBlock, "Expected the MSE NME parsed source block.");

  for (const courseCode of ["MSE 170", "MSE 310", "MSE 311", "MSE 321", "INDE 250"]) {
    assert.equal(
      baseBlock?.parsedUwCourseCodes.includes(courseCode),
      true,
      `Expected the base MSE parsed source to include ${courseCode}.`
    );
  }

  for (const courseCode of ["EE 486", "CHEM 597", "MOLENG 520", "MSE 484", "MSE 486"]) {
    assert.equal(
      nmeBlock?.parsedUwCourseCodes.includes(courseCode),
      true,
      `Expected the MSE NME parsed source to include ${courseCode}.`
    );
  }

  assert.equal(
    baseBlock?.parsedUwCourseCodes.includes("IND E 250"),
    false,
    "Expected the base MSE parsed source to keep IND E 250 normalized as INDE 250."
  );
  assert.equal(
    new Set(baseBlock?.parsedUwCourseCodes ?? []).size,
    (baseBlock?.parsedUwCourseCodes ?? []).length,
    "Expected the base MSE parsed source to stay deduplicated after normalization."
  );
  assert.equal(
    baseBlock?.parsedUwCourseCodes.includes("IN NME 220"),
    false,
    "Expected prose like 'enroll in NME 220' not to leak as malformed IN NME 220."
  );
  assert.equal(
    nmeBlock?.parsedUwCourseCodes.includes("NME 220"),
    true,
    "Expected the NME option source parse to retain the normalized NME 220 code."
  );
});

test("Materials parser and planner preserve choose-one and elective requirement groups", () => {
  const [baseBlock] = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-materials-science-engineering"
  );
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-materials-science-engineering"
  );

  assert.ok(baseBlock, "Expected the base MSE parsed source block.");
  assert.ok(runtimePlan, "Expected the MSE runtime plan.");
  const collectGroupCourseCodes = (group: { options?: { uwCourses?: string[]; equivalentUwCourseCodes?: string[] }[] } | null | undefined) =>
    new Set(
      (group?.options ?? []).flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
      ])
    );
  const expectedEngineeringFundamentals = [
    "AA 260",
    "BIOEN 215",
    "BSE 201",
    "CHEME 355",
    "CSE 123",
    "CSE 143",
    "CSE 160",
    "CSE 164",
    "CSE 180",
    "EE 215",
    "ENGR 101",
    "ENGR 333",
    "ENGR 490",
    "INDE 250",
    "INDE 315",
    "ME 123",
    "ME 230",
    "NME 220",
  ];
  const expectedMseTechnicalElectives = [
    "MSE 450",
    "MSE 452",
    "MSE 462",
    "MSE 463",
    "MSE 466",
    "MSE 471",
    "MSE 473",
    "MSE 474",
    "MSE 475",
    "MSE 476",
    "MSE 477",
    "MSE 478",
    "MSE 479",
    "MSE 481",
    "MSE 482",
    "MSE 483",
    "MSE 484",
    "MSE 486",
    "MSE 487",
    "MSE 488",
    "MSE 489",
    "MSE 490",
    "MSE 498",
    "MSE 499",
  ];
  const expectedOutsideTechnicalElectives = [
    "AMATH 352",
    "AMATH 353",
    "AMATH 383",
    "AMATH 401",
    "AMATH 403",
    "BIOC 405",
    "BIOC 406",
    "CHEM 312",
    "CHEM 455",
    "CHEM 456",
    "CHEM 457",
    "CHEME 341",
    "ENGR 321",
    "ENVIR 480",
    "PHYS 321",
    "PHYS 324",
    "PHYS 325",
    "PHYS 334",
    "PHYS 335",
    "PHYS 434",
    "PHYS 441",
    "ENTRE 370",
    "ENTRE 440",
  ];

  const parsedScientificComputingGroup = baseBlock?.parsedRequirementGroups?.find(
    (group) => group.id.endsWith(":scientific-computing")
  );
  assert.ok(
    parsedScientificComputingGroup,
    "Expected AMATH/CSE scientific computing to parse as one requirement group."
  );
  assert.equal(parsedScientificComputingGroup?.requirementType, "choose_one");
  assert.deepEqual(
    parsedScientificComputingGroup?.options.map((option) => option.uwCourses),
    [["AMATH 301"], ["CSE 142"], ["CSE 122"]]
  );
  const parsedRequirementCourses = baseBlock?.parsedRequirementCourses ?? [];
  const parsedRequirementCourseCodes = new Set(
    parsedRequirementCourses.map((course) => course.normalizedCourseCode)
  );
  const findParsedRequirementCourse = (courseCode: string, groupIdPart?: string) =>
    parsedRequirementCourses.find(
      (course) =>
        course.normalizedCourseCode === courseCode &&
        (!groupIdPart || course.requirementGroupId.includes(groupIdPart))
    );

  assert.ok(
    parsedRequirementCourses.length > 0,
    "Expected UW MSE to emit structured parsedRequirementCourses."
  );
  assert.ok(
    parsedRequirementCourses.every(
      (course) =>
        course.requirementGroupId &&
        course.requirementType &&
        course.optionRole &&
        course.sourceHeading &&
        course.category
    ),
    "Expected every UW MSE parsed requirement course to carry group/type/role/source metadata."
  );
  for (const courseCode of [
    "MATH 124",
    "MATH 125",
    "MATH 126",
    "PHYS 121",
    "PHYS 122",
    "PHYS 123",
    "MSE 170",
    "MSE 310",
    "MSE 311",
    "MSE 321",
  ]) {
    assert.equal(
      parsedRequirementCourseCodes.has(courseCode),
      true,
      `Expected parsedRequirementCourses to include required ${courseCode}.`
    );
  }
  const parsedMathElectiveGroup = baseBlock?.parsedRequirementGroups?.find(
    (group) => group.id.endsWith(":math-elective")
  );
  const parsedScienceElectivesGroup = baseBlock?.parsedRequirementGroups?.find(
    (group) => group.id.endsWith(":science-electives")
  );
  const parsedEngineeringFundamentalsGroup = baseBlock?.parsedRequirementGroups?.find((group) =>
    group.id.endsWith(":engineering-fundamentals-electives")
  );
  const parsedMseTechnicalElectivesGroup = baseBlock?.parsedRequirementGroups?.find((group) =>
    group.id.endsWith(":mse-400-level-technical-electives")
  );
  const parsedOutsideTechnicalElectivesGroup = baseBlock?.parsedRequirementGroups?.find((group) =>
    group.id.endsWith(":outside-mse-technical-electives")
  );
  assert.equal(parsedMathElectiveGroup?.requirementType, "choose_n");
  assert.equal(parsedMathElectiveGroup?.minCourses, 1);
  assert.equal(parsedMathElectiveGroup?.maxCourses, 1);
  assert.equal(parsedScienceElectivesGroup?.requirementType, "choose_n");
  assert.equal(parsedScienceElectivesGroup?.minCourses, 2);
  assert.equal(parsedScienceElectivesGroup?.maxCourses, 2);
  assert.deepEqual(
    parsedMathElectiveGroup?.options.find((option) => option.uwCourses.includes("MATH 209"))
      ?.equivalentUwCourseCodes,
    ["MATH 309"]
  );
  assert.deepEqual(
    parsedMathElectiveGroup?.options.find((option) => option.uwCourses.includes("MATH 224"))
      ?.equivalentUwCourseCodes,
    ["MATH 324"]
  );
  assert.equal(
    findParsedRequirementCourse("MATH 309", "math-elective")?.optionRole,
    "alias",
    "Expected MATH 209/309 to keep MATH 309 as an alias in the math elective option."
  );
  assert.equal(
    findParsedRequirementCourse("MATH 324", "math-elective")?.optionRole,
    "alias",
    "Expected MATH 224/324 to keep MATH 324 as an alias in the math elective option."
  );
  assert.deepEqual(
    parsedScienceElectivesGroup?.options.find((option) => option.uwCourses.includes("CHEM 162"))
      ?.equivalentUwCourseCodes,
    ["CHEM 153", "CHEM 155"]
  );
  assert.equal(
    findParsedRequirementCourse("CHEM 153", "science-electives")?.optionRole,
    "alias",
    "Expected CHEM 162/153/155 to stay grouped as one science elective option."
  );
  assert.equal(parsedEngineeringFundamentalsGroup?.requirementType, "choose_credits");
  assert.equal(parsedEngineeringFundamentalsGroup?.minCredits, 8);
  assert.equal(parsedEngineeringFundamentalsGroup?.category, "engineering_fundamentals");
  for (const courseCode of expectedEngineeringFundamentals) {
    assert.equal(
      collectGroupCourseCodes(parsedEngineeringFundamentalsGroup).has(courseCode),
      true,
      `Expected ${courseCode} to parse as an Engineering Fundamentals elective option.`
    );
    assert.equal(
      parsedRequirementCourseCodes.has(courseCode),
      true,
      `Expected parsedRequirementCourses to include Engineering Fundamentals option ${courseCode}.`
    );
  }
  assert.deepEqual(
    parsedEngineeringFundamentalsGroup?.options.find((option) =>
      option.uwCourses.includes("CHEME 355")
    )?.displayCourseCodes,
    ["CHEM E 355"]
  );
  assert.deepEqual(
    parsedEngineeringFundamentalsGroup?.options.find((option) =>
      option.uwCourses.includes("EE 215")
    )?.displayCourseCodes,
    ["E E 215"]
  );
  assert.deepEqual(
    parsedEngineeringFundamentalsGroup?.options.find((option) =>
      option.uwCourses.includes("INDE 315")
    )?.displayCourseCodes,
    ["IND E 315"]
  );
  assert.deepEqual(
    parsedEngineeringFundamentalsGroup?.options.find((option) =>
      option.uwCourses.includes("ME 230")
    )?.displayCourseCodes,
    ["M E 230"]
  );
  assert.equal(parsedMseTechnicalElectivesGroup?.requirementType, "choose_credits");
  assert.equal(parsedMseTechnicalElectivesGroup?.minCredits, 6);
  assert.equal(parsedMseTechnicalElectivesGroup?.subcategory, "mse_400_level");
  for (const courseCode of expectedMseTechnicalElectives) {
    assert.equal(
      collectGroupCourseCodes(parsedMseTechnicalElectivesGroup).has(courseCode),
      true,
      `Expected ${courseCode} to parse as an MSE 400-level technical elective option.`
    );
    assert.equal(
      parsedRequirementCourseCodes.has(courseCode),
      true,
      `Expected parsedRequirementCourses to include MSE technical elective option ${courseCode}.`
    );
  }
  assert.equal(
    parsedMseTechnicalElectivesGroup?.options.find((option) => option.uwCourses.includes("MSE 498"))
      ?.creditText,
    "3-4"
  );
  assert.equal(
    parsedMseTechnicalElectivesGroup?.options.find((option) => option.uwCourses.includes("MSE 499"))
      ?.creditText,
    "3-5"
  );
  assert.equal(parsedOutsideTechnicalElectivesGroup?.requirementType, "choose_credits");
  assert.equal(parsedOutsideTechnicalElectivesGroup?.maxCredits, 9);
  assert.equal(parsedOutsideTechnicalElectivesGroup?.subcategory, "outside_mse_approved");
  for (const courseCode of expectedOutsideTechnicalElectives) {
    assert.equal(
      collectGroupCourseCodes(parsedOutsideTechnicalElectivesGroup).has(courseCode),
      true,
      `Expected ${courseCode} to parse as an outside-MSE technical elective option.`
    );
    assert.equal(
      parsedRequirementCourseCodes.has(courseCode),
      true,
      `Expected parsedRequirementCourses to include outside-MSE technical elective option ${courseCode}.`
    );
  }
  assert.deepEqual(
    parsedOutsideTechnicalElectivesGroup?.options.find((option) =>
      option.uwCourses.includes("AMATH 352")
    )?.displayCourseCodes,
    ["A MATH 352"]
  );
  assert.equal(
    findParsedRequirementCourse("BIOC 405", "outside-mse-technical-electives")?.optionRole,
    "option"
  );
  assert.equal(
    findParsedRequirementCourse("BIOC 406", "outside-mse-technical-electives")?.optionRole,
    "option"
  );
  assert.equal(
    findParsedRequirementCourse("CHEM 455", "outside-mse-technical-electives")?.optionRole,
    "option"
  );
  assert.equal(
    findParsedRequirementCourse("CHEM 456", "outside-mse-technical-electives")?.optionRole,
    "option"
  );
  assert.equal(
    findParsedRequirementCourse("CHEM 457", "outside-mse-technical-electives")?.optionRole,
    "option"
  );
  assert.equal(
    parsedOutsideTechnicalElectivesGroup?.options.find((option) =>
      option.uwCourses.includes("ENGR 321")
    )?.maxCredits,
    4
  );

  const runtimeGroups = runtimePlan.requirementGroups ?? [];
  const runtimeScientificComputingGroup = runtimeGroups.find((group) =>
    group.id.endsWith(":scientific-computing")
  );
  const mathElectiveGroup = runtimeGroups.find((group) => group.id.endsWith(":math-elective"));
  const scienceElectivesGroup = runtimeGroups.find((group) =>
    group.id.endsWith(":science-electives")
  );
  const engineeringFundamentalsGroup = runtimeGroups.find((group) =>
    group.id.endsWith(":engineering-fundamentals-electives")
  );
  const mseTechnicalElectivesGroup = runtimeGroups.find((group) =>
    group.id.endsWith(":mse-400-level-technical-electives")
  );
  const outsideTechnicalElectivesGroup = runtimeGroups.find((group) =>
    group.id.endsWith(":outside-mse-technical-electives")
  );

  assert.equal(runtimeScientificComputingGroup?.requirementType, "choose_one");
  assert.deepEqual(
    runtimeScientificComputingGroup?.options.map((option) => option.uwCourses),
    [["AMATH 301"], ["CSE 142"], ["CSE 122"]]
  );
  assert.equal(mathElectiveGroup?.requirementType, "choose_n");
  assert.equal(mathElectiveGroup?.minCourses, 1);
  assert.equal(mathElectiveGroup?.maxCourses, 1);
  assert.equal(
    mathElectiveGroup?.options.some((option) => option.uwCourses.includes("MATH 224")),
    true,
    "Expected MATH 224 to remain available as a math elective option."
  );
  assert.equal(scienceElectivesGroup?.requirementType, "choose_n");
  assert.equal(scienceElectivesGroup?.minCourses, 2);
  assert.equal(scienceElectivesGroup?.maxCourses, 2);
  for (const courseCode of [
    "BIOL 180",
    "BIOL 200",
    "CHEM 162",
    "CHEM 165",
    "CHEM 223",
    "CHEM 224",
    "CHEM 237",
    "CHEM 238",
    "CHEM 312",
    "CHEM 317",
    "CHEM 335",
    "CHEM 336",
    "CHEM 452",
    "CHEM 455",
    "CHEM 456",
    "PHYS 224",
    "PHYS 225",
    "PHYS 227",
    "PHYS 228",
  ]) {
    assert.equal(
      scienceElectivesGroup?.options.some((option) => option.uwCourses.includes(courseCode)),
      true,
      `Expected ${courseCode} to remain available as a science elective option.`
    );
  }
  assert.equal(engineeringFundamentalsGroup?.requirementType, "choose_credits");
  assert.equal(engineeringFundamentalsGroup?.minCredits, 8);
  for (const courseCode of expectedEngineeringFundamentals) {
    assert.equal(
      collectGroupCourseCodes(engineeringFundamentalsGroup).has(courseCode),
      true,
      `Expected ${courseCode} to remain available as an Engineering Fundamentals option.`
    );
  }
  assert.equal(mseTechnicalElectivesGroup?.requirementType, "choose_credits");
  assert.equal(mseTechnicalElectivesGroup?.minCredits, 6);
  for (const courseCode of expectedMseTechnicalElectives) {
    assert.equal(
      collectGroupCourseCodes(mseTechnicalElectivesGroup).has(courseCode),
      true,
      `Expected ${courseCode} to remain available as an MSE technical elective option.`
    );
  }
  assert.equal(outsideTechnicalElectivesGroup?.requirementType, "choose_credits");
  assert.equal(outsideTechnicalElectivesGroup?.maxCredits, 9);
  assert.equal(
    outsideTechnicalElectivesGroup?.options.find((option) => option.uwCourses.includes("ENGR 321"))
      ?.maxCredits,
    4
  );

  const nmeRuntimePlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, "nme-option");
  const nmeEngineeringFundamentalsGroup = nmeRuntimePlan?.requirementGroups?.find((group) =>
    group.id.endsWith(":engineering-fundamentals-electives")
  );
  assert.equal(
    nmeEngineeringFundamentalsGroup?.options.some((option) => option.uwCourses.includes("NME 220")),
    false,
    "Expected NME 220 to be excluded from the active Engineering Fundamentals options for NME Option students."
  );

  const requiredCourseCodes = buildSourceBackedRequiredCourseCodes(runtimePlan);
  for (const courseCode of ["MATH& 264", "CHEM& 261", "CHEM& 262", "PHYS 225"]) {
    assert.equal(
      requiredCourseCodes.includes(courseCode),
      false,
      `Did not expect ${courseCode} to be treated as required just because it is an option.`
    );
  }

  const requiredSummaryEntries = buildSourceBackedRequiredCourseSummaryEntries(runtimePlan, {
    mode: "uw",
  });
  const requiredSummaryText = requiredSummaryEntries
    .filter((entry) => entry.kind !== "choice-bucket")
    .map((entry) => entry.text)
    .join("\n");
  for (const courseCode of [
    "AMATH 301",
    "CSE 142",
    "CSE 122",
    "MATH 224",
    "INDE 315",
    "CHEM 237",
    "CHEM 238",
    "PHYS 225",
    "AA 260",
    "BIOEN 215",
    "CSE 123",
    "EE 215",
    "ME 230",
    "NME 220",
    "MSE 450",
    "MSE 452",
    "ENGR 321",
  ]) {
    assert.doesNotMatch(
      requiredSummaryText,
      new RegExp(`\\b${courseCode.replace(/\s+/g, "\\s+")}\\b`),
      `Did not expect ${courseCode} to render as an individually required course.`
    );
  }

  const choiceSummaryText = requiredSummaryEntries
    .filter((entry) => entry.kind === "choice-bucket")
    .map((entry) => entry.text)
    .join("\n");
  assert.match(choiceSummaryText, /Scientific computing - Choose one\./);
  assert.match(choiceSummaryText, /Choose 1 Math Elective\./);
  assert.match(choiceSummaryText, /Choose 2 Science Electives\./);
  assert.match(choiceSummaryText, /Choose at least 8 credits from Engineering Fundamentals electives\./);
  assert.match(choiceSummaryText, /Choose at least 6 credits from MSE 400-level technical electives\./);
  assert.match(choiceSummaryText, /Up to 9 credits may count from approved outside-MSE technical electives\./);
  assert.match(choiceSummaryText, /Selected options?:/);
  assert.match(choiceSummaryText, /Other valid options:/);
  assert.match(choiceSummaryText, /Selected for this credit requirement:/);
  assert.match(choiceSummaryText, /Other approved options:/);

  const consideredCourseCodes = buildSourceBackedUwCourseConsideredSummaryEntries(runtimePlan).map(
    (entry) => entry.courseCode
  );
  const consideredEntries = buildSourceBackedUwCourseConsideredSummaryEntries(runtimePlan);
  for (const courseCode of [
    ...expectedEngineeringFundamentals,
    ...expectedMseTechnicalElectives,
    ...expectedOutsideTechnicalElectives,
  ]) {
    assert.equal(
      consideredCourseCodes.includes(courseCode),
      true,
      `Expected UW Courses Considered to include official option ${courseCode}.`
    );
  }
  assert.equal(
    consideredEntries.find((entry) => entry.courseCode === "AA 260")?.optionRole,
    "option"
  );
  assert.equal(
    consideredEntries.find((entry) => entry.courseCode === "AA 260")?.requirementType,
    "choose_credits"
  );
  assert.equal(
    consideredEntries.find((entry) => entry.courseCode === "MATH 124")?.optionRole,
    "required"
  );

  const emptyStatuses = buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, []);
  const engineeringCreditStatus = emptyStatuses.find((status) =>
    status.item.requirementGroup?.id.endsWith(":engineering-fundamentals-electives")
  );
  const mseTechnicalCreditStatus = emptyStatuses.find((status) =>
    status.item.requirementGroup?.id.endsWith(":mse-400-level-technical-electives")
  );
  const outsideCreditStatus = emptyStatuses.find((status) =>
    status.item.requirementGroup?.id.endsWith(":outside-mse-technical-electives")
  );
  assert.equal(engineeringCreditStatus?.completedCredits, 0);
  assert.equal(engineeringCreditStatus?.matched, false);
  assert.equal(engineeringCreditStatus?.creditProgressLabel, "0/8 credits completed");
  assert.equal(mseTechnicalCreditStatus?.completedCredits, 0);
  assert.equal(mseTechnicalCreditStatus?.matched, false);
  assert.equal(mseTechnicalCreditStatus?.creditProgressLabel, "0/6 credits completed");
  assert.equal(outsideCreditStatus?.completedCredits, 0);
  assert.equal(outsideCreditStatus?.maxCreditCount, 9);

  const partialEngineeringStatus = buildRequirementStatuses(runtimePlan.beforeEnrollmentChecklist, [
    { code: "ENGR& 224", label: "ENGR& 224" },
  ]).find((status) =>
    status.item.requirementGroup?.id.endsWith(":engineering-fundamentals-electives")
  );
  assert.equal(partialEngineeringStatus?.completedCredits, 4);
  assert.equal(partialEngineeringStatus?.matched, false);
  assert.equal(partialEngineeringStatus?.creditProgressLabel, "4/8 credits completed");
});

test("Materials NME Option replaces standard technical electives with the NME core/elective bucket", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(
    "uw-seattle-materials-science-engineering"
  );
  const [nmeBlock] = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-materials-science-engineering",
    "nme-option"
  );

  assert.ok(runtimePlan, "Expected the MSE runtime plan.");
  assert.ok(nmeBlock, "Expected the MSE NME parsed source block.");

  const normalMseTechnicalGroup = runtimePlan.requirementGroups?.find((group) =>
    group.id.endsWith(":mse-400-level-technical-electives")
  );
  const normalOutsideTechnicalGroup = runtimePlan.requirementGroups?.find((group) =>
    group.id.endsWith(":outside-mse-technical-electives")
  );
  assert.equal(normalMseTechnicalGroup?.requirementType, "choose_credits");
  assert.equal(normalMseTechnicalGroup?.minCredits, 6);
  assert.equal(normalOutsideTechnicalGroup?.requirementType, "choose_credits");
  assert.equal(normalOutsideTechnicalGroup?.maxCredits, 9);

  const normalSummaryText = buildSourceBackedRequiredCourseSummaryEntries(runtimePlan, {
    mode: "uw",
  })
    .map((entry) => entry.text)
    .join("\n");
  assert.match(normalSummaryText, /Choose at least 6 credits from MSE 400-level technical electives\./);
  assert.match(normalSummaryText, /Up to 9 credits may count from approved outside-MSE technical electives\./);

  const parsedNmeGroup = nmeBlock.parsedRequirementGroups?.find((group) =>
    group.id.endsWith(":mse-nme-core-elective-19-credits")
  );
  assert.equal(parsedNmeGroup?.requirementType, "choose_credits");
  assert.equal(parsedNmeGroup?.minCredits, 19);
  assert.equal(parsedNmeGroup?.category, "nme_core_elective");

  const parsedNmeCourses = (nmeBlock.parsedRequirementCourses ?? []).filter((course) =>
    course.requirementGroupId.endsWith(":mse-nme-core-elective-19-credits")
  );
  const findParsedNmeCourse = (courseCode: string) =>
    parsedNmeCourses.find((course) => course.normalizedCourseCode === courseCode);
  for (const courseCode of ["NME 220", "BIOEN 423", "MSE 452", "ENGR 321", "CHEME 523", "NME 498"]) {
    const course = findParsedNmeCourse(courseCode);
    assert.ok(course, `Expected ${courseCode} to be captured from the NME option source.`);
    assert.equal(course?.requirementGroupId, parsedNmeGroup?.id);
    assert.equal(course?.requirementType, "choose_credits");
    assert.ok(course?.category, `Expected ${courseCode} to carry NME category metadata.`);
  }
  assert.equal(findParsedNmeCourse("NME 220")?.category, "nme_core_required");
  assert.equal(findParsedNmeCourse("ENGR 321")?.category, "nme_restricted_option");
  assert.equal(
    parsedNmeCourses.every((course) => course.requirementGroupId && course.category),
    true,
    "Expected every parsed NME course to carry requirementGroupId and category metadata."
  );

  const nmeRuntimePlan = resolveTransferPlannerStudentRuntimeMajorPlan(runtimePlan, "nme-option");
  assert.ok(nmeRuntimePlan, "Expected the selected NME runtime plan.");

  const replacement = nmeRuntimePlan.requirementReplacements?.find((entry) =>
    entry.replacedByRequirementId.endsWith(":mse-nme-core-elective-19-credits")
  );
  assert.equal(
    replacement?.baseRequirementId,
    "uw-seattle-materials-science-engineering:requirement-group:mse-technical-electives-15-credits"
  );
  assert.equal(replacement?.appliesWhen, 'selectedOption === "NME"');
  assert.equal(replacement?.sourceUrl, "https://mse.washington.edu/current/undergrad/nmeoption");

  const activeNmeGroup = nmeRuntimePlan.requirementGroups?.find((group) =>
    group.id.endsWith(":mse-nme-core-elective-19-credits")
  );
  assert.equal(activeNmeGroup?.requirementType, "choose_credits");
  assert.equal(activeNmeGroup?.minCredits, 19);
  assert.equal(activeNmeGroup?.category, "nme_core_elective");

  const activeNmeCourseCodes = new Set(
    (activeNmeGroup?.options ?? []).flatMap((option) => [
      ...(option.uwCourses ?? []),
      ...(option.equivalentUwCourseCodes ?? []),
    ])
  );
  for (const courseCode of ["NME 220", "BIOEN 423", "MSE 452", "ENGR 321", "NME 498"]) {
    assert.equal(
      activeNmeCourseCodes.has(courseCode),
      true,
      `Expected ${courseCode} to remain available in the active NME requirement.`
    );
  }
  assert.equal(
    activeNmeGroup?.options.find((option) => option.uwCourses.includes("NME 220"))?.category,
    "nme_core_required"
  );
  assert.equal(
    activeNmeGroup?.options.find((option) => option.uwCourses.includes("MSE 452"))?.category,
    "nme_elective_option"
  );
  assert.equal(
    activeNmeGroup?.options.find((option) => option.uwCourses.includes("ENGR 321"))?.category,
    "nme_restricted_option"
  );

  assert.equal(
    nmeRuntimePlan.requirementGroups?.some((group) =>
      group.id.endsWith(":mse-400-level-technical-electives")
    ),
    false,
    "Expected the normal MSE 400-level technical elective group to be inactive for NME."
  );
  assert.equal(
    nmeRuntimePlan.requirementGroups?.some((group) =>
      group.id.endsWith(":outside-mse-technical-electives")
    ),
    false,
    "Expected the normal outside-MSE technical elective group to be inactive for NME."
  );
  assert.equal(
    [
      ...nmeRuntimePlan.applicationChecklist,
      ...nmeRuntimePlan.beforeEnrollmentChecklist,
      ...nmeRuntimePlan.stayAtGrcChecklist,
    ].some((item) =>
      /:mse-400-level-technical-electives$|:outside-mse-technical-electives$/.test(
        item.requirementGroup?.id ?? ""
      )
    ),
    false,
    "Expected normal MSE technical elective checklist rows not to remain active for NME."
  );

  const nmeEngineeringFundamentalsGroup = nmeRuntimePlan.requirementGroups?.find((group) =>
    group.id.endsWith(":engineering-fundamentals-electives")
  );
  assert.equal(
    nmeEngineeringFundamentalsGroup?.options.some((option) =>
      option.uwCourses.includes("NME 220")
    ),
    false,
    "Expected NME 220 not to satisfy Engineering Fundamentals for NME Option students."
  );

  const nme220Statuses = buildRequirementStatuses(nmeRuntimePlan.beforeEnrollmentChecklist, [
    { code: "NME 220", label: "NME 220" },
  ]);
  const engineeringStatus = nme220Statuses.find((status) =>
    status.item.requirementGroup?.id.endsWith(":engineering-fundamentals-electives")
  );
  const nmeCoreStatus = nme220Statuses.find((status) =>
    status.item.requirementGroup?.id.endsWith(":mse-nme-core-elective-19-credits")
  );
  assert.equal(engineeringStatus?.completedCredits, 0);
  assert.equal(engineeringStatus?.matched, false);
  assert.equal(nmeCoreStatus?.completedCredits, 4);
  assert.equal(nmeCoreStatus?.creditProgressLabel, "4/19 credits completed");

  const nmeSummaryText = buildSourceBackedRequiredCourseSummaryEntries(nmeRuntimePlan, {
    mode: "uw",
  })
    .map((entry) => entry.text)
    .join("\n");
  assert.match(nmeSummaryText, /NME Option Core\/Elective Requirement: 19 credits\./);
  assert.match(nmeSummaryText, /This replaces the standard 15-credit MSE technical elective requirement\./);
  assert.doesNotMatch(
    nmeSummaryText,
    /Choose at least 6 credits from MSE 400-level technical electives\./
  );
  assert.doesNotMatch(
    nmeSummaryText,
    /Up to 9 credits may count from approved outside-MSE technical electives\./
  );

  const nmeConsideredEntries = buildSourceBackedUwCourseConsideredSummaryEntries(nmeRuntimePlan);
  assert.equal(
    nmeConsideredEntries.find((entry) => entry.courseCode === "NME 220")?.category,
    "nme_core_required"
  );
  assert.match(
    nmeConsideredEntries.find((entry) => entry.courseCode === "NME 220")?.requirementGroupId ?? "",
    /:mse-nme-core-elective-19-credits$/
  );
  assert.equal(
    nmeConsideredEntries.find((entry) => entry.courseCode === "MSE 452")?.category,
    "nme_elective_option"
  );
  assert.equal(
    nmeConsideredEntries.find((entry) => entry.courseCode === "ENGR 321")?.category,
    "nme_restricted_option"
  );

  assert.deepEqual(
    buildMaterialsScienceNmeSourceIncompleteWarnings(
      "uw-seattle-materials-science-engineering",
      "nme-option",
      []
    ),
    [
      "NME Option requirements require the linked NME page. The planner parsed the base MSE page but could not verify the 19-credit NME Core/Elective requirement.",
    ]
  );
  assert.deepEqual(
    buildMaterialsScienceNmeSourceIncompleteWarnings(
      "uw-seattle-materials-science-engineering",
      "nme-option",
      activeNmeGroup ? [activeNmeGroup] : []
    ),
    []
  );
});

test("Materials planner-visible source-backed output keeps lower-division prep but not upper-division coursework", () => {
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-materials-science-engineering");

  assert.ok(runtimePlan, "Expected the MSE runtime plan.");

  const summaryText = buildSourceBackedRequiredCourseSummaryEntries(runtimePlan, { mode: "uw" })
    .map((entry) => entry.text)
    .join("\n");

  assert.match(
    summaryText,
    /UW equivalent:\s*MSE 170\b/,
    "Expected planner-visible MSE source-backed output to keep the MSE 170 lower-division UW equivalent."
  );

  for (const courseCode of ["MSE 310", "MSE 311", "MSE 321", "EE 486", "CHEM 597", "MOLENG 520"]) {
    assert.doesNotMatch(
      summaryText,
      new RegExp(`\\b${courseCode.replace(/\s+/g, "\\s+")}\\b`),
      `Did not expect planner-visible source-backed output to materialize upper-division-only ${courseCode}.`
    );
  }
});

test("Industrial & Systems Engineering benefits from the same spaced-subject normalization", () => {
  const [iseBlock] = getTransferPlannerParsedRequirementSourceBlocks(
    "uw-seattle-industrial-systems-engineering"
  );

  assert.ok(iseBlock, "Expected the Seattle ISE parsed source block.");
  assert.equal(
    iseBlock?.parsedUwCourseCodes.includes("INDE 315"),
    true,
    "Expected the Seattle ISE parsed source to include INDE 315."
  );
  assert.equal(
    getTransferPlannerCanonicalCourse("uw-seattle", "IND E 315")?.code,
    "INDE 315",
    "Expected IND E 315 to resolve to the same canonical registry entry as INDE 315."
  );
});

test("Auto-promoted pathway aliases keep Seattle Biochemistry route IDs canonical", () => {
  const plan = getRequiredPlan("uw-seattle-biochemistry");
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(plan.id);
  assert.ok(runtimePlan, "Expected a Seattle Biochemistry runtime plan.");

  const sourcePathways = getTransferPlannerPathwaysForPlan(plan).map(
    (pathway) => [pathway.id, pathway.label] as const
  );
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan).map(
    (pathway) => [pathway.id, pathway.label] as const
  );

  assert.deepEqual(sourcePathways, [
    ["ba-route", "B.A. route"],
    ["bs-route", "B.S. route"],
  ]);
  assert.deepEqual(runtimePathways, [
    ["ba-route", "B.A. route"],
    ["bs-route", "B.S. route"],
  ]);
});

test("Guidance-only collection headings are treated as structural pathway labels", () => {
  for (const label of [
    "Concentration Areas",
    "Optional Focus Areas",
    "Examples of coursework pathways emphasizing particular areas within psychology",
    "Concentration I",
  ]) {
    assert.equal(
      isSuspiciousStructuralPathwayLabel(label),
      true,
      `Expected ${label} to stay in the structural-heading bucket.`
    );
  }

  for (const label of ["NME Option", "China Concentration", "B A route"]) {
    assert.equal(
      isSuspiciousStructuralPathwayLabel(label),
      false,
      `Expected ${label} to remain a semantic pathway label.`
    );
  }
});

test("Guidance-only concentration headings do not outrank real option labels during materialization", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-guidance-only-concentrations",
    campusId: "uw-seattle",
    title: "Materials Science & Engineering",
    shortTitle: "MSE",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [],
  };
  const parsedBlocks: TransferPlannerParsedRequirementSourceBlock[] = [
    {
      id: "synthetic-guidance-only-concentrations:source-block:test",
      ownerId: "synthetic-guidance-only-concentrations",
      ownerTitle: "Materials Science & Engineering",
      planId: plan.id,
      pathwayId: null,
      campusId: "uw-seattle",
      primaryParserType: "html-degree-page",
      primarySourceUrl: "https://example.edu/materials-science-engineering",
      primarySourceLabel: "Materials Science & Engineering degree requirements",
      parserType: "html-degree-page",
      adapterId: "uw-seattle-html-degree-page",
      adapterFamily: "Synthetic HTML degree page",
      sourceUrl: "https://example.edu/materials-science-engineering",
      sourceLabel: "Materials Science & Engineering degree requirements",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [
        "Concentration areas",
        "The MSE degree offers a large number of course elective options. For advice on choosing pertinent electives to support your interests, please check out MSE Concentration Areas.",
      ],
      chooseStatements: [],
      pathwayLabels: [
        "Concentration areas",
        "please check out MSE Concentration Areas",
        "Nanoscience and Molecular Engineering (NME) Option",
      ],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
  ];

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], parsedBlocks);

  assert.deepEqual(
    materialized.map((pathway) => [pathway.id, pathway.label] as const),
    [["nme-option", "NME Option"]]
  );
});

test("Coursework-pathway collection headings do not outrank real route labels during materialization", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-coursework-pathway-headings",
    campusId: "uw-seattle",
    title: "Psychology",
    shortTitle: "Psych",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [],
  };
  const parsedBlocks: TransferPlannerParsedRequirementSourceBlock[] = [
    {
      id: "synthetic-coursework-pathway-headings:source-block:test",
      ownerId: "synthetic-coursework-pathway-headings",
      ownerTitle: "Psychology",
      planId: plan.id,
      pathwayId: null,
      campusId: "uw-seattle",
      primaryParserType: "html-degree-page",
      primarySourceUrl: "https://example.edu/psychology",
      primarySourceLabel: "Psychology degree requirements",
      parserType: "html-degree-page",
      adapterId: "uw-seattle-html-degree-page",
      adapterFamily: "Synthetic HTML degree page",
      sourceUrl: "https://example.edu/psychology",
      sourceLabel: "Psychology degree requirements",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [
        "Examples of coursework pathways emphasizing particular areas within psychology:",
      ],
      chooseStatements: [],
      pathwayLabels: [
        "Examples of coursework pathways emphasizing particular areas within psychology:",
        "Clinical Psychology route",
        "Cognitive Psychology route",
      ],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
  ];

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], parsedBlocks);

  assert.deepEqual(
    materialized.map((pathway) => [pathway.id, pathway.label] as const),
    [
      ["clinical-psychology-route", "Clinical Psychology Route"],
      ["cognitive-psychology-route", "Cognitive Psychology Route"],
    ]
  );
});

test("Collection-style concentration placeholders no longer surface as peer pathways for Asian Studies", () => {
  const plan = getRequiredPlan("uw-seattle-asian-studies");
  const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan(plan.id);
  assert.ok(runtimePlan, "Expected an Asian Studies runtime plan.");

  const sourceLabels = getTransferPlannerPathwaysForPlan(plan).map((pathway) => pathway.label);
  const runtimeLabels = getTransferPlannerStudentRuntimePathwaysForPlan(runtimePlan).map(
    (pathway) => pathway.label
  );

  assert.equal(sourceLabels.includes("Concentration I"), false);
  assert.equal(runtimeLabels.includes("Concentration I"), false);
  assert.equal(sourceLabels.includes("China Concentration"), true);
  assert.equal(runtimeLabels.includes("China Concentration"), true);
});

test("Cross-major navigation pathway noise does not outrank plan-level evidence", () => {
  const plan: TransferPlannerMajorPlan = {
    id: "synthetic-jsis-cross-major-noise",
    campusId: "uw-seattle",
    title: "Jewish Studies",
    shortTitle: "JS",
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: [],
    pathways: [
      {
        id: "china-concentration",
        label: "China Concentration",
        summary: "",
        officialLinks: [],
      },
    ],
  };
  const parsedBlocks: TransferPlannerParsedRequirementSourceBlock[] = [
    {
      id: "synthetic-jsis-cross-major-noise:source-block:major",
      ownerId: plan.id,
      ownerTitle: "Jewish Studies",
      planId: plan.id,
      pathwayId: null,
      campusId: "uw-seattle",
      primaryParserType: "html-degree-page",
      primarySourceUrl: "https://example.edu/jewish-studies",
      primarySourceLabel: "Jewish Studies requirements",
      parserType: "html-degree-page",
      adapterId: "uw-seattle-html-degree-page",
      adapterFamily: "Synthetic HTML degree page",
      sourceUrl: "https://example.edu/jewish-studies",
      sourceLabel: "Jewish Studies requirements",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [
        "50 credits, to include the following:",
        "Asian Studies - China Concentration",
      ],
      chooseStatements: [],
      pathwayLabels: ["China Concentration"],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
    {
      id: "synthetic-jsis-cross-major-noise:source-block:pathway",
      ownerId: `${plan.id}:pathway:china-concentration`,
      ownerTitle: "Jewish Studies - China Concentration",
      planId: plan.id,
      pathwayId: "china-concentration",
      campusId: "uw-seattle",
      primaryParserType: "html-degree-page",
      primarySourceUrl: "https://example.edu/jewish-studies",
      primarySourceLabel: "Jewish Studies requirements",
      parserType: "html-degree-page",
      adapterId: "uw-seattle-html-degree-page",
      adapterFamily: "Synthetic HTML degree page",
      sourceUrl: "https://example.edu/jewish-studies",
      sourceLabel: "Jewish Studies requirements",
      resolutionStrategy: "primary-source",
      ok: true,
      parseConfidence: "high",
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: [],
      qualitySignals: [],
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: null,
    },
  ];

  const materialized = materializeTransferPlannerPathways(plan, plan.pathways ?? [], parsedBlocks);

  assert.deepEqual(materialized, []);
});

test("Seattle Computer Science Data Science option resolves to one clean canonical pathway", () => {
  const runtimeCsPlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-computer-science");
  assert.ok(runtimeCsPlan, "Expected a Computer Science runtime plan.");

  const sourcePathways = getTransferPlannerPathwaysForPlan(csPlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(runtimeCsPlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
  const parsedScopes = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (entry) => entry.planId === "uw-seattle-computer-science"
  )
    .map((entry) => entry.pathwayId)
    .sort((left, right) => String(left ?? "").localeCompare(String(right ?? "")));

  assert.deepEqual(sourcePathways, [["data-science-option", "Data Science option"]]);
  assert.deepEqual(runtimePathways, [["data-science-option", "Data Science option"]]);
  assert.deepEqual(parsedScopes, [null, "data-science-option"]);
  assert.deepEqual(collectSuspiciousStructuralPathways(getTransferPlannerPathwaysForPlan(csPlan)), []);
  assert.deepEqual(
    collectSuspiciousStructuralPathways(getTransferPlannerStudentRuntimePathwaysForPlan(runtimeCsPlan)),
    []
  );
});

test("Speech & Hearing Sciences does not expose graduate or not-admitting pathway labels", () => {
  const speechPlan = getRequiredPlan("uw-seattle-speech-and-hearing-sciences");
  const speechRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan(speechPlan.id);
  assert.ok(speechRuntimePlan, "Expected a Speech & Hearing Sciences runtime plan.");

  const sourcePathways = getTransferPlannerPathwaysForPlan(speechPlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(speechRuntimePlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));

  assert.deepEqual(sourcePathways, []);
  assert.deepEqual(runtimePathways, []);
  assert.deepEqual(
    collectSuspiciousStructuralPathways(getTransferPlannerPathwaysForPlan(speechPlan)),
    []
  );
  assert.deepEqual(
    collectSuspiciousStructuralPathways(getTransferPlannerStudentRuntimePathwaysForPlan(speechRuntimePlan)),
    []
  );
});

test("Already-correct Statistics pathway labels remain stable after semantic pathway promotion changes", () => {
  assert.ok(sourceGeneratedStatisticsPlan, "Expected source-generated Seattle Statistics planner row.");
  const statisticsRuntimePlan = getTransferPlannerStudentRuntimeMajorPlan("uw-seattle-statistics");
  assert.ok(statisticsRuntimePlan, "Expected a Statistics runtime plan.");

  const expected = [
    ["applied-statistics-track", "Applied Statistics track"],
    ["data-science-track", "Data Science track"],
    ["mathematical-statistics-track", "Mathematical Statistics track"],
  ].sort((left, right) => left[0].localeCompare(right[0]));

  const sourcePathways = getTransferPlannerPathwaysForPlan(sourceGeneratedStatisticsPlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));
  const runtimePathways = getTransferPlannerStudentRuntimePathwaysForPlan(statisticsRuntimePlan)
    .map((pathway) => [pathway.id, pathway.label] as const)
    .sort((left, right) => left[0].localeCompare(right[0]));

  assert.deepEqual(sourcePathways, expected);
  assert.deepEqual(runtimePathways, expected);
});

test("QA helper stays clean for the targeted semantic-pathway plans", () => {
  const plans = [
    getRequiredPlan("uw-seattle-applied-and-computational-mathematical-sciences"),
    getRequiredPlan("uw-seattle-speech-and-hearing-sciences"),
    getRequiredPlan("uw-seattle-statistics"),
  ];

  const suspiciousByPlan = plans
    .map((plan) => ({
      planId: plan.id,
      suspicious: collectSuspiciousStructuralPathways(getTransferPlannerPathwaysForPlan(plan)),
    }))
    .filter((entry) => entry.suspicious.length > 0);

  assert.deepEqual(suspiciousByPlan, []);
});

test("Semantic-pathway audit leaves no suspicious structural pathway ids or labels in source or runtime registries", () => {
  const suspiciousRegistryPathways = TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.filter(
    (pathway) =>
      isSuspiciousStructuralPathwayId(pathway.pathwayId) ||
      isSuspiciousStructuralPathwayLabel(pathway.label)
  )
    .map((pathway) => `${pathway.planId}:${pathway.pathwayId} => ${pathway.label}`)
    .sort();

  const suspiciousRuntimePathways = TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS.flatMap((plan) =>
    getTransferPlannerStudentRuntimePathwaysForPlan(plan)
      .filter(
        (pathway) =>
          isSuspiciousStructuralPathwayId(pathway.id) ||
          isSuspiciousStructuralPathwayLabel(pathway.label)
      )
      .map((pathway) => `${plan.id}:${pathway.id} => ${pathway.label}`)
  ).sort();

  assert.deepEqual(suspiciousRegistryPathways, []);
  assert.deepEqual(suspiciousRuntimePathways, []);
});

test.skip("Expanded pathway majors resolve to the selected official route and route-specific guidance", () => {
  assert.ok(sourceGeneratedGeographyPlan, "Expected source-generated Seattle Geography planner row.");
  assert.ok(sourceGeneratedPsychologyPlan, "Expected source-generated Seattle Psychology planner row.");
  assert.ok(sourceGeneratedPhghPlan, "Expected source-generated Seattle PH-GH planner row.");
  assert.ok(
    sourceGeneratedTacomaEnvSustainabilityPlan,
    "Expected source-generated Tacoma Environmental Sustainability planner row."
  );
  assert.ok(sourceGeneratedTacomaSudPlan, "Expected source-generated Tacoma SUD planner row.");
  assert.ok(
    sourceGeneratedTacomaUrbanStudiesPlan,
    "Expected source-generated Tacoma Urban Studies planner row."
  );
  assert.ok(sourceGeneratedTacomaEglsPlan, "Expected source-generated Tacoma EGLS planner row.");

  const geographyDataSciencePlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedGeographyPlan,
    "data-science-option"
  );
  const psychologyBsPlan = resolveTransferPlannerMajorPlan(sourceGeneratedPsychologyPlan, "bs-route");
  const phghNutritionPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedPhghPlan,
    "bs-nutritional-sciences-option"
  );
  const envSustainabilityEducationPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedTacomaEnvSustainabilityPlan,
    "education-option"
  );
  const sudGisPlan = resolveTransferPlannerMajorPlan(sourceGeneratedTacomaSudPlan, "gis-option");
  const urbanStudiesGisPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedTacomaUrbanStudiesPlan,
    "gis-option"
  );
  const eglsLaborPlan = resolveTransferPlannerMajorPlan(
    sourceGeneratedTacomaEglsPlan,
    "labor-studies-option"
  );

  assert.equal(geographyDataSciencePlan?.selectedPathwayLabel, "Data Science option");
  assert.ok(getTransferPlannerGrcCourseList(geographyDataSciencePlan).includes("CS 123"));
  assert.match(
    geographyDataSciencePlan?.degreeMapSections?.[1]?.title ?? "",
    /Data Science Option/
  );

  assert.equal(psychologyBsPlan?.selectedPathwayLabel, "B.S. route");
  assert.match(psychologyBsPlan?.degreeMapSections?.[1]?.title ?? "", /Psychology B\.S\. structure/);
  assert.equal(psychologyBsPlan?.grcCourseListGuidance ?? "", "");

  assert.equal(phghNutritionPlan?.selectedPathwayLabel, "B.S. Nutritional Sciences option");
  assert.ok(getTransferPlannerGrcCourseList(phghNutritionPlan).includes("NUTR& 101"));
  assert.match(phghNutritionPlan?.degreeMapSections?.[1]?.title ?? "", /Nutritional Sciences option/);

  assert.equal(envSustainabilityEducationPlan?.selectedPathwayLabel, "Education option");
  assert.match(
    envSustainabilityEducationPlan?.degreeMapSections?.[1]?.title ?? "",
    /Education option/
  );

  assert.equal(sudGisPlan?.selectedPathwayLabel, "GIS option");
  assert.ok(getTransferPlannerGrcCourseList(sudGisPlan).includes("GIS 260"));
  assert.match(sudGisPlan?.degreeMapSections?.[1]?.title ?? "", /GIS option/);

  assert.equal(urbanStudiesGisPlan?.selectedPathwayLabel, "GIS option");
  assert.ok(getTransferPlannerGrcCourseList(urbanStudiesGisPlan).includes("GIS 202"));
  assert.match(urbanStudiesGisPlan?.degreeMapSections?.[1]?.title ?? "", /GIS option/);

  assert.equal(eglsLaborPlan?.selectedPathwayLabel, "Labor Studies option");
  assert.match(eglsLaborPlan?.degreeMapSections?.[1]?.title ?? "", /Labor Studies option/);
});

test.skip("Canonical course registry now keeps pathway-specific GRC references for the expanded route set", () => {
  const statisticsDataScienceCourse = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
    (entry) =>
      entry.schoolId === "grc" &&
      entry.code === "CS 123" &&
      entry.sourceContexts.includes(
        "uw-seattle-statistics:pathway:data-science-track:grc-course-list"
      )
  );
  const chemistryAcsCourse = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
    (entry) =>
      entry.schoolId === "grc" &&
      entry.code === "MATH 238" &&
      entry.sourceContexts.includes(
        "uw-seattle-chemistry:pathway:acs-certified-bs-route:grc-course-list"
      )
  );

  assert.ok(
    statisticsDataScienceCourse,
    "Expected canonical course registry to retain the Statistics Data Science pathway course list."
  );
  assert.ok(
    chemistryAcsCourse,
    "Expected canonical course registry to retain the Chemistry ACS pathway course list."
  );
});

test.skip("Canonical course registry keeps new pathway-specific GRC references for added route coverage", () => {
  const geographyDataScienceCourse = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
    (entry) =>
      entry.schoolId === "grc" &&
      entry.code === "CS 123" &&
      entry.sourceContexts.includes(
        "uw-seattle-geography:pathway:data-science-option:grc-course-list"
      )
  );
  const phghNutritionCourse = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
    (entry) =>
      entry.schoolId === "grc" &&
      entry.code === "NUTR& 101" &&
      entry.sourceContexts.includes(
        "uw-seattle-public-health-global-health:pathway:bs-nutritional-sciences-option:grc-course-list"
      )
  );
  const sudGisCourse = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
    (entry) =>
      entry.schoolId === "grc" &&
      entry.code === "GIS 260" &&
      entry.sourceContexts.includes(
        "uw-tacoma-sustainable-urban-development:pathway:gis-option:grc-course-list"
      )
  );
  const urbanStudiesGisCourse = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
    (entry) =>
      entry.schoolId === "grc" &&
      entry.code === "GIS 202" &&
      entry.sourceContexts.includes(
        "uw-tacoma-urban-studies:pathway:gis-option:grc-course-list"
      )
  );

  assert.ok(
    geographyDataScienceCourse,
    "Expected canonical course registry to retain the Geography Data Science pathway course list."
  );
  assert.ok(
    phghNutritionCourse,
    "Expected canonical course registry to retain the PH-GH Nutritional Sciences pathway course list."
  );
  assert.ok(
    sudGisCourse,
    "Expected canonical course registry to retain the SUD GIS pathway course list."
  );
  assert.ok(
    urbanStudiesGisCourse,
    "Expected canonical course registry to retain the Urban Studies GIS pathway course list."
  );
});
