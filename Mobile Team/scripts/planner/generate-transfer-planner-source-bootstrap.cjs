/* global __dirname */
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
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS,
} = require("../../constants/transfer-planner-source/grc-associate-tracks.generated");
const {
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS,
} = require("../../constants/transfer-planner-source/requirement-source-adapters.generated");
const {
  TRANSFER_PLANNER_SOURCE_GAP_ENTRIES,
} = require("../../constants/transfer-planner-source/source-gaps.generated");
const {
  isSuspiciousStructuralPathwayLabel,
} = require("../../constants/transfer-planner-source/pathway-materialization");
const {
  normalizeTransferPlannerText,
  stripTransferPlannerPlanTitlePrefix,
} = require("../../constants/transfer-planner-source/pathway-title-normalization");

const OUTPUT_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "constants",
  "transfer-planner-source",
  "bootstrap.generated.ts"
);
const COURSE_CODE_PATTERN = /\b[A-Z]{2,8}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;
const CAMPUS_TITLE_BY_ID = {
  "uw-seattle": "UW Seattle",
  "uw-bothell": "UW Bothell",
  "uw-tacoma": "UW Tacoma",
};
const PATHWAY_OWNER_TITLE_SUFFIX_SEPARATORS = [" - ", ": ", " – "];
const PATHWAY_DEGREE_TITLE_PATTERN =
  /^(?:(?:Bachelor|Master|Doctor|Minor|Associate)(?: of [^:]{1,120})?|(?:B\.?\s*A\.?|B\.?\s*S\.?|M\.?\s*A\.?|M\.?\s*S\.?)(?: degree)?(?: with a major in [^:]{1,120})?)\s*:\s+(.{2,120})$/i;
const PATHWAY_STRUCTURAL_PREFIX_PATTERN =
  /^(.{2,80}?)\s+(option|track|route|pathway|certificate|concentration)[-\s]*specific\b.*$/i;
const PATHWAY_EXPLICIT_COURSE_CODE_PATTERN =
  /\b[A-Z]{2,8}(?:\/[A-Z]{2,8})?\s+\d{3}(?:\.\d+)?[A-Z]?\b/i;
const SUPPLEMENTAL_OFFICIAL_LINKS_BY_OWNER_KEY = new Map([
  [
    makePlanPathwayKey("uw-bothell-business-administration", null),
    [
      {
        label: "UW Bothell BBA curriculum hub",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum",
        note:
          "Supporting route hub only. Keep the dedicated option and concentration pages as the stronger requirement sources for specific BBA pathways.",
      },
      {
        label: "UW Bothell BBA admissions hub",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions",
        note:
          "Supporting admissions context only. Use this alongside the dedicated route pages rather than as a blanket degree-requirements replacement.",
      },
      {
        label: "UW Bothell BBA how to apply",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/how-to-apply",
        note:
          "Supporting admissions process context only. Do not treat this page as a degree-requirements source.",
      },
      {
        label: "UW Bothell BBA prerequisite courses",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
        note:
          "Supporting admissions prerequisite context only. Keep lower-division requirement extraction conservative and route-specific.",
      },
    ],
  ],
  [
    makePlanPathwayKey("uw-bothell-business-administration", "accounting-option"),
    [
      {
        label: "UW Bothell Accounting option major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/accounting",
      },
    ],
  ],
  [
    makePlanPathwayKey(
      "uw-bothell-business-administration",
      "finance-option-and-concentration"
    ),
    [
      {
        label: "UW Bothell Finance option and concentration major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/finance-option",
      },
    ],
  ],
  [
    makePlanPathwayKey(
      "uw-bothell-business-administration",
      "leadership-and-strategic-innovation-option"
    ),
    [
      {
        label: "UW Bothell Leadership and Strategic Innovation option major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/leadership",
      },
    ],
  ],
  [
    makePlanPathwayKey(
      "uw-bothell-business-administration",
      "marketing-option-and-concentration"
    ),
    [
      {
        label: "UW Bothell Marketing option and concentration major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/marketing",
      },
    ],
  ],
  [
    makePlanPathwayKey(
      "uw-bothell-business-administration",
      "supply-chain-management-option"
    ),
    [
      {
        label: "UW Bothell Supply Chain Management option major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/supply-chain",
      },
    ],
  ],
  [
    makePlanPathwayKey("uw-bothell-business-administration", "entrepreneurship-concentration"),
    [
      {
        label: "UW Bothell Entrepreneurship concentration major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/entrepreneurship",
      },
    ],
  ],
  [
    makePlanPathwayKey("uw-bothell-business-administration", "management-concentration"),
    [
      {
        label: "UW Bothell Management concentration major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/management",
      },
    ],
  ],
  [
    makePlanPathwayKey("uw-bothell-business-administration", "mis-concentration"),
    [
      {
        label: "UW Bothell MIS concentration major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/mis",
      },
    ],
  ],
  [
    makePlanPathwayKey("uw-bothell-business-administration", "retail-management-concentration"),
    [
      {
        label: "UW Bothell Retail Management concentration major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/retail",
      },
    ],
  ],
  [
    makePlanPathwayKey("uw-bothell-business-administration", "tim-concentration"),
    [
      {
        label: "UW Bothell Technology and Innovation Management concentration major requirements",
        url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/tim",
      },
    ],
  ],
  [
    makePlanPathwayKey("uw-seattle-geography", null),
    [
      {
        label: "UW Geography courses by track",
        url: "https://geography.washington.edu/courses-track",
        note:
          "Supplemental official route-separation context only. Keep this course-by-track page secondary to the dedicated degree-requirements pages.",
      },
    ],
  ],
  [
    makePlanPathwayKey("uw-seattle-geography", "data-science-option"),
    [
      {
        label: "UW Geography courses by track",
        url: "https://geography.washington.edu/courses-track",
        note:
          "Supplemental official route-separation context only. Keep this course-by-track page secondary to the dedicated degree-requirements pages.",
      },
    ],
  ],
  [
    makePlanPathwayKey("uw-seattle-geography", "standard-ba-route"),
    [
      {
        label: "UW Geography courses by track",
        url: "https://geography.washington.edu/courses-track",
        note:
          "Supplemental official route-separation context only. Keep this course-by-track page secondary to the dedicated degree-requirements pages.",
      },
    ],
  ],
]);

