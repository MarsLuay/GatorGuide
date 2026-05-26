/* Common schema, shaping, and normalization helpers for add-catalog-item.cjs. */

const RESOURCE_KIND_TARGETS = {
  tools: { sectionId: "tools", subsectionId: null },
  "student-tools": { sectionId: "student-tools", subsectionId: "student-links" },
  "green-river-transfer": { sectionId: "student-tools", subsectionId: "green-river-transfer" },
  "common-wa-universities": { sectionId: "student-tools", subsectionId: "common-wa-universities" },
  "transfer-guides": { sectionId: "student-tools", subsectionId: "transfer-guides" },
  "career-links": { sectionId: "career-internship-links", subsectionId: null },
  "career-internships": { sectionId: "career-internship-links", subsectionId: null },
};

const RESOURCE_KIND_OPTIONS = [
  {
    value: "tools",
    label: "Tool / in-app planner or calculator",
  },
  {
    value: "student-tools",
    label: "Student link",
  },
  {
    value: "green-river-transfer",
    label: "Green River transfer planning resource",
  },
  {
    value: "common-wa-universities",
    label: "Common 4-year university in Washington",
  },
  {
    value: "transfer-guides",
    label: "Transfer guide / equivalency guide",
  },
  {
    value: "career-links",
    label: "Career link",
  },
  {
    value: "__other_existing__",
    label: "Another existing resource section",
  },
  {
    value: "__new__",
    label: "Create a brand-new resource section",
  },
];

const RESOURCE_ICON_OPTIONS = [
  { value: "build", label: "Tools / utilities" },
  { value: "account-circle", label: "Student services" },
  { value: "school", label: "School / education" },
  { value: "map", label: "Maps / transfer destinations" },
  { value: "find-in-page", label: "Guides / documents" },
  { value: "attach-money", label: "Money / scholarships" },
  { value: "work", label: "Career / jobs" },
  { value: "event", label: "Dates / deadlines" },
  { value: "link", label: "General links" },
  { value: "public", label: "Public websites" },
  { value: "description", label: "Forms / documents" },
];

const FINANCIAL_AID_TAG_OPTIONS = [
  { value: "need_based", label: "Need-based" },
  { value: "merit", label: "Merit-based" },
  { value: "fafsa_required", label: "FAFSA/WASFA required" },
  { value: "pell_friendly", label: "Pell-friendly" },
  { value: "low_cost", label: "Good fit for lower-cost planning" },
  { value: "work_study", label: "Work-study / student employment" },
];

const RESIDENCY_OPTIONS = [
  { value: "instate", label: "In-state / Washington resident" },
  { value: "outofstate", label: "Out-of-state" },
  { value: "international", label: "International" },
];

const FIXED_DEADLINE_LABEL_OPTIONS = [
  { value: "Application deadline", label: "Application deadline" },
  { value: "Priority deadline", label: "Priority deadline" },
  { value: "Final deadline", label: "Final deadline" },
];

const ROLLING_DEADLINE_LABEL_OPTIONS = [
  { value: "Rolling applications", label: "Rolling applications" },
  { value: "Open until filled", label: "Open until filled" },
];

const CUSTOM_DEADLINE_LABEL_OPTION = {
  value: "__custom_deadline_label__",
  label: "Type custom deadline text",
};

const MAJOR_PROGRAM_FIELD_OPTIONS = [
  { value: "accounting", label: "Accounting" },
  { value: "apprenticeship", label: "Apprenticeship" },
  { value: "art", label: "Art / design" },
  { value: "biology", label: "Biology" },
  { value: "business", label: "Business" },
  { value: "chemistry", label: "Chemistry" },
  { value: "civil engineering", label: "Civil engineering" },
  { value: "communications", label: "Communications" },
  { value: "computer engineering", label: "Computer engineering" },
  { value: "computer science", label: "Computer science" },
  { value: "construction management", label: "Construction management" },
  { value: "criminal justice", label: "Criminal justice" },
  { value: "cybersecurity", label: "Cybersecurity" },
  { value: "data science", label: "Data science" },
  { value: "education", label: "Education" },
  { value: "electrical engineering", label: "Electrical engineering" },
  { value: "engineering", label: "Engineering" },
  { value: "english", label: "English / writing" },
  { value: "environmental science", label: "Environmental science" },
  { value: "finance", label: "Finance" },
  { value: "healthcare", label: "Health care / allied health" },
  { value: "human services", label: "Human services / social work" },
  { value: "humanities", label: "Humanities" },
  { value: "information technology", label: "Information technology" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "marketing", label: "Marketing" },
  { value: "mathematics", label: "Mathematics" },
  { value: "mechanical engineering", label: "Mechanical engineering" },
  { value: "nursing", label: "Nursing" },
  { value: "physics", label: "Physics" },
  { value: "pre-health", label: "Pre-health / pre-med" },
  { value: "psychology", label: "Psychology" },
  { value: "public health", label: "Public health" },
  { value: "science", label: "Science" },
  { value: "social sciences", label: "Social sciences" },
  { value: "software engineering", label: "Software engineering" },
  { value: "stem", label: "STEM" },
  { value: "trades", label: "Skilled trades" },
  { value: "welding", label: "Welding" },
];

