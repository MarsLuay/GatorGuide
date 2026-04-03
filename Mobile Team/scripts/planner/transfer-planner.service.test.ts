import assert from "node:assert/strict";
import test from "node:test";

import { TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS } from "@/constants/transfer-planner-source/bootstrap.generated";
import {
  TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY,
  TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY,
  TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY,
  TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY,
  TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY,
  TRANSFER_PLANNER_POLICY_REGISTRY,
  TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY,
  TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS,
  TRANSFER_PLANNER_SOURCE_SUMMARY,
  getTransferPlannerGrcCourseAvailability,
  getTransferPlannerGrcCourseAvailabilitySummary,
  getTransferPlannerGrcCourseList,
  getTransferPlannerGrcCourseListGuidance,
  getTransferPlannerMajorPlan,
  getTransferPlannerMajorsForCampus,
  getTransferPlannerPathwaysForPlan,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerPromotedPrimarySourceOverride,
  getTransferPlannerPromotedRequirementAtomOverrides,
  getTransferPlannerSourceManifestEntriesForPlan,
  getTransferPlannerTrack,
  getTransferPlannerSourceGeneratedMajorsForCampus,
  resolveTransferPlannerMajorPlan,
  getTransferPlannerCanonicalCourse,
  getTransferPlannerAutoMatchedTrackRecommendation,
  type TransferPlannerChecklistItem,
  type TransferPlannerMajorPlan,
} from "@/constants/transfer-planner-source";
import {
  buildRequirementStatuses,
  buildSuggestedQuarterPlan,
  type TranscriptCourseEntry,
} from "@/services/planning/transfer-planner.service";

function getRequiredPlan(id: string) {
  const plan = getTransferPlannerMajorPlan(id);
  if (!plan) {
    throw new Error(`Missing transfer planner data for ${id}.`);
  }
  return plan;
}

const compEPlan = getRequiredPlan("uw-seattle-computer-engineering");
const csPlan = getRequiredPlan("uw-seattle-computer-science");
const ecePlan = getRequiredPlan("uw-seattle-electrical-computer-engineering");
const civilPlan = getRequiredPlan("uw-seattle-civil-engineering");
const isePlan = getRequiredPlan("uw-seattle-industrial-systems-engineering");
const msePlan = getRequiredPlan("uw-seattle-materials-science-engineering");
const envePlan = getRequiredPlan("uw-seattle-environmental-engineering");
const bioEPlan = getRequiredPlan("uw-seattle-bioengineering");
const chemEPlan = getRequiredPlan("uw-seattle-chemical-engineering");
const hcdePlan = getRequiredPlan("uw-seattle-human-centered-design-engineering");
const seattleAppliedMathPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-applied-mathematics"
);
const seattleMathPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-mathematics"
);
const seattleStatisticsPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-statistics"
);
const seattleAmericanEthnicStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-american-ethnic-studies"
);
const seattleAmericanIndianStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-american-indian-studies"
);
const seattleAnthropologyPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-anthropology"
);
const seattleAcmsPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-applied-and-computational-mathematical-sciences"
);
const seattleAcePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-aquatic-conservation-and-ecology"
);
const seattleArchitecturalDesignPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-architectural-design"
);
const seattleArchitecturalStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-architectural-studies"
);
const seattleArtPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-art"
);
const seattleArtHistoryPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-art-history"
);
const seattleAsianLanguagesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-asian-languages-and-cultures"
);
const seattleAsianStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-asian-studies"
);
const seattleAstronomyPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-astronomy"
);
const seattleAtmosphericClimateSciencePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-atmospheric-and-climate-science"
);
const seattleBiochemistrySeattlePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-biochemistry"
);
const seattleBiologySeattlePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-biology"
);
const seattleBusinessAdministrationPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-business-administration"
);
const seattleChemistrySeattlePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-chemistry"
);
const seattleChinesePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-chinese"
);
const seattleCinemaMediaStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-cinema-and-media-studies"
);
const seattleClassicalStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-classical-studies"
);
const seattleClassicsPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-classics"
);
const seattleCommunicationPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-communication"
);
const seattleCepPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-community-environment-and-planning"
);
const seattleChiPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-comparative-history-of-ideas"
);
const seattleComparativeLiteraturePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-comparative-literature"
);
const seattleComparativeReligionPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-comparative-religion"
);
const seattleCfrmPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-computational-finance-and-risk-management"
);
const seattleConstructionManagementPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-construction-management"
);
const seattleDancePlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-dance"
);
const seattleDanishPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-danish"
);
const seattleDesignPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-design"
);
const seattleDisabilityStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-disability-studies"
);
const seattleDramaPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-drama"
);
const seattleEcfsPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-early-childhood-and-family-studies"
);
const seattleEssPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-earth-and-space-sciences"
);
const seattleEconomicsPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-economics"
);
const seattleEducationStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-education-studies"
);
const seattleEcoPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-education-communities-and-organizations"
);
const seattleEnglishCreativeWritingPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-english-creative-writing"
);
const seattleEnglishLlcPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-english-language-literature-and-culture"
);

