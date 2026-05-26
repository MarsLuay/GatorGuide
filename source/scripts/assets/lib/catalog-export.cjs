/* Spreadsheet import/export helpers for add-catalog-item.cjs. */

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const {
  OPPORTUNITY_LISTING_KIND_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  asList,
  formatOpportunityListingKind,
  normalizeTags,
  normalizeWhitespace,
  slugify,
} = require("./catalog-schema.cjs");
const { fail } = require("./catalog-prompts.cjs");
const {
  assignCatalogText,
  resolveCatalogExportText,
  safeDisplayLabel,
  safeSubsectionLabel,
  translateResourceKey,
} = require("./catalog-translations.cjs");

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
  { key: "listingKind", label: "RESOURCE GROUP", width: 20 },
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
  { key: "listingKind", label: "RESOURCE GROUP", width: 20 },
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
  { key: "listingKind", label: "RESOURCE GROUP", width: 20 },
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

function getOpportunityExportTags(opportunity) {
  return [
    ...asList(opportunity?.matching?.financialAidTags),
    ...asList(opportunity?.matching?.suggestedMajors),
    ...asList(opportunity?.eligibility?.residencyTypes),
    ...asList(opportunity?.eligibility?.communityTags),
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
  const communityTags = asList(opportunity?.eligibility?.communityTags);
  if (communityTags.length) {
    prereqs.push(`Community: ${communityTags.join(", ")}`);
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
      listingKind: formatOpportunityListingKind(
        opportunity.listingKind,
        opportunity.type,
        opportunity
      ),
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
      listingKind: formatOpportunityListingKind(
        opportunity.listingKind,
        opportunity.type,
        opportunity
      ),
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
    listingKind: formatOpportunityListingKind(
      opportunity.listingKind,
      opportunity.type,
      opportunity
    ),
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
  const optionListingKinds = uniqueSpreadsheetOptions([
    ...Object.values(OPPORTUNITY_LISTING_KIND_LABELS),
    ...allOpportunities.map((opportunity) =>
      formatOpportunityListingKind(
        opportunity.listingKind,
        opportunity.type,
        opportunity
      )
    ),
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
      key: "listingKinds",
      label: "Resource groups",
      values: optionListingKinds,
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
    listingKinds: createInlineListFormula(Object.values(OPPORTUNITY_LISTING_KIND_LABELS)),
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
    { key: "listingKind", formula: inlineFormulas.listingKinds ?? optionRefs.listingKinds },
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
    { key: "listingKind", formula: inlineFormulas.listingKinds ?? optionRefs.listingKinds },
    { key: "sourceKind", formula: inlineFormulas.sourceKinds ?? optionRefs.sourceKinds },
    { key: "status", formula: inlineFormulas.statuses ?? optionRefs.statuses },
  ]);
  const legacyValidations = createListValidations(LEGACY_EXCEL_EXPORT_COLUMNS, [
    { key: "type", formula: inlineFormulas.opportunityTypes ?? optionRefs.opportunityTypes },
    { key: "listingKind", formula: inlineFormulas.listingKinds ?? optionRefs.listingKinds },
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

module.exports = {
  RESOURCE_EXCEL_EXPORT_COLUMNS,
  getResourceExportRows,
  resourceCatalogToSpreadsheetRows,
  resourceCatalogToCsv,
  buildResourceExportWorkbookSheets,
  parseResourceCatalogCsv,
  parseResourceCatalogXlsx,
  parseResourceCatalogSpreadsheet,
  ensureXlsxFilePath,
  createXlsxBuffer,
};
