const TRANSFER_PLANNER_PATHWAY_ID_ALIASES_BY_PLAN: Record<string, Record<string, string>> = {
  "uw-seattle-cinema-and-media-studies": {
    "ba-option-family-cinema-studies": "cinema-studies",
    "ba-option-family:cinema-studies": "cinema-studies",
  },
  "uw-seattle-construction-management": {
    "early-admission-option": "early-admission-pathway",
    "freshmen-direct-option": "freshmen-direct-pathway",
    "upper-division-admission-option": "upper-division-admission-pathway",
  },
  "uw-seattle-economics": {
    "strategy": "bs-option-family:strategy",
    "bs-option-family-strategy": "bs-option-family:strategy",
  },
  "uw-seattle-geography": {
    "ba-option-family-in-geography-data-science": "geography-major-data-science-option",
    "ba-option-family:in-geography-data-science": "geography-major-data-science-option",
    "ba-option-family-in-geography-with-data-science": "geography-major-data-science-option",
    "ba-option-family:in-geography-with-data-science": "geography-major-data-science-option",
    "ccm-track": "cities-citizenship-and-migration-track",
    "citizenship-and-migration-ccm-track": "cities-citizenship-and-migration-track",
    "citizenship-and-migration-track": "cities-citizenship-and-migration-track",
    "data-science-option": "geography-major-data-science-option",
    "economy-and-sustainability-ees-track": "environment-economy-and-sustainability-track",
    "economy-and-sustainability-track": "environment-economy-and-sustainability-track",
    "health-and-development-track": "globalization-health-and-development-track",
    "mapping-and-society-gms-track": "gis-mapping-and-society-track",
    "mapping-and-society-track": "gis-mapping-and-society-track",
    "the-requirements-for-geography-majors-with-the-option-in-data-science-are-as-follows": "geography-major-data-science-option",
  },
  "uw-seattle-biology": {
    "bs-option-family-general": "bs-option-family:general-biology",
    "bs-option-family:general": "bs-option-family:general-biology",
    "bs-option-family-plant": "bs-option-family:plant-biology",
    "bs-option-family:plant": "bs-option-family:plant-biology",
  },
  "uw-seattle-chemical-engineering": {
    "nanoscience-and-molecular-engineering-nme-option": "nme-option",
    "nanoscience-and-molecular-engineering-option": "nme-option",
  },
  "uw-seattle-materials-science-engineering": {
    "nanoscience-and-molecular-engineering-nme-option": "nme-option",
    "nanoscience-and-molecular-engineering-option": "nme-option",
  },
  "uw-tacoma-history": {
    "culture-and-society-option": "arts-culture-and-society-option",
    "gender-and-identity-option": "power-gender-and-identity-option",
  },
  "uw-tacoma-writing-studies": {
    "grassroots-activism-and-community-organizing-this-track-centers-integrative-and-inclusive-pedagogy": "writing-and-social-change-track",
    "rhetoric-writing-and-social-change-track": "writing-and-social-change-track",
    "to-complete-a-ba-in-the-technical-communication-track": "technical-communication-track",
    "to-complete-a-ba-in-the-technical-communication-track-of-writing-studies": "technical-communication-track",
  },
};

function normalizeTransferPlannerPathwayIdToken(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function trimTransferPlannerPathwayId(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function normalizeTransferPlannerPlanId(value: string | null | undefined) {
  return String(value ?? "").trim();
}

export function normalizeTransferPlannerPathwayId(
  planId: string | null | undefined,
  pathwayId: string | null | undefined
) {
  const trimmedPathwayId = trimTransferPlannerPathwayId(pathwayId);
  if (!trimmedPathwayId) {
    return null;
  }

  const normalizedPlanId = normalizeTransferPlannerPlanId(planId);
  const normalizedPathwayId = normalizeTransferPlannerPathwayIdToken(trimmedPathwayId);
  return (
    TRANSFER_PLANNER_PATHWAY_ID_ALIASES_BY_PLAN[normalizedPlanId]?.[normalizedPathwayId] ??
    trimmedPathwayId
  );
}

export function buildTransferPlannerOwnerId(
  planId: string | null | undefined,
  pathwayId: string | null | undefined
) {
  const normalizedPlanId = normalizeTransferPlannerPlanId(planId);
  const normalizedPathwayId = normalizeTransferPlannerPathwayId(
    normalizedPlanId,
    pathwayId
  );
  return normalizedPathwayId
    ? `${normalizedPlanId}:pathway:${normalizedPathwayId}`
    : normalizedPlanId;
}

export function normalizeTransferPlannerOwnerId(
  ownerId: string | null | undefined,
  planId?: string | null,
  pathwayId?: string | null
) {
  const explicitPlanId = normalizeTransferPlannerPlanId(planId);
  const normalizedOwnerId = String(ownerId ?? "").trim();
  const pathwaySeparator = ":pathway:";
  const pathwayIndex = normalizedOwnerId.indexOf(pathwaySeparator);

  if (explicitPlanId && (pathwayId != null || pathwayIndex === -1)) {
    return buildTransferPlannerOwnerId(explicitPlanId, pathwayId ?? null);
  }

  if (pathwayIndex === -1) {
    return explicitPlanId || normalizedOwnerId;
  }

  return buildTransferPlannerOwnerId(
    normalizedOwnerId.slice(0, pathwayIndex),
    normalizedOwnerId.slice(pathwayIndex + pathwaySeparator.length)
  );
}