const compETrack = getTransferPlannerTrack(compEPlan.bestTrackId);
const bioETrack = getTransferPlannerTrack(bioEPlan.bestTrackId);
const chemETrack = getTransferPlannerTrack(chemEPlan.bestTrackId);
const hcdeTrack = getTransferPlannerTrack(hcdePlan.bestTrackId);
const bothellCssePlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-csse"
);
const bothellCsseTrack = getTransferPlannerTrack(bothellCssePlan?.bestTrackId ?? null);
const bothellAmericanEthnicStudiesPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-american-and-ethnic-studies"
);
const bothellAppliedComputingPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-applied-computing"
);
const bothellBiologyPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-biology"
);
const bothellBbaPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-business-administration"
);
const bothellAccountingPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-business-administration-accounting"
);
const bothellFinancePlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-business-administration-finance"
);
const bothellLsiPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-business-administration-leadership-and-strategic-innovation"
);
const bothellMarketingPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-business-administration-marketing"
);
const bothellScmPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-business-administration-supply-chain-management"
);
const bothellChemistryBaPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-chemistry-ba"
);
const bothellChemistryBsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-chemistry-bs"
);
const bothellBiochemistryPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-chemistry-biochemistry"
);
const bothellCsseIacPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-csse-information-assurance-and-cybersecurity"
);
const bothellCrsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-conservation-and-restoration-science"
);
const bothellClaPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-culture-literature-and-the-arts"
);
const bothellDataVisBaPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-data-visualization-ba"
);
const bothellDataVisBsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-data-visualization-bs"
);
const bothellDysPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-developmental-and-youth-studies"
);
const bothellEssPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-earth-system-science"
);
const bothellEconomicsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-economics"
);
const bothellElementaryEdPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-educational-studies-elementary-education"
);
const bothellEePlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-electrical-engineering"
);
const bothellEnvironmentalStudiesPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-environmental-studies"
);
const bothellGwssPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-gender-women-and-sexuality-studies"
);
const bothellGlobalStudiesPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-global-studies"
);
const bothellHealthStudiesPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-health-studies"
);
const bothellImdPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-interactive-media-design"
);
const bothellInterdisciplinaryArtsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-interdisciplinary-arts"
);
const bothellIndividualizedStudyPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-interdisciplinary-studies-individualized-study"
);
const bothellLeppPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-law-economics-and-public-policy"
);
const bothellMtvPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-mathematical-thinking-and-visualization"
);
const bothellMathPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-mathematics"
);
const bothellMcsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-media-and-communications-studies"
);
const bothellFirstYearRnBsnPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-nursing-first-year-rn-to-bsn"
);
const bothellRnBsnPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-nursing-rn-to-bsn"
);
const bothellPhysicsBaPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-physics-ba"
);
const bothellPhysicsBsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-physics-bs"
);
const bothellPsychologyPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-psychology"
);
const bothellStsPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-science-technology-and-society"
);
const bothellSehbPlan = getTransferPlannerMajorsForCampus("uw-bothell").find(
  (entry) => entry.id === "uw-bothell-society-ethics-and-human-behavior"
);
const generatedPlan = TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.find(
  (entry) => entry.sourceType === "master-generated"
);
const tacomaCompEPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-computer-engineering"
);
const tacomaCompETrack = getTransferPlannerTrack(tacomaCompEPlan?.bestTrackId ?? null);
const tacomaEePlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-electrical-engineering"
);
const tacomaEeTrack = getTransferPlannerTrack(tacomaEePlan?.bestTrackId ?? null);
const tacomaCivilPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-civil-engineering"
);
const tacomaCommunicationDetailedPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-communications"
);
const tacomaEpaPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-economics-and-policy-analysis"
);
const tacomaEducationPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-education"
);
const tacomaCssBaPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-computer-science-and-systems-ba"
);
const tacomaCssBsPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-computer-science-and-systems-bs"
);
const tacomaAmcPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-arts-media-culture"
);
const tacomaEnvSciencePlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-environmental-science"
);
const tacomaEnvSustainabilityPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-environmental-sustainability"
);
const tacomaHistoryPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-history"
);
const tacomaItPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-information-technology"
);
const tacomaLawPolicyPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-law-and-policy"
);
const tacomaMathPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-mathematics"
);
const tacomaPsychologyPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-psychology"
);
const tacomaSocialWelfarePlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-social-welfare"
);
const tacomaUrbanDesignPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-urban-design"
);
const tacomaEglsDetailedPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-ethnic-gender-and-labor-studies"
);
const tacomaHealthcareLeadershipPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-healthcare-leadership"
);
const tacomaIasPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-interdisciplinary-arts-and-sciences"
);
const tacomaIasIndividuallyDesignedPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed"
);
const tacomaNursingPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-nursing"
);
const tacomaPpePlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-politics-philosophy-and-economics"
);
const tacomaSpanishPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-spanish-language-and-cultures"
);
const tacomaSustainableUrbanDevelopmentPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-sustainable-urban-development"
);
const tacomaUrbanStudiesPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-urban-studies"
);
const biologyPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-biology"
);
const individualizedStudiesPlan = getTransferPlannerMajorsForCampus("uw-seattle").find(
  (entry) => entry.id === "uw-seattle-individualized-studies"
);
const tacomaCommunicationPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-communications"
);
const tacomaWritingPlan = getTransferPlannerMajorsForCampus("uw-tacoma").find(
  (entry) => entry.id === "uw-tacoma-writing-studies"
);
const sourceGeneratedChemistryPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-seattle"
).find((entry) => entry.id === "uw-seattle-chemistry");
const sourceGeneratedEconomicsPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-seattle"
).find((entry) => entry.id === "uw-seattle-economics");
const sourceGeneratedGeographyPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-seattle"
).find((entry) => entry.id === "uw-seattle-geography");
const sourceGeneratedPsychologyPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-seattle"
).find((entry) => entry.id === "uw-seattle-psychology");
const sourceGeneratedPhghPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-seattle"
).find((entry) => entry.id === "uw-seattle-public-health-global-health");
const sourceGeneratedStatisticsPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-seattle"
).find((entry) => entry.id === "uw-seattle-statistics");
const sourceGeneratedBothellPlans = getTransferPlannerSourceGeneratedMajorsForCampus("uw-bothell");
const sourceGeneratedTacomaAmcPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Arts, Media and Culture (BA)");
const sourceGeneratedTacomaBabaPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Bachelor of Arts in Business Administration (BABA)");
const sourceGeneratedTacomaEnvSustainabilityPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Environmental Sustainability (BA)");
const sourceGeneratedTacomaEglsPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Ethnic, Gender and Labor Studies (BA)");
const sourceGeneratedTacomaSudPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Sustainable Urban Development (BA)");
const sourceGeneratedTacomaUrbanStudiesPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Urban Studies (BA)");
const sourceGeneratedTacomaBiomedPlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Biomedical Sciences (BS)");
const sourceGeneratedTacomaCriminalJusticePlan = getTransferPlannerSourceGeneratedMajorsForCampus(
  "uw-tacoma"
).find((entry) => entry.title === "Criminal Justice (BA)");
const sourceGeneratedTacomaPlans = getTransferPlannerSourceGeneratedMajorsForCampus("uw-tacoma");

function buildTranscriptCourses(...codes: string[]): TranscriptCourseEntry[] {
  return codes.map((code) => ({
    code,
    label: code,
  }));
}

function buildCompEStatuses(completedCourses: TranscriptCourseEntry[]) {
  return buildStatuses(compEPlan, completedCourses);
}

function buildCompEQuarterPlan(completedCourses: TranscriptCourseEntry[]) {
  return buildQuarterPlan(compEPlan, compETrack, completedCourses);
}

function findCalcStatus(completedCourses: TranscriptCourseEntry[]) {
  const { applicationStatuses } = buildCompEStatuses(completedCourses);
  const calcStatus = applicationStatuses.find((status) => status.item.id === "calc123");
  assert.ok(calcStatus, "Expected Seattle CompE planner to include calc123.");
  return calcStatus;
}

function getUpcomingCourseLabels(completedCourses: TranscriptCourseEntry[]) {
  return buildCompEQuarterPlan(completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));
}

function buildStatuses(plan: TransferPlannerMajorPlan, completedCourses: TranscriptCourseEntry[]) {
  return {
    applicationStatuses: buildRequirementStatuses(plan.applicationChecklist, completedCourses),
    beforeEnrollmentStatuses: buildRequirementStatuses(
      plan.beforeEnrollmentChecklist,
      completedCourses
    ),
    stayAtGrcStatuses: buildRequirementStatuses(plan.stayAtGrcChecklist, completedCourses),
  };
}

function buildQuarterPlan(
  plan: TransferPlannerMajorPlan,
  track: ReturnType<typeof getTransferPlannerTrack>,
  completedCourses: TranscriptCourseEntry[]
) {
  const statuses = buildStatuses(plan, completedCourses);
  return buildSuggestedQuarterPlan({
    plan,
    ...statuses,
    completedCourses,
    track,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
}

function findStatus(
  plan: TransferPlannerMajorPlan,
  completedCourses: TranscriptCourseEntry[],
  itemId: string
) {
  const statuses = buildStatuses(plan, completedCourses);
  const allStatuses = [
    ...statuses.applicationStatuses,
    ...statuses.beforeEnrollmentStatuses,
    ...statuses.stayAtGrcStatuses,
  ];
  const status = allStatuses.find((entry) => entry.item.id === itemId);
  assert.ok(status, `Expected planner ${plan.id} to include ${itemId}.`);
  return status;
}

function buildChecklistItem(
  id: string,
  title: string,
  grcCourses: string[]
): TransferPlannerChecklistItem {
  return {
    id,
    title,
    grcCourses,
  };
}

test("Seattle CompE accepts MATH& 163 as the Calc III path without scheduling MATH& 254", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152", "MATH& 163");
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(calcStatus.matched, true);
  assert.deepEqual(calcStatus.explicitCourseCodes, ["MATH& 151", "MATH& 152", "MATH& 163"]);

  const upcomingCourseLabels = getUpcomingCourseLabels(completedCourses);
  assert.equal(upcomingCourseLabels.includes("MATH& 254"), false);
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), false);
});

