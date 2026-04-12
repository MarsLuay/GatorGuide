import {
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS,
  TRANSFER_PLANNER_BOOTSTRAP_CAMPUSES,
  TRANSFER_PLANNER_BOOTSTRAP_TRACKS,
} from "./bootstrap.generated";
import {
  TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY,
  type TransferPlannerGrcCourseAvailabilityEntry,
} from "../transfer-planner-grc-availability.generated";
import { TRANSFER_PLANNER_MASTER_CHAIN_LIBRARY } from "../transfer-planner-master-generated";
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
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerPromotedRequirementAtomOverrides,
} from "./registry";
import {
  TRANSFER_PLANNER_SOURCE_GAP_ENTRIES,
} from "./source-gaps.generated";
import { materializeTransferPlannerPathways } from "./pathway-materialization";
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

const STRUCTURED_GRC_SOURCE_KINDS = new Set(["plan-checklist", "plan-course-list", "master-bank"]);
const REFERENCE_COURSE_CODE_PATTERN = /\b[A-Z]{2,8}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;
const COMBINED_ENTRY_REFERENCE_PATTERN = /combined[- ]entry|combined entries|see .*combined/i;
const QUARTER_LABELS: Record<string, string> = {
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
  spring: "Spring",
};
const TRANSFER_PLANNER_CHAIN_LABELS: Record<string, string> = {
  "WRIT-SEQ": "Writing sequence",
  "MATH-STEM": "STEM calculus sequence",
  "MATH-BUS": "Business and applied math options",
  "CS-NEW": "Modern CS sequence",
  "CS-LEGACY": "Legacy CS sequence",
  "PHYS-CALC": "Calculus-based physics sequence",
  "PHYS-ALG": "Algebra-based physics sequence",
  "CHEM-GEN": "General chemistry sequence",
  "CHEM-ORG": "Organic chemistry sequence",
  "BIO-MAJORS": "Biology majors sequence",
  "BIO-ANAT": "Anatomy and physiology sequence",
  "ACCT-COMBO": "Accounting full-credit combo",
  "ASTR-COMBO": "Astronomy full-credit combo",
  "HIST-US": "US history full-credit combo",
  "ENGL-250": "English 250 full-credit combo",
  "COMM-266": "CMST 266 credit rule",
  "LANG-CHIN": "Chinese language sequence",
  "LANG-FR": "French language sequence",
  "LANG-GER": "German language sequence",
  "LANG-JP": "Japanese language sequence",
  "LANG-SP": "Spanish language sequence",
  "NATRS-COMBO": "Natural resources ESRM combo",
};
const AUTO_FALLBACK_CHECKLIST_LIMIT = 6;
const AUTO_TRACK_MATCH_EXAMPLE_LIMIT = 4;
const MIN_AUTO_TRACK_MATCH_COUNT = 3;
const AUTO_MATCH_EXCLUDED_TRACK_TERM_LABEL_PATTERN =
  /\b(transferability of credits|generally transferable courses|section [a-z])\b/i;
const REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE =
  "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way.";
const AUTO_FALLBACK_CORE_LABEL_PATTERN =
  /\b(MATH|PHYS|CHEM|BIOL|ENGR|CS|STAT|ECON|ENGL|CMST|GIS|GEOG|LANG|JAPN|CHIN|SPAN|FRCH|GERM|LATIN|GREEK|MUSC|ART|DESN|DRMA)\b/i;
const AUTO_FALLBACK_CHECKLIST_NOTE =
  "Auto-generated from the current source-backed Green River class list for this major.";
const AUTO_CUSTOM_PREP_FALLBACK_NOTE =
  "Use the current source-backed Green River class list as the planning starting point. Unsupported class mixes stay hidden until public sources can verify them.";
const AUTO_SOURCE_BACKED_UW_PREP_TARGET_PREFIX = "UW prep target:";
const AUTO_SOURCE_BACKED_UW_PREP_TARGET_NOTE =
  "Official UW prep target found in the current source-backed requirements, but no public Green River equivalent is currently provable.";
const AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_TITLE = "Source-backed UW prep guidance";
const AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_NOTE =
  "Current official source-backed requirement materials identify more UW prep for this major, but the published Green River equivalent path is not yet provable enough for planner-ready course mapping.";
const MAX_SOURCE_BACKED_UW_PREP_TARGET_COUNT = 18;
const SOURCE_ONLY_FALLBACK_ALLOWED_NOTES = new Set([
  REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE,
  AUTO_FALLBACK_CHECKLIST_NOTE,
  AUTO_CUSTOM_PREP_FALLBACK_NOTE,
  AUTO_SOURCE_BACKED_UW_PREP_TARGET_NOTE,
  AUTO_SOURCE_BACKED_UW_PREP_GUIDANCE_NOTE,
]);
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

