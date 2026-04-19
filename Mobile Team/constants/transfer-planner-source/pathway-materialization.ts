import type {
  TransferPlannerMajorPathway,
  TransferPlannerMajorPlan,
} from "../transfer-planner-types";
import type { TransferPlannerParsedRequirementSourceBlock } from "./schema";

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
  /^additional (?:admission|completion )?requirements?\b/i,
  /^advanced data science option specific requirements?\b/i,
  /^complete the requirements\b/i,
  /^clinical requirements?\b/i,
  /^core courses?\b/i,
  /^course lists?\b/i,
  /^course[- ]only option\b/i,
  /^degree options?\b/i,
  /^electives?\b.*\bchoose\b/i,
  /^capstone experience\b/i,
  /^choose (?:one|two|three|between|from)\b/i,
  /^choose your\b/i,
  /^contact the\b/i,
  /^degree options?\b/i,
  /^declaring an option\b/i,
  /^declaring(?: the)?\b/i,
  /^formal options?\b/i,
  /^how to declare(?: the)?\b/i,
  /^minimum \d/i,
  /^\d{1,3}(?:-\d{1,3})?\s*credits?\b/i,
  /^option \d+\b/i,
  /^page \d+\b/i,
  /^option[- ]specific\b/i,
  /^pathway[- ]specific\b/i,
  /^requirements? to declare\b/i,
  /^see ["']?additional\b/i,
  /^track[- ]specific\b/i,
  /^track specific\b/i,
  /^track-specific\b/i,
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
  /\b(?:clinical|didactic) coursework\b/i,
  /\boption[- ]specific\b.*\b(?:credits?|requirements?|coursework)\b/i,
  /\btrack[- ]specific\b.*\b(?:credits?|requirements?|coursework)\b/i,
  /\bdepending on (?:credential\/)?option\b/i,
  /\bvaries by option\b/i,
  /\bchoose thesis, project, or course-only option\b/i,
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
      pattern: /^(?:geographic information systems(?: \(gis\))?|gis(?: certificate)?)(?: option)?$/i,
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
      pattern: /^(?:geographic information systems(?: \(gis\))?|gis(?: certificate)?)(?: option)?$/i,
      id: "gis-option",
      label: "GIS option",
    },
  ],
};

function decodeDerivedPathwayHtmlEntities(value: string) {
  return value
    .replace(/&#0*38;|&amp;/gi, " & ")
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, " - ")
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/&#8220;|&#8221;|&quot;/gi, '"');
}