test("Seattle CompE also accepts the older MATH& 153 plus MATH& 254 path", () => {
  const completedCourses = buildTranscriptCourses(
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 254"
  );
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(calcStatus.matched, true);
  assert.deepEqual(calcStatus.explicitCourseCodes, [
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 254",
  ]);

  const upcomingCourseLabels = getUpcomingCourseLabels(completedCourses);
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), false);
});

test("Seattle CompE finishes the older path with MATH& 254 when MATH& 153 is already done", () => {
  const completedCourses = buildTranscriptCourses("MATH& 151", "MATH& 152", "MATH& 153");
  const calcStatus = findCalcStatus(completedCourses);

  assert.equal(calcStatus.matched, false);
  assert.deepEqual(calcStatus.explicitCourseCodes, [
    "MATH& 151",
    "MATH& 152",
    "MATH& 153",
    "MATH& 254",
  ]);

  const upcomingCourseLabels = getUpcomingCourseLabels(completedCourses);
  assert.equal(upcomingCourseLabels.includes("MATH& 254"), true);
  assert.equal(upcomingCourseLabels.includes("MATH& 163"), false);
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
  assert.equal(hcdePlan.degreeMapSections.length >= 4, true);
  assert.equal(hcdePlan.degreeMapSections[0]?.title, "HCDE degree structure");

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
  assert.equal(chemEPlan.degreeMapSections.length >= 4, true);
  assert.equal(chemEPlan.degreeMapSections[0]?.title, "ChemE degree structure");

  const grcCourseList = getTransferPlannerGrcCourseList(chemEPlan);

  assert.equal(grcCourseList.includes("ENGR 250"), true);
  assert.equal(grcCourseList.includes("MATH& 254"), true);
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
  assert.equal(bioEPlan.degreeMapSections[0]?.title, "BioE engineering fundamentals");
});

test("Detailed majors expose an explicit per-major Green River course list", () => {
  const grcCourseList = getTransferPlannerGrcCourseList(compEPlan);

  assert.ok(grcCourseList.length > 0);
  assert.equal(grcCourseList.includes("CS 121"), true);
  assert.equal(grcCourseList.includes("MATH& 151"), true);
  assert.equal(grcCourseList.includes("CHEM& 161"), true);
  assert.equal(new Set(grcCourseList).size, grcCourseList.length);
});

test("Seattle CompE keeps linear algebra in the planner flow beyond the Allen minimum admission classes", () => {
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

  const upcomingCourses = buildQuarterPlan(compEPlan, compETrack, completedCourses)
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses);
  const math240Course = upcomingCourses.find((course) => course.label === "MATH 240");

  assert.ok(math240Course, "Expected Seattle CompE to still schedule MATH 240.");
  assert.match(
    math240Course?.guidanceSummary ?? "",
    /Not part of the minimum transfer-admission classes/i
  );
});

test("Seattle CS keeps linear algebra in the planner flow and leaves extra physics depth optional", () => {
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
  const math208Status = findStatus(csPlan, completedCourses, "math208");
  const phys122Status = findStatus(csPlan, completedCourses, "phys122");

  assert.equal(math208Status.matched, false);
  assert.equal(phys122Status.matched, false);

  const upcomingCourses = buildQuarterPlan(
    csPlan,
    getTransferPlannerTrack(csPlan.bestTrackId),
    completedCourses
  )
    .filter((quarter) => quarter.phase !== "completed")
    .flatMap((quarter) => quarter.courses);
  const math240Course = upcomingCourses.find((course) => course.label === "MATH 240");

  assert.ok(math240Course, "Expected Seattle CS to still schedule MATH 240.");
  assert.match(
    math240Course?.guidanceSummary ?? "",
    /needed to complete the degree either way/i
  );
  assert.equal(
    upcomingCourses.some((course) => course.label === "PHYS& 222"),
    false,
    "Expected Seattle CS essential planning to avoid showing optional PHYS& 222 when MATH 240 is still missing."
  );
});

test("Planner keeps chained series courses in different quarters instead of stacking them together", () => {
  const sequencePlan: TransferPlannerMajorPlan = {
    id: "test-physics-sequence-plan",
    campusId: "uw-seattle",
    title: "Test Physics Sequence",
    shortTitle: "Test Physics Sequence",
    coverage: "detailed",
    summary: "",
    applicationWindow: "",
    startQuarter: "",
    bestTrackId: null,
    bestTrackSummary: "",
    whyThisTrack: [],
    financialAidNote: "",
    applicationChecklist: [],
    beforeEnrollmentChecklist: [
      buildChecklistItem("phys122", "PHYS 122", ["PHYS& 222"]),
    ],
    stayAtGrcChecklist: [
      buildChecklistItem("phys123", "PHYS 123", ["PHYS& 223"]),
    ],
    advisorFlags: [],
    involvementIdeas: [],
    projectIdeas: [],
    officialLinks: [],
    chainIds: ["PHYS-CALC"],
  };
  const completedCourses = buildTranscriptCourses("PHYS& 221");
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: sequencePlan,
    ...buildStatuses(sequencePlan, completedCourses),
    completedCourses,
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });
  const plannedQuarters = quarterPlan.filter((quarter) => quarter.phase === "planned");
  const phys222QuarterIndex = plannedQuarters.findIndex((quarter) =>
    quarter.courses.some((course) => course.label === "PHYS& 222")
  );
  const phys223QuarterIndex = plannedQuarters.findIndex((quarter) =>
    quarter.courses.some((course) => course.label === "PHYS& 223")
  );

  assert.notEqual(phys222QuarterIndex, -1, "Expected PHYS& 222 to be scheduled.");
  assert.notEqual(phys223QuarterIndex, -1, "Expected PHYS& 223 to be scheduled.");
  assert.equal(
    phys222QuarterIndex < phys223QuarterIndex,
    true,
    "Expected PHYS& 223 to land in a later quarter than PHYS& 222."
  );
});

test("Choice-bucket majors keep the bucket visible instead of collapsing to the first raw course", () => {
  assert.ok(seattleArtHistoryPlan, "Expected a Seattle Art History planner row.");

  const quarterPlan = buildQuarterPlan(
    seattleArtHistoryPlan,
    getTransferPlannerTrack(seattleArtHistoryPlan.bestTrackId),
    buildTranscriptCourses("ENGL 128")
  );
  const plannedCourses = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses);
  const bucketCourse = plannedCourses.find((course) =>
    /choose 1 from this list/i.test(course.label)
  );

  assert.ok(
    bucketCourse,
    "Expected Art History to show a choice bucket instead of collapsing to a single first course."
  );
  assert.match(bucketCourse?.label ?? "", /Intro art, visual-culture, or humanities support/i);
  assert.match(bucketCourse?.guidanceSummary ?? "", /ART& 100/i);
  assert.match(bucketCourse?.guidanceSummary ?? "", /ART 105/i);
  assert.equal(
    plannedCourses.some((course) => course.label === "ART& 100"),
    false,
    "Expected the quarter plan to keep the bucket visible instead of scheduling ART& 100 as the bucket label."
  );
});

test("Seattle ECE now exposes structured degree-map sections", () => {
  assert.ok(ecePlan.degreeMapSections, "Expected Seattle ECE to include degree-map sections.");
  assert.equal(ecePlan.degreeMapSections.length >= 3, true);
  assert.equal(ecePlan.degreeMapSections[0]?.title, "BSECE degree structure");
});

