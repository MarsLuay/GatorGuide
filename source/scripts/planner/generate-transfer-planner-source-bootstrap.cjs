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
  TRANSFER_PLANNER_SOURCE_FINGERPRINTS,
} = require("../../constants/transfer-planner-source/source-fingerprints.generated");
const {
  isSuspiciousStructuralPathwayId,
  isSuspiciousStructuralPathwayLabel,
} = require("../../constants/transfer-planner-source/pathway-materialization");
const {
  labelMentionsDifferentTransferPlannerMajor,
  normalizeTransferPlannerSemanticPathwayLabel,
  normalizeTransferPlannerText,
  stripTransferPlannerPlanTitlePrefix,
} = require("../../constants/transfer-planner-source/pathway-title-normalization");
const {
  applyTransferPlannerManualSourceLinkOverride,
} = require("../../constants/transfer-planner-source/manual-source-link-overrides");

const OUTPUT_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "constants",
  "transfer-planner-source",
  "bootstrap.generated.ts"
);
const PROFILE_MAJOR_OPTIONS_OUTPUT_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "constants",
  "green-river-major-options.generated.ts"
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
const PATHWAY_KIND_PATTERN =
  /\b(option|track|route|pathway|certificate|concentration)\b/i;
const SOURCE_GAP_BY_OWNER_KEY = new Map(
  TRANSFER_PLANNER_SOURCE_GAP_ENTRIES.flatMap((entry) => [
    [entry.ownerKey, entry],
    [makeOwnerKey(entry.planId, entry.pathwayId ?? null), entry],
  ])
);
const SUPPLEMENTAL_OFFICIAL_LINKS_BY_OWNER_KEY = new Map([
  [
    makePlanPathwayKey("uw-seattle-computer-engineering", null),
    [
      {
        label: "Allen School CE-approved Natural Science course list",
        url: "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/#natural-science",
        note:
          "Supporting official Allen School source for the Computer Engineering Natural Science approved-course filter; use with UW-GRC equivalency rules, not generic NSc/NW tags.",
      },
    ],
  ],
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

function stripGeneratedOwnerPathwaySuffix(title) {
  return String(title ?? "")
    .replace(/\s[-\u2013\u2014]\s+[^-:]*\b(?:option|track|route|pathway|certificate|concentration)\b.*$/i, "")
    .trim();
}

function normalizeSpecializedPlanToken(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 4 &&
        !["bachelor", "business", "administration", "option", "track", "route", "pathway", "certificate", "concentration"].includes(token)
    );
}

function getSpecializedPlanTitleTokens(title) {
  const match = String(title ?? "").match(/:\s*([^()]+?)(?:\s*\([^)]*\))?\s*$/);
  return match ? normalizeSpecializedPlanToken(match[1]) : [];
}

function pathwayCandidateMatchesSpecializedPlanTitle(planTitle, pathwayCandidate) {
  const planText = String(planTitle ?? "");
  const candidateText = `${pathwayCandidate?.id ?? ""} ${pathwayCandidate?.label ?? ""}`;
  const planIsBa = /\bB\.?\s*A\.?\b|\(BA\)/i.test(planText);
  const planIsBs = /\bB\.?\s*S\.?\b|\(BS\)/i.test(planText);
  const candidateIsBa = /\bB\.?\s*A\.?\b|\bba[-\s]/i.test(candidateText);
  const candidateIsBs = /\bB\.?\s*S\.?\b|\bbs[-\s]/i.test(candidateText);

  if ((planIsBa && candidateIsBs && !candidateIsBa) || (planIsBs && candidateIsBa && !candidateIsBs)) {
    return false;
  }

  const planTokens = getSpecializedPlanTitleTokens(planTitle);
  if (!planTokens.length) {
    return true;
  }

  const candidateTokens = new Set(
    normalizeSpecializedPlanToken(`${pathwayCandidate?.id ?? ""} ${pathwayCandidate?.label ?? ""}`)
  );
  return planTokens.every((token) => candidateTokens.has(token));
}

