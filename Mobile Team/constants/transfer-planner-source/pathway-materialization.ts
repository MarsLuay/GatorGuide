import type {
  TransferPlannerMajorPathway,
  TransferPlannerMajorPlan,
} from "../transfer-planner-types";
import type { TransferPlannerParsedRequirementSourceBlock } from "./schema";
import { TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS } from "./bootstrap.generated";
import { TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS } from "./primary-source-promotions.generated";
import {
  hasTransferPlannerHtmlEntityLeak,
  labelMentionsDifferentTransferPlannerMajor,
  normalizeTransferPlannerText,
  normalizeTransferPlannerSemanticPathwayLabel,
  stripTransferPlannerPlanTitlePrefix,
} from "./pathway-title-normalization";

export type TransferPlannerDerivedPathwaySeed = {
  id: string;
  label: string;
  summary: string;
};

const DERIVED_PATHWAY_LABEL_PATTERN =
  /\b(track|option|route|pathway|certificate|concentration)\b/i;
const DERIVED_PATHWAY_KIND_PATTERN =
  /\b(track|option|route|pathway|certificate|concentration)\b/i;
const DERIVED_PATHWAY_EXPLICIT_COURSE_CODE_PATTERN =
  /\b[A-Z]{2,8}(?:\/[A-Z]{2,8})?\s+\d{3}(?:\.\d+)?[A-Z]?\b/i;