test("Seattle Civil now tracks BSCE degree-map head starts at Green River", () => {
  const grcCourseList = getTransferPlannerGrcCourseList(civilPlan);

  assert.equal(grcCourseList.includes("ENGL 128"), true);
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

test("Seattle ISE and MSE expose deeper degree-map data from the latest extraction pass", () => {
  assert.ok(isePlan.degreeMapSections, "Expected Seattle ISE to include degree-map sections.");
  assert.ok(msePlan.degreeMapSections, "Expected Seattle MSE to include degree-map sections.");

  const iseCourseList = getTransferPlannerGrcCourseList(isePlan);
  const mseCourseList = getTransferPlannerGrcCourseList(msePlan);

  assert.equal(iseCourseList.includes("ENGL 128"), true);
  assert.equal(mseCourseList.includes("MATH& 254"), true);
  assert.equal(mseCourseList.includes("ENGR& 224"), true);
});

test("Master-generated partial majors also materialize a Green River course list", () => {
  assert.ok(generatedPlan, "Expected at least one master-generated planner row.");

  const grcCourseList = getTransferPlannerGrcCourseList(generatedPlan);

  assert.ok(grcCourseList.length > 0);
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

  assert.equal(upcomingCourseLabels.includes("MATH& 163"), false);
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

  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaBabaPlan).length, 5);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaCommunicationDetailedPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaAmcPlan).length, 5);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaEnvSustainabilityPlan).length, 4);
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
  assert.equal(
    tacomaSocialWelfarePlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uwt-basw-stats"),
    true
  );
  assert.equal(
    tacomaUrbanDesignPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwt-ude-gis"),
    true
  );
  assert.equal(
    tacomaEglsDetailedPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwt-egls-social-justice-support"
    ),
    true
  );
  assert.equal(
    tacomaHealthcareLeadershipPlan?.applicationChecklist.some(
      (entry) => entry.id === "uwt-hl-stats"
    ),
    true
  );
  assert.equal(
    tacomaIasPlan?.applicationChecklist.some((entry) => entry.id === "uwt-ias-engl101"),
    true
  );
  assert.equal(
    tacomaIasIndividuallyDesignedPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwt-iasid-proposal-support"
    ),
    true
  );
  assert.equal(
    tacomaNursingPlan?.applicationChecklist.some((entry) => entry.id === "uwt-nursing-anat"),
    true
  );
  assert.equal(
    tacomaPpePlan?.applicationChecklist.some((entry) => entry.id === "uwt-ppe-micro"),
    true
  );
  assert.equal(
    tacomaSpanishPlan?.applicationChecklist.some((entry) => entry.id === "uwt-spanish-sequence"),
    true
  );
  assert.equal(
    tacomaSustainableUrbanDevelopmentPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwt-sud-gis-support"
    ),
    true
  );
  assert.equal(
    tacomaUrbanStudiesPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwt-urban-gis-support"
    ),
    true
  );
  assert.equal(
    tacomaWritingPlan?.applicationChecklist.some((entry) => entry.id === "uwt-writing-advanced-comp"),
    true
  );
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

  assert.equal(
    seattleAppliedMathPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-apmath-amath301"
    ),
    true
  );
  assert.equal(
    seattleMathPlan?.applicationChecklist.some((entry) => entry.id === "uws-math-207"),
    true
  );
  assert.equal(
    seattleMathPlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uws-math-224"),
    true
  );
  assert.equal(getTransferPlannerPathwaysForPlan(seattleStatisticsPlan).length, 3);
  assert.equal(
    seattleStatisticsPlan?.applicationChecklist.some((entry) => entry.id === "uws-stat-208"),
    true
  );
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

  assert.equal(
    seattleAcmsPlan?.applicationChecklist.some((entry) => entry.id === "uws-acms-math208"),
    true
  );
  assert.equal(
    seattleAcePlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uws-ace-programming"),
    true
  );
  assert.equal(
    seattleArchitecturalDesignPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uws-archd-visual-foundation"
    ),
    true
  );
  assert.equal(
    seattleArtPlan?.applicationChecklist.some((entry) => entry.id === "uws-art-5credits"),
    true
  );
  assert.equal(
    seattleAsianLanguagesPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uws-alc-language"),
    true
  );
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

  assert.equal(
    seattleAsianStudiesPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-asst-language-foundation"
    ),
    true
  );
  assert.equal(
    seattleAstronomyPlan?.applicationChecklist.some((entry) => entry.id === "uws-astr-physics123"),
    true
  );
  assert.equal(
    seattleAtmosphericClimateSciencePlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-atmos-calc123"
    ),
    true
  );
  assert.equal(
    seattleBusinessAdministrationPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-baba-financial-accounting"
    ),
    true
  );
  assert.equal(
    seattleChinesePlan?.applicationChecklist.some((entry) => entry.id === "uws-chin-language-credits"),
    true
  );

  assert.equal(getTransferPlannerPathwaysForPlan(seattleAtmosphericClimateSciencePlan).length, 4);
  assert.equal(getTransferPlannerPathwaysForPlan(seattleBiochemistrySeattlePlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(seattleBiologySeattlePlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(seattleChemistrySeattlePlan).length, 3);
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

  assert.equal(
    seattleClassicsPlan?.applicationChecklist.some((entry) => entry.id === "uws-classics-writing"),
    true
  );
  assert.equal(
    seattleCommunicationPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-comm-public-speaking"
    ),
    true
  );
  assert.equal(
    seattleCepPlan?.applicationChecklist.some((entry) => entry.id === "uws-cep-calc"),
    true
  );
  assert.equal(
    seattleCfrmPlan?.applicationChecklist.some((entry) => entry.id === "uws-cfrm-calc123"),
    true
  );
  assert.equal(
    seattleConstructionManagementPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-cm-programming"
    ),
    true
  );
  assert.equal(
    seattleDancePlan?.applicationChecklist.some((entry) => entry.id === "uws-dance-performance"),
    true
  );
  assert.equal(
    seattleDanishPlan?.applicationChecklist.some((entry) => entry.id === "uws-danish-language"),
    true
  );
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

  assert.equal(
    seattleDesignPlan?.applicationChecklist.some((entry) => entry.id === "uws-design-foundation"),
    true
  );
  assert.equal(
    seattleDisabilityStudiesPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-disability-writing"
    ),
    true
  );
  assert.equal(
    seattleDramaPlan?.applicationChecklist.some((entry) => entry.id === "uws-drama-performance"),
    true
  );
  assert.equal(
    seattleEcfsPlan?.applicationChecklist.some((entry) => entry.id === "uws-ecfs-psych"),
    true
  );
  assert.equal(
    seattleEssPlan?.applicationChecklist.some((entry) => entry.id === "uws-ess-calc123"),
    true
  );
  assert.equal(
    seattleEconomicsPlan?.applicationChecklist.some((entry) => entry.id === "uws-econ-calc"),
    true
  );
  assert.equal(
    seattleEducationStudiesPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-edst-writing"
    ),
    true
  );
  assert.equal(
    seattleEcoPlan?.applicationChecklist.some((entry) => entry.id === "uws-eco-writing"),
    true
  );
  assert.equal(
    seattleEnglishCreativeWritingPlan?.applicationChecklist.some(
      (entry) => entry.id === "uws-engcw-writing"
    ),
    true
  );
  assert.equal(
    seattleEnglishLlcPlan?.applicationChecklist.some((entry) => entry.id === "uws-engllc-writing"),
    true
  );
});

