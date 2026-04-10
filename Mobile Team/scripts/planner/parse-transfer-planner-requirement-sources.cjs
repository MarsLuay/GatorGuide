const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
const {
  TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY,
  TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY,
} = require("../../constants/transfer-planner-source");
let TRANSFER_PLANNER_GENERATED_COURSE_METADATA = [];
try {
  ({ TRANSFER_PLANNER_GENERATED_COURSE_METADATA } = require("../../constants/transfer-planner-source/course-metadata.generated"));
} catch {
  TRANSFER_PLANNER_GENERATED_COURSE_METADATA = [];
}

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const SNAPSHOT_DIR = path.resolve(TMP_DIR, "transfer-planner-requirement-source-snapshots");
const OUTPUT_JSON_PATH = path.resolve(TMP_DIR, "transfer-planner-requirement-source-parse-report.json");
const OUTPUT_MD_PATH = path.resolve(TMP_DIR, "transfer-planner-requirement-source-parse-report.md");
const OUTPUT_TS_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "requirement-source-adapters.generated.ts"
);
function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_HOST_COOLDOWN_MS = 750;
const USER_AGENT = "GatorGuideTransferPlannerRequirementParser/1.0";
const CURL_COMMAND = process.platform === "win32" ? "curl.exe" : "curl";
const CURL_MAX_BUFFER_BYTES = 40 * 1024 * 1024;
const CURL_ACCEPT_HEADER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,*/*;q=0.7";
const GENERATED_CHUNK_SIZE = 40;
const EXPLICIT_COURSE_CODE_PATTERN =
  /\b([A-Za-z&]{2,8}|[A-Za-z&]{1,4}(?:\s+[A-Za-z&]{1,4}))\s+(\d{3}[A-Za-z]?)\b/g;
const COURSE_NUMBER_CONTINUATION_PATTERN =
  /(?:^|[,(;/]\s*|\b(?:or|and)\s+)(\d{3}[A-Za-z]?)(?=$|[\s,);/]|(?:\s*(?:or|and)\b))/gi;
const NOISY_SOURCE_LINE_PATTERN =
  /(?:src=|srcset=|aria-label=|title=|\.jpg\b|\.jpeg\b|\.png\b|\.svg\b|\.gif\b|^\[page\s+\d+\]\s*%pdf-|^\s*%pdf-)/i;
const TRANSFER_CREDIT_NOISE_PATTERN =
  /\b(transfer credits?|transfer equivalenc(?:y|ies)|articulation agreement|community colleges?|community college)\b/i;
const ENGLISH_COMPOSITION_REQUIREMENT_PATTERN = /\benglish composition\b/i;
const ENGLISH_COMPOSITION_CONTEXT_PATTERN =
  /\b(5 credits of|five credits of|min(?:imum)?(?:\s+course)? requirements?|prerequisite|admission|complete|completed|required|eligibility|preferred)\b/i;
const ENGLISH_COMPOSITION_EXCLUSION_PATTERN =
  /\b(additional english composition|except the 5-?credit english composition requirement|writing-intensive|w course|w courses)\b/i;
const INVALID_EXTRACTED_COURSE_SUBJECTS = new Set([
  "ABOVE",
  "AND",
  "ANY",
  "APPROVED",
  "ARE",
  "AREA",
  "AT",
  "BASIC",
  "BE",
  "BETWEEN",
  "BELOW",
  "BEGIN",
  "BOX",
  "BLDG",
  "BUILDING",
  "COURSES",
  "CREDITS",
  "COMPLETE",
  "DIVISION",
  "EARN",
  "FAX",
  "FORTUNE",
  "FOR",
  "HALL",
  "FROM",
  "IF",
  "IN",
  "INTO",
  "LEAST",
  "MINIMUM",
  "MORE",
  "MUST",
  "NUMBERED",
  "OF",
  "ONE",
  "ON",
  "OFFERINGS",
  "OCCUPIES",
  "OR",
  "OTHER",
  "PLUS",
  "REACH",
  "REQUIRES",
  "RM",
  "ROOM",
  "SUITE",
  "TAKE",
  "THAT",
  "THAN",
  "THE",
  "THEN",
  "TO",
  "TOTALS",
  "TWO",
  "WITH",
  "YOUR",
]);
const LEADING_EXTRACTED_COURSE_SUBJECT_TOKENS = new Set(["AND", "AS", "OR"]);
const LEADING_LIST_MARKER_TOKENS = new Set(["I", "II", "III", "IV"]);
const EXTRACTED_COURSE_SUBJECT_ALIASES = {
  BIOLOGY: "BIOL",
  PHYSICS: "PHYS",
};
const KNOWN_UW_EXTRACTED_COURSE_SUBJECTS = new Set(
  TRANSFER_PLANNER_GENERATED_COURSE_METADATA.filter((entry) => entry.schoolId !== "grc")
    .map((entry) => String(entry.code ?? "").match(/^([A-Z&]+(?: [A-Z&]+)*) \d/))
    .map((match) => match?.[1] ?? null)
    .filter(Boolean)
);
const REQUIREMENT_CUE_PATTERN =
  /\b(required|requirements|prereq|prerequisite|complete|credits|credit|elective|select|choose|one of the following|two of the following|option|track|route|pathway|concentration)\b/i;
const STRUCTURAL_REQUIREMENT_PATTERN =
  /\b(admission requirements|degree requirements|major requirements|completion requirements|required courses|elective courses|core courses|core requirements|curriculum|prerequisite courses|shared set of core courses|specialization|track|option|route|pathway|concentration|checklist|foundation|distribution requirement)\b/i;
const BLOCK_TAG_PATTERN = /<(?:\/?(?:p|div|section|article|li|ul|ol|table|tr|td|th|h1|h2|h3|h4|h5|h6|br))[^>]*>/gi;
const TITLE_PATTERN = /<title[^>]*>([\s\S]*?)<\/title>/i;
const HEADING_PATTERN = /<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi;
const HTML_LINK_PATTERN = /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi;
const HTML_TAG_PATTERN = /<[^>]+>/g;
const PDF_LINK_PATTERN = /href=(?:"([^"]+\.pdf(?:\?[^"]*)?)"|'([^']+\.pdf(?:\?[^']*)?)')/gi;
const SUPPLEMENTAL_HTML_LINK_PATTERN =
  /\b(curriculum|requirements?|degree requirements?|major requirements?|prerequisites?|prereq|worksheet|checklist|track|option|concentration|specialization|route|pathway|b\.?\s*a\.?|b\.?\s*s\.?|bachelor(?:'s)?|major(?: in)?|undergraduate studies?)\b/i;
const HIGH_SIGNAL_SUPPLEMENTAL_HTML_LINK_PATTERN =
  /\b(curriculum|requirements?|degree requirements?|major requirements?|prerequisites?|prereq|worksheet|checklist)\b/i;
const SPECIALIZATION_SUPPLEMENTAL_HTML_LINK_PATTERN =
  /\b(track|option|concentration|specialization|route|pathway)\b/i;
const LOW_SIGNAL_SUPPLEMENTAL_HTML_LINK_PATTERN =
  /\b(?:b\.?\s*a\.?|b\.?\s*s\.?|bachelor(?:'s)?|major(?: in)?|undergraduate studies?)\b/i;
const NOISY_SUPPLEMENTAL_HTML_LINK_LABEL_PATTERN =
  /\b(apply|canvas|calendar|directory|map|myuw|library|tools|about|news|faculty|staff|contact|privacy|accessibility|terms|alumni|events|parking|transportation|research|housing|student life|jobs|visit|give|get involved|post graduation|minor|certificate|graduate|scholarships?)\b/i;
const CAMPUS_ORDER = ["uw-seattle", "uw-bothell", "uw-tacoma"];
const PARSEABLE_PARSER_TYPES = new Set([
  "html-degree-page",
  "html-curriculum-page",
  "html-overview-page",
  "catalog-page",
  "generic-html",
  "pdf-degree-sheet",
  "pdf-worksheet",
  "generic-pdf",
]);
const HOST_REQUEST_CHAINS = new Map();
const HOST_NEXT_ALLOWED_AT = new Map();
const execFileAsync = promisify(execFile);
const REQUIREMENT_SOURCE_ADAPTERS = [
  {
    id: "uw-seattle-html-degree-page",
    family: "UW Seattle HTML degree pages",
    matches: (entry) =>
      entry.campusId === "uw-seattle" &&
      ["html-degree-page", "html-curriculum-page", "html-overview-page"].includes(entry.parserType),
    parse: parseHtmlSource,
  },
  {
    id: "uw-seattle-catalog-page",
    family: "UW Seattle catalog pages",
    matches: (entry) => entry.campusId === "uw-seattle" && entry.parserType === "catalog-page",
    parse: parseHtmlSource,
  },
  {
    id: "uw-bothell-html-degree-page",
    family: "UW Bothell HTML degree pages",
    matches: (entry) =>
      entry.campusId === "uw-bothell" &&
      ["html-degree-page", "html-curriculum-page", "html-overview-page"].includes(entry.parserType),
    parse: parseHtmlSource,
  },
  {
    id: "uw-bothell-catalog-page",
    family: "UW Bothell catalog pages",
    matches: (entry) => entry.campusId === "uw-bothell" && entry.parserType === "catalog-page",
    parse: parseHtmlSource,
  },
  {
    id: "uw-bothell-pdf-worksheet",
    family: "UW Bothell PDF worksheets",
    matches: (entry) =>
      entry.campusId === "uw-bothell" &&
      ["pdf-degree-sheet", "pdf-worksheet", "generic-pdf"].includes(entry.parserType),
    parse: parsePdfSource,
  },
  {
    id: "uw-tacoma-html-degree-page",
    family: "UW Tacoma HTML degree pages",
    matches: (entry) =>
      entry.campusId === "uw-tacoma" &&
      ["html-degree-page", "html-curriculum-page", "html-overview-page"].includes(entry.parserType),
    parse: parseHtmlSource,
  },
  {
    id: "uw-tacoma-catalog-page",
    family: "UW Tacoma catalog pages",
    matches: (entry) => entry.campusId === "uw-tacoma" && entry.parserType === "catalog-page",
    parse: parseHtmlSource,
  },
  {
    id: "generic-official-pdf-degree-sheet",
    family: "Generic official PDF degree sheets",
    matches: (entry) => ["pdf-degree-sheet", "pdf-worksheet", "generic-pdf"].includes(entry.parserType),
    parse: parsePdfSource,
  },
  {
    id: "generic-official-html-page",
    family: "Generic official HTML pages",
    matches: (entry) => ["generic-html", "html-degree-page", "html-curriculum-page", "html-overview-page", "catalog-page"].includes(entry.parserType),
    parse: parseHtmlSource,
  },
];

function ensureDir(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHostKey(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "unknown-host";
  }
}

async function withHostThrottle(url, work) {
  const hostKey = getHostKey(url);
  const previous = HOST_REQUEST_CHAINS.get(hostKey) ?? Promise.resolve();
  const run = previous
    .catch(() => undefined)
    .then(async () => {
      const waitMs = Math.max(0, (HOST_NEXT_ALLOWED_AT.get(hostKey) ?? 0) - Date.now());
      if (waitMs > 0) {
        await sleep(waitMs);
      }

      try {
        return await work();
      } finally {
        HOST_NEXT_ALLOWED_AT.set(hostKey, Date.now() + DEFAULT_HOST_COOLDOWN_MS);
      }
    });

  HOST_REQUEST_CHAINS.set(
    hostKey,
    run.then(
      () => undefined,
      () => undefined
    )
  );

  return run;
}

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  const entityMap = {
    amp: "&",
    nbsp: " ",
    "#39": "'",
    apos: "'",
    quot: '"',
    lt: "<",
    gt: ">",
  };

  return String(value ?? "").replace(/&(amp|nbsp|#39|apos|quot|lt|gt);/gi, (match, entity) => {
    return entityMap[String(entity).toLowerCase()] ?? match;
  });
}

function stripHtml(value) {
  return normalizeWhitespace(decodeHtmlEntities(String(value ?? "").replace(HTML_TAG_PATTERN, " ")));
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function normalizeUrlForComparison(value) {
  try {
    const parsed = new URL(String(value ?? ""));
    parsed.hash = "";
    const normalizedPathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${normalizedPathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function normalizeCourseCode(rawValue) {
  const normalized = normalizeWhitespace(String(rawValue ?? "").toUpperCase().replace(/\s+/g, " "));
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

function slugify(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function selectRequirementSourceAdapter(entry) {
  return (
    REQUIREMENT_SOURCE_ADAPTERS.find((adapter) => adapter.matches(entry)) ??
    REQUIREMENT_SOURCE_ADAPTERS[REQUIREMENT_SOURCE_ADAPTERS.length - 1]
  );
}

function getSourceRoleScore(entry) {
  switch (entry.role) {
    case "degree-requirements":
      return 6;
    case "curriculum":
      return 5;
    case "worksheet":
      return 4;
    case "catalog":
      return 3;
    case "overview":
      return 2;
    default:
      return 1;
  }
}

function getParserTypeScore(parserType) {
  switch (parserType) {
    case "html-degree-page":
      return 8;
    case "html-curriculum-page":
      return 7;
    case "catalog-page":
      return 6;
    case "html-overview-page":
      return 5;
    case "pdf-degree-sheet":
      return 4;
    case "pdf-worksheet":
      return 3;
    case "generic-html":
      return 2;
    case "generic-pdf":
      return 1;
    default:
      return 0;
  }
}

function compareManifestFallbackCandidates(left, right) {
  const confidenceScoreDelta =
    ["high", "medium", "low"].indexOf(left.confidence) - ["high", "medium", "low"].indexOf(right.confidence);
  if (confidenceScoreDelta !== 0) {
    return confidenceScoreDelta;
  }

  const roleDelta = getSourceRoleScore(right) - getSourceRoleScore(left);
  if (roleDelta !== 0) {
    return roleDelta;
  }

  const parserTypeDelta = getParserTypeScore(right.parserType) - getParserTypeScore(left.parserType);
  if (parserTypeDelta !== 0) {
    return parserTypeDelta;
  }

  return left.label.localeCompare(right.label);
}

function getAlternateParseableManifestEntries(entry) {
  return TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
    (candidate) =>
      candidate.ownerId === entry.ownerId &&
      candidate.id !== entry.id &&
      candidate.url !== entry.url &&
      candidate.campusId === entry.campusId &&
      PARSEABLE_PARSER_TYPES.has(candidate.parserType)
  ).sort(compareManifestFallbackCandidates);
}

function getStructuredUwCourseCodes(manifestEntry) {
  return uniqueSorted(
    TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY.filter(
      (block) =>
        block.planId === manifestEntry.planId &&
        ((manifestEntry.pathwayId && block.pathwayId === manifestEntry.pathwayId) ||
          (!manifestEntry.pathwayId && !block.pathwayId))
    ).flatMap((block) => block.uwCourseCodes ?? [])
  );
}

function extractCourseSubjectTokens(rawValue) {
  return normalizeWhitespace(String(rawValue ?? ""))
    .toUpperCase()
    .split(" ")
    .filter(Boolean);
}

function normalizeExtractedCourseSubject(rawValue) {
  const rawSubject = normalizeWhitespace(String(rawValue ?? "")).toUpperCase();
  const normalizedSubject = EXTRACTED_COURSE_SUBJECT_ALIASES[rawSubject] ?? rawSubject;
  const rawSubjectTokens = extractCourseSubjectTokens(normalizedSubject);
  const leadingTokensStripped =
    rawSubjectTokens.length > 1 &&
    LEADING_EXTRACTED_COURSE_SUBJECT_TOKENS.has(rawSubjectTokens[0])
      ? rawSubjectTokens.slice(1)
      : rawSubjectTokens;
  const subjectTokens =
    leadingTokensStripped.length > 1 &&
    LEADING_LIST_MARKER_TOKENS.has(leadingTokensStripped[0])
      ? leadingTokensStripped.slice(1)
      : leadingTokensStripped;
  const subject = subjectTokens.join(" ");
  const collapsedSubject = subjectTokens.join("");
  const hasDanglingAmpersandToken = subjectTokens.some((token) => token === "&" || token.endsWith("&"));

  if (
    subjectTokens.length > 1 &&
    KNOWN_UW_EXTRACTED_COURSE_SUBJECTS.has(collapsedSubject) &&
    !KNOWN_UW_EXTRACTED_COURSE_SUBJECTS.has(subject)
  ) {
    return collapsedSubject;
  }

  if (
    !subjectTokens.length ||
    subjectTokens.length > 2 ||
    hasDanglingAmpersandToken ||
    subjectTokens.some((token) => token.length > 8 || !/^[A-Z&]+$/.test(token)) ||
    INVALID_EXTRACTED_COURSE_SUBJECTS.has(subject) ||
    subjectTokens.some((token) => INVALID_EXTRACTED_COURSE_SUBJECTS.has(token)) ||
    ((/SKL$/i.test(subject) || /SKL$/i.test(collapsedSubject)) &&
      !KNOWN_UW_EXTRACTED_COURSE_SUBJECTS.has(subject) &&
      !KNOWN_UW_EXTRACTED_COURSE_SUBJECTS.has(collapsedSubject))
  ) {
    return null;
  }

  return subject;
}

function normalizeExtractedCourseCode(rawSubject, rawNumber) {
  const subject = normalizeExtractedCourseSubject(rawSubject);
  const number = normalizeWhitespace(String(rawNumber ?? "").toUpperCase());

  if (!subject || !/^\d{3}[A-Z]?$/.test(number) || /^000[A-Z]?$/.test(number)) {
    return null;
  }

  return `${subject} ${number}`;
}

function extractRelevantRequirementLines(lines, headings) {
  const normalizedHeadings = new Set(headings.map((heading) => normalizeWhitespace(heading)));
  const relevantLineIndexes = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeWhitespace(lines[index]);
    if (!line) {
      continue;
    }

    if (
      TRANSFER_CREDIT_NOISE_PATTERN.test(line) ||
      normalizedHeadings.has(line) ||
      REQUIREMENT_CUE_PATTERN.test(line) ||
      STRUCTURAL_REQUIREMENT_PATTERN.test(line)
    ) {
      if (TRANSFER_CREDIT_NOISE_PATTERN.test(line)) {
        continue;
      }
      for (
        let includedIndex = Math.max(0, index - 1);
        includedIndex <= Math.min(lines.length - 1, index + 5);
        includedIndex += 1
      ) {
        relevantLineIndexes.add(includedIndex);
      }
    }
  }

  if (!relevantLineIndexes.size) {
    return lines.slice(0, 240);
  }

  return Array.from(relevantLineIndexes)
    .sort((left, right) => left - right)
    .map((index) => lines[index])
    .filter(
      (line) => !NOISY_SOURCE_LINE_PATTERN.test(line) && !TRANSFER_CREDIT_NOISE_PATTERN.test(line)
    );
}

function extractCourseCodesFromLine(line) {
  const normalizedLine = normalizeWhitespace(String(line ?? ""));
  if (
    NOISY_SOURCE_LINE_PATTERN.test(normalizedLine) ||
    TRANSFER_CREDIT_NOISE_PATTERN.test(normalizedLine)
  ) {
    return [];
  }

  const extractedCourseCodes = [];
  const explicitMatches = [...normalizedLine.matchAll(EXPLICIT_COURSE_CODE_PATTERN)];

  for (let index = 0; index < explicitMatches.length; index += 1) {
    const match = explicitMatches[index];
    const subject = normalizeExtractedCourseSubject(match[1]);
    const explicitCode = normalizeExtractedCourseCode(match[1], match[2]);

    if (!subject || !explicitCode) {
      continue;
    }

    extractedCourseCodes.push(explicitCode);

    const currentMatchEnd = match.index + match[0].length;
    const nextMatchStart =
      index + 1 < explicitMatches.length ? explicitMatches[index + 1].index : normalizedLine.length;
    const trailingSegment = normalizedLine.slice(currentMatchEnd, nextMatchStart);

    for (const numberMatch of trailingSegment.matchAll(COURSE_NUMBER_CONTINUATION_PATTERN)) {
      const continuationCode = normalizeExtractedCourseCode(subject, numberMatch[1]);
      if (continuationCode) {
        extractedCourseCodes.push(continuationCode);
      }
    }
  }

  if (
    ENGLISH_COMPOSITION_REQUIREMENT_PATTERN.test(normalizedLine) &&
    !ENGLISH_COMPOSITION_EXCLUSION_PATTERN.test(normalizedLine) &&
    (normalizedLine.length <= 140 || ENGLISH_COMPOSITION_CONTEXT_PATTERN.test(normalizedLine))
  ) {
    extractedCourseCodes.push("ENGL 131");
  }

  return uniqueSorted(extractedCourseCodes);
}

function extractCourseCodesFromLines(lines, headings) {
  return uniqueSorted(
    extractRelevantRequirementLines(lines, headings).flatMap((line) => extractCourseCodesFromLine(line))
  );
}

function getSourceLineHints(lines, courseCode) {
  return uniqueSorted(
    lines
      .filter((line) => line.includes(courseCode))
      .map((line) => normalizeWhitespace(line))
      .filter((line) => line.length <= 280)
      .slice(0, 5)
  );
}

function buildUniqueDerivedId(baseId, seenCounts) {
  const nextCount = (seenCounts.get(baseId) ?? 0) + 1;
  seenCounts.set(baseId, nextCount);
  return nextCount === 1 ? baseId : `${baseId}-${nextCount}`;
}

function buildParsedRequirementAtomCandidates(owner, parsedCourseCodes, snapshotLines) {
  const seenAtomIds = new Map();
  return parsedCourseCodes.map((courseCode) => {
    const baseId = `${owner.ownerId}:source-atom:${slugify(courseCode)}`;
    return {
      id: buildUniqueDerivedId(baseId, seenAtomIds),
      title: courseCode,
      uwCourseCode: courseCode,
      sourceLineHints: getSourceLineHints(snapshotLines, courseCode),
    };
  });
}

function normalizeMatcherText(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getTitleScopeTokens(entry) {
  const STOPWORDS = new Set([
    "and",
    "arts",
    "bachelor",
    "bothell",
    "campus",
    "catalog",
    "degree",
    "major",
    "of",
    "official",
    "overview",
    "page",
    "program",
    "requirements",
    "science",
    "seattle",
    "studies",
    "tacoma",
    "the",
    "university",
    "uw",
    "washington",
  ]);

  return uniqueSorted(
    normalizeMatcherText(`${entry.ownerTitle ?? ""} ${entry.sourceLabel ?? ""}`)
      .split(" ")
      .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
  ).slice(0, 8);
}

function scopePdfPageLines(entry, pageLines) {
  const titleTokens = getTitleScopeTokens(entry);
  if (!titleTokens.length || pageLines.length <= 2) {
    return pageLines;
  }

  const exactTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  const scoredPageIndexes = pageLines
    .map((line, index) => ({
      index,
      score: (() => {
        const normalizedLine = normalizeMatcherText(line);
        const tokenScore = titleTokens.filter((token) => normalizedLine.includes(token)).length;
        const exactTitleScore = exactTitle && normalizedLine.includes(exactTitle) ? 10 : 0;
        const requirementSignalScore =
          (
            normalizedLine.match(
              /\b(requirements?|credits?|courses?|major|minor|curriculum|prerequisite)\b/g
            ) ?? []
          ).length;

        return exactTitleScore + tokenScore * 2 + requirementSignalScore;
      })(),
    }))
    .filter((entryScore) => entryScore.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  if (!scoredPageIndexes.length) {
    return pageLines;
  }

  const bestScore = scoredPageIndexes[0].score;
  const bestPageIndex = scoredPageIndexes[0].index;
  const matchingIndexes = scoredPageIndexes
    .filter(
      (entryScore) =>
        Math.abs(entryScore.index - bestPageIndex) <= 1 &&
        entryScore.score >= Math.max(4, bestScore - 2)
    )
    .map((entryScore) => entryScore.index);

  if (!matchingIndexes.length) {
    return pageLines;
  }

  const startIndex = Math.max(0, Math.min(...matchingIndexes) - 1);
  const endIndex = Math.min(pageLines.length - 1, Math.max(...matchingIndexes) + 1);
  return pageLines.slice(startIndex, endIndex + 1);
}

function scopeHtmlLines(entry, title, headings, lines) {
  const titleTokens = getTitleScopeTokens(entry);
  if (!titleTokens.length || lines.length <= 20) {
    return lines;
  }

  const exactTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  const normalizedHeadings = new Set((headings ?? []).map((heading) => normalizeWhitespace(heading)));
  const scoredLineIndexes = lines
    .map((line, index) => ({
      index,
      score: (() => {
        const normalizedLine = normalizeMatcherText(line);
        const tokenScore = titleTokens.filter((token) => normalizedLine.includes(token)).length;
        const exactTitleScore = exactTitle && normalizedLine.includes(exactTitle) ? 10 : 0;
        const headingScore = normalizedHeadings.has(line) ? 2 : 0;
        const requirementSignalScore =
          (
            normalizedLine.match(
              /\b(requirements?|credits?|courses?|major|minor|curriculum|prerequisite|elective|option|track|pathway|concentration)\b/g
            ) ?? []
          ).length;
        const transferNoisePenalty = TRANSFER_CREDIT_NOISE_PATTERN.test(line) ? 8 : 0;

        return exactTitleScore + tokenScore * 2 + headingScore + requirementSignalScore - transferNoisePenalty;
      })(),
    }))
    .filter((entryScore) => entryScore.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  if (!scoredLineIndexes.length) {
    return lines;
  }

  const bestScore = scoredLineIndexes[0].score;
  const bestLineIndex = scoredLineIndexes[0].index;
  const matchingIndexes = scoredLineIndexes
    .filter(
      (entryScore) =>
        Math.abs(entryScore.index - bestLineIndex) <= 40 &&
        entryScore.score >= Math.max(3, bestScore - 3)
    )
    .map((entryScore) => entryScore.index);

  if (!matchingIndexes.length) {
    return lines;
  }

  const startIndex = Math.max(0, Math.min(...matchingIndexes) - 6);
  const endIndex = Math.min(lines.length - 1, Math.max(...matchingIndexes) + 24);
  const scopedLines = lines.slice(startIndex, endIndex + 1);

  if (scopedLines.length < 12 && title) {
    return [title, ...scopedLines];
  }

  return scopedLines;
}

function getStructuredDegreeMapBlocksForOwner(owner) {
  return TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY.filter(
    (block) =>
      block.planId === owner.planId &&
      (block.pathwayId === (owner.pathwayId ?? null) ||
        (owner.pathwayId && block.pathwayId == null) ||
        (!owner.pathwayId && block.pathwayId == null))
  );
}

function getBlockTitleTokens(title) {
  const STOPWORDS = new Set([
    "and",
    "arts",
    "baseline",
    "culture",
    "degree",
    "finish",
    "major",
    "media",
    "overall",
    "requirements",
    "requirement",
    "shared",
    "studies",
    "study",
    "the",
  ]);

  return normalizeMatcherText(title)
    .split(" ")
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

function getStructuredDegreeMapBlockHints(owner, requirementCueLines, chooseStatements, pathwayLabels, headings) {
  const sourceHints = uniqueSorted([
    ...headings,
    ...pathwayLabels,
    ...requirementCueLines,
    ...chooseStatements,
  ]).slice(0, 40);
  const normalizedHints = sourceHints.map((line) => ({
    line,
    normalized: normalizeMatcherText(line),
  }));

  return getStructuredDegreeMapBlocksForOwner(owner).flatMap((block) => {
    const blockTitleTokens = getBlockTitleTokens(block.title);
    const matchingLines = normalizedHints
      .filter(({ normalized }) => {
        const tokenOverlapCount = blockTitleTokens.filter((token) => normalized.includes(token)).length;
        if (tokenOverlapCount >= 2) {
          return true;
        }

        if (/admission/.test(normalized) && /\badmission\b/i.test(block.title)) {
          return true;
        }

        if (
          /\b(track|option|pathway|route|specialization)\b/.test(normalized) &&
          /\b(track|option|pathway|route|specialization)\b/i.test(block.title) &&
          tokenOverlapCount >= 1
        ) {
          return true;
        }

        if (
          /\b(core|foundation|structure|requirements?)\b/.test(normalized) &&
          /\b(core|foundation|structure|requirements?)\b/i.test(block.title)
        ) {
          return true;
        }

        return false;
      })
      .map(({ line }) => line)
      .slice(0, 6);

    if (!matchingLines.length) {
      return [];
    }

    return [
      {
        id: `${owner.ownerId}:source-degree-map:structured:${slugify(block.id)}`,
        title: block.title,
        uwCourseCodes: [],
        sourceLineHints: matchingLines,
      },
    ];
  });
}

function buildParsedDegreeMapBlockCandidates(
  owner,
  parsedCourseCodes,
  requirementCueLines,
  chooseStatements,
  pathwayLabels,
  headings
) {
  if (parsedCourseCodes.length) {
    return [
      {
        id: `${owner.ownerId}:source-degree-map:${slugify(owner.adapterId)}`,
        title: `${owner.ownerTitle} parsed official source requirements`,
        uwCourseCodes: parsedCourseCodes,
        sourceLineHints: requirementCueLines.slice(0, 10),
      },
    ];
  }

  const structuredCandidates = getStructuredDegreeMapBlockHints(
    owner,
    requirementCueLines,
    chooseStatements,
    pathwayLabels,
    headings
  );
  if (structuredCandidates.length) {
    return structuredCandidates;
  }

  const sourceLineHints = uniqueSorted([
    ...headings,
    ...pathwayLabels,
    ...requirementCueLines,
    ...chooseStatements,
  ]).slice(0, 10);
  if (!sourceLineHints.length) {
    return [];
  }

  return [
    {
      id: `${owner.ownerId}:source-degree-map:notes`,
      title: `${owner.ownerTitle} parsed official source structure`,
      uwCourseCodes: [],
      sourceLineHints,
    },
  ];
}

function writeSnapshot(ownerKey, sourceUrl, title, lines) {
  ensureDir(SNAPSHOT_DIR);
  const outputPath = getSnapshotPath(ownerKey);
  const body = [
    `Owner: ${ownerKey}`,
    `Source: ${sourceUrl}`,
    `Title: ${title || ""}`,
    "",
    ...lines,
  ].join("\n");
  fs.writeFileSync(outputPath, `${body}\n`);
  return outputPath;
}

function getSnapshotPath(ownerKey) {
  return path.resolve(SNAPSHOT_DIR, `${slugify(ownerKey)}.txt`);
}

function readSnapshot(ownerKey) {
  const snapshotPath = getSnapshotPath(ownerKey);
  if (!fs.existsSync(snapshotPath)) {
    return null;
  }

  const rawLines = fs.readFileSync(snapshotPath, "utf8").split(/\r?\n/);
  const titleLine = rawLines.find((line) => line.startsWith("Title:"));
  const bodyStartIndex = rawLines.findIndex((line, index) => index <= 6 && line.trim() === "");
  const snapshotLines = rawLines
    .slice(bodyStartIndex >= 0 ? bodyStartIndex + 1 : 0)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .slice(0, 1200);

  if (!snapshotLines.length) {
    return null;
  }

  return {
    snapshotPath,
    title: titleLine ? normalizeWhitespace(titleLine.replace(/^Title:\s*/, "")) : null,
    snapshotLines,
  };
}

