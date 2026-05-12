import {
  assert,
  buildSourceBackedUwCourseConsideredSummaryEntries,
  getTransferPlannerParsedRequirementSourceBlocks,
  getTransferPlannerPathwaysForPlan,
  getTransferPlannerSourceGeneratedMajorsForCampus,
  getTransferPlannerStudentRuntimeMajorPlan,
  resolveTransferPlannerStudentRuntimeMajorPlan,
  test,
} from "./transfer-planner.test-support";

const SAMPLE_LIMIT = 6;

type TacomaOwnerMismatchKind =
  | "source-only-uw-courses"
  | "source-only-courses-suppressed-by-source-role"
  | "structured-only-uw-courses"
  | "zero-parsed-uw-courses";

type TacomaOwnerMismatchDiagnostic = {
  ownerId: string;
  mismatchKinds: TacomaOwnerMismatchKind[];
  parsedUwCourseCodeCount: number;
  sourceOnlyUwCourseCodeCount: number;
  structuredOnlyUwCourseCodeCount: number;
  sourceRoles: string[];
  sourceRoleStatuses: string[];
  parserTypes: string[];
  sourceOnlySample: string[];
  structuredOnlySample: string[];
};

type TacomaBroadPathwayDiagnostic = {
  planId: string;
  materializedPathwayLabels: string[];
  parsedPathwayLabels: string[];
};

type TacomaCommunicationTrackDiagnostic = {
  ownerId: string;
  parsedUwCourseCodeCount: number;
  sourceOnlyUwCourseCodeCount: number;
  sourceRoleStatuses: string[];
  sourceUrls: string[];
  runtimeConsideredCourseCodes: string[];
};

