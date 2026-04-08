import {
  TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY,
  type TransferPlannerGrcCourseAvailabilityEntry,
} from "../transfer-planner-grc-availability.generated";
import {
  TRANSFER_PLANNER_MASTER_BANK_LIBRARY,
  TRANSFER_PLANNER_MASTER_CHAIN_LIBRARY,
} from "../transfer-planner-master-generated";
import {
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS,
  TRANSFER_PLANNER_BOOTSTRAP_TRACKS,
} from "./bootstrap.generated";
import { TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA } from "./course-metadata";
import {
  TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES,
} from "./equivalency-guide.generated";
import {
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS,
  TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY,
} from "./requirement-source-adapters.generated";
import {
  TRANSFER_PLANNER_PROMOTED_PRIMARY_SOURCE_OVERRIDES,
  type TransferPlannerPromotedPrimarySourceOverride,
} from "./source-manifest-primary-overrides.generated";
import {
  TRANSFER_PLANNER_PROMOTED_REQUIREMENT_ATOM_OVERRIDES,
} from "./requirement-atom-overrides.generated";
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
import type {
  TransferPlannerChecklistItem,
  TransferPlannerDegreeMapSection,
  TransferPlannerLink,
  TransferPlannerMajorPlan,
  TransferPlannerMajorPathway,
  TransferPlannerTrack,
  TransferPlannerTrackCatalogYear,
  TransferPlannerTrackTerm,
} from "../transfer-planner-data";
import type {
  TransferPlannerSourceManifestConfidence,
  TransferPlannerSourceManifestEntry,
  TransferPlannerSourceManifestOwnerType,
  TransferPlannerSourceManifestParserType,
  TransferPlannerSourceManifestRole,
  TransferPlannerEquivalencyAcceptanceCategory,
  TransferPlannerCourseRegistryEntry,
  TransferPlannerCourseSourceKind,
  TransferPlannerDegreeMapBlock,
  TransferPlannerEffectiveYearRange,
  TransferPlannerEquivalencyRule,
  TransferPlannerEquivalencyRuleType,
  TransferPlannerMajorPathwayEntry,
  TransferPlannerMajorRequirementAtom,
  TransferPlannerPolicyEntry,
  TransferPlannerRequirementPhase,
  TransferPlannerSourceLink,
  TransferPlannerSourceSchoolId,
} from "./schema";

