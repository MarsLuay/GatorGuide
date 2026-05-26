/* global __dirname, fetch */
const fs = require("node:fs");
const path = require("node:path");
const { fetchTextWithHandling } = require("../lib/fetch-with-handling.cjs");
const { ensureTmpLayout, getTmpPath } = require("../lib/tmp-layout.cjs");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = ensureTmpLayout(PROJECT_ROOT).root;
const OPPORTUNITIES_PATH = path.resolve(PROJECT_ROOT, "data", "starter-opportunities.json");
const REPORT_JSON_PATH = getTmpPath(PROJECT_ROOT, "deadline-refresh-report.json");
const REPORT_MD_PATH = getTmpPath(PROJECT_ROOT, "deadline-refresh-report.md");
const TIMEZONE = "America/Los_Angeles";
const KIND = "official_page";
const USER_AGENT = "GatorGuideDeadlineRefresh/1.0";
const RECENT_PAST_WINDOW_DAYS = 14;

const SOURCES = {
  grcRegistrar: {
    key: "grc-registrar",
    url: "https://www.greenriver.edu/students/academics/office-of-the-registrar/index.html",
    label: "Green River Office of the Registrar Important Upcoming Dates",
  },
  grcFinancialAid: {
    key: "grc-financial-aid",
    url: "https://www.greenriver.edu/students/pay-for-college/financial-aid/financial-aid-deadlines.html",
    label: "Green River financial aid deadlines page",
  },
  uwSeattleTransfer: {
    key: "uw-seattle-transfer",
    url: "https://admit.washington.edu/apply/transfer/",
    label: "UW Office of Admissions transfer dates and deadlines",
  },
};

