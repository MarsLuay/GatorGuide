#!/usr/bin/env node
/* global __dirname, Buffer */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { createInterface } = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const zlib = require("node:zlib");

const MOBILE_TEAM_ROOT = path.resolve(__dirname, "..", "..");
const REPO_ROOT = path.resolve(MOBILE_TEAM_ROOT, "..");
const OPPORTUNITIES_PATH =
  process.env.GATORGUIDE_OPPORTUNITIES_PATH ||
  path.join(MOBILE_TEAM_ROOT, "data", "starter-opportunities.json");
const RESOURCES_PATH =
  process.env.GATORGUIDE_RESOURCES_PATH ||
  path.join(MOBILE_TEAM_ROOT, "data", "resource-catalog.json");
const RESOURCE_EXCEL_EXPORT_PATH =
  process.env.GATORGUIDE_RESOURCE_EXCEL_EXPORT_PATH ||
  path.join(REPO_ROOT, "resource-catalog-export.xlsx");
const RESOURCE_TRANSLATIONS_PATH = path.join(
  MOBILE_TEAM_ROOT,
  "services",
  "app",
  "translations.ts"
);
const RESOURCE_COMMIT_MESSAGE = "Added resources";
const GOOGLE_SHEETS_EXPORT_URL =
  process.env.GATORGUIDE_GOOGLE_SHEETS_EXPORT_URL || "https://sheets.new";

const RESOURCE_SECTION_LABELS = {
  "resources.tools": "Tools",
  "resources.studentTools": "Student & Transfer Links",
  "resources.greenRiverTransfer": "Green River Transfer",
  "resources.commonWaUniversities": "Common WA Universities",
  "resources.transferGuides": "Transfer Guides",
};

const RESOURCE_SUBSECTION_LABELS = {
  "student-links": "Student Links",
  "green-river-transfer": "Green River Transfer",
  "transfer-guides": "Transfer Guides",
  "common-wa-universities": "Common WA Universities",
};

