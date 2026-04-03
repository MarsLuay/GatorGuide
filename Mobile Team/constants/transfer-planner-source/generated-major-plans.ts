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
} from "../transfer-planner-data";
import {
  TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY,
  TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY,
  TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY,
  TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY,
  TRANSFER_PLANNER_POLICY_REGISTRY,
} from "./registry";
import type {
  TransferPlannerDegreeMapBlock,
  TransferPlannerMajorPathwayEntry,
  TransferPlannerMajorRequirementAtom,
  TransferPlannerPolicyEntry,
  TransferPlannerRequirementPhase,
  TransferPlannerSourceLink,
} from "./schema";

const STRUCTURED_GRC_SOURCE_KINDS = new Set(["plan-checklist", "plan-course-list", "master-bank"]);
const REFERENCE_COURSE_CODE_PATTERN = /\b[A-Z]{2,8}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;
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
const AUTO_FALLBACK_CORE_LABEL_PATTERN =
  /\b(MATH|PHYS|CHEM|BIOL|ENGR|CS|STAT|ECON|ENGL|CMST|GIS|GEOG|LANG|JAPN|CHIN|SPAN|FRCH|GERM|LATIN|GREEK|MUSC|ART|DESN|DRMA)\b/i;

type PathwayPlanKey = `${string}::${string}`;

function makePathwayPlanKey(planId: string, pathwayId: string | null | undefined) {
  return `${planId}::${String(pathwayId ?? "")}` as PathwayPlanKey;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
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
  return String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
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

function getChecklistReferenceCourses(plan: TransferPlannerMajorPlan) {
  return getChecklistReferenceCoursesFromItems([
    ...plan.applicationChecklist,
    ...plan.beforeEnrollmentChecklist,
    ...plan.stayAtGrcChecklist,
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

function buildChecklistItem(atom: TransferPlannerMajorRequirementAtom): TransferPlannerChecklistItem {
  return {
    id: extractLeafId(atom.id),
    title: atom.title,
    grcCourses: [...atom.grcCourseCodes],
    alternatives: atom.alternativeCourseCodeSets.length
      ? atom.alternativeCourseCodeSets.map((group) => [...group])
      : undefined,
    note: atom.note,
    minCompletedCount: atom.minCompletedCount ?? undefined,
  };
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
      note:
        "Auto-generated from the current degree-specific Green River class list because this major does not have a hand-authored checklist yet.",
    }));
  }

  const explicitGuidance = String(scope.grcCourseListGuidance ?? "").trim();
  return [
    {
      id: "auto-custom-prep",
      title: "Advisor-approved custom Green River prep",
      grcCourses: [],
      note:
        explicitGuidance ||
        "Use the current degree-specific planner guidance as your custom Green River prep starting point, then confirm the exact class mix with an advisor.",
    },
  ] satisfies TransferPlannerChecklistItem[];
}

