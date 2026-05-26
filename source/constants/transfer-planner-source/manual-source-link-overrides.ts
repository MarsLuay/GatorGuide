import {
  TRANSFER_PLANNER_MANUAL_LINK_OVERRIDES,
  type TransferPlannerManualSourceLinkOverride,
  type TransferPlannerManualSourceLinkOverrideMode,
} from "./manual-source-link-overrides.data";
import type { TransferPlannerSourceLink } from "./schema";

export {
  TRANSFER_PLANNER_MANUAL_LINK_OVERRIDES,
  type TransferPlannerManualSourceLinkOverride,
  type TransferPlannerManualSourceLinkOverrideMode,
} from "./manual-source-link-overrides.data";

function normalizeOwnerPart(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function uniqueSourceLinks(links: TransferPlannerSourceLink[]) {
  const byUrl = new Map<string, TransferPlannerSourceLink>();

  for (const link of links) {
    const url = String(link?.url ?? "").trim();
    if (!url) {
      continue;
    }

    byUrl.set(url, {
      ...link,
      label: String(link?.label ?? "").trim(),
      url,
      note: String(link?.note ?? "").trim() || undefined,
    });
  }

  return [...byUrl.values()];
}

export function getTransferPlannerManualSourceOwnerKey(
  planId: string | null | undefined,
  pathwayId?: string | null
) {
  return `${normalizeOwnerPart(planId)}::${normalizeOwnerPart(pathwayId)}`;
}

export function getTransferPlannerManualSourceLinkOverride(
  planId: string | null | undefined,
  pathwayId?: string | null
) {
  const ownerKey = getTransferPlannerManualSourceOwnerKey(planId, pathwayId);
  return (
    TRANSFER_PLANNER_MANUAL_LINK_OVERRIDES.find(
      (entry) =>
        getTransferPlannerManualSourceOwnerKey(entry.planId, entry.pathwayId ?? null) === ownerKey
    ) ?? null
  );
}

export function getTransferPlannerManualRemovedSourceUrls(
  planId: string | null | undefined,
  pathwayId?: string | null
) {
  return new Set(
    (getTransferPlannerManualSourceLinkOverride(planId, pathwayId)?.removedUrls ?? [])
      .map((url) => String(url ?? "").trim())
      .filter(Boolean)
  );
}

export function getTransferPlannerManualPreferredPrimaryUrl(
  planId: string | null | undefined,
  pathwayId?: string | null
) {
  const override = getTransferPlannerManualSourceLinkOverride(planId, pathwayId);
  const preferredPrimaryUrl = String(override?.preferredPrimaryUrl ?? "").trim();
  return preferredPrimaryUrl || null;
}

export function shouldSkipTransferPlannerAutoPromotedPrimarySource(
  planId: string | null | undefined,
  pathwayId: string | null | undefined,
  url: string | null | undefined
) {
  const override = getTransferPlannerManualSourceLinkOverride(planId, pathwayId ?? null);
  if (!override) {
    return false;
  }

  const normalizedUrl = String(url ?? "").trim();
  if (!normalizedUrl) {
    return false;
  }

  if ((override.mode ?? "merge") === "replace") {
    return true;
  }

  return getTransferPlannerManualRemovedSourceUrls(planId, pathwayId ?? null).has(normalizedUrl);
}

export function applyTransferPlannerManualSourceLinkOverride(
  planId: string | null | undefined,
  pathwayId: string | null | undefined,
  links: TransferPlannerSourceLink[]
) {
  const override = getTransferPlannerManualSourceLinkOverride(planId, pathwayId ?? null);
  if (!override) {
    return uniqueSourceLinks(links);
  }

  const removedUrls = getTransferPlannerManualRemovedSourceUrls(planId, pathwayId ?? null);
  const baseLinks =
    (override.mode ?? "merge") === "replace"
      ? []
      : uniqueSourceLinks(links).filter((link) => !removedUrls.has(link.url));

  return uniqueSourceLinks([...(baseLinks ?? []), ...uniqueSourceLinks(override.links ?? [])]);
}
