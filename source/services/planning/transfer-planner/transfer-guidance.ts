import {
  getTransferPlannerAllEquivalencyRules,
  getTransferPlannerCanonicalCourse,
  getTransferPlannerEquivalencyRulesForSourceCourse,
  getTransferPlannerGrcCourseList,
  type TransferPlannerEquivalencyRule,
  type TransferPlannerMajorPlan,
} from "@/constants/transfer-planner-source/student-runtime";

import { extractCourseCodes, normalizeCourseCode } from "./course-code";

export const GUIDE_BACKED_EQUIVALENCY_RULE_KINDS = new Set([
  "uw-green-river-equivalency-guide",
  "uw-green-river-equivalency-guide-derived",
]);

const REQUIRED_COURSE_SEMANTIC_RELATION_PATTERN =
  /\bCourse (?:equivalent to|overlaps with):\s*([^.]*)/gi;
const REQUIRED_COURSE_SEMANTIC_RELATION_CACHE = new Map<string, string[]>();
const REQUIRED_COURSE_EQUIVALENT_RELATION_PATTERN =
  /\bCourse equivalent to:\s*([^.]*)/gi;
const REQUIRED_COURSE_OVERLAP_RELATION_PATTERN =
  /\bCourse overlaps with:\s*([^.]*)/gi;
const REQUIRED_COURSE_SEMANTIC_RELATION_GROUP_CACHE = new Map<
  string,
  { equivalent: string[]; overlap: string[] }
>();

type GrcEquivalentPathCandidate = {
  pathCourseCodes: string[];
  rule: TransferPlannerEquivalencyRule;
  targetCourseCode: string;
};

const GRC_EQUIVALENT_PATH_INDEX_BY_CAMPUS = new Map<
  string,
  Map<string, GrcEquivalentPathCandidate[]>
>();

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function sortCourseCodes(codes: string[]) {
  return unique(codes).sort((left, right) => left.localeCompare(right));
}