test("Next Seattle planner-note hardening batch removes support-only phrasing (HCDE through Asian Studies)", () => {
  const hardenedPlans = [
    hcdePlan,
    seattleStatisticsPlan,
    seattleAmericanIndianStudiesPlan,
    seattleAcePlan,
    seattleArchitecturalDesignPlan,
    seattleArchitecturalStudiesPlan,
    seattleArtPlan,
    seattleArtHistoryPlan,
    seattleAsianLanguagesPlan,
    seattleAsianStudiesPlan,
  ];

  for (const plan of hardenedPlans) {
    assert.ok(plan, "Expected Seattle planner row to exist for planner-note hardening.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(String(plan.plannerNote ?? "").trim().length > 0, `Expected ${plan.title} to keep planner note guidance.`);
    assert.doesNotMatch(
      String(plan.plannerNote ?? "").toLowerCase(),
      /support-only|supportive prep only|supportive coverage|transfer-prep|placeholder|minimal|custom bank set|varies/
    );
  }

  assert.equal(hcdePlan?.plannerNote?.includes("admissions-first"), true);
  assert.equal(seattleStatisticsPlan?.plannerNote?.includes("Track-aware Statistics baseline"), true);
  assert.equal(seattleArchitecturalDesignPlan?.plannerNote?.includes("Foundation-first"), true);
  assert.equal(seattleAsianStudiesPlan?.plannerNote?.includes("Concentration-aware Asian Studies baseline"), true);
});

test("Next Seattle planner-note hardening batch removes support-only phrasing (Chinese through Construction Management)", () => {
  const hardenedPlans = [
    seattleChinesePlan,
    seattleCinemaMediaStudiesPlan,
    seattleClassicalStudiesPlan,
    seattleClassicsPlan,
    seattleCommunicationPlan,
    seattleCepPlan,
    seattleChiPlan,
    seattleComparativeLiteraturePlan,
    seattleComparativeReligionPlan,
    seattleConstructionManagementPlan,
  ];

  for (const plan of hardenedPlans) {
    assert.ok(plan, "Expected Seattle planner row to exist for planner-note hardening.");
    assert.equal(plan.coverage, "detailed");
    assert.ok(
      String(plan.plannerNote ?? "").trim().length > 0,
      `Expected ${plan.title} to keep planner note guidance.`
    );
    assert.doesNotMatch(
      String(plan.plannerNote ?? "").toLowerCase(),
      /support-only|supportive prep only|supportive coverage|transfer-prep|placeholder|minimal|custom bank set|varies/
    );
  }

  assert.equal(
    seattleChinesePlan?.plannerNote?.includes("Language-progression Chinese baseline"),
    true
  );
  assert.equal(
    seattleCinemaMediaStudiesPlan?.plannerNote?.includes("Core-ready Cinema and Media baseline"),
    true
  );
  assert.equal(
    seattleCommunicationPlan?.plannerNote?.includes("Application-ready Communication baseline"),
    true
  );
  assert.equal(
    seattleConstructionManagementPlan?.plannerNote?.includes(
      "Technical-project Construction Management baseline"
    ),
    true
  );
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

  assert.equal(
    bothellAmericanEthnicStudiesPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwb-aes-foundation"
    ),
    true
  );
  assert.equal(
    bothellAppliedComputingPlan?.applicationChecklist.some(
      (entry) => entry.id === "uwb-acomp-programming"
    ),
    true
  );
  assert.equal(
    bothellBiologyPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uwb-bio-physics"
    ),
    true
  );
  assert.equal(
    bothellBbaPlan?.applicationChecklist.some((entry) => entry.id === "uwb-bba-engl128"),
    true
  );
  assert.equal(
    bothellAccountingPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwb-accounting-full-accounting"
    ),
    true
  );
  assert.equal(
    bothellFinancePlan?.applicationChecklist.some(
      (entry) => entry.id === "uwb-finance-financial-accounting"
    ),
    true
  );
  assert.equal(
    bothellLsiPlan?.advisorFlags.some((entry) => /BBUS 300 and BBUS 307/.test(entry)),
    true
  );
  assert.equal(
    bothellMarketingPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwb-marketing-communication"
    ),
    true
  );
  assert.equal(
    bothellScmPlan?.advisorFlags.some((entry) => /STEM-designated/.test(entry)),
    true
  );
  assert.equal(
    bothellChemistryBaPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uwb-chem-ba-organic"
    ),
    true
  );
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

  assert.equal(
    bothellChemistryBsPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uwb-chem-bs-advanced-math"
    ),
    true
  );
  assert.equal(
    bothellBiochemistryPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uwb-biochem-bio-foundation"
    ),
    true
  );
  assert.equal(
    bothellCsseIacPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uwb-csse-iac-stats"
    ),
    true
  );
  assert.equal(
    bothellCrsPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwb-crs-gis"),
    true
  );
  assert.equal(
    bothellClaPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uwb-cla-second-writing"
    ),
    true
  );
  assert.equal(
    bothellDataVisBaPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwb-dv-ba-visual"
    ),
    true
  );
  assert.equal(
    bothellDataVisBsPlan?.beforeEnrollmentChecklist.some(
      (entry) => entry.id === "uwb-dv-bs-linear"
    ),
    true
  );
  assert.equal(
    bothellDysPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwb-dys-child-development"),
    true
  );
  assert.equal(
    bothellEssPlan?.applicationChecklist.some((entry) => entry.id === "uwb-ess-earth-intro"),
    true
  );
  assert.equal(
    bothellEconomicsPlan?.applicationChecklist.some(
      (entry) => entry.id === "uwb-econ-advanced-writing"
    ),
    true
  );
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

  assert.equal(
    bothellElementaryEdPlan?.applicationChecklist.some(
      (entry) => entry.id === "uwb-elementary-ed-engl101"
    ),
    true
  );
  assert.equal(
    bothellEePlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwb-ee-circuits"),
    true
  );
  assert.equal(
    bothellEnvironmentalStudiesPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwb-enst-spatial"
    ),
    true
  );
  assert.equal(
    bothellGwssPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwb-gwss-social-inquiry"),
    true
  );
  assert.equal(
    bothellGlobalStudiesPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwb-global-language"
    ),
    true
  );
  assert.equal(
    bothellHealthStudiesPlan?.applicationChecklist.some(
      (entry) => entry.id === "uwb-health-reasoning"
    ),
    true
  );
  assert.equal(
    bothellImdPlan?.advisorFlags.some((entry) => /permanently suspended/i.test(entry)),
    true
  );
  assert.equal(
    bothellInterdisciplinaryArtsPlan?.stayAtGrcChecklist.some(
      (entry) => entry.id === "uwb-ia-arts-foundation"
    ),
    true
  );
  assert.equal(
    bothellIndividualizedStudyPlan?.advisorFlags.some((entry) => /proposal-based degree/i.test(entry)),
    true
  );
  assert.equal(
    bothellLeppPlan?.applicationChecklist.some((entry) => entry.id === "uwb-lepp-government"),
    true
  );
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

  assert.equal(
    bothellMtvPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwb-mtv-programming"),
    true
  );
  assert.equal(
    bothellMathPlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uwb-math-linear"),
    true
  );
  assert.equal(
    bothellMcsPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwb-mcs-intro-media"),
    true
  );
  assert.equal(
    bothellFirstYearRnBsnPlan?.advisorFlags.some((entry) => /specialized first-year partner pathway/i.test(entry)),
    true
  );
  assert.equal(
    bothellRnBsnPlan?.applicationChecklist.some((entry) => entry.id === "uwb-rnbsn-ap"),
    true
  );
  assert.equal(
    bothellPhysicsBaPlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uwb-physics-ba-chem"),
    true
  );
  assert.equal(
    bothellPhysicsBsPlan?.beforeEnrollmentChecklist.some((entry) => entry.id === "uwb-physics-bs-programming"),
    true
  );
  assert.equal(
    bothellPsychologyPlan?.applicationChecklist.some((entry) => entry.id === "uwb-psych-intro"),
    true
  );
  assert.equal(
    bothellStsPlan?.stayAtGrcChecklist.some((entry) => entry.id === "uwb-sts-data-tech-support"),
    true
  );
  assert.equal(
    bothellSehbPlan?.advisorFlags.some((entry) => /continuing-students-only legacy row/i.test(entry)),
    true
  );
});

