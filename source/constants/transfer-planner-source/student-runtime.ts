import {
  TRANSFER_PLANNER_RUNTIME_CAMPUSES,
  TRANSFER_PLANNER_RUNTIME_COMPACT_COURSE_REGISTRY,
  TRANSFER_PLANNER_RUNTIME_EQUIVALENCY_RULE_REGISTRY,
  TRANSFER_PLANNER_RUNTIME_GAP_REGISTRY,
  TRANSFER_PLANNER_RUNTIME_MAJOR_PLANS,
  TRANSFER_PLANNER_RUNTIME_PARSED_REQUIREMENT_BLOCK_REGISTRY,
  TRANSFER_PLANNER_RUNTIME_PATHWAYS_BY_PLAN_ID,
  TRANSFER_PLANNER_RUNTIME_PRIMARY_DEGREE_SOURCES_BY_KEY,
  TRANSFER_PLANNER_RUNTIME_RESOLVED_MAJOR_PLANS_BY_KEY,
  TRANSFER_PLANNER_RUNTIME_TRACKS,
  getTransferPlannerRuntimeMajorPlanById,
  getTransferPlannerRuntimeMajorPlansForCampus,
  getTransferPlannerRuntimeParsedRequirementBlocksForPlanId,
  getTransferPlannerRuntimePathwaysForPlanId,
  getTransferPlannerRuntimePrimaryDegreeSourceByKey,
  getTransferPlannerRuntimeResolvedMajorPlanByKey,
  type TransferPlannerRuntimeCompactCourseRegistryEntry,
} from "./student-runtime.generated";
import type {
  TransferPlannerCampus,
  TransferPlannerCampusId,
  TransferPlannerChecklistItem,
  TransferPlannerMajorPlan,
  TransferPlannerMajorPathway,
  TransferPlannerRequirementGroup,
  TransferPlannerRequirementOption,
  TransferPlannerRequirementSatisfactionMode,
  TransferPlannerRequirementStructuralShape,
  TransferPlannerRequirementSupportList,
  TransferPlannerResolvedMajorPlan,
  TransferPlannerTrack,
} from "../transfer-planner-types";
import type {
  TransferPlannerCourseRegistryEntry,
  TransferPlannerEffectiveYearRange,
  TransferPlannerEquivalencyRule,
  TransferPlannerSourceManifestEntry,
  TransferPlannerSourceSchoolId,
} from "./schema";
import {
  getTransferPlannerProgramApprovedCourseFilterDefinition,
} from "./program-approved-course-filters";
import { normalizeTransferPlannerPathwayId } from "./pathway-id-normalization";

export type {
  TransferPlannerCampus,
  TransferPlannerCampusId,
  TransferPlannerChecklistItem,
  TransferPlannerGeneralRequirementSection,
  TransferPlannerGeneralRequirementSourceKind,
  TransferPlannerMajorPlan,
  TransferPlannerMajorPathway,
  TransferPlannerRequirementType,
  TransferPlannerResolvedMajorPlan,
  TransferPlannerTrack,
} from "../transfer-planner-types";
export type {
  TransferPlannerEquivalencyRule,
  TransferPlannerStudentCourseEvaluation,
} from "./schema";

const EXPLICIT_COURSE_CODE_PATTERN =
  /\b([A-Za-z&]{2,8}|[A-Za-z&]{1,4}(?:\s+[A-Za-z&]{1,4}))\s+(\d{3}(?:\.\d+)?[A-Za-z]?)\b/g;
const COURSE_NUMBER_CONTINUATION_PATTERN =
  /(?:^|[,(;/]\s*|\b(?:or|and)\s+)(\d{3}(?:\.\d+)?[A-Za-z]?)(?=$|[\s,);/]|(?:\s*(?:or|and)\b))/gi;
const INVALID_EXTRACTED_COURSE_SUBJECTS = new Set([
  "AND",
  "ANY",
  "APPROVED",
  "AT",
  "BEFORE",
  "BREADTH",
  "BY",
  "COMPLETE",
  "COURSE",
  "COURSES",
  "CREDIT",
  "CREDITS",
  "EITHER",
  "FOR",
  "FROM",
  "IN",
  "INTO",
  "MINIMUM",
  "NOT",
  "OF",
  "ONE",
  "OR",
  "PLUS",
  "REQUIRED",
  "SECTION",
  "THE",
  "TO",
  "TOTAL",
  "TWO",
  "USE",
]);
const RECOVERABLE_LEADING_SUBJECT_TOKENS = new Set([
  "AND",
  "AS",
  "BOTH",
  "EITHER",
  "IN",
  "OR",
  "PREREQ",
  "PREREQUISITE",
]);
const EXPLICIT_SPACED_SUBJECT_ALIASES = new Map<string, string>([
  ["A A", "AA"],
  ["A MATH", "AMATH"],
  ["CHEM E", "CHEME"],
  ["E E", "EE"],
  ["IND E", "INDE"],
  ["M E", "ME"],
]);
const GRC_EQUIVALENT_COURSE_CODE_SETS = [
  ["MATH& 254", "MATH& 264"],
  ["PHYS 154", "PHYS& 154"],
  ["PHYS 155", "PHYS& 155"],
] as const;
const REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE =
  "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way.";
const REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE_PATTERN =
  /\bnot part of the minimum transfer-admission classes\b[\s\S]*\bneeded to complete the degree either way\b/i;
type RuntimeChecklistBucketKey =
  | "applicationChecklist"
  | "beforeEnrollmentChecklist"
  | "stayAtGrcChecklist";
type TransferPlannerBootstrapGeneratedModule = {
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS?: TransferPlannerMajorPlan[];
};
const REQUIRED_FOR_DEGREE_EITHER_WAY_GRC_COURSES_BY_PLAN_ID: Partial<
  Record<string, Partial<Record<RuntimeChecklistBucketKey, string[]>>>
> = {
  "uw-seattle-computer-engineering": {
    beforeEnrollmentChecklist: ["MATH 240", "ENGR& 204"],
  },
  "uw-seattle-electrical-computer-engineering": {
    beforeEnrollmentChecklist: ["ENGR& 204"],
  },
  "uw-seattle-mechanical-engineering": {
    beforeEnrollmentChecklist: ["MATH& 264"],
  },
  "uw-tacoma-computer-engineering": {
    beforeEnrollmentChecklist: ["MATH 240"],
  },
  "uw-tacoma-electrical-engineering": {
    beforeEnrollmentChecklist: ["MATH 240"],
  },
  "uw-tacoma-computer-science-and-systems-bs": {
    beforeEnrollmentChecklist: ["MATH 240"],
  },
  "uw-tacoma-information-technology": {
    beforeEnrollmentChecklist: ["MATH 240"],
  },
  "uw-bothell-computer-engineering": {
    stayAtGrcChecklist: ["ENGR& 204"],
  },
  "uw-bothell-electrical-engineering": {
    stayAtGrcChecklist: ["ENGR& 204"],
  },
};
const GUIDE_TERM_ORDER: Partial<Record<string, number>> = {
  WIN: 1,
  SPR: 2,
  SUM: 3,
  AUT: 4,
};

type TransferPlannerRuntimeSourceGapEntry = {
  planId: string;
  pathwayId: string | null;
  title: string;
  sourceGapReason: string;
  suggestedPrimary?: {
    label?: string | null;
    url: string;
  } | null;
};

type TransferPlannerRuntimeParsedRequirementSourceScopeBlock = {
  pathwayId?: string | null;
  sourceUrl?: string | null;
  primarySourceUrl?: string | null;
  sourceRole?: string | null;
  sourceRoleStatus?: string | null;
  parsedUwCourseCodes?: string[];
  canCreateSchedulableRows?: boolean;
  canCreateRequiredRows?: boolean;
  canCreateOptionGroups?: boolean;
  canCreateCreditBuckets?: boolean;
  canCreateCategoryOptions?: boolean;
  canCreateScheduleRows?: boolean;
  supportOnly?: boolean;
  nonSchedulable?: boolean;
};

let knownTransferPlannerSubjectCodes: Set<string> | null = null;

