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

const DERIVED_PATHWAY_LABEL_PATTERN = /\b(track|option|route|pathway|certificate)\b/i;
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
  /^capstone experience\b/i,
  /^contact the\b/i,
  /^degree options?\b/i,
  /^formal options?\b/i,
  /^gis certificate\b.*complete all\b/i,
  /^foundation courses?\b/i,
  /^gis certificate classes\b/i,
  /^in addition to\b/i,
  /^students declare\b/i,
  /^the curriculum consists\b/i,
  /^why choose\b/i,
];
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

function normalizeDerivedPathwayText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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
    .replace(/^(?:B\.?\s*A\.?|B\.?\s*S\.?) [^:]{1,80}:\s*/i, "")
    .replace(/\s+\((?:\d+(?:-\d+)?\s+credits?)\)\s*$/i, "")
    .replace(/\s+\|\s+.*$/, "")
    .replace(/\s+[.;:]\s*$/, "");
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
  defaultKind: "option" | "track" | "route" | null
) {
  let normalized = normalizeDerivedPathwayCandidate(String(value ?? ""));
  if (!normalized) {
    return null;
  }

  if (DERIVED_PATHWAY_GENERIC_LABEL_PATTERNS.some((pattern) => pattern.test(normalized))) {
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

  const pathwayTitleMatch = normalized.match(/^(?:B\.?\s*A\.?|B\.?\s*S\.?) [^:]{1,80}:\s+(.{2,80})$/i);
  if (pathwayTitleMatch) {
    return canonicalizeDerivedPathwayCandidate(planId, pathwayTitleMatch[1], defaultKind);
  }

  const inlineLabelMatch = normalized.match(
    /^([^:]{1,80}\b(?:track|option|route|pathway|certificate))\s*:/i
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
  if (!normalized || !/\s+or\s+/i.test(normalized)) {
    return [];
  }

  return normalized
    .split(/\s+(?:or|and\/or)\s+/i)
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
  const defaultKind = inferDerivedPathwayKind(plan.id, parsedSourceBlocks);
  const choiceStatements = parsedSourceBlocks.flatMap((block) => block.chooseStatements ?? []);
  const orderedSourceLines = parsedSourceBlocks.flatMap((block) => [
    ...(block.pathwayLabels ?? []),
    ...(block.requirementCueLines ?? []),
    ...(block.chooseStatements ?? []),
  ]);
  const seenIds = new Set<string>();
  const seeds: TransferPlannerDerivedPathwaySeed[] = [];

  function pushSeed(candidate: { id: string; label: string } | null) {
    if (!candidate || seenIds.has(candidate.id)) {
      return;
    }

    seenIds.add(candidate.id);
    seeds.push({
      id: candidate.id,
      label: candidate.label,
      summary: "",
    });
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

export function materializeTransferPlannerPathways(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
): TransferPlannerMajorPathway[] {
  if (basePathways.length) {
    return basePathways;
  }

  const derivedPathways = buildDerivedPathwaySeeds(plan, parsedSourceBlocks);
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