function buildFingerprintLinksForOwner(ownerId) {
  return uniqueLinks(
    (TRANSFER_PLANNER_SOURCE_FINGERPRINTS ?? [])
      .filter((entry) => (entry.ownerIds ?? []).includes(ownerId))
      .filter((entry) => entry.ok !== false && String(entry.url ?? "").trim())
      .map((entry) => ({
        label: String(entry.labels?.[0] ?? `${ownerId} requirements`).trim(),
        url: String(entry.finalUrl ?? entry.url).trim(),
        visibility: "hidden",
        status: "parser-unsupported",
        sourceConfidence: undefined,
      }))
  );
}

function selectPathwayKindSegment(value) {
  const normalized = normalizeTransferPlannerText(value);
  const segments = normalized
    .split(/\s+(?:[-\u2013\u2014]|:)\s+|,\s+/)
    .map((segment) => normalizeTransferPlannerText(segment))
    .filter(Boolean);

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (
      PATHWAY_KIND_PATTERN.test(segment) &&
      !/^(?:older|prior|current)\b/i.test(segment) &&
      !/^requirements?\s+for\b/i.test(segment)
    ) {
      return segment;
    }
  }

  return normalized;
}

function normalizePathwayLabelCandidate(planTitle, value) {
  let normalized = normalizeTransferPlannerText(value);
  if (!normalized) {
    return "";
  }

  normalized = selectPathwayKindSegment(normalized);

  const bachelorCredentialMatch = normalized.match(
    /^Bachelor\s+of\s+(Arts|Science)\s+degree\s+with\s+a\s+major\s+in\s+[^:]+:\s*(.+)$/i
  );
  if (bachelorCredentialMatch) {
    const degreePrefix = /^Arts$/i.test(bachelorCredentialMatch[1] ?? "") ? "B.A." : "B.S.";
    normalized = `${degreePrefix} ${String(bachelorCredentialMatch[2] ?? "").trim()} option`;
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

  normalized = normalizeTransferPlannerSemanticPathwayLabel(
    planTitle,
    normalized.replace(/^option\s+\d+\s*:\s*/i, "")
  ).trim();

  if (
    !normalized ||
    /^(?:download|click here to join|joining the)\b/i.test(normalized) ||
    /\b(?:double major|double degree)\b/i.test(normalized) ||
    /\b(?:elective courses?|course lists?|courses by track)\b/i.test(normalized) ||
    PATHWAY_EXPLICIT_COURSE_CODE_PATTERN.test(normalized) ||
    isSuspiciousStructuralPathwayLabel(normalized)
  ) {
    return "";
  }

  return normalized;
}

function toCanonicalPathwayId(label) {
  const normalizedLabel = normalizeTransferPlannerText(label);
  const credentialMatch = normalizedLabel.match(/^(B\.?\s*[AS]\.?)\s+(.+?)\s+option$/i);
  if (credentialMatch) {
    const degreePrefix = /S/i.test(credentialMatch[1]) ? "bs" : "ba";
    const suffixId = normalizeTransferPlannerText(credentialMatch[2])
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (suffixId) {
      return `${degreePrefix}-option-family:${suffixId}`;
    }
  }

  return normalizedLabel
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isCredentialScopedPathwayCandidate(pathwayCandidate) {
  return (
    /^(?:ba|bs)-(?:route|option-family(?::|$))/i.test(String(pathwayCandidate?.id ?? "")) ||
    /^(?:B\.?\s*A\.?|B\.?\s*S\.?)\s+/i.test(String(pathwayCandidate?.label ?? ""))
  );
}

function isSimpleSpecializationPathwayCandidate(pathwayCandidate) {
  const label = String(pathwayCandidate?.label ?? "").trim();
  if (!label || PATHWAY_EXPLICIT_COURSE_CODE_PATTERN.test(label)) {
    return false;
  }

  return (
    PATHWAY_KIND_PATTERN.test(label) &&
    !/\b(?:major|minor|degree|program|department|school|college|admission|apply)\b/i.test(label)
  );
}

function getPathwayCandidateScore(label, sourceKind) {
  let score = 0;

  switch (sourceKind) {
    case "supplemental":
      score += 60;
      break;
    case "parsed":
      score += 45;
      break;
    case "owner":
      score += 20;
      break;
    default:
      break;
  }

  if (PATHWAY_KIND_PATTERN.test(label)) {
    score += 15;
  }
  if (!/\b(?:requirements?|pdf|worksheet|check\s*list|checklist|credits?)\b/i.test(label)) {
    score += 12;
  }
  if (!/\b(?:autumn|winter|spring|summer|fall)\s+\d{4}\b/i.test(label)) {
    score += 6;
  }
  if (!/\b(?:bachelor|master|doctor|associate|minor)\b/i.test(label)) {
    score += 4;
  }

  return score - label.length * 0.01;
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

function buildPathwayCandidateFromBlock(planTitle, block) {
  const pathwayId = String(block.pathwayId ?? "").trim();
  const candidates = [];

  function pushCandidate(rawValue, sourceKind) {
    const label = normalizePathwayLabelCandidate(planTitle, rawValue);
    if (!label) {
      return;
    }

    const id = toCanonicalPathwayId(label);
    if (!id || isSuspiciousStructuralPathwayId(id)) {
      return;
    }

    candidates.push({
      id,
      label,
      score: getPathwayCandidateScore(label, sourceKind),
    });
  }

  if (pathwayId) {
    pushCandidate(buildPathwayLabelFromSupplementalLink(block.planId, pathwayId), "supplemental");
  }

  for (const value of uniqueStrings(block.pathwayLabels ?? [])) {
    pushCandidate(value, "parsed");
  }

  pushCandidate(block.ownerTitle, "owner");

  if (pathwayId) {
    pushCandidate(titleCasePathwayLabel(pathwayId), "fallback");
  }

  return candidates
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.label.length - right.label.length ||
        left.label.localeCompare(right.label)
    )[0] ?? null;
}

function buildPrimaryMajorTitlesByPlanId(parsedBlocks) {
  const groupedByPlanId = new Map();

  for (const block of parsedBlocks) {
    const planId = String(block.planId ?? "").trim();
    if (!planId) {
      continue;
    }

    const existing = groupedByPlanId.get(planId) ?? [];
    existing.push(block);
    groupedByPlanId.set(planId, existing);
  }

  return new Map(
    [...groupedByPlanId.entries()].map(([planId, planBlocks]) => {
      const rootBlock =
        planBlocks.find((entry) => String(entry.pathwayId ?? "").trim().length === 0) ??
        planBlocks[0] ??
        null;
      return [planId, String(rootBlock?.ownerTitle ?? "").trim() || planId];
    })
  );
}

function buildUrlIdentitySnippet(url) {
  const normalizedUrl = String(url ?? "").trim();
  if (!normalizedUrl) {
    return "";
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    return decodeURIComponent(`${parsedUrl.hostname} ${parsedUrl.pathname}`)
      .replace(/[-_/]+/g, " ")
      .replace(/\.[A-Za-z0-9]{2,6}(?=$|\s)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function parsedBlockMentionsDifferentMajor(block, titlesByPlanId) {
  const planId = String(block?.planId ?? "").trim();
  if (!planId) {
    return false;
  }

  const sourceIdentityCandidates = uniqueStrings([
    String(block?.sourceLabel ?? "").trim(),
    String(block?.primarySourceLabel ?? "").trim(),
    buildUrlIdentitySnippet(block?.sourceUrl),
    buildUrlIdentitySnippet(block?.primarySourceUrl),
  ]);

  return sourceIdentityCandidates.some((candidate) =>
    labelMentionsDifferentTransferPlannerMajor(planId, candidate, titlesByPlanId)
  );
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

  const primaryMajorTitlesByPlanId = buildPrimaryMajorTitlesByPlanId(parsedBlocks);
  const plans = [];

  for (const [planId, planBlocks] of groupedByPlanId.entries()) {
    const rootBlock =
      planBlocks.find((entry) => String(entry.pathwayId ?? "").trim().length === 0) ??
      planBlocks[0] ??
      null;

    if (!rootBlock) continue;

    const campusId = String(rootBlock.campusId ?? "").trim();
    if (!campusId) continue;

    const planGap = SOURCE_GAP_BY_OWNER_KEY.get(makeOwnerKey(planId, null)) ?? null;
    const title =
      String(planGap?.title ?? "").trim() ||
      stripGeneratedOwnerPathwaySuffix(rootBlock.ownerTitle) ||
      String(rootBlock.ownerTitle ?? "").trim() ||
      planId;
    const pathwayById = new Map();

    const addPathwayCandidate = (pathwayCandidate, block) => {
      if (
        !pathwayCandidate ||
        !pathwayCandidateMatchesSpecializedPlanTitle(title, pathwayCandidate) ||
        (!isCredentialScopedPathwayCandidate(pathwayCandidate) &&
          !isSimpleSpecializationPathwayCandidate(pathwayCandidate) &&
          labelMentionsDifferentTransferPlannerMajor(
            planId,
            pathwayCandidate.label,
            primaryMajorTitlesByPlanId
          ))
      ) {
        return;
      }

      const existingPathway = pathwayById.get(pathwayCandidate.id) ?? null;
      if (existingPathway && existingPathway.__score >= pathwayCandidate.score) {
        return;
      }

      pathwayById.set(pathwayCandidate.id, {
        id: pathwayCandidate.id,
        label: pathwayCandidate.label,
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
        __score: pathwayCandidate.score,
      });
    };

    for (const block of planBlocks) {
      const pathwayId = String(block.pathwayId ?? "").trim();
      if (!pathwayId || isSuspiciousStructuralPathwayId(pathwayId)) {
        if (!pathwayId) {
          for (const value of uniqueStrings(block.pathwayLabels ?? [])) {
            const label = normalizePathwayLabelCandidate(title, value);
            if (!label) {
              continue;
            }
            const id = toCanonicalPathwayId(label);
            if (!id || isSuspiciousStructuralPathwayId(id)) {
              continue;
            }
            addPathwayCandidate(
              {
                id,
                label,
                score: getPathwayCandidateScore(label, "parsed"),
              },
              block
            );
          }
        }
        continue;
      }

      const pathwayCandidate = buildPathwayCandidateFromBlock(title, block);
      addPathwayCandidate(pathwayCandidate, block);
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
      officialLinks: buildFingerprintLinksForOwner(planId),
      degreeMapSections: [],
      validationNotes: [],
      grcCourseList: [],
      grcCourseListGuidance: "",
      bankIds: [],
      plannerNote: "",
      sourceType: "master-generated",
      pathways: [...pathwayById.values()]
        .map(({ __score, ...pathway }) => pathway)
        .sort((left, right) => left.id.localeCompare(right.id)),
    });
  }

  for (const gap of TRANSFER_PLANNER_SOURCE_GAP_ENTRIES) {
    const planId = String(gap?.planId ?? "").trim();
    if (
      !planId ||
      groupedByPlanId.has(planId) ||
      gap?.ownerType !== "major" ||
      String(gap?.pathwayId ?? "").trim()
    ) {
      continue;
    }

    const campusId = String(gap.campusId ?? "").trim();
    const title = String(gap.title ?? "").trim();
    if (!campusId || !title) {
      continue;
    }

    plans.push({
      id: planId,
      campusId,
      title,
      shortTitle: buildShortTitle(title),
      coverage: "partial",
      summary: "Source-generated from source gap registries.",
      bestTrackId: null,
      recommendedTrackSummary: "",
      whyThisTrack: [],
      applicationChecklist: [],
      beforeEnrollmentChecklist: [],
      stayAtGrcChecklist: [],
      advisorFlags: [],
      officialLinks: buildFingerprintLinksForOwner(planId),
      degreeMapSections: [],
      validationNotes: [],
      grcCourseList: [],
      grcCourseListGuidance: "",
      bankIds: [],
      plannerNote: "",
      sourceType: "master-generated",
      pathways: [],
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
  const primaryMajorTitlesByPlanId = buildPrimaryMajorTitlesByPlanId(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS
  );

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
    const parsedBlocks = (
      parsedBlocksByOwnerScope.get(makePlanPathwayKey(planId, pathwayId ?? null)) ?? []
    ).filter((entry) => !parsedBlockMentionsDifferentMajor(entry, primaryMajorTitlesByPlanId));
    const supplementalLinks =
      SUPPLEMENTAL_OFFICIAL_LINKS_BY_OWNER_KEY.get(makePlanPathwayKey(planId, pathwayId ?? null)) ??
      [];

    return uniqueLinks(
      applyTransferPlannerManualSourceLinkOverride(
        planId,
        pathwayId ?? null,
        uniqueLinks([
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
        ])
      )
    );
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

function buildGreenRiverMajorOptions(tracks) {
  const tracksByTitle = new Map();

  for (const track of tracks) {
    const title = String(track?.title ?? "").trim();
    if (!title) continue;

    if (!tracksByTitle.has(title)) {
      tracksByTitle.set(title, []);
    }

    tracksByTitle.get(title).push(track);
  }

  const groupedTrackCodes = new Map();

  for (const [title, titleTracks] of tracksByTitle.entries()) {
    const distinctCodes = new Set(
      titleTracks
        .map((track) => String(track?.code ?? "").trim())
        .filter(Boolean)
    );
    const hasCredentialCollision = distinctCodes.size > 1;

    for (const track of titleTracks) {
      const code = String(track?.code ?? "").trim();
      const optionTitle = hasCredentialCollision && code
        ? code === "Certificate"
          ? `${title} Certificate`
          : `${title}, ${code}`
        : title;

      if (!groupedTrackCodes.has(optionTitle)) {
        groupedTrackCodes.set(optionTitle, new Set());
      }

      if (code) {
        groupedTrackCodes.get(optionTitle).add(code);
      }
    }
  }

  return [...groupedTrackCodes.entries()]
    .sort(([leftTitle], [rightTitle]) =>
      leftTitle.localeCompare(rightTitle, undefined, { sensitivity: "base" })
    )
    .map(([title, codeSet]) => {
      const codes = [...codeSet].sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: "base" })
      );

      return {
        id: title,
        label: title,
        ...(codes.length ? { description: codes.join(" | ") } : {}),
        searchText: [title, ...codes].join(" "),
      };
    });
}

function buildProfileMajorOptionsFileContents(tracks) {
  return `/* eslint-disable */
/* auto-generated by scripts/planner/generate-transfer-planner-source-bootstrap.cjs */

type GreenRiverMajorOption = {
  id: string;
  label: string;
  description?: string;
  searchText: string;
};

${serializeExport(
  "GREEN_RIVER_MAJOR_OPTIONS",
  "GreenRiverMajorOption[]",
  buildGreenRiverMajorOptions(tracks)
)}
`;
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
fs.writeFileSync(
  PROFILE_MAJOR_OPTIONS_OUTPUT_PATH,
  buildProfileMajorOptionsFileContents(TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS)
);
console.log(`Wrote ${PROFILE_MAJOR_OPTIONS_OUTPUT_PATH}`);
const currentSnapshot = buildSnapshot({
  majorPlans: buildMajorPlansFromParsedRegistries(),
  tracks: TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS,
  campuses: buildCampusesFromParsedRegistries(buildMajorPlansFromParsedRegistries()),
});
printDiffSummary(previousSnapshot, currentSnapshot);
