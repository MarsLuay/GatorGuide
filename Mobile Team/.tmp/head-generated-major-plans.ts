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
import type {
  TransferPlannerDegreeMapBlock,
  TransferPlannerMajorPathwayEntry,
  TransferPlannerMajorRequirementAtom,
  TransferPlannerParsedRequirementAtomCandidate,
  TransferPlannerPolicyEntry,
  TransferPlannerRequirementDiffClassificationEntry,
  TransferPlannerRequirementPhase,
  TransferPlannerSourceLink,
} from "./schema";

const STRUCTURED_GRC_SOURCE_KINDS = new Set(["plan-checklist", "plan-course-list"]);
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
const AUTO_MATCH_EXCLUDED_TRACK_TERM_LABEL_PATTERN =
  /\b(transferability of credits|generally transferable courses|section [a-z])\b/i;
const REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE =
  "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way.";
const AUTO_SOURCE_BACKED_UW_PREP_TARGET_PREFIX = "UW prep target:";
const AUTO_SOURCE_BACKED_UW_PREP_TARGET_NOTE =
  "Official UW prep target found in the current source-backed requirements, but no public Green River equivalent is currently provable.";
const AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_TITLE = "Source-backed UW prep guidance";
const AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_NOTE =
  "Current official source-backed requirement materials identify more UW prep for this major, but the published Green River equivalent path is not yet provable enough for planner-ready course mapping.";
const MAX_SOURCE_BACKED_UW_PREP_TARGET_COUNT = 18;
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
const SOURCE_BACKED_NON_REQUIREMENT_CUE_PATTERN =
  /\b(suggested general education|not required for transferring|approved list|highly recommended|elective|replacement|course list|course lists|course evaluation|course evaluations|capstone course|capstone courses|suggested course pathways?)\b/i;
const DEGREE_MAP_GUIDE_BLOCK_TITLE_EXCLUSION_PATTERN = /\bchoices and pathway notes\b/i;
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
};

const SUPPLEMENTAL_CHECKLIST_SEEDS_BY_PLAN: Partial<
  Record<string, SupplementalChecklistSeed[]>
