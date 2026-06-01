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
  TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCKS,
} = require("../../constants/transfer-planner-source/requirement-source-adapters.generated");
const {
  TRANSFER_PLANNER_GAP_ENTRIES,
} = require("../../constants/transfer-planner-source/source-gaps.generated");
const {
  TRANSFER_PLANNER_FINGERPRINTS,
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
const SUPPRESS_GENERATED_PATHWAY_CANDIDATE_PLAN_IDS = new Set([
  "uw-seattle-history-and-philosophy-of-science",
  "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed",
]);
const GENERATED_PATHWAY_EXCLUDED_LABEL_PATTERNS_BY_PLAN = new Map([
  [
    "uw-seattle-jewish-studies",
    [/^(?:south(?:east)? asia|southeast asia|china|japan|korea|general) concentration$/i],
  ],
  [
    "uw-seattle-latin-american-and-caribbean-studies",
    [/^(?:south(?:east)? asia|southeast asia|china|japan|korea|general) concentration$/i],
  ],
  [
    "uw-seattle-materials-science-engineering",
    [
      /^introduction to molecular and nanoscale principles\b.*\bnot eligible elective for nme option students\b/i,
    ],
  ],
  [
    "uw-tacoma-politics-philosophy-and-economics",
    [
      /^B\.?\s*A\.?\s+route$/i,
      /^global studies concentration$/i,
      /^social science research methods minor$/i,
    ],
  ],
  ["uw-tacoma-social-welfare", [/^B\.?\s*A\.?\s+route$/i]],
  ["uw-tacoma-sustainable-urban-development", [/^gis certificate\b/i]],
]);
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
const GAP_BY_OWNER_KEY = new Map(
  TRANSFER_PLANNER_GAP_ENTRIES.flatMap((entry) => [
    [entry.ownerKey, entry],
    [makeOwnerKey(entry.planId, entry.pathwayId ?? null), entry],
  ])
);
const FINGERPRINT_FINAL_URL_BY_URL = new Map(
  (TRANSFER_PLANNER_FINGERPRINTS ?? [])
    .map((entry) => [
      String(entry?.url ?? "").trim(),
      String(entry?.finalUrl ?? "").trim(),
    ])
    .filter(([url, finalUrl]) => url && finalUrl)
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

function normalizeRouteMatcherText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getOfficialLinkRouteTokens(value) {
  const text = normalizeRouteMatcherText(value);
  const tokens = new Set();

  if (/\b(?:ba|b a|bachelor of arts)\b/.test(text)) {
    tokens.add("ba");
  }
  if (/\b(?:bs|b s|bachelor of science)\b/.test(text)) {
    tokens.add("bs");
  }
  if (/\bacs(?:\d{2,4})?\b/.test(text) || /\bamerican chemical society\b/.test(text)) {
    tokens.add("acs");
  }
  if (
    /\b(?:ell|tell)\b/.test(text) ||
    /\benglish language learners?\b/.test(text) ||
    /\bteaching english language learners?\b/.test(text)
  ) {
    tokens.add("ell");
  }
  if (/\b(?:sped|special education)\b/.test(text)) {
    tokens.add("sped");
  }

  return tokens;
}

function routeTokensConflict(ownerTokens, linkTokens) {
  return (
    (ownerTokens.has("ba") && linkTokens.has("bs")) ||
    (ownerTokens.has("bs") && linkTokens.has("ba")) ||
    (ownerTokens.has("bs") && !ownerTokens.has("acs") && linkTokens.has("acs")) ||
    (ownerTokens.has("acs") && linkTokens.has("bs") && !linkTokens.has("acs")) ||
    (ownerTokens.has("ell") && linkTokens.has("sped")) ||
    (ownerTokens.has("sped") && linkTokens.has("ell"))
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

function createEmptyPathway(id, label, officialLinks = [], validationNotes = []) {
  return {
    id,
    label,
    summary: "",
    applicationChecklist: [],
    beforeEnrollmentChecklist: [],
    stayAtGrcChecklist: [],
    advisorFlags: [],
    officialLinks,
    degreeMapSections: [],
    validationNotes,
    grcCourseList: [],
    grcCourseListGuidance: "",
    plannerNote: "",
    bestTrackId: null,
    recommendedTrackSummary: "",
    whyThisTrack: [],
  };
}

function mergePathway(basePathway, canonicalPathway) {
  const base = basePathway ?? {};
  return {
    ...base,
    id: canonicalPathway.id,
    label: canonicalPathway.label,
    summary: String(base.summary ?? canonicalPathway.summary ?? ""),
    applicationChecklist: base.applicationChecklist ?? canonicalPathway.applicationChecklist ?? [],
    beforeEnrollmentChecklist:
      base.beforeEnrollmentChecklist ?? canonicalPathway.beforeEnrollmentChecklist ?? [],
    stayAtGrcChecklist: base.stayAtGrcChecklist ?? canonicalPathway.stayAtGrcChecklist ?? [],
    advisorFlags: uniqueStrings([
      ...(base.advisorFlags ?? []),
      ...(canonicalPathway.advisorFlags ?? []),
    ]),
    officialLinks: uniqueLinks([
      ...(canonicalPathway.officialLinks ?? []),
      ...(base.officialLinks ?? []),
    ]),
    degreeMapSections: base.degreeMapSections ?? canonicalPathway.degreeMapSections ?? [],
    validationNotes: uniqueStrings([
      ...(base.validationNotes ?? []),
      ...(canonicalPathway.validationNotes ?? []),
    ]),
    grcCourseList: uniqueStrings([
      ...(base.grcCourseList ?? []),
      ...(canonicalPathway.grcCourseList ?? []),
    ]),
    grcCourseListGuidance:
      String(base.grcCourseListGuidance ?? "").trim() ||
      String(canonicalPathway.grcCourseListGuidance ?? "").trim(),
    plannerNote:
      String(base.plannerNote ?? "").trim() || String(canonicalPathway.plannerNote ?? "").trim(),
    bestTrackId: base.bestTrackId ?? canonicalPathway.bestTrackId ?? null,
    recommendedTrackSummary:
      String(base.recommendedTrackSummary ?? "").trim() ||
      String(canonicalPathway.recommendedTrackSummary ?? "").trim(),
    whyThisTrack: uniqueStrings([
      ...(base.whyThisTrack ?? []),
      ...(canonicalPathway.whyThisTrack ?? []),
    ]),
    requirementGroups: base.requirementGroups ?? canonicalPathway.requirementGroups,
    requirementReplacements:
      base.requirementReplacements ?? canonicalPathway.requirementReplacements,
    supportLists: base.supportLists ?? canonicalPathway.supportLists,
  };
}

function replacePlanPathwaysWithCanonicalSet(plan, canonicalPathways, aliasPathwayIds = {}) {
  const existingPathways = Array.isArray(plan.pathways) ? plan.pathways : [];
  const existingByCanonicalId = new Map();

  for (const pathway of existingPathways) {
    const existingId = String(pathway.id ?? "").trim();
    const canonicalId = aliasPathwayIds[existingId] ?? existingId;
    if (!canonicalId || existingByCanonicalId.has(canonicalId)) {
      continue;
    }
    existingByCanonicalId.set(canonicalId, pathway);
  }

  return {
    ...plan,
    pathways: canonicalPathways.map((canonicalPathway) =>
      mergePathway(existingByCanonicalId.get(canonicalPathway.id), canonicalPathway)
    ),
  };
}

function createEmptyPlan(id, campusId, title, officialLinks = [], validationNotes = []) {
  return {
    id,
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
    officialLinks,
    degreeMapSections: [],
    validationNotes,
    grcCourseList: [],
    grcCourseListGuidance: "",
    bankIds: [],
    plannerNote: "",
    sourceType: "master-generated",
    pathways: [],
  };
}

function upsertPlan(plansById, plan) {
  const existing = plansById.get(plan.id);
  if (!existing) {
    plansById.set(plan.id, plan);
    return plan;
  }

  const merged = {
    ...existing,
    ...plan,
    officialLinks: uniqueLinks([
      ...(plan.officialLinks ?? []),
      ...(existing.officialLinks ?? []),
    ]),
    validationNotes: uniqueStrings([
      ...(existing.validationNotes ?? []),
      ...(plan.validationNotes ?? []),
    ]),
    pathways:
      Array.isArray(plan.pathways) && plan.pathways.length
        ? plan.pathways
        : existing.pathways ?? [],
  };
  plansById.set(plan.id, merged);
  return merged;
}

const TACOMA_CSS_PARENT_PLAN_ID = "uw-tacoma-computer-science-and-systems";
const TACOMA_CSS_PARENT_LINKS = [
  {
    label: "UW Tacoma Computer Science and Systems program",
    url: "https://www.tacoma.uw.edu/set/programs/undergrad/css",
  },
  {
    label: "UW Tacoma Computer Science and Systems BA degree requirements",
    url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
  },
  {
    label: "UW Tacoma Computer Science and Systems BS degree requirements",
    url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
  },
];

function applyBothellCoursePlannerAuditModeling(plans) {
  const plansById = new Map(plans.map((plan) => [plan.id, plan]));
  const bbaPlan = plansById.get("uw-bothell-business-administration");

  if (bbaPlan) {
    const makeBothellBbaLink = (label, slug) => ({
      label,
      url: `https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/${slug}`,
    });

    plansById.set(bbaPlan.id, {
      ...bbaPlan,
      officialLinks: uniqueLinks([
        {
          label: "UW Bothell BBA overview and areas of study",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration",
        },
        {
          label: "UW Bothell BBA prerequisite courses",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/admissions/prerequisite-courses",
        },
        {
          label: "UW Bothell BBA curriculum",
          url: "https://www.uwb.edu/business/undergraduate/bachelor-of-business-administration/curriculum",
        },
        ...(bbaPlan.officialLinks ?? []),
      ]),
      validationNotes: uniqueStrings([
        ...(bbaPlan.validationNotes ?? []),
        "Canonical Bothell BBA pathways follow the current School of Business option and concentration pages.",
      ]),
    });
    plansById.set(
      bbaPlan.id,
      replacePlanPathwaysWithCanonicalSet(plansById.get(bbaPlan.id), [
        createEmptyPathway("accounting-option", "Accounting Option", [
          makeBothellBbaLink("UW Bothell Accounting option requirements", "accounting"),
        ]),
        createEmptyPathway(
          "business-analytics-and-ai-concentration",
          "Business Analytics & AI Concentration",
          [
            makeBothellBbaLink(
              "UW Bothell Business Analytics and AI concentration requirements",
              "business-analytics-artificial-intelligence"
            ),
          ]
        ),
        createEmptyPathway(
          "leadership-and-strategic-innovation-option",
          "Leadership & Strategic Innovation Option",
          [
            makeBothellBbaLink(
              "UW Bothell Leadership and Strategic Innovation option requirements",
              "leadership"
            ),
          ]
        ),
        createEmptyPathway("marketing-option-and-concentration", "Marketing Option and Concentration", [
          makeBothellBbaLink("UW Bothell Marketing option and concentration requirements", "marketing"),
        ]),
        createEmptyPathway("supply-chain-management-option", "Supply Chain Management Option", [
          makeBothellBbaLink("UW Bothell Supply Chain Management option requirements", "supply-chain"),
        ]),
        createEmptyPathway("entrepreneurship-concentration", "Entrepreneurship Concentration", [
          makeBothellBbaLink("UW Bothell Entrepreneurship concentration requirements", "entrepreneurship"),
        ]),
        createEmptyPathway("finance-option-and-concentration", "Finance Option and Concentration", [
          makeBothellBbaLink("UW Bothell Finance option and concentration requirements", "finance-option"),
        ]),
        createEmptyPathway("management-concentration", "Management Concentration", [
          makeBothellBbaLink("UW Bothell Management concentration requirements", "management"),
        ]),
        createEmptyPathway("mis-concentration", "Management Information Systems (MIS) Concentration", [
          makeBothellBbaLink("UW Bothell MIS concentration requirements", "mis"),
        ]),
        createEmptyPathway("retail-management-concentration", "Retail Management Concentration", [
          makeBothellBbaLink("UW Bothell Retail Management concentration requirements", "retail"),
        ]),
        createEmptyPathway(
          "tim-concentration",
          "Technology & Innovation Management (TIM) Concentration",
          [makeBothellBbaLink("UW Bothell TIM concentration requirements", "tim")]
        ),
        createEmptyPathway("self-directed-concentration", "Self-Directed Concentration", [
          makeBothellBbaLink("UW Bothell self-directed concentration requirements", "self-directed"),
        ]),
      ])
    );
  }

  return [...plansById.values()];
}

function applyTacomaCoursePlannerAuditModeling(plans) {
  const plansById = new Map(plans.map((plan) => [plan.id, plan]));

  const babaPlan = plansById.get("uw-tacoma-bachelor-of-arts-in-business-administration");
  if (babaPlan) {
    plansById.set(babaPlan.id, {
      ...babaPlan,
      title: "Business Administration (BA)",
      shortTitle: "Business Administration",
      officialLinks: uniqueLinks([
        {
          label: "UW Tacoma Business Administration degree options",
          url: "https://www.tacoma.uw.edu/business/design-courses-baba",
        },
        {
          label: "UW Tacoma BA in Business Administration",
          url: "https://www.tacoma.uw.edu/business/baba",
        },
        ...(babaPlan.officialLinks ?? []),
      ]),
      validationNotes: uniqueStrings([
        ...(babaPlan.validationNotes ?? []),
        "Canonical Tacoma parent is Business Administration (BA); BABA remains a source/search alias and options are child pathways.",
      ]),
    });
    plansById.set(
      babaPlan.id,
      replacePlanPathwaysWithCanonicalSet(plansById.get(babaPlan.id), [
        createEmptyPathway("accounting-option", "Accounting option", [
          {
            label: "UW Tacoma BABA Accounting curriculum",
            url: "https://www.tacoma.uw.edu/business/design-courses-baba",
          },
        ]),
        createEmptyPathway("finance-option", "Finance option", [
          {
            label: "UW Tacoma BABA Finance curriculum",
            url: "https://www.tacoma.uw.edu/business/design-courses-baba",
          },
        ]),
        createEmptyPathway("general-business-option", "General Business option", [
          {
            label: "UW Tacoma BABA General Business curriculum",
            url: "https://www.tacoma.uw.edu/business/design-courses-baba",
          },
        ]),
        createEmptyPathway("management-option", "Management option", [
          {
            label: "UW Tacoma BABA Management curriculum",
            url: "https://www.tacoma.uw.edu/business/design-courses-baba",
          },
        ]),
        createEmptyPathway("marketing-option", "Marketing option", [
          {
            label: "UW Tacoma BABA Marketing curriculum",
            url: "https://www.tacoma.uw.edu/business/design-courses-baba",
          },
        ]),
      ])
    );
  }

  plansById.delete("uw-tacoma-computer-science-and-systems-ba");
  plansById.delete("uw-tacoma-computer-science-and-systems-bs");

  const cssParentPlan = upsertPlan(
    plansById,
    createEmptyPlan(
      TACOMA_CSS_PARENT_PLAN_ID,
      "uw-tacoma",
      "Computer Science and Systems",
      TACOMA_CSS_PARENT_LINKS,
      [
        "Canonical Tacoma CSS parent; BA and BS degree rows are modeled as child pathways for top-level planner audits.",
      ]
    )
  );
  plansById.set(
    TACOMA_CSS_PARENT_PLAN_ID,
    replacePlanPathwaysWithCanonicalSet(cssParentPlan, [
      createEmptyPathway("bachelor-of-arts", "Bachelor of Arts", [
        {
          label: "UW Tacoma Computer Science and Systems BA degree requirements",
          url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/ba",
        },
      ]),
      createEmptyPathway("bachelor-of-science", "Bachelor of Science", [
        {
          label: "UW Tacoma Computer Science and Systems BS degree requirements",
          url: "https://www.tacoma.uw.edu/set/programs/undergrad/css/bs",
        },
      ]),
    ])
  );

  const criminalJusticePlan = plansById.get("uw-tacoma-criminal-justice");
  if (criminalJusticePlan) {
    plansById.set(
      criminalJusticePlan.id,
      replacePlanPathwaysWithCanonicalSet(
        criminalJusticePlan,
        [
          createEmptyPathway("campus-pathway", "Campus pathway", [
            {
              label: "UW Tacoma Criminal Justice campus curriculum",
              url: "https://www.tacoma.uw.edu/swcj/criminal-justice-campus-curriculum",
            },
          ]),
          createEmptyPathway("online-pathway", "Online pathway", [
            {
              label: "UW Tacoma Criminal Justice online curriculum",
              url: "https://www.tacoma.uw.edu/swcj/cj-online-curriculum",
            },
            {
              label: "UW Tacoma Criminal Justice online admission requirements",
              url: "https://www.tacoma.uw.edu/swcj/criminal-justice-online-admission-requirements-and-how-apply",
            },
          ]),
        ],
        {
          "ba-route": "campus-pathway",
          "campus-curriculum": "campus-pathway",
          "online-curriculum": "online-pathway",
        }
      )
    );
  }

  const historyPlan = plansById.get("uw-tacoma-history");
  if (historyPlan) {
    plansById.set(
      historyPlan.id,
      replacePlanPathwaysWithCanonicalSet(
        historyPlan,
        [
          createEmptyPathway("general-history-option", "General History option", [
            {
              label: "UW Tacoma General History option requirements",
              url: "https://www.tacoma.uw.edu/sias/socs/general-history-option",
            },
          ]),
          createEmptyPathway("arts-culture-and-society-option", "Arts, Culture and Society option", [
            {
              label: "UW Tacoma History Arts, Culture and Society option requirements",
              url: "https://www.tacoma.uw.edu/sias/socs/arts-culture-and-society-option",
            },
          ]),
          createEmptyPathway("global-history-option", "Global History option", [
            {
              label: "UW Tacoma Global History option requirements",
              url: "https://www.tacoma.uw.edu/sias/socs/global-history-option",
            },
          ]),
          createEmptyPathway("labor-and-social-movements-option", "Labor and Social Movements option", [
            {
              label: "UW Tacoma Labor and Social Movements option requirements",
              url: "https://www.tacoma.uw.edu/sias/socs/labor-and-social-movements-option",
            },
          ]),
          createEmptyPathway("power-gender-and-identity-option", "Power, Gender and Identity option", [
            {
              label: "UW Tacoma Power, Gender and Identity option requirements",
              url: "https://www.tacoma.uw.edu/sias/socs/power-gender-and-identity-option",
            },
          ]),
        ],
        {
          "culture-and-society-option": "arts-culture-and-society-option",
          "gender-and-identity-option": "power-gender-and-identity-option",
        }
      )
    );
  }

  const informationTechnologyPlan = plansById.get("uw-tacoma-information-technology");
  if (informationTechnologyPlan) {
    plansById.set(
      informationTechnologyPlan.id,
      replacePlanPathwaysWithCanonicalSet(informationTechnologyPlan, [
        createEmptyPathway("information-assurance-cybersecurity-option", "Information Assurance and Cybersecurity option", [
          {
            label: "UW Tacoma Information Technology degree options",
            url: "https://www.tacoma.uw.edu/set/programs/undergrad/it",
          },
        ]),
        createEmptyPathway(
          "digital-mobile-forensics-option",
          "Digital Mobile Forensics option",
          [
            {
              label: "UW Tacoma Information Technology degree options",
              url: "https://www.tacoma.uw.edu/set/programs/undergrad/it",
            },
          ],
          [
            "Digital Mobile Forensics is temporarily suspended as an option; the Information Technology major remains active.",
          ]
        ),
      ])
    );
  }

  const urbanStudiesPlan = plansById.get("uw-tacoma-urban-studies");
  if (urbanStudiesPlan) {
    plansById.set(
      urbanStudiesPlan.id,
      replacePlanPathwaysWithCanonicalSet(
        urbanStudiesPlan,
        [
          createEmptyPathway("community-engagement-option", "Community Engagement option", [
            {
              label: "UW Tacoma Urban Studies degree requirements",
              url: "https://www.tacoma.uw.edu/urban-studies/ba-urban-studies",
            },
          ]),
          createEmptyPathway("gis-option", "GIS option", [
            {
              label: "UW Tacoma Urban Studies degree requirements",
              url: "https://www.tacoma.uw.edu/urban-studies/ba-urban-studies",
            },
          ]),
        ],
        {
          "gis-certificate": "gis-option",
          "gis-certificate-option": "gis-option",
        }
      )
    );
  }

  const educationPlan = plansById.get("uw-tacoma-education");
  if (educationPlan) {
    const educationSource = [
      {
        label: "UW Tacoma B.A. in Education overview major requirements",
        url: "https://www.tacoma.uw.edu/soe/bachelor-arts-education",
      },
    ];
    plansById.set(
      educationPlan.id,
      replacePlanPathwaysWithCanonicalSet(educationPlan, [
        createEmptyPathway(
          "special-education-dual-endorsement",
          "Special Education Dual Endorsement",
          educationSource
        ),
        createEmptyPathway("ba-route", "B.A. route", educationSource),
        createEmptyPathway(
          "english-language-learners-dual-endorsement",
          "English Language Learners (ELL) Dual Endorsement Option",
          educationSource
        ),
      ])
    );
  }

  return [...plansById.values()];
}

function applySeattleCoursePlannerAuditModeling(plans) {
  const plansById = new Map(plans.map((plan) => [plan.id, plan]));

  const chemistryPlan = plansById.get("uw-seattle-chemistry");
  if (chemistryPlan) {
    plansById.set(
      chemistryPlan.id,
      replacePlanPathwaysWithCanonicalSet({ ...chemistryPlan, pathways: [] }, [
        createEmptyPathway("ba-route", "B.A. route", [
          {
            label: "UW BA in Chemistry requirements",
            url: "https://chem.washington.edu/ba-chemistry",
          },
        ]),
        createEmptyPathway("bs-route", "B.S. route", [
          {
            label: "UW BS in Chemistry requirements",
            url: "https://chem.washington.edu/bs-chemistry",
          },
        ]),
        createEmptyPathway("acs-certified-bs-route", "ACS-certified B.S. route", [
          {
            label: "UW BS in Chemistry - ACS Certified requirements",
            url: "https://chem.washington.edu/bs-chemistry-acs-certified",
          },
          {
            label: "UW BS Chemistry ACS Certified checklist",
            url: "https://chem.washington.edu/sites/chem/files/documents/undergrad/acs2018.pdf",
          },
        ]),
      ])
    );
  }

  const psychologyPlan = plansById.get("uw-seattle-psychology");
  if (psychologyPlan) {
    plansById.set(
      psychologyPlan.id,
      replacePlanPathwaysWithCanonicalSet(psychologyPlan, [
        createEmptyPathway("bachelor-of-arts", "Bachelor of Arts", [
          {
            label: "UW Psychology Bachelor of Arts graduation requirements",
            url: "https://psych.uw.edu/undergraduate/prospective-students/graduation-requirements",
          },
        ]),
        createEmptyPathway("bachelor-of-science", "Bachelor of Science", [
          {
            label: "UW Psychology Bachelor of Science graduation requirements",
            url: "https://psych.uw.edu/undergraduate/prospective-students/graduation-requirements",
          },
        ]),
      ])
    );
  }

  const phghPlan = plansById.get("uw-seattle-public-health-global-health");
  if (phghPlan) {
    const phghSource = [
      {
        label: "UW Public Health-Global Health AUT 2024 curriculum sheet",
        url: "https://sph.washington.edu/sites/default/files/2024-09/Public-Health-Global-Health-Major-OnePager-Purple-Curriculum-AUT2024.pdf",
      },
    ];
    plansById.set(
      phghPlan.id,
      replacePlanPathwaysWithCanonicalSet(
        phghPlan,
        [
          createEmptyPathway("ba-option:global-health", "Global Health (BA Option)", phghSource),
          createEmptyPathway(
            "health-education-and-promotion-ba-option",
            "Health Education & Promotion (BA Option)",
            phghSource
          ),
          createEmptyPathway("bs-option:global-health", "Global Health (BS Option)", phghSource),
          createEmptyPathway(
            "nutritional-sciences-bs-option",
            "Nutritional Sciences (BS Option)",
            phghSource
          ),
        ],
        {
          "global-health-ba-option": "ba-option:global-health",
          "global-health-bs-option": "bs-option:global-health",
          "bs-nutritional-sciences-option": "nutritional-sciences-bs-option",
        }
      )
    );
  }

  const slavicPlan = plansById.get("uw-seattle-slavic-languages-and-literatures");
  if (slavicPlan) {
    plansById.set(
      slavicPlan.id,
      replacePlanPathwaysWithCanonicalSet(
        slavicPlan,
        [
          createEmptyPathway(
            "eastern-european-languages-literature-and-culture",
            "Eastern European Languages, Literature, and Culture",
            [
              {
                label: "UW BA in Eastern European Languages, Literature, and Culture",
                url: "https://slavic.washington.edu/ba-eastern-european-languages-literature-and-culture",
              },
            ]
          ),
          createEmptyPathway(
            "russian-language-literature-and-culture",
            "Russian Language, Literature, and Culture",
            [
              {
                label: "UW BA in Russian Language, Literature, and Culture",
                url: "https://slavic.washington.edu/ba-russian-language-literature-and-culture",
              },
            ]
          ),
        ],
        {
          "russian-language-slavic-languages-or-russian-and-slavic-literatures":
            "russian-language-literature-and-culture",
        }
      )
    );
  }

  return [...plansById.values()];
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

function getFingerprintLinkLabelScore(label) {
  const normalized = normalizeTransferPlannerText(label);
  if (!normalized) {
    return -100;
  }

  let score = 0;
  if (/\b(?:degree|major|program|graduation) requirements?\b/.test(normalized)) score += 80;
  if (/\brequirements?\b/.test(normalized)) score += 40;
  if (/\b(?:checklist|worksheet|catalog)\b/.test(normalized)) score += 20;
  if (/^scoped section\b/.test(normalized)) score -= 50;
  if (/\b(?:electives?|approved courses?|course list)\b/.test(normalized)) score -= 20;
  if (/\b(?:admissions?|advising|student resources?|faq)\b/.test(normalized)) score -= 30;
  return score;
}

function chooseFingerprintLinkLabel(entry, ownerId) {
  const labels = uniqueStrings(entry.labels ?? []);
  if (!labels.length) {
    return `${ownerId} requirements`;
  }

  return labels
    .map((label, index) => ({
      label,
      index,
      score: getFingerprintLinkLabelScore(label),
    }))
      .sort((left, right) => right.score - left.score || left.index - right.index)[0].label;
}

function getFingerprintLinkUrl(entry) {
  const url = canonicalizeOfficialSourceUrl(String(entry?.url ?? "").trim());
  const finalUrl = canonicalizeOfficialSourceUrl(String(entry?.finalUrl ?? "").trim());
  return url.includes("#") ? url : finalUrl || url;
}

function canonicalizeOfficialSourceUrl(url) {
  const normalizedUrl = String(url ?? "").trim();
  if (!normalizedUrl) {
    return "";
  }

  const fingerprintFinalUrl = FINGERPRINT_FINAL_URL_BY_URL.get(normalizedUrl);
  if (fingerprintFinalUrl) {
    return fingerprintFinalUrl;
  }

  return normalizedUrl
    .replace("https://www.tacoma.uw.edu/sias-new/socs-new/", "https://www.tacoma.uw.edu/sias/socs/")
    .replace("https://www.tacoma.uw.edu/sias-new/cac-new/", "https://www.tacoma.uw.edu/sias/cac/");
}

function buildFingerprintLinksForOwner(ownerId) {
  return uniqueLinks(
    (TRANSFER_PLANNER_FINGERPRINTS ?? [])
      .filter((entry) => (entry.ownerIds ?? []).includes(ownerId))
      .filter((entry) => entry.ok !== false && String(entry.url ?? "").trim())
      .map((entry) => ({
        label: chooseFingerprintLinkLabel(entry, ownerId),
        url: getFingerprintLinkUrl(entry),
        visibility: "hidden",
        status: "parser-unsupported",
        sourceConfidence: undefined,
      }))
  );
}

function parsePathwayOwnerId(ownerId) {
  const normalizedOwnerId = String(ownerId ?? "").trim();
  const pathwaySeparator = ":pathway:";
  const pathwayIndex = normalizedOwnerId.indexOf(pathwaySeparator);
  if (pathwayIndex === -1) {
    return null;
  }

  const planId = normalizedOwnerId.slice(0, pathwayIndex);
  const pathwayId = normalizedOwnerId.slice(pathwayIndex + pathwaySeparator.length);
  return planId && pathwayId ? { planId, pathwayId } : null;
}

function fingerprintEntryCanSeedPathway(entry, planId, titlesByPlanId) {
  if (!entry?.ok || !String(entry?.url ?? "").trim()) {
    return false;
  }

  const sourceText = [
    ...(entry.labels ?? []),
    entry.title,
    entry.url,
    entry.finalUrl,
  ]
    .filter(Boolean)
    .join(" ");

  if (/equivalency[-\s]?guide|green[-\s]?river/i.test(sourceText)) {
    return false;
  }

  if (
    (entry.labels ?? []).some((label) =>
      labelMentionsDifferentTransferPlannerMajor(planId, label, titlesByPlanId)
    )
  ) {
    return false;
  }

  return /\b(?:bachelor|degree|major|option|track|route|pathway|concentration|requirements?|catalog|curriculum)\b|#credential-/i.test(
    sourceText
  );
}

function selectPathwayKindSegment(value) {
  const normalized = normalizeTransferPlannerText(value);
  const segments = normalized
    .split(/\s+(?:[-\u2013\u2014])\s+|\s*:\s+|,\s+/)
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

function isPlanExcludedGeneratedPathwayCandidate(planId, pathwayCandidate) {
  const patterns = GENERATED_PATHWAY_EXCLUDED_LABEL_PATTERNS_BY_PLAN.get(planId) ?? [];
  if (!patterns.length) {
    return false;
  }

  const labelText = normalizeTransferPlannerText(pathwayCandidate?.label ?? "");
  const idText = normalizeTransferPlannerText(pathwayCandidate?.id ?? "").replace(/-/g, " ");
  return patterns.some((pattern) => pattern.test(labelText) || pattern.test(idText));
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
    case "fingerprint":
      score += 40;
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

function buildPathwayCandidateFromFingerprint(planTitle, pathwayId, entry) {
  const labels = uniqueStrings(entry?.labels ?? []);
  const label =
    labels
      .map((value) => normalizePathwayLabelCandidate(planTitle, value))
      .filter(Boolean)
      .sort(
        (left, right) =>
          getPathwayCandidateScore(right, "fingerprint") -
            getPathwayCandidateScore(left, "fingerprint") ||
          left.length - right.length ||
          left.localeCompare(right)
      )[0] || titleCasePathwayLabel(pathwayId);

  if (!label || isSuspiciousStructuralPathwayLabel(label)) {
    return null;
  }

  return {
    id: pathwayId,
    label,
    score: getPathwayCandidateScore(label, "fingerprint"),
    sourceKind: "fingerprint",
    officialLinks: uniqueLinks([
      {
        label: chooseFingerprintLinkLabel(entry, `${planTitle} ${label}`),
        url: getFingerprintLinkUrl(entry),
      },
    ]),
  };
}

function buildFingerprintPathwayCandidatesForPlan(planId, planTitle, titlesByPlanId) {
  const candidates = [];

  for (const entry of TRANSFER_PLANNER_FINGERPRINTS ?? []) {
    for (const ownerId of entry.ownerIds ?? []) {
      const parsedOwner = parsePathwayOwnerId(ownerId);
      if (!parsedOwner || parsedOwner.planId !== planId) {
        continue;
      }

      if (!fingerprintEntryCanSeedPathway(entry, planId, titlesByPlanId)) {
        continue;
      }

      const pathwayCandidate = buildPathwayCandidateFromFingerprint(
        planTitle,
        parsedOwner.pathwayId,
        entry
      );
      if (pathwayCandidate) {
        candidates.push(pathwayCandidate);
      }
    }
  }

  return candidates;
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

function buildPathwayEvidenceTokens(value) {
  return new Set(
    normalizeSpecializedPlanToken(value).filter(
      (token) => token.length >= 4 && !["course", "option", "track", "route", "pathway"].includes(token)
    )
  );
}

function pathwayCandidateHasIndependentBlockEvidence(planTitle, block, pathwayCandidate) {
  const pathwayTokens = buildPathwayEvidenceTokens(
    normalizePathwayLabelCandidate(planTitle, pathwayCandidate?.label) ||
      pathwayCandidate?.label ||
      pathwayCandidate?.id
  );
  if (!pathwayTokens.size) {
    return false;
  }

  const evidenceText = uniqueStrings([
    block.sourceLabel,
    block.primarySourceLabel,
    block.sourceUrl,
    block.primarySourceUrl,
    ...(block.pathwayLabels ?? []),
    ...(block.requirementCueLines ?? []),
    ...(block.chooseStatements ?? []),
  ]).join(" ");
  const evidenceTokens = buildPathwayEvidenceTokens(evidenceText);

  return [...pathwayTokens].every((token) => evidenceTokens.has(token));
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
      sourceKind,
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

  const selectedCandidate = candidates
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.label.length - right.label.length ||
        left.label.localeCompare(right.label)
    )[0] ?? null;

  if (
    selectedCandidate &&
    pathwayId &&
    ["owner", "fallback"].includes(selectedCandidate.sourceKind) &&
    !pathwayCandidateHasIndependentBlockEvidence(planTitle, block, selectedCandidate)
  ) {
    return null;
  }

  return selectedCandidate;
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

    const planGap = GAP_BY_OWNER_KEY.get(makeOwnerKey(planId, null)) ?? null;
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
          )) ||
        isPlanExcludedGeneratedPathwayCandidate(planId, pathwayCandidate)
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
        officialLinks: uniqueLinks(pathwayCandidate.officialLinks ?? []),
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

    if (!SUPPRESS_GENERATED_PATHWAY_CANDIDATE_PLAN_IDS.has(planId)) {
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

      for (const pathwayCandidate of buildFingerprintPathwayCandidatesForPlan(
        planId,
        title,
        primaryMajorTitlesByPlanId
      )) {
        addPathwayCandidate(pathwayCandidate, null);
      }
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

  for (const gap of TRANSFER_PLANNER_GAP_ENTRIES) {
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
  const basePlans = buildBasePlansFromParsedBlocks(TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCKS);
  const primaryMajorTitlesByPlanId = buildPrimaryMajorTitlesByPlanId(
    TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCKS
  );

  const parsedBlocksByOwnerScope = new Map();
  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCKS) {
    const key = makePlanPathwayKey(block.planId, block.pathwayId ?? null);
    if (!parsedBlocksByOwnerScope.has(key)) {
      parsedBlocksByOwnerScope.set(key, []);
    }
    parsedBlocksByOwnerScope.get(key).push(block);
  }

  const sourceGapByOwnerKey = new Map(
    TRANSFER_PLANNER_GAP_ENTRIES.map((entry) => [entry.ownerKey, entry])
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
    const ownerRouteTokens = getOfficialLinkRouteTokens(
      uniqueStrings([
        planId,
        pathwayId,
      ]).join(" ")
    );
    const keepLinkForOwnerRoute = (entry) =>
      !routeTokensConflict(
        ownerRouteTokens,
        getOfficialLinkRouteTokens(`${entry?.label ?? ""} ${entry?.url ?? ""}`)
      );

    return uniqueLinks(
      applyTransferPlannerManualSourceLinkOverride(
        planId,
        pathwayId ?? null,
        uniqueLinks([
          ...(Array.isArray(links) ? links : []).map((entry) => ({
            label: String(entry?.label ?? "").trim(),
            url: canonicalizeOfficialSourceUrl(entry?.url),
            note: String(entry?.note ?? "").trim() || undefined,
            visibility: defaults.visibility,
            status: defaults.status,
            reason: defaults.reason,
            sourceConfidence: defaults.sourceConfidence,
          })),
          ...supplementalLinks.map((entry) => ({
            label: String(entry?.label ?? "").trim(),
            url: canonicalizeOfficialSourceUrl(entry?.url),
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
              url: canonicalizeOfficialSourceUrl(entry.sourceUrl),
              visibility: sourceStatus.visibility,
              status: sourceStatus.status,
              reason: sourceStatus.reason,
              sourceConfidence: sourceStatus.sourceConfidence,
            };
          }),
        ]).filter(keepLinkForOwnerRoute)
      )
    );
  };

  return applySeattleCoursePlannerAuditModeling(
    applyTacomaCoursePlannerAuditModeling(applyBothellCoursePlannerAuditModeling(basePlans))
  )
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