const COURSE_CODE_PATTERN = /\b[A-Z]{2,8}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;
const INVALID_EXTRACTED_COURSE_SUBJECTS = new Set([
  "AND",
  "ANY",
  "APPROVED",
  "DIVISION",
  "INTO",
  "LEAST",
  "MINIMUM",
  "OF",
  "ONE",
  "OR",
  "PLUS",
  "REACH",
  "REQUIRES",
  "THE",
  "THEN",
  "TO",
  "TOTALS",
]);
const EXTRACTED_COURSE_SUBJECT_ALIASES: Partial<Record<string, string>> = {
  BIOLOGY: "BIOL",
  PHYSICS: "PHYS",
};
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
const SOURCE_MANIFEST_PRIMARY_OVERRIDE_BY_OWNER = new Map(
  TRANSFER_PLANNER_PROMOTED_PRIMARY_SOURCE_OVERRIDES.map((entry) => [entry.ownerId, entry])
);
const ALL_UW_CAMPUSES: Exclude<TransferPlannerSourceSchoolId, "grc">[] = [
  "uw-seattle",
  "uw-bothell",
  "uw-tacoma",
];
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
const REQUIREMENT_DISPLAY_PHASE_OVERRIDES: Partial<Record<string, TransferPlannerRequirementPhase>> = {
  "uw-seattle-asian-studies:uws-asst-civilization": "stay-at-grc",
  "uw-seattle-astronomy:uws-astr-math-elective": "stay-at-grc",
  "uw-seattle-astronomy:uws-astr-intro-context": "stay-at-grc",
  "uw-seattle-atmospheric-and-climate-science:uws-atmos-programming": "stay-at-grc",
  "uw-seattle-atmospheric-and-climate-science:uws-atmos-advanced-math": "stay-at-grc",
  "uw-seattle-biology:uws-biol-stats": "stay-at-grc",
  "uw-seattle-business-administration:uws-baba-qmeth": "stay-at-grc",
  "uw-seattle-business-administration:uws-baba-management-context": "stay-at-grc",
  "uw-seattle-chemistry:uws-chem-organic": "stay-at-grc",
  "uw-seattle-chemistry:uws-chem-advanced-math": "stay-at-grc",
  "uw-seattle-chinese:uws-chin-history-culture": "stay-at-grc",
  "uw-seattle-cinema-and-media-studies:uws-cms-media-support": "stay-at-grc",
  "uw-seattle-classical-studies:uws-classt-ancient-history": "stay-at-grc",
  "uw-seattle-classics:uws-classics-history": "stay-at-grc",
  "uw-seattle-communication:uws-comm-media-support": "stay-at-grc",
  "uw-seattle-community-environment-and-planning:uws-cep-policy": "stay-at-grc",
  "uw-seattle-comparative-history-of-ideas:uws-chi-humanities": "stay-at-grc",
  "uw-seattle-comparative-literature:uws-complit-humanities": "stay-at-grc",
  "uw-seattle-comparative-religion:uws-comprel-language": "stay-at-grc",
  "uw-seattle-computational-finance-and-risk-management:uws-cfrm-stats": "stay-at-grc",
  "uw-seattle-computer-engineering:math207": "stay-at-grc",
  "uw-seattle-electrical-computer-engineering:cse123": "stay-at-grc",
  "uw-seattle-construction-management:uws-cm-accounting": "stay-at-grc",
  "uw-seattle-dance:uws-dance-theory-context": "stay-at-grc",
  "uw-seattle-danish:uws-danish-scand-context": "stay-at-grc",
  "uw-seattle-design:uws-design-digital": "stay-at-grc",
  "uw-seattle-drama:uws-drama-history": "stay-at-grc",
  "uw-seattle-early-childhood-and-family-studies:uws-ecfs-social": "stay-at-grc",
  "uw-seattle-earth-and-space-sciences:uws-ess-earth": "stay-at-grc",
  "uw-seattle-economics:uws-econ-stats": "stay-at-grc",
  "uw-seattle-education-communities-and-organizations:uws-eco-leadership": "stay-at-grc",
  "uw-bothell-applied-computing:uwb-acomp-cs123": "stay-at-grc",
  "uw-bothell-computer-engineering:bothell-compe-cs123": "stay-at-grc",
  "uw-bothell-computer-engineering:bothell-compe-circuits": "stay-at-grc",
  "uw-bothell-csse:bothell-csse-calc3": "stay-at-grc",
  "uw-bothell-csse:bothell-csse-cs123": "stay-at-grc",
  "uw-bothell-csse-information-assurance-and-cybersecurity:uwb-csse-iac-calc3": "stay-at-grc",
  "uw-bothell-csse-information-assurance-and-cybersecurity:uwb-csse-iac-cs123": "stay-at-grc",
  "uw-bothell-data-visualization-bs:uwb-dv-bs-cs123": "stay-at-grc",
  "uw-bothell-electrical-engineering:uwb-ee-circuits": "stay-at-grc",
  "uw-bothell-mathematical-thinking-and-visualization:uwb-mtv-programming": "stay-at-grc",
  "uw-bothell-media-and-communications-studies:uwb-mcs-intro-media": "stay-at-grc",
  "uw-tacoma-computer-engineering:tacoma-compe-cs123": "stay-at-grc",
  "uw-tacoma-electrical-engineering:tacoma-ee-programming2": "stay-at-grc",
  "uw-tacoma-nursing:uwt-nursing-stats": "stay-at-grc",
};
const STRUCTURED_EQUIVALENCY_RULES: Array<{
  id: string;
  type: TransferPlannerEquivalencyRuleType;
  title: string;
  sourceCourseSets: string[][];
  targetOutcome: string;
  acceptanceCategory: TransferPlannerEquivalencyAcceptanceCategory;
  weakerThanRuleIds?: string[];
  effectiveYearRanges?: TransferPlannerEffectiveYearRange[];
  plannerWarnings?: string[];
  notes: string[];
}> = [
  {
    id: "stem-calculus-current-sequence",
    type: "sequence",
    title: "Current Green River STEM calculus sequence",
    sourceCourseSets: [["MATH& 151", "MATH& 152", "MATH& 163"]],
    targetOutcome: "UW MATH 124, 125, and 126 transfer path.",
    acceptanceCategory: "preferred",
    notes: [
      "This is the current primary calculus path used throughout the planner for STEM transfer planning.",
    ],
  },
  {
    id: "stem-calculus-older-sequence",
    type: "alternate-path",
    title: "Older Green River STEM calculus alternative",
    sourceCourseSets: [["MATH& 151", "MATH& 152", "MATH& 153", "MATH& 254"]],
    targetOutcome: "UW MATH 124, 125, 126, plus stronger 224 / 2XX treatment when the full older path is completed.",
    acceptanceCategory: "legacy-accepted",
    weakerThanRuleIds: ["stem-calculus-current-sequence"],
    effectiveYearRanges: [
      {
        startLabel: "legacy-planner-support",
        endLabel: null,
        note: "Retained because current UW equivalency and planner materials still preserve the older calculus route as a valid alternate path.",
      },
    ],
    plannerWarnings: [
      "Prefer the current MATH& 151 -> MATH& 152 -> MATH& 163 path for new planning unless the student is already on the older MATH& 153 + MATH& 254 route.",
    ],
    notes: [
      "The planner keeps this older path because UW still describes it in some equivalency and legacy advising materials.",
    ],
  },
  {
    id: "general-chemistry-full-sequence",
    type: "full-credit-combo",
    title: "Full general chemistry sequence",
    sourceCourseSets: [["CHEM& 161", "CHEM& 162", "CHEM& 163"]],
    targetOutcome: "Full strongest general-chemistry transfer outcome used across many STEM majors.",
    acceptanceCategory: "preferred",
    notes: [
      "CHEM& 162 plus CHEM& 163 together produce a stronger UW chemistry outcome than isolated single-course treatment.",
    ],
  },
  {
    id: "organic-chemistry-full-sequence",
    type: "full-credit-combo",
    title: "Full organic chemistry sequence",
    sourceCourseSets: [["CHEM& 261", "CHEM& 262", "CHEM& 263"]],
    targetOutcome: "Full UW CHEM 237, 238, 239, 241, and 242 package when the full sequence is completed.",
    acceptanceCategory: "preferred",
    notes: [
      "The planner keeps the stronger full-sequence rule because partial completion does not preserve the same outcome.",
    ],
  },
  {
    id: "biology-majors-full-sequence",
    type: "full-credit-combo",
    title: "Biology majors full sequence",
    sourceCourseSets: [["BIOL& 211", "BIOL& 212", "BIOL& 213"]],
    targetOutcome: "Full UW BIOL 180, 200, 220, and 2XX package.",
    acceptanceCategory: "preferred",
    notes: [
      "All three courses are required for the strongest biology-major equivalency.",
    ],
  },
  {
    id: "anatomy-physiology-full-sequence",
    type: "full-credit-combo",
    title: "Anatomy and physiology sequence",
    sourceCourseSets: [["BIOL& 241", "BIOL& 242"]],
    targetOutcome: "UW BIOL 118, BIOL 119, and NURS 301 equivalency pattern used in health pathways.",
    acceptanceCategory: "preferred",
    notes: [
      "Both courses are needed for the strongest combined outcome.",
    ],
  },
  {
    id: "computer-science-new-sequence",
    type: "sequence",
    title: "Current Green River CS sequence",
    sourceCourseSets: [["CS 121", "CS 122", "CS 123"]],
    targetOutcome: "Primary Green River intro programming sequence used for planning current CS pathways.",
    acceptanceCategory: "preferred",
    notes: ["The planner treats this as an ordered sequence rather than three unrelated standalone courses."],
  },
  {
    id: "calculus-physics-sequence",
    type: "sequence",
    title: "Calculus-based physics sequence",
    sourceCourseSets: [["PHYS& 221", "PHYS& 222", "PHYS& 223"]],
    targetOutcome: "Primary calculus-based physics transfer sequence.",
    acceptanceCategory: "preferred",
    notes: ["The planner keeps this sequence grouped because many engineering majors depend on full completion."],
  },
];