function makePlanPathwayKey(planId, pathwayId = null) {
  return `${String(planId ?? "").trim()}::${String(pathwayId ?? "").trim()}`;
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

function uniqueLinks(values) {
  const STATUS_RANK = {
    verified: 5,
    "partially-verified": 4,
    "parser-unsupported": 3,
    "source-conflict": 2,
    "source-unfindable": 1,
  };
  const CONFIDENCE_RANK = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const byUrl = new Map();

  for (const value of Array.isArray(values) ? values : []) {
    if (!value || typeof value !== "object") continue;

    const url = String(value.url ?? "").trim();
    const label = String(value.label ?? "").trim();
    const note = String(value.note ?? "").trim();
    const visibility = String(value.visibility ?? "").trim();
    const status = String(value.status ?? "").trim();
    const reason = String(value.reason ?? "").trim();
    const sourceConfidence = String(value.sourceConfidence ?? "").trim();
    if (!url || !label) continue;

    if (!byUrl.has(url)) {
      const initial = { label, url };
      if (note) initial.note = note;
      if (visibility) initial.visibility = visibility;
      if (status) initial.status = status;
      if (reason) initial.reason = reason;
      if (sourceConfidence) initial.sourceConfidence = sourceConfidence;
      byUrl.set(url, initial);
      continue;
    }

    const existing = byUrl.get(url);
    const existingStatusRank = STATUS_RANK[String(existing.status ?? "")] ?? 0;
    const incomingStatusRank = STATUS_RANK[status] ?? 0;
    if (incomingStatusRank > existingStatusRank && status) {
      existing.status = status;
    }

    const existingConfidenceRank = CONFIDENCE_RANK[String(existing.sourceConfidence ?? "")] ?? 0;
    const incomingConfidenceRank = CONFIDENCE_RANK[sourceConfidence] ?? 0;
    if (incomingConfidenceRank > existingConfidenceRank && sourceConfidence) {
      existing.sourceConfidence = sourceConfidence;
    }

    if (!existing.note && note) {
      existing.note = note;
    }
    if (!existing.reason && reason) {
      existing.reason = reason;
    }
    if (
      (!existing.visibility || existing.visibility === "hidden") &&
      visibility === "visible"
    ) {
      existing.visibility = "visible";
    }
    if (!existing.visibility && visibility) {
      existing.visibility = visibility;
    }
  }

  return [...byUrl.values()].sort((left, right) =>
    String(left.label ?? "").localeCompare(String(right.label ?? ""))
  );
}

function makeOwnerKey(planId, pathwayId = null) {
  const normalizedPlanId = String(planId ?? "").trim();
  const normalizedPathwayId = String(pathwayId ?? "").trim();
  return normalizedPathwayId
    ? `pathway:${normalizedPlanId}:${normalizedPathwayId}`
    : `major:${normalizedPlanId}`;
}

function buildSourceStatusForManifestEntry(entry, sourceGapByOwnerKey) {
  const ownerKey = makeOwnerKey(entry.planId, entry.pathwayId ?? null);
  const ownerGap = sourceGapByOwnerKey.get(ownerKey) ?? null;

  if (ownerGap) {
    return {
      visibility: ownerGap.studentVisibility,
      status: ownerGap.sourceCoverageStatus,
      reason: ownerGap.sourceGapReason,
      sourceConfidence: entry.confidence,
    };
  }

  return {
    visibility: "visible",
    status: entry.confidence === "high" ? "verified" : "partially-verified",
    reason: String(entry.note ?? "").trim() || undefined,
    sourceConfidence: entry.confidence,
  };
}

function buildSourceStatusForParsedBlock(block) {
  if (block.ok && !block.usedSnapshotFallback) {
    return {
      visibility: "visible",
      status: "verified",
      reason: undefined,
      sourceConfidence: block.parseConfidence,
    };
  }

  if (block.ok && block.usedSnapshotFallback) {
    return {
      visibility: "visible",
      status: "partially-verified",
      reason: String(block.snapshotFallbackReason ?? "").trim() || undefined,
      sourceConfidence: block.parseConfidence,
    };
  }

  return {
    visibility: "hidden",
    status: "parser-unsupported",
    reason: String(block.error ?? "").trim() || undefined,
    sourceConfidence: block.parseConfidence,
  };
}

function buildShortTitle(title) {
  const normalized = String(title ?? "").trim();
  if (!normalized) return "Major";

  const acronym = normalized
    .split(/\s+/)
    .map((token) => token.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean)
    .map((token) => token[0])
    .join("")
    .toUpperCase();

  if (acronym.length >= 2 && acronym.length <= 8) {
    return acronym;
  }

  return normalized.split(/\s+/).slice(0, 3).join(" ");
}

function mapPhaseToChecklistField(phase) {
  switch (phase) {
    case "before-application":
      return "applicationChecklist";
    case "before-enrollment":
      return "beforeEnrollmentChecklist";
    case "stay-at-grc":
      return "stayAtGrcChecklist";
    default:
      return null;
  }
}

function buildChecklistItem(requirement) {
  const alternatives = (Array.isArray(requirement.alternativeCourseCodeSets)
    ? requirement.alternativeCourseCodeSets
    : []
  ).map((courseSet) => uniqueStrings(courseSet));

  const result = {
    id: String(requirement.id ?? "").trim(),
    title: String(requirement.title ?? "").trim() || String(requirement.uwCourseCode ?? "").trim(),
    grcCourses: uniqueStrings(requirement.grcCourseCodes),
  };

  if (alternatives.some((group) => group.length > 0)) {
    result.alternatives = alternatives.filter((group) => group.length > 0);
  }

  if (typeof requirement.minCompletedCount === "number") {
    result.minCompletedCount = requirement.minCompletedCount;
  }

  const note = String(requirement.note ?? "").trim();
  if (note) {
    result.note = note;
  }

  return result;
}

function buildDegreeMapSection(block) {
  const result = {
    id: String(block.id ?? "").trim(),
    title: String(block.title ?? "").trim(),
    items: uniqueStrings(block.itemLabels),
  };

  const note = String(block.note ?? "").trim();
  if (note) {
    result.note = note;
  }

  return result;
}

function buildCampusesFromParsedRegistries(planRecords) {
  const campusIds = uniqueStrings(planRecords.map((entry) => entry.campusId));

  return campusIds
    .map((campusId) => ({
      id: campusId,
      title: CAMPUS_TITLE_BY_ID[campusId] ?? campusId,
      summary: "Source-generated from parsed UW requirement-source registries.",
      officialLinks: [],
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function titleCasePathwayLabel(value) {
  return String(value ?? "")
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function normalizePathwayLabelCandidate(planTitle, value) {
  let normalized = normalizeTransferPlannerText(value);
  if (!normalized) {
    return "";
  }

  const degreeTitleMatch = normalized.match(PATHWAY_DEGREE_TITLE_PATTERN);
  if (degreeTitleMatch) {
    normalized = String(degreeTitleMatch[1] ?? "").trim();
  }

  const normalizedPlanTitle = normalizeTransferPlannerText(planTitle);
  if (normalizedPlanTitle) {
    normalized = stripTransferPlannerPlanTitlePrefix(normalizedPlanTitle, normalized);
  }

  const structuralPrefixMatch = normalized.match(PATHWAY_STRUCTURAL_PREFIX_PATTERN);
  if (structuralPrefixMatch) {
    normalized = `${String(structuralPrefixMatch[1] ?? "").trim()} ${String(
      structuralPrefixMatch[2] ?? ""
    ).trim()}`.trim();
  }

  normalized = normalized
    .replace(/^option\s+\d+\s*:\s*/i, "")
    .replace(/\b(option|track|route|pathway|certificate|concentration)\b\s+[-–—]\s+.*$/i, "$1")
    .replace(/\s+\((?:\d+(?:-\d+)?\s+credits?)\)\s*$/i, "")
    .replace(/\s+[.;:]\s*$/, "")
    .trim();

  if (
    !normalized ||
    PATHWAY_EXPLICIT_COURSE_CODE_PATTERN.test(normalized) ||
    isSuspiciousStructuralPathwayLabel(normalized)
  ) {
    return "";
  }

  return normalized;
}

function buildPathwayLabelFromSupplementalLink(planId, pathwayId) {
  const supplementalLinks =
    SUPPLEMENTAL_OFFICIAL_LINKS_BY_OWNER_KEY.get(makePlanPathwayKey(planId, pathwayId)) ?? [];

  for (const link of supplementalLinks) {
    const label = String(link?.label ?? "").trim();
    if (!/\b(option|concentration|track|route|pathway)\b/i.test(label)) {
      continue;
    }

    const strippedLabel = label
      .replace(/^UW\s+(?:Bothell|Seattle|Tacoma)\s+/i, "")
      .replace(/\s+(?:major|degree|graduation)\s+requirements?$/i, "")
      .replace(/\s+requirements?$/i, "")
      .trim();

    if (strippedLabel) {
      return strippedLabel;
    }
  }

  return "";
}

function buildPathwayLabelFromBlock(planTitle, block) {
  const pathwayId = String(block.pathwayId ?? "").trim();
  if (pathwayId) {
    const supplementalLabel = buildPathwayLabelFromSupplementalLink(block.planId, pathwayId);
    if (supplementalLabel) {
      return supplementalLabel;
    }
  }

  const ownerLabel = normalizePathwayLabelCandidate(planTitle, block.ownerTitle);
  if (ownerLabel) {
    return ownerLabel;
  }

  const parsedLabel = uniqueStrings(block.pathwayLabels ?? [])
    .map((value) => normalizePathwayLabelCandidate(planTitle, value))
    .filter(Boolean)
    .sort((left, right) => left.length - right.length || left.localeCompare(right))[0] ?? "";
  if (parsedLabel) {
    return parsedLabel;
  }

  if (pathwayId) {
    return titleCasePathwayLabel(pathwayId);
  }

  return "Pathway";
}

function buildBasePlansFromParsedBlocks(parsedBlocks) {
  const groupedByPlanId = new Map();

  for (const block of parsedBlocks) {
    const planId = String(block.planId ?? "").trim();
    if (!planId) continue;

    const existing = groupedByPlanId.get(planId) ?? [];
    existing.push(block);
    groupedByPlanId.set(planId, existing);
  }

  const plans = [];

  for (const [planId, planBlocks] of groupedByPlanId.entries()) {
    const rootBlock =
      planBlocks.find((entry) => String(entry.pathwayId ?? "").trim().length === 0) ??
      planBlocks[0] ??
      null;

    if (!rootBlock) continue;

    const campusId = String(rootBlock.campusId ?? "").trim();
    if (!campusId) continue;

    const title = String(rootBlock.ownerTitle ?? "").trim() || planId;
    const pathwayById = new Map();

    for (const block of planBlocks) {
      const pathwayId = String(block.pathwayId ?? "").trim();
      if (!pathwayId || pathwayById.has(pathwayId)) {
        continue;
      }

      const label = buildPathwayLabelFromBlock(title, block);
      pathwayById.set(pathwayId, {
        id: pathwayId,
        label,
        summary: "",
        applicationChecklist: [],
        beforeEnrollmentChecklist: [],
        stayAtGrcChecklist: [],
        advisorFlags: [],
        officialLinks: [],
        degreeMapSections: [],
        validationNotes: [],
        grcCourseList: [],
        grcCourseListGuidance: "",
        plannerNote: "",
        bestTrackId: null,
        recommendedTrackSummary: "",
        whyThisTrack: [],
      });
    }

    plans.push({
      id: planId,
      campusId,
      title,
      shortTitle: buildShortTitle(title),
      coverage: "partial",
      summary: "Source-generated from parsed UW requirement-source registries.",
      bestTrackId: null,
      recommendedTrackSummary: "",
      whyThisTrack: [],
      applicationChecklist: [],
      beforeEnrollmentChecklist: [],
      stayAtGrcChecklist: [],
      advisorFlags: [],
      officialLinks: [],
      degreeMapSections: [],
      validationNotes: [],
      grcCourseList: [],
      grcCourseListGuidance: "",
      bankIds: [],
      plannerNote: "",
      sourceType: "master-generated",
      pathways: [...pathwayById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    });
  }

  return plans.sort((left, right) => {
    const campusDelta = String(left.campusId ?? "").localeCompare(String(right.campusId ?? ""));
    if (campusDelta !== 0) return campusDelta;
    return String(left.id ?? "").localeCompare(String(right.id ?? ""));
  });
}

function buildMajorPlansFromParsedRegistries() {
  const basePlans = buildBasePlansFromParsedBlocks(TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS);

  const parsedBlocksByOwnerScope = new Map();
  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS) {
    const key = makePlanPathwayKey(block.planId, block.pathwayId ?? null);
    if (!parsedBlocksByOwnerScope.has(key)) {
      parsedBlocksByOwnerScope.set(key, []);
    }
    parsedBlocksByOwnerScope.get(key).push(block);
  }

  const sourceGapByOwnerKey = new Map(
    TRANSFER_PLANNER_SOURCE_GAP_ENTRIES.map((entry) => [entry.ownerKey, entry])
  );
  const getOwnerLinkDefaults = (planId, pathwayId) => {
    const ownerGap = sourceGapByOwnerKey.get(makeOwnerKey(planId, pathwayId ?? null)) ?? null;
    const parsedBlocks =
      parsedBlocksByOwnerScope.get(makePlanPathwayKey(planId, pathwayId ?? null)) ?? [];
    const topConfidence =
      parsedBlocks.find((entry) => entry.parseConfidence)?.parseConfidence ?? undefined;

    if (ownerGap) {
      return {
        visibility: ownerGap.studentVisibility,
        status: ownerGap.sourceCoverageStatus,
        reason: ownerGap.sourceGapReason,
        sourceConfidence: topConfidence,
      };
    }

    const hasVerified = parsedBlocks.some((entry) => entry.ok && !entry.usedSnapshotFallback);
    const hasPartial = parsedBlocks.some((entry) => entry.ok && entry.usedSnapshotFallback);
    return {
      visibility: "visible",
      status: hasVerified ? "verified" : hasPartial ? "partially-verified" : "partially-verified",
      reason:
        parsedBlocks.find((entry) => entry.ok && entry.usedSnapshotFallback)?.snapshotFallbackReason ??
        undefined,
      sourceConfidence: topConfidence,
    };
  };

  const enrichOfficialLinks = (links, planId, pathwayId) => {
    const defaults = getOwnerLinkDefaults(planId, pathwayId);
    const parsedBlocks =
      parsedBlocksByOwnerScope.get(makePlanPathwayKey(planId, pathwayId ?? null)) ?? [];
    const supplementalLinks =
      SUPPLEMENTAL_OFFICIAL_LINKS_BY_OWNER_KEY.get(makePlanPathwayKey(planId, pathwayId ?? null)) ??
      [];

    return uniqueLinks([
      ...(Array.isArray(links) ? links : []).map((entry) => ({
        label: String(entry?.label ?? "").trim(),
        url: String(entry?.url ?? "").trim(),
        note: String(entry?.note ?? "").trim() || undefined,
        visibility: defaults.visibility,
        status: defaults.status,
        reason: defaults.reason,
        sourceConfidence: defaults.sourceConfidence,
      })),
      ...supplementalLinks.map((entry) => ({
        label: String(entry?.label ?? "").trim(),
        url: String(entry?.url ?? "").trim(),
        note: String(entry?.note ?? "").trim() || undefined,
        visibility: defaults.visibility,
        status: defaults.status,
        reason: defaults.reason,
        sourceConfidence: defaults.sourceConfidence,
      })),
      ...parsedBlocks.map((entry) => {
        const sourceStatus = buildSourceStatusForParsedBlock(entry);
        return {
          label: entry.sourceLabel,
          url: entry.sourceUrl,
          visibility: sourceStatus.visibility,
          status: sourceStatus.status,
          reason: sourceStatus.reason,
          sourceConfidence: sourceStatus.sourceConfidence,
        };
      }),
    ]);
  };

  return basePlans
    .map((plan) => ({
      ...plan,
      officialLinks: enrichOfficialLinks(plan.officialLinks ?? [], plan.id, null),
      pathways: (plan.pathways ?? []).map((pathway) => ({
        ...pathway,
        officialLinks: enrichOfficialLinks(
          pathway.officialLinks ?? plan.officialLinks ?? [],
          plan.id,
          pathway.id
        ),
      })),
    }))
    .sort((left, right) => {
      const campusDelta = String(left.campusId ?? "").localeCompare(String(right.campusId ?? ""));
      if (campusDelta !== 0) return campusDelta;
      return String(left.id ?? "").localeCompare(String(right.id ?? ""));
    });
}

function sanitizePlannerOwnedText(value) {
  return value == null ? "" : String(value);
}

function normalizeOfficialLinks(value) {
  const normalizedLinks = [];
  const seenUrls = new Set();

  for (const rawLink of Array.isArray(value) ? value : []) {
    if (!rawLink || typeof rawLink !== "object") {
      continue;
    }

    const url = String(rawLink.url ?? "").trim();
    if (!url || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    normalizedLinks.push(sanitizeValue(rawLink));
  }

  return normalizedLinks;
}

function sanitizeValue(value) {
  if (typeof value === "string") {
    return sanitizePlannerOwnedText(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        key === "officialLinks" ? normalizeOfficialLinks(entryValue) : sanitizeValue(entryValue),
      ])
    );
  }

  return value;
}

function normalizeCourseCode(value) {
  const normalized = String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^([A-Z&]+(?: [A-Z&]+)*) (\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (!match) {
    return normalized;
  }

  const subjectTokens = match[1].split(" ").filter(Boolean);
  const normalizedSubject = subjectTokens.every((token) => token.length === 1)
    ? subjectTokens.join("")
    : subjectTokens.join(" ");

  return `${normalizedSubject} ${match[2]}`;
}

function collectCourseCodesFromValue(value, targetSet) {
  if (typeof value === "string") {
    const matches = value.match(COURSE_CODE_PATTERN) ?? [];
    for (const match of matches) {
      const normalized = normalizeCourseCode(match);
      if (normalized) {
        targetSet.add(normalized);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectCourseCodesFromValue(item, targetSet);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const entryValue of Object.values(value)) {
      collectCourseCodesFromValue(entryValue, targetSet);
    }
  }
}

function toIdSet(values) {
  const set = new Set();
  for (const value of values ?? []) {
    const id = String(value?.id ?? "").trim();
    if (id) {
      set.add(id);
    }
  }
  return set;
}

function diffSets(previous, current) {
  const added = [];
  const removed = [];

  for (const value of current) {
    if (!previous.has(value)) {
      added.push(value);
    }
  }

  for (const value of previous) {
    if (!current.has(value)) {
      removed.push(value);
    }
  }

  added.sort((left, right) => left.localeCompare(right));
  removed.sort((left, right) => left.localeCompare(right));
  return { added, removed };
}

function buildSnapshot(input) {
  const majorIds = toIdSet(input.majorPlans);
  const trackIds = toIdSet(input.tracks);
  const campusIds = toIdSet(input.campuses);
  const courseCodes = new Set();

  collectCourseCodesFromValue(input.majorPlans, courseCodes);
  collectCourseCodesFromValue(input.tracks, courseCodes);

  return {
    majorIds,
    trackIds,
    campusIds,
    courseCodes,
  };
}

function loadPreviousSnapshot() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return null;
  }

  try {
    delete require.cache[require.resolve(OUTPUT_PATH)];
    const previousModule = require(OUTPUT_PATH);
    return buildSnapshot({
      majorPlans: previousModule.TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS ?? [],
      tracks: previousModule.TRANSFER_PLANNER_BOOTSTRAP_TRACKS ?? [],
      campuses: previousModule.TRANSFER_PLANNER_BOOTSTRAP_CAMPUSES ?? [],
    });
  } catch (error) {
    console.warn(`Unable to read previous bootstrap snapshot: ${error.message}`);
    return null;
  }
}

function printDiffSummary(previousSnapshot, currentSnapshot) {
  if (!previousSnapshot) {
    console.log("Bootstrap summary: no previous snapshot found; skipping added/removed diff.");
    return;
  }

  const majorDiff = diffSets(previousSnapshot.majorIds, currentSnapshot.majorIds);
  const trackDiff = diffSets(previousSnapshot.trackIds, currentSnapshot.trackIds);
  const campusDiff = diffSets(previousSnapshot.campusIds, currentSnapshot.campusIds);
  const courseDiff = diffSets(previousSnapshot.courseCodes, currentSnapshot.courseCodes);

  const preview = (values) => (values.length ? values.slice(0, 12).join(", ") : "none");

  console.log("Bootstrap summary:");
  console.log(
    `- Majors added: ${majorDiff.added.length}; removed: ${majorDiff.removed.length}`
  );
  console.log(
    `- Tracks added: ${trackDiff.added.length}; removed: ${trackDiff.removed.length}`
  );
  console.log(
    `- Campuses added: ${campusDiff.added.length}; removed: ${campusDiff.removed.length}`
  );
  console.log(
    `- Courses added: ${courseDiff.added.length}; removed: ${courseDiff.removed.length}`
  );
  console.log(`  Added majors (sample): ${preview(majorDiff.added)}`);
  console.log(`  Removed majors (sample): ${preview(majorDiff.removed)}`);
  console.log(`  Added courses (sample): ${preview(courseDiff.added)}`);
  console.log(`  Removed courses (sample): ${preview(courseDiff.removed)}`);
}

function serializeExport(name, typeName, value) {
  return `export const ${name}: ${typeName} = ${JSON.stringify(sanitizeValue(value), null, 2)};\n`;
}

const fileContents = `/* eslint-disable */
/* auto-generated by scripts/planner/generate-transfer-planner-source-bootstrap.cjs */

import type {
  TransferPlannerCampus,
  TransferPlannerMajorPlan,
  TransferPlannerTrack,
} from "../transfer-planner-types";

${serializeExport(
  "TRANSFER_PLANNER_BOOTSTRAP_CAMPUSES",
  "TransferPlannerCampus[]",
  buildCampusesFromParsedRegistries(buildMajorPlansFromParsedRegistries())
)}
${serializeExport(
  "TRANSFER_PLANNER_BOOTSTRAP_TRACKS",
  "TransferPlannerTrack[]",
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS
)}
${serializeExport(
  "TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS",
  "TransferPlannerMajorPlan[]",
  buildMajorPlansFromParsedRegistries()
)}
`;

const previousSnapshot = loadPreviousSnapshot();

fs.writeFileSync(OUTPUT_PATH, fileContents);
console.log(`Wrote ${OUTPUT_PATH}`);
const currentSnapshot = buildSnapshot({
  majorPlans: buildMajorPlansFromParsedRegistries(),
  tracks: TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS,
  campuses: buildCampusesFromParsedRegistries(buildMajorPlansFromParsedRegistries()),
});
printDiffSummary(previousSnapshot, currentSnapshot);