function collectPlannerCourseLabels(scope: {
  grcCourseList?: string[];
  applicationChecklist?: TransferPlannerChecklistItem[];
  beforeEnrollmentChecklist?: TransferPlannerChecklistItem[];
  stayAtGrcChecklist?: TransferPlannerChecklistItem[];
}) {
  return uniqueReferenceCourseLabels([
    ...(scope.grcCourseList ?? []),
    ...getChecklistReferenceCoursesFromItems([
      ...(scope.applicationChecklist ?? []),
      ...(scope.beforeEnrollmentChecklist ?? []),
      ...(scope.stayAtGrcChecklist ?? []),
    ]),
  ]);
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

function buildTrackReferenceCourseCodes(track: TransferPlannerTrack) {
  return uniqueReferenceCourseLabels(
    [
      ...track.terms.flatMap((term) => term.courses),
      ...(track.catalogYears ?? []).flatMap((catalogYear) => [
        ...catalogYear.terms.flatMap((term) => term.courses),
        ...(catalogYear.slotExpansions ?? []).flatMap((slot) => slot.recommendedCourses),
      ]),
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
  return `Use ${track.code} as the main Green River transfer-degree backbone for aid and degree-planning purposes, then layer the remaining major-specific classes on top with advisor review.`;
}

export function getTransferPlannerAutoMatchedTrackRecommendation(
  grcCourseList: string[],
  preferredTrackId: string | null = null
): TransferPlannerAutoMatchedTrackRecommendation | null {
  const normalizedCourseLabels = uniqueReferenceCourseLabels(grcCourseList);
  const planCourseCodes = uniqueReferenceCourseLabels(
    normalizedCourseLabels.flatMap((label) => extractReferenceCourseCodes(label))
  );

  if (planCourseCodes.length < MIN_AUTO_TRACK_MATCH_COUNT) {
    return null;
  }

  const planCourseCodeSet = new Set(planCourseCodes);
  const labelByCode = buildReferenceLabelByCode(normalizedCourseLabels);
  const scoredTracks = TRANSFER_PLANNER_BOOTSTRAP_TRACKS.map((track) => {
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
  }).filter((entry) => entry.matchCount >= MIN_AUTO_TRACK_MATCH_COUNT);

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
}>(scope: T): T {
  if (hasAnyChecklistItems(scope)) {
    return scope;
  }

  return {
    ...scope,
    stayAtGrcChecklist: buildAutoFallbackChecklist({
      planId: scope.id,
      bestTrackId: scope.bestTrackId,
      grcCourseList: scope.grcCourseList ?? [],
      grcCourseListGuidance: scope.grcCourseListGuidance,
    }),
  };
}

function buildDegreeMapSection(block: TransferPlannerDegreeMapBlock): TransferPlannerDegreeMapSection {
  return {
    id: extractLeafId(block.id),
    title: block.title,
    items: [...block.itemLabels],
    note: block.note,
  };
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
  const filteredCodes = TRANSFER_PLANNER_CANONICAL_COURSE_REGISTRY.filter(
    (entry) =>
      entry.schoolId === "grc" &&
      entry.referencedByPlanIds.includes(planId) &&
      entry.sourceKinds.some((kind) => STRUCTURED_GRC_SOURCE_KINDS.has(kind)) &&
      (pathwayId
        ? entry.sourceContexts.some((context) => context.includes(`:pathway:${pathwayId}:`))
        : !entry.sourceContexts.some((context) => context.includes(":pathway:")))
  ).map((entry) => entry.code);

  return orderStringsByBase(uniquePlannerStrings([...baseCourseOrder, ...filteredCodes]), baseCourseOrder);
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
    return baseItems.map((item) => ({
      ...item,
      grcCourses: [...item.grcCourses],
      alternatives: item.alternatives?.map((group) => [...group]),
    }));
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
    return baseSections?.map((section) => ({
      ...section,
      items: [...section.items],
    }));
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
    summary: registryPathway?.summary ?? basePathway.summary,
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
    advisorFlags: [...(policy?.advisorFlags ?? basePathway.advisorFlags ?? [])],
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
    manualReviewNotes: collectStructuredValidationNotes(
      basePlan.id,
      basePathway.manualReviewNotes ?? basePlan.manualReviewNotes ?? [],
      basePathway.id
    ),
    grcCourseList: getStructuredCourseCodesForPlan(
      basePlan.id,
      basePathway.grcCourseList ?? [],
      basePathway.id
    ),
    grcCourseListGuidance:
      policy?.grcCourseListGuidance ?? basePathway.grcCourseListGuidance,
    plannerNote: policy?.plannerNote ?? basePathway.plannerNote,
    bestTrackId:
      policy?.bestTrackId === undefined ? basePathway.bestTrackId : policy.bestTrackId,
    bestTrackSummary: policy?.bestTrackSummary ?? basePathway.bestTrackSummary,
    whyThisTrack:
      policy?.whyThisTrack.length ? [...policy.whyThisTrack] : [...(basePathway.whyThisTrack ?? [])],
    financialAidNote: policy?.financialAidNote ?? basePathway.financialAidNote,
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
    bestTrackId: policy?.bestTrackId ?? basePlan.bestTrackId,
    bestTrackSummary: policy?.bestTrackSummary ?? basePlan.bestTrackSummary,
    whyThisTrack: policy?.whyThisTrack.length
      ? [...policy.whyThisTrack]
      : [...basePlan.whyThisTrack],
    financialAidNote: policy?.financialAidNote ?? basePlan.financialAidNote,
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
    advisorFlags: [...(policy?.advisorFlags ?? basePlan.advisorFlags)],
    involvementIdeas: [...(policy?.involvementIdeas ?? basePlan.involvementIdeas)],
    projectIdeas: [...(policy?.projectIdeas ?? basePlan.projectIdeas)],
    officialLinks: collectStructuredLinks(basePlan.id, basePlan.officialLinks),
    degreeMapSections: buildDegreeMapSections(basePlan.id, basePlan.degreeMapSections),
    manualReviewNotes: collectStructuredValidationNotes(
      basePlan.id,
      basePlan.manualReviewNotes ?? []
    ),
    grcCourseList: getStructuredCourseCodesForPlan(
      basePlan.id,
      basePlan.grcCourseList ?? []
    ),
    grcCourseListGuidance:
      policy?.grcCourseListGuidance ?? basePlan.grcCourseListGuidance,
    plannerNote: policy?.plannerNote ?? basePlan.plannerNote,
    pathways: orderByBaseIds(
      (basePlan.pathways ?? []).map((pathway) => buildPathway(basePlan, pathway)),
      (basePlan.pathways ?? []).map((pathway) => pathway.id)
    ),
  }));
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
    advisorFlags: uniquePlannerStrings(pathway.advisorFlags ?? []),
    officialLinks: uniquePlannerLinks(pathway.officialLinks ?? []),
    manualReviewNotes: uniquePlannerStrings(pathway.manualReviewNotes ?? []),
    grcCourseListGuidance: String(pathway.grcCourseListGuidance ?? "").trim() || undefined,
    whyThisTrack: uniquePlannerStrings(pathway.whyThisTrack ?? []),
  };
}

