import {
  TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY,
  type TransferPlannerGrcCourseAvailabilityEntry,
} from "../transfer-planner-grc-availability.generated";
import {
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS,
  TRANSFER_PLANNER_BOOTSTRAP_TRACKS,
} from "./bootstrap.generated";
import { TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA } from "./course-metadata";
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
import { deriveTransferPlannerPathwaySeeds } from "./pathway-materialization";
import { TRANSFER_PLANNER_DERIVED_SHARED_SOURCE_PLAN_ALIASES } from "./derived-shared-source-plans";
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
  /(?:^|[,(;/]\s*|\b(?:or|and)\s+)(\d{3}(?:\.\d+)?[A-Za-z]?)(?=$|[\s,);/]|(?:\s*(?:or|and)\b))/gi;
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
  "OR",
]);
const LEADING_LIST_MARKER_TOKENS = new Set(["I", "II", "III", "IV"]);
const KNOWN_UW_EXTRACTED_COURSE_SUBJECTS = new Set(
  TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA.filter((entry) => entry.schoolId !== "grc")
    .map((entry) => String(entry.code ?? "").match(/^([A-Z&]+(?: [A-Z&]+)*) \d/))
    .map((match) => match?.[1] ?? null)
    .filter(Boolean)
);
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
const SUPPLEMENTAL_PARSER_ONLY_MAJOR_SOURCES: SupplementalParserOnlyMajorSource[] = [
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
];
const SUPPLEMENTAL_PARSER_ONLY_PATHWAY_SOURCES: SupplementalParserOnlyPathwaySource[] = [
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
  const normalized = String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^([A-Z&]+(?: [A-Z&]+)*) (\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (!match) {
    return normalized;
  }

  const subjectTokens = match[1].split(" ").filter(Boolean);
  const normalizedSubject = subjectTokens.every((token) => token.length === 1)
    ? subjectTokens.join("")
    : subjectTokens.join(" ");

  return `${normalizedSubject} ${match[2]}`;
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
  const explicitMatches = [...normalizedValue.matchAll(EXPLICIT_COURSE_CODE_PATTERN)];

  for (let index = 0; index < explicitMatches.length; index += 1) {
    const match = explicitMatches[index];
    const subject = normalizeExtractedCourseSubject(match[1]);
    const explicitCode = normalizeExtractedCourseCode(match[1], match[2]);

    if (!subject || !explicitCode) {
      continue;
    }

    extractedCourseCodes.push(explicitCode);

    const currentMatchEnd = (match.index ?? 0) + match[0].length;
    const nextMatchStart =
      index + 1 < explicitMatches.length
        ? (explicitMatches[index + 1].index ?? normalizedValue.length)
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
  return mergeAutoPromotedPrimarySourceLink(toSourceLinks(links), planId, pathwayId);
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
    /degree requirements|major requirements|graduation requirements|degree structure|degree sheet|requirement sheet|checklist|requirements packet|degreq/.test(
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
  if (
    (role === "degree-requirements" || role === "curriculum") &&
    /\b(track|option|route|pathway|concentration|specialization)\b/.test(searchable)
  ) {
    score += 8;
  }
  if (/\/\/(?:www\.)?washington\.edu\/students\/gencat\/program\//.test(searchable)) {
    score -= 15;
  }
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
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stripPathwayTitleSuffix(value: string) {
  let stripped = normalizePathwayLabel(value);
  for (const pattern of PATHWAY_TITLE_SUFFIX_PATTERNS) {
    stripped = stripped.replace(pattern, "").trim();
  }
  return stripped;
}

function stripPlanTitlePrefix(planTitle: string, value: string) {
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
  return role !== "equivalency" && role !== "availability" && role !== "admissions";
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
  return {
    sourceLinks: dedupeLinks([
      ...getOwnerSourceLinks(plan.id, null, plan.officialLinks),
      ...getOwnerSourceLinks(plan.id, pathway.id, pathway.officialLinks),
    ]),
    validationNotes: [] as string[],
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
    if (!block.ok) {
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
      return;
    }

    seenPathwayKeys.add(key);
    entries.push(entry);
  }

  for (const plan of TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS) {
    for (const pathway of plan.pathways ?? []) {
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
        validationNotes: [],
      });
    }

    if ((plan.pathways ?? []).length > 0) {
      continue;
    }

    const parsedPathwaySeeds = deriveTransferPlannerPathwaySeeds(
      plan,
      TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.filter(
        (entry) => entry.planId === plan.id && !entry.pathwayId && entry.ok
      )
    );

    if (parsedPathwaySeeds.length < 2) {
      continue;
    }

    const sourceLinks = getOwnerSourceLinks(plan.id, null, plan.officialLinks);
    for (const seed of parsedPathwaySeeds) {
      pushPathwayEntry({
        id: `${plan.id}:pathway:${seed.id}`,
        planId: plan.id,
        pathwayId: seed.id,
        campusId: plan.campusId,
        majorTitle: plan.title,
        label: seed.label,
        summary: seed.summary,
        grcCourseList: [
          ...(SUPPLEMENTAL_DERIVED_PATHWAY_GRC_COURSES_BY_KEY[
            `${plan.id}::${seed.id}`
          ] ?? []),
        ],
        sourceLinks,
        validationNotes: [
          "Generated from parser-backed pathway cues extracted from the current official source.",
        ],
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
  const primaryUrl = pickPrimaryDegreeRequirementsUrl(dedupedLinks);
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
  const link: TransferPlannerSourceLink = {
    label: promotion.label,
    url: promotion.url,
  };
  const existingEntry = entries.find(
    (entry) => entry.ownerId === promotion.ownerId && entry.url === promotion.url
  );

  for (const entry of entries) {
    if (entry.ownerId === promotion.ownerId) {
      entry.isPrimaryDegreeRequirementsLink = false;
    }
  }

  if (existingEntry) {
    existingEntry.isPrimaryDegreeRequirementsLink = true;
    existingEntry.validationNotes = unique(
      compact([
        ...existingEntry.validationNotes,
        `Auto-promoted from high-confidence discovery on ${promotion.generatedAt}.`,
      ])
    );
    existingEntry.lastValidatedOn = getLastValidatedOn(existingEntry.validationNotes);
    return;
  }

  const role = getSourceManifestRole(link);
  const parserType = getSourceManifestParserType(link, role);
  const validationNotes = [
    `Auto-promoted from high-confidence discovery on ${promotion.generatedAt}.`,
  ];

  entries.push({
    id: `${promotion.ownerId}:source:auto-promoted-primary`,
    ownerType: promotion.ownerType,
    ownerId: promotion.ownerId,
    ownerTitle: promotion.ownerTitle,
    planId: promotion.planId,
    pathwayId: promotion.pathwayId,
    trackId: null,
    campusId: promotion.campusId,
    label: promotion.label,
    url: promotion.url,
    role,
    parserType,
    confidence: getSourceManifestConfidence(role, parserType),
    isPrimaryDegreeRequirementsLink: true,
    note: undefined,
    lastValidatedOn: getLastValidatedOn(validationNotes),
    validationNotes,
  });
}

function buildSourceManifestRegistry() {
  const entries: TransferPlannerSourceManifestEntry[] = [];
  const bootstrapPlanIds = new Set(
    TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.map((plan) => plan.id)
  );

  for (const plan of TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS) {
    pushSourceManifestEntries(entries, {
      ownerType: "major",
      ownerId: plan.id,
      ownerTitle: plan.title,
      planId: plan.id,
      campusId: plan.campusId,
      links: getOwnerSourceLinks(plan.id, null, plan.officialLinks),
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
      links: pathway.sourceLinks,
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

  for (const promotion of TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS) {
    upsertAutoPromotedPrimarySourceManifestEntry(entries, promotion);
  }

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
const ACTIVE_DERIVED_SHARED_SOURCE_PLAN_ALIASES =
  TRANSFER_PLANNER_DERIVED_SHARED_SOURCE_PLAN_ALIASES.filter((alias) =>
    INTERNAL_SOURCE_GENERATED_BASE_PLAN_IDS.has(alias.sourcePlanId)
  );
const VISIBLE_INTERNAL_SOURCE_GENERATED_BASE_PLAN_IDS = new Set(
  [...INTERNAL_SOURCE_GENERATED_BASE_PLAN_IDS].filter(
    (planId) => !HIDDEN_SOURCE_GAP_PLAN_IDS.has(planId)
  )
);
function getPlanPrimaryParsedRequirementSourceBlocks(planId: string) {
  const primaryDegreeSourceUrl = getTransferPlannerPrimaryDegreeRequirementsSource(planId)?.url ?? null;

  return TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.filter(
    (entry) =>
      entry.planId === planId &&
      !entry.pathwayId &&
      entry.ok &&
      (!primaryDegreeSourceUrl || entry.primarySourceUrl === primaryDegreeSourceUrl)
  );
}

const SOURCE_GENERATED_PATHWAY_COUNT = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.reduce(
  (count, plan) =>
    count +
    TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.filter((entry) => entry.planId === plan.id).length,
  0
);

const STUDENT_VISIBLE_SOURCE_GENERATED_PATHWAY_COUNT = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.reduce(
  (count, plan) => {
    if (HIDDEN_SOURCE_GAP_PLAN_IDS.has(plan.id)) return count;
    return count +
      TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.filter(
        (entry) =>
          entry.planId === plan.id &&
          !HIDDEN_SOURCE_GAP_PATHWAY_KEYS.has(`${plan.id}::${entry.pathwayId}`)
      ).length;
  },
  0
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