function parseSnapshotSource(entry, originalError) {
  const snapshot = readSnapshot(entry.ownerId);
  if (!snapshot) {
    return null;
  }

  const requirementCueLines = extractRequirementCueLines(snapshot.snapshotLines);
  const chooseStatements = extractChooseStatements(snapshot.snapshotLines);
  const pathwayLabels = extractPathwayLabels(snapshot.snapshotLines, []);
  const courseCodes = extractCourseCodesFromLines(snapshot.snapshotLines, []);

  return {
    title: snapshot.title,
    headings: [],
    requirementCueLines,
    chooseStatements,
    pathwayLabels,
    courseCodes,
    snapshotLines: snapshot.snapshotLines,
    parseConfidence: buildParseConfidence(courseCodes, requirementCueLines, entry.parserType),
    snapshotPath: snapshot.snapshotPath,
    usedSnapshotFallback: true,
    snapshotFallbackReason: originalError.message,
  };
}

function parseRetryAfterToMs(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized) * 1000;
  }

  const retryAt = Date.parse(normalized);
  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(0, retryAt - Date.now());
}

function isRetryableHttpStatus(status) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function getRetryDelayMs(attempt, retryAfterHeader = null) {
  const retryAfterMs = parseRetryAfterToMs(retryAfterHeader);
  if (retryAfterMs !== null) {
    return Math.min(Math.max(retryAfterMs, DEFAULT_HOST_COOLDOWN_MS), 8000);
  }

  return Math.min(DEFAULT_HOST_COOLDOWN_MS * Math.pow(2, Math.max(0, attempt - 1)), 8000);
}

