const fs = require("fs");
const path = require("path");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const {
  TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS,
  TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY,
} = require("../../constants/transfer-planner-source");
const {
  TRANSFER_PLANNER_BOOTSTRAP_TRACKS,
} = require("../../constants/transfer-planner-source/bootstrap.generated");
const {
  TRANSFER_PLANNER_MANUAL_SOURCE_LINK_OVERRIDES,
  getTransferPlannerManualPreferredPrimaryUrl,
  getTransferPlannerManualSourceLinkOverride,
  getTransferPlannerManualSourceOwnerKey,
} = require("../../constants/transfer-planner-source/manual-source-link-overrides");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OVERRIDE_DATA_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "manual-source-link-overrides.data.ts"
);

const CAMPUS_TITLE_BY_ID = {
  "uw-seattle": "UW Seattle",
  "uw-bothell": "UW Bothell",
  "uw-tacoma": "UW Tacoma",
};
const UW_INSTITUTION_ID = "university-of-washington";
const GRC_INSTITUTION_ID = "green-river-college";
const INSTITUTION_LABEL_BY_ID = {
  [UW_INSTITUTION_ID]: "University of Washington",
  [GRC_INSTITUTION_ID]: "Green River College",
};
const UW_CAMPUS_ORDER = ["uw-seattle", "uw-bothell", "uw-tacoma"];
const GRC_PROGRAM_GROUP_LABEL_BY_ID = {
  "business-entrepreneurship": "Business & Entrepreneurship",
  "education-law-social-science": "Education, Law & Social Science",
  "fine-arts-humanities": "Fine Arts & Humanities",
  "healthcare-wellness": "Healthcare & Wellness",
  stem: "STEM",
  "trades-industrial-tech-aviation-natural-resources":
    "Trades, Industrial Tech, Aviation & Natural Resources",
  undecided: "Undecided",
  "green-river-programs": "Green River Programs",
};
const GRC_PROGRAM_GROUP_ORDER = Object.keys(GRC_PROGRAM_GROUP_LABEL_BY_ID);

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

function getArgValue(flag) {
  const args = process.argv.slice(2);
  const directPrefix = `${flag}=`;
  const directMatch = args.find((arg) => arg.startsWith(directPrefix));
  if (directMatch) {
    return directMatch.slice(directPrefix.length).trim() || null;
  }

  const flagIndex = args.indexOf(flag);
  if (flagIndex === -1) {
    return null;
  }

  const nextValue = args[flagIndex + 1];
  if (!nextValue || nextValue.startsWith("--")) {
    return null;
  }

  return String(nextValue).trim() || null;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueLinks(links) {
  const byUrl = new Map();

  for (const link of Array.isArray(links) ? links : []) {
    const url = normalizeText(link?.url);
    if (!url) {
      continue;
    }

    byUrl.set(url, {
      label: normalizeText(link?.label),
      url,
      note: normalizeText(link?.note) || undefined,
    });
  }

  return [...byUrl.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function humanizeSlug(value) {
  return normalizeText(value)
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (["AAA", "AAS", "DTA", "GRC", "MRP", "STEM", "UW"].includes(upper)) {
        return upper;
      }
      return upper.charAt(0) + upper.slice(1).toLowerCase();
    })
    .join(" ");
}

function compareByPreferredOrder(left, right, preferredOrder) {
  const leftIndex = preferredOrder.indexOf(left);
  const rightIndex = preferredOrder.indexOf(right);
  if (leftIndex >= 0 || rightIndex >= 0) {
    const safeLeftIndex = leftIndex >= 0 ? leftIndex : Number.MAX_SAFE_INTEGER;
    const safeRightIndex = rightIndex >= 0 ? rightIndex : Number.MAX_SAFE_INTEGER;
    if (safeLeftIndex !== safeRightIndex) {
      return safeLeftIndex - safeRightIndex;
    }
  }

  return String(left).localeCompare(String(right));
}

function getSourceManifestEntriesForOwner(ownerId, ownerType) {
  return TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
    (entry) =>
      entry.ownerId === ownerId &&
      entry.ownerType === ownerType &&
      !normalizeText(entry.pathwayId)
  );
}

function getPrimarySourceManifestEntryForOwner(ownerId, ownerType) {
  return (
    getSourceManifestEntriesForOwner(ownerId, ownerType).find(
      (entry) => entry.isPrimaryDegreeRequirementsLink
    ) ?? null
  );
}

