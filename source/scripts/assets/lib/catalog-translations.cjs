const fs = require("node:fs");
const path = require("node:path");

const { normalizeWhitespace } = require("./catalog-schema.cjs");

const MOBILE_TEAM_ROOT = path.resolve(__dirname, "..", "..", "..");
const RESOURCE_TRANSLATIONS_PATH = path.join(
  MOBILE_TEAM_ROOT,
  "constants",
  "locales",
  "en.json"
);

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

function addResourceTranslationEntries(prefix, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof item === "string") {
      englishResourceTranslations.set(`resources.${nextKey}`, item);
    } else {
      addResourceTranslationEntries(nextKey, item);
    }
  }
}

function loadEnglishResourceTranslations() {
  if (englishResourceTranslations) return englishResourceTranslations;

  englishResourceTranslations = new Map();

  if (!fs.existsSync(RESOURCE_TRANSLATIONS_PATH)) {
    return englishResourceTranslations;
  }

  const locale = JSON.parse(fs.readFileSync(RESOURCE_TRANSLATIONS_PATH, "utf8"));
  const resources = locale.resources && typeof locale.resources === "object"
    ? locale.resources
    : {};

  addResourceTranslationEntries("", resources);

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

module.exports = {
  RESOURCE_SECTION_LABELS,
  RESOURCE_SUBSECTION_LABELS,
  safeDisplayLabel,
  safeSubsectionLabel,
  formatSectionPath,
  loadEnglishResourceTranslations,
  translateResourceKey,
  resolveCatalogExportText,
  assignCatalogText,
};
