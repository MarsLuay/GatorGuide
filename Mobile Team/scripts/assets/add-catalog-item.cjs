#!/usr/bin/env node
/* global __dirname */

const fs = require("node:fs");
const path = require("node:path");
const { createInterface } = require("node:readline/promises");
const { stdin, stdout } = require("node:process");

const MOBILE_TEAM_ROOT = path.resolve(__dirname, "..", "..");
const OPPORTUNITIES_PATH =
  process.env.GATORGUIDE_OPPORTUNITIES_PATH ||
  path.join(MOBILE_TEAM_ROOT, "data", "starter-opportunities.json");
const RESOURCES_PATH =
  process.env.GATORGUIDE_RESOURCES_PATH ||
  path.join(MOBILE_TEAM_ROOT, "data", "resource-catalog.json");

const RESOURCE_SECTION_LABELS = {
  "resources.tools": "Tools",
  "resources.studentTools": "College Links",
  "resources.greenRiverTransfer": "Green River Transfer",
  "resources.commonWaUniversities": "Common WA Universities",
  "resources.transferGuides": "Transfer Guides",
};

const RESOURCE_SUBSECTION_LABELS = {
  "student-links": "Student Links",
  "transfer-planning": "Transfer Planning",
};

const RESOURCE_KIND_TARGETS = {
  tools: { sectionId: "tools", subsectionId: null },
  "student-tools": { sectionId: "student-tools", subsectionId: "student-links" },
  "green-river-transfer": { sectionId: "student-tools", subsectionId: "transfer-planning" },
  "common-wa-universities": { sectionId: "student-tools", subsectionId: "transfer-planning" },
  "transfer-guides": { sectionId: "student-tools", subsectionId: "transfer-planning" },
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
  { value: "work", label: "Jobs / internships" },
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
const BACK_SIGNAL = Symbol("back");
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

function log(message = "") {
  stdout.write(`${message}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function isBackCommand(value) {
  return String(value ?? "").trim().toLowerCase() === "back";
}

function isBackSignal(value) {
  return value === BACK_SIGNAL;
}

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

function safeDisplayLabel(section) {
  if (section?.title) return String(section.title).trim();
  const key = String(section?.titleKey ?? "").trim();
  return RESOURCE_SECTION_LABELS[key] ?? key ?? "Custom section";
}

function safeSubsectionLabel(subsection) {
  if (subsection?.title) return String(subsection.title).trim();
  const key = String(subsection?.titleKey ?? "").trim();
  return RESOURCE_SUBSECTION_LABELS[subsection?.id] ?? RESOURCE_SECTION_LABELS[key] ?? key ?? "Custom subsection";
}

function formatSectionPath(section, subsection = null) {
  const sectionLabel = safeDisplayLabel(section);
  if (!subsection) return sectionLabel;
  return `${sectionLabel} > ${safeSubsectionLabel(subsection)}`;
}

function findTargetResourceLocation(resourceCatalog, resourceKind) {
  const target = RESOURCE_KIND_TARGETS[resourceKind];
  if (!target) return { section: null, subsection: null };

  const section =
    resourceCatalog.find((item) => String(item.id) === String(target.sectionId)) ?? null;
  const subsection =
    section && target.subsectionId
      ? (Array.isArray(section.subsections)
          ? section.subsections.find((item) => String(item.id) === String(target.subsectionId)) ?? null
          : null)
      : null;

  return { section, subsection };
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

function formatHintLine(value) {
  const text = normalizeWhitespace(value);
  if (!text) return null;
  return ensureSentenceEnding(text);
}

function printQuestionHeader(label, hint = null) {
  log("");
  const formattedHint = formatHintLine(hint);
  if (formattedHint) {
    log(`Hint: ${formattedHint}`);
  }
  return label;
}

function formatDefaultValue(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item != null && item !== "").join(", ");
  }
  return value == null ? "" : String(value);
}

function formatBooleanSummary(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}

function formatNumberSummary(value) {
  return value == null ? "Unknown" : String(value);
}

function formatListSummary(values) {
  return Array.isArray(values) && values.length ? values.join(", ") : "Unknown";
}

function formatMoneySummary(min, max, currency = "USD") {
  if (min == null && max == null) return "Unknown";
  if (min != null && max != null) {
    return `${currency} ${min} to ${max}`;
  }
  if (min != null) return `${currency} ${min}+`;
  return `Up to ${currency} ${max}`;
}

function printSummary(title, rows) {
  log("");
  log(title);
  rows.forEach(([label, value]) => {
    log(`- ${label}: ${value == null || value === "" ? "Unknown" : value}`);
  });
}

function formatDateSummary(value) {
  return value ? value : "No auto-delete date";
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

function loadJsonArray(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    fail(`Expected an array in ${filePath}.`);
  }
  return parsed;
}

function loadAnswerFile(filePath) {
  if (!filePath) return null;
  if (!fs.existsSync(filePath)) {
    fail(`Could not find answers file: ${filePath}`);
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.replace(/\r/g, ""));
}

function createPrompter() {
  const answersFilePath = String(process.env.GATORGUIDE_ANSWERS_FILE ?? "").trim();
  const scriptedAnswers = loadAnswerFile(answersFilePath);

  if (scriptedAnswers) {
    return {
      async question(prompt) {
        stdout.write(prompt);
        const nextAnswer = scriptedAnswers.length ? scriptedAnswers.shift() : "";
        stdout.write(`${nextAnswer}\n`);
        return nextAnswer;
      },
      close() {
        // no-op for scripted runs
      },
    };
  }

  return createInterface({
    input: stdin,
    output: stdout,
  });
}

function writeJsonArray(filePath, value) {
  const backupPath = `${filePath}.bak`;
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

async function askText(rl, label, options = {}) {
  const required = options.required ?? false;
  const defaultValue = options.defaultValue ?? "";
  const hint =
    options.hint !== undefined
      ? options.hint
      : required
        ? ""
        : "Press Enter if unknown";

  while (true) {
    const suffix = defaultValue ? ` [default: ${defaultValue}]` : "";
    const promptLabel = printQuestionHeader(`${label}${suffix}`, hint);
    const answer = await rl.question(`${promptLabel} `);
    const trimmed = answer.trim();

    if (isBackCommand(trimmed)) {
      return BACK_SIGNAL;
    }

    if (!trimmed && defaultValue) {
      return String(defaultValue);
    }

    if (!trimmed) {
      if (required) {
        log("Please enter a value for this field.");
        continue;
      }
      return null;
    }

    if (required && isUnknownValue(trimmed)) {
      log("This field is required, so it cannot be left unknown.");
      continue;
    }

    if (!required && isUnknownValue(trimmed)) {
      return null;
    }

    return trimmed;
  }
}

async function askChoice(rl, label, options, config = {}) {
  const defaultValue = config.defaultValue ?? null;
  const invalidMessage = config.invalidMessage ?? "Please choose one of the listed options.";
  const showDefaultLabel = config.showDefaultLabel ?? true;

  while (true) {
    log("");
    log(label);
    options.forEach((option, index) => {
      const isDefault =
        showDefaultLabel && option.value === defaultValue ? " (default)" : "";
      log(`  ${index + 1}. ${option.label}${isDefault}`);
    });

    const answer = await rl.question("Choose a number and press Enter: ");
    const trimmed = answer.trim();

    if (isBackCommand(trimmed)) {
      return BACK_SIGNAL;
    }

    if (!trimmed && defaultValue != null) {
      return defaultValue;
    }

    const numericIndex = Number.parseInt(trimmed, 10);
    if (Number.isFinite(numericIndex) && numericIndex >= 1 && numericIndex <= options.length) {
      return options[numericIndex - 1].value;
    }

    const matchingOption = options.find(
      (option) => option.value.toLowerCase() === trimmed.toLowerCase()
    );
    if (matchingOption) return matchingOption.value;

    log(invalidMessage);
  }
}

async function askYesNoUnknown(rl, label, config = {}) {
  const defaultValue = config.defaultValue;
  const defaultHint =
    defaultValue === true ? "yes" : defaultValue === false ? "no" : "unknown";
  const hint =
    config.hint ?? `Type yes, no, or press Enter for unknown [default: ${defaultHint}].`;

  while (true) {
    const promptLabel = printQuestionHeader(label, hint);
    const answer = await rl.question(`${promptLabel} `);
    const normalized = answer.trim().toLowerCase();

    if (normalized === "back") return BACK_SIGNAL;

    if (!normalized) return defaultValue ?? null;
    if (["y", "yes"].includes(normalized)) return true;
    if (["n", "no"].includes(normalized)) return false;
    if (isUnknownValue(normalized)) return null;

    log("Please type yes, no, or press Enter for unknown.");
  }
}

async function askNumber(rl, label, config = {}) {
  const min = config.min ?? Number.NEGATIVE_INFINITY;
  const max = config.max ?? Number.POSITIVE_INFINITY;
  const allowDecimals = config.allowDecimals ?? true;
  const hint = config.hint ?? "Press Enter if unknown";
  const defaultValue = config.defaultValue;
  const defaultSuffix =
    defaultValue != null && defaultValue !== "" ? ` [default: ${defaultValue}]` : "";

  while (true) {
    const promptLabel = printQuestionHeader(`${label}${defaultSuffix}`, hint);
    const answer = await rl.question(`${promptLabel} `);
    const trimmed = answer.trim();
    if (isBackCommand(trimmed)) return BACK_SIGNAL;
    if (!trimmed) return defaultValue ?? null;
    if (isUnknownValue(trimmed)) return null;

    const parsed = allowDecimals
      ? Number(trimmed)
      : Number.parseInt(trimmed, 10);

    if (!Number.isFinite(parsed)) {
      log("Please enter a valid number.");
      continue;
    }

    if (parsed < min || parsed > max) {
      log(`Please enter a value between ${min} and ${max}.`);
      continue;
    }

    return parsed;
  }
}

async function askDateOnly(rl, label, config = {}) {
  const hint = config.hint ?? "Use YYYY-MM-DD format. Press Enter if unknown";
  const defaultValue = config.defaultValue ?? null;
  const defaultSuffix = defaultValue ? ` [default: ${defaultValue}]` : "";

  while (true) {
    const promptLabel = printQuestionHeader(`${label}${defaultSuffix}`, hint);
    const answer = await rl.question(`${promptLabel} `);
    const trimmed = answer.trim();
    if (isBackCommand(trimmed)) return BACK_SIGNAL;
    if (!trimmed) return defaultValue ?? null;
    if (isUnknownValue(trimmed)) {
      if (config.required) {
        log("This date is required for the deadline mode you chose.");
        continue;
      }
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    log("Please use YYYY-MM-DD.");
  }
}

async function askCommaList(rl, label, config = {}) {
  const defaultValue = Array.isArray(config.defaultValue) ? config.defaultValue : [];
  const defaultSuffix = defaultValue.length
    ? ` [default: ${formatDefaultValue(defaultValue)}]`
    : "";
  const promptLabel = printQuestionHeader(
    `${label}${defaultSuffix}`,
    "Separate multiple answers with commas or spaces. Use commas when one answer has multiple words. Press Enter if unknown"
  );
  const answer = await rl.question(`${promptLabel} `);
  if (isBackCommand(answer)) return BACK_SIGNAL;
  if (!answer.trim()) return [...defaultValue];
  if (isUnknownValue(answer)) return [];
  return Array.from(
    new Set(
      splitFlexibleListInput(answer)
    )
  );
}

async function askMultiSelect(rl, label, options, config = {}) {
  const defaultValue = Array.isArray(config.defaultValue) ? config.defaultValue : [];

  while (true) {
    const promptLabel = printQuestionHeader(label, config.hint ?? null);
    log(promptLabel);
    if (defaultValue.length) {
      const currentLabels = defaultValue
        .map((selected) => options.find((option) => option.value === selected)?.label ?? selected)
        .join(", ");
      log(`Current selection: ${currentLabels}`);
    }
    options.forEach((option, index) => {
      log(`  ${index + 1}. ${option.label}`);
    });
    const answer = await rl.question(
      config.promptText ??
        "Enter numbers separated by commas or spaces, or press Enter if none/unknown: "
    );
    const trimmed = answer.trim();
    if (isBackCommand(trimmed)) return BACK_SIGNAL;
    if (!trimmed) return [...defaultValue];
    if (isUnknownValue(trimmed)) return [];

    const parts = trimmed
      .split(/[,\s]+/)
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((value) => Number.isFinite(value));

    if (!parts.length || parts.some((value) => value < 1 || value > options.length)) {
      log(
        config.invalidMessage ??
          "Please use the numbers from the list, separated by commas or spaces."
      );
      continue;
    }

    return Array.from(new Set(parts)).map((value) => options[value - 1].value);
  }
}

async function askMajorProgramFieldSelection(rl, defaultValue = []) {
  const normalizedDefault = normalizeMajorList(defaultValue);
  const knownOptionValues = new Set(MAJOR_PROGRAM_FIELD_OPTIONS.map((option) => option.value));
  const knownDefaults = normalizedDefault.filter((value) => knownOptionValues.has(value));
  const customDefaults = normalizedDefault.filter((value) => !knownOptionValues.has(value));

  while (true) {
    const selectedValues = await askMultiSelect(
      rl,
      "Relevant majors, programs, or fields:",
      [...MAJOR_PROGRAM_FIELD_OPTIONS, CUSTOM_MAJOR_PROGRAM_OPTION],
      {
        defaultValue: [
          ...knownDefaults,
          ...(customDefaults.length ? [CUSTOM_MAJOR_PROGRAM_OPTION.value] : []),
        ],
        hint:
          'Choose any that apply. You can type numbers like 4, 5, 6, 1. Pick "Type custom major(s), program(s), or field(s)" if you need something not listed here.',
      }
    );

    if (isBackSignal(selectedValues)) return BACK_SIGNAL;

    const includesCustom = selectedValues.includes(CUSTOM_MAJOR_PROGRAM_OPTION.value);
    if (!includesCustom) {
      return normalizeMajorList(selectedValues);
    }

    const customValues = await askCommaList(
      rl,
      "Type any additional majors, programs, or fields not listed above:",
      {
        defaultValue: customDefaults,
      }
    );

    if (isBackSignal(customValues)) {
      continue;
    }

    return normalizeMajorList([
      ...selectedValues.filter((value) => value !== CUSTOM_MAJOR_PROGRAM_OPTION.value),
      ...customValues,
    ]);
  }
}

function getRecommendedDeadlineLabel(deadlineMode, deadlineType) {
  if (deadlineMode === "rolling") {
    return "Rolling applications";
  }

  if (deadlineType === "priority") {
    return "Priority deadline";
  }

  return "Application deadline";
}

async function askDeadlineLabelSelection(rl, state) {
  const optionSet =
    state.deadlineMode === "rolling"
      ? ROLLING_DEADLINE_LABEL_OPTIONS
      : FIXED_DEADLINE_LABEL_OPTIONS;
  const currentValue = normalizeWhitespace(state.deadlineLabel ?? "");
  const recommendedValue = getRecommendedDeadlineLabel(state.deadlineMode, state.deadlineType);
  const matchingOption = optionSet.find(
    (option) => option.value.toLowerCase() === currentValue.toLowerCase()
  );
  const defaultValue = currentValue
    ? (matchingOption?.value ?? CUSTOM_DEADLINE_LABEL_OPTION.value)
    : recommendedValue;

  const selectedValue = await askChoice(
    rl,
    "Which deadline text should students see?",
    [...optionSet, CUSTOM_DEADLINE_LABEL_OPTION],
    {
      defaultValue,
      invalidMessage:
        optionSet.length === 2
          ? "Enter in 1, 2, or 3 for your choice."
          : "Enter in 1, 2, 3, or 4 for your choice.",
      showDefaultLabel: false,
    }
  );

  if (isBackSignal(selectedValue)) {
    return BACK_SIGNAL;
  }

  if (selectedValue !== CUSTOM_DEADLINE_LABEL_OPTION.value) {
    return selectedValue;
  }

  const customValue = await askText(rl, "Type the deadline text students should see:", {
    hint: `Press Enter to use: "${recommendedValue}".`,
    defaultValue: matchingOption ? recommendedValue : currentValue || recommendedValue,
  });

  if (isBackSignal(customValue)) {
    return BACK_SIGNAL;
  }

  return customValue;
}

async function confirmAction(rl, label, defaultValue = false) {
  const confirmed = await askYesNoUnknown(rl, label, { defaultValue });
  if (isBackSignal(confirmed)) return BACK_SIGNAL;
  return confirmed === true;
}

async function askUrl(rl, label, options = {}) {
  while (true) {
    const raw = await askText(rl, label, options);
    if (isBackSignal(raw)) return BACK_SIGNAL;

    const normalized = normalizeUrl(raw);
    if (normalized || !options.required) {
      return normalized;
    }

    log(options.invalidMessage ?? "A valid link is required.");
  }
}

async function runWizard(rl, steps, initialState = {}) {
  const state = initialState;
  let index = 0;

  while (index < steps.length) {
    const step = steps[index];
    if (step.when && !step.when(state)) {
      index += 1;
      continue;
    }

    const result = await step.prompt(rl, state);
    if (isBackSignal(result)) {
      let previousIndex = index - 1;
      while (previousIndex >= 0) {
        const previousStep = steps[previousIndex];
        if (!previousStep.when || previousStep.when(state)) {
          break;
        }
        previousIndex -= 1;
      }

      if (previousIndex < 0) {
        log("You are already at the first question.");
        continue;
      }

      index = previousIndex;
      continue;
    }

    step.assign(state, result);
    index += 1;
  }

  return state;
}

async function resolveOpportunityId(rl, opportunities, baseId) {
  let candidateId = baseId || `opportunity-${Date.now()}`;
  const existingIndex = opportunities.findIndex(
    (item) => String(item.opportunityId ?? "").trim() === candidateId
  );

  if (existingIndex === -1) {
    return { opportunityId: candidateId, replaceIndex: -1 };
  }

  const action = await askChoice(
    rl,
    `An entry with the ID "${candidateId}" already exists. What would you like to do?`,
    [
      { value: "replace", label: "Replace the existing entry" },
      { value: "new-id", label: "Create a new unique ID automatically" },
      { value: "cancel", label: "Cancel without saving anything" },
    ]
  );

  if (action === "cancel") {
    log("Cancelled. No files were changed.");
    process.exit(0);
  }

  if (action === "replace") {
    return { opportunityId: candidateId, replaceIndex: existingIndex };
  }

  let suffix = 2;
  while (
    opportunities.some(
      (item) => String(item.opportunityId ?? "").trim() === `${candidateId}-${suffix}`
    )
  ) {
    suffix += 1;
  }
  return { opportunityId: `${candidateId}-${suffix}`, replaceIndex: -1 };
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

async function addOpportunity(rl, type) {
  log("");
  log("You're adding a new opportunity.");
  log("For questions you don't have answers to, just skip it by pressing Enter on your keyboard.");
  log('Type "back" at any prompt to return to the previous question.');

  const opportunities = loadJsonArray(OPPORTUNITIES_PATH);
  const nowIso = new Date().toISOString();
  let answers = {};

  while (true) {
    answers = await runWizard(rl, [
    {
      prompt: (_, state) =>
        askText(rl, "Enter the name of the new resource:", {
          required: true,
          hint: "",
          defaultValue: state.title ?? "",
        }),
      assign(state, value) {
        state.title = value;
      },
    },
    {
      prompt: (_, state) =>
        askText(rl, "Organization or provider name:", {
          defaultValue: state.organizationName ?? "",
        }),
      assign(state, value) {
        state.organizationName = value;
      },
    },
    {
      prompt: (_, state) =>
        askText(rl, "Short description / summary shown to students:", {
          defaultValue: state.summary ?? "",
        }),
      assign(state, value) {
        state.summary = value;
      },
    },
    {
      prompt: (_, state) =>
        askUrl(rl, "Official public link or application URL:", {
          defaultValue: state.externalUrl ?? "",
        }),
      assign(state, value) {
        state.externalUrl = value;
      },
    },
    {
      prompt: (_, state) =>
        askChoice(
          rl,
          "How should the deadline be tracked?",
          [
            { value: "one-time", label: "One-time fixed date" },
            { value: "yearly", label: "Yearly recurring date" },
            { value: "rolling", label: "Rolling / no fixed date" },
          ],
          { defaultValue: state.deadlineMode ?? "rolling" }
        ),
      assign(state, value) {
        state.deadlineMode = value;
        if (value === "rolling") {
          state.deadlineType = "rolling";
          state.dueDate = null;
        } else if (!state.deadlineType || state.deadlineType === "rolling") {
          state.deadlineType = "final";
        }
      },
    },
    {
      when: (state) => state.deadlineMode !== "rolling",
      prompt: (_, state) =>
        askChoice(
          rl,
          "What kind of deadline is this?",
          [
            { value: "final", label: "Final deadline" },
            { value: "priority", label: "Priority deadline" },
          ],
          { defaultValue: state.deadlineType ?? "final" }
        ),
      assign(state, value) {
        state.deadlineType = value;
      },
    },
    {
      when: (state) => state.deadlineMode !== "rolling",
      prompt: (_, state) =>
        askDateOnly(rl, "Deadline date:", {
          required: true,
          defaultValue: state.dueDate ?? null,
        }),
      assign(state, value) {
        state.dueDate = value;
      },
    },
    {
      prompt: (_, state) => askDeadlineLabelSelection(rl, state),
      assign(state, value) {
        state.deadlineLabel = value;
      },
    },
    {
      prompt: (_, state) =>
        askMultiSelect(
          rl,
          "Which financial-aid tags fit this opportunity?",
          FINANCIAL_AID_TAG_OPTIONS,
          { defaultValue: state.financialAidTags ?? [] }
        ),
      assign(state, value) {
        state.financialAidTags = value;
      },
    },
    {
      prompt: (_, state) => askMajorProgramFieldSelection(rl, state.suggestedMajors ?? []),
      assign(state, value) {
        state.suggestedMajors = value;
      },
    },
    {
      prompt: (_, state) =>
        askYesNoUnknown(
          rl,
          "Does a student need to match one of those majors/programs to qualify?",
          { defaultValue: state.hasToBeMajor ?? false }
        ),
      assign(state, value) {
        state.hasToBeMajor = value ?? false;
      },
    },
    {
      prompt: (_, state) =>
        askNumber(rl, "Minimum GPA:", {
          min: 0,
          max: 5,
          allowDecimals: true,
          defaultValue: state.gpaMin ?? null,
        }),
      assign(state, value) {
        state.gpaMin = value;
      },
    },
    {
      prompt: (_, state) =>
        askMultiSelect(rl, "Does it have residency restrictions?", RESIDENCY_OPTIONS, {
          defaultValue: state.residencySelection ?? [],
        }),
      assign(state, value) {
        state.residencySelection = value;
      },
    },
    {
      prompt: (_, state) =>
        askYesNoUnknown(rl, "Is this only for transfer students?", {
          defaultValue: state.transferOnly ?? false,
        }),
      assign(state, value) {
        state.transferOnly = value ?? false;
      },
    },
    {
      prompt: (_, state) =>
        askYesNoUnknown(rl, "Are recommendation letters required?", {
          defaultValue: state.needsRecommendations ?? false,
        }),
      assign(state, value) {
        state.needsRecommendations = value ?? false;
        if (!(value ?? false)) {
          state.recommendationCountMin = 0;
        }
      },
    },
    {
      when: (state) => state.needsRecommendations,
      prompt: (_, state) =>
        askNumber(rl, "Minimum recommendation count:", {
          min: 1,
          max: 12,
          allowDecimals: false,
          defaultValue: state.recommendationCountMin ?? 1,
        }),
      assign(state, value) {
        state.recommendationCountMin = value ?? 1;
      },
    },
    {
      prompt: (_, state) =>
        askNumber(rl, "How many essays or short-answer sections are required?", {
          min: 0,
          max: 20,
          allowDecimals: false,
          defaultValue: state.essayCount ?? 0,
        }),
      assign(state, value) {
        state.essayCount = value ?? 0;
      },
    },
    {
      prompt: (_, state) =>
        askNumber(rl, "Minimum award amount in dollars:", {
          min: 0,
          max: 100000000,
          allowDecimals: true,
          defaultValue: state.amountMin ?? null,
        }),
      assign(state, value) {
        state.amountMin = value;
      },
    },
    {
      prompt: (_, state) =>
        askNumber(rl, "Maximum award amount in dollars:", {
          min: 0,
          max: 100000000,
          allowDecimals: true,
          defaultValue: state.amountMax ?? null,
        }),
      assign(state, value) {
        state.amountMax = value;
      },
    },
    {
      prompt: (_, state) =>
        askText(rl, "Award currency code:", {
          defaultValue: state.awardCurrency ?? "USD",
        }),
      assign(state, value) {
        state.awardCurrency = value ?? "USD";
      },
    },
    {
      prompt: (_, state) =>
        askText(
          rl,
          "Award text shown to students (example: Up to $1,500 per quarter):",
          {
            defaultValue: state.amountText ?? "",
          }
        ),
      assign(state, value) {
        state.amountText = value;
      },
    },
    {
      prompt: (_, state) =>
        askYesNoUnknown(rl, "Is this renewable beyond one term/cycle?", {
          defaultValue: state.renewable ?? null,
        }),
      assign(state, value) {
        state.renewable = value;
      },
    },
    {
      prompt: (_, state) =>
        askYesNoUnknown(rl, "Is this tied to a specific college or school?", {
          defaultValue: state.tiedToCollege ?? (type === "college_deadline"),
        }),
      assign(state, value) {
        const tiedToCollege = value == null ? type === "college_deadline" : value;
        state.tiedToCollege = tiedToCollege;
        if (!tiedToCollege) {
          state.collegeName = null;
          state.collegeCity = null;
          state.collegeState = null;
          state.collegeWebsite = null;
        }
      },
    },
    {
      when: (state) => state.tiedToCollege,
      prompt: (_, state) =>
        askText(rl, "College or school name:", {
          defaultValue: state.collegeName ?? "",
        }),
      assign(state, value) {
        state.collegeName = value;
      },
    },
    {
      when: (state) => state.tiedToCollege,
      prompt: (_, state) =>
        askText(rl, "College city:", {
          defaultValue: state.collegeCity ?? "",
        }),
      assign(state, value) {
        state.collegeCity = value;
      },
    },
    {
      when: (state) => state.tiedToCollege,
      prompt: (_, state) =>
        askText(rl, "College state or region:", {
          defaultValue: state.collegeState ?? "",
        }),
      assign(state, value) {
        state.collegeState = value;
      },
    },
    {
      when: (state) => state.tiedToCollege,
      prompt: (_, state) =>
        askUrl(rl, "College website:", {
          defaultValue: state.collegeWebsite ?? "",
        }),
      assign(state, value) {
        state.collegeWebsite = value;
      },
    },
    {
      prompt: (_, state) =>
        askUrl(rl, "Where did you verify this information?", {
          defaultValue: state.sourceUrl ?? "",
        }),
      assign(state, value) {
        state.sourceUrl = value;
      },
    },
    {
      prompt: (_, state) =>
        askText(
          rl,
          "Source label (example: official scholarship page, department flyer):",
          {
            defaultValue: state.sourceLabel ?? "",
          }
        ),
      assign(state, value) {
        state.sourceLabel = value;
      },
    },
    {
      prompt: (_, state) =>
        askYesNoUnknown(rl, "Should this appear in the app right away?", {
          defaultValue: state.showImmediately ?? true,
        }),
      assign(state, value) {
        state.showImmediately = value ?? true;
      },
    },
  ], answers);

    const title = smartTitleCase(answers.title);
    const organizationName = smartTitleCase(answers.organizationName ?? title);
    const summary = polishedSentence(answers.summary ?? defaultOpportunitySummary(title, type));
    const externalUrl = answers.externalUrl ?? null;
    const deadlineMode = answers.deadlineMode;
    const deadlineType = deadlineMode === "rolling" ? "rolling" : answers.deadlineType;
    const dueDate = answers.dueDate ?? null;
    const deadlineLabel =
      smartSentenceCase(
        answers.deadlineLabel ??
          (deadlineMode === "rolling" ? "Rolling applications" : null)
      );
    const financialAidTags = answers.financialAidTags ?? [];
    const suggestedMajors = normalizeMajorList(answers.suggestedMajors ?? []);
    const hasToBeMajor = answers.hasToBeMajor ?? false;
    const gpaMin = answers.gpaMin ?? null;
    const residencySelection = answers.residencySelection ?? [];
    const transferOnly = answers.transferOnly ?? false;
    const needsRecommendations = answers.needsRecommendations ?? false;
    const recommendationCountMin = needsRecommendations
      ? answers.recommendationCountMin ?? 1
      : 0;
    const essayCount = answers.essayCount ?? 0;
    const amountMin = answers.amountMin ?? null;
    const amountMax = answers.amountMax ?? null;
    const awardCurrency = normalizeWhitespace(answers.awardCurrency ?? "USD").toUpperCase();
    const amountText = polishedSentence(answers.amountText ?? null);
    const renewable = answers.renewable ?? null;
    const collegeName = answers.tiedToCollege ? smartTitleCase(answers.collegeName ?? null) : null;
    const collegeCity = answers.tiedToCollege ? smartTitleCase(answers.collegeCity ?? null) : null;
    const collegeState = answers.tiedToCollege ? normalizeRegionText(answers.collegeState ?? null) : null;
    const collegeWebsite = answers.tiedToCollege ? answers.collegeWebsite ?? null : null;
    const sourceUrl = answers.sourceUrl ?? externalUrl;
    const sourceLabel = smartTitleCase(
      answers.sourceLabel ?? "Added with batch catalog tool"
    );
    const showImmediately = answers.showImmediately ?? true;

    printSummary("Review this new opportunity before saving.", [
      ["Type", type],
      ["Title", title],
      ["Organization", organizationName],
      ["Summary", summary],
      ["Official link", externalUrl ?? "Unknown"],
      ["Deadline tracking", deadlineMode],
      ["Deadline kind", deadlineType],
      ["Deadline date", dueDate ?? "Unknown"],
      ["Deadline label", deadlineLabel ?? "Unknown"],
      ["Financial-aid tags", formatListSummary(financialAidTags)],
      ["Relevant majors", formatListSummary(suggestedMajors)],
      ["Must match major", formatBooleanSummary(hasToBeMajor)],
      ["Minimum GPA", formatNumberSummary(gpaMin)],
      ["Residency restrictions", formatListSummary(residencySelection)],
      ["Transfer only", formatBooleanSummary(transferOnly)],
      ["Needs recommendations", formatBooleanSummary(needsRecommendations)],
      ["Recommendation minimum", formatNumberSummary(recommendationCountMin)],
      ["Essay count", formatNumberSummary(essayCount)],
      ["Award amount", formatMoneySummary(amountMin, amountMax, awardCurrency)],
      ["Award text", amountText ?? "Unknown"],
      ["Renewable", formatBooleanSummary(renewable)],
      ["College name", collegeName ?? "Unknown"],
      ["College city", collegeCity ?? "Unknown"],
      ["College state", collegeState ?? "Unknown"],
      ["College website", collegeWebsite ?? "Unknown"],
      ["Source URL", sourceUrl ?? "Unknown"],
      ["Source label", sourceLabel ?? "Unknown"],
      ["Show right away", formatBooleanSummary(showImmediately)],
    ]);

    const reviewAction = await askChoice(
      rl,
      "What would you like to do with this information?",
      [
        { value: "save", label: "Save" },
        { value: "edit", label: "Make changes" },
        { value: "discard", label: "Discard" },
      ],
      {
        invalidMessage: "Enter in 1, 2, or 3 for your choice.",
      }
    );

    if (reviewAction === "discard") {
      log("Discarded. No files were changed.");
      return;
    }

    if (reviewAction === "edit") {
      continue;
    }

    answers = {
      ...answers,
      title,
      organizationName,
      summary,
      externalUrl,
      deadlineMode,
      deadlineType,
      dueDate,
      deadlineLabel,
      financialAidTags,
      suggestedMajors,
      hasToBeMajor,
      gpaMin,
      residencySelection,
      transferOnly,
      needsRecommendations,
      recommendationCountMin,
      essayCount,
      amountMin,
      amountMax,
      awardCurrency,
      amountText,
      renewable,
      collegeName,
      collegeCity,
      collegeState,
      collegeWebsite,
      sourceUrl,
      sourceLabel,
      showImmediately,
    };
    break;
  }

  const {
    title,
    organizationName,
    summary,
    externalUrl,
    deadlineMode,
    deadlineType,
    dueDate,
    deadlineLabel,
    financialAidTags,
    suggestedMajors,
    hasToBeMajor,
    gpaMin,
    residencySelection,
    transferOnly,
    needsRecommendations,
    recommendationCountMin,
    essayCount,
    amountMin,
    amountMax,
    awardCurrency,
    amountText,
    renewable,
    collegeName,
    collegeCity,
    collegeState,
    collegeWebsite,
    sourceUrl,
    sourceLabel,
    showImmediately,
  } = answers;
  const recurrence =
    deadlineMode === "rolling"
      ? {
          isYearly: false,
          month: null,
          day: null,
          timezone: "America/Los_Angeles",
        }
      : {
          isYearly: deadlineMode === "yearly",
          month: deadlineMode === "yearly" ? getMonthDay(dueDate).month : null,
          day: deadlineMode === "yearly" ? getMonthDay(dueDate).day : null,
          timezone: "America/Los_Angeles",
        };

  const baseId = slugify(title);
  const { opportunityId, replaceIndex } = await resolveOpportunityId(
    rl,
    opportunities,
    baseId
  );
  const existing = replaceIndex >= 0 ? opportunities[replaceIndex] : null;

  const finalAmountMin =
    amountMin != null && amountMax != null && amountMin > amountMax
      ? amountMax
      : amountMin;
  const finalAmountMax =
    amountMin != null && amountMax != null && amountMin > amountMax
      ? amountMin
      : amountMax;

  const nextOpportunity = {
    schemaVersion: 1,
    opportunityId,
    type,
    status: showImmediately ? "active" : "draft",
    title,
    organizationName,
    summary,
    externalUrl,
    dueAt: deadlineMode === "rolling" ? null : buildDueAtIso(dueDate),
    recurrence,
    deadline: {
      type: deadlineType,
      label: deadlineLabel,
    },
    matching: {
      financialAidTags,
      suggestedMajors,
      hasToBeMajor,
    },
    eligibility: {
      gpaMin,
      residencyTypes: expandResidencyValues(residencySelection),
      transferOnly,
    },
    requirements: {
      needsRecommendations,
      recommendationCountMin,
      essayCount,
    },
    award: {
      amountMin: finalAmountMin,
      amountMax: finalAmountMax,
      currency: awardCurrency.toUpperCase(),
      amountText,
      renewable,
    },
    college: {
      collegeId: null,
      collegeName,
      city: collegeCity,
      state: collegeState,
      website: collegeWebsite,
    },
    source: {
      kind: "manual",
      sourceUrl,
      sourceLabel,
      model: null,
      fetchedAt: nowIso,
      verifiedAt: nowIso,
    },
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };

  const nextOpportunities = [...opportunities];
  if (replaceIndex >= 0) {
    nextOpportunities[replaceIndex] = nextOpportunity;
  } else {
    nextOpportunities.push(nextOpportunity);
  }

  nextOpportunities.sort((left, right) =>
    String(left.title ?? "").localeCompare(String(right.title ?? ""))
  );

  writeJsonArray(OPPORTUNITIES_PATH, nextOpportunities);

  log("");
  log(`Saved ${type} "${title}" to ${OPPORTUNITIES_PATH}`);
  log(`Generated ID: ${opportunityId}`);
  log(`Backup written to ${OPPORTUNITIES_PATH}.bak`);
}

async function addResource(rl) {
  log("");
  log("You're adding a new resource.");
  log("For questions you don't have answers to, just skip it by pressing Enter on your keyboard.");
  log('Type "back" at any prompt to return to the previous question.');

  const resourceCatalog = loadJsonArray(RESOURCES_PATH);
  const existingSectionOptions = resourceCatalog.flatMap((section) => {
    const options = [
      {
        value: section.id,
        label: safeDisplayLabel(section),
      },
    ];

    if (Array.isArray(section.subsections)) {
      options.push(
        ...section.subsections.map((subsection) => ({
          value: `${section.id}::${subsection.id}`,
          label: formatSectionPath(section, subsection),
        }))
      );
    }

    return options;
  });
  let answers = {};

  while (true) {
    answers = await runWizard(rl, [
    {
      prompt: (_, state) =>
        askChoice(rl, "What kind of resource is this?", RESOURCE_KIND_OPTIONS, {
          defaultValue: state.resourceKind ?? "student-tools",
        }),
      assign(state, value) {
        state.resourceKind = value;
        if (value !== "__other_existing__") {
          state.sectionChoice = null;
        }
        if (value !== "__new__") {
          state.sectionTitle = null;
          state.sectionIcon = null;
        }
      },
    },
    {
      when: (state) => state.resourceKind === "__other_existing__",
      prompt: (_, state) =>
        askChoice(
          rl,
          "Which existing section should this resource go into?",
          existingSectionOptions,
          {
            defaultValue: state.sectionChoice ?? null,
          }
        ),
      assign(state, value) {
        state.sectionChoice = value;
      },
    },
    {
      when: (state) => state.resourceKind === "__new__",
      prompt: (_, state) =>
        askText(rl, "New section title:", {
          required: true,
          hint: "",
          defaultValue: state.sectionTitle ?? "",
        }),
      assign(state, value) {
        state.sectionTitle = value;
      },
    },
    {
      when: (state) => state.resourceKind === "__new__",
      prompt: (_, state) =>
        askChoice(
          rl,
          "Choose an icon for the new section:",
          RESOURCE_ICON_OPTIONS,
          { defaultValue: state.sectionIcon ?? "link" }
        ),
      assign(state, value) {
        state.sectionIcon = value;
      },
    },
    {
      prompt: (_, state) =>
        askText(rl, "Enter the name of the new resource:", {
          required: true,
          hint: "",
          defaultValue: state.title ?? "",
        }),
      assign(state, value) {
        state.title = value;
      },
    },
    {
      prompt: (_, state) =>
        askText(rl, "Short description shown to students:", {
          defaultValue: state.description ?? "",
        }),
      assign(state, value) {
        state.description = value;
      },
    },
    {
      prompt: (_, state) =>
        askUrl(rl, "Resource URL or app:// route:", {
          required: true,
          hint: "You can paste a normal website link or an app:// route.",
          invalidMessage: "A valid link is required for a resource.",
          defaultValue: state.url ?? "",
        }),
      assign(state, value) {
        state.url = value;
      },
    },
    {
      prompt: (_, state) =>
        askYesNoUnknown(rl, "Should this resource auto-delete after a certain date?", {
          defaultValue: state.hasExpiry ?? false,
        }),
      assign(state, value) {
        state.hasExpiry = value ?? false;
        if (!(value ?? false)) {
          state.expiresAt = null;
        }
      },
    },
    {
      when: (state) => state.hasExpiry,
      prompt: (_, state) =>
        askDateOnly(rl, "Auto-delete date:", {
          required: true,
          defaultValue: state.expiresAt ?? null,
          hint: "Use YYYY-MM-DD format. The resource will disappear after this date",
        }),
      assign(state, value) {
        state.expiresAt = value;
      },
    },
    {
      prompt: (_, state) =>
        askCommaList(
          rl,
          "Search tags (examples: scholarship, transfer, resume):",
          {
            defaultValue: state.tags ?? [],
          }
        ),
      assign(state, value) {
        state.tags = normalizeTags(Array.isArray(value) ? value.join(", ") : value);
      },
    },
  ], answers);

    let targetSection = null;
    let targetSubsection = null;
    if (
      answers.resourceKind !== "__other_existing__" &&
      answers.resourceKind !== "__new__"
    ) {
      const location = findTargetResourceLocation(resourceCatalog, answers.resourceKind);
      targetSection = location.section;
      targetSubsection = location.subsection;
    }

    if (!targetSection && answers.resourceKind === "__other_existing__") {
      const [sectionId, subsectionId] = String(answers.sectionChoice ?? "").split("::");
      targetSection =
        resourceCatalog.find((section) => String(section.id) === sectionId) ?? null;
      targetSubsection =
        targetSection && subsectionId
          ? (Array.isArray(targetSection.subsections)
              ? targetSection.subsections.find((subsection) => String(subsection.id) === subsectionId) ?? null
              : null)
          : null;
    }

    const sectionLabel = targetSection
      ? formatSectionPath(targetSection, targetSubsection)
      : smartTitleCase(answers.sectionTitle);
    const title = smartTitleCase(answers.title);
    const description = polishedSentence(answers.description ?? `${title} resource link.`);
    const url = answers.url;
    const expiresAt = answers.hasExpiry ? answers.expiresAt ?? null : null;
    const tags = answers.tags ?? [];

    printSummary("Review this new resource before saving.", [
      ["Resource kind", answers.resourceKind === "__new__" ? "New custom section" : answers.resourceKind],
      ["Section", sectionLabel ?? "Unknown"],
      ["Title", title],
      ["Description", description],
      ["URL", url ?? "Unknown"],
      ["Auto-delete date", formatDateSummary(expiresAt)],
      ["Tags", formatListSummary(tags)],
    ]);

    const reviewAction = await askChoice(
      rl,
      "What would you like to do with this information?",
      [
        { value: "save", label: "Save" },
        { value: "edit", label: "Make changes" },
        { value: "discard", label: "Discard" },
      ],
      {
        invalidMessage: "Enter in 1, 2, or 3 for your choice.",
      }
    );

    if (reviewAction === "discard") {
      log("Discarded. No files were changed.");
      return;
    }

    if (reviewAction === "edit") {
      continue;
    }

    answers = {
      ...answers,
      sectionTitle: sectionLabel ?? answers.sectionTitle,
      title,
      description,
      url,
      expiresAt,
      tags,
    };
    break;
  }

  let targetSection = null;
  let targetSubsection = null;
  if (
    answers.resourceKind !== "__other_existing__" &&
    answers.resourceKind !== "__new__"
  ) {
    const location = findTargetResourceLocation(resourceCatalog, answers.resourceKind);
    targetSection = location.section;
    targetSubsection = location.subsection;
  }

  if (!targetSection && answers.resourceKind === "__other_existing__") {
    const [sectionId, subsectionId] = String(answers.sectionChoice ?? "").split("::");
    targetSection =
      resourceCatalog.find((section) => String(section.id) === sectionId) ?? null;
    targetSubsection =
      targetSection && subsectionId
        ? (Array.isArray(targetSection.subsections)
            ? targetSection.subsections.find((subsection) => String(subsection.id) === subsectionId) ?? null
            : null)
        : null;
  }

  if (!targetSection) {
    targetSection = {
      id: slugify(answers.sectionTitle) || `section-${Date.now()}`,
      title: smartTitleCase(answers.sectionTitle),
      icon: answers.sectionIcon,
      items: [],
    };
    resourceCatalog.push(targetSection);
  }

  const title = answers.title;
  const description = answers.description;
  const url = answers.url;
  const expiresAt = answers.expiresAt ?? null;
  const tags = answers.tags ?? [];

  const targetItemList =
    targetSubsection && Array.isArray(targetSubsection.items)
      ? targetSubsection.items
      : targetSection.items;

  targetItemList.push({
    title,
    description,
    url,
    expiresAt,
    tags,
  });

  writeJsonArray(RESOURCES_PATH, resourceCatalog);

  log("");
  log(`Saved resource "${title}" to ${RESOURCES_PATH}`);
  log(`Section: ${formatSectionPath(targetSection, targetSubsection)}`);
  log(`Backup written to ${RESOURCES_PATH}.bak`);
}

async function removeOpportunity(rl) {
  log("");
  log("You are removing an existing opportunity.");
  log('Type "back" at any prompt to return to the previous question.');

  const opportunities = loadJsonArray(OPPORTUNITIES_PATH);
  if (!opportunities.length) {
    log("There are no opportunities to remove.");
    return;
  }

  const answers = await runWizard(rl, [
    {
      prompt: () =>
        askChoice(
          rl,
          "Which kind of opportunity would you like to remove?",
          [
            { value: "scholarship", label: "Scholarship" },
            { value: "internship", label: "Internship / work opportunity" },
            { value: "college_deadline", label: "College deadline" },
            { value: "general_deadline", label: "General deadline" },
            { value: "__all__", label: "Show all opportunities" },
          ],
          { defaultValue: "__all__" }
        ),
      assign(state, value) {
        state.typeChoice = value;
      },
    },
    {
      prompt: (state) => {
        const filtered = opportunities.filter((item) =>
          state.typeChoice === "__all__" ? true : item.type === state.typeChoice
        );
        if (!filtered.length) {
          log("There are no matching opportunities to remove.");
          return BACK_SIGNAL;
        }
        return askChoice(
          rl,
          "Which opportunity would you like to remove?",
          filtered.map((item) => ({
            value: String(item.opportunityId ?? ""),
            label: `${item.title} (${item.type})`,
          }))
        );
      },
      assign(state, value) {
        state.choice = value;
      },
    },
    {
      prompt: (state) => {
        const filtered = opportunities.filter((item) =>
          state.typeChoice === "__all__" ? true : item.type === state.typeChoice
        );
        const selectedMatch = filtered.find(
          (item) => String(item.opportunityId ?? "") === state.choice
        );
        return confirmAction(
          rl,
          `Remove "${selectedMatch?.title ?? "this opportunity"}" from the opportunity catalog?`
        );
      },
      assign(state, value) {
        state.confirmed = value;
      },
    },
  ]);

  if (!answers.confirmed) {
    log("Cancelled. No files were changed.");
    return;
  }

  const filteredOpportunities = opportunities.filter((item) =>
    answers.typeChoice === "__all__" ? true : item.type === answers.typeChoice
  );
  const selected = filteredOpportunities.find(
    (item) => String(item.opportunityId ?? "") === answers.choice
  );
  if (!selected) {
    log("Could not find the selected opportunity.");
    return;
  }

  const nextOpportunities = opportunities.filter(
    (item) => String(item.opportunityId ?? "") !== answers.choice
  );
  writeJsonArray(OPPORTUNITIES_PATH, nextOpportunities);

  log("");
  log(`Removed opportunity "${selected.title}" from ${OPPORTUNITIES_PATH}`);
  log(`Backup written to ${OPPORTUNITIES_PATH}.bak`);
}

async function removeResource(rl) {
  log("");
  log("You are removing an existing resource.");
  log('Type "back" at any prompt to return to the previous question.');

  const resourceCatalog = loadJsonArray(RESOURCES_PATH);
  const nonEmptyLocations = resourceCatalog.flatMap((section) => {
    const locations = [];

    if (Array.isArray(section.items) && section.items.some(hasDisplayTitle)) {
      locations.push({
        value: section.id,
        label: safeDisplayLabel(section),
      });
    }

    if (Array.isArray(section.subsections)) {
      locations.push(
        ...section.subsections
          .filter(
            (subsection) => Array.isArray(subsection.items) && subsection.items.some(hasDisplayTitle)
          )
          .map((subsection) => ({
            value: `${section.id}::${subsection.id}`,
            label: formatSectionPath(section, subsection),
          }))
      );
    }

    return locations;
  });

  if (!nonEmptyLocations.length) {
    log("There are no resources to remove.");
    return;
  }

  const answers = await runWizard(rl, [
    {
      prompt: () =>
        askChoice(
          rl,
          "Which section contains the resource you want to remove?",
          nonEmptyLocations
        ),
      assign(state, value) {
        state.sectionChoice = value;
      },
    },
    {
      prompt: (state) => {
        const [sectionId, subsectionId] = String(state.sectionChoice ?? "").split("::");
        const section =
          resourceCatalog.find((item) => String(item.id) === sectionId) ?? null;
        const itemList =
          section && subsectionId
            ? (Array.isArray(section.subsections)
                ? section.subsections.find((subsection) => String(subsection.id) === subsectionId)?.items ?? null
                : null)
            : section?.items ?? null;

        if (!section || !Array.isArray(itemList) || !itemList.length) {
          log("Could not find any items in that section.");
          return BACK_SIGNAL;
        }

        return askChoice(
          rl,
          "Which resource would you like to remove?",
          itemList.flatMap((item, index) =>
            hasDisplayTitle(item)
              ? [
                  {
                    value: String(index),
                    label: normalizeWhitespace(item.title ?? item.titleKey),
                  },
                ]
              : []
          )
        );
      },
      assign(state, value) {
        state.itemChoice = value;
      },
    },
    {
      prompt: (state) => {
        const [sectionId, subsectionId] = String(state.sectionChoice ?? "").split("::");
        const section =
          resourceCatalog.find((item) => String(item.id) === sectionId) ?? null;
        const subsection =
          section && subsectionId
            ? (Array.isArray(section.subsections)
                ? section.subsections.find((item) => String(item.id) === subsectionId) ?? null
                : null)
            : null;
        const selectedIndex = Number.parseInt(state.itemChoice, 10);
        const selectedItem = subsection
          ? subsection.items?.[selectedIndex]
          : section?.items?.[selectedIndex];
        const selectedLabel = normalizeWhitespace(
          selectedItem?.title ?? selectedItem?.titleKey
        );
        return confirmAction(
          rl,
          `Remove "${selectedLabel || "this resource"}" from ${formatSectionPath(section, subsection)}?`
        );
      },
      assign(state, value) {
        state.confirmed = value;
      },
    },
  ]);

  if (!answers.confirmed) {
    log("Cancelled. No files were changed.");
    return;
  }

  const [sectionId, subsectionId] = String(answers.sectionChoice ?? "").split("::");
  const targetSection =
    resourceCatalog.find((section) => String(section.id) === sectionId) ?? null;
  const targetSubsection =
    targetSection && subsectionId
      ? (Array.isArray(targetSection.subsections)
          ? targetSection.subsections.find((subsection) => String(subsection.id) === subsectionId) ?? null
          : null)
      : null;
  const selectedIndex = Number.parseInt(answers.itemChoice, 10);
  const selectedItem = targetSubsection
    ? targetSubsection.items?.[selectedIndex]
    : targetSection?.items?.[selectedIndex];
  const selectedLabel = normalizeWhitespace(selectedItem?.title ?? selectedItem?.titleKey);

  if (!targetSection || !selectedItem || !selectedLabel) {
    log("Could not find the selected resource.");
    return;
  }

  if (targetSubsection) {
    targetSubsection.items.splice(selectedIndex, 1);
  } else {
    targetSection.items.splice(selectedIndex, 1);
  }
  writeJsonArray(RESOURCES_PATH, resourceCatalog);

  log("");
  log(`Removed resource "${selectedLabel}" from ${RESOURCES_PATH}`);
  log(`Section: ${formatSectionPath(targetSection, targetSubsection)}`);
  log(`Backup written to ${RESOURCES_PATH}.bak`);
}

async function main() {
  const rl = createPrompter();

  try {
    log("GatorGuide catalog helper");
    log("This tool adds or removes scholarships, internships, deadlines, and resources without hand-editing code.");
    log("");
    log("Tip: for most fields, you can press Enter if the information is unknown.");
    log('Tip: type "back" to return to the previous question.');

    const entryFlow = await runWizard(rl, [
      {
        prompt: () =>
          askChoice(
            rl,
            "What would you like to do?",
            [
              { value: "add", label: "Add a new item" },
              { value: "remove", label: "Remove an existing item" },
            ],
            {
              defaultValue: "add",
              invalidMessage: "Enter in 1 or 2 for your choice.",
              showDefaultLabel: false,
            }
          ),
        assign(state, value) {
          state.action = value;
        },
      },
      {
        prompt: async (state) => {
          const options = [
            { value: "scholarship", label: "Scholarship" },
            { value: "internship", label: "Internship / work opportunity" },
            { value: "college_deadline", label: "College deadline" },
            { value: "general_deadline", label: "General deadline" },
            {
              value: "resource",
              label:
                "Resource / helpful link (student tool, Green River transfer link, university link, transfer guide, or similar)",
            },
            { value: "__back__", label: "Back" },
          ];

          const choice = await askChoice(
            rl,
            state.action === "remove" ? "What would you like to remove?" : "What would you like to add?",
            options,
            {
              invalidMessage: "Enter in 1, 2, 3, 4, 5, or 6 for your choice.",
            }
          );

          if (choice === "__back__") return BACK_SIGNAL;
          return choice;
        },
        assign(state, value) {
          state.entryType = value;
        },
      },
    ]);

    const action = entryFlow.action;
    const entryType = entryFlow.entryType;

    if (action === "remove") {
      if (entryType === "resource") {
        await removeResource(rl);
        return;
      }

      await removeOpportunity(rl);
      return;
    }

    if (entryType === "resource") {
      await addResource(rl);
      return;
    }

    await addOpportunity(rl, entryType);
  } finally {
    rl.close();
  }
}

void main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