function materializePlanPathways(plan: TransferPlannerMajorPlan) {
  return (plan.pathways ?? []).map(materializePlannerPathway);
}

function materializePlanReferenceCourses(plan: TransferPlannerMajorPlan): TransferPlannerMajorPlan {
  return {
    ...plan,
    pathways: materializePlanPathways(plan),
    grcCourseList: uniqueReferenceCourseLabels([
      ...(plan.grcCourseList ?? []),
      ...getChecklistReferenceCourses(plan),
    ]),
  };
}

function mergePlannerPathwayWithPlan(
  plan: TransferPlannerMajorPlan,
  pathway: TransferPlannerMajorPathway
): TransferPlannerResolvedMajorPlan {
  const mergedPlan = materializePlanReferenceCourses({
    ...plan,
    applicationChecklist: pathway.applicationChecklist ?? plan.applicationChecklist,
    beforeEnrollmentChecklist:
      pathway.beforeEnrollmentChecklist ?? plan.beforeEnrollmentChecklist,
    stayAtGrcChecklist: pathway.stayAtGrcChecklist ?? plan.stayAtGrcChecklist,
    advisorFlags: uniquePlannerStrings([...(plan.advisorFlags ?? []), ...(pathway.advisorFlags ?? [])]),
    officialLinks: uniquePlannerLinks([...(plan.officialLinks ?? []), ...(pathway.officialLinks ?? [])]),
    degreeMapSections: pathway.degreeMapSections ?? plan.degreeMapSections,
    manualReviewNotes: uniquePlannerStrings([
      ...(plan.manualReviewNotes ?? []),
      ...(pathway.manualReviewNotes ?? []),
    ]),
    grcCourseListGuidance: pathway.grcCourseListGuidance ?? plan.grcCourseListGuidance,
    grcCourseList:
      pathway.grcCourseList && pathway.grcCourseList.length
        ? pathway.grcCourseList
        : plan.grcCourseList,
    plannerNote: pathway.plannerNote ?? plan.plannerNote,
    bestTrackId: pathway.bestTrackId === undefined ? plan.bestTrackId : pathway.bestTrackId,
    bestTrackSummary: pathway.bestTrackSummary ?? plan.bestTrackSummary,
    whyThisTrack: pathway.whyThisTrack?.length ? pathway.whyThisTrack : plan.whyThisTrack,
    financialAidNote: pathway.financialAidNote ?? plan.financialAidNote,
  });

  return {
    ...mergedPlan,
    pathways: materializePlanPathways(plan),
    selectedPathwayId: pathway.id,
    selectedPathwayLabel: pathway.label,
    selectedPathwaySummary: pathway.summary,
  };
}