const CHAIN_RULE_METADATA: Partial<
  Record<
    string,
    {
      acceptanceCategory: TransferPlannerEquivalencyAcceptanceCategory;
      weakerThanRuleIds?: string[];
      effectiveYearRanges?: TransferPlannerEffectiveYearRange[];
      plannerWarnings?: string[];
    }
  >
> = {
  "MATH-STEM": {
    acceptanceCategory: "accepted-with-warning",
    plannerWarnings: [
      "Use the explicit structured calculus rules for current-vs-older path decisions. This chain summary is a broad planner reference, not the most precise route selector.",
    ],
  },
  "CS-LEGACY": {
    acceptanceCategory: "legacy-accepted",
    weakerThanRuleIds: ["computer-science-new-sequence"],
    effectiveYearRanges: [
      {
        startLabel: "legacy-planner-support",
        endLabel: null,
        note: "Retained because older UW equivalency materials and student histories still reference the CS& 141 -> CS 145 path.",
      },
    ],
    plannerWarnings: [
      "The planner prefers the current CS 121 -> CS 122 -> CS 123 path for new students. Keep the legacy path only when the student already started on it or advisor review confirms it is the right fit.",
    ],
  },
  "CHEM-GEN": {
    acceptanceCategory: "accepted-with-warning",
    plannerWarnings: [
      "Partial completion yields weaker CHEM 1XX treatment than the stronger full-sequence outcome used by many STEM pathways.",
    ],
  },
  "CHEM-ORG": {
    acceptanceCategory: "accepted-with-warning",
    plannerWarnings: [
      "The strongest UW organic chemistry outcome depends on the full CHEM& 261 + 262 + 263 sequence rather than isolated single-course treatment.",
    ],
  },
  "BIO-MAJORS": {
    acceptanceCategory: "accepted-with-warning",
    plannerWarnings: [
      "The strongest biology-major transfer outcome depends on completing BIOL& 211 + 212 + 213 as a full sequence.",
    ],
  },
  "BIO-ANAT": {
    acceptanceCategory: "accepted-with-warning",
    plannerWarnings: [
      "The combined UW anatomy and physiology outcome depends on completing both BIOL& 241 and BIOL& 242.",
    ],
  },
  "ACCT-COMBO": {
    acceptanceCategory: "accepted-with-warning",
    plannerWarnings: [
      "The stronger UW accounting outcome depends on ACCT& 201 + ACCT& 202 together rather than isolated single-course treatment.",
    ],
  },
  "ASTR-COMBO": {
    acceptanceCategory: "accepted-with-warning",
    plannerWarnings: [
      "The second astronomy course changes the final UW credit outcome, so treat this as a conditional combo instead of two interchangeable standalone classes.",
    ],
  },
  "HIST-US": {
    acceptanceCategory: "accepted-with-warning",
    plannerWarnings: [
      "The full UW US-history outcome depends on HIST& 136 + HIST& 137 together rather than one course alone.",
    ],
  },
  "ENGL-250": {
    acceptanceCategory: "accepted-with-warning",
    plannerWarnings: [
      "The stronger ENGL 250 outcome depends on ENGL& 244 + ENGL& 245 together.",
    ],
  },
  "COMM-266": {
    acceptanceCategory: "accepted-with-warning",
    plannerWarnings: [
      "CMST 266 only yields CMS 272 when it is taken for 5 credits. Otherwise it remains CMS 2XX credit.",
    ],
  },
  "NATRS-COMBO": {
    acceptanceCategory: "accepted-with-warning",
    plannerWarnings: [
      "NATRS 180 + NATRS 292 has a special combined ESRM-major rule, so do not treat the two courses as interchangeable standalone credits.",
    ],
  },
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
  return String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
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

function normalizeExtractedCourseCode(value: string) {
  const match = String(value ?? "")
    .toUpperCase()
    .match(/\b([A-Z]{2,8}&?)\s*(\d{3}(?:\.\d+)?[A-Z]?)\b/);

  if (!match) {
    return null;
  }

  const rawSubject = normalizeCourseCode(match[1]).replace(/\s+/g, "");
  const subject = EXTRACTED_COURSE_SUBJECT_ALIASES[rawSubject] ?? rawSubject;

  if (INVALID_EXTRACTED_COURSE_SUBJECTS.has(subject)) {
    return null;
  }

  return `${subject} ${match[2]}`;
}

function extractCourseCodes(value: string) {
  return unique(
    (String(value ?? "").toUpperCase().match(COURSE_CODE_PATTERN) ?? [])
      .map((match) => normalizeExtractedCourseCode(match))
      .filter((match): match is string => Boolean(match))
  );
}

function extractCourseCodesFromList(values: string[]) {
  return unique(values.flatMap((value) => extractCourseCodes(value)));
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

function getSourceManifestRole(link: TransferPlannerSourceLink): TransferPlannerSourceManifestRole {
  const searchable = `${link.label} ${link.url}`.toLowerCase();

  if (
    /degree requirements|major requirements|graduation requirements|degree structure|degree sheet|requirement sheet|checklist|requirements packet/.test(
      searchable
    )
  ) {
    return "degree-requirements";
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
  const isPdf = normalizedUrl.endsWith(".pdf");

  if (role === "availability") {
    return "annual-schedule-pdf";
  }

  if (role === "equivalency") {
    return "equivalency-guide";
  }

  if (role === "catalog") {
    return "catalog-page";
  }

  if (isPdf && role === "worksheet") {
    return "pdf-worksheet";
  }

  if (isPdf && (role === "degree-requirements" || role === "curriculum")) {
    return "pdf-degree-sheet";
  }

  if (isPdf) {
    return "generic-pdf";
  }

  if (role === "degree-requirements") {
    return "html-degree-page";
  }

  if (role === "admissions") {
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

function getSourceManifestConfidence(
  role: TransferPlannerSourceManifestRole,
  parserType: TransferPlannerSourceManifestParserType
): TransferPlannerSourceManifestConfidence {
  if (
    parserType === "annual-schedule-pdf" ||
    parserType === "equivalency-guide" ||
    parserType === "html-degree-page" ||
    parserType === "pdf-degree-sheet"
  ) {
    return "high";
  }

  if (
    role === "admissions" ||
    role === "curriculum" ||
    role === "catalog" ||
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
  if (role === "curriculum") score += 70;
  if (role === "catalog") score += 50;
  if (parserType === "pdf-degree-sheet") score += 20;
  if (/degree requirements|major requirements|graduation requirements/.test(searchable)) score += 25;
  if (/curriculum/.test(searchable)) score += 15;
  if (role === "admissions" || role === "equivalency" || role === "availability") score -= 40;

  return score;
}

function pickPrimaryDegreeRequirementsUrl(links: TransferPlannerSourceLink[]) {
  const candidates = dedupeLinks(links)
    .map((link) => ({
      link,
      score: getSourceManifestPrimaryScore(link),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.link.url.localeCompare(right.link.url));

  return candidates[0]?.link.url ?? null;
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
      notes: compact([params.track.summary, ...params.track.notes, ...(params.extraNotes ?? [])]),
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
          track.summary,
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
  const sourceLinks = toSourceLinks(plan.officialLinks);
  const validationNotes = plan.manualReviewNotes ?? [];
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
  return {
    sourceLinks: dedupeLinks([
      ...toSourceLinks(plan.officialLinks),
      ...toSourceLinks(pathway.officialLinks),
    ]),
    validationNotes: unique([...(plan.manualReviewNotes ?? []), ...(pathway.manualReviewNotes ?? [])]),
  };
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
      notes: compact([
        plan.summary,
        item.note,
        ...validationNotes,
      ]),
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
      notes: compact([plan.summary, plan.plannerNote, ...validationNotes]),
      lastValidatedOn,
    });
  }
}

function addPlanMasterBankCourses(
  registry: Map<string, MutableCourseRegistryEntry>,
  plan: TransferPlannerMajorPlan
) {
  const { sourceLinks, validationNotes, lastValidatedOn } = getChecklistSources(plan);
  const bankLibrary = new Map(
    TRANSFER_PLANNER_MASTER_BANK_LIBRARY.map((bank) => [bank.id, bank.courses] as const)
  );

  for (const bankId of plan.bankIds ?? []) {
    for (const code of bankLibrary.get(bankId) ?? []) {
      addCourseReference(registry, {
        schoolId: "grc",
        code,
        sourceKind: "master-bank",
        sourceContext: `${plan.id}:${bankId}`,
        planId: plan.id,
        sourceLinks,
        notes: compact([plan.summary, plan.plannerNote, ...validationNotes]),
        lastValidatedOn,
      });
    }
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
      notes: compact([plan.summary, section.note, ...validationNotes]),
      lastValidatedOn,
    });
  }
}

function applyNormalizedCourseMetadata(registry: Map<string, MutableCourseRegistryEntry>) {
  for (const metadata of TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA) {
    const normalizedCode = normalizeCourseCode(metadata.code);
    const key = `${metadata.schoolId}|${normalizedCode}`;
    const entry = registry.get(key);
    if (!entry) {
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
    addPlanMasterBankCourses(registry, plan);
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
              notes: compact([
                plan.summary,
                pathway.summary,
                item.note,
                ...pathwaySources.validationNotes,
              ]),
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
          notes: compact([
            plan.summary,
            pathway.summary,
            pathway.plannerNote,
            ...pathwaySources.validationNotes,
          ]),
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
            notes: compact([
              plan.summary,
              pathway.summary,
              section.note,
              ...pathwaySources.validationNotes,
            ]),
            lastValidatedOn: pathwayLastValidatedOn,
          });
        }
      }
    }
  }

  applyNormalizedCourseMetadata(registry);

  return Array.from(registry.values())
    .map(finalizeCourseRegistryEntry)
    .sort((left, right) =>
      left.schoolId.localeCompare(right.schoolId) || left.code.localeCompare(right.code)
    );
}

