const TRANSFER_PLANNER_PATHWAY_ID_ALIASES_BY_PLAN: Record<string, Record<string, string>> = {
  "uw-seattle-cinema-and-media-studies": {
    "ba-option-family-cinema-studies": "cinema-studies",
    "ba-option-family:cinema-studies": "cinema-studies",
  },
  "uw-seattle-construction-management": {
    "early-admission-pathway": "early-admission-option",
    "freshmen-direct-pathway": "freshmen-direct-option",
    "upper-division-admission-pathway": "upper-division-admission-option",
  },
  "uw-seattle-geography": {
    "ba-option-family-in-geography-data-science": "data-science-option",
    "ba-option-family:in-geography-data-science": "data-science-option",
    "geography-major-data-science-option": "data-science-option",
  },
  "uw-seattle-chemical-engineering": {
    "nanoscience-and-molecular-engineering-nme-option": "nme-option",
    "nanoscience-and-molecular-engineering-option": "nme-option",
  },
  "uw-seattle-materials-science-engineering": {
    "nanoscience-and-molecular-engineering-nme-option": "nme-option",
    "nanoscience-and-molecular-engineering-option": "nme-option",
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
