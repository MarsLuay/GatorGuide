const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { fetchWithHandling } = require("../lib/fetch-with-handling.cjs");
const { ensureTmpLayout, getTmpPath } = require("../lib/tmp-layout.cjs");
const {
  buildPagedGrcCourseDescriptionsUrl,
  compareAcademicYearLabels,
  extractCurrentGrcCatalogDetails,
  loadGrcPublicMaterials,
} = require("./grc-public-materials.cjs");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = ensureTmpLayout(REPO_ROOT).root;
const SNAPSHOT_DIR = getTmpPath(
  REPO_ROOT,
  "snapshots",
  "transfer-planner-catalog-snapshots"
);
const OUTPUT_JSON_PATH = getTmpPath(
  REPO_ROOT,
  "reports",
  "transfer-planner-grc-catalog-ingest.json"
);
const OUTPUT_MD_PATH = getTmpPath(
  REPO_ROOT,
  "reports",
  "transfer-planner-grc-catalog-ingest.md"
);
const DEFAULT_TIMEOUT_MS = 20000;
const HOST_MIN_DELAY_MS = 900;
const RETRYABLE_STATUS_CODES = new Set([429]);
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 5000;
const MAX_RETRY_DELAY_MS = 60000;
const USER_AGENT = "GatorGuideTransferPlannerCatalogIngest/1.0";
const hostThrottleTails = new Map();
const hostNextAllowedAt = new Map();

const ENTITY_MAP = {
  amp: "&",
  apos: "'",
  nbsp: " ",
  quot: '"',
  "#39": "'",
  "#160": " ",
  "#8211": "-",
  "#8212": "-",
  "#8217": "'",
};
const COURSE_CODE_PATTERN = /\b[A-Z&]{1,8}(?:\s+[A-Z&]{1,8}){0,2}\s+\d{2,3}(?:\.\d+)?[A-Z]?\b/g;
const COURSE_CODE_LEADING_STOPWORDS = new Set([
  "AND",
  "ANY",
  "APPROVED",
  "AT",
  "BEFORE",
  "BETWEEN",
  "DIVISION",
  "FOR",
  "FROM",
  "IN",
  "INTO",
  "LEAST",
  "MINIMUM",
  "OF",
  "ONE",
  "OR",
  "PLUS",
  "THE",
  "THREE",
  "TO",
  "TWO",
  "WITH",
]);
const LEGACY_GRC_CODE_ALIASES = new Map([
  ["MATH& 254", "MATH& 264"],
]);
const GRC_GENERAL_ED_TAG_ORDER = ["COMM", "QSR", "AH", "SSC", "NSC", "DIV"];

function decodeHtmlEntities(value) {
  return String(value ?? "").replace(/&(?:amp|apos|nbsp|quot|#39|#160|#8211|#8212|#8217);/gi, (match) => {
    const key = match.slice(1, -1).toLowerCase();
    return ENTITY_MAP[key] ?? match;
  });
}

function normalizeWhitespace(value) {
  return decodeHtmlEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value) {
  return normalizeWhitespace(String(value ?? "").replace(/<[^>]+>/g, " "));
}

function normalizeCourseCode(value) {
  const normalized = normalizeWhitespace(value)
    .toUpperCase()
    .replace(/\s+/g, " ");
  return LEGACY_GRC_CODE_ALIASES.get(normalized) ?? normalized;
}

function sortCourseCodes(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function uniqueGrcGeneralEducationCategories(values = []) {
  const byKey = new Map();
  for (const category of values) {
    const catalogYearLabel = normalizeWhitespace(category?.catalogYearLabel);
    const label = normalizeWhitespace(category?.label);
    const tags = GRC_GENERAL_ED_TAG_ORDER.filter((tag) =>
      (category?.tags ?? []).includes(tag)
    );
    if (!catalogYearLabel || !label || !tags.length) {
      continue;
    }
    byKey.set(`${catalogYearLabel}|${label}|${tags.join(",")}`, {
      catalogYearLabel,
      label,
      tags,
    });
  }

  return [...byKey.values()].sort(
    (left, right) =>
      compareAcademicYearLabels(left.catalogYearLabel, right.catalogYearLabel) ||
      left.label.localeCompare(right.label)
  );
}

function normalizeCoursePath(values) {
  return sortCourseCodes(
    [...new Set((values ?? []).map((value) => normalizeCourseCode(value)).filter(Boolean))]
  );
}

function mergeAlternativeCourseCodeSets(left = [], right = []) {
  const byKey = new Map();
  for (const courseSet of [...left, ...right]) {
    const normalizedSet = normalizeCoursePath(courseSet);
    if (!normalizedSet.length) {
      continue;
    }
    byKey.set(normalizedSet.join("|"), normalizedSet);
  }
  return [...byKey.values()].sort((a, b) => a.join("|").localeCompare(b.join("|")));
}

function expandCourseCodeSlashShorthand(value) {
  let expanded = normalizeWhitespace(value);
  let previousValue = "";

  while (expanded !== previousValue) {
    previousValue = expanded;
    expanded = expanded.replace(
      /\b([A-Z&]{1,8}(?:\s+[A-Z&]{1,8}){0,2})\s+(\d{2,3}[A-Z]?)(\s*(?:\/\s*\d{2,3}[A-Z]?)+)\b/g,
      (_match, subject, firstNumber, trailingNumbers) => {
        const normalizedSubject = normalizeWhitespace(subject);
        const numbers = [
          firstNumber,
          ...String(trailingNumbers)
            .split("/")
            .map((part) => normalizeWhitespace(part))
            .filter(Boolean),
        ];
        return numbers.map((number) => `${normalizedSubject} ${number}`).join(" or ");
      }
    );
  }

  return expanded;
}

function getCourseCodeMatches(value) {
  const matches = [];
  COURSE_CODE_PATTERN.lastIndex = 0;
  let match;

  while ((match = COURSE_CODE_PATTERN.exec(String(value ?? ""))) !== null) {
    const code = normalizeCourseCode(match[0]);
    const subject = code.replace(/\s+\d{2,3}(?:\.\d+)?[A-Z]?$/, "");
    const leadingToken = subject.split(/\s+/)[0] ?? "";
    if (COURSE_CODE_LEADING_STOPWORDS.has(leadingToken)) {
      continue;
    }

    matches.push({
      code,
      index: match.index,
      end: match.index + match[0].length,
    });
  }

  return matches;
}

function shouldIgnoreCourseCodeMatch(text, match) {
  const boundaryStart = Math.max(
    text.lastIndexOf(";", match.index),
    text.lastIndexOf(".", match.index),
    text.lastIndexOf(":", match.index),
    text.lastIndexOf("(", match.index)
  );
  const before = text.slice(boundaryStart + 1, match.index).toLowerCase();
  const after = text.slice(match.end, Math.min(text.length, match.end + 80)).toLowerCase();

  if (/\beligible for\s*$/.test(before)) {
    return true;
  }
  if (/\bequivalent of\s*$/.test(before)) {
    return true;
  }
  if (/\badmission (?:into|to)\s*$/.test(before)) {
    return true;
  }
  if (/\byears?\s+in high school\b/.test(after)) {
    return true;
  }

  return false;
}

function getSafeCourseCodeMatches(value) {
  const normalized = expandCourseCodeSlashShorthand(normalizeWhitespace(value));
  return getCourseCodeMatches(normalized).filter((match) => !shouldIgnoreCourseCodeMatch(normalized, match));
}

function getCourseCodeSubject(value) {
  return normalizeCourseCode(value).replace(/\s+\d{2,3}(?:\.\d+)?[A-Z]?$/, "");
}

function hasAlternativeBoundary(text) {
  const normalized = normalizeWhitespace(text).toLowerCase();
  if (!normalized) {
    return false;
  }

  const cleaned = normalized
    .replace(
      /\bor\s+(?:higher|lower|better|concurrent enrollment|instructor(?:'s)?|permission|consent|appropriate|equivalent)\b/g,
      " "
    )
    // Phrases like "or in a high school physics" or "or one year of high school algebra"
    // describe external preparation alternatives, not a new course-code branch.
    .replace(/\bor\s+(?:in\s+)?(?:a\s+|an\s+)?high school\b[^,;)]*/g, " ")
    .replace(/\bor\s+(?:one|two|three|1\s*1\/2|1-1\/2|\d+)\s+years?\s+of high school\b[^,;)]*/g, " ")
    .replace(/\bor\s+(?:appropriate\s+)?(?:english|math|reading)\s+placement\b[^,;)]*/g, " ")
    .replace(/\bor\s+eligible for\b[^,;)]*/g, " ");
  return /\bor\b/.test(cleaned);
}