async function fetchWithTimeoutOnce(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetries(url, timeoutMs) {
  let lastError = null;
  let lastResponse = null;

  for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await withHostThrottle(url, () => fetchWithTimeoutOnce(url, timeoutMs));
      if (response.ok) {
        return response;
      }

      lastResponse = response;
      if (!isRetryableHttpStatus(response.status) || attempt >= DEFAULT_RETRY_ATTEMPTS) {
        return response;
      }

      await sleep(getRetryDelayMs(attempt, response.headers.get("retry-after")));
    } catch (error) {
      lastError = error;
      if (attempt >= DEFAULT_RETRY_ATTEMPTS) {
        break;
      }

      await sleep(getRetryDelayMs(attempt));
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError ?? new Error(`Failed to fetch ${url}.`);
}

function buildCurlErrorMessage(error, url) {
  const stderr = normalizeWhitespace(error?.stderr ?? "");
  const stdout = normalizeWhitespace(error?.stdout ?? "");
  const details = stderr || stdout || normalizeWhitespace(error?.message ?? "");
  return details ? `${details}` : `curl failed for ${url}`;
}

async function downloadWithCurl(url, timeoutMs, binary) {
  const args = [
    "--silent",
    "--show-error",
    "--location",
    "--fail",
    "--user-agent",
    USER_AGENT,
    "--header",
    `Accept: ${CURL_ACCEPT_HEADER}`,
    "--max-time",
    String(Math.max(5, Math.ceil(timeoutMs / 1000))),
    url,
  ];

  try {
    const result = await withHostThrottle(url, () =>
      execFileAsync(CURL_COMMAND, args, {
        encoding: binary ? "buffer" : "utf8",
        maxBuffer: CURL_MAX_BUFFER_BYTES,
        windowsHide: true,
      })
    );

    return {
      body: binary ? Buffer.from(result.stdout) : String(result.stdout ?? ""),
      fetchMode: "curl",
    };
  } catch (error) {
    throw new Error(buildCurlErrorMessage(error, url));
  }
}

async function downloadSource(url, timeoutMs, { binary = false } = {}) {
  let fetchResponse = null;
  let fetchError = null;

  try {
    fetchResponse = await fetchWithRetries(url, timeoutMs);
    if (fetchResponse.ok) {
      return {
        body: binary
          ? Buffer.from(await fetchResponse.arrayBuffer())
          : await fetchResponse.text(),
        fetchMode: "fetch",
      };
    }
  } catch (error) {
    fetchError = error;
  }

  try {
    return await downloadWithCurl(url, timeoutMs, binary);
  } catch (curlError) {
    if (fetchResponse && !fetchResponse.ok) {
      throw new Error(`HTTP ${fetchResponse.status} ${fetchResponse.statusText}`);
    }
    if (fetchError) {
      throw fetchError;
    }
    throw curlError;
  }
}

async function mapWithConcurrency(items, worker, concurrency, options = {}) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let completedCount = 0;
  const progressLabel = String(options.progressLabel ?? "items").trim() || "items";
  const describeItem =
    typeof options.describeItem === "function" ? options.describeItem : null;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
      completedCount += 1;
      const itemSuffix = describeItem
        ? ` - ${String(describeItem(items[currentIndex], currentIndex) ?? "").trim()}`
        : "";
      console.log(`[${completedCount}/${items.length}] ${progressLabel}${itemSuffix}`);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

function buildHtmlLines(html) {
  return String(html ?? "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(BLOCK_TAG_PATTERN, "\n")
    .split(/\r?\n/)
    .map((line) => stripHtml(line))
    .filter(Boolean);
}

function extractTitle(html) {
  const match = String(html ?? "").match(TITLE_PATTERN);
  return match ? stripHtml(match[1]) : null;
}

function extractHeadings(html) {
  const headings = [];
  for (const match of String(html ?? "").matchAll(HEADING_PATTERN)) {
    const heading = stripHtml(match[2]);
    if (!heading) {
      continue;
    }
    headings.push(heading);
  }
  return uniqueSorted(headings).slice(0, 20);
}

function extractRequirementCueLines(lines) {
  return lines.filter((line) => REQUIREMENT_CUE_PATTERN.test(line)).slice(0, 30);
}

function extractChooseStatements(lines) {
  return lines
    .filter((line) => /\b(choose|select|one of the following|two of the following)\b/i.test(line))
    .slice(0, 20);
}

function extractPathwayLabels(lines, headings) {
  return uniqueSorted(
    [...headings, ...lines]
      .filter((line) => /\b(option|track|route|pathway|concentration)\b/i.test(line))
      .slice(0, 20)
  );
}

function buildParseConfidence(parsedCourseCodes, requirementCueLines, parserType) {
  if (
    parsedCourseCodes.length >= 8 ||
    (parsedCourseCodes.length >= 4 && requirementCueLines.length >= 4)
  ) {
    return "high";
  }

  if (
    parsedCourseCodes.length >= 2 ||
    requirementCueLines.length >= 4 ||
    parserType === "pdf-degree-sheet"
  ) {
    return "medium";
  }

  return "low";
}

function buildHtmlParsedResult(entry, title, headings, lines) {
  const requirementCueLines = extractRequirementCueLines(lines);
  const chooseStatements = extractChooseStatements(lines);
  const pathwayLabels = extractPathwayLabels(lines, headings);
  const courseCodes = extractCourseCodesFromLines(lines, headings);

  return {
    title,
    headings,
    requirementCueLines,
    chooseStatements,
    pathwayLabels,
    courseCodes,
    snapshotLines: lines.slice(0, 1200),
    parseConfidence: buildParseConfidence(courseCodes, requirementCueLines, entry.parserType),
  };
}

function selectPreferredHtmlParsed(entry, fullParsed, scopedParsed) {
  if (!scopedParsed) {
    return fullParsed;
  }

  const fullAlignment = getParsedOwnerAlignmentScore(entry, fullParsed);
  const scopedAlignment = getParsedOwnerAlignmentScore(entry, scopedParsed);
  const fullCourseCount = fullParsed.courseCodes?.length ?? 0;
  const scopedCourseCount = scopedParsed.courseCodes?.length ?? 0;

  if (fullAlignment < 2 && scopedAlignment >= 2) {
    return scopedParsed;
  }

  if (scopedAlignment >= fullAlignment + 1 && scopedCourseCount >= Math.max(2, Math.floor(fullCourseCount * 0.25))) {
    return scopedParsed;
  }

  if (fullCourseCount >= 80 && scopedAlignment >= fullAlignment && scopedCourseCount >= 4) {
    return scopedParsed;
  }

  return fullParsed;
}

async function parseHtmlSource(entry, timeoutMs, options = {}) {
  if (/\.pdf(?:$|[?#])/i.test(entry.url)) {
    return parsePdfSource(entry, timeoutMs);
  }

  const { body: html } = await downloadSource(entry.url, timeoutMs);
  const title = extractTitle(html);
  const headings = extractHeadings(html);
  const lines = buildHtmlLines(html);
  const scopedLines = scopeHtmlLines(entry, title, headings, lines);
  const htmlParsed = selectPreferredHtmlParsed(
    entry,
    buildHtmlParsedResult(entry, title, headings, lines),
    scopedLines === lines ? null : buildHtmlParsedResult(entry, title, headings, scopedLines)
  );
  const visitedUrls = options.visitedUrls ?? new Set();
  const normalizedEntryUrl = normalizeUrlForComparison(entry.url);
  const allowLinkedRecovery = options.allowLinkedRecovery !== false;
  const linkedSupplementalSources =
    allowLinkedRecovery && normalizedEntryUrl
      ? await parseSupplementalHtmlSources(
          entry,
          html,
          timeoutMs,
          new Set([...visitedUrls, normalizedEntryUrl])
        )
      : [];
  const mergedHtmlParsed = mergeParsedSources(
    htmlParsed,
    linkedSupplementalSources,
    entry.parserType
  );

  const shouldFollowLinkedPdf =
    mergedHtmlParsed.courseCodes.length === 0 &&
    (/\b(download|checklist|worksheet|type:\s*pdf)\b/i.test((htmlParsed.snapshotLines ?? []).join(" ")) ||
      /\/file\//i.test(entry.url));

  if (!shouldFollowLinkedPdf) {
    return mergedHtmlParsed;
  }

  const pdfLinks = uniqueSorted(
    [...String(html ?? "").matchAll(PDF_LINK_PATTERN)]
      .map((match) => match[1] ?? match[2] ?? null)
      .filter(Boolean)
      .map((href) => {
        try {
          return new URL(href, entry.url).href;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  );

  for (const pdfUrl of pdfLinks.slice(0, 2)) {
    try {
      const pdfParsed = await parsePdfSource({ ...entry, url: pdfUrl }, timeoutMs);
      const htmlScore =
        mergedHtmlParsed.courseCodes.length * 100 +
        mergedHtmlParsed.requirementCueLines.length * 10 +
        mergedHtmlParsed.chooseStatements.length * 5;
      const pdfScore =
        pdfParsed.courseCodes.length * 100 +
        pdfParsed.requirementCueLines.length * 10 +
        pdfParsed.chooseStatements.length * 5;

      if (pdfScore > htmlScore) {
        return {
          ...pdfParsed,
          headings: uniqueSorted([...mergedHtmlParsed.headings, ...pdfParsed.headings]).slice(0, 20),
          requirementCueLines: uniqueSorted([
            ...mergedHtmlParsed.requirementCueLines,
            ...pdfParsed.requirementCueLines,
          ]).slice(0, 30),
          chooseStatements: uniqueSorted([
            ...mergedHtmlParsed.chooseStatements,
            ...pdfParsed.chooseStatements,
          ]).slice(0, 20),
          pathwayLabels: uniqueSorted([
            ...mergedHtmlParsed.pathwayLabels,
            ...pdfParsed.pathwayLabels,
          ]).slice(0, 20),
        };
      }
    } catch {
      // Keep the primary HTML parse result if linked PDF recovery fails.
    }
  }

  return mergedHtmlParsed;
}

async function parsePdfSource(entry, timeoutMs) {
  const { body } = await downloadSource(entry.url, timeoutMs, { binary: true });
  const pdfData = new Uint8Array(body);
  const document = await pdfjs.getDocument({ data: pdfData, verbosity: 0 }).promise;
  const pageCount = document.numPages;
  const pageLines = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => normalizeWhitespace(item.str))
      .filter(Boolean)
      .join(" ");
    if (pageText) {
      pageLines.push(`[Page ${pageNumber}] ${pageText}`);
    }
  }

  const scopedPageLines = scopePdfPageLines(entry, pageLines);

  const title = scopedPageLines[0]
    ? normalizeWhitespace(scopedPageLines[0].replace(/^\[Page \d+\]\s*/, ""))
    : null;
  const requirementCueLines = extractRequirementCueLines(scopedPageLines);
  const chooseStatements = extractChooseStatements(scopedPageLines);
  const pathwayLabels = extractPathwayLabels(scopedPageLines, []);
  const courseCodes = extractCourseCodesFromLines(scopedPageLines, []);

  return {
    title,
    headings: [],
    requirementCueLines,
    chooseStatements,
    pathwayLabels,
    courseCodes,
    snapshotLines: scopedPageLines.slice(0, 1200),
    parseConfidence: buildParseConfidence(courseCodes, requirementCueLines, entry.parserType),
  };
}

function hasMeaningfulParsedContent(parsed) {
  return Boolean(
    (parsed.courseCodes ?? []).length ||
      (parsed.requirementCueLines ?? []).length ||
      (parsed.chooseStatements ?? []).length ||
      (parsed.pathwayLabels ?? []).length
  );
}

function buildMergedSnapshotLines(baseLines, supplementalSources) {
  const mergedLines = [...(baseLines ?? [])];

  for (const supplemental of supplementalSources) {
    const label = normalizeWhitespace(
      supplemental.entry?.label ?? supplemental.entry?.url ?? "Supplemental official source"
    );

    if (label) {
      mergedLines.push(`[Supplemental official source] ${label}`);
    }

    for (const line of supplemental.parsed?.snapshotLines ?? []) {
      mergedLines.push(line);
    }
  }

  return uniqueSorted(mergedLines).slice(0, 1200);
}

function buildSharedLinkedCourseCodes(supplementalSources, minimumSupportCount) {
  const codeCounts = new Map();

  for (const supplemental of supplementalSources) {
    for (const courseCode of new Set(supplemental.parsed?.courseCodes ?? [])) {
      codeCounts.set(courseCode, (codeCounts.get(courseCode) ?? 0) + 1);
    }
  }

  return uniqueSorted(
    [...codeCounts.entries()]
      .filter(([, count]) => count >= minimumSupportCount)
      .map(([courseCode]) => courseCode)
  );
}

function buildSharedSpecializationSupplementalSource(baseParsed, supplementalSources, parserType) {
  if (supplementalSources.length < 2) {
    return [];
  }

  const minimumSupportCount = Math.max(2, Math.ceil(supplementalSources.length * 0.4));
  const sharedCourseCodes = buildSharedLinkedCourseCodes(
    supplementalSources,
    minimumSupportCount
  ).filter((courseCode) => !(baseParsed.courseCodes ?? []).includes(courseCode));

  if (!sharedCourseCodes.length) {
    return [];
  }

  const requirementCueLines = uniqueSorted(
    supplementalSources.flatMap((supplemental) => supplemental.parsed?.requirementCueLines ?? [])
  ).slice(0, 40);

  return [
    {
      entry: {
        label: "Supplemental official track and option pages",
      },
      parsed: {
        title: baseParsed.title,
        headings: [],
        requirementCueLines,
        chooseStatements: uniqueSorted(
          supplementalSources.flatMap((supplemental) => supplemental.parsed?.chooseStatements ?? [])
        ).slice(0, 24),
        pathwayLabels: uniqueSorted(
          supplementalSources.flatMap((supplemental) => supplemental.parsed?.pathwayLabels ?? [])
        ).slice(0, 24),
        courseCodes: sharedCourseCodes,
        snapshotLines: buildMergedSnapshotLines([], supplementalSources),
        parseConfidence: buildParseConfidence(sharedCourseCodes, requirementCueLines, parserType),
      },
    },
  ];
}

function mergeParsedSources(baseParsed, supplementalSources, parserType) {
  if (!supplementalSources.length) {
    return baseParsed;
  }

  const courseCodes = uniqueSorted([
    ...(baseParsed.courseCodes ?? []),
    ...supplementalSources.flatMap((supplemental) => supplemental.parsed?.courseCodes ?? []),
  ]);
  const requirementCueLines = uniqueSorted([
    ...(baseParsed.requirementCueLines ?? []),
    ...supplementalSources.flatMap(
      (supplemental) => supplemental.parsed?.requirementCueLines ?? []
    ),
  ]).slice(0, 40);

  return {
    ...baseParsed,
    headings: uniqueSorted([
      ...(baseParsed.headings ?? []),
      ...supplementalSources.flatMap((supplemental) => supplemental.parsed?.headings ?? []),
    ]).slice(0, 24),
    requirementCueLines,
    chooseStatements: uniqueSorted([
      ...(baseParsed.chooseStatements ?? []),
      ...supplementalSources.flatMap((supplemental) => supplemental.parsed?.chooseStatements ?? []),
    ]).slice(0, 24),
    pathwayLabels: uniqueSorted([
      ...(baseParsed.pathwayLabels ?? []),
      ...supplementalSources.flatMap((supplemental) => supplemental.parsed?.pathwayLabels ?? []),
    ]).slice(0, 24),
    courseCodes,
    snapshotLines: buildMergedSnapshotLines(baseParsed.snapshotLines, supplementalSources),
    parseConfidence: buildParseConfidence(courseCodes, requirementCueLines, parserType),
    usedSnapshotFallback:
      Boolean(baseParsed.usedSnapshotFallback) ||
      supplementalSources.some((supplemental) => supplemental.parsed?.usedSnapshotFallback),
    };
}

function extractSupplementalHtmlLinkCandidates(entry, html) {
  const baseUrl = normalizeUrlForComparison(entry.url);
  if (!baseUrl) {
    return [];
  }

  const entryOrigin = new URL(baseUrl).origin;
  const candidatesByUrl = new Map();

  for (const match of String(html ?? "").matchAll(HTML_LINK_PATTERN)) {
    const href = normalizeWhitespace(match[1] ?? match[2] ?? "");
    const label = stripHtml(match[3]);

    if (!href || !label || !SUPPLEMENTAL_HTML_LINK_PATTERN.test(`${label} ${href}`)) {
      continue;
    }

    if (
      /^(?:#|javascript:|mailto:|tel:)/i.test(href) ||
      /\.pdf(?:$|[?#])/i.test(href) ||
      NOISY_SUPPLEMENTAL_HTML_LINK_LABEL_PATTERN.test(label)
    ) {
      continue;
    }

    let resolvedUrl = null;
    try {
      resolvedUrl = normalizeUrlForComparison(new URL(href, entry.url).href);
    } catch {
      resolvedUrl = null;
    }

    if (!resolvedUrl || resolvedUrl === baseUrl || !resolvedUrl.startsWith(entryOrigin)) {
      continue;
    }

    const linkText = `${label} ${resolvedUrl}`;
    const highSignal = HIGH_SIGNAL_SUPPLEMENTAL_HTML_LINK_PATTERN.test(linkText);
    const specializationSignal = SPECIALIZATION_SUPPLEMENTAL_HTML_LINK_PATTERN.test(linkText);
    const degreeProgramSignal = LOW_SIGNAL_SUPPLEMENTAL_HTML_LINK_PATTERN.test(linkText);
    const type = highSignal
      ? "general"
      : specializationSignal
        ? "specialized"
        : degreeProgramSignal
          ? "general"
          : null;

    if (!type) {
      continue;
    }

    let score = 0;
    if (highSignal) {
      score += 16;
    }
    if (/\b(prereq|prerequisite)\b/i.test(linkText)) {
      score += 10;
    }
    if (/\bcurriculum\b/i.test(linkText)) {
      score += 10;
    }
    if (/\b(admission requirements?|degree requirements?|major requirements?)\b/i.test(linkText)) {
      score += 10;
    }
    if (specializationSignal) {
      score += 7;
    }
    if (degreeProgramSignal) {
      score += 6;
    }
    if (
      /(?:^|\/)(?:track|tracks|option|options|concentration|specialization|pathway|route)(?:\/|$|-)/i.test(
        resolvedUrl
      )
    ) {
      score += 4;
    }

    const existing = candidatesByUrl.get(resolvedUrl);
    if (!existing || score > existing.score) {
      candidatesByUrl.set(resolvedUrl, {
        url: resolvedUrl,
        label,
        score,
        type,
      });
    }
  }

  return [...candidatesByUrl.values()]
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 8);
}

async function parseSupplementalHtmlSources(entry, html, timeoutMs, visitedUrls) {
  const candidates = extractSupplementalHtmlLinkCandidates(entry, html);
  if (!candidates.length) {
    return [];
  }

  const parsedGeneralSources = [];
  const parsedSpecializationSources = [];

  for (const candidate of candidates) {
    if (visitedUrls.has(candidate.url)) {
      continue;
    }

    try {
      const parsed = await parseHtmlSource(
        {
          ...entry,
          url: candidate.url,
          label: candidate.label,
        },
        timeoutMs,
        {
          allowLinkedRecovery: false,
          visitedUrls: new Set([...visitedUrls, candidate.url]),
        }
      );

      if (!hasMeaningfulParsedContent(parsed)) {
        continue;
      }

      const supplementalSource = {
        entry: {
          label: candidate.label,
          url: candidate.url,
        },
        parsed,
      };

      if (candidate.type === "general") {
        parsedGeneralSources.push(supplementalSource);
      } else if (candidate.type === "specialized") {
        parsedSpecializationSources.push(supplementalSource);
      }
    } catch {
      // Keep the main page parse if a linked official page fails.
    }
  }

  return [
    ...parsedGeneralSources,
    ...buildSharedSpecializationSupplementalSource(
      {
        title: null,
        courseCodes: [],
      },
      parsedSpecializationSources,
      entry.parserType
    ),
  ];
}

function getParsedOwnerAlignmentScore(entry, parsed) {
  const exactTitle = normalizeMatcherText(entry.ownerTitle ?? "");
  const sampledText = normalizeMatcherText(
    [
      parsed.title,
      ...(parsed.headings ?? []).slice(0, 8),
      ...(parsed.snapshotLines ?? []).slice(0, 12),
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (exactTitle && sampledText.includes(exactTitle)) {
    return 10;
  }

  return getTitleScopeTokens(entry).filter((token) => sampledText.includes(token)).length;
}

function isFocusedDegreeSource(entry) {
  return (
    getSourceRoleScore(entry) >= 4 ||
    ["html-degree-page", "html-curriculum-page", "catalog-page", "pdf-degree-sheet", "pdf-worksheet"].includes(
      entry.parserType
    )
  );
}

function isBroadSupplementalSource(entry) {
  return (
    getSourceRoleScore(entry) <= 2 ||
    ["html-overview-page", "generic-html"].includes(entry.parserType)
  );
}

function isWeakParsedResult(entry, parsed) {
  return (
    (parsed.courseCodes?.length ?? 0) === 0 ||
    parsed.parseConfidence !== "high" ||
    getParsedOwnerAlignmentScore(entry, parsed) < 2 ||
    Boolean(parsed.usedSnapshotFallback)
  );
}

function getParsedResultScore(entry, parsed) {
  return (
    getParsedOwnerAlignmentScore(entry, parsed) * 100 +
    (parsed.courseCodes?.length ?? 0) * 12 +
    (parsed.requirementCueLines?.length ?? 0) * 3 +
    (parsed.chooseStatements?.length ?? 0) * 2 +
    (parsed.pathwayLabels?.length ?? 0)
  );
}

function shouldEvaluateAlternateSources(entry, parsed) {
  return isWeakParsedResult(entry, parsed);
}

function shouldAllowAlternateToReplaceBestSource(
  bestEntry,
  bestParsed,
  alternateEntry,
  alternateParsed
) {
  if (!hasMeaningfulParsedContent(alternateParsed)) {
    return false;
  }

  if (!isFocusedDegreeSource(bestEntry)) {
    return true;
  }

  if (!isBroadSupplementalSource(alternateEntry)) {
    return true;
  }

  return isWeakParsedResult(bestEntry, bestParsed);
}

function shouldMergeSupplementalAlternateSource(
  baseEntry,
  baseParsed,
  alternateEntry,
  alternateParsed
) {
  if (!hasMeaningfulParsedContent(alternateParsed)) {
    return false;
  }

  if (getParsedOwnerAlignmentScore(alternateEntry, alternateParsed) < 2) {
    return false;
  }

  if (isFocusedDegreeSource(baseEntry) && isBroadSupplementalSource(alternateEntry)) {
    return false;
  }

  const baseCourseCodes = new Set(baseParsed.courseCodes ?? []);
  const addsCourseCodes = (alternateParsed.courseCodes ?? []).some((code) => !baseCourseCodes.has(code));
  const baseCueLines = new Set(baseParsed.requirementCueLines ?? []);
  const addsCueLines = (alternateParsed.requirementCueLines ?? []).some(
    (line) => !baseCueLines.has(line)
  );
  const baseChooseStatements = new Set(baseParsed.chooseStatements ?? []);
  const addsChooseStatements = (alternateParsed.chooseStatements ?? []).some(
    (line) => !baseChooseStatements.has(line)
  );

  return addsCourseCodes || addsCueLines || addsChooseStatements;
}

function buildManifestParseSuccess(
  baseResult,
  structuredCourseCodes,
  resolvedEntry,
  parsed,
  resolutionStrategy
) {
  const parsedCourseCodes = uniqueSorted(parsed.courseCodes);
  const sourceOnlyCourseCodes = parsedCourseCodes.filter(
    (code) => !structuredCourseCodes.includes(code)
  );
  const structuredOnlyCourseCodes = structuredCourseCodes.filter(
    (code) => !parsedCourseCodes.includes(code)
  );
  const snapshotPath =
    parsed.snapshotPath ??
    writeSnapshot(baseResult.ownerId, resolvedEntry.url, parsed.title, parsed.snapshotLines);
  const parsedRequirementAtomCandidates = buildParsedRequirementAtomCandidates(
    baseResult,
    parsedCourseCodes,
    parsed.snapshotLines
  );
  const parsedDegreeMapBlockCandidates = buildParsedDegreeMapBlockCandidates(
    baseResult,
    parsedCourseCodes,
    parsed.requirementCueLines,
    parsed.chooseStatements,
    parsed.pathwayLabels,
    parsed.headings
  );

  return {
    ...baseResult,
    parserType: resolvedEntry.parserType,
    adapterId: selectRequirementSourceAdapter(resolvedEntry).id,
    adapterFamily: selectRequirementSourceAdapter(resolvedEntry).family,
    sourceUrl: resolvedEntry.url,
    sourceLabel: resolvedEntry.label,
    resolutionStrategy,
    ok: true,
    extractedTitle: parsed.title,
    extractedHeadings: parsed.headings,
    requirementCueLines: parsed.requirementCueLines,
    chooseStatements: parsed.chooseStatements,
    pathwayLabels: parsed.pathwayLabels,
    parsedUwCourseCodes: parsedCourseCodes,
    sourceOnlyUwCourseCodes: sourceOnlyCourseCodes,
    structuredOnlyUwCourseCodes: structuredOnlyCourseCodes,
    parsedRequirementAtomCandidates,
    parsedDegreeMapBlockCandidates,
    parseConfidence: parsed.parseConfidence,
    snapshotPath,
    usedSnapshotFallback: Boolean(parsed.usedSnapshotFallback),
    snapshotFallbackReason: parsed.snapshotFallbackReason ?? null,
    error: null,
  };
}

async function parseManifestEntry(entry, timeoutMs, options = {}) {
  const structuredCourseCodes = getStructuredUwCourseCodes(entry);
  const primaryAdapter = selectRequirementSourceAdapter(entry);
  const baseResult = {
    ownerId: entry.ownerId,
    ownerTitle: entry.ownerTitle,
    planId: entry.planId,
    pathwayId: entry.pathwayId,
    campusId: entry.campusId,
    primaryParserType: entry.parserType,
    primarySourceUrl: entry.url,
    primarySourceLabel: entry.label,
    structuredUwCourseCodes: structuredCourseCodes,
  };
  const snapshotOnly = options.snapshotOnly === true;

  if (snapshotOnly) {
    const snapshotParsed = parseSnapshotSource(entry, new Error("snapshot-only mode"));
    if (snapshotParsed) {
      return buildManifestParseSuccess(
        baseResult,
        structuredCourseCodes,
        entry,
        snapshotParsed,
        "cached-snapshot"
      );
    }

    return {
      ...baseResult,
      parserType: entry.parserType,
      adapterId: primaryAdapter.id,
      adapterFamily: primaryAdapter.family,
      sourceUrl: entry.url,
      sourceLabel: entry.label,
      resolutionStrategy: "cached-snapshot",
      ok: false,
      extractedTitle: null,
      extractedHeadings: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: [],
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: structuredCourseCodes,
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      parseConfidence: "low",
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: "snapshot-only mode but no cached snapshot was available",
      error: "Snapshot-only mode could not find a cached source snapshot.",
    };
  }

  try {
    const parsed = await primaryAdapter.parse(entry, timeoutMs);
    let bestEntry = entry;
    let bestParsed = parsed;
    let bestResolutionStrategy = "primary-source";
    let bestScore = getParsedResultScore(entry, parsed);
    const shouldInspectAlternateSources =
      shouldEvaluateAlternateSources(entry, parsed) || structuredCourseCodes.length > 0;
    const parsedAlternates = [];

    if (shouldInspectAlternateSources) {
      for (const alternateEntry of getAlternateParseableManifestEntries(entry)) {
        try {
          const alternateAdapter = selectRequirementSourceAdapter(alternateEntry);
          const alternateParsed = await alternateAdapter.parse(alternateEntry, timeoutMs);
          if (!hasMeaningfulParsedContent(alternateParsed)) {
            continue;
          }

           parsedAlternates.push({
            entry: alternateEntry,
            parsed: alternateParsed,
          });

          const alternateScore = getParsedResultScore(alternateEntry, alternateParsed);
          if (
            shouldAllowAlternateToReplaceBestSource(
              bestEntry,
              bestParsed,
              alternateEntry,
              alternateParsed
            ) &&
            alternateScore > bestScore
          ) {
            bestEntry = alternateEntry;
            bestParsed = alternateParsed;
            bestResolutionStrategy = "alternate-official-source";
            bestScore = alternateScore;
          }
        } catch {
          // Keep the strongest official parse result available.
        }
      }
    }

    const supplementalSources = [
      ...(bestEntry.id === entry.id ? [] : [{ entry, parsed }]),
      ...parsedAlternates.filter(
        (alternate) =>
          alternate.entry.id !== bestEntry.id &&
          shouldMergeSupplementalAlternateSource(
            bestEntry,
            bestParsed,
            alternate.entry,
            alternate.parsed
          )
      ),
    ];
    const mergedParsed = mergeParsedSources(bestParsed, supplementalSources, bestEntry.parserType);

    return buildManifestParseSuccess(
      baseResult,
      structuredCourseCodes,
      bestEntry,
      mergedParsed,
      bestResolutionStrategy
    );
  } catch (error) {
    for (const alternateEntry of getAlternateParseableManifestEntries(entry)) {
      try {
        const alternateAdapter = selectRequirementSourceAdapter(alternateEntry);
        const parsed = await alternateAdapter.parse(alternateEntry, timeoutMs);
        if (!hasMeaningfulParsedContent(parsed)) {
          continue;
        }

        return buildManifestParseSuccess(
          baseResult,
          structuredCourseCodes,
          alternateEntry,
          parsed,
          "alternate-official-source"
        );
      } catch {
        // Keep trying other official sources for the same owner before falling back to cached snapshots.
      }
    }

    const snapshotParsed = parseSnapshotSource(entry, error);
    if (snapshotParsed) {
      return buildManifestParseSuccess(
        baseResult,
        structuredCourseCodes,
        entry,
        snapshotParsed,
        "cached-snapshot"
      );
    }

    return {
      ...baseResult,
      parserType: entry.parserType,
      adapterId: primaryAdapter.id,
      adapterFamily: primaryAdapter.family,
      sourceUrl: entry.url,
      sourceLabel: entry.label,
      resolutionStrategy: "primary-source",
      ok: false,
      extractedTitle: null,
      extractedHeadings: [],
      requirementCueLines: [],
      chooseStatements: [],
      pathwayLabels: [],
      parsedUwCourseCodes: [],
      sourceOnlyUwCourseCodes: [],
      structuredOnlyUwCourseCodes: structuredCourseCodes,
      parsedRequirementAtomCandidates: [],
      parsedDegreeMapBlockCandidates: [],
      parseConfidence: "low",
      snapshotPath: null,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
      error: error.message,
    };
  }
}

function getParseablePrimaryEntries() {
  return TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY.filter(
    (entry) =>
      (entry.ownerType === "major" || entry.ownerType === "pathway") &&
      entry.campusId &&
      entry.campusId !== "grc" &&
      entry.isPrimaryDegreeRequirementsLink &&
      PARSEABLE_PARSER_TYPES.has(entry.parserType)
  ).sort((left, right) => left.ownerTitle.localeCompare(right.ownerTitle));
}

function countBy(values, getKey) {
  return values.reduce((counts, value) => {
    const key = getKey(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function writeGeneratedRequirementSourceAdapters(report) {
  const blocks = report.owners.map((owner) => ({
    id: `${owner.ownerId}:source-block:${slugify(owner.adapterId)}`,
    ownerId: owner.ownerId,
    ownerTitle: owner.ownerTitle,
    planId: owner.planId,
    pathwayId: owner.pathwayId ?? null,
    campusId: owner.campusId,
    primaryParserType: owner.primaryParserType,
    primarySourceUrl: owner.primarySourceUrl,
    primarySourceLabel: owner.primarySourceLabel,
    parserType: owner.parserType,
    adapterId: owner.adapterId,
    adapterFamily: owner.adapterFamily,
    sourceUrl: owner.sourceUrl,
    sourceLabel: owner.sourceLabel,
    resolutionStrategy: owner.resolutionStrategy,
    ok: owner.ok,
    parseConfidence: owner.parseConfidence,
    parsedUwCourseCodes: owner.parsedUwCourseCodes,
    sourceOnlyUwCourseCodes: owner.sourceOnlyUwCourseCodes,
    structuredOnlyUwCourseCodes: owner.structuredOnlyUwCourseCodes,
    requirementCueLines: owner.requirementCueLines,
    chooseStatements: owner.chooseStatements,
    pathwayLabels: owner.pathwayLabels,
    parsedRequirementAtomCandidates: owner.parsedRequirementAtomCandidates,
    parsedDegreeMapBlockCandidates: owner.parsedDegreeMapBlockCandidates,
    snapshotPath: owner.snapshotPath
      ? path.relative(REPO_ROOT, owner.snapshotPath).replace(/\\/g, "/")
      : null,
    usedSnapshotFallback: owner.usedSnapshotFallback,
    snapshotFallbackReason: owner.snapshotFallbackReason,
    error: owner.error,
  }));

  const chunks = [];
  for (let index = 0; index < blocks.length; index += GENERATED_CHUNK_SIZE) {
    chunks.push(blocks.slice(index, index + GENERATED_CHUNK_SIZE));
  }

  const summary = {
    generatedAt: report.generatedAt,
    totalOwners: report.totalOwners,
    okCount: report.okCount,
    failedCount: report.failedCount,
    parsedRequirementSourceBlockCount: blocks.length,
    parsedRequirementAtomCandidateCount: blocks.reduce(
      (count, block) => count + block.parsedRequirementAtomCandidates.length,
      0
    ),
    parsedDegreeMapBlockCandidateCount: blocks.reduce(
      (count, block) => count + block.parsedDegreeMapBlockCandidates.length,
      0
    ),
    snapshotFallbackCount: report.snapshotFallbackCount,
    countsByAdapterId: report.countsByAdapterId,
    countsByAdapterFamily: report.countsByAdapterFamily,
    countsByCampus: report.countsByCampus,
    countsByResolutionStrategy: report.countsByResolutionStrategy,
  };

  const lines = [
    "/* eslint-disable */",
    "/* auto-generated by scripts/planner/parse-transfer-planner-requirement-sources.cjs */",
    "",
    "import type {",
    "  TransferPlannerParsedRequirementSourceBlock,",
    "  TransferPlannerRequirementSourceAdapterSummary,",
    '} from "./schema";',
    "",
    `export const TRANSFER_PLANNER_REQUIREMENT_SOURCE_ADAPTER_SUMMARY = ${JSON.stringify(
      summary,
      null,
      2
    )} as TransferPlannerRequirementSourceAdapterSummary;`,
    "",
  ];

  chunks.forEach((chunk, index) => {
    lines.push(
      `const TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_CHUNK_${index}: unknown[] = ${JSON.stringify(
        chunk,
        null,
        2
      )};`,
      ""
    );
  });

  const chunkNames = chunks.map(
    (_, index) => `  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_CHUNK_${index}`
  );
  lines.push(
    "const TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS_RAW: unknown[] = ([] as unknown[]).concat(",
    `${chunkNames.join(",\n")}`,
    ");",
    "",
    "export const TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS =",
    "  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS_RAW as TransferPlannerParsedRequirementSourceBlock[];",
    ""
  );

  fs.writeFileSync(OUTPUT_TS_PATH, `${lines.join("\n")}\n`);
}

function buildMarkdownReport(report) {
  const lines = [
    "# Transfer Planner Requirement Source Parse Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Primary degree sources parsed: ${report.totalOwners}`,
    `- Parsed successfully: ${report.okCount}`,
    `- Parse failures: ${report.failedCount}`,
    `- Parsed requirement source adapter blocks: ${report.parsedRequirementSourceBlockCount}`,
    `- Parsed requirement atom candidates: ${report.parsedRequirementAtomCandidateCount}`,
    `- Parsed degree-map block candidates: ${report.parsedDegreeMapBlockCandidateCount}`,
    `- Parsed from cached snapshots after live-source failures: ${report.snapshotFallbackCount}`,
    `- Parsed from alternate official source URLs: ${report.countsByResolutionStrategy["alternate-official-source"] ?? 0}`,
    `- Owners with parsed UW course codes: ${report.withParsedCourseCodesCount}`,
    `- Owners with source-only UW course codes not currently in structured degree-map blocks: ${report.withSourceOnlyCourseCodesCount}`,
    `- Owners with no parsed UW course codes: ${report.withNoParsedCourseCodesCount}`,
    "",
    "## Parser Adapters",
    "",
    ...Object.entries(report.countsByAdapterId)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([adapterId, count]) => `- ${adapterId}: ${count}`),
    "",
    "## Resolution Strategies",
    "",
    ...Object.entries(report.countsByResolutionStrategy)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([resolutionStrategy, count]) => `- ${resolutionStrategy}: ${count}`),
    "",
  ];

  for (const campusId of CAMPUS_ORDER) {
    const campusOwners = report.owners.filter((owner) => owner.campusId === campusId);
    if (!campusOwners.length) {
      continue;
    }

    lines.push(`## ${campusId}`, "");

    const driftOwners = campusOwners.filter((owner) => owner.sourceOnlyUwCourseCodes.length > 0);
    if (driftOwners.length) {
      lines.push("### Possible source-vs-structured drift", "");
      driftOwners.slice(0, 50).forEach((owner) => {
        lines.push(`#### ${owner.ownerTitle}`);
        lines.push("");
        lines.push(`- Source: ${owner.sourceUrl}`);
        if (owner.primarySourceUrl !== owner.sourceUrl) {
          lines.push(`- Primary source: ${owner.primarySourceUrl}`);
        }
        lines.push(`- Parser type: ${owner.parserType}`);
        lines.push(`- Parser adapter: ${owner.adapterId}`);
        lines.push(`- Resolution strategy: ${owner.resolutionStrategy}`);
        lines.push(`- Parse confidence: ${owner.parseConfidence}`);
        if (owner.usedSnapshotFallback) {
          lines.push(`- Snapshot fallback: ${owner.snapshotFallbackReason ?? "used cached source snapshot"}`);
        }
        lines.push(`- Source-only UW course codes: ${owner.sourceOnlyUwCourseCodes.join(", ")}`);
        if (owner.structuredOnlyUwCourseCodes.length) {
          lines.push(
            `- Structured-only UW course codes not seen in the parsed source: ${owner.structuredOnlyUwCourseCodes.join(", ")}`
          );
        }
        if (owner.requirementCueLines.length) {
          lines.push(`- Requirement cues: ${owner.requirementCueLines.slice(0, 3).join(" | ")}`);
        }
        lines.push(`- Snapshot: ${owner.snapshotPath ?? "n/a"}`);
        lines.push("");
      });
    }

    const noCourseOwners = campusOwners.filter(
      (owner) => owner.ok && owner.parsedUwCourseCodes.length === 0
    );
    if (noCourseOwners.length) {
      lines.push("### Parsed but no UW course codes found", "");
      noCourseOwners.slice(0, 50).forEach((owner) => {
        lines.push(`- ${owner.ownerTitle}`);
        lines.push(`  - Source: ${owner.sourceUrl}`);
        lines.push(`  - Parser type: ${owner.parserType}`);
        lines.push(`  - Requirement cues found: ${owner.requirementCueLines.length}`);
      });
      lines.push("");
    }

    const failedOwners = campusOwners.filter((owner) => !owner.ok);
    if (failedOwners.length) {
      lines.push("### Parse failures", "");
      failedOwners.slice(0, 50).forEach((owner) => {
        lines.push(`- ${owner.ownerTitle}`);
        lines.push(`  - Source: ${owner.sourceUrl}`);
        lines.push(`  - Error: ${owner.error ?? "unknown error"}`);
      });
      lines.push("");
    }
  }

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

async function main() {
  ensureDir(TMP_DIR);
  ensureDir(SNAPSHOT_DIR);
  const snapshotOnly = hasArg("--snapshot-only");

  const manifestEntries = getParseablePrimaryEntries();
  console.log(`Parsing ${manifestEntries.length} primary planner requirement source(s)...`);
  if (snapshotOnly) {
    console.log("Snapshot-only mode enabled. Reusing cached requirement-source snapshots.");
  }

  const owners = await mapWithConcurrency(
    manifestEntries,
    (entry) => parseManifestEntry(entry, DEFAULT_TIMEOUT_MS, { snapshotOnly }),
    DEFAULT_CONCURRENCY,
    {
      progressLabel: "requirement sources parsed",
      describeItem: (entry) => `${entry.planId}${entry.pathwayId ? `:${entry.pathwayId}` : ""}`,
    }
  );

  const report = {
    generatedAt: new Date().toISOString(),
    totalOwners: owners.length,
    okCount: owners.filter((owner) => owner.ok).length,
    failedCount: owners.filter((owner) => !owner.ok).length,
    parsedRequirementSourceBlockCount: owners.length,
    parsedRequirementAtomCandidateCount: owners.reduce(
      (count, owner) => count + owner.parsedRequirementAtomCandidates.length,
      0
    ),
    parsedDegreeMapBlockCandidateCount: owners.reduce(
      (count, owner) => count + owner.parsedDegreeMapBlockCandidates.length,
      0
    ),
    snapshotFallbackCount: owners.filter((owner) => owner.usedSnapshotFallback).length,
    countsByAdapterId: countBy(owners, (owner) => owner.adapterId),
    countsByAdapterFamily: countBy(owners, (owner) => owner.adapterFamily),
    countsByCampus: countBy(owners, (owner) => owner.campusId),
    countsByResolutionStrategy: countBy(owners, (owner) => owner.resolutionStrategy),
    withParsedCourseCodesCount: owners.filter((owner) => owner.parsedUwCourseCodes.length > 0).length,
    withSourceOnlyCourseCodesCount: owners.filter(
      (owner) => owner.sourceOnlyUwCourseCodes.length > 0
    ).length,
    withNoParsedCourseCodesCount: owners.filter(
      (owner) => owner.ok && owner.parsedUwCourseCodes.length === 0
    ).length,
    owners,
  };

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeGeneratedRequirementSourceAdapters(report);
  buildMarkdownReport(report);

  console.log(`Parsed successfully: ${report.okCount}/${report.totalOwners}`);
  console.log(
    `Parsed from alternate official sources: ${report.countsByResolutionStrategy["alternate-official-source"] ?? 0}`
  );
  console.log(
    `Owners with source-only UW course codes not in structured degree-map blocks: ${report.withSourceOnlyCourseCodesCount}`
  );
  console.log(`Owners with no parsed UW course codes: ${report.withNoParsedCourseCodesCount}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);
  console.log(`Generated adapters: ${OUTPUT_TS_PATH}`);
  console.log(`Snapshots: ${SNAPSHOT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
