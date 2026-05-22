const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  mdash: "-",
  nbsp: " ",
  ndash: "-",
  quot: '"',
  rdquo: '"',
  rsquo: "'",
  ldquo: '"',
  lsquo: "'",
};

const LOOSE_HTML_ENTITY_ARTIFACT_MAP: Record<string, string> = {
  "160": " ",
  "8211": " - ",
  "8212": " - ",
  "8216": "'",
  "8217": "'",
  "8220": '"',
  "8221": '"',
};

const TITLE_SIGNATURE_STOPWORDS = new Set([
  "and",
  "arts",
  "baseline",
  "culture",
  "degree",
  "finish",
  "major",
  "media",
  "overall",
  "requirement",
  "requirements",
  "shared",
  "studies",
  "study",
  "the",
]);

const PLAN_TITLE_PREFIX_SEPARATORS = [" - ", " – ", " — ", ": "];
const SEMANTIC_PATHWAY_DOCUMENT_SUFFIX_PATTERN =
  /\s*(?:\[(?:pdf|docx?|html?)\]|\((?:pdf|docx?|html?)\)|\b(?:pdf|docx?|html)\b)\s*$/i;
const SEMANTIC_PATHWAY_DOCUMENT_TITLE_SUFFIX_PATTERN =
  /\s+(?:degree\s+program\s+sheet|program\s+sheet|degree\s+sheet|worksheet|check\s*list|checklist)\b.*$/i;
const SEMANTIC_PATHWAY_REQUIREMENTS_SUFFIX_PATTERN =
  /\b(option|track|route|pathway|certificate|concentration)\b(?:\s*[:\-]\s*|\s+)(?:older\s+|prior\s+|current\s+|academic\s+|course\s+|program\s+|degree\s+|major\s+|graduation\s+)*requirements?\b.*$/i;
const SEMANTIC_PATHWAY_DATE_SUFFIX_PATTERN =
  /\b(option|track|route|pathway|certificate|concentration)\b(?:\s+(?:autumn|winter|spring|summer|fall)\s+\d{4})+(?:\s*[-\u2013\u2014]\s*(?:autumn|winter|spring|summer|fall)\s+\d{4})?\s*$/i;
const SEMANTIC_PATHWAY_TRAILING_SITE_SUFFIX_PATTERN =
  /\s+[-\u2013\u2014]\s+(?:UW|University of Washington)\b.*$/i;
const SEMANTIC_PATHWAY_WITH_KIND_IN_PATTERN =
  /^(?:.*?\bwith\s+(option|track|route|pathway|certificate|concentration)\s+in\s+)(.{2,100})$/i;

function decodeNumericHtmlEntity(rawEntity: string) {
  const normalizedEntity = String(rawEntity ?? "").trim().toLowerCase();
  const isHex = normalizedEntity.startsWith("#x");
  const numericValue = Number.parseInt(
    normalizedEntity.slice(isHex ? 2 : 1),
    isHex ? 16 : 10
  );
  if (!Number.isFinite(numericValue)) {
    return `&${rawEntity};`;
  }

  try {
    return String.fromCodePoint(numericValue);
  } catch {
    return `&${rawEntity};`;
  }
}