function applySharedPrefixToAlternativePaths(paths) {
  if (paths.length < 2 || paths[0].length < 2) {
    return paths;
  }

  const prefix = paths[0].slice(0, -1);
  const anchorSubject = getCourseCodeSubject(paths[0][paths[0].length - 1]);
  if (!prefix.length || !anchorSubject) {
    return paths;
  }

  const laterPathsShareSubject = paths
    .slice(1)
    .every((path) => path.length === 1 && getCourseCodeSubject(path[0]) === anchorSubject);
  if (!laterPathsShareSubject) {
    return paths;
  }

  return [
    paths[0],
    ...paths.slice(1).map((path) => normalizeCoursePath([...prefix, ...path])),
  ];
}

function uniqueCoursePaths(paths) {
  const byKey = new Map();
  for (const path of paths) {
    const normalizedPath = normalizeCoursePath(path);
    if (!normalizedPath.length) {
      continue;
    }
    byKey.set(normalizedPath.join("|"), normalizedPath);
  }
  return [...byKey.values()].sort((a, b) => a.join("|").localeCompare(b.join("|")));
}

function removeOverlappingRequirementPaths(paths, overlappingPaths) {
  if (!paths.length || !overlappingPaths.length) {
    return paths;
  }

  const overlappingKeys = new Set(overlappingPaths.map((path) => path.join("|")));
  return paths.filter((path) => !overlappingKeys.has(path.join("|")));
}

function crossCombineCoursePaths(leftPaths, rightPaths) {
  if (!leftPaths.length) {
    return uniqueCoursePaths(rightPaths);
  }
  if (!rightPaths.length) {
    return uniqueCoursePaths(leftPaths);
  }

  return uniqueCoursePaths(
    leftPaths.flatMap((leftPath) =>
      rightPaths.map((rightPath) => [...leftPath, ...rightPath])
    )
  );
}

function parseSimpleCoursePathsFromExpression(expression) {
  const normalizedExpression = expandCourseCodeSlashShorthand(normalizeWhitespace(expression));
  const matches = getSafeCourseCodeMatches(normalizedExpression);
  if (!matches.length) {
    return [];
  }

  const segments = [[matches[0].code]];
  for (let index = 1; index < matches.length; index += 1) {
    const previousMatch = matches[index - 1];
    const currentMatch = matches[index];
    const between = normalizedExpression.slice(previousMatch.end, currentMatch.index);
    if (hasAlternativeBoundary(between)) {
      segments.push([currentMatch.code]);
    } else {
      segments[segments.length - 1].push(currentMatch.code);
    }
  }

  return uniqueCoursePaths(applySharedPrefixToAlternativePaths(segments));
}

function parseCoursePathsFromExpression(expression) {
  const normalizedExpression = expandCourseCodeSlashShorthand(normalizeWhitespace(expression));
  const parentheticalMatch = normalizedExpression.match(/\(([^()]+)\)/);
  if (!parentheticalMatch) {
    return parseSimpleCoursePathsFromExpression(normalizedExpression);
  }

  const innerPaths = parseSimpleCoursePathsFromExpression(parentheticalMatch[1]);
  const outerExpression = normalizeWhitespace(
    `${normalizedExpression.slice(0, parentheticalMatch.index)} ${normalizedExpression.slice(
      parentheticalMatch.index + parentheticalMatch[0].length
    )}`
  );
  const outerPaths = parseSimpleCoursePathsFromExpression(outerExpression);

  if (innerPaths.length && outerPaths.length) {
    return crossCombineCoursePaths(innerPaths, outerPaths);
  }
  if (innerPaths.length) {
    return innerPaths;
  }
  return outerPaths;
}