const DERIVED_PATHWAY_SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);
const DERIVED_PATHWAY_ACRONYMS = new Set(["GIS", "MIS", "TIM", "UW"]);
const DERIVED_PATHWAY_GENERIC_LABEL_PATTERNS = [
  /^according to the option chosen\b/i,
  /^additional (?:admission|completion )?requirements?\b/i,
  /^advanced data science option specific requirements?\b/i,
  /^admission under\b/i,
  /^after completing\b.*\boption\b/i,
  /^all pathways\b/i,
  /^an option$/i,
  /^and the concentration coordinator\b/i,
  /^a general description of\b.*\bconcentration\b/i,
  /^begin taking\b.*\boption classes\b/i,
  /^budget analysts\b.*\boption\b/i,
  /^complete the requirements\b/i,
  /^clinical requirements?\b/i,
  /^concentration course numbers?\b/i,
  /^concentration area courses?\b/i,
  /^concentration projects?\b/i,
  /^concentration\s+[ivxlcdm]+\b(?:\s+courses?)?(?:\s*[:.]?)?$/i,
  /^(?:optional\s+)?(?:concentration|focus)\s+areas?$/i,
  /^core courses?\b/i,
  /^course lists?\b/i,
  /^course[- ]only option\b/i,
  /^create your own pathway as a separate option\b/i,
  /^curriculum and instruction\):/i,
  /^(?:examples of\s+)?coursework pathways?\b/i,
  /^degree options?\b/i,
  /^electives?\b.*\bchoose\b/i,
  /^capstone experience\b/i,
  /^choose (?:one|two|three|between|from)\b/i,
  /^choose your\b/i,
  /^contact the\b/i,
  /^degree options?\b/i,
  /^declaring an option\b/i,
  /^declaring(?: the)?\b/i,
  /^declare your major option\b/i,
  /^download\b/i,
  /^electives for\b.*\boption\b/i,
  /^formal options?\b/i,
  /^followed by\b.*\boption\b/i,
  /\bfee[- ]based\b/i,
  /^how to declare(?: the)?\b/i,
  /^joining the\b/i,
  /^me option courses?\b/i,
  /^master(?:\s+of)?\b/i,
  /^marketing management to declare\b.*\bconcentration\b/i,
  /^minimum \d/i,
  /^listed below are .*coursework pathways?\b/i,
  /^non-me courses as me option\b/i,
  /^note:?\s+prerequisites? for option\b/i,
  /^\d{1,3}(?:-\d{1,3})?\s*credits?\b/i,
  /^\d{1,3}(?:-\d{1,3})?\s+credits?\s+depending on option\b/i,
  /^option and concentration curriculum\b/i,
  /^option course numbers?\b/i,
  /^option courses?\b/i,
  /^option \d+\b/i,
  /^option-specific\b/i,
  /^or from\b.*\bconcentration\b/i,
  /^or course[- ]only option\b/i,
  /^page \d+\b/i,
  /^\(?\d+\)?\s*plan a pathway toward\b/i,
  /^please see\b.*\b(?:option page|courses? by track)\b/i,
  /^possible coursework pathways?\b/i,
  /^option[- ]specific\b/i,
  /^pathway[- ]specific\b/i,
  /^ph concentration projects?\b/i,
  /^requirements? to declare\b/i,
  /^required\b.*\boption courses?\b/i,
  /^see ["']?additional\b/i,
  /^selection of\b.*\boption\b/i,
  /^specific areas covered within\b.*\boption\b/i,
  /^supplemental official\b/i,
  /^students?.*\bmust complete\b.*\bfor graduation\b/i,
  /^this track emphasizes\b/i,
  /^this option (?:also )?requires\b/i,
  /^this option explores\b/i,
  /^the courses in\b.*\boption\b.*\bcover topics such as\b/i,
  /^the rationale for\b.*\bconcentration\b/i,
  /^teaching track faculty\b/i,
  /^tenure track\b/i,
  /^to declare\b.*\b(?:option|concentration)\b/i,
  /^to propose\b.*\bconcentration\b/i,
  /^track[- ]specific\b/i,
  /^track specific\b/i,
  /^track-specific\b/i,
  /^upon completing\b.*\boption\b/i,
  /^you have the option to\b/i,
  /^gis certificate\b.*complete all\b/i,
  /^foundation courses?\b/i,
  /^gis certificate classes\b/i,
  /^in addition to\b/i,
  /^option breadth\b/i,
  /^option[- ]specific\b/i,
  /^program requirements?\b/i,
  /^plus\b/i,
  /^students declare\b/i,
  /^the curriculum consists\b/i,
  /^why choose\b/i,
  /\bdouble major\b/i,
  /\bdouble degree\b/i,
  /\b(?:clinical|didactic) coursework\b/i,
  /\boption[- ]specific\b.*\b(?:credits?|requirements?|coursework)\b/i,
  /\b(?:option|track|concentration) course numbers?\b/i,
  /\b(?:option|track|concentration) courses?\b/i,
  /\bconcentration projects?$/i,
  /\bstudents? must complete\b.*\bfor graduation\b/i,
  /\btrack[- ]specific\b.*\b(?:credits?|requirements?|coursework)\b/i,
  /\btrack\s*\(addl\.\s*\d/i,
  /\btrack electives?\b/i,
  /\bdepending on (?:credential\/)?option\b/i,
  /\bvaries by option\b/i,
  /\bchoose thesis, project, or course-only option\b/i,
  /^for admission requirements\b.*\b(?:concentration|option|track|route|pathway)\b/i,
  /^for the\b.*\b(?:concentration|option|track|route|pathway)\b/i,
  /^(?:[†*§◊]+)?\s*if not taken\b.*\b(?:concentration|option|track|route|pathway)\b/i,
  /^concentration\s+[ivxlcdm]+\b.*\b(?:credits?|courses?)\b/i,
  /^(?:[â€ *Â§â—Š]+\s*)?route\.menu_active_trails:/i,
  /^(?:[â€ *Â§â—Š]+\s*)?route\.name\.is_layout_builder_ui\b/i,
  /^route\s+name\s+is\s+layout\s+builder\s+ui\b/i,
  /\bmenu[_-]?active[_-]?trails\b/i,
  /\blayout[_-]?builder[_-]?ui\b/i,
];
const DERIVED_PATHWAY_STRUCTURAL_ID_PATTERNS = [
  /^\d+-.*choose-one-option\b/i,
  /^option-\d+\b/i,
  /^page-\d+\b/i,
  /(?:^|[-:])option-specific(?:$|[-:])/i,
  /(?:^|[-:])track-specific(?:$|[-:])/i,
  /(?:^|[-:])pathway-specific(?:$|[-:])/i,
  /(?:^|[-:])choose-one-option(?:$|[-:])/i,
  /(?:^|[-:])choose-your(?:$|[-:])/i,
  /(?:^|[-:])choose-one(?:$|[-:])/i,
  /(?:^|[-:])declaring-an-option(?:$|[-:])/i,
  /(?:^|[-:])declaring-the(?:$|[-:])/i,
  /(?:^|[-:])how-to-declare(?:$|[-:])/i,
  /(?:^|[-:])declaration-process(?:$|[-:])/i,
  /(?:^|[-:])core-courses?(?:$|[-:])/i,
  /(?:^|[-:])program-requirements?(?:$|[-:])/i,
  /(?:^|[-:])requirements-to-declare(?:$|[-:])/i,
  /(?:^|[-:])see-additional(?:$|[-:])/i,
  /(?:^|[-:])depending-on(?:$|[-:])/i,
  /(?:^|[-:])varies-by(?:$|[-:])/i,
  /(?:^|[-:])minimum-\d/i,
  /^\d{1,3}(?:-\d{1,3})?-credits/i,
  /^choose-thesis-project-or-course-only-option/i,
  /^transfer-students-apply-for-admission-under-this-pathway/i,
  /^route-menu-active-trails(?:$|[-:])/i,
  /^route-name-is-layout-builder-ui(?:$|[-:])/i,
];
const DERIVED_PATHWAY_GUIDANCE_SOURCE_LINE_PATTERNS = [
  /\bfor advice on choosing\b/i,
  /\bhelp students acquire and articulate\b/i,
  /\bmay benefit from completing\b/i,
  /\bmay combine various interests\b/i,
  /\bnot listed on the transcript\b/i,
  /\bnot meant to be the only pathway options\b/i,
  /\bplease check out\b/i,
  /\bwhich is detailed at\b/i,
];
const DERIVED_PATHWAY_DEGREE_TITLE_PATTERN =
  /^(?:(?:Bachelor|Master|Doctor|Minor|Associate)(?: of [^:]{1,120})?|(?:B\.?\s*A\.?|B\.?\s*S\.?|M\.?\s*A\.?|M\.?\s*S\.?)(?: degree)?(?: with a major in [^:]{1,120})?)\s*:\s+(.{2,120})$/i;
const DERIVED_PATHWAY_DEGREE_PARENTHESES_PATTERN =
  /^(?:(?:The\s+)?(?:Bachelor|Master|Doctor|Minor|Associate|B\.?\s*A\.?|B\.?\s*S\.?|M\.?\s*A\.?|M\.?\s*S\.?)[^()]{0,120})\((.{2,100}\b(?:track|option|route|pathway|certificate|concentration))\)\s*$/i;
const DERIVED_PATHWAY_APPLY_DIRECTLY_PATTERN =
  /\bstudents apply(?: directly)?(?:\s+for|\s+to)?(?: the)?\s+(.{2,100}?)\s+(option|track|route|pathway|concentration)\b/i;
const DERIVED_PATHWAY_CREDENTIAL_PATTERN =
  /^the\s+(.{2,100}?)\s+option credential\b/i;
const DERIVED_PATHWAY_WITH_OPTION_IN_PATTERN =
  /^(?:(?:Bachelor|Master|Doctor|Minor|Associate)(?: of [^:]{1,120})?|(?:B\.?\s*A\.?|B\.?\s*S\.?|M\.?\s*A\.?|M\.?\s*S\.?)(?: degree)?(?: with a major in [^:]{1,120})?)\s+with option in\s+(.{2,100})$/i;
const DERIVED_PATHWAY_LIST_LABEL_PATTERN =
  /^list [A-Z]\s*[-:]\s+(.{2,100})$/i;
const DERIVED_PATHWAY_STRUCTURAL_PREFIX_PATTERN =
  /^(.{2,80}?)\s+(option|track|route|pathway|certificate|concentration)[-\s]*specific\b.*$/i;
const DERIVED_PATHWAY_DOCUMENT_SUFFIX_PATTERN =
  /\s*(?:\[(?:pdf|docx?|html?)\]|\((?:pdf|docx?|html?)\)|\b(?:pdf|docx?|html)\b)\s*$/i;
const DERIVED_PATHWAY_DOCUMENT_TITLE_SUFFIX_PATTERN =
  /\s+(?:degree\s+program\s+sheet|program\s+sheet|degree\s+sheet|worksheet|check\s*list|checklist)\b.*$/i;
const DERIVED_PATHWAY_REQUIREMENTS_SUFFIX_PATTERN =
  /\b(option|track|route|pathway|certificate|concentration)\b(?:\s*[:\-]\s*|\s+)(?:older\s+|prior\s+|current\s+|academic\s+|course\s+|program\s+|degree\s+|major\s+|graduation\s+)*requirements?\b.*$/i;
const DERIVED_PATHWAY_DATE_SUFFIX_PATTERN =
  /\b(option|track|route|pathway|certificate|concentration)\b(?:\s+(?:autumn|winter|spring|summer|fall)\s+\d{4})+(?:\s*[-\u2013\u2014]\s*(?:autumn|winter|spring|summer|fall)\s+\d{4})?\s*$/i;
const DERIVED_PATHWAY_TRAILING_SITE_SUFFIX_PATTERN =
  /\s+[-\u2013\u2014]\s+(?:UW|University of Washington)\b.*$/i;
const DERIVED_PATHWAY_DEFAULT_KIND_BY_PLAN: Partial<Record<string, "option" | "track" | "route">> = {
  "uw-tacoma-sustainable-urban-development": "option",
  "uw-tacoma-urban-studies": "option",
};
const DERIVED_PATHWAY_ALIASES_BY_PLAN: Partial<
  Record<string, Array<{ pattern: RegExp; id: string; label: string }>>
> = {
  "uw-tacoma-sustainable-urban-development": [
    {
      pattern: /^(?:community engagement)(?: option)?$/i,
      id: "community-engagement-option",
      label: "Community Engagement option",
    },
    {
      pattern:
        /^(?:geographic information systems(?: \(gis\))?|gis(?: certificate)?)(?:\s+(?:classes|track))?(?: option)?$/i,
      id: "gis-option",
      label: "GIS option",
    },
  ],
  "uw-tacoma-urban-studies": [
    {
      pattern: /^(?:community engagement)(?: option)?$/i,
      id: "community-engagement-option",
      label: "Community Engagement option",
    },
    {
      pattern:
        /^(?:geographic information systems(?: \(gis\))?|gis(?: certificate)?)(?:\s+(?:classes|track))?(?: option)?$/i,
      id: "gis-option",
      label: "GIS option",
    },
  ],
};
const PRIMARY_MAJOR_TITLES_BY_PLAN_ID = new Map(
  TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS.map((plan) => [plan.id, plan.title] as const)
);
const AUTO_PROMOTED_PRIMARY_SOURCE_OWNER_IDS = new Set(
  (TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS ?? []).map((entry) => entry.ownerId)
);

type AutoPromotedPathwaySupportEntry = {
  pathwayId: string;
  label: string;
  familyKey: string;
};

type AutoPromotedPathwaySupport = {
  ownerIds: Set<string>;
  pathwayIds: Set<string>;
  familyKeys: Set<string>;
  entriesByIdentityKey: Map<string, AutoPromotedPathwaySupportEntry>;
};

function buildDerivedPathwayIdentityKey(
  planTitle: string | null | undefined,
  value: string | null | undefined
) {
  const semanticValue =
    normalizeTransferPlannerSemanticPathwayLabel(planTitle, value) ||
    normalizeTransferPlannerText(value);

  return semanticValue.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildFallbackPathwayLabel(pathwayId: string) {
  return toDerivedPathwayLabel(normalizeTransferPlannerText(pathwayId).replace(/-/g, " "));
}

const AUTO_PROMOTED_PATHWAY_SUPPORT_BY_PLAN_ID = (() => {
  const supportByPlanId = new Map<string, AutoPromotedPathwaySupport>();

  for (const entry of TRANSFER_PLANNER_PRIMARY_SOURCE_PROMOTIONS ?? []) {
    if (entry.ownerType !== "pathway" || !entry.planId || !entry.pathwayId) {
      continue;
    }

    const planTitle = PRIMARY_MAJOR_TITLES_BY_PLAN_ID.get(entry.planId) ?? entry.ownerTitle ?? "";
    const pathwayLabel =
      normalizeTransferPlannerSemanticPathwayLabel(planTitle, entry.ownerTitle) ||
      buildFallbackPathwayLabel(entry.pathwayId);
    const familyKey =
      getDerivedPathwaySimilarityKey(pathwayLabel, planTitle) ||
      buildDerivedPathwayIdentityKey(planTitle, pathwayLabel);
    const support =
      supportByPlanId.get(entry.planId) ??
      ({
        ownerIds: new Set<string>(),
        pathwayIds: new Set<string>(),
        familyKeys: new Set<string>(),
        entriesByIdentityKey: new Map<string, AutoPromotedPathwaySupportEntry>(),
      } satisfies AutoPromotedPathwaySupport);

    support.ownerIds.add(entry.ownerId);
    support.pathwayIds.add(entry.pathwayId);
    if (familyKey) {
      support.familyKeys.add(familyKey);
    }

    for (const candidate of [entry.pathwayId, pathwayLabel, entry.ownerTitle]) {
      const identityKey = buildDerivedPathwayIdentityKey(planTitle, candidate);
      if (!identityKey) {
        continue;
      }

      support.entriesByIdentityKey.set(identityKey, {
        pathwayId: entry.pathwayId,
        label: pathwayLabel,
        familyKey,
      });
    }

    supportByPlanId.set(entry.planId, support);
  }

  return supportByPlanId;
})();

function resolveAutoPromotedPathwaySupportEntry(
  plan: TransferPlannerMajorPlan,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">
) {
  const support = AUTO_PROMOTED_PATHWAY_SUPPORT_BY_PLAN_ID.get(plan.id);
  if (!support) {
    return null;
  }

  if (support.pathwayIds.has(pathway.id)) {
    return {
      pathwayId: pathway.id,
      label: pathway.label,
      familyKey:
        getDerivedPathwaySimilarityKey(pathway.label, plan.title) ||
        buildDerivedPathwayIdentityKey(plan.title, pathway.label),
    } satisfies AutoPromotedPathwaySupportEntry;
  }

  for (const candidate of [pathway.id, pathway.label]) {
    const identityKey = buildDerivedPathwayIdentityKey(plan.title, candidate);
    if (!identityKey) {
      continue;
    }

    const canonicalEntry = support.entriesByIdentityKey.get(identityKey);
    if (canonicalEntry) {
      return canonicalEntry;
    }
  }

  return null;
}

function canonicalizeBasePathwayAgainstAutoPromotions(
  plan: TransferPlannerMajorPlan,
  pathway: TransferPlannerMajorPathway
) {
  const canonicalEntry = resolveAutoPromotedPathwaySupportEntry(plan, pathway);
  if (!canonicalEntry || canonicalEntry.pathwayId === pathway.id) {
    return pathway;
  }

  return {
    ...pathway,
    id: canonicalEntry.pathwayId,
    label: canonicalEntry.label || pathway.label,
  } satisfies TransferPlannerMajorPathway;
}

function canonicalizeBasePathwaysAgainstAutoPromotions(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[]
) {
  const canonicalPathwaysById = new Map<string, TransferPlannerMajorPathway>();
  const canonicalPathwayOrder: string[] = [];

  for (const pathway of basePathways) {
    const canonicalPathway = canonicalizeBasePathwayAgainstAutoPromotions(plan, pathway);
    if (!canonicalPathwaysById.has(canonicalPathway.id)) {
      canonicalPathwayOrder.push(canonicalPathway.id);
      canonicalPathwaysById.set(canonicalPathway.id, canonicalPathway);
      continue;
    }

    const existingPathway = canonicalPathwaysById.get(canonicalPathway.id)!;
    canonicalPathwaysById.set(canonicalPathway.id, {
      ...canonicalPathway,
      summary: canonicalPathway.summary || existingPathway.summary,
      applicationChecklist:
        canonicalPathway.applicationChecklist?.length
          ? canonicalPathway.applicationChecklist
          : existingPathway.applicationChecklist,
      beforeEnrollmentChecklist:
        canonicalPathway.beforeEnrollmentChecklist?.length
          ? canonicalPathway.beforeEnrollmentChecklist
          : existingPathway.beforeEnrollmentChecklist,
      stayAtGrcChecklist:
        canonicalPathway.stayAtGrcChecklist?.length
          ? canonicalPathway.stayAtGrcChecklist
          : existingPathway.stayAtGrcChecklist,
      advisorFlags: canonicalPathway.advisorFlags?.length
        ? canonicalPathway.advisorFlags
        : existingPathway.advisorFlags,
      officialLinks: canonicalPathway.officialLinks?.length
        ? canonicalPathway.officialLinks
        : existingPathway.officialLinks,
      degreeMapSections: canonicalPathway.degreeMapSections?.length
        ? canonicalPathway.degreeMapSections
        : existingPathway.degreeMapSections,
      validationNotes: canonicalPathway.validationNotes?.length
        ? canonicalPathway.validationNotes
        : existingPathway.validationNotes,
      grcCourseList: canonicalPathway.grcCourseList?.length
        ? canonicalPathway.grcCourseList
        : existingPathway.grcCourseList,
      grcCourseListGuidance:
        canonicalPathway.grcCourseListGuidance || existingPathway.grcCourseListGuidance,
      plannerNote: canonicalPathway.plannerNote || existingPathway.plannerNote,
      bestTrackId: canonicalPathway.bestTrackId ?? existingPathway.bestTrackId,
      recommendedTrackSummary:
        canonicalPathway.recommendedTrackSummary || existingPathway.recommendedTrackSummary,
      whyThisTrack: canonicalPathway.whyThisTrack?.length
        ? canonicalPathway.whyThisTrack
        : existingPathway.whyThisTrack,
    });
  }

  return canonicalPathwayOrder.map((pathwayId) => canonicalPathwaysById.get(pathwayId)!);
}

function getPathwayMaterializationSupportKey(
  plan: TransferPlannerMajorPlan,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">
) {
  const canonicalEntry = resolveAutoPromotedPathwaySupportEntry(plan, pathway);
  if (canonicalEntry?.pathwayId) {
    return canonicalEntry.pathwayId;
  }

  const labelSimilarityKey = getDerivedPathwaySimilarityKey(pathway.label, plan.title);
  const idSimilarityKey = getDerivedPathwaySimilarityKey(pathway.id, plan.title);
  if (
    labelSimilarityKey &&
    idSimilarityKey &&
    isCompactAcronymPathwaySupportKey(idSimilarityKey, labelSimilarityKey)
  ) {
    return idSimilarityKey;
  }

  return (
    labelSimilarityKey ||
    idSimilarityKey ||
    buildDerivedPathwayIdentityKey(plan.title, pathway.label) ||
    pathway.id.toLowerCase()
  );
}

function isCompactAcronymPathwaySupportKey(idSimilarityKey: string, labelSimilarityKey: string) {
  const idTokens = idSimilarityKey.split("|").filter(Boolean);
  const labelTokens = labelSimilarityKey.split("|").filter(Boolean);
  if (idTokens.length !== 1 || labelTokens.length <= 1) {
    return false;
  }

  return /^[a-z0-9]{2,6}$/.test(idTokens[0]);
}

function isAutoPromotedPathway(
  plan: TransferPlannerMajorPlan,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">
) {
  const support = AUTO_PROMOTED_PATHWAY_SUPPORT_BY_PLAN_ID.get(plan.id);
  if (!support) {
    return false;
  }

  const canonicalEntry = resolveAutoPromotedPathwaySupportEntry(plan, pathway);
  return Boolean(
    canonicalEntry &&
      AUTO_PROMOTED_PRIMARY_SOURCE_OWNER_IDS.has(`${plan.id}:pathway:${canonicalEntry.pathwayId}`)
  );
}

function decodeDerivedPathwayHtmlEntities(value: string) {
  return normalizeTransferPlannerText(value);
}

function normalizeDerivedPathwayText(value: string | null | undefined) {
  return decodeDerivedPathwayHtmlEntities(String(value ?? ""));
}

function selectDerivedPathwayKindSegment(value: string) {
  const normalized = normalizeDerivedPathwayText(value);
  const segments = normalized
    .split(/\s+(?:[-\u2013\u2014]|:)\s+|,\s+/)
    .map((segment) => normalizeDerivedPathwayText(segment))
    .filter(Boolean);

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (
      DERIVED_PATHWAY_KIND_PATTERN.test(segment) &&
      !/^(?:older|prior|current)\b/i.test(segment) &&
      !/^requirements?\s+for\b/i.test(segment)
    ) {
      return segment;
    }
  }

  return normalized;
}

function stripDerivedPathwayKindSuffix(value: string) {
  return normalizeDerivedPathwayText(value).replace(
    /\s+(option|track|route|pathway|certificate|concentration)\s*$/i,
    ""
  );
}

function normalizeDerivedPathwaySimilarityToken(value: string) {
  const normalized = String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("mathemat")) {
    return "mathemat";
  }

  return normalized
    .replace(/ies$/i, "y")
    .replace(/ical$/i, "")
    .replace(/ics$/i, "")
    .replace(/s$/i, "");
}

