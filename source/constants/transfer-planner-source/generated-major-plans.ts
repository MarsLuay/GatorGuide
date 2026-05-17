import {
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS,
  TRANSFER_PLANNER_BOOTSTRAP_CAMPUSES,
  TRANSFER_PLANNER_BOOTSTRAP_TRACKS,
} from "./bootstrap.generated";
import {
  TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY,
  type TransferPlannerGrcCourseAvailabilityEntry,
} from "../transfer-planner-grc-availability.generated";
import type {
  TransferPlannerCampus,
  TransferPlannerCampusId,
  TransferPlannerChecklistItem,
  TransferPlannerCourseAvailability,
  TransferPlannerDegreeMapSection,
  TransferPlannerLink,
  TransferPlannerMajorPathway,
  TransferPlannerMajorPlan,
  TransferPlannerRequirementGroup,
  TransferPlannerRequirementOption,
  TransferPlannerRequirementReplacement,
  TransferPlannerRequirementSatisfactionMode,
  TransferPlannerSingleCourseEquivalencyEvidence,
  TransferPlannerRequirementStructuralShape,
  TransferPlannerRequirementSupportList,
  TransferPlannerRequirementType,
  TransferPlannerResolvedMajorPlan,
  TransferPlannerTrack,
} from "../transfer-planner-types";
import {
  TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY,
  TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY,
  TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY,
  TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY,
  TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY,
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY,
  TRANSFER_PLANNER_POLICY_REGISTRY,
  TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY,
  TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY,
  getTransferPlannerPrimaryDegreeRequirementsSource,
} from "./registry";
import {
  TRANSFER_PLANNER_SOURCE_GAP_ENTRIES,
} from "./source-gaps.generated";
import { materializeTransferPlannerPathways } from "./pathway-materialization";
import {
  TRANSFER_PLANNER_DERIVED_SHARED_SOURCE_PLAN_ALIASES,
  type TransferPlannerDerivedSharedSourcePlanAlias,
} from "./derived-shared-source-plans";
import { normalizeTransferPlannerCourseCode } from "./course-code-normalization";
import { stripTransferPlannerPlanTitlePrefix } from "./pathway-title-normalization";
import {
  normalizeCategoryOptionRuntimePlan,
  resolveTransferPlannerStudentRuntimeMajorPlan as resolveCompactStudentRuntimeMajorPlan,
} from "./student-runtime";
import {
  COMPUTER_ENGINEERING_APPROVED_MATH_SCIENCE_CATEGORY,
  COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_CATEGORY,
  COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_SOURCE_URL,
} from "./computer-engineering-natural-science";
import {
  getTransferPlannerProgramApprovedCourseFilterDefinition,
} from "./program-approved-course-filters";
import type {
  TransferPlannerDegreeMapBlock,
  TransferPlannerMajorPathwayEntry,
  TransferPlannerMajorRequirementAtom,
  TransferPlannerParsedRequirementAtomCandidate,
  TransferPlannerParsedRequirementSourceBlock,
  TransferPlannerPolicyEntry,
  TransferPlannerRequirementDiffClassificationEntry,
  TransferPlannerRequirementPhase,
  TransferPlannerSourceLink,
} from "./schema";

const STRUCTURED_GRC_SOURCE_KINDS = new Set(["plan-checklist", "plan-course-list"]);
const UW_SEATTLE_ECE_PLAN_ID = "uw-seattle-electrical-computer-engineering";
const UW_SEATTLE_ME_PLAN_ID = "uw-seattle-mechanical-engineering";
const UW_SEATTLE_CIVIL_PLAN_ID = "uw-seattle-civil-engineering";
const UW_SEATTLE_COMPUTER_ENGINEERING_PLAN_ID = "uw-seattle-computer-engineering";
const UW_SEATTLE_COMPUTER_SCIENCE_PLAN_ID = "uw-seattle-computer-science";
const UW_SEATTLE_BIOENGINEERING_PLAN_ID = "uw-seattle-bioengineering";
const UW_SEATTLE_SBSE_PLAN_ID = "uw-seattle-sustainable-bioresource-systems-engineering";
const UW_SEATTLE_SBSE_STALE_BUSINESS_POLICY_ECONOMICS_GRC_CODES = new Set([
  "ACCT& 201",
  "ACCT& 202",
  "ACCT& 203",
]);
const UW_SEATTLE_BIOENGINEERING_TRANSFER_TRACK_ID =
  "grc-associate-stem-engineering-associate-in-science-transfer-track-2-bioengineering-and-chemical-engineering";
const UW_SEATTLE_COMPUTER_ENGINEERING_TRANSFER_TRACK_ID =
  "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-computer-and-electrical-engineering";
const COMPACT_NORMALIZED_RUNTIME_PLAN_IDS = new Set([
  UW_SEATTLE_ECE_PLAN_ID,
  UW_SEATTLE_ME_PLAN_ID,
  UW_SEATTLE_CIVIL_PLAN_ID,
  "uw-seattle-chemical-engineering",
  UW_SEATTLE_BIOENGINEERING_PLAN_ID,
]);
const GUIDE_BACKED_EQUIVALENCY_RULE_SOURCE_KINDS = new Set([
  "uw-green-river-equivalency-guide",
  "uw-green-river-equivalency-guide-derived",
]);
const REFERENCE_COURSE_CODE_PATTERN = /\b[A-Z]{2,8}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;
const COMBINED_ENTRY_REFERENCE_PATTERN = /combined[- ]entry|combined entries|see .*combined/i;
const QUARTER_LABELS: Record<string, string> = {
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
  spring: "Spring",
};
const AUTO_TRACK_MATCH_EXAMPLE_LIMIT = 4;
const MIN_AUTO_TRACK_MATCH_COUNT = 3;
const MIN_RELAXED_AUTO_TRACK_MATCH_COUNT = 2;
const MIN_RELAXED_AUTO_TRACK_PLAN_COVERAGE = 0.5;
const AUTO_TRACK_SUBJECT_AFFINITY_WEIGHT = 0.75;
const AUTO_TRACK_ENGINEERING_DISCIPLINE_AFFINITY_WEIGHT = 4;
const AUTO_TRACK_ENGINEERING_DISCIPLINE_MISMATCH_PENALTY = 2;
const AUTO_MATCH_EXCLUDED_TRACK_TERM_LABEL_PATTERN =
  /\b(transferability of credits|generally transferable courses|section [a-z])\b/i;
const AUTO_TRACK_RECOMMENDATION_SUMMARY_PATTERN =
  /\bcurrent closest Green River transfer path\b/i;
const AUTO_TRACK_GENERIC_SUBJECT_PREFIXES = new Set(["ENGL"]);
const AUTO_TRACK_CONTEXTUAL_SUBJECT_PREFIXES = new Set(["MATH"]);
const AUTO_TRACK_SUBJECT_AFFINITY_RULES: Array<{
  prefixes: string[];
  pattern: RegExp;
}> = [
  { prefixes: ["AMES"], pattern: /\b(?:american ethnic|ethnic studies)\b/i },
  { prefixes: ["ANTH"], pattern: /\banthropology\b/i },
  { prefixes: ["ART"], pattern: /\b(?:art history|fine arts?|arts?)\b/i },
  { prefixes: ["BIOL"], pattern: /\b(?:biology|bioengineering)\b/i },
  { prefixes: ["CHEM"], pattern: /\bchem/i },
  { prefixes: ["CS", "CSE"], pattern: /\b(?:acs|computer science|software development)\b/i },
  { prefixes: ["ECON"], pattern: /\beconomics?\b/i },
  { prefixes: ["ENGR"], pattern: /\bengineering\b/i },
  { prefixes: ["GEOG"], pattern: /\bgeography\b/i },
  { prefixes: ["MATH"], pattern: /\b(?:math|mathematics)\b/i },
  { prefixes: ["PHYS"], pattern: /\bphysics\b/i },
  { prefixes: ["POLS"], pattern: /\bpolitical science\b/i },
  { prefixes: ["PSYC"], pattern: /\bpsychology\b/i },
  { prefixes: ["SOC"], pattern: /\bsociology\b/i },
];
const AUTO_TRACK_ENGINEERING_DISCIPLINE_RULES: Array<{
  id: string;
  label: string;
  pattern: RegExp;
}> = [
  {
    id: "bioengineering",
    label: "Bioengineering",
    pattern: /\bbio\s*engineering\b|\bbioengineering\b/i,
  },
  {
    id: "chemical",
    label: "Chemical Engineering",
    pattern: /\bchemical\b/i,
  },
  {
    id: "civil",
    label: "Civil Engineering",
    pattern: /\bcivil\b/i,
  },
  {
    id: "computer",
    label: "Computer Engineering",
    pattern: /\bcomputer\b/i,
  },
  {
    id: "electrical",
    label: "Electrical Engineering",
    pattern: /\belectrical\b/i,
  },
  {
    id: "mechanical",
    label: "Mechanical Engineering",
    pattern: /\bmechanical\b/i,
  },
];
const REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE =
  "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way.";
const AUTO_SOURCE_BACKED_UW_PREP_TARGET_PREFIX = "UW prep target:";
const AUTO_SOURCE_BACKED_UW_PREP_TARGET_NOTE =
  "Official UW prep target found in the current source-backed requirements, but no public Green River equivalent is currently provable.";
const AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_TITLE = "Source-backed UW prep guidance";
const AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_NOTE =
  "Current official source-backed requirement materials identify more UW prep for this major, but the published Green River equivalent path is not yet provable enough for planner-ready course mapping.";
const MAX_SOURCE_BACKED_UW_PREP_TARGET_COUNT = 18;
const UW_SEATTLE_BIOENGINEERING_SOURCE_BACKED_GEN_ED_SECTION: TransferPlannerDegreeMapSection = {
  id: "uw-seattle-bioengineering-source-backed-general-education",
  title: "Bioengineering source-backed general education requirements",
  note: "Official UW Bioengineering general education targets parsed from the degree requirements page.",
  items: [
    "English Composition: 5 credits.",
    "Arts and Humanities: 10 credits minimum.",
    "Social Sciences: 10 credits minimum.",
    "4 additional credits of Arts and Humanities or Social Sciences.",
    "Diversity: 3 credits; these credits may overlap with Areas of Inquiry.",
    "Additional Areas of Inquiry 8 credits from any area as general electives.",
  ],
};
const SOURCE_ONLY_FALLBACK_NOISE_PREFIXES = new Set([
  "AUTUMN",
  "WINTER",
  "SPRING",
  "SUMMER",
  "LANGUAGE",
  "BOTH",
  "CALL",
  "COMPLETE",
  "EARN",
  "THROUGH",
]);
const SOURCE_GENERATED_PARSER_FALLBACK_TITLE = "Source-backed major preparation";
const SOURCE_GENERATED_PARSER_FALLBACK_NOTE =
  "Current official source-backed requirements exist for this major, but the lower-division Green River checklist mapping is still expanding.";
const PARSER_ONLY_FALLBACK_DEGREE_MAP_NOTE =
  "Built from the current parser-backed official requirement source while lower-division Green River course extraction is still filling in.";
const SOURCE_BACKED_INTENTIONALLY_SKIPPED_VALIDATION_NOTE_PATTERN =
  /Auto-promotion was intentionally skipped/i;
const SOURCE_BACKED_TRACK_MATCH_SAFE_SKIP_REASON_PATTERN =
  /\balternate path that the planner already represents\b|\bexisting requirement row\b/i;
const SOURCE_BACKED_SIBLING_OPTION_SKIP_REASON_PATTERN =
  /\bmatched source lines list several sibling UW options\b/i;
const SOURCE_BACKED_NON_REQUIREMENT_CUE_PATTERN =
  /\b(suggested general education|not required for transferring|approved list|recommended|suggested|consider|elective|replacement|course list|course lists|course evaluation|course evaluations|capstone course|capstone courses|suggested course pathways?|choose\s+(?:one|[0-9]+)|one\s+of|select(?:ed|ing)?|\d+\s+credits?\s+from|minimum\s+\d+\s+credits?[^.]{0,80}\bfrom)\b/i;
const DEGREE_MAP_GUIDE_BLOCK_TITLE_EXCLUSION_PATTERN = /\bchoices and pathway notes\b/i;
const MIN_SOURCE_BACKED_SIBLING_CHOICE_RECOVERY_COUNT = 3;
const SOURCE_BACKED_MAJOR_SCOPE_CUE_PATTERN =
  /\b(?:if|for)\s+([^:.;]+?)\s+(?:major|majors|option|options|program|programs)\b/i;
const SOURCE_BACKED_MAJOR_SCOPE_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "degree",
  "for",
  "in",
  "major",
  "majors",
  "of",
  "option",
  "options",
  "or",
  "program",
  "programs",
  "the",
  "to",
  "track",
  "with",
]);

type ChecklistItemsByPhase = {
  beforeApplication: TransferPlannerChecklistItem[];
  beforeEnrollment: TransferPlannerChecklistItem[];
  stayAtGrc: TransferPlannerChecklistItem[];
};

type SupplementalChecklistSeed = {
  id: string;
  phase: TransferPlannerRequirementPhase;
  title: string;
  grcCourses?: string[];
  alternatives?: string[][];
  minCompletedCount?: number;
  note?: string;
  fallbackCourseCount?: number;
  sourceUrl?: string | null;
  sourceRole?: string | null;
  sourceScope?: string | null;
  sourceSection?: string | null;
  canCreateScheduleRow?: boolean;
  reason?: string | null;
};

const SUPPLEMENTAL_CHECKLIST_SEEDS_BY_PLAN: Partial<
  Record<string, SupplementalChecklistSeed[]>
> = {
  [UW_SEATTLE_COMPUTER_ENGINEERING_PLAN_ID]: [
    {
      id: "calc123",
      phase: "before-application",
      title: "Calculus I-III sequence",
      grcCourses: ["MATH& 151", "MATH& 152", "MATH& 163"],
      alternatives: [["MATH& 151", "MATH& 152", "MATH& 153", "MATH& 254"]],
    },
    {
      id: "phys121",
      phase: "before-enrollment",
      title: "PHYS 121",
      grcCourses: ["PHYS& 221"],
    },
    {
      id: "phys122",
      phase: "before-enrollment",
      title: "PHYS 122",
      grcCourses: ["PHYS& 222"],
    },
    {
      id: "math208",
      phase: "before-enrollment",
      title: "MATH 208",
      grcCourses: ["MATH 240"],
      note: REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE,
    },
    {
      id: "engr204",
      phase: "before-enrollment",
      title: "EE 215",
      grcCourses: ["ENGR& 204"],
      note: REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE,
    },
  ],
  "uw-seattle-human-centered-design-engineering": [
    {
      id: "ten-calc-credits",
      phase: "before-application",
      title: "Ten calculus credits",
      grcCourses: ["MATH& 151", "MATH& 152", "MATH& 163"],
      minCompletedCount: 2,
    },
    {
      id: "science-three",
      phase: "before-application",
      title: "Biology sequence",
      grcCourses: ["BIOL& 211", "BIOL& 212", "BIOL& 213"],
    },
  ],
  "uw-seattle-chemical-engineering": [
    {
      id: "chem142-162",
      phase: "before-enrollment",
      title: "CHEM 142-162 sequence",
      grcCourses: ["CHEM& 161", "CHEM& 162", "CHEM& 163"],
    },
  ],
  [UW_SEATTLE_BIOENGINEERING_PLAN_ID]: [
    {
      id: "bioe-english-composition",
      phase: "before-application",
      title: "English Composition",
      grcCourses: ["ENGL& 101"],
    },
    {
      id: "bioe-calculus",
      phase: "before-application",
      title: "MATH 124, 125, 126",
      grcCourses: ["MATH& 151", "MATH& 152", "MATH& 163"],
      alternatives: [["MATH& 151", "MATH& 152", "MATH& 153", "MATH& 254"]],
    },
    {
      id: "bioe-general-chemistry",
      phase: "before-application",
      title: "CHEM 142, 152, 162",
      grcCourses: ["CHEM& 161", "CHEM& 162", "CHEM& 163"],
    },
    {
      id: "bioe-physics-121",
      phase: "before-application",
      title: "PHYS 121",
      grcCourses: ["PHYS& 221"],
    },
    {
      id: "biol180",
      phase: "before-application",
      title: "BIOL 180, 200, 220",
      grcCourses: ["BIOL& 211", "BIOL& 212", "BIOL& 213"],
    },
    {
      id: "programming",
      phase: "before-application",
      title: "AMATH 301",
      grcCourses: ["ENGR 250"],
    },
    {
      id: "bioe-math207",
      phase: "before-enrollment",
      title: "MATH 207 or AMATH 351",
      grcCourses: ["MATH 238"],
    },
    {
      id: "bioe-math208",
      phase: "before-enrollment",
      title: "MATH 208 or AMATH 352",
      grcCourses: ["MATH 240"],
    },
    {
      id: "bioe-organic-chemistry",
      phase: "before-enrollment",
      title: "CHEM 223 or CHEM 237",
      grcCourses: ["CHEM& 261"],
    },
    {
      id: "bioe-physics-122",
      phase: "before-enrollment",
      title: "PHYS 122",
      grcCourses: ["PHYS& 222"],
    },
  ],
  "uw-seattle-business-administration": [
    {
      id: "uws-baba-approved-calculus-prerequisite",
      phase: "before-application",
      title: "Approved calculus prerequisite",
      alternatives: [["MATH& 151"], ["MATH& 152"], ["MATH& 163"]],
      minCompletedCount: 1,
    },
    {
      id: "uws-baba-microeconomics",
      phase: "before-application",
      title: "Microeconomics",
      grcCourses: ["ECON& 201"],
    },
  ],
  "uw-bothell-csse": [
    {
      id: "bothell-csse-calc",
      phase: "before-application",
      title: "Calculus minimum",
      grcCourses: ["MATH& 151", "MATH& 152"],
    },
    {
      id: "bothell-csse-programming",
      phase: "before-application",
      title: "Programming minimum",
      grcCourses: ["CS 121", "CS 122"],
    },
    {
      id: "bothell-csse-calc3",
      phase: "stay-at-grc",
      title: "Third calculus course",
      grcCourses: ["MATH& 163"],
    },
    {
      id: "bothell-csse-cs123",
      phase: "stay-at-grc",
      title: "Additional programming depth",
      grcCourses: ["CS 123"],
    },
  ],
  "uw-tacoma-computer-engineering": [
    {
      id: "tacoma-compe-math207",
      phase: "before-application",
      title: "MATH 207",
      grcCourses: ["MATH 238"],
    },
    {
      id: "tacoma-compe-circuits",
      phase: "before-application",
      title: "Circuit preparation",
      grcCourses: ["ENGR& 204"],
    },
    {
      id: "tacoma-compe-math208",
      phase: "before-enrollment",
      title: "MATH 208",
      grcCourses: ["MATH 240"],
      note: REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE,
    },
  ],
  "uw-tacoma-electrical-engineering": [
    {
      id: "tacoma-ee-programming1",
      phase: "before-application",
      title: "Programming I",
      grcCourses: ["CS 121"],
    },
    {
      id: "tacoma-ee-programming2",
      phase: "before-application",
      title: "Programming II",
      grcCourses: ["CS 122"],
    },
    {
      id: "tacoma-ee-math208",
      phase: "before-enrollment",
      title: "MATH 208",
      grcCourses: ["MATH 240"],
      note: REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE,
    },
  ],
  "uw-tacoma-civil-engineering": [
    {
      id: "uwt-ce-programming",
      phase: "before-application",
      title: "Programming foundation",
      grcCourses: ["CS 121"],
    },
  ],
  "uw-tacoma-education": [
    {
      id: "uwt-education-support",
      phase: "stay-at-grc",
      title: "Education support course",
      fallbackCourseCount: 1,
    },
  ],
  "uw-tacoma-computer-science-and-systems-ba": [
    {
      id: "uwt-cssba-programming",
      phase: "before-application",
      title: "Programming foundation",
      grcCourses: ["CS 121"],
    },
  ],
  "uw-tacoma-computer-science-and-systems-bs": [
    {
      id: "uwt-cssbs-math208",
      phase: "before-enrollment",
      title: "MATH 208",
      grcCourses: ["MATH 240"],
      note: REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE,
    },
  ],
  "uw-tacoma-information-technology": [
    {
      id: "uwt-it-math208",
      phase: "before-enrollment",
      title: "MATH 208",
      grcCourses: ["MATH 240"],
      note: REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE,
    },
  ],
  "uw-tacoma-mathematics": [
    {
      id: "uwt-math-calc123",
      phase: "before-application",
      title: "Calculus I-III sequence",
      grcCourses: ["MATH& 151", "MATH& 152", "MATH& 163"],
      alternatives: [["MATH& 151", "MATH& 152", "MATH& 153", "MATH& 254"]],
    },
  ],
  "uw-tacoma-psychology": [
    {
      id: "uwt-psych-foundations",
      phase: "before-application",
      title: "Psychology foundations",
      fallbackCourseCount: 1,
    },
  ],
  "uw-seattle-american-ethnic-studies": [
    {
      id: "uws-aes-ethnic-studies-foundation",
      phase: "stay-at-grc",
      title: "Ethnic studies and related social-science foundation",
      grcCourses: ["AMES 100"],
    },
    {
      id: "uws-aes-history-humanities-support",
      phase: "stay-at-grc",
      title: "History and humanities support for concentration work",
      grcCourses: ["HUMAN 100"],
    },
    {
      id: "uws-aes-writing-support",
      phase: "stay-at-grc",
      title: "Writing-heavy humanities support",
      grcCourses: ["ENGL& 101"],
    },
  ],
  "uw-bothell-computer-engineering": [
    {
      id: "bothell-compe-circuits",
      phase: "stay-at-grc",
      title: "B EE 215",
      grcCourses: ["ENGR& 204"],
      note: REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE,
    },
  ],
  "uw-bothell-electrical-engineering": [
    {
      id: "uwb-ee-circuits",
      phase: "stay-at-grc",
      title: "B EE 215",
      grcCourses: ["ENGR& 204"],
      note: REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE,
    },
  ],
  "uw-bothell-media-and-communications-studies": [
    {
      id: "uwb-mcs-intro-media",
      phase: "stay-at-grc",
      title: "Intro media course",
      fallbackCourseCount: 1,
    },
  ],
};

type PathwayPlanKey = `${string}::${string}`;

const LEGACY_PLAN_ID_ALIASES = new Map<string, string>([
  [
    "uw-seattle-electrical-and-computer-engineering",
    "uw-seattle-electrical-computer-engineering",
  ],
  [
    "uw-seattle-industrial-and-systems-engineering",
    "uw-seattle-industrial-systems-engineering",
  ],
  [
    "uw-seattle-materials-science-and-engineering",
    "uw-seattle-materials-science-engineering",
  ],
]);

function resolveTransferPlannerPlanIdAlias(planId: string | null | undefined) {
  const normalizedPlanId = String(planId ?? "").trim();
  if (!normalizedPlanId) {
    return normalizedPlanId;
  }
  return LEGACY_PLAN_ID_ALIASES.get(normalizedPlanId) ?? normalizedPlanId;
}

function escapeRegExp(value: string) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceSourcePlanTitle(
  value: string | null | undefined,
  sourceTitle: string,
  derivedTitle: string
) {
  const sanitized = sanitizePlannerOwnedText(value);
  if (!sanitized) {
    return sanitized;
  }

  return sanitized.replace(new RegExp(`\\b${escapeRegExp(sourceTitle)}\\b`, "g"), derivedTitle);
}

function materializeDerivedSharedSourcePlan(
  sourcePlan: TransferPlannerMajorPlan,
  alias: TransferPlannerDerivedSharedSourcePlanAlias
) {
  const sourceTitle = sanitizePlannerOwnedText(sourcePlan.title);
  const derivedTitle = sanitizePlannerOwnedText(alias.derivedTitle);

  return {
    ...sourcePlan,
    id: alias.derivedPlanId,
    title: derivedTitle,
    shortTitle: sanitizePlannerOwnedText(alias.derivedShortTitle ?? derivedTitle) || derivedTitle,
    summary: replaceSourcePlanTitle(sourcePlan.summary, sourceTitle, derivedTitle),
    degreeMapSections: (sourcePlan.degreeMapSections ?? []).map((section) => ({
      ...section,
      title: replaceSourcePlanTitle(section.title, sourceTitle, derivedTitle),
      note: replaceSourcePlanTitle(section.note, sourceTitle, derivedTitle) || undefined,
    })),
    pathways: (sourcePlan.pathways ?? []).map((pathway) => ({
      ...pathway,
      summary: replaceSourcePlanTitle(pathway.summary, sourceTitle, derivedTitle),
      degreeMapSections: (pathway.degreeMapSections ?? []).map((section) => ({
        ...section,
        title: replaceSourcePlanTitle(section.title, sourceTitle, derivedTitle),
        note: replaceSourcePlanTitle(section.note, sourceTitle, derivedTitle) || undefined,
      })),
    })),
  } satisfies TransferPlannerMajorPlan;
}

function appendDerivedSharedSourcePlans(plans: TransferPlannerMajorPlan[]) {
  const plansById = new Map(plans.map((plan) => [plan.id, plan] as const));
  const derivedPlans: TransferPlannerMajorPlan[] = [];

  for (const alias of TRANSFER_PLANNER_DERIVED_SHARED_SOURCE_PLAN_ALIASES) {
    if (plansById.has(alias.derivedPlanId)) {
      continue;
    }

    const sourcePlan = plansById.get(alias.sourcePlanId);
    if (!sourcePlan) {
      continue;
    }

    derivedPlans.push(materializeDerivedSharedSourcePlan(sourcePlan, alias));
  }

  return uniqueById([...plans, ...derivedPlans]);
}

function makePathwayPlanKey(planId: string, pathwayId: string | null | undefined) {
  return `${planId}::${String(pathwayId ?? "")}` as PathwayPlanKey;
}

const STUDENT_HIDDEN_SOURCE_GAP_PLAN_IDS = new Set(
  TRANSFER_PLANNER_SOURCE_GAP_ENTRIES.filter(
    (entry) => entry.studentVisibility === "hidden" && !entry.pathwayId
  ).map((entry) => entry.planId)
);
const STUDENT_HIDDEN_SOURCE_GAP_PATHWAY_KEYS = new Set(
  TRANSFER_PLANNER_SOURCE_GAP_ENTRIES.filter(
    (entry) => entry.studentVisibility === "hidden" && entry.pathwayId
  ).map((entry) => makePathwayPlanKey(entry.planId, entry.pathwayId))
);

export function isTransferPlannerStudentHiddenSourceGap(
  planId: string | null | undefined,
  pathwayId?: string | null
) {
  const resolvedPlanId = resolveTransferPlannerPlanIdAlias(planId);
  if (!resolvedPlanId) return false;
  if (pathwayId) {
    return STUDENT_HIDDEN_SOURCE_GAP_PATHWAY_KEYS.has(makePathwayPlanKey(resolvedPlanId, pathwayId));
  }
  return STUDENT_HIDDEN_SOURCE_GAP_PLAN_IDS.has(resolvedPlanId);
}

function uniqueById<T extends { id: string }>(values: T[]) {
  const seen = new Set<string>();
  const uniqueValues: T[] = [];

  for (const value of values) {
    if (!value?.id || seen.has(value.id)) continue;
    seen.add(value.id);
    uniqueValues.push(value);
  }

  return uniqueValues;
}

function normalizeRequirementGroupSemanticText(value: string | null | undefined) {
  return sanitizePlannerOwnedText(value).toLowerCase().replace(/\s+/g, " ");
}

function getRequirementGroupOptionSemanticKey(option: TransferPlannerRequirementOption) {
  const categoryOption = option.categoryOption;
  return [
    option.optionKind,
    normalizeRequirementGroupSemanticText(option.label),
    (option.displayCourseCodes ?? []).map(normalizeCourseCode).sort().join(","),
    (option.uwCourses ?? []).map(normalizeCourseCode).sort().join(","),
    (option.equivalentUwCourseCodes ?? []).map(normalizeCourseCode).sort().join(","),
    categoryOption
      ? [
          normalizeRequirementGroupSemanticText(categoryOption.sourceCategoryCode),
          normalizeRequirementGroupSemanticText(categoryOption.category),
          categoryOption.creditMin ?? categoryOption.credits ?? "",
          categoryOption.creditMax ?? categoryOption.credits ?? "",
        ].join("/")
      : "",
  ].join("|");
}

function getRequirementGroupSemanticKey(group: TransferPlannerRequirementGroup) {
  const optionKey = (group.options ?? [])
    .map(getRequirementGroupOptionSemanticKey)
    .sort()
    .join(";");
  return [
    normalizeRequirementGroupSemanticText(group.label),
    group.requirementType,
    group.minCredits ?? "",
    group.maxCredits ?? "",
    group.requiredCount ?? "",
    group.selectionCount ?? "",
    optionKey,
  ].join("::");
}

function uniqueRequirementGroupsForPathwayScope(
  groups: TransferPlannerRequirementGroup[],
  pathwayId?: string | null
) {
  if (!pathwayId) {
    return uniqueById(groups);
  }

  const groupsBySemanticKey = new Map<string, TransferPlannerRequirementGroup>();
  const orderedKeys: string[] = [];
  for (const group of groups) {
    const semanticKey = getRequirementGroupSemanticKey(group);
    const existing = groupsBySemanticKey.get(semanticKey) ?? null;
    if (!existing) {
      groupsBySemanticKey.set(semanticKey, group);
      orderedKeys.push(semanticKey);
      continue;
    }

    const existingMatchesPathway = existing.pathwayId === pathwayId;
    const candidateMatchesPathway = group.pathwayId === pathwayId;
    if (!existingMatchesPathway && candidateMatchesPathway) {
      groupsBySemanticKey.set(semanticKey, group);
    }
  }

  return uniqueById(orderedKeys.map((key) => groupsBySemanticKey.get(key)!));
}

function compact<T>(values: Array<T | null | undefined | false>) {
  return values.filter(Boolean) as T[];
}

function toPlannerLink(link: TransferPlannerSourceLink): TransferPlannerLink {
  return {
    label: link.label,
    url: link.url,
    note: link.note,
  };
}

function normalizeCourseCode(value: string) {
  return normalizeTransferPlannerCourseCode(value);
}

function uniquePlannerStrings(values: string[]) {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    uniqueValues.push(normalized);
  }

  return uniqueValues;
}

function slugifyPlannerId(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueRequirementSupportLists(
  supportLists: TransferPlannerRequirementSupportList[]
) {
  const seen = new Set<string>();
  const uniqueSupportLists: TransferPlannerRequirementSupportList[] = [];
  for (const supportList of supportLists) {
    const approvedListKey = supportList.approvedListKey ?? supportList.filterKey ?? "";
    const key =
      approvedListKey &&
      (supportList.shape === "approved-filter-list" || supportList.shape === "approved-course-list")
        ? `approved:${supportList.sourceUrl ?? ""}:${approvedListKey}`
        : supportList.id || `${supportList.shape}:${supportList.sourceUrl}:${supportList.listTitle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueSupportLists.push(supportList);
  }
  return uniqueSupportLists;
}

function formatRequirementCreditText(
  minCredits: number | null | undefined,
  maxCredits: number | null | undefined
) {
  if (minCredits == null && maxCredits == null) {
    return null;
  }
  if (minCredits != null && maxCredits != null && minCredits !== maxCredits) {
    return `${minCredits}-${maxCredits}`;
  }
  return String(minCredits ?? maxCredits);
}

function getRequirementSupportListContext(block: TransferPlannerParsedRequirementSourceBlock) {
  return [
    block.planId,
    block.ownerId,
    block.ownerTitle,
    block.sourceLabel,
    block.sourceUrl,
    block.primarySourceLabel,
    block.primarySourceUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function inferApprovedListKeyFromSupportSource(block: TransferPlannerParsedRequirementSourceBlock) {
  const context = getRequirementSupportListContext(block);
  if (
    (block.planId === UW_SEATTLE_COMPUTER_ENGINEERING_PLAN_ID ||
      /\bcomputer engineering\b/.test(context)) &&
    /\b(?:natural science|science)\b/.test(context)
  ) {
    return "computer-engineering-natural-science";
  }
  if (
    (block.planId === UW_SEATTLE_COMPUTER_SCIENCE_PLAN_ID ||
      /\b(?:computer science|allen school|data science)\b/.test(context)) &&
    /\b(?:natural science|science)\b/.test(context)
  ) {
    return "computer-science-approved-science";
  }
  if (/\bapproved\b/.test(context) && /\belectives?\b/.test(context)) {
    return `${slugifyPlannerId(block.planId || block.ownerId || "unknown-owner")}-approved-electives`;
  }
  return null;
}

function buildRequirementSupportList(input: {
  block: TransferPlannerParsedRequirementSourceBlock;
  shape: TransferPlannerRequirementSupportList["shape"];
  acceptedUwCourseCodes: string[];
  approvedListKey?: string | null;
}): TransferPlannerRequirementSupportList {
  const sourceUrl = input.block.sourceUrl || input.block.primarySourceUrl || null;
  const listTitle =
    sanitizePlannerOwnedText(input.block.sourceLabel || input.block.primarySourceLabel) ||
    (input.shape === "elective-list" ? "Elective list" : "Approved course list");
  const filterDefinition = getTransferPlannerProgramApprovedCourseFilterDefinition(
    input.approvedListKey
  );
  return {
    id: `${input.block.id || slugifyPlannerId(sourceUrl || listTitle)}:support-list:${input.shape}`,
    shape: input.shape,
    sourceUrl,
    sourceRole: input.block.sourceRole ?? null,
    listTitle,
    filterKey: filterDefinition?.filterKey ?? input.approvedListKey ?? null,
    ownerId: input.block.ownerId ?? input.block.planId ?? null,
    majorId: input.block.planId ?? null,
    pathwayId: input.block.pathwayId ?? null,
    officialSourceUrl: filterDefinition?.officialSourceUrl ?? sourceUrl,
    acceptedUwCourseCodes: uniquePlannerStrings(
      (filterDefinition?.approvedUwCourseCodes ?? input.acceptedUwCourseCodes).map((courseCode) =>
        normalizeCourseCode(courseCode)
      )
    ),
    approvedUwCourseGroups: filterDefinition?.approvedUwCourseGroups?.map((group) =>
      uniquePlannerStrings(group.map((courseCode) => normalizeCourseCode(courseCode)))
    ),
    petitionOnlyNotes: filterDefinition?.petitionOnlyNotes
      ? [...filterDefinition.petitionOnlyNotes]
      : undefined,
    generatedFilterId: filterDefinition?.filterId ?? null,
    sourceEvidenceLines: filterDefinition?.sourceEvidenceLines
      ? [...filterDefinition.sourceEvidenceLines]
      : undefined,
    sourceEvidenceHeadings: filterDefinition?.sourceEvidenceHeadings
      ? [...filterDefinition.sourceEvidenceHeadings]
      : undefined,
    sourceFingerprint: filterDefinition?.sourceFingerprint ?? null,
    sourceBackedProgramApproval: Boolean(filterDefinition),
    approvedListKey: input.approvedListKey ?? null,
    supportOnly: true,
    canCreateRequiredRow: false,
    canCreateScheduleRow: false,
    linkedPrimaryRequirementIds: [],
  };
}

function buildRequirementSupportListsFromBlock(
  block: TransferPlannerParsedRequirementSourceBlock
) {
  if (block.supportLists?.length) {
    return block.supportLists.map((supportList) => {
      const filterDefinition = getTransferPlannerProgramApprovedCourseFilterDefinition(
        supportList.approvedListKey ?? supportList.filterKey
      );
      return {
        ...supportList,
        filterKey: filterDefinition?.filterKey ?? supportList.filterKey ?? supportList.approvedListKey ?? null,
        officialSourceUrl:
          filterDefinition?.officialSourceUrl ?? supportList.officialSourceUrl ?? supportList.sourceUrl,
        acceptedUwCourseCodes: uniquePlannerStrings(
          (filterDefinition?.approvedUwCourseCodes ?? supportList.acceptedUwCourseCodes ?? []).map(
            (courseCode) => normalizeCourseCode(courseCode)
          )
        ),
        approvedUwCourseGroups:
          filterDefinition?.approvedUwCourseGroups?.map((group) =>
            uniquePlannerStrings(group.map((courseCode) => normalizeCourseCode(courseCode)))
          ) ?? supportList.approvedUwCourseGroups,
        petitionOnlyNotes: filterDefinition?.petitionOnlyNotes
          ? [...filterDefinition.petitionOnlyNotes]
          : supportList.petitionOnlyNotes,
        generatedFilterId:
          filterDefinition?.filterId ?? supportList.generatedFilterId ?? null,
        sourceEvidenceLines: filterDefinition?.sourceEvidenceLines
          ? [...filterDefinition.sourceEvidenceLines]
          : supportList.sourceEvidenceLines,
        sourceEvidenceHeadings: filterDefinition?.sourceEvidenceHeadings
          ? [...filterDefinition.sourceEvidenceHeadings]
          : supportList.sourceEvidenceHeadings,
        sourceFingerprint:
          filterDefinition?.sourceFingerprint ?? supportList.sourceFingerprint ?? null,
        sourceBackedProgramApproval:
          filterDefinition ? true : supportList.sourceBackedProgramApproval ?? null,
        supportOnly: true as const,
        canCreateRequiredRow: false as const,
        canCreateScheduleRow: false,
        linkedPrimaryRequirementIds: supportList.linkedPrimaryRequirementIds ?? [],
      };
    });
  }

  const approvedCodes = uniquePlannerStrings(
    (block.approvedFilterUwCourseCodes ?? []).map((courseCode) => normalizeCourseCode(courseCode))
  );
  const electiveCodes = uniquePlannerStrings(
    (block.electiveListUwCourseCodes ?? []).map((courseCode) => normalizeCourseCode(courseCode))
  );
  const supportOnlyCodes = uniquePlannerStrings(
    (block.supportOnlyUwCourseCodes ?? []).map((courseCode) => normalizeCourseCode(courseCode))
  );
  const usedCodes = new Set([...approvedCodes, ...electiveCodes]);
  const remainingSupportOnlyCodes = supportOnlyCodes.filter((courseCode) => !usedCodes.has(courseCode));
  const approvedListKey = inferApprovedListKeyFromSupportSource(block);
  const approvedFilterDefinition = getTransferPlannerProgramApprovedCourseFilterDefinition(
    approvedListKey
  );
  const supportLists: TransferPlannerRequirementSupportList[] = [];

  if (approvedCodes.length || (approvedFilterDefinition && block.sourceRole === "approved-course-list")) {
    supportLists.push(
      buildRequirementSupportList({
        block,
        shape: "approved-filter-list",
        acceptedUwCourseCodes: approvedCodes,
        approvedListKey,
      })
    );
  }

  if (electiveCodes.length) {
    supportLists.push(
      buildRequirementSupportList({
        block,
        shape: "elective-list",
        acceptedUwCourseCodes: electiveCodes,
      })
    );
  }

  if (remainingSupportOnlyCodes.length) {
    const sourceRole = String(block.sourceRole ?? "");
    const shape =
      sourceRole === "elective-list"
        ? "elective-list"
        : sourceRole === "approved-course-list"
          ? "approved-course-list"
          : null;
    if (shape) {
      supportLists.push(
        buildRequirementSupportList({
          block,
          shape,
          acceptedUwCourseCodes: remainingSupportOnlyCodes,
          approvedListKey: shape === "approved-course-list" ? approvedListKey : null,
        })
      );
    }
  }

  return supportLists;
}

function getRequirementSupportListsForScope(planId: string, pathwayId?: string | null) {
  return uniqueRequirementSupportLists(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.filter(
      (block) =>
        block.planId === planId &&
        (pathwayId === undefined
          ? true
          : pathwayId === null
            ? !block.pathwayId
            : block.pathwayId === pathwayId)
    ).flatMap(buildRequirementSupportListsFromBlock)
  );
}

function pickResolvedPlannerPathway(
  pathways: TransferPlannerMajorPathway[],
  pathwayId: string | null | undefined
) {
  if (!pathways.length) return null;
  if (!pathwayId) return pathways[0] ?? null;

  const exactMatch = pathways.find((entry) => entry.id === pathwayId) ?? null;
  if (exactMatch) {
    return exactMatch;
  }

  const expandedFamilyMatches = pathways.filter((entry) => entry.id.startsWith(`${pathwayId}:`));
  if (!expandedFamilyMatches.length) {
    return pathways[0] ?? null;
  }

  return expandedFamilyMatches.find((entry) => /\bgeneral\b/i.test(entry.label)) ??
    expandedFamilyMatches[0] ??
    null;
}

function getGuideRuleStatusScore(rule: {
  ruleStatus?: string | null;
}) {
  switch (rule.ruleStatus) {
    case "active":
      return 3;
    case "legacy":
      return 2;
    case "deprecated":
      return 1;
    default:
      return 2;
  }
}

function getGuideRuleAcceptanceScore(rule: {
  acceptanceCategory?: string | null;
}) {
  switch (rule.acceptanceCategory) {
    case "preferred":
      return 4;
    case "accepted":
      return 3;
    case "accepted-with-warning":
      return 2;
    case "legacy-accepted":
      return 1;
    default:
      return 0;
  }
}

function getGuideRuleTypeScore(rule: {
  type?: string | null;
}) {
  switch (rule.type) {
    case "direct-course":
      return 5;
    case "full-credit-combo":
      return 4;
    case "sequence":
      return 3;
    case "alternate-path":
      return 2;
    default:
      return 1;
  }
}

function isReferenceOnlyGuideRule(rule: {
  title?: string | null;
  sourceCourseLabel?: string | null;
  notes?: string[] | null;
  plannerWarnings?: string[] | null;
}) {
  return COMBINED_ENTRY_REFERENCE_PATTERN.test(
    [
      rule.title,
      rule.sourceCourseLabel,
      ...(rule.notes ?? []),
      ...(rule.plannerWarnings ?? []),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function compareGuideRules(
  left: {
    id: string;
    sourceCourseSets?: string[][] | null;
    ruleStatus?: string | null;
    acceptanceCategory?: string | null;
    type?: string | null;
    title?: string | null;
    sourceCourseLabel?: string | null;
    notes?: string[] | null;
    plannerWarnings?: string[] | null;
  },
  right: {
    id: string;
    sourceCourseSets?: string[][] | null;
    ruleStatus?: string | null;
    acceptanceCategory?: string | null;
    type?: string | null;
    title?: string | null;
    sourceCourseLabel?: string | null;
    notes?: string[] | null;
    plannerWarnings?: string[] | null;
  }
) {
  const referenceOnlyDelta =
    Number(isReferenceOnlyGuideRule(left)) - Number(isReferenceOnlyGuideRule(right));
  if (referenceOnlyDelta !== 0) return referenceOnlyDelta;

  const statusDelta = getGuideRuleStatusScore(right) - getGuideRuleStatusScore(left);
  if (statusDelta !== 0) return statusDelta;

  const acceptanceDelta =
    getGuideRuleAcceptanceScore(right) - getGuideRuleAcceptanceScore(left);
  if (acceptanceDelta !== 0) return acceptanceDelta;

  const typeDelta = getGuideRuleTypeScore(right) - getGuideRuleTypeScore(left);
  if (typeDelta !== 0) return typeDelta;

  const sourceSetLengthDelta =
    (left.sourceCourseSets?.[0]?.length ?? Number.MAX_SAFE_INTEGER) -
    (right.sourceCourseSets?.[0]?.length ?? Number.MAX_SAFE_INTEGER);
  if (sourceSetLengthDelta !== 0) return sourceSetLengthDelta;

  return left.id.localeCompare(right.id);
}

function getConcreteGuideTargetCourseCodes(rule: {
  targetCourseCodes?: string[] | null;
}) {
  return uniquePlannerStrings(
    (rule.targetCourseCodes ?? [])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter((courseCode) => courseCode && !/\b[1-4]XX\b/i.test(courseCode))
      .filter((courseCode) => !/^STRONGER\b/i.test(courseCode))
  );
}

function canUseGuideRuleForSourceBackedRequirement(
  rule: {
    targetCourseCodes?: string[] | null;
  },
  requestedTargetCourseCode: string,
  sourceRequirementCourseCodes: Set<string>
) {
  const normalizedRequestedTargetCourseCode = normalizeCourseCode(requestedTargetCourseCode);
  const concreteTargetCourseCodes = getConcreteGuideTargetCourseCodes(rule);
  if (concreteTargetCourseCodes.length <= 1) {
    return true;
  }
  if (!concreteTargetCourseCodes.includes(normalizedRequestedTargetCourseCode)) {
    return true;
  }

  return concreteTargetCourseCodes.every((courseCode) =>
    sourceRequirementCourseCodes.has(courseCode)
  );
}

const GUIDE_RULES_BY_ID = new Map(
  TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY.map((rule) => [rule.id, rule])
);

function isPresentDayGuideRule(
  rule: ((typeof TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY)[number] | null | undefined)
) {
  return Boolean(rule) && !rule?.isObsoleteSourceCourse;
}

function isPresentDayGuideRuleId(guideRuleId: string | null | undefined) {
  if (!guideRuleId) {
    return true;
  }

  return isPresentDayGuideRule(GUIDE_RULES_BY_ID.get(guideRuleId) ?? null);
}

const GUIDE_RULES_BY_TARGET_COURSE_CODE = new Map<
  string,
  Array<(typeof TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY)[number]>
>();

for (const rule of TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY) {
  if (!GUIDE_BACKED_EQUIVALENCY_RULE_SOURCE_KINDS.has(rule.sourceKind ?? "")) continue;
  if (rule.acceptanceCategory === "no-credit") continue;
  if (!isPresentDayGuideRule(rule)) continue;
  if (!(rule.targetCourseCodes ?? []).length || !(rule.sourceCourseSets ?? []).length) continue;

  for (const targetCourseCode of rule.targetCourseCodes ?? []) {
    const normalizedTargetCourseCode = normalizeCourseCode(targetCourseCode);
    const existingRules = GUIDE_RULES_BY_TARGET_COURSE_CODE.get(normalizedTargetCourseCode) ?? [];
    existingRules.push(rule);
    GUIDE_RULES_BY_TARGET_COURSE_CODE.set(normalizedTargetCourseCode, existingRules);
  }
}

const SOURCE_BACKED_CLASSIFICATIONS_BY_SCOPE_AND_SOURCE_COURSE = new Map<
  string,
  TransferPlannerRequirementDiffClassificationEntry[]
>();
const SOURCE_BACKED_CLASSIFICATIONS_BY_PROMOTED_REQUIREMENT_ATOM_ID = new Map<
  string,
  TransferPlannerRequirementDiffClassificationEntry[]
>();
for (const classification of TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY) {
  const scopeKey = makePathwayPlanKey(classification.planId, classification.pathwayId);
  const normalizedSourceCourseCode = normalizeCourseCode(classification.sourceUwCourseCode);
  const promotedRequirementAtomOverrideId = classification.promotedRequirementAtomOverrideId;
  if (promotedRequirementAtomOverrideId) {
    const existingEntries =
      SOURCE_BACKED_CLASSIFICATIONS_BY_PROMOTED_REQUIREMENT_ATOM_ID.get(
        promotedRequirementAtomOverrideId
      ) ?? [];
    existingEntries.push(classification);
    SOURCE_BACKED_CLASSIFICATIONS_BY_PROMOTED_REQUIREMENT_ATOM_ID.set(
      promotedRequirementAtomOverrideId,
      existingEntries
    );
  }

  if (!normalizedSourceCourseCode) continue;

  const entryKey = buildSourceBackedScopeCourseKey(scopeKey, normalizedSourceCourseCode);
  const existingEntries =
    SOURCE_BACKED_CLASSIFICATIONS_BY_SCOPE_AND_SOURCE_COURSE.get(entryKey) ?? [];
  existingEntries.push(classification);
  SOURCE_BACKED_CLASSIFICATIONS_BY_SCOPE_AND_SOURCE_COURSE.set(entryKey, existingEntries);
}

const SOURCE_BACKED_GUIDE_COURSES_BY_KEY = new Map<PathwayPlanKey, string[]>();
for (const parsedSource of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY) {
  if (!canParsedRequirementSourceBlockCreateRequiredScheduleRows(parsedSource)) {
    continue;
  }

  const scopeKey = makePathwayPlanKey(parsedSource.planId, parsedSource.pathwayId);
  const sourceBackedGuideCourseCodes = new Set(
    SOURCE_BACKED_GUIDE_COURSES_BY_KEY.get(scopeKey) ?? []
  );
  const parsedCourseCodes = uniquePlannerStrings(
    (parsedSource.parsedUwCourseCodes ?? []).map((courseCode) => normalizeCourseCode(courseCode))
  );
  const parsedCourseCodeSet = new Set(parsedCourseCodes);
  const parsedCandidatesByCode = new Map<string, TransferPlannerParsedRequirementAtomCandidate[]>();
  for (const candidate of parsedSource.parsedRequirementAtomCandidates ?? []) {
    const normalizedCandidateCode = normalizeCourseCode(candidate.uwCourseCode);
    if (!normalizedCandidateCode) continue;

    const existingCandidates = parsedCandidatesByCode.get(normalizedCandidateCode) ?? [];
    existingCandidates.push(candidate);
    parsedCandidatesByCode.set(normalizedCandidateCode, existingCandidates);
  }

  for (const parsedCourseCode of parsedCourseCodes) {
    if (!isLowerDivisionSourceBackedFallbackCode(parsedCourseCode)) {
      continue;
    }

    const matchingClassifications =
      SOURCE_BACKED_CLASSIFICATIONS_BY_SCOPE_AND_SOURCE_COURSE.get(
        buildSourceBackedScopeCourseKey(scopeKey, parsedCourseCode)
      ) ?? [];
    if (
      matchingClassifications.some((entry) =>
        hasUnsafeSourceBackedValidationNote(entry.validationNotes)
      )
    ) {
      continue;
    }

    const requirementCueLines = uniquePlannerStrings([
      ...(parsedCandidatesByCode.get(parsedCourseCode) ?? []).flatMap(
        (candidate) => candidate.sourceLineHints ?? []
      ),
      ...matchingClassifications.flatMap((entry) => getRequirementCueLinesFromClassification(entry)),
    ]);
    if (
      !hasStudentFacingSourceBackedRequirementCue({
        ownerTitle: parsedSource.ownerTitle,
        sourceCourseCode: parsedCourseCode,
        requirementCueLines,
        allCandidateCodes: parsedCourseCodeSet,
      })
    ) {
      continue;
    }

    const candidateRules = [
      ...(GUIDE_RULES_BY_TARGET_COURSE_CODE.get(parsedCourseCode) ?? []),
    ]
      .filter((rule) =>
        canUseGuideRuleForSourceBackedRequirement(
          rule,
          parsedCourseCode,
          parsedCourseCodeSet
        )
      )
      .sort(compareGuideRules);
    const topRule = candidateRules[0];
    if (!topRule) continue;

    for (const sourceCourseSet of topRule.sourceCourseSets ?? []) {
      for (const courseCode of sourceCourseSet ?? []) {
        sourceBackedGuideCourseCodes.add(normalizeCourseCode(courseCode));
      }
    }
  }

  SOURCE_BACKED_GUIDE_COURSES_BY_KEY.set(
    scopeKey,
    uniquePlannerStrings([...sourceBackedGuideCourseCodes])
  );
}

function getParsedRequirementAtomGuideCourseCodesForScope(
  planId: string,
  pathwayId?: string | null
) {
  const parsedBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.filter(
    (block) =>
      block.planId === planId &&
      (pathwayId ? block.pathwayId === pathwayId : !block.pathwayId) &&
      canParsedRequirementSourceBlockCreateRequiredScheduleRows(block)
  );
  const guideCourseCodes = new Set<string>();

  for (const block of parsedBlocks) {
    const parsedCourseCodes = uniquePlannerStrings(
      (block.parsedUwCourseCodes ?? [])
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean)
    );
    const parsedCourseCodeSet = new Set(parsedCourseCodes);
    const candidatesByCode = new Map<string, TransferPlannerParsedRequirementAtomCandidate[]>();

    for (const candidate of block.parsedRequirementAtomCandidates ?? []) {
      const normalizedCandidateCode = normalizeCourseCode(candidate.uwCourseCode);
      if (!normalizedCandidateCode || candidate.sourceSectionSchedulable === false) {
        continue;
      }

      const existingCandidates = candidatesByCode.get(normalizedCandidateCode) ?? [];
      existingCandidates.push(candidate);
      candidatesByCode.set(normalizedCandidateCode, existingCandidates);
    }

    for (const parsedCourseCode of parsedCourseCodes) {
      if (!isLowerDivisionSourceBackedFallbackCode(parsedCourseCode)) {
        continue;
      }

      const parsedCandidates = candidatesByCode.get(parsedCourseCode) ?? [];
      if (!parsedCandidates.length) {
        continue;
      }

      const requirementCueLines = uniquePlannerStrings(
        parsedCandidates.flatMap((candidate) => candidate.sourceLineHints ?? [])
      );
      if (
        !hasStudentFacingSourceBackedRequirementCue({
          ownerTitle: block.ownerTitle,
          sourceCourseCode: parsedCourseCode,
          requirementCueLines,
          allCandidateCodes: parsedCourseCodeSet,
        })
      ) {
        continue;
      }

      const candidateRules = [
        ...(GUIDE_RULES_BY_TARGET_COURSE_CODE.get(parsedCourseCode) ?? []),
      ]
        .filter((rule) =>
          canUseGuideRuleForSourceBackedRequirement(
            rule,
            parsedCourseCode,
            parsedCourseCodeSet
          )
        )
        .sort(compareGuideRules);
      const topRule = candidateRules[0];
      if (!topRule) {
        continue;
      }

      for (const sourceCourseSet of topRule.sourceCourseSets ?? []) {
        for (const courseCode of sourceCourseSet ?? []) {
          guideCourseCodes.add(normalizeCourseCode(courseCode));
        }
      }
    }
  }

  return uniquePlannerStrings([...guideCourseCodes]);
}

const SOURCE_BACKED_CLASSIFICATION_COURSES_BY_KEY = new Map<PathwayPlanKey, string[]>();
for (const classification of TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY) {
  if (!shouldIncludeStudentFacingSourceBackedClassification(classification)) {
    continue;
  }

  const scopeKey = makePathwayPlanKey(classification.planId, classification.pathwayId);
  const sourceBackedClassificationCourseCodes = new Set(
    SOURCE_BACKED_CLASSIFICATION_COURSES_BY_KEY.get(scopeKey) ?? []
  );

  for (const courseCode of classification.grcCourseCodes ?? []) {
    sourceBackedClassificationCourseCodes.add(normalizeCourseCode(courseCode));
  }

  for (const alternativeCourseCodeSet of classification.alternativeCourseCodeSets ?? []) {
    for (const courseCode of alternativeCourseCodeSet ?? []) {
      sourceBackedClassificationCourseCodes.add(normalizeCourseCode(courseCode));
    }
  }

  SOURCE_BACKED_CLASSIFICATION_COURSES_BY_KEY.set(
    scopeKey,
    uniquePlannerStrings([...sourceBackedClassificationCourseCodes])
  );
}

function shouldIncludeTrackMatchSourceBackedClassification(
  classification: TransferPlannerRequirementDiffClassificationEntry
) {
  if (!isPresentDayGuideRuleId(classification.guideRuleId)) {
    return false;
  }

  if (shouldIncludeStudentFacingSourceBackedClassification(classification)) {
    return true;
  }

  const hasCourseCoverage = Boolean(
    (classification.grcCourseCodes ?? []).length ||
      (classification.alternativeCourseCodeSets ?? []).some((group) => (group ?? []).length)
  );
  if (!hasCourseCoverage) {
    return false;
  }

  if (
    hasUnsafeSourceBackedValidationNote(classification.validationNotes) &&
    !hasTrackMatchSafeSourceBackedSkipReason(classification.validationNotes)
  ) {
    return false;
  }

  return Boolean(classification.guideRuleId) && classification.mappingConfidence === "high";
}

function getReferenceCourseSubjectPrefix(courseCode: string) {
  return normalizeCourseCode(courseCode).replace(/\s+\d{3}(?:\.\d+)?[A-Z]?$/, "").trim();
}

function buildSiblingChoiceSourceBackedRecoveryCourseList(
  planId: string,
  pathwayId?: string | null
) {
  const recoveredCoursesByGroupKey = new Map<
    string,
    {
      cueLine: string;
      subjectPrefix: string;
      courseCodes: Set<string>;
    }
  >();

  for (const classification of getRequirementDiffClassificationsForScope(planId, pathwayId)) {
    if (classification.classificationKind !== "auto-promoted-guide-direct-equivalent") {
      continue;
    }
    if (!classification.guideRuleId) {
      continue;
    }
    if (!isPresentDayGuideRuleId(classification.guideRuleId)) {
      continue;
    }
    if (!hasOnlySiblingOptionSourceBackedSkipReason(classification.validationNotes)) {
      continue;
    }

    const classificationCourseCodes = uniqueReferenceCourseLabels([
      ...(classification.grcCourseCodes ?? []),
      ...((classification.alternativeCourseCodeSets ?? []).flat()),
    ]);
    if (!classificationCourseCodes.length) {
      continue;
    }

    const cueLines = getRequirementCueLinesFromClassification(classification);
    if (!cueLines.length) {
      continue;
    }

    for (const courseCode of classificationCourseCodes) {
      const normalizedCourseCode = normalizeCourseCode(courseCode);
      const subjectPrefix = getReferenceCourseSubjectPrefix(normalizedCourseCode);
      if (!normalizedCourseCode || !subjectPrefix) {
        continue;
      }

      for (const cueLine of cueLines) {
        const normalizedCueLine = String(cueLine ?? "").trim().toLowerCase();
        if (!normalizedCueLine) {
          continue;
        }

        const groupKey = `${normalizedCueLine}|${subjectPrefix}`;
        const groupEntry =
          recoveredCoursesByGroupKey.get(groupKey) ?? {
            cueLine: normalizedCueLine,
            subjectPrefix,
            courseCodes: new Set<string>(),
          };
        groupEntry.courseCodes.add(normalizedCourseCode);
        recoveredCoursesByGroupKey.set(groupKey, groupEntry);
      }
    }
  }

  const recoveredCourseOrder = [...recoveredCoursesByGroupKey.values()]
    .filter((groupEntry) => groupEntry.courseCodes.size >= MIN_SOURCE_BACKED_SIBLING_CHOICE_RECOVERY_COUNT)
    .sort((left, right) => {
      const sizeDelta = right.courseCodes.size - left.courseCodes.size;
      if (sizeDelta !== 0) {
        return sizeDelta;
      }
      if (left.subjectPrefix !== right.subjectPrefix) {
        return left.subjectPrefix.localeCompare(right.subjectPrefix);
      }
      return left.cueLine.localeCompare(right.cueLine);
    })
    .flatMap((groupEntry) =>
      orderStringsByBase(uniquePlannerStrings([...groupEntry.courseCodes]), [])
    );

  return uniqueReferenceCourseLabels(recoveredCourseOrder);
}

function applySiblingChoiceSourceBackedRecovery(
  courseList: string[],
  planId: string,
  pathwayId?: string | null
) {
  const normalizedCourseList = uniqueReferenceCourseLabels(courseList);
  if (normalizedCourseList.length > 0) {
    return normalizedCourseList;
  }

  return buildSiblingChoiceSourceBackedRecoveryCourseList(planId, pathwayId);
}

function shouldSkipDegreeMapGuideCourseForNonRequirementCue(
  block: TransferPlannerDegreeMapBlock,
  uwCourseCode: string
) {
  const normalizedUwCourseCode = normalizeCourseCode(uwCourseCode);
  if (!normalizedUwCourseCode) {
    return true;
  }

  const candidateLines = uniquePlannerStrings([
    ...(block.itemLabels ?? []),
    ...getRequirementCueLinesFromValidationNotes(block.validationNotes),
  ]);

  return candidateLines.some((line) => {
    const text = String(line ?? "");
    if (
      !SOURCE_BACKED_NON_REQUIREMENT_CUE_PATTERN.test(text) &&
      !/\bincluding\b.{0,120}\bor\b/i.test(text)
    ) {
      return false;
    }

    const referenceCourseCodes = extractReferenceCourseCodes(line);
    if (referenceCourseCodes.includes(normalizedUwCourseCode)) {
      return true;
    }

    const courseNumber = getCourseCatalogNumber(normalizedUwCourseCode);
    const coursePrefix = getSourceBackedFallbackCoursePrefix(normalizedUwCourseCode);
    return Boolean(
      courseNumber &&
        coursePrefix &&
        new RegExp(`\\b${courseNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text) &&
        referenceCourseCodes.some(
          (referenceCourseCode) =>
            getSourceBackedFallbackCoursePrefix(referenceCourseCode) === coursePrefix
        )
    );
  });
}

const SOURCE_BACKED_TRACK_MATCH_COURSES_BY_KEY = new Map<PathwayPlanKey, string[]>();
for (const classification of TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY) {
  if (!shouldIncludeTrackMatchSourceBackedClassification(classification)) {
    continue;
  }

  const scopeKey = makePathwayPlanKey(classification.planId, classification.pathwayId);
  const sourceBackedTrackMatchCourseCodes = new Set(
    SOURCE_BACKED_TRACK_MATCH_COURSES_BY_KEY.get(scopeKey) ?? []
  );

  for (const courseCode of classification.grcCourseCodes ?? []) {
    sourceBackedTrackMatchCourseCodes.add(normalizeCourseCode(courseCode));
  }

  for (const alternativeCourseCodeSet of classification.alternativeCourseCodeSets ?? []) {
    for (const courseCode of alternativeCourseCodeSet ?? []) {
      sourceBackedTrackMatchCourseCodes.add(normalizeCourseCode(courseCode));
    }
  }

  SOURCE_BACKED_TRACK_MATCH_COURSES_BY_KEY.set(
    scopeKey,
    uniquePlannerStrings([...sourceBackedTrackMatchCourseCodes])
  );
}

const DEGREE_MAP_GUIDE_COURSES_BY_KEY = new Map<PathwayPlanKey, string[]>();
for (const block of TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY) {
  if (DEGREE_MAP_GUIDE_BLOCK_TITLE_EXCLUSION_PATTERN.test(String(block.title ?? ""))) {
    continue;
  }

  const scopeKey = makePathwayPlanKey(block.planId, block.pathwayId);
  const degreeMapGuideCourseCodes = new Set(DEGREE_MAP_GUIDE_COURSES_BY_KEY.get(scopeKey) ?? []);

  for (const uwCourseCode of block.uwCourseCodes ?? []) {
    const normalizedUwCourseCode = normalizeCourseCode(uwCourseCode);
    if (shouldSkipDegreeMapGuideCourseForNonRequirementCue(block, normalizedUwCourseCode)) {
      continue;
    }

    const blockCourseCodeSet = new Set(
      (block.uwCourseCodes ?? []).map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
    );
    const topRule = [
      ...(GUIDE_RULES_BY_TARGET_COURSE_CODE.get(normalizedUwCourseCode) ?? []),
    ]
      .filter((rule) =>
        canUseGuideRuleForSourceBackedRequirement(
          rule,
          normalizedUwCourseCode,
          blockCourseCodeSet
        )
      )
      .sort(compareGuideRules)[0];
    if (!topRule) {
      continue;
    }

    const topRuleSourceCourseCodes = uniquePlannerStrings(
      (topRule.sourceCourseSets ?? []).flat().map((courseCode) => normalizeCourseCode(courseCode))
    );
    if (
      !topRuleSourceCourseCodes.length ||
      !topRuleSourceCourseCodes.every((courseCode) =>
        isLowerDivisionSourceBackedFallbackCode(courseCode)
      )
    ) {
      continue;
    }

    for (const sourceCourseSet of topRule.sourceCourseSets ?? []) {
      for (const courseCode of sourceCourseSet ?? []) {
        degreeMapGuideCourseCodes.add(normalizeCourseCode(courseCode));
      }
    }
  }

  DEGREE_MAP_GUIDE_COURSES_BY_KEY.set(
    scopeKey,
    uniquePlannerStrings([...degreeMapGuideCourseCodes])
  );
}

function sanitizePlannerOwnedText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sanitizePlannerOwnedStrings(values: string[] | null | undefined) {
  return uniquePlannerStrings((values ?? []).map((value) => sanitizePlannerOwnedText(value)).filter(Boolean));
}

function sanitizeChecklistItemNote(note: string | null | undefined) {
  const sanitized = sanitizePlannerOwnedText(note);
  return sanitized || undefined;
}

function sanitizeChecklistItem(item: TransferPlannerChecklistItem): TransferPlannerChecklistItem {
  return {
    ...item,
    title: sanitizePlannerOwnedText(item.title),
    grcCourses: [...item.grcCourses],
    alternatives: item.alternatives?.map((group) => [...group]),
    note: sanitizeChecklistItemNote(item.note),
  };
}

function sanitizeDegreeMapSection(section: TransferPlannerDegreeMapSection): TransferPlannerDegreeMapSection {
  return {
    ...section,
    title: sanitizePlannerOwnedText(section.title),
    items: section.items.map((item) => sanitizePlannerOwnedText(item)).filter(Boolean),
    note: sanitizePlannerOwnedText(section.note),
  };
}

function uniquePlannerLinks(values: TransferPlannerLink[]) {
  const seen = new Set<string>();
  const uniqueValues: TransferPlannerLink[] = [];

  for (const value of values) {
    const key = `${String(value.url ?? "").trim()}|${String(value.label ?? "").trim()}|${String(
      value.note ?? ""
    ).trim()}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueValues.push(value);
  }

  return uniqueValues;
}

function uniqueReferenceCourseLabels(items: string[]) {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const item of items) {
    const normalized = normalizeCourseCode(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    labels.push(normalized);
  }

  return labels;
}

function extractReferenceCourseCodes(value: string) {
  return uniqueReferenceCourseLabels(
    (String(value ?? "").toUpperCase().match(REFERENCE_COURSE_CODE_PATTERN) ?? []).map((match) =>
      match.replace(/\s+/g, " ").trim()
    )
  );
}

function getChecklistReferenceCoursesFromItems(items: TransferPlannerChecklistItem[]) {
  return uniqueReferenceCourseLabels(
    items.flatMap((item) => [item.grcCourses, ...(item.alternatives ?? [])].flat())
  );
}

function normalizeChecklistItems(items: TransferPlannerChecklistItem[] | undefined) {
  return items ?? [];
}

function getChecklistReferenceCourses(plan: TransferPlannerMajorPlan) {
  return getChecklistReferenceCoursesFromItems([
    ...normalizeChecklistItems(plan.applicationChecklist),
    ...normalizeChecklistItems(plan.beforeEnrollmentChecklist),
    ...normalizeChecklistItems(plan.stayAtGrcChecklist),
  ]);
}

function orderByBaseIds<T extends { id: string }>(entries: T[], baseIds: string[]) {
  const order = new Map(baseIds.map((id, index) => [id, index] as const));
  return [...entries].sort((left, right) => {
    const leftOrder = order.get(left.id);
    const rightOrder = order.get(right.id);

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder;
    }
    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;
    return left.id.localeCompare(right.id);
  });
}

function orderStringsByBase(values: string[], baseValues: string[]) {
  const order = new Map(baseValues.map((value, index) => [normalizeCourseCode(value), index] as const));
  return [...values].sort((left, right) => {
    const leftOrder = order.get(normalizeCourseCode(left));
    const rightOrder = order.get(normalizeCourseCode(right));

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder;
    }
    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;
    return left.localeCompare(right);
  });
}

function orderLinksByBase(links: TransferPlannerLink[], baseLinks: TransferPlannerLink[]) {
  const order = new Map(baseLinks.map((link, index) => [link.url, index] as const));
  return [...links].sort((left, right) => {
    const leftOrder = order.get(left.url);
    const rightOrder = order.get(right.url);

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder;
    }
    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;
    return left.label.localeCompare(right.label) || left.url.localeCompare(right.url);
  });
}

function extractLeafId(id: string) {
  return String(id ?? "").split(":").pop() ?? id;
}

type ChecklistSourceMetadata = Pick<
  TransferPlannerChecklistItem,
  | "sourceUrl"
  | "sourceRole"
  | "sourceScope"
  | "sourceSection"
  | "pathwayId"
  | "routeId"
  | "generatedFromParser"
  | "manualOverride"
  | "canCreateScheduleRow"
  | "requirementShape"
  | "reason"
>;

type ChecklistItemSource = Pick<
  TransferPlannerMajorRequirementAtom,
  "id" | "title" | "grcCourseCodes" | "alternativeCourseCodeSets" | "note"
> &
  Partial<Pick<TransferPlannerMajorRequirementAtom, "planId" | "pathwayId" | "sourceLinks">> & {
  minCompletedCount?: number | null;
  sourceUrl?: string | null;
  sourceRole?: string | null;
  sourceScope?: string | null;
  sourceSection?: string | null;
  generatedFromParser?: boolean;
  manualOverride?: boolean;
  canCreateScheduleRow?: boolean;
  requirementShape?: TransferPlannerRequirementStructuralShape | null;
  reason?: string | null;
};

const SCHEDULABLE_GENERATED_SOURCE_ROLES = new Set([
  "degree-requirements",
  "catalog",
  "curriculum",
  "worksheet",
  "official-catalog",
  "primary-degree-requirements",
  "department-requirements",
  "pathway-degree-sheet",
]);

const NON_SCHEDULABLE_GENERATED_SOURCE_ROLES = new Set([
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
]);

function getFirstSourceUrl(links: TransferPlannerSourceLink[] | null | undefined) {
  return sanitizePlannerOwnedText((links ?? []).find((link) => link.url)?.url) || null;
}

function canGeneratedSourceRoleCreateScheduleRow(role: string | null | undefined) {
  const normalizedRole = String(role ?? "").trim();
  if (!normalizedRole) {
    return false;
  }
  return (
    SCHEDULABLE_GENERATED_SOURCE_ROLES.has(normalizedRole) &&
    !NON_SCHEDULABLE_GENERATED_SOURCE_ROLES.has(normalizedRole)
  );
}

function getRequirementStructuralShape(
  input: {
    requirementType?: TransferPlannerRequirementType | string | null;
    supportOnly?: boolean | null;
    sourceRole?: string | null;
    sourceSectionSchedulable?: boolean | null;
    options?: TransferPlannerRequirementOption[] | null;
    sequencePaths?: TransferPlannerRequirementGroup["sequencePaths"];
  }
): TransferPlannerRequirementStructuralShape {
  const sourceRole = String(input.sourceRole ?? "");
  if (sourceRole === "elective-list" || input.requirementType === "elective_list") {
    return "elective-list";
  }
  if (input.requirementType === "approved_filter_list") {
    return "approved-filter-list";
  }
  if (sourceRole === "approved-course-list" || input.requirementType === "approved_course_list") {
    return "approved-course-list";
  }
  if (
    input.supportOnly === true ||
    sourceRole === "support-source"
  ) {
    return "hidden-informational-row";
  }
  if (
    input.sourceSectionSchedulable === false ||
    input.requirementType === "hidden_informational"
  ) {
    return "hidden-informational-row";
  }
  if (input.requirementType === "choose_credits") {
    return "credit-bucket";
  }
  if (input.requirementType === "sequence_choice") {
    return "sequence-choice";
  }
  if (
    (input.options ?? []).some((option) => option.optionKind === "category-option" || option.categoryOption)
  ) {
    return "category-option";
  }
  if (input.requirementType === "choose_one" || input.requirementType === "choose_n") {
    return "option-group";
  }
  return "required-row";
}

function isNonSchedulableSupportRequirementShape(
  requirementShape: TransferPlannerRequirementStructuralShape | null | undefined
) {
  return [
    "approved-course-list",
    "approved-filter-list",
    "elective-list",
    "hidden-informational-row",
  ].includes(String(requirementShape ?? ""));
}

function getPrimaryGeneratedSourceMetadata(
  planId: string,
  pathwayId?: string | null
): ChecklistSourceMetadata {
  const primarySource =
    getTransferPlannerPrimaryDegreeRequirementsSource(planId, pathwayId ?? null) ??
    getTransferPlannerPrimaryDegreeRequirementsSource(planId, null);
  const sourceRole = primarySource?.role ?? null;
  const canCreateScheduleRow =
    primarySource?.isPrimaryDegreeRequirementsLink === true &&
    canGeneratedSourceRoleCreateScheduleRow(sourceRole);

  return {
    sourceUrl: primarySource?.url ?? null,
    sourceRole,
    sourceScope: canCreateScheduleRow ? "primary-schedulable" : "unscoped",
    sourceSection: null,
    pathwayId: pathwayId ?? null,
    routeId: pathwayId ?? null,
    generatedFromParser: false,
    manualOverride: false,
    canCreateScheduleRow,
    requirementShape: canCreateScheduleRow ? "required-row" : "hidden-informational-row",
    reason: canCreateScheduleRow
      ? "Generated row is backed by the selected primary degree-requirements source."
      : "Generated row has no schedulable primary source backing.",
  };
}

function getRequirementGroupChecklistSourceMetadata(
  group: TransferPlannerRequirementGroup
): ChecklistSourceMetadata {
  const sourceRole = group.sourceRole ?? null;
  const supportOnly = group.supportOnly === true;
  const requirementShape =
    group.requirementShape ??
    getRequirementStructuralShape({
      requirementType: group.requirementType,
      supportOnly,
      sourceRole,
      sourceSectionSchedulable: group.sourceSectionSchedulable,
      options: group.options,
      sequencePaths: group.sequencePaths,
    });
  const canCreateScheduleRow =
    !supportOnly &&
    group.sourceSectionSchedulable !== false &&
    !isNonSchedulableSupportRequirementShape(requirementShape) &&
    !NON_SCHEDULABLE_GENERATED_SOURCE_ROLES.has(String(sourceRole ?? ""));

  return {
    sourceUrl: group.sourceUrl ?? null,
    sourceRole,
    sourceScope: supportOnly
      ? "support-only"
      : group.sourceScope
        ? group.sourceScope
      : canCreateScheduleRow
        ? "primary-schedulable"
        : "non-schedulable",
    sourceSection: group.sourceSection ?? group.sourceHeading ?? null,
    pathwayId: group.pathwayId ?? null,
    routeId: group.routeId ?? group.pathwayId ?? null,
    generatedFromParser: true,
    manualOverride: false,
    canCreateScheduleRow: group.canCreateScheduleRow ?? canCreateScheduleRow,
    requirementShape,
    reason: canCreateScheduleRow
      ? "Parser requirement group emitted from a scoped schedulable source section."
      : "Parser requirement group is not allowed to create scheduled rows from this source scope.",
  };
}

function getChecklistSourceMetadata(
  atom: ChecklistItemSource,
  fallback?: ChecklistSourceMetadata
): ChecklistSourceMetadata {
  const sourceRole = atom.sourceRole ?? fallback?.sourceRole ?? "primary-degree-requirements";
  const canCreateScheduleRow =
    atom.canCreateScheduleRow ??
    fallback?.canCreateScheduleRow ??
    canGeneratedSourceRoleCreateScheduleRow(sourceRole);

  return {
    sourceUrl:
      atom.sourceUrl ??
      getFirstSourceUrl(atom.sourceLinks) ??
      fallback?.sourceUrl ??
      null,
    sourceRole,
    sourceScope:
      atom.sourceScope ??
      fallback?.sourceScope ??
      (canCreateScheduleRow ? "primary-schedulable" : "non-schedulable"),
    sourceSection: atom.sourceSection ?? fallback?.sourceSection ?? null,
    pathwayId: atom.pathwayId ?? fallback?.pathwayId ?? null,
    routeId: atom.pathwayId ?? fallback?.routeId ?? fallback?.pathwayId ?? null,
    generatedFromParser: atom.generatedFromParser ?? fallback?.generatedFromParser ?? true,
    manualOverride: atom.manualOverride ?? fallback?.manualOverride ?? false,
    canCreateScheduleRow,
    requirementShape:
      atom.requirementShape ??
      fallback?.requirementShape ??
      (canCreateScheduleRow ? "required-row" : "hidden-informational-row"),
    reason:
      atom.reason ??
      fallback?.reason ??
      (canCreateScheduleRow
        ? "Generated from parser-backed scoped requirement atoms."
        : "Generated item is not allowed to create scheduled rows from this source scope."),
  };
}

function buildChecklistItemSignature(item: Pick<
  TransferPlannerChecklistItem,
  "title" | "grcCourses" | "alternatives" | "minCompletedCount"
>) {
  return JSON.stringify({
    title: sanitizePlannerOwnedText(item.title),
    grcCourses: item.grcCourses.map((code) => normalizeCourseCode(code)),
    alternatives: (item.alternatives ?? []).map((group) =>
      group.map((code) => normalizeCourseCode(code))
    ),
    minCompletedCount: item.minCompletedCount ?? null,
  });
}

const CANONICAL_GRC_COURSE_BY_CODE = new Map(
  TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter((entry) => entry.schoolId === "grc").map(
    (entry) => [normalizeCourseCode(entry.code), entry] as const
  )
);
const CANONICAL_COURSE_BY_SCOPE_AND_CODE = new Map<string, (typeof TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY)[number]>(
  TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.map((entry) => [
    `${entry.schoolId}|${normalizeCourseCode(entry.code)}`,
    entry,
  ] as const)
);
const GRC_PREREQUISITE_CLOSURE_CACHE = new Map<string, Set<string>>();

function isCanonicalGrcCourseLabel(label: string) {
  const courseCodes = extractReferenceCourseCodes(label);
  return (
    courseCodes.length > 0 &&
    courseCodes.every((courseCode) =>
      CANONICAL_GRC_COURSE_BY_CODE.has(normalizeCourseCode(courseCode))
    )
  );
}

function filterCanonicalGrcCourseLabels(labels: string[]) {
  return uniqueReferenceCourseLabels(labels).filter(isCanonicalGrcCourseLabel);
}

function getTransitiveGrcDependencyCourseCodes(courseCode: string) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const cached = GRC_PREREQUISITE_CLOSURE_CACHE.get(normalizedCourseCode);
  if (cached) {
    return cached;
  }

  const dependencyCodes = new Set<string>();
  const pending = [normalizedCourseCode];
  const visited = new Set<string>();

  while (pending.length) {
    const currentCode = pending.pop();
    if (!currentCode || visited.has(currentCode)) {
      continue;
    }
    visited.add(currentCode);

    const entry = CANONICAL_GRC_COURSE_BY_CODE.get(currentCode);
    if (!entry) {
      continue;
    }

    const nextCodes = uniquePlannerStrings([
      ...(entry.prerequisiteCourseCodes ?? []),
      ...(entry.prerequisiteAlternativeCourseCodeSets ?? []).flat(),
      ...(entry.corequisiteCourseCodes ?? []),
      ...(entry.corequisiteAlternativeCourseCodeSets ?? []).flat(),
    ].map((code) => normalizeCourseCode(code)));

    for (const nextCode of nextCodes) {
      if (nextCode === normalizedCourseCode || dependencyCodes.has(nextCode)) {
        continue;
      }
      dependencyCodes.add(nextCode);
      pending.push(nextCode);
    }
  }

  GRC_PREREQUISITE_CLOSURE_CACHE.set(normalizedCourseCode, dependencyCodes);
  return dependencyCodes;
}

function pruneRuntimeChecklistCourseGroup(group: string[], supportedCourseCodes: Set<string>) {
  const normalizedGroup = uniqueReferenceCourseLabels(group);
  const directlySupportedCodes = normalizedGroup.filter((code) =>
    supportedCourseCodes.has(normalizeCourseCode(code))
  );

  if (!directlySupportedCodes.length) {
    return [] as string[];
  }

  const keptCodes = new Set(directlySupportedCodes.map((code) => normalizeCourseCode(code)));
  let changed = true;

  while (changed) {
    changed = false;
    for (const code of normalizedGroup) {
      const normalizedCode = normalizeCourseCode(code);
      if (keptCodes.has(normalizedCode)) {
        continue;
      }

      const isDependencyOfKeptCode = [...keptCodes].some((keptCode) =>
        getTransitiveGrcDependencyCourseCodes(keptCode).has(normalizedCode)
      );

      if (isDependencyOfKeptCode) {
        keptCodes.add(normalizedCode);
        changed = true;
      }
    }
  }

  return normalizedGroup.filter((code) => keptCodes.has(normalizeCourseCode(code)));
}

function buildSourceValidatedRuntimeChecklistItem(
  atom: ChecklistItemSource,
  supportedCourseCodes: Set<string>
) {
  const primaryCourses = pruneRuntimeChecklistCourseGroup(atom.grcCourseCodes, supportedCourseCodes);
  const alternativeGroups = (atom.alternativeCourseCodeSets ?? [])
    .map((group) => pruneRuntimeChecklistCourseGroup(group, supportedCourseCodes))
    .filter((group) => group.length > 0);

  const grcCourses = primaryCourses.length
    ? primaryCourses
    : alternativeGroups.shift() ?? [];

  if (!grcCourses.length && !alternativeGroups.length) {
    return null;
  }

  return sanitizeChecklistItem({
    id: extractLeafId(atom.id),
    title: atom.title,
    grcCourses,
    alternatives: alternativeGroups.length ? alternativeGroups : undefined,
    note: atom.note,
    minCompletedCount: atom.minCompletedCount ?? undefined,
    ...getChecklistSourceMetadata(atom),
  });
}

function getChecklistCoverageCourseCodes(items: TransferPlannerChecklistItem[]) {
  return uniqueReferenceCourseLabels(
    items.flatMap((item) => [item.grcCourses, ...(item.alternatives ?? [])].flat())
  ).map((code) => normalizeCourseCode(code));
}

function pruneRedundantRuntimeChecklistItems(
  items: TransferPlannerChecklistItem[],
  coveredCourseCodes: Iterable<string>
) {
  const coverage = new Set(
    [...coveredCourseCodes].map((code) => normalizeCourseCode(code)).filter(Boolean)
  );
  const prunedItems: TransferPlannerChecklistItem[] = [];

  for (const item of items) {
    const itemCourseCodes = getChecklistCoverageCourseCodes([item]);

    if (itemCourseCodes.length && itemCourseCodes.every((code) => coverage.has(code))) {
      continue;
    }

    prunedItems.push(item);
    for (const courseCode of itemCourseCodes) {
      coverage.add(courseCode);
    }
  }

  return prunedItems;
}

function getRuntimeRequirementAtoms(planId: string, pathwayId?: string | null) {
  return uniqueById([
    ...(REQUIREMENTS_BY_KEY.get(makePathwayPlanKey(planId, null)) ?? []),
    ...(pathwayId ? REQUIREMENTS_BY_KEY.get(makePathwayPlanKey(planId, pathwayId)) ?? [] : []),
  ]);
}

function buildChecklistItem(atom: ChecklistItemSource): TransferPlannerChecklistItem {
  return sanitizeChecklistItem({
    id: extractLeafId(atom.id),
    title: atom.title,
    grcCourses: [...atom.grcCourseCodes],
    alternatives: (atom.alternativeCourseCodeSets ?? []).length
      ? atom.alternativeCourseCodeSets.map((group) => [...group])
      : undefined,
    note: atom.note,
    minCompletedCount: atom.minCompletedCount ?? undefined,
    ...getChecklistSourceMetadata(atom),
  });
}

function hasAnyChecklistItems(scope: {
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
}) {
  return Boolean(
    (scope.applicationChecklist?.length ?? 0) > 0 ||
      (scope.beforeEnrollmentChecklist?.length ?? 0) > 0 ||
      (scope.stayAtGrcChecklist?.length ?? 0) > 0
  );
}

function buildAutoChecklistItemId(label: string, index: number) {
  const normalized = String(label ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `auto-${normalized || `prep-${index + 1}`}`;
}

type SourceBackedFallbackChecklistsByPhase = {
  beforeApplication: TransferPlannerChecklistItem[];
  beforeEnrollment: TransferPlannerChecklistItem[];
  stayAtGrc: TransferPlannerChecklistItem[];
};

function buildEmptySourceBackedFallbackChecklists(): SourceBackedFallbackChecklistsByPhase {
  return {
    beforeApplication: [],
    beforeEnrollment: [],
    stayAtGrc: [],
  };
}

function getRequirementDiffClassificationsForScope(planId: string, pathwayId?: string | null) {
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

function getParsedRequirementAtomCandidatesForScope(planId: string, pathwayId?: string | null) {
  return TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.filter(
    (entry) =>
      entry.planId === planId &&
      (pathwayId === undefined
        ? true
        : pathwayId === null
          ? !entry.pathwayId
          : entry.pathwayId === pathwayId) &&
      canParsedRequirementSourceBlockCreateRequiredScheduleRows(entry)
  ).flatMap((entry) => entry.parsedRequirementAtomCandidates);
}

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

  if (
    [
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
    ].includes(String(block.sourceRole ?? ""))
  ) {
    return false;
  }

  return true;
}

function getRequirementCueLinesFromClassification(
  entry: TransferPlannerRequirementDiffClassificationEntry
) {
  return getRequirementCueLinesFromValidationNotes(entry.validationNotes);
}

function getRequirementCueLinesFromValidationNotes(notes: string[] | null | undefined) {
  return (notes ?? [])
    .filter((note) => note.startsWith("Requirement cue lines:"))
    .map((note) => note.replace(/^Requirement cue lines:\s*/i, "").trim())
    .filter(Boolean);
}

function buildSourceBackedScopeCourseKey(scopeKey: string, courseCode: string) {
  return `${scopeKey}|${normalizeCourseCode(courseCode)}`;
}

function tokenizeSourceBackedMajorScope(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 && !SOURCE_BACKED_MAJOR_SCOPE_STOPWORDS.has(token)
    );
}

function lineReferencesCurrentMajorScope(line: string, ownerTitle: string) {
  const scopeMatch = String(line ?? "").match(SOURCE_BACKED_MAJOR_SCOPE_CUE_PATTERN);
  if (!scopeMatch) {
    return true;
  }

  const cueTokens = tokenizeSourceBackedMajorScope(scopeMatch[1]);
  const ownerTokens = tokenizeSourceBackedMajorScope(ownerTitle);
  if (!cueTokens.length || !ownerTokens.length) {
    return true;
  }

  const ownerTokenSet = new Set(ownerTokens);
  const overlapCount = cueTokens.filter((token) => ownerTokenSet.has(token)).length;
  const requiredOverlap =
    cueTokens.length === 1 || ownerTokens.length === 1 ? 1 : 2;
  return overlapCount >= Math.min(requiredOverlap, cueTokens.length, ownerTokens.length);
}

function hasUnsafeSourceBackedValidationNote(notes: string[] | null | undefined) {
  return (notes ?? []).some((note) =>
    SOURCE_BACKED_INTENTIONALLY_SKIPPED_VALIDATION_NOTE_PATTERN.test(String(note ?? ""))
  );
}

function hasTrackMatchSafeSourceBackedSkipReason(notes: string[] | null | undefined) {
  return (notes ?? []).some((note) =>
    SOURCE_BACKED_TRACK_MATCH_SAFE_SKIP_REASON_PATTERN.test(String(note ?? ""))
  );
}

function hasSiblingOptionSourceBackedSkipReason(notes: string[] | null | undefined) {
  return (notes ?? []).some((note) =>
    SOURCE_BACKED_SIBLING_OPTION_SKIP_REASON_PATTERN.test(String(note ?? ""))
  );
}

function hasOnlySiblingOptionSourceBackedSkipReason(notes: string[] | null | undefined) {
  return (
    hasSiblingOptionSourceBackedSkipReason(notes) &&
    !(notes ?? []).some(
      (note) =>
        SOURCE_BACKED_INTENTIONALLY_SKIPPED_VALIDATION_NOTE_PATTERN.test(String(note ?? "")) &&
        !SOURCE_BACKED_SIBLING_OPTION_SKIP_REASON_PATTERN.test(String(note ?? ""))
    )
  );
}

function hasStudentFacingSourceBackedRequirementCue(scope: {
  ownerTitle: string;
  sourceCourseCode: string;
  requirementCueLines: string[];
  allCandidateCodes: Set<string>;
}) {
  const normalizedCode = normalizeCourseCode(scope.sourceCourseCode);
  const cueLines = uniquePlannerStrings(scope.requirementCueLines ?? []);
  if (!normalizedCode || !cueLines.length) {
    return false;
  }

  return cueLines.some((line) => {
    if (!lineReferencesCurrentMajorScope(line, scope.ownerTitle)) {
      return false;
    }
    if (SOURCE_BACKED_NON_REQUIREMENT_CUE_PATTERN.test(String(line ?? ""))) {
      return false;
    }
    return !shouldExcludeSourceBackedFallbackCode({
      code: normalizedCode,
      requirementCueLines: [line],
      allCandidateCodes: scope.allCandidateCodes,
    });
  });
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
  return TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.some(
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
  const hasCourseCoverage = Boolean(
    (classification.grcCourseCodes ?? []).length ||
      (classification.alternativeCourseCodeSets ?? []).some((group) => (group ?? []).length)
  );
  if (!hasCourseCoverage) {
    return false;
  }

  if (!isLowerDivisionSourceBackedFallbackCode(classification.sourceUwCourseCode)) {
    return false;
  }

  if (hasUnsafeSourceBackedValidationNote(classification.validationNotes)) {
    return false;
  }

  if (!isPresentDayGuideRuleId(classification.guideRuleId)) {
    return false;
  }

  if (!isClassificationBackedBySchedulableParsedRequirementSource(classification)) {
    return false;
  }

  const requirementCueLines = getRequirementCueLinesFromClassification(classification);
  if (!requirementCueLines.length) {
    return classification.classificationKind.startsWith("auto-promoted-");
  }

  return hasStudentFacingSourceBackedRequirementCue({
    ownerTitle: classification.majorTitle,
    sourceCourseCode: classification.sourceUwCourseCode,
    requirementCueLines,
    allCandidateCodes: new Set([normalizeCourseCode(classification.sourceUwCourseCode)]),
  });
}

function shouldIncludeStudentFacingRuntimeRequirementAtom(
  atom: TransferPlannerMajorRequirementAtom
) {
  const matchingClassifications =
    SOURCE_BACKED_CLASSIFICATIONS_BY_PROMOTED_REQUIREMENT_ATOM_ID.get(atom.id) ?? [];
  if (!matchingClassifications.length) {
    return true;
  }

  return matchingClassifications.some((classification) =>
    shouldIncludeStudentFacingSourceBackedClassification(classification)
  );
}

function getStudentFacingRuntimeRequirementAtoms(planId: string, pathwayId?: string | null) {
  return getRuntimeRequirementAtoms(planId, pathwayId).filter((atom) =>
    shouldIncludeStudentFacingRuntimeRequirementAtom(atom)
  );
}

function getSourceBackedFallbackCourseLevel(code: string) {
  const match = normalizeCourseCode(code).match(/(\d{3})[A-Z]?$/);
  return match ? Number(match[1]) : null;
}

function getSourceBackedFallbackCoursePrefix(code: string) {
  const normalized = normalizeCourseCode(code);
  const withoutNumber = normalized.replace(/\s+\d{3}[A-Z]?$/, "").trim();
  const tokens = withoutNumber.split(/\s+/).filter(Boolean);
  return tokens[0] ?? withoutNumber;
}

function getSourceBackedFallbackCodeIdentity(code: string) {
  return normalizeCourseCode(code).replace(/\s+/g, "");
}

function countSourceBackedFallbackPrefixSpaces(code: string) {
  return (
    getSourceBackedFallbackCoursePrefix(code)
      .match(/\s+/g)
      ?.length ?? 0
  );
}

function shouldPreferSourceBackedFallbackDisplayCode(candidateCode: string, existingCode: string) {
  const normalizedCandidate = normalizeCourseCode(candidateCode);
  const normalizedExisting = normalizeCourseCode(existingCode);
  if (!normalizedExisting) {
    return true;
  }

  const candidateSpaceCount = countSourceBackedFallbackPrefixSpaces(normalizedCandidate);
  const existingSpaceCount = countSourceBackedFallbackPrefixSpaces(normalizedExisting);
  if (candidateSpaceCount !== existingSpaceCount) {
    return candidateSpaceCount > existingSpaceCount;
  }

  if (normalizedCandidate.length !== normalizedExisting.length) {
    return normalizedCandidate.length > normalizedExisting.length;
  }

  return normalizedCandidate.localeCompare(normalizedExisting) < 0;
}

function pickPreferredSourceBackedFallbackDisplayCode(...codes: Array<string | null | undefined>) {
  let bestCode = "";

  for (const code of codes) {
    const normalizedCode = normalizeCourseCode(code ?? "");
    if (!normalizedCode) {
      continue;
    }
    if (!bestCode || shouldPreferSourceBackedFallbackDisplayCode(normalizedCode, bestCode)) {
      bestCode = normalizedCode;
    }
  }

  return bestCode;
}

function isLowerDivisionSourceBackedFallbackCode(code: string) {
  const level = getSourceBackedFallbackCourseLevel(code);
  return level !== null && level < 300;
}

function isDisplayableSourceBackedFallbackCode(
  code: string,
  candidate?: TransferPlannerParsedRequirementAtomCandidate | null
) {
  const level = getSourceBackedFallbackCourseLevel(code);
  if (level === null) {
    return false;
  }
  if (level < 300) {
    return true;
  }
  return level < 400 && Boolean(candidate && hasStrongRequiredSourceBackedFallbackCue(candidate));
}

function shouldExcludeSourceBackedFallbackCode(scope: {
  code: string;
  requirementCueLines: string[];
  allCandidateCodes: Set<string>;
}) {
  const normalizedCode = normalizeCourseCode(scope.code);
  const prefix = getSourceBackedFallbackCoursePrefix(normalizedCode);
  if (!normalizedCode || SOURCE_ONLY_FALLBACK_NOISE_PREFIXES.has(prefix)) {
    return true;
  }

  const combinedCueText = scope.requirementCueLines.join(" ").toLowerCase();
  if (!combinedCueText) {
    return false;
  }

  const normalizedCodeLower = normalizedCode.toLowerCase();
  if (/\bexclud(?:e|es|ed|ing)\b/i.test(combinedCueText) && combinedCueText.includes(normalizedCodeLower)) {
    return true;
  }

  if (
    /\bmay also be helpful\b/i.test(combinedCueText) ||
    /\bwish to count\b/i.test(combinedCueText) ||
    /\bmay be counted\b/i.test(combinedCueText) ||
    /\bmay count toward\b/i.test(combinedCueText)
  ) {
    return true;
  }

  if (prefix === "LANGUAGE") {
    const sameLevelSpecificCodes = [...scope.allCandidateCodes].filter((candidateCode) => {
      if (candidateCode === normalizedCode) return false;
      if (getSourceBackedFallbackCourseLevel(candidateCode) !== getSourceBackedFallbackCourseLevel(normalizedCode)) {
        return false;
      }
      return !SOURCE_ONLY_FALLBACK_NOISE_PREFIXES.has(
        getSourceBackedFallbackCoursePrefix(candidateCode)
      );
    });
    if (sameLevelSpecificCodes.length > 0) {
      return true;
    }
  }

  return false;
}

function hasGuideBackedGreenRiverPath(targetCourseCode: string) {
  return Boolean(getPreferredGuideRuleWithSourceSets(targetCourseCode));
}

function hasStrongRequiredSourceBackedFallbackCue(candidate: TransferPlannerParsedRequirementAtomCandidate) {
  if (candidate.sourceSectionSchedulable === false) {
    return false;
  }

  const combinedCueText = uniquePlannerStrings(candidate.sourceLineHints ?? []).join(" ");
  if (!combinedCueText) {
    return false;
  }

  if (
    SOURCE_BACKED_NON_REQUIREMENT_CUE_PATTERN.test(combinedCueText) ||
    /\bincluding\b.{0,120}\bor\b/i.test(combinedCueText)
  ) {
    return false;
  }

  return (
    /\b\d+(?:\.\d+)?\s*cr\b/i.test(combinedCueText) ||
    /\b(?:all applicants must also complete|must complete|required|prereq(?:uisite)?(?:s)?|required courses?)\b/i.test(
      combinedCueText
    )
  );
}

function getDominantSourceBackedFallbackPhase(
  entries: TransferPlannerRequirementDiffClassificationEntry[],
  parsedCandidates: TransferPlannerParsedRequirementAtomCandidate[],
  fallbackPhase: TransferPlannerRequirementPhase = "before-enrollment"
): TransferPlannerRequirementPhase {
  const classificationPhases = entries
    .map((entry) => entry.displayPhase)
    .filter((phase): phase is TransferPlannerRequirementPhase => Boolean(phase));

  const parsedCandidatePhases = parsedCandidates
    .map((entry) => entry.displayPhase)
    .filter((phase): phase is TransferPlannerRequirementPhase => Boolean(phase));

  const phases = classificationPhases.length ? classificationPhases : parsedCandidatePhases;

  if (phases.includes("before-application")) {
    return "before-application";
  }
  if (phases.includes("before-enrollment")) {
    return "before-enrollment";
  }
  return phases[0] ?? fallbackPhase;
}

function addFallbackChecklistItemForPhase(
  checklists: SourceBackedFallbackChecklistsByPhase,
  phase: TransferPlannerRequirementPhase,
  item: TransferPlannerChecklistItem
) {
  const hasCourseReference =
    getChecklistReferenceCoursesFromItems([item]).length > 0 ||
    extractReferenceCourseCodes(item.title).length > 0;
  if (!hasCourseReference) {
    return;
  }

  if (phase === "before-application") {
    checklists.beforeApplication.push(item);
    return;
  }
  if (phase === "before-enrollment") {
    checklists.beforeEnrollment.push(item);
    return;
  }
  checklists.stayAtGrc.push(item);
}

function appendUniqueChecklistItems(
  existingItems: TransferPlannerChecklistItem[] | undefined,
  addedItems: TransferPlannerChecklistItem[]
) {
  const nextItems = [...(existingItems ?? [])];
  const seenSignatures = new Set(nextItems.map((item) => buildChecklistItemSignature(item)));

  for (const item of addedItems) {
    const signature = buildChecklistItemSignature(item);
    if (seenSignatures.has(signature)) {
      continue;
    }
    seenSignatures.add(signature);
    nextItems.push(item);
  }

  return nextItems;
}

function buildEmptyChecklistItemsByPhase(): ChecklistItemsByPhase {
  return {
    beforeApplication: [],
    beforeEnrollment: [],
    stayAtGrc: [],
  };
}

function getCanonicalCourseEntry(
  schoolId: string,
  courseCode: string | null | undefined
) {
  return CANONICAL_COURSE_BY_SCOPE_AND_CODE.get(
    `${schoolId}|${normalizeCourseCode(courseCode ?? "")}`
  );
}

function isComputingPreparationCourse(schoolId: string, courseCode: string | null | undefined) {
  const normalizedCourseCode = normalizeCourseCode(courseCode ?? "");
  if (!normalizedCourseCode) {
    return false;
  }

  const courseEntry = getCanonicalCourseEntry(schoolId, normalizedCourseCode);
  const subjectCode = String(
    courseEntry?.subjectCode ??
      normalizedCourseCode.replace(/\s+\d{3}(?:\.\d+)?[A-Z]?$/, "")
  )
    .trim()
    .toUpperCase();
  const level = courseEntry?.level ?? getSourceBackedFallbackCourseLevel(normalizedCourseCode);
  if (level !== null && level >= 300) {
    return false;
  }

  if (["CS", "CS&", "CSE"].includes(subjectCode)) {
    return true;
  }

  const searchableText = [
    courseEntry?.title,
    courseEntry?.catalogDescription,
    normalizedCourseCode,
  ]
    .join(" ")
    .trim();

  return Boolean(searchableText) && COMPUTING_PREP_KEYWORD_PATTERN.test(searchableText);
}

function getPreferredGuideRuleWithSourceSets(targetCourseCode: string) {
  return [
    ...(GUIDE_RULES_BY_TARGET_COURSE_CODE.get(normalizeCourseCode(targetCourseCode)) ?? []),
  ]
    .sort(compareGuideRules)
    .find((rule) =>
      (rule.sourceCourseSets ?? []).some((sourceCourseSet) => (sourceCourseSet ?? []).length > 0)
    ) ?? null;
}

function getCourseCatalogNumber(courseCode: string) {
  return normalizeCourseCode(courseCode).match(/\b(\d{3}(?:\.\d+)?[A-Z]?)$/)?.[1] ?? null;
}

function scoreGuideSourceCourseSetForRequirementOption(input: {
  sourceCourseSet: string[];
  targetCourseCodes: string[];
  rule: (typeof TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY)[number];
}) {
  const sourceCourseSet = uniqueReferenceCourseLabels(input.sourceCourseSet);
  const sourceNumbers = new Set(sourceCourseSet.map(getCourseCatalogNumber).filter(Boolean));
  const targetNumbers = new Set(input.targetCourseCodes.map(getCourseCatalogNumber).filter(Boolean));
  const hasMatchingCourseNumber = [...targetNumbers].some((number) => sourceNumbers.has(number));
  const dependencyCount = uniquePlannerStrings(
    sourceCourseSet.flatMap((courseCode) => [
      ...getTransitiveGrcDependencyCourseCodes(courseCode),
    ])
  ).length;
  const acceptanceRank =
    input.rule.acceptanceCategory === "preferred"
      ? 0
      : input.rule.acceptanceCategory === "accepted"
        ? 1
        : input.rule.acceptanceCategory === "accepted-with-warning"
          ? 2
          : input.rule.acceptanceCategory === "legacy-accepted"
            ? 3
            : 4;

  return (
    sourceCourseSet.length * 100 +
    dependencyCount * 10 +
    (hasMatchingCourseNumber ? 0 : 25) +
    acceptanceRank
  );
}

function getBestGuideSourceCourseSetForTarget(targetCourseCode: string) {
  return getBestGuideSourceCourseMatchesForTarget(targetCourseCode).map(
    (match) => match.sourceCourseCode
  );
}

function getBestGuideSourceCourseMatchesForTarget(targetCourseCode: string) {
  const normalizedTargetCourseCode = normalizeCourseCode(targetCourseCode);
  const bestMatch = [
    ...(GUIDE_RULES_BY_TARGET_COURSE_CODE.get(normalizedTargetCourseCode) ?? []),
  ]
    .flatMap((rule) =>
      (rule.sourceCourseSets ?? [])
        .map((sourceCourseSet) => uniqueReferenceCourseLabels(sourceCourseSet ?? []))
        .filter((sourceCourseSet) => sourceCourseSet.length > 0)
        .map((sourceCourseSet) => ({
          rule,
          sourceCourseSet,
          score: scoreGuideSourceCourseSetForRequirementOption({
            sourceCourseSet,
            targetCourseCodes: [normalizedTargetCourseCode],
            rule,
          }),
        }))
    )
    .sort((left, right) => {
      const scoreDelta = left.score - right.score;
      if (scoreDelta !== 0) return scoreDelta;

      const ruleDelta = compareGuideRules(left.rule, right.rule);
      if (ruleDelta !== 0) return ruleDelta;

      return left.sourceCourseSet.join("|").localeCompare(right.sourceCourseSet.join("|"));
    })[0];
  return bestMatch
    ? bestMatch.sourceCourseSet.map((sourceCourseCode) => ({
        sourceCourseCode,
        sourceCourseSet: [...bestMatch.sourceCourseSet],
        targetCourseCode: normalizedTargetCourseCode,
        rule: bestMatch.rule,
      }))
    : [];
}

function getGuideRuleSourceRowText(
  rule: (typeof TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY)[number]
) {
  return [
    rule.sourceCourseLabel ? `Official Green River row: ${rule.sourceCourseLabel}.` : null,
    rule.targetOutcome ? `Official UW equivalency row: ${rule.targetOutcome}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildSingleCourseEquivalencyEvidence(input: {
  sourceCourseCode: string;
  targetCourseCode: string;
  rule: (typeof TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY)[number];
}): TransferPlannerSingleCourseEquivalencyEvidence | null {
  const sourceCourseSets = input.rule.sourceCourseSets ?? [];
  const normalizedSourceCourseCode = normalizeCourseCode(input.sourceCourseCode);
  const normalizedTargetCourseCode = normalizeCourseCode(input.targetCourseCode);
  const isSingleCourseRule = sourceCourseSets.some(
    (sourceCourseSet) =>
      sourceCourseSet.length === 1 &&
      normalizeCourseCode(sourceCourseSet[0] ?? "") === normalizedSourceCourseCode
  );
  if (
    !isSingleCourseRule ||
    input.rule.sourceKind !== "uw-green-river-equivalency-guide" ||
    input.rule.acceptanceCategory === "no-credit" ||
    input.rule.type === "elective-credit"
  ) {
    return null;
  }

  return {
    grcSourceCourse: normalizedSourceCourseCode,
    uwTargetCourse: normalizedTargetCourseCode,
    ruleId: input.rule.id,
    ruleType: input.rule.type,
    sourceKind: input.rule.sourceKind ?? null,
    sourceRowText: getGuideRuleSourceRowText(input.rule) || input.rule.title,
    sourceUrl: input.rule.sourceLinks?.find((link) => link.url)?.url ?? null,
    effectiveDateLabel: input.rule.effectiveDateLabel ?? null,
    effectiveYearRanges: input.rule.effectiveYearRanges ?? [],
    warnings: input.rule.plannerWarnings ?? [],
    restrictions: [],
  };
}

function uniqueEquivalencyEvidence(
  values: TransferPlannerSingleCourseEquivalencyEvidence[]
) {
  const evidenceByKey = new Map<string, TransferPlannerSingleCourseEquivalencyEvidence>();
  for (const evidence of values) {
    const key = [
      evidence.grcSourceCourse,
      evidence.uwTargetCourse,
      evidence.ruleId,
    ].join("|");
    if (!evidenceByKey.has(key)) {
      evidenceByKey.set(key, evidence);
    }
  }
  return [...evidenceByKey.values()];
}

function uniqueCompoundComponentSets(values: string[][]) {
  const componentsByKey = new Map<string, string[]>();
  for (const value of values) {
    const component = uniqueReferenceCourseLabels(value ?? []);
    if (!component.length) {
      continue;
    }

    const key = component.join("|");
    if (!componentsByKey.has(key)) {
      componentsByKey.set(key, component);
    }
  }

  return [...componentsByKey.values()];
}

function buildRequirementOption(input: {
  id?: string;
  optionKind?: "course" | "category-option";
  requirementShape?: TransferPlannerRequirementStructuralShape | null;
  sequencePathId?: string | null;
  pathLabel?: string | null;
  displayCourseCodes?: string[];
  uwCourses?: string[];
  equivalentUwCourseCodes?: string[];
  conditionalLabCourses?: string[];
  credits?: number | null;
  creditMin?: number | null;
  creditMax?: number | null;
  creditText?: string | null;
  maxCredits?: number | null;
  title?: string | null;
  department?: string | null;
  category?: string | null;
  sourceHeading?: string | null;
  sourceCategory?: string | null;
  grcMatches?: string[];
  equivalencyEvidence?: TransferPlannerSingleCourseEquivalencyEvidence[];
  compoundComponents?: string[][];
  categoryOption?: TransferPlannerRequirementOption["categoryOption"];
  constraints?: string[];
  notes?: string[];
  label: string;
}): TransferPlannerRequirementOption {
  const uwCourses = uniquePlannerStrings(
    (input.uwCourses ?? []).map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
  const isCategoryOption = input.optionKind === "category-option" || Boolean(input.categoryOption);
  const equivalentUwCourseCodes = uniquePlannerStrings(
    (input.equivalentUwCourseCodes ?? [])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter((courseCode) => courseCode && !uwCourses.includes(courseCode))
  );
  const equivalencyEvidence = isCategoryOption
    ? []
    : uniqueEquivalencyEvidence(input.equivalencyEvidence ?? []);

  return {
    id: input.id,
    optionKind: isCategoryOption ? "category-option" : "course",
    requirementShape:
      input.requirementShape ??
      (isCategoryOption ? "category-option" : null),
    sequencePathId: sanitizePlannerOwnedText(input.sequencePathId ?? "") || null,
    pathLabel: sanitizePlannerOwnedText(input.pathLabel ?? "") || null,
    displayCourseCodes: isCategoryOption
      ? []
      : uniquePlannerStrings(
          (input.displayCourseCodes ?? input.uwCourses ?? [])
            .map((courseCode) => sanitizePlannerOwnedText(courseCode))
            .filter(Boolean)
        ),
    uwCourses: isCategoryOption ? [] : uwCourses,
    equivalentUwCourseCodes: isCategoryOption ? [] : equivalentUwCourseCodes,
    conditionalLabCourses: uniqueReferenceCourseLabels(input.conditionalLabCourses ?? []),
    credits: input.credits ?? null,
    creditMin: input.creditMin ?? input.credits ?? null,
    creditMax: input.creditMax ?? input.credits ?? null,
    creditText: sanitizePlannerOwnedText(input.creditText ?? "") || (input.credits != null ? String(input.credits) : null),
    maxCredits: input.maxCredits ?? null,
    title: sanitizePlannerOwnedText(input.title ?? "") || null,
    department: sanitizePlannerOwnedText(input.department ?? "") || null,
    category: sanitizePlannerOwnedText(input.category ?? "") || null,
    sourceHeading: sanitizePlannerOwnedText(input.sourceHeading ?? "") || null,
    sourceCategory: sanitizePlannerOwnedText(input.sourceCategory ?? "") || null,
    grcMatches: isCategoryOption ? [] : uniqueReferenceCourseLabels(input.grcMatches ?? []),
    ...(equivalencyEvidence.length ? { equivalencyEvidence } : {}),
    compoundComponents: (input.compoundComponents ?? [])
      .map((component) => uniqueReferenceCourseLabels(component ?? []))
      .filter((component) => component.length > 0),
    categoryOption: input.categoryOption ?? null,
    constraints: uniquePlannerStrings(
      (input.constraints ?? []).map((constraint) => sanitizePlannerOwnedText(constraint)).filter(Boolean)
    ),
    notes: uniquePlannerStrings(
      (input.notes ?? []).map((note) => sanitizePlannerOwnedText(note)).filter(Boolean)
    ),
    label: sanitizePlannerOwnedText(input.label) || uwCourses.join(" / "),
  };
}

function buildRequirementGroup(input: {
  id: string;
  label: string;
  category: string;
  subcategory?: string | null;
  requirementType: TransferPlannerRequirementType;
  requirementShape?: TransferPlannerRequirementStructuralShape | null;
  minCourses?: number | null;
  maxCourses?: number | null;
  selectionCount?: number | null;
  requiredCount?: number | null;
  minCredits?: number | null;
  maxCredits?: number | null;
  creditText?: string | null;
  satisfactionMode?: TransferPlannerRequirementSatisfactionMode | null;
  sourceHeading?: string | null;
  sourceRowText?: string | null;
  sourceSection?: string | null;
  sourceSectionRole?: string | null;
  sourceSectionSchedulable?: boolean | null;
  detectedOptionCue?: string | null;
  sourceRole?: string | null;
  sourceUrl?: string | null;
  sourceScope?: string | null;
  pathwayId?: string | null;
  routeId?: string | null;
  canCreateScheduleRow?: boolean | null;
  supportOnly?: boolean | null;
  approvedListKey?: string | null;
  canCreatePlaceholder?: boolean | null;
  programSpecific?: boolean | null;
  sequencePaths?: TransferPlannerRequirementGroup["sequencePaths"];
  notes?: string[];
  options: TransferPlannerRequirementOption[];
}): TransferPlannerRequirementGroup {
  const label = sanitizePlannerOwnedText(input.label);
  const category = sanitizePlannerOwnedText(input.category);
  const sourceHeading = sanitizePlannerOwnedText(input.sourceHeading ?? "") || label;
  const isCreditBucket = input.requirementType === "choose_credits";
  const isSequenceChoice = input.requirementType === "sequence_choice";
  const minCredits = input.minCredits ?? null;
  const hasMaxCredits = Object.prototype.hasOwnProperty.call(input, "maxCredits");
  const maxCredits = hasMaxCredits ? input.maxCredits ?? null : minCredits ?? null;
  const creditText =
    sanitizePlannerOwnedText(input.creditText ?? "") ||
    (isCreditBucket ? formatRequirementCreditText(minCredits, maxCredits) : null);
  const sanitizedOptions = input.options
    .map((option) =>
      buildRequirementOption({
        sourceHeading,
        sourceCategory: category,
        ...option,
      })
    )
    .filter(
      (option) =>
        option.uwCourses.length > 0 ||
        (option.equivalentUwCourseCodes ?? []).length > 0 ||
        option.grcMatches.length > 0 ||
      option.optionKind === "category-option"
    );
  const sequenceOptionByPathId = new Map(
    sanitizedOptions
      .filter((option) => option.sequencePathId)
      .map((option) => [option.sequencePathId, option])
  );
  const sequenceOptionsByCourseSet = new Map(
    sanitizedOptions.map((option) => [
      uniqueReferenceCourseLabels(option.uwCourses ?? []).join("|"),
      option,
    ])
  );
  const seenSequencePathIds = new Set<string>();
  const sanitizedSequencePaths = input.sequencePaths
    ?.map((path, index) => {
      const uwCourses = uniqueReferenceCourseLabels(path.uwCourses ?? []);
      const baseId =
        sanitizePlannerOwnedText(path.id ?? "") ||
        `${input.id}:path:${slugifyPlannerId(uwCourses.join("-")) || index + 1}`;
      let id = baseId;
      if (seenSequencePathIds.has(id)) {
        id = `${baseId}-${slugifyPlannerId(uwCourses.join("-")) || index + 1}`;
      }
      let suffix = 2;
      while (seenSequencePathIds.has(id)) {
        id = `${baseId}-${slugifyPlannerId(uwCourses.join("-")) || index + 1}-${suffix}`;
        suffix += 1;
      }
      seenSequencePathIds.add(id);
      const matchingOption =
        sequenceOptionByPathId.get(path.id ?? "") ??
        sequenceOptionsByCourseSet.get(uwCourses.join("|")) ??
        null;
      const mappedGrcCourseCodes = uniqueReferenceCourseLabels([
        ...(path.mappedGrcCourseCodes ?? []),
        ...(matchingOption?.grcMatches ?? []),
      ]);
      return {
        ...path,
        id,
        label: sanitizePlannerOwnedText(path.label) || uwCourses.join(" + "),
        sourceText: sanitizePlannerOwnedText(path.sourceText),
        uwCourses,
        displayCourseCodes: path.displayCourseCodes
          ? uniqueReferenceCourseLabels(path.displayCourseCodes)
          : uwCourses,
        mappedGrcCourseCodes,
        compoundComponents: (path.compoundComponents ?? [])
          .map((component) => uniqueReferenceCourseLabels(component ?? []))
          .filter((component) => component.length > 0),
        conditionalLabCourses: path.conditionalLabCourses
          ? uniqueReferenceCourseLabels(path.conditionalLabCourses)
          : [],
        notes: path.notes ? sanitizePlannerOwnedStrings(path.notes) : [],
      };
    })
    .filter((path) => path.uwCourses.length > 0);
  return {
    id: input.id,
    label,
    category,
    subcategory: sanitizePlannerOwnedText(input.subcategory ?? "") || null,
    requirementType: input.requirementType,
    requirementShape:
      input.requirementShape ??
      getRequirementStructuralShape({
        requirementType: input.requirementType,
        supportOnly: input.supportOnly,
        sourceRole: input.sourceRole,
        sourceSectionSchedulable: input.sourceSectionSchedulable,
        options: sanitizedOptions,
        sequencePaths: input.sequencePaths,
      }),
    minCourses: isCreditBucket ? null : isSequenceChoice ? 1 : input.minCourses ?? null,
    maxCourses: isCreditBucket ? null : isSequenceChoice ? 1 : input.maxCourses ?? null,
    selectionCount: isCreditBucket ? null : isSequenceChoice ? 1 : input.selectionCount ?? null,
    requiredCount: isCreditBucket ? null : isSequenceChoice ? 1 : input.requiredCount ?? null,
    minCredits,
    maxCredits,
    creditText,
    satisfactionMode:
      input.satisfactionMode ?? (isCreditBucket ? "credit-based" : "selection-count"),
    sourceHeading,
    sourceRowText: sanitizePlannerOwnedText(input.sourceRowText ?? "") || null,
    sourceSection: sanitizePlannerOwnedText(input.sourceSection ?? "") || null,
    sourceSectionRole: sanitizePlannerOwnedText(input.sourceSectionRole ?? "") || null,
    sourceSectionSchedulable: input.sourceSectionSchedulable ?? null,
    detectedOptionCue: sanitizePlannerOwnedText(input.detectedOptionCue ?? "") || null,
    sourceRole: sanitizePlannerOwnedText(input.sourceRole ?? "") || null,
    sourceUrl: sanitizePlannerOwnedText(input.sourceUrl ?? "") || null,
    sourceScope: sanitizePlannerOwnedText(input.sourceScope ?? "") || null,
    pathwayId: sanitizePlannerOwnedText(input.pathwayId ?? "") || null,
    routeId: sanitizePlannerOwnedText(input.routeId ?? "") || null,
    canCreateScheduleRow: input.canCreateScheduleRow ?? null,
    supportOnly: input.supportOnly ?? null,
    approvedListKey: sanitizePlannerOwnedText(input.approvedListKey ?? "") || null,
    canCreatePlaceholder: input.canCreatePlaceholder ?? null,
    programSpecific: input.programSpecific ?? null,
    notes: uniquePlannerStrings(
      (input.notes ?? []).map((note) => sanitizePlannerOwnedText(note)).filter(Boolean)
    ),
    sequencePaths: sanitizedSequencePaths,
    options: sanitizedOptions,
  };
}

const UW_MSE_NME_OPTION_SOURCE_URL =
  "https://mse.washington.edu/current/undergrad/nmeoption";
const UW_MSE_NME_REPLACEMENT_REASON =
  "NME Option students complete 19 credits of NME Core and Elective Requirements instead of the standard 15-credit MSE Technical Elective requirement.";
const UW_COMPUTER_ENGINEERING_DEGREE_REQUIREMENTS_SOURCE_URL =
  "https://www.cs.washington.edu/wp-content/uploads/2025/02/CompE_degreq_dec24v2.pdf";
const UW_ALLEN_SCHOOL_COURSE_LIST_SOURCE_URL =
  COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_SOURCE_URL;

function buildComputerEngineeringCategoryPlaceholderOption(input: {
  planId: string;
  id: string;
  title: string;
  category: string;
  sourceCategoryCode: string;
  credits: number;
  creditMin: number;
  creditMax: number;
  sourceText: string;
  approvedListKey?: string | null;
  programSpecific?: boolean | null;
}): TransferPlannerRequirementOption {
  return buildRequirementOption({
    id: `${input.planId}:requirement-option:${input.id}`,
    optionKind: "category-option",
    uwCourses: [],
    credits: input.credits,
    creditMin: input.creditMin,
    creditMax: input.creditMax,
    creditText:
      input.creditMin === input.creditMax
        ? String(input.creditMin)
        : `${input.creditMin}-${input.creditMax}`,
    label: input.title,
    categoryOption: {
      category: input.category,
      sourceCategoryCode: input.sourceCategoryCode,
      title: input.title,
      credits: input.credits,
      creditMin: input.creditMin,
      creditMax: input.creditMax,
      sourceText: input.sourceText,
      approvedListKey: input.approvedListKey ?? null,
      programSpecific: input.programSpecific ?? null,
    },
    grcMatches: [],
  });
}

function buildKnownComputerEngineeringRequirementGroups(
  planId: string
): TransferPlannerRequirementGroup[] {
  if (planId !== UW_SEATTLE_COMPUTER_ENGINEERING_PLAN_ID) {
    return [];
  }

  const computerEngineeringNaturalScienceOptions = [
    buildComputerEngineeringCategoryPlaceholderOption({
      planId,
      id: "approved-natural-science-placeholder",
      title: "10 credits of approved Computer Engineering Natural Science",
      category: COMPUTER_ENGINEERING_APPROVED_NATURAL_SCIENCE_CATEGORY,
      sourceCategoryCode: "Computer Engineering Natural Science",
      credits: 10,
      creditMin: 10,
      creditMax: 10,
      approvedListKey: "computer-engineering-natural-science",
      programSpecific: true,
      sourceText:
        "Official Allen School Computer Engineering natural science list; use the CE-approved Natural Science filter for source-backed Green River equivalents.",
    }),
    buildRequirementOption({
      id: `${planId}:requirement-option:approved-natural-science-chem-142`,
      uwCourses: ["CHEM 142"],
      grcMatches: ["CHEM& 161"],
      credits: 5,
      label: "CHEM 142",
    }),
    buildRequirementOption({
      id: `${planId}:requirement-option:approved-natural-science-chem-152`,
      uwCourses: ["CHEM 152"],
      grcMatches: ["CHEM& 162"],
      credits: 5,
      label: "CHEM 152",
    }),
    buildRequirementOption({
      id: `${planId}:requirement-option:approved-natural-science-chem-162`,
      uwCourses: ["CHEM 162"],
      grcMatches: ["CHEM& 163"],
      credits: 5,
      label: "CHEM 162",
    }),
    buildRequirementOption({
      id: `${planId}:requirement-option:approved-natural-science-phys-123`,
      uwCourses: ["PHYS 123"],
      grcMatches: ["PHYS& 223"],
      credits: 5,
      label: "PHYS 123",
    }),
    buildRequirementOption({
      id: `${planId}:requirement-option:approved-natural-science-biol-180-200-220`,
      displayCourseCodes: ["BIOL 180", "BIOL 200", "BIOL 220"],
      uwCourses: ["BIOL 180"],
      equivalentUwCourseCodes: ["BIOL 200", "BIOL 220"],
      grcMatches: ["BIOL& 211", "BIOL& 212", "BIOL& 213"],
      credits: 15,
      label: "BIOL 180, BIOL 200, BIOL 220 sequence",
      notes: [
        "The UW-GRC equivalency guide maps BIOL 180/200/220 through the full Green River BIOL& 211/212/213 sequence.",
      ],
    }),
  ];

  return [
    buildRequirementGroup({
      id: `${planId}:requirement-group:cse-123-or-cse-143`,
      label: "CSE 123 or CSE 143",
      category: "computer_engineering_programming",
      subcategory: "cse_123_or_cse_143",
      requirementType: "choose_one",
      minCourses: 1,
      maxCourses: 1,
      sourceHeading: "CSE 123 Intro to Computer Programming III (4) OR CSE 143",
      notes: [
        `Source: ${UW_COMPUTER_ENGINEERING_DEGREE_REQUIREMENTS_SOURCE_URL}`,
        "Default Green River path is CS 123; CS 145 is preserved as the CSE 143 alternative for students on the legacy path.",
      ],
      options: [
        buildRequirementOption({
          id: `${planId}:requirement-option:cse-123`,
          uwCourses: ["CSE 123"],
          grcMatches: ["CS 123"],
          credits: 4,
          label: "CSE 123",
        }),
        buildRequirementOption({
          id: `${planId}:requirement-option:cse-143`,
          uwCourses: ["CSE 143"],
          grcMatches: ["CS 145"],
          credits: 5,
          label: "CSE 143",
        }),
      ],
    }),
    buildRequirementGroup({
      id: `${planId}:requirement-group:ee-205-or-ee-215`,
      label: "EE 205 or EE 215",
      category: "computer_engineering_circuits",
      subcategory: "ee_205_or_ee_215",
      requirementType: "choose_one",
      minCourses: 1,
      maxCourses: 1,
      sourceHeading: "EE 205 Intro to Signal Conditioning (4) OR EE 215 Intro to Electrical Engineering",
      notes: [
        `Source: ${UW_COMPUTER_ENGINEERING_DEGREE_REQUIREMENTS_SOURCE_URL}`,
        "Default Green River path is ENGR& 204 for EE 215; EE 205 is preserved as the UW-only source option because no current source-backed Green River equivalent is mapped.",
        "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way.",
      ],
      options: [
        buildRequirementOption({
          id: `${planId}:requirement-option:ee-205`,
          uwCourses: ["EE 205"],
          grcMatches: [],
          credits: 4,
          label: "EE 205",
          constraints: ["uw_only_no_current_grc_equivalent"],
          notes: [
            "No current source-backed Green River equivalent is mapped for EE 205.",
          ],
        }),
        buildRequirementOption({
          id: `${planId}:requirement-option:ee-215`,
          uwCourses: ["EE 215"],
          grcMatches: ["ENGR& 204"],
          credits: 4,
          label: "EE 215",
        }),
      ],
    }),
    buildRequirementGroup({
      id: `${planId}:requirement-group:approved-natural-science-10-credits`,
      label: "10 additional credits approved natural science",
      category: "computer_engineering_credit_bucket",
      subcategory: "approved_natural_science",
      requirementType: "choose_credits",
      minCredits: 10,
      maxCredits: 10,
      approvedListKey: "computer-engineering-natural-science",
      programSpecific: true,
      sourceHeading:
        "10 additional credits from approved natural science courses for Computer Engineering",
      notes: [
        `Degree sheet source: ${UW_COMPUTER_ENGINEERING_DEGREE_REQUIREMENTS_SOURCE_URL}`,
        `Approved CE Natural Science list source: ${UW_ALLEN_SCHOOL_COURSE_LIST_SOURCE_URL}`,
        "Concrete Green River options are included only where the UW-GRC equivalency guide proves the mapping; otherwise the category/list bucket remains visible.",
      ],
      options: computerEngineeringNaturalScienceOptions,
    }),
    buildRequirementGroup({
      id: `${planId}:requirement-group:additional-math-science-3-6-credits`,
      label: "3-6 additional Math/Science",
      category: "computer_engineering_credit_bucket",
      subcategory: "additional_math_science",
      requirementType: "choose_credits",
      minCredits: 3,
      maxCredits: 6,
      approvedListKey: "computer-engineering-math-science",
      programSpecific: true,
      sourceHeading:
        "3-6 additional Math/Science credits from approved natural science courses plus approved Math/Statistics/AMATH courses",
      notes: [
        `Degree sheet source: ${UW_COMPUTER_ENGINEERING_DEGREE_REQUIREMENTS_SOURCE_URL}`,
        `Approved CE Natural Science list source: ${UW_ALLEN_SCHOOL_COURSE_LIST_SOURCE_URL}`,
        "MATH 207 is mapped to MATH 238 only because the UW-GRC guide proves that equivalency; the remaining approved list is represented by the placeholder until source-backed Green River mappings are available.",
      ],
      options: [
        buildComputerEngineeringCategoryPlaceholderOption({
          planId,
          id: "additional-math-science-placeholder",
          title: "3-6 credits of approved Computer Engineering Math/Science",
          category: COMPUTER_ENGINEERING_APPROVED_MATH_SCIENCE_CATEGORY,
          sourceCategoryCode: "Computer Engineering Math/Science",
          credits: 3,
          creditMin: 3,
          creditMax: 6,
          approvedListKey: "computer-engineering-math-science",
          programSpecific: true,
          sourceText:
            "Official Computer Engineering Math/Science bucket: approved CE natural science courses plus STAT 391, STAT 394, MATH 207, MATH 209, MATH 318, MATH 334, MATH 335, MATH 394, AMATH 351, and AMATH 353.",
        }),
        buildRequirementOption({
          id: `${planId}:requirement-option:additional-math-science-math-207`,
          uwCourses: ["MATH 207"],
          grcMatches: ["MATH 238"],
          credits: 4,
          label: "MATH 207",
        }),
      ],
    }),
  ];
}

function buildMaterialsScienceNmeRequirementReplacement(
  planId: string
): TransferPlannerRequirementReplacement {
  return {
    baseRequirementId: `${planId}:requirement-group:mse-technical-electives-15-credits`,
    replacedByRequirementId: `${planId}:requirement-group:mse-nme-core-elective-19-credits`,
    appliesWhen: 'selectedOption === "NME"',
    replacementReason: UW_MSE_NME_REPLACEMENT_REASON,
    sourceUrl: UW_MSE_NME_OPTION_SOURCE_URL,
    sourceHeading: "NME Option requirements",
  };
}

function buildMaterialsScienceNmeOptionGroup(planId: string): TransferPlannerRequirementGroup {
  const sourceHeading = "NME Option Core/Elective Requirement: 19 credits";
  const nmeOption = (option: TransferPlannerRequirementOption) =>
    buildRequirementOption({
      sourceHeading,
      sourceCategory:
        option.category === "nme_core_required"
          ? "NME core (4 credits)"
          : "NME electives (15 credits required)",
      ...option,
    });
  const nmeOptions = [
    nmeOption({
      displayCourseCodes: ["NME 220"],
      uwCourses: ["NME 220"],
      credits: 4,
      title: "Introduction to Molecular and Nanoscale Principles",
      department: "NME",
      category: "nme_core_required",
      label: "NME 220",
      notes: ["NME 220 must be taken in the spring of the sophomore or junior year."],
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["BIOEN 423"],
      uwCourses: ["BIOEN 423"],
      credits: 3,
      title: "Introduction to Synthetic Biology",
      department: "BIOEN",
      category: "nme_elective_option",
      label: "BIOEN 423",
      notes: ["Prerequisite: MATH 207 or MATH 307 and MATH 208 or MATH 308."],
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["BIOEN 490"],
      uwCourses: ["BIOEN 490"],
      equivalentUwCourseCodes: ["CHEME 490"],
      credits: 3,
      title: "Engineering Materials for Biomedical Applications",
      department: "BIOEN",
      category: "nme_elective_option",
      label: "BIOEN/CHEM E 490",
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["BIOEN 491"],
      uwCourses: ["BIOEN 491"],
      equivalentUwCourseCodes: ["CHEME 491"],
      credits: 3,
      title: "Controlled-Release Systems",
      department: "BIOEN",
      category: "nme_elective_option",
      label: "BIOEN/CHEM E 491",
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["BIOEN 492"],
      uwCourses: ["BIOEN 492"],
      equivalentUwCourseCodes: ["CHEME 458"],
      credits: 3,
      title: "Surface Analysis",
      department: "BIOEN",
      category: "nme_elective_option",
      label: "BIOEN 492/CHEM E 458",
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["CHEM E 523"],
      uwCourses: ["CHEME 523"],
      credits: 1,
      title: "Seminar in Chemical Engineering",
      department: "CHEME",
      category: "nme_restricted_option",
      label: "CHEM E 523",
      notes: ["Seminar credit listed on the NME option source page."],
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["EE 485"],
      uwCourses: ["EE 485"],
      credits: 4,
      title: "Introduction to Phototonics",
      department: "EE",
      category: "nme_elective_option",
      label: "EE 485",
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["ENGR 321"],
      uwCourses: ["ENGR 321"],
      credits: 2,
      creditMin: 1,
      creditMax: 2,
      creditText: "1-2",
      maxCredits: 4,
      title: "Internship Class",
      department: "ENGR",
      category: "nme_restricted_option",
      label: "ENGR 321",
      constraints: ["max_degree_counting_credits:4"],
      notes: ["ENGR 321 can count a maximum of 4 credits toward the degree."],
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["M E 410"],
      uwCourses: ["ME 410"],
      credits: 3,
      title: "Nanodevices: Design and Manufacture",
      department: "ME",
      category: "nme_elective_option",
      label: "M E 410",
      notes: ["Open to non-ME majors during Period 2 registration."],
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["MOLENG 520"],
      uwCourses: ["MOLENG 520"],
      equivalentUwCourseCodes: ["CHEM 597"],
      credits: 1,
      title: "Seminar in Molecular Engineering",
      department: "MOLENG",
      category: "nme_restricted_option",
      label: "MOLENG 520/CHEM 597",
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["MOLENG 535"],
      uwCourses: ["MOLENG 535"],
      credits: 1,
      creditMin: 1,
      creditMax: 10,
      creditText: "1-10",
      title: "Seminar in Clean Energy",
      department: "MOLENG",
      category: "nme_restricted_option",
      label: "MOLENG 535",
      grcMatches: [],
    }),
    ...[
      ["MSE 452", "Functional Properties of Materials II", 3],
      ["MSE 462", "Mechanical Behavior of Materials II", 3],
      ["MSE 471", "Introduction to Polymer Science and Engineering", 3],
      ["MSE 473", "Noncrystalline State", 3],
      ["MSE 474", "Nanocomposite Materials", 3],
      ["MSE 475", "Intro to Composite Materials", 3],
      ["MSE 476", "Introduction to Optoelectronic Materials", 3],
      ["MSE 481", "Science and Technology of Nanostructures", 3],
      ["MSE 482", "Biomaterials and Nanomaterials in Tissue Engineering", 3],
      ["MSE 483", "Nanomedicine", 3],
    ].map(([courseCode, title, credits]) =>
      nmeOption({
        displayCourseCodes: [String(courseCode)],
        uwCourses: [String(courseCode)],
        credits: Number(credits),
        title: String(title),
        department: "MSE",
        category: "nme_elective_option",
        label: String(courseCode),
        grcMatches: [],
      })
    ),
    nmeOption({
      displayCourseCodes: ["MSE 484"],
      uwCourses: ["MSE 484"],
      equivalentUwCourseCodes: ["CHEM 484"],
      credits: 3,
      title: "Electronic and Optoelectronic Polymers",
      department: "MSE",
      category: "nme_elective_option",
      label: "MSE 484/CHEM 484",
      notes: ["Prerequisite: CHEM 455."],
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["MSE 486"],
      uwCourses: ["MSE 486"],
      equivalentUwCourseCodes: ["EE 486"],
      credits: 3,
      title: "Fundamentals of Integrated Circuit Technology",
      department: "MSE",
      category: "nme_elective_option",
      label: "MSE 486/EE 486",
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["MSE 498"],
      uwCourses: ["MSE 498"],
      credits: 3,
      creditMin: 3,
      creditMax: 4,
      creditText: "3-4",
      title: "MSE Special Topics",
      department: "MSE",
      category: "nme_restricted_option",
      label: "MSE 498 - selected ones",
      notes: ["Only selected MSE 498 topics count, as announced by the adviser."],
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["NME 498"],
      uwCourses: ["NME 498"],
      credits: 3,
      creditMin: 3,
      creditMax: 4,
      creditText: "3-4",
      title: "Selected NME Special Topics",
      department: "NME",
      category: "nme_elective_option",
      label: "NME 498",
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["MSE 502"],
      uwCourses: ["MSE 502"],
      credits: 3,
      title: "Sol-Gel Processing",
      department: "MSE",
      category: "nme_elective_option",
      label: "MSE 502",
      notes: ["Offered autumn quarter in odd years."],
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["MSE 520"],
      uwCourses: ["MSE 520"],
      credits: 1,
      title: "Seminar in Materials Science & Engineering",
      department: "MSE",
      category: "nme_restricted_option",
      label: "MSE 520",
      grcMatches: [],
    }),
    nmeOption({
      displayCourseCodes: ["MSE 560"],
      uwCourses: ["MSE 560"],
      credits: 3,
      title: "Organic Electronic and Photonic Materials/Polymers",
      department: "MSE",
      category: "nme_elective_option",
      label: "MSE 560",
      grcMatches: [],
    }),
  ].map((option) => ({
    ...option,
    id: `${planId}:requirement-option:nme-${[
      ...(option.uwCourses ?? []),
      ...(option.equivalentUwCourseCodes ?? []),
    ]
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}`,
  }));

  return buildRequirementGroup({
    id: `${planId}:requirement-group:mse-nme-core-elective-19-credits`,
    label: "NME Option Core/Elective Requirement: 19 credits",
    category: "nme_core_elective",
    subcategory: "nme_core_elective_19_credits",
    requirementType: "choose_credits",
    minCredits: 19,
    sourceHeading,
    notes: [
      UW_MSE_NME_REPLACEMENT_REASON,
      "This replaces the standard 15-credit MSE technical elective requirement.",
      "Normal MSE technical elective rules are not the active requirement for this option unless the NME source explicitly permits overlap.",
      "NME core: NME 220 is required and must be taken in spring of sophomore or junior year.",
      "NME electives: choose 15 credits from approved NME elective courses.",
      "Quarter offerings listed in the UW source are subject to change.",
    ],
    options: nmeOptions,
  });
}

function buildKnownMaterialsScienceRequirementGroups(
  planId: string,
  parsedUwCourseCodes: string[],
  pathwayId?: string | null
) {
  if (planId !== "uw-seattle-materials-science-engineering") {
    return [] as TransferPlannerRequirementGroup[];
  }

  const parsedCourseCodeSet = new Set(
    parsedUwCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
  const groups: TransferPlannerRequirementGroup[] = [];
  const addGroup = (group: TransferPlannerRequirementGroup) => {
    if (group.options.length > 0) {
      groups.push(group);
    }
  };

  if (["AMATH 301", "CSE 142", "CSE 122"].every((courseCode) => parsedCourseCodeSet.has(courseCode))) {
    addGroup(
      buildRequirementGroup({
        id: `${planId}:requirement-group:scientific-computing`,
        label: "Scientific computing",
        category: "engineering-fundamentals",
        requirementType: "choose_one",
        minCourses: 1,
        maxCourses: 1,
        options: [
          buildRequirementOption({
            id: `${planId}:requirement-option:amath-301`,
            uwCourses: ["AMATH 301"],
            credits: 4,
            label: "AMATH 301 - Beginning Scientific Computing",
          }),
          buildRequirementOption({
            id: `${planId}:requirement-option:cse-142`,
            uwCourses: ["CSE 142"],
            credits: 4,
            label: "CSE 142 - Computer Programming I",
          }),
          buildRequirementOption({
            id: `${planId}:requirement-option:cse-122`,
            uwCourses: ["CSE 122"],
            credits: 4,
            label: "CSE 122 - Intro to Computer Programming II",
          }),
        ],
      })
    );
  }

  if (parsedCourseCodeSet.has("MATH 207") || parsedCourseCodeSet.has("MATH 307")) {
    addGroup(
      buildRequirementGroup({
        id: `${planId}:requirement-group:math-207`,
        label: "MATH 207 Differential Equations",
        category: "mathematics",
        requirementType: "all_required",
        minCourses: 1,
        maxCourses: 1,
        options: [
          buildRequirementOption({
            id: `${planId}:requirement-option:math-207`,
            uwCourses: ["MATH 207"],
            equivalentUwCourseCodes: ["MATH 307"],
            credits: 3,
            label: "MATH 207 (or MATH 307)",
          }),
        ],
      })
    );
  }

  if (parsedCourseCodeSet.has("MATH 208") || parsedCourseCodeSet.has("MATH 308")) {
    addGroup(
      buildRequirementGroup({
        id: `${planId}:requirement-group:math-208`,
        label: "MATH 208 Matrix Algebra",
        category: "mathematics",
        requirementType: "all_required",
        minCourses: 1,
        maxCourses: 1,
        options: [
          buildRequirementOption({
            id: `${planId}:requirement-option:math-208`,
            uwCourses: ["MATH 208"],
            equivalentUwCourseCodes: ["MATH 308"],
            credits: 3,
            label: "MATH 208 (or MATH 308)",
          }),
        ],
      })
    );
  }

  const mathElectiveOptions = [
    buildRequirementOption({ uwCourses: ["INDE 315"], credits: 3, label: "INDE 315" }),
    buildRequirementOption({
      uwCourses: ["MATH 209"],
      equivalentUwCourseCodes: ["MATH 309"],
      credits: 3,
      label: "MATH 209 (or MATH 309)",
    }),
    buildRequirementOption({
      uwCourses: ["MATH 224"],
      equivalentUwCourseCodes: ["MATH 324"],
      credits: 3,
      label: "MATH 224 (or MATH 324)",
    }),
    buildRequirementOption({ uwCourses: ["MATH 318"], credits: 3, label: "MATH 318" }),
    buildRequirementOption({ uwCourses: ["STAT 390"], credits: 3, label: "STAT 390" }),
  ];
  if (mathElectiveOptions.length) {
    addGroup(
      buildRequirementGroup({
        id: `${planId}:requirement-group:math-elective`,
        label: "One (1) Math Elective",
        category: "math-elective",
        requirementType: "choose_n",
        minCourses: 1,
        maxCourses: 1,
        options: mathElectiveOptions.map((option, index) => ({
          ...option,
          id: `${planId}:requirement-option:math-elective-${index + 1}`,
        })),
      })
    );
  }

  const scienceElectiveOptions = [
    buildRequirementOption({ uwCourses: ["BIOL 180"], credits: 5, label: "BIOL 180" }),
    buildRequirementOption({ uwCourses: ["BIOL 200"], credits: 5, label: "BIOL 200" }),
    buildRequirementOption({
      uwCourses: ["CHEM 162"],
      equivalentUwCourseCodes: ["CHEM 153", "CHEM 155"],
      credits: 5,
      label: "CHEM 162 (or CHEM 153 or CHEM 155)",
    }),
    buildRequirementOption({ uwCourses: ["CHEM 165"], credits: 5, label: "CHEM 165" }),
    buildRequirementOption({ uwCourses: ["CHEM 223"], credits: 4, label: "CHEM 223" }),
    buildRequirementOption({ uwCourses: ["CHEM 224"], credits: 4, label: "CHEM 224" }),
    buildRequirementOption({ uwCourses: ["CHEM 237"], credits: 4, label: "CHEM 237" }),
    buildRequirementOption({ uwCourses: ["CHEM 238"], credits: 4, label: "CHEM 238" }),
    buildRequirementOption({ uwCourses: ["CHEM 312"], credits: 3, label: "CHEM 312" }),
    buildRequirementOption({ uwCourses: ["CHEM 317"], credits: 3, label: "CHEM 317" }),
    buildRequirementOption({ uwCourses: ["CHEM 335"], credits: 4, label: "CHEM 335" }),
    buildRequirementOption({ uwCourses: ["CHEM 336"], credits: 4, label: "CHEM 336" }),
    buildRequirementOption({ uwCourses: ["CHEM 452"], credits: 3, label: "CHEM 452" }),
    buildRequirementOption({ uwCourses: ["CHEM 455"], credits: 3, label: "CHEM 455" }),
    buildRequirementOption({ uwCourses: ["CHEM 456"], credits: 3, label: "CHEM 456" }),
    buildRequirementOption({ uwCourses: ["PHYS 224"], credits: 3, label: "PHYS 224" }),
    buildRequirementOption({ uwCourses: ["PHYS 225"], credits: 3, label: "PHYS 225" }),
    buildRequirementOption({ uwCourses: ["PHYS 227"], credits: 3, label: "PHYS 227" }),
    buildRequirementOption({ uwCourses: ["PHYS 228"], credits: 3, label: "PHYS 228" }),
  ].map((option) => ({
    ...option,
    id: `${planId}:requirement-option:science-elective-${[
      ...(option.uwCourses ?? []),
      ...(option.equivalentUwCourseCodes ?? []),
    ]
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}`,
  }));
  if (scienceElectiveOptions.length) {
    addGroup(
      buildRequirementGroup({
        id: `${planId}:requirement-group:science-electives`,
        label: "Two Science Electives",
        category: "science-elective",
        requirementType: "choose_n",
        minCourses: 2,
        maxCourses: 2,
        options: scienceElectiveOptions,
      })
    );
  }

  const engineeringFundamentalOptions = [
    buildRequirementOption({ uwCourses: ["AA 260"], credits: 4, department: "AA", label: "AA 260" }),
    buildRequirementOption({ uwCourses: ["BIOEN 215"], credits: 3, department: "BIOEN", label: "BIOEN 215" }),
    buildRequirementOption({ uwCourses: ["BSE 201"], credits: 5, department: "BSE", label: "BSE 201" }),
    buildRequirementOption({ uwCourses: ["CHEME 355"], credits: 3, department: "CHEME", label: "CHEM E 355" }),
    buildRequirementOption({ uwCourses: ["CSE 123"], credits: 4, department: "CSE", label: "CSE 123" }),
    buildRequirementOption({ uwCourses: ["CSE 143"], credits: 5, department: "CSE", label: "CSE 143" }),
    buildRequirementOption({ uwCourses: ["CSE 160"], credits: 4, department: "CSE", label: "CSE 160" }),
    buildRequirementOption({ uwCourses: ["CSE 164"], credits: 4, department: "CSE", label: "CSE 164" }),
    buildRequirementOption({ uwCourses: ["CSE 180"], credits: 4, department: "CSE", label: "CSE 180" }),
    buildRequirementOption({ uwCourses: ["EE 215"], credits: 4, department: "EE", label: "E E 215" }),
    buildRequirementOption({ uwCourses: ["ENGR 101"], credits: 1, department: "ENGR", label: "ENGR 101" }),
    buildRequirementOption({ uwCourses: ["ENGR 333"], credits: 3, department: "ENGR", label: "ENGR 333" }),
    buildRequirementOption({ uwCourses: ["ENGR 490"], credits: 3, department: "ENGR", label: "ENGR 490" }),
    buildRequirementOption({ uwCourses: ["INDE 250"], credits: 4, department: "INDE", label: "IND E 250" }),
    buildRequirementOption({
      uwCourses: ["INDE 315"],
      credits: 3,
      department: "INDE",
      label: "IND E 315",
      constraints: ["no_double_count:math_elective_or_engineering_fundamentals"],
      notes: ["IND E 315 may count in the Math elective category or the Engineering Fundamentals elective category, but not both."],
    }),
    buildRequirementOption({ uwCourses: ["ME 123"], credits: 4, department: "ME", label: "M E 123" }),
    buildRequirementOption({ uwCourses: ["ME 230"], credits: 4, department: "ME", label: "M E 230" }),
    buildRequirementOption({
      uwCourses: ["NME 220"],
      credits: 3,
      department: "NME",
      label: "NME 220",
      constraints: ["not_eligible_for_nme_option"],
      notes: ["NME 220 is not eligible as an Engineering Fundamentals elective for NME Option students."],
    }),
  ];
  if (engineeringFundamentalOptions.length) {
    addGroup(
      buildRequirementGroup({
        id: `${planId}:requirement-group:engineering-fundamentals-electives`,
        label: "8 Credits of Engineering Fundamentals Electives",
        category: "engineering_fundamentals",
        subcategory: "engineering_fundamentals_electives",
        requirementType: "choose_credits",
        minCredits: 8,
        sourceHeading: "8 Credits of Engineering Fundamentals Electives selected from the following list",
        notes: [
          "IND E 315 may count in the Math elective category or the Engineering Fundamentals elective category, but not both.",
          "NME 220 is not eligible as an Engineering Fundamentals elective for NME Option students.",
        ],
        options: engineeringFundamentalOptions,
      })
    );
  }

  const mseTechnicalElectiveOptions = [
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
  ].map((courseCode) =>
    buildRequirementOption({
      uwCourses: [courseCode],
      credits: 3,
      department: "MSE",
      label: courseCode,
    })
  );
  if (mseTechnicalElectiveOptions.length) {
    addGroup(
      buildRequirementGroup({
        id: `${planId}:requirement-group:mse-400-level-technical-electives`,
        label: "MSE 400-level Technical Electives",
        category: "technical_electives",
        subcategory: "mse_400_level",
        requirementType: "choose_credits",
        minCredits: 6,
        sourceHeading: "A minimum of 6 credits in MSE 400-level courses listed below are required",
        notes: ["MSE 500-level courses, except seminar, may satisfy the MSE technical elective minimum."],
        options: mseTechnicalElectiveOptions.map((option) => ({
          ...option,
          id: `${planId}:requirement-option:mse-technical-elective-${(option.uwCourses[0] ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        })),
      })
    );
  }

  const outsideMseTechnicalElectiveOptions = [
    buildRequirementOption({ uwCourses: ["AMATH 352"], credits: 3, department: "AMATH", label: "AMATH 352" }),
    buildRequirementOption({ uwCourses: ["AMATH 353"], credits: 3, department: "AMATH", label: "AMATH 353" }),
    buildRequirementOption({ uwCourses: ["AMATH 383"], credits: 3, department: "AMATH", label: "AMATH 383" }),
    buildRequirementOption({ uwCourses: ["AMATH 401"], credits: 3, department: "AMATH", label: "AMATH 401" }),
    buildRequirementOption({ uwCourses: ["AMATH 403"], credits: 3, department: "AMATH", label: "AMATH 403" }),
    buildRequirementOption({ uwCourses: ["BIOC 405"], credits: 3, department: "BIOC", label: "BIOC 405" }),
    buildRequirementOption({ uwCourses: ["BIOC 406"], credits: 3, department: "BIOC", label: "BIOC 406" }),
    buildRequirementOption({ uwCourses: ["CHEM 312"], credits: 3, department: "CHEM", label: "CHEM 312" }),
    buildRequirementOption({ uwCourses: ["CHEM 455"], credits: 3, department: "CHEM", label: "CHEM 455" }),
    buildRequirementOption({ uwCourses: ["CHEM 456"], credits: 3, department: "CHEM", label: "CHEM 456" }),
    buildRequirementOption({ uwCourses: ["CHEM 457"], credits: 3, department: "CHEM", label: "CHEM 457" }),
    buildRequirementOption({ uwCourses: ["CHEME 341"], credits: 3, department: "CHEME", label: "CHEM E 341" }),
    buildRequirementOption({
      uwCourses: ["ENGR 321"],
      credits: 4,
      maxCredits: 4,
      department: "ENGR",
      label: "ENGR 321",
      constraints: ["max_degree_counting_credits:4"],
      notes: ["ENGR 321 can count a maximum of 4 credits toward the degree."],
    }),
    buildRequirementOption({ uwCourses: ["ENVIR 480"], credits: 3, department: "ENVIR", label: "ENVIR 480" }),
    buildRequirementOption({ uwCourses: ["PHYS 321"], credits: 3, department: "PHYS", label: "PHYS 321" }),
    buildRequirementOption({ uwCourses: ["PHYS 324"], credits: 3, department: "PHYS", label: "PHYS 324" }),
    buildRequirementOption({ uwCourses: ["PHYS 325"], credits: 3, department: "PHYS", label: "PHYS 325" }),
    buildRequirementOption({ uwCourses: ["PHYS 334"], credits: 3, department: "PHYS", label: "PHYS 334" }),
    buildRequirementOption({ uwCourses: ["PHYS 335"], credits: 3, department: "PHYS", label: "PHYS 335" }),
    buildRequirementOption({ uwCourses: ["PHYS 434"], credits: 3, department: "PHYS", label: "PHYS 434" }),
    buildRequirementOption({ uwCourses: ["PHYS 441"], credits: 3, department: "PHYS", label: "PHYS 441" }),
    buildRequirementOption({ uwCourses: ["ENTRE 370"], credits: 4, department: "ENTRE", label: "ENTRE 370" }),
    buildRequirementOption({ uwCourses: ["ENTRE 440"], credits: 4, department: "ENTRE", label: "ENTRE 440" }),
  ];
  if (outsideMseTechnicalElectiveOptions.length) {
    addGroup(
      buildRequirementGroup({
        id: `${planId}:requirement-group:outside-mse-technical-electives`,
        label: "Outside-MSE Technical Electives",
        category: "technical_electives",
        subcategory: "outside_mse_approved",
        requirementType: "choose_credits",
        minCredits: 0,
        maxCredits: 9,
        creditText: "0-9 credits",
        sourceHeading: "A maximum of 9 credits in 400-level courses in the following departments will satisfy the technical electives requirement",
        notes: [
          "A maximum of 9 credits in approved outside-MSE courses may satisfy the technical electives requirement.",
          "500-level courses from approved outside departments may satisfy the outside technical elective requirement, but require adviser or manual audit update.",
          "Any outside course not listed requires a Course Substitution Petition Form.",
        ],
        options: outsideMseTechnicalElectiveOptions.map((option) => ({
          ...option,
          id: `${planId}:requirement-option:outside-mse-technical-elective-${(option.uwCourses[0] ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        })),
      })
    );
  }

  if (pathwayId === "nme-option" && parsedCourseCodeSet.has("NME 220")) {
    addGroup(buildMaterialsScienceNmeOptionGroup(planId));
  }

  return groups;
}

function buildKnownSbseComputationDataScienceGroup(
  planId: string
): TransferPlannerRequirementGroup {
  const option = (input: {
    id: string;
    displayCourseCodes?: string[];
    uwCourses: string[];
    equivalentUwCourseCodes?: string[];
    grcMatches?: string[];
    label: string;
  }) => {
    const { id, ...optionInput } = input;
    return buildRequirementOption({
      id: `${planId}:requirement-option:sbse-computation-${id}`,
      credits: 4,
      sourceHeading: "Computation and Data Science elective",
      sourceCategory: "computation_data_science_elective",
      ...optionInput,
    });
  };

  return buildRequirementGroup({
    id: `${planId}:requirement-group:computation-data-science-elective`,
    label: "Computation and Data Science elective: choose one approved course",
    category: "computation_data_science_elective",
    subcategory: "computation_data_science",
    requirementType: "choose_one",
    minCourses: 1,
    maxCourses: 1,
    sourceHeading: "Computation and Data Science elective",
    notes: [
      "Official UW SBSE source requires one course and accepts AMATH 301, CSE 121/122/123/142/143, CSE 160, INFO/CSE/STAT 180, or Q SCI 256.",
      "All source-backed accepted options are preserved so a completed Green River equivalent can satisfy the bucket without scheduling another option.",
    ],
    options: [
      option({
        id: "amath-301",
        uwCourses: ["AMATH 301"],
        grcMatches: ["ENGR 250"],
        label: "AMATH 301",
      }),
      option({
        id: "cse-121",
        uwCourses: ["CSE 121"],
        grcMatches: ["CS 121"],
        label: "CSE 121",
      }),
      option({
        id: "cse-122",
        uwCourses: ["CSE 122"],
        grcMatches: ["CS 122"],
        label: "CSE 122",
      }),
      option({
        id: "cse-123",
        uwCourses: ["CSE 123"],
        grcMatches: ["CS 123"],
        label: "CSE 123",
      }),
      option({
        id: "cse-142",
        uwCourses: ["CSE 142"],
        grcMatches: ["CS& 141"],
        label: "CSE 142",
      }),
      option({
        id: "cse-143",
        uwCourses: ["CSE 143"],
        grcMatches: ["CS 145"],
        label: "CSE 143",
      }),
      option({
        id: "cse-160",
        uwCourses: ["CSE 160"],
        label: "CSE 160",
      }),
      option({
        id: "info-180-cse-180-stat-180",
        displayCourseCodes: ["INFO 180", "CSE 180", "STAT 180"],
        uwCourses: ["INFO 180"],
        equivalentUwCourseCodes: ["CSE 180", "STAT 180"],
        label: "INFO 180 / CSE 180 / STAT 180",
      }),
      option({
        id: "qsci-256",
        displayCourseCodes: ["Q SCI 256"],
        uwCourses: ["QSCI 256"],
        label: "Q SCI 256",
      }),
    ],
  });
}

function buildKnownSbseMathSequenceGroup(planId: string): TransferPlannerRequirementGroup {
  const option = (input: {
    id: string;
    uwCourses: string[];
    equivalentUwCourseCodes?: string[];
    grcMatches: string[];
    label: string;
  }) => {
    const { id, ...optionInput } = input;
    return buildRequirementOption({
      id: `${planId}:requirement-option:sbse-math-${id}`,
      credits: 5,
      sourceHeading: "Mathematics admission minimum sequence",
      sourceCategory: "required_sequence",
      ...optionInput,
    });
  };

  return buildRequirementGroup({
    id: `${planId}:requirement-group:sbse-math-124-125-126-sequence`,
    label: "MATH 124, MATH 125, and MATH 126 calculus sequence",
    category: "required_sequence",
    subcategory: "sbse_math_sequence",
    requirementType: "all_required",
    minCourses: 3,
    maxCourses: 3,
    sourceHeading: "MATH 124/125/126 or honors equivalent",
    notes: [
      "SBSE is a minimum-requirements major; the MATH 124/125/126 admission minimum is a required sequence, not a choose-one dropdown.",
      "Green River equivalents are MATH& 151, MATH& 152, and MATH& 163.",
    ],
    options: [
      option({
        id: "math-124",
        uwCourses: ["MATH 124"],
        equivalentUwCourseCodes: ["MATH 134"],
        grcMatches: ["MATH& 151"],
        label: "MATH 124",
      }),
      option({
        id: "math-125",
        uwCourses: ["MATH 125"],
        equivalentUwCourseCodes: ["MATH 135"],
        grcMatches: ["MATH& 152"],
        label: "MATH 125",
      }),
      option({
        id: "math-126",
        uwCourses: ["MATH 126"],
        equivalentUwCourseCodes: ["MATH 136"],
        grcMatches: ["MATH& 163"],
        label: "MATH 126",
      }),
    ],
  });
}

function buildKnownSbsePostCalculusMathGroups(
  planId: string
): TransferPlannerRequirementGroup[] {
  const group = (input: {
    id: string;
    label: string;
    uwCourses: string[];
    equivalentUwCourseCodes: string[];
    grcMatches: string[];
    note: string;
  }) =>
    buildRequirementGroup({
      id: `${planId}:requirement-group:${input.id}`,
      label: input.label,
      category: "required_sequence",
      subcategory: "sbse_post_calculus_math",
      requirementType: "all_required",
      minCourses: 1,
      maxCourses: 1,
      sourceHeading: "MATH 207 (or AMATH 351), MATH 208 (or AMATH 352)",
      notes: [
        input.note,
        "Green River equivalent is source-backed by the UW Green River transfer equivalency guide.",
      ],
      options: [
        buildRequirementOption({
          id: `${planId}:requirement-option:${input.id}`,
          uwCourses: input.uwCourses,
          equivalentUwCourseCodes: input.equivalentUwCourseCodes,
          grcMatches: input.grcMatches,
          credits: 5,
          sourceHeading: input.label,
          sourceCategory: "required_sequence",
          label: input.label,
        }),
      ],
    });

  return [
    group({
      id: "sbse-math-207-amath-351",
      label: "MATH 207 or AMATH 351",
      uwCourses: ["MATH 207"],
      equivalentUwCourseCodes: ["AMATH 351"],
      grcMatches: ["MATH 238"],
      note: "Current UW SBSE catalog requires MATH 207 or AMATH 351.",
    }),
    group({
      id: "sbse-math-208-amath-352",
      label: "MATH 208 or AMATH 352",
      uwCourses: ["MATH 208"],
      equivalentUwCourseCodes: ["AMATH 352"],
      grcMatches: ["MATH 240"],
      note: "Current UW SBSE catalog requires MATH 208 or AMATH 352.",
    }),
  ];
}

function buildKnownSbseChemistrySequenceGroup(planId: string): TransferPlannerRequirementGroup {
  const option = (input: {
    id: string;
    uwCourses: string[];
    equivalentUwCourseCodes?: string[];
    grcMatches: string[];
    label: string;
  }) => {
    const { id, ...optionInput } = input;
    return buildRequirementOption({
      id: `${planId}:requirement-option:sbse-chemistry-${id}`,
      credits: 5,
      sourceHeading: "Chemistry admission minimum sequence",
      sourceCategory: "required_sequence",
      ...optionInput,
    });
  };

  return buildRequirementGroup({
    id: `${planId}:requirement-group:sbse-chem-142-152-162-sequence`,
    label: "CHEM 142, CHEM 152, and CHEM 162 chemistry sequence",
    category: "required_sequence",
    subcategory: "sbse_chemistry_sequence",
    requirementType: "all_required",
    minCourses: 3,
    maxCourses: 3,
    sourceHeading: "CHEM 142/152/162 or honors equivalent",
    notes: [
      "SBSE is a minimum-requirements major; the CHEM 142/152/162 admission minimum is a required sequence, not a choose-one dropdown.",
      "Green River equivalents are CHEM& 161, CHEM& 162, and CHEM& 163.",
    ],
    options: [
      option({
        id: "chem-142",
        uwCourses: ["CHEM 142"],
        equivalentUwCourseCodes: ["CHEM 143", "CHEM 145"],
        grcMatches: ["CHEM& 161"],
        label: "CHEM 142",
      }),
      option({
        id: "chem-152",
        uwCourses: ["CHEM 152"],
        equivalentUwCourseCodes: ["CHEM 153", "CHEM 155"],
        grcMatches: ["CHEM& 162"],
        label: "CHEM 152",
      }),
      option({
        id: "chem-162",
        uwCourses: ["CHEM 162"],
        equivalentUwCourseCodes: ["CHEM 165"],
        grcMatches: ["CHEM& 163"],
        label: "CHEM 162",
      }),
    ],
  });
}

function buildKnownSbsePhysicsMinimumGroup(planId: string): TransferPlannerRequirementGroup {
  return buildRequirementGroup({
    id: `${planId}:requirement-group:sbse-phys-121-minimum`,
    label: "PHYS 121 or PHYS 141 physics minimum",
    category: "required_sequence",
    subcategory: "sbse_physics_minimum",
    requirementType: "all_required",
    minCourses: 1,
    maxCourses: 1,
    sourceHeading: "PHYS 121 or PHYS 141",
    notes: [
      "SBSE admission minimums include PHYS 121 or PHYS 141; Green River's source-backed equivalent is PHYS& 221.",
    ],
    options: [
      buildRequirementOption({
        id: `${planId}:requirement-option:sbse-physics-phys-121`,
        uwCourses: ["PHYS 121"],
        equivalentUwCourseCodes: ["PHYS 141"],
        grcMatches: ["PHYS& 221"],
        credits: 5,
        sourceHeading: "PHYS 121 or PHYS 141",
        sourceCategory: "required_sequence",
        label: "PHYS 121",
      }),
    ],
  });
}

function buildKnownSbseEnglishCompositionGroup(planId: string): TransferPlannerRequirementGroup {
  return buildRequirementGroup({
    id: `${planId}:requirement-group:sbse-english-composition`,
    label: "English Composition: 5 credits",
    category: "required_sequence",
    subcategory: "sbse_english_composition",
    requirementType: "all_required",
    minCourses: 1,
    maxCourses: 1,
    sourceHeading: "5 credits English Composition",
    notes: [
      "SBSE admission minimums include 5 credits of English Composition.",
    ],
    options: [
      buildRequirementOption({
        id: `${planId}:requirement-option:sbse-english-engl-131`,
        uwCourses: ["ENGL 131"],
        grcMatches: ["ENGL& 101"],
        credits: 5,
        sourceHeading: "5 credits English Composition",
        sourceCategory: "required_sequence",
        label: "ENGL 131",
      }),
    ],
  });
}

function buildKnownSbseBusinessPolicyEconomicsGroup(
  planId: string
): TransferPlannerRequirementGroup {
  const option = (input: {
    id: string;
    displayCourseCodes?: string[];
    uwCourses: string[];
    equivalentUwCourseCodes?: string[];
    grcMatches?: string[];
    label: string;
  }) => {
    const { id, ...optionInput } = input;
    return buildRequirementOption({
      id: `${planId}:requirement-option:sbse-business-policy-economics-${id}`,
      credits: 5,
      sourceHeading: "Business, Policy, and Economics elective",
      sourceCategory: "business_policy_economics_elective",
      ...optionInput,
    });
  };

  return buildRequirementGroup({
    id: `${planId}:requirement-group:business-policy-economics-elective`,
    label: "Business, Policy, and Economics elective: choose one approved course",
    category: "business_policy_economics_elective",
    subcategory: "business_policy_economics",
    requirementType: "choose_one",
    minCourses: 1,
    maxCourses: 1,
    sourceHeading: "Business, Policy, and Economics elective",
    notes: [
      "Official UW SBSE source requires one Business, Policy, and Economics course and accepts ECON 200, ECON 201, ESRM/ECON/ENVIR 235, ESRM 320, ESRM 321, ESRM 400, ESRM 423, or ESRM 465.",
      "Only source-backed accepted options are exposed as the student-facing elective bucket.",
    ],
    options: [
      option({
        id: "econ-200",
        uwCourses: ["ECON 200"],
        grcMatches: ["ECON& 201"],
        label: "ECON 200",
      }),
      option({
        id: "econ-201",
        uwCourses: ["ECON 201"],
        grcMatches: ["ECON& 202"],
        label: "ECON 201",
      }),
      option({
        id: "esrm-235-econ-235-envir-235",
        displayCourseCodes: ["ESRM 235", "ECON 235", "ENVIR 235"],
        uwCourses: ["ESRM 235"],
        equivalentUwCourseCodes: ["ECON 235", "ENVIR 235"],
        label: "ESRM 235 / ECON 235 / ENVIR 235",
      }),
      option({
        id: "esrm-320",
        uwCourses: ["ESRM 320"],
        label: "ESRM 320",
      }),
      option({
        id: "esrm-321",
        uwCourses: ["ESRM 321"],
        label: "ESRM 321",
      }),
      option({
        id: "esrm-400",
        uwCourses: ["ESRM 400"],
        label: "ESRM 400",
      }),
      option({
        id: "esrm-423",
        uwCourses: ["ESRM 423"],
        label: "ESRM 423",
      }),
      option({
        id: "esrm-465",
        uwCourses: ["ESRM 465"],
        label: "ESRM 465",
      }),
    ],
  });
}

function buildKnownSbseRequirementGroups(planId: string, _pathwayId?: string | null) {
  if (planId !== UW_SEATTLE_SBSE_PLAN_ID) {
    return [] as TransferPlannerRequirementGroup[];
  }

  return [
    buildKnownSbseMathSequenceGroup(planId),
    ...buildKnownSbsePostCalculusMathGroups(planId),
    buildKnownSbseChemistrySequenceGroup(planId),
    buildKnownSbsePhysicsMinimumGroup(planId),
    buildKnownSbseEnglishCompositionGroup(planId),
    buildKnownSbseComputationDataScienceGroup(planId),
    buildKnownSbseBusinessPolicyEconomicsGroup(planId),
  ];
}

function getRequirementGroupSupersessionText(group: TransferPlannerRequirementGroup) {
  return [
    group.id,
    group.label,
    group.sourceHeading,
    group.sourceRowText,
    ...(group.options ?? []).flatMap((option) => [
      option.label,
      ...(option.displayCourseCodes ?? []),
      ...(option.uwCourses ?? []),
      ...(option.equivalentUwCourseCodes ?? []),
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

function isSupersededSbseRequirementGroup(
  planId: string,
  group: TransferPlannerRequirementGroup
) {
  if (planId !== UW_SEATTLE_SBSE_PLAN_ID) {
    return false;
  }

  if (group.id.endsWith(":cse-123-or-cse-143")) {
    return true;
  }

  if (
    group.requirementType !== "choose_one" ||
    (group.options ?? []).some((option) => option.categoryOption)
  ) {
    return false;
  }

  const text = getRequirementGroupSupersessionText(group);
  const includesAll = (courseCodes: string[]) =>
    courseCodes.every((courseCode) =>
      new RegExp(`\\b${courseCode.replace(/\s+/g, "\\s*")}\\b`, "i").test(text)
    );

  return (
    includesAll(["MATH 124", "MATH 125", "MATH 126"]) ||
    includesAll(["CHEM 142", "CHEM 152", "CHEM 162"]) ||
    includesAll(["PHYS 121", "PHYS 122"])
  );
}

function filterStaleSbseBusinessPolicyEconomicsCourseCodes(
  courseCodes: string[],
  planId: string
) {
  if (planId !== UW_SEATTLE_SBSE_PLAN_ID) {
    return courseCodes;
  }

  return courseCodes.filter(
    (courseCode) =>
      !UW_SEATTLE_SBSE_STALE_BUSINESS_POLICY_ECONOMICS_GRC_CODES.has(
        normalizeCourseCode(courseCode)
      )
  );
}

function hydrateRequirementOption(
  option: TransferPlannerRequirementOption
): TransferPlannerRequirementOption {
  const targetCodes = uniquePlannerStrings([
    ...(option.uwCourses ?? []),
    ...(option.equivalentUwCourseCodes ?? []),
  ].map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean));
  const guideMatches = targetCodes.flatMap((targetCode) =>
    getBestGuideSourceCourseMatchesForTarget(targetCode)
  );
  const guideMatchCourseCodes = guideMatches.map((match) => match.sourceCourseCode);
  const guideMatchEvidence = guideMatches
    .map((match) =>
      buildSingleCourseEquivalencyEvidence({
        sourceCourseCode: match.sourceCourseCode,
        targetCourseCode: match.targetCourseCode,
        rule: match.rule,
      })
    )
    .filter(
      (evidence): evidence is TransferPlannerSingleCourseEquivalencyEvidence =>
        Boolean(evidence)
    );
  const equivalencyEvidence = uniqueEquivalencyEvidence([
    ...(option.equivalencyEvidence ?? []),
    ...guideMatchEvidence,
  ]);
  const compoundComponents = uniqueCompoundComponentSets([
    ...(option.compoundComponents ?? []),
    ...guideMatches
      .map((match) => match.sourceCourseSet ?? [])
      .filter((sourceCourseSet) => sourceCourseSet.length > 1),
  ]);

  return {
    ...option,
    uwCourses: uniquePlannerStrings(
      (option.uwCourses ?? []).map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
    ),
    equivalentUwCourseCodes: uniquePlannerStrings(
      (option.equivalentUwCourseCodes ?? [])
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean)
    ),
    grcMatches: uniqueReferenceCourseLabels([...(option.grcMatches ?? []), ...guideMatchCourseCodes]),
    ...(equivalencyEvidence.length ? { equivalencyEvidence } : {}),
    ...(compoundComponents.length ? { compoundComponents } : {}),
  };
}

function hydrateRequirementGroup(
  group: TransferPlannerRequirementGroup
): TransferPlannerRequirementGroup {
  const hydratedOptions = (group.options ?? []).map(hydrateRequirementOption);
  return {
    ...buildRequirementGroup({
      ...group,
      options: hydratedOptions,
    }),
    options: hydratedOptions,
  };
}

function shouldMaterializeParsedRequirementGroup(
  block: (typeof TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY)[number],
  group: TransferPlannerRequirementGroup
) {
  const label = sanitizePlannerOwnedText(group.label);
  if (!label) {
    return false;
  }

  if (block.planId === UW_SEATTLE_COMPUTER_ENGINEERING_PLAN_ID) {
    return (
      group.category === "computer_engineering_programming" ||
      group.category === "computer_engineering_circuits" ||
      group.category === "computer_engineering_credit_bucket"
    );
  }

  if (/^first year students:/i.test(label)) {
    return false;
  }

  return true;
}

function getParsedRequirementGroupsFromBlock(
  block: (typeof TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY)[number]
) {
  if (!canParsedRequirementSourceBlockCreateRequiredScheduleRows(block)) {
    return [];
  }

  const knownMaterialsScienceGroups = buildKnownMaterialsScienceRequirementGroups(
    block.planId,
    block.parsedUwCourseCodes ?? [],
    block.pathwayId
  );
  const knownMaterialsScienceGroupIds = new Set(
    knownMaterialsScienceGroups.map((group) => group.id)
  );
  const parsedRequirementGroups = (block as {
    parsedRequirementGroups?: TransferPlannerRequirementGroup[];
  }).parsedRequirementGroups;
  const safeParsedRequirementGroups = (parsedRequirementGroups ?? []).filter(
    (group) => !isSupersededSbseRequirementGroup(block.planId, group)
  );
  const parsedOrKnownGroups =
    block.planId === UW_SEATTLE_SBSE_PLAN_ID
      ? safeParsedRequirementGroups
      : block.planId === "uw-seattle-materials-science-engineering"
      ? parsedRequirementGroups && parsedRequirementGroups.length
        ? uniqueById([
            ...parsedRequirementGroups.filter((group) =>
              knownMaterialsScienceGroupIds.has(group.id)
            ),
            ...knownMaterialsScienceGroups,
          ])
        : knownMaterialsScienceGroups
      : parsedRequirementGroups && parsedRequirementGroups.length
        ? parsedRequirementGroups
        : knownMaterialsScienceGroups;
  const knownSbseGroups = buildKnownSbseRequirementGroups(block.planId, block.pathwayId);
  const rawGroups = uniqueById([
    ...(block.planId === UW_SEATTLE_SBSE_PLAN_ID ? knownSbseGroups : []),
    ...parsedOrKnownGroups,
    ...buildKnownComputerEngineeringRequirementGroups(block.planId),
    ...(block.planId === UW_SEATTLE_SBSE_PLAN_ID ? [] : knownSbseGroups),
  ]).filter((group) => !isSupersededSbseRequirementGroup(block.planId, group));

  return rawGroups
    .filter((group) => shouldMaterializeParsedRequirementGroup(block, group))
    .map((group) =>
      hydrateRequirementGroup({
        ...group,
        sourceUrl: group.sourceUrl ?? block.sourceUrl ?? block.primarySourceUrl ?? null,
        sourceRole: group.sourceRole ?? block.sourceRole ?? null,
        sourceScope:
          group.sourceScope ??
          (block.pathwayId ? "pathway-schedulable" : "primary-schedulable"),
        pathwayId: group.pathwayId ?? block.pathwayId ?? null,
        routeId: group.routeId ?? block.pathwayId ?? null,
        canCreateScheduleRow:
          group.canCreateScheduleRow ??
          canParsedRequirementSourceBlockCreateRequiredScheduleRows(block),
      })
    )
    .filter((group) => shouldRetainRequirementGroupForRuntime(group));
}

function shouldRetainRequirementGroupForRuntime(group: TransferPlannerRequirementGroup) {
  if ((group.options ?? []).length > 0) {
    return true;
  }

  return (
    group.requirementType === "choose_credits" &&
    group.canCreatePlaceholder === true &&
    group.minCredits != null &&
    group.minCredits > 0
  );
}

function applyRequirementGroupPathwayRestrictions(
  group: TransferPlannerRequirementGroup,
  pathwayId?: string | null
) {
  if (pathwayId !== "nme-option") {
    return group;
  }

  if (
    group.id.endsWith(":mse-400-level-technical-electives") ||
    group.id.endsWith(":outside-mse-technical-electives")
  ) {
    return {
      ...group,
      category: "replaced_normal_mse_technical_elective",
      notes: uniquePlannerStrings([
        ...(group.notes ?? []),
        UW_MSE_NME_REPLACEMENT_REASON,
        "This normal MSE technical elective bucket is replaced by the NME Option Core/Elective Requirement for NME Option students.",
      ]),
      options: [],
    };
  }

  if (!group.id.endsWith(":engineering-fundamentals-electives")) {
    return group;
  }

  return {
    ...group,
    notes: uniquePlannerStrings([
      ...(group.notes ?? []),
      "NME 220 is not eligible as an Engineering Fundamentals elective for NME Option students.",
    ]),
    options: (group.options ?? []).filter(
      (option) => !(option.constraints ?? []).includes("not_eligible_for_nme_option")
    ),
  };
}

function getRequirementGroupsForScope(planId: string, pathwayId?: string | null) {
  return uniqueRequirementGroupsForPathwayScope(
    getAutomaticScopeKeys(planId, pathwayId)
      .flatMap((scopeKey) => {
        const [scopePlanId, scopePathwayId = ""] = scopeKey.split("::");
        return TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.filter(
          (entry) =>
            entry.planId === scopePlanId &&
            (scopePathwayId ? entry.pathwayId === scopePathwayId : !entry.pathwayId)
        );
      })
      .flatMap(getParsedRequirementGroupsFromBlock)
      .map((group) => applyRequirementGroupPathwayRestrictions(group, pathwayId))
      .filter((group) => shouldRetainRequirementGroupForRuntime(group)),
    pathwayId
  );
}

function getRequirementReplacementsForScope(
  planId: string,
  pathwayId?: string | null
): TransferPlannerRequirementReplacement[] {
  if (planId !== "uw-seattle-materials-science-engineering" || pathwayId !== "nme-option") {
    return [];
  }

  const parsedReplacements = getAutomaticScopeKeys(planId, pathwayId)
    .flatMap((scopeKey) => {
      const [scopePlanId, scopePathwayId = ""] = scopeKey.split("::");
      return TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.filter(
        (entry) =>
          entry.planId === scopePlanId &&
          (scopePathwayId ? entry.pathwayId === scopePathwayId : !entry.pathwayId)
      );
    })
    .flatMap(
      (block) =>
        ((block as {
          parsedRequirementReplacements?: TransferPlannerRequirementReplacement[];
        }).parsedRequirementReplacements ?? [])
    );

  return uniqueRequirementReplacements([
    ...parsedReplacements,
    buildMaterialsScienceNmeRequirementReplacement(planId),
  ]);
}

function uniqueRequirementReplacements(
  replacements: TransferPlannerRequirementReplacement[]
) {
  const seen = new Set<string>();
  const uniqueReplacements: TransferPlannerRequirementReplacement[] = [];

  for (const replacement of replacements) {
    const key = `${replacement.baseRequirementId}::${replacement.replacedByRequirementId}::${replacement.appliesWhen}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueReplacements.push(replacement);
  }

  return uniqueReplacements;
}

export function buildMaterialsScienceNmeSourceIncompleteWarnings(
  planId: string,
  pathwayId: string | null | undefined,
  requirementGroups: TransferPlannerRequirementGroup[]
) {
  if (planId !== "uw-seattle-materials-science-engineering" || pathwayId !== "nme-option") {
    return [];
  }

  const hasNmeCoreElectiveGroup = requirementGroups.some((group) =>
    group.id.endsWith(":mse-nme-core-elective-19-credits")
  );
  return hasNmeCoreElectiveGroup
    ? []
    : [
        "NME Option requirements require the linked NME page. The planner parsed the base MSE page but could not verify the 19-credit NME Core/Elective requirement.",
      ];
}

function shouldAutoSelectRequirementGroupOption(group: TransferPlannerRequirementGroup) {
  if (group.requirementType !== "choose_one") {
    return false;
  }

  return !/\belective\b/i.test(`${group.category} ${group.label}`);
}

function shouldScheduleSelectedRequirementGroupOptionsByDefault(
  group: TransferPlannerRequirementGroup
) {
  return (
    group.id ===
      `${UW_SEATTLE_COMPUTER_ENGINEERING_PLAN_ID}:requirement-group:cse-123-or-cse-143` ||
    group.id ===
      `${UW_SEATTLE_COMPUTER_SCIENCE_PLAN_ID}:requirement-group:cse-123-or-cse-143` ||
    group.id ===
      `${UW_SEATTLE_COMPUTER_SCIENCE_PLAN_ID}:pathway:data-science-option:requirement-group:cse-123-or-cse-143` ||
    (
      group.id.startsWith(`${UW_SEATTLE_COMPUTER_ENGINEERING_PLAN_ID}:`) &&
      group.category === "computer_engineering_credit_bucket"
    )
  );
}

function scoreRequirementOption(option: TransferPlannerRequirementOption) {
  const grcMatches = uniqueReferenceCourseLabels(option.grcMatches ?? []);
  if (!grcMatches.length) {
    return Number.MAX_SAFE_INTEGER;
  }

  const dependencyCount = uniquePlannerStrings(
    grcMatches.flatMap((courseCode) => [...getTransitiveGrcDependencyCourseCodes(courseCode)])
  ).length;
  const sourceNumbers = new Set(grcMatches.map(getCourseCatalogNumber).filter(Boolean));
  const targetNumbers = new Set(
    (option.uwCourses ?? []).map(getCourseCatalogNumber).filter(Boolean)
  );
  const hasMatchingCourseNumber = [...targetNumbers].some((number) => sourceNumbers.has(number));

  return grcMatches.length * 100 + dependencyCount * 10 + (hasMatchingCourseNumber ? 0 : 25);
}

function getRequirementOptionCreditValue(option: TransferPlannerRequirementOption) {
  const credits = option.credits ?? 0;
  if (!Number.isFinite(credits) || credits <= 0) {
    return 0;
  }

  const maxCredits = option.maxCredits ?? null;
  if (maxCredits != null && Number.isFinite(maxCredits) && maxCredits > 0) {
    return Math.min(credits, maxCredits);
  }

  return credits;
}

function selectBestRequirementOption(
  group: TransferPlannerRequirementGroup
): TransferPlannerRequirementOption | null {
  return [...(group.options ?? [])]
    .map((option, index) => ({
      option,
      index,
      score: scoreRequirementOption(option),
    }))
    .filter((entry) => entry.option.grcMatches.length > 0)
    .sort((left, right) => {
      const scoreDelta = left.score - right.score;
      if (scoreDelta !== 0) return scoreDelta;
      return left.index - right.index;
    })[0]?.option ?? null;
}

function selectBestRequirementOptions(
  group: TransferPlannerRequirementGroup,
  count: number
): TransferPlannerRequirementOption[] {
  if (count <= 0) {
    return [];
  }

  return [...(group.options ?? [])]
    .map((option, index) => ({
      option,
      index,
      score: scoreRequirementOption(option),
    }))
    .sort((left, right) => {
      const scoreDelta = left.score - right.score;
      if (scoreDelta !== 0) return scoreDelta;
      return left.index - right.index;
    })
    .slice(0, count)
    .map((entry) => entry.option);
}

function selectBestRequirementCreditOptions(
  group: TransferPlannerRequirementGroup,
  minCredits: number
): TransferPlannerRequirementOption[] {
  if (minCredits <= 0) {
    return [];
  }

  const candidates = [...(group.options ?? [])]
    .map((option, index) => ({
      option,
      index,
      credits: getRequirementOptionCreditValue(option),
      score: scoreRequirementOption(option),
    }))
    .filter((entry) => entry.credits > 0)
    .sort((left, right) => {
      const scoreDelta = left.score - right.score;
      if (scoreDelta !== 0) return scoreDelta;
      return left.index - right.index;
    });
  const selected: TransferPlannerRequirementOption[] = [];
  let selectedCredits = 0;

  while (selectedCredits < minCredits && candidates.length > 0) {
    const remainingCredits = minCredits - selectedCredits;
    const nextIndex = candidates.findIndex((entry) => entry.credits <= remainingCredits);
    const [nextEntry] = candidates.splice(nextIndex >= 0 ? nextIndex : 0, 1);
    if (!nextEntry) {
      break;
    }

    selected.push(nextEntry.option);
    selectedCredits += nextEntry.credits;
  }

  return selected;
}

function getSelectedRequirementGroupOptions(group: TransferPlannerRequirementGroup) {
  if (group.requirementType === "all_required") {
    return group.options ?? [];
  }

  if (group.requirementType === "sequence_choice") {
    const selectedOption = selectBestRequirementOption(group) ?? group.options?.[0] ?? null;
    return selectedOption ? [selectedOption] : [];
  }

  if (group.requirementType === "choose_credits") {
    if (shouldScheduleSelectedRequirementGroupOptionsByDefault(group)) {
      const placeholderOptions = (group.options ?? []).filter(
        (option) => option.optionKind === "category-option"
      );
      if (placeholderOptions.length) {
        return placeholderOptions;
      }
    }

    return group.minCredits != null && group.minCredits > 0
      ? selectBestRequirementCreditOptions(group, group.minCredits)
      : [];
  }

  if (group.requirementType === "choose_n" && group.minCourses != null && group.minCourses > 0) {
    return selectBestRequirementOptions(group, group.minCourses);
  }

  if (shouldAutoSelectRequirementGroupOption(group)) {
    const selectedOption = selectBestRequirementOption(group);
    return selectedOption ? [selectedOption] : [];
  }

  return [];
}

function getRequirementGroupOptionGrcMatches(group: TransferPlannerRequirementGroup) {
  return uniqueReferenceCourseLabels((group.options ?? []).flatMap((option) => option.grcMatches));
}

function getRequirementOptionMappedGrcLabels(option: TransferPlannerRequirementOption) {
  return uniqueReferenceCourseLabels(option.grcMatches ?? []);
}

function getRequirementOptionCourseLabels(option: TransferPlannerRequirementOption) {
  if (option.optionKind === "category-option") {
    return [] as string[];
  }

  const grcMatches = uniqueReferenceCourseLabels(option.grcMatches ?? []);
  if (grcMatches.length) {
    return grcMatches;
  }

  return uniqueReferenceCourseLabels([
    ...(option.uwCourses ?? []),
    ...(option.equivalentUwCourseCodes ?? []),
  ]);
}

function getRequirementCategoryOptionLabel(option: TransferPlannerRequirementOption) {
  const categoryOption = option.categoryOption;
  return (
    categoryOption?.title ||
    option.label ||
    (categoryOption?.credits && categoryOption?.sourceCategoryCode
      ? `${categoryOption.credits} credits of ${categoryOption.sourceCategoryCode}`
      : "")
  );
}

function getRequirementOptionPlannerLabels(option: TransferPlannerRequirementOption) {
  if (option.optionKind === "category-option") {
    const label = getRequirementCategoryOptionLabel(option);
    return label ? [label] : [];
  }

  return getRequirementOptionCourseLabels(option);
}

function getRequirementGroupOptionCourseLabels(group: TransferPlannerRequirementGroup) {
  return uniqueReferenceCourseLabels(
    (group.options ?? []).flatMap((option) => getRequirementOptionCourseLabels(option))
  );
}

function getRequirementGroupOptionPlannerLabels(group: TransferPlannerRequirementGroup) {
  return uniquePlannerStrings(
    (group.options ?? []).flatMap((option) => getRequirementOptionPlannerLabels(option))
  );
}

function applyChecklistItemPathwayRestrictions(
  item: TransferPlannerChecklistItem,
  pathwayId?: string | null
) {
  if (!item.requirementGroup) {
    return item;
  }

  const restrictedGroup = applyRequirementGroupPathwayRestrictions(item.requirementGroup, pathwayId);
  if (restrictedGroup === item.requirementGroup) {
    return item;
  }

  if (!(restrictedGroup.options ?? []).length) {
    return null;
  }

  const retainedOptionIds = new Set(
    (restrictedGroup.options ?? []).map((option) => option.id).filter(Boolean)
  );
  const retainedCourseLabels = new Set(getRequirementGroupOptionCourseLabels(restrictedGroup));

  return sanitizeChecklistItem({
    ...item,
    requirementGroup: restrictedGroup,
    grcCourses: (item.grcCourses ?? []).filter((courseLabel) => retainedCourseLabels.has(courseLabel)),
    selectedRequirementOptionIds: (item.selectedRequirementOptionIds ?? []).filter((optionId) =>
      retainedOptionIds.has(optionId)
    ),
    unselectedRequirementOptionIds: (item.unselectedRequirementOptionIds ?? []).filter((optionId) =>
      retainedOptionIds.has(optionId)
    ),
  });
}

function getSelectedRequirementGroupGrcMatches(group: TransferPlannerRequirementGroup) {
  return uniqueReferenceCourseLabels(
    getSelectedRequirementGroupOptions(group).flatMap((option) => option.grcMatches)
  );
}

function getSelectedRequirementGroupCourseLabels(group: TransferPlannerRequirementGroup) {
  return uniqueReferenceCourseLabels(
    getSelectedRequirementGroupOptions(group).flatMap((option) => getRequirementOptionCourseLabels(option))
  );
}

function getSelectedRequirementGroupPlannerLabels(group: TransferPlannerRequirementGroup) {
  return uniquePlannerStrings(
    getSelectedRequirementGroupOptions(group).flatMap((option) =>
      getRequirementOptionPlannerLabels(option)
    )
  );
}

function getRequirementGroupMinCompletedCount(group: TransferPlannerRequirementGroup) {
  if (group.minCourses != null && group.minCourses > 0) {
    return group.minCourses;
  }

  return group.requirementType === "choose_one" ? 1 : undefined;
}

function isUwOnlyNoCurrentGrcEquivalentOption(option: TransferPlannerRequirementOption) {
  return (
    !(option.grcMatches ?? []).some((label) => String(label ?? "").trim()) &&
    (option.constraints ?? []).includes("uw_only_no_current_grc_equivalent")
  );
}

function buildRequirementGroupChecklistItem(
  group: TransferPlannerRequirementGroup
): TransferPlannerChecklistItem | null {
  const requirementShape =
    group.requirementShape ??
    getRequirementStructuralShape({
      requirementType: group.requirementType,
      supportOnly: group.supportOnly,
      sourceRole: group.sourceRole,
      sourceSectionSchedulable: group.sourceSectionSchedulable,
      options: group.options,
      sequencePaths: group.sequencePaths,
    });
  if (isNonSchedulableSupportRequirementShape(requirementShape)) {
    return null;
  }

  const allOptionLabels = getRequirementGroupOptionPlannerLabels(group);
  const allOptionGrcLabels = getRequirementGroupOptionGrcMatches(group);
  const selectedOptions = getSelectedRequirementGroupOptions(group);
  const selectedMatches = uniqueReferenceCourseLabels(
    selectedOptions.flatMap((option) => option.grcMatches)
  );
  const selectedRequirementOptionIds = selectedOptions
    .map((option) => option.id)
    .filter((optionId): optionId is string => Boolean(optionId));
  const selectedRequirementOptionIdSet = new Set(selectedRequirementOptionIds);
  const unselectedRequirementOptionIds = (group.options ?? [])
    .map((option) => option.id)
    .filter((optionId): optionId is string => Boolean(optionId && !selectedRequirementOptionIdSet.has(optionId)));
  const minCompletedCount = getRequirementGroupMinCompletedCount(group);
  let grcCourses: string[] = [];
  let alternatives: string[][] | undefined;

  if (group.requirementType === "choose_one") {
    if (shouldAutoSelectRequirementGroupOption(group) && selectedMatches.length > 0) {
      grcCourses = selectedMatches;
      alternatives = (group.options ?? [])
        .filter((option) => !selectedOptions.some((selectedOption) => selectedOption.id === option.id))
        .filter((option) => !isUwOnlyNoCurrentGrcEquivalentOption(option))
        .map((option) => getRequirementOptionMappedGrcLabels(option))
        .filter((optionMatches) => optionMatches.length > 0);
    } else {
      grcCourses = allOptionGrcLabels;
    }
  } else if (group.requirementType === "all_required" || group.requirementType === "sequence_choice") {
    grcCourses = selectedMatches.length ? selectedMatches : allOptionGrcLabels;
  } else if (
    group.requirementType === "choose_credits" &&
    shouldScheduleSelectedRequirementGroupOptionsByDefault(group) &&
    selectedMatches.length
  ) {
    grcCourses = selectedMatches;
  } else {
    grcCourses = allOptionGrcLabels;
  }

  const isVisibleCreditBucketPlaceholder =
    group.requirementType === "choose_credits" &&
    group.canCreatePlaceholder === true &&
    group.minCredits != null &&
    group.minCredits > 0;

  if (
    !isVisibleCreditBucketPlaceholder &&
    !grcCourses.length &&
    !(alternatives ?? []).length &&
    !allOptionLabels.length
  ) {
    return null;
  }

  const sourceMetadata = getRequirementGroupChecklistSourceMetadata(group);
  const hasMappedGrcCourses = grcCourses.length > 0 || (alternatives ?? []).length > 0;

  return sanitizeChecklistItem({
    id: group.id.split(":").pop() ?? group.id,
    title: group.label,
    grcCourses,
    alternatives: alternatives?.length ? alternatives : undefined,
    note: group.notes?.length ? group.notes.join(" ") : undefined,
    minCompletedCount,
    minCredits: group.minCredits ?? undefined,
    maxCredits: group.maxCredits ?? undefined,
    requirementGroup: group,
    requirementShape,
    selectedRequirementOptionIds: selectedRequirementOptionIds.length
      ? selectedRequirementOptionIds
      : undefined,
    unselectedRequirementOptionIds: unselectedRequirementOptionIds.length
      ? unselectedRequirementOptionIds
      : undefined,
    scheduleSelectedRequirementOptions:
      shouldScheduleSelectedRequirementGroupOptionsByDefault(group) || undefined,
    ...sourceMetadata,
    ...(hasMappedGrcCourses
      ? {}
      : {
          canCreateScheduleRow: false,
          reason:
            "Parser requirement group is visible from the official UW source, but no mapped Green River course is currently available for scheduling.",
        }),
  });
}

function getRequirementGroupChecklistItemsForPhase(
  planId: string,
  phase: TransferPlannerRequirementPhase,
  pathwayId?: string | null
) {
  if (phase !== "before-enrollment") {
    return [] as TransferPlannerChecklistItem[];
  }

  return getRequirementGroupsForScope(planId, pathwayId)
    .map(buildRequirementGroupChecklistItem)
    .filter((item): item is TransferPlannerChecklistItem => Boolean(item));
}

function buildRequirementGroupChecklistItemsByPhase(
  planId: string,
  pathwayId?: string | null
) {
  return {
    beforeApplication: [],
    beforeEnrollment: getRequirementGroupChecklistItemsForPhase(
      planId,
      "before-enrollment",
      pathwayId
    ),
    stayAtGrc: [],
  } satisfies ChecklistItemsByPhase;
}

function applyRequirementGroupSelectionsToCourseList(
  courseList: string[],
  planId: string,
  pathwayId?: string | null
) {
  const groups = getRequirementGroupsForScope(planId, pathwayId);
  if (!groups.length) {
    return courseList;
  }

  const optionCourseCodes = new Set(
    groups.flatMap(getRequirementGroupOptionGrcMatches).map((courseCode) => normalizeCourseCode(courseCode))
  );
  const selectedCourseCodes = new Set(
    groups.flatMap(getSelectedRequirementGroupGrcMatches).map((courseCode) => normalizeCourseCode(courseCode))
  );

  if (!optionCourseCodes.size) {
    return courseList;
  }

  return courseList.filter((courseCode) => {
    const normalizedCourseCode = normalizeCourseCode(courseCode);
    return !optionCourseCodes.has(normalizedCourseCode) || selectedCourseCodes.has(normalizedCourseCode);
  });
}

function buildComputingSequenceChecklistTitle(targetCourseCodes: string[]) {
  const normalizedCodes = uniquePlannerStrings(
    targetCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
  if (
    normalizedCodes.length === 3 &&
    normalizedCodes.every(
      (courseCode, index) => courseCode === COMPUTING_PREP_SEQUENCE_TARGET_CODES[index]
    )
  ) {
    return "CSE 121-123 programming sequence";
  }

  return "Programming sequence";
}

function buildDerivedRuntimeComputingPrepChecklistItems(scope: {
  planId: string;
  pathwayId?: string | null;
  automaticCourseList: string[];
  applicationChecklist: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist: TransferPlannerChecklistItem[];
  stayAtGrcChecklist: TransferPlannerChecklistItem[];
}) {
  const automaticCourseList = uniqueReferenceCourseLabels(scope.automaticCourseList ?? []);
  const automaticCourseCodeSet = new Set(
    automaticCourseList.map((courseCode) => normalizeCourseCode(courseCode))
  );

  if (!["CS 121", "CS 122", "CS 123"].every((courseCode) => automaticCourseCodeSet.has(courseCode))) {
    return buildEmptyChecklistItemsByPhase();
  }

  const existingChecklistCoverage = new Set(
    getChecklistReferenceCoursesFromItems([
      ...(scope.applicationChecklist ?? []),
      ...(scope.beforeEnrollmentChecklist ?? []),
      ...(scope.stayAtGrcChecklist ?? []),
    ]).map((courseCode) => normalizeCourseCode(courseCode))
  );
  if (
    [...existingChecklistCoverage].some((courseCode) =>
      isComputingPreparationCourse("grc", courseCode)
    )
  ) {
    return buildEmptyChecklistItemsByPhase();
  }

  const relevantCandidates = getParsedRequirementAtomCandidatesForScope(
    scope.planId,
    scope.pathwayId
  ).filter((candidate) =>
    COMPUTING_PREP_SEQUENCE_TARGET_CODES.includes(
      normalizeCourseCode(candidate.uwCourseCode) as (typeof COMPUTING_PREP_SEQUENCE_TARGET_CODES)[number]
    )
  );
  if (relevantCandidates.length < 2) {
    return buildEmptyChecklistItemsByPhase();
  }

  const relevantClassifications = getRequirementDiffClassificationsForScope(
    scope.planId,
    scope.pathwayId
  ).filter((classification) =>
    COMPUTING_PREP_SEQUENCE_TARGET_CODES.includes(
      normalizeCourseCode(classification.sourceUwCourseCode) as (typeof COMPUTING_PREP_SEQUENCE_TARGET_CODES)[number]
    )
  );
  const primaryParsedBlock =
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.find(
      (entry) =>
        entry.planId === scope.planId &&
        (scope.pathwayId ? entry.pathwayId === scope.pathwayId : !entry.pathwayId) &&
        canParsedRequirementSourceBlockCreateRequiredScheduleRows(entry)
    ) ??
    (scope.pathwayId
      ? TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.find(
          (entry) =>
            entry.planId === scope.planId &&
            !entry.pathwayId &&
            canParsedRequirementSourceBlockCreateRequiredScheduleRows(entry)
        )
      : null) ??
    null;
  const ownerTitle =
    relevantClassifications[0]?.majorTitle ??
    primaryParsedBlock?.ownerTitle ??
    scope.planId;

  const acceptedTargetCodes = new Set<string>();
  const acceptedCueLines = new Set<string>();
  const guideRulesById = new Map<
    string,
    {
      rule: (typeof TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY)[number];
      targetCourseCodes: Set<string>;
    }
  >();

  for (const targetCourseCode of COMPUTING_PREP_SEQUENCE_TARGET_CODES) {
    const guideRule = getPreferredGuideRuleWithSourceSets(targetCourseCode);
    if (guideRule) {
      const groupedEntry = guideRulesById.get(guideRule.id) ?? {
        rule: guideRule,
        targetCourseCodes: new Set<string>(),
      };
      groupedEntry.targetCourseCodes.add(targetCourseCode);
      guideRulesById.set(guideRule.id, groupedEntry);
    }

    const cueLines = uniquePlannerStrings([
      ...relevantCandidates
        .filter((candidate) => normalizeCourseCode(candidate.uwCourseCode) === targetCourseCode)
        .flatMap((candidate) => candidate.sourceLineHints ?? []),
      ...relevantClassifications
        .filter(
          (classification) => normalizeCourseCode(classification.sourceUwCourseCode) === targetCourseCode
        )
        .flatMap((classification) => getRequirementCueLinesFromClassification(classification)),
    ]);

    if (
      !cueLines.length ||
      !cueLines.some((line) => COMPUTING_PREP_KEYWORD_PATTERN.test(line))
    ) {
      continue;
    }

    acceptedTargetCodes.add(targetCourseCode);
    cueLines.forEach((line) => acceptedCueLines.add(line));
  }

  if (acceptedTargetCodes.size < 1) {
    return buildEmptyChecklistItemsByPhase();
  }

  if (COMPUTING_PREP_SCOPE_EXCLUSION_PATTERN.test([...acceptedCueLines].join(" "))) {
    return buildEmptyChecklistItemsByPhase();
  }

  const bestGuideRuleGroup =
    [...guideRulesById.values()]
      .map((entry) => {
        const bestSourceCourseSet =
          (entry.rule.sourceCourseSets ?? [])
            .map((sourceCourseSet) =>
              uniquePlannerStrings(
                (sourceCourseSet ?? [])
                  .map((courseCode) => normalizeCourseCode(courseCode))
                  .filter(
                    (courseCode) =>
                      automaticCourseCodeSet.has(courseCode) &&
                      isComputingPreparationCourse("grc", courseCode)
                  )
              )
            )
            .sort((left, right) => right.length - left.length)[0] ?? [];

        return {
          ...entry,
          bestSourceCourseSet,
        };
      })
      .filter(
        (entry) =>
          entry.targetCourseCodes.size >= 2 &&
          entry.bestSourceCourseSet.length >= 2 &&
          [...entry.targetCourseCodes].some((targetCourseCode) =>
            acceptedTargetCodes.has(targetCourseCode)
          )
      )
      .sort((left, right) => {
        const targetDelta = right.targetCourseCodes.size - left.targetCourseCodes.size;
        if (targetDelta !== 0) {
          return targetDelta;
        }
        const sourceDelta = right.bestSourceCourseSet.length - left.bestSourceCourseSet.length;
        if (sourceDelta !== 0) {
          return sourceDelta;
        }
        return left.rule.id.localeCompare(right.rule.id);
      })[0] ?? null;

  if (!bestGuideRuleGroup) {
    return buildEmptyChecklistItemsByPhase();
  }

  const primarySourceMetadata = getPrimaryGeneratedSourceMetadata(scope.planId, scope.pathwayId);
  const checklistSourceMetadata = {
    ...primarySourceMetadata,
    sourceUrl: primaryParsedBlock?.sourceUrl ?? primarySourceMetadata.sourceUrl ?? null,
    sourceRole: primaryParsedBlock?.sourceRole ?? primarySourceMetadata.sourceRole ?? null,
    sourceScope: "primary-schedulable",
    sourceSection: [...acceptedCueLines][0] ?? null,
    generatedFromParser: true,
    manualOverride: false,
    canCreateScheduleRow: true,
    reason: "Derived from scoped parser-backed computing preparation requirement cues.",
  } satisfies ChecklistSourceMetadata;
  const targetCourseCodeSet = new Set(bestGuideRuleGroup.targetCourseCodes);
  const checklistItem = sanitizeChecklistItem({
    id: buildAutoChecklistItemId(
      `${scope.planId}-${scope.pathwayId ?? "base"}-programming-sequence`,
      0
    ),
    title: buildComputingSequenceChecklistTitle([...targetCourseCodeSet]),
    grcCourses: bestGuideRuleGroup.bestSourceCourseSet,
    ...checklistSourceMetadata,
  });
  const phase = getDominantSourceBackedFallbackPhase(
    relevantClassifications.filter((classification) =>
      targetCourseCodeSet.has(normalizeCourseCode(classification.sourceUwCourseCode))
    ),
    relevantCandidates.filter((candidate) =>
      targetCourseCodeSet.has(normalizeCourseCode(candidate.uwCourseCode))
    ),
    "before-enrollment"
  );

  return {
    beforeApplication: phase === "before-application" ? [checklistItem] : [],
    beforeEnrollment: phase === "before-enrollment" ? [checklistItem] : [],
    stayAtGrc: phase === "stay-at-grc" ? [checklistItem] : [],
  } satisfies ChecklistItemsByPhase;
}

function getChecklistFallbackCourseList(scope: {
  grcCourseList?: string[];
  pathways?: TransferPlannerMajorPathway[];
}) {
  return uniqueReferenceCourseLabels([
    ...(scope.grcCourseList ?? []),
    ...((scope.pathways ?? []).flatMap((pathway) => pathway.grcCourseList ?? [])),
  ]);
}

function materializeSupplementalChecklistItem(
  seed: SupplementalChecklistSeed,
  courseFallbacks: string[],
  sourceMetadata: ChecklistSourceMetadata
) {
  const grcCourses = uniqueReferenceCourseLabels(
    seed.grcCourses?.length ? seed.grcCourses : courseFallbacks.slice(0, seed.fallbackCourseCount ?? 0)
  );
  const alternatives = (seed.alternatives ?? [])
    .map((group) => uniqueReferenceCourseLabels(group))
    .filter((group) => group.length > 0);
  const seedSourceMetadata = {
    ...sourceMetadata,
    sourceUrl: seed.sourceUrl ?? sourceMetadata.sourceUrl ?? null,
    sourceRole: seed.sourceRole ?? sourceMetadata.sourceRole ?? null,
    sourceScope: seed.sourceScope ?? sourceMetadata.sourceScope ?? null,
    sourceSection: seed.sourceSection ?? sourceMetadata.sourceSection ?? null,
    generatedFromParser: false,
    manualOverride: true,
    canCreateScheduleRow:
      seed.canCreateScheduleRow ??
      sourceMetadata.canCreateScheduleRow ??
      canGeneratedSourceRoleCreateScheduleRow(seed.sourceRole ?? sourceMetadata.sourceRole),
    reason:
      seed.reason ??
      "Manual generated checklist seed retained because it is backed by the selected primary source.",
  } satisfies ChecklistSourceMetadata;

  if (!grcCourses.length && !alternatives.length) {
    if (!seed.fallbackCourseCount) {
      return null;
    }

    return sanitizeChecklistItem({
      id: seed.id,
      title: seed.title,
      grcCourses: [],
      minCompletedCount: seed.minCompletedCount,
      note: seed.note,
      ...seedSourceMetadata,
    });
  }

  return sanitizeChecklistItem({
    id: seed.id,
    title: seed.title,
    grcCourses,
    alternatives: alternatives.length ? alternatives : undefined,
    minCompletedCount: seed.minCompletedCount,
    note: seed.note,
    ...seedSourceMetadata,
  });
}

function getPathwayScopedTrackMetadata(
  plan: Pick<
    TransferPlannerMajorPlan,
    "bestTrackId" | "recommendedTrackSummary" | "whyThisTrack"
  >,
  pathway: Pick<
    TransferPlannerMajorPathway,
    "bestTrackId" | "recommendedTrackSummary" | "whyThisTrack"
  >
) {
  const bestTrackId = pathway.bestTrackId ?? plan.bestTrackId;
  if (!bestTrackId) {
    return {
      bestTrackId: null,
      recommendedTrackSummary: "",
      whyThisTrack: [] as string[],
    };
  }

  return {
    bestTrackId,
    recommendedTrackSummary:
      pathway.bestTrackId == null
        ? plan.recommendedTrackSummary
        : (pathway.recommendedTrackSummary ?? plan.recommendedTrackSummary),
    whyThisTrack:
      pathway.bestTrackId == null || !(pathway.whyThisTrack?.length ?? 0)
        ? [...(plan.whyThisTrack ?? [])]
        : [...(pathway.whyThisTrack ?? [])],
  };
}

function buildSupplementalChecklistItems(scope: {
  id: string;
  grcCourseList?: string[];
  pathways?: TransferPlannerMajorPathway[];
}) {
  const checklistItems = buildEmptyChecklistItemsByPhase();
  const seeds = SUPPLEMENTAL_CHECKLIST_SEEDS_BY_PLAN[scope.id] ?? [];
  const fallbackCourseList = getChecklistFallbackCourseList(scope);
  const sourceMetadata = getPrimaryGeneratedSourceMetadata(scope.id, null);

  for (const seed of seeds) {
    const item = materializeSupplementalChecklistItem(seed, fallbackCourseList, sourceMetadata);
    if (!item) {
      continue;
    }

    if (seed.phase === "before-application") {
      checklistItems.beforeApplication.push(item);
      continue;
    }
    if (seed.phase === "before-enrollment") {
      checklistItems.beforeEnrollment.push(item);
      continue;
    }
    checklistItems.stayAtGrc.push(item);
  }

  return checklistItems;
}

function applyChecklistItemsByPhase<T extends {
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
}>(scope: T, checklistItems: ChecklistItemsByPhase): T {
  return {
    ...scope,
    applicationChecklist: appendUniqueChecklistItems(
      scope.applicationChecklist,
      checklistItems.beforeApplication
    ),
    beforeEnrollmentChecklist: appendUniqueChecklistItems(
      scope.beforeEnrollmentChecklist,
      checklistItems.beforeEnrollment
    ),
    stayAtGrcChecklist: appendUniqueChecklistItems(
      scope.stayAtGrcChecklist,
      checklistItems.stayAtGrc
    ),
  };
}

function buildSourceGeneratedFallbackChecklistItems(scope: {
  id: string;
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
  degreeMapSections?: TransferPlannerDegreeMapSection[];
  officialLinks?: TransferPlannerLink[];
  grcCourseList?: string[];
  pathways?: TransferPlannerMajorPathway[];
}) {
  if (hasAnyChecklistItems(scope)) {
    return buildEmptyChecklistItemsByPhase();
  }

  const [fallbackCourse = null] = getChecklistFallbackCourseList(scope);
  const sourceMetadata = {
    ...getPrimaryGeneratedSourceMetadata(scope.id, null),
    generatedFromParser: false,
    manualOverride: false,
    sourceScope: "generated-source-backed-fallback",
    reason: "Generated fallback checklist row retained only when source-generated data had no checklist rows.",
  } satisfies ChecklistSourceMetadata;
  if (fallbackCourse) {
    return {
      beforeApplication: [],
      beforeEnrollment: [
        sanitizeChecklistItem({
          id: buildAutoChecklistItemId(`${scope.id}-source-backed-course`, 0),
          title: fallbackCourse,
          grcCourses: [fallbackCourse],
          ...sourceMetadata,
        }),
      ],
      stayAtGrc: [],
    } satisfies ChecklistItemsByPhase;
  }

  const hasStructuredEvidence = Boolean(
    (scope.degreeMapSections?.length ?? 0) > 0 || (scope.officialLinks?.length ?? 0) > 0
  );
  if (!hasStructuredEvidence) {
    return buildEmptyChecklistItemsByPhase();
  }

  return {
    beforeApplication: [],
    beforeEnrollment: [
      sanitizeChecklistItem({
        id: buildAutoChecklistItemId(`${scope.id}-source-backed-guidance`, 0),
        title: SOURCE_GENERATED_PARSER_FALLBACK_TITLE,
        grcCourses: [],
        note: SOURCE_GENERATED_PARSER_FALLBACK_NOTE,
        ...sourceMetadata,
      }),
    ],
    stayAtGrc: [],
  } satisfies ChecklistItemsByPhase;
}

function hasStructuredPlannerMaterial(
  planId: string,
  pathwayId: string | null | undefined,
  scope: {
    applicationChecklist?: TransferPlannerChecklistItem[];
    beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
    stayAtGrcChecklist?: TransferPlannerChecklistItem[];
    degreeMapSections?: TransferPlannerDegreeMapSection[];
    grcCourseList?: string[];
    pathways?: TransferPlannerMajorPathway[];
  }
) {
  const scopeKey = makePathwayPlanKey(planId, pathwayId);
  const hasChecklistItems = hasAnyChecklistItems(scope);
  const hasCourseEvidence = getChecklistFallbackCourseList(scope).length > 0;
  const hasDegreeMapEvidence =
    (scope.degreeMapSections?.length ?? 0) > 0 || (DEGREE_MAPS_BY_KEY.get(scopeKey)?.length ?? 0) > 0;

  return hasDegreeMapEvidence && (hasChecklistItems || hasCourseEvidence);
}

function promoteStructuredCoverage<T extends {
  id: string;
  coverage: "detailed" | "partial";
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
  degreeMapSections?: TransferPlannerDegreeMapSection[];
  grcCourseList?: string[];
  pathways?: TransferPlannerMajorPathway[];
}>(scope: T, pathwayId?: string | null): T {
  if (scope.coverage === "detailed") {
    return scope;
  }

  if (!hasStructuredPlannerMaterial(scope.id, pathwayId, scope)) {
    return scope;
  }

  return {
    ...scope,
    coverage: "detailed",
  };
}

function buildSourceBackedFallbackGuidanceChecklists(
  phase: TransferPlannerRequirementPhase,
  scope: {
    planId: string;
    pathwayId?: string | null;
  }
) {
  const checklists = buildEmptySourceBackedFallbackChecklists();
  const sourceMetadata = {
    ...getPrimaryGeneratedSourceMetadata(scope.planId, scope.pathwayId),
    generatedFromParser: false,
    manualOverride: false,
    canCreateScheduleRow: false,
    reason: "Generated source-backed guidance placeholder; it does not create a scheduled row.",
  } satisfies ChecklistSourceMetadata;
  addFallbackChecklistItemForPhase(checklists, phase, {
    id: buildAutoChecklistItemId(`source-guidance-${scope.planId}-${scope.pathwayId ?? "base"}`, 0),
    title: AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_TITLE,
    grcCourses: [],
    note: AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_NOTE,
    ...sourceMetadata,
  });
  return checklists;
}

function buildStrictSourceBackedFallbackChecklists(scope: {
  planId: string;
  pathwayId?: string | null;
  includeParsedCandidates: boolean;
  strongParsedCandidatesOnly?: boolean;
}) {
  const classifications = getRequirementDiffClassificationsForScope(scope.planId, scope.pathwayId);
  const supportsStrictFallback =
    classifications.length > 0 &&
    classifications.every(
      (entry) => entry.classificationKind === "source-backed-choice-set-no-public-grc-path"
    );

  const candidateByCode = new Map<
    string,
    {
      displayCode: string;
      candidate: TransferPlannerParsedRequirementAtomCandidate;
    }
  >();
  for (const candidate of getParsedRequirementAtomCandidatesForScope(scope.planId, scope.pathwayId)) {
    const normalizedCode = normalizeCourseCode(candidate.uwCourseCode);
    const codeIdentity = getSourceBackedFallbackCodeIdentity(normalizedCode);
    if (!normalizedCode || !codeIdentity) {
      continue;
    }
    if (scope.strongParsedCandidatesOnly) {
      if (
        !hasStrongRequiredSourceBackedFallbackCue(candidate) ||
        hasGuideBackedGreenRiverPath(normalizedCode)
      ) {
        continue;
      }
    }

    const existing = candidateByCode.get(codeIdentity) ?? null;
    if (
      !existing ||
      shouldPreferSourceBackedFallbackDisplayCode(normalizedCode, existing.displayCode)
    ) {
      candidateByCode.set(codeIdentity, {
        displayCode: normalizedCode,
        candidate,
      });
    }
  }

  const classificationByCode = new Map<
    string,
    {
      displayCode: string;
      classification: TransferPlannerRequirementDiffClassificationEntry;
    }
  >();
  for (const classification of classifications) {
    const normalizedCode = normalizeCourseCode(classification.sourceUwCourseCode);
    const codeIdentity = getSourceBackedFallbackCodeIdentity(normalizedCode);
    if (!normalizedCode || !codeIdentity) {
      continue;
    }

    const existing = classificationByCode.get(codeIdentity) ?? null;
    if (
      !existing ||
      shouldPreferSourceBackedFallbackDisplayCode(normalizedCode, existing.displayCode)
    ) {
      classificationByCode.set(codeIdentity, {
        displayCode: normalizedCode,
        classification,
      });
    }
  }

  const supportsParsedFallback =
    scope.includeParsedCandidates && (candidateByCode.size > 0 || classificationByCode.size > 0);

  if (!supportsStrictFallback && !supportsParsedFallback) {
    return buildEmptySourceBackedFallbackChecklists();
  }

  const codeIdentitiesToInspect = new Set<string>();
  if (supportsStrictFallback || supportsParsedFallback) {
    for (const codeIdentity of classificationByCode.keys()) {
      codeIdentitiesToInspect.add(codeIdentity);
    }
  }
  if (supportsParsedFallback) {
    for (const codeIdentity of candidateByCode.keys()) {
      codeIdentitiesToInspect.add(codeIdentity);
    }
  }

  const dominantPhase = getDominantSourceBackedFallbackPhase(
    classifications,
    [...candidateByCode.values()].map((entry) => entry.candidate),
    supportsStrictFallback ? "before-enrollment" : "stay-at-grc"
  );
  const checklists = buildEmptySourceBackedFallbackChecklists();

  const orderedCodeIdentities = [...codeIdentitiesToInspect].sort((left, right) => {
    const leftCode = pickPreferredSourceBackedFallbackDisplayCode(
      candidateByCode.get(left)?.displayCode,
      classificationByCode.get(left)?.displayCode,
      left
    );
    const rightCode = pickPreferredSourceBackedFallbackDisplayCode(
      candidateByCode.get(right)?.displayCode,
      classificationByCode.get(right)?.displayCode,
      right
    );
    const levelDelta =
      (getSourceBackedFallbackCourseLevel(leftCode) ?? Number.MAX_SAFE_INTEGER) -
      (getSourceBackedFallbackCourseLevel(rightCode) ?? Number.MAX_SAFE_INTEGER);
    if (levelDelta !== 0) {
      return levelDelta;
    }
    return leftCode.localeCompare(rightCode);
  });

  for (const codeIdentity of orderedCodeIdentities) {
    const classificationRecord = classificationByCode.get(codeIdentity) ?? null;
    const candidateRecord = candidateByCode.get(codeIdentity) ?? null;
    const normalizedCode = pickPreferredSourceBackedFallbackDisplayCode(
      candidateRecord?.displayCode,
      classificationRecord?.displayCode,
      codeIdentity
    );
    const classification = classificationRecord?.classification ?? null;
    const candidate = candidateRecord?.candidate ?? null;
    if (
      scope.strongParsedCandidatesOnly &&
      (!candidate ||
        !hasStrongRequiredSourceBackedFallbackCue(candidate) ||
        hasGuideBackedGreenRiverPath(normalizedCode))
    ) {
      continue;
    }
    if (!isDisplayableSourceBackedFallbackCode(normalizedCode, candidate)) {
      continue;
    }

    const requirementCueLines = uniquePlannerStrings([
      ...(candidate?.sourceLineHints ?? []),
      ...(classification ? getRequirementCueLinesFromClassification(classification) : []),
    ]);

    if (
      shouldExcludeSourceBackedFallbackCode({
        code: normalizedCode,
        requirementCueLines,
        allCandidateCodes: new Set(
          [...codeIdentitiesToInspect]
            .map((identity) =>
              pickPreferredSourceBackedFallbackDisplayCode(
                candidateByCode.get(identity)?.displayCode,
                classificationByCode.get(identity)?.displayCode,
                identity
              )
            )
            .filter(Boolean)
        ),
      })
    ) {
      continue;
    }

    const phase = classification?.displayPhase ?? dominantPhase;
    addFallbackChecklistItemForPhase(checklists, phase, {
      id: buildAutoChecklistItemId(`uw-prep-${normalizedCode}`, 0),
      title: `${AUTO_SOURCE_BACKED_UW_PREP_TARGET_PREFIX} ${normalizedCode}`,
      grcCourses: [],
      note: AUTO_SOURCE_BACKED_UW_PREP_TARGET_NOTE,
      ...getChecklistSourceMetadata(
        {
          id: `uw-prep-${normalizedCode}`,
          title: `${AUTO_SOURCE_BACKED_UW_PREP_TARGET_PREFIX} ${normalizedCode}`,
          grcCourseCodes: [],
          alternativeCourseCodeSets: [],
          note: AUTO_SOURCE_BACKED_UW_PREP_TARGET_NOTE,
          generatedFromParser: true,
          manualOverride: false,
          canCreateScheduleRow: false,
          reason: "Generated UW-only prep placeholder; it does not create a scheduled GRC row.",
        },
        getPrimaryGeneratedSourceMetadata(scope.planId, scope.pathwayId)
      ),
    });
  }

  const totalFallbackTargets =
    checklists.beforeApplication.length +
    checklists.beforeEnrollment.length +
    checklists.stayAtGrc.length;
  if (
    supportsParsedFallback &&
    !supportsStrictFallback &&
    totalFallbackTargets > MAX_SOURCE_BACKED_UW_PREP_TARGET_COUNT
  ) {
    return buildSourceBackedFallbackGuidanceChecklists(dominantPhase, scope);
  }

  if (
    checklists.beforeApplication.length ||
    checklists.beforeEnrollment.length ||
    checklists.stayAtGrc.length
  ) {
    return checklists;
  }

  return buildSourceBackedFallbackGuidanceChecklists(dominantPhase, scope);
}

function applyStrictSourceBackedFallback<T extends {
  id: string;
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
  grcCourseList?: string[];
}>(scope: T, pathwayId?: string | null): T {
  const hasExistingChecklistCoverage = hasAnyChecklistItems(scope);
  const hasExistingCourseListCoverage = Boolean(scope.grcCourseList?.length);
  const shouldTryStrongSupplementalFallback =
    hasExistingChecklistCoverage || hasExistingCourseListCoverage;
  const fallbackChecklists = buildStrictSourceBackedFallbackChecklists({
    planId: scope.id,
    pathwayId,
    includeParsedCandidates:
      (!hasExistingChecklistCoverage && !hasExistingCourseListCoverage) ||
      shouldTryStrongSupplementalFallback,
    strongParsedCandidatesOnly: shouldTryStrongSupplementalFallback,
  });

  if (
    !fallbackChecklists.beforeApplication.length &&
    !fallbackChecklists.beforeEnrollment.length &&
    !fallbackChecklists.stayAtGrc.length
  ) {
    return scope;
  }

  return {
    ...scope,
    applicationChecklist: appendUniqueChecklistItems(
      scope.applicationChecklist,
      fallbackChecklists.beforeApplication
    ),
    beforeEnrollmentChecklist: appendUniqueChecklistItems(
      scope.beforeEnrollmentChecklist,
      fallbackChecklists.beforeEnrollment
    ),
    stayAtGrcChecklist: appendUniqueChecklistItems(
      scope.stayAtGrcChecklist,
      fallbackChecklists.stayAtGrc
    ),
  };
}

function collectPlannerCourseLabels(scope: {
  grcCourseList?: string[];
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
}) {
  const checklistLabels = uniqueReferenceCourseLabels(
    getChecklistReferenceCoursesFromItems([
      ...(scope.applicationChecklist ?? []),
      ...(scope.beforeEnrollmentChecklist ?? []),
      ...(scope.stayAtGrcChecklist ?? []),
    ])
  );

  const checklistGrcLabels = filterCanonicalGrcCourseLabels(checklistLabels);
  if (checklistGrcLabels.length) {
    return checklistGrcLabels;
  }

  return filterCanonicalGrcCourseLabels([...(scope.grcCourseList ?? [])]);
}

function buildReferenceLabelByCode(labels: string[]) {
  const labelByCode = new Map<string, string>();

  for (const label of labels) {
    for (const code of extractReferenceCourseCodes(label)) {
      if (!labelByCode.has(code)) {
        labelByCode.set(code, label);
      }
    }
  }

  return labelByCode;
}

function shouldUseTrackTermForAutoMatch(termLabel: string) {
  return !AUTO_MATCH_EXCLUDED_TRACK_TERM_LABEL_PATTERN.test(String(termLabel ?? "").trim());
}

function normalizeAutoTrackSubjectPrefix(prefix: string) {
  return String(prefix ?? "").replace(/&/g, "").trim().toUpperCase();
}

function getAutoTrackSubjectPrefix(courseCode: string) {
  return normalizeAutoTrackSubjectPrefix(getReferenceCourseSubjectPrefix(courseCode));
}

function buildAutoTrackSubjectAffinityCounts(planCourseCodes: string[]) {
  const subjectCounts = new Map<string, number>();

  for (const courseCode of planCourseCodes) {
    const subjectPrefix = getAutoTrackSubjectPrefix(courseCode);
    if (!subjectPrefix || AUTO_TRACK_GENERIC_SUBJECT_PREFIXES.has(subjectPrefix)) {
      continue;
    }

    subjectCounts.set(subjectPrefix, (subjectCounts.get(subjectPrefix) ?? 0) + 1);
  }

  const strongSubjectCounts = [...subjectCounts.entries()].filter(
    ([subjectPrefix, count]) =>
      count >= MIN_RELAXED_AUTO_TRACK_MATCH_COUNT &&
      !AUTO_TRACK_CONTEXTUAL_SUBJECT_PREFIXES.has(subjectPrefix)
  );

  if (strongSubjectCounts.length) {
    return new Map(strongSubjectCounts);
  }

  const contextualSubjectCounts = [...subjectCounts.entries()].filter(
    ([, count]) => count >= MIN_RELAXED_AUTO_TRACK_MATCH_COUNT
  );

  if (contextualSubjectCounts.length) {
    return new Map(contextualSubjectCounts);
  }

  if (planCourseCodes.length <= MIN_AUTO_TRACK_MATCH_COUNT) {
    return new Map(
      [...subjectCounts.entries()].filter(
        ([subjectPrefix]) => !AUTO_TRACK_CONTEXTUAL_SUBJECT_PREFIXES.has(subjectPrefix)
      )
    );
  }

  return new Map<string, number>();
}

function getTrackSubjectAffinityScore(
  track: TransferPlannerTrack,
  subjectCounts: Map<string, number>
) {
  if (!subjectCounts.size) {
    return 0;
  }

  const trackSearchText = [
    track.code,
    track.title,
    track.id,
    ...(track.bestFor ?? []),
  ].join(" ");

  return AUTO_TRACK_SUBJECT_AFFINITY_RULES.reduce((score, rule) => {
    if (!rule.pattern.test(trackSearchText)) {
      return score;
    }

    return (
      score +
      rule.prefixes.reduce(
        (prefixScore, prefix) =>
          prefixScore + (subjectCounts.get(normalizeAutoTrackSubjectPrefix(prefix)) ?? 0),
        0
      )
    );
  }, 0);
}

function isEngineeringDisciplineText(text: string) {
  return /\bengineering\b|\bbioengineering\b/i.test(text);
}

function getEngineeringDisciplineMatches(text: string) {
  const normalizedText = String(text ?? "").trim();
  if (!normalizedText || !isEngineeringDisciplineText(normalizedText)) {
    return [] as typeof AUTO_TRACK_ENGINEERING_DISCIPLINE_RULES;
  }

  return AUTO_TRACK_ENGINEERING_DISCIPLINE_RULES.filter((rule) =>
    rule.pattern.test(normalizedText)
  );
}

function getTrackEngineeringDisciplineAffinity(
  track: TransferPlannerTrack,
  majorTitle?: string | null
) {
  const majorMatches = getEngineeringDisciplineMatches(majorTitle ?? "");
  if (!majorMatches.length) {
    return {
      score: 0,
      matchedLabels: [] as string[],
    };
  }

  const trackSearchText = [
    track.code,
    track.title,
    track.id,
    ...(track.bestFor ?? []),
  ].join(" ");
  const trackMatches = getEngineeringDisciplineMatches(trackSearchText);
  if (!trackMatches.length) {
    return {
      score: 0,
      matchedLabels: [] as string[],
    };
  }

  const trackMatchIds = new Set(trackMatches.map((rule) => rule.id));
  const matchedLabels = majorMatches
    .filter((rule) => trackMatchIds.has(rule.id))
    .map((rule) => rule.label);

  if (matchedLabels.length) {
    return {
      score: matchedLabels.length * AUTO_TRACK_ENGINEERING_DISCIPLINE_AFFINITY_WEIGHT,
      matchedLabels,
    };
  }

  return {
    score: -AUTO_TRACK_ENGINEERING_DISCIPLINE_MISMATCH_PENALTY,
    matchedLabels,
  };
}

function buildTrackReferenceCourseCodes(
  track: TransferPlannerTrack,
  options: {
    includeCatalogYears?: boolean;
    autoMatchOnly?: boolean;
  } = {}
) {
  const includeCatalogYears = options.includeCatalogYears ?? true;
  const filterTerms = (terms: TransferPlannerTrack["terms"]) =>
    (
      options.autoMatchOnly
        ? terms.filter((term) => shouldUseTrackTermForAutoMatch(term.label))
        : terms
    ).flatMap((term) => term.courses);

  return uniqueReferenceCourseLabels(
    [
      ...filterTerms(track.terms),
      ...(includeCatalogYears
        ? (track.catalogYears ?? []).flatMap((catalogYear) => [
            ...filterTerms(catalogYear.terms),
            ...(catalogYear.slotExpansions ?? []).flatMap((slot) => slot.recommendedCourses),
          ])
        : []),
    ].flatMap((label) => extractReferenceCourseCodes(label))
  );
}

type TransferPlannerAutoMatchedTrackRecommendation = {
  trackId: string;
  recommendedTrackSummary: string;
  whyThisTrack: string[];
  matchCount: number;
  matchedCourseCodes: string[];
  matchedCourseLabels: string[];
  disciplineMatchedLabels: string[];
  totalPlanCourseCount: number;
  totalTrackCourseCount: number;
};

function buildAutoTrackRecommendationSummary(scope: {
  track: TransferPlannerTrack;
  matchCount: number;
  totalPlanCourseCount: number;
}) {
  return `${scope.track.code} is the current closest Green River transfer path for this degree because it matches ${scope.matchCount} of the ${scope.totalPlanCourseCount} degree-specific Green River classes currently tracked for this major.`;
}

function buildAutoTrackWhyThisTrack(scope: {
  track: TransferPlannerTrack;
  matchedCourseLabels: string[];
  disciplineMatchedLabels?: string[];
  matchCount: number;
  totalTrackCourseCount: number;
}) {
  const matchedExamples = scope.matchedCourseLabels.slice(0, AUTO_TRACK_MATCH_EXAMPLE_LIMIT);
  const remainingCount = Math.max(scope.matchedCourseLabels.length - matchedExamples.length, 0);
  const examplesLabel = matchedExamples.join(", ");
  const examplesNote = matchedExamples.length
    ? `, including ${examplesLabel}${remainingCount > 0 ? `, plus ${remainingCount} more` : ""}`
    : "";

  const disciplineNote = scope.disciplineMatchedLabels?.length
    ? [
        `The matched track title also aligns with ${scope.disciplineMatchedLabels.join(
          ", "
        )}.`,
      ]
    : [];

  return [
    `${scope.track.code} has the strongest direct overlap with the current degree-specific Green River class list${examplesNote}.`,
    ...disciplineNote,
    `This auto-match compares every hardcoded course in the current Green River transfer tracks against the major's tracked Green River classes and keeps the track with the highest concrete course overlap.`,
    `Use the remaining major-specific checklist items to add the classes that ${scope.track.code} does not cover by itself.`,
  ];
}

export function getTransferPlannerAutoMatchedTrackRecommendation(
  grcCourseList: string[],
  preferredTrackId: string | null = null,
  options: {
    majorTitle?: string | null;
  } = {}
): TransferPlannerAutoMatchedTrackRecommendation | null {
  const normalizedCourseLabels = uniqueReferenceCourseLabels(grcCourseList);
  const planCourseCodes = uniqueReferenceCourseLabels(
    normalizedCourseLabels.flatMap((label) => extractReferenceCourseCodes(label))
  );

  if (!planCourseCodes.length) {
    return null;
  }

  const planCourseCodeSet = new Set(planCourseCodes);
  const labelByCode = buildReferenceLabelByCode(normalizedCourseLabels);
  const subjectAffinityCounts = buildAutoTrackSubjectAffinityCounts(planCourseCodes);
  const scoredTrackCandidates = TRANSFER_PLANNER_BOOTSTRAP_TRACKS.map((track) => {
    const trackCourseCodes = TRACK_REFERENCE_CODES_BY_ID.get(track.id) ?? [];
    const matchedCourseCodes = trackCourseCodes.filter((code) => planCourseCodeSet.has(code));
    const subjectAffinityScore = getTrackSubjectAffinityScore(track, subjectAffinityCounts);
    const engineeringDisciplineAffinity = getTrackEngineeringDisciplineAffinity(
      track,
      options.majorTitle
    );
    return {
      track,
      trackCourseCodes,
      matchedCourseCodes,
      matchedCourseLabels: uniquePlannerStrings(
        matchedCourseCodes.map((code) => labelByCode.get(code) ?? code)
      ),
      matchCount: matchedCourseCodes.length,
      planCoverage: matchedCourseCodes.length / planCourseCodes.length,
      trackCoverage: matchedCourseCodes.length / Math.max(trackCourseCodes.length, 1),
      subjectAffinityScore,
      engineeringDisciplineAffinityScore: engineeringDisciplineAffinity.score,
      engineeringDisciplineMatchedLabels: engineeringDisciplineAffinity.matchedLabels,
      rankingScore:
        matchedCourseCodes.length +
        subjectAffinityScore * AUTO_TRACK_SUBJECT_AFFINITY_WEIGHT +
        engineeringDisciplineAffinity.score,
      preferred: track.id === preferredTrackId,
    };
  });

  const minimumMatchCount = MIN_AUTO_TRACK_MATCH_COUNT;
  let scoredTracks = scoredTrackCandidates.filter(
    (entry) => entry.matchCount >= minimumMatchCount
  );

  // For plans without a curated preferred track, keep a best-effort auto-match even
  // when a small but non-trivial source-backed course overlap is currently available.
  if (!scoredTracks.length && !preferredTrackId) {
    scoredTracks = scoredTrackCandidates.filter(
      (entry) =>
        entry.matchCount >= MIN_RELAXED_AUTO_TRACK_MATCH_COUNT &&
        entry.planCoverage >= MIN_RELAXED_AUTO_TRACK_PLAN_COVERAGE
    );
  }

  if (!scoredTracks.length) {
    return null;
  }

  scoredTracks.sort((left, right) => {
    if (right.rankingScore !== left.rankingScore) {
      return right.rankingScore - left.rankingScore;
    }
    if (right.matchCount !== left.matchCount) {
      return right.matchCount - left.matchCount;
    }
    if (right.planCoverage !== left.planCoverage) {
      return right.planCoverage - left.planCoverage;
    }
    if (right.trackCoverage !== left.trackCoverage) {
      return right.trackCoverage - left.trackCoverage;
    }
    if (left.preferred !== right.preferred) {
      return Number(right.preferred) - Number(left.preferred);
    }
    return left.track.id.localeCompare(right.track.id);
  });

  const winner = scoredTracks[0];

  return {
    trackId: winner.track.id,
    recommendedTrackSummary: buildAutoTrackRecommendationSummary({
      track: winner.track,
      matchCount: winner.matchCount,
      totalPlanCourseCount: planCourseCodes.length,
    }),
    whyThisTrack: buildAutoTrackWhyThisTrack({
      track: winner.track,
      matchedCourseLabels: winner.matchedCourseLabels,
      disciplineMatchedLabels: winner.engineeringDisciplineMatchedLabels,
      matchCount: winner.matchCount,
      totalTrackCourseCount: winner.trackCourseCodes.length,
    }),
    matchCount: winner.matchCount,
    matchedCourseCodes: [...winner.matchedCourseCodes],
    matchedCourseLabels: [...winner.matchedCourseLabels],
    disciplineMatchedLabels: [...winner.engineeringDisciplineMatchedLabels],
    totalPlanCourseCount: planCourseCodes.length,
    totalTrackCourseCount: winner.trackCourseCodes.length,
  };
}

function applyAutoTrackRecommendation<T extends {
  title?: string;
  label?: string;
  bestTrackId: string | null | undefined;
  recommendedTrackSummary?: string;
  whyThisTrack?: string[];
  grcCourseList?: string[];
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
}>(
  scope: T,
  options?: {
    trackMatchCourseList?: string[];
    fallbackTrackMatchCourseList?: string[];
    majorTitle?: string | null;
  }
): T {
  const primaryTrackMatchCourseList = options?.trackMatchCourseList?.length
    ? filterCanonicalGrcCourseLabels(options.trackMatchCourseList)
    : collectPlannerCourseLabels(scope);
  const autoTrack = getTransferPlannerAutoMatchedTrackRecommendation(
    primaryTrackMatchCourseList,
    scope.bestTrackId ?? null,
    {
      majorTitle: options?.majorTitle ?? scope.title ?? scope.label ?? null,
    }
  ) ?? (options?.fallbackTrackMatchCourseList?.length
    ? getTransferPlannerAutoMatchedTrackRecommendation(
        filterCanonicalGrcCourseLabels(options.fallbackTrackMatchCourseList),
        scope.bestTrackId ?? null,
        {
          majorTitle: options?.majorTitle ?? scope.title ?? scope.label ?? null,
        }
      )
    : null);

  if (!autoTrack) {
    return scope;
  }

  const currentSummary = String(scope.recommendedTrackSummary ?? "").trim();
  const shouldRefreshAutoTrackCopy =
    !currentSummary || AUTO_TRACK_RECOMMENDATION_SUMMARY_PATTERN.test(currentSummary);

  if (scope.bestTrackId === autoTrack.trackId && !shouldRefreshAutoTrackCopy) {
    return scope;
  }

  return {
    ...scope,
    bestTrackId: autoTrack.trackId,
    recommendedTrackSummary: autoTrack.recommendedTrackSummary,
    whyThisTrack: [...autoTrack.whyThisTrack],
  };
}

function applyAutoTrackRecommendationFromStudentVisibleList<T extends {
  title?: string;
  label?: string;
  id?: string;
  bestTrackId: string | null | undefined;
  recommendedTrackSummary?: string;
  whyThisTrack?: string[];
  grcCourseList?: string[];
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
}>(
  scope: T,
  options: {
    trackMatchCourseList?: string[];
    studentVisibleCourseList?: string[];
    majorTitle?: string | null;
  } = {}
): T {
  const visibleCourseList = options.studentVisibleCourseList?.length
    ? filterCanonicalGrcCourseLabels(options.studentVisibleCourseList)
    : filterCanonicalGrcCourseLabels([
        ...(scope.grcCourseList ?? []),
        ...getChecklistReferenceCoursesFromItems([
          ...(scope.applicationChecklist ?? []),
          ...(scope.beforeEnrollmentChecklist ?? []),
          ...(scope.stayAtGrcChecklist ?? []),
        ]),
      ]);

  return applyAutoTrackRecommendation(scope, {
    trackMatchCourseList: options.trackMatchCourseList,
    fallbackTrackMatchCourseList: visibleCourseList,
    majorTitle: options.majorTitle ?? scope.title ?? scope.label ?? null,
  });
}

function applyCuratedComputerEngineeringTrack<T extends {
  id?: string;
  title?: string;
  label?: string;
  bestTrackId: string | null | undefined;
  recommendedTrackSummary?: string;
  whyThisTrack?: string[];
}>(scope: T, planId: string): T {
  if (planId !== UW_SEATTLE_COMPUTER_ENGINEERING_PLAN_ID) {
    return scope;
  }

  const track = TRANSFER_PLANNER_BOOTSTRAP_TRACKS.find(
    (entry) => entry.id === UW_SEATTLE_COMPUTER_ENGINEERING_TRANSFER_TRACK_ID
  );
  if (!track || scope.bestTrackId === track.id) {
    return scope;
  }

  return {
    ...scope,
    bestTrackId: track.id,
    recommendedTrackSummary:
      `${track.code} is the Green River engineering transfer path used for UW Seattle Computer Engineering because it is the Computer and Electrical Engineering AST-2/MRP pathway.`,
    whyThisTrack: [
      `${track.code} keeps the Computer and Electrical Engineering transfer track aligned with the official Computer Engineering lower-division math, physics, and engineering requirements.`,
      "Use the remaining Computer Engineering checklist items for source-backed UW requirements that the Green River track does not cover by itself.",
    ],
  };
}

function buildDegreeMapSection(block: TransferPlannerDegreeMapBlock): TransferPlannerDegreeMapSection {
  return sanitizeDegreeMapSection({
    id: extractLeafId(block.id),
    title: block.title,
    items: [...block.itemLabels],
    note: block.note,
  });
}

function appendSourceBackedBioengineeringGeneralEducationSection(
  planId: string,
  sections: TransferPlannerDegreeMapSection[] | undefined
) {
  if (planId !== UW_SEATTLE_BIOENGINEERING_PLAN_ID) {
    return sections;
  }

  const section = sanitizeDegreeMapSection(
    UW_SEATTLE_BIOENGINEERING_SOURCE_BACKED_GEN_ED_SECTION
  );
  return [
    ...(sections ?? []).filter((entry) => entry.id !== section.id),
    section,
  ];
}

const REQUIREMENTS_BY_KEY = new Map<PathwayPlanKey, TransferPlannerMajorRequirementAtom[]>();
for (const requirement of TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY) {
  const key = makePathwayPlanKey(requirement.planId, requirement.pathwayId);
  const current = REQUIREMENTS_BY_KEY.get(key) ?? [];
  current.push(requirement);
  REQUIREMENTS_BY_KEY.set(key, current);
}

const DEGREE_MAPS_BY_KEY = new Map<PathwayPlanKey, TransferPlannerDegreeMapBlock[]>();
for (const block of TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY) {
  const key = makePathwayPlanKey(block.planId, block.pathwayId);
  const current = DEGREE_MAPS_BY_KEY.get(key) ?? [];
  current.push(block);
  DEGREE_MAPS_BY_KEY.set(key, current);
}

const POLICIES_BY_KEY = new Map<PathwayPlanKey, TransferPlannerPolicyEntry>();
for (const policy of TRANSFER_PLANNER_POLICY_REGISTRY) {
  POLICIES_BY_KEY.set(makePathwayPlanKey(policy.planId, policy.pathwayId), policy);
}

const PATHWAYS_BY_PLAN = new Map<string, TransferPlannerMajorPathwayEntry[]>();
for (const pathway of TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY) {
  const current = PATHWAYS_BY_PLAN.get(pathway.planId) ?? [];
  current.push(pathway);
  PATHWAYS_BY_PLAN.set(pathway.planId, current);
}

function getRegistryPathwayEntry(planId: string, pathwayId: string) {
  return PATHWAYS_BY_PLAN.get(planId)?.find((entry) => entry.pathwayId === pathwayId) ?? null;
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
const COMPUTING_PREP_KEYWORD_PATTERN =
  /\b(programming|computer programming|computer science|computing|data programming|software)\b/i;
const COMPUTING_PREP_SCOPE_EXCLUSION_PATTERN =
  /\b(recommended from list|one course from the following list|technical electives?)\b/i;
const COMPUTING_PREP_SEQUENCE_TARGET_CODES = ["CSE 121", "CSE 122", "CSE 123"] as const;

function stripPathwayTitleSuffix(value: string) {
  let stripped = sanitizePlannerOwnedText(value);
  for (const pattern of PATHWAY_TITLE_SUFFIX_PATTERNS) {
    stripped = stripped.replace(pattern, "").trim();
  }
  return stripped;
}

function stripPlanTitlePrefix(planTitle: string, value: string) {
  return stripTransferPlannerPlanTitlePrefix(planTitle, value);

  const sanitizedPlanTitle = sanitizePlannerOwnedText(planTitle);
  const sanitizedValue = sanitizePlannerOwnedText(value);
  if (!sanitizedPlanTitle) {
    return sanitizedValue;
  }
  if (sanitizedValue === sanitizedPlanTitle) {
    return "";
  }

  for (const separator of [" - ", ": ", " – "]) {
    const prefix = `${sanitizedPlanTitle}${separator}`;
    if (sanitizedValue.startsWith(prefix)) {
      return sanitizedValue.slice(prefix.length).trim();
    }
  }

  return sanitizedValue;
}

function isLikelyStructuredPathwayLabel(label: string) {
  const sanitized = sanitizePlannerOwnedText(label);
  if (!sanitized) {
    return false;
  }
  if (/^\[page \d+\]/i.test(sanitized)) {
    return false;
  }
  if (/parsed official|parsed choices|parsed requirement/i.test(sanitized)) {
    return false;
  }
  if (sanitized.length > 96) {
    return false;
  }
  if (sanitized.includes("?")) {
    return false;
  }
  if (sanitized.split(/\s+/).length > 12) {
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
    return sanitizePlannerOwnedText(`${degreeLabel} ${optionLabel} option`);
  }

  return String(pathwayId ?? "")
    .split(/[:]+/)
    .flatMap((segment) => segment.split(/-+/))
    .map((token) => formatPathwayLabelToken(token))
    .filter(Boolean)
    .join(" ");
}

function maybeExtractStructuredPathwayLabel(planTitle: string, candidate: string) {
  const strippedLabel = stripPathwayTitleSuffix(stripPlanTitlePrefix(planTitle, candidate));
  if (!isLikelyStructuredPathwayLabel(strippedLabel)) {
    return null;
  }
  return strippedLabel;
}

function resolveStructuredPathwayLabel(
  planId: string,
  planTitle: string,
  pathwayId: string,
  fallbackLabel: string
) {
  const candidates = new Map<string, number>();

  function pushCandidate(label: string | null | undefined, priority: number) {
    const sanitized = sanitizePlannerOwnedText(label);
    if (!sanitized) {
      return;
    }
    const currentPriority = candidates.get(sanitized) ?? Number.NEGATIVE_INFINITY;
    if (priority > currentPriority) {
      candidates.set(sanitized, priority);
    }
  }

  const scopeKey = makePathwayPlanKey(planId, pathwayId);
  const structuredRequirements = REQUIREMENTS_BY_KEY.get(scopeKey) ?? [];
  const structuredDegreeMaps = DEGREE_MAPS_BY_KEY.get(scopeKey) ?? [];
  const registryPathway =
    PATHWAYS_BY_PLAN.get(planId)?.find((entry) => entry.pathwayId === pathwayId) ?? null;

  for (const requirement of structuredRequirements) {
    pushCandidate(maybeExtractStructuredPathwayLabel(planTitle, requirement.majorTitle), 120);
  }

  for (const block of structuredDegreeMaps) {
    const isPhaseBlock = block.id.includes(":degree-map:00-phase-");
    pushCandidate(
      maybeExtractStructuredPathwayLabel(planTitle, block.majorTitle),
      isPhaseBlock ? 115 : 100
    );
    pushCandidate(
      maybeExtractStructuredPathwayLabel(planTitle, block.title),
      isPhaseBlock ? 110 : 95
    );
  }

  if (isLikelyStructuredPathwayLabel(registryPathway?.label ?? "")) {
    pushCandidate(registryPathway?.label, 80);
  }
  if (isLikelyStructuredPathwayLabel(fallbackLabel)) {
    pushCandidate(fallbackLabel, 70);
  }

  pushCandidate(formatPathwayLabelFromId(pathwayId), 10);

  const [resolvedLabel = sanitizePlannerOwnedText(fallbackLabel)] = [...candidates.entries()]
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

type StructuredPlanMetadata = {
  id: string;
  campusId: TransferPlannerCampusId;
  title: string;
};

const STRUCTURED_PLAN_METADATA_BY_ID = new Map<string, StructuredPlanMetadata>();

function registerStructuredPlanMetadata(
  planId: string | null | undefined,
  campusId: TransferPlannerCampusId,
  title: string | null | undefined
) {
  const normalizedPlanId = String(planId ?? "").trim();
  const normalizedTitle = sanitizePlannerOwnedText(title);
  if (!normalizedPlanId || !normalizedTitle || STRUCTURED_PLAN_METADATA_BY_ID.has(normalizedPlanId)) {
    return;
  }

  STRUCTURED_PLAN_METADATA_BY_ID.set(normalizedPlanId, {
    id: normalizedPlanId,
    campusId,
    title: normalizedTitle,
  });
}

for (const requirement of TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY) {
  if (requirement.pathwayId) continue;
  registerStructuredPlanMetadata(requirement.planId, requirement.campusId, requirement.majorTitle);
}

for (const block of TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY) {
  if (block.pathwayId) continue;
  registerStructuredPlanMetadata(block.planId, block.campusId, block.majorTitle);
}

for (const classification of TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY) {
  if (classification.pathwayId) continue;
  registerStructuredPlanMetadata(
    classification.planId,
    classification.campusId,
    classification.majorTitle
  );
}

for (const pathway of TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY) {
  registerStructuredPlanMetadata(pathway.planId, pathway.campusId, pathway.majorTitle);
}

for (const parsedSource of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY) {
  if (parsedSource.pathwayId) continue;
  registerStructuredPlanMetadata(
    parsedSource.planId,
    parsedSource.campusId,
    parsedSource.ownerTitle
  );
}

for (const manifestEntry of TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY) {
  if (manifestEntry.ownerType !== "major") continue;
  if (manifestEntry.pathwayId) continue;
  if (!manifestEntry.planId) continue;
  if (!manifestEntry.ownerTitle) continue;
  if (!manifestEntry.isPrimaryDegreeRequirementsLink) continue;
  if (!manifestEntry.campusId || manifestEntry.campusId === "grc") continue;

  registerStructuredPlanMetadata(
    manifestEntry.planId,
    manifestEntry.campusId as TransferPlannerCampusId,
    manifestEntry.ownerTitle
  );
}

function buildFallbackShortTitle(title: string) {
  const withoutTrailingDegree = sanitizePlannerOwnedText(
    title.replace(/\s*\([^)]*\)\s*$/, "")
  );
  return withoutTrailingDegree || sanitizePlannerOwnedText(title);
}

function buildRegistryBackedBasePathways(planId: string) {
  const planTitle =
    STRUCTURED_PLAN_METADATA_BY_ID.get(planId)?.title ??
    PATHWAYS_BY_PLAN.get(planId)?.[0]?.majorTitle ??
    planId;

  return (PATHWAYS_BY_PLAN.get(planId) ?? []).map((pathway) => ({
    id: pathway.pathwayId,
    label: resolveStructuredPathwayLabel(planId, planTitle, pathway.pathwayId, pathway.label),
    summary: sanitizePlannerOwnedText(pathway.summary),
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: uniquePlannerLinks(pathway.sourceLinks.map(toPlannerLink)),
    degreeMapSections: [],
    validationNotes: sanitizePlannerOwnedStrings(pathway.validationNotes),
    grcCourseList: uniqueReferenceCourseLabels(pathway.grcCourseList ?? []),
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
  } satisfies TransferPlannerMajorPathway));
}

function buildFallbackPathwayDegreeMapSections(
  planDegreeMapSections: TransferPlannerDegreeMapSection[] | undefined,
  pathway: TransferPlannerMajorPathway
): TransferPlannerDegreeMapSection[] {
  const pathwayLabel = sanitizePlannerOwnedText(pathway.label);
  const fallbackItem =
    sanitizePlannerOwnedText(pathway.summary) ||
    `Follow the official UW ${pathwayLabel.toLowerCase()} requirements in the linked source.`;
  const syntheticSection = sanitizeDegreeMapSection({
    id: `${pathway.id}-structure`,
    title: `${pathwayLabel} structure`,
    items: [fallbackItem],
    note: PARSER_ONLY_FALLBACK_DEGREE_MAP_NOTE,
  });
  const baseSections = (planDegreeMapSections ?? []).map((section) => sanitizeDegreeMapSection(section));

  if (!baseSections.length) {
    return [syntheticSection];
  }

  const [firstSection, ...remainingSections] = baseSections;
  return [firstSection, syntheticSection, ...remainingSections];
}

function buildBootstrapBasePathways(plan: TransferPlannerMajorPlan) {
  if ((plan.pathways ?? []).length > 0) {
    const enrichedBootstrapPathways = (plan.pathways ?? []).map((pathway) => {
      const registryPathway = getRegistryPathwayEntry(plan.id, pathway.id);
      return {
        ...pathway,
        label: resolveStructuredPathwayLabel(
          plan.id,
          plan.title,
          pathway.id,
          registryPathway?.label ?? pathway.label
        ),
        summary: sanitizePlannerOwnedText(registryPathway?.summary ?? pathway.summary),
        grcCourseList: uniqueReferenceCourseLabels([
          ...(registryPathway?.grcCourseList ?? []),
          ...(pathway.grcCourseList ?? []),
        ]),
        officialLinks: uniquePlannerLinks([
          ...(pathway.officialLinks ?? []),
          ...((registryPathway?.sourceLinks ?? []) as TransferPlannerSourceLink[]).map(
            toPlannerLink
          ),
        ]),
        validationNotes: sanitizePlannerOwnedStrings([
          ...(pathway.validationNotes ?? []),
          ...(registryPathway?.validationNotes ?? []),
        ]),
      };
    });
    const bootstrapPathwayIds = new Set(
      enrichedBootstrapPathways.map((pathway) => pathway.id)
    );
    const supplementalRegistryPathways = buildRegistryBackedBasePathways(plan.id).filter(
      (pathway) => !bootstrapPathwayIds.has(pathway.id)
    );

    return uniqueById([...enrichedBootstrapPathways, ...supplementalRegistryPathways]);
  }

  return buildRegistryBackedBasePathways(plan.id);
}

function buildParserOnlyPrimarySourceLink(planId: string): TransferPlannerLink | null {
  const primarySource = getTransferPlannerPrimaryDegreeRequirementsSource(planId);
  if (!primarySource?.url) {
    return null;
  }

  return {
    label: primarySource.label,
    url: primarySource.url,
    note: primarySource.note,
  };
}

function buildParserOnlyFallbackDegreeMapSections(
  planId: string,
  title: string
): TransferPlannerDegreeMapSection[] {
  const parsedBlocks = TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.filter(
    (entry) => entry.planId === planId && !entry.pathwayId && entry.ok
  );

  const items = uniquePlannerStrings(
    parsedBlocks.flatMap((entry) => [
      ...(entry.requirementCueLines ?? []),
      ...(entry.chooseStatements ?? []),
      ...(entry.pathwayLabels ?? []),
    ])
  ).slice(0, 12);

  if (!items.length) {
    return [];
  }

  return [
    sanitizeDegreeMapSection({
      id: "parsed-requirement-cues",
      title: `${title} source-backed requirement cues`,
      items,
      note: PARSER_ONLY_FALLBACK_DEGREE_MAP_NOTE,
    }),
  ];
}

function buildParserOnlyBasePlan(metadata: StructuredPlanMetadata): TransferPlannerMajorPlan {
  const basePathways = buildRegistryBackedBasePathways(metadata.id);
  const primarySourceLink = buildParserOnlyPrimarySourceLink(metadata.id);
  const fallbackDegreeMapSections = buildParserOnlyFallbackDegreeMapSections(
    metadata.id,
    metadata.title
  );

  return {
    id: metadata.id,
    campusId: metadata.campusId,
    title: metadata.title,
    shortTitle: buildFallbackShortTitle(metadata.title),
    coverage: "partial",
    summary: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks: uniquePlannerLinks(
      compact([
        primarySourceLink,
        ...basePathways.flatMap((pathway) => pathway.officialLinks ?? []),
      ])
    ),
    degreeMapSections: fallbackDegreeMapSections,
    validationNotes: sanitizePlannerOwnedStrings(
      basePathways.flatMap((pathway) => pathway.validationNotes ?? [])
    ),
    grcCourseList: uniqueReferenceCourseLabels(
      basePathways.flatMap((pathway) => pathway.grcCourseList ?? [])
    ),
    pathways: basePathways,
  };
}

const BOOTSTRAP_PLAN_IDS = new Set(
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.map((plan) => plan.id)
);
const PARSER_ONLY_BASE_MAJOR_PLANS = Array.from(STRUCTURED_PLAN_METADATA_BY_ID.values())
  .filter((metadata) => !BOOTSTRAP_PLAN_IDS.has(metadata.id))
  .sort((left, right) => {
    if (left.campusId !== right.campusId) {
      return left.campusId.localeCompare(right.campusId);
    }
    return left.title.localeCompare(right.title);
  })
  .map((metadata) => buildParserOnlyBasePlan(metadata));
const HYDRATED_BOOTSTRAP_BASE_MAJOR_PLANS = TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.map((plan) => ({
  ...plan,
  pathways: buildBootstrapBasePathways(plan),
}));
const ALL_BASE_MAJOR_PLANS = uniqueById([
  ...HYDRATED_BOOTSTRAP_BASE_MAJOR_PLANS,
  ...PARSER_ONLY_BASE_MAJOR_PLANS,
]);

function getStructuredCourseCodesForPlan(
  planId: string,
  baseCourseOrder: string[],
  pathwayId?: string | null
) {
  const scopeKeys = pathwayId
    ? [makePathwayPlanKey(planId, null), makePathwayPlanKey(planId, pathwayId)]
    : [makePathwayPlanKey(planId, null)];
  const filteredCodes = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
    (entry) =>
      entry.schoolId === "grc" &&
      entry.referencedByPlanIds.includes(planId) &&
      entry.sourceKinds.some((kind) => STRUCTURED_GRC_SOURCE_KINDS.has(kind)) &&
      (pathwayId
        ? entry.sourceContexts.some(
            (context) =>
              context.includes(`:pathway:${pathwayId}:`) || !context.includes(":pathway:")
          )
        : !entry.sourceContexts.some((context) => context.includes(":pathway:")))
  ).map((entry) => entry.code);

  const sourceBackedGuideCodes = scopeKeys.flatMap(
    (scopeKey) => SOURCE_BACKED_GUIDE_COURSES_BY_KEY.get(scopeKey) ?? []
  );
  const parsedAtomGuideCodes = [
    ...getParsedRequirementAtomGuideCourseCodesForScope(planId, null),
    ...(pathwayId ? getParsedRequirementAtomGuideCourseCodesForScope(planId, pathwayId) : []),
  ];
  const sourceBackedClassificationCodes = scopeKeys.flatMap(
    (scopeKey) => SOURCE_BACKED_CLASSIFICATION_COURSES_BY_KEY.get(scopeKey) ?? []
  );
  const degreeMapGuideCodes = scopeKeys.flatMap(
    (scopeKey) => DEGREE_MAP_GUIDE_COURSES_BY_KEY.get(scopeKey) ?? []
  );

  const structuredCourseCodes = orderStringsByBase(
    filterStaleSbseBusinessPolicyEconomicsCourseCodes(
      uniquePlannerStrings([
        ...baseCourseOrder,
        ...filteredCodes,
        ...sourceBackedClassificationCodes,
        ...sourceBackedGuideCodes,
        ...parsedAtomGuideCodes,
        ...degreeMapGuideCodes,
      ]),
      planId
    ),
    baseCourseOrder
  );

  return applyRequirementGroupSelectionsToCourseList(
    filterStaleSbseBusinessPolicyEconomicsCourseCodes(
      applySiblingChoiceSourceBackedRecovery(structuredCourseCodes, planId, pathwayId),
      planId
    ),
    planId,
    pathwayId
  );
}

function collectStructuredLinks(
  planId: string,
  baseLinks: TransferPlannerLink[],
  pathwayId?: string | null
) {
  const key = makePathwayPlanKey(planId, pathwayId);
  const links = uniquePlannerLinks(
    compact([
      ...baseLinks,
      ...(POLICIES_BY_KEY.get(key)?.sourceLinks ?? []).map(toPlannerLink),
      ...(REQUIREMENTS_BY_KEY.get(key) ?? []).flatMap((entry) => entry.sourceLinks.map(toPlannerLink)),
      ...(DEGREE_MAPS_BY_KEY.get(key) ?? []).flatMap((entry) => entry.sourceLinks.map(toPlannerLink)),
      ...((pathwayId
        ? PATHWAYS_BY_PLAN.get(planId)?.filter((entry) => entry.pathwayId === pathwayId) ?? []
        : []) as TransferPlannerMajorPathwayEntry[]).flatMap((entry) =>
        entry.sourceLinks.map(toPlannerLink)
      ),
    ])
  );

  return orderLinksByBase(links, baseLinks);
}

function collectStructuredValidationNotes(
  planId: string,
  baseNotes: string[],
  pathwayId?: string | null
) {
  const key = makePathwayPlanKey(planId, pathwayId);
  const structuredNotes = uniquePlannerStrings([
    ...(POLICIES_BY_KEY.get(key)?.validationNotes ?? []),
    ...(REQUIREMENTS_BY_KEY.get(key) ?? []).flatMap((entry) => entry.validationNotes),
    ...(DEGREE_MAPS_BY_KEY.get(key) ?? []).flatMap((entry) => entry.validationNotes),
    ...((pathwayId
      ? PATHWAYS_BY_PLAN.get(planId)?.filter((entry) => entry.pathwayId === pathwayId) ?? []
      : []) as TransferPlannerMajorPathwayEntry[]).flatMap((entry) => entry.validationNotes),
  ]);

  const orderedBaseNotes = baseNotes.filter((note) => structuredNotes.includes(note));
  const remainingNotes = structuredNotes.filter((note) => !orderedBaseNotes.includes(note));
  return [...orderedBaseNotes, ...remainingNotes];
}

function buildChecklistForPhase(
  planId: string,
  phase: TransferPlannerRequirementPhase,
  baseItems: TransferPlannerChecklistItem[],
  pathwayId?: string | null
) {
  const parserRequirementGroupItems = getRequirementGroupChecklistItemsForPhase(
    planId,
    phase,
    pathwayId
  );

  const allItemsForKey = REQUIREMENTS_BY_KEY.get(makePathwayPlanKey(planId, pathwayId)) ?? [];
  const items = allItemsForKey.filter((entry) => entry.displayPhase === phase);

  if (!allItemsForKey.length) {
    return parserRequirementGroupItems.length
      ? appendUniqueChecklistItems(
          parserRequirementGroupItems,
          baseItems.map((item) => sanitizeChecklistItem(item))
        )
      : baseItems.map((item) => sanitizeChecklistItem(item));
  }

  const structuredItems = orderByBaseIds(
    items.map(buildChecklistItem),
    baseItems.map((item) => item.id)
  );
  return parserRequirementGroupItems.length
    ? appendUniqueChecklistItems(parserRequirementGroupItems, structuredItems)
    : structuredItems;
}

function buildDegreeMapSections(
  planId: string,
  baseSections: TransferPlannerDegreeMapSection[] | undefined,
  pathwayId?: string | null
) {
  const blocks = DEGREE_MAPS_BY_KEY.get(makePathwayPlanKey(planId, pathwayId)) ?? [];
  if (!blocks.length) {
    return appendSourceBackedBioengineeringGeneralEducationSection(
      planId,
      baseSections?.map((section) => sanitizeDegreeMapSection(section))
    );
  }

  return appendSourceBackedBioengineeringGeneralEducationSection(
    planId,
    orderByBaseIds(
      blocks.map(buildDegreeMapSection),
      (baseSections ?? []).map((section) => section.id)
    )
  );
}

function buildTrackMatchCourseList(scope: {
  grcCourseList: string[];
  applicationChecklist: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist: TransferPlannerChecklistItem[];
  stayAtGrcChecklist: TransferPlannerChecklistItem[];
}, planId: string, pathwayId?: string | null) {
  const automaticTrackMatchCourseList = buildAutomaticTrackMatchCourseList(planId, pathwayId);
  const trackMatchSeedCourseList =
    planId === UW_SEATTLE_BIOENGINEERING_PLAN_ID
      ? buildStudentVisibleAutomaticCourseList(scope)
      : buildStudentVisibleTrackMatchCourseList({
          ...scope,
          grcCourseList: uniqueReferenceCourseLabels([
            ...(scope.grcCourseList ?? []),
            ...automaticTrackMatchCourseList,
          ]),
        });

  return orderStringsByBase(
    uniqueReferenceCourseLabels([
      ...automaticTrackMatchCourseList,
      ...trackMatchSeedCourseList,
    ]),
    automaticTrackMatchCourseList.length ? automaticTrackMatchCourseList : scope.grcCourseList ?? []
  );
}

function buildPathway(
  basePlan: TransferPlannerMajorPlan,
  basePathway: TransferPlannerMajorPathway,
  planDegreeMapSections: TransferPlannerDegreeMapSection[] | undefined
) {
  const key = makePathwayPlanKey(basePlan.id, basePathway.id);
  const policy = POLICIES_BY_KEY.get(key);
  const registryPathway = getRegistryPathwayEntry(basePlan.id, basePathway.id);
  const structuredDegreeMapSections = buildDegreeMapSections(
    basePlan.id,
    basePathway.degreeMapSections,
    basePathway.id
  );
  const combinedMinimalPathwayDegreeMapSections =
    (structuredDegreeMapSections?.length ?? 0) === 1 && (planDegreeMapSections?.length ?? 0) > 0
      ? [
          sanitizeDegreeMapSection(planDegreeMapSections![0]),
          ...structuredDegreeMapSections!.map((section) => sanitizeDegreeMapSection(section)),
          ...planDegreeMapSections!
            .slice(1)
            .map((section) => sanitizeDegreeMapSection(section)),
        ]
      : null;

  const applicationChecklist = buildChecklistForPhase(
    basePlan.id,
    "before-application",
    basePathway.applicationChecklist ?? [],
    basePathway.id
  );
  const inheritedBestTrackId =
    policy?.bestTrackId === undefined
      ? basePathway.bestTrackId ?? basePlan.bestTrackId
      : policy.bestTrackId;
  const inheritedRecommendedTrackSummary =
    policy?.recommendedTrackSummary ??
    basePathway.recommendedTrackSummary ??
    (inheritedBestTrackId === basePlan.bestTrackId ? basePlan.recommendedTrackSummary : undefined);
  const inheritedWhyThisTrack =
    policy?.whyThisTrack.length
      ? [...policy.whyThisTrack]
      : basePathway.whyThisTrack?.length
        ? [...basePathway.whyThisTrack]
        : inheritedBestTrackId === basePlan.bestTrackId
          ? [...(basePlan.whyThisTrack ?? [])]
          : [];
  const pathway = {
    id: registryPathway?.pathwayId ?? basePathway.id,
    label: resolveStructuredPathwayLabel(
      basePlan.id,
      basePlan.title,
      basePathway.id,
      registryPathway?.label ?? basePathway.label
    ),
    summary: sanitizePlannerOwnedText(registryPathway?.summary ?? basePathway.summary),
    applicationChecklist,
    beforeEnrollmentChecklist: buildChecklistForPhase(
      basePlan.id,
      "before-enrollment",
      basePathway.beforeEnrollmentChecklist ?? [],
      basePathway.id
    ),
    stayAtGrcChecklist: buildChecklistForPhase(
      basePlan.id,
      "stay-at-grc",
      basePathway.stayAtGrcChecklist ?? [],
      basePathway.id
    ),
    advisorFlags: sanitizePlannerOwnedStrings(policy?.advisorFlags ?? basePathway.advisorFlags ?? []),
    officialLinks: collectStructuredLinks(
      basePlan.id,
      basePathway.officialLinks ?? basePlan.officialLinks,
      basePathway.id
    ),
    degreeMapSections:
      combinedMinimalPathwayDegreeMapSections ??
      ((structuredDegreeMapSections?.length ?? 0) > 0
        ? structuredDegreeMapSections
        : buildFallbackPathwayDegreeMapSections(planDegreeMapSections, basePathway)),
    validationNotes: sanitizePlannerOwnedStrings(
      collectStructuredValidationNotes(
        basePlan.id,
        basePathway.validationNotes ?? basePlan.validationNotes ?? [],
        basePathway.id
      )
    ),
    grcCourseList: getStructuredCourseCodesForPlan(
      basePlan.id,
      uniqueReferenceCourseLabels([
        ...(basePlan.grcCourseList ?? []),
        ...(basePathway.grcCourseList ?? []),
      ]),
      basePathway.id
    ),
    grcCourseListGuidance: sanitizePlannerOwnedText(
      policy?.grcCourseListGuidance ?? basePathway.grcCourseListGuidance
    ),
    plannerNote: sanitizePlannerOwnedText(policy?.plannerNote ?? basePathway.plannerNote),
    bestTrackId: inheritedBestTrackId,
    recommendedTrackSummary: sanitizePlannerOwnedText(inheritedRecommendedTrackSummary),
    whyThisTrack: sanitizePlannerOwnedStrings(inheritedWhyThisTrack),
    requirementGroups: getRequirementGroupsForScope(basePlan.id, basePathway.id),
    requirementReplacements: getRequirementReplacementsForScope(basePlan.id, basePathway.id),
    supportLists: getRequirementSupportListsForScope(basePlan.id, basePathway.id),
  } satisfies TransferPlannerMajorPathway;

  return applyAutoTrackRecommendationFromStudentVisibleList(pathway, {
    trackMatchCourseList: buildTrackMatchCourseList(pathway, basePlan.id, basePathway.id),
  });
}

function buildSourceGeneratedPlan(basePlan: TransferPlannerMajorPlan): TransferPlannerMajorPlan {
  const policy = POLICIES_BY_KEY.get(makePathwayPlanKey(basePlan.id, null));
  const applicationChecklist = buildChecklistForPhase(
    basePlan.id,
    "before-application",
    basePlan.applicationChecklist
  );
  const beforeEnrollmentChecklist = buildChecklistForPhase(
    basePlan.id,
    "before-enrollment",
    basePlan.beforeEnrollmentChecklist
  );
  const stayAtGrcChecklist = buildChecklistForPhase(
    basePlan.id,
    "stay-at-grc",
    basePlan.stayAtGrcChecklist
  );
  const degreeMapSections = buildDegreeMapSections(basePlan.id, basePlan.degreeMapSections);
  const materializedBasePathways = materializeTransferPlannerPathways(
    basePlan,
    basePlan.pathways ?? [],
    getPlanMaterializationParsedRequirementSourceBlocks(basePlan.id)
  );
  const structuredPathways = orderByBaseIds(
    materializedBasePathways.map((pathway) => buildPathway(basePlan, pathway, degreeMapSections)),
    materializedBasePathways.map((pathway) => pathway.id)
  );
  const sourceGeneratedPlan = {
    ...basePlan,
    summary: sanitizePlannerOwnedText(basePlan.summary),
    bestTrackId: policy?.bestTrackId ?? basePlan.bestTrackId,
    recommendedTrackSummary: sanitizePlannerOwnedText(
      policy?.recommendedTrackSummary ?? basePlan.recommendedTrackSummary
    ),
    whyThisTrack: sanitizePlannerOwnedStrings(
      policy?.whyThisTrack.length ? [...policy.whyThisTrack] : [...basePlan.whyThisTrack]
    ),
    applicationChecklist,
    beforeEnrollmentChecklist,
    stayAtGrcChecklist,
    advisorFlags: sanitizePlannerOwnedStrings(policy?.advisorFlags ?? basePlan.advisorFlags),
    officialLinks: collectStructuredLinks(basePlan.id, basePlan.officialLinks),
    degreeMapSections,
    validationNotes: sanitizePlannerOwnedStrings(
      collectStructuredValidationNotes(basePlan.id, basePlan.validationNotes ?? [])
    ),
    grcCourseList: getStructuredCourseCodesForPlan(
      basePlan.id,
      basePlan.grcCourseList ?? []
    ),
    grcCourseListGuidance: sanitizePlannerOwnedText(
      policy?.grcCourseListGuidance ?? basePlan.grcCourseListGuidance
    ),
    plannerNote: sanitizePlannerOwnedText(policy?.plannerNote ?? basePlan.plannerNote),
    pathways: structuredPathways,
    requirementGroups: getRequirementGroupsForScope(basePlan.id),
    requirementReplacements: getRequirementReplacementsForScope(basePlan.id),
    supportLists: getRequirementSupportListsForScope(basePlan.id),
  };

  const sourceGeneratedWithCompatibility = applyChecklistItemsByPhase(
    sourceGeneratedPlan,
    buildSupplementalChecklistItems(sourceGeneratedPlan)
  );
  const sourceGeneratedWithFallback = applyChecklistItemsByPhase(
    sourceGeneratedWithCompatibility,
    buildSourceGeneratedFallbackChecklistItems(sourceGeneratedWithCompatibility)
  );
  const sourceGeneratedWithRequirementGroups = applyChecklistItemsByPhase(
    sourceGeneratedWithFallback,
    buildRequirementGroupChecklistItemsByPhase(basePlan.id)
  );

  const promotedSourceGeneratedPlan = promoteStructuredCoverage(sourceGeneratedWithRequirementGroups);

  const autoTrackedSourceGeneratedPlan = applyAutoTrackRecommendationFromStudentVisibleList(
    promotedSourceGeneratedPlan,
    {
      trackMatchCourseList: buildTrackMatchCourseList(promotedSourceGeneratedPlan, basePlan.id),
    }
  );

  return applyCuratedComputerEngineeringTrack(autoTrackedSourceGeneratedPlan, basePlan.id);
}

function getAutomaticScopeKeys(planId: string, pathwayId?: string | null) {
  return pathwayId
    ? [makePathwayPlanKey(planId, null), makePathwayPlanKey(planId, pathwayId)]
    : [makePathwayPlanKey(planId, null)];
}

function buildAutomaticChecklistForPhase(
  planId: string,
  phase: TransferPlannerRequirementPhase,
  pathwayId?: string | null
) {
  const parserRequirementGroupItems = getRequirementGroupChecklistItemsForPhase(
    planId,
    phase,
    pathwayId
  );
  const supportedCourseCodes = new Set(
    buildAutomaticCourseList(planId, pathwayId).map((code) => normalizeCourseCode(code))
  );
  const seenSignatures = new Set<string>();
  const runtimeItems: TransferPlannerChecklistItem[] = [];

  for (const item of parserRequirementGroupItems) {
    const signature = buildChecklistItemSignature(item);
    if (seenSignatures.has(signature)) {
      continue;
    }

    seenSignatures.add(signature);
    runtimeItems.push(item);
  }

  for (const atom of getStudentFacingRuntimeRequirementAtoms(planId, pathwayId)) {
    if (atom.displayPhase !== phase) {
      continue;
    }

    const item = buildSourceValidatedRuntimeChecklistItem(atom, supportedCourseCodes);
    if (!item) {
      continue;
    }

    const signature = buildChecklistItemSignature(item);
    if (seenSignatures.has(signature)) {
      continue;
    }

    seenSignatures.add(signature);
    runtimeItems.push(item);
  }

  return runtimeItems;
}

function buildAutomaticCoursePoolChecklistItems(scope: {
  planId: string;
  pathwayId?: string | null;
  automaticCourseList: string[];
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
}) {
  const existingChecklistItems = [
    ...(scope.applicationChecklist ?? []),
    ...(scope.beforeEnrollmentChecklist ?? []),
    ...(scope.stayAtGrcChecklist ?? []),
  ];
  const existingCoverage = new Set(
    getChecklistCoverageCourseCodes(existingChecklistItems)
  );
  const existingChoiceCoverage = new Set(
    existingChecklistItems.flatMap((item) => {
      const hasUnselectedOptions = (item.unselectedRequirementOptionIds ?? []).length > 0;
      const requirementType = item.requirementGroup?.requirementType ?? null;
      if (
        !hasUnselectedOptions ||
        (requirementType !== "choose_one" && requirementType !== "sequence_choice")
      ) {
        return [];
      }

      return [...(item.grcCourses ?? []), ...(item.alternatives ?? []).flat()]
        .flatMap(extractReferenceCourseCodes)
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean);
    })
  );
  const automaticCourseList = uniqueReferenceCourseLabels(scope.automaticCourseList)
    .filter((label) => extractReferenceCourseCodes(label).length > 0)
    .filter((label) =>
      extractReferenceCourseCodes(label).some(
        (courseCode) =>
          !existingCoverage.has(normalizeCourseCode(courseCode)) &&
          !existingChoiceCoverage.has(normalizeCourseCode(courseCode))
      )
    );
  if (!automaticCourseList.length) {
    return buildEmptyChecklistItemsByPhase();
  }

  const supportedCourseCodes = new Set(
    automaticCourseList.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
  const sourceMetadata = {
    ...getPrimaryGeneratedSourceMetadata(scope.planId, scope.pathwayId),
    generatedFromParser: false,
    manualOverride: false,
    sourceScope: "generated-course-pool",
    reason: "Synthesized from source-backed generated course pool because no checklist rows existed.",
  } satisfies ChecklistSourceMetadata;
  const seenSignatures = new Set<string>();
  const synthesizedItems: TransferPlannerChecklistItem[] = [];

  automaticCourseList.forEach((courseLabel, index) => {
    const checklistItem = buildSourceValidatedRuntimeChecklistItem(
      {
        id: buildAutoChecklistItemId(
          `${scope.planId}-${scope.pathwayId ?? "base"}-course-pool-${courseLabel}`,
          index
        ),
        title: courseLabel,
        grcCourseCodes: [courseLabel],
        alternativeCourseCodeSets: [],
        note: undefined,
        ...sourceMetadata,
      },
      supportedCourseCodes
    );
    if (!checklistItem) {
      return;
    }

    const signature = buildChecklistItemSignature(checklistItem);
    if (seenSignatures.has(signature)) {
      return;
    }

    seenSignatures.add(signature);
    synthesizedItems.push(checklistItem);
  });

  if (!synthesizedItems.length) {
    return buildEmptyChecklistItemsByPhase();
  }

  const dominantPhase = getDominantSourceBackedFallbackPhase(
    getRequirementDiffClassificationsForScope(scope.planId, scope.pathwayId).filter(
      (entry) =>
        entry.grcCourseCodes.length > 0 ||
        (entry.alternativeCourseCodeSets ?? []).some((group) => group.length > 0)
    ),
    getParsedRequirementAtomCandidatesForScope(scope.planId, scope.pathwayId),
    "before-enrollment"
  );

  return {
    beforeApplication: dominantPhase === "before-application" ? synthesizedItems : [],
    beforeEnrollment: dominantPhase === "before-enrollment" ? synthesizedItems : [],
    stayAtGrc: dominantPhase === "stay-at-grc" ? synthesizedItems : [],
  } satisfies ChecklistItemsByPhase;
}

function buildAutomaticCourseList(
  planId: string,
  pathwayId?: string | null,
  options: {
    includeRuntimeRequirementCourses?: boolean;
  } = {}
) {
  const scopeKeys = getAutomaticScopeKeys(planId, pathwayId);
  const includeRuntimeRequirementCourses = options.includeRuntimeRequirementCourses ?? true;
  const runtimeRequirementCourseCodes = includeRuntimeRequirementCourses
    ? getStudentFacingRuntimeRequirementAtoms(planId, pathwayId).flatMap((atom) => [
        ...atom.grcCourseCodes,
        ...(atom.alternativeCourseCodeSets ?? []).flat(),
      ])
    : [];
  const parsedAtomGuideCodes = [
    ...getParsedRequirementAtomGuideCourseCodesForScope(planId, null),
    ...(pathwayId ? getParsedRequirementAtomGuideCourseCodesForScope(planId, pathwayId) : []),
  ];

  const automaticCourseList = orderStringsByBase(
    filterStaleSbseBusinessPolicyEconomicsCourseCodes(
      uniquePlannerStrings([
        ...runtimeRequirementCourseCodes,
        ...scopeKeys.flatMap(
          (scopeKey) => DEGREE_MAP_GUIDE_COURSES_BY_KEY.get(scopeKey) ?? []
        ),
        ...scopeKeys.flatMap(
          (scopeKey) => SOURCE_BACKED_CLASSIFICATION_COURSES_BY_KEY.get(scopeKey) ?? []
        ),
        ...scopeKeys.flatMap(
          (scopeKey) => SOURCE_BACKED_GUIDE_COURSES_BY_KEY.get(scopeKey) ?? []
        ),
        ...parsedAtomGuideCodes,
      ]),
      planId
    ),
    []
  );

  return applyRequirementGroupSelectionsToCourseList(
    filterStaleSbseBusinessPolicyEconomicsCourseCodes(
      applySiblingChoiceSourceBackedRecovery(automaticCourseList, planId, pathwayId),
      planId
    ),
    planId,
    pathwayId
  );
}

function buildStudentVisibleAutomaticCourseList(scope: {
  grcCourseList: string[];
  applicationChecklist: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist: TransferPlannerChecklistItem[];
  stayAtGrcChecklist: TransferPlannerChecklistItem[];
}) {
  const checklistItems = [
    ...(scope.applicationChecklist ?? []),
    ...(scope.beforeEnrollmentChecklist ?? []),
    ...(scope.stayAtGrcChecklist ?? []),
  ];
  const selectedChoiceCourseCodes = new Set<string>();
  const unselectedChoiceCourseCodes = new Set<string>();

  for (const item of checklistItems) {
    const group = item.requirementGroup;
    if (
      !group ||
      (group.requirementType !== "choose_one" && group.requirementType !== "sequence_choice")
    ) {
      continue;
    }

    const selectedOptionIds = new Set(item.selectedRequirementOptionIds ?? []);
    const unselectedOptionIds = new Set(item.unselectedRequirementOptionIds ?? []);
    if (!selectedOptionIds.size || !unselectedOptionIds.size) {
      continue;
    }

    for (const option of group.options ?? []) {
      const optionId = option.id ?? "";
      if (!optionId) {
        continue;
      }

      const targetSet = selectedOptionIds.has(optionId)
        ? selectedChoiceCourseCodes
        : unselectedOptionIds.has(optionId)
          ? unselectedChoiceCourseCodes
          : null;
      if (!targetSet) {
        continue;
      }

      for (const courseCode of getRequirementOptionCourseLabels(option)) {
        const normalizedCourseCode = normalizeCourseCode(courseCode);
        if (normalizedCourseCode) {
          targetSet.add(normalizedCourseCode);
        }
      }
    }
  }

  const suppressUnselectedChoices = (labels: string[]) =>
    labels.filter((label) =>
      extractReferenceCourseCodes(label).some((courseCode) => {
        const normalizedCourseCode = normalizeCourseCode(courseCode);
        return (
          !unselectedChoiceCourseCodes.has(normalizedCourseCode) ||
          selectedChoiceCourseCodes.has(normalizedCourseCode)
        );
      })
    );

  const checklistCourseList = collectPlannerCourseLabels(scope);
  const baseGrcCourseList = filterCanonicalGrcCourseLabels(scope.grcCourseList ?? []);
  return orderStringsByBase(
    suppressUnselectedChoices(
      filterCanonicalGrcCourseLabels([...baseGrcCourseList, ...checklistCourseList])
    ),
    baseGrcCourseList
  );
}

function buildAutomaticTrackMatchCourseList(planId: string, pathwayId?: string | null) {
  const scopeKeys = getAutomaticScopeKeys(planId, pathwayId);
  const parsedAtomGuideCodes = [
    ...getParsedRequirementAtomGuideCourseCodesForScope(planId, null),
    ...(pathwayId ? getParsedRequirementAtomGuideCourseCodesForScope(planId, pathwayId) : []),
  ];

  const automaticTrackMatchCourseList = orderStringsByBase(
    filterStaleSbseBusinessPolicyEconomicsCourseCodes(
      uniquePlannerStrings([
        ...scopeKeys.flatMap(
          (scopeKey) => DEGREE_MAP_GUIDE_COURSES_BY_KEY.get(scopeKey) ?? []
        ),
        ...scopeKeys.flatMap(
          (scopeKey) => SOURCE_BACKED_TRACK_MATCH_COURSES_BY_KEY.get(scopeKey) ?? []
        ),
        ...scopeKeys.flatMap(
          (scopeKey) => SOURCE_BACKED_GUIDE_COURSES_BY_KEY.get(scopeKey) ?? []
        ),
        ...parsedAtomGuideCodes,
      ]),
      planId
    ),
    []
  );

  return applyRequirementGroupSelectionsToCourseList(
    filterStaleSbseBusinessPolicyEconomicsCourseCodes(
      applySiblingChoiceSourceBackedRecovery(
        automaticTrackMatchCourseList,
        planId,
        pathwayId
      ),
      planId
    ),
    planId,
    pathwayId
  );
}

function buildTrackMatchSeedCourseList(items: TransferPlannerChecklistItem[]) {
  return uniqueReferenceCourseLabels(
    items.flatMap((item) => {
      const targetCount = Math.max(item.minCompletedCount ?? 0, 1);
      const alternativeGroups = item.alternatives ?? [];
      if (item.grcCourses.length) {
        if (item.minCompletedCount == null && alternativeGroups.length === 1) {
          return uniqueReferenceCourseLabels([
            ...item.grcCourses,
            ...alternativeGroups[0],
          ]);
        }

        return item.grcCourses.slice(0, targetCount);
      }

      const [firstAlternative = []] = alternativeGroups;
      return firstAlternative.slice(
        0,
        item.minCompletedCount == null ? firstAlternative.length : targetCount
      );
    })
  );
}

function buildStudentVisibleTrackMatchCourseList(scope: {
  grcCourseList: string[];
  applicationChecklist: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist: TransferPlannerChecklistItem[];
  stayAtGrcChecklist: TransferPlannerChecklistItem[];
}) {
  const checklistSeedCourseList = buildTrackMatchSeedCourseList([
    ...(scope.applicationChecklist ?? []),
    ...(scope.beforeEnrollmentChecklist ?? []),
    ...(scope.stayAtGrcChecklist ?? []),
  ]);
  const baseGrcCourseList = filterCanonicalGrcCourseLabels(scope.grcCourseList ?? []);

  return orderStringsByBase(
    filterCanonicalGrcCourseLabels([...baseGrcCourseList, ...checklistSeedCourseList]),
    baseGrcCourseList
  );
}

function isStudentVisibleTrackCourseLabel(label: string) {
  const normalizedLabel = normalizeCourseCode(label);
  const extractedCourseCodes = extractReferenceCourseCodes(label);

  return extractedCourseCodes.length === 1 && extractedCourseCodes[0] === normalizedLabel;
}

function getStudentVisibleTrackCourseList(trackId: string | null | undefined) {
  const track = trackId ? TRACKS_BY_ID.get(trackId) ?? null : null;
  if (!track) {
    return [] as string[];
  }

  return uniqueReferenceCourseLabels(
    track.terms
      .filter((term) => shouldUseTrackTermForAutoMatch(term.label))
      .flatMap((term) => term.courses)
      .filter((label) => isStudentVisibleTrackCourseLabel(label))
  );
}

function applyStudentVisibleTrackCourseList<T extends {
  bestTrackId: string | null | undefined;
  grcCourseList?: string[];
}>(scope: T): T {
  const existingCourseList = uniqueReferenceCourseLabels(scope.grcCourseList ?? []);
  if (!existingCourseList.length) {
    return scope;
  }

  const trackCourseList = getStudentVisibleTrackCourseList(scope.bestTrackId);
  if (!trackCourseList.length) {
    return scope;
  }

  const existingCourseCodeSet = new Set(
    existingCourseList.flatMap((label) => extractReferenceCourseCodes(label))
  );
  const trackOrderForExistingCourses = trackCourseList.filter((label) =>
    extractReferenceCourseCodes(label).some((code) => existingCourseCodeSet.has(code))
  );
  const baseOrder = [...trackOrderForExistingCourses, ...existingCourseList];
  return {
    ...scope,
    grcCourseList: orderStringsByBase(existingCourseList, baseOrder),
  };
}

function buildStudentRuntimePathway(
  basePlan: TransferPlannerMajorPlan,
  basePathway: TransferPlannerMajorPathway
) {
  const trackMetadata = getPathwayScopedTrackMetadata(basePlan, basePathway);
  const registryPathway = getRegistryPathwayEntry(basePlan.id, basePathway.id);
  const pathwayCourseSeed = uniqueReferenceCourseLabels([
    ...(registryPathway?.grcCourseList ?? []),
    ...(basePathway.grcCourseList ?? []),
  ]);
  const structuredCourseSeed = getStructuredCourseCodesForPlan(
    basePlan.id,
    uniqueReferenceCourseLabels([
      ...(basePlan.grcCourseList ?? []),
      ...pathwayCourseSeed,
    ]),
    basePathway.id
  );
  const applicationChecklist = buildAutomaticChecklistForPhase(
    basePlan.id,
    "before-application",
    basePathway.id
  );
  let beforeEnrollmentChecklist = buildAutomaticChecklistForPhase(
    basePlan.id,
    "before-enrollment",
    basePathway.id
  );
  let stayAtGrcChecklist = buildAutomaticChecklistForPhase(
    basePlan.id,
    "stay-at-grc",
    basePathway.id
  );
  const derivedComputingChecklistItems = buildDerivedRuntimeComputingPrepChecklistItems({
    planId: basePlan.id,
    pathwayId: basePathway.id,
    automaticCourseList: buildAutomaticCourseList(basePlan.id, basePathway.id),
    applicationChecklist,
    beforeEnrollmentChecklist,
    stayAtGrcChecklist,
  });
  beforeEnrollmentChecklist = appendUniqueChecklistItems(
    beforeEnrollmentChecklist,
    derivedComputingChecklistItems.beforeEnrollment
  );
  stayAtGrcChecklist = appendUniqueChecklistItems(
    stayAtGrcChecklist,
    derivedComputingChecklistItems.stayAtGrc
  );
  const applicationChecklistWithDerived = appendUniqueChecklistItems(
    applicationChecklist,
    derivedComputingChecklistItems.beforeApplication
  );
  const synthesizedChecklistItems = buildAutomaticCoursePoolChecklistItems({
    planId: basePlan.id,
    pathwayId: basePathway.id,
    automaticCourseList: buildAutomaticCourseList(basePlan.id, basePathway.id),
    applicationChecklist: applicationChecklistWithDerived,
    beforeEnrollmentChecklist,
    stayAtGrcChecklist,
  });
  const applicationChecklistWithSynthesis = appendUniqueChecklistItems(
    applicationChecklistWithDerived,
    synthesizedChecklistItems.beforeApplication
  );
  beforeEnrollmentChecklist = appendUniqueChecklistItems(
    beforeEnrollmentChecklist,
    synthesizedChecklistItems.beforeEnrollment
  );
  stayAtGrcChecklist = appendUniqueChecklistItems(
    stayAtGrcChecklist,
    synthesizedChecklistItems.stayAtGrc
  );
  const prunedBeforeEnrollmentChecklist = pruneRedundantRuntimeChecklistItems(
    beforeEnrollmentChecklist,
    getChecklistCoverageCourseCodes(applicationChecklistWithSynthesis)
  );
  const prunedStayAtGrcChecklist = pruneRedundantRuntimeChecklistItems(
    stayAtGrcChecklist,
    getChecklistCoverageCourseCodes([
      ...applicationChecklistWithSynthesis,
      ...prunedBeforeEnrollmentChecklist,
    ])
  );
  const automaticCourseList = applyRequirementGroupSelectionsToCourseList(
    orderStringsByBase(
      uniqueReferenceCourseLabels([
        ...structuredCourseSeed,
        ...buildAutomaticCourseList(basePlan.id, basePathway.id),
      ]),
      structuredCourseSeed
    ),
    basePlan.id,
    basePathway.id
  );
  const automaticTrackMatchCourseList = applyRequirementGroupSelectionsToCourseList(
    orderStringsByBase(
      uniqueReferenceCourseLabels([
        ...structuredCourseSeed,
        ...buildAutomaticTrackMatchCourseList(basePlan.id, basePathway.id),
      ]),
      structuredCourseSeed
    ),
    basePlan.id,
    basePathway.id
  );
  const studentVisibleCourseList = buildStudentVisibleAutomaticCourseList({
    grcCourseList: automaticCourseList,
    applicationChecklist: applicationChecklistWithSynthesis,
    beforeEnrollmentChecklist: prunedBeforeEnrollmentChecklist,
    stayAtGrcChecklist: prunedStayAtGrcChecklist,
  });
  const studentVisibleTrackMatchCourseList = buildStudentVisibleTrackMatchCourseList({
    grcCourseList: automaticTrackMatchCourseList,
    applicationChecklist: applicationChecklistWithSynthesis,
    beforeEnrollmentChecklist: prunedBeforeEnrollmentChecklist,
    stayAtGrcChecklist: prunedStayAtGrcChecklist,
  });

  const runtimePathway = applyStrictSourceBackedFallback(
    applyAutoTrackRecommendationFromStudentVisibleList({
        ...basePathway,
        id: basePathway.id,
        label: resolveStructuredPathwayLabel(
          basePlan.id,
          basePlan.title,
          basePathway.id,
          basePathway.label
        ),
        summary: sanitizePlannerOwnedText(basePathway.summary),
        applicationChecklist: applicationChecklistWithSynthesis,
        beforeEnrollmentChecklist: prunedBeforeEnrollmentChecklist,
        stayAtGrcChecklist: prunedStayAtGrcChecklist,
        advisorFlags: sanitizePlannerOwnedStrings(basePathway.advisorFlags ?? []),
        officialLinks: uniquePlannerLinks(basePathway.officialLinks ?? []),
        degreeMapSections: (basePathway.degreeMapSections ?? []).map((section) =>
          sanitizeDegreeMapSection(section)
        ),
        validationNotes: sanitizePlannerOwnedStrings(basePathway.validationNotes ?? []),
        grcCourseList: studentVisibleTrackMatchCourseList,
        grcCourseListGuidance:
          sanitizePlannerOwnedText(basePathway.grcCourseListGuidance) || undefined,
        plannerNote: sanitizePlannerOwnedText(basePathway.plannerNote) || undefined,
        bestTrackId: trackMetadata.bestTrackId,
        recommendedTrackSummary: sanitizePlannerOwnedText(
          trackMetadata.recommendedTrackSummary
        ),
        whyThisTrack: sanitizePlannerOwnedStrings(trackMetadata.whyThisTrack),
        requirementGroups: getRequirementGroupsForScope(basePlan.id, basePathway.id),
        requirementReplacements: getRequirementReplacementsForScope(basePlan.id, basePathway.id),
        supportLists: getRequirementSupportListsForScope(basePlan.id, basePathway.id),
    } satisfies TransferPlannerMajorPathway, {
      trackMatchCourseList: studentVisibleTrackMatchCourseList,
      studentVisibleCourseList,
      majorTitle: basePlan.title,
    }),
    basePathway.id
  );

  return applyStudentVisibleTrackCourseList(
    {
      ...runtimePathway,
      grcCourseList: studentVisibleCourseList,
    }
  );
}

function buildStudentRuntimePlan(basePlan: TransferPlannerMajorPlan): TransferPlannerMajorPlan {
  const materializedBasePathways = materializeTransferPlannerPathways(
    basePlan,
    basePlan.pathways ?? [],
    getPlanMaterializationParsedRequirementSourceBlocks(basePlan.id)
  );
  let applicationChecklist = buildAutomaticChecklistForPhase(
    basePlan.id,
    "before-application"
  );
  let beforeEnrollmentChecklist = buildAutomaticChecklistForPhase(
    basePlan.id,
    "before-enrollment"
  );
  let stayAtGrcChecklist = buildAutomaticChecklistForPhase(basePlan.id, "stay-at-grc");
  const compatibilityChecklistItems = buildSupplementalChecklistItems({
    id: basePlan.id,
    grcCourseList: buildAutomaticCourseList(basePlan.id),
    pathways: materializedBasePathways,
  });
  applicationChecklist = appendUniqueChecklistItems(
    applicationChecklist,
    compatibilityChecklistItems.beforeApplication
  );
  beforeEnrollmentChecklist = appendUniqueChecklistItems(
    beforeEnrollmentChecklist,
    compatibilityChecklistItems.beforeEnrollment
  );
  stayAtGrcChecklist = appendUniqueChecklistItems(
    stayAtGrcChecklist,
    compatibilityChecklistItems.stayAtGrc
  );
  const derivedComputingChecklistItems = buildDerivedRuntimeComputingPrepChecklistItems({
    planId: basePlan.id,
    automaticCourseList: buildAutomaticCourseList(basePlan.id),
    applicationChecklist,
    beforeEnrollmentChecklist,
    stayAtGrcChecklist,
  });
  applicationChecklist = appendUniqueChecklistItems(
    applicationChecklist,
    derivedComputingChecklistItems.beforeApplication
  );
  beforeEnrollmentChecklist = appendUniqueChecklistItems(
    beforeEnrollmentChecklist,
    derivedComputingChecklistItems.beforeEnrollment
  );
  stayAtGrcChecklist = appendUniqueChecklistItems(
    stayAtGrcChecklist,
    derivedComputingChecklistItems.stayAtGrc
  );
  const synthesizedChecklistItems = buildAutomaticCoursePoolChecklistItems({
    planId: basePlan.id,
    automaticCourseList: buildAutomaticCourseList(basePlan.id),
    applicationChecklist,
    beforeEnrollmentChecklist,
    stayAtGrcChecklist,
  });
  applicationChecklist = appendUniqueChecklistItems(
    applicationChecklist,
    synthesizedChecklistItems.beforeApplication
  );
  beforeEnrollmentChecklist = appendUniqueChecklistItems(
    beforeEnrollmentChecklist,
    synthesizedChecklistItems.beforeEnrollment
  );
  stayAtGrcChecklist = appendUniqueChecklistItems(
    stayAtGrcChecklist,
    synthesizedChecklistItems.stayAtGrc
  );
  const prunedBeforeEnrollmentChecklist = pruneRedundantRuntimeChecklistItems(
    beforeEnrollmentChecklist,
    getChecklistCoverageCourseCodes(applicationChecklist)
  );
  const prunedStayAtGrcChecklist = pruneRedundantRuntimeChecklistItems(
    stayAtGrcChecklist,
    getChecklistCoverageCourseCodes([
      ...applicationChecklist,
      ...prunedBeforeEnrollmentChecklist,
    ])
  );
  const automaticCourseList = buildAutomaticCourseList(basePlan.id);
  const automaticTrackMatchCourseList = buildAutomaticTrackMatchCourseList(basePlan.id, null);
  const studentVisibleCourseList = buildStudentVisibleAutomaticCourseList({
    grcCourseList: automaticCourseList,
    applicationChecklist,
    beforeEnrollmentChecklist: prunedBeforeEnrollmentChecklist,
    stayAtGrcChecklist: prunedStayAtGrcChecklist,
  });
  const studentVisibleTrackMatchCourseList =
    basePlan.id === UW_SEATTLE_BIOENGINEERING_PLAN_ID
      ? studentVisibleCourseList
      : buildStudentVisibleTrackMatchCourseList({
          grcCourseList: automaticTrackMatchCourseList,
          applicationChecklist,
          beforeEnrollmentChecklist: prunedBeforeEnrollmentChecklist,
          stayAtGrcChecklist: prunedStayAtGrcChecklist,
        });

  const runtimePlan = applyStrictSourceBackedFallback(
    applyAutoTrackRecommendationFromStudentVisibleList({
        ...basePlan,
        coverage: promoteStructuredCoverage(
          {
            ...basePlan,
            applicationChecklist,
            beforeEnrollmentChecklist: prunedBeforeEnrollmentChecklist,
            stayAtGrcChecklist: prunedStayAtGrcChecklist,
            grcCourseList: studentVisibleCourseList,
          }
        ).coverage,
        summary: "",
        bestTrackId: null,
        recommendedTrackSummary: "",
        whyThisTrack: [],
        applicationChecklist,
        beforeEnrollmentChecklist: prunedBeforeEnrollmentChecklist,
        stayAtGrcChecklist: prunedStayAtGrcChecklist,
        advisorFlags: [],
        officialLinks: [],
        degreeMapSections: [],
        validationNotes: [],
        grcCourseList: studentVisibleTrackMatchCourseList,
        grcCourseListGuidance: undefined,
        plannerNote: undefined,
        pathways: orderByBaseIds(
          materializedBasePathways.map((pathway) => buildStudentRuntimePathway(basePlan, pathway)),
          materializedBasePathways.map((pathway) => pathway.id)
        ),
        requirementGroups: getRequirementGroupsForScope(basePlan.id),
        requirementReplacements: getRequirementReplacementsForScope(basePlan.id),
        supportLists: getRequirementSupportListsForScope(basePlan.id),
    }, {
      trackMatchCourseList: studentVisibleTrackMatchCourseList,
      studentVisibleCourseList,
    }),
    null
  );

  const runtimePlanWithCuratedTrack = applyCuratedComputerEngineeringTrack(
    runtimePlan,
    basePlan.id
  );

  return applyStudentVisibleTrackCourseList(
    {
      ...runtimePlanWithCuratedTrack,
      grcCourseList: studentVisibleCourseList,
    }
  );
}

function suppressUnselectedChoiceCourseLabels(
  labels: string[],
  checklistItems: TransferPlannerChecklistItem[]
) {
  const selectedChoiceCourseCodes = new Set<string>();
  const unselectedChoiceCourseCodes = new Set<string>();

  for (const item of checklistItems) {
    const group = item.requirementGroup;
    if (
      !group ||
      (group.requirementType !== "choose_one" && group.requirementType !== "sequence_choice")
    ) {
      continue;
    }

    const selectedOptionIds = new Set(item.selectedRequirementOptionIds ?? []);
    const unselectedOptionIds = new Set(item.unselectedRequirementOptionIds ?? []);
    if (!selectedOptionIds.size || !unselectedOptionIds.size) {
      continue;
    }

    for (const option of group.options ?? []) {
      const optionId = option.id ?? "";
      if (!optionId) {
        continue;
      }

      const targetSet = selectedOptionIds.has(optionId)
        ? selectedChoiceCourseCodes
        : unselectedOptionIds.has(optionId)
          ? unselectedChoiceCourseCodes
          : null;
      if (!targetSet) {
        continue;
      }

      for (const courseCode of getRequirementOptionCourseLabels(option)) {
        const normalizedCourseCode = normalizeCourseCode(courseCode);
        if (normalizedCourseCode) {
          targetSet.add(normalizedCourseCode);
        }
      }
    }
  }

  if (!unselectedChoiceCourseCodes.size) {
    return labels;
  }

  return labels.filter((label) =>
    extractReferenceCourseCodes(label).some((courseCode) => {
      const normalizedCourseCode = normalizeCourseCode(courseCode);
      return (
        !unselectedChoiceCourseCodes.has(normalizedCourseCode) ||
        selectedChoiceCourseCodes.has(normalizedCourseCode)
      );
    })
  );
}

function filterChecklistItemsAgainstUnselectedChoices(
  items: TransferPlannerChecklistItem[],
  checklistItemsForSelections: TransferPlannerChecklistItem[]
) {
  const selectedChoiceCourseCodes = new Set<string>();
  const unselectedChoiceCourseCodes = new Set<string>();

  for (const item of checklistItemsForSelections) {
    const group = item.requirementGroup;
    if (
      !group ||
      (group.requirementType !== "choose_one" && group.requirementType !== "sequence_choice")
    ) {
      continue;
    }

    const selectedOptionIds = new Set(item.selectedRequirementOptionIds ?? []);
    const unselectedOptionIds = new Set(item.unselectedRequirementOptionIds ?? []);
    if (!selectedOptionIds.size || !unselectedOptionIds.size) {
      continue;
    }

    for (const option of group.options ?? []) {
      const optionId = option.id ?? "";
      if (!optionId) {
        continue;
      }

      const targetSet = selectedOptionIds.has(optionId)
        ? selectedChoiceCourseCodes
        : unselectedOptionIds.has(optionId)
          ? unselectedChoiceCourseCodes
          : null;
      if (!targetSet) {
        continue;
      }

      for (const courseCode of getRequirementOptionCourseLabels(option)) {
        const normalizedCourseCode = normalizeCourseCode(courseCode);
        if (normalizedCourseCode) {
          targetSet.add(normalizedCourseCode);
        }
      }
    }
  }

  if (!unselectedChoiceCourseCodes.size) {
    return items;
  }

  return items.filter((item) => {
    if (item.requirementGroup) {
      return true;
    }

    const itemCourseCodes = getChecklistReferenceCoursesFromItems([item])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean);
    return !(
      itemCourseCodes.length > 0 &&
      itemCourseCodes.every(
        (courseCode) =>
          unselectedChoiceCourseCodes.has(courseCode) &&
          !selectedChoiceCourseCodes.has(courseCode)
      )
    );
  });
}

function materializePlannerPathway(pathway: TransferPlannerMajorPathway): TransferPlannerMajorPathway {
  const checklistItems = [
    ...(pathway.applicationChecklist ?? []),
    ...(pathway.beforeEnrollmentChecklist ?? []),
    ...(pathway.stayAtGrcChecklist ?? []),
  ];

  return {
    ...pathway,
    grcCourseList: suppressUnselectedChoiceCourseLabels(
      uniqueReferenceCourseLabels([
        ...(pathway.grcCourseList ?? []),
        ...getChecklistReferenceCoursesFromItems(checklistItems),
      ]),
      checklistItems
    ),
    advisorFlags: sanitizePlannerOwnedStrings(pathway.advisorFlags ?? []),
    officialLinks: uniquePlannerLinks(pathway.officialLinks ?? []),
    validationNotes: sanitizePlannerOwnedStrings(pathway.validationNotes ?? []),
    grcCourseListGuidance: sanitizePlannerOwnedText(pathway.grcCourseListGuidance) || undefined,
    whyThisTrack: sanitizePlannerOwnedStrings(pathway.whyThisTrack ?? []),
    requirementReplacements: uniqueRequirementReplacements(pathway.requirementReplacements ?? []),
    supportLists: uniqueRequirementSupportLists(pathway.supportLists ?? []),
  };
}

function getPlanMaterializationParsedRequirementSourceBlocks(planId: string) {
  return TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.filter(
    (entry) =>
      entry.planId === planId &&
      entry.ok &&
      canParsedRequirementSourceBlockCreateRequiredScheduleRows(entry)
  );
}

function materializePlanPathways(plan: TransferPlannerMajorPlan, includeHiddenSourceGaps = true) {
  const pathways = buildBootstrapBasePathways(plan).map(materializePlannerPathway);
  const visibleBasePathways = includeHiddenSourceGaps
    ? pathways
    : pathways.filter((pathway) => !isTransferPlannerStudentHiddenSourceGap(plan.id, pathway.id));

  return materializeTransferPlannerPathways(
    plan,
    visibleBasePathways,
    getPlanMaterializationParsedRequirementSourceBlocks(plan.id)
  );
}

function materializePlanReferenceCourses(plan: TransferPlannerMajorPlan): TransferPlannerMajorPlan {
  const checklistItems = [
    ...(plan.applicationChecklist ?? []),
    ...(plan.beforeEnrollmentChecklist ?? []),
    ...(plan.stayAtGrcChecklist ?? []),
  ];

  return {
    ...plan,
    applicationChecklist: normalizeChecklistItems(plan.applicationChecklist),
    beforeEnrollmentChecklist: normalizeChecklistItems(plan.beforeEnrollmentChecklist),
    stayAtGrcChecklist: normalizeChecklistItems(plan.stayAtGrcChecklist),
    pathways: materializePlanPathways(plan),
    grcCourseList: suppressUnselectedChoiceCourseLabels(
      uniqueReferenceCourseLabels([
        ...(plan.grcCourseList ?? []),
        ...getChecklistReferenceCoursesFromItems(checklistItems),
      ]),
      checklistItems
    ),
    supportLists: uniqueRequirementSupportLists(plan.supportLists ?? []),
  };
}

function mergePlannerPathwayWithPlan(
  plan: TransferPlannerMajorPlan,
  pathway: TransferPlannerMajorPathway,
  visiblePathways = materializePlanPathways(plan)
): TransferPlannerResolvedMajorPlan {
  const trackMetadata = getPathwayScopedTrackMetadata(plan, pathway);
  const mergedRequirementGroups = uniqueRequirementGroupsForPathwayScope(
    [
      ...(plan.requirementGroups ?? []).map((group) =>
        applyRequirementGroupPathwayRestrictions(group, pathway.id)
      ).filter((group) => group.options.length > 0),
      ...(pathway.requirementGroups ?? []),
    ],
    pathway.id
  );
  const nmeSourceIncompleteWarnings = buildMaterialsScienceNmeSourceIncompleteWarnings(
    plan.id,
    pathway.id,
    mergedRequirementGroups
  );
  const applicationChecklist = appendUniqueChecklistItems(
    plan.applicationChecklist ?? [],
    pathway.applicationChecklist ?? []
  )
    .map((item) => applyChecklistItemPathwayRestrictions(item, pathway.id))
    .filter((item): item is TransferPlannerChecklistItem => Boolean(item));
  const beforeEnrollmentChecklist = appendUniqueChecklistItems(
    plan.beforeEnrollmentChecklist ?? [],
    pathway.beforeEnrollmentChecklist ?? []
  )
    .map((item) => applyChecklistItemPathwayRestrictions(item, pathway.id))
    .filter((item): item is TransferPlannerChecklistItem => Boolean(item));
  const stayAtGrcChecklist = appendUniqueChecklistItems(
    plan.stayAtGrcChecklist ?? [],
    pathway.stayAtGrcChecklist ?? []
  )
    .map((item) => applyChecklistItemPathwayRestrictions(item, pathway.id))
    .filter((item): item is TransferPlannerChecklistItem => Boolean(item));
  const selectionScopedChecklistItems = [
    ...applicationChecklist,
    ...beforeEnrollmentChecklist,
    ...stayAtGrcChecklist,
  ];
  const mergedPlan = materializePlanReferenceCourses({
    ...plan,
    applicationChecklist: filterChecklistItemsAgainstUnselectedChoices(
      applicationChecklist,
      selectionScopedChecklistItems
    ),
    beforeEnrollmentChecklist: filterChecklistItemsAgainstUnselectedChoices(
      beforeEnrollmentChecklist,
      selectionScopedChecklistItems
    ),
    stayAtGrcChecklist: filterChecklistItemsAgainstUnselectedChoices(
      stayAtGrcChecklist,
      selectionScopedChecklistItems
    ),
    advisorFlags: sanitizePlannerOwnedStrings([
      ...(plan.advisorFlags ?? []),
      ...(pathway.advisorFlags ?? []),
      ...nmeSourceIncompleteWarnings,
    ]),
    officialLinks: uniquePlannerLinks([...(plan.officialLinks ?? []), ...(pathway.officialLinks ?? [])]),
    degreeMapSections: (pathway.degreeMapSections ?? plan.degreeMapSections)?.map((section) =>
      sanitizeDegreeMapSection(section)
    ),
    validationNotes: sanitizePlannerOwnedStrings([
      ...(plan.validationNotes ?? []),
      ...(pathway.validationNotes ?? []),
      ...nmeSourceIncompleteWarnings,
    ]),
    grcCourseListGuidance: sanitizePlannerOwnedText(
      pathway.grcCourseListGuidance ?? plan.grcCourseListGuidance
    ),
    grcCourseList:
      pathway.grcCourseList && pathway.grcCourseList.length
        ? pathway.grcCourseList
        : plan.grcCourseList,
    plannerNote: sanitizePlannerOwnedText(pathway.plannerNote ?? plan.plannerNote),
    bestTrackId: trackMetadata.bestTrackId,
    recommendedTrackSummary: sanitizePlannerOwnedText(
      trackMetadata.recommendedTrackSummary
    ),
    whyThisTrack: sanitizePlannerOwnedStrings(trackMetadata.whyThisTrack),
    requirementGroups: mergedRequirementGroups,
    requirementReplacements: uniqueRequirementReplacements([
      ...(plan.requirementReplacements ?? []),
      ...(pathway.requirementReplacements ?? []),
      ...getRequirementReplacementsForScope(plan.id, pathway.id),
    ]),
    supportLists: uniqueRequirementSupportLists([
      ...(plan.supportLists ?? []),
      ...(pathway.supportLists ?? []),
      ...getRequirementSupportListsForScope(plan.id, pathway.id),
    ]),
  });

  return {
    ...mergedPlan,
    pathways: visiblePathways,
    selectedPathwayId: pathway.id,
    selectedPathwayLabel: pathway.label,
    selectedPathwaySummary: pathway.summary,
  };
}

const TRACKS_BY_ID = new Map(
  TRANSFER_PLANNER_BOOTSTRAP_TRACKS.map((track) => [track.id, track] as const)
);
const TRACK_REFERENCE_CODES_BY_ID = new Map(
  TRANSFER_PLANNER_BOOTSTRAP_TRACKS.map(
    (track) =>
      [
        track.id,
        buildTrackReferenceCourseCodes(track, {
          includeCatalogYears: false,
          autoMatchOnly: true,
        }),
      ] as const
  )
);

const GRC_AVAILABILITY_BY_CODE = TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY as Record<
  string,
  TransferPlannerGrcCourseAvailabilityEntry
>;

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

function formatAvailabilityStatusSummary(
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
          .map((quarter) => QUARTER_LABELS[String(quarter)] ?? quarter)
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

export const TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS: TransferPlannerMajorPlan[] =
  ALL_BASE_MAJOR_PLANS.map(buildSourceGeneratedPlan);
export const TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS: TransferPlannerMajorPlan[] =
  ALL_BASE_MAJOR_PLANS.map((plan) => normalizeCategoryOptionRuntimePlan(buildStudentRuntimePlan(plan)));

export const TRANSFER_PLANNER_CAMPUSES: TransferPlannerCampus[] = TRANSFER_PLANNER_BOOTSTRAP_CAMPUSES;
export const TRANSFER_PLANNER_TRACKS: TransferPlannerTrack[] = TRANSFER_PLANNER_BOOTSTRAP_TRACKS;

export function getTransferPlannerSourceGeneratedMajorsForCampus(
  campusId: TransferPlannerCampusId
) {
  return appendDerivedSharedSourcePlans(
    TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.filter((plan) => plan.campusId === campusId)
  );
}

export function getTransferPlannerStudentVisibleSourceGeneratedMajorsForCampus(
  campusId: TransferPlannerCampusId
) {
  return getTransferPlannerSourceGeneratedMajorsForCampus(campusId).filter(
    (plan) => !isTransferPlannerStudentHiddenSourceGap(plan.id)
  );
}

export function getTransferPlannerStudentVisibleMajorsForCampus(campusId: TransferPlannerCampusId) {
  return getTransferPlannerStudentVisibleSourceGeneratedMajorsForCampus(campusId);
}

export function getTransferPlannerStudentRuntimeMajorsForCampus(
  campusId: TransferPlannerCampusId
) {
  return appendDerivedSharedSourcePlans(
    TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS.filter(
      (plan) => plan.campusId === campusId && !isTransferPlannerStudentHiddenSourceGap(plan.id)
    )
  );
}

export function getTransferPlannerSourceGeneratedMajorPlan(planId: string) {
  const resolvedPlanId = resolveTransferPlannerPlanIdAlias(planId);
  const directPlan =
    TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.find((plan) => plan.id === resolvedPlanId) ?? null;
  if (directPlan) {
    return directPlan;
  }

  return (
    appendDerivedSharedSourcePlans(TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS).find(
      (plan) => plan.id === resolvedPlanId
    ) ?? null
  );
}

export function getTransferPlannerMajorsForCampus(campusId: TransferPlannerCampusId) {
  return getTransferPlannerSourceGeneratedMajorsForCampus(campusId);
}

export function getTransferPlannerMajorPlan(planId: string) {
  return getTransferPlannerSourceGeneratedMajorPlan(planId);
}

export function getTransferPlannerStudentRuntimeMajorPlan(planId: string) {
  const resolvedPlanId = resolveTransferPlannerPlanIdAlias(planId);
  const directPlan =
    TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS.find((plan) => plan.id === resolvedPlanId) ?? null;
  if (directPlan) {
    return directPlan;
  }

  return (
    appendDerivedSharedSourcePlans(TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS).find(
      (plan) => plan.id === resolvedPlanId
    ) ?? null
  );
}

export function getTransferPlannerPathwaysForPlan(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) return [] as TransferPlannerMajorPathway[];
  return materializePlanPathways(plan);
}

export function getTransferPlannerStudentVisiblePathwaysForPlan(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) return [] as TransferPlannerMajorPathway[];
  return materializePlanPathways(plan, false);
}

export function getTransferPlannerStudentRuntimePathwaysForPlan(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) return [] as TransferPlannerMajorPathway[];
  if (COMPACT_NORMALIZED_RUNTIME_PLAN_IDS.has(plan.id)) {
    return materializePlanPathways(
      getTransferPlannerSourceGeneratedMajorPlan(plan.id) ?? plan,
      false
    );
  }
  return materializePlanPathways(plan, false);
}

export function resolveTransferPlannerMajorPlan(
  plan: TransferPlannerMajorPlan | null | undefined,
  pathwayId: string | null | undefined
) {
  if (!plan) return null as TransferPlannerResolvedMajorPlan | null;

  const pathways = materializePlanPathways(plan);
  if (!pathways.length) {
    return {
      ...materializePlanReferenceCourses(plan),
      pathways: [],
      selectedPathwayId: null,
      selectedPathwayLabel: null,
      selectedPathwaySummary: null,
    };
  }

  const selectedPathway = pickResolvedPlannerPathway(pathways, pathwayId);
  if (!selectedPathway) {
    return {
      ...materializePlanReferenceCourses(plan),
      pathways,
      selectedPathwayId: null,
      selectedPathwayLabel: null,
      selectedPathwaySummary: null,
    };
  }

  return mergePlannerPathwayWithPlan(plan, selectedPathway, pathways);
}

export function resolveTransferPlannerStudentRuntimeMajorPlan(
  plan: TransferPlannerMajorPlan | null | undefined,
  pathwayId: string | null | undefined
) {
  if (!plan) return null as TransferPlannerResolvedMajorPlan | null;
  if (COMPACT_NORMALIZED_RUNTIME_PLAN_IDS.has(plan.id)) {
    const normalizedPlan = resolveCompactStudentRuntimeMajorPlan(plan, pathwayId);
    const pathways = materializePlanPathways(
      getTransferPlannerSourceGeneratedMajorPlan(plan.id) ?? plan,
      false
    );
    const selectedPathway = pickResolvedPlannerPathway(pathways, pathwayId);
    return normalizedPlan
      ? {
          ...normalizedPlan,
          pathways,
          selectedPathwayId: selectedPathway?.id ?? normalizedPlan.selectedPathwayId,
          selectedPathwayLabel: selectedPathway?.label ?? normalizedPlan.selectedPathwayLabel,
          selectedPathwaySummary:
            selectedPathway?.summary ?? normalizedPlan.selectedPathwaySummary,
        }
      : null;
  }

  const pathways = (plan.pathways ?? []).length ? plan.pathways ?? [] : materializePlanPathways(plan, false);
  if (!pathways.length) {
    return {
      ...materializePlanReferenceCourses(plan),
      pathways: [],
      selectedPathwayId: null,
      selectedPathwayLabel: null,
      selectedPathwaySummary: null,
    };
  }

  const selectedPathway = pickResolvedPlannerPathway(pathways, pathwayId);
  if (!selectedPathway) {
    return {
      ...materializePlanReferenceCourses(plan),
      pathways,
      selectedPathwayId: null,
      selectedPathwayLabel: null,
      selectedPathwaySummary: null,
    };
  }

  return mergePlannerPathwayWithPlan(plan, selectedPathway, pathways);
}

export function getTransferPlannerGrcCourseList(
  plan: TransferPlannerMajorPlan | TransferPlannerResolvedMajorPlan | null | undefined
) {
  if (!plan) return [] as string[];

  return filterCanonicalGrcCourseLabels([
    ...(plan.grcCourseList ?? []),
    ...getChecklistReferenceCourses(plan),
  ]);
}

export function getTransferPlannerGrcCourseListGuidance(
  plan: TransferPlannerMajorPlan | TransferPlannerResolvedMajorPlan | null | undefined
) {
  const guidance = String(plan?.grcCourseListGuidance ?? "").trim();
  return guidance || null;
}

export function getTransferPlannerTrack(trackId: string | null) {
  if (!trackId) return null;
  return TRACKS_BY_ID.get(trackId) ?? null;
}

export function getTransferPlannerGrcCourseLatestPublishedQuarters(
  courseLabel: string | null | undefined
) {
  return getTransferPlannerGrcCourseAvailability(courseLabel)?.latestPublishedQuarters ?? null;
}

export function getTransferPlannerGrcCourseAvailability(
  courseLabel: string | null | undefined
) {
  for (const code of extractReferenceCourseCodes(String(courseLabel ?? ""))) {
    const entry = GRC_AVAILABILITY_BY_CODE[code];
    if (!entry) continue;

    return {
      courseCode: code,
      status: entry.status,
      years: entry.years.map((year) => ({
        label: year.label,
        quarters: [...year.quarters],
      })),
      latestPublishedQuarters: [...entry.latestPublishedQuarters],
    } satisfies TransferPlannerCourseAvailability;
  }

  return null;
}

export function getTransferPlannerGrcCourseAvailabilitySummary(
  courseLabel: string | null | undefined
) {
  const availability = getTransferPlannerGrcCourseAvailability(courseLabel);
  if (!availability) return null;
  return formatAvailabilityStatusSummary(availability);
}

export type {
  TransferPlannerCampus,
  TransferPlannerCampusId,
  TransferPlannerChecklistItem,
  TransferPlannerDegreeMapSection,
  TransferPlannerGeneralRequirementCategoryId,
  TransferPlannerGeneralRequirementItem,
  TransferPlannerGeneralRequirementPlannerUsage,
  TransferPlannerGeneralRequirementSection,
  TransferPlannerGeneralRequirementSourceKind,
  TransferPlannerMajorPathway,
  TransferPlannerMajorPlan,
  TransferPlannerRequirementGroup,
  TransferPlannerRequirementOption,
  TransferPlannerRequirementType,
  TransferPlannerResolvedMajorPlan,
  TransferPlannerCourseAvailability,
  TransferPlannerTrack,
} from "../transfer-planner-types";