function getGreenRiverProgramGroupId(track) {
  const officialUrl = normalizeText(track?.officialLinks?.[0]?.url);
  const urlMatch = officialUrl.match(/\/program-maps\/([^/]+)/i);
  if (urlMatch) {
    return slugify(urlMatch[1]) || "green-river-programs";
  }

  const normalizedTrackId = normalizeText(track?.id).toLowerCase();
  for (const groupId of GRC_PROGRAM_GROUP_ORDER) {
    if (normalizedTrackId.includes(groupId)) {
      return groupId;
    }
  }

  return "green-river-programs";
}

function getGreenRiverProgramGroupLabel(groupId) {
  return GRC_PROGRAM_GROUP_LABEL_BY_ID[groupId] ?? humanizeSlug(groupId);
}

function buildFlatInventoryItems() {
  const items = [];
  const planById = new Map(
    TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.map((plan) => [plan.id, plan])
  );
  const supplementalMajorOwnersById = new Map(
    TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
      (entry) =>
        entry.ownerType === "major" &&
        !normalizeText(entry.pathwayId) &&
        !planById.has(entry.ownerId)
    ).map((entry) => [entry.ownerId, entry])
  );

  for (const plan of TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS) {
    items.push({
      planId: plan.id,
      title: normalizeText(plan.title),
      ownerType: "major",
      institutionId: UW_INSTITUTION_ID,
      institutionLabel: INSTITUTION_LABEL_BY_ID[UW_INSTITUTION_ID],
      groupId: plan.campusId,
      groupLabel: CAMPUS_TITLE_BY_ID[plan.campusId] ?? plan.campusId,
      groupKind: "campus",
      itemKind: "major",
      isGeneratedPlan: true,
      campusId: plan.campusId,
      primarySourceUrl:
        normalizeText(getPrimarySourceManifestEntryForOwner(plan.id, "major")?.url) || null,
    });
  }

  for (const manifestEntry of supplementalMajorOwnersById.values()) {
    const campusId = normalizeText(manifestEntry.campusId);
    if (!campusId || !CAMPUS_TITLE_BY_ID[campusId]) {
      continue;
    }

    items.push({
      planId: manifestEntry.ownerId,
      title: normalizeText(manifestEntry.ownerTitle),
      ownerType: "major",
      institutionId: UW_INSTITUTION_ID,
      institutionLabel: INSTITUTION_LABEL_BY_ID[UW_INSTITUTION_ID],
      groupId: campusId,
      groupLabel: CAMPUS_TITLE_BY_ID[campusId] ?? campusId,
      groupKind: "campus",
      itemKind: "major",
      isGeneratedPlan: false,
      campusId,
      primarySourceUrl:
        normalizeText(getPrimarySourceManifestEntryForOwner(manifestEntry.ownerId, "major")?.url) ||
        null,
    });
  }

  for (const track of TRANSFER_PLANNER_BOOTSTRAP_TRACKS) {
    const groupId = getGreenRiverProgramGroupId(track);
    items.push({
      planId: track.id,
      title: normalizeText(track.title),
      ownerType: "track",
      institutionId: GRC_INSTITUTION_ID,
      institutionLabel: INSTITUTION_LABEL_BY_ID[GRC_INSTITUTION_ID],
      groupId,
      groupLabel: getGreenRiverProgramGroupLabel(groupId),
      groupKind: "program-group",
      itemKind: "program",
      isGeneratedPlan: false,
      campusId: "grc",
      primarySourceUrl:
        normalizeText(getPrimarySourceManifestEntryForOwner(track.id, "track")?.url) || null,
    });
  }

  return items.sort((left, right) =>
    compareByPreferredOrder(
      left.institutionId,
      right.institutionId,
      [UW_INSTITUTION_ID, GRC_INSTITUTION_ID]
    ) ||
    (left.institutionId === UW_INSTITUTION_ID
      ? compareByPreferredOrder(left.groupId, right.groupId, UW_CAMPUS_ORDER)
      : compareByPreferredOrder(left.groupId, right.groupId, GRC_PROGRAM_GROUP_ORDER)) ||
    left.title.localeCompare(right.title)
  );
}