function extractExplicitConcurrentEnrollmentPaths(chunk) {
  let remainder = normalizeWhitespace(chunk);
  const explicitCorequisitePaths = [];

  remainder = remainder.replace(
    /\(\s*([^()]+?)\s+or\s+concurrent enrollment\s*\)/gi,
    (_match, expression) => {
      explicitCorequisitePaths.push(...parseCoursePathsFromExpression(expression));
      return " ";
    }
  );

  remainder = remainder.replace(
    /\b(?:at least\s+)?concurrent enrollment in or completion of\s+([^;.,]+)/gi,
    (_match, expression) => {
      explicitCorequisitePaths.push(...parseCoursePathsFromExpression(expression));
      return " ";
    }
  );

  remainder = remainder.replace(
    /\b(?:at least\s+)?concurrent enrollment(?:\s+or\s+completion)? in\s+([^;.,]+)/gi,
    (_match, expression) => {
      explicitCorequisitePaths.push(...parseCoursePathsFromExpression(expression));
      return " ";
    }
  );

  return {
    remainder: normalizeWhitespace(remainder),
    explicitCorequisitePaths: uniqueCoursePaths(explicitCorequisitePaths),
  };
}

function mergeRequirementPaths(existingPaths, incomingPaths, joiner) {
  if (!incomingPaths.length) {
    return existingPaths;
  }
  if (!existingPaths.length) {
    return uniqueCoursePaths(incomingPaths);
  }
  if (joiner === "or") {
    return uniqueCoursePaths([...existingPaths, ...incomingPaths]);
  }
  return crossCombineCoursePaths(existingPaths, incomingPaths);
}

function materializeParsedRequirementFields(prerequisitePaths, corequisitePaths) {
  const result = {
    prerequisiteCourseCodes: [],
    prerequisiteAlternativeCourseCodeSets: [],
    corequisiteCourseCodes: [],
    corequisiteAlternativeCourseCodeSets: [],
  };

  if (prerequisitePaths.length === 1) {
    result.prerequisiteCourseCodes = [...prerequisitePaths[0]];
  } else if (prerequisitePaths.length > 1) {
    result.prerequisiteAlternativeCourseCodeSets = prerequisitePaths.map((path) => [...path]);
  }

  if (corequisitePaths.length === 1) {
    result.corequisiteCourseCodes = [...corequisitePaths[0]];
  } else if (corequisitePaths.length > 1) {
    result.corequisiteAlternativeCourseCodeSets = corequisitePaths.map((path) => [...path]);
  }

  return {
    ...result,
    hasStructuredRequirementFields:
      result.prerequisiteCourseCodes.length > 0 ||
      result.prerequisiteAlternativeCourseCodeSets.length > 0 ||
      result.corequisiteCourseCodes.length > 0 ||
      result.corequisiteAlternativeCourseCodeSets.length > 0,
  };
}

function extractStructuredRequirementPaths(courseCodes, alternativeCourseCodeSets) {
  const directPath = normalizeCoursePath(courseCodes);
  return uniqueCoursePaths([
    ...(directPath.length ? [directPath] : []),
    ...(alternativeCourseCodeSets ?? []),
  ]);
}

function materializeStructuredRequirementPaths(paths) {
  const normalizedPaths = uniqueCoursePaths(paths);
  if (normalizedPaths.length === 1) {
    return {
      courseCodes: [...normalizedPaths[0]],
      alternativeCourseCodeSets: [],
    };
  }

  return {
    courseCodes: [],
    alternativeCourseCodeSets: normalizedPaths.map((path) => [...path]),
  };
}

function mergeStructuredRequirementFields(existing, incoming, prefix) {
  const courseCodesKey = `${prefix}CourseCodes`;
  const alternativeCourseCodeSetsKey = `${prefix}AlternativeCourseCodeSets`;
  const mergedPaths = uniqueCoursePaths([
    ...extractStructuredRequirementPaths(
      existing?.[courseCodesKey],
      existing?.[alternativeCourseCodeSetsKey]
    ),
    ...extractStructuredRequirementPaths(
      incoming?.[courseCodesKey],
      incoming?.[alternativeCourseCodeSetsKey]
    ),
  ]);
  const materialized = materializeStructuredRequirementPaths(mergedPaths);

  return {
    [courseCodesKey]: materialized.courseCodes,
    [alternativeCourseCodeSetsKey]: materialized.alternativeCourseCodeSets,
  };
}