> = {
  "uw-seattle-computer-engineering": [
    {
      id: "calc123",
      phase: "before-application",
      title: "Calculus I-III sequence",
      grcCourses: ["MATH& 151", "MATH& 152", "MATH& 163"],
      alternatives: [["MATH& 151", "MATH& 152", "MATH& 153", "MATH& 254"]],
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
  "uw-seattle-computer-science": [
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
  "uw-seattle-bioengineering": [
    {
      id: "biol180",
      phase: "before-application",
      title: "BIOL 180 pathway",
      grcCourses: ["BIOL& 211", "BIOL& 212", "BIOL& 213"],
    },
    {
      id: "programming",
      phase: "before-application",
      title: "Programming",
      grcCourses: ["ENGR 250"],
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

const GUIDE_RULES_BY_TARGET_COURSE_CODE = new Map<
  string,
  Array<(typeof TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY)[number]>
>();

for (const rule of TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY) {
  if (!GUIDE_BACKED_EQUIVALENCY_RULE_SOURCE_KINDS.has(rule.sourceKind ?? "")) continue;
  if (rule.acceptanceCategory === "no-credit") continue;
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
for (const classification of TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_REGISTRY) {
  const scopeKey = makePathwayPlanKey(classification.planId, classification.pathwayId);
  const normalizedSourceCourseCode = normalizeCourseCode(classification.sourceUwCourseCode);
  if (!normalizedSourceCourseCode) continue;

  const entryKey = buildSourceBackedScopeCourseKey(scopeKey, normalizedSourceCourseCode);
  const existingEntries =
    SOURCE_BACKED_CLASSIFICATIONS_BY_SCOPE_AND_SOURCE_COURSE.get(entryKey) ?? [];
  existingEntries.push(classification);
  SOURCE_BACKED_CLASSIFICATIONS_BY_SCOPE_AND_SOURCE_COURSE.set(entryKey, existingEntries);
}

const SOURCE_BACKED_GUIDE_COURSES_BY_KEY = new Map<PathwayPlanKey, string[]>();
for (const parsedSource of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY) {
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
    ].sort(compareGuideRules);
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
    const topRule = [
      ...(GUIDE_RULES_BY_TARGET_COURSE_CODE.get(normalizedUwCourseCode) ?? []),
    ].sort(compareGuideRules)[0];
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

type ChecklistItemSource = Pick<
  TransferPlannerMajorRequirementAtom,
  "id" | "title" | "grcCourseCodes" | "alternativeCourseCodeSets" | "note"
> & {
  minCompletedCount?: number | null;
};

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
          : entry.pathwayId === pathwayId)
  ).flatMap((entry) => entry.parsedRequirementAtomCandidates);
}

function getRequirementCueLinesFromClassification(
  entry: TransferPlannerRequirementDiffClassificationEntry
) {
  return entry.validationNotes
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
  // Keep UW-only guidance placeholders out of the student planner until there is a
  // source-backed GRC course path we can actually show.
  if (!getChecklistReferenceCoursesFromItems([item]).length) {
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
        (scope.pathwayId ? entry.pathwayId === scope.pathwayId : !entry.pathwayId)
    ) ?? null;
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

  const targetCourseCodeSet = new Set(bestGuideRuleGroup.targetCourseCodes);
  const checklistItem = sanitizeChecklistItem({
    id: buildAutoChecklistItemId(
      `${scope.planId}-${scope.pathwayId ?? "base"}-programming-sequence`,
      0
    ),
    title: buildComputingSequenceChecklistTitle([...targetCourseCodeSet]),
    grcCourses: bestGuideRuleGroup.bestSourceCourseSet,
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
  courseFallbacks: string[]
) {
  const grcCourses = uniqueReferenceCourseLabels(
    seed.grcCourses?.length ? seed.grcCourses : courseFallbacks.slice(0, seed.fallbackCourseCount ?? 0)
  );
  const alternatives = (seed.alternatives ?? [])
    .map((group) => uniqueReferenceCourseLabels(group))
    .filter((group) => group.length > 0);

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
    });
  }

  return sanitizeChecklistItem({
    id: seed.id,
    title: seed.title,
    grcCourses,
    alternatives: alternatives.length ? alternatives : undefined,
    minCompletedCount: seed.minCompletedCount,
    note: seed.note,
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

  for (const seed of seeds) {
    const item = materializeSupplementalChecklistItem(seed, fallbackCourseList);
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
  if (fallbackCourse) {
    return {
      beforeApplication: [],
      beforeEnrollment: [
        sanitizeChecklistItem({
          id: buildAutoChecklistItemId(`${scope.id}-source-backed-course`, 0),
          title: fallbackCourse,
          grcCourses: [fallbackCourse],
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
  addFallbackChecklistItemForPhase(checklists, phase, {
    id: buildAutoChecklistItemId(`source-guidance-${scope.planId}-${scope.pathwayId ?? "base"}`, 0),
    title: AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_TITLE,
    grcCourses: [],
    note: AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_NOTE,
  });
  return checklists;
}

function buildStrictSourceBackedFallbackChecklists(scope: {
  planId: string;
  pathwayId?: string | null;
  includeParsedCandidates: boolean;
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
    if (!isLowerDivisionSourceBackedFallbackCode(normalizedCode)) {
      continue;
    }

    const classification = classificationRecord?.classification ?? null;
    const candidate = candidateRecord?.candidate ?? null;
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
  const fallbackChecklists = buildStrictSourceBackedFallbackChecklists({
    planId: scope.id,
    pathwayId,
    includeParsedCandidates: !hasExistingChecklistCoverage && !hasExistingCourseListCoverage,
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

  if (checklistLabels.length) {
    return checklistLabels;
  }

  return uniqueReferenceCourseLabels([...(scope.grcCourseList ?? [])]);
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
  matchCount: number;
  totalTrackCourseCount: number;
}) {
  const matchedExamples = scope.matchedCourseLabels.slice(0, AUTO_TRACK_MATCH_EXAMPLE_LIMIT);
  const remainingCount = Math.max(scope.matchedCourseLabels.length - matchedExamples.length, 0);
  const examplesLabel = matchedExamples.join(", ");
  const examplesNote = matchedExamples.length
    ? `, including ${examplesLabel}${remainingCount > 0 ? `, plus ${remainingCount} more` : ""}`
    : "";

  return [
    `${scope.track.code} has the strongest direct overlap with the current degree-specific Green River class list${examplesNote}.`,
    `This auto-match compares every hardcoded course in the current Green River transfer tracks against the major's tracked Green River classes and keeps the track with the highest concrete course overlap.`,
    `Use the remaining major-specific checklist items to add the classes that ${scope.track.code} does not cover by itself.`,
  ];
}

export function getTransferPlannerAutoMatchedTrackRecommendation(
  grcCourseList: string[],
  preferredTrackId: string | null = null
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
  const scoredTrackCandidates = TRANSFER_PLANNER_BOOTSTRAP_TRACKS.map((track) => {
    const trackCourseCodes = TRACK_REFERENCE_CODES_BY_ID.get(track.id) ?? [];
    const matchedCourseCodes = trackCourseCodes.filter((code) => planCourseCodeSet.has(code));
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
      preferred: track.id === preferredTrackId,
    };
  });

  const minimumMatchCount = MIN_AUTO_TRACK_MATCH_COUNT;
  let scoredTracks = scoredTrackCandidates.filter(
    (entry) => entry.matchCount >= minimumMatchCount
  );

  // For plans without a curated preferred track, keep a best-effort auto-match even
  // when only 1-2 source-backed course overlaps are currently available.
  if (!scoredTracks.length && !preferredTrackId) {
    scoredTracks = scoredTrackCandidates.filter((entry) => entry.matchCount >= 1);
  }

  if (!scoredTracks.length) {
    return null;
  }

  scoredTracks.sort((left, right) => {
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
      matchCount: winner.matchCount,
      totalTrackCourseCount: winner.trackCourseCodes.length,
    }),
    matchCount: winner.matchCount,
    matchedCourseCodes: [...winner.matchedCourseCodes],
    matchedCourseLabels: [...winner.matchedCourseLabels],
    totalPlanCourseCount: planCourseCodes.length,
    totalTrackCourseCount: winner.trackCourseCodes.length,
  };
}

function applyAutoTrackRecommendation<T extends {
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
  }
): T {
  const autoTrack = getTransferPlannerAutoMatchedTrackRecommendation(
    options?.trackMatchCourseList?.length
      ? uniqueReferenceCourseLabels(options.trackMatchCourseList)
      : collectPlannerCourseLabels(scope),
    scope.bestTrackId ?? null
  );

  if (!autoTrack || scope.bestTrackId === autoTrack.trackId) {
    return scope;
  }

  return {
    ...scope,
    bestTrackId: autoTrack.trackId,
    recommendedTrackSummary: autoTrack.recommendedTrackSummary,
    whyThisTrack: [...autoTrack.whyThisTrack],
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
    return (plan.pathways ?? []).map((pathway) => ({
      ...pathway,
      label: resolveStructuredPathwayLabel(plan.id, plan.title, pathway.id, pathway.label),
    }));
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
  const sourceBackedClassificationCodes = scopeKeys.flatMap(
    (scopeKey) => SOURCE_BACKED_CLASSIFICATION_COURSES_BY_KEY.get(scopeKey) ?? []
  );
  const degreeMapGuideCodes = scopeKeys.flatMap(
    (scopeKey) => DEGREE_MAP_GUIDE_COURSES_BY_KEY.get(scopeKey) ?? []
  );

  return orderStringsByBase(
    uniquePlannerStrings([
      ...baseCourseOrder,
      ...filteredCodes,
      ...sourceBackedClassificationCodes,
      ...sourceBackedGuideCodes,
      ...degreeMapGuideCodes,
    ]),
    baseCourseOrder
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
  const allItemsForKey = REQUIREMENTS_BY_KEY.get(makePathwayPlanKey(planId, pathwayId)) ?? [];
  const items = allItemsForKey.filter((entry) => entry.displayPhase === phase);

  if (!allItemsForKey.length) {
    return baseItems.map((item) => sanitizeChecklistItem(item));
  }

  return orderByBaseIds(
    items.map(buildChecklistItem),
    baseItems.map((item) => item.id)
  );
}

function buildDegreeMapSections(
  planId: string,
  baseSections: TransferPlannerDegreeMapSection[] | undefined,
  pathwayId?: string | null
) {
  const blocks = DEGREE_MAPS_BY_KEY.get(makePathwayPlanKey(planId, pathwayId)) ?? [];
  if (!blocks.length) {
    return baseSections?.map((section) => sanitizeDegreeMapSection(section));
  }

  return orderByBaseIds(
    blocks.map(buildDegreeMapSection),
    (baseSections ?? []).map((section) => section.id)
  );
}

function buildTrackMatchCourseList(scope: {
  grcCourseList: string[];
  applicationChecklist: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist: TransferPlannerChecklistItem[];
  stayAtGrcChecklist: TransferPlannerChecklistItem[];
}, planId: string, pathwayId?: string | null) {
  const automaticTrackMatchCourseList = buildAutomaticTrackMatchCourseList(planId, pathwayId);

  return orderStringsByBase(
    uniqueReferenceCourseLabels([
      ...automaticTrackMatchCourseList,
      ...buildStudentVisibleTrackMatchCourseList({
        ...scope,
        grcCourseList: uniqueReferenceCourseLabels([
          ...(scope.grcCourseList ?? []),
          ...automaticTrackMatchCourseList,
        ]),
      }),
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
  const registryPathway =
    PATHWAYS_BY_PLAN.get(basePlan.id)?.find((entry) => entry.pathwayId === basePathway.id) ?? null;
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
    bestTrackId:
      policy?.bestTrackId === undefined ? basePathway.bestTrackId : policy.bestTrackId,
    recommendedTrackSummary: sanitizePlannerOwnedText(
      policy?.recommendedTrackSummary ?? basePathway.recommendedTrackSummary
    ),
    whyThisTrack: sanitizePlannerOwnedStrings(
      policy?.whyThisTrack.length ? [...policy.whyThisTrack] : [...(basePathway.whyThisTrack ?? [])]
    ),
  } satisfies TransferPlannerMajorPathway;

  return applyAutoTrackRecommendation(pathway, {
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
  const structuredPathways = orderByBaseIds(
    (basePlan.pathways ?? []).map((pathway) => buildPathway(basePlan, pathway, degreeMapSections)),
    (basePlan.pathways ?? []).map((pathway) => pathway.id)
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
  };

  const sourceGeneratedWithCompatibility = applyChecklistItemsByPhase(
    sourceGeneratedPlan,
    buildSupplementalChecklistItems(sourceGeneratedPlan)
  );
  const sourceGeneratedWithFallback = applyChecklistItemsByPhase(
    sourceGeneratedWithCompatibility,
    buildSourceGeneratedFallbackChecklistItems(sourceGeneratedWithCompatibility)
  );

  const promotedSourceGeneratedPlan = promoteStructuredCoverage(sourceGeneratedWithFallback);

  return applyAutoTrackRecommendation(promotedSourceGeneratedPlan, {
    trackMatchCourseList: buildTrackMatchCourseList(promotedSourceGeneratedPlan, basePlan.id),
  });
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
  const supportedCourseCodes = new Set(
    buildAutomaticCourseList(planId, pathwayId).map((code) => normalizeCourseCode(code))
  );
  const seenSignatures = new Set<string>();
  const runtimeItems: TransferPlannerChecklistItem[] = [];

  for (const atom of getRuntimeRequirementAtoms(planId, pathwayId)) {
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
    ? getRuntimeRequirementAtoms(planId, pathwayId).flatMap((atom) => [
        ...atom.grcCourseCodes,
        ...(atom.alternativeCourseCodeSets ?? []).flat(),
      ])
    : [];

  return orderStringsByBase(
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
    ]),
    []
  );
}

function buildStudentVisibleAutomaticCourseList(scope: {
  grcCourseList: string[];
  applicationChecklist: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist: TransferPlannerChecklistItem[];
  stayAtGrcChecklist: TransferPlannerChecklistItem[];
}) {
  const checklistCourseList = collectPlannerCourseLabels(scope);
  return orderStringsByBase(
    uniqueReferenceCourseLabels([...(scope.grcCourseList ?? []), ...checklistCourseList]),
    scope.grcCourseList ?? []
  );
}

function buildAutomaticTrackMatchCourseList(planId: string, pathwayId?: string | null) {
  const scopeKeys = getAutomaticScopeKeys(planId, pathwayId);

  return orderStringsByBase(
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
    ]),
    []
  );
}

function buildTrackMatchSeedCourseList(items: TransferPlannerChecklistItem[]) {
  return uniqueReferenceCourseLabels(
    items.flatMap((item) => {
      const targetCount = Math.max(item.minCompletedCount ?? 0, 1);
      if (item.grcCourses.length) {
        return item.grcCourses.slice(0, targetCount);
      }

      const [firstAlternative = []] = item.alternatives ?? [];
      return firstAlternative.slice(0, targetCount);
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

  return orderStringsByBase(
    uniqueReferenceCourseLabels([...(scope.grcCourseList ?? []), ...checklistSeedCourseList]),
    scope.grcCourseList ?? []
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
  const structuredCourseSeed = getStructuredCourseCodesForPlan(
    basePlan.id,
    uniqueReferenceCourseLabels([
      ...(basePlan.grcCourseList ?? []),
      ...(basePathway.grcCourseList ?? []),
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
  const prunedBeforeEnrollmentChecklist = pruneRedundantRuntimeChecklistItems(
    beforeEnrollmentChecklist,
    getChecklistCoverageCourseCodes(applicationChecklistWithDerived)
  );
  const prunedStayAtGrcChecklist = pruneRedundantRuntimeChecklistItems(
    stayAtGrcChecklist,
    getChecklistCoverageCourseCodes([
      ...applicationChecklistWithDerived,
      ...prunedBeforeEnrollmentChecklist,
    ])
  );
  const automaticCourseList = orderStringsByBase(
    uniqueReferenceCourseLabels([
      ...structuredCourseSeed,
      ...buildAutomaticCourseList(basePlan.id, basePathway.id),
    ]),
    structuredCourseSeed
  );
  const automaticTrackMatchCourseList = orderStringsByBase(
    uniqueReferenceCourseLabels([
      ...structuredCourseSeed,
      ...buildAutomaticTrackMatchCourseList(basePlan.id, basePathway.id),
    ]),
    structuredCourseSeed
  );
  const studentVisibleCourseList = buildStudentVisibleAutomaticCourseList({
    grcCourseList: automaticCourseList,
    applicationChecklist: applicationChecklistWithDerived,
    beforeEnrollmentChecklist: prunedBeforeEnrollmentChecklist,
    stayAtGrcChecklist: prunedStayAtGrcChecklist,
  });
  const studentVisibleTrackMatchCourseList = buildStudentVisibleTrackMatchCourseList({
    grcCourseList: automaticTrackMatchCourseList,
    applicationChecklist: applicationChecklistWithDerived,
    beforeEnrollmentChecklist: prunedBeforeEnrollmentChecklist,
    stayAtGrcChecklist: prunedStayAtGrcChecklist,
  });

  const runtimePathway = applyStrictSourceBackedFallback(
    applyAutoTrackRecommendation({
        ...basePathway,
        id: basePathway.id,
        label: resolveStructuredPathwayLabel(
          basePlan.id,
          basePlan.title,
          basePathway.id,
          basePathway.label
        ),
        summary: sanitizePlannerOwnedText(basePathway.summary),
        applicationChecklist: applicationChecklistWithDerived,
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
    } satisfies TransferPlannerMajorPathway, {
      trackMatchCourseList: studentVisibleTrackMatchCourseList,
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
    pathways: basePlan.pathways,
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
  const studentVisibleTrackMatchCourseList = buildStudentVisibleTrackMatchCourseList({
    grcCourseList: automaticTrackMatchCourseList,
    applicationChecklist,
    beforeEnrollmentChecklist: prunedBeforeEnrollmentChecklist,
    stayAtGrcChecklist: prunedStayAtGrcChecklist,
  });

  const runtimePlan = applyStrictSourceBackedFallback(
    applyAutoTrackRecommendation({
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
          (basePlan.pathways ?? []).map((pathway) => buildStudentRuntimePathway(basePlan, pathway)),
          (basePlan.pathways ?? []).map((pathway) => pathway.id)
        ),
    }, {
      trackMatchCourseList: studentVisibleTrackMatchCourseList,
    }),
    null
  );

  return applyStudentVisibleTrackCourseList(
    {
      ...runtimePlan,
      grcCourseList: studentVisibleCourseList,
    }
  );
}

function materializePlannerPathway(pathway: TransferPlannerMajorPathway): TransferPlannerMajorPathway {
  return {
    ...pathway,
    grcCourseList: uniqueReferenceCourseLabels([
      ...(pathway.grcCourseList ?? []),
      ...getChecklistReferenceCoursesFromItems([
        ...(pathway.applicationChecklist ?? []),
        ...(pathway.beforeEnrollmentChecklist ?? []),
        ...(pathway.stayAtGrcChecklist ?? []),
      ]),
    ]),
    advisorFlags: sanitizePlannerOwnedStrings(pathway.advisorFlags ?? []),
    officialLinks: uniquePlannerLinks(pathway.officialLinks ?? []),
    validationNotes: sanitizePlannerOwnedStrings(pathway.validationNotes ?? []),
    grcCourseListGuidance: sanitizePlannerOwnedText(pathway.grcCourseListGuidance) || undefined,
    whyThisTrack: sanitizePlannerOwnedStrings(pathway.whyThisTrack ?? []),
  };
}

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

function materializePlanPathways(plan: TransferPlannerMajorPlan, includeHiddenSourceGaps = true) {
  const pathways = ((plan.pathways ?? []).length
    ? plan.pathways ?? []
    : buildRegistryBackedBasePathways(plan.id)
  ).map(materializePlannerPathway);
  const visibleBasePathways = includeHiddenSourceGaps
    ? pathways
    : pathways.filter((pathway) => !isTransferPlannerStudentHiddenSourceGap(plan.id, pathway.id));

  return materializeTransferPlannerPathways(
    plan,
    visibleBasePathways,
    getPlanPrimaryParsedRequirementSourceBlocks(plan.id)
  );
}

function materializePlanReferenceCourses(plan: TransferPlannerMajorPlan): TransferPlannerMajorPlan {
  return {
    ...plan,
    applicationChecklist: normalizeChecklistItems(plan.applicationChecklist),
    beforeEnrollmentChecklist: normalizeChecklistItems(plan.beforeEnrollmentChecklist),
    stayAtGrcChecklist: normalizeChecklistItems(plan.stayAtGrcChecklist),
    pathways: materializePlanPathways(plan),
    grcCourseList: uniqueReferenceCourseLabels([
      ...(plan.grcCourseList ?? []),
      ...getChecklistReferenceCourses(plan),
    ]),
  };
}

function mergePlannerPathwayWithPlan(
  plan: TransferPlannerMajorPlan,
  pathway: TransferPlannerMajorPathway,
  visiblePathways = materializePlanPathways(plan)
): TransferPlannerResolvedMajorPlan {
  const trackMetadata = getPathwayScopedTrackMetadata(plan, pathway);
  const mergedPlan = materializePlanReferenceCourses({
    ...plan,
    applicationChecklist: pathway.applicationChecklist ?? plan.applicationChecklist ?? [],
    beforeEnrollmentChecklist:
      pathway.beforeEnrollmentChecklist ?? plan.beforeEnrollmentChecklist ?? [],
    stayAtGrcChecklist: pathway.stayAtGrcChecklist ?? plan.stayAtGrcChecklist ?? [],
    advisorFlags: sanitizePlannerOwnedStrings([
      ...(plan.advisorFlags ?? []),
      ...(pathway.advisorFlags ?? []),
    ]),
    officialLinks: uniquePlannerLinks([...(plan.officialLinks ?? []), ...(pathway.officialLinks ?? [])]),
    degreeMapSections: (pathway.degreeMapSections ?? plan.degreeMapSections)?.map((section) =>
      sanitizeDegreeMapSection(section)
    ),
    validationNotes: sanitizePlannerOwnedStrings([
      ...(plan.validationNotes ?? []),
      ...(pathway.validationNotes ?? []),
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
  ALL_BASE_MAJOR_PLANS.map(buildStudentRuntimePlan);

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

  const pathways = materializePlanPathways(plan, false);
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

  return uniqueReferenceCourseLabels([
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
  TransferPlannerMajorPathway,
  TransferPlannerMajorPlan,
  TransferPlannerResolvedMajorPlan,
  TransferPlannerCourseAvailability,
  TransferPlannerTrack,
} from "../transfer-planner-types";