function getDerivedPathwaySimilarityKey(
  value: string,
  planTitle: string | null | undefined = null
) {
  const semanticLabel = stripTransferPlannerPlanTitlePrefix(
    planTitle,
    stripDerivedPathwayKindSuffix(
      normalizeDerivedPathwayCandidate(String(planTitle ?? ""), value)
    )
  );

  return Array.from(
    new Set(
      semanticLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .map((token) => normalizeDerivedPathwaySimilarityToken(token))
        .filter((token) => token.length >= 3 && !DERIVED_PATHWAY_SMALL_WORDS.has(token))
    )
  )
    .sort()
    .join("|");
}

export function isSuspiciousStructuralPathwayId(value: string | null | undefined) {
  const normalized = normalizeDerivedPathwayText(value).toLowerCase();
  if (!normalized) {
    return false;
  }

  return DERIVED_PATHWAY_STRUCTURAL_ID_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isSuspiciousStructuralPathwayLabel(value: string | null | undefined) {
  const normalized = normalizeDerivedPathwayText(value);
  if (!normalized) {
    return false;
  }

  if (/\b(?:pdf|worksheet|check\s*list|checklist)\b/i.test(normalized)) {
    return true;
  }

  if (
    /\b(option|track|route|pathway|certificate|concentration)\b.*\brequirements?\b/i.test(
      normalized
    )
  ) {
    return true;
  }

  return DERIVED_PATHWAY_GENERIC_LABEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isGuidanceOnlyDerivedPathwaySourceLine(value: string | null | undefined) {
  const normalized = normalizeDerivedPathwayText(value);
  if (!normalized) {
    return false;
  }

  return DERIVED_PATHWAY_GUIDANCE_SOURCE_LINE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getPlanTitlesForCrossMajorDetection(
  planId: string,
  planTitle: string | null | undefined
) {
  if (PRIMARY_MAJOR_TITLES_BY_PLAN_ID.has(planId)) {
    return PRIMARY_MAJOR_TITLES_BY_PLAN_ID;
  }

  return new Map([...PRIMARY_MAJOR_TITLES_BY_PLAN_ID, [planId, normalizeTransferPlannerText(planTitle)]]);
}

function sourceLineMentionsDifferentMajor(
  planId: string,
  planTitle: string | null | undefined,
  value: string | null | undefined
) {
  return labelMentionsDifferentTransferPlannerMajor(
    planId,
    value,
    getPlanTitlesForCrossMajorDetection(planId, planTitle)
  );
}

function toDerivedPathwayId(value: string) {
  return normalizeDerivedPathwayText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDerivedPathwayLabel(value: string) {
  const normalized = normalizeDerivedPathwayText(value);
  if (!normalized) {
    return normalized;
  }

  const label = normalized.replace(/\b([A-Za-z][A-Za-z']*)\b/g, (match, word, offset) => {
    const upper = word.toUpperCase();
    if (DERIVED_PATHWAY_ACRONYMS.has(upper) || (word === upper && /^[A-Z0-9]{2,6}$/.test(word))) {
      return upper;
    }

    const lower = word.toLowerCase();
    if (offset > 0 && DERIVED_PATHWAY_SMALL_WORDS.has(lower)) {
      return lower;
    }
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });

  if (/\b(?:track|pathway)$/.test(normalized)) {
    const normalizedKindLabel = label.replace(/\bPathway$/, "pathway");
    if (/^Data Science Track$/i.test(normalizedKindLabel)) {
      return "Data Science track";
    }
    if (/\btrack$/.test(normalized)) {
      return normalizedKindLabel.replace(/\bTrack$/, "track");
    }
    return normalizedKindLabel;
  }

  return label;
}

function inferDerivedPathwayKind(
  planId: string,
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
) {
  const explicitKind = DERIVED_PATHWAY_DEFAULT_KIND_BY_PLAN[planId];
  if (explicitKind) {
    return explicitKind;
  }

  const allLines = parsedSourceBlocks.flatMap((block) => [
    ...(block.chooseStatements ?? []),
    ...(block.pathwayLabels ?? []),
  ]);

  for (const line of allLines) {
    const normalized = normalizeDerivedPathwayText(line).toLowerCase();
    if (!normalized) {
      continue;
    }

    if (/\bformal options?\b|\boptions?\b/.test(normalized)) {
      return "option";
    }
    if (/\btracks?\b/.test(normalized)) {
      return "track";
    }
    if (/\broutes?\b/.test(normalized)) {
      return "route";
    }
  }

  return null;
}

function normalizeDerivedPathwayCandidate(planTitle: string, value: string) {
  return normalizeTransferPlannerSemanticPathwayLabel(
    planTitle,
    selectDerivedPathwayKindSegment(normalizeDerivedPathwayText(value))
      .replace(/^[A-Z]\.\s+/i, "")
      .replace(/^\d+\)\s+/i, "")
      .replace(/^option\s+\d+\s*:\s*/i, "")
      .replace(
        /^(?:(?:The\s+)?(?:Bachelor|Master|Doctor|Minor|Associate|B\.?\s*A\.?|B\.?\s*S\.?|M\.?\s*A\.?|M\.?\s*S\.?)[^()]{0,120})\((.{2,100}\b(?:track|option|route|pathway|certificate|concentration))\)\s*$/i,
        "$1"
      )
      .replace(/^(?:B\.?\s*A\.?|B\.?\s*S\.?) [^:]{1,80}:\s*/i, "")
      .replace(
        /^(?:\d{1,3}(?:-\d{1,3})?\s+credits?\s+for\s+(?:the\s+)?)([\s\S]+)$/i,
        "$1"
      )
      .replace(
        /^(.+?)\s+\(([A-Z0-9]{2,8})\)\s+(option|track|route|pathway|certificate|concentration)$/i,
        "$2 $3"
      )
      .replace(DERIVED_PATHWAY_WITH_OPTION_IN_PATTERN, "$1 Option")
      .replace(DERIVED_PATHWAY_TRAILING_SITE_SUFFIX_PATTERN, "")
      .replace(DERIVED_PATHWAY_DOCUMENT_TITLE_SUFFIX_PATTERN, "")
      .replace(DERIVED_PATHWAY_DOCUMENT_SUFFIX_PATTERN, "")
      .replace(DERIVED_PATHWAY_REQUIREMENTS_SUFFIX_PATTERN, "$1")
      .replace(DERIVED_PATHWAY_DATE_SUFFIX_PATTERN, "$1")
      .replace(/^(?:declaring(?: the)?|how to declare(?: the)?|program requirements?)\s+/i, "")
      .replace(/^requirements?\s+for\s+(?:the\s+)?/i, "")
      .replace(/\b(option|track|route|pathway|certificate|concentration)\b\s+[-–—]\s+.*$/i, "$1")
      .replace(/\s+[-–]\s+UW\b.*$/i, "")
      .replace(/\b(option|track|route|pathway|certificate|concentration)\b\s+[-\u2013\u2014]\s+.*$/i, "$1")
      .replace(/\s+\((?:\d+(?:-\d+)?\s+credits?)\)\s*$/i, "")
      .replace(/\s+-\s+please see website\.?$/i, "")
      .replace(/\s+\|\s+.*$/, "")
      .replace(/\s+[.;:]\s*$/, "")
  );
}

function extractDerivedPathwaySemanticPrefix(
  value: string,
  defaultKind: "option" | "track" | "route" | null
) {
  const structuralPrefixMatch = normalizeDerivedPathwayText(value).match(
    DERIVED_PATHWAY_STRUCTURAL_PREFIX_PATTERN
  );
  if (!structuralPrefixMatch) {
    return null;
  }

  const [, prefix, explicitKind] = structuralPrefixMatch;
  const normalizedPrefix = normalizeDerivedPathwayCandidate("", prefix);
  if (
    !normalizedPrefix ||
    DERIVED_PATHWAY_GENERIC_LABEL_PATTERNS.some((pattern) => pattern.test(normalizedPrefix))
  ) {
    return null;
  }

  return `${normalizedPrefix} ${explicitKind ?? defaultKind ?? "option"}`;
}

function applyDerivedPathwayAlias(planId: string, value: string) {
  const aliases = DERIVED_PATHWAY_ALIASES_BY_PLAN[planId] ?? [];
  for (const alias of aliases) {
    if (alias.pattern.test(value)) {
      return {
        id: alias.id,
        label: alias.label,
      };
    }
  }

  return null;
}

function canonicalizeDerivedPathwayCandidate(
  planId: string,
  planTitle: string,
  value: string | null | undefined,
  defaultKind: "option" | "track" | "route" | null,
  options: {
    allowBareLabel?: boolean;
  } = {}
) {
  let normalized = normalizeDerivedPathwayCandidate(planTitle, String(value ?? ""));
  if (!normalized) {
    return null;
  }

  const semanticStructuralPrefix = extractDerivedPathwaySemanticPrefix(normalized, defaultKind);
  if (semanticStructuralPrefix) {
    normalized = semanticStructuralPrefix;
  }

  if (DERIVED_PATHWAY_GENERIC_LABEL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return null;
  }

  if (isSuspiciousStructuralPathwayId(normalized)) {
    return null;
  }

  if (DERIVED_PATHWAY_EXPLICIT_COURSE_CODE_PATTERN.test(normalized)) {
    return null;
  }

  if (
    normalized.length > 80 ||
    !/[A-Za-z]/.test(normalized) ||
    normalized.split(/\s+/).filter(Boolean).length > 10
  ) {
    return null;
  }

  const aliased = applyDerivedPathwayAlias(planId, normalized);
  if (aliased) {
    return aliased;
  }

  if (!DERIVED_PATHWAY_LABEL_PATTERN.test(normalized)) {
    if (options.allowBareLabel) {
      const bareLabel = toDerivedPathwayLabel(normalized);
      const bareId = toDerivedPathwayId(bareLabel);
      if (!bareId || isSuspiciousStructuralPathwayId(bareId)) {
        return null;
      }

      return {
        id: bareId,
        label: bareLabel,
      };
    }

    if (!defaultKind) {
      return null;
    }

    normalized = `${normalized} ${defaultKind}`;
  }

  const label = toDerivedPathwayLabel(normalized);
  const id = toDerivedPathwayId(label);
  if (!id) {
    return null;
  }

  return {
    id,
    label,
  };
}

function extractDerivedPathwayCandidateFromLine(
  planId: string,
  planTitle: string,
  value: string | null | undefined,
  defaultKind: "option" | "track" | "route" | null
) {
  let normalized = normalizeDerivedPathwayText(value);
  if (!normalized) {
    return null;
  }

  if (/^\[?\s*supplemental official source\]?\b/i.test(normalized)) {
    return null;
  }

  if (/^(?:Doctor|Master)\s+Of\b|^(?:Doctor|Master)\b/i.test(normalized)) {
    return null;
  }

  if (
    sourceLineMentionsDifferentMajor(planId, planTitle, value) &&
    (/(?:\s[-\u2013\u2014:]\s|\|)/.test(normalized) || /\bmajor\b/i.test(normalized))
  ) {
    return null;
  }

  if (isGuidanceOnlyDerivedPathwaySourceLine(normalized)) {
    return null;
  }

  if (normalized.includes("|")) {
    normalized = normalizeDerivedPathwayText(normalized.split("|")[0]);
  }

  const enumeratedLabelMatch = normalized.match(/^[A-Z]\.\s+(.{2,80})$/);
  if (enumeratedLabelMatch) {
    return canonicalizeDerivedPathwayCandidate(
      planId,
      planTitle,
      enumeratedLabelMatch[1],
      defaultKind
    );
  }

  const degreeTitleMatch = normalized.match(DERIVED_PATHWAY_DEGREE_TITLE_PATTERN);
  if (degreeTitleMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, planTitle, degreeTitleMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const degreeParenthesesMatch = normalized.match(DERIVED_PATHWAY_DEGREE_PARENTHESES_PATTERN);
  if (degreeParenthesesMatch) {
    return canonicalizeDerivedPathwayCandidate(
      planId,
      planTitle,
      degreeParenthesesMatch[1],
      defaultKind,
      {
        allowBareLabel: true,
      }
    );
  }

  const withOptionInMatch = normalized.match(DERIVED_PATHWAY_WITH_OPTION_IN_PATTERN);
  if (withOptionInMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, planTitle, withOptionInMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const pathwayTitleMatch = normalized.match(/^(?:B\.?\s*A\.?|B\.?\s*S\.?) [^:]{1,80}:\s+(.{2,80})$/i);
  if (pathwayTitleMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, planTitle, pathwayTitleMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const listLabelMatch = normalized.match(DERIVED_PATHWAY_LIST_LABEL_PATTERN);
  if (listLabelMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, planTitle, listLabelMatch[1], defaultKind);
  }

  const applyDirectlyMatch = normalized.match(DERIVED_PATHWAY_APPLY_DIRECTLY_PATTERN);
  if (applyDirectlyMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, planTitle, applyDirectlyMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const credentialMatch = normalized.match(DERIVED_PATHWAY_CREDENTIAL_PATTERN);
  if (credentialMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, planTitle, credentialMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const pursuingTrackMatch = normalized.match(/\bstudents pursuing the\s+(.{2,60}?)\s+track\b/i);
  if (pursuingTrackMatch) {
    return canonicalizeDerivedPathwayCandidate(
      planId,
      planTitle,
      `${pursuingTrackMatch[1]} track`,
      defaultKind,
      { allowBareLabel: true }
    );
  }

  const inlineLabelMatch = normalized.match(
    /^([^:]{1,100}\b(?:track|option|route|pathway|certificate|concentration)\b(?:\s*\([^)]{1,40}\))?)\s*:/i
  );
  if (inlineLabelMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, planTitle, inlineLabelMatch[1], defaultKind);
  }

  if (!DERIVED_PATHWAY_LABEL_PATTERN.test(normalized)) {
    return null;
  }

  return canonicalizeDerivedPathwayCandidate(planId, planTitle, normalized, defaultKind);
}

function splitDerivedPathwayChoiceValues(value: string) {
  const normalized = normalizeDerivedPathwayText(value).replace(/\s+\.\s*$/, "");
  if (!normalized || !/(?:\s+or\s+|\s*,\s*)/i.test(normalized)) {
    return [];
  }

  return normalized
    .replace(/\s*,\s+(?:and\/or|and|or)\s+/gi, "|")
    .replace(/\s+(?:or|and\/or)\s+/gi, "|")
    .split(/\s*\|\s*|\s*,\s*/i)
    .map((entry) => normalizeDerivedPathwayText(entry))
    .filter(Boolean);
}

function extractDerivedPathwayCandidatesFromChoiceStatement(
  planId: string,
  planTitle: string,
  value: string | null | undefined,
  defaultKind: "option" | "track" | "route" | null
) {
  const normalized = normalizeDerivedPathwayText(value);
  if (!normalized) {
    return [] as Array<{ id: string; label: string }>;
  }

  const tails = [
    normalized.match(/\b(?:options?|tracks?|routes?|pathways?)\b[^:]{0,40}:\s*([^.;]+?)(?:\.\s*|$)/i)?.[1],
    normalized.match(
      /\bchoice of [^.]{0,80}?(?:options?|tracks?|routes?|pathways?)\s+(?:in|between)\s+(.+?)(?:\.\s*|$)/i
    )?.[1],
    normalized.match(/\bchoose\s+([^:]{2,120})\s*:/i)?.[1],
  ].filter(Boolean) as string[];

  const results: Array<{ id: string; label: string }> = [];
  for (const tail of tails) {
    for (const candidate of splitDerivedPathwayChoiceValues(tail)) {
      const resolved = canonicalizeDerivedPathwayCandidate(
        planId,
        planTitle,
        candidate,
        defaultKind
      );
      if (resolved) {
        results.push(resolved);
      }
    }
  }

  return results;
}

function buildDerivedPathwaySeeds(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
) {
  const stableParsedSourceBlocks = parsedSourceBlocks.filter((block) => {
    if (block.resolutionStrategy !== "alternate-official-source") {
      return true;
    }

    // Alternate-official fallbacks from overview primaries can be valuable for
    // lower-division evidence, but they are too noisy to mint new pathway rows.
    return block.primaryParserType !== "html-overview-page";
  });
  const planLevelBlocks = stableParsedSourceBlocks.filter((block) => !block.pathwayId);

  function buildSeedsFromBlocks(sourceBlocks: TransferPlannerParsedRequirementSourceBlock[]) {
    const defaultKind = inferDerivedPathwayKind(plan.id, sourceBlocks);
    const choiceStatements = sourceBlocks.flatMap((block) => block.chooseStatements ?? []);
    const rawSourceLines = sourceBlocks.flatMap((block) => [
      block.ownerTitle,
      ...(block.requirementCueLines ?? []),
      ...(block.chooseStatements ?? []),
    ]);
    const supportedRawCandidateFamilies = new Set<string>();

    for (const statement of choiceStatements) {
      for (const candidate of extractDerivedPathwayCandidatesFromChoiceStatement(
        plan.id,
        plan.title,
        statement,
        defaultKind
      )) {
        const similarityKey = getDerivedPathwaySimilarityKey(candidate.label, plan.title);
        if (similarityKey) {
          supportedRawCandidateFamilies.add(similarityKey);
        }
      }
    }

    for (const line of rawSourceLines) {
      const candidate = extractDerivedPathwayCandidateFromLine(plan.id, plan.title, line, defaultKind);
      const similarityKey = candidate
        ? getDerivedPathwaySimilarityKey(candidate.label, plan.title)
        : "";
      if (similarityKey) {
        supportedRawCandidateFamilies.add(similarityKey);
      }
    }

    const hasForeignMajorPathwayEvidence = rawSourceLines.some(
      (line) =>
        sourceLineMentionsDifferentMajor(plan.id, plan.title, line) &&
        /(?:\s[-\u2013\u2014:]\s|\|)/.test(normalizeDerivedPathwayText(line)) &&
        DERIVED_PATHWAY_LABEL_PATTERN.test(normalizeDerivedPathwayText(line))
    );
    const supportedPathwayLabelLines = sourceBlocks.flatMap((block) =>
      (block.pathwayLabels ?? []).filter((line) => {
        const candidate = extractDerivedPathwayCandidateFromLine(plan.id, plan.title, line, defaultKind);
        if (!candidate) {
          return false;
        }

        const similarityKey = getDerivedPathwaySimilarityKey(candidate.label, plan.title);
        if (!similarityKey) {
          return false;
        }

        if (!hasForeignMajorPathwayEvidence) {
          return true;
        }

        if (!supportedRawCandidateFamilies.size) {
          return !hasForeignMajorPathwayEvidence;
        }

        return supportedRawCandidateFamilies.has(similarityKey);
      })
    );
    const orderedSourceLines = [...supportedPathwayLabelLines, ...rawSourceLines];
    const seedById = new Map<string, TransferPlannerDerivedPathwaySeed>();
    const seedIdsByNormalizedBase = new Map<string, string>();
    const seedIdsBySimilarityKey = new Map<string, string>();

    function pushSeed(
      candidate: { id: string; label: string } | null,
      options: { preserveOrder?: boolean } = {}
    ) {
      if (!candidate || isSuspiciousStructuralPathwayId(candidate.id)) {
        return;
      }

      const normalizedBaseLabel = stripDerivedPathwayKindSuffix(candidate.label).toLowerCase();
      const existingIdForBase = normalizedBaseLabel
        ? seedIdsByNormalizedBase.get(normalizedBaseLabel) ?? null
        : null;
      const existingSeedForBase = existingIdForBase ? seedById.get(existingIdForBase) ?? null : null;
      if (
        existingSeedForBase &&
        candidate.label.length >= existingSeedForBase.label.length &&
        !options.preserveOrder
      ) {
        return;
      }

      const similarityKey = getDerivedPathwaySimilarityKey(candidate.label, plan.title);
      const existingIdForSimilarity = similarityKey
        ? seedIdsBySimilarityKey.get(similarityKey) ?? null
        : null;
      const existingSeedForSimilarity = existingIdForSimilarity
        ? seedById.get(existingIdForSimilarity) ?? null
        : null;
      if (existingSeedForSimilarity && !options.preserveOrder) {
        return;
      }

      const existingSeed = seedById.get(candidate.id) ?? null;
      if (
        existingSeed &&
        existingSeed.label.length <= candidate.label.length &&
        !options.preserveOrder
      ) {
        return;
      }

      const nextSeed = {
        id: candidate.id,
        label: candidate.label,
        summary: "",
      } satisfies TransferPlannerDerivedPathwaySeed;

      seedById.set(candidate.id, nextSeed);
      if (normalizedBaseLabel) {
        seedIdsByNormalizedBase.set(normalizedBaseLabel, candidate.id);
      }
      if (similarityKey) {
        seedIdsBySimilarityKey.set(similarityKey, candidate.id);
      }
    }

    for (const statement of choiceStatements) {
      for (const candidate of extractDerivedPathwayCandidatesFromChoiceStatement(
        plan.id,
        plan.title,
        statement,
        defaultKind
      )) {
        pushSeed(candidate);
      }
    }

    for (const line of orderedSourceLines) {
      pushSeed(extractDerivedPathwayCandidateFromLine(plan.id, plan.title, line, defaultKind));
    }

    const seeds = [...seedById.values()].filter((seed) => !isSuspiciousStructuralPathwayLabel(seed.label));
    const blockHasNestedHonorsContext = sourceBlocks.some((block) =>
      [...(block.requirementCueLines ?? []), ...(block.chooseStatements ?? [])].some((line) =>
        /\bdepartmental honors?\b|\bhonors program\b/i.test(normalizeDerivedPathwayText(line))
      )
    );

    if (!blockHasNestedHonorsContext) {
      return seeds;
    }

    const baseSupportKeys = new Set(
      basePathways.map((pathway) => getPathwayMaterializationSupportKey(plan, pathway)).filter(Boolean)
    );
    const trackSeedCount = seeds.filter((seed) => /\btrack\b/i.test(seed.label)).length;
    if (trackSeedCount < 2) {
      return seeds;
    }

    return seeds.filter((seed) => {
      if (!/\boption\b/i.test(seed.label) || /\bhonors\b/i.test(seed.label)) {
        return true;
      }

      if (isAutoPromotedPathway(plan, seed)) {
        return true;
      }

      return baseSupportKeys.has(getPathwayMaterializationSupportKey(plan, seed));
    });
  }

  return buildSeedsFromBlocks(planLevelBlocks.length ? planLevelBlocks : stableParsedSourceBlocks);
}

function buildPathwayEvidenceFamiliesForBlock(
  plan: TransferPlannerMajorPlan,
  block: TransferPlannerParsedRequirementSourceBlock
) {
  const defaultKind = inferDerivedPathwayKind(plan.id, [block]);
  const families = new Set<string>();
  const sourceLines = [
    block.ownerTitle,
    ...(block.pathwayLabels ?? []),
    ...(block.requirementCueLines ?? []),
    ...(block.chooseStatements ?? []),
  ];

  for (const statement of block.chooseStatements ?? []) {
    for (const candidate of extractDerivedPathwayCandidatesFromChoiceStatement(
      plan.id,
      plan.title,
      statement,
      defaultKind
    )) {
      const similarityKey = getDerivedPathwaySimilarityKey(candidate.label, plan.title);
      if (similarityKey) {
        families.add(similarityKey);
      }
    }
  }

  for (const line of sourceLines) {
    const candidate = extractDerivedPathwayCandidateFromLine(plan.id, plan.title, line, defaultKind);
    const similarityKey = candidate
      ? getDerivedPathwaySimilarityKey(candidate.label, plan.title)
      : "";
    if (similarityKey) {
      families.add(similarityKey);
    }
  }

  return families;
}

function filterUnsupportedBasePathways(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[],
  derivedPathways: TransferPlannerDerivedPathwaySeed[]
) {
  const planLevelBlocks = parsedSourceBlocks.filter((block) => !block.pathwayId);
  if (!planLevelBlocks.length) {
    return basePathways;
  }
  const hasPlanLevelForeignMajorPathwayEvidence = planLevelBlocks.some((block) =>
    [
      ...(block.pathwayLabels ?? []),
      ...(block.requirementCueLines ?? []),
      ...(block.chooseStatements ?? []),
    ].some(
      (line) =>
        sourceLineMentionsDifferentMajor(plan.id, plan.title, line) &&
        /(?:\s[-\u2013\u2014:]\s|\|)/.test(normalizeDerivedPathwayText(line)) &&
        DERIVED_PATHWAY_LABEL_PATTERN.test(normalizeDerivedPathwayText(line))
    )
  );

  const derivedFamilies = new Set(
    derivedPathways
      .map((pathway) => getPathwayMaterializationSupportKey(plan, pathway))
      .filter(Boolean)
  );
  const hasPlanLevelDerivedFamilies = derivedFamilies.size > 0;

  return basePathways.filter((pathway) => {
    const ownerId = `${plan.id}:pathway:${pathway.id}`;
    if (AUTO_PROMOTED_PRIMARY_SOURCE_OWNER_IDS.has(ownerId)) {
      return true;
    }

    const pathwayFamily = getPathwayMaterializationSupportKey(plan, pathway);
    if (!pathwayFamily || derivedFamilies.has(pathwayFamily)) {
      return true;
    }
    const pathwayBlocks = parsedSourceBlocks.filter((block) => block.pathwayId === pathway.id);
    if (!pathwayBlocks.length) {
      return false;
    }

    const hasSupportingPathwayBlock = pathwayBlocks.some((block) =>
      buildPathwayEvidenceFamiliesForBlock(plan, block).has(pathwayFamily)
    );
    const hasDedicatedParsedPathwayBlock = hasDedicatedSourceBackedPathwayBlock(
      plan,
      pathway,
      parsedSourceBlocks
    );
    if (!hasSupportingPathwayBlock && !hasDedicatedParsedPathwayBlock) {
      return false;
    }

    if (!hasPlanLevelDerivedFamilies && !hasPlanLevelForeignMajorPathwayEvidence) {
      return true;
    }

    const planLevelSourceUrls = new Set(
      planLevelBlocks
        .map((block) => normalizeTransferPlannerText(block.sourceUrl))
        .filter(Boolean)
    );
    const hasDedicatedPathwaySource = pathwayBlocks.some((block) => {
      const normalizedSourceUrl = normalizeTransferPlannerText(block.sourceUrl);
      return normalizedSourceUrl && !planLevelSourceUrls.has(normalizedSourceUrl);
    });

    return hasDedicatedPathwaySource || hasDedicatedParsedPathwayBlock;
  });
}

export function deriveTransferPlannerPathwaySeeds(
  plan: TransferPlannerMajorPlan,
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
) {
  return buildDerivedPathwaySeeds(plan, plan.pathways ?? [], parsedSourceBlocks);
}

function shouldPreferDerivedPathways(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  derivedPathways: TransferPlannerDerivedPathwaySeed[]
) {
  if (!basePathways.length) {
    return derivedPathways.length >= 2;
  }

  if (!derivedPathways.length) {
    return false;
  }

  const suspiciousBasePathways = basePathways.filter(
    (pathway) =>
      isSuspiciousStructuralPathwayId(pathway.id) || isSuspiciousStructuralPathwayLabel(pathway.label)
  );
  const semanticBasePathways = basePathways.filter(
    (pathway) =>
      !isSuspiciousStructuralPathwayId(pathway.id) && !isSuspiciousStructuralPathwayLabel(pathway.label)
  );
  const semanticDerivedPathways = derivedPathways.filter(
    (pathway) =>
      !isSuspiciousStructuralPathwayId(pathway.id) &&
      !isSuspiciousStructuralPathwayLabel(pathway.label)
  );
  const semanticBaseFamilies = semanticBasePathways
    .map((pathway) => getPathwayMaterializationSupportKey(plan, pathway))
    .filter(Boolean);
  const semanticBaseFamilySet = new Set(semanticBaseFamilies);
  const semanticBaseFamilyCount = new Set(semanticBaseFamilies).size;
  const semanticDerivedFamilySet = new Set(
    semanticDerivedPathways
      .map((pathway) => getPathwayMaterializationSupportKey(plan, pathway))
      .filter(Boolean)
  );
  const hasDuplicateSemanticBaseFamilies = semanticBaseFamilyCount < semanticBaseFamilies.length;
  const hasHtmlEntityLeak = basePathways.some((pathway) => hasTransferPlannerHtmlEntityLeak(pathway.label));
  const hasAutoPromotedDerivedExpansion = semanticDerivedPathways.some((pathway) => {
    const supportKey = getPathwayMaterializationSupportKey(plan, pathway);
    return supportKey && !semanticBaseFamilySet.has(supportKey) && isAutoPromotedPathway(plan, pathway);
  });
  const hasSupportedDerivedExpansion =
    semanticBasePathways.length <= 2 &&
    semanticDerivedPathways.length > semanticBaseFamilyCount &&
    semanticBaseFamilies.length > 0 &&
    semanticBaseFamilies.every((family) => semanticDerivedFamilySet.has(family));
  const shouldCollapseToSingleSemanticDerivedPathway =
    semanticDerivedPathways.length === 1 &&
    basePathways.length > 1 &&
    semanticBasePathways.length > 0 &&
    semanticBaseFamilies.length > 0 &&
    semanticBaseFamilies.every((family) => {
      const derivedFamily = getPathwayMaterializationSupportKey(plan, semanticDerivedPathways[0]);
      return family === derivedFamily;
    }) &&
    (suspiciousBasePathways.length > 0 || hasDuplicateSemanticBaseFamilies || hasHtmlEntityLeak);

  if (semanticDerivedPathways.length < 2) {
    return shouldCollapseToSingleSemanticDerivedPathway;
  }

  if (hasAutoPromotedDerivedExpansion) {
    return true;
  }

  if (hasSupportedDerivedExpansion) {
    return true;
  }

  if (suspiciousBasePathways.length === basePathways.length) {
    return true;
  }

  if (hasDuplicateSemanticBaseFamilies || hasHtmlEntityLeak) {
    return true;
  }

  if (!suspiciousBasePathways.length) {
    return false;
  }

  if (semanticBaseFamilyCount > 0 && semanticDerivedPathways.length >= semanticBaseFamilyCount) {
    return true;
  }

  return semanticDerivedPathways.length >= basePathways.length - suspiciousBasePathways.length;
}

function filterDerivedPathwaysToKnownBaseFamilies(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  derivedPathways: TransferPlannerDerivedPathwaySeed[]
) {
  const semanticBasePathways = basePathways.filter(
    (pathway) =>
      !isSuspiciousStructuralPathwayId(pathway.id) &&
      !isSuspiciousStructuralPathwayLabel(pathway.label)
  );
  const baseFamilies = new Set(
    semanticBasePathways
      .filter(
        (pathway) =>
          !isSuspiciousStructuralPathwayId(pathway.id) &&
          !isSuspiciousStructuralPathwayLabel(pathway.label)
      )
      .map((pathway) => getPathwayMaterializationSupportKey(plan, pathway))
      .filter(Boolean)
  );

  if (!baseFamilies.size) {
    return derivedPathways;
  }

  const matchingDerivedPathways = derivedPathways.filter((pathway) =>
    baseFamilies.has(getPathwayMaterializationSupportKey(plan, pathway)) ||
    isAutoPromotedPathway(plan, pathway)
  );

  if (!matchingDerivedPathways.length) {
    return derivedPathways;
  }

  if (
    semanticBasePathways.length <= 2 &&
    derivedPathways.length > matchingDerivedPathways.length
  ) {
    return derivedPathways;
  }

  return matchingDerivedPathways;
}

function canonicalizeDerivedPathwaysAgainstSupportedBase(
  plan: TransferPlannerMajorPlan,
  supportedBasePathways: TransferPlannerMajorPathway[],
  derivedPathways: TransferPlannerDerivedPathwaySeed[]
) {
  if (!supportedBasePathways.length || !derivedPathways.length) {
    return derivedPathways;
  }

  const basePathwaysByFamily = new Map<string, TransferPlannerMajorPathway[]>();
  for (const pathway of supportedBasePathways) {
    if (
      isSuspiciousStructuralPathwayId(pathway.id) ||
      isSuspiciousStructuralPathwayLabel(pathway.label)
    ) {
      continue;
    }

    const supportKey = getPathwayMaterializationSupportKey(plan, pathway);
    if (!supportKey) {
      continue;
    }

    basePathwaysByFamily.set(supportKey, [
      ...(basePathwaysByFamily.get(supportKey) ?? []),
      pathway,
    ]);
  }

  const canonicalPathwaysById = new Map<string, TransferPlannerDerivedPathwaySeed>();
  const canonicalOrder: string[] = [];
  const pushCanonicalPathway = (pathway: TransferPlannerDerivedPathwaySeed) => {
    if (!canonicalPathwaysById.has(pathway.id)) {
      canonicalOrder.push(pathway.id);
      canonicalPathwaysById.set(pathway.id, pathway);
      return;
    }

    const existingPathway = canonicalPathwaysById.get(pathway.id)!;
    canonicalPathwaysById.set(pathway.id, {
      ...existingPathway,
      label: existingPathway.label || pathway.label,
      summary: existingPathway.summary || pathway.summary,
    });
  };

  for (const pathway of derivedPathways) {
    const supportKey = getPathwayMaterializationSupportKey(plan, pathway);
    const matchingBasePathways = supportKey ? basePathwaysByFamily.get(supportKey) ?? [] : [];
    if (matchingBasePathways.length !== 1 || isAutoPromotedPathway(plan, pathway)) {
      pushCanonicalPathway(pathway);
      continue;
    }

    const basePathway = matchingBasePathways[0];
    pushCanonicalPathway({
      ...pathway,
      id: basePathway.id,
      label: normalizeTransferPlannerText(basePathway.label) || pathway.label,
      summary: pathway.summary || basePathway.summary || "",
    });
  }

  return canonicalOrder.map((pathwayId) => canonicalPathwaysById.get(pathwayId)!);
}

function hasDedicatedSourceBackedPathwayBlock(
  plan: TransferPlannerMajorPlan,
  pathway: Pick<TransferPlannerMajorPathway, "id" | "label">,
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
) {
  const ownerId = `${plan.id}:pathway:${pathway.id}`;
  if (AUTO_PROMOTED_PRIMARY_SOURCE_OWNER_IDS.has(ownerId)) {
    return true;
  }

  return parsedSourceBlocks.some(
    (block) =>
      block.pathwayId === pathway.id &&
      Boolean(
        block.parsedUwCourseCodes?.length ||
          block.requirementCueLines?.length ||
          block.chooseStatements?.length ||
          block.pathwayLabels?.length
      )
  );
}

function mergeDerivedAndSourceBackedBasePathways(
  plan: TransferPlannerMajorPlan,
  supportedBasePathways: TransferPlannerMajorPathway[],
  derivedPathways: TransferPlannerDerivedPathwaySeed[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
) {
  const materializedPathwaysById = new Map<string, TransferPlannerMajorPathway>();
  const materializedOrder: string[] = [];
  const representedFamilies = new Set<string>();
  const pushMaterializedPathway = (pathway: TransferPlannerMajorPathway) => {
    if (!materializedPathwaysById.has(pathway.id)) {
      materializedOrder.push(pathway.id);
    }

    materializedPathwaysById.set(pathway.id, pathway);
    const supportKey = getPathwayMaterializationSupportKey(plan, pathway);
    if (supportKey) {
      representedFamilies.add(supportKey);
    }
  };

  for (const pathway of derivedPathways) {
    pushMaterializedPathway({
      id: pathway.id,
      label: normalizeTransferPlannerText(pathway.label),
      summary: pathway.summary,
      officialLinks: plan.officialLinks,
    });
  }

  for (const pathway of supportedBasePathways) {
    if (
      isSuspiciousStructuralPathwayId(pathway.id) ||
      isSuspiciousStructuralPathwayLabel(pathway.label) ||
      materializedPathwaysById.has(pathway.id) ||
      !hasDedicatedSourceBackedPathwayBlock(plan, pathway, parsedSourceBlocks)
    ) {
      continue;
    }

    const supportKey = getPathwayMaterializationSupportKey(plan, pathway);
    if (supportKey && representedFamilies.has(supportKey)) {
      continue;
    }

    pushMaterializedPathway({
      ...pathway,
      label: normalizeTransferPlannerText(pathway.label),
    });
  }

  return materializedOrder.map((pathwayId) => materializedPathwaysById.get(pathwayId)!);
}

export function materializeTransferPlannerPathways(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
): TransferPlannerMajorPathway[] {
  const canonicalBasePathways = canonicalizeBasePathwaysAgainstAutoPromotions(plan, basePathways);
  const rawDerivedPathways = filterDerivedPathwaysToKnownBaseFamilies(
    plan,
    canonicalBasePathways,
    buildDerivedPathwaySeeds(plan, canonicalBasePathways, parsedSourceBlocks)
  );
  const preliminaryDerivedPathways = canonicalizeDerivedPathwaysAgainstSupportedBase(
    plan,
    canonicalBasePathways,
    rawDerivedPathways
  );
  const supportedBasePathways = filterUnsupportedBasePathways(
    plan,
    canonicalBasePathways,
    parsedSourceBlocks,
    preliminaryDerivedPathways
  );
  const derivedPathways = canonicalizeDerivedPathwaysAgainstSupportedBase(
    plan,
    supportedBasePathways,
    preliminaryDerivedPathways
  );
  if (
    supportedBasePathways.length &&
    !shouldPreferDerivedPathways(plan, supportedBasePathways, derivedPathways)
  ) {
    if (
      !derivedPathways.length &&
      supportedBasePathways.every(
        (pathway) =>
          isSuspiciousStructuralPathwayId(pathway.id) ||
          isSuspiciousStructuralPathwayLabel(pathway.label)
      )
    ) {
      return [];
    }

    return supportedBasePathways.map((pathway) => ({
      ...pathway,
      label: normalizeTransferPlannerText(pathway.label),
    }));
  }

  if (derivedPathways.length) {
    return mergeDerivedAndSourceBackedBasePathways(
      plan,
      supportedBasePathways,
      derivedPathways,
      parsedSourceBlocks
    );
  }

  return supportedBasePathways;
}

export function countMaterializedTransferPlannerPathways(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
): number {
  return materializeTransferPlannerPathways(plan, basePathways, parsedSourceBlocks).length;
}
