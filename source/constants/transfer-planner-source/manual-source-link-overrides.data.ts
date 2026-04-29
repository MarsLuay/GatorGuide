import type { TransferPlannerSourceLink } from "./schema";

export type TransferPlannerManualSourceLinkOverrideMode = "merge" | "replace";

export type TransferPlannerManualSourceLinkOverride = {
  planId: string;
  pathwayId?: string | null;
  mode?: TransferPlannerManualSourceLinkOverrideMode;
  preferredPrimaryUrl?: string | null;
  removedUrls?: string[];
  links?: TransferPlannerSourceLink[];
};

export const TRANSFER_PLANNER_MANUAL_SOURCE_LINK_OVERRIDES: TransferPlannerManualSourceLinkOverride[] =
  [];