function parseGrcEnrollmentRequirementText(value) {
  const normalizedText = expandCourseCodeSlashShorthand(
    normalizeWhitespace(String(value ?? "").split(/\bRecommended\s*:/i)[0])
  );
  if (!normalizedText) {
    return materializeParsedRequirementFields([], []);
  }

  const chunks = normalizedText
    .split(/(?:;|\.(?=\s|$))/)
    .map((chunk) => normalizeWhitespace(chunk))
    .filter(Boolean);

  let prerequisitePaths = [];
  let corequisitePaths = [];

  for (const rawChunk of chunks) {
    const joiner = /^\s*or\b/i.test(rawChunk) ? "or" : "and";
    const chunk = normalizeWhitespace(rawChunk.replace(/^\s*(?:and|or)\s+/i, ""));
    if (!chunk) {
      continue;
    }

    const { remainder, explicitCorequisitePaths } = extractExplicitConcurrentEnrollmentPaths(chunk);
    const chunkPaths = parseCoursePathsFromExpression(remainder);
    if (!chunkPaths.length) {
      if (explicitCorequisitePaths.length) {
        if (joiner === "or" && prerequisitePaths.length > 0) {
          prerequisitePaths = removeOverlappingRequirementPaths(
            prerequisitePaths,
            explicitCorequisitePaths
          );
        }
        corequisitePaths = mergeRequirementPaths(
          corequisitePaths,
          explicitCorequisitePaths,
          joiner
        );
      }
      continue;
    }

    if (explicitCorequisitePaths.length) {
      if (joiner === "or" && prerequisitePaths.length > 0) {
        prerequisitePaths = removeOverlappingRequirementPaths(
          prerequisitePaths,
          explicitCorequisitePaths
        );
      }

      prerequisitePaths = mergeRequirementPaths(
        prerequisitePaths,
        removeOverlappingRequirementPaths(chunkPaths, explicitCorequisitePaths),
        joiner
      );
      corequisitePaths = mergeRequirementPaths(
        corequisitePaths,
        explicitCorequisitePaths,
        joiner
      );
      continue;
    }

    if (/\bconcurrent enrollment\b/i.test(chunk)) {
      if (joiner === "or" && prerequisitePaths.length > 0) {
        const prerequisitePathKeys = new Set(prerequisitePaths.map((path) => path.join("|")));
        const overlappingCorequisitePaths = chunkPaths.filter((path) =>
          prerequisitePathKeys.has(path.join("|"))
        );
        if (overlappingCorequisitePaths.length > 0) {
          const overlappingKeys = new Set(
            overlappingCorequisitePaths.map((path) => path.join("|"))
          );
          prerequisitePaths = prerequisitePaths.filter(
            (path) => !overlappingKeys.has(path.join("|"))
          );
          corequisitePaths = mergeRequirementPaths(
            corequisitePaths,
            overlappingCorequisitePaths,
            "or"
          );
        }
        continue;
      }

      corequisitePaths = mergeRequirementPaths(corequisitePaths, chunkPaths, joiner);
      continue;
    }

    prerequisitePaths = mergeRequirementPaths(prerequisitePaths, chunkPaths, joiner);
  }

  return materializeParsedRequirementFields(prerequisitePaths, corequisitePaths);
}

function parseGrcCorequisiteText(value) {
  const normalizedText = expandCourseCodeSlashShorthand(normalizeWhitespace(value));
  if (!normalizedText) {
    return materializeParsedRequirementFields([], []);
  }

  const chunks = normalizedText
    .split(/(?:;|\.(?=\s|$))/)
    .map((chunk) => normalizeWhitespace(chunk))
    .filter(Boolean);

  let corequisitePaths = [];
  for (const rawChunk of chunks) {
    const joiner = /^\s*or\b/i.test(rawChunk) ? "or" : "and";
    const chunk = normalizeWhitespace(rawChunk.replace(/^\s*(?:and|or)\s+/i, ""));
    if (!chunk) {
      continue;
    }

    const chunkPaths = parseCoursePathsFromExpression(chunk);
    if (!chunkPaths.length) {
      continue;
    }

    corequisitePaths = mergeRequirementPaths(corequisitePaths, chunkPaths, joiner);
  }

  return materializeParsedRequirementFields([], corequisitePaths);
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function getCatalogSnapshotPath(catalogYearLabel) {
  return path.resolve(
    SNAPSHOT_DIR,
    `grc-course-descriptions-${catalogYearLabel}.html`
  );
}

function getUrlHost(value) {
  try {
    return new URL(value).host.toLowerCase();
  } catch (_error) {
    return "unknown-host";
  }
}

function getHeaderValue(response, name) {
  return response.headers.get(name) ?? null;
}

function parseRetryAfterMs(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const seconds = Number.parseInt(raw, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const retryAt = Date.parse(raw);
  if (Number.isFinite(retryAt)) {
    return Math.max(0, retryAt - Date.now());
  }

  return null;
}

async function fetchWithTimeout(url, timeoutMs) {
  return fetchWithHandling(url, {
    operation: "Fetch GRC catalog source",
    throwOnHttpError: false,
    timeoutMs,
    userAgent: USER_AGENT,
  });
}

function createFetchError(url, message, status = null, retryAfterMs = null) {
  const error = new Error(message);
  error.url = url;
  error.status = status;
  error.retryAfterMs = retryAfterMs;
  return error;
}

function shouldRetryFetch(error) {
  if (!error) {
    return false;
  }

  if (RETRYABLE_STATUS_CODES.has(error.status)) {
    return true;
  }

  return error.status == null && Boolean(error.message);
}

function getRetryDelayMs(attemptIndex) {
  return Math.min(
    MAX_RETRY_DELAY_MS,
    Math.max(DEFAULT_RETRY_DELAY_MS * 2 ** attemptIndex, HOST_MIN_DELAY_MS * Math.max(2, attemptIndex + 2))
  );
}

function getRetryDelayForErrorMs(error, attemptIndex) {
  return Math.min(
    MAX_RETRY_DELAY_MS,
    Math.max(getRetryDelayMs(attemptIndex), error?.retryAfterMs ?? 0)
  );
}

function extendHostCooldown(host, delayMs) {
  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return;
  }

  const nextAllowedAt = Date.now() + delayMs;
  hostNextAllowedAt.set(host, Math.max(hostNextAllowedAt.get(host) ?? 0, nextAllowedAt));
}

function runWithHostThrottle(url, task) {
  const host = getUrlHost(url);
  const previousTail = hostThrottleTails.get(host) ?? Promise.resolve();
  const resultPromise = previousTail.catch(() => undefined).then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, (hostNextAllowedAt.get(host) ?? 0) - now);
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    try {
      return await task(host);
    } finally {
      extendHostCooldown(host, HOST_MIN_DELAY_MS);
    }
  });

  hostThrottleTails.set(
    host,
    resultPromise.then(
      () => undefined,
      () => undefined
    )
  );

  return resultPromise;
}

async function fetchTextOnce(url, timeoutMs) {
  let response;
  try {
    response = await fetchWithTimeout(url, timeoutMs);
  } catch (error) {
    throw createFetchError(url, error.message ?? `Failed to fetch ${url}`, null, null);
  }

  const retryAfterMs = parseRetryAfterMs(getHeaderValue(response, "retry-after"));
  if (!response.ok) {
    throw createFetchError(
      url,
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
      response.status,
      retryAfterMs
    );
  }

  try {
    return await response.text();
  } catch (error) {
    throw createFetchError(url, error.message ?? `Failed to read response body for ${url}`, null, retryAfterMs);
  }
}

