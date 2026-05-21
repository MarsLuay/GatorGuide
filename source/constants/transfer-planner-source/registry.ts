import {
  TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY,
  type TransferPlannerGrcCourseAvailabilityEntry,
} from "../transfer-planner-grc-availability.generated";
import {
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS,
  TRANSFER_PLANNER_BOOTSTRAP_TRACKS,
} from "./bootstrap.generated";
import {
  TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA,
  getTransferPlannerEquivalentCourseCodes,
  getTransferPlannerNormalizedCourseMetadataEntry,
} from "./course-metadata";
import { normalizeTransferPlannerCourseCode } from "./course-code-normalization";
import {
  TRANSFER_PLANNER_UW_GRC_ALL_EQUIVALENCY_RULES,
} from "./equivalency-guide.generated";
import {
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS,
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY,
} from "./requirement-source-adapters.generated";
import {
  TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS,
} from "./primary-source-promotions.generated";
import {
  buildTransferPlannerOwnerId,
  normalizeTransferPlannerPathwayId,
} from "./pathway-id-normalization";
import {
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATIONS,
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_SUMMARY,
} from "./requirement-diff-classifications.generated";
import {
  TRANSFER_PLANNER_SOURCE_GAP_ENTRIES,
} from "./source-gaps.generated";
import {
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINTS,
  TRANSFER_PLANNER_SOURCE_FINGERPRINTS,
} from "./source-fingerprints.generated";
import {
  materializeTransferPlannerPathways,
  normalizeMaterializedTransferPlannerPathwayLabel,
} from "./pathway-materialization";
import {
  normalizeTransferPlannerText,
  stripTransferPlannerPlanTitlePrefix,
} from "./pathway-title-normalization";
import { TRANSFER_PLANNER_DERIVED_SHARED_SOURCE_PLAN_ALIASES } from "./derived-shared-source-plans";
import {
  applyTransferPlannerManualSourceLinkOverride,
  getTransferPlannerManualPreferredPrimaryUrl,
  shouldSkipTransferPlannerAutoPromotedPrimarySource,
} from "./manual-source-link-overrides";
import type {
  TransferPlannerChecklistItem,
  TransferPlannerDegreeMapSection,
  TransferPlannerLink,
  TransferPlannerMajorPlan,
  TransferPlannerMajorPathway,
  TransferPlannerTrack,
  TransferPlannerTrackCatalogYear,
  TransferPlannerTrackTerm,
} from "../transfer-planner-types";
import type {
  TransferPlannerSourceManifestConfidence,
  TransferPlannerSourceManifestEntry,
  TransferPlannerSourceManifestOwnerType,
  TransferPlannerSourceManifestParserType,
  TransferPlannerSourceManifestRole,
  TransferPlannerCourseRegistryEntry,
  TransferPlannerCourseSourceKind,
  TransferPlannerDegreeMapBlock,
  TransferPlannerEffectiveYearRange,
  TransferPlannerEquivalencyRule,
  TransferPlannerMajorPathwayEntry,
  TransferPlannerMajorRequirementAtom,
  TransferPlannerParsedRequirementSourceBlock,
  TransferPlannerPolicyEntry,
  TransferPlannerRequirementDiffClassificationEntry,
  TransferPlannerRequirementPhase,
  TransferPlannerSourceLink,
  TransferPlannerSourceSchoolId,
} from "./schema";

const EXPLICIT_COURSE_CODE_PATTERN =
  /\b([A-Za-z&]{2,8}|[A-Za-z&]{1,4}(?:\s+[A-Za-z&]{1,4}))\s+(\d{3}(?:\.\d+)?[A-Za-z]?)\b/g;
const COURSE_NUMBER_CONTINUATION_PATTERN =
  /(?:^|[,(;/&]\s*|\b(?:or|and)\s+)(\d{3}(?:\.\d+)?[A-Za-z]?)(?=$|[\s,);/&]|(?:\s*(?:or|and)\b))/gi;
const INVALID_EXTRACTED_COURSE_SUBJECTS = new Set([
  "APPLY",
  "AND",
  "ANY",
  "APPROVED",
  "AT",
  "AUTUMN",
  "BEFORE",
  "BETWEEN",
  "BEYOND",
  "BOTH",
  "BUT",
  "BY",
  "CALL",
  "COMPLETE",
  "CONSIDER",
  "CORE",
  "COURSE",
  "COURSES",
  "CREDIT",
  "DATA",
  "DOES",
  "DIVISION",
  "EARNED",
  "EITHER",
  "ENGLISH",
  "FOR",
  "FROM",
  "GRADED",
  "HAS",
  "HAVE",
  "HAVEA",
  "INCLUDE",
  "INCLUDES",
  "INTO",
  "IS",
  "JUST",
  "LEAST",
  "LIKE",
  "MINIMUM",
  "MAX",
  "NOT",
  "OF",
  "OFFICE",
  "OCCUPIES",
  "ONE",
  "OR",
  "PLUS",
  "REACH",
  "REQUIRE",
  "REQUIRED",
  "REQUIRES",
  "ROOM",
  "SECTION",
  "SEPARATE",
  "SPRING",
  "BREADTH",
  "GROCERY",
  "THAT",
  "THE",
  "THEN",
  "THROUGH",
  "TO",
  "TOTALS",
  "TWO",
  "USE",
  "WANT",
  "WHILE",
  "WILL",
  "WINTER",
]);
const EXTRACTED_COURSE_SUBJECT_ALIASES: Partial<Record<string, string>> = {
  ACCOUNTING: "ACCTG",
  BIOENGINEERING: "BIOEN",
  BIOSTATISTICS: "BIOST",
  BIOLOGY: "BIOL",
  PHYSICS: "PHYS",
  SPANISH: "SPAN",
};
const LEADING_EXTRACTED_COURSE_SUBJECT_TOKENS = new Set(["AND", "AS", "OR"]);
const RECOVERABLE_LEADING_EXTRACTED_COURSE_SUBJECT_TOKENS = new Set([
  "AND",
  "AS",
  "BOTH",
  "EITHER",
  "IN",
  "OR",
  "PREREQ",
  "PREREQUISITE",
]);
const LEADING_LIST_MARKER_TOKENS = new Set(["I", "II", "III", "IV"]);
const KNOWN_UW_EXTRACTED_COURSE_SUBJECTS = new Set(
  TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA.filter((entry) => entry.schoolId !== "grc")
    .map((entry) => String(entry.code ?? "").match(/^([A-Z&]+(?: [A-Z&]+)*) \d/))
    .map((match) => match?.[1] ?? null)
    .filter(Boolean)
);
for (const supplementalSubject of ["THLEAD", "TSTAT"]) {
  KNOWN_UW_EXTRACTED_COURSE_SUBJECTS.add(supplementalSubject);
}
const SOURCE_BACKED_INTENTIONALLY_SKIPPED_VALIDATION_NOTE_PATTERN =
  /Auto-promotion was intentionally skipped/i;
const SOURCE_BACKED_NON_REQUIREMENT_CUE_PATTERN =
  /\b(suggested general education|not required for transferring|approved list|highly recommended|elective|replacement|course list|course lists|course evaluation|course evaluations|capstone course|capstone courses|suggested course pathways?)\b/i;
const DATE_PATTERN =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/;
const GRC_AVAILABILITY_SOURCE_LINKS: TransferPlannerSourceLink[] = [
  {
    label: "Green River annual schedule 2024-2025",
    url: "https://www.greenriver.edu/students/media/documents/schedules-and-catalog/2024-2025-Annual-Schedule.pdf",
  },
  {
    label: "Green River annual schedule 2025-2026",
    url: "https://www.greenriver.edu/students/media/documents/schedules-and-catalog/2025-2026%20Annual%20Schedule%20w%20Cover.pdf",
  },
];
const UW_GRC_EQUIVALENCY_LINK: TransferPlannerSourceLink = {
  label: "UW Green River transfer equivalency guide",
  url: "https://admit.washington.edu/apply/transfer/equivalency-guide/green-river/",
};
const ALL_UW_CAMPUSES: Exclude<TransferPlannerSourceSchoolId, "grc">[] = [
  "uw-seattle",
  "uw-bothell",
  "uw-tacoma",
];
type SupplementalParserOnlyMajorSource = {
  planId: string;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  ownerTitle: string;
  links: TransferPlannerSourceLink[];
  validationNotes: string[];
};
type SupplementalParserOnlyPathwaySource = {
  planId: string;
  pathwayId: string;
  campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
  majorTitle: string;
  label: string;
  links: TransferPlannerSourceLink[];
  validationNotes: string[];
  grcCourseList?: string[];
};
const TACOMA_BABA_SUPPLEMENTAL_PATHWAY_SOURCES =
  [
    ["accounting-option", "Accounting option", "UW Tacoma BABA Accounting curriculum"],
    ["finance-option", "Finance option", "UW Tacoma BABA Finance curriculum"],
    ["general-business-option", "General Business option", "UW Tacoma BABA General Business curriculum"],
    ["management-option", "Management option", "UW Tacoma BABA Management curriculum"],
    ["marketing-option", "Marketing option", "UW Tacoma BABA Marketing curriculum"],
  ].map(
    ([pathwayId, label, linkLabel]) =>
      ({
        planId: "uw-tacoma-bachelor-of-arts-in-business-administration",
        pathwayId,
        campusId: "uw-tacoma",
        majorTitle: "Bachelor of Arts in Business Administration (BABA)",
        label,
        links: [
          {
            label: linkLabel,
            url: "https://www.tacoma.uw.edu/business/design-courses-baba",
          },
        ],
        validationNotes: [
          "Supplemental parser-backed pathway metadata retained until Tacoma BABA option sections are emitted canonically.",
        ],
      }) satisfies SupplementalParserOnlyPathwaySource
  );
const TACOMA_HISTORY_SUPPLEMENTAL_PATHWAY_SOURCES =
  [
    [
      "general-history-option",
      "General History option",
      "UW Tacoma General History option requirements",
      "https://www.tacoma.uw.edu/sias-new/socs-new/general-option",
    ],
    [
      "arts-culture-and-society-option",
      "Arts, Culture and Society option",
      "UW Tacoma History Arts, Culture and Society option requirements",
      "https://www.tacoma.uw.edu/sias/socs/arts-culture-and-society-option",
    ],
    [
      "global-history-option",
      "Global History option",
      "UW Tacoma Global History option requirements",
      "https://www.tacoma.uw.edu/sias/socs/global-history-option",
    ],
    [
      "labor-and-social-movements-option",
      "Labor and Social Movements option",
      "UW Tacoma Labor and Social Movements option requirements",
      "https://www.tacoma.uw.edu/sias/socs/labor-and-social-movements-option",
    ],
    [
      "power-gender-and-identity-option",
      "Power, Gender and Identity option",
      "UW Tacoma Power, Gender and Identity option requirements",
      "https://www.tacoma.uw.edu/sias/socs/power-gender-and-identity-option",
    ],
  ].map(
    ([pathwayId, label, linkLabel, url]) =>
      ({
        planId: "uw-tacoma-history",
        pathwayId,
        campusId: "uw-tacoma",
        majorTitle: "History (BA)",
        label,
        links: [
          {
            label: linkLabel,
            url,
          },
          {
            label: "UW Tacoma History major options",
            url: "https://www.tacoma.uw.edu/sias/socs/history",
          },
        ],
        validationNotes: [
          "Supplemental parser-backed pathway metadata retained until Tacoma History option source blocks are emitted canonically.",
        ],
      }) satisfies SupplementalParserOnlyPathwaySource
  );