function mapChainRuleType(ruleId: string): TransferPlannerEquivalencyRuleType {
  if (ruleId.includes("COMBO")) {
    return "full-credit-combo";
  }
  if (ruleId.includes("LEGACY") || ruleId.includes("OLD")) {
    return "alternate-path";
  }
  return "chain-rule";
}

function buildEquivalencyRuleRegistry() {
  const structuredRules: TransferPlannerEquivalencyRule[] = STRUCTURED_EQUIVALENCY_RULES.map((rule) => ({
    id: rule.id,
    type: rule.type,
    title: rule.title,
    acceptanceCategory: rule.acceptanceCategory,
    ruleStatus: "active",
    sourceKind: "manual-planner-rule",
    sourceSchoolId: "grc",
    targetSchoolIds: ALL_UW_CAMPUSES,
    sourceCourseSets: rule.sourceCourseSets,
    targetOutcome: rule.targetOutcome,
    weakerThanRuleIds: [...(rule.weakerThanRuleIds ?? [])],
    effectiveYearRanges: [...(rule.effectiveYearRanges ?? [])],
    plannerWarnings: [...(rule.plannerWarnings ?? [])],
    notes: rule.notes,
    sourceLinks: [UW_GRC_EQUIVALENCY_LINK],
  }));

  const chainRules: TransferPlannerEquivalencyRule[] = TRANSFER_PLANNER_MASTER_CHAIN_LIBRARY.map(
    (chain) => {
      const metadata = CHAIN_RULE_METADATA[chain.id];
      return {
      id: `chain:${chain.id.toLowerCase()}`,
      type: mapChainRuleType(chain.id),
      title: chain.id,
      acceptanceCategory: metadata?.acceptanceCategory ?? "accepted",
      ruleStatus: metadata?.acceptanceCategory === "legacy-accepted" ? "legacy" : "active",
      sourceKind: "chain-library",
      sourceSchoolId: "grc",
      targetSchoolIds: ALL_UW_CAMPUSES,
      targetOutcome: chain.rule,
      weakerThanRuleIds: [...(metadata?.weakerThanRuleIds ?? [])],
      effectiveYearRanges: [...(metadata?.effectiveYearRanges ?? [])],
      plannerWarnings: [...(metadata?.plannerWarnings ?? [])],
      notes: [chain.type],
      sourceLinks: [UW_GRC_EQUIVALENCY_LINK],
    };
    }
  );

  return [
    ...structuredRules,
    ...TRANSFER_PLANNER_UW_GRC_EQUIVALENCY_GUIDE_RULES,
    ...chainRules,
  ].sort((left, right) => left.id.localeCompare(right.id));
}