async function fetchText(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const label = String(options.label ?? url);

  return runWithHostThrottle(url, async (host) => {
    let lastError = null;

    for (let attemptIndex = 0; attemptIndex <= MAX_RETRY_ATTEMPTS; attemptIndex += 1) {
      try {
        return await fetchTextOnce(url, timeoutMs);
      } catch (error) {
        lastError = error;
        if (!shouldRetryFetch(error) || attemptIndex === MAX_RETRY_ATTEMPTS) {
          throw error;
        }

        const retryDelayMs = getRetryDelayForErrorMs(error, attemptIndex);
        const retryReason =
          error.status != null ? `status ${error.status}` : error.message ?? "temporary fetch error";
        console.log(
          `Backing off ${Math.ceil(retryDelayMs / 1000)}s before retry ${attemptIndex + 1}/${MAX_RETRY_ATTEMPTS} for ${label} (${retryReason})`
        );
        extendHostCooldown(host, retryDelayMs);
        await sleep(retryDelayMs);
      }
    }

    throw lastError ?? createFetchError(url, `Failed to fetch ${url}`);
  });
}

function readSnapshotFallback(snapshotPath, error) {
  if (!fs.existsSync(snapshotPath)) {
    throw error;
  }

  console.log(
    `Live Green River catalog fetch failed; using cached snapshot at ${snapshotPath}.`
  );
  console.log(`Fetch error: ${error.message}`);

  return {
    html: fs.readFileSync(snapshotPath, "utf8"),
    usedSnapshotFallback: true,
    snapshotFallbackReason: error.message,
  };
}

function readCatalogSnapshot(snapshotPath, fallbackReason) {
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(
      `Cached Green River catalog snapshot is required in no-download mode, but ${snapshotPath} was not found.`
    );
  }

  const html = fs.readFileSync(snapshotPath, "utf8");
  return {
    html,
    pageCount: detectCatalogPageNumbers(html).length,
    usedSnapshotFallback: true,
    snapshotFallbackReason: fallbackReason,
  };
}

async function fetchCatalogHtml(courseDescriptionsExpandedUrl, snapshotPath) {
  try {
    const firstPageHtml = await fetchText(courseDescriptionsExpandedUrl, {
      label: "Green River catalog page 1",
    });
    const pageNumbers = detectCatalogPageNumbers(firstPageHtml);
    const pageHtmls = [{ pageNumber: 1, html: firstPageHtml }];
    console.log(
      `[1/${pageNumbers.length}] Green River catalog pages fetched - ${courseDescriptionsExpandedUrl}`
    );

    for (let pageIndex = 1; pageIndex < pageNumbers.length; pageIndex += 1) {
      const pageNumber = pageNumbers[pageIndex];
      const pageUrl = buildPagedCourseDescriptionUrl(courseDescriptionsExpandedUrl, pageNumber);
      const html = await fetchText(pageUrl, {
        label: `Green River catalog page ${pageNumber}`,
      });
      pageHtmls.push({ pageNumber, html });
      console.log(
        `[${pageIndex + 1}/${pageNumbers.length}] Green River catalog pages fetched - ${pageUrl}`
      );
    }

    const html = pageHtmls.map((page) => page.html).join("\n");
    fs.writeFileSync(snapshotPath, html);

    return {
      html,
      pageCount: pageHtmls.length,
      usedSnapshotFallback: false,
      snapshotFallbackReason: null,
    };
  } catch (error) {
    const fallback = readSnapshotFallback(snapshotPath, error);
    return {
      html: fallback.html,
      pageCount: detectCatalogPageNumbers(fallback.html).length,
      usedSnapshotFallback: fallback.usedSnapshotFallback,
      snapshotFallbackReason: fallback.snapshotFallbackReason,
    };
  }
}

function buildPagedCourseDescriptionUrl(courseDescriptionsExpandedUrl, pageNumber) {
  return buildPagedGrcCourseDescriptionsUrl(courseDescriptionsExpandedUrl, pageNumber);
}

function detectCatalogPageNumbers(html) {
  const pageNumbers = new Set([1]);
  for (const match of html.matchAll(/filter%5Bcpage%5D=(\d+)/g)) {
    pageNumbers.add(Number.parseInt(match[1], 10));
  }
  const maxPageNumber = Math.max(...pageNumbers);
  if (Number.isFinite(maxPageNumber) && maxPageNumber > 1) {
    for (let pageNumber = 1; pageNumber <= maxPageNumber; pageNumber += 1) {
      pageNumbers.add(pageNumber);
    }
  }
  return [...pageNumbers].filter(Number.isFinite).sort((left, right) => left - right);
}

function extractLabeledSectionText(rawBody, label) {
  const pattern = new RegExp(
    `<strong>\\s*${label}\\s*:<\\/strong>([\\s\\S]*?)(?=<br\\s*\\/?>\\s*<br\\s*\\/?>\\s*<strong>|<strong>\\s*(?:Course Fee|Course Outcomes|Program Outcomes|College-wide Outcomes)\\s*:<\\/strong>|$)`,
    "i"
  );
  const match = rawBody.match(pattern);
  return match ? stripHtml(match[1]) : null;
}

function extractCredits(rawBody) {
  const match = rawBody.match(/Credits:\s*([^<\r\n]+)/i);
  const creditLabel = match ? normalizeWhitespace(match[1]) : null;
  const numericMatch = creditLabel?.match(/^(\d+(?:\.\d+)?)$/);
  return {
    creditLabel,
    creditValue: numericMatch ? Number.parseFloat(numericMatch[1]) : null,
  };
}

function extractCourseDescription(rawBody) {
  const withoutCredits = rawBody.replace(/^\s*Credits:\s*[^<\r\n]+/i, "");
  const beforeRequirement = withoutCredits.split(/<br\s*\/?>\s*<br\s*\/?>\s*<strong>\s*(?:Enrollment Requirement|Satisfies Requirement|Course Fee|Course Outcomes|Program Outcomes|College-wide Outcomes)\s*:/i)[0];
  const description = stripHtml(beforeRequirement);
  return description || null;
}