type PathwayPlanKey = `${string}::${string}`;

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
  if (!planId) return false;
  if (pathwayId) {
    return STUDENT_HIDDEN_SOURCE_GAP_PATHWAY_KEYS.has(makePathwayPlanKey(planId, pathwayId));
  }
  return STUDENT_HIDDEN_SOURCE_GAP_PLAN_IDS.has(planId);
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
  if (rule.sourceKind !== "uw-green-river-equivalency-guide") continue;
  if (rule.acceptanceCategory === "no-credit") continue;
  if (!(rule.targetCourseCodes ?? []).length || !(rule.sourceCourseSets ?? []).length) continue;

  for (const targetCourseCode of rule.targetCourseCodes ?? []) {
    const normalizedTargetCourseCode = normalizeCourseCode(targetCourseCode);
    const existingRules = GUIDE_RULES_BY_TARGET_COURSE_CODE.get(normalizedTargetCourseCode) ?? [];
    existingRules.push(rule);
    GUIDE_RULES_BY_TARGET_COURSE_CODE.set(normalizedTargetCourseCode, existingRules);
  }
}

const SOURCE_BACKED_GUIDE_COURSES_BY_KEY = new Map<PathwayPlanKey, string[]>();
for (const parsedSource of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY) {
  const scopeKey = makePathwayPlanKey(parsedSource.planId, parsedSource.pathwayId);
  const sourceBackedGuideCourseCodes = new Set(
    SOURCE_BACKED_GUIDE_COURSES_BY_KEY.get(scopeKey) ?? []
  );
  const parsedCourseCodes = uniquePlannerStrings(
    [...(parsedSource.parsedUwCourseCodes ?? []), ...(parsedSource.sourceOnlyUwCourseCodes ?? [])].map(
      (courseCode) => normalizeCourseCode(courseCode)
    )
  );

  for (const parsedCourseCode of parsedCourseCodes) {
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

const PLANNER_OWNED_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bAdvisor-approved custom Green River prep\b/gi, "Custom source-backed Green River prep"],
  [/\bbefore final advisor review\b/gi, "as the current source-backed baseline"],
  [/\bbefore final adviser review\b/gi, "as the current source-backed baseline"],
  [
    /\bprogram-by-program advisor confirmation for final admission strategy\b/gi,
    "a source-backed baseline only; unsupported admission-strategy details stay hidden until public-source coverage improves",
  ],
  [
    /\badvisor review is still needed for final degree planning\b/gi,
    "unsupported degree-planning details stay hidden until public sources can verify them",
  ],
  [
    /\badvisor review is still smart before freezing the final term order\b/gi,
    "unsupported term-order details stay hidden until public sources can verify them",
  ],
  [
    /\blayer the remaining major-specific classes on top with advisor review\b/gi,
    "layer the remaining source-backed major-specific classes on top",
  ],
  [
    /\bconfirm the exact class mix with an advisor\b/gi,
    "follow the current source-backed degree guidance instead of inventing an unsupported class mix",
  ],
  [
    /\badvisor and financial-aid rules\b/gi,
    "financial-aid rules and the current source-backed plan",
  ],
  [
    /\byear-specific advisor review is still recommended\b/gi,
    "year-specific differences should stay hidden until public sources verify them",
  ],
  [
    /\bstill need direct advisor confirmation before they are hard-coded as universal substitutes\b/gi,
    "should stay hidden until public sources verify a universal substitute",
  ],
  [
    /\bstill need direct adviser confirmation before they are hard-coded as universal substitutes\b/gi,
    "should stay hidden until public sources verify a universal substitute",
  ],
  [
    /\bstill need direct advisor confirmation if the student wants them treated as universal Green River substitutes\b/gi,
    "stay hidden unless public sources verify them as universal Green River substitutes",
  ],
  [
    /\bstill need direct adviser confirmation if the student wants them treated as universal Green River substitutes\b/gi,
    "stay hidden unless public sources verify them as universal Green River substitutes",
  ],
  [/\badvisor-review territory\b/gi, "hidden-until-source-backed territory"],
  [/\badviser-review territory\b/gi, "hidden-until-source-backed territory"],
  [
    /\bthe department strongly recommends planning the physical-chemistry sequence with adviser input because\b/gi,
    "The published physical-chemistry sequence is tighter here, so follow the source-backed sequencing carefully because",
  ],
  [
    /\bthe department strongly recommends planning the physical-chemistry sequence with advisor input because\b/gi,
    "The published physical-chemistry sequence is tighter here, so follow the source-backed sequencing carefully because",
  ],
  [
    /\bthe public page explicitly notes that students who entered before Autumn 2024 follow older requirements and should use adviser review\b/gi,
    "The public page explicitly notes that students who entered before Autumn 2024 follow older requirements, so older cohorts stay hidden until public-source coverage expands",
  ],
  [
    /\bthe public page explicitly notes that students who entered before Autumn 2024 follow older requirements and should use advisor review\b/gi,
    "The public page explicitly notes that students who entered before Autumn 2024 follow older requirements, so older cohorts stay hidden until public-source coverage expands",
  ],
  [
    /\bany final degree plan should stay aligned with adviser-approved legacy completion guidance rather than assuming new-student policies still apply\b/gi,
    "any final degree plan should stay aligned with the published legacy completion guidance rather than assuming new-student policies still apply",
  ],
  [
    /\bany final degree plan should stay aligned with advisor-approved legacy completion guidance rather than assuming new-student policies still apply\b/gi,
    "any final degree plan should stay aligned with the published legacy completion guidance rather than assuming new-student policies still apply",
  ],
  [
    /\bbecause the option is lab-heavy and leaves less elective room, the department recommends proactive scheduling with an adviser\b/gi,
    "Because the option is lab-heavy and leaves less elective room, follow the published sequence proactively",
  ],
  [
    /\bbecause the option is lab-heavy and leaves less elective room, the department recommends proactive scheduling with an advisor\b/gi,
    "Because the option is lab-heavy and leaves less elective room, follow the published sequence proactively",
  ],
  [
    /\bstudents cannot start accounting-option courses until they meet with a Bothell adviser to confirm eligibility\b/gi,
    "Students cannot start accounting-option courses until the published Bothell eligibility rules are satisfied",
  ],
  [
    /\bstudents cannot start accounting-option courses until they meet with a Bothell advisor to confirm eligibility\b/gi,
    "Students cannot start accounting-option courses until the published Bothell eligibility rules are satisfied",
  ],
  [
    /\bthe page also says students cannot enroll in accounting-option courses until they meet with an adviser to confirm eligibility\b/gi,
    "The page also says students cannot enroll in accounting-option courses until the published eligibility rules are satisfied",
  ],
  [
    /\bthe page also says students cannot enroll in accounting-option courses until they meet with an advisor to confirm eligibility\b/gi,
    "The page also says students cannot enroll in accounting-option courses until the published eligibility rules are satisfied",
  ],
  [
    /\bTacoma Individually-designed IAS is now modeled as a proposal-driven transfer where students build a custom interdisciplinary plan with advisor approval instead of following a fixed preset option\b/gi,
    "Tacoma Individually-designed IAS is now modeled as a proposal-driven transfer where students build a custom interdisciplinary plan through the published proposal process instead of following a fixed preset option",
  ],
  [
    /\bTacoma Individually-designed IAS is now modeled as a proposal-driven transfer where students build a custom interdisciplinary plan with adviser approval instead of following a fixed preset option\b/gi,
    "Tacoma Individually-designed IAS is now modeled as a proposal-driven transfer where students build a custom interdisciplinary plan through the published proposal process instead of following a fixed preset option",
  ],
  [
    /\bThis path centers on an advisor-approved custom concentration rather than a preset major option\b/gi,
    "This path centers on a source-backed custom concentration rather than a preset major option",
  ],
  [
    /\bThis path centers on an adviser-approved custom concentration rather than a preset major option\b/gi,
    "This path centers on a source-backed custom concentration rather than a preset major option",
  ],
  [/\bstays under advisor review\b/gi, "stays hidden until public sources verify the substitution"],
  [/\bstays under adviser review\b/gi, "stays hidden until public sources verify the substitution"],
  [
    /\bBecause this row is a specialized partner pathway rather than a standard transfer major, the planning details should be treated as pathway-specific and adviser-verified\b/gi,
    "Because this row is a specialized partner pathway rather than a standard transfer major, the planning details should be treated as pathway-specific and source-backed only where the public sources are explicit",
  ],
  [
    /\bBecause this row is a specialized partner pathway rather than a standard transfer major, the planning details should be treated as pathway-specific and advisor-verified\b/gi,
    "Because this row is a specialized partner pathway rather than a standard transfer major, the planning details should be treated as pathway-specific and source-backed only where the public sources are explicit",
  ],
  [
    /\bUse adviser review before treating any one ACMS option as the final four-year finish, because\b/gi,
    "Keep ACMS option-specific finishes hidden until public sources verify them, because",
  ],
  [
    /\bUse advisor review before treating any one ACMS option as the final four-year finish, because\b/gi,
    "Keep ACMS option-specific finishes hidden until public sources verify them, because",
  ],
  [
    /\bstill deserve advisor review when building the exact final list\b/gi,
    "should stay hidden unless public sources verify the exact final list",
  ],
  [
    /\bstill deserve adviser review when building the exact final list\b/gi,
    "should stay hidden unless public sources verify the exact final list",
  ],
  [
    /\bUse advisor review if a student plans to submit with one in-progress prerequisite exception\b/gi,
    "Hide the in-progress-prerequisite exception unless public sources verify it",
  ],
  [
    /\bUse adviser review if a student plans to submit with one in-progress prerequisite exception\b/gi,
    "Hide the in-progress-prerequisite exception unless public sources verify it",
  ],
  [
    /\bUse advisor review if the student wants the lightest possible science mix versus the strongest long-term engineering prep\b/gi,
    "Show the strongest source-backed science mix; lighter alternatives stay hidden until public sources verify them",
  ],
  [
    /\bUse adviser review if the student wants the lightest possible science mix versus the strongest long-term engineering prep\b/gi,
    "Show the strongest source-backed science mix; lighter alternatives stay hidden until public sources verify them",
  ],
  [
    /\badviser review is still important when a student is following an older catalog year\b/gi,
    "older catalog-year differences should stay hidden until public sources verify them",
  ],
  [
    /\badvisor review is still important when a student is following an older catalog year\b/gi,
    "older catalog-year differences should stay hidden until public sources verify them",
  ],
  [
    /\badviser review is still needed to lock the exact B\.A\. versus B\.S\. finish\b/gi,
    "the exact B.A. versus B.S. finish should stay hidden until public sources verify it",
  ],
  [
    /\badvisor review is still needed to lock the exact B\.A\. versus B\.S\. finish\b/gi,
    "the exact B.A. versus B.S. finish should stay hidden until public sources verify it",
  ],
  [
    /\badviser review is still important before locking the final upper-division sequence\b/gi,
    "upper-division sequencing differences should stay hidden until public sources verify them",
  ],
  [
    /\badvisor review is still important before locking the final upper-division sequence\b/gi,
    "upper-division sequencing differences should stay hidden until public sources verify them",
  ],
  [/\badviser-reviewed transfer strategy\b/gi, "source-backed transfer strategy"],
  [/\badvisor-reviewed transfer strategy\b/gi, "source-backed transfer strategy"],
  [
    /\bthe exact UW course list must be finalized case by case with the approved faculty sponsors and adviser\b/gi,
    "the exact UW course list follows a case-by-case published proposal process with the approved faculty sponsors",
  ],
  [
    /\bthe exact UW course list must be finalized case by case with the approved faculty sponsors and advisor\b/gi,
    "the exact UW course list follows a case-by-case published proposal process with the approved faculty sponsors",
  ],
  [
    /\bmeet with the School of Urban Studies advisor before applying\b/gi,
    "follow the School of Urban Studies published pre-major guidance before applying",
  ],
  [
    /\bmeet with the School of Urban Studies adviser before applying\b/gi,
    "follow the School of Urban Studies published pre-major guidance before applying",
  ],
  [
    /\bStudents need at least 2 faculty sponsors, committee approval, and final approval from an Individualized Studies adviser, and transfer students must already be enrolled at UW before applying\b/gi,
    "Students need at least 2 faculty sponsors, committee approval, and the published Individualized Studies approval process, and transfer students must already be enrolled at UW before applying",
  ],
  [
    /\bStudents need at least 2 faculty sponsors, committee approval, and final approval from an Individualized Studies advisor, and transfer students must already be enrolled at UW before applying\b/gi,
    "Students need at least 2 faculty sponsors, committee approval, and the published Individualized Studies approval process, and transfer students must already be enrolled at UW before applying",
  ],
  [
    /\bThe department also notes that other courses may be substituted after discussion with the undergraduate adviser\b/gi,
    "The department also notes that other substitutions follow the published undergraduate approval rules",
  ],
  [
    /\bThe department also notes that other courses may be substituted after discussion with the undergraduate advisor\b/gi,
    "The department also notes that other substitutions follow the published undergraduate approval rules",
  ],
  [
    /\bCredits earned during study in Norway can be transferred in consultation with the department, and other substitutions can be approved by the undergraduate adviser\b/gi,
    "Credits earned during study in Norway can transfer under the department's published approval process, and other substitutions follow the undergraduate approval rules",
  ],
  [
    /\bCredits earned during study in Norway can be transferred in consultation with the department, and other substitutions can be approved by the undergraduate advisor\b/gi,
    "Credits earned during study in Norway can transfer under the department's published approval process, and other substitutions follow the undergraduate approval rules",
  ],
  [
    /\bCredits earned during study in Sweden can be transferred in consultation with the department, and the page notes that other substitutions may also be approved by the undergraduate adviser\b/gi,
    "Credits earned during study in Sweden can transfer under the department's published approval process, and other substitutions follow the undergraduate approval rules",
  ],
  [
    /\bCredits earned during study in Sweden can be transferred in consultation with the department, and the page notes that other substitutions may also be approved by the undergraduate advisor\b/gi,
    "Credits earned during study in Sweden can transfer under the department's published approval process, and other substitutions follow the undergraduate approval rules",
  ],
  [/\bwith adviser approval\b/gi, "under the published approval rules"],
  [/\bwith advisor approval\b/gi, "under the published approval rules"],
  [/\bsubject to adviser approval\b/gi, "subject to the published approval rules"],
  [/\bsubject to advisor approval\b/gi, "subject to the published approval rules"],
  [/\badviser approval\b/gi, "published approval rules"],
  [/\badvisor approval\b/gi, "published approval rules"],
  [/\badviser input\b/gi, "the published sequence"],
  [/\badvisor input\b/gi, "the published sequence"],
  [/\badvisor review matters here because\b/gi, "This source-backed planner row stays broad because"],
  [/\bUse advisor review whenever\b/gi, "Keep this planner row broad whenever"],
  [/\bUse adviser review whenever\b/gi, "Keep this planner row broad whenever"],
  [/\badvisor-approved\b/gi, "source-backed"],
  [/\badviser-approved\b/gi, "source-backed"],
];