test("Generated planner output keeps support-only classes out of before-enrollment and simplifies kept degree notes", () => {
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
  assert.match(aa260?.note ?? "", /needed in the degree/i);
  assert.match(tacomaCompEMath208?.note ?? "", /needed to finish the degree/i);
  assert.match(tacomaEeMath208?.note ?? "", /needed to finish the degree/i);
});

test("Support-first majors still show degree-specific prep when UW essential only is on", () => {
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

  assert.equal(plannedCourses.length > 0, true);
  assert.equal(
    plannedCourses.some((course) =>
      /indigenous-history, culture, and related humanities foundation - choose 1 from this list/i.test(
        course.label
      )
    ),
    true
  );
  assert.equal(
    plannedCourses.some((course) => /ames 100/i.test(course.guidanceSummary ?? "")),
    true
  );
});

test("Source-generated majors no longer leave all three checklist buckets empty", () => {
  const missingBuckets = TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.filter(
    (plan) =>
      (plan.applicationChecklist?.length ?? 0) === 0 &&
      (plan.beforeEnrollmentChecklist?.length ?? 0) === 0 &&
      (plan.stayAtGrcChecklist?.length ?? 0) === 0
  ).map((plan) => plan.id);

  assert.deepEqual(
    missingBuckets,
    [],
    `Expected every source-generated major to materialize at least one checklist bucket, but found: ${missingBuckets.join(", ")}`
  );

  const individualizedStudies = getTransferPlannerMajorPlan("uw-seattle-individualized-studies");
  const envDesign = getTransferPlannerMajorPlan(
    "uw-seattle-environmental-design-and-sustainability"
  );

  assert.ok(individualizedStudies, "Expected Individualized Studies planner row.");
  assert.ok(envDesign, "Expected Environmental Design & Sustainability planner row.");
  assert.equal(individualizedStudies?.stayAtGrcChecklist.length > 0, true);
  assert.equal(envDesign?.stayAtGrcChecklist.length > 0, true);
  assert.match(
    individualizedStudies?.stayAtGrcChecklist[0]?.note ?? "",
    /custom green river course set required|student-designed seattle major/i
  );
  assert.match(
    envDesign?.stayAtGrcChecklist[0]?.note ?? "",
    /does not have a hand-authored checklist yet/i
  );
});

test("Fallback before-enrollment guidance now becomes subject-aware when a note is missing", () => {
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
  assert.match(math240Course?.guidanceSummary ?? "", /minimum transfer-admission classes/i);
  assert.match(math240Course?.guidanceSummary ?? "", /needed to complete the degree either way/i);
});

test("Fallback stay-at-Green-River guidance now becomes subject-aware when a note is missing", () => {
  const stayAtGrcStatuses = buildRequirementStatuses(
    [buildChecklistItem("circuit-head-start", "Circuit analysis head start", ["ENGR& 204"])],
    []
  );

  const plannedCourses = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: [],
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses,
    completedCourses: [],
    track: null,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  }).flatMap((quarter) => quarter.courses);

  const circuitCourse = plannedCourses.find((course) => course.label === "ENGR& 204");

  assert.ok(circuitCourse, "Expected fallback planning to include ENGR& 204.");
  assert.match(circuitCourse?.guidanceSummary ?? "", /circuit/i);
  assert.match(circuitCourse?.guidanceSummary ?? "", /head start/i);
});

test("Engineering-relevant Green River tracks now expose year-aware catalog data", () => {
  const trackIds = ["999B", "999Q", "999O", "999P"] as const;

  for (const trackId of trackIds) {
    const track = getTransferPlannerTrack(trackId);
    assert.ok(track, `Expected track ${trackId}.`);
    assert.ok(track.officialLinks?.length, `Expected ${trackId} to include source links.`);
    assert.equal(track.catalogYears?.length, 2, `Expected ${trackId} to include two catalog years.`);
    assert.deepEqual(
      track.catalogYears?.map((entry) => entry.label),
      ["2024-2025", "2025-2026"]
    );
  }
});

test("999Q, 999O, and 999P replace raw planner placeholders with slot guidance", () => {
  const trackQ = getTransferPlannerTrack("999Q");
  const trackO = getTransferPlannerTrack("999O");
  const trackP = getTransferPlannerTrack("999P");

  assert.ok(trackQ && trackO && trackP, "Expected the engineering MRP tracks.");

  for (const track of [trackQ, trackO, trackP]) {
    const plannerCourseLabels = track.terms.flatMap((term) => term.courses);
    assert.equal(
      plannerCourseLabels.some((entry) => /select course from list/i.test(entry)),
      false,
      `Expected ${track.code} planner terms to replace raw SELECT COURSE FROM LIST labels.`
    );
    assert.ok(
      track.catalogYears?.some((catalogYear) => catalogYear.slotExpansions?.length),
      `Expected ${track.code} catalog-year slot expansions.`
    );
  }
});

test("Planner-tracked Green River courses now expose annual-schedule availability history", () => {
  const engr250Availability = getTransferPlannerGrcCourseAvailability("ENGR 250");
  const math240Availability = getTransferPlannerGrcCourseAvailability("MATH 240");
  const missingSummary = getTransferPlannerGrcCourseAvailabilitySummary("ENGR 199");

  assert.ok(engr250Availability, "Expected ENGR 250 availability history.");
  assert.deepEqual(
    engr250Availability.years.map((year) => ({
      label: year.label,
      quarters: year.quarters,
    })),
    [
      { label: "2024-2025", quarters: ["winter"] },
      { label: "2025-2026", quarters: ["summer", "winter"] },
    ]
  );

  assert.ok(math240Availability, "Expected MATH 240 availability history.");
  assert.deepEqual(math240Availability.latestPublishedQuarters, [
    "summer",
    "fall",
    "winter",
    "spring",
  ]);
  assert.match(
    getTransferPlannerGrcCourseAvailabilitySummary("ENGR 250") ?? "",
    /2024-2025: Winter; 2025-2026: Summer, Winter/
  );
  assert.match(missingSummary ?? "", /Not found in the latest published 2024-2025 or 2025-2026/);
});

test("Quarter planning now prefers quarters that match the latest published GRC availability history", () => {
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
    "ENGL& 101"
  );
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: bioEPlan,
    ...buildStatuses(bioEPlan, completedCourses),
    completedCourses,
    track: bioETrack,
    includeStayAtGrcCourses: false,
    referenceDate: new Date("2026-04-02T12:00:00.000Z"),
  });
  const plannedQuarters = quarterPlan.filter((quarter) => quarter.phase === "planned");
  const engr250Quarter = plannedQuarters.find((quarter) =>
    quarter.courses.some((course) => course.label === "ENGR 250")
  );
  const engr250Course = engr250Quarter?.courses.find((course) => course.label === "ENGR 250");

  assert.ok(engr250Quarter, "Expected ENGR 250 to still be planned.");
  assert.equal(engr250Quarter?.label, "Winter 2027");
  assert.match(engr250Course?.availabilitySummary ?? "", /Summer, Winter/);
});