function classifyGrcGeneralEducationRequirementTags(value) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) {
    return [];
  }

  const tags = new Set();
  if (/\bbasic skills\s*\/\s*communication\b|\bwritten communication\b/.test(normalized)) {
    tags.add("COMM");
  }
  if (/\bquantitative\b|\bsymbolic reasoning\b|\bquantitative skills\b|\bbasic skills requirement\b/.test(normalized)) {
    tags.add("QSR");
  }
  if (/\bhumanities\b|\bfine arts\b|\benglish\b/.test(normalized)) {
    tags.add("AH");
  }
  if (/\bsocial science\b|\bsocial sciences\b/.test(normalized)) {
    tags.add("SSC");
  }
  if (/\bnatural science\b|\bnatural sciences\b|\blab science\b/.test(normalized)) {
    tags.add("NSC");
  }
  if (/\bdiversity\b/.test(normalized)) {
    tags.add("DIV");
  }

  return GRC_GENERAL_ED_TAG_ORDER.filter((tag) => tags.has(tag));
}

function buildCourseEntries(html, catalogYearLabel, courseDescriptionsSourceUrl) {
  const headingPattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const headings = [...html.matchAll(headingPattern)];
  const entries = [];

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const nextHeading = headings[index + 1];
    const headingText = stripHtml(heading[1]);
    const titleMatch = headingText.match(/^(.+?)\s+-\s+(.+)$/);

    if (!titleMatch) {
      continue;
    }

    const rawCode = normalizeCourseCode(titleMatch[1]);
    const title = normalizeWhitespace(titleMatch[2]);
    if (!/^[A-Z0-9 &]+\s+\d{1,3}(?:\.\d+)?[A-Z]?$/.test(rawCode)) {
      continue;
    }

    const bodyStart = heading.index + heading[0].length;
    const bodyEnd = nextHeading?.index ?? html.length;
    const rawBody = html.slice(bodyStart, bodyEnd);
    const credits = extractCredits(rawBody);
    const enrollmentRequirement = extractLabeledSectionText(rawBody, "Enrollment Requirement");
    const corequisiteRequirement = extractLabeledSectionText(rawBody, "Corequisite");
    const satisfiesRequirement = extractLabeledSectionText(rawBody, "Satisfies Requirement");
    const description = extractCourseDescription(rawBody);
    const parsedEnrollmentRequirement = parseGrcEnrollmentRequirementText(enrollmentRequirement);
    const parsedCorequisiteRequirement = parseGrcCorequisiteText(corequisiteRequirement);
    const grcGeneralEducationTags =
      classifyGrcGeneralEducationRequirementTags(satisfiesRequirement);
    const hasStructuredRequirementFields =
      parsedEnrollmentRequirement.hasStructuredRequirementFields ||
      parsedCorequisiteRequirement.hasStructuredRequirementFields;
    const sourceUrl = `${courseDescriptionsSourceUrl}#${rawCode
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}`;

    entries.push({
      schoolId: "grc",
      code: rawCode,
      title,
      creditValue: credits.creditValue,
      creditLabel: credits.creditLabel,
      catalogDescription: description,
      ...(grcGeneralEducationTags.length
        ? {
            grcGeneralEducationCategories: [
              {
                catalogYearLabel,
                label: satisfiesRequirement,
                tags: grcGeneralEducationTags,
              },
            ],
          }
        : {}),
      prerequisiteCourseCodes: uniqueStrings([
        ...(parsedEnrollmentRequirement.prerequisiteCourseCodes ?? []),
      ]),
      prerequisiteAlternativeCourseCodeSets: mergeAlternativeCourseCodeSets(
        [],
        parsedEnrollmentRequirement.prerequisiteAlternativeCourseCodeSets
      ),
      prerequisiteNotes: enrollmentRequirement
        ? [
            `Official Green River enrollment requirement text: ${enrollmentRequirement}`,
            ...(!hasStructuredRequirementFields
              ? [
                  "requirement text is preserved as a note until a parser can safely normalize AND/OR/instructor-consent semantics into graph prerequisites.",
                ]
              : []),
          ]
        : [],
      corequisiteCourseCodes: uniqueStrings([
        ...(parsedEnrollmentRequirement.corequisiteCourseCodes ?? []),
        ...(parsedCorequisiteRequirement.corequisiteCourseCodes ?? []),
      ]),
      corequisiteAlternativeCourseCodeSets: mergeAlternativeCourseCodeSets(
        parsedEnrollmentRequirement.corequisiteAlternativeCourseCodeSets,
        parsedCorequisiteRequirement.corequisiteAlternativeCourseCodeSets
      ),
      corequisiteNotes: corequisiteRequirement
        ? [`Official Green River corequisite text: ${corequisiteRequirement}`]
        : [],
      effectiveYearRanges: [
        {
          startLabel: catalogYearLabel,
          endLabel: catalogYearLabel,
          note: "Parsed from the official Green River online catalog course descriptions.",
        },
      ],
      sourceLinks: [
        {
          label: `Green River online catalog course descriptions ${catalogYearLabel}`,
          url: sourceUrl,
          note: "Course detail parsed from the official Green River catalog course descriptions page.",
        },
      ],
      notes: [
        "Green River catalog metadata parsed from the official online course descriptions.",
      ],
    });
  }

  return entries.sort((left, right) => left.code.localeCompare(right.code));
}

function mergeRanges(left = [], right = []) {
  const byKey = new Map();
  for (const range of [...left, ...right]) {
    byKey.set(`${range.startLabel}|${range.endLabel ?? ""}|${range.note ?? ""}`, range);
  }
  return [...byKey.values()].sort((a, b) => compareAcademicYearLabels(a.startLabel, b.startLabel));
}