export function normalizeGeneralEducationRequirementTag(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function inferGeneralEducationRequirementTagsFromRuleText(
  rule: TransferPlannerEquivalencyRule
) {
  const text = [
    rule.title,
    rule.targetOutcome,
    ...(rule.targetCourseCodes ?? []),
    ...(rule.notes ?? []),
    ...(rule.plannerWarnings ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const inferredTags: string[] = [];
  if (/\bnatural\s+science\b|\bnsc\b/.test(text)) {
    inferredTags.push("NSC");
  }
  if (/\bhumanit/.test(text) || /\ba\s*&\s*h\b|\bah\b/.test(text)) {
    inferredTags.push("AH");
  }
  if (/\bsocial\s+science\b|\bssc\b|\bi\s*&\s*s\b/.test(text)) {
    inferredTags.push("SSC");
  }

  return inferredTags;
}

export function getEvaluationTargetRequirementTags(
  rule: TransferPlannerEquivalencyRule | null | undefined
) {
  if (!rule) {
    return [] as string[];
  }

  return unique(
    [
      ...(rule.targetRequirementTags ?? []),
      ...inferGeneralEducationRequirementTagsFromRuleText(rule),
    ]
      .map((tag) => normalizeGeneralEducationRequirementTag(tag))
      .filter(Boolean)
  );
}

const CATEGORY_OPTION_AUDIT_PATTERNS = [
  { category: "NSC", sourceCategoryCode: "NSc", pattern: /\b(?:N\s*Sc|natural sciences?|natural science)\b/i },
  { category: "AH", sourceCategoryCode: "A&H", pattern: /\b(?:A\s*&\s*H|arts?\s+(?:and|&)\s+humanities|humanities|fine arts?)\b/i },
  { category: "SSC", sourceCategoryCode: "SSc", pattern: /\b(?:S\s*Sc|social sciences?)\b/i },
  { category: "QSR", sourceCategoryCode: "QSR", pattern: /\bQSR\b|\bquantitative and symbolic reasoning\b/i },
  { category: "VLPA", sourceCategoryCode: "VLPA", pattern: /\bVLPA\b|\bvisual,\s*literary,\s*and\s*performing arts\b/i },
  { category: "DIV", sourceCategoryCode: "DIV", pattern: /\bDIV\b|\bdiversity\b/i },
  { category: "NW", sourceCategoryCode: "NW", pattern: /\bNW\b|\bnatural world\b/i },
  { category: "IANDS", sourceCategoryCode: "I&S", pattern: /\bI\s*&\s*S\b|\bindividuals\s+and\s+societies\b/i },
];

export function getCategoryOptionAuditDescriptor(text: string | null | undefined) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return CATEGORY_OPTION_AUDIT_PATTERNS.find((entry) => entry.pattern.test(normalized)) ?? null;
}

let guideBackedTransferCategoryTags: Set<string> | null = null;

function getGuideBackedTransferCategoryTags() {
  guideBackedTransferCategoryTags ??= new Set(
    getTransferPlannerAllEquivalencyRules()
      .filter(
        (rule) =>
          rule.sourceSchoolId === "grc" &&
          GUIDE_BACKED_EQUIVALENCY_RULE_KINDS.has(rule.sourceKind ?? "") &&
          rule.acceptanceCategory !== "no-credit" &&
          rule.type !== "no-credit"
      )
      .flatMap((rule) => getEvaluationTargetRequirementTags(rule))
      .map((tag) => normalizeGeneralEducationRequirementTag(tag))
      .filter(Boolean)
  );
  return guideBackedTransferCategoryTags;
}

export function getGuideBackedTransferCategoryOptionDescriptor(
  text: string | null | undefined
) {
  const descriptor = getCategoryOptionAuditDescriptor(text);
  if (!descriptor) return null;
  return getGuideBackedTransferCategoryTags().has(descriptor.category)
    ? descriptor
    : null;
}

export function isSpecificTransferTargetCourseCode(courseCode: string) {
  return !/\b\dXX(?:\.\d+)?[A-Z]?\b/i.test(String(courseCode ?? "").trim());
}

function getTransferGuidanceRuleStatusScore(rule: TransferPlannerEquivalencyRule) {
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

function getTransferGuidanceRuleAcceptanceScore(rule: TransferPlannerEquivalencyRule) {
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

function getTransferGuidanceRuleTypeScore(rule: TransferPlannerEquivalencyRule) {
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

export function compareTransferGuidanceRules(
  left: TransferPlannerEquivalencyRule,
  right: TransferPlannerEquivalencyRule
) {
  const statusDelta =
    getTransferGuidanceRuleStatusScore(right) - getTransferGuidanceRuleStatusScore(left);
  if (statusDelta !== 0) return statusDelta;

  const acceptanceDelta =
    getTransferGuidanceRuleAcceptanceScore(right) -
    getTransferGuidanceRuleAcceptanceScore(left);
  if (acceptanceDelta !== 0) return acceptanceDelta;

  const typeDelta = getTransferGuidanceRuleTypeScore(right) - getTransferGuidanceRuleTypeScore(left);
  if (typeDelta !== 0) return typeDelta;

  const targetCodeCountDelta =
    (left.targetCourseCodes?.length ?? Number.MAX_SAFE_INTEGER) -
    (right.targetCourseCodes?.length ?? Number.MAX_SAFE_INTEGER);
  if (targetCodeCountDelta !== 0) return targetCodeCountDelta;

  return left.id.localeCompare(right.id);
}

export function ruleMatchesExactSourceCourseSet(
  rule: TransferPlannerEquivalencyRule,
  explicitCourseCodes: string[]
) {
  const normalizedExplicitCourseCodes = sortCourseCodes(
    explicitCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
  if (!normalizedExplicitCourseCodes.length) return false;

  return (rule.sourceCourseSets ?? []).some((courseSet) => {
    const normalizedRuleCourseSet = sortCourseCodes(
      (courseSet ?? []).map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
    );

    return (
      normalizedRuleCourseSet.length === normalizedExplicitCourseCodes.length &&
      normalizedRuleCourseSet.every(
        (courseCode, index) => courseCode === normalizedExplicitCourseCodes[index]
      )
    );
  });
}

export function getSubsetMatchCompanionCourseCodes(
  rule: TransferPlannerEquivalencyRule,
  explicitCourseCodes: string[],
  satisfiedCourseCodes: string[] = []
) {
  const normalizedExplicitCourseCodes = sortCourseCodes(
    explicitCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
  if (!normalizedExplicitCourseCodes.length) return null;

  const normalizedExplicitCourseCodeSet = new Set(normalizedExplicitCourseCodes);
  const normalizedSatisfiedCourseCodeSet = new Set(
    satisfiedCourseCodes.map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
  );
  const companionOptions = (rule.sourceCourseSets ?? [])
    .map((courseSet) =>
      sortCourseCodes(
        (courseSet ?? []).map((courseCode) => normalizeCourseCode(courseCode)).filter(Boolean)
      )
    )
    .filter(
      (normalizedRuleCourseSet) =>
        normalizedRuleCourseSet.length > normalizedExplicitCourseCodes.length &&
        normalizedExplicitCourseCodes.every((courseCode) =>
          normalizedRuleCourseSet.includes(courseCode)
        )
    )
    .map((normalizedRuleCourseSet) => {
      const allCompanionCourseCodes = normalizedRuleCourseSet.filter(
        (courseCode) => !normalizedExplicitCourseCodeSet.has(courseCode)
      );
      const unsatisfiedCompanionCourseCodes = allCompanionCourseCodes.filter(
        (courseCode) => !normalizedSatisfiedCourseCodeSet.has(courseCode)
      );
      const displayCompanionCourseCodes = unsatisfiedCompanionCourseCodes.length
        ? unsatisfiedCompanionCourseCodes
        : allCompanionCourseCodes;
      return {
        normalizedRuleCourseSet,
        allCompanionCourseCodes,
        displayCompanionCourseCodes,
      };
    })
    .filter((option) => option.displayCompanionCourseCodes.length > 0)
    .sort((left, right) => {
      const displayLengthDelta =
        left.displayCompanionCourseCodes.length - right.displayCompanionCourseCodes.length;
      if (displayLengthDelta !== 0) return displayLengthDelta;

      const allLengthDelta =
        left.allCompanionCourseCodes.length - right.allCompanionCourseCodes.length;
      if (allLengthDelta !== 0) return allLengthDelta;

      const displayLabelDelta = left.displayCompanionCourseCodes
        .join("|")
        .localeCompare(right.displayCompanionCourseCodes.join("|"));
      if (displayLabelDelta !== 0) return displayLabelDelta;

      return left.normalizedRuleCourseSet.join("|").localeCompare(right.normalizedRuleCourseSet.join("|"));
    });

  return companionOptions[0]?.displayCompanionCourseCodes ?? null;
}

export function getTransferGuidanceCandidateRulesForSourceCourse(
  sourceCourseCode: string,
  campusId: TransferPlannerMajorPlan["campusId"]
) {
  const allCandidateRules = getTransferPlannerEquivalencyRulesForSourceCourse(sourceCourseCode)
    .filter((rule) => GUIDE_BACKED_EQUIVALENCY_RULE_KINDS.has(rule.sourceKind ?? ""))
    .filter((rule) => rule.acceptanceCategory !== "no-credit")
    .filter((rule) => !rule.isObsoleteSourceCourse)
    .filter((rule) => (rule.targetCourseCodes ?? []).length > 0);

  const campusScopedRules = allCandidateRules.filter((rule) =>
    rule.targetSchoolIds.includes(campusId)
  );
  if (campusScopedRules.length || campusId === "uw-seattle") {
    return campusScopedRules;
  }

  return allCandidateRules.filter((rule) => rule.targetSchoolIds.includes("uw-seattle"));
}

function ruleCanBackCampusTarget(
  rule: TransferPlannerEquivalencyRule,
  campusId: TransferPlannerMajorPlan["campusId"]
) {
  return (
    rule.targetSchoolIds.includes(campusId) ||
    (campusId !== "uw-seattle" && rule.targetSchoolIds.includes("uw-seattle"))
  );
}

function getGrcEquivalentPathIndexForCampus(campusId: TransferPlannerMajorPlan["campusId"]) {
  const cached = GRC_EQUIVALENT_PATH_INDEX_BY_CAMPUS.get(campusId);
  if (cached) {
    return cached;
  }

  const index = new Map<string, GrcEquivalentPathCandidate[]>();
  for (const rule of getTransferPlannerAllEquivalencyRules()) {
    if (
      rule.sourceSchoolId !== "grc" ||
      !GUIDE_BACKED_EQUIVALENCY_RULE_KINDS.has(rule.sourceKind ?? "") ||
      rule.acceptanceCategory === "no-credit" ||
      rule.type === "no-credit" ||
      rule.isObsoleteSourceCourse ||
      !ruleCanBackCampusTarget(rule, campusId)
    ) {
      continue;
    }

    const targetCourseCodes = (rule.targetCourseCodes ?? [])
      .map((targetCourseCode) => normalizeCourseCode(targetCourseCode))
      .filter(isSpecificTransferTargetCourseCode);
    if (!targetCourseCodes.length) {
      continue;
    }

    for (const sourceCourseSet of rule.sourceCourseSets ?? []) {
      const pathCourseCodes = unique(
        sourceCourseSet
          .map((courseCode) => normalizeCourseCode(courseCode))
          .filter((courseCode) => Boolean(courseCode))
      );
      if (
        !pathCourseCodes.length ||
        pathCourseCodes.length !== sourceCourseSet.length ||
        !pathCourseCodes.every((courseCode) =>
          Boolean(getTransferPlannerCanonicalCourse("grc", courseCode))
        )
      ) {
        continue;
      }

      for (const targetCourseCode of targetCourseCodes) {
        const candidates = index.get(targetCourseCode) ?? [];
        candidates.push({
          pathCourseCodes,
          rule,
          targetCourseCode,
        });
        index.set(targetCourseCode, candidates);
      }
    }
  }

  for (const [targetCourseCode, candidates] of index) {
    index.set(
      targetCourseCode,
      candidates.sort((left, right) => {
        const lengthDelta = left.pathCourseCodes.length - right.pathCourseCodes.length;
        if (lengthDelta !== 0) return lengthDelta;

        const ruleDelta = compareTransferGuidanceRules(left.rule, right.rule);
        if (ruleDelta !== 0) return ruleDelta;

        return left.pathCourseCodes.join("|").localeCompare(right.pathCourseCodes.join("|"));
      })
    );
  }

  GRC_EQUIVALENT_PATH_INDEX_BY_CAMPUS.set(campusId, index);
  return index;
}

export function getCourseLevel(courseCode: string) {
  const match = normalizeCourseCode(courseCode).match(/(\d{3})[A-Z]?$/);
  return match ? Number(match[1]) : null;
}

function isLowerDivisionCourseCode(courseCode: string) {
  const level = getCourseLevel(courseCode);
  return level !== null && level < 300;
}

export function getCourseSubject(courseCode: string) {
  return normalizeCourseCode(courseCode).match(/^([A-Z&]+(?: [A-Z&]+)*)\s+\d/)?.[1] ?? null;
}

export function getSourceBackedRequiredCourseSemanticRelations(
  courseCode: string,
  schoolId: "grc" | TransferPlannerMajorPlan["campusId"] = "grc"
) {
  const relationGroups = getSourceBackedRequiredCourseSemanticRelationGroups(
    courseCode,
    schoolId
  );
  return unique([...relationGroups.equivalent, ...relationGroups.overlap]);
}

function getSourceBackedRequiredCourseSemanticRelationGroups(
  courseCode: string,
  schoolId: "grc" | TransferPlannerMajorPlan["campusId"] = "grc"
) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  if (!normalizedCourseCode) {
    return { equivalent: [] as string[], overlap: [] as string[] };
  }

  const cacheKey = `${schoolId}|${normalizedCourseCode}`;
  const groupedCached = REQUIRED_COURSE_SEMANTIC_RELATION_GROUP_CACHE.get(cacheKey);
  if (groupedCached) {
    return groupedCached;
  }

  const cached = REQUIRED_COURSE_SEMANTIC_RELATION_CACHE.get(cacheKey);
  if (cached) {
    return { equivalent: cached, overlap: [] as string[] };
  }

  const metadata =
    getTransferPlannerCanonicalCourse(schoolId, normalizedCourseCode) ??
    (schoolId === "grc"
      ? null
      : getTransferPlannerCanonicalCourse("uw-seattle", normalizedCourseCode));
  const extractRelationCodes = (pattern: RegExp) =>
    unique(
      Array.from(String(metadata?.catalogDescription ?? "").matchAll(pattern))
        .flatMap((match) => extractCourseCodes(match[1] ?? ""))
        .map((relatedCourseCode) => normalizeCourseCode(relatedCourseCode))
        .filter(
          (relatedCourseCode) =>
            relatedCourseCode &&
            relatedCourseCode !== normalizedCourseCode &&
            isLowerDivisionCourseCode(relatedCourseCode) &&
            isSpecificTransferTargetCourseCode(relatedCourseCode)
        )
    );
  const relationGroups = {
    equivalent: extractRelationCodes(REQUIRED_COURSE_EQUIVALENT_RELATION_PATTERN),
    overlap: extractRelationCodes(REQUIRED_COURSE_OVERLAP_RELATION_PATTERN),
  };
  const relatedCourseCodes = unique(
    Array.from(
      String(metadata?.catalogDescription ?? "").matchAll(
        REQUIRED_COURSE_SEMANTIC_RELATION_PATTERN
      )
    )
      .flatMap((match) => extractCourseCodes(match[1] ?? ""))
      .map((relatedCourseCode) => normalizeCourseCode(relatedCourseCode))
      .filter(
        (relatedCourseCode) =>
          relatedCourseCode &&
          relatedCourseCode !== normalizedCourseCode &&
          isLowerDivisionCourseCode(relatedCourseCode) &&
          isSpecificTransferTargetCourseCode(relatedCourseCode)
      )
  );

  REQUIRED_COURSE_SEMANTIC_RELATION_CACHE.set(cacheKey, relatedCourseCodes);
  REQUIRED_COURSE_SEMANTIC_RELATION_GROUP_CACHE.set(cacheKey, relationGroups);
  return relationGroups;
}

function getRequiredUwCourseCodeTransferTargetAliases(
  uwCourseCode: string,
  campusId: TransferPlannerMajorPlan["campusId"],
  availableTargetCourseCodes?: Set<string>
) {
  const normalizedUwCourseCode = normalizeCourseCode(uwCourseCode);
  if (!normalizedUwCourseCode) {
    return [] as string[];
  }

  const relationGroups = getSourceBackedRequiredCourseSemanticRelationGroups(
    normalizedUwCourseCode,
    campusId
  );
  const exactAndEquivalentCourseCodes = unique([
    normalizedUwCourseCode,
    ...relationGroups.equivalent,
  ])
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter(isSpecificTransferTargetCourseCode);
  const hasExactOrEquivalentMapping = availableTargetCourseCodes
    ? exactAndEquivalentCourseCodes.some((courseCode) =>
        availableTargetCourseCodes.has(courseCode)
      )
    : exactAndEquivalentCourseCodes.length > 1;

  return unique(
    [
      ...exactAndEquivalentCourseCodes,
      ...(hasExactOrEquivalentMapping ? [] : relationGroups.overlap),
    ]
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(isSpecificTransferTargetCourseCode)
  );
}

export function buildBestSingleCourseUwEquivalentCourseCodes(
  sourceCourseCode: string,
  campusId: TransferPlannerMajorPlan["campusId"] | null | undefined
) {
  const normalizedSourceCourseCode = normalizeCourseCode(sourceCourseCode);
  if (!campusId || !normalizedSourceCourseCode) {
    return [] as string[];
  }

  const candidateRules = getTransferGuidanceCandidateRulesForSourceCourse(
    normalizedSourceCourseCode,
    campusId
  )
    .filter((rule) =>
      (rule.sourceCourseSets ?? []).some((courseSet) => {
        const normalizedCourseSet = courseSet.map((courseCode) =>
          normalizeCourseCode(courseCode)
        );
        return (
          normalizedCourseSet.length === 1 &&
          normalizedCourseSet[0] === normalizedSourceCourseCode
        );
      })
    )
    .sort(compareTransferGuidanceRules);

  const selectedRule = candidateRules[0];
  if (!selectedRule) {
    return [] as string[];
  }

  return unique(
    (selectedRule.targetCourseCodes ?? [])
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(isSpecificTransferTargetCourseCode)
  );
}

export function getPlanGrcCourseCodes(plan: TransferPlannerMajorPlan | null | undefined) {
  return sortCourseCodes(
    getTransferPlannerGrcCourseList(plan)
      .flatMap((label) => extractCourseCodes(label))
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter((courseCode) =>
        Boolean(courseCode && getTransferPlannerCanonicalCourse("grc", courseCode))
      )
      .filter(Boolean)
  );
}

export function getCandidateGrcEquivalentPathCourseCodesForUwCourse(
  plan: TransferPlannerMajorPlan | null | undefined,
  uwCourseCode: string
) {
  if (!plan) {
    return [] as string[][];
  }

  const normalizedUwCourseCode = normalizeCourseCode(uwCourseCode);
  if (!normalizedUwCourseCode) {
    return [] as string[][];
  }

  const planGrcCourseCodes = new Set(getPlanGrcCourseCodes(plan));
  const reverseIndex = getGrcEquivalentPathIndexForCampus(plan.campusId);
  const reverseIndexTargetCourseCodes = new Set(reverseIndex.keys());
  const targetAliases = getRequiredUwCourseCodeTransferTargetAliases(
    normalizedUwCourseCode,
    plan.campusId,
    reverseIndexTargetCourseCodes
  );
  const candidatePathsByKey = new Map<string, string[]>();
  const registerCandidatePath = (pathCourseCodes: string[]) => {
    if (
      !pathCourseCodes.length ||
      !pathCourseCodes.every((courseCode) =>
        Boolean(getTransferPlannerCanonicalCourse("grc", courseCode))
      )
    ) {
      return;
    }

    candidatePathsByKey.set(pathCourseCodes.join("|"), pathCourseCodes);
  };

  for (const sourceCourseCode of planGrcCourseCodes) {
    for (const rule of getTransferGuidanceCandidateRulesForSourceCourse(sourceCourseCode, plan.campusId)) {
      const targetCourseCodes = (rule.targetCourseCodes ?? [])
        .map((targetCourseCode) => normalizeCourseCode(targetCourseCode))
        .filter(Boolean);
      if (!targetCourseCodes.some((targetCourseCode) => targetAliases.includes(targetCourseCode))) {
        continue;
      }

      for (const sourceCourseSet of rule.sourceCourseSets ?? []) {
        const pathCourseCodes = unique(
          sourceCourseSet
            .map((courseCode) => normalizeCourseCode(courseCode))
            .filter((courseCode) => Boolean(courseCode))
        );
        if (
          !pathCourseCodes.length ||
          pathCourseCodes.length !== sourceCourseSet.length ||
          !pathCourseCodes.includes(sourceCourseCode)
        ) {
          continue;
        }

        registerCandidatePath(pathCourseCodes);
      }
    }
  }

  for (const targetCourseCode of targetAliases) {
    for (const candidate of reverseIndex.get(targetCourseCode) ?? []) {
      registerCandidatePath(candidate.pathCourseCodes);
    }
  }

  return [...candidatePathsByKey.values()].sort((left, right) => {
    const lengthDelta = left.length - right.length;
    if (lengthDelta !== 0) return lengthDelta;

    return left.join("|").localeCompare(right.join("|"));
  });
}

export function getBestGrcEquivalentPathCourseCodesForUwCourse(
  plan: TransferPlannerMajorPlan | null | undefined,
  uwCourseCode: string
) {
  const candidatePaths = getCandidateGrcEquivalentPathCourseCodesForUwCourse(plan, uwCourseCode);

  return candidatePaths[0] ?? [];
}

export function buildBestRequiredUwEquivalentCourseCodes(
  sourceCourseCode: string,
  plan: TransferPlannerMajorPlan | null | undefined,
  requiredUwCourseCodes: Set<string>
) {
  const singleCourseTargets = buildBestSingleCourseUwEquivalentCourseCodes(
    sourceCourseCode,
    plan?.campusId
  );
  if (!plan || !requiredUwCourseCodes.size) {
    return singleCourseTargets;
  }

  const normalizedSourceCourseCode = normalizeCourseCode(sourceCourseCode);
  const pathTargets = [...requiredUwCourseCodes].filter((uwCourseCode) =>
    getBestGrcEquivalentPathCourseCodesForUwCourse(plan, uwCourseCode).includes(
      normalizedSourceCourseCode
    )
  );

  return unique([...singleCourseTargets, ...pathTargets]);
}

export function buildRequiredUwCourseCodesCompletedBySourceCourse(
  sourceCourseCode: string,
  plan: TransferPlannerMajorPlan | null | undefined,
  requiredUwCourseCodes: Set<string>
) {
  if (!plan) {
    return buildBestSingleCourseUwEquivalentCourseCodes(sourceCourseCode, undefined);
  }

  const normalizedSourceCourseCode = normalizeCourseCode(sourceCourseCode);
  return buildBestRequiredUwEquivalentCourseCodes(sourceCourseCode, plan, requiredUwCourseCodes)
    .filter((uwCourseCode) => {
      const pathCourseCodes = getBestGrcEquivalentPathCourseCodesForUwCourse(plan, uwCourseCode);
      return (
        pathCourseCodes.length <= 1 ||
        pathCourseCodes[pathCourseCodes.length - 1] === normalizedSourceCourseCode
      );
    });
}

export function isUwTransferPlannerPlan(plan: TransferPlannerMajorPlan | null | undefined) {
  return String(plan?.campusId ?? "").startsWith("uw-");
}

export function hasConcreteGrcCourseCode(courseCode: string) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  return Boolean(
    normalizedCourseCode &&
      getTransferPlannerCanonicalCourse("grc", normalizedCourseCode)
  );
}

function hasGuideBackedGrcSourceCourseCode(courseCode: string) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  if (!normalizedCourseCode) {
    return false;
  }

  return getTransferPlannerEquivalencyRulesForSourceCourse(normalizedCourseCode).some(
    (rule) =>
      rule.sourceSchoolId === "grc" &&
      GUIDE_BACKED_EQUIVALENCY_RULE_KINDS.has(rule.sourceKind ?? "") &&
      rule.type !== "no-credit" &&
      rule.acceptanceCategory !== "no-credit" &&
      rule.ruleStatus !== "deprecated" &&
      !rule.isObsoleteSourceCourse
  );
}

export function hasSourceBackedGrcEquivalentForUwCourse(
  uwCourseCode: string,
  plan: TransferPlannerMajorPlan | null | undefined
) {
  const normalizedUwCourseCode = normalizeCourseCode(uwCourseCode);
  if (!normalizedUwCourseCode || !isUwTransferPlannerPlan(plan)) {
    return false;
  }

  return getPlanGrcCourseCodes(plan).some((sourceCourseCode) =>
    buildBestSingleCourseUwEquivalentCourseCodes(sourceCourseCode, plan?.campusId).includes(
      normalizedUwCourseCode
    )
  );
}

export function hasVisibleGrcCourseOrEquivalent(
  courseCodes: string[],
  plan: TransferPlannerMajorPlan | null | undefined
) {
  return courseCodes.some((courseCode) => {
    const normalizedCourseCode = normalizeCourseCode(courseCode);
    return (
      hasConcreteGrcCourseCode(normalizedCourseCode) ||
      hasGuideBackedGrcSourceCourseCode(normalizedCourseCode) ||
      getPlanGrcCourseCodes(plan).includes(normalizedCourseCode) ||
      hasSourceBackedGrcEquivalentForUwCourse(normalizedCourseCode, plan)
    );
  });
}