const SUPPLEMENTAL_PARSER_ONLY_MAJOR_SOURCES: SupplementalParserOnlyMajorSource[] = [
  {
    planId: "uw-seattle-classical-studies",
    campusId: "uw-seattle",
    ownerTitle: "Classical Studies",
    links: [
      {
        label: "UW Classical Studies degree requirements",
        url: "https://classics.washington.edu/ba-classical-studies",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed major metadata retained until the canonical bootstrap row is materialized.",
    ],
  },
  {
    planId: "uw-seattle-global-literary-studies",
    campusId: "uw-seattle",
    ownerTitle: "Global Literary Studies (BA)",
    links: [
      {
        label: "UW Global Literary Studies degree requirements",
        url: "https://slavic.washington.edu/ba-global-literary-studies-glits",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed major metadata retained until the canonical bootstrap row is materialized.",
    ],
  },
  {
    planId: "uw-tacoma-healthcare-leadership",
    campusId: "uw-tacoma",
    ownerTitle: "Healthcare Leadership (BA)",
    links: [
      {
        label: "UW Tacoma Healthcare Leadership degree requirements and sample program plan",
        url: "https://www.tacoma.uw.edu/nursing/healthcare-leadership-sample-program-plan",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed major metadata retained until the canonical bootstrap row is materialized.",
    ],
  },
  {
    planId: "uw-tacoma-nursing",
    campusId: "uw-tacoma",
    ownerTitle: "Nursing (RN-BSN)",
    links: [
      {
        label: "UW Tacoma Nursing RN-BSN degree requirements and sample program plan",
        url: "https://www.tacoma.uw.edu/nursing/rn-bsn-sample-program-plans",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed major metadata retained until the canonical bootstrap row is materialized.",
    ],
  },
  {
    planId: "uw-bothell-chemistry-ba",
    campusId: "uw-bothell",
    ownerTitle: "Chemistry (BA)",
    links: [
      {
        label: "Scoped section: B.A. in Chemistry requirements",
        url: "https://www.uwb.edu/stem/undergraduate/majors/chemistry/curriculum",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed major metadata retained until the canonical Bothell Chemistry BA source block is materialized.",
    ],
  },
];
const SUPPLEMENTAL_PARSER_ONLY_PATHWAY_SOURCES: SupplementalParserOnlyPathwaySource[] = [
  ...TACOMA_BABA_SUPPLEMENTAL_PATHWAY_SOURCES,
  {
    planId: "uw-bothell-chemistry-bs",
    pathwayId: "b-s-in-chemistry-general-option",
    campusId: "uw-bothell",
    majorTitle: "Chemistry (BS)",
    label: "B.S. in Chemistry (general option)",
    links: [
      {
        label: "Scoped section: B.S. in Chemistry (general option) requirements",
        url: "https://www.uwb.edu/stem/undergraduate/majors/chemistry/curriculum",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until the canonical Bothell Chemistry general option source block is emitted canonically.",
    ],
  },
  {
    planId: "uw-bothell-chemistry-bs",
    pathwayId: "biochemistry-option",
    campusId: "uw-bothell",
    majorTitle: "Chemistry (BS)",
    label: "Biochemistry Option",
    links: [
      {
        label: "Scoped section: B.S. in Chemistry (biochemistry option) requirements",
        url: "https://www.uwb.edu/stem/undergraduate/majors/chemistry/curriculum",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until the canonical Bothell Chemistry biochemistry option source block is emitted canonically.",
    ],
  },
  {
    planId: "uw-bothell-business-administration",
    pathwayId: "entrepreneurship-concentration",
    campusId: "uw-bothell",
    majorTitle: "Business Administration (BA)",
    label: "Entrepreneurship Concentration",
    links: [
      {
        label: "UW Bothell Entrepreneurship concentration major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/entrepreneurship",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until the canonical BBA concentration source blocks are emitted canonically.",
    ],
  },
  {
    planId: "uw-bothell-business-administration",
    pathwayId: "leadership-and-strategic-innovation-option",
    campusId: "uw-bothell",
    majorTitle: "Business Administration (BA)",
    label: "Leadership & Strategic Innovation Option",
    links: [
      {
        label: "UW Bothell Leadership and Strategic Innovation option major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/leadership",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until the canonical BBA option source blocks are emitted canonically.",
    ],
  },
  {
    planId: "uw-bothell-business-administration",
    pathwayId: "management-concentration",
    campusId: "uw-bothell",
    majorTitle: "Business Administration (BA)",
    label: "Management Concentration",
    links: [
      {
        label: "UW Bothell Management concentration major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/management",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until the canonical BBA concentration source blocks are emitted canonically.",
    ],
  },
  {
    planId: "uw-bothell-business-administration",
    pathwayId: "mis-concentration",
    campusId: "uw-bothell",
    majorTitle: "Business Administration (BA)",
    label: "Management Information Systems (MIS) Concentration",
    links: [
      {
        label: "UW Bothell MIS concentration major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/mis",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until the canonical BBA concentration source blocks are emitted canonically.",
    ],
  },
  {
    planId: "uw-bothell-business-administration",
    pathwayId: "retail-management-concentration",
    campusId: "uw-bothell",
    majorTitle: "Business Administration (BA)",
    label: "Retail Management Concentration",
    links: [
      {
        label: "UW Bothell Retail Management concentration major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/retail",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until the canonical BBA concentration source blocks are emitted canonically.",
    ],
  },
  {
    planId: "uw-bothell-business-administration",
    pathwayId: "supply-chain-management-option",
    campusId: "uw-bothell",
    majorTitle: "Business Administration (BA)",
    label: "Supply Chain Management Option",
    links: [
      {
        label: "UW Bothell Supply Chain Management option major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/supply-chain",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until the canonical BBA option source blocks are emitted canonically.",
    ],
  },
  {
    planId: "uw-bothell-business-administration",
    pathwayId: "tim-concentration",
    campusId: "uw-bothell",
    majorTitle: "Business Administration (BA)",
    label: "Technology & Innovation Management (TIM) Concentration",
    links: [
      {
        label: "UW Bothell Technology and Innovation Management concentration major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/tim",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until the canonical BBA concentration source blocks are emitted canonically.",
    ],
  },
  {
    planId: "uw-tacoma-environmental-sustainability",
    pathwayId: "business-nonprofit-leadership-option",
    campusId: "uw-tacoma",
    majorTitle: "Environmental Sustainability (BA)",
    label: "Business and Nonprofit Leadership option",
    links: [
      {
        label: "UW Tacoma Environmental Sustainability Business and Nonprofit Leadership option",
        url: "https://www.tacoma.uw.edu/sias/sam/environmental-sustainability",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until pathway source blocks are emitted canonically.",
    ],
  },
  {
    planId: "uw-tacoma-environmental-science",
    pathwayId: "general-environmental-science-option",
    campusId: "uw-tacoma",
    majorTitle: "Environmental Science (BS)",
    label: "General Environmental Science option",
    links: [
      {
        label: "UW Tacoma Environmental Science General Environmental Science option degree requirements",
        url: "https://www.tacoma.uw.edu/sias/sam/environmental-science",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until Environmental Science option source blocks are emitted canonically.",
    ],
  },
  {
    planId: "uw-tacoma-environmental-science",
    pathwayId: "conservation-biology-and-ecology-option",
    campusId: "uw-tacoma",
    majorTitle: "Environmental Science (BS)",
    label: "Conservation Biology and Ecology option",
    links: [
      {
        label: "UW Tacoma Environmental Science Conservation Biology and Ecology option degree requirements",
        url: "https://www.tacoma.uw.edu/sias/sam/environmental-science",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until Environmental Science option source blocks are emitted canonically.",
    ],
  },
  {
    planId: "uw-tacoma-environmental-science",
    pathwayId: "geoscience-option",
    campusId: "uw-tacoma",
    majorTitle: "Environmental Science (BS)",
    label: "Geoscience option",
    links: [
      {
        label: "UW Tacoma Environmental Science Geoscience option degree requirements",
        url: "https://www.tacoma.uw.edu/sias/sam/environmental-science",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until Environmental Science option source blocks are emitted canonically.",
    ],
  },
  {
    planId: "uw-tacoma-environmental-sustainability",
    pathwayId: "education-option",
    campusId: "uw-tacoma",
    majorTitle: "Environmental Sustainability (BA)",
    label: "Education option",
    links: [
      {
        label: "UW Tacoma Environmental Sustainability Education option",
        url: "https://www.tacoma.uw.edu/sias/sam/pre-environmental-education-option",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until pathway source blocks are emitted canonically.",
    ],
  },
  {
    planId: "uw-tacoma-environmental-sustainability",
    pathwayId: "environmental-communication-option",
    campusId: "uw-tacoma",
    majorTitle: "Environmental Sustainability (BA)",
    label: "Environmental Communication option",
    links: [
      {
        label: "UW Tacoma Environmental Communication option",
        url: "https://www.tacoma.uw.edu/sias/sam/environmental-communication-option",
      },
      {
        label: "UW Tacoma Environmental Sustainability overview",
        url: "https://www.tacoma.uw.edu/sias/sam/environmental-sustainability",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until pathway source blocks are emitted canonically.",
    ],
  },
  {
    planId: "uw-tacoma-environmental-sustainability",
    pathwayId: "policy-law-option",
    campusId: "uw-tacoma",
    majorTitle: "Environmental Sustainability (BA)",
    label: "Policy and Law option",
    links: [
      {
        label: "UW Tacoma Environmental Policy and Law option",
        url: "https://www.tacoma.uw.edu/sias/sam/environmental-policy-and-law-option",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until pathway source blocks are emitted canonically.",
    ],
  },
  ...TACOMA_HISTORY_SUPPLEMENTAL_PATHWAY_SOURCES,
  {
    planId: "uw-tacoma-writing-studies",
    pathwayId: "creative-writing-track",
    campusId: "uw-tacoma",
    majorTitle: "Writing Studies (BA)",
    label: "Creative Writing Track",
    links: [
      {
        label: "UW Tacoma Creative Writing track requirements",
        url: "https://www.tacoma.uw.edu/sias/cac/creative-writing-track",
      },
      {
        label: "UW Tacoma Writing Studies tracks",
        url: "https://www.tacoma.uw.edu/sias/cac/writing-studies",
      },
    ],
    validationNotes: [
      "Supplemental parser-backed pathway metadata retained until Tacoma Writing Studies track source blocks are emitted canonically.",
    ],
  },
];
const SUPPLEMENTAL_DERIVED_PATHWAY_GRC_COURSES_BY_KEY: Partial<Record<string, string[]>> = {
  "uw-tacoma-sustainable-urban-development::gis-option": ["GIS 260"],
  "uw-tacoma-urban-studies::gis-option": ["GIS 202"],
};
const INTERNAL_SOURCE_GENERATED_BASE_PLAN_IDS = new Set([
  ...TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.map((plan) => plan.id),
  ...SUPPLEMENTAL_PARSER_ONLY_MAJOR_SOURCES.map((entry) => entry.planId),
]);
const PHASE_CONFIG: Array<{
  phase: TransferPlannerRequirementPhase;
  itemsKey:
    | "applicationChecklist"
    | "beforeEnrollmentChecklist"
    | "stayAtGrcChecklist";
}> = [
  { phase: "before-application", itemsKey: "applicationChecklist" },
  { phase: "before-enrollment", itemsKey: "beforeEnrollmentChecklist" },
  { phase: "stay-at-grc", itemsKey: "stayAtGrcChecklist" },
];
const AVAILABILITY_QUARTER_LABELS: Record<string, string> = {
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
  spring: "Spring",
};
const GUIDE_TERM_ORDER: Partial<Record<string, number>> = {
  WIN: 1,
  SPR: 2,
  SUM: 3,
  AUT: 4,
};
type MutableCourseRegistryEntry = Omit<
  TransferPlannerCourseRegistryEntry,
  | "title"
  | "creditValue"
  | "creditLabel"
  | "catalogDescription"
  | "sourceKinds"
  | "sourceContexts"
  | "referencedByPlanIds"
  | "referencedByTrackIds"
  | "sourceLinks"
  | "effectiveYearLabels"
  | "effectiveYearRanges"
  | "prerequisiteCourseCodes"
  | "prerequisiteAlternativeCourseCodeSets"
  | "prerequisiteNotes"
  | "corequisiteCourseCodes"
  | "corequisiteAlternativeCourseCodeSets"
  | "corequisiteNotes"
  | "latestPublishedQuarters"
  | "notes"
> & {
  title: string | null;
  creditValue: number | null;
  creditLabel: string | null;
  catalogDescription: string | null;
  sourceKinds: Set<TransferPlannerCourseSourceKind>;
  sourceContexts: Set<string>;
  referencedByPlanIds: Set<string>;
  referencedByTrackIds: Set<string>;
  sourceLinks: Map<string, TransferPlannerSourceLink>;
  effectiveYearLabels: Set<string>;
  effectiveYearRanges: Map<string, TransferPlannerEffectiveYearRange>;
  prerequisiteCourseCodes: Set<string>;
  prerequisiteAlternativeCourseCodeSets: Set<string>;
  prerequisiteNotes: Set<string>;
  corequisiteCourseCodes: Set<string>;
  corequisiteAlternativeCourseCodeSets: Set<string>;
  corequisiteNotes: Set<string>;
  latestPublishedQuarters: Set<string>;
  notes: Set<string>;
};

function normalizeCourseCode(value: string) {
  return normalizeTransferPlannerCourseCode(value);
}

function parseGuideTermSortValue(label: string | null | undefined) {
  const match = String(label ?? "")
    .toUpperCase()
    .match(/\b(WIN|SPR|SUM|AUT)\s+QTR\.\s+(\d{4})\b/);
  if (!match) {
    return null;
  }
  const quarter = GUIDE_TERM_ORDER[match[1]];
  if (!quarter) {
    return null;
  }
  return Number.parseInt(match[2], 10) * 10 + quarter;
}

function isEffectiveRangeActiveForGuideTerm(
  range: TransferPlannerEffectiveYearRange,
  termLabel: string
) {
  const termValue = parseGuideTermSortValue(termLabel);
  if (termValue === null) {
    return true;
  }

  const endValue = parseGuideTermSortValue(range.endLabel);
  if (range.startLabel === "prior-to-guide-cutoff") {
    return endValue === null ? true : termValue < endValue;
  }

  const startValue = parseGuideTermSortValue(range.startLabel);
  if (startValue !== null && termValue < startValue) {
    return false;
  }
  if (endValue !== null && termValue > endValue) {
    return false;
  }
  return true;
}

function extractCourseSubjectTokens(value: string) {
  return String(value ?? "")
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeExtractedCourseSubject(rawValue: string) {
  const rawSubject = String(rawValue ?? "").toUpperCase().trim().replace(/\s+/g, " ");
  const normalizedSubject = EXTRACTED_COURSE_SUBJECT_ALIASES[rawSubject] ?? rawSubject;
  let subjectTokens = extractCourseSubjectTokens(normalizedSubject);

  while (
    subjectTokens.length > 1 &&
    RECOVERABLE_LEADING_EXTRACTED_COURSE_SUBJECT_TOKENS.has(subjectTokens[0])
  ) {
    subjectTokens = subjectTokens.slice(1);
  }

  if (
    subjectTokens.length > 1 &&
    LEADING_EXTRACTED_COURSE_SUBJECT_TOKENS.has(subjectTokens[0])
  ) {
    subjectTokens = subjectTokens.slice(1);
  }

  if (subjectTokens.length > 1 && LEADING_LIST_MARKER_TOKENS.has(subjectTokens[0])) {
    subjectTokens = subjectTokens.slice(1);
  }

  const subject = subjectTokens.join(" ");
  const collapsedSubject = subjectTokens.join("");
  const hasDanglingAmpersandToken = subjectTokens.some((token) => {
    if (token === "&") {
      return true;
    }

    if (!token.endsWith("&")) {
      return false;
    }

    // Green River subjects like MATH&, PHYS&, and ENGR& are valid course
    // prefixes. Reject only malformed trailing-ampersand fragments.
    return !/^[A-Z]{2,7}&$/.test(token);
  });

  if (
    subjectTokens.length > 1 &&
    KNOWN_UW_EXTRACTED_COURSE_SUBJECTS.has(collapsedSubject) &&
    !KNOWN_UW_EXTRACTED_COURSE_SUBJECTS.has(subject)
  ) {
    return collapsedSubject;
  }

  if (
    !subjectTokens.length ||
    subjectTokens.length > 2 ||
    (subjectTokens.length === 1 && subjectTokens[0].length < 2) ||
    hasDanglingAmpersandToken ||
    subjectTokens.some((token) => token.length > 8 || !/^[A-Z&]+$/.test(token)) ||
    INVALID_EXTRACTED_COURSE_SUBJECTS.has(subject) ||
    subjectTokens.some((token) => INVALID_EXTRACTED_COURSE_SUBJECTS.has(token))
  ) {
    return null;
  }

  return subject;
}

function normalizeExtractedCourseCode(rawSubject: string, rawNumber: string) {
  const subject = normalizeExtractedCourseSubject(rawSubject);
  const number = String(rawNumber ?? "").toUpperCase().trim().replace(/\s+/g, "");

  if (!subject || !/^\d{3}(?:\.\d+)?[A-Z]?$/.test(number) || /^000(?:\.0+)?[A-Z]?$/.test(number)) {
    return null;
  }

  return `${subject} ${number}`;
}

function extractCourseCodes(value: string) {
  const normalizedValue = String(value ?? "").toUpperCase().replace(/\s+/g, " ");
  const extractedCourseCodes: string[] = [];
  const explicitMatches = [...normalizedValue.matchAll(EXPLICIT_COURSE_CODE_PATTERN)]
    .map((match) => {
      const subject = normalizeExtractedCourseSubject(match[1]);
      const explicitCode = normalizeExtractedCourseCode(match[1], match[2]);
      if (!subject || !explicitCode) {
        return null;
      }

      return { match, subject, explicitCode };
    })
    .filter(Boolean) as Array<{
      match: RegExpMatchArray;
      subject: string;
      explicitCode: string;
    }>;

  for (let index = 0; index < explicitMatches.length; index += 1) {
    const { match, subject, explicitCode } = explicitMatches[index];

    extractedCourseCodes.push(explicitCode);

    const currentMatchEnd = (match.index ?? 0) + match[0].length;
    const nextMatchStart =
      index + 1 < explicitMatches.length
        ? (explicitMatches[index + 1].match.index ?? normalizedValue.length)
        : normalizedValue.length;
    const trailingSegment = normalizedValue.slice(currentMatchEnd, nextMatchStart);

    for (const numberMatch of trailingSegment.matchAll(COURSE_NUMBER_CONTINUATION_PATTERN)) {
      const continuationCode = normalizeExtractedCourseCode(subject, numberMatch[1]);
      if (continuationCode) {
        extractedCourseCodes.push(continuationCode);
      }
    }
  }

  return unique(extractedCourseCodes);
}

export function extractTransferPlannerCourseCodes(value: string) {
  return extractCourseCodes(value);
}

function stripHistoricalCourseCodeAliases(value: string) {
  return String(value ?? "")
    .replace(/\((?:formerly|previously|formerly known as|renumbered from)[^)]*\)/gi, "")
    .replace(
      /\b(?:formerly|previously|formerly known as|renumbered from)\s+[A-Z&]{1,8}(?:\s+[A-Z&]{1,8})?\s+\d{3}(?:\.\d+)?[A-Z]?\b/gi,
      ""
    );
}

function extractCourseCodesFromList(values: string[]) {
  return unique(values.flatMap((value) => extractCourseCodes(stripHistoricalCourseCodeAliases(value))));
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function compact<T>(values: Array<T | null | undefined | false>) {
  return values.filter(Boolean) as T[];
}

function formatAvailabilitySourceWindow(
  availability: Pick<TransferPlannerGrcCourseAvailabilityEntry, "years">
) {
  const labels = availability.years.map((year) => year.label).filter(Boolean);
  if (!labels.length) return "the latest published Green River annual schedules";
  if (labels.length === 1) return `the latest published ${labels[0]} Green River annual schedule`;
  if (labels.length === 2) {
    return `the latest published ${labels[0]} and ${labels[1]} Green River annual schedules`;
  }
  return `the latest published Green River annual schedules (${labels.join(", ")})`;
}

function formatAvailabilitySummary(
  availability: Pick<
    TransferPlannerGrcCourseAvailabilityEntry,
    "status" | "years" | "latestPublishedQuarters"
  >
) {
  const yearSummaries = availability.years
    .filter((year) => year.quarters.length > 0)
    .map(
      (year) =>
        `${year.label}: ${year.quarters
          .map((quarter) => AVAILABILITY_QUARTER_LABELS[String(quarter)] ?? quarter)
          .join(", ")}`
    );
  const sourceWindow = formatAvailabilitySourceWindow(availability);
  const latestPublishedYearLabel = availability.years[availability.years.length - 1]?.label ?? null;

  if (availability.status === "published-in-latest-schedule") {
    return yearSummaries.length
      ? `Recent GRC annual schedule history: ${yearSummaries.join("; ")}.`
      : null;
  }

  if (availability.status === "published-in-recent-history-not-latest") {
    if (yearSummaries.length) {
      const latestSuffix = latestPublishedYearLabel
        ? ` Not published in the latest ${latestPublishedYearLabel} annual schedule.`
        : ` Not published in ${sourceWindow}.`;
      return `Recent GRC annual schedule history: ${yearSummaries.join("; ")}.${latestSuffix}`;
    }
    return `Found in recent Green River annual schedule history, but not in ${sourceWindow}.`;
  }

  if (availability.status === "catalog-listed-not-in-latest-schedules") {
    return `Listed in the current Green River catalog, but not found in ${sourceWindow}.`;
  }

  if (availability.status === "legacy-track-only-no-current-public-source") {
    return `Referenced only by legacy Green River track history and not found in the current Green River catalog or ${sourceWindow}.`;
  }

  return `Still referenced by the planner, but not found in the current Green River catalog or ${sourceWindow}.`;
}

function getRangeKey(range: TransferPlannerEffectiveYearRange) {
  return `${range.startLabel}|${range.endLabel ?? ""}|${range.note ?? ""}`;
}

function getAlternativeSetKey(codes: string[]) {
  return codes.map((code) => normalizeCourseCode(code)).join("||");
}

function dedupeLinks(links: TransferPlannerSourceLink[]) {
  const map = new Map<string, TransferPlannerSourceLink>();
  for (const link of links) {
    if (!link?.url) {
      continue;
    }
    map.set(link.url, link);
  }
  return Array.from(map.values());
}

function toSourceLinks(links?: TransferPlannerLink[]) {
  return dedupeLinks(
    (links ?? []).map((link) => ({
      label: link.label,
      url: link.url,
      note: link.note,
    }))
  );
}

const SOURCE_LINK_IDENTITY_STOP_TOKENS = new Set([
  "and",
  "the",
  "of",
  "in",
  "for",
  "major",
  "program",
  "degree",
  "route",
  "option",
  "track",
  "pathway",
  "concentration",
  "specialization",
]);

function buildSourceLinkIdentityTokens(...values: Array<string | null | undefined>) {
  return unique(
    values
      .flatMap((value) =>
        normalizeTransferPlannerText(value)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .split(" ")
      )
      .filter(
        (token) =>
          token.length >= 2 &&
          !SOURCE_LINK_IDENTITY_STOP_TOKENS.has(token)
      )
  );
}

function sourceIdentityTokenMatches(token: string, candidateTokens: Set<string>) {
  if (candidateTokens.has(token)) {
    return true;
  }

  if (token.endsWith("ies") && candidateTokens.has(`${token.slice(0, -3)}y`)) {
    return true;
  }

  if (token.endsWith("s") && token.length > 3 && candidateTokens.has(token.slice(0, -1))) {
    return true;
  }

  return false;
}

function sourceLinkMatchesPathwayIdentity(
  link: TransferPlannerSourceLink,
  pathway: TransferPlannerMajorPathway
) {
  const pathwayTokens = buildSourceLinkIdentityTokens(pathway.id, pathway.label);
  if (!pathwayTokens.length) {
    return false;
  }

  const linkTokens = new Set(
    buildSourceLinkIdentityTokens(link.label, link.url, link.note)
  );
  return pathwayTokens.every((token) =>
    sourceIdentityTokenMatches(token, linkTokens)
  );
}

function isPathwaySpecificSourceLink(link: TransferPlannerSourceLink) {
  return PATHWAY_SOURCE_CUE_PATTERN.test(`${link.label} ${link.url}`);
}

function materializeMatchedPathwayRequirementSourceLink(link: TransferPlannerSourceLink) {
  const searchable = `${link.label} ${link.url}`;
  if (PRIMARY_REQUIREMENT_CUE_PATTERN.test(searchable)) {
    return link;
  }

  return {
    ...link,
    label: `${link.label} major requirements`,
  };
}

function isOfficialTacomaSourceLink(link: TransferPlannerSourceLink) {
  try {
    const parsedUrl = new URL(String(link.url ?? ""));
    return /(?:^|\.)tacoma\.uw\.edu$/i.test(parsedUrl.hostname);
  } catch {
    return false;
  }
}

function isCleanTacomaTrackPathwayForSiblingInference(pathway: TransferPlannerMajorPathway) {
  const pathwayId = String(pathway.id ?? "");
  const label = normalizeTransferPlannerText(pathway.label);
  return (
    /^[a-z0-9]+(?:-[a-z0-9]+){0,5}-track$/i.test(pathwayId) &&
    !/\d/.test(pathwayId) &&
    /\btrack\b/i.test(label) &&
    !/\b(?:choose|complete|credits?|depending|minimum|need|required|requirements?|students?)\b/i.test(label)
  );
}

function buildTacomaSiblingPathwaySourceUrl(
  parentLink: TransferPlannerSourceLink,
  pathway: TransferPlannerMajorPathway
) {
  if (!isOfficialTacomaSourceLink(parentLink) || isPathwaySpecificSourceLink(parentLink)) {
    return null;
  }

  try {
    const parsedUrl = new URL(parentLink.url);
    const pathname = parsedUrl.pathname.replace(/\/+$/, "");
    if (!pathname || pathname === "/") {
      return null;
    }

    parsedUrl.pathname = `${pathname.replace(/\/[^/]+$/, "")}/${pathway.id}`;
    parsedUrl.search = "";
    parsedUrl.hash = "";
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function inferTacomaSiblingPathwaySourceLinks(
  plan: TransferPlannerMajorPlan,
  pathway: TransferPlannerMajorPathway,
  parentSourceLinks: TransferPlannerSourceLink[],
  pathwaySourceLinks: TransferPlannerSourceLink[]
) {
  if (
    plan.campusId !== "uw-tacoma" ||
    !isCleanTacomaTrackPathwayForSiblingInference(pathway) ||
    parentSourceLinks.some((link) => sourceLinkMatchesPathwayIdentity(link, pathway)) ||
    pathwaySourceLinks.some((link) => sourceLinkMatchesPathwayIdentity(link, pathway))
  ) {
    return [];
  }

  return dedupeLinks(
    parentSourceLinks
      .map((link) => buildTacomaSiblingPathwaySourceUrl(link, pathway))
      .filter((url): url is string => Boolean(url))
      .map((url) => ({
        label: `${normalizeTransferPlannerText(pathway.label)} degree requirements`,
        url,
        note:
          "Inferred Tacoma sibling track page from the official broad program source and pathway slug.",
      }))
  );
}

function getSourceManifestOwnerId(planId: string, pathwayId?: string | null) {
  return pathwayId ? `${planId}:pathway:${pathwayId}` : planId;
}

const AUTO_PROMOTED_PRIMARY_SOURCE_LINKS_BY_OWNER_ID = new Map(
  TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS.map((entry) => [
    entry.ownerId,
    {
      label: entry.label,
      url: entry.url,
    } satisfies TransferPlannerSourceLink,
  ])
);
const SUPPLEMENTAL_MANIFEST_SOURCE_LINKS_BY_OWNER_ID = new Map<
  string,
  TransferPlannerSourceLink[]
>([
  [
    "uw-tacoma-computer-science-and-systems-bs",
    [
      {
        label: "UW Tacoma Computer Science and Systems BS degree requirements",
        url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
        note:
          "Broad official BS page kept as the primary parser source so the full curriculum outranks scoped BA-option snapshot noise.",
      },
    ],
  ],
  [
    "uw-tacoma-environmental-science",
    [
      {
        label: "UW Tacoma Environmental Science BS degree requirements",
        url: "https://www.tacoma.uw.edu/sias/sam/environmental-science",
        note:
          "Broad official BS page kept as the primary parser source so preparatory, core, capstone, and option requirements are parsed together.",
      },
    ],
  ],
  [
    "uw-seattle-computer-science",
    [
      {
        label: "Allen School CS-approved Natural Science course list",
        url: "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#natural-science",
        note:
          "Supporting official Allen School source for Computer Science approved-science validation; keep support-scoped so approved-list courses do not become required schedule rows.",
      },
    ],
  ],
  [
    "uw-seattle-computer-science:pathway:data-science-option",
    [
      {
        label: "Allen School CS-approved Natural Science course list",
        url: "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#natural-science",
        note:
          "Supporting official Allen School source for Computer Science approved-science validation; keep support-scoped so approved-list courses do not become required schedule rows.",
      },
    ],
  ],
  [
    "uw-seattle-computer-engineering",
    [
      {
        label: "Allen School CE-approved Natural Science course list",
        url: "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#natural-science",
        note:
          "Supporting official Allen School source for the Computer Engineering Natural Science approved-course filter; use with UW-GRC equivalency rules, not generic NSc/NW tags.",
      },
    ],
  ],
  [
    "uw-bothell-data-visualization-ba",
    [
      {
        label: "UW Bothell major planning worksheet - Data Visualization (BA)",
        url: "https://admissions.uwb.edu/register/mpw-DataVis-BA",
        note:
          "Dedicated official admissions worksheet kept as a supplemental manifest source so lower-division preparation cues can merge safely without replacing the broader program overview.",
      },
    ],
  ],
  [
    "uw-bothell-data-visualization-bs",
    [
      {
        label: "UW Bothell major planning worksheet - Data Visualization (BS)",
        url: "https://admissions.uwb.edu/register/mpw-DataVis-BS",
        note:
          "Dedicated official admissions worksheet kept as a supplemental manifest source so lower-division preparation cues can merge safely without replacing the broader program overview.",
      },
    ],
  ],
]);

function mergeAutoPromotedPrimarySourceLink(
  links: TransferPlannerSourceLink[],
  planId: string,
  pathwayId?: string | null
) {
  const promotedLink = AUTO_PROMOTED_PRIMARY_SOURCE_LINKS_BY_OWNER_ID.get(
    getSourceManifestOwnerId(planId, pathwayId)
  );
  return promotedLink ? dedupeLinks([promotedLink, ...links]) : dedupeLinks(links);
}

function getOwnerSourceLinks(
  planId: string,
  pathwayId?: string | null,
  links?: TransferPlannerLink[]
) {
  return applyTransferPlannerManualSourceLinkOverride(
    planId,
    pathwayId,
    mergeAutoPromotedPrimarySourceLink(toSourceLinks(links), planId, pathwayId)
  );
}

function getSupplementalManifestSourceLinks(planId: string, pathwayId?: string | null) {
  return SUPPLEMENTAL_MANIFEST_SOURCE_LINKS_BY_OWNER_ID.get(
    getSourceManifestOwnerId(planId, pathwayId)
  ) ?? [];
}

function getCourseId(schoolId: TransferPlannerSourceSchoolId, code: string) {
  const slug = normalizeCourseCode(code)
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${schoolId}:${slug}`;
}

function parseCourseParts(code: string) {
  const normalizedCode = normalizeCourseCode(code);
  const match = normalizedCode.match(/^([A-Z]{2,8}&?)\s*(\d{3}(?:\.\d+)?[A-Z]?)$/);
  const subjectCode = match?.[1] ?? normalizedCode.split(" ")[0] ?? normalizedCode;
  const catalogNumber = match?.[2] ?? normalizedCode.split(" ").slice(1).join(" ");
  const numericMatch = catalogNumber.match(/\d{3}/);
  return {
    subjectCode,
    catalogNumber,
    level: numericMatch ? Number.parseInt(numericMatch[0][0], 10) * 100 : null,
  };
}

function getLastValidatedOn(validationNotes: string[]) {
  for (const note of validationNotes) {
    const match = String(note ?? "").match(DATE_PATTERN);
    if (match) {
      return match[0];
    }
  }
  return null;
}

const UW_GENERAL_CATALOG_PROGRAM_URL_PATTERN =
  /\/\/(?:www\.)?washington\.edu\/students\/gencat\/program\//i;
const UW_GENERAL_CATALOG_MAJOR_ANCHOR_PATTERN = /#(?:program|credential)-UG-[A-Z0-9-]+/i;
const PATHWAY_SOURCE_CUE_PATTERN =
  /\b(track|option|route|pathway|concentration|specialization)\b/i;
const PATHWAY_DEGREE_SHEET_CUE_PATTERN =
  /\b(degree sheet|requirement sheet|requirements packet|checklist|worksheet|plan of study|study plan)\b|degreq/i;
const APPROVED_COURSE_LIST_CUE_PATTERN =
  /\bapproved\b.{0,60}\b(courses?|course list|list)\b|\b(courses?|course list|list)\b.{0,60}\bapproved\b/i;
const ELECTIVE_LIST_CUE_PATTERN =
  /\b(?:engineering|technical|departmental|major|science|natural science|approved)?\s*electives?\b.{0,50}\b(courses?|list|options?|page)\b|\b(courses?|list|options?)\b.{0,50}\belectives?\b|\/electives?(?:[-/]|$)/i;
const UPPER_DIVISION_PREREQUISITE_CUE_PATTERN =
  /\b(?:upper[-\s]?division|[34]00[-\s]?level|[34]00\s+level)\b.{0,80}\bprereq(?:uisites?)?\b|\bprereq(?:uisites?)?\b.{0,80}\b(?:upper[-\s]?division|[34]00[-\s]?level|[34]00\s+level)\b/i;
const NON_SCHEDULABLE_COURSE_LIST_CUE_PATTERN =
  /\b(course lists?|list of courses|courses by track|course descriptions?|all courses|course catalog|print courses?|suggested course pathways?|computing specializations?|capstones?)\b|\/(?:courses?|course-list|course-lists|print\/courses|capstones?|computing-specializations)(?:[-/?#]|$)/i;
const ADMISSION_PREREQUISITE_SOURCE_CUE_PATTERN =
  /\b(?:admissions?|admission|apply|application)\b.{0,80}\bprereq(?:uisites?|uisite courses?)\b|\bprereq(?:uisites?|uisite courses?)\b.{0,80}\b(?:admissions?|admission|apply|application)\b/i;
const SUPPORT_SOURCE_CUE_PATTERN =
  /\b(advising|adviser|advisor|support sources?|student resources?|student support|forms?|petitions?|policies|policy[-\s]*(?:procedures?|resources?|forms?)|faq|frequently asked questions)\b/i;
const PRIMARY_REQUIREMENT_CUE_PATTERN =
  /\bdegree requirements?\b|\bmajor requirements?\b|\bgraduation requirements?\b|\bprogram requirements?\b|\bdegree structure\b|\brequirements packet\b|\bdegreq\b/i;

function isLinkedDocumentSourceUrl(url: unknown) {
  return /\.(?:pdf|docx)(?:$|[?#])/i.test(String(url ?? ""));
}

function isWorksheetSourceLink(link: TransferPlannerSourceLink) {
  return /\b(?:worksheet|check\s*list|checklist)\b/i.test(`${link.label} ${link.url}`);
}

function getSourceManifestRoleStatus(role: TransferPlannerSourceManifestRole) {
  switch (role) {
    case "degree-requirements":
    case "catalog":
    case "curriculum":
    case "pathway-degree-sheet":
    case "worksheet":
      return "primary";
    case "upper-division-prerequisite-table":
    case "non-schedulable-course-list":
      return "non-schedulable";
    case "admission-prerequisite-source":
    case "approved-course-list":
    case "elective-list":
    case "support-source":
    case "admissions":
    case "overview":
    case "equivalency":
    case "availability":
    case "other":
      return "support";
  }
}

function canSourceManifestRoleCreateSchedulableRows(role: TransferPlannerSourceManifestRole) {
  return getSourceManifestRoleStatus(role) === "primary";
}

function getSourceManifestRole(link: TransferPlannerSourceLink): TransferPlannerSourceManifestRole {
  const searchable = `${link.label} ${link.url}`.toLowerCase();

  if (PATHWAY_DEGREE_SHEET_CUE_PATTERN.test(searchable) && PATHWAY_SOURCE_CUE_PATTERN.test(searchable)) {
    return "pathway-degree-sheet";
  }

  if (APPROVED_COURSE_LIST_CUE_PATTERN.test(searchable)) {
    return "approved-course-list";
  }

  if (ELECTIVE_LIST_CUE_PATTERN.test(searchable)) {
    return "elective-list";
  }

  if (UPPER_DIVISION_PREREQUISITE_CUE_PATTERN.test(searchable)) {
    return "upper-division-prerequisite-table";
  }

  if (
    PRIMARY_REQUIREMENT_CUE_PATTERN.test(searchable) ||
    /\bdegree sheet\b|\brequirement sheet\b|\bchecklist\b/.test(searchable)
  ) {
    return "degree-requirements";
  }

  if (NON_SCHEDULABLE_COURSE_LIST_CUE_PATTERN.test(searchable)) {
    return "non-schedulable-course-list";
  }

  if (ADMISSION_PREREQUISITE_SOURCE_CUE_PATTERN.test(searchable)) {
    return "admission-prerequisite-source";
  }

  if (SUPPORT_SOURCE_CUE_PATTERN.test(searchable)) {
    return "support-source";
  }

  if (/equivalency/.test(searchable)) {
    return "equivalency";
  }

  if (/annual schedule|schedule-and-catalog/.test(searchable)) {
    return "availability";
  }

  if (/worksheet/.test(searchable)) {
    return "worksheet";
  }

  if (UW_GENERAL_CATALOG_PROGRAM_URL_PATTERN.test(searchable)) {
    return "catalog";
  }

  if (/catalog/.test(searchable)) {
    return "catalog";
  }

  if (/admission|admissions|apply|application|prerequisite/.test(searchable)) {
    return "admissions";
  }

  if (/curriculum/.test(searchable)) {
    return "curriculum";
  }

  if (/overview|undergraduate|program|major/.test(searchable)) {
    return "overview";
  }

  return "other";
}

function getSourceManifestParserType(
  link: TransferPlannerSourceLink,
  role: TransferPlannerSourceManifestRole
): TransferPlannerSourceManifestParserType {
  const normalizedUrl = String(link.url ?? "").toLowerCase();
  const isDocument = isLinkedDocumentSourceUrl(normalizedUrl);
  const isWorksheetDocument = isDocument && isWorksheetSourceLink(link);

  if (role === "availability") {
    return "annual-schedule-pdf";
  }

  if (role === "equivalency") {
    return "equivalency-guide";
  }

  if (role === "catalog") {
    return "catalog-page";
  }

  if (isDocument && (role === "worksheet" || isWorksheetDocument)) {
    return "pdf-worksheet";
  }

  if (isDocument && (role === "degree-requirements" || role === "curriculum" || role === "pathway-degree-sheet")) {
    return "pdf-degree-sheet";
  }

  if (isDocument) {
    return "generic-pdf";
  }

  if (role === "degree-requirements" || role === "pathway-degree-sheet") {
    return "html-degree-page";
  }

  if (role === "admissions" || role === "admission-prerequisite-source") {
    return "html-admissions-page";
  }

  if (role === "curriculum") {
    return "html-curriculum-page";
  }

  if (role === "overview") {
    return "html-overview-page";
  }

  if (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://")) {
    return "generic-html";
  }

  return "unknown";
}

function isTransferPlannerSourceManifestParserType(
  value: unknown
): value is TransferPlannerSourceManifestParserType {
  return (
    value === "html-degree-page" ||
    value === "html-admissions-page" ||
    value === "html-curriculum-page" ||
    value === "html-overview-page" ||
    value === "catalog-page" ||
    value === "equivalency-guide" ||
    value === "pdf-degree-sheet" ||
    value === "pdf-worksheet" ||
    value === "annual-schedule-pdf" ||
    value === "generic-html" ||
    value === "generic-pdf" ||
    value === "unknown"
  );
}

function getAutoPromotedSourceManifestRole(
  promotion: (typeof TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS)[number],
  fallbackRole: TransferPlannerSourceManifestRole
): TransferPlannerSourceManifestRole {
  switch (promotion.sourceRole) {
    case "official-catalog":
      return "catalog";
    case "primary-degree-requirements":
    case "department-requirements":
      return "degree-requirements";
    case "pathway-degree-sheet":
      return "pathway-degree-sheet";
    case "approved-course-list":
      return "approved-course-list";
    case "elective-list":
      return "elective-list";
    case "upper-division-prerequisite-table":
      return "upper-division-prerequisite-table";
    case "non-schedulable-course-list":
      return "non-schedulable-course-list";
    case "support-source":
      return "support-source";
    case "admission-prerequisite-source":
    case "admissions-preparation":
      return "admission-prerequisite-source";
    case "curriculum-map":
      return "curriculum";
    case "transfer-equivalency":
    case "matched-grc-track":
      return "equivalency";
    case "sample-schedule":
    case "old-archival":
    case "ignored":
    case null:
    case undefined:
      return fallbackRole;
    default:
      return fallbackRole;
  }
}

function getAutoPromotedSourceManifestParserType(
  promotion: (typeof TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS)[number],
  link: TransferPlannerSourceLink,
  role: TransferPlannerSourceManifestRole
): TransferPlannerSourceManifestParserType {
  if (isTransferPlannerSourceManifestParserType(promotion.parserType)) {
    return promotion.parserType;
  }

  return getSourceManifestParserType(link, role);
}

function getSourceManifestConfidence(
  role: TransferPlannerSourceManifestRole,
  parserType: TransferPlannerSourceManifestParserType
): TransferPlannerSourceManifestConfidence {
  if (
    parserType === "annual-schedule-pdf" ||
    parserType === "equivalency-guide" ||
    parserType === "html-degree-page" ||
    parserType === "pdf-degree-sheet" ||
    role === "pathway-degree-sheet"
  ) {
    return "high";
  }

  if (
    role === "admissions" ||
    role === "admission-prerequisite-source" ||
    role === "approved-course-list" ||
    role === "curriculum" ||
    role === "elective-list" ||
    role === "catalog" ||
    role === "support-source" ||
    role === "worksheet" ||
    parserType === "html-admissions-page" ||
    parserType === "html-curriculum-page" ||
    parserType === "catalog-page" ||
    parserType === "pdf-worksheet"
  ) {
    return "medium";
  }

  return "low";
}

function getSourceManifestPrimaryScore(link: TransferPlannerSourceLink) {
  const role = getSourceManifestRole(link);
  const parserType = getSourceManifestParserType(link, role);
  const searchable = `${link.label} ${link.url}`.toLowerCase();

  let score = 0;
  if (role === "degree-requirements") score += 100;
  if (role === "pathway-degree-sheet") score += 92;
  if (role === "worksheet") score += 84;
  if (role === "curriculum") score += 70;
  if (role === "catalog") score += 50;
  if (UW_GENERAL_CATALOG_PROGRAM_URL_PATTERN.test(searchable)) score += 35;
  if (
    UW_GENERAL_CATALOG_PROGRAM_URL_PATTERN.test(searchable) &&
    UW_GENERAL_CATALOG_MAJOR_ANCHOR_PATTERN.test(searchable)
  ) {
    score += 12;
  }
  if (parserType === "pdf-degree-sheet") score += 20;
  if (parserType === "pdf-worksheet") score += 18;
  if (/degree requirements|major requirements|graduation requirements/.test(searchable)) score += 25;
  if (/curriculum/.test(searchable)) score += 15;
  if (/\b(?:worksheet|checklist|plan of study|study plan)\b/.test(searchable)) score += 18;
  if (
    (role === "degree-requirements" || role === "curriculum" || role === "pathway-degree-sheet") &&
    /\b(track|option|route|pathway|concentration|specialization)\b/.test(searchable)
  ) {
    score += 8;
  }
  if (!canSourceManifestRoleCreateSchedulableRows(role)) score -= 40;
  if (role === "admissions" || role === "equivalency" || role === "availability") score -= 40;

  return score;
}

const PATHWAY_TITLE_SUFFIX_PATTERNS = [
  /\s+degree preparation and admissions$/i,
  /\s+before-enrollment degree head starts$/i,
  /\s+stay-at-green-river degree support$/i,
  /\s+source-backed degree planning$/i,
  /\s+parsed official source requirements$/i,
  /\s+parsed official requirement cues$/i,
  /\s+parsed choices and pathway notes$/i,
];
const PATHWAY_LABEL_SPECIAL_TOKEN_MAP: Record<string, string> = {
  aas: "AAS",
  acs: "ACS",
  ba: "B.A.",
  bs: "B.S.",
  ce: "CE",
  cs: "CS",
  ece: "ECE",
  egls: "EGLS",
  esrm: "ESRM",
  gis: "GIS",
  gls: "GLS",
  iac: "IAC",
  nme: "NME",
  phd: "Ph.D.",
  phgh: "PH-GH",
  sud: "SUD",
  uw: "UW",
};
const PATHWAY_LABEL_LOWERCASE_TOKENS = new Set([
  "and",
  "for",
  "in",
  "of",
  "on",
  "option",
  "pathway",
  "route",
  "to",
  "track",
  "with",
]);
const PATHWAY_LABEL_ALIGNMENT_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "concentration",
  "family",
  "for",
  "in",
  "of",
  "on",
  "option",
  "pathway",
  "route",
  "school",
  "the",
  "to",
  "track",
  "with",
]);

function normalizePathwayLabel(value: string | null | undefined) {
  return normalizeMaterializedTransferPlannerPathwayLabel(value);
}

function stripPathwayTitleSuffix(value: string) {
  let stripped = normalizePathwayLabel(value);
  for (const pattern of PATHWAY_TITLE_SUFFIX_PATTERNS) {
    stripped = stripped.replace(pattern, "").trim();
  }
  return stripped;
}

function stripPlanTitlePrefix(planTitle: string, value: string) {
  return stripTransferPlannerPlanTitlePrefix(planTitle, value);

  const normalizedPlanTitle = normalizePathwayLabel(planTitle);
  const normalizedValue = normalizePathwayLabel(value);
  if (!normalizedPlanTitle) {
    return normalizedValue;
  }
  if (normalizedValue === normalizedPlanTitle) {
    return "";
  }

  for (const separator of [" - ", ": ", " â€“ "]) {
    const prefix = `${normalizedPlanTitle}${separator}`;
    if (normalizedValue.startsWith(prefix)) {
      return normalizedValue.slice(prefix.length).trim();
    }
  }

  return normalizedValue;
}

function isLikelyStructuredPathwayLabel(label: string) {
  const normalized = normalizePathwayLabel(label);
  if (!normalized) {
    return false;
  }
  if (/^\[page \d+\]/i.test(normalized)) {
    return false;
  }
  if (/parsed official|parsed choices|parsed requirement/i.test(normalized)) {
    return false;
  }
  if (normalized.length > 96) {
    return false;
  }
  if (normalized.includes("?")) {
    return false;
  }
  if (
    /\binformal\b/i.test(normalized) ||
    /\bconcentration areas?\b/i.test(normalized) ||
    /^(?:explore|how do i|planning|what is the difference)\b/i.test(normalized) ||
    /^b\.?\s*s\.?\s+with\b/i.test(normalized)
  ) {
    return false;
  }
  if (normalized.split(/\s+/).length > 12) {
    return false;
  }
  return true;
}

function formatPathwayLabelToken(token: string) {
  const normalizedToken = String(token ?? "").trim().toLowerCase();
  if (!normalizedToken) {
    return "";
  }
  if (PATHWAY_LABEL_SPECIAL_TOKEN_MAP[normalizedToken]) {
    return PATHWAY_LABEL_SPECIAL_TOKEN_MAP[normalizedToken];
  }
  if (PATHWAY_LABEL_LOWERCASE_TOKENS.has(normalizedToken)) {
    return normalizedToken;
  }
  return normalizedToken.charAt(0).toUpperCase() + normalizedToken.slice(1);
}

function formatPathwayLabelFromId(pathwayId: string) {
  const optionFamilyMatch = String(pathwayId ?? "").match(/^(ba|bs)-option-family:(.+)$/i);
  if (optionFamilyMatch) {
    const degreeLabel = formatPathwayLabelToken(optionFamilyMatch[1]);
    const optionLabel = optionFamilyMatch[2]
      .split(/[-:]+/)
      .map((token) => formatPathwayLabelToken(token))
      .filter(Boolean)
      .join(" ");
    return normalizePathwayLabel(`${degreeLabel} ${optionLabel} option`);
  }

  return String(pathwayId ?? "")
    .split(/[:]+/)
    .flatMap((segment) => segment.split(/-+/))
    .map((token) => formatPathwayLabelToken(token))
    .filter(Boolean)
    .join(" ");
}

function maybeExtractStructuredPathwayLabel(planTitle: string, candidate: string | null | undefined) {
  const strippedLabel = stripPathwayTitleSuffix(
    stripPlanTitlePrefix(planTitle, String(candidate ?? ""))
  );
  if (!isLikelyStructuredPathwayLabel(strippedLabel)) {
    return null;
  }
  return strippedLabel;
}

function getPathwayAlignmentTokens(label: string) {
  return Array.from(
    new Set(
      normalizePathwayLabel(label)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 2 && !PATHWAY_LABEL_ALIGNMENT_STOPWORDS.has(token))
    )
  );
}

function getPathwayLabelAlignmentScore(left: string, right: string) {
  const rightTokens = new Set(getPathwayAlignmentTokens(right));
  if (!rightTokens.size) {
    return 0;
  }

  return getPathwayAlignmentTokens(left).filter((token) => rightTokens.has(token)).length;
}

function resolveRegistryPathwayLabel(
  plan: TransferPlannerMajorPlan,
  pathway: TransferPlannerMajorPathway
) {
  const formattedIdLabel = formatPathwayLabelFromId(pathway.id);
  const candidates = new Map<string, number>();
  const supplementalPathwaySource = SUPPLEMENTAL_PARSER_ONLY_PATHWAY_SOURCES.find(
    (entry) => entry.planId === plan.id && entry.pathwayId === pathway.id
  );

  function pushCandidate(
    label: string | null | undefined,
    priority: number,
    options: { requirePathwayAlignment?: boolean } = {}
  ) {
    const normalizedLabel = normalizePathwayLabel(label);
    if (!normalizedLabel) {
      return;
    }
    if (options.requirePathwayAlignment) {
      const alignmentScore = getPathwayLabelAlignmentScore(normalizedLabel, formattedIdLabel);
      if (alignmentScore === 0) {
        return;
      }
    }
    const currentPriority = candidates.get(normalizedLabel) ?? Number.NEGATIVE_INFINITY;
    if (priority > currentPriority) {
      candidates.set(normalizedLabel, priority);
    }
  }

  const scopedRequirements = TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY.filter(
    (entry) => entry.planId === plan.id && entry.pathwayId === pathway.id
  );
  const scopedDegreeMapBlocks = TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY.filter(
    (entry) => entry.planId === plan.id && entry.pathwayId === pathway.id
  );
  const scopedParsedBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (entry) => entry.planId === plan.id && entry.pathwayId === pathway.id
  );

  for (const requirement of scopedRequirements) {
    pushCandidate(
      maybeExtractStructuredPathwayLabel(plan.title, requirement.majorTitle),
      140,
      { requirePathwayAlignment: true }
    );
  }

  for (const block of scopedDegreeMapBlocks) {
    pushCandidate(
      maybeExtractStructuredPathwayLabel(plan.title, block.majorTitle),
      130,
      { requirePathwayAlignment: true }
    );
    pushCandidate(
      maybeExtractStructuredPathwayLabel(plan.title, block.title),
      120,
      { requirePathwayAlignment: true }
    );
  }

  for (const parsedBlock of scopedParsedBlocks) {
    pushCandidate(
      maybeExtractStructuredPathwayLabel(plan.title, parsedBlock.ownerTitle),
      110,
      { requirePathwayAlignment: true }
    );
    for (const candidate of parsedBlock.parsedDegreeMapBlockCandidates ?? []) {
      pushCandidate(
        maybeExtractStructuredPathwayLabel(plan.title, candidate.title),
        105,
        { requirePathwayAlignment: true }
      );
    }
  }

  pushCandidate(supplementalPathwaySource?.label, 150, {
    requirePathwayAlignment: true,
  });
  pushCandidate(
    maybeExtractStructuredPathwayLabel(plan.title, pathway.label),
    80,
    { requirePathwayAlignment: true }
  );
  pushCandidate(formattedIdLabel, 10);

  const [resolvedLabel = normalizePathwayLabel(pathway.label) || formattedIdLabel] = [...candidates.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      if (left[0].length !== right[0].length) {
        return left[0].length - right[0].length;
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([label]) => label);

  return resolvedLabel;
}

const BLOCKED_PRIMARY_SOURCE_URL_PATTERN =
  /\/saml\/login|shibboleth\.sso\/login|\/print\/courses|\/wp-login/i;

function isBlockedPrimarySourceUrl(url: string) {
  return BLOCKED_PRIMARY_SOURCE_URL_PATTERN.test(String(url ?? ""));
}

function isSafeFallbackPrimaryRole(role: TransferPlannerSourceManifestRole) {
  return canSourceManifestRoleCreateSchedulableRows(role) || role === "overview" || role === "other";
}

function pickPrimaryDegreeRequirementsUrl(links: TransferPlannerSourceLink[]) {
  const scoredLinks = dedupeLinks(links)
    .map((link) => ({
      link,
      role: getSourceManifestRole(link),
      score: getSourceManifestPrimaryScore(link),
    }));

  const candidates = scoredLinks
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.link.url.localeCompare(right.link.url));

  if (candidates.length) {
    return candidates[0]?.link.url ?? null;
  }

  const fallbackCandidates = scoredLinks
    .filter((entry) => !isBlockedPrimarySourceUrl(entry.link.url))
    .filter((entry) => isSafeFallbackPrimaryRole(entry.role))
    .sort((left, right) => right.score - left.score || left.link.url.localeCompare(right.link.url));

  return fallbackCandidates[0]?.link.url ?? null;
}

function createMutableCourseEntry(
  schoolId: TransferPlannerSourceSchoolId,
  code: string
): MutableCourseRegistryEntry {
  const normalizedCode = normalizeCourseCode(code);
  const parts = parseCourseParts(normalizedCode);
  return {
    id: getCourseId(schoolId, normalizedCode),
    schoolId,
    code: normalizedCode,
    displayLabel: normalizedCode,
    title: null,
    creditValue: null,
    creditLabel: null,
    catalogDescription: null,
    subjectCode: parts.subjectCode,
    catalogNumber: parts.catalogNumber,
    level: parts.level,
    sourceKinds: new Set(),
    sourceContexts: new Set(),
    referencedByPlanIds: new Set(),
    referencedByTrackIds: new Set(),
    sourceLinks: new Map(),
    effectiveYearLabels: new Set(),
    effectiveYearRanges: new Map(),
    prerequisiteCourseCodes: new Set(),
    prerequisiteAlternativeCourseCodeSets: new Set(),
    prerequisiteNotes: new Set(),
    corequisiteCourseCodes: new Set(),
    corequisiteAlternativeCourseCodeSets: new Set(),
    corequisiteNotes: new Set(),
    lastValidatedOn: null,
    latestAvailabilitySummary: null,
    latestPublishedQuarters: new Set(),
    notes: new Set(),
  };
}

function getOrCreateCourse(
  registry: Map<string, MutableCourseRegistryEntry>,
  schoolId: TransferPlannerSourceSchoolId,
  code: string
) {
  const normalizedCode = normalizeCourseCode(code);
  const key = `${schoolId}|${normalizedCode}`;
  const existing = registry.get(key);
  if (existing) {
    return existing;
  }
  const created = createMutableCourseEntry(schoolId, normalizedCode);
  registry.set(key, created);
  return created;
}

function addCourseReference(
  registry: Map<string, MutableCourseRegistryEntry>,
  params: {
    schoolId: TransferPlannerSourceSchoolId;
    code: string;
    sourceKind: TransferPlannerCourseSourceKind;
    sourceContext: string;
    planId?: string;
    trackId?: string;
    sourceLinks?: TransferPlannerSourceLink[];
    effectiveYearLabel?: string;
    notes?: string[];
    lastValidatedOn?: string | null;
  }
) {
  const entry = getOrCreateCourse(registry, params.schoolId, params.code);
  entry.sourceKinds.add(params.sourceKind);
  entry.sourceContexts.add(params.sourceContext);
  if (params.planId) {
    entry.referencedByPlanIds.add(params.planId);
  }
  if (params.trackId) {
    entry.referencedByTrackIds.add(params.trackId);
  }
  if (params.effectiveYearLabel) {
    entry.effectiveYearLabels.add(params.effectiveYearLabel);
  }
  for (const link of params.sourceLinks ?? []) {
    entry.sourceLinks.set(link.url, link);
  }
  for (const note of params.notes ?? []) {
    if (note) {
      entry.notes.add(note);
    }
  }
  if (params.lastValidatedOn && !entry.lastValidatedOn) {
    entry.lastValidatedOn = params.lastValidatedOn;
  }
}

function parseAcademicYearLabel(label: string) {
  const match = String(label ?? "").match(/^(\d{4})-(\d{4})$/);
  if (!match) {
    return null;
  }
  const startYear = Number.parseInt(match[1], 10);
  const endYear = Number.parseInt(match[2], 10);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
    return null;
  }
  return {
    label,
    startYear,
    endYear,
  };
}

function buildEffectiveYearRangesFromLabels(labels: string[]) {
  const parsed = labels
    .map((label) => parseAcademicYearLabel(label))
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((left, right) => left.startYear - right.startYear);
  const unparsed = labels
    .filter((label) => !parseAcademicYearLabel(label))
    .sort()
    .map(
      (label): TransferPlannerEffectiveYearRange => ({
        startLabel: label,
        endLabel: label,
      })
    );

  const ranges: TransferPlannerEffectiveYearRange[] = [];

  if (parsed.length > 0) {
    let currentStart = parsed[0];
    let currentEnd = parsed[0];

    for (const label of parsed.slice(1)) {
      if (label.startYear === currentEnd.endYear) {
        currentEnd = label;
        continue;
      }
      ranges.push({
        startLabel: currentStart.label,
        endLabel: currentEnd.label,
        note:
          currentStart.label === currentEnd.label
            ? undefined
            : "Continuous source-backed coverage across adjacent academic years.",
      });
      currentStart = label;
      currentEnd = label;
    }

    ranges.push({
      startLabel: currentStart.label,
      endLabel: currentEnd.label,
      note:
        currentStart.label === currentEnd.label
          ? undefined
          : "Continuous source-backed coverage across adjacent academic years.",
    });
  }

  return [...ranges, ...unparsed];
}

function addCoursesFromTerm(
  registry: Map<string, MutableCourseRegistryEntry>,
  params: {
    track: TransferPlannerTrack;
    term: TransferPlannerTrackTerm;
    sourceKind: TransferPlannerCourseSourceKind;
    effectiveYearLabel?: string;
    extraNotes?: string[];
  }
) {
  const sourceLinks = toSourceLinks(params.track.officialLinks);
  const codes = extractCourseCodesFromList(params.term.courses);
  for (const code of codes) {
    addCourseReference(registry, {
      schoolId: "grc",
      code,
      sourceKind: params.sourceKind,
      sourceContext: `${params.track.id}:${params.term.label}`,
      trackId: params.track.id,
      sourceLinks,
      effectiveYearLabel: params.effectiveYearLabel,
      notes: compact([...params.track.notes, ...(params.extraNotes ?? [])]),
    });
  }
}

function addCoursesFromCatalogYear(
  registry: Map<string, MutableCourseRegistryEntry>,
  track: TransferPlannerTrack,
  catalogYear: TransferPlannerTrackCatalogYear
) {
  for (const term of catalogYear.terms) {
    addCoursesFromTerm(registry, {
      track,
      term,
      sourceKind: "track-catalog-year",
      effectiveYearLabel: catalogYear.label,
      extraNotes: [catalogYear.sourceSummary, ...(catalogYear.notes ?? [])],
    });
  }

  for (const slotExpansion of catalogYear.slotExpansions ?? []) {
    for (const code of extractCourseCodesFromList(slotExpansion.recommendedCourses)) {
      addCourseReference(registry, {
        schoolId: "grc",
        code,
        sourceKind: "track-slot-expansion",
        sourceContext: `${track.id}:${catalogYear.label}:${slotExpansion.termLabel}:${slotExpansion.slotLabel}`,
        trackId: track.id,
        sourceLinks: toSourceLinks(track.officialLinks),
        effectiveYearLabel: catalogYear.label,
        notes: compact([
          catalogYear.sourceSummary,
          slotExpansion.note,
          ...track.notes,
          ...(catalogYear.notes ?? []),
        ]),
      });
    }
  }
}

function getChecklistSources(plan: TransferPlannerMajorPlan) {
  const sourceLinks = getOwnerSourceLinks(plan.id, null, plan.officialLinks);
  const validationNotes: string[] = [];
  const lastValidatedOn = getLastValidatedOn(validationNotes);
  return {
    sourceLinks,
    validationNotes,
    lastValidatedOn,
  };
}

function getPathwaySources(
  plan: TransferPlannerMajorPlan,
  pathway: TransferPlannerMajorPathway
) {
  const parentSourceLinks = getOwnerSourceLinks(plan.id, null, plan.officialLinks);
  const pathwaySourceLinks = getOwnerSourceLinks(plan.id, pathway.id, pathway.officialLinks);
  const broadParentSourceLinks = parentSourceLinks.filter(
    (link) => !isPathwaySpecificSourceLink(link)
  );
  const matchingPathwayLinks = pathwaySourceLinks
    .filter((link) => sourceLinkMatchesPathwayIdentity(link, pathway))
    .map(materializeMatchedPathwayRequirementSourceLink);
  const remainingPathwayLinks = pathwaySourceLinks.filter(
    (link) => !sourceLinkMatchesPathwayIdentity(link, pathway)
  );
  const matchingParentPathwayLinks = parentSourceLinks
    .filter((link) => sourceLinkMatchesPathwayIdentity(link, pathway))
    .map(materializeMatchedPathwayRequirementSourceLink);
  const inferredTacomaSiblingLinks = inferTacomaSiblingPathwaySourceLinks(
    plan,
    pathway,
    parentSourceLinks,
    pathwaySourceLinks
  );
  const parentLinksForPathway = matchingParentPathwayLinks.length
    ? [
        ...matchingParentPathwayLinks,
        ...broadParentSourceLinks,
      ]
    : broadParentSourceLinks.length < parentSourceLinks.length
      ? broadParentSourceLinks
      : parentSourceLinks;

  return {
    sourceLinks: dedupeLinks([
      ...matchingPathwayLinks,
      ...inferredTacomaSiblingLinks,
      ...parentLinksForPathway,
      ...remainingPathwayLinks,
    ]),
    validationNotes: [] as string[],
  };
}

function filterPathwaySpecificLinksForMajorManifest(
  planId: string,
  links: TransferPlannerSourceLink[]
) {
  const registryPathways = TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.filter(
    (pathway) => pathway.planId === planId
  );
  if (!registryPathways.length) {
    return links;
  }

  return links.filter((link) => !isPathwaySpecificSourceLink(link));
}

function addPlanChecklistCourses(
  registry: Map<string, MutableCourseRegistryEntry>,
  plan: TransferPlannerMajorPlan,
  phase: TransferPlannerRequirementPhase,
  item: TransferPlannerChecklistItem
) {
  const { sourceLinks, validationNotes, lastValidatedOn } = getChecklistSources(plan);
  const codes = unique([
    ...item.grcCourses.map((code) => normalizeCourseCode(code)),
    ...(item.alternatives ?? []).flatMap((group) => group.map((code) => normalizeCourseCode(code))),
  ]);

  for (const code of codes) {
    addCourseReference(registry, {
      schoolId: "grc",
      code,
      sourceKind: "plan-checklist",
      sourceContext: `${plan.id}:${phase}:${item.id}`,
      planId: plan.id,
      sourceLinks,
      notes: compact([item.note]),
      lastValidatedOn,
    });
  }
}

function addPlanCourseListCourses(
  registry: Map<string, MutableCourseRegistryEntry>,
  plan: TransferPlannerMajorPlan
) {
  const { sourceLinks, validationNotes, lastValidatedOn } = getChecklistSources(plan);
  for (const code of plan.grcCourseList ?? []) {
    addCourseReference(registry, {
      schoolId: "grc",
      code,
      sourceKind: "plan-course-list",
      sourceContext: `${plan.id}:grc-course-list`,
      planId: plan.id,
      sourceLinks,
      notes: [],
      lastValidatedOn,
    });
  }
}

function addPlanDegreeMapCourses(
  registry: Map<string, MutableCourseRegistryEntry>,
  plan: TransferPlannerMajorPlan,
  section: TransferPlannerDegreeMapSection
) {
  const { sourceLinks, validationNotes, lastValidatedOn } = getChecklistSources(plan);
  const codes = extractCourseCodesFromList(section.items);
  for (const code of codes) {
    addCourseReference(registry, {
      schoolId: plan.campusId,
      code,
      sourceKind: "plan-degree-map",
      sourceContext: `${plan.id}:${section.id}`,
      planId: plan.id,
      sourceLinks,
      notes: compact([section.note]),
      lastValidatedOn,
    });
  }
}

function getParsedRequirementSourceLinks(
  block: TransferPlannerParsedRequirementSourceBlock
) {
  const primaryLink = block.primarySourceUrl
    ? {
        label:
          block.primarySourceLabel ||
          `${block.ownerTitle} primary degree requirements source`,
        url: block.primarySourceUrl,
        note: "Primary source used for parser-backed UW requirement extraction.",
      }
    : null;

  const parsedLink = block.sourceUrl
    ? {
        label: block.sourceLabel || `${block.ownerTitle} parsed requirement source`,
        url: block.sourceUrl,
        note:
          block.resolutionStrategy === "alternate-official-source"
            ? "Alternate official source used for parser-backed UW requirement extraction."
            : block.resolutionStrategy === "cached-snapshot"
              ? "Cached snapshot used for parser-backed UW requirement extraction."
              : "Source used for parser-backed UW requirement extraction.",
      }
    : null;

  return dedupeLinks(compact([primaryLink, parsedLink]));
}

function addParsedRequirementSourceCourses(
  registry: Map<string, MutableCourseRegistryEntry>,
  block: TransferPlannerParsedRequirementSourceBlock
) {
  if (!block.ok) {
    return;
  }

  const parsedCourseCodes = unique(
    [
      ...(block.parsedUwCourseCodes ?? []),
      ...(block.sourceOnlyUwCourseCodes ?? []),
      ...(block.structuredOnlyUwCourseCodes ?? []),
    ]
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );

  if (!parsedCourseCodes.length) {
    return;
  }

  const sourceContext = block.pathwayId
    ? `${block.planId}:pathway:${block.pathwayId}:parsed-source:${block.id}`
    : `${block.planId}:parsed-source:${block.id}`;
  const sourceLinks = getParsedRequirementSourceLinks(block);
  const notes = compact([
    `Source-backed UW requirement parser (${block.adapterId}) for ${block.ownerTitle}.`,
  ]);

  for (const code of parsedCourseCodes) {
    addCourseReference(registry, {
      schoolId: block.campusId,
      code,
      sourceKind: "plan-degree-map",
      sourceContext,
      planId: block.planId,
      sourceLinks,
      notes,
    });
  }
}

function applyNormalizedCourseMetadata(registry: Map<string, MutableCourseRegistryEntry>) {
  for (const entry of registry.values()) {
    const metadata = getTransferPlannerNormalizedCourseMetadataEntry(
      entry.schoolId,
      entry.code
    );
    if (!metadata) {
      continue;
    }

    if (metadata.title) {
      entry.title = metadata.title;
    }
    if (metadata.creditValue !== undefined) {
      entry.creditValue = metadata.creditValue ?? null;
    }
    if (metadata.creditLabel !== undefined) {
      entry.creditLabel = metadata.creditLabel ?? null;
    } else if (metadata.creditValue !== undefined && metadata.creditValue !== null) {
      entry.creditLabel = String(metadata.creditValue);
    }
    if (metadata.catalogDescription !== undefined) {
      entry.catalogDescription = metadata.catalogDescription ?? null;
    }

    for (const code of metadata.prerequisiteCourseCodes ?? []) {
      entry.prerequisiteCourseCodes.add(normalizeCourseCode(code));
    }
    for (const group of metadata.prerequisiteAlternativeCourseCodeSets ?? []) {
      const normalizedGroup = group.map((code) => normalizeCourseCode(code));
      entry.prerequisiteAlternativeCourseCodeSets.add(getAlternativeSetKey(normalizedGroup));
    }
    for (const note of metadata.prerequisiteNotes ?? []) {
      entry.prerequisiteNotes.add(note);
    }

    for (const code of metadata.corequisiteCourseCodes ?? []) {
      entry.corequisiteCourseCodes.add(normalizeCourseCode(code));
    }
    for (const group of metadata.corequisiteAlternativeCourseCodeSets ?? []) {
      const normalizedGroup = group.map((code) => normalizeCourseCode(code));
      entry.corequisiteAlternativeCourseCodeSets.add(getAlternativeSetKey(normalizedGroup));
    }
    for (const note of metadata.corequisiteNotes ?? []) {
      entry.corequisiteNotes.add(note);
    }

    for (const range of metadata.effectiveYearRanges ?? []) {
      entry.effectiveYearRanges.set(getRangeKey(range), range);
    }

    for (const link of metadata.sourceLinks ?? []) {
      entry.sourceLinks.set(link.url, link);
    }
    for (const note of metadata.notes ?? []) {
      entry.notes.add(note);
    }
  }
}

function seedCourseRegistryFromNormalizedMetadata(
  registry: Map<string, MutableCourseRegistryEntry>
) {
  for (const metadata of TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA) {
    getOrCreateCourse(registry, metadata.schoolId, metadata.code);
  }
}

function finalizeCourseRegistryEntry(
  entry: MutableCourseRegistryEntry
): TransferPlannerCourseRegistryEntry {
  const availabilityEntry =
    entry.schoolId === "grc"
      ? (TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY[
          entry.code as keyof typeof TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY
        ] as TransferPlannerGrcCourseAvailabilityEntry | undefined)
      : undefined;

  if (availabilityEntry) {
    entry.sourceKinds.add("availability");
    entry.sourceContexts.add("grc-annual-schedule-history");
    for (const link of GRC_AVAILABILITY_SOURCE_LINKS) {
      entry.sourceLinks.set(link.url, link);
    }
    entry.latestAvailabilitySummary = formatAvailabilitySummary(availabilityEntry);
    for (const year of availabilityEntry.years) {
      entry.effectiveYearLabels.add(year.label);
    }
    for (const quarter of availabilityEntry.latestPublishedQuarters) {
      entry.latestPublishedQuarters.add(quarter);
    }
    if (
      availabilityEntry.status !== "published-in-latest-schedule" &&
      entry.latestAvailabilitySummary
    ) {
      entry.notes.add(entry.latestAvailabilitySummary);
    }
  }

  for (const range of buildEffectiveYearRangesFromLabels(Array.from(entry.effectiveYearLabels))) {
    entry.effectiveYearRanges.set(getRangeKey(range), range);
  }

  return {
    ...entry,
    sourceKinds: Array.from(entry.sourceKinds).sort(),
    sourceContexts: Array.from(entry.sourceContexts).sort(),
    referencedByPlanIds: Array.from(entry.referencedByPlanIds).sort(),
    referencedByTrackIds: Array.from(entry.referencedByTrackIds).sort(),
    sourceLinks: Array.from(entry.sourceLinks.values()).sort((left, right) =>
      left.label.localeCompare(right.label)
    ),
    effectiveYearLabels: Array.from(entry.effectiveYearLabels).sort(),
    effectiveYearRanges: Array.from(entry.effectiveYearRanges.values()).sort((left, right) =>
      left.startLabel.localeCompare(right.startLabel) ||
      (left.endLabel ?? "").localeCompare(right.endLabel ?? "")
    ),
    prerequisiteCourseCodes: Array.from(entry.prerequisiteCourseCodes).sort(),
    prerequisiteAlternativeCourseCodeSets: Array.from(
      entry.prerequisiteAlternativeCourseCodeSets
    )
      .sort()
      .map((group) => group.split("||").filter(Boolean)),
    prerequisiteNotes: Array.from(entry.prerequisiteNotes).sort(),
    corequisiteCourseCodes: Array.from(entry.corequisiteCourseCodes).sort(),
    corequisiteAlternativeCourseCodeSets: Array.from(
      entry.corequisiteAlternativeCourseCodeSets
    )
      .sort()
      .map((group) => group.split("||").filter(Boolean)),
    corequisiteNotes: Array.from(entry.corequisiteNotes).sort(),
    latestPublishedQuarters: Array.from(entry.latestPublishedQuarters).sort(),
    notes: Array.from(entry.notes).sort(),
  };
}

function buildCourseRegistry() {
  const registry = new Map<string, MutableCourseRegistryEntry>();

  for (const track of TRANSFER_PLANNER_BOOTSTRAP_TRACKS) {
    for (const term of track.terms) {
      addCoursesFromTerm(registry, {
        track,
        term,
        sourceKind: "track-term",
      });
    }

    for (const catalogYear of track.catalogYears ?? []) {
      addCoursesFromCatalogYear(registry, track, catalogYear);
    }
  }

  for (const plan of TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS) {
    for (const { phase, itemsKey } of PHASE_CONFIG) {
      for (const item of plan[itemsKey]) {
        addPlanChecklistCourses(registry, plan, phase, item);
      }
    }
    addPlanCourseListCourses(registry, plan);
    for (const section of plan.degreeMapSections ?? []) {
      addPlanDegreeMapCourses(registry, plan, section);
    }

    for (const pathway of plan.pathways ?? []) {
      const pathwaySources = getPathwaySources(plan, pathway);
      const pathwayLastValidatedOn = getLastValidatedOn(pathwaySources.validationNotes);

      for (const { phase, itemsKey } of PHASE_CONFIG) {
        for (const item of pathway[itemsKey] ?? []) {
          const codes = unique([
            ...item.grcCourses.map((code) => normalizeCourseCode(code)),
            ...(item.alternatives ?? []).flatMap((group) =>
              group.map((code) => normalizeCourseCode(code))
            ),
          ]);

          for (const code of codes) {
            addCourseReference(registry, {
              schoolId: "grc",
              code,
              sourceKind: "plan-checklist",
              sourceContext: `${plan.id}:pathway:${pathway.id}:${phase}:${item.id}`,
              planId: plan.id,
              sourceLinks: pathwaySources.sourceLinks,
              notes: compact([item.note]),
              lastValidatedOn: pathwayLastValidatedOn,
            });
          }
        }
      }

      for (const code of pathway.grcCourseList ?? []) {
        addCourseReference(registry, {
          schoolId: "grc",
          code,
          sourceKind: "plan-course-list",
          sourceContext: `${plan.id}:pathway:${pathway.id}:grc-course-list`,
          planId: plan.id,
          sourceLinks: pathwaySources.sourceLinks,
          notes: [],
          lastValidatedOn: pathwayLastValidatedOn,
        });
      }

      for (const section of pathway.degreeMapSections ?? []) {
        const codes = extractCourseCodesFromList(section.items);
        for (const code of codes) {
          addCourseReference(registry, {
            schoolId: plan.campusId,
            code,
            sourceKind: "plan-degree-map",
            sourceContext: `${plan.id}:pathway:${pathway.id}:degree-map:${section.id}`,
            planId: plan.id,
            sourceLinks: pathwaySources.sourceLinks,
            notes: compact([section.note]),
            lastValidatedOn: pathwayLastValidatedOn,
          });
        }
      }
    }
  }

  for (const parsedSource of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS) {
    addParsedRequirementSourceCourses(registry, parsedSource);
  }

  seedCourseRegistryFromNormalizedMetadata(registry);
  applyNormalizedCourseMetadata(registry);

  return Array.from(registry.values())
    .map(finalizeCourseRegistryEntry)
    .sort((left, right) =>
      left.schoolId.localeCompare(right.schoolId) || left.code.localeCompare(right.code)
    );
}

function buildEquivalencyRuleRegistry() {
  return [...TRANSFER_PLANNER_UW_GRC_ALL_EQUIVALENCY_RULES].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
}

function getPlannerScopeIdPrefix(planId: string, pathwayId?: string | null) {
  return pathwayId ? `${planId}:pathway:${pathwayId}` : planId;
}

function slugifyPlannerIdSegment(value: string) {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

function normalizeAlternativeCourseCodeSets(groups: string[][]) {
  return groups
    .map((group) =>
      unique(group.map((code) => normalizeCourseCode(code)).filter(Boolean))
    )
    .filter((group) => group.length > 0);
}

function hasClassificationCourseCoverage(
  classification: Pick<
    TransferPlannerRequirementDiffClassificationEntry,
    "grcCourseCodes" | "alternativeCourseCodeSets"
  >
) {
  return Boolean(
    (classification.grcCourseCodes ?? []).some(Boolean) ||
      (classification.alternativeCourseCodeSets ?? []).some(
        (group: string[] | null | undefined) =>
        (group ?? []).some(Boolean)
      )
  );
}

function buildParsedRequirementSourceValidationNotes(
  block: TransferPlannerParsedRequirementSourceBlock,
  extraNotes: string[] = []
) {
  return unique(
    compact([
      `Parser confidence: ${block.parseConfidence}.`,
      block.usedSnapshotFallback
        ? `Used cached official snapshot fallback${block.snapshotFallbackReason ? `: ${block.snapshotFallbackReason}` : "."}`
        : null,
      block.error ? `Parser note: ${block.error}` : null,
      ...extraNotes,
    ]).map((note) => String(note).trim())
  );
}

function takePlannerStrings(values: string[], limit = 12) {
  return unique(
    values
      .map((value) => String(value ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
  ).slice(0, limit);
}

function getClassificationRequirementCueLines(
  classification: TransferPlannerRequirementDiffClassificationEntry
) {
  return takePlannerStrings(
    (classification.validationNotes ?? [])
      .filter((note) => note.startsWith("Requirement cue lines:"))
      .flatMap((note) =>
        note
          .replace(/^Requirement cue lines:\s*/i, "")
          .split(/\s+\|\s+/)
          .map((line) => line.trim())
      ),
    24
  );
}

function hasUnsafeSourceBackedClassificationValidationNote(
  classification: TransferPlannerRequirementDiffClassificationEntry
) {
  return (classification.validationNotes ?? []).some((note) =>
    SOURCE_BACKED_INTENTIONALLY_SKIPPED_VALIDATION_NOTE_PATTERN.test(String(note ?? ""))
  );
}

const TRANSFER_PLANNER_EQUIVALENCY_RULES_BY_ID = new Map(
  TRANSFER_PLANNER_UW_GRC_ALL_EQUIVALENCY_RULES.map((rule) => [rule.id, rule])
);

function isPresentDayGuideRuleId(guideRuleId: string | null | undefined) {
  if (!guideRuleId) {
    return true;
  }

  return !(
    TRANSFER_PLANNER_EQUIVALENCY_RULES_BY_ID.get(guideRuleId)?.isObsoleteSourceCourse ?? false
  );
}

function parsedRequirementSourceBlockBacksCourseAsSchedulableRequirement(
  block: TransferPlannerParsedRequirementSourceBlock,
  courseCode: string
) {
  if (!canParsedRequirementSourceBlockCreateRequiredScheduleRows(block)) {
    return false;
  }

  const normalizedCourseCode = normalizeCourseCode(courseCode);
  if (!normalizedCourseCode) {
    return false;
  }

  if (
    (block.parsedRequirementAtomCandidates ?? []).some(
      (candidate) => normalizeCourseCode(candidate.uwCourseCode) === normalizedCourseCode
    )
  ) {
    return true;
  }

  if (
    (block.parsedRequirementCourses ?? []).some(
      (course) =>
        normalizeCourseCode(course.normalizedCourseCode ?? course.courseCode) ===
        normalizedCourseCode
    )
  ) {
    return true;
  }

  return (block.parsedRequirementGroups ?? []).some((group) =>
    (group.options ?? []).some((option) =>
      [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
        ...(option.displayCourseCodes ?? []),
      ]
        .map((code) => normalizeCourseCode(code))
        .includes(normalizedCourseCode)
    )
  );
}

function parsedRequirementSourceBlockMatchesClassificationScope(
  block: TransferPlannerParsedRequirementSourceBlock,
  classification: TransferPlannerRequirementDiffClassificationEntry
) {
  if (block.planId !== classification.planId) {
    return false;
  }

  const blockPathwayId = block.pathwayId ?? null;
  const classificationPathwayId = classification.pathwayId ?? null;
  return (
    blockPathwayId === classificationPathwayId ||
    (Boolean(classificationPathwayId) && blockPathwayId === null)
  );
}

function isClassificationBackedBySchedulableParsedRequirementSource(
  classification: TransferPlannerRequirementDiffClassificationEntry
) {
  return TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.some(
    (block) =>
      block.ok &&
      parsedRequirementSourceBlockMatchesClassificationScope(block, classification) &&
      parsedRequirementSourceBlockBacksCourseAsSchedulableRequirement(
        block,
        classification.sourceUwCourseCode
      )
  );
}

function shouldIncludeStudentFacingSourceBackedClassification(
  classification: TransferPlannerRequirementDiffClassificationEntry
) {
  if (!classification.displayPhase || !hasClassificationCourseCoverage(classification)) {
    return false;
  }

  if ((parseCourseParts(classification.sourceUwCourseCode).level ?? Number.MAX_SAFE_INTEGER) >= 300) {
    return false;
  }

  if (hasUnsafeSourceBackedClassificationValidationNote(classification)) {
    return false;
  }

  if (!isPresentDayGuideRuleId(classification.guideRuleId)) {
    return false;
  }

  if (!isClassificationBackedBySchedulableParsedRequirementSource(classification)) {
    return false;
  }

  const requirementCueLines = getClassificationRequirementCueLines(classification);
  if (!requirementCueLines.length) {
    return classification.classificationKind.startsWith("auto-promoted-");
  }

  return requirementCueLines.some(
    (line) => !SOURCE_BACKED_NON_REQUIREMENT_CUE_PATTERN.test(String(line ?? ""))
  );
}

function getPhaseBlockSortLabel(phase: TransferPlannerRequirementPhase) {
  switch (phase) {
    case "before-application":
      return "01-before-application";
    case "before-enrollment":
      return "02-before-enrollment";
    case "stay-at-grc":
      return "03-stay-at-grc";
    default:
      return `99-${phase}`;
  }
}

function getPhaseDegreeMapTitle(
  majorTitle: string,
  phase: TransferPlannerRequirementPhase
) {
  switch (phase) {
    case "before-application":
      return `${majorTitle} degree preparation and admissions`;
    case "before-enrollment":
      return `${majorTitle} before-enrollment degree head starts`;
    case "stay-at-grc":
      return `${majorTitle} stay-at-Green-River degree support`;
    default:
      return `${majorTitle} source-backed degree planning`;
  }
}

function getParsedDegreeMapItemLabels(
  candidate: Pick<
    TransferPlannerParsedRequirementSourceBlock["parsedDegreeMapBlockCandidates"][number],
    "sourceLineHints" | "uwCourseCodes"
  >
) {
  const preferredLabels = takePlannerStrings(candidate.sourceLineHints ?? [], 12);
  if (preferredLabels.length) {
    return preferredLabels;
  }
  return takePlannerStrings(candidate.uwCourseCodes ?? [], 18);
}

function buildRequirementAtomRegistry() {
  const groupedEntries = new Map<
    string,
    {
      preferredId: string | null;
      planId: string;
      pathwayId: string | null;
      campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
      majorTitle: string;
      phase: TransferPlannerRequirementPhase;
      titles: Set<string>;
      grcCourseCodes: Set<string>;
      alternativeCourseCodeSets: Map<string, string[]>;
      note: string | null;
      sourceLinks: Map<string, TransferPlannerSourceLink>;
      validationNotes: Set<string>;
      memberCount: number;
    }
  >();

  for (const classification of TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATIONS) {
    const displayPhase = classification.displayPhase;
    if (!displayPhase || !shouldIncludeStudentFacingSourceBackedClassification(classification)) {
      continue;
    }

    const scopePrefix = getPlannerScopeIdPrefix(classification.planId, classification.pathwayId);
    const groupingKey = classification.guideRuleId
      ? `${scopePrefix}|${displayPhase}|guide:${classification.guideRuleId}`
      : `${scopePrefix}|${displayPhase}|classification:${classification.id}`;
    const normalizedCourseCodes = unique(
      (classification.grcCourseCodes ?? []).map((code) => normalizeCourseCode(code)).filter(Boolean)
    );
    const normalizedAlternativeCourseCodeSets = normalizeAlternativeCourseCodeSets(
      classification.alternativeCourseCodeSets ?? []
    );
    const current =
      groupedEntries.get(groupingKey) ??
      {
        preferredId: null,
        planId: classification.planId,
        pathwayId: classification.pathwayId ?? null,
        campusId: classification.campusId,
        majorTitle: classification.majorTitle,
        phase: displayPhase,
        titles: new Set<string>(),
        grcCourseCodes: new Set<string>(),
        alternativeCourseCodeSets: new Map<string, string[]>(),
        note: null,
        sourceLinks: new Map<string, TransferPlannerSourceLink>(),
        validationNotes: new Set<string>(),
        memberCount: 0,
      };

    current.memberCount += 1;
    current.titles.add(normalizeCourseCode(classification.sourceUwCourseCode));
    for (const courseCode of normalizedCourseCodes) {
      current.grcCourseCodes.add(courseCode);
    }
    for (const courseCodeSet of normalizedAlternativeCourseCodeSets) {
      current.alternativeCourseCodeSets.set(getAlternativeSetKey(courseCodeSet), courseCodeSet);
    }
    if (!current.note && classification.note) {
      current.note = classification.note;
    }
    for (const link of classification.sourceLinks ?? []) {
      current.sourceLinks.set(link.url, link);
    }
    for (const note of classification.validationNotes ?? []) {
      current.validationNotes.add(note);
    }
    if (classification.rationale) {
      current.validationNotes.add(`Classification rationale: ${classification.rationale}`);
    }
    if (current.memberCount === 1) {
      current.preferredId =
        classification.promotedRequirementAtomOverrideId ?? classification.id;
    } else {
      current.preferredId = null;
    }

    groupedEntries.set(groupingKey, current);
  }

  return Array.from(groupedEntries.values())
    .map((entry) => {
      const title = Array.from(entry.titles).sort().join(" / ");
      const scopePrefix = getPlannerScopeIdPrefix(entry.planId, entry.pathwayId);
      return {
        id:
          entry.preferredId ??
          `${scopePrefix}:${entry.phase}:${slugifyPlannerIdSegment(title)}`,
        planId: entry.planId,
        pathwayId: entry.pathwayId,
        campusId: entry.campusId,
        majorTitle: entry.majorTitle,
        phase: entry.phase,
        displayPhase: entry.phase,
        title,
        grcCourseCodes: Array.from(entry.grcCourseCodes),
        alternativeCourseCodeSets: Array.from(entry.alternativeCourseCodeSets.values()),
        minCompletedCount: null,
        note: entry.note ?? undefined,
        sourceLinks: Array.from(entry.sourceLinks.values()).sort((left, right) =>
          left.label.localeCompare(right.label) || left.url.localeCompare(right.url)
        ),
        validationNotes: Array.from(entry.validationNotes).sort(),
      } satisfies TransferPlannerMajorRequirementAtom;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildDegreeMapBlockRegistry() {
  const entries: TransferPlannerDegreeMapBlock[] = [];

  const phaseDegreeBlocks = new Map<
    string,
    {
      id: string;
      planId: string;
      pathwayId: string | null;
      campusId: Exclude<TransferPlannerSourceSchoolId, "grc">;
      majorTitle: string;
      title: string;
      itemLabels: Set<string>;
      uwCourseCodes: Set<string>;
      sourceLinks: Map<string, TransferPlannerSourceLink>;
      validationNotes: Set<string>;
    }
  >();

  for (const classification of TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATIONS) {
    const displayPhase = classification.displayPhase;
    if (!displayPhase || !shouldIncludeStudentFacingSourceBackedClassification(classification)) {
      continue;
    }

    const scopePrefix = getPlannerScopeIdPrefix(classification.planId, classification.pathwayId);
    const sortLabel = getPhaseBlockSortLabel(displayPhase);
    const groupingKey = `${scopePrefix}|${displayPhase}`;
    const current =
      phaseDegreeBlocks.get(groupingKey) ??
      {
        id: `${scopePrefix}:degree-map:00-phase-${sortLabel}`,
        planId: classification.planId,
        pathwayId: classification.pathwayId ?? null,
        campusId: classification.campusId,
        majorTitle: classification.majorTitle,
        title: getPhaseDegreeMapTitle(classification.majorTitle, displayPhase),
        itemLabels: new Set<string>(),
        uwCourseCodes: new Set<string>(),
        sourceLinks: new Map<string, TransferPlannerSourceLink>(),
        validationNotes: new Set<string>(),
      };

    current.itemLabels.add(normalizeCourseCode(classification.sourceUwCourseCode));
    current.uwCourseCodes.add(normalizeCourseCode(classification.sourceUwCourseCode));
    for (const link of classification.sourceLinks ?? []) {
      current.sourceLinks.set(link.url, link);
    }
    for (const note of classification.validationNotes ?? []) {
      current.validationNotes.add(note);
    }
    phaseDegreeBlocks.set(groupingKey, current);
  }

  for (const block of phaseDegreeBlocks.values()) {
    entries.push({
      id: block.id,
      planId: block.planId,
      pathwayId: block.pathwayId,
      campusId: block.campusId,
      majorTitle: block.majorTitle,
      title: block.title,
      itemLabels: Array.from(block.itemLabels).sort(),
      uwCourseCodes: Array.from(block.uwCourseCodes).sort(),
      sourceLinks: Array.from(block.sourceLinks.values()).sort((left, right) =>
        left.label.localeCompare(right.label) || left.url.localeCompare(right.url)
      ),
      validationNotes: Array.from(block.validationNotes).sort(),
    });
  }

  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS) {
    if (!block.ok || !canParsedRequirementSourceBlockCreateRequiredScheduleRows(block)) {
      continue;
    }

    const scopePrefix = getPlannerScopeIdPrefix(block.planId, block.pathwayId);
    const sourceLinks = getParsedRequirementSourceLinks(block);
    const note = block.usedSnapshotFallback
      ? `Built from a cached official snapshot${block.snapshotFallbackReason ? ` because ${block.snapshotFallbackReason}` : ""}.`
      : undefined;

    for (const [index, candidate] of (block.parsedDegreeMapBlockCandidates ?? []).entries()) {
      const itemLabels = getParsedDegreeMapItemLabels(candidate);
      const uwCourseCodes = unique([
        ...(candidate.uwCourseCodes ?? []).map((code) => normalizeCourseCode(code)).filter(Boolean),
        ...extractCourseCodesFromList(itemLabels),
      ]);
      if (!itemLabels.length && !uwCourseCodes.length) {
        continue;
      }

      entries.push({
        id: `${scopePrefix}:degree-map:10-parsed-${String(index + 1).padStart(2, "0")}-${slugifyPlannerIdSegment(candidate.title || candidate.id)}`,
        planId: block.planId,
        pathwayId: block.pathwayId ?? null,
        campusId: block.campusId,
        majorTitle: block.ownerTitle,
        title: candidate.title,
        itemLabels,
        uwCourseCodes,
        note,
        sourceLinks,
        validationNotes: buildParsedRequirementSourceValidationNotes(block, [
          `Parsed degree-map block candidate: ${candidate.id}.`,
        ]),
      });
    }

    const requirementCueItems = takePlannerStrings(block.requirementCueLines ?? [], 10);
    if (requirementCueItems.length) {
      entries.push({
        id: `${scopePrefix}:degree-map:90-requirement-cues`,
        planId: block.planId,
        pathwayId: block.pathwayId ?? null,
        campusId: block.campusId,
        majorTitle: block.ownerTitle,
        title: `${block.ownerTitle} parsed official requirement cues`,
        itemLabels: requirementCueItems,
        uwCourseCodes: extractCourseCodesFromList(requirementCueItems),
        note,
        sourceLinks,
        validationNotes: buildParsedRequirementSourceValidationNotes(block, [
          "Parsed requirement cues extracted from the current official source.",
        ]),
      });
    }

    const planningNoteItems = takePlannerStrings(
      [...(block.chooseStatements ?? []), ...(block.pathwayLabels ?? [])],
      10
    );
    if (planningNoteItems.length) {
      entries.push({
        id: `${scopePrefix}:degree-map:91-planning-notes`,
        planId: block.planId,
        pathwayId: block.pathwayId ?? null,
        campusId: block.campusId,
        majorTitle: block.ownerTitle,
        title: `${block.ownerTitle} parsed choices and pathway notes`,
        itemLabels: planningNoteItems,
        uwCourseCodes: extractCourseCodesFromList(planningNoteItems),
        note,
        sourceLinks,
        validationNotes: buildParsedRequirementSourceValidationNotes(block, [
          "Parsed choice statements and pathway notes extracted from the current official source.",
        ]),
      });
    }
  }

  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

function buildPolicyRegistry() {
  const entries: TransferPlannerPolicyEntry[] = [];

  for (const plan of TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS) {
    entries.push({
      id: `${plan.id}:planner-policy`,
      planId: plan.id,
      pathwayId: null,
      campusId: plan.campusId,
      majorTitle: plan.title,
      bestTrackId: plan.bestTrackId,
      recommendedTrackSummary: plan.recommendedTrackSummary,
      whyThisTrack: [],
      advisorFlags: [],
      grcCourseListGuidance: undefined,
      plannerNote: undefined,
      sourceLinks: getOwnerSourceLinks(plan.id, null, plan.officialLinks),
      validationNotes: [],
    });

    for (const pathway of plan.pathways ?? []) {
      const pathwaySources = getPathwaySources(plan, pathway);
      entries.push({
        id: `${plan.id}:planner-policy:${pathway.id}`,
        planId: plan.id,
        pathwayId: pathway.id,
        campusId: plan.campusId,
        majorTitle: plan.title,
        bestTrackId:
          pathway.bestTrackId === undefined ? plan.bestTrackId : pathway.bestTrackId,
        recommendedTrackSummary:
          pathway.recommendedTrackSummary ?? plan.recommendedTrackSummary,
        whyThisTrack: [],
        advisorFlags: [],
        grcCourseListGuidance: undefined,
        plannerNote: undefined,
        sourceLinks: pathwaySources.sourceLinks,
        validationNotes: [],
      });
    }
  }

  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

function buildPathwayRegistry() {
  const entries: TransferPlannerMajorPathwayEntry[] = [];
  const seenPathwayKeys = new Set<string>();

  function pushPathwayEntry(entry: TransferPlannerMajorPathwayEntry) {
    const key = `${entry.planId}::${entry.pathwayId}`;
    if (seenPathwayKeys.has(key)) {
      const existingEntry = entries.find(
        (candidate) =>
          candidate.planId === entry.planId && candidate.pathwayId === entry.pathwayId
      );
      if (existingEntry) {
        existingEntry.grcCourseList = unique([
          ...(existingEntry.grcCourseList ?? []),
          ...(entry.grcCourseList ?? []),
        ]);
        existingEntry.sourceLinks = dedupeLinks([
          ...(existingEntry.sourceLinks ?? []),
          ...(entry.sourceLinks ?? []),
        ]);
        existingEntry.validationNotes = unique([
          ...(existingEntry.validationNotes ?? []),
          ...(entry.validationNotes ?? []),
        ]);
      }
      return;
    }

    seenPathwayKeys.add(key);
    entries.push(entry);
  }

  for (const plan of TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS) {
    const primaryParsedBlocks = getPlanMaterializationParsedRequirementSourceBlocks(plan.id);
    const materializedPathways = materializeTransferPlannerPathways(
      plan,
      plan.pathways ?? [],
      primaryParsedBlocks
    );
    const basePathwayIds = new Set((plan.pathways ?? []).map((pathway) => pathway.id));
    const usesDerivedPathwayPromotion =
      materializedPathways.length > 0 &&
      (materializedPathways.length !== (plan.pathways ?? []).length ||
        materializedPathways.some((pathway) => !basePathwayIds.has(pathway.id)));

    for (const pathway of materializedPathways) {
      const pathwaySources = getPathwaySources(plan, pathway);
      const supplementalDerivedPathwayCourses =
        SUPPLEMENTAL_DERIVED_PATHWAY_GRC_COURSES_BY_KEY[`${plan.id}::${pathway.id}`] ?? [];
      pushPathwayEntry({
        id: `${plan.id}:pathway:${pathway.id}`,
        planId: plan.id,
        pathwayId: pathway.id,
        campusId: plan.campusId,
        majorTitle: plan.title,
        label: resolveRegistryPathwayLabel(plan, pathway),
        summary: "",
        grcCourseList: [
          ...(pathway.grcCourseList ?? []),
          ...supplementalDerivedPathwayCourses,
        ],
        sourceLinks: pathwaySources.sourceLinks,
        validationNotes: usesDerivedPathwayPromotion
          ? [
              "Materialized semantic pathway labels from parser-backed route cues to suppress structural source headings.",
            ]
          : [],
      });
    }
  }

  for (const pathway of SUPPLEMENTAL_PARSER_ONLY_PATHWAY_SOURCES) {
    pushPathwayEntry({
      id: `${pathway.planId}:pathway:${pathway.pathwayId}`,
      planId: pathway.planId,
      pathwayId: pathway.pathwayId,
      campusId: pathway.campusId,
      majorTitle: pathway.majorTitle,
      label: pathway.label,
      summary: "",
      grcCourseList: [...(pathway.grcCourseList ?? [])],
      sourceLinks: pathway.links,
      validationNotes: pathway.validationNotes,
    });
  }

  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

function pushSourceManifestEntries(
  entries: TransferPlannerSourceManifestEntry[],
  params: {
    ownerType: TransferPlannerSourceManifestOwnerType;
    ownerId: string;
    ownerTitle: string;
    planId?: string | null;
    pathwayId?: string | null;
    trackId?: string | null;
    campusId?: TransferPlannerSourceSchoolId | null;
    links: TransferPlannerSourceLink[];
    validationNotes: string[];
  }
) {
  const dedupedLinks = dedupeLinks(params.links);
  const mergedValidationNotes = unique(compact([...(params.validationNotes ?? [])]));
  const preferredPrimaryUrl = getTransferPlannerManualPreferredPrimaryUrl(
    params.planId ?? params.ownerId,
    params.pathwayId ?? null
  );
  const primaryUrl =
    preferredPrimaryUrl && dedupedLinks.some((link) => link.url === preferredPrimaryUrl)
      ? preferredPrimaryUrl
      : pickPrimaryDegreeRequirementsUrl(dedupedLinks);
  const lastValidatedOn = getLastValidatedOn(mergedValidationNotes);

  dedupedLinks.forEach((link, index) => {
    const role = getSourceManifestRole(link);
    const parserType = getSourceManifestParserType(link, role);
    const confidence = getSourceManifestConfidence(role, parserType);

    entries.push({
      id: `${params.ownerId}:source:${index + 1}`,
      ownerType: params.ownerType,
      ownerId: params.ownerId,
      ownerTitle: params.ownerTitle,
      planId: params.planId ?? null,
      pathwayId: params.pathwayId ?? null,
      trackId: params.trackId ?? null,
      campusId: params.campusId ?? null,
      label: link.label,
      url: link.url,
      role,
      parserType,
      confidence,
      isPrimaryDegreeRequirementsLink: Boolean(primaryUrl && link.url === primaryUrl),
      note: link.note,
      lastValidatedOn,
      validationNotes: unique(compact([...mergedValidationNotes, link.note ?? null])),
    });
  });
}

function upsertAutoPromotedPrimarySourceManifestEntry(
  entries: TransferPlannerSourceManifestEntry[],
  promotion: (typeof TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS)[number]
) {
  const canonicalPromotion = normalizeAutoPromotedPrimarySourceOwner(promotion);
  if (
    shouldSkipTransferPlannerAutoPromotedPrimarySource(
      canonicalPromotion.planId,
      canonicalPromotion.pathwayId,
      canonicalPromotion.url
    )
  ) {
    return;
  }

  const link: TransferPlannerSourceLink = {
    label: canonicalPromotion.label,
    url: canonicalPromotion.url,
  };
  const fallbackRole = getSourceManifestRole(link);
  const role = getAutoPromotedSourceManifestRole(canonicalPromotion, fallbackRole);
  if (!isSafeFallbackPrimaryRole(role)) {
    return;
  }
  const parserType = getAutoPromotedSourceManifestParserType(canonicalPromotion, link, role);

  const existingEntry = entries.find(
    (entry) => entry.ownerId === canonicalPromotion.ownerId && entry.url === canonicalPromotion.url
  );

  for (const entry of entries) {
    if (entry.ownerId === canonicalPromotion.ownerId) {
      entry.isPrimaryDegreeRequirementsLink = false;
    }
  }

  if (existingEntry) {
    existingEntry.isPrimaryDegreeRequirementsLink = true;
    existingEntry.role = role;
    existingEntry.parserType = parserType;
    existingEntry.confidence = getSourceManifestConfidence(role, parserType);
    existingEntry.validationNotes = unique(
      compact([
        ...existingEntry.validationNotes,
        `Auto-promoted from high-confidence discovery on ${canonicalPromotion.generatedAt}.`,
      ])
    );
    existingEntry.lastValidatedOn = getLastValidatedOn(existingEntry.validationNotes);
    return;
  }

  const validationNotes = [
    `Auto-promoted from high-confidence discovery on ${canonicalPromotion.generatedAt}.`,
  ];

  entries.push({
    id: `${canonicalPromotion.ownerId}:source:auto-promoted-primary`,
    ownerType: canonicalPromotion.ownerType,
    ownerId: canonicalPromotion.ownerId,
    ownerTitle: canonicalPromotion.ownerTitle,
    planId: canonicalPromotion.planId,
    pathwayId: canonicalPromotion.pathwayId,
    trackId: null,
    campusId: canonicalPromotion.campusId,
    label: canonicalPromotion.label,
    url: canonicalPromotion.url,
    role,
    parserType,
    confidence: getSourceManifestConfidence(role, parserType),
    isPrimaryDegreeRequirementsLink: true,
    note: undefined,
    lastValidatedOn: getLastValidatedOn(validationNotes),
    validationNotes,
  });
}

function normalizeAutoPromotedPrimarySourceOwner(
  promotion: (typeof TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS)[number]
) {
  if (promotion.ownerType !== "pathway" || !promotion.planId || !promotion.pathwayId) {
    return promotion;
  }

  const pathwayId = normalizeTransferPlannerPathwayId(
    promotion.planId,
    promotion.pathwayId
  );
  if (!pathwayId || pathwayId === promotion.pathwayId) {
    return promotion;
  }

  const ownerId = buildTransferPlannerOwnerId(promotion.planId, pathwayId);
  return {
    ...promotion,
    ownerId,
    ownerKey: ownerId,
    pathwayId,
  };
}

function hasActiveSourceManifestOwner(
  promotion: (typeof TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS)[number]
) {
  const canonicalPromotion = normalizeAutoPromotedPrimarySourceOwner(promotion);
  switch (canonicalPromotion.ownerType) {
    case "major":
      return (
        TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.some((plan) => plan.id === canonicalPromotion.ownerId) ||
        SUPPLEMENTAL_PARSER_ONLY_MAJOR_SOURCES.some(
          (entry) => entry.planId === canonicalPromotion.ownerId
        )
      );
    case "pathway":
      return (
        TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.some((entry) => entry.id === canonicalPromotion.ownerId) ||
        SUPPLEMENTAL_PARSER_ONLY_PATHWAY_SOURCES.some(
          (entry) =>
            buildTransferPlannerOwnerId(entry.planId, entry.pathwayId) === canonicalPromotion.ownerId
        )
      );
    default:
      return true;
  }
}

function buildSourceManifestRegistry() {
  const entries: TransferPlannerSourceManifestEntry[] = [];
  const bootstrapPlanIds = new Set(
    TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.map((plan) => plan.id)
  );

  for (const plan of TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS) {
    const ownerSourceLinks = dedupeLinks([
      ...getOwnerSourceLinks(plan.id, null, plan.officialLinks),
      ...getSupplementalManifestSourceLinks(plan.id, null),
    ]);
    pushSourceManifestEntries(entries, {
      ownerType: "major",
      ownerId: plan.id,
      ownerTitle: plan.title,
      planId: plan.id,
      campusId: plan.campusId,
      links: filterPathwaySpecificLinksForMajorManifest(plan.id, ownerSourceLinks),
      validationNotes: [],
    });
  }

  for (const supplementalMajor of SUPPLEMENTAL_PARSER_ONLY_MAJOR_SOURCES) {
    if (bootstrapPlanIds.has(supplementalMajor.planId)) {
      continue;
    }

    pushSourceManifestEntries(entries, {
      ownerType: "major",
      ownerId: supplementalMajor.planId,
      ownerTitle: supplementalMajor.ownerTitle,
      planId: supplementalMajor.planId,
      campusId: supplementalMajor.campusId,
      links: supplementalMajor.links,
      validationNotes: supplementalMajor.validationNotes,
    });
  }

  for (const pathway of TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY) {
    pushSourceManifestEntries(entries, {
      ownerType: "pathway",
      ownerId: pathway.id,
      ownerTitle: `${pathway.majorTitle} - ${pathway.label}`,
      planId: pathway.planId,
      pathwayId: pathway.pathwayId,
      campusId: pathway.campusId,
      links: applyTransferPlannerManualSourceLinkOverride(
        pathway.planId,
        pathway.pathwayId,
        dedupeLinks([
          ...pathway.sourceLinks,
          ...getSupplementalManifestSourceLinks(pathway.planId, pathway.pathwayId),
        ])
      ),
      validationNotes: pathway.validationNotes,
    });
  }

  for (const track of TRANSFER_PLANNER_BOOTSTRAP_TRACKS) {
    pushSourceManifestEntries(entries, {
      ownerType: "track",
      ownerId: track.id,
      ownerTitle: track.title,
      trackId: track.id,
      campusId: "grc",
      links: applyTransferPlannerManualSourceLinkOverride(
        track.id,
        null,
        toSourceLinks(track.officialLinks)
      ),
      validationNotes: [...(track.notes ?? []), ...(track.catalogYears ?? []).flatMap((year) => year.notes ?? [])],
    });
  }

  pushSourceManifestEntries(entries, {
    ownerType: "reference",
    ownerId: "grc-annual-schedules",
    ownerTitle: "Green River annual schedules",
    campusId: "grc",
    links: GRC_AVAILABILITY_SOURCE_LINKS,
    validationNotes: [
      "Used by the generated Green River availability and schedule-metadata scripts.",
    ],
  });
  pushSourceManifestEntries(entries, {
    ownerType: "reference",
    ownerId: "uw-green-river-equivalency-guide",
    ownerTitle: "UW Green River transfer equivalency guide",
    campusId: "grc",
    links: [UW_GRC_EQUIVALENCY_LINK],
    validationNotes: [
      "Used by the generated UW Green River equivalency parser and source-backed transfer mapping.",
    ],
  });

  for (const promotion of TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS) {
    if (!hasActiveSourceManifestOwner(promotion)) {
      continue;
    }
    upsertAutoPromotedPrimarySourceManifestEntry(entries, promotion);
  }

  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

export const TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY = buildCourseRegistry();

const TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY_BY_KEY = new Map(
  TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.map((entry) => [
    `${entry.schoolId}|${entry.code}`,
    entry,
  ])
);

function getCourseRegistryEntryScore(
  entry: TransferPlannerCourseRegistryEntry,
  requestedCode: string
) {
  let score = 0;

  if (entry.title) score += 32;
  if (entry.creditValue !== null) score += 16;
  if (entry.creditLabel) score += 8;
  if (entry.catalogDescription) score += 16;
  if (entry.prerequisiteCourseCodes.length > 0) score += 8;
  if (entry.prerequisiteAlternativeCourseCodeSets.length > 0) score += 6;
  if (entry.corequisiteCourseCodes.length > 0) score += 8;
  if (entry.corequisiteAlternativeCourseCodeSets.length > 0) score += 6;
  if (entry.effectiveYearRanges.length > 0) score += 4;
  if (entry.sourceLinks.length > 0) score += 4;
  if (entry.notes.length > 0) score += 2;
  if (entry.code === requestedCode) score += 1;

  return score;
}

function mergeSortedStrings(left: string[], right: string[]) {
  return Array.from(new Set([...left, ...right])).sort();
}

function mergeAlternativeCourseCodeSets(left: string[][], right: string[][]) {
  return Array.from(
    new Set(
      [...left, ...right].map((group) =>
        group
          .map((code) => normalizeCourseCode(code))
          .filter(Boolean)
          .sort()
          .join("||")
      )
    )
  )
    .filter(Boolean)
    .sort()
    .map((groupKey) => groupKey.split("||").filter(Boolean));
}

function mergeSourceLinks(left: TransferPlannerSourceLink[], right: TransferPlannerSourceLink[]) {
  return Array.from(
    new Map(
      [...left, ...right].map((link) => [
        `${link.url}||${link.label}||${link.note ?? ""}`,
        link,
      ])
    ).values()
  ).sort((firstLink, secondLink) => firstLink.label.localeCompare(secondLink.label));
}

function mergeEffectiveYearRanges(
  left: TransferPlannerEffectiveYearRange[],
  right: TransferPlannerEffectiveYearRange[]
) {
  return Array.from(
    new Map(
      [...left, ...right].map((range) => [getRangeKey(range), range])
    ).values()
  ).sort((firstRange, secondRange) =>
    firstRange.startLabel.localeCompare(secondRange.startLabel) ||
    (firstRange.endLabel ?? "").localeCompare(secondRange.endLabel ?? "")
  );
}

function mergeCourseRegistryEntries(
  primaryEntry: TransferPlannerCourseRegistryEntry,
  fallbackEntry: TransferPlannerCourseRegistryEntry
) {
  return {
    ...primaryEntry,
    title: primaryEntry.title ?? fallbackEntry.title,
    creditValue: primaryEntry.creditValue ?? fallbackEntry.creditValue,
    creditLabel: primaryEntry.creditLabel ?? fallbackEntry.creditLabel,
    catalogDescription: primaryEntry.catalogDescription ?? fallbackEntry.catalogDescription,
    sourceKinds: mergeSortedStrings(
      primaryEntry.sourceKinds,
      fallbackEntry.sourceKinds
    ) as TransferPlannerCourseSourceKind[],
    sourceContexts: mergeSortedStrings(primaryEntry.sourceContexts, fallbackEntry.sourceContexts),
    referencedByPlanIds: mergeSortedStrings(
      primaryEntry.referencedByPlanIds,
      fallbackEntry.referencedByPlanIds
    ),
    referencedByTrackIds: mergeSortedStrings(
      primaryEntry.referencedByTrackIds,
      fallbackEntry.referencedByTrackIds
    ),
    sourceLinks: mergeSourceLinks(primaryEntry.sourceLinks, fallbackEntry.sourceLinks),
    effectiveYearLabels: mergeSortedStrings(
      primaryEntry.effectiveYearLabels,
      fallbackEntry.effectiveYearLabels
    ),
    effectiveYearRanges: mergeEffectiveYearRanges(
      primaryEntry.effectiveYearRanges,
      fallbackEntry.effectiveYearRanges
    ),
    prerequisiteCourseCodes: mergeSortedStrings(
      primaryEntry.prerequisiteCourseCodes,
      fallbackEntry.prerequisiteCourseCodes
    ),
    prerequisiteAlternativeCourseCodeSets: mergeAlternativeCourseCodeSets(
      primaryEntry.prerequisiteAlternativeCourseCodeSets,
      fallbackEntry.prerequisiteAlternativeCourseCodeSets
    ),
    prerequisiteNotes: mergeSortedStrings(
      primaryEntry.prerequisiteNotes,
      fallbackEntry.prerequisiteNotes
    ),
    corequisiteCourseCodes: mergeSortedStrings(
      primaryEntry.corequisiteCourseCodes,
      fallbackEntry.corequisiteCourseCodes
    ),
    corequisiteAlternativeCourseCodeSets: mergeAlternativeCourseCodeSets(
      primaryEntry.corequisiteAlternativeCourseCodeSets,
      fallbackEntry.corequisiteAlternativeCourseCodeSets
    ),
    corequisiteNotes: mergeSortedStrings(
      primaryEntry.corequisiteNotes,
      fallbackEntry.corequisiteNotes
    ),
    lastValidatedOn: primaryEntry.lastValidatedOn ?? fallbackEntry.lastValidatedOn,
    latestAvailabilitySummary:
      primaryEntry.latestAvailabilitySummary ?? fallbackEntry.latestAvailabilitySummary,
    latestPublishedQuarters: mergeSortedStrings(
      primaryEntry.latestPublishedQuarters ?? [],
      fallbackEntry.latestPublishedQuarters ?? []
    ),
    notes: mergeSortedStrings(primaryEntry.notes, fallbackEntry.notes),
  } satisfies TransferPlannerCourseRegistryEntry;
}

function projectCanonicalCourseEntryToRequestedCode(
  entry: TransferPlannerCourseRegistryEntry,
  schoolId: TransferPlannerSourceSchoolId,
  requestedCode: string
) {
  if (entry.code === requestedCode) {
    return entry;
  }

  const parts = parseCourseParts(requestedCode);
  return {
    ...entry,
    id: getCourseId(schoolId, requestedCode),
    code: requestedCode,
    displayLabel: requestedCode,
    subjectCode: parts.subjectCode,
    catalogNumber: parts.catalogNumber,
    level: parts.level,
  } satisfies TransferPlannerCourseRegistryEntry;
}
export const TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY = buildEquivalencyRuleRegistry();
export const TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY = buildRequirementAtomRegistry();
export const TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY = buildDegreeMapBlockRegistry();
export const TRANSFER_PLANNER_POLICY_REGISTRY = buildPolicyRegistry();
export const TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY = buildPathwayRegistry();
export const TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY = buildSourceManifestRegistry();
export const TRANSFER_PLANNER_SOURCE_GAP_REGISTRY = TRANSFER_PLANNER_SOURCE_GAP_ENTRIES;
export const TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY = TRANSFER_PLANNER_SOURCE_FINGERPRINTS;
export const TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY =
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINTS;
export const TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY =
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS;
export const TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_REGISTRY_SUMMARY =
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY;
export const TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY =
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATIONS;
export const TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY =
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_SUMMARY;

const HIDDEN_SOURCE_GAP_PLAN_IDS = new Set(
  TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.filter(
    (entry) => entry.studentVisibility === "hidden" && !entry.pathwayId
  ).map((entry) => entry.planId)
);
const HIDDEN_SOURCE_GAP_PATHWAY_KEYS = new Set(
  TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.filter(
    (entry) => entry.studentVisibility === "hidden" && entry.pathwayId
  ).map((entry) => `${entry.planId}::${entry.pathwayId}`)
);
const ACTIVE_DERIVED_SHARED_SOURCE_PLAN_ALIASES =
  TRANSFER_PLANNER_DERIVED_SHARED_SOURCE_PLAN_ALIASES.filter((alias) =>
    INTERNAL_SOURCE_GENERATED_BASE_PLAN_IDS.has(alias.sourcePlanId)
  );
const VISIBLE_INTERNAL_SOURCE_GENERATED_BASE_PLAN_IDS = new Set(
  [...INTERNAL_SOURCE_GENERATED_BASE_PLAN_IDS].filter(
    (planId) => !HIDDEN_SOURCE_GAP_PLAN_IDS.has(planId)
  )
);

function canParsedRequirementSourceBlockCreateRequiredScheduleRows(
  block: TransferPlannerParsedRequirementSourceBlock
) {
  if (
    block.canCreateScheduleRows === false ||
    block.canCreateRequiredRows === false ||
    block.canCreateSchedulableRows === false ||
    block.supportOnly === true ||
    block.nonSchedulable === true
  ) {
    return false;
  }

  if (["support", "non-schedulable", "ignored"].includes(String(block.sourceRoleStatus ?? ""))) {
    return false;
  }

  return ![
    "approved-course-list",
    "elective-list",
    "upper-division-prerequisite-table",
    "non-schedulable-course-list",
    "sample-schedule",
    "support-source",
    "admission-prerequisite-source",
    "admissions-preparation",
    "transfer-equivalency",
    "matched-grc-track",
    "old-archival",
    "ignored",
  ].includes(String(block.sourceRole ?? ""));
}

function getPlanMaterializationParsedRequirementSourceBlocks(planId: string) {
  return TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
    (entry) =>
      entry.planId === planId &&
      entry.ok &&
      canParsedRequirementSourceBlockCreateRequiredScheduleRows(entry)
  );
}

function buildSummaryRegistryBackedBasePathways(plan: TransferPlannerMajorPlan) {
  const bootstrapPathways = plan.pathways ?? [];
  const bootstrapPathwayIds = new Set(bootstrapPathways.map((pathway) => pathway.id));
  const supplementalRegistryPathways = TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.filter(
    (pathway) => pathway.planId === plan.id && !bootstrapPathwayIds.has(pathway.pathwayId)
  ).map((pathway) => ({
    id: pathway.pathwayId,
    label: pathway.label,
    summary: normalizeTransferPlannerText(pathway.summary),
    officialLinks: [],
  } satisfies TransferPlannerMajorPathway));

  return [...bootstrapPathways, ...supplementalRegistryPathways];
}

function countMaterializedPathwaysForPlan(
  plan: TransferPlannerMajorPlan,
  options: {
    includeHiddenSourceGaps?: boolean;
    hiddenGapPlanId?: string;
  } = {}
) {
  const includeHiddenSourceGaps = options.includeHiddenSourceGaps ?? true;
  const hiddenGapPlanId = options.hiddenGapPlanId ?? plan.id;
  const materializedPathways = materializeTransferPlannerPathways(
    plan,
    buildSummaryRegistryBackedBasePathways(plan),
    getPlanMaterializationParsedRequirementSourceBlocks(plan.id)
  );
  if (includeHiddenSourceGaps) {
    return materializedPathways.length;
  }

  return materializedPathways.filter(
    (pathway) => !HIDDEN_SOURCE_GAP_PATHWAY_KEYS.has(`${hiddenGapPlanId}::${pathway.id}`)
  ).length;
}

const BOOTSTRAP_PLANS_BY_ID = new Map(
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.map((plan) => [plan.id, plan] as const)
);

function countDerivedSharedSourceAliasPathways(includeHiddenSourceGaps = true) {
  return ACTIVE_DERIVED_SHARED_SOURCE_PLAN_ALIASES.reduce((count, alias) => {
    if (!includeHiddenSourceGaps && HIDDEN_SOURCE_GAP_PLAN_IDS.has(alias.derivedPlanId)) {
      return count;
    }

    const sourcePlan = BOOTSTRAP_PLANS_BY_ID.get(alias.sourcePlanId);
    if (!sourcePlan) {
      return count;
    }

    return count +
      countMaterializedPathwaysForPlan(sourcePlan, {
        includeHiddenSourceGaps,
        hiddenGapPlanId: alias.derivedPlanId,
      });
  }, 0);
}

const SOURCE_GENERATED_PATHWAY_COUNT = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.reduce(
  (count, plan) => count + countMaterializedPathwaysForPlan(plan),
  0
) + countDerivedSharedSourceAliasPathways();

const STUDENT_VISIBLE_SOURCE_GENERATED_PATHWAY_COUNT = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.reduce(
  (count, plan) => {
    if (HIDDEN_SOURCE_GAP_PLAN_IDS.has(plan.id)) return count;
    return count + countMaterializedPathwaysForPlan(plan, { includeHiddenSourceGaps: false });
  },
  countDerivedSharedSourceAliasPathways(false)
);

export const TRANSFER_PLANNER_SOURCE_SUMMARY = {
  generatedOn: "2026-04-02",
  sourceGeneratedMajorPlanCount:
    INTERNAL_SOURCE_GENERATED_BASE_PLAN_IDS.size + ACTIVE_DERIVED_SHARED_SOURCE_PLAN_ALIASES.length,
  studentVisibleMajorPlanCount:
    VISIBLE_INTERNAL_SOURCE_GENERATED_BASE_PLAN_IDS.size +
    ACTIVE_DERIVED_SHARED_SOURCE_PLAN_ALIASES.filter(
      (alias) => !HIDDEN_SOURCE_GAP_PLAN_IDS.has(alias.derivedPlanId)
    ).length,
  hiddenSourceGapMajorPlanCount: HIDDEN_SOURCE_GAP_PLAN_IDS.size,
  sourceGeneratedPathwayCount: SOURCE_GENERATED_PATHWAY_COUNT,
  studentVisiblePathwayCount: STUDENT_VISIBLE_SOURCE_GENERATED_PATHWAY_COUNT,
  hiddenSourceGapPathwayCount: HIDDEN_SOURCE_GAP_PATHWAY_KEYS.size,
  canonicalCourseCount: TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.length,
  canonicalCourseTitleCount: TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
    (entry) => Boolean(entry.title)
  ).length,
  canonicalCourseCreditCount: TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
    (entry) => entry.creditValue !== null
  ).length,
  canonicalCoursePrerequisiteCount: TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
    (entry) =>
      entry.prerequisiteCourseCodes.length > 0 ||
      entry.prerequisiteAlternativeCourseCodeSets.length > 0
  ).length,
  canonicalCourseCorequisiteCount: TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
    (entry) =>
      entry.corequisiteCourseCodes.length > 0 ||
      entry.corequisiteAlternativeCourseCodeSets.length > 0
  ).length,
  canonicalCourseEffectiveYearRangeCount: TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
    (entry) => entry.effectiveYearRanges.length > 0
  ).length,
  equivalencyRuleCount: TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.length,
  equivalencyGuideParsedRuleCount: TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.filter(
    (entry) => entry.sourceKind === "uw-green-river-equivalency-guide"
  ).length,
  equivalencyRuleCountsBySourceKind: TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.reduce(
    (counts, entry) => {
      const key = entry.sourceKind ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {} as Record<string, number>
  ),
  equivalencyRuleCountsByType: TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.reduce(
    (counts, entry) => {
      counts[entry.type] = (counts[entry.type] ?? 0) + 1;
      return counts;
    },
    {} as Record<string, number>
  ),
  majorRequirementCount: TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY.length,
  degreeMapBlockCount: TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY.length,
  policyEntryCount: TRANSFER_PLANNER_POLICY_REGISTRY.length,
  majorPathwayCount: TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.length,
  sourceManifestCount: TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.length,
  sourceManifestPrimaryCount: TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
    (entry) => entry.isPrimaryDegreeRequirementsLink
  ).length,
  sourceManifestHighConfidenceCount: TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
    (entry) => entry.confidence === "high"
  ).length,
  sourceGapCount: TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.length,
  sourceGapCountsByStatus: TRANSFER_PLANNER_SOURCE_GAP_REGISTRY.reduce(
    (counts, entry) => {
      counts[entry.sourceCoverageStatus] = (counts[entry.sourceCoverageStatus] ?? 0) + 1;
      return counts;
    },
    {} as Record<string, number>
  ),
  sourceFingerprintCount: TRANSFER_PLANNER_SOURCE_FINGERPRINT_REGISTRY.length,
  requirementSourceFingerprintCount:
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_FINGERPRINT_REGISTRY.length,
  parsedRequirementSourceBlockCount:
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.length,
  parsedRequirementAtomCandidateCount:
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_REGISTRY_SUMMARY
      .parsedRequirementAtomCandidateCount,
  parsedDegreeMapBlockCandidateCount:
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_REGISTRY_SUMMARY
      .parsedDegreeMapBlockCandidateCount,
  requirementSourceAdapterCountsById:
    TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_REGISTRY_SUMMARY.countsByAdapterId,
  catalogDescriptionCount: TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
    (entry) => Boolean(entry.catalogDescription)
  ).length,
  catalogPrerequisiteNoteCount: TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
    (entry) => entry.prerequisiteNotes.length > 0
  ).length,
  catalogCorequisiteNoteCount: TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
    (entry) => entry.corequisiteNotes.length > 0
  ).length,
  requirementDiffClassificationCount:
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.length,
  requirementDiffClassificationCountsByKind:
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.countsByKind,
  requirementDiffClassificationCountsByCampus:
    TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY_SUMMARY.countsByCampus,
  courseCountsBySchool: {
    grc: TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter((entry) => entry.schoolId === "grc")
      .length,
    "uw-seattle": TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
      (entry) => entry.schoolId === "uw-seattle"
    ).length,
    "uw-bothell": TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
      (entry) => entry.schoolId === "uw-bothell"
    ).length,
    "uw-tacoma": TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
      (entry) => entry.schoolId === "uw-tacoma"
    ).length,
  },
};

export function getTransferPlannerSourceManifestEntriesForPlan(
  planId: string,
  pathwayId?: string | null
) {
  return TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
    (entry) =>
      entry.planId === planId &&
      (pathwayId === undefined
        ? true
        : pathwayId === null
          ? !entry.pathwayId
          : entry.pathwayId === pathwayId)
  );
}

export function getTransferPlannerPrimaryDegreeRequirementsSource(
  planId: string,
  pathwayId?: string | null
) {
  return (
    getTransferPlannerSourceManifestEntriesForPlan(planId, pathwayId).find(
      (entry) => entry.isPrimaryDegreeRequirementsLink
    ) ?? null
  );
}

export function getTransferPlannerRequirementDiffClassifications(
  planId: string,
  pathwayId?: string | null
) {
  return TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY.filter(
    (entry) =>
      entry.planId === planId &&
      (pathwayId === undefined
        ? true
        : pathwayId === null
          ? !entry.pathwayId
          : entry.pathwayId === pathwayId)
  );
}

export function getTransferPlannerParsedRequirementSourceBlocks(
  planId: string,
  pathwayId?: string | null
) {
  return TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.filter(
    (entry) =>
      entry.planId === planId &&
      (pathwayId === undefined
        ? true
        : pathwayId === null
          ? !entry.pathwayId
          : entry.pathwayId === pathwayId)
  );
}

export function getTransferPlannerCanonicalCourse(
  schoolId: TransferPlannerSourceSchoolId,
  code: string
) {
  const normalizedCode = normalizeCourseCode(code);
  const exactEntry =
    TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY_BY_KEY.get(`${schoolId}|${normalizedCode}`) ??
    null;
  const candidateEntries = Array.from(
    new Map(
      getTransferPlannerEquivalentCourseCodes(schoolId, normalizedCode)
        .map((candidateCode) =>
          TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY_BY_KEY.get(
            `${schoolId}|${normalizeCourseCode(candidateCode)}`
          ) ?? null
        )
        .filter((entry): entry is TransferPlannerCourseRegistryEntry => Boolean(entry))
        .map((entry) => [entry.code, entry])
    ).values()
  );

  const bestEquivalentEntry =
    [...candidateEntries].sort((left, right) => {
      const scoreDelta =
        getCourseRegistryEntryScore(right, normalizedCode) -
        getCourseRegistryEntryScore(left, normalizedCode);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return left.code.localeCompare(right.code);
    })[0] ?? null;

  if (!bestEquivalentEntry) {
    return exactEntry ?? undefined;
  }

  if (!exactEntry) {
    return projectCanonicalCourseEntryToRequestedCode(
      bestEquivalentEntry,
      schoolId,
      normalizedCode
    );
  }

  if (exactEntry.code === bestEquivalentEntry.code) {
    return exactEntry;
  }

  return mergeCourseRegistryEntries(exactEntry, bestEquivalentEntry);
}

export function isTransferPlannerEquivalencyRuleEffectiveForTerm(
  rule: TransferPlannerEquivalencyRule,
  termLabel: string
) {
  if (rule.effectiveYearRanges.length === 0) {
    return true;
  }
  return rule.effectiveYearRanges.some((range) =>
    isEffectiveRangeActiveForGuideTerm(range, termLabel)
  );
}

let transferPlannerEquivalencyRulesBySourceCourse:
  | Map<string, TransferPlannerEquivalencyRule[]>
  | null = null;

function getTransferPlannerEquivalencyRulesBySourceCourse() {
  if (transferPlannerEquivalencyRulesBySourceCourse) {
    return transferPlannerEquivalencyRulesBySourceCourse;
  }

  const rulesBySourceCourse = new Map<string, TransferPlannerEquivalencyRule[]>();
  for (const rule of TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY) {
    const ruleSourceCourses = new Set(
      (rule.sourceCourseSets ?? [])
        .flatMap((courseSet) => courseSet)
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean)
    );

    for (const sourceCourseCode of ruleSourceCourses) {
      const matchingRules = rulesBySourceCourse.get(sourceCourseCode) ?? [];
      matchingRules.push(rule);
      rulesBySourceCourse.set(sourceCourseCode, matchingRules);
    }
  }

  transferPlannerEquivalencyRulesBySourceCourse = rulesBySourceCourse;
  return transferPlannerEquivalencyRulesBySourceCourse;
}

export function getTransferPlannerEquivalencyRulesForSourceCourse(
  sourceCourseCode: string,
  effectiveTermLabel?: string | null
) {
  const normalizedCode = normalizeCourseCode(sourceCourseCode);
  const matchingRules =
    getTransferPlannerEquivalencyRulesBySourceCourse().get(normalizedCode) ?? [];
  return matchingRules.filter((entry) => {
    if (!effectiveTermLabel) {
      return true;
    }
    return isTransferPlannerEquivalencyRuleEffectiveForTerm(entry, effectiveTermLabel);
  });
}