const RESOURCE_KIND_TARGETS = {
  tools: { sectionId: "tools", subsectionId: null },
  "student-tools": { sectionId: "student-tools", subsectionId: "student-links" },
  "green-river-transfer": { sectionId: "student-tools", subsectionId: "green-river-transfer" },
  "common-wa-universities": { sectionId: "student-tools", subsectionId: "common-wa-universities" },
  "transfer-guides": { sectionId: "student-tools", subsectionId: "transfer-guides" },
  "financial-aid-scholarships": { sectionId: "financial-aid-scholarships", subsectionId: null },
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
    value: "financial-aid-scholarships",
    label: "Financial aid or scholarship link",
  },
  {
    value: "career-internships",
    label: "Career, job, or internship link",
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

let englishResourceTranslations = null;

function parseTsStringLiteral(value) {
  try {
    return JSON.parse(`"${String(value ?? "")}"`);
  } catch {
    return String(value ?? "");
  }
}

function loadEnglishResourceTranslations() {
  if (englishResourceTranslations) return englishResourceTranslations;

  englishResourceTranslations = new Map();

  if (!fs.existsSync(RESOURCE_TRANSLATIONS_PATH)) {
    return englishResourceTranslations;
  }

  const source = fs.readFileSync(RESOURCE_TRANSLATIONS_PATH, "utf8");
  const englishBlock =
    source.match(/English:\s*\{([\s\S]*?)\n\s*\},\n\s*"?(?:Spanish|Chinese)/)?.[1] ??
    source;
  const resourceStringRegex = /"(resources\.[^"]+)":\s*"((?:\\.|[^"\\])*)"/g;
  let match;

  while ((match = resourceStringRegex.exec(englishBlock)) !== null) {
    englishResourceTranslations.set(match[1], parseTsStringLiteral(match[2]));
  }

  return englishResourceTranslations;
}

function translateResourceKey(key) {
  const normalizedKey = String(key ?? "").trim();
  if (!normalizedKey) return "";
  return loadEnglishResourceTranslations().get(normalizedKey) ?? normalizedKey;
}

function resolveCatalogExportText(entry, kind) {
  const value = normalizeWhitespace(kind === "title" ? entry?.title : entry?.description);
  if (value) return value;

  const key = normalizeWhitespace(kind === "title" ? entry?.titleKey : entry?.descriptionKey);
  return key ? translateResourceKey(key) : "";
}

function assignCatalogText(target, kind, value, key) {
  const cleanValue = normalizeWhitespace(value);
  const cleanKey = normalizeWhitespace(key);
  const translatedKey = cleanKey ? normalizeWhitespace(translateResourceKey(cleanKey)) : "";
  const targetKeyName = `${kind}Key`;

  if (cleanKey && (!cleanValue || cleanValue === cleanKey || cleanValue === translatedKey)) {
    target[targetKeyName] = cleanKey;
    return;
  }

  if (cleanValue) {
    target[kind] = cleanValue;
    return;
  }

  if (cleanKey) {
    target[targetKeyName] = cleanKey;
  }
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

function formatSummaryValue(value) {
  return value == null || value === "" ? "Unknown" : value;
}

function printSummary(title, rows, options = {}) {
  const numbered = options.numbered ?? false;
  log("");
  log(title);
  rows.forEach((row, index) => {
    const [label, value] = Array.isArray(row) ? row : [row.label, row.value];
    const prefix = numbered ? `${index + 1}.` : "-";
    log(`${prefix} ${label}: ${formatSummaryValue(value)}`);
  });
}

async function askSummaryRowNumber(rl, label, rows) {
  while (true) {
    log("");
    const answer = await rl.question(`${label} `);
    const normalized = answer.trim();

    if (isBackCommand(normalized)) {
      return BACK_SIGNAL;
    }

    const selectedIndex = Number.parseInt(normalized, 10);
    if (
      Number.isFinite(selectedIndex) &&
      String(selectedIndex) === normalized &&
      selectedIndex >= 1 &&
      selectedIndex <= rows.length
    ) {
      return selectedIndex - 1;
    }

    log(`Enter a number from 1 to ${rows.length}.`);
  }
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

function resolveUserFilePath(value, defaultPath) {
  const raw = String(value ?? "").trim();
  const chosen = raw || defaultPath;
  const unquoted = chosen.replace(/^["']|["']$/g, "");
  if (path.isAbsolute(unquoted)) return unquoted;
  return path.resolve(REPO_ROOT, unquoted);
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function formatCsvRow(values) {
  return values.map(csvEscape).join(",");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      pushField();
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      pushRow();
      continue;
    }

    field += char;
  }

  if (field || row.length || !text.endsWith("\n")) {
    pushRow();
  }

  return rows.filter((items) => items.some((item) => String(item ?? "").trim()));
}

function formatSpreadsheetCell(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item != null && item !== "").join("; ");
  }
  return value == null ? "" : String(value);
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(value) {
  return String(value ?? "")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function unescapeXmlPlainText(value) {
  return String(value ?? "")
    .replace(/&(apos|quot|gt|lt|amp);/g, (_entity, name) => {
      if (name === "apos") return "'";
      if (name === "quot") return '"';
      if (name === "amp") return "&";
      return "";
    })
    .split("<")
    .join("")
    .split(">")
    .join("");
}

function getXmlAttribute(attributes, name) {
  const match = String(attributes ?? "").match(
    new RegExp(`(?:^|\\s)${name}="([^"]*)"`)
  );
  return match ? unescapeXml(match[1]) : null;
}

function extractTagText(xml, tagName) {
  const match = String(xml ?? "").match(
    new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`)
  );
  return match ? unescapeXml(match[1]) : "";
}

function extractTextRuns(xml) {
  const text = String(xml ?? "");
  const runs = [];
  const textRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let match;

  while ((match = textRegex.exec(text)) !== null) {
    runs.push(unescapeXmlPlainText(match[1]));
  }

  if (runs.length) return runs.join("");
  return unescapeXmlPlainText(stripXmlTagsToText(text));
}

function stripXmlTagsToText(value) {
  const text = String(value ?? "");
  let result = "";
  let inTag = false;

  for (const char of text) {
    if (char === "<") {
      inTag = true;
      continue;
    }
    if (char === ">") {
      inTag = false;
      continue;
    }
    if (!inTag) {
      result += char;
    }
  }

  return result;
}

function columnName(columnIndex) {
  let index = columnIndex + 1;
  let name = "";

  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }

  return name;
}

function columnNameToIndex(name) {
  let index = 0;
  const normalized = String(name ?? "").toUpperCase();

  for (const char of normalized) {
    if (char < "A" || char > "Z") continue;
    index = index * 26 + (char.charCodeAt(0) - 64);
  }

  return Math.max(0, index - 1);
}

function getResourceRows(resourceCatalog) {
  const rows = [];

  for (const section of resourceCatalog) {
    const sectionFields = {
      sectionId: section.id,
      sectionTitle: section.title,
      sectionTitleKey: section.titleKey,
      sectionIcon: section.icon,
    };

    rows.push({
      rowType: "section",
      ...sectionFields,
    });

    for (const item of section.items ?? []) {
      rows.push({
        rowType: "item",
        ...sectionFields,
        itemTitle: item.title,
        itemTitleKey: item.titleKey,
        itemDescription: item.description,
        itemDescriptionKey: item.descriptionKey,
        url: item.url,
        expiresAt: item.expiresAt,
        tags: item.tags,
      });
    }

    for (const subsection of section.subsections ?? []) {
      const subsectionFields = {
        subsectionId: subsection.id,
        subsectionTitle: subsection.title,
        subsectionTitleKey: subsection.titleKey,
      };

      rows.push({
        rowType: "subsection",
        ...sectionFields,
        ...subsectionFields,
      });

      for (const item of subsection.items ?? []) {
        rows.push({
          rowType: "item",
          ...sectionFields,
          ...subsectionFields,
          itemTitle: item.title,
          itemTitleKey: item.titleKey,
          itemDescription: item.description,
          itemDescriptionKey: item.descriptionKey,
          url: item.url,
          expiresAt: item.expiresAt,
          tags: item.tags,
        });
      }
    }
  }

  return rows;
}

const RESOURCE_EXCEL_HEADERS = [
  "rowType",
  "sectionId",
  "sectionTitle",
  "sectionTitleKey",
  "sectionIcon",
  "subsectionId",
  "subsectionTitle",
  "subsectionTitleKey",
  "itemTitle",
  "itemTitleKey",
  "itemDescription",
  "itemDescriptionKey",
  "url",
  "expiresAt",
  "tags",
];

const RESOURCE_EXCEL_EXPORT_COLUMNS = [
  { key: "url", label: "LINK", width: 44.5 },
  { key: "itemTitle", label: "NAME", width: 31.13 },
  { key: "itemDescription", label: "DESCRIPTION", width: 56.88 },
  { key: "sectionTitle", label: "SECTION", width: 25.63 },
  { key: "subsectionTitle", label: "SUBSECTION", width: 25.63 },
  { key: "tags", label: "TAGS", width: 35.25 },
  { key: "expiresAt", label: "EXPIRES AT", width: 14.88 },
  { key: "sectionId", label: "SECTION ID", width: 18.75, hidden: true },
  { key: "subsectionId", label: "SUBSECTION ID", width: 18.75, hidden: true },
  { key: "sectionIcon", label: "ICON", width: 14.88, hidden: true },
  { key: "itemTitleKey", label: "NAME KEY", width: 31.13, hidden: true },
  { key: "itemDescriptionKey", label: "DESCRIPTION KEY", width: 35.25, hidden: true },
  { key: "sectionTitleKey", label: "SECTION KEY", width: 31.13, hidden: true },
  { key: "subsectionTitleKey", label: "SUBSECTION KEY", width: 31.13, hidden: true },
];

const RESOURCE_EXCEL_HEADER_ALIASES = {
  rowType: ["rowType", "ROW TYPE", "TYPE"],
  sectionId: ["sectionId", "SECTION ID"],
  sectionTitle: ["sectionTitle", "SECTION"],
  sectionTitleKey: ["sectionTitleKey", "SECTION KEY"],
  sectionIcon: ["sectionIcon", "ICON"],
  subsectionId: ["subsectionId", "SUBSECTION ID"],
  subsectionTitle: ["subsectionTitle", "SUBSECTION"],
  subsectionTitleKey: ["subsectionTitleKey", "SUBSECTION KEY"],
  itemTitle: ["itemTitle", "NAME", "TITLE"],
  itemTitleKey: ["itemTitleKey", "NAME KEY", "TITLE KEY"],
  itemDescription: ["itemDescription", "DESCRIPTION"],
  itemDescriptionKey: ["itemDescriptionKey", "DESCRIPTION KEY"],
  url: ["url", "LINK", "URL"],
  expiresAt: ["expiresAt", "EXPIRES AT", "EXPIRES"],
  tags: ["tags", "TAGS"],
};

const OPPORTUNITY_EXCEL_EXPORT_COLUMNS = [
  { key: "link", label: "LINK", width: 44.5 },
  { key: "name", label: "NAME", width: 31.13 },
  { key: "deadline", label: "DEADLINE", width: 18.75 },
  { key: "type", label: "TYPE", width: 18.75 },
  { key: "organization", label: "ORGANIZATION", width: 28 },
  { key: "description", label: "DESCRIPTION", width: 56.88 },
  { key: "award", label: "AWARD", width: 24 },
  { key: "sourceLabel", label: "SOURCE", width: 31.13 },
  { key: "sourceKind", label: "SOURCE KIND", width: 16 },
  { key: "tags", label: "TAGS", width: 35.25 },
  { key: "status", label: "STATUS", width: 14 },
  { key: "opportunityId", label: "OPPORTUNITY ID", width: 35.25, hidden: true },
];

const SCHOLARSHIP_EXCEL_EXPORT_COLUMNS = [
  { key: "link", label: "LINK", width: 44.5 },
  { key: "name", label: "NAME", width: 31.13 },
  { key: "deadline", label: "DEADLINE", width: 18.75 },
  { key: "amount", label: "AMOUNT", width: 24 },
  { key: "awardCadence", label: "One time or continuous", width: 21 },
  { key: "description", label: "DESCRIPTION", width: 56.88 },
  { key: "prereq", label: "PREREQ", width: 35.25 },
  { key: "institutionSpecific", label: "Institution-specific?", width: 22 },
  { key: "disciplineSpecific", label: "Discipline-specific?", width: 21 },
  { key: "fullTimeRequired", label: "Full-time required?", width: 20 },
  { key: "gpaRequirement", label: "GPA requirement", width: 17 },
  { key: "materialsRequired", label: "MATERIALS REQUIRED", width: 35.25 },
  { key: "essayRequired", label: "Essay required?", width: 17 },
  { key: "submissionForm", label: "Submission Form", width: 19 },
  { key: "essayCount", label: "How many Essays?", width: 18 },
  {
    key: "recommendationCount",
    label: "How many recommendations required?",
    width: 31.13,
  },
  { key: "sourceKind", label: "SOURCE KIND", width: 16, hidden: true },
  { key: "status", label: "STATUS", width: 14, hidden: true },
  { key: "opportunityId", label: "OPPORTUNITY ID", width: 35.25, hidden: true },
];

const LEGACY_EXCEL_EXPORT_COLUMNS = [
  { key: "link", label: "LINK", width: 44.5 },
  { key: "name", label: "NAME", width: 31.13 },
  { key: "deadline", label: "DEADLINE", width: 18.75 },
  { key: "type", label: "TYPE", width: 18.75 },
  { key: "organization", label: "ORGANIZATION", width: 28 },
  { key: "amount", label: "AMOUNT", width: 24 },
  { key: "awardCadence", label: "One time or continuous", width: 21 },
  { key: "description", label: "DESCRIPTION", width: 56.88 },
  { key: "prereq", label: "PREREQ", width: 35.25 },
  { key: "institutionSpecific", label: "Institution-specific?", width: 22 },
  { key: "disciplineSpecific", label: "Discipline-specific?", width: 21 },
  { key: "fullTimeRequired", label: "Full-time required?", width: 20 },
  { key: "gpaRequirement", label: "GPA requirement", width: 17 },
  { key: "materialsRequired", label: "MATERIALS REQUIRED", width: 35.25 },
  { key: "essayRequired", label: "Essay required?", width: 17 },
  { key: "submissionForm", label: "Submission Form", width: 19 },
  { key: "essayCount", label: "How many Essays?", width: 18 },
  {
    key: "recommendationCount",
    label: "How many recommendations required?",
    width: 31.13,
  },
  { key: "sourceLabel", label: "SOURCE", width: 31.13 },
  { key: "tags", label: "TAGS", width: 35.25 },
  { key: "sourceKind", label: "SOURCE KIND", width: 16, hidden: true },
  { key: "status", label: "STATUS", width: 14, hidden: true },
  { key: "opportunityId", label: "OPPORTUNITY ID", width: 35.25, hidden: true },
];

const OPPORTUNITY_TYPE_LABELS = {
  scholarship: "Scholarship",
  internship: "Internship",
  general_deadline: "General deadline",
  college_deadline: "College deadline",
  "quarter-start": "Quarter start",
  "quarter-end": "Quarter end",
};

const WORKBOOK_OPTION_SHEET_NAME = "Options";
const WORKBOOK_VALIDATION_MAX_ROW = 1000;
const DEFAULT_SCHOLARSHIP_PREREQ_OPTIONS = [
  "High School Senior",
  "Newly Accepted at new school",
  "Graduate Student",
  "First Year or Transfer",
  "CC to Uni transfer",
  "Transfer student",
];
const DEFAULT_INSTITUTION_OPTIONS = ["No", "UW"];
const DEFAULT_YES_NO_OPTIONS = ["No", "Yes"];
const DEFAULT_SUBMISSION_FORM_OPTIONS = ["Mail", "Email", "In Person", "Online"];
const DEFAULT_AWARD_CADENCE_OPTIONS = ["one time", "continuous"];

function normalizeSpreadsheetHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function buildResourceHeaderIndexes(headers) {
  const normalizedIndexes = new Map();

  headers.forEach((header, index) => {
    const normalized = normalizeSpreadsheetHeader(header);
    if (normalized && !normalizedIndexes.has(normalized)) {
      normalizedIndexes.set(normalized, index);
    }
  });

  const indexes = new Map();
  for (const header of RESOURCE_EXCEL_HEADERS) {
    const aliases = RESOURCE_EXCEL_HEADER_ALIASES[header] ?? [header];
    const aliasIndex = aliases
      .map((alias) => normalizedIndexes.get(normalizeSpreadsheetHeader(alias)))
      .find((index) => index != null);

    if (aliasIndex != null) {
      indexes.set(header, aliasIndex);
    }
  }

  return indexes;
}

function getResourceExportRows(resourceCatalog) {
  const rows = [];

  const addItem = (section, subsection, item) => {
    rows.push({
      sectionId: section.id,
      sectionTitle: resolveCatalogExportText(section, "title") || safeDisplayLabel(section),
      sectionTitleKey: section.titleKey,
      sectionIcon: section.icon,
      subsectionId: subsection?.id,
      subsectionTitle: subsection
        ? resolveCatalogExportText(subsection, "title") || safeSubsectionLabel(subsection)
        : "",
      subsectionTitleKey: subsection?.titleKey,
      itemTitle: resolveCatalogExportText(item, "title"),
      itemTitleKey: item.titleKey,
      itemDescription: resolveCatalogExportText(item, "description"),
      itemDescriptionKey: item.descriptionKey,
      url: item.url,
      expiresAt: item.expiresAt,
      tags: item.tags,
    });
  };

  for (const section of resourceCatalog) {
    for (const item of section.items ?? []) {
      addItem(section, null, item);
    }

    for (const subsection of section.subsections ?? []) {
      for (const item of subsection.items ?? []) {
        addItem(section, subsection, item);
      }
    }
  }

  return rows;
}

function resourceCatalogToSpreadsheetRows(resourceCatalog) {
  const rows = getResourceExportRows(resourceCatalog);
  return [
    RESOURCE_EXCEL_EXPORT_COLUMNS.map((column) => column.label),
    ...rows.map((row) =>
      RESOURCE_EXCEL_EXPORT_COLUMNS.map((column) => formatSpreadsheetCell(row[column.key]))
    ),
  ];
}

function resourceCatalogToCsv(resourceCatalog) {
  return resourceCatalogToSpreadsheetRows(resourceCatalog)
    .map((row) => formatCsvRow(row))
    .join("\n");
}

function uniqueSpreadsheetOptions(values) {
  const seen = new Set();
  const options = [];

  for (const value of values ?? []) {
    const text = formatSpreadsheetCell(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(text);
  }

  return options;
}

function buildOptionSheet(optionLists) {
  const options = optionLists
    .map((list) => ({
      key: list.key,
      label: list.label,
      values: uniqueSpreadsheetOptions(list.values),
    }))
    .filter((list) => list.values.length > 0);
  const refs = {};

  if (!options.length) {
    return { refs, sheet: null };
  }

  const maxRowCount = Math.max(...options.map((list) => list.values.length)) + 1;
  const rows = [];

  for (let rowIndex = 0; rowIndex < maxRowCount; rowIndex += 1) {
    rows.push(
      options.map((list) => (rowIndex === 0 ? list.label : list.values[rowIndex - 1] ?? ""))
    );
  }

  options.forEach((list, index) => {
    const column = columnName(index);
    refs[list.key] = `${WORKBOOK_OPTION_SHEET_NAME}!$${column}$2:$${column}$${
      list.values.length + 1
    }`;
  });

  return {
    refs,
    sheet: {
      name: WORKBOOK_OPTION_SHEET_NAME,
      hidden: true,
      columns: options.map((list) => ({
        key: list.key,
        label: list.label,
        width: Math.max(16, Math.min(40, list.label.length + 6)),
      })),
      rows,
      validations: [],
      count: 0,
    },
  };
}

function createListValidation(columns, key, formula, config = {}) {
  if (!formula) return null;
  const columnIndex = columns.findIndex((column) => column.key === key);
  if (columnIndex < 0) return null;

  const column = columnName(columnIndex);
  const firstRow = config.firstRow ?? 2;
  const lastRow = config.lastRow ?? WORKBOOK_VALIDATION_MAX_ROW;
  return {
    type: "list",
    allowBlank: config.allowBlank ?? true,
    showErrorMessage: config.showErrorMessage ?? true,
    sqref: `${column}${firstRow}:${column}${lastRow}`,
    formula1: formula,
  };
}

function createListValidations(columns, configs) {
  return configs
    .map((config) => createListValidation(columns, config.key, config.formula, config))
    .filter(Boolean);
}

function createInlineListFormula(values) {
  const options = uniqueSpreadsheetOptions(values).filter(
    (value) => value && !String(value).includes(",")
  );
  if (!options.length) return null;

  const formula = `"${options.join(",").replace(/"/g, '""')}"`;
  return formula.length <= 255 ? formula : null;
}

function dedupeOpportunities(opportunities) {
  const byId = new Map();
  for (const opportunity of opportunities ?? []) {
    const id = String(opportunity?.opportunityId ?? "").trim();
    if (!id) continue;
    byId.set(id, opportunity);
  }
  return Array.from(byId.values());
}

function parseOpportunityDueDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isRecurringExportOpportunity(opportunity) {
  return Boolean(
    opportunity?.recurrence?.isYearly || opportunity?.award?.renewable === true
  );
}

function isExpiredOneTimeOpportunity(opportunity, now = new Date()) {
  const dueDate = parseOpportunityDueDate(opportunity?.dueAt);
  if (!dueDate) return false;
  return dueDate.getTime() < now.getTime() && !isRecurringExportOpportunity(opportunity);
}

function getNextRecurringDeadlineDate(opportunity, now = new Date()) {
  if (!isRecurringExportOpportunity(opportunity)) return null;

  const dueDate = parseOpportunityDueDate(opportunity?.dueAt);
  const recurringMonth = Number(opportunity?.recurrence?.month);
  const recurringDay = Number(opportunity?.recurrence?.day);
  const hasRecurringMonth =
    Number.isFinite(recurringMonth) && recurringMonth >= 1 && recurringMonth <= 12;
  const hasRecurringDay =
    Number.isFinite(recurringDay) && recurringDay >= 1 && recurringDay <= 31;
  const month = hasRecurringMonth
    ? recurringMonth
    : (dueDate?.getMonth() ?? -1) + 1;
  const day = hasRecurringDay
    ? recurringDay
    : dueDate?.getDate();
  if (
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  let year = now.getFullYear();
  let candidate = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (candidate.getTime() < now.getTime()) {
    candidate = new Date(year + 1, month - 1, day, 23, 59, 59, 999);
  }

  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function getOpportunityExportSortDate(opportunity, now = new Date()) {
  if (opportunity?.deadline?.type === "rolling") return null;

  const dueDate = parseOpportunityDueDate(opportunity?.dueAt);
  if (!dueDate) return getNextRecurringDeadlineDate(opportunity, now);

  if (isRecurringExportOpportunity(opportunity) && dueDate.getTime() < now.getTime()) {
    return getNextRecurringDeadlineDate(opportunity, now) ?? dueDate;
  }

  return dueDate;
}

function sortOpportunitiesForExport(opportunities, now = new Date()) {
  return (opportunities ?? [])
    .map((opportunity, index) => ({
      opportunity,
      index,
      deadline: getOpportunityExportSortDate(opportunity, now),
    }))
    .sort((left, right) => {
      const leftTime = left.deadline?.getTime();
      const rightTime = right.deadline?.getTime();
      const leftHasDeadline = Number.isFinite(leftTime);
      const rightHasDeadline = Number.isFinite(rightTime);

      if (leftHasDeadline && rightHasDeadline && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      if (leftHasDeadline !== rightHasDeadline) {
        return leftHasDeadline ? -1 : 1;
      }

      const leftTitle = normalizeWhitespace(left.opportunity?.title).toLowerCase();
      const rightTitle = normalizeWhitespace(right.opportunity?.title).toLowerCase();
      if (leftTitle !== rightTitle) return leftTitle.localeCompare(rightTitle);

      return left.index - right.index;
    })
    .map((item) => item.opportunity);
}

function formatOpportunityExportDate(value) {
  const parsed = parseOpportunityDueDate(value);
  if (!parsed) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatOpportunityExportDeadline(opportunity) {
  if (opportunity?.deadline?.type === "rolling") return "Rolling";

  const dueAt = formatOpportunityExportDate(getOpportunityExportSortDate(opportunity));
  if (dueAt) return dueAt;

  return opportunity?.deadline?.label ?? "";
}

function formatOpportunityExportCurrency(value, currency) {
  if (currency === "USD") {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${currency}`;
}

function formatOpportunityExportAward(opportunity) {
  const award = opportunity?.award ?? {};
  if (award.amountText) return award.amountText;

  const currency = award.currency || "USD";
  const minimum = award.amountMin;
  const maximum = award.amountMax;
  if (minimum != null && maximum != null) {
    if (minimum === maximum) return formatOpportunityExportCurrency(minimum, currency);
    return `${formatOpportunityExportCurrency(minimum, currency)} - ${formatOpportunityExportCurrency(maximum, currency)}`;
  }
  if (maximum != null) return `Up to ${formatOpportunityExportCurrency(maximum, currency)}`;
  if (minimum != null) return `${formatOpportunityExportCurrency(minimum, currency)}+`;
  return "";
}

function formatOpportunityAwardCadence(opportunity) {
  const renewable = opportunity?.award?.renewable;
  if (renewable == null) return "";
  return renewable ? "continuous" : "one time";
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
}

function getOpportunityExportTags(opportunity) {
  return [
    ...asList(opportunity?.matching?.financialAidTags),
    ...asList(opportunity?.matching?.suggestedMajors),
    ...asList(opportunity?.eligibility?.residencyTypes),
  ].filter(Boolean);
}

function getOpportunityExportLink(opportunity) {
  return opportunity?.externalUrl || opportunity?.source?.sourceUrl || opportunity?.college?.website || "";
}

function formatScholarshipExportPrereq(opportunity) {
  const prereqs = [];
  if (opportunity?.eligibility?.transferOnly) prereqs.push("Transfer student");
  const residencyTypes = asList(opportunity?.eligibility?.residencyTypes);
  if (residencyTypes.length) {
    prereqs.push(`Residency: ${residencyTypes.join(", ")}`);
  }
  const suggestedMajors = asList(opportunity?.matching?.suggestedMajors);
  if (opportunity?.matching?.hasToBeMajor && suggestedMajors.length) {
    prereqs.push(`Major: ${suggestedMajors.join(", ")}`);
  }
  return prereqs.join("; ");
}

function formatScholarshipInstitutionSpecific(opportunity) {
  return opportunity?.college?.collegeName || "No";
}

function formatYesNo(value) {
  return value ? "Yes" : "No";
}

function formatScholarshipDisciplineSpecific(opportunity) {
  const suggestedMajors = asList(opportunity?.matching?.suggestedMajors);
  return formatYesNo(Boolean(opportunity?.matching?.hasToBeMajor || suggestedMajors.length));
}

function formatScholarshipMaterials(opportunity) {
  const materials = [];
  const essayCount = Number(opportunity?.requirements?.essayCount ?? 0);
  const recommendationCount = Number(opportunity?.requirements?.recommendationCountMin ?? 0);

  if (essayCount > 0) materials.push("Essay");
  if (recommendationCount > 0) {
    materials.push(
      recommendationCount === 1
        ? "Recommendation"
        : `${recommendationCount} recommendations`
    );
  }
  if (opportunity?.externalUrl) materials.push("Application");
  return materials.join(", ");
}

function formatPositiveCount(value) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? String(count) : "";
}

function getScholarshipLinkExportRows(opportunities, predicate) {
  return sortOpportunitiesForExport(
    dedupeOpportunities(opportunities).filter(
      (opportunity) => opportunity && predicate(opportunity)
    )
  )
    .map((opportunity) => ({
      link: getOpportunityExportLink(opportunity),
      name: opportunity.title,
      amount: formatOpportunityExportAward(opportunity),
      awardCadence: formatOpportunityAwardCadence(opportunity),
      description: opportunity.summary,
      deadline: formatOpportunityExportDeadline(opportunity),
      prereq: formatScholarshipExportPrereq(opportunity),
      institutionSpecific: formatScholarshipInstitutionSpecific(opportunity),
      disciplineSpecific: formatScholarshipDisciplineSpecific(opportunity),
      fullTimeRequired: "",
      gpaRequirement:
        opportunity.eligibility?.gpaMin == null ? "" : String(opportunity.eligibility.gpaMin),
      materialsRequired: formatScholarshipMaterials(opportunity),
      essayRequired: formatYesNo(Number(opportunity.requirements?.essayCount ?? 0) > 0),
      submissionForm: opportunity.externalUrl ? "Online" : "",
      essayCount: formatPositiveCount(opportunity.requirements?.essayCount),
      recommendationCount: formatPositiveCount(opportunity.requirements?.recommendationCountMin),
      sourceKind: opportunity.source?.kind ?? "",
      status: opportunity.status,
      opportunityId: opportunity.opportunityId,
    }));
}

function getOpportunityLinkExportRows(opportunities, predicate) {
  return sortOpportunitiesForExport(
    dedupeOpportunities(opportunities).filter(
      (opportunity) => opportunity && predicate(opportunity)
    )
  )
    .map((opportunity) => ({
      link: getOpportunityExportLink(opportunity),
      name: opportunity.title,
      type: OPPORTUNITY_TYPE_LABELS[opportunity.type] ?? opportunity.type,
      organization: opportunity.organizationName,
      description: opportunity.summary,
      deadline: formatOpportunityExportDeadline(opportunity),
      award: formatOpportunityExportAward(opportunity),
      sourceLabel: opportunity.source?.sourceLabel ?? "",
      sourceKind: opportunity.source?.kind ?? "",
      tags: getOpportunityExportTags(opportunity),
      status: opportunity.status,
      opportunityId: opportunity.opportunityId,
    }));
}

function buildLegacyOpportunityExportRow(opportunity) {
  const isScholarship = opportunity.type === "scholarship";
  return {
    link: getOpportunityExportLink(opportunity),
    name: opportunity.title,
    type: OPPORTUNITY_TYPE_LABELS[opportunity.type] ?? opportunity.type,
    organization: opportunity.organizationName,
    amount: formatOpportunityExportAward(opportunity),
    awardCadence: isScholarship ? formatOpportunityAwardCadence(opportunity) : "",
    description: opportunity.summary,
    deadline: formatOpportunityExportDeadline(opportunity),
    prereq: isScholarship ? formatScholarshipExportPrereq(opportunity) : "",
    institutionSpecific: isScholarship ? formatScholarshipInstitutionSpecific(opportunity) : "",
    disciplineSpecific: isScholarship ? formatScholarshipDisciplineSpecific(opportunity) : "",
    fullTimeRequired: "",
    gpaRequirement:
      isScholarship && opportunity.eligibility?.gpaMin != null
        ? String(opportunity.eligibility.gpaMin)
        : "",
    materialsRequired: isScholarship ? formatScholarshipMaterials(opportunity) : "",
    essayRequired: isScholarship
      ? formatYesNo(Number(opportunity.requirements?.essayCount ?? 0) > 0)
      : "",
    submissionForm: isScholarship && opportunity.externalUrl ? "Online" : "",
    essayCount: isScholarship ? formatPositiveCount(opportunity.requirements?.essayCount) : "",
    recommendationCount: isScholarship
      ? formatPositiveCount(opportunity.requirements?.recommendationCountMin)
      : "",
    sourceLabel: opportunity.source?.sourceLabel ?? "",
    tags: getOpportunityExportTags(opportunity),
    sourceKind: opportunity.source?.kind ?? "",
    status: opportunity.status,
    opportunityId: opportunity.opportunityId,
  };
}

function getLegacyOpportunityExportRows(opportunities, predicate) {
  return sortOpportunitiesForExport(
    dedupeOpportunities(opportunities).filter(
      (opportunity) => opportunity && predicate(opportunity)
    )
  )
    .map(buildLegacyOpportunityExportRow);
}

function scholarshipRowsToSpreadsheetRows(rows) {
  return [
    SCHOLARSHIP_EXCEL_EXPORT_COLUMNS.map((column) => column.label),
    ...rows.map((row) =>
      SCHOLARSHIP_EXCEL_EXPORT_COLUMNS.map((column) => formatSpreadsheetCell(row[column.key]))
    ),
  ];
}

function legacyRowsToSpreadsheetRows(rows) {
  return [
    LEGACY_EXCEL_EXPORT_COLUMNS.map((column) => column.label),
    ...rows.map((row) =>
      LEGACY_EXCEL_EXPORT_COLUMNS.map((column) => formatSpreadsheetCell(row[column.key]))
    ),
  ];
}

function opportunityRowsToSpreadsheetRows(rows) {
  return [
    OPPORTUNITY_EXCEL_EXPORT_COLUMNS.map((column) => column.label),
    ...rows.map((row) =>
      OPPORTUNITY_EXCEL_EXPORT_COLUMNS.map((column) => formatSpreadsheetCell(row[column.key]))
    ),
  ];
}

function buildScholarshipExportSheetFromRows(name, rows, validations = []) {
  return {
    name,
    columns: SCHOLARSHIP_EXCEL_EXPORT_COLUMNS,
    rows: scholarshipRowsToSpreadsheetRows(rows),
    validations,
    count: rows.length,
  };
}

function buildLegacyExportSheetFromRows(name, rows, validations = []) {
  return {
    name,
    columns: LEGACY_EXCEL_EXPORT_COLUMNS,
    rows: legacyRowsToSpreadsheetRows(rows),
    validations,
    count: rows.length,
  };
}

function buildOpportunityExportSheetFromRows(name, rows, validations = []) {
  return {
    name,
    columns: OPPORTUNITY_EXCEL_EXPORT_COLUMNS,
    rows: opportunityRowsToSpreadsheetRows(rows),
    validations,
    count: rows.length,
  };
}

function buildOpportunityExportSheet(name, opportunities, predicate) {
  const rows = getOpportunityLinkExportRows(opportunities, predicate);
  return buildOpportunityExportSheetFromRows(name, rows);
}

function buildResourceExportWorkbookSheets(resourceCatalog, opportunities) {
  const resourceRows = getResourceExportRows(resourceCatalog);
  const allOpportunities = dedupeOpportunities(opportunities);
  const isDeadlineOpportunity = (opportunity) =>
    opportunity.type === "general_deadline" ||
    opportunity.type === "college_deadline" ||
    opportunity.type === "quarter-start" ||
    opportunity.type === "quarter-end";
  const belongsInLegacy = (opportunity) => isExpiredOneTimeOpportunity(opportunity);
  const scholarshipRows = getScholarshipLinkExportRows(
    allOpportunities,
    (opportunity) => opportunity.type === "scholarship" && !belongsInLegacy(opportunity)
  );
  const internshipRows = getOpportunityLinkExportRows(
    allOpportunities,
    (opportunity) => opportunity.type === "internship" && !belongsInLegacy(opportunity)
  );
  const deadlineRows = getOpportunityLinkExportRows(
    allOpportunities,
    (opportunity) => isDeadlineOpportunity(opportunity) && !belongsInLegacy(opportunity)
  );
  const legacyRows = getLegacyOpportunityExportRows(allOpportunities, belongsInLegacy);
  const allScholarshipRows = [
    ...scholarshipRows,
    ...getScholarshipLinkExportRows(
      allOpportunities,
      (opportunity) => opportunity.type === "scholarship" && belongsInLegacy(opportunity)
    ),
  ];
  const optionSourceKinds = uniqueSpreadsheetOptions([
    "manual",
    "seed",
    "ai_college_deadline",
    "legacy",
    ...allOpportunities.map((opportunity) => opportunity.source?.kind),
  ]);
  const optionStatuses = uniqueSpreadsheetOptions([
    "active",
    "draft",
    "archived",
    ...allOpportunities.map((opportunity) => opportunity.status),
  ]);
  const { refs: optionRefs, sheet: optionSheet } = buildOptionSheet([
    {
      key: "resourceSectionTitles",
      label: "Resource sections",
      values: resourceCatalog.map(
        (section) => resolveCatalogExportText(section, "title") || safeDisplayLabel(section)
      ),
    },
    {
      key: "resourceSubsectionTitles",
      label: "Resource subsections",
      values: resourceCatalog.flatMap((section) =>
        (section.subsections ?? []).map(
          (subsection) =>
            resolveCatalogExportText(subsection, "title") || safeSubsectionLabel(subsection)
        )
      ),
    },
    {
      key: "resourceSectionIds",
      label: "Resource section ids",
      values: resourceCatalog.map((section) => section.id),
    },
    {
      key: "resourceSubsectionIds",
      label: "Resource subsection ids",
      values: resourceCatalog.flatMap((section) =>
        (section.subsections ?? []).map((subsection) => subsection.id)
      ),
    },
    {
      key: "resourceIcons",
      label: "Resource icons",
      values: resourceCatalog.map((section) => section.icon),
    },
    {
      key: "opportunityTypes",
      label: "Opportunity types",
      values: Object.values(OPPORTUNITY_TYPE_LABELS),
    },
    {
      key: "sourceKinds",
      label: "Source kinds",
      values: optionSourceKinds,
    },
    {
      key: "statuses",
      label: "Statuses",
      values: optionStatuses,
    },
    {
      key: "awardCadences",
      label: "Award cadences",
      values: ["one time", "continuous", ...allScholarshipRows.map((row) => row.awardCadence)],
    },
    {
      key: "scholarshipPrereqs",
      label: "Scholarship prereqs",
      values: [
        ...DEFAULT_SCHOLARSHIP_PREREQ_OPTIONS,
        ...allScholarshipRows.map((row) => row.prereq),
      ],
    },
    {
      key: "institutions",
      label: "Institutions",
      values: [
        ...DEFAULT_INSTITUTION_OPTIONS,
        ...allScholarshipRows.map((row) => row.institutionSpecific),
      ],
    },
    {
      key: "yesNo",
      label: "Yes/No",
      values: ["No", "Yes"],
    },
    {
      key: "submissionForms",
      label: "Submission forms",
      values: [
        "Online",
        "Email",
        "Mail",
        "In Person",
        ...allScholarshipRows.flatMap((row) =>
          String(row.submissionForm ?? "")
            .split(",")
            .map((item) => item.trim())
        ),
      ],
    },
  ]);
  const inlineFormulas = {
    awardCadences: createInlineListFormula(DEFAULT_AWARD_CADENCE_OPTIONS),
    opportunityTypes: createInlineListFormula(Object.values(OPPORTUNITY_TYPE_LABELS)),
    sourceKinds: createInlineListFormula(optionSourceKinds),
    statuses: createInlineListFormula(optionStatuses),
    scholarshipPrereqs: createInlineListFormula(DEFAULT_SCHOLARSHIP_PREREQ_OPTIONS),
    institutions: createInlineListFormula([
      ...DEFAULT_INSTITUTION_OPTIONS,
      ...allScholarshipRows.map((row) => row.institutionSpecific),
    ]),
    yesNo: createInlineListFormula(DEFAULT_YES_NO_OPTIONS),
    submissionForms: createInlineListFormula(DEFAULT_SUBMISSION_FORM_OPTIONS),
  };
  const resourceValidations = createListValidations(RESOURCE_EXCEL_EXPORT_COLUMNS, [
    { key: "sectionTitle", formula: optionRefs.resourceSectionTitles },
    { key: "subsectionTitle", formula: optionRefs.resourceSubsectionTitles },
    { key: "sectionId", formula: optionRefs.resourceSectionIds },
    { key: "subsectionId", formula: optionRefs.resourceSubsectionIds },
    { key: "sectionIcon", formula: optionRefs.resourceIcons },
  ]);
  const scholarshipValidations = createListValidations(SCHOLARSHIP_EXCEL_EXPORT_COLUMNS, [
    { key: "awardCadence", formula: inlineFormulas.awardCadences ?? optionRefs.awardCadences },
    { key: "prereq", formula: inlineFormulas.scholarshipPrereqs ?? optionRefs.scholarshipPrereqs },
    { key: "institutionSpecific", formula: inlineFormulas.institutions ?? optionRefs.institutions },
    { key: "disciplineSpecific", formula: inlineFormulas.yesNo ?? optionRefs.yesNo },
    { key: "fullTimeRequired", formula: inlineFormulas.yesNo ?? optionRefs.yesNo },
    { key: "essayRequired", formula: inlineFormulas.yesNo ?? optionRefs.yesNo },
    { key: "submissionForm", formula: inlineFormulas.submissionForms ?? optionRefs.submissionForms },
    { key: "sourceKind", formula: inlineFormulas.sourceKinds ?? optionRefs.sourceKinds },
    { key: "status", formula: inlineFormulas.statuses ?? optionRefs.statuses },
  ]);
  const opportunityValidations = createListValidations(OPPORTUNITY_EXCEL_EXPORT_COLUMNS, [
    { key: "type", formula: inlineFormulas.opportunityTypes ?? optionRefs.opportunityTypes },
    { key: "sourceKind", formula: inlineFormulas.sourceKinds ?? optionRefs.sourceKinds },
    { key: "status", formula: inlineFormulas.statuses ?? optionRefs.statuses },
  ]);
  const legacyValidations = createListValidations(LEGACY_EXCEL_EXPORT_COLUMNS, [
    { key: "type", formula: inlineFormulas.opportunityTypes ?? optionRefs.opportunityTypes },
    { key: "awardCadence", formula: inlineFormulas.awardCadences ?? optionRefs.awardCadences },
    { key: "prereq", formula: inlineFormulas.scholarshipPrereqs ?? optionRefs.scholarshipPrereqs },
    { key: "institutionSpecific", formula: inlineFormulas.institutions ?? optionRefs.institutions },
    { key: "disciplineSpecific", formula: inlineFormulas.yesNo ?? optionRefs.yesNo },
    { key: "fullTimeRequired", formula: inlineFormulas.yesNo ?? optionRefs.yesNo },
    { key: "essayRequired", formula: inlineFormulas.yesNo ?? optionRefs.yesNo },
    { key: "submissionForm", formula: inlineFormulas.submissionForms ?? optionRefs.submissionForms },
    { key: "sourceKind", formula: inlineFormulas.sourceKinds ?? optionRefs.sourceKinds },
    { key: "status", formula: inlineFormulas.statuses ?? optionRefs.statuses },
  ]);

  const sheets = [
    buildScholarshipExportSheetFromRows("Scholarships", scholarshipRows, scholarshipValidations),
    buildOpportunityExportSheetFromRows("Internships", internshipRows, opportunityValidations),
    buildOpportunityExportSheetFromRows("Deadlines", deadlineRows, opportunityValidations),
    {
      name: "Resources",
      columns: RESOURCE_EXCEL_EXPORT_COLUMNS,
      rows: resourceCatalogToSpreadsheetRows(resourceCatalog),
      validations: resourceValidations,
      count: resourceRows.length,
    },
    buildLegacyExportSheetFromRows("Legacy", legacyRows, legacyValidations),
  ];

  if (optionSheet) sheets.push(optionSheet);

  return sheets;
}

function parseResourceCatalogRows(rows) {
  const [headerRow, ...dataRows] = rows;
  if (!headerRow?.length) {
    fail("The import file is empty.");
  }

  const headers = headerRow.map((header) => String(header ?? "").trim());
  const headerIndexes = buildResourceHeaderIndexes(headers);
  const missingRequiredHeaders = [];

  if (!headerIndexes.has("url")) missingRequiredHeaders.push("LINK");
  if (!headerIndexes.has("itemTitle") && !headerIndexes.has("itemTitleKey")) {
    missingRequiredHeaders.push("NAME");
  }
  if (!headerIndexes.has("sectionTitle") && !headerIndexes.has("sectionTitleKey")) {
    missingRequiredHeaders.push("SECTION");
  }

  if (missingRequiredHeaders.length) {
    fail(`The import file is missing columns: ${missingRequiredHeaders.join(", ")}`);
  }

  const sections = [];
  const sectionById = new Map();

  const getCell = (row, name) => {
    const index = headerIndexes.get(name);
    if (index == null) return "";
    return String(row[index] ?? "").trim();
  };
  const getSection = (row, rowNumber) => {
    const sectionId =
      getCell(row, "sectionId") ||
      slugify(
        getCell(row, "sectionTitle") ||
          translateResourceKey(getCell(row, "sectionTitleKey")) ||
          getCell(row, "sectionTitleKey")
      ) ||
      `section-${rowNumber}`;

    if (sectionById.has(sectionId)) return sectionById.get(sectionId);

    const section = {
      id: sectionId,
      icon: getCell(row, "sectionIcon") || "link",
      items: [],
    };
    const sectionTitle = getCell(row, "sectionTitle");
    const sectionTitleKey = getCell(row, "sectionTitleKey");
    assignCatalogText(section, "title", sectionTitle, sectionTitleKey);

    sections.push(section);
    sectionById.set(sectionId, section);
    return section;
  };

  const getSubsection = (section, row, rowNumber) => {
    const subsectionId =
      getCell(row, "subsectionId") ||
      slugify(
        getCell(row, "subsectionTitle") ||
          translateResourceKey(getCell(row, "subsectionTitleKey")) ||
          getCell(row, "subsectionTitleKey")
      );
    if (!subsectionId) return null;

    if (!Array.isArray(section.subsections)) {
      section.subsections = [];
    }

    let subsection = section.subsections.find((item) => String(item.id) === subsectionId);
    if (subsection) return subsection;

    subsection = {
      id: subsectionId || `subsection-${rowNumber}`,
      items: [],
    };
    const subsectionTitle = getCell(row, "subsectionTitle");
    const subsectionTitleKey = getCell(row, "subsectionTitleKey");
    assignCatalogText(subsection, "title", subsectionTitle, subsectionTitleKey);

    section.subsections.push(subsection);
    return subsection;
  };

  for (const [index, row] of dataRows.entries()) {
    const rowNumber = index + 2;
    const rowType = getCell(row, "rowType").toLowerCase() || "item";
    const section = getSection(row, rowNumber);
    const subsection = getSubsection(section, row, rowNumber);

    const hasItemData = [
      "itemTitle",
      "itemTitleKey",
      "itemDescription",
      "itemDescriptionKey",
      "url",
      "tags",
    ].some((header) => getCell(row, header));

    if (rowType === "section" || rowType === "subsection") {
      if (!hasItemData) continue;
    }

    const itemTitle = getCell(row, "itemTitle");
    const itemTitleKey = getCell(row, "itemTitleKey");
    const url = getCell(row, "url");

    if (!itemTitle && !itemTitleKey) {
      fail(`Row ${rowNumber} needs an itemTitle or itemTitleKey.`);
    }
    if (!url) {
      fail(`Row ${rowNumber} needs a url.`);
    }

    const item = { url };
    const itemDescription = getCell(row, "itemDescription");
    const itemDescriptionKey = getCell(row, "itemDescriptionKey");
    const expiresAt = getCell(row, "expiresAt");
    const tags = normalizeTags(getCell(row, "tags"));

    assignCatalogText(item, "title", itemTitle, itemTitleKey);
    assignCatalogText(item, "description", itemDescription, itemDescriptionKey);
    if (expiresAt) item.expiresAt = expiresAt;
    if (tags.length) item.tags = tags;

    const itemList = subsection ? subsection.items : section.items;
    itemList.push(item);
  }

  return sections;
}

function parseResourceCatalogCsv(text) {
  return parseResourceCatalogRows(parseCsv(text));
}

function createSharedStringXml(value) {
  const preserveSpace = /^\s|\s$/.test(value) ? ' xml:space="preserve"' : "";
  return `<si><t${preserveSpace}>${escapeXml(value)}</t></si>`;
}

function isSpreadsheetHyperlink(value) {
  return /^[a-z][a-z0-9+.-]*:/i.test(String(value ?? "").trim());
}

function getWorksheetHyperlinks(rows) {
  return rows
    .slice(1)
    .map((row, index) => ({
      id: `rId${index + 1}`,
      ref: `A${index + 2}`,
      target: formatSpreadsheetCell(row[0]).trim(),
    }))
    .filter((link) => isSpreadsheetHyperlink(link.target));
}

function createWorksheetRelationshipsXml(hyperlinks) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${hyperlinks
    .map(
      (link) =>
        `<Relationship Id="${link.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(link.target)}" TargetMode="External"/>`
    )
    .join("")}
</Relationships>`;
}

function createWorkbookStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="10"/><color rgb="FF000000"/><name val="Arial"/><family val="2"/></font>
    <font><b/><sz val="10"/><color rgb="FF000000"/><name val="Arial"/><family val="2"/></font>
    <font><u/><sz val="10"/><color rgb="FF0000FF"/><name val="Arial"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF9FC5E8"/><bgColor rgb="FF9FC5E8"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border/>
    <border>
      <left style="thin"><color rgb="FFD9E2F3"/></left>
      <right style="thin"><color rgb="FFD9E2F3"/></right>
      <top style="thin"><color rgb="FFD9E2F3"/></top>
      <bottom style="thin"><color rgb="FFD9E2F3"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;
}

function createWorksheetXml(
  rows,
  stringIndexes,
  columns = RESOURCE_EXCEL_EXPORT_COLUMNS,
  hyperlinks = [],
  validations = []
) {
  const lastColumn = columnName(Math.max(0, (rows[0]?.length ?? columns.length) - 1));
  const rowCount = Math.max(1, rows.length);
  const cols = columns.map((column, index) => {
    const width = column.width ?? Math.max(12, Math.min(44, String(column.label).length + 6));
    const hidden = column.hidden ? ' hidden="1"' : "";
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"${hidden}/>`;
  }).join("");
  const hyperlinkIdByRef = new Map(hyperlinks.map((link) => [link.ref, link.id]));

  const sheetRows = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const isHeader = rowIndex === 0;
      const cells = row
        .map((cellValue, columnIndex) => {
          const text = formatSpreadsheetCell(cellValue);
          const cellRef = `${columnName(columnIndex)}${rowNumber}`;
          const styleIndex = isHeader ? 1 : hyperlinkIdByRef.has(cellRef) ? 2 : 3;
          if (!text) return `<c r="${cellRef}" s="${styleIndex}"/>`;
          return `<c r="${cellRef}" s="${styleIndex}" t="s"><v>${stringIndexes.get(text)}</v></c>`;
        })
        .join("");
      const rowHeight = isHeader ? ' ht="18.75" customHeight="1"' : "";
      return `<row r="${rowNumber}"${rowHeight}>${cells}</row>`;
    })
    .join("");
  const hyperlinksXml = hyperlinks.length
    ? `<hyperlinks>${hyperlinks
        .map((link) => `<hyperlink ref="${link.ref}" r:id="${link.id}"/>`)
        .join("")}</hyperlinks>`
    : "";
  const validationsXml = validations.length
    ? `<dataValidations count="${validations.length}">${validations
        .map((validation) => {
          const allowBlank = validation.allowBlank ? ' allowBlank="1"' : "";
          const showErrorMessage = validation.showErrorMessage ? ' showErrorMessage="1"' : "";
          return `<dataValidation type="${validation.type}"${allowBlank}${showErrorMessage} sqref="${escapeXml(validation.sqref)}"><formula1>${escapeXml(validation.formula1)}</formula1></dataValidation>`;
        })
        .join("")}</dataValidations>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${lastColumn}${rowCount}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${cols}</cols>
  <sheetData>${sheetRows}</sheetData>
  <autoFilter ref="A1:${lastColumn}${rowCount}"/>
  ${validationsXml}
  ${hyperlinksXml}
</worksheet>`;
}

function sanitizeWorksheetName(value, index, usedNames) {
  const fallback = `Sheet ${index + 1}`;
  const base =
    String(value ?? fallback)
      .replace(/[:\\/?*\[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31) || fallback;
  let name = base;
  let suffix = 2;

  while (usedNames.has(name.toLowerCase())) {
    const suffixText = ` ${suffix}`;
    name = `${base.slice(0, 31 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  usedNames.add(name.toLowerCase());
  return name;
}

function normalizeWorkbookSheets(rowsOrSheets) {
  if (
    Array.isArray(rowsOrSheets) &&
    rowsOrSheets.length > 0 &&
    !Array.isArray(rowsOrSheets[0]) &&
    Array.isArray(rowsOrSheets[0]?.rows)
  ) {
    return rowsOrSheets;
  }

  return [
    {
      name: "Resources",
      rows: rowsOrSheets,
      columns: RESOURCE_EXCEL_EXPORT_COLUMNS,
    },
  ];
}

function createXlsxBuffer(rowsOrSheets) {
  const usedSheetNames = new Set();
  const sheets = normalizeWorkbookSheets(rowsOrSheets).map((sheet, index) => ({
    name: sanitizeWorksheetName(sheet.name, index, usedSheetNames),
    rows: Array.isArray(sheet.rows) && sheet.rows.length ? sheet.rows : [[]],
    columns: sheet.columns ?? RESOURCE_EXCEL_EXPORT_COLUMNS,
    hidden: Boolean(sheet.hidden),
    validations: Array.isArray(sheet.validations) ? sheet.validations : [],
  }));
  const sharedStrings = [];
  const stringIndexes = new Map();
  let sharedStringCount = 0;

  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      for (const value of row) {
        const text = formatSpreadsheetCell(value);
        if (!text) continue;
        sharedStringCount += 1;
        if (!stringIndexes.has(text)) {
          stringIndexes.set(text, sharedStrings.length);
          sharedStrings.push(text);
        }
      }
    }
  }

  const worksheetEntries = sheets.map((sheet, index) => {
    const hyperlinks = getWorksheetHyperlinks(sheet.rows);
    return {
      sheet,
      index,
      hyperlinks,
      worksheetXml: createWorksheetXml(
        sheet.rows,
        stringIndexes,
        sheet.columns,
        hyperlinks,
        sheet.validations
      ),
    };
  });

  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStringCount}" uniqueCount="${sharedStrings.length}">
  ${sharedStrings.map(createSharedStringXml).join("")}
</sst>`;

  const sharedStringsRelationshipId = `rId${sheets.length + 1}`;
  const stylesRelationshipId = `rId${sheets.length + 2}`;
  const entries = [
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${worksheetEntries
    .map(
      ({ index }) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("\n  ")}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${worksheetEntries
      .map(
        ({ sheet, index }) => {
          const state = sheet.hidden ? ' state="hidden"' : "";
          return `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}"${state} r:id="rId${index + 1}"/>`;
        }
      )
      .join("\n    ")}
  </sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${worksheetEntries
    .map(
      ({ index }) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("\n  ")}
  <Relationship Id="${sharedStringsRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="${stylesRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    ...worksheetEntries.map(({ index, worksheetXml }) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: worksheetXml,
    })),
    {
      name: "xl/styles.xml",
      data: createWorkbookStylesXml(),
    },
    {
      name: "xl/sharedStrings.xml",
      data: sharedStringsXml,
    },
  ];

  for (const { index, hyperlinks } of worksheetEntries) {
    if (!hyperlinks.length) continue;
    entries.push({
      name: `xl/worksheets/_rels/sheet${index + 1}.xml.rels`,
      data: createWorksheetRelationshipsXml(hyperlinks),
    });
  }

  return createZipBuffer(entries);
}

function createCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC32_TABLE = createCrc32Table();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const dosTime = 0;
  const dosDate = 0x21;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const dataBuffer = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(entry.data, "utf8");
    const checksum = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(centralDirectoryOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

function readZipEntries(zipBuffer) {
  let endRecordOffset = -1;
  const minOffset = Math.max(0, zipBuffer.length - 65557);

  for (let offset = zipBuffer.length - 22; offset >= minOffset; offset -= 1) {
    if (zipBuffer.readUInt32LE(offset) === 0x06054b50) {
      endRecordOffset = offset;
      break;
    }
  }

  if (endRecordOffset < 0) {
    fail("The XLSX file is missing a ZIP end record.");
  }

  const entryCount = zipBuffer.readUInt16LE(endRecordOffset + 10);
  const centralDirectoryOffset = zipBuffer.readUInt32LE(endRecordOffset + 16);
  const entries = new Map();
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (zipBuffer.readUInt32LE(cursor) !== 0x02014b50) {
      fail("The XLSX file has an invalid ZIP central directory.");
    }

    const compressionMethod = zipBuffer.readUInt16LE(cursor + 10);
    const compressedSize = zipBuffer.readUInt32LE(cursor + 20);
    const fileNameLength = zipBuffer.readUInt16LE(cursor + 28);
    const extraLength = zipBuffer.readUInt16LE(cursor + 30);
    const commentLength = zipBuffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(cursor + 42);
    const name = zipBuffer
      .subarray(cursor + 46, cursor + 46 + fileNameLength)
      .toString("utf8");

    if (zipBuffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      fail(`The XLSX entry "${name}" has an invalid local header.`);
    }

    const localNameLength = zipBuffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = zipBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = zipBuffer.subarray(dataOffset, dataOffset + compressedSize);
    let data;

    if (compressionMethod === 0) {
      data = compressedData;
    } else if (compressionMethod === 8) {
      data = zlib.inflateRawSync(compressedData);
    } else {
      fail(`The XLSX entry "${name}" uses unsupported ZIP compression method ${compressionMethod}.`);
    }

    entries.set(name, data);
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function parseSharedStringsXml(xml) {
  const sharedStrings = [];
  const itemRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    sharedStrings.push(extractTextRuns(match[1]));
  }

  return sharedStrings;
}

function parseWorksheetRows(xml, sharedStrings) {
  const rows = [];
  const rowRegex = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const row = [];
    const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch;
    let nextColumnIndex = 0;

    while ((cellMatch = cellRegex.exec(rowMatch[2])) !== null) {
      const attributes = cellMatch[1];
      const cellXml = cellMatch[2] ?? "";
      const cellRef = getXmlAttribute(attributes, "r");
      const type = getXmlAttribute(attributes, "t");
      const columnMatch = cellRef ? cellRef.match(/[A-Z]+/i) : null;
      const columnIndex = columnMatch
        ? columnNameToIndex(columnMatch[0])
        : nextColumnIndex;
      nextColumnIndex = columnIndex + 1;

      let value = "";
      if (type === "s") {
        const sharedIndex = Number.parseInt(extractTagText(cellXml, "v"), 10);
        value = sharedStrings[sharedIndex] ?? "";
      } else if (type === "inlineStr") {
        value = extractTextRuns(cellXml);
      } else {
        value = extractTagText(cellXml, "v");
      }

      row[columnIndex] = value;
    }

    while (row.length && row[row.length - 1] == null) {
      row.pop();
    }

    rows.push(row.map((value) => value ?? ""));
  }

  return rows.filter((row) => row.some((item) => String(item ?? "").trim()));
}

function getWorkbookWorksheetEntry(entries, requestedSheetName) {
  const workbookEntry = entries.get("xl/workbook.xml");
  const relationshipEntry = entries.get("xl/_rels/workbook.xml.rels");
  if (!workbookEntry || !relationshipEntry) return null;

  const relationships = new Map();
  const relationshipRegex = /<Relationship\b([^>]*?)\/>/g;
  let relationshipMatch;
  while ((relationshipMatch = relationshipRegex.exec(relationshipEntry.toString("utf8"))) !== null) {
    const attributes = relationshipMatch[1];
    const id = getXmlAttribute(attributes, "Id");
    const target = getXmlAttribute(attributes, "Target");
    if (!id || !target) continue;

    const normalizedTarget = target.startsWith("/")
      ? target.replace(/^\/+/, "")
      : target.startsWith("xl/")
        ? target
        : `xl/${target}`;
    relationships.set(id, normalizedTarget);
  }

  const requested = String(requestedSheetName ?? "").trim().toLowerCase();
  const sheetRegex = /<sheet\b([^>]*?)\/>/g;
  let sheetMatch;
  while ((sheetMatch = sheetRegex.exec(workbookEntry.toString("utf8"))) !== null) {
    const attributes = sheetMatch[1];
    const name = getXmlAttribute(attributes, "name");
    if (String(name ?? "").trim().toLowerCase() !== requested) continue;

    const relationshipId = getXmlAttribute(attributes, "r:id");
    const target = relationships.get(relationshipId);
    if (target && entries.has(target)) return entries.get(target);
  }

  return null;
}

function parseResourceCatalogXlsx(filePath) {
  const entries = readZipEntries(fs.readFileSync(filePath));
  const sharedStringsEntry = entries.get("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsEntry
    ? parseSharedStringsXml(sharedStringsEntry.toString("utf8"))
    : [];
  const worksheetEntry =
    getWorkbookWorksheetEntry(entries, "Resources") ??
    entries.get("xl/worksheets/sheet1.xml") ??
    Array.from(entries.entries()).find(([name]) =>
      /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)
    )?.[1];

  if (!worksheetEntry) {
    fail("The XLSX file does not contain a worksheet.");
  }

  return parseResourceCatalogRows(
    parseWorksheetRows(worksheetEntry.toString("utf8"), sharedStrings)
  );
}

function parseResourceCatalogSpreadsheet(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const firstBytes = fs.readFileSync(filePath).subarray(0, 4).toString("binary");

  if (extension === ".xlsx" || firstBytes === "PK\u0003\u0004") {
    return parseResourceCatalogXlsx(filePath);
  }

  return parseResourceCatalogCsv(fs.readFileSync(filePath, "utf8"));
}

function ensureXlsxFilePath(filePath) {
  const extension = path.extname(filePath);
  if (extension.toLowerCase() === ".xlsx") return filePath;
  if (!extension) return `${filePath}.xlsx`;
  return `${filePath.slice(0, -extension.length)}.xlsx`;
}

function toGitPath(filePath) {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join("/");
}

function openUrlInDefaultBrowser(url) {
  if (process.platform === "win32") {
    execFileSync("cmd", ["/c", "start", "", url], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  if (process.platform === "darwin") {
    execFileSync("open", [url], { stdio: "ignore" });
    return;
  }

  execFileSync("xdg-open", [url], { stdio: "ignore" });
}

function openGoogleSheetsAfterExport() {
  if (process.env.GATORGUIDE_OPEN_GOOGLE_SHEETS_AFTER_EXPORT === "0") {
    return;
  }

  try {
    log(`Opening Google Sheets in your default browser: ${GOOGLE_SHEETS_EXPORT_URL}`);
    openUrlInDefaultBrowser(GOOGLE_SHEETS_EXPORT_URL);
  } catch (error) {
    log(
      `Could not open Google Sheets automatically. Open ${GOOGLE_SHEETS_EXPORT_URL} manually.`
    );
  }
}

function runGitCapture(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

function runGitDisplay(args) {
  execFileSync("git", args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
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

async function runWizard(rl, steps, initialState = {}, startIndex = 0) {
  const state = initialState;
  let index = Math.max(0, Number.isFinite(startIndex) ? startIndex : 0);

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

  const opportunitySteps = [
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
  ];

  answers = await runWizard(rl, opportunitySteps, answers);

  while (true) {
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
    const tiedToCollege = answers.tiedToCollege ?? (type === "college_deadline");
    const collegeName = tiedToCollege ? smartTitleCase(answers.collegeName ?? null) : null;
    const collegeCity = tiedToCollege ? smartTitleCase(answers.collegeCity ?? null) : null;
    const collegeState = tiedToCollege ? normalizeRegionText(answers.collegeState ?? null) : null;
    const collegeWebsite = tiedToCollege ? answers.collegeWebsite ?? null : null;
    const sourceUrl = answers.sourceUrl ?? externalUrl;
    const sourceLabel = smartTitleCase(
      answers.sourceLabel ?? "Added with batch catalog tool"
    );
    const showImmediately = answers.showImmediately ?? true;

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
      tiedToCollege,
      collegeName,
      collegeCity,
      collegeState,
      collegeWebsite,
      sourceUrl,
      sourceLabel,
      showImmediately,
    };

    const reviewRows = [
      {
        label: "Type",
        value: type,
        editStepIndex: null,
      },
      {
        label: "Title",
        value: title,
        editStepIndex: 0,
      },
      {
        label: "Organization",
        value: organizationName,
        editStepIndex: 1,
      },
      {
        label: "Summary",
        value: summary,
        editStepIndex: 2,
      },
      {
        label: "Official link",
        value: externalUrl,
        editStepIndex: 3,
      },
      {
        label: "Deadline tracking",
        value: deadlineMode,
        editStepIndex: 4,
      },
      {
        label: "Deadline kind",
        value: deadlineType,
        editStepIndex: deadlineMode === "rolling" ? 4 : 5,
      },
      {
        label: "Deadline date",
        value: dueDate,
        editStepIndex: deadlineMode === "rolling" ? 4 : 6,
      },
      {
        label: "Deadline label",
        value: deadlineLabel,
        editStepIndex: 7,
      },
      {
        label: "Financial-aid tags",
        value: formatListSummary(financialAidTags),
        editStepIndex: 8,
      },
      {
        label: "Relevant majors",
        value: formatListSummary(suggestedMajors),
        editStepIndex: 9,
      },
      {
        label: "Must match major",
        value: formatBooleanSummary(hasToBeMajor),
        editStepIndex: 10,
      },
      {
        label: "Minimum GPA",
        value: formatNumberSummary(gpaMin),
        editStepIndex: 11,
      },
      {
        label: "Residency restrictions",
        value: formatListSummary(residencySelection),
        editStepIndex: 12,
      },
      {
        label: "Transfer only",
        value: formatBooleanSummary(transferOnly),
        editStepIndex: 13,
      },
      {
        label: "Needs recommendations",
        value: formatBooleanSummary(needsRecommendations),
        editStepIndex: 14,
      },
      {
        label: "Recommendation minimum",
        value: formatNumberSummary(recommendationCountMin),
        editStepIndex: needsRecommendations ? 15 : 14,
      },
      {
        label: "Essay count",
        value: formatNumberSummary(essayCount),
        editStepIndex: 16,
      },
      {
        label: "Award amount",
        value: formatMoneySummary(amountMin, amountMax, awardCurrency),
        editStepIndex: 17,
      },
      {
        label: "Award text",
        value: amountText,
        editStepIndex: 20,
      },
      {
        label: "Renewable",
        value: formatBooleanSummary(renewable),
        editStepIndex: 21,
      },
      {
        label: "College name",
        value: collegeName,
        editStepIndex: tiedToCollege ? 23 : 22,
      },
      {
        label: "College city",
        value: collegeCity,
        editStepIndex: tiedToCollege ? 24 : 22,
      },
      {
        label: "College state",
        value: collegeState,
        editStepIndex: tiedToCollege ? 25 : 22,
      },
      {
        label: "College website",
        value: collegeWebsite,
        editStepIndex: tiedToCollege ? 26 : 22,
      },
      {
        label: "Source URL",
        value: sourceUrl,
        editStepIndex: 27,
      },
      {
        label: "Source label",
        value: sourceLabel,
        editStepIndex: 28,
      },
      {
        label: "Show right away",
        value: formatBooleanSummary(showImmediately),
        editStepIndex: 29,
      },
    ];

    printSummary("Review this new opportunity before saving.", reviewRows, {
      numbered: true,
    });

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
      const selectedReviewRowIndex = await askSummaryRowNumber(
        rl,
        'Enter the number of the item you want to change, or type "back" to return:',
        reviewRows
      );

      if (isBackSignal(selectedReviewRowIndex)) {
        continue;
      }

      const selectedReviewRow = reviewRows[selectedReviewRowIndex];
      if (selectedReviewRow.editStepIndex == null) {
        log("Type cannot be changed from this review screen. Choose Discard and start over to change it.");
        continue;
      }

      answers = await runWizard(
        rl,
        opportunitySteps,
        answers,
        selectedReviewRow.editStepIndex
      );
      continue;
    }

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
            { value: "quarter-start", label: "Quarter start" },
            { value: "quarter-end", label: "Quarter end" },
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

async function publishUpdatedResources(rl) {
  const resourceGitPath = toGitPath(RESOURCES_PATH);
  let statusOutput = "";

  try {
    statusOutput = runGitCapture(["status", "--porcelain", "--", resourceGitPath]);
  } catch (error) {
    fail(`Could not inspect the repo status. ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!statusOutput.trim()) {
    log("");
    log("There are no updated resources to publish right now.");
    return;
  }

  const confirmed = await confirmAction(
    rl,
    `Publish updated resources to repo with commit message "${RESOURCE_COMMIT_MESSAGE}"?`,
    true
  );

  if (isBackSignal(confirmed) || !confirmed) {
    log("Cancelled. No files were changed.");
    return;
  }

  try {
    log("");
    log("Creating the resources commit...");
    runGitDisplay([
      "commit",
      "--only",
      "-m",
      RESOURCE_COMMIT_MESSAGE,
      "--",
      resourceGitPath,
    ]);
    log("");
    log("Pushing the new commit...");
    runGitDisplay(["push"]);
  } catch (error) {
    fail(`Could not publish updated resources. ${error instanceof Error ? error.message : String(error)}`);
  }

  log("");
  log(`Published updated resources with commit message "${RESOURCE_COMMIT_MESSAGE}".`);
}

async function exportResourcesAsExcelFile() {
  const requestedOutputPath = RESOURCE_EXCEL_EXPORT_PATH;
  const outputPath =
    path.extname(requestedOutputPath).toLowerCase() === ".csv"
      ? requestedOutputPath
      : ensureXlsxFilePath(requestedOutputPath);
  const resourceCatalog = loadJsonArray(RESOURCES_PATH);
  const opportunities = loadJsonArray(OPPORTUNITIES_PATH);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  log("");
  if (path.extname(outputPath).toLowerCase() === ".csv") {
    fs.writeFileSync(outputPath, `${resourceCatalogToCsv(resourceCatalog)}\n`, "utf8");
    log(`Saved Excel-compatible CSV to ${outputPath}`);
    log(`Exported ${getResourceExportRows(resourceCatalog).length} resources.`);
    log("Set GATORGUIDE_RESOURCE_EXCEL_EXPORT_PATH to an .xlsx path for the default workbook export.");
    openGoogleSheetsAfterExport();
    return;
  }

  const workbookSheets = buildResourceExportWorkbookSheets(resourceCatalog, opportunities);
  const workbook = createXlsxBuffer(workbookSheets);
  const sheetCounts = Object.fromEntries(
    workbookSheets.map((sheet) => [sheet.name, sheet.count ?? 0])
  );
  fs.writeFileSync(outputPath, workbook);
  log(`Saved Excel workbook to ${outputPath}`);
  log(`Exported ${sheetCounts.Resources ?? 0} resource links.`);
  log(
    `Included ${sheetCounts.Scholarships ?? 0} scholarships, ${sheetCounts.Internships ?? 0} internships, ${sheetCounts.Deadlines ?? 0} deadlines, and ${sheetCounts.Legacy ?? 0} legacy links.`
  );
  log("The Resources sheet can be edited and imported back through this same menu; the other sheets are export-only references.");
  openGoogleSheetsAfterExport();
}

async function importResourcesAsExcelFile(rl) {
  const inputPathInput = await askText(rl, "Which XLSX or CSV file should be imported?", {
    defaultValue: RESOURCE_EXCEL_EXPORT_PATH,
    hint: "Use an XLSX exported from this tool. CSV imports are still supported.",
  });
  if (isBackSignal(inputPathInput)) return;

  const inputPath = resolveUserFilePath(inputPathInput, RESOURCE_EXCEL_EXPORT_PATH);
  if (!fs.existsSync(inputPath)) {
    fail(`Could not find import file: ${inputPath}`);
  }

  const nextCatalog = parseResourceCatalogSpreadsheet(inputPath);
  const itemCount = nextCatalog.reduce(
    (sum, section) =>
      sum +
      (section.items?.length ?? 0) +
      (section.subsections ?? []).reduce(
        (subSum, subsection) => subSum + (subsection.items?.length ?? 0),
        0
      ),
    0
  );

  printSummary("Review this import before saving.", [
    ["Import file", inputPath],
    ["Sections", String(nextCatalog.length)],
    ["Resources", String(itemCount)],
    ["Target catalog", RESOURCES_PATH],
  ]);

  const confirmed = await confirmAction(
    rl,
    "Replace the current resource catalog with this import?",
    false
  );
  if (isBackSignal(confirmed) || !confirmed) {
    log("Cancelled. No files were changed.");
    return;
  }

  writeJsonArray(RESOURCES_PATH, nextCatalog);

  log("");
  log(`Imported ${itemCount} resources into ${RESOURCES_PATH}`);
  log(`Backup written to ${RESOURCES_PATH}.bak`);
}

async function importExportResourcesAsExcelFile(rl) {
  const choice = await askChoice(
    rl,
    "Import/export resources as Excel workbook",
    [
      { value: "export", label: "Export resources to Excel file" },
      { value: "import", label: "Import resources from Excel file" },
      { value: "__back__", label: "Back" },
    ],
    {
      defaultValue: "export",
      invalidMessage: "Enter in 1, 2, or 3 for your choice.",
      showDefaultLabel: false,
    }
  );

  if (choice === "__back__" || isBackSignal(choice)) return;
  if (choice === "import") {
    await importResourcesAsExcelFile(rl);
    return;
  }

  await exportResourcesAsExcelFile();
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
              { value: "publish", label: "Publish updated resources to repo" },
              { value: "excel", label: "Import/Export resources as excel file" },
            ],
            {
              defaultValue: "add",
              invalidMessage: "Enter in 1, 2, 3, or 4 for your choice.",
              showDefaultLabel: false,
            }
          ),
        assign(state, value) {
          state.action = value;
        },
      },
      {
        when: (state) => state.action !== "publish" && state.action !== "excel",
        prompt: async (state) => {
          const options = [
            { value: "scholarship", label: "Scholarship" },
            { value: "internship", label: "Internship / work opportunity" },
            { value: "college_deadline", label: "College deadline" },
            { value: "general_deadline", label: "General deadline" },
            { value: "quarter-start", label: "Quarter start" },
            { value: "quarter-end", label: "Quarter end" },
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

    if (action === "publish") {
      await publishUpdatedResources(rl);
      return;
    }

    if (action === "excel") {
      await importExportResourcesAsExcelFile(rl);
      return;
    }

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