const MONTH_INDEX = new Map([
  ["jan", 1],
  ["january", 1],
  ["feb", 2],
  ["february", 2],
  ["mar", 3],
  ["march", 3],
  ["apr", 4],
  ["april", 4],
  ["may", 5],
  ["jun", 6],
  ["june", 6],
  ["jul", 7],
  ["july", 7],
  ["aug", 8],
  ["august", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["oct", 10],
  ["october", 10],
  ["nov", 11],
  ["november", 11],
  ["dec", 12],
  ["december", 12],
]);

const TERM_ORDER = ["Winter", "Spring", "Summer", "Fall"];

const GRC_COLLEGE = {
  collegeId: null,
  collegeName: "Green River College",
  city: "Auburn",
  state: "WA",
  website: "https://www.greenriver.edu/",
};

const UW_SEATTLE_COLLEGE = {
  collegeId: null,
  collegeName: "University of Washington Seattle",
  city: "Seattle",
  state: "WA",
  website: "https://www.washington.edu/",
};

const EMPTY_AWARD = {
  amountMin: null,
  amountMax: null,
  currency: "USD",
  amountText: null,
  renewable: null,
};

const EMPTY_REQUIREMENTS = {
  needsRecommendations: false,
  recommendationCountMin: 0,
  essayCount: 0,
};

const EMPTY_MATCHING = {
  financialAidTags: [],
  suggestedMajors: [],
  hasToBeMajor: false,
};

const DEFAULT_ELIGIBILITY = {
  gpaMin: null,
  residencyTypes: [],
  transferOnly: false,
};

const GRC_REGISTRAR_ROW_SPECS = [
  {
    match: /^Priority Enrollment/i,
    id: "green-river-priority-enrollment-for",
    title: (terms) => `Priority Class Enrollment for ${terms}`,
    label: "Priority enrollment opens",
    deadlineType: "priority",
    hour: 8,
    summary: (terms) =>
      `Priority enrollment opens at 8:00 AM for students with priority registration status for ${terms}. Exact appointment access times should be checked in ctcLink/My Green River because dates are subject to change.`,
  },
  {
    match: /^Current\/Returning Enrollment:\s*90\+\s*cr/i,
    id: "green-river-current-returning-enrollment-90plus-credits-for",
    title: (terms) => `90+ Credits Class Enrollment for ${terms}`,
    label: "Class enrollment opens",
    deadlineType: "priority",
    hour: 8,
    summary: (terms) =>
      `Class enrollment opens at 8:00 AM for current or returning students with 90 or more completed/evaluated credits for ${terms}. Exact appointment access times should be checked in ctcLink/My Green River because dates are subject to change.`,
  },
  {
    match: /^Current\/Returning Enrollment:\s*60\s*-\s*89\s*cr/i,
    id: "green-river-current-returning-enrollment-60-89-credits-for",
    title: (terms) => `60-89 Credits Class Enrollment for ${terms}`,
    label: "Class enrollment opens",
    deadlineType: "priority",
    hour: 8,
    summary: (terms) =>
      `Class enrollment opens at 8:00 AM for current or returning students with 60 to 89 completed/evaluated credits for ${terms}. Exact appointment access times should be checked in ctcLink/My Green River because dates are subject to change.`,
  },
  {
    match: /^Current\/Returning Enrollment:\s*30\s*-\s*59\s*cr/i,
    id: "green-river-current-returning-enrollment-30-59-credits-for",
    title: (terms) => `30-59 Credits Class Enrollment for ${terms}`,
    label: "Class enrollment opens",
    deadlineType: "priority",
    hour: 8,
    summary: (terms) =>
      `Class enrollment opens at 8:00 AM for current or returning students with 30 to 59 completed/evaluated credits for ${terms}. Exact appointment access times should be checked in ctcLink/My Green River because dates are subject to change.`,
  },
  {
    match: /^Current\/Returning Enrollment:\s*0\s*-\s*29\s*cr/i,
    id: "green-river-current-returning-enrollment-0-29-credits-for",
    title: (terms) => `0-29 Credits Class Enrollment for ${terms}`,
    label: "Class enrollment opens",
    deadlineType: "priority",
    hour: 8,
    summary: (terms) =>
      `Class enrollment opens at 8:00 AM for current or returning students with 0 to 29 completed/evaluated credits for ${terms}. Exact appointment access times should be checked in ctcLink/My Green River because dates are subject to change.`,
  },
  {
    match: /^New Student Enrollment/i,
    id: "green-river-new-student-enrollment-for",
    title: (terms) => `New Student Class Enrollment for ${terms}`,
    label: "New student enrollment opens",
    deadlineType: "priority",
    hour: 9,
    summary: (terms) =>
      `Class enrollment opens for new students assigned an enrollment appointment for ${terms} after completing the required admissions/advising steps. Exact appointment access times should be checked in ctcLink/My Green River because dates are subject to change.`,
  },
  {
    match: /^Tuition or 1st Payment Plan Due Date/i,
    id: "green-river-tuition-or-first-payment-plan-due-for",
    title: (terms) => `Tuition or First Payment Plan Due for ${terms}`,
    label: "Tuition due date",
  },
  {
    match: /^Waitlist Closes/i,
    id: "green-river-waitlist-closes-for",
    title: (terms) => `Waitlist Closes for ${terms}`,
    label: "Waitlist closes",
  },
  {
    match: /^Quarter Begins/i,
    id: "green-river-quarter-begins-for",
    title: (terms) => `Quarter Begins for ${terms}`,
    label: "Quarter begins",
  },
  {
    match: /^Instructor Permission Required to Add Class/i,
    id: "green-river-instructor-permission-required-to-add-class-for",
    title: (terms) => `Instructor Permission Required to Add Class for ${terms}`,
    label: "Instructor permission required",
  },
  {
    match: /^100% Refund Deadline/i,
    id: "green-river-100-percent-refund-deadline-for",
    title: (terms) => `100% Refund Deadline for ${terms}`,
    label: "100% refund deadline",
  },
  {
    match: /^Census Date/i,
    id: "green-river-census-date-for",
    title: (terms) => `Census Date for ${terms}`,
    label: "Census date",
  },
  {
    match: /^Last day to withdraw, not posted on transcript/i,
    id: "green-river-last-day-to-withdraw-without-transcript-posting-for",
    title: (terms) => `Last Day to Withdraw Without Transcript Posting for ${terms}`,
    label: "Withdraw without transcript posting",
  },
  {
    match: /^40% Refund Deadline/i,
    id: "green-river-40-percent-refund-deadline-for",
    title: (terms) => `40% Refund Deadline for ${terms}`,
    label: "40% refund deadline",
  },
  {
    match: /^Residency Reclassification Deadline/i,
    id: "green-river-residency-reclassification-deadline-for",
    title: (terms) => `Residency Reclassification Deadline for ${terms}`,
    label: "Residency reclassification deadline",
  },
  {
    match: /^Pass\/No-Credit Request Deadline/i,
    id: "green-river-pass-no-credit-request-deadline-for",
    title: (terms) => `Pass/No-Credit Request Deadline for ${terms}`,
    label: "Pass/no-credit request deadline",
  },
  {
    match: /^Official Withdrawal Deadline/i,
    id: "green-river-official-withdrawal-deadline-for",
    title: (terms) => `Official Withdrawal Deadline for ${terms}`,
    label: "Official withdrawal deadline",
  },
  {
    match: /^Study Day/i,
    id: "green-river-study-day-for",
    title: (terms) => `Study Day for ${terms}`,
    label: "Study day",
  },
  {
    match: /^Finals/i,
    id: "green-river-finals-begin-for",
    title: (terms) => `Finals Begin for ${terms}`,
    label: "Finals begin",
  },
  {
    match: /^Quarter Ends/i,
    id: "green-river-quarter-ends-for",
    title: (terms) => `Quarter Ends for ${terms}`,
    label: "Quarter ends",
  },
  {
    match: /^Grades Due/i,
    id: "green-river-grades-due-for",
    title: (terms) => `Grades Due for ${terms}`,
    label: "Grades due",
    hour: 7,
  },
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return normalizeWhitespace(
    String(value ?? "")
      .replace(
        /&(nbsp|#160|#8211|ndash|#8212|mdash|amp|quot|#39);/g,
        (entity) => {
          switch (entity) {
            case "&nbsp;":
            case "&#160;":
              return " ";
            case "&#8211;":
            case "&ndash;":
            case "&#8212;":
            case "&mdash;":
              return "-";
            case "&amp;":
              return "&";
            case "&quot;":
              return '"';
            case "&#39;":
              return "'";
            default:
              return entity;
          }
        }
      )
  );
}

function stripTags(value) {
  return decodeHtml(String(value ?? "").replace(/<[^>]+>/g, " "));
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, "plus")
    .replace(/%/g, " percent ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchHtml(source) {
  return fetchTextWithHandling(source.url, {
    operation: `Fetch deadline source ${source.key}`,
    timeoutMs: 30000,
    userAgent: USER_AGENT,
  });
}

function extractTableAfter(html, headingText) {
  const headingIndex = html.toLowerCase().indexOf(headingText.toLowerCase());
  if (headingIndex < 0) {
    throw new Error(`Could not find heading: ${headingText}`);
  }
  const tableStart = html.toLowerCase().indexOf("<table", headingIndex);
  if (tableStart < 0) {
    throw new Error(`Could not find table after heading: ${headingText}`);
  }
  const tableEnd = html.toLowerCase().indexOf("</table>", tableStart);
  if (tableEnd < 0) {
    throw new Error(`Could not find table end after heading: ${headingText}`);
  }
  return html.slice(tableStart, tableEnd + "</table>".length);
}

function parseHtmlTable(tableHtml) {
  return [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
    .map((rowMatch) =>
      [...rowMatch[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) =>
        stripTags(cellMatch[1])
      )
    )
    .filter((cells) => cells.length > 0);
}

function parseQuarterHeader(value) {
  const match = stripTags(value).match(/\b(Winter|Spring|Summer|Fall)\s+(\d{4})\b/i);
  if (!match) return null;
  return {
    term: match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase(),
    year: Number(match[2]),
  };
}

function getYearForTermDate(termInfo, month) {
  if (termInfo.term === "Winter" && month >= 9) {
    return termInfo.year - 1;
  }
  return termInfo.year;
}

function parseFirstMonthDay(value) {
  const text = normalizeWhitespace(value)
    .replace(/(\b[A-Za-z]{3,9})(\d{1,2})\b/g, "$1 $2")
    .replace(/\u200b|\ufeff/g, "");
  if (!text || /^-+$/.test(text) || text.includes("---")) return null;

  const match = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})\b/);
  if (!match) return null;

  const month = MONTH_INDEX.get(match[1].toLowerCase().replace(/\.$/, ""));
  const day = Number(match[2]);
  if (!month || !Number.isInteger(day) || day < 1 || day > 31) return null;
  return { month, day };
}