const EXPECTED_TACOMA_OWNER_MISMATCH_REPORT: TacomaOwnerMismatchDiagnostic[] = [
  {
    ownerId: "uw-tacoma-arts-media-culture",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 186,
    sourceOnlyUwCourseCodeCount: 186,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["generic-html"],
    sourceOnlySample: ["TAMST 101", "TAMST 120", "TAMST 210", "TAMST 220", "TAMST 250", "TAMST 260"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-arts-media-culture:pathway:film-and-media-track",
    mismatchKinds: ["source-only-uw-courses"],
    parsedUwCourseCodeCount: 1,
    sourceOnlyUwCourseCodeCount: 1,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["primary-degree-requirements"],
    sourceRoleStatuses: ["primary"],
    parserTypes: ["html-degree-page"],
    sourceOnlySample: ["TARTS 151"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-bachelor-of-arts-in-business-administration",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 19,
    sourceOnlyUwCourseCodeCount: 19,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["generic-html"],
    sourceOnlySample: ["TACCT 301", "TACCT 302", "TACCT 303", "TACCT 311", "TACCT 330", "TACCT 411"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-biomedical-sciences",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 10,
    sourceOnlyUwCourseCodeCount: 10,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TBIOMD 199", "TCHEM 271", "THLTH 355", "TMATH 126", "TPHYS 122", "TPHYS 123"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-civil-engineering",
    mismatchKinds: ["structured-only-uw-courses"],
    parsedUwCourseCodeCount: 34,
    sourceOnlyUwCourseCodeCount: 0,
    structuredOnlyUwCourseCodeCount: 5,
    sourceRoles: ["department-requirements"],
    sourceRoleStatuses: ["primary"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: [],
    structuredOnlySample: ["AA 210", "CEE 220", "TMATH 207", "TME 221", "TME 222"],
  },
  {
    ownerId: "uw-tacoma-computer-science-and-systems-ba",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 20,
    sourceOnlyUwCourseCodeCount: 20,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TCSS 101", "TCSS 141", "TCSS 142", "TCSS 143", "TCSS 305", "TCSS 321"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-economics-and-policy-analysis",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 28,
    sourceOnlyUwCourseCodeCount: 28,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["support-source"],
    sourceRoleStatuses: ["support"],
    parserTypes: ["generic-html"],
    sourceOnlySample: ["TBECON 220", "TBECON 221", "TBECON 420", "TBECON 421", "TBECON 422", "TECON 200"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-economics-and-policy-analysis:pathway:ba-route",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 28,
    sourceOnlyUwCourseCodeCount: 28,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["support-source"],
    sourceRoleStatuses: ["support"],
    parserTypes: ["generic-html"],
    sourceOnlySample: ["TBECON 220", "TBECON 221", "TBECON 420", "TBECON 421", "TBECON 422", "TECON 200"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-education",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 115,
    sourceOnlyUwCourseCodeCount: 115,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["ENGL 131", "ENVIR 100", "TBIOL 100", "TBIOL 102", "TBIOL 110", "TBIOL 120"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-education:pathway:special-education-dual-endorsement",
    mismatchKinds: ["zero-parsed-uw-courses"],
    parsedUwCourseCodeCount: 0,
    sourceOnlyUwCourseCodeCount: 0,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: [],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-environmental-science",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 35,
    sourceOnlyUwCourseCodeCount: 35,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TBIOL 202", "TBIOL 203", "TBIOL 232", "TBIOL 234", "TBIOL 240", "TBIOL 270"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-environmental-sustainability",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 57,
    sourceOnlyUwCourseCodeCount: 57,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TBGEN 212", "TBIOL 110", "TBIOL 232", "TBIOMD 490", "TBIOMD 491", "TBUS 300"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-environmental-sustainability:pathway:environmental-communication-option",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 38,
    sourceOnlyUwCourseCodeCount: 38,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["generic-html"],
    sourceOnlySample: ["TBIOL 110", "TBIOL 232", "TBIOMD 490", "TBIOMD 491", "TCHEM 131", "TCOM 275"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-environmental-sustainability:pathway:environmental-education-option",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 20,
    sourceOnlyUwCourseCodeCount: 20,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["ENGL 131", "TBGEN 212", "TBUS 300", "TEDUC 290", "TEDUC 471", "TEDUC 482"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-environmental-sustainability:pathway:environmental-policy-and-law-option",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 57,
    sourceOnlyUwCourseCodeCount: 57,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["support-source"],
    sourceRoleStatuses: ["support"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TBGEN 212", "TBIOL 110", "TBIOL 232", "TBIOMD 490", "TBIOMD 491", "TBUS 300"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-environmental-sustainability:pathway:pre-environmental-education-option",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 20,
    sourceOnlyUwCourseCodeCount: 20,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["ENGL 131", "TBGEN 212", "TBUS 300", "TEDUC 290", "TEDUC 471", "TEDUC 482"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-environmental-sustainability:pathway:business-nonprofit-leadership-option",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 19,
    sourceOnlyUwCourseCodeCount: 19,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["generic-html"],
    sourceOnlySample: ["TBGEN 212", "TBUS 300", "TEDUC 290", "TEDUC 471", "TEDUC 482", "TMGMT 420"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-environmental-sustainability:pathway:education-option",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 34,
    sourceOnlyUwCourseCodeCount: 34,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["generic-html"],
    sourceOnlySample: ["TBIOL 110", "TBIOL 232", "TBIOMD 490", "TBIOMD 491", "TCHEM 131", "TECON 200"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-environmental-sustainability:pathway:policy-law-option",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 38,
    sourceOnlyUwCourseCodeCount: 38,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["support-source"],
    sourceRoleStatuses: ["support"],
    parserTypes: ["generic-html"],
    sourceOnlySample: ["TBIOL 110", "TBIOL 232", "TBIOMD 490", "TBIOMD 491", "TCHEM 131", "TECON 200"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-ethnic-gender-and-labor-studies",
    mismatchKinds: ["zero-parsed-uw-courses"],
    parsedUwCourseCodeCount: 0,
    sourceOnlyUwCourseCodeCount: 0,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: [],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-ethnic-gender-and-labor-studies:pathway:labor-studies-option",
    mismatchKinds: ["zero-parsed-uw-courses"],
    parsedUwCourseCodeCount: 0,
    sourceOnlyUwCourseCodeCount: 0,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: [],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-history",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 7,
    sourceOnlyUwCourseCodeCount: 7,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["generic-html"],
    sourceOnlySample: ["THIST 101", "THIST 150", "THIST 151", "THIST 200", "THIST 201", "THIST 380"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-history:pathway:global-history-option",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 7,
    sourceOnlyUwCourseCodeCount: 7,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["generic-html"],
    sourceOnlySample: ["THIST 101", "THIST 150", "THIST 151", "THIST 200", "THIST 201", "THIST 380"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-information-technology",
    mismatchKinds: ["structured-only-uw-courses"],
    parsedUwCourseCodeCount: 19,
    sourceOnlyUwCourseCodeCount: 0,
    structuredOnlyUwCourseCodeCount: 2,
    sourceRoles: ["department-requirements"],
    sourceRoleStatuses: ["primary"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: [],
    structuredOnlySample: ["TCSS 141", "TCSS 142"],
  },
  {
    ownerId: "uw-tacoma-interdisciplinary-arts-and-sciences",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 124,
    sourceOnlyUwCourseCodeCount: 124,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TARTS 200", "TARTS 240", "TARTS 280", "TARTS 311", "TARTS 315", "TARTS 367"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-interdisciplinary-arts-and-sciences:pathway:ba-route",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 124,
    sourceOnlyUwCourseCodeCount: 124,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TARTS 200", "TARTS 240", "TARTS 280", "TARTS 311", "TARTS 315", "TARTS 367"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed",
    mismatchKinds: ["source-only-uw-courses"],
    parsedUwCourseCodeCount: 318,
    sourceOnlyUwCourseCodeCount: 30,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["official-catalog"],
    sourceRoleStatuses: ["primary"],
    parserTypes: ["catalog-page"],
    sourceOnlySample: ["THIST 490", "THIST 491", "THIST 495", "THLTH 520", "TLAW 320", "TLIT 324"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed:pathway:culture-and-society-option",
    mismatchKinds: ["source-only-uw-courses"],
    parsedUwCourseCodeCount: 318,
    sourceOnlyUwCourseCodeCount: 30,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["official-catalog"],
    sourceRoleStatuses: ["primary"],
    parserTypes: ["catalog-page"],
    sourceOnlySample: ["THIST 490", "THIST 491", "THIST 495", "THLTH 520", "TLAW 320", "TLIT 324"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-law-and-policy",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 2,
    sourceOnlyUwCourseCodeCount: 2,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["support-source"],
    sourceRoleStatuses: ["support"],
    parserTypes: ["generic-html"],
    sourceOnlySample: ["TLAW 496", "TPOLS 497"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-law-and-policy:pathway:ba-route",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 2,
    sourceOnlyUwCourseCodeCount: 2,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["support-source"],
    sourceRoleStatuses: ["support"],
    parserTypes: ["generic-html"],
    sourceOnlySample: ["TLAW 496", "TPOLS 497"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-mathematics",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 6,
    sourceOnlyUwCourseCodeCount: 6,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TCSS 321", "TMATH 351", "TMATH 450", "TMATH 496", "TMATH 498", "TMATH 499"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-mechanical-engineering",
    mismatchKinds: ["structured-only-uw-courses"],
    parsedUwCourseCodeCount: 48,
    sourceOnlyUwCourseCodeCount: 0,
    structuredOnlyUwCourseCodeCount: 1,
    sourceRoles: ["department-requirements"],
    sourceRoleStatuses: ["primary"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: [],
    structuredOnlySample: ["TMATH 207"],
  },
  {
    ownerId: "uw-tacoma-politics-philosophy-and-economics",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 1,
    sourceOnlyUwCourseCodeCount: 1,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TPOLS 497"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-politics-philosophy-and-economics:pathway:ba-route",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 1,
    sourceOnlyUwCourseCodeCount: 1,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TPOLS 497"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-politics-philosophy-and-economics:pathway:option-one-10-credits-of-upper-division-foreign-language-300",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 1,
    sourceOnlyUwCourseCodeCount: 1,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TPOLS 497"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-psychology",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 60,
    sourceOnlyUwCourseCodeCount: 60,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TMATH 110", "TPSYCH 101", "TPSYCH 202", "TPSYCH 209", "TPSYCH 210", "TPSYCH 220"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-psychology:pathway:ba-route",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 60,
    sourceOnlyUwCourseCodeCount: 60,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TMATH 110", "TPSYCH 101", "TPSYCH 202", "TPSYCH 209", "TPSYCH 210", "TPSYCH 220"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-spanish-language-and-cultures",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 22,
    sourceOnlyUwCourseCodeCount: 22,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TSPAN 299", "TSPAN 301", "TSPAN 302", "TSPAN 303", "TSPAN 335", "TSPAN 345"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-sustainable-urban-development",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 12,
    sourceOnlyUwCourseCodeCount: 12,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TESC 201", "TEST 332", "TGEOG 101", "TGEOG 210", "TGEOG 321", "TGEOG 349"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-sustainable-urban-development:pathway:gis-option",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 12,
    sourceOnlyUwCourseCodeCount: 12,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["TESC 201", "TEST 332", "TGEOG 101", "TGEOG 210", "TGEOG 321", "TGEOG 349"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-urban-design",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 23,
    sourceOnlyUwCourseCodeCount: 23,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["ENGL 131", "TGIS 311", "TUDE 101", "TUDE 210", "TUDE 260", "TUDE 310"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-urban-studies",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 33,
    sourceOnlyUwCourseCodeCount: 33,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["ENGL 131", "TGIS 311", "TGIS 312", "TGIS 313", "TGIS 350", "TGIS 414"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-urban-studies:pathway:community-engagement-option",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 33,
    sourceOnlyUwCourseCodeCount: 33,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["ENGL 131", "TGIS 311", "TGIS 312", "TGIS 313", "TGIS 350", "TGIS 414"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-urban-studies:pathway:gis-option",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 33,
    sourceOnlyUwCourseCodeCount: 33,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["html-overview-page"],
    sourceOnlySample: ["ENGL 131", "TGIS 311", "TGIS 312", "TGIS 313", "TGIS 350", "TGIS 414"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-writing-studies",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 3,
    sourceOnlyUwCourseCodeCount: 3,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["generic-html"],
    sourceOnlySample: ["TCORE 101", "TWRT 121", "TWRT 211"],
    structuredOnlySample: [],
  },
  {
    ownerId: "uw-tacoma-writing-studies:pathway:creative-writing-track",
    mismatchKinds: ["source-only-uw-courses", "source-only-courses-suppressed-by-source-role"],
    parsedUwCourseCodeCount: 3,
    sourceOnlyUwCourseCodeCount: 3,
    structuredOnlyUwCourseCodeCount: 0,
    sourceRoles: ["ignored"],
    sourceRoleStatuses: ["ignored"],
    parserTypes: ["generic-html"],
    sourceOnlySample: ["TCORE 101", "TWRT 121", "TWRT 211"],
    structuredOnlySample: [],
  },
];

const EXPECTED_TACOMA_BROAD_PATHWAY_PATTERN_REPORT: TacomaBroadPathwayDiagnostic[] = [
  {
    planId: "uw-tacoma-arts-media-culture",
    materializedPathwayLabels: ["Film and Media track"],
    parsedPathwayLabels: ["FILM AND MEDIA TRACK", "Film and Media Track", "VISUAL AND PERFORMING ARTS TRACK"],
  },
  {
    planId: "uw-tacoma-bachelor-of-arts-in-business-administration",
    materializedPathwayLabels: [],
    parsedPathwayLabels: [
      "30 credits of TMGMT courses. TBANLT 485 counts for this option.",
      "Specific areas covered within the MSB accounting option include:",
      "The courses in the marketing option cover topics such as:",
      "Upon completing this option",
    ],
  },
  {
    planId: "uw-tacoma-communications",
    materializedPathwayLabels: ["Research Track", "Professional Track"],
    parsedPathwayLabels: ["PROFESSIONAL TRACK", "RESEARCH TRACK"],
  },
  {
    planId: "uw-tacoma-computer-engineering",
    materializedPathwayLabels: ["Course Option", "Bioinformatics Option", "Cybersecurity Option"],
    parsedPathwayLabels: [
      "Bioinformatics Option (20 credits):",
      "Course Option",
      "Create your own pathway as a separate option",
      "Cyber-Physical Systems Option Courses (20 credits):",
      "Cybersecurity Option (20 credits):",
      "Minors consist of 25-35 credits in a focused area of study or Course Option",
      "Option specific requirements",
      "Option-specific requirements",
      "department must approve of thesis or project fit within option.",
      "depending on option",
      "depending on option): See additional requirements for option-specific requirements.",
    ],
  },
  {
    planId: "uw-tacoma-computer-science-and-systems-bs",
    materializedPathwayLabels: ["Bachelor of Arts Option"],
    parsedPathwayLabels: ["Bachelor of Arts Option"],
  },
  {
    planId: "uw-tacoma-criminal-justice",
    materializedPathwayLabels: ["B.A. route"],
    parsedPathwayLabels: [],
  },
  {
    planId: "uw-tacoma-economics-and-policy-analysis",
    materializedPathwayLabels: ["B.A. route"],
    parsedPathwayLabels: [],
  },
  {
    planId: "uw-tacoma-education",
    materializedPathwayLabels: ["Special Education Dual Endorsement"],
    parsedPathwayLabels: ["OPTION 1: SPECIAL EDUCATION DUAL ENDORSEMENT"],
  },
  {
    planId: "uw-tacoma-electrical-engineering",
    materializedPathwayLabels: ["Course Option", "Bioinformatics Option", "Cybersecurity Option"],
    parsedPathwayLabels: [
      "Bioinformatics Option (20 credits):",
      "Course Option",
      "Create your own pathway as a separate option",
      "Cyber-Physical Systems Option Courses (20 credits):",
      "Cybersecurity Option (20 credits):",
      "Minors consist of 25-35 credits in a focused area of study or Course Option",
      "Option specific requirements",
      "Option-specific requirements",
      "department must approve of thesis or project fit within option.",
      "depending on option",
      "depending on option): See additional requirements for option-specific requirements.",
    ],
  },
  {
    planId: "uw-tacoma-environmental-science",
    materializedPathwayLabels: [],
    parsedPathwayLabels: ["Electives for the Geoscience Option", "List H: Additional Courses for Geoscience Option"],
  },
  {
    planId: "uw-tacoma-environmental-sustainability",
    materializedPathwayLabels: [
      "Environmental Communication option",
      "Environmental Education Option",
      "Environmental Policy and Law Option",
      "Pre-Environmental Education Option",
      "Business and Nonprofit Leadership option",
      "Education option",
      "Policy and Law option",
    ],
    parsedPathwayLabels: [
      "Business/Nonprofit Environmental Sustainability Option",
      "Capstone experience: must select at least a 3-credit option from the following list.",
      "Environmental Communication Option",
      "Environmental Education Option",
      "Environmental Policy and Law Option",
    ],
  },
  {
    planId: "uw-tacoma-ethnic-gender-and-labor-studies",
    materializedPathwayLabels: ["Labor Studies Option"],
    parsedPathwayLabels: ["Ethnic Studies Option", "Gender Studies Option", "Labor Studies Option"],
  },
  {
    planId: "uw-tacoma-history",
    materializedPathwayLabels: ["Global History option"],
    parsedPathwayLabels: [
      "General History Option",
      "General History Option | Department of Social Sciences | University of Washington Tacoma",
    ],
  },
  {
    planId: "uw-tacoma-interdisciplinary-arts-and-sciences",
    materializedPathwayLabels: ["B.A. route"],
    parsedPathwayLabels: [],
  },
  {
    planId: "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed",
    materializedPathwayLabels: ["Culture and Society Option"],
    parsedPathwayLabels: [
      "Complete the requirements for a major or concentration (minors are optional).",
      "Culture and Society Option",
      "Option One: 10 credits of upper-division world language (300- 400 level)",
      "Option specific requirements",
      "Option-specific requirements",
      "This option is interdisciplinary and prepares students for investigating issues of globalization",
      "To propose an individually-designed concentration",
      "a general description of the concentration",
      "and Identity Option",
      "and the concentration coordinator.",
      "the rationale for the proposed concentration",
      "this option explores the historical context of marginalization",
    ],
  },
  {
    planId: "uw-tacoma-law-and-policy",
    materializedPathwayLabels: ["B.A. route"],
    parsedPathwayLabels: [],
  },
  {
    planId: "uw-tacoma-politics-philosophy-and-economics",
    materializedPathwayLabels: ["B.A. route", "Option One: 10 credits of upper-division foreign language (300"],
    parsedPathwayLabels: [],
  },
  {
    planId: "uw-tacoma-psychology",
    materializedPathwayLabels: ["B.A. route"],
    parsedPathwayLabels: [],
  },
  {
    planId: "uw-tacoma-social-welfare",
    materializedPathwayLabels: ["B.A. route"],
    parsedPathwayLabels: [],
  },
  {
    planId: "uw-tacoma-sustainable-urban-development",
    materializedPathwayLabels: ["GIS option"],
    parsedPathwayLabels: [],
  },
  {
    planId: "uw-tacoma-urban-studies",
    materializedPathwayLabels: ["Community Engagement option", "GIS option"],
    parsedPathwayLabels: ["Formal options ( choose one option )", "Formal options ( choose one option)", "depending on formal option and course selection:"],
  },
  {
    planId: "uw-tacoma-writing-studies",
    materializedPathwayLabels: ["Creative Writing Track"],
    parsedPathwayLabels: [
      "CREATIVE WRITING TRACK",
      "WRITING AND SOCIAL CHANGE TRACK",
      "grassroots activism and community organizing. This track centers integrative and inclusive pedagogy",
    ],
  },
];

const EXPECTED_TACOMA_COMMUNICATION_TRACK_DIAGNOSTICS: TacomaCommunicationTrackDiagnostic[] = [
  {
    ownerId: "uw-tacoma-communications",
    parsedUwCourseCodeCount: 2,
    sourceOnlyUwCourseCodeCount: 0,
    sourceRoleStatuses: ["primary"],
    sourceUrls: ["https://www.tacoma.uw.edu/sias/cac/communication"],
    runtimeConsideredCourseCodes: ["TCOM 201", "TCOM 230"],
  },
  {
    ownerId: "uw-tacoma-communications:pathway:professional-track",
    parsedUwCourseCodeCount: 45,
    sourceOnlyUwCourseCodeCount: 0,
    sourceRoleStatuses: ["primary"],
    sourceUrls: ["https://www.tacoma.uw.edu/sias/cac/professional-track"],
    runtimeConsideredCourseCodes: ["TCOM 201", "TCOM 230"],
  },
  {
    ownerId: "uw-tacoma-communications:pathway:research-track",
    parsedUwCourseCodeCount: 2,
    sourceOnlyUwCourseCodeCount: 0,
    sourceRoleStatuses: ["primary"],
    sourceUrls: ["https://www.tacoma.uw.edu/sias/cac/communication"],
    runtimeConsideredCourseCodes: ["TCOM 201", "TCOM 230"],
  },
];

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function buildOwnerId(planId: string, pathwayId: string | null) {
  return pathwayId ? `${planId}:pathway:${pathwayId}` : planId;
}

function parseOwnerId(ownerId: string) {
  const [planId, pathwayId = null] = ownerId.split(":pathway:");
  return { planId, pathwayId };
}

function buildTacomaOwnerTargets() {
  return getTransferPlannerSourceGeneratedMajorsForCampus("uw-tacoma").flatMap((plan) => [
    { planId: plan.id, pathwayId: null },
    ...getTransferPlannerPathwaysForPlan(plan).map((pathway) => ({
      planId: plan.id,
      pathwayId: pathway.id,
    })),
  ]);
}

function buildTacomaOwnerMismatchReport(): TacomaOwnerMismatchDiagnostic[] {
  return buildTacomaOwnerTargets().flatMap(({ planId, pathwayId }) => {
    const blocks = getTransferPlannerParsedRequirementSourceBlocks(planId, pathwayId);
    const parsedUwCourseCodes = uniqueSorted(
      blocks.flatMap((block) => block.parsedUwCourseCodes ?? [])
    );
    const sourceOnlyUwCourseCodes = uniqueSorted(
      blocks.flatMap((block) => block.sourceOnlyUwCourseCodes ?? [])
    );
    const structuredOnlyUwCourseCodes = uniqueSorted(
      blocks.flatMap((block) => block.structuredOnlyUwCourseCodes ?? [])
    );
    const sourceRoleStatuses = uniqueSorted(blocks.map((block) => block.sourceRoleStatus));
    const mismatchKinds: TacomaOwnerMismatchKind[] = [];

    if (sourceOnlyUwCourseCodes.length > 0) {
      mismatchKinds.push("source-only-uw-courses");
    }
    if (
      sourceOnlyUwCourseCodes.length > 0 &&
      sourceRoleStatuses.some((status) => status !== "primary")
    ) {
      mismatchKinds.push("source-only-courses-suppressed-by-source-role");
    }
    if (structuredOnlyUwCourseCodes.length > 0) {
      mismatchKinds.push("structured-only-uw-courses");
    }
    if (blocks.length > 0 && parsedUwCourseCodes.length === 0) {
      mismatchKinds.push("zero-parsed-uw-courses");
    }

    if (!mismatchKinds.length) {
      return [];
    }

    return [
      {
        ownerId: buildOwnerId(planId, pathwayId),
        mismatchKinds,
        parsedUwCourseCodeCount: parsedUwCourseCodes.length,
        sourceOnlyUwCourseCodeCount: sourceOnlyUwCourseCodes.length,
        structuredOnlyUwCourseCodeCount: structuredOnlyUwCourseCodes.length,
        sourceRoles: uniqueSorted(blocks.map((block) => block.sourceRole)),
        sourceRoleStatuses,
        parserTypes: uniqueSorted(blocks.map((block) => block.parserType)),
        sourceOnlySample: sourceOnlyUwCourseCodes.slice(0, SAMPLE_LIMIT),
        structuredOnlySample: structuredOnlyUwCourseCodes.slice(0, SAMPLE_LIMIT),
      },
    ];
  });
}

function buildTacomaBroadPathwayPatternReport(): TacomaBroadPathwayDiagnostic[] {
  return getTransferPlannerSourceGeneratedMajorsForCampus("uw-tacoma")
    .map((plan) => ({
      planId: plan.id,
      materializedPathwayLabels: getTransferPlannerPathwaysForPlan(plan).map(
        (pathway) => pathway.label
      ),
      parsedPathwayLabels: uniqueSorted(
        getTransferPlannerParsedRequirementSourceBlocks(plan.id, null).flatMap(
          (block) => block.pathwayLabels ?? []
        )
      ),
    }))
    .filter(
      (entry) => entry.materializedPathwayLabels.length > 0 || entry.parsedPathwayLabels.length > 0
    );
}

function buildTacomaCommunicationTrackDiagnostics(): TacomaCommunicationTrackDiagnostic[] {
  return [
    "uw-tacoma-communications",
    "uw-tacoma-communications:pathway:professional-track",
    "uw-tacoma-communications:pathway:research-track",
  ].map((ownerId) => {
    const { planId, pathwayId } = parseOwnerId(ownerId);
    const blocks = getTransferPlannerParsedRequirementSourceBlocks(planId, pathwayId);
    const runtimePlan = resolveTransferPlannerStudentRuntimeMajorPlan(
      getTransferPlannerStudentRuntimeMajorPlan(planId),
      pathwayId
    );

    return {
      ownerId,
      parsedUwCourseCodeCount: uniqueSorted(
        blocks.flatMap((block) => block.parsedUwCourseCodes ?? [])
      ).length,
      sourceOnlyUwCourseCodeCount: uniqueSorted(
        blocks.flatMap((block) => block.sourceOnlyUwCourseCodes ?? [])
      ).length,
      sourceRoleStatuses: uniqueSorted(blocks.map((block) => block.sourceRoleStatus)),
      sourceUrls: uniqueSorted(blocks.map((block) => block.sourceUrl)),
      runtimeConsideredCourseCodes: uniqueSorted(
        buildSourceBackedUwCourseConsideredSummaryEntries(runtimePlan).map(
          (entry) => entry.courseCode
        )
      ),
    };
  });
}

test("Tacoma owner/pathway mismatch inventory captures current source-only and zero-parse diagnostics", () => {
  assert.deepEqual(
    buildTacomaOwnerMismatchReport(),
    EXPECTED_TACOMA_OWNER_MISMATCH_REPORT
  );
});

test("Tacoma broad pages expose current track and option extraction diagnostics", () => {
  assert.deepEqual(
    buildTacomaBroadPathwayPatternReport(),
    EXPECTED_TACOMA_BROAD_PATHWAY_PATTERN_REPORT
  );
});

test("Tacoma Communications Professional and Research tracks expose parser/runtime imbalance", () => {
  assert.deepEqual(
    buildTacomaCommunicationTrackDiagnostics(),
    EXPECTED_TACOMA_COMMUNICATION_TRACK_DIAGNOSTICS
  );
});