const TRACKS_BY_ID = new Map(
  TRANSFER_PLANNER_BOOTSTRAP_TRACKS.map((track) => [track.id, track] as const)
);
const TRACK_REFERENCE_CODES_BY_ID = new Map(
  TRANSFER_PLANNER_BOOTSTRAP_TRACKS.map((track) => [track.id, buildTrackReferenceCourseCodes(track)] as const)
);

const CHAINS_BY_ID = new Map(
  TRANSFER_PLANNER_MASTER_CHAIN_LIBRARY.map((chain) => [chain.id, chain] as const)
);

const GRC_AVAILABILITY_BY_CODE = TRANSFER_PLANNER_GRC_COURSE_AVAILABILITY as Record<
  string,
  TransferPlannerGrcCourseAvailabilityEntry
>;

export const TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS: TransferPlannerMajorPlan[] =
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.map(buildSourceGeneratedPlan);

export const TRANSFER_PLANNER_CAMPUSES: TransferPlannerCampus[] = TRANSFER_PLANNER_BOOTSTRAP_CAMPUSES;
export const TRANSFER_PLANNER_TRACKS: TransferPlannerTrack[] = TRANSFER_PLANNER_BOOTSTRAP_TRACKS;

export function getTransferPlannerSourceGeneratedMajorsForCampus(
  campusId: TransferPlannerCampusId
) {
  return TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.filter(
    (plan) => plan.campusId === campusId
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

export function getTransferPlannerPathwaysForPlan(
  plan: TransferPlannerMajorPlan | null | undefined
) {
  if (!plan?.pathways?.length) return [] as TransferPlannerMajorPathway[];
  return materializePlanPathways(plan);
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

  const selectedPathway = pathways.find((entry) => entry.id === pathwayId) ?? pathways[0] ?? null;
  if (!selectedPathway) {
    return {
      ...materializePlanReferenceCourses(plan),
      pathways,
      selectedPathwayId: null,
      selectedPathwayLabel: null,
      selectedPathwaySummary: null,
    };
  }

  return mergePlannerPathwayWithPlan(plan, selectedPathway);
}

export function getTransferPlannerGrcCourseList(
  plan: TransferPlannerMajorPlan | TransferPlannerResolvedMajorPlan | null | undefined
) {
  if (!plan) return [] as string[];

  return uniqueReferenceCourseLabels(plan.grcCourseList ?? getChecklistReferenceCourses(plan));
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
      years: entry.years.map((year) => ({
        label: year.label,
        quarters: [...year.quarters],
      })),
      latestPublishedQuarters: [...entry.latestPublishedQuarters],
      note: entry.note,
    } satisfies TransferPlannerCourseAvailability;
  }

  return null;
}

export function getTransferPlannerGrcCourseAvailabilitySummary(
  courseLabel: string | null | undefined
) {
  const availability = getTransferPlannerGrcCourseAvailability(courseLabel);
  if (!availability) return null;

  const yearSummaries = availability.years
    .filter((year) => year.quarters.length > 0)
    .map(
      (year) =>
        `${year.label}: ${year.quarters
          .map((quarter) => QUARTER_LABELS[String(quarter)] ?? quarter)
          .join(", ")}`
    );

  if (yearSummaries.length) {
    return `Recent GRC annual schedule history: ${yearSummaries.join("; ")}.`;
  }

  return availability.note ?? null;
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
} from "../transfer-planner-data";