function buildMajorInventory() {
  const institutions = [
    {
      id: UW_INSTITUTION_ID,
      label: INSTITUTION_LABEL_BY_ID[UW_INSTITUTION_ID],
      groupPromptLabel: "campus",
      itemPromptLabel: "major",
      groupOrder: UW_CAMPUS_ORDER,
    },
    {
      id: GRC_INSTITUTION_ID,
      label: INSTITUTION_LABEL_BY_ID[GRC_INSTITUTION_ID],
      groupPromptLabel: "program group",
      itemPromptLabel: "program",
      groupOrder: GRC_PROGRAM_GROUP_ORDER,
    },
  ];
  const flatItems = buildFlatInventoryItems();

  return {
    institutions: institutions
      .map((institution) => {
        const groupsById = new Map();
        const scopedItems = flatItems.filter((item) => item.institutionId === institution.id);

        for (const item of scopedItems) {
          if (!groupsById.has(item.groupId)) {
            groupsById.set(item.groupId, {
              id: item.groupId,
              label: item.groupLabel,
              items: [],
            });
          }

          groupsById.get(item.groupId).items.push(item);
        }

        return {
          id: institution.id,
          label: institution.label,
          groupPromptLabel: institution.groupPromptLabel,
          itemPromptLabel: institution.itemPromptLabel,
          groups: [...groupsById.values()].sort((left, right) =>
            compareByPreferredOrder(left.id, right.id, institution.groupOrder)
          ),
        };
      })
      .filter((institution) => institution.groups.length > 0),
  };
}

function classifyManifestSource(entry, manualOverride) {
  if ((manualOverride?.links ?? []).some((link) => normalizeText(link.url) === entry.url)) {
    return "manual override";
  }

  if (
    normalizeText(entry?.validationNotes?.join(" ")).includes(
      "Auto-promoted from high-confidence discovery"
    )
  ) {
    return "auto-promoted";
  }

  return "generated manifest";
}

function getPlanDetails(planId) {
  const inventoryEntry = buildMajorInventory().institutions
    .flatMap((institution) => institution.groups.flatMap((group) => group.items))
    .find((item) => item.planId === planId);
  const plan = TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS.find((entry) => entry.id === planId);
  const track = TRANSFER_PLANNER_BOOTSTRAP_TRACKS.find((entry) => entry.id === planId);
  const ownerType = inventoryEntry?.ownerType ?? (track ? "track" : "major");
  const manualOverride = getTransferPlannerManualSourceLinkOverride(planId, null);
  const manifestEntries = getSourceManifestEntriesForOwner(planId, ownerType)
    .map((entry) => ({
      label: entry.label,
      url: entry.url,
      note: entry.note ?? null,
      role: entry.role,
      parserType: entry.parserType,
      confidence: entry.confidence,
      isPrimary: entry.isPrimaryDegreeRequirementsLink,
      sourceKind: classifyManifestSource(entry, manualOverride),
    }))
    .sort((left, right) =>
      Number(right.isPrimary) - Number(left.isPrimary) ||
      left.label.localeCompare(right.label) ||
      left.url.localeCompare(right.url)
    );

  if (!inventoryEntry && !plan && !track && manifestEntries.length === 0) {
    throw new Error(`Unknown planId "${planId}".`);
  }

  const groupKind = inventoryEntry?.groupKind ?? (track ? "program-group" : "campus");
  const groupLabel =
    inventoryEntry?.groupLabel ??
    (track ? "Green River Programs" : CAMPUS_TITLE_BY_ID[plan?.campusId] ?? "Unknown group");
  const institutionId = inventoryEntry?.institutionId ?? (track ? GRC_INSTITUTION_ID : UW_INSTITUTION_ID);

  return {
    planId,
    title: normalizeText(inventoryEntry?.title ?? plan?.title ?? track?.title ?? planId),
    ownerType,
    institutionId,
    institutionLabel: INSTITUTION_LABEL_BY_ID[institutionId] ?? institutionId,
    campusId: normalizeText(inventoryEntry?.campusId ?? plan?.campusId ?? "grc") || null,
    campusTitle:
      ownerType === "major"
        ? CAMPUS_TITLE_BY_ID[inventoryEntry?.campusId ?? plan?.campusId] ??
          inventoryEntry?.groupLabel ??
          null
        : "Green River College",
    groupId: inventoryEntry?.groupId ?? null,
    groupLabel,
    groupKind,
    itemKindLabel: ownerType === "track" ? "Program" : "Major",
    sourceOfTruthPath: OVERRIDE_DATA_PATH,
    regenerationRequired: true,
    automaticValidationCommand:
      "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-transfer-planner-refresh.ps1 -SkipDownloads -OnlySection source-audit -NoOpenReports",
    preferredPrimaryUrl: getTransferPlannerManualPreferredPrimaryUrl(planId, null),
    currentLinks: manifestEntries,
    primaryLinks: manifestEntries.filter((entry) => entry.isPrimary),
    alternateLinks: manifestEntries.filter((entry) => !entry.isPrimary),
    manualOverride: manualOverride
      ? {
          mode: manualOverride.mode ?? "merge",
          preferredPrimaryUrl: manualOverride.preferredPrimaryUrl ?? null,
          removedUrls: [...(manualOverride.removedUrls ?? [])].sort((left, right) =>
            left.localeCompare(right)
          ),
          links: uniqueLinks(manualOverride.links ?? []),
        }
      : null,
  };
}