function buildRequirementAtomRegistry() {
  const entries: TransferPlannerMajorRequirementAtom[] = [];

  for (const plan of TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS) {
    const { sourceLinks, validationNotes } = getChecklistSources(plan);
    for (const { phase, itemsKey } of PHASE_CONFIG) {
      for (const item of plan[itemsKey]) {
        entries.push({
          id: `${plan.id}:${phase}:${item.id}`,
          planId: plan.id,
          campusId: plan.campusId,
          majorTitle: plan.title,
          phase,
          displayPhase:
            REQUIREMENT_DISPLAY_PHASE_OVERRIDES[`${plan.id}:${item.id}`] ?? phase,
          title: item.title,
          grcCourseCodes: item.grcCourses.map((code) => normalizeCourseCode(code)),
          alternativeCourseCodeSets: (item.alternatives ?? []).map((group) =>
            group.map((code) => normalizeCourseCode(code))
          ),
          minCompletedCount: item.minCompletedCount ?? null,
          note: item.note,
          sourceLinks,
          validationNotes,
        });
      }
    }

    for (const pathway of plan.pathways ?? []) {
      const pathwaySources = getPathwaySources(plan, pathway);
      for (const { phase, itemsKey } of PHASE_CONFIG) {
        for (const item of pathway[itemsKey] ?? []) {
          entries.push({
            id: `${plan.id}:pathway:${pathway.id}:${phase}:${item.id}`,
            planId: plan.id,
            pathwayId: pathway.id,
            campusId: plan.campusId,
            majorTitle: plan.title,
            phase,
            displayPhase:
              REQUIREMENT_DISPLAY_PHASE_OVERRIDES[`${plan.id}:${pathway.id}:${item.id}`] ??
              phase,
            title: item.title,
            grcCourseCodes: item.grcCourses.map((code) => normalizeCourseCode(code)),
            alternativeCourseCodeSets: (item.alternatives ?? []).map((group) =>
              group.map((code) => normalizeCourseCode(code))
            ),
            minCompletedCount: item.minCompletedCount ?? null,
            note: item.note,
            sourceLinks: pathwaySources.sourceLinks,
            validationNotes: pathwaySources.validationNotes,
          });
        }
      }
    }
  }

  const entryMap = new Map(entries.map((entry) => [entry.id, entry] as const));

  for (const override of TRANSFER_PLANNER_PROMOTED_REQUIREMENT_ATOM_OVERRIDES) {
    entryMap.set(override.id, {
      id: override.id,
      planId: override.planId,
      pathwayId: override.pathwayId ?? undefined,
      campusId: override.campusId,
      majorTitle: override.majorTitle,
      phase: override.phase,
      displayPhase: override.displayPhase,
      title: override.title,
      grcCourseCodes: override.grcCourseCodes.map((code) => normalizeCourseCode(code)),
      alternativeCourseCodeSets: (override.alternativeCourseCodeSets ?? []).map((group) =>
        group.map((code) => normalizeCourseCode(code))
      ),
      minCompletedCount: null,
      note: override.note,
      sourceLinks: override.sourceLinks,
      validationNotes: override.validationNotes,
    });
  }

  return [...entryMap.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function buildDegreeMapBlockRegistry() {
  const entries: TransferPlannerDegreeMapBlock[] = [];

  for (const plan of TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS) {
    const { sourceLinks, validationNotes } = getChecklistSources(plan);
    for (const section of plan.degreeMapSections ?? []) {
      entries.push({
        id: `${plan.id}:degree-map:${section.id}`,
        planId: plan.id,
        campusId: plan.campusId,
        majorTitle: plan.title,
        title: section.title,
        itemLabels: [...section.items],
        uwCourseCodes: extractCourseCodesFromList(section.items),
        note: section.note,
        sourceLinks,
        validationNotes,
      });
    }

    for (const pathway of plan.pathways ?? []) {
      const pathwaySources = getPathwaySources(plan, pathway);
      for (const section of pathway.degreeMapSections ?? []) {
        entries.push({
          id: `${plan.id}:pathway:${pathway.id}:degree-map:${section.id}`,
          planId: plan.id,
          pathwayId: pathway.id,
          campusId: plan.campusId,
          majorTitle: plan.title,
          title: section.title,
          itemLabels: [...section.items],
          uwCourseCodes: extractCourseCodesFromList(section.items),
          note: section.note,
          sourceLinks: pathwaySources.sourceLinks,
          validationNotes: pathwaySources.validationNotes,
        });
      }
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
      bestTrackSummary: plan.bestTrackSummary,
      whyThisTrack: [...plan.whyThisTrack],
      financialAidNote: plan.financialAidNote,
      advisorFlags: [...plan.advisorFlags],
      grcCourseListGuidance: plan.grcCourseListGuidance,
      plannerNote: plan.plannerNote,
      involvementIdeas: [...plan.involvementIdeas],
      projectIdeas: [...plan.projectIdeas],
      sourceLinks: toSourceLinks(plan.officialLinks),
      validationNotes: [...(plan.manualReviewNotes ?? [])],
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
        bestTrackSummary: pathway.bestTrackSummary ?? plan.bestTrackSummary,
        whyThisTrack: [...(pathway.whyThisTrack ?? plan.whyThisTrack)],
        financialAidNote: pathway.financialAidNote ?? plan.financialAidNote,
        advisorFlags: unique([...(plan.advisorFlags ?? []), ...(pathway.advisorFlags ?? [])]),
        grcCourseListGuidance:
          pathway.grcCourseListGuidance ?? plan.grcCourseListGuidance,
        plannerNote: pathway.plannerNote ?? plan.plannerNote,
        involvementIdeas: [...plan.involvementIdeas],
        projectIdeas: [...plan.projectIdeas],
        sourceLinks: pathwaySources.sourceLinks,
        validationNotes: pathwaySources.validationNotes,
      });
    }
  }

  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

function buildPathwayRegistry() {
  const entries: TransferPlannerMajorPathwayEntry[] = [];

  for (const plan of TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS) {
    for (const pathway of plan.pathways ?? []) {
      const pathwaySources = getPathwaySources(plan, pathway);
      entries.push({
        id: `${plan.id}:pathway:${pathway.id}`,
        planId: plan.id,
        pathwayId: pathway.id,
        campusId: plan.campusId,
        majorTitle: plan.title,
        label: pathway.label,
        summary: pathway.summary,
        grcCourseList: [...(pathway.grcCourseList ?? [])],
        sourceLinks: pathwaySources.sourceLinks,
        validationNotes: pathwaySources.validationNotes,
      });
    }
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
  const promotedPrimary = SOURCE_MANIFEST_PRIMARY_OVERRIDE_BY_OWNER.get(
    params.ownerId
  ) as TransferPlannerPromotedPrimarySourceOverride | undefined;
  const dedupedLinks = dedupeLinks([
    ...params.links,
    ...(promotedPrimary
      ? [
          {
            label: promotedPrimary.label,
            url: promotedPrimary.url,
            note: promotedPrimary.note,
          } satisfies TransferPlannerSourceLink,
        ]
      : []),
  ]);
  const mergedValidationNotes = unique(
    compact([
      ...(params.validationNotes ?? []),
      promotedPrimary?.validationNote ?? null,
      promotedPrimary?.note ?? null,
    ])
  );
  const primaryUrl = promotedPrimary?.url ?? pickPrimaryDegreeRequirementsUrl(dedupedLinks);
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

function buildSourceManifestRegistry() {
  const entries: TransferPlannerSourceManifestEntry[] = [];

  for (const plan of TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS) {
    pushSourceManifestEntries(entries, {
      ownerType: "major",
      ownerId: plan.id,
      ownerTitle: plan.title,
      planId: plan.id,
      campusId: plan.campusId,
      links: toSourceLinks(plan.officialLinks),
      validationNotes: [...(plan.manualReviewNotes ?? [])],
    });

    for (const pathway of plan.pathways ?? []) {
      const pathwaySources = getPathwaySources(plan, pathway);
      pushSourceManifestEntries(entries, {
        ownerType: "pathway",
        ownerId: `${plan.id}:pathway:${pathway.id}`,
        ownerTitle: `${plan.title} - ${pathway.label}`,
        planId: plan.id,
        pathwayId: pathway.id,
        campusId: plan.campusId,
        links: pathwaySources.sourceLinks,
        validationNotes: pathwaySources.validationNotes,
      });
    }
  }

  for (const track of TRANSFER_PLANNER_BOOTSTRAP_TRACKS) {
    pushSourceManifestEntries(entries, {
      ownerType: "track",
      ownerId: track.id,
      ownerTitle: track.title,
      trackId: track.id,
      campusId: "grc",
      links: toSourceLinks(track.officialLinks),
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

  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

export const TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY = buildCourseRegistry();
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
const SOURCE_GENERATED_PATHWAY_COUNT = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.reduce(
  (count, plan) => count + (plan.pathways?.length ?? 0),
  0
);
const STUDENT_VISIBLE_SOURCE_GENERATED_PATHWAY_COUNT = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.reduce(
  (count, plan) => {
    if (HIDDEN_SOURCE_GAP_PLAN_IDS.has(plan.id)) return count;
    return (
      count +
      (plan.pathways ?? []).filter(
        (pathway) => !HIDDEN_SOURCE_GAP_PATHWAY_KEYS.has(`${plan.id}::${pathway.id}`)
      ).length
    );
  },
  0
);

export const TRANSFER_PLANNER_SOURCE_SUMMARY = {
  generatedOn: "2026-04-02",
  sourceGeneratedMajorPlanCount: TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.length,
  studentVisibleMajorPlanCount: TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.filter(
    (plan) => !HIDDEN_SOURCE_GAP_PLAN_IDS.has(plan.id)
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
  sourceManifestPromotedPrimaryOverrideCount:
    TRANSFER_PLANNER_PROMOTED_PRIMARY_SOURCE_OVERRIDES.length,
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
  promotedRequirementAtomOverrideCount:
    TRANSFER_PLANNER_PROMOTED_REQUIREMENT_ATOM_OVERRIDES.length,
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

export function getTransferPlannerPromotedPrimarySourceOverride(ownerId: string) {
  return SOURCE_MANIFEST_PRIMARY_OVERRIDE_BY_OWNER.get(ownerId) ?? null;
}

export function getTransferPlannerPromotedRequirementAtomOverrides(
  planId: string,
  pathwayId?: string | null
) {
  return TRANSFER_PLANNER_PROMOTED_REQUIREMENT_ATOM_OVERRIDES.filter(
    (entry) =>
      entry.planId === planId &&
      (pathwayId === undefined
        ? true
        : pathwayId === null
          ? !entry.pathwayId
          : entry.pathwayId === pathwayId)
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
  return TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.find(
    (entry) => entry.schoolId === schoolId && entry.code === normalizedCode
  );
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

export function getTransferPlannerEquivalencyRulesForSourceCourse(
  sourceCourseCode: string,
  effectiveTermLabel?: string | null
) {
  const normalizedCode = normalizeCourseCode(sourceCourseCode);
  return TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.filter((entry) => {
    const hasSourceCourse = (entry.sourceCourseSets ?? []).some((courseSet) =>
      courseSet.includes(normalizedCode)
    );
    if (!hasSourceCourse) {
      return false;
    }
    if (!effectiveTermLabel) {
      return true;
    }
    return isTransferPlannerEquivalencyRuleEffectiveForTerm(entry, effectiveTermLabel);
  });
}