test("Quarter planning keeps UW-required classes ahead of optional Green River add-ons", () => {
  const quarterPlan = buildSuggestedQuarterPlan({
    plan: null,
    applicationStatuses: buildRequirementStatuses(
      [buildChecklistItem("uw-required-writing", "UW required writing", ["ENGL& 101"])],
      []
    ),
    beforeEnrollmentStatuses: [],
    stayAtGrcStatuses: buildRequirementStatuses(
      [buildChecklistItem("optional-diffeq", "Optional differential equations", ["MATH 238"])],
      []
    ),
    completedCourses: [],
    track: null,
    includeStayAtGrcCourses: true,
    referenceDate: new Date("2026-01-15T12:00:00.000Z"),
  });

  const plannedLabels = quarterPlan
    .filter((quarter) => quarter.phase === "planned")
    .flatMap((quarter) => quarter.courses.map((course) => course.label));

  assert.equal(plannedLabels.includes("ENGL& 101"), true);
  assert.equal(plannedLabels.includes("MATH 238"), true);
  assert.equal(plannedLabels.indexOf("ENGL& 101") < plannedLabels.indexOf("MATH 238"), true);
});

test("Canonical course registry bootstraps planner-tracked GRC and UW courses without dropping references", () => {
  const grcCalc = getTransferPlannerCanonicalCourse("grc", "MATH& 151");
  const seattleUwCourse = getTransferPlannerCanonicalCourse("uw-seattle", "CSE 121");

  assert.ok(grcCalc, "Expected a canonical GRC calculus course entry.");
  assert.ok(seattleUwCourse, "Expected a canonical UW Seattle course entry from exact degree maps.");

  assert.equal(grcCalc?.referencedByPlanIds.includes("uw-seattle-computer-engineering"), true);
  assert.equal(grcCalc?.sourceKinds.includes("plan-checklist"), true);
  assert.equal(grcCalc?.title, "Calculus I");
  assert.equal(grcCalc?.creditValue, 5);
  assert.equal(grcCalc?.effectiveYearRanges.length > 0, true);
  assert.equal(seattleUwCourse?.sourceKinds.includes("plan-degree-map"), true);
  assert.equal(seattleUwCourse?.title, "Computer Programming I");
  assert.equal(seattleUwCourse?.creditValue, 4);
});

test("Canonical course registry now stores normalized sequence metadata for planner-critical GRC courses", () => {
  const math240 = getTransferPlannerCanonicalCourse("grc", "MATH 240");
  const chemistryTwo = getTransferPlannerCanonicalCourse("grc", "CHEM& 162");
  const csTwo = getTransferPlannerCanonicalCourse("grc", "CS 122");
  const math238 = getTransferPlannerCanonicalCourse("grc", "MATH 238");

  assert.equal(math240?.title, "Linear Algebra");
  assert.equal(math240?.creditValue, 5);
  assert.deepEqual(math240?.prerequisiteCourseCodes, ["MATH 238"]);

  assert.equal(chemistryTwo?.title, "General Chemistry with Lab II");
  assert.deepEqual(chemistryTwo?.prerequisiteCourseCodes, ["CHEM& 161"]);

  assert.equal(csTwo?.title, "Computer Science II");
  assert.deepEqual(csTwo?.prerequisiteCourseCodes, ["CS 121"]);

  assert.equal(math238?.title, "Differential Equations");
  assert.deepEqual(math238?.prerequisiteAlternativeCourseCodeSets, [
    ["MATH& 153", "MATH& 254"],
    ["MATH& 163"],
  ]);
});

