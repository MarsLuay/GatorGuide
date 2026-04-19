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

const PLAN_TITLE_PREFIX_SEPARATORS = [" - ", " – ", " — ", ": "];

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

export function decodeTransferPlannerHtmlEntities(value: string | null | undefined) {
  return String(value ?? "")
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

export function stripTransferPlannerPlanTitlePrefix(
  planTitle: string | null | undefined,
  value: string | null | undefined
) {
  const normalizedValue = normalizeTransferPlannerText(value);
  const normalizedPlanTitle = normalizeTransferPlannerText(planTitle);
  const planTitleVariants = Array.from(
    new Set(
      [
        normalizedPlanTitle,
        normalizedPlanTitle.replace(/\s*\([^)]*\)\s*$/, ""),
      ].filter(Boolean)
    )
  );

  if (!planTitleVariants.length) {
    return normalizedValue;
  }

  for (const normalizedTitle of planTitleVariants) {
    if (normalizedValue === normalizedTitle) {
      return "";
    }

    for (const separator of PLAN_TITLE_PREFIX_SEPARATORS) {
      const prefix = `${normalizedTitle}${separator}`;
      if (normalizedValue.startsWith(prefix)) {
        return normalizedValue.slice(prefix.length).trim();
      }
    }
  }

  return normalizedValue;
}

export function hasTransferPlannerHtmlEntityLeak(value: string | null | undefined) {
  return /&#(?:x[0-9a-f]+|\d+);|&(?:amp|apos|gt|lt|mdash|nbsp|ndash|quot|rdquo|rsquo|ldquo|lsquo);/i.test(
    String(value ?? "")
  );
}