function getKnownTransferPlannerSubjectCodes() {
  if (knownTransferPlannerSubjectCodes) {
    return knownTransferPlannerSubjectCodes;
  }

  knownTransferPlannerSubjectCodes = new Set(
    TRANSFER_PLANNER_RUNTIME_COMPACT_COURSE_REGISTRY.map((entry) =>
      String(entry.code ?? "").match(/^([A-Z&]+(?: [A-Z&]+)*)\s+\d/)
    )
      .map((match) => match?.[1] ?? null)
      .filter((subjectCode): subjectCode is string => Boolean(subjectCode))
  );
  return knownTransferPlannerSubjectCodes;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function uniqueBy<T>(values: T[], getKey: (value: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const key = getKey(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}

function getRuntimeRequirementSupportListSemanticKey(
  supportList: TransferPlannerRequirementSupportList
) {
  const approvedListKey = supportList.approvedListKey ?? supportList.filterKey ?? "";
  if (
    approvedListKey &&
    (supportList.shape === "approved-filter-list" || supportList.shape === "approved-course-list")
  ) {
    return `approved:${supportList.sourceUrl ?? ""}:${approvedListKey}`;
  }
  return supportList.id || `${supportList.shape}:${supportList.sourceUrl ?? ""}:${supportList.listTitle ?? ""}`;
}

function uniqueRuntimeRequirementSupportLists(
  supportLists: TransferPlannerRequirementSupportList[]
) {
  return uniqueBy(supportLists, getRuntimeRequirementSupportListSemanticKey);
}

function getRuntimeRequirementStructuralShape(
  input: {
    requirementType?: string | null;
    supportOnly?: boolean | null;
    sourceRole?: string | null;
    sourceSectionSchedulable?: boolean | null;
    options?: TransferPlannerRequirementOption[] | null;
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

function getPlannerPathwayKey(planId: string, pathwayId?: string | null) {
  return `${planId}::${pathwayId ?? ""}`;
}

function getRuntimeMajorPlansForCampus(campusId: TransferPlannerCampusId) {
  return typeof getTransferPlannerRuntimeMajorPlansForCampus === "function"
    ? getTransferPlannerRuntimeMajorPlansForCampus(campusId)
    : TRANSFER_PLANNER_RUNTIME_MAJOR_PLANS.filter((plan) => plan.campusId === campusId);
}

function getRuntimeMajorPlanById(planId: string) {
  return typeof getTransferPlannerRuntimeMajorPlanById === "function"
    ? getTransferPlannerRuntimeMajorPlanById(planId)
    : TRANSFER_PLANNER_RUNTIME_MAJOR_PLANS.find((plan) => plan.id === planId) ?? null;
}

let bootstrapMajorPlansById: Map<string, TransferPlannerMajorPlan> | null = null;
let bootstrapMajorPlansLoadAttempted = false;

function getBootstrapMajorPlansById() {
  if (bootstrapMajorPlansLoadAttempted) {
    return bootstrapMajorPlansById;
  }

  bootstrapMajorPlansLoadAttempted = true;
  try {
    const bootstrapModule = require("./bootstrap.generated") as TransferPlannerBootstrapGeneratedModule;
    const plans = bootstrapModule.TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS ?? [];
    bootstrapMajorPlansById = new Map(plans.map((plan) => [plan.id, plan]));
  } catch {
    bootstrapMajorPlansById = null;
  }
  return bootstrapMajorPlansById;
}

function getSourceMajorPlanById(planId: string) {
  return getRuntimeMajorPlanById(planId) ?? getBootstrapMajorPlansById()?.get(planId) ?? null;
}

function getRuntimePathwaysForPlan(plan: TransferPlannerMajorPlan | null | undefined) {
  if (!plan) return [] as TransferPlannerMajorPathway[];
  const runtimePathways =
    typeof getTransferPlannerRuntimePathwaysForPlanId === "function"
      ? getTransferPlannerRuntimePathwaysForPlanId(plan.id)
      : TRANSFER_PLANNER_RUNTIME_PATHWAYS_BY_PLAN_ID[plan.id] ?? [];
  return runtimePathways.length ? runtimePathways : plan.pathways ?? [];
}

function getRuntimeResolvedMajorPlanByPathwayKey(key: string) {
  return (
    typeof getTransferPlannerRuntimeResolvedMajorPlanByKey === "function"
      ? getTransferPlannerRuntimeResolvedMajorPlanByKey(key)
      : TRANSFER_PLANNER_RUNTIME_RESOLVED_MAJOR_PLANS_BY_KEY[key] ?? null
  ) as TransferPlannerResolvedMajorPlan | null;
}

function getRuntimePrimaryDegreeSourceByPathwayKey(key: string) {
  return (
    typeof getTransferPlannerRuntimePrimaryDegreeSourceByKey === "function"
      ? getTransferPlannerRuntimePrimaryDegreeSourceByKey(key)
      : TRANSFER_PLANNER_RUNTIME_PRIMARY_DEGREE_SOURCES_BY_KEY[key] ?? null
  ) as TransferPlannerSourceManifestEntry | null;
}

function getRuntimeParsedRequirementBlocksForPlan(planId: string) {
  return typeof getTransferPlannerRuntimeParsedRequirementBlocksForPlanId === "function"
    ? getTransferPlannerRuntimeParsedRequirementBlocksForPlanId(planId)
    : TRANSFER_PLANNER_RUNTIME_PARSED_REQUIREMENT_BLOCK_REGISTRY.filter(
        (block) => block.planId === planId
      );
}

const UW_SEATTLE_ECE_PLAN_ID = "uw-seattle-electrical-computer-engineering";
const UW_SEATTLE_ECE_TRANSFER_TRACK_ID =
  "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-computer-and-electrical-engineering";
const UW_SEATTLE_COMPUTER_SCIENCE_PLAN_ID = "uw-seattle-computer-science";
const UW_SEATTLE_ME_PLAN_ID = "uw-seattle-mechanical-engineering";
const UW_SEATTLE_CIVIL_MECHANICAL_TRANSFER_TRACK_ID =
  "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-civil-and-mechanical-engineering";
const UW_SEATTLE_CIVIL_PLAN_ID = "uw-seattle-civil-engineering";
const UW_SEATTLE_CHEMICAL_ENGINEERING_PLAN_ID = "uw-seattle-chemical-engineering";
const UW_SEATTLE_BIOENGINEERING_PLAN_ID = "uw-seattle-bioengineering";
const UW_SEATTLE_BIOENGINEERING_TRANSFER_TRACK_ID =
  "grc-associate-stem-engineering-associate-in-science-transfer-track-2-bioengineering-and-chemical-engineering";
const RUNTIME_AUTO_TRACK_MATCH_EXAMPLE_LIMIT = 4;
const RUNTIME_AUTO_MATCH_EXCLUDED_TRACK_TERM_LABEL_PATTERN =
  /\b(transferability of credits|generally transferable courses|section [a-z])\b/i;
const UW_SEATTLE_BIOENGINEERING_GEN_ED_SECTION = {
  id: "uw-seattle-bioengineering-source-backed-general-education",
  title: "Bioengineering general education requirements",
  note: "Official UW Bioengineering general education targets parsed from the degree requirements page.",
  items: [
    "English Composition: 5 credits.",
    "Arts and Humanities: 10 credits minimum.",
    "Social Sciences: 10 credits minimum.",
    "Natural Sciences: 45 credits minimum.",
    "4 additional credits of Arts and Humanities or Social Sciences.",
    "Diversity: 3 credits; these credits may overlap with Areas of Inquiry.",
    "Additional Areas of Inquiry 8 credits from any area as general electives.",
  ],
};

const RUNTIME_CATEGORY_OPTION_DEFINITIONS = [
  {
    category: "NSC",
    sourceCategoryCode: "NSc",
    longLabel: "Natural Sciences",
    pattern: /\b(?:N\s*Sc|natural sciences?|natural science)\b/i,
  },
  {
    category: "AH",
    sourceCategoryCode: "A&H",
    longLabel: "Arts and Humanities",
    pattern: /\b(?:A\s*&\s*H|arts?\s+(?:and|&)\s+humanities|humanities|fine arts?)\b/i,
  },
  {
    category: "SSC",
    sourceCategoryCode: "SSc",
    longLabel: "Social Sciences",
    pattern: /\b(?:S\s*Sc|social sciences?)\b/i,
  },
  {
    category: "QSR",
    sourceCategoryCode: "QSR",
    longLabel: "Quantitative and Symbolic Reasoning",
    pattern: /\bQSR\b|\bquantitative and symbolic reasoning\b/i,
  },
  {
    category: "VLPA",
    sourceCategoryCode: "VLPA",
    longLabel: "Visual, Literary, and Performing Arts",
    pattern: /\bVLPA\b|\bvisual,\s*literary,\s*and\s*performing arts\b/i,
  },
  {
    category: "DIV",
    sourceCategoryCode: "DIV",
    longLabel: "Diversity",
    pattern: /\bDIV\b|\bdiversity\b/i,
  },
  {
    category: "NW",
    sourceCategoryCode: "NW",
    longLabel: "Natural World",
    pattern: /\bNW\b|\bnatural world\b/i,
  },
  {
    category: "IANDS",
    sourceCategoryCode: "I&S",
    longLabel: "Individuals and Societies",
    pattern: /\bI\s*&\s*S\b|\bindividuals\s+and\s+societies\b/i,
  },
] as const;

function slugifyRuntimeId(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getRuntimeCategoryOptionDescriptor(text: string | null | undefined) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return (
    RUNTIME_CATEGORY_OPTION_DEFINITIONS.find((definition) =>
      definition.pattern.test(normalized)
    ) ?? null
  );
}

function parseRuntimeCategoryOptionCreditAmount(
  text: string | null | undefined,
  fallbackCredits: number | null = null
) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  const parentheticalCreditMatch = normalized.match(/\(\s*(\d+(?:\.\d+)?)\s*\)/);
  if (parentheticalCreditMatch) {
    return Number(parentheticalCreditMatch[1]);
  }

  const explicitCreditMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b/i);
  if (explicitCreditMatch) {
    return Number(explicitCreditMatch[1]);
  }

  return fallbackCredits;
}

function buildRuntimeCategoryRequirementOption(input: {
  ownerId: string;
  groupId: string;
  sourceText: string;
  fallbackCredits?: number | null;
  index?: number;
}): TransferPlannerRequirementOption | null {
  const descriptor = getRuntimeCategoryOptionDescriptor(input.sourceText);
  if (!descriptor) {
    return null;
  }

  const credits = parseRuntimeCategoryOptionCreditAmount(
    input.sourceText,
    input.fallbackCredits ?? null
  );
  if (!Number.isFinite(credits) || !credits || credits <= 0) {
    return null;
  }

  const sourceText = String(input.sourceText ?? "").replace(/\s+/g, " ").trim();
  const title = `${credits} credits of ${descriptor.longLabel} (${descriptor.sourceCategoryCode})`;
  const optionSlug = slugifyRuntimeId(
    `category-${descriptor.category}-${credits}-${input.index ?? 1}`
  );

  return {
    id: `${input.groupId}:requirement-option:${optionSlug}`,
    optionKind: "category-option",
    requirementShape: "category-option",
    displayCourseCodes: [],
    uwCourses: [],
    equivalentUwCourseCodes: [],
    credits,
    creditMin: credits,
    creditMax: credits,
    creditText: String(credits),
    maxCredits: null,
    title,
    department: null,
    category: descriptor.category,
    sourceHeading: sourceText,
    sourceCategory: "source-choice",
    grcMatches: [],
    categoryOption: {
      category: descriptor.category,
      sourceCategoryCode: descriptor.sourceCategoryCode,
      title,
      credits,
      sourceText,
    },
    constraints: [],
    notes: ["Category option; no specific Green River course is invented."],
    label: title,
  };
}

function buildRuntimeCategoryRequirementOptionsFromChoiceLine(input: {
  ownerId: string;
  groupId: string;
  line: string;
  fallbackCredits?: number | null;
}) {
  const normalizedLine = String(input.line ?? "").replace(/\s+/g, " ").trim();
  if (!/\bor\b|choose|select|one of/i.test(normalizedLine)) {
    return [] as TransferPlannerRequirementOption[];
  }

  return uniqueBy(
    normalizedLine
      .split(/\bor\b|;|\u2022/gi)
      .map((segment) => segment.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .filter((segment) => extractTransferPlannerCourseCodes(segment).length === 0)
      .map((segment, index) =>
        buildRuntimeCategoryRequirementOption({
          ownerId: input.ownerId,
          groupId: input.groupId,
          sourceText: segment,
          fallbackCredits: input.fallbackCredits ?? null,
          index: index + 1,
        })
      )
      .filter((option): option is TransferPlannerRequirementOption => Boolean(option)),
    (option) =>
      `${option.categoryOption?.category ?? ""}:${option.categoryOption?.credits ?? ""}:${
        option.categoryOption?.sourceText ?? ""
      }`
  );
}

function buildRuntimeRequirementOption(input: {
  ownerId: string;
  groupId: string;
  courseCode: string;
  grcMatches: string[];
  label?: string;
}): TransferPlannerRequirementOption {
  return {
    id: `${input.ownerId}:requirement-option:${input.courseCode
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}`,
    optionKind: "course",
    displayCourseCodes: [input.courseCode],
    uwCourses: [input.courseCode],
    equivalentUwCourseCodes: [],
    credits: null,
    creditMin: null,
    creditMax: null,
    creditText: null,
    maxCredits: null,
    title: null,
    department: null,
    category: null,
    sourceHeading: input.label ?? input.courseCode,
    sourceCategory: "source-choice",
    grcMatches: input.grcMatches,
    categoryOption: null,
    constraints: [],
    notes: [],
    label: input.label ?? input.courseCode,
  };
}

function formatRuntimeRequirementCreditText(
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

function buildRuntimeRequirementGroup(input: {
  ownerId: string;
  id: string;
  label: string;
  minCourses?: number;
  maxCourses?: number;
  options: (
    | { courseCode: string; grcMatches: string[]; label?: string }
    | { categoryOption: TransferPlannerRequirementOption["categoryOption"]; label?: string }
  )[];
}): TransferPlannerRequirementGroup {
  const groupId = `${input.ownerId}:requirement-group:${input.id}`;
  return {
    id: groupId,
    label: input.label,
    category: "source-choice",
    subcategory: null,
    requirementType: (input.maxCourses ?? input.minCourses ?? 1) === 1 ? "choose_one" : "choose_n",
    requirementShape: "option-group",
    minCourses: input.minCourses ?? 1,
    maxCourses: input.maxCourses ?? input.minCourses ?? 1,
    minCredits: null,
    maxCredits: null,
    sourceHeading: input.label,
    notes: [],
    options: input.options
      .map((option, index) => {
        if ("categoryOption" in option && option.categoryOption) {
          return buildRuntimeCategoryRequirementOption({
            ownerId: input.ownerId,
            groupId,
            sourceText: option.categoryOption.sourceText,
            fallbackCredits: option.categoryOption.credits,
            index: index + 1,
          });
        }

        if ("courseCode" in option) {
          return buildRuntimeRequirementOption({
            ownerId: input.ownerId,
            groupId,
            courseCode: option.courseCode,
            grcMatches: option.grcMatches,
            label: option.label,
          });
        }

        return null;
      })
      .filter((option): option is TransferPlannerRequirementOption => Boolean(option)),
  };
}

function buildRuntimeChecklistItem(input: {
  id: string;
  title: string;
  grcCourses: string[];
  alternatives?: string[][];
  note?: string;
  minCompletedCount?: number;
  requirementGroup?: TransferPlannerRequirementGroup;
  selectedRequirementOptionIds?: string[];
  scheduleSelectedRequirementOptions?: boolean;
  sourceUrl?: string | null;
  sourceRole?: string | null;
  sourceScope?: string | null;
  sourceSection?: string | null;
  generatedFromParser?: boolean;
  manualOverride?: boolean;
  canCreateScheduleRow?: boolean;
  requirementShape?: TransferPlannerRequirementStructuralShape | null;
  reason?: string | null;
}): TransferPlannerChecklistItem {
  const requirementShape =
    input.requirementShape ??
    input.requirementGroup?.requirementShape ??
    (input.canCreateScheduleRow === false ? "hidden-informational-row" : "required-row");
  return {
    id: input.id,
    title: input.title,
    grcCourses: input.grcCourses,
    ...(input.alternatives ? { alternatives: input.alternatives } : {}),
    ...(input.note ? { note: input.note } : {}),
    ...(input.minCompletedCount ? { minCompletedCount: input.minCompletedCount } : {}),
    ...(input.requirementGroup ? { requirementGroup: input.requirementGroup } : {}),
    ...(input.selectedRequirementOptionIds?.length
      ? { selectedRequirementOptionIds: input.selectedRequirementOptionIds }
      : {}),
    ...(input.scheduleSelectedRequirementOptions
      ? { scheduleSelectedRequirementOptions: true }
      : {}),
    ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl } : {}),
    ...(input.sourceRole !== undefined ? { sourceRole: input.sourceRole } : {}),
    ...(input.sourceScope !== undefined ? { sourceScope: input.sourceScope } : {}),
    ...(input.sourceSection !== undefined ? { sourceSection: input.sourceSection } : {}),
    ...(input.generatedFromParser !== undefined
      ? { generatedFromParser: input.generatedFromParser }
      : {}),
    ...(input.manualOverride !== undefined ? { manualOverride: input.manualOverride } : {}),
    ...(input.canCreateScheduleRow !== undefined
      ? { canCreateScheduleRow: input.canCreateScheduleRow }
      : {}),
    ...(requirementShape ? { requirementShape } : {}),
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
  };
}

const RUNTIME_MANUAL_SEED_SCHEDULABLE_ROLES = new Set([
  "degree-requirements",
  "catalog",
  "curriculum",
  "worksheet",
  "official-catalog",
  "primary-degree-requirements",
  "department-requirements",
  "pathway-degree-sheet",
]);

function getRuntimeManualSeedSourceMetadata(
  planId: string,
  sourceSection: string,
  reason: string
): Pick<
  TransferPlannerChecklistItem,
  | "sourceUrl"
  | "sourceRole"
  | "sourceScope"
  | "sourceSection"
  | "generatedFromParser"
  | "manualOverride"
  | "canCreateScheduleRow"
  | "reason"
> {
  const primarySource =
    getRuntimePrimaryDegreeSourceByPathwayKey(getPlannerPathwayKey(planId, null)) ?? null;
  const sourceRole = primarySource?.role ?? null;
  const canCreateScheduleRow =
    primarySource?.isPrimaryDegreeRequirementsLink === true ||
    RUNTIME_MANUAL_SEED_SCHEDULABLE_ROLES.has(String(sourceRole ?? ""));

  return {
    sourceUrl: primarySource?.url ?? null,
    sourceRole,
    sourceScope: canCreateScheduleRow ? "primary-schedulable-runtime-manual" : "unscoped-runtime-manual",
    sourceSection,
    generatedFromParser: false,
    manualOverride: true,
    canCreateScheduleRow,
    reason,
  };
}

function annotateRuntimeManualChecklistItems(
  planId: string,
  items: TransferPlannerChecklistItem[],
  reason: string
) {
  return items.map((item) => ({
    ...item,
    ...getRuntimeManualSeedSourceMetadata(planId, item.title, reason),
  }));
}

function buildUwSeattleEceRuntimeChecklist() {
  const ownerId = UW_SEATTLE_ECE_PLAN_ID;
  const programmingAdmissionGroup = buildRuntimeRequirementGroup({
    ownerId,
    id: "ece-transfer-programming-admission",
    label: "CSE 122 or CSE 123 or CSE 142 or CSE 143",
    options: [
      { courseCode: "CSE 122", grcMatches: ["CS 122"] },
      { courseCode: "CSE 123", grcMatches: ["CS 123"] },
      { courseCode: "CSE 142", grcMatches: ["CS& 141"] },
      { courseCode: "CSE 143", grcMatches: ["CS 145"] },
    ],
  });
  const programmingPreEnrollmentGroup = buildRuntimeRequirementGroup({
    ownerId,
    id: "ece-preenroll-programming",
    label: "CSE 123 or CSE 143",
    options: [
      { courseCode: "CSE 123", grcMatches: ["CS 123"] },
      { courseCode: "CSE 143", grcMatches: ["CS 145"] },
    ],
  });

  const applicationChecklist = [
    buildRuntimeChecklistItem({
      id: "ece-transfer-calculus",
      title: "MATH 124, 125, 126",
      grcCourses: ["MATH& 151", "MATH& 152", "MATH& 163"],
      alternatives: [["MATH& 151", "MATH& 152", "MATH& 153", "MATH& 254"]],
    }),
    buildRuntimeChecklistItem({
      id: "ece-transfer-programming-admission",
      title: "CSE 122 or CSE 123 or CSE 142 or CSE 143",
      grcCourses: ["CS 122"],
      alternatives: [["CS 123"], ["CS 145"]],
      minCompletedCount: 1,
      requirementGroup: programmingAdmissionGroup,
      selectedRequirementOptionIds: [programmingAdmissionGroup.options[0]?.id ?? ""].filter(Boolean),
      scheduleSelectedRequirementOptions: true,
    }),
    buildRuntimeChecklistItem({
      id: "ece-transfer-physics",
      title: "PHYS 121 and PHYS 122",
      grcCourses: ["PHYS& 221", "PHYS& 222"],
    }),
    buildRuntimeChecklistItem({
      id: "ece-transfer-english-composition",
      title: "ENGL 131 or other composition course",
      grcCourses: ["ENGL& 101"],
    }),
  ];

  const beforeEnrollmentChecklist = [
    buildRuntimeChecklistItem({
      id: "ece-preenroll-programming",
      title: "CSE 123 or CSE 143",
      grcCourses: ["CS 123"],
      alternatives: [["CS 145"]],
      minCompletedCount: 1,
      requirementGroup: programmingPreEnrollmentGroup,
      selectedRequirementOptionIds: [programmingPreEnrollmentGroup.options[0]?.id ?? ""].filter(Boolean),
      scheduleSelectedRequirementOptions: true,
    }),
    buildRuntimeChecklistItem({
      id: "ece-preenroll-math207",
      title: "MATH 207 or AMATH 351",
      grcCourses: ["MATH 238"],
    }),
    buildRuntimeChecklistItem({
      id: "ece-degree-math208",
      title: "MATH 208 or AMATH 352",
      grcCourses: ["MATH 240"],
    }),
    buildRuntimeChecklistItem({
      id: "ece-preenroll-approved-science-chem142",
      title: "Approved natural science course: CHEM 142",
      grcCourses: ["CHEM& 161"],
    }),
    buildRuntimeChecklistItem({
      id: "ece-degree-ee215",
      title: "EE 215",
      grcCourses: ["ENGR& 204"],
      note: REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE,
    }),
  ];

  return {
    applicationChecklist,
    beforeEnrollmentChecklist,
    requirementGroups: [programmingAdmissionGroup, programmingPreEnrollmentGroup],
  };
}

function normalizeUwSeattleEceRuntimePlan<T extends TransferPlannerResolvedMajorPlan>(plan: T): T {
  if (plan.id !== UW_SEATTLE_ECE_PLAN_ID) {
    return plan;
  }

  const checklist = buildUwSeattleEceRuntimeChecklist();
  const applicationChecklist = annotateRuntimeManualChecklistItems(
    UW_SEATTLE_ECE_PLAN_ID,
    checklist.applicationChecklist,
    "Manual runtime normalization for UW Seattle ECE transfer requirements."
  );
  const beforeEnrollmentChecklist = annotateRuntimeManualChecklistItems(
    UW_SEATTLE_ECE_PLAN_ID,
    checklist.beforeEnrollmentChecklist,
    "Manual runtime normalization for UW Seattle ECE lower-division requirements."
  );
  const grcCourseList = unique(
    [
      ...applicationChecklist,
      ...beforeEnrollmentChecklist,
    ].flatMap((item) => [item.grcCourses, ...(item.alternatives ?? [])].flat())
  ).map((courseCode) => normalizeCourseCode(courseCode));

  return {
    ...plan,
    bestTrackId: plan.bestTrackId ?? UW_SEATTLE_ECE_TRANSFER_TRACK_ID,
    applicationChecklist,
    beforeEnrollmentChecklist,
    stayAtGrcChecklist: [],
    grcCourseList,
    requirementGroups: checklist.requirementGroups,
    validationNotes: unique([
      ...(plan.validationNotes ?? []),
      "Runtime ECE transfer checklist normalized to the current BSECE transfer admission and lower-division degree requirements.",
    ]),
  };
}

function buildUwSeattleMechanicalRuntimeChecklist() {
  const applicationChecklist = [
    buildRuntimeChecklistItem({
      id: "me-transfer-english-composition",
      title: "English Composition",
      grcCourses: ["ENGL& 101"],
    }),
    buildRuntimeChecklistItem({
      id: "me-transfer-calculus",
      title: "MATH 124, 125, 126",
      grcCourses: ["MATH& 151", "MATH& 152", "MATH& 163"],
      alternatives: [["MATH& 151", "MATH& 152", "MATH& 153", "MATH& 254"]],
    }),
    buildRuntimeChecklistItem({
      id: "me-transfer-physics",
      title: "PHYS 121 and PHYS 122",
      grcCourses: ["PHYS& 221", "PHYS& 222"],
    }),
    buildRuntimeChecklistItem({
      id: "me-transfer-chem142",
      title: "CHEM 142",
      grcCourses: ["CHEM& 161"],
    }),
    buildRuntimeChecklistItem({
      id: "me-transfer-aa210",
      title: "AA 210",
      grcCourses: ["ENGR& 214"],
    }),
    buildRuntimeChecklistItem({
      id: "me-transfer-amath301",
      title: "AMATH 301",
      grcCourses: ["ENGR 250"],
    }),
    buildRuntimeChecklistItem({
      id: "me-transfer-me123",
      title: "M E 123",
      grcCourses: ["ENGR& 114"],
    }),
    buildRuntimeChecklistItem({
      id: "me-transfer-mse170",
      title: "MSE 170",
      grcCourses: ["ENGR 140"],
    }),
  ];

  const beforeEnrollmentChecklist = [
    buildRuntimeChecklistItem({
      id: "me-preenroll-chem152",
      title: "CHEM 152",
      grcCourses: ["CHEM& 162", "CHEM& 163"],
    }),
    buildRuntimeChecklistItem({
      id: "me-preenroll-cee220",
      title: "CEE 220",
      grcCourses: ["ENGR& 225"],
    }),
    buildRuntimeChecklistItem({
      id: "me-preenroll-ee215",
      title: "E E 215",
      grcCourses: ["ENGR& 204"],
    }),
    buildRuntimeChecklistItem({
      id: "me-preenroll-me230",
      title: "ME 230",
      grcCourses: ["ENGR& 215"],
    }),
    buildRuntimeChecklistItem({
      id: "me-preenroll-phys123",
      title: "PHYS 123",
      grcCourses: ["PHYS& 223"],
    }),
    buildRuntimeChecklistItem({
      id: "me-preenroll-math207",
      title: "MATH 207 or MATH 307",
      grcCourses: ["MATH 238"],
      alternatives: [["MATH 307"]],
    }),
    buildRuntimeChecklistItem({
      id: "me-preenroll-math208",
      title: "MATH 208 or MATH 308",
      grcCourses: ["MATH 240"],
      alternatives: [["MATH 308"]],
    }),
    buildRuntimeChecklistItem({
      id: "me-degree-math224",
      title: "MATH 224 or MATH 324",
      grcCourses: ["MATH& 264"],
      note: REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE,
    }),
  ];

  return {
    applicationChecklist,
    beforeEnrollmentChecklist,
  };
}

function buildRuntimeGrcCourseListFromChecklists(
  checklists: TransferPlannerChecklistItem[],
  options: { onlyCanonicalGrcCourses?: boolean } = {}
) {
  return unique(
    checklists
      .flatMap((item) => [item.grcCourses, ...(item.alternatives ?? [])].flat())
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter((courseCode) =>
        options.onlyCanonicalGrcCourses
          ? Boolean(getTransferPlannerCanonicalCourse("grc", courseCode))
          : Boolean(courseCode)
      )
  );
}

function getRuntimeChecklistItemMappedCourseCodes(item: TransferPlannerChecklistItem) {
  return unique(
    [
      ...(item.grcCourses ?? []),
      ...(item.alternatives ?? []).flat(),
      ...(item.requirementGroup?.options ?? []).flatMap((option) => option.grcMatches ?? []),
    ]
      .flatMap((courseLabel) => extractTransferPlannerCourseCodes(courseLabel))
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function appendSourceGeneratedRuntimeChecklistItems(
  normalizedItems: TransferPlannerChecklistItem[],
  sourceItems: TransferPlannerChecklistItem[] | undefined
) {
  const coveredCourseCodes = new Set(
    normalizedItems.flatMap(getRuntimeChecklistItemMappedCourseCodes)
  );
  const seenItemKeys = new Set(
    normalizedItems.map((item) => `${item.sourceUrl ?? ""}::${item.title ?? ""}`)
  );
  const retainedItems: TransferPlannerChecklistItem[] = [];

  for (const item of sourceItems ?? []) {
    if (
      item.generatedFromParser !== true ||
      item.manualOverride === true ||
      item.canCreateScheduleRow === false
    ) {
      continue;
    }

    const mappedCourseCodes = getRuntimeChecklistItemMappedCourseCodes(item);
    if (!mappedCourseCodes.some((courseCode) => !coveredCourseCodes.has(courseCode))) {
      continue;
    }

    const itemKey = `${item.sourceUrl ?? ""}::${item.title ?? ""}`;
    if (seenItemKeys.has(itemKey)) {
      continue;
    }

    seenItemKeys.add(itemKey);
    mappedCourseCodes.forEach((courseCode) => coveredCourseCodes.add(courseCode));
    retainedItems.push(item);
  }

  return [...normalizedItems, ...retainedItems];
}

function uniqueRuntimeRequirementGroups(
  groups: Array<TransferPlannerRequirementGroup | null | undefined>
) {
  const byId = new Map<string, TransferPlannerRequirementGroup>();
  for (const group of groups) {
    if (!group?.id || byId.has(group.id)) {
      continue;
    }
    byId.set(group.id, group);
  }
  return [...byId.values()];
}

function requirementOptionHasMappedGrcCourse(option: TransferPlannerRequirementOption) {
  return Boolean((option.grcMatches ?? []).length);
}

function requirementOptionIsCategoryOption(option: TransferPlannerRequirementOption) {
  return option.optionKind === "category-option" || Boolean(option.categoryOption);
}

function isSourceBackedRuntimePlaceholderGroup(group: TransferPlannerRequirementGroup) {
  const hasCreditTarget =
    typeof group.minCredits === "number" ||
    typeof group.maxCredits === "number" ||
    /\b\d+(?:\.\d+)?\s*(?:credits?|cr)\b/i.test(
      `${group.creditText ?? ""} ${group.label ?? ""} ${group.sourceHeading ?? ""}`
    );

  return Boolean(
    group.canCreatePlaceholder === true &&
      hasCreditTarget &&
      group.supportOnly !== true &&
      group.sourceRole &&
      group.sourceSectionSchedulable !== false
  );
}

function buildSourceBackedRuntimePlaceholderGroups(
  groups: TransferPlannerRequirementGroup[] | undefined
) {
  return uniqueRuntimeRequirementGroups(
    (groups ?? [])
      .filter(isSourceBackedRuntimePlaceholderGroup)
      .map((group) => {
        const hasMappedOptions = (group.options ?? []).some(requirementOptionHasMappedGrcCourse);
        if (hasMappedOptions || !(group.options ?? []).length) {
          return group;
        }

        const categoryOptions = (group.options ?? []).filter(requirementOptionIsCategoryOption);
        return {
          ...group,
          options: categoryOptions,
          canCreateScheduleRow: false,
          notes: unique([
            ...(group.notes ?? []),
            "Preserved as a placeholder because the official requirement has no mapped Green River scheduling rows.",
          ]),
        };
      })
  );
}

function normalizeUwSeattleMechanicalRuntimePlan<T extends TransferPlannerResolvedMajorPlan>(
  plan: T
): T {
  if (plan.id !== UW_SEATTLE_ME_PLAN_ID) {
    return plan;
  }

  const checklist = buildUwSeattleMechanicalRuntimeChecklist();
  const applicationChecklist = annotateRuntimeManualChecklistItems(
    UW_SEATTLE_ME_PLAN_ID,
    checklist.applicationChecklist,
    "Manual runtime normalization for UW Seattle Mechanical Engineering transfer requirements."
  );
  const beforeEnrollmentChecklist = annotateRuntimeManualChecklistItems(
    UW_SEATTLE_ME_PLAN_ID,
    checklist.beforeEnrollmentChecklist,
    "Manual runtime normalization for UW Seattle Mechanical Engineering lower-division requirements."
  );
  const grcCourseList = unique(
    [
      ...applicationChecklist,
      ...beforeEnrollmentChecklist,
    ].flatMap((item) => [item.grcCourses, ...(item.alternatives ?? [])].flat())
  ).map((courseCode) => normalizeCourseCode(courseCode));

  return refreshRuntimeMatchedTrackCopy({
    ...plan,
    bestTrackId:
      plan.bestTrackId ?? UW_SEATTLE_CIVIL_MECHANICAL_TRANSFER_TRACK_ID,
    applicationChecklist,
    beforeEnrollmentChecklist,
    stayAtGrcChecklist: [],
    grcCourseList,
    requirementGroups: [],
    validationNotes: unique([
      ...(plan.validationNotes ?? []),
      "Runtime Mechanical Engineering transfer checklist normalized to the current ME transfer admission and enrollment requirements.",
    ]),
  });
}

function buildUwSeattleCivilRuntimeChecklist() {
  const ownerId = UW_SEATTLE_CIVIL_PLAN_ID;
  const civilComputingGroup = buildRuntimeRequirementGroup({
    ownerId,
    id: "civil-computing-programming",
    label: "Computing/programming Engineering Fundamentals",
    options: [
      { courseCode: "AMATH 301", grcMatches: ["ENGR 250"] },
      { courseCode: "CSE 121", grcMatches: ["CS 121"] },
      { courseCode: "CSE 122", grcMatches: ["CS 122"] },
      { courseCode: "CSE 123", grcMatches: ["CS 123"] },
      { courseCode: "CSE 142", grcMatches: ["CS& 141"] },
      { courseCode: "CSE 160", grcMatches: [] },
    ],
  });

  const applicationChecklist = [
    buildRuntimeChecklistItem({
      id: "civil-transfer-english-composition",
      title: "English Composition",
      grcCourses: ["ENGL& 101"],
    }),
    buildRuntimeChecklistItem({
      id: "civil-transfer-calculus",
      title: "MATH 124, 125, 126",
      grcCourses: ["MATH& 151", "MATH& 152", "MATH& 163"],
      alternatives: [["MATH& 151", "MATH& 152", "MATH& 153", "MATH& 254"]],
    }),
    buildRuntimeChecklistItem({
      id: "civil-transfer-physics",
      title: "PHYS 121 and PHYS 122",
      grcCourses: ["PHYS& 221", "PHYS& 222"],
    }),
    buildRuntimeChecklistItem({
      id: "civil-transfer-chem142",
      title: "CHEM 142",
      grcCourses: ["CHEM& 161"],
    }),
    buildRuntimeChecklistItem({
      id: "civil-transfer-aa210",
      title: "AA 210",
      grcCourses: ["ENGR& 214"],
    }),
  ];

  const beforeEnrollmentChecklist = [
    buildRuntimeChecklistItem({
      id: "civil-preenroll-chem152",
      title: "CHEM 152",
      grcCourses: ["CHEM& 162", "CHEM& 163"],
    }),
    buildRuntimeChecklistItem({
      id: "civil-preenroll-computing-programming",
      title: "Computing/programming Engineering Fundamentals",
      grcCourses: [],
      minCompletedCount: 1,
      requirementGroup: civilComputingGroup,
    }),
    buildRuntimeChecklistItem({
      id: "civil-preenroll-cee220",
      title: "CEE 220",
      grcCourses: ["ENGR& 225"],
    }),
    buildRuntimeChecklistItem({
      id: "civil-preenroll-me230",
      title: "ME 230",
      grcCourses: ["ENGR& 215"],
    }),
    buildRuntimeChecklistItem({
      id: "civil-preenroll-phys123",
      title: "PHYS 123",
      grcCourses: ["PHYS& 223"],
    }),
    buildRuntimeChecklistItem({
      id: "civil-preenroll-math207",
      title: "MATH 207 or MATH 307 or AMATH 351",
      grcCourses: ["MATH 238"],
      alternatives: [["MATH 307"], ["AMATH 351"]],
    }),
    buildRuntimeChecklistItem({
      id: "civil-preenroll-math208",
      title: "MATH 208 or MATH 308 or AMATH 352",
      grcCourses: ["MATH 240"],
      alternatives: [["MATH 308"], ["AMATH 352"]],
    }),
    buildRuntimeChecklistItem({
      id: "civil-economics-topic-requirement",
      title: "Economics topic requirement: IND E 250, ECON 200 or 201, or ESRM/ECON/ENVIR 235",
      grcCourses: ["ECON& 202"],
      alternatives: [["ECON& 201"], ["ENVIR 235"], ["IND E 250"]],
    }),
    buildRuntimeChecklistItem({
      id: "civil-basic-science-course",
      title: "Basic Science Elective",
      grcCourses: ["NATRS 210"],
      alternatives: [["GEOL& 101"]],
      minCompletedCount: 1,
    }),
    buildRuntimeChecklistItem({
      id: "civil-statistics-requirement",
      title: "IND E 315, QSCI 381, STAT 290, or STAT 390",
      grcCourses: [],
      minCompletedCount: 1,
      note: "Kept internal in Green River transfer-only planning until a Green River equivalent is available.",
    }),
  ];

  return {
    applicationChecklist,
    beforeEnrollmentChecklist,
    stayAtGrcChecklist: [] as TransferPlannerChecklistItem[],
    requirementGroups: [civilComputingGroup],
  };
}

function normalizeUwSeattleCivilRuntimePlan<T extends TransferPlannerResolvedMajorPlan>(
  plan: T
): T {
  if (plan.id !== UW_SEATTLE_CIVIL_PLAN_ID) {
    return plan;
  }

  const checklist = buildUwSeattleCivilRuntimeChecklist();
  const applicationChecklist = annotateRuntimeManualChecklistItems(
    UW_SEATTLE_CIVIL_PLAN_ID,
    checklist.applicationChecklist,
    "Manual runtime normalization for UW Seattle Civil Engineering transfer requirements."
  );
  const beforeEnrollmentChecklist = annotateRuntimeManualChecklistItems(
    UW_SEATTLE_CIVIL_PLAN_ID,
    checklist.beforeEnrollmentChecklist,
    "Manual runtime normalization for UW Seattle Civil Engineering lower-division requirements."
  );
  const stayAtGrcChecklist = annotateRuntimeManualChecklistItems(
    UW_SEATTLE_CIVIL_PLAN_ID,
    checklist.stayAtGrcChecklist,
    "Manual runtime normalization for UW Seattle Civil Engineering support requirements."
  );
  const grcCourseList = buildRuntimeGrcCourseListFromChecklists(
    [
      ...applicationChecklist,
      ...beforeEnrollmentChecklist,
      ...stayAtGrcChecklist,
    ],
    { onlyCanonicalGrcCourses: true }
  );

  return {
    ...plan,
    bestTrackId:
      plan.bestTrackId ?? UW_SEATTLE_CIVIL_MECHANICAL_TRANSFER_TRACK_ID,
    applicationChecklist,
    beforeEnrollmentChecklist,
    stayAtGrcChecklist,
    grcCourseList,
    requirementGroups: checklist.requirementGroups,
    validationNotes: unique([
      ...(plan.validationNotes ?? []),
      "Runtime Civil Engineering transfer checklist normalized to the current BSCE application, enrollment, and lower-division degree requirements.",
    ]),
  };
}

function buildUwSeattleBioengineeringRuntimeChecklist() {
  const applicationChecklist = [
    buildRuntimeChecklistItem({
      id: "bioe-english-composition",
      title: "English Composition",
      grcCourses: ["ENGL& 101"],
    }),
    buildRuntimeChecklistItem({
      id: "bioe-calculus",
      title: "MATH 124, 125, 126",
      grcCourses: ["MATH& 151", "MATH& 152", "MATH& 163"],
      alternatives: [["MATH& 151", "MATH& 152", "MATH& 153", "MATH& 254"]],
    }),
    buildRuntimeChecklistItem({
      id: "bioe-general-chemistry",
      title: "CHEM 142, 152, 162",
      grcCourses: ["CHEM& 161", "CHEM& 162", "CHEM& 163"],
    }),
    buildRuntimeChecklistItem({
      id: "bioe-physics-121",
      title: "PHYS 121",
      grcCourses: ["PHYS& 221"],
    }),
    buildRuntimeChecklistItem({
      id: "biol180",
      title: "BIOL 180, 200, 220",
      grcCourses: ["BIOL& 211", "BIOL& 212", "BIOL& 213"],
    }),
    buildRuntimeChecklistItem({
      id: "programming",
      title: "AMATH 301",
      grcCourses: ["ENGR 250"],
    }),
  ];

  const beforeEnrollmentChecklist = [
    buildRuntimeChecklistItem({
      id: "bioe-math207",
      title: "MATH 207 or AMATH 351",
      grcCourses: ["MATH 238"],
    }),
    buildRuntimeChecklistItem({
      id: "bioe-math208",
      title: "MATH 208 or AMATH 352",
      grcCourses: ["MATH 240"],
    }),
    buildRuntimeChecklistItem({
      id: "bioe-statistics-requirement",
      title: "STAT 311, STAT 390, IND E 315, or Q SCI 381",
      grcCourses: [],
      minCompletedCount: 1,
      note: "Kept internal in Green River transfer-only planning until a Green River equivalent is available.",
    }),
    buildRuntimeChecklistItem({
      id: "bioe-organic-chemistry",
      title: "CHEM 223 or CHEM 237",
      grcCourses: ["CHEM& 261"],
    }),
    buildRuntimeChecklistItem({
      id: "bioe-physics-122",
      title: "PHYS 122",
      grcCourses: ["PHYS& 222"],
    }),
  ];

  return {
    applicationChecklist,
    beforeEnrollmentChecklist,
    stayAtGrcChecklist: [] as TransferPlannerChecklistItem[],
  };
}

function appendUwSeattleBioengineeringGeneralEducationSection<
  T extends TransferPlannerMajorPlan,
>(plan: T): T {
  if (plan.id !== UW_SEATTLE_BIOENGINEERING_PLAN_ID) {
    return plan;
  }

  return {
    ...plan,
    degreeMapSections: [
      ...(plan.degreeMapSections ?? []).filter(
        (section) => section.id !== UW_SEATTLE_BIOENGINEERING_GEN_ED_SECTION.id
      ),
      UW_SEATTLE_BIOENGINEERING_GEN_ED_SECTION,
    ],
  };
}

function buildRuntimeTrackReferenceCourseCodes(track: TransferPlannerTrack) {
  return unique(
    track.terms
      .filter(
        (term) =>
          !RUNTIME_AUTO_MATCH_EXCLUDED_TRACK_TERM_LABEL_PATTERN.test(
            String(term.label ?? "").trim()
          )
      )
      .flatMap((term) => term.courses)
      .flatMap((courseLabel) => extractTransferPlannerCourseCodes(courseLabel))
  );
}

function buildRuntimeReferenceLabelByCode(labels: string[]) {
  const labelByCode = new Map<string, string>();

  for (const label of labels) {
    for (const code of extractTransferPlannerCourseCodes(label)) {
      if (!labelByCode.has(code)) {
        labelByCode.set(code, label);
      }
    }
  }

  return labelByCode;
}

function buildRuntimeMatchedTrackRecommendation(plan: TransferPlannerMajorPlan) {
  const track = getTransferPlannerTrack(plan.bestTrackId ?? null);
  if (!track) {
    return null;
  }

  const trackedGrcRequirementLabels = getTransferPlannerGrcCourseList(plan);
  const trackedGrcRequirementCodes = unique(
    trackedGrcRequirementLabels.flatMap((label) => extractTransferPlannerCourseCodes(label))
  );
  if (!trackedGrcRequirementCodes.length) {
    return null;
  }

  const trackedGrcRequirementCodeSet = new Set(trackedGrcRequirementCodes);
  const labelByCode = buildRuntimeReferenceLabelByCode(trackedGrcRequirementLabels);
  const matchedCourseCodes = buildRuntimeTrackReferenceCourseCodes(track).filter((courseCode) =>
    trackedGrcRequirementCodeSet.has(courseCode)
  );
  const matchedCourseLabels = unique(
    matchedCourseCodes.map((courseCode) => labelByCode.get(courseCode) ?? courseCode)
  );
  const matchedExamples = matchedCourseLabels.slice(0, RUNTIME_AUTO_TRACK_MATCH_EXAMPLE_LIMIT);
  const remainingCount = Math.max(matchedCourseLabels.length - matchedExamples.length, 0);
  const examplesNote = matchedExamples.length
    ? `, including ${matchedExamples.join(", ")}${
        remainingCount > 0 ? `, plus ${remainingCount} more` : ""
      }`
    : "";

  return {
    recommendedTrackSummary: `${track.code} is the current closest Green River transfer path for this degree because it matches ${matchedCourseCodes.length} of the ${trackedGrcRequirementCodes.length} degree-specific Green River classes currently tracked for this major.`,
    whyThisTrack: [
      `${track.code} has the strongest direct overlap with the current degree-specific Green River class list${examplesNote}.`,
      `This auto-match compares every hardcoded course in the current Green River transfer tracks against the major's tracked Green River classes and keeps the track with the highest concrete course overlap.`,
      `Use the remaining major-specific checklist items to add the classes that ${track.code} does not cover by itself.`,
    ],
  };
}

function refreshRuntimeMatchedTrackCopy<T extends TransferPlannerMajorPlan>(plan: T): T {
  const matchedTrackRecommendation = buildRuntimeMatchedTrackRecommendation(plan);
  if (!matchedTrackRecommendation) {
    return plan;
  }

  return {
    ...plan,
    recommendedTrackSummary: matchedTrackRecommendation.recommendedTrackSummary,
    whyThisTrack: matchedTrackRecommendation.whyThisTrack,
  };
}

function normalizeUwSeattleBioengineeringRuntimePlan<T extends TransferPlannerMajorPlan>(
  plan: T
): T {
  if (plan.id !== UW_SEATTLE_BIOENGINEERING_PLAN_ID) {
    return plan;
  }

  const checklist = buildUwSeattleBioengineeringRuntimeChecklist();
  const applicationChecklist = annotateRuntimeManualChecklistItems(
    UW_SEATTLE_BIOENGINEERING_PLAN_ID,
    checklist.applicationChecklist,
    "Manual runtime normalization for UW Seattle Bioengineering transfer requirements."
  );
  const beforeEnrollmentChecklist = annotateRuntimeManualChecklistItems(
    UW_SEATTLE_BIOENGINEERING_PLAN_ID,
    checklist.beforeEnrollmentChecklist,
    "Manual runtime normalization for UW Seattle Bioengineering lower-division requirements."
  );
  const stayAtGrcChecklist = annotateRuntimeManualChecklistItems(
    UW_SEATTLE_BIOENGINEERING_PLAN_ID,
    checklist.stayAtGrcChecklist,
    "Manual runtime normalization for UW Seattle Bioengineering support requirements."
  );
  const normalizedChecklistItems = [
    ...applicationChecklist,
    ...beforeEnrollmentChecklist,
    ...stayAtGrcChecklist,
  ];
  const sourceGeneratedChecklistItems = [
    ...(plan.applicationChecklist ?? []),
    ...(plan.beforeEnrollmentChecklist ?? []),
    ...(plan.stayAtGrcChecklist ?? []),
  ];
  const beforeEnrollmentChecklistWithSourceRows = appendSourceGeneratedRuntimeChecklistItems(
    beforeEnrollmentChecklist,
    sourceGeneratedChecklistItems
  );
  const allChecklistItems = [
    ...applicationChecklist,
    ...beforeEnrollmentChecklistWithSourceRows,
    ...stayAtGrcChecklist,
  ];
  const grcCourseList = buildRuntimeGrcCourseListFromChecklists(
    allChecklistItems,
    { onlyCanonicalGrcCourses: true }
  );

  return refreshRuntimeMatchedTrackCopy(appendUwSeattleBioengineeringGeneralEducationSection({
    ...plan,
    bestTrackId: UW_SEATTLE_BIOENGINEERING_TRANSFER_TRACK_ID,
    applicationChecklist,
    beforeEnrollmentChecklist: beforeEnrollmentChecklistWithSourceRows,
    stayAtGrcChecklist,
    grcCourseList,
    requirementGroups: uniqueRuntimeRequirementGroups([
      ...(plan.requirementGroups ?? []),
      ...normalizedChecklistItems.map((item) => item.requirementGroup),
      ...allChecklistItems.map((item) => item.requirementGroup),
    ]),
    validationNotes: unique([
      ...(plan.validationNotes ?? []),
      "Runtime Bioengineering transfer checklist normalized to the current UW Bioengineering lower-division, programming, science, math, and general-education requirements.",
    ]),
  }));
}

function normalizeUwSeattleComputerScienceRuntimePlan<T extends TransferPlannerMajorPlan>(
  plan: T
): T {
  if (plan.id !== UW_SEATTLE_COMPUTER_SCIENCE_PLAN_ID) {
    return plan;
  }

  const beforeEnrollmentChecklist = [...(plan.beforeEnrollmentChecklist ?? [])];
  const hasProgrammingSequence = beforeEnrollmentChecklist.some((item) =>
    /(?:CSE 123 or CSE 143|CSE 121-123 programming sequence)/i.test(item.title)
  );
  if (hasProgrammingSequence) {
    return plan;
  }

  const programmingSequenceItem = buildRuntimeChecklistItem({
    id: "cs-programming-sequence",
    title: "CSE 121-123 programming sequence",
    grcCourses: ["CS 121", "CS 122", "CS 123"],
    sourceRole: "primary-degree-requirements",
    sourceScope: "primary-schedulable-runtime-manual",
    sourceSection: "CSE 123 Intro to Computer Programming III",
    generatedFromParser: false,
    manualOverride: true,
    canCreateScheduleRow: true,
    reason:
      "Runtime normalization preserves the Allen School programming preparation sequence when generated pathway rows expose only the final CS 123 course.",
  });
  const normalizedBeforeEnrollmentChecklist = [
    programmingSequenceItem,
    ...beforeEnrollmentChecklist,
  ];
  const grcCourseList = unique([
    ...(plan.grcCourseList ?? []),
    ...buildRuntimeGrcCourseListFromChecklists([programmingSequenceItem], {
      onlyCanonicalGrcCourses: true,
    }),
  ]);

  return {
    ...plan,
    beforeEnrollmentChecklist: normalizedBeforeEnrollmentChecklist,
    grcCourseList,
    validationNotes: unique([
      ...(plan.validationNotes ?? []),
      "Runtime Computer Science checklist preserves the source-backed CSE 121-123 programming sequence for Green River planning.",
    ]),
  };
}

function buildUwSeattleChemicalEngineeringRuntimeChecklist() {
  const applicationChecklist = [
    buildRuntimeChecklistItem({
      id: "cheme-english-composition",
      title: "English Composition",
      grcCourses: ["ENGL& 101"],
    }),
    buildRuntimeChecklistItem({
      id: "cheme-calculus",
      title: "MATH 124, 125, 126",
      grcCourses: ["MATH& 151", "MATH& 152", "MATH& 163"],
      alternatives: [["MATH& 151", "MATH& 152", "MATH& 153", "MATH& 254"]],
    }),
    buildRuntimeChecklistItem({
      id: "cheme-general-chemistry",
      title: "CHEM 142, 152, 162",
      grcCourses: ["CHEM& 161", "CHEM& 162", "CHEM& 163"],
    }),
    buildRuntimeChecklistItem({
      id: "cheme-physics",
      title: "PHYS 121, 122, 123",
      grcCourses: ["PHYS& 221", "PHYS& 222", "PHYS& 223"],
    }),
  ];

  const beforeEnrollmentChecklist = [
    buildRuntimeChecklistItem({
      id: "cheme-math-207",
      title: "MATH 207",
      grcCourses: ["MATH 238"],
    }),
    buildRuntimeChecklistItem({
      id: "cheme-math-208",
      title: "MATH 208",
      grcCourses: ["MATH 240"],
    }),
    buildRuntimeChecklistItem({
      id: "cheme-math-elective",
      title: "Math Elective: MATH 224",
      grcCourses: ["MATH& 264"],
    }),
    buildRuntimeChecklistItem({
      id: "cheme-organic-chemistry",
      title: "CHEM 237 and CHEM 238",
      grcCourses: ["CHEM& 261", "CHEM& 262", "CHEM& 263"],
    }),
  ];

  return {
    applicationChecklist,
    beforeEnrollmentChecklist,
    stayAtGrcChecklist: [] as TransferPlannerChecklistItem[],
  };
}

function normalizeUwSeattleChemicalEngineeringRuntimePlan<T extends TransferPlannerMajorPlan>(
  plan: T
): T {
  if (plan.id !== UW_SEATTLE_CHEMICAL_ENGINEERING_PLAN_ID) {
    return plan;
  }

  const checklist = buildUwSeattleChemicalEngineeringRuntimeChecklist();
  const applicationChecklist = annotateRuntimeManualChecklistItems(
    UW_SEATTLE_CHEMICAL_ENGINEERING_PLAN_ID,
    checklist.applicationChecklist,
    "Manual runtime normalization for UW Seattle Chemical Engineering transfer requirements."
  );
  const beforeEnrollmentChecklist = annotateRuntimeManualChecklistItems(
    UW_SEATTLE_CHEMICAL_ENGINEERING_PLAN_ID,
    checklist.beforeEnrollmentChecklist,
    "Manual runtime normalization for UW Seattle Chemical Engineering lower-division requirements."
  );
  const stayAtGrcChecklist = annotateRuntimeManualChecklistItems(
    UW_SEATTLE_CHEMICAL_ENGINEERING_PLAN_ID,
    checklist.stayAtGrcChecklist,
    "Manual runtime normalization for UW Seattle Chemical Engineering support requirements."
  );
  const grcCourseList = buildRuntimeGrcCourseListFromChecklists(
    [
      ...applicationChecklist,
      ...beforeEnrollmentChecklist,
      ...stayAtGrcChecklist,
    ],
    { onlyCanonicalGrcCourses: true }
  );

  return refreshRuntimeMatchedTrackCopy({
    ...plan,
    bestTrackId: plan.bestTrackId ?? UW_SEATTLE_BIOENGINEERING_TRANSFER_TRACK_ID,
    applicationChecklist,
    beforeEnrollmentChecklist,
    stayAtGrcChecklist,
    grcCourseList,
    requirementGroups: buildSourceBackedRuntimePlaceholderGroups(plan.requirementGroups),
    validationNotes: unique([
      ...(plan.validationNotes ?? []),
      "Runtime Chemical Engineering transfer checklist normalized to current ChemE lower-division math, chemistry, physics, English, and mapped NME-path requirements; engineering-elective source lists are not promoted to required transfer rows.",
    ]),
  });
}

function getRequirementGroupOptionUwCourseCodeSet(group: TransferPlannerRequirementGroup) {
  return new Set(
    (group.options ?? [])
      .flatMap((option) => [
        ...(option.uwCourses ?? []),
        ...(option.equivalentUwCourseCodes ?? []),
      ])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
  );
}

function requirementGroupMatchesCategoryChoiceLine(input: {
  group: TransferPlannerRequirementGroup;
  lineCourseCodes: string[];
}) {
  const groupCourseCodes = getRequirementGroupOptionUwCourseCodeSet(input.group);
  if (!groupCourseCodes.size || !input.lineCourseCodes.length) {
    return false;
  }

  const lineCourseCodeSet = new Set(input.lineCourseCodes.map(normalizeCourseCode));
  const matchedGroupCourseCount = [...groupCourseCodes].filter((courseCode) =>
    lineCourseCodeSet.has(courseCode)
  ).length;
  if (input.lineCourseCodes.length > 1 && groupCourseCodes.size === 1) {
    return false;
  }

  return matchedGroupCourseCount >= Math.min(groupCourseCodes.size, input.lineCourseCodes.length);
}

function getRuntimeCategoryOptionKey(option: TransferPlannerRequirementOption) {
  return `${option.categoryOption?.category ?? ""}:${option.categoryOption?.credits ?? ""}:${
    option.categoryOption?.sourceText ?? ""
  }`;
}

function buildRuntimeCategoryRequirementOptionFromGroup(
  group: TransferPlannerRequirementGroup,
  ownerId: string
) {
  if (
    group.requirementType !== "choose_credits" ||
    (group.options ?? []).some((option) => option.optionKind === "category-option" || option.categoryOption)
  ) {
    return null;
  }

  const fallbackCredits =
    typeof group.minCredits === "number" && group.minCredits > 0 ? group.minCredits : null;
  const sourceText =
    [group.label, group.sourceHeading, group.sourceRowText, group.sourceSection]
      .map((value) => String(value ?? "").replace(/\s+/g, " ").trim())
      .find((value) => value && getRuntimeCategoryOptionDescriptor(value)) ?? "";

  if (!sourceText) {
    return null;
  }

  return buildRuntimeCategoryRequirementOption({
    ownerId,
    groupId: group.id,
    sourceText,
    fallbackCredits,
  });
}

function addCategoryOptionsToRequirementGroup(
  group: TransferPlannerRequirementGroup,
  ownerId: string,
  sourceLines: string[]
) {
  const categoryOptionsToAdd: TransferPlannerRequirementOption[] = [];
  const inferredCategoryOption = buildRuntimeCategoryRequirementOptionFromGroup(group, ownerId);
  if (inferredCategoryOption) {
    categoryOptionsToAdd.push(inferredCategoryOption);
  }

  for (const line of sourceLines) {
    const lineCourseCodes = extractTransferPlannerCourseCodes(line);
    if (
      !requirementGroupMatchesCategoryChoiceLine({
        group,
        lineCourseCodes,
      })
    ) {
      continue;
    }

    categoryOptionsToAdd.push(
      ...buildRuntimeCategoryRequirementOptionsFromChoiceLine({
        ownerId,
        groupId: group.id,
        line,
        fallbackCredits: parseRuntimeCategoryOptionCreditAmount(line),
      })
    );
  }

  if (!categoryOptionsToAdd.length) {
    return group;
  }

  const existingCategoryKeys = new Set(
    (group.options ?? [])
      .filter((option) => option.optionKind === "category-option" && option.categoryOption)
      .map(getRuntimeCategoryOptionKey)
  );
  const newCategoryOptions = categoryOptionsToAdd.filter((option) => {
    const key = getRuntimeCategoryOptionKey(option);
    return key && !existingCategoryKeys.has(key);
  });

  if (!newCategoryOptions.length) {
    return group;
  }

  return {
    ...group,
    options: [...(group.options ?? []), ...newCategoryOptions],
  };
}

function addCategoryOptionsToChecklistItems(
  items: TransferPlannerChecklistItem[] | undefined,
  groupMap: Map<string, TransferPlannerRequirementGroup>
) {
  return (items ?? []).map<TransferPlannerChecklistItem>((item) => {
    const group = item.requirementGroup ? groupMap.get(item.requirementGroup.id) : null;
    if (!group || group === item.requirementGroup) {
      return item;
    }

    const retainedOptionIds = new Set((group.options ?? []).map((option) => option.id));
    return {
      ...item,
      requirementGroup: group,
      unselectedRequirementOptionIds: unique([
        ...(item.unselectedRequirementOptionIds ?? []),
        ...(group.options ?? [])
          .map((option) => option.id)
          .filter((optionId): optionId is string =>
            Boolean(optionId && !item.selectedRequirementOptionIds?.includes(optionId))
          ),
      ]).filter((optionId) => retainedOptionIds.has(optionId)),
    };
  });
}

function canParsedRequirementSourceBlockCreateCategoryOptions(
  block: TransferPlannerRuntimeParsedRequirementSourceScopeBlock
) {
  if (
    block.canCreateScheduleRows === false ||
    block.canCreateCategoryOptions === false ||
    block.canCreateOptionGroups === false ||
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

type CategoryOptionRuntimeScope = {
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
  requirementGroups?: TransferPlannerRequirementGroup[];
};

function normalizeCategoryOptionRuntimeScope<T extends CategoryOptionRuntimeScope>(
  scope: T,
  planId: string,
  selectedPathwayId: string | null
): T {
  const sourceLines = getTransferPlannerParsedRequirementSourceBlocks(
    planId,
    selectedPathwayId
  ).flatMap((block) =>
    canParsedRequirementSourceBlockCreateCategoryOptions(block)
      ? [
          ...(block.requirementCueLines ?? []),
          ...((block as { chooseStatements?: string[] }).chooseStatements ?? []),
        ]
      : []
  );

  if (!sourceLines.length) {
    return scope;
  }

  const originalGroups = scope.requirementGroups ?? [];
  const checklistGroups = [
    ...(scope.applicationChecklist ?? []),
    ...(scope.beforeEnrollmentChecklist ?? []),
    ...(scope.stayAtGrcChecklist ?? []),
  ]
    .map((item) => item.requirementGroup)
    .filter((group): group is TransferPlannerRequirementGroup => Boolean(group));
  const groupsById = new Map<string, TransferPlannerRequirementGroup>();
  for (const group of [...originalGroups, ...checklistGroups]) {
    groupsById.set(group.id, group);
  }

  let changed = false;
  const normalizedGroupsById = new Map<string, TransferPlannerRequirementGroup>();
  for (const group of groupsById.values()) {
    const normalizedGroup = addCategoryOptionsToRequirementGroup(group, planId, sourceLines);
    normalizedGroupsById.set(group.id, normalizedGroup);
    if (normalizedGroup !== group) {
      changed = true;
    }
  }

  if (!changed) {
    return scope;
  }

  return {
    ...scope,
    requirementGroups: originalGroups.map((group) => normalizedGroupsById.get(group.id) ?? group),
    applicationChecklist: addCategoryOptionsToChecklistItems(
      scope.applicationChecklist,
      normalizedGroupsById
    ),
    beforeEnrollmentChecklist: addCategoryOptionsToChecklistItems(
      scope.beforeEnrollmentChecklist,
      normalizedGroupsById
    ),
    stayAtGrcChecklist: addCategoryOptionsToChecklistItems(
      scope.stayAtGrcChecklist,
      normalizedGroupsById
    ),
  };
}

export function normalizeCategoryOptionRuntimePlan<T extends TransferPlannerMajorPlan>(
  plan: T
): T {
  const selectedPathwayId =
    "selectedPathwayId" in plan
      ? ((plan as unknown as { selectedPathwayId?: string | null }).selectedPathwayId ?? null)
      : null;
  const normalizedPlan = normalizeCategoryOptionRuntimeScope(plan, plan.id, selectedPathwayId);
  const normalizedPathways = (normalizedPlan.pathways ?? []).map((pathway) =>
    normalizeCategoryOptionRuntimeScope(pathway, normalizedPlan.id, pathway.id)
  );
  const pathwaysChanged = normalizedPathways.some(
    (pathway, index) => pathway !== normalizedPlan.pathways?.[index]
  );

  if (!pathwaysChanged) {
    return normalizedPlan;
  }

  return {
    ...normalizedPlan,
    pathways: normalizedPathways,
  };
}

function normalizeRequirementShapeForGroup(group: TransferPlannerRequirementGroup): TransferPlannerRequirementGroup {
  const normalizedOptions = (group.options ?? []).map((option) => {
    const isCategoryOption = option.optionKind === "category-option" || Boolean(option.categoryOption);
    const requirementShape =
      option.requirementShape ??
      (isCategoryOption ? "category-option" : null);
    if (!isCategoryOption) {
      return requirementShape === option.requirementShape ? option : { ...option, requirementShape };
    }
    const normalizedOption = {
      ...option,
      optionKind: "category-option" as const,
      requirementShape: "category-option" as const,
      displayCourseCodes: [],
      uwCourses: [],
      equivalentUwCourseCodes: [],
      grcMatches: [],
    };
    return (
      option.optionKind === normalizedOption.optionKind &&
      option.requirementShape === normalizedOption.requirementShape &&
      (option.displayCourseCodes ?? []).length === 0 &&
      (option.uwCourses ?? []).length === 0 &&
      (option.equivalentUwCourseCodes ?? []).length === 0 &&
      (option.grcMatches ?? []).length === 0
    )
      ? option
      : normalizedOption;
  });
  const isSequenceChoice = group.requirementType === "sequence_choice";
  const sequenceOptionsByPathId = new Map(
    normalizedOptions
      .filter((option) => option.sequencePathId)
      .map((option) => [option.sequencePathId, option])
  );
  const sequenceOptionsByCourseSet = new Map(
    normalizedOptions.map((option) => [unique(option.uwCourses ?? []).join("|"), option])
  );
  const normalizedSequencePaths = (group.sequencePaths ?? []).map((path) => {
    const uwCourses = unique(path.uwCourses ?? []);
    const matchingOption =
      sequenceOptionsByPathId.get(path.id) ??
      sequenceOptionsByCourseSet.get(uwCourses.join("|")) ??
      null;
    const mappedGrcCourseCodes = unique([
      ...(path.mappedGrcCourseCodes ?? []),
      ...(matchingOption?.grcMatches ?? []),
    ]);
    return {
      ...path,
      uwCourses,
      displayCourseCodes: path.displayCourseCodes?.length ? unique(path.displayCourseCodes) : uwCourses,
      mappedGrcCourseCodes,
      compoundComponents: (path.compoundComponents ?? []).map(unique).filter((component) => component.length),
      conditionalLabCourses: unique(path.conditionalLabCourses ?? []),
      notes: unique(path.notes ?? []),
    };
  });
  const normalizedSequenceOptions = isSequenceChoice
    ? normalizedOptions.map((option) => {
        const path = normalizedSequencePaths.find((candidate) => candidate.id === option.sequencePathId);
        if (!path) {
          return option;
        }
        return {
          ...option,
          pathLabel: option.pathLabel ?? path.label,
          conditionalLabCourses: unique([
            ...(option.conditionalLabCourses ?? []),
            ...(path.conditionalLabCourses ?? []),
          ]),
          notes: unique([...(option.notes ?? []), ...(path.notes ?? [])]),
        };
      })
    : normalizedOptions;
  const isCreditBucket = group.requirementType === "choose_credits";
  const minCredits = group.minCredits ?? null;
  const hasMaxCredits = Object.prototype.hasOwnProperty.call(group, "maxCredits");
  const maxCredits = hasMaxCredits ? group.maxCredits ?? null : minCredits ?? null;
  const creditText =
    group.creditText ?? (isCreditBucket ? formatRuntimeRequirementCreditText(minCredits, maxCredits) : null);
  const satisfactionMode: TransferPlannerRequirementSatisfactionMode | null =
    group.satisfactionMode ?? (isCreditBucket ? "credit-based" : null);
  const requirementShape = isSequenceChoice
    ? "sequence-choice"
    : group.requirementShape ??
      getRuntimeRequirementStructuralShape({
        requirementType: group.requirementType,
        supportOnly: group.supportOnly,
        sourceRole: group.sourceRole,
        sourceSectionSchedulable: group.sourceSectionSchedulable,
        options: normalizedSequenceOptions,
      });
  const optionsChanged = normalizedSequenceOptions.some((option, index) => option !== group.options?.[index]);
  const sequencePathsChanged =
    normalizedSequencePaths.length !== (group.sequencePaths ?? []).length ||
    normalizedSequencePaths.some((path, index) => path !== group.sequencePaths?.[index]);
  if (
    !optionsChanged &&
    !sequencePathsChanged &&
    group.requirementShape === requirementShape &&
    group.minCredits === minCredits &&
    group.maxCredits === maxCredits &&
    group.creditText === creditText &&
    group.satisfactionMode === satisfactionMode &&
    (!isCreditBucket ||
      (group.minCourses == null &&
        group.maxCourses == null &&
        group.selectionCount == null &&
        group.requiredCount == null)) &&
    (!isSequenceChoice ||
      (group.minCourses === 1 &&
        group.maxCourses === 1 &&
        group.selectionCount === 1 &&
        group.requiredCount === 1))
  ) {
    return group;
  }
  return {
    ...group,
    requirementShape,
    minCourses: isCreditBucket ? null : isSequenceChoice ? 1 : group.minCourses ?? null,
    maxCourses: isCreditBucket ? null : isSequenceChoice ? 1 : group.maxCourses ?? null,
    selectionCount: isCreditBucket ? null : isSequenceChoice ? 1 : group.selectionCount ?? null,
    requiredCount: isCreditBucket ? null : isSequenceChoice ? 1 : group.requiredCount ?? null,
    minCredits,
    maxCredits,
    creditText,
    satisfactionMode,
    sequencePaths: normalizedSequencePaths,
    options: normalizedSequenceOptions,
  };
}

function requirementOptionContainsCoursePrefix(
  option: TransferPlannerRequirementOption,
  prefixPattern: RegExp
) {
  return [
    option.label,
    option.pathLabel,
    ...(option.uwCourses ?? []),
    ...(option.equivalentUwCourseCodes ?? []),
    ...(option.grcMatches ?? []),
    ...(option.displayCourseCodes ?? []),
    ...(option.compoundComponents ?? []).flat(),
  ].some((value) => prefixPattern.test(String(value ?? "")));
}

function shouldTreatCreditBucketAsPhysicsSequenceChoice(
  item: TransferPlannerChecklistItem,
  group: TransferPlannerRequirementGroup
) {
  if (group.requirementType !== "choose_credits") {
    return false;
  }

  const options = group.options ?? [];
  if (options.length < 2) {
    return false;
  }

  const groupText = `${item.title} ${group.label ?? ""} ${group.sourceHeading ?? ""}`;
  if (/\blabs?\b|\bone credit lab\b/i.test(groupText)) {
    return false;
  }
  const hasPhysicsContext =
    /\bphys(?:ics)?\b/i.test(groupText) ||
    options.some((option) => requirementOptionContainsCoursePrefix(option, /^PHYS(?:&|\s)/i));
  const hasChoiceContext =
    /\bone of (?:the )?following\b|\bcalculus-based\b|\balgebra-based\b/i.test(groupText);
  const allOptionsArePhysics = options.every((option) =>
    requirementOptionContainsCoursePrefix(option, /^PHYS(?:&|\s)/i)
  );

  return hasPhysicsContext && allOptionsArePhysics && (hasChoiceContext || options.length >= 2);
}

function normalizeRuntimeSequenceChoiceGroupForChecklistItem(
  item: TransferPlannerChecklistItem,
  group: TransferPlannerRequirementGroup
) {
  if (!shouldTreatCreditBucketAsPhysicsSequenceChoice(item, group)) {
    return group;
  }

  return {
    ...group,
    requirementType: "sequence_choice" as const,
    requirementShape: "sequence-choice" as const,
    minCourses: 1,
    maxCourses: 1,
    selectionCount: 1,
    requiredCount: 1,
    minCredits: null,
    maxCredits: null,
    creditText: null,
    satisfactionMode: "selection-count" as TransferPlannerRequirementSatisfactionMode,
    canCreatePlaceholder: false,
  };
}

function pickDefaultSequenceChoiceOption(
  options: TransferPlannerRequirementOption[],
  selectedOptionIds: string[]
) {
  const selectedOption = options.find((option) => selectedOptionIds.includes(option.id ?? ""));
  if (selectedOption) {
    return selectedOption;
  }

  const preferredPhysicsCalculusOption = options.find((option) => {
    const optionText = [
      option.label,
      option.pathLabel,
      ...(option.uwCourses ?? []),
      ...(option.grcMatches ?? []),
    ].join(" ");

    return (
      /\bcalculus(?:-|\s*)based\b/i.test(optionText) ||
      /\bPHYS\s+12[123]\b/i.test(optionText) ||
      /\bPHYS&\s*22[123]\b/i.test(optionText)
    );
  });
  if (preferredPhysicsCalculusOption) {
    return preferredPhysicsCalculusOption;
  }

  return (
    options.find((option) => (option.grcMatches ?? []).length > 0) ??
    options[0] ??
    null
  );
}

function normalizeRequirementShapeForChecklistItem(
  item: TransferPlannerChecklistItem
): TransferPlannerChecklistItem {
  const preNormalizedRequirementGroup = item.requirementGroup
    ? normalizeRuntimeSequenceChoiceGroupForChecklistItem(item, item.requirementGroup)
    : undefined;
  const requirementGroup = preNormalizedRequirementGroup
    ? normalizeRequirementShapeForGroup(preNormalizedRequirementGroup)
    : undefined;
  const requirementShape =
    item.requirementShape ??
    requirementGroup?.requirementShape ??
    (item.canCreateScheduleRow === false ? "hidden-informational-row" : "required-row");
  const isSequenceChoice = requirementGroup?.requirementType === "sequence_choice";
  const selectedSequenceOption =
    isSequenceChoice
      ? pickDefaultSequenceChoiceOption(
          requirementGroup.options ?? [],
          item.selectedRequirementOptionIds ?? []
        )
      : null;
  const selectedSequenceOptionIds =
    selectedSequenceOption?.id ? [selectedSequenceOption.id] : [];
  const unselectedSequenceOptionIds = isSequenceChoice
    ? (requirementGroup?.options ?? [])
        .map((option) => option.id)
        .filter(
          (optionId): optionId is string =>
            Boolean(optionId && !selectedSequenceOptionIds.includes(optionId))
        )
    : [];
  const sequenceGrcCourses = selectedSequenceOption
    ? unique(selectedSequenceOption.grcMatches ?? [])
    : [];
  if (
    requirementGroup === item.requirementGroup &&
    item.requirementShape === requirementShape &&
    (!isSequenceChoice ||
      ((item.selectedRequirementOptionIds ?? []).length === selectedSequenceOptionIds.length &&
        selectedSequenceOptionIds.every((optionId) =>
          (item.selectedRequirementOptionIds ?? []).includes(optionId)
        ) &&
        (item.unselectedRequirementOptionIds ?? []).length === unselectedSequenceOptionIds.length &&
        unselectedSequenceOptionIds.every((optionId) =>
          (item.unselectedRequirementOptionIds ?? []).includes(optionId)
        ) &&
        item.grcCourses.length === sequenceGrcCourses.length &&
        sequenceGrcCourses.every((courseCode) => item.grcCourses.includes(courseCode))))
  ) {
    return item;
  }
  return {
    ...item,
    requirementGroup,
    requirementShape,
    ...(isSequenceChoice
      ? {
          grcCourses: sequenceGrcCourses,
          selectedRequirementOptionIds: selectedSequenceOptionIds.length
            ? selectedSequenceOptionIds
            : undefined,
          unselectedRequirementOptionIds: unselectedSequenceOptionIds.length
            ? unselectedSequenceOptionIds
            : undefined,
          minCompletedCount: 1,
        }
      : {}),
  };
}

function normalizeRequirementShapesRuntimePlan<T extends TransferPlannerMajorPlan>(plan: T): T {
  const selectedPathwayId =
    "selectedPathwayId" in plan
      ? ((plan as unknown as { selectedPathwayId?: string | null }).selectedPathwayId ?? null)
      : undefined;
  const supportLists = uniqueBy(
    [
      ...(plan.supportLists ?? []),
      ...getRuntimeRequirementSupportListsForScope(plan.id, selectedPathwayId),
    ].map(normalizeRuntimeRequirementSupportList),
    (supportList) => supportList.id
  );
  return {
    ...plan,
    ...(supportLists.length ? { supportLists } : {}),
    requirementGroups: (plan.requirementGroups ?? []).map(normalizeRequirementShapeForGroup),
    applicationChecklist: (plan.applicationChecklist ?? []).map(normalizeRequirementShapeForChecklistItem),
    beforeEnrollmentChecklist: (plan.beforeEnrollmentChecklist ?? []).map(
      normalizeRequirementShapeForChecklistItem
    ),
    stayAtGrcChecklist: (plan.stayAtGrcChecklist ?? []).map(normalizeRequirementShapeForChecklistItem),
    pathways: (plan.pathways ?? []).map((pathway) => ({
      ...pathway,
      requirementGroups: (pathway.requirementGroups ?? []).map(normalizeRequirementShapeForGroup),
      applicationChecklist: (pathway.applicationChecklist ?? []).map(
        normalizeRequirementShapeForChecklistItem
      ),
      beforeEnrollmentChecklist: (pathway.beforeEnrollmentChecklist ?? []).map(
        normalizeRequirementShapeForChecklistItem
      ),
      stayAtGrcChecklist: (pathway.stayAtGrcChecklist ?? []).map(
        normalizeRequirementShapeForChecklistItem
      ),
      supportLists: uniqueBy(
        [
          ...(pathway.supportLists ?? []),
          ...getRuntimeRequirementSupportListsForScope(plan.id, pathway.id),
        ].map(normalizeRuntimeRequirementSupportList),
        (supportList) => supportList.id
      ),
    })),
  };
}

function getSharedRuntimeRequirementGroupSignature(group: TransferPlannerRequirementGroup) {
  const optionCourseSignature = (group.options ?? [])
    .map((option) => (option.uwCourses ?? []).map(normalizeTransferPlannerCourseCode).sort().join("+"))
    .filter(Boolean)
    .sort()
    .join("|");
  return [
    String(group.label ?? "").toLowerCase().replace(/\s+/g, " ").trim(),
    group.requirementType ?? "",
    group.requiredCount ?? "",
    group.minCredits ?? "",
    group.maxCredits ?? "",
    optionCourseSignature,
  ].join("::");
}

const RUNTIME_PATHWAY_SOURCE_TOKEN_STOPWORDS = new Set([
  "and",
  "arts",
  "b",
  "ba",
  "bachelor",
  "bs",
  "concentration",
  "degree",
  "family",
  "in",
  "major",
  "m",
  "master",
  "ms",
  "of",
  "option",
  "pathway",
  "requirements",
  "route",
  "s",
  "science",
  "the",
  "to",
  "track",
  "with",
]);

function getRuntimePathwaySourceTokens(value: string | null | undefined) {
  return unique(
    slugifyRuntimeId(String(value ?? ""))
      .split("-")
      .map((token) => token.trim())
      .filter(
        (token) =>
          token.length >= 3 &&
          !RUNTIME_PATHWAY_SOURCE_TOKEN_STOPWORDS.has(token)
      )
  );
}

function getRuntimePathwaySpecificTokens(
  plan: TransferPlannerMajorPlan,
  pathway: TransferPlannerMajorPathway
) {
  const planTokens = new Set(getRuntimePathwaySourceTokens(plan.title));
  return getRuntimePathwaySourceTokens(`${pathway.id} ${pathway.label}`).filter(
    (token) => !planTokens.has(token)
  );
}

function runtimePathwayPrimarySourceLooksPathwaySpecific(
  plan: TransferPlannerMajorPlan,
  pathway: TransferPlannerMajorPathway
) {
  const pathwayTokens = getRuntimePathwaySpecificTokens(plan, pathway);
  if (!pathwayTokens.length) {
    return false;
  }

  const primarySource = getRuntimePrimaryDegreeSourceByPathwayKey(
    getPlannerPathwayKey(plan.id, pathway.id)
  );
  const sourceTokens = new Set(
    getRuntimePathwaySourceTokens(`${primarySource?.label ?? ""} ${primarySource?.url ?? ""}`)
  );
  if (!sourceTokens.size) {
    return false;
  }

  const matchedCount = pathwayTokens.filter((token) => sourceTokens.has(token)).length;
  const requiredCount =
    pathwayTokens.length <= 2 ? pathwayTokens.length : Math.max(2, pathwayTokens.length - 1);
  return matchedCount >= requiredCount;
}

function stripRuntimePathwayScopeId(value: string | null | undefined, pathwayId: string | null) {
  if (!value || !pathwayId) {
    return value;
  }

  return value
    .split(`:pathway:${pathwayId}:`)
    .join(":")
    .split(`:pathway:${pathwayId}`)
    .join("");
}

function stripRuntimeRequirementGroupPathwayScope(
  group: TransferPlannerRequirementGroup
): TransferPlannerRequirementGroup {
  const scopedGroup = group as TransferPlannerRequirementGroup & {
    pathwayId?: string | null;
    routeId?: string | null;
  };
  const pathwayId = scopedGroup.pathwayId ?? scopedGroup.routeId ?? null;
  const { pathwayId: _pathwayId, routeId: _routeId, ...baseGroup } = scopedGroup;

  return {
    ...baseGroup,
    id: stripRuntimePathwayScopeId(baseGroup.id, pathwayId) ?? baseGroup.id,
    sequencePaths: (baseGroup.sequencePaths ?? []).map((sequencePath) => ({
      ...sequencePath,
      id: stripRuntimePathwayScopeId(sequencePath.id, pathwayId) ?? sequencePath.id,
    })),
    options: (baseGroup.options ?? []).map((option) => ({
      ...option,
      id: stripRuntimePathwayScopeId(option.id, pathwayId) ?? option.id,
      sequencePathId:
        stripRuntimePathwayScopeId(option.sequencePathId, pathwayId) ?? option.sequencePathId,
    })),
  };
}

function getSharedPathwayRuntimeRequirementGroups(plan: TransferPlannerMajorPlan) {
  const pathwaysWithGroups = getRuntimePathwaysForPlan(plan).filter(
    (pathway) => (pathway.requirementGroups ?? []).length > 0
  );
  if (pathwaysWithGroups.length < 2) {
    return [];
  }

  const signatureCounts = new Map<string, number>();
  for (const pathway of pathwaysWithGroups) {
    const pathwaySignatures = new Set(
      (pathway.requirementGroups ?? []).map(getSharedRuntimeRequirementGroupSignature)
    );
    for (const signature of pathwaySignatures) {
      signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
    }
  }

  const sharedSignatures = new Set(
    [...signatureCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([signature]) => signature)
  );
  if (!sharedSignatures.size) {
    return [];
  }

  const broadSourcePathways = pathwaysWithGroups.filter(
    (pathway) => !runtimePathwayPrimarySourceLooksPathwaySpecific(plan, pathway)
  );
  const broadSourceSharedGroups = uniqueBy(
    broadSourcePathways
      .flatMap((pathway) => pathway.requirementGroups ?? [])
      .filter((group) => sharedSignatures.has(getSharedRuntimeRequirementGroupSignature(group)))
      .map(stripRuntimeRequirementGroupPathwayScope),
    getSharedRuntimeRequirementGroupSignature
  );
  if (broadSourceSharedGroups.length) {
    return broadSourceSharedGroups;
  }

  const allPathwaySharedSignatures = new Set(
    [...signatureCounts.entries()]
      .filter(([, count]) => count === pathwaysWithGroups.length)
      .map(([signature]) => signature)
  );

  return uniqueBy(
    (pathwaysWithGroups[0].requirementGroups ?? [])
      .filter((group) =>
        allPathwaySharedSignatures.has(getSharedRuntimeRequirementGroupSignature(group))
      )
      .map(stripRuntimeRequirementGroupPathwayScope),
    getSharedRuntimeRequirementGroupSignature
  );
}

function promoteSharedPathwayRequirementGroupsToPlan<T extends TransferPlannerMajorPlan>(plan: T): T {
  if ((plan.requirementGroups ?? []).length > 0) {
    return plan;
  }

  const sharedRequirementGroups = getSharedPathwayRuntimeRequirementGroups(plan);
  if (!sharedRequirementGroups.length) {
    return plan;
  }

  return {
    ...plan,
    requirementGroups: sharedRequirementGroups,
  };
}

function normalizeStudentRuntimeMajorPlan<T extends TransferPlannerMajorPlan>(plan: T): T {
  return normalizeRequiredForDegreeEitherWayRuntimeChecklistNotes(
    normalizeRequirementShapesRuntimePlan(
      promoteSharedPathwayRequirementGroupsToPlan(
        normalizeCategoryOptionRuntimePlan(
          normalizeUwSeattleChemicalEngineeringRuntimePlan(
            normalizeUwSeattleBioengineeringRuntimePlan(
              normalizeUwSeattleComputerScienceRuntimePlan(plan)
            )
          )
        )
      )
    )
  );
}

function getParsedSourceBlockUrl(block: TransferPlannerRuntimeParsedRequirementSourceScopeBlock) {
  return String(block.sourceUrl ?? block.primarySourceUrl ?? "").trim();
}

function getRuntimePathwayIdFromOwnerId(
  planId: string | null | undefined,
  ownerId: string | null | undefined
) {
  const normalizedPlanId = String(planId ?? "").trim();
  const normalizedOwnerId = String(ownerId ?? "").trim();
  const pathwayMarker = ":pathway:";
  const pathwayMarkerIndex = normalizedOwnerId.indexOf(pathwayMarker);
  if (!normalizedPlanId || pathwayMarkerIndex < 0) {
    return null;
  }

  const ownerPlanId = normalizedOwnerId.slice(0, pathwayMarkerIndex);
  if (ownerPlanId !== normalizedPlanId) {
    return null;
  }

  const pathwayId = normalizedOwnerId.slice(pathwayMarkerIndex + pathwayMarker.length);
  return pathwayId ? normalizeTransferPlannerPathwayId(normalizedPlanId, pathwayId) : null;
}

function getRuntimeParsedBlockPathwayId(block: {
  planId?: string | null;
  pathwayId?: string | null;
  ownerId?: string | null;
}) {
  const normalizedPlanId = String(block.planId ?? "").trim();
  const explicitPathwayId =
    normalizedPlanId && block.pathwayId
      ? normalizeTransferPlannerPathwayId(normalizedPlanId, block.pathwayId)
      : null;
  return explicitPathwayId ?? getRuntimePathwayIdFromOwnerId(normalizedPlanId, block.ownerId);
}

function getRuntimeStoredParsedBlockPathwayId(block: {
  planId?: string | null;
  pathwayId?: string | null;
  ownerId?: string | null;
}) {
  const explicitPathwayId = String(block.pathwayId ?? "").trim();
  return explicitPathwayId || getRuntimePathwayIdFromOwnerId(block.planId, block.ownerId);
}

function selectedPathwayOwnsIndependentRuntimeSource(
  planId: string,
  selectedPathwayId: string | null | undefined
) {
  if (!selectedPathwayId) {
    return false;
  }

  const normalizedSelectedPathwayId = normalizeTransferPlannerPathwayId(
    planId,
    selectedPathwayId
  );
  const baseSourceUrls = new Set(
    getTransferPlannerParsedRequirementSourceBlocks(planId, null)
      .map(getParsedSourceBlockUrl)
      .filter(Boolean)
  );
  const selectedBlocks = getTransferPlannerParsedRequirementSourceBlocks(
    planId,
    selectedPathwayId
  ).filter(
    (block) =>
      normalizeTransferPlannerPathwayId(planId, block.pathwayId) === normalizedSelectedPathwayId
  );

  return selectedBlocks.some((block) => {
    const parsedCodes = block.parsedUwCourseCodes ?? [];
    const blockUrl = getParsedSourceBlockUrl(block);
    const hasDistinctPathwaySource =
      blockUrl && !baseSourceUrls.has(blockUrl) && parsedCodes.length >= 3;
    const hasCatalogCredentialGroups =
      block.sourceRole === "official-catalog" &&
      (normalizeTransferPlannerPathwayId(planId, block.pathwayId) ===
        normalizedSelectedPathwayId ||
        (block.parsedRequirementGroups ?? []).some(
          (group) =>
            normalizeTransferPlannerPathwayId(planId, group.pathwayId) ===
            normalizedSelectedPathwayId
        ));

    return hasDistinctPathwaySource || hasCatalogCredentialGroups;
  });
}

function replaceRuntimePathwayScopeId(
  value: string | null | undefined,
  fromPathwayId: string,
  toPathwayId: string
) {
  if (!value || !fromPathwayId || fromPathwayId === toPathwayId) {
    return value;
  }

  return value.split(`:pathway:${fromPathwayId}:`).join(`:pathway:${toPathwayId}:`);
}

function remapRuntimeRequirementGroupToSelectedPathway(
  planId: string,
  selectedPathwayId: string,
  group: TransferPlannerRequirementGroup
) {
  const groupPathwayId = group.pathwayId ?? null;
  const normalizedGroupPathwayId = normalizeTransferPlannerPathwayId(planId, groupPathwayId);
  const normalizedSelectedPathwayId = normalizeTransferPlannerPathwayId(planId, selectedPathwayId);
  if (
    !groupPathwayId ||
    !normalizedGroupPathwayId ||
    normalizedGroupPathwayId !== normalizedSelectedPathwayId
  ) {
    return group;
  }

  return {
    ...group,
    id: replaceRuntimePathwayScopeId(group.id, groupPathwayId, selectedPathwayId) ?? group.id,
    pathwayId: selectedPathwayId,
    routeId:
      group.routeId &&
      normalizeTransferPlannerPathwayId(planId, group.routeId) === normalizedSelectedPathwayId
        ? selectedPathwayId
        : group.routeId,
    sequencePaths: (group.sequencePaths ?? []).map((sequencePath) => ({
      ...sequencePath,
      id: replaceRuntimePathwayScopeId(sequencePath.id, groupPathwayId, selectedPathwayId) ??
        sequencePath.id,
    })),
    options: (group.options ?? []).map((option) => ({
      ...option,
      id: replaceRuntimePathwayScopeId(option.id, groupPathwayId, selectedPathwayId) ?? option.id,
      sequencePathId:
        replaceRuntimePathwayScopeId(option.sequencePathId, groupPathwayId, selectedPathwayId) ??
        option.sequencePathId,
    })),
  } satisfies TransferPlannerRequirementGroup;
}

function scopeIndependentRuntimePathwayContent<T extends TransferPlannerResolvedMajorPlan>(
  plan: T
): T {
  const selectedPathwayId = plan.selectedPathwayId ?? null;
  if (
    !selectedPathwayId ||
    !selectedPathwayOwnsIndependentRuntimeSource(plan.id, selectedPathwayId)
  ) {
    return plan;
  }

  return {
    ...plan,
    degreeMapSections: (plan.degreeMapSections ?? []).filter((section) =>
      section.id.includes("-pathway-")
    ),
    requirementGroups: (plan.requirementGroups ?? [])
      .filter(
        (group) => {
          const normalizedGroupPathwayId = normalizeTransferPlannerPathwayId(plan.id, group.pathwayId);
          const shouldKeepBaseGroup =
            !normalizedGroupPathwayId &&
            hasAdditiveBaseRequirementGroupForRequestedPathway(
              plan.requirementGroups,
              selectedPathwayId
            );
          return (
            shouldKeepBaseGroup ||
            normalizedGroupPathwayId === normalizeTransferPlannerPathwayId(plan.id, selectedPathwayId)
          );
        }
      )
      .map((group) =>
        remapRuntimeRequirementGroupToSelectedPathway(plan.id, selectedPathwayId, group)
      ),
  };
}

function normalizeStudentRuntimeResolvedMajorPlan<T extends TransferPlannerResolvedMajorPlan>(
  plan: T
): T {
  return scopeIndependentRuntimePathwayContent(
    normalizeRequiredForDegreeEitherWayRuntimeChecklistNotes(
      normalizeRequirementShapesRuntimePlan(
        normalizeCategoryOptionRuntimePlan(
          normalizeUwSeattleChemicalEngineeringRuntimePlan(
            normalizeUwSeattleBioengineeringRuntimePlan(
              normalizeUwSeattleCivilRuntimePlan(
                normalizeUwSeattleMechanicalRuntimePlan(
                  normalizeUwSeattleEceRuntimePlan(
                    normalizeUwSeattleComputerScienceRuntimePlan(plan)
                  )
                )
              )
            )
          )
        )
      )
    )
  );
}

export function normalizeTransferPlannerCourseCode(value: string) {
  const normalized = String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^([A-Z&]+(?: [A-Z&]+)*) (\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (!match) {
    return normalized;
  }

  let subjectTokens = match[1].split(" ").filter(Boolean);
  while (
    subjectTokens.length > 1 &&
    RECOVERABLE_LEADING_SUBJECT_TOKENS.has(subjectTokens[0])
  ) {
    const candidateTokens = subjectTokens.slice(1);
    const candidateSpacedSubject = candidateTokens.join(" ");
    const candidateCollapsedSubject = candidateTokens.join("");
    if (
      getKnownTransferPlannerSubjectCodes().has(candidateSpacedSubject) ||
      getKnownTransferPlannerSubjectCodes().has(candidateCollapsedSubject)
    ) {
      subjectTokens = candidateTokens;
      continue;
    }
    break;
  }

  const spacedSubject = subjectTokens.join(" ");
  const explicitAlias = EXPLICIT_SPACED_SUBJECT_ALIASES.get(spacedSubject);
  if (explicitAlias) {
    return `${explicitAlias} ${match[2]}`;
  }

  const collapsedSubject = subjectTokens.join("");
  const normalizedSubject =
    subjectTokens.every((token) => token.length === 1) ||
    (subjectTokens.length > 1 &&
      getKnownTransferPlannerSubjectCodes().has(collapsedSubject) &&
      !getKnownTransferPlannerSubjectCodes().has(spacedSubject))
      ? collapsedSubject
      : spacedSubject;

  return `${normalizedSubject} ${match[2]}`;
}

function normalizeCourseCode(value: string | null | undefined) {
  return normalizeTransferPlannerCourseCode(String(value ?? ""));
}

function normalizeRuntimeSupportListCourseCodes(values: unknown) {
  return unique(
    (Array.isArray(values) ? values : [])
      .map((courseCode) => normalizeCourseCode(String(courseCode ?? "")))
      .filter(Boolean)
  );
}

function getRuntimeSupportListContext(block: {
  planId?: string | null;
  ownerId?: string | null;
  ownerTitle?: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  primarySourceUrl?: string | null;
  primarySourceLabel?: string | null;
}) {
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

function inferRuntimeApprovedListKey(block: {
  planId?: string | null;
  ownerId?: string | null;
  ownerTitle?: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  primarySourceUrl?: string | null;
  primarySourceLabel?: string | null;
}) {
  const context = getRuntimeSupportListContext(block);
  if (
    (block.planId === "uw-seattle-computer-engineering" ||
      /\bcomputer engineering\b/.test(context)) &&
    /\b(?:natural science|science)\b/.test(context)
  ) {
    return "computer-engineering-natural-science";
  }
  if (
    (block.planId === "uw-seattle-computer-science" ||
      /\b(?:computer science|allen school|data science)\b/.test(context)) &&
    /\b(?:natural science|science)\b/.test(context)
  ) {
    return "computer-science-approved-science";
  }
  if (/\bapproved\b/.test(context) && /\belectives?\b/.test(context)) {
    return `${slugifyRuntimeId(String(block.planId ?? block.ownerId ?? "unknown-owner"))}-approved-electives`;
  }
  return null;
}

function buildRuntimeRequirementSupportList(input: {
  block: {
    id?: string | null;
    ownerId?: string | null;
    planId?: string | null;
    pathwayId?: string | null;
    sourceUrl?: string | null;
    sourceRole?: string | null;
    sourceLabel?: string | null;
    primarySourceUrl?: string | null;
    primarySourceLabel?: string | null;
  };
  shape: TransferPlannerRequirementSupportList["shape"];
  acceptedUwCourseCodes: string[];
  approvedListKey?: string | null;
}) {
  const sourceUrl = input.block.sourceUrl ?? input.block.primarySourceUrl ?? null;
  const listTitle =
    input.block.sourceLabel ??
    input.block.primarySourceLabel ??
    (input.shape === "elective-list" ? "Elective list" : "Approved course list");
  const filterDefinition = getTransferPlannerProgramApprovedCourseFilterDefinition(
    input.approvedListKey
  );
  return {
    id: `${input.block.id ?? slugifyRuntimeId(`${sourceUrl ?? listTitle}`)}:support-list:${input.shape}`,
    shape: input.shape,
    sourceUrl,
    sourceRole: input.block.sourceRole ?? null,
    listTitle,
    filterKey: filterDefinition?.filterKey ?? input.approvedListKey ?? null,
    ownerId: input.block.ownerId ?? input.block.planId ?? null,
    majorId: input.block.planId ?? null,
    pathwayId: input.block.pathwayId ?? null,
    officialSourceUrl: filterDefinition?.officialSourceUrl ?? sourceUrl,
    acceptedUwCourseCodes: filterDefinition
      ? normalizeRuntimeSupportListCourseCodes(filterDefinition.approvedUwCourseCodes)
      : input.acceptedUwCourseCodes,
    approvedUwCourseGroups: filterDefinition?.approvedUwCourseGroups?.map((group) =>
      normalizeRuntimeSupportListCourseCodes(group)
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
    ...(input.approvedListKey ? { approvedListKey: input.approvedListKey } : {}),
    supportOnly: true,
    canCreateRequiredRow: false,
    canCreateScheduleRow: false,
    linkedPrimaryRequirementIds: [],
  } satisfies TransferPlannerRequirementSupportList;
}

function buildRuntimeRequirementSupportLists(block: {
  id?: string | null;
  planId?: string | null;
  ownerId?: string | null;
  ownerTitle?: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  primarySourceUrl?: string | null;
  primarySourceLabel?: string | null;
  sourceRole?: string | null;
  approvedFilterUwCourseCodes?: string[];
  electiveListUwCourseCodes?: string[];
  supportOnlyUwCourseCodes?: string[];
}) {
  const lists: TransferPlannerRequirementSupportList[] = [];
  const approvedCodes = normalizeRuntimeSupportListCourseCodes(
    block.approvedFilterUwCourseCodes
  );
  const electiveCodes = normalizeRuntimeSupportListCourseCodes(block.electiveListUwCourseCodes);
  const supportOnlyCodes = normalizeRuntimeSupportListCourseCodes(
    block.supportOnlyUwCourseCodes
  );
  const usedCodes = new Set([...approvedCodes, ...electiveCodes]);
  const remainingSupportOnlyCodes = supportOnlyCodes.filter((courseCode) => !usedCodes.has(courseCode));
  const approvedListKey = inferRuntimeApprovedListKey(block);
  const approvedFilterDefinition = getTransferPlannerProgramApprovedCourseFilterDefinition(
    approvedListKey
  );

  if (approvedCodes.length || (approvedFilterDefinition && block.sourceRole === "approved-course-list")) {
    lists.push(
      buildRuntimeRequirementSupportList({
        block,
        shape: "approved-filter-list",
        acceptedUwCourseCodes: approvedCodes,
        approvedListKey,
      })
    );
  }

  if (electiveCodes.length) {
    lists.push(
      buildRuntimeRequirementSupportList({
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
      lists.push(
        buildRuntimeRequirementSupportList({
          block,
          shape,
          acceptedUwCourseCodes: remainingSupportOnlyCodes,
          approvedListKey: shape === "approved-course-list" ? approvedListKey : null,
        })
      );
    }
  }

  return lists;
}

function normalizeRuntimeRequirementSupportList(
  supportList: TransferPlannerRequirementSupportList
): TransferPlannerRequirementSupportList {
  const filterDefinition = getTransferPlannerProgramApprovedCourseFilterDefinition(
    supportList.approvedListKey ?? supportList.filterKey
  );
  return {
    ...supportList,
    filterKey: filterDefinition?.filterKey ?? supportList.filterKey ?? supportList.approvedListKey ?? null,
    officialSourceUrl:
      filterDefinition?.officialSourceUrl ?? supportList.officialSourceUrl ?? supportList.sourceUrl,
    acceptedUwCourseCodes: normalizeRuntimeSupportListCourseCodes(
      filterDefinition?.approvedUwCourseCodes ?? supportList.acceptedUwCourseCodes
    ),
    approvedUwCourseGroups:
      filterDefinition?.approvedUwCourseGroups?.map((group) =>
        normalizeRuntimeSupportListCourseCodes(group)
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
    supportOnly: true,
    canCreateRequiredRow: false,
    canCreateScheduleRow: false,
    linkedPrimaryRequirementIds: supportList.linkedPrimaryRequirementIds ?? [],
  };
}

function getRuntimeApprovedFilterCodesFromSupportLists(
  supportLists: TransferPlannerRequirementSupportList[]
) {
  return normalizeRuntimeSupportListCourseCodes(
    supportLists
      .filter((supportList) => supportList.shape === "approved-filter-list")
      .flatMap((supportList) => supportList.acceptedUwCourseCodes ?? [])
  );
}

function runtimeStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function normalizeRuntimeParsedRequirementSourceBlock<
  T extends {
    planId?: string | null;
    pathwayId?: string | null;
    ownerId?: string | null;
    supportLists?: TransferPlannerRequirementSupportList[];
    approvedFilterUwCourseCodes?: string[];
    electiveListUwCourseCodes?: string[];
    supportOnlyUwCourseCodes?: string[];
    parsedRequirementGroups?: TransferPlannerRequirementGroup[];
  }
>(block: T) {
  const supportLists = uniqueRuntimeRequirementSupportLists(
    (
      block.supportLists?.length
        ? block.supportLists
        : buildRuntimeRequirementSupportLists(block)
    ).map(normalizeRuntimeRequirementSupportList)
  );
  const approvedFilterUwCourseCodes = normalizeRuntimeSupportListCourseCodes([
    ...(block.approvedFilterUwCourseCodes ?? []),
    ...getRuntimeApprovedFilterCodesFromSupportLists(supportLists),
  ]);
  const approvedFilterCodesChanged = !runtimeStringArraysEqual(
    approvedFilterUwCourseCodes,
    normalizeRuntimeSupportListCourseCodes(block.approvedFilterUwCourseCodes)
  );
  const parsedRequirementGroups = (block.parsedRequirementGroups ?? []).map(
    normalizeRequirementShapeForGroup
  );
  const parsedGroupsChanged = parsedRequirementGroups.some(
    (group, index) => group !== block.parsedRequirementGroups?.[index]
  );
  const pathwayId = getRuntimeStoredParsedBlockPathwayId(block);
  const pathwayIdChanged = pathwayId !== (block.pathwayId ?? null);

  if (
    !supportLists.length &&
    !approvedFilterCodesChanged &&
    !parsedGroupsChanged &&
    !pathwayIdChanged
  ) {
    return block;
  }

  return {
    ...block,
    ...(pathwayIdChanged ? { pathwayId } : {}),
    ...(approvedFilterUwCourseCodes.length ? { approvedFilterUwCourseCodes } : {}),
    ...(supportLists.length ? { supportLists } : {}),
    ...(parsedGroupsChanged ? { parsedRequirementGroups } : {}),
  };
}

function getRuntimeRequirementSupportListsForScope(
  planId: string,
  pathwayId?: string | null
) {
  return uniqueRuntimeRequirementSupportLists(
    getTransferPlannerParsedRequirementSourceBlocks(planId, pathwayId).flatMap(
      (block) => block.supportLists ?? []
    )
  );
}

function normalizeExtractedCourseSubject(rawSubject: string | null | undefined) {
  let subjectTokens = String(rawSubject ?? "")
    .toUpperCase()
    .replace(/[^A-Z&]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  while (
    subjectTokens.length > 1 &&
    RECOVERABLE_LEADING_SUBJECT_TOKENS.has(subjectTokens[0])
  ) {
    subjectTokens = subjectTokens.slice(1);
  }

  const subject = subjectTokens.join(" ");
  const collapsedSubject = subjectTokens.join("");
  if (
    subjectTokens.length > 1 &&
    getKnownTransferPlannerSubjectCodes().has(collapsedSubject) &&
    !getKnownTransferPlannerSubjectCodes().has(subject)
  ) {
    return collapsedSubject;
  }

  if (
    !subjectTokens.length ||
    subjectTokens.length > 2 ||
    (subjectTokens.length === 1 && subjectTokens[0].length < 2) ||
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
  if (!subject || !/^\d{3}(?:\.\d+)?[A-Z]?$/.test(number)) {
    return null;
  }
  return normalizeCourseCode(`${subject} ${number}`);
}

export function extractTransferPlannerCourseCodes(value: string) {
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
        ? explicitMatches[index + 1]?.match.index ?? normalizedValue.length
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

export const TRANSFER_PLANNER_CAMPUSES: TransferPlannerCampus[] =
  TRANSFER_PLANNER_RUNTIME_CAMPUSES;
export const TRANSFER_PLANNER_TRACKS: TransferPlannerTrack[] = TRANSFER_PLANNER_RUNTIME_TRACKS;
export const TRANSFER_PLANNER_GAP_REGISTRY =
  TRANSFER_PLANNER_RUNTIME_GAP_REGISTRY as TransferPlannerRuntimeSourceGapEntry[];

let tracksById: Map<string, TransferPlannerTrack> | null = null;

function getTracksById() {
  if (tracksById) {
    return tracksById;
  }

  tracksById = new Map(TRANSFER_PLANNER_TRACKS.map((track) => [track.id, track]));
  return tracksById;
}

function hasRequiredForDegreeEitherWayNote(value: string | null | undefined) {
  return REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE_PATTERN.test(String(value ?? "").trim());
}

function normalizeRuntimeNoteWithRequiredForDegreeEitherWay(
  existingNote: string | null | undefined,
  shouldIncludeRequiredForDegreeNote: boolean
) {
  const normalizedNote = String(existingNote ?? "").replace(/\s+/g, " ").trim();
  if (!shouldIncludeRequiredForDegreeNote) {
    return normalizedNote || undefined;
  }

  if (!normalizedNote) {
    return REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE;
  }

  if (hasRequiredForDegreeEitherWayNote(normalizedNote)) {
    return normalizedNote.toLowerCase().startsWith("not part of the minimum transfer-admission")
      ? REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE
      : normalizedNote;
  }

  return `${normalizedNote} ${REQUIRED_FOR_DEGREE_EITHER_WAY_NOTE}`;
}

function getRequiredForDegreeSourceChecklistItemKeys(item: TransferPlannerChecklistItem) {
  const keys: string[] = [`id:${item.id}`];
  const mappedCourseCodes = getRuntimeChecklistItemMappedCourseCodes(item);
  if (mappedCourseCodes.length) {
    const sortedCourseCodes = [...mappedCourseCodes].sort();
    keys.push(`courses:${sortedCourseCodes.join("|")}`);
    keys.push(...sortedCourseCodes.map((courseCode) => `course:${courseCode}`));
  }

  const normalizedTitle = String(item.title ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (normalizedTitle) {
    keys.push(`title:${normalizedTitle}`);
  }

  return keys;
}

function buildRequiredForDegreeConfiguredChecklistItemKeys(
  configuredCourseCodes: string[] | undefined
) {
  return new Set(
    (configuredCourseCodes ?? [])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(Boolean)
      .map((courseCode) => `course:${courseCode}`)
  );
}

function buildRequiredForDegreeSourceChecklistItemKeys(
  sourceItems: TransferPlannerChecklistItem[] | undefined,
  configuredCourseCodes: string[] | undefined
) {
  const keys = buildRequiredForDegreeConfiguredChecklistItemKeys(configuredCourseCodes);

  for (const item of sourceItems ?? []) {
    if (!hasRequiredForDegreeEitherWayNote(item.note)) {
      continue;
    }

    for (const itemKey of getRequiredForDegreeSourceChecklistItemKeys(item)) {
      keys.add(itemKey);
    }
  }

  return keys;
}

function normalizeRequiredForDegreeEitherWayChecklistItems(
  runtimeItems: TransferPlannerChecklistItem[] | undefined,
  sourceItems: TransferPlannerChecklistItem[] | undefined,
  configuredCourseCodes: string[] | undefined
) {
  const sourceItemKeys = buildRequiredForDegreeSourceChecklistItemKeys(
    sourceItems,
    configuredCourseCodes
  );

  return (runtimeItems ?? []).map((item) => {
    const itemKeys = getRequiredForDegreeSourceChecklistItemKeys(item);
    const shouldIncludeRequiredForDegreeNote =
      hasRequiredForDegreeEitherWayNote(item.note) ||
      itemKeys.some((itemKey) => sourceItemKeys.has(itemKey));
    const note = normalizeRuntimeNoteWithRequiredForDegreeEitherWay(
      item.note,
      shouldIncludeRequiredForDegreeNote
    );

    return note === item.note
      ? item
      : {
          ...item,
          note,
        };
  });
}

function normalizeRequiredForDegreeEitherWayRuntimeChecklistNotes<T extends TransferPlannerMajorPlan>(
  plan: T
): T {
  const sourcePlan = getSourceMajorPlanById(plan.id);
  const configuredCourses = REQUIRED_FOR_DEGREE_EITHER_WAY_GRC_COURSES_BY_PLAN_ID[plan.id] ?? {};
  const applicationChecklist = normalizeRequiredForDegreeEitherWayChecklistItems(
    plan.applicationChecklist,
    sourcePlan?.applicationChecklist,
    configuredCourses.applicationChecklist
  );
  const beforeEnrollmentChecklist = normalizeRequiredForDegreeEitherWayChecklistItems(
    plan.beforeEnrollmentChecklist,
    sourcePlan?.beforeEnrollmentChecklist,
    configuredCourses.beforeEnrollmentChecklist
  );
  const stayAtGrcChecklist = normalizeRequiredForDegreeEitherWayChecklistItems(
    plan.stayAtGrcChecklist,
    sourcePlan?.stayAtGrcChecklist,
    configuredCourses.stayAtGrcChecklist
  );

  return {
    ...plan,
    applicationChecklist,
    beforeEnrollmentChecklist,
    stayAtGrcChecklist,
    pathways: (plan.pathways ?? []).map((pathway) => {
      const sourcePathway = getRuntimePathwaysForPlan(sourcePlan).find(
        (candidate) =>
          normalizeTransferPlannerPathwayId(plan.id, candidate.id) ===
          normalizeTransferPlannerPathwayId(plan.id, pathway.id)
      );

      return {
        ...pathway,
        applicationChecklist: normalizeRequiredForDegreeEitherWayChecklistItems(
          pathway.applicationChecklist,
          sourcePathway?.applicationChecklist,
          configuredCourses.applicationChecklist
        ),
        beforeEnrollmentChecklist: normalizeRequiredForDegreeEitherWayChecklistItems(
          pathway.beforeEnrollmentChecklist,
          sourcePathway?.beforeEnrollmentChecklist,
          configuredCourses.beforeEnrollmentChecklist
        ),
        stayAtGrcChecklist: normalizeRequiredForDegreeEitherWayChecklistItems(
          pathway.stayAtGrcChecklist,
          sourcePathway?.stayAtGrcChecklist,
          configuredCourses.stayAtGrcChecklist
        ),
      };
    }),
  };
}

export function isTransferPlannerRequiredForDegreeEitherWayGrcCourse(
  planId: string | null | undefined,
  courseCode: string | null | undefined,
  bucket?: RuntimeChecklistBucketKey
) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  if (!planId || !normalizedCourseCode) {
    return false;
  }

  const configuredCourses = REQUIRED_FOR_DEGREE_EITHER_WAY_GRC_COURSES_BY_PLAN_ID[planId];
  if (!configuredCourses) {
    return false;
  }

  const bucketKeys: RuntimeChecklistBucketKey[] = bucket
    ? [bucket]
    : ["applicationChecklist", "beforeEnrollmentChecklist", "stayAtGrcChecklist"];
  return bucketKeys.some((bucketKey) =>
    (configuredCourses[bucketKey] ?? []).some(
      (configuredCourseCode) => normalizeCourseCode(configuredCourseCode) === normalizedCourseCode
    )
  );
}

type StudentRuntimeAliasChildPathway = {
  parentPlanId: string;
  childPlan: TransferPlannerMajorPlan;
  pathway: TransferPlannerMajorPathway;
};

type StudentRuntimeAliasChildPathwayMaps = {
  byParentId: Map<string, StudentRuntimeAliasChildPathway[]>;
  byKey: Map<string, StudentRuntimeAliasChildPathway>;
};

const STUDENT_RUNTIME_HIDDEN_ALIAS_PLAN_IDS_BY_CAMPUS_ID = new Map<
  TransferPlannerCampusId,
  Set<string>
>();
let STUDENT_RUNTIME_ALIAS_CHILD_PATHWAYS_BY_PARENT_ID:
  | Map<string, StudentRuntimeAliasChildPathway[]>
  | null = null;
let STUDENT_RUNTIME_ALIAS_CHILD_PATHWAYS_BY_KEY:
  | Map<string, StudentRuntimeAliasChildPathway>
  | null = null;
const STUDENT_RUNTIME_ALIAS_CHILD_PATHWAY_MAPS_BY_CAMPUS_ID = new Map<
  TransferPlannerCampusId,
  StudentRuntimeAliasChildPathwayMaps
>();
const STUDENT_RUNTIME_MAJORS_BY_CAMPUS_ID = new Map<
  TransferPlannerCampusId,
  TransferPlannerMajorPlan[]
>();
const RESOLVED_STUDENT_RUNTIME_PLANS_BY_KEY = new Map<
  string,
  TransferPlannerResolvedMajorPlan
>();
let compactCoursesByKey:
  | Map<string, TransferPlannerRuntimeCompactCourseRegistryEntry>
  | null = null;

function getCompactCoursesByKey() {
  if (compactCoursesByKey) {
    return compactCoursesByKey;
  }

  compactCoursesByKey = new Map(
    TRANSFER_PLANNER_RUNTIME_COMPACT_COURSE_REGISTRY.map((entry) => [
      `${entry.schoolId}|${normalizeCourseCode(entry.code)}`,
      entry,
    ])
  );
  return compactCoursesByKey;
}
const EQUIVALENT_GRC_COURSE_CODES_BY_CODE = new Map<string, string[]>();

for (const courseSet of GRC_EQUIVALENT_COURSE_CODE_SETS) {
  const normalizedCourseSet = courseSet.map((code) => normalizeCourseCode(code)).filter(Boolean);
  for (const code of normalizedCourseSet) {
    EQUIVALENT_GRC_COURSE_CODES_BY_CODE.set(
      code,
      normalizedCourseSet.filter((candidateCode) => candidateCode !== code)
    );
  }
}

function getEquivalentCourseCodes(schoolId: TransferPlannerSourceSchoolId, code: string) {
  const normalizedCode = normalizeCourseCode(code);
  if (!normalizedCode) return [] as string[];
  const equivalentCourseCodes =
    schoolId === "grc" ? EQUIVALENT_GRC_COURSE_CODES_BY_CODE.get(normalizedCode) ?? [] : [];
  return unique([normalizedCode, ...equivalentCourseCodes].filter(Boolean));
}

function getStudentRuntimeAliasTitleParts(plan: TransferPlannerMajorPlan) {
  for (const title of [plan.title, plan.shortTitle]) {
    const match = String(title ?? "").match(/^(.+?):\s*(.+?)(?:\s+\(([^)]+)\))?$/);
    if (match?.[1] && match[2]) {
      return {
        parentTitle: match[1],
        optionTitle: match[2],
        degreeLabel: match[3] ?? null,
      };
    }
  }
  return null;
}

function getStudentRuntimeAliasParentPlan(plan: TransferPlannerMajorPlan) {
  const aliasTitleParts = getStudentRuntimeAliasTitleParts(plan);
  if (!aliasTitleParts) return null;

  const normalizedParentTitle = normalizeStudentRuntimeAliasText(aliasTitleParts.parentTitle);
  const parentPlanCandidates = getRuntimeMajorPlansForCampus(plan.campusId).filter(
    (candidatePlan) =>
      candidatePlan.id !== plan.id &&
      [candidatePlan.title, candidatePlan.shortTitle].some(
        (candidateTitle) => normalizeStudentRuntimeAliasText(candidateTitle) === normalizedParentTitle
      )
  );
  const parentPlan = parentPlanCandidates
    .map((candidatePlan) => {
      const parentPathways = getRuntimePathwaysForPlan(candidatePlan);
      const matchingContentBackedPathway = parentPathways.find(
        (pathway) =>
          doesPathwayMatchAliasOption(pathway, aliasTitleParts.optionTitle) &&
          isContentBackedParentPathway(candidatePlan, pathway)
      );
      const degreeMatch = doesStudentRuntimeAliasDegreeMatch(
        candidatePlan,
        aliasTitleParts.degreeLabel
      );
      return {
        candidatePlan,
        score:
          (matchingContentBackedPathway ? 1000 : 0) +
          (degreeMatch ? 100 : 0) +
          (hasStudentRuntimePlannerContent(candidatePlan) ? 10 : 0),
      };
    })
    .sort((left, right) => right.score - left.score)[0]?.candidatePlan ?? null;
  return parentPlan ? { aliasTitleParts, parentPlan } : null;
}

function normalizeStudentRuntimeAliasText(value: string) {
  return slugifyRuntimeId(
    value
      .replace(/&/g, " and ")
      .replace(/\([^)]*\)/g, " ")
  );
}

function normalizeStudentRuntimeAliasDegreeLabel(value: string | null | undefined) {
  return slugifyRuntimeId(
    String(value ?? "")
      .replace(/\./g, "")
      .replace(/\bdegree\b/gi, " ")
  );
}

function getStudentRuntimeAliasDegreeLabels(value: string | null | undefined) {
  const labels: string[] = [];
  for (const match of String(value ?? "").matchAll(/\(([^)]+)\)/g)) {
    const normalized = normalizeStudentRuntimeAliasDegreeLabel(match[1]);
    if (normalized) {
      labels.push(normalized);
    }
  }
  return labels;
}

function doesStudentRuntimeAliasDegreeMatch(
  parentPlan: TransferPlannerMajorPlan,
  degreeLabel: string | null | undefined
) {
  const normalizedDegreeLabel = normalizeStudentRuntimeAliasDegreeLabel(degreeLabel);
  if (!normalizedDegreeLabel) return false;
  return [parentPlan.title, parentPlan.shortTitle].some((title) =>
    getStudentRuntimeAliasDegreeLabels(title).includes(normalizedDegreeLabel)
  );
}

function getStudentRuntimeAliasTokens(value: string) {
  const ignoredTokens = new Set([
    "a",
    "and",
    "ba",
    "baba",
    "bs",
    "concentration",
    "degree",
    "family",
    "in",
    "major",
    "of",
    "option",
    "route",
    "the",
    "track",
    "with",
  ]);
  return normalizeStudentRuntimeAliasText(value)
    .split("-")
    .filter((token) => token && !ignoredTokens.has(token));
}

function getStudentRuntimePathwaySpecificityScore(pathway: TransferPlannerMajorPathway) {
  const idTokenCount = getStudentRuntimeAliasTokens(pathway.id).length;
  const labelTokenCount = getStudentRuntimeAliasTokens(pathway.label).length;
  const contentScore =
    (pathway.beforeEnrollmentChecklist?.length ?? 0) +
    (pathway.applicationChecklist?.length ?? 0) +
    (pathway.stayAtGrcChecklist?.length ?? 0) +
    (pathway.requirementGroups?.length ?? 0) +
    (pathway.degreeMapSections ?? []).filter((section) => (section.items ?? []).length > 0)
      .length;

  return idTokenCount * 16 + labelTokenCount * 2 + Math.min(contentScore, 12);
}

function preferStudentRuntimePathway(
  left: TransferPlannerMajorPathway,
  right: TransferPlannerMajorPathway
) {
  const scoreDelta =
    getStudentRuntimePathwaySpecificityScore(right) -
    getStudentRuntimePathwaySpecificityScore(left);
  if (scoreDelta !== 0) {
    return scoreDelta > 0 ? right : left;
  }

  if (right.id.length !== left.id.length) {
    return right.id.length > left.id.length ? right : left;
  }

  return left;
}

function uniqueStudentRuntimePathwaysByNormalizedId(
  planId: string,
  pathways: TransferPlannerMajorPathway[]
) {
  const pathwaysByKey = new Map<string, TransferPlannerMajorPathway>();
  const orderedKeys: string[] = [];

  for (const pathway of pathways) {
    const key = normalizeTransferPlannerPathwayId(planId, pathway.id) ?? pathway.id;
    const existing = pathwaysByKey.get(key) ?? null;
    if (!existing) {
      orderedKeys.push(key);
      pathwaysByKey.set(key, pathway);
      continue;
    }

    pathwaysByKey.set(key, preferStudentRuntimePathway(existing, pathway));
  }

  return orderedKeys.map((key) => pathwaysByKey.get(key)!);
}

function scoreStudentRuntimePathwayRequestMatch(
  requestedPathwayId: string | null | undefined,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">
) {
  const requestedTokens = getStudentRuntimeAliasTokens(String(requestedPathwayId ?? ""));
  if (!requestedTokens.length) {
    return 0;
  }

  const pathwayTokens = new Set(getStudentRuntimeAliasTokens(`${pathway.id} ${pathway.label}`));
  const matchedCount = requestedTokens.filter((token) => pathwayTokens.has(token)).length;
  const allTokensMatch = matchedCount === requestedTokens.length;
  const exactIdMatch = pathway.id === requestedPathwayId;

  return matchedCount * 16 + (allTokensMatch ? 32 : 0) + (exactIdMatch ? 64 : 0);
}

function pickStudentRuntimePathwayForRequest(
  planId: string,
  pathways: TransferPlannerMajorPathway[],
  requestedPathwayId: string | null | undefined,
  normalizedRequestedPathwayId: string | null
) {
  if (!normalizedRequestedPathwayId) {
    return null;
  }

  const candidates = pathways.filter(
    (pathway) =>
      pathway.id === requestedPathwayId ||
      normalizeTransferPlannerPathwayId(planId, pathway.id) === normalizedRequestedPathwayId
  );
  if (!candidates.length) {
    return null;
  }

  return candidates
    .map((pathway) => ({
      pathway,
      score:
        scoreStudentRuntimePathwayRequestMatch(requestedPathwayId, pathway) +
        getStudentRuntimePathwaySpecificityScore(pathway),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.pathway.id.length !== left.pathway.id.length) {
        return right.pathway.id.length - left.pathway.id.length;
      }
      return left.pathway.id.localeCompare(right.pathway.id);
    })[0]?.pathway ?? null;
}

function getRuntimeParsedBlockStoredPathwayText(block: {
  pathwayId?: string | null;
  ownerId?: string | null;
}) {
  const explicitPathwayId = String(block.pathwayId ?? "").trim();
  if (explicitPathwayId) {
    return explicitPathwayId;
  }

  const ownerId = String(block.ownerId ?? "");
  const pathwayMarker = ":pathway:";
  const pathwayMarkerIndex = ownerId.indexOf(pathwayMarker);
  return pathwayMarkerIndex >= 0 ? ownerId.slice(pathwayMarkerIndex + pathwayMarker.length) : "";
}

const RUNTIME_PATHWAY_MATCH_STOPWORDS = new Set([
  "and",
  "ba",
  "bs",
  "family",
  "in",
  "major",
  "option",
  "pathway",
  "route",
  "track",
]);

function getRuntimePathwayMatchTokens(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/ies$/i, "y").replace(/s$/i, ""))
    .filter((token) => token.length > 2 && !RUNTIME_PATHWAY_MATCH_STOPWORDS.has(token));
}

function runtimePathwayLabelMatchesRequest(
  requestedPathwayId: string | null | undefined,
  label: string | null | undefined
) {
  const requestedTokens = unique(getRuntimePathwayMatchTokens(requestedPathwayId));
  if (!requestedTokens.length) {
    return false;
  }

  const labelTokens = new Set(getRuntimePathwayMatchTokens(label));
  const matchedCount = requestedTokens.filter((token) => labelTokens.has(token)).length;
  return matchedCount >= Math.min(requestedTokens.length, 2);
}

function hasAdditiveBaseRequirementGroupForRequestedPathway(
  groups: Array<{ label?: string | null; pathwayId?: string | null }> | null | undefined,
  requestedPathwayId: string | null | undefined
) {
  return (groups ?? []).some((group) => {
    if (group.pathwayId) {
      return false;
    }

    const label = String(group.label ?? "");
    return (
      !/\b(?:option|track|route|pathway|concentration)\b/i.test(label) &&
      runtimePathwayLabelMatchesRequest(requestedPathwayId, label)
    );
  });
}

function isRuntimePathwayScopedPrimarySourceRole(sourceRole: string | null | undefined) {
  return /^(?:official-catalog|primary-degree-requirements|department-requirements)$/i.test(
    String(sourceRole ?? "").trim()
  );
}

function filterRuntimeParsedBlocksForRequestedPathway<
  T extends {
    pathwayId?: string | null;
    ownerId?: string | null;
    ownerTitle?: string | null;
    sourceRole?: string | null;
    sourceUrl?: string | null;
    primarySourceUrl?: string | null;
    parsedUwCourseCodes?: string[] | null;
    parsedRequirementGroups?: Array<{ label?: string | null; pathwayId?: string | null }> | null;
  }
>(blocks: T[], requestedPathwayId: string | null | undefined) {
  if (!requestedPathwayId || blocks.length <= 1) {
    return blocks;
  }

  const baseBlocks = blocks.filter((block) => !getRuntimeParsedBlockStoredPathwayText(block));
  const scopedBlocks = blocks.filter((block) => getRuntimeParsedBlockStoredPathwayText(block));
  if (!scopedBlocks.length) {
    return blocks;
  }

  const scoredBlocks = scopedBlocks.map((block) => {
    const storedPathwayText = getRuntimeParsedBlockStoredPathwayText(block);
    return {
      block,
      score:
        scoreStudentRuntimePathwayRequestMatch(requestedPathwayId, {
          id: storedPathwayText,
          label: "",
        }) *
          2 +
        scoreStudentRuntimePathwayRequestMatch(requestedPathwayId, {
          id: storedPathwayText,
          label: block.ownerTitle ?? "",
        }) + (storedPathwayText === requestedPathwayId ? 64 : 0),
    };
  });
  const bestScore = Math.max(...scoredBlocks.map((entry) => entry.score));
  if (bestScore <= 0) {
    return blocks;
  }

  const bestScopedBlocks = scoredBlocks
    .filter((entry) => entry.score === bestScore)
    .map((entry) => entry.block);
  const baseSourceUrls = new Set(
    baseBlocks
      .map((block) => String(block.sourceUrl ?? block.primarySourceUrl ?? "").trim())
      .filter(Boolean)
  );
  const selectedPathwayOwnsSource = bestScopedBlocks.some((block) => {
    const blockSourceUrl = String(block.sourceUrl ?? block.primarySourceUrl ?? "").trim();
    const hasDistinctPathwaySource = Boolean(
      blockSourceUrl &&
        !baseSourceUrls.has(blockSourceUrl) &&
        (block.parsedUwCourseCodes ?? []).length >= 3
    );
    const hasCatalogPathwaySection =
      Boolean(getRuntimeParsedBlockStoredPathwayText(block)) &&
      isRuntimePathwayScopedPrimarySourceRole(block.sourceRole) &&
      (block.parsedRequirementGroups ?? []).length > 0;

    return hasDistinctPathwaySource || hasCatalogPathwaySection;
  });
  const hasAdditiveBaseGroup = baseBlocks.some((block) =>
    hasAdditiveBaseRequirementGroupForRequestedPathway(
      block.parsedRequirementGroups,
      requestedPathwayId
    )
  );

  return selectedPathwayOwnsSource && !hasAdditiveBaseGroup
    ? bestScopedBlocks
    : [...baseBlocks, ...bestScopedBlocks];
}

function getStudentRuntimeAliasAcronym(tokens: string[]) {
  if (tokens.length < 2) return null;
  return tokens.map((token) => token[0]).join("");
}

function hasStudentRuntimePlannerContent(
  scope:
    | TransferPlannerMajorPlan
    | TransferPlannerMajorPathway
    | TransferPlannerResolvedMajorPlan
    | null
    | undefined
) {
  return Boolean(
    scope &&
      ((scope.degreeMapSections ?? []).some((section) => (section.items ?? []).length > 0) ||
        (scope.applicationChecklist ?? []).length > 0 ||
        (scope.beforeEnrollmentChecklist ?? []).length > 0 ||
        (scope.stayAtGrcChecklist ?? []).length > 0 ||
        (scope.requirementGroups ?? []).length > 0 ||
        (scope.supportLists ?? []).length > 0 ||
        (scope.grcCourseList ?? []).length > 0)
  );
}

function doesPathwayMatchAliasOption(pathway: TransferPlannerMajorPathway, optionTitle: string) {
  const optionTokens = getStudentRuntimeAliasTokens(optionTitle);
  if (optionTokens.length === 0) return false;
  const pathwayTokens = new Set(getStudentRuntimeAliasTokens(`${pathway.id} ${pathway.label}`));
  const optionAcronym = getStudentRuntimeAliasAcronym(optionTokens);
  return (
    optionTokens.every((token) => pathwayTokens.has(token)) ||
    (optionAcronym ? pathwayTokens.has(optionAcronym) : false)
  );
}

function isContentBackedParentPathway(
  parentPlan: TransferPlannerMajorPlan,
  pathway: TransferPlannerMajorPathway
) {
  const resolvedPathwayPlan =
    getRuntimeResolvedMajorPlanByPathwayKey(getPlannerPathwayKey(parentPlan.id, pathway.id)) ??
    null;
  return (
    hasStudentRuntimePlannerContent(pathway) ||
    hasStudentRuntimePlannerContent(resolvedPathwayPlan)
  );
}

function getAliasInferenceSourceText(plan: TransferPlannerMajorPlan) {
  const sourceBlocks = getRuntimeParsedRequirementBlocksForPlan(plan.id).filter(
    (block) => !block.pathwayId
  );
  return [
    plan.title,
    plan.shortTitle,
    ...(plan.officialLinks ?? []).flatMap((link) => [link.label, link.url, link.note]),
    ...sourceBlocks.flatMap((block) => [
      block.ownerTitle,
      block.sourceLabel,
      block.primarySourceLabel,
      ...(block.requirementCueLines ?? []).slice(0, 40),
      ...((block as { pathwayLabels?: string[] }).pathwayLabels ?? []),
      ...((block as { chooseStatements?: string[] }).chooseStatements ?? []),
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

function inferStudentRuntimeAliasPathwayKind(
  childPlan: TransferPlannerMajorPlan,
  optionTitle: string
) {
  if (/\b(?:option|track|route|pathway|concentration)\b/i.test(optionTitle)) {
    return null;
  }

  const sourceText = getAliasInferenceSourceText(childPlan);
  for (const kind of ["concentration", "option", "track", "route", "pathway"]) {
    if (new RegExp(`\\b${kind}\\b`, "i").test(sourceText)) {
      return kind;
    }
  }
  return null;
}

function buildStudentRuntimeAliasChildPathway(
  parentPlan: TransferPlannerMajorPlan,
  childPlan: TransferPlannerMajorPlan,
  optionTitle: string
) {
  const baseLabel = optionTitle.replace(/\s*\([^)]+\)\s*$/, "").trim();
  if (!baseLabel) return null;

  const inferredKind = inferStudentRuntimeAliasPathwayKind(childPlan, baseLabel);
  const label = inferredKind ? `${baseLabel} ${inferredKind}` : baseLabel;
  const id = normalizeTransferPlannerPathwayId(parentPlan.id, slugifyRuntimeId(label));
  if (!id) return null;

  return {
    id,
    label,
    summary: childPlan.summary ?? "",
    applicationChecklist: childPlan.applicationChecklist ?? [],
    beforeEnrollmentChecklist: childPlan.beforeEnrollmentChecklist ?? [],
    stayAtGrcChecklist: childPlan.stayAtGrcChecklist ?? [],
    advisorFlags: childPlan.advisorFlags ?? [],
    officialLinks: childPlan.officialLinks ?? [],
    degreeMapSections: childPlan.degreeMapSections ?? [],
    validationNotes: childPlan.validationNotes ?? [],
    grcCourseList: childPlan.grcCourseList ?? [],
    grcCourseListGuidance: childPlan.grcCourseListGuidance ?? "",
    plannerNote: childPlan.plannerNote ?? "",
    bestTrackId: childPlan.bestTrackId ?? null,
    recommendedTrackSummary: childPlan.recommendedTrackSummary ?? "",
    whyThisTrack: childPlan.whyThisTrack ?? [],
    requirementGroups: childPlan.requirementGroups ?? [],
    requirementReplacements: childPlan.requirementReplacements ?? [],
    supportLists: childPlan.supportLists ?? [],
  } satisfies TransferPlannerMajorPathway;
}

function buildStudentRuntimeAliasChildPathwayMaps(
  childPlans: TransferPlannerMajorPlan[]
): StudentRuntimeAliasChildPathwayMaps {
  const byParentId = new Map<string, StudentRuntimeAliasChildPathway[]>();
  const byKey = new Map<string, StudentRuntimeAliasChildPathway>();

  for (const childPlan of childPlans) {
    if (!hasStudentRuntimePlannerContent(childPlan)) continue;

    const aliasParent = getStudentRuntimeAliasParentPlan(childPlan);
    if (!aliasParent) continue;

    const { aliasTitleParts, parentPlan } = aliasParent;
    const parentPathways = getRuntimePathwaysForPlan(parentPlan);
    const matchingParentPathway = parentPathways.find(
      (pathway) =>
        doesPathwayMatchAliasOption(pathway, aliasTitleParts.optionTitle) &&
        isContentBackedParentPathway(parentPlan, pathway)
    );
    if (matchingParentPathway) continue;

    const pathway = buildStudentRuntimeAliasChildPathway(
      parentPlan,
      childPlan,
      aliasTitleParts.optionTitle
    );
    if (!pathway) continue;

    const entry = {
      parentPlanId: parentPlan.id,
      childPlan,
      pathway,
    } satisfies StudentRuntimeAliasChildPathway;
    const existing = byParentId.get(parentPlan.id) ?? [];
    existing.push(entry);
    byParentId.set(parentPlan.id, existing);
    byKey.set(getPlannerPathwayKey(parentPlan.id, pathway.id), entry);
  }

  return { byParentId, byKey };
}

function getStudentRuntimeAliasChildPathwayMapsForCampus(
  campusId: TransferPlannerCampusId
): StudentRuntimeAliasChildPathwayMaps {
  const cachedMaps = STUDENT_RUNTIME_ALIAS_CHILD_PATHWAY_MAPS_BY_CAMPUS_ID.get(campusId);
  if (cachedMaps) {
    return cachedMaps;
  }

  const maps = buildStudentRuntimeAliasChildPathwayMaps(
    getRuntimeMajorPlansForCampus(campusId)
  );
  STUDENT_RUNTIME_ALIAS_CHILD_PATHWAY_MAPS_BY_CAMPUS_ID.set(campusId, maps);
  return maps;
}

function getStudentRuntimeAliasChildPathwayMaps() {
  if (
    STUDENT_RUNTIME_ALIAS_CHILD_PATHWAYS_BY_PARENT_ID &&
    STUDENT_RUNTIME_ALIAS_CHILD_PATHWAYS_BY_KEY
  ) {
    return {
      byParentId: STUDENT_RUNTIME_ALIAS_CHILD_PATHWAYS_BY_PARENT_ID,
      byKey: STUDENT_RUNTIME_ALIAS_CHILD_PATHWAYS_BY_KEY,
    };
  }

  const byParentId = new Map<string, StudentRuntimeAliasChildPathway[]>();
  const byKey = new Map<string, StudentRuntimeAliasChildPathway>();

  for (const campus of TRANSFER_PLANNER_RUNTIME_CAMPUSES) {
    const campusMaps = getStudentRuntimeAliasChildPathwayMapsForCampus(campus.id);
    for (const [parentPlanId, entries] of campusMaps.byParentId.entries()) {
      byParentId.set(parentPlanId, [...(byParentId.get(parentPlanId) ?? []), ...entries]);
    }
    for (const [key, entry] of campusMaps.byKey.entries()) {
      byKey.set(key, entry);
    }
  }

  STUDENT_RUNTIME_ALIAS_CHILD_PATHWAYS_BY_PARENT_ID = byParentId;
  STUDENT_RUNTIME_ALIAS_CHILD_PATHWAYS_BY_KEY = byKey;
  return { byParentId, byKey };
}

function getStudentRuntimeAliasChildPathwaysForParent(
  parentPlanId: string,
  campusId?: TransferPlannerCampusId | null
) {
  if (campusId) {
    return (
      getStudentRuntimeAliasChildPathwayMapsForCampus(campusId).byParentId.get(parentPlanId) ?? []
    );
  }

  const parentPlan = getRuntimeMajorPlanById(parentPlanId);
  if (parentPlan) {
    return (
      getStudentRuntimeAliasChildPathwayMapsForCampus(parentPlan.campusId).byParentId.get(
        parentPlanId
      ) ?? []
    );
  }

  return getStudentRuntimeAliasChildPathwayMaps().byParentId.get(parentPlanId) ?? [];
}

function getStudentRuntimeAliasChildPathwayForPlanPathway(
  planId: string,
  pathwayId?: string | null,
  campusId?: TransferPlannerCampusId | null
) {
  const normalizedPathwayId = normalizeTransferPlannerPathwayId(planId, pathwayId ?? null);
  if (!normalizedPathwayId) return null;

  const key = getPlannerPathwayKey(planId, normalizedPathwayId);
  if (campusId) {
    return getStudentRuntimeAliasChildPathwayMapsForCampus(campusId).byKey.get(key) ?? null;
  }

  const plan = getRuntimeMajorPlanById(planId);
  if (plan) {
    return getStudentRuntimeAliasChildPathwayMapsForCampus(plan.campusId).byKey.get(key) ?? null;
  }

  return getStudentRuntimeAliasChildPathwayMaps().byKey.get(key) ?? null;
}

function getStudentRuntimeHiddenAliasPlanIdsForCampus(campusId: TransferPlannerCampusId) {
  const cachedPlanIds = STUDENT_RUNTIME_HIDDEN_ALIAS_PLAN_IDS_BY_CAMPUS_ID.get(campusId);
  if (cachedPlanIds) return cachedPlanIds;

  const hiddenPlanIds = new Set<string>();
  for (const plan of getRuntimeMajorPlansForCampus(campusId)) {
    const aliasParent = getStudentRuntimeAliasParentPlan(plan);
    if (!aliasParent) continue;

    const { aliasTitleParts, parentPlan } = aliasParent;
    const parentPathways = getRuntimePathwaysForPlan(parentPlan);
    const matchingParentPathway = parentPathways.find(
      (pathway) =>
        doesPathwayMatchAliasOption(pathway, aliasTitleParts.optionTitle) &&
        isContentBackedParentPathway(parentPlan, pathway)
    );
    const matchingAliasChildPathway = getStudentRuntimeAliasChildPathwaysForParent(
      parentPlan.id,
      parentPlan.campusId
    ).find(
      (entry) =>
        entry.childPlan.id === plan.id &&
        doesPathwayMatchAliasOption(entry.pathway, aliasTitleParts.optionTitle)
    );
    if (matchingParentPathway || matchingAliasChildPathway) {
      hiddenPlanIds.add(plan.id);
    }
  }

  STUDENT_RUNTIME_HIDDEN_ALIAS_PLAN_IDS_BY_CAMPUS_ID.set(campusId, hiddenPlanIds);
  return hiddenPlanIds;
}

function isHiddenStudentRuntimeAliasPlan(plan: TransferPlannerMajorPlan) {
  return getStudentRuntimeHiddenAliasPlanIdsForCampus(plan.campusId).has(plan.id);
}

export function getTransferPlannerStudentRuntimeAliasCoverage(
  planId: string,
  pathwayId?: string | null
) {
  const childPlan = getSourceMajorPlanById(planId);
  if (!childPlan) return null;

  const aliasParent = getStudentRuntimeAliasParentPlan(childPlan);
  if (!aliasParent) return null;

  const { aliasTitleParts, parentPlan } = aliasParent;
  const parentRuntimePlan = getTransferPlannerMajorPlan(parentPlan.id);
  if (!parentRuntimePlan) return null;

  const parentPathways = getRuntimePathwaysForPlan(parentPlan);
  const normalizedChildPathwayId = normalizeTransferPlannerPathwayId(
    childPlan.id,
    pathwayId ?? null
  );
  const childPathways = getRuntimePathwaysForPlan(childPlan);
  const childPathway = normalizedChildPathwayId
    ? childPathways.find(
        (pathway) =>
          normalizeTransferPlannerPathwayId(childPlan.id, pathway.id) ===
          normalizedChildPathwayId
      ) ?? null
    : null;
  const aliasMatchText = childPathway
    ? `${childPathway.id} ${childPathway.label}`
    : aliasTitleParts.optionTitle;
  const parentPathway =
    parentPathways.find(
      (pathway) =>
        doesPathwayMatchAliasOption(pathway, aliasMatchText) &&
        isContentBackedParentPathway(parentPlan, pathway)
    ) ??
    parentPathways.find(
      (pathway) =>
        childPathway &&
        doesPathwayMatchAliasOption(pathway, aliasTitleParts.optionTitle) &&
        isContentBackedParentPathway(parentPlan, pathway)
    ) ??
    null;

  if (!parentPathway) return null;

  const resolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(
    parentRuntimePlan,
    parentPathway.id
  );
  if (!resolvedPlan) return null;

  return {
    childPlanId: childPlan.id,
    childPathwayId: normalizedChildPathwayId,
    parentPlanId: parentPlan.id,
    parentPathwayId: parentPathway.id,
    parentPlan: parentRuntimePlan,
    parentPathway,
    resolvedPlan,
  };
}

function parseCourseParts(code: string) {
  const normalizedCode = normalizeCourseCode(code);
  const match = normalizedCode.match(/^([A-Z&]+(?: [A-Z&]+)*)\s+(\d{3}(?:\.\d+)?[A-Z]?)$/);
  const catalogNumber = match?.[2] ?? "";
  const levelMatch = catalogNumber.match(/^(\d{3})/);
  return {
    subjectCode: match?.[1] ?? normalizedCode.replace(/\s+\d.*$/, ""),
    catalogNumber,
    level: levelMatch ? Number.parseInt(levelMatch[1], 10) : null,
  };
}

function expandCourseEntry(
  entry: TransferPlannerRuntimeCompactCourseRegistryEntry,
  requestedCode?: string
): TransferPlannerCourseRegistryEntry {
  const code = normalizeCourseCode(requestedCode ?? entry.code);
  const parts = parseCourseParts(code);
  return {
    id: `${entry.schoolId}:${code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    schoolId: entry.schoolId,
    code,
    displayLabel: code,
    title: entry.title ?? null,
    creditValue: entry.creditValue ?? null,
    creditLabel: entry.creditLabel ?? null,
    catalogDescription: entry.catalogDescription ?? null,
    subjectCode: parts.subjectCode,
    catalogNumber: parts.catalogNumber,
    level: parts.level,
    sourceKinds: [],
    sourceContexts: [],
    referencedByPlanIds: [],
    referencedByTrackIds: [],
    sourceLinks: [],
    effectiveYearLabels: [],
    effectiveYearRanges: [],
    prerequisiteCourseCodes: entry.prerequisiteCourseCodes ?? [],
    prerequisiteAlternativeCourseCodeSets: entry.prerequisiteAlternativeCourseCodeSets ?? [],
    prerequisiteNotes: [],
    corequisiteCourseCodes: entry.corequisiteCourseCodes ?? [],
    corequisiteAlternativeCourseCodeSets: entry.corequisiteAlternativeCourseCodeSets ?? [],
    corequisiteNotes: [],
    latestAvailabilitySummary: entry.latestAvailabilitySummary ?? null,
    latestPublishedQuarters: entry.latestPublishedQuarters ?? [],
    notes: [],
  };
}

function getCourseRegistryEntryScore(
  entry: TransferPlannerRuntimeCompactCourseRegistryEntry,
  requestedCode: string
) {
  let score = 0;
  if (entry.title) score += 32;
  if (entry.creditValue !== undefined && entry.creditValue !== null) score += 16;
  if (entry.creditLabel) score += 8;
  if ((entry.prerequisiteCourseCodes ?? []).length > 0) score += 8;
  if ((entry.prerequisiteAlternativeCourseCodeSets ?? []).length > 0) score += 6;
  if ((entry.corequisiteCourseCodes ?? []).length > 0) score += 8;
  if ((entry.corequisiteAlternativeCourseCodeSets ?? []).length > 0) score += 6;
  if (normalizeCourseCode(entry.code) === requestedCode) score += 1;
  return score;
}

export function getTransferPlannerCanonicalCourse(
  schoolId: TransferPlannerSourceSchoolId,
  code: string
) {
  const normalizedCode = normalizeCourseCode(code);
  const exactEntry = getCompactCoursesByKey().get(`${schoolId}|${normalizedCode}`) ?? null;
  const bestEquivalentEntry =
    getEquivalentCourseCodes(schoolId, normalizedCode)
      .map((candidateCode) => getCompactCoursesByKey().get(`${schoolId}|${candidateCode}`) ?? null)
      .filter((entry): entry is TransferPlannerRuntimeCompactCourseRegistryEntry =>
        Boolean(entry)
      )
      .sort((left, right) => {
        const scoreDelta =
          getCourseRegistryEntryScore(right, normalizedCode) -
          getCourseRegistryEntryScore(left, normalizedCode);
        if (scoreDelta !== 0) return scoreDelta;
        return left.code.localeCompare(right.code);
      })[0] ?? null;

  const selectedEntry = bestEquivalentEntry ?? exactEntry;
  return selectedEntry ? expandCourseEntry(selectedEntry, normalizedCode) : undefined;
}

function parseGuideTermSortValue(label: string | null | undefined) {
  const match = String(label ?? "")
    .toUpperCase()
    .match(/\b(WIN|SPR|SUM|AUT)\s+QTR\.\s+(\d{4})\b/);
  if (!match) return null;
  const quarter = GUIDE_TERM_ORDER[match[1]];
  if (!quarter) return null;
  return Number.parseInt(match[2], 10) * 10 + quarter;
}

function isEffectiveRangeActiveForGuideTerm(
  range: TransferPlannerEffectiveYearRange,
  termLabel: string
) {
  const termValue = parseGuideTermSortValue(termLabel);
  if (termValue === null) return true;

  const endValue = parseGuideTermSortValue(range.endLabel);
  if (range.startLabel === "prior-to-guide-cutoff") {
    return endValue === null ? true : termValue < endValue;
  }

  const startValue = parseGuideTermSortValue(range.startLabel);
  if (startValue !== null && termValue < startValue) return false;
  if (endValue !== null && termValue > endValue) return false;
  return true;
}

export function isTransferPlannerEquivalencyRuleEffectiveForTerm(
  rule: TransferPlannerEquivalencyRule,
  termLabel: string
) {
  if (rule.effectiveYearRanges.length === 0) return true;
  return rule.effectiveYearRanges.some((range) =>
    isEffectiveRangeActiveForGuideTerm(range, termLabel)
  );
}

let equivalencyRulesBySourceCourse: Map<string, TransferPlannerEquivalencyRule[]> | null = null;

function getEquivalencyRulesBySourceCourse() {
  if (equivalencyRulesBySourceCourse) return equivalencyRulesBySourceCourse;

  const rulesBySourceCourse = new Map<string, TransferPlannerEquivalencyRule[]>();
  for (const rule of TRANSFER_PLANNER_RUNTIME_EQUIVALENCY_RULE_REGISTRY) {
    const sourceCourses = unique(
      (rule.sourceCourseSets ?? [])
        .flatMap((courseSet) => courseSet)
        .map((courseCode) => normalizeCourseCode(courseCode))
        .filter(Boolean)
    );

    for (const sourceCourse of sourceCourses) {
      const matchingRules = rulesBySourceCourse.get(sourceCourse) ?? [];
      matchingRules.push(rule);
      rulesBySourceCourse.set(sourceCourse, matchingRules);
    }
  }

  equivalencyRulesBySourceCourse = rulesBySourceCourse;
  return equivalencyRulesBySourceCourse;
}

export function getTransferPlannerEquivalencyRulesForSourceCourse(
  sourceCourseCode: string,
  effectiveTermLabel?: string | null
) {
  const normalizedCode = normalizeCourseCode(sourceCourseCode);
  const matchingRules = getEquivalencyRulesBySourceCourse().get(normalizedCode) ?? [];
  return matchingRules.filter((rule) =>
    effectiveTermLabel
      ? isTransferPlannerEquivalencyRuleEffectiveForTerm(rule, effectiveTermLabel)
      : true
  );
}

export function getTransferPlannerAllEquivalencyRules() {
  return [...TRANSFER_PLANNER_RUNTIME_EQUIVALENCY_RULE_REGISTRY];
}

export function getTransferPlannerStudentRuntimeMajorsForCampus(
  campusId: TransferPlannerCampusId
) {
  const cachedMajors = STUDENT_RUNTIME_MAJORS_BY_CAMPUS_ID.get(campusId);
  if (cachedMajors) {
    return cachedMajors;
  }

  const majors = getRuntimeMajorPlansForCampus(campusId)
    .filter((plan) => !isHiddenStudentRuntimeAliasPlan(plan))
    .map((plan) => normalizeStudentRuntimeMajorPlan(plan));
  STUDENT_RUNTIME_MAJORS_BY_CAMPUS_ID.set(campusId, majors);
  return majors;
}

export function getTransferPlannerStudentRuntimePathwaysForPlan(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) return [] as TransferPlannerMajorPathway[];
  return uniqueStudentRuntimePathwaysByNormalizedId(
    plan.id,
    [
      ...getStudentRuntimeAliasChildPathwaysForParent(plan.id, plan.campusId).map(
        (entry) => entry.pathway
      ),
      ...getRuntimePathwaysForPlan(plan),
    ]
  );
}

export function resolveTransferPlannerStudentRuntimeMajorPlan(
  plan: TransferPlannerMajorPlan | null | undefined,
  pathwayId: string | null | undefined
) {
  if (!plan) return null as TransferPlannerResolvedMajorPlan | null;
  const pathways = getTransferPlannerStudentRuntimePathwaysForPlan(plan);
  const normalizedInputPathwayId = normalizeTransferPlannerPathwayId(plan.id, pathwayId);
  const matchedPathway = normalizedInputPathwayId
    ? pickStudentRuntimePathwayForRequest(
        plan.id,
        pathways,
        pathwayId,
        normalizedInputPathwayId
      )
    : null;
  const selectedPathwayId =
    matchedPathway?.id ?? (normalizedInputPathwayId ? null : pathways[0]?.id ?? null);
  const resolvedRuntimePlanKey = getPlannerPathwayKey(plan.id, selectedPathwayId);
  const cachedResolvedRuntimePlan = RESOLVED_STUDENT_RUNTIME_PLANS_BY_KEY.get(
    resolvedRuntimePlanKey
  );
  if (cachedResolvedRuntimePlan) {
    return cachedResolvedRuntimePlan;
  }

  const resolvedPlan =
    (() => {
      const aliasChildPathway = getStudentRuntimeAliasChildPathwayForPlanPathway(
        plan.id,
        selectedPathwayId,
        plan.campusId
      );
      if (!aliasChildPathway) {
        return (
          getRuntimeResolvedMajorPlanByPathwayKey(resolvedRuntimePlanKey) ??
          getRuntimeResolvedMajorPlanByPathwayKey(getPlannerPathwayKey(plan.id, null)) ??
          null
        );
      }

      return {
        ...aliasChildPathway.childPlan,
        id: plan.id,
        campusId: plan.campusId,
        title: plan.title,
        shortTitle: plan.shortTitle,
        pathways,
        selectedPathwayId: aliasChildPathway.pathway.id,
        selectedPathwayLabel: aliasChildPathway.pathway.label,
        selectedPathwaySummary: aliasChildPathway.pathway.summary,
      } satisfies TransferPlannerResolvedMajorPlan;
    })();

  const resolvedRuntimePlan = resolvedPlan
    ? ({ ...resolvedPlan, pathways } satisfies TransferPlannerResolvedMajorPlan)
    : ({
        ...plan,
        pathways,
        selectedPathwayId: null,
        selectedPathwayLabel: null,
        selectedPathwaySummary: null,
      } satisfies TransferPlannerResolvedMajorPlan);

  const normalizedResolvedRuntimePlan =
    normalizeStudentRuntimeResolvedMajorPlan(resolvedRuntimePlan);
  RESOLVED_STUDENT_RUNTIME_PLANS_BY_KEY.set(
    resolvedRuntimePlanKey,
    normalizedResolvedRuntimePlan
  );
  return normalizedResolvedRuntimePlan;
}

export function getTransferPlannerMajorPlan(planId: string) {
  const plan = getRuntimeMajorPlanById(planId) ?? null;
  return plan && !isHiddenStudentRuntimeAliasPlan(plan)
    ? normalizeStudentRuntimeMajorPlan(plan)
    : null;
}

export function resolveTransferPlannerMajorPlan(
  plan: TransferPlannerMajorPlan | null | undefined,
  pathwayId: string | null | undefined
) {
  return resolveTransferPlannerStudentRuntimeMajorPlan(plan, pathwayId);
}

export function getTransferPlannerTrack(trackId: string | null) {
  if (!trackId) return null;
  return getTracksById().get(trackId) ?? null;
}

export function getTransferPlannerPrimaryDegreeRequirementsSource(
  planId: string,
  pathwayId?: string | null
) {
  const normalizedPathwayId = normalizeTransferPlannerPathwayId(planId, pathwayId ?? null);
  const aliasChildPathway = getStudentRuntimeAliasChildPathwayForPlanPathway(
    planId,
    normalizedPathwayId
  );
  if (aliasChildPathway) {
    return (
      getRuntimePrimaryDegreeSourceByPathwayKey(
        getPlannerPathwayKey(aliasChildPathway.childPlan.id, null)
      ) ?? null
    ) as TransferPlannerSourceManifestEntry | null;
  }
  return (
    getRuntimePrimaryDegreeSourceByPathwayKey(
      getPlannerPathwayKey(planId, normalizedPathwayId ?? null)
    ) ??
    getRuntimePrimaryDegreeSourceByPathwayKey(getPlannerPathwayKey(planId, null)) ??
    null
  ) as TransferPlannerSourceManifestEntry | null;
}

export function getTransferPlannerParsedRequirementSourceBlocks(
  planId: string,
  pathwayId?: string | null
) {
  const normalizedPathwayId =
    pathwayId === undefined ? undefined : normalizeTransferPlannerPathwayId(planId, pathwayId);
  const aliasChildPathway =
    normalizedPathwayId === undefined
      ? null
      : getStudentRuntimeAliasChildPathwayForPlanPathway(planId, normalizedPathwayId);
  if (aliasChildPathway) {
    return getRuntimeParsedRequirementBlocksForPlan(
      aliasChildPathway.childPlan.id
    )
      .filter((entry) => !entry.pathwayId)
      .map(normalizeRuntimeParsedRequirementSourceBlock);
  }
  const matchingBlocks = getRuntimeParsedRequirementBlocksForPlan(planId).filter(
    (entry) => {
      if (normalizedPathwayId === undefined) {
        return true;
      }

      const normalizedEntryPathwayId = getRuntimeParsedBlockPathwayId(entry);
      return normalizedPathwayId === null
        ? !normalizedEntryPathwayId
        : !normalizedEntryPathwayId || normalizedEntryPathwayId === normalizedPathwayId;
    }
  );
  return filterRuntimeParsedBlocksForRequestedPathway(
    matchingBlocks,
    pathwayId
  ).map(normalizeRuntimeParsedRequirementSourceBlock);
}

function getChecklistReferenceCourses(plan: TransferPlannerMajorPlan) {
  return [
    ...(plan.applicationChecklist ?? []),
    ...(plan.beforeEnrollmentChecklist ?? []),
    ...(plan.stayAtGrcChecklist ?? []),
  ].flatMap((item) => [item.grcCourses, ...(item.alternatives ?? [])].flat());
}

export function getTransferPlannerGrcCourseList(
  plan: TransferPlannerMajorPlan | TransferPlannerResolvedMajorPlan | null | undefined
) {
  if (!plan) return [] as string[];
  return unique([...(plan.grcCourseList ?? []), ...getChecklistReferenceCourses(plan)])
    .flatMap((courseLabel) => extractTransferPlannerCourseCodes(courseLabel))
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter((courseCode) => Boolean(getTransferPlannerCanonicalCourse("grc", courseCode)))
    .filter(Boolean);
}

export function getTransferPlannerGrcCourseAvailabilitySummary(
  courseLabel: string | null | undefined
) {
  for (const courseCode of extractTransferPlannerCourseCodes(String(courseLabel ?? ""))) {
    const summary = getTransferPlannerCanonicalCourse("grc", courseCode)?.latestAvailabilitySummary;
    if (summary) return summary;
  }
  return null;
}

export function getTransferPlannerGrcCourseLatestPublishedQuarters(
  courseLabel: string | null | undefined
) {
  for (const courseCode of extractTransferPlannerCourseCodes(String(courseLabel ?? ""))) {
    const quarters = getTransferPlannerCanonicalCourse("grc", courseCode)?.latestPublishedQuarters;
    if (quarters?.length) return [...quarters];
  }
  return null;
}