function normalizeDerivedPathwayText(value: string | null | undefined) {
  return decodeDerivedPathwayHtmlEntities(String(value ?? ""))
    .replace(/\s+/g, " ")
    .trim();
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

function getDerivedPathwaySimilarityKey(value: string) {
  return Array.from(
    new Set(
      stripDerivedPathwayKindSuffix(value)
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

  return DERIVED_PATHWAY_GENERIC_LABEL_PATTERNS.some((pattern) => pattern.test(normalized));
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

  return normalized.replace(/\b([A-Za-z][A-Za-z']*)\b/g, (match, word, offset) => {
    const upper = word.toUpperCase();
    if (DERIVED_PATHWAY_ACRONYMS.has(upper)) {
      return upper;
    }

    const lower = word.toLowerCase();
    if (offset > 0 && DERIVED_PATHWAY_SMALL_WORDS.has(lower)) {
      return lower;
    }
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
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

function normalizeDerivedPathwayCandidate(value: string) {
  return normalizeDerivedPathwayText(value)
    .replace(/^[A-Z]\.\s+/i, "")
    .replace(/^\d+\)\s+/i, "")
    .replace(/^option\s+\d+\s*:\s*/i, "")
    .replace(
      /^(?:(?:The\s+)?(?:Bachelor|Master|Doctor|Minor|Associate|B\.?\s*A\.?|B\.?\s*S\.?|M\.?\s*A\.?|M\.?\s*S\.?)[^()]{0,120})\((.{2,100}\b(?:track|option|route|pathway|certificate|concentration))\)\s*$/i,
      "$1"
    )
    .replace(/^(?:B\.?\s*A\.?|B\.?\s*S\.?) [^:]{1,80}:\s*/i, "")
    .replace(
      /^(?:\d{1,3}(?:-\d{1,3})?\s+credits?\s+for\s+(?:the\s+)?)((?:.|\s)+)$/i,
      "$1"
    )
    .replace(/^(?:declaring(?: the)?|how to declare(?: the)?|program requirements?)\s+/i, "")
    .replace(/\s+[-–]\s+UW\b.*$/i, "")
    .replace(/\s+\((?:\d+(?:-\d+)?\s+credits?)\)\s*$/i, "")
    .replace(/\s+-\s+please see website\.?$/i, "")
    .replace(/\s+\|\s+.*$/, "")
    .replace(/\s+[.;:]\s*$/, "");
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
  const normalizedPrefix = normalizeDerivedPathwayCandidate(prefix);
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
  value: string | null | undefined,
  defaultKind: "option" | "track" | "route" | null,
  options: {
    allowBareLabel?: boolean;
  } = {}
) {
  let normalized = normalizeDerivedPathwayCandidate(String(value ?? ""));
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
  value: string | null | undefined,
  defaultKind: "option" | "track" | "route" | null
) {
  let normalized = normalizeDerivedPathwayText(value);
  if (!normalized) {
    return null;
  }

  if (normalized.includes("|")) {
    normalized = normalizeDerivedPathwayText(normalized.split("|")[0]);
  }

  const enumeratedLabelMatch = normalized.match(/^[A-Z]\.\s+(.{2,80})$/);
  if (enumeratedLabelMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, enumeratedLabelMatch[1], defaultKind);
  }

  const degreeTitleMatch = normalized.match(DERIVED_PATHWAY_DEGREE_TITLE_PATTERN);
  if (degreeTitleMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, degreeTitleMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const degreeParenthesesMatch = normalized.match(DERIVED_PATHWAY_DEGREE_PARENTHESES_PATTERN);
  if (degreeParenthesesMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, degreeParenthesesMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const withOptionInMatch = normalized.match(DERIVED_PATHWAY_WITH_OPTION_IN_PATTERN);
  if (withOptionInMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, withOptionInMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const pathwayTitleMatch = normalized.match(/^(?:B\.?\s*A\.?|B\.?\s*S\.?) [^:]{1,80}:\s+(.{2,80})$/i);
  if (pathwayTitleMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, pathwayTitleMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const listLabelMatch = normalized.match(DERIVED_PATHWAY_LIST_LABEL_PATTERN);
  if (listLabelMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, listLabelMatch[1], defaultKind);
  }

  const applyDirectlyMatch = normalized.match(DERIVED_PATHWAY_APPLY_DIRECTLY_PATTERN);
  if (applyDirectlyMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, applyDirectlyMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const credentialMatch = normalized.match(DERIVED_PATHWAY_CREDENTIAL_PATTERN);
  if (credentialMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, credentialMatch[1], defaultKind, {
      allowBareLabel: true,
    });
  }

  const inlineLabelMatch = normalized.match(
    /^([^:]{1,100}\b(?:track|option|route|pathway|certificate|concentration)\b(?:\s*\([^)]{1,40}\))?)\s*:/i
  );
  if (inlineLabelMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, inlineLabelMatch[1], defaultKind);
  }

  if (!DERIVED_PATHWAY_LABEL_PATTERN.test(normalized)) {
    return null;
  }

  return canonicalizeDerivedPathwayCandidate(planId, normalized, defaultKind);
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
      const resolved = canonicalizeDerivedPathwayCandidate(planId, candidate, defaultKind);
      if (resolved) {
        results.push(resolved);
      }
    }
  }

  return results;
}

function buildDerivedPathwaySeeds(
  plan: TransferPlannerMajorPlan,
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
  const defaultKind = inferDerivedPathwayKind(plan.id, stableParsedSourceBlocks);
  const choiceStatements = stableParsedSourceBlocks.flatMap((block) => block.chooseStatements ?? []);
  const orderedSourceLines = stableParsedSourceBlocks.flatMap((block) => [
    block.ownerTitle,
    ...(block.pathwayLabels ?? []),
    ...(block.requirementCueLines ?? []),
    ...(block.chooseStatements ?? []),
  ]);
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

    const similarityKey = getDerivedPathwaySimilarityKey(candidate.label);
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
      statement,
      defaultKind
    )) {
      pushSeed(candidate);
    }
  }

  for (const line of orderedSourceLines) {
    pushSeed(extractDerivedPathwayCandidateFromLine(plan.id, line, defaultKind));
  }

  const seeds = [...seedById.values()].filter(
    (seed) => !isSuspiciousStructuralPathwayLabel(seed.label)
  );
  if (seeds.length < 2) {
    return [] as TransferPlannerDerivedPathwaySeed[];
  }

  return seeds;
}

export function deriveTransferPlannerPathwaySeeds(
  plan: TransferPlannerMajorPlan,
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
) {
  return buildDerivedPathwaySeeds(plan, parsedSourceBlocks);
}

function shouldPreferDerivedPathways(
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
  if (!suspiciousBasePathways.length) {
    return false;
  }

  const semanticDerivedPathways = derivedPathways.filter(
    (pathway) =>
      !isSuspiciousStructuralPathwayId(pathway.id) &&
      !isSuspiciousStructuralPathwayLabel(pathway.label)
  );
  if (semanticDerivedPathways.length < 2) {
    return false;
  }

  const semanticBaseFamilyCount = new Set(
    basePathways
      .filter(
        (pathway) =>
          !isSuspiciousStructuralPathwayId(pathway.id) &&
          !isSuspiciousStructuralPathwayLabel(pathway.label)
      )
      .map((pathway) => getDerivedPathwaySimilarityKey(pathway.label) || pathway.id.toLowerCase())
      .filter(Boolean)
  ).size;

  if (suspiciousBasePathways.length === basePathways.length) {
    return true;
  }

  if (semanticBaseFamilyCount > 0 && semanticDerivedPathways.length >= semanticBaseFamilyCount) {
    return true;
  }

  return semanticDerivedPathways.length >= basePathways.length - suspiciousBasePathways.length;
}

export function materializeTransferPlannerPathways(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
): TransferPlannerMajorPathway[] {
  const derivedPathways = buildDerivedPathwaySeeds(plan, parsedSourceBlocks);
  if (basePathways.length && !shouldPreferDerivedPathways(basePathways, derivedPathways)) {
    if (
      !derivedPathways.length &&
      basePathways.every(
        (pathway) =>
          isSuspiciousStructuralPathwayId(pathway.id) ||
          isSuspiciousStructuralPathwayLabel(pathway.label)
      )
    ) {
      return [];
    }

    return basePathways;
  }

  if (derivedPathways.length) {
    return derivedPathways.map((pathway) => ({
      id: pathway.id,
      label: pathway.label,
      summary: pathway.summary,
      officialLinks: plan.officialLinks,
    }));
  }

  return basePathways;
}

export function countMaterializedTransferPlannerPathways(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
): number {
  return materializeTransferPlannerPathways(plan, basePathways, parsedSourceBlocks).length;
}