function sanitizePlannerOwnedText(value: string | null | undefined) {
  let text = String(value ?? "").trim();
  if (!text) return "";

  for (const [pattern, replacement] of PLANNER_OWNED_TEXT_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  return text.trim();
}

function sanitizePlannerOwnedStrings(values: string[] | null | undefined) {
  return uniquePlannerStrings((values ?? []).map((value) => sanitizePlannerOwnedText(value)).filter(Boolean));
}

function sanitizeChecklistItemNote(note: string | null | undefined) {
  const sanitized = sanitizePlannerOwnedText(note);
  return SOURCE_ONLY_FALLBACK_ALLOWED_NOTES.has(sanitized) ? sanitized : undefined;
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

function buildAutoFallbackCourseLabels(
  grcCourseList: string[],
  bestTrackId: string | null | undefined
) {
  const courseList = uniqueReferenceCourseLabels(grcCourseList);
  if (!courseList.length) {
    return [] as string[];
  }

  const preferredTrack = bestTrackId ? TRACKS_BY_ID.get(bestTrackId) ?? null : null;
  const firstLabelByCode = new Map<string, string>();
  for (const label of courseList) {
    for (const code of extractReferenceCourseCodes(label)) {
      if (!firstLabelByCode.has(code)) {
        firstLabelByCode.set(code, label);
      }
    }
  }

  const trackSeedLabels = preferredTrack
    ? uniquePlannerStrings(
        preferredTrack.terms.flatMap((term) =>
          term.courses.flatMap((courseLabel) =>
            extractReferenceCourseCodes(courseLabel)
              .map((code) => firstLabelByCode.get(code) ?? null)
              .filter((label): label is string => Boolean(label))
          )
        )
      )
    : [];

  const coreLabels = courseList.filter((label) => AUTO_FALLBACK_CORE_LABEL_PATTERN.test(label));

  return uniquePlannerStrings([...trackSeedLabels, ...coreLabels, ...courseList]).slice(
    0,
    AUTO_FALLBACK_CHECKLIST_LIMIT
  );
}

function buildAutoFallbackChecklist(scope: {
  planId: string;
  bestTrackId: string | null | undefined;
  grcCourseList: string[];
  grcCourseListGuidance?: string | null | undefined;
}) {
  const autoCourseLabels = buildAutoFallbackCourseLabels(scope.grcCourseList, scope.bestTrackId);

  if (autoCourseLabels.length) {
    return autoCourseLabels.map<TransferPlannerChecklistItem>((label, index) => ({
      id: buildAutoChecklistItemId(label, index),
      title: label,
      grcCourses: [label],
      note: AUTO_FALLBACK_CHECKLIST_NOTE,
    }));
  }

  const explicitGuidance = String(scope.grcCourseListGuidance ?? "").trim();
  return [
    {
      id: "auto-custom-prep",
      title: "Custom source-backed Green River prep",
      grcCourses: [],
      note: explicitGuidance || AUTO_CUSTOM_PREP_FALLBACK_NOTE,
    },
  ] satisfies TransferPlannerChecklistItem[];
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
  fallbackPhase: TransferPlannerRequirementPhase = "before-enrollment"
): TransferPlannerRequirementPhase {
  const phases = entries
    .map((entry) => entry.displayPhase)
    .filter((phase): phase is TransferPlannerRequirementPhase => Boolean(phase));

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
      (entry) =>
        entry.classificationKind === "source-backed-choice-set-no-public-grc-path" &&
        !entry.promotedRequirementAtomOverrideId
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
  bestTrackSummary: string;
  whyThisTrack: string[];
  financialAidNote: string;
  matchCount: number;
  matchedCourseCodes: string[];
  matchedCourseLabels: string[];
  totalPlanCourseCount: number;
  totalTrackCourseCount: number;
};

function buildAutoTrackSummary(scope: {
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

function buildAutoTrackFinancialAidNote(track: TransferPlannerTrack) {
  return `Use ${track.code} as the main Green River transfer-degree backbone for aid and degree-planning purposes, then layer the remaining source-backed major-specific classes on top.`;
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
    bestTrackSummary: buildAutoTrackSummary({
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
    financialAidNote: buildAutoTrackFinancialAidNote(winner.track),
    matchCount: winner.matchCount,
    matchedCourseCodes: [...winner.matchedCourseCodes],
    matchedCourseLabels: [...winner.matchedCourseLabels],
    totalPlanCourseCount: planCourseCodes.length,
    totalTrackCourseCount: winner.trackCourseCodes.length,
  };
}

function applyAutoTrackRecommendation<T extends {
  bestTrackId: string | null | undefined;
  bestTrackSummary?: string;
  whyThisTrack?: string[];
  financialAidNote?: string;
  grcCourseList?: string[];
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
}>(scope: T): T {
  const autoTrack = getTransferPlannerAutoMatchedTrackRecommendation(
    collectPlannerCourseLabels(scope),
    scope.bestTrackId ?? null
  );

  if (!autoTrack || scope.bestTrackId === autoTrack.trackId) {
    return scope;
  }

  return {
    ...scope,
    bestTrackId: autoTrack.trackId,
    bestTrackSummary: autoTrack.bestTrackSummary,
    whyThisTrack: [...autoTrack.whyThisTrack],
    financialAidNote: autoTrack.financialAidNote,
  };
}

function applyAutoChecklistFallback<T extends {
  id: string;
  bestTrackId: string | null | undefined;
  grcCourseList?: string[];
  grcCourseListGuidance?: string | null | undefined;
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
}>(scope: T, options?: { allowCustomPrepFallback?: boolean }): T {
  if (hasAnyChecklistItems(scope)) {
    return scope;
  }

  const rawFallbackChecklist = buildAutoFallbackChecklist({
    planId: scope.id,
    bestTrackId: scope.bestTrackId,
    grcCourseList: scope.grcCourseList ?? [],
    grcCourseListGuidance: scope.grcCourseListGuidance,
  });
  const fallbackChecklist =
    options?.allowCustomPrepFallback === false
      ? rawFallbackChecklist.filter((item) => getChecklistReferenceCoursesFromItems([item]).length)
      : rawFallbackChecklist;
  if (!fallbackChecklist.length) {
    return scope;
  }

  return {
    ...scope,
    stayAtGrcChecklist: fallbackChecklist,
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

  return orderStringsByBase(
    uniquePlannerStrings([
      ...baseCourseOrder,
      ...filteredCodes,
      ...sourceBackedClassificationCodes,
      ...sourceBackedGuideCodes,
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

function buildPathway(basePlan: TransferPlannerMajorPlan, basePathway: TransferPlannerMajorPathway) {
  const key = makePathwayPlanKey(basePlan.id, basePathway.id);
  const policy = POLICIES_BY_KEY.get(key);
  const registryPathway =
    PATHWAYS_BY_PLAN.get(basePlan.id)?.find((entry) => entry.pathwayId === basePathway.id) ?? null;

  const applicationChecklist = buildChecklistForPhase(
    basePlan.id,
    "before-application",
    basePathway.applicationChecklist ?? [],
    basePathway.id
  );
  return applyAutoChecklistFallback(applyAutoTrackRecommendation({
    id: registryPathway?.pathwayId ?? basePathway.id,
    label: registryPathway?.label ?? basePathway.label,
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
    degreeMapSections: buildDegreeMapSections(
      basePlan.id,
      basePathway.degreeMapSections,
      basePathway.id
    ),
    manualReviewNotes: sanitizePlannerOwnedStrings(
      collectStructuredValidationNotes(
        basePlan.id,
        basePathway.manualReviewNotes ?? basePlan.manualReviewNotes ?? [],
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
    bestTrackSummary: sanitizePlannerOwnedText(
      policy?.bestTrackSummary ?? basePathway.bestTrackSummary
    ),
    whyThisTrack: sanitizePlannerOwnedStrings(
      policy?.whyThisTrack.length ? [...policy.whyThisTrack] : [...(basePathway.whyThisTrack ?? [])]
    ),
    financialAidNote: sanitizePlannerOwnedText(policy?.financialAidNote ?? basePathway.financialAidNote),
  } satisfies TransferPlannerMajorPathway));
}

function buildSourceGeneratedPlan(basePlan: TransferPlannerMajorPlan): TransferPlannerMajorPlan {
  const policy = POLICIES_BY_KEY.get(makePathwayPlanKey(basePlan.id, null));
  const applicationChecklist = buildChecklistForPhase(
    basePlan.id,
    "before-application",
    basePlan.applicationChecklist
  );
  return applyAutoChecklistFallback(applyAutoTrackRecommendation({
    ...basePlan,
    summary: sanitizePlannerOwnedText(basePlan.summary),
    bestTrackId: policy?.bestTrackId ?? basePlan.bestTrackId,
    bestTrackSummary: sanitizePlannerOwnedText(policy?.bestTrackSummary ?? basePlan.bestTrackSummary),
    whyThisTrack: sanitizePlannerOwnedStrings(
      policy?.whyThisTrack.length ? [...policy.whyThisTrack] : [...basePlan.whyThisTrack]
    ),
    financialAidNote: sanitizePlannerOwnedText(policy?.financialAidNote ?? basePlan.financialAidNote),
    applicationChecklist,
    beforeEnrollmentChecklist: buildChecklistForPhase(
      basePlan.id,
      "before-enrollment",
      basePlan.beforeEnrollmentChecklist
    ),
    stayAtGrcChecklist: buildChecklistForPhase(
      basePlan.id,
      "stay-at-grc",
      basePlan.stayAtGrcChecklist
    ),
    advisorFlags: sanitizePlannerOwnedStrings(policy?.advisorFlags ?? basePlan.advisorFlags),
    involvementIdeas: [...(policy?.involvementIdeas ?? basePlan.involvementIdeas)],
    projectIdeas: [...(policy?.projectIdeas ?? basePlan.projectIdeas)],
    officialLinks: collectStructuredLinks(basePlan.id, basePlan.officialLinks),
    degreeMapSections: buildDegreeMapSections(basePlan.id, basePlan.degreeMapSections),
    manualReviewNotes: sanitizePlannerOwnedStrings(
      collectStructuredValidationNotes(basePlan.id, basePlan.manualReviewNotes ?? [])
    ),
    grcCourseList: getStructuredCourseCodesForPlan(
      basePlan.id,
      basePlan.grcCourseList ?? []
    ),
    grcCourseListGuidance: sanitizePlannerOwnedText(
      policy?.grcCourseListGuidance ?? basePlan.grcCourseListGuidance
    ),
    plannerNote: sanitizePlannerOwnedText(policy?.plannerNote ?? basePlan.plannerNote),
    pathways: orderByBaseIds(
      (basePlan.pathways ?? []).map((pathway) => buildPathway(basePlan, pathway)),
      (basePlan.pathways ?? []).map((pathway) => pathway.id)
    ),
  }));
}

function getAutomaticScopeKeys(planId: string, pathwayId?: string | null) {
  return pathwayId
    ? [makePathwayPlanKey(planId, null), makePathwayPlanKey(planId, pathwayId)]
    : [makePathwayPlanKey(planId, null)];
}

function getAutomaticPromotedRequirementAtoms(planId: string, pathwayId?: string | null) {
  return uniqueById([
    ...getTransferPlannerPromotedRequirementAtomOverrides(planId, null),
    ...(pathwayId ? getTransferPlannerPromotedRequirementAtomOverrides(planId, pathwayId) : []),
  ]);
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

function buildAutomaticCourseList(planId: string, pathwayId?: string | null) {
  const scopeKeys = getAutomaticScopeKeys(planId, pathwayId);
  const overrideCourseCodes = getAutomaticPromotedRequirementAtoms(planId, pathwayId).flatMap(
    (entry) => [
      ...entry.grcCourseCodes,
      ...(entry.alternativeCourseCodeSets ?? []).flat(),
    ]
  );

  return orderStringsByBase(
    uniquePlannerStrings([
      ...overrideCourseCodes,
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
  return collectPlannerCourseLabels(scope);
}

function buildStudentRuntimePathway(
  basePlan: TransferPlannerMajorPlan,
  basePathway: TransferPlannerMajorPathway
) {
  const applicationChecklist = buildAutomaticChecklistForPhase(
    basePlan.id,
    "before-application",
    basePathway.id
  );
  const beforeEnrollmentChecklist = buildAutomaticChecklistForPhase(
    basePlan.id,
    "before-enrollment",
    basePathway.id
  );
  const prunedBeforeEnrollmentChecklist = pruneRedundantRuntimeChecklistItems(
    beforeEnrollmentChecklist,
    getChecklistCoverageCourseCodes(applicationChecklist)
  );
  const stayAtGrcChecklist = buildAutomaticChecklistForPhase(
    basePlan.id,
    "stay-at-grc",
    basePathway.id
  );
  const prunedStayAtGrcChecklist = pruneRedundantRuntimeChecklistItems(
    stayAtGrcChecklist,
    getChecklistCoverageCourseCodes([
      ...applicationChecklist,
      ...prunedBeforeEnrollmentChecklist,
    ])
  );
  const automaticCourseList = buildAutomaticCourseList(basePlan.id, basePathway.id);
  const studentVisibleCourseList = buildStudentVisibleAutomaticCourseList({
    grcCourseList: automaticCourseList,
    applicationChecklist,
    beforeEnrollmentChecklist: prunedBeforeEnrollmentChecklist,
    stayAtGrcChecklist: prunedStayAtGrcChecklist,
  });

  return applyAutoChecklistFallback(
    applyStrictSourceBackedFallback(
      applyAutoTrackRecommendation({
      id: basePathway.id,
      label: basePathway.label,
      summary: "",
      applicationChecklist,
      beforeEnrollmentChecklist: prunedBeforeEnrollmentChecklist,
      stayAtGrcChecklist: prunedStayAtGrcChecklist,
      advisorFlags: [],
      officialLinks: [],
      degreeMapSections: [],
      manualReviewNotes: [],
      grcCourseList: studentVisibleCourseList,
      grcCourseListGuidance: undefined,
      plannerNote: undefined,
      bestTrackId: null,
      bestTrackSummary: "",
      whyThisTrack: [],
      financialAidNote: "",
      } satisfies TransferPlannerMajorPathway),
      basePathway.id
    ),
    { allowCustomPrepFallback: false }
  );
}

function buildStudentRuntimePlan(basePlan: TransferPlannerMajorPlan): TransferPlannerMajorPlan {
  const applicationChecklist = buildAutomaticChecklistForPhase(
    basePlan.id,
    "before-application"
  );
  const beforeEnrollmentChecklist = buildAutomaticChecklistForPhase(
    basePlan.id,
    "before-enrollment"
  );
  const prunedBeforeEnrollmentChecklist = pruneRedundantRuntimeChecklistItems(
    beforeEnrollmentChecklist,
    getChecklistCoverageCourseCodes(applicationChecklist)
  );
  const stayAtGrcChecklist = buildAutomaticChecklistForPhase(basePlan.id, "stay-at-grc");
  const prunedStayAtGrcChecklist = pruneRedundantRuntimeChecklistItems(
    stayAtGrcChecklist,
    getChecklistCoverageCourseCodes([
      ...applicationChecklist,
      ...prunedBeforeEnrollmentChecklist,
    ])
  );
  const automaticCourseList = buildAutomaticCourseList(basePlan.id);
  const studentVisibleCourseList = buildStudentVisibleAutomaticCourseList({
    grcCourseList: automaticCourseList,
    applicationChecklist,
    beforeEnrollmentChecklist: prunedBeforeEnrollmentChecklist,
    stayAtGrcChecklist: prunedStayAtGrcChecklist,
  });

  return applyAutoChecklistFallback(
    applyStrictSourceBackedFallback(
      applyAutoTrackRecommendation({
      ...basePlan,
      summary: "",
      bestTrackId: null,
      bestTrackSummary: "",
      whyThisTrack: [],
      financialAidNote: "",
      applicationChecklist,
      beforeEnrollmentChecklist: prunedBeforeEnrollmentChecklist,
      stayAtGrcChecklist: prunedStayAtGrcChecklist,
      advisorFlags: [],
      involvementIdeas: [],
      projectIdeas: [],
      officialLinks: [],
      degreeMapSections: [],
      manualReviewNotes: [],
      grcCourseList: studentVisibleCourseList,
      grcCourseListGuidance: undefined,
      plannerNote: undefined,
      pathways: orderByBaseIds(
        (basePlan.pathways ?? []).map((pathway) => buildStudentRuntimePathway(basePlan, pathway)),
        (basePlan.pathways ?? []).map((pathway) => pathway.id)
      ),
      }),
      null
    ),
    { allowCustomPrepFallback: false }
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
    manualReviewNotes: sanitizePlannerOwnedStrings(pathway.manualReviewNotes ?? []),
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
  const pathways = (plan.pathways ?? []).map(materializePlannerPathway);
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
    manualReviewNotes: sanitizePlannerOwnedStrings([
      ...(plan.manualReviewNotes ?? []),
      ...(pathway.manualReviewNotes ?? []),
    ]),
    grcCourseListGuidance: sanitizePlannerOwnedText(
      pathway.grcCourseListGuidance ?? plan.grcCourseListGuidance
    ),
    grcCourseList:
      pathway.grcCourseList && pathway.grcCourseList.length
        ? pathway.grcCourseList
        : plan.grcCourseList,
    plannerNote: sanitizePlannerOwnedText(pathway.plannerNote ?? plan.plannerNote),
    bestTrackId: pathway.bestTrackId === undefined ? plan.bestTrackId : pathway.bestTrackId,
    bestTrackSummary: sanitizePlannerOwnedText(pathway.bestTrackSummary ?? plan.bestTrackSummary),
    whyThisTrack: sanitizePlannerOwnedStrings(
      pathway.whyThisTrack?.length ? pathway.whyThisTrack : plan.whyThisTrack
    ),
    financialAidNote: sanitizePlannerOwnedText(
      pathway.financialAidNote ?? plan.financialAidNote
    ),
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

const CHAINS_BY_ID = new Map(
  TRANSFER_PLANNER_MASTER_CHAIN_LIBRARY.map((chain) => [chain.id, chain] as const)
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
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.map(buildSourceGeneratedPlan);
export const TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS: TransferPlannerMajorPlan[] =
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.map(buildStudentRuntimePlan);

export const TRANSFER_PLANNER_CAMPUSES: TransferPlannerCampus[] = TRANSFER_PLANNER_BOOTSTRAP_CAMPUSES;
export const TRANSFER_PLANNER_TRACKS: TransferPlannerTrack[] = TRANSFER_PLANNER_BOOTSTRAP_TRACKS;

export function getTransferPlannerSourceGeneratedMajorsForCampus(
  campusId: TransferPlannerCampusId
) {
  return TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.filter(
    (plan) => plan.campusId === campusId
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
  return TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS.filter(
    (plan) => plan.campusId === campusId && !isTransferPlannerStudentHiddenSourceGap(plan.id)
  );
}

export function getTransferPlannerSourceGeneratedMajorPlan(planId: string) {
  return (
    TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.find((plan) => plan.id === planId) ?? null
  );
}

export function getTransferPlannerMajorsForCampus(campusId: TransferPlannerCampusId) {
  return getTransferPlannerSourceGeneratedMajorsForCampus(campusId);
}

export function getTransferPlannerMajorPlan(planId: string) {
  return getTransferPlannerSourceGeneratedMajorPlan(planId);
}

export function getTransferPlannerStudentRuntimeMajorPlan(planId: string) {
  return (
    TRANSFER_PLANNER_STUDENT_RUNTIME_MAJOR_PLANS.find((plan) => plan.id === planId) ?? null
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

export function getTransferPlannerChainsForPlan(
  plan: TransferPlannerMajorPlan | TransferPlannerResolvedMajorPlan | null | undefined
) {
  if (!plan?.chainIds?.length) return [];

  return plan.chainIds
    .map((chainId) => CHAINS_BY_ID.get(chainId) ?? null)
    .filter(
      (chain): chain is (typeof TRANSFER_PLANNER_MASTER_CHAIN_LIBRARY)[number] => Boolean(chain)
    );
}

export function getTransferPlannerChainLabel(chainId: string) {
  return TRANSFER_PLANNER_CHAIN_LABELS[chainId] ?? chainId;
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
