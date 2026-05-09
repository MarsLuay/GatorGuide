import {
  TRANSFER_PLANNER_RUNTIME_CAMPUSES,
  TRANSFER_PLANNER_RUNTIME_COMPACT_COURSE_REGISTRY,
  TRANSFER_PLANNER_RUNTIME_EQUIVALENCY_RULE_REGISTRY,
  TRANSFER_PLANNER_RUNTIME_MAJOR_PLANS,
  TRANSFER_PLANNER_RUNTIME_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY,
  TRANSFER_PLANNER_RUNTIME_PATHWAYS_BY_PLAN_ID,
  TRANSFER_PLANNER_RUNTIME_PRIMARY_DEGREE_SOURCES_BY_KEY,
  TRANSFER_PLANNER_RUNTIME_RESOLVED_MAJOR_PLANS_BY_KEY,
  TRANSFER_PLANNER_RUNTIME_SOURCE_GAP_REGISTRY,
  TRANSFER_PLANNER_RUNTIME_TRACKS,
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

const KNOWN_TRANSFER_PLANNER_SUBJECT_CODES = new Set(
  TRANSFER_PLANNER_RUNTIME_COMPACT_COURSE_REGISTRY.map((entry) =>
    String(entry.code ?? "").match(/^([A-Z&]+(?: [A-Z&]+)*)\s+\d/)
  )
    .map((match) => match?.[1] ?? null)
    .filter((subjectCode): subjectCode is string => Boolean(subjectCode))
);

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

function getPlannerPathwayKey(planId: string, pathwayId?: string | null) {
  return `${planId}::${pathwayId ?? ""}`;
}

const UW_SEATTLE_ECE_PLAN_ID = "uw-seattle-electrical-computer-engineering";
const UW_SEATTLE_ECE_TRANSFER_TRACK_ID =
  "grc-associate-stem-engineering-associate-in-science-transfer-track-2-mrp-computer-and-electrical-engineering";
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
const UW_SEATTLE_BIOENGINEERING_SOURCE_BACKED_GEN_ED_SECTION = {
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
}): TransferPlannerChecklistItem {
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
  };
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
      note: "Not part of the minimum transfer-admission classes, but useful to complete before or during UW enrollment because it is needed to complete the degree either way.",
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
  const grcCourseList = unique(
    [
      ...checklist.applicationChecklist,
      ...checklist.beforeEnrollmentChecklist,
    ].flatMap((item) => [item.grcCourses, ...(item.alternatives ?? [])].flat())
  ).map((courseCode) => normalizeCourseCode(courseCode));

  return {
    ...plan,
    bestTrackId: plan.bestTrackId ?? UW_SEATTLE_ECE_TRANSFER_TRACK_ID,
    applicationChecklist: checklist.applicationChecklist,
    beforeEnrollmentChecklist: checklist.beforeEnrollmentChecklist,
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
      note: "Not part of the minimum transfer-admission classes, but useful to complete before or during UW enrollment because it is needed to complete the degree either way.",
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

function normalizeUwSeattleMechanicalRuntimePlan<T extends TransferPlannerResolvedMajorPlan>(
  plan: T
): T {
  if (plan.id !== UW_SEATTLE_ME_PLAN_ID) {
    return plan;
  }

  const checklist = buildUwSeattleMechanicalRuntimeChecklist();
  const grcCourseList = unique(
    [
      ...checklist.applicationChecklist,
      ...checklist.beforeEnrollmentChecklist,
    ].flatMap((item) => [item.grcCourses, ...(item.alternatives ?? [])].flat())
  ).map((courseCode) => normalizeCourseCode(courseCode));

  return {
    ...plan,
    bestTrackId:
      plan.bestTrackId ?? UW_SEATTLE_CIVIL_MECHANICAL_TRANSFER_TRACK_ID,
    applicationChecklist: checklist.applicationChecklist,
    beforeEnrollmentChecklist: checklist.beforeEnrollmentChecklist,
    stayAtGrcChecklist: [],
    grcCourseList,
    requirementGroups: [],
    validationNotes: unique([
      ...(plan.validationNotes ?? []),
      "Runtime Mechanical Engineering transfer checklist normalized to the current ME transfer admission and enrollment requirements.",
    ]),
  };
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
      note: "Kept internal in Green River transfer-only planning until a source-backed Green River equivalent is available.",
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
  const grcCourseList = buildRuntimeGrcCourseListFromChecklists(
    [
      ...checklist.applicationChecklist,
      ...checklist.beforeEnrollmentChecklist,
      ...checklist.stayAtGrcChecklist,
    ],
    { onlyCanonicalGrcCourses: true }
  );

  return {
    ...plan,
    bestTrackId:
      plan.bestTrackId ?? UW_SEATTLE_CIVIL_MECHANICAL_TRANSFER_TRACK_ID,
    applicationChecklist: checklist.applicationChecklist,
    beforeEnrollmentChecklist: checklist.beforeEnrollmentChecklist,
    stayAtGrcChecklist: checklist.stayAtGrcChecklist,
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
      note: "Kept internal in Green River transfer-only planning until a source-backed Green River equivalent is available.",
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
        (section) => section.id !== UW_SEATTLE_BIOENGINEERING_SOURCE_BACKED_GEN_ED_SECTION.id
      ),
      UW_SEATTLE_BIOENGINEERING_SOURCE_BACKED_GEN_ED_SECTION,
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
  const grcCourseList = buildRuntimeGrcCourseListFromChecklists(
    [
      ...checklist.applicationChecklist,
      ...checklist.beforeEnrollmentChecklist,
      ...checklist.stayAtGrcChecklist,
    ],
    { onlyCanonicalGrcCourses: true }
  );

  return refreshRuntimeMatchedTrackCopy(appendUwSeattleBioengineeringGeneralEducationSection({
    ...plan,
    bestTrackId: UW_SEATTLE_BIOENGINEERING_TRANSFER_TRACK_ID,
    applicationChecklist: checklist.applicationChecklist,
    beforeEnrollmentChecklist: checklist.beforeEnrollmentChecklist,
    stayAtGrcChecklist: checklist.stayAtGrcChecklist,
    grcCourseList,
    requirementGroups: [],
    validationNotes: unique([
      ...(plan.validationNotes ?? []),
      "Runtime Bioengineering transfer checklist normalized to the current UW Bioengineering lower-division, programming, science, math, and general-education requirements.",
    ]),
  }));
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
  const grcCourseList = buildRuntimeGrcCourseListFromChecklists(
    [
      ...checklist.applicationChecklist,
      ...checklist.beforeEnrollmentChecklist,
      ...checklist.stayAtGrcChecklist,
    ],
    { onlyCanonicalGrcCourses: true }
  );

  return refreshRuntimeMatchedTrackCopy({
    ...plan,
    bestTrackId: plan.bestTrackId ?? UW_SEATTLE_BIOENGINEERING_TRANSFER_TRACK_ID,
    applicationChecklist: checklist.applicationChecklist,
    beforeEnrollmentChecklist: checklist.beforeEnrollmentChecklist,
    stayAtGrcChecklist: checklist.stayAtGrcChecklist,
    grcCourseList,
    requirementGroups: [],
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

function addCategoryOptionsToRequirementGroup(
  group: TransferPlannerRequirementGroup,
  ownerId: string,
  sourceLines: string[]
) {
  const categoryOptionsToAdd: TransferPlannerRequirementOption[] = [];

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
      .map(
        (option) =>
          `${option.categoryOption?.category ?? ""}:${option.categoryOption?.credits ?? ""}:${
            option.categoryOption?.sourceText ?? ""
          }`
      )
  );
  const newCategoryOptions = categoryOptionsToAdd.filter((option) => {
    const key = `${option.categoryOption?.category ?? ""}:${
      option.categoryOption?.credits ?? ""
    }:${option.categoryOption?.sourceText ?? ""}`;
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

export function normalizeCategoryOptionRuntimePlan<T extends TransferPlannerMajorPlan>(
  plan: T
): T {
  const selectedPathwayId =
    "selectedPathwayId" in plan
      ? ((plan as unknown as { selectedPathwayId?: string | null }).selectedPathwayId ?? null)
      : null;
  const sourceLines = getTransferPlannerParsedRequirementSourceBlocks(
    plan.id,
    selectedPathwayId
  ).flatMap((block) => [
    ...(block.requirementCueLines ?? []),
    ...((block as { chooseStatements?: string[] }).chooseStatements ?? []),
  ]);

  if (!sourceLines.length) {
    return plan;
  }

  const originalGroups = plan.requirementGroups ?? [];
  const checklistGroups = [
    ...(plan.applicationChecklist ?? []),
    ...(plan.beforeEnrollmentChecklist ?? []),
    ...(plan.stayAtGrcChecklist ?? []),
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
    const normalizedGroup = addCategoryOptionsToRequirementGroup(group, plan.id, sourceLines);
    normalizedGroupsById.set(group.id, normalizedGroup);
    if (normalizedGroup !== group) {
      changed = true;
    }
  }

  if (!changed) {
    return plan;
  }

  return {
    ...plan,
    requirementGroups: originalGroups.map((group) => normalizedGroupsById.get(group.id) ?? group),
    applicationChecklist: addCategoryOptionsToChecklistItems(
      plan.applicationChecklist,
      normalizedGroupsById
    ),
    beforeEnrollmentChecklist: addCategoryOptionsToChecklistItems(
      plan.beforeEnrollmentChecklist,
      normalizedGroupsById
    ),
    stayAtGrcChecklist: addCategoryOptionsToChecklistItems(
      plan.stayAtGrcChecklist,
      normalizedGroupsById
    ),
  };
}

function normalizeStudentRuntimeMajorPlan<T extends TransferPlannerMajorPlan>(plan: T): T {
  return normalizeCategoryOptionRuntimePlan(
    normalizeUwSeattleChemicalEngineeringRuntimePlan(
      normalizeUwSeattleBioengineeringRuntimePlan(plan)
    )
  );
}

function normalizeStudentRuntimeResolvedMajorPlan<T extends TransferPlannerResolvedMajorPlan>(
  plan: T
): T {
  return normalizeCategoryOptionRuntimePlan(
    normalizeUwSeattleChemicalEngineeringRuntimePlan(
      normalizeUwSeattleBioengineeringRuntimePlan(
        normalizeUwSeattleCivilRuntimePlan(
          normalizeUwSeattleMechanicalRuntimePlan(normalizeUwSeattleEceRuntimePlan(plan))
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
      KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(candidateSpacedSubject) ||
      KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(candidateCollapsedSubject)
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
      KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(collapsedSubject) &&
      !KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(spacedSubject))
      ? collapsedSubject
      : spacedSubject;

  return `${normalizedSubject} ${match[2]}`;
}

function normalizeCourseCode(value: string | null | undefined) {
  return normalizeTransferPlannerCourseCode(String(value ?? ""));
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
    KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(collapsedSubject) &&
    !KNOWN_TRANSFER_PLANNER_SUBJECT_CODES.has(subject)
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
export const TRANSFER_PLANNER_SOURCE_GAP_REGISTRY =
  TRANSFER_PLANNER_RUNTIME_SOURCE_GAP_REGISTRY as TransferPlannerRuntimeSourceGapEntry[];

const TRACKS_BY_ID = new Map(TRANSFER_PLANNER_TRACKS.map((track) => [track.id, track]));
const MAJOR_PLANS_BY_ID = new Map(
  TRANSFER_PLANNER_RUNTIME_MAJOR_PLANS.map((plan) => [plan.id, plan])
);
const COMPACT_COURSES_BY_KEY = new Map(
  TRANSFER_PLANNER_RUNTIME_COMPACT_COURSE_REGISTRY.map((entry) => [
    `${entry.schoolId}|${normalizeCourseCode(entry.code)}`,
    entry,
  ])
);
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
  const exactEntry = COMPACT_COURSES_BY_KEY.get(`${schoolId}|${normalizedCode}`) ?? null;
  const bestEquivalentEntry =
    getEquivalentCourseCodes(schoolId, normalizedCode)
      .map((candidateCode) => COMPACT_COURSES_BY_KEY.get(`${schoolId}|${candidateCode}`) ?? null)
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
  return TRANSFER_PLANNER_RUNTIME_MAJOR_PLANS.filter((plan) => plan.campusId === campusId).map(
    (plan) => normalizeStudentRuntimeMajorPlan(plan)
  );
}

export function getTransferPlannerStudentRuntimePathwaysForPlan(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan) return [] as TransferPlannerMajorPathway[];
  return TRANSFER_PLANNER_RUNTIME_PATHWAYS_BY_PLAN_ID[plan.id] ?? plan.pathways ?? [];
}

export function resolveTransferPlannerStudentRuntimeMajorPlan(
  plan: TransferPlannerMajorPlan | null | undefined,
  pathwayId: string | null | undefined
) {
  if (!plan) return null as TransferPlannerResolvedMajorPlan | null;
  const pathways = getTransferPlannerStudentRuntimePathwaysForPlan(plan);
  const selectedPathwayId =
    pathwayId && pathways.some((pathway) => pathway.id === pathwayId)
      ? pathwayId
      : pathways[0]?.id ?? null;
  const resolvedPlan =
    TRANSFER_PLANNER_RUNTIME_RESOLVED_MAJOR_PLANS_BY_KEY[
      getPlannerPathwayKey(plan.id, selectedPathwayId)
    ] ??
    TRANSFER_PLANNER_RUNTIME_RESOLVED_MAJOR_PLANS_BY_KEY[getPlannerPathwayKey(plan.id, null)] ??
    null;

  const resolvedRuntimePlan = resolvedPlan
    ? ({ ...resolvedPlan, pathways } satisfies TransferPlannerResolvedMajorPlan)
    : ({
        ...plan,
        pathways,
        selectedPathwayId: null,
        selectedPathwayLabel: null,
        selectedPathwaySummary: null,
      } satisfies TransferPlannerResolvedMajorPlan);

  return normalizeStudentRuntimeResolvedMajorPlan(resolvedRuntimePlan);
}

export function getTransferPlannerMajorPlan(planId: string) {
  const plan = MAJOR_PLANS_BY_ID.get(planId) ?? null;
  return plan ? normalizeStudentRuntimeMajorPlan(plan) : null;
}

export function resolveTransferPlannerMajorPlan(
  plan: TransferPlannerMajorPlan | null | undefined,
  pathwayId: string | null | undefined
) {
  return resolveTransferPlannerStudentRuntimeMajorPlan(plan, pathwayId);
}

export function getTransferPlannerTrack(trackId: string | null) {
  if (!trackId) return null;
  return TRACKS_BY_ID.get(trackId) ?? null;
}

export function getTransferPlannerPrimaryDegreeRequirementsSource(
  planId: string,
  pathwayId?: string | null
) {
  return (
    TRANSFER_PLANNER_RUNTIME_PRIMARY_DEGREE_SOURCES_BY_KEY[
      getPlannerPathwayKey(planId, pathwayId ?? null)
    ] ??
    TRANSFER_PLANNER_RUNTIME_PRIMARY_DEGREE_SOURCES_BY_KEY[getPlannerPathwayKey(planId, null)] ??
    null
  ) as TransferPlannerSourceManifestEntry | null;
}

export function getTransferPlannerParsedRequirementSourceBlocks(
  planId: string,
  pathwayId?: string | null
) {
  return TRANSFER_PLANNER_RUNTIME_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.filter(
    (entry) =>
      entry.planId === planId &&
      (pathwayId === undefined
        ? true
        : pathwayId === null
          ? !entry.pathwayId
          : entry.pathwayId === pathwayId)
  );
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
    .map((courseCode) => normalizeCourseCode(courseCode))
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