function mergeLinks(left = [], right = []) {
  const byUrl = new Map();
  for (const link of [...left, ...right]) {
    if (link?.url) {
      byUrl.set(link.url, link);
    }
  }
  return [...byUrl.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function mergeCourseEntries(entries) {
  const byCode = new Map();
  for (const entry of entries) {
    const key = `${entry.schoolId}|${entry.code}`;
    const existing = byCode.get(key);
    const normalizedPrerequisiteFields = mergeStructuredRequirementFields(
      {},
      entry,
      "prerequisite"
    );
    const normalizedCorequisiteFields = mergeStructuredRequirementFields(
      {},
      entry,
      "corequisite"
    );
    if (!existing) {
      byCode.set(key, {
        ...entry,
        ...normalizedPrerequisiteFields,
        prerequisiteNotes: [...(entry.prerequisiteNotes ?? [])],
        grcGeneralEducationCategories: uniqueGrcGeneralEducationCategories(
          entry.grcGeneralEducationCategories
        ),
        ...normalizedCorequisiteFields,
        corequisiteNotes: [...(entry.corequisiteNotes ?? [])],
        effectiveYearRanges: [...(entry.effectiveYearRanges ?? [])],
        sourceLinks: [...(entry.sourceLinks ?? [])],
        notes: [...(entry.notes ?? [])],
      });
      continue;
    }

    const mergedPrerequisiteFields = mergeStructuredRequirementFields(
      existing,
      entry,
      "prerequisite"
    );
    const mergedCorequisiteFields = mergeStructuredRequirementFields(
      existing,
      entry,
      "corequisite"
    );

    byCode.set(key, {
      ...existing,
      title: entry.title ?? existing.title ?? null,
      creditValue:
        entry.creditValue !== undefined && entry.creditValue !== null
          ? entry.creditValue
          : existing.creditValue ?? null,
      creditLabel: entry.creditLabel ?? existing.creditLabel ?? null,
      catalogDescription: entry.catalogDescription ?? existing.catalogDescription ?? null,
      ...mergedPrerequisiteFields,
      prerequisiteNotes: uniqueStrings([
        ...(existing.prerequisiteNotes ?? []),
        ...(entry.prerequisiteNotes ?? []),
      ]),
      grcGeneralEducationCategories: uniqueGrcGeneralEducationCategories([
        ...(existing.grcGeneralEducationCategories ?? []),
        ...(entry.grcGeneralEducationCategories ?? []),
      ]),
      ...mergedCorequisiteFields,
      corequisiteNotes: uniqueStrings([
        ...(existing.corequisiteNotes ?? []),
        ...(entry.corequisiteNotes ?? []),
      ]),
      effectiveYearRanges: mergeRanges(existing.effectiveYearRanges, entry.effectiveYearRanges),
      sourceLinks: mergeLinks(existing.sourceLinks, entry.sourceLinks),
      notes: uniqueStrings([...(existing.notes ?? []), ...(entry.notes ?? [])]),
    });
  }

  return [...byCode.values()].sort((left, right) => left.code.localeCompare(right.code));
}

function writeMarkdown(report) {
  const lines = [
    "# Green River Catalog Ingest",
    "",
    `Generated: ${report.generatedAt}`,
    `Catalog years: ${report.catalogYearLabels.join(", ")}`,
    `Source fingerprint: ${report.sourceFingerprint}`,
    "",
    `- Catalog roots parsed: ${report.catalogRootCount}`,
    `- Catalog pages parsed: ${report.pageCount}`,
    `- Catalog years parsed: ${report.catalogYearLabels.length}`,
    `- Used cached snapshot fallback: ${report.usedSnapshotFallback ? "yes" : "no"}`,
    ...(report.snapshotFallbackYears.length
      ? [`- Snapshot fallback years: ${report.snapshotFallbackYears.join(", ")}`]
      : []),
    `- Courses parsed: ${report.courseCount}`,
    `- Courses with credit labels: ${report.coursesWithCreditLabels}`,
    `- Courses with enrollment requirement notes: ${report.coursesWithEnrollmentRequirementNotes}`,
    `- Courses with structured prerequisite paths: ${report.coursesWithStructuredPrerequisitePaths}`,
    `- Courses with GRC general-education categories: ${report.coursesWithGrcGeneralEducationCategories}`,
    `- GRC general-education category counts: ${Object.entries(
      report.grcGeneralEducationCategoryCounts ?? {}
    )
      .map(([tag, count]) => `${tag}: ${count}`)
      .join(", ")}`,
    `- Courses with corequisite notes: ${report.coursesWithCorequisiteNotes}`,
    `- Courses with structured corequisite paths: ${report.coursesWithStructuredCorequisitePaths}`,
    "",
  ];

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function loadCachedCatalogIngestReport() {
  if (!fs.existsSync(OUTPUT_JSON_PATH)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(OUTPUT_JSON_PATH, "utf8"));
  } catch (_error) {
    return null;
  }
}

function getCachedCatalogIngestSource(cachedReport, catalogEntry, fieldName) {
  const labels = Array.isArray(cachedReport?.catalogYearLabels)
    ? cachedReport.catalogYearLabels
    : [];
  const values = Array.isArray(cachedReport?.[fieldName])
    ? cachedReport[fieldName]
    : [];
  const index = labels.indexOf(catalogEntry.label);
  return index >= 0 ? values[index] ?? null : null;
}

async function fetchCatalogDefinitions(grcPublicMaterials, options = {}) {
  const { cacheOnly = false } = options;
  const catalogEntries = [...(grcPublicMaterials.catalogEntries ?? [])]
    .filter((entry) => /^20\d{2}-20\d{2}$/.test(String(entry?.label ?? "")))
    .filter((entry) => /^https?:\/\/catalog\.greenriver\.edu\//i.test(String(entry?.url ?? "")))
    .sort((left, right) => compareAcademicYearLabels(left.label, right.label));

  const cachedReport = cacheOnly ? loadCachedCatalogIngestReport() : null;
  const definitions = [];
  for (const catalogEntry of catalogEntries) {
    if (cacheOnly) {
      const snapshotPath = getCatalogSnapshotPath(catalogEntry.label);
      const currentCatalog =
        grcPublicMaterials.currentCatalog?.label === catalogEntry.label
          ? grcPublicMaterials.currentCatalog
          : null;
      const sourceUrl =
        getCachedCatalogIngestSource(cachedReport, catalogEntry, "sourceUrls") ??
        currentCatalog?.courseDescriptionsUrl ??
        catalogEntry.url;
      const expandedSourceUrl =
        getCachedCatalogIngestSource(cachedReport, catalogEntry, "expandedSourceUrls") ??
        currentCatalog?.courseDescriptionsExpandedUrl ??
        sourceUrl;
      const catalogHtml = readCatalogSnapshot(
        snapshotPath,
        "No-download mode used cached Green River catalog snapshot."
      );

      definitions.push({
        label: catalogEntry.label,
        courseDescriptionsUrl: sourceUrl,
        courseDescriptionsExpandedUrl: expandedSourceUrl,
        snapshotPath,
        html: catalogHtml.html,
        pageCount: catalogHtml.pageCount,
        usedSnapshotFallback: catalogHtml.usedSnapshotFallback,
        snapshotFallbackReason: catalogHtml.snapshotFallbackReason,
      });
      continue;
    }

    const rootHtml = await fetchText(catalogEntry.url, {
      label: `Green River catalog root ${catalogEntry.label}`,
    });
    const details = extractCurrentGrcCatalogDetails(
      rootHtml,
      catalogEntry.url,
      catalogEntry.label
    );
    const snapshotPath = getCatalogSnapshotPath(details.label);
    const catalogHtml = await fetchCatalogHtml(
      details.courseDescriptionsExpandedUrl,
      snapshotPath
    );

    definitions.push({
      label: details.label,
      courseDescriptionsUrl: details.courseDescriptionsUrl,
      courseDescriptionsExpandedUrl: details.courseDescriptionsExpandedUrl,
      snapshotPath,
      html: catalogHtml.html,
      pageCount: catalogHtml.pageCount,
      usedSnapshotFallback: catalogHtml.usedSnapshotFallback,
      snapshotFallbackReason: catalogHtml.snapshotFallbackReason,
    });
  }

  return definitions;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const cacheOnly =
    args.has("--cache-only") || process.env.GATORGUIDE_PLANNER_CACHE_ONLY === "1";
  const grcPublicMaterials = await loadGrcPublicMaterials({
    forceRefresh: false,
    allowSnapshotFallback: true,
    cacheOnly,
  });
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  const catalogDefinitions = await fetchCatalogDefinitions(grcPublicMaterials, {
    cacheOnly,
  });
  const rawEntries = catalogDefinitions.flatMap((catalogDefinition) =>
    buildCourseEntries(
      catalogDefinition.html,
      catalogDefinition.label,
      catalogDefinition.courseDescriptionsUrl
    )
  );
  const entries = mergeCourseEntries(rawEntries);
  const sourceFingerprint = sha256Text(
    catalogDefinitions
      .map((catalogDefinition) => `${catalogDefinition.label}\n${catalogDefinition.html}`)
      .join("\n\n")
  );
  const report = {
    generatedAt: new Date().toISOString(),
    sourceUrls: catalogDefinitions.map((catalogDefinition) => catalogDefinition.courseDescriptionsUrl),
    expandedSourceUrls: catalogDefinitions.map(
      (catalogDefinition) => catalogDefinition.courseDescriptionsExpandedUrl
    ),
    pageCount: catalogDefinitions.reduce(
      (sum, catalogDefinition) => sum + catalogDefinition.pageCount,
      0
    ),
    catalogRootCount: catalogDefinitions.length,
    snapshotPaths: catalogDefinitions.map((catalogDefinition) => catalogDefinition.snapshotPath),
    usedSnapshotFallback: catalogDefinitions.some(
      (catalogDefinition) => catalogDefinition.usedSnapshotFallback
    ),
    snapshotFallbackYears: catalogDefinitions
      .filter((catalogDefinition) => catalogDefinition.usedSnapshotFallback)
      .map((catalogDefinition) => catalogDefinition.label),
    snapshotFallbackReasons: catalogDefinitions
      .filter((catalogDefinition) => Boolean(catalogDefinition.snapshotFallbackReason))
      .map((catalogDefinition) => ({
        label: catalogDefinition.label,
        reason: catalogDefinition.snapshotFallbackReason,
      })),
    catalogYearLabels: catalogDefinitions.map((catalogDefinition) => catalogDefinition.label),
    sourceFingerprint,
    courseCount: entries.length,
    coursesWithCreditLabels: entries.filter((entry) => Boolean(entry.creditLabel)).length,
    coursesWithEnrollmentRequirementNotes: entries.filter(
      (entry) => (entry.prerequisiteNotes ?? []).length > 0
    ).length,
    coursesWithStructuredPrerequisitePaths: entries.filter(
      (entry) =>
        (entry.prerequisiteCourseCodes ?? []).length > 0 ||
        (entry.prerequisiteAlternativeCourseCodeSets ?? []).length > 0
    ).length,
    coursesWithGrcGeneralEducationCategories: entries.filter(
      (entry) => (entry.grcGeneralEducationCategories ?? []).length > 0
    ).length,
    grcGeneralEducationCategoryCounts: GRC_GENERAL_ED_TAG_ORDER.reduce((counts, tag) => {
      counts[tag] = entries.filter((entry) =>
        (entry.grcGeneralEducationCategories ?? []).some((category) =>
          category.tags.includes(tag)
        )
      ).length;
      return counts;
    }, {}),
    coursesWithCorequisiteNotes: entries.filter((entry) => (entry.corequisiteNotes ?? []).length > 0)
      .length,
    coursesWithStructuredCorequisitePaths: entries.filter(
      (entry) =>
        (entry.corequisiteCourseCodes ?? []).length > 0 ||
        (entry.corequisiteAlternativeCourseCodeSets ?? []).length > 0
    ).length,
    entries,
  };

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeMarkdown(report);

  console.log(
    `Parsed ${report.courseCount} merged Green River catalog courses across ${report.catalogYearLabels.length} catalog years.`
  );
  console.log(`Catalog ingest JSON: ${OUTPUT_JSON_PATH}`);
  console.log(`Catalog ingest Markdown: ${OUTPUT_MD_PATH}`);
}

module.exports = {
  parseGrcEnrollmentRequirementText,
  parseGrcCorequisiteText,
  classifyGrcGeneralEducationRequirementTags,
  buildCourseEntries,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