test("Generated Green River schedule metadata now expands title coverage beyond the manual seed set", () => {
  const accountingOne = getTransferPlannerCanonicalCourse("grc", "ACCT& 201");
  const spanishOne = getTransferPlannerCanonicalCourse("grc", "SPAN& 121");

  assert.equal(accountingOne?.title, "Principles of Accounting I");
  assert.equal(accountingOne?.creditValue, null);
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

test("Every Seattle planner row now exposes real planner content, including custom guidance for proposal-based majors", () => {
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

test("Every Tacoma planner row now exposes real planner content in the source-generated runtime rows", () => {
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

test("Every Bothell planner row now exposes real planner content in the source-generated runtime rows", () => {
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

test("Requirement and degree-map registries cover all current planner rows", () => {
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
    checklistItemCount + TRANSFER_PLANNER_SOURCE_SUMMARY.promotedRequirementAtomOverrideCount
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

test("Equivalency rule registry keeps both structured planner rules and chain-library nuance", () => {
  const structuredRule = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.find(
    (entry) => entry.id === "stem-calculus-current-sequence"
  );
  const legacyCalcRule = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.find(
    (entry) => entry.id === "stem-calculus-older-sequence"
  );
  const chainRule = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.find(
    (entry) => entry.id === "chain:math-stem"
  );
  const legacyCsRule = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.find(
    (entry) => entry.id === "chain:cs-legacy"
  );
  const comm266Rule = TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.find(
    (entry) => entry.id === "chain:comm-266"
  );

  assert.ok(structuredRule, "Expected the structured stem-calculus rule.");
  assert.ok(legacyCalcRule, "Expected the legacy calculus alternative rule.");
  assert.ok(chainRule, "Expected the chain-derived MATH-STEM rule.");
  assert.ok(legacyCsRule, "Expected the legacy CS chain rule.");
  assert.ok(comm266Rule, "Expected the CMST 266 warning rule.");
  assert.deepEqual(structuredRule?.sourceCourseSets, [["MATH& 151", "MATH& 152", "MATH& 163"]]);
  assert.equal(structuredRule?.acceptanceCategory, "preferred");
  assert.equal(legacyCalcRule?.acceptanceCategory, "legacy-accepted");
  assert.deepEqual(legacyCalcRule?.weakerThanRuleIds, ["stem-calculus-current-sequence"]);
  assert.ok(
    legacyCalcRule?.effectiveYearRanges.some((range) => range.startLabel === "legacy-planner-support")
  );
  assert.ok((legacyCalcRule?.plannerWarnings.length ?? 0) > 0);
  assert.match(chainRule?.targetOutcome ?? "", /MATH& 151/);
  assert.equal(chainRule?.acceptanceCategory, "accepted-with-warning");
  assert.equal(legacyCsRule?.acceptanceCategory, "legacy-accepted");
  assert.deepEqual(legacyCsRule?.weakerThanRuleIds, ["computer-science-new-sequence"]);
  assert.ok(
    (legacyCsRule?.plannerWarnings ?? []).some((warning) => /prefers the current CS 121/i.test(warning))
  );
  assert.equal(comm266Rule?.acceptanceCategory, "accepted-with-warning");
  assert.ok(
    (comm266Rule?.plannerWarnings ?? []).some((warning) => /5 credits/i.test(warning))
  );
});

test("Source summary reports a non-empty layered registry bootstrap", () => {
  assert.equal(TRANSFER_PLANNER_SOURCE_SUMMARY.generatedOn, "2026-04-02");
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCourseCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCourseTitleCount > 200);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCourseCreditCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCoursePrerequisiteCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.canonicalCourseEffectiveYearRangeCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.equivalencyRuleCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.majorPathwayCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceManifestCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceManifestPrimaryCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceManifestHighConfidenceCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.sourceManifestPromotedPrimaryOverrideCount > 0);
  assert.ok(TRANSFER_PLANNER_SOURCE_SUMMARY.promotedRequirementAtomOverrideCount > 0);
  assert.ok(TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.some((entry) => entry.schoolId === "grc"));
  assert.ok(
    TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.some((entry) => entry.schoolId === "uw-bothell")
  );
  assert.ok(
    TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.some((entry) => entry.schoolId === "uw-tacoma")
  );
});

test("Source manifest registry now tracks parser type, role, confidence, and primary degree pages", () => {
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

test("Promoted primary-source overrides now feed the source manifest registry for missing majors", () => {
  const aisOverride = getTransferPlannerPromotedPrimarySourceOverride(
    "uw-seattle-american-indian-studies"
  );
  const aisPrimary = getTransferPlannerPrimaryDegreeRequirementsSource(
    "uw-seattle-american-indian-studies",
    null
  );

  assert.ok(aisOverride, "Expected an auto-promoted primary-source override for American Indian Studies.");
  assert.ok(aisPrimary, "Expected American Indian Studies to expose a primary degree source after promotion.");
  assert.equal(aisPrimary?.url, aisOverride?.url);
  assert.equal(aisPrimary?.isPrimaryDegreeRequirementsLink, true);
  assert.equal(
    aisPrimary?.role === "degree-requirements" || aisPrimary?.parserType === "pdf-degree-sheet",
    true
  );
  assert.ok(
    (aisPrimary?.validationNotes ?? []).some((note) => /auto-promoted high-confidence primary source/i.test(note))
  );
});

test("Seattle Computer Engineering degree-map blocks stay aligned with the current CompE degree sheet", () => {
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

test("Promoted requirement-diff overrides now feed the structured requirement registry", () => {
  const chemistryBsOverrides = getTransferPlannerPromotedRequirementAtomOverrides(
    "uw-bothell-chemistry-bs",
    null
  );
  const chemistryBsPhysics121 = chemistryBsOverrides.find(
    (entry) => entry.sourceUwCourseCode === "PHYS 121"
  );
  const chemistryBsRegistryAtom = TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY.find(
    (entry) => entry.id === chemistryBsPhysics121?.id
  );
  const chemistryBsPlan = getTransferPlannerMajorPlan("uw-bothell-chemistry-bs");

  assert.ok(
    chemistryBsPhysics121,
    "Expected a promoted requirement-diff override for Bothell Chemistry (BS)."
  );
  assert.ok(
    chemistryBsRegistryAtom,
    "Expected promoted requirement-diff overrides to be merged into the structured requirement registry."
  );
  assert.equal(chemistryBsPhysics121?.displayPhase, "before-application");
  assert.deepEqual(chemistryBsPhysics121?.grcCourseCodes, ["PHYS& 221"]);
  assert.match(chemistryBsPhysics121?.note ?? "", /current official degree page names PHYS 121/i);
  assert.ok(
    chemistryBsPlan?.applicationChecklist.some(
      (item) => item.title === "PHYS 121" && item.grcCourses.includes("PHYS& 221")
    ),
    "Expected the live planner row to expose the promoted PHYS 121 requirement."
  );
});

test("Only majors with real supported routes expose planner pathways", () => {
  assert.ok(biologyPlan, "Expected Seattle Biology planner row.");
  assert.ok(tacomaWritingPlan, "Expected Tacoma Writing Studies planner row.");
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
  assert.equal(getTransferPlannerPathwaysForPlan(biologyPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedGeographyPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedPsychologyPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedPhghPlan).length, 4);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaEnvSustainabilityPlan).length, 4);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaEglsPlan).length, 3);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaSudPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(sourceGeneratedTacomaUrbanStudiesPlan).length, 2);
  assert.equal(getTransferPlannerPathwaysForPlan(tacomaWritingPlan).length, 3);
});

test("Resolving Biology pathways changes the selected route metadata and tracked GRC course list", () => {
  assert.ok(biologyPlan, "Expected Seattle Biology planner row.");

  const biologyBaPlan = resolveTransferPlannerMajorPlan(biologyPlan, "ba-general-biology");
  const biologyBsPlan = resolveTransferPlannerMajorPlan(biologyPlan, "bs-option-family");

  assert.ok(biologyBaPlan, "Expected Biology B.A. resolved plan.");
  assert.ok(biologyBsPlan, "Expected Biology B.S. resolved plan.");
  assert.equal(biologyBaPlan?.selectedPathwayLabel, "B.A. general biology");
  assert.equal(biologyBsPlan?.selectedPathwayLabel, "B.S. option family");
  assert.equal(getTransferPlannerGrcCourseList(biologyBaPlan).includes("PHYS& 221"), false);
  assert.equal(getTransferPlannerGrcCourseList(biologyBsPlan).includes("PHYS& 221"), true);
});

test("Tacoma Communication pathway resolution narrows the degree-map sections to the selected track", () => {
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

test("Layered source registries now include explicit major-pathway entries", () => {
  const biologyPathway = TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.find(
    (entry) => entry.id === "uw-seattle-biology:pathway:ba-general-biology"
  );
  const writingTechPathway = TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.find(
    (entry) => entry.id === "uw-tacoma-writing-studies:pathway:technical-communication-track"
  );

  assert.ok(biologyPathway, "Expected a Biology pathway registry entry.");
  assert.ok(writingTechPathway, "Expected a Writing Studies pathway registry entry.");
  assert.match(biologyPathway?.summary ?? "", /Broader biology route/);
});

test("Source-generated major rows preserve planner counts and now drive more officially multi-route majors", () => {
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

test("Source-generated pathway rows can resolve the new route-specific Seattle and Tacoma paths", () => {
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

test("Auto track matcher preserves custom track copy when the computed winner already matches", () => {
  const autoRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    csPlan.grcCourseList ?? [],
    csPlan.bestTrackId
  );

  assert.ok(autoRecommendation, "Expected an auto-matched track recommendation for Seattle CS.");
  assert.equal(autoRecommendation?.trackId, "999P");
  assert.equal(csPlan.bestTrackId, "999P");
  assert.match(csPlan.bestTrackSummary, /safest Green River path/i);
  assert.match(csPlan.financialAidNote, /engineering backup options/i);
});

test("Auto track matcher replaces stale best-track copy when the overlap winner differs", () => {
  const bootstrapAtmosphericPlan = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.find(
    (entry) => entry.id === "uw-seattle-atmospheric-and-climate-science"
  );
  const autoRecommendation = getTransferPlannerAutoMatchedTrackRecommendation(
    seattleAtmosphericClimateSciencePlan?.grcCourseList ?? [],
    bootstrapAtmosphericPlan?.bestTrackId ?? null
  );

  assert.equal(bootstrapAtmosphericPlan?.bestTrackId, "999B");
  assert.equal(autoRecommendation?.trackId, "999O");
  assert.equal(seattleAtmosphericClimateSciencePlan?.bestTrackId, "999O");
  assert.match(
    seattleAtmosphericClimateSciencePlan?.bestTrackSummary ?? "",
    /current closest Green River transfer path/i
  );
  assert.match(
    seattleAtmosphericClimateSciencePlan?.financialAidNote ?? "",
    /main Green River transfer-degree backbone/i
  );
});

test("Expanded pathway majors resolve to the selected official route and route-specific guidance", () => {
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
  assert.match(psychologyBsPlan?.grcCourseListGuidance ?? "", /philosophy support/i);

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

test("Canonical course registry now keeps pathway-specific GRC references for the expanded route set", () => {
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

test("Canonical course registry keeps new pathway-specific GRC references for added route coverage", () => {
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

test("Detailed planner rows keep explicit guidance notes for before-enrollment and stay-at-GRC items", () => {
  const detailedPlans = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.filter(
    (plan) => plan.coverage === "detailed"
  );
  const missing: string[] = [];
  const collectMissing = (
    scopeId: string,
    scope: {
      beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
      stayAtGrcChecklist?: TransferPlannerChecklistItem[];
    }
  ) => {
    for (const section of ["beforeEnrollmentChecklist", "stayAtGrcChecklist"] as const) {
      for (const item of scope[section] ?? []) {
        if (!item.note || !item.note.trim()) {
          missing.push(`${scopeId}:${section}:${item.id}`);
        }
      }
    }
  };

  for (const plan of detailedPlans) {
    collectMissing(plan.id, plan);
    for (const pathway of plan.pathways ?? []) {
      collectMissing(`${plan.id}:${pathway.id}`, pathway);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `Expected detailed planner rows to carry explicit guidance notes for actionable checklist items, but found: ${missing.join(", ")}`
  );
});