const CUSTOM_MAJOR_PROGRAM_OPTION = {
  value: "__custom_major_program__",
  label: "Type custom major(s), program(s), or field(s)",
};

const TITLE_SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "via",
  "with",
]);
const WORD_CASE_OVERRIDES = new Map([
  ["uw", "UW"],
  ["grc", "GRC"],
  ["wsos", "WSOS"],
  ["fafsa", "FAFSA"],
  ["wasfa", "WASFA"],
  ["mesa", "MESA"],
  ["stem", "STEM"],
  ["hcde", "HCDE"],
  ["ece", "ECE"],
  ["ctclink", "ctcLink"],
  ["wa", "WA"],
]);

function slugify(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function isUnknownValue(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return (
    !normalized ||
    normalized === "unknown" ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "skip"
  );
}


function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeSpacing(value) {
  const text = normalizeWhitespace(value);
  if (!text) return "";

  return text
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1");
}

function capitalizeFirstAlpha(value) {
  return String(value ?? "").replace(/[A-Za-z]/, (match) => match.toUpperCase());
}

function applyWordOverrides(value) {
  let text = String(value ?? "");
  for (const [rawNeedle, replacement] of WORD_CASE_OVERRIDES.entries()) {
    const needle = rawNeedle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\b${needle}\\b`, "gi"), replacement);
  }
  return text;
}

function normalizeTokenCase(token, index) {
  const lower = token.toLowerCase();
  if (WORD_CASE_OVERRIDES.has(lower)) {
    return WORD_CASE_OVERRIDES.get(lower);
  }

  if (!/[a-z]/i.test(token)) {
    return token;
  }

  if (token.includes("&")) {
    return token
      .split("&")
      .map((part, partIndex) => normalizeTokenCase(part, index + partIndex))
      .join("&");
  }

  if (token.includes("'")) {
    return token
      .split("'")
      .map((part, partIndex) => normalizeTokenCase(part, index + partIndex))
      .join("'");
  }

  if (index > 0 && TITLE_SMALL_WORDS.has(lower)) {
    return lower;
  }

  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function smartTitleCase(value) {
  const text = normalizeSpacing(value);
  if (!text) return null;

  if (/[A-Z]/.test(text)) {
    return applyWordOverrides(capitalizeFirstAlpha(text));
  }

  const tokens = text.split(/(\s+|\/|-)/);
  let wordIndex = 0;
  return applyWordOverrides(
    tokens
    .map((token) => {
      if (!token || /^\s+$/.test(token) || token === "/" || token === "-") {
        return token;
      }
      const normalized = normalizeTokenCase(token, wordIndex);
      wordIndex += 1;
      return normalized;
    })
      .join("")
  );
}

function smartSentenceCase(value) {
  const text = normalizeSpacing(value);
  if (!text) return null;
  return applyWordOverrides(capitalizeFirstAlpha(text));
}

function ensureSentenceEnding(value) {
  const text = normalizeWhitespace(value);
  if (!text) return null;
  if (/[.!?]"?$/.test(text) || /[.!?]'$/.test(text)) {
    return text;
  }
  return `${text}.`;
}

function polishedSentence(value) {
  const text = smartSentenceCase(value);
  if (!text) return null;
  return ensureSentenceEnding(text);
}

function normalizeRegionText(value) {
  const text = normalizeSpacing(value);
  if (!text) return null;
  if (/^[A-Za-z]{2}$/.test(text)) {
    return text.toUpperCase();
  }
  return smartTitleCase(text);
}

function normalizeMajorList(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeWhitespace(value).toLowerCase())
        .filter(Boolean)
    )
  );
}

const OPPORTUNITY_TYPE_LABELS = {
  scholarship: "Scholarship",
  internship: "Internship",
  general_deadline: "General deadline",
  college_deadline: "College deadline",
  "quarter-start": "Quarter start",
  "quarter-end": "Quarter end",
};

const OPPORTUNITY_LISTING_KIND_LABELS = {
  database: "Database",
  individual: "Individual",
};

const OPPORTUNITY_DATABASE_KEYWORDS = [
  "database",
  "directory",
  "job board",
  "career network",
  "search portal",
  "search tool",
  "listings",
  "opportunities page",
  "opportunity listing",
  "opportunity listings",
  "scholarship opportunities",
  "scholarship listing",
  "scholarship listings",
  "internship opportunities",
  "internship listing",
  "internship listings",
  "student employment",
  "work study jobs",
  "work-study jobs",
  "sites directory",
  "current openings",
  "positions page",
  "varies by posting",
  "varies by scholarship",
];

function usesOpportunityListingKind(type) {
  return type === "scholarship" || type === "internship";
}

function getDefaultOpportunityListingKind(type) {
  return usesOpportunityListingKind(type) ? "individual" : null;
}

function parseOpportunityListingKind(value) {
  const parsed = String(value ?? "").trim().toLowerCase();
  if (parsed === "database") return "database";
  if (parsed === "individual") return "individual";
  return null;
}

function normalizeOpportunityListingKind(value, type) {
  if (!usesOpportunityListingKind(type)) return null;
  return parseOpportunityListingKind(value) ?? getDefaultOpportunityListingKind(type);
}

function inferOpportunityListingKind(opportunity) {
  const type = opportunity?.type;
  if (!usesOpportunityListingKind(type)) return null;
  const explicit = parseOpportunityListingKind(opportunity?.listingKind);
  if (explicit) return explicit;

  const searchableText = [
    opportunity?.title,
    opportunity?.organizationName,
    opportunity?.summary,
    opportunity?.externalUrl,
    opportunity?.deadline?.label,
    opportunity?.source?.sourceUrl,
    opportunity?.source?.sourceLabel,
  ]
    .join(" ")
    .toLowerCase();

  return OPPORTUNITY_DATABASE_KEYWORDS.some((keyword) =>
    searchableText.includes(keyword)
  )
    ? "database"
    : "individual";
}

function getOpportunityListingKindOptions(type) {
  if (type === "scholarship") {
    return [
      { value: "database", label: "Database / scholarship search list" },
      { value: "individual", label: "Individual scholarship" },
    ];
  }

  return [
    { value: "database", label: "Database / internship or job board" },
    { value: "individual", label: "Individual internship / work opportunity" },
  ];
}

function formatOpportunityListingKind(value, type, opportunity = null) {
  const normalized = opportunity
    ? inferOpportunityListingKind(opportunity)
    : normalizeOpportunityListingKind(value, type);
  return normalized ? OPPORTUNITY_LISTING_KIND_LABELS[normalized] : "";
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
}

function hasDisplayTitle(item) {
  return normalizeWhitespace(item?.title ?? item?.titleKey ?? item?.opportunityId ?? "");
}

function normalizeUrl(value) {
  const raw = normalizeWhitespace(value);
  if (!raw) return null;
  if (raw.startsWith("app://")) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function normalizeTags(value) {
  return Array.from(
    new Set(
      splitFlexibleListInput(value)
        .map((item) => normalizeSpacing(item).toLowerCase())
        .filter(Boolean)
    )
  );
}

function splitFlexibleListInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];

  if (/[;,]/.test(raw)) {
    return raw
      .split(/[;,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const matches = Array.from(raw.matchAll(/"([^"]+)"|'([^']+)'|(\S+)/g));
  return matches
    .map((match) => match[1] ?? match[2] ?? match[3] ?? "")
    .map((item) => item.trim())
    .filter(Boolean);
}

function expandResidencyValues(selectedValues) {
  const expanded = new Set();
  for (const value of selectedValues) {
    if (value === "instate") {
      expanded.add("instate");
      expanded.add("in state");
      continue;
    }
    if (value === "outofstate") {
      expanded.add("outofstate");
      expanded.add("out of state");
      continue;
    }
    expanded.add(value);
  }
  return Array.from(expanded);
}

function buildDueAtIso(dateOnly) {
  if (!dateOnly) return null;
  return `${dateOnly}T09:00:00.000Z`;
}

function getMonthDay(dateOnly) {
  const match = String(dateOnly ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return { month: null, day: null };
  }
  return {
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function defaultOpportunitySummary(title, type) {
  if (type === "internship") {
    return `${title} is an internship or work opportunity added through the guided catalog tool. Open the official link for the latest details.`;
  }
  if (type === "general_deadline" || type === "college_deadline") {
    return `${title} is a deadline added through the guided catalog tool. Open the official link for the latest details.`;
  }
  return `${title} is a scholarship added through the guided catalog tool. Open the official link for the latest details.`;
}

module.exports = {
  RESOURCE_KIND_TARGETS,
  RESOURCE_KIND_OPTIONS,
  RESOURCE_ICON_OPTIONS,
  FINANCIAL_AID_TAG_OPTIONS,
  RESIDENCY_OPTIONS,
  FIXED_DEADLINE_LABEL_OPTIONS,
  ROLLING_DEADLINE_LABEL_OPTIONS,
  CUSTOM_DEADLINE_LABEL_OPTION,
  MAJOR_PROGRAM_FIELD_OPTIONS,
  CUSTOM_MAJOR_PROGRAM_OPTION,
  OPPORTUNITY_TYPE_LABELS,
  OPPORTUNITY_LISTING_KIND_LABELS,
  slugify,
  isUnknownValue,
  normalizeWhitespace,
  normalizeSpacing,
  smartTitleCase,
  smartSentenceCase,
  ensureSentenceEnding,
  polishedSentence,
  normalizeRegionText,
  normalizeMajorList,
  usesOpportunityListingKind,
  getDefaultOpportunityListingKind,
  parseOpportunityListingKind,
  normalizeOpportunityListingKind,
  inferOpportunityListingKind,
  getOpportunityListingKindOptions,
  formatOpportunityListingKind,
  asList,
  hasDisplayTitle,
  normalizeUrl,
  normalizeTags,
  splitFlexibleListInput,
  expandResidencyValues,
  buildDueAtIso,
  getMonthDay,
  defaultOpportunitySummary,
};