function repairTransferPlannerLooseHtmlEntityArtifacts(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/â€“|â€”/g, " - ")
    .replace(/â€˜|â€™/g, "'")
    .replace(/â€œ|â€�/g, '"')
    .replace(
      /(^|[\s([{,;:])(?:(?:and\s+|amp\s+|&\s*|#\s*)(160)|(?:and\s+|amp\s+|&\s*|#\s*)?(8211|8212|8216|8217|8220|8221))(?=$|[\s)\]},;:!?])/gi,
      (match, prefix, explicitNbspEntity, punctuationEntity) => {
        const entity = explicitNbspEntity ?? punctuationEntity;
        return `${prefix}${LOOSE_HTML_ENTITY_ARTIFACT_MAP[String(entity)] ?? entity}`;
      }
    );
}

export function decodeTransferPlannerHtmlEntities(value: string | null | undefined) {
  return repairTransferPlannerLooseHtmlEntityArtifacts(value)
    .replace(/&#x[0-9a-f]+;|&#\d+;/gi, (match) =>
      decodeNumericHtmlEntity(match.slice(1, -1))
    )
    .replace(/&([a-z]+);/gi, (match, entity) => HTML_ENTITY_MAP[String(entity).toLowerCase()] ?? match)
    .replace(/\u00a0/g, " ");
}

export function normalizeTransferPlannerText(value: string | null | undefined) {
  return decodeTransferPlannerHtmlEntities(value)
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]+/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeTransferPlannerText(value: string | null | undefined) {
  return normalizeTransferPlannerText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function getTransferPlannerPlanTitleEntries(
  titlesByPlanId: ReadonlyMap<string, string> | Record<string, string>
) {
  if (titlesByPlanId instanceof Map) {
    return [...titlesByPlanId.entries()];
  }

  return Object.entries(titlesByPlanId);
}

function getTransferPlannerPlanTitle(
  titlesByPlanId: ReadonlyMap<string, string> | Record<string, string>,
  planId: string
) {
  if (titlesByPlanId instanceof Map) {
    return titlesByPlanId.get(planId) ?? "";
  }

  const titleRecord = titlesByPlanId as Record<string, string>;
  return String(titleRecord[planId] ?? "");
}

function getNormalizedTransferPlannerPlanTitleVariants(title: string | null | undefined) {
  const normalizedTitle = normalizeTransferPlannerText(title).toLowerCase();
  const baseVariants = [
    normalizedTitle,
    normalizedTitle.replace(/\s*\([^)]*\)\s*$/, ""),
  ].filter(Boolean);
  return Array.from(
    new Set(
      baseVariants.flatMap((variant) => [
        variant,
        variant.replace(/\bcommunication\b/g, "communications"),
        variant.replace(/\bcommunications\b/g, "communication"),
      ])
    )
  );
}

function containsNormalizedPlanTitlePhrase(
  normalizedLabel: string,
  normalizedTitleVariant: string
) {
  if (!normalizedLabel || !normalizedTitleVariant) {
    return false;
  }

  const escapedTitle = normalizedTitleVariant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escapedTitle}(?:$|[^a-z0-9])`, "i").test(
    normalizedLabel
  );
}

export function buildTransferPlannerTitleSignatureTokens(value: string | null | undefined) {
  return tokenizeTransferPlannerText(value).filter(
    (token) => token.length >= 4 && !TITLE_SIGNATURE_STOPWORDS.has(token)
  );
}

export function stripTransferPlannerPlanTitlePrefix(
  planTitle: string | null | undefined,
  value: string | null | undefined
) {
  const normalizedValue = normalizeTransferPlannerText(value);
  const normalizedValueForMatch = normalizedValue.toLowerCase();
  const planTitleVariants = getNormalizedTransferPlannerPlanTitleVariants(planTitle);

  if (!planTitleVariants.length) {
    return normalizedValue;
  }

  for (const normalizedTitle of planTitleVariants) {
    if (normalizedValueForMatch === normalizedTitle) {
      return "";
    }

    for (const separator of PLAN_TITLE_PREFIX_SEPARATORS) {
      const prefix = `${normalizedTitle}${separator}`;
      if (normalizedValueForMatch.startsWith(prefix)) {
        return normalizedValue.slice(prefix.length).trim();
      }
    }
  }

  return normalizedValue;
}

export function stripTransferPlannerPlanTitlePrefixRepeatedly(
  planTitle: string | null | undefined,
  value: string | null | undefined
) {
  let previous = normalizeTransferPlannerText(value);
  if (!previous) {
    return "";
  }

  while (true) {
    const next = stripTransferPlannerPlanTitlePrefix(planTitle, previous);
    if (!next || next === previous) {
      return next || previous;
    }
    previous = next;
  }
}

export function normalizeTransferPlannerSemanticPathwayLabel(
  planTitle: string | null | undefined,
  value: string | null | undefined
) {
  const normalized = normalizeTransferPlannerText(value);
  if (!normalized) {
    return "";
  }

  const cleaned = normalized
    .replace(SEMANTIC_PATHWAY_WITH_KIND_IN_PATTERN, "$2 $1")
    .replace(SEMANTIC_PATHWAY_TRAILING_SITE_SUFFIX_PATTERN, "")
    .replace(SEMANTIC_PATHWAY_DOCUMENT_TITLE_SUFFIX_PATTERN, "")
    .replace(SEMANTIC_PATHWAY_DOCUMENT_SUFFIX_PATTERN, "")
    .replace(SEMANTIC_PATHWAY_REQUIREMENTS_SUFFIX_PATTERN, "$1")
    .replace(SEMANTIC_PATHWAY_DATE_SUFFIX_PATTERN, "$1")
    .replace(/^requirements?\s+for\s+(?:the\s+)?/i, "")
    .replace(/\b(option|track|route|pathway|certificate|concentration)\b\s+[-â€“â€”]\s+.*$/i, "$1")
    .replace(/\b(option|track|route|pathway|certificate|concentration)\b\s+[-\u2013\u2014]\s+.*$/i, "$1")
    .replace(/\s+\((?:\d+(?:-\d+)?\s+credits?)\)\s*$/i, "")
    .replace(/\s+[.;:]\s*$/, "")
    .trim();

  return stripTransferPlannerPlanTitlePrefixRepeatedly(planTitle, cleaned);
}

export function labelMentionsDifferentTransferPlannerMajor(
  currentPlanId: string,
  label: string | null | undefined,
  titlesByPlanId: ReadonlyMap<string, string> | Record<string, string>
) {
  const normalizedLabel = normalizeTransferPlannerText(label).toLowerCase();
  if (!normalizedLabel) {
    return false;
  }

  const labelTokens = new Set(tokenizeTransferPlannerText(normalizedLabel));
  const currentPlanTokens = new Set(
    buildTransferPlannerTitleSignatureTokens(
      getTransferPlannerPlanTitle(titlesByPlanId, currentPlanId)
    )
  );
  const currentTitleVariants = getNormalizedTransferPlannerPlanTitleVariants(
    getTransferPlannerPlanTitle(titlesByPlanId, currentPlanId)
  );

  for (const [planId, title] of getTransferPlannerPlanTitleEntries(titlesByPlanId)) {
    if (planId === currentPlanId) {
      continue;
    }

    for (const titleVariant of getNormalizedTransferPlannerPlanTitleVariants(title)) {
      const normalizedTitleWordCount = titleVariant.split(/\s+/).filter(Boolean).length;
      if (normalizedTitleWordCount < 2) {
        continue;
      }

      const sharesCurrentTitleFamily = currentTitleVariants.some(
        (currentVariant) =>
          titleVariant === currentVariant ||
          titleVariant.startsWith(`${currentVariant} `) ||
          currentVariant.startsWith(`${titleVariant} `)
      );
      if (sharesCurrentTitleFamily) {
        continue;
      }

      const otherPlanTokens = buildTransferPlannerTitleSignatureTokens(title);
      if (
        otherPlanTokens.every((token) => currentPlanTokens.has(token)) ||
        !otherPlanTokens.some((token) => !currentPlanTokens.has(token))
      ) {
        continue;
      }

      if (containsNormalizedPlanTitlePhrase(normalizedLabel, titleVariant)) {
        return true;
      }
    }
  }

  if ([...currentPlanTokens].some((token) => labelTokens.has(token))) {
    return false;
  }

  for (const [planId, title] of getTransferPlannerPlanTitleEntries(titlesByPlanId)) {
    if (planId === currentPlanId) {
      continue;
    }

    const normalizedTitle = normalizeTransferPlannerText(title).toLowerCase();
    if (!normalizedTitle) {
      continue;
    }

    const otherPlanTokens = buildTransferPlannerTitleSignatureTokens(title);
    const normalizedTitleVariants = getNormalizedTransferPlannerPlanTitleVariants(title);
    for (const titleVariant of normalizedTitleVariants) {
      if (
        normalizedLabel === titleVariant ||
        normalizedLabel.startsWith(`${titleVariant} - `) ||
        normalizedLabel.startsWith(`${titleVariant}: `)
      ) {
        return true;
      }

      const normalizedTitleWordCount = titleVariant.split(/\s+/).filter(Boolean).length;
      const titlePathwayPrefixPattern = new RegExp(
        `^${titleVariant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(?:option|track|route|pathway|certificate|concentration)\\b`,
        "i"
      );
      if (normalizedTitleWordCount >= 2 && titlePathwayPrefixPattern.test(normalizedLabel)) {
        return true;
      }
    }

    if (!otherPlanTokens.length) {
      continue;
    }

    const looksLikeStandalonePathwayLabel =
      /\b(?:option|track|route|pathway|certificate|concentration)\b/i.test(normalizedLabel) &&
      !/(?:\s[-\u2013\u2014:]\s|\|)|\bmajor\b/i.test(normalizedLabel);
    const minimumMatches =
      looksLikeStandalonePathwayLabel && otherPlanTokens.length === 1
        ? 2
        : Math.min(2, otherPlanTokens.length);
    const overlapCount = otherPlanTokens.filter((token) => labelTokens.has(token)).length;
    if (overlapCount >= minimumMatches) {
      return true;
    }
  }

  return false;
}

export function hasTransferPlannerHtmlEntityLeak(value: string | null | undefined) {
  return /&#(?:x[0-9a-f]+|\d+);|&(?:amp|apos|gt|lt|mdash|nbsp|ndash|quot|rdquo|rsquo|ldquo|lsquo);/i.test(
    String(value ?? "")
  );
}