function cloneOverrides() {
  return JSON.parse(JSON.stringify(TRANSFER_PLANNER_MANUAL_SOURCE_LINK_OVERRIDES ?? []));
}

function sortOverrides(overrides) {
  return [...overrides].sort((left, right) => {
    const planDelta = normalizeText(left.planId).localeCompare(normalizeText(right.planId));
    if (planDelta !== 0) {
      return planDelta;
    }
    return normalizeText(left.pathwayId).localeCompare(normalizeText(right.pathwayId));
  });
}

function buildCleanOverride(override) {
  const result = {
    planId: normalizeText(override.planId),
  };

  if (normalizeText(override.pathwayId)) {
    result.pathwayId = normalizeText(override.pathwayId);
  }

  if (normalizeText(override.mode) && normalizeText(override.mode) !== "merge") {
    result.mode = normalizeText(override.mode);
  }

  if (normalizeText(override.preferredPrimaryUrl)) {
    result.preferredPrimaryUrl = normalizeText(override.preferredPrimaryUrl);
  }

  const removedUrls = [...new Set((override.removedUrls ?? []).map(normalizeText).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
  if (removedUrls.length) {
    result.removedUrls = removedUrls;
  }

  const links = uniqueLinks(override.links ?? []);
  if (links.length) {
    result.links = links;
  }

  return result;
}

function serializeOverridesFile(overrides) {
  const cleanedOverrides = sortOverrides(
    overrides
      .map((override) => buildCleanOverride(override))
      .filter(
        (override) =>
          override.planId &&
          (override.links?.length ||
            override.removedUrls?.length ||
            override.preferredPrimaryUrl ||
            override.mode)
      )
  );

  return `import type { TransferPlannerSourceLink } from "./schema";

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
  ${JSON.stringify(cleanedOverrides, null, 2)};
`;
}

function upsertOverride(overrides, ownerKey, updater) {
  const nextOverrides = JSON.parse(JSON.stringify(overrides ?? [])).filter(Boolean);
  const index = nextOverrides.findIndex(
    (entry) => getTransferPlannerManualSourceOwnerKey(entry.planId, entry.pathwayId ?? null) === ownerKey
  );
  const existing =
    index >= 0 ? JSON.parse(JSON.stringify(nextOverrides[index])) : { planId: ownerKey.split("::")[0] };
  const updated = updater(existing);
  const cleaned = buildCleanOverride(updated);

  const shouldKeep =
    cleaned.planId &&
    (cleaned.links?.length || cleaned.removedUrls?.length || cleaned.preferredPrimaryUrl || cleaned.mode);

  if (index >= 0) {
    nextOverrides.splice(index, 1);
  }

  if (shouldKeep) {
    nextOverrides.push(cleaned);
  }

  return sortOverrides(nextOverrides);
}

function writeOverrides(overrides) {
  fs.writeFileSync(OVERRIDE_DATA_PATH, serializeOverridesFile(overrides));
}

function addLink(planId, link, options = {}) {
  const ownerKey = getTransferPlannerManualSourceOwnerKey(planId, null);
  const nextOverrides = upsertOverride(cloneOverrides(), ownerKey, (override) => {
    override.planId = planId;
    override.mode = options.replaceExisting ? "replace" : normalizeText(override.mode) || "merge";
    override.links = uniqueLinks([...(override.links ?? []), link]);
    override.removedUrls = (override.removedUrls ?? []).filter((url) => normalizeText(url) !== normalizeText(link.url));
    if (options.makePrimary) {
      override.preferredPrimaryUrl = normalizeText(link.url);
    }
    return override;
  });

  writeOverrides(nextOverrides);
  return {
    action: "add",
    changedFile: OVERRIDE_DATA_PATH,
    planId,
  };
}

function removeLink(planId, url) {
  const normalizedUrl = normalizeText(url);
  const details = getPlanDetails(planId);
  const linkExists = details.currentLinks.some((entry) => entry.url === normalizedUrl);
  if (!linkExists) {
    throw new Error(`Could not find link "${normalizedUrl}" on ${planId}.`);
  }

  const ownerKey = getTransferPlannerManualSourceOwnerKey(planId, null);
  const nextOverrides = upsertOverride(cloneOverrides(), ownerKey, (override) => {
    override.planId = planId;
    override.links = uniqueLinks((override.links ?? []).filter((entry) => normalizeText(entry.url) !== normalizedUrl));
    if (details.currentLinks.some((entry) => entry.sourceKind !== "manual override" && entry.url === normalizedUrl)) {
      override.removedUrls = [...new Set([...(override.removedUrls ?? []), normalizedUrl])];
    } else {
      override.removedUrls = (override.removedUrls ?? []).filter((entry) => normalizeText(entry) !== normalizedUrl);
    }
    if (normalizeText(override.preferredPrimaryUrl) === normalizedUrl) {
      delete override.preferredPrimaryUrl;
    }
    return override;
  });

  writeOverrides(nextOverrides);
  return {
    action: "remove",
    changedFile: OVERRIDE_DATA_PATH,
    planId,
  };
}

function replaceLink(planId, oldUrl, link, options = {}) {
  const normalizedOldUrl = normalizeText(oldUrl);
  const details = getPlanDetails(planId);
  if (!details.currentLinks.some((entry) => entry.url === normalizedOldUrl)) {
    throw new Error(`Could not find link "${normalizedOldUrl}" on ${planId}.`);
  }

  const ownerKey = getTransferPlannerManualSourceOwnerKey(planId, null);
  const afterRemoval = upsertOverride(cloneOverrides(), ownerKey, (override) => {
    override.planId = planId;
    override.links = uniqueLinks((override.links ?? []).filter((entry) => normalizeText(entry.url) !== normalizedOldUrl));
    if (details.currentLinks.some((entry) => entry.sourceKind !== "manual override" && entry.url === normalizedOldUrl)) {
      override.removedUrls = [...new Set([...(override.removedUrls ?? []), normalizedOldUrl])];
    } else {
      override.removedUrls = (override.removedUrls ?? []).filter((entry) => normalizeText(entry) !== normalizedOldUrl);
    }
    if (normalizeText(override.preferredPrimaryUrl) === normalizedOldUrl) {
      delete override.preferredPrimaryUrl;
    }
    return override;
  });

  const nextOverrides = upsertOverride(afterRemoval, ownerKey, (override) => {
    override.planId = planId;
    override.mode = normalizeText(override.mode) || "merge";
    override.links = uniqueLinks([...(override.links ?? []), link]);
    override.removedUrls = (override.removedUrls ?? []).filter((url) => normalizeText(url) !== normalizeText(link.url));
    if (options.makePrimary ?? true) {
      override.preferredPrimaryUrl = normalizeText(link.url);
    }
    return override;
  });

  writeOverrides(nextOverrides);
  return {
    action: "replace",
    changedFile: OVERRIDE_DATA_PATH,
    planId,
  };
}

function setPreferredPrimary(planId, url) {
  const normalizedUrl = normalizeText(url);
  const details = getPlanDetails(planId);
  if (!details.currentLinks.some((entry) => entry.url === normalizedUrl)) {
    throw new Error(`Could not set "${normalizedUrl}" as primary because it is not tracked on ${planId}.`);
  }

  const ownerKey = getTransferPlannerManualSourceOwnerKey(planId, null);
  const nextOverrides = upsertOverride(cloneOverrides(), ownerKey, (override) => {
    override.planId = planId;
    override.preferredPrimaryUrl = normalizedUrl;
    return override;
  });

  writeOverrides(nextOverrides);
  return {
    action: "set-primary",
    changedFile: OVERRIDE_DATA_PATH,
    planId,
  };
}

function updateWithCurrentLinks(planId) {
  const details = getPlanDetails(planId);
  const currentLinks = uniqueLinks(
    details.currentLinks.map((entry) => ({
      label: entry.label,
      url: entry.url,
      note: entry.note ?? undefined,
    }))
  );

  if (currentLinks.length === 0) {
    throw new Error(`Could not capture current links because ${planId} has no tracked links yet.`);
  }

  const currentPrimaryUrl =
    normalizeText(details.currentLinks.find((entry) => entry.isPrimary)?.url) ||
    normalizeText(details.preferredPrimaryUrl) ||
    null;
  const ownerKey = getTransferPlannerManualSourceOwnerKey(planId, null);
  const nextOverrides = upsertOverride(cloneOverrides(), ownerKey, (override) => {
    override.planId = planId;
    override.mode = "replace";
    override.links = currentLinks;
    override.removedUrls = [];
    if (currentPrimaryUrl && currentLinks.some((link) => normalizeText(link.url) === currentPrimaryUrl)) {
      override.preferredPrimaryUrl = currentPrimaryUrl;
    } else {
      delete override.preferredPrimaryUrl;
    }
    return override;
  });

  writeOverrides(nextOverrides);
  return {
    action: "update-current-links",
    changedFile: OVERRIDE_DATA_PATH,
    planId,
    linkCount: currentLinks.length,
    preferredPrimaryUrl: currentPrimaryUrl,
  };
}

function main() {
  const format = normalizeText(getArgValue("--format")).toLowerCase() || "json";

  if (hasArg("--inventory")) {
    const payload = buildMajorInventory();
    process.stdout.write(format === "json" ? `${JSON.stringify(payload, null, 2)}\n` : "");
    return;
  }

  const planId = normalizeText(getArgValue("--plan-id"));
  if (hasArg("--show-plan")) {
    if (!planId) {
      throw new Error("--plan-id is required with --show-plan.");
    }
    process.stdout.write(`${JSON.stringify(getPlanDetails(planId), null, 2)}\n`);
    return;
  }

  if (hasArg("--add-link")) {
    if (!planId) {
      throw new Error("--plan-id is required with --add-link.");
    }
    const url = normalizeText(getArgValue("--url"));
    const label = normalizeText(getArgValue("--label"));
    const note = normalizeText(getArgValue("--note")) || undefined;
    if (!url || !label) {
      throw new Error("--add-link requires --url and --label.");
    }
    process.stdout.write(
      `${JSON.stringify(
        addLink(
          planId,
          {
            label,
            url,
            note,
          },
          {
            replaceExisting: hasArg("--replace-existing"),
            makePrimary: hasArg("--make-primary"),
          }
        ),
        null,
        2
      )}\n`
    );
    return;
  }

  if (hasArg("--remove-link")) {
    if (!planId) {
      throw new Error("--plan-id is required with --remove-link.");
    }
    const url = normalizeText(getArgValue("--url"));
    if (!url) {
      throw new Error("--remove-link requires --url.");
    }
    process.stdout.write(`${JSON.stringify(removeLink(planId, url), null, 2)}\n`);
    return;
  }

  if (hasArg("--replace-link")) {
    if (!planId) {
      throw new Error("--plan-id is required with --replace-link.");
    }
    const oldUrl = normalizeText(getArgValue("--old-url"));
    const url = normalizeText(getArgValue("--url"));
    const label = normalizeText(getArgValue("--label"));
    const note = normalizeText(getArgValue("--note")) || undefined;
    if (!oldUrl || !url || !label) {
      throw new Error("--replace-link requires --old-url, --url, and --label.");
    }
    process.stdout.write(
      `${JSON.stringify(
        replaceLink(
          planId,
          oldUrl,
          {
            label,
            url,
            note,
          },
          {
            makePrimary: !hasArg("--no-make-primary"),
          }
        ),
        null,
        2
      )}\n`
    );
    return;
  }

  if (hasArg("--set-primary")) {
    if (!planId) {
      throw new Error("--plan-id is required with --set-primary.");
    }
    const url = normalizeText(getArgValue("--url"));
    if (!url) {
      throw new Error("--set-primary requires --url.");
    }
    process.stdout.write(`${JSON.stringify(setPreferredPrimary(planId, url), null, 2)}\n`);
    return;
  }

  if (hasArg("--update-current-links")) {
    if (!planId) {
      throw new Error("--plan-id is required with --update-current-links.");
    }
    process.stdout.write(`${JSON.stringify(updateWithCurrentLinks(planId), null, 2)}\n`);
    return;
  }

  throw new Error(
    "No link-manager action was supplied. Use --inventory, --show-plan, --add-link, --replace-link, --remove-link, --set-primary, or --update-current-links."
  );
}

module.exports = {
  buildMajorInventory,
  getPlanDetails,
  addLink,
  removeLink,
  replaceLink,
  setPreferredPrimary,
  updateWithCurrentLinks,
  serializeOverridesFile,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