function parseExplicitDate(value) {
  const monthDay = parseFirstMonthDay(value);
  if (!monthDay) return null;
  const yearMatch = String(value ?? "").match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;
  return {
    ...monthDay,
    year: Number(yearMatch[1]),
  };
}

function getPacificOffsetMinutes(date) {
  const timeZoneName =
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      timeZoneName: "shortOffset",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "";

  const match = timeZoneName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

function zonedDateTimeToIso(year, month, day, hour = 9, minute = 0) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let index = 0; index < 2; index += 1) {
    const offsetMinutes = getPacificOffsetMinutes(new Date(utc));
    utc = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - offsetMinutes * 60 * 1000;
  }
  return new Date(utc).toISOString();
}

function compareIso(left, right) {
  return String(left).localeCompare(String(right));
}

function getCutoffIso(now = new Date()) {
  return new Date(now.getTime() - RECENT_PAST_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function formatTerm(termInfo) {
  return `${termInfo.term} ${termInfo.year}`;
}

function formatTermGroup(terms) {
  if (terms.length === 1) return formatTerm(terms[0]);
  const years = Array.from(new Set(terms.map((term) => term.year)));
  if (years.length === 1) {
    return `${terms.map((term) => term.term).join("/") } ${years[0]}`;
  }
  return terms.map(formatTerm).join("/");
}

function formatTermGroupSlug(terms, options = {}) {
  if (terms.length === 1) {
    return `${slugify(terms[0].term)}-${terms[0].year}`;
  }
  const years = Array.from(new Set(terms.map((term) => term.year)));
  const separator = options.useAndForPair && terms.length === 2 ? "-and-" : "-";
  if (years.length === 1) {
    return `${terms.map((term) => slugify(term.term)).join(separator)}-${years[0]}`;
  }
  return terms.map((term) => `${slugify(term.term)}-${term.year}`).join(separator);
}

function sortTerms(terms) {
  return [...terms].sort((left, right) => {
    if (left.year !== right.year) return left.year - right.year;
    return TERM_ORDER.indexOf(left.term) - TERM_ORDER.indexOf(right.term);
  });
}

function buildSource(source, nowIso) {
  return {
    kind: KIND,
    sourceUrl: source.url,
    sourceLabel: source.label,
    model: null,
    fetchedAt: nowIso,
    verifiedAt: nowIso,
  };
}

function buildBaseOpportunity({
  opportunityId,
  type = "college_deadline",
  title,
  organizationName,
  summary,
  externalUrl,
  dueAt,
  deadlineType = "final",
  deadlineLabel,
  matching = EMPTY_MATCHING,
  eligibility = DEFAULT_ELIGIBILITY,
  college = GRC_COLLEGE,
  source,
  nowIso,
  recurrence = {
    isYearly: false,
    month: null,
    day: null,
    timezone: TIMEZONE,
  },
}) {
  return {
    schemaVersion: 1,
    opportunityId,
    type,
    status: "active",
    title,
    organizationName,
    summary,
    externalUrl,
    dueAt,
    recurrence,
    deadline: {
      type: deadlineType,
      label: deadlineLabel,
    },
    matching,
    eligibility,
    requirements: EMPTY_REQUIREMENTS,
    award: EMPTY_AWARD,
    college,
    source: buildSource(source, nowIso),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function semanticOpportunity(value) {
  if (!value) return null;
  const clone = JSON.parse(JSON.stringify(value));
  clone.createdAt = null;
  clone.updatedAt = null;
  if (clone.source) {
    clone.source.fetchedAt = null;
    clone.source.verifiedAt = null;
  }
  return clone;
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortObject(value[key])])
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(sortObject(value));
}

function hasSemanticChanges(existing, candidate) {
  return stableStringify(semanticOpportunity(existing)) !== stableStringify(semanticOpportunity(candidate));
}

function applyOpportunityUpdate(existing, candidate, nowIso) {
  if (!existing) {
    return { status: "created", item: candidate };
  }
  if (!hasSemanticChanges(existing, candidate)) {
    return { status: "unchanged", item: existing };
  }
  return {
    status: "updated",
    item: {
      ...candidate,
      createdAt: existing.createdAt ?? candidate.createdAt ?? nowIso,
      updatedAt: nowIso,
      source: {
        ...candidate.source,
        fetchedAt: nowIso,
        verifiedAt: nowIso,
      },
    },
  };
}

function groupRowsBySpecAndDueAt(items) {
  const groups = new Map();
  for (const item of items) {
    const key = `${item.spec.id}|${item.dueAt}`;
    const current = groups.get(key) ?? {
      spec: item.spec,
      dueAt: item.dueAt,
      parsedDate: item.parsedDate,
      terms: [],
    };
    current.terms.push(item.termInfo);
    groups.set(key, current);
  }
  return Array.from(groups.values()).map((group) => ({
    ...group,
    terms: sortTerms(group.terms),
  }));
}

function buildRegistrarSummary(label, terms) {
  return `Green River's registrar calendar lists ${label.toLowerCase()} for ${terms}. Dates are subject to change; verify the official registrar page and ctcLink/My Green River when planning registration, payment, or course changes.`;
}

function parseGrcRegistrarDeadlines(html, nowIso) {
  const table = extractTableAfter(html, "Important Upcoming Dates");
  const rows = parseHtmlTable(table);
  const headers = rows[0]?.slice(1).map(parseQuarterHeader) ?? [];
  if (!headers.length || headers.some((header) => !header)) {
    throw new Error("Could not parse Green River registrar quarter headers.");
  }

  const cutoffIso = getCutoffIso(new Date(nowIso));
  const rawItems = [];
  for (const row of rows.slice(1)) {
    const rowLabel = row[0];
    const spec = GRC_REGISTRAR_ROW_SPECS.find((candidate) => candidate.match.test(rowLabel));
    if (!spec) continue;

    row.slice(1).forEach((cell, index) => {
      const termInfo = headers[index];
      const monthDay = parseFirstMonthDay(cell);
      if (!termInfo || !monthDay) return;
      const year = getYearForTermDate(termInfo, monthDay.month);
      const dueAt = zonedDateTimeToIso(year, monthDay.month, monthDay.day, spec.hour ?? 9);
      if (compareIso(dueAt, cutoffIso) < 0) return;
      rawItems.push({
        spec,
        termInfo,
        dueAt,
        parsedDate: {
          year,
          month: monthDay.month,
          day: monthDay.day,
        },
      });
    });
  }

  return groupRowsBySpecAndDueAt(rawItems).map((group) => {
    const termsDisplay = formatTermGroup(group.terms);
    const termSlug = formatTermGroupSlug(group.terms);
    const summary = group.spec.summary
      ? group.spec.summary(termsDisplay)
      : buildRegistrarSummary(group.spec.label, termsDisplay);

    return buildBaseOpportunity({
      opportunityId: `${group.spec.id}-${termSlug}`,
      title: group.spec.title(termsDisplay),
      organizationName: "Green River College",
      summary,
      externalUrl: SOURCES.grcRegistrar.url,
      dueAt: group.dueAt,
      deadlineType: group.spec.deadlineType ?? "final",
      deadlineLabel: group.spec.label,
      source: SOURCES.grcRegistrar,
      nowIso,
    });
  });
}

function parseGrcFinancialAidDeadlines(html, nowIso) {
  const table = extractTableAfter(html, "Past and Upcoming Priority Funding Processing Dates");
  const rows = parseHtmlTable(table);
  const rawItems = [];

  for (const row of rows) {
    if (row.length < 2 || /start quarter/i.test(row[0])) continue;
    const quarterMatch = row[0].match(/\b(Winter|Spring|Summer|Fall)\s+Quarter\s+(20\d{2})\b/i);
    const parsedDate = parseExplicitDate(row[1]);
    if (!quarterMatch || !parsedDate) continue;
    rawItems.push({
      termInfo: {
        term: quarterMatch[1].charAt(0).toUpperCase() + quarterMatch[1].slice(1).toLowerCase(),
        year: Number(quarterMatch[2]),
      },
      dueAt: zonedDateTimeToIso(parsedDate.year, parsedDate.month, parsedDate.day, 9),
      parsedDate,
    });
  }

  const groups = new Map();
  for (const item of rawItems) {
    const current = groups.get(item.dueAt) ?? {
      dueAt: item.dueAt,
      terms: [],
    };
    current.terms.push(item.termInfo);
    groups.set(item.dueAt, current);
  }

  return Array.from(groups.values()).map((group) => {
    const terms = sortTerms(group.terms);
    const termsDisplay = formatTermGroup(terms);
    const termSlug = formatTermGroupSlug(terms, { useAndForPair: true });
    return buildBaseOpportunity({
      opportunityId: `green-river-fafsa-wasfa-priority-deadline-for-${termSlug}`,
      title: `Green River FAFSA/WASFA Priority Deadline for ${termsDisplay}`,
      organizationName: "Green River College Financial Aid Office",
      summary: `Complete your FAFSA or WASFA and submit all required Green River financial aid documents by this date to receive priority processing for ${termsDisplay}. Meeting the deadline can help keep your classes from being dropped for non-payment while aid is being processed.`,
      externalUrl: SOURCES.grcFinancialAid.url,
      dueAt: group.dueAt,
      deadlineType: "priority",
      deadlineLabel: "Priority processing deadline",
      matching: {
        financialAidTags: ["need_based", "fafsa_required"],
        suggestedMajors: [],
        hasToBeMajor: false,
      },
      college: GRC_COLLEGE,
      source: SOURCES.grcFinancialAid,
      nowIso,
    });
  });
}

function getNextOccurrenceIso(month, day, nowIso) {
  const now = new Date(nowIso);
  let year = now.getFullYear();
  let dueAt = zonedDateTimeToIso(year, month, day, 9);
  if (compareIso(dueAt, nowIso) < 0) {
    year += 1;
    dueAt = zonedDateTimeToIso(year, month, day, 9);
  }
  return dueAt;
}

function parseUwSeattleTransferDeadlines(html, nowIso) {
  const table = extractTableAfter(html, "Key dates &amp; deadlines");
  const rows = parseHtmlTable(table);
  const rawItems = rows
    .slice(1)
    .map((row) => {
      const quarter = String(row[0] ?? "").replace(/\*/g, "").trim();
      const opens = parseFirstMonthDay(row[2]);
      const deadline = parseFirstMonthDay(row[3]);
      if (!quarter || !deadline) return null;
      return {
        quarter,
        opens,
        deadline,
        dueAt: getNextOccurrenceIso(deadline.month, deadline.day, nowIso),
      };
    })
    .filter(Boolean);

  const groups = new Map();
  for (const item of rawItems) {
    const key = `${item.deadline.month}-${item.deadline.day}|${item.opens?.month ?? ""}-${item.opens?.day ?? ""}`;
    const current = groups.get(key) ?? {
      deadline: item.deadline,
      opens: item.opens,
      dueAt: item.dueAt,
      quarters: [],
    };
    current.quarters.push(item.quarter);
    groups.set(key, current);
  }

  return Array.from(groups.values()).map((group) => {
    const quarters = group.quarters;
    const quarterDisplay = quarters.join("/");
    const quarterSlug = slugify(quarterDisplay);
    const opensText = group.opens
      ? `${monthName(group.opens.month)} ${group.opens.day}`
      : "the published opening date";
    const deadlineText = `${monthName(group.deadline.month)} ${group.deadline.day}`;
    const limitedSpringNote = quarters.includes("Spring")
      ? " Spring quarter is limited to applicants to specific departments in engineering and computer science."
      : "";
    const summerNote = quarters.includes("Summer")
      ? " Most degree-seeking transfer students apply for Autumn quarter; Summer admission has special notes on the UW page."
      : "";
    return buildBaseOpportunity({
      opportunityId: `uw-seattle-transfer-application-deadline-for-${quarterSlug}-admission`,
      title: `UW Seattle Transfer Application Deadline for ${quarterDisplay} Admission`,
      organizationName: "UW Seattle Office of Admissions",
      summary: `UW Seattle transfer applications for ${quarterDisplay} admission open ${opensText} and are due ${deadlineText} each year.${limitedSpringNote}${summerNote}`,
      externalUrl: SOURCES.uwSeattleTransfer.url,
      dueAt: group.dueAt,
      deadlineType: "final",
      deadlineLabel: "Transfer application deadline",
      matching: EMPTY_MATCHING,
      eligibility: {
        ...DEFAULT_ELIGIBILITY,
        transferOnly: true,
      },
      college: UW_SEATTLE_COLLEGE,
      source: SOURCES.uwSeattleTransfer,
      nowIso,
      recurrence: {
        isYearly: true,
        month: group.deadline.month,
        day: group.deadline.day,
        timezone: TIMEZONE,
      },
    });
  });
}

function monthName(month) {
  return [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][month];
}

function readOpportunities() {
  const parsed = JSON.parse(fs.readFileSync(OPPORTUNITIES_PATH, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected ${OPPORTUNITIES_PATH} to contain an array.`);
  }
  return parsed;
}

function writeOpportunities(items) {
  fs.writeFileSync(OPPORTUNITIES_PATH, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function writeReports(report) {
  ensureDir(REPORT_JSON_PATH);
  fs.writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const lines = [
    "# Deadline Refresh Report",
    "",
    `- Checked at: ${report.checkedAt}`,
    `- Parsed deadlines: ${report.parsedCount}`,
    `- Created: ${report.created.length}`,
    `- Updated: ${report.updated.length}`,
    `- Unchanged: ${report.unchanged.length}`,
    "",
    "## Sources",
    "",
    ...report.sources.map(
      (source) =>
        `- ${source.label}: ${source.parsedCount} parsed from ${source.url}`
    ),
    "",
    "## Created",
    "",
    ...(report.created.length
      ? report.created.map((item) => `- ${item}`)
      : ["- None"]),
    "",
    "## Updated",
    "",
    ...(report.updated.length
      ? report.updated.map((item) => `- ${item}`)
      : ["- None"]),
    "",
  ];

  fs.writeFileSync(REPORT_MD_PATH, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const nowIso = new Date().toISOString();
  const sourceReports = [];

  const registrarHtml = await fetchHtml(SOURCES.grcRegistrar);
  const registrarDeadlines = parseGrcRegistrarDeadlines(registrarHtml, nowIso);
  sourceReports.push({
    ...SOURCES.grcRegistrar,
    parsedCount: registrarDeadlines.length,
  });

  const financialAidHtml = await fetchHtml(SOURCES.grcFinancialAid);
  const financialAidDeadlines = parseGrcFinancialAidDeadlines(financialAidHtml, nowIso);
  sourceReports.push({
    ...SOURCES.grcFinancialAid,
    parsedCount: financialAidDeadlines.length,
  });

  const uwTransferHtml = await fetchHtml(SOURCES.uwSeattleTransfer);
  const uwTransferDeadlines = parseUwSeattleTransferDeadlines(uwTransferHtml, nowIso);
  sourceReports.push({
    ...SOURCES.uwSeattleTransfer,
    parsedCount: uwTransferDeadlines.length,
  });

  const parsedDeadlines = [
    ...financialAidDeadlines,
    ...registrarDeadlines,
    ...uwTransferDeadlines,
  ];
  const parsedById = new Map(parsedDeadlines.map((item) => [item.opportunityId, item]));
  if (parsedById.size !== parsedDeadlines.length) {
    throw new Error("Deadline refresh produced duplicate opportunity ids.");
  }

  const existing = readOpportunities();
  const existingIds = new Set(existing.map((item) => String(item.opportunityId)));
  const changeReport = {
    created: [],
    updated: [],
    unchanged: [],
  };

  const next = existing.map((item) => {
    const candidate = parsedById.get(item.opportunityId);
    if (!candidate) return item;
    const result = applyOpportunityUpdate(item, candidate, nowIso);
    changeReport[result.status].push(item.opportunityId);
    return result.item;
  });

  for (const candidate of parsedDeadlines) {
    if (existingIds.has(candidate.opportunityId)) continue;
    next.push(candidate);
    changeReport.created.push(candidate.opportunityId);
  }

  writeOpportunities(next);

  const report = {
    checkedAt: nowIso,
    sources: sourceReports.map((source) => ({
      key: source.key,
      label: source.label,
      url: source.url,
      parsedCount: source.parsedCount,
    })),
    parsedCount: parsedDeadlines.length,
    created: changeReport.created,
    updated: changeReport.updated,
    unchanged: changeReport.unchanged,
    outputPath: OPPORTUNITIES_PATH,
    reportPath: REPORT_JSON_PATH,
  };
  writeReports(report);

  console.log("Deadline refresh complete.");
  console.log(`Parsed ${report.parsedCount} deadlines.`);
  console.log(
    `Created ${report.created.length}; updated ${report.updated.length}; unchanged ${report.unchanged.length}.`
  );
  console.log(`Report: ${REPORT_MD_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
